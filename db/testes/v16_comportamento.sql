\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

set teste.registro = '31'; set teste.papel = 'pessoal';

-- 1. o grupo do Pessoal foi adotado, não duplicado
do $$ declare n integer; nm text; res boolean; begin
  select count(*) into n from grupos where chave='pessoal';
  select nome, reservado into nm, res from grupos where chave='pessoal';
  perform ok(n=1, 'existe exatamente um grupo com chave pessoal');
  perform ok(nm='Depto de Pessoal', 'adotou o grupo que já existia no quadro ('||nm||')');
  perform ok(res, 'o quadro do Pessoal é reservado');
end $$;

-- 2. solicitação vira exatamente um cartão
do $$ declare v_sol uuid; n integer; c text; begin
  -- quem abre é a Carla; o Pessoal é quem recebe (notificar nunca
  -- avisa quem agiu, então o autor da ação importa no teste)
  set local teste.registro = '17'; set local teste.papel = 'leitura';
  insert into portal_solicitacoes(protocolo,registro,tipo,titulo,dados)
  values ('SOL26-0001',17,'acesso','Acesso ao Laboratório 2',
          jsonb_build_object('item','Laboratório 2','justificativa','Montagem da bancada'))
  returning id into v_sol;
  select count(*) into n from atividades where origem_tipo='solicitacao' and origem_id=v_sol::text;
  perform ok(n=1, 'a solicitação gerou 1 cartão');
  -- chamar de novo não cria outro
  perform atividade_de_origem('solicitacao', v_sol::text, 'dup', null, 'media', false);
  select count(*) into n from atividades where origem_tipo='solicitacao' and origem_id=v_sol::text;
  perform ok(n=1, 'chamar de novo não criou um segundo cartão');
  select codigo into c from atividades
   where origem_tipo='solicitacao' and origem_id=v_sol::text and grupo_id=grupo_pessoal();
  perform ok(c is not null, 'o cartão nasceu no quadro do Pessoal ('||c||')');
  select count(*) into n from notificacoes
   where tipo='pessoal_solicitacao' and registro=31;
  perform ok(n=1, 'o Pessoal foi notificado da solicitação');
  perform ok(not exists(select 1 from notificacoes where tipo='pessoal_solicitacao' and registro=17),
             'quem abriu não recebeu aviso de si mesma');
end $$;

-- 3. ocorrência espelho não vira cartão; a que pede decisão, sim
do $$ declare n1 integer; n2 integer; begin
  insert into ocorrencias(registro,tipo,descricao) values (11,'Mudança de cargo','De X para Y.');
  select count(*) into n1 from atividades where origem_tipo='ocorrencia';
  perform ok(n1=0, 'ocorrência de espelho (Mudança de cargo) não gerou cartão');
  insert into ocorrencias(registro,tipo,descricao) values (11,'Desligamento','Pediu desligamento.');
  select count(*) into n2 from atividades where origem_tipo='ocorrencia';
  perform ok(n2=1, 'ocorrência de Desligamento gerou cartão');
  perform ok((select prioridade from atividades where origem_tipo='ocorrencia')='alta',
             'o cartão de desligamento nasceu com prioridade alta');
end $$;

-- 4. apontamento vira um cartão; item sinalizado marca o cartão
do $$ declare v_ap uuid; n integer; r record; begin
  insert into apontamentos(grupo,responsavel) values ('Órtese','Ana Figueiredo') returning id into v_ap;
  select count(*) into n from atividades where origem_tipo='apontamento';
  perform ok(n=1, 'o apontamento gerou 1 cartão');
  insert into apontamento_itens(apontamento_id,registro,assiduidade,sinalizado,justificativa)
  values (v_ap,17,'SUFICIENTE',false,null);
  perform ok(not (select sinalizada from atividades where origem_tipo='apontamento'),
             'item sem sinalização não marcou o cartão');
  insert into apontamento_itens(apontamento_id,registro,assiduidade,sinalizado,justificativa)
  values (v_ap,11,'INSUFICIENTE',true,'Faltou três semanas');
  select sinalizada, prioridade, sinalizada_motivo into r from atividades where origem_tipo='apontamento';
  perform ok(r.sinalizada, 'item sinalizado marcou o cartão');
  perform ok(r.prioridade='alta', 'e subiu a prioridade');
  select count(*) into n from atividades where origem_tipo='apontamento';
  perform ok(n=1, 'continua sendo exatamente um cartão para o apontamento');
end $$;

-- 5. a decisão: aprova, concede e fecha — numa transação só
do $$ declare v_sol uuid; v_item uuid; res jsonb; r record; begin
  select id into v_sol from portal_solicitacoes where protocolo='SOL26-0001';
  select id into v_item from itens_de_acesso where nome='Laboratório 2';
  res := pessoal_solicitacao_decidir(jsonb_build_object(
    'solicitacao_id', v_sol, 'decisao','aprovada',
    'resposta','Liberado até o fim do semestre.',
    'conceder', jsonb_build_array(v_item)));
  perform ok(res->>'status'='ok', 'a decisão foi aceita');
  perform ok((res->>'concedidos')::int=1, 'concedeu 1 acesso');

  select * into r from acessos_concedidos where registro=17 and item_id=v_item;
  perform ok(r.ativo, 'o acesso ficou ativo no quadro de acessos');
  perform ok(r.responsavel='Elis Ramalho', 'com o nome de quem decidiu');

  perform ok((select status from portal_solicitacoes where id=v_sol)='aprovada',
             'a solicitação ficou aprovada');
  perform ok((select status from atividades where origem_id=v_sol::text)='concluida',
             'o cartão foi concluído');
  perform ok(exists(select 1 from notificacoes where registro=17 and tipo='solicitacao_respondida'),
             'quem pediu foi notificado');
  perform ok(exists(select 1 from atividade_log l join atividades a on a.id=l.atividade_id
                     where a.origem_id=v_sol::text and l.tipo='concedeu'),
             'a concessão ficou no histórico do cartão');
end $$;

-- 6. recusar sem resposta é recusado
do $$ declare v_sol uuid; res jsonb; begin
  insert into portal_solicitacoes(protocolo,registro,tipo,titulo)
  values ('SOL26-0002',23,'afastamento','Afastamento em julho') returning id into v_sol;
  res := pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id',v_sol,'decisao','recusada'));
  perform ok(res->>'status'='invalido', 'recusar sem escrever o porquê é bloqueado');
  perform ok((select status from portal_solicitacoes where id=v_sol)='aberta',
             'e nada foi gravado');
end $$;

-- 7. quem não é do Pessoal não decide
do $$ declare v_sol uuid; res jsonb; begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  select id into v_sol from portal_solicitacoes where protocolo='SOL26-0002';
  res := pessoal_solicitacao_decidir(jsonb_build_object('solicitacao_id',v_sol,'decisao','aprovada'));
  perform ok(res->>'status'='sem_permissao', 'leitura não decide solicitação');
end $$;

-- 8. o lote de e-mail
do $$ declare lote jsonb; ids bigint[]; n integer; begin
  select coalesce(jsonb_agg(l), '[]') into lote
    from jsonb_array_elements(notificacoes_email_lote(200)) l;
  perform ok(jsonb_array_length(lote)>0, 'o lote de e-mail tem destinatários');
  perform ok(exists(select 1 from jsonb_array_elements(lote) x where x->>'email' is not null),
             'todo destinatário tem endereço');
  -- ninguém entra duas vezes
  select count(*) into n from (select distinct x->>'registro' r from jsonb_array_elements(lote) x) q;
  perform ok(n=jsonb_array_length(lote), 'um bloco por pessoa, nunca dois');

  select array_agg((i->>'id')::bigint) into ids
    from jsonb_array_elements(lote) x, jsonb_array_elements(x->'itens') i;
  perform notificacoes_email_baixa(jsonb_build_object('enviadas', to_jsonb(ids)));
  perform ok(jsonb_array_length(notificacoes_email_lote(200))=0,
             'depois da baixa o lote fica vazio — não reenvia');
  perform ok(exists(select 1 from notificacao_preferencias where ultimo_email is not null),
             'o relógio do resumo andou');
end $$;

-- 9. "nunca" não recebe
do $$ declare lote jsonb; begin
  insert into notificacao_preferencias(registro,email_modo) values (17,'nunca')
    on conflict (registro) do update set email_modo='nunca';
  perform notificar(array[17], 'teste', 'Título', 'Corpo', '#/x');
  select notificacoes_email_lote(200) into lote;
  perform ok(not exists(select 1 from jsonb_array_elements(lote) x where (x->>'registro')::int=17),
             'quem escolheu "nunca" fica fora do lote');
end $$;
