\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.24.0: o banco de fotos (a curadoria no Studio e a
-- galeria na Marca).
-- Rode num banco feito do tbase do LEIAME com a 2.18.0 aplicada pelo
-- teste dela:
--   bash testes/preparar-base.sh teste t224 2.18.0_soma.sql 2.24.0_fotos.sql
-- Aplica a 2.24.0, confere a semente, a fila, os votos (aprovada é o
-- voto que diz, com uma e duas aprovações), o desfazer, a decisão à
-- mão da gestão, pôr na fila, editar, a imagem, quem lê o quê (RLS) e,
-- no fim, a 2.24.0 de novo.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), false);
  perform set_config('teste.papel', p_papel, false);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false);
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;

\ir ../2.24.0_fotos.sql

create or replace function foto(p_banco_id text) returns uuid language sql as $$
  select id from fotos where banco_id = p_banco_id $$;
create or replace function st(p_banco_id text) returns text language sql as $$
  select status from fotos where banco_id = p_banco_id $$;

-- ------------------------------------------------------------
-- A equipe do teste, além das anteriores:
--   4  Ana   admin: gere o Studio
--   70 Rui   Comunicação: entra no Studio
--   71 Sara  Comunicação: entra no Studio
--   72 Teo   Sinais: fora do Studio
--   73 Úrsula Comunicação, Desligada: conta bloqueada
-- ------------------------------------------------------------
insert into membros (registro, nome, grupos, status, email_nro) values
  (70, 'Rui Campos',     '{Comunicação}', 'Ativo',     'rui@nro.dev'),
  (71, 'Sara Lins',      '{Comunicação}', 'Ativo',     'sara@nro.dev'),
  (72, 'Teo Martins',    '{Sinais}',      'Ativo',     'teo@nro.dev'),
  (73, 'Úrsula Prates',  '{Comunicação}', 'Desligado', 'ursula@nro.dev')
on conflict (registro) do nothing;
insert into perfis (id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000070', 'rui@nro.dev',    'leitura', 70),
  ('00000000-0000-0000-0000-000000000071', 'sara@nro.dev',   'leitura', 71),
  ('00000000-0000-0000-0000-000000000072', 'teo@nro.dev',    'leitura', 72),
  ('00000000-0000-0000-0000-000000000073', 'ursula@nro.dev', 'leitura', 73)
on conflict (id) do nothing;
update studio_config set grupos_acesso = array[gid('Comunicação')], grupos_aprovadores = '{}', aprovacoes_minimas = 1;

-- 1. a semente
do $$ begin
  raise notice 'A semente';
  perform ok((select count(*) from foto_temas) = 11, 'os 11 temas');
  perform ok((select count(*) from fotos) = 90 and (select count(*) from fotos where status = 'fila') = 90, 'as 90 fotos, todas na fila');
  perform ok((select count(*) from fotos where origem = 'equipe') = 11, 'as 11 da equipe');
  perform ok(not exists (select 1 from fotos where cardinality(tags) = 0 or tema is null), 'toda foto com tema e tags');
  perform ok((select tags from fotos where banco_id = 'ct10qdGv1hQ') = array['microscópio','pesquisa','silhueta'], 'as tags em português');
  perform ok((select count(*) from fotos where banco = 'pexels') = 2 and (select licenca from fotos where banco_id = '3861949') = 'Licença Pexels',
             'as do Pexels com a licença do Pexels');
  perform ok(exists (select 1 from information_schema.columns where table_name = 'studio_config' and column_name = 'pexels_chave'),
             'a chave do Pexels em studio_config');
end $$;

-- 2. a fila e o primeiro voto
do $$ declare r jsonb; begin
  raise notice 'A fila';
  perform eu(72, 'leitura');
  perform ok(not foto_curador() and fotos_fila()->>'status' = 'sem_permissao', 'quem não entra no Studio não vê a fila');
  perform ok(foto_votar(foto('ct10qdGv1hQ'), 'sim')->>'status' = 'sem_permissao', 'nem vota');
  perform eu(70, 'leitura');
  r := fotos_fila();
  perform ok(r->>'status' = 'ok' and (r->>'restantes')::int = 90 and jsonb_array_length(r->'fotos') = 30, 'Rui vê as 90, 30 de cada vez');
  perform ok((select bool_and(x->>'origem' = 'equipe') from jsonb_array_elements(r->'fotos') with ordinality e(x, n) where n <= 11),
             'a seleção da equipe vem primeiro');
  perform ok((r->'fotos'->11->>'tema') <> (r->'fotos'->12->>'tema'), 'depois as sugestões, um tema de cada vez');
  perform ok(jsonb_array_length(fotos_fila(array['hospital'])->'fotos') = (select count(*) from fotos where tema = 'hospital'), 'o filtro por tema');
  perform ok(foto_votar(foto('ct10qdGv1hQ'), 'sim', 'feed', 'retina')->>'foto_status' = 'aprovada', 'com uma aprovação, o primeiro "sim" aprova');
  perform ok((select enquadramento = 'feed' and paleta = 'retina' and votos_sim = 1 and decidida_em is not null from fotos where banco_id = 'ct10qdGv1hQ'),
             'guarda a peça e a família da aprovação');
  perform ok((fotos_fila()->>'restantes')::int = 89, 'e a foto sai da fila do Rui');
  perform ok(foto_votar(foto('lQGJCMY5qcM'), 'talvez')->>'foto_status' = 'fila', '"talvez" não decide');
  perform ok(foto_votar(foto('L7en7Lb-Ovc'), 'nao')->>'foto_status' = 'descartada', 'o primeiro "não" descarta');
  perform ok(foto_votar(foto('ct10qdGv1hQ'), 'sim', 'cubo', null)->>'campo' = 'enquadramento', 'a peça precisa ser uma das quatro');
  perform ok(foto_votar(foto('ct10qdGv1hQ'), 'sim', null, 'verde')->>'campo' = 'paleta', 'a família precisa ser da marca');
  perform ok(foto_votar(foto('ct10qdGv1hQ'), 'quem sabe')->>'campo' = 'decisao', 'e a decisão, sim, não ou talvez');
end $$;

-- 3. duas aprovações, o desfazer e a gestão
do $$ begin
  raise notice 'Duas aprovações';
  update studio_config set aprovacoes_minimas = 2;
  perform eu(70, 'leitura');
  perform ok(foto_votar(foto('y5hQCIn1c6o'), 'sim', 'story', 'cortex')->>'foto_status' = 'fila', 'com duas, um "sim" não basta');
  perform eu(4, 'admin');
  perform ok(foto_votar(foto('y5hQCIn1c6o'), 'nao')->>'foto_status' = 'fila', 'um "sim" e um "não": continua na fila');
  perform eu(71, 'leitura');
  perform ok(foto_votar(foto('y5hQCIn1c6o'), 'sim', 'banda', 'ion')->>'foto_status' = 'aprovada', 'dois "sim" e um "não": aprovada');
  perform ok((select paleta from fotos where banco_id = 'y5hQCIn1c6o') = 'ion', 'com a família do último "sim"');
  perform ok(foto_voto_desfazer(foto('y5hQCIn1c6o'))->>'foto_status' = 'fila', 'Sara desfaz: volta para a fila');
  perform ok((select paleta is null and decidida_em is null from fotos where banco_id = 'y5hQCIn1c6o'), 'e a decisão sai');
  perform ok(foto_voto_desfazer(foto('y5hQCIn1c6o'))->>'status' = 'sem_voto', 'desfazer de novo: não há voto');
  perform ok(foto_votar(foto('y5hQCIn1c6o'), 'sim', 'banda', 'ion')->>'foto_status' = 'aprovada', 'e vota de novo');

  perform eu(70, 'leitura'); perform foto_votar(foto('G8EfpFaGBWM'), 'nao');
  perform eu(71, 'leitura');
  perform ok(foto_votar(foto('G8EfpFaGBWM'), 'nao')->>'foto_status' = 'descartada', 'dois "não": descartada');
  perform ok(foto_status_definir(foto('G8EfpFaGBWM'), 'aprovada')->>'status' = 'sem_permissao', 'quem só entra no Studio não decide à mão');
  perform eu(4, 'admin');
  perform ok(foto_status_definir(foto('G8EfpFaGBWM'), 'aprovada')->>'foto_status' = 'aprovada', 'a gestão aprova à mão');
  perform ok((select manual and decidida_por is not null from fotos where banco_id = 'G8EfpFaGBWM'), 'marcada como decisão à mão');
  perform eu(70, 'leitura');
  perform ok(foto_votar(foto('G8EfpFaGBWM'), 'nao')->>'foto_status' = 'aprovada', 'e os votos não mudam mais o status');
  perform eu(4, 'admin');
  perform ok(foto_status_definir(foto('G8EfpFaGBWM'), 'fila')->>'foto_status' = 'descartada', '"fila" devolve aos votos, que descartam');
  perform ok(not (select manual from fotos where banco_id = 'G8EfpFaGBWM'), 'e a marca de decisão à mão sai');
  perform ok(foto_status_definir(foto('G8EfpFaGBWM'), 'perdida')->>'campo' = 'status', 'o status precisa ser um dos três');
  update studio_config set aprovacoes_minimas = 1;
end $$;

-- 4. pôr na fila, editar e a imagem
do $$ declare r jsonb; begin
  raise notice 'Pôr na fila, editar, a imagem';
  perform eu(72, 'leitura');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"AbCdEfGhIjK"}]')->>'status' = 'sem_permissao', 'quem não entra no Studio não põe na fila');
  perform eu(70, 'leitura');
  r := fotos_adicionar('[{"banco":"unsplash","banco_id":"AbCdEfGhIjK","pagina":"https://unsplash.com/photos/AbCdEfGhIjK","tema":"hospital",
                          "tags":["UTI","uti","  Hospital   novo ",""],"descricao":"Leito de UTI"},
                         {"banco":"pexels","banco_id":"1234567","imagem":"https://images.pexels.com/photos/1234567/pexels-photo-1234567.jpeg","origem":"busca","busca":"icu"},
                         {"banco":"unsplash","banco_id":"ct10qdGv1hQ"}]');
  perform ok(r->>'status' = 'ok' and (r->>'novas')::int = 2 and (r->>'repetidas')::int = 1, 'duas novas e uma repetida');
  perform ok((select tags from fotos where banco_id = 'AbCdEfGhIjK') = array['UTI','Hospital novo'], 'as tags sem repetir e sem espaço sobrando');
  perform ok((select origem = 'link' and licenca = 'Licença Unsplash' and criado_por = 70 from fotos where banco_id = 'AbCdEfGhIjK'), 'origem, licença e quem pôs');
  perform ok((select origem = 'busca' and imagem like 'https://images.pexels.com/%' from fotos where banco_id = '1234567'), 'a da busca, com a imagem');
  perform ok((fotos_fila()->'fotos'->0->>'banco_id') in ('AbCdEfGhIjK','1234567'), 'o que acabou de entrar vem antes de tudo');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"ZZZ","tema":"nenhum"}]')->>'campo' = 'tema', 'tema que não existe: nada entra');
  perform ok(foto('ZZZ') is null, 'e nada entrou mesmo');
  perform ok(fotos_adicionar('[{"banco":"flickr","banco_id":"1"}]')->>'campo' = 'banco_id', 'banco que não é dos três');
  perform ok(fotos_adicionar('[]')->>'campo' = 'fotos', 'lista vazia');

  perform ok(foto_imagem_definir(foto('AbCdEfGhIjK'), 'https://evil.example/x.jpg')->>'campo' = 'imagem', 'a imagem do Unsplash precisa ser do CDN dele');
  perform ok(foto_imagem_definir(foto('AbCdEfGhIjK'), 'https://images.unsplash.com/photo-1?ixid=a', 'Fulana')->>'status' = 'ok', 'a imagem que a API devolveu');
  perform ok((select imagem = 'https://images.unsplash.com/photo-1?ixid=a' and autor = 'Fulana' from fotos where banco_id = 'AbCdEfGhIjK'), 'com o autor, que faltava');
  perform foto_imagem_definir(foto('AbCdEfGhIjK'), 'https://images.unsplash.com/photo-1?ixid=b', 'Outro');
  perform ok((select autor from fotos where banco_id = 'AbCdEfGhIjK') = 'Fulana', 'o autor que já havia fica');

  perform ok(foto_salvar(jsonb_build_object('id', foto('AbCdEfGhIjK'), 'tags', '["leito","UTI"]'::jsonb, 'descricao', 'Leito vazio'))->>'status' = 'ok', 'edita tags e descrição');
  perform ok((select tags = array['leito','UTI'] and descricao = 'Leito vazio' and tema = 'hospital' from fotos where banco_id = 'AbCdEfGhIjK'),
             'e o que não veio fica como estava');
  perform ok(foto_salvar(jsonb_build_object('id', foto('AbCdEfGhIjK'), 'tema', 'nenhum'))->>'campo' = 'tema', 'tema que não existe');
  perform ok(foto_salvar('{"id":"x"}')->>'campo' = 'id', 'id que não é uuid');
end $$;

-- 5. quem lê o quê
grant usage, select on all sequences in schema public to authenticated;
set role authenticated;
do $$ begin
  raise notice 'Quem lê';
  perform eu(72, 'leitura');
  perform ok((select count(*) from fotos) = (select count(*) from fotos where status = 'aprovada') and (select count(*) from fotos) = 2,
             'fora do Studio, a galeria: só as aprovadas');
  perform ok((select count(*) from foto_temas) = 11, 'os temas, todo mundo');
  perform eu(70, 'leitura');
  perform ok((select count(*) from fotos) = 92, 'quem faz a curadoria vê a fila e as descartadas');
  perform ok((select count(*) from foto_votos) = (select count(*) from foto_votos where registro = 70) and (select count(*) from foto_votos) >= 5,
             'e só os próprios votos');
  perform eu(73, 'leitura');
  perform ok((select count(*) from fotos) = 0 and (select count(*) from foto_temas) = 0, 'conta bloqueada não lê nada');
end $$;
reset role;

-- 6. de novo
\ir ../2.24.0_fotos.sql
do $$ begin
  raise notice 'A 2.24.0 de novo';
  perform ok((select count(*) from foto_temas) = 11 and (select count(*) from fotos) = 92, 'nada se repete');
  perform ok(st('ct10qdGv1hQ') = 'aprovada' and st('y5hQCIn1c6o') = 'aprovada' and st('L7en7Lb-Ovc') = 'descartada', 'e os votos ficam');
  perform ok((select count(*) from migracoes where id = '2.24.0_fotos') = 1, 'a linha em migracoes');
end $$;
