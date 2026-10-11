-- ============================================================
-- SOMA 2.19.1: tablets na porta das salas
--
-- Um tablet por sala, sem login de pessoa: o aparelho tem um token próprio
-- (gerado no painel, mostrado uma vez, guardado só como hash), restrito à
-- sala, revogável. A página sala.html?d=<token> lê o estado e pode marcar
-- "ocupar por alguns minutos" ou "liberar".
--
-- Estado, nesta ordem: evento da agenda em andamento → ocupação temporária
-- ainda válida → livre. A ocupação temporária é uma camada à parte (não cria
-- nem muda evento), vale no máximo 30 minutos, termina antes da próxima
-- reserva e expira pelo relógio do servidor. Evento privado aparece como
-- "Reservado"; o tablet nunca mostra convidados.
--
-- Gestão (painel do LABBIO e admin do SOMA): labbio_dispositivo_criar,
-- labbio_dispositivos, labbio_dispositivo_revogar. O tablet (anon):
-- sala_estado, sala_ocupar, sala_liberar.
--
-- Depende da 2.19.1_labbio_salas. Só acrescenta; pode rodar de novo.
-- ============================================================

create table if not exists public.sala_dispositivos (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     integer not null references espacos(id),
  rotulo        text not null check (length(btrim(rotulo)) > 0),
  token_hash    text not null unique,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  revogado_em   timestamptz,
  ultimo_contato timestamptz);

create table if not exists public.sala_ocupacoes (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     integer not null references espacos(id),
  dispositivo_id uuid references sala_dispositivos(id),
  inicio        timestamptz not null default now(),
  ate           timestamptz not null);
create index if not exists sala_ocupacoes_esp on public.sala_ocupacoes (espaco_id, ate desc);

do $$ declare t text; begin
  foreach t in array array['sala_dispositivos', 'sala_ocupacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 1. a gestão --------------------------------------------------------------------
create or replace function public.labbio_dispositivo_criar(p_espaco integer, p_rotulo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_token text := left(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 48); v_id uuid;
begin
  if not (conta_labbio() or labbio_admin()) then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from espacos where id = p_espaco and labbio) then return jsonb_build_object('status', 'espaco_invalido'); end if;
  if length(btrim(coalesce(p_rotulo, ''))) = 0 then return jsonb_build_object('status', 'rotulo_obrigatorio'); end if;
  insert into sala_dispositivos (espaco_id, rotulo, token_hash) values (p_espaco, btrim(p_rotulo), encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  returning id into v_id;
  perform labbio_auditar('dispositivo_criar', v_id, jsonb_build_object('espaco', p_espaco));
  -- o token sai só agora: quem configura o tablet copia o endereço
  return jsonb_build_object('status', 'ok', 'id', v_id, 'endereco', 'sala.html?d=' || v_token);
end $$;

create or replace function public.labbio_dispositivos()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (public.conta_labbio() or public.labbio_admin()) then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'dispositivos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'rotulo', d.rotulo,
        'espaco_id', d.espaco_id, 'espaco', s.nome, 'ativo', d.ativo, 'criado_em', d.criado_em, 'revogado_em', d.revogado_em,
        'ultimo_contato', d.ultimo_contato) order by d.ativo desc, s.nome, d.rotulo)
      from sala_dispositivos d join espacos s on s.id = d.espaco_id), '[]')) end $$;

create or replace function public.labbio_dispositivo_revogar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not (conta_labbio() or labbio_admin()) then return jsonb_build_object('status', 'sem_permissao'); end if;
  update sala_dispositivos set ativo = false, revogado_em = now() where id = p_id and ativo;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  perform labbio_auditar('dispositivo_revogar', p_id);
  return jsonb_build_object('status', 'ok');
end $$;

-- 2. o tablet ----------------------------------------------------------------------
create or replace function public.sala_dispositivo(p_token text)
returns sala_dispositivos language sql stable security definer set search_path = public as $$
  select * from sala_dispositivos where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex') and ativo $$;

-- os eventos da sala em horário local (a agenda guarda data e hora locais)
create or replace function public.sala_evento_json(e eventos)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id,
    'titulo', case when coalesce(e.visibilidade, '') in ('privado', 'privada') then 'Reservado' else e.titulo end,
    'data', e.data, 'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'),
    'inicio', (e.data + coalesce(e.hora_inicio, '00:00')) at time zone 'America/Sao_Paulo',
    'fim', (e.data + coalesce(e.hora_fim, '24:00')) at time zone 'America/Sao_Paulo') $$;

create or replace function public.sala_situacao(p_espaco integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_atual eventos; v_prox eventos; v_ocup sala_ocupacoes;
begin
  select * into v_atual from eventos e
   where e.espaco_id = p_espaco and coalesce(e.status, '') <> 'Cancelado'
     and (e.data + coalesce(e.hora_inicio, '00:00')) at time zone 'America/Sao_Paulo' <= now()
     and (e.data + coalesce(e.hora_fim, '24:00')) at time zone 'America/Sao_Paulo' > now()
   order by e.hora_inicio limit 1;
  select * into v_prox from eventos e
   where e.espaco_id = p_espaco and coalesce(e.status, '') <> 'Cancelado'
     and (e.data + coalesce(e.hora_inicio, '00:00')) at time zone 'America/Sao_Paulo' > now()
     and e.data <= (now() at time zone 'America/Sao_Paulo')::date + 7
   order by e.data, e.hora_inicio limit 1;
  select * into v_ocup from sala_ocupacoes where espaco_id = p_espaco and ate > now() and inicio <= now() order by ate desc limit 1;
  return jsonb_build_object(
    'estado', case when v_atual.id is not null then 'evento' when v_ocup.id is not null then 'ocupada' else 'livre' end,
    'agora', now(),
    'evento', case when v_atual.id is not null then sala_evento_json(v_atual) end,
    'proximo', case when v_prox.id is not null then sala_evento_json(v_prox) end,
    'ocupada_ate', case when v_atual.id is null then v_ocup.ate end);
end $$;

create or replace function public.sala_estado(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d sala_dispositivos := sala_dispositivo(p_token);
begin
  if d.id is null then return jsonb_build_object('status', 'dispositivo_invalido'); end if;
  if d.ultimo_contato is null or d.ultimo_contato < now() - interval '5 minutes' then
    update sala_dispositivos set ultimo_contato = now() where id = d.id;
  end if;
  return jsonb_build_object('status', 'ok', 'sala', (select nome from espacos where id = d.espaco_id), 'rotulo', d.rotulo)
         || sala_situacao(d.espaco_id);
end $$;

create or replace function public.sala_ocupar(p_token text, p_minutos integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d sala_dispositivos := sala_dispositivo(p_token); s jsonb; v_ate timestamptz;
begin
  if d.id is null then return jsonb_build_object('status', 'dispositivo_invalido'); end if;
  if p_minutos is null or p_minutos < 5 or p_minutos > 30 then return jsonb_build_object('status', 'invalido'); end if;
  perform pg_advisory_xact_lock(hashtext('sala'), d.espaco_id);
  s := sala_situacao(d.espaco_id);
  if s->>'estado' = 'evento' then return jsonb_build_object('status', 'em_evento') || s; end if;
  v_ate := now() + make_interval(mins => p_minutos);
  if s->'proximo' is not null and (s->'proximo'->>'inicio')::timestamptz < v_ate then v_ate := (s->'proximo'->>'inicio')::timestamptz; end if;
  if v_ate <= now() + interval '1 minute' then return jsonb_build_object('status', 'sem_tempo') || s; end if;
  update sala_ocupacoes set ate = now() where espaco_id = d.espaco_id and ate > now();
  insert into sala_ocupacoes (espaco_id, dispositivo_id, ate) values (d.espaco_id, d.id, v_ate);
  return jsonb_build_object('status', 'ok') || sala_situacao(d.espaco_id);
end $$;

create or replace function public.sala_liberar(p_token text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d sala_dispositivos := sala_dispositivo(p_token);
begin
  if d.id is null then return jsonb_build_object('status', 'dispositivo_invalido'); end if;
  update sala_ocupacoes set ate = now() where espaco_id = d.espaco_id and ate > now();
  return jsonb_build_object('status', 'ok') || sala_situacao(d.espaco_id);
end $$;

-- 3. permissões ---------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['sala_dispositivo(text)', 'sala_evento_json(eventos)', 'sala_situacao(integer)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['labbio_dispositivo_criar(integer,text)', 'labbio_dispositivos()', 'labbio_dispositivo_revogar(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['sala_estado(text)', 'sala_ocupar(text,integer)', 'sala_liberar(text)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then execute 'grant execute on function public.' || f || ' to anon'; end if;
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_labbio_tablets',
 'SOMA 2.19.1: tablets na porta das salas: token por aparelho, estado (evento, ocupação temporária, livre) e ocupar/liberar sem mexer na agenda')
on conflict(id) do nothing;
