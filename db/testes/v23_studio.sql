\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 23.0 — o Studio.
-- Rode num banco com o esqueleto, a 15.0 a 19.0 e a 23.0 (a 20.0 a
-- 22.0 podem estar ou não: o Studio não depende delas).
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function pub(p_codigo text) returns uuid language sql as $$
  select id from studio_publicacoes where codigo = p_codigo $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
-- amanhã, às HH:MI de Brasília
create or replace function amanha(p_hora text) returns timestamptz language sql as $$
  select (((now() at time zone 'America/Sao_Paulo')::date + 1) + p_hora::time) at time zone 'America/Sao_Paulo' $$;
create or replace function avisos(p_reg integer, p_tipo text) returns integer language sql as $$
  select count(*)::integer from notificacoes where registro = p_reg and tipo = p_tipo $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    Sinais — fora do Studio
--   17 Carla    Órtese — vai para o grupo que aprova
--   23 Diego    Comunicação — entra no Studio pela semente
--   31 Elis     Depto de Pessoal (papel pessoal)
--   52 Gabi     Design, subgrupo de Comunicação
-- ------------------------------------------------------------
insert into membros(registro, nome, grupos, status, email_nro) values
  (52, 'Gabi Rocha', '{Design}', 'Ativo', 'gabi@nro.dev')
on conflict do nothing;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52)
on conflict do nothing;

do $$ begin
  perform eu(4, 'admin');
  perform grupo_salvar(jsonb_build_object('nome','Design','prefixo','DES'));
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('Design'), 'pai_id', gid('Comunicação')));
  perform grupo_salvar(jsonb_build_object('nome','Aprovação de conteúdo','prefixo','APC'));
end $$;
update membros set grupos = grupos || '{"Aprovação de conteúdo"}'::text[] where registro = 17;

-- 1. a configuração e quem entra
do $$ begin
  perform ok((select grupos_acesso from studio_config) = array[gid('Comunicação')],
             'a semente pôs o grupo de Comunicação no acesso');
  perform ok((select grupos_aprovadores from studio_config) = '{}', 'e deixou os aprovadores para a gestão escolher');
  perform eu(23, 'leitura');  perform ok(studio_pode_acessar(), 'Diego, da Comunicação, entra no Studio');
  perform ok(not studio_pode_aprovar(), 'mas não aprova');
  perform eu(52, 'leitura');  perform ok(studio_pode_acessar(), 'Gabi entra por Design, que fica dentro de Comunicação');
  perform eu(11, 'leitura');  perform ok(not studio_pode_acessar(), 'Bruno, de Sinais, não entra');
  perform eu(17, 'leitura');  perform ok(not studio_pode_acessar(), 'Carla ainda não entra');
  perform eu(31, 'pessoal');  perform ok(not studio_pode_acessar(), 'nem o papel pessoal, por si só');
  perform eu(4, 'admin');     perform ok(studio_pode_acessar() and studio_pode_aprovar(), 'admin entra e aprova');
  perform ok(studio_aprovadores() = array[4], 'sem grupo aprovador, quem aprova (e é avisado) é admin');
end $$;

-- 2. a publicação: nasce ideia, ganha arte, vira produção
do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','Furo'));
  perform ok(r->>'status' = 'sem_permissao', 'quem não entra no Studio não cria publicação');
  perform eu(23, 'leitura');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','   '));
  perform ok(r->>'status' = 'invalido', 'título vazio não passa');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','Aniversário da Ana', 'categoria','aniversario',
         'pilar','conectar', 'redes', jsonb_build_array('instagram'), 'formato','stories', 'status','pronta'));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'POST-1' and r->>'situacao' = 'ideia',
             'Diego cria POST-1 como ideia, sem data (pedir "pronta" na criação não adianta)');
  perform ok((select responsavel from studio_publicacoes where id = pub('POST-1')) = 23, 'quem cria responde por ela');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','x', 'pilar','vender'));
  perform ok(r->>'status' = 'invalido', 'pilar fora da lista não passa');
  r := studio_publicacao_salvar(jsonb_build_object('id', pub('POST-1'),
         'peca', jsonb_build_object('modelo','aniversario','laminas', jsonb_build_array()),
         'imagens', jsonb_build_array(jsonb_build_object('caminho', pub('POST-1')::text || '/v1-01.jpg')),
         'data_publicacao', amanha('18:00'), 'legenda', 'Parabéns, Ana! 🎉', 'colaboradores', '@labbio.ufmg'));
  perform ok(r->>'situacao' = 'producao' and (r->>'versao')::int = 2,
             'a ideia que ganha arte passa para produção, na versão 2');
  perform ok((select count(*) from studio_historico where publicacao_id = pub('POST-1')) >= 3,
             'e cada passo ficou no histórico (criou, moveu, agendou, versão)');
end $$;

-- 3. pronta só pela aprovação
do $$ declare r jsonb; pegou boolean := false; begin
  perform eu(23, 'leitura');
  r := studio_mover(pub('POST-1'), 'pronta');
  perform ok(r->>'status' = 'precisa_aprovacao', 'mover para "pronta" sem aprovação é recusado');
  r := studio_mover(pub('POST-1'), 'publicada');
  perform ok(r->>'status' = 'precisa_aprovacao', 'e para "publicada" também');
  begin
    update studio_publicacoes set status = 'pronta' where id = pub('POST-1');
  exception when others then pegou := sqlerrm = 'studio_sem_aprovacao'; end;
  perform ok(pegou, 'nem com update direto no banco: o gatilho segura');
end $$;

-- 4. mandar para aprovação avisa quem aprova
do $$ declare r jsonb; begin
  perform eu(4, 'admin');
  update studio_config set grupos_aprovadores = array[gid('Aprovação de conteúdo')];
  perform ok((select atualizado_por from studio_config) = 'Ana Figueiredo', 'admin escolhe o grupo aprovador, e fica o carimbo');
  perform eu(17, 'leitura');
  perform ok(studio_pode_aprovar() and studio_pode_acessar(), 'Carla, do grupo aprovador, aprova e entra');
  perform ok(studio_aprovadores() = array[17], 'e é ela quem é avisada');
  perform eu(23, 'leitura');
  r := studio_mover(pub('POST-1'), 'aprovacao');
  perform ok(r->>'situacao' = 'aprovacao', 'Diego manda POST-1 para aprovação');
  perform ok(avisos(17, 'studio_aprovacao') = 1, 'Carla recebe o aviso');
  perform ok(avisos(23, 'studio_aprovacao') = 0, 'Diego, que agiu, não');
end $$;

-- 5. decidir: não é de quem mandou, devolver pede o porquê
do $$ declare r jsonb; begin
  perform eu(23, 'leitura');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','aprovar'));
  perform ok(r->>'status' = 'sem_permissao', 'Diego não aprova');
  perform eu(17, 'leitura');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','devolver'));
  perform ok(r->>'status' = 'invalido', 'devolver sem parecer não passa');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','devolver', 'parecer','Falta o crédito da foto.'));
  perform ok(r->>'situacao' = 'producao', 'Carla devolve, e a publicação volta para produção');
  perform ok(avisos(23, 'studio_decisao') = 1, 'Diego é avisado da devolução');
  perform ok(exists (select 1 from studio_historico where publicacao_id = pub('POST-1') and acao = 'devolveu'
                       and detalhe = 'Falta o crédito da foto.'), 'e o parecer fica no histórico');
  perform eu(23, 'leitura');
  perform studio_mover(pub('POST-1'), 'aprovacao');
  perform eu(17, 'leitura');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','aprovar', 'parecer','Ok!'));
  perform ok(r->>'situacao' = 'pronta', 'Carla aprova, e POST-1 fica pronta para publicar');
  perform ok(avisos(23, 'studio_decisao') = 2, 'Diego é avisado de que está pronta');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','aprovar'));
  perform ok(r->>'status' = 'fora_de_aprovacao', 'aprovar de novo o que já está pronto não faz nada');
end $$;

-- 6. mexer depois de aprovada devolve para aprovação
do $$ declare r jsonb; begin
  perform eu(52, 'leitura');
  r := studio_publicacao_salvar(jsonb_build_object('id', pub('POST-1'), 'legenda', 'Parabéns, Ana! (com o crédito)'));
  perform ok(r->>'situacao' = 'aprovacao' and (r->>'versao')::int = 3,
             'Gabi muda a legenda de uma publicação pronta: versão 3, de volta à aprovação');
  perform ok((select enviado_por from studio_publicacoes where id = pub('POST-1')) = 52,
             'e quem mexeu passa a ser quem mandou para aprovação');
  perform ok(avisos(17, 'studio_aprovacao') = 3, 'Carla é avisada de que mudou depois de aprovada');
  r := studio_publicacao_salvar(jsonb_build_object('id', pub('POST-1'), 'notas', 'Convidar @labbio como collab'));
  perform ok((r->>'versao')::int = 3, 'nota para quem publica não é arte nem legenda: não muda a versão');
  perform eu(52, 'leitura');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','aprovar'));
  perform ok(r->>'status' = 'sem_permissao', 'Gabi não aprova a própria mudança (nem teria como: não é aprovadora)');
  perform eu(17, 'leitura');
  r := studio_decidir(jsonb_build_object('id', pub('POST-1'), 'decisao','aprovar'));
  perform ok(r->>'situacao' = 'pronta', 'Carla aprova a versão 3');
end $$;

-- 7. quem mandou não aprova, e o mínimo de aprovações
do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','Artigo publicado na JNER', 'status','producao'));
  perform ok(r->>'codigo' = 'POST-2' and r->>'situacao' = 'producao', 'Carla cria POST-2 já em produção');
  perform studio_mover(pub('POST-2'), 'aprovacao');
  r := studio_decidir(jsonb_build_object('id', pub('POST-2'), 'decisao','aprovar'));
  perform ok(r->>'status' = 'propria', 'Carla não aprova o que ela mesma mandou');
  perform eu(4, 'admin');
  update studio_config set aprovacoes_minimas = 2;
  r := studio_decidir(jsonb_build_object('id', pub('POST-2'), 'decisao','aprovar'));
  perform ok(r->>'situacao' = 'aprovacao' and (r->>'faltam')::int = 1, 'com mínimo 2, uma aprovação não basta');
  r := studio_decidir(jsonb_build_object('id', pub('POST-2'), 'decisao','aprovar'));
  perform ok(r->>'status' = 'ja_aprovou', 'e a mesma pessoa não conta duas vezes');
  update studio_config set aprovacoes_minimas = 1;
  r := studio_mover(pub('POST-2'), 'pronta');
  perform ok(r->>'situacao' = 'pronta', 'voltando o mínimo a 1, a aprovação que havia basta para "pronta"');
end $$;

-- 8. publicada
do $$ declare r jsonb; begin
  perform eu(23, 'leitura');
  r := studio_mover(pub('POST-2'), 'publicada', 'https://instagram.com/p/xyz');
  perform ok(r->>'situacao' = 'publicada', 'POST-2, pronta, vai para publicada');
  perform ok((select link from studio_publicacoes where id = pub('POST-2')) = 'https://instagram.com/p/xyz'
             and (select publicado_em from studio_publicacoes where id = pub('POST-2')) is not null,
             'com o link e a hora');
end $$;

-- 9. o lembrete da véspera
do $$ declare n integer; r jsonb; begin
  perform eu(23, 'leitura');     -- quem abre a tela é o próprio responsável
  n := studio_lembretes();
  perform ok(n = 1, 'POST-1 é amanhã: um lembrete');
  perform ok(avisos(23, 'studio_lembrete') = 1,
             'Diego, o responsável, recebe — mesmo sendo quem abriu a tela');
  perform ok((select titulo from notificacoes where registro = 23 and tipo = 'studio_lembrete')
             like 'Amanhã: POST-1 · Aniversário da Ana — instagram às 18:00', 'com o que, onde e a hora');
  perform ok((select corpo from notificacoes where registro = 23 and tipo = 'studio_lembrete') like '%collab: @labbio.ufmg%',
             'e o lembrete de convidar a conta de collab');
  n := studio_lembretes();
  perform ok(n = 0, 'rodar de novo não repete');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','Na mídia: Jornal Nacional', 'status','producao',
         'data_publicacao', amanha('10:00')));
  perform studio_mover(pub('POST-3'), 'aprovacao');
  n := studio_lembretes();
  perform ok(n = 1 and avisos(17, 'studio_lembrete') = 1,
             'em aprovação na véspera: quem aprova também é lembrado');
  perform studio_publicacao_salvar(jsonb_build_object('id', pub('POST-3'), 'data_publicacao', amanha('10:00') + interval '1 day'));
  perform ok((select lembrete_em from studio_publicacoes where id = pub('POST-3')) is null, 'mudar a data zera o lembrete');
  perform eu(4, 'admin');
  update studio_config set lembrete_email = false;
  perform studio_publicacao_salvar(jsonb_build_object('id', pub('POST-3'), 'data_publicacao', amanha('11:00')));
  perform ok(studio_lembretes() = 0, 'com o lembrete desligado nas configurações, nada sai');
  update studio_config set lembrete_email = true;
  perform ok(studio_lembretes() = 1, 'religado, sai');
end $$;

-- 10. o lembrete fura a preferência de e-mail; o resto não
do $$ declare lote jsonb; itens jsonb; begin
  insert into notificacao_preferencias (registro, email_modo) values (23, 'nunca')
  on conflict (registro) do update set email_modo = 'nunca';
  lote := notificacoes_email_lote(200);
  select p->'itens' into itens from jsonb_array_elements(lote) p where (p->>'registro')::int = 23;
  perform ok(itens is not null and (select count(*) from jsonb_array_elements(itens) i where i->>'tipo' = 'studio_lembrete')
               = avisos(23, 'studio_lembrete'),
             'Diego escolheu "só no portal", e o lembrete da véspera sai por e-mail mesmo assim');
  perform ok((select count(*) from jsonb_array_elements(itens) i where i->>'tipo' <> 'studio_lembrete') = 0,
             'o resto dos avisos dele, não');
end $$;

-- 11. excluir
do $$ declare r jsonb; begin
  perform eu(23, 'leitura');
  r := studio_publicacao_salvar(jsonb_build_object('titulo','Ideia solta: vídeo de bancada'));
  perform eu(52, 'leitura');
  r := studio_excluir(pub('POST-4'));
  perform ok(r->>'status' = 'sem_permissao', 'Gabi não apaga a ideia do Diego');
  perform eu(23, 'leitura');
  r := studio_excluir(pub('POST-4'));
  perform ok(r->>'status' = 'ok' and pub('POST-4') is null, 'Diego apaga a própria ideia');
  perform ok(not exists (select 1 from studio_historico h where not exists
               (select 1 from studio_publicacoes p where p.id = h.publicacao_id)), 'e o histórico dela vai junto');
end $$;

-- (por último, porque a inserção recusada gasta um número da sequência)
do $$ declare pegou boolean := false; begin
  begin
    insert into studio_publicacoes (titulo, status) values ('Furo', 'pronta');
  exception when others then pegou := sqlerrm = 'studio_status_inicial'; end;
  perform ok(pegou, 'publicação não nasce pronta, nem por insert direto no banco');
end $$;

-- 12. RLS, como no Supabase: o papel authenticated tem grant em tudo,
--     e o que segura é a política
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant usage, select on all sequences in schema public to authenticated;
set role authenticated;
do $$ declare n integer; pegou boolean := false; begin
  perform eu(11, 'leitura');
  select count(*) into n from studio_publicacoes;
  perform ok(n = 0, 'Bruno não lê publicação nenhuma');
  select count(*) into n from studio_recursos;
  perform ok(n = 0, 'nem recurso');
  perform eu(23, 'leitura');
  select count(*) into n from studio_publicacoes;
  perform ok(n = 3, 'Diego lê as três');
  update studio_publicacoes set status = 'pronta' where id = pub('POST-3');
  get diagnostics n = row_count;
  perform ok(n = 0, 'e escrever direto na tabela não pega: a escrita é pelas funções');
  insert into studio_recursos (titulo, tipo, url, criado_por)
  values ('Fotos do Cybathlon 2024', 'album', 'https://photos.app.goo.gl/abc', 23);
  perform ok(true, 'Diego cadastra um álbum compartilhado');
  begin
    insert into studio_recursos (titulo, tipo, url, criado_por) values ('x', 'pasta', 'https://x.dev', 17);
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'mas não em nome de outra pessoa');
  perform eu(52, 'leitura');
  delete from studio_recursos where titulo = 'Fotos do Cybathlon 2024';
  get diagnostics n = row_count;
  perform ok(n = 0, 'Gabi não apaga o recurso do Diego');
  perform eu(17, 'leitura');
  update studio_recursos set descricao = 'Fotos de competição' where titulo = 'Fotos do Cybathlon 2024';
  get diagnostics n = row_count;
  perform ok(n = 1, 'quem aprova (gestão do Studio) edita qualquer recurso');
  perform eu(23, 'leitura');
  update studio_config set grupos_acesso = '{}';
  get diagnostics n = row_count;
  perform ok(n = 0, 'Diego não mexe na configuração');
  perform ok((select cardinality(grupos_acesso) from studio_config) = 1, 'e ela continua como estava');
  -- imprensa
  pegou := false;
  begin
    insert into site_imprensa (tipo, veiculo, youtube) values ('video', 'Furo', 'AAAAAAAAAAA');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'Diego não publica na imprensa do site');
  perform eu(17, 'leitura');
  insert into site_imprensa (tipo, veiculo, ano, youtube, ordem) values ('video', 'TV UFMG', '2026', 'dQw4w9WgXcQ', 5);
  perform ok(true, 'Carla, da gestão do Studio, acrescenta um vídeo');
  perform eu(31, 'pessoal');
  update site_imprensa set publicado = false where veiculo = 'CNN';
  get diagnostics n = row_count;
  perform ok(n = 1, 'o Depto. de Pessoal também edita, como no painel do site');
  -- storage
  perform eu(23, 'leitura');
  insert into storage.objects (bucket_id, name) values ('studio', pub('POST-1')::text || '/v3-01.jpg');
  perform ok(true, 'Diego sobe a arte para o bucket do Studio');
  perform eu(11, 'leitura');
  select count(*) into n from storage.objects where bucket_id = 'studio';
  perform ok(n = 0, 'Bruno não enxerga o bucket');
  pegou := false;
  begin
    insert into storage.objects (bucket_id, name) values ('studio', 'furo.jpg');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem sobe nada nele');
end $$;
reset role;

set role anon;
do $$ declare r jsonb; pegou boolean := false; begin
  r := site_imprensa_publico();
  perform ok(jsonb_array_length(r->'videos') = 6 and r->'videos'->0->>'veiculo' = 'TV UFMG',
             'o site, sem login, lê os vídeos publicados na ordem (o novo primeiro, a CNN fora)');
  perform ok(jsonb_array_length(r->'materias') = 3, 'e as três matérias');
  perform ok(not (r->'videos'->0 ? 'titulo'), 'vídeo sem título não manda título vazio');
  begin
    perform 1 from site_imprensa limit 1;
    perform ok((select count(*) from site_imprensa) = 0, 'anon não lê a tabela direto');
  exception when insufficient_privilege then perform ok(true, 'anon não lê a tabela direto'); end;
end $$;
reset role;

do $$ declare pegou boolean := false; begin
  begin
    insert into site_imprensa (tipo, veiculo) values ('video', 'Sem vídeo');
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'vídeo sem id do YouTube nem arquivo não entra');
  pegou := false;
  begin
    insert into site_imprensa (tipo, veiculo, youtube) values ('video', 'Id errado', 'https://youtu.be/x');
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'e o id é só o id, não a URL');
end $$;

-- 13. rodar de novo não duplica nada — e a 16.0 e a 18.0, rodadas de
--     novo, não tiram o lembrete do e-mail
\ir ../v23_studio.sql
\ir ../v18_teste_email.sql
\ir ../v16_pessoal.sql
do $$ begin
  perform ok((select count(*) from site_imprensa) = 10, 'a imprensa não ganhou cópia da carga inicial');
  perform ok((select grupos_aprovadores from studio_config) = array[gid('Aprovação de conteúdo')],
             'a configuração continua a que a gestão escolheu');
  perform ok((select count(*) from migracoes where id = 'v23_studio') = 1, 'a migração registrada uma vez só');
  perform ok(pg_get_functiondef('public.notificacoes_email_lote(integer)'::regprocedure) like '%studio_lembrete%',
             'depois de rodar a 18.0 e a 16.0 de novo, o lote ainda deixa passar o lembrete');
  perform ok(pg_get_functiondef('public.notificacoes_email_lote(integer)'::regprocedure) like '%teste_email%',
             'e o e-mail de teste');
end $$;

\echo 'v23_studio: tudo certo'
