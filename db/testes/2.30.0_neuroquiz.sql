\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.30.0: o NeuroQuiz no ritmo da festa.
-- Rode depois do teste da 2.29.0, no mesmo banco:
--   bash testes/preparar-base.sh teste t230 2.18.0_soma.sql 2.29.0_neuroquiz.sql 2.30.0_neuroquiz.sql
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- antes: uma pergunta com os 20 s antigos e uma com 10 s
do $$ begin
  perform set_config('teste.uid', '00000000-0000-0000-0000-000000000090', false);
  perform quiz_pergunta_salvar('{"texto":"Vinte?","tempo_s":20,"alternativas":[{"texto":"sim","correta":true},{"texto":"não"}]}');
  perform quiz_pergunta_salvar('{"texto":"Dez?","tempo_s":10,"alternativas":[{"texto":"sim","correta":true},{"texto":"não"}]}');
end $$;

\ir ../2.30.0_neuroquiz_ritmo.sql

do $$ declare r jsonb; v_ed uuid[]; v_a uuid[]; v_b uuid[]; v_c uuid[]; v_sid uuid; begin
  raise notice 'O tempo padrão';
  perform ok((select tempo_s from quiz_perguntas where texto = 'Vinte?') = 8, 'a pergunta com os 20 s antigos passa a 8');
  perform ok((select tempo_s from quiz_perguntas where texto = 'Dez?') = 10, 'a de 10 s fica como estava');
  perform ok(not exists (select 1 from quiz_perguntas where tempo_s = 20), 'nenhuma ficou com 20 s');
  perform set_config('teste.uid', '00000000-0000-0000-0000-000000000090', false);
  r := quiz_pergunta_salvar('{"texto":"Sem tempo?","alternativas":[{"texto":"sim","correta":true},{"texto":"não"}]}');
  perform ok((select tempo_s from quiz_perguntas where id = (r->>'id')::uuid) = 8, 'pergunta nova sem tempo: 8 s');

  raise notice 'A ordem aleatória';
  update quiz_perguntas set ativa = false where true;
  for i in 1..12 loop
    perform quiz_pergunta_salvar(jsonb_build_object('texto', 'Ordem ' || i, 'alternativas', '[{"texto":"a","correta":true},{"texto":"b"}]'::jsonb));
  end loop;
  v_ed := array(select id from quiz_perguntas where ativa order by ordem, criado_em);
  perform quiz_sessao_encerrar(id) from quiz_sessoes where fase <> 'fim';
  v_sid := (quiz_sessao_criar('{"aleatoria":false}')->>'id')::uuid;
  v_a := array(select pergunta_id from quiz_rodadas where sessao_id = v_sid order by ordem);
  perform ok(v_a = v_ed and not (select aleatoria from quiz_sessoes where id = v_sid), 'desligada: a ordem do editor');
  perform quiz_sessao_encerrar(v_sid);
  v_sid := (quiz_sessao_criar('{}')->>'id')::uuid;
  v_b := array(select pergunta_id from quiz_rodadas where sessao_id = v_sid order by ordem);
  perform quiz_sessao_encerrar(v_sid);
  v_sid := (quiz_sessao_criar('{}')->>'id')::uuid;
  v_c := array(select pergunta_id from quiz_rodadas where sessao_id = v_sid order by ordem);
  perform ok((select aleatoria from quiz_sessoes where id = v_sid), 'o padrão é aleatória');
  perform ok(v_b <> v_ed or v_c <> v_ed, 'aleatória: a ordem muda (as duas iguais ao editor: 1 em 479 milhões)');
  perform ok((select array_agg(x order by x) from unnest(v_b) x) = (select array_agg(x order by x) from unnest(v_ed) x)
             and cardinality(v_c) = 12, 'as mesmas 12 perguntas, sem repetir nem faltar');
  perform ok((select array_agg(ordem order by ordem) from quiz_rodadas where sessao_id = v_sid) = array(select generate_series(1, 12)),
             'rodadas numeradas de 1 a 12');

  raise notice 'O avanço sozinho';
  perform ok((select intervalo_s from quiz_sessoes where id = v_sid) = 5, 'o intervalo padrão é 5 s');
  r := quiz_tv(v_sid);
  perform ok((r->'sessao'->>'intervalo_s')::int = 5 and r->'sessao' ? 'mudou_em' and (r->'sessao'->>'aleatoria')::boolean,
             'a TV recebe o intervalo, a ordem e a hora em que a fase começou');
  perform quiz_sessao_encerrar(v_sid);
  perform ok(quiz_sessao_criar('{"intervalo_s":0}')->>'status' = 'ok', 'intervalo 0: só no espaço');
  perform ok(quiz_sessao_criar('{"intervalo_s":61}')->>'campo' = 'intervalo_s', 'mais de 60 s não');
  perform quiz_sessao_encerrar(id) from quiz_sessoes where fase <> 'fim';
  perform set_config('teste.uid', '00000000-0000-0000-0000-000000000091', false);
  perform ok(quiz_sessao_criar('{}')->>'status' = 'sem_permissao', 'quem só joga continua sem criar partida');
end $$;

\ir ../2.30.0_neuroquiz_ritmo.sql
do $$ begin
  perform ok((select count(*) from migracoes where id = '2.30.0_neuroquiz_ritmo') = 1, 'de novo: a linha em migracoes, nada se repete');
  perform ok((select tempo_s from quiz_perguntas where texto = 'Dez?') = 10, 'e o tempo que alguém pôs não volta a mudar');
end $$;
\echo '2.30.0: tudo certo'
