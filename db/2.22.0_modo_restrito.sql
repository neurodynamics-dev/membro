-- ============================================================
-- SOMA 2.22.0, MIGRAÇÃO, NeuroDynamics
-- O MODO RESTRITO: a conta de quem saiu da equipe (Desligado ou
-- Egresso) volta a entrar no portal, para pedir o aproveitamento de
-- AACC e acompanhar o que a equipe publica.
--
-- Desde a 2.18.0, conta ligada a membro Desligado, Egresso ou Sob
-- demanda não lê nada: conta_ativa() é falsa e a política restritiva
-- conta_ativa, em toda tabela com RLS, nega tudo. Isso continua. O
-- que muda é só o que passa pelas funções abaixo, e só para
-- Desligado e Egresso; Sob demanda segue de fora.
--
--   1. status_restrito() e conta_restrita(): a conta de Desligado ou
--      Egresso. É o que o portal pergunta para abrir no modo
--      restrito em vez de dizer "Acesso encerrado".
--   2. O APROVEITAMENTO: as funções de quem pede (a ficha, o
--      enquadramento, o envio, a lista, um pedido, reabrir, cancelar,
--      o bucket) passam a reconhecer a pessoa pelo registro mesmo
--      depois da saída (aacc_registro_atual()). As de quem aprova não
--      mudam, e quem saiu nunca aprova, mesmo que a ficha guarde os
--      grupos de antes. aacc_pedir_correcao() abre, para quem saiu, a
--      solicitação de corrigir a entrada ou a saída na ficha.
--   3. O INÍCIO: inicio_restrito() traz numa chamada o nome da
--      pessoa, o quadro de avisos e os links úteis; agenda_itens()
--      dá o calendário da equipe (os eventos abertos à equipe e os
--      marcos, sem as ausências de ninguém, sem link de reunião nem
--      pauta); feed_lista() dá as publicações que estão também no
--      site, com as imagens. O resto do início (tarefas, placar,
--      pendências) fica atrás do vidro: o banco não manda.
--
-- Pré-requisitos: a 2.18.0 (conta_ativa), a 2.20.0 (o aproveitamento),
-- a v29 (portal_links) e o quadro de avisos (soma_v10_portal). O feed
-- (2.19.1_feed) é opcional: sem ele, o item 3 do feed fica para depois.
-- Idempotente. Se a 2.20.0 rodar de novo, rode esta de novo depois:
-- a 2.20.0 reescreve as funções do aproveitamento como eram.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal.
-- ============================================================

do $$
begin
  if to_regprocedure('public.conta_ativa()') is null or to_regprocedure('public.status_bloqueado(text)') is null then
    raise exception using message = 'Falta aplicar a 2.18.0 antes desta migração.',
      detail = 'O modo restrito abre uma porta na conta bloqueada da 2.18.0 (conta_ativa, status_bloqueado).';
  end if;
  if to_regprocedure('public.aacc_meu()') is null then
    raise exception using message = 'Falta aplicar a 2.20.0 antes desta migração.',
      detail = 'O modo restrito é para pedir o aproveitamento de AACC (db/2.20.0_aproveitamento.sql).';
  end if;
  if to_regclass('public.portal_avisos') is null or to_regclass('public.portal_links') is null then
    raise exception using message = 'Falta o quadro de avisos ou os links úteis.',
      detail = 'Aplique antes soma_v10_portal.sql (db/aplicadas) e a v29 (db/v29_presenca_e_inicio.sql).';
  end if;
  if to_regprocedure('public.agenda_itens_para(integer,boolean,date,date)') is null then
    raise exception using message = 'Falta aplicar a 28.0 (db/v28_agenda.sql).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. A CONTA RESTRITA
-- ------------------------------------------------------------
create or replace function public.status_restrito(p_status text)
returns boolean language sql immutable as $$
  select coalesce(p_status, '') in ('Desligado','Egresso');
$$;

create or replace function public.conta_restrita()
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from perfis p join membros m on m.registro = p.registro
     where p.id = auth.uid() and public.status_restrito(m.status));
$$;
comment on function public.conta_restrita() is
  'Verdadeiro para a conta ligada a um membro Desligado ou Egresso: o modo restrito (2.22.0). '
  'conta_ativa() continua falsa para ela; só as funções do aproveitamento e do início a reconhecem.';

revoke execute on function public.status_restrito(text) from public;
revoke execute on function public.conta_restrita() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.conta_restrita() from anon;
  end if;
end $$;
grant execute on function public.status_restrito(text), public.conta_restrita() to authenticated;

-- ------------------------------------------------------------
-- 2. O APROVEITAMENTO
--    O registro de quem pede: o de portal_registro_atual(), e mais o
--    de Desligado e Egresso. Sob demanda continua sem registro.
-- ------------------------------------------------------------
create or replace function public.aacc_registro_atual()
returns integer language sql stable security definer
set search_path = public as $$
  select p.registro
    from perfis p left join membros m on m.registro = p.registro
   where p.id = auth.uid()
     and (not public.status_bloqueado(m.status) or public.status_restrito(m.status));
$$;
-- o nome no histórico e na revogação: doc_meu_nome() não acha o de
-- quem saiu (lê portal_registro_atual()) e escreveria o e-mail
create or replace function public.aacc_meu_nome()
returns text language sql stable security definer
set search_path = public as $$
  select coalesce((select nome from membros where registro = public.aacc_registro_atual()), public.doc_meu_nome());
$$;
revoke execute on function public.aacc_registro_atual() from public, anon, authenticated;
revoke execute on function public.aacc_meu_nome() from public, anon, authenticated;

-- Quem decide numa etapa e quem aprova: como na 2.20.0, e nunca quem
-- saiu da equipe. A ficha de quem saiu pode guardar os grupos de
-- antes, e esta_no_grupo() não olha o status.
create or replace function public.aacc_decide_etapa(p_etapa integer, p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_registro is not null
     and not exists (select 1 from membros m where m.registro = p_registro and public.status_bloqueado(m.status))
     and (   coalesce(public.papel_atual(), '') = 'admin'
          or coalesce(public.esta_no_grupo(public.aacc_grupo(p_etapa), p_registro), false));
$$;
create or replace function public.aacc_aprovador(p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_registro is not null
     and not exists (select 1 from membros m where m.registro = p_registro and public.status_bloqueado(m.status))
     and exists (select 1 from aacc_config c, unnest(c.grupos) g(id)
                  where g.id is not null and public.esta_no_grupo(g.id, p_registro));
$$;
revoke execute on function public.aacc_decide_etapa(integer, integer) from public, anon, authenticated;
revoke execute on function public.aacc_aprovador(integer) from public, anon, authenticated;

-- As funções de quem pede trocam portal_registro_atual() por
-- aacc_registro_atual() (e doc_meu_nome() por aacc_meu_nome()). É a
-- mesma troca da 2.18.0 nos testes de papel: a 2.20.0 continua dona
-- dos corpos, e esta só acerta quem é a pessoa. As de quem aprova
-- (aacc_decidir, aacc_professor_trocar, aacc_pendentes) ficam como
-- estão: para elas, quem saiu não tem registro.
do $$
declare
  fns constant text[] := array['aacc_meu', 'aacc_perfil_salvar', 'aacc_preparar', 'aacc_enviar', 'aacc_hist',
    'aacc_pode_ver', 'aacc_reabrir', 'aacc_cancelar', 'aacc_lista', 'aacc_ler', 'aacc_pode_enviar_objeto'];
  d text; f record; q text; novo text; n integer := 0;
begin
  foreach d in array fns loop
    for f in select p.oid from pg_proc p where p.proname = d and p.pronamespace = 'public'::regnamespace loop
      q := pg_get_functiondef(f.oid);
      novo := regexp_replace(regexp_replace(q, '(public\.)?portal_registro_atual\(\)', 'public.aacc_registro_atual()', 'g'),
                             '(public\.)?doc_meu_nome\(\)', 'public.aacc_meu_nome()', 'g');
      if novo <> q then execute novo; n := n + 1;
      elsif position('aacc_registro_atual()' in q) = 0 then
        raise notice 'Modo restrito: não reconheci quem pede em %(). Confira à mão.', d;
      end if;
    end loop;
  end loop;
  raise notice 'Modo restrito: % funções do aproveitamento reescritas.', n;
end $$;

-- A correção da entrada ou da saída na ficha. Sem a data de saída,
-- quem saiu não baixa o template, e o pedido de correção do
-- aproveitamento era uma solicitação "outro", que portal_abrir_solicitacao()
-- só aceita de quem está na equipe. Esta abre a mesma solicitação (o
-- mesmo protocolo e o mesmo card no quadro do Pessoal), só para isso e
-- uma de cada vez.
create or replace function public.aacc_pedir_correcao(p_texto text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.aacc_registro_atual();
  v_txt  text := nullif(trim(coalesce(p_texto, '')), '');
  v_tit  constant text := 'Correção da entrada ou da saída na ficha';
  v_id   uuid;
  v_num  integer;
  v_prot text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_txt is null or length(v_txt) < 5 or length(v_txt) > 2000 then
    return jsonb_build_object('status','invalido','campo','descricao');
  end if;
  select protocolo into v_prot from portal_solicitacoes
   where registro = v_reg and tipo = 'outro' and dados->>'origem' = 'aacc' and status in ('aberta','em_analise')
   order by criado_em desc limit 1;
  if found then return jsonb_build_object('status','ja_pedido','protocolo',v_prot); end if;
  insert into portal_solicitacoes (registro, tipo, titulo, dados)
  values (v_reg, 'outro', v_tit, jsonb_build_object('titulo', v_tit, 'descricao', v_txt, 'origem', 'aacc'))
  returning id, numero into v_id, v_num;
  v_prot := 'SOL' || to_char((now() at time zone 'America/Sao_Paulo')::date, 'YY') || '-' || lpad(v_num::text, 4, '0');
  update portal_solicitacoes set protocolo = v_prot where id = v_id;
  return jsonb_build_object('status','ok','protocolo',v_prot);
end $$;
revoke execute on function public.aacc_pedir_correcao(text) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.aacc_pedir_correcao(text) from anon;
  end if;
end $$;
grant execute on function public.aacc_pedir_correcao(text) to authenticated;

-- ------------------------------------------------------------
-- 3. O INÍCIO DO MODO RESTRITO
-- ------------------------------------------------------------
-- O que a conta restrita lê para desenhar o início: quem é, o quadro
-- de avisos (o que está publicado e no prazo, como a política
-- pavisos_select mostra a qualquer membro) e os links úteis ativos.
create or replace function public.inicio_restrito()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v    record;
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select p.id, p.email, m.registro, m.nome, m.status into v
    from perfis p join membros m on m.registro = p.registro
   where p.id = auth.uid() and public.status_restrito(m.status);
  if not found then return jsonb_build_object('status','nao_restrita'); end if;
  return jsonb_build_object('status','ok',
    'eu', jsonb_build_object('id', v.id, 'email', v.email, 'registro', v.registro, 'nome', v.nome, 'status', v.status),
    'avisos', coalesce((select jsonb_agg(to_jsonb(a) - 'criado_por' order by a.ordem, a.criado_em desc)
                          from portal_avisos a
                         where a.publicado
                           and (a.data_inicio is null or a.data_inicio <= hoje)
                           and (a.data_fim    is null or a.data_fim    >= hoje)), '[]'::jsonb),
    'links', coalesce((select jsonb_agg(jsonb_build_object('titulo', l.titulo, 'url', l.url, 'descricao', l.descricao,
                                                           'grupo', l.grupo, 'ordem', l.ordem) order by l.ordem, l.titulo)
                         from portal_links l where l.ativo), '[]'::jsonb));
end $$;
revoke execute on function public.inicio_restrito() from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.inicio_restrito() from anon;
  end if;
end $$;
grant execute on function public.inicio_restrito() to authenticated;

-- O calendário. A conta ativa lê como sempre; a restrita, o
-- calendário da equipe: os eventos abertos à equipe e os marcos sem
-- dono, sem as ausências de ninguém e sem o link da reunião nem a
-- pauta. A conta que não é ativa nem restrita (Sob demanda, a do
-- quiosque, a externa do LABBIO) não lê nada, como nas tabelas.
-- (A porta é da 13.0; a 2.22.0 passa a ser a dona dela.)
create or replace function public.agenda_itens(p_de date, p_ate date)
returns setof public.agenda_item language plpgsql stable security definer
set search_path = public as $$
declare it public.agenda_item;
begin
  if auth.uid() is null then return; end if;
  if public.conta_ativa() then
    return query select * from public.agenda_itens_para(
      public.portal_registro_atual(), public.papel_atual() in ('admin','pessoal'), p_de, p_ate);
    return;
  end if;
  if not public.conta_restrita() then return; end if;
  for it in select * from public.agenda_itens_para(null, false, p_de, p_ate) loop
    if it.origem in ('evento','marco') then
      it.meet_url := null; it.pauta := null;
      return next it;
    end if;
  end loop;
end $$;
revoke execute on function public.agenda_itens(date, date) from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.agenda_itens(date, date) from anon;
  end if;
end $$;
grant execute on function public.agenda_itens(date, date) to authenticated;

-- As publicações. A conta restrita lê o que está publicado também no
-- site; o que é só da equipe continua só da equipe. As imagens vêm
-- do bucket privado "feed" por uma política a mais, só de leitura e
-- só das publicações do site. (feed_lista é da 2.19.1_feed; a 2.22.0
-- passa a ser a dona dela.)
do $feed$
begin
  if to_regclass('public.feed_itens') is null or to_regprocedure('public.feed_item_json(public.feed_itens,boolean)') is null then
    raise notice 'Sem o feed (2.19.1_feed): as publicações do modo restrito ficam para quando houver.';
    return;
  end if;
  execute $f$
    create or replace function public.feed_lista(p_antes timestamptz default null, p_limite integer default 20,
                                                 p_id uuid default null, p_tipo text default null)
    returns jsonb language sql stable security definer set search_path = public as $$
      select case when not (public.conta_ativa() or public.conta_restrita()) then '[]'::jsonb
        else coalesce((select jsonb_agg(public.feed_item_json(f, true) order by f.publicado_em desc, f.id desc)
          from (select * from feed_itens f where f.estado = 'publicado' and (p_tipo is null or f.tipo = p_tipo)
                  and (f.publico or public.conta_ativa())
                  and (p_antes is null or f.publicado_em < p_antes or (p_id is not null and f.publicado_em = p_antes and f.id < p_id))
                order by f.publicado_em desc, f.id desc limit least(greatest(p_limite, 1), 50)) f), '[]') end $$
  $f$;
  execute $f$
    create or replace function public.feed_imagem_restrita(p_name text)
    returns boolean language sql stable security definer set search_path = public as $$
      select public.conta_restrita() and exists (
        select 1 from feed_itens f, jsonb_array_elements(f.imagens) i
         where f.estado = 'publicado' and f.publico and i->>'path' = p_name) $$
  $f$;
  revoke execute on function public.feed_imagem_restrita(text) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.feed_imagem_restrita(text) from anon;
  end if;
  grant execute on function public.feed_imagem_restrita(text) to authenticated;
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists feed_ler_restrita on storage.objects';
    execute $p$create policy feed_ler_restrita on storage.objects for select to authenticated
      using (bucket_id = 'feed' and public.feed_imagem_restrita(name))$p$;
  end if;
end $feed$;

insert into public.migracoes (id, descricao) values
  ('2.22.0_modo_restrito', 'O modo restrito: a conta de Desligado e Egresso entra no portal para pedir o aproveitamento de AACC (aacc_registro_atual) e vê, no início, os avisos, os links úteis, o calendário da equipe e as publicações do site (inicio_restrito, agenda_itens, feed_lista); quem saiu nunca aprova um pedido')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select x.item as "o que a 2.22.0 deixou", x.valor
  from (values
    (1, 'contas no modo restrito', (select count(*)::text || ' (Desligado e Egresso com conta no portal)'
                                      from perfis p join membros m on m.registro = p.registro
                                     where public.status_restrito(m.status))),
    (2, 'contas que seguem bloqueadas', (select count(*)::text || ' (Sob demanda)'
                                           from perfis p join membros m on m.registro = p.registro
                                          where public.status_bloqueado(m.status) and not public.status_restrito(m.status))),
    (3, 'funções do aproveitamento reescritas', (select count(*)::text || ' de 11'
                                                   from pg_proc p where p.pronamespace = 'public'::regnamespace
                                                    and p.proname = any(array['aacc_meu', 'aacc_perfil_salvar', 'aacc_preparar',
                                                          'aacc_enviar', 'aacc_hist', 'aacc_pode_ver', 'aacc_reabrir', 'aacc_cancelar',
                                                          'aacc_lista', 'aacc_ler', 'aacc_pode_enviar_objeto'])
                                                    and p.prosrc like '%aacc_registro_atual()%'
                                                    and p.prosrc not like '%portal_registro_atual()%')),
    (4, 'publicações do site para o modo restrito', case when to_regprocedure('public.feed_imagem_restrita(text)') is null
                                                      then 'sem o feed (2.19.1_feed)' else 'feed_lista e a política feed_ler_restrita' end)
  ) as x(ordem, item, valor)
 order by x.ordem;

-- ============================================================
-- FIM, SOMA 2.22.0
--
-- Depois de rodar:
--   1) confira acima: "funções do aproveitamento reescritas" tem de
--      dizer 11 de 11 (menos que isso, alguma ficou com o teste
--      antigo; o aviso da migração diz qual);
--   2) publique o portal.
--   Se rodar a 2.20.0 de novo um dia, rode esta logo depois.
-- ============================================================
