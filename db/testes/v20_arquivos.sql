\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function arq(p_codigo text) returns uuid language sql as $$
  select id from doc_arquivos where codigo = p_codigo $$;
create or replace function ser(p_codigo text) returns uuid language sql as $$
  select serie_id from doc_arquivos where codigo = p_codigo $$;
-- "sobe" um arquivo para o Storage, como o supabase-js faria
create or replace function sobe(p_codigo text, p_nome text, p_uid text) returns text language plpgsql as $$
declare v text := arq(p_codigo)::text || '/' || gen_random_uuid()::text || '/' || p_nome;
begin
  insert into storage.objects (bucket_id, name, owner) values ('arquivos', v, p_uid::uuid);
  return v;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', p_reg::text, true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', (select id::text from perfis where registro = p_reg), true);
end $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    vai para a equipe do NEBULA
--   17 Carla    P&D (emissor PRO) e supervisora do NEBULA
--   23 Diego    Qualidade — revisa as séries do Pessoal
--   31 Elis     Depto de Pessoal (emissor PES)
--   41 Fábio    PMO
--   52 Gabi     ninguém, por enquanto
-- ------------------------------------------------------------
insert into membros(registro, nome, grupos, status, email_nro) values
  (41, 'Fábio Lima', '{NRO_PMO}', 'Ativo', 'fabio@nro.dev'),
  (52, 'Gabi Rocha', '{}', 'Ativo', 'gabi@nro.dev')
on conflict do nothing;
update membros set grupos = grupos || '{P&D}'::text[] where registro = 17;
update membros set grupos = grupos || '{Qualidade}'::text[] where registro = 23;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000041', 'fabio@nro.dev', 'leitura', 41),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52)
on conflict do nothing;

do $$ begin
  perform eu(4, 'admin');
  perform grupo_salvar(jsonb_build_object('nome','NRO_PMO','prefixo','PMO'));
  perform grupo_salvar(jsonb_build_object('nome','P&D','prefixo','PDE'));
  perform grupo_salvar(jsonb_build_object('nome','Qualidade','prefixo','QUA'));
end $$;

-- 0. os grupos que o sistema acha sozinho
do $$ declare r jsonb; begin
  perform ok((select nome from grupos where chave = 'projetos') = 'NRO_PROJECTS',
             'a 20.0 criou NRO_PROJECTS como pai dos projetos');
  perform ok(not (select quadro from grupos where chave = 'projetos'), 'sem quadro em Atividades');
  perform eu(41, 'leitura');
  r := grupo_chave_definir(jsonb_build_object('chave','pmo','grupo_id', gid('NRO_PMO')));
  perform ok(r->>'status' = 'sem_permissao', 'só admin escolhe o PMO');
  perform eu(4, 'admin');
  r := grupo_chave_definir(jsonb_build_object('chave','pmo','grupo_id', gid('NRO_PMO')));
  perform ok(r->>'status' = 'ok' and grupo_pmo() = gid('NRO_PMO'), 'admin escolhe NRO_PMO');
  r := grupo_chave_definir(jsonb_build_object('chave','pmo','grupo_id', grupo_pessoal()));
  perform ok(r->>'status' = 'ocupado', 'e não rouba a chave de outro grupo (o do Pessoal)');
  perform eu(41, 'leitura');
  perform ok(doc_gestor(), 'Fábio, do PMO, administra a documentação sem ser admin');
  perform eu(11, 'leitura');
  perform ok(not doc_gestor(), 'Bruno não');
  perform eu(31, 'pessoal');
  perform ok(not doc_gestor(), 'nem o papel pessoal, por si só');
end $$;

-- 1. emissores e séries
do $$ declare r jsonb; begin
  insert into doc_emissores(prefixo, nome, grupo_id, ordem) values
    ('PES', 'Departamento de Pessoal', grupo_pessoal(), 1),
    ('PRO', 'Pesquisa e Desenvolvimento', gid('P&D'), 2),
    ('PUB', 'Geral', null, 0);

  perform eu(11, 'leitura');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PES','titulo','X','tipo','documento'));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno não cria série');

  perform eu(41, 'leitura');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PES','sn',7,'titulo','PROCEDIMENTO DE DESLIGAMENTO',
        'tipo','documento','subtipo','procedimento','classe','publico','grupo_revisor', gid('Qualidade')));
  perform ok(r->>'codigo' = 'NRO-PES-007', 'série com SN escolhido: NRO-PES-007');
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-007') = 'rascunho'
             and (select pn from doc_arquivos where codigo = 'NRO-PES-007') is null,
             'nasce a cabeça, sem PN, em rascunho');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PES','titulo','CHECKLIST DE OFFBOARDING',
        'tipo','documento','subtipo','checklist','classe','publico','grupo_revisor', gid('Qualidade')));
  perform ok(r->>'codigo' = 'NRO-PES-008', 'sem SN, pega o próximo livre: NRO-PES-008');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PES','sn',7,'titulo','Outro','tipo','documento'));
  perform ok(r->>'status' = 'duplicado', 'SN repetido no mesmo emissor é recusado');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PES','titulo','QUADRO DE PESSOAL','tipo','registro',
        'subtipo','planilha','classe','confidencial','multiplo',false,
        'grupo_revisor', gid('Qualidade'), 'grupos_leitura', jsonb_build_array(grupo_pessoal())));
  perform ok((select multiplo from doc_series where id = ser('NRO-PES-009')),
             'registro sempre tem PN (a cabeça é o template), mesmo pedindo que não');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PRO','sn',1,'titulo','TERMO DE ABERTURA DE PROJETO',
        'tipo','documento','subtipo','relatorio','classe','controlado','multiplo',true));
  r := doc_serie_salvar(jsonb_build_object('prefixo','PRO','sn',3,'titulo','RELATÓRIO DE EXECUÇÃO DE TESTES',
        'tipo','registro','subtipo','relatorio','classe','controlado'));
  perform ok((select natureza from doc_rol where codigo = 'NRO-PRO-001') = 'template'
             and (select natureza from doc_rol where codigo = 'NRO-PES-007') = 'documento',
             'a cabeça de série com PN é template; a de série única é o próprio documento');
end $$;

-- 2. projeto: grupo dentro de NRO_PROJECTS, supervisor responsável
do $$ declare r jsonb; v_g integer; begin
  perform eu(11, 'leitura');
  r := projeto_salvar(jsonb_build_object('codigo','NEBULA','nome','Nebula'));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno não cria projeto');

  perform eu(41, 'leitura');
  r := projeto_salvar(jsonb_build_object('codigo','nebula','nome','Nebula','supervisor',17,
        'equipe', jsonb_build_array(11)));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'NEBULA', 'o PMO cria o NEBULA (código em maiúsculas)');
  v_g := (r->>'grupo_id')::integer;
  perform ok((select nome from grupos where id = v_g) = 'NRO_PROJECT_NEBULA', 'com o grupo NRO_PROJECT_NEBULA');
  perform ok((select pai_id from grupos where id = v_g) = grupo_projetos(), 'dentro de NRO_PROJECTS');
  perform ok((select quadro from grupos where id = v_g) and (select prefixo from grupos where id = v_g) = 'NEB',
             'com quadro em Atividades, prefixo NEB');
  perform ok((select responsaveis from grupos where id = v_g) = array[17], 'a supervisora é responsável pelo grupo');
  perform ok(esta_no_grupo(grupo_projetos(), 11) and esta_no_grupo(grupo_projetos(), 17),
             'Bruno e Carla estão em NRO_PROJECTS, pela equipe');
  perform ok((select count(*) from notificacoes where tipo = 'projeto_equipe') = 2, 'e os dois são avisados');
  perform ok((select logo_semente from projetos where codigo = 'NEBULA') = 'nebula', 'a semente da logo sai do código');

  r := projeto_salvar(jsonb_build_object('codigo','NEBULA','nome','Outro'));
  perform ok(r->>'status' = 'duplicado', 'código de projeto não se repete');

  -- a supervisora cuida da equipe
  perform eu(17, 'leitura');
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', v_g, 'adicionar', jsonb_build_array(52)));
  perform ok(r->>'status' = 'ok', 'Carla, supervisora, põe a Gabi na equipe');
  r := projeto_salvar(jsonb_build_object('id', (select id from projetos where codigo='NEBULA'),
        'descricao', 'Órtese para membro superior.'));
  perform ok(r->>'status' = 'ok', 'e edita o projeto');
  perform eu(11, 'leitura');
  r := projeto_salvar(jsonb_build_object('id', (select id from projetos where codigo='NEBULA'), 'nome', 'X'));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno, só da equipe, não edita');
end $$;

-- 3. padrão de projeto: só série com PN
do $$ declare pegou boolean := false; begin
  insert into doc_padrao_projeto(serie_id, ordem, quantidade) values
    (ser('NRO-PRO-001'), 1, 'um'), (ser('NRO-PRO-003'), 2, 'varios');
  begin
    insert into doc_padrao_projeto(serie_id) values (ser('NRO-PES-007'));
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'série sem PN não entra no padrão de projeto');
end $$;

-- 4. PN: um por projeto, ou vários
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-001'),
        'projeto_id', (select id from projetos where codigo='NEBULA')));
  perform ok(r->>'codigo' = 'NRO-PRO-001-1', 'Bruno, da equipe, cria o termo de abertura do NEBULA: NRO-PRO-001-1');
  perform ok((select template_id from doc_arquivos where codigo = 'NRO-PRO-001-1') = arq('NRO-PRO-001'),
             'nascido do template da série');
  perform ok((select autor from doc_arquivos where codigo = 'NRO-PRO-001-1') = 11,
             'o autor é quem criou o PN, não o template');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-001'),
        'projeto_id', (select id from projetos where codigo='NEBULA')));
  perform ok(r->>'status' = 'ja_existe' and r->>'codigo' = 'NRO-PRO-001-1', '"um por projeto": o segundo é recusado, com o código do que existe');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-003'),
        'projeto_id', (select id from projetos where codigo='NEBULA'), 'titulo', 'bancada 2'));
  perform ok(r->>'codigo' = 'NRO-PRO-003-1', 'relatório de teste: NRO-PRO-003-1');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-003'),
        'projeto_id', (select id from projetos where codigo='NEBULA')));
  perform ok(r->>'codigo' = 'NRO-PRO-003-2', '"vários": o segundo vem com o PN seguinte');
  perform ok((select titulo from doc_rol where codigo = 'NRO-PRO-003-1') = 'RELATÓRIO DE EXECUÇÃO DE TESTES — bancada 2',
             'o título do PN é o da série mais o complemento');
  perform ok((select n_pns from doc_rol where codigo = 'NRO-PRO-003') = 2, 'a cabeça conta os PNs');

  perform eu(31, 'pessoal');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-003'),
        'projeto_id', (select id from projetos where codigo='NEBULA')));
  perform ok(r->>'status' = 'sem_permissao', 'Elis, de fora da equipe e do P&D, não cria PN do NEBULA');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PES-007')));
  perform ok(r->>'status' = 'sem_pn', 'série de exemplar único não tem PN');
end $$;

-- 5. enviar, devolver, reenviar, aprovar
do $$ declare r jsonb; v_c text; v_rev uuid; begin
  perform eu(31, 'pessoal');
  v_c := sobe('NRO-PES-007', 'desligamento.docx', '00000000-0000-0000-0000-000000000031');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'), 'caminho', v_c,
        'nome_original','desligamento.docx', 'mime','application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'tamanho', 20480));
  perform ok(r->>'status' = 'ok' and r->>'rev' = 'A', 'Elis, do Pessoal (o emissor), envia a primeira versão: Rev. A');
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-007') = 'em_revisao'
             and (select rev_pendente from doc_arquivos where codigo = 'NRO-PES-007') = 'A',
             'o arquivo fica "em revisão", com a Rev. A pendente');
  perform ok(exists (select 1 from notificacoes where registro = 23 and tipo = 'doc_revisao'
                     and href = '#/arquivos/NRO-PES-007'),
             'o Diego, do grupo revisor, é avisado, com o link do arquivo');
  perform ok(not exists (select 1 from notificacoes where registro = 31 and tipo = 'doc_revisao'),
             'quem enviou não é avisado do próprio envio');

  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'de-novo.docx', '00000000-0000-0000-0000-000000000031')));
  perform ok(r->>'status' = 'ja_pendente', 'um envio por vez: com uma pendente, não entra outra');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'), 'caminho', arq('NRO-PES-007')::text || '/x/nunca-subiu.docx'));
  perform ok(r->>'status' in ('arquivo_nao_enviado','ja_pendente'), 'caminho sem arquivo no Storage não vira revisão');

  select id into v_rev from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado = 'pendente';
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', v_rev, 'decisao','aprovar'));
  perform ok(r->>'status' = 'mesma_pessoa', 'quem enviou não aprova a própria versão');
  perform eu(11, 'leitura');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', v_rev, 'decisao','aprovar'));
  perform ok(r->>'status' = 'sem_permissao', 'quem não é do grupo revisor não aprova');

  perform eu(23, 'leitura');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', v_rev, 'decisao','devolver'));
  perform ok(r->>'status' = 'invalido', 'devolver exige parecer');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', v_rev, 'decisao','devolver', 'parecer','Falta a etapa de devolução de crachá.'));
  perform ok(r->>'status' = 'ok', 'Diego devolve, com parecer');
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-007') = 'rascunho',
             'sem versão aprovada, o arquivo volta a rascunho');
  perform ok(exists (select 1 from notificacoes where registro = 31 and tipo = 'doc_devolvida'
                     and corpo like '%crachá%'), 'e a Elis recebe o parecer');

  perform eu(31, 'pessoal');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'desligamento-v2.docx', '00000000-0000-0000-0000-000000000031')));
  perform ok(r->>'rev' = 'A', 'o reenvio continua sendo a Rev. A: a devolvida não gasta letra');
  perform eu(23, 'leitura');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id',
        (select id from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado = 'pendente'), 'decisao','aprovar'));
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-007') = 'ativo'
             and (select rev_vigente from doc_arquivos where codigo = 'NRO-PES-007') = 'A'
             and (select rev_pendente from doc_arquivos where codigo = 'NRO-PES-007') is null,
             'aprovada: ativo, Rev. A em vigor');
  perform ok((select alterado_nome from doc_rol where codigo = 'NRO-PES-007') = 'Diego Prado',
             'e a última alteração é de quem aprovou');
end $$;

-- 6. relações e a conferência ao revisar
do $$ declare r jsonb; begin
  perform eu(31, 'pessoal');
  r := doc_relacao_salvar(jsonb_build_object('pai_id', arq('NRO-PES-007'), 'filho_id', arq('NRO-PES-008')));
  perform ok(r->>'status' = 'ok', 'o checklist de offboarding é filho do procedimento de desligamento');
  r := doc_relacao_salvar(jsonb_build_object('pai_id', arq('NRO-PES-008'), 'filho_id', arq('NRO-PES-007')));
  perform ok(r->>'status' = 'ciclo', 'e o procedimento não pode virar filho do checklist');

  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'rev-b.docx', '00000000-0000-0000-0000-000000000031')));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'mudancas', 'revisão sem dizer o que mudou é recusada');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'rev-b2.docx', '00000000-0000-0000-0000-000000000031'),
        'mudancas','Inclui a devolução de crachá.'));
  perform ok(r->>'status' = 'conferir_relacionados' and r->'faltam' = '["NRO-PES-008"]'::jsonb,
             'sem conferir o checklist, a revisão do procedimento não entra — e diz qual falta');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'rev-b3.docx', '00000000-0000-0000-0000-000000000031'),
        'mudancas','Inclui a devolução de crachá.',
        'relacionados', jsonb_build_array(jsonb_build_object('arquivo_id', arq('NRO-PES-008'), 'decisao','sem_mudanca'))));
  perform ok(r->>'status' = 'ok' and r->>'rev' = 'B', 'conferido, entra a Rev. B');
  perform ok((select relacionados->0->>'codigo' from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado = 'pendente') = 'NRO-PES-008',
             'e a conferência fica gravada na revisão, com o código');
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-007') = 'ativo'
             and (select rev_pendente from doc_arquivos where codigo = 'NRO-PES-007') = 'B',
             'enquanto isso a Rev. A continua em vigor — o arquivo segue ativo, com a B pendente');
  perform eu(23, 'leitura');
  perform doc_revisao_decidir(jsonb_build_object('revisao_id',
        (select id from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado = 'pendente'), 'decisao','aprovar'));
  perform ok((select rev_vigente from doc_arquivos where codigo = 'NRO-PES-007') = 'B'
             and (select estado from doc_revisoes where arquivo_id = arq('NRO-PES-007') and rev = 'A' and estado <> 'devolvida') = 'substituida',
             'aprovada a B, a A fica substituída');
end $$;

-- 7. registro: nasce do template, não se revisa
do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-003'),
        'caminho', sobe('NRO-PRO-003', 'modelo-relatorio.docx', '00000000-0000-0000-0000-000000000017')));
  perform ok(r->>'rev' = 'A', 'Carla, do P&D, envia o template do relatório de teste: Rev. A');
  perform ok(exists (select 1 from notificacoes where registro = 41 and tipo = 'doc_revisao'),
             'série sem grupo revisor: quem é avisado é o PMO');
  perform eu(41, 'leitura');
  perform doc_revisao_decidir(jsonb_build_object('revisao_id',
        (select id from doc_revisoes where arquivo_id = arq('NRO-PRO-003') and estado = 'pendente'), 'decisao','aprovar'));
  perform ok((select rev_vigente from doc_arquivos where codigo = 'NRO-PRO-003') = 'A', 'e o PMO aprova');

  perform eu(11, 'leitura');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-003-1'),
        'caminho', sobe('NRO-PRO-003-1', 'bancada2.pdf', '00000000-0000-0000-0000-000000000011')));
  perform ok(r->>'status' = 'ok' and r->>'rev' is null, 'o Bruno envia o registro — sem letra de revisão');
  perform ok((select template_rev from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1')) = 'A',
             'a revisão do registro é a do template usado (Rev. A), como manda o NRO-PUB-002');
  perform eu(41, 'leitura');
  perform doc_revisao_decidir(jsonb_build_object('revisao_id',
        (select id from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1') and estado = 'pendente'), 'decisao','aprovar'));
  perform ok((select status from doc_arquivos where codigo = 'NRO-PRO-003-1') = 'ativo'
             and (select template_rev from doc_arquivos where codigo = 'NRO-PRO-003-1') = 'A',
             'aprovado, o registro fica ativo, na Rev. A do template');
  perform eu(11, 'leitura');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-003-1'),
        'caminho', sobe('NRO-PRO-003-1', 'bancada2-b.pdf', '00000000-0000-0000-0000-000000000011')));
  perform ok(r->>'status' = 'registro_fechado', 'e não aceita revisão: registro diz o que aconteceu');
end $$;

-- 8. quem lê o conteúdo, por classe
do $$ begin
  perform eu(52, 'leitura');
  perform ok(doc_pode_ler(arq('NRO-PES-007')), 'público: a Gabi lê o procedimento');
  perform ok(doc_pode_ler(arq('NRO-PRO-001-1')), 'controlado: a Gabi lê o termo do NEBULA, porque está na equipe');
  perform eu(31, 'pessoal');
  perform ok(not doc_pode_ler(arq('NRO-PRO-001-1')), 'a Elis, de fora da equipe e do P&D, não');
  perform ok(doc_pode_ler(arq('NRO-PES-009')), 'confidencial: a Elis lê o quadro de pessoal (grupo de leitura)');
  perform eu(23, 'leitura');
  perform ok(doc_pode_ler(arq('NRO-PES-009')), 'o Diego também, porque revisa a série');
  perform eu(17, 'leitura');
  perform ok(not doc_pode_ler(arq('NRO-PES-009')), 'a Carla não');
  perform ok(doc_pode_ler(arq('NRO-PRO-003-2')), 'a Carla lê o que o P&D emite');
  perform eu(52, 'leitura');
  perform ok(not doc_pode_editar(arq('NRO-PES-007')), 'ler não é mexer: a Gabi não envia revisão do procedimento');
end $$;

-- 9. o Storage: o que se baixa, o que se envia
do $$ declare v_c text; v_ok text; r jsonb; begin
  perform eu(31, 'pessoal');
  v_c := sobe('NRO-PES-007', 'rev-c.docx', '00000000-0000-0000-0000-000000000031');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'), 'caminho', v_c,
        'mudancas','Ajuste de prazos.',
        'relacionados', jsonb_build_array(jsonb_build_object('arquivo_id', arq('NRO-PES-008'), 'decisao','revisado'))));
  select caminho into v_ok from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado = 'aprovada';

  perform eu(52, 'leitura');
  perform ok(doc_pode_baixar_objeto(v_ok), 'a Gabi baixa a Rev. B, aprovada e pública');
  perform ok(not doc_pode_baixar_objeto(v_c), 'mas não a Rev. C, pendente: até ser revisada, não está disponível');
  perform eu(23, 'leitura');
  perform ok(doc_pode_baixar_objeto(v_c), 'quem revisa baixa a pendente');
  perform eu(31, 'pessoal');
  perform ok(doc_pode_baixar_objeto(v_c), 'quem enviou também');
  perform eu(11, 'leitura');
  perform ok(doc_pode_baixar_objeto((select caminho from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1'))),
             'o Bruno baixa o registro do NEBULA');
  perform eu(31, 'pessoal');
  perform ok(not doc_pode_baixar_objeto((select caminho from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1'))),
             'a Elis não');
  perform ok(doc_pode_enviar_objeto(arq('NRO-PES-007')::text || '/x/y.docx'), 'a Elis envia para a pasta do procedimento');
  perform eu(52, 'leitura');
  perform ok(not doc_pode_enviar_objeto(arq('NRO-PES-007')::text || '/x/y.docx'), 'a Gabi não');
  perform ok(not doc_pode_enviar_objeto('nao-e-uuid/y.docx'), 'caminho fora do padrão, ninguém');

  -- quem enviou retira antes da revisão
  perform eu(31, 'pessoal');
  r := doc_revisao_cancelar(jsonb_build_object('revisao_id',
        (select id from doc_revisoes where caminho = v_c)));
  perform ok(r->>'status' = 'ok' and (select rev_pendente from doc_arquivos where codigo = 'NRO-PES-007') is null
             and (select status from doc_arquivos where codigo = 'NRO-PES-007') = 'ativo',
             'Elis retira a Rev. C; a B segue em vigor');
end $$;

-- 10. obsoleto
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := doc_arquivo_obsoletar(jsonb_build_object('arquivo_id', arq('NRO-PES-008'), 'motivo','x'));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno não torna obsoleto o que o Pessoal emite');
  perform eu(31, 'pessoal');
  r := doc_arquivo_obsoletar(jsonb_build_object('arquivo_id', arq('NRO-PES-008')));
  perform ok(r->>'status' = 'invalido', 'obsoleto pede motivo');
  r := doc_arquivo_obsoletar(jsonb_build_object('arquivo_id', arq('NRO-PES-008'), 'motivo','Incorporado ao procedimento.'));
  perform ok((select status from doc_arquivos where codigo = 'NRO-PES-008') = 'obsoleto', 'Elis torna o checklist obsoleto');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-008'),
        'caminho', arq('NRO-PES-008')::text || '/x/y.docx'));
  perform ok(r->>'status' = 'obsoleto', 'arquivo obsoleto não recebe versão');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PES-007'),
        'caminho', sobe('NRO-PES-007', 'rev-c2.docx', '00000000-0000-0000-0000-000000000031'),
        'mudancas','Sem o checklist.'));
  perform ok(r->>'status' = 'ok', 'e filho obsoleto não precisa mais de conferência');
  perform ok(exists (select 1 from doc_eventos where arquivo_id = arq('NRO-PES-008') and tipo = 'obsoletou'),
             'o obsoleto fica no registro de alterações');
end $$;

-- 11. revisão vinda da planilha: anexar o arquivo depois
do $$ declare r jsonb; v_rev uuid; begin
  perform eu(41, 'leitura');
  r := doc_serie_salvar(jsonb_build_object('prefixo','PUB','sn',2,'titulo','TEMPLATE DE DOCUMENTOS E REGISTROS',
        'tipo','documento','subtipo','template','classe','publico'));
  perform ok((select natureza from doc_rol where codigo = 'NRO-PUB-002') = 'template',
             'série de subtipo template é template, mesmo sem PN');
  insert into doc_revisoes (arquivo_id, rev, estado, enviado_nome, enviado_em, revisado_em, importada)
  values (arq('NRO-PUB-002'), 'A', 'aprovada', 'MMARCONDES', '2026-04-07', '2026-04-07', true) returning id into v_rev;
  update doc_arquivos set status = 'ativo', rev_vigente = 'A' where codigo = 'NRO-PUB-002';

  perform eu(11, 'leitura');
  r := doc_revisao_anexar(jsonb_build_object('revisao_id', v_rev,
        'caminho', sobe('NRO-PUB-002', 'template.docx', '00000000-0000-0000-0000-000000000011')));
  perform ok(r->>'status' = 'sem_permissao', 'só o gestor anexa arquivo a revisão importada');
  perform eu(41, 'leitura');
  r := doc_revisao_anexar(jsonb_build_object('revisao_id', v_rev,
        'caminho', sobe('NRO-PUB-002', 'template2.docx', '00000000-0000-0000-0000-000000000041')));
  perform ok(r->>'status' = 'ok', 'o PMO anexa o .docx à Rev. A importada, sem nova revisão');
  r := doc_revisao_anexar(jsonb_build_object('revisao_id', v_rev,
        'caminho', sobe('NRO-PUB-002', 'template3.docx', '00000000-0000-0000-0000-000000000041')));
  perform ok(r->>'status' = 'ja_tem_arquivo', 'uma vez só');

  -- um template pode servir a arquivos de outras séries
  perform eu(31, 'pessoal');
  r := doc_arquivo_editar(jsonb_build_object('id', arq('NRO-PES-007'), 'template_id', arq('NRO-PUB-002')));
  perform ok(r->>'status' = 'ok' and (select template_rev from doc_arquivos where codigo = 'NRO-PES-007') = 'A',
             'o procedimento passa a dizer que usa o NRO-PUB-002, na Rev. A');
  r := doc_arquivo_editar(jsonb_build_object('id', arq('NRO-PES-007'), 'template_id', arq('NRO-PES-009')));
  perform ok(r->>'status' = 'ok', 'o quadro de pessoal é template (série de registro), então também serve');
  r := doc_arquivo_editar(jsonb_build_object('id', arq('NRO-PES-007'), 'template_id', arq('NRO-PRO-003-1')));
  perform ok(r->>'status' = 'invalido', 'mas um registro não é template de nada');
end $$;

-- 12. letras e mudanças de configuração
do $$ declare r jsonb; begin
  perform ok(doc_proxima_rev(null) = 'A' and doc_proxima_rev('A') = 'B' and doc_proxima_rev('Z') = 'AA'
             and doc_proxima_rev('AZ') = 'BA', 'as letras seguem A, B… Z, AA, AB, como colunas de planilha');
  perform eu(41, 'leitura');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PRO-003'), 'tipo','documento'));
  perform ok(r->>'status' = 'tem_pn', 'série com PN não muda de tipo');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PES-007'), 'grupo_revisor', grupo_pessoal()));
  perform ok(r->>'status' = 'ok' and exists (select 1 from doc_eventos where arquivo_id = arq('NRO-PES-007') and tipo = 'revisor'),
             'trocar o grupo revisor fica no registro de alterações');
end $$;

-- 13. RLS, como usuário comum (a política vale de verdade)
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
set role authenticated;
do $$ declare n integer; pegou boolean := false; begin
  perform eu(31, 'pessoal');
  select count(*) into n from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1');
  perform ok(n = 0, 'RLS: a Elis não vê as revisões do registro do NEBULA');
  select count(*) into n from doc_arquivos where codigo = 'NRO-PRO-003-1';
  perform ok(n = 1, 'mas vê que o arquivo existe (metadados são da equipe)');
  perform eu(11, 'leitura');
  select count(*) into n from doc_revisoes where arquivo_id = arq('NRO-PRO-003-1');
  perform ok(n = 1, 'o Bruno vê');
  begin
    insert into doc_emissores(prefixo, nome) values ('XYZ', 'Intruso');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'RLS: o Bruno não cria emissor');
  pegou := false;
  begin
    insert into projetos(codigo, nome, grupo_id, logo_semente) values ('HACK', 'x', gid('Sinais'), 'x');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem projeto direto na tabela');
  pegou := false;
  begin
    insert into storage.objects (bucket_id, name) values ('arquivos', arq('NRO-PES-009')::text || '/x/furo.xlsx');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem sobe arquivo para a pasta do quadro de pessoal, que é confidencial');
  select count(*) into n from storage.objects
   where name like arq('NRO-PES-007')::text || '/%' and bucket_id = 'arquivos';
  perform ok(n = (select count(*) from doc_revisoes where arquivo_id = arq('NRO-PES-007') and estado in ('aprovada','substituida')),
             'no bucket, o Bruno enxerga só as versões aprovadas do procedimento');
  perform eu(41, 'leitura');
  insert into doc_padrao_projeto(serie_id, quantidade) values (ser('NRO-PES-009'), 'varios');
  perform ok(true, 'o PMO mexe no padrão de projeto direto na tabela');
end $$;
reset role;

-- 14. rodar a 20.0 de novo não duplica nada
\ir ../v20_projetos_arquivos.sql
do $$ begin
  perform ok((select count(*) from grupos where chave = 'projetos') = 1
             and (select count(*) from grupos where nome = 'NRO_PROJECTS') = 1,
             'rodar a 20.0 de novo não cria outro NRO_PROJECTS');
  perform ok((select count(*) from projetos) = 1 and (select count(*) from doc_series) = 6,
             'nem mexe em projeto ou série');
  perform ok((select count(*) from migracoes where id = 'v20_projetos_arquivos') = 1, 'e registra a migração uma vez só');
end $$;
