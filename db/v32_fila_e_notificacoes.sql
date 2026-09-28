-- ============================================================
-- SOMA 32.0 — MIGRAÇÃO · NeuroDynamics
-- A FILA QUE ANDA SOZINHA, O SINO QUE NÃO EMPILHA E O AVISO NO APARELHO.
--
--   1. A FILA DE ENVIO. A Edge Function notificar-email esvazia as filas
--      (os avisos do sino, a agenda, as declarações, os e-mails
--      programados, o processo seletivo). Até aqui quem a acordava era um
--      agendamento montado à mão (README da função, passo 6), que precisa
--      de uma chave em formato JWT — e, sem ele, a fila só andava quando
--      alguém apertava "Enviar um e-mail de teste", porque o teste chama a
--      função com a sessão de quem está no portal. Agora:
--        - o próprio banco chama a função a cada minuto (fila_chamar, pelo
--          pg_cron e o pg_net), e também logo depois de um aviso novo (o
--          gatilho fila_acordar). A função reconhece o chamado por uma senha
--          que esta migração gera e guarda no Vault (soma_fila_token): não
--          há chave de API para colar em lugar nenhum;
--        - uma passada de cada vez (fila_passada_inicio / _fim). As funções
--          que leem as filas não reservam linhas, e duas passadas ao mesmo
--          tempo mandariam o mesmo e-mail duas vezes;
--        - cada passada fica registrada (fila_passadas): de onde veio,
--          quando, o que saiu. Administração › E-mails › Programados mostra
--          se o agendamento está chegando (fila_situacao);
--        - a rede de segurança: sem o agendamento, o portal aberto dá o
--          empurrão (fila_empurrar), no máximo um a cada dois minutos para
--          a equipe inteira, e só quando a fila está parada.
--   2. O SINO QUE NÃO EMPILHA. Apagar um aviso, limpar os lidos
--      (notificacoes_limpar), o expurgo automático (os lidos com mais de
--      30 dias e qualquer um com mais de 120) e o aviso de teste, que
--      substitui o anterior em vez de somar, e já nasce lido.
--   3. O AVISO NO APARELHO (Web Push): as inscrições de cada navegador
--      (push_inscricoes, pelas funções push_inscrever e push_cancelar), as
--      chaves VAPID no Vault (a Edge Function gera o par na primeira
--      passada) e a marca de cada aviso já empurrado (notificacoes.push_em).
--
-- Pré-requisitos: a 15.0 e a 16.0 (o sino e o e-mail) e o Vault do
-- Supabase (o mesmo da 27.0). O pg_cron e o pg_net esta migração tenta
-- ligar sozinha; sem eles, a fila anda pelo portal aberto e pelo teste.
-- Idempotente. COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- Depois: publique de novo a Edge Function notificar-email e, nela,
-- DESLIGUE a verificação de JWT (a função passa a conferir quem chama).
-- ============================================================

do $$
begin
  if to_regclass('public.notificacoes') is null or to_regprocedure('public.notificar(integer[],text,text,text,text)') is null then
    raise exception using message = 'Falta aplicar a 15.0 (v15_atividades.sql) antes desta migração.';
  end if;
  if to_regclass('public.notificacao_preferencias') is null then
    raise exception using message = 'Falta aplicar a 16.0 (v16_pessoal.sql) antes desta migração.';
  end if;
  if to_regprocedure('vault.create_secret(text,text,text,uuid)') is null then
    raise exception using message = 'O Vault do Supabase não está ligado neste banco.',
      detail = 'A senha do agendamento e a chave das notificações no aparelho moram no Vault.',
      hint = 'No painel do Supabase: Database → Extensions → procure "supabase_vault" e ligue. Depois rode esta migração de novo.';
  end if;
end $$;

-- o relógio (pg_cron) e o telefone (pg_net) do banco. Ligar pede um papel
-- com permissão; no SQL Editor do Supabase, o postgres tem. Sem eles, a
-- migração segue: a fila anda pelo portal.
do $$
begin
  begin
    if to_regnamespace('net') is null then
      if to_regnamespace('extensions') is not null then create extension if not exists pg_net with schema extensions;
      else create extension if not exists pg_net; end if;
    end if;
  exception when others then
    raise notice 'Não consegui ligar o pg_net (%). Ligue em Database → Extensions e rode esta migração de novo.', sqlerrm;
  end;
  begin
    if to_regnamespace('cron') is null then create extension if not exists pg_cron; end if;
  exception when others then
    raise notice 'Não consegui ligar o pg_cron (%). Ligue em Integrations → Cron e rode esta migração de novo.', sqlerrm;
  end;
end $$;

-- ============================================================
-- 1. A FILA
-- ------------------------------------------------------------
-- O estado, numa linha só. Ninguém lê direto: sai por fila_situacao().
create table if not exists public.fila_estado (
  id               boolean primary key default true check (id),
  em_curso_desde   timestamptz,   -- a passada que está rodando (nula: nenhuma)
  em_curso_origem  text,
  ultima_inicio    timestamptz,
  ultima_fim       timestamptz,
  ultimo_chamado   timestamptz,   -- o último chamado do banco à função
  ultimo_empurrao  timestamptz,   -- o último empurrão de um portal aberto
  ultimo_expurgo   timestamptz
);
insert into public.fila_estado (id) values (true) on conflict (id) do nothing;
alter table public.fila_estado enable row level security;

create table if not exists public.fila_passadas (
  id         bigserial primary key,
  origem     text not null,
  inicio     timestamptz not null default now(),
  fim        timestamptz,
  resultado  jsonb
);
create index if not exists fila_passadas_ix on public.fila_passadas (inicio desc);
create index if not exists fila_passadas_origem on public.fila_passadas (origem, inicio desc);
alter table public.fila_passadas enable row level security;
comment on table public.fila_passadas is
  'Cada passada da Edge Function notificar-email: de onde veio o chamado (agendamento, evento, portal, teste, servico), '
  'quando começou e terminou e o que ela respondeu. Guarda as últimas 2000.';

-- a senha do agendamento: gerada aqui, uma vez, e guardada no Vault
do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'soma_fila_token') then
    perform vault.create_secret(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 'soma_fila_token',
      'A senha com que o banco chama a Edge Function notificar-email (32.0). Trocar é apagar esta linha e rodar a 32.0 de novo.');
  end if;
end $$;

-- a função pergunta se a senha que chegou é esta (só a service role)
create or replace function public.fila_token_confere(p_token text)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(length(p_token), 0) >= 32
     and exists (select 1 from vault.decrypted_secrets where name = 'soma_fila_token' and decrypted_secret = p_token);
$$;

-- quem é o dono de um JWT: a função repassa o cabeçalho que recebeu, e o
-- PostgREST confere a assinatura antes de chegar aqui. De propósito, sem
-- security definer: o papel é o do token (anon, authenticated, service_role).
create or replace function public.fila_quem_sou()
returns jsonb language sql stable
set search_path = public as $$
  select jsonb_build_object('papel', current_user::text, 'registro', public.portal_registro_atual());
$$;

-- a passada começa: uma de cada vez. Quem chega com outra rodando recebe
-- "ocupada"; uma passada que morreu no meio libera a vez em 3 minutos.
create or replace function public.fila_passada_inicio(p_origem text default 'servico')
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_ok boolean; v_id bigint; v_or text := left(coalesce(nullif(trim(p_origem), ''), 'servico'), 20); e public.fila_estado;
begin
  update fila_estado set em_curso_desde = now(), em_curso_origem = v_or, ultima_inicio = now()
   where id and (em_curso_desde is null or em_curso_desde < now() - interval '3 minutes')
  returning true into v_ok;
  if not coalesce(v_ok, false) then
    select * into e from fila_estado where id;
    return jsonb_build_object('status', 'ocupada', 'desde', e.em_curso_desde, 'origem', e.em_curso_origem);
  end if;
  insert into fila_passadas (origem) values (v_or) returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end $$;

-- a passada termina: registra o que saiu, libera a vez e, uma vez por hora,
-- limpa o sino (os avisos velhos) e o próprio registro
create or replace function public.fila_passada_fim(p_id bigint, p_resultado jsonb default null)
returns void language plpgsql volatile security definer
set search_path = public as $$
declare v_exp timestamptz;
begin
  update fila_passadas set fim = now(), resultado = p_resultado where id = p_id;
  update fila_estado set em_curso_desde = null, em_curso_origem = null, ultima_fim = now() where id
  returning ultimo_expurgo into v_exp;
  if v_exp is null or v_exp < now() - interval '1 hour' then
    perform public.notificacoes_expurgar();
    delete from fila_passadas where id <= coalesce((select id from fila_passadas order by id desc offset 2000 limit 1), 0);
  end if;
end $$;

-- o chamado do banco à função: pelo pg_net, com a senha do Vault. O
-- cabeçalho Authorization vai junto quando há um JWT à mão — a chave que o
-- passo 6 antigo guardou no Vault, uma assinada com o segredo do projeto,
-- ou a sessão de quem acabou de agir —, para o chamado passar também com a
-- verificação de JWT da função ligada. Nunca derruba quem chamou.
create or replace function public.fila_jwt_servico()
returns text language plpgsql stable security definer
set search_path = public, extensions as $$
declare v_seg text := nullif(current_setting('app.settings.jwt_secret', true), ''); v_cab text; v_corpo text; v_ass text;
begin
  if v_seg is null then return null; end if;
  v_cab := translate(encode(convert_to('{"alg":"HS256","typ":"JWT"}', 'utf8'), 'base64'), E'+/=\n', '-_');
  v_corpo := translate(encode(convert_to(json_build_object('role', 'service_role', 'iss', 'supabase',
      'iat', extract(epoch from now())::bigint, 'exp', extract(epoch from now())::bigint + 300)::text, 'utf8'), 'base64'), E'+/=\n', '-_');
  v_ass := translate(encode(hmac(convert_to(v_cab || '.' || v_corpo, 'utf8'), convert_to(v_seg, 'utf8'), 'sha256'), 'base64'), E'+/=\n', '-_');
  return v_cab || '.' || v_corpo || '.' || v_ass;
exception when others then
  return null;
end $$;

create or replace function public.fila_chamar(p_origem text default 'agendamento')
returns bigint language plpgsql volatile security definer
set search_path = public as $$
declare
  e public.fila_estado; v_token text; v_url text; v_jwt text; v_req text; v_id bigint;
begin
  if to_regnamespace('net') is null then return null; end if;
  select * into e from fila_estado where id for update skip locked;
  if not found then return null; end if;                 -- outro chamado está nisso agora
  if (e.em_curso_desde is not null and e.em_curso_desde > now() - interval '3 minutes')
     or (e.ultimo_chamado is not null and e.ultimo_chamado > now() - interval '20 seconds') then
    return null;                                          -- já tem passada rodando, ou chamada recente
  end if;
  v_token := (select decrypted_secret from vault.decrypted_secrets where name = 'soma_fila_token');
  if v_token is null then return null; end if;
  v_url := rtrim(coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'soma_url_projeto'),
                          'https://rxzmkyjttzzpwtodqkve.supabase.co'), '/');
  v_jwt := (select decrypted_secret from vault.decrypted_secrets where name = 'chave_servico' and decrypted_secret like 'ey%');
  v_jwt := coalesce(v_jwt, public.fila_jwt_servico());
  if v_jwt is null then
    v_req := nullif(current_setting('request.headers', true), '');
    if v_req is not null then
      begin v_jwt := nullif(regexp_replace(coalesce(v_req::jsonb ->> 'authorization', ''), '^Bearer\s+', '', 'i'), '');
      exception when others then v_jwt := null; end;
      if v_jwt not like 'ey%' then v_jwt := null; end if;
    end if;
  end if;
  update fila_estado set ultimo_chamado = now() where id;
  execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 60000)'
     into v_id
    using v_url || '/functions/v1/notificar-email',
          jsonb_build_object('origem', left(coalesce(p_origem, 'agendamento'), 20)),
          jsonb_strip_nulls(jsonb_build_object('Content-Type', 'application/json', 'x-soma-fila', v_token,
            'Authorization', case when v_jwt is not null then 'Bearer ' || v_jwt end));
  return v_id;
exception when others then
  raise warning 'fila_chamar: %', sqlerrm;
  return null;
end $$;

-- um aviso novo, um e-mail da agenda, uma declaração: a fila acorda na hora,
-- em vez de esperar o minuto do relógio. O chamado sai depois do commit
-- (é o pg_net quem manda), e um aviso que falha aqui não derruba a ação.
create or replace function public.fila_acordar()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.fila_chamar('evento');
  return null;
exception when others then
  return null;
end $$;

-- os avisos do sino acordam a fila, menos os de teste: quem cria um teste
-- (o do e-mail ou o do aparelho) manda a função rodar logo em seguida, e
-- uma segunda passada, acordada aqui, disputaria o mesmo aviso com ela
create or replace function public.fila_acordar_avisos()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if exists (select 1 from novos where coalesce(tipo, '') not in ('teste_email', 'teste_push')) then
    perform public.fila_chamar('evento');
  end if;
  return null;
exception when others then
  return null;
end $$;

drop trigger if exists fila_acordar_notificacoes on public.notificacoes;
create trigger fila_acordar_notificacoes after insert on public.notificacoes
  referencing new table as novos
  for each statement execute function public.fila_acordar_avisos();
do $$
declare t text;
begin
  foreach t in array array['agenda_envios', 'doc_envios', 'ps_envios'] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop trigger if exists fila_acordar_%1$s on public.%1$I', t);
      execute format('create trigger fila_acordar_%1$s after insert on public.%1$I for each statement execute function public.fila_acordar()', t);
    end if;
  end loop;
end $$;

-- o empurrão do portal: quem abre o SOMA pergunta se a fila está parada;
-- um só, para a equipe inteira, a cada dois minutos, recebe "sim" e chama a
-- função com a própria sessão. Com o agendamento em dia, ninguém empurra.
create or replace function public.fila_empurrar()
returns boolean language plpgsql volatile security definer
set search_path = public as $$
declare v boolean;
begin
  if public.portal_registro_atual() is null then return false; end if;
  update fila_estado set ultimo_empurrao = now()
   where id
     and (ultimo_empurrao is null or ultimo_empurrao < now() - interval '2 minutes')
     and (em_curso_desde is null or em_curso_desde < now() - interval '3 minutes')
     and (ultima_inicio is null or ultima_inicio < now() - interval '2 minutes')
  returning true into v;
  return coalesce(v, false);
end $$;

-- o que a gestão vê em Administração › E-mails: se o agendamento existe e
-- chega, a última passada de cada origem, o último erro e o que espera
create or replace function public.fila_situacao()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  e public.fila_estado; v_agendada boolean := false; v_pend jsonb := '{}'::jsonb; n bigint;
begin
  if coalesce(public.papel_atual(), '') not in ('admin', 'pessoal', 'selecao') then
    return jsonb_build_object('status', 'sem_permissao');
  end if;
  select * into e from fila_estado where id;
  if to_regnamespace('cron') is not null then
    begin execute 'select exists (select 1 from cron.job where jobname = ''soma-fila'' and active)' into v_agendada;
    exception when others then v_agendada := false; end;
  end if;
  select count(*) into n from notificacoes nt
   where nt.email_em is null and nt.email_tentativas < 5 and nt.criado_em > now() - interval '3 days'
     and not exists (select 1 from notificacao_preferencias p where p.registro = nt.registro and p.email_modo = 'nunca');
  v_pend := v_pend || jsonb_build_object('avisos', n);
  if to_regclass('public.agenda_envios') is not null then
    execute 'select count(*) from agenda_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('agenda', n);
  end if;
  if to_regclass('public.doc_envios') is not null then
    execute 'select count(*) from doc_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('declaracoes', n);
  end if;
  if to_regclass('public.ps_envios') is not null then
    execute 'select count(*) from ps_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('selecao', n);
  end if;
  if to_regclass('public.email_programados') is not null then
    execute 'select count(*) from email_programados where status = ''programado'' and enviar_em <= now()' into n;
    v_pend := v_pend || jsonb_build_object('programados', n);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'agendada', v_agendada,
    'em_curso_desde', e.em_curso_desde, 'em_curso_origem', e.em_curso_origem,
    'ultima_inicio', e.ultima_inicio, 'ultima_fim', e.ultima_fim,
    'ultimo_chamado', e.ultimo_chamado, 'ultimo_empurrao', e.ultimo_empurrao,
    'por_origem', coalesce((select jsonb_object_agg(origem, ultima)
                              from (select origem, max(inicio) as ultima from fila_passadas group by origem) x), '{}'::jsonb),
    'ultimo_erro', (select jsonb_build_object('quando', inicio, 'origem', origem, 'resultado', resultado)
                      from fila_passadas
                     where resultado is not null and coalesce(resultado->>'status', '') not in ('ok', 'ocupada')
                     order by id desc limit 1),
    'pendentes', v_pend);
end $$;

-- o relógio: a cada minuto, onde o pg_cron e o pg_net existem. O agendamento
-- antigo (README, passo 6) chama a mesma função, e com os dois a fila
-- passaria duas vezes: ele sai, e o que ele sabia (o endereço do projeto e a
-- chave, quando escrita no comando) fica guardado no Vault para o novo usar.
do $$
declare v_cmd text; v_bearer text; v_url text;
begin
  if to_regnamespace('cron') is null or to_regnamespace('net') is null then
    raise notice 'Sem o pg_cron e o pg_net: a fila anda quando alguém abre o portal. Ligue os dois e rode esta migração de novo.';
    return;
  end if;
  begin
    execute 'select command from cron.job where jobname = ''notificar-email'' limit 1' into v_cmd;
  exception when others then v_cmd := null; end;
  if v_cmd is not null then
    v_bearer := substring(v_cmd from 'Bearer\s+([A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+)');
    v_url := substring(v_cmd from '(https://[a-z0-9]+\.supabase\.co)');
    if v_bearer is not null and not exists (select 1 from vault.decrypted_secrets where name = 'chave_servico') then
      perform vault.create_secret(v_bearer, 'chave_servico', 'A chave do agendamento antigo da notificar-email, guardada pela 32.0.');
    end if;
    if v_url is not null and not exists (select 1 from vault.decrypted_secrets where name = 'soma_url_projeto') then
      perform vault.create_secret(v_url, 'soma_url_projeto', 'O endereço do projeto, para o banco chamar as Edge Functions (32.0).');
    end if;
    execute 'select cron.unschedule(''notificar-email'')';
    raise notice 'O agendamento antigo (notificar-email) saiu: o soma-fila faz o mesmo, a cada minuto.';
  end if;
  execute 'select cron.schedule(''soma-fila'', ''* * * * *'', $c$select public.fila_chamar(''agendamento'')$c$)';
  raise notice 'Agendado: soma-fila, a cada minuto. Confira: select jobname, schedule, active from cron.job;';
exception when others then
  raise notice 'Não consegui agendar a fila (%). A fila anda pelo portal; ligue o Cron e rode esta migração de novo.', sqlerrm;
end $$;

-- ============================================================
-- 2. O SINO QUE NÃO EMPILHA
-- ------------------------------------------------------------
create index if not exists notif_criado_ix on public.notificacoes (criado_em);

-- apagar os seus: um (ou alguns) pelo id, todos os lidos (o padrão) ou todos
create or replace function public.notificacoes_limpar(p_ids bigint[] default null, p_todas boolean default false)
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_n integer;
begin
  if v_reg is null then return 0; end if;
  delete from notificacoes
   where registro = v_reg
     and case when p_ids is not null then id = any(p_ids)
              when coalesce(p_todas, false) then true
              else lida end;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- o expurgo: lido há mais de 30 dias, qualquer um há mais de 120, e os de
-- teste depois de um dia. Roda na passada da fila, uma vez por hora.
create or replace function public.notificacoes_expurgar()
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare v_n integer;
begin
  delete from notificacoes
   where (lida and criado_em < now() - interval '30 days')
      or criado_em < now() - interval '120 days'
      or (tipo in ('teste_email', 'teste_push') and criado_em < now() - interval '1 day');
  get diagnostics v_n = row_count;
  update fila_estado set ultimo_expurgo = now() where id;
  return v_n;
end $$;

-- o aviso de teste: substitui o anterior da pessoa em vez de somar, e nasce
-- lido — é um teste do e-mail, não uma novidade no sino. (Mesmo corpo na
-- 18.0, que é a dona desta função: rodar qualquer uma chega no mesmo lugar.)
create or replace function public.notificacao_teste()
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_email text;
  v_nome  text;
  v_modo  text;
  v_id    bigint;
begin
  if v_reg is null then
    return jsonb_build_object('status','sem_registro');
  end if;

  select nome, coalesce(nullif(email_nro,''), nullif(email_pessoal,''))
    into v_nome, v_email
    from membros where registro = v_reg;

  if v_email is null then
    return jsonb_build_object('status','sem_email','nome',v_nome);
  end if;

  select email_modo into v_modo
    from notificacao_preferencias where registro = v_reg;
  v_modo := coalesce(v_modo, 'imediato');

  -- o teste substitui o anterior em vez de somar, e nasce lido: é um
  -- teste do e-mail, não uma novidade no sino (desde a 32.0, que tem o
  -- mesmo corpo — rodar qualquer uma das duas chega no mesmo lugar)
  delete from notificacoes where registro = v_reg and tipo = 'teste_email';

  insert into notificacoes (registro, tipo, titulo, corpo, href, lida)
  values (v_reg, 'teste_email',
          'Teste de envio — ' || to_char(now() at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI:SS'),
          'Se este e-mail chegou na sua caixa, o envio do portal está '
          || 'configurado e funcionando. Pode apagar.',
          '#/inicio', true)
  returning id into v_id;

  return jsonb_build_object('status','ok','id',v_id,'email',v_email,'modo',v_modo);
end $$;

-- ============================================================
-- 3. O AVISO NO APARELHO (Web Push)
-- ------------------------------------------------------------
-- Cada navegador que aceitou receber é uma inscrição: o endereço do serviço
-- de push dele e as duas chaves com que a mensagem é cifrada. A tabela não
-- se lê nem se escreve direto: a pessoa inscreve, lista e cancela as suas
-- pelas funções; a Edge Function lê pela service role.
create table if not exists public.push_inscricoes (
  id         uuid primary key default gen_random_uuid(),
  registro   integer not null references public.membros(registro) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null check (p256dh ~ '^[A-Za-z0-9_-]{80,100}$'),
  auth       text not null check (auth ~ '^[A-Za-z0-9_-]{16,32}$'),
  aparelho   text,
  criado_em  timestamptz not null default now(),
  visto_em   timestamptz not null default now(),
  falhas     smallint not null default 0
);
create index if not exists push_insc_registro on public.push_inscricoes (registro);
alter table public.push_inscricoes enable row level security;
comment on table public.push_inscricoes is
  'Os navegadores que recebem os avisos do sino como notificação do aparelho (Web Push). '
  'Um por endpoint; quem entra com outra conta no mesmo navegador leva a inscrição para si.';

alter table public.notificacoes add column if not exists push_em timestamptz;
create index if not exists notif_push_pend on public.notificacoes (criado_em) where push_em is null;

create or replace function public.push_inscrever(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_end text := trim(coalesce(p->>'endpoint', ''));
  v_pk  text := trim(coalesce(p->>'p256dh', ''));
  v_au  text := trim(coalesce(p->>'auth', ''));
  v_id  uuid;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  if v_end !~ '^https://' or length(v_end) > 1000
     or v_pk !~ '^[A-Za-z0-9_-]{80,100}$' or v_au !~ '^[A-Za-z0-9_-]{16,32}$' then
    return jsonb_build_object('status', 'invalido');
  end if;
  insert into push_inscricoes as i (registro, endpoint, p256dh, auth, aparelho)
  values (v_reg, v_end, v_pk, v_au, left(nullif(trim(p->>'aparelho'), ''), 80))
  on conflict (endpoint) do update
     set registro = excluded.registro, p256dh = excluded.p256dh, auth = excluded.auth,
         aparelho = coalesce(excluded.aparelho, i.aparelho), visto_em = now(), falhas = 0,
         -- outra conta no mesmo navegador: conta como inscrição nova
         criado_em = case when i.registro = excluded.registro then i.criado_em else now() end
  returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end $$;

-- cancelar a deste navegador (pelo endpoint) ou outra das suas (pelo id)
create or replace function public.push_cancelar(p_endpoint text default null, p_id uuid default null)
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_n integer;
begin
  if v_reg is null then return 0; end if;
  delete from push_inscricoes
   where registro = v_reg and ((p_endpoint is not null and endpoint = p_endpoint) or (p_id is not null and id = p_id));
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- os aparelhos da pessoa, sem as chaves
create or replace function public.push_meus()
returns jsonb language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'aparelho', aparelho, 'criado_em', criado_em,
           'visto_em', visto_em, 'endpoint_fim', right(endpoint, 12)) order by criado_em desc), '[]'::jsonb)
    from push_inscricoes where registro = public.portal_registro_atual();
$$;

-- a chave pública VAPID, que o navegador precisa para se inscrever. Nula até
-- a Edge Function gerar o par, na primeira passada.
create or replace function public.push_chave_publica()
returns text language sql stable security definer
set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'soma_vapid_publica';
$$;

-- o par, para a Edge Function assinar e cifrar (só a service role)
create or replace function public.push_chaves()
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'publica', (select decrypted_secret from vault.decrypted_secrets where name = 'soma_vapid_publica'),
    'privada', (select decrypted_secret from vault.decrypted_secrets where name = 'soma_vapid_privada'));
$$;

-- o par nasce uma vez: quem grava primeiro vence, e todo mundo recebe o que ficou
create or replace function public.push_chaves_gravar(p_publica text, p_privada text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtext('soma_vapid'));
  if not exists (select 1 from vault.decrypted_secrets where name = 'soma_vapid_publica')
     and p_publica ~ '^[A-Za-z0-9_-]{80,100}$' and coalesce(p_privada, '') like '{%' then
    perform vault.create_secret(p_privada, 'soma_vapid_privada',
      'A chave privada VAPID das notificações no aparelho (32.0). Apagar desfaz todas as inscrições.');
    perform vault.create_secret(p_publica, 'soma_vapid_publica',
      'A chave pública VAPID das notificações no aparelho (32.0).');
  end if;
  return public.push_chaves();
end $$;

-- o lote: os avisos novos (do último dia) de quem tem inscrição, com as
-- inscrições de cada pessoa. Um aviso só vai para a inscrição que já existia
-- quando ele nasceu: o aparelho novo não recebe o acumulado de uma vez.
create or replace function public.push_lote(p_limite integer default 300)
returns jsonb language sql stable security definer
set search_path = public as $$
  with pend as (
    select n.id, n.registro, n.tipo, n.titulo, n.corpo, n.href, n.criado_em
      from notificacoes n
     where n.push_em is null
       and n.criado_em > now() - interval '1 day'
       and exists (select 1 from push_inscricoes i where i.registro = n.registro)
     order by n.criado_em
     limit greatest(coalesce(p_limite, 300), 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object('registro', q.registro, 'itens', q.itens, 'inscricoes', q.inscricoes)), '[]'::jsonb)
    from (select p.registro,
                 jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'corpo', p.corpo,
                                              'href', p.href, 'criado_em', p.criado_em) order by p.criado_em) as itens,
                 (select jsonb_agg(jsonb_build_object('id', i.id, 'endpoint', i.endpoint, 'p256dh', i.p256dh,
                                                      'auth', i.auth, 'criado_em', i.criado_em))
                    from push_inscricoes i where i.registro = p.registro) as inscricoes
            from pend p group by p.registro) q;
$$;

-- a baixa: os avisos que já foram, as inscrições que o serviço de push deu
-- por mortas (404/410: o navegador desinstalou ou revogou), as que falharam
-- e as que receberam
create or replace function public.push_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_itens  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'itens', '[]'::jsonb)) x), '{}');
  v_mortas uuid[]   := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'mortas', '[]'::jsonb)) x), '{}');
  v_falhas uuid[]   := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'falhas', '[]'::jsonb)) x), '{}');
  v_ok     uuid[]   := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(p->'ok', '[]'::jsonb)) x), '{}');
  v_n integer := 0;
begin
  update notificacoes set push_em = now() where id = any(v_itens) and push_em is null;
  get diagnostics v_n = row_count;
  delete from push_inscricoes where id = any(v_mortas);
  update push_inscricoes set falhas = falhas + 1 where id = any(v_falhas);
  delete from push_inscricoes where falhas >= 20;
  update push_inscricoes set falhas = 0, visto_em = now() where id = any(v_ok);
  return jsonb_build_object('status', 'ok', 'itens', v_n);
end $$;

-- o teste do aparelho: um aviso só para empurrar, sem e-mail e já lido
create or replace function public.push_teste()
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_n integer; v_id bigint;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  select count(*) into v_n from push_inscricoes where registro = v_reg;
  if v_n = 0 then return jsonb_build_object('status', 'sem_inscricao'); end if;
  delete from notificacoes where registro = v_reg and tipo = 'teste_push';
  insert into notificacoes (registro, tipo, titulo, corpo, href, lida, email_em)
  values (v_reg, 'teste_push', 'Teste de notificação',
          'Se isto apareceu no seu aparelho, as notificações do SOMA estão funcionando.', '#/', true, now())
  returning id into v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id, 'aparelhos', v_n);
end $$;

-- ============================================================
-- 4. QUEM EXECUTA O QUÊ
-- ------------------------------------------------------------
revoke all on public.fila_estado, public.fila_passadas, public.push_inscricoes from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on public.fila_estado, public.fila_passadas, public.push_inscricoes from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on public.fila_estado, public.fila_passadas, public.push_inscricoes from authenticated';
  end if;
end $$;

revoke execute on function public.fila_token_confere(text)      from public;
revoke execute on function public.fila_passada_inicio(text)     from public;
revoke execute on function public.fila_passada_fim(bigint, jsonb) from public;
revoke execute on function public.fila_jwt_servico()            from public;
revoke execute on function public.fila_chamar(text)             from public;
revoke execute on function public.fila_acordar()                from public;
revoke execute on function public.fila_acordar_avisos()         from public;
revoke execute on function public.notificacoes_expurgar()       from public;
revoke execute on function public.push_chaves()                 from public;
revoke execute on function public.push_chaves_gravar(text, text) from public;
revoke execute on function public.push_lote(integer)            from public;
revoke execute on function public.push_baixa(jsonb)             from public;
revoke execute on function public.fila_empurrar()               from public;
revoke execute on function public.fila_situacao()               from public;
revoke execute on function public.notificacoes_limpar(bigint[], boolean) from public;
revoke execute on function public.push_inscrever(jsonb)         from public;
revoke execute on function public.push_cancelar(text, uuid)     from public;
revoke execute on function public.push_meus()                   from public;
revoke execute on function public.push_chave_publica()          from public;
revoke execute on function public.push_teste()                  from public;
revoke execute on function public.notificacao_teste()           from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.fila_empurrar(), public.fila_situacao(), public.notificacoes_limpar(bigint[], boolean),
      public.push_inscrever(jsonb), public.push_cancelar(text, uuid), public.push_meus(), public.push_chave_publica(),
      public.push_teste(), public.notificacao_teste() from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant execute on function public.fila_empurrar(), public.fila_situacao(), public.notificacoes_limpar(bigint[], boolean),
      public.push_inscrever(jsonb), public.push_cancelar(text, uuid), public.push_meus(), public.push_chave_publica(),
      public.push_teste(), public.notificacao_teste() to authenticated';
  end if;
  -- quem é o dono do token: qualquer papel que o PostgREST aceite pergunta
  execute 'grant execute on function public.fila_quem_sou() to public';
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.fila_token_confere(text), public.fila_passada_inicio(text),
      public.fila_passada_fim(bigint, jsonb), public.push_chaves(), public.push_chaves_gravar(text, text),
      public.push_lote(integer), public.push_baixa(jsonb), public.notificacoes_expurgar(), public.fila_chamar(text)
      to service_role';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v32_fila_e_notificacoes', 'A fila de envio que anda sozinha (fila_chamar a cada minuto, uma passada por vez, o registro das passadas, o empurrão do portal), o sino que não empilha (limpar, expurgo, teste que substitui) e as notificações no aparelho (Web Push: push_inscricoes, chaves VAPID no Vault)')
on conflict (id) do nothing;

-- ============================================================
-- CONFERIR
--   select jobname, schedule, active from cron.job where jobname = 'soma-fila';
--   select public.fila_chamar('manual');      -- manda a função rodar agora
--   select origem, inicio, fim, resultado from public.fila_passadas order by id desc limit 10;
--   select id, status_code, left(content::text, 200) from net._http_response order by id desc limit 5;
--     (401 aqui: a verificação de JWT da função continua ligada — desligue
--      em Edge Functions › notificar-email)
-- ============================================================
