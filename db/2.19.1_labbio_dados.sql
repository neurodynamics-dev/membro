-- ============================================================
-- SOMA 2.19.1: o que o painel do LABBIO consulta
--
-- Tudo por função labbio_*, só para gestor ativo (conta_labbio()), e só
-- com os campos combinados (D5 do plano): nome, foto, e-mails, telefone,
-- situação, cargo, área, gestor, termo e acesso. Sem bolsa, avaliações,
-- autodeclaração ou acessibilidade. CPF e matrícula só aparecem no pedido
-- de biometria (2.19.1_labbio_acesso).
--
--   labbio_inicio()            os números e as revogações pendentes
--   labbio_membros(busca)      o quadro: situação, termo e acesso
--   labbio_membro(registro)    o perfil: termo (com o arquivo), acesso, pedidos
--   labbio_checkins(...)       as presenças, paginadas, com filtros
--   labbio_treinamentos()      a matriz pessoa × treinamento (sem gabarito)
--   labbio_revogacoes(...)     acesso físico a retirar
--   labbio_revogacao_confirmar(id, obs)
--
-- Revogação pendente: quando o status de um membro com biometria vira um
-- dos de labbio_config.revogar_status (Desligado, Egresso), nasce uma
-- pendência. SEM e-mail, push ou sino: aparece só na faixa do início do
-- painel, até o gestor confirmar que retirou o acesso na Intelbras. Os
-- pedidos de biometria abertos dessa pessoa são cancelados.
--
-- Depende da 2.19.1_labbio_acesso e da 2.19.1_termo. Só acrescenta; pode
-- rodar de novo.
-- ============================================================

alter table public.labbio_config add column if not exists revogar_status text[] not null default '{Desligado,Egresso}';

create table if not exists public.labbio_revogacoes (
  id            uuid primary key default gen_random_uuid(),
  registro      integer not null references membros(registro),
  status_de     text,
  status_para   text not null,
  criada_em     timestamptz not null default now(),
  confirmada_em timestamptz,
  confirmada_por uuid references labbio_gestores(id),
  observacao    text);
create unique index if not exists labbio_revogacoes_aberta on public.labbio_revogacoes (registro) where confirmada_em is null;
alter table public.labbio_revogacoes enable row level security;
revoke all on public.labbio_revogacoes from anon, authenticated;

-- 1. o gatilho: vínculo encerrado com biometria ativa → pendência (sem aviso)
create or replace function public.labbio_vinculo_mudou()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_lista text[] := (select revogar_status from labbio_config where id); p labbio_pedidos;
begin
  if new.status is not distinct from old.status or not (new.status = any(v_lista))
     or old.status = any(v_lista) then return new; end if;
  if exists (select 1 from acessos_concedidos where registro = new.registro and item_id = labbio_item_biometria() and ativo) then
    insert into labbio_revogacoes (registro, status_de, status_para) values (new.registro, old.status, new.status)
    on conflict (registro) where confirmada_em is null do nothing;
  end if;
  for p in select * from labbio_pedidos where registro = new.registro and etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido') loop
    perform labbio_pedido_evento(p, p.etapa, 'cancelado', 'pessoal', null, 'Vínculo encerrado (' || new.status || ')');
    update labbio_pedidos set etapa = 'cancelado', atualizado_em = now() where id = p.id;
    update portal_solicitacoes set status = 'cancelada', resposta = 'Cancelado: vínculo encerrado.' where id = p.solicitacao_id;
  end loop;
  return new;
end $$;
revoke execute on function public.labbio_vinculo_mudou() from public, anon, authenticated;
drop trigger if exists labbio_vinculo_mudou on public.membros;
create trigger labbio_vinculo_mudou after update of status on public.membros
  for each row execute function public.labbio_vinculo_mudou();

-- 2. peças -------------------------------------------------------------------
-- o acesso físico, em três estados (e o subestado operacional)
create or replace function public.labbio_acesso_de(p_reg integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select case
    when exists (select 1 from labbio_revogacoes where registro = p_reg and confirmada_em is null)
      then jsonb_build_object('estado', 'possui', 'sub', 'revogacao_pendente')
    when exists (select 1 from acessos_concedidos where registro = p_reg and item_id = labbio_item_biometria() and ativo)
      then jsonb_build_object('estado', 'possui', 'sub', null,
             'desde', (select concedido_em from acessos_concedidos where registro = p_reg and item_id = labbio_item_biometria()))
    when exists (select 1 from labbio_pedidos where registro = p_reg and etapa in ('pessoal', 'labbio', 'devolvido'))
      then jsonb_build_object('estado', 'solicitado',
             'sub', (select etapa from labbio_pedidos where registro = p_reg and etapa in ('pessoal', 'labbio', 'devolvido') limit 1))
    else jsonb_build_object('estado', 'nao_possui', 'sub', null) end $$;

create or replace function public.labbio_termo_de(p_reg integer)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when public.termo_campanha_atual() is null then jsonb_build_object('situacao', 'sem_campanha')
    else jsonb_build_object('situacao', public.termo_situacao(p_reg, public.termo_campanha_atual()),
      'enviado_em', t.enviado_em, 'conferido_em', t.conferido_em,
      'arquivo', case when public.termo_situacao(p_reg, public.termo_campanha_atual()) in ('enviado', 'conferido') then t.arquivo end)
    end
    from (select 1) x left join termo_pendencias t on t.registro = p_reg and t.campanha = public.termo_campanha_atual() $$;

create or replace function public.labbio_pessoa_json(m membros)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('registro', m.registro, 'nome', m.nome, 'foto_url', m.foto_url,
    'email_nro', m.email_nro, 'email_pessoal', m.email_pessoal, 'telefone', to_jsonb(m)->>'telefone',
    'status', m.status, 'cargo', m.cargo, 'area', m.departamento, 'trainee', public.eh_trainee(m.registro),
    'gestor', m.gestor_registro, 'gestor_nome', (select nome from membros g where g.registro = m.gestor_registro),
    'termo', public.labbio_termo_de(m.registro), 'acesso', public.labbio_acesso_de(m.registro)) $$;

-- quem o painel enxerga: membros ativos, e quem ainda tem acesso a retirar
create or replace function public.labbio_visivel(p_reg integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where registro = p_reg and status in ('Ativo', 'Em pausa / avaliação'))
      or exists (select 1 from labbio_revogacoes where registro = p_reg and confirmada_em is null) $$;

-- 3. as consultas --------------------------------------------------------------
create or replace function public.labbio_inicio()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_labbio() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok',
      'membros', (select count(*) from membros where status in ('Ativo', 'Em pausa / avaliação')),
      'com_acesso', (select count(*) from acessos_concedidos a join membros m on m.registro = a.registro
                      where a.item_id = public.labbio_item_biometria() and a.ativo and m.status in ('Ativo', 'Em pausa / avaliação')),
      'pedidos_abertos', (select count(*) from labbio_pedidos where etapa = 'labbio'),
      'revogacoes', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'registro', r.registro, 'nome', m.nome,
          'status_para', r.status_para, 'criada_em', r.criada_em) order by r.criada_em)
        from labbio_revogacoes r join membros m on m.registro = r.registro where r.confirmada_em is null), '[]')) end $$;

create or replace function public.labbio_membros(p_busca text default null)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_labbio() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'membros', coalesce((select jsonb_agg(public.labbio_pessoa_json(m) order by m.nome)
      from membros m where public.labbio_visivel(m.registro)
       and (p_busca is null or btrim(p_busca) = '' or m.nome ilike '%' || btrim(p_busca) || '%'
            or m.registro::text = btrim(p_busca))), '[]')) end $$;

create or replace function public.labbio_membro(p_registro integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare m membros;
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not labbio_visivel(p_registro) then return jsonb_build_object('status', 'nao_encontrado'); end if;
  select * into m from membros where registro = p_registro;
  return jsonb_build_object('status', 'ok', 'membro', labbio_pessoa_json(m),
    'liderados', coalesce((select jsonb_agg(jsonb_build_object('registro', x.registro, 'nome', x.nome) order by x.nome)
      from membros x where x.gestor_registro = p_registro and x.status in ('Ativo', 'Em pausa / avaliação')), '[]'),
    'pedidos', coalesce((select jsonb_agg(labbio_pedido_json(p) order by p.criado_em desc)
      from labbio_pedidos p where p.registro = p_registro and p.encaminhado_em is not null), '[]'),
    'revogacoes', coalesce((select jsonb_agg(to_jsonb(r) order by r.criada_em desc) from labbio_revogacoes r where r.registro = p_registro), '[]'));
end $$;

create or replace function public.labbio_checkins(p_de date, p_ate date, p_registro integer default null,
                                                  p_origem text default null, p_pagina integer default 1)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_por integer := 50; v_pag integer := greatest(coalesce(p_pagina, 1), 1);
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_de is null or p_ate is null or p_ate < p_de or p_ate - p_de > 366 then return jsonb_build_object('status', 'invalido'); end if;
  return jsonb_build_object('status', 'ok', 'pagina', v_pag, 'por_pagina', v_por,
    'total', (select count(*) from presencas p
               where (p.registrado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
                 and (p_registro is null or p.registro = p_registro)
                 and (p_origem is null or coalesce(p.origem, 'quiosque') = p_origem)),
    'itens', coalesce((select jsonb_agg(x) from (
       select jsonb_build_object('registro', p.registro, 'nome', m.nome, 'registrado_em', p.registrado_em,
                                 'origem', coalesce(p.origem, 'quiosque')) x
         from presencas p join membros m on m.registro = p.registro
        where (p.registrado_em at time zone 'America/Sao_Paulo')::date between p_de and p_ate
          and (p_registro is null or p.registro = p_registro)
          and (p_origem is null or coalesce(p.origem, 'quiosque') = p_origem)
        order by p.registrado_em desc limit v_por offset (v_pag - 1) * v_por) y), '[]'));
end $$;

-- a matriz: só situação, conclusão e validade (nunca conteúdo ou gabarito)
create or replace function public.labbio_treinamentos()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_labbio() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok',
      'treinamentos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'codigo', t.codigo, 'titulo', t.titulo,
          'categoria', t.categoria, 'revisao', t.revisao_atual, 'validade_meses', t.validade_meses) order by t.codigo)
        from treinamentos t where t.status = 'publicado'), '[]'),
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('registro', m.registro, 'nome', m.nome, 'area', m.departamento,
          'celulas', (select coalesce(jsonb_object_agg(t.id, jsonb_build_object(
               'situacao', public.treinamento_situacao(t.id, m.registro),
               'obrigatorio', public.treinamento_obrigatorio_para(t.id, m.registro),
               'concluido_em', c.concluido_em, 'revisao', c.revisao,
               'vence_em', case when t.validade_meses is not null and c.concluido_em is not null
                                then c.concluido_em + make_interval(months => t.validade_meses) end)), '{}')
             from treinamentos t left join lateral (select * from public.treinamento_conclusao_valida(t.id, m.registro)) c on true
            where t.status = 'publicado')) order by m.nome)
        from membros m where m.status in ('Ativo', 'Em pausa / avaliação')), '[]')) end $$;

create or replace function public.labbio_revogacoes(p_abertas boolean default true)
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_labbio() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'revogacoes', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'registro', r.registro, 'nome', m.nome, 'status_de', r.status_de, 'status_para', r.status_para,
        'criada_em', r.criada_em, 'confirmada_em', r.confirmada_em, 'observacao', r.observacao,
        'confirmada_por', (select nome from labbio_gestores g where g.id = r.confirmada_por)) order by r.criada_em desc)
      from labbio_revogacoes r join membros m on m.registro = r.registro
     where not coalesce(p_abertas, true) or r.confirmada_em is null), '[]')) end $$;

create or replace function public.labbio_revogacao_confirmar(p_id uuid, p_observacao text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r labbio_revogacoes; g labbio_gestores;
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  select * into r from labbio_revogacoes where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if r.confirmada_em is not null then return jsonb_build_object('status', 'ok'); end if;
  update labbio_revogacoes set confirmada_em = now(), confirmada_por = g.id, observacao = nullif(btrim(coalesce(p_observacao, '')), '')
   where id = p_id;
  update acessos_concedidos set ativo = false, revogado_em = current_date, responsavel = 'LABBIO: ' || g.nome
   where registro = r.registro and item_id = labbio_item_biometria() and ativo;
  perform labbio_auditar('revogacao_confirmada', g.id, jsonb_build_object('registro', r.registro));
  return jsonb_build_object('status', 'ok');
end $$;

-- 4. o termo assinado: o gestor lê o arquivo (pela URL assinada do Storage)
drop policy if exists termos_ler_labbio on storage.objects;
create policy termos_ler_labbio on storage.objects for select to authenticated
  using (bucket_id = 'termos' and public.conta_labbio());

-- 5. permissões ----------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['labbio_acesso_de(integer)', 'labbio_termo_de(integer)', 'labbio_pessoa_json(membros)',
                           'labbio_visivel(integer)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['labbio_inicio()', 'labbio_membros(text)', 'labbio_membro(integer)',
                           'labbio_checkins(date,date,integer,text,integer)', 'labbio_treinamentos()',
                           'labbio_revogacoes(boolean)', 'labbio_revogacao_confirmar(uuid,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_labbio_dados',
 'SOMA 2.19.1: as consultas do painel do LABBIO (membros, termo, acesso, check-ins, treinamentos) e a revogação física pendente sem notificação')
on conflict(id) do nothing;
