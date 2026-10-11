\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: consulta ao LABBIO para as salas.
-- Rode depois do teste do LABBIO (identidade), que deixa a gestora ativa:
--   bash testes/preparar-base.sh teste t2191s 2.18.0_soma.sql 2.19.0.sql 2.19.1_labbio.sql 2.19.1_labbio_salas.sql
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_labbio_salas.sql
\i 2.19.1_labbio_salas.sql

insert into espacos (nome) values ('Auditório'), ('Copa');
update espacos set labbio = true, consulta_labbio = true where nome = 'Auditório';

do $$
declare sala integer := (select id from espacos where nome = 'Sala de reuniões'); aud integer := (select id from espacos where nome = 'Auditório');
  copa integer := (select id from espacos where nome = 'Copa'); e1 uuid; e2 uuid; e3 uuid; e4 uuid; r jsonb; n integer;
  gest text := 'aaaaaaaa-0000-0000-0000-000000000001'; d date := current_date + 3;
begin
  raise notice 'Espaços';
  perform ok((select consulta_labbio from espacos where id = sala), 'a Sala de Reuniões pede consulta (pelo nome)');

  raise notice 'Abrir e invalidar';
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro) values ('Reunião de projeto', d, '10:00', '11:00', sala, 42) returning id into e1;
  insert into evento_participantes (evento_id, registro) values (e1, 11), (e1, 47);
  perform ok((select situacao from labbio_consultas where evento_id = e1) = 'pendente', 'salvar na sala abre a consulta');
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro) values ('Café', d, '10:00', '11:00', copa, 42) returning id into e4;
  perform ok(not exists (select 1 from labbio_consultas where evento_id = e4), 'espaço sem consulta não abre');
  update eventos set titulo = 'Reunião de projeto (pauta)' where id = e1;
  perform ok((select count(*) from labbio_consultas where evento_id = e1) = 1, 'mudar só o título não mexe na consulta');
  update eventos set hora_inicio = '10:30', hora_fim = '11:30' where id = e1;
  perform ok((select count(*) from labbio_consultas where evento_id = e1 and situacao = 'invalidada') = 1
             and (select count(*) from labbio_consultas where evento_id = e1 and situacao = 'pendente') = 1,
    'mudar o horário invalida a consulta anterior e abre outra');
  update eventos set hora_inicio = '10:00', hora_fim = '11:00' where id = e1;

  raise notice 'Sobreposição';
  perform eu(42, 'leitura');
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro) values ('Banca', d, '11:00', '12:00', sala, 43) returning id into e2;
  perform ok(jsonb_array_length(public.labbio_consulta_do_evento(e1)->'sobreposicoes') = 0, '10h–11h e 11h–12h não se cruzam');
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro) values ('Entrevista sigilosa', d, '10:30', '11:30', sala, 43) returning id into e3;
  perform eu(42, 'leitura');
  r := public.labbio_consulta_do_evento(e1);
  perform ok(jsonb_array_length(r->'sobreposicoes') = 1 and r::text !~ 'sigilosa', 'o organizador vê a sobreposição, sem o título do outro evento');
  perform ok(r->'consulta'->>'situacao' = 'pendente', 'e a consulta pendente (o evento vale assim mesmo)');

  raise notice 'O LABBIO';
  perform ok(public.labbio_agenda(d, d)->>'status' = 'sem_permissao', 'membro não vê a agenda do LABBIO');
  perform set_config('teste.uid', gest, false);
  r := public.labbio_agenda(d, d);
  perform ok(jsonb_array_length(r->'eventos') = 3, 'os três eventos nos espaços do LABBIO (sem o da copa)');
  select x into r from jsonb_array_elements(public.labbio_agenda(d, d)->'eventos') x where (x->>'id')::uuid = e1;
  perform ok(r->'convidados' = '["Bruno Tavares", "Mateus Cruz"]'::jsonb and jsonb_array_length(r->'sobreposicoes') = 1
             and r->'sobreposicoes'->0->>'titulo' = 'Entrevista sigilosa', 'com convidados e a sobreposição detalhada');
  perform ok(public.labbio_consulta_decidir((r->'consulta'->>'id')::uuid, false)->>'status' = 'motivo_obrigatorio', 'conflito pede motivo');
  select count(*) into n from notificacoes where registro = 42;
  perform ok(public.labbio_consulta_decidir((r->'consulta'->>'id')::uuid, false, 'Manutenção do ar-condicionado')->>'status' = 'ok', 'registra o conflito');
  perform ok((select count(*) from notificacoes where registro = 42) = n + 1, 'o organizador recebe um aviso');
  perform ok(public.labbio_consulta_decidir((r->'consulta'->>'id')::uuid, false, 'de novo')->>'status' = 'ok'
             and (select count(*) from notificacoes where registro = 42) = n + 1, 'a mesma decisão não avisa de novo');
  perform ok((select status from eventos where id = e1) is distinct from 'Cancelado', 'o evento não é cancelado sozinho');
  perform ok(public.labbio_consulta_decidir((select id from labbio_consultas where evento_id = e2 and situacao <> 'invalidada'), true)->>'status' = 'ok',
    'disponível, sem motivo');

  raise notice 'Cancelar e séries';
  update eventos set status = 'Cancelado' where id = e2;
  perform ok(not exists (select 1 from labbio_consultas where evento_id = e2 and situacao <> 'invalidada'), 'cancelar invalida a consulta');
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
  select 'Seminário semanal', d + k * 7, '14:00', '15:00', aud, 42 from generate_series(1, 3) k;
  perform ok((select count(*) from labbio_consultas c join eventos e on e.id = c.evento_id where e.titulo = 'Seminário semanal' and c.situacao = 'pendente') = 3,
    'cada ocorrência da série tem a sua consulta');
end $$;
\echo 'Tudo certo.'
