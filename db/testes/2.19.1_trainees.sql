\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.19.1: trainees no SOMA principal.
--   bash testes/preparar-base.sh teste t2191t 2.18.0_soma.sql 2.19.0.sql 2.19.1_recadastro.sql 2.19.1_trainees.sql
-- O esqueleto não tem todas as colunas de membros e dados_pessoais que a
-- produção tem (as que a ps_integrar já usa): o teste acrescenta.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

alter table membros add column if not exists telefone text, add column if not exists data_ingresso date,
  add column if not exists forma_ingresso text;
alter table dados_pessoais add column if not exists periodo_ingresso text, add column if not exists background text,
  add column if not exists lattes text, add column if not exists github text, add column if not exists instagram text,
  add column if not exists genero text, add column if not exists autodeclaracao_racial text,
  add column if not exists acessibilidade text, add column if not exists autorizacao_imagem boolean;

\i 2.19.1_trainees.sql
\i 2.19.1_trainees.sql

-- o cenário: três candidatos em 'trainee', um em outra fase, um com e-mail de membro
insert into grupos (nome, prefixo, ordem) values ('NRO_TRAINEE', 'TRN', 8) on conflict (nome) do nothing;
insert into ps_candidatos (edicao_id, status, nome, email, areas_interesse, curso, instituicao, telefone)
select e.id, v.status, v.nome, v.email, v.areas, 'Engenharia Mecânica', 'UFMG', '31999990000'
  from ps_edicoes e, (values
    ('trainee', 'Paula Nunes', 'paula@exemplo.test', '{Mecânica,Simulação}'::text[]),
    ('trainee', 'Rafael Dias', 'rafael@exemplo.test', '{Software}'::text[]),
    ('trainee', 'Sara Lopes', 'sara@exemplo.test', '{Eletrônica}'::text[]),
    ('aprovado_entrevista', 'Tiago Reis', 'tiago@exemplo.test', '{Software}'::text[]),
    ('trainee', 'Bruno de novo', 'bruno@nro.dev', '{Software}'::text[])) v(status, nome, email, areas)
 where e.slug = 'ps-2026';
update membros set email_pessoal = 'bruno@nro.dev' where registro = 11;
-- a Paula já tinha conta (criou no tour antes de ser admitida)
insert into perfis (id, email, papel, registro) values ('bbbbbbbb-0000-0000-0000-000000000001', 'paula@exemplo.test', 'leitura', null)
on conflict (id) do nothing;

do $$
declare r jsonb; c_paula uuid; c_rafael uuid; c_sara uuid; c_tiago uuid; c_bruno uuid; v_paula integer; v_rafael integer;
begin
  select id into c_paula from ps_candidatos where email = 'paula@exemplo.test';
  select id into c_rafael from ps_candidatos where email = 'rafael@exemplo.test';
  select id into c_sara from ps_candidatos where email = 'sara@exemplo.test';
  select id into c_tiago from ps_candidatos where email = 'tiago@exemplo.test';
  select id into c_bruno from ps_candidatos where email = 'bruno@nro.dev';

  raise notice 'Quem admite';
  perform eu(11, 'leitura');
  perform ok(public.ps_admitir_trainees('[]')->>'status' = 'sem_permissao', 'membro comum não admite');
  perform ok(public.ps_trainees_pendentes()->>'status' = 'sem_permissao', 'nem vê a lista');
  perform eu(17, 'pessoal');
  r := public.ps_trainees_pendentes();
  perform ok(jsonb_array_length(r->'candidatos') = 4, 'a lista: os candidatos em trainee ainda fora do quadro');
  perform ok((select (x->>'membro_mesmo_email')::integer from jsonb_array_elements(r->'candidatos') x where x->>'email' = 'bruno@nro.dev') = 11,
    'avisa quem tem o e-mail de um membro');

  raise notice 'Admissão em lote: tudo ou nada';
  r := public.ps_admitir_trainees(jsonb_build_array(
    jsonb_build_object('candidato', c_paula, 'area', 'Mecânica', 'gestor', 42, 'grupos', jsonb_build_array('Órtese')),
    jsonb_build_object('candidato', c_tiago, 'area', 'Software', 'gestor', 42),
    jsonb_build_object('candidato', c_bruno, 'area', 'Software', 'gestor', 42),
    jsonb_build_object('candidato', c_sara, 'area', '', 'gestor', 999),
    jsonb_build_object('candidato', c_rafael, 'area', 'Software', 'gestor', 42, 'grupos', jsonb_build_array('Grupo que não existe'))));
  perform ok(r->>'status' = 'invalido' and jsonb_array_length(r->'erros') = 4, 'com erro, nada é gravado e cada erro vem dito');
  perform ok((select array_agg(x->>'erro' order by x->>'erro') from jsonb_array_elements(r->'erros') x)
             = '{area_obrigatoria,email_de_membro,grupo_invalido,status_invalido}', 'status, e-mail de membro, área e grupo');
  perform ok(not exists (select 1 from membros where nome = 'Paula Nunes'), 'a Paula não entrou');

  r := public.ps_admitir_trainees(jsonb_build_array(
    jsonb_build_object('candidato', c_paula, 'area', 'Mecânica', 'gestor', 42, 'grupos', jsonb_build_array('Órtese')),
    jsonb_build_object('candidato', c_rafael, 'area', 'Software', 'gestor', 42, 'registro', 300)));
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'admitidos') = 2, 'admite os dois');
  select registro_membro into v_paula from ps_candidatos where id = c_paula;
  select registro_membro into v_rafael from ps_candidatos where id = c_rafael;
  perform ok(v_rafael = 300 and v_paula is not null and v_paula <> 300, 'com o registro escolhido ou o próximo livre');
  perform ok((select cargo = 'Trainee' and status = 'Ativo' and departamento = 'Mecânica' and gestor_registro = 42
                     and grupos @> '{NRO_TRAINEE,Órtese}' from membros where registro = v_paula),
    'membro Ativo, cargo Trainee, área, gestor direto, NRO_TRAINEE e os grupos escolhidos');
  perform ok(public.eh_trainee(v_paula) and not public.eh_trainee(42), 'eh_trainee() lê o cargo');
  perform ok((select status from ps_candidatos where id = c_paula) = 'trainee', 'no PS continua trainee (não integrado)');
  perform ok((select registro from perfis where email = 'paula@exemplo.test') = v_paula, 'a conta que a Paula já tinha passa a ser dela no quadro');
  perform ok(public.esta_no_grupo(gid('Órtese'), v_paula) and not public.esta_no_grupo(gid('Sinais'), v_paula),
    'entra só nos grupos escolhidos');
  perform ok(public.cadastro_elegivel(v_paula), 'entra no recadastro e no termo como qualquer membro');

  raise notice 'Clique repetido';
  r := public.ps_admitir_trainees(jsonb_build_array(jsonb_build_object('candidato', c_paula, 'area', 'Mecânica', 'gestor', 42)));
  perform ok(r->>'status' = 'ok' and (r->'admitidos'->0->>'ja_admitido')::boolean, 'admitir de novo não duplica');
  perform ok((select count(*) from membros where nome = 'Paula Nunes') = 1, 'uma Paula só');

  raise notice 'Quadro por área de interesse';
  perform eu(42, 'leitura');
  perform ok(jsonb_array_length(public.trainees_quadro()->'trainees') = 2, 'a liderança vê os trainees');
  r := public.trainees_quadro('Simulação');
  perform ok(jsonb_array_length(r->'trainees') = 1 and r->'trainees'->0->>'nome' = 'Paula Nunes'
             and r->'trainees'->0->>'alocacao' = 'Mecânica', 'o filtro é pela área de interesse; a alocação vem separada');

  raise notice 'Efetivação';
  perform ok(public.trainee_efetivar(v_paula, 'Engenheira')->>'status' = 'sem_permissao', 'liderança não efetiva');
  perform eu(17, 'pessoal');
  perform ok(public.trainee_efetivar(v_paula, 'Trainee')->>'status' = 'invalido', 'o cargo novo não pode ser Trainee');
  perform ok(public.trainee_efetivar(v_paula, 'Engenheira de projetos')->>'status' = 'ok', 'efetiva');
  perform ok((select cargo = 'Engenheira de projetos' and grupos @> '{Órtese}' and not grupos @> '{NRO_TRAINEE}' and departamento = 'Mecânica'
                from membros where registro = v_paula), 'troca o cargo, sai de NRO_TRAINEE e mantém o resto');
  perform ok((select status from ps_candidatos where id = c_paula) = 'integrado', 'o PS fecha como integrado');
  perform ok(public.trainee_efetivar(v_paula, 'Outro')->>'status' = 'nao_trainee', 'quem já é efetivo não é efetivado de novo');

  raise notice 'Dispensa';
  insert into atividades (codigo, grupo_id, seq, titulo, criado_por, responsavel) values ('SIN-90', gid('Sinais'), 90, 'Ensaio do Rafael', 4, v_rafael);
  insert into acessos_concedidos (registro, item_id, ativo, concedido_em) select v_rafael, id, true, current_date from itens_de_acesso where nome = 'Drive da equipe';
  perform ok(public.trainee_dispensar(v_rafael, ' ')->>'status' = 'motivo_obrigatorio', 'dispensa pede motivo');
  r := public.trainee_dispensar(v_rafael, 'Não completou o período trainee');
  perform ok(r->>'status' = 'ok' and (r->>'atividades_abertas')::integer = 1 and r->>'acessos' = 'Drive da equipe', 'dispensa');
  perform ok((select status = 'Desligado' and grupos = '{}' from membros where registro = v_rafael), 'Desligado, fora dos grupos');
  perform ok(exists (select 1 from membros where registro = v_rafael) and exists (select 1 from ocorrencias where registro = v_rafael and tipo = 'Dispensa'),
    'a pessoa não é apagada; a dispensa fica no histórico');
  perform ok((select a.ativo from acessos_concedidos a join itens_de_acesso i on i.id = a.item_id where a.registro = v_rafael and i.nome = 'Drive da equipe'),
    'o acesso do catálogo não é dado como revogado sozinho');
  perform ok(public.grupo_pessoal() is null or exists (select 1 from atividades where origem_tipo = 'ocorrencia' and origem_id = 'trainee_dispensa:' || v_rafael),
    'um card no Pessoal para redistribuir as atividades e revogar os acessos');
  perform ok((select status from ps_candidatos where id = c_rafael) = 'reprovado_final', 'no PS: reprovado no período trainee');
  perform ok(public.trainee_dispensar(v_rafael, 'de novo')->>'status' = 'nao_trainee' or public.trainee_dispensar(v_rafael, 'de novo')->>'ja_dispensado' = 'true',
    'dispensar de novo não repete');
end $$;
\echo 'Tudo certo.'
