-- ============================================================
-- SOMA 2.30.0, MIGRAÇÃO, NeuroDynamics
-- O NEUROQUIZ NO RITMO DA FESTA: ORDEM ALEATÓRIA, 8 SEGUNDOS E O
-- AVANÇO SOZINHO.
--
--   1. O TEMPO PADRÃO DE UMA PERGUNTA É 8 s (era 20). Vale para a
--      pergunta nova e para a importada; as que estavam com os 20 s
--      antigos passam a 8. As de outro tempo ficam como estão. As
--      partidas já jogadas não mudam.
--   2. ORDEM ALEATÓRIA. Cada partida nova embaralha as perguntas ativas
--      (quiz_sessoes.aleatoria, padrão sim). Desligada, vale a ordem
--      do editor.
--   3. O AVANÇO SOZINHO. Na revelação e no placar, a TV passa para o
--      próximo passo depois de quiz_sessoes.intervalo_s segundos
--      (padrão 5; 0 é só no espaço). Quando todos respondem, a
--      revelação já vinha na hora; agora, 5 s depois, vem a próxima
--      pergunta (ou o placar, ou o pódio). O espaço avança antes; a
--      tecla P pausa. quiz_tv devolve o intervalo e mudou_em, a hora
--      do banco em que a fase começou: a TV que recarrega continua a
--      contagem de onde estava.
--
-- Pré-requisito: a 2.29.0. Idempotente. Troca três funções
-- (quiz__gravar, quiz_sessao_criar, quiz_tv) com a mesma assinatura:
-- as permissões continuam as da 2.29.0.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.quiz_sessoes') is null or to_regprocedure('public.quiz__gravar(jsonb,integer)') is null then
    raise exception using message = 'Falta aplicar a 2.29.0 (o NeuroQuiz) antes desta migração.';
  end if;
end $$;

-- 1. o tempo padrão
alter table public.quiz_perguntas alter column tempo_s set default 8;
do $$
declare n integer;
begin
  if not exists (select 1 from public.migracoes where id = '2.30.0_neuroquiz_ritmo') then
    update public.quiz_perguntas set tempo_s = 8, atualizado_em = now() where tempo_s = 20;
    get diagnostics n = row_count;
    raise notice 'NeuroQuiz: % perguntas passaram de 20 s para 8 s.', n;
  end if;
end $$;

-- 2 e 3. a partida: a ordem e o intervalo
alter table public.quiz_sessoes add column if not exists aleatoria boolean not null default true;
alter table public.quiz_sessoes add column if not exists intervalo_s integer not null default 5;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'quiz_sessoes_intervalo_s_check') then
    alter table public.quiz_sessoes add constraint quiz_sessoes_intervalo_s_check check (intervalo_s between 0 and 60);
  end if;
end $$;
comment on column public.quiz_sessoes.aleatoria is 'NeuroQuiz (2.30.0): a partida embaralhou as perguntas ativas ao nascer; falso, a ordem do editor.';
comment on column public.quiz_sessoes.intervalo_s is 'NeuroQuiz (2.30.0): segundos da revelação e do placar até a TV avançar sozinha; 0, só no espaço.';

-- as funções, da 2.29.0, com as mudanças acima
create or replace function public.quiz__gravar(p jsonb, p_reg integer)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id uuid := nullif(p->>'id', '')::uuid;
  v_tipo text := coalesce(nullif(p->>'tipo', ''), 'classica');
  v_alts jsonb := coalesce(p->'alternativas', '[]'::jsonb);
  v_ausentes integer[] := '{}';
  v_autor integer := nullif(p->>'autor_registro', '')::integer;
  v_problemas text[];
  v_ativa boolean;
  a jsonb; i integer := 0; v_reg integer;
begin
  if v_tipo not in ('classica','quem','whatsapp') then
    return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if length(btrim(coalesce(p->>'texto', ''))) not between 1 and 300 then
    return jsonb_build_object('status', 'invalido', 'campo', 'texto'); end if;
  if jsonb_typeof(v_alts) <> 'array' or jsonb_array_length(v_alts) > 4 then
    return jsonb_build_object('status', 'invalido', 'campo', 'alternativas'); end if;
  if coalesce((p->>'tempo_s')::integer, 8) not between 5 and 240 then
    return jsonb_build_object('status', 'invalido', 'campo', 'tempo_s'); end if;
  if coalesce((p->>'pontos')::integer, 1000) not in (0, 1000, 2000) then
    return jsonb_build_object('status', 'invalido', 'campo', 'pontos'); end if;
  for a in select * from jsonb_array_elements(v_alts) loop
    if length(coalesce(a->>'texto', '')) > 120 then
      return jsonb_build_object('status', 'invalido', 'campo', 'alternativas'); end if;
  end loop;
  if v_autor is not null and not exists (select 1 from membros where registro = v_autor) then
    v_ausentes := v_ausentes || v_autor; v_autor := null;
  end if;

  if v_id is null or not exists (select 1 from quiz_perguntas where id = v_id) then
    insert into quiz_perguntas (id, ordem, tipo, texto, criado_por, atualizado_por)
    values (coalesce(v_id, gen_random_uuid()),
            coalesce((p->>'ordem')::integer, (select coalesce(max(ordem), 0) + 1 from quiz_perguntas)),
            v_tipo, btrim(p->>'texto'), p_reg, p_reg)
    returning id into v_id;
  end if;
  update quiz_perguntas set
    tipo = v_tipo, texto = btrim(p->>'texto'),
    autor_registro = case when v_tipo = 'whatsapp' then v_autor end,
    autor_rotulo = case when v_tipo = 'whatsapp' then nullif(btrim(coalesce(p->>'autor_rotulo', '')), '') end,
    mensagem = case when v_tipo = 'whatsapp' then nullif(btrim(coalesce(p->>'mensagem', '')), '') end,
    extra = case when jsonb_typeof(p->'extra') = 'object' then p->'extra' else '{}'::jsonb end,
    tempo_s = coalesce((p->>'tempo_s')::integer, 8),
    pontos = coalesce((p->>'pontos')::integer, 1000),
    nota = nullif(btrim(coalesce(p->>'nota', '')), ''),
    origem = coalesce(nullif(p->>'origem', ''), origem),
    ordem = coalesce((p->>'ordem')::integer, ordem),
    atualizado_por = p_reg, atualizado_em = now()
   where id = v_id;

  delete from quiz_alternativas where pergunta_id = v_id;
  for a in select * from jsonb_array_elements(v_alts) loop
    v_reg := nullif(a->>'registro', '')::integer;
    if v_reg is not null and not exists (select 1 from membros where registro = v_reg) then
      v_ausentes := v_ausentes || v_reg; v_reg := null;
    end if;
    insert into quiz_alternativas (pergunta_id, letra, texto, registro, correta)
    values (v_id, i, nullif(btrim(coalesce(a->>'texto', '')), ''),
            case when v_tipo = 'quem' then v_reg end, coalesce((a->>'correta')::boolean, false));
    i := i + 1;
  end loop;

  v_problemas := public.quiz__problemas(v_id);
  v_ativa := coalesce((p->>'ativa')::boolean, true) and not public.quiz__bloqueia(v_problemas);
  update quiz_perguntas set ativa = v_ativa where id = v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id, 'ativa', v_ativa, 'problemas', to_jsonb(v_problemas),
                            'membros_inexistentes', to_jsonb(v_ausentes));
end $$;

create or replace function public.quiz_sessao_criar(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_pin text; v_total integer; v_reg integer := public.portal_registro_atual();
        v_tentativa integer := 0; v_aleatoria boolean := coalesce((p->>'aleatoria')::boolean, true);
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if coalesce((p->>'leitura_s')::integer, 5) not between 0 and 15 then
    return jsonb_build_object('status', 'invalido', 'campo', 'leitura_s'); end if;
  if coalesce((p->>'placar_cada')::integer, 1) not between 0 and 50 then
    return jsonb_build_object('status', 'invalido', 'campo', 'placar_cada'); end if;
  if coalesce((p->>'intervalo_s')::integer, 5) not between 0 and 60 then
    return jsonb_build_object('status', 'invalido', 'campo', 'intervalo_s'); end if;
  if length(btrim(coalesce(p->>'titulo', 'NeuroQuiz'))) not between 1 and 80 then
    return jsonb_build_object('status', 'invalido', 'campo', 'titulo'); end if;
  if not exists (select 1 from quiz_perguntas where ativa) then
    return jsonb_build_object('status', 'sem_perguntas'); end if;
  loop
    v_pin := lpad((100000 + floor(random() * 900000))::integer::text, 6, '0');
    exit when not exists (select 1 from quiz_sessoes where pin = v_pin and fase <> 'fim');
    v_tentativa := v_tentativa + 1;
    if v_tentativa > 50 then raise exception 'NeuroQuiz: não achei um PIN livre.'; end if;
  end loop;
  insert into quiz_sessoes (id, pin, titulo, leitura_s, placar_cada, bonus_sequencia, texto_no_celular, criada_por, criada_por_nome,
                            aleatoria, intervalo_s)
  values (v_id, v_pin, btrim(coalesce(p->>'titulo', 'NeuroQuiz')), coalesce((p->>'leitura_s')::integer, 5),
          coalesce((p->>'placar_cada')::integer, 1), coalesce((p->>'bonus_sequencia')::boolean, true),
          coalesce((p->>'texto_no_celular')::boolean, false), v_reg,
          (select nome from membros where registro = v_reg),
          v_aleatoria, coalesce((p->>'intervalo_s')::integer, 5));
  insert into quiz_rodadas (sessao_id, ordem, pergunta_id, conteudo, corretas, n_alt, tempo_s, pontos)
  select v_id, row_number() over (order by case when v_aleatoria then random() end, q.ordem, q.criado_em), q.id, f.f,
         array(select (a->>'letra')::smallint from jsonb_array_elements(f.f->'alternativas') a where (a->>'correta')::boolean),
         jsonb_array_length(f.f->'alternativas'), q.tempo_s, q.pontos
    from quiz_perguntas q cross join lateral (select public.quiz__fotografia(q.id) f) f
   where q.ativa and not public.quiz__bloqueia(public.quiz__problemas(q.id));
  get diagnostics v_total = row_count;
  update quiz_sessoes set total = v_total where id = v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id, 'pin', v_pin, 'total', v_total);
end $$;

create or replace function public.quiz_tv(p_sessao uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes; r quiz_rodadas; v jsonb; v_perg jsonb;
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  perform public.quiz__revelar(p_sessao, true);
  select * into s from quiz_sessoes where id = p_sessao;
  if not found then return jsonb_build_object('status', 'inexistente'); end if;
  select * into r from quiz_rodadas where sessao_id = p_sessao and ordem = s.rodada;
  v := jsonb_build_object('status', 'ok', 'agora', clock_timestamp(),
    'sessao', jsonb_build_object('id', s.id, 'pin', s.pin, 'titulo', s.titulo, 'fase', s.fase, 'seq', s.seq,
              'rodada', s.rodada, 'total', s.total, 'iniciada_em', s.iniciada_em, 'prazo', s.prazo,
              'liberada_em', r.liberada_em, 'leitura_s', s.leitura_s, 'placar_cada', s.placar_cada,
              'bonus_sequencia', s.bonus_sequencia, 'texto_no_celular', s.texto_no_celular,
              'aleatoria', s.aleatoria, 'intervalo_s', s.intervalo_s, 'mudou_em', s.mudou_em),
    'jogadores_n', (select count(*) from quiz_jogadores where sessao_id = p_sessao),
    'ativos_n', (select count(*) from quiz_jogadores where sessao_id = p_sessao and visto_em > clock_timestamp() - interval '90 seconds'));
  if s.fase = 'lobby' then
    v := v || jsonb_build_object('jogadores', coalesce((select jsonb_agg(jsonb_build_object('registro', registro, 'curto', curto,
            'foto_url', foto_url) order by entrou_em) from quiz_jogadores where sessao_id = p_sessao), '[]'::jsonb));
  end if;
  if s.fase in ('pergunta', 'revelacao') then
    v_perg := r.conteudo;
    if s.fase = 'pergunta' then
      v_perg := jsonb_set(v_perg, '{alternativas}', coalesce((select jsonb_agg(a - 'correta' order by (a->>'letra')::int)
                  from jsonb_array_elements(v_perg->'alternativas') a), '[]'::jsonb));
    end if;
    v := v || jsonb_build_object('pergunta', v_perg || jsonb_build_object('ordem', r.ordem, 'n_alt', r.n_alt),
           'respostas_n', (select count(*) from quiz_respostas where sessao_id = p_sessao and ordem = s.rodada));
  end if;
  if s.fase = 'revelacao' then
    v := v || jsonb_build_object('corretas', to_jsonb(r.corretas), 'contagem', to_jsonb(r.contagem));
  end if;
  if s.fase in ('revelacao', 'placar', 'fim') then
    v := v || jsonb_build_object('placar', coalesce((select jsonb_agg(jsonb_build_object('registro', registro, 'curto', curto,
            'nome', nome, 'foto_url', foto_url, 'pontos', pontos, 'acertos', acertos, 'posicao', posicao,
            'posicao_anterior', posicao_anterior, 'sequencia', sequencia) order by posicao)
          from quiz_jogadores where sessao_id = p_sessao and posicao <= case when s.fase = 'fim' then 10 else 5 end), '[]'::jsonb));
  end if;
  return v;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.30.0_neuroquiz_ritmo', 'NeuroQuiz no ritmo da festa: tempo padrão de 8 s (as perguntas com 20 s passam a 8), ordem aleatória por partida (quiz_sessoes.aleatoria) e o avanço sozinho da TV na revelação e no placar (quiz_sessoes.intervalo_s, padrão 5 s)')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from public.quiz_perguntas where tempo_s = 8) as "perguntas com 8 s",
       (select count(*) from public.quiz_perguntas where tempo_s <> 8) as "com outro tempo",
       (select column_default from information_schema.columns where table_name = 'quiz_sessoes' and column_name = 'intervalo_s') as "intervalo padrão (s)";

-- ============================================================
-- FIM, SOMA 2.30.0
-- Depois de rodar, crie uma partida nova no editor: a ordem aleatória e
-- o avanço sozinho valem para as partidas criadas daqui em diante.
-- ============================================================
