-- ============================================================
-- SOMA 10.0 — MIGRAÇÃO · NeuroDynamics
-- PORTAL DO MEMBRO (membro.neurodynamics.dev): quadro de
-- avisos da gestão, solicitações ao Depto de Pessoal (acesso a
-- documento/sistema/plataforma, afastamento temporário,
-- desligamento, reunião 1:1 com o gestor e pedidos gerais) e
-- ouvidoria anônima para a Gestão de Pessoas.
--
-- O portal usa o MESMO login do SOMA (perfis/papéis). Membros
-- comuns (papel "leitura") leem os avisos publicados, abrem e
-- acompanham as próprias solicitações; admin/pessoal gerenciam
-- tudo pelo painel admin.html do portal.
--
-- Pré-requisito: SOMA 9.0 aplicada.
-- Idempotente: pode rodar mais de uma vez sem duplicar nada.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

-- ------------------------------------------------------------
-- 0. APOIO — registro do membro logado (null se a conta ainda
--    não foi vinculada a um registro pelo Depto de Pessoal).
-- ------------------------------------------------------------
create or replace function public.portal_registro_atual()
returns integer language sql stable security definer
set search_path = public
as $$
  select registro from public.perfis where id = auth.uid();
$$;
grant execute on function public.portal_registro_atual() to authenticated;

-- ------------------------------------------------------------
-- 1. QUADRO DE AVISOS
--    Banner rotativo na home do portal. "layout" escolhe o
--    modelo visual pré-definido; "data_evento" alimenta o
--    bloco de data do layout "evento"; o período (data_inicio/
--    data_fim, ambos opcionais) controla a exibição.
-- ------------------------------------------------------------
create table if not exists public.portal_avisos (
  id            uuid primary key default gen_random_uuid(),
  titulo        text not null,
  corpo         text,
  layout        text not null default 'padrao'
                check (layout in ('padrao','destaque','urgente','evento','conquista')),
  link_url      text,
  link_rotulo   text,
  data_evento   date,                         -- usado pelo layout "evento"
  data_inicio   date,                         -- vazio = desde já
  data_fim      date,                         -- vazio = sem prazo
  ordem         integer not null default 100,
  publicado     boolean not null default false,
  criado_por    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint portal_aviso_periodo
    check (data_fim is null or data_inicio is null or data_fim >= data_inicio)
);
create index if not exists idx_pavisos_ordem
  on public.portal_avisos (publicado, ordem);

drop trigger if exists tg_upd_pavisos on public.portal_avisos;
create trigger tg_upd_pavisos before update on public.portal_avisos
  for each row execute function public.fn_atualizado();

-- ------------------------------------------------------------
-- 2. SOLICITAÇÕES AO DEPTO DE PESSOAL
--    Um ticket por pedido, com protocolo (SOL26-0001). Os
--    campos específicos de cada tipo ficam em "dados" (jsonb):
--      acesso        -> item, item_id?, categoria?, justificativa,
--                       tempo_necessario, observacoes?
--      afastamento   -> data_inicio, data_fim, motivo, observacoes?
--      desligamento  -> data_prevista, motivo, observacoes?
--      reuniao_1_1   -> gestor_registro?, tema, preferencia?, urgencia?
--      outro         -> descricao
-- ------------------------------------------------------------
create table if not exists public.portal_solicitacoes (
  id            uuid primary key default gen_random_uuid(),
  numero        integer generated always as identity,
  protocolo     text unique,
  registro      integer not null references public.membros(registro) on delete cascade,
  tipo          text not null
                check (tipo in ('acesso','afastamento','desligamento','reuniao_1_1','outro')),
  status        text not null default 'aberta'
                check (status in ('aberta','em_analise','aprovada','recusada','concluida','cancelada')),
  titulo        text not null,
  dados         jsonb not null default '{}'::jsonb,
  resposta      text,                          -- devolutiva do Depto de Pessoal
  respondido_por text,
  respondido_em timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists idx_psol_registro on public.portal_solicitacoes (registro, criado_em desc);
create index if not exists idx_psol_status   on public.portal_solicitacoes (status, criado_em desc);

drop trigger if exists tg_upd_psol on public.portal_solicitacoes;
create trigger tg_upd_psol before update on public.portal_solicitacoes
  for each row execute function public.fn_atualizado();

-- ------------------------------------------------------------
-- 3. OUVIDORIA ANÔNIMA (Gestão de Pessoas)
--    Sem coluna de autor, sem auth.uid() e SEM gatilho de
--    auditoria — o anonimato é de projeto, não de promessa.
--    A data é truncada para o DIA (evita correlação com
--    check-ins e horários de acesso).
-- ------------------------------------------------------------
create table if not exists public.portal_ouvidoria (
  id         uuid primary key default gen_random_uuid(),
  categoria  text not null default 'outro'
             check (categoria in ('gestao_pessoas','conduta','sugestao','outro')),
  mensagem   text not null,
  dia        date not null default (now() at time zone 'America/Sao_Paulo')::date,
  tratado    boolean not null default false,
  tratado_por text                             -- quem TRATOU (equipe), nunca quem enviou
);
create index if not exists idx_pouv_dia on public.portal_ouvidoria (tratado, dia desc);

-- ------------------------------------------------------------
-- 4. AUDITORIA (avisos e solicitações; a ouvidoria fica de
--    fora de propósito — ver seção 3)
-- ------------------------------------------------------------
drop trigger if exists tg_aud_pavisos on public.portal_avisos;
create trigger tg_aud_pavisos after insert or update or delete on public.portal_avisos
  for each row execute function public.fn_auditoria();
drop trigger if exists tg_aud_psol on public.portal_solicitacoes;
create trigger tg_aud_psol after insert or update or delete on public.portal_solicitacoes
  for each row execute function public.fn_auditoria();

-- ------------------------------------------------------------
-- 5. SEGURANÇA (RLS)
-- ------------------------------------------------------------
alter table public.portal_avisos       enable row level security;
alter table public.portal_solicitacoes enable row level security;
alter table public.portal_ouvidoria    enable row level security;

-- 5a. Avisos: membros leem o que está publicado e dentro do
--     período; admin/pessoal leem e editam tudo.
drop policy if exists pavisos_select on public.portal_avisos;
create policy pavisos_select on public.portal_avisos
  for select to authenticated
  using (
    public.papel_atual() in ('admin','pessoal')
    or (publicado
        and (data_inicio is null or data_inicio <= (now() at time zone 'America/Sao_Paulo')::date)
        and (data_fim    is null or data_fim    >= (now() at time zone 'America/Sao_Paulo')::date))
  );
drop policy if exists pavisos_write on public.portal_avisos;
create policy pavisos_write on public.portal_avisos
  for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- 5b. Solicitações: cada um lê as suas; admin/pessoal leem e
--     tratam todas. Escrita do membro só pelas funções da
--     seção 6 (validação + protocolo).
drop policy if exists psol_select on public.portal_solicitacoes;
create policy psol_select on public.portal_solicitacoes
  for select to authenticated
  using (public.papel_atual() in ('admin','pessoal')
         or registro = public.portal_registro_atual());
drop policy if exists psol_gestao on public.portal_solicitacoes;
create policy psol_gestao on public.portal_solicitacoes
  for update to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- 5c. Ouvidoria: só admin/pessoal leem e marcam como tratada.
--     O envio é exclusivamente pela função da seção 6c (sem
--     insert direto, para ninguém "assinar" sem querer).
drop policy if exists pouv_select on public.portal_ouvidoria;
create policy pouv_select on public.portal_ouvidoria
  for select to authenticated
  using (public.papel_atual() in ('admin','pessoal'));
drop policy if exists pouv_update on public.portal_ouvidoria;
create policy pouv_update on public.portal_ouvidoria
  for update to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));

-- 5d. Catálogo de acessos: o portal mostra a lista de sistemas,
--     documentos e locais no formulário de solicitação de
--     acesso. Política adicional de leitura para autenticados
--     (os nomes do catálogo não são sensíveis; conceder e
--     revogar continuam restritos como antes).
drop policy if exists itens_acesso_portal_select on public.itens_de_acesso;
create policy itens_acesso_portal_select on public.itens_de_acesso
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- 6. FUNÇÕES DO PORTAL
-- ------------------------------------------------------------

-- 6a. Abrir solicitação: valida por tipo, gera o protocolo e
--     devolve {status, protocolo, id}. Conta sem vínculo de
--     registro não abre ticket (fale com o Depto de Pessoal).
create or replace function public.portal_abrir_solicitacao(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg    integer := public.portal_registro_atual();
  v_tipo   text := coalesce(p->>'tipo','');
  v_dados  jsonb := coalesce(p->'dados','{}'::jsonb);
  v_titulo text;
  v_id     uuid;
  v_num    integer;
  v_prot   text;
  v_ini    date;
  v_fim    date;
begin
  if v_reg is null then
    return jsonb_build_object('status','sem_vinculo');
  end if;
  if not exists (select 1 from membros
                  where registro = v_reg
                    and status in ('Ativo','Em pausa / avaliação','Sob demanda')) then
    return jsonb_build_object('status','sem_vinculo');
  end if;

  if v_tipo = 'acesso' then
    if length(trim(coalesce(v_dados->>'item',''))) < 2 then
      return jsonb_build_object('status','invalido','campo','item');
    end if;
    if length(trim(coalesce(v_dados->>'justificativa',''))) < 10 then
      return jsonb_build_object('status','invalido','campo','justificativa');
    end if;
    if length(trim(coalesce(v_dados->>'tempo_necessario',''))) < 2 then
      return jsonb_build_object('status','invalido','campo','tempo_necessario');
    end if;
    v_titulo := 'Acesso: ' || left(trim(v_dados->>'item'), 120);

  elsif v_tipo = 'afastamento' then
    v_ini := nullif(v_dados->>'data_inicio','')::date;
    v_fim := nullif(v_dados->>'data_fim','')::date;
    if v_ini is null or v_fim is null or v_fim < v_ini then
      return jsonb_build_object('status','invalido','campo','periodo');
    end if;
    if length(trim(coalesce(v_dados->>'motivo',''))) < 5 then
      return jsonb_build_object('status','invalido','campo','motivo');
    end if;
    v_titulo := 'Afastamento temporário';

  elsif v_tipo = 'desligamento' then
    if nullif(v_dados->>'data_prevista','') is null then
      return jsonb_build_object('status','invalido','campo','data_prevista');
    end if;
    if length(trim(coalesce(v_dados->>'motivo',''))) < 5 then
      return jsonb_build_object('status','invalido','campo','motivo');
    end if;
    v_titulo := 'Pedido de desligamento';

  elsif v_tipo = 'reuniao_1_1' then
    if length(trim(coalesce(v_dados->>'tema',''))) < 5 then
      return jsonb_build_object('status','invalido','campo','tema');
    end if;
    v_titulo := 'Reunião 1:1 com o gestor';

  elsif v_tipo = 'outro' then
    if length(trim(coalesce(v_dados->>'descricao',''))) < 5 then
      return jsonb_build_object('status','invalido','campo','descricao');
    end if;
    v_titulo := coalesce(nullif(left(trim(v_dados->>'titulo'),120),''), 'Solicitação geral');

  else
    return jsonb_build_object('status','invalido','campo','tipo');
  end if;

  insert into portal_solicitacoes (registro, tipo, titulo, dados)
  values (v_reg, v_tipo, v_titulo, v_dados)
  returning id, numero into v_id, v_num;

  v_prot := 'SOL' || to_char((now() at time zone 'America/Sao_Paulo')::date,'YY')
            || '-' || lpad(v_num::text, 4, '0');
  update portal_solicitacoes set protocolo = v_prot where id = v_id;

  return jsonb_build_object('status','ok','protocolo',v_prot,'id',v_id);
end $$;
grant execute on function public.portal_abrir_solicitacao(jsonb) to authenticated;

-- 6b. Cancelar a própria solicitação (enquanto não tratada).
create or replace function public.portal_cancelar_solicitacao(p_id uuid)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
declare
  v_reg integer := public.portal_registro_atual();
  v_ok  integer;
begin
  if v_reg is null then return jsonb_build_object('status','sem_vinculo'); end if;
  update portal_solicitacoes
     set status = 'cancelada'
   where id = p_id and registro = v_reg
     and status in ('aberta','em_analise');
  get diagnostics v_ok = row_count;
  if v_ok = 0 then return jsonb_build_object('status','nao_cancelavel'); end if;
  return jsonb_build_object('status','ok');
end $$;
grant execute on function public.portal_cancelar_solicitacao(uuid) to authenticated;

-- 6c. Ouvidoria: grava a mensagem SEM nenhum vínculo com a
--     conta. Só exige estar logado (para ficar dentro da
--     equipe) e um mínimo de conteúdo.
create or replace function public.portal_ouvidoria_enviar(p_categoria text, p_mensagem text)
returns jsonb language plpgsql volatile security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('status','nao_autenticado');
  end if;
  if p_categoria not in ('gestao_pessoas','conduta','sugestao','outro') then
    return jsonb_build_object('status','invalido','campo','categoria');
  end if;
  if length(trim(coalesce(p_mensagem,''))) < 15 then
    return jsonb_build_object('status','invalido','campo','mensagem');
  end if;
  insert into portal_ouvidoria (categoria, mensagem)
  values (p_categoria, left(trim(p_mensagem), 8000));
  return jsonb_build_object('status','ok');
end $$;
grant execute on function public.portal_ouvidoria_enviar(text, text) to authenticated;

-- ------------------------------------------------------------
-- 7. CARGA INICIAL — um aviso de boas-vindas, só com a tabela
--    vazia; depois a gestão cuida de tudo pelo admin.html.
-- ------------------------------------------------------------
insert into public.portal_avisos (titulo, corpo, layout, publicado, ordem, criado_por)
select 'Bem-vindo ao Portal do Membro',
       'Aqui você acompanha os avisos da gestão, o calendário da equipe, o organograma e abre solicitações para o Depto de Pessoal — acesso a sistemas e documentos, afastamento, 1:1 com o gestor e mais.',
       'destaque', true, 10, 'SOMA 10.0'
where not exists (select 1 from public.portal_avisos);

-- ============================================================
-- FIM — SOMA 10.0
-- Depois desta migração:
--   1) publique o repositório "membro" (index.html + admin.html)
--      em membro.neurodynamics.dev;
--   2) crie os primeiros avisos em /admin.html (papéis
--      admin/pessoal);
--   3) confira o vínculo conta -> registro dos membros em
--      SOMA · Gestão (sem vínculo, o membro navega mas não
--      abre solicitações).
-- ============================================================
