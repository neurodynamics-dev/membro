-- ============================================================
-- SOMA 2.18.0 — MIGRAÇÃO · NeuroDynamics
-- Um arquivo só para a versão: cada etapa acrescenta a sua seção.
--
--   Check-in: folha única. Uma só folha de QR ativa por vez; só admin
--     (papel admin) gera; gerar invalida a anterior (o QR antigo passa
--     a ser recusado); o token não é mais legível por select, então o
--     PDF só existe no momento da geração (baixada_em e baixada_por
--     registram quem baixou).
--
--   Papéis por grupo: o papel sai dos grupos (grupo_papeis: pessoal,
--     selecao, lideranca, com herança de subgrupo); admin continua
--     individual (perfis.papel). papel_atual() devolve o de maior
--     precedência (admin > pessoal > lideranca > selecao > leitura) e
--     'nenhum' para conta bloqueada (Desligado, Egresso, Sob demanda),
--     que também perde o registro (portal_registro_atual() nulo) e
--     passa por uma política restritiva em toda tabela com RLS. A
--     liderança vê todos os quadros e escreve só nos seus, lê a ficha
--     (menos ocorrências) e escreve nos módulos da lista (OKRs, avisos,
--     documentos, agenda, Studio, treinamentos, projetos e arquivos,
--     e-mails, Seleção). Fecha a leitura e a inclusão abertas da ficha.
--
--   Card espelhado: o mesmo cartão visível em mais de um quadro
--     (atividade_quadros). Espelha quem escreve nos dois quadros; edita
--     quem escreve em qualquer um deles.
--
--   Notificações por tipo: preferência por categoria de aviso
--     (notificacao_canais) para o push (liga ou desliga) e o e-mail
--     (nunca, instantâneo, resumo diário às 8h, resumo semanal na
--     segunda às 8h). Padrão: push ligado e e-mail semanal. O lote de
--     e-mail e o de push passam a respeitar a escolha.
--
-- Pré-requisitos: a 29.0 (checkin_folhas), a 19.0 (grupos dentro de
-- grupos), a 2.17.0 (cartões) e a 32.0 (fila e push).
-- Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.checkin_folhas') is null then
    raise exception using message = 'Falta a 29.0 (checkin_folhas).',
      detail = 'Aplique db/v29_presenca_e_inicio.sql antes desta migração.';
  end if;
end $$;

-- ------------------------------------------------------------
-- Check-in: folha única
-- ------------------------------------------------------------
alter table public.checkin_folhas add column if not exists revogada_motivo text;
alter table public.checkin_folhas add column if not exists baixada_em timestamptz;
alter table public.checkin_folhas add column if not exists baixada_por text;

-- as folhas que estavam ativas ao mesmo tempo: fica só a mais recente
update public.checkin_folhas
   set revogada_em = now(), revogada_por = 'Migração 2.18.0', revogada_motivo = 'substituída'
 where revogada_em is null
   and id <> (select id from public.checkin_folhas where revogada_em is null
               order by criada_em desc, numero desc limit 1);

create unique index if not exists checkin_folhas_ativa_unica
  on public.checkin_folhas ((true)) where revogada_em is null;

-- o token só sai na chamada que gera a folha
revoke select on public.checkin_folhas from authenticated;
grant select (id, numero, rotulo, criada_em, criada_por, revogada_em, revogada_por,
              revogada_motivo, usos, ultimo_uso, baixada_em, baixada_por)
  on public.checkin_folhas to authenticated;

create or replace function public.checkin_folha_criar(p_rotulo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.checkin_folhas%rowtype; v_quem text;
begin
  if public.papel_atual() is distinct from 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  v_quem := coalesce(v_quem, 'Portal');
  update checkin_folhas set revogada_em = now(), revogada_por = v_quem, revogada_motivo = 'substituída'
   where revogada_em is null;
  insert into checkin_folhas (rotulo, criada_por, baixada_em, baixada_por)
  values (nullif(trim(p_rotulo),''), v_quem, now(), v_quem)
  returning * into f;
  return jsonb_build_object('status','ok','id',f.id,'numero',f.numero,'token',f.token,'criada_em',f.criada_em,'criada_por',f.criada_por);
end $$;

create or replace function public.checkin_folha_revogar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_quem text;
begin
  if public.papel_atual() is distinct from 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  update checkin_folhas set revogada_em = now(), revogada_por = coalesce(v_quem, 'Portal'), revogada_motivo = 'revogada'
   where id = p_id and revogada_em is null;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok');
end $$;

revoke execute on function public.checkin_folha_criar(text), public.checkin_folha_revogar(uuid) from public, anon;
grant execute on function public.checkin_folha_criar(text), public.checkin_folha_revogar(uuid) to authenticated;

-- ============================================================
-- Papéis por grupo
-- ============================================================
do $$
begin
  if to_regprocedure('public.grupos_de(integer)') is null
     or to_regprocedure('public.meu_nivel_no_grupo(integer)') is null then
    raise exception using message = 'Falta a 19.0 (grupos dentro de grupos).',
      detail = 'Aplique db/v19_grupos_hierarquia.sql antes desta migração.';
  end if;
  if to_regprocedure('auth.uid()') is null then
    raise exception using message = 'Falta auth.uid().',
      detail = 'Esta migração é para o banco do Supabase.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. O papel de cada grupo. Quem está no grupo, direto ou por um
--    subgrupo (grupos_de), tem o papel. Só admin muda.
-- ------------------------------------------------------------
create table if not exists public.grupo_papeis (
  grupo_id     integer primary key references public.grupos(id) on delete cascade,
  papel        text not null check (papel in ('pessoal','selecao','lideranca')),
  definido_por text,
  definido_em  timestamptz not null default now()
);
comment on table public.grupo_papeis is
  'O papel que estar no grupo dá (com os subgrupos): pessoal, selecao ou lideranca. '
  'admin é da conta (perfis.papel). Escrita só por grupo_papel_definir(), de admin.';

alter table public.grupo_papeis enable row level security;
drop policy if exists gpap_select on public.grupo_papeis;
create policy gpap_select on public.grupo_papeis for select to authenticated using (true);
revoke insert, update, delete on public.grupo_papeis from authenticated;
grant select on public.grupo_papeis to authenticated;

-- A semente: pelos nomes (e pela chave do quadro do Pessoal). Só
-- semeia um papel que ainda não tem grupo nenhum, então rodar de novo
-- não desfaz o que admin mudou. Grupo que não existe vira aviso.
do $$
declare v_id integer; r record;
begin
  for r in select * from (values ('pessoal','NRO_PESSOAL','pessoal'), ('selecao','NRO_PS',null),
                                 ('lideranca','NRO_LEADERSHIP',null)) v(papel, nome, chave) loop
    if exists (select 1 from grupo_papeis where papel = r.papel) then continue; end if;
    select id into v_id from grupos
     where upper(nome) = r.nome or (r.chave is not null and chave = r.chave)
     order by (upper(nome) = r.nome) desc limit 1;
    if v_id is null then
      raise notice 'Papéis por grupo: não achei o grupo % (papel %). Defina em Administração › Grupos.', r.nome, r.papel;
    elsif exists (select 1 from grupo_papeis where grupo_id = v_id) then
      raise notice 'Papéis por grupo: o grupo % já tem outro papel; % ficou sem grupo.', r.nome, r.papel;
    else
      insert into grupo_papeis (grupo_id, papel, definido_por) values (v_id, r.papel, 'Migração 2.18.0');
    end if;
  end loop;
end $$;

-- ------------------------------------------------------------
-- 2. Conta bloqueada, papéis e registro
--    Bloqueado é o membro com status Desligado, Egresso ou Sob
--    demanda. Conta sem registro (técnica, ou recém-criada) não é
--    bloqueada: o que ela pode continua sendo o papel da conta.
-- ------------------------------------------------------------
create or replace function public.status_bloqueado(p_status text)
returns boolean language sql immutable as $$
  select coalesce(p_status, '') in ('Desligado','Egresso','Sob demanda');
$$;

create or replace function public.conta_ativa()
returns boolean language sql stable security definer
set search_path = public as $$
  select not exists (
    select 1 from perfis p join membros m on m.registro = p.registro
     where p.id = auth.uid() and public.status_bloqueado(m.status));
$$;
comment on function public.conta_ativa() is
  'Falso para a conta ligada a um membro Desligado, Egresso ou Sob demanda. '
  'É a política restritiva conta_ativa de toda tabela com RLS (2.18.0).';

-- Os papéis de uma conta e de onde vem cada um (a mesma regra de
-- papeis_atuais(), abaixo, que é a versão rápida, só da conta logada): 'conta' (perfis.papel
-- admin), 'legado' (perfis.papel pessoal ou selecao, reserva de
-- transição da 2.18) ou o nome do grupo que dá o papel.
-- (plpgsql e não sql: o plano fica guardado entre as chamadas, e esta
-- função roda dentro das políticas, linha a linha.)
create or replace function public.papeis_de(p_id uuid)
returns table (papel text, via text)
language plpgsql stable security definer
set search_path = public as $$
declare v_papel text; v_reg integer;
begin
  select p.papel, p.registro into v_papel, v_reg
    from perfis p left join membros m on m.registro = p.registro
   where p.id = p_id and not public.status_bloqueado(m.status);
  if not found then return; end if;
  if v_papel = 'admin' then papel := 'admin'; via := 'conta'; return next; end if;
  if v_papel in ('pessoal','selecao') then papel := v_papel; via := 'legado'; return next; end if;
  if v_reg is not null then
    return query select gp.papel, g.nome
                   from grupo_papeis gp join grupos g on g.id = gp.grupo_id and g.ativo
                  where gp.grupo_id = any(public.grupos_de(v_reg));
  end if;
  papel := 'leitura'; via := null; return next;
end $$;

create or replace function public.papeis_atuais()
returns text[] language plpgsql stable security definer
set search_path = public as $$
declare v_papel text; v_reg integer; v text[] := '{}'; v_gs integer[];
begin
  select p.papel, p.registro into v_papel, v_reg
    from perfis p left join membros m on m.registro = p.registro
   where p.id = auth.uid() and not public.status_bloqueado(m.status);
  if not found then return '{}'; end if;
  if v_papel in ('admin','pessoal','selecao') then v := array[v_papel]; end if;
  if v_reg is not null then
    v_gs := public.grupos_de(v_reg);   -- uma vez, fora da consulta
    v := v || array(select gp.papel from grupo_papeis gp join grupos g on g.id = gp.grupo_id and g.ativo
                     where gp.grupo_id = any(v_gs));
  end if;
  v := v || 'leitura'::text;
  return array(select o.p from unnest(array['admin','pessoal','lideranca','selecao','leitura']) with ordinality o(p, n)
                where o.p = any(v) order by o.n);
end $$;
comment on function public.papeis_atuais() is
  'Os papéis da conta logada, do mais forte ao mais fraco. Vazio: conta bloqueada ou sem perfil.';

create or replace function public.tenho_papel(p text)
returns boolean language sql stable security definer
set search_path = public as $$
  select coalesce(p = any(a) or 'admin' = any(a), false) from (select public.papeis_atuais() a) x;
$$;

-- A mesma assinatura de sempre; o valor é o papel mais forte. As
-- comparações antigas (in ('admin','pessoal')) seguem certas: liderança
-- não é pessoal. Conta bloqueada (ou anônima) é 'nenhum', nunca nulo:
-- "papel_atual() not in (...)" com nulo deixaria passar.
create or replace function public.papel_atual()
returns text language plpgsql stable security definer
set search_path = public as $$
begin
  return coalesce((public.papeis_atuais())[1], 'nenhum');
end $$;

-- O registro da conta; nulo para conta bloqueada, e as funções que
-- pedem registro respondem sem_registro.
create or replace function public.portal_registro_atual()
returns integer language sql stable security definer
set search_path = public as $$
  select p.registro
    from perfis p left join membros m on m.registro = p.registro
   where p.id = auth.uid() and not public.status_bloqueado(m.status);
$$;

-- A gestão dos módulos da lista de escrita: admin, pessoal e liderança.
create or replace function public.eh_gestao()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() in ('admin','pessoal','lideranca');
$$;

revoke execute on function public.papeis_de(uuid) from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array['conta_ativa()','papeis_atuais()','tenho_papel(text)','papel_atual()',
                           'portal_registro_atual()','eh_gestao()','status_bloqueado(text)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
-- quem não entrou ainda pergunta pelo papel nas páginas avulsas (rsvp,
-- quiosque, site): para essas, papel_atual() responde 'nenhum'
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.papel_atual(), public.portal_registro_atual(),
                              public.papeis_atuais(), public.status_bloqueado(text) to anon;
  end if;
end $$;

-- ------------------------------------------------------------
-- 3. Quadros: liderança vê todos e escreve nos seus
--    A 19.0 com três mudanças: conta bloqueada não vê nada; liderança
--    lê todo quadro (mesmo o reservado) que não seja o dela; e o resto
--    como era.
-- ------------------------------------------------------------
create or replace function public.meu_nivel_no_grupo(p_grupo_id integer)
returns text language plpgsql stable security definer
set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_pap   text    := public.papel_atual();
  v_res   boolean;
  v_niv   text;
begin
  if v_pap = 'nenhum' and not public.conta_ativa() then return 'nenhum'; end if;
  if v_pap in ('admin','pessoal') then return 'edicao'; end if;
  if p_grupo_id is null then return 'nenhum'; end if;

  select reservado into v_res from grupos where id = p_grupo_id;
  if not found then return 'nenhum'; end if;
  if v_reg is null then return case when v_res then 'nenhum' else 'leitura' end; end if;

  if public.esta_no_grupo(p_grupo_id, v_reg) then return 'edicao'; end if;

  select nivel into v_niv from grupo_acessos
   where grupo_id = p_grupo_id and registro = v_reg;
  if v_niv is not null then return v_niv; end if;

  if v_pap = 'lideranca' then return 'leitura'; end if;
  return case when v_res then 'nenhum' else 'leitura' end;
end $$;

comment on function public.meu_nivel_no_grupo(integer) is
  'nenhum | leitura | edicao. É a única regra de acesso a quadro no sistema. '
  'Desde a 19.0, estar num grupo abaixo conta como estar no grupo; desde a 2.18.0, '
  'liderança lê todo quadro e conta bloqueada não vê nenhum.';

-- ------------------------------------------------------------
-- 4. Seleção: o comitê é quem tem o papel selecao, e a liderança
--    também entra (a decisão do usuário). Pela lista de papéis, não
--    pelo mais forte: quem é liderança e seleção não perde a seleção.
-- ------------------------------------------------------------
create or replace function public.eh_comite()
returns boolean language sql stable security definer
set search_path = public as $$
  select public.papel_atual() in ('admin','pessoal')
      or public.tenho_papel('selecao') or public.tenho_papel('lideranca');
$$;
revoke execute on function public.eh_comite() from public;
grant execute on function public.eh_comite() to authenticated;

-- ------------------------------------------------------------
-- 5. A lista de escrita da liderança
--    As funções e políticas de OKRs, avisos, documentos, agenda,
--    Studio, treinamentos, projetos e arquivos, e-mails e Seleção
--    trocam "admin ou pessoal" por eh_gestao(). Troca-se o texto da
--    definição que está no banco (pg_get_functiondef e pg_policies),
--    e não uma cópia daqui: assim nada do que a produção tem a mais se
--    perde. O que não se reconhece vira aviso; rodar de novo não muda
--    nada (o texto já trocado não casa mais).
--    Fora da lista, de propósito (continuam admin e pessoal): contas,
--    grupos, solicitações e acesso, ouvidoria, cofre, folha de
--    check-in, ausências, a foto dos outros e a moderação de
--    comentário.
-- ------------------------------------------------------------
do $$
declare
  -- "papel_atual() in ('admin','pessoal')", com ou sem coalesce, como
  -- está nos arquivos; e como o PostgreSQL escreve nas políticas
  re_fn  constant text := '(coalesce\(\s*(public\.)?papel_atual\(\)\s*,\s*''''\s*\)|(public\.)?papel_atual\(\))\s+(not\s+)?in\s*\(\s*''admin''\s*,\s*''pessoal''\s*\)';
  re_pol_in  constant text := '(COALESCE\((public\.)?papel_atual\(\), ''''::text\)|(public\.)?papel_atual\(\)) = ANY \(ARRAY\[''admin''::text, ''pessoal''::text\]\)';
  re_pol_out constant text := '(COALESCE\((public\.)?papel_atual\(\), ''''::text\)|(public\.)?papel_atual\(\)) <> ALL \(ARRAY\[''admin''::text, ''pessoal''::text\]\)';
  fns text[] := array['okr_pode_atualizar',
    'agenda_gestor','agenda_marco_salvar','agenda_marco_remover','agenda_editar_evento','agenda_cancelar','agenda_scrum_salvar',
    'site_imprensa_editor','treinamento_gestor',
    'email_destinatarios','email_programar','email_programado_cancelar',
    'doc_vinculo_pode','evento_ext_pode_ver','evento_ext_ve_emails','evento_ext_gere','evento_ext_salvar',
    'evento_ext_reabrir','eventos_ext_lista','evento_ext_ler','doc_emitido_ler','doc_emitido_revogar'];
  pols text[][] := array[
    ['okr_objetivos','okr_insert'], ['okr_objetivos','okr_delete'], ['okr_comentarios','okrcom_delete'],
    ['portal_avisos','pavisos_select'], ['portal_avisos','pavisos_write'], ['portal_links','plinks_write'],
    ['portal_documentos','pdocs_select'], ['portal_documentos','pdocs_write'],
    ['agenda_predefinidos','agpred_write'],
    ['site_projetos','siteprj_write'],
    ['email_roteiros','eroteiros_gestao'], ['email_programados','eprog_ler'],
    ['doc_emissao_config','doc_emcfg_update'], ['eventos_ext_config','evx_cfg_update'], ['doc_emitidos','doc_emit_select'],
    ['evento_tipos','evtipos_write']];
  -- trocas avulsas: [função, de (regex), para, marca de já feito]
  avulsas text[][] := array[
    -- só admin hoje; a liderança entra
    ['doc_gestor',          'public\.papel_atual\(\) = ''admin''',
                            '(public.papel_atual() = ''admin'' or public.tenho_papel(''lideranca''))', 'tenho_papel(''lideranca'')'],
    ['studio_pode_aprovar', 'public\.papel_atual\(\) = ''admin''',
                            '(public.papel_atual() = ''admin'' or public.tenho_papel(''lideranca''))', 'tenho_papel(''lideranca'')'],
    -- a agenda da liderança escreve, mas o evento fechado continua só
    -- de quem organiza, de quem foi convidado e de admin e pessoal
    ['agenda_pode_ver',     'public\.agenda_gestor\(\)',
                            'public.papel_atual() in (''admin'',''pessoal'')', 'papel_atual() in (''admin'',''pessoal'')'],
    -- a fila dos e-mails: seleção e a gestão inteira
    ['fila_situacao',       'coalesce\(public\.papel_atual\(\), ''''\) not in \(''admin'', ''pessoal'', ''selecao''\)',
                            'not (public.eh_gestao() or public.tenho_papel(''selecao''))', 'tenho_papel(''selecao'')']];
  f record; d text; novo text; i integer; q text; n integer := 0;
begin
  foreach d in array fns loop
    for f in select p.oid from pg_proc p where p.proname = d and p.pronamespace = 'public'::regnamespace loop
      q := pg_get_functiondef(f.oid);
      novo := regexp_replace(q, re_fn, '\4public.eh_gestao()', 'gi');
      if novo <> q then execute novo; n := n + 1;
      elsif position('eh_gestao()' in q) = 0 then
        raise notice 'Papéis por grupo: não reconheci o teste de papel em %(). Confira à mão.', d;
      end if;
    end loop;
  end loop;
  for i in 1 .. array_length(avulsas, 1) loop
    for f in select p.oid from pg_proc p where p.proname = avulsas[i][1] and p.pronamespace = 'public'::regnamespace loop
      q := pg_get_functiondef(f.oid);
      if position(avulsas[i][4] in q) > 0 then continue; end if;
      novo := regexp_replace(q, avulsas[i][2], avulsas[i][3], 'g');
      if novo <> q then execute novo; n := n + 1;
      else raise notice 'Papéis por grupo: não reconheci o teste de papel em %(). Confira à mão.', avulsas[i][1]; end if;
    end loop;
  end loop;
  for i in 1 .. array_length(pols, 1) loop
    for f in select qual, with_check from pg_policies
              where schemaname = 'public' and tablename = pols[i][1] and policyname = pols[i][2] loop
      if f.qual is not null then
        q := regexp_replace(regexp_replace(f.qual, re_pol_in, 'public.eh_gestao()', 'g'),
                            re_pol_out, '(NOT public.eh_gestao())', 'g');
        if q <> f.qual then
          execute format('alter policy %I on public.%I using (%s)', pols[i][2], pols[i][1], q); n := n + 1; end if;
      end if;
      if f.with_check is not null then
        q := regexp_replace(regexp_replace(f.with_check, re_pol_in, 'public.eh_gestao()', 'g'),
                            re_pol_out, '(NOT public.eh_gestao())', 'g');
        if q <> f.with_check then
          execute format('alter policy %I on public.%I with check (%s)', pols[i][2], pols[i][1], q); n := n + 1; end if;
      end if;
    end loop;
  end loop;
  raise notice 'Papéis por grupo: % trocas na lista de escrita da liderança.', n;
end $$;

-- ------------------------------------------------------------
-- 6. A ficha: dados pessoais, avaliações e acessos para admin, pessoal
--    e liderança; ocorrências só para admin e pessoal. A leitura e a
--    inclusão abertas a qualquer conta (as políticas de produção com
--    "using (true)" e "with check (true)") acabam aqui.
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.dados_pessoais') is not null then
    alter table public.dados_pessoais enable row level security;
    drop policy if exists dados_all on public.dados_pessoais;
    drop policy if exists dados_gestao on public.dados_pessoais;
    create policy dados_gestao on public.dados_pessoais for all to authenticated
      using (public.papel_atual() in ('admin','pessoal'))
      with check (public.papel_atual() in ('admin','pessoal'));
    drop policy if exists dados_ler on public.dados_pessoais;
    create policy dados_ler on public.dados_pessoais for select to authenticated
      using (public.papel_atual() in ('admin','pessoal','lideranca'));
  end if;

  if to_regclass('public.avaliacoes') is not null then
    alter table public.avaliacoes enable row level security;
    drop policy if exists aval_select on public.avaliacoes;
    create policy aval_select on public.avaliacoes for select to authenticated
      using (public.papel_atual() in ('admin','pessoal','lideranca'));
    drop policy if exists aval_insert on public.avaliacoes;
    create policy aval_insert on public.avaliacoes for insert to authenticated
      with check (public.papel_atual() in ('admin','pessoal'));
  end if;

  if to_regclass('public.acessos_concedidos') is not null then
    alter table public.acessos_concedidos enable row level security;
    drop policy if exists acessos_select on public.acessos_concedidos;
    create policy acessos_select on public.acessos_concedidos for select to authenticated
      using (public.papel_atual() in ('admin','pessoal','lideranca'));
  end if;

  if to_regclass('public.ocorrencias') is not null then
    alter table public.ocorrencias enable row level security;
    drop policy if exists ocorr_select on public.ocorrencias;
    create policy ocorr_select on public.ocorrencias for select to authenticated
      using (public.papel_atual() in ('admin','pessoal'));
    drop policy if exists ocorr_insert on public.ocorrencias;
    create policy ocorr_insert on public.ocorrencias for insert to authenticated
      with check (public.papel_atual() in ('admin','pessoal'));
  end if;
end $$;

-- A sinalização reincidente do apontamento semanal abre ocorrência, e
-- quem aponta não escreve em ocorrências. A porta é esta: só os itens
-- sinalizados do apontamento que a própria conta registrou.
create or replace function public.apontamento_ocorrencias(p_apontamento uuid, p_registros integer[])
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_nome text;
  v_n    integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if not exists (select 1 from apontamentos a where a.id = p_apontamento
                    and (a.responsavel_id = auth.uid() or public.papel_atual() in ('admin','pessoal'))) then
    return jsonb_build_object('status','nao_encontrado'); end if;
  select nome into v_nome from membros where registro = v_reg;
  insert into ocorrencias (registro, tipo, descricao, data, responsavel)
  select distinct on (i.registro) i.registro, 'Sinalização reincidente', i.justificativa, current_date, v_nome
    from apontamento_itens i
   where i.apontamento_id = p_apontamento and i.sinalizado
     and i.registro = any(coalesce(p_registros, '{}'))
     and not exists (select 1 from ocorrencias o where o.registro = i.registro
                        and o.tipo = 'Sinalização reincidente' and o.data = current_date
                        and o.descricao is not distinct from i.justificativa);
  get diagnostics v_n = row_count;
  return jsonb_build_object('status','ok','abertas',v_n);
end $$;

-- ------------------------------------------------------------
-- 7. Administração: o papel do grupo (só admin muda) e o papel
--    efetivo de cada conta, com a origem (para Contas e perfis).
-- ------------------------------------------------------------
create or replace function public.grupo_papel_definir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_gid  integer := nullif(p->>'grupo_id','')::integer;
  v_pap  text    := nullif(p->>'papel','');
  v_quem text;
begin
  if public.papel_atual() is distinct from 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  if v_gid is null or not exists (select 1 from grupos where id = v_gid) then
    return jsonb_build_object('status','nao_encontrado'); end if;
  if v_pap is not null and v_pap not in ('pessoal','selecao','lideranca') then
    return jsonb_build_object('status','invalido','campo','papel'); end if;
  if v_pap is null then
    delete from grupo_papeis where grupo_id = v_gid;
  else
    select coalesce(m.nome, p.email, 'Portal') into v_quem
      from perfis p left join membros m on m.registro = p.registro where p.id = auth.uid();
    insert into grupo_papeis (grupo_id, papel, definido_por, definido_em)
    values (v_gid, v_pap, v_quem, now())
    on conflict (grupo_id) do update set papel = excluded.papel, definido_por = excluded.definido_por,
                                         definido_em = excluded.definido_em;
  end if;
  return jsonb_build_object('status','ok');
end $$;

create or replace function public.contas_papeis()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  return jsonb_build_object('status','ok','contas', coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.id,
             'bloqueada', public.status_bloqueado(m.status),
             'papeis', coalesce((select jsonb_agg(jsonb_build_object('papel', x.papel, 'via', x.via)
                                           order by array_position(array['admin','pessoal','lideranca','selecao','leitura'], x.papel), x.via)
                                   from public.papeis_de(p.id) x), '[]'::jsonb)))
      from perfis p left join membros m on m.registro = p.registro), '[]'::jsonb));
end $$;


-- ============================================================
-- Card espelhado
--   O mesmo cartão em mais de um quadro. O quadro dono continua sendo
--   atividades.grupo_id (dá o código e o prefixo); os outros são linhas
--   de atividade_quadros. Título, status, prazo, checklists, comentários
--   e histórico são um só, porque o registro é um só; a ordem na coluna
--   é de cada quadro.
--     espelhar: quem escreve no quadro dono E no novo;
--     editar, comentar, checklists: quem escreve em QUALQUER quadro ligado;
--     tirar o espelho: quem escreve naquele quadro (ou no dono);
--     arquivar, excluir, mover: quem escreve no quadro dono.
-- ============================================================
do $$
begin
  if to_regprocedure('public.atividade_copiar(jsonb)') is null
     or to_regclass('public.atividade_checklists') is null then
    raise exception using message = 'Falta a 2.17.0 (cartões).',
      detail = 'Aplique db/2.17.0_notas_fotos_e_cartoes.sql antes desta migração.';
  end if;
end $$;

create table if not exists public.atividade_quadros (
  atividade_id   uuid    not null references public.atividades(id) on delete cascade,
  grupo_id       integer not null references public.grupos(id) on delete cascade,
  ordem          numeric not null default 0,
  adicionado_por integer references public.membros(registro) on delete set null,
  adicionado_em  timestamptz not null default now(),
  primary key (atividade_id, grupo_id)
);
create index if not exists atividade_quadros_grupo_ix on public.atividade_quadros (grupo_id);
comment on table public.atividade_quadros is
  'Os espelhos de um cartão: os outros quadros em que ele aparece, além do dono '
  '(atividades.grupo_id). Escrita só por atividade_espelhar() e atividade_espelho_remover().';

create or replace function public.posso_ver_atividade(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from atividades a where a.id = p_id and public.posso_ver_grupo(a.grupo_id))
      or exists (select 1 from atividade_quadros q where q.atividade_id = p_id and public.posso_ver_grupo(q.grupo_id));
$$;
create or replace function public.posso_editar_atividade(p_id uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from atividades a where a.id = p_id and public.posso_editar_grupo(a.grupo_id))
      or exists (select 1 from atividade_quadros q where q.atividade_id = p_id and public.posso_editar_grupo(q.grupo_id));
$$;

alter table public.atividade_quadros enable row level security;
drop policy if exists atvq_select on public.atividade_quadros;
create policy atvq_select on public.atividade_quadros for select to authenticated
  using (exists (select 1 from atividades a where a.id = atividade_id));
revoke insert, update, delete on public.atividade_quadros from authenticated;
grant select on public.atividade_quadros to authenticated;

-- O que a RLS do quadro pergunta, calculado uma vez por consulta (o
-- "(select ...)" vira um InitPlan): os quadros que vejo e os cartões
-- espelhados num deles. Linha a linha, meu_nivel_no_grupo() custaria
-- uma ida aos papéis por cartão.
create or replace function public.quadros_que_vejo()
returns integer[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(g.id), '{}') from grupos g where public.meu_nivel_no_grupo(g.id) <> 'nenhum';
$$;
create or replace function public.espelhados_que_vejo()
returns uuid[] language sql stable security definer
set search_path = public as $$
  select coalesce(array_agg(distinct q.atividade_id), '{}') from atividade_quadros q
   where q.grupo_id = any(public.quadros_que_vejo());
$$;

-- O cartão e o que é dele: vê quem vê qualquer quadro ligado.
drop policy if exists atv_select on public.atividades;
create policy atv_select on public.atividades for select to authenticated
  using (grupo_id = any((select public.quadros_que_vejo())::integer[])
         or id = any((select public.espelhados_que_vejo())::uuid[]));
-- Escrita direta: criar e excluir no quadro dono; alterar em qualquer
-- quadro ligado (sem trocar o dono por um quadro em que não escreve).
drop policy if exists atv_write on public.atividades;
drop policy if exists atv_insert on public.atividades;
create policy atv_insert on public.atividades for insert to authenticated
  with check (public.sou_do_grupo(grupo_id));
drop policy if exists atv_update on public.atividades;
create policy atv_update on public.atividades for update to authenticated
  using (public.posso_editar_atividade(id))
  with check (public.sou_do_grupo(grupo_id) or public.posso_editar_atividade(id));
drop policy if exists atv_delete on public.atividades;
create policy atv_delete on public.atividades for delete to authenticated
  using (public.sou_do_grupo(grupo_id));

-- O resto do cartão segue o cartão: a subconsulta em atividades passa
-- pela RLS de atividades, que é a regra acima.
drop policy if exists atvc_select on public.atividade_comentarios;
create policy atvc_select on public.atividade_comentarios for select to authenticated
  using (exists (select 1 from atividades a where a.id = atividade_id));
drop policy if exists atvl_select on public.atividade_log;
create policy atvl_select on public.atividade_log for select to authenticated
  using (exists (select 1 from atividades a where a.id = atividade_id));
drop policy if exists atvs_select on public.atividade_seguidores;
create policy atvs_select on public.atividade_seguidores for select to authenticated
  using (exists (select 1 from atividades a where a.id = atividade_id));
drop policy if exists atvck_select on public.atividade_checklists;
create policy atvck_select on public.atividade_checklists for select to authenticated
  using (exists (select 1 from atividades a where a.id = atividade_id));
drop policy if exists atvci_select on public.atividade_checklist_itens;
create policy atvci_select on public.atividade_checklist_itens for select to authenticated
  using (exists (select 1 from atividade_checklists k where k.id = checklist_id));

-- As funções do cartão passam a perguntar pelo cartão, não pelo quadro
-- dono. Troca de texto na definição do banco, como na seção acima.
do $$
declare
  trocas text[][] := array[
    ['atividade_checklist',         'public.sou_do_grupo(v_gid)',            'public.posso_editar_atividade(v_aid)'],
    ['atividade_comentar',          'public.sou_do_grupo(v_a.grupo_id)',     'public.posso_editar_atividade(v_a.id)'],
    ['atividade_comentario_editar', 'public.sou_do_grupo(v_a.grupo_id)',     'public.posso_editar_atividade(v_a.id)'],
    ['atividade_seguir',            'public.posso_ver_grupo((select grupo_id from atividades where id = v_id))',
                                    'public.posso_ver_atividade(v_id)'],
    ['atividade_origem_detalhe',    'public.posso_ver_grupo(v_card.grupo_id)', 'public.posso_ver_atividade(v_card.id)'],
    ['atividade_copiar',            'not public.posso_ver_grupo(v_a.grupo_id)', 'not public.posso_ver_atividade(v_a.id)']];
  f record; q text; i integer;
begin
  for i in 1 .. array_length(trocas, 1) loop
    for f in select p.oid from pg_proc p where p.proname = trocas[i][1] and p.pronamespace = 'public'::regnamespace loop
      q := pg_get_functiondef(f.oid);
      if position(trocas[i][2] in q) > 0 then
        execute replace(q, trocas[i][2], trocas[i][3]);
      elsif position(trocas[i][3] in q) = 0 then
        raise notice 'Card espelhado: não reconheci a permissão em %(). Confira à mão.', trocas[i][1];
      end if;
    end loop;
  end loop;
end $$;

-- Editar: a da 2.17.0 com três mudanças. Pode quem escreve em qualquer
-- quadro ligado; arquivar e desarquivar continuam do quadro dono; e a
-- ordem, quando vem com o quadro de um espelho, é a desse quadro.
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
  v_quadro integer := nullif(p->>'quadro','')::integer;
  v_esp    boolean := false;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not public.posso_editar_atividade(v_a.id) then return jsonb_build_object('status','sem_permissao'); end if;
  if nullif(p->>'arquivada','') is not null
     and nullif(p->>'arquivada','')::boolean <> v_a.arquivada
     and not public.sou_do_grupo(v_a.grupo_id) then
    return jsonb_build_object('status','sem_permissao','campo','arquivada'); end if;
  if v_quadro is not null and v_quadro <> v_a.grupo_id then
    v_esp := exists (select 1 from atividade_quadros where atividade_id = v_a.id and grupo_id = v_quadro);
  end if;

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
    ordem        = case when v_esp then a.ordem else coalesce(nullif(p->>'ordem','')::numeric, a.ordem) end,
    arquivada    = coalesce(nullif(p->>'arquivada','')::boolean, a.arquivada),
    concluida_em = case when coalesce(nullif(p->>'status',''), a.status) = 'concluida'
                          and a.status <> 'concluida' then now()
                        when coalesce(nullif(p->>'status',''), a.status) <> 'concluida' then null
                        else a.concluida_em end,
    atualizado_em = now()
  where a.id = v_a.id
  returning * into v_novo;

  if v_esp and nullif(p->>'ordem','') is not null then
    update atividade_quadros set ordem = (p->>'ordem')::numeric
     where atividade_id = v_a.id and grupo_id = v_quadro;
  end if;

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

-- Espelhar: {id, grupo_id}. Pede escrita no quadro dono e no novo.
create or replace function public.atividade_espelhar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_a    public.atividades%rowtype;
  v_gid  integer := nullif(p->>'grupo_id','')::integer;
  v_nome text;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found or not public.posso_ver_atividade(v_a.id) then return jsonb_build_object('status','nao_encontrado'); end if;
  select nome into v_nome from grupos where id = v_gid and ativo and quadro;
  if v_nome is null or v_gid = v_a.grupo_id then return jsonb_build_object('status','invalido','campo','grupo'); end if;
  if not public.sou_do_grupo(v_a.grupo_id) then return jsonb_build_object('status','sem_permissao','campo','dono'); end if;
  if not public.sou_do_grupo(v_gid) then return jsonb_build_object('status','sem_permissao','campo','grupo'); end if;
  if v_a.arquivada then return jsonb_build_object('status','invalido','campo','arquivada'); end if;
  insert into atividade_quadros (atividade_id, grupo_id, ordem, adicionado_por)
  values (v_a.id, v_gid, extract(epoch from now()), v_reg)
  on conflict do nothing;
  if found then
    insert into atividade_log (atividade_id, registro, tipo, campo, para)
    values (v_a.id, v_reg, 'espelhou', 'quadros', v_nome);
  end if;
  return jsonb_build_object('status','ok','codigo',v_a.codigo);
end $$;

-- Tirar o espelho: {id, grupo_id}. Quem escreve naquele quadro, ou no dono.
create or replace function public.atividade_espelho_remover(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_reg  integer := public.portal_registro_atual();
  v_a    public.atividades%rowtype;
  v_gid  integer := nullif(p->>'grupo_id','')::integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if not found or not public.posso_ver_atividade(v_a.id) then return jsonb_build_object('status','nao_encontrado'); end if;
  if not exists (select 1 from atividade_quadros where atividade_id = v_a.id and grupo_id = v_gid) then
    return jsonb_build_object('status','nao_encontrado','campo','grupo'); end if;
  if not (public.sou_do_grupo(v_gid) or public.sou_do_grupo(v_a.grupo_id)) then
    return jsonb_build_object('status','sem_permissao'); end if;
  delete from atividade_quadros where atividade_id = v_a.id and grupo_id = v_gid;
  insert into atividade_log (atividade_id, registro, tipo, campo, para)
  values (v_a.id, v_reg, 'tirou_espelho', 'quadros', (select nome from grupos where id = v_gid));
  return jsonb_build_object('status','ok');
end $$;

-- Mover: {id, grupo_id, status?}. O cartão novo no outro quadro (a cópia
-- da 2.17.0, com tudo), o original arquivado, e os espelhos passam para
-- o novo — menos o do próprio quadro de destino, que vira o dono.
create or replace function public.atividade_mover(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_a   public.atividades%rowtype;
  v_r   jsonb;
  v_gid integer := nullif(p->>'grupo_id','')::integer;
begin
  select * into v_a from atividades where id = nullif(p->>'id','')::uuid;
  if found and v_gid = v_a.grupo_id then return jsonb_build_object('status','invalido','campo','grupo'); end if;
  v_r := public.atividade_copiar(jsonb_build_object('id', p->>'id', 'grupo_id', v_gid, 'status', p->>'status',
           'arquivar', true, 'com', jsonb_build_object('descricao',true,'checklists',true,'pessoas',true,'etiquetas',true,'prazo',true)));
  if v_r->>'status' <> 'ok' then return v_r; end if;
  insert into atividade_quadros (atividade_id, grupo_id, ordem, adicionado_por, adicionado_em)
  select (v_r->>'id')::uuid, q.grupo_id, q.ordem, q.adicionado_por, q.adicionado_em
    from atividade_quadros q where q.atividade_id = v_a.id and q.grupo_id <> v_gid
  on conflict do nothing;
  delete from atividade_quadros where atividade_id = v_a.id;
  return v_r;
end $$;

-- O quadro passa a dizer em que outros quadros o cartão está e a ordem
-- dele em cada um. As colunas da 2.17.0 ficam como estão (create or
-- replace só acrescenta no fim).
create or replace view public.atividades_quadro
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
         where k.atividade_id = a.id and i.feito) as check_feitos,
       coalesce((select array_agg(q.grupo_id order by q.adicionado_em) from atividade_quadros q
                  where q.atividade_id = a.id and q.grupo_id <> a.grupo_id), '{}') as espelhos,
       coalesce((select jsonb_object_agg(q.grupo_id::text, q.ordem) from atividade_quadros q
                  where q.atividade_id = a.id and q.grupo_id <> a.grupo_id), '{}'::jsonb) as espelhos_ordem
  from atividades a
  join grupos  g  on g.id = a.grupo_id
  left join membros mr on mr.registro = a.responsavel
  left join membros mc on mc.registro = a.criado_por;

comment on view public.atividades_quadro is
  'O que a tela do quadro precisa, já resolvido: nome do grupo, do responsável e de quem criou, '
  'as outras pessoas, as etiquetas, a conta da checklist, a contagem de comentários, o cálculo '
  'de atrasada e, desde a 2.18.0, os quadros espelho (espelhos) com a ordem em cada um.';

-- ============================================================
-- Conta bloqueada: a trava em toda tabela com RLS
--   Uma política restritiva soma um "e a conta está ativa" a todas as
--   outras, sem reescrevê-las. Só para authenticated: o anon (rsvp,
--   quiosque, site) segue como está. O "(select ...)" faz o banco
--   calcular uma vez por consulta, não uma vez por linha.
--   Seção que criar tabela com RLS depois desta chama de novo:
--     select public.conta_ativa_travar();
-- ============================================================
create or replace function public.conta_ativa_travar()
returns integer language plpgsql volatile
set search_path = public as $$
declare t text; n integer := 0;
begin
  for t in select c.relname from pg_class c
            where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p') and c.relrowsecurity loop
    execute format('drop policy if exists conta_ativa on public.%I', t);
    execute format('create policy conta_ativa on public.%I as restrictive for all to authenticated '
                   'using ((select public.conta_ativa())) with check ((select public.conta_ativa()))', t);
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.conta_ativa_travar() from public;

-- as funções novas: só para quem entrou
do $$
declare f text;
begin
  foreach f in array array['apontamento_ocorrencias(uuid,integer[])','grupo_papel_definir(jsonb)','contas_papeis()',
                           'posso_ver_atividade(uuid)','posso_editar_atividade(uuid)','atividade_editar(jsonb)',
                           'quadros_que_vejo()','espelhados_que_vejo()',
                           'atividade_espelhar(jsonb)','atividade_espelho_remover(jsonb)','atividade_mover(jsonb)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant select on public.atividades_quadro to authenticated;

do $$ begin raise notice 'Conta bloqueada: % tabelas com a trava.', public.conta_ativa_travar(); end $$;

-- ============================================================
-- Notificações por tipo
--   Cada aviso do sino pertence a uma categoria (notificacao_categoria):
--   atividades, bugs e melhorias, documentos, Studio, reporte, agenda,
--   pessoal, treinamentos e sistema. Para cada categoria, a pessoa
--   escolhe o push (liga ou desliga) e o e-mail (nunca, instantâneo,
--   resumo diário, resumo semanal). Sem linha em notificacao_canais
--   vale o padrão: push ligado e e-mail em resumo semanal.
--   O resumo diário sai às 8h (America/Sao_Paulo); o semanal, na
--   segunda às 8h. Não há relógio a guardar: um resumo é devido quando
--   há aviso pendente daquele modo criado antes do último marco, e
--   leva tudo o que estiver pendente do modo. O agendamento da fila
--   (soma-fila, a cada minuto, 32.0) basta.
--   Fora da preferência, de propósito: os convites de evento
--   (agenda_envios) e as pílulas e e-mails programados
--   (email_programados) correm por filas próprias e saem sempre por
--   e-mail na hora; o teste de e-mail e o de push também. O lembrete do
--   Studio (studio_lembrete) sai na hora, a não ser que o e-mail do
--   Studio esteja desligado. O sino recebe tudo, sempre.
--   Conta bloqueada (Desligado, Egresso, Sob demanda) não recebe e-mail
--   nem push.
-- ============================================================
do $$
begin
  if to_regclass('public.notificacao_preferencias') is null or to_regprocedure('public.push_lote(integer)') is null then
    raise exception using message = 'Faltam a 16.0 e a 32.0 (preferências de e-mail e push).',
      detail = 'Aplique db/v16_pessoal.sql e db/v32_fila_e_notificacoes.sql antes desta migração.';
  end if;
end $$;

create or replace function public.notificacao_categorias()
returns jsonb language sql immutable as $$
  select '[{"chave":"atividades","nome":"Atividades"},
           {"chave":"bugs_melhorias","nome":"Bugs e melhorias"},
           {"chave":"documentos","nome":"Documentos"},
           {"chave":"studio","nome":"Studio"},
           {"chave":"reporte","nome":"Reporte"},
           {"chave":"agenda","nome":"Agenda"},
           {"chave":"pessoal","nome":"Pessoal"},
           {"chave":"treinamentos","nome":"Treinamentos"},
           {"chave":"sistema","nome":"Sistema"}]'::jsonb;
$$;

-- o tipo gravado em notificacoes.tipo -> a categoria; nulo para o que não
-- é configurável (os testes de envio)
create or replace function public.notificacao_categoria(p_tipo text)
returns text language sql immutable as $$
  select case
    when p_tipo in ('teste_email','teste_push') then null
    when p_tipo like 'atividade\_%' or p_tipo in ('quadro_liberado','projeto_equipe') then 'atividades'
    when p_tipo like 'feedback\_%' then 'bugs_melhorias'
    when p_tipo like 'doc\_%' then 'documentos'
    when p_tipo like 'studio\_%' then 'studio'
    when p_tipo like 'reporte\_%' or p_tipo like 'newsletter%' then 'reporte'
    when p_tipo like 'agenda\_%' or p_tipo like 'evento\_%' then 'agenda'
    when p_tipo like 'pessoal\_%' or p_tipo = 'solicitacao_respondida' then 'pessoal'
    when p_tipo like 'treinamento%' then 'treinamentos'
    else 'sistema' end;
$$;

create table if not exists public.notificacao_canais (
  registro      integer not null references public.membros(registro) on delete cascade,
  categoria     text not null,
  push          boolean not null default true,
  email         text not null default 'semanal' check (email in ('nunca','instantaneo','diario','semanal')),
  atualizado_em timestamptz not null default now(),
  primary key (registro, categoria)
);
comment on table public.notificacao_canais is
  'Como cada pessoa recebe cada categoria de aviso fora do sino. Sem linha vale o padrão: '
  'push ligado e e-mail em resumo semanal. Escrita só por notificacao_canais_salvar.';

alter table public.notificacao_canais enable row level security;
drop policy if exists notifc_select on public.notificacao_canais;
create policy notifc_select on public.notificacao_canais for select to authenticated
  using (registro = public.portal_registro_atual() or public.papel_atual() in ('admin','pessoal'));
grant select on public.notificacao_canais to authenticated;

-- a preferência antiga (um modo para tudo) vira a de cada categoria. Só de
-- quem escolheu: 'imediato' era também o padrão, e a linha que a baixa do
-- e-mail criou sozinha (ultimo_email = atualizado_em, mesmo instante) não é
-- escolha de ninguém; essa pessoa fica no padrão novo (semanal).
alter table public.notificacao_preferencias add column if not exists canais_migrados_em timestamptz;
insert into public.notificacao_canais (registro, categoria, email)
select p.registro, c->>'chave',
       case p.email_modo when 'resumo' then 'diario' when 'nunca' then 'nunca' else 'instantaneo' end
  from public.notificacao_preferencias p
 cross join jsonb_array_elements(public.notificacao_categorias()) c
 where p.canais_migrados_em is null
   and (p.email_modo <> 'imediato' or p.ultimo_email is distinct from p.atualizado_em)
on conflict (registro, categoria) do nothing;
update public.notificacao_preferencias set canais_migrados_em = now() where canais_migrados_em is null;

-- o que a fila usa para decidir
create or replace function public.notificacao_canal_email(p_registro integer, p_tipo text)
returns text language sql stable security definer set search_path = public as $$
  select case when public.notificacao_categoria(p_tipo) is null then 'instantaneo'
              else coalesce((select c.email from notificacao_canais c
                              where c.registro = p_registro and c.categoria = public.notificacao_categoria(p_tipo)),
                            'semanal') end;
$$;
create or replace function public.notificacao_canal_push(p_registro integer, p_tipo text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when public.notificacao_categoria(p_tipo) is null then true
              else coalesce((select c.push from notificacao_canais c
                              where c.registro = p_registro and c.categoria = public.notificacao_categoria(p_tipo)),
                            true) end;
$$;
-- o marco do resumo: o último 8h (diário) ou a última segunda às 8h
-- (semanal), no horário de Brasília, antes de p_agora
create or replace function public.notificacao_resumo_marco(p_modo text, p_agora timestamptz default now())
returns timestamptz language sql stable as $$
  with l as (select (p_agora at time zone 'America/Sao_Paulo') as agora),
       m as (select case p_modo when 'semanal' then date_trunc('week', agora) else date_trunc('day', agora) end
                    + interval '8 hours' as marco, agora from l)
  select (case when agora < marco
               then marco - case p_modo when 'semanal' then interval '7 days' else interval '1 day' end
               else marco end) at time zone 'America/Sao_Paulo'
    from m;
$$;

-- a tela: as categorias com a escolha da pessoa (ou o padrão)
create or replace function public.notificacao_canais_meus()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.portal_registro_atual() is null then jsonb_build_object('status','sem_registro')
  else jsonb_build_object('status','ok','categorias', (
    select jsonb_agg(jsonb_build_object('chave', c->>'chave', 'nome', c->>'nome',
                                        'push', coalesce(n.push, true), 'email', coalesce(n.email, 'semanal'))
                     order by o)
      from jsonb_array_elements(public.notificacao_categorias()) with ordinality as x(c, o)
      left join notificacao_canais n on n.registro = public.portal_registro_atual() and n.categoria = c->>'chave'))
  end;
$$;

-- p = {canais: [{categoria, push, email}]}; o que fica igual ao padrão sai da tabela
create or replace function public.notificacao_canais_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); x jsonb; v_cat text; v_email text; v_push boolean; n integer := 0;
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if jsonb_typeof(p->'canais') is distinct from 'array' then
    return jsonb_build_object('status','invalido','campo','canais'); end if;
  for x in select * from jsonb_array_elements(p->'canais') loop
    v_cat := x->>'categoria';
    v_email := coalesce(nullif(x->>'email',''), 'semanal');
    v_push := coalesce((x->>'push')::boolean, true);
    if not exists (select 1 from jsonb_array_elements(public.notificacao_categorias()) c where c->>'chave' = v_cat) then
      return jsonb_build_object('status','invalido','campo','categoria'); end if;
    if v_email not in ('nunca','instantaneo','diario','semanal') then
      return jsonb_build_object('status','invalido','campo','email'); end if;
    if v_push and v_email = 'semanal' then
      delete from notificacao_canais where registro = v_reg and categoria = v_cat;
    else
      insert into notificacao_canais (registro, categoria, push, email) values (v_reg, v_cat, v_push, v_email)
      on conflict (registro, categoria) do update set push = excluded.push, email = excluded.email, atualizado_em = now();
    end if;
    n := n + 1;
  end loop;
  return jsonb_build_object('status','ok','categorias',n);
end $$;

-- a função antiga (um modo para tudo) segue valendo para a tela em cache:
-- grava o modo antigo e o aplica a todas as categorias
create or replace function public.notificacao_preferencia_salvar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_m text := nullif(p->>'email_modo','');
begin
  if v_reg is null then return jsonb_build_object('status','sem_registro'); end if;
  if v_m not in ('imediato','resumo','nunca') then
    return jsonb_build_object('status','invalido','campo','email_modo');
  end if;
  insert into notificacao_preferencias (registro, email_modo, canais_migrados_em) values (v_reg, v_m, now())
  on conflict (registro) do update set email_modo = excluded.email_modo, atualizado_em = now(),
                                       canais_migrados_em = coalesce(notificacao_preferencias.canais_migrados_em, now());
  insert into notificacao_canais (registro, categoria, email)
  select v_reg, c->>'chave', case v_m when 'resumo' then 'diario' when 'nunca' then 'nunca' else 'instantaneo' end
    from jsonb_array_elements(public.notificacao_categorias()) c
  on conflict (registro, categoria) do update set email = excluded.email, atualizado_em = now();
  return jsonb_build_object('status','ok','email_modo',v_m);
end $$;

-- O lote de e-mail. Cada pessoa pode ter até três envelopes por passada:
-- o instantâneo, o resumo diário e o semanal (modo). Janela: o instantâneo
-- leva os avisos dos últimos 3 dias; o diário, de 2; o semanal, de 8 (quem
-- religa o e-mail não recebe o acumulado de meses).
create or replace function public.notificacoes_email_lote(p_limite integer default 200)
returns jsonb language sql stable security definer
set search_path = public as $$
  with pend as (
    select n.id, n.registro, n.tipo, n.titulo, n.corpo, n.href, n.criado_em, m.nome,
           coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) as email,
           coalesce(public.notificacao_categoria(n.tipo), 'sistema') as categoria,
           public.notificacao_canal_email(n.registro, n.tipo) as modo0
      from notificacoes n
      join membros m on m.registro = n.registro
     where n.email_em is null
       and n.email_tentativas < 5
       and m.status in ('Ativo','Em pausa / avaliação')
       and not public.status_bloqueado(m.status)
       and coalesce(nullif(m.email_nro,''), nullif(m.email_pessoal,'')) is not null
       and n.criado_em > now() - interval '8 days'
  ), classe as (
    select p.*, case when p.tipo = 'studio_lembrete' and p.modo0 <> 'nunca' then 'instantaneo' else p.modo0 end as modo
      from pend p
  ), janela as (
    select c.* from classe c
     where c.criado_em > now() - case c.modo when 'instantaneo' then interval '3 days'
                                             when 'diario' then interval '2 days' else interval '8 days' end
  ), alvo as (
    select j.* from janela j
     where j.modo = 'instantaneo'
        or (j.modo in ('diario','semanal')
            and exists (select 1 from janela o where o.registro = j.registro and o.modo = j.modo
                           and o.criado_em < public.notificacao_resumo_marco(j.modo)))
     order by j.criado_em
     limit greatest(coalesce(p_limite,200), 1)
  )
  select coalesce(jsonb_agg(p order by p->>'nome', p->>'modo'), '[]'::jsonb) from (
    select jsonb_build_object(
             'registro', registro, 'nome', nome, 'email', email, 'modo', modo,
             'itens', jsonb_agg(jsonb_build_object(
               'id', id, 'tipo', tipo, 'categoria', categoria, 'titulo', titulo,
               'corpo', corpo, 'href', href, 'criado_em', criado_em)
               order by criado_em)) as p
      from alvo group by registro, nome, email, modo
  ) q;
$$;

-- O push: só as categorias com push ligado, e nada para conta bloqueada.
create or replace function public.push_lote(p_limite integer default 300)
returns jsonb language sql stable security definer
set search_path = public as $$
  with pend as (
    select n.id, n.registro, n.tipo, n.titulo, n.corpo, n.href, n.criado_em
      from notificacoes n
     where n.push_em is null
       and n.criado_em > now() - interval '1 day'
       and exists (select 1 from push_inscricoes i where i.registro = n.registro)
       and not exists (select 1 from membros m where m.registro = n.registro and public.status_bloqueado(m.status))
       and public.notificacao_canal_push(n.registro, n.tipo)
     order by n.criado_em
     limit greatest(coalesce(p_limite, 300), 1)
  )
  select coalesce(jsonb_agg(jsonb_build_object('registro', q.registro, 'itens', q.itens, 'inscricoes', q.inscricoes)), '[]'::jsonb)
    from (select p.registro,
                 jsonb_agg(jsonb_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'corpo', p.corpo,
                                              'href', p.href, 'criado_em', p.criado_em) order by p.criado_em) as itens,
                 (select jsonb_agg(jsonb_build_object('id', i.id, 'endpoint', i.endpoint, 'p256dh', i.p256dh,
                                                      'auth', i.auth, 'criado_em', i.criado_em))
                    from push_inscricoes i where i.registro = p.registro) as inscricoes
            from pend p group by p.registro) q;
$$;

do $$
declare f text;
begin
  foreach f in array array['notificacao_canal_email(integer,text)','notificacao_canal_push(integer,text)',
                           'notificacoes_email_lote(integer)','push_lote(integer)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function public.%s from authenticated', f); end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f); end if;
  end loop;
  foreach f in array array['notificacao_canais_meus()','notificacao_canais_salvar(jsonb)','notificacao_preferencia_salvar(jsonb)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

select public.conta_ativa_travar();

-- Convites e lembretes só saem para membros ativos; externos continuam válidos.
create or replace function public.agenda_envios_lote(p_limite integer default 100)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  insert into agenda_envios (evento_id, tipo, chave, para_registro, para_email, para_nome, token, resposta, assunto, dados)
  select e.id, 'lembrete', l.m || '@' || e.data, p.registro,
         coalesce(nullif(mb.email_nro,''), nullif(mb.email_pessoal,'')), mb.nome, p.token, p.resposta,
         'Lembrete: ' || e.titulo || ' · ' || public.agenda_quando(e.data, e.data_fim, e.hora_inicio, e.hora_fim),
         public.agenda_dados(e.id) || jsonb_build_object('minutos', l.m)
    from eventos e
    cross join lateral unnest(e.lembretes) l(m)
    join evento_participantes p on p.evento_id = e.id and coalesce(p.resposta,'pendente') <> 'nao'
    join membros mb on mb.registro = p.registro
    left join agenda_preferencias ap on ap.registro = p.registro
   where coalesce(e.status,'') <> 'Cancelado'
     and e.data between current_date - 1 and current_date + 30
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) <= now()
     and public.agenda_inicio(e.data, e.hora_inicio) > now()
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) >= coalesce(p.convidado_em, '-infinity')
     and coalesce(ap.emails, true)
     and mb.status in ('Ativo','Em pausa / avaliação')
     and coalesce(nullif(mb.email_nro,''), nullif(mb.email_pessoal,'')) is not null
  on conflict do nothing;

  insert into agenda_envios (evento_id, tipo, chave, para_email, para_nome, token, resposta, assunto, dados)
  select e.id, 'lembrete', l.m || '@' || e.data, x.email, x.nome, x.token, x.resposta,
         'Lembrete: ' || e.titulo || ' · ' || public.agenda_quando(e.data, e.data_fim, e.hora_inicio, e.hora_fim),
         public.agenda_dados(e.id) || jsonb_build_object('minutos', l.m)
    from eventos e
    cross join lateral unnest(e.lembretes) l(m)
    join evento_externos x on x.evento_id = e.id and x.resposta <> 'nao'
   where coalesce(e.status,'') <> 'Cancelado'
     and e.data between current_date - 1 and current_date + 30
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) <= now()
     and public.agenda_inicio(e.data, e.hora_inicio) > now()
     and public.agenda_inicio(e.data, e.hora_inicio) - make_interval(mins => l.m) >= x.convidado_em
  on conflict do nothing;

  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', v.id, 'tipo', v.tipo, 'para_nome', v.para_nome, 'para_email', v.para_email,
      'token', v.token, 'resposta', v.resposta, 'membro', v.para_registro is not null,
      'assunto', v.assunto, 'dados', v.dados) order by v.id)
    from (select * from agenda_envios a where enviado_em is null and tentativas < 5
             and (a.para_registro is null or exists (select 1 from membros m
               where m.registro = a.para_registro and m.status in ('Ativo','Em pausa / avaliação')))
           order by id limit greatest(coalesce(p_limite,100),1)) v), '[]'::jsonb);
end $$;


-- Reporte semanal. Rascunhos privados por frente; feed publicado para a equipe.
create table if not exists public.reporte_frentes (
 id uuid primary key default gen_random_uuid(), grupo_id integer not null references grupos(id),
 responsavel integer not null references membros(registro), ativo boolean not null default true,
 unique(grupo_id,responsavel));
create table if not exists public.reporte_config (
 id boolean primary key default true check(id), dia_prazo integer not null default 5 check(dia_prazo between 0 and 6),
 hora_prazo time not null default '18:00', dia_reuniao integer not null default 0 check(dia_reuniao between 0 and 6),
 hora_reuniao time not null default '09:00');
insert into reporte_config(id) values(true) on conflict do nothing;
create table if not exists public.reporte_ciclos (
 id uuid primary key default gen_random_uuid(), semana date unique not null,
 prazo timestamptz not null, reuniao_em timestamptz not null, fechado boolean not null default false);
create table if not exists public.reportes (
 id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references reporte_ciclos(id),
 frente_id uuid not null references reporte_frentes(id), autor integer not null references membros(registro),
 apontamentos jsonb not null default '[]', escalonamentos jsonb not null default '[]',
 etapa integer not null default 1 check(etapa between 1 and 3), versao integer not null default 1,
 enviado_em timestamptz, atualizado_em timestamptz not null default now(), unique(ciclo_id,frente_id));
create table if not exists public.feed_itens (
 id uuid primary key default gen_random_uuid(), reporte_id uuid references reportes(id),
 autor integer not null references membros(registro), titulo text not null check(length(trim(titulo)) between 1 and 200),
 subtitulo text not null check(length(trim(subtitulo)) between 1 and 400), texto text not null default '',
 imagem_path text, publicado_em timestamptz, oculto boolean not null default false);
create index if not exists feed_publicado on feed_itens(publicado_em desc) where not oculto;
create or replace function public.reporte_gestor() returns boolean language sql stable security definer
set search_path=public as $$ select conta_ativa() and (tenho_papel('lideranca') or papel_atual()='admin') $$;
create or replace function public.reporte_pode(p_frente uuid) returns boolean language sql stable security definer
set search_path=public as $$ select reporte_gestor() and exists(select 1 from reporte_frentes f join grupos g on g.id=f.grupo_id
 where f.id=p_frente and f.ativo and g.ativo and f.responsavel=any(g.responsaveis) and (f.responsavel=portal_registro_atual() or papel_atual()='admin')) $$;

-- Ciclos são materializados na abertura do painel e também podem ser chamados pelo cron.
create or replace function public.reporte_ciclo_materializar() returns uuid language plpgsql volatile security definer
set search_path=public as $$
declare d date := date_trunc('week', now() at time zone 'America/Sao_Paulo')::date;
 c reporte_config; v uuid; novo boolean;
begin
 select * into c from reporte_config where id;
 insert into reporte_ciclos(semana,prazo,reuniao_em)
 values(d, (d+c.dia_prazo+c.hora_prazo) at time zone 'America/Sao_Paulo',
 ((d+7)+c.dia_reuniao+c.hora_reuniao) at time zone 'America/Sao_Paulo') on conflict do nothing;
 novo:=found;
 select id into v from reporte_ciclos where semana=d;
 insert into reporte_frentes(grupo_id,responsavel)
 select g.id,r from grupos g cross join lateral unnest(g.responsaveis) r
 join membros m on m.registro=r where g.ativo and m.status in ('Ativo','Em pausa / avaliação')
 and exists(select 1 from grupo_papeis gp join grupos gl on gl.id=gp.grupo_id where gp.papel='lideranca' and gl.ativo and esta_no_grupo(gl.id,r))
 on conflict do nothing;
 if novo then perform notificar(array(select distinct responsavel from reporte_frentes f join grupos g on g.id=f.grupo_id where f.ativo and g.ativo and f.responsavel=any(g.responsaveis)), 'reporte_aberto','Reporte semanal disponível','Preencha as três etapas até o prazo do ciclo.','#/equipe/reporte');end if;
 return v;
end $$;
revoke execute on function reporte_ciclo_materializar() from public,anon,authenticated;
create or replace function public.reporte_ciclo_atual() returns uuid language plpgsql security definer set search_path=public as $$begin
 if not reporte_gestor() then return null;end if;return reporte_ciclo_materializar();end $$;
create or replace function public.reporte_painel(p_ciclo uuid default null) returns jsonb language plpgsql security definer
set search_path=public as $$
declare v uuid;
begin
 if not reporte_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
 v:=coalesce(p_ciclo,reporte_ciclo_atual());
 return jsonb_build_object('status','ok','ciclo',(select to_jsonb(c) from reporte_ciclos c where id=v),
 'config',(select to_jsonb(c) from reporte_config c where id),
 'frentes',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'grupo_id',g.id,'nome',g.nome,
 'responsavel',f.responsavel,'responsavel_nome',m.nome,'reporte_id',r.id,'enviado_em',r.enviado_em))
 from reporte_frentes f join grupos g on g.id=f.grupo_id join membros m on m.registro=f.responsavel
 left join reportes r on r.frente_id=f.id and r.ciclo_id=v
 where reporte_pode(f.id)
 and m.status in ('Ativo','Em pausa / avaliação')), '[]'));
end $$;
create or replace function public.reporte_configurar(p jsonb) returns jsonb language plpgsql security definer
set search_path=public as $$
begin
 if not (conta_ativa() and papel_atual()='admin') then return jsonb_build_object('status','sem_permissao'); end if;
 if p is null or (p->>'dia_prazo') is null or (p->>'hora_prazo') is null or (p->>'dia_reuniao') is null or (p->>'hora_reuniao') is null
 or (p->>'dia_prazo')::integer not between 0 and 6 or (p->>'dia_reuniao')::integer not between 0 and 6
 then return jsonb_build_object('status','invalido'); end if;
 update reporte_config set dia_prazo=(p->>'dia_prazo')::integer,hora_prazo=(p->>'hora_prazo')::time,
 dia_reuniao=(p->>'dia_reuniao')::integer,hora_reuniao=(p->>'hora_reuniao')::time where id;
 return jsonb_build_object('status','ok');
end $$;
create or replace function public.reporte_abrir(p_ciclo uuid,p_frente uuid) returns jsonb language plpgsql security definer
set search_path=public as $$
declare r reportes; g grupos; c reporte_ciclos;
begin
 if not reporte_pode(p_frente) then return jsonb_build_object('status','sem_permissao'); end if;
 select * into c from reporte_ciclos where id=p_ciclo;
 if not found then return jsonb_build_object('status','nao_encontrado'); end if;
 select g0.* into g from grupos g0 join reporte_frentes f on f.grupo_id=g0.id where f.id=p_frente;
 insert into reportes(ciclo_id,frente_id,autor,apontamentos)
 select p_ciclo,p_frente,portal_registro_atual(),coalesce(jsonb_agg(jsonb_build_object('registro',m.registro,
 'assiduidade','SUFICIENTE','entregas','SUFICIENTE','sinalizado',false,'justificativa','')), '[]')
 from membros m where m.status in ('Ativo','Em pausa / avaliação') and esta_no_grupo(g.id,m.registro)
 and m.registro<>(select responsavel from reporte_frentes where id=p_frente)
 on conflict(ciclo_id,frente_id) do nothing;
 select * into r from reportes where ciclo_id=p_ciclo and frente_id=p_frente;
 return jsonb_build_object('status','ok','reporte',to_jsonb(r),'ciclo',to_jsonb(c),'grupo',to_jsonb(g),
 'feed',coalesce((select jsonb_agg(to_jsonb(f)) from feed_itens f where reporte_id=r.id),'[]'));
end $$;
create or replace function public.reporte_salvar(p jsonb) returns jsonb language plpgsql security definer
set search_path=public as $$
declare r reportes; x jsonb; f uuid; g integer; n integer;
begin
 select * into r from reportes where id=(p->>'id')::uuid for update;
 if not found or not reporte_pode(r.frente_id) then return jsonb_build_object('status','sem_permissao'); end if;
 if r.enviado_em is not null or exists(select 1 from reporte_ciclos where id=r.ciclo_id and (fechado or prazo<now()))
 then return jsonb_build_object('status','encerrado'); end if;
 if (p->>'versao')::integer is distinct from r.versao then return jsonb_build_object('status','conflito'); end if;
 if jsonb_typeof(p->'apontamentos') is distinct from 'array' or jsonb_typeof(p->'escalonamentos') is distinct from 'array'
 or jsonb_typeof(p->'feed') is distinct from 'array' then return jsonb_build_object('status','invalido'); end if;
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
alter table atividades drop constraint if exists atividades_origem_tipo_check;
alter table atividades add constraint atividades_origem_tipo_check
 check(origem_tipo is null or origem_tipo in ('solicitacao','apontamento','ocorrencia','reporte','newsletter'));
create or replace function public.reporte_enviar(p_id uuid,p_versao integer) returns jsonb language plpgsql security definer
set search_path=public as $$
declare r reportes; x jsonb; g text;
begin
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
drop function if exists public.feed_lista(timestamptz,integer);
create or replace function public.feed_lista(p_antes timestamptz default null,p_limite integer default 20,p_id uuid default null)
returns jsonb language sql stable security definer set search_path=public as $$
 select case when not conta_ativa() then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x)) from
 (select f.id,f.titulo,f.subtitulo,f.texto,f.imagem_path,f.publicado_em,m.nome as autor
 from feed_itens f join membros m on m.registro=f.autor where not f.oculto and f.publicado_em is not null
 and (p_antes is null or f.publicado_em<p_antes or (p_id is not null and f.publicado_em=p_antes and f.id<p_id)) order by f.publicado_em desc,f.id desc limit least(greatest(p_limite,1),50)) x),'[]') end $$;
create or replace function public.feed_ocultar(p_id uuid) returns jsonb language plpgsql security definer
set search_path=public as $$ begin
 if not conta_ativa() or not (papel_atual()='admin' or tenho_papel('pessoal')) then return jsonb_build_object('status','sem_permissao'); end if;
 update feed_itens set oculto=true where id=p_id; return jsonb_build_object('status','ok'); end $$;
create or replace function public.reporte_unificado(p_ciclo uuid) returns jsonb language plpgsql security definer
set search_path=public as $$ begin
 if papel_atual()<>'admin' then return jsonb_build_object('status','sem_permissao'); end if;
 return jsonb_build_object('status','ok','painel',reporte_painel(p_ciclo),
 'reportes',coalesce((select jsonb_agg(to_jsonb(r)) from reportes r where ciclo_id=p_ciclo),'[]'),
 'atrasados',coalesce((select jsonb_agg(to_jsonb(a)) from atividades a where not arquivada and status<>'concluida' and prazo<current_date),'[]'),
 'replanejados',coalesce((select jsonb_agg(to_jsonb(a)) from atividades a where not arquivada and
 (select count(*) from atividade_log l where l.atividade_id=a.id and l.tipo='prazo' and l.de is not null)>2),'[]'),
 'ocorrencias',coalesce((select jsonb_agg(to_jsonb(o)) from ocorrencias o join reporte_ciclos c on c.id=p_ciclo
 where o.data between c.semana and c.semana+6),'[]'));
end $$;
-- Tabelas sem escrita direta. Rascunhos e avaliações não são dados do feed.
do $$ declare t text; f text; begin
 foreach t in array array['reporte_frentes','reporte_config','reporte_ciclos','reportes','feed_itens'] loop
 execute format('alter table %I enable row level security',t);
 execute format('revoke all on %I from anon, authenticated',t);
 end loop;
 foreach f in array array['reporte_gestor()','reporte_pode(uuid)','reporte_ciclo_atual()',
 'reporte_painel(uuid)','reporte_configurar(jsonb)','reporte_abrir(uuid,uuid)','reporte_salvar(jsonb)',
 'reporte_enviar(uuid,integer)','feed_lista(timestamptz,integer,uuid)','feed_ocultar(uuid)','reporte_unificado(uuid)'] loop
 execute 'revoke execute on function public.'||f||' from public, anon';
 execute 'grant execute on function public.'||f||' to authenticated';
 end loop;
end $$;
insert into storage.buckets(id,name,public) values('feed','feed',false) on conflict(id) do nothing;
-- limite de 5 MB e só imagem, também na API (não só no front); idempotente
update storage.buckets set file_size_limit=5242880,
 allowed_mime_types=array['image/png','image/jpeg','image/webp'] where id='feed';
create or replace function public.feed_imagem_pode(p_name text,p_escrita boolean default false) returns boolean
language sql stable security definer set search_path=public as $$
 select conta_ativa() and exists(select 1 from reportes r where r.id::text=split_part(p_name,'/',1)
 and ((reporte_pode(r.frente_id) and r.enviado_em is null)
 or (not p_escrita and exists(select 1 from feed_itens f where f.reporte_id=r.id and f.imagem_path=p_name and f.publicado_em is not null and not f.oculto)))) $$;
revoke execute on function feed_imagem_pode(text,boolean) from public,anon;
grant execute on function feed_imagem_pode(text,boolean) to authenticated;
drop policy if exists feed_ler on storage.objects;
create policy feed_ler on storage.objects for select to authenticated using(bucket_id='feed' and feed_imagem_pode(name));
drop policy if exists feed_inserir on storage.objects;
create policy feed_inserir on storage.objects for insert to authenticated with check(bucket_id='feed' and feed_imagem_pode(name,true));
select public.conta_ativa_travar();

-- Newsletter: conteúdo imutável após aprovação, três votos distintos da liderança.
create table if not exists public.newsletters (
 id uuid primary key default gen_random_uuid(), tipo text not null check(tipo in ('semanal','mensal')),
 periodo_ini date not null, periodo_fim date not null check(periodo_fim>=periodo_ini),
 assunto text not null, itens jsonb not null default '[]', status text not null default 'em_aprovacao'
 check(status in ('em_aprovacao','aprovada','enviada','cancelada')), versao integer not null default 1,
 card_id uuid references atividades(id), criado_em timestamptz not null default now(), unique(tipo,periodo_ini));
create table if not exists public.newsletter_aprovacoes (
 newsletter_id uuid not null references newsletters(id), registro integer not null references membros(registro),
 versao integer not null, decisao boolean not null, comentario text, em timestamptz not null default now(),
 primary key(newsletter_id,registro));
create table if not exists public.comunidade_inscritos (
 id uuid primary key default gen_random_uuid(), email text unique not null check(email=lower(trim(email)) and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 nome text not null, origem text not null, token uuid unique not null default gen_random_uuid(),
 inscrito_em timestamptz not null default now(), descadastrado_em timestamptz);
create table if not exists public.newsletter_envios (
 id uuid primary key default gen_random_uuid(), newsletter_id uuid not null references newsletters(id),
 registro integer references membros(registro), comunidade_id uuid references comunidade_inscritos(id),
 email text not null, nome text not null, enviado_em timestamptz, tentativas integer not null default 0,
 erro text, unique(newsletter_id,email), check((registro is null)<>(comunidade_id is null)));
create or replace function public.newsletter_lider(p_reg integer) returns boolean language sql stable security definer
set search_path=public as $$ select exists(select 1 from membros m where m.registro=p_reg
 and m.status in ('Ativo','Em pausa / avaliação') and exists(select 1 from grupo_papeis gp join grupos g on g.id=gp.grupo_id
 where gp.papel='lideranca' and g.ativo and esta_no_grupo(g.id,m.registro))) $$;
create or replace function public.newsletter_criar(p_tipo text,p_inicio date,p_fim date) returns uuid
language plpgsql security definer set search_path=public as $$
declare v uuid; g integer; seq0 integer; card uuid; titulo0 text; itens0 jsonb;
begin
 select id into v from newsletters where tipo=p_tipo and periodo_ini=p_inicio;
 if v is not null then return v; end if;
 select coalesce(jsonb_agg(jsonb_build_object('titulo',titulo,'subtitulo',subtitulo,'texto',texto,'id',id)
 order by publicado_em),'[]') into itens0 from feed_itens where publicado_em is not null and not oculto
 and (publicado_em at time zone 'America/Sao_Paulo')::date between p_inicio and p_fim;
 if itens0='[]'::jsonb then return null; end if;
 titulo0:='Boletim '||p_tipo||': '||to_char(p_inicio,'DD/MM/YYYY');
 insert into newsletters(tipo,periodo_ini,periodo_fim,assunto,itens) values(p_tipo,p_inicio,p_fim,titulo0,itens0)
 on conflict(tipo,periodo_ini) do nothing returning id into v;
 if v is null then select id into v from newsletters where tipo=p_tipo and periodo_ini=p_inicio;return v;end if;
 select gp.grupo_id into g from grupo_papeis gp join grupos g0 on g0.id=gp.grupo_id where gp.papel='lideranca' and g0.ativo order by g0.id limit 1;
 if g is null then raise exception 'Grupo de liderança não configurado.';end if;
 perform pg_advisory_xact_lock(hashtext('atividade_seq'),g);
 select coalesce(max(seq),0)+1 into seq0 from atividades where grupo_id=g;
 insert into atividades(codigo,grupo_id,seq,titulo,descricao,origem_tipo,origem_id)
 select prefixo||'-'||seq0,g,seq0,titulo0,'Revisar o boletim: #/equipe/newsletter/'||v::text,'newsletter',v::text from grupos where id=g returning id into card;
 update newsletters set card_id=card where id=v;
 perform notificar(array(select m.registro from membros m where newsletter_lider(m.registro)),
 'newsletter_aprovacao',titulo0,'O boletim aguarda três aprovações da liderança.','#/equipe/newsletter/'||v::text);
 return v;
end $$;
create or replace function public.newsletter_gerar(p_tipo text) returns jsonb language plpgsql security definer
set search_path=public as $$ declare d date:=(now() at time zone 'America/Sao_Paulo')::date; i date; f date; v uuid;
begin
 if not reporte_gestor() then return jsonb_build_object('status','sem_permissao');end if;
 if p_tipo='semanal' then f:=date_trunc('week',d)::date-1;i:=f-6;
 elsif p_tipo='mensal' then f:=date_trunc('month',d)::date-1;i:=date_trunc('month',f)::date;
 else return jsonb_build_object('status','invalido');end if;
 v:=newsletter_criar(p_tipo,i,f);return jsonb_build_object('status','ok','id',v);
end $$;
create or replace function public.newsletter_lista() returns jsonb language sql stable security definer set search_path=public as $$
 select case when not reporte_gestor() then '[]'::jsonb else coalesce((select jsonb_agg(to_jsonb(x)) from
 (select n.*, (select count(*) from newsletter_aprovacoes a where a.newsletter_id=n.id and a.versao=n.versao and a.decisao) as aprovacoes
 from newsletters n order by criado_em desc limit 50) x),'[]') end $$;
create or replace function public.newsletter_revisar(p_id uuid,p_assunto text,p_itens jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$ declare n newsletters; x jsonb;
begin
 if not reporte_gestor() then return jsonb_build_object('status','sem_permissao');end if;
 select * into n from newsletters where id=p_id for update;
 if not found or n.status<>'em_aprovacao' then return jsonb_build_object('status','encerrado');end if;
 if length(trim(p_assunto)) not between 1 and 200 or jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)=0
 then return jsonb_build_object('status','invalido');end if;
 for x in select * from jsonb_array_elements(p_itens) loop
 if length(trim(coalesce(x->>'titulo','')))=0 or length(trim(coalesce(x->>'subtitulo','')))=0
 then return jsonb_build_object('status','invalido');end if;end loop;
 update newsletters set assunto=trim(p_assunto),itens=p_itens,versao=versao+1 where id=p_id;
 delete from newsletter_aprovacoes where newsletter_id=p_id;
 return jsonb_build_object('status','ok');
end $$;
create or replace function public.newsletter_decidir(p_id uuid,p_versao integer,p_aprova boolean,p_comentario text default null)
returns jsonb language plpgsql security definer set search_path=public as $$ declare n newsletters; r integer:=portal_registro_atual();
begin
 if not newsletter_lider(r) then return jsonb_build_object('status','sem_permissao');end if;
 select * into n from newsletters where id=p_id for update;
 if not found or n.status<>'em_aprovacao' then return jsonb_build_object('status','encerrado');end if;
 if n.versao<>p_versao then return jsonb_build_object('status','conflito');end if;
 insert into newsletter_aprovacoes(newsletter_id,registro,versao,decisao,comentario) values(p_id,r,n.versao,p_aprova,p_comentario)
 on conflict(newsletter_id,registro) do update set versao=excluded.versao,decisao=excluded.decisao,comentario=excluded.comentario,em=now();
 if (select count(*) from newsletter_aprovacoes where newsletter_id=p_id and versao=n.versao and decisao and newsletter_lider(registro))>=3
 and not exists(select 1 from newsletter_aprovacoes where newsletter_id=p_id and versao=n.versao and not decisao) then
  update newsletters set status='aprovada' where id=p_id;
  if n.tipo='semanal' then
   insert into newsletter_envios(newsletter_id,registro,email,nome)
   select p_id,m.registro,lower(coalesce(nullif(m.email_nro,''),m.email_pessoal)),m.nome from membros m
   where m.status in ('Ativo','Em pausa / avaliação') and coalesce(nullif(m.email_nro,''),nullif(m.email_pessoal,'')) is not null
   and not exists(select 1 from notificacao_canais c where c.registro=m.registro and c.categoria='reporte' and c.email='nunca') on conflict do nothing;
  else
   insert into newsletter_envios(newsletter_id,comunidade_id,email,nome)
   select p_id,id,email,nome from comunidade_inscritos where descadastrado_em is null on conflict do nothing;
  end if;
  update atividades set status='concluida',concluida_em=now() where id=n.card_id;
 end if;
 return jsonb_build_object('status','ok');
end $$;
create or replace function public.comunidade_importar(p_itens jsonb) returns jsonb language plpgsql security definer
set search_path=public as $$ declare x jsonb; n integer:=0;
begin
 if papel_atual()<>'admin' then return jsonb_build_object('status','sem_permissao');end if;
 if jsonb_typeof(p_itens)<>'array' or jsonb_array_length(p_itens)>5000 then return jsonb_build_object('status','invalido');end if;
 for x in select * from jsonb_array_elements(p_itens) loop
 if coalesce(x->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(trim(coalesce(x->>'nome','')))=0
 then return jsonb_build_object('status','invalido');end if;end loop;
 for x in select * from jsonb_array_elements(p_itens) loop
 insert into comunidade_inscritos(email,nome,origem) values(lower(trim(x->>'email')),trim(x->>'nome'),coalesce(nullif(x->>'origem',''),'Importação'))
 on conflict(email) do update set nome=excluded.nome;
 n:=n+1;end loop;
 return jsonb_build_object('status','ok','processados',n);
end $$;
create or replace function public.comunidade_descadastrar(p_token uuid) returns jsonb language plpgsql security definer
set search_path=public as $$ begin
 update comunidade_inscritos set descadastrado_em=coalesce(descadastrado_em,now()) where token=p_token;
 return jsonb_build_object('status','ok');end $$;
create or replace function public.newsletter_lote(p_limite integer default 50) returns jsonb
language plpgsql security definer set search_path=public as $$ declare d date:=(now() at time zone 'America/Sao_Paulo')::date;
begin
 perform reporte_ciclo_materializar();
 -- A passada da fila materializa o período anterior; a chave única evita duplicação.
 perform newsletter_criar('semanal',date_trunc('week',d)::date-7,date_trunc('week',d)::date-1);
 perform newsletter_criar('mensal',date_trunc('month',d- extract(day from d)::integer)::date,date_trunc('month',d)::date-1);
 return coalesce((select jsonb_agg(to_jsonb(x)) from (select e.id,e.email,e.nome,n.assunto,n.itens,c.token,
 n.tipo,n.id as newsletter_id from newsletter_envios e join newsletters n on n.id=e.newsletter_id
 left join comunidade_inscritos c on c.id=e.comunidade_id left join membros m on m.registro=e.registro
 where n.status='aprovada' and e.enviado_em is null and e.tentativas<5
 and ((c.id is not null and c.descadastrado_em is null) or (m.registro is not null and m.status in ('Ativo','Em pausa / avaliação')
 and not exists(select 1 from notificacao_canais p where p.registro=m.registro and p.categoria='reporte' and p.email='nunca')))
 order by e.id limit least(greatest(p_limite,1),200)) x),'[]');
end $$;
create or replace function public.newsletter_baixa(p_id uuid,p_erro text default null) returns void
language plpgsql security definer set search_path=public as $$ declare v uuid;begin
 update newsletter_envios set tentativas=tentativas+1,erro=left(p_erro,500),enviado_em=case when p_erro is null then now() else enviado_em end
 where id=p_id and enviado_em is null returning newsletter_id into v;
 if v is not null and not exists(select 1 from newsletter_envios e where newsletter_id=v and enviado_em is null)
 then update newsletters set status='enviada' where id=v;end if;
end $$;
do $$ declare t text;f text;begin
 foreach t in array array['newsletters','newsletter_aprovacoes','comunidade_inscritos','newsletter_envios'] loop
 execute format('alter table %I enable row level security',t);execute format('revoke all on %I from anon,authenticated',t);end loop;
 foreach f in array array['newsletter_criar(text,date,date)','newsletter_lote(integer)','newsletter_baixa(uuid,text)'] loop
 execute 'revoke execute on function '||f||' from public,anon,authenticated';
 if exists(select 1 from pg_roles where rolname='service_role') then execute 'grant execute on function '||f||' to service_role';end if;end loop;
 foreach f in array array['newsletter_lider(integer)','newsletter_gerar(text)','newsletter_lista()',
 'newsletter_revisar(uuid,text,jsonb)','newsletter_decidir(uuid,integer,boolean,text)','comunidade_importar(jsonb)'] loop
 execute 'revoke execute on function '||f||' from public,anon';execute 'grant execute on function '||f||' to authenticated';end loop;
end $$;
revoke execute on function comunidade_descadastrar(uuid) from public;
grant execute on function comunidade_descadastrar(uuid) to anon,authenticated;
select public.conta_ativa_travar();
do $$ begin
 if exists(select 1 from pg_roles where rolname='service_role') then grant execute on function comunidade_descadastrar(uuid) to service_role;end if;
end $$;

-- Ata da agenda: um PN por evento, rascunho salvo antes de abrir o editor.
alter table agenda_predefinidos add column if not exists gera_ata boolean not null default false;
alter table agenda_predefinidos add column if not exists ata_serie_id uuid references doc_series(id);
alter table eventos add column if not exists ata_arquivo_id uuid references doc_arquivos(id);
create or replace function public.evento_ata_abrir(p_evento uuid) returns jsonb language plpgsql security definer
set search_path=public as $$ declare e eventos; pd agenda_predefinidos; serie uuid; resultado jsonb; dados jsonb;
 campos jsonb; presentes jsonb; codigo0 text;begin
 if not conta_ativa() then return jsonb_build_object('status','sem_permissao');end if;
 select * into e from eventos where id=p_evento for update;
 if not found then return jsonb_build_object('status','nao_encontrado');end if;
 if e.status='Cancelado' then return jsonb_build_object('status','encerrado');end if;
 if e.owner_registro is distinct from portal_registro_atual() and not exists(select 1 from evento_participantes
 where evento_id=e.id and registro=portal_registro_atual()) then return jsonb_build_object('status','sem_permissao');end if;
 if e.ata_arquivo_id is not null then
 if not doc_pode_editar(e.ata_arquivo_id) then return jsonb_build_object('status','sem_permissao');end if;
 return jsonb_build_object('status','ok','codigo',(select codigo from doc_arquivos where id=e.ata_arquivo_id));end if;
 select * into pd from agenda_predefinidos where id=e.predefinido_id;
 if not found or not pd.gera_ata then return jsonb_build_object('status','sem_ata');end if;
 serie:=coalesce(pd.ata_serie_id,(select id from doc_series where prefixo='PUB' and sn=3));
 select formulario->'campos' into campos from doc_series where id=serie and formulario is not null;
 if campos is null then return jsonb_build_object('status','sem_formulario');end if;
 if not doc_pode_criar(serie,null) then return jsonb_build_object('status','sem_permissao');end if;
 resultado:=doc_arquivo_criar(jsonb_build_object('serie_id',serie,'titulo',e.titulo));
 if resultado->>'status'<>'ok' then return resultado;end if;
 select coalesce(jsonb_agg(jsonb_build_object('nome',m.nome,'nota',case p.resposta when 'vou' then 'Confirmado' else 'Convidado' end)),'[]')
 into presentes from evento_participantes p join membros m on m.registro=p.registro where p.evento_id=e.id and p.resposta<>'nao';
 dados:=jsonb_build_object('assunto',e.titulo,'data',e.data,'hora',e.hora_inicio,'local',coalesce(nullif(e.local,''),(select nome from espacos where id=e.espaco_id),nullif(e.meet_url,''),''),
 'presentes',presentes,'pauta',jsonb_build_array(e.titulo),'data_redacao',current_date,'hora_redacao',to_char(now() at time zone 'America/Sao_Paulo','HH24:MI'));
 select coalesce(jsonb_object_agg(k,v),'{}') into dados from jsonb_each(dados) x(k,v)
 where exists(select 1 from jsonb_array_elements(campos) c where c->>'id'=x.k);
 codigo0:=resultado->>'codigo';
 resultado:=doc_formulario_salvar((resultado->>'id')::uuid,dados);
 if resultado->>'status'<>'ok' then raise exception 'Não foi possível salvar o rascunho: %',resultado->>'status';end if;
 update eventos set ata_arquivo_id=(select id from doc_arquivos where codigo=codigo0) where id=e.id;
 return jsonb_build_object('status','ok','codigo',codigo0);
end $$;
revoke execute on function evento_ata_abrir(uuid) from public,anon;
grant execute on function evento_ata_abrir(uuid) to authenticated;

-- Marca: metadados públicos para membros; o conteúdo continua sob doc_pode_ler.
create table if not exists marca_vinculos(chave text primary key,serie_id uuid references doc_series(id) on delete set null,
 atualizado_em timestamptz not null default now(),atualizado_por text);
alter table marca_vinculos enable row level security;
drop policy if exists marca_ler on marca_vinculos;
create policy marca_ler on marca_vinculos for select to authenticated using(true);
drop policy if exists marca_gerir on marca_vinculos;
create policy marca_gerir on marca_vinculos for all to authenticated using(doc_gestor()) with check(doc_gestor());
grant select,insert,update,delete on marca_vinculos to authenticated;
insert into marca_vinculos(chave) select unnest(array['relatorio','apresentacao-formal','apresentacao-marca','carta','memorando',
 'documentos-e-registros','boletim','comunicado','certificado','certificado-marca','convite','selo','cracha','cartao']) on conflict do nothing;
update marca_vinculos set serie_id=(select id from doc_series where prefixo='PUB' and sn=2)
 where chave='documentos-e-registros' and serie_id is null;
create or replace function marca_carimbar() returns trigger language plpgsql set search_path=public as $$begin
 new.atualizado_em:=now();new.atualizado_por:=doc_meu_nome();return new;end $$;
drop trigger if exists marca_carimbo on marca_vinculos;
create trigger marca_carimbo before insert or update on marca_vinculos for each row execute function marca_carimbar();
update portal_links set titulo='Manual da marca' where url ilike 'https://brand.neurodynamics.dev%' and titulo='Brand guidelines';
alter table agenda_predefinidos alter column cor set default '#5BBFB0';
select public.conta_ativa_travar();

-- O painel conta somente avisos cujo horário de envio chegou.
create or replace function public.fila_situacao()
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  e public.fila_estado; v_agendada boolean := false; v_pend jsonb := '{}'::jsonb; n bigint;
begin
  if not (public.eh_gestao() or public.tenho_papel('selecao')) then
    return jsonb_build_object('status', 'sem_permissao');
  end if;
  select * into e from fila_estado where id;
  if to_regnamespace('cron') is not null then
    begin execute 'select exists (select 1 from cron.job where jobname = ''soma-fila'' and active)' into v_agendada;
    exception when others then v_agendada := false; end;
  end if;
  select coalesce(sum(jsonb_array_length(x->'itens')),0) into n from jsonb_array_elements(notificacoes_email_lote(1000000)) x;
  v_pend := v_pend || jsonb_build_object('avisos', n);
  if to_regclass('public.agenda_envios') is not null then
    execute 'select count(*) from agenda_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('agenda', n);
  end if;
  if to_regclass('public.doc_envios') is not null then
    execute 'select count(*) from doc_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('declaracoes', n);
  end if;
  if to_regclass('public.ps_envios') is not null then
    execute 'select count(*) from ps_envios where enviado_em is null and tentativas < 5' into n;
    v_pend := v_pend || jsonb_build_object('selecao', n);
  end if;
  if to_regclass('public.email_programados') is not null then
    execute 'select count(*) from email_programados where status = ''programado'' and enviar_em <= now()' into n;
    v_pend := v_pend || jsonb_build_object('programados', n);
  end if;
  return jsonb_build_object(
    'status', 'ok',
    'agendada', v_agendada,
    'em_curso_desde', e.em_curso_desde, 'em_curso_origem', e.em_curso_origem,
    'ultima_inicio', e.ultima_inicio, 'ultima_fim', e.ultima_fim,
    'ultimo_chamado', e.ultimo_chamado, 'ultimo_empurrao', e.ultimo_empurrao,
    'por_origem', coalesce((select jsonb_object_agg(origem, ultima)
                              from (select origem, max(inicio) as ultima from fila_passadas group by origem) x), '{}'::jsonb),
    'ultimo_erro', (select jsonb_build_object('quando', inicio, 'origem', origem, 'resultado', resultado)
                      from fila_passadas
                     where resultado is not null and coalesce(resultado->>'status', '') not in ('ok', 'ocupada')
                     order by id desc limit 1),
    'pendentes', v_pend);
end $$;
select public.conta_ativa_travar();

-- Registro somente depois de todas as seções terem sido aplicadas.
insert into public.migracoes(id,descricao) values('2.18.0_soma',
 'SOMA 2.18.0: papéis por grupo, folha única de check-in, cartões espelhados, avisos por categoria, reporte semanal, feed, newsletters, atas de evento e Marca')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, aplicada_em from public.migracoes where id='2.18.0_soma';
-- select gp.papel,g.nome,g.ativo from public.grupo_papeis gp join public.grupos g on g.id=gp.grupo_id;
-- select count(*) as folhas_ativas from public.checkin_folhas where revogada_em is null;
-- select id,public from storage.buckets where id='feed';
-- select semana,prazo,reuniao_em from public.reporte_ciclos order by semana desc limit 4;
-- select tipo,periodo_ini,status,versao from public.newsletters order by criado_em desc limit 10;
-- select chave,serie_id from public.marca_vinculos order by chave;
