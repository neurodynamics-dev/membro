-- ============================================================
-- A agenda como estava antes da 28.0, no mínimo que a 28.0 usa:
-- as colunas de eventos e evento_participantes que a 13.0 deixou,
-- os tipos, os espaços, o formato agenda_item e a porta
-- agenda_itens. Rode depois do esqueleto, do de Storage (auth.uid)
-- e da 15.0 a 19.0.
-- ============================================================
alter table public.eventos add column if not exists tipo text;
alter table public.eventos add column if not exists hora text;
alter table public.eventos add column if not exists espaco_id integer;
alter table public.eventos add column if not exists local text;
alter table public.eventos add column if not exists recorrencia text default 'Única';
alter table public.eventos add column if not exists owner_registro integer;
alter table public.eventos add column if not exists grupos text[] default '{}';
alter table public.eventos add column if not exists pauta text;
alter table public.eventos add column if not exists criado_por text;
alter table public.eventos add column if not exists categoria text default 'reuniao';
alter table public.eventos add column if not exists visibilidade text default 'convidados';
alter table public.eventos add column if not exists serie_id uuid;
alter table public.eventos add column if not exists serie_ate date;
alter table public.eventos add column if not exists meet_url text;
alter table public.eventos add column if not exists scrum text;
alter table public.eventos add column if not exists grupo_scrum text;

create table if not exists public.evento_participantes (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.eventos(id) on delete cascade,
  registro integer not null references public.membros(registro) on delete cascade,
  origem text, papel text default 'obrigatorio', resposta text default 'pendente',
  respondido_em timestamptz, unique (evento_id, registro));

create table if not exists public.evento_tipos (
  nome text primary key, categoria text not null default 'reuniao', cor text not null default '#8E8E93',
  visibilidade text not null default 'convidados', convida_todos boolean not null default false,
  checklist text[] not null default '{}', rapido boolean not null default false,
  ordem integer not null default 100, ativo boolean not null default true);
insert into public.evento_tipos (nome, categoria, cor, visibilidade, convida_todos, ordem, checklist) values
  ('Reunião geral', 'reuniao', '#2DD4BF', 'equipe', true, 10, '{Enviar convite}'),
  ('Cerimônia de Scrum', 'scrum', '#A78BFA', 'convidados', false, 20, '{}'),
  ('Teste', 'trabalho', '#F5C36A', 'convidados', false, 40, '{Definir protocolo}')
on conflict do nothing;

create table if not exists public.espacos (id serial primary key, nome text not null, ativo boolean default true, ordem integer default 0);
insert into public.espacos (nome) values ('Sala de reuniões');

do $$ begin
  if to_regtype('public.agenda_item') is null then
    create type public.agenda_item as (
      id text, origem text, ref uuid, categoria text, tipo text, titulo text, cor text,
      data_inicio date, data_fim date, hora_inicio time, hora_fim time, dia_inteiro boolean,
      local text, meet_url text, pauta text, numero integer, serie_id uuid, recorrencia text,
      scrum text, grupo text, registro integer, sou_dono boolean, sou_convidado boolean,
      minha_resposta text, convidados integer, confirmados integer, visibilidade text);
  end if;
end $$;

-- a 13.0 cria as duas; a 28.0 troca o corpo de agenda_itens_para
create or replace function public.agenda_itens_para(p_reg integer, p_gestor boolean, p_de date, p_ate date)
returns setof public.agenda_item language sql stable as $$ select null::public.agenda_item where false $$;
create or replace function public.agenda_itens(p_de date, p_ate date)
returns setof public.agenda_item language plpgsql stable security definer set search_path = public as $$
begin
  return query select * from public.agenda_itens_para(public.portal_registro_atual(),
    public.papel_atual() in ('admin','pessoal'), p_de, p_ate);
end $$;
