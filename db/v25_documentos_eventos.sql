-- ============================================================
-- SOMA 25.0 — MIGRAÇÃO · NeuroDynamics
-- OS DOCUMENTOS QUE O SOMA EMITE, E O REGISTRO DE EVENTOS.
--
-- Três coisas que andam juntas:
--
-- DECLARAÇÃO DE VÍNCULO. Sai na hora, em Serviços, com os dados da
-- ficha — e não fica guardada em lugar nenhum: é gerada de novo a
-- cada pedido. É a série NRO-DIR-004, e o PN de cada declaração é o
-- número de registro do membro (a do registro 17 é NRO-DIR-004-17).
-- Por isso os PNs dessa série deixam de ser registrados no rol: a
-- série diz isso em pn_origem, e o banco recusa PN novo nela.
--
-- DOCUMENTO AUTENTICÁVEL. O arquivo não fica, mas a emissão fica:
-- cada declaração ganha um CÓDIGO VERIFICADOR (7K4Q-XP9M-2A5C, 60
-- bits sorteados) e um CÓDIGO DE CONTROLE (os oito primeiros
-- dígitos do SHA-256 do que foi impresso). Quem recebe o documento
-- confere em auth.neurodynamics.dev: doc_validar() é a única função
-- que a chave anônima alcança, e devolve o que está impresso — com
-- o CPF mascarado.
--
-- REGISTRO DE EVENTO. A participação da equipe num evento — quem
-- foi (membros e externos, estes só com nome e e-mail), quantas
-- horas, onde, quando. Tem código (EXT-14) e, como uma publicação
-- do Studio, só vale aprovado: pede a aprovação de gente dos grupos
-- escolhidos (duas, por padrão), nunca de quem mandou. Aprovado, cada
-- participante ganha a sua declaração de participação — NRO-DIR-006-14,
-- o PN é o número do evento —, autenticável como a de vínculo, e um
-- e-mail com o link para ela (doc_envios, que o notificar-email lê).
--
-- O que se guarda de cada emissão é a FOTOGRAFIA do que foi impresso
-- (doc_emitidos.dados): a segunda via e a validação desenham a partir
-- dela, e mudar a ficha depois não muda um documento já emitido.
--
-- Pré-requisito: SOMA 24.0 aplicada (a 20.0 traz as séries de
-- arquivo; a 24.0, os treinamentos que a declaração lista).
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.doc_series') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'A 25.0 usa as séries de arquivo (NRO-DIR-004) criadas pela 20.0.';
  end if;
  if to_regclass('public.treinamento_conclusoes') is null then
    raise exception using message = 'Falta aplicar a v24 antes desta migração.',
      detail = 'A declaração de vínculo lista os treinamentos concluídos, que a 24.0 guarda.';
  end if;
end $$;

-- ============================================================
-- 1. A CONFIGURAÇÃO DOS DOCUMENTOS — uma linha só
--    O que todo documento emitido repete: a cidade da data, o
--    parágrafo que apresenta a NeuroDynamics e onde se confere a
--    autenticidade. E as duas séries: a de vínculo e a de
--    participação (a seção 2 as acha, ou cria).
-- ------------------------------------------------------------
create table if not exists public.doc_emissao_config (
  id                 boolean primary key default true check (id),
  cidade             text not null default 'Belo Horizonte',
  texto_instituicao  text not null default
    'A NeuroDynamics PD&I é uma Instituição de Ciência e Tecnologia, vinculada ao Laboratório de '
    'Engenharia Biomédica e ao Laboratório de Bioengenharia da Escola de Engenharia da Universidade '
    'Federal de Minas Gerais (UFMG), voltada ao desenvolvimento, integração e aplicação de soluções em '
    'engenharia biomédica que conectam saúde, tecnologia e sistemas complexos.',
  url_validacao      text not null default 'https://auth.neurodynamics.dev'
                     check (url_validacao ~ '^https://[^\s/]+(/[^\s]*)?$'),
  serie_vinculo      uuid references public.doc_series(id) on delete set null,
  serie_participacao uuid references public.doc_series(id) on delete set null,
  atualizado_em      timestamptz not null default now(),
  atualizado_por     text
);
insert into public.doc_emissao_config (id) values (true) on conflict (id) do nothing;

comment on table public.doc_emissao_config is
  'Uma linha. O que todo documento emitido pelo SOMA repete (cidade, o parágrafo da instituição, '
  'o endereço de validação) e as séries da declaração de vínculo e da de participação.';

alter table public.doc_emissao_config enable row level security;
drop policy if exists doc_emcfg_select on public.doc_emissao_config;
create policy doc_emcfg_select on public.doc_emissao_config
  for select to authenticated using (true);
drop policy if exists doc_emcfg_update on public.doc_emissao_config;
create policy doc_emcfg_update on public.doc_emissao_config
  for update to authenticated
  using (coalesce(public.papel_atual(), '') in ('admin','pessoal'))
  with check (coalesce(public.papel_atual(), '') in ('admin','pessoal'));
grant select, update on public.doc_emissao_config to authenticated;

create or replace function public.doc_emissao_config_carimbo()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := public.doc_meu_nome();
  new.url_validacao := regexp_replace(trim(new.url_validacao), '/+$', '');
  return new;
end $$;
drop trigger if exists tg_doc_emcfg_carimbo on public.doc_emissao_config;
create trigger tg_doc_emcfg_carimbo before update on public.doc_emissao_config
  for each row execute function public.doc_emissao_config_carimbo();

-- ============================================================
-- 2. AS SÉRIES CUJOS PNs NÃO MORAM NO ROL
--    pn_origem diz de onde vêm os PNs quando não são registrados
--    aqui. A tela mostra a frase no lugar da lista de PNs, e o banco
--    não aceita PN novo numa série assim — senão alguém criaria à mão
--    o NRO-DIR-004-17 que a declaração do registro 17 já usa.
-- ------------------------------------------------------------
alter table public.doc_series add column if not exists pn_origem text;
comment on column public.doc_series.pn_origem is
  'Quando os PNs desta série não são registrados no rol: de onde eles vêm (uma frase, para a tela). '
  'Com ela preenchida, o banco não aceita PN novo na série.';

create or replace function public.tg_doc_pn_fora_do_rol()
returns trigger language plpgsql
set search_path = public as $$
declare v_origem text;
begin
  if new.pn is null then return new; end if;
  select pn_origem into v_origem from doc_series where id = new.serie_id;
  if v_origem is not null then
    raise exception using errcode = 'P0001', message = 'doc_pn_fora_do_rol', detail = v_origem;
  end if;
  return new;
end $$;
drop trigger if exists tg_doc_arquivos_pn_fora on public.doc_arquivos;
create trigger tg_doc_arquivos_pn_fora before insert on public.doc_arquivos
  for each row execute function public.tg_doc_pn_fora_do_rol();

-- A declaração de vínculo (NRO-DIR-004) e a de participação. A de
-- vínculo já existe desde a 21.0 ("DECLARAÇÃO DE MEMBRO", que a 22.0
-- fez template → registros); o nome passa a ser o do modelo em uso.
-- A de participação é nova: o próximo SN livre da Diretoria. As duas
-- entram no registro de alterações da cabeça, assinadas "SOMA 25.0".
do $$
declare
  v_vinc uuid; v_part uuid; v_cab uuid; v_sn integer; v_antes text;
  c_vinc constant text := 'Os PNs desta série não são registrados no rol: cada declaração é gerada sob demanda '
    'em Serviços › Declaração de vínculo, e o PN é o número de registro do membro (a do registro 17 é '
    'NRO-DIR-004-17). O arquivo não fica guardado; cada emissão ganha um código verificador, conferido '
    'em auth.neurodynamics.dev.';
  c_part constant text := 'Os PNs desta série não são registrados no rol: cada declaração é gerada quando um '
    'evento registrado em Serviços › Eventos é aprovado, e o PN é o número do evento (o EXT-14 dá a %s-14). '
    'O arquivo não fica guardado; cada participante ganha um código verificador, conferido em '
    'auth.neurodynamics.dev.';
begin
  insert into doc_emissores (prefixo, nome, ordem) values ('DIR', 'Diretoria', 5)
  on conflict (prefixo) do nothing;

  -- vínculo
  select id into v_vinc from doc_series where prefixo = 'DIR' and sn = 4;
  if v_vinc is null then
    insert into doc_series (prefixo, sn, titulo, tipo, subtipo, classe, multiplo)
    values ('DIR', 4, 'DECLARAÇÃO DE VÍNCULO', 'registro', 'declaracao', 'controlado', true)
    returning id into v_vinc;
    insert into doc_arquivos (serie_id, pn, codigo, autor_nome, alterado_nome)
    values (v_vinc, null, public.doc_codigo('DIR', 4, null), 'SOMA 25.0', 'SOMA 25.0')
    returning id into v_cab;
    insert into doc_eventos (arquivo_id, tipo, detalhe, nome) values (v_cab, 'criou', null, 'SOMA 25.0');
  end if;
  select id into v_cab from doc_arquivos where serie_id = v_vinc and pn is null;
  if (select pn_origem from doc_series where id = v_vinc) is null then
    perform set_config('doc.quem', 'SOMA 25.0', true);
    select titulo into v_antes from doc_series where id = v_vinc;
    update doc_series
       set pn_origem = c_vinc,
           titulo    = case when titulo = 'DECLARAÇÃO DE MEMBRO' then 'DECLARAÇÃO DE VÍNCULO' else titulo end,
           -- cada declaração é um registro: a que sai hoje diz o que era verdade hoje
           tipo      = case when multiplo or not exists (select 1 from doc_arquivos where serie_id = v_vinc and pn is not null)
                            then 'registro' else tipo end,
           multiplo  = true,
           atualizado_em = now()
     where id = v_vinc;
    if v_cab is not null then
      insert into doc_eventos (arquivo_id, tipo, detalhe, nome)
      values (v_cab, 'pn_origem',
              'Os PNs deixam de ser registrados no rol: a declaração é gerada sob demanda, e o PN é o registro do membro.'
              || case when v_antes = 'DECLARAÇÃO DE MEMBRO' then ' O título passa a ser o do modelo em uso: DECLARAÇÃO DE VÍNCULO.' else '' end,
              'SOMA 25.0');
    end if;
  end if;

  -- participação
  select serie_participacao into v_part from doc_emissao_config;
  if v_part is null then
    select id into v_part from doc_series
     where prefixo = 'DIR' and titulo ilike 'DECLARAÇÃO DE PARTICIPAÇÃO%' order by sn limit 1;
  end if;
  if v_part is null then
    select coalesce(max(sn), 0) + 1 into v_sn from doc_series where prefixo = 'DIR';
    insert into doc_series (prefixo, sn, titulo, tipo, subtipo, classe, multiplo, pn_origem, descricao)
    values ('DIR', v_sn, 'DECLARAÇÃO DE PARTICIPAÇÃO EM EVENTO', 'registro', 'declaracao', 'controlado', true,
            format(c_part, public.doc_codigo('DIR', v_sn, null)),
            'Criada pela migração 25.0, com o registro de eventos. Cada declaração nasce da aprovação de um evento.')
    returning id into v_part;
    insert into doc_arquivos (serie_id, pn, codigo, autor_nome, alterado_nome)
    values (v_part, null, public.doc_codigo('DIR', v_sn, null), 'SOMA 25.0', 'SOMA 25.0')
    returning id into v_cab;
    insert into doc_eventos (arquivo_id, tipo, detalhe, nome) values (v_cab, 'criou', null, 'SOMA 25.0');
  elsif (select pn_origem from doc_series where id = v_part) is null then
    update doc_series
       set pn_origem = format(c_part, public.doc_codigo(prefixo, sn, null)), atualizado_em = now()
     where id = v_part;
  end if;

  update doc_emissao_config
     set serie_vinculo      = coalesce(serie_vinculo, v_vinc),
         serie_participacao = coalesce(serie_participacao, v_part);
end $$;

-- ============================================================
-- 3. O REGISTRO DE EVENTOS — as tabelas
--    Um evento registrado (EXT-14) é a participação da equipe num
--    evento: nome, onde, quando, quantas horas e quem foi. Os
--    participantes são membros (pelo registro) ou externos (nome e
--    e-mail). Como a publicação do Studio, anda por rascunho →
--    aprovação → aprovado, e a aprovação vale para uma VERSÃO:
--    mexer no evento em aprovação cria a versão seguinte, e as
--    aprovações da anterior deixam de contar.
-- ------------------------------------------------------------
create table if not exists public.eventos_ext_config (
  id                 boolean primary key default true check (id),
  grupos_aprovadores integer[] not null default '{}',
  aprovacoes_minimas integer   not null default 2 check (aprovacoes_minimas between 1 and 3),
  atualizado_em      timestamptz not null default now(),
  atualizado_por     text
);
insert into public.eventos_ext_config (id) values (true) on conflict (id) do nothing;
comment on table public.eventos_ext_config is
  'Uma linha. Quem aprova os eventos registrados (grupos, pela pertença efetiva) e quantas aprovações '
  'bastam. Sem grupo aprovador, aprova admin.';

-- Semente: o Depto. de Pessoal aprova (é ele quem responde pelo que
-- a equipe declara). A gestão troca em Serviços › Eventos › Configurações.
do $$
declare v_id integer;
begin
  if (select cardinality(grupos_aprovadores) from eventos_ext_config) = 0 then
    select id into v_id from grupos where chave = 'pessoal';
    if v_id is not null then update eventos_ext_config set grupos_aprovadores = array[v_id]; end if;
  end if;
end $$;

alter table public.eventos_ext_config enable row level security;
drop policy if exists evx_cfg_select on public.eventos_ext_config;
create policy evx_cfg_select on public.eventos_ext_config for select to authenticated using (true);
drop policy if exists evx_cfg_update on public.eventos_ext_config;
create policy evx_cfg_update on public.eventos_ext_config for update to authenticated
  using (coalesce(public.papel_atual(), '') in ('admin','pessoal')) with check (coalesce(public.papel_atual(), '') in ('admin','pessoal'));
grant select, update on public.eventos_ext_config to authenticated;

create or replace function public.eventos_ext_config_carimbo()
returns trigger language plpgsql
set search_path = public as $$
begin
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := public.doc_meu_nome();
  select coalesce(array_agg(distinct g order by g), '{}') into new.grupos_aprovadores
    from unnest(new.grupos_aprovadores) g where exists (select 1 from grupos where id = g);
  return new;
end $$;
drop trigger if exists tg_evx_cfg_carimbo on public.eventos_ext_config;
create trigger tg_evx_cfg_carimbo before update on public.eventos_ext_config
  for each row execute function public.eventos_ext_config_carimbo();

create table if not exists public.eventos_ext (
  id           uuid primary key default gen_random_uuid(),
  numero       integer generated always as identity,
  codigo       text generated always as ('EXT-' || numero) stored,
  nome         text not null check (length(trim(nome)) >= 3),
  descricao    text,                         -- como a equipe participou
  modalidade   text not null default 'presencial' check (modalidade in ('presencial','online','hibrido')),
  local        text,
  data_inicio  date not null,
  data_fim     date,
  hora_inicio  time,
  hora_fim     time,
  horas        numeric(6,2) not null check (horas > 0 and horas <= 9999),
  status       text not null default 'rascunho' check (status in ('rascunho','aprovacao','aprovado','cancelado')),
  versao       integer not null default 1,
  criado_por   integer references public.membros(registro) on delete set null,
  criado_nome  text,
  enviado_por  integer references public.membros(registro) on delete set null,
  enviado_em   timestamptz,
  aprovado_em  timestamptz,
  motivo       text,                         -- a última devolução, reabertura ou o cancelamento
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint eventos_ext_datas check (data_fim is null or data_fim >= data_inicio)
);
create unique index if not exists eventos_ext_numero on public.eventos_ext (numero);
create index if not exists eventos_ext_data on public.eventos_ext (data_inicio desc);

create table if not exists public.eventos_ext_participantes (
  id          uuid primary key default gen_random_uuid(),
  evento_id   uuid not null references public.eventos_ext(id) on delete cascade,
  registro    integer references public.membros(registro) on delete set null,
  nome        text not null,
  email       text,                          -- dos externos; o membro recebe no e-mail da ficha
  papel       text,                          -- palestrante, expositor, ouvinte, organização…
  horas       numeric(6,2) check (horas is null or (horas > 0 and horas <= 9999)),
  ordem       integer not null default 0,
  declaracao  text                           -- o código verificador da declaração dele, depois de aprovado
);
create unique index if not exists evx_part_membro on public.eventos_ext_participantes (evento_id, registro)
  where registro is not null;
create unique index if not exists evx_part_email on public.eventos_ext_participantes (evento_id, lower(email))
  where registro is null;
create index if not exists evx_part_registro on public.eventos_ext_participantes (registro) where registro is not null;

create table if not exists public.eventos_ext_aprovacoes (
  id         bigserial primary key,
  evento_id  uuid not null references public.eventos_ext(id) on delete cascade,
  versao     integer not null,
  registro   integer references public.membros(registro) on delete set null,
  nome       text,
  decisao    text not null check (decisao in ('aprovada','devolvida')),
  parecer    text,
  criado_em  timestamptz not null default now()
);
create unique index if not exists evx_aprov_uma on public.eventos_ext_aprovacoes (evento_id, versao, registro)
  where decisao = 'aprovada';

create table if not exists public.eventos_ext_historico (
  id         bigserial primary key,
  evento_id  uuid not null references public.eventos_ext(id) on delete cascade,
  registro   integer,
  nome       text,
  acao       text not null,
  detalhe    text,
  criado_em  timestamptz not null default now()
);
create index if not exists evx_hist_ix on public.eventos_ext_historico (evento_id, criado_em);

-- Nada disto se lê direto: a lista e a página do evento saem de
-- funções (seção 7), que decidem o que cada um vê — o e-mail de um
-- externo, por exemplo, só quem registrou e quem aprova.
alter table public.eventos_ext               enable row level security;
alter table public.eventos_ext_participantes enable row level security;
alter table public.eventos_ext_aprovacoes    enable row level security;
alter table public.eventos_ext_historico     enable row level security;

-- ============================================================
-- 4. OS DOCUMENTOS EMITIDOS
--    Um por emissão. O arquivo não fica; fica o que foi impresso, o
--    código verificador que a pessoa leva junto e o código de
--    controle. Revogar é marcar — a validação passa a dizer
--    "revogado", com o motivo. Nada se apaga.
-- ------------------------------------------------------------
create table if not exists public.doc_emitidos (
  codigo          text primary key
                  check (codigo ~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$'),
  tipo            text not null check (tipo in ('vinculo','participacao')),
  documento       text not null,             -- NRO-DIR-004-17
  revisao         text,                      -- a do template em vigor na emissão
  titulo          text not null,             -- 'Declaração de vínculo'
  emissor         text not null,             -- 'Diretoria' — o cabeçalho do modelo
  registro        integer references public.membros(registro) on delete set null,
  titular         text not null,
  evento_id       uuid references public.eventos_ext(id) on delete set null,
  participante_id uuid,
  dados           jsonb not null,            -- a fotografia do que foi impresso
  controle        text not null,             -- 8 dígitos do SHA-256
  emitido_em      timestamptz not null default now(),
  emitido_por     integer references public.membros(registro) on delete set null,
  emitido_nome    text,
  revogado_em     timestamptz,
  revogado_nome   text,
  revogado_motivo text,
  consultas       integer not null default 0,
  consultado_em   timestamptz
);
create index if not exists doc_emit_registro on public.doc_emitidos (registro, emitido_em desc);
create index if not exists doc_emit_evento on public.doc_emitidos (evento_id) where evento_id is not null;

comment on table public.doc_emitidos is
  'Um documento emitido pelo SOMA (declaração de vínculo, de participação): o código verificador, o de '
  'controle e a fotografia do que foi impresso. O arquivo em si não é guardado.';

-- Lê a própria declaração quem é o titular, quem a emitiu e o Depto.
-- de Pessoal. As de participação de um evento, quem o registrou e
-- quem aprova também — por doc_emitido_ler (seção 9).
alter table public.doc_emitidos enable row level security;
drop policy if exists doc_emit_select on public.doc_emitidos;
create policy doc_emit_select on public.doc_emitidos for select to authenticated
  using (registro = public.portal_registro_atual()
         or emitido_por = public.portal_registro_atual()
         or coalesce(public.papel_atual(), '') in ('admin','pessoal'));
grant select on public.doc_emitidos to authenticated;

-- A fila dos e-mails que levam uma declaração (seção 8 explica).
create table if not exists public.doc_envios (
  id          bigserial primary key,
  tipo        text not null default 'participacao',
  codigo      text references public.doc_emitidos(codigo) on delete cascade,
  registro    integer references public.membros(registro) on delete set null,
  para_nome   text not null,
  para_email  text,                          -- o do externo; o membro recebe no e-mail da ficha
  assunto     text not null,
  dados       jsonb not null default '{}'::jsonb,
  criado_em   timestamptz not null default now(),
  enviado_em  timestamptz,
  tentativas  smallint not null default 0,
  erro        text
);
create index if not exists doc_envios_pend on public.doc_envios (criado_em)
  where enviado_em is null and tentativas < 5;
alter table public.doc_envios enable row level security;

-- O código verificador: 12 caracteres do alfabeto de Crockford (sem
-- I, L, O e U, que se confundem com 1, 0 e V), em três grupos. São 60
-- bits do sorteio forte do banco (gen_random_uuid): adivinhar um código
-- que existe é inviável, e é isso que deixa a validação ser pública.
create or replace function public.doc_novo_verificador()
returns text language plpgsql volatile
set search_path = public as $$
declare
  alfa constant text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  h text; v bigint; s text; i integer;
begin
  loop
    h := replace(gen_random_uuid()::text, '-', '');
    -- 15 dígitos hexadecimais = 60 bits; o 13º é a versão do UUID, fixo, e fica de fora
    v := ('x' || lpad(substr(h, 1, 12) || substr(h, 14, 3), 16, '0'))::bit(64)::bigint;
    s := '';
    for i in reverse 11..0 loop
      s := s || substr(alfa, ((v >> (i * 5)) & 31)::integer + 1, 1);
    end loop;
    s := substr(s, 1, 4) || '-' || substr(s, 5, 4) || '-' || substr(s, 9, 4);
    exit when not exists (select 1 from doc_emitidos where codigo = s);
  end loop;
  return s;
end $$;
revoke execute on function public.doc_novo_verificador() from public, anon, authenticated;

-- O que a pessoa digitou, do jeito que o código é guardado: sem
-- espaço nem traço, em maiúsculas, com O lido como 0 e I e L como 1.
create or replace function public.doc_normalizar_verificador(p text)
returns text language sql immutable as $$
  select case when x ~ '^[0-9A-HJKMNP-TV-Z]{12}$'
              then substr(x, 1, 4) || '-' || substr(x, 5, 4) || '-' || substr(x, 9, 4) end
    from (select translate(upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')), 'OIL', '011') as x) q;
$$;

-- O código de controle: os oito primeiros dígitos do SHA-256 do que
-- o documento diz (a fotografia, o código, o número e a hora).
-- A hora entra em UTC e por extenso, para o controle não depender do
-- fuso da sessão que o calcula.
create or replace function public.doc_controle(p_codigo text, p_documento text, p_emitido timestamptz, p_dados jsonb)
returns text language sql stable as $$
  select upper(substr(encode(sha256(convert_to(jsonb_build_object(
    'codigo', p_codigo, 'documento', p_documento,
    'emitido_em', to_char(p_emitido at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'dados', p_dados)::text, 'UTF8')), 'hex'), 1, 8));
$$;

-- O CPF como a validação pública mostra: só os seis do meio.
create or replace function public.doc_cpf_mascarado(p text)
returns text language sql immutable as $$
  select case when d ~ '^\d{11}$' then '***.' || substr(d, 4, 3) || '.' || substr(d, 7, 3) || '-**'
              when coalesce(p, '') = '' then null
              else '***' end
    from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) q;
$$;

-- Emitir: grava a emissão e devolve a linha. Não é chamada de fora:
-- quem emite são as funções de cada documento, que conferem quem pede.
create or replace function public.doc_emitir(
  p_tipo text, p_serie uuid, p_pn integer, p_titulo text, p_registro integer, p_titular text,
  p_dados jsonb, p_evento uuid default null, p_participante uuid default null)
returns public.doc_emitidos language plpgsql volatile security definer
set search_path = public as $$
declare
  s     record;
  v     public.doc_emitidos;
  v_cod text := public.doc_novo_verificador();
  v_doc text;
  v_em  timestamptz := now();
begin
  select ds.prefixo, ds.sn, e.nome as emissor,
         (select a.rev_vigente from doc_arquivos a where a.serie_id = ds.id and a.pn is null) as rev
    into s
    from doc_series ds join doc_emissores e on e.prefixo = ds.prefixo
   where ds.id = p_serie;
  if not found then
    raise exception using errcode = 'P0001', message = 'doc_sem_serie',
      detail = 'A série do documento não está configurada (doc_emissao_config).';
  end if;
  v_doc := public.doc_codigo(s.prefixo, s.sn, p_pn);
  insert into doc_emitidos (codigo, tipo, documento, revisao, titulo, emissor, registro, titular,
                            evento_id, participante_id, dados, controle, emitido_em, emitido_por, emitido_nome)
  values (v_cod, p_tipo, v_doc, s.rev, p_titulo, s.emissor, p_registro, p_titular, p_evento, p_participante,
          p_dados, public.doc_controle(v_cod, v_doc, v_em, p_dados), v_em,
          public.portal_registro_atual(), public.doc_meu_nome())
  returning * into v;
  return v;
end $$;
revoke execute on function public.doc_emitir(text, uuid, integer, text, integer, text, jsonb, uuid, uuid)
  from public, anon, authenticated;

-- A emissão como a tela e a validação a recebem.
create or replace function public.doc_emitido_json(d public.doc_emitidos, p_publico boolean)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'codigo', d.codigo, 'tipo', d.tipo, 'documento', d.documento, 'revisao', d.revisao,
    'titulo', d.titulo, 'emissor', d.emissor, 'titular', d.titular, 'registro', case when p_publico then null else d.registro end,
    'emitido_em', d.emitido_em, 'emitido_nome', case when p_publico then null else d.emitido_nome end,
    'controle', d.controle,
    'situacao', case when d.revogado_em is not null then 'revogado' else 'autentico' end,
    'revogado_em', d.revogado_em, 'revogado_motivo', d.revogado_motivo,
    'consultas', case when p_publico then null else d.consultas end,
    'consultado_em', case when p_publico then null else d.consultado_em end,
    'url_validacao', (select url_validacao from doc_emissao_config),
    'segunda_via', d.tipo = 'participacao',
    'dados', case when p_publico and d.tipo = 'vinculo'
                  then d.dados - 'cpf' || jsonb_build_object('cpf', public.doc_cpf_mascarado(d.dados->>'cpf'))
                  else d.dados end);
$$;
revoke execute on function public.doc_emitido_json(public.doc_emitidos, boolean) from public, anon, authenticated;

-- ============================================================
-- 5. A VALIDAÇÃO PÚBLICA — auth.neurodynamics.dev
--    A única porta desta migração aberta à chave anônima. Recebe o
--    código verificador, devolve o que está impresso (o CPF
--    mascarado) e se o documento foi revogado. Conta as consultas: a
--    pessoa vê na tela dela quantas vezes o documento foi conferido.
-- ------------------------------------------------------------
create or replace function public.doc_validar(p_codigo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_cod text := public.doc_normalizar_verificador(p_codigo);
  d     public.doc_emitidos;
begin
  if v_cod is null then return jsonb_build_object('status','invalido'); end if;
  update doc_emitidos set consultas = consultas + 1, consultado_em = now()
   where codigo = v_cod
   returning * into d;
  if not found then return jsonb_build_object('status','nao_encontrado', 'codigo', v_cod); end if;
  return jsonb_build_object('status', 'ok') || public.doc_emitido_json(d, true);
end $$;
revoke execute on function public.doc_validar(text) from public;
grant  execute on function public.doc_validar(text) to anon, authenticated;

-- ============================================================
-- 6. A DECLARAÇÃO DE VÍNCULO
--    A fotografia sai da ficha e do que o SOMA registra: nome, CPF,
--    cargo, desde quando (e até quando, para quem saiu), os
--    treinamentos concluídos e os eventos aprovados. Não entra o que
--    o sistema não sabe — as atribuições que o modelo antigo trazia
--    eram escritas à mão, para uma finalidade, e uma declaração
--    autenticável não pode afirmar o que ninguém conferiu.
-- ------------------------------------------------------------
create or replace function public.doc_vinculo_dados(p_registro integer)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  m      jsonb;
  v_cpf  text;
  v_cfg  public.doc_emissao_config;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_tre  jsonb;
  v_evs  jsonb;
  v_vig  boolean;
begin
  select to_jsonb(x) into m from membros x where x.registro = p_registro;
  if m is null then return null; end if;
  select * into v_cfg from doc_emissao_config;
  begin
    select d.cpf into v_cpf from dados_pessoais d where d.registro = p_registro;
  exception when undefined_table or undefined_column then v_cpf := null;
  end;
  v_cpf := nullif(trim(coalesce(v_cpf, '')), '');
  if regexp_replace(coalesce(v_cpf, ''), '\D', '', 'g') ~ '^\d{11}$' then
    v_cpf := regexp_replace(regexp_replace(v_cpf, '\D', '', 'g'), '^(\d{3})(\d{3})(\d{3})(\d{2})$', '\1.\2.\3-\4');
  end if;
  v_vig := coalesce(m->>'status', 'Ativo') not in ('Desligado', 'Egresso');

  -- de cada treinamento, a conclusão mais recente
  select coalesce(jsonb_agg(t order by t->>'concluido_em', t->>'codigo'), '[]'::jsonb) into v_tre
    from (select distinct on (c.codigo)
                 jsonb_build_object('codigo', c.codigo, 'titulo', c.titulo, 'revisao', c.revisao,
                                    'carga_horaria_min', c.carga_horaria_min,
                                    'concluido_em', (c.concluido_em at time zone 'America/Sao_Paulo')::date,
                                    'certificado', c.certificado) as t
            from treinamento_conclusoes c
           where c.registro = p_registro
           order by c.codigo, c.concluido_em desc) q;

  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo', e.codigo, 'nome', e.nome, 'data_inicio', e.data_inicio, 'data_fim', e.data_fim,
           'local', e.local, 'modalidade', e.modalidade, 'papel', p.papel,
           'horas', coalesce(p.horas, e.horas)) order by e.data_inicio, e.numero), '[]'::jsonb) into v_evs
    from eventos_ext e join eventos_ext_participantes p on p.evento_id = e.id
   where p.registro = p_registro and e.status = 'aprovado';

  return jsonb_build_object(
    'nome', m->>'nome', 'cpf', v_cpf,
    'cargo', nullif(trim(coalesce(m->>'cargo', '')), ''),
    'departamento', nullif(trim(coalesce(m->>'departamento', '')), ''),
    'status', m->>'status', 'vigente', v_vig,
    'desde', nullif(m->>'data_ingresso', '')::date,
    'ate', case when v_vig then null else nullif(m->>'data_desligamento', '')::date end,
    'cidade', v_cfg.cidade, 'data', v_hoje, 'texto_instituicao', v_cfg.texto_instituicao,
    'treinamentos', v_tre, 'eventos', v_evs);
end $$;
revoke execute on function public.doc_vinculo_dados(integer) from public, anon, authenticated;

-- A própria pessoa pede a sua; o Depto. de Pessoal, a de qualquer um.
create or replace function public.doc_vinculo_pode(p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_registro is not null
     and coalesce(p_registro = public.portal_registro_atual() or coalesce(public.papel_atual(), '') in ('admin','pessoal'), false);
$$;

-- O que vai sair, antes de sair: a tela mostra e avisa o que falta na
-- ficha (sem CPF, a declaração sai sem ele — e diz isso antes).
create or replace function public.doc_vinculo_previa(p_registro integer default null)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg   integer := coalesce(p_registro, public.portal_registro_atual());
  v_d     jsonb;
  v_cfg   public.doc_emissao_config;
  s       record;
  v_falta text[] := '{}';
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if not public.doc_vinculo_pode(v_reg) then return jsonb_build_object('status','sem_permissao'); end if;
  v_d := public.doc_vinculo_dados(v_reg);
  if v_d is null then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into v_cfg from doc_emissao_config;
  select ds.prefixo, ds.sn, e.nome as emissor, a.rev_vigente as rev into s
    from doc_series ds join doc_emissores e on e.prefixo = ds.prefixo
    left join doc_arquivos a on a.serie_id = ds.id and a.pn is null
   where ds.id = v_cfg.serie_vinculo;
  if v_d->>'cpf'   is null then v_falta := v_falta || 'cpf'::text;   end if;
  if v_d->>'cargo' is null then v_falta := v_falta || 'cargo'::text; end if;
  if v_d->>'desde' is null then v_falta := v_falta || 'desde'::text; end if;
  return jsonb_build_object('status','ok', 'registro', v_reg, 'dados', v_d, 'faltam', to_jsonb(v_falta),
    'documento', case when s.prefixo is not null then public.doc_codigo(s.prefixo, s.sn, v_reg) end,
    'revisao', s.rev, 'emissor', s.emissor, 'titulo', 'Declaração de vínculo',
    'url_validacao', v_cfg.url_validacao);
end $$;

create or replace function public.doc_vinculo_emitir(p_registro integer default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := coalesce(p_registro, public.portal_registro_atual());
  v_serie uuid := (select serie_vinculo from doc_emissao_config);
  v_d     jsonb;
  v       public.doc_emitidos;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if not public.doc_vinculo_pode(v_reg) then return jsonb_build_object('status','sem_permissao'); end if;
  if v_serie is null then return jsonb_build_object('status','sem_serie'); end if;
  v_d := public.doc_vinculo_dados(v_reg);
  if v_d is null then return jsonb_build_object('status','nao_encontrado'); end if;
  v := public.doc_emitir('vinculo', v_serie, v_reg, 'Declaração de vínculo', v_reg, v_d->>'nome', v_d);
  return jsonb_build_object('status','ok') || public.doc_emitido_json(v, false);
end $$;

-- ============================================================
-- 7. O REGISTRO DE EVENTOS — as regras
--    Aprova quem está num grupo aprovador (contando subgrupos) e
--    admin — como no Studio —, nunca quem mandou para aprovação, e uma
--    vez por versão. Com as aprovações que bastam, o evento fecha e
--    cada participante ganha a sua declaração.
-- ------------------------------------------------------------
create or replace function public.evento_ext_pode_aprovar()
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.papel_atual(), '') = 'admin'
      or coalesce((select public.grupos_de(public.portal_registro_atual()) && c.grupos_aprovadores
                     from eventos_ext_config c), false);
$$;

-- Quem recebe o aviso de que há evento para aprovar. Sem grupo
-- aprovador, os admins que têm registro.
create or replace function public.evento_ext_aprovadores()
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select array_agg(m.registro order by m.registro)
       from membros m, eventos_ext_config c
      where cardinality(c.grupos_aprovadores) > 0
        and m.status in ('Ativo','Em pausa / avaliação','Sob demanda')
        and public.grupos_de(m.registro) && c.grupos_aprovadores),
    (select array_agg(distinct p.registro)
       from perfis p, eventos_ext_config c
      where cardinality(c.grupos_aprovadores) = 0
        and p.papel = 'admin' and p.registro is not null),
    '{}');
$$;
revoke execute on function public.evento_ext_aprovadores() from public, anon, authenticated;

-- Vê um evento: todo mundo que tem registro, depois de aprovado — é a
-- história da equipe —; antes, quem registrou, quem participa, quem
-- aprova (a partir do envio) e o Depto. de Pessoal.
create or replace function public.evento_ext_pode_ver(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (
    select 1 from eventos_ext e
     where e.id = p_id
       and (   (e.status = 'aprovado' and public.portal_registro_atual() is not null)
            or coalesce(public.papel_atual(), '') in ('admin','pessoal')
            or e.criado_por = public.portal_registro_atual()
            or exists (select 1 from eventos_ext_participantes p
                        where p.evento_id = e.id and p.registro = public.portal_registro_atual())
            or (e.status in ('aprovacao','aprovado') and public.evento_ext_pode_aprovar())));
$$;

-- Os e-mails dos externos são dados pessoais: vê quem registrou, quem
-- aprova e o Depto. de Pessoal.
create or replace function public.evento_ext_ve_emails(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(public.papel_atual(), '') in ('admin','pessoal')
      or coalesce(public.evento_ext_pode_aprovar(), false)
      or exists (select 1 from eventos_ext e where e.id = p_id and e.criado_por = public.portal_registro_atual());
$$;

-- Quem mexe num registro: quem o criou e o Depto. de Pessoal. Sem o
-- coalesce, um evento cujo autor saiu do quadro (criado_por nulo)
-- ficaria aberto a qualquer um: nulo = 17 não é falso, é nulo.
create or replace function public.evento_ext_gere(p_criado_por integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(p_criado_por = public.portal_registro_atual(), false)
      or coalesce(public.papel_atual(), '') in ('admin','pessoal');
$$;
revoke execute on function public.evento_ext_gere(integer) from public, anon, authenticated;

-- "8 h", "2,5 h" — como a notificação e o e-mail escrevem as horas.
create or replace function public.evento_ext_horas_txt(p numeric)
returns text language sql immutable as $$
  select replace(rtrim(rtrim(round(p, 2)::text, '0'), '.'), '.', ',') || ' h';
$$;

create or replace function public.evento_ext_hist(p_id uuid, p_acao text, p_detalhe text)
returns void language sql volatile security definer
set search_path = public as $$
  insert into eventos_ext_historico (evento_id, registro, nome, acao, detalhe)
  values (p_id, public.portal_registro_atual(), public.doc_meu_nome(), p_acao, p_detalhe);
$$;
revoke execute on function public.evento_ext_hist(uuid, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 7a. SALVAR — cria ou altera, com os participantes (a lista vem
--     inteira e substitui a anterior). Mexer num evento em aprovação
--     cria a versão seguinte: o que foi aprovado era a anterior.
--     Aprovado não se altera — reabre-se (7e).
-- ------------------------------------------------------------
create or replace function public.evento_ext_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_id     uuid := nullif(p->>'id', '')::uuid;
  e        public.eventos_ext;
  v_nome   text := nullif(trim(coalesce(p->>'nome', '')), '');
  v_desc   text := nullif(trim(coalesce(p->>'descricao', '')), '');
  v_mod    text := coalesce(nullif(p->>'modalidade', ''), 'presencial');
  v_local  text := nullif(trim(coalesce(p->>'local', '')), '');
  v_parts  jsonb := case when jsonb_typeof(p->'participantes') = 'array' then p->'participantes' else '[]'::jsonb end;
  v_ini    date; v_fim date; v_hi time; v_hf time; v_horas numeric;
  x        jsonb;
  v_i      integer := 0;
  v_vistos text[] := '{}';
  v_chave  text;
  v_pr     integer;
  v_ph     numeric;
  v_nova   boolean := false;
  r        jsonb := jsonb_build_object('status','invalido');
begin
  if v_reg is null and public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_registro');
  end if;
  if v_id is not null then
    select * into e from eventos_ext where id = v_id for update;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    if not public.evento_ext_gere(e.criado_por) then return jsonb_build_object('status','sem_permissao'); end if;
    if e.status not in ('rascunho','aprovacao') then return jsonb_build_object('status','fechado'); end if;
  end if;

  if v_nome is null or length(v_nome) < 3 or length(v_nome) > 200 then return r || '{"campo":"nome"}'; end if;
  if length(coalesce(v_desc, '')) > 2000 then return r || '{"campo":"descricao"}'; end if;
  begin v_ini := nullif(p->>'data_inicio', '')::date; exception when others then v_ini := null; end;
  if v_ini is null then return r || '{"campo":"data_inicio"}'; end if;
  begin v_fim := nullif(p->>'data_fim', '')::date; exception when others then return r || '{"campo":"data_fim"}'; end;
  if v_fim is not null and v_fim < v_ini then return r || '{"campo":"data_fim"}'; end if;
  if v_fim = v_ini then v_fim := null; end if;
  begin
    v_hi := nullif(p->>'hora_inicio', '')::time;
    v_hf := nullif(p->>'hora_fim', '')::time;
  exception when others then return r || '{"campo":"hora_inicio"}'; end;
  if v_hi is not null and v_hf is not null and v_fim is null and v_hf <= v_hi then return r || '{"campo":"hora_fim"}'; end if;
  begin v_horas := nullif(p->>'horas', '')::numeric; exception when others then v_horas := null; end;
  if v_horas is null or v_horas <= 0 or v_horas > 9999 then return r || '{"campo":"horas"}'; end if;
  if v_mod not in ('presencial','online','hibrido') then return r || '{"campo":"modalidade"}'; end if;
  if v_mod <> 'online' and v_local is null then return r || '{"campo":"local"}'; end if;
  if jsonb_array_length(v_parts) = 0 or jsonb_array_length(v_parts) > 300 then return r || '{"campo":"participantes"}'; end if;

  -- os participantes, conferidos antes de gravar qualquer coisa
  for x in select * from jsonb_array_elements(v_parts) loop
    v_i := v_i + 1;
    v_pr := case when (x->>'registro') ~ '^\d+$' then (x->>'registro')::integer end;
    if v_pr is not null then
      if not exists (select 1 from membros where registro = v_pr) then
        return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','membro');
      end if;
      v_chave := 'r' || v_pr;
    else
      if length(coalesce(nullif(trim(x->>'nome'), ''), '')) < 2 then
        return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','nome');
      end if;
      if lower(trim(coalesce(x->>'email', ''))) !~ '^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$' then
        return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','email');
      end if;
      v_chave := 'e' || lower(trim(x->>'email'));
    end if;
    if v_chave = any(v_vistos) then
      return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','repetido');
    end if;
    v_vistos := v_vistos || v_chave;
    begin v_ph := nullif(x->>'horas', '')::numeric;
    exception when others then return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','horas'); end;
    if v_ph is not null and (v_ph <= 0 or v_ph > 9999) then
      return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','horas');
    end if;
    if length(coalesce(x->>'papel', '')) > 80 then
      return r || jsonb_build_object('campo','participantes','linha',v_i,'motivo','papel');
    end if;
  end loop;

  if v_id is null then
    insert into eventos_ext (nome, descricao, modalidade, local, data_inicio, data_fim, hora_inicio, hora_fim,
                             horas, criado_por, criado_nome)
    values (v_nome, v_desc, v_mod, v_local, v_ini, v_fim, v_hi, v_hf, round(v_horas, 2), v_reg, public.doc_meu_nome())
    returning * into e;
    perform public.evento_ext_hist(e.id, 'criou', null);
  else
    v_nova := e.status = 'aprovacao';
    update eventos_ext
       set nome = v_nome, descricao = v_desc, modalidade = v_mod, local = v_local,
           data_inicio = v_ini, data_fim = v_fim, hora_inicio = v_hi, hora_fim = v_hf, horas = round(v_horas, 2),
           versao = versao + case when v_nova then 1 else 0 end, atualizado_em = now()
     where id = v_id
    returning * into e;
    perform public.evento_ext_hist(e.id, 'editou',
      case when v_nova then 'Versão ' || e.versao || ' — as aprovações recomeçam' end);
    delete from eventos_ext_participantes where evento_id = e.id;
  end if;

  v_i := 0;
  for x in select * from jsonb_array_elements(v_parts) loop
    v_i := v_i + 1;
    v_pr := case when (x->>'registro') ~ '^\d+$' then (x->>'registro')::integer end;
    insert into eventos_ext_participantes (evento_id, registro, nome, email, papel, horas, ordem)
    values (e.id, v_pr,
            case when v_pr is not null then (select nome from membros where registro = v_pr) else trim(x->>'nome') end,
            case when v_pr is null then lower(trim(x->>'email')) end,
            nullif(trim(coalesce(x->>'papel', '')), ''),
            round(nullif(x->>'horas', '')::numeric, 2), v_i);
  end loop;

  -- quem já tinha aprovado a versão anterior fica sabendo que ela mudou
  if v_nova then
    perform public.notificar(
      array(select distinct a.registro from eventos_ext_aprovacoes a
             where a.evento_id = e.id and a.versao = e.versao - 1 and a.decisao = 'aprovada' and a.registro is not null),
      'evento_ext', e.codigo || ' · ' || e.nome || ' mudou depois da sua aprovação',
      'A versão ' || e.versao || ' precisa ser aprovada de novo.', '#/servicos/eventos/' || e.codigo);
  end if;
  return jsonb_build_object('status','ok','id',e.id,'codigo',e.codigo,'versao',e.versao,'situacao',e.status);
end $$;

-- ------------------------------------------------------------
-- 7b. ENVIAR PARA APROVAÇÃO — "fechar" o registro. Só depois de o
--     evento acontecer: declaração de participação no futuro não
--     declara nada.
-- ------------------------------------------------------------
create or replace function public.evento_ext_enviar(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  e      public.eventos_ext;
  v_n    integer;
  v_para integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into e from eventos_ext where id = p_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.evento_ext_gere(e.criado_por) then return jsonb_build_object('status','sem_permissao'); end if;
  if e.status = 'aprovacao' then return jsonb_build_object('status','ja_enviado'); end if;
  if e.status <> 'rascunho' then return jsonb_build_object('status','fechado'); end if;
  if coalesce(e.data_fim, e.data_inicio) > (now() at time zone 'America/Sao_Paulo')::date then
    return jsonb_build_object('status','futuro');
  end if;
  select count(*) into v_n from eventos_ext_participantes where evento_id = p_id;
  if v_n = 0 then return jsonb_build_object('status','invalido','campo','participantes'); end if;

  update eventos_ext
     set status = 'aprovacao', enviado_por = v_reg, enviado_em = now(), motivo = null, atualizado_em = now()
   where id = p_id;
  perform public.evento_ext_hist(p_id, 'enviou', 'Versão ' || e.versao);
  v_para := public.evento_ext_aprovadores();
  perform public.notificar(v_para, 'evento_ext',
    e.codigo || ' · ' || e.nome || ' aguarda a sua aprovação',
    public.doc_meu_nome() || ' registrou ' || v_n || case when v_n = 1 then ' participante' else ' participantes' end
      || ', ' || public.evento_ext_horas_txt(e.horas) || '. São necessárias '
      || (select aprovacoes_minimas from eventos_ext_config) || ' aprovações.',
    '#/servicos/eventos/' || e.codigo);
  return jsonb_build_object('status','ok','situacao','aprovacao',
    'aprovadores', coalesce(cardinality(array_remove(v_para, v_reg)), 0));
end $$;

-- ------------------------------------------------------------
-- 7c. AS DECLARAÇÕES DE PARTICIPAÇÃO — uma por participante, quando
--     o evento é aprovado. Cada uma ganha o código verificador, entra
--     na fila de e-mail (doc_envios) e, para os membros, no sino — já
--     marcada como enviada por e-mail, porque o e-mail que leva a
--     declaração é o da fila, e ninguém recebe dois.
-- ------------------------------------------------------------
create or replace function public.evento_ext_emitir(p_id uuid)
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare
  e      public.eventos_ext;
  c      public.doc_emissao_config;
  pt     record;
  v      public.doc_emitidos;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n    integer := 0;
  v_d    jsonb;
begin
  select * into e from eventos_ext where id = p_id;
  select * into c from doc_emissao_config;
  if c.serie_participacao is null then
    raise exception using errcode = 'P0001', message = 'doc_sem_serie',
      detail = 'A série da declaração de participação não está configurada (doc_emissao_config).';
  end if;
  for pt in select * from eventos_ext_participantes where evento_id = p_id order by ordem loop
    v_d := jsonb_build_object(
      'nome', pt.nome, 'membro', pt.registro is not null, 'papel', pt.papel,
      'horas', coalesce(pt.horas, e.horas),
      'evento', jsonb_build_object(
        'codigo', e.codigo, 'nome', e.nome, 'descricao', e.descricao, 'modalidade', e.modalidade,
        'local', e.local, 'data_inicio', e.data_inicio, 'data_fim', e.data_fim,
        'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI')),
      'cidade', c.cidade, 'data', v_hoje, 'texto_instituicao', c.texto_instituicao);
    v := public.doc_emitir('participacao', c.serie_participacao, e.numero, 'Declaração de participação',
                           pt.registro, pt.nome, v_d, e.id, pt.id);
    update eventos_ext_participantes set declaracao = v.codigo where id = pt.id;
    insert into doc_envios (tipo, codigo, registro, para_nome, para_email, assunto, dados)
    values ('participacao', v.codigo, pt.registro, pt.nome, pt.email,
            'Declaração de participação — ' || e.nome,
            jsonb_build_object('evento', e.nome, 'evento_codigo', e.codigo, 'data_inicio', e.data_inicio,
                               'data_fim', e.data_fim, 'local', e.local, 'modalidade', e.modalidade,
                               'horas', coalesce(pt.horas, e.horas), 'papel', pt.papel, 'membro', pt.registro is not null,
                               'documento', v.documento, 'codigo', v.codigo,
                               'url', c.url_validacao || '/?c=' || v.codigo,
                               'href', '#/servicos/eventos/' || e.codigo));
    if pt.registro is not null then
      insert into notificacoes (registro, tipo, titulo, corpo, href, email_em)
      select pt.registro, 'evento_ext',
             'Sua declaração de participação em ' || e.nome || ' está pronta',
             e.codigo || ' foi aprovado. O código verificador da sua declaração é ' || v.codigo || '.',
             '#/servicos/eventos/' || e.codigo, now()
       where exists (select 1 from membros m where m.registro = pt.registro);
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.evento_ext_emitir(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 7d. DECIDIR — aprovar ou devolver. De quem aprova, nunca de quem
--     mandou para aprovação, uma vez por versão. Devolver pede o
--     porquê, e o registro volta a rascunho.
-- ------------------------------------------------------------
create or replace function public.evento_ext_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    uuid := nullif(p->>'id', '')::uuid;
  v_dec   text := p->>'decisao';
  v_par   text := nullif(trim(coalesce(p->>'parecer', '')), '');
  e       public.eventos_ext;
  v_min   integer := coalesce((select aprovacoes_minimas from eventos_ext_config), 2);
  v_n     integer;
  v_avisa integer[];
  v_emit  integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if not public.evento_ext_pode_aprovar() then return jsonb_build_object('status','sem_permissao'); end if;
  if v_dec not in ('aprovar','devolver') then return jsonb_build_object('status','invalido','campo','decisao'); end if;
  if v_dec = 'devolver' and v_par is null then return jsonb_build_object('status','invalido','campo','parecer'); end if;

  select * into e from eventos_ext where id = v_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if e.status <> 'aprovacao' then return jsonb_build_object('status','fora_de_aprovacao'); end if;
  if e.enviado_por = v_reg then return jsonb_build_object('status','propria'); end if;
  if exists (select 1 from eventos_ext_aprovacoes where evento_id = v_id and versao = e.versao
                and registro = v_reg and decisao = 'aprovada') then
    return jsonb_build_object('status','ja_aprovou');
  end if;

  insert into eventos_ext_aprovacoes (evento_id, versao, registro, nome, decisao, parecer)
  values (v_id, e.versao, v_reg, public.doc_meu_nome(),
          case when v_dec = 'aprovar' then 'aprovada' else 'devolvida' end, v_par);
  v_avisa := array_remove(array[e.criado_por, e.enviado_por], null);

  if v_dec = 'devolver' then
    update eventos_ext set status = 'rascunho', motivo = v_par, atualizado_em = now() where id = v_id;
    perform public.evento_ext_hist(v_id, 'devolveu', v_par);
    perform public.notificar(v_avisa, 'evento_ext', e.codigo || ' · ' || e.nome || ' voltou para ajuste',
      public.doc_meu_nome() || ' devolveu: ' || v_par, '#/servicos/eventos/' || e.codigo);
    return jsonb_build_object('status','ok','situacao','rascunho');
  end if;

  select count(distinct registro) into v_n from eventos_ext_aprovacoes
   where evento_id = v_id and versao = e.versao and decisao = 'aprovada';
  perform public.evento_ext_hist(v_id, 'aprovou',
    'Versão ' || e.versao || ' · ' || v_n || ' de ' || v_min || coalesce(' — ' || v_par, ''));
  if v_n < v_min then
    return jsonb_build_object('status','ok','situacao','aprovacao','aprovacoes',v_n,'faltam',v_min - v_n);
  end if;

  update eventos_ext set status = 'aprovado', aprovado_em = now(), atualizado_em = now() where id = v_id;
  v_emit := public.evento_ext_emitir(v_id);
  perform public.evento_ext_hist(v_id, 'emitiu', v_emit || case when v_emit = 1 then ' declaração' else ' declarações' end
    || ' de participação');
  perform public.notificar(v_avisa, 'evento_ext', e.codigo || ' · ' || e.nome || ' foi aprovado',
    'Aprovado por ' || public.doc_meu_nome() || '. As declarações de participação saíram para os '
      || v_emit || ' participantes.', '#/servicos/eventos/' || e.codigo);
  return jsonb_build_object('status','ok','situacao','aprovado','aprovacoes',v_n,'declaracoes',v_emit);
end $$;

-- ------------------------------------------------------------
-- 7e. CANCELAR (antes de aprovado) e REABRIR (depois). Reabrir é
--     corrigir: as declarações emitidas são revogadas — a validação
--     passa a dizer isso —, o registro volta a rascunho numa versão
--     nova e, aprovado de novo, cada um ganha outra.
-- ------------------------------------------------------------
create or replace function public.evento_ext_cancelar(p_id uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  e     public.eventos_ext;
  v_mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into e from eventos_ext where id = p_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.evento_ext_gere(e.criado_por) then return jsonb_build_object('status','sem_permissao'); end if;
  if e.status not in ('rascunho','aprovacao') then return jsonb_build_object('status','fechado'); end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;
  update eventos_ext set status = 'cancelado', motivo = v_mot, atualizado_em = now() where id = p_id;
  perform public.evento_ext_hist(p_id, 'cancelou', v_mot);
  return jsonb_build_object('status','ok','situacao','cancelado');
end $$;

create or replace function public.evento_ext_reabrir(p_id uuid, p_motivo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  e     public.eventos_ext;
  v_mot text := nullif(trim(coalesce(p_motivo, '')), '');
  v_n   integer;
begin
  if not (coalesce(public.papel_atual(), '') in ('admin','pessoal') or public.evento_ext_pode_aprovar()) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  select * into e from eventos_ext where id = p_id for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if e.status <> 'aprovado' then return jsonb_build_object('status','nao_aprovado'); end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;

  update doc_emitidos
     set revogado_em = now(), revogado_nome = public.doc_meu_nome(),
         revogado_motivo = e.codigo || ' reaberto para correção: ' || v_mot
   where evento_id = p_id and revogado_em is null;
  get diagnostics v_n = row_count;
  delete from doc_envios
   where enviado_em is null and codigo in (select codigo from doc_emitidos where evento_id = p_id);
  update eventos_ext_participantes set declaracao = null where evento_id = p_id;
  update eventos_ext
     set status = 'rascunho', versao = versao + 1, aprovado_em = null, motivo = v_mot, atualizado_em = now()
   where id = p_id;
  perform public.evento_ext_hist(p_id, 'reabriu', v_mot || ' · ' || v_n
    || case when v_n = 1 then ' declaração revogada' else ' declarações revogadas' end);
  perform public.notificar(
    array_remove(array[e.criado_por, e.enviado_por], null)
      || array(select registro from eventos_ext_participantes where evento_id = p_id and registro is not null),
    'evento_ext', e.codigo || ' · ' || e.nome || ' foi reaberto para correção',
    'A declaração de participação anterior foi revogada. Aprovado de novo, sai outra. Motivo: ' || v_mot,
    '#/servicos/eventos/' || e.codigo);
  return jsonb_build_object('status','ok','situacao','rascunho','revogadas',v_n);
end $$;

-- Mandar de novo o e-mail de uma declaração — o externo que diz que
-- não recebeu. De quem registrou, de quem aprova e do Depto. de Pessoal.
create or replace function public.evento_ext_reenviar(p_participante uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  pt  public.eventos_ext_participantes;
  e   public.eventos_ext;
  env public.doc_envios;
begin
  select * into pt from eventos_ext_participantes where id = p_participante;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into e from eventos_ext where id = pt.evento_id;
  if not public.evento_ext_ve_emails(e.id) then return jsonb_build_object('status','sem_permissao'); end if;
  if e.status <> 'aprovado' or pt.declaracao is null then return jsonb_build_object('status','nao_aprovado'); end if;
  select * into env from doc_envios where codigo = pt.declaracao order by id desc limit 1;
  if env.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if env.enviado_em is null and env.tentativas < 5 then return jsonb_build_object('status','na_fila'); end if;
  insert into doc_envios (tipo, codigo, registro, para_nome, para_email, assunto, dados)
  values (env.tipo, env.codigo, env.registro, env.para_nome, coalesce(pt.email, env.para_email), env.assunto, env.dados);
  perform public.evento_ext_hist(e.id, 'reenviou', 'E-mail da declaração de ' || pt.nome);
  return jsonb_build_object('status','ok');
end $$;

-- ------------------------------------------------------------
-- 7f. LER — a lista e a página de um evento. As tabelas não se
--     leem direto: é aqui que se decide o que cada um vê.
-- ------------------------------------------------------------
create or replace function public.eventos_ext_lista()
returns table (id uuid, codigo text, numero integer, nome text, modalidade text, local text,
  data_inicio date, data_fim date, horas numeric, status text, versao integer,
  criado_por integer, criado_nome text, enviado_em timestamptz, aprovado_em timestamptz, motivo text,
  participantes integer, nomes text[], aprovacoes integer, aprovacoes_minimas integer,
  eu_participo boolean, minha_declaracao text, posso_aprovar boolean, ja_aprovei boolean)
language plpgsql stable security definer
set search_path = public as $$
#variable_conflict use_column
declare
  v_reg integer := public.portal_registro_atual();
  v_min integer := coalesce((select c.aprovacoes_minimas from eventos_ext_config c), 2);
  v_apr boolean := public.evento_ext_pode_aprovar();
begin
  if v_reg is null and public.papel_atual() not in ('admin','pessoal') then return; end if;
  return query
  select e.id, e.codigo, e.numero, e.nome, e.modalidade, e.local, e.data_inicio, e.data_fim, e.horas,
         e.status, e.versao, e.criado_por, e.criado_nome, e.enviado_em, e.aprovado_em, e.motivo,
         (select count(*)::integer from eventos_ext_participantes p where p.evento_id = e.id),
         array(select p.nome from eventos_ext_participantes p where p.evento_id = e.id order by p.ordem limit 6),
         (select count(distinct a.registro)::integer from eventos_ext_aprovacoes a
           where a.evento_id = e.id and a.versao = e.versao and a.decisao = 'aprovada'),
         v_min,
         exists (select 1 from eventos_ext_participantes p where p.evento_id = e.id and p.registro = v_reg),
         (select p.declaracao from eventos_ext_participantes p where p.evento_id = e.id and p.registro = v_reg),
         (v_apr and e.status = 'aprovacao' and e.enviado_por is distinct from v_reg
            and not exists (select 1 from eventos_ext_aprovacoes a where a.evento_id = e.id and a.versao = e.versao
                              and a.registro = v_reg and a.decisao = 'aprovada')),
         exists (select 1 from eventos_ext_aprovacoes a where a.evento_id = e.id and a.versao = e.versao
                   and a.registro = v_reg and a.decisao = 'aprovada')
    from eventos_ext e
   where public.evento_ext_pode_ver(e.id)
   order by coalesce(e.data_fim, e.data_inicio) desc, e.numero desc;
end $$;

create or replace function public.evento_ext_ler(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  e      public.eventos_ext;
  v_mail boolean;
  v_apr  boolean := public.evento_ext_pode_aprovar();
  v_ger  boolean;
  v_min  integer := coalesce((select aprovacoes_minimas from eventos_ext_config), 2);
  v_n    integer;
begin
  select * into e from eventos_ext
   where codigo = upper(trim(coalesce(p_codigo, ''))) or id::text = trim(coalesce(p_codigo, ''));
  if not found or not public.evento_ext_pode_ver(e.id) then return jsonb_build_object('status','nao_encontrado'); end if;
  v_mail := public.evento_ext_ve_emails(e.id);
  v_ger  := public.evento_ext_gere(e.criado_por);
  select count(distinct registro) into v_n from eventos_ext_aprovacoes
   where evento_id = e.id and versao = e.versao and decisao = 'aprovada';
  return jsonb_build_object('status','ok',
    'evento', to_jsonb(e) || jsonb_build_object('hora_inicio', to_char(e.hora_inicio, 'HH24:MI'),
                                                'hora_fim', to_char(e.hora_fim, 'HH24:MI')),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', p.id, 'registro', p.registro, 'nome', p.nome,
        'email', case when v_mail or p.registro = v_reg then p.email end,
        'papel', p.papel, 'horas', p.horas, 'declaracao',
        case when v_mail or p.registro = v_reg then p.declaracao end,
        'enviado_em', case when v_mail then (select max(d.enviado_em) from doc_envios d where d.codigo = p.declaracao) end,
        'envio_erro', case when v_mail then (select d.erro from doc_envios d where d.codigo = p.declaracao
                                               order by d.id desc limit 1) end)
        order by p.ordem) from eventos_ext_participantes p where p.evento_id = e.id), '[]'::jsonb),
    'aprovacoes', coalesce((select jsonb_agg(jsonb_build_object('versao', a.versao, 'registro', a.registro, 'nome', a.nome,
        'decisao', a.decisao, 'parecer', a.parecer, 'criado_em', a.criado_em) order by a.criado_em)
        from eventos_ext_aprovacoes a where a.evento_id = e.id), '[]'::jsonb),
    'historico', coalesce((select jsonb_agg(jsonb_build_object('nome', h.nome, 'acao', h.acao, 'detalhe', h.detalhe,
        'criado_em', h.criado_em) order by h.criado_em, h.id)
        from eventos_ext_historico h where h.evento_id = e.id), '[]'::jsonb),
    'aprovacoes_validas', v_n, 'aprovacoes_minimas', v_min,
    'pode', jsonb_build_object(
      'editar',   v_ger and e.status in ('rascunho','aprovacao'),
      'enviar',   v_ger and e.status = 'rascunho' and v_reg is not null,
      'cancelar', v_ger and e.status in ('rascunho','aprovacao'),
      'aprovar',  v_apr and e.status = 'aprovacao' and e.enviado_por is distinct from v_reg and v_reg is not null
                  and not exists (select 1 from eventos_ext_aprovacoes a where a.evento_id = e.id and a.versao = e.versao
                                    and a.registro = v_reg and a.decisao = 'aprovada'),
      'reabrir',  (v_apr or coalesce(public.papel_atual(), '') in ('admin','pessoal')) and e.status = 'aprovado',
      'emails',   v_mail,
      'declaracoes', v_mail));
end $$;

-- Quantos eventos esperam a MINHA aprovação — para o início e o menu.
create or replace function public.eventos_ext_pendentes()
returns integer language sql stable security definer
set search_path = public as $$
  select case when not public.evento_ext_pode_aprovar() or public.portal_registro_atual() is null then 0 else
    (select count(*)::integer from eventos_ext e
      where e.status = 'aprovacao' and e.enviado_por is distinct from public.portal_registro_atual()
        and not exists (select 1 from eventos_ext_aprovacoes a where a.evento_id = e.id and a.versao = e.versao
                          and a.registro = public.portal_registro_atual() and a.decisao = 'aprovada')) end;
$$;

-- ============================================================
-- 8. OS E-MAILS DAS DECLARAÇÕES
--    Uma fila à parte da das notificações: quem recebe aqui pode não
--    ter conta (o externo), e o e-mail é a entrega de um documento —
--    sai sempre, qualquer que seja a preferência de e-mail da pessoa.
--    O notificar-email lê o lote e dá baixa, como faz com o sino.
-- ------------------------------------------------------------

create or replace function public.doc_envios_lote(p_limite integer default 100)
returns jsonb language sql stable security definer
set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'tipo', q.tipo, 'para_nome', q.para_nome, 'para_email', q.email,
           'assunto', q.assunto, 'dados', q.dados) order by q.id), '[]'::jsonb)
    from (select v.*, coalesce(nullif(v.para_email, ''), nullif(m.email_nro, ''), nullif(m.email_pessoal, '')) as email
            from doc_envios v
            left join membros m on m.registro = v.registro
            left join doc_emitidos d on d.codigo = v.codigo
           where v.enviado_em is null and v.tentativas < 5
             and (d.codigo is null or d.revogado_em is null)
             and coalesce(nullif(v.para_email, ''), nullif(m.email_nro, ''), nullif(m.email_pessoal, '')) is not null
           order by v.id
           limit greatest(coalesce(p_limite, 100), 1)) q;
$$;

create or replace function public.doc_envios_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_ok  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(
                               coalesce(p->'enviados', '[]'::jsonb)) x), '{}');
  v_er  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(
                               coalesce(p->'falhas', '[]'::jsonb)) x), '{}');
  v_msg text := left(coalesce(p->>'erro', ''), 500);
  v_n   integer := 0;
begin
  update doc_envios set enviado_em = now(), erro = null where id = any(v_ok) and enviado_em is null;
  get diagnostics v_n = row_count;
  update doc_envios set tentativas = tentativas + 1, erro = nullif(v_msg, '')
   where id = any(v_er) and enviado_em is null;
  return jsonb_build_object('status','ok','enviados',v_n);
end $$;

revoke execute on function public.doc_envios_lote(integer) from public, anon, authenticated;
revoke execute on function public.doc_envios_baixa(jsonb)  from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.doc_envios_lote(integer) to service_role;
    grant execute on function public.doc_envios_baixa(jsonb)  to service_role;
  end if;
end $$;

-- ============================================================
-- 9. A SEGUNDA VIA, A LISTA E A REVOGAÇÃO
-- ------------------------------------------------------------
-- A emissão inteira, para desenhar de novo o mesmo documento (mesmo
-- código, mesma data). Do titular, de quem emitiu, do Depto. de
-- Pessoal — e, numa de participação, de quem registrou o evento e de
-- quem aprova.
create or replace function public.doc_emitido_ler(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare d public.doc_emitidos;
begin
  select * into d from doc_emitidos where codigo = public.doc_normalizar_verificador(p_codigo);
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not coalesce(d.registro = public.portal_registro_atual()
                   or d.emitido_por = public.portal_registro_atual()
                   or coalesce(public.papel_atual(), '') in ('admin','pessoal')
                   or (d.tipo = 'participacao' and d.evento_id is not null and public.evento_ext_ve_emails(d.evento_id)),
                   false) then
    return jsonb_build_object('status','nao_encontrado');
  end if;
  return jsonb_build_object('status','ok') || public.doc_emitido_json(d, false);
end $$;

-- As emissões de uma pessoa (a própria, ou qualquer uma para o Depto.
-- de Pessoal): a tela da declaração lista, com quantas vezes cada uma
-- foi conferida.
create or replace function public.doc_emitidos_de(p_registro integer default null)
returns table (codigo text, tipo text, documento text, revisao text, titulo text, titular text,
  emitido_em timestamptz, emitido_nome text, revogado_em timestamptz, revogado_motivo text,
  consultas integer, consultado_em timestamptz, evento_codigo text)
language plpgsql stable security definer
set search_path = public as $$
#variable_conflict use_column
declare v_reg integer := coalesce(p_registro, public.portal_registro_atual());
begin
  if not public.doc_vinculo_pode(v_reg) then return; end if;
  return query
  select d.codigo, d.tipo, d.documento, d.revisao, d.titulo, d.titular, d.emitido_em, d.emitido_nome,
         d.revogado_em, d.revogado_motivo, d.consultas, d.consultado_em, e.codigo
    from doc_emitidos d left join eventos_ext e on e.id = d.evento_id
   where d.registro = v_reg
   order by d.emitido_em desc;
end $$;

-- Revogar uma emissão: o Depto. de Pessoal, qualquer uma; o titular, a
-- própria declaração de vínculo (emitiu errado, emite outra). A de
-- participação se revoga reabrindo o evento.
create or replace function public.doc_emitido_revogar(p_codigo text, p_motivo text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  d     public.doc_emitidos;
  v_mot text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  select * into d from doc_emitidos where codigo = public.doc_normalizar_verificador(p_codigo) for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not coalesce(coalesce(public.papel_atual(), '') in ('admin','pessoal')
                   or (d.tipo = 'vinculo' and d.registro = public.portal_registro_atual()), false) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if d.revogado_em is not null then return jsonb_build_object('status','ja_revogado'); end if;
  if v_mot is null then return jsonb_build_object('status','invalido','campo','motivo'); end if;
  update doc_emitidos set revogado_em = now(), revogado_nome = public.doc_meu_nome(), revogado_motivo = v_mot
   where codigo = d.codigo;
  return jsonb_build_object('status','ok');
end $$;

-- ============================================================
-- 10. PERMISSÕES, AUDITORIA E REGISTRO
-- ------------------------------------------------------------
do $$
declare f text;
begin
  foreach f in array array[
    'doc_vinculo_pode(integer)', 'doc_vinculo_previa(integer)', 'doc_vinculo_emitir(integer)',
    'doc_emitido_ler(text)', 'doc_emitidos_de(integer)', 'doc_emitido_revogar(text,text)',
    'evento_ext_pode_aprovar()', 'evento_ext_pode_ver(uuid)', 'evento_ext_ve_emails(uuid)',
    'evento_ext_salvar(jsonb)', 'evento_ext_enviar(uuid)', 'evento_ext_decidir(jsonb)',
    'evento_ext_cancelar(uuid,text)', 'evento_ext_reabrir(uuid,text)', 'evento_ext_reenviar(uuid)',
    'eventos_ext_lista()', 'evento_ext_ler(text)', 'eventos_ext_pendentes()']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_doc_emissao_config on public.doc_emissao_config';
    execute 'create trigger tg_aud_doc_emissao_config after update on public.doc_emissao_config
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_eventos_ext_config on public.eventos_ext_config';
    execute 'create trigger tg_aud_eventos_ext_config after update on public.eventos_ext_config
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_eventos_ext on public.eventos_ext';
    execute 'create trigger tg_aud_eventos_ext after insert or update or delete on public.eventos_ext
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v25_documentos_eventos', 'Documentos emitidos pelo SOMA com código verificador e validação pública (auth.neurodynamics.dev): a declaração de vínculo sob demanda (NRO-DIR-004, o PN é o registro do membro) e o registro de eventos (EXT-N) com aprovação por grupos, declaração de participação e o e-mail aos participantes')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select x.item as "o que a 25.0 deixou", x.valor
  from (values
    (1, 'declaração de vínculo', (select public.doc_codigo(s.prefixo, s.sn, null) || ' — ' || s.titulo
                                    from doc_series s where s.id = (select serie_vinculo from doc_emissao_config))),
    (2, 'declaração de participação', (select public.doc_codigo(s.prefixo, s.sn, null) || ' — ' || s.titulo
                                    from doc_series s where s.id = (select serie_participacao from doc_emissao_config))),
    (3, 'aprovam os eventos', coalesce((select string_agg(g.nome, ', ' order by g.nome) from grupos g
                                 where g.id = any(coalesce((select grupos_aprovadores from eventos_ext_config), '{}'::integer[]))),
                                 'admin (nenhum grupo escolhido)')),
    (4, 'aprovações por evento', (select aprovacoes_minimas::text from eventos_ext_config)),
    (5, 'validação em', (select url_validacao from doc_emissao_config))
  ) as x(ordem, item, valor)
 order by x.ordem;

-- ============================================================
-- FIM — SOMA 25.0
--
-- Depois de rodar:
--   1) publique o auth.neurodynamics.dev (a pasta auth/ deste
--      repositório; o passo a passo está no README dela);
--   2) republique a Edge Function notificar-email — é ela que manda
--      o e-mail das declarações de participação;
--   3) em Serviços › Eventos › Configurações, confira quem aprova
--      (a semente é o Depto. de Pessoal) e quantas aprovações bastam;
--   4) no NRO-DIR-004, quando a revisão do template que corresponde ao
--      modelo gerado pelo SOMA for aprovada, as declarações passam a
--      sair com a letra dela.
-- ============================================================
