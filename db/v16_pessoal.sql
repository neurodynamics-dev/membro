-- ============================================================
-- SOMA 16.0 — MIGRAÇÃO · NeuroDynamics
-- O DEPTO DE PESSOAL PASSA A TRABALHAR NO QUADRO.
--
-- Até aqui, o que chegava para o Pessoal chegava em três caixas
-- separadas: solicitações numa tela, apontamentos em outra,
-- ocorrências na ficha de cada membro. Nada disso tinha dono,
-- prazo ou estado — e aprovar uma solicitação de acesso apenas
-- REGISTRAVA a decisão: conceder o acesso continuava sendo um
-- segundo passo manual, em outra tela, fácil de esquecer.
--
-- Esta migração faz três coisas:
--
--   a) toda solicitação, todo apontamento e toda ocorrência que
--      pede decisão viram EXATAMENTE UM cartão no quadro do
--      Depto de Pessoal — garantido por índice único, não por
--      disciplina de quem escreve o código;
--   b) o cartão que nasceu de uma solicitação de acesso decide E
--      concede na mesma transação: some o segundo passo;
--   c) o quadro do Pessoal vira um quadro RESERVADO. Uma
--      solicitação de afastamento ou de desligamento não pode
--      aparecer para a equipe inteira, e o quadro era público. A
--      15.0 traz a trava; aqui se diz em qual grupo ela fecha.
--
-- Pré-requisito: SOMA 15.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. PRÉ-REQUISITOS
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.atividades') is null or to_regclass('public.grupos') is null then
    raise exception using message = 'Falta aplicar o v15_atividades.sql antes desta migração.',
      detail = 'A 16.0 pendura os cartões de origem nas atividades criadas pela 15.0.';
  end if;
  if to_regprocedure('public.posso_ver_grupo(integer)') is null then
    raise exception using message = 'A v15_atividades.sql aplicada é anterior à do quadro reservado.',
      detail = 'Rode de novo a v15 (ela é idempotente) e depois esta.';
  end if;
  if to_regclass('public.portal_solicitacoes') is null then
    raise exception using message = 'Falta aplicar o soma_v10_portal.sql antes desta migração.',
      detail = 'A 16.0 transforma solicitação em cartão.';
  end if;
  if to_regclass('public.acessos_concedidos') is null then
    raise exception using message = 'Este banco não tem public.acessos_concedidos.',
      detail = 'A decisão da solicitação de acesso escreve nessa tabela.';
  end if;
end $$;

-- ============================================================
-- 1. O GRUPO DO DEPTO DE PESSOAL
--    A 15.0 já criou o vocabulário: "chave" dá nome estável a um
--    grupo que o sistema precisa encontrar sozinho, e "reservado"
--    fecha o quadro dele. Aqui só se escolhe QUEM é esse grupo.
--
--    O vocabulário mora lá, e não aqui, por um motivo prático: se
--    as duas migrações definissem a política de leitura, rodar a
--    15.0 de novo — coisa que ela mesma diz ser segura — devolvia
--    o quadro do Pessoal para "todo mundo lê", em silêncio. Cada
--    coisa tem uma dona só.
-- ------------------------------------------------------------
do $$
declare
  v_id   integer;
  v_pref text := 'DP';
  v_n    integer := 1;
begin
  select id into v_id from grupos where chave = 'pessoal';

  if v_id is null then
    -- um grupo já chamado "Pessoal", "Depto de Pessoal", "Gestão de Pessoas"…
    select id into v_id
      from grupos
     where translate(lower(nome),'áàâãäéèêëíìîïóòôõöúùûüç','aaaaaeeeeiiiiooooouuuuc')
           like any (array['%pessoal%','%pessoas%'])
     order by id
     limit 1;
  end if;

  if v_id is null then
    while exists (select 1 from grupos where prefixo = v_pref) loop
      v_n := v_n + 1; v_pref := 'DP' || v_n::text;
    end loop;
    insert into grupos (nome, prefixo, ordem)
    values ('Depto de Pessoal', v_pref, -1)
    returning id into v_id;
  end if;

  update grupos set chave = 'pessoal', reservado = true where id = v_id;
end $$;

-- Quem é o quadro do Pessoal, para as funções não repetirem a busca.
create or replace function public.grupo_pessoal()
returns integer language sql stable security definer
set search_path = public as $$
  select id from grupos where chave = 'pessoal';
$$;

-- ------------------------------------------------------------
-- 2. A FUNÇÃO QUE CRIA O CARTÃO DE ORIGEM
--    Idempotente: chamar duas vezes com a mesma origem devolve o
--    cartão que já existe, sem criar outro e sem notificar de novo.
-- ------------------------------------------------------------
create or replace function public.atividade_de_origem(
  p_tipo       text,
  p_origem_id  text,
  p_titulo     text,
  p_descricao  text          default null,
  p_prioridade text          default 'media',
  p_avisar     boolean       default false
) returns uuid language plpgsql volatile security definer
set search_path = public as $$
declare
  v_gid  integer := public.grupo_pessoal();
  v_seq  integer;
  v_cod  text;
  v_id   uuid;
  v_reg  integer := public.portal_registro_atual();
begin
  if v_gid is null or p_origem_id is null then return null; end if;

  select id into v_id from atividades
   where origem_tipo = p_tipo and origem_id = p_origem_id;
  if v_id is not null then return v_id; end if;

  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_gid);
  select coalesce(max(seq),0) + 1 into v_seq from atividades where grupo_id = v_gid;
  select prefixo || '-' || v_seq::text into v_cod from grupos where id = v_gid;

  insert into atividades (codigo, grupo_id, seq, titulo, descricao, status,
                          prioridade, criado_por, ordem, origem_tipo, origem_id)
  values (v_cod, v_gid, v_seq, left(p_titulo, 300), p_descricao, 'a_fazer',
          coalesce(p_prioridade,'media'), v_reg, extract(epoch from now()),
          p_tipo, p_origem_id)
  -- o índice é parcial, então o ON CONFLICT precisa repetir o predicado:
  -- sem ele o Postgres não encontra o índice e a inserção estoura
  on conflict (origem_tipo, origem_id) where origem_tipo is not null do nothing
  returning id into v_id;

  -- outra transação ganhou a corrida: fica com o cartão dela
  if v_id is null then
    select id into v_id from atividades
     where origem_tipo = p_tipo and origem_id = p_origem_id;
    return v_id;
  end if;

  -- o quadro inteiro do Pessoal segue o que chega nele
  insert into atividade_seguidores (atividade_id, registro)
  select v_id, m.registro
    from membros m
   where m.status in ('Ativo','Em pausa / avaliação')
     and m.grupos @> array[(select nome from grupos where id = v_gid)]
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_id, v_reg, 'criou', p_tipo, v_cod);

  -- Notifica só quando alguém está esperando resposta. Ocorrência
  -- que só precisa de leitura aparece no quadro e basta: canal de
  -- notificação que apita por tudo deixa de ser lido.
  if p_avisar then
    perform public.notificar(
      (select array_agg(m.registro) from membros m
        where m.status in ('Ativo','Em pausa / avaliação')
          and m.grupos @> array[(select nome from grupos where id = v_gid)]),
      'pessoal_' || p_tipo, v_cod || ' — ' || left(p_titulo, 160),
      p_descricao, '#/atividades/card/' || v_cod);
  end if;

  return v_id;
end $$;

revoke execute on function public.atividade_de_origem(text,text,text,text,text,boolean)
  from public, anon, authenticated;

-- ------------------------------------------------------------
-- 3. OS GATILHOS
-- ------------------------------------------------------------

-- 3a. Solicitação — sempre vira cartão, sempre avisa: tem gente esperando.
create or replace function public.tg_card_solicitacao()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_nome text; v_prio text;
begin
  select nome into v_nome from membros where registro = new.registro;
  v_prio := case when new.tipo in ('desligamento','afastamento') then 'alta' else 'media' end;
  perform public.atividade_de_origem(
    'solicitacao', new.id::text,
    coalesce(new.protocolo, 'Solicitação') || ' — ' || new.titulo,
    coalesce(v_nome,'Registro '||new.registro) || ' abriu uma solicitação de '
      || replace(new.tipo,'_',' ') || '.',
    v_prio, true);
  return null;
end $$;

drop trigger if exists tg_card_psol on public.portal_solicitacoes;
create trigger tg_card_psol after insert on public.portal_solicitacoes
  for each row execute function public.tg_card_solicitacao();

-- 3b. Ocorrência — vira cartão, menos quando é espelho de uma
--     mudança de ficha que já foi decidida. Mudar o cargo de
--     alguém gera ocorrência de "Mudança de cargo": isso é
--     histórico, não tarefa. Um desligamento, sim: alguém tem de
--     revogar os acessos.
create or replace function public.ocorrencia_espelho(p_tipo text)
returns boolean language sql immutable as $$
  select p_tipo in ('Ingresso','Mudança de status','Mudança de cargo',
                    'Mudança de departamento','Mudança de gestão',
                    'Adição a grupo','Remoção de grupo');
$$;

comment on function public.ocorrencia_espelho(text) is
  'Ocorrências que são só o espelho de uma mudança já feita na ficha. Não '
  'viram cartão — o quadro é de trabalho a fazer, não de histórico. Para '
  'passar a gerar cartão, tire o tipo desta lista.';

create or replace function public.tg_card_ocorrencia()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_nome text;
begin
  if public.ocorrencia_espelho(new.tipo) then return null; end if;
  select nome into v_nome from membros where registro = new.registro;
  perform public.atividade_de_origem(
    'ocorrencia', new.id::text,
    new.tipo || ' — ' || coalesce(v_nome, 'Registro '||new.registro),
    new.descricao,
    case when new.tipo in ('Desligamento','Sinalização reincidente')
         then 'alta' else 'media' end,
    new.tipo in ('Desligamento','Sinalização reincidente'));
  return null;
end $$;

do $$
begin
  if to_regclass('public.ocorrencias') is not null then
    drop trigger if exists tg_card_ocorr on public.ocorrencias;
    create trigger tg_card_ocorr after insert on public.ocorrencias
      for each row execute function public.tg_card_ocorrencia();
  end if;
end $$;

-- 3c. Apontamento — um cartão por apontamento entregue. Os itens
--     entram depois do cabeçalho, então quem sinaliza é o gatilho
--     do item: ele marca o cartão que já existe.
create or replace function public.tg_card_apontamento()
returns trigger language plpgsql security definer
set search_path = public as $$
begin
  perform public.atividade_de_origem(
    'apontamento', new.id::text,
    'Apontamento — ' || coalesce(new.grupo,'sem grupo') || ' — '
      || to_char(coalesce(new.data, current_date), 'DD/MM/YYYY'),
    'Apontamento semanal entregue por ' || coalesce(new.responsavel,'—') || '.',
    'media', false);
  return null;
end $$;

create or replace function public.tg_card_apontamento_item()
returns trigger language plpgsql security definer
set search_path = public as $$
declare v_id uuid; v_n integer; v_cod text; v_nome text;
begin
  if not coalesce(new.sinalizado, false) then return null; end if;

  select a.id, a.codigo into v_id, v_cod from atividades a
   where a.origem_tipo = 'apontamento' and a.origem_id = new.apontamento_id::text;
  if v_id is null then return null; end if;

  select count(*) into v_n from apontamento_itens
   where apontamento_id = new.apontamento_id and sinalizado;
  select nome into v_nome from membros where registro = new.registro;

  update atividades
     set sinalizada = true,
         sinalizada_motivo = v_n || ' sinalização(ões) no apontamento',
         sinalizada_em = coalesce(sinalizada_em, now()),
         prioridade = 'alta',
         atualizado_em = now()
   where id = v_id;

  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_id, public.portal_registro_atual(), 'sinalizou', 'apontamento',
          coalesce(v_nome, 'Registro '||new.registro));

  return null;
end $$;

do $$
begin
  if to_regclass('public.apontamentos') is not null then
    drop trigger if exists tg_card_apont on public.apontamentos;
    create trigger tg_card_apont after insert on public.apontamentos
      for each row execute function public.tg_card_apontamento();
  end if;
  if to_regclass('public.apontamento_itens') is not null then
    drop trigger if exists tg_card_apont_item on public.apontamento_itens;
    create trigger tg_card_apont_item after insert on public.apontamento_itens
      for each row execute function public.tg_card_apontamento_item();
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. O QUE JÁ ESTAVA ABERTO ENTRA NO QUADRO
--    Só as solicitações em aberto: apontamento e ocorrência de
--    meses atrás viram centenas de cartões concluídos no dia um,
--    e um quadro que nasce cheio de lixo não é usado.
-- ------------------------------------------------------------
do $$
declare r record;
begin
  for r in
    select s.id, s.protocolo, s.titulo, s.tipo, s.registro, m.nome
      from portal_solicitacoes s
      left join membros m on m.registro = s.registro
     where s.status in ('aberta','em_analise')
     order by s.criado_em
  loop
    perform public.atividade_de_origem(
      'solicitacao', r.id::text,
      coalesce(r.protocolo,'Solicitação') || ' — ' || r.titulo,
      coalesce(r.nome,'Registro '||r.registro) || ' abriu uma solicitação de '
        || replace(r.tipo,'_',' ') || '.',
      case when r.tipo in ('desligamento','afastamento') then 'alta' else 'media' end,
      false);
  end loop;
end $$;

-- ============================================================
-- 5. A DECISÃO — onde os dois passos viram um
--
--    Antes: aprovar a solicitação gravava "aprovada" e mais nada;
--    conceder o acesso era ir até a ficha do membro, aba Acessos,
--    e clicar de novo. Quem esquecia o segundo passo deixava a
--    pessoa com um "aprovado" que não abria porta nenhuma.
--
--    Agora é uma transação: responde, concede (ou revoga), anota
--    no histórico do cartão, avisa quem pediu e fecha o cartão.
--    Ou acontece tudo, ou não acontece nada.
-- ------------------------------------------------------------
create or replace function public.pessoal_solicitacao_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_quem   text;
  v_sol    portal_solicitacoes%rowtype;
  v_dec    text := nullif(p->>'decisao','');
  v_resp   text := nullif(trim(p->>'resposta'),'');
  v_conc   uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(
                                coalesce(p->'conceder','[]'::jsonb)) x), '{}');
  v_revo   uuid[] := coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(
                                coalesce(p->'revogar','[]'::jsonb)) x), '{}');
  v_card   atividades%rowtype;
  v_nomes  text;
  v_n      integer := 0;
begin
  if public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_dec not in ('em_analise','aprovada','recusada','concluida','cancelada') then
    return jsonb_build_object('status','invalido','campo','decisao');
  end if;

  select * into v_sol from portal_solicitacoes
   where id = (p->>'solicitacao_id')::uuid for update;
  if not found then return jsonb_build_object('status','nao_encontrada'); end if;

  select nome into v_quem from membros where registro = v_reg;
  v_quem := coalesce(v_quem, 'Depto de Pessoal');

  -- a resposta é obrigatória quando se recusa: ninguém merece um
  -- "recusada" sem uma linha de explicação
  if v_dec = 'recusada' and v_resp is null then
    return jsonb_build_object('status','invalido','campo','resposta');
  end if;

  update portal_solicitacoes
     set status         = v_dec,
         resposta       = coalesce(v_resp, resposta),
         respondido_por = v_quem,
         respondido_em  = now()
   where id = v_sol.id;

  -- concede o que foi marcado, com a mesma forma que a ficha usa
  if array_length(v_conc,1) is not null then
    insert into acessos_concedidos (registro, item_id, ativo, concedido_em, revogado_em, responsavel)
    select v_sol.registro, i, true, current_date, null, v_quem from unnest(v_conc) i
    on conflict (registro, item_id) do update
      set ativo = true, concedido_em = current_date,
          revogado_em = null, responsavel = excluded.responsavel;
    v_n := v_n + array_length(v_conc,1);
  end if;

  if array_length(v_revo,1) is not null then
    update acessos_concedidos
       set ativo = false, revogado_em = current_date, responsavel = v_quem
     where registro = v_sol.registro and item_id = any(v_revo) and ativo;
  end if;

  select string_agg(nome, ', ' order by nome) into v_nomes
    from itens_de_acesso where id = any(v_conc);

  -- o cartão: histórico, fecho e aviso
  select * into v_card from atividades
   where origem_tipo = 'solicitacao' and origem_id = v_sol.id::text;

  if found then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_card.id, v_reg, 'decidiu', 'solicitacao', v_sol.status, v_dec);

    if v_nomes is not null then
      insert into atividade_log (atividade_id, registro, tipo, campo, para)
      values (v_card.id, v_reg, 'concedeu', 'acesso', v_nomes);
    end if;

    if v_resp is not null then
      insert into atividade_comentarios (atividade_id, registro, corpo)
      values (v_card.id, v_reg, v_resp);
    end if;

    if v_dec in ('aprovada','recusada','concluida','cancelada') then
      update atividades
         set status = 'concluida', concluida_em = now(), atualizado_em = now()
       where id = v_card.id;
    end if;
  end if;

  perform public.notificar(array[v_sol.registro], 'solicitacao_respondida',
    coalesce(v_sol.protocolo,'Sua solicitação') || ' — ' ||
      case v_dec when 'aprovada' then 'aprovada' when 'recusada' then 'recusada'
                 when 'em_analise' then 'em análise' else v_dec end,
    coalesce(v_resp, 'O Depto de Pessoal respondeu a sua solicitação.')
      || case when v_nomes is not null then ' Acesso liberado: ' || v_nomes || '.' else '' end,
    '#/servicos/solicitacoes');

  return jsonb_build_object('status','ok','decisao',v_dec,'concedidos',v_n,
                            'codigo', v_card.codigo);
end $$;

revoke execute on function public.pessoal_solicitacao_decidir(jsonb) from public, anon;
grant  execute on function public.pessoal_solicitacao_decidir(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 5b. O QUE A TELA DO CARTÃO PRECISA SABER DA ORIGEM
--     security definer porque quem está no grupo do Pessoal sem
--     ser admin não lê portal_solicitacoes pela RLS — mas precisa
--     ver o que veio decidir. A porta é estreita: só devolve se
--     quem chamou enxerga o cartão.
-- ------------------------------------------------------------
create or replace function public.atividade_origem_detalhe(p_codigo text)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  v_card atividades%rowtype;
  v_out  jsonb;
begin
  select * into v_card from atividades where codigo = p_codigo;
  if not found or v_card.origem_tipo is null then return null; end if;
  if not public.posso_ver_grupo(v_card.grupo_id) then
    return jsonb_build_object('tipo', v_card.origem_tipo, 'status','sem_permissao');
  end if;

  if v_card.origem_tipo = 'solicitacao' then
    select jsonb_build_object(
      'tipo','solicitacao', 'id', s.id, 'protocolo', s.protocolo,
      'titulo', s.titulo, 'especie', s.tipo, 'status', s.status,
      'dados', s.dados, 'resposta', s.resposta,
      'respondido_por', s.respondido_por, 'respondido_em', s.respondido_em,
      'criado_em', s.criado_em,
      'registro', s.registro, 'membro', m.nome,
      'acessos', coalesce((
        select jsonb_agg(jsonb_build_object('item_id', ac.item_id, 'ativo', ac.ativo))
          from acessos_concedidos ac where ac.registro = s.registro), '[]'::jsonb))
      into v_out
      from portal_solicitacoes s
      left join membros m on m.registro = s.registro
     where s.id = v_card.origem_id::uuid;

  elsif v_card.origem_tipo = 'ocorrencia' and to_regclass('public.ocorrencias') is not null then
    execute $q$
      select jsonb_build_object('tipo','ocorrencia', 'id', o.id, 'especie', o.tipo,
             'descricao', o.descricao, 'data', o.data, 'responsavel', o.responsavel,
             'registro', o.registro, 'membro', m.nome)
        from ocorrencias o left join membros m on m.registro = o.registro
       where o.id::text = $1 $q$
      into v_out using v_card.origem_id;

  elsif v_card.origem_tipo = 'apontamento' and to_regclass('public.apontamentos') is not null then
    execute $q$
      select jsonb_build_object('tipo','apontamento', 'id', a.id, 'grupo', a.grupo,
             'data', a.data, 'responsavel', a.responsavel,
             'itens', coalesce((
               select jsonb_agg(jsonb_build_object('membro', mm.nome, 'registro', it.registro,
                      'assiduidade', it.assiduidade, 'entregas', it.entregas,
                      'sinalizado', it.sinalizado, 'justificativa', it.justificativa)
                      order by mm.nome)
                 from apontamento_itens it
                 left join membros mm on mm.registro = it.registro
                where it.apontamento_id = a.id), '[]'::jsonb))
        from apontamentos a where a.id::text = $1 $q$
      into v_out using v_card.origem_id;
  end if;

  return v_out;
end $$;

revoke execute on function public.atividade_origem_detalhe(text) from public, anon;
grant  execute on function public.atividade_origem_detalhe(text) to authenticated;

-- ============================================================
-- 6. NOTIFICAÇÃO POR E-MAIL
--    O sininho só avisa quem está com o portal aberto. Quem entra
--    uma vez por semana descobre a atividade atrasada na semana
--    seguinte — e a culpa cai no quadro, não no canal.
--
--    O envio é da Edge Function "notificar-email", que roda em
--    intervalo e pergunta ao banco quem tem o que receber. Toda a
--    regra de QUEM recebe O QUÊ mora aqui, num lugar só.
-- ------------------------------------------------------------
alter table public.notificacoes add column if not exists email_em        timestamptz;
alter table public.notificacoes add column if not exists email_erro      text;
alter table public.notificacoes add column if not exists email_tentativas smallint not null default 0;

create index if not exists notif_email_ix on public.notificacoes (criado_em)
  where email_em is null and email_tentativas < 5;

create table if not exists public.notificacao_preferencias (
  registro      integer primary key references public.membros(registro) on delete cascade,
  email_modo    text not null default 'imediato'
                check (email_modo in ('imediato','resumo','nunca')),
  ultimo_email  timestamptz,
  atualizado_em timestamptz not null default now()
);

comment on table public.notificacao_preferencias is
  'Como cada pessoa quer receber por e-mail. Quem não tem linha aqui recebe '
  'no modo "imediato" — a ausência de preferência não pode virar silêncio.';

alter table public.notificacao_preferencias enable row level security;
drop policy if exists notifp_select on public.notificacao_preferencias;
create policy notifp_select on public.notificacao_preferencias
  for select to authenticated
  using (registro = public.portal_registro_atual()
         or public.papel_atual() in ('admin','pessoal'));

-- Escrita só pela função: assim "ultimo_email" não é editável pelo cliente.
create or replace function public.notificacao_preferencia_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_m text := nullif(p->>'email_modo','');
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_m not in ('imediato','resumo','nunca') then
    return jsonb_build_object('status','invalido','campo','email_modo');
  end if;
  insert into notificacao_preferencias (registro, email_modo)
  values (v_reg, v_m)
  on conflict (registro) do update
    set email_modo = excluded.email_modo, atualizado_em = now();
  return jsonb_build_object('status','ok','email_modo',v_m);
end $$;
revoke execute on function public.notificacao_preferencia_salvar(jsonb) from public, anon;
grant  execute on function public.notificacao_preferencia_salvar(jsonb) to authenticated;

-- 6b. O lote a enviar, já agrupado por pessoa.
--     "imediato" leva o que estiver pendente. "resumo" só entra se
--     faz mais de 20h desde o último e-mail — é digest, não fila.
--     Desde a 18.0 a dona é ela (e, depois, a 23.0): a definição
--     abaixo só vale enquanto a 18.0 não passou. Rodar a 16.0 de novo
--     apagava a exceção do e-mail de teste sem erro nenhum.
do $$
begin
  if to_regprocedure('public.notificacao_teste()') is null then
    execute $f$
    create or replace function public.notificacoes_email_lote(p_limite integer default 200)
    returns jsonb language sql stable security definer
    set search_path = public as $g$
      with alvo as (
        select n.*, m.nome, coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) as email,
               coalesce(pr.email_modo, 'imediato') as modo, pr.ultimo_email
          from notificacoes n
          join membros m on m.registro = n.registro
          left join notificacao_preferencias pr on pr.registro = n.registro
         where n.email_em is null
           and n.email_tentativas < 5
           and m.status in ('Ativo','Em pausa / avaliação')
           and coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) is not null
           and coalesce(pr.email_modo,'imediato') <> 'nunca'
           and (coalesce(pr.email_modo,'imediato') = 'imediato'
                or pr.ultimo_email is null
                or pr.ultimo_email < now() - interval '20 hours')
         order by n.criado_em
         limit greatest(coalesce(p_limite,200), 1)
      )
      select coalesce(jsonb_agg(p order by p->>'nome'), '[]'::jsonb) from (
        select jsonb_build_object(
                 'registro', registro, 'nome', nome, 'email', email, 'modo', modo,
                 'itens', jsonb_agg(jsonb_build_object(
                   'id', id, 'tipo', tipo, 'titulo', titulo,
                   'corpo', corpo, 'href', href, 'criado_em', criado_em)
                   order by criado_em)) as p
          from alvo group by registro, nome, email, modo
      ) q;
    $g$
    $f$;
  end if;
end $$;

-- 6c. A baixa. Marca o que saiu e o que falhou, e move o relógio
--     do resumo só de quem realmente recebeu.
create or replace function public.notificacoes_email_baixa(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_ok  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(
                               coalesce(p->'enviadas','[]'::jsonb)) x), '{}');
  v_er  bigint[] := coalesce((select array_agg(x::bigint) from jsonb_array_elements_text(
                               coalesce(p->'falhas','[]'::jsonb)) x), '{}');
  v_msg text := left(coalesce(p->>'erro',''), 500);
  v_n   integer := 0;
begin
  if array_length(v_ok,1) is not null then
    update notificacoes set email_em = now(), email_erro = null
     where id = any(v_ok) and email_em is null;
    get diagnostics v_n = row_count;

    insert into notificacao_preferencias (registro, ultimo_email)
    select distinct registro, now() from notificacoes where id = any(v_ok)
    on conflict (registro) do update set ultimo_email = now();
  end if;

  if array_length(v_er,1) is not null then
    update notificacoes
       set email_tentativas = email_tentativas + 1,
           email_erro = nullif(v_msg,'')
     where id = any(v_er) and email_em is null;
  end if;

  return jsonb_build_object('status','ok','enviadas',v_n);
end $$;

-- Nenhuma das duas é para o cliente: quem chama é a Edge Function,
-- com a service role. Sem grant para authenticated, de propósito.
revoke execute on function public.notificacoes_email_lote(integer)  from public, anon, authenticated;
revoke execute on function public.notificacoes_email_baixa(jsonb)   from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notificacoes_email_lote(integer) to service_role;
    grant execute on function public.notificacoes_email_baixa(jsonb)  to service_role;
  end if;
end $$;

-- ============================================================
-- 7. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v16_pessoal', 'Solicitação, apontamento e ocorrência viram cartão no quadro do Pessoal; decisão concede acesso na mesma transação; quadro reservado; notificação por e-mail')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 16.0
--
-- Depois de rodar, confira o grupo que ficou com a chave:
--
--   select id, nome, prefixo, reservado from public.grupos where chave = 'pessoal';
--
-- Se ele adotou um grupo errado (a busca aceita "pessoal" e
-- "pessoas" no nome), mova a chave:
--
--   update public.grupos set chave = null, reservado = false where chave = 'pessoal';
--   update public.grupos set chave = 'pessoal', reservado = true where nome = 'O certo';
--
-- E lembre: quem está no quadro do Pessoal é quem tem esse grupo
-- em membros.grupos — a ficha de cada pessoa é que dá entrada no
-- quadro reservado.
-- ============================================================
