-- ============================================================
-- SOMA 2.19.2: Relações institucionais (RI)
--
-- O registro dos contatos da equipe (pessoas e organizações), das relações
-- entre eles, das interações (o histórico) e dos eventos de RI, mais as
-- indicações que qualquer membro faz pelos Serviços.
--
-- Quem vê: só quem está no NRO_RELAC ou no NRO_COORD_OFFICE (com a herança
-- de grupos de esta_no_grupo). Nenhuma tabela é legível pela API: tudo passa
-- pelas funções abaixo. A indicação é a exceção controlada: qualquer membro
-- ativo indica e acompanha as próprias indicações, sem ver o resto.
--
-- O modelo (por que assim):
--   - Pessoa e organização são o mesmo tipo de "contato" (natureza), para
--     que ambas sejam pontos no mapa, cartões no kanban e linhas na tabela,
--     e possam se relacionar entre si. A pessoa aponta a organização em que
--     está (organizacao_id), e isso já é uma ligação no mapa.
--   - funcao: o papel do contato para a NRO (a cor no mapa).
--   - proximidade 1 a 5: o quão perto da nossa rede está (a opacidade).
--   - estagio: a qualidade da conexão, do identificado à parceria (o kanban).
--   - influencia e interesse 1 a 5: a matriz poder × interesse (Mendelow),
--     usada para decidir onde pôr energia.
--   - relações: entre dois contatos, com tags, sinal (positiva, neutra,
--     negativa) e força 1 a 5.
--   - interações: reunião, e-mail, ligação... com os contatos envolvidos; a
--     última interação e o próximo passo evitam que um contato esfrie.
--   - LGPD: guarde só o necessário à finalidade institucional; "origem" diz
--     de onde veio o dado, e excluir apaga a pessoa e o histórico dela.
--
-- Depois da 2.19.2_recursos (ou de qualquer 2.19.x). Pode rodar de novo.
-- ============================================================

-- 1. tabelas ------------------------------------------------------------------------------
create table if not exists public.ri_contatos (
  id               bigint generated always as identity primary key,
  natureza         text not null default 'pessoa' check (natureza in ('pessoa', 'organizacao')),
  nome             text not null check (length(btrim(nome)) between 1 and 160),
  cargo            text,                 -- pessoa: o cargo; organização: o tipo (universidade, empresa...)
  organizacao_id   bigint references public.ri_contatos(id) on delete set null,
  funcao           text not null default 'stakeholder',
  proximidade      smallint not null default 1 check (proximidade between 1 and 5),
  estagio          text not null default 'identificado',
  influencia       smallint check (influencia between 1 and 5),
  interesse        smallint check (interesse between 1 and 5),
  tags             text[] not null default '{}',   -- interesses e temas
  canais           jsonb not null default '[]',    -- [{tipo:'email'|'telefone'|'linkedin'|'site'|'outro', valor}]
  cidade           text,
  resumo           text,                 -- o básico, que aparece no pop-up do mapa
  notas            text,
  origem           text,                 -- como chegamos a ele (indicação de X, evento Y)
  responsavel      integer references public.membros(registro) on delete set null,
  proximo_passo    text,
  proximo_em       date,
  ativo            boolean not null default true,
  criado_por       integer references public.membros(registro) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_por   integer references public.membros(registro) on delete set null,
  atualizado_em    timestamptz not null default now(),
  check (organizacao_id is null or organizacao_id <> id));
create index if not exists ri_contatos_org on public.ri_contatos (organizacao_id);

create table if not exists public.ri_relacoes (
  id           bigint generated always as identity primary key,
  a            bigint not null references public.ri_contatos(id) on delete cascade,
  b            bigint not null references public.ri_contatos(id) on delete cascade,
  tags         text[] not null default '{}',
  sinal        text not null default 'positiva' check (sinal in ('positiva', 'neutra', 'negativa')),
  forca        smallint not null default 3 check (forca between 1 and 5),
  nota         text,
  criado_por   integer references public.membros(registro) on delete set null,
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (a < b), unique (a, b));

create table if not exists public.ri_eventos (
  id            bigint generated always as identity primary key,
  nome          text not null check (length(btrim(nome)) between 1 and 200),
  tipo          text not null default 'outro',
  status        text not null default 'prospectado',
  inicio        date,
  fim           date,
  local         text,
  modalidade    text not null default 'presencial' check (modalidade in ('presencial', 'online', 'hibrido')),
  link          text,
  organizador   text,
  objetivos     text[] not null default '{}',
  publico       text,                  -- quem estará lá (stakeholders esperados)
  custo         numeric(10, 2),
  participantes integer[] not null default '{}',   -- registros da equipe
  contatos      bigint[] not null default '{}',    -- contatos encontrados ou esperados
  resultados    text,
  avaliacao     smallint check (avaliacao between 1 and 5),
  notas         text,
  criado_por    integer references public.membros(registro) on delete set null,
  criado_em     timestamptz not null default now(),
  atualizado_por integer references public.membros(registro) on delete set null,
  atualizado_em timestamptz not null default now(),
  check (fim is null or inicio is null or fim >= inicio));

create table if not exists public.ri_interacoes (
  id            bigint generated always as identity primary key,
  data          date not null default current_date,
  tipo          text not null default 'reuniao',
  resumo        text not null check (length(btrim(resumo)) between 1 and 4000),
  contatos      bigint[] not null default '{}',
  evento_id     bigint references public.ri_eventos(id) on delete set null,
  autor         integer references public.membros(registro) on delete set null,
  criado_em     timestamptz not null default now());
create index if not exists ri_interacoes_contatos on public.ri_interacoes using gin (contatos);

create table if not exists public.ri_indicacoes (
  id            bigint generated always as identity primary key,
  tipo          text not null check (tipo in ('contato', 'evento')),
  autor         integer references public.membros(registro) on delete set null,
  dados         jsonb not null default '{}',
  status        text not null default 'nova' check (status in ('nova', 'em_analise', 'aceita', 'recusada')),
  resposta      text,
  analisado_por integer references public.membros(registro) on delete set null,
  analisado_em  timestamptz,
  contato_id    bigint references public.ri_contatos(id) on delete set null,
  evento_id     bigint references public.ri_eventos(id) on delete set null,
  criado_em     timestamptz not null default now());

do $$ declare t text; begin
  foreach t in array array['ri_contatos', 'ri_relacoes', 'ri_eventos', 'ri_interacoes', 'ri_indicacoes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 2. vocabulários (o front usa os mesmos) ---------------------------------------------------
create or replace function public.ri_vocab(p text)
returns text[] language sql immutable as $$
  select case p
    when 'funcao' then array['stakeholder', 'parceiro', 'investidor', 'fomento', 'academia', 'governo', 'saude',
                             'empresa', 'mentor', 'imprensa', 'fornecedor', 'membro', 'ex_membro', 'apoiador', 'concorrente']
    when 'estagio' then array['identificado', 'primeiro_contato', 'conhecendo', 'interesses_definidos', 'colaborando', 'parceria', 'pausado']
    when 'interacao' then array['reuniao', 'email', 'ligacao', 'mensagem', 'evento', 'visita', 'apresentacao', 'outro']
    when 'evento_tipo' then array['congresso', 'feira', 'rodada', 'pitch', 'reuniao', 'visita', 'workshop', 'premiacao', 'edital', 'outro']
    when 'evento_status' then array['prospectado', 'avaliando', 'confirmado', 'participou', 'descartado']
    when 'canal' then array['email', 'telefone', 'linkedin', 'site', 'instagram', 'outro']
  end $$;

-- 3. acesso ---------------------------------------------------------------------------------
create or replace function public.ri_equipe()
returns setof integer language sql stable security definer set search_path = public as $$
  select m.registro from membros m
   where m.status in ('Ativo', 'Em pausa / avaliação')
     and exists (select 1 from grupos g where g.ativo and upper(g.nome) in ('NRO_RELAC', 'NRO_COORD_OFFICE')
                    and public.esta_no_grupo(g.id, m.registro)) $$;

create or replace function public.ri_pode()
returns boolean language sql stable security definer set search_path = public as $$
  select public.conta_ativa() and public.portal_registro_atual() is not null
     and public.portal_registro_atual() in (select public.ri_equipe()) $$;

-- 4. peças ------------------------------------------------------------------------------------
create or replace function public.ri_lista_limpar(p jsonb, p_max integer default 30)
returns text[] language sql immutable as $$
  select coalesce(array_agg(distinct v) filter (where v <> ''), '{}')
    from (select left(btrim(regexp_replace(x, '\s+', ' ', 'g')), 60) v
            from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]' end) x limit p_max) s $$;

create or replace function public.ri_nome(p_reg integer)
returns text language sql stable security definer set search_path = public as $$
  select nome from membros where registro = p_reg $$;

create or replace function public.ri_contato_json(c ri_contatos)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', c.id, 'natureza', c.natureza, 'nome', c.nome, 'cargo', c.cargo,
    'organizacao_id', c.organizacao_id, 'organizacao', (select nome from ri_contatos o where o.id = c.organizacao_id),
    'funcao', c.funcao, 'proximidade', c.proximidade, 'estagio', c.estagio, 'influencia', c.influencia, 'interesse', c.interesse,
    'tags', to_jsonb(c.tags), 'cidade', c.cidade, 'resumo', c.resumo, 'responsavel', c.responsavel,
    'responsavel_nome', public.ri_nome(c.responsavel), 'proximo_passo', c.proximo_passo, 'proximo_em', c.proximo_em,
    'ativo', c.ativo, 'atualizado_em', c.atualizado_em,
    'ultima_interacao', (select max(i.data) from ri_interacoes i where i.contatos @> array[c.id]),
    'n_interacoes', (select count(*) from ri_interacoes i where i.contatos @> array[c.id])) $$;

create or replace function public.ri_relacao_json(r ri_relacoes)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', r.id, 'a', r.a, 'b', r.b, 'tags', to_jsonb(r.tags), 'sinal', r.sinal, 'forca', r.forca, 'nota', r.nota) $$;

-- 5. leitura -----------------------------------------------------------------------------------
-- tudo de uma vez: o mapa, a tabela e o kanban são o mesmo dado visto de jeitos diferentes
create or replace function public.ri_dados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok',
    'contatos', coalesce((select jsonb_agg(public.ri_contato_json(c) order by c.nome) from ri_contatos c), '[]'),
    'relacoes', coalesce((select jsonb_agg(public.ri_relacao_json(r) order by r.id) from ri_relacoes r), '[]'),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('registro', m.registro, 'nome', m.nome) order by m.nome)
                          from membros m where m.registro in (select public.ri_equipe())), '[]'),
    'indicacoes_novas', (select count(*) from ri_indicacoes where status in ('nova', 'em_analise')));
end $$;

create or replace function public.ri_contato_ler(p_id bigint)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c ri_contatos;
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into c from ri_contatos where id = p_id;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok',
    'contato', public.ri_contato_json(c) || jsonb_build_object('canais', c.canais, 'notas', c.notas, 'origem', c.origem,
      'criado_em', c.criado_em, 'criado_por_nome', public.ri_nome(c.criado_por), 'atualizado_por_nome', public.ri_nome(c.atualizado_por)),
    'interacoes', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'data', i.data, 'tipo', i.tipo, 'resumo', i.resumo,
        'contatos', to_jsonb(i.contatos), 'evento_id', i.evento_id, 'evento', (select nome from ri_eventos e where e.id = i.evento_id),
        'autor', i.autor, 'autor_nome', public.ri_nome(i.autor)) order by i.data desc, i.id desc)
        from ri_interacoes i where i.contatos @> array[c.id]), '[]'),
    'relacoes', coalesce((select jsonb_agg(public.ri_relacao_json(r) order by r.forca desc) from ri_relacoes r where c.id in (r.a, r.b)), '[]'),
    'membros', coalesce((select jsonb_agg(jsonb_build_object('id', m.id, 'nome', m.nome, 'cargo', m.cargo) order by m.nome)
        from ri_contatos m where m.organizacao_id = c.id), '[]'),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('id', e.id, 'nome', e.nome, 'inicio', e.inicio, 'status', e.status) order by e.inicio desc nulls last)
        from ri_eventos e where e.contatos @> array[c.id]), '[]'));
end $$;

-- 6. contatos --------------------------------------------------------------------------------
create or replace function public.ri_contato_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p->>'id', '')::bigint; v_eu integer := public.portal_registro_atual();
        v_nome text := btrim(coalesce(p->>'nome', '')); v_org bigint := nullif(p->>'organizacao_id', '')::bigint;
        v_nat text := coalesce(nullif(p->>'natureza', ''), 'pessoa'); v_canais jsonb := coalesce(p->'canais', '[]');
        c ri_contatos;
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if length(v_nome) = 0 or length(v_nome) > 160 then return jsonb_build_object('status', 'invalido', 'campo', 'nome'); end if;
  if v_nat not in ('pessoa', 'organizacao') then return jsonb_build_object('status', 'invalido', 'campo', 'natureza'); end if;
  if coalesce(p->>'funcao', 'stakeholder') <> all(public.ri_vocab('funcao')) then return jsonb_build_object('status', 'invalido', 'campo', 'funcao'); end if;
  if coalesce(p->>'estagio', 'identificado') <> all(public.ri_vocab('estagio')) then return jsonb_build_object('status', 'invalido', 'campo', 'estagio'); end if;
  if coalesce((p->>'proximidade')::int, 1) not between 1 and 5 then return jsonb_build_object('status', 'invalido', 'campo', 'proximidade'); end if;
  if (p->>'influencia') is not null and (p->>'influencia')::int not between 1 and 5 then return jsonb_build_object('status', 'invalido', 'campo', 'influencia'); end if;
  if (p->>'interesse') is not null and (p->>'interesse')::int not between 1 and 5 then return jsonb_build_object('status', 'invalido', 'campo', 'interesse'); end if;
  if jsonb_typeof(v_canais) <> 'array' or jsonb_array_length(v_canais) > 20 then return jsonb_build_object('status', 'invalido', 'campo', 'canais'); end if;
  if length(coalesce(p->>'notas', '')) > 20000 or length(coalesce(p->>'resumo', '')) > 600 then return jsonb_build_object('status', 'invalido', 'campo', 'notas'); end if;
  if v_org is not null and (v_org = v_id or not exists (select 1 from ri_contatos where id = v_org and natureza = 'organizacao')) then
    return jsonb_build_object('status', 'invalido', 'campo', 'organizacao_id'); end if;
  if v_id is null then
    insert into ri_contatos (natureza, nome, criado_por) values (v_nat, v_nome, v_eu) returning id into v_id;
  elsif not exists (select 1 from ri_contatos where id = v_id) then return jsonb_build_object('status', 'nao_encontrado');
  end if;
  update ri_contatos set natureza = v_nat, nome = v_nome,
    cargo = nullif(btrim(coalesce(p->>'cargo', '')), ''), organizacao_id = case when v_nat = 'pessoa' then v_org end,
    funcao = coalesce(nullif(p->>'funcao', ''), 'stakeholder'), proximidade = coalesce((p->>'proximidade')::int, 1),
    estagio = coalesce(nullif(p->>'estagio', ''), 'identificado'),
    influencia = (p->>'influencia')::int, interesse = (p->>'interesse')::int,
    tags = public.ri_lista_limpar(p->'tags'),
    canais = (select coalesce(jsonb_agg(jsonb_build_object('tipo', coalesce(x->>'tipo', 'outro'), 'valor', left(btrim(x->>'valor'), 300))), '[]')
                from jsonb_array_elements(v_canais) x where length(btrim(coalesce(x->>'valor', ''))) > 0),
    cidade = nullif(btrim(coalesce(p->>'cidade', '')), ''), resumo = nullif(btrim(coalesce(p->>'resumo', '')), ''),
    notas = nullif(btrim(coalesce(p->>'notas', '')), ''), origem = nullif(btrim(coalesce(p->>'origem', '')), ''),
    responsavel = nullif(p->>'responsavel', '')::int, proximo_passo = nullif(btrim(coalesce(p->>'proximo_passo', '')), ''),
    proximo_em = nullif(p->>'proximo_em', '')::date, ativo = coalesce((p->>'ativo')::boolean, true),
    atualizado_por = v_eu, atualizado_em = now()
   where id = v_id returning * into c;
  return jsonb_build_object('status', 'ok', 'id', c.id, 'contato', public.ri_contato_json(c));
end $$;

-- o kanban: só muda o estágio (e o arrastar não apaga mais nada)
create or replace function public.ri_contato_estagio(p_id bigint, p_estagio text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_estagio <> all(public.ri_vocab('estagio')) then return jsonb_build_object('status', 'invalido', 'campo', 'estagio'); end if;
  update ri_contatos set estagio = p_estagio, atualizado_por = public.portal_registro_atual(), atualizado_em = now() where id = p_id;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- excluir de vez (o titular pediu, ou o registro não tem mais finalidade): leva as relações e
-- tira o contato das interações e dos eventos; a interação que fica sem ninguém some
create or replace function public.ri_contato_excluir(p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not exists (select 1 from ri_contatos where id = p_id) then return jsonb_build_object('status', 'nao_encontrado'); end if;
  update ri_interacoes set contatos = array_remove(contatos, p_id) where contatos @> array[p_id];
  delete from ri_interacoes where cardinality(contatos) = 0;
  update ri_eventos set contatos = array_remove(contatos, p_id) where contatos @> array[p_id];
  delete from ri_contatos where id = p_id;
  return jsonb_build_object('status', 'ok');
end $$;

-- 7. relações ------------------------------------------------------------------------------------
create or replace function public.ri_relacao_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_a bigint := least((p->>'a')::bigint, (p->>'b')::bigint); v_b bigint := greatest((p->>'a')::bigint, (p->>'b')::bigint);
        v_sinal text := coalesce(nullif(p->>'sinal', ''), 'positiva'); r ri_relacoes;
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_a is null or v_b is null or v_a = v_b then return jsonb_build_object('status', 'invalido', 'campo', 'pontas'); end if;
  if (select count(*) from ri_contatos where id in (v_a, v_b)) <> 2 then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if v_sinal not in ('positiva', 'neutra', 'negativa') then return jsonb_build_object('status', 'invalido', 'campo', 'sinal'); end if;
  if coalesce((p->>'forca')::int, 3) not between 1 and 5 then return jsonb_build_object('status', 'invalido', 'campo', 'forca'); end if;
  insert into ri_relacoes (a, b, tags, sinal, forca, nota, criado_por)
  values (v_a, v_b, public.ri_lista_limpar(p->'tags', 12), v_sinal, coalesce((p->>'forca')::int, 3),
          nullif(btrim(coalesce(p->>'nota', '')), ''), public.portal_registro_atual())
  on conflict (a, b) do update set tags = excluded.tags, sinal = excluded.sinal, forca = excluded.forca, nota = excluded.nota, atualizado_em = now()
  returning * into r;
  return jsonb_build_object('status', 'ok', 'relacao', public.ri_relacao_json(r));
end $$;

create or replace function public.ri_relacao_excluir(p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  delete from ri_relacoes where id = p_id;
  return jsonb_build_object('status', case when found then 'ok' else 'nao_encontrado' end);
end $$;

-- 8. interações ----------------------------------------------------------------------------------
create or replace function public.ri_interacao_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p->>'id', '')::bigint; v_cs bigint[]; v_ev bigint := nullif(p->>'evento_id', '')::bigint;
        v_tipo text := coalesce(nullif(p->>'tipo', ''), 'reuniao'); v_res text := btrim(coalesce(p->>'resumo', ''));
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select coalesce(array_agg(distinct x::bigint), '{}') into v_cs from jsonb_array_elements_text(coalesce(p->'contatos', '[]')) x;
  if cardinality(v_cs) = 0 or (select count(*) from ri_contatos where id = any(v_cs)) <> cardinality(v_cs) then
    return jsonb_build_object('status', 'invalido', 'campo', 'contatos'); end if;
  if v_tipo <> all(public.ri_vocab('interacao')) then return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if length(v_res) = 0 or length(v_res) > 4000 then return jsonb_build_object('status', 'invalido', 'campo', 'resumo'); end if;
  if v_ev is not null and not exists (select 1 from ri_eventos where id = v_ev) then return jsonb_build_object('status', 'invalido', 'campo', 'evento_id'); end if;
  if v_id is null then
    insert into ri_interacoes (data, tipo, resumo, contatos, evento_id, autor)
    values (coalesce(nullif(p->>'data', '')::date, current_date), v_tipo, v_res, v_cs, v_ev, public.portal_registro_atual()) returning id into v_id;
  else
    update ri_interacoes set data = coalesce(nullif(p->>'data', '')::date, data), tipo = v_tipo, resumo = v_res, contatos = v_cs, evento_id = v_ev
     where id = v_id;
    if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  end if;
  -- o próximo passo, quando vem, vale para os contatos da interação
  if p ? 'proximo_passo' then
    update ri_contatos set proximo_passo = nullif(btrim(coalesce(p->>'proximo_passo', '')), ''), proximo_em = nullif(p->>'proximo_em', '')::date,
           atualizado_por = public.portal_registro_atual(), atualizado_em = now()
     where id = any(v_cs);
  end if;
  return jsonb_build_object('status', 'ok', 'id', v_id);
end $$;

create or replace function public.ri_interacao_excluir(p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  delete from ri_interacoes where id = p_id;
  return jsonb_build_object('status', case when found then 'ok' else 'nao_encontrado' end);
end $$;

-- 9. eventos de RI -------------------------------------------------------------------------------
create or replace function public.ri_evento_json(e ri_eventos)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', e.id, 'nome', e.nome, 'tipo', e.tipo, 'status', e.status, 'inicio', e.inicio, 'fim', e.fim,
    'local', e.local, 'modalidade', e.modalidade, 'link', e.link, 'organizador', e.organizador, 'objetivos', to_jsonb(e.objetivos),
    'publico', e.publico, 'custo', e.custo, 'participantes', to_jsonb(e.participantes),
    'participantes_nomes', coalesce((select jsonb_agg(m.nome order by m.nome) from membros m where m.registro = any(e.participantes)), '[]'),
    'contatos', to_jsonb(e.contatos),
    'contatos_lista', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'nome', c.nome, 'funcao', c.funcao) order by c.nome)
                                  from ri_contatos c where c.id = any(e.contatos)), '[]'),
    'resultados', e.resultados, 'avaliacao', e.avaliacao, 'notas', e.notas, 'atualizado_em', e.atualizado_em) $$;

create or replace function public.ri_eventos_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'eventos',
    coalesce((select jsonb_agg(public.ri_evento_json(e) order by e.inicio desc nulls first, e.id desc) from ri_eventos e), '[]'));
end $$;

create or replace function public.ri_evento_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_id bigint := nullif(p->>'id', '')::bigint; v_nome text := btrim(coalesce(p->>'nome', '')); e ri_eventos;
        v_ini date := nullif(p->>'inicio', '')::date; v_fim date := nullif(p->>'fim', '')::date;
        v_parts integer[]; v_cs bigint[];
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if length(v_nome) = 0 or length(v_nome) > 200 then return jsonb_build_object('status', 'invalido', 'campo', 'nome'); end if;
  if coalesce(p->>'tipo', 'outro') <> all(public.ri_vocab('evento_tipo')) then return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if coalesce(p->>'status', 'prospectado') <> all(public.ri_vocab('evento_status')) then return jsonb_build_object('status', 'invalido', 'campo', 'status'); end if;
  if coalesce(p->>'modalidade', 'presencial') not in ('presencial', 'online', 'hibrido') then return jsonb_build_object('status', 'invalido', 'campo', 'modalidade'); end if;
  if v_fim < v_ini then return jsonb_build_object('status', 'invalido', 'campo', 'fim'); end if;
  if (p->>'avaliacao') is not null and (p->>'avaliacao')::int not between 1 and 5 then return jsonb_build_object('status', 'invalido', 'campo', 'avaliacao'); end if;
  if nullif(p->>'link', '') is not null and (p->>'link') !~* '^https?://' then return jsonb_build_object('status', 'invalido', 'campo', 'link'); end if;
  select coalesce(array_agg(distinct x::int), '{}') into v_parts from jsonb_array_elements_text(coalesce(p->'participantes', '[]')) x
   where x::int in (select registro from membros);
  select coalesce(array_agg(distinct x::bigint), '{}') into v_cs from jsonb_array_elements_text(coalesce(p->'contatos', '[]')) x
   where x::bigint in (select id from ri_contatos);
  if v_id is null then
    insert into ri_eventos (nome, criado_por) values (v_nome, public.portal_registro_atual()) returning id into v_id;
  elsif not exists (select 1 from ri_eventos where id = v_id) then return jsonb_build_object('status', 'nao_encontrado');
  end if;
  update ri_eventos set nome = v_nome, tipo = coalesce(nullif(p->>'tipo', ''), 'outro'), status = coalesce(nullif(p->>'status', ''), 'prospectado'),
    inicio = v_ini, fim = v_fim, local = nullif(btrim(coalesce(p->>'local', '')), ''), modalidade = coalesce(nullif(p->>'modalidade', ''), 'presencial'),
    link = nullif(btrim(coalesce(p->>'link', '')), ''), organizador = nullif(btrim(coalesce(p->>'organizador', '')), ''),
    objetivos = public.ri_lista_limpar(p->'objetivos', 12), publico = nullif(btrim(coalesce(p->>'publico', '')), ''),
    custo = nullif(p->>'custo', '')::numeric, participantes = v_parts, contatos = v_cs,
    resultados = nullif(btrim(coalesce(p->>'resultados', '')), ''), avaliacao = (p->>'avaliacao')::int,
    notas = nullif(btrim(coalesce(p->>'notas', '')), ''), atualizado_por = public.portal_registro_atual(), atualizado_em = now()
   where id = v_id returning * into e;
  return jsonb_build_object('status', 'ok', 'id', e.id, 'evento', public.ri_evento_json(e));
end $$;

create or replace function public.ri_evento_excluir(p_id bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  delete from ri_eventos where id = p_id;
  return jsonb_build_object('status', case when found then 'ok' else 'nao_encontrado' end);
end $$;

-- 10. indicações (qualquer membro ativo) ----------------------------------------------------------
create or replace function public.ri_indicacao_json(i ri_indicacoes, p_completa boolean)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', i.id, 'tipo', i.tipo, 'dados', i.dados, 'status', i.status, 'resposta', i.resposta,
    'analisado_em', i.analisado_em, 'criado_em', i.criado_em)
    || case when p_completa then jsonb_build_object('autor', i.autor, 'autor_nome', public.ri_nome(i.autor),
         'analisado_por_nome', public.ri_nome(i.analisado_por), 'contato_id', i.contato_id, 'evento_id', i.evento_id)
       else '{}'::jsonb end $$;

create or replace function public.ri_indicar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_eu integer := public.portal_registro_atual(); v_tipo text := p->>'tipo'; d jsonb := coalesce(p->'dados', '{}');
        v_nome text := btrim(coalesce(d->>'nome', '')); v_id bigint;
begin
  if not public.conta_ativa() or v_eu is null then return jsonb_build_object('status', 'sem_permissao'); end if;
  if v_tipo not in ('contato', 'evento') then return jsonb_build_object('status', 'invalido', 'campo', 'tipo'); end if;
  if jsonb_typeof(d) <> 'object' or length(d::text) > 8000 then return jsonb_build_object('status', 'invalido', 'campo', 'dados'); end if;
  if length(v_nome) = 0 or length(v_nome) > 200 then return jsonb_build_object('status', 'invalido', 'campo', 'nome'); end if;
  if length(btrim(coalesce(d->>'por_que', ''))) = 0 then return jsonb_build_object('status', 'invalido', 'campo', 'por_que'); end if;
  -- uma pessoa não enche a fila: até 10 indicações abertas
  if (select count(*) from ri_indicacoes where autor = v_eu and status in ('nova', 'em_analise')) >= 10 then
    return jsonb_build_object('status', 'limite'); end if;
  insert into ri_indicacoes (tipo, autor, dados) values (v_tipo, v_eu, d) returning id into v_id;
  perform notificar(array(select public.ri_equipe()), 'ri_indicacao',
    case v_tipo when 'contato' then 'Nova indicação de contato' else 'Nova indicação de evento' end,
    coalesce(public.ri_nome(v_eu), 'Um membro') || ' indicou ' || v_nome || '.', '#/ri/indicacoes');
  return jsonb_build_object('status', 'ok', 'id', v_id);
end $$;

create or replace function public.ri_minhas_indicacoes()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.conta_ativa() or public.portal_registro_atual() is null then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'indicacoes',
    coalesce((select jsonb_agg(public.ri_indicacao_json(i, false) order by i.criado_em desc)
                from ri_indicacoes i where i.autor = public.portal_registro_atual()), '[]'));
end $$;

create or replace function public.ri_indicacoes_listar()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'indicacoes',
    coalesce((select jsonb_agg(public.ri_indicacao_json(i, true) order by (i.status in ('nova', 'em_analise')) desc, i.criado_em desc)
                from ri_indicacoes i), '[]'));
end $$;

-- analisar: 'em_analise' (avisa que alguém pegou), 'aceitar' (cria o contato ou o evento, se pedido) ou 'recusar'
create or replace function public.ri_indicacao_decidir(p_id bigint, p_acao text, p_resposta text default null, p_criar boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare i ri_indicacoes; v_eu integer := public.portal_registro_atual(); d jsonb; v_novo bigint; v_titulo text;
begin
  if not public.ri_pode() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into i from ri_indicacoes where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if i.status in ('aceita', 'recusada') then return jsonb_build_object('status', 'encerrada'); end if;
  if p_acao not in ('em_analise', 'aceitar', 'recusar') then return jsonb_build_object('status', 'invalido', 'campo', 'acao'); end if;
  if p_acao = 'recusar' and length(btrim(coalesce(p_resposta, ''))) = 0 then return jsonb_build_object('status', 'resposta_obrigatoria'); end if;
  d := i.dados;
  if p_acao = 'aceitar' and p_criar then
    if i.tipo = 'contato' then
      insert into ri_contatos (natureza, nome, cargo, funcao, resumo, origem, canais, criado_por, atualizado_por, responsavel)
      values (case when d->>'natureza' = 'organizacao' then 'organizacao' else 'pessoa' end, left(btrim(d->>'nome'), 160),
              nullif(btrim(coalesce(d->>'cargo', '')), ''),
              case when d->>'funcao' = any(public.ri_vocab('funcao')) then d->>'funcao' else 'stakeholder' end,
              left(nullif(btrim(coalesce(d->>'por_que', '')), ''), 600),
              'Indicação de ' || coalesce(public.ri_nome(i.autor), 'um membro')
                || coalesce(' (' || nullif(btrim(coalesce(d->>'relacao', '')), '') || ')', ''),
              case when length(btrim(coalesce(d->>'contato', ''))) > 0
                   then jsonb_build_array(jsonb_build_object('tipo', 'outro', 'valor', left(btrim(d->>'contato'), 300))) else '[]' end,
              v_eu, v_eu, v_eu)
      returning id into v_novo;
      update ri_indicacoes set contato_id = v_novo where id = i.id;
    else
      insert into ri_eventos (nome, inicio, local, link, organizador, notas, status, criado_por, atualizado_por)
      values (left(btrim(d->>'nome'), 200), case when d->>'data' ~ '^\d{4}-\d{2}-\d{2}$' then (d->>'data')::date end,
              nullif(btrim(coalesce(d->>'local', '')), ''),
              case when d->>'link' ~* '^https?://' then d->>'link' end, nullif(btrim(coalesce(d->>'organizador', '')), ''),
              'Indicação de ' || coalesce(public.ri_nome(i.autor), 'um membro') || ': ' || coalesce(d->>'por_que', ''),
              'avaliando', v_eu, v_eu)
      returning id into v_novo;
      update ri_indicacoes set evento_id = v_novo where id = i.id;
    end if;
  end if;
  update ri_indicacoes set status = case p_acao when 'em_analise' then 'em_analise' when 'aceitar' then 'aceita' else 'recusada' end,
         resposta = coalesce(nullif(btrim(coalesce(p_resposta, '')), ''), resposta), analisado_por = v_eu, analisado_em = now()
   where id = i.id;
  v_titulo := case p_acao when 'em_analise' then 'Sua indicação está em análise'
                          when 'aceitar' then 'Sua indicação foi aceita' else 'Sua indicação foi analisada' end;
  perform notificar(array[i.autor], 'ri_indicacao', v_titulo,
    'Relações institucionais: ' || coalesce(d->>'nome', 'indicação') || coalesce('. ' || nullif(btrim(coalesce(p_resposta, '')), ''), '.'),
    '#/servicos/indicar');
  return jsonb_build_object('status', 'ok', 'contato_id', case when i.tipo = 'contato' then v_novo end,
                                            'evento_id', case when i.tipo = 'evento' then v_novo end);
end $$;

-- 11. permissões -------------------------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['ri_equipe()', 'ri_nome(integer)', 'ri_contato_json(ri_contatos)', 'ri_evento_json(ri_eventos)',
                           'ri_indicacao_json(ri_indicacoes,boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['ri_pode()', 'ri_dados()', 'ri_contato_ler(bigint)', 'ri_contato_salvar(jsonb)', 'ri_contato_estagio(bigint,text)',
                           'ri_contato_excluir(bigint)', 'ri_relacao_salvar(jsonb)', 'ri_relacao_excluir(bigint)', 'ri_interacao_salvar(jsonb)',
                           'ri_interacao_excluir(bigint)', 'ri_eventos_listar()', 'ri_evento_salvar(jsonb)', 'ri_evento_excluir(bigint)',
                           'ri_indicar(jsonb)', 'ri_minhas_indicacoes()', 'ri_indicacoes_listar()', 'ri_indicacao_decidir(bigint,text,text,boolean)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.2_ri',
 'SOMA 2.19.2: Relações institucionais (contatos, organizações, relações, interações, eventos de RI e indicações pelos Serviços), só para NRO_RELAC e NRO_COORD_OFFICE')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select funcao, estagio, count(*) from public.ri_contatos group by 1, 2 order by 1, 2;
-- select m.nome from public.membros m where m.registro in (select public.ri_equipe());
