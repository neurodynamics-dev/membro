-- ============================================================
-- SOMA 2.24.0, MIGRAÇÃO, NeuroDynamics
-- O BANCO DE FOTOS: A CURADORIA NO STUDIO E A GALERIA NA MARCA.
--
-- As fotos que a marca usa (Unsplash, Pexels, links) passam por uma
-- curadoria no Studio. Aprovadas, ficam na galeria da Marca, para toda
-- a equipe, e no criador do Studio, para as peças.
--
--   1. foto_temas: os temas da curadoria (dispositivos, hospital,
--      laboratório...), cada um com a família de cor da marca, a frase
--      e o subtítulo das peças de prova e os termos de busca.
--   2. fotos: uma linha por foto (banco e código, sem repetir), com a
--      página, o endereço da imagem quando já se sabe, a descrição, o
--      tema, as tags, o autor, a licença, o termo que a trouxe e de onde
--      veio (equipe, sugestão, link, busca). O status é fila, aprovada
--      ou descartada.
--   3. foto_votos: o voto de cada pessoa (sim, não, talvez), com a peça
--      e a família em que a pessoa viu a foto.
--
--   APROVADA É O VOTO QUE DIZ. A foto sai da fila quando os "sim"
--   chegam ao número de aprovações do Studio
--   (studio_config.aprovacoes_minimas, de 1 a 3) e passam os "não";
--   é descartada quando os "não" chegam lá e não perdem para os "sim".
--   "Talvez" não conta. A gestão do Studio aprova ou tira da galeria à
--   mão (foto_status_definir), e então os votos deixam de mudar o
--   status, até a foto voltar para a fila.
--
--   4. studio_config.pexels_chave: a chave da API do Pexels, ao lado
--      da do Unsplash.
--
-- Votam e põem fotos na fila os que entram no Studio
-- (studio_pode_acessar). A galeria (as aprovadas) é de toda conta
-- ativa. Escrita só pelas funções: fotos_fila, foto_votar,
-- foto_voto_desfazer, fotos_adicionar, foto_salvar,
-- foto_imagem_definir e foto_status_definir.
--
-- A semente: os 11 temas e as 90 fotos da primeira campanha (as 11
-- escolhidas pela equipe e as sugestões buscadas por tema, só de
-- licença livre). Entram na fila.
--
-- Pré-requisitos: a v23 (Studio) e a 2.18.0 (conta_ativa,
-- portal_registro_atual). Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal.
-- ============================================================

do $$
begin
  if to_regclass('public.studio_config') is null or to_regprocedure('public.studio_pode_acessar()') is null then
    raise exception using message = 'Falta aplicar a v23 antes desta migração.',
      detail = 'Quem faz a curadoria é quem entra no Studio (studio_pode_acessar), e o número de aprovações vem de studio_config.';
  end if;
  if to_regprocedure('public.portal_registro_atual()') is null or to_regprocedure('public.conta_ativa()') is null then
    raise exception using message = 'Falta aplicar a 2.18.0 antes desta migração.',
      detail = 'O voto é do registro da conta (portal_registro_atual), e a galeria é de toda conta ativa.';
  end if;
end $$;

-- ============================================================
-- 1. A CHAVE DO PEXELS, ao lado da do Unsplash
-- ------------------------------------------------------------
alter table public.studio_config add column if not exists pexels_chave text;
comment on column public.studio_config.pexels_chave is
  'API Key do Pexels. Como a do Unsplash, é usada no navegador para buscar e para achar o endereço da imagem.';

-- ============================================================
-- 2. OS TEMAS
-- ------------------------------------------------------------
create table if not exists public.foto_temas (
  chave   text primary key check (chave ~ '^[a-z0-9_]+$'),
  nome    text not null,
  familia text not null default 'cortex' check (familia in ('cortex','ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris')),
  titulo  text not null default '',
  sub     text not null default '',
  termos  text[] not null default '{}',
  ordem   integer not null default 0
);
comment on table public.foto_temas is
  'Os temas da curadoria: a família de cor e a frase das peças de prova, e os termos de busca de cada tema.';

insert into public.foto_temas (chave, nome, familia, titulo, sub, termos, ordem) values
  ('dispositivos', 'Dispositivos', 'ion', 'Dispositivos que ajudam o cuidado a chegar às pessoas.', 'Firmware, eletrônica e inteligência embarcada para dispositivos de grau médico.', array['electrotherapy','electrical stimulation','medical device','pulse oximeter']::text[], 10),
  ('sinais', 'Sinais e dados', 'neuron', 'Do sinal fisiológico à conclusão defensável.', 'Aquisição, processamento e interpretação de EEG, EMG, ECG e IMU.', array['ecg monitor','vital signs monitor','heartbeat line','eeg']::text[], 20),
  ('hospital', 'Ambiente hospitalar', 'glia', 'Tecnologia pensada para a beira do leito.', 'Da UTI à reabilitação, ao lado de quem cuida do paciente.', array['hospital icu','intensive care unit','hospital corridor','operating room']::text[], 30),
  ('cuidado', 'Cuidado e consulta', 'retina', 'O cuidado acompanhado entre as consultas.', 'Saúde digital que chega ao médico como informação pronta para agir.', array['doctor patient tablet','telemedicine','chemotherapy infusion','oncology nurse']::text[], 40),
  ('reabilitacao', 'Reabilitação', 'ritmo', 'Reabilitação com os próprios músculos.', 'Eletroestimulação, pedalada assistida e tecnologia assistiva.', array['physical rehabilitation','physiotherapy','wheelchair','prosthetic leg','stationary bike']::text[], 50),
  ('laboratorio', 'Laboratório', 'nexo', 'Da bancada à clínica.', 'Pesquisa traduzida em protótipos que funcionam e resultados mensuráveis.', array['research laboratory','microscope','pipette','lab automation']::text[], 60),
  ('eletronica', 'Eletrônica e prototipagem', 'lumen', 'Código que vive perto do metal.', 'Placas, firmware de tempo real e prototipagem no LABBIO.', array['circuit board','soldering','oscilloscope','microcontroller','3d printer']::text[], 70),
  ('equipe', 'Equipe e desenvolvimento', 'impulso', 'Projetos reais, prazos reais.', 'O ritmo de uma empresa, dentro da universidade.', array['software developers','team whiteboard','students laptop','coding']::text[], 80),
  ('neuro', 'Cérebro e neurociência', 'dendrito', 'Do sinal à decisão.', 'Interfaces cérebro-máquina, neuromodulação e neurociência aplicada.', array['human brain','brain model','neuroscience','brain scan']::text[], 90),
  ('digital', 'Saúde digital e wearables', 'plexo', 'Dados do dia a dia, resumidos para a clínica.', 'Relógios, sensores e apps que conversam com o prontuário.', array['smartwatch heart rate','wearable health','health app']::text[], 100),
  ('abstrato', 'Abstrato', 'iris', 'Sistemas inteligentes para a saúde humana.', 'Iniciativa sem fins lucrativos de P&D em saúde, na Escola de Engenharia da UFMG.', array['abstract light','neural network','cells']::text[], 110)
on conflict (chave) do nothing;

-- ============================================================
-- 3. AS FOTOS E OS VOTOS
-- ------------------------------------------------------------
create table if not exists public.fotos (
  id            uuid primary key default gen_random_uuid(),
  banco         text not null check (banco in ('unsplash','pexels','link')),
  banco_id      text not null check (banco_id <> ''),
  pagina        text,
  imagem        text,
  descricao     text not null default '',
  tema          text references public.foto_temas(chave) on update cascade on delete set null,
  tags          text[] not null default '{}',
  autor         text,
  licenca       text,
  busca         text,
  origem        text not null default 'sugestao' check (origem in ('equipe','sugestao','link','busca')),
  status        text not null default 'fila' check (status in ('fila','aprovada','descartada')),
  manual        boolean not null default false,
  votos_sim     integer not null default 0,
  votos_nao     integer not null default 0,
  votos_talvez  integer not null default 0,
  enquadramento text,
  paleta        text,
  decidida_em   timestamptz,
  decidida_por  text,
  criado_por    integer,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (banco, banco_id)
);
create index if not exists fotos_status on public.fotos (status);
create index if not exists fotos_tags on public.fotos using gin (tags);
comment on table public.fotos is
  'O banco de fotos da marca. Fila, aprovada ou descartada: aprovada é o voto que diz (foto_recontar), ou a gestão do Studio à mão (manual).';
comment on column public.fotos.imagem is
  'O endereço da imagem, quando se sabe (images.unsplash.com, images.pexels.com ou o link direto). É o que o criador usa no canvas.';
comment on column public.fotos.enquadramento is 'A peça (feed, story, banda, site) em que estava o último "sim" da aprovação.';
comment on column public.fotos.paleta is 'A família de cor em que estava o último "sim" da aprovação.';

create table if not exists public.foto_votos (
  foto_id       uuid not null references public.fotos(id) on delete cascade,
  registro      integer not null,
  decisao       text not null check (decisao in ('sim','nao','talvez')),
  enquadramento text check (enquadramento in ('feed','story','banda','site')),
  paleta        text check (paleta in ('cortex','ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris')),
  criado_em     timestamptz not null default now(),
  primary key (foto_id, registro)
);
comment on table public.foto_votos is 'Um voto por pessoa e foto. Mudar o voto troca a linha; desfazer apaga.';

-- ============================================================
-- 4. QUEM FAZ A CURADORIA
-- ------------------------------------------------------------
create or replace function public.foto_curador()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.studio_pode_acessar(), false);
$$;

-- tags: sem espaço sobrando, sem repetir (sem diferenciar maiúscula), até 12, cada uma até 40 letras
create or replace function public.foto_tags_limpas(p jsonb)
returns text[] language sql immutable
set search_path = public as $$
  select coalesce(array_agg(t order by primeira), '{}')
    from (select min(regexp_replace(trim(x), '\s+', ' ', 'g')) as t, min(n) as primeira
            from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
                 with ordinality as e(x, n)
           where trim(x) <> '' and length(trim(x)) <= 40
           group by lower(regexp_replace(trim(x), '\s+', ' ', 'g'))
           order by min(n) limit 12) s;
$$;

-- o endereço de imagem aceito: o CDN do banco ou, para link, qualquer https
create or replace function public.foto_imagem_valida(p_banco text, p_url text)
returns boolean language sql immutable
set search_path = public as $$
  select p_url is not null and p_url !~ '\s' and case
    when p_banco = 'unsplash' then p_url ~ '^https://images\.unsplash\.com/'
    when p_banco = 'pexels'   then p_url ~ '^https://images\.pexels\.com/'
    else p_url ~ '^https://' end;
$$;

-- ============================================================
-- 5. A CONTA DOS VOTOS
-- ------------------------------------------------------------
create or replace function public.foto_recontar(p_foto uuid)
returns text language plpgsql volatile security definer
set search_path = public as $$
declare
  f fotos%rowtype; v_sim integer; v_nao integer; v_tal integer; v_min integer;
  v_status text; v_enq text; v_pal text;
begin
  select * into f from fotos where id = p_foto for update;
  if not found then return null; end if;
  select count(*) filter (where decisao = 'sim'), count(*) filter (where decisao = 'nao'),
         count(*) filter (where decisao = 'talvez')
    into v_sim, v_nao, v_tal from foto_votos where foto_id = p_foto;
  v_min := greatest(1, coalesce((select aprovacoes_minimas from studio_config limit 1), 1));
  v_status := case when f.manual then f.status
                   when v_sim >= v_min and v_sim > v_nao then 'aprovada'
                   when v_nao >= v_min and v_nao >= v_sim then 'descartada'
                   else 'fila' end;
  select enquadramento, paleta into v_enq, v_pal
    from foto_votos where foto_id = p_foto and decisao = 'sim' order by criado_em desc limit 1;
  update fotos set
    votos_sim = v_sim, votos_nao = v_nao, votos_talvez = v_tal, status = v_status,
    enquadramento = case when f.manual then f.enquadramento when v_status = 'aprovada' then v_enq else null end,
    paleta        = case when f.manual then f.paleta        when v_status = 'aprovada' then v_pal else null end,
    decidida_em   = case when v_status = f.status then f.decidida_em when v_status = 'fila' then null else now() end,
    decidida_por  = case when v_status = f.status then f.decidida_por when v_status = 'fila' then null else 'Votos da curadoria' end,
    atualizado_em = now()
   where id = p_foto;
  return v_status;
end $$;
revoke execute on function public.foto_recontar(uuid) from public, anon, authenticated;

-- ============================================================
-- 6. A FILA E O VOTO
-- ------------------------------------------------------------
-- O que falta a pessoa votar: primeiro o que acabou de entrar (por link
-- ou busca), depois a seleção da equipe, depois as sugestões, um tema de
-- cada vez. A contagem é do que falta, não do que veio.
create or replace function public.fotos_fila(p_temas text[] default null, p_limite integer default 30)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_fotos jsonb; v_rest integer;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  with base as (
    select f.id, f.banco, f.banco_id, f.pagina, f.imagem, f.descricao, f.tema, f.tags, f.autor, f.licenca,
           f.busca, f.origem, f.votos_sim, f.votos_nao, f.votos_talvez, f.criado_em,
           case when f.origem in ('link','busca') then 0 when f.origem = 'equipe' then 1 else 2 end as grupo,
           row_number() over (partition by f.tema order by f.criado_em, f.id) as rn,
           coalesce(t.ordem, 9999) as tordem
      from fotos f left join foto_temas t on t.chave = f.tema
     where f.status = 'fila'
       and (p_temas is null or cardinality(p_temas) = 0 or f.tema = any(p_temas))
       and not exists (select 1 from foto_votos v where v.foto_id = f.id and v.registro = v_reg)),
  ordem as (
    select b.*, row_number() over (order by b.grupo,
             case when b.grupo = 0 then extract(epoch from now() - b.criado_em) else b.rn end,
             b.tordem, b.criado_em, b.id) as pos
      from base b)
  select (select count(*) from ordem),
         coalesce((select jsonb_agg(to_jsonb(o) - 'grupo' - 'rn' - 'tordem' - 'pos' - 'criado_em' order by o.pos)
                     from ordem o where o.pos <= greatest(1, least(coalesce(p_limite, 30), 200))), '[]'::jsonb)
    into v_rest, v_fotos;
  return jsonb_build_object('status', 'ok', 'fotos', v_fotos, 'restantes', v_rest,
    'minimas', greatest(1, coalesce((select aprovacoes_minimas from studio_config limit 1), 1)));
end $$;

create or replace function public.foto_votar(p_foto uuid, p_decisao text,
  p_enquadramento text default null, p_paleta text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_status text;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  if p_decisao is null or p_decisao not in ('sim','nao','talvez') then
    return jsonb_build_object('status', 'invalido', 'campo', 'decisao'); end if;
  if p_enquadramento is not null and p_enquadramento not in ('feed','story','banda','site') then
    return jsonb_build_object('status', 'invalido', 'campo', 'enquadramento'); end if;
  if p_paleta is not null and p_paleta not in ('cortex','ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris') then
    return jsonb_build_object('status', 'invalido', 'campo', 'paleta'); end if;
  if not exists (select 1 from fotos where id = p_foto) then return jsonb_build_object('status', 'nao_encontrada'); end if;
  -- clock_timestamp: o "último sim" é o último mesmo, até dentro de uma transação
  insert into foto_votos (foto_id, registro, decisao, enquadramento, paleta, criado_em)
  values (p_foto, v_reg, p_decisao, p_enquadramento, p_paleta, clock_timestamp())
  on conflict (foto_id, registro) do update
    set decisao = excluded.decisao, enquadramento = excluded.enquadramento,
        paleta = excluded.paleta, criado_em = clock_timestamp();
  v_status := public.foto_recontar(p_foto);
  return jsonb_build_object('status', 'ok', 'foto_status', v_status);
end $$;

create or replace function public.foto_voto_desfazer(p_foto uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_status text;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  delete from foto_votos where foto_id = p_foto and registro = v_reg;
  if not found then return jsonb_build_object('status', 'sem_voto'); end if;
  v_status := public.foto_recontar(p_foto);
  return jsonb_build_object('status', 'ok', 'foto_status', v_status);
end $$;

-- ============================================================
-- 7. PÔR NA FILA, EDITAR, A IMAGEM, A DECISÃO DA GESTÃO
-- ------------------------------------------------------------
-- Até 100 por vez, tudo ou nada na validação; as repetidas (mesmo banco
-- e código) ficam como estão.
create or replace function public.fotos_adicionar(p_fotos jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual(); e jsonb; i integer := 0;
  v_banco text; v_id text; v_tema text; v_img text; v_pag text; n_novas integer := 0; n_rep integer := 0;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
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
    insert into fotos (banco, banco_id, pagina, imagem, descricao, tema, tags, autor, licenca, busca, origem, criado_por)
    values (v_banco, trim(e->>'banco_id'), nullif(trim(coalesce(e->>'pagina', '')), ''), v_img,
            left(coalesce(nullif(trim(coalesce(e->>'descricao', '')), ''), 'Foto adicionada por link'), 300),
            nullif(e->>'tema', ''), public.foto_tags_limpas(e->'tags'),
            left(nullif(trim(coalesce(e->>'autor', '')), ''), 120),
            case v_banco when 'unsplash' then 'Licença Unsplash' when 'pexels' then 'Licença Pexels'
                         else left(nullif(trim(coalesce(e->>'licenca', '')), ''), 120) end,
            left(nullif(trim(coalesce(e->>'busca', '')), ''), 120),
            case when e->>'origem' = 'busca' then 'busca' else 'link' end, v_reg)
    on conflict (banco, banco_id) do nothing;
    if found then n_novas := n_novas + 1; else n_rep := n_rep + 1; end if;
  end loop;
  return jsonb_build_object('status', 'ok', 'novas', n_novas, 'repetidas', n_rep);
end $$;

-- A descrição, o tema, as tags e o autor. Só as chaves que vierem mudam.
create or replace function public.foto_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_id uuid; v_tema text;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if coalesce(p->>'id', '') !~ '^[0-9a-fA-F-]{36}$' then return jsonb_build_object('status', 'invalido', 'campo', 'id'); end if;
  v_id := (p->>'id')::uuid;
  if not exists (select 1 from fotos where id = v_id) then return jsonb_build_object('status', 'nao_encontrada'); end if;
  v_tema := nullif(p->>'tema', '');
  if p ? 'tema' and v_tema is not null and not exists (select 1 from foto_temas where chave = v_tema) then
    return jsonb_build_object('status', 'invalido', 'campo', 'tema'); end if;
  update fotos set
    descricao = case when p ? 'descricao' then left(coalesce(nullif(trim(coalesce(p->>'descricao', '')), ''), descricao), 300) else descricao end,
    tema      = case when p ? 'tema' then v_tema else tema end,
    tags      = case when p ? 'tags' then public.foto_tags_limpas(p->'tags') else tags end,
    autor     = case when p ? 'autor' then left(nullif(trim(coalesce(p->>'autor', '')), ''), 120) else autor end,
    atualizado_em = now()
   where id = v_id;
  return jsonb_build_object('status', 'ok');
end $$;

-- O endereço da imagem que a API do banco devolveu (com a chave do
-- Studio, no navegador). O autor entra se ainda não havia.
create or replace function public.foto_imagem_definir(p_foto uuid, p_imagem text, p_autor text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_banco text;
begin
  if not public.foto_curador() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select banco into v_banco from fotos where id = p_foto;
  if not found then return jsonb_build_object('status', 'nao_encontrada'); end if;
  if not public.foto_imagem_valida(v_banco, p_imagem) then return jsonb_build_object('status', 'invalido', 'campo', 'imagem'); end if;
  update fotos set imagem = p_imagem,
         autor = coalesce(autor, left(nullif(trim(coalesce(p_autor, '')), ''), 120)),
         atualizado_em = now()
   where id = p_foto;
  return jsonb_build_object('status', 'ok');
end $$;

-- A gestão do Studio aprova ou descarta à mão; "fila" devolve aos votos.
create or replace function public.foto_status_definir(p_foto uuid, p_status text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_status text;
begin
  if not public.studio_gestor() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_status is null or p_status not in ('fila','aprovada','descartada') then
    return jsonb_build_object('status', 'invalido', 'campo', 'status'); end if;
  if not exists (select 1 from fotos where id = p_foto) then return jsonb_build_object('status', 'nao_encontrada'); end if;
  if p_status = 'fila' then
    update fotos set manual = false, status = 'fila' where id = p_foto;
    v_status := public.foto_recontar(p_foto);
  else
    update fotos set manual = true, status = p_status, decidida_em = now(),
           decidida_por = public.studio_meu_nome(), atualizado_em = now()
     where id = p_foto;
    v_status := p_status;
  end if;
  return jsonb_build_object('status', 'ok', 'foto_status', v_status);
end $$;

do $$
declare f text;
begin
  foreach f in array array['foto_curador()', 'fotos_fila(text[],integer)', 'foto_votar(uuid,text,text,text)',
                           'foto_voto_desfazer(uuid)', 'fotos_adicionar(jsonb)', 'foto_salvar(jsonb)',
                           'foto_imagem_definir(uuid,text,text)', 'foto_status_definir(uuid,text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 8. QUEM LÊ
--    Os temas, toda a equipe. As fotos: as aprovadas, toda conta ativa
--    (a galeria); a fila e as descartadas, quem faz a curadoria. Os
--    votos, cada um os seus.
-- ------------------------------------------------------------
alter table public.foto_temas enable row level security;
drop policy if exists foto_temas_select on public.foto_temas;
create policy foto_temas_select on public.foto_temas for select to authenticated using (true);
grant select on public.foto_temas to authenticated;

alter table public.fotos enable row level security;
drop policy if exists fotos_select on public.fotos;
create policy fotos_select on public.fotos for select to authenticated
  using (status = 'aprovada' or (select public.foto_curador()));
grant select on public.fotos to authenticated;

alter table public.foto_votos enable row level security;
drop policy if exists foto_votos_select on public.foto_votos;
create policy foto_votos_select on public.foto_votos for select to authenticated
  using (registro = (select public.portal_registro_atual()));
grant select on public.foto_votos to authenticated;

-- ============================================================
-- 9. A SEMENTE: a primeira campanha, na fila
-- ------------------------------------------------------------
insert into public.fotos (banco, banco_id, pagina, descricao, tema, tags, autor, licenca, busca, origem) values
  ('unsplash', '9xHsWmh3m_4', 'https://unsplash.com/photos/9xHsWmh3m_4', 'Braço robótico de laboratório em luz azul', 'laboratorio', array['robótica','automação','laboratório']::text[], 'Testalize.me', 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'lQGJCMY5qcM', 'https://unsplash.com/photos/lQGJCMY5qcM', 'Três béqueres sobre a bancada', 'laboratorio', array['vidraria','béquer','laboratório']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'L7en7Lb-Ovc', 'https://unsplash.com/photos/L7en7Lb-Ovc', 'Células em roxo', 'abstrato', array['células','microscopia','abstrato']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'y5hQCIn1c6o', 'https://unsplash.com/photos/y5hQCIn1c6o', 'Equipe cirúrgica no centro cirúrgico', 'hospital', array['centro cirúrgico','equipe médica','hospital']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'ct10qdGv1hQ', 'https://unsplash.com/photos/ct10qdGv1hQ', 'Silhueta de pessoa ao microscópio', 'laboratorio', array['microscópio','pesquisa','silhueta']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'G8EfpFaGBWM', 'https://unsplash.com/photos/G8EfpFaGBWM', 'Mão segurando um tablet branco', 'digital', array['tablet','app','saúde digital']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'SVmaaACzcJ8', 'https://unsplash.com/photos/SVmaaACzcJ8', 'Pia de cerâmica com torneira de inox', 'hospital', array['hospital','higiene','ambiente']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', '2fyeLhUeYpg', 'https://unsplash.com/photos/2fyeLhUeYpg', 'Agulhas de laboratório dispensando em frascos', 'laboratorio', array['frascos','automação','laboratório']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'h2RT2cl7mxA', 'https://unsplash.com/photos/h2RT2cl7mxA', 'Cirurgião se preparando para a operação', 'hospital', array['cirurgião','centro cirúrgico','hospital']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'ii6BOPjAtVY', 'https://unsplash.com/photos/ii6BOPjAtVY', 'Cérebro humano sobre fundo preto', 'neuro', array['cérebro','neurociência','anatomia']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'Kile7-U74s0', 'https://unsplash.com/photos/Kile7-U74s0', 'Feixes de luz azul e roxa formando uma cabeça', 'abstrato', array['luz','cabeça','abstrato']::text[], null, 'Licença Unsplash', null, 'equipe'),
  ('unsplash', 'mvHuY-t4QII', 'https://unsplash.com/photos/mvHuY-t4QII', 'Eletroterapia aplicada no joelho', 'dispositivos', array['eletroterapia','eletroestimulação','fisioterapia']::text[], 'Terry Shultz P.T.', 'Licença Unsplash', 'electrotherapy', 'sugestao'),
  ('unsplash', '-msTEzGwKJs', 'https://unsplash.com/photos/-msTEzGwKJs', 'Oxímetro de pulso no dedo, fundo branco', 'dispositivos', array['oxímetro','dispositivo médico','sinais vitais']::text[], 'Mockup Graphics', 'Licença Unsplash', 'pulse oximeter', 'sugestao'),
  ('unsplash', 'wSTCaQpiLtc', 'https://unsplash.com/photos/wSTCaQpiLtc', 'Braço robótico sobre placa de circuito', 'dispositivos', array['robótica','braço robótico','eletrônica']::text[], null, 'Licença Unsplash', 'robotic arm', 'sugestao'),
  ('unsplash', '0lrJo37r6Nk', 'https://unsplash.com/photos/0lrJo37r6Nk', 'Monitor com sinais vitais em verde', 'sinais', array['monitor','sinais vitais','UTI']::text[], 'Jair Lázaro', 'Licença Unsplash', 'vital signs monitor', 'sugestao'),
  ('unsplash', 'beXUIzvxW-Q', 'https://unsplash.com/photos/beXUIzvxW-Q', 'Tela de monitor com batimento cardíaco', 'sinais', array['ECG','monitor','sinais vitais']::text[], 'Joshua Chehov', 'Licença Unsplash', 'ecg monitor', 'sugestao'),
  ('unsplash', 'ZSo4axN3ZXI', 'https://unsplash.com/photos/ZSo4axN3ZXI', 'Traçado de ECG na tela', 'sinais', array['ECG','monitor','sinais vitais']::text[], null, 'Licença Unsplash', 'ecg monitor', 'sugestao'),
  ('unsplash', 'oCSol-lBtVA', 'https://unsplash.com/photos/oCSol-lBtVA', 'Batimento verde sobre fundo preto', 'sinais', array['ECG','batimento','sinal']::text[], null, 'Licença Unsplash', 'heartbeat line', 'sugestao'),
  ('unsplash', '-iaHr12PVQg', 'https://unsplash.com/photos/-iaHr12PVQg', 'Traçado de ECG impresso em papel', 'sinais', array['ECG','batimento','sinal']::text[], null, 'Licença Unsplash', 'heartbeat line', 'sugestao'),
  ('unsplash', 'r427ZzVVbwU', 'https://unsplash.com/photos/r427ZzVVbwU', 'Tela azul de osciloscópio', 'sinais', array['osciloscópio','bancada','sinal']::text[], 'Julio Gutierrez', 'Licença Unsplash', 'oscilloscope', 'sugestao'),
  ('unsplash', 'J12RfFH-2ZE', 'https://unsplash.com/photos/J12RfFH-2ZE', 'Treinamento de UTI em simulação', 'hospital', array['UTI','hospital','leito']::text[], null, 'Licença Unsplash', 'hospital icu', 'sugestao'),
  ('unsplash', 'CjgwW0VR3d0', 'https://unsplash.com/photos/CjgwW0VR3d0', 'Quarto de hospital com leito e monitor', 'hospital', array['monitor','hospital','UTI']::text[], 'Frederic Köberl', 'Licença Unsplash', 'patient monitor', 'sugestao'),
  ('unsplash', 'BvS7q4yFQt4', 'https://unsplash.com/photos/BvS7q4yFQt4', 'Monitor de ECG e saturação em simulação clínica', 'hospital', array['monitor','hospital','UTI']::text[], 'Tim Cooper', 'Licença Unsplash', 'patient monitor', 'sugestao'),
  ('unsplash', '0Fv4M2hSZJU', 'https://unsplash.com/photos/0Fv4M2hSZJU', 'Médico de jaleco olhando o monitor', 'hospital', array['monitor','hospital','UTI']::text[], null, 'Licença Unsplash', 'patient monitor', 'sugestao'),
  ('unsplash', 'pfAnqlk3Oiw', 'https://unsplash.com/photos/pfAnqlk3Oiw', 'Corredor vazio entre paredes brancas', 'hospital', array['corredor','hospital','ambiente']::text[], 'Dominik Kuhn', 'Licença Unsplash', 'hospital corridor', 'sugestao'),
  ('unsplash', '_f7aNucnTuU', 'https://unsplash.com/photos/_f7aNucnTuU', 'Corredor longo com luz do sol', 'hospital', array['corredor','hospital','ambiente']::text[], 'Chris Wang', 'Licença Unsplash', 'hospital corridor', 'sugestao'),
  ('unsplash', 'ShJUYkshceY', 'https://unsplash.com/photos/ShJUYkshceY', 'Leito hospitalar vazio', 'hospital', array['leito','hospital','UTI']::text[], null, 'Licença Unsplash', 'hospital bed', 'sugestao'),
  ('unsplash', 'w7Pby5bDKW4', 'https://unsplash.com/photos/w7Pby5bDKW4', 'Leito hospitalar junto à parede branca', 'hospital', array['leito','hospital','UTI']::text[], null, 'Licença Unsplash', 'hospital bed', 'sugestao'),
  ('pexels', '20897577', 'https://www.pexels.com/photo/20897577/', 'Paciente em UTI depois de cirurgia cardíaca', 'hospital', array['UTI','paciente','hospital']::text[], 'Engin Akyurt', 'Licença Pexels', 'intensive care unit', 'sugestao'),
  ('unsplash', 'X_tBkG0U9yM', 'https://unsplash.com/photos/X_tBkG0U9yM', 'Médica mostra exames de ressonância no tablet', 'cuidado', array['consulta','médico','tablet']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'doctor patient tablet', 'sugestao'),
  ('unsplash', 'Wl3hAbxMF80', 'https://unsplash.com/photos/Wl3hAbxMF80', 'Médico analisa ressonância no tablet', 'cuidado', array['ressonância','cérebro','exame']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'brain scan', 'sugestao'),
  ('unsplash', 'sLddRFha0_Q', 'https://unsplash.com/photos/sLddRFha0_Q', 'Consulta médica por vídeo', 'cuidado', array['telemedicina','consulta','vídeo']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'telemedicine', 'sugestao'),
  ('unsplash', '2kopEHjST-g', 'https://unsplash.com/photos/2kopEHjST-g', 'Dois médicos olhando um tablet', 'cuidado', array['consulta','médico','tablet']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'doctor patient tablet', 'sugestao'),
  ('unsplash', 'bM4MXYPY61U', 'https://unsplash.com/photos/bM4MXYPY61U', 'Paciente recebe quimioterapia pelo cateter', 'cuidado', array['oncologia','quimioterapia','infusão']::text[], 'National Cancer Institute', 'Licença Unsplash', 'chemotherapy infusion', 'sugestao'),
  ('unsplash', 'LTFAllQyAb0', 'https://unsplash.com/photos/LTFAllQyAb0', 'Sala de infusão de um centro oncológico', 'cuidado', array['oncologia','quimioterapia','infusão']::text[], null, 'Licença Unsplash', 'chemotherapy infusion', 'sugestao'),
  ('unsplash', 'KMvoHcB-w5g', 'https://unsplash.com/photos/KMvoHcB-w5g', 'Frascos de quimioterapia e soro', 'cuidado', array['oncologia','quimioterapia','infusão']::text[], null, 'Licença Unsplash', 'chemotherapy infusion', 'sugestao'),
  ('unsplash', 'tC4GCHCCMZg', 'https://unsplash.com/photos/tC4GCHCCMZg', 'Enfermeira prepara bolsas de quimioterapia (foto de 1989)', 'cuidado', array['oncologia','enfermagem','quimioterapia']::text[], null, 'Licença Unsplash', 'oncology nurse', 'sugestao'),
  ('unsplash', 'V1xh8Rktjq0', 'https://unsplash.com/photos/V1xh8Rktjq0', 'Terapeuta acompanha paciente na hidroterapia', 'reabilitacao', array['reabilitação','fisioterapia']::text[], null, 'Licença Unsplash', 'physical rehabilitation', 'sugestao'),
  ('unsplash', 'Nt5eeIKH-1s', 'https://unsplash.com/photos/Nt5eeIKH-1s', 'Fisioterapia nas costas', 'reabilitacao', array['fisioterapia','reabilitação']::text[], null, 'Licença Unsplash', 'physiotherapy', 'sugestao'),
  ('unsplash', 'OSpFXuGfj4U', 'https://unsplash.com/photos/OSpFXuGfj4U', 'Especialista aponta o modelo digital de uma órtese', 'reabilitacao', array['órtese','prótese','reabilitação']::text[], 'Tom Claes', 'Licença Unsplash', 'prosthetic', 'sugestao'),
  ('unsplash', 'aX3fjxKrgTI', 'https://unsplash.com/photos/aX3fjxKrgTI', 'Corredor com prótese de perna', 'reabilitacao', array['prótese','esporte adaptado','reabilitação']::text[], 'Vladyslav Tobolenko', 'Licença Unsplash', 'prosthetic leg', 'sugestao'),
  ('unsplash', '37pimNVWK7g', 'https://unsplash.com/photos/37pimNVWK7g', 'Oficina de próteses, por volta de 1958', 'reabilitacao', array['prótese','esporte adaptado','reabilitação']::text[], 'Navy Medicine', 'Licença Unsplash', 'prosthetic leg', 'sugestao'),
  ('unsplash', 'D2CxpwtgSgQ', 'https://unsplash.com/photos/D2CxpwtgSgQ', 'Mulher em cadeira de rodas em banheiro acessível', 'reabilitacao', array['cadeira de rodas','acessibilidade','inclusão']::text[], 'Centre for Ageing Better', 'Licença Unsplash', 'wheelchair', 'sugestao'),
  ('unsplash', 'MR2AtoPStf4', 'https://unsplash.com/photos/MR2AtoPStf4', 'Feirante em cadeira de rodas', 'reabilitacao', array['cadeira de rodas','acessibilidade','inclusão']::text[], null, 'Licença Unsplash', 'wheelchair', 'sugestao'),
  ('unsplash', 'UlG-z-Kz_AI', 'https://unsplash.com/photos/UlG-z-Kz_AI', 'Mulher em cadeira de rodas no parque', 'reabilitacao', array['cadeira de rodas','acessibilidade','inclusão']::text[], null, 'Licença Unsplash', 'wheelchair', 'sugestao'),
  ('unsplash', 'Xlp338P79do', 'https://unsplash.com/photos/Xlp338P79do', 'Mulher em bicicleta ergométrica com tablet', 'reabilitacao', array['bicicleta ergométrica','pedalada','reabilitação']::text[], null, 'Licença Unsplash', 'stationary bike', 'sugestao'),
  ('unsplash', 'qMQ1gvgMrd0', 'https://unsplash.com/photos/qMQ1gvgMrd0', 'Bicicleta ergométrica branca e preta', 'reabilitacao', array['bicicleta ergométrica','pedalada','reabilitação']::text[], null, 'Licença Unsplash', 'stationary bike', 'sugestao'),
  ('unsplash', 'lgkareDEqKg', 'https://unsplash.com/photos/lgkareDEqKg', 'Pipeta enchendo microtubos', 'laboratorio', array['pipeta','amostras','laboratório']::text[], 'Nathan Rimoux', 'Licença Unsplash', 'pipette', 'sugestao'),
  ('unsplash', 'cK0hjNSgnS4', 'https://unsplash.com/photos/cK0hjNSgnS4', 'Pesquisadora ao microscópio de dissecção', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], 'NIAID', 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', '1fvqUP-xaYQ', 'https://unsplash.com/photos/1fvqUP-xaYQ', 'Pesquisadora prepara amostras para PCR', 'laboratorio', array['laboratório','pesquisa','amostras']::text[], 'National Cancer Institute', 'Licença Unsplash', 'research laboratory', 'sugestao'),
  ('unsplash', 'JxoWb7wHqnA', 'https://unsplash.com/photos/JxoWb7wHqnA', 'Cientista ao microscópio no laboratório', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], null, 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', 'cyhgWD1i_fA', 'https://unsplash.com/photos/cyhgWD1i_fA', 'Pesquisador de jaleco ao microscópio', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], null, 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', 'HPjTJ_w9Bls', 'https://unsplash.com/photos/HPjTJ_w9Bls', 'Pesquisadora ao microscópio invertido', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], 'National Cancer Institute', 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', 'ZAtM1enV0KY', 'https://unsplash.com/photos/ZAtM1enV0KY', 'Microscópio eletrônico de transmissão', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], 'National Cancer Institute', 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', 'JlVqUaGW2A0', 'https://unsplash.com/photos/JlVqUaGW2A0', 'Análise de uma peça de metal ao microscópio', 'laboratorio', array['microscópio','laboratório','pesquisa']::text[], 'Bermix Studio', 'Licença Unsplash', 'microscope', 'sugestao'),
  ('unsplash', 'Ky0B3cBJGKo', 'https://unsplash.com/photos/Ky0B3cBJGKo', 'Bancada com osciloscópio e placa', 'eletronica', array['osciloscópio','bancada','sinal']::text[], 'Axel Richter', 'Licença Unsplash', 'oscilloscope', 'sugestao'),
  ('unsplash', 'zs4gtT8thO0', 'https://unsplash.com/photos/zs4gtT8thO0', 'Pinça posiciona um microcontrolador RP2040', 'eletronica', array['microcontrolador','placa','firmware']::text[], 'Vishnu Mohanan', 'Licença Unsplash', 'microcontroller', 'sugestao'),
  ('unsplash', 'O68LT-zCYFg', 'https://unsplash.com/photos/O68LT-zCYFg', 'Ferro de solda sobre a protoboard', 'eletronica', array['solda','protoboard','eletrônica']::text[], null, 'Licença Unsplash', 'soldering', 'sugestao'),
  ('unsplash', 'zP7X_B86xOg', 'https://unsplash.com/photos/zP7X_B86xOg', 'Protoboard com sensores vista de cima', 'eletronica', array['placa de circuito','eletrônica','hardware']::text[], 'Robin Glauser', 'Licença Unsplash', 'circuit board', 'sugestao'),
  ('unsplash', 'g5f0BJq-FRs', 'https://unsplash.com/photos/g5f0BJq-FRs', 'Placa de circuito na oficina de eletrônica', 'eletronica', array['placa de circuito','eletrônica','hardware']::text[], 'Blaz Erzetic', 'Licença Unsplash', 'circuit board', 'sugestao'),
  ('unsplash', 'Px1eDMRm9xY', 'https://unsplash.com/photos/Px1eDMRm9xY', 'Impressora 3D imprimindo um modelo', 'eletronica', array['impressão 3D','prototipagem']::text[], 'Jakub Żerdzicki', 'Licença Unsplash', '3d printer', 'sugestao'),
  ('unsplash', 'G5XX7B__FeQ', 'https://unsplash.com/photos/G5XX7B__FeQ', 'Tablet com o progresso da impressão 3D', 'eletronica', array['impressão 3D','prototipagem']::text[], 'Jakub Żerdzicki', 'Licença Unsplash', '3d printer', 'sugestao'),
  ('unsplash', 'FED1QYdR1qI', 'https://unsplash.com/photos/FED1QYdR1qI', 'Close de uma impressora 3D', 'eletronica', array['impressão 3D','prototipagem']::text[], null, 'Licença Unsplash', '3d printer', 'sugestao'),
  ('unsplash', 'omrpeqLz6Po', 'https://unsplash.com/photos/omrpeqLz6Po', 'Estudante opera máquina em oficina de engenharia', 'eletronica', array['oficina','engenharia','estudantes']::text[], 'ThisisEngineering', 'Licença Unsplash', 'engineering workshop', 'sugestao'),
  ('pexels', '3861949', 'https://www.pexels.com/photo/3861949/', 'Engenheiros testando um protótipo eletrônico', 'eletronica', array['bancada','teste','eletrônica']::text[], 'ThisIsEngineering', 'Licença Pexels', 'electronics laboratory', 'sugestao'),
  ('unsplash', 'Im_cQ6hQo10', 'https://unsplash.com/photos/Im_cQ6hQo10', 'Pessoas programando em monitores', 'equipe', array['equipe','desenvolvimento','software']::text[], 'Compagnons', 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'VTZ4PVhLFFg', 'https://unsplash.com/photos/VTZ4PVhLFFg', 'Reunião de desenvolvedores diante da tela', 'equipe', array['equipe','desenvolvimento','software']::text[], 'Mushvig Niftaliyev', 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'N3Bf0ArT5J0', 'https://unsplash.com/photos/N3Bf0ArT5J0', 'Equipe colaborando em notebooks', 'equipe', array['equipe','desenvolvimento','software']::text[], 'Fiqih Alfarish', 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'UThaHAc8wh0', 'https://unsplash.com/photos/UThaHAc8wh0', 'Grupo em volta da mesa com notebooks', 'equipe', array['equipe','desenvolvimento','software']::text[], null, 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'ak4hmkNSU8g', 'https://unsplash.com/photos/ak4hmkNSU8g', 'Duas pessoas trabalhando em notebooks', 'equipe', array['equipe','desenvolvimento','software']::text[], null, 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'GXEcTqlZHno', 'https://unsplash.com/photos/GXEcTqlZHno', 'Duas mulheres discutindo diante do notebook', 'equipe', array['equipe','desenvolvimento','software']::text[], null, 'Licença Unsplash', 'software developers', 'sugestao'),
  ('unsplash', 'CdTQI-Nh7J4', 'https://unsplash.com/photos/CdTQI-Nh7J4', 'Equipe ao redor do quadro branco', 'equipe', array['equipe','brainstorm','planejamento']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'team whiteboard', 'sugestao'),
  ('unsplash', 'euNzbqwIIUI', 'https://unsplash.com/photos/euNzbqwIIUI', 'Brainstorm com post-its no vidro', 'equipe', array['equipe','brainstorm','planejamento']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'team whiteboard', 'sugestao'),
  ('unsplash', 'BuD00MfwvFY', 'https://unsplash.com/photos/BuD00MfwvFY', 'Quadro branco com post-its', 'equipe', array['equipe','brainstorm','planejamento']::text[], 'Walls.io', 'Licença Unsplash', 'team whiteboard', 'sugestao'),
  ('unsplash', 'kp7qkHTgSKc', 'https://unsplash.com/photos/kp7qkHTgSKc', 'Estudantes em volta de um notebook', 'equipe', array['estudantes','universidade','equipe']::text[], 'Vitaly Gariev', 'Licença Unsplash', 'students laptop', 'sugestao'),
  ('unsplash', 'oYzjGQ7LCVE', 'https://unsplash.com/photos/oYzjGQ7LCVE', 'Notebook e celular com código aberto', 'equipe', array['código','software','desenvolvimento']::text[], 'Bayu Syaits', 'Licença Unsplash', 'coding', 'sugestao'),
  ('unsplash', 'm_HRfLhgABo', 'https://unsplash.com/photos/m_HRfLhgABo', 'Notebook com código numa mesa movimentada', 'equipe', array['código','software','desenvolvimento']::text[], null, 'Licença Unsplash', 'coding', 'sugestao'),
  ('unsplash', 'ZnkHPagIOlM', 'https://unsplash.com/photos/ZnkHPagIOlM', 'Cérebro humano gerado por computador', 'neuro', array['cérebro','neurociência']::text[], 'Shawn Day', 'Licença Unsplash', 'human brain', 'sugestao'),
  ('unsplash', 'iuuWGXEC50U', 'https://unsplash.com/photos/iuuWGXEC50U', 'Ilustração de cérebro', 'neuro', array['cérebro','neurociência']::text[], 'Robina Weermeijer', 'Licença Unsplash', 'human brain', 'sugestao'),
  ('unsplash', 'vLfzJSGCU9c', 'https://unsplash.com/photos/vLfzJSGCU9c', 'Modelo plástico de cérebro humano', 'neuro', array['cérebro','anatomia','modelo']::text[], 'Maxim Berg', 'Licença Unsplash', 'brain model', 'sugestao'),
  ('unsplash', 'JkAxfH5ktpw', 'https://unsplash.com/photos/JkAxfH5ktpw', 'Close de um modelo de cérebro', 'neuro', array['cérebro','anatomia','modelo']::text[], null, 'Licença Unsplash', 'brain model', 'sugestao'),
  ('unsplash', 'tBZXYspGH_M', 'https://unsplash.com/photos/tBZXYspGH_M', 'Desenhos anatômicos do cérebro', 'neuro', array['neurociência','cérebro']::text[], null, 'Licença Unsplash', 'neuroscience', 'sugestao'),
  ('unsplash', 'gM6EKcjU-NU', 'https://unsplash.com/photos/gM6EKcjU-NU', 'Cérebro luminoso numa estrutura geométrica', 'neuro', array['neurociência','cérebro']::text[], null, 'Licença Unsplash', 'neuroscience', 'sugestao'),
  ('unsplash', '16IN3v0V12M', 'https://unsplash.com/photos/16IN3v0V12M', 'Cérebro colorido com relevo', 'neuro', array['cérebro','neurociência']::text[], null, 'Licença Unsplash', 'human brain', 'sugestao'),
  ('unsplash', 'BR8MqYyOPiU', 'https://unsplash.com/photos/BR8MqYyOPiU', 'Smartwatch medindo a frequência cardíaca', 'digital', array['smartwatch','frequência cardíaca','wearable']::text[], 'Nik', 'Licença Unsplash', 'smartwatch heart rate', 'sugestao'),
  ('unsplash', 'zIkV81RVwYY', 'https://unsplash.com/photos/zIkV81RVwYY', 'Smartwatch redondo preto', 'digital', array['smartwatch','frequência cardíaca','wearable']::text[], 'Artur Łuczka', 'Licença Unsplash', 'smartwatch heart rate', 'sugestao'),
  ('unsplash', 'OPeSKKUMva4', 'https://unsplash.com/photos/OPeSKKUMva4', 'Pessoa usando smartwatch redondo', 'digital', array['smartwatch','frequência cardíaca','wearable']::text[], null, 'Licença Unsplash', 'smartwatch heart rate', 'sugestao'),
  ('unsplash', '3uvS3ce7sk0', 'https://unsplash.com/photos/3uvS3ce7sk0', 'Close de smartwatch no pulso', 'digital', array['wearable','smartwatch','saúde digital']::text[], null, 'Licença Unsplash', 'wearable health', 'sugestao'),
  ('unsplash', '_GKmPqRLHxo', 'https://unsplash.com/photos/_GKmPqRLHxo', 'Smartwatch com pulseira amarela', 'digital', array['wearable','smartwatch','saúde digital']::text[], 'Sam Grozyan', 'Licença Unsplash', 'wearable health', 'sugestao'),
  ('unsplash', '_jg8xh2SsXQ', 'https://unsplash.com/photos/_jg8xh2SsXQ', 'Placa de circuito com um cérebro', 'abstrato', array['inteligência artificial','cérebro','abstrato']::text[], null, 'Licença Unsplash', 'neural network', 'sugestao')
on conflict (banco, banco_id) do nothing;

do $$ begin
  if to_regprocedure('public.conta_ativa_travar()') is not null then perform public.conta_ativa_travar(); end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.24.0_fotos', 'O banco de fotos: os temas (foto_temas), as fotos com tags (fotos) e os votos da curadoria (foto_votos); aprovada é o voto que diz (aprovacoes_minimas do Studio) ou a gestão do Studio à mão; a galeria das aprovadas para toda conta ativa; a chave do Pexels em studio_config; a semente da primeira campanha (11 temas, 90 fotos)')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from foto_temas) as temas,
       (select count(*) from fotos where status = 'fila') as "na fila",
       (select count(*) from fotos where status = 'aprovada') as aprovadas,
       (select aprovacoes_minimas from studio_config limit 1) as "aprovações para entrar na galeria";

-- ============================================================
-- FIM, SOMA 2.24.0
--
-- Depois de rodar:
--   1) publique o portal;
--   2) em Studio, Configurações, Contas, confira a chave do Unsplash e,
--      se quiser, ponha a do Pexels: com elas a curadoria acha o
--      endereço de cada imagem, e a foto aprovada entra no criador;
--   3) em Studio, Curadoria de fotos, a fila já tem as 90 fotos da
--      primeira campanha. A galeria fica em Serviços, Marca, Galeria de
--      fotos.
-- ============================================================
