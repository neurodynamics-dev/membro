\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: pedido de acesso biométrico ao LABBIO.
-- Rode depois dos testes do LABBIO (identidade) e do recadastro:
--   bash testes/preparar-base.sh teste t2191a 2.18.0_soma.sql 2.19.0.sql \
--        2.19.1_labbio.sql 2.19.1_recadastro.sql 2.19.1_labbio_acesso.sql
-- (do teste do LABBIO vem a gestora ativa e principal; do recadastro, os
-- dados conferidos do Bruno, registro 11).
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_labbio_acesso.sql
\i 2.19.1_labbio_acesso.sql

\set gestora '\'aaaaaaaa-0000-0000-0000-000000000001\''

-- 1. o membro abre o pedido
select eu(11, 'leitura');
do $$ declare r jsonb; begin
  r := public.labbio_pedido_meu();
  perform ok(r->>'status' = 'ok' and r->'pedido' = 'null'::jsonb and not (r->>'tem_acesso')::boolean, 'sem pedido nem acesso');
  perform ok(r->'dados'->>'cpf' is not null and r->'dados'->>'nome' = 'Bruno Tavares', 'os dados vêm de Meus dados (a última confirmação)');
  perform ok(public.labbio_pedido_criar('curto', 'semestre')->>'status' = 'invalido', 'justificativa curta');
end $$;
select (public.labbio_pedido_criar('Projeto da órtese, bancada do LABBIO', 'Até o fim do semestre')->'pedido'->>'id') as pedido \gset
do $$ begin
  perform ok(public.labbio_pedido_criar('Projeto da órtese, bancada', 'semestre')->>'status' = 'ja_existe', 'um pedido aberto por vez');
end $$;
select ok(public.labbio_pedido_enviar(:'pedido', 1, null)->>'status' = 'foto_pendente', 'sem foto não envia');

-- a foto: só na pasta do membro, na versão em edição
select set_config('teste.pedido', :'pedido', false);
set role authenticated;
insert into storage.objects (bucket_id, name) values ('biometria', '11/' || :'pedido' || '/1.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('biometria', '11/' || current_setting('teste.pedido') || '/2.jpg');
    raise exception 'FALHOU: gravou a foto de outra versão';
  exception when insufficient_privilege then perform ok(true, 'a foto vai só na versão que está sendo editada');
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('biometria', '17/' || current_setting('teste.pedido') || '/1.jpg');
    raise exception 'FALHOU: gravou na pasta de outra pessoa';
  exception when insufficient_privilege then perform ok(true, 'nem na pasta de outra pessoa');
  end;
end $$;
reset role;

select ok(public.labbio_pedido_enviar(:'pedido', 1, '11/' || :'pedido' || '/1.jpg')->'pedido'->>'etapa' = 'pessoal', 'enviado: vai para o Pessoal');
do $$ declare s portal_solicitacoes; begin
  select * into s from portal_solicitacoes where (dados->>'labbio_pedido_id')::uuid = current_setting('teste.pedido')::uuid;
  perform ok(s.tipo = 'acesso' and s.status = 'aberta', 'abre a solicitação de acesso de sempre');
  perform ok(exists (select 1 from atividades where origem_tipo = 'solicitacao' and origem_id = s.id::text), 'com o card no quadro do Pessoal');
  perform ok((select dados ? 'cpf' and dados ? 'matricula' and foto_path like '11/%/1.jpg' from labbio_pedido_versoes
               where pedido_id = current_setting('teste.pedido')::uuid and versao = 1), 'a versão 1 guarda os campos do LABBIO e a foto');
end $$;

-- 2. antes do Pessoal, o LABBIO não vê nada
select set_config('teste.uid', :gestora, false);
do $$ begin
  perform ok(jsonb_array_length(public.labbio_solicitacoes('todos')->'pedidos') = 0, 'o LABBIO só vê o que o Pessoal encaminhou');
  perform ok(public.labbio_pedido_ler(current_setting('teste.pedido')::uuid)->>'status' = 'sem_permissao', 'nem lê o pedido');
  perform ok(not public.biometria_pode('11/' || current_setting('teste.pedido') || '/1.jpg'), 'nem a foto');
  perform ok(public.labbio_pedido_pessoal(current_setting('teste.pedido')::uuid, 1, 'encaminhar')->>'status' = 'sem_permissao',
    'o gestor não decide pelo Pessoal');
end $$;

-- 3. o Pessoal aprova pela triagem de sempre: encaminha, não concede
select eu(17, 'pessoal');
do $$ declare r jsonb; s uuid; n_env integer := (select count(*) from labbio_envios where tipo = 'pedido'); begin
  select id into s from portal_solicitacoes where (dados->>'labbio_pedido_id')::uuid = current_setting('teste.pedido')::uuid;
  r := public.pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', s, 'decisao', 'aprovada',
         'conceder', jsonb_build_array(public.labbio_item_biometria())));
  perform ok(r->>'status' = 'ok' and (r->>'labbio')::boolean and (r->>'concedidos')::integer = 0, 'aprovar encaminha ao LABBIO');
  perform ok(not exists (select 1 from acessos_concedidos where registro = 11 and item_id = public.labbio_item_biometria()),
    'e não concede o acesso');
  perform ok((select etapa from labbio_pedidos where id = current_setting('teste.pedido')::uuid) = 'labbio'
             and (select status from portal_solicitacoes where id = s) = 'em_analise', 'o pedido vai ao LABBIO; a solicitação fica em análise');
  perform ok((select count(*) from labbio_envios where tipo = 'pedido') = n_env + 1
             and (select para_email from labbio_envios where tipo = 'pedido' order by id desc limit 1) = 'gestora@labbio.test',
    'um e-mail para o responsável principal');
  perform ok((select status from atividades where origem_tipo = 'solicitacao' and origem_id = s::text) = 'concluida', 'o card do Pessoal fecha');
end $$;

-- 4. o LABBIO devolve (foto escura); o membro corrige; volta direto ao LABBIO
select set_config('teste.uid', :gestora, false);
do $$ declare r jsonb; p uuid := current_setting('teste.pedido')::uuid; begin
  r := public.labbio_solicitacoes('abertos');
  perform ok(jsonb_array_length(r->'pedidos') = 1 and r->'pedidos'->0->'enviada'->'dados'->>'cpf' is not null, 'o LABBIO vê o pedido, com os dados');
  perform ok(public.biometria_pode('11/' || p || '/1.jpg'), 'e a foto');
  perform ok(public.labbio_pedido_decidir(p, 0, 'implantado')->>'status' = 'conflito', 'decisão de versão velha não vale');
  perform ok(public.labbio_pedido_decidir(p, 1, 'negar')->>'status' = 'motivo_obrigatorio', 'negar pede motivo');
  r := public.labbio_pedido_decidir(p, 1, 'devolver', 'A foto está escura');
  perform ok(r->'pedido'->>'etapa' = 'devolvido' and (r->'pedido'->>'versao')::integer = 2, 'devolvido; a correção é a versão 2');
end $$;
select eu(11, 'leitura');
select ok(public.labbio_pedido_enviar(:'pedido', 1, '11/' || :'pedido' || '/1.jpg')->>'status' = 'conflito', 'a versão 1 não serve mais');
set role authenticated;
insert into storage.objects (bucket_id, name) values ('biometria', '11/' || :'pedido' || '/2.jpg');
reset role;
do $$ declare n_env integer := (select count(*) from labbio_envios where tipo = 'pedido'); r jsonb; begin
  r := public.labbio_pedido_enviar(current_setting('teste.pedido')::uuid, 2, '11/' || current_setting('teste.pedido') || '/2.jpg');
  perform ok(r->'pedido'->>'etapa' = 'labbio', 'corrigido: volta para quem devolveu (o LABBIO), sem passar de novo pelo Pessoal');
  perform ok((select count(*) from labbio_envios where tipo = 'pedido') = n_env + 1, 'e o principal recebe outro aviso');
end $$;

-- 5. o LABBIO confirma a implantação: só aí o acesso existe
select set_config('teste.uid', :gestora, false);
do $$ declare r jsonb; p uuid := current_setting('teste.pedido')::uuid; begin
  r := public.labbio_pedido_decidir(p, 2, 'implantado');
  perform ok(r->'pedido'->>'etapa' = 'concedido', 'implantação confirmada');
  perform ok(exists (select 1 from acessos_concedidos where registro = 11 and item_id = public.labbio_item_biometria() and ativo
                     and responsavel like 'LABBIO:%'), 'o acesso aparece na ficha, por quem confirmou');
  perform ok((select status from portal_solicitacoes where id = (select solicitacao_id from labbio_pedidos where id = p)) = 'aprovada',
    'a solicitação fecha como aprovada');
  perform ok(jsonb_array_length(r->'pedido'->'eventos') = 5, 'a trilha: enviado, encaminhado, devolvido, reenviado, concedido');
  perform ok(public.labbio_pedido_decidir(p, 2, 'negar', 'x')->>'status' = 'encerrado', 'decidido não muda');
end $$;
select eu(11, 'leitura');
do $$ begin
  perform ok((public.labbio_pedido_meu()->>'tem_acesso')::boolean, 'o membro vê que tem o acesso');
  perform ok(public.labbio_pedido_criar('Outro pedido qualquer aqui', 'x')->>'status' = 'ja_tem_acesso', 'e não pede de novo');
  perform ok(public.labbio_pedido_decidir(current_setting('teste.pedido')::uuid, 2, 'implantado')->>'status' = 'sem_permissao',
    'membro não decide pelo LABBIO');
end $$;

-- 6. outro membro: sem dados conferidos não envia; o Pessoal nega
select eu(47, 'leitura');
select (public.labbio_pedido_criar('Ensaios no LABBIO às terças', 'Três meses')->'pedido'->>'id') as p47 \gset
set role authenticated;
insert into storage.objects (bucket_id, name) values ('biometria', '47/' || :'p47' || '/1.png');
reset role;
select ok(public.labbio_pedido_enviar(:'p47', 1, '47/' || :'p47' || '/1.png')->>'status' = 'dados_pendentes', 'sem Meus dados conferidos, não envia');
insert into cadastro_confirmacoes (registro, dados)
  values (47, '{"nome_civil":"Mateus Cruz","cpf":"52998224725","matricula":"2020000001"}');
select ok(public.labbio_pedido_enviar(:'p47', 1, '47/' || :'p47' || '/1.png')->>'status' = 'ok', 'com os dados, envia');
select eu(17, 'pessoal');
select ok(public.labbio_pedido_pessoal(:'p47', 1, 'negar')->>'status' = 'motivo_obrigatorio', 'o Pessoal nega com motivo');
select ok(public.labbio_pedido_pessoal(:'p47', 1, 'negar', 'Sem atividade no LABBIO este semestre')->'pedido'->>'etapa' = 'negado_pessoal', 'negado pelo Pessoal');
select ok((select status from portal_solicitacoes where (dados->>'labbio_pedido_id')::uuid = :'p47') = 'recusada', 'a solicitação fica recusada');
select set_config('teste.uid', :gestora, false);
select ok(jsonb_array_length(public.labbio_solicitacoes('todos')->'pedidos') = 1, 'o negado pelo Pessoal nunca chega ao LABBIO');

-- 7. cancelar
select eu(47, 'leitura');
select (public.labbio_pedido_criar('Ensaios no LABBIO às quintas', 'Um mês')->'pedido'->>'id') as p47b \gset
select ok(public.labbio_pedido_cancelar(:'p47b')->>'status' = 'ok', 'o membro cancela');
select ok((select etapa from labbio_pedidos where id = :'p47b') = 'cancelado', 'e o pedido fica cancelado');

-- 8. os outros pedidos de acesso não mudam
insert into portal_solicitacoes (registro, tipo, titulo, dados)
values (47, 'acesso', 'Laboratório 2', jsonb_build_object('item_id', (select id from itens_de_acesso where nome = 'Laboratório 2')))
returning id as comum \gset
select eu(17, 'pessoal');
select ok(public.pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', :'comum', 'decisao', 'aprovada',
          'conceder', jsonb_build_array((select id from itens_de_acesso where nome = 'Laboratório 2'))))->>'concedidos' = '1',
          'pedido de acesso comum: aprovar concede na hora, como antes');
select ok(exists (select 1 from acessos_concedidos where registro = 47 and item_id = (select id from itens_de_acesso where nome = 'Laboratório 2') and ativo),
          'o acesso comum está na ficha');

-- 9. pela API
set role authenticated;
do $$ begin
  begin
    perform count(*) from public.labbio_pedidos;
    raise exception 'FALHOU: labbio_pedidos legível pela API';
  exception when insufficient_privilege then perform ok(true, 'as tabelas do pedido não são legíveis pela API');
  end;
  begin
    perform public.labbio_pedido_json(null::labbio_pedidos);
    raise exception 'FALHOU: peça interna chamável';
  exception when insufficient_privilege then perform ok(true, 'as peças internas não são chamáveis');
  end;
end $$;
reset role;
\echo 'Tudo certo.'
