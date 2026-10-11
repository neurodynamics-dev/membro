\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: tablets na porta das salas.
-- Rode depois do teste das salas (os espaços do LABBIO, a gestora ativa):
--   bash testes/preparar-base.sh teste t2191tb 2.18.0_soma.sql 2.19.0.sql 2.19.1_labbio.sql \
--        2.19.1_labbio_salas.sql 2.19.1_labbio_tablets.sql
-- (os horários são relativos ao relógio; perto da meia-noite, rode de novo)
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_labbio_tablets.sql
\i 2.19.1_labbio_tablets.sql

select eu(42, 'leitura');
select ok(public.labbio_dispositivo_criar((select id from espacos where nome = 'Auditório'), 'Porta do auditório')->>'status' = 'sem_permissao',
          'membro não cria tablet');
select set_config('teste.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select ok(public.labbio_dispositivo_criar((select id from espacos where nome = 'Copa'), 'Copa')->>'status' = 'espaco_invalido', 'só espaço do LABBIO');
select substring(public.labbio_dispositivo_criar((select id from espacos where nome = 'Auditório'), 'Porta do auditório')->>'endereco' from 'd=(.*)$') as tk_aud \gset
select substring(public.labbio_dispositivo_criar((select id from espacos where nome = 'Sala de reuniões'), 'Porta da sala')->>'endereco' from 'd=(.*)$') as tk_sala \gset
select ok(length(:'tk_aud') = 48 and not exists (select 1 from sala_dispositivos where token_hash = :'tk_aud'), 'o token sai uma vez e fica só o hash');
select set_config('teste.tk_aud', :'tk_aud', false), set_config('teste.tk_sala', :'tk_sala', false);

-- um evento agora no auditório; um privado daqui a 15 minutos na sala
do $$
declare agora timestamp := now() at time zone 'America/Sao_Paulo';
begin
  delete from eventos where espaco_id in (select id from espacos where nome in ('Auditório', 'Sala de reuniões')) and data = agora::date;
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
  values ('Defesa de TCC', agora::date, (agora - interval '10 minutes')::time, (agora + interval '40 minutes')::time,
          (select id from espacos where nome = 'Auditório'), 42);
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro, visibilidade)
  values ('Conversa com a direção', agora::date, (agora + interval '15 minutes')::time, (agora + interval '45 minutes')::time,
          (select id from espacos where nome = 'Sala de reuniões'), 42, 'privado');
end $$;

-- o tablet não tem conta: papel anon
set role anon;
do $$ declare r jsonb; begin
  r := public.sala_estado(current_setting('teste.tk_aud'));
  perform ok(r->>'status' = 'ok' and r->>'estado' = 'evento' and r->'evento'->>'titulo' = 'Defesa de TCC', 'o tablet mostra o evento em andamento');
  perform ok(not (r ? 'convidados') and r::text !~ 'convidad', 'sem convidados');
  perform ok(public.sala_ocupar(current_setting('teste.tk_aud'), 10)->>'status' = 'em_evento', 'não ocupa por cima de um evento');
  r := public.sala_estado(current_setting('teste.tk_sala'));
  perform ok(r->>'estado' = 'livre' and r->'proximo'->>'titulo' = 'Reservado', 'sala livre; o próximo, privado, aparece como Reservado');
  perform ok(public.sala_ocupar(current_setting('teste.tk_sala'), 60)->>'status' = 'invalido', 'ocupar no máximo 30 minutos');
  r := public.sala_ocupar(current_setting('teste.tk_sala'), 30);
  perform ok(r->>'status' = 'ok' and r->>'estado' = 'ocupada', 'ocupar por alguns minutos');
  perform ok((r->>'ocupada_ate')::timestamptz <= (r->'proximo'->>'inicio')::timestamptz, 'a ocupação termina antes da próxima reserva');
  r := public.sala_liberar(current_setting('teste.tk_sala'));
  perform ok(r->>'estado' = 'livre', 'liberar antes');
  perform ok(public.sala_estado('0000')->>'status' = 'dispositivo_invalido', 'endereço sem token válido não lê nada');
  begin
    perform count(*) from public.sala_dispositivos;
    raise exception 'FALHOU: anon leu sala_dispositivos';
  exception when insufficient_privilege then perform ok(true, 'as tabelas não são legíveis');
  end;
end $$;
reset role;

select ok((select count(*) from eventos where titulo = 'Defesa de TCC') = 1, 'a agenda não muda com o tablet');
select set_config('teste.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select ok(public.labbio_dispositivo_revogar((select id from sala_dispositivos where rotulo = 'Porta da sala'))->>'status' = 'ok', 'o gestor revoga o tablet');
select ok(public.sala_estado(:'tk_sala')->>'status' = 'dispositivo_invalido', 'revogado, o tablet para de ler');
select ok(jsonb_array_length(public.labbio_dispositivos()->'dispositivos') = 2, 'a lista mostra os dois, com a situação');
\echo 'Tudo certo.'
