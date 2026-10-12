\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.2_salas: o tablet com o organizador e as reservas de hoje,
-- ocupar por 30 min, 1 h ou o resto do dia, e a sala no celular.
-- Rode por último na cadeia da 2.19.2 (depois das salas e dos tablets).
-- (os horários são relativos ao relógio; perto da meia-noite, rode de novo)
-- ============================================================
\i 2.19.2_salas.sql
\i 2.19.2_salas.sql

select set_config('teste.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
select substring(public.labbio_dispositivo_criar((select id from espacos where nome = 'Auditório'), 'Auditório 2192')->>'endereco' from 'd=(.*)$') as tk \gset
select set_config('teste.tk', :'tk', false), set_config('teste.aud', (select id from espacos where nome = 'Auditório')::text, false);

do $$
declare agora timestamp := now() at time zone 'America/Sao_Paulo'; v_aud integer := (select id from espacos where nome = 'Auditório');
        v_sala integer := (select id from espacos where nome = 'Sala de reuniões');
begin
  delete from sala_ocupacoes;
  delete from eventos where espaco_id in (v_aud, v_sala) and data = agora::date;
  -- uma reserva daqui a 3 horas no auditório (se ainda couber hoje); a sala com um evento agora
  if agora::time < '20:00' then
    insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
    values ('Seminário do grupo', agora::date, (agora + interval '3 hours')::time, least(agora + interval '4 hours', agora::date + time '23:59')::time, v_aud, 42);
  end if;
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
  values ('Reunião de projeto', agora::date, (agora - interval '5 minutes')::time, least(agora + interval '30 minutes', agora::date + time '23:59')::time, v_sala, 43);
end $$;

set role anon;
do $$ declare r jsonb; v_fim timestamptz := ((((now() at time zone 'America/Sao_Paulo')::date + 1)::timestamp) at time zone 'America/Sao_Paulo'); begin
  raise notice 'O tablet';
  r := public.sala_estado(current_setting('teste.tk'));
  perform ok(r->>'status' = 'ok' and r->>'estado' = 'livre' and (r->>'espaco_id')::int = current_setting('teste.aud')::int,
    'livre, com o id da sala (para o QR)');
  perform ok(r->'proximo' is null or r->'proximo'->>'organizador' is not null, 'a próxima reserva vem com quem reservou');
  perform ok(jsonb_typeof(r->'hoje') = 'array', 'as reservas de hoje');
  perform ok(public.sala_ocupar(current_setting('teste.tk'), 2000)->>'status' = 'invalido', 'mais de um dia não vale');
  r := public.sala_ocupar(current_setting('teste.tk'), 30);
  perform ok(r->>'status' = 'ok' and r->>'estado' = 'ocupada' and r->>'ocupada_por' is null, 'ocupar por 30 min, na porta (sem nome)');
  r := public.sala_ocupar(current_setting('teste.tk'), 1440);
  perform ok(r->>'status' = 'ok' and (r->>'ocupada_ate')::timestamptz <= v_fim, 'o resto do dia vai até a meia-noite, no máximo');
  perform ok(r->'proximo' is null or (r->>'ocupada_ate')::timestamptz <= (r->'proximo'->>'inicio')::timestamptz, 'e para antes da próxima reserva');
  begin
    perform public.sala_painel(1);
    raise exception 'FALHOU: anon abriu o painel do celular';
  exception when insufficient_privilege then perform ok(true, 'o tablet não usa as funções do celular');
  end;
end $$;
reset role;
select ok((select count(*) from sala_ocupacoes where ate > now()) = 1, 'ocupar de novo substitui a ocupação anterior');

do $$ declare r jsonb; v_aud integer := (select id from espacos where nome = 'Auditório'); v_sala integer := (select id from espacos where nome = 'Sala de reuniões'); begin
  raise notice 'O celular';
  perform eu(44, 'leitura');   -- desligado: conta inativa
  perform ok(public.sala_painel(v_aud)->>'status' = 'sem_permissao', 'conta inativa não vê');
  perform eu(42, 'leitura');
  r := public.sala_painel(v_aud);
  perform ok(r->>'status' = 'ok' and r->'sala'->>'nome' = 'Auditório' and r->'sala'->>'estado' = 'ocupada', 'a sala escolhida, com a ocupação da porta');
  perform ok(exists (select 1 from jsonb_array_elements(r->'outras') x where x->>'nome' = 'Sala de reuniões' and x->>'estado' = 'evento'
                       and x->'evento'->>'organizador' is not null), 'as outras salas, com quem reservou');
  perform ok(public.sala_painel((select id from espacos where nome = 'Copa'))->>'status' = 'nao_encontrado', 'só salas do LABBIO');
  r := public.sala_liberar_membro(v_aud);
  perform ok(r->>'estado' = 'livre', 'liberar pelo celular');
  r := public.sala_ocupar_membro(v_aud, 60);
  perform ok(r->>'estado' = 'ocupada' and r->>'ocupada_por' = (select nome from membros where registro = 42), 'ocupar pelo celular guarda quem ocupou');
  perform ok(public.sala_ocupar_membro(v_sala, 30)->>'status' = 'em_evento', 'não ocupa por cima de um evento');
  perform ok(public.sala_ocupar_membro(v_aud, 3)->>'status' = 'invalido', 'menos de 5 minutos não vale');
  perform ok((select count(*) from eventos where titulo = 'Reunião de projeto') = 1, 'a agenda não muda');
  perform public.sala_liberar_membro(v_aud);
end $$;

-- as reservas do LABBIO
do $$
declare r jsonb; v_sala integer := (select id from espacos where nome = 'Sala de reuniões'); v_aud integer := (select id from espacos where nome = 'Auditório');
        agora timestamp := now() at time zone 'America/Sao_Paulo'; n0 integer; e0 integer; v_res uuid; v_ev uuid; v_hi time; v_hf time;
begin
  raise notice 'Reservas do LABBIO';
  perform eu(42, 'leitura');
  perform ok(public.labbio_reserva_salvar('{}')->>'status' = 'sem_permissao', 'membro não reserva pelo LABBIO');
  perform set_config('teste.uid', 'aaaaaaaa-0000-0000-0000-000000000001', false);
  perform ok(public.labbio_reserva_salvar(jsonb_build_object('espaco_id', v_sala, 'data', agora::date, 'hora_inicio', '10:00', 'hora_fim', '09:00', 'titulo', 'X'))->>'campo' = 'horario',
    'fim antes do início não vale');
  perform ok(public.labbio_reserva_salvar(jsonb_build_object('espaco_id', (select id from espacos where nome = 'Copa'), 'data', agora::date,
    'hora_inicio', '10:00', 'hora_fim', '11:00', 'titulo', 'X'))->>'campo' = 'sala', 'só salas do LABBIO');
  n0 := (select count(*) from notificacoes where registro = 43); e0 := (select count(*) from labbio_envios where tipo = 'conflito_sala');
  v_hi := (agora - interval '1 minute')::time; v_hf := least(agora + interval '20 minutes', agora::date + time '23:59')::time;
  r := public.labbio_reserva_salvar(jsonb_build_object('espaco_id', v_sala, 'data', agora::date, 'hora_inicio', v_hi, 'hora_fim', v_hf,
         'titulo', 'Aula de bioengenharia', 'responsavel', 'Prof. Helena'));
  v_res := (r->>'id')::uuid;
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'conflitos') = 1 and r->'conflitos'->0->>'titulo' = 'Reunião de projeto',
    'reserva por cima de um evento nosso: salva, e devolve o conflito');
  perform ok((select count(*) from notificacoes where registro = 43) = n0 + 1, 'quem organizou o evento recebe o aviso');
  perform ok((select count(*) from labbio_envios where tipo = 'conflito_sala') = e0 + 1, 'e o LABBIO, por e-mail');
  perform ok(not exists (select 1 from eventos where titulo = 'Aula de bioengenharia'), 'a reserva do LABBIO não entra na agenda do SOMA');
  r := public.labbio_reserva_salvar(jsonb_build_object('id', v_res, 'espaco_id', v_sala, 'data', agora::date, 'hora_inicio', v_hi, 'hora_fim', v_hf,
         'titulo', 'Aula de bioengenharia (turma B)', 'responsavel', 'Prof. Helena'));
  perform ok((select count(*) from notificacoes where registro = 43) = n0 + 1, 'mudar só o título não avisa de novo');
  r := public.labbio_salas_disponibilidade(agora::date);
  perform ok(exists (select 1 from jsonb_array_elements(r->'blocos') b where b->>'origem' = 'labbio' and (b->>'conflito')::boolean)
         and exists (select 1 from jsonb_array_elements(r->'blocos') b where b->>'origem' = 'soma' and b->>'titulo' = 'Reunião de projeto' and (b->>'conflito')::boolean),
    'a disponibilidade mostra os dois lados, marcados em conflito');

  raise notice 'O outro sentido: um evento nosso por cima de uma reserva do LABBIO';
  if agora::time < '21:00' then
    r := public.labbio_reserva_salvar(jsonb_build_object('espaco_id', v_aud, 'data', agora::date, 'hora_inicio', (agora + interval '90 minutes')::time,
           'hora_fim', (agora + interval '150 minutes')::time, 'titulo', 'Banca externa'));
    n0 := (select count(*) from notificacoes where registro = 47);
    insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
    values ('Ensaio da apresentação', agora::date, (agora + interval '100 minutes')::time, (agora + interval '130 minutes')::time, v_aud, 47) returning id into v_ev;
    perform ok((select count(*) from notificacoes where registro = 47) = n0 + 1, 'quem cria o evento em conflito é avisado');
    update eventos set titulo = 'Ensaio da apresentação final' where id = v_ev;
    perform ok((select count(*) from notificacoes where registro = 47) = n0 + 1, 'editar sem mudar o horário não repete o aviso');
    perform ok(public.labbio_reserva_cancelar((r->>'id')::uuid)->>'status' = 'ok', 'o LABBIO cancela a reserva');
  end if;

  raise notice 'A reserva do LABBIO ocupa a sala no tablet e no celular';
  delete from eventos where titulo = 'Reunião de projeto';
  perform eu(42, 'leitura');
  r := public.sala_painel(v_sala);
  perform ok(r->'sala'->>'estado' = 'evento' and r->'sala'->'evento'->>'origem' = 'labbio' and r->'sala'->'evento'->>'organizador' = 'Prof. Helena',
    'a sala aparece em uso pela reserva do LABBIO, com o responsável');
  perform ok(public.sala_ocupar_membro(v_sala, 30)->>'status' = 'em_evento', 'e não dá para ocupar por cima');
end $$;
\echo Tudo certo.
