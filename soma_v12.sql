-- ============================================================
-- SOMA 12.0 — MIGRAÇÃO · NeuroDynamics
-- AGENDA DO MEMBRO no Portal (membro.neurodynamics.dev):
-- sincronização com o Google Calendar de cada pessoa e o
-- ASSISTENTE DE AGENDAMENTO da aba "Calendário" — a visão de
-- disponibilidade (livre/ocupado) de várias pessoas ao mesmo
-- tempo, com sugestões de horário e criação da reunião.
--
-- Como funciona, em uma frase: cada membro cola aqui o LINK
-- SECRETO em formato iCal do seu Google Agenda; um trabalho de
-- sincronização (Edge Function "agenda-sync", código em
-- supabase/functions/agenda-sync/) lê esse .ics e grava só os
-- BLOCOS DE OCUPAÇÃO (início e fim) em portal_agenda_blocos.
-- O portal nunca vê o conteúdo do calendário: vê "ocupado".
--
-- PRIVACIDADE — três decisões de projeto, não de promessa:
--   1. O link .ics é uma credencial (quem tem, lê o calendário
--      inteiro). Ele mora em portal_agenda_segredo, tabela
--      separada, com RLS que só devolve a linha do dono.
--   2. O título do compromisso só é gravado e mostrado se a
--      pessoa marcar "compartilhar títulos". No padrão, o
--      portal mostra apenas "Ocupado".
--   3. Férias e marcos individuais entram como indisponível
--      SEM título — o portal continua não expondo o motivo,
--      como já era no calendário geral.
--
-- Pré-requisito: o soma_v11.sql DESTE repositório aplicado.
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. CONFERÊNCIA DOS PRÉ-REQUISITOS
--    Falhar dizendo qual arquivo falta é melhor do que falhar
--    com "function does not exist" no meio do caminho.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.membros') is null then
    raise exception using
      message = 'Este banco não parece ser o do SOMA.',
      detail  = 'A tabela public.membros não existe.',
      hint    = 'Confira se você está no projeto certo do Supabase.';
  end if;

  if to_regproc('public.portal_registro_atual') is null then
    raise exception using
      message = 'Falta aplicar o soma_v10.sql antes desta migração.',
      detail  = 'A SOMA 12.0 usa a função portal_registro_atual(), criada pela 10.0.',
      hint    = 'Rode, na ordem: soma_v10.sql, soma_v11.sql e só então este arquivo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. AGENDA DE CADA MEMBRO
--    Preferências e estado da sincronização. É a parte NÃO
--    sensível: qualquer membro logado lê, porque o assistente
--    precisa saber o expediente e se a agenda está conectada
--    (para dizer "disponibilidade desconhecida" em vez de
--    fingir que a pessoa está livre).
-- ------------------------------------------------------------
create table if not exists public.portal_agendas (
  registro            integer primary key
                      references public.membros(registro) on delete cascade,
  conectado           boolean not null default false,   -- tem link .ics guardado
  ativo               boolean not null default true,    -- pausa a sincronização
  compartilha_titulos boolean not null default false,   -- ver PRIVACIDADE (2)
  fuso                text    not null default 'America/Sao_Paulo',
  expediente_inicio   time    not null default '08:00',
  expediente_fim      time    not null default '18:00',
  dias_uteis          integer[] not null default '{1,2,3,4,5}',  -- ISO: 1=seg … 7=dom
  ultima_sync         timestamptz,
  ultimo_erro         text,
  blocos_sync         integer,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now(),
  constraint portal_agenda_expediente check (expediente_fim > expediente_inicio)
);

drop trigger if exists tg_upd_pagendas on public.portal_agendas;
create trigger tg_upd_pagendas before update on public.portal_agendas
  for each row execute function public.fn_atualizado();

-- ------------------------------------------------------------
-- 2. O LINK SECRETO (.ics)
--    Tabela à parte só para isolar o segredo: nenhuma consulta
--    do portal precisa dela, e a RLS só devolve a própria
--    linha — nem admin, nem pessoal leem o link dos outros.
--    Quem lê é a Edge Function, com a service role key.
-- ------------------------------------------------------------
create table if not exists public.portal_agenda_segredo (
  registro      integer primary key
                references public.membros(registro) on delete cascade,
  ics_url       text not null,
  atualizado_em timestamptz not null default now()
);

drop trigger if exists tg_upd_pagsegredo on public.portal_agenda_segredo;
create trigger tg_upd_pagsegredo before update on public.portal_agenda_segredo
  for each row execute function public.fn_atualizado();

-- ------------------------------------------------------------
-- 3. BLOCOS DE OCUPAÇÃO
--    O resultado da sincronização: uma linha por ocorrência
--    (recorrências já expandidas pela Edge Function). "titulo"
--    fica nulo quando a pessoa não compartilha títulos.
-- ------------------------------------------------------------
create table if not exists public.portal_agenda_blocos (
  id          bigint generated always as identity primary key,
  registro    integer not null references public.membros(registro) on delete cascade,
  inicio      timestamptz not null,
  fim         timestamptz not null,
  dia_inteiro boolean not null default false,
  titulo      text,
  uid         text,
  sync_em     timestamptz not null default now(),
  constraint portal_bloco_periodo check (fim > inicio)
);
create index if not exists idx_pagblocos_reg
  on public.portal_agenda_blocos (registro, inicio, fim);

-- ------------------------------------------------------------
-- 4. AUDITORIA
--    Preferências e conexão entram na auditoria; os blocos
--    NÃO — são milhares de linhas reescritas a cada sync, e o
--    que interessa auditar é quem conectou/desconectou. O
--    segredo também fica fora: auditar o valor de uma
--    credencial seria copiá-la para outra tabela.
-- ------------------------------------------------------------
drop trigger if exists tg_aud_pagendas on public.portal_agendas;
create trigger tg_aud_pagendas after insert or update or delete on public.portal_agendas
  for each row execute function public.fn_auditoria();

-- ------------------------------------------------------------
-- 5. SEGURANÇA (RLS)
-- ------------------------------------------------------------
alter table public.portal_agendas        enable row level security;
alter table public.portal_agenda_segredo enable row level security;
alter table public.portal_agenda_blocos  enable row level security;

-- 5a. Preferências: todo mundo logado lê (o assistente precisa
--     do expediente e do estado da conexão); escrever, só pela
--     função portal_agenda_salvar da seção 6.
drop policy if exists pagendas_select on public.portal_agendas;
create policy pagendas_select on public.portal_agendas
  for select to authenticated using (true);

-- 5b. Segredo: só o dono, e só leitura (para conferir de qual
--     agenda veio). Gravação exclusivamente pelas funções.
drop policy if exists pagsegredo_select on public.portal_agenda_segredo;
create policy pagsegredo_select on public.portal_agenda_segredo
  for select to authenticated
  using (registro = public.portal_registro_atual());

-- 5c. Blocos: leitura direta só dos próprios (para a pessoa
--     conferir o que foi sincronizado). A disponibilidade dos
--     colegas sai pela função portal_agenda_ocupacao, que
--     aplica a regra dos títulos.
drop policy if exists pagblocos_select on public.portal_agenda_blocos;
create policy pagblocos_select on public.portal_agenda_blocos
  for select to authenticated
  using (registro = public.portal_registro_atual());

-- ------------------------------------------------------------
-- 6. FUNÇÕES DO PORTAL
-- ------------------------------------------------------------

-- 6a. Salvar a agenda (preferências e, opcionalmente, o link).
--     Aceita:
--       ics_url             text   — link .ics do Google (opcional)
--       compartilha_titulos boolean
--       fuso                text
--       expediente_inicio   text   'HH:MM'
--       expediente_fim      text   'HH:MM'
--       dias_uteis          int[]  ISO 1..7
--       ativo               boolean
--     Devolve {status:'ok'|'sem_vinculo'|'invalido', campo?}.
create or replace function public.portal_agenda_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_url  text    := nullif(trim(coalesce(p->>'ics_url','')), '');
  v_ini  time;
  v_fim  time;
  v_dias integer[];
begin
  if v_reg is null then
    return jsonb_build_object('status','sem_vinculo');
  end if;

  -- Link do Google Agenda. Para aceitar outros provedores
  -- (Outlook, Apple), amplie ESTA expressão e o allowlist de
  -- hosts da Edge Function — os dois, senão o link é salvo e
  -- a sincronização recusa.
  if v_url is not null and v_url !~* '^https://(calendar\.google\.com|www\.google\.com)/calendar/ical/.+\.ics(\?.*)?$' then
    return jsonb_build_object('status','invalido','campo','ics_url');
  end if;

  v_ini  := coalesce(nullif(p->>'expediente_inicio','')::time, time '08:00');
  v_fim  := coalesce(nullif(p->>'expediente_fim','')::time,   time '18:00');
  if v_fim <= v_ini then
    return jsonb_build_object('status','invalido','campo','expediente');
  end if;

  if jsonb_typeof(p->'dias_uteis') = 'array' then
    select array_agg(d order by d) into v_dias
      from (select distinct v::integer as d
              from jsonb_array_elements_text(p->'dias_uteis') t(v)
             where v ~ '^[1-7]$') s;
    if v_dias is null then
      return jsonb_build_object('status','invalido','campo','dias_uteis');
    end if;
  else
    v_dias := array[1,2,3,4,5];
  end if;

  insert into portal_agendas as a
    (registro, compartilha_titulos, fuso, expediente_inicio, expediente_fim, dias_uteis, ativo)
  values
    (v_reg,
     coalesce((p->>'compartilha_titulos')::boolean, false),
     coalesce(nullif(trim(p->>'fuso'),''), 'America/Sao_Paulo'),
     v_ini, v_fim, v_dias,
     coalesce((p->>'ativo')::boolean, true))
  on conflict (registro) do update set
    compartilha_titulos = excluded.compartilha_titulos,
    fuso                = excluded.fuso,
    expediente_inicio   = excluded.expediente_inicio,
    expediente_fim      = excluded.expediente_fim,
    dias_uteis          = excluded.dias_uteis,
    ativo               = excluded.ativo;

  if v_url is not null then
    insert into portal_agenda_segredo (registro, ics_url)
    values (v_reg, v_url)
    on conflict (registro) do update set ics_url = excluded.ics_url;
    update portal_agendas
       set conectado = true, ultimo_erro = null, ultima_sync = null, blocos_sync = null
     where registro = v_reg;
  end if;

  -- Título passou a ser privado: apaga o que já estava gravado.
  if not coalesce((p->>'compartilha_titulos')::boolean, false) then
    update portal_agenda_blocos set titulo = null where registro = v_reg;
  end if;

  return jsonb_build_object('status','ok');
end $$;
revoke execute on function public.portal_agenda_salvar(jsonb) from public;
grant  execute on function public.portal_agenda_salvar(jsonb) to authenticated;

-- 6b. Desconectar: apaga o link e tudo que veio dele. As
--     preferências (expediente) continuam, porque o assistente
--     usa o expediente mesmo de quem não sincroniza.
create or replace function public.portal_agenda_desconectar()
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare v_reg integer := public.portal_registro_atual();
begin
  if v_reg is null then
    return jsonb_build_object('status','sem_vinculo');
  end if;
  delete from portal_agenda_segredo where registro = v_reg;
  delete from portal_agenda_blocos  where registro = v_reg;
  update portal_agendas
     set conectado = false, ultima_sync = null, ultimo_erro = null, blocos_sync = null
   where registro = v_reg;
  return jsonb_build_object('status','ok');
end $$;
revoke execute on function public.portal_agenda_desconectar() from public;
grant  execute on function public.portal_agenda_desconectar() to authenticated;

-- 6c. Ocupação de um conjunto de pessoas em uma janela.
--     É o que alimenta a grade do assistente. Junta TRÊS
--     fontes, todas como "ocupado":
--       google   — blocos vindos do .ics (título só se a
--                  pessoa compartilhar);
--       soma     — eventos do SOMA em que ela é participante e
--                  não respondeu "não vou";
--       ausencia — férias e marcos individuais do calendário,
--                  SEM título (ver PRIVACIDADE (3) no topo).
--     security definer de propósito: a disponibilidade é
--     pública entre membros; o conteúdo, não. Só o papel
--     "authenticated" executa.
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

  -- 2) Eventos do SOMA (inclui as reuniões marcadas por aqui)
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
     and e.status <> 'Cancelado'
     and coalesce(ep.resposta, 'pendente') <> 'nao'
     and e.data between (p_de at time zone 'America/Sao_Paulo')::date - 1
                    and (p_ate at time zone 'America/Sao_Paulo')::date + 1

  union all

  -- 3) Férias e marcos individuais — indisponível, sem motivo
  select ci.registro,
         (ci.data_inicio::timestamp)                            at time zone 'America/Sao_Paulo',
         ((coalesce(ci.data_fim, ci.data_inicio) + 1)::timestamp) at time zone 'America/Sao_Paulo',
         true,
         null::text,
         'ausencia'::text
    from calendario_itens ci
   where ci.registro = any(p_registros)
     and ci.data_inicio            <= (p_ate at time zone 'America/Sao_Paulo')::date
     and coalesce(ci.data_fim, ci.data_inicio) >= (p_de at time zone 'America/Sao_Paulo')::date;
$$;
revoke execute on function public.portal_agenda_ocupacao(integer[], timestamptz, timestamptz) from public;
grant  execute on function public.portal_agenda_ocupacao(integer[], timestamptz, timestamptz) to authenticated;

-- ------------------------------------------------------------
-- 7. ACESSO DA EDGE FUNCTION
--    A "agenda-sync" roda com a service role key (ignora RLS),
--    então não precisa de política nenhuma. Fica aqui só o
--    grant de schema, para o caso de a chave usada ser outra.
-- ------------------------------------------------------------
grant usage on schema public to service_role;
grant select, insert, update, delete on public.portal_agendas        to service_role;
grant select                        on public.portal_agenda_segredo  to service_role;
grant select, insert, update, delete on public.portal_agenda_blocos  to service_role;
grant usage, select on all sequences in schema public to service_role;

-- ============================================================
-- FIM — SOMA 12.0
-- Depois desta migração:
--   1) publique o index.html e o admin.html atualizados do
--      repositório "membro";
--   2) publique a Edge Function "agenda-sync" (o código está em
--      supabase/functions/agenda-sync/index.ts). Pelo painel:
--      Edge Functions -> Deploy a new function -> via editor,
--      nome "agenda-sync", cole o arquivo e Deploy. Ela usa as
--      variáveis SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY, que
--      o Supabase já injeta;
--   3) cada membro conecta a própria agenda em
--      /#/calendario -> "Minha agenda", colando o endereço
--      secreto em formato iCal do Google Agenda
--      (Google Agenda -> Configurações do calendário ->
--       Integrar agenda -> "Endereço secreto no formato iCal").
--
-- OPCIONAL — sincronizar sozinho, de hora em hora, sem
-- ninguém abrir o portal. Requer as extensões pg_cron e pg_net
-- (Database -> Extensions) e a service role key guardada no
-- Vault, NUNCA escrita direto no SQL:
--
--   select vault.create_secret('<service_role_key>', 'agenda_sync_key');
--   select cron.schedule('agenda-sync', '7 * * * *', $cron$
--     select net.http_post(
--       url     := 'https://<ref>.supabase.co/functions/v1/agenda-sync',
--       headers := jsonb_build_object(
--                    'Content-Type','application/json',
--                    'Authorization','Bearer ' ||
--                      (select decrypted_secret from vault.decrypted_secrets
--                        where name = 'agenda_sync_key')),
--       body    := jsonb_build_object('todos', true));
--   $cron$);
--
-- Sem o cron o portal continua funcionando: ele sincroniza sob
-- demanda quando alguém abre o assistente com dados vencidos.
-- ============================================================
