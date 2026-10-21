\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: gestores do LABBIO (identidade e segurança).
-- Rode depois dos testes da 2.18.0 e da 2.19.0 (a 2.19.0 traz o quiosque):
--   bash testes/preparar-base.sh teste t2191l 2.18.0_soma.sql 2.19.0.sql 2.19.1_labbio.sql
-- Simula o que só o Supabase tem: o papel authenticator e auth.users.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
-- entra como uma conta sem membro (a de um gestor)
create or replace function conta(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', '', false);
  perform set_config('teste.papel', 'leitura', false);
  perform set_config('teste.uid', p_uid::text, false);
end $$;
-- a porta da API para um caminho: devolve 'passa' ou 'barrado'
create or replace function porta(p_path text) returns text language plpgsql as $$
begin
  perform set_config('request.path', p_path, true);
  perform public.api_pre_request();
  return 'passa';
exception when insufficient_privilege then return 'barrado';
end $$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then create role authenticator nologin; end if;
end $$;
create table if not exists auth.users (id uuid primary key, email text);

\i 2.19.1_labbio_base.sql
\i 2.19.1_labbio_base.sql

do $$
declare r jsonb; t1 text; t2 text; t3 text; g1 uuid; g2 uuid;
  u1 uuid := 'aaaaaaaa-0000-0000-0000-000000000001'; u2 uuid := 'aaaaaaaa-0000-0000-0000-000000000002';
  u3 uuid := 'aaaaaaaa-0000-0000-0000-000000000003';
begin
  raise notice 'A porta da API';
  perform ok(exists (select 1 from pg_db_role_setting s join pg_roles r on r.oid = s.setrole, unnest(s.setconfig) c
                      where r.rolname = 'authenticator' and c = 'pgrst.db_pre_request=public.api_pre_request'),
    'o PostgREST passa a chamar api_pre_request antes de cada pedido');

  raise notice 'Convite';
  perform eu(4, 'admin');
  perform ok(public.labbio_convidar('ana@nro.dev', 'Ana')->>'status' = 'email_de_membro', 'e-mail de conta de membro não vira gestor');
  perform ok(public.labbio_convidar('bruno@nro.dev', 'Bruno')->>'status' = 'email_de_membro', 'nem e-mail da ficha de um membro');
  perform ok(public.labbio_convidar('sem-arroba', 'X')->>'status' = 'email_invalido', 'e-mail inválido');
  perform ok(public.labbio_convidar('gestora@labbio.test', '  ')->>'status' = 'nome_obrigatorio', 'nome obrigatório');
  r := public.labbio_convidar('Gestora@LABBIO.test', 'Gestora Um');
  perform ok(r->>'status' = 'ok', 'o admin do SOMA convida');
  g1 := (r->>'id')::uuid;
  select substring(dados->>'caminho' from 'c=([0-9a-f]+)$') into t1 from labbio_envios where para_email = 'gestora@labbio.test' order by id desc limit 1;
  perform ok(t1 is not null and length(t1) = 48, 'o convite sai pela fila de e-mail, com o link');
  perform ok(not exists (select 1 from labbio_convites where token_hash = t1), 'o token não fica guardado em claro');
  perform eu(11, 'leitura');
  perform ok(public.labbio_convidar('outro@labbio.test', 'Outro')->>'status' = 'sem_permissao', 'membro comum não convida');
  perform ok(public.labbio_gestores_lista()->>'status' = 'sem_permissao', 'nem vê a lista');

  raise notice 'A conta criada com o e-mail do convite já nasce fechada';
  insert into auth.users (id, email) values (u1, 'gestora@labbio.test');
  insert into perfis (id, email, papel, registro) values (u1, 'gestora@labbio.test', 'leitura', null);
  perform ok((select user_id from labbio_gestores where id = g1) = u1, 'a conta se liga ao convite pelo e-mail');
  perform conta(u1);
  perform ok(public.conta_externa() and not public.conta_labbio(), 'conta externa, ainda não ativa');
  perform ok(not public.conta_ativa(), 'conta_ativa() falsa (a trava das tabelas)');
  perform ok(public.papel_atual() = 'nenhum' and not public.tenho_papel('leitura'), 'sem papel nenhum');
  perform ok(public.portal_registro_atual() is null, 'sem registro');
  perform ok(porta('/membros') = 'barrado' and porta('/rpc/cofre_lista') = 'barrado' and porta('/rpc/feed_lista') = 'barrado'
             and porta('/rpc/labbiox') = 'barrado' and porta('/rpc/labbio_eu/../membros') = 'barrado',
    'a porta da API barra tabela e qualquer função fora de labbio_*');
  perform ok(porta('/rpc/labbio_aceitar') = 'passa' and porta('/rpc/labbio_eu') = 'passa', 'e deixa passar as labbio_*');
  perform ok(public.labbio_eu()->>'status' = 'convidado', 'labbio_eu: convidado');
  perform ok(public.labbio_gestores_lista()->>'status' = 'sem_permissao', 'convidado não vê a lista');

  raise notice 'Aceite';
  perform ok(public.labbio_aceitar('errado')->>'status' = 'invalido', 'token errado');
  r := public.labbio_aceitar(t1);
  perform ok(r->>'status' = 'ok' and (r->'gestor'->>'principal')::boolean, 'aceita; o primeiro gestor vira o principal');
  perform ok(public.labbio_aceitar(t1)->>'status' = 'usado', 'o convite vale uma vez');
  perform ok(public.conta_labbio() and public.labbio_eu()->>'status' = 'ok', 'gestora ativa');
  perform ok(not public.conta_ativa() and porta('/membros') = 'barrado', 'e continua fora do portal da equipe');

  raise notice 'Gestor convida gestor';
  r := public.labbio_convidar('dois@labbio.test', 'Gestor Dois');
  perform ok(r->>'status' = 'ok', 'gestor ativo convida');
  g2 := (r->>'id')::uuid;
  perform ok((public.labbio_gestor_json((select g from labbio_gestores g where id = g2)))->>'convidado_por' = 'Gestora Um', 'com quem convidou');
  select substring(dados->>'caminho' from 'c=([0-9a-f]+)$') into t2 from labbio_envios where para_email = 'dois@labbio.test' order by id desc limit 1;
  r := public.labbio_convidar('tres@labbio.test', 'Gestor Três');
  select substring(dados->>'caminho' from 'c=([0-9a-f]+)$') into t3 from labbio_envios where para_email = 'tres@labbio.test' order by id desc limit 1;
  insert into auth.users (id, email) values (u2, 'dois@labbio.test');
  insert into perfis (id, email, papel, registro) values (u2, 'dois@labbio.test', 'leitura', null);
  perform conta(u2);
  perform ok(public.labbio_aceitar(t3)->>'status' = 'email_diferente', 'o convite de outro e-mail não serve');
  r := public.labbio_aceitar(t2);
  perform ok(r->>'status' = 'ok' and not (r->'gestor'->>'principal')::boolean, 'o segundo aceita, sem estrela');
  update labbio_convites set expira_em = now() - interval '1 minute' where gestor_id = (select id from labbio_gestores where email = 'tres@labbio.test');
  insert into auth.users (id, email) values (u3, 'tres@labbio.test');
  insert into perfis (id, email, papel, registro) values (u3, 'tres@labbio.test', 'leitura', null);
  perform conta(u3);
  perform ok(public.labbio_aceitar(t3)->>'status' = 'expirado', 'convite vencido');

  raise notice 'A estrela';
  perform conta(u2);
  perform ok(public.labbio_principal(g2)->>'status' = 'sem_permissao', 'só o principal (ou o admin) passa a estrela');
  perform conta(u1);
  perform ok(public.labbio_principal(g2)->>'status' = 'ok', 'o principal passa a estrela');
  perform ok((select count(*) from labbio_gestores where principal) = 1 and (select principal from labbio_gestores where id = g2), 'sempre uma estrela só');
  perform ok(public.labbio_revogar(g2)->>'status' = 'sem_permissao', 'quem não é principal não revoga');

  raise notice 'Revogação';
  perform eu(4, 'admin');
  perform ok(public.labbio_revogar(g2)->>'status' = 'transfira_antes', 'o principal não sai sem passar a estrela');
  perform ok(public.labbio_principal(g1)->>'status' = 'ok', 'o admin devolve a estrela');
  perform ok(public.labbio_revogar(g2, 'saiu do LABBIO')->>'status' = 'ok', 'revoga o segundo');
  perform conta(u2);
  perform ok(not public.conta_labbio() and public.conta_externa(), 'revogado: deixa de ser gestor e continua conta externa');
  perform ok(public.labbio_eu()->>'status' = 'revogado' and public.labbio_gestores_lista()->>'status' = 'sem_permissao',
    'as funções do painel recusam na hora (sem esperar o JWT)');
  perform ok(porta('/membros') = 'barrado' and not public.conta_ativa(), 'e não vira conta comum do portal');
  perform eu(4, 'admin');
  perform ok(public.labbio_revogar(g1)->>'status' = 'ok', 'o único gestor ativo só sai pelo admin');
  perform ok(public.labbio_convidar('dois@labbio.test', 'Gestor Dois')->>'status' = 'ok', 'dá para convidar de novo');
  perform ok((select situacao = 'convidado' and user_id = u2 from labbio_gestores where id = g2), 'com a mesma conta, como convidado');

  raise notice 'Conta de membro não muda';
  perform eu(11, 'leitura');
  perform ok(public.conta_ativa() and porta('/membros') = 'passa' and porta('/rpc/feed_lista') = 'passa', 'a porta não mexe em membro');
  perform ok(public.labbio_eu()->>'status' = 'nao_gestor', 'membro não é gestor');

  raise notice 'Auditoria';
  perform ok((select count(*) from labbio_auditoria where acao in ('convidar', 'aceitar', 'principal', 'revogar')) >= 8, 'cada mudança fica registrada');
end $$;

-- pela API (papel authenticated): tabelas, Storage e funções internas
select conta('aaaaaaaa-0000-0000-0000-000000000001');
update labbio_gestores set situacao = 'ativo', revogado_em = null, principal = true where email = 'gestora@labbio.test';
set role authenticated;
do $$ begin
  perform ok((select count(*) from membros) = 0, 'a conta do gestor não lê membros (RLS)');
  begin
    perform count(*) from public.labbio_gestores;
    raise exception 'FALHOU: labbio_gestores legível pela API';
  exception when insufficient_privilege then perform ok(true, 'nem as tabelas do LABBIO direto');
  end;
  begin
    insert into storage.objects (bucket_id, name) values ('termos', 'labbio-2026/4/00000000-0000-0000-0000-000000000000.pdf');
    raise exception 'FALHOU: a conta externa gravou no Storage';
  exception when insufficient_privilege then perform ok(true, 'não grava no Storage');
  end;
  begin
    perform public.labbio_envios_lote(10);
    raise exception 'FALHOU: a fila de e-mails é chamável pela API';
  exception when insufficient_privilege then perform ok(true, 'a fila de e-mails é só da Edge Function');
  end;
  perform ok(public.labbio_eu()->>'status' = 'ok', 'e o painel funciona');
end $$;
reset role;

do $$ declare n integer; begin
  n := jsonb_array_length(public.labbio_envios_lote(50));
  perform ok(n >= 4, 'a Edge Function lê a fila');
  perform public.labbio_envios_baixa(jsonb_build_object('enviados', (select jsonb_agg(id) from labbio_envios)));
  perform ok(not exists (select 1 from labbio_envios where dados ? 'caminho'), 'depois de enviado, o link com o token sai do banco');
end $$;
\echo 'Tudo certo.'
