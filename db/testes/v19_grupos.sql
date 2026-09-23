\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;

-- A árvore do pedido: NRO_LEADERSHIP contém MANAGERS e SUPERVISORS;
-- NRO_PROJECTS contém um grupo por projeto. Os dois guarda-chuvas
-- existem para dar acesso — não têm quadro de atividades.
do $$ declare r jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  perform grupo_salvar(jsonb_build_object('nome','NRO_LEADERSHIP','prefixo','LEA','reservado',true));
  perform grupo_salvar(jsonb_build_object('nome','NRO_MANAGERS','prefixo','MAN'));
  perform grupo_salvar(jsonb_build_object('nome','NRO_SUPERVISORS','prefixo','SUP'));
  perform grupo_salvar(jsonb_build_object('nome','NRO_PROJECTS','prefixo','PRJ'));
  perform grupo_salvar(jsonb_build_object('nome','NRO_PROJECT_NEBULA','prefixo','NEB'));

  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_LEADERSHIP'), 'quadro', false));
  perform ok(r->>'status' = 'ok', 'LEADERSHIP sem quadro');
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_PROJECTS'), 'quadro', false));
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_MANAGERS'),    'pai_id', gid('NRO_LEADERSHIP')));
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_SUPERVISORS'), 'pai_id', gid('NRO_LEADERSHIP')));
  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_PROJECT_NEBULA'), 'pai_id', gid('NRO_PROJECTS')));
  perform ok(r->>'status' = 'ok', 'NEBULA fica debaixo de PROJECTS');
  perform ok((select pai_id from grupos where nome='NRO_MANAGERS') = gid('NRO_LEADERSHIP'),
             'MANAGERS tem LEADERSHIP como pai');
  -- só a chave que veio muda: salvar o quadro não solta o pai
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_MANAGERS'), 'quadro', true));
  perform ok((select pai_id from grupos where nome='NRO_MANAGERS') = gid('NRO_LEADERSHIP'),
             'salvar só o quadro não mexe no pai');
end $$;

-- 1. a árvore não vira círculo
do $$ declare r jsonb; pegou boolean := false; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_LEADERSHIP'), 'pai_id', gid('NRO_MANAGERS')));
  perform ok(r->>'status' = 'ciclo', 'pôr LEADERSHIP debaixo de MANAGERS: a função recusa (ciclo)');
  begin
    update grupos set pai_id = gid('NRO_MANAGERS') where nome = 'NRO_LEADERSHIP';
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'e escrevendo direto no banco o gatilho recusa também');
  pegou := false;
  begin
    update grupos set pai_id = id where nome = 'NRO_PROJECTS';
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'um grupo não é pai de si mesmo');
  -- um galho desativado não pode esconder o ciclo
  update grupos set ativo = false where nome = 'NRO_MANAGERS';
  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_LEADERSHIP'), 'pai_id', gid('NRO_MANAGERS')));
  perform ok(r->>'status' = 'ciclo', 'nem passando por um grupo inativo');
  update grupos set ativo = true where nome = 'NRO_MANAGERS';
end $$;

-- 2. o exemplo do pedido: pôr gente em NEBULA põe em PROJECTS
do $$ declare r jsonb; n integer; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_PROJECT_NEBULA'),
                                               'adicionar', jsonb_build_array(11, 17)));
  perform ok(r->>'status' = 'ok' and (r->>'adicionados')::int = 2, 'Bruno e Carla entram em NEBULA de uma vez');
  perform ok((select grupos from membros where registro = 11) @> array['NRO_PROJECT_NEBULA'],
             'a ficha do Bruno ganha NRO_PROJECT_NEBULA');
  perform ok(not (select grupos from membros where registro = 11) @> array['NRO_PROJECTS'],
             'e NÃO ganha NRO_PROJECTS escrito — a herança é calculada');
  perform ok(esta_no_grupo(gid('NRO_PROJECTS'), 11), 'mesmo assim o Bruno está em NRO_PROJECTS');
  perform ok(not esta_no_grupo(gid('NRO_PROJECTS'), 23), 'o Diego, que não está em projeto nenhum, não está');
  select count(*) into n from ocorrencias where tipo = 'Adição a grupo' and descricao = 'NRO_PROJECT_NEBULA';
  perform ok(n = 2, 'cada entrada deixa a ocorrência que a ficha deixaria ("Adição a grupo")');
  perform ok((select responsavel from ocorrencias where tipo = 'Adição a grupo' and registro = 11 limit 1) = 'Ana Figueiredo',
             'com o nome de quem pôs');
  perform ok((select count(*) from atividades where origem_tipo = 'ocorrencia') = 0
               or not exists (select 1 from atividades a join ocorrencias o on o.id::text = a.origem_id
                               where o.tipo = 'Adição a grupo'),
             'e a ocorrência de espelho não vira cartão no quadro do Pessoal');

  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_PROJECT_NEBULA'),
                                               'adicionar', jsonb_build_array(11)));
  perform ok((r->>'adicionados')::int = 0, 'pôr de novo quem já está não duplica nada');
  select count(*) into n from ocorrencias where tipo = 'Adição a grupo' and descricao = 'NRO_PROJECT_NEBULA';
  perform ok(n = 2, 'nem a ocorrência');
end $$;

-- 3. quem está no grupo, e por onde chegou
do $$ declare n integer; v integer; d boolean; begin
  select count(*) into n from grupo_pessoas(gid('NRO_PROJECTS'));
  perform ok(n = 2, 'PROJECTS tem 2 pessoas, nenhuma direto');
  select via_grupo_id, direto into v, d from grupo_pessoas(gid('NRO_PROJECTS')) where registro = 11;
  perform ok(v = gid('NRO_PROJECT_NEBULA') and not d, 'o Bruno está lá por NEBULA');
  perform ok(grupos_de(11) @> array[gid('Sinais'), gid('NRO_PROJECT_NEBULA'), gid('NRO_PROJECTS')],
             'os grupos do Bruno: Sinais, NEBULA e PROJECTS');
end $$;

-- 4. o quadro herda: estar abaixo é estar no grupo
do $$ declare r jsonb; begin
  set local teste.registro = '23'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo(gid('NRO_LEADERSHIP')) = 'nenhum',
             'Diego não entra no quadro reservado de LEADERSHIP');
  set local teste.registro = '4'; set local teste.papel = 'admin';
  perform grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_MANAGERS'), 'adicionar', jsonb_build_array(23)));
  set local teste.registro = '23'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo(gid('NRO_LEADERSHIP')) = 'edicao',
             'posto em MANAGERS, ele passa a editar LEADERSHIP, sem estar lá pela ficha');
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo(gid('NRO_PROJECTS')) = 'edicao', 'e o Bruno edita PROJECTS, por NEBULA');
end $$;

-- 5. grupo sem quadro some de Atividades; os outros contam os herdados
do $$ begin
  set local teste.registro = '11'; set local teste.papel = 'leitura';
  perform ok(not exists (select 1 from grupos_visiveis where nome = 'NRO_PROJECTS'),
             'PROJECTS, sem quadro, não aparece em Atividades');
  perform ok((select pessoas from grupos_visiveis where nome = 'NRO_PROJECT_NEBULA') = 2,
             'NEBULA aparece, com 2 pessoas');
  perform ok((select pessoas from grupos_visiveis where nome = 'NRO_MANAGERS') = 1,
             'MANAGERS conta o Diego');
  perform ok((select pai_id from grupos_visiveis where nome = 'NRO_MANAGERS') = gid('NRO_LEADERSHIP'),
             'e a lista traz o pai de cada um');
end $$;

-- 6. grupo desativado não passa pertença para cima
do $$ begin
  update grupos set ativo = false where nome = 'NRO_PROJECT_NEBULA';
  perform ok(not esta_no_grupo(gid('NRO_PROJECTS'), 11), 'NEBULA desativado: o Bruno sai de PROJECTS');
  perform ok(esta_no_grupo(gid('NRO_PROJECT_NEBULA'), 11), 'mas continua em NEBULA, como sempre esteve');
  perform ok(not (grupos_de(11) @> array[gid('NRO_PROJECTS')]), 'grupos_de concorda');
  update grupos set ativo = true where nome = 'NRO_PROJECT_NEBULA';
  perform ok(esta_no_grupo(gid('NRO_PROJECTS'), 11), 'reativado, volta');
end $$;

-- 7. responsável cuida do grupo dele e dos de baixo — e só deles
do $$ declare r jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_PROJECTS'), 'responsaveis', jsonb_build_array(23, 999)));
  perform ok((select responsaveis from grupos where nome = 'NRO_PROJECTS') = array[23],
             'Diego é responsável por PROJECTS (registro inexistente fica de fora)');

  set local teste.registro = '23'; set local teste.papel = 'leitura';
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_PROJECT_NEBULA'), 'remover', jsonb_build_array(11)));
  perform ok(r->>'status' = 'ok' and (r->>'removidos')::int = 1, 'o responsável de PROJECTS tira o Bruno de NEBULA');
  perform ok(not esta_no_grupo(gid('NRO_PROJECTS'), 11), 'e o Bruno sai de PROJECTS junto');
  perform ok(exists (select 1 from ocorrencias where registro = 11 and tipo = 'Remoção de grupo'
                     and descricao = 'NRO_PROJECT_NEBULA' and responsavel = 'Diego Prado'),
             'com a ocorrência de remoção, no nome do Diego');
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('Sinais'), 'adicionar', jsonb_build_array(23)));
  perform ok(r->>'status' = 'sem_permissao', 'mas não mexe em Sinais, que não é dele');

  set local teste.registro = '17'; set local teste.papel = 'leitura';
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_PROJECT_NEBULA'), 'adicionar', jsonb_build_array(31)));
  perform ok(r->>'status' = 'sem_permissao', 'quem só está no grupo não põe ninguém nele');
  r := grupo_estrutura_salvar(jsonb_build_object('id', gid('NRO_PROJECT_NEBULA'), 'pai_id', null));
  perform ok(r->>'status' = 'sem_permissao', 'nem mexe na árvore');
end $$;

-- 8. tirar do pai não tira de quem está lá por um filho
do $$ declare r jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  r := grupo_membros_salvar(jsonb_build_object('grupo_id', gid('NRO_PROJECTS'), 'remover', jsonb_build_array(17)));
  perform ok((r->>'removidos')::int = 0, 'a Carla não está em PROJECTS pela ficha — nada a tirar');
  perform ok(esta_no_grupo(gid('NRO_PROJECTS'), 17), 'e ela continua lá, por NEBULA');
end $$;

-- 9. apagar um grupo não solta os filhos: eles sobem um nível
do $$ declare r jsonb; begin
  set local teste.registro = '4'; set local teste.papel = 'admin';
  perform grupo_salvar(jsonb_build_object('nome','Supervisores de bancada','prefixo','SBA'));
  perform grupo_estrutura_salvar(jsonb_build_object('id', gid('Supervisores de bancada'), 'pai_id', gid('NRO_SUPERVISORS')));
  r := grupo_fundir(jsonb_build_object('de', gid('NRO_SUPERVISORS'), 'para', gid('NRO_MANAGERS')));
  perform ok(r->>'status' = 'ok', 'SUPERVISORS fundido em MANAGERS');
  perform ok((select pai_id from grupos where nome = 'Supervisores de bancada') = gid('NRO_LEADERSHIP'),
             'o subgrupo que era dele sobe para LEADERSHIP, em vez de ficar sem pai');
end $$;

-- 10. rodar a 17.0 de novo NÃO apaga a herança (cada coisa, uma dona)
\ir ../v17_grupos_acesso.sql
do $$ begin
  set local teste.registro = '23'; set local teste.papel = 'leitura';
  perform ok(meu_nivel_no_grupo(gid('NRO_LEADERSHIP')) = 'edicao',
             'depois de rodar a 17.0 de novo, o Diego continua editando LEADERSHIP por MANAGERS');
  perform ok(not exists (select 1 from grupos_visiveis where nome = 'NRO_PROJECTS'),
             'e a lista continua sem os grupos sem quadro');
end $$;

-- 11. e a própria 19.0 roda de novo sem estragar nada
\ir ../v19_grupos_hierarquia.sql
do $$ begin
  perform ok((select pai_id from grupos where nome = 'NRO_PROJECT_NEBULA') = gid('NRO_PROJECTS'),
             'rodar a 19.0 de novo mantém a árvore');
  perform ok((select responsaveis from grupos where nome = 'NRO_PROJECTS') = array[23],
             'e os responsáveis');
  perform ok((select count(*) from migracoes where id = 'v19_grupos_hierarquia') = 1,
             'e registra a migração uma vez só');
end $$;
