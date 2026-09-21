\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;

-- Gerência é um quadro reservado. Bruno (Sinais) é o "analista".
do $$ declare v_ger integer; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  perform grupo_salvar(jsonb_build_object('nome','Gerência','prefixo','GER','reservado',true));
  select id into v_ger from grupos where nome = 'Gerência';
  perform ok(v_ger is not null, 'admin criou o quadro reservado da Gerência');
end $$;

-- 1. o analista vê que existe, mas não entra
do $$ declare n text; begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  select meu_nivel_no_grupo(id) into n from grupos where nome='Gerência';
  perform ok(n = 'nenhum', 'analista: nível "nenhum" na Gerência');
  perform ok((select count(*) from grupos_visiveis where nome='Gerência') = 1,
             'mas a Gerência APARECE na lista dele — ele sabe que existe');
  perform ok((select meu_nivel from grupos_visiveis where nome='Gerência') = 'nenhum',
             'e a lista diz que ele não entra');
end $$;

-- 2. quadro comum continua aberto para a equipe inteira ler
do $$ begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo((select id from grupos where nome='Órtese')) = 'leitura',
             'quadro comum: leitura para quem não é do grupo');
  perform ok(meu_nivel_no_grupo((select id from grupos where nome='Sinais')) = 'edicao',
             'e edição no grupo em que ele está');
end $$;

-- 3. conceder leitura muda o nível, sem pôr ninguém no grupo
do $$ declare res jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  res := grupo_acesso_salvar(jsonb_build_object(
    'grupo_id',(select id from grupos where nome='Gerência'),'registro',11,'nivel','leitura'));
  perform ok(res->>'status'='ok', 'admin concedeu leitura ao analista');
  perform ok(exists(select 1 from notificacoes where registro=11 and tipo='quadro_liberado'),
             'e ele foi avisado');
  perform ok(not (select grupos @> array['Gerência'] from membros where registro=11),
             'conceder acesso NÃO o colocou no grupo');
end $$;

do $$ begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo((select id from grupos where nome='Gerência')) = 'leitura',
             'agora o analista lê a Gerência');
  perform ok(not posso_editar_grupo((select id from grupos where nome='Gerência')),
             'mas não mexe');
end $$;

-- 4. quem só lê não move cartão
do $$ declare v_ger integer; v_at uuid; res jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  select id into v_ger from grupos where nome='Gerência';
  res := atividade_criar(jsonb_build_object('grupo_id',v_ger,'titulo','Plano do semestre'));
  perform ok(res->>'status'='ok', 'admin criou uma atividade na Gerência');
  select id into v_at from atividades where codigo = res->>'codigo';

  set local teste.registro = '11'; set local teste.papel = 'leitura';
  res := atividade_editar(jsonb_build_object('id',v_at,'status','fazendo'));
  perform ok(res->>'status'='sem_permissao', 'quem só lê não move o cartão');

  res := atividade_comentar(jsonb_build_object('atividade_id',v_at,'corpo','oi'));
  perform ok(res->>'status'='sem_permissao', 'nem comenta');
end $$;

-- 5. subir para edição destrava
do $$ declare v_ger integer; v_at uuid; res jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  select id into v_ger from grupos where nome='Gerência';
  perform grupo_acesso_salvar(jsonb_build_object('grupo_id',v_ger,'registro',11,'nivel','edicao'));
  select id into v_at from atividades where grupo_id = v_ger limit 1;

  set local teste.registro = '11'; set local teste.papel = 'leitura';
  res := atividade_editar(jsonb_build_object('id',v_at,'status','fazendo'));
  perform ok(res->>'status'='ok', 'com edição, ele move');
end $$;

-- 6. revogar volta tudo
do $$ declare v_ger integer; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  select id into v_ger from grupos where nome='Gerência';
  perform grupo_acesso_salvar(jsonb_build_object('grupo_id',v_ger,'registro',11,'nivel','nenhum'));
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo(v_ger) = 'nenhum', 'revogado: volta a "nenhum"');
end $$;

-- 7. quem não é admin não concede acesso a si mesmo
do $$ declare res jsonb; begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  res := grupo_acesso_salvar(jsonb_build_object(
    'grupo_id',(select id from grupos where nome='Gerência'),'registro',11,'nivel','edicao'));
  perform ok(res->>'status'='sem_permissao', 'analista não se autoconcede acesso');
  res := grupo_salvar(jsonb_build_object('nome','Gerência','prefixo','GER','reservado',false));
  perform ok(res->>'status'='sem_permissao', 'nem abre o quadro reservado por conta própria');
end $$;

-- 8. renomear leva junto a ficha de quem está no grupo
do $$ declare res jsonb; v_id integer; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  select id into v_id from grupos where nome='Órtese';
  res := grupo_salvar(jsonb_build_object('id',v_id,'nome','Órteses','prefixo','ORT'));
  perform ok(res->>'status'='ok', 'renomeou Órtese -> Órteses');
  perform ok((res->>'renomeados')::int = 2, 'e corrigiu a ficha das 2 pessoas do grupo');
  perform ok((select count(*) from membros where grupos @> array['Órtese']) = 0,
             'ninguém ficou com o nome antigo');
  perform ok(meu_nivel_no_grupo(v_id) = 'edicao', 'e quem era do grupo continua sendo');
end $$;

-- 9. prefixo inválido é recusado
do $$ declare res jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  res := grupo_salvar(jsonb_build_object('nome','Teste X','prefixo','o'));
  perform ok(res->>'status'='invalido', 'prefixo de uma letra minúscula é recusado');
  res := grupo_salvar(jsonb_build_object('nome','Teste X','prefixo','SIN'));
  perform ok(res->>'status'='duplicado', 'prefixo já usado é recusado');
end $$;

-- 10. fundir dois grupos que eram o mesmo
do $$ declare res jsonb; a integer; b integer; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  perform grupo_salvar(jsonb_build_object('nome','NRO_SINAIS','prefixo','NRO'));
  select id into a from grupos where nome='NRO_SINAIS';
  select id into b from grupos where nome='Sinais';
  update membros set grupos = array_append(grupos,'NRO_SINAIS') where registro = 23;
  perform atividade_criar(jsonb_build_object('grupo_id',a,'titulo','Cartão do grupo duplicado'));

  res := grupo_fundir(jsonb_build_object('de',a,'para',b));
  perform ok(res->>'status'='ok', 'fundiu NRO_SINAIS em Sinais');
  perform ok((res->>'atividades')::int = 1, 'levou a atividade junto');
  perform ok((select count(*) from grupos where nome='NRO_SINAIS') = 0, 'o duplicado sumiu');
  perform ok((select codigo from atividades where titulo='Cartão do grupo duplicado') like 'SIN-%',
             'e o cartão ganhou o código do grupo que ficou');
  perform ok((select grupos @> array['Sinais'] from membros where registro=23),
             'quem estava no duplicado passou para o que ficou');
end $$;
