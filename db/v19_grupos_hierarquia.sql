-- ============================================================
-- SOMA 19.0 — MIGRAÇÃO · NeuroDynamics
-- GRUPOS DENTRO DE GRUPOS.
--
-- Até aqui os grupos eram uma lista plana. Agora um grupo pode ter
-- um PAI: NRO_LEADERSHIP contém NRO_MANAGERS e NRO_SUPERVISORS;
-- NRO_PROJECTS contém um grupo por projeto.
--
-- A regra é uma só, e sobe: quem está num grupo está também em
-- todos os grupos acima dele. Pôr alguém em NRO_PROJECT_NEBULA põe
-- essa pessoa em NRO_PROJECTS, sem ninguém escrever NRO_PROJECTS na
-- ficha dela; tirar de NEBULA tira de PROJECTS, a menos que ela
-- esteja lá por outro caminho.
--
-- Por que calcular, e não copiar para a ficha: copiado, mover um
-- grupo de pai obrigaria a reescrever a ficha de todo mundo abaixo
-- dele, e tirar alguém de um projeto teria de adivinhar se o
-- PROJECTS da ficha veio do projeto ou foi posto à mão. Calculado,
-- membros.grupos continua guardando só o que alguém decidiu.
--
-- Um pai só por grupo, de propósito: é árvore, não rede. É o que se
-- desenha numa tela sem cruzar linha, e é o modelo das equipes
-- aninhadas do GitHub, em que cada equipe tem no máximo uma equipe
-- mãe. O dia em que isto controlar acesso a repositório, cada grupo
-- vira uma equipe e o pai continua sendo o pai.
--
-- E três coisas que vêm junto:
--   - um grupo pode NÃO ter quadro de atividades. Grupo guarda-chuva
--     (NRO_PROJECTS, NRO_LEADERSHIP) existe para dar acesso, não para
--     ter trabalho, e não precisa aparecer em Atividades;
--   - um grupo pode ter RESPONSÁVEIS: quem, além de admin e pessoal,
--     põe e tira gente dele e dos grupos abaixo dele. É o supervisor
--     de um projeto cuidando da própria equipe (a 20.0 faz isso
--     sozinha). No GitHub, é o "maintainer" da equipe;
--   - pôr e tirar várias pessoas de uma vez, pela tela de Grupos,
--     deixando na ficha a mesma ocorrência que a edição da ficha já
--     deixa ("Adição a grupo").
--
-- Pré-requisito: SOMA 17.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.grupo_acessos') is null then
    raise exception using message = 'Falta aplicar a v17 antes desta migração.',
      detail = 'A 19.0 reescreve meu_nivel_no_grupo e grupos_visiveis, da 17.0.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. AS COLUNAS
-- ------------------------------------------------------------
alter table public.grupos add column if not exists pai_id       integer
  references public.grupos(id) on delete set null;
alter table public.grupos add column if not exists quadro       boolean not null default true;
alter table public.grupos add column if not exists descricao    text;
alter table public.grupos add column if not exists responsaveis integer[] not null default '{}';

create index if not exists grupos_pai_ix on public.grupos (pai_id);

comment on column public.grupos.pai_id is
  'O grupo de cima. Quem está neste grupo está também no pai, no avô e '
  'assim por diante — calculado por esta_no_grupo(), nunca gravado na ficha.';
comment on column public.grupos.quadro is
  'Se o grupo tem quadro em Atividades. Grupo guarda-chuva, que só existe '
  'para dar acesso (NRO_PROJECTS), não precisa de quadro.';
comment on column public.grupos.responsaveis is
  'Registros de quem, além de admin e pessoal, põe e tira gente deste grupo '
  'e dos grupos abaixo dele. O supervisor de um projeto entra aqui.';

-- ------------------------------------------------------------
-- 2. A ÁRVORE NÃO PODE VIRAR CÍRCULO
--    A tela já não oferece um pai que criaria ciclo; isto é o que
--    garante, para quem escrever direto no banco.
-- ------------------------------------------------------------
create or replace function public.tg_grupo_sem_ciclo()
returns trigger language plpgsql as $$
begin
  if new.pai_id is null then return new; end if;
  if new.pai_id = new.id then
    raise exception using errcode = 'check_violation',
      message = 'Um grupo não pode ser pai de si mesmo.';
  end if;
  if exists (
    with recursive acima(id, pai_id) as (
      select id, pai_id from public.grupos where id = new.pai_id
      union
      select g.id, g.pai_id from public.grupos g join acima a on g.id = a.pai_id
    ) select 1 from acima where id = new.id
  ) then
    raise exception using errcode = 'check_violation',
      message = 'Esse pai fecharia um círculo: ele já está abaixo deste grupo.';
  end if;
  return new;
end $$;

drop trigger if exists tg_grupos_sem_ciclo on public.grupos;
create trigger tg_grupos_sem_ciclo
  before insert or update of pai_id on public.grupos
  for each row execute function public.tg_grupo_sem_ciclo();

-- Apagar um grupo não solta os filhos no vazio: eles sobem um nível
-- e ficam debaixo do avô. (É o que acontece quando grupo_fundir apaga
-- o grupo que foi fundido.)
create or replace function public.tg_grupo_filhos_sobem()
returns trigger language plpgsql as $$
begin
  update public.grupos set pai_id = old.pai_id where pai_id = old.id;
  return old;
end $$;

drop trigger if exists tg_grupos_filhos_sobem on public.grupos;
create trigger tg_grupos_filhos_sobem
  before delete on public.grupos
  for each row execute function public.tg_grupo_filhos_sobem();

-- ------------------------------------------------------------
-- 3. QUEM ESTÁ EM QUÊ
-- ------------------------------------------------------------

-- O grupo e todos os que estão abaixo dele. Só desce por grupo ATIVO:
-- quando um projeto termina e o grupo dele é desativado, a equipe
-- daquele projeto deixa de contar como gente de NRO_PROJECTS. O
-- próprio grupo conta sempre, ativo ou não — como já contava.
-- "union", e não "union all": se um ciclo escapasse, a recursão para.
create or replace function public.grupo_descendentes(p_grupo_id integer)
returns setof integer language sql stable security definer
set search_path = public as $$
  with recursive abaixo(id) as (
    select id from grupos where id = p_grupo_id
    union
    select g.id from grupos g join abaixo a on g.pai_id = a.id where g.ativo
  ) select id from abaixo;
$$;

-- Os de baixo, contando os inativos — para o teste de ciclo, que não
-- pode ignorar um galho só porque ele está desligado.
create or replace function public.grupo_descendentes_todos(p_grupo_id integer)
returns setof integer language sql stable security definer
set search_path = public as $$
  with recursive abaixo(id) as (
    select id from grupos where id = p_grupo_id
    union
    select g.id from grupos g join abaixo a on g.pai_id = a.id
  ) select id from abaixo;
$$;
revoke execute on function public.grupo_descendentes_todos(integer) from public, anon;
grant  execute on function public.grupo_descendentes_todos(integer) to authenticated;

-- O grupo e todos os que estão acima dele.
create or replace function public.grupo_ancestrais(p_grupo_id integer)
returns setof integer language sql stable security definer
set search_path = public as $$
  with recursive acima(id, pai_id) as (
    select id, pai_id from grupos where id = p_grupo_id
    union
    select g.id, g.pai_id from grupos g join acima a on g.id = a.pai_id
  ) select id from acima;
$$;

-- A pergunta que todo o resto faz: esta pessoa está neste grupo,
-- direto ou por um grupo abaixo dele?
create or replace function public.esta_no_grupo(p_grupo_id integer, p_registro integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select p_grupo_id is not null and p_registro is not null and exists (
    select 1
      from membros m
      join grupos d on m.grupos @> array[d.nome]
     where m.registro = p_registro
       and d.id in (select public.grupo_descendentes(p_grupo_id))
  );
$$;

comment on function public.esta_no_grupo(integer, integer) is
  'Pertença efetiva: estar no grupo pela ficha, ou estar num grupo abaixo '
  'dele. É a única definição de "estar no grupo" do banco — quadro, '
  'projeto e arquivo perguntam para esta.';

-- Todos os grupos de uma pessoa, contando os herdados.
create or replace function public.grupos_de(p_registro integer)
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(distinct x.id), '{}')
    from membros m
    join grupos d on m.grupos @> array[d.nome]
    cross join lateral (
      -- sobe a partir do grupo da ficha; um grupo desativado no
      -- caminho conta, mas não deixa passar para cima dele
      with recursive acima(id, pai_id, ativo) as (
        select d.id, d.pai_id, d.ativo
        union
        select g.id, g.pai_id, g.ativo from grupos g join acima a on g.id = a.pai_id
         where a.ativo
      ) select id from acima
    ) x
   where m.registro = p_registro;
$$;

-- Quem está no grupo, contando os herdados, e por onde chegou.
-- A tela de Grupos lê isto para mostrar "por NRO_PROJECT_NEBULA".
create or replace function public.grupo_pessoas(p_grupo_id integer)
returns table (registro integer, via_grupo_id integer, direto boolean)
language sql stable security definer
set search_path = public as $$
  select distinct on (m.registro) m.registro, d.id, d.id = p_grupo_id
    from membros m
    join grupos d on m.grupos @> array[d.nome]
   where d.id in (select public.grupo_descendentes(p_grupo_id))
   order by m.registro, (d.id = p_grupo_id) desc, d.nome;
$$;

revoke execute on function public.grupo_descendentes(integer) from public, anon;
revoke execute on function public.grupo_ancestrais(integer)   from public, anon;
revoke execute on function public.esta_no_grupo(integer, integer) from public, anon;
revoke execute on function public.grupos_de(integer)          from public, anon;
revoke execute on function public.grupo_pessoas(integer)      from public, anon;
grant  execute on function public.grupo_descendentes(integer) to authenticated;
grant  execute on function public.grupo_ancestrais(integer)   to authenticated;
grant  execute on function public.esta_no_grupo(integer, integer) to authenticated;
grant  execute on function public.grupos_de(integer)          to authenticated;
grant  execute on function public.grupo_pessoas(integer)      to authenticated;

-- ------------------------------------------------------------
-- 4. O NÍVEL NO QUADRO PASSA A HERDAR
--    Idêntico ao da 17.0, com uma linha trocada: "estar no grupo"
--    agora inclui estar num grupo abaixo dele. Quem está em
--    NRO_PROJECT_NEBULA edita o quadro de NRO_PROJECTS.
--
--    A 17.0 deixa de redefinir esta função (e a view abaixo) quando
--    esta migração já passou — senão rodar a 17.0 de novo apagaria a
--    herança em silêncio. Cada coisa tem uma dona só; esta é a dona.
-- ------------------------------------------------------------
create or replace function public.meu_nivel_no_grupo(p_grupo_id integer)
returns text language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_res   boolean;
  v_niv   text;
begin
  if public.papel_atual() in ('admin','pessoal') then return 'edicao'; end if;
  if p_grupo_id is null then return 'nenhum'; end if;

  select reservado into v_res from grupos where id = p_grupo_id;
  if not found then return 'nenhum'; end if;
  if v_reg is null then return case when v_res then 'nenhum' else 'leitura' end; end if;

  if public.esta_no_grupo(p_grupo_id, v_reg) then return 'edicao'; end if;

  select nivel into v_niv from grupo_acessos
   where grupo_id = p_grupo_id and registro = v_reg;
  if v_niv is not null then return v_niv; end if;

  return case when v_res then 'nenhum' else 'leitura' end;
end $$;

comment on function public.meu_nivel_no_grupo(integer) is
  'nenhum | leitura | edicao. É a única regra de acesso a quadro no sistema. '
  'Desde a 19.0, estar num grupo abaixo conta como estar no grupo.';

-- A lista que Atividades lê. Duas mudanças: grupo sem quadro não
-- aparece, e "pessoas" conta também quem chegou por um grupo abaixo.
drop view if exists public.grupos_visiveis;
create view public.grupos_visiveis with (security_invoker = true) as
select g.id, g.nome, g.prefixo, g.cor, g.ordem, g.reservado, g.chave, g.pai_id,
       public.meu_nivel_no_grupo(g.id) as meu_nivel,
       (select count(distinct m.registro)
          from membros m
          join grupos d on m.grupos @> array[d.nome]
         where d.id in (select public.grupo_descendentes(g.id))
           and m.status in ('Ativo','Em pausa / avaliação')) as pessoas
  from grupos g
 where g.ativo and g.quadro
 order by g.ordem, g.nome;

comment on view public.grupos_visiveis is
  'Todo grupo ativo que tem quadro, com o meu nível em cada um. A lista é '
  'pública de propósito: quadro que some não é quadro fechado, é quadro que '
  'ninguém sabe que precisa pedir acesso.';

-- ------------------------------------------------------------
-- 5. QUEM MEXE EM QUEM ESTÁ NO GRUPO
--    Admin e pessoal, em qualquer grupo. Um responsável, no grupo
--    dele e em todos os de baixo: quem cuida de NRO_PROJECTS cuida
--    da equipe de cada projeto.
-- ------------------------------------------------------------
create or replace function public.posso_gerir_grupo(p_grupo_id integer)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() in ('admin','pessoal')
      or exists (
        select 1 from grupos g
         where g.id in (select public.grupo_ancestrais(p_grupo_id))
           and public.portal_registro_atual() = any(g.responsaveis)
      );
$$;
revoke execute on function public.posso_gerir_grupo(integer) from public, anon;
grant  execute on function public.posso_gerir_grupo(integer) to authenticated;

-- 5a. Pai, quadro, descrição e responsáveis.
--     Nome, prefixo e o resto continuam com grupo_salvar, da 17.0:
--     são duas funções para duas perguntas — "como se chama" e "onde
--     fica". Só entra no update a chave que veio no pedido.
create or replace function public.grupo_estrutura_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_id    integer := nullif(p->>'id','')::integer;
  v_pai   integer := nullif(p->>'pai_id','')::integer;
  v_resp  integer[];
begin
  if public.papel_atual() not in ('admin','pessoal') then
    return jsonb_build_object('status','sem_permissao');
  end if;
  if v_id is null or not exists (select 1 from grupos where id = v_id) then
    return jsonb_build_object('status','nao_encontrado');
  end if;
  if p ? 'pai_id' and v_pai is not null then
    if not exists (select 1 from grupos where id = v_pai) then
      return jsonb_build_object('status','nao_encontrado','campo','pai_id');
    end if;
    if v_pai in (select public.grupo_descendentes_todos(v_id)) then
      return jsonb_build_object('status','ciclo','campo','pai_id');
    end if;
  end if;
  if p ? 'responsaveis' then
    select coalesce(array_agg(distinct x::integer), '{}') into v_resp
      from jsonb_array_elements_text(
        case when jsonb_typeof(p->'responsaveis') = 'array' then p->'responsaveis' else '[]'::jsonb end) t(x)
     where x ~ '^\d+$' and exists (select 1 from membros where registro = x::integer);
  end if;

  update grupos
     set pai_id       = case when p ? 'pai_id' then v_pai else pai_id end,
         quadro       = coalesce(nullif(p->>'quadro','')::boolean, quadro),
         descricao    = case when p ? 'descricao' then nullif(trim(p->>'descricao'),'') else descricao end,
         responsaveis = case when p ? 'responsaveis' then v_resp else responsaveis end
   where id = v_id;

  return jsonb_build_object('status','ok','id',v_id);
end $$;
revoke execute on function public.grupo_estrutura_salvar(jsonb) from public, anon;
grant  execute on function public.grupo_estrutura_salvar(jsonb) to authenticated;

-- 5b. Pôr e tirar várias pessoas de uma vez.
--     O vínculo continua sendo o NOME do grupo em membros.grupos — a
--     ficha é a fonte de quem está onde, e esta função só a edita por
--     quem tem pressa. Tirar só tira quem está no grupo pela ficha:
--     quem chegou por um subgrupo sai de lá, não daqui.
create or replace function public.grupo_membros_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_g     integer := nullif(p->>'grupo_id','')::integer;
  v_nome  text;
  v_quem  text;
  v_add   integer[];
  v_rem   integer[];
  v_na    integer := 0;
  v_nr    integer := 0;
begin
  select nome into v_nome from grupos where id = v_g;
  if v_nome is null then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.posso_gerir_grupo(v_g) then
    return jsonb_build_object('status','sem_permissao');
  end if;

  select coalesce(array_agg(distinct x::integer), '{}') into v_add
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'adicionar') = 'array' then p->'adicionar' else '[]'::jsonb end) t(x)
   where x ~ '^\d+$';
  select coalesce(array_agg(distinct x::integer), '{}') into v_rem
    from jsonb_array_elements_text(
      case when jsonb_typeof(p->'remover') = 'array' then p->'remover' else '[]'::jsonb end) t(x)
   where x ~ '^\d+$';

  -- o nome de quem mexeu, como a ficha já grava em "responsavel";
  -- conta sem registro fica com o e-mail do login
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  v_quem := coalesce(v_quem,
    nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'email', 'Portal');

  with feitos as (
    update membros
       set grupos = array_append(coalesce(grupos,'{}'), v_nome)
     where registro = any(v_add)
       and not (coalesce(grupos,'{}') @> array[v_nome])
    returning registro
  ), oc as (
    insert into ocorrencias (registro, tipo, descricao, data, responsavel)
    select registro, 'Adição a grupo', v_nome, current_date, v_quem from feitos
    returning 1
  ) select count(*) into v_na from oc;

  with feitos as (
    update membros
       set grupos = array_remove(grupos, v_nome)
     where registro = any(v_rem)
       and coalesce(grupos,'{}') @> array[v_nome]
    returning registro
  ), oc as (
    insert into ocorrencias (registro, tipo, descricao, data, responsavel)
    select registro, 'Remoção de grupo', v_nome, current_date, v_quem from feitos
    returning 1
  ) select count(*) into v_nr from oc;

  return jsonb_build_object('status','ok','adicionados',v_na,'removidos',v_nr);
end $$;
revoke execute on function public.grupo_membros_salvar(jsonb) from public, anon;
grant  execute on function public.grupo_membros_salvar(jsonb) to authenticated;

-- ------------------------------------------------------------
-- 6. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v19_grupos_hierarquia', 'Grupos dentro de grupos: pai único, pertença que sobe pela árvore, grupo sem quadro, responsáveis por grupo e pôr/tirar várias pessoas de uma vez')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 19.0
--
-- Depois de rodar, a tela é Administração -> Grupos e quadros: a
-- lista vira árvore, e cada grupo abre com quem está nele (direto e
-- pelos subgrupos) e um campo para pôr várias pessoas de uma vez.
--
-- Para conferir a árvore pelo SQL:
--
--   select g.nome, p.nome as pai, g.quadro
--     from public.grupos g left join public.grupos p on p.id = g.pai_id
--    order by coalesce(p.nome, g.nome), g.pai_id nulls first, g.nome;
-- ============================================================
