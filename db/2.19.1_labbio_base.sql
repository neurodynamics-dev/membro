-- ============================================================
-- SOMA 2.19.1: gestores do LABBIO (identidade e segurança)
--
-- Os gestores do LABBIO usam o painel /labbio com uma conta própria, que
-- NÃO é membro da NeuroDynamics. A conta de um gestor (convidado, ativo
-- ou revogado: "conta externa") fica fechada para todo dado interno, em
-- quatro camadas:
--   1. api_pre_request(): o PostgREST chama esta função antes de cada
--      pedido; para conta externa, só passa /rpc/labbio_*. Tabela, view,
--      qualquer outra função: recusado na porta;
--   2. conta_ativa() falsa: a trava restritiva de toda tabela com RLS;
--   3. papeis_atuais() vazio: papel_atual() = 'nenhum', tenho_papel() falso;
--   4. Storage: política restritiva; conta externa só lê os buckets
--      termos, biometria e fotos (e cada um ainda pede a sua regra).
-- As funções labbio_* exigem gestor ATIVO a cada chamada: revogar vale na
-- hora, sem esperar o JWT vencer. Revogado não volta a ser conta comum.
--
-- Uma conta de membro (perfil com registro) nunca vira gestor: o convite
-- para o e-mail de um membro é recusado. Quem é membro e também gere o
-- LABBIO usa outro e-mail para o painel.
--
-- Convite: admin do SOMA ou gestor ativo convida um e-mail; o convite
-- vale 7 dias e sai por e-mail (fila labbio_envios, mandada pela Edge
-- Function notificar-email). A pessoa cria a conta com aquele e-mail e
-- aceita no /labbio. O primeiro gestor ativo vira o responsável principal
-- (a estrela); há sempre no máximo um, e a troca é atômica.
--
-- Depende da 2.19.0_quiosque (conta_quiosque) e da 2.18.0.
-- ANTES DE APLICAR: se o projeto já tiver um pgrst.db_pre_request
-- configurado no papel authenticator, a migração para com mensagem.
-- Só acrescenta; pode rodar de novo.
-- ============================================================

-- 1. tabelas ----------------------------------------------------------------
create table if not exists public.labbio_gestores (
  id                uuid primary key default gen_random_uuid(),
  email             text not null,
  nome              text not null check (length(btrim(nome)) > 0),
  user_id           uuid unique,
  situacao          text not null default 'convidado' check (situacao in ('convidado', 'ativo', 'revogado')),
  principal         boolean not null default false,
  convidado_por_reg integer references membros(registro) on delete set null,
  convidado_por     uuid references labbio_gestores(id) on delete set null,
  convidado_em      timestamptz not null default now(),
  aceito_em         timestamptz,
  revogado_em       timestamptz,
  revogado_motivo   text,
  ultimo_acesso     timestamptz,
  check (not principal or situacao = 'ativo'));
create unique index if not exists labbio_gestores_email on public.labbio_gestores (lower(email));
create unique index if not exists labbio_gestores_um_principal on public.labbio_gestores (principal) where principal;

create table if not exists public.labbio_convites (
  token_hash text primary key,
  gestor_id  uuid not null references labbio_gestores(id) on delete cascade,
  criado_em  timestamptz not null default now(),
  expira_em  timestamptz not null,
  usado_em   timestamptz,
  anulado_em timestamptz);

-- a fila de e-mails do LABBIO (convites; depois, os pedidos de acesso)
create table if not exists public.labbio_envios (
  id         bigserial primary key,
  tipo       text not null,
  para_email text not null,
  para_nome  text not null,
  assunto    text not null,
  dados      jsonb not null default '{}',
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz,
  tentativas smallint not null default 0,
  erro       text);
create index if not exists labbio_envios_pend on public.labbio_envios (id) where enviado_em is null;

create table if not exists public.labbio_auditoria (
  id        bigserial primary key,
  quando    timestamptz not null default clock_timestamp(),
  ator_user uuid,
  ator_reg  integer,
  acao      text not null,
  alvo      uuid,
  detalhe   jsonb not null default '{}');

do $$ declare t text; begin
  foreach t in array array['labbio_gestores', 'labbio_convites', 'labbio_envios', 'labbio_auditoria'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. quem é a conta ------------------------------------------------------------
create or replace function public.conta_externa()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from labbio_gestores where user_id = auth.uid()) $$;

create or replace function public.conta_labbio()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from labbio_gestores where user_id = auth.uid() and situacao = 'ativo') $$;

-- conta_ativa(): a da 2.19.0 (membro bloqueado, quiosque), mais a conta externa
create or replace function public.conta_ativa()
returns boolean language sql stable security definer
set search_path = public as $$
  select not exists (
    select 1 from perfis p join membros m on m.registro = p.registro
     where p.id = auth.uid() and public.status_bloqueado(m.status))
  and not public.conta_quiosque()
  and not public.conta_externa();
$$;
comment on function public.conta_ativa() is
  'Falso para a conta ligada a um membro Desligado, Egresso ou Sob demanda, para a conta do quiosque e para a conta '
  'de gestor do LABBIO. É a política restritiva conta_ativa de toda tabela com RLS (2.18.0, 2.19.0, 2.19.1).';

-- papeis_atuais(): a da 2.18.0, vazia para a conta externa
create or replace function public.papeis_atuais()
returns text[] language plpgsql stable security definer
set search_path = public as $$
declare v_papel text; v_reg integer; v text[] := '{}'; v_gs integer[];
begin
  if public.conta_externa() then return '{}'; end if;
  select p.papel, p.registro into v_papel, v_reg
    from perfis p left join membros m on m.registro = p.registro
   where p.id = auth.uid() and not public.status_bloqueado(m.status);
  if not found then return '{}'; end if;
  if v_papel in ('admin','pessoal','selecao') then v := array[v_papel]; end if;
  if v_reg is not null then
    v_gs := public.grupos_de(v_reg);   -- uma vez, fora da consulta
    v := v || array(select gp.papel from grupo_papeis gp join grupos g on g.id = gp.grupo_id and g.ativo
                     where gp.grupo_id = any(v_gs));
  end if;
  v := v || 'leitura'::text;
  return array(select o.p from unnest(array['admin','pessoal','lideranca','selecao','leitura']) with ordinality o(p, n)
                where o.p = any(v) order by o.n);
end $$;
comment on function public.papeis_atuais() is
  'Os papéis da conta logada, do mais forte ao mais fraco. Vazio: conta bloqueada, sem perfil ou de gestor do LABBIO.';

-- 3. a porta da API: conta externa só chama labbio_* -----------------------------
create or replace function public.api_pre_request()
returns void language plpgsql stable security definer set search_path = public as $$
declare v_path text;
begin
  if not public.conta_externa() then return; end if;
  v_path := coalesce(current_setting('request.path', true), '');
  if v_path ~ '^/rpc/labbio_[a-z0-9_]+$' then return; end if;
  raise exception using errcode = '42501',
    message = 'Esta conta é do painel do LABBIO e não acessa o portal da equipe.',
    hint = 'Use membro.neurodynamics.dev/labbio/';
end $$;
revoke all on function public.api_pre_request() from public;
grant execute on function public.api_pre_request() to anon, authenticated;

do $$
declare v_atual text;
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    raise notice 'LABBIO: sem o papel authenticator (banco de teste). A porta da API não foi ligada.';
    return;
  end if;
  select substring(c from '^pgrst\.db_pre_request=(.*)$') into v_atual
    from pg_db_role_setting s join pg_roles r on r.oid = s.setrole, unnest(s.setconfig) c
   where r.rolname = 'authenticator' and c like 'pgrst.db_pre_request=%';
  if v_atual is not null and v_atual not in ('public.api_pre_request', 'api_pre_request') then
    raise exception 'O authenticator já tem pgrst.db_pre_request = %. Junte as duas funções antes de aplicar esta migração.', v_atual;
  end if;
  execute 'alter role authenticator set pgrst.db_pre_request = ''public.api_pre_request''';
  perform pg_notify('pgrst', 'reload config');
end $$;

-- 4. Storage: conta externa só lê termos, biometria e fotos; nunca grava ----------
drop policy if exists labbio_conta_externa on storage.objects;
create policy labbio_conta_externa on storage.objects as restrictive for all to authenticated
  using (not public.conta_externa() or bucket_id in ('termos', 'biometria', 'fotos'))
  with check (not public.conta_externa());

-- 5. ligar a conta ao convite quando ela é criada (mesmo e-mail) -------------------
create or replace function public.labbio_vincular_conta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update labbio_gestores set user_id = new.id
   where lower(email) = lower(new.email) and user_id is null and situacao <> 'revogado';
  return new;
end $$;
revoke execute on function public.labbio_vincular_conta() from public, anon, authenticated;
do $$ begin
  if to_regclass('auth.users') is not null then
    execute 'drop trigger if exists labbio_vincular_conta on auth.users';
    execute 'create trigger labbio_vincular_conta after insert on auth.users for each row execute function public.labbio_vincular_conta()';
  else
    raise notice 'LABBIO: sem auth.users (banco de teste). O vínculo na criação da conta não foi ligado.';
  end if;
end $$;

-- 6. as funções ----------------------------------------------------------------
create or replace function public.labbio_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and public.papel_atual() = 'admin' $$;

create or replace function public.labbio_eu_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from labbio_gestores where user_id = auth.uid() and situacao = 'ativo' $$;

create or replace function public.labbio_auditar(p_acao text, p_alvo uuid, p_detalhe jsonb default '{}')
returns void language sql volatile security definer set search_path = public as $$
  insert into labbio_auditoria (ator_user, ator_reg, acao, alvo, detalhe)
  values (auth.uid(), public.portal_registro_atual(), p_acao, p_alvo, coalesce(p_detalhe, '{}')) $$;

-- o e-mail da conta logada (o do Auth; no banco de teste, o do perfil)
create or replace function public.labbio_email_da_conta()
returns text language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if to_regclass('auth.users') is not null then
    execute 'select email from auth.users where id = $1' into v using auth.uid();
  end if;
  return lower(coalesce(v, (select email from perfis where id = auth.uid())));
end $$;

create or replace function public.labbio_gestor_json(g labbio_gestores)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', g.id, 'nome', g.nome, 'email', g.email, 'situacao', g.situacao, 'principal', g.principal,
    'convidado_em', g.convidado_em, 'aceito_em', g.aceito_em, 'revogado_em', g.revogado_em, 'revogado_motivo', g.revogado_motivo,
    'ultimo_acesso', g.ultimo_acesso, 'tem_conta', g.user_id is not null,
    'convidado_por', coalesce((select nome from membros where registro = g.convidado_por_reg),
                              (select nome from labbio_gestores x where x.id = g.convidado_por))) $$;

-- quem sou eu no painel (e a marca do último acesso, no máximo a cada 5 min)
create or replace function public.labbio_eu()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g labbio_gestores;
begin
  select * into g from labbio_gestores where user_id = auth.uid();
  if not found then return jsonb_build_object('status', case when auth.uid() is null then 'sem_sessao' else 'nao_gestor' end); end if;
  if g.situacao <> 'ativo' then return jsonb_build_object('status', g.situacao); end if;
  if g.ultimo_acesso is null or g.ultimo_acesso < now() - interval '5 minutes' then
    update labbio_gestores set ultimo_acesso = now() where id = g.id;
  end if;
  return jsonb_build_object('status', 'ok', 'gestor', labbio_gestor_json(g));
end $$;

create or replace function public.labbio_gestores_lista()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (public.labbio_admin() or public.conta_labbio()) then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'gestores', coalesce((select jsonb_agg(public.labbio_gestor_json(g)
      order by g.situacao = 'revogado', g.principal desc, g.nome) from labbio_gestores g), '[]')) end $$;

-- convidar (admin do SOMA ou gestor ativo). O token só existe no e-mail.
create or replace function public.labbio_convidar(p_email text, p_nome text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); g labbio_gestores; v_token text; v_uid uuid; v_eu uuid := labbio_eu_id();
        v_existe boolean;
begin
  if not (labbio_admin() or v_eu is not null) then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then return jsonb_build_object('status', 'email_invalido'); end if;
  if length(btrim(coalesce(p_nome, ''))) = 0 then return jsonb_build_object('status', 'nome_obrigatorio'); end if;
  -- e-mail de membro não vira conta externa
  if exists (select 1 from perfis where lower(email) = v_email and registro is not null)
     or exists (select 1 from membros where lower(email_nro) = v_email or lower(email_pessoal) = v_email)
    then return jsonb_build_object('status', 'email_de_membro'); end if;
  select * into g from labbio_gestores where lower(email) = v_email for update;
  v_existe := found;
  if v_existe and g.situacao = 'ativo' then return jsonb_build_object('status', 'ja_ativo'); end if;
  if to_regclass('auth.users') is not null then
    execute 'select id from auth.users where lower(email) = $1' into v_uid using v_email;
  end if;
  if v_existe then
    update labbio_gestores set situacao = 'convidado', nome = btrim(p_nome), revogado_em = null, revogado_motivo = null,
           convidado_em = now(), convidado_por_reg = portal_registro_atual(), convidado_por = v_eu,
           user_id = coalesce(user_id, v_uid)
     where id = g.id returning * into g;
  else
    insert into labbio_gestores (email, nome, user_id, convidado_por_reg, convidado_por)
    values (v_email, btrim(p_nome), v_uid, portal_registro_atual(), v_eu) returning * into g;
  end if;
  update labbio_convites set anulado_em = now() where gestor_id = g.id and usado_em is null and anulado_em is null;
  v_token := encode(gen_random_bytes(24), 'hex');
  insert into labbio_convites (token_hash, gestor_id, expira_em)
  values (encode(digest(v_token, 'sha256'), 'hex'), g.id, now() + interval '7 days');
  insert into labbio_envios (tipo, para_email, para_nome, assunto, dados)
  values ('convite', v_email, g.nome, 'Convite para o painel do LABBIO',
          jsonb_build_object('caminho', '/labbio/#/aceitar?c=' || v_token, 'expira_em', now() + interval '7 days',
                             'convidado_por', coalesce((select nome from membros where registro = portal_registro_atual()),
                                                       (select nome from labbio_gestores where id = v_eu))));
  perform labbio_auditar('convidar', g.id, jsonb_build_object('email', v_email));
  return jsonb_build_object('status', 'ok', 'id', g.id);
end $$;

-- aceitar: a conta logada, com o mesmo e-mail do convite
create or replace function public.labbio_aceitar(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public, extensions as $$
declare c labbio_convites; g labbio_gestores;
begin
  if auth.uid() is null then return jsonb_build_object('status', 'sem_sessao'); end if;
  select * into c from labbio_convites where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex') for update;
  if not found or c.anulado_em is not null then return jsonb_build_object('status', 'invalido'); end if;
  if c.usado_em is not null then return jsonb_build_object('status', 'usado'); end if;
  if c.expira_em < now() then return jsonb_build_object('status', 'expirado'); end if;
  select * into g from labbio_gestores where id = c.gestor_id for update;
  if g.situacao = 'revogado' then return jsonb_build_object('status', 'invalido'); end if;
  if lower(g.email) is distinct from labbio_email_da_conta() then return jsonb_build_object('status', 'email_diferente'); end if;
  if exists (select 1 from perfis where id = auth.uid() and registro is not null) then return jsonb_build_object('status', 'conta_de_membro'); end if;
  if g.user_id is not null and g.user_id <> auth.uid() then return jsonb_build_object('status', 'email_diferente'); end if;
  update labbio_convites set usado_em = now() where token_hash = c.token_hash;
  update labbio_gestores set user_id = auth.uid(), situacao = 'ativo', aceito_em = now(),
         principal = not exists (select 1 from labbio_gestores where principal)
   where id = g.id returning * into g;
  perform labbio_auditar('aceitar', g.id);
  return jsonb_build_object('status', 'ok', 'gestor', labbio_gestor_json(g));
end $$;

-- a estrela: admin ou o principal atual passam para outro gestor ativo
create or replace function public.labbio_principal(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_eu uuid := labbio_eu_id();
begin
  if not (labbio_admin() or exists (select 1 from labbio_gestores where id = v_eu and principal)) then
    return jsonb_build_object('status', 'sem_permissao'); end if;
  perform pg_advisory_xact_lock(hashtext('labbio_principal'));
  if not exists (select 1 from labbio_gestores where id = p_id and situacao = 'ativo') then
    return jsonb_build_object('status', 'invalido'); end if;
  update labbio_gestores set principal = false where principal and id <> p_id;
  update labbio_gestores set principal = true where id = p_id;
  perform labbio_auditar('principal', p_id);
  return jsonb_build_object('status', 'ok');
end $$;

-- revogar: admin ou o principal. O principal só sai depois de passar a estrela,
-- a não ser que seja o único gestor ativo (aí só o admin revoga)
create or replace function public.labbio_revogar(p_id uuid, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g labbio_gestores; v_eu uuid := labbio_eu_id(); v_outros integer;
begin
  if not (labbio_admin() or exists (select 1 from labbio_gestores where id = v_eu and principal)) then
    return jsonb_build_object('status', 'sem_permissao'); end if;
  perform pg_advisory_xact_lock(hashtext('labbio_principal'));
  select * into g from labbio_gestores where id = p_id for update;
  if not found or g.situacao = 'revogado' then return jsonb_build_object('status', 'invalido'); end if;
  select count(*) into v_outros from labbio_gestores where situacao = 'ativo' and id <> p_id;
  if g.principal and v_outros > 0 then return jsonb_build_object('status', 'transfira_antes'); end if;
  if g.principal and not labbio_admin() then return jsonb_build_object('status', 'sem_permissao'); end if;
  update labbio_gestores set situacao = 'revogado', principal = false, revogado_em = now(),
         revogado_motivo = nullif(btrim(coalesce(p_motivo, '')), '') where id = p_id;
  update labbio_convites set anulado_em = now() where gestor_id = p_id and usado_em is null and anulado_em is null;
  perform labbio_auditar('revogar', p_id, jsonb_build_object('motivo', p_motivo));
  return jsonb_build_object('status', 'ok');
end $$;

-- 7. a fila de e-mails (a Edge Function, com a chave de serviço) ----------------------
create or replace function public.labbio_envios_lote(p_limite integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'tipo', tipo, 'para_email', para_email, 'para_nome', para_nome,
           'assunto', assunto, 'dados', dados) order by id), '[]')
    from (select * from labbio_envios where enviado_em is null and tentativas < 5
           order by id limit greatest(coalesce(p_limite, 100), 1)) q $$;

create or replace function public.labbio_envios_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ok  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'enviados', '[]')) x), '{}');
  v_er  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'falhas', '[]')) x), '{}');
  v_msg text := left(coalesce(p->>'erro', ''), 500); v_n integer := 0;
begin
  -- o link do convite (com o token) não fica guardado depois de enviado
  update labbio_envios set enviado_em = now(), erro = null, dados = dados - 'caminho' where id = any(v_ok) and enviado_em is null;
  get diagnostics v_n = row_count;
  update labbio_envios set tentativas = tentativas + 1, erro = nullif(v_msg, '') where id = any(v_er) and enviado_em is null;
  return jsonb_build_object('status', 'ok', 'enviados', v_n);
end $$;

-- 8. permissões ------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['labbio_vincular_conta()', 'labbio_auditar(text,uuid,jsonb)', 'labbio_email_da_conta()',
                           'labbio_gestor_json(labbio_gestores)', 'labbio_eu_id()', 'labbio_envios_lote(integer)',
                           'labbio_envios_baixa(jsonb)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['conta_externa()', 'conta_labbio()', 'labbio_admin()', 'labbio_eu()', 'labbio_gestores_lista()',
                           'labbio_convidar(text,text)', 'labbio_aceitar(text)', 'labbio_principal(uuid)',
                           'labbio_revogar(uuid,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.labbio_envios_lote(integer) to service_role;
    grant execute on function public.labbio_envios_baixa(jsonb) to service_role;
  end if;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_labbio_base',
 'SOMA 2.19.1: gestores do LABBIO com conta externa (convite, aceite, estrela, revogação), fechada para dados internos na API, nas tabelas, nos papéis e no Storage')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select rolname, setconfig from pg_db_role_setting s join pg_roles r on r.oid = s.setrole where rolname = 'authenticator';
-- select nome, email, situacao, principal from public.labbio_gestores;
-- O primeiro gestor: logado como admin no SOMA, Administração › LABBIO, ou
--   select public.labbio_convidar('gestor@exemplo.com', 'Nome do gestor');  -- como admin, pelo app
