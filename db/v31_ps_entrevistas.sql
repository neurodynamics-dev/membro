-- ============================================================
-- SOMA 31.0 — MIGRAÇÃO · NeuroDynamics
-- AS ENTREVISTAS DO PROCESSO SELETIVO, ONLINE E COM E-MAIL.
--
--   1. QUEM ABRIU A JANELA: cada horário guarda o nome e o registro de
--      quem o abriu em Seleção › Agenda. É essa pessoa que conduz a
--      entrevista e recebe o resumo da véspera.
--   2. ONLINE: a entrevista acontece por chamada. No lugar do local,
--      o horário guarda o link (link_reuniao); horário novo de
--      entrevista não entra sem ele. A dinâmica em grupo continua
--      presencial, com local.
--   3. OS E-MAILS (ps_envios), mandados pela Edge Function
--      notificar-email:
--        confirmacao    o candidato reservou um horário, com o link;
--        reagendamento  o responsável mudou o horário (ou moveu o
--                       candidato para outro), com o novo e o link;
--        link           o link da chamada mudou, o horário não;
--        cancelamento   o horário foi excluído: escolher outro no site;
--        resumo         na véspera, a partir das 18h, cada responsável
--                       recebe as entrevistas do dia seguinte, com o
--                       perfil de cada candidato e os links. Se a lista
--                       mudar depois disso, sai um resumo atualizado.
--   4. O ACOMPANHAMENTO do site mostra o link da chamada da entrevista
--      agendada (ps_acompanhar), e os horários ofertados dizem que são
--      online (ps_horarios), sem expor o link antes da reserva.
--
-- Quem reagenda, edita e exclui: o Comitê de Seleção (eh_comite), pelas
-- funções; a fila não aceita escrita direta.
--
-- Pré-requisitos: a 6.0 e a 7.0 do processo seletivo (aplicadas/) e a
-- 10.0 (portal). Idempotente. COMO USAR: cole o arquivo INTEIRO no SQL
-- Editor e Run. Depois, publique de novo a Edge Function notificar-email
-- e o site selecao.neurodynamics.dev.
-- ============================================================

do $$
begin
  if to_regclass('public.ps_slots') is null or to_regclass('public.ps_agendamentos') is null
     or to_regclass('public.ps_candidatos') is null then
    raise exception using message = 'Falta aplicar a 6.0 do processo seletivo (aplicadas/soma_v06_selecao.sql).';
  end if;
  if to_regprocedure('public.eh_comite()') is null or to_regprocedure('public.portal_registro_atual()') is null then
    raise exception using message = 'Falta aplicar a 7.0 do processo seletivo e a 10.0 (portal).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. QUEM ABRIU E O LINK DA CHAMADA
-- ------------------------------------------------------------
alter table public.ps_slots add column if not exists criado_por text;
alter table public.ps_slots add column if not exists criado_por_registro integer;
alter table public.ps_slots add column if not exists link_reuniao text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'ps_slots_criado_por_registro_fkey') then
    alter table public.ps_slots add constraint ps_slots_criado_por_registro_fkey
      foreign key (criado_por_registro) references public.membros(registro) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'ps_slot_link') then
    alter table public.ps_slots add constraint ps_slot_link
      check (link_reuniao is null or link_reuniao ~* '^https://[^[:space:]]+$');
  end if;
end $$;
comment on column public.ps_slots.criado_por is 'Quem abriu a janela em Seleção › Agenda: conduz a entrevista e recebe o resumo da véspera.';
comment on column public.ps_slots.link_reuniao is 'A chamada da entrevista (Google Meet). No lugar do local: a entrevista é online.';
create index if not exists idx_psslots_resp on public.ps_slots (criado_por_registro, data) where fase = 'entrevista';

alter table public.ps_agendamentos add column if not exists reagendado_em timestamptz;
alter table public.ps_agendamentos add column if not exists reagendado_por text;

-- quem abriu vem da sessão; entrevista nova sem link não entra
create or replace function public.ps_slot_carimbo()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual();
begin
  if tg_op = 'INSERT' and new.criado_por_registro is null and v_reg is not null then
    new.criado_por_registro := v_reg;
    new.criado_por := coalesce(new.criado_por, (select nome from membros where registro = v_reg));
  end if;
  if new.fase = 'entrevista' and new.link_reuniao is null
     and (tg_op = 'INSERT' or old.link_reuniao is not null) then
    raise exception using errcode = 'check_violation',
      message = 'A entrevista é online: informe o link da chamada (Google Meet).';
  end if;
  return new;
end $$;
drop trigger if exists tg_ps_slot_carimbo on public.ps_slots;
create trigger tg_ps_slot_carimbo before insert or update of link_reuniao on public.ps_slots
  for each row execute function public.ps_slot_carimbo();

-- ------------------------------------------------------------
-- 2. A FILA DE E-MAILS
-- ------------------------------------------------------------
create table if not exists public.ps_envios (
  id            bigserial primary key,
  tipo          text not null check (tipo in ('confirmacao','reagendamento','link','cancelamento','resumo')),
  chave         text not null default '',               -- o resumo: "resumo@<dia>#<lista>"
  candidato_id  uuid references public.ps_candidatos(id) on delete cascade,
  slot_id       uuid references public.ps_slots(id) on delete set null,
  para_registro integer references public.membros(registro) on delete cascade,
  para_email    text not null,
  para_nome     text,
  assunto       text not null,
  dados         jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  enviado_em    timestamptz,
  tentativas    smallint not null default 0,
  erro          text
);
create unique index if not exists idx_psenv_resumo on public.ps_envios (para_registro, chave) where tipo = 'resumo';
create index if not exists idx_psenv_fila on public.ps_envios (id) where enviado_em is null;
create index if not exists idx_psenv_cand on public.ps_envios (candidato_id);
comment on table public.ps_envios is
  'Os e-mails das entrevistas do processo seletivo: ao candidato (reserva, reagendamento, link, cancelamento) e o resumo da véspera ao responsável.';
alter table public.ps_envios enable row level security;
drop policy if exists psenv_comite on public.ps_envios;
create policy psenv_comite on public.ps_envios for select to authenticated using (public.eh_comite());
revoke insert, update, delete on public.ps_envios from authenticated, anon;
grant select on public.ps_envios to authenticated;

-- o horário, como os e-mails e o site o mostram
create or replace function public._ps_slot_dados(p_slot uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'slot_id', s.id, 'fase', s.fase, 'data', s.data,
    'hora_inicio', to_char(s.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(s.hora_fim, 'HH24:MI'),
    'link', s.link_reuniao, 'local', s.local, 'responsavel', s.criado_por)
    from ps_slots s where s.id = p_slot;
$$;
revoke all on function public._ps_slot_dados(uuid) from public, anon, authenticated;

-- "14/10, 14:00"
create or replace function public._ps_quando_curto(p jsonb)
returns text language sql immutable as $$
  select to_char((p->>'data')::date, 'DD/MM') || ', ' || coalesce(p->>'hora_inicio', '');
$$;

-- põe um e-mail ao candidato na fila; só para entrevista, só com e-mail
create or replace function public._ps_avisar(p_tipo text, p_candidato uuid, p_slot uuid, p_extra jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  c ps_candidatos%rowtype;
  v jsonb := coalesce(public._ps_slot_dados(p_slot), '{}'::jsonb) || coalesce(p_extra, '{}'::jsonb);
  v_assunto text;
begin
  select * into c from ps_candidatos where id = p_candidato;
  if not found or coalesce(trim(c.email), '') = '' or coalesce(v->>'fase', 'entrevista') <> 'entrevista' then return; end if;
  v_assunto := case p_tipo
    when 'confirmacao'   then 'Entrevista confirmada: ' || public._ps_quando_curto(v)
    when 'reagendamento' then 'Entrevista reagendada: ' || public._ps_quando_curto(v)
    when 'link'          then 'Novo link da sua entrevista: ' || public._ps_quando_curto(v)
    when 'cancelamento'  then 'Sua entrevista precisa ser remarcada'
  end;
  insert into ps_envios (tipo, candidato_id, slot_id, para_email, para_nome, assunto, dados)
  values (p_tipo, c.id, case when p_tipo = 'cancelamento' then null else p_slot end, trim(c.email), c.nome, v_assunto,
          v || jsonb_build_object('protocolo', c.protocolo, 'email', trim(c.email)));
end $$;
revoke all on function public._ps_avisar(text, uuid, uuid, jsonb) from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. O SITE: acompanhar, horários e reservar
--    Mesmos contratos da 6.0; entram o link e o "online".
-- ------------------------------------------------------------
create or replace function public.ps_acompanhar(p_protocolo text, p_email text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare r record;
begin
  select * into r from public._ps_candidato(p_protocolo, p_email);
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  return jsonb_build_object(
    'status','ok',
    'nome', (r.cand).nome,
    'protocolo', (r.cand).protocolo,
    'situacao', r.status_visivel,
    'fase_agendavel', r.fase_agendavel,
    'agendamentos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'fase', a.fase, 'data', s.data,
        'hora_inicio', to_char(s.hora_inicio,'HH24:MI'),
        'hora_fim', to_char(s.hora_fim,'HH24:MI'), 'local', s.local,
        'online', s.link_reuniao is not null, 'link', s.link_reuniao,
        'responsavel', case when s.fase = 'entrevista' then s.criado_por end
      ) order by s.data)
      from ps_agendamentos a join ps_slots s on s.id = a.slot_id
      where a.candidato_id = (r.cand).id
    ), '[]'::jsonb)
  );
end $$;
grant execute on function public.ps_acompanhar(text, text) to anon, authenticated;

-- o link só depois da reserva: a lista de horários diz apenas que é online
create or replace function public.ps_horarios(p_protocolo text, p_email text)
returns jsonb language plpgsql stable security definer
set search_path = public
as $$
declare
  r record;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select * into r from public._ps_candidato(p_protocolo, p_email);
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if r.fase_agendavel is null then
    return jsonb_build_object('status','sem_fase');
  end if;

  return jsonb_build_object(
    'status','ok', 'fase', r.fase_agendavel,
    'slots', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'data', s.data,
        'hora_inicio', to_char(s.hora_inicio,'HH24:MI'),
        'hora_fim', to_char(s.hora_fim,'HH24:MI'),
        'local', s.local, 'online', s.link_reuniao is not null,
        'vagas', s.capacidade - (select count(*) from ps_agendamentos a
                                  where a.slot_id = s.id
                                    and a.candidato_id <> (r.cand).id),
        'meu', exists (select 1 from ps_agendamentos a
                        where a.slot_id = s.id and a.candidato_id = (r.cand).id)
      ) order by s.data, s.hora_inicio)
      from ps_slots s
      where s.edicao_id = (r.cand).edicao_id
        and s.fase = r.fase_agendavel and s.ativo
        and s.data >= v_hoje
    ), '[]'::jsonb)
  );
end $$;
grant execute on function public.ps_horarios(text, text) to anon, authenticated;

-- reservar (ou trocar): a reserva de entrevista manda a confirmação com o
-- link; manter o mesmo horário não manda nada
create or replace function public.ps_agendar(p_protocolo text, p_email text, p_slot uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  r      record;
  v_slot public.ps_slots%rowtype;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_ocup integer;
  v_ant  uuid;
begin
  select * into r from public._ps_candidato(p_protocolo, p_email);
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if r.fase_agendavel is null then
    return jsonb_build_object('status','sem_fase');
  end if;

  select * into v_slot from ps_slots where id = p_slot for update;
  if not found or not v_slot.ativo or v_slot.fase <> r.fase_agendavel
     or v_slot.edicao_id <> (r.cand).edicao_id or v_slot.data < v_hoje then
    return jsonb_build_object('status','indisponivel');
  end if;

  select slot_id into v_ant from ps_agendamentos
   where candidato_id = (r.cand).id and fase = r.fase_agendavel;
  if v_ant is distinct from p_slot then
    select count(*) into v_ocup from ps_agendamentos
     where slot_id = p_slot and candidato_id <> (r.cand).id;
    if v_ocup >= v_slot.capacidade then
      return jsonb_build_object('status','lotado');
    end if;

    delete from ps_agendamentos
     where candidato_id = (r.cand).id and fase = r.fase_agendavel;
    insert into ps_agendamentos (slot_id, candidato_id, fase)
    values (p_slot, (r.cand).id, r.fase_agendavel);
    perform public._ps_avisar('confirmacao', (r.cand).id, p_slot);
  end if;

  return jsonb_build_object('status','ok',
    'data', v_slot.data,
    'hora_inicio', to_char(v_slot.hora_inicio,'HH24:MI'),
    'hora_fim', to_char(v_slot.hora_fim,'HH24:MI'),
    'local', v_slot.local, 'online', v_slot.link_reuniao is not null, 'link', v_slot.link_reuniao,
    'email', v_slot.fase = 'entrevista' and v_ant is distinct from p_slot);
end $$;
grant execute on function public.ps_agendar(text, text, uuid) to anon, authenticated;

-- ------------------------------------------------------------
-- 4. O COMITÊ: reagendar, editar o horário, excluir
-- ------------------------------------------------------------
-- mover o candidato para outro horário da mesma fase
create or replace function public.ps_reagendar(p_agendamento uuid, p_slot uuid, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  a ps_agendamentos%rowtype; s ps_slots%rowtype; c ps_candidatos%rowtype;
  v_antes jsonb; v_ocup integer;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quem text := (select nome from membros where registro = public.portal_registro_atual());
begin
  if not public.eh_comite() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into a from ps_agendamentos where id = p_agendamento for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if a.slot_id = p_slot then return jsonb_build_object('status','mesmo_horario'); end if;
  select * into c from ps_candidatos where id = a.candidato_id;
  select * into s from ps_slots where id = p_slot for update;
  if not found or not s.ativo or s.fase <> a.fase or s.edicao_id <> c.edicao_id or s.data < v_hoje then
    return jsonb_build_object('status','indisponivel');
  end if;
  select count(*) into v_ocup from ps_agendamentos where slot_id = p_slot and candidato_id <> a.candidato_id;
  if v_ocup >= s.capacidade then return jsonb_build_object('status','lotado'); end if;

  v_antes := public._ps_slot_dados(a.slot_id);
  update ps_agendamentos set slot_id = p_slot, compareceu = null, reagendado_em = now(), reagendado_por = v_quem
   where id = a.id;
  perform public._ps_avisar('reagendamento', a.candidato_id, p_slot,
    jsonb_build_object('antes', v_antes, 'motivo', nullif(trim(coalesce(p_motivo, '')), ''), 'por', v_quem));
  return jsonb_build_object('status','ok', 'email', a.fase = 'entrevista');
end $$;

-- mudar o próprio horário (dia, hora, link) e avisar quem está nele
create or replace function public.ps_slot_editar(p_slot uuid, p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s ps_slots%rowtype; v_antes jsonb; v_hora boolean; v_link boolean; v_n integer := 0; ag record;
  v_data date; v_ini time; v_fim time; v_url text;
  v_avisar boolean := coalesce((p->>'avisar')::boolean, true);
  v_quem text := (select nome from membros where registro = public.portal_registro_atual());
begin
  if not public.eh_comite() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into s from ps_slots where id = p_slot for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  v_data := coalesce(nullif(p->>'data','')::date, s.data);
  v_ini  := coalesce(nullif(p->>'hora_inicio','')::time, s.hora_inicio);
  v_fim  := coalesce(nullif(p->>'hora_fim','')::time, s.hora_fim);
  v_url  := case when p ? 'link_reuniao' then nullif(trim(p->>'link_reuniao'), '') else s.link_reuniao end;
  if v_fim <= v_ini then return jsonb_build_object('status','invalido','campo','hora_fim'); end if;
  if v_url is not null and v_url !~* '^https://[^[:space:]]+$' then
    return jsonb_build_object('status','invalido','campo','link_reuniao');
  end if;
  if s.fase = 'entrevista' and v_url is null then return jsonb_build_object('status','invalido','campo','link_reuniao'); end if;

  v_antes := public._ps_slot_dados(p_slot);
  v_hora := v_data <> s.data or v_ini <> s.hora_inicio or v_fim <> s.hora_fim;
  v_link := v_url is distinct from s.link_reuniao;
  update ps_slots set data = v_data, hora_inicio = v_ini, hora_fim = v_fim, link_reuniao = v_url,
         criado_por = case when coalesce((p->>'assumir')::boolean, false) then v_quem else criado_por end,
         criado_por_registro = case when coalesce((p->>'assumir')::boolean, false)
                                    then public.portal_registro_atual() else criado_por_registro end
   where id = p_slot;

  if v_avisar and (v_hora or v_link) then
    for ag in select candidato_id from ps_agendamentos where slot_id = p_slot loop
      perform public._ps_avisar(case when v_hora then 'reagendamento' else 'link' end, ag.candidato_id, p_slot,
        jsonb_build_object('antes', v_antes, 'motivo', nullif(trim(coalesce(p->>'motivo', '')), ''), 'por', v_quem));
      v_n := v_n + 1;
    end loop;
  end if;
  return jsonb_build_object('status','ok', 'avisados', case when s.fase = 'entrevista' then v_n else 0 end);
end $$;

-- excluir o horário: quem estava nele recebe o aviso para escolher outro
create or replace function public.ps_slot_excluir(p_slot uuid, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s ps_slots%rowtype; ag record; v_n integer := 0;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_quem text := (select nome from membros where registro = public.portal_registro_atual());
begin
  if not public.eh_comite() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into s from ps_slots where id = p_slot for update;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if s.fase = 'entrevista' and s.data >= v_hoje then
    for ag in select candidato_id from ps_agendamentos where slot_id = p_slot loop
      perform public._ps_avisar('cancelamento', ag.candidato_id, p_slot,
        jsonb_build_object('motivo', nullif(trim(coalesce(p_motivo, '')), ''), 'por', v_quem));
      v_n := v_n + 1;
    end loop;
  end if;
  delete from ps_slots where id = p_slot;
  return jsonb_build_object('status','ok', 'avisados', v_n);
end $$;

revoke execute on function public.ps_reagendar(uuid, uuid, text) from public, anon;
revoke execute on function public.ps_slot_editar(uuid, jsonb)     from public, anon;
revoke execute on function public.ps_slot_excluir(uuid, text)     from public, anon;
grant  execute on function public.ps_reagendar(uuid, uuid, text) to authenticated;
grant  execute on function public.ps_slot_editar(uuid, jsonb)     to authenticated;
grant  execute on function public.ps_slot_excluir(uuid, text)     to authenticated;

-- ------------------------------------------------------------
-- 5. O RESUMO DA VÉSPERA E A FILA, PARA A EDGE FUNCTION
--    A partir das 18h (Brasília), quem abriu horários de entrevista
--    com candidato para amanhã recebe um e-mail com todas elas. A
--    chave leva a lista de agendamentos: se ela muda depois do envio
--    (alguém reservou ou saiu), sai um resumo atualizado.
-- ------------------------------------------------------------
create or replace function public._ps_resumos(p_agora timestamptz default now(), p_hora integer default 18)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_local timestamp := p_agora at time zone 'America/Sao_Paulo';
  v_dia date := v_local::date + 1;
  v_n integer;
begin
  if extract(hour from v_local) < p_hora then return 0; end if;
  with ents as (
    select s.criado_por_registro as reg, s.data, s.hora_inicio, a.id as ag_id, c.id as cand_id,
           jsonb_build_object(
             'hora_inicio', to_char(s.hora_inicio, 'HH24:MI'), 'hora_fim', to_char(s.hora_fim, 'HH24:MI'),
             'link', s.link_reuniao,
             'candidato', jsonb_build_object(
               'id', c.id, 'nome', c.nome, 'protocolo', c.protocolo, 'email', c.email, 'telefone', c.telefone,
               'curso', c.curso, 'instituicao', c.instituicao, 'periodo', c.periodo, 'cidade', c.cidade_origem,
               'areas', to_jsonb(c.areas_interesse), 'motivacao', left(c.motivacao, 600),
               'background', left(c.background, 400), 'disponibilidade', left(c.disponibilidade, 200),
               'lattes', c.lattes, 'github', c.github, 'linkedin', c.linkedin, 'portfolio', c.portfolio),
             'dinamica', (select jsonb_build_object('nota', round(avg(v.nota), 1), 'avaliacoes', count(*),
                                   'aprovar', count(*) filter (where v.recomendacao = 'aprovar'),
                                   'reprovar', count(*) filter (where v.recomendacao = 'reprovar'),
                                   'em_duvida', count(*) filter (where v.recomendacao = 'em_duvida'))
                            from ps_avaliacoes v where v.candidato_id = c.id and v.fase = 'dinamica'),
             'href', '#/selecao/candidatos/' || c.id) as item
      from ps_slots s
      join ps_agendamentos a on a.slot_id = s.id
      join ps_candidatos c on c.id = a.candidato_id
     where s.fase = 'entrevista' and s.data = v_dia and s.criado_por_registro is not null
       and c.status <> 'desistente'
  ), por as (
    select reg, 'resumo@' || v_dia || '#' || md5(string_agg(ag_id::text, ',' order by ag_id)) as chave,
           jsonb_agg(item order by hora_inicio) as itens
      from ents group by reg
  )
  insert into ps_envios (tipo, chave, para_registro, para_email, para_nome, assunto, dados)
  select 'resumo', p.chave, m.registro, coalesce(nullif(trim(m.email_nro), ''), nullif(trim(m.email_pessoal), '')), m.nome,
         case when exists (select 1 from ps_envios x where x.tipo = 'resumo' and x.para_registro = m.registro
                              and x.chave like 'resumo@' || v_dia || '#%')
              then 'Entrevistas de amanhã (atualizado): ' || jsonb_array_length(p.itens)
              else 'Entrevistas de amanhã: ' || jsonb_array_length(p.itens) end,
         jsonb_build_object('dia', v_dia, 'itens', p.itens,
           'atualizacao', exists (select 1 from ps_envios x where x.tipo = 'resumo' and x.para_registro = m.registro
                                    and x.chave like 'resumo@' || v_dia || '#%'))
    from por p join membros m on m.registro = p.reg
   where coalesce(nullif(trim(m.email_nro), ''), nullif(trim(m.email_pessoal), '')) is not null
  on conflict do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;
revoke all on function public._ps_resumos(timestamptz, integer) from public, anon, authenticated;

create or replace function public.ps_envios_lote(p_limite integer default 100, p_agora timestamptz default now())
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  perform public._ps_resumos(p_agora);
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'tipo', v.tipo, 'para_nome', v.para_nome, 'para_email', v.para_email,
      'assunto', v.assunto, 'dados', v.dados) order by v.id)
    from (select * from ps_envios where enviado_em is null and tentativas < 5
           order by id limit greatest(coalesce(p_limite, 100), 1)) v), '[]'::jsonb);
end $$;

create or replace function public.ps_envios_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_ok  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'enviados','[]')) x), '{}');
  v_er  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(coalesce(p->'falhas','[]')) x), '{}');
  v_msg text := left(coalesce(p->>'erro',''), 500);
  v_n   integer;
begin
  update ps_envios set enviado_em = now(), erro = null where id = any(v_ok) and enviado_em is null;
  get diagnostics v_n = row_count;
  update ps_envios set tentativas = tentativas + 1, erro = nullif(v_msg,'') where id = any(v_er) and enviado_em is null;
  return jsonb_build_object('status','ok','enviados',v_n);
end $$;
revoke execute on function public.ps_envios_lote(integer, timestamptz) from public, anon, authenticated;
revoke execute on function public.ps_envios_baixa(jsonb)                from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.ps_envios_lote(integer, timestamptz) to service_role;
    grant execute on function public.ps_envios_baixa(jsonb)                to service_role;
  end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('v31_ps_entrevistas', 'Entrevistas do processo seletivo online: quem abriu a janela, link da chamada e os e-mails ao candidato e ao responsável')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 31.0
-- ============================================================
