\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.2_solicitacoes: ninguém decide o próprio pedido (salvo o
-- admin), o pedido de biometria aprovado pelo Pessoal chega ao LABBIO e a
-- triagem comum não concede a biometria. Rode por último na cadeia da 2.19.1.
-- ============================================================
\i 2.19.2_solicitacoes.sql
\i 2.19.2_solicitacoes.sql

-- um pedido de biometria já enviado ao Pessoal, como labbio_pedido_enviar deixa
create or replace function pedido_no_pessoal(p_reg integer) returns uuid language plpgsql as $$
declare v_sol uuid; v_ped uuid;
begin
  update labbio_pedidos set etapa = 'cancelado' where registro = p_reg and etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido');
  insert into portal_solicitacoes (registro, tipo, titulo, dados)
  values (p_reg, 'acesso', 'Acesso biométrico ao LABBIO', jsonb_build_object('item_id', labbio_item_biometria()))
  returning id into v_sol;
  insert into labbio_pedidos (registro, solicitacao_id, etapa, justificativa, tempo)
  values (p_reg, v_sol, 'pessoal', 'Projeto da órtese na bancada', 'Um mês') returning id into v_ped;
  return v_ped;
end $$;

do $$
declare v_ped uuid; v_sol uuid; v_ver integer; r jsonb; v_outro uuid;
begin
  raise notice 'Quem decide o próprio pedido';
  update perfis set papel = 'pessoal' where registro = 11;   -- o Bruno também passa a ser do Pessoal (o papel vem do perfil)
  v_ped := pedido_no_pessoal(17); select solicitacao_id, versao into v_sol, v_ver from labbio_pedidos where id = v_ped;
  perform eu(17, 'pessoal');   -- a Carla é do Pessoal e fez o pedido
  perform ok(papel_atual() = 'pessoal', 'a Carla está com o papel do Pessoal');
  perform ok(labbio_pedido_pessoal(v_ped, v_ver, 'encaminhar')->>'status' = 'proprio_pedido', 'quem é do Pessoal não encaminha o próprio pedido de biometria');
  perform ok(pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', v_sol, 'decisao', 'aprovada'))->>'status' = 'proprio_pedido',
    'nem aprova pela triagem comum');
  perform ok((select etapa from labbio_pedidos where id = v_ped) = 'pessoal', 'e o pedido continua no Pessoal');

  raise notice 'Outra pessoa do Pessoal aprova, e o pedido chega ao LABBIO';
  perform eu(11, 'pessoal');
  r := pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', v_sol, 'decisao', 'aprovada'));
  perform ok(r->>'status' = 'ok' and r->>'decisao' = 'encaminhada', 'aprovar pela triagem encaminha (não concede)');
  perform ok((select etapa = 'labbio' and encaminhado_em is not null from labbio_pedidos where id = v_ped), 'o pedido passa para o LABBIO');
  perform ok((select status from portal_solicitacoes where id = v_sol) = 'em_analise', 'e a solicitação fica em análise, não "aprovada"');
  perform ok(not exists (select 1 from acessos_concedidos where registro = 17 and item_id = labbio_item_biometria() and ativo),
    'nenhum acesso é concedido pelo Pessoal');
  perform eu(4, 'admin');   -- o admin entra no painel do LABBIO (2.19.1_labbio_admin)
  perform ok(exists (select 1 from jsonb_array_elements(labbio_solicitacoes('abertos')->'pedidos') x where (x->>'id')::uuid = v_ped),
    'aparece em Solicitações, no painel do LABBIO');

  raise notice 'O admin pode decidir o próprio pedido';
  v_ped := pedido_no_pessoal(4); select solicitacao_id, versao into v_sol, v_ver from labbio_pedidos where id = v_ped;
  perform ok(labbio_pedido_pessoal(v_ped, v_ver, 'encaminhar')->>'status' = 'ok', 'o admin encaminha o próprio pedido');

  raise notice 'A triagem comum não concede a biometria';
  insert into portal_solicitacoes (registro, tipo, titulo, dados) values (46, 'acesso', 'LABBIO', '{}') returning id into v_outro;
  perform eu(11, 'pessoal');
  perform ok(pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', v_outro, 'decisao', 'aprovada',
      'conceder', jsonb_build_array(labbio_item_biometria())))->>'status' = 'biometria_pelo_labbio',
    'marcar a biometria numa solicitação comum é recusado');
  perform ok((select status from portal_solicitacoes where id = v_outro) = 'aberta' and not exists
    (select 1 from acessos_concedidos where registro = 46 and item_id = labbio_item_biometria() and ativo and concedido_em = current_date),
    'e nada muda');
  perform ok(pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id', v_outro, 'decisao', 'recusada',
      'resposta', 'Use o pedido próprio, com foto.'))->>'status' = 'ok', 'recusar com a orientação continua possível');
  update perfis set papel = 'leitura' where registro = 11;
end $$;
\echo 'Tudo certo.'
