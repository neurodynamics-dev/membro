-- ============================================================
-- SOMA 2.31.1, MIGRAÇÃO, NeuroDynamics
-- A AGENDA SEGUE OS GRUPOS E O DESLIGAMENTO.
--
--   1. O EVENTO GUARDA OS GRUPOS PELO ID (eventos.grupo_ids). O nome
--      (eventos.grupos) continua, para quem já lia; mas um grupo
--      renomeado não se perde mais, e agenda_evento devolve o nome
--      de agora.
--   2. DESLIGADO SAI DE TODOS OS CONVITES. Quando a ficha passa a
--      Desligado ou Egresso, a pessoa sai dos convidados de todo
--      evento que ainda não terminou (os passados ficam, são
--      histórico), e os e-mails da agenda que ainda não saíram para
--      ela são descartados. Ninguém recebe aviso: quem saiu não
--      precisa do cancelamento. Desligado também não entra mais em
--      convite: agenda_evento_salvar o ignora, e a série não o copia.
--   3. QUEM ENTRA NO GRUPO ENTRA NAS PRÓXIMAS REUNIÕES DELE. Num
--      evento recorrente com grupo, quem passa a estar no grupo (pela
--      ficha, por um subgrupo, ou volta a Ativo) é convidado de todas
--      as ocorrências de hoje em diante, e recebe um convite por
--      série (e-mail e sino), não um por ocorrência. As ocorrências
--      que a série gera depois também já nascem com quem está no
--      grupo naquele dia.
--   4. A SÉRIE COPIA A LISTA ATUAL. agenda_gerar_serie copiava os
--      convidados do primeiro encontro da série, de modo que uma
--      mudança feita em "este e os seguintes" sumia nos encontros
--      gerados depois. Agora copia do último encontro, e tira quem
--      foi desligado.
--   5. O OPCIONAL DO GRUPO. Marcar como opcional alguém que veio
--      pelo grupo não volta mais a ser obrigatório ao salvar.
--
-- Tudo acontece no banco, por um gatilho em membros (status e
-- grupos): vale para a ficha, para Grupos › pôr e tirar pessoas, para
-- os trabalhos e para o que mais mexer em membros.
--
-- Pré-requisito: a 28.0 (a agenda). Idempotente. Troca agenda_evento,
-- agenda_evento_salvar e agenda_gerar_serie com a mesma assinatura (as
-- permissões continuam as da 28.0).
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.agenda_evento_salvar(jsonb)') is null or to_regclass('public.agenda_envios') is null then
    raise exception using message = 'Falta aplicar a 28.0 (db/v28_agenda.sql) antes desta migração.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. OS GRUPOS DO EVENTO, PELO ID
-- ------------------------------------------------------------
alter table public.eventos add column if not exists grupo_ids integer[] not null default '{}';
comment on column public.eventos.grupo_ids is
  'Os grupos convidados (e quem está abaixo deles). Num evento recorrente, quem entra no grupo '
  'é convidado das ocorrências de hoje em diante (2.31.1). eventos.grupos guarda os nomes.';
create index if not exists idx_eventos_grupo_ids on public.eventos using gin (grupo_ids)
  where cardinality(grupo_ids) > 0;

-- os eventos de antes guardavam só o nome
update public.eventos e
   set grupo_ids = array(select g.id from public.grupos g where g.nome = any(e.grupos) order by g.id)
 where cardinality(coalesce(e.grupos,'{}')) > 0 and cardinality(e.grupo_ids) = 0;

-- ------------------------------------------------------------
-- 2. LER UM EVENTO — os grupos com o nome de agora
-- ------------------------------------------------------------
create or replace function public.agenda_evento(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  e       public.eventos%rowtype;
  v_eu    integer := public.portal_registro_atual();
  v_ed    boolean;
begin
  select * into e from eventos where id = p_id;
  if not found or not public.agenda_pode_ver(p_id) then return jsonb_build_object('status','nao_encontrado'); end if;
  v_ed := public.agenda_gestor() or (v_eu is not null and e.owner_registro = v_eu);
  return jsonb_build_object(
    'status', 'ok',
    'evento', jsonb_build_object(
      'id', e.id, 'numero', e.numero, 'titulo', e.titulo, 'tipo', e.tipo,
      'data', e.data, 'data_fim', e.data_fim, 'hora_inicio', to_char(e.hora_inicio,'HH24:MI'),
      'hora_fim', to_char(e.hora_fim,'HH24:MI'), 'local', e.local, 'espaco_id', e.espaco_id,
      'espaco', (select nome from espacos where id = e.espaco_id),
      'meet_url', e.meet_url, 'descricao', e.pauta, 'visibilidade', coalesce(e.visibilidade,'convidados'),
      'cor', coalesce(nullif(e.cor,''), (select cor from agenda_predefinidos where id = e.predefinido_id),
                      (select cor from evento_tipos where nome = e.tipo), '#2DD4BF'),
      'cor_propria', nullif(e.cor,''),
      'lembretes', to_jsonb(coalesce(e.lembretes,'{}')), 'predefinido_id', e.predefinido_id,
      'recorrencia', coalesce(e.recorrencia,'Única'), 'serie_id', e.serie_id, 'serie_ate', e.serie_ate,
      'grupos', case when cardinality(coalesce(e.grupo_ids,'{}')) > 0
                  then coalesce((select jsonb_agg(g.nome order by g.nome) from grupos g where g.id = any(e.grupo_ids)), '[]'::jsonb)
                  else to_jsonb(coalesce(e.grupos,'{}')) end,
      'grupo_ids', to_jsonb(coalesce(e.grupo_ids,'{}')), 'owner_registro', e.owner_registro,
      'organizador', (select nome from membros where registro = e.owner_registro),
      'cancelado', coalesce(e.status,'') = 'Cancelado'),
    'participantes', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', p.registro, 'nome', m.nome, 'papel', coalesce(p.papel,'obrigatorio'),
        'resposta', coalesce(p.resposta,'pendente'), 'respondido_em', p.respondido_em)
        order by (p.registro = e.owner_registro) desc, m.nome)
      from evento_participantes p join membros m on m.registro = p.registro where p.evento_id = e.id), '[]'::jsonb),
    'externos', case when v_ed then coalesce((select jsonb_agg(jsonb_build_object(
        'id', x.id, 'email', x.email, 'nome', x.nome, 'resposta', x.resposta) order by x.email)
      from evento_externos x where x.evento_id = e.id), '[]'::jsonb)
      else coalesce((select jsonb_agg(jsonb_build_object('nome', coalesce(x.nome, split_part(x.email,'@',1)),
        'resposta', x.resposta)) from evento_externos x where x.evento_id = e.id), '[]'::jsonb) end,
    'minha_resposta', (select resposta from evento_participantes where evento_id = e.id and registro = v_eu),
    'pode_editar', v_ed,
    'ocorrencias', case when e.serie_id is null then 0 else
      (select count(*) from eventos where serie_id = e.serie_id and coalesce(status,'') <> 'Cancelado') end);
end $$;
revoke execute on function public.agenda_evento(uuid) from public, anon;
grant  execute on function public.agenda_evento(uuid) to authenticated;

-- ------------------------------------------------------------
-- 3. SALVAR — guarda os ids, ignora desligados, respeita o opcional
--    Os campos são os da 28.0. "grupos" (ids) vem junto com a lista
--    de convidados: a lista é inteira, e os grupos também.
-- ------------------------------------------------------------
create or replace function public.agenda_evento_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_eu      integer := public.portal_registro_atual();
  v_gestor  boolean := public.agenda_gestor();
  v_quem    text;
  v_ev      public.eventos%rowtype;
  v_id      uuid := nullif(p->>'id','')::uuid;
  v_novo    boolean := v_id is null;
  v_pd      public.agenda_predefinidos%rowtype;
  v_data    date;  v_fim date;  v_hi time;  v_hf time;  v_ate date;
  v_rec     text;
  v_vis     text;
  v_tit     text;
  v_lemb    integer[];
  v_gids    integer[];
  v_gnomes  text[];
  v_grp     integer[] := '{}';
  v_expl    integer[];
  v_obrig   integer[];
  v_opc     integer[];
  v_todos   integer[];
  v_ids     uuid[];
  v_serie   boolean := coalesce(p->>'aplicar','este') = 'seguintes';
  v_delta   integer := 0;
  v_notif   boolean := coalesce((p->>'notificar')::boolean, true);
  v_antes   integer[];
  v_entram  integer[] := '{}';
  v_saem    integer[] := '{}';
  v_ext_in  uuid[] := '{}';
  v_ext_sai uuid[] := '{}';
  v_ext_fic uuid[] := '{}';
  v_mudou   text[] := '{}';
  v_ocor    integer := 0;
  v_recmud  boolean := false;
begin
  if v_eu is null then return jsonb_build_object('status','sem_vinculo'); end if;
  select nome into v_quem from membros where registro = v_eu;

  if not v_novo then
    select * into v_ev from eventos where id = v_id;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    if not (v_gestor or v_ev.owner_registro = v_eu) then return jsonb_build_object('status','sem_permissao'); end if;
  elsif not exists (select 1 from membros where registro = v_eu and status in ('Ativo','Em pausa / avaliação','Sob demanda')) then
    return jsonb_build_object('status','sem_vinculo');
  end if;

  if nullif(p->>'predefinido_id','') is not null then
    select * into v_pd from agenda_predefinidos where id = (p->>'predefinido_id')::uuid;
  end if;

  -- datas e horas
  begin
    v_data := coalesce(nullif(p->>'data','')::date, v_ev.data);
    v_fim  := case when p ? 'data_fim' then nullif(p->>'data_fim','')::date else v_ev.data_fim end;
    v_hi   := case when p ? 'hora_inicio' then nullif(p->>'hora_inicio','')::time else v_ev.hora_inicio end;
    v_hf   := case when p ? 'hora_fim' then nullif(p->>'hora_fim','')::time else v_ev.hora_fim end;
    v_ate  := case when p ? 'repetir_ate' then nullif(p->>'repetir_ate','')::date else v_ev.serie_ate end;
  exception when others then
    return jsonb_build_object('status','invalido','campo','data');
  end;
  if coalesce((p->>'dia_inteiro')::boolean, false) then v_hi := null; v_hf := null; end if;
  if v_data is null then return jsonb_build_object('status','invalido','campo','data'); end if;
  if v_fim is not null and v_fim <= v_data then v_fim := null; end if;
  if v_hi is not null and v_hf is not null and v_hf <= v_hi and v_fim is null then
    return jsonb_build_object('status','invalido','campo','horario');
  end if;
  if v_hi is null then v_hf := null; end if;

  v_rec := coalesce(nullif(p->>'recorrencia',''), v_ev.recorrencia, 'Única');
  if v_rec not in ('Única','Diária','Dias úteis','Semanal','Quinzenal','Mensal','Anual') then
    return jsonb_build_object('status','invalido','campo','recorrencia');
  end if;
  v_vis := coalesce(nullif(p->>'visibilidade',''), v_ev.visibilidade, v_pd.visibilidade, 'convidados');
  if v_vis not in ('equipe','convidados','privado') then return jsonb_build_object('status','invalido','campo','visibilidade'); end if;
  if nullif(p->>'cor','') is not null and (p->>'cor') !~* '^#[0-9a-f]{6}$' then
    return jsonb_build_object('status','invalido','campo','cor');
  end if;
  v_tit := coalesce(nullif(trim(p->>'titulo'),''), v_ev.titulo, nullif(trim(v_pd.titulo),''), v_pd.nome, '(sem título)');

  if p ? 'lembretes' then
    select coalesce(array_agg(distinct v::integer order by v::integer), '{}') into v_lemb
      from jsonb_array_elements_text(case when jsonb_typeof(p->'lembretes') = 'array' then p->'lembretes' else '[]' end) t(v)
     where v ~ '^\d+$' and v::integer between 0 and 40320;
  else
    v_lemb := coalesce(v_ev.lembretes, v_pd.lembretes, '{}');
  end if;

  -- convidados: pessoas, grupos (com quem está abaixo deles), a equipe toda
  if p ? 'obrigatorios' or p ? 'opcionais' or p ? 'grupos' or p ? 'todos' or v_novo then
    select coalesce(array_agg(distinct v::integer), '{}') into v_gids
      from jsonb_array_elements_text(case when jsonb_typeof(p->'grupos') = 'array' then p->'grupos' else '[]' end) t(v)
     where v ~ '^\d+$';
    -- (2.31.1) só os grupos que existem; o evento guarda os ids
    v_gids := array(select id from grupos where id = any(v_gids) order by id);
    select coalesce(array_agg(nome order by nome), '{}') into v_gnomes from grupos where id = any(v_gids);
    -- quem foi desligado não é convidado de nada
    select coalesce(array_agg(distinct v::integer), '{}') into v_expl
      from jsonb_array_elements_text(case when jsonb_typeof(p->'obrigatorios') = 'array' then p->'obrigatorios' else '[]' end) t(v)
     where v ~ '^\d+$'
       and v::integer in (select registro from membros where coalesce(status,'') not in ('Desligado','Egresso'));
    select coalesce(array_agg(m.registro), '{}') into v_grp from membros m
     where m.status in ('Ativo','Em pausa / avaliação')
       and ( coalesce((p->>'todos')::boolean, false)
          or exists (select 1 from unnest(v_gids) g where public.esta_no_grupo(g, m.registro)) );
    select coalesce(array_agg(distinct v::integer), '{}') into v_opc
      from jsonb_array_elements_text(case when jsonb_typeof(p->'opcionais') = 'array' then p->'opcionais' else '[]' end) t(v)
     where v ~ '^\d+$'
       and v::integer in (select registro from membros where coalesce(status,'') not in ('Desligado','Egresso'));
    -- obrigatório escrito vence opcional; opcional escrito vence o grupo
    v_opc   := array(select unnest(v_opc) except select unnest(v_expl));
    v_obrig := array((select unnest(v_expl) union select unnest(v_grp)) except select unnest(v_opc));
    v_todos := array(select unnest(v_obrig) union select unnest(v_opc)
                     union select m.registro from membros m
                            where m.registro = coalesce(v_ev.owner_registro, v_eu)
                              and coalesce(m.status,'') not in ('Desligado','Egresso'));
  end if;

  ------------------------------------------------------------ criar
  if v_novo then
    insert into eventos (titulo, tipo, data, data_fim, hora, hora_inicio, hora_fim, espaco_id, local,
      recorrencia, owner_registro, grupos, grupo_ids, pauta, status, criado_por, categoria, visibilidade,
      serie_ate, meet_url, cor, lembretes, predefinido_id)
    values (left(v_tit,160), coalesce(v_pd.nome, 'Evento'), v_data, v_fim,
      case when v_hi is null then null when v_hf is null then to_char(v_hi,'HH24:MI')
           else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
      v_hi, v_hf, coalesce(nullif(p->>'espaco_id','')::integer, v_pd.espaco_id),
      coalesce(nullif(trim(p->>'local'),''), v_pd.local), v_rec, v_eu, v_gnomes, v_gids,
      coalesce(nullif(trim(p->>'descricao'),''), v_pd.descricao), 'Preparação', v_quem, 'reuniao', v_vis,
      case when v_rec = 'Única' then null else v_ate end,
      coalesce(nullif(trim(p->>'meet_url'),''), v_pd.meet_url), nullif(p->>'cor',''), v_lemb, v_pd.id)
    returning * into v_ev;

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select v_ev.id, r, case when r = any(v_grp) then 'grupo' else 'manual' end,
           case when r = any(v_opc) then 'opcional' else 'obrigatorio' end,
           case when r = v_eu then 'vou' else 'pendente' end,
           case when r = v_eu then now() end, now()
      from unnest(v_todos) r;

    insert into evento_externos (evento_id, email, nome)
    select v_ev.id, lower(trim(x->>'email')), nullif(trim(x->>'nome'),'')
      from jsonb_array_elements(case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) x
     where trim(x->>'email') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$'
    on conflict do nothing;

    if v_rec <> 'Única' then
      update eventos set serie_id = v_ev.id where id = v_ev.id;
      v_ocor := public.agenda_gerar_serie(v_ev.id, least(coalesce(v_ate, current_date + 120), current_date + 400));
    end if;

    if v_notif then
      perform public.agenda_enfileirar(v_ev.id, 'convite', v_todos,
        array(select id from evento_externos where evento_id = v_ev.id));
      perform public.agenda_sino(v_todos, 'agenda_convite', 'Convite: ' || v_tit,
        public.agenda_quando(v_data, v_fim, v_hi, v_hf), '#/agenda/evento/' || v_ev.id);
    end if;
    return jsonb_build_object('status','ok','id',v_ev.id,'numero',v_ev.numero,
      'convidados', coalesce(array_length(v_todos,1),0), 'ocorrencias', v_ocor);
  end if;

  ------------------------------------------------------------ editar
  v_recmud := (p ? 'recorrencia' and v_rec is distinct from coalesce(v_ev.recorrencia,'Única'))
           or (p ? 'repetir_ate' and v_ate is distinct from v_ev.serie_ate);

  -- reagendar: todos os encontros escolhidos andam o mesmo número de
  -- dias (um só, ou este e os seguintes da série)
  if v_serie and v_ev.serie_id is not null and not v_recmud then
    select coalesce(array_agg(id order by data), '{}') into v_ids from eventos
     where serie_id = v_ev.serie_id and data >= v_ev.data and coalesce(status,'') <> 'Cancelado';
  else
    v_ids := array[v_ev.id];
  end if;
  v_delta := v_data - v_ev.data;

  -- o que mudou, para o e-mail
  if v_data <> v_ev.data or v_fim is distinct from v_ev.data_fim then v_mudou := v_mudou || 'data'::text; end if;
  if v_hi is distinct from v_ev.hora_inicio or v_hf is distinct from v_ev.hora_fim then v_mudou := v_mudou || 'horário'::text; end if;
  if (p ? 'local' and nullif(trim(p->>'local'),'') is distinct from v_ev.local)
     or (p ? 'espaco_id' and nullif(p->>'espaco_id','')::integer is distinct from v_ev.espaco_id) then
    v_mudou := v_mudou || 'local'::text; end if;
  if p ? 'meet_url' and nullif(trim(p->>'meet_url'),'') is distinct from v_ev.meet_url then v_mudou := v_mudou || 'link da chamada'::text; end if;
  if v_tit is distinct from v_ev.titulo then v_mudou := v_mudou || 'título'::text; end if;
  if v_recmud then v_mudou := v_mudou || 'repetição'::text; end if;

  update eventos e set
    titulo       = left(v_tit,160),
    data         = e.data + v_delta,
    data_fim     = case when v_fim is null then null else e.data + v_delta + (v_fim - v_data) end,
    hora_inicio  = v_hi,
    hora_fim     = v_hf,
    hora         = case when v_hi is null then null when v_hf is null then to_char(v_hi,'HH24:MI')
                        else to_char(v_hi,'HH24:MI') || ' às ' || to_char(v_hf,'HH24:MI') end,
    pauta        = case when p ? 'descricao' then nullif(trim(p->>'descricao'),'') else e.pauta end,
    meet_url     = case when p ? 'meet_url' then nullif(trim(p->>'meet_url'),'') else e.meet_url end,
    local        = case when p ? 'local' then nullif(trim(p->>'local'),'') else e.local end,
    espaco_id    = case when p ? 'espaco_id' then nullif(p->>'espaco_id','')::integer else e.espaco_id end,
    visibilidade = v_vis,
    cor          = case when p ? 'cor' then nullif(p->>'cor','') else e.cor end,
    lembretes    = v_lemb,
    predefinido_id = case when p ? 'predefinido_id' then v_pd.id else e.predefinido_id end,
    grupos       = case when v_todos is not null then v_gnomes else e.grupos end,
    grupo_ids    = case when v_todos is not null then v_gids else e.grupo_ids end,
    atualizado_em = now()
  where e.id = any(v_ids);

  -- a repetição mudou: a série antiga para antes deste encontro, e este
  -- vira a base da nova (ou fica sozinho)
  if v_recmud then
    if v_ev.serie_id is not null then
      update eventos set status = 'Cancelado'
       where serie_id = v_ev.serie_id and data > v_ev.data and id <> v_ev.id;
      update eventos set serie_ate = v_ev.data - 1
       where serie_id = v_ev.serie_id and data < v_ev.data;
    end if;
    update eventos set recorrencia = v_rec,
                       serie_id = case when v_rec = 'Única' then null else id end,
                       serie_ate = case when v_rec = 'Única' then null else v_ate end
     where id = v_ev.id;
    if v_rec <> 'Única' then
      v_ocor := public.agenda_gerar_serie(v_ev.id, least(coalesce(v_ate, current_date + 120), current_date + 400));
    end if;
  end if;

  -- convidados
  select coalesce(array_agg(registro), '{}') into v_antes from evento_participantes where evento_id = v_ev.id;
  if v_todos is not null then
    v_entram := array(select unnest(v_todos) except select unnest(v_antes));
    v_saem   := array(select unnest(v_antes) except select unnest(v_todos));
    if v_notif and array_length(v_saem,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'cancelamento', v_saem, '{}');
    end if;
    delete from evento_participantes where evento_id = any(v_ids) and not (registro = any(v_todos));
    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select ev, r, case when r = any(v_grp) then 'grupo' else 'manual' end,
           case when r = any(v_opc) then 'opcional' else 'obrigatorio' end,
           case when r = v_ev.owner_registro then 'vou' else 'pendente' end,
           case when r = v_ev.owner_registro then now() end, now()
      from unnest(v_ids) ev cross join unnest(v_todos) r
     where not exists (select 1 from evento_participantes x where x.evento_id = ev and x.registro = r);
    update evento_participantes set papel = case when registro = any(v_opc) then 'opcional' else 'obrigatorio' end
     where evento_id = any(v_ids);
  end if;

  if p ? 'externos' then
    select coalesce(array_agg(id), '{}') into v_ext_sai from evento_externos
     where evento_id = v_ev.id and lower(email) not in (
       select lower(trim(x->>'email')) from jsonb_array_elements(
         case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) x);
    if v_notif and array_length(v_ext_sai,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'cancelamento', '{}', v_ext_sai);
    end if;
    delete from evento_externos x where x.evento_id = any(v_ids) and lower(x.email) not in (
      select lower(trim(y->>'email')) from jsonb_array_elements(
        case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) y);
    with ins as (
      insert into evento_externos (evento_id, email, nome)
      select ev, y.email, y.nome
        from unnest(v_ids) ev
        cross join (select lower(trim(z->>'email')) as email, nullif(trim(z->>'nome'),'') as nome
                      from jsonb_array_elements(case when jsonb_typeof(p->'externos') = 'array' then p->'externos' else '[]' end) z
                     where trim(z->>'email') ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$') y
      on conflict do nothing
      returning id, evento_id)
    select coalesce(array_agg(id) filter (where evento_id = v_ev.id), '{}') into v_ext_in from ins;
  end if;
  select coalesce(array_agg(id), '{}') into v_ext_fic from evento_externos
   where evento_id = v_ev.id and not (id = any(v_ext_in));

  if v_notif then
    if array_length(v_entram,1) is not null or array_length(v_ext_in,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'convite', v_entram, v_ext_in);
      perform public.agenda_sino(v_entram, 'agenda_convite', 'Convite: ' || v_tit,
        public.agenda_quando(v_data, v_fim, v_hi, v_hf), '#/agenda/evento/' || v_ev.id);
    end if;
    if array_length(v_mudou,1) is not null then
      perform public.agenda_enfileirar(v_ev.id, 'alteracao',
        array(select registro from evento_participantes
               where evento_id = v_ev.id and not (registro = any(v_entram)) and coalesce(resposta,'') <> 'nao'),
        v_ext_fic, array_to_string(v_mudou, ', '));
      perform public.agenda_sino(
        array(select registro from evento_participantes where evento_id = v_ev.id and not (registro = any(v_entram))),
        'agenda_alteracao', 'Evento alterado: ' || v_tit,
        'Mudou: ' || array_to_string(v_mudou, ', ') || '. ' || public.agenda_quando(v_data, v_fim, v_hi, v_hf),
        '#/agenda/evento/' || v_ev.id);
    end if;
  end if;

  return jsonb_build_object('status','ok','id',v_ev.id,'numero',v_ev.numero,
    'eventos', coalesce(array_length(v_ids,1),0), 'ocorrencias', v_ocor,
    'entraram', coalesce(array_length(v_entram,1),0), 'sairam', coalesce(array_length(v_saem,1),0),
    'mudou', to_jsonb(v_mudou));
end $$;
revoke execute on function public.agenda_evento_salvar(jsonb) from public, anon;
grant  execute on function public.agenda_evento_salvar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4. RECORRÊNCIA — o encontro novo copia o último, não o primeiro
--    As datas seguem o padrão do primeiro encontro, como antes. Os
--    convidados (e os de fora, e os grupos) vêm do último encontro
--    não cancelado; quem foi desligado fica de fora; quem está nos
--    grupos hoje entra.
-- ------------------------------------------------------------
create or replace function public.agenda_gerar_serie(p_serie uuid, p_ate date)
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v_base   public.eventos%rowtype;
  v_mod    public.eventos%rowtype;
  v_ultima date;
  v_limite date;
  v_data   date;
  v_novo   uuid;
  v_k      integer := 1;
  v_n      integer := 0;
  v_rec    text;
  v_dur    integer;
  v_grp    integer[];
begin
  select * into v_base from eventos where serie_id = p_serie order by data limit 1;
  if not found then return 0; end if;
  v_rec := coalesce(v_base.recorrencia, 'Única');
  if v_rec not in ('Diária','Dias úteis','Semanal','Quinzenal','Mensal','Anual') then return 0; end if;
  v_dur := coalesce(v_base.data_fim - v_base.data, 0);

  select * into v_mod from eventos
   where serie_id = p_serie and coalesce(status,'') <> 'Cancelado' order by data desc limit 1;
  if not found then v_mod := v_base; end if;

  -- quem está nos grupos do evento hoje
  select coalesce(array_agg(m.registro), '{}') into v_grp from membros m
   where m.status in ('Ativo','Em pausa / avaliação')
     and exists (select 1 from unnest(coalesce(v_mod.grupo_ids,'{}')) g where public.esta_no_grupo(g, m.registro));

  select max(data) into v_ultima from eventos where serie_id = p_serie;
  v_limite := least(p_ate, coalesce(v_base.serie_ate, p_ate));

  loop
    v_data := case v_rec
      when 'Diária'     then v_base.data + v_k
      when 'Dias úteis' then v_base.data + v_k
      when 'Semanal'    then v_base.data + 7 * v_k
      when 'Quinzenal'  then v_base.data + 14 * v_k
      when 'Mensal'     then (v_base.data + make_interval(months => v_k))::date
      else                   (v_base.data + make_interval(years => v_k))::date end;
    v_k := v_k + 1;
    exit when v_data > v_limite or v_k > 800 or v_n >= 300;
    continue when v_data <= v_ultima;
    continue when v_rec = 'Dias úteis' and extract(isodow from v_data) > 5;

    insert into eventos (titulo, tipo, data, data_fim, hora, hora_inicio, hora_fim, espaco_id, local,
      recorrencia, owner_registro, grupos, grupo_ids, pauta, status, criado_por,
      categoria, visibilidade, serie_id, serie_ate, meet_url, cor, lembretes, predefinido_id)
    values (v_base.titulo, v_base.tipo, v_data, case when v_dur > 0 then v_data + v_dur end,
      v_base.hora, v_base.hora_inicio, v_base.hora_fim, v_base.espaco_id, v_base.local,
      v_base.recorrencia, v_base.owner_registro, v_mod.grupos, coalesce(v_mod.grupo_ids,'{}'), v_base.pauta,
      'Preparação', v_base.criado_por,
      v_base.categoria, v_base.visibilidade, p_serie, v_base.serie_ate, v_base.meet_url,
      v_base.cor, v_base.lembretes, v_base.predefinido_id)
    returning id into v_novo;

    insert into evento_participantes (evento_id, registro, origem, papel, resposta, respondido_em, convidado_em)
    select v_novo, s.registro, s.origem, s.papel,
           case when s.registro = v_base.owner_registro then 'vou' else 'pendente' end,
           case when s.registro = v_base.owner_registro then now() end, now()
      from (
        select x.registro, x.origem, coalesce(x.papel,'obrigatorio') as papel
          from evento_participantes x join membros m on m.registro = x.registro
         where x.evento_id = v_mod.id and coalesce(m.status,'') not in ('Desligado','Egresso')
        union all
        select r, 'grupo', 'obrigatorio' from unnest(v_grp) r
         where not exists (select 1 from evento_participantes x where x.evento_id = v_mod.id and x.registro = r)
      ) s;
    insert into evento_externos (evento_id, email, nome)
    select v_novo, x.email, x.nome from evento_externos x where x.evento_id = v_mod.id;

    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.agenda_gerar_serie(uuid, date) from public, anon;
grant  execute on function public.agenda_gerar_serie(uuid, date) to authenticated;

-- ------------------------------------------------------------
-- 5. A AGENDA ACOMPANHA A FICHA
--    agenda_sincronizar_membro(registro) põe a agenda de uma pessoa
--    em dia com a ficha dela:
--      desligada (ou sem ficha) → sai dos convidados de todo evento
--        que ainda não terminou, e a fila de e-mail dela se esvazia;
--      ativa → entra nas ocorrências de hoje em diante das séries com
--        um grupo em que ela está, com um convite por série.
--    O gatilho chama a cada mudança de status ou de grupos.
-- ------------------------------------------------------------
create or replace function public.agenda_sincronizar_membro(p_registro integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_status text;
  v_ins    uuid[];
  v_saiu   integer := 0;
  v_entrou integer := 0;
  r        record;
begin
  if p_registro is null then return jsonb_build_object('status','invalido'); end if;
  select status into v_status from membros where registro = p_registro;

  if not found or coalesce(v_status,'') in ('Desligado','Egresso') then
    delete from agenda_envios where para_registro = p_registro and enviado_em is null;
    delete from evento_participantes p using eventos e
     where e.id = p.evento_id and p.registro = p_registro
       and coalesce(e.data_fim, e.data) >= current_date;
    get diagnostics v_saiu = row_count;
    return jsonb_build_object('status','ok','saiu',v_saiu,'entrou',0);
  end if;

  if v_status not in ('Ativo','Em pausa / avaliação') then
    return jsonb_build_object('status','ok','saiu',0,'entrou',0);
  end if;

  with ins as (
    insert into evento_participantes (evento_id, registro, origem, papel, resposta, convidado_em)
    select e.id, p_registro, 'grupo', 'obrigatorio', 'pendente', now()
      from eventos e
     where e.serie_id is not null
       and coalesce(e.recorrencia,'Única') <> 'Única'
       and coalesce(e.status,'') <> 'Cancelado'
       and e.data >= current_date
       and cardinality(e.grupo_ids) > 0
       and exists (select 1 from unnest(e.grupo_ids) g where public.esta_no_grupo(g, p_registro))
       and not exists (select 1 from evento_participantes x where x.evento_id = e.id and x.registro = p_registro)
    returning evento_id)
  select coalesce(array_agg(evento_id), '{}') into v_ins from ins;
  v_entrou := cardinality(v_ins);

  -- um convite por série: o da próxima ocorrência
  for r in
    select distinct on (e.serie_id) e.id, e.titulo, e.data, e.data_fim, e.hora_inicio, e.hora_fim
      from eventos e where e.id = any(v_ins)
     order by e.serie_id, e.data
  loop
    perform public.agenda_enfileirar(r.id, 'convite', array[p_registro], '{}');
    perform public.agenda_sino(array[p_registro], 'agenda_convite', 'Convite: ' || r.titulo,
      public.agenda_quando(r.data, r.data_fim, r.hora_inicio, r.hora_fim) || '. Você entrou num grupo desta reunião.',
      '#/agenda/evento/' || r.id);
  end loop;

  return jsonb_build_object('status','ok','saiu',0,'entrou',v_entrou);
end $$;
revoke execute on function public.agenda_sincronizar_membro(integer) from public, anon, authenticated;

create or replace function public.agenda_membro_mudou() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE'
     and new.status is not distinct from old.status
     and new.grupos is not distinct from old.grupos then
    return null;
  end if;
  perform public.agenda_sincronizar_membro(new.registro);
  return null;
end $$;
revoke execute on function public.agenda_membro_mudou() from public, anon, authenticated;

drop trigger if exists agenda_membro_mudou on public.membros;
create trigger agenda_membro_mudou after insert or update of status, grupos on public.membros
  for each row execute function public.agenda_membro_mudou();

-- ------------------------------------------------------------
-- 6. O QUE JÁ ESTAVA ERRADO
--    Quem já está desligado sai dos convites que ainda vão acontecer,
--    sem aviso. (Entrar nas séries não roda aqui: isso mandaria
--    convites de uma vez para toda a equipe. Vale da próxima mudança
--    na ficha em diante, e os encontros que a série gerar já nascem
--    com o grupo de hoje.)
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in select registro from public.membros where coalesce(status,'') in ('Desligado','Egresso') loop
    perform public.agenda_sincronizar_membro(r.registro);
  end loop;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.31.1_agenda_grupos', 'A agenda segue os grupos e o desligamento: eventos.grupo_ids; desligado sai dos convites de eventos que não terminaram (e da fila de e-mail); quem entra num grupo entra nas próximas ocorrências das séries dele, com um convite por série; a série copia os convidados do último encontro; o opcional do grupo continua opcional. Troca agenda_evento, agenda_evento_salvar e agenda_gerar_serie; gatilho agenda_membro_mudou em membros')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from public.eventos where cardinality(grupo_ids) > 0) as "eventos com grupo",
       (select count(*) from public.evento_participantes p join public.eventos e on e.id = p.evento_id
          join public.membros m on m.registro = p.registro
         where coalesce(m.status,'') in ('Desligado','Egresso') and coalesce(e.data_fim, e.data) >= current_date) as "desligados ainda convidados (deve ser 0)";

-- ============================================================
-- FIM, SOMA 2.31.1
-- Depois de rodar, publique o portal: a tela do evento passa a gravar
-- o grupo convidado (antes ela só punha as pessoas dele).
-- ============================================================
