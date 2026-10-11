-- ============================================================
-- SOMA 2.19.1: feed editorial, notícias públicas, reações e newsletter
--
-- Uma fonte editorial só (feed_itens) para o widget do portal, o feed da
-- equipe, as notícias do site e a newsletter.
--
-- EDITORIAL
--   estados: rascunho → pronto → (publicando) → publicado → retirado.
--   O reporte só CONTRIBUI: enviar o reporte deixa a contribuição "pronta";
--   quem publica é NRO_MANAGERS (pertença efetiva, com herança) ou admin,
--   sem votação. Autoria do texto (autor_texto) separada de quem publicou.
--   Dois tipos: tópico (breve; até 1.200 caracteres) e notícia completa
--   (resumo e texto de pelo menos 300 caracteres, imagens com legenda,
--   página própria com slug estável; slug antigo continua resolvendo).
--   Público: cada publicação diz se vai para o site (publico) ou fica só
--   para a equipe. O acervo da 2.18 continua interno.
--
-- IMAGENS PÚBLICAS
--   O bucket feed segue privado. Publicar no site copia as imagens para o
--   bucket público "noticias" em dois passos idempotentes: preparar (estado
--   "publicando", com os caminhos de destino) → o navegador de quem publica
--   copia → confirmar (o banco confere que cada arquivo existe). Falhou no
--   meio: a matéria fica em "publicando", invisível, e dá para repetir.
--   Retirar tira do site na hora; o navegador apaga as cópias públicas.
--
-- REAÇÕES
--   Um emoji por pessoa e publicação (troca e remove), por conta logada que
--   tenha registro no quadro, em qualquer status: membro, ex-membro, egresso.
--   Não depende de conta_ativa(); conta do LABBIO não reage. Publicação
--   interna só aceita reação de conta ativa. Retirada não aceita reação.
--   Limite: 30 mudanças por conta a cada 10 minutos.
--
-- NEWSLETTER
--   Sem as três aprovações (os votos antigos ficam guardados). Uma edição
--   congela os itens publicados AINDA NÃO DISTRIBUÍDOS àquele público
--   (newsletter_itens), publicados depois da ativação (o acervo não é
--   disparado). Semanal (equipe: qualquer publicado) e mensal (comunidade:
--   só o que é público), nas cadências de antes; sem item, sem edição.
--   Managers podem mandar uma edição na hora. Quem está de férias ou
--   afastado fica fora da edição interna.
--
-- INSCRIÇÃO PÚBLICA
--   comunidade_inscrever (anônimo) → e-mail de confirmação → comunidade_
--   confirmar. A resposta nunca diz se o e-mail já existia. Reinscrição
--   depois de descadastro exige a confirmação de novo. Limites por e-mail e
--   por hora.
--
-- Depende da 2.19.1_reporte e da 2.19.1_labbio_base. Só acrescenta; pode
-- rodar de novo.
-- ============================================================

-- 1. o item editorial ---------------------------------------------------------------
alter table public.feed_itens alter column reporte_id drop not null;
alter table public.feed_itens
  add column if not exists tipo          text not null default 'topico',
  add column if not exists estado        text,
  add column if not exists publico       boolean not null default false,
  add column if not exists slug          text,
  add column if not exists autor_texto   text,
  add column if not exists publicado_por integer references membros(registro),
  add column if not exists retirado_em   timestamptz,
  add column if not exists retirado_por  integer references membros(registro),
  add column if not exists imagens       jsonb not null default '[]',
  add column if not exists atualizado_em timestamptz not null default now(),
  add column if not exists criado_em     timestamptz not null default now();
-- o acervo: publicado continua publicado (interno), oculto vira retirado
update public.feed_itens f set estado = case
    when f.oculto then 'retirado'
    when f.publicado_em is not null then 'publicado'
    when exists (select 1 from reportes r where r.id = f.reporte_id and r.enviado_em is not null) then 'pronto'
    else 'rascunho' end
 where f.estado is null;
update public.feed_itens set imagens = jsonb_build_array(jsonb_build_object('path', imagem_path, 'legenda', null))
 where imagem_path is not null and imagens = '[]'::jsonb;
alter table public.feed_itens alter column estado set default 'rascunho';
alter table public.feed_itens alter column estado set not null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'feed_itens_editorial_check') then
    alter table public.feed_itens add constraint feed_itens_editorial_check check (
      tipo in ('topico', 'noticia') and estado in ('rascunho', 'pronto', 'publicando', 'publicado', 'retirado')
      and (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'));
  end if;
end $$;
create unique index if not exists feed_itens_slug on public.feed_itens (slug) where slug is not null;
create index if not exists feed_itens_publicados on public.feed_itens (publicado_em desc) where estado = 'publicado';

-- o slug que já existiu continua apontando para a matéria
create table if not exists public.feed_slugs (
  slug    text primary key,
  item_id uuid not null references feed_itens(id) on delete cascade);

create table if not exists public.feed_reacoes (
  item_id uuid not null references feed_itens(id) on delete cascade,
  user_id uuid not null,
  emoji   text not null check (emoji in ('👏', '❤️', '🎉', '💡', '🚀', '😮')),
  em      timestamptz not null default now(),
  primary key (item_id, user_id));
create table if not exists public.feed_reacao_eventos (
  user_id uuid not null,
  em      timestamptz not null default clock_timestamp());
create index if not exists feed_reacao_eventos_u on public.feed_reacao_eventos (user_id, em desc);

do $$ declare t text; begin
  foreach t in array array['feed_slugs', 'feed_reacoes', 'feed_reacao_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- o bucket público, só com as cópias das imagens publicadas no site
insert into storage.buckets (id, name, public) values ('noticias', 'noticias', true) on conflict (id) do nothing;
update storage.buckets set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'noticias';

-- 2. quem publica ------------------------------------------------------------------
create or replace function public.feed_editor()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and (public.papel_atual() = 'admin'
    or public.esta_no_grupo(public.grupo_por_nome('NRO_MANAGERS'), public.portal_registro_atual())) $$;

create or replace function public.feed_slugificar(p text)
returns text language sql immutable as $$
  select left(trim(both '-' from regexp_replace(lower(translate(coalesce(p, ''),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ', 'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn')),
    '[^a-z0-9]+', '-', 'g')), 80) $$;

-- o caminho público de uma imagem: noticias/<item>/<n>.<ext>
create or replace function public.feed_imagem_publica(p_item uuid, p_n integer, p_path text)
returns text language sql immutable as $$
  select p_item::text || '/' || p_n || '.' || coalesce(nullif(lower(substring(p_path from '\.([A-Za-z0-9]+)$')), ''), 'jpg') $$;

-- 3. a leitura interna (portal: widget e feed da equipe) ---------------------------------
create or replace function public.feed_reacoes_de(p_item uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_object_agg(emoji, n) from (select emoji, count(*) n from feed_reacoes
                    where item_id = p_item group by emoji) x), '{}') $$;

create or replace function public.feed_item_json(f feed_itens, p_interno boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', f.id, 'tipo', f.tipo, 'slug', f.slug, 'titulo', f.titulo, 'subtitulo', f.subtitulo,
    'texto', f.texto, 'autor', coalesce(f.autor_texto, (select nome from membros where registro = f.autor)),
    'publicado_em', f.publicado_em, 'publico', f.publico,
    'imagens', case when p_interno then f.imagens
                    else coalesce((select jsonb_agg(jsonb_build_object('url', 'noticias/' || (i->>'publico_path'), 'legenda', i->'legenda'))
                                     from jsonb_array_elements(f.imagens) i where i ? 'publico_path'), '[]') end,
    'imagem_path', case when p_interno then f.imagem_path end,
    'reacoes', public.feed_reacoes_de(f.id),
    'minha_reacao', (select emoji from feed_reacoes r where r.item_id = f.id and r.user_id = auth.uid())) $$;

drop function if exists public.feed_lista(timestamptz, integer, uuid);
create or replace function public.feed_lista(p_antes timestamptz default null, p_limite integer default 20, p_id uuid default null,
                                             p_tipo text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_ativa() then '[]'::jsonb else coalesce((select jsonb_agg(public.feed_item_json(f, true) order by f.publicado_em desc, f.id desc)
    from (select * from feed_itens f where f.estado = 'publicado' and (p_tipo is null or f.tipo = p_tipo)
            and (p_antes is null or f.publicado_em < p_antes or (p_id is not null and f.publicado_em = p_antes and f.id < p_id))
          order by f.publicado_em desc, f.id desc limit least(greatest(p_limite, 1), 50)) f), '[]') end $$;

-- as imagens do bucket privado: o autor do reporte enquanto edita, o editor,
-- e qualquer conta ativa para o que está publicado
create or replace function public.feed_imagem_pode(p_name text, p_escrita boolean default false)
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and (
    exists (select 1 from reportes r where r.id::text = split_part(p_name, '/', 1) and r.enviado_em is null
              and (case when r.modelo = 'lider' then r.autor = public.portal_registro_atual() and public.reporte_sou_lider()
                        else public.reporte_pode(r.frente_id) end))
    or (public.feed_editor() and exists (select 1 from feed_itens f where f.id::text = split_part(p_name, '/', 1)
                                            and f.reporte_id is null and f.estado not in ('publicado', 'retirado')))
    or (not p_escrita and public.feed_editor())
    or (not p_escrita and exists (select 1 from feed_itens f, jsonb_array_elements(f.imagens) i
                                   where f.estado = 'publicado' and i->>'path' = p_name))) $$;

-- 4. a mesa editorial (NRO_MANAGERS) --------------------------------------------------------
create or replace function public.feed_editorial(p_estado text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.feed_editor() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'itens', coalesce((select jsonb_agg(public.feed_item_json(f, true)
        || jsonb_build_object('estado', f.estado, 'reporte_id', f.reporte_id, 'criado_em', f.criado_em, 'atualizado_em', f.atualizado_em,
                              'publicado_por', (select nome from membros where registro = f.publicado_por),
                              'retirado_em', f.retirado_em) order by f.atualizado_em desc)
      from feed_itens f
     where (p_estado is null or f.estado = p_estado)
       and (f.estado <> 'rascunho' or f.reporte_id is null)), '[]')) end $$;

-- criar ou editar (editor); contribuição de reporte em rascunho não se edita aqui
create or replace function public.feed_item_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f feed_itens; v_tipo text := coalesce(p->>'tipo', 'topico'); v_slug text; v_img jsonb := coalesce(p->'imagens', '[]'); x jsonb;
begin
  if not feed_editor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_tipo not in ('topico', 'noticia') then return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if length(btrim(coalesce(p->>'titulo', ''))) not between 1 and 200 then return jsonb_build_object('status', 'invalido', 'campo', 'titulo'); end if;
  if length(btrim(coalesce(p->>'subtitulo', ''))) not between 1 and 400 then return jsonb_build_object('status', 'invalido', 'campo', 'subtitulo'); end if;
  if v_tipo = 'topico' and length(coalesce(p->>'texto', '')) > 1200 then return jsonb_build_object('status', 'invalido', 'campo', 'texto'); end if;
  if jsonb_typeof(v_img) <> 'array' or jsonb_array_length(v_img) > 8 then return jsonb_build_object('status', 'invalido', 'campo', 'imagens'); end if;
  if nullif(p->>'id', '') is not null then
    select * into f from feed_itens where id = (p->>'id')::uuid for update;
    if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
    if f.estado = 'rascunho' and f.reporte_id is not null then return jsonb_build_object('status', 'em_rascunho_no_reporte'); end if;
    if f.estado = 'publicando' then return jsonb_build_object('status', 'publicando'); end if;
  end if;
  -- imagem só da pasta do próprio item (ou do reporte de onde veio); item novo nasce sem imagem
  for x in select * from jsonb_array_elements(v_img) loop
    if f.id is null or split_part(coalesce(x->>'path', ''), '/', 1) not in (f.id::text, coalesce(f.reporte_id::text, '-'))
      then return jsonb_build_object('status', 'invalido', 'campo', 'imagens'); end if;
  end loop;
  v_slug := case when v_tipo = 'noticia' then feed_slugificar(coalesce(nullif(p->>'slug', ''), p->>'titulo')) end;
  if v_slug = '' then v_slug := null; end if;
  if v_slug is not null and exists (select 1 from feed_itens where slug = v_slug and id is distinct from f.id)
       or v_slug is not null and exists (select 1 from feed_slugs where slug = v_slug and item_id is distinct from f.id) then
    return jsonb_build_object('status', 'slug_em_uso', 'slug', v_slug); end if;
  if f.id is null then
    insert into feed_itens (autor, titulo, subtitulo, texto, tipo, estado, slug, autor_texto)
    values (portal_registro_atual(), btrim(p->>'titulo'), btrim(p->>'subtitulo'), coalesce(p->>'texto', ''), v_tipo, 'pronto', v_slug,
            nullif(btrim(coalesce(p->>'autor_texto', '')), ''))
    returning * into f;
  else
    if f.slug is not null and f.slug is distinct from v_slug then
      insert into feed_slugs (slug, item_id) values (f.slug, f.id) on conflict (slug) do nothing;
    end if;
    update feed_itens set titulo = btrim(p->>'titulo'), subtitulo = btrim(p->>'subtitulo'), texto = coalesce(p->>'texto', ''),
           tipo = v_tipo, slug = v_slug, autor_texto = nullif(btrim(coalesce(p->>'autor_texto', '')), ''),
           imagens = (select coalesce(jsonb_agg(jsonb_build_object('path', i->>'path', 'legenda', nullif(btrim(coalesce(i->>'legenda', '')), ''))
                                                 || coalesce((select jsonb_build_object('publico_path', o->>'publico_path')
                                                                from jsonb_array_elements(f.imagens) o where o->>'path' = i->>'path' and o ? 'publico_path'), '{}')), '[]')
                        from jsonb_array_elements(v_img) i),
           imagem_path = (select i->>'path' from jsonb_array_elements(v_img) i limit 1),
           estado = case when estado = 'rascunho' then 'pronto' else estado end, atualizado_em = now()
     where id = f.id returning * into f;
  end if;
  if f.slug is not null then delete from feed_slugs where slug = f.slug; end if;
  return jsonb_build_object('status', 'ok', 'id', f.id, 'slug', f.slug);
end $$;

-- publicar: interno (direto) ou no site (preparar → copiar imagens → confirmar)
create or replace function public.feed_publicar(p_id uuid, p_publico boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f feed_itens; v_n integer := 0; v_img jsonb := '[]'; x jsonb;
begin
  if not feed_editor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into f from feed_itens where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if f.estado = 'rascunho' then return jsonb_build_object('status', 'em_rascunho_no_reporte'); end if;
  if f.tipo = 'noticia' and (length(coalesce(f.texto, '')) < 300 or f.slug is null) then
    return jsonb_build_object('status', 'noticia_incompleta'); end if;
  if not p_publico then
    update feed_itens set estado = 'publicado', publico = false, publicado_em = coalesce(publicado_em, now()),
           publicado_por = portal_registro_atual(), retirado_em = null, oculto = false, atualizado_em = now() where id = p_id;
    return jsonb_build_object('status', 'ok', 'estado', 'publicado', 'copiar', '[]'::jsonb);
  end if;
  -- no site: os destinos públicos de cada imagem; o navegador copia e confirma
  for x in select * from jsonb_array_elements(f.imagens) loop
    v_n := v_n + 1;
    v_img := v_img || jsonb_build_array(x || jsonb_build_object('publico_path', feed_imagem_publica(f.id, v_n, x->>'path')));
  end loop;
  update feed_itens set estado = 'publicando', publico = true, imagens = v_img, atualizado_em = now() where id = p_id;
  if jsonb_array_length(v_img) = 0 then return feed_publicar_confirmar(p_id); end if;
  return jsonb_build_object('status', 'ok', 'estado', 'publicando',
    'copiar', (select jsonb_agg(jsonb_build_object('de', i->>'path', 'para', i->>'publico_path')) from jsonb_array_elements(v_img) i));
end $$;

create or replace function public.feed_publicar_confirmar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f feed_itens; v_falta jsonb;
begin
  if not feed_editor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into f from feed_itens where id = p_id for update;
  if not found or f.estado <> 'publicando' then return jsonb_build_object('status', 'invalido'); end if;
  select coalesce(jsonb_agg(i->>'publico_path'), '[]') into v_falta from jsonb_array_elements(f.imagens) i
   where not exists (select 1 from storage.objects o where o.bucket_id = 'noticias' and o.name = i->>'publico_path');
  if jsonb_array_length(v_falta) > 0 then return jsonb_build_object('status', 'imagens_pendentes', 'faltam', v_falta); end if;
  update feed_itens set estado = 'publicado', publicado_em = coalesce(publicado_em, now()), publicado_por = portal_registro_atual(),
         retirado_em = null, oculto = false, atualizado_em = now() where id = p_id;
  return jsonb_build_object('status', 'ok', 'estado', 'publicado', 'slug', f.slug);
end $$;

create or replace function public.feed_retirar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f feed_itens;
begin
  if not feed_editor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into f from feed_itens where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  update feed_itens set estado = 'retirado', oculto = true, retirado_em = now(), retirado_por = portal_registro_atual(), atualizado_em = now()
   where id = p_id;
  -- o navegador apaga as cópias públicas (a política só deixa apagar de item retirado)
  return jsonb_build_object('status', 'ok', 'apagar', coalesce((select jsonb_agg(i->>'publico_path') from jsonb_array_elements(f.imagens) i
                                                                  where i ? 'publico_path'), '[]'));
end $$;

-- a antiga feed_ocultar vira retirar (o Pessoal também pode retirar)
create or replace function public.feed_ocultar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not conta_ativa() or not (feed_editor() or tenho_papel('pessoal')) then return jsonb_build_object('status', 'sem_permissao'); end if;
  update feed_itens set estado = 'retirado', oculto = true, retirado_em = now(), retirado_por = portal_registro_atual(), atualizado_em = now()
   where id = p_id;
  return jsonb_build_object('status', 'ok');
end $$;

-- o bucket público: o editor grava a cópia de item em "publicando" e apaga a de item retirado
create or replace function public.noticias_objeto_pode(p_name text, p_apagar boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select public.feed_editor() and exists (select 1 from feed_itens f, jsonb_array_elements(f.imagens) i
    where f.id::text = split_part(p_name, '/', 1) and i->>'publico_path' = p_name
      and f.estado = case when p_apagar then 'retirado' else 'publicando' end) $$;
drop policy if exists noticias_inserir on storage.objects;
create policy noticias_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'noticias' and public.noticias_objeto_pode(name, false));
drop policy if exists noticias_apagar on storage.objects;
create policy noticias_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'noticias' and public.noticias_objeto_pode(name, true));

-- 5. o reporte só contribui: enviar deixa a contribuição "pronta" ------------------------
create or replace function public.feed_contribuicao_pronta()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.enviado_em is not null and old.enviado_em is null then
    update feed_itens set estado = 'pronto', atualizado_em = now() where reporte_id = new.id and estado = 'rascunho';
  end if;
  return new;
end $$;
revoke execute on function public.feed_contribuicao_pronta() from public, anon, authenticated;
drop trigger if exists feed_contribuicao_pronta on public.reportes;
create trigger feed_contribuicao_pronta after update of enviado_em on public.reportes
  for each row execute function public.feed_contribuicao_pronta();
-- ...e o envio não publica mais (as duas funções da 2.19.1_reporte publicavam)
create or replace function public.feed_nao_publicar_no_envio()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- quem publica é o editor (feed_publicar*); uma publicação vinda do UPDATE do envio do reporte é desfeita
  if new.publicado_em is not null and old.publicado_em is null and new.estado in ('rascunho', 'pronto') then
    new.publicado_em := null;
  end if;
  return new;
end $$;
revoke execute on function public.feed_nao_publicar_no_envio() from public, anon, authenticated;
drop trigger if exists feed_nao_publicar_no_envio on public.feed_itens;
create trigger feed_nao_publicar_no_envio before update of publicado_em on public.feed_itens
  for each row execute function public.feed_nao_publicar_no_envio();
-- o salvar do reporte apaga e recria o rascunho: o item novo nasce rascunho
create or replace function public.feed_item_do_reporte()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.reporte_id is not null and new.estado is distinct from 'pronto' then new.estado := 'rascunho'; end if;
  if new.imagem_path is not null and new.imagens = '[]'::jsonb then
    new.imagens := jsonb_build_array(jsonb_build_object('path', new.imagem_path, 'legenda', null));
  end if;
  return new;
end $$;
revoke execute on function public.feed_item_do_reporte() from public, anon, authenticated;
drop trigger if exists feed_item_do_reporte on public.feed_itens;
create trigger feed_item_do_reporte before insert on public.feed_itens
  for each row execute function public.feed_item_do_reporte();

-- 6. o site (anônimo): só o publicado no site ----------------------------------------------
create or replace function public.noticias_publicas(p_antes timestamptz default null, p_limite integer default 12)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_agg(jsonb_build_object('tipo', f.tipo, 'slug', f.slug, 'titulo', f.titulo, 'resumo', f.subtitulo,
      'texto', case when f.tipo = 'topico' then f.texto end,
      'autor', coalesce(f.autor_texto, (select nome from membros where registro = f.autor)), 'publicado_em', f.publicado_em,
      'imagem', (select 'noticias/' || (i->>'publico_path') from jsonb_array_elements(f.imagens) i where i ? 'publico_path' limit 1),
      'reacoes', public.feed_reacoes_de(f.id), 'ref', f.id) order by f.publicado_em desc)
    from (select * from feed_itens where estado = 'publicado' and publico
            and (p_antes is null or publicado_em < p_antes) order by publicado_em desc limit least(greatest(p_limite, 1), 30)) f), '[]') $$;

create or replace function public.noticia_publica(p_slug text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('status', 'ok', 'slug', f.slug, 'redirecionar', f.slug is distinct from p_slug)
                          || (public.feed_item_json(f, false) - 'id' - 'imagem_path') || jsonb_build_object('ref', f.id)
     from feed_itens f
    where f.estado = 'publicado' and f.publico and f.tipo = 'noticia'
      and (f.slug = p_slug or f.id = (select item_id from feed_slugs s where s.slug = p_slug))
    limit 1), jsonb_build_object('status', 'nao_encontrada')) $$;

-- 7. reações ----------------------------------------------------------------------------
-- quem reage: conta logada com registro no quadro (qualquer status), que não seja do LABBIO
create or replace function public.feed_pode_reagir(p_item feed_itens)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not public.conta_externa()
     and exists (select 1 from perfis where id = auth.uid() and registro is not null)
     and p_item.estado = 'publicado' and (p_item.publico or public.conta_ativa()) $$;

create or replace function public.feed_reagir(p_ref uuid, p_emoji text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f feed_itens;
begin
  select * into f from feed_itens where id = p_ref;
  if not found or not feed_pode_reagir(f) then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_emoji is not null and p_emoji not in ('👏', '❤️', '🎉', '💡', '🚀', '😮') then return jsonb_build_object('status', 'invalido'); end if;
  if (select count(*) from feed_reacao_eventos where user_id = auth.uid() and em > now() - interval '10 minutes') >= 30 then
    return jsonb_build_object('status', 'limite'); end if;
  insert into feed_reacao_eventos (user_id) values (auth.uid());
  delete from feed_reacao_eventos where user_id = auth.uid() and em < now() - interval '1 day';
  if p_emoji is null then
    delete from feed_reacoes where item_id = p_ref and user_id = auth.uid();
  else
    insert into feed_reacoes (item_id, user_id, emoji) values (p_ref, auth.uid(), p_emoji)
    on conflict (item_id, user_id) do update set emoji = excluded.emoji, em = now();
  end if;
  return jsonb_build_object('status', 'ok', 'reacoes', feed_reacoes_de(p_ref),
    'minha_reacao', (select emoji from feed_reacoes where item_id = p_ref and user_id = auth.uid()));
end $$;

-- 8. newsletter sem votos -------------------------------------------------------------------
-- a inscrição confirmada (a seção 9 usa; as funções da newsletter já leem)
alter table public.comunidade_inscritos
  add column if not exists confirmado_em      timestamptz,
  add column if not exists confirmacao_token  uuid,
  add column if not exists confirmacao_pedida timestamptz,
  add column if not exists consentimento_em   timestamptz;
create table if not exists public.newsletter_config (
  id boolean primary key default true check (id),
  itens_desde timestamptz not null default now());   -- o acervo antes disto não é distribuído sozinho
insert into public.newsletter_config (id) values (true) on conflict do nothing;
alter table public.newsletter_config enable row level security;
revoke all on public.newsletter_config from anon, authenticated;

create table if not exists public.newsletter_itens (
  newsletter_id uuid not null references newsletters(id) on delete cascade,
  item_id       uuid not null references feed_itens(id) on delete cascade,
  publico       text not null check (publico in ('equipe', 'comunidade')),
  primary key (newsletter_id, item_id));
create unique index if not exists newsletter_itens_uma_vez on public.newsletter_itens (item_id, publico);
alter table public.newsletter_itens enable row level security;
revoke all on public.newsletter_itens from anon, authenticated;
alter table public.newsletters add column if not exists manual boolean not null default false;
-- uma edição por período vale para a cadência; as manuais (mandar agora) ficam fora da chave
alter table public.newsletters drop constraint if exists newsletters_tipo_periodo_ini_key;
create unique index if not exists newsletters_periodo on public.newsletters (tipo, periodo_ini) where not manual;

-- o que entra: publicado depois da ativação, ainda não distribuído àquele público
create or replace function public.newsletter_elegiveis(p_tipo text)
returns setof feed_itens language sql stable security definer set search_path = public as $$
  select f.* from feed_itens f
   where f.estado = 'publicado' and f.publicado_em >= (select itens_desde from newsletter_config where id)
     and (p_tipo = 'semanal' or f.publico)
     and not exists (select 1 from newsletter_itens ni where ni.item_id = f.id
                      and ni.publico = case p_tipo when 'semanal' then 'equipe' else 'comunidade' end)
   order by f.publicado_em $$;

-- cria a edição (sem item, não cria) e já enfileira os envios; o período é a chave
drop function if exists public.newsletter_criar(text, date, date);
create or replace function public.newsletter_criar(p_tipo text, p_inicio date, p_fim date, p_manual boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v uuid; v_itens jsonb; v_pub text := case p_tipo when 'semanal' then 'equipe' else 'comunidade' end;
  v_site text := 'https://neurodynamics.dev/#/news/';
begin
  perform pg_advisory_xact_lock(hashtext('newsletter_' || p_tipo));
  if not p_manual then
    select id into v from newsletters where tipo = p_tipo and periodo_ini = p_inicio and not manual;
    if v is not null then return v; end if;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', f.id, 'tipo', f.tipo, 'titulo', f.titulo, 'subtitulo', f.subtitulo,
           'texto', case when f.tipo = 'topico' then f.texto else '' end,
           'url', case when f.tipo = 'noticia' and f.publico then v_site || f.slug end,
           'imagem', case when f.publico then (select 'noticias/' || (i->>'publico_path') from jsonb_array_elements(f.imagens) i
                                                where i ? 'publico_path' limit 1) end) order by f.publicado_em), '[]')
    into v_itens from newsletter_elegiveis(p_tipo) f;
  if jsonb_array_length(v_itens) = 0 then return null; end if;
  insert into newsletters (tipo, periodo_ini, periodo_fim, assunto, itens, status, manual)
  values (p_tipo, p_inicio, p_fim, case p_tipo when 'semanal' then 'Boletim da equipe: ' else 'NeuroDynamics: ' end
          || to_char(p_fim, 'DD/MM/YYYY'), v_itens, 'aprovada', p_manual)
  returning id into v;
  insert into newsletter_itens (newsletter_id, item_id, publico)
  select v, (x->>'id')::uuid, v_pub from jsonb_array_elements(v_itens) x on conflict do nothing;
  if p_tipo = 'semanal' then
    insert into newsletter_envios (newsletter_id, registro, email, nome)
    select v, m.registro, lower(coalesce(nullif(m.email_nro, ''), m.email_pessoal)), m.nome from membros m
     where m.status in ('Ativo', 'Em pausa / avaliação') and coalesce(nullif(m.email_nro, ''), nullif(m.email_pessoal, '')) is not null
       and not public.ausencia_em(m.registro, now())
       and not exists (select 1 from notificacao_canais c where c.registro = m.registro and c.categoria = 'reporte' and c.email = 'nunca')
    on conflict do nothing;
  else
    insert into newsletter_envios (newsletter_id, comunidade_id, email, nome)
    select v, id, email, nome from comunidade_inscritos where descadastrado_em is null and confirmado_em is not null
    on conflict do nothing;
  end if;
  return v;
end $$;

-- a fila (Edge Function): as cadências de antes, sem janela de datas no conteúdo
create or replace function public.newsletter_lote(p_limite integer default 50)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  perform reporte_ciclo_materializar();
  perform newsletter_criar('semanal', date_trunc('week', d)::date - 7, date_trunc('week', d)::date - 1);
  perform newsletter_criar('mensal', date_trunc('month', d - extract(day from d)::integer)::date, date_trunc('month', d)::date - 1);
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select e.id, e.email, e.nome, n.assunto, n.itens, c.token, n.tipo, n.id as newsletter_id
      from newsletter_envios e join newsletters n on n.id = e.newsletter_id
      left join comunidade_inscritos c on c.id = e.comunidade_id left join membros m on m.registro = e.registro
     where n.status = 'aprovada' and e.enviado_em is null and e.tentativas < 5
       and ((c.id is not null and c.descadastrado_em is null and c.confirmado_em is not null)
            or (m.registro is not null and m.status in ('Ativo', 'Em pausa / avaliação')
                and not exists (select 1 from notificacao_canais p where p.registro = m.registro and p.categoria = 'reporte' and p.email = 'nunca')))
     order by e.id limit least(greatest(p_limite, 1), 200)) x), '[]');
end $$;

-- mandar agora (editor): uma edição manual com o que estiver pendente
create or replace function public.newsletter_enviar_agora(p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v uuid; d date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not feed_editor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_tipo not in ('semanal', 'mensal') then return jsonb_build_object('status', 'invalido'); end if;
  v := newsletter_criar(p_tipo, d, d, true);
  if v is null then return jsonb_build_object('status', 'vazio'); end if;
  return jsonb_build_object('status', 'ok', 'id', v,
    'destinatarios', (select count(*) from newsletter_envios where newsletter_id = v),
    'itens', (select jsonb_array_length(itens) from newsletters where id = v));
end $$;

-- a lista para a tela (editor e liderança): edições, sem votos
create or replace function public.newsletter_lista()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (public.feed_editor() or public.reporte_gestor()) then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x)) from (
    select n.id, n.tipo, n.periodo_ini, n.periodo_fim, n.assunto, n.itens, n.status, n.manual, n.criado_em,
           (select count(*) from newsletter_envios e where e.newsletter_id = n.id) as destinatarios,
           (select count(*) from newsletter_envios e where e.newsletter_id = n.id and e.enviado_em is not null) as enviados,
           (select count(*) from newsletter_envios e where e.newsletter_id = n.id and e.enviado_em is null and e.tentativas >= 5) as falhas
      from newsletters n order by n.criado_em desc limit 50) x), '[]') end $$;

-- o que vai na próxima edição de cada público
create or replace function public.newsletter_pendentes()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.feed_editor() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok',
      'equipe', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'tipo', tipo, 'publicado_em', publicado_em))
                          from public.newsletter_elegiveis('semanal')), '[]'),
      'comunidade', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'titulo', titulo, 'tipo', tipo, 'publicado_em', publicado_em))
                              from public.newsletter_elegiveis('mensal')), '[]'),
      'inscritos', (select count(*) from comunidade_inscritos where descadastrado_em is null and confirmado_em is not null)) end $$;

-- as funções da votação ficam respondendo que acabou (os votos antigos continuam guardados)
create or replace function public.newsletter_decidir(p_id uuid, p_versao integer, p_aprova boolean, p_comentario text default null)
returns jsonb language sql stable as $$ select jsonb_build_object('status', 'descontinuado') $$;
create or replace function public.newsletter_revisar(p_id uuid, p_assunto text, p_itens jsonb)
returns jsonb language sql stable as $$ select jsonb_build_object('status', 'descontinuado') $$;
create or replace function public.newsletter_gerar(p_tipo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin return newsletter_enviar_agora(p_tipo); end $$;

-- os boletins que esperavam votos não disparam sozinhos: ficam cancelados, com o motivo
update public.newsletters set status = 'cancelada' where status = 'em_aprovacao';
update public.atividades set status = 'concluida', concluida_em = coalesce(concluida_em, now())
 where origem_tipo = 'newsletter' and status <> 'concluida';

-- 9. inscrição pública ----------------------------------------------------------------------
-- quem veio da importação (lista da equipe) já estava valendo
update public.comunidade_inscritos set confirmado_em = inscrito_em where confirmado_em is null and confirmacao_token is null and origem <> 'Site';
create unique index if not exists comunidade_conf_token on public.comunidade_inscritos (confirmacao_token) where confirmacao_token is not null;

create table if not exists public.comunidade_envios (
  id         bigserial primary key,
  email      text not null,
  nome       text not null,
  token      uuid not null,
  criado_em  timestamptz not null default now(),
  enviado_em timestamptz,
  tentativas smallint not null default 0,
  erro       text);
create table if not exists public.comunidade_pedidos (em timestamptz not null default clock_timestamp());
do $$ declare t text; begin
  foreach t in array array['comunidade_envios', 'comunidade_pedidos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.comunidade_inscrever(p_email text, p_nome text, p_consentimento boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_email text := lower(btrim(coalesce(p_email, ''))); c comunidade_inscritos; v_token uuid := gen_random_uuid();
begin
  if v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_email) > 200 then return jsonb_build_object('status', 'email_invalido'); end if;
  if length(btrim(coalesce(p_nome, ''))) not between 1 and 120 then return jsonb_build_object('status', 'nome_invalido'); end if;
  if p_consentimento is not true then return jsonb_build_object('status', 'consentimento'); end if;
  -- limite geral (abuso): 120 pedidos por hora
  if (select count(*) from comunidade_pedidos where em > now() - interval '1 hour') >= 120 then return jsonb_build_object('status', 'limite'); end if;
  insert into comunidade_pedidos default values;
  delete from comunidade_pedidos where em < now() - interval '1 day';
  select * into c from comunidade_inscritos where email = v_email for update;
  -- a resposta é sempre a mesma, exista ou não o e-mail
  if found and c.confirmado_em is not null and c.descadastrado_em is null then return jsonb_build_object('status', 'ok'); end if;
  if found and c.confirmacao_pedida > now() - interval '10 minutes' then return jsonb_build_object('status', 'ok'); end if;
  if found then
    update comunidade_inscritos set confirmacao_token = v_token, confirmacao_pedida = now(), consentimento_em = now(),
           nome = case when confirmado_em is null then btrim(p_nome) else nome end where id = c.id;
  else
    insert into comunidade_inscritos (email, nome, origem, confirmacao_token, confirmacao_pedida, consentimento_em)
    values (v_email, btrim(p_nome), 'Site', v_token, now(), now());
  end if;
  insert into comunidade_envios (email, nome, token) values (v_email, btrim(p_nome), v_token);
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.comunidade_confirmar(p_token uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c comunidade_inscritos;
begin
  select * into c from comunidade_inscritos where confirmacao_token = p_token for update;
  if not found or c.confirmacao_pedida < now() - interval '7 days' then return jsonb_build_object('status', 'invalido'); end if;
  update comunidade_inscritos set confirmado_em = now(), descadastrado_em = null, confirmacao_token = null where id = c.id;
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.comunidade_envios_lote(p_limite integer default 100)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'nome', nome, 'token', token) order by id), '[]')
    from (select * from comunidade_envios where enviado_em is null and tentativas < 5 order by id limit greatest(coalesce(p_limite, 100), 1)) q $$;
create or replace function public.comunidade_envios_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_ok bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'enviados', '[]')) x), '{}');
        v_er bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'falhas', '[]')) x), '{}');
begin
  update comunidade_envios set enviado_em = now(), erro = null where id = any(v_ok) and enviado_em is null;
  update comunidade_envios set tentativas = tentativas + 1, erro = left(nullif(p->>'erro', ''), 500) where id = any(v_er) and enviado_em is null;
  return jsonb_build_object('status', 'ok');
end $$;

-- 10. permissões ------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['feed_slugificar(text)', 'feed_imagem_publica(uuid,integer,text)', 'feed_reacoes_de(uuid)',
                           'feed_item_json(feed_itens,boolean)', 'feed_pode_reagir(feed_itens)', 'newsletter_elegiveis(text)',
                           'newsletter_criar(text,date,date,boolean)', 'newsletter_lote(integer)', 'comunidade_envios_lote(integer)',
                           'comunidade_envios_baixa(jsonb)', 'feed_publicar_confirmar(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  -- feed_publicar_confirmar é chamada pelo navegador depois de copiar
  execute 'grant execute on function public.feed_publicar_confirmar(uuid) to authenticated';
  foreach f in array array['feed_editor()', 'feed_lista(timestamptz,integer,uuid,text)', 'feed_imagem_pode(text,boolean)',
                           'feed_editorial(text)', 'feed_item_salvar(jsonb)', 'feed_publicar(uuid,boolean)', 'feed_retirar(uuid)',
                           'feed_ocultar(uuid)', 'noticias_objeto_pode(text,boolean)', 'feed_reagir(uuid,text)',
                           'newsletter_enviar_agora(text)', 'newsletter_lista()', 'newsletter_pendentes()', 'newsletter_decidir(uuid,integer,boolean,text)',
                           'newsletter_revisar(uuid,text,jsonb)', 'newsletter_gerar(text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['noticias_publicas(timestamptz,integer)', 'noticia_publica(text)', 'comunidade_inscrever(text,text,boolean)',
                           'comunidade_confirmar(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then execute 'grant execute on function public.' || f || ' to anon'; end if;
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    foreach f in array array['newsletter_lote(integer)', 'comunidade_envios_lote(integer)', 'comunidade_envios_baixa(jsonb)'] loop
      execute 'grant execute on function public.' || f || ' to service_role';
    end loop;
  end if;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_feed',
 'SOMA 2.19.1: feed editorial (tópico e notícia, publicação por NRO_MANAGERS, site com imagens públicas controladas), reações, newsletter sem votos e inscrição pública confirmada')
on conflict(id) do nothing;
