\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: as consultas do painel do LABBIO e a revogação pendente.
-- Rode depois do teste do pedido de biometria (a gestora ativa, o acesso
-- do Bruno concedido):
--   bash testes/preparar-base.sh teste t2191d 2.18.0_soma.sql 2.19.0.sql 2.19.1_labbio.sql \
--        2.19.1_recadastro.sql 2.19.1_labbio_acesso.sql 2.19.1_trainees.sql 2.19.1_labbio_dados.sql
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_labbio_dados.sql
\i 2.19.1_labbio_dados.sql

-- um treinamento publicado, com a conclusão do Bruno; e presenças
insert into treinamentos (numero, titulo, status, revisao_atual, revisao_minima, validade_meses)
values (901, 'Segurança na bancada', 'publicado', 'A', 'A', 12) on conflict do nothing;
insert into treinamento_conclusoes (certificado, registro, treinamento_id, nome, codigo, titulo, revisao)
select 'CERT-TEST-0001', 11, id, 'Bruno Tavares', codigo, titulo, 'A' from treinamentos where numero = 901
on conflict do nothing;

do $$
declare r jsonb; v_notif integer; n0 integer; n11 integer; nf integer; gest uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; b jsonb;
begin
  raise notice 'Só gestor ativo';
  perform eu(11, 'leitura');
  perform ok(public.labbio_membros()->>'status' = 'sem_permissao' and public.labbio_inicio()->>'status' = 'sem_permissao'
             and public.labbio_checkins(current_date, current_date)->>'status' = 'sem_permissao', 'membro não consulta o painel');
  perform eu(4, 'admin');
  perform ok(public.labbio_treinamentos()->>'status' = 'ok', 'o admin do SOMA consulta o painel com a conta de membro (2.19.1_labbio_admin)');
  perform set_config('teste.uid', gest::text, false);

  raise notice 'Membros';
  r := public.labbio_membros();
  select x into b from jsonb_array_elements(r->'membros') x where (x->>'registro')::integer = 11;
  perform ok(b->'acesso'->>'estado' = 'possui' and b->'termo' ? 'situacao', 'cada membro com o termo e o acesso');
  perform ok(not (b ? 'cpf') and not (b ? 'matricula') and not (b ? 'bolsa') and not (b ? 'autodeclaracao_racial'),
    'só os campos combinados (sem CPF, bolsa, autodeclaração)');
  perform ok(jsonb_array_length(public.labbio_membros('Bruno')->'membros') = 1, 'busca por nome');
  perform ok(jsonb_array_length(public.labbio_membro(11)->'pedidos') = 1, 'o perfil traz o pedido de biometria');
  perform ok(public.labbio_membro(44)->>'status' = 'nao_encontrado', 'desligado sem pendência não aparece');

  raise notice 'Check-ins e treinamentos';
  n0 := (public.labbio_checkins(current_date - 2, current_date)->>'total')::integer;
  n11 := (public.labbio_checkins(current_date - 2, current_date, 11)->>'total')::integer;
  nf := (public.labbio_checkins(current_date - 2, current_date, 11, 'folha')->>'total')::integer;
  insert into presencas (registro, registrado_em, origem) values (11, now(), null), (11, now() - interval '1 day', 'folha'), (17, now(), null);
  perform ok((public.labbio_checkins(current_date - 2, current_date)->>'total')::integer = n0 + 3, 'as presenças do período');
  perform ok((public.labbio_checkins(current_date - 2, current_date, 11)->>'total')::integer = n11 + 2, 'filtro pela pessoa');
  perform ok((public.labbio_checkins(current_date - 2, current_date, 11, 'folha')->>'total')::integer = nf + 1, 'filtro pela origem');
  perform ok(public.labbio_checkins(current_date, current_date - 1)->>'status' = 'invalido', 'período invertido');
  r := public.labbio_treinamentos();
  perform ok(jsonb_array_length(r->'treinamentos') >= 1, 'os treinamentos publicados');
  select x into b from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::integer = 11;
  perform ok(b->'celulas'->((select id from treinamentos where numero = 901)::text)->>'situacao' = 'concluido'
             and b->'celulas'->((select id from treinamentos where numero = 901)::text)->>'vence_em' is not null,
    'a célula: situação, conclusão e validade');
  perform ok(r::text !~ 'gabarito|"conteudo"|respostas', 'sem conteúdo, respostas ou gabarito');

  raise notice 'Revogação pendente, sem notificação';
  select count(*) into v_notif from notificacoes;
  update membros set status = 'Desligado' where registro = 11;
  perform ok((select count(*) from labbio_revogacoes where registro = 11 and confirmada_em is null) = 1, 'o desligamento com biometria vira pendência');
  perform ok((select count(*) from notificacoes) = v_notif, 'sem sino nem e-mail');
  update membros set status = 'Egresso' where registro = 11;
  perform ok((select count(*) from labbio_revogacoes where registro = 11) = 1, 'mudar de novo não duplica');
  r := public.labbio_inicio();
  perform ok(jsonb_array_length(r->'revogacoes') = 1 and r->'revogacoes'->0->>'nome' = 'Bruno Tavares', 'a faixa do início');
  perform ok((select x->'acesso'->>'sub' from jsonb_array_elements(public.labbio_membros()->'membros') x where (x->>'registro')::integer = 11)
             = 'revogacao_pendente', 'o desligado continua no quadro, com a revogação pendente');
  perform ok(exists (select 1 from acessos_concedidos where registro = 11 and item_id = public.labbio_item_biometria() and ativo),
    'o acesso não é dado como revogado sozinho');
  perform ok(public.labbio_revogacao_confirmar((select id from labbio_revogacoes where registro = 11))->>'status' = 'ok', 'o gestor confirma');
  perform ok(not exists (select 1 from acessos_concedidos where registro = 11 and item_id = public.labbio_item_biometria() and ativo)
             and jsonb_array_length(public.labbio_inicio()->'revogacoes') = 0, 'só aí o acesso sai da ficha');
  perform ok(public.labbio_membro(11)->>'status' = 'nao_encontrado', 'e a pessoa sai do quadro');

  raise notice 'Pedido aberto de quem sai é cancelado';
  perform eu(23, 'leitura');
  r := public.labbio_pedido_criar('Ensaios de comunicação no LABBIO', 'Um mês');
  update membros set status = 'Desligado' where registro = 23;
  perform ok((select etapa from labbio_pedidos where id = (r->'pedido'->>'id')::uuid) = 'cancelado', 'cancelado com o vínculo');
  perform ok(not exists (select 1 from labbio_revogacoes where registro = 23), 'sem acesso, sem pendência');
end $$;
\echo 'Tudo certo.'
