\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_ri: quem entra, contatos, relações, interações, eventos e indicações.
\i 2.19.2_ri.sql
\i 2.19.2_ri.sql

insert into grupos (nome, prefixo, ordem) values ('NRO_RELAC', 'REL', 8), ('NRO_COORD_OFFICE', 'NCO', 7) on conflict (nome) do nothing;
update membros set grupos = array_append(grupos, 'NRO_RELAC') where registro = 41 and not grupos @> array['NRO_RELAC'];
update membros set grupos = array_append(grupos, 'NRO_COORD_OFFICE') where registro = 42 and not grupos @> array['NRO_COORD_OFFICE'];

do $$
declare r jsonb; v_org bigint; v_p1 bigint; v_p2 bigint; v_rel bigint; v_ev bigint; v_ind bigint; v_n integer;
begin
  raise notice 'Quem entra';
  perform eu(4, 'admin');
  perform ok(public.ri_dados()->>'status' = 'sem_permissao', 'nem o admin entra sem estar nos grupos');
  perform eu(11, 'leitura');
  perform ok(public.ri_dados()->>'status' = 'sem_permissao' and public.ri_contato_salvar('{"nome":"X"}')->>'status' = 'sem_permissao'
         and public.ri_indicacoes_listar()->>'status' = 'sem_permissao', 'membro comum não vê nada de RI');
  perform eu(44, 'leitura');
  perform ok(public.ri_indicar('{"tipo":"contato","dados":{"nome":"A","por_que":"b"}}')->>'status' = 'sem_permissao', 'conta inativa não indica');
  perform eu(41, 'leitura');
  r := public.ri_dados();
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'equipe') = 2, 'NRO_RELAC entra e vê a equipe de RI (41 e 42)');
  perform eu(42, 'leitura');
  perform ok(public.ri_dados()->>'status' = 'ok', 'NRO_COORD_OFFICE entra');

  raise notice 'Contatos';
  perform eu(41, 'leitura');
  r := public.ri_contato_salvar('{"natureza":"organizacao","nome":" Hospital das Clínicas ","cargo":"Hospital","funcao":"saude","proximidade":3,"estagio":"conhecendo"}');
  v_org := (r->>'id')::bigint;
  perform ok(r->>'status' = 'ok' and r->'contato'->>'nome' = 'Hospital das Clínicas', 'cria a organização (nome aparado)');
  r := public.ri_contato_salvar(jsonb_build_object('nome', 'Ana Souza', 'cargo', 'Diretora clínica', 'organizacao_id', v_org, 'funcao', 'parceiro',
        'proximidade', 4, 'influencia', 5, 'interesse', 4, 'tags', jsonb_build_array('Reabilitação', 'reabilitação', ' EMG '),
        'canais', jsonb_build_array(jsonb_build_object('tipo', 'email', 'valor', 'ana@hc.br'), jsonb_build_object('tipo', 'telefone', 'valor', '  ')),
        'responsavel', 41, 'origem', 'Congresso X'));
  v_p1 := (r->>'id')::bigint;
  perform ok(r->>'status' = 'ok' and r->'contato'->>'organizacao' = 'Hospital das Clínicas' and r->'contato'->>'responsavel_nome' is not null,
    'cria a pessoa ligada à organização, com responsável');
  perform ok((select cardinality(tags) from ri_contatos where id = v_p1) = 3 and (select jsonb_array_length(canais) from ri_contatos where id = v_p1) = 1,
    'tags limpas e canal vazio descartado');
  perform ok(public.ri_contato_salvar('{"nome":""}')->>'campo' = 'nome' and public.ri_contato_salvar('{"nome":"X","funcao":"vilão"}')->>'campo' = 'funcao'
         and public.ri_contato_salvar('{"nome":"X","proximidade":9}')->>'campo' = 'proximidade'
         and public.ri_contato_salvar(jsonb_build_object('nome', 'X', 'organizacao_id', v_p1))->>'campo' = 'organizacao_id',
    'valida nome, função, proximidade e que a organização seja organização');
  r := public.ri_contato_salvar(jsonb_build_object('nome', 'Bruno Lima', 'funcao', 'investidor', 'proximidade', 2));
  v_p2 := (r->>'id')::bigint;
  r := public.ri_contato_estagio(v_p2, 'primeiro_contato');
  perform ok(r->>'status' = 'ok' and (select estagio from ri_contatos where id = v_p2) = 'primeiro_contato',
    'o kanban muda o estágio');
  perform ok(public.ri_contato_estagio(v_p2, 'amigo')->>'status' = 'invalido', 'estágio fora da lista não entra');

  raise notice 'Relações';
  r := public.ri_relacao_salvar(jsonb_build_object('a', v_p2, 'b', v_p1, 'tags', jsonb_build_array('Investimento', 'Amizade'), 'sinal', 'positiva', 'forca', 4));
  v_rel := (r->'relacao'->>'id')::bigint;
  perform ok(r->>'status' = 'ok' and (r->'relacao'->>'a')::bigint = least(v_p1, v_p2), 'a relação guarda as pontas em ordem');
  r := public.ri_relacao_salvar(jsonb_build_object('a', v_p1, 'b', v_p2, 'sinal', 'negativa', 'forca', 2));
  perform ok((select count(*) from ri_relacoes) = 1 and (select sinal from ri_relacoes where id = v_rel) = 'negativa', 'a mesma dupla atualiza, não duplica');
  perform ok(public.ri_relacao_salvar(jsonb_build_object('a', v_p1, 'b', v_p1))->>'campo' = 'pontas'
         and public.ri_relacao_salvar(jsonb_build_object('a', v_p1, 'b', v_p2, 'sinal', 'talvez'))->>'campo' = 'sinal', 'sem laço e sinal válido');

  raise notice 'Interações';
  r := public.ri_interacao_salvar(jsonb_build_object('data', '2026-09-01', 'tipo', 'reuniao', 'resumo', 'Apresentação do projeto.',
        'contatos', jsonb_build_array(v_p1, v_p2), 'proximo_passo', 'Mandar a proposta', 'proximo_em', '2026-10-20'));
  perform ok(r->>'status' = 'ok' and (select proximo_passo from ri_contatos where id = v_p2) = 'Mandar a proposta', 'registra e leva o próximo passo aos contatos');
  perform ok(public.ri_interacao_salvar(jsonb_build_object('resumo', 'x', 'contatos', jsonb_build_array(999999)))->>'campo' = 'contatos'
         and public.ri_interacao_salvar(jsonb_build_object('resumo', '', 'contatos', jsonb_build_array(v_p1)))->>'campo' = 'resumo', 'valida contatos e resumo');
  r := public.ri_contato_ler(v_p1);
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'interacoes') = 1 and r->'contato'->>'ultima_interacao' = '2026-09-01'
         and jsonb_array_length(r->'relacoes') = 1 and r->'contato'->'canais'->0->>'valor' = 'ana@hc.br', 'a ficha traz histórico, relações e canais');
  perform ok(jsonb_array_length(public.ri_contato_ler(v_org)->'membros') = 1, 'a organização lista as pessoas dela');

  raise notice 'Eventos';
  r := public.ri_evento_salvar(jsonb_build_object('nome', 'Feira Hospitalar', 'tipo', 'feira', 'status', 'confirmado', 'inicio', '2026-11-10', 'fim', '2026-11-12',
        'objetivos', jsonb_build_array('Conhecer stakeholders', 'Apresentar'), 'participantes', jsonb_build_array(41, 42, 99999), 'contatos', jsonb_build_array(v_p1)));
  v_ev := (r->>'id')::bigint;
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'evento'->'participantes') = 2 and jsonb_array_length(r->'evento'->'contatos_lista') = 1,
    'cria o evento (participante inexistente fica de fora)');
  perform ok(public.ri_evento_salvar('{"nome":"X","inicio":"2026-11-10","fim":"2026-11-01"}')->>'campo' = 'fim'
         and public.ri_evento_salvar('{"nome":"X","link":"javascript:alert(1)"}')->>'campo' = 'link', 'valida datas e link');
  perform ok(jsonb_array_length(public.ri_contato_ler(v_p1)->'eventos') = 1, 'o evento aparece na ficha do contato');
  perform ok(jsonb_array_length(public.ri_eventos_listar()->'eventos') = 1, 'lista os eventos');

  raise notice 'Indicações';
  perform eu(11, 'leitura');
  perform ok(public.ri_indicar('{"tipo":"contato","dados":{"nome":"Tio Carlos"}}')->>'campo' = 'por_que', 'precisa dizer por que');
  r := public.ri_indicar('{"tipo":"contato","dados":{"nome":"Tio Carlos","por_que":"Potencial investidor","relacao":"meu tio","contato":"carlos@x.com","funcao":"investidor"}}');
  v_ind := (r->>'id')::bigint;
  perform ok(r->>'status' = 'ok', 'qualquer membro indica');
  perform ok((select count(*) from notificacoes where tipo = 'ri_indicacao' and registro in (41, 42)) = 2, 'a equipe de RI é avisada');
  r := public.ri_minhas_indicacoes();
  perform ok(jsonb_array_length(r->'indicacoes') = 1 and not (r->'indicacoes'->0 ? 'autor_nome'), 'o autor acompanha a dele');
  perform eu(41, 'leitura');
  perform ok(public.ri_indicacao_decidir(v_ind, 'recusar')->>'status' = 'resposta_obrigatoria', 'recusar pede resposta');
  r := public.ri_indicacao_decidir(v_ind, 'em_analise');
  perform ok(r->>'status' = 'ok'
         and (select count(*) from notificacoes where registro = 11 and tipo = 'ri_indicacao') = 1, 'em análise avisa o autor');
  r := public.ri_indicacao_decidir(v_ind, 'aceitar', 'Vamos conversar com ele.');
  perform ok(r->>'status' = 'ok' and (select funcao from ri_contatos where id = (r->>'contato_id')::bigint) = 'investidor'
         and (select origem from ri_contatos where id = (r->>'contato_id')::bigint) like 'Indicação de %(meu tio)', 'aceitar cria o contato com a origem');
  perform ok((select count(*) from notificacoes where registro = 11 and tipo = 'ri_indicacao') = 2, 'e avisa o autor de novo');
  perform ok(public.ri_indicacao_decidir(v_ind, 'recusar', 'x')->>'status' = 'encerrada', 'decidida não muda');
  perform eu(11, 'leitura');
  r := public.ri_indicar('{"tipo":"evento","dados":{"nome":"Demo Day","por_que":"Investidores","data":"2026-12-01","link":"https://x.org"}}');
  perform eu(42, 'leitura');
  r := public.ri_indicacao_decidir((r->>'id')::bigint, 'aceitar');
  perform ok((select status from ri_eventos where id = (r->>'evento_id')::bigint) = 'avaliando', 'evento indicado vira evento em avaliação');

  raise notice 'Excluir (LGPD)';
  perform eu(41, 'leitura');
  r := public.ri_contato_excluir(v_p1);
  perform ok(r->>'status' = 'ok' and not exists (select 1 from ri_relacoes)
         and (select contatos from ri_eventos where id = v_ev) = '{}' and (select contatos from ri_interacoes limit 1) = array[v_p2],
    'excluir leva relações e tira o contato de eventos e interações');
  r := public.ri_contato_excluir(v_p2);
  perform ok(r->>'status' = 'ok' and not exists (select 1 from ri_interacoes), 'a interação sem ninguém some');
end $$;

do $$ begin
  set local role authenticated;
  begin perform count(*) from public.ri_contatos; raise exception 'FALHOU: leu a tabela';
  exception when insufficient_privilege then raise notice '  ok   as tabelas só se leem pelas funções'; end;
end $$;
\echo 'Tudo certo.'
