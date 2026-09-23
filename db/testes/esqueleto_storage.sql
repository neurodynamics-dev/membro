-- O mínimo do Supabase que a 20.0 usa e o PostgreSQL puro não tem:
-- auth.uid() e o schema storage (buckets, objects, foldername). Com
-- RLS ligada em storage.objects, como no Supabase — é isso que deixa
-- testar as políticas do bucket "arquivos" de verdade.
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('teste.uid', true), '')::uuid $$;
grant usage on schema auth to authenticated;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id),
  name text not null, owner uuid default auth.uid(), created_at timestamptz default now(),
  metadata jsonb, unique (bucket_id, name));
create or replace function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;

-- perfis ganha o id da conta ligado ao registro, como no Supabase
alter table public.perfis add column if not exists nome text;
