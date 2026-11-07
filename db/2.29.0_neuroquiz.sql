-- ============================================================
-- SOMA 2.29.0, MIGRAÇÃO, NeuroDynamics
-- O NEUROQUIZ: O QUIZ DA EQUIPE, AO VIVO, NA TV E NO CELULAR.
--
-- Uma página fora dos menus (membro.neurodynamics.dev/quiz/), só para
-- quem entra com a conta do SOMA. Três telas:
--   o EDITOR, da gestão: as perguntas, a importação do docx e a revisão;
--   a TV, da gestão: o lobby com o PIN e o QR, a pergunta, a revelação,
--     o placar e o pódio, no ritmo de quem conduz;
--   o CELULAR, de quem joga: entra com o nome e a foto do SOMA e
--     responde com quatro botões.
--
--   1. quiz_perguntas e quiz_alternativas: o banco de perguntas. Tipo
--      clássica, quem é quem (as alternativas são membros, pelo
--      registro) ou mensagem de WhatsApp (o autor, pelo registro, e a
--      mensagem cortada no "…"). Mais de uma alternativa correta vale
--      em qualquer tipo. Pergunta com problema que impede o jogo (sem
--      correta, sem membro, com marcador [membro 30] no texto...) fica
--      desativada até ser corrigida.
--   2. quiz_sessoes: uma partida, com o PIN de seis dígitos, a fase
--      (lobby, pergunta, revelacao, placar, fim), a rodada e o seq, que
--      sobe a cada passo: o comando da TV leva o seq que viu, e um
--      segundo toque no espaço (ou uma segunda TV) não pula pergunta.
--   3. quiz_rodadas: as perguntas da partida, na ordem, com a
--      fotografia de cada uma tirada ao abrir (editar depois não muda o
--      que já foi jogado), quando foi liberada, quando abriu para
--      respostas, o prazo e a contagem por alternativa.
--   4. quiz_jogadores: quem entrou, pela conta (auth.uid), com o nome
--      e a foto do SOMA, os pontos, os acertos, a sequência e a posição.
--      Recarregar ou perder a rede não tira ninguém: a linha fica.
--   5. quiz_respostas: uma por jogador e rodada (a chave primária), com
--      a hora de chegada no relógio do banco.
--
--   O TEMPO É DO BANCO. Ao liberar a pergunta, a rodada grava
--   liberada_em = clock_timestamp() e abre para respostas em
--   iniciada_em = liberada_em + leitura_s (a leitura da pergunta antes
--   das alternativas; 5 s por padrão, 0 desliga). prazo = iniciada_em +
--   tempo da pergunta. quiz_responder grava a chegada com
--   clock_timestamp(), recusa antes de iniciada_em e depois de prazo +
--   0,5 s (a tolerância cobre o envio pela rede; quem chega nela ganha
--   como se tivesse respondido no prazo) e aceita uma só por jogador.
--
--   OS PONTOS, como no jogo de referência: errar ou não responder, 0.
--   Acertar: até 0,5 s, todos os pontos da pergunta; depois,
--   pontos × (1 − (tempo ÷ limite) ÷ 2), arredondado. A pergunta vale
--   1000 (padrão), 2000 (dobro) ou 0 (sem pontos). Bônus de sequência
--   (liga e desliga na partida): do segundo acerto seguido em diante,
--   +100 por acerto anterior da sequência, até +500.
--
--   O TEMPO REAL. Cada passo avisa o canal de broadcast do Supabase
--   Realtime "neuroquiz:<sessão>" com o seq, a fase, a rodada, os
--   horários e, na revelação, as letras certas. Nada de texto, nome ou
--   foto passa pelo canal: quem ouve consulta pelas funções, com as
--   regras de acesso. A TV ouve também "neuroquiz:<sessão>:tv", com a
--   contagem de respostas e de jogadores. Sem o Realtime, as telas
--   consultam a cada poucos segundos.
--
--   QUEM PODE. Editar perguntas e conduzir partidas é da gestão:
--   eh_gestao() (admin, Depto. de Pessoal e liderança, a mesma lista
--   que escreve em OKRs, avisos, documentos, treinamentos...). Jogar é
--   de toda conta ativa (conta_ativa): membro Desligado, Egresso ou Sob
--   demanda, a conta do quiosque e a do LABBIO não jogam. As tabelas
--   têm RLS: só a gestão lê, ninguém escreve; tudo passa pelas funções,
--   que conferem de novo. O jogador nunca recebe a alternativa certa
--   antes da revelação.
--
-- Pré-requisito: a 2.18.0 (conta_ativa, eh_gestao,
-- portal_registro_atual, conta_ativa_travar). Não toca em membros,
-- perfis nem em nenhuma permissão que já existe. Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois publique
-- o portal.
-- ============================================================

do $$
begin
  if to_regprocedure('public.conta_ativa()') is null or to_regprocedure('public.eh_gestao()') is null
     or to_regprocedure('public.portal_registro_atual()') is null or to_regprocedure('public.status_bloqueado(text)') is null then
    raise exception using message = 'Falta aplicar a 2.18.0 antes desta migração.',
      detail = 'Quem joga é a conta ativa (conta_ativa) e quem conduz é a gestão (eh_gestao).';
  end if;
end $$;

-- ============================================================
-- 1. AS PERGUNTAS
-- ------------------------------------------------------------
create table if not exists public.quiz_perguntas (
  id             uuid primary key default gen_random_uuid(),
  ordem          integer not null default 0,
  ativa          boolean not null default true,
  tipo           text not null default 'classica' check (tipo in ('classica','quem','whatsapp')),
  texto          text not null check (length(btrim(texto)) between 1 and 300),
  autor_registro integer references public.membros(registro) on delete set null,
  autor_rotulo   text check (autor_rotulo is null or length(btrim(autor_rotulo)) between 1 and 60),
  mensagem       text check (mensagem is null or length(mensagem) <= 300),
  extra          jsonb not null default '{}'::jsonb,
  tempo_s        integer not null default 20 check (tempo_s between 5 and 240),
  pontos         integer not null default 1000 check (pontos in (0, 1000, 2000)),
  nota           text check (nota is null or length(nota) <= 300),
  origem         text,
  criado_por     integer,
  criado_em      timestamptz not null default now(),
  atualizado_por integer,
  atualizado_em  timestamptz not null default now()
);
comment on table public.quiz_perguntas is
  'NeuroQuiz (2.29.0): o banco de perguntas. tipo classica, quem (alternativas são membros) ou whatsapp (autor_registro e '
  'mensagem cortada no "…"; extra.grupo e extra.hora opcionais). nota é a observação de quem conduz, só na TV. '
  'origem diz de onde veio (docx:30). Escrita só pelas funções quiz_pergunta_*, quiz_importar.';
create index if not exists quiz_perguntas_ordem on public.quiz_perguntas (ordem, criado_em);

create table if not exists public.quiz_alternativas (
  pergunta_id uuid not null references public.quiz_perguntas(id) on delete cascade,
  letra       smallint not null check (letra between 0 and 3),
  texto       text check (texto is null or length(texto) <= 120),
  registro    integer references public.membros(registro) on delete set null,
  correta     boolean not null default false,
  primary key (pergunta_id, letra)
);
comment on table public.quiz_alternativas is
  'NeuroQuiz: de 2 a 4 alternativas por pergunta (letra 0 a 3: A a D). No tipo quem, registro é o membro e texto, '
  'se houver, troca o nome mostrado. Mais de uma correta vale.';

-- ============================================================
-- 2. AS PARTIDAS
-- ------------------------------------------------------------
create table if not exists public.quiz_sessoes (
  id               uuid primary key default gen_random_uuid(),
  pin              text not null check (pin ~ '^[0-9]{6}$'),
  titulo           text not null default 'NeuroQuiz' check (length(btrim(titulo)) between 1 and 80),
  fase             text not null default 'lobby' check (fase in ('lobby','pergunta','revelacao','placar','fim')),
  rodada           integer not null default 0,
  total            integer not null default 0,
  seq              integer not null default 0,
  iniciada_em      timestamptz,
  prazo            timestamptz,
  leitura_s        integer not null default 5 check (leitura_s between 0 and 15),
  placar_cada      integer not null default 1 check (placar_cada between 0 and 50),
  bonus_sequencia  boolean not null default true,
  texto_no_celular boolean not null default false,
  criada_por       integer,
  criada_por_nome  text,
  criada_em        timestamptz not null default now(),
  mudou_em         timestamptz not null default now(),
  encerrada_em     timestamptz
);
comment on table public.quiz_sessoes is
  'NeuroQuiz: uma partida. fase lobby → pergunta → revelacao → (placar) → pergunta ... → fim. seq sobe a cada passo; '
  'quiz_avancar só anda com o seq que a TV viu. iniciada_em e prazo são os da rodada atual, no relógio do banco. '
  'placar_cada: o placar parcial a cada N perguntas (0: só o pódio). texto_no_celular: o celular mostra também '
  'a pergunta e as alternativas, além das formas.';
create unique index if not exists quiz_sessoes_pin_aberta on public.quiz_sessoes (pin) where fase <> 'fim';

create table if not exists public.quiz_rodadas (
  sessao_id    uuid not null references public.quiz_sessoes(id) on delete cascade,
  ordem        integer not null check (ordem >= 1),
  pergunta_id  uuid references public.quiz_perguntas(id) on delete set null,
  conteudo     jsonb not null,
  corretas     smallint[] not null default '{}',
  n_alt        integer not null default 4,
  tempo_s      integer not null default 20,
  pontos       integer not null default 1000,
  liberada_em  timestamptz,
  iniciada_em  timestamptz,
  prazo        timestamptz,
  encerrada_em timestamptz,
  contagem     integer[],
  primary key (sessao_id, ordem)
);
comment on table public.quiz_rodadas is
  'NeuroQuiz: as perguntas de uma partida, na ordem. conteudo é a fotografia da pergunta (com a correta), tirada ao '
  'criar a partida e de novo ao liberar a rodada. liberada_em: o host liberou; iniciada_em: abriu para respostas '
  '(liberada_em + leitura_s); prazo: iniciada_em + tempo_s. contagem: respostas por letra, na revelação.';

create table if not exists public.quiz_jogadores (
  sessao_id        uuid not null references public.quiz_sessoes(id) on delete cascade,
  uid              uuid not null,
  registro         integer references public.membros(registro) on delete set null,
  nome             text not null,
  curto            text not null,
  foto_url         text,
  entrou_em        timestamptz not null default clock_timestamp(),
  visto_em         timestamptz not null default clock_timestamp(),
  pontos           integer not null default 0,
  acertos          integer not null default 0,
  sequencia        integer not null default 0,
  tempo_ms         bigint not null default 0,
  posicao          integer,
  posicao_anterior integer,
  primary key (sessao_id, uid)
);
comment on table public.quiz_jogadores is
  'NeuroQuiz: quem entrou numa partida, pela conta. nome, curto e foto_url vêm do SOMA ao entrar. pontos, acertos, '
  'sequencia (acertos seguidos), tempo_ms (soma do tempo dos acertos, para desempate) e posicao mudam na revelação.';

create table if not exists public.quiz_respostas (
  sessao_id   uuid not null,
  ordem       integer not null,
  uid         uuid not null,
  letra       smallint not null check (letra between 0 and 3),
  recebida_em timestamptz not null default clock_timestamp(),
  tempo_ms    integer not null check (tempo_ms >= 0),
  correta     boolean not null,
  pontos      integer not null default 0,
  bonus       integer not null default 0,
  primary key (sessao_id, ordem, uid),
  foreign key (sessao_id, ordem) references public.quiz_rodadas(sessao_id, ordem) on delete cascade,
  foreign key (sessao_id, uid) references public.quiz_jogadores(sessao_id, uid) on delete cascade
);
comment on table public.quiz_respostas is
  'NeuroQuiz: uma resposta por jogador e rodada (a chave primária garante). recebida_em é a chegada no relógio do '
  'banco; tempo_ms, desde iniciada_em. pontos e bonus já calculados; só contam na revelação.';

-- RLS ligada já: sem política, ninguém lê nem escreve. A política de
-- leitura da gestão entra no fim (seção 9), depois de quiz_pode_gerir.
do $$
declare t text;
begin
  foreach t in array array['quiz_perguntas','quiz_alternativas','quiz_sessoes','quiz_rodadas','quiz_jogadores','quiz_respostas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    execute format('revoke all on table public.%I from authenticated', t);
  end loop;
end $$;

-- ============================================================
-- 3. QUEM PODE, E OS MEMBROS
-- ------------------------------------------------------------
create or replace function public.quiz_pode_gerir()
returns boolean language sql stable security definer
set search_path = public as $$
  select auth.uid() is not null and public.conta_ativa() and public.eh_gestao();
$$;
comment on function public.quiz_pode_gerir() is
  'NeuroQuiz: edita perguntas e conduz partidas quem é da gestão (eh_gestao: admin, Depto. de Pessoal, liderança), com conta ativa.';

create or replace function public.quiz_pode_jogar()
returns boolean language sql stable security definer
set search_path = public as $$
  select auth.uid() is not null and public.conta_ativa() and exists (select 1 from perfis where id = auth.uid());
$$;

-- O nome curto: o primeiro nome; se outro membro ativo tem o mesmo,
-- o primeiro e o último.
create or replace function public.quiz_curto(p_nome text, p_registro integer)
returns text language plpgsql stable security definer
set search_path = public as $$
declare v text[] := regexp_split_to_array(btrim(coalesce(p_nome, '')), '\s+');
begin
  if coalesce(array_length(v, 1), 0) = 0 or v[1] = '' then return '?'; end if;
  if array_length(v, 1) = 1 then return v[1]; end if;
  if exists (select 1 from membros m
              where m.registro is distinct from p_registro and not public.status_bloqueado(m.status)
                and split_part(btrim(m.nome), ' ', 1) = v[1]) then
    return v[1] || ' ' || v[array_length(v, 1)];
  end if;
  return v[1];
end $$;

create or replace function public.quiz_membro(p_registro integer)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object('registro', m.registro, 'nome', m.nome, 'curto', public.quiz_curto(m.nome, m.registro),
                            'foto_url', nullif(btrim(coalesce(m.foto_url, '')), ''), 'status', m.status,
                            'ativo', not public.status_bloqueado(m.status))
    from membros m where m.registro = p_registro;
$$;

-- Todos os membros, para o editor escolher e para a importação resolver
-- os registros (com o status: a importação avisa de quem saiu).
create or replace function public.quiz_membros()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'membros', coalesce((
    select jsonb_agg(public.quiz_membro(m.registro) order by m.nome) from membros m), '[]'::jsonb));
end $$;

create or replace function public.quiz_relogio()
returns jsonb language sql volatile security definer
set search_path = public as $$
  select jsonb_build_object('agora', clock_timestamp());
$$;

-- ============================================================
-- 4. OS PROBLEMAS DE UMA PERGUNTA
--    Os que impedem o jogo (a pergunta fica desativada):
--      sem_alternativas, sem_correta, alternativa_vazia,
--      quem_sem_membro, whatsapp_sem_autor, whatsapp_sem_mensagem,
--      marcador_no_texto ([membro 30], [apelido]... sobrou no texto).
--    Os que só avisam: membro_inativo, alternativas_iguais.
-- ------------------------------------------------------------
create or replace function public.quiz__bloqueia(p_problemas text[])
returns boolean language sql immutable as $$
  select exists (select 1 from unnest(coalesce(p_problemas, '{}')) p
                  where p in ('sem_alternativas','sem_correta','alternativa_vazia','quem_sem_membro',
                              'whatsapp_sem_autor','whatsapp_sem_mensagem','marcador_no_texto'));
$$;

create or replace function public.quiz__problemas(p_id uuid)
returns text[] language plpgsql stable security definer
set search_path = public as $$
declare q quiz_perguntas; v text[] := '{}'; n integer; v_marca text := '\[(membro|primeiro nome|apelido|nome completo)[^\]]*\]';
begin
  select * into q from quiz_perguntas where id = p_id;
  if not found then return array['inexistente']; end if;
  select count(*) into n from quiz_alternativas where pergunta_id = p_id;
  if n < 2 then v := v || 'sem_alternativas'::text; end if;
  if n > 0 and not exists (select 1 from quiz_alternativas where pergunta_id = p_id and correta) then
    v := v || 'sem_correta'::text; end if;
  if q.tipo = 'quem' then
    if exists (select 1 from quiz_alternativas where pergunta_id = p_id and registro is null) then
      v := v || 'quem_sem_membro'::text; end if;
  elsif exists (select 1 from quiz_alternativas where pergunta_id = p_id and length(btrim(coalesce(texto, ''))) = 0) then
    v := v || 'alternativa_vazia'::text;
  end if;
  if q.tipo = 'whatsapp' then
    if q.autor_registro is null then v := v || 'whatsapp_sem_autor'::text; end if;
    if length(btrim(coalesce(q.mensagem, ''))) = 0 then v := v || 'whatsapp_sem_mensagem'::text; end if;
  end if;
  if q.texto ~* v_marca or coalesce(q.mensagem, '') ~* v_marca
     or exists (select 1 from quiz_alternativas where pergunta_id = p_id and coalesce(texto, '') ~* v_marca) then
    v := v || 'marcador_no_texto'::text;
  end if;
  if exists (select 1 from membros m where public.status_bloqueado(m.status)
               and (m.registro = q.autor_registro
                    or m.registro in (select registro from quiz_alternativas where pergunta_id = p_id))) then
    v := v || 'membro_inativo'::text;
  end if;
  if n > 1 and (select count(distinct coalesce(registro::text, lower(btrim(texto)))) from quiz_alternativas where pergunta_id = p_id) < n then
    v := v || 'alternativas_iguais'::text;
  end if;
  return v;
end $$;

-- A pergunta como o jogo a usa (com a correta: só sai para a gestão).
create or replace function public.quiz__fotografia(p_id uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'id', q.id, 'tipo', q.tipo, 'texto', q.texto, 'tempo_s', q.tempo_s, 'pontos', q.pontos, 'nota', q.nota,
    'mensagem', q.mensagem, 'extra', q.extra,
    'autor', case when q.autor_registro is not null then
               public.quiz_membro(q.autor_registro) || jsonb_build_object('rotulo', q.autor_rotulo) end,
    'alternativas', coalesce((select jsonb_agg(jsonb_build_object(
        'letra', a.letra, 'texto', a.texto, 'correta', a.correta,
        'membro', case when a.registro is not null then public.quiz_membro(a.registro) end) order by a.letra)
      from quiz_alternativas a where a.pergunta_id = q.id), '[]'::jsonb))
  from quiz_perguntas q where q.id = p_id;
$$;

-- ============================================================
-- 5. O EDITOR
-- ------------------------------------------------------------
create or replace function public.quiz_perguntas_lista()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'perguntas', coalesce((
    select jsonb_agg(public.quiz__fotografia(q.id) || jsonb_build_object(
             'ordem', q.ordem, 'ativa', q.ativa, 'autor_registro', q.autor_registro, 'autor_rotulo', q.autor_rotulo,
             'origem', q.origem, 'atualizado_em', q.atualizado_em,
             'alternativas', coalesce((select jsonb_agg(jsonb_build_object('letra', a.letra, 'texto', a.texto,
                                'registro', a.registro, 'correta', a.correta,
                                'membro', case when a.registro is not null then public.quiz_membro(a.registro) end) order by a.letra)
                              from quiz_alternativas a where a.pergunta_id = q.id), '[]'::jsonb),
             'problemas', to_jsonb(public.quiz__problemas(q.id)))
           order by q.ordem, q.criado_em)
      from quiz_perguntas q), '[]'::jsonb));
end $$;

-- Grava uma pergunta (nova, sem id; ou a que tem o id) e as alternativas,
-- na ordem do array (a primeira é A). Membro que não existe vira
-- registro vazio, e o problema aparece. Com problema que impede o jogo,
-- a pergunta fica desativada.
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
  if coalesce((p->>'tempo_s')::integer, 20) not between 5 and 240 then
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
    tempo_s = coalesce((p->>'tempo_s')::integer, 20),
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

create or replace function public.quiz_pergunta_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return public.quiz__gravar(p, public.portal_registro_atual());
end $$;

-- A importação do docx: a lista já revisada no editor. Com
-- p_substituir, apaga as perguntas que havia (as partidas jogadas
-- guardam a fotografia de cada rodada); com partida aberta, não.
create or replace function public.quiz_importar(p_lista jsonb, p_substituir boolean default false)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_base integer; x jsonb; r jsonb;
        v_out jsonb := '[]'::jsonb; n integer := 0;
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) = 0 then
    return jsonb_build_object('status', 'invalido', 'campo', 'lista'); end if;
  if p_substituir and exists (select 1 from quiz_sessoes where fase <> 'fim') then
    return jsonb_build_object('status', 'partida_aberta'); end if;
  if p_substituir then delete from quiz_perguntas where true; end if;
  select coalesce(max(ordem), 0) into v_base from quiz_perguntas;
  for x in select * from jsonb_array_elements(p_lista) loop
    n := n + 1;
    r := public.quiz__gravar(x - 'id' || jsonb_build_object('ordem', v_base + n), v_reg);
    if r->>'status' <> 'ok' then
      raise exception using message = format('NeuroQuiz: a pergunta %s da lista não entrou (%s).', n, r->>'campo');
    end if;
    v_out := v_out || jsonb_build_array(r || jsonb_build_object('origem', x->>'origem'));
  end loop;
  return jsonb_build_object('status', 'ok', 'importadas', n,
    'ativas', (select count(*) from jsonb_array_elements(v_out) e where (e->>'ativa')::boolean),
    'resultado', v_out);
end $$;

create or replace function public.quiz_pergunta_excluir(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  delete from quiz_perguntas where id = p_id;
  if not found then return jsonb_build_object('status', 'inexistente'); end if;
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.quiz_pergunta_duplicar(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare q quiz_perguntas; v_novo uuid := gen_random_uuid(); v_reg integer := public.portal_registro_atual();
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into q from quiz_perguntas where id = p_id;
  if not found then return jsonb_build_object('status', 'inexistente'); end if;
  update quiz_perguntas set ordem = ordem + 1 where ordem > q.ordem;
  insert into quiz_perguntas (id, ordem, ativa, tipo, texto, autor_registro, autor_rotulo, mensagem, extra, tempo_s,
                              pontos, nota, origem, criado_por, atualizado_por)
  values (v_novo, q.ordem + 1, false, q.tipo, q.texto, q.autor_registro, q.autor_rotulo, q.mensagem, q.extra, q.tempo_s,
          q.pontos, q.nota, q.origem, v_reg, v_reg);
  insert into quiz_alternativas (pergunta_id, letra, texto, registro, correta)
  select v_novo, letra, texto, registro, correta from quiz_alternativas where pergunta_id = p_id;
  return jsonb_build_object('status', 'ok', 'id', v_novo);
end $$;

-- A ordem nova: os ids na ordem em que devem ficar (os que faltarem
-- vão para o fim, na ordem de antes).
create or replace function public.quiz_perguntas_ordenar(p_ids uuid[])
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  update quiz_perguntas q set ordem = x.n
    from (select q2.id, row_number() over (order by coalesce(array_position(p_ids, q2.id), 2147483647), q2.ordem, q2.criado_em) n
            from quiz_perguntas q2) x
   where q.id = x.id and q.ordem is distinct from x.n;
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.quiz_pergunta_ativar(p_id uuid, p_ativa boolean)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_problemas text[];
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from quiz_perguntas where id = p_id) then return jsonb_build_object('status', 'inexistente'); end if;
  v_problemas := public.quiz__problemas(p_id);
  if p_ativa and public.quiz__bloqueia(v_problemas) then
    return jsonb_build_object('status', 'com_problema', 'problemas', to_jsonb(v_problemas)); end if;
  update quiz_perguntas set ativa = p_ativa, atualizado_em = now(), atualizado_por = public.portal_registro_atual()
   where id = p_id;
  return jsonb_build_object('status', 'ok', 'ativa', p_ativa);
end $$;

-- ============================================================
-- 6. O TEMPO REAL
--    O banco avisa; quem ouve consulta. Sem realtime.send (banco de
--    teste) ou com erro no envio, nada acontece: o aviso nunca desfaz
--    a gravação, e as telas consultam a cada poucos segundos.
-- ------------------------------------------------------------
create or replace function public.quiz__avisar(p_sessao uuid, p_evento text, p_payload jsonb, p_tv boolean default false)
returns void language plpgsql volatile security definer
set search_path = public as $$
begin
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
  execute 'select realtime.send($1, $2, $3, false)'
    using p_payload, p_evento, 'neuroquiz:' || p_sessao::text || case when p_tv then ':tv' else '' end;
exception when others then null;
end $$;

-- O sinal de cada passo: só horários, números e, na revelação, as letras certas.
create or replace function public.quiz__sinal(p_sessao uuid)
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object('seq', s.seq, 'fase', s.fase, 'rodada', s.rodada, 'total', s.total,
           'iniciada_em', s.iniciada_em, 'prazo', s.prazo, 'n_alt', r.n_alt,
           'corretas', case when s.fase = 'revelacao' then to_jsonb(r.corretas) end)
    from quiz_sessoes s left join quiz_rodadas r on r.sessao_id = s.id and r.ordem = s.rodada
   where s.id = p_sessao;
$$;

create or replace function public.quiz__mudou(p_sessao uuid)
returns void language plpgsql volatile security definer
set search_path = public as $$
begin
  perform public.quiz__avisar(p_sessao, 'fase', public.quiz__sinal(p_sessao), false);
  perform public.quiz__avisar(p_sessao, 'fase', public.quiz__sinal(p_sessao), true);
end $$;

create or replace function public.quiz__resposta_chegou()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.quiz__avisar(new.sessao_id, 'respostas', jsonb_build_object('rodada', new.ordem,
    'n', (select count(*) from quiz_respostas where sessao_id = new.sessao_id and ordem = new.ordem)), true);
  return null;
end $$;
drop trigger if exists quiz_resposta_chegou on public.quiz_respostas;
create trigger quiz_resposta_chegou after insert on public.quiz_respostas
  for each row execute function public.quiz__resposta_chegou();

create or replace function public.quiz__jogador_entrou()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.quiz__avisar(new.sessao_id, 'jogadores', jsonb_build_object(
    'n', (select count(*) from quiz_jogadores where sessao_id = new.sessao_id)), true);
  return null;
end $$;
drop trigger if exists quiz_jogador_entrou on public.quiz_jogadores;
create trigger quiz_jogador_entrou after insert on public.quiz_jogadores
  for each row execute function public.quiz__jogador_entrou();

-- ============================================================
-- 7. A PARTIDA: CRIAR, ABRIR, REVELAR, AVANÇAR
-- ------------------------------------------------------------
create or replace function public.quiz_sessao_criar(p jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_pin text; v_total integer; v_reg integer := public.portal_registro_atual();
        v_tentativa integer := 0;
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if coalesce((p->>'leitura_s')::integer, 5) not between 0 and 15 then
    return jsonb_build_object('status', 'invalido', 'campo', 'leitura_s'); end if;
  if coalesce((p->>'placar_cada')::integer, 1) not between 0 and 50 then
    return jsonb_build_object('status', 'invalido', 'campo', 'placar_cada'); end if;
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
  insert into quiz_sessoes (id, pin, titulo, leitura_s, placar_cada, bonus_sequencia, texto_no_celular, criada_por, criada_por_nome)
  values (v_id, v_pin, btrim(coalesce(p->>'titulo', 'NeuroQuiz')), coalesce((p->>'leitura_s')::integer, 5),
          coalesce((p->>'placar_cada')::integer, 1), coalesce((p->>'bonus_sequencia')::boolean, true),
          coalesce((p->>'texto_no_celular')::boolean, false), v_reg,
          (select nome from membros where registro = v_reg));
  insert into quiz_rodadas (sessao_id, ordem, pergunta_id, conteudo, corretas, n_alt, tempo_s, pontos)
  select v_id, row_number() over (order by q.ordem, q.criado_em), q.id, f.f,
         array(select (a->>'letra')::smallint from jsonb_array_elements(f.f->'alternativas') a where (a->>'correta')::boolean),
         jsonb_array_length(f.f->'alternativas'), q.tempo_s, q.pontos
    from quiz_perguntas q cross join lateral (select public.quiz__fotografia(q.id) f) f
   where q.ativa and not public.quiz__bloqueia(public.quiz__problemas(q.id));
  get diagnostics v_total = row_count;
  update quiz_sessoes set total = v_total where id = v_id;
  return jsonb_build_object('status', 'ok', 'id', v_id, 'pin', v_pin, 'total', v_total);
end $$;

-- Libera a próxima rodada. A fotografia é tirada de novo (pega a
-- correção feita no editor durante a partida), se a pergunta ainda
-- existe e não tem problema; senão vale a de quando a partida nasceu.
create or replace function public.quiz__abrir(p_sessao uuid)
returns void language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes; r quiz_rodadas; f jsonb; v_lib timestamptz := clock_timestamp(); v_ini timestamptz;
begin
  select * into s from quiz_sessoes where id = p_sessao;
  if s.rodada >= s.total then
    update quiz_sessoes set fase = 'fim', seq = seq + 1, mudou_em = now(), encerrada_em = coalesce(encerrada_em, now()),
                            iniciada_em = null, prazo = null
     where id = p_sessao;
    return;
  end if;
  select * into r from quiz_rodadas where sessao_id = p_sessao and ordem = s.rodada + 1;
  if r.pergunta_id is not null and exists (select 1 from quiz_perguntas where id = r.pergunta_id)
     and not public.quiz__bloqueia(public.quiz__problemas(r.pergunta_id)) then
    f := public.quiz__fotografia(r.pergunta_id);
    update quiz_rodadas set conteudo = f,
           corretas = array(select (a->>'letra')::smallint from jsonb_array_elements(f->'alternativas') a where (a->>'correta')::boolean),
           n_alt = jsonb_array_length(f->'alternativas'), tempo_s = (f->>'tempo_s')::integer, pontos = (f->>'pontos')::integer
     where sessao_id = p_sessao and ordem = r.ordem
    returning * into r;
  end if;
  v_ini := v_lib + make_interval(secs => s.leitura_s);
  update quiz_rodadas set liberada_em = v_lib, iniciada_em = v_ini, prazo = v_ini + make_interval(secs => r.tempo_s)
   where sessao_id = p_sessao and ordem = r.ordem;
  update quiz_sessoes set fase = 'pergunta', rodada = r.ordem, iniciada_em = v_ini,
                          prazo = v_ini + make_interval(secs => r.tempo_s), seq = seq + 1, mudou_em = now()
   where id = p_sessao;
end $$;

-- Fecha a rodada: a contagem, os pontos, a sequência e a posição de
-- cada um, numa passada. p_vencida: só fecha depois do prazo, e não
-- espera ninguém (quem já está fechando, fecha).
create or replace function public.quiz__revelar(p_sessao uuid, p_vencida boolean)
returns boolean language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes; v_n integer;
begin
  if p_vencida then
    select * into s from quiz_sessoes where id = p_sessao for update skip locked;
    if not found then return false; end if;
    if s.fase <> 'pergunta' or clock_timestamp() <= s.prazo + interval '500 milliseconds' then return false; end if;
  else
    select * into s from quiz_sessoes where id = p_sessao for update;
    if s.fase <> 'pergunta' then return false; end if;
  end if;
  select n_alt into v_n from quiz_rodadas where sessao_id = p_sessao and ordem = s.rodada;
  update quiz_rodadas set encerrada_em = clock_timestamp(),
         contagem = array(select (select count(*) from quiz_respostas x where x.sessao_id = p_sessao and x.ordem = s.rodada and x.letra = g)::integer
                            from generate_series(0, v_n - 1) g order by g)
   where sessao_id = p_sessao and ordem = s.rodada;
  update quiz_jogadores j set
         pontos = j.pontos + coalesce(x.pontos + x.bonus, 0),
         acertos = j.acertos + case when x.correta then 1 else 0 end,
         sequencia = case when x.correta then j.sequencia + 1 else 0 end,
         tempo_ms = j.tempo_ms + case when x.correta then x.tempo_ms else 0 end,
         posicao_anterior = j.posicao
    from (select j2.uid, r.pontos, r.bonus, r.correta, r.tempo_ms
            from quiz_jogadores j2
            left join quiz_respostas r on r.sessao_id = j2.sessao_id and r.uid = j2.uid and r.ordem = s.rodada
           where j2.sessao_id = p_sessao) x
   where j.sessao_id = p_sessao and j.uid = x.uid;
  update quiz_jogadores j set posicao = x.n
    from (select uid, row_number() over (order by pontos desc, acertos desc, tempo_ms asc, entrou_em asc) n
            from quiz_jogadores where sessao_id = p_sessao) x
   where j.sessao_id = p_sessao and j.uid = x.uid;
  update quiz_sessoes set fase = 'revelacao', seq = seq + 1, mudou_em = now() where id = p_sessao;
  perform public.quiz__mudou(p_sessao);
  return true;
end $$;

-- O que a TV mostra. A correta só sai na revelação: até lá a tela da
-- TV não a tem.
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
              'bonus_sequencia', s.bonus_sequencia, 'texto_no_celular', s.texto_no_celular),
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

-- Um passo, no ritmo de quem conduz. p_seq é o seq que a TV viu: se
-- outro passo já aconteceu (o segundo toque, a outra TV, o prazo que
-- fechou sozinho), não anda e devolve o estado de agora.
create or replace function public.quiz_avancar(p_sessao uuid, p_seq integer)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes;
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into s from quiz_sessoes where id = p_sessao for update;
  if not found then return jsonb_build_object('status', 'inexistente'); end if;
  if s.seq <> p_seq then return public.quiz_tv(p_sessao) || jsonb_build_object('passo', 'desatualizado'); end if;
  if s.fase = 'pergunta' then
    perform public.quiz__revelar(p_sessao, false);
    return public.quiz_tv(p_sessao) || jsonb_build_object('passo', 'ok');
  elsif s.fase = 'revelacao' and s.rodada < s.total and s.placar_cada > 0 and s.rodada % s.placar_cada = 0 then
    update quiz_sessoes set fase = 'placar', seq = seq + 1, mudou_em = now() where id = p_sessao;
  elsif s.fase = 'revelacao' and s.rodada >= s.total then
    update quiz_sessoes set fase = 'fim', seq = seq + 1, mudou_em = now(), encerrada_em = now(),
                            iniciada_em = null, prazo = null where id = p_sessao;
  elsif s.fase in ('lobby', 'revelacao', 'placar') then
    perform public.quiz__abrir(p_sessao);
  else
    return public.quiz_tv(p_sessao) || jsonb_build_object('passo', 'fim');
  end if;
  perform public.quiz__mudou(p_sessao);
  return public.quiz_tv(p_sessao) || jsonb_build_object('passo', 'ok');
end $$;

create or replace function public.quiz_sessao_encerrar(p_sessao uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  update quiz_sessoes set fase = 'fim', seq = seq + 1, mudou_em = now(), encerrada_em = coalesce(encerrada_em, now()),
                          iniciada_em = null, prazo = null
   where id = p_sessao and fase <> 'fim';
  if found then perform public.quiz__mudou(p_sessao); end if;
  return jsonb_build_object('status', 'ok');
end $$;

create or replace function public.quiz_sessoes_lista()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  if not public.quiz_pode_gerir() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'sessoes', coalesce((select jsonb_agg(jsonb_build_object(
      'id', s.id, 'pin', s.pin, 'titulo', s.titulo, 'fase', s.fase, 'rodada', s.rodada, 'total', s.total,
      'criada_em', s.criada_em, 'criada_por_nome', s.criada_por_nome, 'encerrada_em', s.encerrada_em,
      'jogadores_n', (select count(*) from quiz_jogadores j where j.sessao_id = s.id)) order by s.criada_em desc)
    from (select * from quiz_sessoes order by criada_em desc limit 30) s), '[]'::jsonb));
end $$;

-- ============================================================
-- 8. QUEM JOGA: ENTRAR, O ESTADO, RESPONDER
-- ------------------------------------------------------------
create or replace function public.quiz_estado(p_sessao uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes; r quiz_rodadas; j quiz_jogadores; m quiz_respostas; v jsonb; v_perg jsonb; v_frente quiz_jogadores;
begin
  if not public.quiz_pode_jogar() then return jsonb_build_object('status', 'sem_acesso'); end if;
  select * into j from quiz_jogadores where sessao_id = p_sessao and uid = auth.uid();
  if not found then return jsonb_build_object('status', 'fora'); end if;
  perform public.quiz__revelar(p_sessao, true);
  update quiz_jogadores set visto_em = clock_timestamp() where sessao_id = p_sessao and uid = auth.uid()
  returning * into j;
  select * into s from quiz_sessoes where id = p_sessao;
  select * into r from quiz_rodadas where sessao_id = p_sessao and ordem = s.rodada;
  v := jsonb_build_object('status', 'ok', 'agora', clock_timestamp(),
    'sessao', jsonb_build_object('id', s.id, 'pin', s.pin, 'titulo', s.titulo, 'fase', s.fase, 'seq', s.seq,
              'rodada', s.rodada, 'total', s.total, 'iniciada_em', s.iniciada_em, 'prazo', s.prazo,
              'texto_no_celular', s.texto_no_celular),
    'eu', jsonb_build_object('registro', j.registro, 'nome', j.nome, 'curto', j.curto, 'foto_url', j.foto_url,
              'pontos', j.pontos, 'acertos', j.acertos, 'sequencia', j.sequencia, 'posicao', j.posicao),
    'jogadores_n', (select count(*) from quiz_jogadores where sessao_id = p_sessao));
  if s.fase in ('pergunta', 'revelacao') then
    v_perg := jsonb_build_object('ordem', r.ordem, 'tipo', r.conteudo->>'tipo', 'n_alt', r.n_alt,
                                 'tempo_s', r.tempo_s, 'pontos', r.pontos);
    if s.texto_no_celular then
      v_perg := v_perg || jsonb_build_object('texto', r.conteudo->>'texto', 'mensagem', r.conteudo->>'mensagem',
        'autor', r.conteudo->'autor' - 'status',
        'alternativas', coalesce((select jsonb_agg(jsonb_build_object('letra', a->'letra', 'texto', a->'texto',
            'membro', case when a->'membro' <> 'null'::jsonb then (a->'membro') - 'status' end) order by (a->>'letra')::int)
          from jsonb_array_elements(r.conteudo->'alternativas') a), '[]'::jsonb));
    end if;
    select * into m from quiz_respostas where sessao_id = p_sessao and ordem = s.rodada and uid = auth.uid();
    v := v || jsonb_build_object('pergunta', v_perg);
    if s.fase = 'pergunta' then
      v := v || jsonb_build_object('minha', case when m.uid is not null then jsonb_build_object('letra', m.letra, 'recebida_em', m.recebida_em) end);
    else
      v := v || jsonb_build_object('corretas', to_jsonb(r.corretas),
        'minha', case when m.uid is not null then jsonb_build_object('letra', m.letra, 'recebida_em', m.recebida_em,
                   'correta', m.correta, 'pontos', m.pontos, 'bonus', m.bonus, 'tempo_ms', m.tempo_ms) end);
    end if;
  end if;
  if s.fase in ('revelacao', 'placar', 'fim') and j.posicao > 1 then
    select * into v_frente from quiz_jogadores where sessao_id = p_sessao and posicao = j.posicao - 1;
    v := v || jsonb_build_object('atras_de', jsonb_build_object('curto', v_frente.curto, 'diferenca', v_frente.pontos - j.pontos));
  end if;
  if s.fase = 'fim' then
    v := v || jsonb_build_object('podio', coalesce((select jsonb_agg(jsonb_build_object('curto', curto, 'pontos', pontos,
            'posicao', posicao) order by posicao) from quiz_jogadores where sessao_id = p_sessao and posicao <= 3), '[]'::jsonb));
  end if;
  return v;
end $$;

-- Entrar pelo PIN, com a conta do SOMA. De novo (recarregou, perdeu a
-- rede, trocou de aparelho com a mesma conta): a mesma linha, com os
-- mesmos pontos. Partida encerrada só se reabre para quem já jogou,
-- por 12 horas, para ver o pódio.
create or replace function public.quiz_entrar(p_pin text)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare s quiz_sessoes; v_reg integer; v_nome text; v_foto text;
begin
  if not public.quiz_pode_jogar() then return jsonb_build_object('status', 'sem_acesso'); end if;
  select * into s from quiz_sessoes where pin = btrim(coalesce(p_pin, '')) and fase <> 'fim';
  if not found then
    select x.* into s from quiz_sessoes x join quiz_jogadores j on j.sessao_id = x.id and j.uid = auth.uid()
     where x.pin = btrim(coalesce(p_pin, '')) and x.encerrada_em > now() - interval '12 hours'
     order by x.criada_em desc limit 1;
    if not found then return jsonb_build_object('status', 'pin_invalido'); end if;
    return public.quiz_estado(s.id);
  end if;
  if not exists (select 1 from quiz_jogadores where sessao_id = s.id and uid = auth.uid()) then
    v_reg := public.portal_registro_atual();
    select nome, nullif(btrim(coalesce(foto_url, '')), '') into v_nome, v_foto from membros where registro = v_reg;
    if v_nome is null then
      select coalesce(nullif(btrim(nome), ''), split_part(email, '@', 1)) into v_nome from perfis where id = auth.uid();
    end if;
    insert into quiz_jogadores (sessao_id, uid, registro, nome, curto, foto_url)
    values (s.id, auth.uid(), v_reg, coalesce(v_nome, 'Jogador'), public.quiz_curto(coalesce(v_nome, 'Jogador'), v_reg), v_foto)
    on conflict (sessao_id, uid) do nothing;
  end if;
  return public.quiz_estado(s.id);
end $$;

-- A resposta. A chegada é a hora do banco (clock_timestamp no começo da
-- função): nem o relógio do celular nem a fila do lock contam.
create or replace function public.quiz_responder(p_sessao uuid, p_rodada integer, p_letra integer)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_agora timestamptz := clock_timestamp(); s quiz_sessoes; r quiz_rodadas; j quiz_jogadores; m quiz_respostas;
        v_ms integer; v_ok boolean; v_pts integer; v_bonus integer;
        v_tol constant interval := interval '500 milliseconds';
begin
  if not public.quiz_pode_jogar() then return jsonb_build_object('status', 'sem_acesso'); end if;
  select * into m from quiz_respostas where sessao_id = p_sessao and ordem = p_rodada and uid = auth.uid();
  if found then
    return jsonb_build_object('status', 'ja_respondeu', 'letra', m.letra, 'recebida_em', m.recebida_em, 'agora', clock_timestamp());
  end if;
  -- sem lock, para recusar logo o que chega fora de hora
  select * into s from quiz_sessoes where id = p_sessao;
  if not found then return jsonb_build_object('status', 'inexistente'); end if;
  if s.fase <> 'pergunta' or s.rodada <> p_rodada then
    return jsonb_build_object('status', 'encerrada', 'agora', clock_timestamp()); end if;
  if v_agora < s.iniciada_em then return jsonb_build_object('status', 'cedo', 'agora', clock_timestamp()); end if;
  if v_agora > s.prazo + v_tol then return jsonb_build_object('status', 'fora_do_prazo', 'agora', clock_timestamp()); end if;
  -- com lock compartilhado: a revelação espera as respostas que já entraram
  select * into s from quiz_sessoes where id = p_sessao for share;
  if s.fase <> 'pergunta' or s.rodada <> p_rodada then
    return jsonb_build_object('status', 'encerrada', 'agora', clock_timestamp()); end if;
  select * into j from quiz_jogadores where sessao_id = p_sessao and uid = auth.uid();
  if not found then return jsonb_build_object('status', 'fora'); end if;
  select * into r from quiz_rodadas where sessao_id = p_sessao and ordem = p_rodada;
  if p_letra is null or p_letra < 0 or p_letra >= r.n_alt then
    return jsonb_build_object('status', 'invalido', 'campo', 'letra'); end if;
  v_ms := greatest(0, least(round(extract(epoch from (v_agora - r.iniciada_em)) * 1000), r.tempo_s * 1000))::integer;
  v_ok := p_letra::smallint = any(r.corretas);
  v_pts := case when not v_ok or r.pontos = 0 then 0
                when v_ms <= 500 then r.pontos
                else round(r.pontos * (1 - (v_ms::numeric / (r.tempo_s * 1000)) / 2))::integer end;
  v_bonus := case when v_ok and r.pontos > 0 and s.bonus_sequencia then least(j.sequencia, 5) * 100 else 0 end;
  insert into quiz_respostas (sessao_id, ordem, uid, letra, recebida_em, tempo_ms, correta, pontos, bonus)
  values (p_sessao, p_rodada, auth.uid(), p_letra, v_agora, v_ms, v_ok, v_pts, v_bonus)
  on conflict (sessao_id, ordem, uid) do nothing;
  if not found then
    select * into m from quiz_respostas where sessao_id = p_sessao and ordem = p_rodada and uid = auth.uid();
    return jsonb_build_object('status', 'ja_respondeu', 'letra', m.letra, 'recebida_em', m.recebida_em, 'agora', clock_timestamp());
  end if;
  update quiz_jogadores set visto_em = v_agora where sessao_id = p_sessao and uid = auth.uid();
  return jsonb_build_object('status', 'ok', 'letra', p_letra, 'recebida_em', v_agora, 'agora', clock_timestamp());
end $$;

-- ============================================================
-- 9. AS PERMISSÕES DAS FUNÇÕES
-- ------------------------------------------------------------
do $$
declare f text;
begin
  -- as que a página chama: só quem entrou (cada uma confere o papel)
  foreach f in array array['quiz_pode_gerir()','quiz_pode_jogar()','quiz_membros()','quiz_relogio()',
      'quiz_perguntas_lista()','quiz_pergunta_salvar(jsonb)','quiz_importar(jsonb,boolean)','quiz_pergunta_excluir(uuid)',
      'quiz_pergunta_duplicar(uuid)','quiz_perguntas_ordenar(uuid[])','quiz_pergunta_ativar(uuid,boolean)',
      'quiz_sessao_criar(jsonb)','quiz_tv(uuid)','quiz_avancar(uuid,integer)','quiz_sessao_encerrar(uuid)',
      'quiz_sessoes_lista()','quiz_estado(uuid)','quiz_entrar(text)','quiz_responder(uuid,integer,integer)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- as de dentro: ninguém chama pela API
  foreach f in array array['quiz_curto(text,integer)','quiz_membro(integer)','quiz__bloqueia(text[])','quiz__problemas(uuid)',
      'quiz__fotografia(uuid)','quiz__gravar(jsonb,integer)','quiz__avisar(uuid,text,jsonb,boolean)','quiz__sinal(uuid)',
      'quiz__mudou(uuid)','quiz__resposta_chegou()','quiz__jogador_entrou()','quiz__abrir(uuid)','quiz__revelar(uuid,boolean)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('revoke execute on function public.%s from authenticated', f);
  end loop;
end $$;

-- as políticas das tabelas, agora que quiz_pode_gerir existe
do $$
declare t text;
begin
  foreach t in array array['quiz_perguntas','quiz_alternativas','quiz_sessoes','quiz_rodadas','quiz_jogadores','quiz_respostas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon', t);
    end if;
    execute format('revoke all on table public.%I from authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format('drop policy if exists quiz_gestao_le on public.%I', t);
    execute format('create policy quiz_gestao_le on public.%I for select to authenticated using ((select public.quiz_pode_gerir()))', t);
  end loop;
  if to_regprocedure('public.conta_ativa_travar()') is not null then perform public.conta_ativa_travar(); end if;
end $$;

insert into public.migracoes (id, descricao) values
  ('2.29.0_neuroquiz', 'O NeuroQuiz: perguntas (clássica, quem é quem, WhatsApp; mais de uma correta), partidas com PIN, '
   'rodadas com o tempo do banco, jogadores pela conta do SOMA e uma resposta por rodada; pontos de até 1000 que caem com o '
   'tempo e bônus de sequência; avisos pelo Realtime ("neuroquiz:<sessão>"); gestão (eh_gestao) edita e conduz, conta ativa joga')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select (select count(*) from pg_proc where proname like 'quiz\_%' and pronamespace = 'public'::regnamespace) as "funções do NeuroQuiz",
       (select count(*) from pg_policies where tablename like 'quiz\_%') as "políticas",
       to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null as "Realtime disponível";

-- ============================================================
-- FIM, SOMA 2.29.0
--
-- Depois de rodar:
--   1) publique o portal;
--   2) abra membro.neurodynamics.dev/quiz/#editor com uma conta da
--      gestão e importe o docx das perguntas;
--   3) para jogar, Nova partida no editor: a TV abre com o PIN e o QR.
-- ============================================================
