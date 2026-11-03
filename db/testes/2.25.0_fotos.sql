\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.25.0: o banco de fotos sem votação, e aberto para ler.
-- Roda depois do teste da 2.24.0, no mesmo banco (usa a equipe e as
-- funções de ajuda dele):
--   bash testes/preparar-base.sh teste t225 2.18.0_soma.sql 2.24.0_fotos.sql 2.25.0_fotos.sql
-- Aplica a 2.25.0 e confere: a votação sai, as escolhidas pela equipe
-- entram no banco, só a gestão do Studio põe e decide (uma, várias,
-- de volta às sugestões), a leitura pública (anon) e, no fim, a 2.25.0
-- de novo.
-- ============================================================
create temp table antes as select banco_id, status, origem from fotos;

\ir ../2.25.0_fotos_sem_votacao.sql

create or replace function sug(p_n integer) returns text language sql as $$
  select banco_id from fotos where status = 'fila' and origem = 'sugestao' order by banco_id offset p_n limit 1 $$;

-- 1. a migração
do $$ begin
  raise notice 'A migração';
  perform ok(to_regprocedure('public.fotos_fila(text[],integer)') is null and to_regprocedure('public.foto_votar(uuid,text,text,text)') is null
             and to_regprocedure('public.foto_voto_desfazer(uuid)') is null and to_regprocedure('public.foto_recontar(uuid)') is null,
             'as funções da votação saem');
  perform ok(to_regclass('public.foto_votos') is not null and (select count(*) from foto_votos) > 0, 'os votos ficam, como histórico');
  perform ok(not exists (select 1 from antes a join fotos f using (banco_id) where a.origem = 'equipe' and a.status = 'fila' and f.status <> 'aprovada'),
             'as escolhidas pela equipe que estavam na fila entram no banco');
  perform ok((select count(*) from antes where origem = 'equipe' and status = 'fila') > 0, '(havia escolhidas da equipe na fila)');
  perform ok((select decidida_por from fotos f join antes a using (banco_id) where a.origem = 'equipe' and a.status = 'fila' limit 1) = 'Seleção da equipe',
             'marcadas como seleção da equipe');
  perform ok(not exists (select 1 from antes a join fotos f using (banco_id) where a.status = 'descartada' and f.status <> 'descartada'),
             'as descartadas continuam descartadas');
  perform ok(not exists (select 1 from antes a join fotos f using (banco_id) where a.origem <> 'equipe' and a.status = 'fila' and f.status <> 'fila'),
             'as sugestões continuam sugestões');
end $$;

-- 2. pôr no banco e decidir
do $$
declare r jsonb; v_s0 text := sug(0); v_s1 text := sug(1); v_s2 text := sug(2); v_s3 text := sug(3);
begin
  raise notice 'Pôr no banco e decidir';
  perform eu(70, 'leitura');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"NovaFoto001"}]')->>'status' = 'sem_permissao', 'quem só entra no Studio não põe no banco');
  perform ok(fotos_decidir(array[foto(v_s0)], 'aprovada')->>'status' = 'sem_permissao', 'nem escolhe nas sugestões');
  perform ok(foto_status_definir(foto(v_s0), 'aprovada')->>'status' = 'sem_permissao', 'nem decide uma por uma');

  perform eu(4, 'admin');
  r := fotos_adicionar(jsonb_build_array(
         jsonb_build_object('banco', 'unsplash', 'banco_id', 'NovaFoto001', 'tema', 'hospital', 'tags', '["UTI","leito"]'::jsonb,
                            'imagem', 'https://images.unsplash.com/photo-9?ixid=x', 'autor', 'Fulana', 'origem', 'busca'),
         jsonb_build_object('banco', 'unsplash', 'banco_id', v_s0, 'tags', '["outra"]'::jsonb),
         jsonb_build_object('banco', 'unsplash', 'banco_id', 'ct10qdGv1hQ')));
  perform ok(r->>'status' = 'ok' and (r->>'novas')::int = 1 and (r->>'reativadas')::int = 1 and (r->>'repetidas')::int = 1, 'uma nova, uma das sugestões e uma que já estava no banco');
  perform ok((select status = 'aprovada' and manual and decidida_por is not null and decidida_em is not null and origem = 'busca'
                and imagem like 'https://images.unsplash.com/photo-9%' and tags = array['UTI','leito'] from fotos where banco_id = 'NovaFoto001'),
             'a nova entra direto no banco, com imagem, tema e tags');
  perform ok(st(v_s0) = 'aprovada' and (select tags <> array['outra'] from fotos where banco_id = v_s0),
             'a sugestão passa a aprovada e guarda as tags que tinha');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"NovaFoto001"}]')->>'repetidas' = '1', 'pôr de novo não repete');
  perform ok(fotos_adicionar('[{"banco":"flickr","banco_id":"x"}]')->>'campo' = 'banco_id', 'o banco precisa ser um dos três');
  perform ok(fotos_adicionar('[{"banco":"unsplash","banco_id":"x","tema":"nenhum"}]')->>'campo' = 'tema', 'e o tema, um dos temas');

  r := fotos_decidir(array[foto(v_s1), foto(v_s2)], 'aprovada');
  perform ok(r->>'status' = 'ok' and (r->>'fotos')::int = 2, 'escolher duas sugestões de uma vez');
  perform ok(st(v_s1) = 'aprovada' and st(v_s2) = 'aprovada', 'e as duas estão no banco');
  r := fotos_decidir(array[foto(v_s3)], 'descartada');
  perform ok(r->>'fotos' = '1' and st(v_s3) = 'descartada', 'descartar uma sugestão');
  r := fotos_decidir(array[foto(v_s3)], 'fila');
  perform ok(r->>'fotos' = '1' and st(v_s3) = 'fila'
             and (select not manual and decidida_em is null and decidida_por is null from fotos where banco_id = v_s3), '"fila" devolve às sugestões');
  perform ok(fotos_decidir(array[foto(v_s3)], 'perdida')->>'campo' = 'status', 'o status precisa ser um dos três');
  perform ok(fotos_decidir('{}'::uuid[], 'aprovada')->>'campo' = 'ids', 'e alguma foto');
  r := foto_status_definir(foto('NovaFoto001'), 'descartada');
  perform ok(r->>'foto_status' = 'descartada' and st('NovaFoto001') = 'descartada', 'a galeria tira uma foto');
  perform ok(foto_status_definir(foto('NovaFoto001'), 'aprovada')->>'foto_status' = 'aprovada', 'e põe de volta');
  perform ok(foto_status_definir('00000000-0000-0000-0000-00000000abcd', 'aprovada')->>'status' = 'nao_encontrada', 'foto que não existe');
end $$;

-- 3. ler sem conta
grant usage, select on all sequences in schema public to authenticated;
set role anon;
do $$
declare r jsonb;
begin
  raise notice 'Ler sem conta';
  r := fotos_banco_publico();
  perform ok(r->>'status' = 'ok' and (r->>'total')::int = jsonb_array_length(r->'fotos') and jsonb_array_length(r->'fotos') > 0, 'a chave anônima lê o banco');
  perform ok((select bool_and(x ? 'imagem' and x ? 'tags' and x ? 'familia' and not x ? 'votos_sim' and not x ? 'criado_por' and not x ? 'decidida_por')
                from jsonb_array_elements(r->'fotos') x), 'só os campos públicos');
  r := fotos_banco_publico(array['uti']);
  perform ok(exists (select 1 from jsonb_array_elements(r->'fotos') x where x->>'banco_id' = 'NovaFoto001')
             and (select bool_and(exists (select 1 from jsonb_array_elements_text(x->'tags') t where lower(t) = 'uti')) from jsonb_array_elements(r->'fotos') x),
             'a tag filtra, sem diferenciar maiúscula');
  r := fotos_banco_publico(null, 'hospital');
  perform ok((select bool_and(x->>'tema' = 'hospital' and x->>'tema_nome' is not null) from jsonb_array_elements(r->'fotos') x) and jsonb_array_length(r->'fotos') > 0,
             'o tema filtra, com o nome e a família');
end $$;
do $$ begin
  begin
    perform 1 from fotos limit 1;
    raise exception 'FALHOU: a chave anônima leu a tabela fotos';
  exception when insufficient_privilege then raise notice '  ok   a tabela continua fechada para a chave anônima';
  end;
  begin
    perform fotos_decidir(array[gen_random_uuid()], 'aprovada');
    raise exception 'FALHOU: a chave anônima chamou fotos_decidir';
  exception when insufficient_privilege then raise notice '  ok   e não decide nada';
  end;
end $$;
reset role;
do $$ begin
  perform ok((fotos_banco_publico()->>'total')::int = (select count(*) from fotos where status = 'aprovada'), 'o total é o das aprovadas');
  perform ok(not exists (select 1 from jsonb_array_elements(fotos_banco_publico()->'fotos') x join fotos f on f.banco_id = x->>'banco_id' where f.status <> 'aprovada'),
             'sugestões e descartadas não saem');
end $$;

-- 4. de novo
create temp table depois as select banco_id, status from fotos;
\ir ../2.25.0_fotos_sem_votacao.sql
do $$ begin
  raise notice 'A 2.25.0 de novo';
  perform ok(not exists (select 1 from depois d join fotos f using (banco_id) where d.status <> f.status), 'nada muda');
  perform ok((select count(*) from migracoes where id = '2.25.0_fotos_sem_votacao') = 1, 'a linha em migracoes');
end $$;
