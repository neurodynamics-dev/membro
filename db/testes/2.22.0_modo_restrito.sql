\set ON_ERROR_STOP on
\pset pager off
set check_function_bodies = off;
-- ============================================================
-- Teste da 2.22.0, o modo restrito (Desligado e Egresso).
-- Rode depois da cadeia da 2.18.0 ao feed (ver db/LEIAME.md):
--   bash testes/preparar-base.sh teste t2220 2.18.0_soma.sql 2.19.0.sql \
--        2.19.1_labbio.sql 2.19.1_reporte.sql 2.19.1_feed.sql 2.22.0_modo_restrito.sql
-- O teste aplica a 2.20.0, confere que quem saiu não pede nada, aplica
-- a 2.22.0 (duas vezes), percorre o pedido de uma egressa e, no fim,
-- roda a 2.20.0 e a 2.22.0 de novo.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), false);
  perform set_config('teste.papel', p_papel, false);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false);
end $$;
-- os ajudantes leem como dono: o teste roda como authenticated
create or replace function conta(p_sql text) returns integer language plpgsql security definer as $$
declare n integer; begin execute 'select count(*)::integer from (' || p_sql || ') q' into n; return n; end $$;
create or replace function st(j jsonb) returns text language sql as $$ select j->>'status' $$;
create or replace function kw(p_doc text) returns text language sql as $$
  select 'nro-aacc ; documento = ' || p_doc || ' ; modo = final ; pendencias = 0 ; folha = 2 ; principal = EQC'
         || ' ; creditos = 16 ; principalcreditos = 15 ; semestres = 5 ; itens = 1 ; exemplo = nao' $$;
create or replace function enviar(p_id uuid, p_cam text, p_kw text) returns jsonb language sql as $$
  select aacc_enviar(jsonb_build_object('id', p_id, 'caminho', p_cam, 'sha256', repeat('ab', 32),
                                        'paginas', 40, 'bytes', 123456, 'keywords', p_kw)) $$;
create or replace function subir(p_bucket text, p_cam text) returns void language sql as $$
  insert into storage.objects (bucket_id, name) values (p_bucket, p_cam) $$;
-- uma função interna (sem grant) chamada como dono, na conta do teste
create or replace function como_dono_registro() returns integer language sql security definer as $$
  select public.aacc_registro_atual() $$;

-- ------------------------------------------------------------
-- A equipe do teste (a da 2.18.0) e o que a 2.20.0 precisa:
--   11 Bruno    NRO_PMO              aprova a 1ª etapa
--   17 Carla    ativa
--   23 Diego    NRO_COORD_OFFICE     aprova a 3ª
--   40 Fábio    NRO_PESSOAL          aprova a 2ª
--   44 Jonas    Desligado, ainda com NRO_PESSOAL na ficha e conta "pessoal"
--   45 Kátia    Egresso: pede
--   46 Lia      Sob demanda: segue bloqueada
-- ------------------------------------------------------------
alter table membros add column if not exists data_ingresso date;
alter table membros add column if not exists data_desligamento date;
alter table membros add column if not exists telefone text;
alter table membros add column if not exists email_pessoal text;
alter table dados_pessoais add column if not exists cpf text;
alter table dados_pessoais add column if not exists data_nascimento date;
do $$ declare c text; begin
  foreach c in array array['genero','endereco','cidade_origem','instituicao','curso','matricula','periodo_ingresso',
    'tempo_deslocamento','autodeclaracao_racial','situacao_fump','acessibilidade','lattes','instagram','github'] loop
    execute format('alter table dados_pessoais add column if not exists %I text', c);
  end loop;
end $$;
update membros set grupos = grupos || '{NRO_PMO}' where registro = 11 and not grupos @> '{NRO_PMO}';
update membros set grupos = grupos || '{NRO_COORD_OFFICE}' where registro = 23 and not grupos @> '{NRO_COORD_OFFICE}';
update membros set data_ingresso = '2023-03-01', data_desligamento = '2025-12-20', email_pessoal = 'katia@exemplo.com',
                   telefone = '31977776666' where registro = 45;
update membros set email_pessoal = 'lia@exemplo.com' where registro = 46;

\ir ../2.20.0_aproveitamento.sql
create or replace function ped(p_reg integer) returns aacc_pedidos language sql security definer as $$
  select * from aacc_pedidos where registro = p_reg order by criado_em desc, numero desc limit 1 $$;

-- o que o início lê: avisos e links dentro e fora do prazo
insert into portal_avisos (titulo, publicado, data_fim) values ('Aviso vencido', true, current_date - 3);
insert into portal_avisos (titulo, publicado, data_inicio) values ('Aviso futuro', true, current_date + 3);
insert into portal_avisos (titulo, publicado, ordem) values ('Inscrições abertas', true, 1);
insert into portal_links (titulo, url, ordem, ativo) values ('Link desativado', 'https://exemplo.com', 1, false);
-- a agenda: um evento da equipe (com link e pauta), um fechado, um marco
-- da equipe, um marco pessoal e a ausência de uma pessoa ativa
insert into eventos (titulo, data, hora_inicio, hora_fim, visibilidade, meet_url, pauta, owner_registro) values
  ('Reunião geral', current_date, '18:00', '19:00', 'equipe', 'https://meet.google.com/abc-defg-hij', 'Orçamento do semestre', 4),
  ('Banca fechada', current_date, '10:00', '11:00', 'convidados', null, null, 4);
insert into calendario_itens (titulo, tipo, data_inicio, registro) values
  ('Recesso', 'feriado', current_date, null), ('Prova da Carla', 'prazo', current_date, 17);
insert into agenda_ausencias (registro, tipo, inicio, fim) values (17, 'ausente', now(), now() + interval '2 hours');
-- o feed: uma notícia do site com imagem e um tópico só da equipe
insert into feed_itens (autor, titulo, subtitulo, tipo, estado, publico, publicado_em, slug, imagens) values
  (4, 'Cybathlon no site', 'A equipe na competição', 'noticia', 'publicado', true, now(), 'cybathlon-no-site',
   '[{"path": "11111111-1111-1111-1111-111111111111/a.jpg", "publico_path": "11111111-1111-1111-1111-111111111111/1.jpg"}]'),
  (4, 'Só para a equipe', 'A pauta interna', 'topico', 'publicado', false, now(), null,
   '[{"path": "22222222-2222-2222-2222-222222222222/b.jpg"}]');
insert into storage.buckets (id, name, public) values ('feed', 'feed', false) on conflict (id) do nothing;
insert into storage.objects (bucket_id, name) values
  ('feed', '11111111-1111-1111-1111-111111111111/a.jpg'), ('feed', '22222222-2222-2222-2222-222222222222/b.jpg');
grant select, insert, update, delete on all tables in schema public to authenticated, anon;

-- ------------------------------------------------------------
-- 1. antes da 2.22.0: quem saiu não pede nada
-- ------------------------------------------------------------
set role authenticated;
do $$ begin
  perform eu(45, 'leitura');
  perform ok(not public.conta_ativa(), 'a Kátia, egressa, tem a conta bloqueada (2.18.0)');
  perform ok(st(aacc_meu()) = 'sem_registro', 'e, só com a 2.20.0, o aproveitamento não a reconhece');
end $$;
reset role;

\ir ../2.22.0_modo_restrito.sql
\ir ../2.22.0_modo_restrito.sql

-- ------------------------------------------------------------
-- 2. quem é a conta restrita
-- ------------------------------------------------------------
set role authenticated;
do $$ declare n integer; begin
  perform eu(45, 'leitura');
  perform ok(public.conta_restrita() and not public.conta_ativa(), 'a Kátia está no modo restrito, e a conta segue bloqueada');
  perform ok(public.portal_registro_atual() is null and public.papel_atual() = 'nenhum',
             'para o resto do banco, ela continua sem registro e sem papel');
  perform ok(como_dono_registro() = 45, 'só o aproveitamento a reconhece pelo registro');
  select count(*) into n from membros;
  perform ok(n = 0, 'as tabelas continuam fechadas: membros não se lê');
  select count(*) into n from portal_avisos;
  perform ok(n = 0, 'nem o quadro de avisos direto');
  perform eu(44, 'pessoal');
  perform ok(public.conta_restrita() and como_dono_registro() = 44, 'o Jonas, desligado, também');
  perform eu(46, 'leitura');
  perform ok(not public.conta_restrita() and como_dono_registro() is null, 'a Lia, sob demanda, não');
  perform eu(17, 'leitura');
  perform ok(not public.conta_restrita() and como_dono_registro() = 17, 'a Carla, ativa, não é restrita e tem o registro de sempre');
end $$;

-- ------------------------------------------------------------
-- 3. o início
-- ------------------------------------------------------------
do $$ declare r jsonb; it record; n integer; begin
  perform eu(45, 'leitura');
  r := inicio_restrito();
  perform ok(st(r) = 'ok' and r#>>'{eu,nome}' = 'Kátia Dias' and (r#>>'{eu,registro}')::int = 45
             and r#>>'{eu,status}' = 'Egresso' and r#>>'{eu,email}' = 'katia@nro.dev', 'o início sabe quem ela é');
  perform ok((select array_agg(a->>'titulo' order by a->>'titulo') from jsonb_array_elements(r->'avisos') a)
             = array['Aviso antigo','Inscrições abertas'], 'os avisos publicados e no prazo, nenhum vencido nem futuro');
  perform ok(r#>>'{avisos,0,titulo}' = 'Inscrições abertas', 'na ordem do quadro');
  perform ok(not (r->'avisos'->0 ? 'criado_por'), 'sem quem escreveu');
  perform ok(jsonb_array_length(r->'links') = 4 and not exists (select 1 from jsonb_array_elements(r->'links') l
             where l->>'titulo' = 'Link desativado'), 'os links úteis ativos');
  perform eu(46, 'leitura');
  perform ok(st(inicio_restrito()) = 'nao_restrita', 'a Lia não lê o início restrito');
  perform eu(17, 'leitura');
  perform ok(st(inicio_restrito()) = 'nao_restrita', 'nem a Carla, que lê o portal inteiro');

  -- o calendário
  perform eu(45, 'leitura');
  select count(*) filter (where origem = 'evento') as ev, count(*) filter (where origem = 'marco') as mk,
         count(*) filter (where origem = 'ausencia') as au, count(*) filter (where meet_url is not null or pauta is not null) as lk,
         bool_and(titulo <> 'Banca fechada' and titulo <> 'Prova da Carla') as fora
    into it from agenda_itens(current_date, current_date);
  perform ok(it.ev = 1 and it.mk = 1, 'a Kátia vê o evento aberto à equipe e o marco da equipe');
  perform ok(it.au = 0, 'sem a ausência de ninguém');
  perform ok(it.lk = 0, 'sem o link da reunião nem a pauta');
  perform ok(it.fora, 'nem o evento fechado nem o marco pessoal de outra pessoa');
  perform eu(46, 'leitura');
  select count(*) into n from agenda_itens(current_date, current_date);
  perform ok(n = 0, 'a Lia, bloqueada, não lê o calendário');
  perform eu(17, 'leitura');
  select count(*) into n from agenda_itens(current_date, current_date) where origem = 'ausencia' or meet_url is not null;
  perform ok(n >= 2, 'a Carla lê como sempre: a ausência e o link da reunião');

  -- as publicações
  perform eu(45, 'leitura');
  r := feed_lista(null, 50, null, null);
  perform ok(exists (select 1 from jsonb_array_elements(r) f where f->>'titulo' = 'Cybathlon no site')
             and not exists (select 1 from jsonb_array_elements(r) f where not (f->>'publico')::boolean),
             'a Kátia lê as publicações do site, e só elas');
  select count(*) into n from storage.objects where bucket_id = 'feed';
  perform ok(n = 1 and exists (select 1 from storage.objects where name = '11111111-1111-1111-1111-111111111111/a.jpg'),
             'e a imagem da publicação do site, não a da equipe');
  perform eu(46, 'leitura');
  perform ok(jsonb_array_length(feed_lista(null, 50, null, null)) = 0, 'a Lia não lê o feed');
  select count(*) into n from storage.objects where bucket_id = 'feed';
  perform ok(n = 0, 'nem as imagens');
  perform eu(17, 'leitura');
  r := feed_lista(null, 50, null, null);
  perform ok(exists (select 1 from jsonb_array_elements(r) f where f->>'titulo' = 'Só para a equipe'), 'a Carla lê o feed inteiro');
end $$;

-- ------------------------------------------------------------
-- 4. o pedido da egressa, de ponta a ponta até a primeira aprovação
-- ------------------------------------------------------------
do $$ declare r jsonb; p aacc_pedidos; cam text; doc text; n integer; pegou text; begin
  perform eu(45, 'leitura');
  r := aacc_meu();
  perform ok(st(r) = 'ok' and r#>>'{membro,situacao}' = 'egresso' and r#>>'{membro,fim}' = '2025-12-20',
             'a Kátia abre o aproveitamento, como egressa, com a data de saída');
  perform ok(not (r->>'aprovador')::boolean and not (r->>'gere')::boolean, 'sem nada de quem aprova ou gere');
  perform ok(r->'bloqueios' ? 'recadastro', 'a ficha ainda está incompleta');
  r := aacc_perfil_salvar('{"cpf":"52998224725","data_nascimento":"2000-02-02","endereco":"Rua C, 10","cidade_origem":"Betim",
    "instituicao":"UFMG","curso":"Engenharia Elétrica","matricula":"2020000222","periodo_ingresso":"2020/1","genero":"F",
    "pronomes":"ela","autodeclaracao_racial":"Parda"}');
  perform ok(st(r) = 'ok' and (r->>'campos')::int = 11, 'e completa a ficha ela mesma');
  r := aacc_meu();
  perform ok(jsonb_array_length(r->'bloqueios') = 0, 'sem bloqueio nenhum');
  r := aacc_preparar('{"principal":"EQC"}');
  perform ok(st(r) = 'ok', 'prepara o pedido');
  p := ped(45);
  perform ok(p.nome = 'Kátia Dias' and p.status = 'preparacao', 'que nasce no nome dela');
  perform ok(conta(format('select 1 from aacc_historico where pedido_id = %L and nome = ''Kátia Dias'' and registro = 45', p.id)) = 1,
             'o histórico diz o nome dela, não o e-mail');
  doc := (aacc_meu()#>>'{serie,codigo}') || '-' || p.numero;
  cam := '45/' || p.id || '/v1-45454545.pdf';
  perform subir('aproveitamento', cam);
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 1, 'sobe o PDF na pasta dela e o lê de volta');
  perform ok(st(enviar(p.id, cam, kw(doc))) = 'ok' and (ped(45)).status = 'analise', 'envia: o pedido entra na primeira etapa');
  perform ok(conta('select 1 from doc_envios where registro = 45 and para_email = ''katia@exemplo.com''') = 1,
             'o aviso vai ao e-mail pessoal');
  r := aacc_lista();
  perform ok(jsonb_array_length(r) = 1 and (r->0->>'meu')::boolean and not (r->0->>'posso_decidir')::boolean,
             'a lista dela é o pedido dela, sem decidir nada');
  r := aacc_ler(p.codigo);
  perform ok(st(r) = 'ok' and (r#>>'{pode,cancelar}')::boolean and not (r#>>'{pode,decidir}')::boolean, 'e o pedido inteiro');

  -- o desligado que ainda tem o grupo da 2ª etapa na ficha
  perform eu(44, 'pessoal');
  perform ok(conta('select 1 from aacc_config c join grupos g on g.id = any(c.grupos) where g.nome = ''NRO_PESSOAL''') = 1, 'o Jonas está num grupo de etapa pela ficha');
  r := aacc_meu();
  perform ok(st(r) = 'ok' and not (r->>'aprovador')::boolean and not (r->>'gere')::boolean,
             'mas, desligado, não aprova nem gere, mesmo com a conta "pessoal"');
  perform ok(jsonb_array_length(aacc_lista()) = 0, 'não vê o pedido da Kátia na lista');
  perform ok(st(aacc_ler(p.codigo)) = 'nao_encontrado', 'nem pelo código');
  select count(*) into n from storage.objects where name = cam;
  perform ok(n = 0, 'nem o PDF');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) <> 'ok' and (ped(45)).etapa = 1,
             'e não decide');
  perform ok(aacc_pendentes() = 0, 'nada espera por ele');
  begin perform subir('aproveitamento', '45/' || p.id || '/v9.pdf'); exception when insufficient_privilege then pegou := 'rls'; end;
  perform ok(pegou = 'rls', 'nem sobe PDF na pasta da Kátia');

  -- a correção da ficha, pela solicitação de sempre
  perform eu(45, 'leitura');
  r := aacc_pedir_correcao('A minha saída foi em 20/12/2025.');
  perform ok(st(r) = 'ok' and r->>'protocolo' ~ '^SOL\d{2}-\d{4}$', 'a Kátia pede a correção da ficha, com protocolo');
  perform ok(conta('select 1 from portal_solicitacoes where registro = 45 and tipo = ''outro'' and status = ''aberta''
                    and titulo = ''Correção da entrada ou da saída na ficha'' and dados->>''origem'' = ''aacc''') = 1,
             'que entra como a solicitação de sempre, na fila do Pessoal');
  perform ok(st(aacc_pedir_correcao('De novo')) = 'ja_pedido', 'uma de cada vez');
  perform ok(aacc_pedir_correcao('x')->>'campo' = 'descricao', 'e com o que corrigir');

  -- a Lia, sob demanda
  perform eu(46, 'leitura');
  perform ok(st(aacc_pedir_correcao('A minha saída foi em 2025.')) = 'sem_registro', 'a Lia não abre a correção');
  perform ok(st(aacc_meu()) = 'sem_registro' and st(aacc_preparar('{"principal":"EQC"}')) = 'sem_registro',
             'a Lia, sob demanda, segue de fora do aproveitamento');

  -- quem está na equipe aprova como sempre
  perform eu(11, 'leitura');
  perform ok((aacc_ler(p.codigo)#>>'{pode,decidir}')::boolean, 'o Bruno, do PMO, decide a 1ª etapa');
  perform ok(st(aacc_decidir(jsonb_build_object('id', p.id, 'decisao', 'aprovar'))) = 'ok' and (ped(45)).etapa = 2,
             'e aprova');
  perform eu(40, 'leitura');
  perform ok(aacc_pendentes() = 1, 'o Fábio, ativo no grupo do Pessoal, tem o pedido esperando');

  -- a Kátia cancela; o histórico e a revogação levam o nome dela
  perform eu(45, 'leitura');
  perform ok(st(aacc_cancelar(p.id, 'Vou pedir com o relatório completo')) = 'ok' and (ped(45)).status = 'cancelado',
             'a Kátia cancela');
  perform ok(conta(format('select 1 from aacc_historico where pedido_id = %L and acao = ''cancelou'' and nome = ''Kátia Dias''', p.id)) = 1,
             'e o histórico diz quem');
  perform ok(st(aacc_preparar('{"principal":"VPC"}')) = 'ok' and conta('select 1 from aacc_pedidos where registro = 45') = 2,
             'cancelado, ela pode abrir outro');
end $$;
reset role;

-- ------------------------------------------------------------
-- 5. a troca nas funções, e rodar de novo
-- ------------------------------------------------------------
do $$ begin
  perform ok((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
               and proname = any(array['aacc_meu','aacc_perfil_salvar','aacc_preparar','aacc_enviar','aacc_hist','aacc_pode_ver',
                                       'aacc_reabrir','aacc_cancelar','aacc_lista','aacc_ler','aacc_pode_enviar_objeto'])
               and prosrc like '%aacc_registro_atual()%' and prosrc not like '%portal_registro_atual()%') = 11,
             'as onze funções de quem pede usam aacc_registro_atual()');
  perform ok((select count(*) from pg_proc where pronamespace = 'public'::regnamespace
               and proname = any(array['aacc_decidir','aacc_professor_trocar','aacc_pendentes'])
               and prosrc like '%portal_registro_atual()%' and prosrc not like '%aacc_registro_atual()%') = 3,
             'as de quem aprova, não');
  perform ok(not has_function_privilege('authenticated', 'public.aacc_registro_atual()', 'execute')
             and not has_function_privilege('authenticated', 'public.aacc_meu_nome()', 'execute')
             and has_function_privilege('authenticated', 'public.inicio_restrito()', 'execute')
             and has_function_privilege('authenticated', 'public.conta_restrita()', 'execute')
             and has_function_privilege('authenticated', 'public.aacc_pedir_correcao(text)', 'execute'),
             'o portal chama inicio_restrito() e conta_restrita(), não as internas');
  perform ok(not has_function_privilege('anon', 'public.inicio_restrito()', 'execute')
             and not has_function_privilege('anon', 'public.conta_restrita()', 'execute')
             and not has_function_privilege('anon', 'public.agenda_itens(date,date)', 'execute')
             and not has_function_privilege('anon', 'public.aacc_pedir_correcao(text)', 'execute'),
             'a chave anônima não chega a nada disso');
  perform ok((select count(*) from migracoes where id = '2.22.0_modo_restrito') = 1, 'registrada uma vez');
end $$;

\ir ../2.20.0_aproveitamento.sql
set role authenticated;
do $$ begin
  perform eu(45, 'leitura');
  perform ok(st(aacc_meu()) = 'sem_registro', 'rodar a 2.20.0 de novo desfaz a troca (por isso a 2.22.0 vem depois)');
end $$;
reset role;
\ir ../2.22.0_modo_restrito.sql
set role authenticated;
do $$ begin
  perform eu(45, 'leitura');
  perform ok(st(aacc_meu()) = 'ok' and jsonb_array_length(aacc_lista()) = 2, 'e a 2.22.0 de novo põe tudo no lugar');
  perform eu(44, 'pessoal');
  perform ok(not (aacc_meu()->>'aprovador')::boolean, 'quem saiu continua sem aprovar');
end $$;
reset role;

\echo '2.22.0: todas as asserções passaram'
