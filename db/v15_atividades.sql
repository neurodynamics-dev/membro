-- ============================================================
-- SOMA 15.0 — MIGRAÇÃO · NeuroDynamics
-- ATIVIDADES: o quadro de trabalho de cada grupo, com atribuição,
-- comentários, prazo, sinalização, histórico e notificações.
--
-- E três acertos na agenda, que vêm junto porque mexem no mesmo
-- lugar:
--   a) MARCOS deixam de ser "só back-end": até aqui um marco do
--      semestre só podia ser criado no SOMA · Gestão e não podia
--      ser editado em lugar nenhum. Ganha criar/editar/remover;
--   b) AUSÊNCIAS ganham edição (antes só dava criar e apagar);
--   c) as duas passam a valer as mesmas regras de quem pode o quê.
--
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. PRÉ-REQUISITOS
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.membros') is null then
    raise exception using message = 'Este banco não parece ser o do SOMA.',
      detail = 'A tabela public.membros não existe.';
  end if;
  if to_regprocedure('public.portal_registro_atual()') is null then
    raise exception using message = 'Falta aplicar o soma_v10_portal.sql antes desta migração.',
      detail = 'A 15.0 usa portal_registro_atual(), criada pela 10.0.';
  end if;
end $$;

-- ============================================================
-- 1. GRUPOS
--    Até aqui um grupo era texto solto dentro de membros.grupos:
--    dava para escrever "Órtese", "ortese" e "Ortese " e ficar com
--    três. O quadro precisa de um grupo com identidade — nem que
--    seja só para dar o prefixo do código das atividades.
--
--    membros.grupos continua sendo a fonte de QUEM está no grupo.
--    Esta tabela responde QUAIS grupos existem e como se chamam.
-- ------------------------------------------------------------
create table if not exists public.grupos (
  id        serial primary key,
  nome      text not null unique,
  prefixo   text not null unique,
  cor       text,
  ativo     boolean not null default true,
  ordem     integer not null default 0,
  criado_em timestamptz not null default now()
);

comment on table public.grupos is
  'Os grupos da equipe. Quem está em cada um continua em membros.grupos; '
  'aqui ficam nome canônico, prefixo do código das atividades e cor.';
comment on column public.grupos.prefixo is
  'Prefixo do código das atividades (ORT-14). Gerado do nome na primeira '
  'carga; pode ser editado, desde que continue único.';

-- Prefixo a partir do nome: sem acento, só letras, três primeiras.
create or replace function public.grupo_prefixo(p_nome text)
returns text language sql immutable as $$
  select upper(substring(
    regexp_replace(
      translate(p_nome,
        'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
        'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'),
      '[^A-Za-z]', '', 'g'),
    1, 3));
$$;

-- Semeia com os grupos que já existem no quadro, resolvendo
-- colisão de prefixo com sufixo numérico (ORT, ORT2, ORT3…).
do $$
declare
  r        record;
  v_pref   text;
  v_tenta  text;
  v_n      integer;
begin
  for r in
    select distinct trim(g) as nome
      from membros m, unnest(coalesce(m.grupos, '{}')) g
     where trim(g) <> ''
     order by 1
  loop
    if exists (select 1 from grupos where nome = r.nome) then continue; end if;
    v_pref  := nullif(public.grupo_prefixo(r.nome), '');
    if v_pref is null then v_pref := 'GRP'; end if;
    v_tenta := v_pref; v_n := 1;
    while exists (select 1 from grupos where prefixo = v_tenta) loop
      v_n := v_n + 1; v_tenta := v_pref || v_n::text;
    end loop;
    insert into grupos (nome, prefixo) values (r.nome, v_tenta);
  end loop;
end $$;

alter table public.grupos enable row level security;
drop policy if exists grupos_select on public.grupos;
create policy grupos_select on public.grupos
  for select to authenticated using (true);
drop policy if exists grupos_write on public.grupos;
create policy grupos_write on public.grupos
  for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- ============================================================
-- 2. ATIVIDADES
-- ------------------------------------------------------------
create table if not exists public.atividades (
  id                 uuid primary key default gen_random_uuid(),
  codigo             text not null unique,
  grupo_id           integer not null references public.grupos(id),
  seq                integer not null,
  titulo             text not null,
  descricao          text,
  status             text not null default 'a_fazer'
                       check (status in ('backlog','a_fazer','fazendo','revisao','concluida')),
  prioridade         text not null default 'media'
                       check (prioridade in ('baixa','media','alta','urgente')),
  responsavel        integer references public.membros(registro) on delete set null,
  criado_por         integer references public.membros(registro) on delete set null,
  prazo              date,
  estimativa_h       numeric(5,1),
  sinalizada         boolean not null default false,
  sinalizada_motivo  text,
  sinalizada_por     integer references public.membros(registro) on delete set null,
  sinalizada_em      timestamptz,
  ordem              numeric not null default 0,
  arquivada          boolean not null default false,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  concluida_em       timestamptz,
  unique (grupo_id, seq)
);

comment on table public.atividades is
  'O trabalho da equipe, um cartão por atividade. O código (ORT-14) é '
  'estável e público: é por ele que as pessoas se referem à atividade.';
comment on column public.atividades.ordem is
  'Posição dentro da coluna. Numérico de propósito: mover um cartão entre '
  'dois outros é a média dos dois, sem reescrever a coluna inteira.';

create index if not exists atividades_quadro_ix on public.atividades (grupo_id, status, ordem);
create index if not exists atividades_resp_ix   on public.atividades (responsavel) where not arquivada;
create index if not exists atividades_prazo_ix  on public.atividades (prazo) where not arquivada;

-- ------------------------------------------------------------
-- 2b. Comentários
-- ------------------------------------------------------------
create table if not exists public.atividade_comentarios (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  registro     integer references public.membros(registro) on delete set null,
  corpo        text not null,
  mencionados  integer[] not null default '{}',
  criado_em    timestamptz not null default now()
);
create index if not exists atv_coment_ix on public.atividade_comentarios (atividade_id, criado_em);

-- ------------------------------------------------------------
-- 2c. Histórico — toda ação fica registrada
-- ------------------------------------------------------------
create table if not exists public.atividade_log (
  id           bigserial primary key,
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  registro     integer references public.membros(registro) on delete set null,
  tipo         text not null,
  campo        text,
  de           text,
  para         text,
  criado_em    timestamptz not null default now()
);
create index if not exists atv_log_ix on public.atividade_log (atividade_id, criado_em desc);

comment on table public.atividade_log is
  'Quem fez o quê em cada atividade. É o registro das ações da equipe no '
  'trabalho — o equivalente, para atividades, do que a auditoria é para o quadro.';

-- ------------------------------------------------------------
-- 2d. Seguidores — quem é notificado
-- ------------------------------------------------------------
create table if not exists public.atividade_seguidores (
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  registro     integer not null references public.membros(registro) on delete cascade,
  primary key (atividade_id, registro)
);

-- ============================================================
-- 3. NOTIFICAÇÕES
--    Genéricas de propósito: nascem das atividades, mas servem
--    para solicitação respondida, convite de agenda e o que vier.
-- ------------------------------------------------------------
create table if not exists public.notificacoes (
  id         bigserial primary key,
  registro   integer not null references public.membros(registro) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  corpo      text,
  href       text,
  lida       boolean not null default false,
  criado_em  timestamptz not null default now()
);
create index if not exists notif_ix on public.notificacoes (registro, lida, criado_em desc);

alter table public.notificacoes enable row level security;
drop policy if exists notif_select on public.notificacoes;
create policy notif_select on public.notificacoes
  for select to authenticated
  using (registro = public.portal_registro_atual());
drop policy if exists notif_update on public.notificacoes;
create policy notif_update on public.notificacoes
  for update to authenticated
  using (registro = public.portal_registro_atual())
  with check (registro = public.portal_registro_atual());
-- Ninguém escreve notificação pela API: quem cria são as funções abaixo,
-- com security definer. Sem policy de insert, é isso que acontece.

create or replace function public.notificar(
  p_registros integer[], p_tipo text, p_titulo text, p_corpo text, p_href text
) returns void language sql volatile security definer
set search_path = public as $$
  insert into notificacoes (registro, tipo, titulo, corpo, href)
  select distinct r, p_tipo, p_titulo, p_corpo, p_href
    from unnest(coalesce(p_registros,'{}')) r
   where r is not null
     and r <> coalesce(public.portal_registro_atual(), -1);  -- não notifica quem agiu
$$;
revoke execute on function public.notificar(integer[], text, text, text, text) from public, anon, authenticated;

create or replace function public.notificacoes_marcar_lidas(p_ids bigint[] default null)
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_n integer;
begin
  if v_reg is null then return 0; end if;
  update notificacoes set lida = true
   where registro = v_reg and not lida
     and (p_ids is null or id = any(p_ids));
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke execute on function public.notificacoes_marcar_lidas(bigint[]) from public, anon;
grant  execute on function public.notificacoes_marcar_lidas(bigint[]) to authenticated;

-- ============================================================
-- 4. REGRAS DE ACESSO DAS ATIVIDADES
--    Leitura é da equipe inteira — o trabalho é transparente, como
--    a agenda "equipe" já era. Escrita é de quem está no grupo (ou
--    do Depto. de Pessoal).
-- ------------------------------------------------------------
create or replace function public.sou_do_grupo(p_grupo_id integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from membros m
     where m.registro = public.portal_registro_atual()
       and m.grupos @> array[(select nome from grupos where id = p_grupo_id)]
  ) or public.papel_atual() in ('admin','pessoal');
$$;

alter table public.atividades           enable row level security;
alter table public.atividade_comentarios enable row level security;
alter table public.atividade_log        enable row level security;
alter table public.atividade_seguidores enable row level security;

drop policy if exists atv_select on public.atividades;
create policy atv_select on public.atividades
  for select to authenticated using (true);
drop policy if exists atv_write on public.atividades;
create policy atv_write on public.atividades
  for all to authenticated
  using (public.sou_do_grupo(grupo_id))
  with check (public.sou_do_grupo(grupo_id));

drop policy if exists atvc_select on public.atividade_comentarios;
create policy atvc_select on public.atividade_comentarios
  for select to authenticated using (true);
drop policy if exists atvl_select on public.atividade_log;
create policy atvl_select on public.atividade_log
  for select to authenticated using (true);
drop policy if exists atvs_select on public.atividade_seguidores;
create policy atvs_select on public.atividade_seguidores
  for select to authenticated using (true);
-- Comentário, log e seguidor só entram pelas funções abaixo.

-- ============================================================
-- 5. AS FUNÇÕES DO QUADRO
-- ------------------------------------------------------------

-- 5a. Criar
create or replace function public.atividade_criar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_gid   integer := nullif(p->>'grupo_id','')::integer;
  v_seq   integer;
  v_cod   text;
  v_id    uuid;
  v_resp  integer := nullif(p->>'responsavel','')::integer;
  v_tit   text := nullif(trim(p->>'titulo'),'');
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_tit is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
  if v_gid is null or not exists (select 1 from grupos where id = v_gid)
    then return jsonb_build_object('status','invalido','campo','grupo'); end if;
  if not public.sou_do_grupo(v_gid) then return jsonb_build_object('status','sem_permissao'); end if;

  -- sequência por grupo: o lock evita dois códigos iguais quando duas
  -- pessoas criam ao mesmo tempo
  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_gid);
  select coalesce(max(seq),0) + 1 into v_seq from atividades where grupo_id = v_gid;
  select prefixo || '-' || v_seq::text into v_cod from grupos where id = v_gid;

  insert into atividades (codigo, grupo_id, seq, titulo, descricao, status, prioridade,
                          responsavel, criado_por, prazo, estimativa_h, ordem)
  values (v_cod, v_gid, v_seq, v_tit,
          nullif(trim(p->>'descricao'),''),
          coalesce(nullif(p->>'status',''), 'a_fazer'),
          coalesce(nullif(p->>'prioridade',''), 'media'),
          v_resp, v_reg,
          nullif(p->>'prazo','')::date,
          nullif(p->>'estimativa_h','')::numeric,
          extract(epoch from now()))
  returning id into v_id;

  insert into atividade_seguidores (atividade_id, registro)
  select v_id, r from unnest(array[v_reg, v_resp]) r where r is not null
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo, para)
  values (v_id, v_reg, 'criou', v_cod);

  if v_resp is not null then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_id, v_reg, 'atribuiu', 'responsavel', (select nome from membros where registro = v_resp));
    perform public.notificar(array[v_resp], 'atividade_atribuida',
      v_cod || ' — ' || v_tit,
      'Você é responsável por esta atividade.',
      '#/atividades/card/' || v_cod);
  end if;

  return jsonb_build_object('status','ok','id',v_id,'codigo',v_cod);
end $$;

-- rótulo do status, usado nas notificações
create or replace function public.atividade_status_rotulo(p text)
returns text language sql immutable as $$
  select case p when 'backlog' then 'Backlog' when 'a_fazer' then 'A fazer'
                when 'fazendo' then 'Em andamento' when 'revisao' then 'Em revisão'
                when 'concluida' then 'Concluída' else p end;
$$;

-- 5b. Editar (inclui mover de coluna e atribuir)
create or replace function public.atividade_editar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_a      public.atividades%rowtype;
  v_novo   public.atividades%rowtype;
  v_segs   integer[];
  v_nome   text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.sou_do_grupo(v_a.grupo_id) then return jsonb_build_object('status','sem_permissao'); end if;

  update atividades a set
    titulo       = coalesce(nullif(trim(p->>'titulo'),''), a.titulo),
    descricao    = case when p ? 'descricao'    then nullif(trim(p->>'descricao'),'')    else a.descricao end,
    status       = coalesce(nullif(p->>'status',''), a.status),
    prioridade   = coalesce(nullif(p->>'prioridade',''), a.prioridade),
    responsavel  = case when p ? 'responsavel'  then nullif(p->>'responsavel','')::integer  else a.responsavel end,
    prazo        = case when p ? 'prazo'        then nullif(p->>'prazo','')::date          else a.prazo end,
    estimativa_h = case when p ? 'estimativa_h' then nullif(p->>'estimativa_h','')::numeric else a.estimativa_h end,
    ordem        = coalesce(nullif(p->>'ordem','')::numeric, a.ordem),
    arquivada    = coalesce(nullif(p->>'arquivada','')::boolean, a.arquivada),
    concluida_em = case when coalesce(nullif(p->>'status',''), a.status) = 'concluida'
                          and a.status <> 'concluida' then now()
                        when coalesce(nullif(p->>'status',''), a.status) <> 'concluida' then null
                        else a.concluida_em end,
    atualizado_em = now()
  where a.id = v_a.id
  returning * into v_novo;

  select coalesce(array_agg(registro),'{}') into v_segs
    from atividade_seguidores where atividade_id = v_a.id;

  -- o que mudou vira histórico e, quando importa, notificação
  if v_novo.status <> v_a.status then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'moveu', 'status', v_a.status, v_novo.status);
    perform public.notificar(v_segs, 'atividade_moveu',
      v_a.codigo || ' — ' || v_novo.titulo,
      'Agora em: ' || public.atividade_status_rotulo(v_novo.status),
      '#/atividades/card/' || v_a.codigo);
  end if;

  if coalesce(v_novo.responsavel,-1) <> coalesce(v_a.responsavel,-1) then
    select nome into v_nome from membros where registro = v_novo.responsavel;
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'atribuiu', 'responsavel',
            (select nome from membros where registro = v_a.responsavel), v_nome);
    if v_novo.responsavel is not null then
      insert into atividade_seguidores (atividade_id, registro)
      values (v_a.id, v_novo.responsavel) on conflict do nothing;
      perform public.notificar(array[v_novo.responsavel], 'atividade_atribuida',
        v_a.codigo || ' — ' || v_novo.titulo,
        'Você é responsável por esta atividade.',
        '#/atividades/card/' || v_a.codigo);
    end if;
  end if;

  if coalesce(v_novo.prazo, '0001-01-01') <> coalesce(v_a.prazo, '0001-01-01') then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'prazo', 'prazo', v_a.prazo::text, v_novo.prazo::text);
    perform public.notificar(v_segs, 'atividade_prazo',
      v_a.codigo || ' — ' || v_novo.titulo,
      case when v_novo.prazo is null then 'Prazo removido.'
           else 'Novo prazo: ' || to_char(v_novo.prazo,'DD/MM/YYYY') end,
      '#/atividades/card/' || v_a.codigo);
  end if;

  if v_novo.prioridade <> v_a.prioridade then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'prioridade', 'prioridade', v_a.prioridade, v_novo.prioridade);
  end if;

  if v_novo.titulo <> v_a.titulo or coalesce(v_novo.descricao,'') <> coalesce(v_a.descricao,'') then
    insert into atividade_log (atividade_id, registro, tipo, campo)
    values (v_a.id, v_reg, 'editou', 'conteudo');
  end if;

  return jsonb_build_object('status','ok','codigo',v_a.codigo);
end $$;

-- 5c. Comentar (com menção, que é como se escala um problema)
create or replace function public.atividade_comentar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_a     public.atividades%rowtype;
  v_corpo text := nullif(trim(p->>'corpo'),'');
  v_menc  integer[];
  v_segs  integer[];
  v_id    uuid;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_corpo is null then return jsonb_build_object('status','invalido','campo','corpo'); end if;
  select * into v_a from atividades where id = nullif(p->>'atividade_id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  select coalesce(array_agg(distinct v::integer),'{}') into v_menc
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'mencionados') = 'array' then p->'mencionados' else '[]'::jsonb end) t(v)
   where v ~ '^\d+$';

  insert into atividade_comentarios (atividade_id, registro, corpo, mencionados)
  values (v_a.id, v_reg, v_corpo, v_menc) returning id into v_id;

  insert into atividade_seguidores (atividade_id, registro)
  select v_a.id, r from unnest(v_menc || array[v_reg]) r where r is not null
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo) values (v_a.id, v_reg, 'comentou');

  select coalesce(array_agg(registro),'{}') into v_segs
    from atividade_seguidores where atividade_id = v_a.id;

  -- mencionado recebe um aviso mais forte do que quem só segue
  if array_length(v_menc,1) > 0 then
    perform public.notificar(v_menc, 'atividade_mencao',
      v_a.codigo || ' — ' || v_a.titulo,
      'Você foi mencionado em um comentário.',
      '#/atividades/card/' || v_a.codigo);
  end if;
  perform public.notificar(
    array(select unnest(v_segs) except select unnest(coalesce(v_menc,'{}'))),
    'atividade_comentario', v_a.codigo || ' — ' || v_a.titulo,
    'Novo comentário.', '#/atividades/card/' || v_a.codigo);

  return jsonb_build_object('status','ok','id',v_id);
end $$;

-- 5d. Sinalizar — "esta atividade precisa de atenção"
create or replace function public.atividade_sinalizar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_a    public.atividades%rowtype;
  v_on   boolean := coalesce(nullif(p->>'sinalizada','')::boolean, true);
  v_mot  text := nullif(trim(p->>'motivo'),'');
  v_alvo integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  update atividades set sinalizada = v_on,
         sinalizada_motivo = case when v_on then v_mot else null end,
         sinalizada_por = case when v_on then v_reg else null end,
         sinalizada_em = case when v_on then now() else null end,
         atualizado_em = now()
   where id = v_a.id;

  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_a.id, v_reg, case when v_on then 'sinalizou' else 'dessinalizou' end, 'sinalizada', v_mot);

  if v_on then
    -- sinalizar escala: avisa os seguidores e o gestor de quem responde
    select coalesce(array_agg(registro),'{}') into v_alvo
      from atividade_seguidores where atividade_id = v_a.id;
    v_alvo := v_alvo || array(
      select m.gestor_registro from membros m
       where m.registro = v_a.responsavel and m.gestor_registro is not null);
    perform public.notificar(v_alvo, 'atividade_sinalizada',
      v_a.codigo || ' — ' || v_a.titulo,
      coalesce(v_mot, 'Sinalizada como precisando de atenção.'),
      '#/atividades/card/' || v_a.codigo);
  end if;

  return jsonb_build_object('status','ok');
end $$;

-- 5e. Seguir / deixar de seguir
create or replace function public.atividade_seguir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual();
        v_id  uuid := nullif(p->>'id','')::uuid;
        v_on  boolean := coalesce(nullif(p->>'seguir','')::boolean, true);
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_on then
    insert into atividade_seguidores (atividade_id, registro) values (v_id, v_reg) on conflict do nothing;
  else
    delete from atividade_seguidores where atividade_id = v_id and registro = v_reg;
  end if;
  return jsonb_build_object('status','ok');
end $$;

do $$
declare f text;
begin
  foreach f in array array['atividade_criar','atividade_editar','atividade_comentar',
                           'atividade_sinalizar','atividade_seguir'] loop
    execute format('revoke execute on function public.%I(jsonb) from public, anon', f);
    execute format('grant execute on function public.%I(jsonb) to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 6. LEITURAS PRONTAS
-- ------------------------------------------------------------

-- 6a. O quadro, com o que a tela precisa junto
create or replace view public.atividades_quadro as
select a.*,
       g.nome    as grupo,
       g.prefixo as grupo_prefixo,
       g.cor     as grupo_cor,
       mr.nome   as responsavel_nome,
       mc.nome   as criado_por_nome,
       (select count(*) from atividade_comentarios c where c.atividade_id = a.id) as comentarios,
       (a.prazo is not null and a.prazo < current_date and a.status <> 'concluida') as atrasada
  from atividades a
  join grupos  g  on g.id = a.grupo_id
  left join membros mr on mr.registro = a.responsavel
  left join membros mc on mc.registro = a.criado_por;

comment on view public.atividades_quadro is
  'O que a tela do quadro precisa, já resolvido: nome do grupo, do responsável '
  'e de quem criou, contagem de comentários e o cálculo de atrasada.';

-- 6b. Carga por membro — quantas atividades abertas cada um carrega
create or replace view public.atividades_carga as
select m.registro, m.nome, m.grupos,
       count(*) filter (where a.status <> 'concluida')                      as abertas,
       count(*) filter (where a.status = 'fazendo')                         as fazendo,
       count(*) filter (where a.prazo < current_date and a.status <> 'concluida') as atrasadas,
       count(*) filter (where a.sinalizada)                                 as sinalizadas,
       coalesce(sum(a.estimativa_h) filter (where a.status <> 'concluida'), 0) as horas_abertas
  from membros m
  left join atividades a on a.responsavel = m.registro and not a.arquivada
 where m.status in ('Ativo','Em pausa / avaliação')
 group by m.registro, m.nome, m.grupos;

-- ============================================================
-- 7. AGENDA: marcos e ausências deixam de ser "só back-end"
-- ------------------------------------------------------------

-- 7a. Marco do calendário (calendario_itens)
--     Antes: só o SOMA · Gestão criava, e ninguém editava.
create or replace function public.agenda_marco_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_gestor boolean := public.papel_atual() in ('admin','pessoal');
  v_id     uuid := nullif(p->>'id','')::uuid;
  v_tit    text := nullif(trim(p->>'titulo'),'');
  v_ini    date := nullif(p->>'data_inicio','')::date;
  v_fim    date := nullif(p->>'data_fim','')::date;
  v_pess   boolean := coalesce(nullif(p->>'pessoal','')::boolean, false);
  v_dono   integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_tit is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
  if v_ini is null then return jsonb_build_object('status','invalido','campo','data_inicio'); end if;
  if v_fim is not null and v_fim < v_ini then
    return jsonb_build_object('status','invalido','campo','data_fim'); end if;

  if v_id is null then
    -- Criando: marco da equipe é do Depto. de Pessoal; marco pessoal é de cada um.
    -- Editando, quem manda é o dono da linha (confira logo abaixo) — a regra de
    -- criação não vale de novo, senão ninguém conseguiria editar o próprio marco.
    v_dono := case when v_pess then v_reg else null end;
    if not v_pess and not v_gestor then return jsonb_build_object('status','sem_permissao'); end if;
    insert into calendario_itens (titulo, tipo, data_inicio, data_fim, observacao, registro)
    values (v_tit, coalesce(nullif(p->>'tipo',''),'outro'), v_ini, coalesce(v_fim, v_ini),
            nullif(trim(p->>'observacao'),''), v_dono)
    returning id into v_id;
  else
    if not exists (select 1 from calendario_itens where id = v_id
                    and (v_gestor or registro = v_reg)) then
      return jsonb_build_object('status','sem_permissao');
    end if;
    update calendario_itens set
      titulo = v_tit,
      tipo = coalesce(nullif(p->>'tipo',''), tipo),
      data_inicio = v_ini,
      data_fim = coalesce(v_fim, v_ini),
      observacao = case when p ? 'observacao' then nullif(trim(p->>'observacao'),'') else observacao end
     where id = v_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id);
end $$;

create or replace function public.agenda_marco_remover(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_gestor boolean := public.papel_atual() in ('admin','pessoal');
begin
  delete from calendario_itens
   where id = nullif(p->>'id','')::uuid
     and (v_gestor or registro = v_reg);
  if not found then return jsonb_build_object('status','sem_permissao'); end if;
  return jsonb_build_object('status','ok');
end $$;

-- 7b. Ausência — passa a ter edição, não só criar e apagar
create or replace function public.agenda_ausencia_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_gestor boolean := public.papel_atual() in ('admin','pessoal');
  v_id     uuid := nullif(p->>'id','')::uuid;
  v_alvo   integer := coalesce(nullif(p->>'registro','')::integer, v_reg);
  v_ini    timestamptz := nullif(p->>'inicio','')::timestamptz;
  v_fim    timestamptz := nullif(p->>'fim','')::timestamptz;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_alvo <> v_reg and not v_gestor then return jsonb_build_object('status','sem_permissao'); end if;
  if v_ini is null or v_fim is null or v_fim <= v_ini then
    return jsonb_build_object('status','invalido','campo','periodo'); end if;

  if v_id is null then
    insert into agenda_ausencias (registro, tipo, inicio, fim, dia_inteiro, observacao)
    values (v_alvo, coalesce(nullif(p->>'tipo',''),'ausente'), v_ini, v_fim,
            coalesce(nullif(p->>'dia_inteiro','')::boolean, false),
            nullif(trim(p->>'observacao'),''))
    returning id into v_id;
  else
    if not exists (select 1 from agenda_ausencias where id = v_id
                    and (v_gestor or registro = v_reg)) then
      return jsonb_build_object('status','sem_permissao');
    end if;
    update agenda_ausencias set
      tipo = coalesce(nullif(p->>'tipo',''), tipo),
      inicio = v_ini, fim = v_fim,
      dia_inteiro = coalesce(nullif(p->>'dia_inteiro','')::boolean, dia_inteiro),
      observacao = case when p ? 'observacao' then nullif(trim(p->>'observacao'),'') else observacao end
     where id = v_id;
  end if;
  return jsonb_build_object('status','ok','id',v_id);
end $$;

do $$
declare f text;
begin
  foreach f in array array['agenda_marco_salvar','agenda_marco_remover','agenda_ausencia_salvar'] loop
    execute format('revoke execute on function public.%I(jsonb) from public, anon', f);
    execute format('grant execute on function public.%I(jsonb) to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 8. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v15_atividades', 'Atividades (quadro por grupo), grupos, notificações e edição de marcos e ausências')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 15.0
--
-- Confira os grupos que foram semeados e ajuste os prefixos se
-- algum ficou ruim (eles aparecem no código de toda atividade):
--
--   select id, nome, prefixo from public.grupos order by nome;
--   update public.grupos set prefixo = 'ORT' where nome = 'Órtese';
--
-- Mudar o prefixo NÃO renomeia as atividades já criadas — o código
-- delas é gravado na criação, de propósito: um código que muda não
-- serve para ser citado. Ajuste antes de a equipe começar a usar.
-- ============================================================
