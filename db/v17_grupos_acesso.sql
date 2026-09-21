-- ============================================================
-- SOMA 17.0 — MIGRAÇÃO · NeuroDynamics
-- QUEM ENXERGA QUAL QUADRO.
--
-- Até aqui um grupo era "aberto" ou "reservado", e reservado
-- queria dizer: só quem está no grupo. Não havia meio-termo — não
-- dava para deixar alguém de fora do grupo acompanhar o quadro
-- dele, nem para um analista ficar de fora do quadro da gerência
-- sem que o quadro inteiro fechasse para todo mundo.
--
-- Agora cada pessoa tem um NÍVEL em cada grupo:
--
--   nenhum   vê que o quadro existe, não vê os cartões
--   leitura  lê os cartões, não mexe
--   edicao   cria, move, comenta
--
-- e o nível sai de quatro coisas, nesta ordem:
--
--   1. admin e pessoal                      -> edicao (em tudo)
--   2. estar no grupo pela ficha            -> edicao
--   3. um acesso concedido na tela de Grupos -> o que foi concedido
--   4. o grupo não ser reservado            -> leitura
--   senão                                   -> nenhum
--
-- O item 4 é o que mantém a transparência: quadro comum continua
-- aberto para a equipe inteira ler. O item 1 é o que impede
-- alguém de se trancar para fora do próprio sistema.
--
-- "Ver que existe" é de propósito: a lista de grupos continua
-- pública. Um quadro que some não é um quadro fechado, é um
-- quadro que ninguém sabe que precisa pedir acesso.
--
-- Pré-requisito: SOMA 16.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.posso_ver_grupo(integer)') is null then
    raise exception using message = 'Falta aplicar a v15/v16 antes desta migração.',
      detail = 'A 17.0 reescreve posso_ver_grupo, criada pela 15.0.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. OS ACESSOS CONCEDIDOS
-- ------------------------------------------------------------
create table if not exists public.grupo_acessos (
  grupo_id      integer not null references public.grupos(id) on delete cascade,
  registro      integer not null references public.membros(registro) on delete cascade,
  nivel         text not null default 'leitura' check (nivel in ('leitura','edicao')),
  concedido_por integer references public.membros(registro) on delete set null,
  concedido_em  timestamptz not null default now(),
  primary key (grupo_id, registro)
);

comment on table public.grupo_acessos is
  'Acesso a um quadro para quem NÃO está no grupo. Quem está no grupo pela '
  'ficha já tem edição e não precisa de linha aqui.';

create index if not exists grupo_acessos_reg_ix on public.grupo_acessos (registro);

alter table public.grupo_acessos enable row level security;
drop policy if exists gacc_select on public.grupo_acessos;
create policy gacc_select on public.grupo_acessos
  for select to authenticated
  using (registro = public.portal_registro_atual()
         or public.papel_atual() in ('admin','pessoal'));
-- escrita só pelas funções da seção 4

-- ------------------------------------------------------------
-- 2. O NÍVEL — uma fonte só para as três perguntas
-- ------------------------------------------------------------
create or replace function public.meu_nivel_no_grupo(p_grupo_id integer)
returns text language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_nome  text;
  v_res   boolean;
  v_niv   text;
begin
  if public.papel_atual() in ('admin','pessoal') then return 'edicao'; end if;
  if p_grupo_id is null then return 'nenhum'; end if;

  select nome, reservado into v_nome, v_res from grupos where id = p_grupo_id;
  if v_nome is null then return 'nenhum'; end if;
  if v_reg is null then return case when v_res then 'nenhum' else 'leitura' end; end if;

  if exists (select 1 from membros m
              where m.registro = v_reg and m.grupos @> array[v_nome])
    then return 'edicao'; end if;

  select nivel into v_niv from grupo_acessos
   where grupo_id = p_grupo_id and registro = v_reg;
  if v_niv is not null then return v_niv; end if;

  return case when v_res then 'nenhum' else 'leitura' end;
end $$;

comment on function public.meu_nivel_no_grupo(integer) is
  'nenhum | leitura | edicao. É a única regra de acesso a quadro no sistema — '
  'as outras funções perguntam para esta.';

create or replace function public.posso_ver_grupo(p_grupo_id integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.meu_nivel_no_grupo(p_grupo_id) <> 'nenhum';
$$;

create or replace function public.posso_editar_grupo(p_grupo_id integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.meu_nivel_no_grupo(p_grupo_id) = 'edicao';
$$;

-- Nome herdado: as funções da 15.0 e da 16.0 chamam por ele, e
-- reescrever todas para trocar o nome seria mexer em muita coisa
-- para ganhar nada. Hoje quer dizer "posso agir neste grupo".
create or replace function public.sou_do_grupo(p_grupo_id integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.posso_editar_grupo(p_grupo_id);
$$;

comment on function public.sou_do_grupo(integer) is
  'Apelido histórico de posso_editar_grupo. Mantido porque as funções das '
  'migrações 15.0 e 16.0 chamam por este nome.';

-- ------------------------------------------------------------
-- 3. A LISTA QUE A TELA LÊ
--    Todo grupo ativo aparece, inclusive os que a pessoa não pode
--    abrir — é assim que ela descobre que existe um quadro para
--    pedir acesso. O que não vem é o conteúdo.
-- ------------------------------------------------------------
drop view if exists public.grupos_visiveis;
create view public.grupos_visiveis with (security_invoker = true) as
select g.id, g.nome, g.prefixo, g.cor, g.ordem, g.reservado, g.chave,
       public.meu_nivel_no_grupo(g.id) as meu_nivel,
       (select count(*) from membros m
         where m.grupos @> array[g.nome]
           and m.status in ('Ativo','Em pausa / avaliação')) as pessoas
  from grupos g
 where g.ativo
 order by g.ordem, g.nome;

comment on view public.grupos_visiveis is
  'Todo grupo ativo, com o meu nível em cada um. A lista é pública de '
  'propósito: quadro que some não é quadro fechado, é quadro que ninguém '
  'sabe que precisa pedir acesso.';

-- ------------------------------------------------------------
-- 4. A TELA DE GRUPOS (Administração)
-- ------------------------------------------------------------

-- 4a. Criar ou editar um grupo.
--     Renomear é a parte delicada: quem está no grupo é uma lista
--     de NOMES dentro de membros.grupos. Trocar o nome aqui sem
--     trocar lá esvaziaria o grupo em silêncio — então as duas
--     coisas acontecem na mesma transação.
create or replace function public.grupo_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id    integer := nullif(p->>'id','')::integer;
  v_nome  text    := nullif(trim(p->>'nome'),'');
  v_pref  text    := upper(nullif(trim(p->>'prefixo'),''));
  v_antes text;
  v_n     integer;
begin
  if public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_nome is null then return jsonb_build_object('status','invalido','campo','nome'); end if;
  if v_pref is null or v_pref !~ '^[A-Z][A-Z0-9]{1,5}$' then
    return jsonb_build_object('status','invalido','campo','prefixo');
  end if;
  if exists (select 1 from grupos where nome = v_nome and id is distinct from v_id) then
    return jsonb_build_object('status','duplicado','campo','nome');
  end if;
  if exists (select 1 from grupos where prefixo = v_pref and id is distinct from v_id) then
    return jsonb_build_object('status','duplicado','campo','prefixo');
  end if;

  if v_id is null then
    insert into grupos (nome, prefixo, cor, reservado, ordem)
    values (v_nome, v_pref,
            nullif(p->>'cor',''),
            coalesce((p->>'reservado')::boolean, false),
            coalesce(nullif(p->>'ordem','')::integer, 0))
    returning id into v_id;
    return jsonb_build_object('status','ok','id',v_id,'renomeados',0);
  end if;

  select nome into v_antes from grupos where id = v_id;
  if v_antes is null then return jsonb_build_object('status','nao_encontrado'); end if;

  update grupos
     set nome      = v_nome,
         prefixo   = v_pref,
         cor       = nullif(p->>'cor',''),
         reservado = coalesce((p->>'reservado')::boolean, reservado),
         ativo     = coalesce((p->>'ativo')::boolean, ativo),
         ordem     = coalesce(nullif(p->>'ordem','')::integer, ordem)
   where id = v_id;

  v_n := 0;
  if v_antes <> v_nome then
    update membros
       set grupos = array_replace(grupos, v_antes, v_nome)
     where grupos @> array[v_antes];
    get diagnostics v_n = row_count;
  end if;

  return jsonb_build_object('status','ok','id',v_id,'renomeados',v_n);
end $$;
revoke execute on function public.grupo_salvar(jsonb) from public, anon;
grant  execute on function public.grupo_salvar(jsonb) to authenticated;

-- 4b. Juntar dois grupos que eram o mesmo escrito de dois jeitos.
--     ("NRO_ORTESE" e "Órtese" viraram dois quadros; isto faz
--      virar um, levando junto as atividades e as pessoas.)
create or replace function public.grupo_fundir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_de    integer := nullif(p->>'de','')::integer;
  v_para  integer := nullif(p->>'para','')::integer;
  v_nd    text; v_np text;
  v_seq   integer; v_pref text;
  v_ats   integer := 0; v_mem integer := 0;
  r       record;
begin
  if public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_de is null or v_para is null or v_de = v_para then
    return jsonb_build_object('status','invalido');
  end if;
  select nome into v_nd from grupos where id = v_de;
  select nome, prefixo into v_np, v_pref from grupos where id = v_para;
  if v_nd is null or v_np is null then return jsonb_build_object('status','nao_encontrado'); end if;

  -- as atividades mudam de quadro e ganham código novo, porque o
  -- código carrega o prefixo do grupo. O antigo fica no histórico.
  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_para);
  select coalesce(max(seq),0) into v_seq from atividades where grupo_id = v_para;
  for r in select id, codigo from atividades where grupo_id = v_de order by seq loop
    v_seq := v_seq + 1;
    update atividades
       set grupo_id = v_para, seq = v_seq, codigo = v_pref || '-' || v_seq::text
     where id = r.id;
    insert into atividade_log (atividade_id, registro, tipo, campo, de, para)
    values (r.id, public.portal_registro_atual(), 'editou', 'grupo', r.codigo,
            v_pref || '-' || v_seq::text);
    v_ats := v_ats + 1;
  end loop;

  -- as pessoas passam a constar no grupo que ficou
  update membros
     set grupos = (select array_agg(distinct x)
                     from unnest(array_replace(grupos, v_nd, v_np)) x)
   where grupos @> array[v_nd];
  get diagnostics v_mem = row_count;

  update grupo_acessos set grupo_id = v_para
   where grupo_id = v_de
     and not exists (select 1 from grupo_acessos o
                      where o.grupo_id = v_para and o.registro = grupo_acessos.registro);
  delete from grupo_acessos where grupo_id = v_de;
  delete from grupos where id = v_de;

  return jsonb_build_object('status','ok','atividades',v_ats,'pessoas',v_mem,'nome',v_np);
end $$;
revoke execute on function public.grupo_fundir(jsonb) from public, anon;
grant  execute on function public.grupo_fundir(jsonb) to authenticated;

-- 4c. Conceder ou tirar acesso a um quadro.
create or replace function public.grupo_acesso_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_g   integer := nullif(p->>'grupo_id','')::integer;
  v_r   integer := nullif(p->>'registro','')::integer;
  v_n   text    := coalesce(nullif(p->>'nivel',''), 'nenhum');
  v_eu  integer := public.portal_registro_atual();
  v_gn  text;
begin
  if public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_g is null or v_r is null then return jsonb_build_object('status','invalido'); end if;
  if v_n not in ('nenhum','leitura','edicao') then
    return jsonb_build_object('status','invalido','campo','nivel');
  end if;
  select nome into v_gn from grupos where id = v_g;
  if v_gn is null then return jsonb_build_object('status','nao_encontrado'); end if;

  if v_n = 'nenhum' then
    delete from grupo_acessos where grupo_id = v_g and registro = v_r;
    return jsonb_build_object('status','ok','nivel','nenhum');
  end if;

  insert into grupo_acessos (grupo_id, registro, nivel, concedido_por)
  values (v_g, v_r, v_n, v_eu)
  on conflict (grupo_id, registro) do update
    set nivel = excluded.nivel, concedido_por = excluded.concedido_por,
        concedido_em = now();

  perform public.notificar(array[v_r], 'quadro_liberado',
    'Você tem acesso ao quadro ' || v_gn,
    case v_n when 'edicao' then 'Pode criar e mover atividades.'
             else 'Pode acompanhar, sem mexer.' end,
    '#/atividades');

  return jsonb_build_object('status','ok','nivel',v_n);
end $$;
revoke execute on function public.grupo_acesso_salvar(jsonb) from public, anon;
grant  execute on function public.grupo_acesso_salvar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 4d. TRÊS FUNÇÕES DE ESCRITA QUE NÃO CHECAVAM NADA
--
--     comentar, sinalizar e seguir nasceram na 15.0 sem nenhuma
--     verificação de grupo. Como são security definer, elas
--     passavam por cima da RLS: quem tivesse o id de um cartão do
--     quadro reservado comentava nele, sinalizava, e — no caso do
--     seguir — passava a receber por notificação o título e o
--     corpo do que acontecesse ali.
--
--     Os corpos abaixo são IDÊNTICOS aos da 15.0 já corrigida. Estão
--     repetidos aqui de propósito: a 15.0 corrige quem instala do
--     zero, e esta corrige quem já tinha a 15.0 aplicada. Rodar
--     qualquer uma das duas, em qualquer ordem, chega no mesmo
--     lugar.
-- ------------------------------------------------------------

create or replace function public.atividade_comentar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_a     public.atividades%rowtype;
  v_corpo text := nullif(trim(p->>'corpo'),'');
  v_menc  integer[];
  v_segs  integer[];
  v_id    uuid;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_corpo is null then return jsonb_build_object('status','invalido','campo','corpo'); end if;
  select * into v_a from atividades where id = nullif(p->>'atividade_id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  -- comentar é escrever: vale a mesma regra de mover um cartão. Sem
  -- esta linha quem só lê o quadro comentava nele — e, pior, a função
  -- é security definer, então nem a RLS do quadro reservado barrava
  -- quem tivesse o id de um cartão.
  if not public.sou_do_grupo(v_a.grupo_id) then
    return jsonb_build_object('status','sem_permissao'); end if;

  select coalesce(array_agg(distinct v::integer),'{}') into v_menc
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'mencionados') = 'array' then p->'mencionados' else '[]'::jsonb end) t(v)
   where v ~ '^\d+$';

  insert into atividade_comentarios (atividade_id, registro, corpo, mencionados)
  values (v_a.id, v_reg, v_corpo, v_menc) returning id into v_id;

  insert into atividade_seguidores (atividade_id, registro)
  select v_a.id, r from unnest(v_menc || array[v_reg]) r where r is not null
  on conflict do nothing;

  insert into atividade_log (atividade_id, registro, tipo) values (v_a.id, v_reg, 'comentou');

  select coalesce(array_agg(registro),'{}') into v_segs
    from atividade_seguidores where atividade_id = v_a.id;

  -- mencionado recebe um aviso mais forte do que quem só segue
  if array_length(v_menc,1) > 0 then
    perform public.notificar(v_menc, 'atividade_mencao',
      v_a.codigo || ' — ' || v_a.titulo,
      'Você foi mencionado em um comentário.',
      '#/atividades/card/' || v_a.codigo);
  end if;
  perform public.notificar(
    array(select unnest(v_segs) except select unnest(coalesce(v_menc,'{}'))),
    'atividade_comentario', v_a.codigo || ' — ' || v_a.titulo,
    'Novo comentário.', '#/atividades/card/' || v_a.codigo);

  return jsonb_build_object('status','ok','id',v_id);
end $$;

create or replace function public.atividade_sinalizar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_a    public.atividades%rowtype;
  v_on   boolean := coalesce(nullif(p->>'sinalizada','')::boolean, true);
  v_mot  text := nullif(trim(p->>'motivo'),'');
  v_alvo integer[];
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;

  update atividades set sinalizada = v_on,
         sinalizada_motivo = case when v_on then v_mot else null end,
         sinalizada_por = case when v_on then v_reg else null end,
         sinalizada_em = case when v_on then now() else null end,
         atualizado_em = now()
   where id = v_a.id;

  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_a.id, v_reg, case when v_on then 'sinalizou' else 'dessinalizou' end, 'sinalizada', v_mot);

  if v_on then
    -- sinalizar escala: avisa os seguidores e o gestor de quem responde
    select coalesce(array_agg(registro),'{}') into v_alvo
      from atividade_seguidores where atividade_id = v_a.id;
    v_alvo := v_alvo || array(
      select m.gestor_registro from membros m
       where m.registro = v_a.responsavel and m.gestor_registro is not null);
    perform public.notificar(v_alvo, 'atividade_sinalizada',
      v_a.codigo || ' — ' || v_a.titulo,
      coalesce(v_mot, 'Sinalizada como precisando de atenção.'),
      '#/atividades/card/' || v_a.codigo);
  end if;

  return jsonb_build_object('status','ok');
end $$;

create or replace function public.atividade_seguir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare v_reg integer := public.portal_registro_atual();
        v_id  uuid := nullif(p->>'id','')::uuid;
        v_on  boolean := coalesce(nullif(p->>'seguir','')::boolean, true);
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  -- seguir é só pedir aviso, então basta poder VER o quadro. Mas tem de
  -- ser checado: sem isto, quem soubesse o id de um cartão do quadro
  -- reservado passava a receber notificação do conteúdo dele.
  if not public.posso_ver_grupo((select grupo_id from atividades where id = v_id)) then
    return jsonb_build_object('status','sem_permissao'); end if;
  if v_on then
    insert into atividade_seguidores (atividade_id, registro) values (v_id, v_reg) on conflict do nothing;
  else
    delete from atividade_seguidores where atividade_id = v_id and registro = v_reg;
  end if;
  return jsonb_build_object('status','ok');
end $$;

-- ------------------------------------------------------------
-- 5. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v17_grupos_acesso', 'Nível por pessoa em cada quadro (nenhum/leitura/edicao), acessos concedidos, e a tela de Grupos: renomear, fundir e conceder')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 17.0
--
-- Depois de rodar, a tela é Administração -> Grupos. É por lá que
-- se arruma prefixo, se junta grupo duplicado e se dá acesso.
--
-- Renomear um grupo ali TAMBÉM renomeia na ficha de todo mundo,
-- na mesma transação — é seguro.
-- ============================================================
