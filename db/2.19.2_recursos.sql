-- ============================================================
-- SOMA 2.19.2: Recursos, o catálogo colaborativo de ferramentas da equipe
--
-- Um lugar só para o que a equipe usa, conhece e quer testar: os padrões
-- (VS Code, Git Bash), softwares, repositórios, serviços, benefícios de
-- estudante, ferramentas de gravação de microcontroladores. Qualquer
-- membro com conta ativa pode:
--   - adicionar um recurso (basta o link, o nome e o que ele faz);
--   - editar os recursos (instruções de download e de uso, tags, status);
--   - avaliar de 1 a 5 estrelas (uma avaliação por pessoa, que se troca);
--   - comentar (e apagar o próprio comentário).
-- Só a gestão (admin, Depto. de Pessoal e liderança) marca "NRO Standard".
-- Quem editou por último e quando fica à vista no item.
--
-- Tudo por função (as tabelas não são legíveis pela API):
--   recursos_listar()                  o catálogo, com média, avaliações e comentários
--   recurso_ler(slug)                  um recurso inteiro, com os comentários
--   recurso_salvar(jsonb)              criar ou editar
--   recurso_avaliar(slug, estrelas)    0 retira a avaliação
--   recurso_comentar(slug, texto)
--   recurso_comentario_apagar(id)
--
-- Depois, rode 2.19.2_recursos_semente.sql para popular o catálogo.
-- Só acrescenta; pode rodar de novo.
-- ============================================================

create table if not exists public.recursos (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  nome             text not null check (length(btrim(nome)) > 0),
  url              text not null,
  url_chave        text not null unique,      -- o endereço sem esquema, "www" e barra final: não repete recurso
  publicador       text,
  logo_url         text,                      -- vazio: a tela deduz do endereço (avatar do GitHub, favicon)
  tipo             text not null default 'software' check (tipo in ('software', 'extensao', 'repositorio', 'servico', 'base', 'beneficio', 'referencia')),
  funcao           text not null check (length(btrim(funcao)) > 0),   -- o que ele faz, em poucas linhas
  instrucoes_baixar text,
  instrucoes_usar  text,
  tags             text[] not null default '{}',
  plataformas      text[] not null default '{}',
  acesso           text[] not null default '{}' check (acesso <@ array['gratis', 'freemium', 'pago', 'estudante', 'labbio']),
  status           text not null default 'ativo' check (status in ('ativo', 'inativo')),
  padrao_nro       boolean not null default false,
  criado_por       integer references public.membros(registro) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_por   integer references public.membros(registro) on delete set null,
  atualizado_em    timestamptz not null default now());
create index if not exists recursos_tipo on public.recursos (tipo, nome);
create index if not exists recursos_tags on public.recursos using gin (tags);

create table if not exists public.recurso_avaliacoes (
  recurso_id uuid not null references public.recursos(id) on delete cascade,
  registro   integer not null references public.membros(registro) on delete cascade,
  estrelas   integer not null check (estrelas between 1 and 5),
  em         timestamptz not null default now(),
  primary key (recurso_id, registro));

create table if not exists public.recurso_comentarios (
  id         uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.recursos(id) on delete cascade,
  registro   integer references public.membros(registro) on delete set null,
  texto      text not null check (length(btrim(texto)) between 1 and 2000),
  criado_em  timestamptz not null default now(),
  apagado_em timestamptz);
create index if not exists recurso_comentarios_rec on public.recurso_comentarios (recurso_id, criado_em);

do $$ declare t text; begin
  foreach t in array array['recursos', 'recurso_avaliacoes', 'recurso_comentarios'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 1. peças ----------------------------------------------------------------------------
alter table public.recursos drop constraint if exists recursos_tipo_check;
alter table public.recursos add constraint recursos_tipo_check check (tipo in ('software', 'extensao', 'repositorio', 'servico', 'base', 'beneficio', 'referencia'));

create or replace function public.recursos_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_registro_atual() is not null and public.conta_ativa() $$;

-- quem marca "NRO Standard" e apaga comentário alheio
create or replace function public.recursos_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.recursos_pode() and (public.papel_atual() in ('admin', 'pessoal') or public.tenho_papel('lideranca')) $$;

create or replace function public.recurso_slug(p text)
returns text language sql immutable as $$
  select coalesce(nullif(trim(both '-' from regexp_replace(
    lower(translate(coalesce(p, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
    '[^a-z0-9]+', '-', 'g')), ''), 'recurso') $$;

create or replace function public.recurso_url_chave(p text)
returns text language sql immutable as $$
  select lower(regexp_replace(regexp_replace(btrim(coalesce(p, '')), '^https?://(www\.)?', '', 'i'), '[/#?]+$', '')) $$;

-- uma lista de texto limpa: sem vazios nem repetidos (sem diferenciar maiúscula), com no máximo 32 letras e 24 itens
create or replace function public.recurso_lista_limpar(p jsonb)
returns text[] language sql immutable as $$
  select coalesce((select (array_agg(t order by ord))[1:24] from (
      select distinct on (lower(t)) t, ord from (
        select left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 32) as t, ord
          from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) with ordinality as u(x, ord)) a
       where t <> '' order by lower(t), ord) b), '{}') $$;

create or replace function public.recurso_comentarios_json(p_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'registro', c.registro, 'autor', coalesce(m.nome, 'Ex-membro'),
      'texto', c.texto, 'criado_em', c.criado_em,
      'meu', c.registro is not distinct from public.portal_registro_atual(),
      'pode_apagar', c.registro is not distinct from public.portal_registro_atual() or public.recursos_gestao()) order by c.criado_em), '[]')
    from recurso_comentarios c left join membros m on m.registro = c.registro
   where c.recurso_id = p_id and c.apagado_em is null $$;

create or replace function public.recurso_json(r recursos, p_completo boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'slug', r.slug, 'nome', r.nome, 'url', r.url, 'publicador', r.publicador, 'logo_url', r.logo_url,
      'tipo', r.tipo, 'funcao', r.funcao, 'tags', to_jsonb(r.tags), 'plataformas', to_jsonb(r.plataformas), 'acesso', to_jsonb(r.acesso),
      'status', r.status, 'padrao_nro', r.padrao_nro, 'criado_em', r.criado_em, 'atualizado_em', r.atualizado_em,
      'media', (select round(avg(estrelas)::numeric, 2) from recurso_avaliacoes where recurso_id = r.id),
      'avaliacoes', (select count(*) from recurso_avaliacoes where recurso_id = r.id),
      'comentarios', (select count(*) from recurso_comentarios where recurso_id = r.id and apagado_em is null),
      'minha', (select estrelas from recurso_avaliacoes where recurso_id = r.id and registro = public.portal_registro_atual()))
    || case when not p_completo then '{}'::jsonb else jsonb_build_object(
      'instrucoes_baixar', r.instrucoes_baixar, 'instrucoes_usar', r.instrucoes_usar,
      'criado_por_nome', (select nome from membros where registro = r.criado_por),
      'atualizado_por_nome', (select nome from membros where registro = r.atualizado_por),
      'comentarios_lista', public.recurso_comentarios_json(r.id)) end $$;

-- 2. as consultas ------------------------------------------------------------------------
create or replace function public.recursos_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'gestao', public.recursos_gestao(),
    'recursos', coalesce((select jsonb_agg(public.recurso_json(r, false) order by lower(r.nome)) from recursos r), '[]'));
end $$;

create or replace function public.recurso_ler(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r recursos;
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into r from recursos where slug = p_slug;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok', 'gestao', public.recursos_gestao(), 'recurso', public.recurso_json(r, true));
end $$;

-- 3. criar e editar (qualquer membro; "NRO Standard" só a gestão) --------------------------
create or replace function public.recurso_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual(); v_id uuid := nullif(p->>'id', '')::uuid; r recursos; v_dup recursos;
  v_url text := btrim(coalesce(p->>'url', '')); v_nome text := btrim(coalesce(p->>'nome', ''));
  v_funcao text := btrim(coalesce(p->>'funcao', '')); v_tipo text := coalesce(nullif(p->>'tipo', ''), 'software');
  v_status text := coalesce(nullif(p->>'status', ''), 'ativo');
  v_tags text[] := public.recurso_lista_limpar(p->'tags'); v_plat text[] := public.recurso_lista_limpar(p->'plataformas');
  v_acesso text[] := public.recurso_lista_limpar(p->'acesso'); v_slug text; n integer := 1;
  v_pad boolean;
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_url !~* '^https?://[^\s/]+\.[^\s/]+' or length(v_url) > 500 then return jsonb_build_object('status', 'invalido', 'campo', 'url'); end if;
  if length(v_nome) = 0 or length(v_nome) > 120 then return jsonb_build_object('status', 'invalido', 'campo', 'nome'); end if;
  if length(v_funcao) = 0 or length(v_funcao) > 600 then return jsonb_build_object('status', 'invalido', 'campo', 'funcao'); end if;
  if v_tipo not in ('software', 'extensao', 'repositorio', 'servico', 'base', 'beneficio', 'referencia') then return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if v_status not in ('ativo', 'inativo') then return jsonb_build_object('status', 'invalido', 'campo', 'status'); end if;
  if not (v_acesso <@ array['gratis', 'freemium', 'pago', 'estudante', 'labbio']) then return jsonb_build_object('status', 'invalido', 'campo', 'acesso'); end if;
  if length(coalesce(p->>'instrucoes_baixar', '')) > 8000 or length(coalesce(p->>'instrucoes_usar', '')) > 8000 then
    return jsonb_build_object('status', 'invalido', 'campo', 'instrucoes'); end if;
  if coalesce(p->>'logo_url', '') <> '' and p->>'logo_url' !~* '^https://' then return jsonb_build_object('status', 'invalido', 'campo', 'logo_url'); end if;

  select * into v_dup from recursos where url_chave = public.recurso_url_chave(v_url) and (v_id is null or id <> v_id);
  if found then return jsonb_build_object('status', 'duplicado', 'slug', v_dup.slug, 'nome', v_dup.nome); end if;

  if v_id is null then
    v_slug := public.recurso_slug(v_nome);
    while exists (select 1 from recursos where slug = v_slug) loop n := n + 1; v_slug := public.recurso_slug(v_nome) || '-' || n; end loop;
    v_pad := coalesce((p->>'padrao_nro')::boolean, false) and public.recursos_gestao();
    insert into recursos (slug, nome, url, url_chave, publicador, logo_url, tipo, funcao, instrucoes_baixar, instrucoes_usar,
                          tags, plataformas, acesso, status, padrao_nro, criado_por, atualizado_por)
    values (v_slug, v_nome, v_url, public.recurso_url_chave(v_url), nullif(btrim(coalesce(p->>'publicador', '')), ''), nullif(btrim(coalesce(p->>'logo_url', '')), ''),
            v_tipo, v_funcao, nullif(btrim(coalesce(p->>'instrucoes_baixar', '')), ''), nullif(btrim(coalesce(p->>'instrucoes_usar', '')), ''),
            v_tags, v_plat, v_acesso, v_status, v_pad, v_reg, v_reg)
    returning * into r;
  else
    select * into r from recursos where id = v_id for update;
    if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
    v_pad := case when public.recursos_gestao() and p ? 'padrao_nro' then coalesce((p->>'padrao_nro')::boolean, false) else r.padrao_nro end;
    update recursos set nome = v_nome, url = v_url, url_chave = public.recurso_url_chave(v_url),
           publicador = nullif(btrim(coalesce(p->>'publicador', '')), ''), logo_url = nullif(btrim(coalesce(p->>'logo_url', '')), ''),
           tipo = v_tipo, funcao = v_funcao, instrucoes_baixar = nullif(btrim(coalesce(p->>'instrucoes_baixar', '')), ''),
           instrucoes_usar = nullif(btrim(coalesce(p->>'instrucoes_usar', '')), ''), tags = v_tags, plataformas = v_plat, acesso = v_acesso,
           status = v_status, padrao_nro = v_pad, atualizado_por = v_reg, atualizado_em = now()
     where id = v_id returning * into r;
  end if;
  return jsonb_build_object('status', 'ok', 'slug', r.slug);
end $$;

-- 4. avaliar e comentar -------------------------------------------------------------------
create or replace function public.recurso_avaliar(p_slug text, p_estrelas integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r recursos; v_reg integer := public.portal_registro_atual();
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into r from recursos where slug = p_slug;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if coalesce(p_estrelas, 0) = 0 then
    delete from recurso_avaliacoes where recurso_id = r.id and registro = v_reg;
  elsif p_estrelas between 1 and 5 then
    insert into recurso_avaliacoes (recurso_id, registro, estrelas) values (r.id, v_reg, p_estrelas)
    on conflict (recurso_id, registro) do update set estrelas = excluded.estrelas, em = now();
  else return jsonb_build_object('status', 'invalido'); end if;
  return jsonb_build_object('status', 'ok', 'recurso', public.recurso_json(r, false));
end $$;

create or replace function public.recurso_comentar(p_slug text, p_texto text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r recursos; v_txt text := btrim(coalesce(p_texto, ''));
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into r from recursos where slug = p_slug;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if length(v_txt) = 0 or length(v_txt) > 2000 then return jsonb_build_object('status', 'invalido'); end if;
  insert into recurso_comentarios (recurso_id, registro, texto) values (r.id, public.portal_registro_atual(), v_txt);
  return jsonb_build_object('status', 'ok', 'comentarios_lista', public.recurso_comentarios_json(r.id));
end $$;

create or replace function public.recurso_comentario_apagar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c recurso_comentarios;
begin
  if not public.recursos_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into c from recurso_comentarios where id = p_id and apagado_em is null;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if c.registro is distinct from public.portal_registro_atual() and not public.recursos_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  update recurso_comentarios set apagado_em = now() where id = p_id;
  return jsonb_build_object('status', 'ok', 'comentarios_lista', public.recurso_comentarios_json(c.recurso_id));
end $$;

-- 5. permissões -----------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['recursos_pode()', 'recursos_gestao()', 'recurso_comentarios_json(uuid)', 'recurso_json(recursos,boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['recursos_listar()', 'recurso_ler(text)', 'recurso_salvar(jsonb)', 'recurso_avaliar(text,integer)',
                           'recurso_comentar(text,text)', 'recurso_comentario_apagar(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.2_recursos',
 'SOMA 2.19.2: Recursos, o catálogo colaborativo de ferramentas (softwares, repositórios, serviços, benefícios de estudante e gravação de microcontroladores), com avaliação por estrelas e comentários')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select tipo, count(*) from public.recursos group by tipo order by tipo;
-- select r.nome, round(avg(a.estrelas), 1) as media, count(a.*) as avaliacoes from public.recursos r
--   left join public.recurso_avaliacoes a on a.recurso_id = r.id group by r.nome order by media desc nulls last limit 10;
