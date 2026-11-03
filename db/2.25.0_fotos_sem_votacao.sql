-- ============================================================
-- SOMA 2.25.0, MIGRAÇÃO, NeuroDynamics
-- O BANCO DE FOTOS SEM VOTAÇÃO, E ABERTO PARA LEITURA.
--
-- Na 2.24.0, a foto entrava no banco pelo voto. Agora quem gere o
-- Studio (studio_gestor) escolhe e a foto entra direto, aprovada:
--
--   1. fotos_adicionar: só a gestão do Studio. A foto posta por link
--      ou escolhida na busca entra aprovada (manual). Uma que estava
--      nas sugestões ou descartada passa a aprovada.
--   2. fotos_decidir(ids, status): a gestão põe várias sugestões no
--      banco de uma vez ("aprovada"), descarta ou devolve às sugestões
--      ("fila").
--   3. foto_status_definir: o mesmo, para uma foto, sem recontar
--      votos.
--   4. Saem as funções da votação: fotos_fila, foto_votar,
--      foto_voto_desfazer e foto_recontar. A tabela foto_votos fica,
--      só como histórico.
--   5. As fotos escolhidas pela equipe na primeira campanha (origem
--      "equipe") que ainda estavam na fila entram no banco.
--   6. fotos_banco_publico(tags, tema): as fotos do banco, só para
--      ler, também com a chave anônima. É por ela que o Claude (e
--      qualquer ferramenta da marca) busca fotos para peças,
--      wallpapers e banners. Só os campos públicos: banco, código,
--      página, imagem, descrição, tema, família, tags, autor, licença.
--
-- A fila continua existindo como "sugestões": as fotos que chegaram
-- e ainda não foram escolhidas. Quem entra no Studio as vê; só a
-- gestão decide.
--
-- Pré-requisito: a 2.24.0. Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal.
-- ============================================================

do $$
begin
  if to_regclass('public.fotos') is null or to_regprocedure('public.studio_gestor()') is null then
    raise exception using message = 'Falta aplicar a 2.24.0 antes desta migração.',
      detail = 'Esta migração muda as funções do banco de fotos (db/2.24.0_fotos.sql).';
  end if;
end $$;

comment on table public.fotos is
  'O banco de fotos da marca. Aprovada é o banco; fila são as sugestões que a gestão do Studio ainda não escolheu; descartada saiu. Desde a 2.25.0, sem votação.';
comment on table public.foto_votos is
  'Histórico da 2.24.0, quando a foto entrava no banco pelo voto. Não recebe mais votos.';

-- ============================================================
-- 1. PÔR NO BANCO: a gestão do Studio, direto como aprovada
-- ------------------------------------------------------------
create or replace function public.fotos_adicionar(p_fotos jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual(); v_nome text := public.studio_meu_nome();
  e jsonb; i integer := 0; v_ins boolean;
  v_banco text; v_id text; v_tema text; v_img text; v_pag text;
  n_novas integer := 0; n_reat integer := 0; n_rep integer := 0;
begin
  if not public.studio_gestor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_fotos is null or jsonb_typeof(p_fotos) <> 'array' or jsonb_array_length(p_fotos) = 0 then
    return jsonb_build_object('status', 'invalido', 'campo', 'fotos'); end if;
  if jsonb_array_length(p_fotos) > 100 then
    return jsonb_build_object('status', 'invalido', 'campo', 'fotos', 'motivo', 'no máximo 100 por vez'); end if;
  for e in select x from jsonb_array_elements(p_fotos) x loop
    i := i + 1;
    v_banco := e->>'banco'; v_id := nullif(trim(coalesce(e->>'banco_id', '')), '');
    v_tema := nullif(e->>'tema', ''); v_pag := nullif(trim(coalesce(e->>'pagina', '')), '');
    if v_banco is null or v_banco not in ('unsplash','pexels','link') or v_id is null or length(v_id) > 300 then
      return jsonb_build_object('status', 'invalido', 'campo', 'banco_id', 'item', i); end if;
    if v_tema is not null and not exists (select 1 from foto_temas where chave = v_tema) then
      return jsonb_build_object('status', 'invalido', 'campo', 'tema', 'item', i); end if;
    if v_pag is not null and v_pag !~ '^https://' then
      return jsonb_build_object('status', 'invalido', 'campo', 'pagina', 'item', i); end if;
  end loop;
  for e in select x from jsonb_array_elements(p_fotos) x loop
    v_banco := e->>'banco'; v_img := nullif(trim(coalesce(e->>'imagem', '')), '');
    if v_img is not null and not public.foto_imagem_valida(v_banco, v_img) then v_img := null; end if;
    insert into fotos as f (banco, banco_id, pagina, imagem, descricao, tema, tags, autor, licenca, busca, origem, criado_por,
                            status, manual, decidida_em, decidida_por)
    values (v_banco, trim(e->>'banco_id'), nullif(trim(coalesce(e->>'pagina', '')), ''), v_img,
            left(coalesce(nullif(trim(coalesce(e->>'descricao', '')), ''), 'Foto adicionada por link'), 300),
            nullif(e->>'tema', ''), public.foto_tags_limpas(e->'tags'),
            left(nullif(trim(coalesce(e->>'autor', '')), ''), 120),
            case v_banco when 'unsplash' then 'Licença Unsplash' when 'pexels' then 'Licença Pexels'
                         else left(nullif(trim(coalesce(e->>'licenca', '')), ''), 120) end,
            left(nullif(trim(coalesce(e->>'busca', '')), ''), 120),
            case when e->>'origem' = 'busca' then 'busca' else 'link' end, v_reg,
            'aprovada', true, now(), v_nome)
    on conflict (banco, banco_id) do update
       set status = 'aprovada', manual = true, decidida_em = now(), decidida_por = v_nome,
           imagem = coalesce(f.imagem, excluded.imagem), autor = coalesce(f.autor, excluded.autor),
           tema = coalesce(f.tema, excluded.tema),
           tags = case when cardinality(f.tags) = 0 then excluded.tags else f.tags end,
           atualizado_em = now()
     where f.status <> 'aprovada'
    returning (xmax = 0) into v_ins;
    if not found then n_rep := n_rep + 1;
    elsif v_ins then n_novas := n_novas + 1;
    else n_reat := n_reat + 1; end if;
  end loop;
  return jsonb_build_object('status', 'ok', 'novas', n_novas, 'reativadas', n_reat, 'repetidas', n_rep);
end $$;

-- ============================================================
-- 2. ESCOLHER VÁRIAS DE UMA VEZ: no banco, descartada ou de volta às
--    sugestões
-- ------------------------------------------------------------
create or replace function public.fotos_decidir(p_ids uuid[], p_status text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_n integer;
begin
  if not public.studio_gestor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_status is null or p_status not in ('fila','aprovada','descartada') then
    return jsonb_build_object('status', 'invalido', 'campo', 'status'); end if;
  if p_ids is null or cardinality(p_ids) = 0 or cardinality(p_ids) > 200 then
    return jsonb_build_object('status', 'invalido', 'campo', 'ids'); end if;
  if p_status = 'fila' then
    update fotos set status = 'fila', manual = false, decidida_em = null, decidida_por = null, atualizado_em = now()
     where id = any(p_ids);
  else
    update fotos set status = p_status, manual = true, decidida_em = now(),
           decidida_por = public.studio_meu_nome(), atualizado_em = now()
     where id = any(p_ids);
  end if;
  get diagnostics v_n = row_count;
  return jsonb_build_object('status', 'ok', 'fotos', v_n);
end $$;

-- ============================================================
-- 3. UMA FOTO SÓ (a galeria tira por aqui), sem recontar votos
-- ------------------------------------------------------------
create or replace function public.foto_status_definir(p_foto uuid, p_status text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from fotos where id = p_foto) and public.studio_gestor() then
    return jsonb_build_object('status', 'nao_encontrada'); end if;
  r := public.fotos_decidir(array[p_foto], p_status);
  if r->>'status' <> 'ok' then return r; end if;
  return jsonb_build_object('status', 'ok', 'foto_status', p_status);
end $$;

-- ============================================================
-- 4. SAI A VOTAÇÃO
-- ------------------------------------------------------------
drop function if exists public.fotos_fila(text[], integer);
drop function if exists public.foto_votar(uuid, text, text, text);
drop function if exists public.foto_voto_desfazer(uuid);
drop function if exists public.foto_recontar(uuid);

-- ============================================================
-- 5. AS ESCOLHIDAS PELA EQUIPE ENTRAM NO BANCO
-- ------------------------------------------------------------
update public.fotos set status = 'aprovada', manual = true, decidida_em = now(),
       decidida_por = 'Seleção da equipe', atualizado_em = now()
 where origem = 'equipe' and status = 'fila';

-- ============================================================
-- 6. O BANCO PARA LER, TAMBÉM SEM CONTA: as fotos aprovadas, só os
--    campos públicos. Tags e tema filtram; sem eles, vem o banco todo
--    (até 500, das mais recentes).
-- ------------------------------------------------------------
create or replace function public.fotos_banco_publico(p_tags text[] default null, p_tema text default null)
returns jsonb language sql stable security definer
set search_path = public as $$
  with sel as (
    select f.*, t.nome as tema_nome, t.familia
      from fotos f left join foto_temas t on t.chave = f.tema
     where f.status = 'aprovada'
       and (p_tema is null or f.tema = p_tema)
       and (p_tags is null or cardinality(p_tags) = 0
            or exists (select 1 from unnest(f.tags) x, unnest(p_tags) y where lower(x) = lower(trim(y))))
     order by f.decidida_em desc nulls last, f.criado_em desc
     limit 500)
  select jsonb_build_object('status', 'ok', 'total', (select count(*) from sel), 'fotos', coalesce(jsonb_agg(jsonb_build_object(
           'banco', banco, 'banco_id', banco_id, 'pagina', pagina, 'imagem', imagem, 'descricao', descricao,
           'tema', tema, 'tema_nome', tema_nome, 'familia', familia, 'tags', to_jsonb(tags),
           'autor', autor, 'licenca', licenca, 'enquadramento', enquadramento, 'paleta', paleta)
           order by decidida_em desc nulls last, criado_em desc), '[]'::jsonb))
    from sel;
$$;
comment on function public.fotos_banco_publico(text[], text) is
  'As fotos do banco (aprovadas), só para ler, também com a chave anônima: é por aqui que o Claude e as ferramentas da marca buscam fotos.';

do $$
declare f text;
begin
  foreach f in array array['fotos_adicionar(jsonb)', 'fotos_decidir(uuid[],text)', 'foto_status_definir(uuid,text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  revoke execute on function public.fotos_banco_publico(text[], text) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.fotos_banco_publico(text[], text) to anon; end if;
  grant execute on function public.fotos_banco_publico(text[], text) to authenticated;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.25.0_fotos_sem_votacao', 'O banco de fotos sem votação: a gestão do Studio põe as fotos direto no banco (fotos_adicionar, fotos_decidir), sem as funções de voto; as escolhidas pela equipe entram no banco; fotos_banco_publico abre as aprovadas para leitura, também com a chave anônima')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from fotos where status = 'aprovada') as "no banco",
       (select count(*) from fotos where status = 'fila') as sugestões,
       (select count(*) from fotos where status = 'descartada') as descartadas;

-- ============================================================
-- FIM, SOMA 2.25.0
--
-- Depois de rodar, publique o portal. Em Studio, Curadoria de fotos, a
-- gestão escolhe nas sugestões, busca nos bancos ou põe por link, e a
-- foto entra direto no banco. O banco também se lê sem conta:
--   POST /rest/v1/rpc/fotos_banco_publico  {"p_tags":["UTI"]}
-- ============================================================
