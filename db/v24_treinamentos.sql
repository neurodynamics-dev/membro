-- ============================================================
-- SOMA 24.0 — MIGRAÇÃO · NeuroDynamics
-- TREINAMENTOS: a plataforma de formação da equipe.
--
--   TREINAMENTO  tem título, código e revisão, como todo documento
--                da NRO: NRO-TRE-003 Rev. B. O código é do
--                treinamento; a revisão fica fora dele — a Rev. A e a
--                Rev. F são o mesmo treinamento, e é esse endereço
--                (#/treinamentos/NRO-TRE-003) que os links apontam.
--
--   REVISÃO      o conteúdo: os MÓDULOS, cada um com o corpo em
--                Markdown (texto, vídeos do YouTube, links) e uma
--                VERIFICAÇÃO DE CONHECIMENTO opcional — questões de
--                uma correta, de várias corretas ou de verdadeiro e
--                falso. Uma revisão por vez é rascunho; publicar dá a
--                letra seguinte. Publicar pode pedir que todos
--                REFAÇAM: aí quem concluiu a anterior volta a dever o
--                treinamento. Sem isso, quem concluiu continua em dia.
--
--   ATRIBUIÇÃO   a grupos (ou à equipe inteira), obrigatório ou
--                opcional. Pela pertença efetiva: atribuir a
--                NRO_PROJECTS atribui a quem está em cada projeto.
--
--   PROGRESSO    por pessoa e por revisão: os módulos concluídos e o
--                resultado de cada verificação. O gabarito NUNCA
--                desce para quem faz o treinamento: o conteúdo sai
--                por treinamento_conteudo(), sem as respostas, e quem
--                corrige é treinamento_responder(), aqui no banco.
--
--   CONCLUSÃO    quando o último módulo fecha, o banco registra a
--                conclusão no perfil do membro, com um código de
--                certificado (CERT-XXXX-XXXX) e uma fotografia do que
--                foi concluído — nome, título, revisão, carga
--                horária, nota. Apagar ou revisar o treinamento
--                depois não muda o certificado.
--
--   CONFIGURAÇÃO quem gere os treinamentos (além de admin e do Depto.
--                de Pessoal), a nota mínima padrão, quem assina o
--                certificado e o README de conteúdo — o guia que vai
--                junto do pedido aos agentes de IA que escrevem os
--                treinamentos. Sem README gravado, vale o padrão que
--                mora no código do portal (mod-treinamentos.js), ao
--                lado do leitor do formato que ele descreve.
--
-- Pré-requisitos: SOMA 19.0 (grupos em árvore) e 15.0 (avisos).
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.grupos_de(integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'A atribuição a grupos usa grupos_de(), da 19.0: atribuir a um grupo atribui a quem está nos grupos abaixo dele.';
  end if;
  if to_regprocedure('public.notificar(integer[],text,text,text,text)') is null then
    raise exception using message = 'Falta aplicar a v15 antes desta migração.',
      detail = 'O aviso de treinamento obrigatório sai pelo sino (notificar), que nasce na 15.0.';
  end if;
end $$;

-- O nome de quem age. (Igual a studio_meu_nome, da 23.0 — repetido
-- aqui para os treinamentos não dependerem do Studio.)
create or replace function public.treinamento_meu_nome()
returns text language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select nome from membros where registro = public.portal_registro_atual()),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
    'Portal');
$$;

-- ------------------------------------------------------------
-- As letras da revisão: A, B, … Z, AA, AB… A ordem é a do número,
-- não a do alfabeto — "AA" vem depois de "Z".
-- ------------------------------------------------------------
create or replace function public.treinamento_rev_ord(r text)
returns integer language sql immutable as $$
  select case when r is null or r !~ '^[A-Z]+$' then 0 else
    (select sum((ascii(substr(r, i, 1)) - 64) * power(26, length(r) - i))::integer
       from generate_series(1, length(r)) i) end;
$$;
create or replace function public.treinamento_rev_letra(n integer)
returns text language plpgsql immutable as $$
declare s text := ''; k integer := n;
begin
  if k is null or k < 1 then return null; end if;
  while k > 0 loop
    k := k - 1;
    s := chr(65 + (k % 26)) || s;
    k := k / 26;
  end loop;
  return s;
end $$;

-- ============================================================
-- 1. CONFIGURAÇÃO — uma linha só
-- ------------------------------------------------------------
create table if not exists public.treinamento_config (
  id                    boolean primary key default true check (id),
  grupos_gestores       integer[] not null default '{}',
  nota_minima           integer   not null default 70 check (nota_minima between 0 and 100),
  readme                text,                -- vazio = o padrão do portal
  readme_atualizado_em  timestamptz,
  readme_atualizado_por text,
  assinatura_nome       text,                -- quem assina o certificado
  assinatura_cargo      text,
  atualizado_em         timestamptz not null default now(),
  atualizado_por        text
);
insert into public.treinamento_config (id) values (true) on conflict (id) do nothing;

comment on table public.treinamento_config is
  'Uma linha. Gerem os treinamentos admin, o Depto. de Pessoal e quem está num dos grupos gestores. '
  'readme vazio = o README padrão, que mora em mod-treinamentos.js.';

-- Gerir é de admin, do papel pessoal e dos grupos gestores (pela
-- pertença efetiva, como sempre: quem está num subgrupo gere).
create or replace function public.treinamento_gestor()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() in ('admin','pessoal')
      or coalesce((select public.grupos_de(public.portal_registro_atual()) && c.grupos_gestores
                     from treinamento_config c), false);
$$;
revoke execute on function public.treinamento_gestor() from public, anon;
grant  execute on function public.treinamento_gestor() to authenticated;

alter table public.treinamento_config enable row level security;
-- Toda a equipe lê: o menu precisa saber, no login, se a pessoa gere.
drop policy if exists tre_config_select on public.treinamento_config;
create policy tre_config_select on public.treinamento_config
  for select to authenticated using (true);
drop policy if exists tre_config_update on public.treinamento_config;
create policy tre_config_update on public.treinamento_config
  for update to authenticated
  using (public.treinamento_gestor()) with check (public.treinamento_gestor());
grant select, update on public.treinamento_config to authenticated;

-- Quem gere escolhe a nota, o README e a assinatura; quem ENTRA na
-- gestão, só admin e o Depto. de Pessoal decidem — senão um grupo
-- gestor se estenderia sozinho.
create or replace function public.treinamento_config_carimbo()
returns trigger language plpgsql
set search_path = public as $$
begin
  if new.grupos_gestores is distinct from old.grupos_gestores
     and public.papel_atual() not in ('admin','pessoal') then
    raise exception using errcode = 'P0001', message = 'tre_so_admin',
      detail = 'Só admin e o Depto. de Pessoal escolhem os grupos que gerem os treinamentos.';
  end if;
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := public.treinamento_meu_nome();
  if new.readme is distinct from old.readme then
    new.readme := nullif(new.readme, '');
    new.readme_atualizado_em := now();
    new.readme_atualizado_por := public.treinamento_meu_nome();
  end if;
  return new;
end $$;
drop trigger if exists tg_tre_config_carimbo on public.treinamento_config;
create trigger tg_tre_config_carimbo before update on public.treinamento_config
  for each row execute function public.treinamento_config_carimbo();

-- ============================================================
-- 2. TREINAMENTOS E REVISÕES
-- ------------------------------------------------------------
create table if not exists public.treinamentos (
  id                uuid primary key default gen_random_uuid(),
  numero            integer not null check (numero between 1 and 999999),
  codigo            text generated always as ('NRO-TRE-' || lpad(numero::text, 3, '0')) stored,
  titulo            text not null check (length(trim(titulo)) > 0),
  resumo            text,
  categoria         text,
  carga_horaria_min integer check (carga_horaria_min is null or carga_horaria_min between 1 and 60000),
  nota_minima       integer check (nota_minima is null or nota_minima between 0 and 100),
  validade_meses    integer check (validade_meses is null or validade_meses between 1 and 120),
  status            text not null default 'rascunho' check (status in ('rascunho','publicado','arquivado')),
  revisao_atual     text,     -- a publicada; vazia enquanto nunca foi publicado
  revisao_minima    text,     -- a mais antiga que ainda deixa alguém em dia
  responsavel       integer references public.membros(registro) on delete set null,
  criado_por        integer references public.membros(registro) on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);
create unique index if not exists treinamentos_numero on public.treinamentos (numero);
create unique index if not exists treinamentos_codigo on public.treinamentos (codigo);

create table if not exists public.treinamento_revisoes (
  id              uuid primary key default gen_random_uuid(),
  treinamento_id  uuid not null references public.treinamentos(id) on delete cascade,
  revisao         text,                       -- vazia no rascunho; a letra, ao publicar
  status          text not null default 'rascunho' check (status in ('rascunho','publicada','substituida')),
  conteudo        jsonb not null default '{"modulos":[]}'::jsonb,
  notas           text,                       -- o que mudou
  exige_refazer   boolean not null default false,
  criado_por      integer references public.membros(registro) on delete set null,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  publicado_por   integer references public.membros(registro) on delete set null,
  publicado_nome  text,
  publicado_em    timestamptz,
  check (status = 'rascunho' or revisao is not null)
);
create unique index if not exists tre_rev_um_rascunho on public.treinamento_revisoes (treinamento_id)
  where status = 'rascunho';
create unique index if not exists tre_rev_letra on public.treinamento_revisoes (treinamento_id, revisao)
  where revisao is not null;

comment on column public.treinamento_revisoes.conteudo is
  '{"modulos":[{"id","titulo","corpo" (Markdown),"links":[{"titulo","url","descricao"}],'
  '"verificacao":{"questoes":[{"id","tipo" (unica|multipla|vf),"enunciado","explicacao",'
  '"opcoes":[{"id","texto","correta"}]}]}}]}. No V ou F, "correta" diz se a afirmação é verdadeira.';

-- Os problemas que impedem publicar. O rascunho grava com eles (é
-- trabalho em andamento); publicar, não. A tela confere o mesmo, mas
-- quem decide é aqui.
create or replace function public.treinamento_problemas(c jsonb)
returns text[] language plpgsql immutable as $$
declare
  out  text[] := '{}';
  m    jsonb; q jsonb; o jsonb;
  i    integer := 0; j integer; n integer;
  mids text[] := '{}'; qids text[]; oids text[];
  rx   text := '^[A-Za-z0-9_-]{1,64}$';     -- os ids viram atributo na tela: nada além disto
  pre  text; tipo text; nc integer;
begin
  if c is null or jsonb_typeof(c->'modulos') is distinct from 'array'
     or jsonb_array_length(c->'modulos') = 0 then
    return array['O treinamento não tem nenhum módulo.'];
  end if;
  for m in select x from jsonb_array_elements(c->'modulos') x loop
    i := i + 1;
    pre := 'Módulo ' || i;
    if nullif(trim(coalesce(m->>'id', '')), '') is null then
      out := out || (pre || ': sem identificador.');
    elsif m->>'id' !~ rx then
      out := out || (pre || ': identificador com caracteres que não valem (só letras, números, - e _).');
    elsif m->>'id' = any(mids) then
      out := out || (pre || ': identificador repetido (' || (m->>'id') || ').');
    else mids := mids || (m->>'id');
    end if;
    if nullif(trim(coalesce(m->>'titulo', '')), '') is null then
      out := out || (pre || ': sem título.');
    end if;
    if nullif(trim(coalesce(m->>'corpo', '')), '') is null then
      out := out || (pre || ': o corpo está vazio.');
    end if;
    if jsonb_typeof(m->'verificacao'->'questoes') = 'array' then
      j := 0; qids := '{}';
      for q in select x from jsonb_array_elements(m->'verificacao'->'questoes') x loop
        j := j + 1;
        pre := 'Módulo ' || i || ' · questão ' || j;
        tipo := q->>'tipo';
        if nullif(trim(coalesce(q->>'id', '')), '') is null then out := out || (pre || ': sem identificador.');
        elsif q->>'id' !~ rx then out := out || (pre || ': identificador com caracteres que não valem.');
        elsif q->>'id' = any(qids) then out := out || (pre || ': identificador repetido.');
        else qids := qids || (q->>'id'); end if;
        if nullif(trim(coalesce(q->>'enunciado', '')), '') is null then
          out := out || (pre || ': sem enunciado.');
        end if;
        if tipo is null or tipo not in ('unica','multipla','vf') then
          out := out || (pre || ': o tipo precisa ser única, múltipla ou V ou F.');
          continue;
        end if;
        n := coalesce(jsonb_array_length(case when jsonb_typeof(q->'opcoes') = 'array' then q->'opcoes' end), 0);
        oids := '{}';
        for o in select x from jsonb_array_elements(case when jsonb_typeof(q->'opcoes') = 'array' then q->'opcoes' else '[]' end) x loop
          if nullif(trim(coalesce(o->>'texto', '')), '') is null then
            out := out || (pre || ': há uma alternativa sem texto.');
          end if;
          if nullif(trim(coalesce(o->>'id', '')), '') is null or o->>'id' !~ rx or o->>'id' = any(oids) then
            out := out || (pre || ': alternativa sem identificador, ou repetido.');
          else oids := oids || (o->>'id'); end if;
        end loop;
        select count(*) into nc
          from jsonb_array_elements(case when jsonb_typeof(q->'opcoes') = 'array' then q->'opcoes' else '[]' end) x
         where coalesce((x->>'correta')::boolean, false);
        if tipo = 'vf' then
          if n = 0 then out := out || (pre || ': V ou F sem nenhuma afirmação.'); end if;
        else
          if n < 2 then out := out || (pre || ': precisa de pelo menos duas alternativas.'); end if;
          if tipo = 'unica' and nc <> 1 then
            out := out || (pre || ': uma correta só — há ' || nc || ' marcadas.');
          elsif tipo = 'multipla' and nc = 0 then
            out := out || (pre || ': nenhuma alternativa marcada como correta.');
          end if;
        end if;
      end loop;
    end if;
  end loop;
  return out;
end $$;

-- O que desce para quem faz o treinamento: o conteúdo sem o
-- gabarito (sem "correta" e sem a explicação, que entrega a resposta).
create or replace function public.treinamento_sem_gabarito(c jsonb)
returns jsonb language sql immutable as $$
  select jsonb_build_object('modulos', coalesce((
    select jsonb_agg(
      (m - 'verificacao') || jsonb_build_object('verificacao',
        case when jsonb_typeof(m->'verificacao'->'questoes') = 'array'
              and jsonb_array_length(m->'verificacao'->'questoes') > 0
        then jsonb_build_object('questoes', (
          select jsonb_agg(
            (q - 'explicacao' - 'opcoes') || jsonb_build_object('opcoes', coalesce((
              select jsonb_agg(o - 'correta' order by ko)
                from jsonb_array_elements(case when jsonb_typeof(q->'opcoes') = 'array' then q->'opcoes' else '[]' end)
                     with ordinality oo(o, ko)), '[]'::jsonb))
            order by kq)
            from jsonb_array_elements(m->'verificacao'->'questoes') with ordinality qq(q, kq)))
        end)
      order by km)
      from jsonb_array_elements(case when jsonb_typeof(c->'modulos') = 'array' then c->'modulos' else '[]' end)
           with ordinality mm(m, km)), '[]'::jsonb));
$$;

create or replace function public.treinamento_tocar()
returns trigger language plpgsql as $$
begin
  new.atualizado_em := now();
  if tg_op = 'UPDATE' then new.criado_em := old.criado_em; end if;
  return new;
end $$;
drop trigger if exists tg_treinamentos_tocar on public.treinamentos;
create trigger tg_treinamentos_tocar before update on public.treinamentos
  for each row execute function public.treinamento_tocar();
drop trigger if exists tg_tre_rev_tocar on public.treinamento_revisoes;
create trigger tg_tre_rev_tocar before update on public.treinamento_revisoes
  for each row execute function public.treinamento_tocar();

-- ============================================================
-- 3. ATRIBUIÇÕES, PROGRESSO, CONCLUSÕES
-- ------------------------------------------------------------
create table if not exists public.treinamento_atribuicoes (
  id              bigserial primary key,
  treinamento_id  uuid not null references public.treinamentos(id) on delete cascade,
  grupo_id        integer references public.grupos(id) on delete cascade,   -- vazio = a equipe inteira
  obrigatorio     boolean not null default true,
  criado_por      integer references public.membros(registro) on delete set null,
  criado_em       timestamptz not null default now()
);
create unique index if not exists tre_atr_grupo on public.treinamento_atribuicoes (treinamento_id, grupo_id)
  where grupo_id is not null;
create unique index if not exists tre_atr_todos on public.treinamento_atribuicoes (treinamento_id)
  where grupo_id is null;

create table if not exists public.treinamento_progresso (
  registro            integer not null references public.membros(registro) on delete cascade,
  treinamento_id      uuid not null references public.treinamentos(id) on delete cascade,
  revisao             text not null,
  modulos_concluidos  text[] not null default '{}',
  respostas           jsonb not null default '{}'::jsonb,   -- {modulo:{tentativas,ultima_nota,melhor_nota,aprovado,em}}
  ciclo_desde         timestamptz not null default now(),  -- recomeçar abre um ciclo novo
  iniciado_em         timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  primary key (registro, treinamento_id, revisao)
);

create table if not exists public.treinamento_conclusoes (
  id                  uuid primary key default gen_random_uuid(),
  certificado         text not null unique,                 -- CERT-XXXX-XXXX
  registro            integer not null references public.membros(registro) on delete cascade,
  treinamento_id      uuid references public.treinamentos(id) on delete set null,
  -- a fotografia do que foi concluído: o certificado não muda depois
  nome                text not null,
  codigo              text not null,
  titulo              text not null,
  revisao             text not null,
  carga_horaria_min   integer,
  nota                integer,
  modulos             text[] not null default '{}',
  concluido_em        timestamptz not null default now()
);
create index if not exists tre_concl_pessoa on public.treinamento_conclusoes (registro, concluido_em desc);
create index if not exists tre_concl_trein on public.treinamento_conclusoes (treinamento_id, registro);

-- Para quem este treinamento é obrigatório? true, false (opcional)
-- ou null (não foi atribuído). Obrigatório por um grupo ganha de
-- opcional por outro.
create or replace function public.treinamento_obrigatorio_para(p_tid uuid, p_reg integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select bool_or(a.obrigatorio)
    from treinamento_atribuicoes a
   where a.treinamento_id = p_tid
     and (a.grupo_id is null or a.grupo_id = any(public.grupos_de(p_reg)));
$$;

-- Os módulos que, numa revisão nova, a pessoa não precisa refazer:
-- os que ela já tinha concluído e que não mudaram NADA (mesmo texto,
-- mesmas questões). Vale só quando a revisão em que ela estava ainda
-- conta — se a nova pede que todos refaçam, nada passa.
create or replace function public.treinamento_herdados(p_tid uuid, p_reg integer)
returns text[] language sql stable security definer
set search_path = public as $$
  with t as (select * from treinamentos where id = p_tid),
  atual as (select r.conteudo from treinamento_revisoes r, t
             where r.treinamento_id = p_tid and r.revisao = t.revisao_atual),
  antes as (
    select p.modulos_concluidos, r.conteudo
      from treinamento_progresso p
      join treinamento_revisoes r on r.treinamento_id = p.treinamento_id and r.revisao = p.revisao, t
     where p.treinamento_id = p_tid and p.registro = p_reg
       and p.revisao <> t.revisao_atual
       and public.treinamento_rev_ord(p.revisao) >= public.treinamento_rev_ord(t.revisao_minima)
     order by public.treinamento_rev_ord(p.revisao) desc limit 1)
  select coalesce(array_agg(n->>'id'), '{}')
    from atual, antes,
         jsonb_array_elements(atual.conteudo->'modulos') n,
         jsonb_array_elements(antes.conteudo->'modulos') v
   where n->>'id' = v->>'id' and n = v and (n->>'id') = any(antes.modulos_concluidos);
$$;

-- Os módulos da revisão publicada que a pessoa já concluiu.
create or replace function public.treinamento_feitos(p_tid uuid, p_reg integer)
returns text[] language sql stable security definer
set search_path = public as $$
  select coalesce((
    select array_agg(x) from unnest(coalesce(
      (select p.modulos_concluidos from treinamento_progresso p, treinamentos t
        where t.id = p_tid and p.treinamento_id = p_tid and p.registro = p_reg and p.revisao = t.revisao_atual),
      public.treinamento_herdados(p_tid, p_reg))) x
     where x in (select m->>'id' from treinamentos t
                   join treinamento_revisoes r on r.treinamento_id = t.id and r.revisao = t.revisao_atual,
                        jsonb_array_elements(r.conteudo->'modulos') m
                  where t.id = p_tid)), '{}');
$$;

create or replace function public.treinamento_n_modulos(p_tid uuid)
returns integer language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_array_length(r.conteudo->'modulos'), 0)
    from treinamentos t join treinamento_revisoes r on r.treinamento_id = t.id and r.revisao = t.revisao_atual
   where t.id = p_tid;
$$;

-- A conclusão que ainda vale: da revisão mínima para cima e dentro
-- da validade.
create or replace function public.treinamento_conclusao_valida(p_tid uuid, p_reg integer)
returns public.treinamento_conclusoes language sql stable security definer
set search_path = public as $$
  select c.* from treinamento_conclusoes c join treinamentos t on t.id = c.treinamento_id
   where c.treinamento_id = p_tid and c.registro = p_reg
     and public.treinamento_rev_ord(c.revisao) >= public.treinamento_rev_ord(t.revisao_minima)
     and (t.validade_meses is null or c.concluido_em + make_interval(months => t.validade_meses) > now())
   order by c.concluido_em desc limit 1;
$$;

-- Onde a pessoa está: concluido, andamento, pendente — ou, para quem
-- já tinha concluído e deixou de estar em dia, nova_revisao (a
-- revisão publicada pede que todos refaçam) e vencido (a validade
-- passou). null: o treinamento não está publicado.
create or replace function public.treinamento_situacao(p_tid uuid, p_reg integer)
returns text language plpgsql stable security definer
set search_path = public as $$
declare
  t treinamentos; c treinamento_conclusoes; v_feitos integer; v_total integer;
begin
  select * into t from treinamentos where id = p_tid;
  if t.id is null or t.revisao_atual is null or p_reg is null then return null; end if;
  if (public.treinamento_conclusao_valida(p_tid, p_reg)).id is not null then return 'concluido'; end if;
  v_feitos := cardinality(public.treinamento_feitos(p_tid, p_reg));
  v_total  := public.treinamento_n_modulos(p_tid);
  select * into c from treinamento_conclusoes
   where treinamento_id = p_tid and registro = p_reg order by concluido_em desc limit 1;
  -- no meio do caminho é andamento; com tudo feito e sem conclusão
  -- que valha, é o que sobrou do ciclo anterior
  if v_feitos > 0 and (c.id is null or v_feitos < v_total) then return 'andamento'; end if;
  if c.id is null then return 'pendente'; end if;
  if public.treinamento_rev_ord(c.revisao) < public.treinamento_rev_ord(t.revisao_minima) then return 'nova_revisao'; end if;
  return 'vencido';
end $$;

-- Só as funções daqui as chamam. Abertas, diriam a qualquer conta se
-- outra pessoa concluiu um treinamento — e a conclusão só a pessoa e
-- quem gere leem.
revoke execute on function public.treinamento_obrigatorio_para(uuid, integer) from public, anon, authenticated;
revoke execute on function public.treinamento_herdados(uuid, integer)        from public, anon, authenticated;
revoke execute on function public.treinamento_feitos(uuid, integer)          from public, anon, authenticated;
revoke execute on function public.treinamento_n_modulos(uuid)                from public, anon, authenticated;
revoke execute on function public.treinamento_conclusao_valida(uuid, integer) from public, anon, authenticated;
revoke execute on function public.treinamento_situacao(uuid, integer)        from public, anon, authenticated;
revoke execute on function public.treinamento_meu_nome()                     from public, anon;
grant  execute on function public.treinamento_meu_nome()                     to authenticated;

-- Quem deve o treinamento agora: obrigatório para a pessoa, ela
-- ativa na equipe, e não em dia. É quem recebe o aviso.
create or replace function public.treinamento_devedores(p_tid uuid)
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(m.registro order by m.registro), '{}')
    from membros m
   where coalesce(m.status, 'Ativo') not in ('Desligado','Egresso')
     and public.treinamento_obrigatorio_para(p_tid, m.registro)
     and public.treinamento_situacao(p_tid, m.registro) is distinct from 'concluido';
$$;
revoke execute on function public.treinamento_devedores(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- Leitura. Os treinamentos publicados, toda a equipe vê (o rol de
-- formação é de todos); rascunhos e arquivados, quem gere. O
-- CONTEÚDO (as revisões, com o gabarito) só quem gere lê direto —
-- quem faz o treinamento lê por treinamento_conteudo(). Escrita:
-- só pelas funções.
-- ------------------------------------------------------------
alter table public.treinamentos            enable row level security;
alter table public.treinamento_revisoes    enable row level security;
alter table public.treinamento_atribuicoes enable row level security;
alter table public.treinamento_progresso   enable row level security;
alter table public.treinamento_conclusoes  enable row level security;

drop policy if exists tre_select on public.treinamentos;
create policy tre_select on public.treinamentos
  for select to authenticated using (status = 'publicado' or public.treinamento_gestor());
drop policy if exists tre_rev_select on public.treinamento_revisoes;
create policy tre_rev_select on public.treinamento_revisoes
  for select to authenticated using (public.treinamento_gestor());
drop policy if exists tre_atr_select on public.treinamento_atribuicoes;
create policy tre_atr_select on public.treinamento_atribuicoes
  for select to authenticated using (true);
drop policy if exists tre_prog_select on public.treinamento_progresso;
create policy tre_prog_select on public.treinamento_progresso
  for select to authenticated
  using (registro = public.portal_registro_atual() or public.treinamento_gestor());
drop policy if exists tre_concl_select on public.treinamento_conclusoes;
create policy tre_concl_select on public.treinamento_conclusoes
  for select to authenticated
  using (registro = public.portal_registro_atual() or public.treinamento_gestor());
grant select on public.treinamentos, public.treinamento_revisoes, public.treinamento_atribuicoes,
  public.treinamento_progresso, public.treinamento_conclusoes to authenticated;

-- ============================================================
-- 4. GERIR — criar, editar, publicar, atribuir
-- ------------------------------------------------------------

-- Cria ou altera o que está acima do conteúdo: título, resumo,
-- categoria, carga horária, nota mínima, validade, responsável. Ao
-- criar, o número pode vir escolhido (um treinamento que já tinha
-- código fora do portal); sem ele, é o seguinte.
create or replace function public.treinamento_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_id  uuid := nullif(p->>'id','')::uuid;
  v_num integer;
  t     treinamentos;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  if (v_id is null or p ? 'titulo') and nullif(trim(coalesce(p->>'titulo','')), '') is null then
    return jsonb_build_object('status','invalido','campo','titulo');
  end if;
  if nullif(p->>'carga_horaria_min','') is not null and (p->>'carga_horaria_min')::integer not between 1 and 60000 then
    return jsonb_build_object('status','invalido','campo','carga_horaria_min');
  end if;
  if nullif(p->>'nota_minima','') is not null and (p->>'nota_minima')::integer not between 0 and 100 then
    return jsonb_build_object('status','invalido','campo','nota_minima');
  end if;
  if nullif(p->>'validade_meses','') is not null and (p->>'validade_meses')::integer not between 1 and 120 then
    return jsonb_build_object('status','invalido','campo','validade_meses');
  end if;

  if v_id is null then
    v_num := nullif(p->>'numero','')::integer;
    if v_num is not null and (v_num < 1 or v_num > 999999) then
      return jsonb_build_object('status','invalido','campo','numero');
    end if;
    if v_num is not null and exists (select 1 from treinamentos where numero = v_num) then
      return jsonb_build_object('status','duplicado','campo','numero');
    end if;
    if v_num is null then
      perform pg_advisory_xact_lock(hashtext('treinamentos_numero'));
      select coalesce(max(numero), 0) + 1 into v_num from treinamentos;
    end if;
    insert into treinamentos (numero, titulo, resumo, categoria, carga_horaria_min, nota_minima,
      validade_meses, responsavel, criado_por)
    values (v_num, trim(p->>'titulo'), nullif(trim(coalesce(p->>'resumo','')), ''),
      nullif(trim(coalesce(p->>'categoria','')), ''),
      nullif(p->>'carga_horaria_min','')::integer, nullif(p->>'nota_minima','')::integer,
      nullif(p->>'validade_meses','')::integer,
      coalesce(nullif(p->>'responsavel','')::integer, v_reg), v_reg)
    returning * into t;
    insert into treinamento_revisoes (treinamento_id, conteudo, criado_por)
    values (t.id, case when jsonb_typeof(p->'conteudo'->'modulos') = 'array' then p->'conteudo'
                       else '{"modulos":[]}'::jsonb end, v_reg);
    return jsonb_build_object('status','ok','id',t.id,'codigo',t.codigo);
  end if;

  update treinamentos set
    titulo            = case when p ? 'titulo' then trim(p->>'titulo') else titulo end,
    resumo            = case when p ? 'resumo' then nullif(trim(coalesce(p->>'resumo','')), '') else resumo end,
    categoria         = case when p ? 'categoria' then nullif(trim(coalesce(p->>'categoria','')), '') else categoria end,
    carga_horaria_min = case when p ? 'carga_horaria_min' then nullif(p->>'carga_horaria_min','')::integer else carga_horaria_min end,
    nota_minima       = case when p ? 'nota_minima' then nullif(p->>'nota_minima','')::integer else nota_minima end,
    validade_meses    = case when p ? 'validade_meses' then nullif(p->>'validade_meses','')::integer else validade_meses end,
    responsavel       = case when p ? 'responsavel' then nullif(p->>'responsavel','')::integer else responsavel end
  where id = v_id
  returning * into t;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok','id',t.id,'codigo',t.codigo);
end $$;

-- Grava o conteúdo no rascunho — e abre o rascunho, se ainda não há
-- um (a partir do que está publicado). Grava mesmo com problemas: é
-- trabalho em andamento. Devolve os problemas, que impedem publicar.
create or replace function public.treinamento_rascunho_salvar(p_id uuid, p_conteudo jsonb, p_notas text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  t     treinamentos;
  v_rev treinamento_revisoes;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if p_conteudo is not null and jsonb_typeof(p_conteudo->'modulos') is distinct from 'array' then
    return jsonb_build_object('status','invalido','campo','conteudo');
  end if;
  select * into v_rev from treinamento_revisoes where treinamento_id = p_id and status = 'rascunho' for update;
  if v_rev.id is null then
    insert into treinamento_revisoes (treinamento_id, conteudo, notas, criado_por)
    values (p_id,
      coalesce(p_conteudo,
        (select conteudo from treinamento_revisoes where treinamento_id = p_id and revisao = t.revisao_atual),
        '{"modulos":[]}'::jsonb),
      p_notas, v_reg)
    returning * into v_rev;
  else
    update treinamento_revisoes set
      conteudo = coalesce(p_conteudo, conteudo),
      notas    = case when p_notas is not null then nullif(p_notas, '') else notas end
    where id = v_rev.id returning * into v_rev;
  end if;
  return jsonb_build_object('status','ok','revisao_id',v_rev.id,
    'problemas', to_jsonb(public.treinamento_problemas(v_rev.conteudo)));
end $$;

-- Jogar fora o rascunho de um treinamento que já tem revisão
-- publicada (o que nunca foi publicado se exclui, não se descarta).
create or replace function public.treinamento_rascunho_descartar(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare t treinamentos;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if t.revisao_atual is null then return jsonb_build_object('status','nunca_publicado'); end if;
  delete from treinamento_revisoes where treinamento_id = p_id and status = 'rascunho';
  return jsonb_build_object('status','ok');
end $$;

-- Publicar: o rascunho ganha a letra seguinte e passa a valer; a
-- publicada de antes fica como substituída. A primeira revisão
-- sempre "exige" — é por ela que se começa. Quem deve o treinamento
-- (obrigatório e não em dia) é avisado.
create or replace function public.treinamento_publicar(p_id uuid, p_exige_refazer boolean default false, p_notas text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  t       treinamentos;
  v_rev   treinamento_revisoes;
  v_letra text;
  v_prob  text[];
  v_exige boolean;
  v_dev   integer[];
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id for update;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into v_rev from treinamento_revisoes where treinamento_id = p_id and status = 'rascunho' for update;
  if v_rev.id is null then return jsonb_build_object('status','sem_rascunho'); end if;
  v_prob := public.treinamento_problemas(v_rev.conteudo);
  if cardinality(v_prob) > 0 then
    return jsonb_build_object('status','invalido','problemas',to_jsonb(v_prob));
  end if;

  v_letra := public.treinamento_rev_letra(greatest(
    public.treinamento_rev_ord(t.revisao_atual),
    coalesce((select max(public.treinamento_rev_ord(revisao)) from treinamento_revisoes where treinamento_id = p_id), 0)) + 1);
  v_exige := t.revisao_atual is null or coalesce(p_exige_refazer, false);

  update treinamento_revisoes set status = 'substituida'
   where treinamento_id = p_id and status = 'publicada';
  update treinamento_revisoes set
    status = 'publicada', revisao = v_letra, exige_refazer = v_exige,
    notas = coalesce(nullif(p_notas, ''), notas, case when t.revisao_atual is null then 'Versão inicial.' end),
    publicado_por = v_reg, publicado_nome = public.treinamento_meu_nome(), publicado_em = now()
  where id = v_rev.id;
  update treinamentos set
    revisao_atual  = v_letra,
    revisao_minima = case when v_exige then v_letra else coalesce(revisao_minima, v_letra) end,
    status         = 'publicado'
  where id = p_id returning * into t;

  -- avisa quem deve: na primeira publicação e quando a revisão pede
  -- que todos refaçam (sem isso, quem estava em dia continua)
  if v_exige then
    v_dev := public.treinamento_devedores(p_id);
    perform public.notificar(v_dev, 'treinamento',
      case when v_letra = 'A' then 'Treinamento obrigatório: ' else 'Nova revisão para refazer: ' end
        || t.codigo || ' · ' || t.titulo,
      case when v_letra = 'A'
        then coalesce(t.resumo, 'Um treinamento novo foi atribuído ao seu grupo.')
        else 'A Rev. ' || v_letra || ' mudou o conteúdo e pede que todos refaçam. '
             || coalesce((select notas from treinamento_revisoes where id = v_rev.id), '') end,
      '#/treinamentos/' || t.codigo);
  end if;
  return jsonb_build_object('status','ok','revisao',v_letra,'exige_refazer',v_exige,
                            'avisados', coalesce(cardinality(array_remove(v_dev, v_reg)), 0));
end $$;

-- Atribuir: a lista inteira de uma vez — [{grupo_id (vazio = toda a
-- equipe), obrigatorio}]. Quem passa a dever um treinamento
-- publicado é avisado; quem já devia, não de novo.
create or replace function public.treinamento_atribuir(p_id uuid, p_lista jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  t       treinamentos;
  v_antes integer[];
  v_novos integer[];
  v_it    jsonb;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id for update;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if jsonb_typeof(p_lista) is distinct from 'array' then return jsonb_build_object('status','invalido'); end if;
  for v_it in select * from jsonb_array_elements(p_lista) loop
    if nullif(v_it->>'grupo_id','') is not null
       and not exists (select 1 from grupos where id = (v_it->>'grupo_id')::integer) then
      return jsonb_build_object('status','invalido','campo','grupo_id');
    end if;
  end loop;

  v_antes := case when t.status = 'publicado' then public.treinamento_devedores(p_id) else '{}' end;
  delete from treinamento_atribuicoes where treinamento_id = p_id;
  insert into treinamento_atribuicoes (treinamento_id, grupo_id, obrigatorio, criado_por)
  select distinct on (nullif(x->>'grupo_id','')::integer)
         p_id, nullif(x->>'grupo_id','')::integer, coalesce((x->>'obrigatorio')::boolean, true), v_reg
    from jsonb_array_elements(p_lista) x
   order by nullif(x->>'grupo_id','')::integer, coalesce((x->>'obrigatorio')::boolean, true) desc;

  if t.status = 'publicado' then
    select coalesce(array_agg(r), '{}') into v_novos
      from unnest(public.treinamento_devedores(p_id)) r where not (r = any(v_antes));
    perform public.notificar(v_novos, 'treinamento',
      'Treinamento obrigatório: ' || t.codigo || ' · ' || t.titulo,
      coalesce(t.resumo, 'Um treinamento foi atribuído ao seu grupo.'),
      '#/treinamentos/' || t.codigo);
  end if;
  return jsonb_build_object('status','ok','avisados', coalesce(cardinality(array_remove(v_novos, v_reg)), 0),
    'atribuicoes', (select count(*) from treinamento_atribuicoes where treinamento_id = p_id));
end $$;

-- Arquivar tira o treinamento do catálogo e das pendências; os
-- certificados continuam valendo. Desarquivar o devolve.
create or replace function public.treinamento_arquivar(p_id uuid, p_arquivar boolean default true)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare t treinamentos;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if t.revisao_atual is null then return jsonb_build_object('status','nunca_publicado'); end if;
  update treinamentos set status = case when p_arquivar then 'arquivado' else 'publicado' end where id = p_id;
  return jsonb_build_object('status','ok','situacao', case when p_arquivar then 'arquivado' else 'publicado' end);
end $$;

-- Excluir só o que nunca foi publicado — o resto tem história
-- (conclusões, certificados) e se arquiva.
create or replace function public.treinamento_excluir(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare t treinamentos;
begin
  if not public.treinamento_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if t.revisao_atual is not null then return jsonb_build_object('status','ja_publicado'); end if;
  delete from treinamentos where id = p_id;
  return jsonb_build_object('status','ok','codigo',t.codigo);
end $$;

-- ============================================================
-- 5. FAZER O TREINAMENTO
-- ------------------------------------------------------------

-- A linha de progresso da revisão publicada — criada na primeira
-- vez, já com os módulos herdados de uma revisão anterior que ainda
-- conta (e com o resultado das verificações deles).
create or replace function public.treinamento_progresso_garantir(p_tid uuid, p_reg integer)
returns public.treinamento_progresso language plpgsql volatile security definer
set search_path = public as $$
declare
  t     treinamentos;
  v     treinamento_progresso;
  v_her text[];
  v_ant jsonb;
begin
  select * into t from treinamentos where id = p_tid;
  select * into v from treinamento_progresso
   where registro = p_reg and treinamento_id = p_tid and revisao = t.revisao_atual for update;
  if v.registro is not null then return v; end if;
  v_her := public.treinamento_herdados(p_tid, p_reg);
  select p.respostas into v_ant from treinamento_progresso p
   where p.registro = p_reg and p.treinamento_id = p_tid and p.revisao <> t.revisao_atual
   order by public.treinamento_rev_ord(p.revisao) desc limit 1;
  insert into treinamento_progresso (registro, treinamento_id, revisao, modulos_concluidos, respostas)
  values (p_reg, p_tid, t.revisao_atual, v_her,
    coalesce((select jsonb_object_agg(k, v_ant->k) from unnest(v_her) k where v_ant ? k), '{}'::jsonb))
  on conflict (registro, treinamento_id, revisao) do nothing;
  select * into v from treinamento_progresso
   where registro = p_reg and treinamento_id = p_tid and revisao = t.revisao_atual;
  return v;
end $$;
revoke execute on function public.treinamento_progresso_garantir(uuid, integer) from public, anon, authenticated;

-- Fecha o treinamento quando todos os módulos da revisão publicada
-- estão concluídos: registra a conclusão (uma por ciclo) e devolve o
-- código do certificado. Recomeçar abre um ciclo novo.
create or replace function public.treinamento_fechar(p_tid uuid, p_reg integer)
returns text language plpgsql volatile security definer
set search_path = public as $$
declare
  t      treinamentos;
  v      treinamento_progresso;
  v_rev  treinamento_revisoes;
  v_cod  text;
  v_nota integer;
  i      integer := 0;
begin
  select * into t from treinamentos where id = p_tid;
  select * into v from treinamento_progresso
   where registro = p_reg and treinamento_id = p_tid and revisao = t.revisao_atual;
  if v.registro is null then return null; end if;
  select * into v_rev from treinamento_revisoes where treinamento_id = p_tid and revisao = t.revisao_atual;
  if exists (select 1 from jsonb_array_elements(v_rev.conteudo->'modulos') m
              where not ((m->>'id') = any(v.modulos_concluidos))) then
    return null;
  end if;
  -- uma conclusão por ciclo: tudo feito de novo sem recomeçar não
  -- vira certificado novo
  if exists (select 1 from treinamento_conclusoes c
              where c.treinamento_id = p_tid and c.registro = p_reg and c.concluido_em >= v.ciclo_desde
                and c.revisao = t.revisao_atual) then
    return (select certificado from treinamento_conclusoes c
             where c.treinamento_id = p_tid and c.registro = p_reg order by concluido_em desc limit 1);
  end if;
  select round(avg((v.respostas->(m->>'id')->>'melhor_nota')::numeric))::integer into v_nota
    from jsonb_array_elements(v_rev.conteudo->'modulos') m
   where jsonb_array_length(coalesce(m->'verificacao'->'questoes', '[]'::jsonb)) > 0;
  loop
    i := i + 1;
    v_cod := 'CERT-' || upper(substr(md5(gen_random_uuid()::text), 1, 4)) || '-'
                     || upper(substr(md5(gen_random_uuid()::text), 1, 4));
    exit when not exists (select 1 from treinamento_conclusoes where certificado = v_cod) or i > 8;
  end loop;
  insert into treinamento_conclusoes (certificado, registro, treinamento_id, nome, codigo, titulo, revisao,
    carga_horaria_min, nota, modulos)
  values (v_cod, p_reg, p_tid, coalesce((select nome from membros where registro = p_reg), 'Registro ' || p_reg),
    t.codigo, t.titulo, t.revisao_atual, t.carga_horaria_min, v_nota,
    coalesce((select array_agg(m->>'titulo' order by k)
                from jsonb_array_elements(v_rev.conteudo->'modulos') with ordinality mm(m, k)), '{}'));
  return v_cod;
end $$;
revoke execute on function public.treinamento_fechar(uuid, integer) from public, anon, authenticated;

-- O treinamento para quem vai fazê-lo: a revisão publicada, sem o
-- gabarito, e onde a pessoa está nele. Arquivado, só para quem gere
-- e para quem já o concluiu (rever o que se fez).
create or replace function public.treinamento_conteudo(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  t      treinamentos;
  v_rev  treinamento_revisoes;
  v_prog treinamento_progresso;
  v_conc treinamento_conclusoes;
begin
  select * into t from treinamentos where codigo = upper(trim(p_codigo));
  if t.id is null or t.revisao_atual is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if t.status = 'arquivado' and not public.treinamento_gestor()
     and not exists (select 1 from treinamento_conclusoes where treinamento_id = t.id and registro = v_reg) then
    return jsonb_build_object('status','nao_encontrado');
  end if;
  select * into v_rev from treinamento_revisoes where treinamento_id = t.id and revisao = t.revisao_atual;
  select * into v_prog from treinamento_progresso
   where treinamento_id = t.id and registro = v_reg and revisao = t.revisao_atual;
  select * into v_conc from treinamento_conclusoes
   where treinamento_id = t.id and registro = v_reg order by concluido_em desc limit 1;
  return jsonb_build_object(
    'status', 'ok',
    'treinamento', jsonb_build_object(
      'id', t.id, 'codigo', t.codigo, 'titulo', t.titulo, 'resumo', t.resumo, 'categoria', t.categoria,
      'carga_horaria_min', t.carga_horaria_min,
      'nota_minima', coalesce(t.nota_minima, (select nota_minima from treinamento_config), 70),
      'validade_meses', t.validade_meses, 'revisao', t.revisao_atual, 'revisao_minima', t.revisao_minima,
      'situacao_treinamento', t.status,
      'responsavel', t.responsavel, 'responsavel_nome', (select nome from membros where registro = t.responsavel),
      'publicado_em', v_rev.publicado_em, 'notas_revisao', v_rev.notas),
    'modulos', public.treinamento_sem_gabarito(v_rev.conteudo)->'modulos',
    'feitos', to_jsonb(public.treinamento_feitos(t.id, v_reg)),
    'respostas', coalesce((select jsonb_object_agg(k, jsonb_build_object(
        'tentativas', v_prog.respostas->k->'tentativas', 'melhor_nota', v_prog.respostas->k->'melhor_nota',
        'aprovado', v_prog.respostas->k->'aprovado'))
      from jsonb_object_keys(coalesce(v_prog.respostas, '{}'::jsonb)) k), '{}'::jsonb),
    'situacao', public.treinamento_situacao(t.id, v_reg),
    'obrigatorio', public.treinamento_obrigatorio_para(t.id, v_reg),
    'conclusao', case when v_conc.id is null then null else jsonb_build_object(
      'certificado', v_conc.certificado, 'revisao', v_conc.revisao, 'nota', v_conc.nota,
      'concluido_em', v_conc.concluido_em,
      'vence_em', case when t.validade_meses is null then null
                       else v_conc.concluido_em + make_interval(months => t.validade_meses) end) end);
end $$;

-- Concluir um módulo sem verificação (ler é o que ele pede).
create or replace function public.treinamento_concluir_modulo(p_id uuid, p_modulo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  t     treinamentos;
  v_mod jsonb;
  v     treinamento_progresso;
  v_cert text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null or t.status <> 'publicado' then return jsonb_build_object('status','nao_encontrado'); end if;
  select m into v_mod from treinamento_revisoes r, jsonb_array_elements(r.conteudo->'modulos') m
   where r.treinamento_id = p_id and r.revisao = t.revisao_atual and m->>'id' = p_modulo;
  if v_mod is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if jsonb_array_length(coalesce(v_mod->'verificacao'->'questoes', '[]'::jsonb)) > 0 then
    return jsonb_build_object('status','tem_verificacao');
  end if;
  v := public.treinamento_progresso_garantir(p_id, v_reg);
  update treinamento_progresso set
    modulos_concluidos = case when p_modulo = any(modulos_concluidos) then modulos_concluidos
                              else modulos_concluidos || p_modulo end,
    atualizado_em = now()
  where registro = v_reg and treinamento_id = p_id and revisao = t.revisao_atual;
  v_cert := public.treinamento_fechar(p_id, v_reg);
  return jsonb_build_object('status','ok','feitos', to_jsonb(public.treinamento_feitos(p_id, v_reg)),
    'total', public.treinamento_n_modulos(p_id), 'certificado', v_cert,
    'situacao', public.treinamento_situacao(p_id, v_reg));
end $$;

-- Corrigir a verificação de um módulo. As respostas:
--   {"q1": ["b"], "q2": ["a","c"], "q3": {"a": true, "b": false}}
-- (uma correta e várias corretas: as alternativas marcadas; V ou F:
-- cada afirmação, true para verdadeira). Uma questão vale um ponto,
-- tudo ou nada: várias corretas é o conjunto exato; V ou F, todas as
-- afirmações certas. Reprovado, a pessoa sabe QUAIS errou, não qual
-- era a certa; aprovado, recebe o gabarito com as explicações.
create or replace function public.treinamento_responder(p_id uuid, p_modulo text, p_respostas jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg     integer := public.portal_registro_atual();
  t         treinamentos;
  v_mod     jsonb;
  q         jsonb;
  v_sel     jsonb;
  v_certa   boolean;
  v_total   integer := 0;
  v_acertos integer := 0;
  v_erradas text[] := '{}';
  v_corr    text[];
  v_marc    text[];
  v_gab     jsonb := '{}'::jsonb;
  v_nota    integer;
  v_min     integer;
  v_aprov   boolean;
  v         treinamento_progresso;
  v_ant     jsonb;
  v_cert    text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null or t.status <> 'publicado' then return jsonb_build_object('status','nao_encontrado'); end if;
  select m into v_mod from treinamento_revisoes r, jsonb_array_elements(r.conteudo->'modulos') m
   where r.treinamento_id = p_id and r.revisao = t.revisao_atual and m->>'id' = p_modulo;
  if v_mod is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if jsonb_array_length(coalesce(v_mod->'verificacao'->'questoes', '[]'::jsonb)) = 0 then
    return jsonb_build_object('status','sem_verificacao');
  end if;
  if jsonb_typeof(p_respostas) is distinct from 'object' then return jsonb_build_object('status','invalido'); end if;

  for q in select x from jsonb_array_elements(v_mod->'verificacao'->'questoes') x loop
    v_total := v_total + 1;
    v_sel := p_respostas->(q->>'id');
    if q->>'tipo' = 'vf' then
      v_certa := jsonb_typeof(v_sel) = 'object' and not exists (
        select 1 from jsonb_array_elements(q->'opcoes') o
         where jsonb_typeof(v_sel->(o->>'id')) is distinct from 'boolean'
            or (v_sel->>(o->>'id'))::boolean <> coalesce((o->>'correta')::boolean, false));
      v_gab := v_gab || jsonb_build_object(q->>'id', jsonb_build_object(
        'vf', (select jsonb_object_agg(o->>'id', coalesce((o->>'correta')::boolean, false))
                 from jsonb_array_elements(q->'opcoes') o),
        'explicacao', q->'explicacao'));
    else
      select coalesce(array_agg(o->>'id' order by o->>'id'), '{}') into v_corr
        from jsonb_array_elements(q->'opcoes') o where coalesce((o->>'correta')::boolean, false);
      select coalesce(array_agg(distinct x order by x), '{}') into v_marc
        from jsonb_array_elements_text(case when jsonb_typeof(v_sel) = 'array' then v_sel else '[]'::jsonb end) x;
      v_certa := cardinality(v_corr) > 0 and v_marc = v_corr;
      v_gab := v_gab || jsonb_build_object(q->>'id', jsonb_build_object(
        'corretas', to_jsonb(v_corr), 'explicacao', q->'explicacao'));
    end if;
    if v_certa then v_acertos := v_acertos + 1; else v_erradas := v_erradas || (q->>'id'); end if;
  end loop;

  v_nota  := round(100.0 * v_acertos / v_total)::integer;
  v_min   := coalesce(t.nota_minima, (select nota_minima from treinamento_config), 70);
  v_aprov := v_nota >= v_min;

  v := public.treinamento_progresso_garantir(p_id, v_reg);
  v_ant := coalesce(v.respostas->p_modulo, '{}'::jsonb);
  update treinamento_progresso set
    respostas = respostas || jsonb_build_object(p_modulo, jsonb_build_object(
      'tentativas',  coalesce((v_ant->>'tentativas')::integer, 0) + 1,
      'ultima_nota', v_nota,
      'melhor_nota', greatest(coalesce((v_ant->>'melhor_nota')::integer, 0), v_nota),
      'aprovado',    coalesce((v_ant->>'aprovado')::boolean, false) or v_aprov,
      'em',          now())),
    modulos_concluidos = case when v_aprov and not (p_modulo = any(modulos_concluidos))
                              then modulos_concluidos || p_modulo else modulos_concluidos end,
    atualizado_em = now()
  where registro = v_reg and treinamento_id = p_id and revisao = t.revisao_atual;
  if v_aprov then v_cert := public.treinamento_fechar(p_id, v_reg); end if;

  return jsonb_build_object('status','ok',
    'nota', v_nota, 'acertos', v_acertos, 'total', v_total, 'nota_minima', v_min, 'aprovado', v_aprov,
    'erradas', to_jsonb(v_erradas),
    'gabarito', case when v_aprov then v_gab end,
    'feitos', to_jsonb(public.treinamento_feitos(p_id, v_reg)),
    'total_modulos', public.treinamento_n_modulos(p_id),
    'certificado', v_cert,
    'situacao', public.treinamento_situacao(p_id, v_reg));
end $$;

-- Recomeçar: zera o progresso da revisão publicada e abre um ciclo
-- novo — é assim que se refaz um treinamento vencido (ou que alguém
-- revisa tudo do zero). As conclusões de antes continuam no perfil.
create or replace function public.treinamento_recomecar(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); t treinamentos;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into t from treinamentos where id = p_id;
  if t.id is null or t.status <> 'publicado' then return jsonb_build_object('status','nao_encontrado'); end if;
  insert into treinamento_progresso (registro, treinamento_id, revisao)
  values (v_reg, p_id, t.revisao_atual)
  on conflict (registro, treinamento_id, revisao) do update
    set modulos_concluidos = '{}', respostas = '{}'::jsonb, ciclo_desde = now(), atualizado_em = now();
  return jsonb_build_object('status','ok','situacao', public.treinamento_situacao(p_id, v_reg));
end $$;

-- ============================================================
-- 6. LISTAS
-- ------------------------------------------------------------

-- Os treinamentos publicados, do ponto de vista de uma pessoa: se
-- é obrigatório para ela, opcional ou não atribuído, onde ela está e
-- o certificado, se houver. A própria pessoa pergunta pelos seus
-- (treinamentos_meus, que a tela "Para você" e o início leem); quem
-- gere pergunta por qualquer um (a aba Treinamentos da ficha).
create or replace function public.treinamentos_de(p_reg integer)
returns table (id uuid, codigo text, titulo text, resumo text, categoria text, carga_horaria_min integer,
  revisao text, n_modulos integer, obrigatorio boolean, situacao text, feitos integer,
  concluido_em timestamptz, certificado text, vence_em timestamptz, publicado_em timestamptz)
language sql stable security definer
set search_path = public as $$
  select t.id, t.codigo, t.titulo, t.resumo, t.categoria, t.carga_horaria_min, t.revisao_atual,
         public.treinamento_n_modulos(t.id),
         public.treinamento_obrigatorio_para(t.id, p_reg),
         public.treinamento_situacao(t.id, p_reg),
         cardinality(public.treinamento_feitos(t.id, p_reg)),
         c.concluido_em, c.certificado,
         case when t.validade_meses is not null and c.concluido_em is not null
              then c.concluido_em + make_interval(months => t.validade_meses) end,
         (select r.publicado_em from treinamento_revisoes r where r.treinamento_id = t.id and r.revisao = t.revisao_atual)
    from treinamentos t
    left join lateral (select x.concluido_em, x.certificado from treinamento_conclusoes x
                        where x.treinamento_id = t.id and x.registro = p_reg
                        order by x.concluido_em desc limit 1) c on true
   where t.status = 'publicado'
     and p_reg is not null
     and (p_reg = public.portal_registro_atual() or public.treinamento_gestor())
   order by t.numero;
$$;

create or replace function public.treinamentos_meus()
returns table (id uuid, codigo text, titulo text, resumo text, categoria text, carga_horaria_min integer,
  revisao text, n_modulos integer, obrigatorio boolean, situacao text, feitos integer,
  concluido_em timestamptz, certificado text, vence_em timestamptz, publicado_em timestamptz)
language sql stable security definer
set search_path = public as $$
  select * from public.treinamentos_de(public.portal_registro_atual());
$$;

-- Quem gere acompanha: cada pessoa ativa a quem o treinamento foi
-- atribuído (ou que o fez sem ter sido), onde ela está, e a última
-- conclusão. security definer, mas conferindo quem pergunta.
create or replace function public.treinamento_acompanhamento(p_id uuid)
returns table (registro integer, nome text, obrigatorio boolean, situacao text, feitos integer,
  total integer, concluido_em timestamptz, revisao text, nota integer, certificado text)
language plpgsql stable security definer
set search_path = public as $$
#variable_conflict use_column
begin
  if not public.treinamento_gestor() then return; end if;
  return query
  select m.registro, m.nome,
         public.treinamento_obrigatorio_para(p_id, m.registro),
         public.treinamento_situacao(p_id, m.registro),
         cardinality(public.treinamento_feitos(p_id, m.registro)),
         public.treinamento_n_modulos(p_id),
         c.concluido_em, c.revisao, c.nota, c.certificado
    from membros m
    left join lateral (select x.concluido_em, x.revisao, x.nota, x.certificado from treinamento_conclusoes x
                        where x.treinamento_id = p_id and x.registro = m.registro
                        order by x.concluido_em desc limit 1) c on true
   where coalesce(m.status, 'Ativo') not in ('Desligado','Egresso')
     and (public.treinamento_obrigatorio_para(p_id, m.registro) is not null
          or c.concluido_em is not null
          or exists (select 1 from treinamento_progresso p where p.treinamento_id = p_id and p.registro = m.registro))
   order by m.nome;
end $$;

-- Conferir um certificado pelo código: o que está impresso nele e
-- se ainda vale. Para quem tem conta — o código não é segredo, mas
-- também não é lista pública de quem fez o quê.
create or replace function public.treinamento_certificado(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare c treinamento_conclusoes; t treinamentos;
begin
  select * into c from treinamento_conclusoes where certificado = upper(trim(p_codigo));
  if c.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into t from treinamentos where id = c.treinamento_id;
  return jsonb_build_object('status','ok',
    'certificado', c.certificado, 'nome', c.nome, 'registro', c.registro, 'codigo', c.codigo,
    'titulo', c.titulo, 'revisao', c.revisao, 'carga_horaria_min', c.carga_horaria_min, 'nota', c.nota,
    'modulos', to_jsonb(c.modulos), 'concluido_em', c.concluido_em,
    'vence_em', case when t.validade_meses is not null then c.concluido_em + make_interval(months => t.validade_meses) end,
    'em_dia', t.id is not null and public.treinamento_rev_ord(c.revisao) >= public.treinamento_rev_ord(t.revisao_minima)
              and (t.validade_meses is null or c.concluido_em + make_interval(months => t.validade_meses) > now()),
    'revisao_atual', t.revisao_atual);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'treinamento_salvar(jsonb)', 'treinamento_rascunho_salvar(uuid,jsonb,text)',
    'treinamento_rascunho_descartar(uuid)', 'treinamento_publicar(uuid,boolean,text)',
    'treinamento_atribuir(uuid,jsonb)', 'treinamento_arquivar(uuid,boolean)', 'treinamento_excluir(uuid)',
    'treinamento_conteudo(text)', 'treinamento_concluir_modulo(uuid,text)',
    'treinamento_responder(uuid,text,jsonb)', 'treinamento_recomecar(uuid)', 'treinamentos_meus()',
    'treinamentos_de(integer)',
    'treinamento_acompanhamento(uuid)', 'treinamento_certificado(text)', 'treinamento_problemas(jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 7. UM CÓDIGO, UM DONO
--    NRO-TRE-003 é um treinamento. Um emissor "TRE" em Arquivos daria
--    à equipe dois NRO-TRE-003 diferentes para citar em voz alta.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.doc_emissores') is null then return; end if;
  if exists (select 1 from public.doc_emissores where prefixo = 'TRE') then
    raise notice 'Já existe um emissor TRE em Arquivos: os códigos NRO-TRE-… dos treinamentos vão colidir com os dele. Renomeie o emissor.';
    return;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'doc_emissores_tre_reservado') then
    alter table public.doc_emissores add constraint doc_emissores_tre_reservado
      check (prefixo <> 'TRE') not valid;
  end if;
end $$;

-- ============================================================
-- 8. AUDITORIA
--    Quem criou e mudou treinamento, quem atribuiu e quem mexeu na
--    configuração (inclusive no README).
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_treinamentos on public.treinamentos';
    execute 'create trigger tg_aud_treinamentos after insert or update or delete on public.treinamentos
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_tre_atribuicoes on public.treinamento_atribuicoes';
    execute 'create trigger tg_aud_tre_atribuicoes after insert or update or delete on public.treinamento_atribuicoes
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_tre_config on public.treinamento_config';
    execute 'create trigger tg_aud_tre_config after update on public.treinamento_config
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

-- ============================================================
-- 9. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v24_treinamentos', 'Treinamentos: código NRO-TRE-XXX com revisão, módulos em Markdown com vídeos e verificação de conhecimento (uma correta, várias, V ou F) corrigida no banco, atribuição a grupos (obrigatório ou opcional), conclusão no perfil com certificado e README de conteúdo para os agentes de IA')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 24.0
--
-- Depois de rodar:
--   1) Treinamentos › Configurações: escolha os grupos que gerem os
--      treinamentos (além de admin e do Depto. de Pessoal), quem
--      assina o certificado e, se quiser, ajuste o README;
--   2) crie o primeiro treinamento (Treinamentos › Gestão › Novo) —
--      ou importe o texto que um agente escreveu seguindo o README;
--   3) atribua a um grupo e publique: quem deve é avisado no sino e
--      por e-mail, conforme a preferência de cada um.
-- ============================================================
