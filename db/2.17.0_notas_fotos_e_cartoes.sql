-- ============================================================
-- SOMA 2.17.0 — MIGRAÇÃO · NeuroDynamics
-- A PRIMEIRA COM O NÚMERO NOVO. Daqui em diante o SOMA se numera
-- major.minor.patch (README, "Versões"): a 32.0 passou a se chamar
-- 2.16.0, e esta é a 2.17.0 porque só acrescenta. O arquivo leva o
-- número da versão no nome, e a linha em migracoes também.
--
--   1. BUGS E SUGESTÕES. A página de notas de versão (#/versoes) tem a
--      seção em que a equipe relata um bug ou sugere uma melhoria:
--      soma_feedback (BUG-12, SUG-13: um número só, o prefixo diz o
--      tipo), os votos e a conversa de cada relato. Quem decide o
--      andamento (em análise, planejado, feito na versão X, recusado,
--      duplicado) é admin; o autor e quem votou são avisados.
--   2. A FOTO ENVIADA PELO PORTAL. O bucket público "fotos" e
--      membro_foto_definir: cada pessoa envia a própria foto, e o Depto.
--      de Pessoal (e admin) a de qualquer um, sem publicar a imagem em
--      outro lugar e colar o link. O arquivo mora em fotos/<registro>/.
--   3. OS CARTÕES DE ATIVIDADES, mais completos:
--        - outras pessoas atribuídas (atividades.pessoas), avisadas e
--          seguindo o cartão, além do responsável;
--        - etiquetas (atividades.etiquetas);
--        - checklists (atividade_checklists e atividade_checklist_itens),
--          por atividade_checklist();
--        - copiar o cartão para outro quadro (atividade_copiar), com a
--          opção de arquivar o original: a cópia guarda de onde veio
--          (atividades.copia_de);
--        - editar e excluir o próprio comentário.
--      A descrição e os comentários passam a ser Markdown, e a menção se
--      faz digitando @: isso é da tela, o banco já guardava o texto e os
--      mencionados.
--
-- A partir daqui, a dona de atividade_criar, de atividade_editar e das
-- views atividades_quadro e atividades_carga é esta migração: a 15.0
-- deixa de redefini-las quando esta já passou (o mesmo cuidado que a
-- 15.0 tem com sou_do_grupo, por causa da 17.0). Rodar a 15.0 de novo
-- não apaga as pessoas, as etiquetas nem as checklists.
--
-- Pré-requisitos: a 15.0, a 17.0 e a 19.0. Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.atividades') is null or to_regprocedure('public.notificar(integer[],text,text,text,text)') is null then
    raise exception using message = 'Falta aplicar a 15.0 (v15_atividades.sql) antes desta migração.';
  end if;
  if to_regprocedure('public.posso_editar_grupo(integer)') is null then
    raise exception using message = 'Falta aplicar a 17.0 (v17_grupos_acesso.sql) antes desta migração.';
  end if;
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null then
    raise exception using message = 'Falta aplicar a 19.0 (v19_grupos_hierarquia.sql) antes desta migração.';
  end if;
end $$;

-- ============================================================
-- 1. BUGS E SUGESTÕES
--    O relato é da equipe inteira: todo mundo lê todos, e é assim que
--    se evita o mesmo bug relatado cinco vezes (quem chega depois vota
--    no que já existe). Escrever é só pelas funções.
-- ------------------------------------------------------------
create table if not exists public.soma_feedback (
  id            bigserial primary key,
  tipo          text not null check (tipo in ('bug','sugestao')),
  titulo        text not null check (btrim(titulo) <> ''),
  corpo         text,
  versao        text,
  tela          text,
  aparelho      text,
  status        text not null default 'aberto'
                  check (status in ('aberto','em_analise','planejado','feito','recusado','duplicado')),
  resposta      text,
  versao_feito  text,
  duplicado_de  bigint references public.soma_feedback(id) on delete set null,
  autor         integer references public.membros(registro) on delete set null,
  decidido_por  integer references public.membros(registro) on delete set null,
  decidido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
comment on table public.soma_feedback is
  'Bugs e sugestões sobre o próprio SOMA, relatados pela equipe em #/versoes/comentarios. '
  'O código é o prefixo do tipo mais o id (BUG-12, SUG-13): o número não muda se o tipo mudar.';
comment on column public.soma_feedback.versao is 'A versão do SOMA aberta no navegador de quem relatou (VERSAO).';
comment on column public.soma_feedback.tela is 'A tela em que a pessoa estava antes de relatar (#/atividades/ORT).';
comment on column public.soma_feedback.versao_feito is 'Com status feito: a versão que resolveu (2.18.0).';
create index if not exists soma_feedback_status_ix on public.soma_feedback (status, criado_em desc);

create table if not exists public.soma_feedback_votos (
  feedback_id bigint  not null references public.soma_feedback(id) on delete cascade,
  registro    integer not null references public.membros(registro) on delete cascade,
  criado_em   timestamptz not null default now(),
  primary key (feedback_id, registro)
);
comment on table public.soma_feedback_votos is 'Quem também passa pelo bug, ou também quer a melhoria: um voto por pessoa.';

create table if not exists public.soma_feedback_comentarios (
  id          uuid primary key default gen_random_uuid(),
  feedback_id bigint not null references public.soma_feedback(id) on delete cascade,
  registro    integer references public.membros(registro) on delete set null,
  corpo       text not null,
  criado_em   timestamptz not null default now()
);
create index if not exists soma_feedback_com_ix on public.soma_feedback_comentarios (feedback_id, criado_em);

alter table public.soma_feedback             enable row level security;
alter table public.soma_feedback_votos       enable row level security;
alter table public.soma_feedback_comentarios enable row level security;
drop policy if exists sfb_select on public.soma_feedback;
create policy sfb_select on public.soma_feedback for select to authenticated using (true);
drop policy if exists sfbv_select on public.soma_feedback_votos;
create policy sfbv_select on public.soma_feedback_votos for select to authenticated using (true);
drop policy if exists sfbc_select on public.soma_feedback_comentarios;
create policy sfbc_select on public.soma_feedback_comentarios for select to authenticated using (true);
-- escrita só pelas funções abaixo: sem política de insert, update e delete

create or replace function public.feedback_codigo(p_tipo text, p_id bigint)
returns text language sql immutable as $$
  select case p_tipo when 'bug' then 'BUG-' else 'SUG-' end || p_id::text;
$$;

-- A lista que a tela lê, com o que ela precisa já resolvido.
drop view if exists public.soma_feedback_lista;
create view public.soma_feedback_lista with (security_invoker = true) as
select f.id, f.tipo, f.titulo, f.corpo, f.versao, f.tela, f.aparelho, f.status, f.resposta,
       f.versao_feito, f.duplicado_de, f.autor, f.decidido_por, f.decidido_em,
       f.criado_em, f.atualizado_em,
       public.feedback_codigo(f.tipo, f.id) as codigo,
       ma.nome as autor_nome,
       md.nome as decidido_por_nome,
       (select public.feedback_codigo(d.tipo, d.id) from soma_feedback d where d.id = f.duplicado_de) as duplicado_de_codigo,
       (select count(*) from soma_feedback_votos v where v.feedback_id = f.id) as votos,
       exists (select 1 from soma_feedback_votos v
                where v.feedback_id = f.id and v.registro = public.portal_registro_atual()) as votei,
       (select count(*) from soma_feedback_comentarios c where c.feedback_id = f.id) as comentarios
  from soma_feedback f
  left join membros ma on ma.registro = f.autor
  left join membros md on md.registro = f.decidido_por;
comment on view public.soma_feedback_lista is
  'Os relatos com o código, os nomes, a contagem de votos e de comentários e se eu já votei.';

-- 1a. Relatar (ou corrigir o próprio relato enquanto ele está aberto)
create or replace function public.feedback_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_adm  boolean := public.papel_atual() = 'admin';
  v_id   bigint  := nullif(p->>'id','')::bigint;
  v_tipo text    := coalesce(nullif(p->>'tipo',''), 'bug');
  v_tit  text    := nullif(regexp_replace(btrim(coalesce(p->>'titulo','')), '\s+', ' ', 'g'), '');
  v_f    public.soma_feedback%rowtype;
  v_para integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_tipo not in ('bug','sugestao') then return jsonb_build_object('status','invalido','campo','tipo'); end if;
  if v_tit is null or length(v_tit) < 3 or length(v_tit) > 160 then
    return jsonb_build_object('status','invalido','campo','titulo'); end if;

  if v_id is null then
    insert into soma_feedback (tipo, titulo, corpo, versao, tela, aparelho, autor)
    values (v_tipo, v_tit, nullif(btrim(p->>'corpo'),''),
            left(nullif(btrim(p->>'versao'),''), 20),
            left(nullif(btrim(p->>'tela'),''), 200),
            left(nullif(btrim(p->>'aparelho'),''), 80), v_reg)
    returning * into v_f;
    -- quem cuida do SOMA fica sabendo (notificar não avisa quem agiu)
    select coalesce(array_agg(distinct pf.registro), '{}') into v_para
      from perfis pf where pf.papel = 'admin' and pf.registro is not null;
    perform public.notificar(v_para, 'feedback_novo',
      public.feedback_codigo(v_f.tipo, v_f.id) || ' ' || v_f.titulo,
      case v_f.tipo when 'bug' then 'Novo bug relatado.' else 'Nova sugestão.' end,
      '#/versoes/comentarios/' || v_f.id);
    return jsonb_build_object('status','ok','id',v_f.id,'codigo',public.feedback_codigo(v_f.tipo, v_f.id));
  end if;

  select * into v_f from soma_feedback where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if v_f.autor is distinct from v_reg and not v_adm then return jsonb_build_object('status','sem_permissao'); end if;
  -- depois que alguém decidiu, o texto é o que foi decidido: só admin mexe
  if v_f.status <> 'aberto' and not v_adm then return jsonb_build_object('status','fechado'); end if;
  update soma_feedback set
    tipo  = v_tipo,
    titulo = v_tit,
    corpo = case when p ? 'corpo' then nullif(btrim(p->>'corpo'),'') else corpo end,
    atualizado_em = now()
   where id = v_id;
  return jsonb_build_object('status','ok','id',v_id,'codigo',public.feedback_codigo(v_tipo, v_id));
end $$;

-- 1b. Votar: "também acontece comigo" ou "também quero"
create or replace function public.feedback_votar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_id  bigint  := nullif(p->>'id','')::bigint;
  v_on  boolean := coalesce(nullif(p->>'voto','')::boolean, true);
  v_n   integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if not exists (select 1 from soma_feedback where id = v_id) then
    return jsonb_build_object('status','nao_encontrado'); end if;
  if v_on then
    insert into soma_feedback_votos (feedback_id, registro) values (v_id, v_reg) on conflict do nothing;
  else
    delete from soma_feedback_votos where feedback_id = v_id and registro = v_reg;
  end if;
  select count(*) into v_n from soma_feedback_votos where feedback_id = v_id;
  return jsonb_build_object('status','ok','votos',v_n,'votei',v_on);
end $$;

-- 1c. Comentar um relato: avisa quem relatou e quem já comentou
create or replace function public.feedback_comentar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    bigint  := nullif(p->>'id','')::bigint;
  v_corpo text    := nullif(btrim(p->>'corpo'),'');
  v_f     public.soma_feedback%rowtype;
  v_cid   uuid;
  v_para  integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_corpo is null then return jsonb_build_object('status','invalido','campo','corpo'); end if;
  select * into v_f from soma_feedback where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  insert into soma_feedback_comentarios (feedback_id, registro, corpo)
  values (v_id, v_reg, v_corpo) returning id into v_cid;
  update soma_feedback set atualizado_em = now() where id = v_id;

  select coalesce(array_agg(distinct r), '{}') into v_para from (
    select v_f.autor as r
    union select registro from soma_feedback_comentarios where feedback_id = v_id) x
   where r is not null;
  perform public.notificar(v_para, 'feedback_comentario',
    public.feedback_codigo(v_f.tipo, v_f.id) || ' ' || v_f.titulo,
    'Novo comentário.', '#/versoes/comentarios/' || v_id);
  return jsonb_build_object('status','ok','id',v_cid);
end $$;

-- 1d. Decidir o andamento (admin): avisa quem relatou e quem votou
create or replace function public.feedback_decidir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_id    bigint  := nullif(p->>'id','')::bigint;
  v_st    text    := nullif(p->>'status','');
  v_tipo  text    := nullif(p->>'tipo','');
  v_dup   bigint  := nullif(p->>'duplicado_de','')::bigint;
  v_f     public.soma_feedback%rowtype;
  v_antes text;
  v_frase text;
  v_para  integer[];
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select * into v_f from soma_feedback where id = v_id;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if v_st is null or v_st not in ('aberto','em_analise','planejado','feito','recusado','duplicado') then
    return jsonb_build_object('status','invalido','campo','status'); end if;
  if v_tipo is not null and v_tipo not in ('bug','sugestao') then
    return jsonb_build_object('status','invalido','campo','tipo'); end if;
  if v_st = 'duplicado' and (v_dup is null or v_dup = v_id
       or not exists (select 1 from soma_feedback where id = v_dup)) then
    return jsonb_build_object('status','invalido','campo','duplicado_de'); end if;

  v_antes := v_f.status;
  update soma_feedback set
    status       = v_st,
    tipo         = coalesce(v_tipo, tipo),
    resposta     = case when p ? 'resposta' then nullif(btrim(p->>'resposta'),'') else resposta end,
    versao_feito = case when v_st = 'feito' then coalesce(left(nullif(btrim(p->>'versao_feito'),''), 20), versao_feito) end,
    duplicado_de = case when v_st = 'duplicado' then v_dup end,
    decidido_por = v_reg,
    decidido_em  = now(),
    atualizado_em = now()
   where id = v_id
  returning * into v_f;

  if v_f.status is distinct from v_antes then
    v_frase := case v_f.status
      when 'aberto'     then 'Reaberto.'
      when 'em_analise' then 'Em análise.'
      when 'planejado'  then 'Planejado para uma próxima versão.'
      when 'feito'      then 'Feito' || coalesce(' na versão ' || v_f.versao_feito, '') || '.'
      when 'recusado'   then 'Recusado.'
      when 'duplicado'  then 'Duplicado de ' || (select public.feedback_codigo(tipo, id) from soma_feedback where id = v_f.duplicado_de) || '.'
    end;
    select coalesce(array_agg(distinct r), '{}') into v_para from (
      select v_f.autor as r
      union select registro from soma_feedback_votos where feedback_id = v_id) x
     where r is not null;
    perform public.notificar(v_para, 'feedback_status',
      public.feedback_codigo(v_f.tipo, v_f.id) || ' ' || v_f.titulo, v_frase,
      '#/versoes/comentarios/' || v_id);
  end if;
  return jsonb_build_object('status','ok','codigo',public.feedback_codigo(v_f.tipo, v_f.id));
end $$;

-- 1e. Excluir: o autor, enquanto ninguém decidiu; admin, sempre
create or replace function public.feedback_excluir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_f   public.soma_feedback%rowtype;
begin
  if v_reg is null and public.papel_atual() <> 'admin' then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_f from soma_feedback where id = nullif(p->>'id','')::bigint;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if public.papel_atual() <> 'admin' and (v_f.autor is distinct from v_reg or v_f.status <> 'aberto') then
    return jsonb_build_object('status','sem_permissao'); end if;
  delete from soma_feedback where id = v_f.id;
  return jsonb_build_object('status','ok');
end $$;

do $$
declare f text;
begin
  foreach f in array array['feedback_salvar','feedback_votar','feedback_comentar','feedback_decidir','feedback_excluir'] loop
    execute format('revoke execute on function public.%I(jsonb) from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%I(jsonb) from anon', f); end if;
    execute format('grant execute on function public.%I(jsonb) to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 2. A FOTO ENVIADA PELO PORTAL
--    Até aqui, foto era membros.foto_url preenchido à mão (a imagem
--    publicada em algum lugar e o link colado na ficha) ou o arquivo
--    fotos/<registro>.jpg do repositório nro-pessoal. Agora a pessoa
--    envia a imagem, que o portal recorta e reduz (512 px, JPEG), e ela
--    vai para o bucket público "fotos", na pasta do registro. Público
--    porque a foto aparece em toda tela, para toda a equipe, e o link
--    assinado venceria; o nome do arquivo leva a hora do envio, então a
--    foto nova nunca fica presa no cache.
--
--    Quem envia: a própria pessoa (a pasta do seu registro), o Depto.
--    de Pessoal e admin (qualquer pasta). O link continua valendo para
--    quem prefere: o campo da ficha não mudou.
-- ------------------------------------------------------------
create or replace function public.membro_foto_pode(p_nome text)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_nome ~ '^[0-9]+/[A-Za-z0-9._-]+$'
     and (public.papel_atual() in ('admin','pessoal')
          or (public.portal_registro_atual() is not null
              and split_part(p_nome, '/', 1) = public.portal_registro_atual()::text));
$$;
comment on function public.membro_foto_pode(text) is
  'Quem grava no bucket "fotos": a própria pessoa, na pasta do seu registro; admin e pessoal, em qualquer uma.';

-- O endereço público de um arquivo do bucket. O endereço do projeto é o
-- mesmo que a 32.0 guarda no Vault para chamar as Edge Functions.
create or replace function public.membro_foto_url(p_caminho text)
returns text language plpgsql stable security definer
set search_path = public as $$
declare v_url text;
begin
  if p_caminho is null then return null; end if;
  begin
    if to_regclass('vault.decrypted_secrets') is not null then
      execute 'select decrypted_secret from vault.decrypted_secrets where name = $1 limit 1'
        into v_url using 'soma_url_projeto';
    end if;
  exception when others then v_url := null;
  end;
  return rtrim(coalesce(nullif(v_url, ''), 'https://rxzmkyjttzzpwtodqkve.supabase.co'), '/')
      || '/storage/v1/object/public/fotos/' || p_caminho;
end $$;

-- Grava a foto enviada na ficha (ou tira, com caminho nulo). Devolve o
-- caminho da foto anterior, quando ela era deste bucket: quem enviou
-- apaga o arquivo velho pelo Storage, que é quem sabe apagar o objeto.
create or replace function public.membro_foto_definir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_gest  boolean := public.papel_atual() in ('admin','pessoal');
  v_alvo  integer := coalesce(nullif(p->>'registro','')::integer, v_reg);
  v_cam   text    := nullif(btrim(p->>'caminho'),'');
  v_base  text    := '/storage/v1/object/public/fotos/';
  v_ant   text;
  v_url   text;
begin
  if v_reg is null and not v_gest then return jsonb_build_object('status','sem_registro'); end if;
  if v_alvo is null then return jsonb_build_object('status','invalido','campo','registro'); end if;
  if v_alvo is distinct from v_reg and not v_gest then return jsonb_build_object('status','sem_permissao'); end if;
  select foto_url into v_ant from membros where registro = v_alvo;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  if v_cam is not null then
    if v_cam !~ ('^' || v_alvo::text || '/[A-Za-z0-9._-]+[.](jpe?g|png|webp)$') then
      return jsonb_build_object('status','invalido','campo','caminho'); end if;
    if to_regclass('storage.objects') is not null
       and not exists (select 1 from storage.objects where bucket_id = 'fotos' and name = v_cam) then
      return jsonb_build_object('status','sem_arquivo'); end if;
    v_url := public.membro_foto_url(v_cam);
  end if;

  update membros set foto_url = v_url where registro = v_alvo;
  return jsonb_build_object('status','ok','foto_url',v_url,
    'anterior', case when position(v_base in coalesce(v_ant,'')) > 0
                      and split_part(v_ant, v_base, 2) is distinct from v_cam
                     then split_part(v_ant, v_base, 2) end);
end $$;

revoke execute on function public.membro_foto_definir(jsonb) from public;
revoke execute on function public.membro_foto_url(text) from public;
revoke execute on function public.membro_foto_pode(text) from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke execute on function public.membro_foto_definir(jsonb), public.membro_foto_url(text), public.membro_foto_pode(text) from anon';
  end if;
end $$;
grant execute on function public.membro_foto_definir(jsonb) to authenticated;
grant execute on function public.membro_foto_url(text)      to authenticated;
grant execute on function public.membro_foto_pode(text)     to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'Sem o schema storage: o bucket das fotos fica para quando houver.';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('fotos', 'fotos', true, 5242880, array['image/jpeg','image/png','image/webp'])
  on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
                                 allowed_mime_types = excluded.allowed_mime_types;

  execute 'drop policy if exists fotos_obj_insert on storage.objects';
  execute $p$create policy fotos_obj_insert on storage.objects for insert to authenticated
    with check (bucket_id = 'fotos' and public.membro_foto_pode(name))$p$;
  execute 'drop policy if exists fotos_obj_select on storage.objects';
  execute $p$create policy fotos_obj_select on storage.objects for select to authenticated
    using (bucket_id = 'fotos')$p$;
  execute 'drop policy if exists fotos_obj_update on storage.objects';
  execute $p$create policy fotos_obj_update on storage.objects for update to authenticated
    using (bucket_id = 'fotos' and public.membro_foto_pode(name))
    with check (bucket_id = 'fotos' and public.membro_foto_pode(name))$p$;
  execute 'drop policy if exists fotos_obj_delete on storage.objects';
  execute $p$create policy fotos_obj_delete on storage.objects for delete to authenticated
    using (bucket_id = 'fotos' and public.membro_foto_pode(name))$p$;
end $$;

-- ============================================================
-- 3. OS CARTÕES DE ATIVIDADES
-- ------------------------------------------------------------
alter table public.atividades add column if not exists pessoas   integer[] not null default '{}';
alter table public.atividades add column if not exists etiquetas text[]    not null default '{}';
alter table public.atividades add column if not exists copia_de  uuid references public.atividades(id) on delete set null;
alter table public.atividade_comentarios add column if not exists editado_em timestamptz;
comment on column public.atividades.pessoas is
  'Outras pessoas atribuídas, além do responsável (que nunca se repete aqui). Recebem o aviso, '
  'seguem o cartão e o veem em "Suas tarefas" e na carga.';
comment on column public.atividades.etiquetas is 'Etiquetas livres do cartão; a cor sai do nome, na tela.';
comment on column public.atividades.copia_de is 'O cartão de que este é cópia (atividade_copiar).';
create index if not exists atividades_pessoas_ix on public.atividades using gin (pessoas);

create table if not exists public.atividade_checklists (
  id           uuid primary key default gen_random_uuid(),
  atividade_id uuid not null references public.atividades(id) on delete cascade,
  titulo       text not null,
  ordem        numeric not null default 0,
  criado_por   integer references public.membros(registro) on delete set null,
  criado_em    timestamptz not null default now()
);
create index if not exists atv_check_ix on public.atividade_checklists (atividade_id, ordem);

create table if not exists public.atividade_checklist_itens (
  id           uuid primary key default gen_random_uuid(),
  checklist_id uuid not null references public.atividade_checklists(id) on delete cascade,
  texto        text not null,
  feito        boolean not null default false,
  ordem        numeric not null default 0,
  feito_por    integer references public.membros(registro) on delete set null,
  feito_em     timestamptz,
  criado_em    timestamptz not null default now()
);
create index if not exists atv_check_itens_ix on public.atividade_checklist_itens (checklist_id, ordem);
comment on table public.atividade_checklists is
  'As checklists de um cartão (pode ter mais de uma, cada uma com título). Escrita por atividade_checklist().';

alter table public.atividade_checklists      enable row level security;
alter table public.atividade_checklist_itens enable row level security;
drop policy if exists atvck_select on public.atividade_checklists;
create policy atvck_select on public.atividade_checklists
  for select to authenticated
  using (exists (select 1 from atividades a
                  where a.id = atividade_id and public.posso_ver_grupo(a.grupo_id)));
drop policy if exists atvci_select on public.atividade_checklist_itens;
create policy atvci_select on public.atividade_checklist_itens
  for select to authenticated
  using (exists (select 1 from atividade_checklists k join atividades a on a.id = k.atividade_id
                  where k.id = checklist_id and public.posso_ver_grupo(a.grupo_id)));

-- As pessoas de um jsonb: só registros de membros que existem, sem
-- repetir e sem o responsável — ele já está no cartão.
create or replace function public.atividade_pessoas_de(p jsonb, p_resp integer)
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(distinct m.registro order by m.registro), '{}')
    from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) t(v)
    join membros m on m.registro = case when t.v ~ '^[0-9]+$' then t.v::integer end
   where m.registro is distinct from p_resp;
$$;

-- As etiquetas de um jsonb: sem espaço sobrando, até 32 letras cada, no
-- máximo 10, e "Firmware" e "firmware" são a mesma (vale a primeira grafia).
create or replace function public.atividade_etiquetas_de(p jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(e order by o), '{}') from (
    select e, o from (
      select distinct on (lower(e)) e, o from (
        select left(regexp_replace(btrim(v), '\s+', ' ', 'g'), 32) as e, ord as o
          from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end)
               with ordinality t(v, ord)) y
       where e <> ''
       order by lower(e), o) z
     order by o limit 10) x;
$$;

-- Nomes, para o histórico: "Bruno Tavares, Carla Mendonça".
create or replace function public.atividade_nomes(p integer[])
returns text language sql stable security definer
set search_path = public as $$
  select string_agg(nome, ', ' order by nome) from membros where registro = any(p);
$$;

-- 3a. Criar (a da 15.0, mais as pessoas e as etiquetas)
create or replace function public.atividade_criar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_gid   integer := nullif(p->>'grupo_id','')::integer;
  v_seq   integer;
  v_cod   text;
  v_id    uuid;
  v_resp  integer := nullif(p->>'responsavel','')::integer;
  v_tit   text := nullif(trim(p->>'titulo'),'');
  v_pes   integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_tit is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
  if v_gid is null or not exists (select 1 from grupos where id = v_gid)
    then return jsonb_build_object('status','invalido','campo','grupo'); end if;
  if not public.sou_do_grupo(v_gid) then return jsonb_build_object('status','sem_permissao'); end if;
  v_pes := public.atividade_pessoas_de(p->'pessoas', v_resp);

  -- sequência por grupo: o lock evita dois códigos iguais quando duas
  -- pessoas criam ao mesmo tempo
  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_gid);
  select coalesce(max(seq),0) + 1 into v_seq from atividades where grupo_id = v_gid;
  select prefixo || '-' || v_seq::text into v_cod from grupos where id = v_gid;

  insert into atividades (codigo, grupo_id, seq, titulo, descricao, status, prioridade,
                          responsavel, pessoas, etiquetas, criado_por, prazo, estimativa_h, ordem)
  values (v_cod, v_gid, v_seq, v_tit,
          nullif(trim(p->>'descricao'),''),
          coalesce(nullif(p->>'status',''), 'a_fazer'),
          coalesce(nullif(p->>'prioridade',''), 'media'),
          v_resp, v_pes, public.atividade_etiquetas_de(p->'etiquetas'), v_reg,
          nullif(p->>'prazo','')::date,
          nullif(p->>'estimativa_h','')::numeric,
          extract(epoch from now()))
  returning id into v_id;

  insert into atividade_seguidores (atividade_id, registro)
  select v_id, r from unnest(array[v_reg, v_resp] || v_pes) r where r is not null
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo, para)
  values (v_id, v_reg, 'criou', v_cod);

  if v_resp is not null then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_id, v_reg, 'atribuiu', 'responsavel', (select nome from membros where registro = v_resp));
    perform public.notificar(array[v_resp], 'atividade_atribuida',
      v_cod || ' — ' || v_tit,
      'Você é responsável por esta atividade.',
      '#/atividades/card/' || v_cod);
  end if;
  if cardinality(v_pes) > 0 then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_id, v_reg, 'incluiu', 'pessoas', public.atividade_nomes(v_pes));
    perform public.notificar(v_pes, 'atividade_atribuida',
      v_cod || ' — ' || v_tit,
      'Você foi incluído nesta atividade.',
      '#/atividades/card/' || v_cod);
  end if;

  return jsonb_build_object('status','ok','id',v_id,'codigo',v_cod);
end $$;

-- 3b. Editar (a da 15.0, mais as pessoas, as etiquetas e o arquivar
--     que fica no histórico, porque agora se desarquiva)
create or replace function public.atividade_editar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_a      public.atividades%rowtype;
  v_novo   public.atividades%rowtype;
  v_segs   integer[];
  v_nome   text;
  v_resp   integer;
  v_pes    integer[];
  v_add    integer[];
  v_rem    integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.sou_do_grupo(v_a.grupo_id) then return jsonb_build_object('status','sem_permissao'); end if;

  v_resp := case when p ? 'responsavel' then nullif(p->>'responsavel','')::integer else v_a.responsavel end;
  -- quem vira responsável sai das outras pessoas: não se repete no cartão
  v_pes  := case when p ? 'pessoas' then public.atividade_pessoas_de(p->'pessoas', v_resp)
                 else array_remove(v_a.pessoas, v_resp) end;

  update atividades a set
    titulo       = coalesce(nullif(trim(p->>'titulo'),''), a.titulo),
    descricao    = case when p ? 'descricao'    then nullif(trim(p->>'descricao'),'')    else a.descricao end,
    status       = coalesce(nullif(p->>'status',''), a.status),
    prioridade   = coalesce(nullif(p->>'prioridade',''), a.prioridade),
    responsavel  = v_resp,
    pessoas      = v_pes,
    etiquetas    = case when p ? 'etiquetas' then public.atividade_etiquetas_de(p->'etiquetas') else a.etiquetas end,
    prazo        = case when p ? 'prazo'        then nullif(p->>'prazo','')::date          else a.prazo end,
    estimativa_h = case when p ? 'estimativa_h' then nullif(p->>'estimativa_h','')::numeric else a.estimativa_h end,
    ordem        = coalesce(nullif(p->>'ordem','')::numeric, a.ordem),
    arquivada    = coalesce(nullif(p->>'arquivada','')::boolean, a.arquivada),
    concluida_em = case when coalesce(nullif(p->>'status',''), a.status) = 'concluida'
                          and a.status <> 'concluida' then now()
                        when coalesce(nullif(p->>'status',''), a.status) <> 'concluida' then null
                        else a.concluida_em end,
    atualizado_em = now()
  where a.id = v_a.id
  returning * into v_novo;

  select coalesce(array_agg(registro),'{}') into v_segs
    from atividade_seguidores where atividade_id = v_a.id;

  -- o que mudou vira histórico e, quando importa, notificação
  if v_novo.status <> v_a.status then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'moveu', 'status', v_a.status, v_novo.status);
    perform public.notificar(v_segs, 'atividade_moveu',
      v_a.codigo || ' — ' || v_novo.titulo,
      'Agora em: ' || public.atividade_status_rotulo(v_novo.status),
      '#/atividades/card/' || v_a.codigo);
  end if;

  if coalesce(v_novo.responsavel,-1) <> coalesce(v_a.responsavel,-1) then
    select nome into v_nome from membros where registro = v_novo.responsavel;
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'atribuiu', 'responsavel',
            (select nome from membros where registro = v_a.responsavel), v_nome);
    if v_novo.responsavel is not null then
      insert into atividade_seguidores (atividade_id, registro)
      values (v_a.id, v_novo.responsavel) on conflict do nothing;
      perform public.notificar(array[v_novo.responsavel], 'atividade_atribuida',
        v_a.codigo || ' — ' || v_novo.titulo,
        'Você é responsável por esta atividade.',
        '#/atividades/card/' || v_a.codigo);
    end if;
  end if;

  -- as outras pessoas: quem entrou é avisado e passa a seguir; quem
  -- saiu por ter virado responsável não "saiu" do cartão
  v_add := array(select unnest(v_novo.pessoas) except select unnest(v_a.pessoas));
  v_rem := array(select unnest(v_a.pessoas) except select unnest(v_novo.pessoas)
                 except select v_novo.responsavel where v_novo.responsavel is not null);
  if cardinality(v_add) > 0 then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_a.id, v_reg, 'incluiu', 'pessoas', public.atividade_nomes(v_add));
    insert into atividade_seguidores (atividade_id, registro)
    select v_a.id, r from unnest(v_add) r on conflict do nothing;
    perform public.notificar(v_add, 'atividade_atribuida',
      v_a.codigo || ' — ' || v_novo.titulo,
      'Você foi incluído nesta atividade.',
      '#/atividades/card/' || v_a.codigo);
  end if;
  if cardinality(v_rem) > 0 then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_a.id, v_reg, 'retirou', 'pessoas', public.atividade_nomes(v_rem));
  end if;

  if v_novo.etiquetas is distinct from v_a.etiquetas then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'etiquetas', 'etiquetas',
            nullif(array_to_string(v_a.etiquetas, ', '), ''), nullif(array_to_string(v_novo.etiquetas, ', '), ''));
  end if;

  if coalesce(v_novo.prazo, '0001-01-01') <> coalesce(v_a.prazo, '0001-01-01') then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'prazo', 'prazo', v_a.prazo::text, v_novo.prazo::text);
    perform public.notificar(v_segs, 'atividade_prazo',
      v_a.codigo || ' — ' || v_novo.titulo,
      case when v_novo.prazo is null then 'Prazo removido.'
           else 'Novo prazo: ' || to_char(v_novo.prazo,'DD/MM/YYYY') end,
      '#/atividades/card/' || v_a.codigo);
  end if;

  if v_novo.prioridade <> v_a.prioridade then
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (v_a.id, v_reg, 'prioridade', 'prioridade', v_a.prioridade, v_novo.prioridade);
  end if;

  if v_novo.titulo <> v_a.titulo or coalesce(v_novo.descricao,'') <> coalesce(v_a.descricao,'') then
    insert into atividade_log (atividade_id, registro, tipo, campo)
    values (v_a.id, v_reg, 'editou', 'conteudo');
  end if;

  if v_novo.arquivada <> v_a.arquivada then
    insert into atividade_log (atividade_id, registro, tipo, campo)
    values (v_a.id, v_reg, case when v_novo.arquivada then 'arquivou' else 'restaurou' end, 'arquivada');
  end if;

  return jsonb_build_object('status','ok','codigo',v_a.codigo);
end $$;

-- 3c. As checklists: uma porta só, com a ação no campo "acao".
--       lista_criar     {atividade_id, titulo, texto?}  texto: os itens, um por linha
--       lista_renomear  {checklist_id, titulo}
--       lista_excluir   {checklist_id}
--       item_criar      {checklist_id, texto}  várias linhas, vários itens
--       item_editar     {item_id, texto}
--       item_marcar     {item_id, feito?}      sem "feito", inverte
--       item_excluir    {item_id}
--       item_mover      {item_id, ordem, checklist_id?}
--     Colar uma lista em Markdown funciona: "- [x] feito" entra marcado.
create or replace function public.atividade_checklist_linhas(p_ck uuid, p_txt text)
returns integer language plpgsql volatile security definer
set search_path = public as $$
declare
  v_ord  numeric;
  v_n    integer := 0;
  v_l    text;
  v_x    boolean;
begin
  select coalesce(max(ordem), 0) into v_ord from atividade_checklist_itens where checklist_id = p_ck;
  for v_l in select regexp_split_to_table(coalesce(p_txt,''), E'\n') loop
    v_x := v_l ~ '^\s*([-*+]|[0-9]+[.)])\s+\[[xX]\]\s+';
    v_l := btrim(regexp_replace(v_l, '^\s*(([-*+]|[0-9]+[.)])\s+)?(\[[ xX]\]\s+)?', ''));
    continue when v_l = '';
    v_ord := v_ord + 1;
    insert into atividade_checklist_itens (checklist_id, texto, feito, ordem, feito_por, feito_em)
    values (p_ck, left(v_l, 300), v_x, v_ord,
            case when v_x then public.portal_registro_atual() end, case when v_x then now() end);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke execute on function public.atividade_checklist_linhas(uuid, text) from public;

create or replace function public.atividade_checklist(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_acao  text    := coalesce(p->>'acao','');
  v_cid   uuid    := nullif(p->>'checklist_id','')::uuid;
  v_iid   uuid    := nullif(p->>'item_id','')::uuid;
  v_tit   text    := left(nullif(btrim(p->>'titulo'),''), 80);
  v_txt   text    := nullif(btrim(p->>'texto'),'');
  v_ck    public.atividade_checklists%rowtype;
  v_it    public.atividade_checklist_itens%rowtype;
  v_aid   uuid;
  v_gid   integer;
  v_novo  uuid;
  v_n     integer := 0;
  v_ord   numeric;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;

  -- de qual cartão é, para a regra de sempre: escrever é de quem edita o quadro
  if v_acao = 'lista_criar' then
    v_aid := nullif(p->>'atividade_id','')::uuid;
  elsif v_acao in ('lista_renomear','lista_excluir','item_criar') then
    select * into v_ck from atividade_checklists where id = v_cid;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    v_aid := v_ck.atividade_id;
  elsif v_acao in ('item_editar','item_marcar','item_excluir','item_mover') then
    select * into v_it from atividade_checklist_itens where id = v_iid;
    if not found then return jsonb_build_object('status','nao_encontrado'); end if;
    select * into v_ck from atividade_checklists where id = v_it.checklist_id;
    v_aid := v_ck.atividade_id;
  else
    return jsonb_build_object('status','invalido','campo','acao');
  end if;
  select grupo_id into v_gid from atividades where id = v_aid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.sou_do_grupo(v_gid) then return jsonb_build_object('status','sem_permissao'); end if;

  case v_acao
  when 'lista_criar' then
    select coalesce(max(ordem), 0) + 1 into v_ord from atividade_checklists where atividade_id = v_aid;
    insert into atividade_checklists (atividade_id, titulo, ordem, criado_por)
    values (v_aid, coalesce(v_tit, 'Checklist'), v_ord, v_reg) returning id into v_novo;
    if v_txt is not null then v_n := public.atividade_checklist_linhas(v_novo, v_txt); end if;
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_aid, v_reg, 'checklist', 'checklist', coalesce(v_tit, 'Checklist'));
  when 'lista_renomear' then
    if v_tit is null then return jsonb_build_object('status','invalido','campo','titulo'); end if;
    update atividade_checklists set titulo = v_tit where id = v_ck.id;
  when 'lista_excluir' then
    delete from atividade_checklists where id = v_ck.id;
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_aid, v_reg, 'checklist_excluida', 'checklist', v_ck.titulo);
  when 'item_criar' then
    if v_txt is null then return jsonb_build_object('status','invalido','campo','texto'); end if;
    v_n := public.atividade_checklist_linhas(v_ck.id, v_txt);
    select id into v_novo from atividade_checklist_itens where checklist_id = v_ck.id order by ordem desc limit 1;
  when 'item_editar' then
    if v_txt is null then return jsonb_build_object('status','invalido','campo','texto'); end if;
    update atividade_checklist_itens set texto = left(v_txt, 300) where id = v_it.id;
  when 'item_marcar' then
    update atividade_checklist_itens i set
      feito     = coalesce(nullif(p->>'feito','')::boolean, not i.feito),
      feito_por = case when coalesce(nullif(p->>'feito','')::boolean, not i.feito) then v_reg end,
      feito_em  = case when coalesce(nullif(p->>'feito','')::boolean, not i.feito) then now() end
     where i.id = v_it.id
    returning * into v_it;
    if v_it.feito then
      insert into atividade_log (atividade_id, registro, tipo, campo, para)
      values (v_aid, v_reg, 'concluiu_item', 'checklist', v_it.texto);
    end if;
  when 'item_excluir' then
    delete from atividade_checklist_itens where id = v_it.id;
  when 'item_mover' then
    if v_cid is not null and v_cid <> v_it.checklist_id
       and not exists (select 1 from atividade_checklists where id = v_cid and atividade_id = v_aid) then
      return jsonb_build_object('status','invalido','campo','checklist_id');
    end if;
    update atividade_checklist_itens set
      checklist_id = coalesce(v_cid, checklist_id),
      ordem        = coalesce(nullif(p->>'ordem','')::numeric, ordem)
     where id = v_it.id;
  end case;

  update atividades set atualizado_em = now() where id = v_aid;
  return jsonb_build_object('status','ok','id',v_novo,'itens',v_n);
end $$;

-- 3d. Copiar o cartão para outro quadro (ou para o mesmo: é duplicar).
--     p: { id, grupo_id, status?, titulo?, arquivar?,
--          com: { descricao, pessoas, etiquetas, prazo, checklists } }  todos true por padrão
--     Ler o original basta para copiar (quem lê já vê tudo o que vai na
--     cópia); a cópia é escrita, então o quadro de destino tem de ser de
--     edição. Arquivar o original — o "mover" — pede edição nos dois.
--     Comentários e histórico não vão: são a conversa do cartão de lá.
create or replace function public.atividade_copiar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_a     public.atividades%rowtype;
  v_gid   integer := nullif(p->>'grupo_id','')::integer;
  v_com   jsonb   := case when jsonb_typeof(p->'com') = 'object' then p->'com' else '{}'::jsonb end;
  v_arq   boolean := coalesce(nullif(p->>'arquivar','')::boolean, false);
  v_st    text;
  v_tit   text;
  v_pref  text;
  v_gnome text;
  v_seq   integer;
  v_cod   text;
  v_id    uuid;
  v_resp  integer;
  v_pes   integer[] := '{}';
  v_ck    uuid;
  r       record;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found or not public.posso_ver_grupo(v_a.grupo_id) then
    return jsonb_build_object('status','nao_encontrado'); end if;
  select prefixo, nome into v_pref, v_gnome from grupos where id = v_gid and ativo;
  if v_pref is null then return jsonb_build_object('status','invalido','campo','grupo'); end if;
  if not public.sou_do_grupo(v_gid) then return jsonb_build_object('status','sem_permissao','campo','grupo'); end if;
  if v_arq and not public.sou_do_grupo(v_a.grupo_id) then
    return jsonb_build_object('status','sem_permissao','campo','arquivar'); end if;
  v_st := coalesce(nullif(p->>'status',''), v_a.status);
  if v_st not in ('backlog','a_fazer','fazendo','revisao','concluida') then
    return jsonb_build_object('status','invalido','campo','status'); end if;
  v_tit := coalesce(nullif(btrim(p->>'titulo'),''), v_a.titulo);
  if coalesce((v_com->>'pessoas')::boolean, true) then
    v_resp := v_a.responsavel; v_pes := v_a.pessoas;
  end if;

  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_gid);
  select coalesce(max(seq),0) + 1 into v_seq from atividades where grupo_id = v_gid;
  v_cod := v_pref || '-' || v_seq::text;

  insert into atividades (codigo, grupo_id, seq, titulo, descricao, status, prioridade, responsavel, pessoas,
                          etiquetas, criado_por, prazo, estimativa_h, ordem, copia_de, concluida_em)
  values (v_cod, v_gid, v_seq, v_tit,
          case when coalesce((v_com->>'descricao')::boolean, true) then v_a.descricao end,
          v_st, v_a.prioridade, v_resp, v_pes,
          case when coalesce((v_com->>'etiquetas')::boolean, true) then v_a.etiquetas else '{}' end,
          v_reg,
          case when coalesce((v_com->>'prazo')::boolean, true) then v_a.prazo end,
          v_a.estimativa_h, extract(epoch from now()), v_a.id,
          case when v_st = 'concluida' then now() end)
  returning id into v_id;

  if coalesce((v_com->>'checklists')::boolean, true) then
    for r in select * from atividade_checklists where atividade_id = v_a.id order by ordem loop
      insert into atividade_checklists (atividade_id, titulo, ordem, criado_por)
      values (v_id, r.titulo, r.ordem, v_reg) returning id into v_ck;
      insert into atividade_checklist_itens (checklist_id, texto, feito, ordem, feito_por, feito_em)
      select v_ck, i.texto, i.feito, i.ordem, i.feito_por, i.feito_em
        from atividade_checklist_itens i where i.checklist_id = r.id;
    end loop;
  end if;

  insert into atividade_seguidores (atividade_id, registro)
  select v_id, x from unnest(array[v_reg, v_resp] || v_pes) x where x is not null
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_id, v_reg, 'copiou_de', 'copia', v_a.codigo);
  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_a.id, v_reg, 'copiou_para', 'copia', v_cod);

  perform public.notificar(array[v_resp] || v_pes, 'atividade_atribuida',
    v_cod || ' — ' || v_tit,
    'Cópia de ' || v_a.codigo || ', no quadro ' || v_gnome || '.',
    '#/atividades/card/' || v_cod);

  if v_arq and not v_a.arquivada then
    update atividades set arquivada = true, atualizado_em = now() where id = v_a.id;
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_a.id, v_reg, 'arquivou', 'arquivada', v_cod);
  end if;

  return jsonb_build_object('status','ok','id',v_id,'codigo',v_cod);
end $$;

-- 3e. O próprio comentário: corrigir e apagar. Menção nova na correção
--     avisa quem entrou; quem já tinha sido avisado não recebe de novo.
create or replace function public.atividade_comentario_editar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_c     public.atividade_comentarios%rowtype;
  v_a     public.atividades%rowtype;
  v_corpo text := nullif(trim(p->>'corpo'),'');
  v_menc  integer[];
  v_novos integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_corpo is null then return jsonb_build_object('status','invalido','campo','corpo'); end if;
  select * into v_c from atividade_comentarios where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  select * into v_a from atividades where id = v_c.atividade_id;
  if v_c.registro is distinct from v_reg or not public.sou_do_grupo(v_a.grupo_id) then
    return jsonb_build_object('status','sem_permissao'); end if;

  select coalesce(array_agg(distinct v::integer),'{}') into v_menc
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'mencionados') = 'array' then p->'mencionados' else '[]'::jsonb end) t(v)
   where v ~ '^[0-9]+$' and exists (select 1 from membros where registro = v::integer);
  v_novos := array(select unnest(v_menc) except select unnest(v_c.mencionados));

  update atividade_comentarios set corpo = v_corpo, mencionados = v_menc, editado_em = now()
   where id = v_c.id;
  if cardinality(v_novos) > 0 then
    insert into atividade_seguidores (atividade_id, registro)
    select v_a.id, r from unnest(v_novos) r on conflict do nothing;
    perform public.notificar(v_novos, 'atividade_mencao',
      v_a.codigo || ' — ' || v_a.titulo,
      'Você foi mencionado em um comentário.',
      '#/atividades/card/' || v_a.codigo);
  end if;
  return jsonb_build_object('status','ok');
end $$;

create or replace function public.atividade_comentario_excluir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_c   public.atividade_comentarios%rowtype;
begin
  if v_reg is null and public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_registro'); end if;
  select * into v_c from atividade_comentarios where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  -- o autor apaga o seu; admin e pessoal moderam
  if v_c.registro is distinct from v_reg and public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao'); end if;
  delete from atividade_comentarios where id = v_c.id;
  insert into atividade_log (atividade_id, registro, tipo, campo)
  values (v_c.atividade_id, v_reg, 'apagou_comentario', 'comentario');
  return jsonb_build_object('status','ok');
end $$;

do $$
declare f text;
begin
  foreach f in array array['atividade_criar','atividade_editar','atividade_checklist','atividade_copiar',
                           'atividade_comentario_editar','atividade_comentario_excluir'] loop
    execute format('revoke execute on function public.%I(jsonb) from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%I(jsonb) from anon', f); end if;
    execute format('grant execute on function public.%I(jsonb) to authenticated', f);
  end loop;
end $$;
revoke execute on function public.atividade_pessoas_de(jsonb, integer) from public;
revoke execute on function public.atividade_nomes(integer[]) from public;

-- 3f. O quadro e a carga. O quadro ganha as pessoas, as etiquetas, de
--     onde veio a cópia e a conta da checklist (o "3/5" do cartão). A
--     carga passa a contar também quem está nas outras pessoas: quem foi
--     atribuído carrega o trabalho junto.
drop view if exists public.atividades_quadro;
create view public.atividades_quadro
  -- SEM isto a view roda como dona e devolve TODO cartão, inclusive os
  -- do quadro reservado (veja a 15.0)
  with (security_invoker = true) as
select a.id, a.codigo, a.grupo_id, a.seq, a.titulo, a.descricao, a.status,
       a.prioridade, a.responsavel, a.criado_por, a.prazo, a.estimativa_h,
       a.sinalizada, a.sinalizada_motivo, a.sinalizada_por, a.sinalizada_em,
       a.ordem, a.arquivada, a.origem_tipo, a.origem_id,
       a.criado_em, a.atualizado_em, a.concluida_em,
       g.nome    as grupo,
       g.prefixo as grupo_prefixo,
       g.cor     as grupo_cor,
       mr.nome   as responsavel_nome,
       mc.nome   as criado_por_nome,
       (select count(*) from atividade_comentarios c where c.atividade_id = a.id) as comentarios,
       (a.prazo is not null and a.prazo < current_date and a.status <> 'concluida') as atrasada,
       a.pessoas, a.etiquetas, a.copia_de,
       (select o.codigo from atividades o where o.id = a.copia_de) as copia_de_codigo,
       (select count(*) from atividade_checklist_itens i join atividade_checklists k on k.id = i.checklist_id
         where k.atividade_id = a.id) as check_total,
       (select count(*) from atividade_checklist_itens i join atividade_checklists k on k.id = i.checklist_id
         where k.atividade_id = a.id and i.feito) as check_feitos
  from atividades a
  join grupos  g  on g.id = a.grupo_id
  left join membros mr on mr.registro = a.responsavel
  left join membros mc on mc.registro = a.criado_por;

comment on view public.atividades_quadro is
  'O que a tela do quadro precisa, já resolvido: nome do grupo, do responsável e de quem criou, '
  'as outras pessoas, as etiquetas, a conta da checklist, a contagem de comentários e o cálculo '
  'de atrasada. Dona desde a 2.17.0.';

drop view if exists public.atividades_carga;
create view public.atividades_carga as
select m.registro, m.nome, m.grupos,
       count(a.id) filter (where a.status <> 'concluida')                           as abertas,
       count(a.id) filter (where a.status = 'fazendo')                              as fazendo,
       count(a.id) filter (where a.prazo < current_date and a.status <> 'concluida') as atrasadas,
       count(a.id) filter (where a.sinalizada)                                      as sinalizadas,
       coalesce(sum(a.estimativa_h) filter (where a.status <> 'concluida'), 0)      as horas_abertas
  from membros m
  left join atividades a on (a.responsavel = m.registro or m.registro = any(a.pessoas)) and not a.arquivada
 where m.status in ('Ativo','Em pausa / avaliação')
 group by m.registro, m.nome, m.grupos;

-- ============================================================
-- 4. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('2.17.0_notas_fotos_e_cartoes', 'SOMA 2.17.0: bugs e sugestões nas notas de versão (soma_feedback, votos e comentários), a foto enviada pelo portal (bucket "fotos", membro_foto_definir) e os cartões de Atividades com outras pessoas, etiquetas, checklists, cópia para outro quadro e comentário editável')
on conflict (id) do nothing;

-- ============================================================
-- CONFERIR
--   select id, aplicada_em from public.migracoes order by aplicada_em desc limit 3;
--   select id, public from storage.buckets where id = 'fotos';
--   select codigo, pessoas, etiquetas, check_total, check_feitos from public.atividades_quadro limit 5;
-- ============================================================
