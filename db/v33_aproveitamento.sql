-- ============================================================
-- SOMA 33.0, MIGRAÇÃO, NeuroDynamics
-- O APROVEITAMENTO DE AACC: o pedido, as aprovações e a folha que
-- vai para o Colegiado.
--
-- O membro (ou egresso) pede ao colegiado do curso o aproveitamento
-- da participação na equipe como Atividade Acadêmica Curricular
-- Complementar, nos termos da Resolução nº 02/2019 da Congregação da
-- Escola de Engenharia. O relatório é escrito no template LaTeX do
-- brand (templates/aacc); o SOMA conduz o resto:
--
--   1. A PREPARAÇÃO (aacc_meu, aacc_perfil_salvar, aacc_preparar). A
--      página confere a ficha (os dados do recadastro) e os dados
--      acadêmicos, conta os semestres letivos de participação (a mesma
--      regra da classe LaTeX) e guarda o enquadramento escolhido. O
--      pedido nasce aqui, com número: AAC-7, e o relatório é o
--      NRO-PES-020-7.
--   2. O ENVIO (aacc_enviar). O PDF sobe para o bucket "aproveitamento"
--      e o banco confere os metadados que o template escreve: que é
--      deste template, do pedido, em versão final e sem pendência.
--   3. AS APROVAÇÕES (aacc_decidir). Uma pessoa de cada grupo, na ordem
--      da configuração (o PMO, o Depto. de Pessoal e a Coordenação, na
--      semente), nunca quem pediu e nunca a mesma pessoa em duas
--      etapas da mesma versão. Qualquer uma devolve, com o motivo; o
--      envio seguinte recomeça da primeira etapa.
--   4. O PROFESSOR ORIENTADOR (aacc_professor_ler, _decidir). Na última
--      etapa, quem aprova indica o professor (nome, título, e-mail
--      institucional). Ele recebe um link pessoal por e-mail e decide
--      sem conta no portal: a nota pelo barema (mínima de 60, art. 3º,
--      II) e a aprovação. É a aprovação que vale para a UFMG.
--   5. A FOLHA DE APROVAÇÃO. Aprovado pelo professor, o banco emite o
--      documento (doc_emitidos, tipo "aproveitamento"), com código
--      verificador, conferível em auth.neurodynamics.dev. O PDF final é
--      o relatório com a folha no lugar da segunda folha (a reservada);
--      a tela o monta na hora, a partir do que foi emitido.
--   6. REABRIR (aacc_reabrir). Se o Colegiado apontar algo, o estudante
--      reabre: a folha é revogada e o pedido volta ao envio do PDF.
--
-- Os avisos: os grupos, no sino, quando o pedido chega à etapa deles;
-- o estudante, por e-mail (a fila doc_envios, que o notificar-email
-- entrega qualquer que seja a preferência da pessoa) e no sino.
--
-- Pré-requisitos: a 19.0 (os grupos dentro de grupos), a 20.0 (as
-- séries de arquivo e o Storage) e a 25.0 (os documentos emitidos e a
-- fila doc_envios). Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois:
-- publique de novo a Edge Function notificar-email (os e-mails do
-- aproveitamento) e o portal; em Serviços, Aproveitamento de AACC,
-- Configurações, confira os grupos de cada etapa.
-- ============================================================

do $$
begin
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'A 33.0 pergunta quem está em cada grupo por esta_no_grupo, da 19.0.';
  end if;
  if to_regclass('public.doc_emitidos') is null or to_regclass('public.doc_envios') is null then
    raise exception using message = 'Falta aplicar a v25 antes desta migração.',
      detail = 'A 33.0 emite a folha de aprovação em doc_emitidos e põe os e-mails em doc_envios, da 25.0.';
  end if;
end $$;

-- ============================================================
-- 1. A CONFIGURAÇÃO: uma linha só
--    As etapas (os grupos, na ordem, e o nome de cada uma na folha),
--    a série do relatório, de onde vem o template, o domínio do e-mail
--    do professor, o prazo do link dele e o barema, que é o mesmo do
--    template (nro/avaliacao.tex): mudou lá, muda aqui.
-- ------------------------------------------------------------
create table if not exists public.aacc_config (
  id                   boolean primary key default true check (id),
  grupos               integer[] not null default '{}',
  rotulos              text[]    not null default '{}',
  serie                uuid references public.doc_series(id) on delete set null,
  template_url         text not null default 'https://brand.neurodynamics.dev/assets/template-relatorio-aacc.zip'
                       check (template_url ~ '^https://[^\s]+$'),
  url_portal           text not null default 'https://membro.neurodynamics.dev'
                       check (url_portal ~ '^https://[^\s/]+$'),
  dominio_professor    text not null default 'ufmg.br',
  prazo_professor_dias integer not null default 30 check (prazo_professor_dias between 3 and 120),
  meses_por_semestre   integer not null default 4 check (meses_por_semestre between 1 and 6),
  nota_minima          integer not null default 60 check (nota_minima between 0 and 100),
  barema               jsonb not null default '[
    {"chave":"aderencia","peso":15,"nome":"Aderência à formação","descritor":"As atividades são de engenharia do curso do estudante, e a relação com as disciplinas e com as competências está demonstrada, não apenas afirmada."},
    {"chave":"profundidade","peso":25,"nome":"Profundidade técnica","descritor":"O desenvolvimento mostra método, cálculos, decisões justificadas e domínio das ferramentas, num nível comparável ao de um relatório de iniciação científica."},
    {"chave":"contribuicao","peso":20,"nome":"Contribuição individual","descritor":"Fica claro o que o estudante fez, decidiu e entregou, separado do trabalho da equipe, e os registros e os supervisores confirmam."},
    {"chave":"evidencias","peso":15,"nome":"Evidências e rastreabilidade","descritor":"Cada atividade tem evidências verificáveis (códigos no SOMA, repositórios, arquivos de projeto, documentos emitidos), e as horas são consistentes com elas."},
    {"chave":"resultados","peso":15,"nome":"Resultados e impacto","descritor":"Há resultados concretos, medidos e comparados com o esperado, e o impacto no projeto, na equipe ou na comunidade está demonstrado."},
    {"chave":"comunicacao","peso":10,"nome":"Comunicação","descritor":"O texto é claro, organizado e correto; figuras e tabelas têm legenda e fonte; a linguagem técnica é precisa."}
  ]'::jsonb,
  atualizado_em        timestamptz not null default now(),
  atualizado_por       text
);
insert into public.aacc_config (id) values (true) on conflict (id) do nothing;

comment on table public.aacc_config is
  'Uma linha. As etapas de aprovação do aproveitamento de AACC (os grupos, na ordem), a série do relatório, '
  'o template, o domínio do e-mail do professor orientador, o prazo do link dele e o barema.';

alter table public.aacc_config enable row level security;
drop policy if exists aacc_cfg_select on public.aacc_config;
create policy aacc_cfg_select on public.aacc_config for select to authenticated using (true);
grant select on public.aacc_config to authenticated;

-- A semente das etapas: NRO_PMO, NRO_PESSOAL e NRO_COORD_OFFICE, pelo
-- nome; sem eles, o grupo com a chave pmo e os grupos cujo nome lembra
-- o Pessoal e a Coordenação. Etapa sem grupo fica nula, e a tela de
-- configurações pede que se escolha: o pedido não anda por ela. Rodar
-- de novo só preenche a etapa que ficou nula; a escolhida não muda.
do $$
declare
  v_pmo integer; v_pes integer; v_coo integer;
  c     public.aacc_config;
begin
  select * into c from aacc_config;
  if cardinality(c.grupos) > 0 and array_position(c.grupos, null) is null then return; end if;
  select id into v_pmo from grupos where upper(nome) = 'NRO_PMO' limit 1;
  if v_pmo is null and to_regprocedure('public.grupo_pmo()') is not null then
    execute 'select public.grupo_pmo()' into v_pmo;
  end if;
  select id into v_pes from grupos where upper(nome) = 'NRO_PESSOAL' limit 1;
  if v_pes is null then
    select id into v_pes from grupos where nome ilike '%pessoal%' order by id limit 1;
  end if;
  select id into v_coo from grupos where upper(nome) = 'NRO_COORD_OFFICE' limit 1;
  if v_coo is null then
    select id into v_coo from grupos where nome ilike '%coord%' order by id limit 1;
  end if;
  if cardinality(c.grupos) > 0 then
    -- só as nulas, e só se a configuração ainda tem as três da semente
    if cardinality(c.grupos) <> 3 then return; end if;
    update aacc_config
       set grupos = array[coalesce(grupos[1], case when not v_pmo = any(array_remove(grupos, null)) then v_pmo end),
                          coalesce(grupos[2], case when not v_pes = any(array_remove(grupos, null)) then v_pes end),
                          coalesce(grupos[3], case when not v_coo = any(array_remove(grupos, null)) then v_coo end)];
    return;
  end if;
  update aacc_config
     set grupos  = array[v_pmo, v_pes, v_coo],
         rotulos = array['PMO', 'Departamento de Pessoal', 'Coordenação'];
end $$;

-- A série do relatório: NRO-PES-020, a que o template usa. Se o SN 20
-- do Pessoal já é de outra coisa, a próxima livre (o soma.tex leva o
-- código certo para o template). Os PNs não moram no rol: o PN é o
-- número do pedido.
do $$
declare
  v_serie uuid; v_sn integer; v_cab uuid;
  c_origem constant text := 'Os PNs desta série não são registrados no rol: cada relatório é um pedido '
    'em Serviços, Aproveitamento de AACC, e o PN é o número do pedido (o AAC-7 é o %s-7). O relatório '
    'aprovado recebe a folha de aprovação, com código verificador, conferido em auth.neurodynamics.dev.';
begin
  select serie into v_serie from aacc_config;
  if v_serie is not null then return; end if;
  insert into doc_emissores (prefixo, nome, ordem) values ('PES', 'Departamento de Pessoal', 2)
  on conflict (prefixo) do nothing;
  select id into v_serie from doc_series
   where prefixo = 'PES' and titulo ilike 'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO%' order by sn limit 1;
  if v_serie is null then
    v_sn := case when exists (select 1 from doc_series where prefixo = 'PES' and sn = 20)
                 then (select coalesce(max(sn), 0) + 1 from doc_series where prefixo = 'PES') else 20 end;
    insert into doc_series (prefixo, sn, titulo, tipo, subtipo, classe, multiplo, pn_origem, descricao)
    values ('PES', v_sn, 'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC', 'registro', 'relatorio',
            'controlado', true, format(c_origem, public.doc_codigo('PES', v_sn, null)),
            'Criada pela migração 33.0. O template é o relatório LaTeX do brand (templates/aacc).')
    returning id into v_serie;
    insert into doc_arquivos (serie_id, pn, codigo, autor_nome, alterado_nome)
    values (v_serie, null, public.doc_codigo('PES', v_sn, null), 'SOMA 33.0', 'SOMA 33.0')
    returning id into v_cab;
    insert into doc_eventos (arquivo_id, tipo, detalhe, nome) values (v_cab, 'criou', null, 'SOMA 33.0');
  elsif (select pn_origem from doc_series where id = v_serie) is null then
    update doc_series set pn_origem = format(c_origem, public.doc_codigo(prefixo, sn, null)), atualizado_em = now()
     where id = v_serie;
  end if;
  update aacc_config set serie = v_serie;
end $$;

-- ============================================================
-- 2. AS TABELAS
--    Nada se lê nem se escreve direto: as funções da seção 5 decidem
--    o que cada um vê e faz.
-- ------------------------------------------------------------
create table if not exists public.aacc_pedidos (
  id                 uuid primary key default gen_random_uuid(),
  numero             integer generated always as identity,
  codigo             text generated always as ('AAC-' || numero::text) stored,
  registro           integer not null references public.membros(registro) on delete cascade,
  nome               text not null,
  status             text not null default 'preparacao'
                     check (status in ('preparacao','analise','devolvido','professor','concluido','cancelado')),
  etapa              smallint not null default 0,          -- 0 o estudante; 1.. os grupos; a última + 1, o professor
  versao             integer not null default 0,           -- quantos PDFs já foram enviados
  dados              jsonb not null default '{}'::jsonb,   -- a fotografia: o membro, os semestres, o pedido
  pdf_caminho        text,
  pdf_sha256         text,
  pdf_paginas        integer,
  pdf_bytes          bigint,
  pdf_meta           jsonb,
  folha              integer,                              -- a folha reservada à aprovação (do PDF)
  prof_nome          text,
  prof_titulo        text,
  prof_email         text,
  prof_token_hash    text,
  prof_pdf_url       text,
  prof_expira        timestamptz,
  prof_visto_em      timestamptz,
  prof_indicado_por  integer references public.membros(registro) on delete set null,
  prof_indicado_nome text,
  prof_indicado_em   timestamptz,
  nota               numeric(5,2),
  barema             jsonb,
  parecer_prof       text,
  emitido            text references public.doc_emitidos(codigo) on delete set null,
  motivo             text,
  criado_em          timestamptz not null default now(),
  enviado_em         timestamptz,
  concluido_em       timestamptz,
  atualizado_em      timestamptz not null default now()
);
create unique index if not exists aacc_pedidos_numero on public.aacc_pedidos (numero);
create unique index if not exists aacc_pedidos_um_aberto on public.aacc_pedidos (registro)
  where status in ('preparacao','analise','devolvido','professor');
create unique index if not exists aacc_pedidos_token on public.aacc_pedidos (prof_token_hash)
  where prof_token_hash is not null;
create index if not exists aacc_pedidos_status on public.aacc_pedidos (status, etapa);

comment on table public.aacc_pedidos is
  'Um pedido de aproveitamento de AACC (AAC-7): o enquadramento, o PDF enviado, a etapa da aprovação, o '
  'professor orientador e a folha de aprovação emitida.';

create table if not exists public.aacc_versoes (
  pedido_id   uuid not null references public.aacc_pedidos(id) on delete cascade,
  versao      integer not null,
  caminho     text not null,
  sha256      text not null,
  paginas     integer not null,
  bytes       bigint,
  meta        jsonb not null default '{}'::jsonb,
  enviado_em  timestamptz not null default now(),
  primary key (pedido_id, versao)
);

create table if not exists public.aacc_decisoes (
  id         bigserial primary key,
  pedido_id  uuid not null references public.aacc_pedidos(id) on delete cascade,
  versao     integer not null,
  etapa      smallint not null,
  grupo_id   integer,
  rotulo     text not null,
  registro   integer references public.membros(registro) on delete set null,
  nome       text not null,
  decisao    text not null check (decisao in ('aprovada','devolvida')),
  parecer    text,
  criado_em  timestamptz not null default now()
);
create index if not exists aacc_decisoes_ix on public.aacc_decisoes (pedido_id, versao, etapa);

create table if not exists public.aacc_historico (
  id         bigserial primary key,
  pedido_id  uuid not null references public.aacc_pedidos(id) on delete cascade,
  registro   integer,
  nome       text,
  acao       text not null,
  detalhe    text,
  criado_em  timestamptz not null default now()
);
create index if not exists aacc_hist_ix on public.aacc_historico (pedido_id, criado_em);

alter table public.aacc_pedidos   enable row level security;
alter table public.aacc_versoes   enable row level security;
alter table public.aacc_decisoes  enable row level security;
alter table public.aacc_historico enable row level security;

-- A folha de aprovação é um documento emitido como os outros.
do $$
declare v_nome text;
begin
  select conname into v_nome from pg_constraint
   where conrelid = 'public.doc_emitidos'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tipo%'
   limit 1;
  -- já aceita (por esta ou por uma migração depois dela): não mexe
  if v_nome is not null and exists (select 1 from pg_constraint where conrelid = 'public.doc_emitidos'::regclass
                                       and conname = v_nome and pg_get_constraintdef(oid) like '%aproveitamento%') then
    return;
  end if;
  if v_nome is not null then
    execute format('alter table public.doc_emitidos drop constraint %I', v_nome);
  end if;
  alter table public.doc_emitidos add constraint doc_emitidos_tipo_check
    check (tipo in ('vinculo','participacao','aproveitamento'));
end $$;

-- ============================================================
-- 3. AS REGRAS DE BASE
-- ------------------------------------------------------------
create or replace function public.aacc_cfg()
returns public.aacc_config language sql stable security definer
set search_path = public as $$ select * from aacc_config $$;
revoke execute on function public.aacc_cfg() from public, anon, authenticated;

-- quantas etapas de grupo há, e o grupo e o nome de cada uma
create or replace function public.aacc_n_etapas()
returns integer language sql stable security definer
set search_path = public as $$ select coalesce(cardinality(grupos), 0) from aacc_config $$;
create or replace function public.aacc_grupo(p_etapa integer)
returns integer language sql stable security definer
set search_path = public as $$ select grupos[p_etapa] from aacc_config $$;
create or replace function public.aacc_rotulo(p_etapa integer)
returns text language sql stable security definer
set search_path = public as $$
  select case when p_etapa > coalesce(cardinality(c.grupos), 0) then 'Professor orientador'
              else coalesce(nullif(c.rotulos[p_etapa], ''), (select g.nome from grupos g where g.id = c.grupos[p_etapa]),
                            'Etapa ' || p_etapa) end
    from aacc_config c;
$$;

-- quem decide numa etapa: quem está no grupo dela, e admin
create or replace function public.aacc_decide_etapa(p_etapa integer, p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_registro is not null and (
         coalesce(public.papel_atual(), '') = 'admin'
      or coalesce(public.esta_no_grupo(public.aacc_grupo(p_etapa), p_registro), false));
$$;

-- está em alguma etapa? (quem aprova vê os pedidos enviados)
create or replace function public.aacc_aprovador(p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_registro is not null and exists (
    select 1 from aacc_config c, unnest(c.grupos) g(id)
     where g.id is not null and public.esta_no_grupo(g.id, p_registro));
$$;

-- as pessoas de uma etapa, para o aviso
create or replace function public.aacc_pessoas_etapa(p_etapa integer)
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(distinct m.registro), '{}')
    from membros m
   where m.status in ('Ativo','Em pausa / avaliação','Sob demanda')
     and public.esta_no_grupo(public.aacc_grupo(p_etapa), m.registro);
$$;

-- quem vê um pedido: o dono, o Depto. de Pessoal e admin; quem aprova,
-- depois do primeiro envio
create or replace function public.aacc_pode_ver(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from aacc_pedidos p
     where p.id = p_id
       and (   p.registro = public.portal_registro_atual()
            or coalesce(public.papel_atual(), '') in ('admin','pessoal')
            or (p.versao > 0 and public.aacc_aprovador(public.portal_registro_atual()))));
$$;

create or replace function public.aacc_hist(p_id uuid, p_acao text, p_detalhe text, p_nome text default null)
returns void language sql volatile security definer
set search_path = public as $$
  insert into aacc_historico (pedido_id, registro, nome, acao, detalhe)
  values (p_id, public.portal_registro_atual(), coalesce(p_nome, public.doc_meu_nome()), p_acao, p_detalhe);
$$;

-- o e-mail ao estudante: a fila doc_envios (sai qualquer que seja a
-- preferência dele), e o mesmo aviso no sino, já dado por enviado. O
-- egresso recebe no e-mail pessoal: o da equipe pode não existir mais.
create or replace function public.aacc_avisar_estudante(p public.aacc_pedidos, p_acao text, p_titulo text,
                                                        p_corpo text, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql volatile security definer
set search_path = public as $$
declare
  v_url  text := (select url_portal from aacc_config);
  v_mail text := (select case when m.status in ('Desligado','Egresso')
                              then coalesce(nullif(trim(m.email_pessoal), ''), nullif(trim(m.email_nro), '')) end
                    from membros m where m.registro = p.registro);
begin
  insert into doc_envios (tipo, codigo, registro, para_nome, para_email, assunto, dados)
  values ('aacc_membro', null, p.registro, p.nome, v_mail, p_titulo,
          jsonb_build_object('acao', p_acao, 'pedido', p.codigo, 'corpo', p_corpo,
                             'href', '#/servicos/aproveitamento', 'url', v_url || '/aproveitamento') || coalesce(p_extra, '{}'::jsonb));
  insert into notificacoes (registro, tipo, titulo, corpo, href, email_em)
  select p.registro, 'aacc', p_titulo, p_corpo, '#/servicos/aproveitamento', now()
   where exists (select 1 from membros m where m.registro = p.registro);
end $$;
revoke execute on function public.aacc_avisar_estudante(public.aacc_pedidos, text, text, text, jsonb) from public, anon, authenticated;

-- "AAC-7, de Ana Clara Exemplo"
create or replace function public.aacc_titulo(p public.aacc_pedidos)
returns text language sql immutable as $$ select p.codigo || ' Aproveitamento de AACC de ' || p.nome $$;

-- ============================================================
-- 4. OS DADOS DO MEMBRO E OS SEMESTRES
-- ------------------------------------------------------------
-- O semestre de ingresso ("2021/1", "2021.1", "2021-2", "1/2021",
-- "1º semestre de 2021") como AAAA/S.
create or replace function public.aacc_ingresso(p text)
returns text language sql immutable as $$
  select case when a is not null then a[1] || '/' || a[2]
              when b is not null then b[3] || '/' || b[1] end
    from (select regexp_match(coalesce(p, ''), '^\s*(\d{4})\s*[/.\-]?\s*([12])\s*(º|o|°)?\s*(sem\.?|semestre)?\s*$', 'i') as a,
                 regexp_match(coalesce(p, ''), '^\s*([12])\s*(º|o|°)?\s*(?:sem\.?|semestre)?\s*(?:de|/|\.|-)?\s*(\d{4})\s*$', 'i') as b) q;
$$;

-- Os semestres letivos de participação, pela regra que a classe do
-- template também aplica (nro-aacc.cls, seção 6):
--   - o 1º semestre vai de fevereiro a julho; o 2º, de agosto a janeiro;
--   - conta o semestre com ao menos p_min meses de participação, sem os
--     meses de afastamento;
--   - o semestre anterior ao ingresso no curso não conta (art. 5º).
-- p_afast: [{"inicio":"2023-12-10","fim":"2024-01-20"}, …]
create or replace function public.aacc_semestres(p_ini date, p_fim date, p_ingresso text, p_afast jsonb, p_min integer)
returns jsonb language plpgsql immutable as $$
declare
  mi integer; mf integer; s integer; sf integer; ms integer; m integer; n integer;
  si integer := -1; ing text := public.aacc_ingresso(p_ingresso);
  afs integer[][] := '{}'; a jsonb; ai integer; af integer; k integer; fora boolean;
  r jsonb := '[]'::jsonb; sit text;
begin
  if p_ini is null or p_fim is null or p_fim < p_ini then return r; end if;
  mi := extract(year from p_ini)::integer * 12 + extract(month from p_ini)::integer;
  mf := extract(year from p_fim)::integer * 12 + extract(month from p_fim)::integer;
  if ing is not null then si := split_part(ing, '/', 1)::integer * 2 + split_part(ing, '/', 2)::integer - 1; end if;
  for a in select * from jsonb_array_elements(coalesce(p_afast, '[]'::jsonb)) loop
    begin
      ai := extract(year from (a->>'inicio')::date)::integer * 12 + extract(month from (a->>'inicio')::date)::integer;
      af := extract(year from (a->>'fim')::date)::integer * 12 + extract(month from (a->>'fim')::date)::integer;
      afs := afs || array[[ai, af]];
    exception when others then null;
    end;
  end loop;
  -- o semestre de um mês corrido: ano × 2 + 0 (1º) ou + 1 (2º)
  s  := case when (mi - 1) % 12 + 1 >= 8 then ((mi - 1) / 12) * 2 + 1
             when (mi - 1) % 12 + 1 >= 2 then ((mi - 1) / 12) * 2
             else ((mi - 1) / 12) * 2 - 1 end;
  sf := case when (mf - 1) % 12 + 1 >= 8 then ((mf - 1) / 12) * 2 + 1
             when (mf - 1) % 12 + 1 >= 2 then ((mf - 1) / 12) * 2
             else ((mf - 1) / 12) * 2 - 1 end;
  while s <= sf loop
    ms := (s / 2) * 12 + case when s % 2 = 0 then 2 else 8 end;
    n := 0;
    for m in ms .. ms + 5 loop
      if m >= mi and m <= mf then
        fora := false;
        if array_length(afs, 1) is not null then
          for k in 1 .. array_length(afs, 1) loop
            if m >= afs[k][1] and m <= afs[k][2] then fora := true; end if;
          end loop;
        end if;
        if not fora then n := n + 1; end if;
      end if;
    end loop;
    sit := case when si > -1 and s < si then 'antes' when n < coalesce(p_min, 4) then 'parcial' else 'conta' end;
    r := r || jsonb_build_object('rotulo', (s / 2)::text || '/' || (s % 2 + 1)::text, 'meses', n, 'situacao', sit);
    s := s + 1;
  end loop;
  return r;
end $$;

-- Os campos do recadastro que a página confere, e os acadêmicos. Os
-- obrigatórios travam o download do template; os opcionais só aparecem.
create or replace function public.aacc_campos_obrigatorios()
returns text[] language sql immutable as $$
  select array['email_pessoal','telefone','cpf','data_nascimento','endereco','cidade_origem','instituicao',
               'curso','matricula','periodo_ingresso','genero','autodeclaracao_racial'];
$$;
create or replace function public.aacc_campos_opcionais()
returns text[] language sql immutable as $$
  select array['lattes','github','instagram','acessibilidade','situacao_fump','tempo_deslocamento'];
$$;

-- Tudo o que o SOMA sabe do membro e o template usa. dados_pessoais só
-- admin e Pessoal leem direto; aqui a pessoa lê a própria.
create or replace function public.aacc_dados_membro(p_registro integer)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  m      jsonb;
  dp     jsonb := '{}'::jsonb;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_eg   boolean;
  v_sup  jsonb;
  v_proj text;
  v_af   jsonb := '[]'::jsonb;
  v_tre  jsonb := '[]'::jsonb;
  v_falt text[] := '{}';
  v_opc  text[] := '{}';
  c      text;
  v_val  text;
begin
  select to_jsonb(x) into m from membros x where x.registro = p_registro;
  if m is null then return null; end if;
  begin
    select to_jsonb(d) into dp from dados_pessoais d where d.registro = p_registro;
  exception when undefined_table then dp := null;
  end;
  dp := coalesce(dp, '{}'::jsonb);
  v_eg := coalesce(m->>'status', 'Ativo') in ('Desligado', 'Egresso');
  select jsonb_build_object('nome', g.nome, 'cargo', g.cargo) into v_sup
    from membros g where g.registro = nullif(m->>'gestor_registro', '')::integer;
  begin
    execute 'select string_agg(p.codigo, ''; '' order by p.codigo) from projetos p
              where public.esta_no_grupo(p.grupo_id, $1)' into v_proj using p_registro;
  exception when undefined_table or undefined_column then v_proj := null;
  end;
  begin
    select coalesce(jsonb_agg(jsonb_build_object('inicio', s.dados->>'data_inicio', 'fim', s.dados->>'data_fim',
             'motivo', s.dados->>'motivo', 'protocolo', s.protocolo) order by s.dados->>'data_inicio'), '[]'::jsonb)
      into v_af
      from portal_solicitacoes s
     where s.registro = p_registro and s.tipo = 'afastamento' and s.status in ('aprovada','concluida')
       and (s.dados->>'data_inicio') ~ '^\d{4}-\d{2}-\d{2}' and (s.dados->>'data_fim') ~ '^\d{4}-\d{2}-\d{2}';
  exception when undefined_table or undefined_column then v_af := '[]'::jsonb;
  end;
  begin
    select coalesce(jsonb_agg(t order by t->>'concluido_em', t->>'codigo'), '[]'::jsonb) into v_tre
      from (select distinct on (c.codigo)
                   jsonb_build_object('codigo', c.codigo, 'titulo', c.titulo, 'revisao', c.revisao,
                                      'carga_horaria_min', c.carga_horaria_min,
                                      'concluido_em', (c.concluido_em at time zone 'America/Sao_Paulo')::date,
                                      'certificado', c.certificado) as t
              from treinamento_conclusoes c where c.registro = p_registro
             order by c.codigo, c.concluido_em desc) q;
  exception when undefined_table then v_tre := '[]'::jsonb;
  end;
  foreach c in array public.aacc_campos_obrigatorios() loop
    v_val := nullif(trim(coalesce(case when c in ('email_pessoal','telefone') then m->>c else dp->>c end, '')), '');
    if v_val is null then v_falt := v_falt || c; end if;
  end loop;
  foreach c in array public.aacc_campos_opcionais() loop
    if nullif(trim(coalesce(dp->>c, '')), '') is null then v_opc := v_opc || c; end if;
  end loop;
  return jsonb_build_object(
    'registro', p_registro, 'nome', m->>'nome',
    'email', coalesce(nullif(m->>'email_nro', ''), nullif(m->>'email_pessoal', '')),
    'email_nro', m->>'email_nro', 'email_pessoal', m->>'email_pessoal', 'telefone', m->>'telefone',
    'status', m->>'status', 'situacao', case when v_eg then 'egresso' else 'ativo' end,
    'cargo', nullif(trim(coalesce(m->>'cargo', '')), ''),
    'departamento', nullif(trim(coalesce(m->>'departamento', '')), ''),
    'inicio', nullif(m->>'data_ingresso', '')::date,
    'fim', case when v_eg then nullif(m->>'data_desligamento', '')::date end,
    'ate', case when v_eg then nullif(m->>'data_desligamento', '')::date else v_hoje end,
    'supervisor', v_sup, 'projetos', v_proj,
    'perfil', (select jsonb_object_agg(k, dp->>k) from unnest(public.aacc_campos_obrigatorios() || public.aacc_campos_opcionais()) k
                where k not in ('email_pessoal','telefone')),
    'curso', nullif(trim(coalesce(dp->>'curso', '')), ''),
    'matricula', nullif(trim(coalesce(dp->>'matricula', '')), ''),
    'instituicao', nullif(trim(coalesce(dp->>'instituicao', '')), ''),
    'periodo_ingresso', dp->>'periodo_ingresso',
    'ingresso', public.aacc_ingresso(dp->>'periodo_ingresso'),
    'afastamentos', v_af, 'treinamentos', v_tre,
    'faltam', to_jsonb(v_falt), 'opcionais', to_jsonb(v_opc));
end $$;
revoke execute on function public.aacc_dados_membro(integer) from public, anon, authenticated;

-- O que trava o download: o recadastro incompleto e os dados
-- acadêmicos que contam os semestres.
create or replace function public.aacc_bloqueios(d jsonb)
returns text[] language plpgsql immutable as $$
declare b text[] := '{}';
begin
  if jsonb_array_length(coalesce(d->'faltam', '[]'::jsonb)) > 0 then b := b || 'recadastro'::text; end if;
  if d->>'ingresso' is null then b := b || 'ingresso'::text; end if;
  if d->>'inicio' is null then b := b || 'entrada'::text; end if;
  if d->>'situacao' = 'egresso' and d->>'fim' is null then b := b || 'saida'::text; end if;
  return b;
end $$;

-- ============================================================
-- 5. O PEDIDO
-- ------------------------------------------------------------
create or replace function public.aacc_pedido_json(p public.aacc_pedidos, p_completo boolean)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'id', p.id, 'numero', p.numero, 'codigo', p.codigo, 'registro', p.registro, 'nome', p.nome,
    'status', p.status, 'etapa', p.etapa, 'etapa_rotulo', case when p.etapa > 0 then public.aacc_rotulo(p.etapa) end,
    'n_etapas', public.aacc_n_etapas(), 'versao', p.versao,
    'documento', (select public.doc_codigo(s.prefixo, s.sn, p.numero) from doc_series s where s.id = (select serie from aacc_config)),
    'pedido', p.dados->'pedido', 'semestres', p.dados->'semestres',
    'pdf_paginas', p.pdf_paginas, 'pdf_meta', p.pdf_meta, 'folha', p.folha,
    'motivo', p.motivo, 'emitido', p.emitido, 'nota', p.nota,
    'prof_nome', p.prof_nome, 'prof_titulo', p.prof_titulo,
    'criado_em', p.criado_em, 'enviado_em', p.enviado_em, 'concluido_em', p.concluido_em, 'atualizado_em', p.atualizado_em)
  || case when p_completo then jsonb_build_object(
    'dados', p.dados, 'pdf_caminho', p.pdf_caminho, 'pdf_sha256', p.pdf_sha256, 'pdf_bytes', p.pdf_bytes,
    'prof_email', p.prof_email, 'prof_expira', p.prof_expira, 'prof_visto_em', p.prof_visto_em,
    'prof_indicado_nome', p.prof_indicado_nome, 'prof_indicado_em', p.prof_indicado_em,
    'barema', p.barema, 'parecer_prof', p.parecer_prof) else '{}'::jsonb end;
$$;
revoke execute on function public.aacc_pedido_json(public.aacc_pedidos, boolean) from public, anon, authenticated;

-- A página do estudante: os dados, os semestres, o pedido aberto e os
-- anteriores, a configuração que a tela precisa.
create or replace function public.aacc_meu()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  c     public.aacc_config;
  d     jsonb;
  p     public.aacc_pedidos;
  s     record;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into c from aacc_config;
  d := public.aacc_dados_membro(v_reg);
  if d is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into p from aacc_pedidos where registro = v_reg order by (status in ('preparacao','analise','devolvido','professor')) desc, criado_em desc limit 1;
  select ds.prefixo, ds.sn, e.nome as emissor, a.rev_vigente as rev into s
    from doc_series ds join doc_emissores e on e.prefixo = ds.prefixo
    left join doc_arquivos a on a.serie_id = ds.id and a.pn is null
   where ds.id = c.serie;
  return jsonb_build_object('status','ok', 'membro', d,
    'aprovador', public.aacc_aprovador(v_reg), 'gere', coalesce(public.papel_atual(), '') in ('admin','pessoal'),
    'semestres', public.aacc_semestres((d->>'inicio')::date, (d->>'ate')::date, d->>'ingresso',
                                       d->'afastamentos', c.meses_por_semestre),
    'bloqueios', to_jsonb(public.aacc_bloqueios(d)),
    'pedido', case when p.id is not null then public.aacc_pedido_json(p, true) end,
    'anteriores', coalesce((select jsonb_agg(jsonb_build_object('id', x.id, 'codigo', x.codigo, 'status', x.status,
                    'concluido_em', x.concluido_em, 'emitido', x.emitido) order by x.criado_em desc)
                    from aacc_pedidos x where x.registro = v_reg and x.id is distinct from p.id), '[]'::jsonb),
    'serie', jsonb_build_object('codigo', case when s.prefixo is not null then public.doc_codigo(s.prefixo, s.sn, null) end,
                                'revisao', s.rev, 'emissor', s.emissor),
    'config', jsonb_build_object('template_url', c.template_url, 'meses_por_semestre', c.meses_por_semestre,
                                 'rotulos', to_jsonb(c.rotulos), 'n_etapas', cardinality(c.grupos),
                                 'nota_minima', c.nota_minima, 'dominio_professor', c.dominio_professor,
                                 'horas_por_credito', 15));
end $$;

-- O que a própria pessoa completa da ficha: o recadastro. A entrada e a
-- saída da equipe não: são do Depto. de Pessoal, e é por elas que se
-- contam os semestres.
create or replace function public.aacc_perfil_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  k     text;
  v     text;
  v_ok  text[] := array['cpf','data_nascimento','endereco','cidade_origem','instituicao','curso','matricula',
                        'periodo_ingresso','genero','autodeclaracao_racial','lattes','github','instagram',
                        'acessibilidade','situacao_fump','tempo_deslocamento'];
  v_n   integer := 0;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if jsonb_typeof(p) <> 'object' then return jsonb_build_object('status','invalido'); end if;
  for k, v in select key, nullif(trim(value), '') from jsonb_each_text(p) loop
    if k = 'email_pessoal' then
      if v is not null and lower(v) !~ '^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$' then
        return jsonb_build_object('status','invalido','campo',k);
      end if;
      update membros set email_pessoal = lower(v) where registro = v_reg; v_n := v_n + 1;
    elsif k = 'telefone' then
      if v is not null and regexp_replace(v, '\D', '', 'g') !~ '^\d{10,13}$' then
        return jsonb_build_object('status','invalido','campo',k);
      end if;
      update membros set telefone = v where registro = v_reg; v_n := v_n + 1;
    elsif k = any(v_ok) then
      if k = 'cpf' and v is not null and regexp_replace(v, '\D', '', 'g') !~ '^\d{11}$' then
        return jsonb_build_object('status','invalido','campo',k);
      end if;
      if k = 'data_nascimento' and v is not null then
        begin perform v::date; exception when others then return jsonb_build_object('status','invalido','campo',k); end;
      end if;
      if k = 'periodo_ingresso' and v is not null and public.aacc_ingresso(v) is null then
        return jsonb_build_object('status','invalido','campo',k);
      end if;
      if k = 'periodo_ingresso' then v := public.aacc_ingresso(v); end if;
      if length(coalesce(v, '')) > 400 then return jsonb_build_object('status','invalido','campo',k); end if;
      insert into dados_pessoais (registro) values (v_reg) on conflict (registro) do nothing;
      if k = 'data_nascimento' then
        execute 'update dados_pessoais set data_nascimento = $1::date where registro = $2' using v, v_reg;
      else
        execute format('update dados_pessoais set %I = $1 where registro = $2', k) using v, v_reg;
      end if;
      v_n := v_n + 1;
    else
      return jsonb_build_object('status','invalido','campo',k);
    end if;
  end loop;
  return jsonb_build_object('status','ok','campos',v_n) || jsonb_build_object('membro', public.aacc_dados_membro(v_reg));
end $$;

-- A estratégia: o principal, as alternativas e os semestres do SIEX e
-- da IC. Cria o pedido (com o número, que é o PN do relatório) ou muda
-- o que está em preparação ou devolvido.
create or replace function public.aacc_preparar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  c       public.aacc_config;
  d       jsonb;
  b       text[];
  v_pri   text := upper(trim(coalesce(p->>'principal', '')));
  v_alt   text[] := '{}';
  v_siex  text[] := '{}';
  v_ic    text[] := '{}';
  x       text;
  v_sem   jsonb;
  v_rot   text[];
  ped     public.aacc_pedidos;
  v_dados jsonb;
  c_part  constant text[] := array['EQC','EXT','IC','VPC'];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into c from aacc_config;
  d := public.aacc_dados_membro(v_reg);
  b := public.aacc_bloqueios(d);
  if cardinality(b) > 0 then return jsonb_build_object('status','incompleto','bloqueios',to_jsonb(b)); end if;
  if not v_pri = any(c_part) then return jsonb_build_object('status','invalido','campo','principal'); end if;
  for x in select upper(trim(value)) from jsonb_array_elements_text(coalesce(p->'alternativas', '[]'::jsonb)) loop
    if not x = any(c_part) then return jsonb_build_object('status','invalido','campo','alternativas'); end if;
    if x <> v_pri and not x = any(v_alt) then v_alt := v_alt || x; end if;
  end loop;
  v_sem := public.aacc_semestres((d->>'inicio')::date, (d->>'ate')::date, d->>'ingresso', d->'afastamentos', c.meses_por_semestre);
  select coalesce(array_agg(e->>'rotulo'), '{}') into v_rot from jsonb_array_elements(v_sem) e where e->>'situacao' = 'conta';
  for x in select trim(value) from jsonb_array_elements_text(coalesce(p->'siex', '[]'::jsonb)) loop
    if not x = any(v_rot) then return jsonb_build_object('status','invalido','campo','siex','semestre',x); end if;
    if not x = any(v_siex) then v_siex := v_siex || x; end if;
  end loop;
  for x in select trim(value) from jsonb_array_elements_text(coalesce(p->'ic', '[]'::jsonb)) loop
    if not x = any(v_rot) then return jsonb_build_object('status','invalido','campo','ic','semestre',x); end if;
    if not x = any(v_ic) then v_ic := v_ic || x; end if;
  end loop;
  if (v_pri = 'EXT' or 'EXT' = any(v_alt)) and cardinality(v_siex) = 0 then
    return jsonb_build_object('status','invalido','campo','siex');
  end if;
  if (v_pri = 'IC' or 'IC' = any(v_alt)) and cardinality(v_ic) = 0 then
    return jsonb_build_object('status','invalido','campo','ic');
  end if;
  if length(coalesce(p->>'colegiado', '')) > 200 then return jsonb_build_object('status','invalido','campo','colegiado'); end if;

  v_dados := jsonb_build_object('membro', d, 'semestres', v_sem,
    'pedido', jsonb_build_object('principal', v_pri, 'alternativas', to_jsonb(v_alt),
                                 'siex', to_jsonb(v_siex), 'ic', to_jsonb(v_ic),
                                 'colegiado', nullif(trim(coalesce(p->>'colegiado', '')), '')));

  select * into ped from aacc_pedidos
   where registro = v_reg and status in ('preparacao','analise','devolvido','professor') for update;
  if found then
    if ped.status not in ('preparacao','devolvido') then return jsonb_build_object('status','em_andamento'); end if;
    update aacc_pedidos set dados = v_dados, nome = d->>'nome', atualizado_em = now() where id = ped.id returning * into ped;
    perform public.aacc_hist(ped.id, 'preparou', 'Enquadramento ' || v_pri
      || case when cardinality(v_alt) > 0 then ', alternativas ' || array_to_string(v_alt, ', ') else '' end);
  else
    insert into aacc_pedidos (registro, nome, dados) values (v_reg, d->>'nome', v_dados) returning * into ped;
    perform public.aacc_hist(ped.id, 'criou', 'Enquadramento ' || v_pri
      || case when cardinality(v_alt) > 0 then ', alternativas ' || array_to_string(v_alt, ', ') else '' end);
  end if;
  return jsonb_build_object('status','ok','pedido', public.aacc_pedido_json(ped, true));
end $$;

-- Os metadados que o template escreve no PDF (pdfkeywords): "nro-aacc;
-- documento=NRO-PES-020-7; modo=final; pendencias=0; folha=2; …".
create or replace function public.aacc_ler_meta(p text)
returns jsonb language sql immutable as $$
  select coalesce(jsonb_object_agg(trim(split_part(x, '=', 1)), trim(substr(x, strpos(x, '=') + 1))), '{}'::jsonb)
         || jsonb_build_object('_template', trim(split_part(coalesce(p, ''), ';', 1)) = 'nro-aacc')
    from unnest(string_to_array(coalesce(p, ''), ';')) x
   where strpos(x, '=') > 0;
$$;

-- O ENVIO: o PDF já está no bucket; aqui o banco confere e o pedido
-- entra na primeira etapa.
create or replace function public.aacc_enviar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    uuid := nullif(p->>'id', '')::uuid;
  ped     public.aacc_pedidos;
  v_cam   text := trim(coalesce(p->>'caminho', ''));
  v_sha   text := lower(trim(coalesce(p->>'sha256', '')));
  v_pag   integer;
  v_bytes bigint;
  v_meta  jsonb := public.aacc_ler_meta(p->>'keywords');
  v_doc   text;
  v_folha integer;
  v_para  integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into ped from aacc_pedidos where id = v_id for update;
  if not found or ped.registro <> v_reg then return jsonb_build_object('status','nao_encontrado'); end if;
  if ped.status not in ('preparacao','devolvido') then return jsonb_build_object('status','fora_de_envio'); end if;
  if public.aacc_n_etapas() = 0 or public.aacc_grupo(1) is null then return jsonb_build_object('status','sem_grupo'); end if;
  begin v_pag := (p->>'paginas')::integer; v_bytes := (p->>'bytes')::bigint;
  exception when others then return jsonb_build_object('status','invalido','campo','paginas'); end;
  if v_sha !~ '^[0-9a-f]{64}$' then return jsonb_build_object('status','invalido','campo','sha256'); end if;
  if v_cam !~ ('^' || v_reg || '/' || ped.id || '/[A-Za-z0-9._-]+\.pdf$') then
    return jsonb_build_object('status','invalido','campo','caminho');
  end if;
  if to_regclass('storage.objects') is not null then
    if not exists (select 1 from storage.objects where bucket_id = 'aproveitamento' and name = v_cam) then
      return jsonb_build_object('status','sem_arquivo');
    end if;
  end if;
  -- o que o PDF diz de si
  v_doc := (select public.doc_codigo(s.prefixo, s.sn, ped.numero) from doc_series s where s.id = (select serie from aacc_config));
  if not coalesce((v_meta->>'_template')::boolean, false) then return jsonb_build_object('status','nao_template'); end if;
  if v_meta->>'exemplo' = 'sim' then return jsonb_build_object('status','exemplo'); end if;
  if coalesce(v_meta->>'documento', '') <> coalesce(v_doc, '-') then
    return jsonb_build_object('status','outro_pedido','documento',v_meta->>'documento','esperado',v_doc);
  end if;
  if v_meta->>'modo' is distinct from 'final' then return jsonb_build_object('status','rascunho'); end if;
  if v_meta->>'pendencias' is distinct from '0' then
    return jsonb_build_object('status','pendencias','pendencias',v_meta->>'pendencias');
  end if;
  if coalesce(v_meta->>'principal', '') <> coalesce(ped.dados#>>'{pedido,principal}', '') then
    return jsonb_build_object('status','outro_enquadramento','pdf',v_meta->>'principal','pedido',ped.dados#>>'{pedido,principal}');
  end if;
  begin v_folha := (v_meta->>'folha')::integer; exception when others then v_folha := null; end;
  if v_folha is null or v_folha < 2 or v_pag is null or v_folha > v_pag then
    return jsonb_build_object('status','sem_folha');
  end if;

  update aacc_pedidos
     set status = 'analise', etapa = 1, versao = versao + 1, motivo = null,
         pdf_caminho = v_cam, pdf_sha256 = v_sha, pdf_paginas = v_pag, pdf_bytes = v_bytes, pdf_meta = v_meta - '_template',
         folha = v_folha, enviado_em = now(), atualizado_em = now(),
         prof_token_hash = null, prof_pdf_url = null, prof_expira = null, nota = null, barema = null, parecer_prof = null
   where id = ped.id returning * into ped;
  insert into aacc_versoes (pedido_id, versao, caminho, sha256, paginas, bytes, meta)
  values (ped.id, ped.versao, v_cam, v_sha, v_pag, v_bytes, v_meta - '_template');
  perform public.aacc_hist(ped.id, 'enviou', 'Versão ' || ped.versao || ', ' || v_pag || ' páginas');
  v_para := array_remove(public.aacc_pessoas_etapa(1), ped.registro);
  perform public.notificar(v_para, 'aacc', public.aacc_titulo(ped) || ' aguarda a sua aprovação',
    'Etapa ' || public.aacc_rotulo(1) || ', versão ' || ped.versao || '.', '#/servicos/aproveitamento/' || ped.codigo);
  perform public.aacc_avisar_estudante(ped, 'recebido', ped.codigo || ': o relatório foi recebido',
    'O relatório (versão ' || ped.versao || ') entrou na etapa ' || public.aacc_rotulo(1) || '.');
  return jsonb_build_object('status','ok','situacao','analise','etapa',1,'avisados',coalesce(cardinality(v_para),0));
end $$;

-- AS APROVAÇÕES: aprovar ou devolver, na etapa em que o pedido está.
create or replace function public.aacc_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    uuid := nullif(p->>'id', '')::uuid;
  v_dec   text := p->>'decisao';
  v_par   text := nullif(trim(coalesce(p->>'parecer', '')), '');
  ped     public.aacc_pedidos;
  c       public.aacc_config;
  v_n     integer;
  v_rot   text;
  v_para  integer[];
  v_pnome text := nullif(trim(coalesce(p#>>'{professor,nome}', '')), '');
  v_ptit  text := nullif(trim(coalesce(p#>>'{professor,titulo}', '')), '');
  v_pmail text := lower(nullif(trim(coalesce(p#>>'{professor,email}', '')), ''));
  v_purl  text := nullif(trim(coalesce(p->>'pdf_url', '')), '');
  v_tok   text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_dec not in ('aprovar','devolver') then return jsonb_build_object('status','invalido','campo','decisao'); end if;
  if v_dec = 'devolver' and v_par is null then return jsonb_build_object('status','invalido','campo','parecer'); end if;
  if length(coalesce(v_par, '')) > 1200 then return jsonb_build_object('status','invalido','campo','parecer'); end if;
  select * into c from aacc_config;
  v_n := coalesce(cardinality(c.grupos), 0);
  select * into ped from aacc_pedidos where id = v_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if ped.status <> 'analise' or ped.etapa < 1 or ped.etapa > v_n then return jsonb_build_object('status','fora_de_aprovacao'); end if;
  if c.grupos[ped.etapa] is null then return jsonb_build_object('status','sem_grupo'); end if;
  if not public.aacc_decide_etapa(ped.etapa, v_reg) then return jsonb_build_object('status','sem_permissao'); end if;
  if ped.registro = v_reg then return jsonb_build_object('status','propria'); end if;
  if exists (select 1 from aacc_decisoes where pedido_id = ped.id and versao = ped.versao and registro = v_reg
                and decisao = 'aprovada') then
    return jsonb_build_object('status','ja_aprovou');
  end if;
  v_rot := public.aacc_rotulo(ped.etapa);

  if v_dec = 'devolver' then
    insert into aacc_decisoes (pedido_id, versao, etapa, grupo_id, rotulo, registro, nome, decisao, parecer)
    values (ped.id, ped.versao, ped.etapa, c.grupos[ped.etapa], v_rot, v_reg, public.doc_meu_nome(), 'devolvida', v_par);
    update aacc_pedidos set status = 'devolvido', etapa = 0, motivo = v_par, atualizado_em = now()
     where id = ped.id returning * into ped;
    perform public.aacc_hist(ped.id, 'devolveu', v_rot || ': ' || v_par);
    perform public.aacc_avisar_estudante(ped, 'devolvido', ped.codigo || ': o relatório voltou para ajuste',
      'Devolvido na etapa ' || v_rot || ' por ' || public.doc_meu_nome() || ': ' || v_par,
      jsonb_build_object('etapa', v_rot, 'motivo', v_par));
    return jsonb_build_object('status','ok','situacao','devolvido');
  end if;

  -- a última etapa indica o professor orientador
  if ped.etapa = v_n then
    if v_pnome is null or length(v_pnome) < 5 or length(v_pnome) > 120 then
      return jsonb_build_object('status','invalido','campo','professor_nome');
    end if;
    if v_ptit is null or length(v_ptit) > 40 then return jsonb_build_object('status','invalido','campo','professor_titulo'); end if;
    if v_pmail is null or v_pmail !~ '^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$' then
      return jsonb_build_object('status','invalido','campo','professor_email');
    end if;
    if nullif(c.dominio_professor, '') is not null
       and v_pmail !~ ('@([a-z0-9-]+\.)*' || replace(lower(c.dominio_professor), '.', '\.') || '$') then
      return jsonb_build_object('status','dominio','dominio',c.dominio_professor);
    end if;
    if v_purl is null or strpos(v_purl, '/object/sign/aproveitamento/' || ped.pdf_caminho) = 0 then
      return jsonb_build_object('status','invalido','campo','pdf_url');
    end if;
  end if;

  insert into aacc_decisoes (pedido_id, versao, etapa, grupo_id, rotulo, registro, nome, decisao, parecer)
  values (ped.id, ped.versao, ped.etapa, c.grupos[ped.etapa], v_rot, v_reg, public.doc_meu_nome(), 'aprovada', v_par);
  perform public.aacc_hist(ped.id, 'aprovou', v_rot || coalesce(': ' || v_par, ''));

  if ped.etapa < v_n then
    if c.grupos[ped.etapa + 1] is null then
      raise exception using errcode = 'P0001', message = 'aacc_sem_grupo',
        detail = 'A etapa seguinte não tem grupo: escolha em Serviços, Aproveitamento de AACC, Configurações.';
    end if;
    update aacc_pedidos set etapa = etapa + 1, atualizado_em = now() where id = ped.id returning * into ped;
    v_para := array_remove(public.aacc_pessoas_etapa(ped.etapa), ped.registro);
    perform public.notificar(v_para, 'aacc', public.aacc_titulo(ped) || ' aguarda a sua aprovação',
      'Etapa ' || public.aacc_rotulo(ped.etapa) || ', aprovado em ' || v_rot || '.', '#/servicos/aproveitamento/' || ped.codigo);
    perform public.aacc_avisar_estudante(ped, 'etapa', ped.codigo || ': aprovado na etapa ' || v_rot,
      'Aprovado por ' || public.doc_meu_nome() || '. Segue para a etapa ' || public.aacc_rotulo(ped.etapa) || '.',
      jsonb_build_object('etapa', v_rot, 'proxima', public.aacc_rotulo(ped.etapa)));
    return jsonb_build_object('status','ok','situacao','analise','etapa',ped.etapa);
  end if;

  -- o link pessoal do professor: 64 caracteres sorteados; o banco
  -- guarda só o SHA-256 deles, e o e-mail leva o link
  v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update aacc_pedidos
     set status = 'professor', etapa = v_n + 1, prof_nome = v_pnome, prof_titulo = v_ptit, prof_email = v_pmail,
         prof_token_hash = encode(sha256(convert_to(v_tok, 'UTF8')), 'hex'), prof_pdf_url = v_purl,
         prof_expira = now() + make_interval(days => c.prazo_professor_dias), prof_visto_em = null,
         prof_indicado_por = v_reg, prof_indicado_nome = public.doc_meu_nome(), prof_indicado_em = now(),
         atualizado_em = now()
   where id = ped.id returning * into ped;
  perform public.aacc_hist(ped.id, 'indicou', v_ptit || ' ' || v_pnome || ' (' || v_pmail || ')');
  insert into doc_envios (tipo, codigo, registro, para_nome, para_email, assunto, dados)
  values ('aacc_professor', null, null, v_ptit || ' ' || v_pnome, v_pmail,
          'Relatório de AACC de ' || ped.nome || ' para a sua avaliação',
          jsonb_build_object('pedido', ped.codigo, 'estudante', ped.nome,
            'curso', ped.dados#>>'{membro,curso}', 'principal', ped.dados#>>'{pedido,principal}',
            'creditos', ped.pdf_meta->>'creditos', 'indicado_por', public.doc_meu_nome(),
            'professor', v_ptit || ' ' || v_pnome, 'prazo', (ped.prof_expira at time zone 'America/Sao_Paulo')::date,
            'url', c.url_portal || '/aproveitamento/?p=' || v_tok));
  perform public.aacc_avisar_estudante(ped, 'professor', ped.codigo || ': aprovado pela equipe',
    'Aprovado nas ' || v_n || ' etapas da equipe. O relatório seguiu para o professor orientador, '
      || v_ptit || ' ' || v_pnome || '.', jsonb_build_object('professor', v_ptit || ' ' || v_pnome));
  return jsonb_build_object('status','ok','situacao','professor');
end $$;

-- Trocar o professor ou mandar o link de novo (um link novo; o antigo
-- deixa de valer). Da última etapa e de admin.
create or replace function public.aacc_professor_trocar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  ped     public.aacc_pedidos;
  c       public.aacc_config;
  v_pnome text := nullif(trim(coalesce(p#>>'{professor,nome}', '')), '');
  v_ptit  text := nullif(trim(coalesce(p#>>'{professor,titulo}', '')), '');
  v_pmail text := lower(nullif(trim(coalesce(p#>>'{professor,email}', '')), ''));
  v_purl  text := nullif(trim(coalesce(p->>'pdf_url', '')), '');
  v_tok   text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into c from aacc_config;
  select * into ped from aacc_pedidos where id = nullif(p->>'id', '')::uuid for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if ped.status <> 'professor' then return jsonb_build_object('status','fora_do_professor'); end if;
  if not public.aacc_decide_etapa(cardinality(c.grupos), v_reg) then return jsonb_build_object('status','sem_permissao'); end if;
  if ped.registro = v_reg then return jsonb_build_object('status','propria'); end if;
  v_pnome := coalesce(v_pnome, ped.prof_nome); v_ptit := coalesce(v_ptit, ped.prof_titulo); v_pmail := coalesce(v_pmail, ped.prof_email);
  if length(v_pnome) < 5 then return jsonb_build_object('status','invalido','campo','professor_nome'); end if;
  if v_pmail !~ '^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$' then return jsonb_build_object('status','invalido','campo','professor_email'); end if;
  if nullif(c.dominio_professor, '') is not null
     and v_pmail !~ ('@([a-z0-9-]+\.)*' || replace(lower(c.dominio_professor), '.', '\.') || '$') then
    return jsonb_build_object('status','dominio','dominio',c.dominio_professor);
  end if;
  if v_purl is null or strpos(v_purl, '/object/sign/aproveitamento/' || ped.pdf_caminho) = 0 then
    return jsonb_build_object('status','invalido','campo','pdf_url');
  end if;
  v_tok := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update aacc_pedidos
     set prof_nome = v_pnome, prof_titulo = v_ptit, prof_email = v_pmail,
         prof_token_hash = encode(sha256(convert_to(v_tok, 'UTF8')), 'hex'), prof_pdf_url = v_purl,
         prof_expira = now() + make_interval(days => c.prazo_professor_dias), prof_visto_em = null,
         prof_indicado_por = v_reg, prof_indicado_nome = public.doc_meu_nome(), prof_indicado_em = now(),
         atualizado_em = now()
   where id = ped.id returning * into ped;
  perform public.aacc_hist(ped.id, 'reenviou', v_ptit || ' ' || v_pnome || ' (' || v_pmail || ')');
  insert into doc_envios (tipo, codigo, registro, para_nome, para_email, assunto, dados)
  values ('aacc_professor', null, null, v_ptit || ' ' || v_pnome, v_pmail,
          'Relatório de AACC de ' || ped.nome || ' para a sua avaliação',
          jsonb_build_object('pedido', ped.codigo, 'estudante', ped.nome,
            'curso', ped.dados#>>'{membro,curso}', 'principal', ped.dados#>>'{pedido,principal}',
            'creditos', ped.pdf_meta->>'creditos', 'indicado_por', public.doc_meu_nome(),
            'professor', v_ptit || ' ' || v_pnome, 'prazo', (ped.prof_expira at time zone 'America/Sao_Paulo')::date,
            'url', c.url_portal || '/aproveitamento/?p=' || v_tok));
  return jsonb_build_object('status','ok');
end $$;

-- O pedido pelo link do professor: pelo SHA-256 do que veio na URL.
create or replace function public.aacc_por_token(p_token text)
returns public.aacc_pedidos language sql stable security definer
set search_path = public as $$
  select * from aacc_pedidos
   where prof_token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
     and coalesce(p_token, '') ~ '^[0-9a-f]{64}$';
$$;
revoke execute on function public.aacc_por_token(text) from public, anon, authenticated;

-- A PÁGINA DO PROFESSOR, sem conta: o que ele precisa para decidir.
create or replace function public.aacc_professor_ler(p_token text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  ped public.aacc_pedidos := public.aacc_por_token(p_token);
  c   public.aacc_config;
begin
  if ped.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into c from aacc_config;
  if ped.status = 'concluido' then
    return jsonb_build_object('status','concluido','codigo',ped.codigo,'estudante',ped.nome,'nota',ped.nota,
                              'emitido',ped.emitido,'concluido_em',ped.concluido_em);
  end if;
  if ped.status <> 'professor' then return jsonb_build_object('status','fechado','codigo',ped.codigo); end if;
  if ped.prof_expira < now() then return jsonb_build_object('status','expirado','codigo',ped.codigo); end if;
  if ped.prof_visto_em is null then
    update aacc_pedidos set prof_visto_em = now() where id = ped.id;
    perform public.aacc_hist(ped.id, 'abriu', 'O professor orientador abriu o pedido', ped.prof_titulo || ' ' || ped.prof_nome);
  end if;
  return jsonb_build_object('status','ok',
    'pedido', public.aacc_pedido_json(ped, false) || jsonb_build_object(
      'membro', jsonb_build_object('nome', ped.nome, 'curso', ped.dados#>>'{membro,curso}',
        'matricula', ped.dados#>>'{membro,matricula}', 'ingresso', ped.dados#>>'{membro,ingresso}',
        'situacao', ped.dados#>>'{membro,situacao}', 'inicio', ped.dados#>>'{membro,inicio}',
        'fim', ped.dados#>>'{membro,fim}', 'cargo', ped.dados#>>'{membro,cargo}'),
      'pdf_url', ped.prof_pdf_url, 'prof_expira', ped.prof_expira),
    'aprovacoes', coalesce((select jsonb_agg(jsonb_build_object('etapa', a.etapa, 'rotulo', a.rotulo, 'nome', a.nome,
                    'criado_em', a.criado_em, 'parecer', a.parecer) order by a.etapa)
                    from aacc_decisoes a where a.pedido_id = ped.id and a.versao = ped.versao and a.decisao = 'aprovada'), '[]'::jsonb),
    'barema', c.barema, 'nota_minima', c.nota_minima);
end $$;

-- A decisão do professor. Aprovar emite a folha de aprovação.
create or replace function public.aacc_professor_decidir(p_token text, p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  ped     public.aacc_pedidos := public.aacc_por_token(p_token);
  c       public.aacc_config;
  cfg     public.doc_emissao_config;
  v_dec   text := p->>'decisao';
  v_par   text := nullif(trim(coalesce(p->>'parecer', '')), '');
  cr      jsonb;
  v_nota  numeric := 0;
  v_n     numeric;
  v_bar   jsonb := '[]'::jsonb;
  v_pname text;
  v_dados jsonb;
  v       public.doc_emitidos;
  v_conc  text;
  v_mail  text;
  v_todos integer[];
begin
  if ped.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into c from aacc_config;
  select * into cfg from doc_emissao_config;
  if ped.status <> 'professor' then return jsonb_build_object('status','fechado'); end if;
  if ped.prof_expira < now() then return jsonb_build_object('status','expirado'); end if;
  if v_dec not in ('aprovar','devolver') then return jsonb_build_object('status','invalido','campo','decisao'); end if;
  if length(coalesce(v_par, '')) > 1200 then return jsonb_build_object('status','invalido','campo','parecer'); end if;
  v_pname := ped.prof_titulo || ' ' || ped.prof_nome;

  if v_dec = 'devolver' then
    if v_par is null then return jsonb_build_object('status','invalido','campo','parecer'); end if;
    insert into aacc_decisoes (pedido_id, versao, etapa, grupo_id, rotulo, registro, nome, decisao, parecer)
    values (ped.id, ped.versao, ped.etapa, null, 'Professor orientador', null, v_pname, 'devolvida', v_par);
    update aacc_pedidos set status = 'devolvido', etapa = 0, motivo = v_par, prof_token_hash = null, atualizado_em = now()
     where id = ped.id returning * into ped;
    perform public.aacc_hist(ped.id, 'devolveu', 'Professor orientador: ' || v_par, v_pname);
    perform public.aacc_avisar_estudante(ped, 'devolvido', ped.codigo || ': o professor orientador devolveu o relatório',
      v_pname || ' devolveu: ' || v_par, jsonb_build_object('etapa', 'Professor orientador', 'motivo', v_par));
    perform public.notificar(array_remove(array[ped.prof_indicado_por], null), 'aacc',
      public.aacc_titulo(ped) || ' foi devolvido pelo professor orientador', v_par, '#/servicos/aproveitamento/' || ped.codigo);
    return jsonb_build_object('status','ok','situacao','devolvido');
  end if;

  -- o barema: cada critério de 0 a 10, de meio em meio ponto; os pontos
  -- são a nota × o peso / 10, exatos em duas casas, e a nota final é a
  -- soma deles: a coluna da folha fecha com o total
  for cr in select * from jsonb_array_elements(c.barema) loop
    begin v_n := (p#>>array['notas', cr->>'chave'])::numeric;
    exception when others then v_n := null; end;
    if v_n is null or v_n < 0 or v_n > 10 or v_n * 2 <> trunc(v_n * 2) then
      return jsonb_build_object('status','invalido','campo','nota','criterio',cr->>'chave');
    end if;
    v_nota := v_nota + round(v_n * (cr->>'peso')::numeric / 10, 2);
    v_bar := v_bar || jsonb_build_object('chave', cr->>'chave', 'nome', cr->>'nome', 'peso', (cr->>'peso')::numeric,
                                         'nota', v_n, 'pontos', round(v_n * (cr->>'peso')::numeric / 10, 2));
  end loop;
  v_nota := round(v_nota, 2);
  if v_nota < c.nota_minima then
    return jsonb_build_object('status','nota_minima','nota',v_nota,'minima',c.nota_minima);
  end if;
  if coalesce((p->>'confirmo')::boolean, false) is not true then
    return jsonb_build_object('status','invalido','campo','confirmo');
  end if;
  v_conc := case when v_nota >= 90 then 'A' when v_nota >= 80 then 'B' when v_nota >= 70 then 'C'
                 when v_nota >= 60 then 'D' when v_nota >= 40 then 'E' else 'F' end;
  v_mail := regexp_replace(ped.prof_email, '^(.)[^@]*(@.*)$', '\1•••\2');

  update aacc_pedidos set nota = v_nota, barema = v_bar, parecer_prof = v_par where id = ped.id returning * into ped;
  insert into aacc_decisoes (pedido_id, versao, etapa, grupo_id, rotulo, registro, nome, decisao, parecer)
  values (ped.id, ped.versao, ped.etapa, null, 'Professor orientador', null, v_pname, 'aprovada', v_par);

  -- a fotografia do que a folha imprime
  v_dados := jsonb_build_object(
    'pedido', ped.codigo,
    'estudante', jsonb_build_object('nome', ped.nome, 'matricula', ped.dados#>>'{membro,matricula}',
      'curso', ped.dados#>>'{membro,curso}', 'ingresso', ped.dados#>>'{membro,ingresso}',
      'colegiado', ped.dados#>>'{pedido,colegiado}'),
    'equipe', jsonb_build_object('inicio', ped.dados#>>'{membro,inicio}', 'fim', ped.dados#>>'{membro,fim}',
      'situacao', ped.dados#>>'{membro,situacao}', 'cargo', ped.dados#>>'{membro,cargo}'),
    'enquadramento', ped.dados->'pedido',
    'semestres', ped.dados->'semestres',
    'creditos', jsonb_build_object('total', ped.pdf_meta->>'creditos', 'principal', ped.pdf_meta->>'principal',
      'principal_creditos', ped.pdf_meta->>'principalcreditos', 'semestres', ped.pdf_meta->>'semestres',
      'itens', ped.pdf_meta->>'itens'),
    'relatorio', jsonb_build_object('versao', ped.versao, 'paginas', ped.pdf_paginas, 'sha256', ped.pdf_sha256,
      'enviado_em', ped.enviado_em, 'folha', ped.folha),
    'aprovacoes', coalesce((select jsonb_agg(jsonb_build_object('etapa', a.etapa, 'rotulo', a.rotulo, 'nome', a.nome,
                    'em', a.criado_em) order by a.etapa)
                    from aacc_decisoes a where a.pedido_id = ped.id and a.versao = ped.versao and a.decisao = 'aprovada'
                      and a.registro is not null), '[]'::jsonb),
    'professor', jsonb_build_object('nome', ped.prof_nome, 'titulo', ped.prof_titulo, 'email', v_mail,
      'em', now(), 'nota', v_nota, 'conceito', v_conc, 'barema', v_bar, 'parecer', v_par,
      'indicado_por', ped.prof_indicado_nome),
    'serie_titulo', (select s.titulo from doc_series s where s.id = c.serie),
    'norma', 'Resolução nº 02/2019 da Congregação da Escola de Engenharia da UFMG',
    'cidade', cfg.cidade, 'data', (now() at time zone 'America/Sao_Paulo')::date,
    'texto_instituicao', cfg.texto_instituicao);
  if c.serie is null then
    raise exception using errcode = 'P0001', message = 'doc_sem_serie',
      detail = 'A série do relatório de AACC não está configurada (aacc_config).';
  end if;
  v := public.doc_emitir('aproveitamento', c.serie, ped.numero, 'Folha de aprovação', ped.registro, ped.nome, v_dados);
  update doc_emitidos set emitido_nome = 'SOMA, aprovação de ' || v_pname where codigo = v.codigo;
  update aacc_pedidos set status = 'concluido', emitido = v.codigo, concluido_em = now(), atualizado_em = now()
   where id = ped.id returning * into ped;
  perform public.aacc_hist(ped.id, 'concluiu', 'Nota ' || replace(v_nota::text, '.', ',') || ' (' || v_conc
    || '). Folha de aprovação ' || v.codigo, v_pname);
  perform public.aacc_avisar_estudante(ped, 'concluido', ped.codigo || ': o relatório foi aprovado',
    'Aprovado por ' || v_pname || ', com nota ' || replace(v_nota::text, '.', ',') || '. Baixe o PDF com a folha de aprovação '
      || 'e entregue ao seu colegiado.', jsonb_build_object('codigo', v.codigo, 'nota', v_nota,
      'validacao', cfg.url_validacao || '/?c=' || v.codigo));
  select coalesce(array_agg(distinct a.registro), '{}') into v_todos
    from aacc_decisoes a where a.pedido_id = ped.id and a.registro is not null;
  perform public.notificar(v_todos, 'aacc', public.aacc_titulo(ped) || ' foi aprovado pelo professor orientador',
    'Nota ' || replace(v_nota::text, '.', ',') || '. Folha de aprovação ' || v.codigo || '.', '#/servicos/aproveitamento/' || ped.codigo);
  return jsonb_build_object('status','ok','situacao','concluido','codigo',v.codigo,'nota',v_nota);
end $$;

-- REABRIR: o Colegiado apontou algo. A folha é revogada e o pedido
-- volta ao envio do PDF. Do dono, do Depto. de Pessoal e de admin.
create or replace function public.aacc_reabrir(p_id uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  ped   public.aacc_pedidos;
  v_mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into ped from aacc_pedidos where id = p_id for update;
  if not found or not public.aacc_pode_ver(p_id) then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (ped.registro = public.portal_registro_atual() or coalesce(public.papel_atual(), '') in ('admin','pessoal')) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if ped.status <> 'concluido' then return jsonb_build_object('status','nao_concluido'); end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;
  if exists (select 1 from aacc_pedidos where registro = ped.registro and id <> ped.id
                and status in ('preparacao','analise','devolvido','professor')) then
    return jsonb_build_object('status','outro_aberto');
  end if;
  update doc_emitidos
     set revogado_em = now(), revogado_nome = public.doc_meu_nome(),
         revogado_motivo = ped.codigo || ' reaberto para correção: ' || v_mot
   where codigo = ped.emitido and revogado_em is null;
  update aacc_pedidos set status = 'devolvido', etapa = 0, motivo = 'Reaberto: ' || v_mot, prof_token_hash = null,
         atualizado_em = now()
   where id = ped.id returning * into ped;
  perform public.aacc_hist(ped.id, 'reabriu', v_mot || '. Folha ' || coalesce(ped.emitido, '') || ' revogada');
  perform public.aacc_avisar_estudante(ped, 'reaberto', ped.codigo || ': o pedido foi reaberto',
    'A folha de aprovação ' || coalesce(ped.emitido, '') || ' foi revogada. Corrija o relatório e envie de novo: ele passa '
      || 'pelas aprovações outra vez. Motivo: ' || v_mot, jsonb_build_object('motivo', v_mot));
  return jsonb_build_object('status','ok','situacao','devolvido');
end $$;

-- CANCELAR, antes de concluído. Do dono e do Depto. de Pessoal.
create or replace function public.aacc_cancelar(p_id uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  ped   public.aacc_pedidos;
  v_mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into ped from aacc_pedidos where id = p_id for update;
  if not found or not public.aacc_pode_ver(p_id) then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (ped.registro = public.portal_registro_atual() or coalesce(public.papel_atual(), '') in ('admin','pessoal')) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if ped.status in ('concluido','cancelado') then return jsonb_build_object('status','fechado'); end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;
  update aacc_pedidos set status = 'cancelado', motivo = v_mot, prof_token_hash = null, atualizado_em = now() where id = p_id;
  perform public.aacc_hist(p_id, 'cancelou', v_mot);
  return jsonb_build_object('status','ok','situacao','cancelado');
end $$;

-- A LISTA: os meus pedidos, os que esperam a minha decisão e, para
-- quem aprova, os outros enviados.
create or replace function public.aacc_lista()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_ger boolean := coalesce(public.papel_atual(), '') in ('admin','pessoal');
  v_apr boolean := public.aacc_aprovador(v_reg);
  v_n   integer := public.aacc_n_etapas();
begin
  if v_reg is null and not v_ger then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(public.aacc_pedido_json(p, false) || jsonb_build_object(
      'meu', p.registro = v_reg,
      'posso_decidir', p.status = 'analise' and p.etapa between 1 and v_n and p.registro is distinct from v_reg
         and public.aacc_decide_etapa(p.etapa, v_reg)
         and not exists (select 1 from aacc_decisoes a where a.pedido_id = p.id and a.versao = p.versao
                           and a.registro = v_reg and a.decisao = 'aprovada'))
      order by (p.status in ('analise','professor')) desc, coalesce(p.enviado_em, p.criado_em) desc)
    from aacc_pedidos p
   where p.registro = v_reg or v_ger or (v_apr and p.versao > 0)), '[]'::jsonb);
end $$;

-- UM PEDIDO, inteiro, com o que cada um pode fazer.
create or replace function public.aacc_ler(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  ped   public.aacc_pedidos;
  v_n   integer := public.aacc_n_etapas();
  v_dec boolean;
  v_ger boolean := coalesce(public.papel_atual(), '') in ('admin','pessoal');
begin
  select * into ped from aacc_pedidos
   where codigo = upper(trim(coalesce(p_codigo, ''))) or id::text = trim(coalesce(p_codigo, ''));
  if not found or not public.aacc_pode_ver(ped.id) then return jsonb_build_object('status','nao_encontrado'); end if;
  v_dec := ped.status = 'analise' and ped.etapa between 1 and v_n and ped.registro is distinct from v_reg
           and public.aacc_decide_etapa(ped.etapa, v_reg)
           and not exists (select 1 from aacc_decisoes a where a.pedido_id = ped.id and a.versao = ped.versao
                             and a.registro = v_reg and a.decisao = 'aprovada');
  return jsonb_build_object('status','ok',
    'pedido', public.aacc_pedido_json(ped, true),
    'etapas', (select coalesce(jsonb_agg(jsonb_build_object('etapa', i, 'rotulo', public.aacc_rotulo(i),
                 'grupo', (select g.nome from grupos g where g.id = c.grupos[i])) order by i), '[]'::jsonb)
                 from aacc_config c, generate_series(1, v_n) i),
    'versoes', coalesce((select jsonb_agg(to_jsonb(v) order by v.versao) from aacc_versoes v where v.pedido_id = ped.id), '[]'::jsonb),
    'decisoes', coalesce((select jsonb_agg(jsonb_build_object('versao', a.versao, 'etapa', a.etapa, 'rotulo', a.rotulo,
                  'nome', a.nome, 'decisao', a.decisao, 'parecer', a.parecer, 'criado_em', a.criado_em) order by a.criado_em, a.id)
                  from aacc_decisoes a where a.pedido_id = ped.id), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('nome', h.nome, 'acao', h.acao, 'detalhe', h.detalhe,
                  'criado_em', h.criado_em) order by h.criado_em, h.id) from aacc_historico h where h.pedido_id = ped.id), '[]'::jsonb),
    'pode', jsonb_build_object(
      'decidir', v_dec,
      'indicar', v_dec and ped.etapa = v_n,
      'trocar_professor', ped.status = 'professor' and ped.registro is distinct from v_reg
                          and public.aacc_decide_etapa(v_n, v_reg),
      'enviar', ped.registro = v_reg and ped.status in ('preparacao','devolvido'),
      'preparar', ped.registro = v_reg and ped.status in ('preparacao','devolvido'),
      'reabrir', (ped.registro = v_reg or v_ger) and ped.status = 'concluido',
      'cancelar', (ped.registro = v_reg or v_ger) and ped.status not in ('concluido','cancelado'),
      'baixar_final', ped.status = 'concluido' and ped.emitido is not null),
    'config', (select jsonb_build_object('dominio_professor', c.dominio_professor, 'prazo_professor_dias', c.prazo_professor_dias,
                                         'nota_minima', c.nota_minima) from aacc_config c));
end $$;

-- A folha emitida, para desenhar o PDF final (o relatório com a folha).
create or replace function public.aacc_folha(p_id uuid)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  ped public.aacc_pedidos;
  d   public.doc_emitidos;
begin
  select * into ped from aacc_pedidos where id = p_id;
  if not found or not public.aacc_pode_ver(p_id) then return jsonb_build_object('status','nao_encontrado'); end if;
  if ped.emitido is null then return jsonb_build_object('status','nao_emitido'); end if;
  select * into d from doc_emitidos where codigo = ped.emitido;
  return jsonb_build_object('status','ok','pdf_caminho',ped.pdf_caminho,'folha',ped.folha,'paginas',ped.pdf_paginas,
                            'emissao', public.doc_emitido_json(d, false));
end $$;

-- Quantos pedidos esperam a MINHA decisão: para o início.
create or replace function public.aacc_pendentes()
returns integer language sql stable security definer
set search_path = public as $$
  select case when public.portal_registro_atual() is null then 0 else
    (select count(*)::integer from aacc_pedidos p
      where p.status = 'analise' and p.etapa between 1 and public.aacc_n_etapas()
        and p.registro <> public.portal_registro_atual()
        and public.aacc_decide_etapa(p.etapa, public.portal_registro_atual())
        and not exists (select 1 from aacc_decisoes a where a.pedido_id = p.id and a.versao = p.versao
                          and a.registro = public.portal_registro_atual() and a.decisao = 'aprovada')) end;
$$;

-- AS CONFIGURAÇÕES: admin e o Depto. de Pessoal.
create or replace function public.aacc_config_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_g   integer[] := '{}';
  v_r   text[] := '{}';
  x     jsonb;
  v_som numeric := 0;
  cr    jsonb;
begin
  if coalesce(public.papel_atual(), '') not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  if jsonb_typeof(p->'etapas') = 'array' then
    if jsonb_array_length(p->'etapas') < 1 or jsonb_array_length(p->'etapas') > 5 then
      return jsonb_build_object('status','invalido','campo','etapas');
    end if;
    for x in select * from jsonb_array_elements(p->'etapas') loop
      if not exists (select 1 from grupos where id = (x->>'grupo_id')::integer) then
        return jsonb_build_object('status','invalido','campo','etapas','motivo','grupo');
      end if;
      if (x->>'grupo_id')::integer = any(v_g) then return jsonb_build_object('status','invalido','campo','etapas','motivo','repetido'); end if;
      v_g := v_g || (x->>'grupo_id')::integer;
      v_r := v_r || coalesce(nullif(trim(x->>'rotulo'), ''), (select nome from grupos where id = (x->>'grupo_id')::integer));
    end loop;
    if exists (select 1 from aacc_pedidos where status = 'analise' and etapa > cardinality(v_g)) then
      return jsonb_build_object('status','em_uso');
    end if;
    update aacc_config set grupos = v_g, rotulos = v_r;
  end if;
  if p ? 'barema' then
    if jsonb_typeof(p->'barema') <> 'array' or jsonb_array_length(p->'barema') = 0 then
      return jsonb_build_object('status','invalido','campo','barema');
    end if;
    for cr in select * from jsonb_array_elements(p->'barema') loop
      if coalesce(cr->>'chave', '') !~ '^[a-z][a-z0-9_]{1,30}$' or coalesce(cr->>'nome', '') = ''
         or coalesce((cr->>'peso')::numeric, 0) <= 0 then
        return jsonb_build_object('status','invalido','campo','barema');
      end if;
      v_som := v_som + (cr->>'peso')::numeric;
    end loop;
    if v_som <> 100 then return jsonb_build_object('status','invalido','campo','barema','soma',v_som); end if;
    update aacc_config set barema = p->'barema';
  end if;
  update aacc_config
     set dominio_professor    = coalesce(lower(trim(p->>'dominio_professor')), dominio_professor),
         prazo_professor_dias = coalesce((p->>'prazo_professor_dias')::integer, prazo_professor_dias),
         template_url         = coalesce(nullif(trim(p->>'template_url'), ''), template_url),
         atualizado_em = now(), atualizado_por = public.doc_meu_nome();
  return jsonb_build_object('status','ok');
end $$;

-- ============================================================
-- 6. O BUCKET
--    "aproveitamento", privado, só PDF. O estudante sobe na pasta dele
--    (<registro>/<pedido>/…) enquanto o pedido espera o envio; lê quem
--    vê o pedido. Nada se apaga: o PDF de uma versão é o que foi
--    aprovado.
-- ------------------------------------------------------------
create or replace function public.aacc_pode_enviar_objeto(p_nome text)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from aacc_pedidos p
     where p.registro = public.portal_registro_atual()
       and split_part(p_nome, '/', 1) = p.registro::text
       and split_part(p_nome, '/', 2) = p.id::text
       and p.status in ('preparacao','devolvido')
       and p_nome ~ '^[0-9]+/[0-9a-f-]{36}/[A-Za-z0-9._-]+\.pdf$');
$$;
create or replace function public.aacc_pode_baixar_objeto(p_nome text)
returns boolean language sql stable security definer
set search_path = public as $$
  select case when split_part(p_nome, '/', 2) ~ '^[0-9a-f-]{36}$'
              then public.aacc_pode_ver(split_part(p_nome, '/', 2)::uuid) else false end;
$$;
revoke execute on function public.aacc_pode_enviar_objeto(text) from public, anon;
revoke execute on function public.aacc_pode_baixar_objeto(text) from public, anon;
grant  execute on function public.aacc_pode_enviar_objeto(text) to authenticated;
grant  execute on function public.aacc_pode_baixar_objeto(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sem o schema storage: o bucket e as políticas do aproveitamento ficam para quando houver.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('aproveitamento', 'aproveitamento', false, 52428800, array['application/pdf'])
  on conflict (id) do update set public = false, file_size_limit = 52428800, allowed_mime_types = array['application/pdf'];
  execute 'drop policy if exists aacc_obj_insert on storage.objects';
  execute $p$create policy aacc_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'aproveitamento' and public.aacc_pode_enviar_objeto(name))$p$;
  execute 'drop policy if exists aacc_obj_select on storage.objects';
  execute $p$create policy aacc_obj_select on storage.objects for select to authenticated
    using (bucket_id = 'aproveitamento' and public.aacc_pode_baixar_objeto(name))$p$;
end $$;

-- ============================================================
-- 7. PERMISSÕES, AUDITORIA E REGISTRO
-- ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'aacc_n_etapas()', 'aacc_grupo(integer)', 'aacc_rotulo(integer)', 'aacc_decide_etapa(integer,integer)',
    'aacc_aprovador(integer)', 'aacc_pessoas_etapa(integer)', 'aacc_pode_ver(uuid)',
    'aacc_hist(uuid,text,text,text)']
  loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  foreach f in array array[
    'aacc_meu()', 'aacc_perfil_salvar(jsonb)', 'aacc_preparar(jsonb)', 'aacc_enviar(jsonb)', 'aacc_decidir(jsonb)',
    'aacc_professor_trocar(jsonb)', 'aacc_reabrir(uuid,text)', 'aacc_cancelar(uuid,text)', 'aacc_lista()',
    'aacc_ler(text)', 'aacc_folha(uuid)', 'aacc_pendentes()', 'aacc_config_salvar(jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- a página do professor não tem conta: a chave anônima alcança só estas duas
  foreach f in array array['aacc_professor_ler(text)', 'aacc_professor_decidir(text,jsonb)'] loop
    execute format('revoke execute on function public.%s from public', f);
    execute format('grant execute on function public.%s to anon, authenticated', f);
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_aacc_config on public.aacc_config';
    execute 'create trigger tg_aud_aacc_config after update on public.aacc_config
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_aacc_pedidos on public.aacc_pedidos';
    execute 'create trigger tg_aud_aacc_pedidos after insert or update or delete on public.aacc_pedidos
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v33_aproveitamento', 'O aproveitamento de AACC: o pedido (AAC-N) com o enquadramento pela Resolução 02/2019 da Congregação, o envio do relatório do template LaTeX, as aprovações por etapa (uma pessoa de cada grupo), o professor orientador pelo link pessoal e a folha de aprovação emitida e autenticável')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select x.item as "o que a 33.0 deixou", x.valor
  from (values
    (1, 'série do relatório', (select public.doc_codigo(s.prefixo, s.sn, null) || ', ' || s.titulo
                                 from doc_series s where s.id = (select serie from aacc_config))),
    (2, 'etapas', (select string_agg(i || '. ' || coalesce(c.rotulos[i], '?') || ' ('
                     || coalesce((select g.nome from grupos g where g.id = c.grupos[i]), 'SEM GRUPO: escolha nas configurações') || ')',
                     '; ' order by i)
                     from aacc_config c, generate_series(1, greatest(cardinality(c.grupos), 1)) i)),
    (3, 'e-mail do professor', (select '@' || dominio_professor || ', link válido por ' || prazo_professor_dias || ' dias' from aacc_config)),
    (4, 'template', (select template_url from aacc_config))
  ) as x(ordem, item, valor)
 order by x.ordem;

-- ============================================================
-- FIM, SOMA 33.0
--
-- Depois de rodar:
--   1) confira as etapas acima; etapa SEM GRUPO trava o pedido nela;
--   2) publique de novo a Edge Function notificar-email (os e-mails do
--      aproveitamento, ao estudante e ao professor) e o portal;
--   3) publique o template no brand (templates/aacc/empacotar.sh): o
--      ZIP que o SOMA baixa é o de assets/ do brand.
-- ============================================================
