-- ============================================================
-- SOMA 2.19.2: decisões de solicitação mais seguras
--
-- 1. Ninguém decide o próprio pedido, a não ser o admin: nem na triagem
--    comum do Pessoal (pessoal_solicitacao_decidir), nem no pedido de
--    biometria do LABBIO (labbio_pedido_pessoal). Volta 'proprio_pedido'.
-- 2. A triagem comum não concede o acesso biométrico ao LABBIO (o item de
--    chave labbio_biometria): ele só nasce pelo pedido próprio, com foto,
--    e quem cadastra é o LABBIO. Volta 'biometria_pelo_labbio'.
--
-- As mesmas funções estão em 2.19.1_labbio_acesso.sql, para quem instala
-- do zero. Depois dela. Pode rodar de novo.
-- ============================================================

create or replace function public.labbio_pedido_pessoal(p_id uuid, p_versao integer, p_acao text, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p labbio_pedidos; v_quem text;
begin
  if not (conta_ativa() and papel_atual() in ('admin', 'pessoal')) then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into p from labbio_pedidos where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  -- 2.19.2: ninguém decide o próprio pedido, a não ser o admin
  if p.registro = portal_registro_atual() and papel_atual() <> 'admin' then return jsonb_build_object('status', 'proprio_pedido'); end if;
  if p.etapa <> 'pessoal' then return jsonb_build_object('status', 'encerrado'); end if;
  if p_versao is distinct from p.versao then return jsonb_build_object('status', 'conflito'); end if;
  if p_acao not in ('encaminhar', 'negar', 'devolver') then return jsonb_build_object('status', 'invalido', 'campo', 'acao'); end if;
  if p_acao <> 'encaminhar' and length(btrim(coalesce(p_motivo, ''))) = 0 then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  v_quem := coalesce((select nome from membros where registro = portal_registro_atual()), 'Depto. de Pessoal');
  if p_acao = 'encaminhar' then
    perform labbio_pedido_evento(p, 'pessoal', 'labbio', 'pessoal', v_quem, p_motivo);
    update labbio_pedidos set etapa = 'labbio', encaminhado_em = coalesce(encaminhado_em, now()), atualizado_em = now()
     where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'em_analise', 'Aprovado pelo Depto. de Pessoal e encaminhado ao LABBIO, que faz o cadastro na biometria.');
    perform labbio_pedido_avisar_principal(p);
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Pedido de acesso ao LABBIO: encaminhado',
      'O Depto. de Pessoal aprovou e encaminhou ao LABBIO. O acesso vale quando o LABBIO confirmar o cadastro.', '#/servicos/biometria');
  elsif p_acao = 'negar' then
    perform labbio_pedido_evento(p, 'pessoal', 'negado_pessoal', 'pessoal', v_quem, p_motivo);
    update labbio_pedidos set etapa = 'negado_pessoal', atualizado_em = now() where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'recusada', btrim(p_motivo));
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Pedido de acesso ao LABBIO: negado', btrim(p_motivo), '#/servicos/biometria');
  else
    perform labbio_pedido_evento(p, 'pessoal', 'devolvido', 'pessoal', v_quem, p_motivo);
    update labbio_pedidos set etapa = 'devolvido', devolvido_por = 'pessoal', versao = versao + 1, atualizado_em = now()
     where id = p.id returning * into p;
    perform labbio_pedido_sol(p, 'em_analise', 'Devolvido para correção: ' || btrim(p_motivo));
    perform notificar(array[p.registro], 'solicitacao_respondida', 'Pedido de acesso ao LABBIO: corrigir', btrim(p_motivo), '#/servicos/biometria');
  end if;
  -- o card do Pessoal fecha quando a parte do Pessoal termina
  update atividades set status = 'concluida', concluida_em = now(), atualizado_em = now()
   where origem_tipo = 'solicitacao' and origem_id = p.solicitacao_id::text and status <> 'concluida' and p_acao <> 'devolver';
  return jsonb_build_object('status', 'ok', 'pedido', labbio_pedido_json(p));
end $$;

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

  -- 2.19.2: ninguém decide o próprio pedido, a não ser o admin (nem quem é do Pessoal)
  if v_sol.registro = v_reg and public.papel_atual() <> 'admin' then
    return jsonb_build_object('status','proprio_pedido');
  end if;

  -- 2.19.1: o pedido de biometria do LABBIO segue o fluxo dele (aprovar
  -- encaminha ao LABBIO; não concede nada aqui)
  if exists (select 1 from labbio_pedidos where solicitacao_id = v_sol.id) then
    return public.labbio_pedido_pela_triagem(v_sol.id, v_dec, v_resp);
  end if;

  -- 2.19.2: o acesso biométrico ao LABBIO só nasce pelo pedido próprio (com foto, cadastrado pelo LABBIO);
  -- a triagem comum não o concede, nem por engano
  if exists (select 1 from itens_de_acesso where id = any(v_conc) and chave = 'labbio_biometria') then
    return jsonb_build_object('status','biometria_pelo_labbio');
  end if;

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

insert into public.migracoes(id, descricao) values('2.19.2_solicitacoes',
 'SOMA 2.19.2: ninguém decide o próprio pedido (salvo o admin); a triagem comum não concede o acesso biométrico ao LABBIO')
on conflict(id) do nothing;

-- CONFERIR: os pedidos de acesso dos últimos dias, com o caminho que tomaram
-- select s.criado_em, s.registro, s.titulo, s.status, s.respondido_por, p.etapa as etapa_labbio, p.encaminhado_em
--   from portal_solicitacoes s left join labbio_pedidos p on p.solicitacao_id = s.id
--  where s.tipo = 'acesso' order by s.criado_em desc limit 10;
