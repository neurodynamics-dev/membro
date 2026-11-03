-- ============================================================
-- SOMA 2.26.0, MIGRAÇÃO, NeuroDynamics
-- O BANCO DE IMAGENS: UMA FOTO DE CADA VEZ, NAS PEÇAS DA MARCA.
--
-- Na 2.25.0, a foto posta pela gestão do Studio entrava direto no
-- banco, sem ninguém a ver numa peça. Agora a foto nova passa pela
-- avaliação, uma de cada vez, dentro das peças da NRO (feed, story,
-- banda, site), e uma decisão basta, sem votação:
--
--   1. fotos_adicionar: só admin. A foto posta por link ou escolhida
--      na busca vai para a avaliação (a fila). Uma descartada volta
--      para a avaliação; uma que já está na avaliação ou no banco
--      conta como repetida.
--   2. foto_decidir(foto, status, enquadramento, paleta): quem gere o
--      Studio aprova (a foto entra no banco), rejeita (descartada) ou
--      devolve à avaliação uma foto, e guarda a peça e a paleta em que
--      a viu ao aprovar.
--   3. fotos_decidir (várias de uma vez, nas descartadas) e
--      foto_status_definir (a galeria tira uma) continuam como na
--      2.25.0.
--
-- Pré-requisito: a 2.25.0. Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal.
-- ============================================================

do $$
begin
  if to_regprocedure('public.fotos_decidir(uuid[],text)') is null then
    raise exception using message = 'Falta aplicar a 2.25.0 antes desta migração.',
      detail = 'Esta migração muda as funções do banco de imagens (db/2.25.0_fotos_sem_votacao.sql).';
  end if;
end $$;

comment on table public.fotos is
  'O banco de imagens da marca. Aprovada é o banco; fila é a avaliação (o admin põe, a gestão do Studio aprova ou rejeita, uma decisão basta); descartada saiu. Desde a 2.26.0.';
comment on column public.fotos.enquadramento is 'A peça (feed, story, banda, site) em que a foto estava quando foi aprovada.';
comment on column public.fotos.paleta is 'A família de cor em que a foto estava quando foi aprovada.';

-- ============================================================
-- 1. PÔR FOTOS NOVAS: só admin, e elas vão para a avaliação
-- ------------------------------------------------------------
create or replace function public.fotos_adicionar(p_fotos jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  e jsonb; i integer := 0; v_ins boolean;
  v_banco text; v_id text; v_tema text; v_img text; v_pag text;
  n_novas integer := 0; n_reat integer := 0; n_rep integer := 0;
begin
  if coalesce(public.papel_atual(), '') <> 'admin' then return jsonb_build_object('status', 'sem_permissao'); end if;
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
    insert into fotos as f (banco, banco_id, pagina, imagem, descricao, tema, tags, autor, licenca, busca, origem, criado_por, status, manual)
    values (v_banco, trim(e->>'banco_id'), nullif(trim(coalesce(e->>'pagina', '')), ''), v_img,
            left(coalesce(nullif(trim(coalesce(e->>'descricao', '')), ''), 'Foto adicionada por link'), 300),
            nullif(e->>'tema', ''), public.foto_tags_limpas(e->'tags'),
            left(nullif(trim(coalesce(e->>'autor', '')), ''), 120),
            case v_banco when 'unsplash' then 'Licença Unsplash' when 'pexels' then 'Licença Pexels'
                         else left(nullif(trim(coalesce(e->>'licenca', '')), ''), 120) end,
            left(nullif(trim(coalesce(e->>'busca', '')), ''), 120),
            case when e->>'origem' = 'busca' then 'busca' else 'link' end, v_reg, 'fila', false)
    on conflict (banco, banco_id) do update
       set status = 'fila', manual = false, decidida_em = null, decidida_por = null,
           enquadramento = null, paleta = null,
           imagem = coalesce(f.imagem, excluded.imagem), autor = coalesce(f.autor, excluded.autor),
           tema = coalesce(f.tema, excluded.tema),
           tags = case when cardinality(f.tags) = 0 then excluded.tags else f.tags end,
           atualizado_em = now()
     where f.status = 'descartada'
    returning (xmax = 0) into v_ins;
    if not found then n_rep := n_rep + 1;
    elsif v_ins then n_novas := n_novas + 1;
    else n_reat := n_reat + 1; end if;
  end loop;
  return jsonb_build_object('status', 'ok', 'novas', n_novas, 'reativadas', n_reat, 'repetidas', n_rep);
end $$;

-- ============================================================
-- 2. AVALIAR UMA FOTO: aprovar (no banco), rejeitar (descartada) ou
--    devolver à avaliação; ao aprovar, guarda a peça e a paleta
-- ------------------------------------------------------------
create or replace function public.foto_decidir(p_foto uuid, p_status text,
  p_enquadramento text default null, p_paleta text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_n integer;
begin
  if not public.studio_gestor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_status is null or p_status not in ('fila','aprovada','descartada') then
    return jsonb_build_object('status', 'invalido', 'campo', 'status'); end if;
  if p_enquadramento is not null and p_enquadramento not in ('feed','story','banda','site') then
    return jsonb_build_object('status', 'invalido', 'campo', 'enquadramento'); end if;
  if p_paleta is not null and p_paleta not in ('cortex','ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris') then
    return jsonb_build_object('status', 'invalido', 'campo', 'paleta'); end if;
  if p_status = 'fila' then
    update fotos set status = 'fila', manual = false, decidida_em = null, decidida_por = null,
           enquadramento = null, paleta = null, atualizado_em = now()
     where id = p_foto;
  else
    update fotos set status = p_status, manual = true, decidida_em = now(), decidida_por = public.studio_meu_nome(),
           enquadramento = case when p_status = 'aprovada' then coalesce(p_enquadramento, enquadramento) else enquadramento end,
           paleta        = case when p_status = 'aprovada' then coalesce(p_paleta, paleta) else paleta end,
           atualizado_em = now()
     where id = p_foto;
  end if;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('status', 'nao_encontrada'); end if;
  return jsonb_build_object('status', 'ok', 'foto_status', p_status);
end $$;

do $$
begin
  revoke execute on function public.foto_decidir(uuid, text, text, text) from public;
  revoke execute on function public.fotos_adicionar(jsonb) from public;
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke execute on function public.foto_decidir(uuid, text, text, text) from anon;
    revoke execute on function public.fotos_adicionar(jsonb) from anon;
  end if;
  grant execute on function public.foto_decidir(uuid, text, text, text) to authenticated;
  grant execute on function public.fotos_adicionar(jsonb) to authenticated;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.26.0_banco_de_imagens', 'O banco de imagens: o admin põe fotos novas, que vão para a avaliação; quem gere o Studio aprova ou rejeita uma de cada vez, nas peças da marca (foto_decidir guarda a peça e a paleta)')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from fotos where status = 'aprovada') as "no banco",
       (select count(*) from fotos where status = 'fila') as "para avaliar",
       (select count(*) from fotos where status = 'descartada') as rejeitadas;

-- ============================================================
-- FIM, SOMA 2.26.0
--
-- Depois de rodar, publique o portal. Em Studio, Banco de imagens, a
-- gestão avalia as fotos uma de cada vez, e o admin põe fotos novas
-- (busca nos bancos ou por link).
-- ============================================================
