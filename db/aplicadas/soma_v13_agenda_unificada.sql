-- ============================================================
-- SOMA 13.0 — MIGRAÇÃO · NeuroDynamics
-- UMA AGENDA SÓ. Até aqui a equipe tinha duas: os "eventos"
-- (com convidados e RSVP) e os "marcos" do calendário
-- (calendario_itens: férias, prazos, processo seletivo), cada
-- uma numa tabela, cada uma numa tela. Esta migração junta as
-- duas — e o que faltava — numa leitura única:
--
--   agenda_itens(de, ate)  ->  tudo o que a pessoa logada pode
--                              ver, venha de onde vier.
--
-- O que entra de novo:
--   1. CATÁLOGO DE TIPOS (evento_tipos) — os tipos de evento
--      saem do código dos dois apps e passam a morar no banco,
--      com cor, visibilidade padrão e checklist. Criar um tipo
--      novo deixa de exigir deploy.
--   2. VISIBILIDADE por evento: "equipe" (todo mundo vê, caso
--      da Reunião geral), "convidados" (só quem foi chamado) e
--      "privado" (só a pessoa e admin/pessoal).
--   3. RECORRÊNCIA DE VERDADE: frequência semanal, quinzenal ou
--      mensal gera as ocorrências futuras, cada uma com os seus
--      convidados e o seu RSVP. Nada de "evento fantasma" que
--      só existe na tela.
--   4. AUSÊNCIAS E PRESENÇA (agenda_ausencias): férias e
--      afastamento (privados) e os intervalos do dia a dia —
--      "no laboratório", "remoto", "temporariamente ausente",
--      "não perturbe" —, que conversam com o check-in.
--   5. CERIMÔNIAS DE SCRUM (agenda_scrum): cada grupo define o
--      horário da daily, da abertura e do fechamento de sprint,
--      com o link do Meet, e o banco gera a recorrência.
--   6. FEED DO GOOGLE (portal_agendas.feed_token): o endereço
--      que cada membro assina no Google Agenda para receber os
--      compromissos da NeuroDynamics.
--
-- Pré-requisito: o soma_v12.sql DESTE repositório aplicado.
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. CONFERÊNCIA DOS PRÉ-REQUISITOS
--    Parar aqui, dizendo qual arquivo falta, é melhor do que
--    quebrar trinta linhas adiante com um "relation does not
--    exist" que não explica nada. Nada foi criado ainda: o SQL
--    Editor roda o arquivo inteiro numa transação só, então uma
--    falha aqui deixa o banco exatamente como estava.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.eventos') is null then
    raise exception using
      message = 'Este banco não parece ser o do SOMA.',
      detail  = 'A tabela public.eventos não existe.',
      hint    = 'Confira se você está no projeto certo do Supabase.';
  end if;

  if to_regclass('public.portal_solicitacoes') is null then
    raise exception using
      message = 'Falta aplicar o soma_v10.sql antes desta migração.',
      detail  = 'A SOMA 13.0 usa a função portal_registro_atual(), criada pela 10.0.',
      hint    = 'Rode, na ordem: soma_v10.sql, soma_v11.sql, soma_v12.sql e só então este arquivo.';
  end if;

  if to_regclass('public.portal_documentos') is null then
    raise exception using
      message = 'Falta aplicar o soma_v11.sql antes desta migração.',
      hint    = 'Rode, na ordem: soma_v11.sql, soma_v12.sql e só então este arquivo.';
  end if;

  if to_regclass('public.portal_agendas') is null then
    raise exception using
      message = 'Falta aplicar o soma_v12.sql antes desta migração.',
      detail  = 'A SOMA 13.0 mexe em tabelas que a 12.0 cria (portal_agendas, portal_agenda_blocos).',
      hint    = 'Rode o soma_v12.sql INTEIRO no SQL Editor e depois volte para este arquivo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. CATÁLOGO DE TIPOS DE EVENTO
--    "categoria" agrupa o que se parece: reunião, cerimônia de
--    scrum, trabalho no laboratório, viagem. "rapido" marca os
--    tipos que aparecem na criação em dois toques do portal.
--    "checklist" é o modelo de preparação — vazio quer dizer
--    que o tipo não pede checklist nenhum, que é o caso dos
--    compromissos do dia a dia.
-- ------------------------------------------------------------
create table if not exists public.evento_tipos (
  nome            text primary key,
  categoria       text not null default 'reuniao'
                  check (categoria in ('reuniao','scrum','trabalho','viagem','social','outro')),
  cor             text not null default '#8E8E93',
  visibilidade    text not null default 'convidados'
                  check (visibilidade in ('equipe','convidados','privado')),
  convida_todos   boolean not null default false,   -- já chega com todo mundo ativo
  checklist       text[] not null default '{}',
  rapido          boolean not null default false,   -- aparece na criação rápida
  ordem           integer not null default 100,
  ativo           boolean not null default true,
  atualizado_em   timestamptz not null default now()
);

drop trigger if exists tg_upd_evtipos on public.evento_tipos;
create trigger tg_upd_evtipos before update on public.evento_tipos
  for each row execute function public.fn_atualizado();

alter table public.evento_tipos enable row level security;
drop policy if exists evtipos_select on public.evento_tipos;
create policy evtipos_select on public.evento_tipos
  for select to authenticated using (true);
drop policy if exists evtipos_write on public.evento_tipos;
create policy evtipos_write on public.evento_tipos
  for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- ------------------------------------------------------------
-- 2. EVENTOS — colunas novas
--    Tudo "if not exists": a tabela é a mesma que o SOMA usa há
--    versões, e nada do que já existe muda de sentido.
-- ------------------------------------------------------------
alter table public.eventos add column if not exists categoria    text;
alter table public.eventos add column if not exists visibilidade text;
alter table public.eventos add column if not exists serie_id     uuid;
alter table public.eventos add column if not exists serie_ate    date;
alter table public.eventos add column if not exists meet_url     text;
alter table public.eventos add column if not exists scrum        text;
alter table public.eventos add column if not exists grupo_scrum  text;

update public.eventos set visibilidade = case
  when tipo in ('Reunião geral','Confraternização','Visita de externos') then 'equipe'
  else 'convidados' end
 where visibilidade is null;
update public.eventos set categoria = 'reuniao' where categoria is null;

alter table public.eventos alter column visibilidade set default 'convidados';
alter table public.eventos alter column categoria    set default 'reuniao';

create index if not exists idx_eventos_serie on public.eventos (serie_id, data);
create index if not exists idx_eventos_data  on public.eventos (data);

-- O tipo do evento passa a ser validado pelo catálogo (seção 1),
-- não por um CHECK cravado na tabela — senão cada tipo novo
-- vira migração. Solta os CHECKs que travavam "tipo" e
-- "recorrencia", se existirem, sem tocar em nenhum outro.
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class     c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'eventos' and con.contype = 'c'
       and exists (select 1
                     from unnest(con.conkey) k
                     join pg_attribute a on a.attrelid = c.oid and a.attnum = k
                    where a.attname in ('tipo','recorrencia'))
  loop
    execute format('alter table public.eventos drop constraint %I', r.conname);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. PARTICIPANTES — obrigatório ou opcional
--    O assistente de agendamento já distinguia os dois na tela;
--    agora a distinção sobrevive ao convite.
-- ------------------------------------------------------------
alter table public.evento_participantes add column if not exists papel text;
update public.evento_participantes
   set papel = case when origem = 'opcional' then 'opcional' else 'obrigatorio' end
 where papel is null;
alter table public.evento_participantes alter column papel set default 'obrigatorio';

-- ------------------------------------------------------------
-- 4. AUSÊNCIAS E INTERVALOS DE PRESENÇA
--    Férias e afastamento são privados (a pessoa e o Depto. de
--    Pessoal). Os intervalos do dia a dia — "estou no LABBIO
--    até as 18h", "saí para almoçar" — são o contrário: existem
--    para a equipe ver, e é isso que a RLS diz.
-- ------------------------------------------------------------
create table if not exists public.agenda_ausencias (
  id            uuid primary key default gen_random_uuid(),
  registro      integer not null references public.membros(registro) on delete cascade,
  tipo          text not null
                check (tipo in ('ferias','afastamento','no_lab','remoto','ausente','nao_perturbe')),
  inicio        timestamptz not null,
  fim           timestamptz not null,
  dia_inteiro   boolean not null default false,
  observacao    text,
  criado_por    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint agenda_ausencia_periodo check (fim > inicio)
);
create index if not exists idx_agausencias on public.agenda_ausencias (registro, inicio, fim);
create index if not exists idx_agausencias_tipo on public.agenda_ausencias (tipo, inicio);

drop trigger if exists tg_upd_agausencias on public.agenda_ausencias;
create trigger tg_upd_agausencias before update on public.agenda_ausencias
  for each row execute function public.fn_atualizado();
drop trigger if exists tg_aud_agausencias on public.agenda_ausencias;
create trigger tg_aud_agausencias after insert or update or delete on public.agenda_ausencias
  for each row execute function public.fn_auditoria();

alter table public.agenda_ausencias enable row level security;

drop policy if exists agausencias_select on public.agenda_ausencias;
create policy agausencias_select on public.agenda_ausencias
  for select to authenticated
  using (
    tipo in ('no_lab','remoto','ausente','nao_perturbe')     -- sinal de presença: é público na equipe
    or registro = public.portal_registro_atual()
    or public.papel_atual() in ('admin','pessoal')
  );
drop policy if exists agausencias_write on public.agenda_ausencias;
create policy agausencias_write on public.agenda_ausencias
  for all to authenticated
  using (registro = public.portal_registro_atual() or public.papel_atual() in ('admin','pessoal'))
  with check (registro = public.portal_registro_atual() or public.papel_atual() in ('admin','pessoal'));

-- ------------------------------------------------------------
-- 5. CERIMÔNIAS DE SCRUM POR GRUPO
--    Uma linha por grupo e cerimônia: em que dias, a que horas,
--    por quanto tempo, com qual link do Meet. Quem mexe é gente
--    do próprio grupo (ou admin/pessoal) — é o time que sabe a
--    hora que funciona para ele.
-- ------------------------------------------------------------
create table if not exists public.agenda_scrum (
  id            uuid primary key default gen_random_uuid(),
  grupo         text not null,
  cerimonia     text not null
                check (cerimonia in ('daily','abertura_sprint','fechamento_sprint','review','retro')),
  dias_semana   integer[] not null default '{1,2,3,4,5}',   -- ISO: 1 = segunda
  hora          time not null default '09:00',
  duracao_min   integer not null default 15 check (duracao_min between 5 and 480),
  recorrencia   text not null default 'Semanal'
                check (recorrencia in ('Semanal','Quinzenal','Mensal')),
  meet_url      text,
  local         text,
  ativo         boolean not null default true,
  serie_ids     uuid[] not null default '{}', -- séries geradas em eventos (uma por dia da semana)
  atualizado_por text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (grupo, cerimonia)
);

drop trigger if exists tg_upd_agscrum on public.agenda_scrum;
create trigger tg_upd_agscrum before update on public.agenda_scrum
  for each row execute function public.fn_atualizado();
drop trigger if exists tg_aud_agscrum on public.agenda_scrum;
create trigger tg_aud_agscrum after insert or update or delete on public.agenda_scrum
  for each row execute function public.fn_auditoria();

alter table public.agenda_scrum enable row level security;
drop policy if exists agscrum_select on public.agenda_scrum;
create policy agscrum_select on public.agenda_scrum
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- 6. FEED DO GOOGLE AGENDA
--    Endereço secreto por membro: ele assina uma vez no Google
--    ("Outras agendas -> Inscrever-se -> Do URL") e passa a
--    receber, na agenda dele, tudo o que o portal mostra para
--    ele. O token é rotacionável (basta gerar outro).
-- ------------------------------------------------------------
alter table public.portal_agendas add column if not exists feed_token uuid;
create unique index if not exists idx_pagendas_feed
  on public.portal_agendas (feed_token) where feed_token is not null;

-- ------------------------------------------------------------
-- 7. SEMENTE DO CATÁLOGO
--    Os cinco primeiros são os "rápidos": é o que aparece na
--    criação em dois toques do portal. Os checklists são os
--    mesmos que o SOMA já usava — agora no banco, e vazios para
--    os compromissos simples do dia a dia, que não pedem
--    preparação nenhuma.
--    "on conflict do nothing": ajustes feitos pela gestão no
--    catálogo não são desfeitos ao rodar a migração de novo.
-- ------------------------------------------------------------
insert into public.evento_tipos
  (nome, categoria, cor, visibilidade, convida_todos, rapido, ordem, checklist)
values
  ('Reunião geral', 'reuniao', '#2DD4BF', 'equipe', true, true, 10,
   array['Enviar e-mail de convite aos membros ativos com agendamento no Google Agenda (RSVP), usando o modelo padrão','Enviar a lista de convidados (PDF) para slog@eng.ufmg.br, cc marcondes@neurodynamics.dev, com portaria, data e horário — até 17h da sexta anterior','Reservar o local: auditórios pelo SisCAS; fins de semana por reservas@eng.ufmg.br; LABBIO por office.pinotti@gmail.com','Orçar e confirmar o coffee break com henriquerm@gmail.com (quando aplicável)','Criar os slides na pasta Eventos > Reunião Geral do Drive e enviar aos supervisores/gerentes com 1 semana de antecedência','Convidar o Prof. Henrique Martins via dir@adm.eng.ufmg.br, cc henriquerm@gmail.com','Enviar lembrete por e-mail e no grupo Geral do WhatsApp, com local, portaria e instruções de acesso','Designar responsável por fotos e vídeos do evento (upload na pasta do Drive depois)','Imprimir a lista de presença e as placas de sinalização da sala','Pegar a chave no Centro de Audiovisual no dia útil anterior']::text[]),
  ('Cerimônia de Scrum', 'scrum', '#A78BFA', 'convidados', false, true, 20,
   '{}'::text[]),
  ('Follow-up', 'reuniao', '#7FA7F2', 'convidados', false, true, 30,
   '{}'::text[]),
  ('Teste', 'trabalho', '#F5C36A', 'convidados', false, true, 40,
   array['Definir protocolo e objetivos do teste','Reservar o espaço e confirmar a agenda dos participantes','Preparar equipamentos, materiais e instrumentação','Verificar termos e autorizações necessárias (sigilo, imagem, segurança)','Executar e registrar os resultados (relatório de execução NRO)','Organizar e limpar o espaço ao final']::text[]),
  ('Trabalho no LABBIO', 'trabalho', '#4ADE97', 'equipe', false, true, 50,
   '{}'::text[]),
  ('Reunião de gerência', 'reuniao', '#CEDC00', 'convidados', false, false, 60,
   array['Definir pauta e objetivos com a Diretoria','Enviar convite com agendamento na agenda (RSVP)','Reservar sala de reuniões','Compartilhar materiais de apoio com antecedência','Enviar lembrete com local e instruções','Registrar ata e encaminhamentos']::text[]),
  ('Reunião com stakeholder', 'reuniao', '#CEDC00', 'convidados', false, false, 70,
   array['Alinhar objetivos e pauta com a Diretoria','Enviar convite e confirmar a agenda do stakeholder','Reservar sala adequada','Preparar a apresentação institucional','Solicitar autorização de entrada na portaria (slog@eng.ufmg.br)','Enviar lembrete e instruções de acesso','Registrar ata e encaminhamentos']::text[]),
  ('Confraternização', 'social', '#F1806F', 'equipe', true, false, 80,
   array['Definir data, local e orçamento','Convidar os membros e coletar confirmações','Organizar alimentação / coffee','Reservar ou preparar o espaço','Designar responsável por registros fotográficos','Enviar lembrete com local e horário']::text[]),
  ('Visita de externos', 'social', '#A78BFA', 'equipe', false, false, 90,
   array['Confirmar data, horário e lista de visitantes','Enviar a lista para autorização na portaria (slog@eng.ufmg.br), com local, data e horário','Reservar os espaços a serem visitados','Definir roteiro e anfitriões da visita','Enviar instruções de acesso aos visitantes','Designar responsável por registros fotográficos']::text[]),
  ('Viagem', 'viagem', '#A78BFA', 'convidados', false, false, 100,
   array['Definir roteiro e objetivos da viagem','Levantar orçamento (transporte, hospedagem, alimentação)','Solicitar aprovações e recursos','Reservar transporte e hospedagem','Confirmar agenda com os anfitriões','Conferir documentos dos participantes','Comunicar itinerário e contatos de emergência']::text[]),
  ('Outro', 'outro', '#8E8E93', 'convidados', false, false, 110,
   array['Definir pauta e objetivos','Enviar convite com agendamento (RSVP)','Reservar local','Enviar lembrete com instruções de acesso','Registrar ata ou resumo']::text[])
on conflict (nome) do nothing;

-- ------------------------------------------------------------
-- 7b. A AGENDA FIXA DO SEMESTRE ENTRA NO BANCO
--     O portal carregava a agenda do 2º semestre de 2026 numa
--     lista dentro do HTML — uma terceira agenda, que só dava
--     para mudar com deploy. Ela vira marco do calendário como
--     qualquer outro: a gestão edita pelo SOMA e o portal só lê.
--     "chave" existe para semear sem duplicar.
-- ------------------------------------------------------------
alter table public.calendario_itens add column if not exists chave text;
alter table public.calendario_itens add column if not exists criado_por text;
create unique index if not exists idx_calitens_chave
  on public.calendario_itens (chave) where chave is not null;

-- Os tipos de marco também saem do CHECK: "feriado", "equipe" e
-- "ufmg" são novos, e a gestão pode precisar de outros.
do $$
declare r record;
begin
  for r in
    select con.conname
      from pg_constraint con
      join pg_class     c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'calendario_itens' and con.contype = 'c'
       and exists (select 1 from unnest(con.conkey) k
                     join pg_attribute a on a.attrelid = c.oid and a.attnum = k
                    where a.attname = 'tipo')
  loop
    execute format('alter table public.calendario_itens drop constraint %I', r.conname);
  end loop;
end $$;

insert into public.calendario_itens (chave, tipo, titulo, data_inicio, data_fim, observacao, criado_por)
values
  ('fx-q3', 'equipe', 'Início do Q3', '2026-07-01'::date, '2026-07-01'::date, 'Novo ciclo do planejamento estratégico.', 'Agenda 2026/2'),
  ('fx-mutirao', 'equipe', 'Mutirão de organização do LABBIO', '2026-07-06'::date, '2026-07-10'::date, null, 'Agenda 2026/2'),
  ('fx-sem2', 'ufmg', 'Início do semestre letivo 2026/2', '2026-08-03'::date, '2026-08-03'::date, null, 'Agenda 2026/2'),
  ('fx-abbott', 'equipe', 'Auditoria na Abbott', '2026-08-03'::date, '2026-08-08'::date, 'Equipe com disponibilidade reduzida em horário comercial.', 'Agenda 2026/2'),
  ('fx-rg1', 'equipe', 'Reunião Geral (prevista)', '2026-08-08'::date, '2026-08-08'::date, null, 'Agenda 2026/2'),
  ('fx-incor', 'evento', 'Viagem ao InCor HC-FMUSP', '2026-08-11'::date, '2026-08-13'::date, null, 'Agenda 2026/2'),
  ('fx-rg2', 'equipe', 'Reunião Geral (prevista)', '2026-08-29'::date, '2026-08-29'::date, null, 'Agenda 2026/2'),
  ('fx-tranct', 'prazo', 'Prazo UFMG: trancamento total sem justificativa', '2026-09-03'::date, '2026-09-03'::date, null, 'Agenda 2026/2'),
  ('fx-fer1', 'feriado', 'Independência (7/9)', '2026-09-05'::date, '2026-09-07'::date, null, 'Agenda 2026/2'),
  ('fx-aacn1', 'ufmg', 'Atividades acadêmicas complementares noturnas', '2026-09-25'::date, '2026-09-25'::date, null, 'Agenda 2026/2'),
  ('fx-rg3', 'equipe', 'Reunião Geral (prevista)', '2026-09-26'::date, '2026-09-26'::date, null, 'Agenda 2026/2'),
  ('fx-cbeb', 'evento', 'CBEB, Congresso Brasileiro de Engenharia Biomédica', '2026-09-28'::date, '2026-10-02'::date, null, 'Agenda 2026/2'),
  ('fx-q4', 'equipe', 'Início do Q4', '2026-10-01'::date, '2026-10-01'::date, 'Último trimestre do ciclo de planejamento.', 'Agenda 2026/2'),
  ('fx-scsel', 'prazo', 'Semana do Conhecimento UFMG: apresentação e seleção de trabalhos', '2026-10-05'::date, '2026-10-07'::date, null, 'Agenda 2026/2'),
  ('fx-fer2', 'feriado', 'Nossa Senhora Aparecida (12/10)', '2026-10-10'::date, '2026-10-12'::date, null, 'Agenda 2026/2'),
  ('fx-trancp', 'prazo', 'Prazo UFMG: trancamento parcial', '2026-10-16'::date, '2026-10-16'::date, null, 'Agenda 2026/2'),
  ('fx-sconhec', 'evento', 'Semana do Conhecimento da UFMG', '2026-10-21'::date, '2026-10-24'::date, null, 'Agenda 2026/2'),
  ('fx-fer3', 'feriado', 'Feriados de fim de outubro (28/10 e 2/11)', '2026-10-28'::date, '2026-11-02'::date, null, 'Agenda 2026/2'),
  ('fx-rg4', 'equipe', 'Reunião Geral (prevista)', '2026-11-07'::date, '2026-11-07'::date, null, 'Agenda 2026/2'),
  ('fx-melhor', 'equipe', 'Melhor semana para evento', '2026-11-09'::date, '2026-11-15'::date, 'Janela sugerida no planejamento do semestre para o evento anual.', 'Agenda 2026/2'),
  ('fx-aacn2', 'ufmg', 'Atividades acadêmicas complementares noturnas', '2026-11-12'::date, '2026-11-12'::date, null, 'Agenda 2026/2'),
  ('fx-fer4', 'feriado', 'Consciência Negra (20/11)', '2026-11-20'::date, '2026-11-22'::date, null, 'Agenda 2026/2'),
  ('fx-encsem', 'ufmg', 'Encerramento do semestre letivo 2026/2', '2026-12-05'::date, '2026-12-05'::date, null, 'Agenda 2026/2'),
  ('fx-fer5', 'feriado', 'Imaculada Conceição (8/12)', '2026-12-08'::date, '2026-12-08'::date, null, 'Agenda 2026/2'),
  ('fx-rg5', 'equipe', 'Reunião Geral (prevista)', '2026-12-12'::date, '2026-12-12'::date, null, 'Agenda 2026/2'),
  ('fx-recesso', 'feriado', 'Recesso de fim de ano', '2026-12-19'::date, '2026-12-31'::date, null, 'Agenda 2026/2')
on conflict (chave) where chave is not null do nothing;
-- 26 marcos semeados

-- ------------------------------------------------------------
-- 8. LEITURA ÚNICA DA AGENDA
--    O núcleo devolve, num formato só, o que existe em eventos,
--    calendario_itens e agenda_ausencias, já filtrado pelo que
--    aquela pessoa pode ver:
--      evento "equipe"     -> todo mundo
--      evento "convidados" -> dono, convidados e admin/pessoal
--      evento "privado"    -> dono e admin/pessoal
--      marco institucional -> todo mundo
--      marco pessoal       -> a pessoa e admin/pessoal
--      férias/afastamento  -> a pessoa e admin/pessoal
--      no LABBIO / remoto / ausente / não perturbe -> a equipe
--    É "para" (e não "atual") porque o feed do Google entra
--    pela mesma porta, com o token no lugar da sessão.
-- ------------------------------------------------------------
-- O formato único de um item de agenda. Recriado a cada
-- migração para que mudanças de coluna peguem sem cirurgia.
drop function if exists public.agenda_itens(date, date);
drop function if exists public.agenda_feed(uuid, date, date);
drop function if exists public.agenda_itens_para(integer, boolean, date, date);
drop type     if exists public.agenda_item;
create type public.agenda_item as (
  id             text,
  origem         text,
  ref            uuid,
  categoria      text,
  tipo           text,
  titulo         text,
  cor            text,
  data_inicio    date,
  data_fim       date,
  hora_inicio    time,
  hora_fim       time,
  dia_inteiro    boolean,
  local          text,
  meet_url       text,
  pauta          text,
  numero         integer,
  serie_id       uuid,
  recorrencia    text,
  scrum          text,
  grupo          text,
  registro       integer,
  sou_dono       boolean,
  sou_convidado  boolean,
  minha_resposta text,
  convidados     integer,
  confirmados    integer,
  visibilidade   text
);

create function public.agenda_itens_para(
  p_reg integer, p_gestor boolean, p_de date, p_ate date
) returns setof public.agenda_item language sql stable security definer
set search_path = public
as $$
  -- 1) EVENTOS
  select 'ev:' || e.id::text, 'evento', e.id,
         coalesce(t.categoria, e.categoria, 'reuniao'),
         e.tipo, e.titulo, coalesce(t.cor, '#2DD4BF'),
         e.data, e.data, e.hora_inicio, e.hora_fim, (e.hora_inicio is null),
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
    left join espacos      esp on esp.id = e.espaco_id
    left join evento_participantes meu on meu.evento_id = e.id and meu.registro = p_reg
   where e.data between p_de and p_ate
     and coalesce(e.status,'Preparação') <> 'Cancelado'
     and ( coalesce(e.visibilidade,'convidados') = 'equipe'
        or coalesce(p_gestor,false)
        or (p_reg is not null and (e.owner_registro = p_reg or meu.registro is not null)) )

  union all

  -- 2) MARCOS do calendário (a agenda antiga da gestão)
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

  -- 3) AUSÊNCIAS E INTERVALOS DE PRESENÇA
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

-- 8a. A porta da sessão: o portal chama esta.
create function public.agenda_itens(p_de date, p_ate date)
returns setof public.agenda_item language plpgsql stable security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  return query select * from public.agenda_itens_para(
    public.portal_registro_atual(),
    public.papel_atual() in ('admin','pessoal'),
    p_de, p_ate);
end $$;
revoke execute on function public.agenda_itens(date, date) from public, anon;
grant  execute on function public.agenda_itens(date, date) to authenticated;

-- 8b. A porta do feed: o Edge Function troca o token pelo
--     registro e lê exatamente a mesma coisa. Só a service role
--     executa — o token nunca vale como sessão.
create function public.agenda_feed(p_token uuid, p_de date, p_ate date)
returns setof public.agenda_item language plpgsql stable security definer
set search_path = public
as $$
declare v_reg integer;
begin
  select registro into v_reg from portal_agendas where feed_token = p_token;
  if v_reg is null then return; end if;
  -- O feed é a agenda DA PESSOA: os sinais de presença dos colegas
  -- ("no LABBIO", "ausente") ficam no portal, não vão parar no
  -- Google Agenda dela.
  return query
    select t.* from public.agenda_itens_para(v_reg, false, p_de, p_ate) t
     where t.origem <> 'ausencia' or t.registro = v_reg;
end $$;
revoke execute on function public.agenda_feed(uuid, date, date) from public, anon, authenticated;
grant  execute on function public.agenda_feed(uuid, date, date) to service_role;

-- ------------------------------------------------------------
-- 9. RECORRÊNCIA
--    "Semanal" quer dizer semanal: o banco materializa as
--    ocorrências futuras, cada uma com os seus convidados e o
--    seu RSVP. Assim a série aparece em todo lugar que lê
--    eventos — o SOMA, o assistente, o feed do Google — sem
--    ninguém precisar entender de recorrência.
--    O horizonte padrão é de 120 dias, esticado sempre que
--    alguém abre a agenda (agenda_manter_series).
-- ------------------------------------------------------------
create or replace function public.agenda_gerar_serie(p_serie uuid, p_ate date)
returns integer language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_base   public.eventos%rowtype;
  v_ultima date;
  v_passo  interval;
  v_limite date;
  v_data   date;
  v_novo   uuid;
  v_k      integer := 1;
  v_n      integer := 0;
begin
  select * into v_base from eventos where serie_id = p_serie order by data limit 1;
  if not found then return 0; end if;

  v_passo := case coalesce(v_base.recorrencia,'Única')
               when 'Semanal'   then interval '7 days'
               when 'Quinzenal' then interval '14 days'
               when 'Mensal'    then interval '1 month'
               else null end;
  if v_passo is null then return 0; end if;

  select max(data) into v_ultima from eventos where serie_id = p_serie;
  v_limite := least(p_ate, coalesce(v_base.serie_ate, p_ate));

  loop
    -- sempre a partir da data-base, para a série não escorregar
    -- de dia a cada mês (31 -> 28 -> 28…).
    v_data := (v_base.data + (v_k * v_passo))::date;
    v_k := v_k + 1;
    exit when v_data > v_limite or v_k > 500 or v_n >= 200;
    continue when v_data <= v_ultima;

    insert into eventos (titulo, tipo, data, hora, hora_inicio, hora_fim, espaco_id, local,
      recorrencia, owner_registro, grupos, pauta, status, criado_por,
      categoria, visibilidade, serie_id, serie_ate, meet_url, scrum, grupo_scrum)
    values (v_base.titulo, v_base.tipo, v_data, v_base.hora, v_base.hora_inicio, v_base.hora_fim,
      v_base.espaco_id, v_base.local, v_base.recorrencia, v_base.owner_registro, v_base.grupos,
      v_base.pauta, 'Preparação', v_base.criado_por, v_base.categoria, v_base.visibilidade,
      p_serie, v_base.serie_ate, v_base.meet_url, v_base.scrum, v_base.grupo_scrum)
    returning id into v_novo;

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em)
    select v_novo, x.registro, x.origem, coalesce(x.papel,'obrigatorio'),
           case when x.registro = v_base.owner_registro then 'vou' else 'pendente' end,
           case when x.registro = v_base.owner_registro then now() else null end
      from evento_participantes x
     where x.evento_id = v_base.id;

    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.agenda_gerar_serie(uuid, date) from public, anon;
grant  execute on function public.agenda_gerar_serie(uuid, date) to authenticated, service_role;

create or replace function public.agenda_manter_series(p_dias integer default 120)
returns integer language plpgsql volatile security definer
set search_path = public
as $$
declare r record; v_n integer := 0;
begin
  for r in
    select distinct e.serie_id
      from eventos e
     where e.serie_id is not null
       and coalesce(e.recorrencia,'Única') <> 'Única'
       and (e.serie_ate is null or e.serie_ate >= current_date)
  loop
    v_n := v_n + public.agenda_gerar_serie(r.serie_id, current_date + p_dias);
  end loop;
  return v_n;
end $$;
revoke execute on function public.agenda_manter_series(integer) from public, anon;
grant  execute on function public.agenda_manter_series(integer) to authenticated, service_role;

-- ------------------------------------------------------------
-- 10. CRIAR EVENTO
--     Uma chamada só: valida, resolve os convidados (marcados +
--     grupos + quem cria), grava, monta o checklist se o tipo
--     pedir e gera a recorrência.
--     Campos aceitos (todos opcionais menos "data"):
--       tipo, titulo, data, hora_inicio, hora_fim, espaco_id,
--       local, meet_url, pauta, visibilidade, recorrencia,
--       repetir_ate, grupos[], obrigatorios[], opcionais[],
--       todos (bool), checklist (bool), scrum, grupo_scrum
-- ------------------------------------------------------------
create or replace function public.agenda_criar_evento(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_tipo   text := coalesce(nullif(trim(p->>'tipo'),''), 'Outro');
  v_cat    public.evento_tipos%rowtype;
  v_data   date;
  v_hi     time;
  v_hf     time;
  v_rec    text := coalesce(nullif(p->>'recorrencia',''), 'Única');
  v_vis    text;
  v_grupos text[];
  v_obrig  integer[];
  v_opc    integer[];
  v_titulo text;
  v_id     uuid;
  v_num    integer;
  v_ate    date;
  v_ocor   integer := 0;
  v_quem   text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_vinculo'); end if;
  if not exists (select 1 from membros where registro = v_reg
                  and status in ('Ativo','Em pausa / avaliação','Sob demanda')) then
    return jsonb_build_object('status','sem_vinculo');
  end if;

  begin
    v_data := nullif(p->>'data','')::date;
    v_hi   := nullif(p->>'hora_inicio','')::time;
    v_hf   := nullif(p->>'hora_fim','')::time;
    v_ate  := nullif(p->>'repetir_ate','')::date;
  exception when others then
    return jsonb_build_object('status','invalido','campo','data');
  end;

  if v_data is null then return jsonb_build_object('status','invalido','campo','data'); end if;
  if v_hi is not null and v_hf is not null and v_hf <= v_hi then
    return jsonb_build_object('status','invalido','campo','horario');
  end if;
  if v_rec not in ('Única','Semanal','Quinzenal','Mensal') then
    return jsonb_build_object('status','invalido','campo','recorrencia');
  end if;

  select * into v_cat from evento_tipos where nome = v_tipo and ativo;
  if not found then
    select * into v_cat from evento_tipos where nome = 'Outro';
    v_tipo := coalesce(v_cat.nome, v_tipo);
  end if;

  v_vis := coalesce(nullif(p->>'visibilidade',''), v_cat.visibilidade, 'convidados');
  if v_vis not in ('equipe','convidados','privado') then v_vis := 'convidados'; end if;

  v_grupos := coalesce((select array_agg(g)
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'grupos') = 'array' then p->'grupos' else '[]'::jsonb end) t(g)), '{}');

  select coalesce(array_agg(distinct r), '{}') into v_obrig from (
    select v::integer as r
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'obrigatorios') = 'array' then p->'obrigatorios' else '[]'::jsonb end) t(v)
     where v ~ '^\d+$'
    union
    select m.registro from membros m
     where m.status in ('Ativo','Em pausa / avaliação')
       and ( coalesce((p->>'todos')::boolean, false)
             or (array_length(v_grupos,1) is not null and m.grupos && v_grupos) )
    union
    select v_reg
  ) s
  where r in (select registro from membros);

  select coalesce(array_agg(distinct r), '{}') into v_opc from (
    select v::integer as r
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'opcionais') = 'array' then p->'opcionais' else '[]'::jsonb end) t(v)
     where v ~ '^\d+$'
  ) s
  where r in (select registro from membros) and not (r = any(v_obrig));

  v_titulo := nullif(trim(p->>'titulo'),'');
  if v_titulo is null then
    v_titulo := v_tipo || ' — ' || to_char(v_data, 'DD/MM');
  end if;
  select coalesce(nome, email) into v_quem from perfis where id = auth.uid();

  insert into eventos (titulo, tipo, data, hora, hora_inicio, hora_fim, espaco_id, local,
    recorrencia, owner_registro, grupos, pauta, status, criado_por,
    categoria, visibilidade, serie_ate, meet_url, scrum, grupo_scrum)
  values (left(v_titulo,160), v_tipo, v_data,
    case when v_hi is null then null
         when v_hf is null then to_char(v_hi,'HH24:MI')
         else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
    v_hi, v_hf,
    nullif(p->>'espaco_id','')::integer, nullif(trim(p->>'local'),''),
    v_rec, v_reg, v_grupos, nullif(trim(p->>'pauta'),''), 'Preparação', v_quem,
    coalesce(v_cat.categoria,'reuniao'), v_vis,
    case when v_rec = 'Única' then null else v_ate end,
    nullif(trim(p->>'meet_url'),''),
    nullif(trim(p->>'scrum'),''), nullif(trim(p->>'grupo_scrum'),''))
  returning id, numero into v_id, v_num;

  insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em)
  select v_id, r, case when array_length(v_grupos,1) is not null then 'grupo' else 'manual' end,
         'obrigatorio',
         case when r = v_reg then 'vou' else 'pendente' end,
         case when r = v_reg then now() else null end
    from unnest(v_obrig) r;
  insert into evento_participantes (evento_id, registro, origem, papel, resposta)
  select v_id, r, 'manual', 'opcional', 'pendente' from unnest(v_opc) r;

  if coalesce((p->>'checklist')::boolean, false) and array_length(v_cat.checklist,1) is not null then
    insert into evento_checklist (evento_id, item, ordem)
    select v_id, item, (ix * 10)
      from unnest(v_cat.checklist) with ordinality as t(item, ix);
  end if;

  if v_rec <> 'Única' then
    update eventos set serie_id = v_id where id = v_id;
    v_ocor := public.agenda_gerar_serie(v_id, least(coalesce(v_ate, current_date + 120), current_date + 400));
  end if;

  return jsonb_build_object('status','ok', 'id', v_id, 'numero', v_num,
    'convidados', coalesce(array_length(v_obrig,1),0) + coalesce(array_length(v_opc,1),0),
    'ocorrencias', v_ocor);
end $$;
revoke execute on function public.agenda_criar_evento(jsonb) from public, anon;
grant  execute on function public.agenda_criar_evento(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 11. EDITAR O EVENTO (inclusive os convidados)
--     O SOMA App não deixava mexer nos convidados depois de
--     criado; aqui dá, com "aplicar": "este" mexe só nesta
--     ocorrência, "serie" mexe nesta e nas futuras da série.
--     Quem responde já tinha respondido continua com a sua
--     resposta — trocar o local não zera o RSVP de ninguém.
-- ------------------------------------------------------------
create or replace function public.agenda_editar_evento(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_gestor boolean := public.papel_atual() in ('admin','pessoal');
  v_ev     public.eventos%rowtype;
  v_ids    uuid[];
  v_serie  boolean := coalesce(p->>'aplicar','este') = 'serie';
  v_obrig  integer[];
  v_opc    integer[];
  v_todos  integer[];
  v_hi     time;
  v_hf     time;
begin
  select * into v_ev from eventos where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (v_gestor or (v_reg is not null and v_ev.owner_registro = v_reg)) then
    return jsonb_build_object('status','sem_permissao');
  end if;

  if v_serie and v_ev.serie_id is not null then
    select coalesce(array_agg(id), '{}') into v_ids from eventos
     where serie_id = v_ev.serie_id and data >= v_ev.data
       and coalesce(status,'Preparação') <> 'Cancelado';
  else
    v_ids := array[v_ev.id];
  end if;

  -- 1) campos simples (só o que veio no payload)
  v_hi := coalesce(nullif(p->>'hora_inicio','')::time, v_ev.hora_inicio);
  v_hf := coalesce(nullif(p->>'hora_fim','')::time,    v_ev.hora_fim);
  if v_hi is not null and v_hf is not null and v_hf <= v_hi then
    return jsonb_build_object('status','invalido','campo','horario');
  end if;

  update eventos e set
    titulo       = coalesce(nullif(trim(p->>'titulo'),''), e.titulo),
    pauta        = case when p ? 'pauta'    then nullif(trim(p->>'pauta'),'')    else e.pauta end,
    meet_url     = case when p ? 'meet_url' then nullif(trim(p->>'meet_url'),'') else e.meet_url end,
    local        = case when p ? 'local'    then nullif(trim(p->>'local'),'')    else e.local end,
    espaco_id    = case when p ? 'espaco_id' then nullif(p->>'espaco_id','')::integer else e.espaco_id end,
    visibilidade = coalesce(nullif(p->>'visibilidade',''), e.visibilidade),
    hora_inicio  = v_hi,
    hora_fim     = v_hf,
    hora         = case when v_hi is null then null
                        when v_hf is null then to_char(v_hi,'HH24:MI')
                        else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
    data         = case when not v_serie and (p ? 'data') and nullif(p->>'data','') is not null
                        then (p->>'data')::date else e.data end
  where e.id = any(v_ids);

  -- 2) convidados, quando vierem na chamada
  if (p ? 'obrigatorios') or (p ? 'opcionais') then
    select coalesce(array_agg(distinct v::integer), '{}') into v_obrig
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'obrigatorios') = 'array' then p->'obrigatorios' else '[]'::jsonb end) t(v)
     where v ~ '^\d+$';
    select coalesce(array_agg(distinct v::integer), '{}') into v_opc
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'opcionais') = 'array' then p->'opcionais' else '[]'::jsonb end) t(v)
     where v ~ '^\d+$';
    v_opc  := array(select unnest(v_opc) except select unnest(v_obrig));
    v_todos := array(select unnest(v_obrig) union select unnest(v_opc)
                     union select v_ev.owner_registro where v_ev.owner_registro is not null);

    delete from evento_participantes
     where evento_id = any(v_ids) and not (registro = any(v_todos));

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em)
    select ev, r, 'manual',
           case when r = any(v_opc) then 'opcional' else 'obrigatorio' end,
           case when r = v_ev.owner_registro then 'vou' else 'pendente' end,
           case when r = v_ev.owner_registro then now() else null end
      from unnest(v_ids) ev cross join unnest(v_todos) r
     where not exists (select 1 from evento_participantes x
                        where x.evento_id = ev and x.registro = r);

    update evento_participantes
       set papel = case when registro = any(v_opc) then 'opcional' else 'obrigatorio' end
     where evento_id = any(v_ids);
  end if;

  return jsonb_build_object('status','ok', 'eventos', coalesce(array_length(v_ids,1),0));
end $$;
revoke execute on function public.agenda_editar_evento(jsonb) from public, anon;
grant  execute on function public.agenda_editar_evento(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 12. CANCELAR
--     Cancela esta ocorrência ou a série inteira daqui para a
--     frente. Nada é apagado: o evento continua com o histórico
--     e some das telas.
-- ------------------------------------------------------------
create or replace function public.agenda_cancelar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_gestor boolean := public.papel_atual() in ('admin','pessoal');
  v_ev     public.eventos%rowtype;
  v_n      integer;
begin
  select * into v_ev from eventos where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not (v_gestor or (v_reg is not null and v_ev.owner_registro = v_reg)) then
    return jsonb_build_object('status','sem_permissao');
  end if;

  if coalesce(p->>'aplicar','este') = 'serie' and v_ev.serie_id is not null then
    update eventos set status = 'Cancelado'
     where serie_id = v_ev.serie_id and data >= v_ev.data;
    get diagnostics v_n = row_count;
    -- encerra a série para o horizonte não gerar de novo
    update eventos set serie_ate = v_ev.data - 1 where serie_id = v_ev.serie_id;
  else
    update eventos set status = 'Cancelado' where id = v_ev.id;
    get diagnostics v_n = row_count;
  end if;
  return jsonb_build_object('status','ok','eventos',v_n);
end $$;
revoke execute on function public.agenda_cancelar(jsonb) from public, anon;
grant  execute on function public.agenda_cancelar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 13. CERIMÔNIAS DE SCRUM
--     O grupo diz em que dias e a que horas faz a daily (ou a
--     abertura/fechamento de sprint), com o link do Meet, e o
--     banco cuida do resto: uma série por dia da semana
--     escolhido, convidando os ativos do grupo.
--     Quem mexe: gente do próprio grupo, ou admin/pessoal.
-- ------------------------------------------------------------
create or replace function public.agenda_scrum_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg     integer := public.portal_registro_atual();
  v_gestor  boolean := public.papel_atual() in ('admin','pessoal');
  v_grupo   text := nullif(trim(p->>'grupo'),'');
  v_cer     text := nullif(trim(p->>'cerimonia'),'');
  v_dias    integer[];
  v_hora    time;
  v_dur     integer := coalesce(nullif(p->>'duracao_min','')::integer, 15);
  v_rec     text := coalesce(nullif(p->>'recorrencia',''), 'Semanal');
  v_ativo   boolean := coalesce((p->>'ativo')::boolean, true);
  v_ate     date := nullif(p->>'repetir_ate','')::date;
  v_antigas uuid[];
  v_membros integer[];
  v_titulo  text;
  v_dia     integer;
  v_data    date;
  v_id      uuid;
  v_novas   uuid[] := '{}';
  v_n       integer := 0;
  v_quem    text;
  v_rot     text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_vinculo'); end if;
  if v_grupo is null or v_cer is null then
    return jsonb_build_object('status','invalido','campo','grupo');
  end if;
  if v_cer not in ('daily','abertura_sprint','fechamento_sprint','review','retro') then
    return jsonb_build_object('status','invalido','campo','cerimonia');
  end if;
  if not v_gestor and not exists (
    select 1 from membros where registro = v_reg and grupos @> array[v_grupo]) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_rec not in ('Semanal','Quinzenal','Mensal') then
    return jsonb_build_object('status','invalido','campo','recorrencia');
  end if;
  if v_dur < 5 or v_dur > 480 then
    return jsonb_build_object('status','invalido','campo','duracao_min');
  end if;

  begin v_hora := coalesce(nullif(p->>'hora','')::time, time '09:00');
  exception when others then return jsonb_build_object('status','invalido','campo','hora'); end;

  select coalesce(array_agg(distinct v::integer order by v::integer), '{}') into v_dias
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'dias_semana') = 'array' then p->'dias_semana' else '[]'::jsonb end) t(v)
   where v ~ '^[1-7]$';
  if array_length(v_dias,1) is null then
    return jsonb_build_object('status','invalido','campo','dias_semana');
  end if;

  v_rot := case v_cer when 'daily' then 'Daily'
                      when 'abertura_sprint' then 'Abertura de sprint'
                      when 'fechamento_sprint' then 'Fechamento de sprint'
                      when 'review' then 'Review' else 'Retrospectiva' end;
  v_titulo := v_rot || ' — ' || v_grupo;
  select coalesce(nome, email) into v_quem from perfis where id = auth.uid();

  -- apaga o que a configuração anterior tinha gerado para a frente
  select serie_ids into v_antigas from agenda_scrum where grupo = v_grupo and cerimonia = v_cer;
  if v_antigas is not null and array_length(v_antigas,1) is not null then
    update eventos set status = 'Cancelado', serie_ate = current_date - 1
     where serie_id = any(v_antigas) and data >= current_date;
  end if;

  select coalesce(array_agg(registro), '{}') into v_membros from membros
   where status in ('Ativo','Em pausa / avaliação') and grupos @> array[v_grupo];
  if not (v_reg = any(v_membros)) then v_membros := v_membros || v_reg; end if;

  if v_ativo then
    foreach v_dia in array v_dias loop
      -- primeira ocorrência: o próximo dia da semana escolhido
      v_data := current_date + ((v_dia - extract(isodow from current_date)::integer + 7) % 7);
      insert into eventos (titulo, tipo, data, hora, hora_inicio, hora_fim, local, recorrencia,
        owner_registro, grupos, status, criado_por, categoria, visibilidade,
        serie_ate, meet_url, scrum, grupo_scrum)
      values (v_titulo, 'Cerimônia de Scrum', v_data,
        to_char(v_hora,'HH24:MI') || ' às ' || to_char(v_hora + (v_dur || ' minutes')::interval,'HH24:MI'),
        v_hora, (v_hora + (v_dur || ' minutes')::interval)::time,
        nullif(trim(p->>'local'),''), v_rec, v_reg, array[v_grupo], 'Preparação', v_quem,
        'scrum', 'convidados', v_ate, nullif(trim(p->>'meet_url'),''), v_cer, v_grupo)
      returning id into v_id;

      update eventos set serie_id = v_id where id = v_id;
      insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em)
      select v_id, r, 'grupo', 'obrigatorio',
             case when r = v_reg then 'vou' else 'pendente' end,
             case when r = v_reg then now() else null end
        from unnest(v_membros) r;

      v_n := v_n + 1 + public.agenda_gerar_serie(v_id, least(coalesce(v_ate, current_date + 120), current_date + 400));
      v_novas := v_novas || v_id;
    end loop;
  end if;

  insert into agenda_scrum (grupo, cerimonia, dias_semana, hora, duracao_min, recorrencia,
                            meet_url, local, ativo, serie_ids, atualizado_por)
  values (v_grupo, v_cer, v_dias, v_hora, v_dur, v_rec,
          nullif(trim(p->>'meet_url'),''), nullif(trim(p->>'local'),''), v_ativo, v_novas, v_quem)
  on conflict (grupo, cerimonia) do update set
    dias_semana = excluded.dias_semana, hora = excluded.hora, duracao_min = excluded.duracao_min,
    recorrencia = excluded.recorrencia, meet_url = excluded.meet_url, local = excluded.local,
    ativo = excluded.ativo, serie_ids = excluded.serie_ids, atualizado_por = excluded.atualizado_por;

  return jsonb_build_object('status','ok','eventos',v_n,'series',coalesce(array_length(v_novas,1),0));
end $$;
revoke execute on function public.agenda_scrum_salvar(jsonb) from public, anon;
grant  execute on function public.agenda_scrum_salvar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 14. TOKEN DO FEED DO GOOGLE
--     agenda_feed_token() devolve (criando na primeira vez) o
--     endereço secreto de quem chamou. "rotacionar" gera outro
--     e invalida o anterior — é o botão de "perdi o link".
-- ------------------------------------------------------------
create or replace function public.agenda_feed_token(p_rotacionar boolean default false)
returns text language plpgsql volatile security definer
set search_path = public
as $$
declare v_reg integer := public.portal_registro_atual(); v_t uuid;
begin
  if v_reg is null then return null; end if;
  insert into portal_agendas (registro) values (v_reg) on conflict (registro) do nothing;
  update portal_agendas
     set feed_token = case when p_rotacionar or feed_token is null then gen_random_uuid() else feed_token end
   where registro = v_reg
   returning feed_token into v_t;
  return v_t::text;
end $$;
revoke execute on function public.agenda_feed_token(boolean) from public, anon;
grant  execute on function public.agenda_feed_token(boolean) to authenticated;

-- ------------------------------------------------------------
-- 15. OCUPAÇÃO (assistente de agendamento) — agora com as
--     ausências e os intervalos de presença como fonte.
--     Substitui a versão da SOMA 12.0: mesma assinatura, mesmo
--     contrato, mais uma fonte e a visibilidade dos títulos
--     seguindo a regra de cada tipo.
-- ------------------------------------------------------------
create or replace function public.portal_agenda_ocupacao(
  p_registros integer[],
  p_de        timestamptz,
  p_ate       timestamptz
) returns table (
  registro    integer,
  inicio      timestamptz,
  fim         timestamptz,
  dia_inteiro boolean,
  titulo      text,
  origem      text
) language sql stable security definer
set search_path = public
as $$
  -- 1) Google Agenda
  select b.registro, b.inicio, b.fim, b.dia_inteiro,
         case when a.compartilha_titulos then b.titulo end,
         'google'::text
    from portal_agenda_blocos b
    join portal_agendas a on a.registro = b.registro
   where b.registro = any(p_registros)
     and a.ativo
     and b.fim > p_de and b.inicio < p_ate

  union all

  -- 2) Eventos da agenda da equipe (inclui as reuniões marcadas
  --    por aqui e as ocorrências das séries)
  select ep.registro,
         (e.data + coalesce(e.hora_inicio, time '00:00')) at time zone 'America/Sao_Paulo',
         (e.data
           + case
               when e.hora_fim is not null and e.hora_fim > coalesce(e.hora_inicio, time '00:00')
                 then e.hora_fim - time '00:00'
               when e.hora_inicio is not null
                 then (e.hora_inicio - time '00:00') + interval '1 hour'
               else interval '1 day'
             end) at time zone 'America/Sao_Paulo',
         e.hora_inicio is null,
         e.titulo,
         'soma'::text
    from evento_participantes ep
    join eventos e on e.id = ep.evento_id
   where ep.registro = any(p_registros)
     and coalesce(e.status,'Preparação') <> 'Cancelado'
     and coalesce(ep.resposta, 'pendente') <> 'nao'
     and e.data between (p_de  at time zone 'America/Sao_Paulo')::date - 1
                    and (p_ate at time zone 'America/Sao_Paulo')::date + 1

  union all

  -- 3) Ausências e intervalos de presença. Férias e afastamento
  --    entram SEM título — a agenda diz "indisponível", nunca o
  --    motivo. "No LABBIO" e "remoto" não ocupam: a pessoa está
  --    trabalhando e pode ser chamada.
  select a.registro, a.inicio, a.fim, a.dia_inteiro,
         case when a.tipo in ('ausente','nao_perturbe')
              then case a.tipo when 'ausente' then 'Temporariamente ausente'
                               else 'Não perturbe' end end,
         'ausencia'::text
    from agenda_ausencias a
   where a.registro = any(p_registros)
     and a.tipo in ('ferias','afastamento','ausente','nao_perturbe')
     and a.fim > p_de and a.inicio < p_ate

  union all

  -- 4) Marcos individuais antigos do calendário da gestão
  --    (férias lançadas antes desta migração), também sem motivo
  select ci.registro,
         (ci.data_inicio::timestamp)                            at time zone 'America/Sao_Paulo',
         ((coalesce(ci.data_fim, ci.data_inicio) + 1)::timestamp) at time zone 'America/Sao_Paulo',
         true, null::text, 'ausencia'::text
    from calendario_itens ci
   where ci.registro = any(p_registros)
     and ci.data_inicio            <= (p_ate at time zone 'America/Sao_Paulo')::date
     and coalesce(ci.data_fim, ci.data_inicio) >= (p_de at time zone 'America/Sao_Paulo')::date;
$$;
revoke execute on function public.portal_agenda_ocupacao(integer[], timestamptz, timestamptz) from public, anon;
grant  execute on function public.portal_agenda_ocupacao(integer[], timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- 16. ACESSO DA EDGE FUNCTION DO FEED
-- ------------------------------------------------------------
grant select on public.evento_tipos, public.agenda_ausencias, public.agenda_scrum to service_role;
grant select, insert, update, delete on public.eventos, public.evento_participantes to service_role;

-- ============================================================
-- FIM — SOMA 13.0
-- Depois desta migração:
--   1) publique o index.html e o admin.html atualizados do
--      repositório "membro", e o quiosque.html / app.html do
--      repositório "nro-pessoal" (o QR do check-in passa a
--      levar ao portal);
--   2) publique a Edge Function "agenda-ics" (código em
--      supabase/functions/agenda-ics/) e DESLIGUE a verificação
--      de JWT dela — quem chama é o Google, que não tem sessão;
--      o token secreto da URL é a credencial;
--   3) cada membro assina o próprio feed em
--      /#/agenda/minha -> "Receber no Google Agenda".
--
-- O catálogo de tipos (evento_tipos) agora manda: para criar um
-- tipo novo, insira uma linha — nenhum deploy é necessário.
--
-- OPCIONAL — esticar o horizonte das séries sem depender de
-- alguém abrir o portal (o portal já faz isso ao abrir a
-- agenda, então é só uma rede de segurança):
--
--   select cron.schedule('agenda-series', '17 4 * * *',
--     $cron$ select public.agenda_manter_series(120); $cron$);
--
-- NOTA SOBRE RLS DA TABELA "eventos": a visibilidade
-- (equipe/convidados/privado) é aplicada na leitura da agenda
-- (agenda_itens). A tabela "eventos" continua com as políticas
-- que o SOMA já tinha — este arquivo não as toca, porque
-- políticas permissivas só somam acesso, nunca tiram, e apagar
-- as antigas às cegas quebraria a Gestão. Para fechar também a
-- leitura direta da tabela, confira os nomes das políticas
-- atuais e troque-as num passo à parte:
--
--   select policyname, cmd, qual from pg_policies
--    where schemaname='public' and tablename='eventos';
-- ============================================================
