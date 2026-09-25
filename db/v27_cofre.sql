-- ============================================================
-- SOMA 27.0 — MIGRAÇÃO · NeuroDynamics
-- O COFRE: AS SENHAS E OS CÓDIGOS DAS CONTAS DA EQUIPE.
--
-- Cada acesso do catálogo (Administração › Catálogo de acessos) pode
-- ter uma ou mais CONTAS no cofre: o endereço, o usuário, a senha —
-- gerada no próprio SOMA —, o segredo do código de duas etapas e as
-- notas que também são segredo (códigos de recuperação, perguntas de
-- segurança). O que é segredo não fica em tabela nenhuma: fica no
-- VAULT do Supabase, cifrado com uma chave que mora fora do banco, e a
-- tabela guarda só o identificador. Um backup do banco não traz senha
-- nenhuma em claro.
--
-- QUEM USA uma conta: quem está num dos grupos dela (contando
-- subgrupos, como sempre), quem tem o acesso do catálogo concedido na
-- ficha — o mesmo que Serviços › Solicitação de acesso concede — e os
-- responsáveis por ela. Tudo pela pertença e pela concessão de hoje:
-- saiu do grupo, perdeu a conta; o acesso foi revogado, também.
-- QUEM MANTÉM: os responsáveis (trocam a senha, o código, as notas) e
-- os gestores do cofre, que admin escolhe.
--
-- TODO SEGREDO QUE SAI, SAI REGISTRADO. Ver ou copiar uma senha e
-- gerar um código ficam no registro de uso da conta, com quem e
-- quando — e quem saiu da equipe depois de ver uma senha deixa a conta
-- marcada para troca.
--
-- O CÓDIGO DE DUAS ETAPAS (TOTP, RFC 6238) é calculado AQUI, no banco:
-- o segredo que o serviço deu na configuração do 2FA nunca desce para
-- o navegador. A equipe gera o código na hora pelo portal, sem
-- depender do celular de uma pessoa só.
--
-- A TROCA PERIÓDICA: cada conta tem um prazo (o padrão é 180 dias); a
-- partir de 14 dias antes, os responsáveis recebem o lembrete no sino
-- e por e-mail, e de novo toda semana enquanto não trocarem. A troca
-- guarda a senha anterior por 30 dias — se o serviço não aceitou a
-- nova, ninguém fica trancado do lado de fora.
--
-- Pré-requisitos: SOMA 19.0, o Vault do Supabase (vem ligado; é o
-- mesmo em que a chave do agendamento do notificar-email mora) e o
-- pgcrypto (também vem ligado).
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.grupos_de(integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'O cofre decide quem usa cada conta pela pertença efetiva aos grupos (grupos_de, da 19.0).';
  end if;
  if to_regprocedure('vault.create_secret(text,text,text,uuid)') is null then
    raise exception using message = 'O Vault do Supabase não está ligado neste banco.',
      detail = 'O cofre guarda as senhas no Vault, cifradas com uma chave que mora fora do banco.',
      hint = 'No painel do Supabase: Database → Extensions → procure "supabase_vault" e ligue. Depois rode esta migração de novo.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where p.proname = 'hmac' and n.nspname in ('public', 'extensions')) then
    if to_regnamespace('extensions') is not null then
      create extension if not exists pgcrypto with schema extensions;
    else
      create extension if not exists pgcrypto;
    end if;
  end if;
end $$;

-- ============================================================
-- 1. A CONFIGURAÇÃO — uma linha só
-- ------------------------------------------------------------
create table if not exists public.cofre_config (
  id                  boolean primary key default true check (id),
  grupos_gestores     integer[] not null default '{}',
  rotacao_padrao_dias integer   not null default 180 check (rotacao_padrao_dias between 0 and 3650),
  aviso_dias          integer   not null default 14  check (aviso_dias between 1 and 90),
  anterior_dias       integer   not null default 30  check (anterior_dias between 0 and 365),
  atualizado_em       timestamptz not null default now(),
  atualizado_por      text
);
insert into public.cofre_config (id) values (true) on conflict (id) do nothing;
comment on table public.cofre_config is
  'Uma linha. Quem gere o cofre (além de admin), o prazo padrão de troca das senhas (0 = não pede troca), '
  'com quantos dias de antecedência avisar e por quanto tempo a senha anterior fica guardada.';

create or replace function public.cofre_meu_nome()
returns text language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select nome from membros where registro = public.portal_registro_atual()),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
    'Portal');
$$;

-- Gere o cofre: admin e quem está num dos grupos gestores.
create or replace function public.cofre_gestor()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.papel_atual(), '') = 'admin'
      or coalesce((select public.grupos_de(public.portal_registro_atual()) && c.grupos_gestores
                     from cofre_config c), false);
$$;

alter table public.cofre_config enable row level security;
drop policy if exists cofre_cfg_select on public.cofre_config;
create policy cofre_cfg_select on public.cofre_config for select to authenticated using (true);
drop policy if exists cofre_cfg_update on public.cofre_config;
create policy cofre_cfg_update on public.cofre_config for update to authenticated
  using (public.cofre_gestor()) with check (public.cofre_gestor());
grant select, update on public.cofre_config to authenticated;

-- Quem gere escolhe os prazos; quem ENTRA na gestão, só admin decide —
-- senão um grupo gestor se estenderia sozinho, e o cofre é o lugar
-- onde isso mais importa.
create or replace function public.cofre_config_carimbo()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.grupos_gestores is distinct from old.grupos_gestores
     and coalesce(public.papel_atual(), '') <> 'admin' then
    raise exception using errcode = 'P0001', message = 'cofre_so_admin',
      detail = 'Só admin escolhe os grupos que gerem o cofre.';
  end if;
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := public.cofre_meu_nome();
  select coalesce(array_agg(distinct g order by g), '{}') into new.grupos_gestores
    from unnest(new.grupos_gestores) g where exists (select 1 from grupos where id = g);
  return new;
end $$;
drop trigger if exists tg_cofre_cfg_carimbo on public.cofre_config;
create trigger tg_cofre_cfg_carimbo before update on public.cofre_config
  for each row execute function public.cofre_config_carimbo();

-- ============================================================
-- 2. AS CONTAS E O REGISTRO DE USO
-- ------------------------------------------------------------
create table if not exists public.cofre_credenciais (
  id                 uuid primary key default gen_random_uuid(),
  item_id            uuid not null references public.itens_de_acesso(id) on delete restrict,
  rotulo             text,                   -- "Conta principal", "Administrador"
  url                text,                   -- onde se entra
  usuario            text,                   -- o login
  senha_id           uuid,                   -- no Vault
  senha_anterior_id  uuid,                   -- no Vault, até senha_anterior_ate
  senha_anterior_ate timestamptz,
  totp_id            uuid,                   -- no Vault: o segredo do 2FA, em base32
  totp_digitos       smallint not null default 6  check (totp_digitos in (6, 7, 8)),
  totp_periodo       smallint not null default 30 check (totp_periodo in (15, 30, 60)),
  totp_algoritmo     text not null default 'SHA1' check (totp_algoritmo in ('SHA1','SHA256','SHA512')),
  notas_id           uuid,                   -- no Vault: códigos de recuperação, respostas de segurança
  instrucoes         text,                   -- o que NÃO é segredo: como entrar, de quem é a conta
  grupos             integer[] not null default '{}',
  responsaveis       integer[] not null default '{}',
  rotacao_dias       integer check (rotacao_dias is null or rotacao_dias between 0 and 3650),  -- nulo = o padrão
  trocada_em         timestamptz,
  trocada_nome       text,
  lembrado_em        timestamptz,
  ativo              boolean not null default true,
  criado_por         integer references public.membros(registro) on delete set null,
  criado_nome        text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  constraint cofre_url_http check (url is null or url ~* '^https?://[^\s]+$')
);
create index if not exists cofre_cred_item on public.cofre_credenciais (item_id);

comment on table public.cofre_credenciais is
  'Uma conta de um acesso do catálogo. O que é segredo (senha, a anterior, o segredo do 2FA, as notas) '
  'mora no Vault; aqui ficam só os identificadores. Não se lê direto: é cofre_lista() e cofre_revelar().';

create table if not exists public.cofre_log (
  id            bigserial primary key,
  credencial_id uuid references public.cofre_credenciais(id) on delete set null,
  conta         text,                        -- "Instagram — Conta principal", para sobreviver à exclusão
  registro      integer,
  nome          text,
  acao          text not null,
  detalhe       text,
  criado_em     timestamptz not null default now()
);
create index if not exists cofre_log_cred on public.cofre_log (credencial_id, criado_em desc);

-- Nada disto se lê direto: nem a lista das contas (quem vê o quê é
-- regra, não política), nem o registro de uso.
alter table public.cofre_credenciais enable row level security;
alter table public.cofre_log         enable row level security;

-- ============================================================
-- 3. QUEM USA, QUEM MANTÉM, QUANDO VENCE
-- ------------------------------------------------------------
create or replace function public.cofre_ativo(p_reg integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from membros where registro = p_reg
                   and coalesce(status, 'Ativo') in ('Ativo','Em pausa / avaliação','Sob demanda'));
$$;

-- Por onde a pessoa chega a esta conta: 'gestao', 'responsavel',
-- 'grupo', 'acesso' — ou nulo, se não chega.
create or replace function public.cofre_via(c public.cofre_credenciais)
returns text language sql stable security definer
set search_path = public as $$
  select case
    when public.cofre_gestor() then 'gestao'
    when not c.ativo then null
    when public.portal_registro_atual() is null or not public.cofre_ativo(public.portal_registro_atual()) then null
    when public.portal_registro_atual() = any(c.responsaveis) then 'responsavel'
    when public.grupos_de(public.portal_registro_atual()) && c.grupos then 'grupo'
    when exists (select 1 from acessos_concedidos ac
                  where ac.registro = public.portal_registro_atual() and ac.item_id = c.item_id and ac.ativo
                    and (ac.revogado_em is null or ac.revogado_em > current_date)) then 'acesso'
  end;
$$;

-- Mantém (troca a senha, o 2FA, as notas): os responsáveis e a gestão.
create or replace function public.cofre_mantem(c public.cofre_credenciais)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.cofre_gestor()
      or (c.ativo and public.portal_registro_atual() = any(c.responsaveis)
          and public.cofre_ativo(public.portal_registro_atual()));
$$;

-- O prazo que vale: o da conta, ou o padrão. Zero = não pede troca.
create or replace function public.cofre_vence_em(c public.cofre_credenciais)
returns timestamptz language sql stable security definer
set search_path = public as $$
  select case when c.senha_id is null then null
              when coalesce(c.rotacao_dias, cfg.rotacao_padrao_dias) = 0 then null
              else coalesce(c.trocada_em, c.criado_em) + make_interval(days => coalesce(c.rotacao_dias, cfg.rotacao_padrao_dias)) end
    from cofre_config cfg;
$$;

-- Alguém que viu ou copiou a senha saiu da equipe depois da última
-- troca: a senha saiu junto, e a conta pede troca.
create or replace function public.cofre_exposta(c public.cofre_credenciais)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from cofre_log l join membros m on m.registro = l.registro
     where l.credencial_id = c.id and l.acao in ('viu_senha','copiou_senha')
       and l.criado_em > coalesce(c.trocada_em, c.criado_em)
       and coalesce(m.status, 'Ativo') in ('Desligado','Egresso'));
$$;

create or replace function public.cofre_situacao(c public.cofre_credenciais)
returns text language sql stable security definer
set search_path = public as $$
  select case
    when not c.ativo then 'desativada'
    when c.senha_id is null then 'sem_senha'
    when public.cofre_exposta(c) then 'exposta'
    when public.cofre_vence_em(c) is null then 'sem_troca'
    when public.cofre_vence_em(c) < now() then 'vencida'
    when public.cofre_vence_em(c) < now() + make_interval(days => (select aviso_dias from cofre_config)) then 'vence_logo'
    else 'em_dia' end;
$$;

do $$
declare f text;
begin
  foreach f in array array['cofre_ativo(integer)', 'cofre_via(public.cofre_credenciais)',
    'cofre_mantem(public.cofre_credenciais)', 'cofre_vence_em(public.cofre_credenciais)',
    'cofre_exposta(public.cofre_credenciais)', 'cofre_situacao(public.cofre_credenciais)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

create or replace function public.cofre_conta_nome(c public.cofre_credenciais)
returns text language sql stable security definer
set search_path = public as $$
  select coalesce((select nome from itens_de_acesso where id = c.item_id), 'Conta')
         || coalesce(' — ' || nullif(trim(c.rotulo), ''), '');
$$;
revoke execute on function public.cofre_conta_nome(public.cofre_credenciais) from public, anon, authenticated;

create or replace function public.cofre_registrar(p_cred uuid, p_conta text, p_acao text, p_detalhe text)
returns void language sql volatile security definer
set search_path = public as $$
  insert into cofre_log (credencial_id, conta, registro, nome, acao, detalhe)
  values (p_cred, p_conta, public.portal_registro_atual(), public.cofre_meu_nome(), p_acao, p_detalhe);
$$;
revoke execute on function public.cofre_registrar(uuid, text, text, text) from public, anon, authenticated;

-- ============================================================
-- 4. O VAULT
--    Guardar, ler e apagar um segredo. Só as funções do cofre chamam.
-- ------------------------------------------------------------
create or replace function public.cofre_segredo(p_id uuid)
returns text language sql stable security definer
set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where id = p_id;
$$;

create or replace function public.cofre_guardar(p_atual uuid, p_valor text, p_descricao text)
returns uuid language plpgsql volatile security definer
set search_path = public as $$
begin
  if p_atual is null then return vault.create_secret(p_valor, null, p_descricao); end if;
  perform vault.update_secret(p_atual, p_valor, null, p_descricao);
  return p_atual;
end $$;

create or replace function public.cofre_apagar(p_id uuid)
returns void language plpgsql volatile security definer
set search_path = public as $$
begin
  if p_id is not null then delete from vault.secrets where id = p_id; end if;
end $$;

revoke execute on function public.cofre_segredo(uuid) from public, anon, authenticated;
revoke execute on function public.cofre_guardar(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.cofre_apagar(uuid) from public, anon, authenticated;

-- ============================================================
-- 5. O CÓDIGO DE DUAS ETAPAS (TOTP, RFC 6238)
--    O segredo do 2FA vem em base32; o código é o HMAC do número da
--    janela de 30 segundos, truncado como manda a RFC 4226. Conferido,
--    no teste, com os vetores do apêndice B da RFC 6238.
-- ------------------------------------------------------------
create or replace function public.cofre_base32(p text)
returns bytea language plpgsql immutable as $$
declare
  alfa constant text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  s     text := upper(regexp_replace(coalesce(p, ''), '[\s=-]', '', 'g'));
  buf   bigint := 0;
  bits  integer := 0;
  saida bytea := ''::bytea;
  i     integer;
begin
  if s = '' or s !~ '^[A-Z2-7]+$' then return null; end if;
  for i in 1..length(s) loop
    buf := (buf << 5) | (strpos(alfa, substr(s, i, 1)) - 1);
    bits := bits + 5;
    if bits >= 8 then
      bits := bits - 8;
      saida := saida || decode(lpad(to_hex((buf >> bits) & 255), 2, '0'), 'hex');
      buf := buf & ((1::bigint << bits) - 1);
    end if;
  end loop;
  return saida;
end $$;

create or replace function public.cofre_totp_calc(p_chave bytea, p_janela bigint, p_digitos integer default 6,
                                                  p_algoritmo text default 'SHA1')
returns text language plpgsql immutable
set search_path = public, extensions as $$
declare
  h   bytea;
  o   integer;
  bin bigint;
begin
  h := hmac(int8send(p_janela), p_chave, lower(p_algoritmo));
  o := get_byte(h, length(h) - 1) & 15;
  bin := ((get_byte(h, o) & 127)::bigint << 24) | (get_byte(h, o + 1)::bigint << 16)
       | (get_byte(h, o + 2)::bigint << 8) | get_byte(h, o + 3)::bigint;
  return lpad((bin % power(10, p_digitos)::bigint)::text, p_digitos, '0');
end $$;
revoke execute on function public.cofre_totp_calc(bytea, bigint, integer, text) from public, anon, authenticated;

-- ============================================================
-- 6. LER — a lista das contas de cada um (sem segredo nenhum)
-- ------------------------------------------------------------
create or replace function public.cofre_lista()
returns table (id uuid, item_id uuid, item_nome text, item_categoria text, rotulo text, url text, usuario text,
  tem_senha boolean, tem_anterior boolean, anterior_ate timestamptz, tem_totp boolean, totp_digitos smallint,
  totp_periodo smallint, tem_notas boolean, instrucoes text, grupos integer[], responsaveis integer[],
  responsaveis_nomes text[], rotacao_dias integer, rotacao_padrao boolean, trocada_em timestamptz,
  trocada_nome text, vence_em timestamptz, situacao text, via text, mantem boolean, ativo boolean,
  criado_em timestamptz, ultimo_uso timestamptz)
language plpgsql stable security definer
set search_path = public as $$
#variable_conflict use_column
declare v_padrao integer := (select rotacao_padrao_dias from cofre_config);
begin
  return query
  select c.id, c.item_id, i.nome, i.categoria, c.rotulo, c.url, c.usuario,
         c.senha_id is not null,
         c.senha_anterior_id is not null and c.senha_anterior_ate > now(), c.senha_anterior_ate,
         c.totp_id is not null, c.totp_digitos, c.totp_periodo, c.notas_id is not null, c.instrucoes,
         c.grupos, c.responsaveis,
         array(select m.nome from membros m where m.registro = any(c.responsaveis) order by m.nome),
         coalesce(c.rotacao_dias, v_padrao), c.rotacao_dias is null,
         c.trocada_em, c.trocada_nome, public.cofre_vence_em(c), public.cofre_situacao(c),
         public.cofre_via(c), public.cofre_mantem(c), c.ativo, c.criado_em,
         (select max(l.criado_em) from cofre_log l where l.credencial_id = c.id
            and l.acao in ('viu_senha','copiou_senha','codigo'))
    from cofre_credenciais c join itens_de_acesso i on i.id = c.item_id
   where public.cofre_via(c) is not null
   order by i.categoria, i.nome, c.rotulo nulls first;
end $$;

-- Quantas contas pedem a MINHA ação (vencida, vencendo, exposta) —
-- para o início. Das que eu mantenho; as sem responsável, da gestão.
create or replace function public.cofre_pendencias()
returns integer language sql stable security definer
set search_path = public as $$
  select count(*)::integer from cofre_credenciais c
   where c.ativo and public.cofre_situacao(c) in ('vencida','vence_logo','exposta')
     and (public.portal_registro_atual() = any(c.responsaveis)
          or (cardinality(c.responsaveis) = 0 and public.cofre_gestor()));
$$;

-- ============================================================
-- 7. O SEGREDO SAI — sempre registrado
-- ------------------------------------------------------------
-- campo: 'senha', 'anterior' (quem mantém), 'notas'. acao: 'ver' ou
-- 'copiar' — o registro de uso distingue as duas.
create or replace function public.cofre_revelar(p_id uuid, p_campo text default 'senha', p_acao text default 'copiar')
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  c     public.cofre_credenciais;
  v_seg uuid;
  v_val text;
begin
  if p_campo not in ('senha','anterior','notas') or p_acao not in ('ver','copiar') then
    return jsonb_build_object('status','invalido');
  end if;
  select * into c from cofre_credenciais where id = p_id;
  if not found or public.cofre_via(c) is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if p_campo = 'anterior' then
    if not public.cofre_mantem(c) then return jsonb_build_object('status','sem_permissao'); end if;
    if c.senha_anterior_ate is null or c.senha_anterior_ate <= now() then return jsonb_build_object('status','vazio'); end if;
  end if;
  v_seg := case p_campo when 'senha' then c.senha_id when 'anterior' then c.senha_anterior_id else c.notas_id end;
  if v_seg is null then return jsonb_build_object('status','vazio'); end if;
  v_val := public.cofre_segredo(v_seg);
  if v_val is null then return jsonb_build_object('status','vazio'); end if;
  perform public.cofre_registrar(c.id, public.cofre_conta_nome(c),
    case when p_acao = 'ver' then 'viu_' else 'copiou_' end || p_campo, null);
  return jsonb_build_object('status','ok','valor',v_val);
end $$;

create or replace function public.cofre_codigo(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  c     public.cofre_credenciais;
  v_k   bytea;
  v_t   bigint := floor(extract(epoch from clock_timestamp()))::bigint;
begin
  select * into c from cofre_credenciais where id = p_id;
  if not found or public.cofre_via(c) is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if c.totp_id is null then return jsonb_build_object('status','sem_totp'); end if;
  v_k := public.cofre_base32(public.cofre_segredo(c.totp_id));
  if v_k is null then return jsonb_build_object('status','totp_invalido'); end if;
  perform public.cofre_registrar(c.id, public.cofre_conta_nome(c), 'codigo', null);
  return jsonb_build_object('status','ok',
    'codigo', public.cofre_totp_calc(v_k, v_t / c.totp_periodo, c.totp_digitos, c.totp_algoritmo),
    'restante', c.totp_periodo - (v_t % c.totp_periodo), 'periodo', c.totp_periodo, 'digitos', c.totp_digitos);
end $$;

-- ============================================================
-- 8. ESCREVER — cadastrar, mudar, trocar a senha, excluir
-- ------------------------------------------------------------
-- O segredo do 2FA chega como o serviço o mostra (base32, com ou sem
-- espaços); a tela já tirou do otpauth:// o que ele traz.
create or replace function public.cofre_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id     uuid := nullif(p->>'id', '')::uuid;
  c        public.cofre_credenciais;
  v_gest   boolean := public.cofre_gestor();
  v_nova   boolean := v_id is null;
  v_item   uuid := nullif(p->>'item_id', '')::uuid;
  v_url    text := nullif(trim(coalesce(p->>'url', '')), '');
  v_senha  text := p->>'senha';
  v_notas  text := p->>'notas';
  v_totp   jsonb := p->'totp';
  v_seg    text;
  v_desc   text;
  v_mud    text[] := '{}';
  r        jsonb := jsonb_build_object('status','invalido');
  v_grupos integer[];
  v_resp   integer[];
begin
  if v_nova then
    if not v_gest then return jsonb_build_object('status','sem_permissao'); end if;
    if v_item is null or not exists (select 1 from itens_de_acesso where id = v_item) then
      return r || '{"campo":"item_id"}';
    end if;
  else
    select * into c from cofre_credenciais where id = v_id for update;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    if not public.cofre_mantem(c) then return jsonb_build_object('status','sem_permissao'); end if;
    -- quem só mantém não mexe em quem usa, em quem mantém, no prazo nem no acesso do catálogo
    if not v_gest and (p ? 'grupos' or p ? 'responsaveis' or p ? 'rotacao_dias' or p ? 'item_id' or p ? 'ativo') then
      return jsonb_build_object('status','sem_permissao','campo','gestao');
    end if;
  end if;

  if p ? 'url' and v_url is not null and v_url !~* '^https?://[^\s]+$' then return r || '{"campo":"url"}'; end if;
  if length(coalesce(p->>'rotulo', '')) > 80 then return r || '{"campo":"rotulo"}'; end if;
  if length(coalesce(p->>'usuario', '')) > 200 then return r || '{"campo":"usuario"}'; end if;
  if length(coalesce(p->>'instrucoes', '')) > 2000 then return r || '{"campo":"instrucoes"}'; end if;
  if v_senha is not null and (length(v_senha) = 0 or length(v_senha) > 500) then return r || '{"campo":"senha"}'; end if;
  if v_senha is not null and not v_nova then
    return jsonb_build_object('status','invalido','campo','senha','motivo','use cofre_trocar_senha');
  end if;
  if length(coalesce(v_notas, '')) > 5000 then return r || '{"campo":"notas"}'; end if;
  if p ? 'rotacao_dias' and jsonb_typeof(p->'rotacao_dias') <> 'null'
     and ((p->>'rotacao_dias') !~ '^\d+$' or (p->>'rotacao_dias')::integer > 3650) then
    return r || '{"campo":"rotacao_dias"}';
  end if;
  if jsonb_typeof(v_totp) = 'object' then
    v_seg := upper(regexp_replace(coalesce(v_totp->>'segredo', ''), '[\s=-]', '', 'g'));
    if public.cofre_base32(v_seg) is null or length(v_seg) < 16 then return r || '{"campo":"totp"}'; end if;
    if coalesce(v_totp->>'digitos', '6') not in ('6','7','8')
       or coalesce(v_totp->>'periodo', '30') not in ('15','30','60')
       or upper(coalesce(v_totp->>'algoritmo', 'SHA1')) not in ('SHA1','SHA256','SHA512') then
      return r || '{"campo":"totp"}';
    end if;
  end if;
  if p ? 'grupos' then
    select coalesce(array_agg(distinct x::integer order by x::integer), '{}') into v_grupos
      from jsonb_array_elements_text(case when jsonb_typeof(p->'grupos') = 'array' then p->'grupos' else '[]'::jsonb end) x
     where x ~ '^\d+$' and exists (select 1 from grupos where id = x::integer);
  end if;
  if p ? 'responsaveis' then
    select coalesce(array_agg(distinct x::integer order by x::integer), '{}') into v_resp
      from jsonb_array_elements_text(case when jsonb_typeof(p->'responsaveis') = 'array' then p->'responsaveis' else '[]'::jsonb end) x
     where x ~ '^\d+$' and exists (select 1 from membros where registro = x::integer);
  end if;

  if v_nova then
    insert into cofre_credenciais (item_id, rotulo, url, usuario, instrucoes, grupos, responsaveis, rotacao_dias,
                                   criado_por, criado_nome)
    values (v_item, nullif(trim(coalesce(p->>'rotulo', '')), ''), v_url, nullif(trim(coalesce(p->>'usuario', '')), ''),
            nullif(trim(coalesce(p->>'instrucoes', '')), ''), coalesce(v_grupos, '{}'), coalesce(v_resp, '{}'),
            case when p ? 'rotacao_dias' and jsonb_typeof(p->'rotacao_dias') <> 'null' then (p->>'rotacao_dias')::integer end,
            public.portal_registro_atual(), public.cofre_meu_nome())
    returning * into c;
  else
    if p ? 'rotulo'     and nullif(trim(coalesce(p->>'rotulo', '')), '') is distinct from c.rotulo         then v_mud := v_mud || 'rótulo'::text; end if;
    if p ? 'url'        and v_url is distinct from c.url                                                   then v_mud := v_mud || 'endereço'::text; end if;
    if p ? 'usuario'    and nullif(trim(coalesce(p->>'usuario', '')), '') is distinct from c.usuario       then v_mud := v_mud || 'usuário'::text; end if;
    if p ? 'instrucoes' and nullif(trim(coalesce(p->>'instrucoes', '')), '') is distinct from c.instrucoes then v_mud := v_mud || 'instruções'::text; end if;
    if p ? 'grupos'       and v_grupos is distinct from c.grupos             then v_mud := v_mud || 'grupos'::text; end if;
    if p ? 'responsaveis' and v_resp is distinct from c.responsaveis         then v_mud := v_mud || 'responsáveis'::text; end if;
    if p ? 'item_id'      and v_item is not null and v_item <> c.item_id     then v_mud := v_mud || 'acesso do catálogo'::text; end if;
    if p ? 'rotacao_dias' and (case when jsonb_typeof(p->'rotacao_dias') = 'null' then null
                                    else (p->>'rotacao_dias')::integer end) is distinct from c.rotacao_dias then
      v_mud := v_mud || 'prazo de troca'::text;
    end if;
    if p ? 'ativo' and (p->>'ativo')::boolean is distinct from c.ativo then
      v_mud := v_mud || case when (p->>'ativo')::boolean then 'reativada' else 'desativada' end;
    end if;
    update cofre_credenciais
       set rotulo       = case when p ? 'rotulo' then nullif(trim(coalesce(p->>'rotulo', '')), '') else rotulo end,
           url          = case when p ? 'url' then v_url else url end,
           usuario      = case when p ? 'usuario' then nullif(trim(coalesce(p->>'usuario', '')), '') else usuario end,
           instrucoes   = case when p ? 'instrucoes' then nullif(trim(coalesce(p->>'instrucoes', '')), '') else instrucoes end,
           grupos       = case when p ? 'grupos' then v_grupos else grupos end,
           responsaveis = case when p ? 'responsaveis' then v_resp else responsaveis end,
           rotacao_dias = case when p ? 'rotacao_dias' then
                            case when jsonb_typeof(p->'rotacao_dias') = 'null' then null else (p->>'rotacao_dias')::integer end
                          else rotacao_dias end,
           item_id      = case when p ? 'item_id' and v_item is not null
                                and exists (select 1 from itens_de_acesso where id = v_item) then v_item else item_id end,
           ativo        = case when p ? 'ativo' then coalesce((p->>'ativo')::boolean, ativo) else ativo end,
           atualizado_em = now()
     where id = c.id
    returning * into c;
  end if;

  v_desc := 'cofre: ' || public.cofre_conta_nome(c);
  -- a senha inicial (a troca de uma senha que existe é cofre_trocar_senha)
  if v_senha is not null then
    update cofre_credenciais
       set senha_id = public.cofre_guardar(null, v_senha, v_desc || ' (senha)'),
           trocada_em = now(), trocada_nome = public.cofre_meu_nome()
     where id = c.id;
  end if;
  -- o 2FA: objeto grava, nulo explícito tira
  if jsonb_typeof(v_totp) = 'object' then
    update cofre_credenciais
       set totp_id = public.cofre_guardar(totp_id, v_seg, v_desc || ' (2FA)'),
           totp_digitos = coalesce(v_totp->>'digitos', '6')::smallint,
           totp_periodo = coalesce(v_totp->>'periodo', '30')::smallint,
           totp_algoritmo = upper(coalesce(v_totp->>'algoritmo', 'SHA1'))
     where id = c.id;
    if not v_nova then v_mud := v_mud || 'código de duas etapas'::text; end if;
  elsif p ? 'totp' and jsonb_typeof(v_totp) = 'null' and c.totp_id is not null then
    perform public.cofre_apagar(c.totp_id);
    update cofre_credenciais set totp_id = null where id = c.id;
    v_mud := v_mud || 'código de duas etapas retirado'::text;
  end if;
  -- as notas secretas: texto grava, vazio tira
  if v_notas is not null then
    if trim(v_notas) = '' then
      if c.notas_id is not null then
        perform public.cofre_apagar(c.notas_id);
        update cofre_credenciais set notas_id = null where id = c.id;
        v_mud := v_mud || 'notas retiradas'::text;
      end if;
    else
      update cofre_credenciais set notas_id = public.cofre_guardar(notas_id, v_notas, v_desc || ' (notas)') where id = c.id;
      if not v_nova then v_mud := v_mud || 'notas'::text; end if;
    end if;
  end if;

  perform public.cofre_registrar(c.id, public.cofre_conta_nome(c),
    case when v_nova then 'criou' else 'editou' end,
    case when v_nova then null else nullif(array_to_string(v_mud, ', '), '') end);
  return jsonb_build_object('status','ok','id',c.id);
end $$;

-- Trocar a senha: a nova passa a valer, a anterior fica guardada pelo
-- tempo da configuração (para quando o serviço não aceitou a nova) e o
-- prazo recomeça.
create or replace function public.cofre_trocar_senha(p_id uuid, p_nova text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  c     public.cofre_credenciais;
  v_dias integer := (select anterior_dias from cofre_config);
  v_ant uuid;
begin
  select * into c from cofre_credenciais where id = p_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.cofre_mantem(c) then return jsonb_build_object('status','sem_permissao'); end if;
  if p_nova is null or length(p_nova) = 0 or length(p_nova) > 500 then
    return jsonb_build_object('status','invalido','campo','senha');
  end if;
  if c.senha_id is not null and public.cofre_segredo(c.senha_id) = p_nova then
    return jsonb_build_object('status','invalido','campo','senha','motivo','igual');
  end if;
  perform public.cofre_apagar(c.senha_anterior_id);
  if c.senha_id is not null and v_dias > 0 then
    v_ant := c.senha_id;                              -- a atual vira a anterior
  else
    perform public.cofre_apagar(c.senha_id);
  end if;
  update cofre_credenciais
     set senha_anterior_id = v_ant,
         senha_anterior_ate = case when v_ant is not null then now() + make_interval(days => v_dias) end,
         senha_id = public.cofre_guardar(null, p_nova, 'cofre: ' || public.cofre_conta_nome(c) || ' (senha)'),
         trocada_em = now(), trocada_nome = public.cofre_meu_nome(), lembrado_em = null, atualizado_em = now()
   where id = p_id
  returning * into c;
  perform public.cofre_registrar(c.id, public.cofre_conta_nome(c), 'trocou', null);
  return jsonb_build_object('status','ok','vence_em',public.cofre_vence_em(c));
end $$;

-- Excluir apaga os segredos do Vault. O registro de uso fica, com o
-- nome da conta.
create or replace function public.cofre_excluir(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare c public.cofre_credenciais;
begin
  if not public.cofre_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into c from cofre_credenciais where id = p_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  perform public.cofre_registrar(c.id, public.cofre_conta_nome(c), 'excluiu', null);
  perform public.cofre_apagar(c.senha_id);
  perform public.cofre_apagar(c.senha_anterior_id);
  perform public.cofre_apagar(c.totp_id);
  perform public.cofre_apagar(c.notas_id);
  delete from cofre_credenciais where id = p_id;
  return jsonb_build_object('status','ok');
end $$;

-- O registro de uso: de uma conta (quem a mantém) ou de todas (a
-- gestão).
create or replace function public.cofre_log_ler(p_id uuid default null, p_limite integer default 200)
returns table (id bigint, credencial_id uuid, conta text, registro integer, nome text, acao text,
  detalhe text, criado_em timestamptz)
language plpgsql stable security definer
set search_path = public as $$
#variable_conflict use_column
declare c public.cofre_credenciais;
begin
  if p_id is null then
    if not public.cofre_gestor() then return; end if;
  else
    select * into c from cofre_credenciais where cofre_credenciais.id = p_id;
    if not found or not public.cofre_mantem(c) then return; end if;
  end if;
  return query
  select l.id, l.credencial_id, l.conta, l.registro, l.nome, l.acao, l.detalhe, l.criado_em
    from cofre_log l
   where p_id is null or l.credencial_id = p_id
   order by l.criado_em desc, l.id desc
   limit greatest(least(coalesce(p_limite, 200), 1000), 1);
end $$;

-- ============================================================
-- 9. O LEMBRETE DA TROCA
--    Uma vez por semana por conta, enquanto ela estiver vencendo,
--    vencida ou exposta. Grava direto em notificacoes (como o lembrete
--    do Studio), porque notificar() pula quem agiu — e quem abre o
--    cofre e dispara isto pode ser justamente o responsável.
-- ------------------------------------------------------------
create or replace function public.cofre_lembretes()
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare
  c      public.cofre_credenciais;
  v_n    integer := 0;
  v_para integer[];
  v_sit  text;
  v_venc timestamptz;
begin
  for c in select * from cofre_credenciais x
            where x.ativo and x.senha_id is not null
              and (x.lembrado_em is null or x.lembrado_em < now() - interval '7 days')
            for update skip locked
  loop
    v_sit := public.cofre_situacao(c);
    continue when v_sit not in ('vencida','vence_logo','exposta');
    v_venc := public.cofre_vence_em(c);
    v_para := case when cardinality(c.responsaveis) > 0 then c.responsaveis
                   else coalesce((select array_agg(m.registro) from membros m, cofre_config cfg
                                   where public.grupos_de(m.registro) && cfg.grupos_gestores), '{}')
                        || coalesce((select array_agg(p.registro) from perfis p
                                      where p.papel = 'admin' and p.registro is not null), '{}') end;
    insert into notificacoes (registro, tipo, titulo, corpo, href)
    select distinct x, 'cofre_troca', 'Trocar a senha: ' || public.cofre_conta_nome(c),
           case v_sit
             when 'exposta' then 'Alguém que viu esta senha saiu da equipe. Troque no serviço e registre a nova no Cofre.'
             when 'vencida' then 'O prazo de troca venceu em ' || to_char(v_venc at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
                                 || '. Troque no serviço e registre a nova no Cofre.'
             else 'O prazo de troca vence em ' || to_char(v_venc at time zone 'America/Sao_Paulo', 'DD/MM/YYYY')
                  || '. O Cofre gera a nova senha para você.' end,
           '#/servicos/cofre'
      from unnest(v_para) x
      join membros m on m.registro = x and coalesce(m.status, 'Ativo') in ('Ativo','Em pausa / avaliação','Sob demanda');
    update cofre_credenciais set lembrado_em = now() where id = c.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- O relógio: todo dia às 8h de Brasília (11h UTC), onde o pg_cron
-- existe. Sem ele, o lembrete sai quando alguém abre o cofre.
do $$
begin
  if to_regnamespace('cron') is not null then
    if exists (select 1 from cron.job where jobname = 'cofre-lembretes') then
      perform cron.unschedule('cofre-lembretes');
    end if;
    perform cron.schedule('cofre-lembretes', '0 11 * * *', 'select public.cofre_lembretes()');
  else
    raise notice 'Sem o pg_cron: o lembrete de troca sai quando alguém abrir o Cofre. Ligue o Cron e rode esta migração de novo.';
  end if;
end $$;

-- ============================================================
-- 10. PERMISSÕES, AUDITORIA E REGISTRO
-- ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'cofre_gestor()', 'cofre_lista()', 'cofre_pendencias()', 'cofre_revelar(uuid,text,text)',
    'cofre_codigo(uuid)', 'cofre_salvar(jsonb)', 'cofre_trocar_senha(uuid,text)', 'cofre_excluir(uuid)',
    'cofre_log_ler(uuid,integer)', 'cofre_lembretes()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['cofre_base32(text)', 'cofre_meu_nome()']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_cofre_config on public.cofre_config';
    execute 'create trigger tg_aud_cofre_config after update on public.cofre_config
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_cofre_credenciais on public.cofre_credenciais';
    execute 'create trigger tg_aud_cofre_credenciais after insert or update or delete on public.cofre_credenciais
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v27_cofre', 'O cofre: senhas e códigos de duas etapas das contas de cada acesso do catálogo, guardados no Vault, usados por grupo ou por acesso concedido, com registro de uso, troca periódica com lembrete e a senha anterior guardada por 30 dias')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 27.0
--
-- Depois de rodar:
--   1) em Serviços › Cofre › Configurações, admin escolhe os grupos que
--      gerem o cofre (e o prazo de troca, se 180 dias não servir);
--   2) a gestão cadastra as contas: para cada acesso do catálogo, o
--      endereço, o usuário, a senha (o Cofre gera uma forte), quem usa
--      e quem mantém. O 2FA se liga colando o segredo que o serviço
--      mostra ao configurar ("não consegue ler o QR? use esta chave");
--   3) quem usa encontra as contas em Serviços › Cofre: copia o
--      usuário, a senha e o código de duas etapas.
-- ============================================================
