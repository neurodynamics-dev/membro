-- ============================================================
-- SOMA 2.19.1: o admin do SOMA entra no painel do LABBIO
--
-- O admin usa a própria conta de membro em /labbio/ e vê e faz o que um
-- gestor ativo faz. Ele NÃO vira conta externa (não entra em
-- labbio_gestores), então o SOMA continua aberto para ele e a porta da
-- API (api_pre_request) não muda.
--
-- - conta_labbio(): gestor ativo ou admin do SOMA (conta ativa);
-- - labbio_eu(): para o admin, status 'admin' com o nome dele (o portal
--   só desvia para /labbio/ quem recebe 'ok', 'convidado' ou 'revogado');
-- - labbio_ator_nome(): o nome de quem age; nas decisões do admin fica
--   "Nome (admin do SOMA)" no histórico do pedido, na revogação e no
--   acesso concedido.
--
-- Depois de 2.19.1_labbio_base, _acesso, _dados e _salas (as mesmas
-- funções já estão nelas para quem instala do zero). Pode rodar de novo.
-- ============================================================

-- quem pode usar o painel: o gestor ativo e o admin do SOMA (que entra com a conta de membro;
-- não vira conta externa, porque não está em labbio_gestores)
create or replace function public.conta_labbio()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (exists (select 1 from labbio_gestores where user_id = auth.uid() and situacao = 'ativo')
    or (public.conta_ativa() and public.papel_atual() = 'admin')) $$;

-- o nome de quem age no painel: o gestor, ou o admin do SOMA que entrou nele
create or replace function public.labbio_ator_nome()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select nome from labbio_gestores where user_id = auth.uid() and situacao = 'ativo'),
    (select coalesce(m.nome, p.nome) from perfis p left join membros m on m.registro = p.registro where p.id = auth.uid()) || ' (admin do SOMA)') $$;

-- quem sou eu no painel (e a marca do último acesso, no máximo a cada 5 min)
create or replace function public.labbio_eu()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare g labbio_gestores;
begin
  select * into g from labbio_gestores where user_id = auth.uid();
  -- o admin do SOMA entra no painel com status próprio: o portal só desvia 'ok', 'convidado' e 'revogado'
  if not found and labbio_admin() then
    return jsonb_build_object('status', 'admin', 'gestor', jsonb_build_object('id', null, 'nome', labbio_ator_nome(),
      'email', labbio_email_da_conta(), 'situacao', 'ativo', 'principal', false, 'admin', true));
  end if;
  if not found then return jsonb_build_object('status', case when auth.uid() is null then 'sem_sessao' else 'nao_gestor' end); end if;
  if g.situacao <> 'ativo' then return jsonb_build_object('status', g.situacao); end if;
  if g.ultimo_acesso is null or g.ultimo_acesso < now() - interval '5 minutes' then
    update labbio_gestores set ultimo_acesso = now() where id = g.id;
  end if;
  return jsonb_build_object('status', 'ok', 'gestor', labbio_gestor_json(g));
end $$;

create or replace function public.labbio_pedido_decidir(p_id uuid, p_versao integer, p_acao text, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p labbio_pedidos; g labbio_gestores; v_item uuid := labbio_item_biometria();
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  g.nome := coalesce(g.nome, labbio_ator_nome());  -- o admin do SOMA não tem linha de gestor
  select * into p from labbio_pedidos where id = p_id for update;
  if not found or p.encaminhado_em is null then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if p.etapa <> 'labbio' then return jsonb_build_object('status', 'encerrado'); end if;
  if p_versao is distinct from p.versao then return jsonb_build_object('status', 'conflito'); end if;
  if p_acao not in ('implantado', 'negar', 'devolver') then return jsonb_build_object('status', 'invalido', 'campo', 'acao'); end if;
  if p_acao <> 'implantado' and length(btrim(coalesce(p_motivo, ''))) = 0 then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  if p_acao = 'implantado' then
    -- só agora o acesso existe: cadastrado à mão na Intelbras e confirmado aqui
    insert into acessos_concedidos (registro, item_id, ativo, concedido_em, revogado_em, responsavel)
    values (p.registro, v_item, true, current_date, null, 'LABBIO: ' || g.nome)
    on conflict (registro, item_id) do update set ativo = true, concedido_em = current_date, revogado_em = null,
      responsavel = excluded.responsavel;
    perform labbio_pedido_evento(p, 'labbio', 'concedido', 'labbio', g.nome, p_motivo);
    update labbio_pedidos set etapa = 'concedido', atualizado_em = now() where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'aprovada', 'Acesso biométrico cadastrado pelo LABBIO.');
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Acesso biométrico ao LABBIO liberado',
      'O LABBIO cadastrou a sua biometria. Confira na primeira entrada.', '#/servicos/biometria');
  elsif p_acao = 'negar' then
    perform labbio_pedido_evento(p, 'labbio', 'negado_labbio', 'labbio', g.nome, p_motivo);
    update labbio_pedidos set etapa = 'negado_labbio', atualizado_em = now() where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'recusada', 'LABBIO: ' || btrim(p_motivo));
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Pedido de acesso ao LABBIO: negado', btrim(p_motivo), '#/servicos/biometria');
  else
    perform labbio_pedido_evento(p, 'labbio', 'devolvido', 'labbio', g.nome, p_motivo);
    update labbio_pedidos set etapa = 'devolvido', devolvido_por = 'labbio', versao = versao + 1, atualizado_em = now()
     where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'em_analise', 'Devolvido pelo LABBIO para correção: ' || btrim(p_motivo));
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Pedido de acesso ao LABBIO: corrigir', btrim(p_motivo), '#/servicos/biometria');
  end if;
  return jsonb_build_object('status', 'ok', 'pedido', labbio_pedido_json(p));
end $$;

create or replace function public.labbio_revogacao_confirmar(p_id uuid, p_observacao text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare r labbio_revogacoes; g labbio_gestores;
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  g.nome := coalesce(g.nome, labbio_ator_nome());  -- o admin do SOMA não tem linha de gestor
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

create or replace function public.labbio_consulta_decidir(p_id uuid, p_disponivel boolean, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare c labbio_consultas; g labbio_gestores; e eventos;
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
  g.nome := coalesce(g.nome, labbio_ator_nome());  -- o admin do SOMA não tem linha de gestor
  select * into c from labbio_consultas where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if c.situacao = 'invalidada' then return jsonb_build_object('status', 'invalidada'); end if;
  if not p_disponivel and length(btrim(coalesce(p_motivo, ''))) = 0 then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  if c.situacao = (case when p_disponivel then 'disponivel' else 'conflito' end) then return jsonb_build_object('status', 'ok'); end if;
  update labbio_consultas set situacao = case when p_disponivel then 'disponivel' else 'conflito' end,
         motivo = case when p_disponivel then nullif(btrim(coalesce(p_motivo, '')), '') else btrim(p_motivo) end,
         decidido_por = g.id, decidido_em = now() where id = p_id;
  if not p_disponivel then
    select * into e from eventos where id = c.evento_id;
    perform notificar(array[e.owner_registro], 'agenda',
      'LABBIO: conflito em ' || coalesce((select nome from espacos where id = c.espaco_id), 'espaço') || ', ' || to_char(c.data, 'DD/MM'),
      e.titulo || ': ' || btrim(p_motivo) || ' O evento continua marcado; ajuste se precisar.', '#/agenda/evento/' || e.id);
  end if;
  perform labbio_auditar('consulta', g.id, jsonb_build_object('consulta', p_id, 'disponivel', p_disponivel));
  return jsonb_build_object('status', 'ok');
end $$;

do $$ begin
  revoke execute on function public.labbio_ator_nome() from public, anon, authenticated;
  revoke execute on function public.conta_labbio() from public, anon;
  grant execute on function public.conta_labbio() to authenticated;
  revoke execute on function public.labbio_eu() from public, anon;
  grant execute on function public.labbio_eu() to authenticated;
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_labbio_admin',
 'SOMA 2.19.1: o admin do SOMA entra no painel do LABBIO com a própria conta, sem virar conta externa')
on conflict(id) do nothing;

-- CONFERIR (logado como admin, pelo app): labbio_eu() devolve status 'admin'; o painel /labbio/ abre.
