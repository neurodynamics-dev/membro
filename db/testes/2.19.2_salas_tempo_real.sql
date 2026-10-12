\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_salas_tempo_real: o banco avisa o canal da sala. Sem o Supabase Realtime,
-- um realtime.send de mentira guarda os avisos.
\i 2.19.2_salas_tempo_real.sql
create schema if not exists realtime;
create table if not exists realtime_avisos (topic text, event text, privado boolean, em timestamptz default clock_timestamp());
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language sql as $$ insert into public.realtime_avisos (topic, event, privado) values (topic, event, private) $$;

do $$
declare v_aud integer := (select id from espacos where nome = 'Auditório'); v_sala integer := (select id from espacos where nome = 'Sala de reuniões');
        v_copa integer := (select id from espacos where nome = 'Copa'); v_ev uuid; v_res uuid;
        n integer; agora timestamp := now() at time zone 'America/Sao_Paulo';
begin
  delete from realtime_avisos;
  insert into sala_ocupacoes (espaco_id, ate) values (v_aud, now() + interval '10 minutes');
  perform ok((select count(*) from realtime_avisos where topic = 'sala-' || v_aud and event = 'mudou' and not privado) = 1, 'ocupar avisa o canal da sala (público, sem dado)');
  delete from realtime_avisos;
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro) values ('Tempo real', agora::date + 1, '10:00', '11:00', v_aud, 42) returning id into v_ev;
  perform ok((select count(*) from realtime_avisos where topic = 'sala-' || v_aud) = 1, 'um evento novo na sala avisa');
  delete from realtime_avisos;
  update eventos set espaco_id = v_sala where id = v_ev;
  perform ok((select count(*) from realtime_avisos where topic in ('sala-' || v_aud, 'sala-' || v_sala)) = 2, 'trocar de sala avisa as duas');
  delete from realtime_avisos;
  update eventos set espaco_id = v_copa where id = v_ev;
  perform ok((select count(*) from realtime_avisos where topic = 'sala-' || v_copa) = 0, 'espaço fora do LABBIO não tem canal');
  delete from eventos where id = v_ev;
  delete from realtime_avisos;
  insert into labbio_reservas (espaco_id, data, hora_inicio, hora_fim, titulo) values (v_sala, agora::date + 2, '09:00', '10:00', 'Tempo real LABBIO') returning id into v_res;
  update labbio_reservas set cancelada_em = now() where id = v_res;
  perform ok((select count(*) from realtime_avisos where topic = 'sala-' || v_sala) = 2, 'a reserva do LABBIO avisa ao nascer e ao ser cancelada');
end $$;

-- sem o Realtime, a gravação segue
drop function realtime.send(jsonb, text, text, boolean);
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$ begin raise exception 'Realtime fora do ar'; end $$;
insert into sala_ocupacoes (espaco_id, ate) values ((select id from espacos where nome = 'Auditório'), now() + interval '5 minutes');
select ok(true, 'o aviso falhar não desfaz a gravação');
drop schema realtime cascade; drop table realtime_avisos;
insert into sala_ocupacoes (espaco_id, ate) values ((select id from espacos where nome = 'Auditório'), now() + interval '5 minutes');
select ok(true, 'sem o Realtime, nada acontece');
update sala_ocupacoes set ate = now() where ate > now();
\echo Tudo certo.
