\set ON_ERROR_STOP on
\pset pager off
set check_function_bodies = off;
-- ============================================================
-- Teste da 2.20.0, o aproveitamento de AACC.
-- Rode num banco com o esqueleto (e o de Storage), a 15.0 a 25.0, e
-- AINDA SEM a 2.20.0: o teste cria os grupos das etapas e roda a
-- migração (duas vezes no meio, e de novo no fim).
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), false);
  perform set_config('teste.papel', p_papel, false);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false);
end $$;
-- os ajudantes que leem as tabelas são security definer: o teste roda
-- quase tudo como authenticated, onde a RLS não deixa ler nada direto
create or replace function conta(p_sql text) returns integer language plpgsql security definer as $$
declare n integer; begin execute 'select count(*)::integer from (' || p_sql || ') q' into n; return n; end $$;
create or replace function st(j jsonb) returns text language sql as $$ select j->>'status' $$;
-- o PDF que o template escreve: keywords como a classe põe
create or replace function kw(p_doc text, p_extra text default '') returns text language sql as $$
  select 'nro-aacc ; documento = ' || p_doc || ' ; modo = final ; pendencias = 0 ; folha = 2 ; principal = EQC'
         || ' ; creditos = 16 ; principalcreditos = 15 ; semestres = 5 ; itens = 1 ; exemplo = nao' || p_extra $$;
create or replace function enviar(p_id uuid, p_cam text, p_kw text, p_pag integer default 40) returns jsonb language sql as $$
  select aacc_enviar(jsonb_build_object('id', p_id, 'caminho', p_cam, 'sha256', repeat('ab', 32),
                                        'paginas', p_pag, 'bytes', 123456, 'keywords', p_kw)) $$;
create or replace function subir(p_cam text) returns void language sql as $$
  insert into storage.objects (bucket_id, name) values ('aproveitamento', p_cam) $$;
create or replace function url_assinada(p_cam text) returns text language sql as $$
  select 'https://x.supabase.co/storage/v1/object/sign/aproveitamento/' || p_cam || '?token=abc' $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    NRO_PMO                  aprova a 1ª etapa
--   17 Carla    Órtese                   pede (ativa)
--   23 Diego    NRO_COORD_OFFICE         aprova a 3ª (a Diretoria) e indica o professor
--   31 Elis     Depto de Pessoal (papel pessoal)
--   52 Gabi     Depto de Pessoal         aprova a 2ª
--   60 Hugo     egresso                  pede (desligado)
--   70 Iara     NRO_PMO e NRO_COORD_OFFICE
-- ------------------------------------------------------------
alter table membros add column if not exists data_ingresso date;
alter table membros add column if not exists data_desligamento date;
alter table membros add column if not exists telefone text;
create table if not exists dados_pessoais (registro integer primary key references membros(registro));
alter table dados_pessoais add column if not exists cpf text;
alter table dados_pessoais add column if not exists data_nascimento date;
do $$ declare c text; begin
  foreach c in array array['genero','endereco','cidade_origem','instituicao','curso','matricula','periodo_ingresso',
    'tempo_deslocamento','autodeclaracao_racial','situacao_fump','acessibilidade','lattes','instagram','github'] loop
    execute format('alter table dados_pessoais add column if not exists %I text', c);
  end loop;
end $$;
insert into grupos (nome, prefixo) values ('NRO_PMO', 'PMO'), ('NRO_COORD_OFFICE', 'CDO') on conflict do nothing;
insert into membros(registro, nome, grupos, status, email_nro) values
  (52, 'Gabi Rocha', '{"Depto de Pessoal"}', 'Ativo', 'gabi@nro.dev'),
  (60, 'Hugo Lima',  '{Órtese}',            'Desligado', 'hugo@nro.dev'),
  (70, 'Iara Souza', '{NRO_PMO,NRO_COORD_OFFICE}', 'Ativo', 'iara@nro.dev')
on conflict do nothing;
update membros set grupos = grupos || '{NRO_PMO}' where registro = 11;
update membros set grupos = grupos || '{NRO_COORD_OFFICE}' where registro = 23;
update membros set cargo = 'Projetista de hardware', data_ingresso = '2023-03-01' where registro = 17;
update membros set cargo = 'Pesquisador', data_ingresso = '2024-03-01', data_desligamento = '2026-05-31' where registro = 60;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52),
  ('00000000-0000-0000-0000-000000000060', 'hugo@nro.dev',  'leitura', 60),
  ('00000000-0000-0000-0000-000000000070', 'iara@nro.dev',  'leitura', 70)
on conflict do nothing;
-- um afastamento aprovado da Carla (agosto a novembro de 2024) e um
-- recusado, que não conta
insert into portal_solicitacoes (registro, tipo, status, titulo, protocolo, dados) values
  (17, 'afastamento', 'aprovada', 'Intercâmbio', 'SOL-0001', '{"data_inicio":"2024-08-05","data_fim":"2024-11-28","motivo":"Intercâmbio"}'),
  (17, 'afastamento', 'recusada', 'Viagem', 'SOL-0002', '{"data_inicio":"2025-03-01","data_fim":"2025-06-30","motivo":"Viagem"}');
insert into treinamento_conclusoes (certificado, registro, nome, codigo, titulo, revisao, carga_horaria_min, concluido_em)
values ('CERT-AACC-0001', 17, 'Carla Mendonça', 'NRO-TRE-003', 'Segurança elétrica em bancada', 'A', 240, '2023-05-10 14:00-03')
on conflict do nothing;

\ir ../2.20.0_aproveitamento.sql
\ir ../2.20.0_aproveitamento.sql

create or replace function ped(p_reg integer) returns aacc_pedidos language sql security definer as $$
  select * from aacc_pedidos where registro = p_reg order by criado_em desc, numero desc limit 1 $$;
create or replace function token_do(p_id uuid) returns text language sql security definer as $$
  select substring(dados->>'url' from 'p=([0-9a-f]{64})$') from doc_envios
   where tipo = 'aacc_professor' and dados->>'pedido' = (select codigo from aacc_pedidos where id = p_id)
   order by id desc limit 1 $$;

-- ------------------------------------------------------------
-- 1. a semente
-- ------------------------------------------------------------
do $$ begin
  perform ok((select grupos = array[gid('NRO_PMO'), gid('Depto de Pessoal'), gid('NRO_COORD_OFFICE')] from aacc_config),
             'as etapas nascem PMO, Pessoal e Diretoria, pelo nome dos grupos');
  perform ok((select rotulos = array['PMO','Departamento de Pessoal','Diretoria'] from aacc_config), 'com os nomes da folha');
  perform ok((select barema->0->>'descritor' like 'As atividades se relacionam com o curso%'
                     and barema->2->>'descritor' like 'Fica claro o que foi feito%' from aacc_config),
             'o barema diz o mesmo que o template, sem "o estudante"');
  perform ok(exists (select 1 from information_schema.columns where table_name = 'dados_pessoais' and column_name = 'pronomes'),
             'o recadastro ganha os pronomes');
  perform ok((select public.doc_codigo(s.prefixo, s.sn, null) from doc_series s where s.id = (select serie from aacc_config))
             = 'NRO-PES-020', 'a série do relatório é a NRO-PES-020');
  perform ok((select pn_origem from doc_series where prefixo = 'PES' and sn = 20) like 'Os PNs desta série não são registrados no rol%',
             'cujos PNs não moram no rol');
  perform ok((select count(*) from doc_series where titulo = 'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC') = 1,
             'rodar duas vezes não duplica a série');
  perform ok((select count(*) from doc_arquivos a join doc_series s on s.id = a.serie_id where s.prefixo = 'PES' and s.sn = 20
               and a.pn is null) = 1, 'nem a cabeça da série');
  perform ok(exists (select 1 from storage.buckets where id = 'aproveitamento' and not public
                       and allowed_mime_types = array['application/pdf']), 'o bucket é privado e só aceita PDF');
  perform ok((select pg_get_constraintdef(oid) like '%aproveitamento%' from pg_constraint
               where conrelid = 'public.doc_emitidos'::regclass and conname = 'doc_emitidos_tipo_check'),
             'doc_emitidos aceita o tipo aproveitamento');
  perform ok((select count(*) from migracoes where id = '2.20.0_aproveitamento') = 1, 'a migração fica registrada');
end $$;

-- a etapa sem grupo se preenche ao rodar de novo; a escolhida não muda
update aacc_config set grupos = array[null, gid('Depto de Pessoal'), gid('NRO_COORD_OFFICE')];
\ir ../2.20.0_aproveitamento.sql
do $$ begin
  perform ok((select grupos[1] = gid('NRO_PMO') from aacc_config), 'rodar de novo preenche a etapa que ficou sem grupo');
end $$;
update aacc_config set grupos = array[gid('NRO_PMO'), gid('Sinais'), gid('NRO_COORD_OFFICE')];
\ir ../2.20.0_aproveitamento.sql
do $$ begin
  perform ok((select grupos[2] = gid('Sinais') from aacc_config), 'e não mexe na etapa que alguém escolheu');
end $$;
update aacc_config set grupos = array[gid('NRO_PMO'), gid('Depto de Pessoal'), gid('NRO_COORD_OFFICE')];
-- quem rodou a versão anterior fica com a Diretoria e os textos novos do barema
update aacc_config set rotulos[3] = 'Coordenação',
       barema = jsonb_set(jsonb_set(barema, '{0,descritor}', '"As atividades são de engenharia do curso do estudante, e a relação está demonstrada."'),
                          '{3,descritor}', '"Cada atividade tem evidências verificáveis (códigos no SOMA, repositórios), e as horas batem."');
\ir ../2.20.0_aproveitamento.sql
do $$ begin
  perform ok((select rotulos[3] = 'Diretoria' from aacc_config), 'rodar de novo troca a Coordenação pela Diretoria');
  perform ok((select barema->0->>'descritor' like 'As atividades se relacionam com o curso%'
                     and barema->3->>'descritor' = 'Cada atividade tem evidências verificáveis (registros no SOMA, repositórios), e as horas batem.'
                     and jsonb_array_length(barema) = 6 from aacc_config), 'e os textos antigos do barema, sem mexer nos outros');
end $$;
update aacc_config set rotulos[3] = 'Comitê';
\ir ../2.20.0_aproveitamento.sql
do $$ begin
  perform ok((select rotulos[3] = 'Comitê' from aacc_config), 'o nome que alguém escolheu não muda');
end $$;
update aacc_config set rotulos[3] = 'Diretoria';

-- ------------------------------------------------------------
-- 2. o semestre de ingresso e os semestres letivos
-- ------------------------------------------------------------
do $$ declare s jsonb; begin
  perform ok(aacc_ingresso('2021/1') = '2021/1' and aacc_ingresso('2021.2') = '2021/2' and aacc_ingresso(' 2021-1 ') = '2021/1',
             'o ingresso aceita 2021/1, 2021.2 e 2021-1');
  perform ok(aacc_ingresso('1/2021') = '2021/1' and aacc_ingresso('2º semestre de 2020') = '2020/2'
             and aacc_ingresso('2022/1º sem') = '2022/1', 'e 1/2021, 2º semestre de 2020, 2022/1º sem');
  perform ok(aacc_ingresso('2021/3') is null and aacc_ingresso('') is null and aacc_ingresso(null) is null
             and aacc_ingresso('março de 2021') is null, 'e recusa o que não é semestre');

  s := aacc_semestres('2023-03-01', '2025-06-30', '2022/2', '[]', 4);
  perform ok(jsonb_array_length(s) = 5, 'de março de 2023 a junho de 2025 são cinco semestres');
  perform ok((select bool_and(e->>'situacao' = 'conta') from jsonb_array_elements(s) e), 'e todos contam');
  perform ok(s->0->>'rotulo' = '2023/1' and (s->0->>'meses')::int = 5 and s->4->>'rotulo' = '2025/1',
             'o primeiro é 2023/1, com cinco meses (março a julho); o último, 2025/1');

  s := aacc_semestres('2023-03-01', '2025-06-30', '2024/1', '[]', 4);
  perform ok(s->0->>'situacao' = 'antes' and s->1->>'situacao' = 'antes' and s->2->>'situacao' = 'conta',
             'o semestre anterior ao ingresso no curso não conta (art. 5º)');

  s := aacc_semestres('2023-03-01', '2025-06-30', '2022/2', '[{"inicio":"2024-08-05","fim":"2024-11-28"}]', 4);
  perform ok(s->3->>'rotulo' = '2024/2' and (s->3->>'meses')::int = 2 and s->3->>'situacao' = 'parcial',
             'quatro meses de afastamento deixam o 2024/2 com dois: parcial');

  s := aacc_semestres('2023-01-15', '2023-07-10', null, '[]', 4);
  perform ok(s->0->>'rotulo' = '2022/2' and (s->0->>'meses')::int = 1 and s->1->>'rotulo' = '2023/1'
             and (s->1->>'meses')::int = 6, 'janeiro é do 2º semestre do ano anterior');

  s := aacc_semestres('2023-03-01', '2023-05-31', null, '[{"inicio":"lixo","fim":"2023-04-01"}]', 4);
  perform ok(jsonb_array_length(s) = 1 and s->0->>'situacao' = 'parcial', 'afastamento com data ruim se ignora, sem erro');
  perform ok(aacc_semestres(null, '2025-01-01', null, null, 4) = '[]' and aacc_semestres('2025-01-01', '2024-01-01', null, null, 4) = '[]',
             'sem entrada, ou com saída antes da entrada, não há semestre');
end $$;

-- ------------------------------------------------------------
-- 3. a ficha e a preparação
-- ------------------------------------------------------------
do $$ declare r jsonb; begin
  perform eu(null, 'leitura');
  perform ok(st(aacc_meu()) = 'sem_registro', 'sem registro, nada');
  perform eu(17, 'leitura');
  r := aacc_meu();
  perform ok(st(r) = 'ok' and r#>>'{membro,nome}' = 'Carla Mendonça', 'a Carla abre a página');
  perform ok(r->'bloqueios' ? 'recadastro' and r->'bloqueios' ? 'ingresso' and not (r->'bloqueios' ? 'entrada'),
             'falta o recadastro e o ingresso; a entrada na equipe o Pessoal já registrou');
  perform ok(jsonb_array_length(r#>'{membro,afastamentos}') = 1 and r#>>'{membro,afastamentos,0,protocolo}' = 'SOL-0001',
             'o afastamento aprovado vem do portal; o recusado não');
  perform ok(r#>>'{membro,treinamentos,0,codigo}' = 'NRO-TRE-003', 'e os treinamentos concluídos');
  perform ok(r#>>'{membro,situacao}' = 'ativo' and r#>>'{membro,fim}' is null, 'ativa: sem data de saída');
  perform ok(r#>>'{serie,codigo}' = 'NRO-PES-020' and r#>>'{config,n_etapas}' = '3', 'a série e as três etapas');
  perform ok(r->'pedido' = 'null'::jsonb, 'e ainda não há pedido');

  r := aacc_preparar('{"principal":"EQC"}');
  perform ok(st(r) = 'incompleto' and r->'bloqueios' ? 'recadastro', 'sem o recadastro, não prepara');

  perform ok(st(aacc_perfil_salvar('{"cpf":"123"}')) = 'invalido', 'CPF com menos de 11 dígitos não passa');
  perform ok(st(aacc_perfil_salvar('{"periodo_ingresso":"março"}')) = 'invalido', 'nem ingresso que não é semestre');
  perform ok(st(aacc_perfil_salvar('{"email_pessoal":"carla@"}')) = 'invalido', 'nem e-mail sem domínio');
  perform ok(st(aacc_perfil_salvar('{"registro":"99"}')) = 'invalido', 'nem campo fora da ficha');
  perform ok(st(aacc_perfil_salvar('{"data_nascimento":"31/02/2001"}')) = 'invalido', 'nem data que não existe');
  perform ok(aacc_perfil_salvar('{"pronomes":"dela"}')->>'campo' = 'pronomes', 'os pronomes são ela, ele ou elu');
  perform ok(aacc_meu()#>'{membro,faltam}' ? 'pronomes', 'e faltam na ficha');
  r := aacc_perfil_salvar('{"email_pessoal":"Carla.M@Exemplo.com","telefone":"(31) 99999-0000","cpf":"091.695.076-00",
    "data_nascimento":"2001-04-02","endereco":"Rua A, 1","cidade_origem":"Belo Horizonte","instituicao":"UFMG",
    "curso":"Engenharia Elétrica","matricula":"2022012345","periodo_ingresso":"2º semestre de 2022","genero":"Feminino",
    "pronomes":"Ela","autodeclaracao_racial":"Parda"}');
  perform ok(st(r) = 'ok' and (r->>'campos')::int = 13, 'a ficha completa salva os treze campos');
  perform ok(r#>>'{membro,pronomes}' = 'ela', 'os pronomes, em minúsculas');
  perform ok((select email_pessoal from membros where registro = 17) = 'carla.m@exemplo.com', 'o e-mail pessoal vai para a ficha, em minúsculas');
  perform ok((select periodo_ingresso from dados_pessoais where registro = 17) = '2022/2', 'o ingresso se guarda como AAAA/S');
  perform ok(jsonb_array_length(r#>'{membro,faltam}') = 0, 'e não falta mais nada');
  r := aacc_meu();
  perform ok(jsonb_array_length(r->'bloqueios') = 0, 'nada trava o download');
  perform ok(r#>>'{semestres,3,rotulo}' = '2024/2' and r#>>'{semestres,3,situacao}' = 'parcial',
             'o afastamento deixa o 2024/2 parcial');

  perform ok(st(aacc_preparar('{"principal":"XYZ"}')) = 'invalido', 'enquadramento que não existe não passa');
  perform ok(st(aacc_preparar('{"principal":"EQC","alternativas":["PUB"]}')) = 'invalido', 'publicação não é participação: é item à parte');
  perform ok(aacc_preparar('{"principal":"EXT"}')->>'campo' = 'siex', 'extensão pede os semestres do SIEX');
  r := aacc_preparar('{"principal":"EXT","siex":["2024/2"]}');
  perform ok(r->>'campo' = 'siex' and r->>'semestre' = '2024/2', 'e só aceita semestre que conta');
  perform ok(st(aacc_preparar('{"principal":"IC"}')) = 'invalido'
             and aacc_preparar('{"principal":"EQC","alternativas":["IC"]}')->>'campo' = 'alternativas',
             'iniciação científica não é enquadramento da equipe');
  perform ok(aacc_preparar('{"principal":"OUT"}')->>'campo' = 'outro', 'OUT pede o nome do enquadramento');
  perform ok(aacc_preparar('{"principal":"OUT","outro":"Atividade complementar de extensão"}')->>'campo' = 'norma',
             'e a norma do Colegiado');
  perform ok(aacc_preparar('{"principal":"OUT","outro":"Atividade complementar de extensão","norma":"Resolução nº 05/2020",
             "alternativas":["EQC"]}')->>'campo' = 'alternativas', 'OUT não tem alternativas da Resolução 02/2019');
  perform ok(aacc_preparar('{"principal":"EQC","alternativas":["OUT"]}')->>'campo' = 'alternativas', 'nem é alternativa');
  r := aacc_preparar('{"principal":"out","outro":" Atividade complementar de extensão ",
                       "norma":"Resolução nº 05/2020, do Colegiado do Curso de Fisioterapia"}');
  perform ok(st(r) = 'ok' and r#>>'{pedido,pedido,principal}' = 'OUT' and r#>>'{pedido,pedido,outro}' = 'Atividade complementar de extensão'
             and r#>>'{pedido,pedido,normacurta}' = r#>>'{pedido,pedido,norma}', 'OUT guarda o nome e a norma (a curta, se não vier, é a mesma)');
  r := aacc_preparar('{"principal":"eqc","alternativas":["VPC","EQC","vpc","EXT"],"siex":["2023/2","2024/1"],
                       "colegiado":"Colegiado do Curso de Graduação em Engenharia Elétrica"}');
  perform ok(st(r) = 'ok', 'a Carla prepara: EQC, com VPC e EXT de alternativas');
  perform ok(r#>'{pedido,pedido,alternativas}' = '["VPC","EXT"]', 'as alternativas sem repetir nem o principal');
  perform ok(r#>>'{pedido,status}' = 'preparacao' and r#>>'{pedido,codigo}' like 'AAC-%', 'o pedido nasce em preparação, com código AAC');
  perform ok(r#>>'{pedido,documento}' = 'NRO-PES-020-' || (r#>>'{pedido,numero}'), 'o relatório é o NRO-PES-020 com o número do pedido');
  perform ok(r#>'{pedido,pedido}' ? 'outro' and r#>>'{pedido,pedido,outro}' is null, 'e voltar ao EQC limpa o OUT');
  perform ok(st(aacc_preparar('{"principal":"EQC","alternativas":["VPC"]}')) = 'ok', 'preparar de novo muda o mesmo pedido');
  perform ok((select count(*) from aacc_pedidos where registro = 17) = 1, 'sem criar outro');
  perform ok((select count(*) from aacc_historico where pedido_id = (ped(17)).id) = 3, 'e cada preparação fica no histórico');
end $$;

-- ------------------------------------------------------------
-- 4. o envio, como authenticated (o que a API do Supabase faz)
-- ------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
set role authenticated;
do $$ declare p aacc_pedidos := ped(17); doc text := 'NRO-PES-020-' || (ped(17)).numero; cam text; pegou text; n integer;
begin
  perform eu(17, 'leitura');
  cam := '17/' || p.id || '/v1-abababab.pdf';
  select count(*) into n from aacc_pedidos;
  perform ok(n = 0, 'pela API, aacc_pedidos não se lê (RLS sem política)');
  perform ok(st(aacc_enviar(jsonb_build_object('id', gen_random_uuid()))) = 'nao_encontrado', 'pedido que não existe');
  perform ok(enviar(p.id, '11/' || p.id || '/v1.pdf', kw(doc))->>'campo' = 'caminho', 'o PDF tem de estar na pasta dela');
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'sem_arquivo', 'e tem de estar no bucket');

  -- o upload, pela política do Storage
  perform eu(11, 'leitura');
  begin perform subir(cam); exception when insufficient_privilege then pegou := 'rls'; end;
  perform ok(pegou = 'rls', 'o Bruno não sobe PDF na pasta da Carla');
  perform eu(17, 'leitura'); pegou := null;
  begin perform subir('17/' || p.id || '/v1.exe'); exception when insufficient_privilege then pegou := 'rls'; end;
  perform ok(pegou = 'rls', 'nem a Carla sobe o que não é PDF');
  perform subir(cam);
  perform ok(conta('select 1 from storage.objects where name = ' || quote_literal(cam)) = 1, 'a Carla sobe o dela');
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 1, 'e lê o que subiu');
  perform eu(11, 'leitura');
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 0, 'quem aprova ainda não lê: o pedido não foi enviado');

  perform eu(11, 'leitura');
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'nao_encontrado', 'só a dona envia');
  perform eu(17, 'leitura');
  perform ok(st(enviar(p.id, cam, 'outro ; documento = ' || doc)) = 'nao_template', 'PDF que não é do template não entra');
  perform ok(st(enviar(p.id, cam, replace(kw(doc), 'exemplo = nao', 'exemplo = sim'))) = 'exemplo', 'nem o exemplo');
  perform ok(enviar(p.id, cam, kw('NRO-PES-020-999'))->>'esperado' = doc, 'nem o de outro pedido');
  perform ok(st(enviar(p.id, cam, replace(kw(doc), 'modo = final', 'modo = rascunho'))) = 'rascunho', 'nem o rascunho');
  perform ok(enviar(p.id, cam, replace(kw(doc), 'pendencias = 0', 'pendencias = 3'))->>'pendencias' = '3', 'nem o que tem pendência');
  perform ok(st(enviar(p.id, cam, replace(kw(doc), 'pendencias = 0', 'pendencias = ?'))) = 'pendencias', 'nem o que não sabe se tem');
  perform ok(st(enviar(p.id, cam, replace(kw(doc), 'principal = EQC', 'principal = VPC'))) = 'outro_enquadramento',
             'nem o de outro enquadramento');
  perform ok(st(enviar(p.id, cam, replace(kw(doc), 'folha = 2', 'folha = 1'))) = 'sem_folha', 'nem sem a folha reservada');
  perform ok(st(enviar(p.id, cam, kw(doc), 1)) = 'sem_folha', 'nem com a folha depois da última página');
  perform ok(aacc_enviar(jsonb_build_object('id', p.id, 'caminho', cam, 'sha256', repeat('ab', 32), 'paginas', 'x',
               'keywords', kw(doc)))->>'campo' = 'paginas', 'nem com páginas que não são número');
  perform ok(aacc_enviar(jsonb_build_object('id', p.id, 'caminho', cam, 'sha256', 'abc', 'paginas', 40,
               'keywords', kw(doc)))->>'campo' = 'sha256', 'nem sem o SHA-256');
end $$;

do $$ declare p aacc_pedidos := ped(17); doc text := 'NRO-PES-020-' || (ped(17)).numero; cam text; r jsonb; n integer;
begin
  perform eu(17, 'leitura');
  cam := '17/' || p.id || '/v1-abababab.pdf';
  r := enviar(p.id, cam, kw(doc));
  perform ok(st(r) = 'ok' and (r->>'etapa')::int = 1, 'o PDF certo entra na etapa 1');
  perform ok((r->>'avisados')::int = 2, 'e avisa as duas pessoas do PMO');
  p := ped(17);
  perform ok(p.status = 'analise' and p.versao = 1 and p.folha = 2 and p.pdf_paginas = 40, 'em análise, versão 1, folha 2');
  perform ok(p.pdf_meta->>'principalcreditos' = '15' and not (p.pdf_meta ? '_template'), 'os metadados do PDF ficam guardados');
  perform ok(conta('select 1 from notificacoes where registro in (11, 70) and tipo = ''aacc'' and titulo like ''%aguarda a sua aprovação''') = 2,
             'o Bruno e a Iara recebem no sino');
  perform ok(conta('select 1 from notificacoes where registro = 23 and tipo = ''aacc''') = 0, 'a Coordenação ainda não');
  perform ok(conta('select 1 from doc_envios where tipo = ''aacc_membro'' and registro = 17 and dados->>''acao'' = ''recebido''') = 1,
             'a Carla recebe o e-mail de recebido');
  perform ok(conta('select 1 from notificacoes where registro = 17 and tipo = ''aacc'' and email_em is not null') = 1,
             'e o aviso no sino, já dado por enviado (o e-mail é o da fila de documentos)');
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'fora_de_envio', 'em análise, não se envia de novo');
  perform ok(st(aacc_preparar('{"principal":"VPC"}')) = 'em_andamento', 'nem se muda o enquadramento');
  perform ok(aacc_pendentes() = 0, 'a Carla não tem nada a aprovar');

  perform eu(11, 'leitura');
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 1, 'enviado, quem aprova lê o PDF');
  perform ok(aacc_pendentes() = 1, 'e o Bruno tem um pedido a aprovar');
  perform eu(60, 'leitura');
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 0, 'o Hugo, que não aprova, não lê');
  perform ok(st(aacc_ler(p.codigo)) = 'nao_encontrado', 'nem abre o pedido');
  perform ok(jsonb_array_length(aacc_lista()) = 0, 'nem o vê na lista');
  perform eu(17, 'leitura');
  perform ok(st(aacc_cancelar(p.id, null)) = 'invalido', 'cancelar pede o motivo');
end $$;

-- ------------------------------------------------------------
-- 5. as etapas: uma pessoa de cada grupo
-- ------------------------------------------------------------
do $$ declare p aacc_pedidos := ped(17); r jsonb; begin
  perform eu(23, 'leitura');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'sem_permissao',
             'o Diego, da Coordenação, não decide a etapa do PMO');
  perform eu(11, 'leitura');
  r := aacc_ler(p.codigo);
  perform ok(st(r) = 'ok' and (r#>>'{pode,decidir}')::boolean and not (r#>>'{pode,indicar}')::boolean,
             'o Bruno abre o pedido e pode decidir, sem indicar professor');
  perform ok(jsonb_array_length(r->'etapas') = 3 and r#>>'{etapas,1,grupo}' = 'Depto de Pessoal', 'a página lista as três etapas');
  perform ok(not (r#>>'{pode,reabrir}')::boolean and not (r#>>'{pode,cancelar}')::boolean, 'e não reabre nem cancela o pedido dos outros');
  perform ok(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'devolver'))->>'campo' = 'parecer', 'devolver pede o motivo');
  perform ok(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'talvez'))->>'campo' = 'decisao', 'e a decisão é aprovar ou devolver');
  r := aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar', 'parecer', 'Documentos do PMO conferidos.'));
  perform ok(st(r) = 'ok' and (r->>'etapa')::int = 2, 'o Bruno aprova: etapa 2');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'sem_permissao', 'e não decide a do Pessoal');
  perform ok(aacc_pendentes() = 0, 'nem a tem como pendente');
  perform ok(conta('select 1 from notificacoes where registro in (31, 52) and titulo like ''%aguarda a sua aprovação''') = 2,
             'o Pessoal recebe no sino');
  perform ok(conta('select 1 from doc_envios where registro = 17 and dados->>''acao'' = ''etapa''') = 1, 'a Carla, o e-mail da etapa');

  perform eu(52, 'leitura');
  r := aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'devolver', 'parecer', 'Falta o afastamento de 2024 na Parte II.'));
  perform ok(st(r) = 'ok' and r->>'situacao' = 'devolvido', 'a Gabi devolve');
  p := ped(17);
  perform ok(p.status = 'devolvido' and p.etapa = 0 and p.motivo like 'Falta o afastamento%', 'o pedido volta para a Carla, com o motivo');
  perform ok(conta('select 1 from doc_envios where registro = 17 and dados->>''acao'' = ''devolvido''
                    and dados->>''motivo'' like ''Falta o afastamento%''') = 1, 'que recebe o motivo por e-mail');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'fora_de_aprovacao', 'devolvido, ninguém decide');
end $$;

-- a versão 2 recomeça da primeira etapa
do $$ declare p aacc_pedidos := ped(17); doc text := 'NRO-PES-020-' || (ped(17)).numero; cam text; r jsonb; n integer;
begin
  perform eu(17, 'leitura');
  cam := '17/' || p.id || '/v2-cdcdcdcd.pdf';
  perform subir(cam);
  r := enviar(p.id, cam, kw(doc), 42);
  perform ok(st(r) = 'ok' and (ped(17)).versao = 2 and (ped(17)).etapa = 1, 'a versão 2 recomeça na etapa 1');
  perform ok(conta('select 1 from aacc_versoes where pedido_id = ' || quote_literal(p.id) || '::uuid') = 2, 'as duas versões ficam');
  perform ok((ped(17)).motivo is null, 'o motivo da devolução sai');

  perform eu(70, 'leitura');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'ok', 'a Iara, do PMO, aprova a etapa 1');
  perform eu(52, 'leitura');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'ok', 'a Gabi aprova a etapa 2');
  perform eu(70, 'leitura');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'ja_aprovou',
             'a Iara, também da Diretoria, não aprova duas etapas da mesma versão');
  perform ok(aacc_pendentes() = 0 and not (aacc_ler(p.codigo)#>>'{pode,decidir}')::boolean, 'nem a vê como pendente');

  perform eu(23, 'leitura');
  r := aacc_ler(p.codigo);
  perform ok((r#>>'{pode,decidir}')::boolean and (r#>>'{pode,indicar}')::boolean, 'o Diego decide a última e indica o professor');
  perform ok(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))->>'campo' = 'professor_nome', 'sem professor, não aprova');
  r := jsonb_build_object('id', p.id, 'decisao', 'aprovar',
         'professor', jsonb_build_object('nome', 'João Modelo', 'titulo', 'Prof. Dr.', 'email', 'joao@gmail.com'),
         'pdf_url', url_assinada(cam));
  perform ok(aacc_decidir(r)->>'campo' = 'professor_departamento', 'o departamento do professor é obrigatório');
  r := jsonb_set(r, '{professor,departamento}', '"Departamento de Engenharia Elétrica"');
  perform ok(aacc_decidir(r)->>'campo' = 'professor_unidade', 'e a unidade acadêmica');
  r := jsonb_set(r, '{professor,unidade}', '"Escola de Engenharia"');
  perform ok(aacc_decidir(r)->>'dominio' = 'ufmg.br', 'o e-mail do professor é institucional');
  r := jsonb_set(r, '{professor,email}', '"Joao.Modelo@DEE.UFMG.BR"');
  perform ok(aacc_decidir(jsonb_set(r, '{pdf_url}', to_jsonb(url_assinada('17/' || p.id || '/v1-abababab.pdf'))))->>'campo' = 'pdf_url',
             'o link do PDF é o da versão em análise');
  perform ok(aacc_decidir(jsonb_set(r, '{professor,titulo}', '""'))->>'campo' = 'professor_titulo', 'e o título é obrigatório');
  r := aacc_decidir(r);
  perform ok(st(r) = 'ok' and r->>'situacao' = 'professor', 'o Diego aprova e indica o professor');
  p := ped(17);
  perform ok(p.status = 'professor' and p.etapa = 4 and p.prof_email = 'joao.modelo@dee.ufmg.br'
             and p.prof_indicado_por = 23, 'o pedido vai para o professor, de subdomínio da UFMG');
  perform ok(p.prof_departamento = 'Departamento de Engenharia Elétrica' and p.prof_unidade = 'Escola de Engenharia',
             'com o departamento e a unidade');
  perform ok(p.prof_token_hash ~ '^[0-9a-f]{64}$' and p.prof_expira > now() + interval '29 days', 'o link vale trinta dias');
  perform ok(token_do(p.id) ~ '^[0-9a-f]{64}$', 'o e-mail do professor leva o link');
  perform ok(encode(sha256(convert_to(token_do(p.id), 'UTF8')), 'hex') = p.prof_token_hash, 'e o banco guarda só o SHA-256 dele');
  perform ok(conta('select 1 from doc_envios where tipo = ''aacc_professor'' and para_email = ''joao.modelo@dee.ufmg.br''
                    and dados->>''estudante'' = ''Carla Mendonça'' and dados->>''curso'' = ''Engenharia Elétrica''') = 1,
             'para o e-mail dele, com o nome e o curso da estudante');
  perform ok(conta('select 1 from doc_envios where tipo = ''aacc_professor'' and dados->>''departamento'' = ''Departamento de Engenharia Elétrica''
                    and dados->>''unidade'' = ''Escola de Engenharia'' and dados ? ''norma''') = 1,
             'com o departamento, a unidade e a norma (nula: a da Escola de Engenharia)');
  perform ok(conta('select 1 from doc_envios where registro = 17 and dados->>''acao'' = ''professor''') = 1, 'a Carla é avisada');
  perform ok(conta('select distinct etapa from aacc_decisoes where pedido_id = ' || quote_literal(p.id)
                   || '::uuid and versao = 2 and decisao = ''aprovada''') = 3, 'três aprovações na versão 2, uma por etapa');
end $$;

-- trocar o professor: um link novo, o antigo deixa de valer
do $$ declare p aacc_pedidos := ped(17); r jsonb; t1 text; t2 text; begin
  t1 := token_do(p.id);
  perform eu(11, 'leitura');
  perform ok(st(aacc_professor_trocar(jsonb_build_object('id', p.id))) = 'sem_permissao', 'o PMO não troca o professor');
  perform eu(23, 'leitura');
  perform ok(aacc_professor_trocar(jsonb_build_object('id', p.id))->>'campo' = 'pdf_url', 'trocar pede o link do PDF de novo');
  r := aacc_professor_trocar(jsonb_build_object('id', p.id, 'pdf_url', url_assinada(p.pdf_caminho),
         'professor', jsonb_build_object('nome', 'Joana Exemplo', 'titulo', 'Prof.ª Dr.ª', 'email', 'joana@ufmg.br',
                                         'departamento', 'Departamento de Fisioterapia', 'unidade', 'EEFFTO')));
  perform ok(st(r) = 'ok' and (ped(17)).prof_nome = 'Joana Exemplo' and (ped(17)).prof_unidade = 'EEFFTO',
             'a Diretoria troca o professor, com o departamento e a unidade dela');
  t2 := token_do(p.id);
  perform ok(t1 <> t2, 'o e-mail novo leva outro link');
  set local role anon; perform eu(null, 'leitura');
  perform ok(st(aacc_professor_ler(t1)) = 'nao_encontrado', 'e o antigo deixa de valer');
  set local role none;
end $$;

-- ------------------------------------------------------------
-- 6. o professor, sem conta (a chave anônima)
-- ------------------------------------------------------------
reset role;
set role anon;
do $$ declare t text := token_do((ped(17)).id); r jsonb; pegou text; begin
  perform eu(null, 'leitura');
  begin perform aacc_meu(); exception when insufficient_privilege then pegou := 'negado'; end;
  perform ok(pegou = 'negado', 'a chave anônima não chama as funções do portal');
  pegou := null;
  begin perform aacc_por_token(t); exception when insufficient_privilege then pegou := 'negado'; end;
  perform ok(pegou = 'negado', 'nem a que acha o pedido pelo link');
  perform ok(st(aacc_professor_ler(repeat('0', 64))) = 'nao_encontrado', 'link inventado não abre nada');
  perform ok(st(aacc_professor_ler('x')) = 'nao_encontrado', 'nem link torto');
  r := aacc_professor_ler(t);
  perform ok(st(r) = 'ok' and r#>>'{pedido,membro,nome}' = 'Carla Mendonça', 'o professor abre o pedido pelo link');
  perform ok(r#>>'{pedido,membro,pronomes}' = 'ela', 'com os pronomes da estudante');
  perform ok(jsonb_array_length(r->'aprovacoes') = 3 and r#>>'{aprovacoes,0,nome}' = 'Iara Souza', 'com as três aprovações da versão 2');
  perform ok(r#>>'{pedido,pdf_url}' like '%/object/sign/aproveitamento/17/%v2-cdcdcdcd.pdf%', 'o link do PDF da versão 2');
  perform ok(jsonb_array_length(r->'barema') = 6 and (r->>'nota_minima')::int = 60, 'e o barema, com a nota mínima');
  perform ok(not (r->'pedido' ? 'prof_email') and not (r->'pedido' ? 'dados'), 'sem o e-mail dele nem a ficha da estudante');
  perform ok(aacc_professor_decidir(t, jsonb_build_object('decisao', 'devolver', 'parecer', repeat('x', 1300)))->>'campo' = 'parecer',
             'o parecer tem limite');
  perform ok(aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":9}}')->>'criterio' = 'profundidade',
             'aprovar pede a nota de cada critério');
  perform ok(aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":11,"profundidade":8,"contribuicao":8,
             "evidencias":8,"resultados":8,"comunicacao":8}}')->>'criterio' = 'aderencia', 'de 0 a 10');
  perform ok(aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":8.3,"profundidade":8,"contribuicao":8,
             "evidencias":8,"resultados":8,"comunicacao":8},"confirmo":true}')->>'criterio' = 'aderencia', 'de meio em meio ponto');
  r := aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":5,"profundidade":5,"contribuicao":6,
             "evidencias":6,"resultados":6,"comunicacao":7},"confirmo":true}');
  perform ok(st(r) = 'nota_minima' and (r->>'nota')::numeric = 57, 'nota abaixo de 60 não aprova (art. 3º, II)');
  perform ok(aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":9,"profundidade":8.5,"contribuicao":9,
             "evidencias":8,"resultados":8,"comunicacao":9}}')->>'campo' = 'confirmo', 'aprovar pede a declaração');
  r := aacc_professor_decidir(t, '{"decisao":"aprovar","notas":{"aderencia":9,"profundidade":8.5,"contribuicao":9,
             "evidencias":8,"resultados":8,"comunicacao":9},"confirmo":true,"parecer":"Relatório consistente."}');
  perform ok(st(r) = 'ok' and r->>'situacao' = 'concluido' and (r->>'nota')::numeric = 85.75, 'o professor aprova: nota 85,75, a soma exata dos pontos');
  perform ok(r->>'codigo' ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$', 'e a folha sai com código verificador');
  r := doc_validar(r->>'codigo');
  perform ok(r->>'situacao' = 'autentico' and r->>'tipo' = 'aproveitamento', 'que auth.neurodynamics.dev confere');
  perform ok(r#>>'{dados,professor,email}' = 'joana@ufmg.br' and r#>>'{dados,professor,conceito}' = 'B',
             'com o e-mail da professora por inteiro e o conceito');
  perform ok(r#>>'{dados,professor,departamento}' = 'Departamento de Fisioterapia' and r#>>'{dados,professor,unidade}' = 'EEFFTO'
             and r#>>'{dados,estudante,pronomes}' = 'ela', 'o departamento, a unidade e os pronomes da estudante');
  perform ok(r#>>'{dados,norma}' like 'Resolução nº 02/2019%', 'e a norma, a da Escola de Engenharia');
  perform ok(jsonb_array_length(r#>'{dados,aprovacoes}') = 3 and r#>>'{dados,relatorio,folha}' = '2',
             'as três aprovações da equipe e a folha que ela ocupa');
  perform ok(r#>>'{dados,creditos,principal_creditos}' = '15' and r#>>'{dados,estudante,matricula}' = '2022012345',
             'os créditos que o PDF declarou e a matrícula');
  perform ok(r->>'documento' = 'NRO-PES-020-' || (ped(17)).numero, 'o documento é o relatório deste pedido');
  perform ok(r#>>'{dados,serie_titulo}' = 'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC', 'e a folha leva o título da série');
  perform ok(st(aacc_professor_ler(t)) = 'concluido', 'o link, depois, só mostra que está concluído');
  perform ok(st(aacc_professor_decidir(t, '{"decisao":"devolver","parecer":"x"}')) = 'fechado', 'e não decide de novo');
end $$;
reset role;

do $$ declare p aacc_pedidos := ped(17); begin
  perform ok(p.status = 'concluido' and p.emitido is not null and p.nota = 85.75, 'o pedido fica concluído, com a folha');
  perform ok(jsonb_array_length(p.barema) = 6 and (p.barema->1->>'pontos')::numeric = 21.25
             and (select sum((b->>'pontos')::numeric) from jsonb_array_elements(p.barema) b) = p.nota, 'o barema com os pontos de cada critério, que somam a nota');
  perform ok((select emitido_nome from doc_emitidos where codigo = p.emitido) = 'SOMA, aprovação de Prof.ª Dr.ª Joana Exemplo',
             'a folha diz quem aprovou');
  perform ok(exists (select 1 from doc_envios where registro = 17 and dados->>'acao' = 'concluido' and dados->>'codigo' = p.emitido),
             'a Carla recebe o e-mail de concluído, com o código');
  perform ok((select count(distinct registro) from notificacoes where tipo = 'aacc' and titulo like '%aprovado pelo professor%') = 4,
             'as quatro pessoas que decidiram são avisadas');
  perform ok(exists (select 1 from aacc_historico where pedido_id = p.id and acao = 'abriu' and nome = 'Prof.ª Dr.ª Joana Exemplo'),
             'o histórico registra quando o professor abriu');
end $$;

set role authenticated;
do $$ declare p aacc_pedidos := ped(17); r jsonb; begin
  perform eu(17, 'leitura');
  r := aacc_folha(p.id);
  perform ok(st(r) = 'ok' and (r->>'folha')::int = 2 and r#>>'{emissao,tipo}' = 'aproveitamento', 'a Carla baixa a folha para o PDF final');
  r := aacc_ler(p.codigo);
  perform ok((r#>>'{pode,baixar_final}')::boolean and (r#>>'{pode,reabrir}')::boolean and not (r#>>'{pode,enviar}')::boolean,
             'e pode baixar o PDF final ou reabrir');
  perform ok(jsonb_array_length(r->'decisoes') = 6, 'as decisões das duas versões ficam no pedido');
  perform eu(60, 'leitura');
  perform ok(st(aacc_folha(p.id)) = 'nao_encontrado', 'o Hugo não baixa a folha dela');
end $$;

-- ------------------------------------------------------------
-- 7. reabrir: o Colegiado apontou algo
-- ------------------------------------------------------------
do $$ declare p aacc_pedidos := ped(17); cod text := (ped(17)).emitido; r jsonb; doc text := 'NRO-PES-020-' || (ped(17)).numero;
  cam text; begin
  perform eu(11, 'leitura');
  perform ok(st(aacc_reabrir(p.id, 'x')) = 'sem_permissao', 'quem aprovou não reabre');
  perform eu(17, 'leitura');
  perform ok(aacc_reabrir(p.id, '  ')->>'campo' = 'motivo', 'reabrir pede o motivo');
  r := aacc_reabrir(p.id, 'O Colegiado pediu a declaração de vínculo no anexo');
  perform ok(st(r) = 'ok' and (ped(17)).status = 'devolvido', 'a Carla reabre: o pedido volta ao envio');
  perform ok(doc_validar(cod)->>'situacao' = 'revogado', 'e a folha anterior passa a constar revogada');
  perform ok((ped(17)).prof_token_hash is null, 'o link do professor deixa de valer');
  perform ok(st(aacc_reabrir(p.id, 'de novo')) = 'nao_concluido', 'só se reabre o que está concluído');
  cam := '17/' || p.id || '/v3-efefefef.pdf';
  perform subir(cam);
  perform ok(st(enviar(p.id, cam, kw(doc), 43)) = 'ok' and (ped(17)).versao = 3 and (ped(17)).etapa = 1,
             'a versão 3 passa pelas aprovações outra vez');
  perform ok((ped(17)).emitido = cod, 'o pedido guarda a folha revogada até sair a nova');
end $$;

-- o professor devolve
do $$ declare p aacc_pedidos := ped(17); t text; r jsonb; begin
  perform eu(11, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform eu(31, 'pessoal'); perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'ok',
                                        'a Elis aprova a etapa do Pessoal');
  perform eu(23, 'leitura');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar', 'pdf_url', url_assinada(p.pdf_caminho),
           'professor', jsonb_build_object('nome', 'Joana Exemplo', 'titulo', 'Prof.ª Dr.ª', 'email', 'joana@ufmg.br',
                                           'departamento', 'Departamento de Fisioterapia', 'unidade', 'EEFFTO')))) = 'ok',
           'e a Diretoria indica a professora de novo');
  t := token_do(p.id);
  set local role anon; perform eu(null, 'leitura');
  perform ok(aacc_professor_decidir(t, '{"decisao":"devolver"}')->>'campo' = 'parecer', 'o professor devolve com o motivo');
  r := aacc_professor_decidir(t, '{"decisao":"devolver","parecer":"A memória de cálculo das horas não fecha."}');
  perform ok(st(r) = 'ok' and r->>'situacao' = 'devolvido', 'e o pedido volta à estudante');
  perform ok(st(aacc_professor_ler(t)) = 'nao_encontrado', 'o link deixa de valer');
  set local role none;
  perform ok(exists (select 1 from doc_envios where registro = 17 and dados->>'acao' = 'devolvido'
                       and dados->>'etapa' = 'Professor orientador'), 'a Carla recebe o motivo');
  perform ok(conta('select 1 from notificacoes where registro = 23 and titulo like ''%devolvido pelo professor%''') = 1,
             'e quem indicou, no sino');
end $$;

-- ------------------------------------------------------------
-- 8. o egresso, o prazo do professor, cancelar e as configurações
-- ------------------------------------------------------------
reset role;
insert into dados_pessoais (registro, cpf, data_nascimento, endereco, cidade_origem, instituicao, curso, matricula,
                            periodo_ingresso, genero, pronomes, autodeclaracao_racial)
values (60, '12345678909', '1999-01-01', 'Rua B', 'Contagem', 'UFMG', 'Engenharia Mecânica', '2019000111', '2019/1', 'M', 'ele', 'Branca')
on conflict (registro) do update set curso = excluded.curso;
update membros set email_pessoal = 'hugo@exemplo.com', telefone = '31988887777' where registro = 60;
set role authenticated;
do $$ declare r jsonb; p aacc_pedidos; t text; cam text; doc text; begin
  perform eu(60, 'leitura');
  r := aacc_meu();
  perform ok(r#>>'{membro,situacao}' = 'egresso' and r#>>'{membro,fim}' = '2026-05-31', 'o Hugo é egresso, com a data de saída');
  perform ok(jsonb_array_length(r->'semestres') = 5 and r#>>'{semestres,4,rotulo}' = '2026/1', 'de 2024/1 a 2026/1, pela saída');
  r := aacc_preparar('{"principal":"VPC"}');
  perform ok(st(r) = 'ok', 'e prepara o dele');
  perform ok(st(aacc_cancelar((ped(60)).id, 'Vou pedir no semestre que vem')) = 'ok' and (ped(60)).status = 'cancelado', 'e cancela');
  perform ok(st(aacc_preparar('{"principal":"EQC"}')) = 'ok' and conta('select 1 from aacc_pedidos where registro = 60') = 2,
             'cancelado, pode abrir outro');
  p := ped(60); doc := 'NRO-PES-020-' || p.numero;
  cam := '60/' || p.id || '/v1-01010101.pdf';
  perform subir(cam);
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'ok', 'o Hugo envia');
  perform ok(conta('select 1 from doc_envios where registro = 60 and para_email = ''hugo@exemplo.com''') = 1,
             'e, egresso, recebe o aviso no e-mail pessoal');
  perform ok(conta('select 1 from doc_envios where registro = 17 and para_email is not null') = 0,
             'a Carla, ativa, no da equipe (o da ficha)');
  perform eu(11, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform eu(52, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform eu(4, 'admin');
  perform ok((aacc_ler(p.codigo)#>>'{pode,decidir}')::boolean, 'admin decide qualquer etapa');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar', 'pdf_url', url_assinada(cam),
           'professor', jsonb_build_object('nome', 'João Modelo', 'titulo', 'Prof. Dr.', 'email', 'joao@ufmg.br',
                                           'departamento', 'Departamento de Engenharia Mecânica', 'unidade', 'Escola de Engenharia')))) = 'ok',
           'e a Ana, admin, indica o professor');
  t := token_do(p.id);
  set local role none;
  update aacc_pedidos set prof_expira = now() - interval '1 minute' where id = p.id;
  set local role anon; perform eu(null, 'leitura');
  perform ok(st(aacc_professor_ler(t)) = 'expirado', 'passado o prazo, o link não abre');
  perform ok(st(aacc_professor_decidir(t, '{"decisao":"devolver","parecer":"x"}')) = 'expirado', 'nem decide');
  set local role none;
  set local role authenticated;

  perform eu(11, 'leitura');
  perform ok(st(aacc_config_salvar('{"dominio_professor":"gmail.com"}')) = 'sem_permissao', 'o PMO não mexe nas configurações');
  perform eu(31, 'pessoal');
  perform ok(aacc_config_salvar(jsonb_build_object('etapas', jsonb_build_array(jsonb_build_object('grupo_id', gid('NRO_PMO')),
             jsonb_build_object('grupo_id', gid('NRO_PMO')))))->>'motivo' = 'repetido', 'o mesmo grupo em duas etapas não');
  perform ok(aacc_config_salvar(jsonb_build_object('etapas', jsonb_build_array(jsonb_build_object('grupo_id', 999))))->>'motivo' = 'grupo',
             'nem grupo que não existe');
  perform ok(aacc_config_salvar('{"barema":[{"chave":"a","nome":"A","peso":50}]}')->>'campo' = 'barema', 'barema com chave curta não');
  perform ok(aacc_config_salvar('{"barema":[{"chave":"aa","nome":"A","peso":50}]}')->>'soma' = '50', 'nem com pesos que não somam 100');
end $$;

-- duas etapas: a última passa a ser a do Pessoal, que indica o professor
do $$ declare p aacc_pedidos := ped(17); doc text := 'NRO-PES-020-' || (ped(17)).numero; cam text; r jsonb; begin
  perform eu(17, 'leitura');
  cam := '17/' || p.id || '/v4-12121212.pdf';
  perform subir(cam);
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'ok', 'a Carla envia a versão 4');
  perform eu(11, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform eu(52, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform ok((ped(17)).etapa = 3, 'que chega à etapa 3');
  perform eu(31, 'pessoal');
  r := jsonb_build_object('etapas', jsonb_build_array(jsonb_build_object('grupo_id', gid('NRO_PMO'), 'rotulo', 'PMO'),
         jsonb_build_object('grupo_id', gid('Depto de Pessoal'))), 'prazo_professor_dias', 45);
  perform ok(st(aacc_config_salvar(r)) = 'em_uso', 'com um pedido na etapa 3, não se tira a etapa 3');
  perform eu(23, 'leitura');
  perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'devolver', 'parecer', 'Vamos mudar as etapas.'));
  perform eu(31, 'pessoal');
  perform ok(st(aacc_config_salvar(r)) = 'ok' and conta('select unnest(grupos) from aacc_config') = 2, 'devolvido, a Elis passa para duas etapas');
  perform ok(conta('select 1 from aacc_config where prazo_professor_dias = 45 and rotulos[2] = ''Depto de Pessoal''') = 1,
             'o prazo muda, e a etapa sem nome leva o do grupo');

  perform eu(17, 'leitura');
  cam := '17/' || p.id || '/v5-34343434.pdf';
  perform subir(cam);
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'ok', 'a versão 5');
  perform eu(11, 'leitura'); perform aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'));
  perform eu(52, 'leitura');
  perform ok((aacc_ler(p.codigo)#>>'{pode,indicar}')::boolean, 'agora quem indica o professor é o Pessoal');
  perform ok(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))->>'campo' = 'professor_nome', 'e precisa indicar');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar', 'pdf_url', url_assinada(cam),
           'professor', jsonb_build_object('nome', 'Joana Exemplo', 'titulo', 'Prof.ª Dr.ª', 'email', 'joana@ufmg.br',
                                           'departamento', 'Departamento de Fisioterapia', 'unidade', 'EEFFTO')))) = 'ok'
           and (ped(17)).etapa = 3 and (ped(17)).status = 'professor', 'o pedido vai ao professor depois de duas etapas');
  perform ok((ped(17)).prof_expira > now() + interval '44 days', 'com o prazo novo');
end $$;
reset role;

-- ------------------------------------------------------------
-- 9. rodar de novo não muda nada
-- ------------------------------------------------------------
create temp table antes as select id, status, etapa, versao, emitido, prof_token_hash from aacc_pedidos;
create temp table cfg_antes as select grupos, rotulos, prazo_professor_dias, barema from aacc_config;
\ir ../2.20.0_aproveitamento.sql
do $$ begin
  perform ok((select count(*) from aacc_pedidos) = (select count(*) from antes)
             and not exists (select 1 from aacc_pedidos p join antes a using (id)
                              where (p.status, p.etapa, p.versao, p.emitido, p.prof_token_hash)
                                    is distinct from (a.status, a.etapa, a.versao, a.emitido, a.prof_token_hash)),
             'rodar a 2.20.0 de novo não mexe nos pedidos');
  perform ok((select (c.grupos, c.rotulos, c.prazo_professor_dias, c.barema) = (a.grupos, a.rotulos, a.prazo_professor_dias, a.barema)
                from aacc_config c, cfg_antes a), 'nem nas configurações');
  perform ok((select count(*) from storage.buckets where id = 'aproveitamento') = 1, 'nem no bucket');
  perform ok((select count(*) from pg_constraint where conrelid = 'public.doc_emitidos'::regclass and contype = 'c'
               and pg_get_constraintdef(oid) ilike '%tipo%') = 1, 'e doc_emitidos segue com uma regra de tipo só');
  perform ok(not has_function_privilege('anon', 'public.aacc_meu()', 'execute')
             and not has_function_privilege('anon', 'public.aacc_decidir(jsonb)', 'execute')
             and has_function_privilege('anon', 'public.aacc_professor_ler(text)', 'execute')
             and has_function_privilege('anon', 'public.aacc_professor_decidir(text,jsonb)', 'execute'),
             'a chave anônima alcança só as duas funções do professor');
  perform ok(not has_function_privilege('authenticated', 'public.aacc_dados_membro(integer)', 'execute')
             and not has_function_privilege('authenticated', 'public.aacc_avisar_estudante(public.aacc_pedidos,text,text,text,jsonb)', 'execute')
             and not has_function_privilege('authenticated', 'public.aacc_por_token(text)', 'execute'),
             'e o portal não chama as internas');
end $$;

\echo '2.20.0: todas as asserções passaram'
