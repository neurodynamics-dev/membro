\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.0: o quiosque com conta de serviço e o quadro de avisos
-- com os layouts novos. Rode depois do teste da 2.18.0 (o mesmo banco:
-- createdb -T tbase t219; testes/2.18.0_soma.sql; este arquivo). O que a
-- produção tem e o repositório não (config_sistema e quiosque_estado, do
-- SOMA antigo) entra aqui como esqueleto. Aplica as migrações duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- esqueleto do que vem da produção
create table if not exists public.config_sistema(chave text primary key, valor text);
insert into public.config_sistema values ('segredo_quiosque', 'segredo-de-teste') on conflict do nothing;
create or replace function public.quiosque_estado(p_segredo text) returns jsonb language plpgsql security definer
set search_path = public as $$
begin
  if p_segredo is distinct from (select valor from config_sistema where chave = 'segredo_quiosque') then
    return jsonb_build_object('erro', 'segredo');
  end if;
  return jsonb_build_object('qr', 'abc', 'presentes', '[]'::jsonb);
end $$;
grant execute on function public.quiosque_estado(text) to anon, authenticated;
create table if not exists public.portal_avisos(
  id uuid primary key default gen_random_uuid(), titulo text not null, corpo text,
  layout text not null default 'padrao' check (layout in ('padrao','destaque','urgente','evento','conquista')),
  link_url text, link_rotulo text, data_evento date, data_inicio date, data_fim date,
  ordem integer not null default 100, publicado boolean not null default false, criado_por text,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());
-- o teste da 2.18.0 cria um portal_avisos mínimo: completa com as colunas da v10
alter table public.portal_avisos add column if not exists corpo text,
  add column if not exists layout text not null default 'padrao' check (layout in ('padrao','destaque','urgente','evento','conquista')),
  add column if not exists link_url text, add column if not exists link_rotulo text, add column if not exists data_evento date,
  add column if not exists ordem integer not null default 100, add column if not exists criado_por text,
  add column if not exists criado_em timestamptz not null default now(), add column if not exists atualizado_em timestamptz not null default now();
alter table public.membros add column if not exists data_ingresso date;
insert into public.portal_avisos(titulo, layout, publicado) values ('Aviso antigo', 'destaque', true);

\i 2.19.0_quiosque.sql
\i 2.19.0_avisos.sql
\i 2.19.0_quiosque.sql
\i 2.19.0_avisos.sql

-- a conta do quiosque: um usuário qualquer, sem perfil de membro
insert into public.quiosque_conta(user_id) values ('00000000-0000-0000-0000-0000000000aa')
on conflict (id) do update set user_id = excluded.user_id;

do $$
declare r jsonb; n integer;
begin
  raise notice 'Quiosque';
  perform ok((select count(*) from migracoes where id in ('2.19.0_quiosque','2.19.0_avisos')) = 2, 'as duas migrações ficam registradas, uma vez cada');
  perform set_config('teste.uid', '00000000-0000-0000-0000-0000000000aa', false);
  perform ok(public.conta_quiosque(), 'a sessão do quiosque é reconhecida');
  perform ok(not public.conta_ativa(), 'conta_ativa() é falsa para o quiosque: nenhuma tabela com RLS lê');
  r := public.quiosque_estado_conta();
  perform ok(r->>'status' = 'ok' and r->>'qr' = 'abc', 'quiosque_estado_conta() devolve o estado, com o segredo lido do banco');
  r := public.quiosque_painel();
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'avisos') = 1, 'quiosque_painel() devolve os avisos publicados');
  perform set_config('teste.uid', (select id::text from perfis where registro = 4), false);
  perform ok(public.conta_ativa(), 'conta de membro ativo continua ativa');
  r := public.quiosque_estado_conta();
  perform ok(r->>'status' = 'sem_permissao', 'outra conta não recebe o estado do quiosque');
  perform ok(public.quiosque_painel()->>'status' = 'sem_permissao', 'nem o painel');
  perform ok(not has_function_privilege('anon', 'public.quiosque_estado(text)', 'execute')
         and not has_function_privilege('authenticated', 'public.quiosque_estado(text)', 'execute'),
         'o segredo antigo deixa de servir: anon e authenticated sem execute em quiosque_estado');
  perform ok(not has_table_privilege('authenticated', 'public.quiosque_conta', 'select'), 'ninguém lê quiosque_conta pela API');
end $$;

do $$
declare falhou boolean;
begin
  raise notice 'Quadro de avisos';
  perform ok((select layout from portal_avisos where titulo = 'Aviso antigo') = 'destaque', 'o aviso antigo segue como estava');
  insert into portal_avisos(titulo, layout, familia, valor) values ('Hero', 'hero', 'ion', null), ('Número', 'numero', null, '42'),
    ('Contagem', 'contagem', 'lumen', null), ('Lista', 'lista', null, null), ('Citação', 'citacao', 'dendrito', null), ('Meta', 'progresso', null, '72');
  perform ok((select count(*) from portal_avisos where layout in ('hero','numero','contagem','lista','citacao','progresso')) = 6, 'os seis layouts novos são aceitos');
  begin insert into portal_avisos(titulo, layout) values ('x', 'carrossel'); falhou := false;
  exception when check_violation then falhou := true; end;
  perform ok(falhou, 'layout desconhecido é recusado');
  begin insert into portal_avisos(titulo, familia) values ('x', 'roxo'); falhou := false;
  exception when check_violation then falhou := true; end;
  perform ok(falhou, 'família fora das doze é recusada');
  begin insert into portal_avisos(titulo, valor) values ('x', repeat('9', 25)); falhou := false;
  exception when check_violation then falhou := true; end;
  perform ok(falhou, 'valor com mais de 24 caracteres é recusado');
  perform ok((select count(*) from pg_constraint where conrelid = 'public.portal_avisos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%layout%') = 1, 'sobra uma restrição de layout, mesmo aplicando duas vezes');
end $$;
\echo 'Tudo certo.'
