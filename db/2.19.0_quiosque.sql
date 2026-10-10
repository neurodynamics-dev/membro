-- ============================================================
-- SOMA 2.19.0: o quiosque entra com uma conta de serviço
--
-- O quiosque.html era público e trazia o segredo do quiosque escrito no
-- código: quem lesse a página chamava quiosque_estado(p_segredo) de
-- qualquer lugar e recebia o QR que gira a cada 40 segundos (e fazia
-- check-in de longe). Aqui o aparelho entra uma vez com uma conta própria
-- (e-mail e senha digitados na TV; a sessão fica no navegador) e o
-- segredo deixa de servir.
--
-- O que esta migração faz:
--   1. quiosque_conta: a conta de serviço (uma linha; ninguém lê pela API);
--   2. conta_quiosque(): "esta sessão é a do quiosque?";
--   3. conta_ativa(): falso para a conta do quiosque. É a política
--      restritiva de TODA tabela com RLS, então a conta do quiosque não lê
--      tabela nenhuma pela API (membros, agenda, avisos...). Só chama as
--      funções abaixo e labbio_placar();
--   4. quiosque_estado_conta(): o estado do quiosque (QR, agenda de hoje,
--      presentes, últimos check-ins) para a conta do quiosque, chamando a
--      quiosque_estado(segredo) que já existe, com o segredo lido do banco;
--   5. quiosque_painel(): os avisos do dia e os membros que chegaram este mês;
--   6. revoga a quiosque_estado(text) de anon e authenticated: o segredo que
--      estava no código público deixa de servir.
--
-- ANTES DE APLICAR (confira no banco; a migração para com mensagem se algo faltar):
--   a) existe public.quiosque_estado(text)
--   b) existe public.config_sistema(chave, valor) com a linha 'segredo_quiosque'
--      (o segredo que o quiosque.html antigo mandava). Se a chave tem outro
--      nome, troque v_chave na função quiosque_estado_conta e no bloco de checagem.
--   c) criar a conta: Authentication, Users, Add user, e-mail
--      quiosque@neurodynamics.dev (ou outro), senha forte, sem vínculo com
--      membro. Depois, UMA vez, no SQL Editor:
--        insert into public.quiosque_conta(user_id)
--          select id from auth.users where email = 'quiosque@neurodynamics.dev'
--        on conflict (id) do update set user_id = excluded.user_id;
--   d) o segredo antigo ficou em arquivos públicos e no histórico do git:
--      depois desta migração, troque o valor em config_sistema.
-- ============================================================

do $$
begin
  if to_regprocedure('public.quiosque_estado(text)') is null then
    raise exception 'quiosque_estado(text) não existe neste banco. Confira a assinatura antes de aplicar (comentário do alto do arquivo).';
  end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='config_sistema' and column_name='chave')
     or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='config_sistema' and column_name='valor') then
    raise exception 'public.config_sistema(chave, valor) não existe. Confira onde o segredo do quiosque mora antes de aplicar.';
  end if;
  if not exists (select 1 from public.config_sistema where chave = 'segredo_quiosque') then
    raise exception 'Falta a linha segredo_quiosque em config_sistema. Se a chave tem outro nome, ajuste v_chave nesta migração.';
  end if;
end $$;

-- 1. a conta de serviço: uma linha só, invisível pela API
create table if not exists public.quiosque_conta (
  id      boolean primary key default true check (id),
  user_id uuid not null
);
alter table public.quiosque_conta enable row level security;
revoke all on public.quiosque_conta from public, anon, authenticated;
comment on table public.quiosque_conta is
  'A conta de serviço do quiosque (2.19.0). Uma linha; sem política, então só as funções security definer leem.';

-- 2. a sessão atual é a do quiosque?
create or replace function public.conta_quiosque()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from quiosque_conta where user_id = auth.uid());
$$;
revoke all on function public.conta_quiosque() from public, anon;
grant execute on function public.conta_quiosque() to authenticated;

-- 3. conta_ativa(): mesma regra da 2.18.0, mais "e não é a conta do quiosque"
create or replace function public.conta_ativa()
returns boolean language sql stable security definer
set search_path = public as $$
  select not exists (
    select 1 from perfis p join membros m on m.registro = p.registro
     where p.id = auth.uid() and public.status_bloqueado(m.status))
  and not public.conta_quiosque();
$$;
comment on function public.conta_ativa() is
  'Falso para a conta ligada a um membro Desligado, Egresso ou Sob demanda e para a conta do quiosque. '
  'É a política restritiva conta_ativa de toda tabela com RLS (2.18.0, 2.19.0).';

-- 4. o estado do quiosque, para a conta do quiosque
create or replace function public.quiosque_estado_conta()
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_chave constant text := 'segredo_quiosque'; v_seg text;
begin
  if not public.conta_quiosque() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select valor into v_seg from public.config_sistema where chave = v_chave;
  if v_seg is null then return jsonb_build_object('status', 'sem_segredo'); end if;
  return public.quiosque_estado(v_seg) || jsonb_build_object('status', 'ok');
end $$;
revoke all on function public.quiosque_estado_conta() from public, anon;
grant execute on function public.quiosque_estado_conta() to authenticated;

-- 5. o painel: avisos do dia e quem chegou ao time neste mês
create or replace function public.quiosque_painel()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.conta_quiosque() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok',
    'avisos', coalesce((select jsonb_agg(jsonb_build_object('titulo', a.titulo, 'corpo', a.corpo, 'layout', a.layout) order by a.ordem, a.criado_em desc)
        from (select * from portal_avisos
               where publicado and (data_inicio is null or data_inicio <= hoje) and (data_fim is null or data_fim >= hoje)
               order by ordem, criado_em desc limit 3) a), '[]'::jsonb),
    'novos', coalesce((select jsonb_agg(jsonb_build_object('registro', m.registro, 'nome', m.nome, 'foto_url', m.foto_url) order by m.data_ingresso desc)
        from (select registro, nome, foto_url, data_ingresso from membros
               where status in ('Ativo', 'Em pausa / avaliação') and data_ingresso >= date_trunc('month', hoje)::date
               order by data_ingresso desc limit 6) m), '[]'::jsonb));
end $$;
revoke all on function public.quiosque_painel() from public, anon;
grant execute on function public.quiosque_painel() to authenticated;

-- 6. o segredo que estava no código público deixa de servir
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.quiosque_estado(text) from anon'; end if;
  execute 'revoke execute on function public.quiosque_estado(text) from authenticated';
end $$;

insert into public.migracoes(id, descricao) values('2.19.0_quiosque',
 'SOMA 2.19.0: o quiosque entra com uma conta de serviço; conta_ativa() falsa para ela; quiosque_estado_conta e quiosque_painel; o segredo público deixa de servir')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, aplicada_em from public.migracoes where id='2.19.0_quiosque';
-- select count(*) as conta_do_quiosque from public.quiosque_conta;
-- -- logado como o quiosque (no app): quiosque_estado_conta() devolve status ok; select na tabela membros devolve 0 linhas.
-- -- com o segredo antigo: quiosque_estado('...') devolve permission denied.
