-- ============================================================
-- SOMA 20.0 — MIGRAÇÃO · NeuroDynamics
-- PROJETOS E CONTROLE DE ARQUIVOS.
--
-- Duas coisas que andam juntas, porque um projeto é, na prática,
-- uma equipe e um rol de arquivos.
--
-- PROJETO. Cada projeto é um grupo — a equipe dele é quem está no
-- grupo, e o grupo mora dentro de NRO_PROJECTS (a 19.0 faz quem
-- entra no projeto entrar também em NRO_PROJECTS). Um membro da
-- equipe é o supervisor, e o supervisor é responsável pelo grupo:
-- ele mesmo põe e tira gente da equipe. O projeto tem código
-- (NEBULA), nome e uma semente, da qual a tela gera a logo.
--
-- ARQUIVO. O que hoje mora na planilha NRO-PUB-001, com as regras
-- do template NRO-PUB-002, passa a morar aqui:
--
--   NRO-XXX-YYY-Z
--       XXX  o emissor — departamento ou grupo que emitiu (PES, PRO…)
--       YYY  o número de série (SN): um por "espécie" de arquivo
--       Z    o part number (PN): um por exemplar, quando existe mais
--            de um — um relatório de teste por teste, um termo de
--            abertura por projeto. Política não tem PN: existe uma só.
--
-- Uma SÉRIE (NRO-PES-007) tem sempre uma CABEÇA, o arquivo sem PN.
-- Se a série é de exemplar único, a cabeça É o arquivo (a política).
-- Se a série tem PN, a cabeça é o TEMPLATE, e cada PN nasce dele:
--
--   template de documento   NRO-PRO-001      revisa (Rev. A, B…)
--   documento sem PN        NRO-PES-015      revisa
--   documento com PN        NRO-PRO-001-3    revisa
--   template de registro    NRO-PUB-003      revisa
--   registro                NRO-PUB-003-12   NÃO revisa: registra o
--                                            que aconteceu. A "revisão"
--                                            dele é a do template usado
--
-- Toda versão nova — a primeira de um arquivo ou uma revisão — entra
-- PENDENTE e só fica disponível depois que alguém do grupo revisor
-- daquela série, que não seja quem enviou, aprova. O grupo revisor
-- recebe o aviso no sino e por e-mail (conforme a preferência de cada
-- um, a mesma da 16.0).
--
-- O ACESSO é pelos grupos, e pela classe da série:
--   público       toda a equipe lê
--   controlado    lê quem está no grupo do emissor, na equipe do
--                 projeto, no grupo revisor ou num grupo de leitura
--   confidencial  só os grupos de leitura e o grupo revisor
-- Os METADADOS — código, título, revisão, status, quem mexeu por
-- último — são da equipe inteira, como na planilha: rol que some não
-- é rol fechado, é rol que ninguém sabe que precisa pedir.
--
-- Os arquivos ficam no Storage do Supabase, no bucket privado
-- "arquivos", uma pasta por arquivo, e a mesma regra vale lá: baixar
-- uma revisão aprovada é de quem lê o arquivo; a pendente, só de quem
-- enviou e de quem revisa.
--
-- Pré-requisito: SOMA 19.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'A 20.0 usa esta_no_grupo(), criada pela 19.0, para dizer quem está na equipe de um projeto.';
  end if;
end $$;

-- ============================================================
-- 0. OS DOIS GRUPOS QUE O SISTEMA PRECISA ACHAR SOZINHO
--    "projetos": o pai dos grupos de projeto. Adota um grupo que já
--    se chame assim; não achando, cria NRO_PROJECTS, sem quadro.
--    "pmo": quem administra a documentação. Não é criado — é escolhido
--    em Arquivos › Configurações. Sem PMO, só admin administra.
-- ------------------------------------------------------------
do $$
declare
  v_id   integer;
  v_pref text := 'PRJ';
  v_n    integer := 1;
begin
  select id into v_id from grupos where chave = 'projetos';
  if v_id is null then
    select id into v_id from grupos
     where chave is null
       and upper(trim(nome)) ~ '^(NRO[ _-]?)?PRO(JECTS|JETOS)$'
     order by id limit 1;
  end if;
  if v_id is null then
    while exists (select 1 from grupos where prefixo = v_pref) loop
      v_n := v_n + 1; v_pref := 'PRJ' || v_n;
    end loop;
    insert into grupos (nome, prefixo, quadro, descricao)
    values ('NRO_PROJECTS', v_pref, false,
            'Um subgrupo por projeto. Quem está na equipe de um projeto está aqui.')
    returning id into v_id;
  end if;
  update grupos set chave = 'projetos' where id = v_id and chave is distinct from 'projetos';
end $$;

create or replace function public.grupo_projetos()
returns integer language sql stable security definer
set search_path = public as $$ select id from grupos where chave = 'projetos' $$;

create or replace function public.grupo_pmo()
returns integer language sql stable security definer
set search_path = public as $$ select id from grupos where chave = 'pmo' $$;

-- Quem administra a documentação: admin, e quem está no grupo do PMO.
create or replace function public.doc_gestor()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() = 'admin'
      or coalesce(public.esta_no_grupo(public.grupo_pmo(), public.portal_registro_atual()), false);
$$;

-- O nome de quem age, para as colunas "_nome" (a ficha grava assim).
create or replace function public.doc_meu_nome()
returns text language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select nome from membros where registro = public.portal_registro_atual()),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
    'Portal');
$$;

-- ============================================================
-- 1. PROJETOS
-- ------------------------------------------------------------
create table if not exists public.projetos (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique check (codigo ~ '^[A-Z][A-Z0-9]{1,15}$'),
  nome          text not null,
  descricao     text,
  grupo_id      integer not null unique references public.grupos(id),
  supervisor    integer references public.membros(registro) on delete set null,
  logo_semente  text not null,
  status        text not null default 'ativo' check (status in ('ativo','pausado','encerrado')),
  criado_por    integer references public.membros(registro) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.projetos is
  'Um projeto é um grupo (a equipe) mais um supervisor, um código e a semente da '
  'logo. O rol de arquivos dele é o padrão de projeto (doc_padrao_projeto) '
  'aplicado aos PNs que têm projeto_id = este.';
comment on column public.projetos.logo_semente is
  'A logo é desenhada pela tela a partir desta semente, como os avatares do '
  'GitHub. Trocar a semente troca a logo; o código do projeto não muda.';

alter table public.projetos enable row level security;
drop policy if exists proj_select on public.projetos;
create policy proj_select on public.projetos for select to authenticated using (true);
-- escrita só por projeto_salvar

-- Criar ou editar. Criar é do PMO (e de admin): cria o grupo da equipe
-- dentro de NRO_PROJECTS, com quadro em Atividades, e põe o supervisor
-- como responsável dele. Editar é do PMO e do próprio supervisor.
create or replace function public.projeto_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id     uuid    := nullif(p->>'id','')::uuid;
  v_cod    text    := upper(nullif(trim(p->>'codigo'),''));
  v_nome   text    := nullif(trim(p->>'nome'),'');
  v_sup    integer := nullif(p->>'supervisor','')::integer;
  v_eu     integer := public.portal_registro_atual();
  v_pj     projetos%rowtype;
  v_g      integer;
  v_gnome  text;
  v_pref   text;
  v_n      integer := 1;
  v_quem   text := public.doc_meu_nome();
  v_regs   integer[];
begin
  if v_id is null then
    ------------------------------------------------ criar
    if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
    if v_cod is null or v_cod !~ '^[A-Z][A-Z0-9]{1,15}$' then
      return jsonb_build_object('status','invalido','campo','codigo');
    end if;
    if v_nome is null then return jsonb_build_object('status','invalido','campo','nome'); end if;
    if exists (select 1 from projetos where codigo = v_cod) then
      return jsonb_build_object('status','duplicado','campo','codigo');
    end if;

    v_g := nullif(p->>'grupo_id','')::integer;
    if v_g is not null then
      -- um grupo que já existe vira a equipe
      if not exists (select 1 from grupos where id = v_g) then
        return jsonb_build_object('status','nao_encontrado','campo','grupo_id');
      end if;
      if exists (select 1 from projetos where grupo_id = v_g) then
        return jsonb_build_object('status','duplicado','campo','grupo_id');
      end if;
    else
      v_gnome := coalesce(nullif(trim(p->>'grupo_nome'),''), 'NRO_PROJECT_' || v_cod);
      if exists (select 1 from grupos where nome = v_gnome) then
        return jsonb_build_object('status','duplicado','campo','grupo_nome');
      end if;
      v_pref := left(regexp_replace(v_cod, '[^A-Z]', '', 'g'), 3);
      if length(v_pref) < 2 then v_pref := 'PJ'; end if;
      while exists (select 1 from grupos where prefixo = v_pref || case when v_n = 1 then '' else v_n::text end) loop
        v_n := v_n + 1;
      end loop;
      v_pref := v_pref || case when v_n = 1 then '' else v_n::text end;
      insert into grupos (nome, prefixo, pai_id, quadro, descricao)
      values (v_gnome, v_pref, public.grupo_projetos(), true, 'A equipe do projeto ' || v_nome || '.')
      returning id into v_g;
    end if;
    select nome into v_gnome from grupos where id = v_g;

    -- a equipe: quem veio no pedido, mais o supervisor
    select coalesce(array_agg(distinct x::integer), '{}') into v_regs
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'equipe') = 'array' then p->'equipe' else '[]'::jsonb end) t(x)
     where x ~ '^\d+$' and exists (select 1 from membros where registro = x::integer);
    if v_sup is not null then v_regs := array(select distinct unnest(v_regs || v_sup)); end if;

    with feitos as (
      update membros set grupos = array_append(coalesce(grupos,'{}'), v_gnome)
       where registro = any(v_regs) and not (coalesce(grupos,'{}') @> array[v_gnome])
      returning registro
    ) insert into ocorrencias (registro, tipo, descricao, data, responsavel)
      select registro, 'Adição a grupo', v_gnome, current_date, v_quem from feitos;

    if v_sup is not null then
      update grupos set responsaveis = array(select distinct unnest(responsaveis || v_sup)) where id = v_g;
    end if;

    insert into projetos (codigo, nome, descricao, grupo_id, supervisor, logo_semente, criado_por)
    values (v_cod, v_nome, nullif(trim(p->>'descricao'),''), v_g, v_sup,
            coalesce(nullif(p->>'logo_semente',''), lower(v_cod)), v_eu)
    returning * into v_pj;

    if array_length(v_regs, 1) > 0 then
      perform public.notificar(v_regs, 'projeto_equipe', 'Você está na equipe do projeto ' || v_nome,
        case when v_sup is not null then 'Supervisão de ' || coalesce((select nome from membros where registro = v_sup), '—') || '.' end,
        '#/projetos/' || v_cod);
    end if;
    return jsonb_build_object('status','ok','id',v_pj.id,'codigo',v_pj.codigo,'grupo_id',v_g);
  end if;

  ------------------------------------------------ editar
  select * into v_pj from projetos where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (public.doc_gestor() or (v_eu is not null and v_eu = v_pj.supervisor)) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if p ? 'nome' and v_nome is null then return jsonb_build_object('status','invalido','campo','nome'); end if;
  if p ? 'status' and coalesce(p->>'status','') not in ('ativo','pausado','encerrado') then
    return jsonb_build_object('status','invalido','campo','status');
  end if;

  if p ? 'supervisor' and v_sup is distinct from v_pj.supervisor then
    select nome into v_gnome from grupos where id = v_pj.grupo_id;
    if v_sup is not null and not public.esta_no_grupo(v_pj.grupo_id, v_sup) then
      -- supervisor é da equipe: quem passa a supervisionar entra nela
      update membros set grupos = array_append(coalesce(grupos,'{}'), v_gnome) where registro = v_sup;
      insert into ocorrencias (registro, tipo, descricao, data, responsavel)
      values (v_sup, 'Adição a grupo', v_gnome, current_date, v_quem);
    end if;
    update grupos
       set responsaveis = array(select distinct x from unnest(array_remove(responsaveis, v_pj.supervisor)
                                  || case when v_sup is null then '{}'::integer[] else array[v_sup] end) x)
     where id = v_pj.grupo_id;
  end if;

  update projetos
     set nome          = coalesce(case when p ? 'nome' then v_nome end, nome),
         descricao     = case when p ? 'descricao' then nullif(trim(p->>'descricao'),'') else descricao end,
         status        = coalesce(nullif(p->>'status',''), status),
         supervisor    = case when p ? 'supervisor' then v_sup else supervisor end,
         logo_semente  = coalesce(nullif(p->>'logo_semente',''), logo_semente),
         atualizado_em = now()
   where id = v_id;
  return jsonb_build_object('status','ok','id',v_id,'codigo',v_pj.codigo,'grupo_id',v_pj.grupo_id);
end $$;
revoke execute on function public.projeto_salvar(jsonb) from public, anon;
grant  execute on function public.projeto_salvar(jsonb) to authenticated;

-- ============================================================
-- 2. O ROL: EMISSORES, SÉRIES, ARQUIVOS
-- ------------------------------------------------------------

-- 2a. Emissor: o XXX do código. Um por departamento ou grupo que emite
--     arquivo; o grupo dele é o "dono" — quem está nele cria PN e envia
--     revisão das séries daquele emissor.
create table if not exists public.doc_emissores (
  prefixo   text primary key check (prefixo ~ '^[A-Z]{3}$'),
  nome      text not null,
  grupo_id  integer references public.grupos(id) on delete set null,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

-- 2b. Série: o SN. Uma linha por linha da planilha NRO-PUB-001.
create table if not exists public.doc_series (
  id             uuid primary key default gen_random_uuid(),
  prefixo        text not null references public.doc_emissores(prefixo) on update cascade,
  sn             integer not null check (sn between 1 and 999),
  titulo         text not null,
  tipo           text not null check (tipo in ('documento','registro')),
  subtipo        text not null default 'outro'
                 check (subtipo in ('politica','procedimento','manual','template','formulario','planilha',
                                    'checklist','relatorio','ata','inventario','declaracao','outro')),
  classe         text not null default 'controlado' check (classe in ('publico','controlado','confidencial')),
  multiplo       boolean not null default false,
  grupo_revisor  integer references public.grupos(id) on delete set null,
  grupos_leitura integer[] not null default '{}',
  descricao      text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  unique (prefixo, sn),
  -- registro sempre nasce de um template: a série de registro tem PN
  constraint doc_series_registro_tem_pn check (tipo = 'documento' or multiplo)
);

comment on column public.doc_series.multiplo is
  'A série existe em vários PNs. Aí a cabeça (o arquivo sem PN) é o template, '
  'e cada PN nasce dele. Registro é sempre assim.';
comment on column public.doc_series.grupo_revisor is
  'Quem revisa as versões desta série. Sem grupo, revisa o PMO (ou admin).';
comment on column public.doc_series.grupos_leitura is
  'Grupos que leem o conteúdo além dos de sempre. Na classe confidencial, são '
  'os únicos (com o grupo revisor).';

-- 2c. Arquivo: a cabeça da série (PN nulo) e cada PN.
create table if not exists public.doc_arquivos (
  id              uuid primary key default gen_random_uuid(),
  serie_id        uuid not null references public.doc_series(id) on delete cascade,
  pn              integer check (pn is null or pn >= 1),
  codigo          text not null unique,
  titulo          text,
  projeto_id      uuid references public.projetos(id) on delete set null,
  template_id     uuid references public.doc_arquivos(id) on delete set null,
  template_rev    text,
  status          text not null default 'rascunho'
                  check (status in ('rascunho','em_revisao','ativo','obsoleto')),
  rev_vigente     text,
  rev_pendente    text,
  autor           integer references public.membros(registro) on delete set null,
  autor_nome      text,
  criado_em       timestamptz not null default now(),
  alterado_em     timestamptz not null default now(),
  alterado_por    integer references public.membros(registro) on delete set null,
  alterado_nome   text,
  obsoleto_em     timestamptz,
  obsoleto_motivo text,
  unique (serie_id, pn)
);
create unique index if not exists doc_arquivos_cabeca_ix on public.doc_arquivos (serie_id) where pn is null;
create index if not exists doc_arquivos_projeto_ix on public.doc_arquivos (projeto_id) where projeto_id is not null;
create index if not exists doc_arquivos_template_ix on public.doc_arquivos (template_id) where template_id is not null;

comment on column public.doc_arquivos.titulo is
  'Complemento do título da série para este PN ("Nebula — bancada 2"). Nulo '
  'na cabeça e quando o PN não precisa de nome próprio.';
comment on column public.doc_arquivos.autor is
  'Quem criou ESTE arquivo — este PN —, e não o template de que ele nasceu.';
comment on column public.doc_arquivos.template_rev is
  'A revisão do template usada na versão em vigor. É a "Rev." de um registro, '
  'como manda o NRO-PUB-002.';
comment on column public.doc_arquivos.status is
  'rascunho: ainda sem versão aprovada · em_revisao: a primeira versão aguarda '
  'revisão · ativo: há versão aprovada em vigor (uma revisão nova pendente não '
  'tira o arquivo de vigor; ela aparece em rev_pendente) · obsoleto.';

-- 2d. Revisões: cada versão enviada, com o seu destino.
create table if not exists public.doc_revisoes (
  id            uuid primary key default gen_random_uuid(),
  arquivo_id    uuid not null references public.doc_arquivos(id) on delete cascade,
  rev           text,
  estado        text not null default 'pendente'
                check (estado in ('pendente','aprovada','devolvida','substituida','cancelada')),
  caminho       text,
  nome_original text,
  mime          text,
  tamanho       bigint,
  mudancas      text,
  relacionados  jsonb not null default '[]'::jsonb,
  template_rev  text,
  enviado_por   integer references public.membros(registro) on delete set null,
  enviado_nome  text,
  enviado_em    timestamptz not null default now(),
  revisor       integer references public.membros(registro) on delete set null,
  revisor_nome  text,
  revisado_em   timestamptz,
  parecer       text,
  importada     boolean not null default false
);
create unique index if not exists doc_rev_uma_pendente_ix on public.doc_revisoes (arquivo_id) where estado = 'pendente';
create unique index if not exists doc_rev_caminho_ix on public.doc_revisoes (caminho) where caminho is not null;
create index if not exists doc_rev_arquivo_ix on public.doc_revisoes (arquivo_id, enviado_em desc);

comment on column public.doc_revisoes.relacionados is
  'A conferência feita ao enviar: para cada pai e filho do arquivo, se ele foi '
  'revisado junto ou não precisa mudar. [{arquivo_id, codigo, decisao}]';
comment on column public.doc_revisoes.importada is
  'Veio da planilha NRO-PUB-001: a aprovação aconteceu fora do portal, e o '
  'arquivo em si pode ainda não ter sido anexado.';

-- 2e. Relações: pai e filho. O checklist de offboarding é filho do
--     procedimento de desligamento: revisar o procedimento obriga a
--     olhar o checklist.
create table if not exists public.doc_relacoes (
  pai_id     uuid not null references public.doc_arquivos(id) on delete cascade,
  filho_id   uuid not null references public.doc_arquivos(id) on delete cascade,
  criado_por integer references public.membros(registro) on delete set null,
  criado_em  timestamptz not null default now(),
  primary key (pai_id, filho_id),
  check (pai_id <> filho_id)
);
create index if not exists doc_rel_filho_ix on public.doc_relacoes (filho_id);

create or replace function public.tg_doc_relacao_sem_ciclo()
returns trigger language plpgsql as $$
begin
  if exists (
    with recursive acima(id) as (
      select new.pai_id
      union
      select r.pai_id from public.doc_relacoes r join acima a on r.filho_id = a.id
    ) select 1 from acima where id = new.filho_id
  ) then
    raise exception using errcode = 'check_violation',
      message = 'Essa relação fecharia um círculo: o filho já está acima do pai.';
  end if;
  return new;
end $$;
drop trigger if exists tg_doc_relacoes_sem_ciclo on public.doc_relacoes;
create trigger tg_doc_relacoes_sem_ciclo before insert or update on public.doc_relacoes
  for each row execute function public.tg_doc_relacao_sem_ciclo();

-- 2f. O padrão de projeto: as séries que todo projeto tem. Mudar aqui
--     muda o rol de TODOS os projetos — ele é calculado na leitura.
create table if not exists public.doc_padrao_projeto (
  serie_id   uuid primary key references public.doc_series(id) on delete cascade,
  ordem      integer not null default 0,
  quantidade text not null default 'um' check (quantidade in ('um','varios')),
  criado_em  timestamptz not null default now()
);

create or replace function public.tg_doc_padrao_so_multiplo()
returns trigger language plpgsql as $$
begin
  if not exists (select 1 from public.doc_series where id = new.serie_id and multiplo) then
    raise exception using errcode = 'check_violation',
      message = 'Só entra no padrão de projeto uma série que tem PN — cada projeto ganha o seu.';
  end if;
  return new;
end $$;
drop trigger if exists tg_doc_padrao_so_multiplo on public.doc_padrao_projeto;
create trigger tg_doc_padrao_so_multiplo before insert or update on public.doc_padrao_projeto
  for each row execute function public.tg_doc_padrao_so_multiplo();

-- 2g. O que acontece com um arquivo e não é uma revisão: criar,
--     relacionar, obsoletar, mudar o grupo revisor, anexar o arquivo de
--     uma revisão importada. O registro de alterações da tela junta isto
--     com as revisões.
create table if not exists public.doc_eventos (
  id         bigserial primary key,
  arquivo_id uuid not null references public.doc_arquivos(id) on delete cascade,
  tipo       text not null,
  detalhe    text,
  registro   integer references public.membros(registro) on delete set null,
  nome       text,
  criado_em  timestamptz not null default now()
);
create index if not exists doc_eventos_ix on public.doc_eventos (arquivo_id, criado_em);

create or replace function public.doc_evento(p_arquivo uuid, p_tipo text, p_detalhe text)
returns void language sql volatile security definer
set search_path = public as $$
  insert into doc_eventos (arquivo_id, tipo, detalhe, registro, nome)
  values (p_arquivo, p_tipo, p_detalhe, public.portal_registro_atual(), public.doc_meu_nome());
$$;
revoke execute on function public.doc_evento(uuid, text, text) from public, anon, authenticated;

-- ============================================================
-- 3. QUEM PODE O QUÊ
--    Uma função por pergunta, e as políticas, a tela e o Storage
--    perguntam para elas.
-- ------------------------------------------------------------

-- O código, montado num lugar só.
create or replace function public.doc_codigo(p_prefixo text, p_sn integer, p_pn integer)
returns text language sql immutable as $$
  select 'NRO-' || p_prefixo || '-' || lpad(p_sn::text, 3, '0') || coalesce('-' || p_pn::text, '');
$$;

-- Ler o CONTEÚDO (baixar, ver o registro de alterações).
create or replace function public.doc_pode_ler(p_arquivo uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  a     record;
begin
  select ar.autor, s.classe, s.grupo_revisor, s.grupos_leitura,
         e.grupo_id as grupo_emissor, pj.grupo_id as grupo_projeto
    into a
    from doc_arquivos ar
    join doc_series s on s.id = ar.serie_id
    join doc_emissores e on e.prefixo = s.prefixo
    left join projetos pj on pj.id = ar.projeto_id
   where ar.id = p_arquivo;
  if not found then return false; end if;
  if public.doc_gestor() then return true; end if;
  if a.classe = 'publico' then return true; end if;
  if v_reg is null then return false; end if;
  if a.autor = v_reg then return true; end if;
  if public.esta_no_grupo(a.grupo_revisor, v_reg) then return true; end if;
  if exists (select 1 from unnest(a.grupos_leitura) g where public.esta_no_grupo(g, v_reg)) then return true; end if;
  if a.classe = 'controlado'
     and (public.esta_no_grupo(a.grupo_emissor, v_reg) or public.esta_no_grupo(a.grupo_projeto, v_reg)) then
    return true;
  end if;
  return false;
end $$;

-- Mexer: enviar versão, dar título ao PN, relacionar. Quem mexe lê.
create or replace function public.doc_pode_editar(p_arquivo uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  a     record;
begin
  if public.doc_gestor() then return exists (select 1 from doc_arquivos where id = p_arquivo); end if;
  if v_reg is null or not public.doc_pode_ler(p_arquivo) then return false; end if;
  select ar.autor, e.grupo_id as grupo_emissor, pj.grupo_id as grupo_projeto
    into a
    from doc_arquivos ar
    join doc_series s on s.id = ar.serie_id
    join doc_emissores e on e.prefixo = s.prefixo
    left join projetos pj on pj.id = ar.projeto_id
   where ar.id = p_arquivo;
  return a.autor = v_reg
      or public.esta_no_grupo(a.grupo_emissor, v_reg)
      or public.esta_no_grupo(a.grupo_projeto, v_reg);
end $$;

-- Criar um PN numa série — para um projeto, ou para o emissor.
create or replace function public.doc_pode_criar(p_serie uuid, p_projeto uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  s     record;
begin
  select ds.classe, ds.grupos_leitura, ds.grupo_revisor, e.grupo_id as grupo_emissor
    into s from doc_series ds join doc_emissores e on e.prefixo = ds.prefixo where ds.id = p_serie;
  if not found then return false; end if;
  if public.doc_gestor() then return true; end if;
  if v_reg is null then return false; end if;
  if s.classe = 'confidencial' then
    return exists (select 1 from unnest(s.grupos_leitura || s.grupo_revisor) g where public.esta_no_grupo(g, v_reg));
  end if;
  if public.esta_no_grupo(s.grupo_emissor, v_reg) then return true; end if;
  return p_projeto is not null
     and exists (select 1 from doc_padrao_projeto where serie_id = p_serie)
     and public.esta_no_grupo((select grupo_id from projetos where id = p_projeto), v_reg);
end $$;

-- Revisar uma versão pendente: estar no grupo revisor da série (ou, sem
-- grupo revisor, ser gestor da documentação) e não ter sido quem enviou.
create or replace function public.doc_pode_revisar(p_revisao uuid)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  r     record;
begin
  select rv.estado, rv.enviado_por, s.grupo_revisor
    into r
    from doc_revisoes rv
    join doc_arquivos a on a.id = rv.arquivo_id
    join doc_series s on s.id = a.serie_id
   where rv.id = p_revisao;
  if not found or r.estado <> 'pendente' then return false; end if;
  if v_reg is not null and v_reg = r.enviado_por then return false; end if;
  if r.grupo_revisor is null then return public.doc_gestor(); end if;
  return public.esta_no_grupo(r.grupo_revisor, v_reg);
end $$;

-- Quem recebe o aviso de que há uma versão para revisar.
create or replace function public.doc_revisores(p_arquivo uuid)
returns integer[] language sql stable security definer
set search_path = public as $$
  with g as (
    select coalesce(s.grupo_revisor, public.grupo_pmo()) as grupo
      from doc_arquivos a join doc_series s on s.id = a.serie_id where a.id = p_arquivo
  )
  select coalesce(array_agg(distinct x), '{}') from (
    select gp.registro as x
      from g, lateral public.grupo_pessoas(g.grupo) gp
      join membros m on m.registro = gp.registro and m.status in ('Ativo','Em pausa / avaliação')
     where g.grupo is not null
    union
    -- sem grupo revisor e sem PMO, quem responde é a administração
    select pf.registro from perfis pf, g
     where g.grupo is null and pf.papel = 'admin' and pf.registro is not null
  ) q;
$$;

revoke execute on function public.doc_pode_ler(uuid)            from public, anon;
revoke execute on function public.doc_pode_editar(uuid)         from public, anon;
revoke execute on function public.doc_pode_criar(uuid, uuid)    from public, anon;
revoke execute on function public.doc_pode_revisar(uuid)        from public, anon;
revoke execute on function public.doc_gestor()                  from public, anon;
revoke execute on function public.doc_revisores(uuid)           from public, anon, authenticated;
grant  execute on function public.doc_pode_ler(uuid)            to authenticated;
grant  execute on function public.doc_pode_editar(uuid)         to authenticated;
grant  execute on function public.doc_pode_criar(uuid, uuid)    to authenticated;
grant  execute on function public.doc_pode_revisar(uuid)        to authenticated;
grant  execute on function public.doc_gestor()                  to authenticated;

-- ------------------------------------------------------------
-- 3b. RLS
--     Metadado é da equipe; conteúdo (revisões, eventos) é de quem lê.
--     Escrita: emissores e padrão de projeto direto na tabela, para o
--     gestor; o resto só pelas funções da seção 4.
-- ------------------------------------------------------------
alter table public.doc_emissores      enable row level security;
alter table public.doc_series         enable row level security;
alter table public.doc_arquivos       enable row level security;
alter table public.doc_revisoes       enable row level security;
alter table public.doc_relacoes       enable row level security;
alter table public.doc_padrao_projeto enable row level security;
alter table public.doc_eventos        enable row level security;

drop policy if exists demi_select on public.doc_emissores;
create policy demi_select on public.doc_emissores for select to authenticated using (true);
drop policy if exists demi_write on public.doc_emissores;
create policy demi_write on public.doc_emissores for all to authenticated
  using (public.doc_gestor()) with check (public.doc_gestor());

drop policy if exists dser_select on public.doc_series;
create policy dser_select on public.doc_series for select to authenticated using (true);

drop policy if exists darq_select on public.doc_arquivos;
create policy darq_select on public.doc_arquivos for select to authenticated using (true);

drop policy if exists drev_select on public.doc_revisoes;
create policy drev_select on public.doc_revisoes for select to authenticated
  using (public.doc_pode_ler(arquivo_id));

drop policy if exists drel_select on public.doc_relacoes;
create policy drel_select on public.doc_relacoes for select to authenticated using (true);

drop policy if exists dpad_select on public.doc_padrao_projeto;
create policy dpad_select on public.doc_padrao_projeto for select to authenticated using (true);
drop policy if exists dpad_write on public.doc_padrao_projeto;
create policy dpad_write on public.doc_padrao_projeto for all to authenticated
  using (public.doc_gestor()) with check (public.doc_gestor());

drop policy if exists devt_select on public.doc_eventos;
create policy devt_select on public.doc_eventos for select to authenticated
  using (public.doc_pode_ler(arquivo_id));

-- ------------------------------------------------------------
-- 3c. O rol, como a tela lê: uma linha por arquivo, com o que a
--     tabela mostra e o que os filtros precisam.
-- ------------------------------------------------------------
drop view if exists public.doc_rol;
create view public.doc_rol with (security_invoker = true) as
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
                                               and a.pn is null) as n_pns
  from doc_arquivos a
  join doc_series s        on s.id = a.serie_id
  left join doc_arquivos t on t.id = a.template_id
  left join projetos pj    on pj.id = a.projeto_id
  left join membros ma     on ma.registro = a.autor
  left join membros mx     on mx.registro = a.alterado_por;

comment on view public.doc_rol is
  'O rol de arquivos, uma linha por arquivo (cabeça e PNs), com a natureza '
  '(template, documento, registro) já resolvida. Só metadados — o conteúdo '
  'mora em doc_revisoes e no Storage, atrás de doc_pode_ler.';

-- ============================================================
-- 4. O QUE SE FAZ COM UM ARQUIVO
-- ------------------------------------------------------------

-- 4a. Série nova, ou a configuração de uma: título, subtipo, classe,
--     grupo revisor, grupos de leitura. Tipo e "tem PN" só mudam
--     enquanto a série não tem nenhum PN. Prefixo e SN não mudam
--     nunca: são o código.
create or replace function public.doc_serie_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id     uuid    := nullif(p->>'id','')::uuid;
  v_s      doc_series%rowtype;
  v_pref   text    := upper(nullif(trim(p->>'prefixo'),''));
  v_sn     integer := nullif(p->>'sn','')::integer;
  v_tipo   text    := nullif(p->>'tipo','');
  v_mult   boolean := nullif(p->>'multiplo','')::boolean;
  v_rev    integer := nullif(p->>'grupo_revisor','')::integer;
  v_leit   integer[];
  v_cab    uuid;
  v_antes  text;
begin
  if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'grupos_leitura' then
    select coalesce(array_agg(distinct x::integer), '{}') into v_leit
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'grupos_leitura') = 'array' then p->'grupos_leitura' else '[]'::jsonb end) t(x)
     where x ~ '^\d+$' and exists (select 1 from grupos where id = x::integer);
  end if;
  if p ? 'grupo_revisor' and v_rev is not null and not exists (select 1 from grupos where id = v_rev) then
    return jsonb_build_object('status','nao_encontrado','campo','grupo_revisor');
  end if;

  if v_id is null then
    if v_pref is null or not exists (select 1 from doc_emissores where prefixo = v_pref) then
      return jsonb_build_object('status','invalido','campo','prefixo');
    end if;
    if nullif(trim(p->>'titulo'),'') is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
    if v_tipo not in ('documento','registro') then return jsonb_build_object('status','invalido','campo','tipo'); end if;
    perform pg_advisory_xact_lock(hashtext('doc_sn'), hashtext(v_pref));
    if v_sn is null then
      select coalesce(max(sn), 0) + 1 into v_sn from doc_series where prefixo = v_pref;
    elsif exists (select 1 from doc_series where prefixo = v_pref and sn = v_sn) then
      return jsonb_build_object('status','duplicado','campo','sn');
    end if;
    if v_sn > 999 then return jsonb_build_object('status','invalido','campo','sn'); end if;
    insert into doc_series (prefixo, sn, titulo, tipo, subtipo, classe, multiplo, grupo_revisor, grupos_leitura, descricao)
    values (v_pref, v_sn, trim(p->>'titulo'), v_tipo, coalesce(nullif(p->>'subtipo',''), 'outro'),
            coalesce(nullif(p->>'classe',''), 'controlado'),
            coalesce(v_mult, false) or v_tipo = 'registro', v_rev, coalesce(v_leit, '{}'),
            nullif(trim(p->>'descricao'),''))
    returning * into v_s;
    insert into doc_arquivos (serie_id, pn, codigo, autor, autor_nome, alterado_por, alterado_nome)
    values (v_s.id, null, public.doc_codigo(v_s.prefixo, v_s.sn, null),
            public.portal_registro_atual(), public.doc_meu_nome(),
            public.portal_registro_atual(), public.doc_meu_nome())
    returning id into v_cab;
    perform public.doc_evento(v_cab, 'criou', null);
    return jsonb_build_object('status','ok','id',v_s.id,'arquivo_id',v_cab,
                              'codigo',public.doc_codigo(v_s.prefixo, v_s.sn, null));
  end if;

  select * into v_s from doc_series where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  select id into v_cab from doc_arquivos where serie_id = v_id and pn is null;
  if (v_tipo is not null and v_tipo <> v_s.tipo) or (v_mult is not null and v_mult <> v_s.multiplo) then
    if exists (select 1 from doc_arquivos where serie_id = v_id and pn is not null) then
      return jsonb_build_object('status','tem_pn');
    end if;
    if coalesce(v_tipo, v_s.tipo) = 'registro' and not coalesce(v_mult, v_s.multiplo) then
      return jsonb_build_object('status','invalido','campo','multiplo');
    end if;
    if not coalesce(v_mult, v_s.multiplo) and exists (select 1 from doc_padrao_projeto where serie_id = v_id) then
      return jsonb_build_object('status','no_padrao');
    end if;
  end if;

  v_antes := (select nome from grupos where id = v_s.grupo_revisor);
  update doc_series
     set titulo         = coalesce(nullif(trim(p->>'titulo'),''), titulo),
         tipo           = coalesce(v_tipo, tipo),
         multiplo       = coalesce(v_mult, multiplo),
         subtipo        = coalesce(nullif(p->>'subtipo',''), subtipo),
         classe         = coalesce(nullif(p->>'classe',''), classe),
         grupo_revisor  = case when p ? 'grupo_revisor' then v_rev else grupo_revisor end,
         grupos_leitura = case when p ? 'grupos_leitura' then v_leit else grupos_leitura end,
         descricao      = case when p ? 'descricao' then nullif(trim(p->>'descricao'),'') else descricao end,
         atualizado_em  = now()
   where id = v_id;
  if p ? 'grupo_revisor' and v_rev is distinct from v_s.grupo_revisor and v_cab is not null then
    perform public.doc_evento(v_cab, 'revisor',
      coalesce((select nome from grupos where id = v_rev), 'PMO') || case when v_antes is not null then ' (era ' || v_antes || ')' else '' end);
  end if;
  return jsonb_build_object('status','ok','id',v_id,'codigo',public.doc_codigo(v_s.prefixo, v_s.sn, null));
end $$;

-- 4b. Um PN novo numa série com PN. Nasce em rascunho, do template da
--     série; para um projeto, se veio projeto. Série do padrão com "um
--     por projeto" não ganha um segundo PN para o mesmo projeto.
create or replace function public.doc_arquivo_criar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_serie uuid := nullif(p->>'serie_id','')::uuid;
  v_proj  uuid := nullif(p->>'projeto_id','')::uuid;
  v_s     doc_series%rowtype;
  v_pn    integer;
  v_id    uuid;
  v_cod   text;
  v_tpl   uuid;
  v_ja    text;
begin
  select * into v_s from doc_series where id = v_serie;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not v_s.multiplo then return jsonb_build_object('status','sem_pn'); end if;
  if v_proj is not null and not exists (select 1 from projetos where id = v_proj) then
    return jsonb_build_object('status','nao_encontrado','campo','projeto_id');
  end if;
  if not public.doc_pode_criar(v_serie, v_proj) then return jsonb_build_object('status','sem_permissao'); end if;

  perform pg_advisory_xact_lock(hashtext('doc_pn'), hashtext(v_serie::text));
  if v_proj is not null and exists (select 1 from doc_padrao_projeto where serie_id = v_serie and quantidade = 'um') then
    select codigo into v_ja from doc_arquivos where serie_id = v_serie and projeto_id = v_proj limit 1;
    if v_ja is not null then return jsonb_build_object('status','ja_existe','codigo',v_ja); end if;
  end if;

  select coalesce(max(pn), 0) + 1 into v_pn from doc_arquivos where serie_id = v_serie;
  v_cod := public.doc_codigo(v_s.prefixo, v_s.sn, v_pn);
  v_tpl := coalesce(nullif(p->>'template_id','')::uuid,
                    (select id from doc_arquivos where serie_id = v_serie and pn is null));
  insert into doc_arquivos (serie_id, pn, codigo, titulo, projeto_id, template_id, template_rev,
                            autor, autor_nome, alterado_por, alterado_nome)
  values (v_serie, v_pn, v_cod, nullif(trim(p->>'titulo'),''), v_proj, v_tpl,
          (select rev_vigente from doc_arquivos where id = v_tpl),
          public.portal_registro_atual(), public.doc_meu_nome(),
          public.portal_registro_atual(), public.doc_meu_nome())
  returning id into v_id;
  perform public.doc_evento(v_id, 'criou', (select codigo from projetos where id = v_proj));
  return jsonb_build_object('status','ok','id',v_id,'codigo',v_cod);
end $$;

-- 4c. Título do PN, template de que nasceu, projeto.
create or replace function public.doc_arquivo_editar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id  uuid := nullif(p->>'id','')::uuid;
  v_tpl uuid := nullif(p->>'template_id','')::uuid;
begin
  if not public.doc_pode_editar(v_id) then return jsonb_build_object('status','sem_permissao'); end if;
  if p ? 'template_id' and v_tpl is not null then
    if v_tpl = v_id then return jsonb_build_object('status','invalido','campo','template_id'); end if;
    if not exists (select 1 from doc_rol where id = v_tpl and natureza = 'template') then
      return jsonb_build_object('status','invalido','campo','template_id');
    end if;
  end if;
  update doc_arquivos
     set titulo       = case when p ? 'titulo' then nullif(trim(p->>'titulo'),'') else titulo end,
         template_id  = case when p ? 'template_id' then v_tpl else template_id end,
         template_rev = case when p ? 'template_id' then (select rev_vigente from doc_arquivos where id = v_tpl)
                             else template_rev end,
         projeto_id   = case when p ? 'projeto_id' and public.doc_gestor() then nullif(p->>'projeto_id','')::uuid
                             else projeto_id end,
         alterado_em  = now(), alterado_por = public.portal_registro_atual(), alterado_nome = public.doc_meu_nome()
   where id = v_id;
  if p ? 'template_id' then
    perform public.doc_evento(v_id, 'template', (select codigo from doc_arquivos where id = v_tpl));
  end if;
  return jsonb_build_object('status','ok');
end $$;

-- A próxima letra: A, B, …, Z, AA, AB… (como as colunas de planilha).
create or replace function public.doc_proxima_rev(p_rev text)
returns text language plpgsql immutable as $$
declare v text := upper(coalesce(p_rev, '')); i integer; c text;
begin
  if v = '' then return 'A'; end if;
  i := length(v);
  while i > 0 loop
    c := substr(v, i, 1);
    if c <> 'Z' then
      return substr(v, 1, i - 1) || chr(ascii(c) + 1) || repeat('A', length(v) - i);
    end if;
    i := i - 1;
  end loop;
  return 'A' || repeat('A', length(v));
end $$;

-- 4d. Enviar uma versão: a primeira de um arquivo, ou uma revisão.
--     O arquivo já subiu para o Storage (pasta <arquivo_id>/); aqui ele
--     vira revisão PENDENTE, e o grupo revisor é avisado. Antes, a
--     pessoa precisa dizer, para cada pai e cada filho do arquivo, se
--     ele foi revisado junto ou não precisa mudar.
create or replace function public.doc_revisao_enviar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_arq     uuid := nullif(p->>'arquivo_id','')::uuid;
  v_cam     text := nullif(p->>'caminho','');
  a         record;
  v_rev     text;
  v_id      uuid;
  v_faltam  text[];
  v_rel     jsonb;
  v_tplrev  text;
  v_quem    text := public.doc_meu_nome();
  v_titulo  text;
begin
  select ar.*, s.tipo, s.titulo as serie_titulo,
         case when ar.pn is not null then s.tipo
              when s.multiplo or s.subtipo = 'template' then 'template' else s.tipo end as natureza
    into a
    from doc_arquivos ar join doc_series s on s.id = ar.serie_id where ar.id = v_arq;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if a.status = 'obsoleto' then return jsonb_build_object('status','obsoleto'); end if;
  if not public.doc_pode_editar(v_arq) then return jsonb_build_object('status','sem_permissao'); end if;
  if public.portal_registro_atual() is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_cam is null or split_part(v_cam, '/', 1) <> v_arq::text then
    return jsonb_build_object('status','invalido','campo','caminho');
  end if;
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from storage.objects where bucket_id = 'arquivos' and name = v_cam) then
      return jsonb_build_object('status','arquivo_nao_enviado');
    end if;
  end if;
  if exists (select 1 from doc_revisoes where caminho = v_cam) then
    return jsonb_build_object('status','duplicado','campo','caminho');
  end if;
  if exists (select 1 from doc_revisoes where arquivo_id = v_arq and estado = 'pendente') then
    return jsonb_build_object('status','ja_pendente');
  end if;
  -- registro não se revisa: aprovado, está fechado
  if a.natureza = 'registro' and exists (select 1 from doc_revisoes where arquivo_id = v_arq and estado = 'aprovada') then
    return jsonb_build_object('status','registro_fechado');
  end if;
  -- revisão (não a primeira versão) diz o que mudou
  if a.natureza <> 'registro' and a.rev_vigente is not null and nullif(trim(p->>'mudancas'),'') is null then
    return jsonb_build_object('status','invalido','campo','mudancas');
  end if;

  -- a conferência dos relacionados: todo pai e todo filho não obsoleto
  -- precisa de uma decisão
  v_rel := case when jsonb_typeof(p->'relacionados') = 'array' then p->'relacionados' else '[]'::jsonb end;
  select coalesce(array_agg(o.codigo order by o.codigo), '{}') into v_faltam
    from (select pai_id as id from doc_relacoes where filho_id = v_arq
          union select filho_id from doc_relacoes where pai_id = v_arq) r
    join doc_arquivos o on o.id = r.id and o.status <> 'obsoleto'
   where not exists (
     select 1 from jsonb_array_elements(v_rel) x
      where x->>'arquivo_id' = r.id::text and x->>'decisao' in ('revisado','sem_mudanca'));
  if array_length(v_faltam, 1) > 0 then
    return jsonb_build_object('status','conferir_relacionados','faltam',to_jsonb(v_faltam));
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('arquivo_id', o.id, 'codigo', o.codigo,
                                               'decisao', x->>'decisao') order by o.codigo), '[]'::jsonb)
    into v_rel
    from jsonb_array_elements(v_rel) x
    join doc_arquivos o on o.id::text = x->>'arquivo_id'
   where x->>'decisao' in ('revisado','sem_mudanca');

  v_rev := case when a.natureza = 'registro' then null else public.doc_proxima_rev(a.rev_vigente) end;
  v_tplrev := case when a.template_id is null then null
                   else coalesce(nullif(p->>'template_rev',''), (select rev_vigente from doc_arquivos where id = a.template_id)) end;

  insert into doc_revisoes (arquivo_id, rev, estado, caminho, nome_original, mime, tamanho, mudancas,
                            relacionados, template_rev, enviado_por, enviado_nome)
  values (v_arq, v_rev, 'pendente', v_cam, nullif(p->>'nome_original',''), nullif(p->>'mime',''),
          nullif(p->>'tamanho','')::bigint, nullif(trim(p->>'mudancas'),''), v_rel, v_tplrev,
          public.portal_registro_atual(), v_quem)
  returning id into v_id;

  update doc_arquivos
     set status        = case when status = 'ativo' then 'ativo' else 'em_revisao' end,
         rev_pendente  = coalesce(v_rev, '—'),
         alterado_em   = now(), alterado_por = public.portal_registro_atual(), alterado_nome = v_quem
   where id = v_arq;

  v_titulo := a.codigo || ' — ' || a.serie_titulo || coalesce(' — ' || a.titulo, '');
  perform public.notificar(public.doc_revisores(v_arq), 'doc_revisao',
    v_titulo,
    case when v_rev is null then 'Registro enviado por ' || v_quem || ' aguarda a sua revisão.'
         else 'Rev. ' || v_rev || ' enviada por ' || v_quem || ' aguarda a sua revisão.' end,
    '#/arquivos/' || a.codigo);
  return jsonb_build_object('status','ok','id',v_id,'rev',v_rev);
end $$;

-- 4e. Revisar: aprovar põe a versão em vigor (a anterior fica
--     substituída); devolver volta para quem enviou, com o parecer.
create or replace function public.doc_revisao_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id    uuid := nullif(p->>'revisao_id','')::uuid;
  v_dec   text := p->>'decisao';
  v_par   text := nullif(trim(p->>'parecer'),'');
  r       doc_revisoes%rowtype;
  a       doc_arquivos%rowtype;
  v_quem  text := public.doc_meu_nome();
begin
  select * into r from doc_revisoes where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if r.estado <> 'pendente' then return jsonb_build_object('status','ja_decidida'); end if;
  if public.portal_registro_atual() is not null and public.portal_registro_atual() = r.enviado_por then
    return jsonb_build_object('status','mesma_pessoa');
  end if;
  if not public.doc_pode_revisar(v_id) then return jsonb_build_object('status','sem_permissao'); end if;
  if v_dec not in ('aprovar','devolver') then return jsonb_build_object('status','invalido','campo','decisao'); end if;
  if v_dec = 'devolver' and v_par is null then return jsonb_build_object('status','invalido','campo','parecer'); end if;
  select * into a from doc_arquivos where id = r.arquivo_id;

  if v_dec = 'aprovar' then
    update doc_revisoes set estado = 'substituida'
     where arquivo_id = r.arquivo_id and estado = 'aprovada';
    update doc_revisoes
       set estado = 'aprovada', revisor = public.portal_registro_atual(), revisor_nome = v_quem,
           revisado_em = now(), parecer = v_par
     where id = v_id;
    update doc_arquivos
       set status = 'ativo', rev_vigente = r.rev, rev_pendente = null,
           template_rev = coalesce(r.template_rev, template_rev),
           alterado_em = now(), alterado_por = public.portal_registro_atual(), alterado_nome = v_quem
     where id = r.arquivo_id;
    perform public.notificar(array[r.enviado_por], 'doc_aprovada',
      a.codigo || case when r.rev is not null then ' Rev. ' || r.rev else '' end || ' aprovada',
      'Revisada por ' || v_quem || coalesce(': ' || v_par, '.'), '#/arquivos/' || a.codigo);
  else
    update doc_revisoes
       set estado = 'devolvida', revisor = public.portal_registro_atual(), revisor_nome = v_quem,
           revisado_em = now(), parecer = v_par
     where id = v_id;
    update doc_arquivos
       set status = case when rev_vigente is not null
                           or exists (select 1 from doc_revisoes where arquivo_id = r.arquivo_id and estado = 'aprovada')
                         then 'ativo' else 'rascunho' end,
           rev_pendente = null,
           alterado_em = now(), alterado_por = public.portal_registro_atual(), alterado_nome = v_quem
     where id = r.arquivo_id;
    perform public.notificar(array[r.enviado_por], 'doc_devolvida',
      a.codigo || case when r.rev is not null then ' Rev. ' || r.rev else '' end || ' voltou para ajuste',
      v_quem || ': ' || v_par, '#/arquivos/' || a.codigo);
  end if;
  return jsonb_build_object('status','ok','decisao',v_dec);
end $$;

-- 4f. Retirar o próprio envio antes da revisão.
create or replace function public.doc_revisao_cancelar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare r doc_revisoes%rowtype;
begin
  select * into r from doc_revisoes where id = nullif(p->>'revisao_id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if r.estado <> 'pendente' then return jsonb_build_object('status','ja_decidida'); end if;
  if not (public.doc_gestor() or public.portal_registro_atual() = r.enviado_por) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  update doc_revisoes set estado = 'cancelada' where id = r.id;
  update doc_arquivos
     set status = case when exists (select 1 from doc_revisoes where arquivo_id = r.arquivo_id and estado = 'aprovada')
                       then 'ativo' else 'rascunho' end,
         rev_pendente = null, alterado_em = now(),
         alterado_por = public.portal_registro_atual(), alterado_nome = public.doc_meu_nome()
   where id = r.arquivo_id;
  return jsonb_build_object('status','ok');
end $$;

-- 4g. Obsoleto: sai de vigor, com o motivo. Reativar é do gestor.
create or replace function public.doc_arquivo_obsoletar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id  uuid := nullif(p->>'arquivo_id','')::uuid;
  v_mot text := nullif(trim(p->>'motivo'),'');
  v_re  boolean := coalesce(nullif(p->>'reativar','')::boolean, false);
  v_emi integer;
begin
  select e.grupo_id into v_emi
    from doc_arquivos a join doc_series s on s.id = a.serie_id join doc_emissores e on e.prefixo = s.prefixo
   where a.id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if v_re then
    if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
    update doc_arquivos
       set status = case when exists (select 1 from doc_revisoes where arquivo_id = v_id and estado = 'aprovada')
                         then 'ativo' else 'rascunho' end,
           obsoleto_em = null, obsoleto_motivo = null,
           alterado_em = now(), alterado_por = public.portal_registro_atual(), alterado_nome = public.doc_meu_nome()
     where id = v_id;
    perform public.doc_evento(v_id, 'reativou', v_mot);
    return jsonb_build_object('status','ok');
  end if;
  if not (public.doc_gestor() or public.esta_no_grupo(v_emi, public.portal_registro_atual())) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;
  if exists (select 1 from doc_revisoes where arquivo_id = v_id and estado = 'pendente') then
    return jsonb_build_object('status','ja_pendente');
  end if;
  update doc_arquivos
     set status = 'obsoleto', obsoleto_em = now(), obsoleto_motivo = v_mot,
         alterado_em = now(), alterado_por = public.portal_registro_atual(), alterado_nome = public.doc_meu_nome()
   where id = v_id;
  perform public.doc_evento(v_id, 'obsoletou', v_mot);
  return jsonb_build_object('status','ok');
end $$;

-- 4h. Pai e filho.
create or replace function public.doc_relacao_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_pai   uuid := nullif(p->>'pai_id','')::uuid;
  v_filho uuid := nullif(p->>'filho_id','')::uuid;
  v_tira  boolean := coalesce(nullif(p->>'remover','')::boolean, false);
  v_cp    text; v_cf text;
begin
  select codigo into v_cp from doc_arquivos where id = v_pai;
  select codigo into v_cf from doc_arquivos where id = v_filho;
  if v_cp is null or v_cf is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if v_pai = v_filho then return jsonb_build_object('status','invalido'); end if;
  if not (public.doc_pode_editar(v_pai) or public.doc_pode_editar(v_filho)) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_tira then
    delete from doc_relacoes where pai_id = v_pai and filho_id = v_filho;
    perform public.doc_evento(v_pai,   'desrelacionou', 'filho ' || v_cf);
    perform public.doc_evento(v_filho, 'desrelacionou', 'pai '   || v_cp);
    return jsonb_build_object('status','ok');
  end if;
  begin
    insert into doc_relacoes (pai_id, filho_id, criado_por)
    values (v_pai, v_filho, public.portal_registro_atual())
    on conflict do nothing;
  exception when check_violation then
    return jsonb_build_object('status','ciclo');
  end;
  perform public.doc_evento(v_pai,   'relacionou', 'filho ' || v_cf);
  perform public.doc_evento(v_filho, 'relacionou', 'pai '   || v_cp);
  return jsonb_build_object('status','ok');
end $$;

-- 4i. Anexar o arquivo de uma revisão que veio da planilha — a
--     aprovação já aconteceu fora do portal; falta só o arquivo.
create or replace function public.doc_revisao_anexar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  r     doc_revisoes%rowtype;
  v_cam text := nullif(p->>'caminho','');
begin
  if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into r from doc_revisoes where id = nullif(p->>'revisao_id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not r.importada or r.caminho is not null then return jsonb_build_object('status','ja_tem_arquivo'); end if;
  if v_cam is null or split_part(v_cam, '/', 1) <> r.arquivo_id::text then
    return jsonb_build_object('status','invalido','campo','caminho');
  end if;
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from storage.objects where bucket_id = 'arquivos' and name = v_cam) then
      return jsonb_build_object('status','arquivo_nao_enviado');
    end if;
  end if;
  update doc_revisoes
     set caminho = v_cam, nome_original = nullif(p->>'nome_original',''),
         mime = nullif(p->>'mime',''), tamanho = nullif(p->>'tamanho','')::bigint
   where id = r.id;
  perform public.doc_evento(r.arquivo_id, 'anexou', coalesce('Rev. ' || r.rev, 'registro'));
  return jsonb_build_object('status','ok');
end $$;

-- 4j. Qual grupo é o PMO, e qual é o pai dos projetos. Só admin.
create or replace function public.grupo_chave_definir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_chave text := p->>'chave';
  v_g     integer := nullif(p->>'grupo_id','')::integer;
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  if v_chave not in ('pmo','projetos') then return jsonb_build_object('status','invalido','campo','chave'); end if;
  if v_g is not null and not exists (select 1 from grupos where id = v_g) then
    return jsonb_build_object('status','nao_encontrado');
  end if;
  if v_g is not null and (select chave from grupos where id = v_g) is not null
     and (select chave from grupos where id = v_g) <> v_chave then
    return jsonb_build_object('status','ocupado','chave',(select chave from grupos where id = v_g));
  end if;
  update grupos set chave = null where chave = v_chave;
  if v_g is not null then update grupos set chave = v_chave where id = v_g; end if;
  return jsonb_build_object('status','ok');
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'doc_serie_salvar(jsonb)','doc_arquivo_criar(jsonb)','doc_arquivo_editar(jsonb)',
    'doc_revisao_enviar(jsonb)','doc_revisao_decidir(jsonb)','doc_revisao_cancelar(jsonb)',
    'doc_arquivo_obsoletar(jsonb)','doc_relacao_salvar(jsonb)','doc_revisao_anexar(jsonb)',
    'grupo_chave_definir(jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 5. O STORAGE
--    Bucket privado "arquivos", uma pasta por arquivo:
--      <arquivo_id>/<uuid do envio>/<nome original>
--    Enviar: para a pasta de um arquivo em que se pode mexer.
--    Baixar: a versão aprovada, quem lê o arquivo; a pendente, quem
--    enviou, quem revisa e o gestor; a devolvida, quem mexe nele.
--    Apagar: só o próprio envio que nunca virou revisão — a limpeza de
--    um envio que falhou no meio. Revisão não se apaga.
-- ------------------------------------------------------------
create or replace function public.doc_pode_enviar_objeto(p_nome text)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare v_id uuid;
begin
  begin v_id := split_part(p_nome, '/', 1)::uuid;
  exception when others then return false; end;
  return public.doc_pode_editar(v_id)
     and not exists (select 1 from doc_arquivos where id = v_id and status = 'obsoleto');
end $$;

create or replace function public.doc_pode_baixar_objeto(p_nome text)
returns boolean language plpgsql stable security definer
set search_path = public as $$
declare
  r     record;
  v_reg integer := public.portal_registro_atual();
begin
  select rv.estado, rv.arquivo_id, rv.enviado_por, s.grupo_revisor
    into r
    from doc_revisoes rv
    join doc_arquivos a on a.id = rv.arquivo_id
    join doc_series s on s.id = a.serie_id
   where rv.caminho = p_nome;
  if not found then return false; end if;
  if r.estado in ('aprovada','substituida') then return public.doc_pode_ler(r.arquivo_id); end if;
  if public.doc_gestor() or (v_reg is not null and v_reg = r.enviado_por) then return true; end if;
  if r.estado = 'pendente' then
    return public.esta_no_grupo(r.grupo_revisor, v_reg);
  end if;
  return public.doc_pode_editar(r.arquivo_id);
end $$;
revoke execute on function public.doc_pode_enviar_objeto(text) from public, anon;
revoke execute on function public.doc_pode_baixar_objeto(text) from public, anon;
grant  execute on function public.doc_pode_enviar_objeto(text) to authenticated;
grant  execute on function public.doc_pode_baixar_objeto(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sem o schema storage: o bucket e as políticas de arquivo ficam para quando houver.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('arquivos', 'arquivos', false, 52428800)
  on conflict (id) do update set public = false;

  execute 'drop policy if exists doc_obj_insert on storage.objects';
  execute $p$create policy doc_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'arquivos' and public.doc_pode_enviar_objeto(name))$p$;
  execute 'drop policy if exists doc_obj_select on storage.objects';
  execute $p$create policy doc_obj_select on storage.objects for select to authenticated
    using (bucket_id = 'arquivos' and public.doc_pode_baixar_objeto(name))$p$;
  execute 'drop policy if exists doc_obj_delete on storage.objects';
  execute $p$create policy doc_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'arquivos' and owner = auth.uid()
           and not exists (select 1 from public.doc_revisoes where caminho = name))$p$;
end $$;

-- ============================================================
-- 6. AUDITORIA
--    A trilha do sistema também vê projeto e configuração de série.
--    (Revisões e eventos já são, eles mesmos, a trilha do arquivo.)
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_projetos on public.projetos';
    execute 'create trigger tg_aud_projetos after insert or update or delete on public.projetos
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_doc_series on public.doc_series';
    execute 'create trigger tg_aud_doc_series after insert or update or delete on public.doc_series
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

-- ============================================================
-- 7. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v20_projetos_arquivos', 'Projetos (grupo, supervisor, logo) e controle de arquivos: séries NRO-XXX-YYY, PN, revisões com aprovação pelo grupo revisor, templates, relações pai/filho, padrão de projeto, bucket privado "arquivos"')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 20.0
--
-- Depois de rodar:
--   1) confira o grupo pai dos projetos:
--        select id, nome, prefixo from public.grupos where chave = 'projetos';
--   2) em Arquivos › Configurações, escolha o grupo do PMO e o grupo
--      revisor de cada série;
--   3) a 21.0 traz a planilha NRO-PUB-001 como rol inicial.
-- ============================================================
