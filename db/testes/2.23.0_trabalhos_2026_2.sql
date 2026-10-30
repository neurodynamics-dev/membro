\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da carga dos trabalhos de 2026/2 (2.23.0_trabalhos_2026_2).
-- Roda depois do teste da 2.23.0, no mesmo banco: ele deixa o TRB-5
-- e o TRB-6 criados pela tela, o que exercita o "já existia".
--   bash testes/preparar-base.sh teste t2232 2.18.0_soma.sql 2.23.0_trabalhos.sql 2.23.0_trabalhos_2026_2.sql
-- Aplica a carga duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function trb_de(p integer) returns trabalhos language sql as $$ select * from trabalhos where numero = p $$;

-- as pessoas das fichas, com os nomes como estão no quadro de pessoal
insert into membros (registro, nome, cargo, status) values
  (70, 'Gabriel Matos Veneziano', 'Supervisor', 'Ativo'),
  (71, 'Matheus Marcondes Lima', 'Diretor', 'Ativo'),
  (72, 'Pedro Henrique Caversan', 'Desenvolvedor', 'Ativo'),
  (73, 'Clévio Ramos', 'Engenheiro', 'Ativo'),
  (74, 'Ana Clara Souza', 'Pesquisadora', 'Ativo'),
  (75, 'Ana Clara Pereira', 'Pesquisadora', 'Ativo'),
  (76, 'Sarah Fernanda Alves', 'Engenheira', 'Ativo'),
  (77, 'Maria Teresa Campos', 'Comunicação', 'Ativo'),
  (78, 'Tiago Morais', 'Comunicação', 'Ativo'),
  (79, 'Nicolas Henrique Prado', 'Engenheiro', 'Desligado')
on conflict (registro) do nothing;
do $$ begin
  perform eu(4, 'admin');
  perform ok(projeto_salvar(jsonb_build_object('codigo','CALIMA','nome','Calima','supervisor',72))->>'status' = 'ok', 'projeto CALIMA');
end $$;
-- o estado que o teste da 2.23.0 deixou
do $$ begin
  perform ok((select referencia from trabalhos where numero = 5) = 'Projeto Calima (firmware)'
             and (select status from trabalhos where numero = 5) = 'em_andamento'
             and (select responsaveis from trabalhos where numero = 5) = '{47}', 'TRB-5 já existe, em andamento, com o Mateus');
  perform ok((select referencia from trabalhos where numero = 6) = 'Estande NRO', 'TRB-6 já existe, com outra referência');
end $$;

\ir ../2.23.0_trabalhos_2026_2.sql

do $$
declare t trabalhos; v_g integer; n integer;
begin
  raise notice 'Os trabalhos';
  perform ok((select count(*) from trabalhos where numero between 1 and 14) = 14, 'TRB-1 a TRB-14 no banco');
  perform ok((select count(*) from trabalhos) = 14, 'e nenhum além deles');
  t := trb_de(1);
  perform ok(t.referencia = 'Projeto Équio (software e firmware)' and t.tipo = 'etapa' and t.ciclo = '2026/2'
             and t.status = 'a_iniciar' and t.complexidade = 3 and t.esforco = 3, 'TRB-1: a ficha');
  perform ok(t.projeto_id = (select id from projetos where codigo = 'EQUIO'), 'TRB-1 ligado ao Équio pelo nome');
  perform ok(t.escopo like 'Implementar o protocolo de tDCS%' and t.escopo like '%| Parte | Tecnologia | Papel no tDCS |%', 'o escopo começa no texto e tem a tabela');
  perform ok(t.dependencias like '%## Regras de segurança na bancada%' and t.dependencias like '%## Material de apoio%', 'regras e material de apoio em dependências');
  perform ok(t.criterios like '%## Ao final do trainee%', 'as metas do trainee em critérios');

  raise notice 'Os responsáveis';
  perform ok(t.responsaveis = '{70}', 'TRB-1: o nome inteiro acha o Gabriel');
  perform ok((trb_de(2)).responsaveis = '{70,71}', 'TRB-2: ficha e planilha somadas; "Matheus Marcondes" acha pelo começo');
  perform ok((trb_de(3)).responsaveis = '{73}', 'TRB-3: o responsável da planilha, quando a ficha diz "a definir"');
  perform ok((trb_de(6)).responsaveis = '{72}', 'TRB-6: "Pedro Caversan" acha as palavras na ordem; "Ana Clara" é ambígua e fica de fora');
  perform ok((trb_de(10)).responsaveis = '{77,78}', 'TRB-10: os dois da planilha');
  perform ok((trb_de(13)).responsaveis = '{}', 'TRB-13: Nicolas está desligado, fica de fora');
  perform ok((select sem_membro from trb_rel where numero = 6) = 'Ana Clara'
             and (select sem_membro from trb_rel where numero = 13) = 'Nicolas Henrique', 'o quadro do fim diz quem ficou de fora');
  select grupo_id into v_g from trabalhos where numero = 1;
  perform ok((select nome from grupos where id = v_g) = 'NRO_TRABALHO_1' and (select prefixo from grupos where id = v_g) = 'T1'
             and (select pai_id from grupos where id = v_g) = grupo_trabalhos() and (select responsaveis from grupos where id = v_g) = '{70}',
             'o grupo do TRB-1, com o responsável');
  perform ok((select grupos from membros where registro = 70) @> '{NRO_TRABALHO_1,NRO_TRABALHO_2}', 'o responsável entra na equipe');
  perform ok((select count(*) from ocorrencias where registro = 70 and descricao in ('NRO_TRABALHO_1','NRO_TRABALHO_2')) = 2, 'com a ocorrência na ficha');
  perform ok((select count(*) from notificacoes where registro = 70 and titulo like 'Você é responsável pelo trabalho TRB-%') = 2, 'e é avisado');

  raise notice 'O que já existia';
  t := trb_de(5);
  perform ok(t.escopo like 'Implementar no firmware do Connect Cycling%' and t.complexidade = 3 and t.esforco = 4, 'TRB-5: a ficha revisada no lugar da antiga');
  perform ok(t.status = 'em_andamento', 'o status fica');
  perform ok(t.responsaveis = '{47,72}', 'os responsáveis somados, os de antes primeiro');
  perform ok(t.projeto_id = (select id from projetos where codigo = 'EQUIO'), 'o projeto que já tinha fica');
  perform ok(jsonb_array_length(t.cenario->'fraquezas') = 3 and t.cenario->'oportunidades' ? 'Concluir de forma integrada (one-for-all) o desenvolvimento do Connect Cycling.',
             'o cenário: os itens da ficha e os da planilha');
  perform ok((trb_de(6)).referencia = 'Projeto Calima (clínica: compensação de latência)', 'TRB-6: a referência nova');
  perform ok((select situacao from trb_rel where numero = 5) = 'já existia: ficha revisada'
             and (select responsaveis from trb_rel where numero = 5) = 'Mateus Cruz, Pedro Henrique Caversan'
             and (select projeto from trb_rel where numero = 5) = 'Équio', 'o quadro mostra o trabalho como ficou');

  raise notice 'As etapas como cartões';
  select grupo_id into v_g from trabalhos where numero = 1;
  perform ok((select string_agg(codigo, ',' order by seq) from atividades where grupo_id = v_g) = 'T1-1,T1-2,T1-3,T1-4,T1-5,T1-6,T1-7,T1-8', 'TRB-1: T1-1 a T1-8');
  perform ok((select count(*) from atividades where grupo_id = v_g and status = 'a_fazer' and etiquetas = '{"Escopo do trainee"}') = 4
             and (select count(*) from atividades where grupo_id = v_g and status = 'backlog' and etiquetas = '{"Depois do trainee"}') = 4,
             'as do trainee em A fazer, as de depois em Backlog');
  perform ok((select descricao from atividades where codigo = 'T1-3') like E'Fazer os dados%\n\n**Firmware**\n\n- Implementar no ESP32%'
             and (select descricao from atividades where codigo = 'T1-3') like '%**Entregável:** comunicação implementada%', 'a descrição em Markdown, com o entregável');
  perform ok((select criado_por from atividades where codigo = 'T1-1') = 70, 'criado pelo responsável');
  perform ok((select count(*) from atividade_log l join atividades a on a.id = l.atividade_id where a.grupo_id = v_g and l.tipo = 'criou') = 8, 'com o histórico');
  select grupo_id into v_g from trabalhos where numero = 2;
  perform ok((select count(*) from atividades where grupo_id = v_g) = 9 and (select count(*) from atividades where grupo_id = v_g and status = 'a_fazer') = 5,
             'TRB-2: nove etapas, cinco do trainee');
  perform ok((select count(*) from atividades a join trabalhos tb on tb.grupo_id = a.grupo_id where tb.numero not in (1, 2)) = 0, 'nos outros, quadro vazio');

  raise notice 'O texto';
  -- todo item de lista termina em ponto (ou dois-pontos, antes de uma sublista)
  select count(*) into n from trabalhos tb,
    lateral unnest(string_to_array(concat_ws(E'\n', tb.escopo, tb.justificativa, tb.entregaveis, tb.dependencias, tb.criterios), E'\n')) l
   where l ~ '^- ' and l !~ '[.:]$';
  perform ok(n = 0, 'todo item de lista termina em ponto');
  select count(*) into n from atividades a, lateral unnest(string_to_array(a.descricao, E'\n')) l where l ~ '^- ' and l !~ '[.:]$';
  perform ok(n = 0, 'nos cartões também');
  select count(*) into n from trabalhos tb, lateral jsonb_each(tb.cenario) c, lateral jsonb_array_elements_text(c.value) i where i !~ '\.$';
  perform ok(n = 0, 'e no cenário');
  perform ok(not exists (select 1 from trabalhos where concat(referencia, escopo, justificativa, entregaveis, dependencias, criterios, alocacao, cenario::text) ~ '[—·;]\s*$|·|—'),
             'sem travessão nem ponto médio');
  perform ok(not exists (select 1 from trabalhos where concat(escopo, justificativa, entregaveis, dependencias, criterios) ~* '\mtrabalhos? \d'),
             '"trabalho 5" virou TRB-5 em todo texto');
  perform ok(not exists (select 1 from trabalhos where concat(escopo, justificativa, entregaveis, dependencias, criterios) ~ '\mTDCS\M|\mApp\M'),
             'tDCS e aplicativo, como no resto');
end $$;

-- ------------------------------------------------------------
-- De novo: nada muda
-- ------------------------------------------------------------
\ir ../2.23.0_trabalhos_2026_2.sql
do $$ begin
  perform ok((select count(*) from trabalhos) = 14 and (select count(*) from atividades a join trabalhos t on t.grupo_id = a.grupo_id) = 17,
             'a segunda vez não cria nada');
  perform ok((select count(*) from trb_rel where situacao = 'migração já aplicada') = 14, 'e o quadro diz que já foi aplicada');
  perform ok((select count(*) from notificacoes where titulo like 'Você é responsável pelo trabalho TRB-%' and registro = 70) = 2, 'nem avisa de novo');
end $$;
\echo '2.23.0_trabalhos_2026_2: tudo certo'
