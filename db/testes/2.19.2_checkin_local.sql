\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.2: o check-in pela folha confere a posição.
-- Rode depois do teste de presença (v29, que vem dentro do 2.18.0_soma):
--   bash testes/preparar-base.sh teste t2192 2.18.0_soma.sql 2.19.0.sql 2.19.2_checkin_local.sql
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

\i 2.19.2_checkin_local.sql
\i 2.19.2_checkin_local.sql

do $$
declare
  r jsonb; v_tok uuid;
  -- o centro do LABBIO e deslocamentos para o sul: 1 grau de latitude são uns 111,2 km
  lat0 constant double precision := -19.870585008331524; lon0 constant double precision := -43.96169940068524;
  m constant double precision := 1 / 111195.0;
begin
  raise notice 'A configuração';
  perform ok((select ativo and raio_m = 150 and precisao_max_m = 200 and latitude = lat0 and longitude = lon0 from checkin_local),
    'nasce com o LABBIO, raio de 150 m e a conferência ligada');
  perform ok((select count(*) from checkin_local) = 1, 'uma linha só, mesmo aplicando duas vezes');
  perform ok(abs(distancia_m(lat0, lon0, lat0 - 100 * m, lon0) - 100) < 1, 'a distância de 100 m ao sul dá uns 100 m');
  perform ok(to_regprocedure('public.registrar_checkin_folha(uuid)') is null, 'a versão só com o token não existe mais');

  raise notice 'O check-in';
  delete from presencas;   -- o teste anterior deixa presenças
  perform eu(4, 'admin');
  v_tok := (checkin_folha_criar('Recepção')->>'token')::uuid;
  perform eu(11, 'leitura');
  perform ok(registrar_checkin_folha(v_tok)->>'status' = 'sem_localizacao', 'só com o token (um cliente antigo): pede a posição');
  perform ok(registrar_checkin_folha(v_tok, lat0, null, 10)->>'status' = 'sem_localizacao', 'sem a longitude, também');
  perform ok(registrar_checkin_folha(v_tok, 'NaN'::float8, lon0, 10)->>'status' = 'sem_localizacao', 'NaN não é posição');
  perform ok(registrar_checkin_folha(v_tok, 91, lon0, 10)->>'status' = 'sem_localizacao', 'latitude fora do mundo');
  perform ok(registrar_checkin_folha(v_tok, lat0, lon0, null)->>'status' = 'localizacao_imprecisa', 'sem a imprecisão informada, não vale');
  perform ok(registrar_checkin_folha(v_tok, lat0, lon0, 250)->>'status' = 'localizacao_imprecisa', 'imprecisão de 250 m passa do limite de 200 m');
  r := registrar_checkin_folha(v_tok, lat0 - 300 * m, lon0, 20);
  perform ok(r->>'status' = 'fora_do_local' and (r->>'distancia_m')::int between 299 and 301 and (r->>'raio_m')::int = 150,
    'a 300 m: fora do local, com a distância e o raio');
  perform ok(registrar_checkin_folha(v_tok, lat0 - 260 * m, lon0, 100)->>'status' = 'fora_do_local', 'a 260 m com 100 m de imprecisão: o desconto não chega (260 - 100 > 150)');
  perform ok(registrar_checkin_folha(v_tok, lat0 - 300 * m, lon0, 200)->>'status' = 'fora_do_local', 'o desconto da imprecisão para em 100 m (300 - 100 > 150)');
  perform ok(not exists (select 1 from presencas where registro = 11), 'nenhuma recusa registra presença');
  perform ok((select usos from checkin_folhas where token = v_tok) = 0, 'nem conta uso da folha');

  r := registrar_checkin_folha(v_tok, lat0 - 240 * m, lon0, 100);
  perform ok(r->>'status' = 'ok' and r->>'nome' = 'Bruno Tavares', 'a 240 m com 100 m de imprecisão: o desconto deixa passar (240 - 100 <= 150)');
  perform ok((select origem from presencas where registro = 11) = 'folha', 'e a presença vem da folha');
  perform ok(registrar_checkin_folha(v_tok, lat0, lon0, 5)->>'status' = 'repetido', 'duas vezes seguidas continua sendo repetido');
  delete from presencas;
  perform ok(registrar_checkin_folha(v_tok, lat0 + 50 * m, lon0 + 50 * m / cos(radians(lat0)), 8)->>'status' = 'ok', 'a uns 70 m, no pátio: dentro');
  delete from presencas;
  perform eu(null, 'leitura');
  perform ok(registrar_checkin_folha(v_tok, lat0, lon0, 5)->>'status' = 'sessao', 'sem sessão, nada muda');
  perform eu(17, 'leitura');
  perform ok(registrar_checkin_folha(gen_random_uuid(), lat0, lon0, 5)->>'status' = 'folha_invalida', 'folha que não existe: inválida, mesmo com a posição certa');

  raise notice 'A gestão ajusta';
  perform eu(11, 'leitura');
  perform ok(checkin_local_ler()->>'status' = 'sem_permissao' and checkin_local_salvar(true, lat0, lon0, 300)->>'status' = 'sem_permissao',
    'quem não é admin não lê nem muda');
  perform eu(4, 'admin');
  r := checkin_local_ler();
  perform ok(r->>'status' = 'ok' and (r->>'raio_m')::int = 150 and (r->>'ativo')::boolean and r->>'atualizado_por' = 'Migração 2.19.2', 'o admin lê');
  perform ok(checkin_local_salvar(true, lat0, lon0, 10)->>'status' = 'invalido' and checkin_local_salvar(true, 200, lon0, 150)->>'status' = 'invalido'
    and checkin_local_salvar(true, lat0, lon0, 150, 5)->>'status' = 'invalido', 'raio, coordenadas e imprecisão têm limites');
  r := checkin_local_salvar(true, lat0, lon0, 400);
  perform ok(r->>'status' = 'ok' and (select raio_m = 400 and atualizado_por = 'Ana Figueiredo' from checkin_local), 'o admin muda o raio, e fica quem mudou');
  perform eu(17, 'leitura');
  perform ok(registrar_checkin_folha(v_tok, lat0 - 300 * m, lon0, 20)->>'status' = 'ok', 'com o raio de 400 m, os 300 m passam');
  delete from presencas;
  perform eu(4, 'admin');
  perform ok(checkin_local_salvar(false, lat0, lon0, 150)->>'status' = 'ok', 'o admin desliga a conferência');
  perform eu(17, 'leitura');
  perform ok(registrar_checkin_folha(v_tok)->>'status' = 'ok', 'desligada, vale como antes (só o código da folha)');
  delete from presencas;
end $$;
\echo 'Tudo certo.'
