\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 26.0 — escrever o registro no portal.
-- Rode num banco com o esqueleto (e o de Storage), a 15.0 a 22.0, a
-- 25.0 e a 26.0 (a 21.0 traz a NRO-PUB-003 e a NRO-PRO-003, que ganham
-- os formulários que já vêm).
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
create or replace function serie(p_pref text, p_sn integer) returns uuid language sql as $$
  select id from doc_series where prefixo = p_pref and sn = p_sn $$;
create or replace function arq(p_codigo text) returns uuid language sql as $$
  select id from doc_arquivos where codigo = p_codigo $$;
-- o PDF "sobe" para o Storage: basta a linha em storage.objects
create or replace function subir(p_arq uuid, p_nome text) returns text language plpgsql as $$
declare c text := p_arq::text || '/' || gen_random_uuid()::text || '/' || p_nome;
begin insert into storage.objects (bucket_id, name) values ('arquivos', c); return c; end $$;

insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23)
on conflict do nothing;

create or replace function ata_ok() returns jsonb language sql as $$
  select '{"orgao":"Gerência","assunto":"Reunião de Gerência de abril","data":"2026-04-24","hora":"16:00",
           "local":"na Sala de Reuniões do LABBIO","presentes":[{"registro":4,"nome":"Ana Figueiredo"},{"nome":"Maria Teresa","nota":"online"}],
           "pauta":["Horário das reuniões","Proposta do NeuroSummit"],
           "discussao":"A reunião começou pelo horário.\n\nPara o segundo assunto…",
           "redacao":{"registro":17,"nome":"Carla Mendonça","ia":""},"data_redacao":"2026-04-24","hora_redacao":"18:00"}'::jsonb $$;

-- 1. os que já vêm, e a conferência
do $$ declare f jsonb; p text[]; begin
  perform ok((select formulario->>'titulo' from doc_series where id = serie('PUB', 3)) = 'Ata de reunião',
             'a NRO-PUB-003 já vem com o formulário da ata');
  perform ok((select (formulario->>'numerar_linhas')::boolean from doc_series where id = serie('PUB', 3)),
             'com as linhas numeradas, como o template');
  perform ok((select jsonb_array_length(formulario->'campos') from doc_series where id = serie('PRO', 3)) = 16,
             'e a NRO-PRO-003, com os 16 campos do relatório de teste');
  perform ok(cardinality(doc_formulario_problemas((select formulario from doc_series where id = serie('PUB', 3)))) = 0
         and cardinality(doc_formulario_problemas((select formulario from doc_series where id = serie('PRO', 3)))) = 0,
             'os dois passam na conferência');
  perform ok((select count(*) from doc_eventos where arquivo_id = arq('NRO-PUB-003') and tipo = 'formulario') = 1,
             'e entram no registro de alterações do template');

  f := '{"titulo":"X","campos":[
          {"id":"a","rotulo":"A","tipo":"texto"},
          {"id":"a","rotulo":"B","tipo":"texto"},
          {"id":"Z-1","rotulo":"C","tipo":"texto"},
          {"id":"d","rotulo":"","tipo":"foto"},
          {"id":"e","rotulo":"E","tipo":"escolha"},
          {"id":"g","rotulo":"G","tipo":"tabela","colunas":[{"id":"x"}]}],
        "impressao":[{"tipo":"campo","campo":"nada"},{"tipo":"rodape"}]}';
  p := doc_formulario_problemas(f);
  perform ok(cardinality(p) = 8, 'a conferência acha os oito problemas: ' || array_to_string(p, ' | '));
  perform ok('Campo 2: identificador repetido (a).' = any(p) and 'Campo 4: tipo desconhecido (foto).' = any(p)
         and 'Campo 5: escolha sem opções.' = any(p) and 'Impressão, bloco 1: o campo nada não existe.' = any(p),
             'e diz quais, em português');
  perform ok(doc_formulario_problemas('{"titulo":"X","campos":[]}') = array['O formulário não tem nenhum campo.'],
             'formulário sem campo não vale');
  perform ok(doc_formulario_faltam((select formulario from doc_series where id = serie('PUB', 3)),
             '{"orgao":"Gerência","presentes":[],"pauta":["x"],"redacao":{"nome":" "}}')
             @> array['Qual reunião', 'Quem esteve', 'Quem redigiu', 'Data'],
             'o que falta preencher vem pelo rótulo');
end $$;

-- 2. definir é do PMO
do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  r := doc_formulario_definir(jsonb_build_object('serie_id', serie('PRO', 1), 'formulario',
         '{"titulo":"Termo de abertura","campos":[{"id":"objetivo","rotulo":"Objetivo","tipo":"paragrafo","obrigatorio":true}]}'::jsonb));
  perform ok(r->>'status' = 'sem_permissao', 'quem não é do PMO não define formulário');
  perform eu(4, 'admin');
  r := doc_formulario_definir(jsonb_build_object('serie_id', serie('PES', 6), 'formulario', '{"titulo":"x","campos":[{"id":"a","rotulo":"A","tipo":"texto"}]}'::jsonb));
  perform ok(r->>'status' = 'sem_pn', 'documento único não tem PN para escrever');
  r := doc_formulario_definir(jsonb_build_object('serie_id', serie('PRO', 1), 'formulario', '{"titulo":"x","campos":[]}'::jsonb));
  perform ok(r->>'status' = 'invalido' and r->'problemas' ? 'O formulário não tem nenhum campo.', 'definição com problema não entra');
  r := doc_formulario_definir(jsonb_build_object('serie_id', serie('PRO', 1), 'formulario',
         '{"versao":1,"rev":"A","titulo":"Termo de abertura de projeto","complemento":"{projeto}","campos":[
            {"id":"projeto","rotulo":"Projeto","tipo":"projeto","obrigatorio":true},
            {"id":"objetivo","rotulo":"Objetivo","tipo":"paragrafo","obrigatorio":true}]}'::jsonb));
  perform ok(r->>'status' = 'ok', 'o admin define o do termo de abertura (documento com PN)');
  perform ok((select detalhe from doc_eventos where arquivo_id = arq('NRO-PRO-001') and tipo = 'formulario') like 'definido — 2 campos%',
             'e fica no registro de alterações');
end $$;

-- 3. escrever uma ata
do $$ declare r jsonb; v_id uuid; begin
  perform eu(4, 'admin');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', serie('PUB', 3)));
  perform ok(r->>'codigo' = 'NRO-PUB-003-1', 'o PN nasce do jeito de sempre: NRO-PUB-003-1');
  v_id := (r->>'id')::uuid;
  r := doc_formulario_abrir(arq('NRO-PUB-003'));
  perform ok(r->>'status' = 'sem_pn', 'o template não se escreve: o PN, sim');
  r := doc_formulario_abrir(v_id);
  perform ok(r->>'status' = 'ok' and r->'def'->>'titulo' = 'Ata de reunião' and r->>'template_rev' = 'A',
             'abrir traz a definição e a revisão em vigor do template');
  perform ok(r->'dados' is null or jsonb_typeof(r->'dados') = 'null', 'sem rascunho ainda');

  perform eu(23, 'leitura');
  perform ok((doc_formulario_abrir(v_id))->>'status' = 'sem_permissao', 'quem não mexe no arquivo não abre o rascunho');
  perform ok((doc_formulario_salvar(v_id, '{"assunto":"furo"}'))->>'status' = 'sem_permissao', 'nem grava');

  perform eu(4, 'admin');
  r := doc_formulario_salvar(v_id, '{"assunto":"Reunião de Gerência de abril"}');
  perform ok(r->>'status' = 'ok', 'o rascunho grava');
  perform ok((doc_formulario_abrir(v_id))->'dados'->>'assunto' = 'Reunião de Gerência de abril'
         and (doc_formulario_abrir(v_id))->>'atualizado_nome' = 'Ana Figueiredo', 'e volta, com quem mexeu por último');
  r := doc_formulario_salvar(v_id, '"texto"');
  perform ok(r->>'status' = 'invalido', 'rascunho que não é objeto não entra');

  -- enviar
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'dados', '{"assunto":"só isto"}'::jsonb,
         'caminho', subir(v_id, 'a.pdf')));
  perform ok(r->>'status' = 'faltam' and r->'faltam' ? 'Quem esteve', 'enviar com obrigatório vazio não sai, e diz o quê');
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'dados', ata_ok(),
         'caminho', v_id::text || '/nao/subiu.pdf', 'nome_original', 'NRO-PUB-003-1.pdf'));
  perform ok(r->>'status' = 'arquivo_nao_enviado', 'o PDF precisa estar no Storage — a conferência é a de sempre');
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'dados', ata_ok(),
         'caminho', subir(v_id, 'NRO-PUB-003-1.pdf'), 'nome_original', 'NRO-PUB-003-1.pdf', 'tamanho', 48211));
  perform ok(r->>'status' = 'ok' and r->>'rev' is null and (r->>'formulario')::boolean, 'enviado: o registro fica pendente');
  perform ok((select mime from doc_revisoes where id = (r->>'id')::uuid) = 'application/pdf', 'é um PDF');
  perform ok((select template_rev from doc_revisoes where id = (r->>'id')::uuid) = 'A', 'feito sobre a revisão em vigor do template');
  perform ok((select formulario->'dados'->>'orgao' from doc_revisoes where id = (r->>'id')::uuid) = 'Gerência'
         and (select formulario->'def'->>'titulo' from doc_revisoes where id = (r->>'id')::uuid) = 'Ata de reunião',
             'a revisão guarda a definição e os dados');
  perform ok(not exists (select 1 from doc_formulario_rascunhos where arquivo_id = v_id), 'o rascunho sai de cena');
  perform ok((select status from doc_arquivos where id = v_id) = 'em_revisao', 'e o arquivo fica em revisão');
  r := doc_formulario_salvar(v_id, ata_ok());
  perform ok(r->>'status' = 'ok', 'enquanto pendente, dá para ir ajustando um rascunho');
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'dados', ata_ok(), 'caminho', subir(v_id, 'b.pdf')));
  perform ok(r->>'status' = 'ja_pendente', 'mas não mandar outro por cima');
  delete from doc_formulario_rascunhos where arquivo_id = v_id;
  perform ok((doc_formulario_abrir(v_id))->'ultima'->>'estado' = 'pendente',
             'sem rascunho, abrir começa da versão enviada');

  -- revisar (a Carla revisa: é do PMO)
  update grupos set chave = 'pmo' where nome = 'Órtese';
  perform eu(17, 'leitura');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', (select id from doc_revisoes where arquivo_id = v_id and estado = 'pendente'),
         'decisao', 'aprovar'));
  perform ok(r->>'status' = 'ok', 'a revisão aprova como aprova qualquer registro');
  perform eu(4, 'admin');
  r := doc_formulario_salvar(v_id, ata_ok());
  perform ok(r->>'status' = 'registro_fechado', 'registro aprovado não se escreve mais');
  perform ok((doc_formulario_abrir(v_id))->'ultima'->'dados'->>'orgao' = 'Gerência', 'e abrir mostra o que foi aprovado');
  perform ok(((doc_formulario_abrir(v_id))->>'fechado')::boolean, 'e abrir diz que está fechado');
end $$;

-- 4. o documento com PN: a próxima revisão começa do que foi aprovado
do $$ declare r jsonb; v_id uuid; begin
  perform eu(4, 'admin');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', serie('PRO', 1)));
  v_id := (r->>'id')::uuid;
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'caminho', subir(v_id, 'tap.pdf'),
         'dados', '{"projeto":{"codigo":"NEBULA","nome":"Nebula"},"objetivo":"Uma órtese."}'::jsonb));
  perform ok(r->>'status' = 'ok' and r->>'rev' = 'A', 'o termo de abertura sai na Rev. A');
  perform eu(17, 'leitura');
  perform doc_revisao_decidir(jsonb_build_object('revisao_id', (r->>'id')::uuid, 'decisao', 'aprovar'));
  perform eu(4, 'admin');
  r := doc_formulario_abrir(v_id);
  perform ok(r->'ultima'->'dados'->>'objetivo' = 'Uma órtese.' and r->'ultima'->>'estado' = 'aprovada',
             'reabrir traz o que a Rev. A dizia, para a Rev. B começar dali');
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'caminho', subir(v_id, 'tap-b.pdf'),
         'dados', '{"projeto":{"codigo":"NEBULA","nome":"Nebula"},"objetivo":"Uma órtese de membro superior."}'::jsonb));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'mudancas', 'revisão diz o que mudou, escrita no portal ou não');
  r := doc_formulario_enviar(jsonb_build_object('arquivo_id', v_id, 'caminho', subir(v_id, 'tap-b2.pdf'),
         'mudancas', 'O objetivo ficou mais preciso.',
         'dados', '{"projeto":{"codigo":"NEBULA","nome":"Nebula"},"objetivo":"Uma órtese de membro superior."}'::jsonb));
  perform ok(r->>'status' = 'ok' and r->>'rev' = 'B', 'e a Rev. B vai para revisão');
end $$;

-- 5. tirar o formulário
do $$ declare r jsonb; begin
  perform eu(4, 'admin');
  r := doc_formulario_definir(jsonb_build_object('serie_id', serie('PRO', 1), 'formulario', null));
  perform ok(r->>'status' = 'ok' and (select formulario from doc_series where id = serie('PRO', 1)) is null,
             'tirar o formulário volta ao template para baixar');
  perform ok((select count(*) from doc_eventos where arquivo_id = arq('NRO-PRO-001') and tipo = 'formulario') = 2,
             'e isso também fica registrado');
end $$;

-- 6. RLS: o rascunho, direto na tabela
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
do $$ declare r jsonb; begin
  perform eu(4, 'admin');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', serie('PRO', 3)));
  perform doc_formulario_salvar((r->>'id')::uuid, '{"nome":"Encoder"}');
end $$;
do $$ begin perform set_config('teste.registro', '23', false); perform set_config('teste.papel', 'leitura', false); end $$;
set role authenticated;
do $$ begin
  perform ok((select count(*) from doc_formulario_rascunhos) = 0, 'o Diego não lê o rascunho de ninguém');
end $$;
reset role;
do $$ begin perform set_config('teste.registro', '4', false); perform set_config('teste.papel', 'admin', false); end $$;
set role authenticated;
do $$ begin
  perform ok((select count(*) from doc_formulario_rascunhos) = 1, 'o admin lê o que está sendo escrito');
end $$;
reset role;

-- 7. rodar de novo não desfaz o que o PMO mudou
update doc_series set formulario = jsonb_set(formulario, '{rev}', '"B"') where id = serie('PUB', 3);
\ir ../v26_formularios.sql
do $$ begin
  perform ok((select formulario->>'rev' from doc_series where id = serie('PUB', 3)) = 'B',
             'rodar a 26.0 de novo não passa por cima do formulário que o PMO mudou');
  perform ok((select count(*) from doc_eventos where arquivo_id = arq('NRO-PUB-003') and tipo = 'formulario') = 1,
             'nem repete o registro de alterações');
end $$;
\echo '== 26.0: tudo certo'
