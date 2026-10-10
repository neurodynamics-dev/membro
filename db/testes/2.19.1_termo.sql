\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: o termo de sigilo do LABBIO com recadastro.
-- Rode depois dos testes da 2.18.0 e da 2.19.0, no mesmo banco:
--   createdb -T tbase t2191
--   psql -d t2191 -f testes/2.18.0_soma.sql -f testes/2.19.0.sql -f testes/2.19.1_termo.sql
-- Aplica a migração duas vezes.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function sou(p_reg integer) returns void language plpgsql as $$
begin perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false); end $$;

\i 2.19.1_termo.sql
\i 2.19.1_termo.sql

do $$
declare r jsonb; d jsonb; bom jsonb; quem integer;
begin
  raise notice 'Campanha desligada';
  perform sou(11);
  perform ok(public.termo_estado()->>'status' = 'nenhum', 'com a campanha desligada, ninguém tem pendência');
  perform ok(public.termo_campanha_ativar(true)->>'status' = 'sem_permissao', 'só admin liga a campanha');
  perform sou(4);
  r := public.termo_campanha_ativar(true);
  perform ok(r->>'status' = 'ok' and (r->>'avisados')::int >= 5, 'admin liga, e os membros elegíveis são avisados: ' || (r->>'avisados'));
  perform ok((select count(*) from notificacoes where tipo = 'termo' and registro = 11) = 1, 'Bruno recebe o aviso');
  perform ok((select count(*) from notificacoes where tipo = 'termo' and registro = 44) = 0, 'desligado não recebe');

  raise notice 'O pedido na entrada';
  perform sou(11);
  r := public.termo_estado();
  perform ok(r->>'status' = 'pendente' and (r->>'dispensa_disponivel')::boolean and not (r->>'bloqueia')::boolean,
    'primeira entrada: pendente, pode dispensar, não bloqueia');
  perform ok(public.termo_dispensar()->>'status' = 'ok', 'a dispensa é usada');
  perform ok(public.termo_dispensar()->>'status' = 'ja_usada', 'e só uma vez, em qualquer aparelho');
  r := public.termo_estado();
  perform ok((r->>'bloqueia')::boolean and not (r->>'dispensa_disponivel')::boolean, 'depois da dispensa, a pendência bloqueia');

  raise notice 'Verificação dos dados antes de emitir';
  perform ok(public.termo_emitir()->>'status' = 'dados_pendentes', 'sem confirmar os dados, o termo não é emitido');
  r := public.termo_confirmar_dados('{"nome_civil":"Bruno","cpf":"111.111.111-11","data_nascimento":"","estado_civil":"x","end_cep":"123","end_uf":"Minas"}');
  perform ok(r->>'status' = 'invalido' and r->'campos' ? 'nome_civil' and r->'campos' ? 'cpf' and r->'campos' ? 'data_nascimento'
    and r->'campos' ? 'matricula' and r->'campos' ? 'rg' and r->'campos' ? 'estado_civil' and r->'campos' ? 'end_cep' and r->'campos' ? 'end_uf'
    and r->'campos' ? 'telefone', 'dados incompletos ou inválidos voltam campo a campo');
  bom := '{"nome_civil":"Bruno  Tavares da Silva","cpf":"529.982.247-25","data_nascimento":"2001-03-04","matricula":"2021012345",
    "instituicao":"UFMG","curso":"Engenharia Elétrica","rg":"MG-12.345.678","rg_orgao":"pc-mg","nacionalidade":"Brasileira",
    "estado_civil":"solteiro(a)","telefone":"(31) 99876-5432","end_logradouro":"Rua dos Inconfidentes","end_numero":"123",
    "end_complemento":"apto 201","end_bairro":"Pampulha","end_cep":"31270-901","end_cidade":"Belo Horizonte","end_uf":"mg"}';
  r := public.termo_confirmar_dados(bom);
  perform ok(r->>'status' = 'ok', 'dados completos são aceitos');
  d := r->'dados';
  perform ok(d->>'nome_civil' = 'Bruno Tavares da Silva' and d->>'cpf' = '52998224725' and d->>'rg_orgao' = 'PC-MG'
    and d->>'end_uf' = 'MG' and d->>'nacionalidade' = 'brasileira' and d->>'telefone' = '31998765432', 'e normalizados');
  perform ok((select cpf from dados_pessoais where registro = 11) = '52998224725', 'o cadastro (dados_pessoais) é atualizado');
  r := public.termo_emitir();
  perform ok(r->>'status' = 'ok' and r->'dados'->>'cpf' = '52998224725' and r->>'mes' is not null, 'emitido com a fotografia confirmada e a data por extenso');
  r := public.termo_confirmar_dados(bom);
  perform ok((select emitido_em from termo_pendencias where registro = 11) is not null, 'confirmar os mesmos dados mantém o termo emitido');
  r := public.termo_confirmar_dados(jsonb_set(bom, '{end_numero}', '"124"'));
  perform ok((select emitido_em from termo_pendencias where registro = 11) is null, 'mudar um dado invalida o termo baixado: é preciso baixar de novo');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'nao_emitido',
    'sem o termo emitido com os dados atuais, o envio é recusado');
  perform public.termo_emitir();

  raise notice 'Envio do assinado';
  perform ok(not public.termo_arquivo_pode('labbio-2026/12/00000000-0000-0000-0000-000000000001.pdf', true), 'não grava na pasta de outro');
  perform ok(public.termo_arquivo_pode('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', true), 'grava na própria pasta');
  perform ok(not public.termo_arquivo_pode('labbio-2026/11/qualquer.pdf', true), 'nome fora do padrão é recusado');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'arquivo_ausente',
    'sem o arquivo no bucket, o envio não conta');
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000001.pdf', repeat('a', 64), 1000)->>'status' = 'ok', 'com o arquivo, o envio conta');
  r := public.termo_estado();
  perform ok(r->>'status' = 'enviado' and not (r->>'bloqueia')::boolean, 'enviado: não bloqueia mais');

  raise notice 'Conferência do Pessoal';
  perform ok(public.termo_painel()->>'status' = 'sem_permissao', 'membro não vê o painel');
  perform ok(public.termo_conferir(11, true)->>'status' = 'sem_permissao', 'nem confere');
  perform sou(4);
  r := public.termo_painel();
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'pessoas') >= 5
    and (select x->>'situacao' from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 11) = 'enviado'
    and not exists (select 1 from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 44), 'o painel lista os elegíveis, com a situação');
  perform ok(public.termo_conferir(11, false, '')->>'status' = 'motivo_obrigatorio', 'devolver exige motivo');
  perform ok(public.termo_conferir(11, false, 'Assinatura não aparece no PDF')->>'status' = 'ok', 'devolve com motivo');
  perform ok((select count(*) from notificacoes where tipo = 'termo' and registro = 11 and titulo like '%devolvido%') = 1, 'e a pessoa é avisada');
  perform sou(11);
  r := public.termo_estado();
  perform ok(r->>'status' = 'devolvido' and (r->>'bloqueia')::boolean and r->>'motivo' like 'Assinatura%', 'devolvido volta a bloquear, com o motivo');
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/11/00000000-0000-0000-0000-000000000002.pdf');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000002.pdf', repeat('b', 64), 2000)->>'status' = 'ok', 'reenvio');
  r := public.termo_estado();
  perform ok(r->>'status' = 'enviado' and (select count(*) from termo_envios where registro = 11) = 2,
    'o reenvio conta, e o arquivo anterior fica no histórico');
  perform sou(4);
  perform ok(public.termo_conferir(11, true)->>'status' = 'ok', 'Pessoal confere');
  perform sou(11);
  perform ok(public.termo_estado()->>'status' = 'conferido', 'conferido');

  raise notice 'Pausa por férias';
  perform sou(40);
  perform public.termo_estado(); perform public.termo_dispensar();
  perform ok((public.termo_estado()->>'bloqueia')::boolean, 'Fábio, depois da dispensa, bloqueado');
  insert into agenda_ausencias(registro, tipo, inicio, fim) values (40, 'ferias', now() - interval '1 day', now() + interval '5 days');
  r := public.termo_estado();
  perform ok((r->>'pausado')::boolean and not (r->>'bloqueia')::boolean, 'de férias, o pedido fica pausado e não bloqueia');

  raise notice 'Permissões';
  perform ok(not has_function_privilege('anon', 'public.termo_estado()', 'execute'), 'anônimo não chama as funções');
  perform ok(not has_table_privilege('authenticated', 'public.termo_pendencias', 'select'), 'ninguém lê as pendências direto');
  perform ok(public.termo_cpf_valido('529.982.247-25') and not public.termo_cpf_valido('529.982.247-24') and not public.termo_cpf_valido('000.000.000-00'),
    'o dígito verificador do CPF é conferido');
  perform ok((select public from storage.buckets where id = 'termos') = false, 'o bucket termos é privado');
end $$;
\echo 'Tudo certo.'
