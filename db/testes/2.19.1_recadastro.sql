\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: recadastro semestral e termo de sigilo do LABBIO.
-- Rode depois dos testes da 2.18.0 e da 2.19.0, no mesmo banco:
--   createdb -T tbase t2191
--   psql -d t2191 -f testes/2.18.0_soma.sql -f testes/2.19.0.sql -f testes/2.19.1_recadastro.sql
-- Aplica as migrações duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function sou(p_reg integer) returns void language plpgsql as $$
begin perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false); end $$;

\i 2.19.1_recadastro.sql
\i 2.19.1_termo.sql
\i 2.19.1_recadastro.sql
\i 2.19.1_termo.sql

do $$
declare r jsonb; d jsonb; bom jsonb;
begin
  raise notice 'Sem campanha';
  perform sou(11);
  perform ok(public.recadastro_estado()->>'status' = 'nenhum', 'sem campanha, ninguém tem recadastro pendente');
  perform ok(public.termo_estado()->>'status' = 'pendente', 'o termo é um serviço à parte, sempre disponível');
  perform ok(public.termo_emitir()->>'status' = 'dados_pendentes', 'sem dados conferidos, o termo não é emitido');

  raise notice 'Dados conferidos fora de campanha (Meus dados, onboarding)';
  r := public.cadastro_confirmar('{"nome_civil":"Bruno","cpf":"111.111.111-11","data_nascimento":"","estado_civil":"x","end_cep":"123","end_uf":"Minas"}');
  perform ok(r->>'status' = 'invalido' and r->'campos' ? 'nome_civil' and r->'campos' ? 'cpf' and r->'campos' ? 'data_nascimento'
    and r->'campos' ? 'matricula' and r->'campos' ? 'rg' and r->'campos' ? 'estado_civil' and r->'campos' ? 'end_cep' and r->'campos' ? 'end_uf'
    and r->'campos' ? 'telefone', 'dados incompletos ou inválidos voltam campo a campo');
  bom := '{"nome_civil":"Bruno  Tavares da Silva","cpf":"529.982.247-25","data_nascimento":"2001-03-04","matricula":"2021012345",
    "instituicao":"UFMG","curso":"Engenharia Elétrica","rg":"MG-12.345.678","rg_orgao":"pc-mg","nacionalidade":"Brasileira",
    "estado_civil":"solteiro(a)","telefone":"(31) 99876-5432","end_logradouro":"Rua dos Inconfidentes","end_numero":"123",
    "end_complemento":"apto 201","end_bairro":"Pampulha","end_cep":"31270-901","end_cidade":"Belo Horizonte","end_uf":"mg"}';
  r := public.cadastro_confirmar(bom);
  d := r->'dados';
  perform ok(r->>'status' = 'ok' and d->>'nome_civil' = 'Bruno Tavares da Silva' and d->>'cpf' = '52998224725' and d->>'rg_orgao' = 'PC-MG'
    and d->>'end_uf' = 'MG' and d->>'nacionalidade' = 'brasileira' and d->>'telefone' = '31998765432', 'dados completos: aceitos e normalizados');
  perform ok((select cpf from dados_pessoais where registro = 11) = '52998224725', 'o cadastro (dados_pessoais) é atualizado');
  perform ok((select count(*) from cadastro_confirmacoes where registro = 11 and campanha is null) = 1, 'e a confirmação entra no histórico, sem campanha');
  perform ok(public.cadastro_meus_dados()->>'cpf' = '52998224725', 'a pessoa lê os próprios dados pela função');

  raise notice 'Termo, separado';
  r := public.termo_emitir();
  perform ok(r->>'status' = 'ok' and r->'dados'->>'cpf' = '52998224725' and r->>'mes' is not null, 'com os dados conferidos, o termo é emitido');
  r := public.cadastro_confirmar(jsonb_set(bom, '{end_numero}', '"124"'));
  perform ok(public.termo_estado()->>'emitido_em' is null, 'mudou um dado depois de baixar: o termo baixado deixa de valer');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'nao_emitido',
    'e o envio é recusado até baixar de novo');
  perform public.termo_emitir();
  perform ok(not public.termo_arquivo_pode('labbio-2026/12/00000000-0000-0000-0000-000000000001.pdf', true), 'não grava na pasta de outro');
  perform ok(public.termo_arquivo_pode('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', true), 'grava na própria pasta');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'arquivo_ausente',
    'sem o arquivo no bucket, o envio não conta');

  raise notice 'Campanha de recadastro com o termo';
  perform ok(public.recadastro_campanha_ativar('2026-2', 'Recadastro 2026/2', 'labbio-2026', true)->>'status' = 'sem_permissao', 'só admin liga o recadastro');
  perform sou(4);
  r := public.recadastro_campanha_ativar('2026-2', 'Recadastro 2026/2', 'labbio-2026', true);
  perform ok(r->>'status' = 'ok' and (r->>'avisados')::int >= 5, 'admin liga, e os elegíveis são avisados: ' || (r->>'avisados'));
  perform ok((select count(*) from notificacoes where tipo = 'recadastro' and registro = 11) = 1
    and (select count(*) from notificacoes where tipo = 'recadastro' and registro = 44) = 0, 'Bruno recebe; o desligado não');
  perform sou(11);
  r := public.recadastro_estado();
  perform ok(r->>'status' = 'pendente' and r->>'dados_confirmados_em' is null and r->>'termo_campanha' = 'labbio-2026'
    and r->'termo'->>'status' = 'pendente' and (r->>'dispensa_disponivel')::boolean and not (r->>'bloqueia')::boolean,
    'a campanha pede de novo os dados (a confirmação de antes não conta) e o termo; a primeira vez pode esperar');
  perform ok(public.recadastro_dispensar()->>'status' = 'ok' and public.recadastro_dispensar()->>'status' = 'ja_usada', 'a dispensa é uma só');
  perform ok((public.recadastro_estado()->>'bloqueia')::boolean, 'depois da dispensa, bloqueia');
  r := public.cadastro_confirmar(jsonb_set(bom, '{end_numero}', '"124"'));
  r := public.recadastro_estado();
  perform ok(r->>'status' = 'pendente' and r->>'dados_confirmados_em' is not null and (r->>'bloqueia')::boolean,
    'dados conferidos na campanha, mas falta o termo: segue pendente');
  perform public.termo_emitir();
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'ok', 'o termo assinado é enviado');
  r := public.recadastro_estado();
  perform ok(r->>'status' = 'concluido' and not (r->>'bloqueia')::boolean and r->'termo'->>'status' = 'enviado', 'com os dados e o termo, o recadastro termina');

  raise notice 'Conferência do Pessoal';
  perform ok(public.termo_painel()->>'status' = 'sem_permissao' and public.recadastro_painel()->>'status' = 'sem_permissao', 'membro não vê os painéis');
  perform sou(4);
  r := public.termo_painel();
  perform ok(r->>'status' = 'ok' and (select x->>'situacao' from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 11) = 'enviado'
    and not exists (select 1 from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 44), 'o painel do termo lista os elegíveis');
  r := public.recadastro_painel();
  perform ok(r->>'status' = 'ok' and r->'campanha'->>'id' = '2026-2'
    and (select (x->>'concluido_em') is not null from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 11), 'o painel do recadastro mostra quem concluiu');
  perform ok(public.termo_conferir(11, false, '')->>'status' = 'motivo_obrigatorio', 'devolver exige motivo');
  perform ok(public.termo_conferir(11, false, 'Assinatura não aparece no PDF')->>'status' = 'ok', 'devolve com motivo');
  perform sou(11);
  r := public.recadastro_estado();
  perform ok(r->>'status' = 'pendente' and r->'termo'->>'status' = 'devolvido' and r->'termo'->>'motivo' like 'Assinatura%' and (r->>'bloqueia')::boolean,
    'devolvido: o recadastro volta a pedir o termo, com o motivo');
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/11/00000000-0000-0000-0000-000000000002.pdf');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000002.pdf', repeat('b', 64), 2000)->>'status' = 'ok', 'reenvio');
  r := public.recadastro_estado();
  perform ok(r->>'status' = 'concluido' and (select count(*) from termo_envios where registro = 11) = 2, 'concluído de novo, e o arquivo anterior fica no histórico');

  raise notice 'Próximo semestre, sem o termo';
  perform sou(4);
  update recadastro_campanhas set ativada_em = now() - interval '200 days' where id = '2026-2';
  update cadastro_confirmacoes set confirmado_em = now() - interval '190 days' where registro = 11;
  perform ok(public.recadastro_campanha_ativar('2027-1', 'Recadastro 2027/1', null, true)->>'status' = 'ok', 'a de 2027/1 liga sem o termo');
  perform sou(11);
  r := public.recadastro_estado();
  perform ok(r->>'campanha' = '2027-1' and r->>'status' = 'pendente' and r->'termo' = 'null'::jsonb, 'a nova campanha só pede os dados');
  perform ok(public.termo_emitir()->>'status' = 'dados_pendentes', 'e dados com mais de 180 dias não emitem termo');
  r := public.cadastro_confirmar(bom);
  perform ok(public.recadastro_estado()->>'status' = 'concluido', 'conferir os dados basta');

  raise notice 'Pausa por férias';
  perform sou(40);
  perform public.recadastro_estado(); perform public.recadastro_dispensar();
  perform ok((public.recadastro_estado()->>'bloqueia')::boolean, 'Fábio, depois da dispensa, bloqueado');
  insert into agenda_ausencias(registro, tipo, inicio, fim) values (40, 'ferias', now() - interval '1 day', now() + interval '5 days');
  r := public.recadastro_estado();
  perform ok((r->>'pausado')::boolean and not (r->>'bloqueia')::boolean, 'de férias, o pedido fica pausado');

  raise notice 'Permissões';
  perform ok(not has_function_privilege('anon', 'public.recadastro_estado()', 'execute') and not has_function_privilege('anon', 'public.termo_estado()', 'execute'),
    'anônimo não chama as funções');
  perform ok(not has_function_privilege('authenticated', 'public.termo_estado_de(integer,text)', 'execute')
    and not has_function_privilege('authenticated', 'public.recadastro_concluir(integer)', 'execute'), 'o estado de outra pessoa não é lido pela API');
  perform ok(not has_table_privilege('authenticated', 'public.cadastro_confirmacoes', 'select')
    and not has_table_privilege('authenticated', 'public.termo_pendencias', 'select'), 'ninguém lê as tabelas direto');
  perform ok(public.cadastro_cpf_valido('529.982.247-25') and not public.cadastro_cpf_valido('529.982.247-24') and not public.cadastro_cpf_valido('000.000.000-00'),
    'o dígito verificador do CPF é conferido');
  perform ok((select public from storage.buckets where id = 'termos') = false, 'o bucket termos é privado');
end $$;
\echo 'Tudo certo.'
