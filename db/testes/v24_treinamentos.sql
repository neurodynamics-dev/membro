\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 24.0 — os treinamentos.
-- Rode num banco com o esqueleto (e o de Storage), a 15.0 a 20.0 e
-- a 24.0. A 20.0 entra para conferir que o emissor TRE fica
-- reservado; o resto não depende dela.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function tre(p_codigo text) returns uuid language sql as $$
  select id from treinamentos where codigo = p_codigo $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
create or replace function avisos(p_reg integer, p_like text) returns integer language sql as $$
  select count(*)::integer from notificacoes where registro = p_reg and tipo = 'treinamento' and titulo like p_like $$;

-- O conteúdo de teste: três módulos. O do meio tem a verificação,
-- com uma questão de cada tipo.
create or replace function conteudo_a() returns jsonb language sql as $$
  select '{"modulos":[
    {"id":"m1","titulo":"O que é a agenda","corpo":"A agenda da equipe é uma só.\n\n```video\nhttps://youtu.be/AdOeBTOeMu0\nComo marcar um compromisso\n```"},
    {"id":"m2","titulo":"As cinco abas","corpo":"Próximos, Mês, Agendar, Presença e Minha agenda.",
     "verificacao":{"questoes":[
       {"id":"q1","tipo":"unica","enunciado":"Qual aba mostra a grade do mês?","explicacao":"É a aba Mês.",
        "opcoes":[{"id":"a","texto":"Próximos","correta":false},{"id":"b","texto":"Mês","correta":true},{"id":"c","texto":"Agendar","correta":false}]},
       {"id":"q2","tipo":"multipla","enunciado":"O que aparece na agenda?",
        "opcoes":[{"id":"a","texto":"Eventos","correta":true},{"id":"b","texto":"Marcos do semestre","correta":true},{"id":"c","texto":"E-mails","correta":false}]},
       {"id":"q3","tipo":"vf","enunciado":"Verdadeiro ou falso:",
        "opcoes":[{"id":"a","texto":"O portal lê o seu Google Agenda.","correta":true},{"id":"b","texto":"Todo compromisso se repete.","correta":false}]}]}},
    {"id":"m3","titulo":"Presença","corpo":"O check-in é pelo QR da entrada do LABBIO."}]}'::jsonb $$;
create or replace function certas() returns jsonb language sql as $$
  select '{"q1":["b"],"q2":["b","a"],"q3":{"a":true,"b":false}}'::jsonb $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    Sinais
--   17 Carla    Órtese
--   23 Diego    Comunicação — vai para o grupo gestor
--   31 Elis     Depto de Pessoal (papel pessoal)
--   52 Gabi     Firmware, subgrupo de Órtese
--   60 Hugo     Órtese, desligado
-- ------------------------------------------------------------
insert into membros(registro, nome, grupos, status, email_nro) values
  (52, 'Gabi Rocha', '{Firmware}', 'Ativo', 'gabi@nro.dev'),
  (60, 'Hugo Lima',  '{Órtese}',   'Desligado', 'hugo@nro.dev')
on conflict do nothing;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52)
on conflict do nothing;
do $$ begin
  perform eu(4, 'admin');
  perform grupo_salvar(jsonb_build_object('nome','Firmware','prefixo','FIR'));
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('Firmware'), 'pai_id', gid('Órtese')));
  perform grupo_salvar(jsonb_build_object('nome','Formação','prefixo','FOR'));
end $$;
update membros set grupos = grupos || '{"Formação"}'::text[] where registro = 23;

-- 1. quem gere
do $$ declare pegou boolean := false; begin
  perform eu(4, 'admin');     perform ok(treinamento_gestor(), 'admin gere os treinamentos');
  perform eu(31, 'pessoal');  perform ok(treinamento_gestor(), 'o Depto. de Pessoal também');
  perform eu(23, 'leitura');  perform ok(not treinamento_gestor(), 'Diego ainda não');
  perform eu(31, 'pessoal');
  update treinamento_config set grupos_gestores = array[gid('Formação')];
  perform eu(23, 'leitura');  perform ok(treinamento_gestor(), 'com Formação entre os gestores, Diego gere');
  begin
    update treinamento_config set grupos_gestores = '{}';
  exception when others then pegou := sqlerrm = 'tre_so_admin'; end;
  perform ok(pegou, 'mas quem entra na gestão, só admin e o Depto. de Pessoal decidem');
  update treinamento_config set readme = '# Guia', assinatura_nome = 'Elis Ramalho';
  perform ok((select readme_atualizado_por from treinamento_config) = 'Diego Prado', 'o README guarda quem o mudou');
  update treinamento_config set readme = '';
  perform ok((select readme from treinamento_config) is null, 'README vazio volta a ser o padrão do portal');
  perform eu(11, 'leitura');  perform ok(not treinamento_gestor(), 'Bruno não gere');
end $$;

-- 2. criar: o código é do treinamento, a revisão fica fora dele
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := treinamento_salvar(jsonb_build_object('titulo','Furo'));
  perform ok(r->>'status' = 'sem_permissao', 'quem não gere não cria treinamento');
  perform eu(23, 'leitura');
  r := treinamento_salvar(jsonb_build_object('titulo','   '));
  perform ok(r->>'status' = 'invalido', 'título vazio não passa');
  r := treinamento_salvar(jsonb_build_object('titulo','Agenda no SOMA','resumo','Marcar, responder e acompanhar.',
         'categoria','Sistemas','carga_horaria_min',45));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'NRO-TRE-001', 'o primeiro é NRO-TRE-001');
  perform ok((select status from treinamentos where id = tre('NRO-TRE-001')) = 'rascunho'
         and (select revisao_atual from treinamentos where id = tre('NRO-TRE-001')) is null, 'e nasce rascunho, sem revisão');
  perform ok((select count(*) from treinamento_revisoes where treinamento_id = tre('NRO-TRE-001') and status = 'rascunho') = 1,
             'com um rascunho de conteúdo aberto');
  perform ok((select responsavel from treinamentos where id = tre('NRO-TRE-001')) = 23, 'quem cria responde por ele');
  r := treinamento_salvar(jsonb_build_object('titulo','Segurança no LABBIO','numero',7));
  perform ok(r->>'codigo' = 'NRO-TRE-007', 'o número pode vir escolhido');
  r := treinamento_salvar(jsonb_build_object('titulo','Outro','numero',7));
  perform ok(r->>'status' = 'duplicado', 'mas não repetido');
  r := treinamento_salvar(jsonb_build_object('titulo','Apresentação do LABBIO'));
  perform ok(r->>'codigo' = 'NRO-TRE-008', 'sem número, é o seguinte ao maior');
  r := treinamento_salvar(jsonb_build_object('id', tre('NRO-TRE-001'), 'nota_minima', 150));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'nota_minima', 'nota mínima acima de 100 não passa');
end $$;

-- 3. rascunho e publicar
do $$ declare r jsonb; begin
  perform eu(23, 'leitura');
  r := treinamento_publicar(tre('NRO-TRE-001'));
  perform ok(r->>'status' = 'invalido' and r->'problemas' ? 'O treinamento não tem nenhum módulo.',
             'publicar sem módulo nenhum não sai');
  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), '{"modulos":[
      {"id":"m1","titulo":"","corpo":"x"},
      {"id":"m1","titulo":"B","corpo":"y","verificacao":{"questoes":[
        {"id":"q1","tipo":"unica","enunciado":"?","opcoes":[{"id":"a","texto":"A","correta":true},{"id":"b","texto":"B","correta":true}]},
        {"id":"q2","tipo":"multipla","enunciado":"?","opcoes":[{"id":"a","texto":"A"}]},
        {"id":"q3","tipo":"vf","enunciado":"?","opcoes":[]}]}}]}'::jsonb);
  perform ok(r->>'status' = 'ok', 'o rascunho grava mesmo com problemas: é trabalho em andamento');
  perform ok(jsonb_array_length(r->'problemas') = 6, 'e diz quais são os seis: ' || (r->'problemas')::text);
  perform ok(r->'problemas' ? 'Módulo 2 · questão 1: uma correta só — há 2 marcadas.', 'uma correta com duas marcadas');
  perform ok(r->'problemas' ? 'Módulo 2: identificador repetido (m1).', 'módulo com id repetido');
  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), '{"modulos":[{"id":"m1","titulo":"A","corpo":"x","verificacao":{"questoes":[
        {"id":"q1\u0027);alert(1);//","tipo":"vf","enunciado":"?","opcoes":[{"id":"a","texto":"A","correta":true}]}]}}]}'::jsonb);
  perform ok(r->'problemas' ? 'Módulo 1 · questão 1: identificador com caracteres que não valem.',
             'id com aspa (que viraria código na tela) não publica');
  r := treinamento_publicar(tre('NRO-TRE-001'));
  perform ok(r->>'status' = 'invalido', 'com problema, não publica');

  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), conteudo_a(), 'Primeira versão');
  perform ok(jsonb_array_length(r->'problemas') = 0, 'o conteúdo certo não tem problema');
  r := treinamento_publicar(tre('NRO-TRE-001'));
  perform ok(r->>'status' = 'ok' and r->>'revisao' = 'A', 'publica como Rev. A');
  perform ok((select status = 'publicado' and revisao_atual = 'A' and revisao_minima = 'A'
                from treinamentos where id = tre('NRO-TRE-001')), 'o treinamento fica publicado, na A');
  perform ok(not exists (select 1 from treinamento_revisoes where treinamento_id = tre('NRO-TRE-001') and status = 'rascunho'),
             'e o rascunho vira a revisão publicada');
  perform ok((select publicado_nome from treinamento_revisoes where treinamento_id = tre('NRO-TRE-001') and revisao = 'A') = 'Diego Prado',
             'com quem publicou');
  r := treinamento_publicar(tre('NRO-TRE-001'));
  perform ok(r->>'status' = 'sem_rascunho', 'publicar de novo sem rascunho não faz nada');
end $$;

-- 4. atribuir: pela pertença efetiva; o obrigatório avisa
do $$ declare r jsonb; begin
  perform eu(23, 'leitura');
  r := treinamento_atribuir(tre('NRO-TRE-001'), jsonb_build_array(
         jsonb_build_object('grupo_id', gid('Órtese'), 'obrigatorio', true),
         jsonb_build_object('grupo_id', null, 'obrigatorio', false)));
  perform ok(r->>'status' = 'ok' and (r->>'atribuicoes')::integer = 2, 'Órtese obrigatório e a equipe inteira opcional');
  perform ok(treinamento_obrigatorio_para(tre('NRO-TRE-001'), 17), 'para a Carla, de Órtese, é obrigatório');
  perform ok(treinamento_obrigatorio_para(tre('NRO-TRE-001'), 52), 'para a Gabi, de Firmware (dentro de Órtese), também');
  perform ok(treinamento_obrigatorio_para(tre('NRO-TRE-001'), 11) = false, 'para o Bruno, de Sinais, é opcional');
  perform ok(avisos(17, 'Treinamento obrigatório: NRO-TRE-001%') = 1 and avisos(52, 'Treinamento obrigatório: NRO-TRE-001%') = 1,
             'Carla e Gabi são avisadas');
  perform ok(avisos(11, '%NRO-TRE-001%') = 0, 'Bruno, que só tem o opcional, não');
  perform ok(avisos(60, '%') = 0, 'nem o Hugo, que é de Órtese mas está desligado');
  r := treinamento_atribuir(tre('NRO-TRE-001'), jsonb_build_array(
         jsonb_build_object('grupo_id', gid('Órtese'), 'obrigatorio', true),
         jsonb_build_object('grupo_id', null, 'obrigatorio', false)));
  perform ok((r->>'avisados')::integer = 0 and avisos(17, 'Treinamento obrigatório: NRO-TRE-001%') = 1,
             'gravar a mesma lista de novo não avisa ninguém outra vez');
  r := treinamento_atribuir(tre('NRO-TRE-001'), '[{"grupo_id": 99999}]'::jsonb);
  perform ok(r->>'status' = 'invalido', 'grupo que não existe não passa');
end $$;

-- 5. o gabarito não desce. RLS como no Supabase: o papel
--    authenticated tem grant em tudo, e o que segura é a política
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant usage, select on all sequences in schema public to authenticated;
set role authenticated;
do $$ declare n integer; r jsonb; pegou boolean := false; begin
  perform eu(11, 'leitura');
  select count(*) into n from treinamentos;
  perform ok(n = 1, 'Bruno vê o publicado (e não os rascunhos)');
  select count(*) into n from treinamento_revisoes;
  perform ok(n = 0, 'mas não lê as revisões — é lá que está o gabarito');
  r := treinamento_conteudo('nro-tre-001');
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'modulos') = 3, 'o conteúdo desce pela função, com os três módulos');
  perform ok(r::text !~ '"correta"' and r::text !~ '"explicacao"', 'sem "correta" e sem explicação em lugar nenhum');
  perform ok(jsonb_array_length(r->'modulos'->1->'verificacao'->'questoes'->0->'opcoes') = 3, 'mas com as alternativas');
  perform ok(r->'modulos'->0->'verificacao' = 'null'::jsonb, 'módulo sem verificação vem sem ela');
  perform ok(r->>'situacao' = 'pendente' and (r->>'obrigatorio')::boolean = false, 'para ele, opcional e pendente');
  update treinamentos set titulo = 'x';
  get diagnostics n = row_count;
  perform ok(n = 0, 'ninguém escreve direto na tabela: a escrita é pelas funções');
  update treinamento_progresso set modulos_concluidos = '{m1,m2,m3}';
  get diagnostics n = row_count;
  perform ok(n = 0, 'nem marca os módulos como feitos por fora');
  begin
    perform treinamento_situacao(tre('NRO-TRE-001'), 17);
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'e não pergunta ao banco se a Carla concluiu: a função não é da conta');
  pegou := false;
  begin
    insert into treinamento_conclusoes (certificado, registro, treinamento_id, nome, codigo, titulo, revisao)
    values ('CERT-FAKE-0001', 11, tre('NRO-TRE-001'), 'Bruno Tavares', 'NRO-TRE-001', 'Agenda no SOMA', 'A');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem forja um certificado');
  update treinamento_config set grupos_gestores = '{}';
  get diagnostics n = row_count;
  perform ok(n = 0, 'nem mexe na configuração');
  perform eu(23, 'leitura');
  select count(*) into n from treinamento_revisoes;
  perform ok(n >= 3, 'quem gere lê as revisões e os rascunhos');
  select count(*) into n from treinamentos;
  perform ok(n = 3, 'e os treinamentos em rascunho');
end $$;
reset role;

-- 6. fazer: ler conclui; a verificação corrige no banco
do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm2');
  perform ok(r->>'status' = 'tem_verificacao', 'módulo com verificação não se conclui só lendo');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm1');
  perform ok(r->>'status' = 'ok' and r->'feitos' = '["m1"]' and r->>'situacao' = 'andamento', 'ler o m1 o conclui: andamento');
  r := treinamento_responder(tre('NRO-TRE-001'), 'm2', '{"q1":["b"],"q2":["a"],"q3":{"a":true}}'::jsonb);
  perform ok(r->>'status' = 'ok' and (r->>'aprovado')::boolean = false and (r->>'nota')::integer = 33,
             'uma de três certas: 33, reprovado (a mínima é 70)');
  perform ok(r->'erradas' = '["q2","q3"]', 'várias corretas pela metade e V ou F incompleto contam como erradas');
  perform ok(r->'gabarito' = 'null'::jsonb, 'reprovado não recebe o gabarito');
  perform ok(not (r->'feitos' ? 'm2'), 'e o módulo não fecha');
  r := treinamento_responder(tre('NRO-TRE-001'), 'm2', '{"q1":["b","c"],"q2":["a","b"],"q3":{"a":true,"b":false}}'::jsonb);
  perform ok(r->'erradas' = '["q1"]', 'marcar duas numa questão de uma correta erra a questão');
  r := treinamento_responder(tre('NRO-TRE-001'), 'm2', certas());
  perform ok((r->>'aprovado')::boolean and (r->>'nota')::integer = 100, 'tudo certo: 100, aprovado');
  perform ok(r->'gabarito'->'q1'->'corretas' = '["b"]' and r->'gabarito'->'q1'->>'explicacao' = 'É a aba Mês.',
             'aprovado recebe o gabarito com a explicação');
  perform ok(r->'gabarito'->'q3'->'vf' = '{"a":true,"b":false}', 'e o V ou F de cada afirmação');
  perform ok(r->'certificado' = 'null'::jsonb and r->>'situacao' = 'andamento', 'falta o m3: ainda sem certificado');
  perform ok((select respostas->'m2'->>'tentativas' from treinamento_progresso where registro = 17) = '3',
             'as três tentativas ficam registradas');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm3');
  perform ok(r->>'certificado' ~ '^CERT-[0-9A-F]{4}-[0-9A-F]{4}$' and r->>'situacao' = 'concluido',
             'o último módulo fecha o treinamento: ' || (r->>'certificado'));
  perform ok((select count(*) = 1 and bool_and(nome = 'Carla Mendonça' and revisao = 'A' and nota = 100
                and carga_horaria_min = 45 and modulos = '{"O que é a agenda","As cinco abas","Presença"}')
                from treinamento_conclusoes where registro = 17),
             'a conclusão fica no perfil: nome, revisão, nota, carga e os módulos');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm3');
  perform ok((select count(*) from treinamento_conclusoes where registro = 17) = 1, 'concluir de novo não gera outro certificado');
  r := treinamento_responder(tre('NRO-TRE-001'), 'm2', '{}'::jsonb);
  perform ok((select respostas->'m2'->>'melhor_nota' from treinamento_progresso where registro = 17) = '100'
             and treinamento_situacao(tre('NRO-TRE-001'), 17) = 'concluido', 'refazer mal a verificação não tira a nota nem a conclusão');

  perform eu(52, 'leitura');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm1');
  perform ok(r->>'situacao' = 'andamento', 'Gabi começa pelo m1');
  perform eu(null, 'leitura');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm1');
  perform ok(r->>'status' = 'sem_registro', 'conta sem registro não tem progresso');
end $$;

-- 7. a lista de cada um e o acompanhamento de quem gere
do $$ declare r record; n integer; begin
  perform eu(52, 'leitura');
  select * into r from treinamentos_meus() where codigo = 'NRO-TRE-001';
  perform ok(r.obrigatorio and r.situacao = 'andamento' and r.feitos = 1 and r.n_modulos = 3 and r.revisao = 'A',
             'para a Gabi: obrigatório, 1 de 3, na Rev. A');
  select count(*) into n from treinamentos_meus();
  perform ok(n = 1, 'só o publicado entra na lista');
  select count(*) into n from treinamentos_de(17);
  perform ok(n = 0, 'a Gabi não lê a lista da Carla');
  perform eu(31, 'pessoal');
  select * into r from treinamentos_de(52) where codigo = 'NRO-TRE-001';
  perform ok(r.feitos = 1 and r.obrigatorio, 'quem gere lê a de qualquer um (a aba da ficha)');
  perform eu(11, 'leitura');
  select count(*) into n from treinamento_acompanhamento(tre('NRO-TRE-001'));
  perform ok(n = 0, 'quem não gere não acompanha');
  perform eu(31, 'pessoal');
  select count(*) into n from treinamento_acompanhamento(tre('NRO-TRE-001'));
  perform ok(n = 6, 'o Depto. de Pessoal vê os seis ativos (a equipe inteira tem o opcional; o Hugo, desligado, sai)');
  select * into r from treinamento_acompanhamento(tre('NRO-TRE-001')) where registro = 17;
  perform ok(r.situacao = 'concluido' and r.nota = 100 and r.certificado is not null, 'com a conclusão da Carla');
end $$;

-- 8. o certificado se confere pelo código
do $$ declare r jsonb; v text; begin
  select certificado into v from treinamento_conclusoes where registro = 17;
  perform eu(11, 'leitura');
  r := treinamento_certificado(lower(v));
  perform ok(r->>'status' = 'ok' and r->>'nome' = 'Carla Mendonça' and r->>'codigo' = 'NRO-TRE-001'
             and (r->>'em_dia')::boolean, 'qualquer um da equipe confere o certificado da Carla');
  r := treinamento_certificado('CERT-0000-0000');
  perform ok(r->>'status' = 'nao_encontrado', 'código inventado não confere');
end $$;

-- 9. revisões: a que não pede para refazer deixa quem concluiu em
--    dia, e aproveita o que não mudou para quem estava no meio
do $$ declare r jsonb; c jsonb; begin
  perform eu(23, 'leitura');
  c := jsonb_set(conteudo_a(), '{modulos,2,corpo}', '"O check-in é pelo QR da entrada, e o status do dia fica no mesmo lugar."');
  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), c, 'Presença: o status do dia');
  r := treinamento_publicar(tre('NRO-TRE-001'), false);
  perform ok(r->>'revisao' = 'B' and not (r->>'exige_refazer')::boolean and (r->>'avisados')::integer = 0,
             'Rev. B, sem pedir que refaçam, e sem aviso');
  perform ok((select revisao_minima from treinamentos where id = tre('NRO-TRE-001')) = 'A', 'a mínima continua a A');
  perform ok(treinamento_situacao(tre('NRO-TRE-001'), 17) = 'concluido', 'a Carla, que concluiu a A, continua em dia');
  perform ok(treinamento_feitos(tre('NRO-TRE-001'), 52) = '{m1}', 'a Gabi leva o m1, que não mudou, para a B');
  perform eu(52, 'leitura');
  r := treinamento_responder(tre('NRO-TRE-001'), 'm2', certas());
  perform ok(r->'feitos' = '["m1","m2"]', 'e continua de onde estava');
  r := treinamento_concluir_modulo(tre('NRO-TRE-001'), 'm3');
  perform ok(r->>'situacao' = 'concluido'
             and (select revisao from treinamento_conclusoes where registro = 52) = 'B', 'o certificado da Gabi é da Rev. B');

  -- a C pede que todos refaçam
  perform eu(23, 'leitura');
  c := jsonb_set(c, '{modulos,1,titulo}', '"As cinco abas da agenda"');
  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), c);
  r := treinamento_publicar(tre('NRO-TRE-001'), true, 'Aba Agendar refeita');
  perform ok(r->>'revisao' = 'C' and (r->>'avisados')::integer = 3, 'Rev. C, pedindo que refaçam: Ana, Carla e Gabi, de Órtese, são avisadas');
  perform ok(avisos(17, 'Nova revisão para refazer: NRO-TRE-001%') = 1, 'com o aviso de refazer');
  perform ok(treinamento_situacao(tre('NRO-TRE-001'), 17) = 'nova_revisao', 'a Carla volta a dever: nova revisão');
  perform ok(treinamento_feitos(tre('NRO-TRE-001'), 52) = '{}', 'e nada se aproveita: a C pede tudo de novo');
  perform ok((select status from treinamento_revisoes where treinamento_id = tre('NRO-TRE-001') and revisao = 'B') = 'substituida',
             'a B fica como substituída');
  perform ok((select count(*) from treinamento_conclusoes where registro in (17, 52)) = 2, 'e os certificados de antes continuam lá');

  -- descartar um rascunho
  r := treinamento_rascunho_salvar(tre('NRO-TRE-001'), null, 'rascunho à toa');
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'problemas') = 0, 'abrir rascunho sem conteúdo copia o publicado');
  r := treinamento_rascunho_descartar(tre('NRO-TRE-001'));
  perform ok(r->>'status' = 'ok' and not exists (select 1 from treinamento_revisoes
             where treinamento_id = tre('NRO-TRE-001') and status = 'rascunho'), 'e descartá-lo apaga só o rascunho');
  r := treinamento_rascunho_descartar(tre('NRO-TRE-008'));
  perform ok(r->>'status' = 'nunca_publicado', 'o rascunho de quem nunca foi publicado não se descarta: exclui-se');
end $$;

-- 10. validade: vence, e refazer é recomeçar
do $$ declare r jsonb; v1 text; begin
  perform eu(23, 'leitura');
  r := treinamento_salvar(jsonb_build_object('id', tre('NRO-TRE-007'), 'validade_meses', 12));
  r := treinamento_rascunho_salvar(tre('NRO-TRE-007'),
         '{"modulos":[{"id":"s1","titulo":"Regras da bancada","corpo":"Óculos, sempre."}]}'::jsonb);
  r := treinamento_publicar(tre('NRO-TRE-007'));
  perform eu(11, 'leitura');
  r := treinamento_concluir_modulo(tre('NRO-TRE-007'), 's1');
  v1 := r->>'certificado';
  perform ok(v1 is not null and (r->>'situacao') = 'concluido', 'Bruno conclui o de segurança');
  -- um ano e um mês depois
  update treinamento_conclusoes set concluido_em = now() - interval '13 months' where certificado = v1;
  update treinamento_progresso set ciclo_desde = now() - interval '14 months', iniciado_em = now() - interval '14 months'
   where registro = 11 and treinamento_id = tre('NRO-TRE-007');
  perform ok(treinamento_situacao(tre('NRO-TRE-007'), 11) = 'vencido', 'passada a validade, vence');
  r := treinamento_concluir_modulo(tre('NRO-TRE-007'), 's1');
  perform ok(r->>'situacao' = 'vencido' and (select count(*) from treinamento_conclusoes where registro = 11) = 1,
             'concluir de novo sem recomeçar não renova o certificado');
  r := treinamento_recomecar(tre('NRO-TRE-007'));
  perform ok(r->>'situacao' = 'vencido' and treinamento_feitos(tre('NRO-TRE-007'), 11) = '{}', 'recomeçar zera o progresso');
  r := treinamento_concluir_modulo(tre('NRO-TRE-007'), 's1');
  perform ok(r->>'situacao' = 'concluido' and r->>'certificado' <> v1, 'e fazer de novo dá um certificado novo');
  perform ok((select count(*) from treinamento_conclusoes where registro = 11) = 2, 'o de antes continua no perfil');
end $$;

-- 11. arquivar e excluir
do $$ declare r jsonb; n integer; begin
  perform eu(23, 'leitura');
  r := treinamento_excluir(tre('NRO-TRE-007'));
  perform ok(r->>'status' = 'ja_publicado', 'o que já foi publicado não se exclui');
  r := treinamento_arquivar(tre('NRO-TRE-007'), true);
  perform ok(r->>'situacao' = 'arquivado', 'arquiva');
  perform eu(17, 'leitura');
  select count(*) into n from treinamentos_meus() where codigo = 'NRO-TRE-007';
  perform ok(n = 0, 'arquivado sai da lista de todos');
  perform ok(treinamento_conteudo('NRO-TRE-007')->>'status' = 'nao_encontrado', 'e não abre para quem não o fez');
  perform eu(11, 'leitura');
  perform ok(treinamento_conteudo('NRO-TRE-007')->>'status' = 'ok', 'mas abre para quem o concluiu, para rever');
  perform ok(treinamento_concluir_modulo(tre('NRO-TRE-007'), 's1')->>'status' = 'nao_encontrado', 'sem aceitar progresso novo');
  perform eu(23, 'leitura');
  r := treinamento_arquivar(tre('NRO-TRE-007'), false);
  perform ok(r->>'situacao' = 'publicado', 'desarquivar o devolve');
  r := treinamento_arquivar(tre('NRO-TRE-008'), true);
  perform ok(r->>'status' = 'nunca_publicado', 'o que nunca foi publicado não se arquiva');
  r := treinamento_excluir(tre('NRO-TRE-008'));
  perform ok(r->>'status' = 'ok' and tre('NRO-TRE-008') is null, 'exclui-se');
end $$;

-- 12. o prefixo TRE é dos treinamentos
do $$ declare pegou boolean := false; begin
  begin
    insert into doc_emissores (prefixo, nome) values ('TRE', 'Treinamentos?');
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'Arquivos não aceita um emissor TRE: NRO-TRE-001 já é um treinamento');
end $$;

-- 13. rodar de novo não muda nada
\ir ../v24_treinamentos.sql
do $$ begin
  perform ok((select count(*) from treinamentos) = 2, 'os treinamentos continuam os dois');
  perform ok((select grupos_gestores from treinamento_config) = array[gid('Formação')], 'a configuração continua a escolhida');
  perform ok((select count(*) from treinamento_conclusoes) = 4, 'as quatro conclusões continuam');
  perform ok((select count(*) from migracoes where id = 'v24_treinamentos') = 1, 'a migração registrada uma vez só');
  perform ok(treinamento_rev_letra(27) = 'AA' and treinamento_rev_ord('AA') = 27 and treinamento_rev_ord('Z') = 26,
             'depois da Z vem a AA');
end $$;

\echo v24_treinamentos: tudo certo
