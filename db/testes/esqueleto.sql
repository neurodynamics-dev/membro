create extension if not exists pgcrypto;

-- papéis, como no Supabase
do $$ begin
  if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname='app') then create role app login password 'x'; end if;
end $$;
grant authenticated to app;
grant usage on schema public to anon, authenticated;

create table membros(
  registro integer primary key, nome text not null, cargo text, departamento text,
  status text default 'Ativo', grupos text[] default '{}', gestor_registro integer,
  email_nro text, email_pessoal text, foto_url text);
create table perfis(id uuid primary key, email text, papel text default 'leitura', registro integer);
create table eventos(id uuid primary key default gen_random_uuid(), numero serial, titulo text,
  data date, hora_inicio time, hora_fim time, status text default 'Preparação');
create table calendario_itens(id uuid primary key default gen_random_uuid(), titulo text not null,
  tipo text, data_inicio date not null, data_fim date, observacao text, registro integer);
create table agenda_ausencias(id uuid primary key default gen_random_uuid(), registro integer not null,
  tipo text not null, inicio timestamptz not null, fim timestamptz not null,
  dia_inteiro boolean default false, observacao text);
create table migracoes(id text primary key, descricao text, aplicada_em timestamptz default now());

create table portal_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  numero integer generated always as identity,
  protocolo text unique,
  registro integer not null references membros(registro) on delete cascade,
  tipo text not null check (tipo in ('acesso','afastamento','desligamento','reuniao_1_1','outro')),
  status text not null default 'aberta'
    check (status in ('aberta','em_analise','aprovada','recusada','concluida','cancelada')),
  titulo text not null, dados jsonb not null default '{}'::jsonb,
  resposta text, respondido_por text, respondido_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now());

create table itens_de_acesso (id uuid primary key default gen_random_uuid(),
  nome text not null, categoria text, ativo boolean default true, ordem integer default 0);
create table acessos_concedidos (id uuid primary key default gen_random_uuid(),
  registro integer not null references membros(registro) on delete cascade,
  item_id uuid not null references itens_de_acesso(id) on delete cascade,
  ativo boolean not null default true, concedido_em date, revogado_em date, responsavel text,
  unique (registro, item_id));
create table ocorrencias (id uuid primary key default gen_random_uuid(),
  registro integer not null references membros(registro) on delete cascade,
  tipo text not null, descricao text, data date default current_date, responsavel text);
create table apontamentos (id uuid primary key default gen_random_uuid(),
  grupo text, data date default current_date, responsavel text, responsavel_id uuid);
create table apontamento_itens (id uuid primary key default gen_random_uuid(),
  apontamento_id uuid references apontamentos(id) on delete cascade,
  registro integer, data date, assiduidade text, entregas text,
  sinalizado boolean default false, justificativa text, tratado boolean default false);

create or replace function portal_registro_atual() returns integer language sql stable as $$
  select nullif(current_setting('teste.registro', true), '')::integer $$;
create or replace function papel_atual() returns text language sql stable as $$
  select coalesce(nullif(current_setting('teste.papel', true), ''), 'leitura') $$;

insert into membros(registro,nome,grupos,gestor_registro,email_nro,status) values
  (4,'Ana Figueiredo','{Órtese,Gestão}',null,'ana@nro.dev','Ativo'),
  (11,'Bruno Tavares','{Sinais}',4,'bruno@nro.dev','Ativo'),
  (17,'Carla Mendonça','{Órtese}',4,'carla@nro.dev','Ativo'),
  (23,'Diego Prado','{Comunicação}',4,'diego@nro.dev','Ativo'),
  (31,'Elis Ramalho','{"Depto de Pessoal"}',4,'elis@nro.dev','Ativo');

insert into itens_de_acesso(nome,categoria) values
  ('Laboratório 2','local'), ('Drive da equipe','sistema'), ('Manual de bancada','documento');
