\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.23.0: os trabalhos, os convidados, os documentos, as
-- habilidades e, em Arquivos, o formato e a cor do emissor.
-- Rode depois do teste da 2.18.0, no mesmo banco (ele aplica da 25.0
-- à 2.18.0 e deixa as pessoas e os papéis):
--   bash testes/preparar-base.sh teste t223 2.18.0_soma.sql 2.23.0_trabalhos.sql
-- O teste aplica a 2.23.0 duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function trb(p_num integer) returns uuid language plpgsql security definer as $$
begin return (select id from trabalhos where numero = p_num); end $$;
create or replace function grupos_de_reg(p_reg integer) returns text[] language sql security definer as $$
  select grupos from membros where registro = p_reg $$;
create or replace function recusa(p_sql text) returns text language plpgsql as $$
begin execute p_sql; return null;
exception when others then return sqlerrm; end $$;

-- um trainee e um projeto, para os vínculos
insert into membros (registro, nome, cargo, grupos, status, email_pessoal) values
  (60, 'Pedro Lima', 'Trainee', '{}', 'Ativo', 'pedro@exemplo.com'),
  (61, 'Sarah Costa', 'Trainee', '{}', 'Ativo', null)
on conflict (registro) do nothing;
insert into perfis (id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000060', 'pedro@nro.dev', 'leitura', 60),
  ('00000000-0000-0000-0000-000000000061', 'sarah@nro.dev', 'leitura', 61)
on conflict (id) do nothing;
-- quem veio do processo seletivo traz as competências (a tabela da v11 do PS, só o que importa aqui)
alter table ps_candidatos add column if not exists registro_membro integer;
alter table ps_candidatos add column if not exists competencias text[] default '{}';
alter table ps_candidatos add column if not exists competencias_desejadas text[] default '{}';
alter table ps_candidatos alter column edicao_id drop not null;
do $$ declare c text; begin
  -- as outras colunas obrigatórias do candidato ganham um valor qualquer
  for c in select column_name from information_schema.columns where table_name = 'ps_candidatos'
            and is_nullable = 'NO' and column_default is null and is_identity = 'NO' and column_name not in ('id','nome') loop
    execute format('alter table ps_candidatos alter column %I drop not null', c);
  end loop;
end $$;
insert into ps_candidatos (nome, registro_membro, competencias, competencias_desejadas)
values ('Pedro Lima', 60, '{Firmware,C}', '{"Processamento de sinais"}');

-- um arquivo com revisão aprovada, para o formato
do $$ begin
  perform eu(4, 'admin');
  perform ok(projeto_salvar(jsonb_build_object('codigo','EQUIO','nome','Équio','supervisor',11))->>'status' = 'ok', 'projeto EQUIO');
end $$;

-- ------------------------------------------------------------
-- 1. A migração
-- ------------------------------------------------------------
\ir ../2.23.0_trabalhos.sql

do $$
declare r jsonb; v_t uuid; v_g integer;
begin
  raise notice 'A estrutura';
  perform ok((select nome from grupos where chave = 'trabalhos') = 'NRO_TRABALHOS', 'NRO_TRABALHOS criado');
  perform ok((select not quadro from grupos where chave = 'trabalhos'), 'sem quadro: é guarda-chuva');
  perform ok(recusa('update grupos set prefixo = ''TRB'' where nome = ''Sinais''') ~ 'grupos_trb_reservado', 'o prefixo TRB fica reservado');
  perform ok((select tem from membro_habilidades where registro = 60) = '{Firmware,C}'
             and (select quer from membro_habilidades where registro = 60) = '{"Processamento de sinais"}', 'as competências do PS viram habilidades');
  perform ok(membro_efetivo(11) and not membro_efetivo(60) and not membro_efetivo(45), 'membro efetivo: ativo e não trainee');

  raise notice 'Criar';
  perform eu(11, 'leitura');
  perform ok(trabalho_salvar('{"referencia":"Estande NRO"}')->>'status' = 'sem_permissao', 'leitura não cria');
  perform eu(45, 'leitura');
  perform ok(trabalho_salvar('{"referencia":"Estande NRO"}')->>'status' = 'sem_permissao', 'conta de egresso não cria');
  perform eu(42, 'leitura');   -- liderança pelo grupo
  r := trabalho_salvar(jsonb_build_object('numero', 5, 'referencia', 'Projeto Calima (firmware)', 'tipo', 'etapa',
         'ciclo', '2026/2', 'alocacao', '2 trainees Dev', 'complexidade', 4, 'esforco', 5,
         'responsaveis', jsonb_build_array(11), 'equipe', jsonb_build_array(60),
         'cenario', jsonb_build_object('forcas', jsonb_build_array('Acompanhamento de perto', ' ', 'acompanhamento de perto'),
                                        'ameacas', jsonb_build_array('Disputa do Connect'), 'outra', jsonb_build_array('x'))));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'TRB-5' and r->>'prefixo' = 'T5', 'a liderança cria o TRB-5, prefixo T5');
  v_t := (r->>'id')::uuid; v_g := (r->>'grupo_id')::integer;
  perform ok((select nome from grupos where id = v_g) = 'NRO_TRABALHO_5'
             and (select pai_id from grupos where id = v_g) = grupo_trabalhos()
             and (select quadro from grupos where id = v_g), 'o grupo nasce dentro de NRO_TRABALHOS, com quadro');
  perform ok((select responsaveis from grupos where id = v_g) = '{11}', 'o responsável responde pelo grupo');
  perform ok(grupos_de_reg(11) @> '{NRO_TRABALHO_5}' and grupos_de_reg(60) @> '{NRO_TRABALHO_5}', 'responsável e equipe entram no grupo');
  perform ok(esta_no_grupo(grupo_trabalhos(), 60), 'e, pelo grupo, em NRO_TRABALHOS');
  perform ok((select cenario from trabalhos where id = v_t) = '{"forcas":["Acompanhamento de perto"],"ameacas":["Disputa do Connect"],"fraquezas":[],"oportunidades":[]}'::jsonb,
             'o cenário: quatro listas limpas, sem repetição nem chave estranha');
  perform ok((select count(*) from notificacoes where tipo = 'projeto_equipe' and href = '#/projetos/trabalhos/TRB-5') = 2, 'a equipe é avisada');
  perform ok((select count(*) from ocorrencias where descricao = 'NRO_TRABALHO_5') = 2, 'e a ficha registra a entrada');
  perform ok(trabalho_salvar('{"numero":5,"referencia":"Outro"}')->>'status' = 'duplicado', 'o número não se repete');
  r := trabalho_salvar('{"referencia":"Estande NRO","tipo":"campanha"}');
  perform ok(r->>'codigo' = 'TRB-6', 'sem número, vem o próximo');
  perform ok(trabalho_salvar('{"referencia":"X","complexidade":7}')->>'campo' = 'complexidade', 'complexidade de 1 a 5');
  perform ok(trabalho_salvar('{"referencia":"X","inicio":"2026-09-01","fim":"2026-08-01"}')->>'campo' = 'fim', 'o fim não vem antes do início');

  raise notice 'Editar';
  perform eu(60, 'leitura');
  perform ok(trabalho_salvar(jsonb_build_object('id', v_t, 'status', 'em_andamento'))->>'status' = 'sem_permissao', 'quem só está na equipe não edita');
  perform eu(11, 'leitura');
  perform ok(trabalho_salvar(jsonb_build_object('id', v_t, 'status', 'em_andamento', 'escopo', 'Compensação angular.',
             'projeto_id', (select id from projetos where codigo = 'EQUIO')))->>'status' = 'ok', 'o responsável edita');
  perform ok((select status = 'em_andamento' and escopo = 'Compensação angular.' and projeto_id is not null from trabalhos where id = v_t)
             and (select alocacao from trabalhos where id = v_t) = '2 trainees Dev', 'o que não veio no pedido fica');
  perform ok(trabalho_salvar(jsonb_build_object('id', v_t, 'responsaveis', jsonb_build_array(11, 47)))->>'campo' = 'responsaveis',
             'trocar os responsáveis é da gestão');
  perform eu(4, 'admin');
  perform ok(trabalho_salvar(jsonb_build_object('id', v_t, 'responsaveis', jsonb_build_array(47)))->>'status' = 'ok', 'a gestão troca');
  perform ok((select responsaveis from trabalhos where id = v_t) = '{47}' and (select responsaveis from grupos where id = v_g) = '{47}',
             'o grupo acompanha: sai um, entra o outro');
  perform ok(grupos_de_reg(47) @> '{NRO_TRABALHO_5}' and grupos_de_reg(11) @> '{NRO_TRABALHO_5}', 'o novo entra na equipe; o antigo continua nela');
  perform ok((select count(*) from notificacoes where registro = 47 and titulo = 'Você é responsável pelo trabalho TRB-5') = 1, 'e é avisado');
  perform eu(11, 'leitura');
  perform ok(trabalho_salvar(jsonb_build_object('id', v_t, 'status', 'pausado'))->>'status' = 'sem_permissao', 'quem deixou de ser responsável não edita mais');
end $$;

-- ------------------------------------------------------------
-- 2. Pessoas e convidados
-- ------------------------------------------------------------
do $$
declare r jsonb; v_t uuid := trb(5); v_c uuid; v_l jsonb;
begin
  raise notice 'Pôr e tirar gente';
  perform eu(23, 'leitura');
  perform ok(trabalho_pessoas(jsonb_build_object('trabalho_id', v_t, 'adicionar', jsonb_build_array(61)))->>'status' = 'sem_permissao', 'quem não edita não põe');
  perform eu(47, 'leitura');
  r := trabalho_pessoas(jsonb_build_object('trabalho_id', v_t, 'adicionar', jsonb_build_array(61, 45, 46), 'remover', jsonb_build_array(60)));
  perform ok(r->>'status' = 'ok' and (r->>'adicionados')::int = 1 and (r->>'removidos')::int = 1, 'o responsável põe e tira (egresso e sob demanda ficam fora)');
  perform ok(grupos_de_reg(61) @> '{NRO_TRABALHO_5}' and not grupos_de_reg(60) @> '{NRO_TRABALHO_5}'
             and not grupos_de_reg(45) @> '{NRO_TRABALHO_5}', 'o grupo é a equipe');
  perform ok((select count(*) from notificacoes where registro = 61 and href = '#/projetos/trabalhos/TRB-5') = 1, 'quem entra é avisado');

  raise notice 'Convidados';
  perform eu(23, 'leitura');
  perform ok(convidado_salvar('{"nome":"Lucía Gómez","responsavel":11}')->>'status' = 'sem_permissao', 'quem não gere nem é responsável de trabalho não convida');
  perform eu(47, 'leitura');
  perform ok(convidado_salvar('{"nome":"Lucía Gómez","responsavel":60}')->>'campo' = 'responsavel', 'trainee não responde por convidado');
  perform ok(convidado_salvar('{"nome":"Lucía Gómez"}')->>'campo' = 'responsavel', 'convidado sem responsável não entra');
  perform ok(convidado_salvar('{"nome":"Lucía Gómez","responsavel":11,"email":"bruno@nro.dev"}')->>'campo' = 'email_de_membro', 'e-mail de membro não vira convidado');
  r := convidado_salvar('{"nome":"Lucía Gómez","responsavel":11,"email":"Lucia@Uni.edu","motivo":"intercambio","instituicao":"Universidad de Chile","habilidades":["Python","python"," "]}');
  perform ok(r->>'status' = 'ok', 'o responsável de um trabalho convida, com um membro efetivo por ela');
  v_c := (r->>'id')::uuid;
  perform ok((select email from convidados where id = v_c) = 'lucia@uni.edu' and (select habilidades from convidados where id = v_c) = '{Python}', 'e-mail e habilidades limpos');
  perform ok((select count(*) from notificacoes where registro = 11 and titulo = 'Você responde por Lucía Gómez') = 1, 'o responsável pelo convidado é avisado');
  r := trabalho_pessoas(jsonb_build_object('trabalho_id', v_t, 'convidados_adicionar', jsonb_build_array(v_c)));
  perform ok((r->>'convidados_adicionados')::int = 1, 'o convidado entra no trabalho');
  perform ok((trabalho_pessoas(jsonb_build_object('trabalho_id', v_t, 'convidados_adicionar', jsonb_build_array(v_c)))->>'convidados_adicionados')::int = 0, 'uma vez só');

  raise notice 'Quem lê o e-mail do convidado';
  perform eu(23, 'leitura');
  v_l := convidados_lista();
  perform ok(jsonb_array_length(v_l) = 1 and not (v_l->0 ? 'email') and v_l->0->>'nome' = 'Lucía Gómez'
             and v_l->0->'trabalhos' = jsonb_build_array(v_t), 'a equipe vê o convidado e os trabalhos, sem o e-mail');
  perform eu(11, 'leitura');
  perform ok(convidados_lista()->0->>'email' = 'lucia@uni.edu', 'quem responde por ele vê o e-mail');
  perform eu(40, 'leitura');   -- pessoal pelo grupo
  perform ok(convidados_lista()->0->>'email' = 'lucia@uni.edu', 'o Depto. de Pessoal também');
  perform eu(45, 'leitura');
  perform ok(convidados_lista() = '[]'::jsonb, 'conta de egresso não lê');
  perform eu(23, 'leitura');
  perform ok(convidado_salvar(jsonb_build_object('id', v_c, 'nome', 'L'))->>'status' = 'sem_permissao', 'quem não responde não edita');
  perform eu(11, 'leitura');
  perform ok(convidado_salvar(jsonb_build_object('id', v_c, 'ativo', false))->>'status' = 'ok', 'quem responde desativa');
  perform ok(not exists (select 1 from trabalho_convidados where convidado_id = v_c), 'desativado, sai dos trabalhos');
end $$;

-- a tabela dos convidados não se lê direto
set role authenticated;
select set_config('teste.uid', '00000000-0000-0000-0000-000000000004', false);
do $$ begin
  -- no Supabase a tabela tem o grant padrão e a RLS devolve nada; aqui, sem grant, o banco recusa
  perform ok(recusa('do $x$ begin if (select count(*) from convidados) > 0 then raise exception ''leu''; end if; end $x$') is distinct from 'leu',
             'convidados: sem leitura direta');
  perform ok((select count(*) from trabalhos) = 2, 'trabalhos: a equipe lê');
end $$;
reset role;

-- ------------------------------------------------------------
-- 3. Documentos e habilidades
-- ------------------------------------------------------------
do $$
declare r jsonb; v_t uuid := trb(5); v_a uuid; v_d uuid;
begin
  raise notice 'Documentos';
  select id into v_a from doc_arquivos order by codigo limit 1;
  perform eu(23, 'leitura');
  perform ok(trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'arquivo_id', v_a))->>'status' = 'sem_permissao', 'quem não está no trabalho não põe documento');
  perform eu(61, 'leitura');   -- da equipe
  r := trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'arquivo_id', v_a));
  perform ok(r->>'status' = 'ok', 'a equipe põe um arquivo do rol');
  v_d := (r->>'id')::uuid;
  perform ok(trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'arquivo_id', v_a))->>'status' = 'duplicado', 'uma vez só');
  perform ok(trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'titulo', 'Fotos', 'url', 'javascript:alert(1)'))->>'campo' = 'url', 'link só http(s)');
  perform ok(trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'url', 'https://drive.google.com/x'))->>'campo' = 'titulo', 'link com título');
  perform ok(trabalho_documento_salvar(jsonb_build_object('trabalho_id', v_t, 'titulo', 'Banco de fotos', 'url', 'https://drive.google.com/x'))->>'status' = 'ok', 'e o link de fora');
  perform ok((select count(*) from trabalho_documentos where trabalho_id = v_t) = 2, 'dois documentos');
  perform eu(23, 'leitura');
  perform ok(trabalho_documento_tirar(v_d)->>'status' = 'sem_permissao', 'quem não está não tira');
  perform eu(47, 'leitura');
  perform ok(trabalho_documento_tirar(v_d)->>'status' = 'ok', 'o responsável tira');

  raise notice 'Habilidades';
  perform eu(23, 'leitura');
  perform ok(habilidades_salvar('{"tem":["Design","Figma"],"quer":["Motion"]}')->>'status' = 'ok', 'cada um as suas');
  perform ok((select tem from membro_habilidades where registro = 23) = '{Design,Figma}', 'gravadas');
  perform ok(habilidades_salvar('{"registro":60,"tem":["x"]}')->>'status' = 'sem_permissao', 'as de outra pessoa, não');
  perform ok(habilidades_salvar('{"quer":["Edição de vídeo"]}')->>'status' = 'ok', 'muda uma lista só');
  perform ok((select tem from membro_habilidades where registro = 23) = '{Design,Figma}'
             and (select quer from membro_habilidades where registro = 23) = '{"Edição de vídeo"}', 'só a lista que veio muda');
  perform eu(4, 'admin');
  perform ok(habilidades_salvar('{"registro":60,"tem":["Firmware"]}')->>'status' = 'ok', 'admin edita as de qualquer um');
end $$;

-- ------------------------------------------------------------
-- 4. Arquivos: o formato e a cor
-- ------------------------------------------------------------
do $$
declare v_a uuid; v_r uuid; v_s uuid;
begin
  raise notice 'O formato do arquivo';
  perform ok(doc_formato_de('Ata 12.DOCX') = 'docx' and doc_formato_de('plan.xls') = 'xlsx' and doc_formato_de('a.pptx') = 'pptx'
             and doc_formato_de('README.md') = 'md' and doc_formato_de('x.pdf') = 'pdf' and doc_formato_de('foto.png') = 'outro'
             and doc_formato_de('sem extensao') is null, 'a extensão no vocabulário do ícone');
  select id, serie_id into v_a, v_s from doc_arquivos where pn is null order by codigo limit 1;
  update doc_arquivos set formato = null where id = v_a;
  insert into doc_revisoes (arquivo_id, rev, estado, nome_original) values (v_a, 'Z', 'pendente', 'nova.xlsx') returning id into v_r;
  perform ok((select formato from doc_arquivos where id = v_a) = 'xlsx', 'sem formato, a primeira enviada já diz');
  update doc_revisoes set estado = 'cancelada' where id = v_r;
  insert into doc_revisoes (arquivo_id, rev, estado, nome_original) values (v_a, 'Y', 'pendente', 'outra.pptx') returning id into v_r;
  perform ok((select formato from doc_arquivos where id = v_a) = 'xlsx', 'com formato, a pendente não troca');
  update doc_revisoes set estado = 'aprovada' where id = v_r;
  perform ok((select formato from doc_arquivos where id = v_a) = 'pptx', 'a aprovada troca');
  perform ok((select formato from doc_rol where id = v_a) = 'pptx', 'e o rol mostra');
  perform eu(11, 'leitura');
  perform ok(doc_serie_formato(v_s, 'md')->>'status' = 'sem_permissao', 'o formato da série é do gestor');
  perform eu(4, 'admin');
  perform ok(doc_serie_formato(v_s, 'mp4')->>'campo' = 'formato', 'só os formatos conhecidos');
  perform ok(doc_serie_formato(v_s, 'md')->>'status' = 'ok', 'o gestor escolhe');
  perform ok((select serie_formato from doc_rol where id = v_a) = 'md', 'e o rol mostra o da série');
  perform ok(recusa('update doc_emissores set familia = ''roxo''') ~ 'doc_emissores_familia_ok', 'a cor do emissor é uma família da marca');
  update doc_emissores set familia = 'retina' where prefixo = (select prefixo from doc_series where id = v_s);
  perform ok(exists (select 1 from doc_emissores where familia = 'retina'), 'e grava');
end $$;

-- ------------------------------------------------------------
-- 5. De novo: nada muda
-- ------------------------------------------------------------
\ir ../2.23.0_trabalhos.sql
do $$ begin
  perform ok((select count(*) from grupos where chave = 'trabalhos') = 1 and (select count(*) from trabalhos) = 2, 'a segunda vez não duplica');
  perform ok((select count(*) from membro_habilidades where registro = 60 and tem = '{Firmware}') = 1, 'nem desfaz o que se editou');
  perform ok((select count(*) from pg_policies where policyname = 'conta_ativa' and tablename in
              ('trabalhos','convidados','trabalho_convidados','trabalho_documentos','membro_habilidades')) = 5, 'a trava da conta nas tabelas novas');
end $$;
\echo '2.23.0: tudo certo'
