-- ============================================================
-- Esqueleto do processo seletivo, para testar a 31.0: as duas
-- funções de gatilho que a 6.0 usa (no banco de verdade vêm das
-- migrações do SOMA) e, em seguida, a 6.0 e a 7.0 como estão em
-- aplicadas/. Rode depois do esqueleto e do de Storage.
-- ============================================================
create or replace function public.fn_atualizado() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
create or replace function public.fn_auditoria() returns trigger language plpgsql as $$
begin return null; end $$;
create table if not exists public.dados_pessoais (registro integer primary key, data_nascimento date,
  cidade_origem text, curso text, instituicao text);
\ir ../aplicadas/soma_v06_selecao.sql
\ir ../aplicadas/soma_v07_selecao_slots.sql
