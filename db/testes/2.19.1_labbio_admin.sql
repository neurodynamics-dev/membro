\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1_labbio_admin: o admin do SOMA entra no painel do LABBIO
-- com a própria conta, sem virar conta externa. Rode por último na cadeia
-- da 2.19.1 (ver db/LEIAME.md).
-- ============================================================
\i 2.19.1_labbio_admin.sql
\i 2.19.1_labbio_admin.sql

do $$
declare r jsonb;
begin
  raise notice 'O admin do SOMA no painel do LABBIO';
  perform eu(4, 'admin');
  r := public.labbio_eu();
  perform ok(r->>'status' = 'admin' and (r->'gestor'->>'admin')::boolean and r->'gestor'->>'id' is null,
    'labbio_eu: status admin, sem id de gestor (o portal não desvia para /labbio/)');
  perform ok(r->'gestor'->>'nome' like '% (admin do SOMA)', 'o nome que aparece no painel e nos registros: ' || (r->'gestor'->>'nome'));
  perform ok(public.conta_labbio(), 'conta_labbio() vale para o admin');
  perform ok(not public.conta_externa() and public.conta_ativa(), 'e ele continua conta de membro: o SOMA segue aberto');
  perform ok(porta('/rest/v1/rpc/papeis_atuais') = 'passa', 'a porta da API não barra o admin fora de labbio_*');
  perform ok(public.labbio_membros(null)->>'status' = 'ok', 'as consultas do painel respondem ao admin');
  perform ok(public.labbio_gestores_lista()->>'status' = 'ok', 'e a lista de gestores');

  raise notice 'Quem não é admin continua de fora';
  perform eu(11, 'leitura');
  perform ok(public.labbio_eu()->>'status' = 'nao_gestor', 'membro comum: nao_gestor');
  perform ok(not public.conta_labbio(), 'conta_labbio() falsa');
  perform ok(public.labbio_membros(null)->>'status' = 'sem_permissao', 'as consultas do painel recusam');
end $$;
