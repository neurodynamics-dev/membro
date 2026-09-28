-- ============================================================
-- SOMA 29.0 — MIGRAÇÃO · NeuroDynamics
-- A PRESENÇA NO LABBIO E O INÍCIO.
--
--   1. A FOLHA DE CHECK-IN: um QR Code fixo, impresso em A4, que vale
--      como o do quiosque quando o quiosque não está ligado. O QR do
--      quiosque gira a cada 40 segundos; o da folha não gira — por
--      isso a folha é controlada: cada uma tem código, quem gerou, o
--      número de usos, e revoga-se na hora (checkin_folhas).
--   2. O PLACAR: o ranking do mês (dias com check-in) e a sequência de
--      cada um em dias úteis — sábado, domingo e feriado não contam e
--      não quebram (labbio_placar).
--   3. OS LINKS ÚTEIS do início, que a gestão mantém em
--      Administração › Links úteis (portal_links).
--
-- Pré-requisitos: a tabela presencas (o check-in do SOMA) e a 15.0.
-- Idempotente. COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
declare v_col text;
begin
  if to_regclass('public.presencas') is null then
    raise exception using message = 'Falta a tabela public.presencas (o check-in do SOMA).';
  end if;
  if to_regclass('public.calendario_itens') is null or to_regprocedure('public.portal_registro_atual()') is null then
    raise exception using message = 'Falta aplicar as migrações da agenda (13.0) e do portal (10.0).';
  end if;
  -- a folha grava a presença com registro e hora; se a tabela tiver
  -- outra coluna obrigatória sem padrão, é melhor parar aqui dizendo qual
  select string_agg(column_name, ', ') into v_col
    from information_schema.columns
   where table_schema = 'public' and table_name = 'presencas'
     and is_nullable = 'NO' and column_default is null
     and column_name not in ('registro', 'registrado_em', 'origem');
  if v_col is not null then
    raise exception using message = 'presencas tem coluna obrigatória sem valor padrão: ' || v_col,
      hint = 'Dê um valor padrão a ela (alter table public.presencas alter column ... set default ...) e rode de novo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. A FOLHA DE CHECK-IN
-- ------------------------------------------------------------
alter table public.presencas add column if not exists origem text;
comment on column public.presencas.origem is 'De onde veio o check-in: quiosque (vazio) ou folha (a folha A4 fixa).';

create table if not exists public.checkin_folhas (
  id            uuid primary key default gen_random_uuid(),
  numero        integer generated always as identity,
  token         uuid not null unique default gen_random_uuid(),
  rotulo        text,
  criada_em     timestamptz not null default now(),
  criada_por    text,
  revogada_em   timestamptz,
  revogada_por  text,
  usos          integer not null default 0,
  ultimo_uso    timestamptz
);
alter table public.checkin_folhas enable row level security;
drop policy if exists chkf_gestao on public.checkin_folhas;
create policy chkf_gestao on public.checkin_folhas for select to authenticated
  using (public.papel_atual() in ('admin','pessoal'));
grant select on public.checkin_folhas to authenticated;

create or replace function public.checkin_folha_criar(p_rotulo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.checkin_folhas%rowtype; v_quem text;
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  insert into checkin_folhas (rotulo, criada_por) values (nullif(trim(p_rotulo),''), coalesce(v_quem, 'Portal'))
  returning * into f;
  return jsonb_build_object('status','ok','id',f.id,'numero',f.numero,'token',f.token,'criada_em',f.criada_em,'criada_por',f.criada_por);
end $$;

create or replace function public.checkin_folha_revogar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_quem text;
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  update checkin_folhas set revogada_em = now(), revogada_por = coalesce(v_quem, 'Portal')
   where id = p_id and revogada_em is null;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok');
end $$;

-- O check-in pela folha: o mesmo que o do quiosque, com o token fixo
-- no lugar do que gira. Quem lê a folha precisa estar logado — o token
-- diz ONDE, a sessão diz QUEM.
create or replace function public.registrar_checkin_folha(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_nome  text;
  v_ult   timestamptz;
  v_mes   integer;
begin
  if auth.uid() is null then return jsonb_build_object('status','sessao'); end if;
  if v_reg is null then return jsonb_build_object('status','sem_vinculo'); end if;
  if not exists (select 1 from checkin_folhas where token = p_token and revogada_em is null) then
    return jsonb_build_object('status','folha_invalida');
  end if;
  select nome into v_nome from membros where registro = v_reg;
  select max(registrado_em) into v_ult from presencas where registro = v_reg;
  if v_ult is not null and v_ult > now() - interval '4 hours' then
    return jsonb_build_object('status','repetido','nome',v_nome);
  end if;
  insert into presencas (registro, registrado_em, origem) values (v_reg, now(), 'folha');
  update checkin_folhas set usos = usos + 1, ultimo_uso = now() where token = p_token;
  select count(distinct (registrado_em at time zone 'America/Sao_Paulo')::date) into v_mes
    from presencas where registro = v_reg
     and registrado_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  return jsonb_build_object('status','ok','nome',v_nome,'visitas_mes',v_mes,
    'anterior', case when v_ult is null then null
      else to_char(v_ult at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') end);
end $$;

revoke execute on function public.checkin_folha_criar(text)      from public, anon;
revoke execute on function public.checkin_folha_revogar(uuid)    from public, anon;
revoke execute on function public.registrar_checkin_folha(uuid)  from public, anon;
grant  execute on function public.checkin_folha_criar(text)      to authenticated;
grant  execute on function public.checkin_folha_revogar(uuid)    to authenticated;
grant  execute on function public.registrar_checkin_folha(uuid)  to authenticated;

-- ------------------------------------------------------------
-- 2. O PLACAR DO LABBIO
--    ranking: dias distintos com check-in no mês, os dez primeiros;
--    sequências: dias úteis seguidos com check-in, até hoje. O dia útil
--    de hoje ainda sem check-in não quebra a sequência (o dia não
--    acabou); fim de semana e feriado da equipe (calendario_itens do
--    tipo feriado) nem contam nem quebram.
-- ------------------------------------------------------------
create or replace function public.labbio_placar(p_limite integer default 10)
returns jsonb language sql stable security definer set search_path = public as $$
  with par as (
    select (now() at time zone 'America/Sao_Paulo')::date as hoje,
           date_trunc('month', now() at time zone 'America/Sao_Paulo')::date as mes0,
           public.portal_registro_atual() as eu
  ), uteis as (
    select d::date as dia, row_number() over (order by d) as n
      from par, generate_series(par.hoje - 400, par.hoje, interval '1 day') d
     where extract(isodow from d) < 6
       and not exists (select 1 from calendario_itens ci
                        where ci.tipo = 'feriado' and ci.registro is null
                          and d::date between ci.data_inicio and coalesce(ci.data_fim, ci.data_inicio))
  ), ult as (
    select max(n) as nult, bool_or(dia = (select hoje from par)) as util_hoje from uteis
  ), vis as (
    select distinct p.registro, (p.registrado_em at time zone 'America/Sao_Paulo')::date as dia
      from presencas p, par
     where p.registrado_em >= (par.hoje - 400)::timestamp at time zone 'America/Sao_Paulo'
  ), marcados as (
    select v.registro, u.n from vis v join uteis u on u.dia = v.dia
  ), ilhas as (
    select registro, max(n) as fim, count(*)::integer as tam
      from (select registro, n, n - row_number() over (partition by registro order by n) as g from marcados) x
     group by registro, g
  ), seq as (
    select i.registro,
           coalesce(max(i.tam) filter (where i.fim >= ult.nult - case when ult.util_hoje then 1 else 0 end), 0) as atual,
           max(i.tam) as recorde
      from ilhas i, ult group by i.registro
  ), rank as (
    select registro, count(*)::integer as dias, max(dia) as ultimo
      from vis, par where dia >= par.mes0 group by registro
  ), ativos as (
    select registro, nome from membros where status in ('Ativo','Em pausa / avaliação','Sob demanda')
  )
  select case when auth.uid() is null then null else jsonb_build_object(
    'mes', to_char((select mes0 from par), 'YYYY-MM'),
    'dias_uteis_mes', (select count(*) from uteis where dia >= (select mes0 from par)),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object('registro', r.registro, 'nome', a.nome, 'dias', r.dias)
                                          order by r.dias desc, r.ultimo desc, a.nome)
                  from (select rank.* from rank join ativos using (registro)
                         order by dias desc, ultimo desc limit greatest(p_limite,1)) r
                  join ativos a using (registro)), '[]'::jsonb),
    'sequencias', coalesce((select jsonb_agg(jsonb_build_object('registro', s.registro, 'nome', a.nome, 'atual', s.atual, 'recorde', s.recorde)
                                             order by s.atual desc, s.recorde desc, a.nome)
                  from (select seq.* from seq join ativos using (registro) where atual > 0
                         order by atual desc, recorde desc limit greatest(p_limite,1)) s
                  join ativos a using (registro)), '[]'::jsonb),
    'eu', case when (select eu from par) is null then null else jsonb_build_object(
      'dias', coalesce((select dias from rank where registro = (select eu from par)), 0),
      'posicao', (select pos from (select registro, rank() over (order by dias desc) as pos from rank) z where registro = (select eu from par)),
      'atual', coalesce((select atual from seq where registro = (select eu from par)), 0),
      'recorde', coalesce((select recorde from seq where registro = (select eu from par)), 0)) end) end;
$$;
revoke execute on function public.labbio_placar(integer) from public, anon;
grant  execute on function public.labbio_placar(integer) to authenticated;

-- ------------------------------------------------------------
-- 3. LINKS ÚTEIS DO INÍCIO
-- ------------------------------------------------------------
create table if not exists public.portal_links (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null check (length(trim(titulo)) > 0),
  url        text not null check (url ~* '^(https?://|#/)'),
  descricao  text,
  grupo      text,                          -- o rótulo que agrupa, opcional
  ordem      integer not null default 100,
  ativo      boolean not null default true,
  criado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.portal_links enable row level security;
drop policy if exists plinks_select on public.portal_links;
create policy plinks_select on public.portal_links for select to authenticated using (true);
drop policy if exists plinks_write on public.portal_links;
create policy plinks_write on public.portal_links for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));
grant select, insert, update, delete on public.portal_links to authenticated;

insert into public.portal_links (titulo, url, descricao, grupo, ordem)
select * from (values
  ('Site institucional', 'https://neurodynamics.dev', 'neurodynamics.dev', 'Institucional', 10),
  ('Brand guidelines', 'https://brand.neurodynamics.dev', 'Marca, cores e tipografia', 'Institucional', 20),
  ('Processo seletivo', 'https://selecao.neurodynamics.dev', 'Inscrições e etapas', 'Institucional', 30),
  ('GitHub', 'https://github.com/neurodynamics-dev', 'Código dos sistemas', 'Ferramentas', 40)
) v(titulo, url, descricao, grupo, ordem)
where not exists (select 1 from public.portal_links);

-- ------------------------------------------------------------
-- 4. O POKÉMON DOS PROJETOS
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.projetos') is not null then
    comment on column public.projetos.logo_semente is
      'O Pokémon do projeto: "pkm:<número da Pokédex>", escolhido na criação. Semente de texto '
      '(de antes da 29.0) dá um Pokémon sorteado pela semente, sempre o mesmo.';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v29_presenca_e_inicio', 'A folha de check-in com QR fixo e revogável, o placar do LABBIO (ranking do mês e sequência em dias úteis) e os links úteis do início')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 29.0
-- Depois de aplicar: Equipe › Presença › Folha de check-in gera o PDF
-- A4; Administração › Links úteis mantém os links do início.
-- ============================================================
