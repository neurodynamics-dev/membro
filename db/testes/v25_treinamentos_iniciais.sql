\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 25.0 — os primeiros treinamentos.
-- Rode num banco com o esqueleto, a 15.0 a 19.0 e a 24.0 (a 20.0
-- é opcional), e ainda sem a 25.0: o teste prepara um NRO-TRE-003
-- que a semente precisa respeitar e roda a 25.0 no meio — e de
-- novo, duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function tre(p_codigo text) returns uuid language sql as $$
  select id from treinamentos where codigo = p_codigo $$;
create or replace function rasc(p_codigo text) returns jsonb language sql as $$
  select r.conteudo from treinamento_revisoes r join treinamentos t on t.id = r.treinamento_id
   where t.codigo = p_codigo and r.status = 'rascunho' $$;
create or replace function marcas(c jsonb, p_rx text) returns integer language sql as $$
  select count(*)::integer from jsonb_array_elements(c->'modulos') m, regexp_matches(m->>'corpo', p_rx, 'g') $$;

-- 1. alguém já criou um NRO-TRE-003 antes da semente
do $$ begin
  perform ok(to_regclass('public.treinamentos') is not null, 'a 24.0 está aplicada');
  perform ok((select count(*) from migracoes where id = 'v25_treinamentos_iniciais') = 0, 'a 25.0 ainda não rodou');
  insert into treinamentos (numero, titulo, categoria) values (3, 'Documentação — o nosso', 'Projetos');
  insert into treinamento_revisoes (treinamento_id, conteudo)
  values (tre('NRO-TRE-003'), '{"modulos":[{"id":"m1","titulo":"Nosso","corpo":"O que já estava."}]}');
end $$;

\ir ../v25_treinamentos_iniciais.sql

-- 2. o que nasceu
do $$ declare c text; begin
  perform ok((select count(*) from treinamentos where numero between 1 and 6) = 6, 'os seis números existem');
  perform ok((select titulo from treinamentos where codigo = 'NRO-TRE-003') = 'Documentação — o nosso',
             'o NRO-TRE-003 que já existia ficou como estava');
  perform ok(rasc('NRO-TRE-003')->'modulos'->0->>'corpo' = 'O que já estava.', 'e o rascunho dele também');
  perform ok((select resultado from tre_semente where codigo = 'NRO-TRE-003') like 'o número já é de "Documentação — o nosso"%',
             'a tabela do fim diz que o número já era de outro');
  perform ok((select count(*) from tre_semente where resultado = 'criado em rascunho') = 5, 'os outros cinco, criados');

  foreach c in array array['NRO-TRE-001','NRO-TRE-002','NRO-TRE-004','NRO-TRE-005','NRO-TRE-006'] loop
    perform ok((select status = 'rascunho' and revisao_atual is null from treinamentos where codigo = c),
               c || ': rascunho, nunca publicado');
    perform ok((select count(*) from treinamento_revisoes where treinamento_id = tre(c)) = 1
               and (select notas from treinamento_revisoes where treinamento_id = tre(c)) = 'Versão inicial, da semente 25.0.',
               c || ': uma revisão só, a de rascunho');
    perform ok(coalesce(array_length(treinamento_problemas(rasc(c)), 1), 0) = 0,
               c || ': a estrutura passa na conferência do banco (ids, tipos, gabarito)');
    perform ok((select bool_and(jsonb_array_length(m->'verificacao'->'questoes') >= 2)
                  from jsonb_array_elements(rasc(c)->'modulos') m),
               c || ': todo módulo tem verificação, com duas questões ou mais');
    perform ok(treinamento_sem_gabarito(rasc(c))::text not like '%"correta"%'
               and treinamento_sem_gabarito(rasc(c))::text not like '%"explicacao"%',
               c || ': o que desce para quem faz não leva o gabarito');
  end loop;

  perform ok((select titulo from treinamentos where codigo = 'NRO-TRE-001') = 'Introdução ao SOMA', 'NRO-TRE-001 é a introdução');
  perform ok(jsonb_array_length(rasc('NRO-TRE-001')->'modulos') = 4, 'a introdução tem quatro módulos');
  perform ok(jsonb_array_length(rasc('NRO-TRE-006')->'modulos') = 6, 'gestão de projetos tem seis');
  perform ok((select nota_minima = 80 and validade_meses = 12 and categoria = 'Segurança'
                from treinamentos where codigo = 'NRO-TRE-005'),
             'confidencialidade: nota 80, vence em 12 meses, categoria Segurança');
  perform ok((select validade_meses is null and nota_minima is null from treinamentos where codigo = 'NRO-TRE-002'),
             'os demais seguem a nota padrão e não vencem');
  perform ok((select sum(carga_horaria_min) from treinamentos where codigo in ('NRO-TRE-001','NRO-TRE-002','NRO-TRE-004','NRO-TRE-005','NRO-TRE-006')) = 270,
             'a carga horária veio do cabeçalho de cada um');

  perform ok(marcas(rasc('NRO-TRE-002'), '\[V[ÍI]DEO A GRAVAR[^]]*\]') = 4, 'os quatro vídeos a gravar da agenda estão marcados');
  perform ok(marcas(rasc('NRO-TRE-002'), '\[CONFIRMAR[^]]*\]') = 1, 'e o ponto a confirmar também');
  perform ok(rasc('NRO-TRE-005')::text like '%gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC%',
             'confidencialidade cita as cartilhas do PNPC');

  perform ok((select count(*) from treinamento_atribuicoes) = 0, 'nada foi atribuído');
  perform ok((select count(*) from notificacoes where tipo = 'treinamento') = 0, 'ninguém foi avisado');
  perform ok((select count(*) from migracoes where id = 'v25_treinamentos_iniciais') = 1, 'a migração registrada');
end $$;

-- 3. quem gere edita um rascunho; o que já estava some; a semente roda de novo
create temp table antes as
  select t.codigo, t.id, r.id as rev_id from treinamentos t join treinamento_revisoes r on r.treinamento_id = t.id;
do $$ begin
  update treinamento_revisoes set conteudo = jsonb_set(conteudo, '{modulos,0,titulo}', '"Editado na tela"')
   where treinamento_id = tre('NRO-TRE-001');
  delete from treinamentos where codigo = 'NRO-TRE-003';
end $$;

\ir ../v25_treinamentos_iniciais.sql

do $$ begin
  perform ok((select count(*) from treinamentos where numero between 1 and 6) = 6, 'continuam seis');
  perform ok(rasc('NRO-TRE-001')->'modulos'->0->>'titulo' = 'Editado na tela', 'o rascunho editado não foi sobrescrito');
  perform ok((select count(*) from antes a join treinamento_revisoes r on r.id = a.rev_id where a.codigo <> 'NRO-TRE-003') = 5,
             'as revisões que já existiam são as mesmas');
  perform ok((select titulo from treinamentos where codigo = 'NRO-TRE-003') = 'ISO 9001: documentação e o sistema de Arquivos',
             'o NRO-TRE-003 livre agora é o de documentação');
  perform ok(coalesce(array_length(treinamento_problemas(rasc('NRO-TRE-003')), 1), 0) = 0, 'e passa na conferência');
  perform ok((select resultado from tre_semente where codigo = 'NRO-TRE-003') = 'criado em rascunho'
             and (select resultado from tre_semente where codigo = 'NRO-TRE-001') = 'já existia — ficou como está',
             'a tabela do fim conta o que fez desta vez');
end $$;

\ir ../v25_treinamentos_iniciais.sql

do $$ begin
  perform ok((select count(*) from treinamentos) = 6 and (select count(*) from treinamento_revisoes) = 6,
             'rodar de novo não cria nada');
  perform ok((select count(*) from migracoes where id = 'v25_treinamentos_iniciais') = 1, 'a migração registrada uma vez só');
end $$;

-- 4. publicado, o treinamento se faz com o gabarito que o .md marcou
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
end $$;
create or replace function certas(c jsonb, p_mod text) returns jsonb language sql as $$
  select jsonb_object_agg(q->>'id', case when q->>'tipo' = 'vf'
      then (select jsonb_object_agg(o->>'id', coalesce((o->>'correta')::boolean, false)) from jsonb_array_elements(q->'opcoes') o)
      else (select coalesce(jsonb_agg(o->>'id'), '[]'::jsonb) from jsonb_array_elements(q->'opcoes') o
             where coalesce((o->>'correta')::boolean, false)) end)
    from jsonb_array_elements(c->'modulos') m, jsonb_array_elements(m->'verificacao'->'questoes') q
   where m->>'id' = p_mod $$;
do $$ declare r jsonb; m jsonb; c jsonb := rasc('NRO-TRE-005'); n integer := 0; begin
  perform eu(4, 'admin');
  r := treinamento_publicar(tre('NRO-TRE-005'));
  perform ok(r->>'status' = 'ok' and r->>'revisao' = 'A', 'publicado, o NRO-TRE-005 vira Rev. A');
  perform eu(17, 'leitura');
  r := treinamento_conteudo('NRO-TRE-005');
  perform ok(r::text like '%Conhecimento sensível%' or r::text like '%conhecimento sensível%',
             'quem faz lê o conteúdo publicado');
  perform ok(r::text not like '%"correta"%', 'sem o gabarito');
  r := treinamento_responder(tre('NRO-TRE-005'), c->'modulos'->0->>'id', '{}'::jsonb);
  perform ok((r->>'aprovado')::boolean = false and (r->>'nota_minima')::integer = 80, 'em branco não passa, e a mínima é a 80 do cabeçalho');
  for m in select x from jsonb_array_elements(c->'modulos') x loop
    r := treinamento_responder(tre('NRO-TRE-005'), m->>'id', certas(c, m->>'id'));
    if (r->>'aprovado')::boolean and (r->>'nota')::integer = 100 then n := n + 1; end if;
  end loop;
  perform ok(n = 5, 'as cinco verificações, respondidas pelo gabarito do .md, dão 100');
  perform ok(r->>'certificado' like 'CERT-%', 'e o último módulo dá o certificado');
  perform ok((select revisao = 'A' and carga_horaria_min = 60 and titulo = 'Confidencialidade da informação'
                from treinamento_conclusoes where registro = 17 and codigo = 'NRO-TRE-005'),
             'a conclusão fica no perfil, com a revisão, a carga e o título do cabeçalho');
end $$;

\echo v25_treinamentos_iniciais: tudo certo
