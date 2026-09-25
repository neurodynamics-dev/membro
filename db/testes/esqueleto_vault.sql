-- O mínimo do Vault do Supabase que a 27.0 usa e o PostgreSQL puro não
-- tem: o schema vault, a tabela de segredos, a view que decifra e as
-- duas funções de gravar. No Supabase, o segredo é cifrado com uma chave
-- que mora fora do banco; aqui ele fica em claro — o que se testa é o
-- caminho do cofre (quem lê, quem grava, o que fica registrado), não a
-- cifra, que é do Supabase. Como lá, quem não é dono não entra no schema.
create schema if not exists vault;
create table if not exists vault.secrets (
  id          uuid primary key default gen_random_uuid(),
  name        text unique,
  description text not null default '',
  secret      text not null,
  key_id      uuid,
  nonce       bytea,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now());
create or replace view vault.decrypted_secrets as
  select id, name, description, secret, secret as decrypted_secret, key_id, nonce, created_at, updated_at
    from vault.secrets;
create or replace function vault.create_secret(new_secret text, new_name text default null,
  new_description text default '', new_key_id uuid default null)
returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into vault.secrets (secret, name, description, key_id)
  values (new_secret, new_name, coalesce(new_description, ''), new_key_id) returning id into v;
  return v;
end $$;
create or replace function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null,
  new_description text default null, new_key_id uuid default null)
returns void language plpgsql as $$
begin
  update vault.secrets
     set secret = coalesce(new_secret, secret), name = coalesce(new_name, name),
         description = coalesce(new_description, description), key_id = coalesce(new_key_id, key_id),
         updated_at = now()
   where id = secret_id;
end $$;
revoke all on schema vault from public;
revoke all on all tables in schema vault from public;
