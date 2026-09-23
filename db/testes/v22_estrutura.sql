\set ON_ERROR_STOP on
\pset pager off
-- roda sobre um banco com a 20.0 e a 21.0 aplicadas, ANTES da 22.0:
-- o teste prepara o que a 22.0 precisa respeitar e aplica a 22.0 no meio
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function arq(p_codigo text) returns uuid language sql as $$
  select id from doc_arquivos where codigo = p_codigo $$;
create or replace function ser(p_codigo text) returns uuid language sql as $$
  select serie_id from doc_arquivos where codigo = p_codigo $$;
-- a estrutura, calculada aqui sem a doc_estrutura() da 22.0 — que ainda não existe, e que assim é conferida
create or replace function est(p_codigo text) returns text language sql as $$
  select case when s.multiplo and s.tipo = 'registro' then 'registros' when s.multiplo then 'documentos' else 'unico' end
    from doc_series s where s.id = ser(p_codigo) $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', p_reg::text, false);
  perform set_config('teste.papel', p_papel, false);
  perform set_config('teste.uid', (select id::text from perfis where registro = p_reg), false);
end $$;
-- "sobe" um arquivo para o Storage, como o supabase-js faria
create or replace function sobe(p_codigo text, p_nome text) returns text language plpgsql as $$
declare v text := arq(p_codigo)::text || '/' || gen_random_uuid()::text || '/' || p_nome;
begin
  insert into storage.objects (bucket_id, name, owner) values ('arquivos', v, current_setting('teste.uid')::uuid);
  return v;
end $$;

insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin', 4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'admin', 11)
on conflict do nothing;

-- ------------------------------------------------------------
-- ANTES DA 22.0 — o que a equipe pode ter feito depois da 21.0
--   NRO-PRO-004-1  USRS (era registro), enviado e aprovado: registro sem letra
--   NRO-PRO-013-1  ADR (era registro), enviado, aguardando: pendente sem letra
--   NRO-PES-005-1  um PN no quadro de pessoal, que a coluna diz ser documento único
--   NRO-DIR-004    o PMO fez dela série de documentos, e criou um PN
-- ------------------------------------------------------------
do $$ declare r jsonb; v_c text; begin
  perform eu(4, 'admin');
  perform ok(est('NRO-PRO-004') = 'registros' and est('NRO-PES-005') = 'registros' and est('NRO-DIR-004') = 'unico',
             'antes da 22.0: USRS e quadro de pessoal eram de registros; a declaração, documento único');

  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-004')));
  perform ok(r->>'codigo' = 'NRO-PRO-004-1', 'Ana cria o NRO-PRO-004-1');
  v_c := sobe('NRO-PRO-004-1', 'usrs.xlsx');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-004-1'), 'caminho', v_c));
  perform ok(r->>'status' = 'ok' and r->>'rev' is null, 'e envia: como registro, sem letra');
  perform eu(11, 'admin');
  r := doc_revisao_decidir(jsonb_build_object('revisao_id', r->>'id', 'decisao', 'aprovar'));
  perform ok(r->>'status' = 'ok', 'Bruno aprova');
  perform ok((select status = 'ativo' and rev_vigente is null from doc_arquivos where codigo = 'NRO-PRO-004-1'),
             'o registro aprovado não tem revisão em vigor');

  perform eu(4, 'admin');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PRO-013')));
  v_c := sobe('NRO-PRO-013-1', 'adr.docx');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-013-1'), 'caminho', v_c));
  perform ok((select rev_pendente from doc_arquivos where codigo = 'NRO-PRO-013-1') = '—',
             'o NRO-PRO-013-1 aguarda revisão, sem letra');

  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PES-005')));
  perform ok(r->>'codigo' = 'NRO-PES-005-1', 'e alguém criou um PN no quadro de pessoal');

  update doc_series set multiplo = true where id = ser('NRO-DIR-004');
  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-DIR-004')));
  perform ok(r->>'codigo' = 'NRO-DIR-004-1', 'e a declaração virou série de documentos, com um PN');
end $$;

create temp table eventos_antes as select count(*) as n from doc_eventos where tipo = 'estrutura';

-- ------------------------------------------------------------
-- A 22.0
-- ------------------------------------------------------------
\ir ../v22_estrutura_das_series.sql

-- ------------------------------------------------------------
-- 1. a coluna vale
-- ------------------------------------------------------------
do $$ begin
  perform ok(doc_estrutura_frase('unico') = 'um documento para toda a equipe, sem template e sem filhos'
             and doc_estrutura_frase('documentos') = 'um template, cada pn é um documento filho da série'
             and doc_estrutura_frase('registros') = 'um template, cada pn é um registro filho da série',
             'as três frases, iguais às da planilha');
  perform ok((select count(*) from v22_coluna) = 45, 'as 45 linhas com a coluna preenchida');
  perform ok((select count(*) from v22_coluna k join doc_series s on s.prefixo = k.prefixo and s.sn = k.sn
               where doc_estrutura(s.tipo, s.multiplo) = k.estrutura) = 43,
             '43 séries ficam como a coluna diz (as duas que faltam têm PN)');
  perform ok(est('NRO-PUB-001') = 'unico' and est('NRO-PES-016') = 'unico' and est('NRO-DIR-003') = 'unico'
             and est('NRO-MKT-002') = 'unico', 'controle de documentos, termo de sigilo, contas digitais e informações públicas: documento único');
  perform ok(est('NRO-PES-019') = 'registros', 'o edital: um template, cada PN é um registro');
  perform ok(est('NRO-PRO-002') = 'documentos' and est('NRO-PRO-004') = 'documentos' and est('NRO-PRO-007') = 'documentos'
             and est('NRO-PRO-014') = 'documentos' and est('NRO-MKT-004') = 'documentos',
             'manual de inspeção, USRS, portfólio, design record e briefing: um template, cada PN é um documento');
  perform ok(est('NRO-PRO-003') = 'registros' and est('NRO-PUB-003') = 'registros' and est('NRO-PES-007') = 'unico',
             'o que já estava certo continua: relatório de teste e ata de registros; o procedimento, único');
  perform ok((select natureza from doc_rol where codigo = 'NRO-PUB-001') = 'documento'
             and (select natureza from doc_rol where codigo = 'NRO-PRO-004') = 'template'
             and (select natureza from doc_rol where codigo = 'NRO-PES-019') = 'template',
             'na tela: o NRO-PUB-001 é documento; USRS e edital, templates');
  perform ok((select tipo = 'documento' and not multiplo and subtipo = 'template' from doc_series where id = ser('NRO-PUB-002'))
             and (select natureza from doc_rol where codigo = 'NRO-PUB-002') = 'template',
             'o NRO-PUB-002, sem nada na coluna, fica template avulso');
end $$;

-- ------------------------------------------------------------
-- 2. o que já existia não se perde
-- ------------------------------------------------------------
do $$ begin
  perform ok(est('NRO-PES-005') = 'registros', 'o quadro de pessoal já tinha PN: ficou como estava');
  perform ok(est('NRO-DIR-004') = 'documentos', 'a declaração com PN documento não vira de registros');
  perform ok((select natureza from doc_rol where codigo = 'NRO-PRO-004-1') = 'documento',
             'o NRO-PRO-004-1 agora é documento');
  perform ok((select rev_vigente from doc_arquivos where codigo = 'NRO-PRO-004-1') = 'A'
             and (select rev from doc_revisoes where arquivo_id = arq('NRO-PRO-004-1') and estado = 'aprovada') = 'A',
             'e a versão aprovada que tinha virou a Rev. A');
  perform ok((select rev_pendente from doc_arquivos where codigo = 'NRO-PRO-013-1') = 'A'
             and (select rev from doc_revisoes where arquivo_id = arq('NRO-PRO-013-1') and estado = 'pendente') = 'A',
             'o NRO-PRO-013-1 aguarda a Rev. A');
  perform ok((select count(*) from doc_padrao_projeto) = 12
             and not exists (select 1 from doc_padrao_projeto p join doc_series s on s.id = p.serie_id where not s.multiplo),
             'o padrão de projeto continua com as 12 séries, todas com PN');
  perform ok(exists (select 1 from migracoes where id = 'v22_estrutura_das_series'), 'a 22.0 fica registrada');
end $$;

-- ------------------------------------------------------------
-- 3. o registro de alterações conta
-- ------------------------------------------------------------
do $$ begin
  perform ok((select count(*) from doc_eventos where tipo = 'estrutura') - (select n from eventos_antes) = 16 + 2,
             '16 cabeças de série mudaram, e 2 PNs viraram documento: 18 eventos');
  perform ok((select detalhe from doc_eventos where arquivo_id = arq('NRO-PRO-004') and tipo = 'estrutura')
             = 'um template, cada pn é um documento filho da série (era: um template, cada pn é um registro filho da série)',
             'na cabeça do USRS: a frase de agora e a de antes');
  perform ok((select nome from doc_eventos where arquivo_id = arq('NRO-PRO-004') and tipo = 'estrutura')
             = 'Migração 22.0 — coluna nova da NRO-PUB-001', 'assinado pela migração');
  perform ok((select detalhe from doc_eventos where arquivo_id = arq('NRO-PRO-004-1') and tipo = 'estrutura')
             like 'documento filho da série (era: registro filho da série)%Rev. A', 'no PN, o que aconteceu com a versão dele');
  perform ok(not exists (select 1 from doc_eventos where arquivo_id = arq('NRO-PES-005') and tipo = 'estrutura'),
             'o quadro de pessoal, que não mudou, não ganha evento');
end $$;

-- ------------------------------------------------------------
-- 4. documento se altera; registro não
-- ------------------------------------------------------------
do $$ declare r jsonb; v_c text; begin
  perform eu(4, 'admin');
  v_c := sobe('NRO-PRO-004-1', 'usrs-b.xlsx');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-004-1'), 'caminho', v_c));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'mudancas', 'revisar o USRS pede o que mudou — é documento agora');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PRO-004-1'), 'caminho', v_c, 'mudancas', 'Requisitos da bancada 2.'));
  perform ok(r->>'status' = 'ok' and r->>'rev' = 'B', 'e a revisão nova é a Rev. B');

  r := doc_arquivo_criar(jsonb_build_object('serie_id', ser('NRO-PUB-003')));
  v_c := sobe(r->>'codigo', 'ata.docx');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq(r->>'codigo'), 'caminho', v_c));
  perform eu(11, 'admin');
  perform doc_revisao_decidir(jsonb_build_object('revisao_id', r->>'id', 'decisao', 'aprovar'));
  perform eu(4, 'admin');
  v_c := sobe('NRO-PUB-003-1', 'ata-2.docx');
  r := doc_revisao_enviar(jsonb_build_object('arquivo_id', arq('NRO-PUB-003-1'), 'caminho', v_c, 'mudancas', 'x'));
  perform ok(r->>'status' = 'registro_fechado', 'a ata aprovada continua fechada: registro não se altera');
end $$;

-- ------------------------------------------------------------
-- 5. pela tela: o PMO muda a estrutura, e fica escrito quem
-- ------------------------------------------------------------
do $$ declare r jsonb; begin
  perform eu(4, 'admin');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PES-004'), 'multiplo', true));
  perform ok(r->>'status' = 'ok' and est('NRO-PES-004') = 'documentos', 'o manual do membro vira template de documentos');
  perform ok((select nome || ' · ' || detalhe from doc_eventos where arquivo_id = arq('NRO-PES-004') and tipo = 'estrutura')
             = 'Ana Figueiredo · um template, cada pn é um documento filho da série (era: um documento para toda a equipe, sem template e sem filhos)',
             'e o registro de alterações diz quem mudou, e de quê para quê');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PES-004'), 'multiplo', false));
  perform ok(est('NRO-PES-004') = 'unico'
             and (select count(*) from doc_eventos where arquivo_id = arq('NRO-PES-004') and tipo = 'estrutura') = 2,
             'voltar também fica escrito');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PES-004'), 'titulo', 'MANUAL DO MEMBRO'));
  perform ok((select count(*) from doc_eventos where arquivo_id = arq('NRO-PES-004') and tipo = 'estrutura') = 2,
             'mudar só o título não é mudar a estrutura');
  r := doc_serie_salvar(jsonb_build_object('id', ser('NRO-PRO-004'), 'tipo', 'registro'));
  perform ok(r->>'status' = 'tem_pn', 'série que já tem PN não muda de estrutura pela tela');
end $$;

-- ------------------------------------------------------------
-- 6. rodar de novo não muda nada
-- ------------------------------------------------------------
create temp table eventos_meio as select count(*) as n from doc_eventos where tipo = 'estrutura';
\ir ../v22_estrutura_das_series.sql
do $$ begin
  perform ok((select count(*) from doc_eventos where tipo = 'estrutura') = (select n from eventos_meio),
             'a 22.0 de novo: nenhum evento a mais');
  perform ok(est('NRO-PRO-004') = 'documentos' and est('NRO-PES-005') = 'registros'
             and (select rev_vigente from doc_arquivos where codigo = 'NRO-PRO-004-1') = 'A',
             'e tudo como estava');
end $$;
