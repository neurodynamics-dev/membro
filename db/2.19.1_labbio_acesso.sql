-- ============================================================
-- SOMA 2.19.1: pedido de acesso biométrico ao LABBIO
--
-- O pedido de acesso de sempre (Serviços › Solicitação de acesso), com um
-- subtipo próprio para a biometria do LABBIO, identificado pela chave do
-- catálogo (itens_de_acesso.chave = 'labbio_biometria'), nunca pelo nome:
--
--   rascunho → Pessoal → LABBIO → concedido
--   saídas: devolvido (para corrigir), negado pelo Pessoal, negado pelo
--   LABBIO, cancelado pelo membro.
--
-- - O membro escreve a justificativa e o tempo, confere os dados (os da
--   última confirmação de Meus dados, até 180 dias) e tira a foto (bucket
--   privado biometria, separado do avatar). Ao enviar, o pedido fotografa
--   os campos que o LABBIO pede (labbio_config.campos) e abre a
--   solicitação de sempre: o card no quadro do Pessoal nasce como antes.
-- - O Pessoal decide pelo mesmo botão da triagem: "aprovar" ENCAMINHA ao
--   LABBIO (não concede nada) e manda um e-mail ao responsável principal.
-- - O gestor do LABBIO consulta, copia os dados, baixa a foto, cadastra na
--   Intelbras à mão e confirma a implantação: só aí o acesso é concedido.
--   Pode negar ou devolver, sempre com motivo.
-- - Cada correção é uma versão nova; decisão só vale para a versão atual.
--   Volta para quem devolveu.
-- Os outros tipos de solicitação continuam iguais.
--
-- Depende da 2.19.1_labbio_base e da 2.19.1_recadastro. Só acrescenta;
-- pode rodar de novo.
-- ============================================================

-- 1. o item do catálogo, pela chave ----------------------------------------------
alter table public.itens_de_acesso add column if not exists chave text;
create unique index if not exists itens_de_acesso_chave on public.itens_de_acesso (chave) where chave is not null;
insert into public.itens_de_acesso (nome, categoria, chave)
select 'Acesso biométrico ao LABBIO', 'local', 'labbio_biometria'
 where not exists (select 1 from public.itens_de_acesso where chave = 'labbio_biometria');

create or replace function public.labbio_item_biometria()
returns uuid language sql stable security definer set search_path = public as $$
  select id from itens_de_acesso where chave = 'labbio_biometria' $$;

-- 2. o que o LABBIO pede (a Intelbras): campos do cadastro e a foto -------------------
create table if not exists public.labbio_config (
  id               boolean primary key default true check (id),
  campos           text[] not null default '{nome_civil,cpf,matricula}',
  foto_obrigatoria boolean not null default true);
insert into public.labbio_config (id) values (true) on conflict do nothing;

-- 3. o pedido, as versões e a trilha ---------------------------------------------------
create table if not exists public.labbio_pedidos (
  id             uuid primary key default gen_random_uuid(),
  registro       integer not null references membros(registro),
  solicitacao_id uuid unique references portal_solicitacoes(id) on delete set null,
  etapa          text not null default 'rascunho'
                 check (etapa in ('rascunho', 'pessoal', 'labbio', 'concedido', 'devolvido',
                                  'negado_pessoal', 'negado_labbio', 'cancelado')),
  versao         integer not null default 1,
  devolvido_por  text check (devolvido_por in ('pessoal', 'labbio')),
  justificativa  text,
  tempo          text,
  encaminhado_em timestamptz,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now());
-- um pedido aberto por pessoa
create unique index if not exists labbio_pedidos_aberto on public.labbio_pedidos (registro)
  where etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido');

create table if not exists public.labbio_pedido_versoes (
  pedido_id uuid not null references labbio_pedidos(id) on delete cascade,
  versao    integer not null,
  dados     jsonb not null,
  foto_path text,
  enviada_em timestamptz not null default now(),
  primary key (pedido_id, versao));

create table if not exists public.labbio_pedido_eventos (
  id          bigserial primary key,
  pedido_id   uuid not null references labbio_pedidos(id) on delete cascade,
  versao      integer not null,
  de          text,
  para        text not null,
  ator        text not null check (ator in ('membro', 'pessoal', 'labbio')),
  ator_nome   text,
  motivo      text,
  quando      timestamptz not null default clock_timestamp());
create index if not exists labbio_pedido_eventos_p on public.labbio_pedido_eventos (pedido_id, quando);

do $$ declare t text; begin
  foreach t in array array['labbio_config', 'labbio_pedidos', 'labbio_pedido_versoes', 'labbio_pedido_eventos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- 4. a foto: bucket privado, só JPEG ou PNG, até 5 MB ----------------------------------
insert into storage.buckets (id, name, public) values ('biometria', 'biometria', false) on conflict (id) do nothing;
update storage.buckets set public = false, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg', 'image/png']
 where id = 'biometria';

-- caminho: <registro>/<pedido>/<versão>.jpg|png
create or replace function public.biometria_pode(p_nome text, p_gravar boolean default false)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare partes text[] := string_to_array(p_nome, '/'); v_reg integer := public.portal_registro_atual(); p labbio_pedidos;
begin
  if array_length(partes, 1) <> 3 or partes[1] !~ '^[0-9]+$' or partes[2] !~ '^[0-9a-f-]{36}$'
     or partes[3] !~ '^[0-9]+\.(jpg|png)$' then return false; end if;
  select * into p from labbio_pedidos where id = partes[2]::uuid and registro = partes[1]::integer;
  if not found then return false; end if;
  if p_gravar then
    -- o membro grava a foto da versão que está editando
    return coalesce(v_reg = p.registro and p.etapa in ('rascunho', 'devolvido') and split_part(partes[3], '.', 1)::integer = p.versao, false);
  end if;
  return coalesce(v_reg = p.registro, false)
      or (public.conta_ativa() and public.papel_atual() in ('admin', 'pessoal'))
      or (public.conta_labbio() and p.encaminhado_em is not null);
end $$;
drop policy if exists biometria_ler on storage.objects;
create policy biometria_ler on storage.objects for select to authenticated
  using (bucket_id = 'biometria' and public.biometria_pode(name));
drop policy if exists biometria_inserir on storage.objects;
create policy biometria_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'biometria' and public.biometria_pode(name, true));

-- 5. as peças internas -------------------------------------------------------------
create or replace function public.labbio_pedido_evento(p labbio_pedidos, p_de text, p_para text, p_ator text, p_nome text, p_motivo text)
returns void language sql volatile security definer set search_path = public as $$
  insert into labbio_pedido_eventos (pedido_id, versao, de, para, ator, ator_nome, motivo)
  values (p.id, p.versao, p_de, p_para, p_ator, p_nome, nullif(btrim(coalesce(p_motivo, '')), '')) $$;

-- o pedido para a tela (do membro, do Pessoal ou do LABBIO): a versão atual e a trilha
create or replace function public.labbio_pedido_json(p labbio_pedidos)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'registro', p.registro, 'nome', m.nome, 'etapa', p.etapa, 'versao', p.versao,
    'devolvido_por', p.devolvido_por, 'justificativa', p.justificativa, 'tempo', p.tempo,
    'encaminhado_em', p.encaminhado_em, 'criado_em', p.criado_em, 'atualizado_em', p.atualizado_em,
    'protocolo', s.protocolo,
    'enviada', (select jsonb_build_object('versao', v.versao, 'dados', v.dados, 'foto_path', v.foto_path, 'enviada_em', v.enviada_em)
                  from labbio_pedido_versoes v where v.pedido_id = p.id order by v.versao desc limit 1),
    'eventos', coalesce((select jsonb_agg(jsonb_build_object('versao', e.versao, 'de', e.de, 'para', e.para, 'ator', e.ator,
                  'ator_nome', e.ator_nome, 'motivo', e.motivo, 'quando', e.quando) order by e.quando, e.id)
                  from labbio_pedido_eventos e where e.pedido_id = p.id), '[]'))
    from membros m left join portal_solicitacoes s on s.id = p.solicitacao_id where m.registro = p.registro $$;

-- os campos que o LABBIO pede, da última confirmação de Meus dados (até 180 dias)
create or replace function public.labbio_dados_do_membro(p_reg integer)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare u cadastro_confirmacoes; c labbio_config; v jsonb := '{}'; k text;
begin
  u := public.cadastro_ultima(p_reg);
  if u.id is null or u.confirmado_em < now() - interval '180 days' then return null; end if;
  select * into c from labbio_config where id;
  foreach k in array c.campos loop v := v || jsonb_build_object(k, u.dados->k); end loop;
  return v || jsonb_build_object('nome', (select nome from membros where registro = p_reg), 'confirmado_em', u.confirmado_em);
end $$;

-- a solicitação de sempre acompanha a etapa (é o que "Meus pedidos" mostra)
create or replace function public.labbio_pedido_sol(p labbio_pedidos, p_status text, p_resposta text)
returns void language sql volatile security definer set search_path = public as $$
  update portal_solicitacoes set status = p_status, resposta = coalesce(p_resposta, resposta), respondido_em = now()
   where id = p.solicitacao_id $$;

-- 6. o membro ----------------------------------------------------------------------
create or replace function public.labbio_pedido_meu()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); p labbio_pedidos;
begin
  if v_reg is null or not conta_ativa() then return jsonb_build_object('status', 'sem_registro'); end if;
  select * into p from labbio_pedidos where registro = v_reg order by criado_em desc limit 1;
  return jsonb_build_object('status', 'ok',
    'tem_acesso', exists (select 1 from acessos_concedidos where registro = v_reg and item_id = labbio_item_biometria() and ativo),
    'dados', labbio_dados_do_membro(v_reg),
    'campos', (select to_jsonb(campos) from labbio_config where id),
    'pedido', case when p.id is null then null else labbio_pedido_json(p) end);
end $$;

create or replace function public.labbio_pedido_criar(p_justificativa text, p_tempo text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); p labbio_pedidos;
begin
  if v_reg is null or not conta_ativa() then return jsonb_build_object('status', 'sem_registro'); end if;
  if labbio_item_biometria() is null then return jsonb_build_object('status', 'sem_catalogo'); end if;
  if exists (select 1 from acessos_concedidos where registro = v_reg and item_id = labbio_item_biometria() and ativo)
    then return jsonb_build_object('status', 'ja_tem_acesso'); end if;
  select * into p from labbio_pedidos where registro = v_reg and etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido');
  if found then return jsonb_build_object('status', 'ja_existe', 'pedido', labbio_pedido_json(p)); end if;
  if length(btrim(coalesce(p_justificativa, ''))) < 10 then return jsonb_build_object('status', 'invalido', 'campo', 'justificativa'); end if;
  if length(btrim(coalesce(p_tempo, ''))) = 0 then return jsonb_build_object('status', 'invalido', 'campo', 'tempo'); end if;
  insert into labbio_pedidos (registro, justificativa, tempo) values (v_reg, btrim(p_justificativa), btrim(p_tempo)) returning * into p;
  return jsonb_build_object('status', 'ok', 'pedido', labbio_pedido_json(p));
end $$;

-- enviar (a primeira vez ou depois de devolvido): fotografa os dados e a foto da versão
create or replace function public.labbio_pedido_enviar(p_id uuid, p_versao integer, p_foto_path text,
                                                       p_justificativa text default null, p_tempo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); p labbio_pedidos; v_dados jsonb; v_cfg labbio_config; v_para text; v_sol uuid;
  v_item uuid := labbio_item_biometria();
begin
  if v_reg is null or not conta_ativa() then return jsonb_build_object('status', 'sem_registro'); end if;
  select * into p from labbio_pedidos where id = p_id and registro = v_reg for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if p.etapa not in ('rascunho', 'devolvido') then return jsonb_build_object('status', 'encerrado'); end if;
  if p_versao is distinct from p.versao then return jsonb_build_object('status', 'conflito'); end if;
  if p_justificativa is not null then
    if length(btrim(p_justificativa)) < 10 then return jsonb_build_object('status', 'invalido', 'campo', 'justificativa'); end if;
    p.justificativa := btrim(p_justificativa);
  end if;
  if p_tempo is not null and length(btrim(p_tempo)) > 0 then p.tempo := btrim(p_tempo); end if;
  v_dados := labbio_dados_do_membro(v_reg);
  if v_dados is null then return jsonb_build_object('status', 'dados_pendentes'); end if;
  select * into v_cfg from labbio_config where id;
  if v_cfg.foto_obrigatoria and (p_foto_path is null
       or p_foto_path !~ ('^' || v_reg || '/' || p.id || '/' || p.versao || '\.(jpg|png)$')
       or not exists (select 1 from storage.objects where bucket_id = 'biometria' and name = p_foto_path))
    then return jsonb_build_object('status', 'foto_pendente'); end if;
  insert into labbio_pedido_versoes (pedido_id, versao, dados, foto_path) values (p.id, p.versao, v_dados, p_foto_path)
  on conflict (pedido_id, versao) do update set dados = excluded.dados, foto_path = excluded.foto_path, enviada_em = now();
  -- volta para quem devolveu; da primeira vez, para o Pessoal
  v_para := case when p.etapa = 'devolvido' and p.devolvido_por = 'labbio' then 'labbio' else 'pessoal' end;
  if p.solicitacao_id is null then
    insert into portal_solicitacoes (registro, tipo, titulo, dados)
    values (v_reg, 'acesso', 'Acesso biométrico ao LABBIO',
            jsonb_build_object('item', 'Acesso biométrico ao LABBIO', 'item_id', v_item, 'categoria', 'local',
                               'justificativa', p.justificativa, 'tempo_necessario', p.tempo, 'labbio_pedido_id', p.id))
    returning id into v_sol;
    p.solicitacao_id := v_sol;
  else
    update portal_solicitacoes set status = case when v_para = 'labbio' then 'em_analise' else 'aberta' end,
           dados = dados || jsonb_build_object('justificativa', p.justificativa, 'tempo_necessario', p.tempo)
     where id = p.solicitacao_id;
  end if;
  perform labbio_pedido_evento(p, p.etapa, v_para, 'membro', (select nome from membros where registro = v_reg),
                               case when p.etapa = 'devolvido' then 'Corrigido e enviado de novo' end);
  update labbio_pedidos set etapa = v_para, justificativa = p.justificativa, tempo = p.tempo, solicitacao_id = p.solicitacao_id,
         atualizado_em = now() where id = p.id returning * into p;
  if v_para = 'labbio' then perform labbio_pedido_avisar_principal(p); end if;
  return jsonb_build_object('status', 'ok', 'pedido', labbio_pedido_json(p));
end $$;

create or replace function public.labbio_pedido_cancelar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); p labbio_pedidos;
begin
  select * into p from labbio_pedidos where id = p_id and registro = v_reg for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if p.etapa not in ('rascunho', 'pessoal', 'labbio', 'devolvido') then return jsonb_build_object('status', 'encerrado'); end if;
  perform labbio_pedido_evento(p, p.etapa, 'cancelado', 'membro', (select nome from membros where registro = v_reg), null);
  update labbio_pedidos set etapa = 'cancelado', atualizado_em = now() where id = p.id returning * into p;
  perform labbio_pedido_sol(p, 'cancelada', 'Cancelado por quem pediu.');
  return jsonb_build_object('status', 'ok');
end $$;

-- 7. o aviso ao responsável principal (um e-mail por encaminhamento) ---------------------
create or replace function public.labbio_pedido_avisar_principal(p labbio_pedidos)
returns void language sql volatile security definer set search_path = public as $$
  insert into labbio_envios (tipo, para_email, para_nome, assunto, dados)
  select 'pedido', g.email, g.nome, 'Novo pedido de acesso biométrico: ' || m.nome,
         jsonb_build_object('caminho', '/labbio/#/solicitacoes/' || p.id, 'membro', m.nome, 'versao', p.versao)
    from labbio_gestores g, membros m
   where g.principal and g.situacao = 'ativo' and m.registro = p.registro $$;

-- 8. o Pessoal: encaminhar, negar ou devolver ---------------------------------------------
create or replace function public.labbio_pedido_pessoal(p_id uuid, p_versao integer, p_acao text, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p labbio_pedidos; v_quem text;
begin
  if not (conta_ativa() and papel_atual() in ('admin', 'pessoal')) then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into p from labbio_pedidos where id = p_id for update;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
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

-- o Pessoal (e o admin) leem o pedido inteiro, com a foto
create or replace function public.labbio_pedido_ler(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p labbio_pedidos;
begin
  select * into p from labbio_pedidos where id = p_id;
  if not found then return jsonb_build_object('status', 'nao_encontrado'); end if;
  if not ((conta_ativa() and (papel_atual() in ('admin', 'pessoal') or p.registro = portal_registro_atual()))
          or (conta_labbio() and p.encaminhado_em is not null)) then
    return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'pedido', labbio_pedido_json(p));
end $$;

-- 9. o LABBIO: a fila e a decisão -------------------------------------------------------
create or replace function public.labbio_solicitacoes(p_situacao text default 'abertos')
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not public.conta_labbio() then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'pedidos', coalesce((select jsonb_agg(public.labbio_pedido_json(p)
           order by (p.etapa = 'labbio') desc, p.encaminhado_em desc)
      from labbio_pedidos p
     where p.encaminhado_em is not null
       and (p_situacao = 'todos' or (p_situacao = 'abertos' and p.etapa = 'labbio')
            or (p_situacao = 'encerrados' and p.etapa <> 'labbio'))), '[]')) end $$;

create or replace function public.labbio_pedido_decidir(p_id uuid, p_versao integer, p_acao text, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p labbio_pedidos; g labbio_gestores; v_item uuid := labbio_item_biometria();
begin
  if not conta_labbio() then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into g from labbio_gestores where user_id = auth.uid();
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

-- 10. a triagem do Pessoal de sempre, para o pedido do LABBIO --------------------------
create or replace function public.labbio_pedido_pela_triagem(p_sol uuid, p_decisao text, p_resposta text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare p labbio_pedidos; r jsonb;
begin
  select * into p from labbio_pedidos where solicitacao_id = p_sol;
  if p_decisao = 'em_analise' then
    update portal_solicitacoes set status = 'em_analise', resposta = coalesce(p_resposta, resposta), respondido_em = now() where id = p_sol;
    return jsonb_build_object('status', 'ok', 'decisao', 'em_analise', 'concedidos', 0);
  end if;
  r := labbio_pedido_pessoal(p.id, p.versao,
         case when p_decisao in ('aprovada', 'concluida') then 'encaminhar' else 'negar' end,
         coalesce(p_resposta, case when p_decisao = 'cancelada' then 'Cancelado pelo Depto. de Pessoal.' end));
  if r->>'status' <> 'ok' then return r; end if;
  return jsonb_build_object('status', 'ok', 'decisao', case when p_decisao in ('aprovada', 'concluida') then 'encaminhada' else 'recusada' end,
                            'concedidos', 0, 'labbio', true);
end $$;

-- a decisão de sempre (v16), com o desvio do LABBIO logo depois de achar a solicitação
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

  -- 2.19.1: o pedido de biometria do LABBIO segue o fluxo dele (aprovar
  -- encaminha ao LABBIO; não concede nada aqui)
  if exists (select 1 from labbio_pedidos where solicitacao_id = v_sol.id) then
    return public.labbio_pedido_pela_triagem(v_sol.id, v_dec, v_resp);
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

revoke execute on function public.pessoal_solicitacao_decidir(jsonb) from public, anon;
grant  execute on function public.pessoal_solicitacao_decidir(jsonb) to authenticated;

-- 11. permissões ----------------------------------------------------------------------
do $$ declare f text; begin
  foreach f in array array['labbio_item_biometria()', 'labbio_pedido_evento(labbio_pedidos,text,text,text,text,text)',
                           'labbio_pedido_json(labbio_pedidos)', 'labbio_dados_do_membro(integer)',
                           'labbio_pedido_sol(labbio_pedidos,text,text)', 'labbio_pedido_avisar_principal(labbio_pedidos)',
                           'labbio_pedido_pela_triagem(uuid,text,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['biometria_pode(text,boolean)', 'labbio_pedido_meu()', 'labbio_pedido_criar(text,text)',
                           'labbio_pedido_enviar(uuid,integer,text,text,text)', 'labbio_pedido_cancelar(uuid)',
                           'labbio_pedido_pessoal(uuid,integer,text,text)', 'labbio_pedido_ler(uuid)',
                           'labbio_solicitacoes(text)', 'labbio_pedido_decidir(uuid,integer,text,text)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_labbio_acesso',
 'SOMA 2.19.1: pedido de acesso biométrico ao LABBIO (rascunho, Pessoal, LABBIO, concedido), foto privada, versões e trilha; o Pessoal encaminha, o LABBIO confirma a implantação')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, nome, chave from public.itens_de_acesso where chave = 'labbio_biometria';
-- select campos, foto_obrigatoria from public.labbio_config;
-- Se o catálogo já tinha um item para a biometria do LABBIO, ponha a chave nele e apague o criado aqui:
--   update public.itens_de_acesso set chave = 'labbio_biometria' where id = '<id do item antigo>';  (depois de tirar a chave do novo)
