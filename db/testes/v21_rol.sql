\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- roda sobre um banco com a 20.0 e a 21.0 aplicadas
do $$ begin
  perform ok((select count(*) from doc_emissores) = 7, 'os sete emissores da planilha');
  perform ok((select string_agg(prefixo || ':' || n, ' ' order by prefixo) from (
                select s.prefixo, count(*) n from doc_series s group by 1) x)
             = 'DIR:5 MKT:5 PES:19 PRO:14 PUB:3', 'as 46 linhas, por aba: PUB 3, PES 19, PRO 14, DIR 5, MKT 5');
  perform ok((select count(*) from doc_arquivos where pn is null) = 46, 'uma cabeça por série');
  perform ok((select count(*) from doc_arquivos where status = 'ativo') = 29
             and (select count(*) from doc_revisoes where importada and estado = 'aprovada' and rev = 'A') = 29,
             'as 29 EM VIGÊNCIA entram ativas, com a Rev. A aprovada e importada');
  perform ok((select count(*) from doc_arquivos where status = 'rascunho') = 17, 'as outras 17, em rascunho');
  perform ok((select descricao from doc_series where prefixo = 'PES' and sn = 4) like '%INEXISTENTE%',
             'o que era INEXISTENTE diz isso na série');
  perform ok((select descricao from doc_series where prefixo = 'PES' and sn = 19) like '%sem status, tipo, subtipo, classe%',
             'o EDITAL, que veio sem nada, avisa o que falta');
  perform ok((select tipo = 'documento' and multiplo from doc_series where prefixo = 'PRO' and sn = 1),
             'o termo de abertura é documento com PN');
  perform ok((select natureza from doc_rol where codigo = 'NRO-PES-001') = 'template'
             and (select natureza from doc_rol where codigo = 'NRO-PES-015') = 'documento'
             and (select natureza from doc_rol where codigo = 'NRO-PUB-002') = 'template',
             'formulário (registro) vira template de registro; política, documento; o NRO-PUB-002, template');
  perform ok((select revisor_nome || ' ' || revisado_em::date from doc_revisoes r join doc_arquivos a on a.id = r.arquivo_id
               where a.codigo = 'NRO-PES-006') = 'ANA ALICE GOMES 2026-03-28',
             'quem revisou e quando, da planilha');
  perform ok((select enviado_nome || ' ' || enviado_em::date from doc_revisoes r join doc_arquivos a on a.id = r.arquivo_id
               where a.codigo = 'NRO-PUB-002') = 'MMARCONDES 2026-04-07',
             'data no formato 07-ABR-26 lida certo');
  perform ok((select autor_nome from doc_arquivos where codigo = 'NRO-DIR-004') = 'MMARCONDES',
             'o MAMRCONDES da planilha vira MMARCONDES');
  perform ok((select classe from doc_series where prefixo = 'PES' and sn = 5) = 'confidencial',
             'o quadro de pessoal continua confidencial');
  perform ok((select count(*) from doc_padrao_projeto) = 12, 'o padrão de projeto proposto tem 12 séries');
  perform ok(not exists (select 1 from doc_padrao_projeto p join doc_series s on s.id = p.serie_id
                          where s.prefixo = 'PRO' and s.sn in (2, 7)),
             'sem o manual de inspeção e sem o portfólio, que não são por projeto');
end $$;

-- de novo, sem duplicar
\ir ../v21_rol_nro_pub_001.sql
do $$ begin
  perform ok((select count(*) from doc_series) = 46 and (select count(*) from doc_revisoes) = 29
             and (select count(*) from doc_padrao_projeto) = 12,
             'rodar a 21.0 de novo não duplica nada');
end $$;
