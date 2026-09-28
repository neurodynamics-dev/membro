\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 29.0 — o id de presencas, nas formas que o banco de verdade
-- pode ter. Rode num banco com o esqueleto, o de Storage e a 15.0.
--   identity:            o teste principal (v29_presenca.sql) cobre;
--   uuid sem padrão:     a 29.0 dá gen_random_uuid() e segue;
--   coluna obrigatória
--   sem padrão de fato:  a 29.0 para e diz qual.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

drop table if exists presencas;
create table presencas (id uuid primary key, registro integer not null, registrado_em timestamptz not null default now());

\ir ../v29_presenca_e_inicio.sql

do $$
begin
  raise notice 'O id de presencas';
  perform ok((select column_default from information_schema.columns
               where table_schema = 'public' and table_name = 'presencas' and column_name = 'id') = 'gen_random_uuid()',
    'id uuid sem padrão ganha gen_random_uuid()');
  insert into presencas (registro) values (4);
  perform ok((select count(*) from presencas where registro = 4 and id is not null) = 1, 'e a presença entra sem mandar o id');
  perform ok((select origem from presencas where registro = 4) is null, 'com a coluna origem, vazia para o quiosque');
end $$;

-- uma coluna obrigatória sem padrão de verdade continua parando a 29.0
alter table presencas add column local text not null default 'LABBIO';
alter table presencas alter column local drop default;
\set ON_ERROR_STOP off
\set VERBOSITY terse
\ir ../v29_presenca_e_inicio.sql
\set ON_ERROR_STOP on
\set VERBOSITY default
select ok(:'LAST_ERROR_MESSAGE' = 'presencas tem coluna obrigatória sem valor padrão: local',
  'coluna obrigatória sem padrão de verdade para a migração, dizendo qual');
