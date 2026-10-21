-- ============================================================
-- SOMA 2.19.1: reporte semanal por liderança direta
--
-- A sprint abre na segunda e fecha na sexta; a reunião da gerência é sexta
-- às 16h. A partir do ciclo de ativação (reporte_config.modelo_lider_desde):
--
--   - um reporte por líder e semana (sem escolher frente): a lista de pessoas
--     é a dos liderados diretos (membros.gestor_registro), fotografada ao
--     abrir, mais participantes excepcionais com justificativa;
--   - cobrança: sexta 7h–16h aviso; a partir das 16h obrigatória, até enviar
--     ou declarar "estive ausente". Férias e afastamento no instante do prazo
--     dispensam. O envio continua aberto até a sprint seguinte abrir
--     (segunda 0h); depois das 16h fica marcado como atrasado;
--   - o envio grava entregas e assiduidade na ficha (membro_reporte_avaliacoes)
--     e processa as sinalizações: 1ª de uma sequência → card no NRO_PMO
--     (no máximo um a cada 30 dias); 2ª em até 60 dias da 1ª → offboarding,
--     um card no NRO_PESSOAL e outro no NRO_COORD_OFFICE; offboarding já
--     aberto → só comentário nos cards. Uma ocorrência contável por pessoa e
--     ciclo (dois líderes no mesmo ciclo contam uma).
--
-- Os ciclos e reportes anteriores (por frente) ficam como estão e continuam
-- consultáveis pelas funções antigas. Só acrescenta; pode rodar de novo.
-- Depende da 2.18.0 (reporte) e da 2.19.1_recadastro (nada; a ausência é
-- calculada aqui, no instante do prazo).
-- ============================================================

-- 1. estrutura -------------------------------------------------------------
alter table public.reportes alter column frente_id drop not null;
alter table public.reportes
  add column if not exists modelo   text not null default 'frente',
  add column if not exists pessoas  jsonb not null default '[]',
  add column if not exists atrasado boolean not null default false;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'reportes_modelo_check') then
    alter table public.reportes add constraint reportes_modelo_check
      check (modelo in ('frente', 'lider') and (modelo = 'lider' or frente_id is not null));
  end if;
end $$;
create unique index if not exists reportes_lider_unico on public.reportes (ciclo_id, autor) where modelo = 'lider';

alter table public.reporte_ciclos
  add column if not exists modelo   text not null default 'frente',
  add column if not exists fecha_em timestamptz;
alter table public.reporte_config add column if not exists modelo_lider_desde date;

-- a semana da sprint: prazo e reunião na sexta 16h (só troca o padrão antigo)
update public.reporte_config set dia_prazo = 4, hora_prazo = '16:00', dia_reuniao = 4, hora_reuniao = '16:00'
 where id and dia_prazo = 5 and hora_prazo = '18:00' and dia_reuniao = 0 and hora_reuniao = '09:00';
-- ativação: esta semana, se ainda não há reporte por frente nela; senão, a próxima
update public.reporte_config set modelo_lider_desde =
  case when exists (select 1 from reportes r join reporte_ciclos c on c.id = r.ciclo_id
                     where c.semana = date_trunc('week', now() at time zone 'America/Sao_Paulo')::date)
       then date_trunc('week', now() at time zone 'America/Sao_Paulo')::date + 7
       else date_trunc('week', now() at time zone 'America/Sao_Paulo')::date end
 where id and modelo_lider_desde is null;

-- o que vai para a ficha: uma linha por pessoa, ciclo e autor
create table if not exists public.membro_reporte_avaliacoes (
  registro    integer not null references membros(registro),
  ciclo_id    uuid not null references reporte_ciclos(id),
  autor       integer not null references membros(registro),
  reporte_id  uuid not null references reportes(id),
  entregas    text not null check (entregas in ('SUFICIENTE', 'INSUFICIENTE')),
  assiduidade text not null check (assiduidade in ('SUFICIENTE', 'INSUFICIENTE')),
  origem      text not null default 'direto' check (origem in ('direto', 'excepcional')),
  criada_em   timestamptz not null default now(),
  primary key (registro, ciclo_id, autor));

-- a sequência de acompanhamento de cada pessoa
create table if not exists public.reporte_sequencias (
  id                uuid primary key default gen_random_uuid(),
  registro          integer not null references membros(registro),
  iniciada_em       timestamptz not null,
  pmo_card          uuid references atividades(id) on delete set null,
  pmo_em            timestamptz,
  offboarding_em    timestamptz,
  offboarding_cards uuid[] not null default '{}');
create index if not exists reporte_sequencias_reg on public.reporte_sequencias (registro, iniciada_em desc);

create table if not exists public.reporte_sinalizacoes (
  id                  uuid primary key default gen_random_uuid(),
  registro            integer not null references membros(registro),
  ciclo_id            uuid not null references reporte_ciclos(id),
  reporte_id          uuid not null references reportes(id),
  autor               integer not null references membros(registro),
  relato              text not null check (length(btrim(relato)) > 0),
  conversa_confirmada boolean not null check (conversa_confirmada),
  contavel            boolean not null,
  sequencia_id        uuid references reporte_sequencias(id),
  efeito              text not null default 'nenhum'
                      check (efeito in ('nenhum', 'pmo', 'pmo_recente', 'offboarding', 'historico', 'sem_grupo')),
  criada_em           timestamptz not null default now(),
  unique (reporte_id, registro));

create table if not exists public.reporte_cobrancas (
  ciclo_id     uuid not null references reporte_ciclos(id),
  registro     integer not null references membros(registro),
  como         text not null check (como in ('enviado', 'ausente')),
  resolvido_em timestamptz not null default now(),
  primary key (ciclo_id, registro));

do $$ declare t text; begin
  foreach t in array array['membro_reporte_avaliacoes', 'reporte_sequencias', 'reporte_sinalizacoes', 'reporte_cobrancas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. quem é quem -----------------------------------------------------------
-- pelo nome; o Pessoal e o PMO também pela chave (grupos.chave 'pessoal' e 'pmo')
create or replace function public.grupo_por_nome(p_nome text)
returns integer language sql stable security definer set search_path = public as $$
  select id from grupos
   where ativo and (upper(nome) = upper(p_nome)
         or chave = case upper(p_nome) when 'NRO_PESSOAL' then 'pessoal' when 'NRO_PMO' then 'pmo' end)
   order by (upper(nome) = upper(p_nome)) desc limit 1 $$;

-- quem tem a obrigação do reporte: o papel liderança (com a herança de grupos)
create or replace function public.reporte_lideres()
returns setof integer language sql stable security definer set search_path = public as $$
  select m.registro from membros m
   where m.status in ('Ativo', 'Em pausa / avaliação')
     and exists (select 1 from grupo_papeis gp join grupos g on g.id = gp.grupo_id
                  where gp.papel = 'lideranca' and g.ativo and public.esta_no_grupo(g.id, m.registro)) $$;

create or replace function public.reporte_sou_lider()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and public.portal_registro_atual() in (select public.reporte_lideres()) $$;

-- o consolidado da reunião: admin ou NRO_MANAGERS
create or replace function public.reporte_consolidado_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and (public.papel_atual() = 'admin'
    or public.esta_no_grupo(public.grupo_por_nome('NRO_MANAGERS'), public.portal_registro_atual())) $$;

create or replace function public.reporte_liderados(p_lider integer)
returns setof integer language sql stable security definer set search_path = public as $$
  select registro from membros where gestor_registro = p_lider and registro <> p_lider
     and status in ('Ativo', 'Em pausa / avaliação') order by nome $$;

-- férias ou afastamento cobrindo um instante
create or replace function public.ausencia_em(p_reg integer, p_quando timestamptz)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean := false;
begin
  if to_regclass('public.agenda_ausencias') is null then return false; end if;
  execute 'select exists (select 1 from agenda_ausencias where registro = $1 and tipo in (''ferias'', ''afastamento'')
             and inicio <= $2 and fim >= $2)' into v using p_reg, p_quando;
  return coalesce(v, false);
end $$;

-- 3. o ciclo ---------------------------------------------------------------
create or replace function public.reporte_ciclo_materializar()
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare d date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
  c reporte_config; v uuid; novo boolean; lider boolean;
begin
  select * into c from reporte_config where id;
  lider := c.modelo_lider_desde is not null and d >= c.modelo_lider_desde;
  if lider then
    insert into reporte_ciclos (semana, prazo, reuniao_em, fecha_em, modelo)
    values (d, (d + c.dia_prazo + c.hora_prazo) at time zone 'America/Sao_Paulo',
               (d + c.dia_reuniao + c.hora_reuniao) at time zone 'America/Sao_Paulo',
               (d + 7)::timestamp at time zone 'America/Sao_Paulo', 'lider')
    on conflict (semana) do nothing;
    novo := found;
    -- um ciclo desta semana criado pela regra antiga e ainda sem reporte vira do modelo novo
    update reporte_ciclos set modelo = 'lider',
           prazo = (d + c.dia_prazo + c.hora_prazo) at time zone 'America/Sao_Paulo',
           reuniao_em = (d + c.dia_reuniao + c.hora_reuniao) at time zone 'America/Sao_Paulo',
           fecha_em = (d + 7)::timestamp at time zone 'America/Sao_Paulo'
     where semana = d and modelo = 'frente' and not exists (select 1 from reportes r where r.ciclo_id = reporte_ciclos.id);
    select id into v from reporte_ciclos where semana = d;
    if novo then
      perform notificar(array(select l from reporte_lideres() l where not ausencia_em(l, now())),
        'reporte_aberto', 'Reporte semanal disponível',
        'Preencha até sexta, 16h, a hora da reunião da gerência.', '#/servicos/reporte');
    end if;
    return v;
  end if;
  -- regra antiga (por frente), até a ativação
  insert into reporte_ciclos (semana, prazo, reuniao_em)
  values (d, (d + c.dia_prazo + c.hora_prazo) at time zone 'America/Sao_Paulo',
          ((d + 7) + c.dia_reuniao + c.hora_reuniao) at time zone 'America/Sao_Paulo') on conflict do nothing;
  novo := found;
  select id into v from reporte_ciclos where semana = d;
  insert into reporte_frentes (grupo_id, responsavel)
  select g.id, r from grupos g cross join lateral unnest(g.responsaveis) r
    join membros m on m.registro = r where g.ativo and m.status in ('Ativo', 'Em pausa / avaliação')
     and exists (select 1 from grupo_papeis gp join grupos gl on gl.id = gp.grupo_id
                  where gp.papel = 'lideranca' and gl.ativo and esta_no_grupo(gl.id, r))
  on conflict do nothing;
  if novo then perform notificar(array(select distinct responsavel from reporte_frentes f join grupos g on g.id = f.grupo_id
      where f.ativo and g.ativo and f.responsavel = any(g.responsaveis)), 'reporte_aberto', 'Reporte semanal disponível',
      'Preencha as três etapas até o prazo do ciclo.', '#/equipe/reporte'); end if;
  return v;
end $$;
revoke execute on function public.reporte_ciclo_materializar() from public, anon, authenticated;

-- 4. o reporte do líder ----------------------------------------------------
-- uma pessoa da lista: o que a tela precisa para desenhar a linha
create or replace function public.reporte_pessoa_json(p_reg integer, p_origem text, p_just text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('registro', m.registro, 'nome', m.nome, 'cargo', m.cargo, 'origem', p_origem,
           'justificativa', p_just) from membros m where m.registro = p_reg $$;

create or replace function public.reporte_meu(p_ciclo uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); c reporte_ciclos; r reportes; v_ent jsonb; v_sai jsonb; v_cid uuid;
begin
  if not reporte_sou_lider() then return jsonb_build_object('status', 'sem_permissao'); end if;
  v_cid := coalesce(p_ciclo, reporte_ciclo_materializar());  -- antes: o ciclo recém-criado não aparece na mesma consulta
  select * into c from reporte_ciclos where id = v_cid;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if c.modelo <> 'lider' then return jsonb_build_object('status', 'modelo_anterior', 'ciclo', to_jsonb(c)); end if;
  select * into r from reportes where ciclo_id = c.id and autor = v_reg and modelo = 'lider';
  if not found then
    if c.fecha_em <= now() then
      return jsonb_build_object('status', 'ok', 'ciclo', to_jsonb(c), 'reporte', null, 'mudancas', null, 'feed', '[]'::jsonb);
    end if;
    insert into reportes (ciclo_id, frente_id, autor, modelo, pessoas, apontamentos)
    select c.id, null, v_reg, 'lider',
           coalesce(jsonb_agg(reporte_pessoa_json(l, 'direto')), '[]'),
           coalesce(jsonb_agg(jsonb_build_object('registro', l, 'entregas', 'SUFICIENTE', 'assiduidade', 'SUFICIENTE',
                                                 'sinalizacao', null)), '[]')
      from reporte_liderados(v_reg) l
    on conflict (ciclo_id, autor) where modelo = 'lider' do nothing;
    select * into r from reportes where ciclo_id = c.id and autor = v_reg and modelo = 'lider';
  end if;
  -- a cadeia mudou desde que o reporte foi aberto? (só antes do envio)
  if r.enviado_em is null then
    select coalesce(jsonb_agg(reporte_pessoa_json(l, 'direto')), '[]') into v_ent from reporte_liderados(v_reg) l
     where not exists (select 1 from jsonb_array_elements(r.pessoas) p where (p->>'registro')::integer = l);
    select coalesce(jsonb_agg(p), '[]') into v_sai from jsonb_array_elements(r.pessoas) p
     where p->>'origem' = 'direto' and (p->>'registro')::integer not in (select reporte_liderados(v_reg));
  end if;
  return jsonb_build_object('status', 'ok', 'ciclo', to_jsonb(c),
    'reporte', to_jsonb(r) - 'frente_id',
    'mudancas', case when r.enviado_em is null and (jsonb_array_length(v_ent) > 0 or jsonb_array_length(v_sai) > 0)
                     then jsonb_build_object('entram', v_ent, 'saem', v_sai) end,
    'feed', coalesce((select jsonb_agg(to_jsonb(f)) from feed_itens f where f.reporte_id = r.id), '[]'));
end $$;

-- o reporte que eu posso editar agora (lock, autor, aberto)
create or replace function public.reporte_lider_editavel(p_id uuid, p_versao integer)
returns text language plpgsql volatile security definer set search_path = public as $$
declare r reportes; c reporte_ciclos;
begin
  select * into r from reportes where id = p_id for update;
  if not found or r.modelo <> 'lider' or r.autor is distinct from portal_registro_atual() or not reporte_sou_lider() then
    return 'sem_permissao'; end if;
  select * into c from reporte_ciclos where id = r.ciclo_id;
  if r.enviado_em is not null or c.fechado or c.fecha_em <= now() then return 'encerrado'; end if;
  if p_versao is not null and p_versao is distinct from r.versao then return 'conflito'; end if;
  return 'ok';
end $$;
revoke execute on function public.reporte_lider_editavel(uuid, integer) from public, anon, authenticated;

-- aceitar a cadeia atual: entra quem passou a ser liderado, sai quem deixou (sem perder o resto)
create or replace function public.reporte_cadeia_atualizar(p_id uuid, p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s text := reporte_lider_editavel(p_id, p_versao); r reportes; v_reg integer := portal_registro_atual(); n integer;
begin
  if s <> 'ok' then return jsonb_build_object('status', s); end if;
  select * into r from reportes where id = p_id;
  update reportes set
    pessoas = (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(r.pessoas) p
                where p->>'origem' <> 'direto' or (p->>'registro')::integer in (select reporte_liderados(v_reg)))
              || (select coalesce(jsonb_agg(reporte_pessoa_json(l, 'direto')), '[]') from reporte_liderados(v_reg) l
                   where not exists (select 1 from jsonb_array_elements(r.pessoas) p where (p->>'registro')::integer = l)),
    apontamentos = (select coalesce(jsonb_agg(a), '[]') from jsonb_array_elements(r.apontamentos) a
                     where exists (select 1 from jsonb_array_elements(r.pessoas) p where p->'registro' = a->'registro'
                                     and (p->>'origem' <> 'direto' or (p->>'registro')::integer in (select reporte_liderados(v_reg)))))
              || (select coalesce(jsonb_agg(jsonb_build_object('registro', l, 'entregas', 'SUFICIENTE', 'assiduidade', 'SUFICIENTE',
                                                               'sinalizacao', null)), '[]') from reporte_liderados(v_reg) l
                   where not exists (select 1 from jsonb_array_elements(r.pessoas) p where (p->>'registro')::integer = l)),
    versao = versao + 1, atualizado_em = now()
   where id = p_id returning versao into n;
  return jsonb_build_object('status', 'ok', 'versao', n);
end $$;

-- participante excepcional (fora da cadeia direta), com justificativa
create or replace function public.reporte_participante(p_id uuid, p_versao integer, p_registro integer,
                                                       p_justificativa text, p_incluir boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s text := reporte_lider_editavel(p_id, p_versao); r reportes; n integer;
begin
  if s <> 'ok' then return jsonb_build_object('status', s); end if;
  select * into r from reportes where id = p_id;
  if p_incluir then
    if p_registro = r.autor or not exists (select 1 from membros where registro = p_registro and status in ('Ativo', 'Em pausa / avaliação'))
      then return jsonb_build_object('status', 'invalido'); end if;
    if length(btrim(coalesce(p_justificativa, ''))) = 0 then return jsonb_build_object('status', 'justificativa_obrigatoria'); end if;
    if exists (select 1 from jsonb_array_elements(r.pessoas) p where (p->>'registro')::integer = p_registro)
      then return jsonb_build_object('status', 'duplicado'); end if;
    update reportes set pessoas = pessoas || jsonb_build_array(reporte_pessoa_json(p_registro, 'excepcional', btrim(p_justificativa))),
           apontamentos = apontamentos || jsonb_build_array(jsonb_build_object('registro', p_registro, 'entregas', 'SUFICIENTE',
                                                                               'assiduidade', 'SUFICIENTE', 'sinalizacao', null)),
           versao = versao + 1, atualizado_em = now() where id = p_id returning versao into n;
  else
    if not exists (select 1 from jsonb_array_elements(r.pessoas) p where (p->>'registro')::integer = p_registro and p->>'origem' = 'excepcional')
      then return jsonb_build_object('status', 'invalido'); end if;
    update reportes set
      pessoas = (select coalesce(jsonb_agg(p), '[]') from jsonb_array_elements(pessoas) p where (p->>'registro')::integer <> p_registro),
      apontamentos = (select coalesce(jsonb_agg(a), '[]') from jsonb_array_elements(apontamentos) a where (a->>'registro')::integer <> p_registro),
      versao = versao + 1, atualizado_em = now() where id = p_id returning versao into n;
  end if;
  return jsonb_build_object('status', 'ok', 'versao', n);
end $$;

-- salvar: os dois modelos. O do líder valida contra a lista fotografada.
create or replace function public.reporte_lider_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s text; r reportes; x jsonb; n integer;
begin
  s := reporte_lider_editavel((p->>'id')::uuid, (p->>'versao')::integer);
  if s <> 'ok' then return jsonb_build_object('status', s); end if;
  select * into r from reportes where id = (p->>'id')::uuid;
  if jsonb_typeof(p->'apontamentos') is distinct from 'array' or jsonb_typeof(p->'escalonamentos') is distinct from 'array'
     or jsonb_typeof(p->'feed') is distinct from 'array'
     or (p->>'etapa') is null or (p->>'etapa')::integer not between 1 and 3 then return jsonb_build_object('status', 'invalido'); end if;
  for x in select * from jsonb_array_elements(p->'apontamentos') loop
    if not exists (select 1 from jsonb_array_elements(r.pessoas) q where q->'registro' = x->'registro')
       or coalesce(x->>'assiduidade', '') not in ('SUFICIENTE', 'INSUFICIENTE')
       or coalesce(x->>'entregas', '') not in ('SUFICIENTE', 'INSUFICIENTE')
       or (jsonb_typeof(x->'sinalizacao') = 'object' and (length(btrim(coalesce(x->'sinalizacao'->>'relato', ''))) = 0
            or coalesce((x->'sinalizacao'->>'conversa_confirmada')::boolean, false) is not true))
      then return jsonb_build_object('status', 'invalido'); end if;
  end loop;
  if (select count(*) <> count(distinct e->>'registro') from jsonb_array_elements(p->'apontamentos') e)
    then return jsonb_build_object('status', 'invalido'); end if;
  for x in select * from jsonb_array_elements(p->'escalonamentos') loop
    if length(btrim(coalesce(x->>'texto', ''))) = 0 then return jsonb_build_object('status', 'invalido'); end if;
    if nullif(x->>'atividade_id', '') is not null and not exists (select 1 from atividades a
        where a.id = (x->>'atividade_id')::uuid and public.posso_ver_grupo(a.grupo_id))
      then return jsonb_build_object('status', 'sem_permissao'); end if;
  end loop;
  for x in select * from jsonb_array_elements(p->'feed') loop
    if length(btrim(coalesce(x->>'titulo', ''))) not between 1 and 200 or length(btrim(coalesce(x->>'subtitulo', ''))) not between 1 and 400
      then return jsonb_build_object('status', 'invalido'); end if;
    if nullif(x->>'imagem_path', '') is not null and split_part(x->>'imagem_path', '/', 1) <> r.id::text
      then return jsonb_build_object('status', 'invalido'); end if;
  end loop;
  update reportes set apontamentos = p->'apontamentos', escalonamentos = p->'escalonamentos', etapa = (p->>'etapa')::integer,
         versao = versao + 1, atualizado_em = now() where id = r.id returning versao into n;
  delete from feed_itens where reporte_id = r.id and publicado_em is null;
  for x in select * from jsonb_array_elements(p->'feed') loop
    insert into feed_itens (reporte_id, autor, titulo, subtitulo, texto, imagem_path)
    values (r.id, r.autor, btrim(x->>'titulo'), btrim(x->>'subtitulo'), coalesce(x->>'texto', ''), nullif(x->>'imagem_path', ''));
  end loop;
  return jsonb_build_object('status', 'ok', 'versao', n);
end $$;
revoke execute on function public.reporte_lider_salvar(jsonb) from public, anon, authenticated;

-- 5. os cartões das sinalizações -----------------------------------------
-- como atividade_de_origem (v16), mas no quadro pedido; idempotente pela origem
create or replace function public.reporte_card(p_gid integer, p_origem_id text, p_titulo text, p_descricao text)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_seq integer; v_cod text; v_id uuid; v_nome text;
begin
  if p_gid is null then return null; end if;
  select id into v_id from atividades where origem_tipo = 'reporte' and origem_id = p_origem_id;
  if v_id is not null then return v_id; end if;
  perform pg_advisory_xact_lock(hashtext('atividade_seq'), p_gid);
  select coalesce(max(seq), 0) + 1 into v_seq from atividades where grupo_id = p_gid;
  select prefixo || '-' || v_seq::text, nome into v_cod, v_nome from grupos where id = p_gid;
  insert into atividades (codigo, grupo_id, seq, titulo, descricao, status, prioridade, criado_por, ordem, origem_tipo, origem_id)
  values (v_cod, p_gid, v_seq, left(p_titulo, 300), p_descricao, 'a_fazer', 'alta', portal_registro_atual(),
          extract(epoch from now()), 'reporte', p_origem_id)
  on conflict (origem_tipo, origem_id) where origem_tipo is not null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from atividades where origem_tipo = 'reporte' and origem_id = p_origem_id;
    return v_id;
  end if;
  insert into atividade_seguidores (atividade_id, registro)
  select v_id, m.registro from membros m
   where m.status in ('Ativo', 'Em pausa / avaliação') and public.esta_no_grupo(p_gid, m.registro)
  on conflict do nothing;
  insert into atividade_log (atividade_id, registro, tipo, campo, para) values (v_id, portal_registro_atual(), 'criou', 'reporte', v_cod);
  perform notificar(array(select m.registro from membros m where m.status in ('Ativo', 'Em pausa / avaliação')
                           and public.esta_no_grupo(p_gid, m.registro) and not ausencia_em(m.registro, now())),
    'reporte_sinalizacao', v_cod || ' · ' || left(p_titulo, 160), null, '#/atividades/card/' || v_cod);
  return v_id;
end $$;
revoke execute on function public.reporte_card(integer, text, text, text) from public, anon, authenticated;

-- uma sinalização enviada; p_quando só existe para o teste (as janelas de 30 e 60 dias)
create or replace function public.reporte_sinalizacao_processar(p_reporte uuid, p_registro integer, p_relato text,
                                                                p_quando timestamptz default now())
returns text language plpgsql volatile security definer set search_path = public as $$
declare r reportes; v_id uuid; v_cont boolean; q reporte_sequencias; v_nome text; v_autor text; v_ef text; c1 uuid; c2 uuid;
begin
  select * into r from reportes where id = p_reporte;
  perform pg_advisory_xact_lock(hashtext('reporte_sinalizacao'), p_registro);
  -- uma ocorrência contável por pessoa e ciclo (D2)
  v_cont := not exists (select 1 from reporte_sinalizacoes where registro = p_registro and ciclo_id = r.ciclo_id and contavel);
  insert into reporte_sinalizacoes (registro, ciclo_id, reporte_id, autor, relato, conversa_confirmada, contavel, criada_em)
  values (p_registro, r.ciclo_id, r.id, r.autor, btrim(p_relato), true, v_cont, p_quando)
  on conflict (reporte_id, registro) do nothing returning id into v_id;
  if v_id is null then return 'repetido'; end if;                 -- o mesmo envio, de novo
  select nome into v_nome from membros where registro = p_registro;
  select nome into v_autor from membros where registro = r.autor;
  select * into q from reporte_sequencias where registro = p_registro and iniciada_em >= p_quando - interval '60 days'
   order by iniciada_em desc limit 1;
  if not v_cont then
    update reporte_sinalizacoes set sequencia_id = q.id, efeito = 'historico' where id = v_id;
    if q.id is not null then
      insert into atividade_comentarios (atividade_id, registro, corpo)
      select a, r.autor, 'Outra sinalização no mesmo ciclo, por ' || v_autor || ': ' || btrim(p_relato)
        from unnest(array_remove(q.offboarding_cards || q.pmo_card, null)) a;
    end if;
    return 'historico';
  end if;
  if q.id is null then
    -- primeira de uma sequência: PMO, se não houve card de PMO nos últimos 30 dias
    insert into reporte_sequencias (registro, iniciada_em) values (p_registro, p_quando) returning * into q;
    if exists (select 1 from reporte_sequencias where registro = p_registro and pmo_em > p_quando - interval '30 days') then
      v_ef := 'pmo_recente';
    else
      c1 := reporte_card(grupo_por_nome('NRO_PMO'), 'seq:' || q.id || ':pmo',
        'Acompanhamento de compromisso: ' || v_nome,
        'Sinalizado no reporte semanal por ' || v_autor || '.' || E'\n\n' || 'Acordo descumprido: ' || btrim(p_relato)
        || E'\n\n' || 'Agendar uma reunião sobre o compromisso com a equipe, registrar o acordo anterior e perguntar se há intenção de permanecer.');
      v_ef := case when c1 is null then 'sem_grupo' else 'pmo' end;
      update reporte_sequencias set pmo_card = c1, pmo_em = case when c1 is not null then p_quando end where id = q.id;
    end if;
  elsif q.offboarding_em is null then
    -- segunda em até 60 dias: offboarding, nos dois quadros
    c1 := reporte_card(grupo_por_nome('NRO_PESSOAL'), 'seq:' || q.id || ':offboarding:pessoal',
      'Offboarding: ' || v_nome,
      'Segunda sinalização em até 60 dias, por ' || v_autor || ': ' || btrim(p_relato) || E'\n\n'
      || 'Conduzir o processo de desligamento. A automação só abre o processo: não desliga nem revoga acessos.');
    c2 := reporte_card(grupo_por_nome('NRO_COORD_OFFICE'), 'seq:' || q.id || ':offboarding:coord',
      'Offboarding: ' || v_nome,
      'Segunda sinalização em até 60 dias, por ' || v_autor || ': ' || btrim(p_relato) || E'\n\n'
      || 'Acompanhar o desligamento pela coordenação.');
    update reporte_sequencias set offboarding_em = p_quando, offboarding_cards = array_remove(array[c1, c2], null) where id = q.id;
    v_ef := case when c1 is null and c2 is null then 'sem_grupo' else 'offboarding' end;
  else
    -- offboarding já aberto: só o histórico
    insert into atividade_comentarios (atividade_id, registro, corpo)
    select a, r.autor, 'Nova sinalização, por ' || v_autor || ': ' || btrim(p_relato) from unnest(q.offboarding_cards) a;
    v_ef := 'historico';
  end if;
  update reporte_sinalizacoes set sequencia_id = q.id, efeito = v_ef where id = v_id;
  return v_ef;
end $$;
revoke execute on function public.reporte_sinalizacao_processar(uuid, integer, text, timestamptz) from public, anon, authenticated;

create or replace function public.reporte_lider_enviar(p_id uuid, p_versao integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s text; r reportes; c reporte_ciclos; x jsonb; p jsonb;
begin
  select * into r from reportes where id = p_id;
  if found and r.enviado_em is not null and r.autor = portal_registro_atual() then return jsonb_build_object('status', 'ok'); end if;
  s := reporte_lider_editavel(p_id, p_versao);
  if s <> 'ok' then return jsonb_build_object('status', s); end if;
  select * into r from reportes where id = p_id;
  select * into c from reporte_ciclos where id = r.ciclo_id;
  if r.etapa <> 3 then return jsonb_build_object('status', 'incompleto'); end if;
  if exists (select 1 from jsonb_array_elements(r.pessoas) q
              where not exists (select 1 from jsonb_array_elements(r.apontamentos) a where a->'registro' = q->'registro'))
    then return jsonb_build_object('status', 'incompleto'); end if;
  for x in select * from jsonb_array_elements(r.apontamentos) loop
    select q into p from jsonb_array_elements(r.pessoas) q where q->'registro' = x->'registro';
    insert into membro_reporte_avaliacoes (registro, ciclo_id, autor, reporte_id, entregas, assiduidade, origem)
    values ((x->>'registro')::integer, r.ciclo_id, r.autor, r.id, x->>'entregas', x->>'assiduidade', coalesce(p->>'origem', 'direto'))
    on conflict do nothing;
    if jsonb_typeof(x->'sinalizacao') = 'object' then
      perform reporte_sinalizacao_processar(r.id, (x->>'registro')::integer, x->'sinalizacao'->>'relato');
    end if;
  end loop;
  update reportes set enviado_em = now(), atrasado = now() > c.prazo, versao = versao + 1 where id = r.id;
  insert into reporte_cobrancas (ciclo_id, registro, como) values (r.ciclo_id, r.autor, 'enviado')
  on conflict (ciclo_id, registro) do update set como = 'enviado', resolvido_em = now();
  -- o feed segue como na 2.18 até o pacote de publicação (NRO_MANAGERS)
  update feed_itens set publicado_em = now() where reporte_id = r.id and publicado_em is null;
  return jsonb_build_object('status', 'ok', 'atrasado', now() > c.prazo);
end $$;
revoke execute on function public.reporte_lider_enviar(uuid, integer) from public, anon, authenticated;

-- as RPCs públicas de salvar e enviar atendem os dois modelos
create or replace function public.reporte_salvar(p jsonb) returns jsonb language plpgsql security definer
set search_path=public as $$
declare r reportes; x jsonb; f uuid; g integer; n integer;
begin
 select * into r from reportes where id=(p->>'id')::uuid;
 if found and r.modelo='lider' then return reporte_lider_salvar(p); end if;
 select * into r from reportes where id=(p->>'id')::uuid for update;
 if not found or not reporte_pode(r.frente_id) then return jsonb_build_object('status','sem_permissao'); end if;
 if r.enviado_em is not null or exists(select 1 from reporte_ciclos where id=r.ciclo_id and (fechado or prazo<now()))
 then return jsonb_build_object('status','encerrado'); end if;
 if (p->>'versao')::integer is distinct from r.versao then return jsonb_build_object('status','conflito'); end if;
 if jsonb_typeof(p->'apontamentos') is distinct from 'array' or jsonb_typeof(p->'escalonamentos') is distinct from 'array'
 or jsonb_typeof(p->'feed') is distinct from 'array'
 or (p->>'etapa') is null or (p->>'etapa')::integer not between 1 and 3 then return jsonb_build_object('status','invalido'); end if;
 select grupo_id into g from reporte_frentes where id=r.frente_id;
 for x in select * from jsonb_array_elements(p->'apontamentos') loop
  if not exists(select 1 from membros where registro=(x->>'registro')::integer and status in ('Ativo','Em pausa / avaliação'))
   or not esta_no_grupo(g,(x->>'registro')::integer)
   or coalesce(x->>'assiduidade','') not in ('SUFICIENTE','INSUFICIENTE') or coalesce(x->>'entregas','') not in ('SUFICIENTE','INSUFICIENTE')
   or (coalesce((x->>'sinalizado')::boolean,false) and length(trim(coalesce(x->>'justificativa','')))=0)
   then return jsonb_build_object('status','invalido'); end if;
 end loop;
 if (select count(*)<>count(distinct elemento->>'registro') from jsonb_array_elements(p->'apontamentos') elemento)
 then return jsonb_build_object('status','invalido'); end if;
 for x in select * from jsonb_array_elements(p->'escalonamentos') loop
  if length(trim(coalesce(x->>'texto','')))=0 then return jsonb_build_object('status','invalido'); end if;
  if nullif(x->>'atividade_id','') is not null and not exists(select 1 from atividades a
   where a.id=(x->>'atividade_id')::uuid and public.posso_ver_grupo(a.grupo_id))
   then return jsonb_build_object('status','sem_permissao'); end if;
 end loop;
 for x in select * from jsonb_array_elements(p->'feed') loop
  if length(trim(coalesce(x->>'titulo',''))) not between 1 and 200 or length(trim(coalesce(x->>'subtitulo',''))) not between 1 and 400
   then return jsonb_build_object('status','invalido'); end if;
  if nullif(x->>'imagem_path','') is not null and split_part(x->>'imagem_path','/',1)<>r.id::text
   then return jsonb_build_object('status','invalido'); end if;
 end loop;
 update reportes set apontamentos=p->'apontamentos',escalonamentos=p->'escalonamentos',etapa=(p->>'etapa')::integer,
 versao=versao+1,atualizado_em=now() where id=r.id returning versao into n;
 delete from feed_itens where reporte_id=r.id and publicado_em is null;
 for x in select * from jsonb_array_elements(p->'feed') loop
  insert into feed_itens(reporte_id,autor,titulo,subtitulo,texto,imagem_path) values(r.id,r.autor,
   trim(x->>'titulo'),trim(x->>'subtitulo'),coalesce(x->>'texto',''),nullif(x->>'imagem_path',''));
 end loop;
 return jsonb_build_object('status','ok','versao',n);
end $$;

create or replace function public.reporte_enviar(p_id uuid,p_versao integer) returns jsonb language plpgsql security definer
set search_path=public as $$
declare r reportes; x jsonb; g text;
begin
 select * into r from reportes where id=p_id;
 if found and r.modelo='lider' then return reporte_lider_enviar(p_id,p_versao); end if;
 select * into r from reportes where id=p_id for update;
 if not found or not reporte_pode(r.frente_id) then return jsonb_build_object('status','sem_permissao'); end if;
 if r.enviado_em is not null then return jsonb_build_object('status','ok'); end if;
 if r.versao<>p_versao then return jsonb_build_object('status','conflito'); end if;
 if r.etapa<>3 or exists(select 1 from reporte_ciclos where id=r.ciclo_id and (fechado or prazo<now()))
 then return jsonb_build_object('status','encerrado'); end if;
 if exists(select 1 from membros m join reporte_frentes f on f.id=r.frente_id
 where m.status in ('Ativo','Em pausa / avaliação') and m.registro<>f.responsavel and esta_no_grupo(f.grupo_id,m.registro)
 and not exists(select 1 from jsonb_array_elements(r.apontamentos) a where (a->>'registro')::integer=m.registro))
 then return jsonb_build_object('status','incompleto');end if;
 select g0.nome into g from grupos g0 join reporte_frentes f on f.grupo_id=g0.id where f.id=r.frente_id;
 for x in select * from jsonb_array_elements(r.apontamentos) loop
  if (x->>'sinalizado')::boolean then
   perform atividade_de_origem('reporte',r.id::text||':'||(x->>'registro'),
   'Reporte: '||(select nome from membros where registro=(x->>'registro')::integer),
   g||E'\n'||(x->>'justificativa'),'media',true);
  end if;
 end loop;
 update reportes set enviado_em=now(),versao=versao+1 where id=r.id;
 update feed_itens set publicado_em=now() where reporte_id=r.id and publicado_em is null;
 return jsonb_build_object('status','ok');
end $$;

-- as imagens do feed: o autor do reporte do líder também sobe
create or replace function public.feed_imagem_pode(p_name text,p_escrita boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select conta_ativa() and exists(select 1 from reportes r where r.id::text=split_part(p_name,'/',1)
 and (((case when r.modelo='lider' then r.autor=portal_registro_atual() and reporte_sou_lider() else reporte_pode(r.frente_id) end)
       and r.enviado_em is null)
 or (not p_escrita and exists(select 1 from feed_itens f where f.reporte_id=r.id and f.imagem_path=p_name and f.publicado_em is not null and not f.oculto)))) $$;

-- 6. a cobrança de sexta --------------------------------------------------
create or replace function public.reporte_cobranca_estado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); c reporte_ciclos; v_cid uuid; v_local timestamp := now() at time zone 'America/Sao_Paulo';
  v_aviso timestamptz;
begin
  if not reporte_sou_lider() then return jsonb_build_object('status', 'nenhuma'); end if;
  v_cid := reporte_ciclo_materializar();
  select * into c from reporte_ciclos where id = v_cid;
  if c.modelo <> 'lider' then return jsonb_build_object('status', 'nenhuma'); end if;
  if exists (select 1 from reporte_cobrancas where ciclo_id = c.id and registro = v_reg)
     or exists (select 1 from reportes where ciclo_id = c.id and autor = v_reg and modelo = 'lider' and enviado_em is not null)
    then return jsonb_build_object('status', 'nenhuma', 'motivo', 'resolvida', 'ciclo_id', c.id); end if;
  if ausencia_em(v_reg, c.prazo) then return jsonb_build_object('status', 'nenhuma', 'motivo', 'ausencia', 'ciclo_id', c.id); end if;
  -- o aviso abre às 7h do dia do prazo
  v_aviso := ((c.prazo at time zone 'America/Sao_Paulo')::date + time '07:00') at time zone 'America/Sao_Paulo';
  return jsonb_build_object('status', case when now() >= c.prazo and now() < c.fecha_em then 'obrigatoria'
                                            when now() >= v_aviso and now() < c.prazo then 'aviso' else 'nenhuma' end,
    'ciclo_id', c.id, 'prazo', c.prazo, 'fecha_em', c.fecha_em, 'agora', now(), 'local', v_local);
end $$;

create or replace function public.reporte_ausente(p_ciclo uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); c reporte_ciclos;
begin
  if not reporte_sou_lider() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into c from reporte_ciclos where id = p_ciclo and modelo = 'lider';
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  insert into reporte_cobrancas (ciclo_id, registro, como) values (c.id, v_reg, 'ausente') on conflict do nothing;
  return jsonb_build_object('status', 'ok');
end $$;

-- 7. painel, ficha e consolidado ------------------------------------------
create or replace function public.reporte_lider_painel(p_ciclo uuid default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c reporte_ciclos; v_cid uuid;
begin
  if not reporte_consolidado_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  v_cid := coalesce(p_ciclo, reporte_ciclo_materializar());  -- antes: o ciclo recém-criado não aparece na mesma consulta
  select * into c from reporte_ciclos where id = v_cid;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok', 'ciclo', to_jsonb(c), 'config', (select to_jsonb(x) from reporte_config x where id),
    'lideres', coalesce((select jsonb_agg(jsonb_build_object('registro', m.registro, 'nome', m.nome,
        'reporte_id', r.id, 'enviado_em', r.enviado_em, 'atrasado', coalesce(r.atrasado, false),
        'situacao', case when r.enviado_em is not null then 'enviado' when k.como = 'ausente' then 'ausente'
                         when ausencia_em(m.registro, c.prazo) then 'ferias' else 'pendente' end) order by m.nome)
      from membros m left join reportes r on r.ciclo_id = c.id and r.autor = m.registro and r.modelo = 'lider'
      left join reporte_cobrancas k on k.ciclo_id = c.id and k.registro = m.registro
      where m.registro in (select reporte_lideres())), '[]'));
end $$;

-- o histórico de um membro (para a ficha): liderança, pessoal e admin
create or replace function public.reporte_avaliacoes_de(p_registro integer, p_limite integer default 26)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (conta_ativa() and (papel_atual() in ('admin', 'pessoal') or tenho_papel('lideranca')))
    then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'itens', coalesce((select jsonb_agg(x order by x->>'semana' desc) from (
      select jsonb_build_object('semana', c.semana, 'autor', a.autor, 'autor_nome', m.nome, 'entregas', a.entregas,
               'assiduidade', a.assiduidade, 'origem', a.origem,
               'sinalizado', exists (select 1 from reporte_sinalizacoes s where s.reporte_id = a.reporte_id and s.registro = a.registro)) x
        from membro_reporte_avaliacoes a join reporte_ciclos c on c.id = a.ciclo_id join membros m on m.registro = a.autor
       where a.registro = p_registro order by c.semana desc limit least(greatest(p_limite, 1), 104)) y), '[]')) end $$;

create or replace function public.reporte_unificado(p_ciclo uuid) returns jsonb language plpgsql security definer
set search_path=public as $$
declare c reporte_ciclos;
begin
 select * into c from reporte_ciclos where id=p_ciclo;
 if found and c.modelo='lider' then
  if not reporte_consolidado_pode() then return jsonb_build_object('status','sem_permissao'); end if;
  return jsonb_build_object('status','ok','modelo','lider','gerado_em',now(),'ciclo',to_jsonb(c),
   'cobertura',(select jsonb_build_object('lideres',count(*),
      'enviados',count(*) filter (where x->>'situacao'='enviado'),
      'atrasados',count(*) filter (where (x->>'atrasado')::boolean),
      'ausentes',count(*) filter (where x->>'situacao' in ('ausente','ferias')),
      'pendentes',count(*) filter (where x->>'situacao'='pendente'))
      from jsonb_array_elements(reporte_lider_painel(p_ciclo)->'lideres') x),
   'apontamentos',coalesce((select jsonb_agg(jsonb_build_object('registro',m.registro,'nome',m.nome,'lider',r.autor,'lider_nome',l.nome,
      'entregas',a->>'entregas','assiduidade',a->>'assiduidade','sinalizado',jsonb_typeof(a->'sinalizacao')='object',
      'relato',a->'sinalizacao'->>'relato') order by m.nome)
      from reportes r cross join lateral jsonb_array_elements(r.apontamentos) a
      join membros m on m.registro=(a->>'registro')::integer join membros l on l.registro=r.autor
      where r.ciclo_id=p_ciclo and r.modelo='lider' and r.enviado_em is not null
        and (a->>'entregas'='INSUFICIENTE' or a->>'assiduidade'='INSUFICIENTE' or jsonb_typeof(a->'sinalizacao')='object')),'[]'),
   'escalonamentos',coalesce((select jsonb_agg(jsonb_build_object('lider_nome',l.nome,'texto',e->>'texto',
      'atividade_codigo',t.codigo,'atividade_titulo',t.titulo,'responsavel_nome',rm.nome) order by l.nome)
      from reportes r cross join lateral jsonb_array_elements(r.escalonamentos) e join membros l on l.registro=r.autor
      left join atividades t on t.id=nullif(e->>'atividade_id','')::uuid left join membros rm on rm.registro=t.responsavel
      where r.ciclo_id=p_ciclo and r.modelo='lider' and r.enviado_em is not null),'[]'),
   'atrasados',coalesce((select jsonb_agg(jsonb_build_object('codigo',a.codigo,'titulo',a.titulo,'responsavel_nome',m.nome,
      'prazo',a.prazo,'dias',(current_date-a.prazo),'status',a.status) order by a.prazo)
      from atividades a left join membros m on m.registro=a.responsavel
      where not a.arquivada and a.status<>'concluida' and a.prazo<current_date),'[]'),
   'feed',coalesce((select jsonb_agg(jsonb_build_object('titulo',f.titulo,'subtitulo',f.subtitulo,'autor',m.nome,
      'publicado_em',f.publicado_em) order by f.publicado_em)
      from feed_itens f join reportes r on r.id=f.reporte_id join membros m on m.registro=f.autor
      where r.ciclo_id=p_ciclo and not f.oculto),'[]'));
 end if;
 if papel_atual()<>'admin' then return jsonb_build_object('status','sem_permissao'); end if;
 return jsonb_build_object('status','ok','modelo','frente','painel',reporte_painel(p_ciclo),
 'reportes',coalesce((select jsonb_agg(to_jsonb(r)) from reportes r where ciclo_id=p_ciclo),'[]'),
 'atrasados',coalesce((select jsonb_agg(to_jsonb(a)) from atividades a where not arquivada and status<>'concluida' and prazo<current_date),'[]'),
 'replanejados',coalesce((select jsonb_agg(to_jsonb(a)) from atividades a where not arquivada and
 (select count(*) from atividade_log l where l.atividade_id=a.id and l.tipo='prazo' and l.de is not null)>2),'[]'),
 'ocorrencias',coalesce((select jsonb_agg(to_jsonb(o)) from ocorrencias o join reporte_ciclos c on c.id=p_ciclo
 where o.data between c.semana and c.semana+6),'[]'));
end $$;

-- a data de ativação também se ajusta pela configuração
create or replace function public.reporte_configurar(p jsonb) returns jsonb language plpgsql security definer
set search_path=public as $$
begin
 if not (conta_ativa() and papel_atual()='admin') then return jsonb_build_object('status','sem_permissao'); end if;
 if p is null or (p->>'dia_prazo') is null or (p->>'hora_prazo') is null or (p->>'dia_reuniao') is null or (p->>'hora_reuniao') is null
 or (p->>'dia_prazo')::integer not between 0 and 6 or (p->>'dia_reuniao')::integer not between 0 and 6
 then return jsonb_build_object('status','invalido'); end if;
 update reporte_config set dia_prazo=(p->>'dia_prazo')::integer,hora_prazo=(p->>'hora_prazo')::time,
 dia_reuniao=(p->>'dia_reuniao')::integer,hora_reuniao=(p->>'hora_reuniao')::time,
 modelo_lider_desde=coalesce(date_trunc('week',(p->>'modelo_lider_desde')::date)::date,modelo_lider_desde) where id;
 return jsonb_build_object('status','ok');
end $$;

-- 8. permissões ------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['grupo_por_nome(text)', 'reporte_lideres()', 'reporte_liderados(integer)', 'ausencia_em(integer,timestamptz)',
                           'reporte_pessoa_json(integer,text,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['reporte_sou_lider()', 'reporte_consolidado_pode()', 'reporte_meu(uuid)',
                           'reporte_cadeia_atualizar(uuid,integer)', 'reporte_participante(uuid,integer,integer,text,boolean)',
                           'reporte_cobranca_estado()', 'reporte_ausente(uuid)', 'reporte_lider_painel(uuid)',
                           'reporte_avaliacoes_de(integer,integer)', 'reporte_salvar(jsonb)', 'reporte_enviar(uuid,integer)',
                           'reporte_unificado(uuid)', 'reporte_configurar(jsonb)', 'feed_imagem_pode(text,boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;

-- os grupos que as sinalizações usam: avisa o que falta (não cria)
do $$ declare n text; begin
  foreach n in array array['NRO_PMO', 'NRO_PESSOAL', 'NRO_COORD_OFFICE', 'NRO_MANAGERS'] loop
    if public.grupo_por_nome(n) is null then
      raise notice 'Reporte 2.19.1: não achei o grupo %. As sinalizações que dependem dele ficam registradas sem cartão até ele existir.', n;
    end if;
  end loop;
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_reporte',
 'SOMA 2.19.1: reporte por liderança direta (um por líder e semana), cobrança de sexta 16h, sinalizações com PMO e offboarding, avaliações na ficha')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select modelo_lider_desde, dia_prazo, hora_prazo from public.reporte_config;
-- select semana, modelo, prazo, fecha_em from public.reporte_ciclos order by semana desc limit 3;
