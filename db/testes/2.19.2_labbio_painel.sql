\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.2_labbio_painel: o início do painel do LABBIO como
-- dashboard. Rode por último na cadeia da 2.19.2 (depois das salas).
-- ============================================================
\i 2.19.2_labbio_painel.sql
\i 2.19.2_labbio_painel.sql

do $$
declare r jsonb; r2 jsonb; v_reg integer; v_sala integer; v_e uuid; v_sol uuid; v_ped uuid;
        v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  raise notice 'Quem vê';
  perform eu(11, 'leitura');
  perform ok(public.labbio_inicio()->>'status' = 'sem_permissao', 'membro comum não vê o início do painel');
  perform eu(4, 'admin');
  r := public.labbio_inicio();
  perform ok(r->>'status' = 'ok', 'o admin do SOMA vê');
  perform ok(r ? 'membros' and r ? 'com_acesso' and r ? 'pedidos_abertos' and jsonb_typeof(r->'revogacoes') = 'array',
    'os campos de antes continuam');
  perform ok(jsonb_array_length(r->'serie') = 14 and (r->'serie'->13->>'dia')::date = v_hoje, 'a série tem os 14 dias, até hoje');
  perform ok((r->'acesso'->>'possui')::int + (r->'acesso'->>'solicitado')::int + (r->'acesso'->>'nao_possui')::int = (r->>'membros')::int,
    'a biometria soma os membros ativos');

  raise notice 'Presença de hoje';
  select registro into v_reg from membros m where status = 'Ativo'
     and not exists (select 1 from presencas p where p.registro = m.registro and (p.registrado_em at time zone 'America/Sao_Paulo')::date = v_hoje)
   order by registro limit 1;
  insert into presencas (registro, registrado_em, origem) values (v_reg, now(), 'folha'), (v_reg, now() - interval '1 minute', null);
  r2 := public.labbio_inicio();
  perform ok((r2->'hoje'->>'presentes')::int = (r->'hoje'->>'presentes')::int + 1, 'duas presenças da mesma pessoa contam uma vez');
  perform ok((r2->'hoje'->'ultimos'->0->>'registro')::int = v_reg, 'quem chegou por último vem primeiro');
  perform ok((r2->'serie'->13->>'pessoas')::int = (r2->'hoje'->>'presentes')::int, 'o último dia da série é hoje');
  perform ok(not (r2->'hoje'->'ultimos'->0 ? 'email_pessoal') and not (r2->'hoje'->'ultimos'->0 ? 'cpf'), 'só nome e foto');

  raise notice 'Consultas de sala e eventos de hoje';
  select id into v_sala from espacos where consulta_labbio order by id limit 1;
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
  values ('Banca do painel', v_hoje + 1, '09:00', '10:00', v_sala, 42) returning id into v_e;
  insert into eventos (titulo, data, hora_inicio, hora_fim, espaco_id, owner_registro)
  values ('Reunião de hoje', v_hoje, '23:00', '23:30', v_sala, 42);
  r2 := public.labbio_inicio();
  perform ok((r2->>'consultas_pendentes')::int >= (r->>'consultas_pendentes')::int + 1, 'a consulta nova conta como pendente');
  perform ok(exists (select 1 from jsonb_array_elements(r2->'consultas') x where (x->>'evento_id')::uuid = v_e), 'e aparece na lista');
  perform ok(exists (select 1 from jsonb_array_elements(r2->'hoje'->'eventos') x where x->>'titulo' = 'Reunião de hoje' and x->>'consulta' = 'pendente'),
    'o evento de hoje aparece, com a situação da consulta');
  update eventos set status = 'Cancelado' where id = v_e;
  perform ok(not exists (select 1 from jsonb_array_elements(public.labbio_inicio()->'consultas') x where (x->>'evento_id')::uuid = v_e),
    'evento cancelado sai da lista');

  raise notice 'Pedidos no LABBIO';
  insert into portal_solicitacoes (registro, tipo, titulo, dados)
  values (v_reg, 'acesso', 'Acesso biométrico ao LABBIO', jsonb_build_object('item_id', labbio_item_biometria())) returning id into v_sol;
  update labbio_pedidos set etapa = 'cancelado' where registro = v_reg and etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido');
  insert into labbio_pedidos (registro, solicitacao_id, etapa, justificativa, tempo, encaminhado_em)
  values (v_reg, v_sol, 'labbio', 'Ensaios na bancada', 'Um mês', now() - interval '3 days') returning id into v_ped;
  r2 := public.labbio_inicio();
  perform ok((r2->>'pedidos_abertos')::int = jsonb_array_length(r2->'pedidos') or jsonb_array_length(r2->'pedidos') = 6, 'a lista acompanha o total (até 6)');
  perform ok(exists (select 1 from jsonb_array_elements(r2->'pedidos') x where (x->>'id')::uuid = v_ped), 'o pedido encaminhado aparece');
  perform ok((select bool_and((a->>'encaminhado_em') <= (b->>'encaminhado_em')) from jsonb_array_elements(r2->'pedidos') with ordinality a(a, i)
               join jsonb_array_elements(r2->'pedidos') with ordinality b(b, j) on j = i + 1) is not false, 'do mais antigo para o mais novo');
  update labbio_pedidos set etapa = 'cancelado' where id = v_ped;
end $$;
\echo Tudo certo.
