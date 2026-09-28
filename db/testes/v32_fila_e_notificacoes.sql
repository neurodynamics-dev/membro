\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 32.0 — a fila que anda sozinha, o sino que não empilha e
-- as notificações no aparelho.
-- Rode num banco com o esqueleto, o de Storage, a 15.0 à 19.0 e o
-- esqueleto do Vault; o teste aplica a 32.0 (duas vezes).
-- O pg_net não existe no PostgreSQL puro: o teste monta um net.http_post
-- de mentira, que só anota o que seria enviado.
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
end $$;

\ir ../v32_fila_e_notificacoes.sql
-- de novo: nada se duplica, a senha não muda
create temp table senha_antes as select decrypted_secret as s from vault.decrypted_secrets where name = 'soma_fila_token';
\ir ../v32_fila_e_notificacoes.sql

do $$ begin
  raise notice 'A migração';
  perform ok((select count(*) from fila_estado) = 1, 'o estado da fila é uma linha só, mesmo rodando duas vezes');
  perform ok((select count(*) from vault.decrypted_secrets where name = 'soma_fila_token') = 1, 'a senha do agendamento está no Vault, uma só');
  perform ok((select decrypted_secret from vault.decrypted_secrets where name = 'soma_fila_token') = (select s from senha_antes),
             'e rodar de novo não troca a senha');
  perform ok(length((select decrypted_secret from vault.decrypted_secrets where name = 'soma_fila_token')) = 64, 'com 64 caracteres');
  perform ok(exists (select 1 from migracoes where id = 'v32_fila_e_notificacoes'), 'a migração se registra');
  perform ok(exists (select 1 from pg_trigger where tgname = 'fila_acordar_notificacoes'), 'o aviso novo acorda a fila');
end $$;

-- ------------------------------------------------------------
-- 1. A SENHA E QUEM CHAMA
-- ------------------------------------------------------------
do $$ declare t text := (select decrypted_secret from vault.decrypted_secrets where name = 'soma_fila_token'); begin
  raise notice 'A senha';
  perform ok(fila_token_confere(t), 'a senha certa passa');
  perform ok(not fila_token_confere(t || 'x'), 'uma letra a mais não passa');
  perform ok(not fila_token_confere(left(t, 20)), 'um pedaço dela não passa');
  perform ok(not coalesce(fila_token_confere(null), false), 'nula não passa');
  perform ok(not fila_token_confere(''), 'vazia não passa');
  perform ok((fila_quem_sou()->>'papel') = current_user::text, 'quem_sou diz o papel de quem chama');
end $$;

-- ------------------------------------------------------------
-- 2. UMA PASSADA DE CADA VEZ
-- ------------------------------------------------------------
do $$ declare a jsonb; b jsonb; c jsonb; begin
  raise notice 'A vez';
  a := fila_passada_inicio('agendamento');
  perform ok(a->>'status' = 'ok' and (a->>'id') is not null, 'a primeira passada pega a vez');
  b := fila_passada_inicio('portal');
  perform ok(b->>'status' = 'ocupada' and b->>'origem' = 'agendamento', 'a segunda, ao mesmo tempo, recebe "ocupada" e de quem é a vez');
  perform fila_passada_fim((a->>'id')::bigint, '{"status":"ok","enviadas":2}');
  perform ok((select em_curso_desde from fila_estado) is null, 'o fim libera a vez');
  perform ok((select resultado->>'enviadas' from fila_passadas where id = (a->>'id')::bigint) = '2', 'e registra o que a passada respondeu');
  c := fila_passada_inicio('teste');
  perform ok(c->>'status' = 'ok', 'depois do fim, a próxima pega a vez');
  -- a passada que morreu no meio não prende a fila para sempre
  update fila_estado set em_curso_desde = now() - interval '4 minutes';
  b := fila_passada_inicio('agendamento');
  perform ok(b->>'status' = 'ok', 'uma passada presa há mais de 3 minutos perde a vez');
  perform fila_passada_fim((b->>'id')::bigint, '{"status":"erro","detalhe":"exemplo"}');
  perform fila_passada_fim((c->>'id')::bigint, '{"status":"ok"}');
  perform ok((select count(*) from fila_passadas where origem = 'agendamento') = 2, 'cada passada fica no registro, com a origem');
end $$;

-- ------------------------------------------------------------
-- 3. O EMPURRÃO DO PORTAL
-- ------------------------------------------------------------
do $$ begin
  raise notice 'O empurrão';
  update fila_estado set ultimo_empurrao = null, ultima_inicio = now() - interval '10 minutes', em_curso_desde = null;
  perform eu(null, 'leitura');
  perform ok(not fila_empurrar(), 'conta sem registro não empurra');
  perform eu(11, 'leitura');
  perform ok(fila_empurrar(), 'com a fila parada, o primeiro portal empurra');
  perform eu(17, 'leitura');
  perform ok(not fila_empurrar(), 'o segundo, logo depois, não: um empurrão a cada dois minutos para a equipe toda');
  update fila_estado set ultimo_empurrao = now() - interval '3 minutes';
  update fila_estado set ultima_inicio = now() - interval '30 seconds';
  perform ok(not fila_empurrar(), 'com uma passada há menos de dois minutos (o agendamento em dia), ninguém empurra');
  update fila_estado set ultima_inicio = now() - interval '5 minutes', em_curso_desde = now() - interval '10 seconds';
  perform ok(not fila_empurrar(), 'nem com uma passada rodando');
  update fila_estado set em_curso_desde = null;
  perform ok(fila_empurrar(), 'parada de novo, o empurrão volta');
end $$;

-- ------------------------------------------------------------
-- 4. O CHAMADO DO BANCO À FUNÇÃO (com um pg_net de mentira)
-- ------------------------------------------------------------
create schema if not exists net;
create table if not exists net.chamados (id bigserial primary key, url text, body jsonb, headers jsonb, timeout integer);
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language sql as $$
  insert into net.chamados (url, body, headers, timeout) values (url, body, headers, timeout_milliseconds) returning id;
$$;

do $$ declare v bigint; h jsonb; t text := (select decrypted_secret from vault.decrypted_secrets where name = 'soma_fila_token'); begin
  raise notice 'O chamado';
  update fila_estado set ultimo_chamado = null, em_curso_desde = null;
  v := fila_chamar('agendamento');
  perform ok(v is not null, 'com o pg_net, o banco chama a função');
  select headers into h from net.chamados order by id desc limit 1;
  perform ok((select url from net.chamados order by id desc limit 1) = 'https://rxzmkyjttzzpwtodqkve.supabase.co/functions/v1/notificar-email',
             'no endereço da notificar-email do projeto');
  perform ok(h->>'x-soma-fila' = t, 'com a senha do Vault no cabeçalho');
  perform ok(not (h ? 'Authorization'), 'e sem Authorization, quando não há JWT à mão');
  perform ok((select body->>'origem' from net.chamados order by id desc limit 1) = 'agendamento', 'dizendo de onde vem');
  perform ok((select timeout from net.chamados order by id desc limit 1) >= 30000, 'com tempo para a função terminar');
  perform ok(fila_chamar('agendamento') is null, 'chamar de novo em menos de 20 segundos não sai');
  update fila_estado set ultimo_chamado = now() - interval '1 minute', em_curso_desde = now();
  perform ok(fila_chamar('agendamento') is null, 'nem com uma passada rodando');
  -- a chave do agendamento antigo, guardada no Vault, vai no Authorization
  perform vault.create_secret('eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura', 'chave_servico');
  update fila_estado set ultimo_chamado = null, em_curso_desde = null;
  perform fila_chamar('agendamento');
  select headers into h from net.chamados order by id desc limit 1;
  perform ok(h->>'Authorization' = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.assinatura',
             'com a chave do passo 6 antigo no Vault, o Authorization vai junto');
  perform ok(h->>'x-soma-fila' = t, 'e a senha também');
  delete from vault.secrets where name = 'chave_servico';
  -- sem chave no Vault, a sessão de quem acabou de agir (o cabeçalho do PostgREST)
  perform set_config('request.headers', '{"authorization":"Bearer eyJ0eXAi.eyJzdWIi.sessao"}', false);
  update fila_estado set ultimo_chamado = null;
  perform fila_chamar('evento');
  select headers into h from net.chamados order by id desc limit 1;
  perform ok(h->>'Authorization' = 'Bearer eyJ0eXAi.eyJzdWIi.sessao', 'sem chave, vai a sessão de quem agiu');
  perform set_config('request.headers', '{"authorization":"Bearer sb_publishable_abc"}', false);
  update fila_estado set ultimo_chamado = null;
  perform fila_chamar('evento');
  select headers into h from net.chamados order by id desc limit 1;
  perform ok(not (h ? 'Authorization'), 'uma chave que não é JWT não vai');
  perform set_config('request.headers', '', false);
end $$;

-- um aviso novo acorda a fila, e um chamado que falha não derruba o aviso
do $$ declare n0 bigint; n1 bigint; begin
  raise notice 'O aviso acorda a fila';
  update fila_estado set ultimo_chamado = null, em_curso_desde = null;
  select count(*) into n0 from net.chamados;
  perform eu(4, 'admin');
  perform notificar(array[11, 17], 'atividade_atribuida', 'ORT-9 Montar a bancada', 'corpo', '#/atividades/card/ORT-9');
  select count(*) into n1 from net.chamados;
  perform ok(n1 = n0 + 1, 'o aviso a duas pessoas chama a função uma vez só');
  perform notificar(array[23], 'atividade_atribuida', 'ORT-10', 'corpo', '#/x');
  perform ok((select count(*) from net.chamados) = n1, 'e o segundo aviso, logo depois, não chama de novo');
  -- o aviso de teste não acorda: o portal manda a função rodar logo em
  -- seguida, e duas passadas disputariam o mesmo aviso
  update fila_estado set ultimo_chamado = null;
  perform eu(11, 'leitura');
  perform ok(notificacao_teste()->>'status' = 'ok', 'o teste de e-mail cria o aviso');
  insert into notificacoes (registro, tipo, titulo, lida, email_em) values (11, 'teste_push', 'Teste', true, now());
  perform ok((select count(*) from net.chamados) = n1, 'e os avisos de teste (e-mail e aparelho) não acordam a fila');
  perform eu(4, 'admin');
  perform notificar(array[11], 'atividade_atribuida', 'ORT-12', 'corpo', '#/x');
  perform ok((select count(*) from net.chamados) = n1 + 1, 'o aviso comum seguinte acorda');
end $$;
create or replace function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000)
returns bigint language plpgsql as $$ begin raise exception 'rede fora'; end $$;
do $$ declare n0 bigint; begin
  update fila_estado set ultimo_chamado = null;
  select count(*) into n0 from notificacoes;
  perform notificar(array[11], 'atividade_prazo', 'ORT-11 vence hoje', 'corpo', '#/x');
  perform ok((select count(*) from notificacoes) = n0 + 1, 'com o pg_net fora do ar, o aviso é criado do mesmo jeito');
end $$;
drop schema net cascade;
do $$ begin
  update fila_estado set ultimo_chamado = null;
  perform ok(fila_chamar('agendamento') is null, 'sem o pg_net, o chamado não sai e não quebra');
end $$;

-- a chave assinada com o segredo do projeto, quando o banco o conhece
do $$ declare j text; partes text[]; esperado text; begin
  raise notice 'A chave assinada no banco';
  perform ok(fila_jwt_servico() is null, 'sem o segredo do projeto, nada');
  perform set_config('app.settings.jwt_secret', 'segredo-de-teste-com-32-caracteres!!', false);
  j := fila_jwt_servico();
  partes := string_to_array(j, '.');
  perform ok(array_length(partes, 1) = 3, 'com ele, um JWT de três partes');
  perform ok(convert_from(decode(translate(partes[2], '-_', '+/') || repeat('=', (4 - length(partes[2]) % 4) % 4), 'base64'), 'utf8')::jsonb->>'role'
             = 'service_role', 'do papel service_role');
  esperado := translate(encode(hmac(convert_to(partes[1] || '.' || partes[2], 'utf8'), convert_to('segredo-de-teste-com-32-caracteres!!', 'utf8'), 'sha256'), 'base64'), E'+/=\n', '-_');
  perform ok(partes[3] = esperado, 'e a assinatura HMAC-SHA256 confere');
  perform set_config('app.settings.jwt_secret', '', false);
end $$;

-- ------------------------------------------------------------
-- 5. O SINO QUE NÃO EMPILHA
-- ------------------------------------------------------------
do $$ declare n integer; a bigint; b bigint; c bigint; outro bigint; begin
  raise notice 'Limpar';
  perform eu(4, 'admin');
  delete from notificacoes;
  perform notificar(array[11, 17], 'atividade_atribuida', 'Aviso lido', 'c', '#/x');
  perform notificar(array[11], 'atividade_atribuida', 'Aviso novo', 'c', '#/x');
  update notificacoes set lida = true where titulo = 'Aviso lido';
  select id into outro from notificacoes where registro = 17;
  perform eu(11, 'leitura');
  n := notificacoes_limpar();
  perform ok(n = 1, 'limpar sem dizer nada apaga só os lidos');
  perform ok((select count(*) from notificacoes where registro = 11) = 1, 'o não lido fica');
  perform ok(exists (select 1 from notificacoes where id = outro), 'e o aviso de outra pessoa nem se mexe');
  perform ok(notificacoes_limpar(array[outro]) = 0, 'o id de outra pessoa não apaga nada');
  select id into a from notificacoes where registro = 11;
  perform ok(notificacoes_limpar(array[a]) = 1, 'o seu, pelo id, sai');
  perform eu(4, 'admin');   -- notificar() não avisa quem agiu: quem avisa é a Ana
  perform notificar(array[11], 'x', 'um', 'c', '#/x'); perform notificar(array[11], 'x', 'dois', 'c', '#/x');
  update notificacoes set lida = true where titulo = 'um';
  perform eu(11, 'leitura');
  perform ok(notificacoes_limpar(null, true) = 2, 'todos: os seus, lidos ou não');
  perform eu(null, 'leitura');
  perform ok(notificacoes_limpar(null, true) = 0, 'sem registro, nada');
end $$;

do $$ declare n integer; begin
  raise notice 'O expurgo';
  delete from notificacoes;
  insert into notificacoes (registro, tipo, titulo, lida, criado_em) values
    (11, 'x', 'lido há 31 dias', true, now() - interval '31 days'),
    (11, 'x', 'lido há 10 dias', true, now() - interval '10 days'),
    (11, 'x', 'não lido há 60 dias', false, now() - interval '60 days'),
    (11, 'x', 'não lido há 121 dias', false, now() - interval '121 days'),
    (11, 'teste_email', 'teste de anteontem', true, now() - interval '2 days'),
    (11, 'teste_email', 'teste de agora', true, now());
  n := notificacoes_expurgar();
  perform ok(n = 3, 'o expurgo leva três: o lido velho, o não lido muito velho e o teste velho');
  perform ok((select array_agg(titulo order by titulo) from notificacoes) = array['lido há 10 dias', 'não lido há 60 dias', 'teste de agora'],
             'ficam o lido recente, o não lido de 60 dias e o teste de agora');
  perform ok((select ultimo_expurgo from fila_estado) > now() - interval '1 minute', 'e o estado anota quando');
end $$;

do $$ declare r jsonb; begin
  raise notice 'O teste de e-mail não empilha';
  delete from notificacoes;
  perform eu(11, 'leitura');
  perform notificacao_teste(); perform notificacao_teste(); r := notificacao_teste();
  perform ok((select count(*) from notificacoes where registro = 11 and tipo = 'teste_email') = 1, 'três testes deixam um aviso só');
  perform ok((select id from notificacoes where registro = 11 and tipo = 'teste_email') = (r->>'id')::bigint, 'o último');
  perform ok((select lida from notificacoes where registro = 11 and tipo = 'teste_email'), 'e ele nasce lido: não acende o sino');
  perform ok(exists (select 1 from jsonb_array_elements(notificacoes_email_lote(200)) x, jsonb_array_elements(x->'itens') i
                      where (x->>'registro')::int = 11 and i->>'tipo' = 'teste_email'), 'mas continua saindo por e-mail');
end $$;

-- ------------------------------------------------------------
-- 6. AS NOTIFICAÇÕES NO APARELHO
-- ------------------------------------------------------------
do $$ declare r jsonb; pk text := repeat('B', 87); au text := repeat('a', 22); id1 uuid; begin
  raise notice 'Inscrever';
  perform eu(null, 'leitura');
  perform ok(push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', pk, 'auth', au))->>'status' = 'sem_registro',
             'sem registro, não inscreve');
  perform eu(11, 'leitura');
  perform ok(push_inscrever(jsonb_build_object('endpoint', 'http://push.exemplo/1', 'p256dh', pk, 'auth', au))->>'status' = 'invalido',
             'endereço sem https não entra');
  perform ok(push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', 'curta', 'auth', au))->>'status' = 'invalido',
             'chave curta não entra');
  perform ok(push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', pk, 'auth', 'x<y'))->>'status' = 'invalido',
             'segredo com caractere estranho não entra');
  r := push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', pk, 'auth', au, 'aparelho', 'Chrome no Android'));
  perform ok(r->>'status' = 'ok', 'uma inscrição válida entra');
  id1 := (r->>'id')::uuid;
  r := push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', pk, 'auth', au));
  perform ok((r->>'id')::uuid = id1 and (select count(*) from push_inscricoes) = 1, 'o mesmo navegador de novo atualiza, não duplica');
  perform ok((select aparelho from push_inscricoes where id = id1) = 'Chrome no Android', 'e guarda o nome do aparelho');
  perform ok(jsonb_array_length(push_meus()) = 1 and not (push_meus()->0 ? 'p256dh') and not (push_meus()->0 ? 'endpoint'),
             'a pessoa vê os seus aparelhos, sem as chaves');
  update push_inscricoes set criado_em = now() - interval '1 day';
  perform eu(17, 'leitura');
  perform ok(jsonb_array_length(push_meus()) = 0, 'e não vê os dos outros');
  perform ok(push_cancelar('https://push.exemplo/1') = 0, 'nem cancela a de outra pessoa');
  -- outra conta no mesmo navegador leva a inscrição
  r := push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/1', 'p256dh', pk, 'auth', au));
  perform ok((select registro from push_inscricoes where id = id1) = 17, 'outra conta no mesmo navegador leva a inscrição');
  perform ok((select criado_em from push_inscricoes where id = id1) > now() - interval '1 minute', 'e conta como nova');
  perform ok(push_cancelar('https://push.exemplo/1') = 1, 'cancelar a deste navegador');
  perform ok((select count(*) from push_inscricoes) = 0, 'e ela sai');
end $$;

do $$ declare pk text := repeat('B', 87); au text := repeat('a', 22); l jsonb; i11 uuid; i11b uuid; n bigint; begin
  raise notice 'O lote do aparelho';
  delete from notificacoes; delete from push_inscricoes;
  perform eu(11, 'leitura');
  i11 := (push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/a', 'p256dh', pk, 'auth', au))->>'id')::uuid;
  i11b := (push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/b', 'p256dh', pk, 'auth', au))->>'id')::uuid;
  perform eu(4, 'admin');
  perform notificar(array[11, 17], 'atividade_atribuida', 'ORT-20 Revisar', 'c', '#/atividades/card/ORT-20');
  insert into notificacoes (registro, tipo, titulo, criado_em) values (11, 'x', 'de anteontem', now() - interval '2 days');
  l := push_lote(300);
  perform ok(jsonb_array_length(l) = 1 and (l->0->>'registro')::int = 11, 'o lote traz só quem tem aparelho inscrito');
  perform ok(jsonb_array_length(l->0->'itens') = 1 and l->0->'itens'->0->>'titulo' = 'ORT-20 Revisar', 'só os avisos do último dia');
  perform ok(jsonb_array_length(l->0->'inscricoes') = 2, 'com os dois aparelhos da pessoa');
  perform ok(l->0->'inscricoes'->0 ? 'p256dh' and l->0->'inscricoes'->0 ? 'auth' and l->0->'inscricoes'->0 ? 'criado_em',
             'e as chaves de cada um, para cifrar');
  n := (l->0->'itens'->0->>'id')::bigint;
  perform push_baixa(jsonb_build_object('itens', jsonb_build_array(n), 'mortas', jsonb_build_array(i11b), 'ok', jsonb_build_array(i11)));
  perform ok((select push_em from notificacoes where id = n) is not null, 'a baixa marca o aviso como empurrado');
  perform ok(jsonb_array_length(push_lote(300)) = 0, 'e ele não volta no lote');
  perform ok(not exists (select 1 from push_inscricoes where id = i11b), 'o aparelho que o serviço deu por morto sai');
  perform push_baixa(jsonb_build_object('falhas', jsonb_build_array(i11)));
  perform ok((select falhas from push_inscricoes where id = i11) = 1, 'uma falha conta');
  update push_inscricoes set falhas = 19 where id = i11;
  perform push_baixa(jsonb_build_object('falhas', jsonb_build_array(i11)));
  perform ok(not exists (select 1 from push_inscricoes where id = i11), 'e vinte falhas seguidas tiram o aparelho');
end $$;

do $$ declare r jsonb; pk text := repeat('B', 87); au text := repeat('a', 22); begin
  raise notice 'As chaves VAPID';
  perform ok(push_chave_publica() is null, 'antes da primeira passada, não há chave pública');
  r := push_chaves_gravar(repeat('P', 87), '{"kty":"EC","crv":"P-256","d":"x"}');
  perform ok(r->>'publica' = repeat('P', 87) and r->>'privada' like '{%', 'a primeira gravação guarda o par');
  r := push_chaves_gravar(repeat('Q', 87), '{"kty":"EC","crv":"P-256","d":"y"}');
  perform ok(r->>'publica' = repeat('P', 87), 'a segunda não troca: quem gravou primeiro vence');
  perform ok(push_chave_publica() = repeat('P', 87), 'a pública sai para o navegador');
  perform ok((select count(*) from vault.decrypted_secrets where name like 'soma_vapid_%') = 2, 'o par mora no Vault');
  raise notice 'O teste do aparelho';
  delete from push_inscricoes; delete from notificacoes;
  perform eu(23, 'leitura');
  perform ok(push_teste()->>'status' = 'sem_inscricao', 'sem aparelho, o teste diz isso');
  perform push_inscrever(jsonb_build_object('endpoint', 'https://push.exemplo/d', 'p256dh', pk, 'auth', au));
  perform push_teste(); r := push_teste();
  perform ok(r->>'status' = 'ok' and (r->>'aparelhos')::int = 1, 'com aparelho, o teste cria o aviso');
  perform ok((select count(*) from notificacoes where registro = 23 and tipo = 'teste_push') = 1, 'um só, mesmo testando duas vezes');
  perform ok((select lida and email_em is not null from notificacoes where registro = 23 and tipo = 'teste_push'),
             'lido e sem e-mail: é só para o aparelho');
  perform ok(exists (select 1 from jsonb_array_elements(push_lote(300)) x where (x->>'registro')::int = 23), 'e entra no lote do aparelho');
end $$;

-- ------------------------------------------------------------
-- 7. A SITUAÇÃO, PARA A GESTÃO
-- ------------------------------------------------------------
do $$ declare r jsonb; begin
  raise notice 'A situação';
  perform eu(11, 'leitura');
  perform ok(fila_situacao()->>'status' = 'sem_permissao', 'quem não é da gestão não vê');
  perform eu(4, 'admin');
  delete from notificacoes;
  perform notificar(array[11, 17], 'atividade_atribuida', 'Pendente', 'c', '#/x');
  insert into notificacao_preferencias (registro, email_modo) values (17, 'nunca')
    on conflict (registro) do update set email_modo = 'nunca';
  r := fila_situacao();
  perform ok(r->>'status' = 'ok', 'a gestão vê');
  perform ok((r->'pendentes'->>'avisos')::int = 1, 'o aviso de quem escolheu "só no portal" não conta como e-mail esperando');
  perform ok(not (r->>'agendada')::boolean, 'sem o pg_cron, não está agendada');
  perform ok(r->'por_origem' ? 'agendamento' and r->'por_origem' ? 'teste', 'a última passada de cada origem');
  perform ok(r->'ultimo_erro'->'resultado'->>'detalhe' = 'exemplo', 'e o último erro');
end $$;

-- ------------------------------------------------------------
-- 8. NADA SE LÊ DIRETO
-- ------------------------------------------------------------
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
do $$ begin perform set_config('teste.registro', '11', false); perform set_config('teste.papel', 'leitura', false); end $$;
set role authenticated;
do $$ declare pegou boolean := false; begin
  raise notice 'O acesso direto';
  perform ok((select count(*) from fila_estado) = 0, 'o estado da fila não se lê direto');
  perform ok((select count(*) from fila_passadas) = 0, 'nem o registro das passadas');
  perform ok((select count(*) from push_inscricoes) = 0, 'nem as inscrições, nem as suas');
  begin perform fila_passada_inicio('portal'); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'a vez da fila é só da função de envio');
  pegou := false;
  begin perform push_lote(10); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'o lote do aparelho também');
  pegou := false;
  begin perform push_chaves(); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'e a chave privada, mais ainda');
  pegou := false;
  begin perform fila_token_confere('x'); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'conferir a senha do agendamento também não');
  perform ok(push_chave_publica() is not null, 'a chave pública, sim');
  perform ok(fila_quem_sou()->>'papel' = 'authenticated', 'quem_sou responde o papel de quem chama');
end $$;
reset role;
set role anon;
do $$ declare pegou boolean := false; begin
  begin perform notificacoes_limpar(); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'a chave anônima não limpa o sino de ninguém');
  pegou := false;
  begin perform push_inscrever('{}'::jsonb); exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem inscreve aparelho');
  perform ok(fila_quem_sou()->>'papel' = 'anon', 'mas pergunta quem é');
end $$;
reset role;

do $$ begin raise notice 'Tudo certo.'; end $$;
