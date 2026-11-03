\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.26.0: o banco de imagens, uma foto de cada vez.
-- Roda depois dos testes da 2.24.0 e da 2.25.0, no mesmo banco (usa
-- a equipe e as funções de ajuda deles):
--   bash testes/preparar-base.sh teste t226 2.18.0_soma.sql 2.24.0_fotos.sql 2.25.0_fotos.sql 2.26.0_fotos.sql
-- Aplica a 2.26.0 e confere: só admin põe fotos novas, e elas vão
-- para a avaliação; quem gere o Studio (admin ou grupo aprovador)
-- aprova, rejeita ou devolve uma foto, com a peça e a paleta; quem só
-- entra no Studio não decide; a chave anônima não põe nem decide; e,
-- no fim, a 2.26.0 de novo.
-- ============================================================
create temp table antes as select banco_id, status from fotos;

\ir ../2.26.0_banco_de_imagens.sql

-- 1. a migração
do $$ begin
  raise notice 'A migração';
  perform ok(to_regprocedure('public.foto_decidir(uuid,text,text,text)') is not null, 'foto_decidir existe');
  perform ok(to_regprocedure('public.fotos_decidir(uuid[],text)') is not null and to_regprocedure('public.foto_status_definir(uuid,text)') is not null,
             'fotos_decidir e foto_status_definir continuam');
  perform ok(not exists (select 1 from antes a join fotos f using (banco_id) where a.status <> f.status), 'nenhuma foto muda de status');
end $$;

-- 2. pôr fotos novas: só admin, e vão para a avaliação
do $$
declare r jsonb; v_desc text := (select banco_id from fotos where status = 'descartada' order by banco_id limit 1);
        v_banco text := (select banco_id from fotos where status = 'aprovada' order by banco_id limit 1);
        v_fila text := (select banco_id from fotos where status = 'fila' order by banco_id limit 1);
begin
  raise notice 'Pôr fotos novas';
  -- Teo (Sinais) passa a ser do grupo aprovador: gere o Studio sem ser admin
  update studio_config set grupos_aprovadores = array[gid('Sinais')];
  perform eu(72, 'leitura');
  perform ok(studio_gestor(), '(Teo gere o Studio pelo grupo aprovador)');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"Nova226a"}]')->>'status' = 'sem_permissao',
             'quem gere o Studio sem ser admin não põe fotos novas');
  perform eu(70, 'leitura');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"Nova226a"}]')->>'status' = 'sem_permissao', 'nem quem só entra no Studio');

  perform eu(4, 'admin');
  r := fotos_adicionar(jsonb_build_array(
         jsonb_build_object('banco', 'unsplash', 'banco_id', 'Nova226a', 'tema', 'hospital', 'tags', '["UTI"]'::jsonb,
                            'imagem', 'https://images.unsplash.com/photo-226?ixid=x', 'autor', 'Fulana', 'origem', 'busca'),
         jsonb_build_object('banco', 'pexels', 'banco_id', '226226', 'tema', 'laboratorio'),
         jsonb_build_object('banco', 'unsplash', 'banco_id', v_desc),
         jsonb_build_object('banco', 'unsplash', 'banco_id', v_banco),
         jsonb_build_object('banco', 'unsplash', 'banco_id', v_fila)));
  perform ok(r->>'status' = 'ok' and (r->>'novas')::int = 2 and (r->>'reativadas')::int = 1 and (r->>'repetidas')::int = 2,
             'duas novas, uma descartada que volta e duas que já estavam (no banco e na avaliação)');
  perform ok((select status = 'fila' and not manual and decidida_em is null and origem = 'busca' and autor = 'Fulana'
                and imagem like 'https://images.unsplash.com/photo-226%' and tags = array['UTI'] from fotos where banco_id = 'Nova226a'),
             'a nova vai para a avaliação, com imagem, autor e tags');
  perform ok(st('226226') = 'fila' and (select origem = 'link' and licenca = 'Licença Pexels' from fotos where banco_id = '226226'), 'a do Pexels também');
  perform ok(st(v_desc) = 'fila' and (select not manual and decidida_em is null and decidida_por is null from fotos where banco_id = v_desc),
             'a descartada volta para a avaliação');
  perform ok(st(v_banco) = 'aprovada', 'a que estava no banco continua no banco');
  perform ok(fotos_adicionar('[{"banco":"flickr","banco_id":"x"}]')->>'campo' = 'banco_id', 'o banco precisa ser um dos três');
end $$;

-- 3. avaliar uma foto
do $$
declare r jsonb;
begin
  raise notice 'Avaliar uma foto';
  perform eu(70, 'leitura');
  perform ok(foto_decidir(foto('Nova226a'), 'aprovada', 'feed', 'glia')->>'status' = 'sem_permissao', 'quem só entra no Studio não decide');
  perform ok(st('Nova226a') = 'fila', '(e a foto continua na avaliação)');

  perform eu(72, 'leitura');
  r := foto_decidir(foto('Nova226a'), 'aprovada', 'story', 'glia');
  perform ok(r->>'status' = 'ok' and r->>'foto_status' = 'aprovada', 'quem gere o Studio aprova');
  perform ok((select status = 'aprovada' and manual and decidida_em is not null and decidida_por = 'Teo Martins'
                and enquadramento = 'story' and paleta = 'glia' from fotos where banco_id = 'Nova226a'),
             'a foto entra no banco com a peça e a paleta em que foi vista');
  perform ok(exists (select 1 from jsonb_array_elements(fotos_banco_publico()->'fotos') x
                      where x->>'banco_id' = 'Nova226a' and x->>'enquadramento' = 'story' and x->>'paleta' = 'glia'),
             'e já aparece para quem lê o banco, com a peça e a paleta');

  perform eu(4, 'admin');
  r := foto_decidir(foto('226226'), 'descartada', 'feed', 'nexo');
  perform ok(r->>'foto_status' = 'descartada' and st('226226') = 'descartada'
             and (select enquadramento is null and paleta is null from fotos where banco_id = '226226'), 'rejeitar não guarda peça nem paleta');
  r := foto_decidir(foto('Nova226a'), 'fila');
  perform ok(r->>'foto_status' = 'fila' and (select status = 'fila' and not manual and decidida_em is null and decidida_por is null
                and enquadramento is null and paleta is null from fotos where banco_id = 'Nova226a'),
             'desfazer devolve à avaliação e limpa a decisão');
  perform ok(foto_decidir(foto('Nova226a'), 'aprovada')->>'status' = 'ok'
             and (select enquadramento is null from fotos where banco_id = 'Nova226a'), 'aprovar sem dizer a peça também vale');
  perform ok(foto_decidir(foto('Nova226a'), 'aprovada', 'cartaz')->>'campo' = 'enquadramento', 'a peça precisa ser uma das quatro');
  perform ok(foto_decidir(foto('Nova226a'), 'aprovada', 'feed', 'rosa')->>'campo' = 'paleta', 'e a paleta, uma das famílias');
  perform ok(foto_decidir(foto('Nova226a'), 'talvez')->>'campo' = 'status', 'e o status, um dos três');
  perform ok(foto_decidir('00000000-0000-0000-0000-00000000abcd', 'aprovada')->>'status' = 'nao_encontrada', 'foto que não existe');
  update studio_config set grupos_aprovadores = '{}';
  perform eu(72, 'leitura');
  perform ok(foto_decidir(foto('Nova226a'), 'descartada')->>'status' = 'sem_permissao', 'fora do grupo aprovador, Teo não decide mais');
end $$;

-- 4. a chave anônima não põe nem decide
set role anon;
do $$ begin
  raise notice 'A chave anônima';
  begin
    perform foto_decidir(gen_random_uuid(), 'aprovada');
    raise exception 'FALHOU: a chave anônima chamou foto_decidir';
  exception when insufficient_privilege then raise notice '  ok   a chave anônima não decide';
  end;
  begin
    perform fotos_adicionar('[{"banco":"unsplash","banco_id":"Anon226"}]');
    raise exception 'FALHOU: a chave anônima chamou fotos_adicionar';
  exception when insufficient_privilege then raise notice '  ok   nem põe fotos';
  end;
end $$;
reset role;

-- 5. de novo
create temp table depois as select banco_id, status, enquadramento, paleta from fotos;
\ir ../2.26.0_banco_de_imagens.sql
do $$ begin
  raise notice 'A 2.26.0 de novo';
  perform ok(not exists (select 1 from depois d join fotos f using (banco_id)
                          where d.status <> f.status or d.enquadramento is distinct from f.enquadramento), 'nada muda');
  perform ok((select count(*) from migracoes where id = '2.26.0_banco_de_imagens') = 1, 'a linha em migracoes');
end $$;
