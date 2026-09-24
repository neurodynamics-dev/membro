-- ============================================================
-- SOMA 23.0 — MIGRAÇÃO · NeuroDynamics
-- STUDIO: criação e planejamento de conteúdo digital.
--
-- O Studio é o espaço da comunicação. A primeira parte é o
-- CRIADOR (a arte, desenhada no navegador, em mod-criador.js); a
-- segunda é o PLANEJAMENTO, que é o que mora aqui:
--
--   PUBLICAÇÃO   uma peça com plano: onde (redes), quando, formato,
--                legenda, notas para quem publica, contas de collab.
--                Tem código (POST-14), como toda coisa que a equipe
--                cita em voz alta, e anda por cinco colunas:
--
--      ideia → produção → aprovação → pronta → publicada
--
--   Ideia é esboço: às vezes só uma frase e o tipo de publicação,
--   sem data. "Pronta para publicar" NÃO se alcança movendo o
--   cartão: só a aprovação do grupo aprovador leva até lá — e quem
--   mandou para aprovação não aprova a própria. Mexer na arte ou na
--   legenda de uma publicação aprovada devolve para aprovação: o
--   que foi aprovado era a versão anterior.
--
--   LEMBRETE     na véspera da data marcada, quem responde pela
--                publicação recebe um aviso no sino e por e-mail
--                (studio_lembretes, agendada no pg_cron quando ele
--                existe). É o único aviso do Studio que sai por
--                e-mail mesmo para quem escolheu resumo ou "só no
--                portal": é compromisso com dia marcado.
--
--   CONFIGURAÇÃO quais grupos entram no Studio, quais aprovam,
--                quantas aprovações bastam, as contas da equipe em
--                cada rede e a chave do Unsplash.
--
--   RECURSOS     os bancos de imagens da equipe: pastas, álbuns
--                compartilhados, repositórios com fotos nossas.
--
--   IMPRENSA     a porta dos fundos da seção "Quem somos" do site
--                institucional (e da página "A NeuroDynamics" do site
--                do processo seletivo): os vídeos e as matérias em
--                que aparecemos. Os dois sites leem por
--                site_imprensa_publico(), com a chave anon.
--
-- Os arquivos das artes ficam no bucket privado "studio" do
-- Storage, uma pasta por publicação.
--
-- Pré-requisitos: SOMA 19.0 (grupos em árvore) e 16.0 (e-mail).
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a v19 antes desta migração.',
      detail = 'O Studio usa grupos_de(), da 19.0, para dizer quem entra e quem aprova.';
  end if;
  if to_regclass('public.notificacao_preferencias') is null then
    raise exception using message = 'Falta aplicar a v16 antes desta migração.',
      detail = 'O lembrete da véspera sai pelo mesmo e-mail dos avisos do portal, que nasce na 16.0.';
  end if;
end $$;

-- O nome de quem age. (Igual a doc_meu_nome, da 20.0 — repetido
-- aqui para o Studio não depender dos arquivos.)
create or replace function public.studio_meu_nome()
returns text language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select nome from membros where registro = public.portal_registro_atual()),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email',
    'Portal');
$$;

-- ============================================================
-- 1. CONFIGURAÇÃO — uma linha só
-- ------------------------------------------------------------
create table if not exists public.studio_config (
  id                 boolean primary key default true check (id),
  grupos_acesso      integer[] not null default '{}',
  grupos_aprovadores integer[] not null default '{}',
  aprovacoes_minimas integer   not null default 1 check (aprovacoes_minimas between 1 and 3),
  lembrete_email     boolean   not null default true,
  contas             jsonb     not null default '{}'::jsonb,   -- {"instagram":"@…","linkedin":"…"}
  unsplash_chave     text,                                     -- Access Key (a pública)
  atualizado_em      timestamptz not null default now(),
  atualizado_por     text
);
insert into public.studio_config (id) values (true) on conflict (id) do nothing;

comment on table public.studio_config is
  'Uma linha. Sem grupo de acesso, só admin e quem aprova entram no Studio; '
  'sem grupo aprovador, quem aprova é admin.';

-- Semente: o grupo de comunicação, se existir, entra com acesso. Os
-- aprovadores ficam para a gestão escolher — aprovação é decisão.
do $$
declare v_id integer;
begin
  if (select cardinality(grupos_acesso) from studio_config) = 0 then
    select id into v_id from grupos
     where ativo is not false
       and nome ~* '(marketing|comunica|\mmkt\M)'
     order by id limit 1;
    if v_id is not null then
      update studio_config set grupos_acesso = array[v_id];
    end if;
  end if;
end $$;

-- ============================================================
-- 2. QUEM ENTRA, QUEM APROVA, QUEM CONFIGURA
--    Tudo pela pertença efetiva (grupos_de, da 19.0): quem está num
--    subgrupo de um grupo aprovador aprova.
-- ------------------------------------------------------------
create or replace function public.studio_pode_aprovar()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() = 'admin'
      or coalesce((select public.grupos_de(public.portal_registro_atual()) && c.grupos_aprovadores
                     from studio_config c), false);
$$;

create or replace function public.studio_pode_acessar()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.studio_pode_aprovar()
      or coalesce((select public.grupos_de(public.portal_registro_atual()) && c.grupos_acesso
                     from studio_config c), false);
$$;

-- Configurar é de quem aprova (e de admin): é a gestão da comunicação.
create or replace function public.studio_gestor()
returns boolean language sql stable security definer
set search_path = public as $$ select public.studio_pode_aprovar() $$;

-- Os registros de quem aprova, para avisar. Sem grupo aprovador,
-- os admins que têm registro.
create or replace function public.studio_aprovadores()
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(
    (select array_agg(m.registro order by m.registro)
       from membros m, studio_config c
      where cardinality(c.grupos_aprovadores) > 0
        and m.status in ('Ativo','Em pausa / avaliação')
        and public.grupos_de(m.registro) && c.grupos_aprovadores),
    (select array_agg(distinct p.registro)
       from perfis p, studio_config c
      where cardinality(c.grupos_aprovadores) = 0
        and p.papel = 'admin' and p.registro is not null),
    '{}');
$$;

revoke execute on function public.studio_pode_aprovar() from public, anon;
revoke execute on function public.studio_pode_acessar() from public, anon;
revoke execute on function public.studio_gestor()       from public, anon;
revoke execute on function public.studio_aprovadores()  from public, anon, authenticated;
grant  execute on function public.studio_pode_aprovar() to authenticated;
grant  execute on function public.studio_pode_acessar() to authenticated;
grant  execute on function public.studio_gestor()       to authenticated;

alter table public.studio_config enable row level security;
-- Toda a equipe lê: o menu precisa saber, no login, se o Studio
-- aparece. Não há segredo aqui — a chave do Unsplash é a de acesso,
-- a que o próprio Unsplash manda usar no navegador.
drop policy if exists studio_config_select on public.studio_config;
create policy studio_config_select on public.studio_config
  for select to authenticated using (true);
drop policy if exists studio_config_update on public.studio_config;
create policy studio_config_update on public.studio_config
  for update to authenticated
  using (public.studio_gestor()) with check (public.studio_gestor());
grant select, update on public.studio_config to authenticated;

create or replace function public.studio_config_carimbo()
returns trigger language plpgsql as $$
begin
  new.id := true;
  new.atualizado_em := now();
  new.atualizado_por := public.studio_meu_nome();
  return new;
end $$;
drop trigger if exists tg_studio_config_carimbo on public.studio_config;
create trigger tg_studio_config_carimbo before update on public.studio_config
  for each row execute function public.studio_config_carimbo();

-- ============================================================
-- 3. PUBLICAÇÕES
-- ------------------------------------------------------------
create table if not exists public.studio_publicacoes (
  id                  uuid primary key default gen_random_uuid(),
  numero              integer generated always as identity,
  codigo              text generated always as ('POST-' || numero) stored,
  titulo              text not null check (length(trim(titulo)) > 0),
  status              text not null default 'ideia'
                        check (status in ('ideia','producao','aprovacao','pronta','publicada','arquivada')),
  modelo              text,                      -- o modelo do criador (na_midia, aniversario…)
  categoria           text,                      -- o que é: aniversário, na mídia, projeto…
  pilar               text check (pilar in ('educar','inspirar','conectar','entreter','institucional','convidar')),
  redes               text[] not null default '{}',
  formato             text,                      -- feed, carrossel, stories, reels, documento, texto…
  data_publicacao     timestamptz,
  legenda             text,
  primeiro_comentario text,
  texto_alt           text,
  colaboradores       text,                      -- @contas a convidar como collab / marcar
  notas               text,                      -- para quem for publicar
  responsavel         integer references public.membros(registro) on delete set null,
  criado_por          integer references public.membros(registro) on delete set null,
  peca                jsonb,                     -- o estado do criador, para reabrir a arte
  imagens             jsonb not null default '[]'::jsonb,   -- [{caminho, largura, altura, tipo}]
  versao              integer not null default 1,
  enviado_por         integer references public.membros(registro) on delete set null,
  enviado_em          timestamptz,
  aprovado_em         timestamptz,
  link                text,                      -- onde ficou publicado
  publicado_em        timestamptz,
  lembrete_em         timestamptz,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);
create unique index if not exists studio_pub_numero on public.studio_publicacoes (numero);
create index if not exists studio_pub_data   on public.studio_publicacoes (data_publicacao);
create index if not exists studio_pub_status on public.studio_publicacoes (status);

create table if not exists public.studio_aprovacoes (
  id             bigserial primary key,
  publicacao_id  uuid not null references public.studio_publicacoes(id) on delete cascade,
  versao         integer not null,
  registro       integer references public.membros(registro) on delete set null,
  nome           text,
  decisao        text not null check (decisao in ('aprovada','devolvida')),
  parecer        text,
  criado_em      timestamptz not null default now()
);
create unique index if not exists studio_aprov_uma on public.studio_aprovacoes (publicacao_id, versao, registro)
  where decisao = 'aprovada';

create table if not exists public.studio_historico (
  id             bigserial primary key,
  publicacao_id  uuid not null references public.studio_publicacoes(id) on delete cascade,
  registro       integer,
  nome           text,
  acao           text not null,
  detalhe        text,
  criado_em      timestamptz not null default now()
);
create index if not exists studio_hist_pub on public.studio_historico (publicacao_id, criado_em);

create or replace function public.studio_aprovacoes_validas(p_id uuid)
returns integer language sql stable security definer
set search_path = public as $$
  select count(distinct a.registro)::integer
    from studio_aprovacoes a join studio_publicacoes p on p.id = a.publicacao_id
   where a.publicacao_id = p_id and a.versao = p.versao and a.decisao = 'aprovada';
$$;

create or replace function public.studio_rotulo_status(s text)
returns text language sql immutable as $$
  select case s when 'ideia' then 'Ideias' when 'producao' then 'Em produção'
    when 'aprovacao' then 'Em aprovação' when 'pronta' then 'Pronta para publicar'
    when 'publicada' then 'Publicada' when 'arquivada' then 'Arquivada' else s end;
$$;

-- As regras que nenhuma tela pode furar. Moram num gatilho para
-- valerem para qualquer caminho de escrita, não só para as funções.
create or replace function public.studio_pub_regras()
returns trigger language plpgsql
set search_path = public as $$
declare v_min integer := coalesce((select aprovacoes_minimas from studio_config), 1);
begin
  if tg_op = 'INSERT' then
    if new.status not in ('ideia','producao') then
      raise exception using errcode = 'P0001', message = 'studio_status_inicial',
        detail = 'Publicação nasce como ideia ou em produção.';
    end if;
    new.versao := 1;
    return new;
  end if;

  new.criado_em := old.criado_em;
  new.criado_por := old.criado_por;
  new.atualizado_em := now();

  -- mudou a arte ou a legenda: é outra versão, e a aprovação que
  -- havia era da anterior
  if (new.peca is distinct from old.peca or new.imagens is distinct from old.imagens
      or new.legenda is distinct from old.legenda) then
    new.versao := old.versao + 1;
    if old.status = 'pronta' and new.status = 'pronta' then
      new.status := 'aprovacao';
      new.aprovado_em := null;
    end if;
  else
    new.versao := old.versao;
  end if;

  if new.data_publicacao is distinct from old.data_publicacao then
    new.lembrete_em := null;
  end if;

  if new.status = 'pronta' and old.status is distinct from 'pronta' then
    if (select count(distinct a.registro) from studio_aprovacoes a
         where a.publicacao_id = new.id and a.versao = new.versao and a.decisao = 'aprovada') < v_min then
      raise exception using errcode = 'P0001', message = 'studio_sem_aprovacao',
        detail = 'Só a aprovação do grupo aprovador deixa uma publicação pronta para publicar.';
    end if;
  end if;
  if new.status = 'publicada' and old.status not in ('pronta','publicada') then
    raise exception using errcode = 'P0001', message = 'studio_sem_aprovacao',
      detail = 'Só publicação aprovada vai para publicada.';
  end if;
  return new;
end $$;
drop trigger if exists tg_studio_pub_regras on public.studio_publicacoes;
create trigger tg_studio_pub_regras before insert or update on public.studio_publicacoes
  for each row execute function public.studio_pub_regras();

-- Todo movimento vira histórico, como nos cartões de Atividades.
create or replace function public.studio_pub_historico()
returns trigger language plpgsql security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_nome text := public.studio_meu_nome();
  ins    record;
begin
  if tg_op = 'INSERT' then
    insert into studio_historico (publicacao_id, registro, nome, acao, detalhe)
    values (new.id, v_reg, v_nome, 'criou', public.studio_rotulo_status(new.status));
    return new;
  end if;
  for ins in
    select * from (values
      ('moveu', case when new.status is distinct from old.status
                     then public.studio_rotulo_status(old.status) || ' → ' || public.studio_rotulo_status(new.status) end),
      ('agendou', case when new.data_publicacao is distinct from old.data_publicacao
                       then coalesce(to_char(new.data_publicacao at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI'), 'sem data') end),
      ('versao', case when new.versao > old.versao then 'Versão ' || new.versao
                        || case when old.status = 'pronta' and new.status = 'aprovacao'
                                then ' — volta para aprovação' else '' end end),
      ('responsavel', case when new.responsavel is distinct from old.responsavel
                           then coalesce((select nome from membros where registro = new.responsavel), 'ninguém') end)
    ) x(acao, detalhe) where detalhe is not null
  loop
    insert into studio_historico (publicacao_id, registro, nome, acao, detalhe)
    values (new.id, v_reg, v_nome, ins.acao, ins.detalhe);
  end loop;
  return new;
end $$;
drop trigger if exists tg_studio_pub_historico on public.studio_publicacoes;
create trigger tg_studio_pub_historico after insert or update on public.studio_publicacoes
  for each row execute function public.studio_pub_historico();

-- Leitura: quem entra no Studio. Escrita: só pelas funções abaixo —
-- é nelas que moram as regras de aprovação e os avisos.
alter table public.studio_publicacoes enable row level security;
alter table public.studio_aprovacoes  enable row level security;
alter table public.studio_historico   enable row level security;
drop policy if exists studio_pub_select on public.studio_publicacoes;
create policy studio_pub_select on public.studio_publicacoes
  for select to authenticated using (public.studio_pode_acessar());
drop policy if exists studio_aprov_select on public.studio_aprovacoes;
create policy studio_aprov_select on public.studio_aprovacoes
  for select to authenticated using (public.studio_pode_acessar());
drop policy if exists studio_hist_select on public.studio_historico;
create policy studio_hist_select on public.studio_historico
  for select to authenticated using (public.studio_pode_acessar());
grant select on public.studio_publicacoes, public.studio_aprovacoes, public.studio_historico to authenticated;

-- ------------------------------------------------------------
-- 3a. SALVAR — cria ou altera. O status não entra aqui (a não ser o
--     inicial): mover é studio_mover, aprovar é studio_decidir.
-- ------------------------------------------------------------
create or replace function public.studio_publicacao_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    uuid := nullif(p->>'id','')::uuid;
  v_pub   studio_publicacoes;
  v_redes text[];
  v_antes text;
begin
  if not public.studio_pode_acessar() then return jsonb_build_object('status','sem_permissao'); end if;
  if v_id is null and nullif(trim(coalesce(p->>'titulo','')), '') is null then
    return jsonb_build_object('status','invalido','campo','titulo');
  end if;
  if p ? 'redes' then
    select coalesce(array_agg(x), '{}') into v_redes from jsonb_array_elements_text(p->'redes') x;
  end if;
  if p ? 'pilar' and nullif(p->>'pilar','') is not null
     and p->>'pilar' not in ('educar','inspirar','conectar','entreter','institucional','convidar') then
    return jsonb_build_object('status','invalido','campo','pilar');
  end if;

  if v_id is null then
    insert into studio_publicacoes (titulo, status, modelo, categoria, pilar, redes, formato,
      data_publicacao, legenda, primeiro_comentario, texto_alt, colaboradores, notas,
      responsavel, criado_por, peca, imagens)
    values (trim(p->>'titulo'),
      case when p->>'status' = 'producao' then 'producao' else 'ideia' end,
      nullif(p->>'modelo',''), nullif(p->>'categoria',''), nullif(p->>'pilar',''),
      coalesce(v_redes, '{}'), nullif(p->>'formato',''),
      nullif(p->>'data_publicacao','')::timestamptz,
      nullif(p->>'legenda',''), nullif(p->>'primeiro_comentario',''), nullif(p->>'texto_alt',''),
      nullif(p->>'colaboradores',''), nullif(p->>'notas',''),
      coalesce(nullif(p->>'responsavel','')::integer, v_reg), v_reg,
      case when p ? 'peca' and jsonb_typeof(p->'peca') = 'object' then p->'peca' end,
      coalesce(case when jsonb_typeof(p->'imagens') = 'array' then p->'imagens' end, '[]'::jsonb))
    returning * into v_pub;
    return jsonb_build_object('status','ok','id',v_pub.id,'codigo',v_pub.codigo,
                              'versao',v_pub.versao,'situacao',v_pub.status);
  end if;

  select * into v_pub from studio_publicacoes where id = v_id for update;
  if v_pub.id is null then return jsonb_build_object('status','nao_encontrada'); end if;
  v_antes := v_pub.status;

  update studio_publicacoes set
    titulo              = case when p ? 'titulo' and nullif(trim(p->>'titulo'),'') is not null then trim(p->>'titulo') else titulo end,
    modelo              = case when p ? 'modelo' then nullif(p->>'modelo','') else modelo end,
    categoria           = case when p ? 'categoria' then nullif(p->>'categoria','') else categoria end,
    pilar               = case when p ? 'pilar' then nullif(p->>'pilar','') else pilar end,
    redes               = coalesce(v_redes, redes),
    formato             = case when p ? 'formato' then nullif(p->>'formato','') else formato end,
    data_publicacao     = case when p ? 'data_publicacao' then nullif(p->>'data_publicacao','')::timestamptz else data_publicacao end,
    legenda             = case when p ? 'legenda' then nullif(p->>'legenda','') else legenda end,
    primeiro_comentario = case when p ? 'primeiro_comentario' then nullif(p->>'primeiro_comentario','') else primeiro_comentario end,
    texto_alt           = case when p ? 'texto_alt' then nullif(p->>'texto_alt','') else texto_alt end,
    colaboradores       = case when p ? 'colaboradores' then nullif(p->>'colaboradores','') else colaboradores end,
    notas               = case when p ? 'notas' then nullif(p->>'notas','') else notas end,
    responsavel         = case when p ? 'responsavel' then nullif(p->>'responsavel','')::integer else responsavel end,
    peca                = case when p ? 'peca' then (case when jsonb_typeof(p->'peca') = 'object' then p->'peca' end) else peca end,
    imagens             = case when p ? 'imagens' and jsonb_typeof(p->'imagens') = 'array' then p->'imagens' else imagens end,
    link                = case when p ? 'link' then nullif(p->>'link','') else link end,
    -- uma ideia que ganha arte já está em produção
    status              = case when status = 'ideia' and p ? 'peca' and jsonb_typeof(p->'peca') = 'object'
                               then 'producao' else status end
  where id = v_id
  returning * into v_pub;

  -- mexeu numa publicação aprovada: o gatilho a devolveu para
  -- aprovação. Quem mexeu passa a ser quem mandou (e não aprova a
  -- própria mudança), e quem aprova fica sabendo.
  if v_antes = 'pronta' and v_pub.status = 'aprovacao' then
    update studio_publicacoes set enviado_por = v_reg, enviado_em = now()
     where id = v_id returning * into v_pub;
    perform public.notificar(public.studio_aprovadores(), 'studio_aprovacao',
      v_pub.codigo || ' · ' || v_pub.titulo || ' mudou depois de aprovada',
      public.studio_meu_nome() || ' alterou a arte ou a legenda. A versão ' || v_pub.versao
        || ' precisa de aprovação de novo.',
      '#/studio/' || v_pub.codigo);
  end if;

  return jsonb_build_object('status','ok','id',v_pub.id,'codigo',v_pub.codigo,
                            'versao',v_pub.versao,'situacao',v_pub.status);
end $$;

-- ------------------------------------------------------------
-- 3b. MOVER — de coluna em coluna. "Pronta" não se alcança por aqui
--     sem as aprovações; "publicada" só a partir de pronta.
-- ------------------------------------------------------------
create or replace function public.studio_mover(p_id uuid, p_status text, p_link text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_pub studio_publicacoes;
  v_min integer := coalesce((select aprovacoes_minimas from studio_config), 1);
begin
  if not public.studio_pode_acessar() then return jsonb_build_object('status','sem_permissao'); end if;
  if p_status not in ('ideia','producao','aprovacao','pronta','publicada','arquivada') then
    return jsonb_build_object('status','invalido');
  end if;
  select * into v_pub from studio_publicacoes where id = p_id for update;
  if v_pub.id is null then return jsonb_build_object('status','nao_encontrada'); end if;
  if v_pub.status = p_status and p_status <> 'publicada' then
    return jsonb_build_object('status','ok','situacao',p_status);
  end if;

  if p_status = 'pronta' and public.studio_aprovacoes_validas(p_id) < v_min then
    return jsonb_build_object('status','precisa_aprovacao');
  end if;
  if p_status = 'publicada' and v_pub.status not in ('pronta','publicada') then
    return jsonb_build_object('status','precisa_aprovacao');
  end if;

  update studio_publicacoes set
    status       = p_status,
    enviado_por  = case when p_status = 'aprovacao' then v_reg else enviado_por end,
    enviado_em   = case when p_status = 'aprovacao' then now() else enviado_em end,
    aprovado_em  = case when p_status in ('pronta','publicada') then coalesce(aprovado_em, now()) else null end,
    publicado_em = case when p_status = 'publicada' then coalesce(publicado_em, now())
                        else publicado_em end,
    link         = case when p_status = 'publicada' and nullif(trim(coalesce(p_link,'')),'') is not null
                        then trim(p_link) else link end
  where id = p_id
  returning * into v_pub;

  if p_status = 'aprovacao' then
    perform public.notificar(public.studio_aprovadores(), 'studio_aprovacao',
      v_pub.codigo || ' · ' || v_pub.titulo || ' aguarda a sua aprovação',
      public.studio_meu_nome() || ' mandou a publicação para aprovação'
        || coalesce(', para ' || to_char(v_pub.data_publicacao at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), '') || '.',
      '#/studio/' || v_pub.codigo);
  end if;
  return jsonb_build_object('status','ok','situacao',v_pub.status);
end $$;

-- ------------------------------------------------------------
-- 3c. DECIDIR — aprovar ou devolver. De quem aprova, nunca de quem
--     mandou para aprovação. Devolver pede o porquê.
-- ------------------------------------------------------------
create or replace function public.studio_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    uuid := nullif(p->>'id','')::uuid;
  v_dec   text := p->>'decisao';
  v_par   text := nullif(trim(coalesce(p->>'parecer','')), '');
  v_pub   studio_publicacoes;
  v_min   integer := coalesce((select aprovacoes_minimas from studio_config), 1);
  v_n     integer;
  v_avisa integer[];
begin
  if not public.studio_pode_aprovar() then return jsonb_build_object('status','sem_permissao'); end if;
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_dec not in ('aprovar','devolver') then return jsonb_build_object('status','invalido'); end if;
  if v_dec = 'devolver' and v_par is null then return jsonb_build_object('status','invalido','campo','parecer'); end if;

  select * into v_pub from studio_publicacoes where id = v_id for update;
  if v_pub.id is null then return jsonb_build_object('status','nao_encontrada'); end if;
  if v_pub.status <> 'aprovacao' then return jsonb_build_object('status','fora_de_aprovacao'); end if;
  if v_pub.enviado_por = v_reg then return jsonb_build_object('status','propria'); end if;
  if exists (select 1 from studio_aprovacoes where publicacao_id = v_id and versao = v_pub.versao
                and registro = v_reg and decisao = 'aprovada') then
    return jsonb_build_object('status','ja_aprovou');
  end if;

  insert into studio_aprovacoes (publicacao_id, versao, registro, nome, decisao, parecer)
  values (v_id, v_pub.versao, v_reg, public.studio_meu_nome(),
          case when v_dec = 'aprovar' then 'aprovada' else 'devolvida' end, v_par);

  v_avisa := array_remove(array[v_pub.responsavel, v_pub.enviado_por, v_pub.criado_por], null);

  if v_dec = 'devolver' then
    update studio_publicacoes set status = 'producao', aprovado_em = null where id = v_id;
    insert into studio_historico (publicacao_id, registro, nome, acao, detalhe)
    values (v_id, v_reg, public.studio_meu_nome(), 'devolveu', v_par);
    perform public.notificar(v_avisa, 'studio_decisao',
      v_pub.codigo || ' · ' || v_pub.titulo || ' voltou para produção',
      public.studio_meu_nome() || ' devolveu: ' || v_par, '#/studio/' || v_pub.codigo);
    return jsonb_build_object('status','ok','situacao','producao');
  end if;

  v_n := public.studio_aprovacoes_validas(v_id);
  insert into studio_historico (publicacao_id, registro, nome, acao, detalhe)
  values (v_id, v_reg, public.studio_meu_nome(), 'aprovou',
          'Versão ' || v_pub.versao || ' · ' || v_n || ' de ' || v_min || coalesce(' — ' || v_par, ''));
  if v_n >= v_min then
    update studio_publicacoes set status = 'pronta', aprovado_em = now() where id = v_id;
    perform public.notificar(v_avisa, 'studio_decisao',
      v_pub.codigo || ' · ' || v_pub.titulo || ' está pronta para publicar',
      'Aprovada por ' || public.studio_meu_nome()
        || coalesce('. Sai em ' || to_char(v_pub.data_publicacao at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI'), '') || '.',
      '#/studio/' || v_pub.codigo);
    return jsonb_build_object('status','ok','situacao','pronta','aprovacoes',v_n);
  end if;
  return jsonb_build_object('status','ok','situacao','aprovacao','aprovacoes',v_n,'faltam',v_min - v_n);
end $$;

-- ------------------------------------------------------------
-- 3d. EXCLUIR — de quem criou e de quem aprova. Devolve os
--     caminhos das imagens, para a tela apagá-las do Storage.
-- ------------------------------------------------------------
create or replace function public.studio_excluir(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_pub studio_publicacoes;
begin
  select * into v_pub from studio_publicacoes where id = p_id;
  if v_pub.id is null then return jsonb_build_object('status','nao_encontrada'); end if;
  if not (public.studio_gestor()
          or (public.studio_pode_acessar() and v_pub.criado_por = public.portal_registro_atual())) then
    return jsonb_build_object('status','sem_permissao');
  end if;
  delete from studio_publicacoes where id = p_id;
  return jsonb_build_object('status','ok','codigo',v_pub.codigo,'imagens',v_pub.imagens);
end $$;

revoke execute on function public.studio_publicacao_salvar(jsonb)       from public, anon;
revoke execute on function public.studio_mover(uuid, text, text)        from public, anon;
revoke execute on function public.studio_decidir(jsonb)                 from public, anon;
revoke execute on function public.studio_excluir(uuid)                  from public, anon;
revoke execute on function public.studio_aprovacoes_validas(uuid)       from public, anon;
grant  execute on function public.studio_publicacao_salvar(jsonb)       to authenticated;
grant  execute on function public.studio_mover(uuid, text, text)        to authenticated;
grant  execute on function public.studio_decidir(jsonb)                 to authenticated;
grant  execute on function public.studio_excluir(uuid)                  to authenticated;
grant  execute on function public.studio_aprovacoes_validas(uuid)       to authenticated;

-- ============================================================
-- 4. O LEMBRETE DA VÉSPERA
--    Uma vez por publicação e por data: mudar a data zera o
--    lembrete (o gatilho da seção 3). Grava direto em notificacoes,
--    e não por notificar(), porque notificar() pula quem agiu — e
--    quando a tela do Studio chama esta função, quem "age" é quem
--    abriu a tela, que pode ser justamente o responsável.
-- ------------------------------------------------------------
create or replace function public.studio_lembretes()
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare
  v_amanha date := (now() at time zone 'America/Sao_Paulo')::date + 1;
  v_n      integer := 0;
  r        record;
  v_para   integer[];
  v_corpo  text;
begin
  if not coalesce((select lembrete_email from studio_config), true) then return 0; end if;
  for r in
    select * from studio_publicacoes
     where status in ('producao','aprovacao','pronta')
       and lembrete_em is null
       and data_publicacao is not null
       and (data_publicacao at time zone 'America/Sao_Paulo')::date = v_amanha
     for update skip locked
  loop
    v_para := array_remove(array[r.responsavel, r.criado_por], null);
    if r.status = 'aprovacao' then v_para := v_para || public.studio_aprovadores(); end if;
    v_corpo := case r.status
      when 'pronta'    then 'Está aprovada e pronta. A arte, a legenda e as notas para quem publica estão no Studio.'
      when 'aprovacao' then 'Ainda aguarda aprovação — sem ela, não fica pronta para publicar.'
      else                  'Ainda está em produção e precisa passar pela aprovação antes de sair.'
    end
    || case when r.colaboradores is not null then ' Lembre de convidar como collab: ' || r.colaboradores || '.' else '' end;

    insert into notificacoes (registro, tipo, titulo, corpo, href)
    select distinct x, 'studio_lembrete',
           'Amanhã: ' || r.codigo || ' · ' || r.titulo
             || coalesce(' — ' || nullif(array_to_string(r.redes, ', '), ''), '')
             || ' às ' || to_char(r.data_publicacao at time zone 'America/Sao_Paulo', 'HH24:MI'),
           v_corpo, '#/studio/' || r.codigo
      from unnest(v_para) x
      join membros m on m.registro = x and m.status in ('Ativo','Em pausa / avaliação');

    update studio_publicacoes set lembrete_em = now() where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
-- Qualquer conta autenticada pode chamar: é idempotente, e a tela do
-- Studio chama ao abrir — é a rede de segurança de quem não tem o
-- pg_cron ligado.
revoke execute on function public.studio_lembretes() from public, anon;
grant  execute on function public.studio_lembretes() to authenticated;

-- O relógio: de hora em hora, das 8h às 20h de Brasília (11h–23h
-- UTC). Só onde o pg_cron existe — no Supabase, depois de ligar a
-- extensão em Integrations → Cron (a mesma do notificar-email).
do $$
begin
  if to_regnamespace('cron') is not null then
    if exists (select 1 from cron.job where jobname = 'studio-lembretes') then
      perform cron.unschedule('studio-lembretes');
    end if;
    perform cron.schedule('studio-lembretes', '0 11-23 * * *', 'select public.studio_lembretes()');
  else
    raise notice 'Sem o pg_cron: o lembrete da véspera sai quando alguém abrir o Studio. Ligue o Cron e rode esta migração de novo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 4a. O LOTE DE E-MAIL ABRE EXCEÇÃO PARA O LEMBRETE
--     Idêntico ao da 18.0, com um tipo a mais na exceção. Desde
--     aqui, a dona desta função é a 23.0: a 16.0 e a 18.0 só a
--     definem enquanto esta não passou (o mesmo cuidado da 17.0
--     com a 19.0).
-- ------------------------------------------------------------
create or replace function public.notificacoes_email_lote(p_limite integer default 200)
returns jsonb language sql stable security definer
set search_path = public as $$
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
       and (
             n.tipo in ('teste_email', 'studio_lembrete')   -- saem sempre
         or (    coalesce(pr.email_modo,'imediato') <> 'nunca'
             and (coalesce(pr.email_modo,'imediato') = 'imediato'
                  or pr.ultimo_email is null
                  or pr.ultimo_email < now() - interval '20 hours'))
           )
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
$$;
revoke execute on function public.notificacoes_email_lote(integer) from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.notificacoes_email_lote(integer) to service_role;
  end if;
end $$;

-- ============================================================
-- 5. RECURSOS — onde estão as nossas fotos
--    Pastas do Drive, álbuns compartilhados, repositórios, bancos
--    de imagem. Quem entra no Studio lê e cadastra; apagar é de quem
--    cadastrou e da gestão.
-- ------------------------------------------------------------
create table if not exists public.studio_recursos (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null check (length(trim(titulo)) > 0),
  tipo        text not null default 'pasta'
                check (tipo in ('pasta','album','repositorio','banco','video','marca','outro')),
  url         text not null check (url ~* '^https?://'),
  descricao   text,
  ordem       integer not null default 100,
  criado_por  integer references public.membros(registro) on delete set null,
  criado_em   timestamptz not null default now()
);
alter table public.studio_recursos enable row level security;
drop policy if exists studio_rec_select on public.studio_recursos;
create policy studio_rec_select on public.studio_recursos
  for select to authenticated using (public.studio_pode_acessar());
drop policy if exists studio_rec_insert on public.studio_recursos;
create policy studio_rec_insert on public.studio_recursos
  for insert to authenticated
  with check (public.studio_pode_acessar() and criado_por is not distinct from public.portal_registro_atual());
drop policy if exists studio_rec_update on public.studio_recursos;
create policy studio_rec_update on public.studio_recursos
  for update to authenticated
  using (public.studio_gestor() or (public.studio_pode_acessar() and criado_por = public.portal_registro_atual()))
  with check (public.studio_pode_acessar());
drop policy if exists studio_rec_delete on public.studio_recursos;
create policy studio_rec_delete on public.studio_recursos
  for delete to authenticated
  using (public.studio_gestor() or (public.studio_pode_acessar() and criado_por = public.portal_registro_atual()));
grant select, insert, update, delete on public.studio_recursos to authenticated;

-- ============================================================
-- 6. IMPRENSA — a seção "Quem somos" do site
--    Os vídeos (carrossel) e as matérias escritas. O site lê pela
--    função pública; quem edita é a gestão do Studio e, como no
--    painel do site, admin e pessoal.
-- ------------------------------------------------------------
create table if not exists public.site_imprensa (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null check (tipo in ('video','materia')),
  titulo        text,                          -- vazio num vídeo: o veículo vira o rótulo
  veiculo       text,
  ano           text,
  youtube       text check (youtube is null or youtube ~ '^[A-Za-z0-9_-]{11}$'),
  url           text check (url is null or url ~* '^https?://'),
  arquivo       text check (arquivo is null or arquivo ~* '^https?://'),   -- vídeo hospedado por nós
  capa          text check (capa is null or capa ~* '^https?://'),
  ordem         integer not null default 100,
  publicado     boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (tipo <> 'video' or youtube is not null or arquivo is not null),
  check (tipo <> 'materia' or (url is not null and nullif(trim(titulo),'') is not null))
);
create index if not exists site_imprensa_ordem on public.site_imprensa (publicado, tipo, ordem);

create or replace function public.site_imprensa_tocar()
returns trigger language plpgsql as $$
begin new.atualizado_em := now(); return new; end $$;
drop trigger if exists tg_site_imprensa_tocar on public.site_imprensa;
create trigger tg_site_imprensa_tocar before update on public.site_imprensa
  for each row execute function public.site_imprensa_tocar();

create or replace function public.site_imprensa_editor()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() in ('admin','pessoal') or public.studio_gestor();
$$;
revoke execute on function public.site_imprensa_editor() from public, anon;
grant  execute on function public.site_imprensa_editor() to authenticated;

alter table public.site_imprensa enable row level security;
drop policy if exists site_imprensa_select on public.site_imprensa;
create policy site_imprensa_select on public.site_imprensa
  for select to authenticated using (true);
drop policy if exists site_imprensa_write on public.site_imprensa;
create policy site_imprensa_write on public.site_imprensa
  for all to authenticated
  using (public.site_imprensa_editor()) with check (public.site_imprensa_editor());
grant select, insert, update, delete on public.site_imprensa to authenticated;

create or replace function public.site_imprensa_publico()
returns jsonb language sql stable security definer
set search_path = public as $$
  select jsonb_build_object(
    'videos', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'titulo', nullif(i.titulo,''), 'veiculo', nullif(i.veiculo,''), 'ano', nullif(i.ano,''),
        'youtube', i.youtube, 'url', i.url, 'arquivo', i.arquivo, 'capa', i.capa))
        order by i.ordem, i.criado_em)
      from site_imprensa i where i.publicado and i.tipo = 'video'), '[]'::jsonb),
    'materias', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
        'titulo', i.titulo, 'veiculo', nullif(i.veiculo,''), 'ano', nullif(i.ano,''), 'url', i.url))
        order by i.ordem, i.criado_em)
      from site_imprensa i where i.publicado and i.tipo = 'materia'), '[]'::jsonb));
$$;
grant execute on function public.site_imprensa_publico() to anon, authenticated;

-- Carga inicial: o que o site tinha escrito no código. Só com a
-- tabela vazia — depois disso, a gestão é pelo Studio.
insert into public.site_imprensa (tipo, titulo, veiculo, ano, youtube, url, ordem)
select * from (values
  ('video',   null::text, 'Jornal Nacional', '2026', 'AdOeBTOeMu0', null::text, 10),
  ('video',   null, 'CNN',             '2022', 'Fi6vx_Yf8EY', null, 20),
  ('video',   null, 'Record',          '2025', 'pytrfROeAVU', null, 30),
  ('video',   'The team film from our FreeWheels years', null, '2023', '2UbfRGVx6wM', null, 40),
  ('video',   'Cybathlon highlights', 'Cybathlon', '2024', 'WbhvEbVW1-I', null, 50),
  ('video',   null, 'Instituto Galo',  '2025', 'zgJx7Qlfm7w', null, 60),
  ('materia', 'Tecnologia desenvolvida pela UFMG leva atleta paraplégico a competição internacional',
              'Globo Esporte', '2024', null,
              'https://ge.globo.com/mg/noticia/2024/10/21/tecnologia-desenvolvida-pela-ufmg-leva-atleta-paraplegico-a-competicao-internacional.ghtml', 10),
  ('materia', 'Atleta paraplégico que treina na UFMG vai às Olimpíadas Biônicas na Suíça',
              'UFMG', '2024', null,
              'https://www3.ufmg.br/comunicacao/noticias/atleta-paraplegico-que-treina-na-ufmg-vai-as-olimpiadas-bionicas-na-suica', 20),
  ('materia', 'Triciclo feito por alunos da UFMG faz jovem tetraplégico pedalar',
              'Record', '2024', null,
              'https://noticias.r7.com/minas-gerais/balanco-geral-mg/video/triciclo-feito-por-alunos-da-ufmg-faz-jovem-tetraplegico-pedalar-01112024/', 30)
) as seed(tipo, titulo, veiculo, ano, youtube, url, ordem)
where not exists (select 1 from public.site_imprensa);

-- ============================================================
-- 7. STORAGE — o bucket "studio"
--    Privado. Uma pasta por publicação (<id>/…), com as artes
--    exportadas e as fotos de origem, para reabrir a peça. Quem entra
--    no Studio lê e sobe; apagar é de quem subiu e da gestão.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sem o schema storage: o bucket do Studio fica para quando houver.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit)
  values ('studio', 'studio', false, 26214400)
  on conflict (id) do update set public = false;

  execute 'drop policy if exists studio_obj_insert on storage.objects';
  execute $p$create policy studio_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'studio' and public.studio_pode_acessar())$p$;
  execute 'drop policy if exists studio_obj_select on storage.objects';
  execute $p$create policy studio_obj_select on storage.objects for select to authenticated
    using (bucket_id = 'studio' and public.studio_pode_acessar())$p$;
  execute 'drop policy if exists studio_obj_update on storage.objects';
  execute $p$create policy studio_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'studio' and public.studio_pode_acessar())
    with check (bucket_id = 'studio' and public.studio_pode_acessar())$p$;
  execute 'drop policy if exists studio_obj_delete on storage.objects';
  execute $p$create policy studio_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'studio' and (owner = auth.uid() or public.studio_gestor()))$p$;
end $$;

-- ============================================================
-- 8. AUDITORIA
--    Quem mudou quem entra, quem aprova e o que o site mostra.
-- ------------------------------------------------------------
do $$
begin
  if to_regprocedure('public.fn_auditoria()') is not null then
    execute 'drop trigger if exists tg_aud_studio_config on public.studio_config';
    execute 'create trigger tg_aud_studio_config after update on public.studio_config
             for each row execute function public.fn_auditoria()';
    execute 'drop trigger if exists tg_aud_site_imprensa on public.site_imprensa';
    execute 'create trigger tg_aud_site_imprensa after insert or update or delete on public.site_imprensa
             for each row execute function public.fn_auditoria()';
  end if;
end $$;

-- ============================================================
-- 9. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v23_studio', 'Studio: publicações (ideia → produção → aprovação → pronta → publicada) com código POST-N, aprovação pelo grupo aprovador, lembrete da véspera por e-mail, recursos de imagem, imprensa do site (site_imprensa_publico) e bucket privado "studio"')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 23.0
--
-- Depois de rodar:
--   1) Studio › Configurações: escolha os grupos que entram no
--      Studio e os que aprovam. Sem grupo aprovador, aprova admin;
--      sem grupo de acesso, só admin e quem aprova entram;
--   2) confira se o lembrete ficou agendado:
--        select jobname, schedule from cron.job where jobname = 'studio-lembretes';
--      (vazio = pg_cron desligado; ligue em Integrations → Cron e
--      rode esta migração de novo);
--   3) a imprensa do site já veio com o que estava no código — daqui
--      em diante, edite em Studio › Configurações › Imprensa.
-- ============================================================
