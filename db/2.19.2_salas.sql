-- ============================================================
-- SOMA 2.19.2: as salas, no tablet e no celular
--
-- O tablet na porta (sala.html) foi redesenhado e o QR dele passa a abrir,
-- no celular, a tela da sala no SOMA (#/sala/<id>), com o login do membro.
-- O banco acompanha:
--
--   1. quem reservou: o evento vem com o nome do organizador (só o nome; o
--      título de evento privado continua "Reservado" e convidados nunca
--      aparecem);
--   2. a situação da sala traz o id do espaço, as reservas que ainda faltam
--      hoje e, na ocupação avulsa, quem ocupou (pelo celular) e desde quando;
--   3. ocupar vale por 30 min, 1 h ou pelo resto do dia (de 5 minutos até o
--      fim do dia, sempre antes da próxima reserva). A ocupação continua uma
--      camada à parte: não cria nem muda evento da agenda;
--   4. o celular (membro com conta ativa): sala_painel (a sala escolhida e
--      as outras do LABBIO), sala_ocupar_membro e sala_liberar_membro. A
--      ocupação pelo celular guarda o registro de quem ocupou;
--   5. as reservas do LABBIO: uma agenda própria das salas, que o LABBIO
--      controla no painel (Salas: a disponibilidade do dia, sala por sala).
--      Elas NÃO entram na agenda do SOMA. Ocupam a sala no tablet e no
--      celular, e quando uma reserva do LABBIO cruza com um evento nosso na
--      mesma sala (ou o contrário) sai um aviso: no sino de quem organizou o
--      evento e por e-mail ao responsável principal do LABBIO, uma vez por
--      versão de horário de cada par.
--
-- Depois da 2.19.1_labbio_tablets e da 2.19.1_labbio_admin. Pode rodar de novo.
-- ============================================================

alter table public.sala_ocupacoes add column if not exists registro integer references public.membros(registro);

-- 1. o evento, com o organizador ------------------------------------------------------
create or replace function public.sala_evento_json(e eventos)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id,
    'titulo', case when coalesce(e.visibilidade, '') in ('privado', 'privada') then 'Reservado' else e.titulo end,
    'organizador', (select nome from membros where registro = e.owner_registro),
    'data', e.data, 'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'),
    'inicio', (e.data + coalesce(e.hora_inicio, '00:00')) at time zone 'America/Sao_Paulo',
    'fim', (e.data + coalesce(e.hora_fim, '24:00')) at time zone 'America/Sao_Paulo') $$;

-- as reservas do LABBIO e os avisos de conflito já dados ------------------------------------
create table if not exists public.labbio_reservas (
  id            uuid primary key default gen_random_uuid(),
  espaco_id     integer not null references espacos(id),
  data          date not null,
  hora_inicio   time not null,
  hora_fim      time not null,
  titulo        text not null check (length(btrim(titulo)) > 0),
  responsavel   text,                  -- quem vai usar (texto livre: o LABBIO atende gente de fora)
  observacao    text,
  criada_por    uuid references labbio_gestores(id),
  criada_por_nome text,
  criada_em     timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  cancelada_em  timestamptz,
  check (hora_fim > hora_inicio));
create index if not exists labbio_reservas_dia on public.labbio_reservas (espaco_id, data) where cancelada_em is null;

create table if not exists public.labbio_conflitos_avisos (
  reserva_id uuid not null references labbio_reservas(id) on delete cascade,
  evento_id  uuid not null references eventos(id) on delete cascade,
  chave      text not null,            -- os horários das duas pontas: mudou um deles, vale avisar de novo
  avisado_em timestamptz not null default now(),
  primary key (reserva_id, evento_id, chave));

do $$ declare t text; begin
  foreach t in array array['labbio_reservas', 'labbio_conflitos_avisos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

create or replace function public.labbio_reserva_json(r labbio_reservas)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'origem', 'labbio', 'titulo', r.titulo, 'organizador', coalesce(nullif(btrim(r.responsavel), ''), 'LABBIO'),
    'data', r.data, 'hora_inicio', to_char(r.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(r.hora_fim, 'HH24:MI'),
    'inicio', (r.data + r.hora_inicio) at time zone 'America/Sao_Paulo',
    'fim', (r.data + r.hora_fim) at time zone 'America/Sao_Paulo') $$;

-- tudo o que ocupa a sala num período: os eventos da agenda e as reservas do LABBIO
create or replace function public.sala_blocos(p_espaco integer, p_de date, p_ate date)
returns setof jsonb language sql stable security definer set search_path = public as $$
  select sala_evento_json(e) || jsonb_build_object('origem', 'soma') from eventos e
   where e.espaco_id = p_espaco and coalesce(e.status, '') <> 'Cancelado' and e.data between p_de and p_ate
  union all
  select labbio_reserva_json(r) from labbio_reservas r
   where r.espaco_id = p_espaco and r.cancelada_em is null and r.data between p_de and p_ate $$;

-- os eventos que cruzam uma reserva (intervalos semiabertos; evento sem hora = o dia todo)
create or replace function public.labbio_reserva_cruza(r labbio_reservas)
returns setof eventos language sql stable security definer set search_path = public as $$
  select e.* from eventos e
   where r.cancelada_em is null and e.espaco_id = r.espaco_id and e.data = r.data and coalesce(e.status, '') <> 'Cancelado'
     and coalesce(e.hora_inicio, '00:00') < r.hora_fim and r.hora_inicio < coalesce(e.hora_fim, '24:00') $$;

-- o aviso de um par em conflito: sino de quem organizou o evento e e-mail ao responsável principal do LABBIO
create or replace function public.labbio_conflito_avisar(r labbio_reservas, e eventos)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_sala text := (select nome from espacos where id = r.espaco_id);
        v_tit text := case when coalesce(e.visibilidade, '') in ('privado', 'privada') then 'Reservado' else e.titulo end;
begin
  insert into labbio_conflitos_avisos (reserva_id, evento_id, chave)
  values (r.id, e.id, r.data || '|' || r.hora_inicio || '|' || r.hora_fim || '|' || labbio_evento_chave(e))
  on conflict do nothing;
  if not found then return; end if;
  perform notificar(array[e.owner_registro], 'agenda', 'Conflito de sala com o LABBIO',
    format('%s, %s: o LABBIO tem "%s" das %s às %s, no mesmo horário do seu evento "%s". Combine com o LABBIO ou mude a sala.',
           v_sala, to_char(r.data, 'DD/MM'), r.titulo, to_char(r.hora_inicio, 'HH24:MI'), to_char(r.hora_fim, 'HH24:MI'), e.titulo),
    '#/agenda/evento/' || e.id);
  insert into labbio_envios (tipo, para_email, para_nome, assunto, dados)
  select 'conflito_sala', g.email, g.nome, 'Conflito de sala: ' || v_sala || ', ' || to_char(r.data, 'DD/MM'),
         jsonb_build_object('caminho', '/labbio/#/salas?d=' || r.data, 'sala', v_sala, 'data', r.data,
           'reserva', r.titulo, 'reserva_horario', to_char(r.hora_inicio, 'HH24:MI') || ' às ' || to_char(r.hora_fim, 'HH24:MI'),
           'evento', v_tit, 'evento_horario', coalesce(to_char(e.hora_inicio, 'HH24:MI') || ' às ' || to_char(e.hora_fim, 'HH24:MI'), 'o dia todo'),
           'organizador', (select nome from membros where registro = e.owner_registro))
    from labbio_gestores g where g.principal and g.situacao = 'ativo';
end $$;

-- o outro sentido: um evento nosso que passa a cruzar uma reserva do LABBIO
create or replace function public.labbio_evento_conflito()
returns trigger language plpgsql security definer set search_path = public as $$
declare r labbio_reservas;
begin
  if new.espaco_id is null or coalesce(new.status, '') = 'Cancelado' then return new; end if;
  for r in select * from labbio_reservas x
            where x.cancelada_em is null and x.espaco_id = new.espaco_id and x.data = new.data
              and coalesce(new.hora_inicio, '00:00') < x.hora_fim and x.hora_inicio < coalesce(new.hora_fim, '24:00') loop
    perform labbio_conflito_avisar(r, new);
  end loop;
  return new;
end $$;
drop trigger if exists labbio_evento_conflito on public.eventos;
create trigger labbio_evento_conflito after insert or update of data, hora_inicio, hora_fim, espaco_id, status on public.eventos
  for each row execute function public.labbio_evento_conflito();

-- 2. a situação ------------------------------------------------------------------------
create or replace function public.sala_situacao(p_espaco integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_hoje date := (now() at time zone 'America/Sao_Paulo')::date; v_atual jsonb; v_prox jsonb; v_ocup sala_ocupacoes; v_lista jsonb;
begin
  select coalesce(jsonb_agg(b order by b->>'inicio'), '[]') into v_lista from sala_blocos(p_espaco, v_hoje - 1, v_hoje + 7) b
   where (b->>'fim')::timestamptz > now();
  select b into v_atual from jsonb_array_elements(v_lista) b where (b->>'inicio')::timestamptz <= now() order by b->>'inicio' limit 1;
  select b into v_prox from jsonb_array_elements(v_lista) b where (b->>'inicio')::timestamptz > now() order by b->>'inicio' limit 1;
  v_ocup := (select o from sala_ocupacoes o where o.espaco_id = p_espaco and o.ate > now() and o.inicio <= now() order by o.ate desc limit 1);
  return jsonb_build_object(
    'espaco_id', p_espaco,
    'estado', case when v_atual is not null then 'evento' when v_ocup.id is not null then 'ocupada' else 'livre' end,
    'agora', now(),
    'evento', v_atual,
    'proximo', v_prox,
    'ocupada_ate', case when v_atual is null then v_ocup.ate end,
    'ocupada_desde', case when v_atual is null then v_ocup.inicio end,
    'ocupada_por', case when v_atual is null and v_ocup.registro is not null then (select nome from membros where registro = v_ocup.registro) end,
    -- as reservas que ainda não acabaram hoje (a atual, se houver, primeiro)
    'hoje', coalesce((select jsonb_agg(b order by b->>'inicio') from (select b from jsonb_array_elements(v_lista) b
                       where (b->>'data')::date = v_hoje order by b->>'inicio' limit 8) x(b)), '[]'));
end $$;

-- 3. ocupar e liberar (o tablet e o celular passam por aqui) -----------------------------
create or replace function public.sala_ocupar_espaco(p_espaco integer, p_minutos integer, p_disp uuid, p_reg integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s jsonb; v_ate timestamptz; v_fim_dia timestamptz;
begin
  if p_minutos is null or p_minutos < 5 or p_minutos > 1440 then return jsonb_build_object('status', 'invalido'); end if;
  perform pg_advisory_xact_lock(hashtext('sala'), p_espaco);
  s := sala_situacao(p_espaco);
  if s->>'estado' = 'evento' then return jsonb_build_object('status', 'em_evento') || s; end if;
  -- nunca passa do fim do dia, nem do começo da próxima reserva
  v_fim_dia := (((now() at time zone 'America/Sao_Paulo')::date + 1)::timestamp) at time zone 'America/Sao_Paulo';
  v_ate := least(now() + make_interval(mins => p_minutos), v_fim_dia);
  if s->'proximo' is not null and (s->'proximo'->>'inicio')::timestamptz < v_ate then v_ate := (s->'proximo'->>'inicio')::timestamptz; end if;
  if v_ate <= now() + interval '1 minute' then return jsonb_build_object('status', 'sem_tempo') || s; end if;
  update sala_ocupacoes set ate = now() where espaco_id = p_espaco and ate > now();
  insert into sala_ocupacoes (espaco_id, dispositivo_id, registro, ate) values (p_espaco, p_disp, p_reg, v_ate);
  return jsonb_build_object('status', 'ok') || sala_situacao(p_espaco);
end $$;

create or replace function public.sala_ocupar(p_token text, p_minutos integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare d sala_dispositivos := sala_dispositivo(p_token);
begin
  if d.id is null then return jsonb_build_object('status', 'dispositivo_invalido'); end if;
  return sala_ocupar_espaco(d.espaco_id, p_minutos, d.id, null);
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

-- 4. o celular -------------------------------------------------------------------------
create or replace function public.sala_membro_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select public.portal_registro_atual() is not null and public.conta_ativa() $$;

create or replace function public.sala_painel(p_espaco integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not sala_membro_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from espacos where id = p_espaco and labbio and coalesce(ativo, true)) then
    return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok',
    'sala', jsonb_build_object('id', p_espaco, 'nome', (select nome from espacos where id = p_espaco)) || sala_situacao(p_espaco),
    'outras', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'nome', s.nome) || sala_situacao(s.id) order by s.ordem, s.nome)
       from espacos s where s.labbio and coalesce(s.ativo, true) and s.id <> p_espaco), '[]'));
end $$;

create or replace function public.sala_ocupar_membro(p_espaco integer, p_minutos integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not sala_membro_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from espacos where id = p_espaco and labbio and coalesce(ativo, true)) then
    return jsonb_build_object('status', 'nao_encontrado'); end if;
  return sala_ocupar_espaco(p_espaco, p_minutos, null, portal_registro_atual());
end $$;

create or replace function public.sala_liberar_membro(p_espaco integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not sala_membro_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from espacos where id = p_espaco and labbio and coalesce(ativo, true)) then
    return jsonb_build_object('status', 'nao_encontrado'); end if;
  update sala_ocupacoes set ate = now() where espaco_id = p_espaco and ate > now();
  return jsonb_build_object('status', 'ok') || sala_situacao(p_espaco);
end $$;

-- 5. o LABBIO: a disponibilidade do dia e as reservas próprias -------------------------------
create or replace function public.labbio_salas_disponibilidade(p_dia date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_dia is null then return jsonb_build_object('status', 'invalido'); end if;
  return jsonb_build_object('status', 'ok', 'dia', p_dia,
    'espacos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'consulta', consulta_labbio) order by ordem, nome)
                          from espacos where labbio and coalesce(ativo, true)), '[]'),
    'blocos', coalesce((select jsonb_agg(b || jsonb_build_object('espaco_id', s.id,
         -- o que cruza este bloco na mesma sala (o LABBIO vê os dois lados)
         'conflito', exists (select 1 from sala_blocos(s.id, p_dia, p_dia) o
                              where o->>'id' <> b->>'id' and o->>'origem' <> b->>'origem'
                                and (o->>'inicio')::timestamptz < (b->>'fim')::timestamptz and (b->>'inicio')::timestamptz < (o->>'fim')::timestamptz),
         'consulta', case when b->>'origem' = 'soma' then (select c.situacao from labbio_consultas c where c.evento_id = (b->>'id')::uuid and c.situacao <> 'invalidada' limit 1) end,
         'responsavel', case when b->>'origem' = 'labbio' then (select responsavel from labbio_reservas where id = (b->>'id')::uuid) end,
         'observacao', case when b->>'origem' = 'labbio' then (select observacao from labbio_reservas where id = (b->>'id')::uuid) end)
         order by s.ordem, s.nome, b->>'inicio')
       from espacos s cross join lateral sala_blocos(s.id, p_dia, p_dia) b
      where s.labbio and coalesce(s.ativo, true)), '[]'));
end $$;

create or replace function public.labbio_reserva_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g labbio_gestores; r labbio_reservas; e eventos; v_id uuid := nullif(p->>'id', '')::uuid;
        v_esp integer := nullif(p->>'espaco_id', '')::integer; v_dia date := nullif(p->>'data', '')::date;
        v_hi time := nullif(p->>'hora_inicio', '')::time; v_hf time := nullif(p->>'hora_fim', '')::time;
        v_tit text := btrim(coalesce(p->>'titulo', '')); v_conf jsonb := '[]';
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  if v_esp is null or not exists (select 1 from espacos where id = v_esp and labbio and coalesce(ativo, true)) then
    return jsonb_build_object('status', 'invalido', 'campo', 'sala'); end if;
  if v_dia is null then return jsonb_build_object('status', 'invalido', 'campo', 'data'); end if;
  if v_hi is null or v_hf is null or v_hf <= v_hi then return jsonb_build_object('status', 'invalido', 'campo', 'horario'); end if;
  if length(v_tit) = 0 then return jsonb_build_object('status', 'invalido', 'campo', 'titulo'); end if;
  if v_id is null then
    insert into labbio_reservas (espaco_id, data, hora_inicio, hora_fim, titulo, responsavel, observacao, criada_por, criada_por_nome)
    values (v_esp, v_dia, v_hi, v_hf, v_tit, nullif(btrim(coalesce(p->>'responsavel', '')), ''), nullif(btrim(coalesce(p->>'observacao', '')), ''),
            g.id, coalesce(g.nome, labbio_ator_nome()))
    returning * into r;
    perform labbio_auditar('reserva_criar', r.id, jsonb_build_object('espaco', v_esp, 'data', v_dia));
  else
    update labbio_reservas set espaco_id = v_esp, data = v_dia, hora_inicio = v_hi, hora_fim = v_hf, titulo = v_tit,
           responsavel = nullif(btrim(coalesce(p->>'responsavel', '')), ''), observacao = nullif(btrim(coalesce(p->>'observacao', '')), ''),
           atualizada_em = now()
     where id = v_id and cancelada_em is null returning * into r;
    if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
    perform labbio_auditar('reserva_editar', r.id, jsonb_build_object('espaco', v_esp, 'data', v_dia));
  end if;
  -- o LABBIO decide a própria agenda: o conflito não impede, mas avisa os dois lados
  for e in select * from labbio_reserva_cruza(r) loop
    perform labbio_conflito_avisar(r, e);
    v_conf := v_conf || jsonb_build_array(jsonb_build_object('titulo', case when coalesce(e.visibilidade, '') in ('privado', 'privada') then 'Reservado' else e.titulo end,
      'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(e.hora_fim, 'HH24:MI'),
      'organizador', (select nome from membros where registro = e.owner_registro)));
  end loop;
  return jsonb_build_object('status', 'ok', 'id', r.id, 'conflitos', v_conf);
end $$;

create or replace function public.labbio_reserva_cancelar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  update labbio_reservas set cancelada_em = now(), atualizada_em = now() where id = p_id and cancelada_em is null;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  perform labbio_auditar('reserva_cancelar', p_id);
  return jsonb_build_object('status', 'ok');
end $$;

-- 6. permissões -------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['sala_evento_json(eventos)', 'sala_situacao(integer)', 'sala_ocupar_espaco(integer,integer,uuid,integer)',
                           'sala_membro_pode()', 'labbio_reserva_json(labbio_reservas)', 'sala_blocos(integer,date,date)',
                           'labbio_reserva_cruza(labbio_reservas)', 'labbio_conflito_avisar(labbio_reservas,eventos)', 'labbio_evento_conflito()'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['sala_estado(text)', 'sala_ocupar(text,integer)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then execute 'grant execute on function public.' || f || ' to anon'; end if;
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  foreach f in array array['sala_painel(integer)', 'sala_ocupar_membro(integer,integer)', 'sala_liberar_membro(integer)',
                           'labbio_salas_disponibilidade(date)', 'labbio_reserva_salvar(jsonb)', 'labbio_reserva_cancelar(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public';
    if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke execute on function public.' || f || ' from anon'; end if;
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.2_salas',
 'SOMA 2.19.2: as salas no tablet e no celular (organizador, reservas de hoje, ocupar por 30 min, 1 h ou o resto do dia, ver, ocupar e liberar pelo celular) e as reservas próprias do LABBIO, fora da agenda do SOMA, com aviso de conflito nos dois sentidos')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, nome, labbio, consulta_labbio from public.espacos where labbio order by ordem, nome;
-- select r.data, r.hora_inicio, r.hora_fim, s.nome, r.titulo, r.responsavel from public.labbio_reservas r
--   join public.espacos s on s.id = r.espaco_id where r.cancelada_em is null and r.data >= current_date order by r.data, r.hora_inicio;
-- select o.inicio, o.ate, s.nome as sala, m.nome as quem from public.sala_ocupacoes o
--   join public.espacos s on s.id = o.espaco_id left join public.membros m on m.registro = o.registro
--  order by o.inicio desc limit 10;
