\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: reporte por liderança direta.
-- Rode depois dos testes da 2.18.0 e da 2.19.0, no mesmo banco:
--   bash testes/preparar-base.sh teste t2191r 2.18.0_soma.sql 2.19.0.sql 2.19.1_reporte.sql
-- Aplica a migração duas vezes e roda de novo o teste da 2.18.0 do reporte
-- (o modelo por frente continua funcionando).
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_reporte.sql
\i 2.19.1_reporte.sql

-- o cenário: Hugo (42) e Iara (43, em NRO_MANAGERS, abaixo de NRO_LEADERSHIP) são lideranças
insert into grupos (nome, prefixo, ordem) values ('NRO_PMO', 'PMO', 6), ('NRO_COORD_OFFICE', 'NCO', 7) on conflict (nome) do nothing;
update membros set gestor_registro = 42 where registro in (47, 23);
update membros set gestor_registro = 4 where registro in (11, 17, 31, 40, 41);
update reporte_config set modelo_lider_desde = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date where id;
delete from reporte_ciclos c where semana = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date
   and not exists (select 1 from reportes r where r.ciclo_id = c.id);

do $$
declare r jsonb; v_id uuid; v_ciclo uuid; v_ver integer; ap jsonb; s text;
begin
  raise notice 'Configuração';
  perform ok((select dia_prazo = 4 and hora_prazo = '16:00' from reporte_config where id), 'o prazo é sexta, 16h (a reunião da gerência)');
  perform ok(public.grupo_por_nome('nro_pmo') is not null and public.grupo_por_nome('NRO_PESSOAL') is not null, 'os grupos se acham pelo nome');

  raise notice 'Quem reporta';
  perform eu(11, 'leitura');
  perform ok(public.reporte_meu()->>'status' = 'sem_permissao', 'quem não é liderança não tem reporte');
  perform ok(public.reporte_cobranca_estado()->>'status' = 'nenhuma', 'nem cobrança');
  perform eu(43, 'leitura');
  perform ok(public.reporte_sou_lider(), 'NRO_MANAGERS herda a liderança de NRO_LEADERSHIP');

  raise notice 'Um reporte por líder e semana, com os liderados diretos';
  perform eu(42, 'leitura');
  r := public.reporte_meu();
  perform ok(r->>'status' = 'ok' and r->'ciclo'->>'modelo' = 'lider', 'abre o reporte da semana, no modelo novo');
  v_id := (r->'reporte'->>'id')::uuid; v_ciclo := (r->'ciclo'->>'id')::uuid; v_ver := (r->'reporte'->>'versao')::integer;
  perform ok((select array_agg((p->>'registro')::integer order by (p->>'registro')::integer) from jsonb_array_elements(r->'reporte'->'pessoas') p) = '{23,47}',
    'a lista é a dos liderados diretos (gestor_registro), não a dos grupos');
  perform ok((select bool_and(a->>'entregas' = 'SUFICIENTE' and a->>'assiduidade' = 'SUFICIENTE') from jsonb_array_elements(r->'reporte'->'apontamentos') a),
    'suficiente por padrão');
  perform ok((public.reporte_meu()->'reporte'->>'id')::uuid = v_id, 'abrir de novo devolve o mesmo reporte');
  perform ok(r->'mudancas' = 'null'::jsonb or r->'mudancas' is null, 'sem mudança na cadeia');

  raise notice 'Participante excepcional';
  perform ok(public.reporte_participante(v_id, v_ver, 11, '  ', true)->>'status' = 'justificativa_obrigatoria', 'excepcional pede justificativa');
  perform ok(public.reporte_participante(v_id, v_ver, 47, 'já está', true)->>'status' = 'duplicado', 'quem já está não entra de novo');
  perform ok(public.reporte_participante(v_id, v_ver, 42, 'eu', true)->>'status' = 'invalido', 'o próprio líder não entra');
  r := public.reporte_participante(v_id, v_ver, 11, 'Apoia o projeto de sinais neste mês', true);
  perform ok(r->>'status' = 'ok', 'inclui um participante de fora da cadeia');
  v_ver := (r->>'versao')::integer;
  perform ok(public.reporte_participante(v_id, v_ver - 1, 17, 'x', true)->>'status' = 'conflito', 'versão antiga não altera');

  raise notice 'A cadeia muda antes do envio';
  update membros set gestor_registro = 42 where registro = 40;
  r := public.reporte_meu();
  perform ok(r->'mudancas'->'entram'->0->>'registro' = '40', 'mostra quem passou a ser liderado');
  perform ok(jsonb_array_length(r->'reporte'->'pessoas') = 3, 'sem trocar a lista sozinho');
  r := public.reporte_cadeia_atualizar(v_id, v_ver);
  perform ok(r->>'status' = 'ok', 'o líder aceita a cadeia atual');
  v_ver := (r->>'versao')::integer;
  r := public.reporte_meu();
  perform ok(jsonb_array_length(r->'reporte'->'pessoas') = 4 and r->'mudancas' is null or r->'mudancas' = 'null'::jsonb,
    'entra quem chegou, e o excepcional continua');
  perform ok(jsonb_array_length(r->'reporte'->'pessoas') = 4, 'quatro pessoas: 23, 47, 11 (excepcional) e 40');

  raise notice 'Salvar';
  ap := jsonb_build_array(
    jsonb_build_object('registro', 23, 'entregas', 'INSUFICIENTE', 'assiduidade', 'SUFICIENTE',
                       'sinalizacao', jsonb_build_object('relato', 'Combinamos a entrega do relatório na terça e não veio', 'conversa_confirmada', false)),
    jsonb_build_object('registro', 47, 'entregas', 'SUFICIENTE', 'assiduidade', 'INSUFICIENTE', 'sinalizacao', null),
    jsonb_build_object('registro', 11, 'entregas', 'SUFICIENTE', 'assiduidade', 'SUFICIENTE', 'sinalizacao', null),
    jsonb_build_object('registro', 40, 'entregas', 'SUFICIENTE', 'assiduidade', 'SUFICIENTE', 'sinalizacao', null));
  r := public.reporte_salvar(jsonb_build_object('id', v_id, 'versao', v_ver, 'etapa', 3, 'apontamentos', ap,
         'escalonamentos', '[{"texto":"Falta verba para a bancada"}]'::jsonb, 'feed', '[]'::jsonb));
  perform ok(r->>'status' = 'invalido', 'sinalizar exige confirmar a conversa');
  ap := jsonb_set(ap, '{0,sinalizacao,conversa_confirmada}', 'true');
  r := public.reporte_salvar(jsonb_build_object('id', v_id, 'versao', v_ver, 'etapa', 3,
         'apontamentos', ap || '[{"registro":31,"entregas":"SUFICIENTE","assiduidade":"SUFICIENTE"}]'::jsonb,
         'escalonamentos', '[]'::jsonb, 'feed', '[]'::jsonb));
  perform ok(r->>'status' = 'invalido', 'não aceita apontamento de quem não está na lista');
  r := public.reporte_salvar(jsonb_build_object('id', v_id, 'versao', v_ver, 'etapa', 3, 'apontamentos', ap,
         'escalonamentos', '[{"texto":"Falta verba para a bancada"}]'::jsonb,
         'feed', '[{"titulo":"Bancada pronta","subtitulo":"O ensaio da órtese começa","texto":""}]'::jsonb));
  perform ok(r->>'status' = 'ok', 'salva as três etapas');
  v_ver := (r->>'versao')::integer;
  perform ok(not exists (select 1 from reporte_sinalizacoes where reporte_id = v_id), 'rascunho não cria sinalização');
  perform ok(not exists (select 1 from membro_reporte_avaliacoes where reporte_id = v_id), 'nem vai à ficha');

  raise notice 'Cobrança de sexta';
  update reporte_ciclos set prazo = now() + interval '1 minute' where id = v_ciclo;
  s := public.reporte_cobranca_estado()->>'status';
  perform ok(s = case when (now() at time zone 'America/Sao_Paulo')::time >= '07:00' then 'aviso' else 'nenhuma' end,
    'antes das 16h: aviso (a partir das 7h)');
  update reporte_ciclos set prazo = now() - interval '1 hour' where id = v_ciclo;
  perform ok(public.reporte_cobranca_estado()->>'status' = 'obrigatoria', 'depois das 16h: obrigatória');
  perform eu(43, 'leitura');
  insert into agenda_ausencias (registro, tipo, inicio, fim) values (43, 'ferias', now() - interval '3 days', now() + interval '3 days');
  perform ok(public.reporte_cobranca_estado()->>'motivo' = 'ausencia', 'de férias no prazo, não é cobrado');
  delete from agenda_ausencias where registro = 43;
  perform ok(public.reporte_cobranca_estado()->>'status' = 'obrigatoria', 'sem férias, é');
  perform ok(public.reporte_ausente(v_ciclo)->>'status' = 'ok', '"estive ausente" resolve');
  perform ok(public.reporte_cobranca_estado()->>'status' = 'nenhuma', 'e a cobrança some');
  perform ok(not exists (select 1 from membro_reporte_avaliacoes where autor = 43), 'sem avaliação fictícia');

  raise notice 'Enviar depois das 16h';
  perform eu(42, 'leitura');
  r := public.reporte_enviar(v_id, v_ver);
  perform ok(r->>'status' = 'ok' and (r->>'atrasado')::boolean, 'o envio depois das 16h é aceito, marcado como atrasado');
  perform ok(public.reporte_enviar(v_id, v_ver)->>'status' = 'ok', 'envio idempotente');
  perform ok((select count(*) from membro_reporte_avaliacoes where reporte_id = v_id) = 4, 'as quatro avaliações vão à ficha, uma vez');
  perform ok((select origem from membro_reporte_avaliacoes where reporte_id = v_id and registro = 11) = 'excepcional', 'com a origem');
  perform ok(public.reporte_cobranca_estado()->>'status' = 'nenhuma', 'enviar resolve a cobrança');
  perform ok((select efeito from reporte_sinalizacoes where reporte_id = v_id and registro = 23) = 'pmo', 'a sinalização abre o acompanhamento no PMO');
  perform ok((select count(*) from atividades where grupo_id = public.grupo_por_nome('NRO_PMO') and titulo like '%Diego%') = 1, 'um card no NRO_PMO');
  perform ok(public.reporte_salvar(jsonb_build_object('id', v_id, 'versao', v_ver + 1))->>'status' = 'encerrado', 'enviado não é editável');
  perform ok((select publicado_em is not null from feed_itens where reporte_id = v_id), 'o feed segue publicado no envio (até o pacote de publicação)');

  raise notice 'Mudança de gestor depois do envio';
  update membros set gestor_registro = 4 where registro = 47;
  r := public.reporte_meu();
  perform ok(jsonb_array_length(r->'reporte'->'pessoas') = 4 and (r->'mudancas' is null or r->'mudancas' = 'null'::jsonb),
    'o reporte enviado não é reescrito');

  raise notice 'Ficha e consolidado';
  perform eu(11, 'leitura');
  perform ok(public.reporte_avaliacoes_de(23)->>'status' = 'sem_permissao', 'membro comum não lê avaliações');
  perform ok(public.reporte_unificado(v_ciclo)->>'status' = 'sem_permissao', 'nem o consolidado');
  perform eu(42, 'leitura');
  perform ok(jsonb_array_length(public.reporte_avaliacoes_de(23)->'itens') = 1, 'a liderança lê o histórico na ficha');
  perform ok(public.reporte_unificado(v_ciclo)->>'status' = 'sem_permissao', 'liderança fora de NRO_MANAGERS não gera o consolidado');
  perform eu(43, 'leitura');
  r := public.reporte_unificado(v_ciclo);
  perform ok(r->>'status' = 'ok' and r->>'modelo' = 'lider', 'NRO_MANAGERS gera o consolidado');
  perform ok((select array_agg((a->>'registro')::integer order by (a->>'registro')::integer) from jsonb_array_elements(r->'apontamentos') a) = '{23,47}',
    'o consolidado traz quem teve insuficiência, com ou sem sinalização');
  perform ok((r->'cobertura'->>'enviados')::integer = 1 and (r->'cobertura'->>'ausentes')::integer = 1
    and (r->'cobertura'->>'atrasados')::integer = 1, 'a cobertura: enviados, atrasados e ausentes');
  perform ok(jsonb_array_length(r->'escalonamentos') = 1 and jsonb_array_length(r->'feed') = 1, 'escalonamentos e divulgação');

  raise notice 'Fechamento';
  update reporte_ciclos set fecha_em = now() - interval '1 minute' where id = v_ciclo;
  perform eu(43, 'leitura');
  r := public.reporte_meu(v_ciclo);
  perform ok(r->>'status' = 'ok' and r->'reporte' = 'null'::jsonb, 'com a sprint seguinte aberta, não se abre reporte novo do ciclo');
  perform ok(public.reporte_cobranca_estado()->>'status' = 'nenhuma', 'e não há cobrança');
end $$;

-- as janelas de 30 e 60 dias, com reportes em ciclos passados
do $$
declare base timestamptz := now() - interval '200 days'; c uuid; r uuid; k integer := 0; s text;
begin
  raise notice 'Reincidência (dias 0, 7, 31, 60 e 61)';
  create temp table _rep (dia integer, autor integer, reporte uuid) on commit drop;
  foreach k in array array[0, 7, 31, 60, 61, 90] loop
    insert into reporte_ciclos (semana, prazo, reuniao_em, fecha_em, modelo)
    values ((base + k * interval '1 day')::date, base + k * interval '1 day', base + k * interval '1 day',
            base + (k + 3) * interval '1 day', 'lider')
    on conflict (semana) do nothing returning id into c;
    if c is null then select id into c from reporte_ciclos where semana = (base + k * interval '1 day')::date; end if;
    foreach s in array array['42', '43'] loop
      insert into reportes (ciclo_id, autor, modelo, pessoas, etapa) values (c, s::integer, 'lider', '[]', 3) returning id into r;
      insert into _rep values (k, s::integer, r);
    end loop;
  end loop;

  -- Bruno (11): dia 0 → PMO; dia 7 → offboarding; dia 31 → só histórico
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 0 and autor = 42), 11, 'atraso', base) = 'pmo', 'dia 0: PMO');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 0 and autor = 42), 11, 'atraso', base) = 'repetido', 'o mesmo envio de novo não conta');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 7 and autor = 42), 11, 'faltou', base + interval '7 days') = 'offboarding', 'dia 7: offboarding');
  perform ok((select count(*) from atividades where origem_tipo = 'reporte' and origem_id like 'seq:%:offboarding:%'
               and origem_id like 'seq:' || (select id from reporte_sequencias where registro = 11) || '%') = 2,
    'dois cards: NRO_PESSOAL e NRO_COORD_OFFICE');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 31 and autor = 42), 11, 'de novo', base + interval '31 days') = 'historico',
    'offboarding já aberto: só histórico, sem card novo');
  perform ok((select count(*) from atividade_comentarios c join atividades a on a.id = c.atividade_id
               where a.origem_id like 'seq:%:offboarding:%' and c.corpo like 'Nova sinalização%') = 2, 'o histórico vai aos dois cards');

  -- Carla (17): 0 e 31 → offboarding; Elis (31): 0 e 60 → offboarding (limite inclusivo)
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 0 and autor = 42), 17, 'a', base) = 'pmo', 'Carla, dia 0: PMO');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 31 and autor = 42), 17, 'b', base + interval '31 days') = 'offboarding', 'dia 31: offboarding');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 0 and autor = 42), 31, 'a', base) = 'pmo', 'Elis, dia 0: PMO');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 60 and autor = 42), 31, 'b', base + interval '60 days') = 'offboarding', 'dia 60: offboarding (inclusive)');

  -- Fábio (40): 0 e 61 → novo acompanhamento
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 0 and autor = 42), 40, 'a', base) = 'pmo', 'Fábio, dia 0: PMO');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 61 and autor = 42), 40, 'b', base + interval '61 days') = 'pmo', 'dia 61: começa um acompanhamento novo');
  perform ok((select count(*) from reporte_sequencias where registro = 40) = 2, 'duas sequências');

  -- Gabi (41): dois líderes no mesmo ciclo contam uma vez
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 90 and autor = 42), 41, 'x', base + interval '90 days') = 'pmo', 'Gabi, pelo Hugo: PMO');
  perform ok(public.reporte_sinalizacao_processar((select reporte from _rep where dia = 90 and autor = 43), 41, 'y', base + interval '90 days') = 'historico',
    'pela Iara, no mesmo ciclo: registrada, mas não conta como reincidência');
  perform ok((select count(*) from reporte_sinalizacoes where registro = 41) = 2 and (select count(*) from reporte_sinalizacoes where registro = 41 and contavel) = 1,
    'os dois relatos ficam guardados');
end $$;

-- sem acesso direto
set role authenticated;
do $$ begin
  begin
    perform public.reporte_sinalizacao_processar(gen_random_uuid(), 11, 'x');
    raise exception 'FALHOU: a conta comum chamou o processamento interno';
  exception when insufficient_privilege then perform ok(true, 'o processamento interno não é chamável pela API');
  end;
  begin
    perform count(*) from public.reporte_sinalizacoes;
    raise exception 'FALHOU: a tabela de sinalizações é legível pela API';
  exception when insufficient_privilege then perform ok(true, 'as tabelas novas não são legíveis pela API');
  end;
end $$;
reset role;

\echo 'O modelo por frente (2.18.0) continua (com a ativação adiada):'
update reporte_config set modelo_lider_desde = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7 where id;
update feed_itens set oculto = true;   -- o teste antigo conta o feed a partir de zero
\i testes/2.18.0_reporte.sql
\echo 'Tudo certo.'
