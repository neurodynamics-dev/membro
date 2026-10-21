\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_termo_existente: o membro envia o termo que já tinha; o admin envia por ele.
-- Depois do teste da 2.19.1_recadastro (campanha labbio-2026, o 11 com os dados conferidos).
\i 2.19.2_termo_existente.sql
\i 2.19.2_termo_existente.sql

do $$
declare r jsonb; c text;
begin
  raise notice 'O termo que o membro já tinha';
  perform eu(41, 'leitura');
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/41/00000000-0000-0000-0000-000000000041.pdf');
  perform ok(public.termo_registrar_envio('labbio-2026/41/00000000-0000-0000-0000-000000000041.pdf', repeat('b', 64), 900, true)->>'status' = 'dados_pendentes',
    'sem os dados conferidos, nem o termo que já tinha entra');
  perform eu(11, 'leitura');
  insert into storage.objects(bucket_id, name) values ('termos', 'labbio-2026/11/00000000-0000-0000-0000-000000000011.pdf');
  r := public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000011.pdf', repeat('c', 64), 1200, true);
  perform ok(r->>'status' = 'ok', 'com os dados conferidos, o termo que já tinha é enviado, sem baixar um novo');
  perform ok((select existente from termo_pendencias where campanha = 'labbio-2026' and registro = 11)
         and (select existente from termo_envios where registro = 11 order by id desc limit 1), 'e fica marcado como o que já existia');
  perform ok(public.termo_registrar_envio('labbio-2026/11/00000000-0000-0000-0000-000000000011.pdf', repeat('c', 64), 1200)->>'status' in ('ok', 'nao_emitido'),
    'sem o marcador, a regra de antes continua (o termo baixado com os dados atuais)');

  raise notice 'O admin envia por um membro';
  perform eu(11, 'leitura');
  perform ok(public.termo_admin_caminho(41)->>'status' = 'sem_permissao', 'membro comum não pega caminho de outro');
  perform ok(not public.termo_arquivo_pode('labbio-2026/41/00000000-0000-0000-0000-000000000099.pdf', true), 'nem grava na pasta de outro');
  perform ok(public.termo_registrar_envio_admin(41, 'labbio-2026/41/00000000-0000-0000-0000-000000000041.pdf', repeat('b', 64), 900)->>'status' = 'sem_permissao',
    'nem registra por outro');
  perform eu(4, 'admin');
  r := public.termo_admin_caminho(41); c := r->>'caminho';
  perform ok(r->>'status' = 'ok' and c ~ '^labbio-2026/41/[0-9a-f-]{36}\.pdf$', 'o admin recebe o caminho na pasta da pessoa');
  perform ok(public.termo_arquivo_pode(c, true), 'e pode gravar lá');
  perform ok(not public.termo_arquivo_pode('outra-campanha/41/00000000-0000-0000-0000-000000000099.pdf', true), 'só na campanha atual');
  perform ok(public.termo_registrar_envio_admin(41, c, repeat('d', 64), 800)->>'status' = 'arquivo_ausente', 'sem o arquivo no bucket, não registra');
  insert into storage.objects(bucket_id, name) values ('termos', c);
  r := public.termo_registrar_envio_admin(41, c, repeat('d', 64), 800);
  perform ok(r->>'status' = 'ok', 'com o arquivo, o admin registra o envio');
  perform ok((select enviado_por from termo_pendencias where campanha = 'labbio-2026' and registro = 41) is not null
         and (select existente from termo_pendencias where campanha = 'labbio-2026' and registro = 41), 'marca quem enviou e que é um termo que já existia');
  perform ok(exists (select 1 from notificacoes where registro = 41 and tipo = 'termo' and titulo like 'Termo de sigilo enviado%'), 'a pessoa é avisada');
  perform ok(public.termo_situacao(41, 'labbio-2026') = 'enviado', 'e o termo fica enviado, para o Pessoal conferir');
  perform ok(public.termo_registrar_envio_admin(99999, c, repeat('d', 64), 800)->>'status' = 'nao_encontrado', 'registro que não existe');
  r := public.termo_painel();
  perform ok(exists (select 1 from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::int = 41 and (x->>'existente')::boolean and x->>'enviado_por' is not null),
    'o painel do Pessoal mostra a marca e quem enviou');
end $$;
\echo 'Tudo certo.'
