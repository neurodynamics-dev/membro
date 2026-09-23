-- ============================================================
-- SOMA 21.0 — MIGRAÇÃO · NeuroDynamics
-- O ROL INICIAL: A PLANILHA NRO-PUB-001 ENTRA NO SISTEMA.
--
-- As 46 linhas da planilha NRO-PUB-001 CONTROLE DE DOCUMENTOS E
-- REGISTROS, nas sete abas (PUB, PES, PRO, CLI, REL, DIR, MKT),
-- viram séries do controle de arquivos da 20.0 — com o título, o
-- tipo, o subtipo, a classe, quem redigiu, quem revisou e quando.
--
-- Como cada coluna da planilha virou o quê:
--   STATUS  EM VIGÊNCIA  → ativo, com a Rev. A aprovada (importada)
--           RASCUNHO     → rascunho
--           INEXISTENTE  → rascunho, com a nota "previsto, sem arquivo"
--           SUBSTITUÍDO  → obsoleto (nenhuma linha estava assim)
--   TIPO    REGISTRO     → série com PN: a linha é o template, e cada
--                          registro preenchido vira um PN
--           DOCUMENTO    → série única, com três exceções que são por
--                          projeto (termo de abertura, plano de validação,
--                          ISC). O termo de abertura estava como registro
--                          na planilha; o pedido de 23/09 o define como
--                          documento com PN — um por projeto, revisável.
--   REDIGIDO POR / REVISADO POR → quem enviou e quem revisou a Rev. A.
--   Nenhuma linha tinha Rev. B em diante nem aprovador.
--
-- Os arquivos em si continuam no Drive CTA: a Rev. A entra aprovada
-- mas sem anexo. Em cada arquivo, o PMO anexa o .docx/.xlsx pelo
-- botão "Anexar o arquivo desta revisão" — sem nova revisão, porque a
-- aprovação já aconteceu.
--
-- Os nomes da planilha (MMARCONDES, ANA ALICE GOMES) viram registro
-- quando casam com a ficha (pelo começo do e-mail NRO ou pelo nome);
-- não casando, ficam como texto. "MAMRCONDES", numa linha da DIR, é
-- o mesmo MMARCONDES com as letras trocadas.
--
-- E um PADRÃO DE PROJETO inicial, para o rol de cada projeto já nascer
-- com o que um projeto de dispositivo tem: termo de abertura, USRS,
-- riscos, plano de validação, ISC, DHF, DMF, rastreabilidade, e os que
-- se repetem (ADR, design record, relatórios). É uma proposta — o PMO
-- ajusta em Arquivos › Configurações, e o rol de todos os projetos
-- acompanha. Ficam de fora o portfólio (NRO-PRO-007, um só para todos
-- os projetos) e o manual de inspeção (NRO-PRO-002, geral).
--
-- Gerada a partir da planilha em 23/09/2026. Pré-requisito: 20.0.
-- Segura para rodar mais de uma vez: série que já existe fica como está.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.doc_series') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'A 21.0 preenche as tabelas do controle de arquivos, criadas pela 20.0.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. OS EMISSORES — os nomes vêm do template NRO-PUB-002, que lista
--    como o cabeçalho de cada departamento se escreve. PUB é o que é
--    de todos (o próprio controle, o template, a ata).
--    O grupo de cada um se escolhe em Arquivos › Configurações; o do
--    Pessoal já vem ligado ao grupo do Depto de Pessoal.
-- ------------------------------------------------------------
insert into public.doc_emissores (prefixo, nome, grupo_id, ordem) values
  ('PUB', 'Geral',                                       null, 0),
  ('PES', 'Departamento de Pessoal',                     (select id from public.grupos where chave = 'pessoal'), 1),
  ('PRO', 'Departamento de Pesquisa e Desenvolvimento',  null, 2),
  ('CLI', 'Departamento Clínico',                        null, 3),
  ('REL', 'Departamento de Relações Institucionais',     null, 4),
  ('DIR', 'Diretoria',                                   null, 5),
  ('MKT', 'Departamento de Marketing',                   null, 6)
on conflict (prefixo) do nothing;

-- ------------------------------------------------------------
-- 2. AS SÉRIES
-- ------------------------------------------------------------
create or replace function pg_temp.pessoa(p_nome text)
returns integer language sql stable as $$
  select registro from public.membros
   where p_nome is not null
     and (lower(split_part(coalesce(email_nro, ''), '@', 1)) = lower(p_nome)
          or upper(nome) = upper(p_nome))
   order by registro limit 1;
$$;

create or replace function pg_temp.semear(
  p_pref text, p_sn integer, p_titulo text, p_status text, p_tipo text, p_subtipo text,
  p_classe text, p_multiplo boolean, p_autor text, p_data date, p_revisor text,
  p_data_rev date, p_nota text)
returns void language plpgsql as $$
declare
  v_s   uuid;
  v_a   uuid;
  v_cod text := public.doc_codigo(p_pref, p_sn, null);
  v_aut integer := pg_temp.pessoa(p_autor);
  v_rev integer := pg_temp.pessoa(p_revisor);
begin
  if exists (select 1 from public.doc_series where prefixo = p_pref and sn = p_sn) then return; end if;
  insert into public.doc_series (prefixo, sn, titulo, tipo, subtipo, classe, multiplo, descricao)
  values (p_pref, p_sn, p_titulo, p_tipo, p_subtipo, p_classe, p_multiplo, p_nota)
  returning id into v_s;
  insert into public.doc_arquivos (serie_id, pn, codigo, status, rev_vigente, autor, autor_nome,
                                   criado_em, alterado_em, alterado_por, alterado_nome)
  values (v_s, null, v_cod, p_status, case when p_status = 'ativo' then 'A' end,
          v_aut, p_autor, coalesce(p_data, now()), coalesce(p_data_rev, p_data, now()),
          coalesce(v_rev, v_aut), coalesce(p_revisor, p_autor, 'NRO-PUB-001'))
  returning id into v_a;
  if p_status = 'ativo' then
    insert into public.doc_revisoes (arquivo_id, rev, estado, mudancas, enviado_por, enviado_nome, enviado_em,
                                     revisor, revisor_nome, revisado_em, importada)
    values (v_a, 'A', 'aprovada', 'Versão inicial, registrada na NRO-PUB-001.', v_aut, p_autor,
            coalesce(p_data, now()), v_rev, p_revisor, coalesce(p_data_rev, p_data, now()), true);
  end if;
  insert into public.doc_eventos (arquivo_id, tipo, detalhe, nome, criado_em)
  values (v_a, 'importou', 'NRO-PUB-001', 'NRO-PUB-001', coalesce(p_data, now()));
end $$;

select pg_temp.semear('PUB', 1, 'CONTROLE DE DOCUMENTOS E REGISTROS', 'ativo', 'registro', 'planilha', 'publico', true, 'MMARCONDES', '2026-03-08'::date, null, null, null);
select pg_temp.semear('PUB', 2, 'TEMPLATE DE DOCUMENTOS E REGISTROS', 'ativo', 'documento', 'template', 'publico', false, 'MMARCONDES', '2026-04-07'::date, null, null, null);
select pg_temp.semear('PUB', 3, 'ATA DE REUNIÃO', 'ativo', 'registro', 'ata', 'publico', true, 'MMARCONDES', '2026-04-13'::date, null, null, null);
select pg_temp.semear('PES', 1, 'FORMULÁRIO DE ADMISSÃO', 'ativo', 'registro', 'formulario', 'publico', true, 'MMARCONDES', '2026-03-07'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 2, 'FORMULÁRIO DE SOLICITAÇÃO DE AFASTAMENTO TEMPORÁRIO', 'ativo', 'registro', 'formulario', 'publico', true, 'MMARCONDES', '2026-03-07'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 3, 'FORMULÁRIO DE SOLICITAÇÃO DE DESLIGAMENTO', 'ativo', 'registro', 'formulario', 'publico', true, 'MMARCONDES', '2026-03-07'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 4, 'MANUAL DO MEMBRO', 'rascunho', 'documento', 'manual', 'publico', false, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('PES', 5, 'QUADRO DE PESSOAL', 'ativo', 'registro', 'planilha', 'confidencial', true, 'MMARCONDES', '2026-03-07'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 6, 'PROCEDIMENTO DE ADMISSÃO', 'ativo', 'documento', 'procedimento', 'publico', false, 'MMARCONDES', '2026-03-08'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 7, 'PROCEDIMENTO DE DESLIGAMENTO', 'ativo', 'documento', 'procedimento', 'publico', false, 'MMARCONDES', '2026-03-08'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 8, 'FORMULÁRIO DE REQUISIÇÃO DE ACESSO', 'rascunho', 'registro', 'formulario', 'publico', true, null, null, null, null, null);
select pg_temp.semear('PES', 9, 'POLÍTICA DE EMAIL INSTITUCIONAL', 'ativo', 'documento', 'politica', 'publico', false, 'MMARCONDES', '2026-03-13'::date, null, null, null);
select pg_temp.semear('PES', 10, 'RELATORIO DE VIAGEM', 'ativo', 'registro', 'relatorio', 'publico', true, 'MMARCONDES', '2026-03-18'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 11, 'DESPESAS DE VIAGEM', 'ativo', 'registro', 'planilha', 'publico', true, 'MMARCONDES', '2026-03-18'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 12, 'POLÍTICA DE COPARTICIPAÇÃO EM ATIVIDADES DA VIDA ACADÊMICA', 'ativo', 'documento', 'politica', 'publico', false, 'MMARCONDES', '2026-03-24'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 13, 'POLÍTICA DE PROGRESSÃO FUNCIONAL', 'ativo', 'documento', 'politica', 'publico', false, 'MMARCONDES', '2026-03-24'::date, 'ANA ALICE GOMES', '2026-03-28'::date, null);
select pg_temp.semear('PES', 14, 'CHECKLIST DE ORGANIZAÇÃO DE REUNIÃO GERAL', 'ativo', 'documento', 'checklist', 'publico', false, 'MMARCONDES', '2026-04-06'::date, null, null, null);
select pg_temp.semear('PES', 15, 'POLÍTICA DE ACESSO AO LABBIO', 'ativo', 'documento', 'politica', 'publico', false, 'MMARCONDES', '2026-04-15'::date, null, null, null);
select pg_temp.semear('PES', 16, 'FORMULÁRIO DE SUBMISSÃO DO TERMO DE SIGILO DO LABBIO', 'ativo', 'registro', 'formulario', 'publico', true, 'MMARCONDES', '2026-04-16'::date, null, null, null);
select pg_temp.semear('PES', 17, 'GUIA DE CONTROLE DE ACESSO À INFORMAÇÃO', 'rascunho', 'documento', 'manual', 'controlado', false, null, null, null, null, null);
select pg_temp.semear('PES', 18, 'GUIA DE COMPARTILHAMENTO DE CALENDÁRIO', 'ativo', 'documento', 'manual', 'publico', false, 'MMARCONDES', '2026-05-11'::date, null, null, null);
select pg_temp.semear('PES', 19, 'EDITAL', 'rascunho', 'documento', 'outro', 'controlado', false, null, null, null, null, 'Veio da NRO-PUB-001 sem status, tipo, subtipo, classe — confira.');
select pg_temp.semear('PRO', 1, 'TERMO DE ABERTURA DE PROJETO', 'ativo', 'documento', 'relatorio', 'controlado', true, null, null, null, null, 'Na NRO-PUB-001 estava como registro. Passa a documento com PN — um termo por projeto, e cada um se revisa.');
select pg_temp.semear('PRO', 2, 'MANUAL DE INSPEÇÃO DE HARDWARE', 'rascunho', 'documento', 'manual', 'publico', false, null, null, null, null, null);
select pg_temp.semear('PRO', 3, 'RELATÓRIO DE EXECUÇÃO DE TESTES', 'ativo', 'registro', 'relatorio', 'controlado', true, 'MMARCONDES', '2026-04-13'::date, null, null, null);
select pg_temp.semear('PRO', 4, '(USRS) USER AND SYSTEM REQUIREMENTS SPECIFICATION', 'ativo', 'registro', 'planilha', 'controlado', true, 'MMARCONDES', '2026-06-04'::date, null, null, null);
select pg_temp.semear('PRO', 5, 'PLANO DE VALIDAÇÃO', 'rascunho', 'documento', 'manual', 'controlado', true, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('PRO', 6, 'MATRIZ DE GERENCIAMENTO DE RISCOS', 'rascunho', 'registro', 'planilha', 'controlado', true, null, null, null, null, null);
select pg_temp.semear('PRO', 7, 'PORTFÓLIO', 'ativo', 'registro', 'planilha', 'controlado', true, 'MMARCONDES', '2026-04-27'::date, null, null, null);
select pg_temp.semear('PRO', 8, 'RELATÓRIO TÉCNICO PARCIAL', 'ativo', 'registro', 'relatorio', 'controlado', true, null, null, null, null, null);
select pg_temp.semear('PRO', 9, '(DHF) DESIGN HISTORY FILE', 'rascunho', 'registro', 'relatorio', 'controlado', true, 'MMARCONDES', '2026-04-17'::date, null, null, null);
select pg_temp.semear('PRO', 10, '(DMF) DESIGN MASTER FILE', 'rascunho', 'registro', 'relatorio', 'controlado', true, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('PRO', 11, 'MATRIZ DE RASTREABILIDADE DE REQUISITOS', 'rascunho', 'registro', 'planilha', 'controlado', true, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('PRO', 12, 'INTERFACE SPECIFICATION CONTROL', 'rascunho', 'documento', 'planilha', 'controlado', true, null, null, null, null, null);
select pg_temp.semear('PRO', 13, 'ARCHITECTURE DECISION RECORD', 'rascunho', 'registro', 'relatorio', 'controlado', true, null, null, null, null, null);
select pg_temp.semear('PRO', 14, 'DESIGN RECORD', 'ativo', 'registro', 'relatorio', 'controlado', true, 'MMARCONDES', '2026-05-15'::date, null, null, null);
select pg_temp.semear('DIR', 1, 'ESTATUTO', 'ativo', 'documento', 'outro', 'publico', false, 'MMARCONDES', '2026-03-24'::date, null, null, null);
select pg_temp.semear('DIR', 2, 'REGIMENTO INTERNO', 'rascunho', 'documento', 'outro', 'publico', false, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('DIR', 3, 'REGISTRO DE CONTAS DIGITAIS', 'rascunho', 'registro', 'planilha', 'confidencial', true, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('DIR', 4, 'DECLARAÇÃO DE MEMBRO', 'ativo', 'documento', 'declaracao', 'controlado', false, 'MMARCONDES', '2026-04-06'::date, null, null, null);
select pg_temp.semear('DIR', 5, 'CÓDIGO DE CONDUTA', 'rascunho', 'documento', 'politica', 'publico', false, null, null, null, null, 'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.');
select pg_temp.semear('MKT', 1, 'POLÍTICA DE REDES SOCIAIS', 'ativo', 'documento', 'politica', 'publico', false, 'MMARCONDES', '2026-03-18'::date, null, null, null);
select pg_temp.semear('MKT', 2, 'INFORMAÇÕES PÚBLICAS DE PROJETOS', 'ativo', 'registro', 'planilha', 'publico', true, 'MMARCONDES', '2026-04-01'::date, null, null, null);
select pg_temp.semear('MKT', 3, 'REGISTRO DE EXPOSIÇÕES PÚBLICAS DA EQUIPE', 'rascunho', 'registro', 'planilha', 'publico', true, null, null, null, null, null);
select pg_temp.semear('MKT', 4, 'BRIEFING DE CAMPANHA', 'ativo', 'registro', 'relatorio', 'controlado', true, 'MMARCONDES', '2026-04-16'::date, null, null, null);
select pg_temp.semear('MKT', 5, 'IDEIAS DE PUBLICAÇÕES', 'rascunho', 'registro', 'planilha', 'publico', true, null, null, null, null, null);

-- ------------------------------------------------------------
-- 3. O PADRÃO DE PROJETO (proposta inicial; o PMO ajusta)
-- ------------------------------------------------------------
insert into public.doc_padrao_projeto (serie_id, ordem, quantidade)
select s.id, x.ordem, x.quantidade
  from (values (1, 1, 'um'), (4, 2, 'um'), (6, 3, 'um'), (5, 4, 'um'), (12, 5, 'um'),
               (13, 6, 'varios'), (14, 7, 'varios'), (11, 8, 'um'), (3, 9, 'varios'),
               (8, 10, 'varios'), (9, 11, 'um'), (10, 12, 'um')) as x(sn, ordem, quantidade)
  join public.doc_series s on s.prefixo = 'PRO' and s.sn = x.sn and s.multiplo
on conflict (serie_id) do nothing;

-- ------------------------------------------------------------
-- 4. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v21_rol_nro_pub_001', 'O rol inicial: as 46 linhas da planilha NRO-PUB-001 viram séries do controle de arquivos, com os sete emissores e um padrão de projeto proposto')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 21.0
--
-- Depois de rodar, em Arquivos › Configurações:
--   1) ligue cada emissor ao grupo que responde por ele (só o
--      Pessoal já vem ligado);
--   2) escolha o grupo revisor de cada série — sem grupo, quem revisa
--      é o PMO;
--   3) confira o padrão de projeto.
-- E anexe, arquivo por arquivo, o .docx/.xlsx de cada Rev. A em vigor.
-- ============================================================
