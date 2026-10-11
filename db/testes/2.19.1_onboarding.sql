\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: a trilha de onboarding.
--   bash testes/preparar-base.sh teste t2191o 2.18.0_soma.sql 2.19.0.sql 2.19.1_recadastro.sql \
--        2.19.1_trainees.sql 2.19.1_onboarding.sql
-- (do recadastro vêm os dados conferidos do Bruno, 11; a campanha do termo
-- está ativa e ele não enviou)
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.1_onboarding.sql
\i 2.19.1_onboarding.sql
-- na cadeia completa, um teste anterior desliga o Bruno
update membros set status = 'Ativo' where registro = 11;

do $$
declare r jsonb; et jsonb;
begin
  perform eu(11, 'leitura');
  r := public.onboarding_meu();
  perform ok(r->>'status' = 'ok' and (r->>'total')::integer = 7 and (r->>'versao')::integer = 1, 'a trilha 1, com sete etapas');
  select x into et from jsonb_array_elements(r->'etapas') x where x->>'id' = 'dados';
  perform ok((et->>'feita')::boolean, 'dados conferidos: feita pelo fato, sem marcar nada');
  select x into et from jsonb_array_elements(r->'etapas') x where x->>'id' = 'termo';
  perform ok((et->>'feita')::boolean = (public.termo_campanha_atual() is null
             or public.termo_situacao(11, public.termo_campanha_atual()) in ('enviado', 'conferido')), 'termo: feita só se enviado ou conferido');
  perform ok(public.onboarding_marcar('termo')->>'status' = 'invalido', 'etapa de fato não se marca à mão');
  r := public.onboarding_marcar('contexto');
  perform ok((select (x->>'feita')::boolean from jsonb_array_elements(r->'etapas') x where x->>'id' = 'contexto'), 'marcar uma leitura');
  perform ok(public.onboarding_marcar('contexto')->>'status' = 'ok', 'marcar de novo não duplica');
  perform ok((select count(*) from onboarding_progresso where registro = 11) = 1, 'uma linha só, no servidor (vale em qualquer aparelho)');
  r := public.onboarding_marcar('contexto', false);
  perform ok(not (select (x->>'feita')::boolean from jsonb_array_elements(r->'etapas') x where x->>'id' = 'contexto'), 'desmarcar');
  perform public.onboarding_marcar('contexto');

  -- treinamento obrigatório pendente
  insert into treinamentos (numero, titulo, status, revisao_atual, revisao_minima) values (902, 'Segurança elétrica', 'publicado', 'A', 'A') on conflict do nothing;
  insert into treinamento_atribuicoes (treinamento_id, grupo_id, obrigatorio) select id, null, true from treinamentos where numero = 902 on conflict do nothing;
  perform ok(not (select (x->>'feita')::boolean from jsonb_array_elements(public.onboarding_meu()->'etapas') x where x->>'id' = 'treinamentos'),
    'treinamento obrigatório pendente: etapa pendente');

  perform ok(public.onboarding_painel()->>'status' = 'sem_permissao', 'membro comum não vê o painel');
  perform eu(17, 'pessoal');
  r := public.onboarding_painel();
  perform ok(r->>'status' = 'ok' and (select (x->>'feitas')::integer from jsonb_array_elements(r->'pessoas') x where (x->>'registro')::integer = 11)
             = (public.onboarding_de(11)->>'feitas')::integer, 'o Pessoal acompanha o Bruno, com as mesmas etapas');
  perform ok(public.onboarding_trilha_salvar('[{"id":"x","titulo":"","tipo":"leitura"}]')->>'status' = 'sem_permissao', 'só o admin muda a trilha');
  perform eu(4, 'admin');
  perform ok(public.onboarding_trilha_salvar('[{"id":"x","titulo":"Algo","tipo":"fato","fato":"inventado"}]')->>'status' = 'invalido', 'fato desconhecido');
  perform ok((public.onboarding_trilha_salvar('[{"id":"contexto","titulo":"Contexto","tipo":"leitura"},{"id":"dados","titulo":"Dados","tipo":"fato","fato":"dados"}]')->>'versao')::integer = 2,
    'versão nova da trilha');
  perform eu(11, 'leitura');
  r := public.onboarding_meu();
  perform ok((r->>'versao')::integer = 2 and (r->>'total')::integer = 2 and (r->>'feitas')::integer = 1,
    'na versão nova, a leitura recomeça e o fato continua valendo');
end $$;
\echo 'Tudo certo.'
