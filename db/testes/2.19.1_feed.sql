\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: feed editorial, notícias públicas, reações e newsletter.
-- Rode depois do teste do reporte (líderes, ciclo da semana, um item do acervo):
--   bash testes/preparar-base.sh teste t2191f 2.18.0_soma.sql 2.19.0.sql 2.19.1_labbio.sql \
--        2.19.1_reporte.sql 2.19.1_feed.sql
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- o acervo, antes da migração: um item publicado da 2.18 (interno)
insert into feed_itens (autor, titulo, subtitulo, texto, publicado_em) values (4, 'Notícia antiga', 'Do acervo', 'Texto antigo', now() - interval '30 days');

\i 2.19.1_feed.sql
\i 2.19.1_feed.sql

do $$ begin
  raise notice 'Acervo';
  perform ok((select estado = 'publicado' and not publico from feed_itens where titulo = 'Notícia antiga'), 'o acervo continua publicado, só para a equipe');
  perform ok(not exists (select 1 from feed_itens where publico), 'nada do acervo vai para o site sozinho');
end $$;

-- a semana do reporte aberta de novo, para a Iara (43, NRO_MANAGERS) contribuir
update reporte_ciclos set prazo = now() + interval '1 day', fecha_em = now() + interval '3 days'
 where semana = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
delete from reporte_cobrancas where registro = 43;

do $$
declare r jsonb; v_rep uuid; v_ver integer; v_top uuid; v_not uuid; v_contrib uuid; texto_longo text := repeat('Ensaio da órtese na bancada do LABBIO. ', 12);
  copiar jsonb;
begin
  raise notice 'Contribuição do reporte não publica';
  perform eu(43, 'leitura');
  r := public.reporte_meu();
  v_rep := (r->'reporte'->>'id')::uuid; v_ver := (r->'reporte'->>'versao')::integer;
  r := public.reporte_salvar(jsonb_build_object('id', v_rep, 'versao', v_ver, 'etapa', 3, 'apontamentos', r->'reporte'->'apontamentos',
         'escalonamentos', '[]'::jsonb, 'feed', '[{"titulo":"Prêmio no congresso","subtitulo":"A equipe foi premiada","texto":"Curto."}]'::jsonb));
  perform ok(r->>'status' = 'ok', 'o líder salva a contribuição no reporte');
  select id into v_contrib from feed_itens where reporte_id = v_rep;
  perform ok((select estado from feed_itens where id = v_contrib) = 'rascunho', 'rascunho enquanto o reporte não sai');
  perform ok(public.reporte_enviar(v_rep, (r->>'versao')::integer)->>'status' = 'ok', 'envia o reporte');
  select id into v_contrib from feed_itens where reporte_id = v_rep;
  perform ok((select estado = 'pronto' and publicado_em is null from feed_itens where id = v_contrib),
    'enviar o reporte deixa a contribuição pronta, sem publicar');
  perform eu(11, 'leitura');
  perform ok(not exists (select 1 from jsonb_array_elements(public.feed_lista()) x where x->>'titulo' = 'Prêmio no congresso'), 'e ela não aparece no feed');

  raise notice 'Quem publica';
  perform ok(public.feed_publicar(v_contrib, false)->>'status' = 'sem_permissao', 'membro não publica');
  perform eu(42, 'leitura');
  perform ok(public.feed_publicar(v_contrib, false)->>'status' = 'sem_permissao', 'liderança fora de NRO_MANAGERS não publica');
  perform ok(public.feed_item_salvar('{"titulo":"x","subtitulo":"y"}')->>'status' = 'sem_permissao', 'nem cria');
  perform eu(43, 'leitura');
  perform ok(public.feed_editor(), 'NRO_MANAGERS é editor (pertença efetiva)');
  perform ok(jsonb_array_length(public.feed_editorial('pronto')->'itens') >= 1, 'a mesa editorial mostra o que está pronto');
  r := public.feed_publicar(v_contrib, false);
  perform ok(r->>'status' = 'ok' and r->>'estado' = 'publicado', 'o manager publica para a equipe, sem votação');
  perform ok((select publicado_por = 43 and autor = 43 from feed_itens where id = v_contrib), 'quem publicou fica registrado');

  raise notice 'Tópico e notícia';
  r := public.feed_item_salvar('{"tipo":"topico","titulo":"Seminário na sexta","subtitulo":"Às 14h no auditório","texto":"Aberto a todos."}');
  perform ok(r->>'status' = 'ok' and r->>'slug' is null, 'tópico, sem página própria');
  v_top := (r->>'id')::uuid;
  perform ok(public.feed_item_salvar(jsonb_build_object('tipo', 'topico', 'titulo', 'T', 'subtitulo', 'S', 'texto', repeat('x', 1300)))->>'campo' = 'texto',
    'tópico é breve');
  r := public.feed_item_salvar(jsonb_build_object('tipo', 'noticia', 'titulo', 'Órtese passa no teste de bancada', 'subtitulo', 'O protótipo aguentou 10 mil ciclos',
         'texto', 'Curto demais', 'autor_texto', 'Equipe de Comunicação'));
  v_not := (r->>'id')::uuid;
  perform ok(r->>'slug' = 'ortese-passa-no-teste-de-bancada', 'notícia ganha um slug a partir do título');
  perform ok(public.feed_publicar(v_not, true)->>'status' = 'noticia_incompleta', 'notícia sem texto de verdade não publica');
  perform ok(public.feed_item_salvar(jsonb_build_object('id', v_not, 'tipo', 'noticia', 'titulo', 'Órtese passa no teste de bancada',
         'subtitulo', 'O protótipo aguentou 10 mil ciclos', 'texto', texto_longo, 'autor_texto', 'Equipe de Comunicação',
         'imagens', jsonb_build_array(jsonb_build_object('path', 'outro/foto.jpg', 'legenda', 'x'))))->>'campo' = 'imagens',
    'imagem de fora da pasta do item é recusada');
  r := public.feed_item_salvar(jsonb_build_object('id', v_not, 'tipo', 'noticia', 'titulo', 'Órtese passa no teste de bancada',
         'subtitulo', 'O protótipo aguentou 10 mil ciclos', 'texto', texto_longo, 'autor_texto', 'Equipe de Comunicação',
         'imagens', jsonb_build_array(jsonb_build_object('path', v_not || '/bancada.jpg', 'legenda', 'O protótipo na bancada'))));
  perform ok(r->>'status' = 'ok', 'notícia completa, com imagem e legenda');
  perform set_config('teste.not', v_not::text, false);
  perform set_config('teste.top', v_top::text, false);
  perform set_config('teste.contrib', v_contrib::text, false);

  raise notice 'Publicar no site: imagens em dois passos';
  r := public.feed_publicar(v_not, true);
  perform ok(r->>'estado' = 'publicando' and jsonb_array_length(r->'copiar') = 1, 'preparar: a lista de cópias');
  perform ok(r->'copiar'->0->>'para' = v_not || '/1.jpg', 'o destino público é controlado pelo banco');
  perform ok(public.noticia_publica('ortese-passa-no-teste-de-bancada')->>'status' = 'nao_encontrada', 'enquanto publica, o site não mostra');
  perform ok(public.feed_publicar_confirmar(v_not)->>'status' = 'imagens_pendentes', 'sem a cópia, não confirma');
end $$;

-- a cópia pública: só o editor, só de item em "publicando"
select eu(11, 'leitura');
set role authenticated;
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('noticias', current_setting('teste.not') || '/1.jpg');
    raise exception 'FALHOU: membro gravou no bucket público';
  exception when insufficient_privilege then perform ok(true, 'membro não grava no bucket público');
  end;
end $$;
reset role;
select eu(43, 'leitura');
set role authenticated;
insert into storage.objects (bucket_id, name) values ('noticias', current_setting('teste.not') || '/1.jpg');
do $$ begin
  begin
    insert into storage.objects (bucket_id, name) values ('noticias', current_setting('teste.not') || '/9.jpg');
    raise exception 'FALHOU: gravou um caminho que o banco não pediu';
  exception when insufficient_privilege then perform ok(true, 'nem o editor grava fora do caminho pedido');
  end;
end $$;
reset role;

do $$
declare r jsonb; v_not uuid := current_setting('teste.not')::uuid; v_top uuid := current_setting('teste.top')::uuid; n integer;
begin
  perform eu(43, 'leitura');
  perform ok(public.feed_publicar_confirmar(v_not)->>'status' = 'ok', 'com a cópia, confirma');
  perform ok(public.feed_publicar(v_top, true)->>'estado' = 'publicado', 'tópico sem imagem publica direto no site');

  raise notice 'O site (anônimo)';
end $$;
set role anon;
do $$ declare r jsonb; begin
  r := public.noticias_publicas();
  perform ok(jsonb_array_length(r) = 2, 'o site lista as duas publicações do site');
  perform ok(r::text !~ 'Prêmio no congresso|Notícia antiga', 'nada interno nem do acervo');
  perform ok((select x->>'imagem' from jsonb_array_elements(r) x where x->>'tipo' = 'noticia') like 'noticias/%/1.jpg', 'a imagem vem do bucket público');
  perform ok((select not (x ? 'texto' and x->>'texto' is not null) from jsonb_array_elements(r) x where x->>'tipo' = 'noticia'),
    'a lista não traz o texto da notícia (a página traz)');
  r := public.noticia_publica('ortese-passa-no-teste-de-bancada');
  perform ok(r->>'status' = 'ok' and r->>'autor' = 'Equipe de Comunicação' and r->'imagens'->0->>'legenda' = 'O protótipo na bancada'
             and not (r ? 'id') and not (r ? 'imagem_path'), 'a página da notícia, sem caminhos internos');
  begin
    perform public.feed_lista();
    raise exception 'FALHOU: anônimo leu o feed interno';
  exception when insufficient_privilege then perform ok(true, 'anônimo não lê o feed interno');
  end;
  begin
    perform public.feed_publicar(gen_random_uuid(), true);
    raise exception 'FALHOU: anônimo chamou publicar';
  exception when insufficient_privilege then perform ok(true, 'nem publica');
  end;
end $$;
reset role;

do $$
declare r jsonb; v_not uuid := current_setting('teste.not')::uuid; v_contrib uuid := current_setting('teste.contrib')::uuid; i integer;
begin
  raise notice 'Slug estável';
  perform eu(43, 'leitura');
  r := public.feed_item_salvar(jsonb_build_object('id', v_not, 'tipo', 'noticia', 'titulo', 'Órtese aprovada na bancada', 'slug', 'ortese-aprovada',
         'subtitulo', 'O protótipo aguentou 10 mil ciclos', 'texto', repeat('Ensaio da órtese na bancada do LABBIO. ', 12),
         'imagens', jsonb_build_array(jsonb_build_object('path', v_not || '/bancada.jpg', 'legenda', 'O protótipo na bancada'))));
  perform ok(r->>'slug' = 'ortese-aprovada', 'o slug muda');
  r := public.noticia_publica('ortese-passa-no-teste-de-bancada');
  perform ok(r->>'status' = 'ok' and (r->>'redirecionar')::boolean and r->>'slug' = 'ortese-aprovada', 'o slug antigo leva ao novo');
  perform ok((select publico_path is not null from (select img->>'publico_path' as publico_path from feed_itens, jsonb_array_elements(imagens) img where id = v_not) q),
    'editar não perde a imagem pública');

  raise notice 'Reações';
  perform eu(11, 'leitura');
  r := public.feed_reagir(v_not, '👏');
  perform ok(r->>'status' = 'ok' and (r->'reacoes'->>'👏')::integer = 1 and r->>'minha_reacao' = '👏', 'membro reage');
  r := public.feed_reagir(v_not, '❤️');
  perform ok(r->'reacoes' = '{"❤️": 1}'::jsonb, 'trocar não duplica');
  perform ok(public.feed_reagir(v_not, '🤡')->>'status' = 'invalido', 'só os emojis da lista');
  perform ok(public.feed_reagir(current_setting('teste.top')::uuid, '👏')->>'status' = 'sem_permissao', 'tópico não tem reação');
  perform ok((select x->'reacoes' = 'null'::jsonb from jsonb_array_elements(public.noticias_publicas()) x where x->>'tipo' = 'topico'),
    'o site não mostra reação de tópico');
  perform eu(45, 'leitura');   -- Kátia, Egresso: conta bloqueada no portal
  perform ok(not public.conta_ativa(), 'egresso não acessa o portal');
  perform ok(public.feed_reagir(v_not, '🎉')->>'status' = 'ok', 'mas reage à notícia pública');
  update feed_itens set tipo = 'noticia' where id = v_contrib;   -- uma notícia interna, por um instante
  perform ok(public.feed_reagir(v_contrib, '🎉')->>'status' = 'sem_permissao', 'e não à publicação interna');
  update feed_itens set tipo = 'topico' where id = v_contrib;
  perform eu(44, 'pessoal');   -- Jonas, Desligado
  perform ok(public.feed_reagir(v_not, '🚀')->>'status' = 'ok', 'desligado também reage ao que é público');
  perform set_config('teste.uid', '', false);
  perform ok(public.feed_reagir(v_not, '🚀')->>'status' = 'sem_permissao', 'sem login não reage');
  perform eu(11, 'leitura');
  for i in 1..40 loop r := public.feed_reagir(v_not, case when i % 2 = 0 then '👏' else '💡' end); end loop;
  perform ok(r->>'status' = 'limite', 'limite de mudanças seguidas');
  perform ok((select count(*) from feed_reacoes where item_id = v_not and user_id = (select id from perfis where registro = 11)) = 1,
    'uma reação por pessoa');

  raise notice 'Retirar';
  perform eu(43, 'leitura');
  r := public.feed_retirar(v_not);
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'apagar') = 1, 'retirar devolve as cópias públicas a apagar');
  perform ok(public.noticia_publica('ortese-aprovada')->>'status' = 'nao_encontrada', 'some do site na hora');
  perform eu(45, 'leitura');
  perform ok(public.feed_reagir(v_not, '👏')->>'status' = 'sem_permissao', 'retirada não aceita reação');
  -- só para a equipe: retirar → apagar a cópia pública → publicar interno
  perform eu(43, 'leitura');
  perform ok(public.noticias_objeto_pode(v_not || '/1.jpg', true), 'o editor apaga a cópia pública do item retirado');
  r := public.feed_publicar(v_not, false);
  perform ok(r->>'status' = 'ok' and (select estado = 'publicado' and not publico and retirado_em is null from feed_itens where id = v_not),
    'republica só para a equipe');
  perform ok(public.noticia_publica('ortese-aprovada')->>'status' = 'nao_encontrada'
             and exists (select 1 from jsonb_array_elements(public.feed_lista()) x where x->>'id' = v_not::text),
    'fora do site, dentro do portal');
  perform ok(not public.noticias_objeto_pode(v_not || '/1.jpg', true), 'publicado não deixa apagar a cópia');
  -- de volta ao site, para a newsletter
  update feed_itens set estado = 'publicando', publico = true where id = v_not;
  perform ok(public.feed_publicar_confirmar(v_not)->>'status' = 'ok', 'republica (a cópia ainda existe)');
end $$;

do $$
declare r jsonb; v uuid; n_ed integer; v_tok uuid; v_unsub uuid;
begin
  raise notice 'Newsletter';
  perform eu(43, 'leitura');
  -- um item publicado antes da ativação não entra sozinho
  update feed_itens set publicado_em = now() - interval '400 days' where titulo = 'Notícia antiga';
  r := public.newsletter_pendentes();
  perform ok(jsonb_array_length(r->'equipe') = 3 and r::text !~ 'Notícia antiga', 'a equipe recebe os três publicados depois da ativação (o acervo não)');
  perform ok(jsonb_array_length(r->'comunidade') = 2, 'a comunidade, só os dois públicos');
  insert into agenda_ausencias (registro, tipo, inicio, fim) values (47, 'ferias', now() - interval '1 day', now() + interval '5 days');
  r := public.newsletter_enviar_agora('semanal');
  perform ok(r->>'status' = 'ok' and (r->>'itens')::integer = 3, 'o manager manda a edição da equipe agora, sem votos');
  v := (r->>'id')::uuid;
  perform ok(not exists (select 1 from newsletter_envios where newsletter_id = v and registro = 47), 'quem está de férias fica fora');
  perform ok(exists (select 1 from newsletter_envios where newsletter_id = v and registro = 11), 'os outros recebem');
  perform ok(public.newsletter_enviar_agora('semanal')->>'status' = 'vazio', 'sem item novo, sem edição (nada repete)');

  insert into comunidade_inscritos (email, nome, origem, confirmado_em) values ('leitora@exemplo.test', 'Leitora', 'Importação', now());
  insert into comunidade_inscritos (email, nome, origem, confirmacao_token, confirmacao_pedida) values ('pendente@exemplo.test', 'Pendente', 'Site', gen_random_uuid(), now());
  r := public.newsletter_enviar_agora('mensal');
  perform ok(r->>'status' = 'ok' and (r->>'itens')::integer = 2, 'a da comunidade, com os dois públicos');
  perform ok((select count(*) from newsletter_envios e join comunidade_inscritos c on c.id = e.comunidade_id
               where e.newsletter_id = (r->>'id')::uuid and c.email = 'pendente@exemplo.test') = 0, 'só para inscrição confirmada');

  select count(*) into n_ed from newsletters;
  perform public.newsletter_lote(10);
  perform public.newsletter_lote(10);
  perform ok((select count(*) from newsletters) = n_ed, 'a fila não cria edição com o que já foi distribuído (repetir não duplica)');
  perform ok(jsonb_array_length(public.newsletter_lote(500)) >= 2, 'a fila entrega os envios das edições');
  perform ok(public.newsletter_decidir(v, 1, true)->>'status' = 'descontinuado', 'a votação acabou');
  perform eu(11, 'leitura');
  perform ok(public.newsletter_enviar_agora('semanal')->>'status' = 'sem_permissao', 'membro não manda edição');
end $$;

-- inscrição pública (anônimo)
set role anon;
do $$ declare r jsonb; begin
  raise notice 'Inscrição pública';
  perform ok(public.comunidade_inscrever('sem arroba', 'X', true)->>'status' = 'email_invalido', 'e-mail inválido');
  perform ok(public.comunidade_inscrever('nova@exemplo.test', 'Nova', false)->>'status' = 'consentimento', 'pede o consentimento');
  perform ok(public.comunidade_inscrever('Nova@Exemplo.test', 'Nova Leitora', true)->>'status' = 'ok', 'inscreve');
  perform ok(public.comunidade_inscrever('leitora@exemplo.test', 'Leitora', true)->>'status' = 'ok', 'quem já está inscrito recebe a mesma resposta');
  perform ok(public.comunidade_inscrever('nova@exemplo.test', 'Nova Leitora', true)->>'status' = 'ok', 'pedir de novo em seguida também');
end $$;
reset role;
do $$ declare v_tok uuid; v_unsub uuid; begin
  perform ok((select count(*) from comunidade_envios where email = 'nova@exemplo.test') = 1, 'uma confirmação só (sem repetir em 10 minutos)');
  perform ok(not exists (select 1 from comunidade_envios where email = 'leitora@exemplo.test'), 'e nenhuma para quem já estava inscrito');
  select token into v_tok from comunidade_envios where email = 'nova@exemplo.test';
  perform ok((select confirmado_em is null from comunidade_inscritos where email = 'nova@exemplo.test'), 'sem confirmar, não recebe');
  perform set_config('teste.tok', v_tok::text, false);
  select token into v_unsub from comunidade_inscritos where email = 'leitora@exemplo.test';
  perform set_config('teste.unsub', v_unsub::text, false);
end $$;
set role anon;
do $$ begin
  perform ok(public.comunidade_confirmar(current_setting('teste.tok')::uuid)->>'status' = 'ok', 'confirma pelo link');
  perform ok(public.comunidade_confirmar(current_setting('teste.tok')::uuid)->>'status' = 'invalido', 'o link vale uma vez');
  perform public.comunidade_descadastrar(current_setting('teste.unsub')::uuid);
end $$;
reset role;
update comunidade_inscritos set confirmacao_pedida = now() - interval '1 hour' where email = 'leitora@exemplo.test';
set role anon;
select ok(public.comunidade_inscrever('leitora@exemplo.test', 'Leitora', true)->>'status' = 'ok', 'quem saiu pode pedir para voltar');
reset role;
do $$ begin
  perform ok((select confirmado_em is not null from comunidade_inscritos where email = 'nova@exemplo.test'), 'a nova está confirmada');
  perform ok((select descadastrado_em is not null from comunidade_inscritos where email = 'leitora@exemplo.test')
             and exists (select 1 from comunidade_envios where email = 'leitora@exemplo.test'),
    'quem saiu só volta depois de confirmar de novo');
end $$;
set role authenticated;
do $$ begin
  begin
    perform public.comunidade_envios_lote(10);
    raise exception 'FALHOU: fila de confirmação chamável';
  exception when insufficient_privilege then perform ok(true, 'a fila de confirmação é só da Edge Function');
  end;
end $$;
reset role;
\echo 'Tudo certo.'
