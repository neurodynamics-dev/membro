-- ============================================================
-- SOMA 28.0 — MIGRAÇÃO · NeuroDynamics
-- A AGENDA, NO MODELO DO GOOGLE AGENDA.
--
-- A agenda deixa de ser um sistema de preparação de eventos
-- (checklist por tipo, dossiê, presença, ata) e passa a ser o que
-- uma agenda é: o evento, os convidados, a resposta de cada um e o
-- lembrete.
--
--   1. EVENTOS: data de fim (evento de vários dias), cor própria,
--      lembretes e o evento predefinido de onde saiu.
--   2. CONVIDADOS: cada convite tem um token, que responde pelo
--      e-mail sem login (agenda_rsvp_token); convidado de fora da
--      equipe (evento_externos), só com o e-mail.
--   3. EVENTOS PREDEFINIDOS (agenda_predefinidos): reunião geral,
--      reunião de gerência, reunião com stakeholder… com duração,
--      local, grupos convidados e lembretes. Configuração, não
--      código: a gestão cria e muda em Agenda › Configurações.
--   4. E-MAIL (agenda_envios): convite, alteração, cancelamento e
--      lembrete. A mesma função notificar-email entrega a fila, com
--      os botões Vou / Talvez / Não vou.
--   5. UMA PORTA DE ESCRITA: agenda_evento_salvar (criar, editar,
--      reagendar, este ou os seguintes da série), agenda_evento_excluir
--      e agenda_responder. A leitura de um evento é agenda_evento.
--
-- O que sai: o checklist por tipo, o dossiê, a presença por evento e
-- as cerimônias de scrum deixam de ser lidos e escritos pelo portal.
-- As tabelas ficam (evento_checklist, agenda_scrum, evento_tipos),
-- com o que já foi registrado; o rodapé traz como apagar de vez.
--
-- Pré-requisitos: SOMA 13.0 (agenda unificada), 15.0 (grupos e
-- notificações), 16.0 (e-mail) e 19.0 (árvore de grupos).
-- Idempotente. COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.eventos') is null or to_regclass('public.evento_participantes') is null then
    raise exception using message = 'Este banco não parece ser o do SOMA: falta public.eventos.';
  end if;
  if to_regprocedure('public.agenda_itens(date,date)') is null then
    raise exception using message = 'Falta aplicar a SOMA 13.0 (db/aplicadas/soma_v13_agenda_unificada.sql).';
  end if;
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a 19.0 (db/v19_grupos_hierarquia.sql).';
  end if;
  if to_regclass('public.notificacoes') is null then
    raise exception using message = 'Falta aplicar a 15.0 (db/v15_atividades.sql).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. EVENTOS — colunas novas
-- ------------------------------------------------------------
alter table public.eventos add column if not exists data_fim       date;
alter table public.eventos add column if not exists cor            text;
alter table public.eventos add column if not exists lembretes      integer[] not null default '{}';
alter table public.eventos add column if not exists predefinido_id uuid;
alter table public.eventos add column if not exists atualizado_em  timestamptz not null default now();

comment on column public.eventos.data_fim is
  'Último dia de um evento de vários dias. Vazio = o mesmo dia de "data".';
comment on column public.eventos.lembretes is
  'Minutos antes do início em que cada convidado (que não recusou) recebe o lembrete por e-mail. '
  'Evento de dia inteiro conta a partir das 9h do dia.';

-- ------------------------------------------------------------
-- 2. CONVIDADOS — o token de cada convite e os de fora
-- ------------------------------------------------------------
alter table public.evento_participantes add column if not exists token        uuid;
alter table public.evento_participantes add column if not exists convidado_em timestamptz;
update public.evento_participantes set token = gen_random_uuid() where token is null;
alter table public.evento_participantes alter column token set default gen_random_uuid();
alter table public.evento_participantes alter column token set not null;
create unique index if not exists idx_evpart_token on public.evento_participantes (token);

create table if not exists public.evento_externos (
  id            uuid primary key default gen_random_uuid(),
  evento_id     uuid not null references public.eventos(id) on delete cascade,
  email         text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'),
  nome          text,
  resposta      text not null default 'pendente' check (resposta in ('pendente','vou','talvez','nao')),
  respondido_em timestamptz,
  token         uuid not null default gen_random_uuid(),
  convidado_em  timestamptz not null default now()
);
create unique index if not exists idx_evext_email on public.evento_externos (evento_id, lower(email));
create unique index if not exists idx_evext_token on public.evento_externos (token);
alter table public.evento_externos enable row level security;
-- sem política: quem lê e escreve são as funções abaixo

-- ------------------------------------------------------------
-- 3. EVENTOS PREDEFINIDOS
--    O que cada tipo de evento traz pronto ao ser escolhido. Nasce
--    dos tipos que já existiam (evento_tipos), sem o checklist.
-- ------------------------------------------------------------
create table if not exists public.agenda_predefinidos (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null unique check (length(trim(nome)) > 0),
  titulo        text,                                   -- vazio = o nome
  duracao_min   integer not null default 60 check (duracao_min between 5 and 1440),
  dia_inteiro   boolean not null default false,
  hora_inicio   time,                                   -- a hora sugerida; vazio = a hora escolhida na grade
  local         text,
  espaco_id     integer,
  meet_url      text,
  descricao     text,
  visibilidade  text not null default 'convidados' check (visibilidade in ('equipe','convidados','privado')),
  cor           text not null default '#2DD4BF' check (cor ~* '^#[0-9a-f]{6}$'),
  todos         boolean not null default false,          -- toda a equipe ativa
  grupos        integer[] not null default '{}',         -- os grupos convidados (e quem está abaixo deles)
  convidados    integer[] not null default '{}',         -- pessoas convidadas sempre
  lembretes     integer[] not null default '{30}',
  recorrencia   text not null default 'Única',
  ordem         integer not null default 100,
  ativo         boolean not null default true,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
alter table public.agenda_predefinidos enable row level security;
drop policy if exists agpred_select on public.agenda_predefinidos;
create policy agpred_select on public.agenda_predefinidos for select to authenticated using (true);
drop policy if exists agpred_write on public.agenda_predefinidos;
create policy agpred_write on public.agenda_predefinidos for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));
grant select, insert, update, delete on public.agenda_predefinidos to authenticated;

do $$
begin
  if to_regclass('public.evento_tipos') is not null then
    insert into public.agenda_predefinidos (nome, cor, visibilidade, todos, ordem, lembretes, duracao_min)
    select t.nome, case when t.cor ~* '^#[0-9a-f]{6}$' then t.cor else '#2DD4BF' end,
           t.visibilidade, t.convida_todos, t.ordem,
           case when t.nome in ('Reunião geral','Confraternização','Visita de externos','Reunião com stakeholder')
                then '{1440,60}'::integer[] else '{30}'::integer[] end,
           case when t.categoria = 'scrum' then 15 when t.categoria in ('trabalho','viagem') then 240 else 60 end
      from public.evento_tipos t
     where t.ativo and t.nome <> 'Cerimônia de Scrum'
    on conflict (nome) do nothing;
  end if;
end $$;

insert into public.agenda_predefinidos (nome, cor, visibilidade, todos, ordem, lembretes, duracao_min)
values ('Reunião geral', '#2DD4BF', 'equipe', true, 10, '{1440,60}', 120),
       ('Reunião de gerência', '#CEDC00', 'convidados', false, 20, '{30}', 60),
       ('Reunião com stakeholder', '#CEDC00', 'convidados', false, 30, '{1440,60}', 60)
on conflict (nome) do nothing;

alter table public.eventos drop constraint if exists eventos_predefinido_fk;
alter table public.eventos add constraint eventos_predefinido_fk
  foreign key (predefinido_id) references public.agenda_predefinidos(id) on delete set null;

-- ------------------------------------------------------------
-- 4. PREFERÊNCIAS DE CADA UM
-- ------------------------------------------------------------
create table if not exists public.agenda_preferencias (
  registro        integer primary key references public.membros(registro) on delete cascade,
  emails          boolean not null default true,        -- convites, alterações e lembretes por e-mail
  lembretes       integer[] not null default '{30}',    -- o padrão de um evento novo
  atualizado_em   timestamptz not null default now()
);
alter table public.agenda_preferencias enable row level security;
drop policy if exists agpref_proprio on public.agenda_preferencias;
create policy agpref_proprio on public.agenda_preferencias for all to authenticated
  using (registro = public.portal_registro_atual())
  with check (registro = public.portal_registro_atual());
grant select, insert, update on public.agenda_preferencias to authenticated;

-- ------------------------------------------------------------
-- 5. A FILA DE E-MAIL DA AGENDA
-- ------------------------------------------------------------
create table if not exists public.agenda_envios (
  id            bigserial primary key,
  evento_id     uuid references public.eventos(id) on delete cascade,
  tipo          text not null check (tipo in ('convite','alteracao','cancelamento','lembrete')),
  chave         text not null default '',               -- o lembrete: "<minutos>@<data>"
  para_registro integer references public.membros(registro) on delete cascade,
  para_email    text not null,
  para_nome     text,
  token         uuid,                                   -- o do convite de quem recebe: os botões respondem por ele
  resposta      text,
  assunto       text not null,
  dados         jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  enviado_em    timestamptz,
  tentativas    smallint not null default 0,
  erro          text
);
create unique index if not exists idx_agenv_lembrete
  on public.agenda_envios (evento_id, lower(para_email), chave) where tipo = 'lembrete';
create index if not exists idx_agenv_fila on public.agenda_envios (id) where enviado_em is null;
alter table public.agenda_envios enable row level security;

-- ------------------------------------------------------------
-- 6. AJUDANTES
-- ------------------------------------------------------------
create or replace function public.agenda_gestor() returns boolean
language sql stable as $$ select public.papel_atual() in ('admin','pessoal') $$;

-- Quem vê um evento: da equipe, todo mundo; os outros, quem organiza,
-- quem foi convidado e a gestão.
create or replace function public.agenda_pode_ver(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from eventos e
     where e.id = p_id
       and ( coalesce(e.visibilidade,'convidados') = 'equipe'
          or public.agenda_gestor()
          or e.owner_registro = public.portal_registro_atual()
          or exists (select 1 from evento_participantes p
                      where p.evento_id = e.id and p.registro = public.portal_registro_atual())));
$$;

-- O início do evento no fuso da equipe. Dia inteiro conta das 9h.
create or replace function public.agenda_inicio(p_data date, p_hora time) returns timestamptz
language sql immutable as $$
  select ((p_data + coalesce(p_hora, time '09:00'))::timestamp at time zone 'America/Sao_Paulo')
$$;

-- "sábado, 26 de setembro de 2026, das 9h às 11h"
create or replace function public.agenda_quando(p_data date, p_fim date, p_hi time, p_hf time) returns text
language sql immutable as $$
  select
    (array['domingo','segunda-feira','terça-feira','quarta-feira','quinta-feira','sexta-feira','sábado'])[extract(dow from p_data)::int + 1]
    || ', ' || extract(day from p_data)::int || ' de '
    || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from p_data)::int]
    || ' de ' || extract(year from p_data)::int
    || case
         when p_fim is not null and p_fim > p_data then
           ' a ' || extract(day from p_fim)::int || ' de '
           || (array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'])[extract(month from p_fim)::int]
         else '' end
    || case
         when p_hi is null then ', dia inteiro'
         when p_hf is null then ', às ' || to_char(p_hi, 'HH24:MI')
         else ', das ' || to_char(p_hi, 'HH24:MI') || ' às ' || to_char(p_hf, 'HH24:MI') end
$$;

-- O que vai no e-mail sobre um evento.
create or replace function public.agenda_dados(p_id uuid, p_mudou text default null) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'evento_id', e.id, 'numero', e.numero, 'titulo', e.titulo,
    'data', e.data, 'data_fim', e.data_fim, 'hora_inicio', to_char(e.hora_inicio,'HH24:MI'),
    'hora_fim', to_char(e.hora_fim,'HH24:MI'),
    'quando', public.agenda_quando(e.data, e.data_fim, e.hora_inicio, e.hora_fim),
    'local', coalesce(esp.nome, e.local), 'meet_url', e.meet_url, 'descricao', e.pauta,
    'recorrencia', coalesce(e.recorrencia,'Única'),
    'organizador', (select nome from membros where registro = e.owner_registro),
    'href', '#/agenda/evento/' || e.id, 'mudou', p_mudou)
    from eventos e left join espacos esp on esp.id = e.espaco_id
   where e.id = p_id;
$$;

-- Põe na fila os e-mails de um evento. Membro: o e-mail da ficha,
-- se ele não desligou os e-mails da agenda; quem agiu não recebe.
create or replace function public.agenda_enfileirar(
  p_id uuid, p_tipo text, p_regs integer[], p_externos uuid[], p_mudou text default null
) returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_dados jsonb := public.agenda_dados(p_id, p_mudou);
  v_eu    integer := public.portal_registro_atual();
  v_ass   text;
  v_n     integer := 0;
  v_k     integer;
begin
  if v_dados is null then return 0; end if;
  v_ass := case p_tipo
    when 'convite'      then 'Convite: '
    when 'alteracao'    then 'Evento alterado: '
    when 'cancelamento' then 'Evento cancelado: '
    else 'Lembrete: ' end || (v_dados->>'titulo') || ' · ' || (v_dados->>'quando');

  insert into agenda_envios (evento_id, tipo, para_registro, para_email, para_nome, token, resposta, assunto, dados)
  select p_id, p_tipo, m.registro, coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')), m.nome,
         p.token, p.resposta, v_ass, v_dados
    from evento_participantes p
    join membros m on m.registro = p.registro
    left join agenda_preferencias ap on ap.registro = p.registro
   where p.evento_id = p_id
     and p.registro = any(coalesce(p_regs, '{}'))
     and p.registro is distinct from v_eu
     and coalesce(ap.emails, true)
     and coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) is not null;
  get diagnostics v_k = row_count; v_n := v_n + v_k;

  insert into agenda_envios (evento_id, tipo, para_email, para_nome, token, resposta, assunto, dados)
  select p_id, p_tipo, x.email, x.nome, x.token, x.resposta, v_ass, v_dados
    from evento_externos x
   where x.evento_id = p_id and x.id = any(coalesce(p_externos, '{}'));
  get diagnostics v_k = row_count; v_n := v_n + v_k;
  return v_n;
end $$;
revoke execute on function public.agenda_enfileirar(uuid, text, integer[], uuid[], text) from public, anon, authenticated;

-- A notificação do sino que acompanha o e-mail da agenda. Nasce com o
-- e-mail dado por enviado: o e-mail da agenda já leva o convite, e o
-- resumo do sino não repete.
create or replace function public.agenda_sino(p_regs integer[], p_tipo text, p_titulo text, p_corpo text, p_href text)
returns void language sql volatile security definer set search_path = public as $$
  insert into notificacoes (registro, tipo, titulo, corpo, href, email_em)
  select distinct r, p_tipo, p_titulo, p_corpo, p_href, now()
    from unnest(coalesce(p_regs,'{}')) r
   where r is not null and r <> coalesce(public.portal_registro_atual(), -1);
$$;
revoke execute on function public.agenda_sino(integer[], text, text, text, text) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 7. RECORRÊNCIA — as ocorrências existem de verdade
--    Como na 13.0, mais: todos os dias, dias úteis e anual, e as
--    colunas novas (cor, lembretes, fim, convidados de fora).
-- ------------------------------------------------------------
create or replace function public.agenda_gerar_serie(p_serie uuid, p_ate date)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_base   public.eventos%rowtype;
  v_ultima date;
  v_limite date;
  v_data   date;
  v_novo   uuid;
  v_k      integer := 1;
  v_n      integer := 0;
  v_rec    text;
  v_dur    integer;
begin
  select * into v_base from eventos where serie_id = p_serie order by data limit 1;
  if not found then return 0; end if;
  v_rec := coalesce(v_base.recorrencia, 'Única');
  if v_rec not in ('Diária','Dias úteis','Semanal','Quinzenal','Mensal','Anual') then return 0; end if;
  v_dur := coalesce(v_base.data_fim - v_base.data, 0);

  select max(data) into v_ultima from eventos where serie_id = p_serie;
  v_limite := least(p_ate, coalesce(v_base.serie_ate, p_ate));

  loop
    v_data := case v_rec
      when 'Diária'     then v_base.data + v_k
      when 'Dias úteis' then v_base.data + v_k
      when 'Semanal'    then v_base.data + 7 * v_k
      when 'Quinzenal'  then v_base.data + 14 * v_k
      when 'Mensal'     then (v_base.data + make_interval(months => v_k))::date
      else                   (v_base.data + make_interval(years => v_k))::date end;
    v_k := v_k + 1;
    exit when v_data > v_limite or v_k > 800 or v_n >= 300;
    continue when v_data <= v_ultima;
    continue when v_rec = 'Dias úteis' and extract(isodow from v_data) > 5;

    insert into eventos (titulo, tipo, data, data_fim, hora, hora_inicio, hora_fim, espaco_id, local,
      recorrencia, owner_registro, grupos, pauta, status, criado_por,
      categoria, visibilidade, serie_id, serie_ate, meet_url, cor, lembretes, predefinido_id)
    values (v_base.titulo, v_base.tipo, v_data, case when v_dur > 0 then v_data + v_dur end,
      v_base.hora, v_base.hora_inicio, v_base.hora_fim, v_base.espaco_id, v_base.local,
      v_base.recorrencia, v_base.owner_registro, v_base.grupos, v_base.pauta, 'Preparação', v_base.criado_por,
      v_base.categoria, v_base.visibilidade, p_serie, v_base.serie_ate, v_base.meet_url,
      v_base.cor, v_base.lembretes, v_base.predefinido_id)
    returning id into v_novo;

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select v_novo, x.registro, x.origem, coalesce(x.papel,'obrigatorio'),
           case when x.registro = v_base.owner_registro then 'vou' else 'pendente' end,
           case when x.registro = v_base.owner_registro then now() else null end, now()
      from evento_participantes x where x.evento_id = v_base.id;
    insert into evento_externos (evento_id, email, nome)
    select v_novo, x.email, x.nome from evento_externos x where x.evento_id = v_base.id;

    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.agenda_gerar_serie(uuid, date) from public, anon;
grant  execute on function public.agenda_gerar_serie(uuid, date) to authenticated;

create or replace function public.agenda_manter_series(p_dias integer default 120)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct e.serie_id from eventos e
     where e.serie_id is not null and coalesce(e.recorrencia,'Única') <> 'Única'
       and coalesce(e.status,'') <> 'Cancelado'
       and (e.serie_ate is null or e.serie_ate >= current_date)
  loop
    v_n := v_n + public.agenda_gerar_serie(r.serie_id, current_date + p_dias);
  end loop;
  return v_n;
end $$;
revoke execute on function public.agenda_manter_series(integer) from public, anon;
grant  execute on function public.agenda_manter_series(integer) to authenticated;

-- ------------------------------------------------------------
-- 8. LER UM EVENTO — a página #/agenda/evento/<id>
-- ------------------------------------------------------------
create or replace function public.agenda_evento(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  e       public.eventos%rowtype;
  v_eu    integer := public.portal_registro_atual();
  v_ed    boolean;
begin
  select * into e from eventos where id = p_id;
  if not found or not public.agenda_pode_ver(p_id) then return jsonb_build_object('status','nao_encontrado'); end if;
  v_ed := public.agenda_gestor() or (v_eu is not null and e.owner_registro = v_eu);
  return jsonb_build_object(
    'status', 'ok',
    'evento', jsonb_build_object(
      'id', e.id, 'numero', e.numero, 'titulo', e.titulo, 'tipo', e.tipo,
      'data', e.data, 'data_fim', e.data_fim, 'hora_inicio', to_char(e.hora_inicio,'HH24:MI'),
      'hora_fim', to_char(e.hora_fim,'HH24:MI'), 'local', e.local, 'espaco_id', e.espaco_id,
      'espaco', (select nome from espacos where id = e.espaco_id),
      'meet_url', e.meet_url, 'descricao', e.pauta, 'visibilidade', coalesce(e.visibilidade,'convidados'),
      'cor', coalesce(nullif(e.cor,''), (select cor from agenda_predefinidos where id = e.predefinido_id),
                      (select cor from evento_tipos where nome = e.tipo), '#2DD4BF'),
      'cor_propria', nullif(e.cor,''),
      'lembretes', to_jsonb(coalesce(e.lembretes,'{}')), 'predefinido_id', e.predefinido_id,
      'recorrencia', coalesce(e.recorrencia,'Única'), 'serie_id', e.serie_id, 'serie_ate', e.serie_ate,
      'grupos', to_jsonb(coalesce(e.grupos,'{}')), 'owner_registro', e.owner_registro,
      'organizador', (select nome from membros where registro = e.owner_registro),
      'cancelado', coalesce(e.status,'') = 'Cancelado'),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', p.registro, 'nome', m.nome, 'papel', coalesce(p.papel,'obrigatorio'),
        'resposta', coalesce(p.resposta,'pendente'), 'respondido_em', p.respondido_em)
        order by (p.registro = e.owner_registro) desc, m.nome)
      from evento_participantes p join membros m on m.registro = p.registro where p.evento_id = e.id), '[]'::jsonb),
    'externos', case when v_ed then coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'email', x.email, 'nome', x.nome, 'resposta', x.resposta) order by x.email)
      from evento_externos x where x.evento_id = e.id), '[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('nome', coalesce(x.nome, split_part(x.email,'@',1)),
        'resposta', x.resposta)) from evento_externos x where x.evento_id = e.id), '[]'::jsonb) end,
    'minha_resposta', (select resposta from evento_participantes where evento_id = e.id and registro = v_eu),
    'pode_editar', v_ed,
    'ocorrencias', case when e.serie_id is null then 0 else
      (select count(*) from eventos where serie_id = e.serie_id and coalesce(status,'') <> 'Cancelado') end);
end $$;
revoke execute on function public.agenda_evento(uuid) from public, anon;
grant  execute on function public.agenda_evento(uuid) to authenticated;

-- ------------------------------------------------------------
-- 9. SALVAR — criar, editar, reagendar
--    Campos (todos opcionais na edição; só vem o que mudou):
--      id, titulo, data, data_fim, hora_inicio, hora_fim (vazios = dia
--      inteiro), local, espaco_id, meet_url, descricao, visibilidade,
--      cor, predefinido_id, recorrencia, repetir_ate, lembretes[],
--      obrigatorios[], opcionais[], grupos[] (ids), todos, externos
--      [{email,nome}], aplicar ('este' | 'seguintes'), notificar.
--    A lista de convidados, quando vem, é a lista inteira: quem sai
--    recebe o cancelamento; quem entra, o convite.
-- ------------------------------------------------------------
create or replace function public.agenda_evento_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_eu      integer := public.portal_registro_atual();
  v_gestor  boolean := public.agenda_gestor();
  v_quem    text;
  v_ev      public.eventos%rowtype;
  v_id      uuid := nullif(p->>'id','')::uuid;
  v_novo    boolean := v_id is null;
  v_pd      public.agenda_predefinidos%rowtype;
  v_data    date;  v_fim date;  v_hi time;  v_hf time;  v_ate date;
  v_rec     text;
  v_vis     text;
  v_tit     text;
  v_lemb    integer[];
  v_gids    integer[];
  v_gnomes  text[];
  v_obrig   integer[];
  v_opc     integer[];
  v_todos   integer[];
  v_ids     uuid[];
  v_serie   boolean := coalesce(p->>'aplicar','este') = 'seguintes';
  v_delta   integer := 0;
  v_notif   boolean := coalesce((p->>'notificar')::boolean, true);
  v_antes   integer[];
  v_entram  integer[] := '{}';
  v_saem    integer[] := '{}';
  v_ext_in  uuid[] := '{}';
  v_ext_sai uuid[] := '{}';
  v_ext_fic uuid[] := '{}';
  v_mudou   text[] := '{}';
  v_ocor    integer := 0;
  v_recmud  boolean := false;
begin
  if v_eu is null then return jsonb_build_object('status','sem_vinculo'); end if;
  select nome into v_quem from membros where registro = v_eu;

  if not v_novo then
    select * into v_ev from eventos where id = v_id;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    if not (v_gestor or v_ev.owner_registro = v_eu) then return jsonb_build_object('status','sem_permissao'); end if;
  elsif not exists (select 1 from membros where registro = v_eu and status in ('Ativo','Em pausa / avaliação','Sob demanda')) then
    return jsonb_build_object('status','sem_vinculo');
  end if;

  if nullif(p->>'predefinido_id','') is not null then
    select * into v_pd from agenda_predefinidos where id = (p->>'predefinido_id')::uuid;
  end if;

  -- datas e horas
  begin
    v_data := coalesce(nullif(p->>'data','')::date, v_ev.data);
    v_fim  := case when p ? 'data_fim' then nullif(p->>'data_fim','')::date else v_ev.data_fim end;
    v_hi   := case when p ? 'hora_inicio' then nullif(p->>'hora_inicio','')::time else v_ev.hora_inicio end;
    v_hf   := case when p ? 'hora_fim' then nullif(p->>'hora_fim','')::time else v_ev.hora_fim end;
    v_ate  := case when p ? 'repetir_ate' then nullif(p->>'repetir_ate','')::date else v_ev.serie_ate end;
  exception when others then
    return jsonb_build_object('status','invalido','campo','data');
  end;
  if coalesce((p->>'dia_inteiro')::boolean, false) then v_hi := null; v_hf := null; end if;
  if v_data is null then return jsonb_build_object('status','invalido','campo','data'); end if;
  if v_fim is not null and v_fim <= v_data then v_fim := null; end if;
  if v_hi is not null and v_hf is not null and v_hf <= v_hi and v_fim is null then
    return jsonb_build_object('status','invalido','campo','horario');
  end if;
  if v_hi is null then v_hf := null; end if;

  v_rec := coalesce(nullif(p->>'recorrencia',''), v_ev.recorrencia, 'Única');
  if v_rec not in ('Única','Diária','Dias úteis','Semanal','Quinzenal','Mensal','Anual') then
    return jsonb_build_object('status','invalido','campo','recorrencia');
  end if;
  v_vis := coalesce(nullif(p->>'visibilidade',''), v_ev.visibilidade, v_pd.visibilidade, 'convidados');
  if v_vis not in ('equipe','convidados','privado') then return jsonb_build_object('status','invalido','campo','visibilidade'); end if;
  if nullif(p->>'cor','') is not null and (p->>'cor') !~* '^#[0-9a-f]{6}$' then
    return jsonb_build_object('status','invalido','campo','cor');
  end if;
  v_tit := coalesce(nullif(trim(p->>'titulo'),''), v_ev.titulo, nullif(trim(v_pd.titulo),''), v_pd.nome, '(sem título)');

  if p ? 'lembretes' then
    select coalesce(array_agg(distinct v::integer order by v::integer), '{}') into v_lemb
      from jsonb_array_elements_text(case when jsonb_typeof(p->'lembretes') = 'array' then p->'lembretes' else '[]' end) t(v)
     where v ~ '^\d+$' and v::integer between 0 and 40320;
  else
    v_lemb := coalesce(v_ev.lembretes, v_pd.lembretes, '{}');
  end if;

  -- convidados: pessoas, grupos (com quem está abaixo deles), a equipe toda
  if p ? 'obrigatorios' or p ? 'opcionais' or p ? 'grupos' or p ? 'todos' or v_novo then
    select coalesce(array_agg(distinct v::integer), '{}') into v_gids
      from jsonb_array_elements_text(case when jsonb_typeof(p->'grupos') = 'array' then p->'grupos' else '[]' end) t(v)
     where v ~ '^\d+$';
    select coalesce(array_agg(nome order by nome), '{}') into v_gnomes from grupos where id = any(v_gids);
    select coalesce(array_agg(distinct r), '{}') into v_obrig from (
      select v::integer as r
        from jsonb_array_elements_text(case when jsonb_typeof(p->'obrigatorios') = 'array' then p->'obrigatorios' else '[]' end) t(v)
       where v ~ '^\d+$'
      union
      select m.registro from membros m
       where m.status in ('Ativo','Em pausa / avaliação')
         and ( coalesce((p->>'todos')::boolean, false)
            or exists (select 1 from unnest(v_gids) g where public.esta_no_grupo(g, m.registro)) )
    ) s where r in (select registro from membros);
    select coalesce(array_agg(distinct v::integer), '{}') into v_opc
      from jsonb_array_elements_text(case when jsonb_typeof(p->'opcionais') = 'array' then p->'opcionais' else '[]' end) t(v)
     where v ~ '^\d+$' and v::integer in (select registro from membros);
    v_opc := array(select unnest(v_opc) except select unnest(v_obrig));
    v_todos := array(select unnest(v_obrig) union select unnest(v_opc)
                     union select coalesce(v_ev.owner_registro, v_eu));
  end if;

  ------------------------------------------------------------ criar
  if v_novo then
    insert into eventos (titulo, tipo, data, data_fim, hora, hora_inicio, hora_fim, espaco_id, local,
      recorrencia, owner_registro, grupos, pauta, status, criado_por, categoria, visibilidade,
      serie_ate, meet_url, cor, lembretes, predefinido_id)
    values (left(v_tit,160), coalesce(v_pd.nome, 'Evento'), v_data, v_fim,
      case when v_hi is null then null when v_hf is null then to_char(v_hi,'HH24:MI')
           else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
      v_hi, v_hf, coalesce(nullif(p->>'espaco_id','')::integer, v_pd.espaco_id),
      coalesce(nullif(trim(p->>'local'),''), v_pd.local), v_rec, v_eu, v_gnomes,
      coalesce(nullif(trim(p->>'descricao'),''), v_pd.descricao), 'Preparação', v_quem, 'reuniao', v_vis,
      case when v_rec = 'Única' then null else v_ate end,
      coalesce(nullif(trim(p->>'meet_url'),''), v_pd.meet_url), nullif(p->>'cor',''), v_lemb, v_pd.id)
    returning * into v_ev;

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select v_ev.id, r, case when array_length(v_gids,1) is not null then 'grupo' else 'manual' end,
           case when r = any(v_opc) then 'opcional' else 'obrigatorio' end,
           case when r = v_eu then 'vou' else 'pendente' end,
           case when r = v_eu then now() end, now()
      from unnest(v_todos) r;

    insert into evento_externos (evento_id, email, nome)
    select v_ev.id, lower(trim(x->>'email')), nullif(trim(x->>'nome'),'')
      from jsonb_array_elements(case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) x
     where trim(x->>'email') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    on conflict do nothing;

    if v_rec <> 'Única' then
      update eventos set serie_id = v_ev.id where id = v_ev.id;
      v_ocor := public.agenda_gerar_serie(v_ev.id, least(coalesce(v_ate, current_date + 120), current_date + 400));
    end if;

    if v_notif then
      perform public.agenda_enfileirar(v_ev.id, 'convite', v_todos,
        array(select id from evento_externos where evento_id = v_ev.id));
      perform public.agenda_sino(v_todos, 'agenda_convite', 'Convite: ' || v_tit,
        public.agenda_quando(v_data, v_fim, v_hi, v_hf), '#/agenda/evento/' || v_ev.id);
    end if;
    return jsonb_build_object('status','ok','id',v_ev.id,'numero',v_ev.numero,
      'convidados', coalesce(array_length(v_todos,1),0), 'ocorrencias', v_ocor);
  end if;

  ------------------------------------------------------------ editar
  v_recmud := (p ? 'recorrencia' and v_rec is distinct from coalesce(v_ev.recorrencia,'Única'))
           or (p ? 'repetir_ate' and v_ate is distinct from v_ev.serie_ate);

  -- reagendar: todos os encontros escolhidos andam o mesmo número de
  -- dias (um só, ou este e os seguintes da série)
  if v_serie and v_ev.serie_id is not null and not v_recmud then
    select coalesce(array_agg(id order by data), '{}') into v_ids from eventos
     where serie_id = v_ev.serie_id and data >= v_ev.data and coalesce(status,'') <> 'Cancelado';
  else
    v_ids := array[v_ev.id];
  end if;
  v_delta := v_data - v_ev.data;

  -- o que mudou, para o e-mail
  if v_data <> v_ev.data or v_fim is distinct from v_ev.data_fim then v_mudou := v_mudou || 'data'::text; end if;
  if v_hi is distinct from v_ev.hora_inicio or v_hf is distinct from v_ev.hora_fim then v_mudou := v_mudou || 'horário'::text; end if;
  if (p ? 'local' and nullif(trim(p->>'local'),'') is distinct from v_ev.local)
     or (p ? 'espaco_id' and nullif(p->>'espaco_id','')::integer is distinct from v_ev.espaco_id) then
    v_mudou := v_mudou || 'local'::text; end if;
  if p ? 'meet_url' and nullif(trim(p->>'meet_url'),'') is distinct from v_ev.meet_url then v_mudou := v_mudou || 'link da chamada'::text; end if;
  if v_tit is distinct from v_ev.titulo then v_mudou := v_mudou || 'título'::text; end if;
  if v_recmud then v_mudou := v_mudou || 'repetição'::text; end if;

  update eventos e set
    titulo       = left(v_tit,160),
    data         = e.data + v_delta,
    data_fim     = case when v_fim is null then null else e.data + v_delta + (v_fim - v_data) end,
    hora_inicio  = v_hi,
    hora_fim     = v_hf,
    hora         = case when v_hi is null then null when v_hf is null then to_char(v_hi,'HH24:MI')
                        else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
    pauta        = case when p ? 'descricao' then nullif(trim(p->>'descricao'),'') else e.pauta end,
    meet_url     = case when p ? 'meet_url' then nullif(trim(p->>'meet_url'),'') else e.meet_url end,
    local        = case when p ? 'local' then nullif(trim(p->>'local'),'') else e.local end,
    espaco_id    = case when p ? 'espaco_id' then nullif(p->>'espaco_id','')::integer else e.espaco_id end,
    visibilidade = v_vis,
    cor          = case when p ? 'cor' then nullif(p->>'cor','') else e.cor end,
    lembretes    = v_lemb,
    predefinido_id = case when p ? 'predefinido_id' then v_pd.id else e.predefinido_id end,
    grupos       = case when v_todos is not null then v_gnomes else e.grupos end,
    atualizado_em = now()
  where e.id = any(v_ids);

  -- a repetição mudou: a série antiga para antes deste encontro, e este
  -- vira a base da nova (ou fica sozinho)
  if v_recmud then
    if v_ev.serie_id is not null then
      update eventos set status = 'Cancelado'
       where serie_id = v_ev.serie_id and data > v_ev.data and id <> v_ev.id;
      update eventos set serie_ate = v_ev.data - 1
       where serie_id = v_ev.serie_id and data < v_ev.data;
    end if;
    update eventos set recorrencia = v_rec,
                       serie_id = case when v_rec = 'Única' then null else id end,
                       serie_ate = case when v_rec = 'Única' then null else v_ate end
     where id = v_ev.id;
    if v_rec <> 'Única' then
      v_ocor := public.agenda_gerar_serie(v_ev.id, least(coalesce(v_ate, current_date + 120), current_date + 400));
    end if;
  end if;

  -- convidados
  select coalesce(array_agg(registro), '{}') into v_antes from evento_participantes where evento_id = v_ev.id;
  if v_todos is not null then
    v_entram := array(select unnest(v_todos) except select unnest(v_antes));
    v_saem   := array(select unnest(v_antes) except select unnest(v_todos));
    if v_notif and array_length(v_saem,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'cancelamento', v_saem, '{}');
    end if;
    delete from evento_participantes where evento_id = any(v_ids) and not (registro = any(v_todos));
    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select ev, r, 'manual', case when r = any(v_opc) then 'opcional' else 'obrigatorio' end,
           case when r = v_ev.owner_registro then 'vou' else 'pendente' end,
           case when r = v_ev.owner_registro then now() end, now()
      from unnest(v_ids) ev cross join unnest(v_todos) r
     where not exists (select 1 from evento_participantes x where x.evento_id = ev and x.registro = r);
    update evento_participantes set papel = case when registro = any(v_opc) then 'opcional' else 'obrigatorio' end
     where evento_id = any(v_ids);
  end if;

  if p ? 'externos' then
    select coalesce(array_agg(id), '{}') into v_ext_sai from evento_externos
     where evento_id = v_ev.id and lower(email) not in (
       select lower(trim(x->>'email')) from jsonb_array_elements(
         case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) x);
    if v_notif and array_length(v_ext_sai,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'cancelamento', '{}', v_ext_sai);
    end if;
    delete from evento_externos x where x.evento_id = any(v_ids) and lower(x.email) not in (
      select lower(trim(y->>'email')) from jsonb_array_elements(
        case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) y);
    with ins as (
      insert into evento_externos (evento_id, email, nome)
      select ev, y.email, y.nome
        from unnest(v_ids) ev
        cross join (select lower(trim(z->>'email')) as email, nullif(trim(z->>'nome'),'') as nome
                      from jsonb_array_elements(case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) z
                     where trim(z->>'email') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$') y
      on conflict do nothing
      returning id, evento_id)
    select coalesce(array_agg(id) filter (where evento_id = v_ev.id), '{}') into v_ext_in from ins;
  end if;
  select coalesce(array_agg(id), '{}') into v_ext_fic from evento_externos
   where evento_id = v_ev.id and not (id = any(v_ext_in));

  if v_notif then
    if array_length(v_entram,1) is not null or array_length(v_ext_in,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'convite', v_entram, v_ext_in);
      perform public.agenda_sino(v_entram, 'agenda_convite', 'Convite: ' || v_tit,
        public.agenda_quando(v_data, v_fim, v_hi, v_hf), '#/agenda/evento/' || v_ev.id);
    end if;
    if array_length(v_mudou,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'alteracao',
        array(select registro from evento_participantes
               where evento_id = v_ev.id and not (registro = any(v_entram)) and coalesce(resposta,'') <> 'nao'),
        v_ext_fic, array_to_string(v_mudou, ', '));
      perform public.agenda_sino(
        array(select registro from evento_participantes where evento_id = v_ev.id and not (registro = any(v_entram))),
        'agenda_alteracao', 'Evento alterado: ' || v_tit,
        'Mudou: ' || array_to_string(v_mudou, ', ') || '. ' || public.agenda_quando(v_data, v_fim, v_hi, v_hf),
        '#/agenda/evento/' || v_ev.id);
    end if;
  end if;

  return jsonb_build_object('status','ok','id',v_ev.id,'numero',v_ev.numero,
    'eventos', coalesce(array_length(v_ids,1),0), 'ocorrencias', v_ocor,
    'entraram', coalesce(array_length(v_entram,1),0), 'sairam', coalesce(array_length(v_saem,1),0),
    'mudou', to_jsonb(v_mudou));
end $$;
revoke execute on function public.agenda_evento_salvar(jsonb) from public, anon;
grant  execute on function public.agenda_evento_salvar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 10. EXCLUIR — este, ou este e os seguintes
--     Nada se apaga: o evento fica cancelado, com o histórico, e
--     some das telas. Os convidados recebem o cancelamento.
-- ------------------------------------------------------------
create or replace function public.agenda_evento_excluir(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_eu  integer := public.portal_registro_atual();
  v_ev  public.eventos%rowtype;
  v_ids uuid[];
  v_regs integer[];
begin
  select * into v_ev from eventos where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (public.agenda_gestor() or (v_eu is not null and v_ev.owner_registro = v_eu)) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if coalesce(p->>'aplicar','este') = 'seguintes' and v_ev.serie_id is not null then
    select coalesce(array_agg(id), '{}') into v_ids from eventos
     where serie_id = v_ev.serie_id and data >= v_ev.data and coalesce(status,'') <> 'Cancelado';
    update eventos set serie_ate = v_ev.data - 1 where serie_id = v_ev.serie_id;
  else
    v_ids := array[v_ev.id];
  end if;
  update eventos set status = 'Cancelado', atualizado_em = now() where id = any(v_ids);
  if coalesce((p->>'notificar')::boolean, true) then
    select coalesce(array_agg(registro), '{}') into v_regs from evento_participantes
     where evento_id = v_ev.id and coalesce(resposta,'') <> 'nao';
    perform public.agenda_enfileirar(v_ev.id, 'cancelamento', v_regs,
      array(select id from evento_externos where evento_id = v_ev.id and resposta <> 'nao'),
      case when array_length(v_ids,1) > 1 then 'este e os seguintes' end);
    perform public.agenda_sino(v_regs, 'agenda_cancelamento', 'Cancelado: ' || v_ev.titulo,
      public.agenda_quando(v_ev.data, v_ev.data_fim, v_ev.hora_inicio, v_ev.hora_fim), '#/agenda');
  end if;
  return jsonb_build_object('status','ok','eventos',coalesce(array_length(v_ids,1),0));
end $$;
revoke execute on function public.agenda_evento_excluir(jsonb) from public, anon;
grant  execute on function public.agenda_evento_excluir(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 11. RESPONDER — pelo portal e pelo e-mail
-- ------------------------------------------------------------
create or replace function public.agenda_responder(p_id uuid, p_resposta text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_eu integer := public.portal_registro_atual(); v_ev public.eventos%rowtype; v_n integer;
begin
  if p_resposta not in ('vou','talvez','nao') then return jsonb_build_object('status','invalido'); end if;
  select * into v_ev from eventos where id = p_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  update evento_participantes set resposta = p_resposta, respondido_em = now()
   where evento_id = p_id and registro = v_eu;
  get diagnostics v_n = row_count;
  if v_n = 0 then return jsonb_build_object('status','nao_convidado'); end if;
  if v_ev.owner_registro is distinct from v_eu then
    perform public.agenda_sino(array[v_ev.owner_registro], 'agenda_resposta',
      (select nome from membros where registro = v_eu) || ' — '
        || case p_resposta when 'vou' then 'vai' when 'talvez' then 'talvez vá' else 'não vai' end,
      v_ev.titulo, '#/agenda/evento/' || p_id);
  end if;
  return jsonb_build_object('status','ok','resposta',p_resposta);
end $$;
revoke execute on function public.agenda_responder(uuid, text) from public, anon;
grant  execute on function public.agenda_responder(uuid, text) to authenticated;

-- A resposta pelo e-mail: o token do convite é a credencial, e só ela.
-- Aberta à chave anônima; devolve o evento só para quem tem o token.
-- Sem resposta, só lê (a página mostra o evento e os três botões).
create or replace function public.agenda_rsvp_token(p_token uuid, p_resposta text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ev   public.eventos%rowtype;
  v_reg  integer;
  v_ext  uuid;
  v_nome text;
  v_resp text;
begin
  if p_token is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if p_resposta is not null and p_resposta not in ('vou','talvez','nao') then
    return jsonb_build_object('status','invalido');
  end if;
  select e.* into v_ev from eventos e join evento_participantes p on p.evento_id = e.id where p.token = p_token;
  if v_ev.id is not null then
    select p.registro, m.nome, p.resposta into v_reg, v_nome, v_resp
      from evento_participantes p join membros m on m.registro = p.registro where p.token = p_token;
  else
    select e.* into v_ev from eventos e join evento_externos x on x.evento_id = e.id where x.token = p_token;
    if v_ev.id is null then return jsonb_build_object('status','nao_encontrado'); end if;
    select x.id, coalesce(x.nome, split_part(x.email,'@',1)), x.resposta into v_ext, v_nome, v_resp
      from evento_externos x where x.token = p_token;
  end if;

  if p_resposta is not null and coalesce(v_ev.status,'') <> 'Cancelado' then
    if v_reg is not null then
      update evento_participantes set resposta = p_resposta, respondido_em = now() where token = p_token;
    else
      update evento_externos set resposta = p_resposta, respondido_em = now() where token = p_token;
    end if;
    if p_resposta is distinct from v_resp and v_ev.owner_registro is distinct from v_reg then
      perform public.agenda_sino(array[v_ev.owner_registro], 'agenda_resposta',
        v_nome || ' — ' || case p_resposta when 'vou' then 'vai' when 'talvez' then 'talvez vá' else 'não vai' end,
        v_ev.titulo, '#/agenda/evento/' || v_ev.id);
    end if;
    v_resp := p_resposta;
  end if;

  return jsonb_build_object('status', case when coalesce(v_ev.status,'') = 'Cancelado' then 'cancelado' else 'ok' end,
    'titulo', v_ev.titulo, 'quando', public.agenda_quando(v_ev.data, v_ev.data_fim, v_ev.hora_inicio, v_ev.hora_fim),
    'local', coalesce((select nome from espacos where id = v_ev.espaco_id), v_ev.local), 'meet_url', v_ev.meet_url,
    'organizador', (select nome from membros where registro = v_ev.owner_registro),
    'nome', split_part(coalesce(v_nome,''), ' ', 1), 'resposta', coalesce(v_resp,'pendente'),
    'membro', v_reg is not null, 'evento_id', case when v_reg is not null then v_ev.id end);
end $$;
revoke execute on function public.agenda_rsvp_token(uuid, text) from public;
grant  execute on function public.agenda_rsvp_token(uuid, text) to anon, authenticated;

-- ------------------------------------------------------------
-- 12. A FILA, PARA A FUNÇÃO notificar-email
--     O lote gera primeiro os lembretes que venceram: para cada
--     evento que começa daqui a pouco e cada "minutos antes" dele,
--     um e-mail por convidado que não recusou. O índice único não
--     deixa o mesmo lembrete sair duas vezes; o que venceu antes de
--     a pessoa ser convidada não sai.
-- ------------------------------------------------------------
create or replace function public.agenda_envios_lote(p_limite integer default 100)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  insert into agenda_envios (evento_id, tipo, chave, para_registro, para_email, para_nome, token, resposta, assunto, dados)
  select e.id, 'lembrete', l.m || '@' || e.data, p.registro,
         coalesce(nullif(mb.email_nro,''), nullif(mb.email_pessoal,'')), mb.nome, p.token, p.resposta,
         'Lembrete: ' || e.titulo || ' · ' || public.agenda_quando(e.data, e.data_fim, e.hora_inicio, e.hora_fim),
         public.agenda_dados(e.id) || jsonb_build_object('minutos', l.m)
    from eventos e
    cross join lateral unnest(e.lembretes) l(m)
    join evento_participantes p on p.evento_id = e.id and coalesce(p.resposta,'pendente') <> 'nao'
    join membros mb on mb.registro = p.registro
    left join agenda_preferencias ap on ap.registro = p.registro
   where coalesce(e.status,'') <> 'Cancelado'
     and e.data between current_date - 1 and current_date + 30
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) <= now()
     and public.agenda_inicio(e.data, e.hora_inicio) > now()
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) >= coalesce(p.convidado_em, '-infinity')
     and coalesce(ap.emails, true)
     and mb.status in ('Ativo','Em pausa / avaliação','Sob demanda')
     and coalesce(nullif(mb.email_nro,''), nullif(mb.email_pessoal,'')) is not null
  on conflict do nothing;

  insert into agenda_envios (evento_id, tipo, chave, para_email, para_nome, token, resposta, assunto, dados)
  select e.id, 'lembrete', l.m || '@' || e.data, x.email, x.nome, x.token, x.resposta,
         'Lembrete: ' || e.titulo || ' · ' || public.agenda_quando(e.data, e.data_fim, e.hora_inicio, e.hora_fim),
         public.agenda_dados(e.id) || jsonb_build_object('minutos', l.m)
    from eventos e
    cross join lateral unnest(e.lembretes) l(m)
    join evento_externos x on x.evento_id = e.id and x.resposta <> 'nao'
   where coalesce(e.status,'') <> 'Cancelado'
     and e.data between current_date - 1 and current_date + 30
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) <= now()
     and public.agenda_inicio(e.data, e.hora_inicio) > now()
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) >= x.convidado_em
  on conflict do nothing;

  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'tipo', v.tipo, 'para_nome', v.para_nome, 'para_email', v.para_email,
      'token', v.token, 'resposta', v.resposta, 'membro', v.para_registro is not null,
      'assunto', v.assunto, 'dados', v.dados) order by v.id)
    from (select * from agenda_envios where enviado_em is null and tentativas < 5
           order by id limit greatest(coalesce(p_limite,100),1)) v), '[]'::jsonb);
end $$;

create or replace function public.agenda_envios_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ok  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'enviados','[]')) x), '{}');
  v_er  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'falhas','[]')) x), '{}');
  v_msg text := left(coalesce(p->>'erro',''), 500);
  v_n   integer;
begin
  update agenda_envios set enviado_em = now(), erro = null where id = any(v_ok) and enviado_em is null;
  get diagnostics v_n = row_count;
  update agenda_envios set tentativas = tentativas + 1, erro = nullif(v_msg,'') where id = any(v_er) and enviado_em is null;
  return jsonb_build_object('status','ok','enviados',v_n);
end $$;
revoke execute on function public.agenda_envios_lote(integer) from public, anon, authenticated;
revoke execute on function public.agenda_envios_baixa(jsonb)  from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.agenda_envios_lote(integer) to service_role;
    grant execute on function public.agenda_envios_baixa(jsonb)  to service_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 13. A LEITURA DA AGENDA — o fim do evento e a cor
--     Mesmo contrato da 13.0 (agenda_item); muda o que o evento
--     devolve: o dia de fim e a cor (a dele, a do predefinido, a do
--     tipo antigo).
-- ------------------------------------------------------------
create or replace function public.agenda_itens_para(
  p_reg integer, p_gestor boolean, p_de date, p_ate date
) returns setof public.agenda_item language sql stable security definer
set search_path = public
as $$
  select 'ev:' || e.id::text, 'evento', e.id,
         coalesce(t.categoria, e.categoria, 'reuniao'),
         e.tipo, e.titulo, coalesce(nullif(e.cor,''), pd.cor, t.cor, '#2DD4BF'),
         e.data, coalesce(e.data_fim, e.data), e.hora_inicio, e.hora_fim, (e.hora_inicio is null),
         coalesce(esp.nome, e.local), e.meet_url, e.pauta, e.numero, e.serie_id,
         coalesce(e.recorrencia,'Única'), e.scrum, e.grupo_scrum, e.owner_registro,
         (p_reg is not null and e.owner_registro = p_reg),
         (meu.registro is not null),
         meu.resposta,
         (select count(*)::integer from evento_participantes x where x.evento_id = e.id),
         (select count(*)::integer from evento_participantes x where x.evento_id = e.id and x.resposta = 'vou'),
         coalesce(e.visibilidade,'convidados')
    from eventos e
    left join evento_tipos t   on t.nome = e.tipo
    left join agenda_predefinidos pd on pd.id = e.predefinido_id
    left join espacos      esp on esp.id = e.espaco_id
    left join evento_participantes meu on meu.evento_id = e.id and meu.registro = p_reg
   where e.data <= p_ate and coalesce(e.data_fim, e.data) >= p_de
     and coalesce(e.status,'Preparação') <> 'Cancelado'
     and ( coalesce(e.visibilidade,'convidados') = 'equipe'
        or coalesce(p_gestor,false)
        or (p_reg is not null and (e.owner_registro = p_reg or meu.registro is not null)) )

  union all

  select 'mk:' || ci.id::text, 'marco', ci.id, 'marco', ci.tipo, ci.titulo,
         case ci.tipo when 'ferias'            then '#4C6FBF'
                      when 'processo_seletivo' then '#A78BFA'
                      when 'prazo'             then '#F5C36A'
                      when 'feriado'           then '#F1806F'
                      when 'equipe'            then '#CEDC00'
                      when 'ufmg'              then '#7FA7F2'
                      when 'evento'            then '#A78BFA'
                      else '#8E8E93' end,
         ci.data_inicio, coalesce(ci.data_fim, ci.data_inicio),
         null::time, null::time, true,
         null::text, null::text, ci.observacao, null::integer, null::uuid, 'Única',
         null::text, null::text, ci.registro,
         (p_reg is not null and ci.registro = p_reg), false, null::text, 0, 0,
         case when ci.registro is null then 'equipe' else 'privado' end
    from calendario_itens ci
   where ci.data_inicio <= p_ate
     and coalesce(ci.data_fim, ci.data_inicio) >= p_de
     and (ci.registro is null or coalesce(p_gestor,false) or ci.registro = p_reg)

  union all

  select 'au:' || a.id::text, 'ausencia', a.id, 'ausencia', a.tipo,
         case a.tipo when 'ferias' then 'Férias'
                     when 'afastamento' then 'Afastamento'
                     when 'no_lab' then 'No LABBIO'
                     when 'remoto' then 'Trabalho remoto'
                     when 'ausente' then 'Temporariamente ausente'
                     else 'Não perturbe' end,
         case a.tipo when 'ferias' then '#4C6FBF'
                     when 'afastamento' then '#F1806F'
                     when 'no_lab' then '#4ADE97'
                     when 'remoto' then '#7FA7F2'
                     when 'ausente' then '#F5C36A'
                     else '#F1806F' end,
         (a.inicio at time zone 'America/Sao_Paulo')::date,
         ((a.fim - interval '1 second') at time zone 'America/Sao_Paulo')::date,
         case when a.dia_inteiro then null else (a.inicio at time zone 'America/Sao_Paulo')::time end,
         case when a.dia_inteiro then null else (a.fim    at time zone 'America/Sao_Paulo')::time end,
         a.dia_inteiro,
         null::text, null::text, a.observacao, null::integer, null::uuid, 'Única',
         null::text, null::text, a.registro,
         (p_reg is not null and a.registro = p_reg), false, null::text, 0, 0,
         case when a.tipo in ('ferias','afastamento') then 'privado' else 'equipe' end
    from agenda_ausencias a
   where a.fim    >  (p_de::timestamp        at time zone 'America/Sao_Paulo')
     and a.inicio <  ((p_ate + 1)::timestamp at time zone 'America/Sao_Paulo')
     and ( a.tipo in ('no_lab','remoto','ausente','nao_perturbe')
        or coalesce(p_gestor,false)
        or a.registro = p_reg );
$$;
revoke execute on function public.agenda_itens_para(integer, boolean, date, date) from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select on public.agenda_predefinidos, public.evento_externos to service_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 14. O QUE SAIU
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.evento_tipos') is not null then
    comment on table public.evento_tipos is
      'Legado (até a 27.0). Desde a 28.0 os tipos são agenda_predefinidos; esta tabela só dá a cor dos eventos antigos.';
  end if;
  if to_regclass('public.agenda_scrum') is not null then
    comment on table public.agenda_scrum is
      'Legado (até a 27.0): as cerimônias de scrum. O portal não lê nem escreve mais; as séries geradas continuam como eventos.';
  end if;
  if to_regclass('public.evento_checklist') is not null then
    comment on table public.evento_checklist is
      'Legado (até a 27.0): o checklist do dossiê. O portal não lê nem escreve mais.';
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v28_agenda', 'A agenda no modelo do Google Agenda: evento com página própria, convidados (da equipe e de fora), resposta pelo e-mail, lembretes, reagendar sem apagar, eventos predefinidos; sai o checklist, o dossiê e as cerimônias')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 28.0
-- Depois de aplicar:
--   1) publique de novo a Edge Function notificar-email: é ela que
--      entrega os convites, as alterações e os lembretes;
--   2) o agendamento dela (a cada 5 minutos) já cobre os lembretes;
--   3) em Agenda › Configurações › Eventos predefinidos, confira os
--      que vieram dos tipos antigos: quando notificar, local, grupos.
--
-- Para apagar de vez o que era do sistema antigo (opcional, quando a
-- equipe não precisar mais do histórico dos dossiês):
--
--   drop table if exists public.evento_checklist;
--   drop table if exists public.agenda_scrum;
--   drop function if exists public.agenda_scrum_salvar(jsonb);
--   drop function if exists public.agenda_criar_evento(jsonb);
--   drop function if exists public.agenda_editar_evento(jsonb);
--   drop function if exists public.agenda_cancelar(jsonb);
-- ============================================================
