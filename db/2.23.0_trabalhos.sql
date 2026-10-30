-- ============================================================
-- SOMA 2.23.0, MIGRAÇÃO, NeuroDynamics
-- OS TRABALHOS, EM PROJETOS. E O FORMATO E A COR EM ARQUIVOS.
--
-- Um trabalho é um projeto pequeno: um conjunto de atividades,
-- quase sempre entregue a trainees, que se cita pelo número
-- ("o trabalho 5") e não tem nome, só uma referência ("Projeto
-- Calima (firmware)"). Pode ser um estudo de viabilidade, o começo
-- de um projeto, uma etapa de um projeto que já existe ou uma
-- campanha (estruturar os treinamentos, montar o banco de fotos).
--
--   1. trabalhos: o número (o código é TRB-<número>), a referência,
--      o tipo, o status, o PS de origem, as datas, a alocação
--      pedida, complexidade e esforço (1 a 5), o escopo, a
--      justificativa, os entregáveis, as dependências, os critérios
--      de sucesso e o cenário (forças, fraquezas, oportunidades e
--      ameaças): a ficha de trabalho, campo a campo. O projeto é
--      opcional (projeto_id).
--   2. A equipe é um GRUPO, NRO_TRABALHO_<número>, dentro de
--      NRO_TRABALHOS, com QUADRO em Atividades: o kanban do trabalho
--      é o quadro desse grupo (prefixo T<número>, atividades T5-1,
--      T5-2...). Os responsáveis entram no grupo e viram responsáveis
--      por ele: põem e tiram gente sem a administração.
--   3. CONVIDADOS: gente de fora da equipe que entra num trabalho
--      (integração, intercâmbio, convite, conveniência) sem ser
--      membro. Cada convidado tem um MEMBRO EFETIVO responsável
--      (Ativo e não trainee). A tabela não se lê direto: o e-mail é
--      dado pessoal e sai só para quem gere (convidados_lista()).
--   4. Os DOCUMENTOS do trabalho: não há padrão, como nos projetos.
--      Cada trabalho junta os arquivos do rol que lhe dizem respeito
--      e, quando o material mora fora (uma pasta do Drive), o link.
--   5. As HABILIDADES de cada pessoa: o que já sabe e o que quer
--      desenvolver (membro_habilidades). Quem veio do processo
--      seletivo começa com as competências que marcou na inscrição;
--      cada um edita as suas.
--   6. ARQUIVOS: a cor de cada emissor (uma família secundária da
--      marca, doc_emissores.familia) e o formato de cada arquivo
--      (docx, xlsx, pptx, md, pdf), que sai do nome do arquivo
--      enviado na revisão em vigor, ou da série (doc_series.formato)
--      enquanto não há arquivo. doc_rol ganha formato e
--      serie_formato. É o que a navegação por pastas desenha.
--
-- Escrita só pelas funções: trabalho_salvar, trabalho_pessoas,
-- convidado_salvar, trabalho_documento_salvar,
-- trabalho_documento_tirar, habilidades_salvar e doc_serie_formato.
-- As cores dos emissores, direto em doc_emissores (já é do gestor).
--
-- Pré-requisitos: a v19 (grupos em árvore), a v20 (projetos e
-- arquivos) e a 2.18.0 (conta_ativa, tenho_papel). Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal.
-- ============================================================

do $$
begin
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'A equipe de um trabalho é um grupo, e quem está nele sai de esta_no_grupo().';
  end if;
  if to_regclass('public.projetos') is null or to_regclass('public.doc_arquivos') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'O trabalho se liga a um projeto (projetos) e aos arquivos do rol (doc_arquivos).';
  end if;
  if to_regprocedure('public.conta_ativa()') is null or to_regprocedure('public.tenho_papel(text)') is null then
    raise exception using message = 'Falta aplicar a 2.18.0 antes desta migração.',
      detail = 'As funções conferem a conta ativa e os papéis (conta_ativa, tenho_papel).';
  end if;
end $$;

-- ============================================================
-- 0. NRO_TRABALHOS, O PAI DOS GRUPOS DE TRABALHO
--    Adota um grupo que já se chame assim; não achando, cria, sem
--    quadro (é guarda-chuva). O prefixo TRB fica de fora dos grupos:
--    TRB-5 é o trabalho 5, não a atividade 5 de um quadro.
-- ------------------------------------------------------------
do $$
declare v_id integer; v_pref text := 'TRAB'; v_n integer := 1;
begin
  select id into v_id from grupos where chave = 'trabalhos';
  if v_id is null then
    select id into v_id from grupos
     where chave is null and upper(trim(nome)) ~ '^(NRO[ _-]?)?TRABALHOS$'
     order by id limit 1;
  end if;
  if v_id is null then
    while exists (select 1 from grupos where prefixo = v_pref) loop
      v_n := v_n + 1; v_pref := 'TRAB' || v_n;
    end loop;
    insert into grupos (nome, prefixo, quadro, descricao)
    values ('NRO_TRABALHOS', v_pref, false,
            'Um subgrupo por trabalho. Quem está num trabalho está aqui.')
    returning id into v_id;
  end if;
  update grupos set chave = 'trabalhos' where id = v_id and chave is distinct from 'trabalhos';
  if not exists (select 1 from pg_constraint where conname = 'grupos_trb_reservado') then
    if exists (select 1 from grupos where prefixo = 'TRB') then
      raise notice 'Há um grupo com o prefixo TRB: os códigos TRB-N dele vão abrir o trabalho, não a atividade. Troque o prefixo em Administração, Grupos.';
    else
      alter table public.grupos add constraint grupos_trb_reservado check (prefixo <> 'TRB');
    end if;
  end if;
end $$;

create or replace function public.grupo_trabalhos()
returns integer language sql stable security definer
set search_path = public as $$ select id from grupos where chave = 'trabalhos' $$;

-- ============================================================
-- 1. OS TRABALHOS
-- ------------------------------------------------------------
create table if not exists public.trabalhos (
  id            uuid primary key default gen_random_uuid(),
  numero        integer not null unique check (numero between 1 and 9999),
  codigo        text generated always as ('TRB-' || numero) stored,
  referencia    text not null check (length(btrim(referencia)) between 1 and 160),
  tipo          text not null default 'outro'
                check (tipo in ('viabilidade','desenvolvimento','etapa','campanha','outro')),
  status        text not null default 'a_iniciar'
                check (status in ('a_iniciar','em_andamento','pausado','concluido','cancelado')),
  ciclo         text,
  inicio        date,
  fim           date,
  alocacao      text,
  complexidade  smallint check (complexidade between 1 and 5),
  esforco       smallint check (esforco between 1 and 5),
  escopo        text,
  justificativa text,
  entregaveis   text,
  dependencias  text,
  criterios     text,
  cenario       jsonb not null default '{}'::jsonb,
  projeto_id    uuid references public.projetos(id) on delete set null,
  grupo_id      integer not null unique references public.grupos(id),
  responsaveis  integer[] not null default '{}',
  criado_por    integer references public.membros(registro) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint trabalhos_datas check (fim is null or inicio is null or fim >= inicio)
);
create index if not exists trabalhos_projeto_ix on public.trabalhos (projeto_id) where projeto_id is not null;

comment on table public.trabalhos is
  'Um trabalho: um projeto pequeno, citado pelo número (TRB-5). A equipe é o grupo '
  '(grupo_id, dentro de NRO_TRABALHOS) e o kanban é o quadro desse grupo em Atividades. '
  'Escrita só por trabalho_salvar e trabalho_pessoas.';
comment on column public.trabalhos.referencia is
  'O trabalho não tem nome: tem uma referência, que diz do que se trata ("Projeto Calima (firmware)").';
comment on column public.trabalhos.ciclo is 'O processo seletivo de origem, como "2026/2".';
comment on column public.trabalhos.alocacao is 'A alocação pedida, em texto: "2 trainees Dev, 1 trainee RI".';
comment on column public.trabalhos.cenario is
  'A análise do cenário: {"forcas":[...],"fraquezas":[...],"oportunidades":[...],"ameacas":[...]}.';

alter table public.trabalhos enable row level security;
drop policy if exists trab_select on public.trabalhos;
create policy trab_select on public.trabalhos for select to authenticated using (true);
grant select on public.trabalhos to authenticated;

-- ============================================================
-- 2. CONVIDADOS
-- ------------------------------------------------------------
create table if not exists public.convidados (
  id               uuid primary key default gen_random_uuid(),
  nome             text not null check (length(btrim(nome)) between 2 and 120),
  email            text,
  instituicao      text,
  motivo           text not null default 'convite'
                   check (motivo in ('integracao','intercambio','convite','conveniencia')),
  responsavel      integer not null references public.membros(registro),
  foto_url         text,
  habilidades      text[] not null default '{}',
  quer_desenvolver text[] not null default '{}',
  observacao       text,
  ativo            boolean not null default true,
  criado_por       integer references public.membros(registro) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);
comment on table public.convidados is
  'Gente de fora da equipe que participa de trabalhos, sem ser membro. Cada um tem um membro '
  'efetivo responsável. Sem política: lê-se por convidados_lista(), que só manda o e-mail a quem gere.';

create table if not exists public.trabalho_convidados (
  trabalho_id  uuid not null references public.trabalhos(id) on delete cascade,
  convidado_id uuid not null references public.convidados(id) on delete cascade,
  incluido_por integer references public.membros(registro) on delete set null,
  incluido_em  timestamptz not null default now(),
  primary key (trabalho_id, convidado_id)
);
create index if not exists trab_conv_conv_ix on public.trabalho_convidados (convidado_id);

alter table public.convidados enable row level security;          -- sem política: só pelas funções
alter table public.trabalho_convidados enable row level security;
drop policy if exists trabconv_select on public.trabalho_convidados;
create policy trabconv_select on public.trabalho_convidados for select to authenticated using (true);
grant select on public.trabalho_convidados to authenticated;

-- ============================================================
-- 3. OS DOCUMENTOS DO TRABALHO
-- ------------------------------------------------------------
create table if not exists public.trabalho_documentos (
  id           uuid primary key default gen_random_uuid(),
  trabalho_id  uuid not null references public.trabalhos(id) on delete cascade,
  arquivo_id   uuid references public.doc_arquivos(id) on delete cascade,
  titulo       text,
  url          text,
  nota         text,
  ordem        integer not null default 0,
  incluido_por integer references public.membros(registro) on delete set null,
  incluido_em  timestamptz not null default now(),
  constraint trabdoc_arquivo_ou_link check (
    (arquivo_id is not null and url is null)
    or (arquivo_id is null and url ~* '^https?://' and length(btrim(coalesce(titulo, ''))) > 0)),
  unique (trabalho_id, arquivo_id)
);
comment on table public.trabalho_documentos is
  'Os documentos e registros de um trabalho: arquivos do rol (arquivo_id) ou, para o que mora '
  'fora, um link. O conteúdo de um arquivo do rol continua com a regra de doc_pode_ler.';

alter table public.trabalho_documentos enable row level security;
drop policy if exists trabdoc_select on public.trabalho_documentos;
create policy trabdoc_select on public.trabalho_documentos for select to authenticated using (true);
grant select on public.trabalho_documentos to authenticated;

-- ============================================================
-- 4. AS HABILIDADES DE CADA PESSOA
-- ------------------------------------------------------------
create table if not exists public.membro_habilidades (
  registro       integer primary key references public.membros(registro) on delete cascade,
  tem            text[] not null default '{}',
  quer           text[] not null default '{}',
  atualizado_em  timestamptz not null default now(),
  atualizado_por integer references public.membros(registro) on delete set null
);
comment on table public.membro_habilidades is
  'O que cada pessoa já sabe (tem) e o que quer desenvolver (quer). Escrita só por habilidades_salvar.';

alter table public.membro_habilidades enable row level security;
drop policy if exists mhab_select on public.membro_habilidades;
create policy mhab_select on public.membro_habilidades for select to authenticated using (true);
grant select on public.membro_habilidades to authenticated;

-- quem veio do processo seletivo começa com o que marcou na inscrição
do $$
begin
  if to_regclass('public.ps_candidatos') is not null then
    execute $q$
      insert into public.membro_habilidades (registro, tem, quer)
      select distinct on (c.registro_membro) c.registro_membro,
             coalesce(c.competencias, '{}'), coalesce(c.competencias_desejadas, '{}')
        from public.ps_candidatos c
        join public.membros m on m.registro = c.registro_membro
       where c.registro_membro is not null
         and (cardinality(coalesce(c.competencias, '{}')) > 0 or cardinality(coalesce(c.competencias_desejadas, '{}')) > 0)
       order by c.registro_membro
      on conflict (registro) do nothing $q$;
  end if;
end $$;

-- ============================================================
-- 5. QUEM PODE O QUÊ
-- ------------------------------------------------------------
-- A gestão dos trabalhos: admin, Depto. de Pessoal, liderança e o PMO.
create or replace function public.trabalho_gestor()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.conta_ativa()
     and (public.papel_atual() in ('admin','pessoal') or public.tenho_papel('lideranca') or public.doc_gestor());
$$;

-- Editar um trabalho e pôr e tirar gente: a gestão, os responsáveis do
-- trabalho e quem é responsável pelo grupo dele ou por um acima.
create or replace function public.trabalho_pode_editar(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.trabalho_gestor()
      or (public.conta_ativa() and exists (
            select 1 from trabalhos t
             where t.id = p_id
               and (public.portal_registro_atual() = any(t.responsaveis)
                    or public.posso_gerir_grupo(t.grupo_id))));
$$;

-- Membro efetivo: Ativo e não trainee. É quem pode responder por um convidado.
create or replace function public.membro_efetivo(p_reg integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce((select status = 'Ativo' and lower(btrim(coalesce(cargo, ''))) <> 'trainee'
                     from membros where registro = p_reg), false);
$$;

-- as listas de texto que chegam do portal: limpas, sem repetição, curtas
create or replace function public.trabalho_textos(p jsonb, p_max integer default 30)
returns text[] language sql immutable as $$
  select coalesce(array_agg(x order by o), '{}') from (
    select x, o from (
      select distinct on (lower(btrim(v))) left(btrim(v), 80) x, o
        from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
             with ordinality t(v, o)
       where btrim(v) <> ''
       order by lower(btrim(v)), o) q
     order by o limit p_max) r
$$;

-- ============================================================
-- 6. CRIAR E EDITAR UM TRABALHO
--    Criar é da gestão: nasce o grupo NRO_TRABALHO_<número> dentro de
--    NRO_TRABALHOS, com quadro, e os responsáveis entram nele e viram
--    responsáveis por ele. Editar é da gestão e dos responsáveis.
-- ------------------------------------------------------------
create or replace function public.trabalho_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id    uuid    := nullif(p->>'id','')::uuid;
  v_num   integer;
  v_ref   text    := nullif(btrim(p->>'referencia'), '');
  v_eu    integer := public.portal_registro_atual();
  v_quem  text    := public.doc_meu_nome();
  v_t     trabalhos%rowtype;
  v_g     integer;
  v_gnome text;
  v_pref  text;
  v_n     integer := 1;
  v_resp  integer[];
  v_eq    integer[];
  v_novos integer[];
  v_cen   jsonb;
  v_k     text;
begin
  if not public.conta_ativa() then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'tipo' and coalesce(p->>'tipo','') not in ('viabilidade','desenvolvimento','etapa','campanha','outro') then
    return jsonb_build_object('status','invalido','campo','tipo'); end if;
  if p ? 'status' and coalesce(p->>'status','') not in ('a_iniciar','em_andamento','pausado','concluido','cancelado') then
    return jsonb_build_object('status','invalido','campo','status'); end if;
  if nullif(p->>'complexidade','') is not null and (p->>'complexidade') !~ '^[1-5]$' then
    return jsonb_build_object('status','invalido','campo','complexidade'); end if;
  if nullif(p->>'esforco','') is not null and (p->>'esforco') !~ '^[1-5]$' then
    return jsonb_build_object('status','invalido','campo','esforco'); end if;
  if p ? 'projeto_id' and nullif(p->>'projeto_id','') is not null
     and not exists (select 1 from projetos where id = (p->>'projeto_id')::uuid) then
    return jsonb_build_object('status','nao_encontrado','campo','projeto_id'); end if;
  if nullif(p->>'inicio','') is not null and nullif(p->>'fim','') is not null
     and (p->>'fim')::date < (p->>'inicio')::date then
    return jsonb_build_object('status','invalido','campo','fim'); end if;

  -- os responsáveis: membros que existem, na ordem dada (o primeiro é o principal)
  if p ? 'responsaveis' then
    select coalesce(array_agg(r order by o), '{}') into v_resp from (
      select distinct on (x::integer) x::integer r, o
        from jsonb_array_elements_text(case when jsonb_typeof(p->'responsaveis') = 'array' then p->'responsaveis' else '[]'::jsonb end)
             with ordinality t(x, o)
       where x ~ '^\d+$' and exists (select 1 from membros where registro = x::integer)
       order by x::integer, o) q;
  end if;

  -- o cenário: as quatro listas, e nada além delas
  if p ? 'cenario' then
    v_cen := '{}'::jsonb;
    foreach v_k in array array['forcas','fraquezas','oportunidades','ameacas'] loop
      v_cen := v_cen || jsonb_build_object(v_k, to_jsonb(public.trabalho_textos(p->'cenario'->v_k, 12)));
    end loop;
  end if;

  if v_id is null then
    ------------------------------------------------ criar
    if not public.trabalho_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
    if v_ref is null then return jsonb_build_object('status','invalido','campo','referencia'); end if;
    perform pg_advisory_xact_lock(hashtext('trabalho_salvar'));
    if nullif(p->>'numero','') is not null then
      if (p->>'numero') !~ '^\d{1,4}$' or (p->>'numero')::integer < 1 then
        return jsonb_build_object('status','invalido','campo','numero'); end if;
      v_num := (p->>'numero')::integer;
      if exists (select 1 from trabalhos where numero = v_num) then
        return jsonb_build_object('status','duplicado','campo','numero'); end if;
    else
      select coalesce(max(numero), 0) + 1 into v_num from trabalhos;
    end if;
    if public.grupo_trabalhos() is null then return jsonb_build_object('status','sem_grupo_pai'); end if;

    v_gnome := 'NRO_TRABALHO_' || v_num;
    if exists (select 1 from grupos where nome = v_gnome) then
      return jsonb_build_object('status','duplicado','campo','grupo_nome'); end if;
    -- o prefixo das atividades: T5 (T5-1, T5-2...); ocupado, TR5, TB5...
    v_pref := 'T' || v_num;
    while exists (select 1 from grupos where prefixo = v_pref) loop
      v_n := v_n + 1;
      v_pref := (array['T','TR','TB','TJ','TX'])[least(v_n, 5)] || v_num || case when v_n > 5 then (v_n - 5)::text else '' end;
    end loop;
    insert into grupos (nome, prefixo, pai_id, quadro, descricao, responsaveis)
    values (v_gnome, v_pref, public.grupo_trabalhos(), true, 'A equipe do trabalho TRB-' || v_num || ': ' || v_ref || '.',
            coalesce(v_resp, '{}'))
    returning id into v_g;

    insert into trabalhos (numero, referencia, tipo, status, ciclo, inicio, fim, alocacao, complexidade, esforco,
                           escopo, justificativa, entregaveis, dependencias, criterios, cenario,
                           projeto_id, grupo_id, responsaveis, criado_por)
    values (v_num, v_ref, coalesce(nullif(p->>'tipo',''), 'outro'), coalesce(nullif(p->>'status',''), 'a_iniciar'),
            nullif(btrim(p->>'ciclo'),''), nullif(p->>'inicio','')::date, nullif(p->>'fim','')::date,
            nullif(btrim(p->>'alocacao'),''), nullif(p->>'complexidade','')::smallint, nullif(p->>'esforco','')::smallint,
            nullif(btrim(p->>'escopo'),''), nullif(btrim(p->>'justificativa'),''), nullif(btrim(p->>'entregaveis'),''),
            nullif(btrim(p->>'dependencias'),''), nullif(btrim(p->>'criterios'),''), coalesce(v_cen, '{}'::jsonb),
            nullif(p->>'projeto_id','')::uuid, v_g, coalesce(v_resp, '{}'), v_eu)
    returning * into v_t;

    -- a equipe: quem veio no pedido, mais os responsáveis
    select coalesce(array_agg(distinct x::integer), '{}') into v_eq
      from jsonb_array_elements_text(case when jsonb_typeof(p->'equipe') = 'array' then p->'equipe' else '[]'::jsonb end) t(x)
     where x ~ '^\d+$' and exists (select 1 from membros where registro = x::integer);
    v_eq := array(select distinct unnest(v_eq || coalesce(v_resp, '{}')));
    with feitos as (
      update membros set grupos = array_append(coalesce(grupos,'{}'), v_gnome)
       where registro = any(v_eq) and not (coalesce(grupos,'{}') @> array[v_gnome])
      returning registro
    ) insert into ocorrencias (registro, tipo, descricao, data, responsavel)
      select registro, 'Adição a grupo', v_gnome, current_date, v_quem from feitos;
    if cardinality(v_eq) > 0 then
      perform public.notificar(v_eq, 'projeto_equipe', 'Você está no trabalho TRB-' || v_num,
        v_ref, '#/projetos/trabalhos/TRB-' || v_num);
    end if;
    return jsonb_build_object('status','ok','id',v_t.id,'numero',v_num,'codigo',v_t.codigo,'grupo_id',v_g,'prefixo',v_pref);
  end if;

  ------------------------------------------------ editar
  select * into v_t from trabalhos where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.trabalho_pode_editar(v_id) then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'referencia' and v_ref is null then return jsonb_build_object('status','invalido','campo','referencia'); end if;
  -- trocar os responsáveis é da gestão: o responsável não se tira sozinho
  if p ? 'responsaveis' and v_resp is distinct from v_t.responsaveis and not public.trabalho_gestor() then
    return jsonb_build_object('status','sem_permissao','campo','responsaveis'); end if;
  if p ? 'inicio' or p ? 'fim' then
    if coalesce(case when p ? 'fim' then nullif(p->>'fim','')::date else v_t.fim end, 'infinity'::date)
       < coalesce(case when p ? 'inicio' then nullif(p->>'inicio','')::date else v_t.inicio end, '-infinity'::date) then
      return jsonb_build_object('status','invalido','campo','fim'); end if;
  end if;

  if p ? 'responsaveis' and v_resp is distinct from v_t.responsaveis then
    select nome into v_gnome from grupos where id = v_t.grupo_id;
    v_novos := array(select r from unnest(v_resp) r where not public.esta_no_grupo(v_t.grupo_id, r));
    with feitos as (
      update membros set grupos = array_append(coalesce(grupos,'{}'), v_gnome)
       where registro = any(v_novos) and not (coalesce(grupos,'{}') @> array[v_gnome])
      returning registro
    ) insert into ocorrencias (registro, tipo, descricao, data, responsavel)
      select registro, 'Adição a grupo', v_gnome, current_date, v_quem from feitos;
    update grupos
       set responsaveis = array(select distinct x from unnest(
             array(select r from unnest(responsaveis) r where not (r = any(v_t.responsaveis))) || v_resp) x)
     where id = v_t.grupo_id;
    v_novos := array(select r from unnest(v_resp) r where not (r = any(v_t.responsaveis)));
    if cardinality(v_novos) > 0 then
      perform public.notificar(v_novos, 'projeto_equipe', 'Você é responsável pelo trabalho ' || v_t.codigo,
        v_t.referencia, '#/projetos/trabalhos/' || v_t.codigo);
    end if;
  end if;

  update trabalhos set
    referencia    = coalesce(case when p ? 'referencia' then v_ref end, referencia),
    tipo          = coalesce(nullif(p->>'tipo',''), tipo),
    status        = coalesce(nullif(p->>'status',''), status),
    ciclo         = case when p ? 'ciclo'         then nullif(btrim(p->>'ciclo'),'')          else ciclo end,
    inicio        = case when p ? 'inicio'        then nullif(p->>'inicio','')::date          else inicio end,
    fim           = case when p ? 'fim'           then nullif(p->>'fim','')::date             else fim end,
    alocacao      = case when p ? 'alocacao'      then nullif(btrim(p->>'alocacao'),'')       else alocacao end,
    complexidade  = case when p ? 'complexidade'  then nullif(p->>'complexidade','')::smallint else complexidade end,
    esforco       = case when p ? 'esforco'       then nullif(p->>'esforco','')::smallint     else esforco end,
    escopo        = case when p ? 'escopo'        then nullif(btrim(p->>'escopo'),'')         else escopo end,
    justificativa = case when p ? 'justificativa' then nullif(btrim(p->>'justificativa'),'')  else justificativa end,
    entregaveis   = case when p ? 'entregaveis'   then nullif(btrim(p->>'entregaveis'),'')    else entregaveis end,
    dependencias  = case when p ? 'dependencias'  then nullif(btrim(p->>'dependencias'),'')   else dependencias end,
    criterios     = case when p ? 'criterios'     then nullif(btrim(p->>'criterios'),'')      else criterios end,
    cenario       = coalesce(v_cen, cenario),
    projeto_id    = case when p ? 'projeto_id'    then nullif(p->>'projeto_id','')::uuid      else projeto_id end,
    responsaveis  = coalesce(v_resp, responsaveis),
    atualizado_em = now()
   where id = v_id;
  -- o grupo acompanha a referência
  if p ? 'referencia' and v_ref is distinct from v_t.referencia then
    update grupos set descricao = 'A equipe do trabalho ' || v_t.codigo || ': ' || v_ref || '.' where id = v_t.grupo_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id,'numero',v_t.numero,'codigo',v_t.codigo,'grupo_id',v_t.grupo_id);
end $$;

-- ============================================================
-- 7. PÔR E TIRAR GENTE: membros (pelo grupo) e convidados
--    { trabalho_id, adicionar:[reg], remover:[reg],
--      convidados_adicionar:[uuid], convidados_remover:[uuid] }
--    Tirar um responsável do grupo não o tira de responsável: isso é
--    da gestão, em trabalho_salvar.
-- ------------------------------------------------------------
create or replace function public.trabalho_pessoas(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_t     trabalhos%rowtype;
  v_gnome text;
  v_quem  text := public.doc_meu_nome();
  v_eu    integer := public.portal_registro_atual();
  v_add   integer[];
  v_rem   integer[];
  v_cadd  uuid[];
  v_crem  uuid[];
  v_feito integer[];
  v_na    integer := 0;
  v_nr    integer := 0;
  v_ca    integer := 0;
  v_cr    integer := 0;
begin
  select * into v_t from trabalhos where id = nullif(p->>'trabalho_id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.trabalho_pode_editar(v_t.id) then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_gnome from grupos where id = v_t.grupo_id;

  select coalesce(array_agg(distinct x::integer), '{}') into v_add
    from jsonb_array_elements_text(case when jsonb_typeof(p->'adicionar') = 'array' then p->'adicionar' else '[]'::jsonb end) t(x)
   where x ~ '^\d+$' and exists (select 1 from membros m where m.registro = x::integer and m.status in ('Ativo','Em pausa / avaliação'));
  select coalesce(array_agg(distinct x::integer), '{}') into v_rem
    from jsonb_array_elements_text(case when jsonb_typeof(p->'remover') = 'array' then p->'remover' else '[]'::jsonb end) t(x)
   where x ~ '^\d+$';
  select coalesce(array_agg(distinct x::uuid), '{}') into v_cadd
    from jsonb_array_elements_text(case when jsonb_typeof(p->'convidados_adicionar') = 'array' then p->'convidados_adicionar' else '[]'::jsonb end) t(x)
   where x ~* '^[0-9a-f-]{36}$' and exists (select 1 from convidados c where c.id = x::uuid and c.ativo);
  select coalesce(array_agg(distinct x::uuid), '{}') into v_crem
    from jsonb_array_elements_text(case when jsonb_typeof(p->'convidados_remover') = 'array' then p->'convidados_remover' else '[]'::jsonb end) t(x)
   where x ~* '^[0-9a-f-]{36}$';

  with feitos as (
    update membros set grupos = array_append(coalesce(grupos,'{}'), v_gnome)
     where registro = any(v_add) and not (coalesce(grupos,'{}') @> array[v_gnome])
    returning registro
  ), oc as (
    insert into ocorrencias (registro, tipo, descricao, data, responsavel)
    select registro, 'Adição a grupo', v_gnome, current_date, v_quem from feitos
    returning registro
  ) select coalesce(array_agg(registro), '{}') into v_feito from oc;
  v_na := cardinality(v_feito);
  if v_na > 0 then
    perform public.notificar(v_feito, 'projeto_equipe', 'Você está no trabalho ' || v_t.codigo,
      v_t.referencia, '#/projetos/trabalhos/' || v_t.codigo);
  end if;

  with feitos as (
    update membros set grupos = array_remove(grupos, v_gnome)
     where registro = any(v_rem) and coalesce(grupos,'{}') @> array[v_gnome]
    returning registro
  ), oc as (
    insert into ocorrencias (registro, tipo, descricao, data, responsavel)
    select registro, 'Remoção de grupo', v_gnome, current_date, v_quem from feitos
    returning 1
  ) select count(*) into v_nr from oc;

  with ins as (
    insert into trabalho_convidados (trabalho_id, convidado_id, incluido_por)
    select v_t.id, c, v_eu from unnest(v_cadd) c
    on conflict do nothing returning 1
  ) select count(*) into v_ca from ins;
  with del as (
    delete from trabalho_convidados where trabalho_id = v_t.id and convidado_id = any(v_crem) returning 1
  ) select count(*) into v_cr from del;

  return jsonb_build_object('status','ok','adicionados',v_na,'removidos',v_nr,
                            'convidados_adicionados',v_ca,'convidados_removidos',v_cr);
end $$;

-- ============================================================
-- 8. OS CONVIDADOS
--    Cadastrar é da gestão e de quem é responsável por algum
--    trabalho; o responsável pelo convidado é um membro efetivo.
--    Editar é da gestão e do responsável por ele.
-- ------------------------------------------------------------
create or replace function public.convidado_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id   uuid    := nullif(p->>'id','')::uuid;
  v_eu   integer := public.portal_registro_atual();
  v_resp integer := nullif(p->>'responsavel','')::integer;
  v_nome text    := nullif(btrim(p->>'nome'),'');
  v_mail text    := lower(nullif(btrim(p->>'email'),''));
  v_c    convidados%rowtype;
begin
  if not public.conta_ativa() or v_eu is null then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'motivo' and coalesce(p->>'motivo','') not in ('integracao','intercambio','convite','conveniencia') then
    return jsonb_build_object('status','invalido','campo','motivo'); end if;
  if v_mail is not null and v_mail !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('status','invalido','campo','email'); end if;
  if p ? 'foto_url' and nullif(btrim(p->>'foto_url'),'') is not null and (p->>'foto_url') !~* '^https://' then
    return jsonb_build_object('status','invalido','campo','foto_url'); end if;
  if (v_id is null or p ? 'responsavel') and not public.membro_efetivo(v_resp) then
    return jsonb_build_object('status','invalido','campo','responsavel'); end if;

  if v_id is null then
    if not (public.trabalho_gestor() or exists (select 1 from trabalhos where v_eu = any(responsaveis))) then
      return jsonb_build_object('status','sem_permissao'); end if;
    if v_nome is null or length(v_nome) < 2 then return jsonb_build_object('status','invalido','campo','nome'); end if;
    if v_mail is not null and exists (select 1 from membros where lower(email_nro) = v_mail or lower(email_pessoal) = v_mail) then
      return jsonb_build_object('status','invalido','campo','email_de_membro'); end if;
    insert into convidados (nome, email, instituicao, motivo, responsavel, foto_url, habilidades, quer_desenvolver, observacao, criado_por)
    values (v_nome, v_mail, nullif(btrim(p->>'instituicao'),''), coalesce(nullif(p->>'motivo',''), 'convite'), v_resp,
            nullif(btrim(p->>'foto_url'),''), public.trabalho_textos(p->'habilidades'), public.trabalho_textos(p->'quer_desenvolver'),
            nullif(btrim(p->>'observacao'),''), v_eu)
    returning * into v_c;
    if v_resp is distinct from v_eu then
      perform public.notificar(array[v_resp], 'projeto_equipe', 'Você responde por ' || v_nome,
        'Convidado em trabalhos da equipe.', '#/projetos/trabalhos/pessoas');
    end if;
    return jsonb_build_object('status','ok','id',v_c.id);
  end if;

  select * into v_c from convidados where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (public.trabalho_gestor() or v_c.responsavel = v_eu) then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'nome' and (v_nome is null or length(v_nome) < 2) then return jsonb_build_object('status','invalido','campo','nome'); end if;
  update convidados set
    nome             = coalesce(case when p ? 'nome' then v_nome end, nome),
    email            = case when p ? 'email'       then v_mail                                 else email end,
    instituicao      = case when p ? 'instituicao' then nullif(btrim(p->>'instituicao'),'')    else instituicao end,
    motivo           = coalesce(nullif(p->>'motivo',''), motivo),
    responsavel      = coalesce(case when p ? 'responsavel' then v_resp end, responsavel),
    foto_url         = case when p ? 'foto_url'    then nullif(btrim(p->>'foto_url'),'')       else foto_url end,
    habilidades      = case when p ? 'habilidades' then public.trabalho_textos(p->'habilidades') else habilidades end,
    quer_desenvolver = case when p ? 'quer_desenvolver' then public.trabalho_textos(p->'quer_desenvolver') else quer_desenvolver end,
    observacao       = case when p ? 'observacao'  then nullif(btrim(p->>'observacao'),'')     else observacao end,
    ativo            = case when p ? 'ativo'       then coalesce((p->>'ativo')::boolean, ativo) else ativo end,
    atualizado_em    = now()
   where id = v_id;
  -- quem sai fica fora dos trabalhos: inativo não aparece para alocar
  if p ? 'ativo' and not coalesce((p->>'ativo')::boolean, true) then
    delete from trabalho_convidados where convidado_id = v_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id);
end $$;

-- A lista dos convidados: a equipe toda vê nome, instituição, motivo,
-- responsável, foto e habilidades; o e-mail e a observação, só a gestão
-- e quem responde pelo convidado.
create or replace function public.convidados_lista()
returns jsonb language sql stable security definer
set search_path = public as $$
  select case when not public.conta_ativa() then '[]'::jsonb else coalesce((
    select jsonb_agg(jsonb_build_object(
        'id', c.id, 'nome', c.nome, 'instituicao', c.instituicao, 'motivo', c.motivo,
        'responsavel', c.responsavel, 'foto_url', c.foto_url, 'habilidades', c.habilidades,
        'quer_desenvolver', c.quer_desenvolver, 'ativo', c.ativo, 'criado_em', c.criado_em,
        'trabalhos', coalesce((select jsonb_agg(tc.trabalho_id) from trabalho_convidados tc where tc.convidado_id = c.id), '[]'::jsonb))
      || case when public.trabalho_gestor() or c.responsavel = public.portal_registro_atual()
              then jsonb_build_object('email', c.email, 'observacao', c.observacao, 'gere', true)
              else jsonb_build_object('gere', false) end
      order by c.ativo desc, c.nome)
      from convidados c), '[]'::jsonb) end
$$;

-- ============================================================
-- 9. OS DOCUMENTOS DO TRABALHO
--    Põe e tira quem edita o trabalho e quem está na equipe dele.
-- ------------------------------------------------------------
create or replace function public.trabalho_doc_posso(p_trabalho uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.trabalho_pode_editar(p_trabalho)
      or (public.conta_ativa() and exists (select 1 from trabalhos t where t.id = p_trabalho
                                           and public.esta_no_grupo(t.grupo_id, public.portal_registro_atual())));
$$;

create or replace function public.trabalho_documento_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_t   uuid := nullif(p->>'trabalho_id','')::uuid;
  v_arq uuid := nullif(p->>'arquivo_id','')::uuid;
  v_url text := nullif(btrim(p->>'url'),'');
  v_tit text := nullif(btrim(p->>'titulo'),'');
  v_id  uuid;
begin
  if v_t is null or not exists (select 1 from trabalhos where id = v_t) then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.trabalho_doc_posso(v_t) then return jsonb_build_object('status','sem_permissao'); end if;
  if v_arq is not null then
    if not exists (select 1 from doc_arquivos where id = v_arq) then return jsonb_build_object('status','nao_encontrado','campo','arquivo_id'); end if;
    if exists (select 1 from trabalho_documentos where trabalho_id = v_t and arquivo_id = v_arq) then
      return jsonb_build_object('status','duplicado'); end if;
    insert into trabalho_documentos (trabalho_id, arquivo_id, nota, ordem, incluido_por)
    values (v_t, v_arq, nullif(btrim(p->>'nota'),''),
            coalesce((select max(ordem) + 1 from trabalho_documentos where trabalho_id = v_t), 0), public.portal_registro_atual())
    returning id into v_id;
  else
    if v_tit is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
    if v_url is null or v_url !~* '^https?://[^\s]+$' then return jsonb_build_object('status','invalido','campo','url'); end if;
    insert into trabalho_documentos (trabalho_id, titulo, url, nota, ordem, incluido_por)
    values (v_t, left(v_tit, 160), v_url, nullif(btrim(p->>'nota'),''),
            coalesce((select max(ordem) + 1 from trabalho_documentos where trabalho_id = v_t), 0), public.portal_registro_atual())
    returning id into v_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id);
end $$;

create or replace function public.trabalho_documento_tirar(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_t uuid;
begin
  select trabalho_id into v_t from trabalho_documentos where id = p_id;
  if v_t is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.trabalho_doc_posso(v_t) then return jsonb_build_object('status','sem_permissao'); end if;
  delete from trabalho_documentos where id = p_id;
  return jsonb_build_object('status','ok');
end $$;

-- ============================================================
-- 10. AS HABILIDADES
--     Cada um as suas; admin e o Depto. de Pessoal, as de qualquer um.
-- ------------------------------------------------------------
create or replace function public.habilidades_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_eu  integer := public.portal_registro_atual();
  v_reg integer := coalesce(nullif(p->>'registro','')::integer, v_eu);
begin
  if not public.conta_ativa() or v_reg is null then return jsonb_build_object('status','sem_permissao'); end if;
  if v_reg is distinct from v_eu and public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao'); end if;
  if not exists (select 1 from membros where registro = v_reg) then return jsonb_build_object('status','nao_encontrado'); end if;
  insert into membro_habilidades (registro, tem, quer, atualizado_em, atualizado_por)
  values (v_reg, public.trabalho_textos(p->'tem'), public.trabalho_textos(p->'quer'), now(), v_eu)
  on conflict (registro) do update
    set tem = case when p ? 'tem' then excluded.tem else membro_habilidades.tem end,
        quer = case when p ? 'quer' then excluded.quer else membro_habilidades.quer end,
        atualizado_em = now(), atualizado_por = v_eu;
  return jsonb_build_object('status','ok','registro',v_reg);
end $$;

-- ============================================================
-- 11. ARQUIVOS: A COR DO EMISSOR E O FORMATO DO ARQUIVO
-- ------------------------------------------------------------
alter table public.doc_emissores add column if not exists familia text;
alter table public.doc_series    add column if not exists formato text;
alter table public.doc_arquivos  add column if not exists formato text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'doc_emissores_familia_ok') then
    alter table public.doc_emissores add constraint doc_emissores_familia_ok check (familia is null or familia in
      ('ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'doc_series_formato_ok') then
    alter table public.doc_series add constraint doc_series_formato_ok
      check (formato is null or formato in ('docx','xlsx','pptx','md','pdf','outro'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'doc_arquivos_formato_ok') then
    alter table public.doc_arquivos add constraint doc_arquivos_formato_ok
      check (formato is null or formato in ('docx','xlsx','pptx','md','pdf','outro'));
  end if;
end $$;
comment on column public.doc_emissores.familia is
  'A cor do emissor nas pastas de Arquivos: uma família secundária da marca. Sem ela, a tela escolhe pela ordem.';
comment on column public.doc_series.formato is
  'O formato que os arquivos da série costumam ter, para o ícone enquanto não há arquivo enviado.';
comment on column public.doc_arquivos.formato is
  'O formato do arquivo em vigor (ou do primeiro enviado), tirado do nome. Gravado pelo gatilho de doc_revisoes.';

-- a extensão do nome do arquivo, no vocabulário do ícone
create or replace function public.doc_formato_de(p_nome text)
returns text language sql immutable as $$
  select case when x is null then null
    when x in ('docx','doc','odt','rtf','dotx') then 'docx'
    when x in ('xlsx','xls','ods','csv','xltx') then 'xlsx'
    when x in ('pptx','ppt','odp','potx') then 'pptx'
    when x in ('md','markdown') then 'md'
    when x = 'pdf' then 'pdf'
    else 'outro' end
    from (select lower(substring(coalesce(p_nome, '') from '\.([A-Za-z0-9]{1,8})$')) x) q
$$;

create or replace function public.tg_doc_formato()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  if new.nome_original is null then return new; end if;
  -- a versão aprovada manda; a enviada só preenche quem ainda não tem formato
  update doc_arquivos a set formato = public.doc_formato_de(new.nome_original)
   where a.id = new.arquivo_id
     and (new.estado = 'aprovada' or a.formato is null)
     and a.formato is distinct from public.doc_formato_de(new.nome_original);
  return new;
end $$;
drop trigger if exists tg_doc_formato on public.doc_revisoes;
create trigger tg_doc_formato after insert or update of estado, nome_original on public.doc_revisoes
  for each row execute function public.tg_doc_formato();

-- o que já está no banco: a última revisão aprovada com arquivo, ou a última enviada
update public.doc_arquivos a set formato = x.f
  from (select distinct on (arquivo_id) arquivo_id, public.doc_formato_de(nome_original) f
          from public.doc_revisoes where nome_original is not null and estado in ('aprovada','pendente')
         order by arquivo_id, (estado = 'aprovada') desc, enviado_em desc) x
 where x.arquivo_id = a.id and a.formato is null;

-- o formato da série, do gestor (doc_serie_salvar continua como está)
create or replace function public.doc_serie_formato(p_serie uuid, p_formato text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  if p_formato is not null and p_formato not in ('docx','xlsx','pptx','md','pdf','outro') then
    return jsonb_build_object('status','invalido','campo','formato'); end if;
  update doc_series set formato = p_formato, atualizado_em = now() where id = p_serie;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok');
end $$;

-- doc_rol, como a v20 deixou, com o formato no fim
create or replace view public.doc_rol with (security_invoker = true) as
select a.id, a.codigo, a.pn, a.serie_id, s.prefixo, s.sn,
       case when a.titulo is null then s.titulo else s.titulo || ' — ' || a.titulo end as titulo,
       s.titulo as serie_titulo, a.titulo as complemento,
       s.tipo, s.subtipo, s.classe, s.multiplo,
       case when a.pn is not null then s.tipo
            when s.multiplo or s.subtipo = 'template' then 'template'
            else s.tipo end as natureza,
       a.status, a.rev_vigente, a.rev_pendente,
       a.template_id, t.codigo as template_codigo, a.template_rev, t.rev_vigente as template_rev_atual,
       a.projeto_id, pj.codigo as projeto_codigo, pj.nome as projeto_nome,
       a.autor, coalesce(ma.nome, a.autor_nome) as autor_nome,
       a.criado_em, a.alterado_em, coalesce(mx.nome, a.alterado_nome) as alterado_nome,
       a.obsoleto_em, a.obsoleto_motivo,
       s.grupo_revisor, s.grupos_leitura,
       (select count(*) from doc_arquivos f where f.serie_id = a.serie_id and f.pn is not null
                                               and a.pn is null) as n_pns,
       a.formato, s.formato as serie_formato
  from doc_arquivos a
  join doc_series s        on s.id = a.serie_id
  left join doc_arquivos t on t.id = a.template_id
  left join projetos pj    on pj.id = a.projeto_id
  left join membros ma     on ma.registro = a.autor
  left join membros mx     on mx.registro = a.alterado_por;

-- ============================================================
-- 12. PERMISSÕES DAS FUNÇÕES, A TRAVA DA CONTA E O REGISTRO
-- ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array['trabalho_salvar(jsonb)','trabalho_pessoas(jsonb)','convidado_salvar(jsonb)','convidados_lista()',
                           'trabalho_documento_salvar(jsonb)','trabalho_documento_tirar(uuid)','habilidades_salvar(jsonb)',
                           'doc_serie_formato(uuid,text)','trabalho_gestor()','trabalho_pode_editar(uuid)','trabalho_doc_posso(uuid)',
                           'membro_efetivo(integer)','grupo_trabalhos()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke execute on function public.tg_doc_formato() from public, anon, authenticated;

do $$ begin
  if to_regprocedure('public.conta_ativa_travar()') is not null then perform public.conta_ativa_travar(); end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.23.0_trabalhos', 'Os trabalhos em Projetos: TRB-N com a ficha de trabalho, a equipe num grupo dentro de NRO_TRABALHOS com quadro em Atividades, responsáveis, projeto opcional, convidados de fora com um membro efetivo responsável, documentos do rol ou links, as habilidades de cada pessoa (membro_habilidades); em Arquivos, a família de cor do emissor e o formato de cada arquivo (doc_rol.formato)')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select nome from grupos where chave = 'trabalhos') as "grupo dos trabalhos",
       (select count(*) from trabalhos) as trabalhos,
       (select count(*) from membro_habilidades) as "pessoas com habilidades",
       (select count(*) from doc_arquivos where formato is not null) as "arquivos com formato";

-- ============================================================
-- FIM, SOMA 2.23.0
--
-- Depois de rodar:
--   1) publique o portal;
--   2) em Projetos, Trabalhos, crie os trabalhos do ciclo (o número
--      vem sozinho, ou escolha); a equipe se monta em Pessoas e
--      trabalhos, arrastando os rostos;
--   3) em Arquivos, Configurações, Emissores, escolha a cor de cada
--      emissor (sem escolha, vale a ordem).
-- ============================================================
