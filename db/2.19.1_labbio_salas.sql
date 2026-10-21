-- ============================================================
-- SOMA 2.19.1: consulta ao LABBIO para a Sala de Reuniões e o Auditório
--
-- Espaços do LABBIO ficam marcados (espacos.labbio); alguns pedem consulta
-- (espacos.consulta_labbio: Sala de Reuniões e Auditório). Salvar um evento
-- num espaço com consulta cria uma consulta para o LABBIO, presa à
-- ocorrência (cada ocorrência da série é uma linha de eventos) e à versão
-- de local e horário: mudar data, horário, espaço ou cancelar invalida a
-- consulta anterior e, se ainda couber, abre outra.
--
-- A consulta é consultiva: SEM resposta, o evento segue valendo (presunção
-- de disponibilidade, nunca rotulada como confirmação). O LABBIO responde
-- "disponível" ou "conflito" (com motivo); conflito avisa o organizador uma
-- vez por decisão. Nada é cancelado ou reagendado sozinho.
--
-- Sobreposição: dois eventos no mesmo espaço e dia cujos horários se cruzam
-- (10h–11h e 11h–12h NÃO se cruzam). Mostrada ao organizador (sem título
-- de evento alheio) e ao LABBIO.
--
-- Depende da 2.19.1_labbio_base e da agenda (v28). Só acrescenta; pode
-- rodar de novo.
-- ============================================================

alter table public.espacos add column if not exists labbio boolean not null default false;
alter table public.espacos add column if not exists consulta_labbio boolean not null default false;
-- os dois espaços do pedido, pelo nome (confira depois em espacos)
update public.espacos set labbio = true, consulta_labbio = true
 where (nome ilike 'sala de reuni%' or nome ilike 'audit%') and not consulta_labbio;

create table if not exists public.labbio_consultas (
  id           uuid primary key default gen_random_uuid(),
  evento_id    uuid not null references eventos(id) on delete cascade,
  chave        text not null,          -- data|início|fim|espaço da versão consultada
  data         date not null,
  hora_inicio  time,
  hora_fim     time,
  espaco_id    integer not null,
  situacao     text not null default 'pendente' check (situacao in ('pendente', 'disponivel', 'conflito', 'invalidada')),
  motivo       text,
  decidido_por uuid references labbio_gestores(id),
  decidido_em  timestamptz,
  criada_em    timestamptz not null default now());
create unique index if not exists labbio_consultas_viva on public.labbio_consultas (evento_id) where situacao <> 'invalidada';
create index if not exists labbio_consultas_data on public.labbio_consultas (data) where situacao <> 'invalidada';
alter table public.labbio_consultas enable row level security;
revoke all on public.labbio_consultas from anon, authenticated;

create or replace function public.labbio_evento_chave(e eventos)
returns text language sql immutable as $$
  select e.data::text || '|' || coalesce(e.hora_inicio::text, '') || '|' || coalesce(e.hora_fim::text, '') || '|' || coalesce(e.espaco_id::text, '') $$;

-- 1. o gatilho: abre, mantém ou invalida a consulta da ocorrência
create or replace function public.labbio_evento_mudou()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_pede boolean; v_chave text := labbio_evento_chave(new);
begin
  v_pede := new.espaco_id is not null and coalesce(new.status, '') <> 'Cancelado'
            and exists (select 1 from espacos where id = new.espaco_id and consulta_labbio);
  -- a consulta viva de outra versão (ou de evento que não pede mais) deixa de valer
  update labbio_consultas set situacao = 'invalidada'
   where evento_id = new.id and situacao <> 'invalidada' and (not v_pede or chave <> v_chave);
  if v_pede and not exists (select 1 from labbio_consultas where evento_id = new.id and situacao <> 'invalidada') then
    insert into labbio_consultas (evento_id, chave, data, hora_inicio, hora_fim, espaco_id)
    values (new.id, v_chave, new.data, new.hora_inicio, new.hora_fim, new.espaco_id);
  end if;
  return new;
end $$;
revoke execute on function public.labbio_evento_mudou() from public, anon, authenticated;
drop trigger if exists labbio_evento_mudou on public.eventos;
create trigger labbio_evento_mudou after insert or update of data, hora_inicio, hora_fim, espaco_id, status on public.eventos
  for each row execute function public.labbio_evento_mudou();

-- 2. sobreposição no mesmo espaço e dia (intervalos semiabertos; sem hora = o dia todo)
create or replace function public.labbio_sobrepostos(p_evento uuid)
returns setof eventos language sql stable security definer set search_path = public as $$
  select o.* from eventos e join eventos o
    on o.espaco_id = e.espaco_id and o.data = e.data and o.id <> e.id and coalesce(o.status, '') <> 'Cancelado'
   where e.id = p_evento and e.espaco_id is not null
     and coalesce(o.hora_inicio, '00:00') < coalesce(e.hora_fim, '24:00')
     and coalesce(e.hora_inicio, '00:00') < coalesce(o.hora_fim, '24:00') $$;

-- 3. o organizador (e quem vê o evento): a situação, sem dados de outros eventos
create or replace function public.labbio_consulta_do_evento(p_evento uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_ativa() or public.portal_registro_atual() is null then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok',
      'consulta', (select jsonb_build_object('situacao', c.situacao, 'motivo', c.motivo, 'decidido_em', c.decidido_em, 'criada_em', c.criada_em)
                     from labbio_consultas c where c.evento_id = p_evento and c.situacao <> 'invalidada'),
      'sobreposicoes', coalesce((select jsonb_agg(jsonb_build_object('hora_inicio', to_char(o.hora_inicio, 'HH24:MI'),
                                   'hora_fim', to_char(o.hora_fim, 'HH24:MI')) order by o.hora_inicio)
                                 from public.labbio_sobrepostos(p_evento) o), '[]')) end $$;

-- 4. o LABBIO: a agenda dos espaços dele e as consultas
create or replace function public.labbio_agenda(p_de date, p_ate date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 92 then return jsonb_build_object('status', 'invalido'); end if;
  return jsonb_build_object('status', 'ok',
    'espacos', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'nome', nome, 'consulta', consulta_labbio) order by ordem, nome)
                          from espacos where labbio and coalesce(ativo, true)), '[]'),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object(
        'id', e.id, 'titulo', e.titulo, 'data', e.data, 'hora_inicio', to_char(e.hora_inicio, 'HH24:MI'),
        'hora_fim', to_char(e.hora_fim, 'HH24:MI'), 'espaco_id', e.espaco_id, 'espaco', s.nome, 'status', e.status,
        'organizador', (select nome from membros where registro = e.owner_registro),
        'convidados', coalesce((select jsonb_agg(m.nome order by m.nome) from evento_participantes p join membros m on m.registro = p.registro
                                 where p.evento_id = e.id), '[]'),
        'consulta', (select jsonb_build_object('id', c.id, 'situacao', c.situacao, 'motivo', c.motivo, 'decidido_em', c.decidido_em)
                       from labbio_consultas c where c.evento_id = e.id and c.situacao <> 'invalidada'),
        'sobreposicoes', coalesce((select jsonb_agg(jsonb_build_object('id', o.id, 'titulo', o.titulo,
                                     'hora_inicio', to_char(o.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(o.hora_fim, 'HH24:MI')))
                                   from public.labbio_sobrepostos(e.id) o), '[]')) order by e.data, e.hora_inicio)
      from eventos e join espacos s on s.id = e.espaco_id
     where s.labbio and e.data between p_de and p_ate and coalesce(e.status, '') <> 'Cancelado'), '[]'));
end $$;

create or replace function public.labbio_consulta_decidir(p_id uuid, p_disponivel boolean, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c labbio_consultas; g labbio_gestores; e eventos;
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  g.nome := coalesce(g.nome, labbio_ator_nome());  -- o admin do SOMA não tem linha de gestor
  select * into c from labbio_consultas where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if c.situacao = 'invalidada' then return jsonb_build_object('status', 'invalidada'); end if;
  if not p_disponivel and length(btrim(coalesce(p_motivo, ''))) = 0 then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  if c.situacao = (case when p_disponivel then 'disponivel' else 'conflito' end) then return jsonb_build_object('status', 'ok'); end if;
  update labbio_consultas set situacao = case when p_disponivel then 'disponivel' else 'conflito' end,
         motivo = case when p_disponivel then nullif(btrim(coalesce(p_motivo, '')), '') else btrim(p_motivo) end,
         decidido_por = g.id, decidido_em = now() where id = p_id;
  if not p_disponivel then
    select * into e from eventos where id = c.evento_id;
    perform notificar(array[e.owner_registro], 'agenda',
      'LABBIO: conflito em ' || coalesce((select nome from espacos where id = c.espaco_id), 'espaço') || ', ' || to_char(c.data, 'DD/MM'),
      e.titulo || ': ' || btrim(p_motivo) || ' O evento continua marcado; ajuste se precisar.', '#/agenda/evento/' || e.id);
  end if;
  perform labbio_auditar('consulta', g.id, jsonb_build_object('consulta', p_id, 'disponivel', p_disponivel));
  return jsonb_build_object('status', 'ok');
end $$;

do $$ declare f text; begin
  foreach f in array array['labbio_evento_chave(eventos)', 'labbio_sobrepostos(uuid)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['labbio_consulta_do_evento(uuid)', 'labbio_agenda(date,date)', 'labbio_consulta_decidir(uuid,boolean,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

do $$ declare n integer; begin
  select count(*) into n from public.espacos where consulta_labbio;
  raise notice 'LABBIO: % espaço(s) com consulta (Sala de Reuniões e Auditório, pelo nome). Confira em espacos.', n;
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_labbio_salas',
 'SOMA 2.19.1: consulta consultiva ao LABBIO para a Sala de Reuniões e o Auditório, por ocorrência e versão, com sobreposição e aviso de conflito')
on conflict(id) do nothing;

-- CONFERIR
-- select id, nome, labbio, consulta_labbio from public.espacos order by nome;
-- Marcar outros espaços do LABBIO (consultáveis, sem consulta): update public.espacos set labbio = true where nome = '...';
