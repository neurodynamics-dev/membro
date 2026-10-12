\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_recursos: o catálogo colaborativo (criar, duplicar, editar, avaliar, comentar, permissões) e a semente.
\i 2.19.2_recursos.sql
\i 2.19.2_recursos.sql
\i 2.19.2_recursos_semente.sql
\i 2.19.2_recursos_semente.sql

do $$
declare r jsonb; v_n integer; v_slug text; v_com uuid;
begin
  raise notice 'Quem entra';
  perform eu(44, 'leitura');   -- conta inativa (desligado)
  perform ok(public.recursos_listar()->>'status' = 'sem_permissao' and public.recurso_salvar('{}')->>'status' = 'sem_permissao', 'conta inativa não usa o catálogo');
  perform eu(11, 'leitura');
  r := public.recursos_listar();
  perform ok(r->>'status' = 'ok' and not (r->>'gestao')::boolean, 'membro comum lista, sem a gestão');

  raise notice 'A semente';
  select count(*) into v_n from recursos;
  perform ok(v_n >= 55, 'a semente trouxe os recursos (' || v_n || ')');
  perform ok((select count(*) from recursos where padrao_nro) = 2 and (select padrao_nro from recursos where slug = 'visual-studio-code'), 'só VS Code e Git Bash são padrão da NRO');
  perform ok(exists (select 1 from recursos where slug = 'ghidra' and tipo = 'repositorio') and exists (select 1 from recursos where slug = 'figma' and 'estudante' = any(acesso)), 'Ghidra e Figma estão lá');
  perform ok(not exists (select 1 from recursos where length(funcao) = 0 or url !~ '^https?://' or tipo is null), 'todo recurso diz o que faz e tem endereço');
  perform ok((select count(*) from recursos where 'Gravação' = any(tags)) >= 15, 'a gravação de microcontroladores tem o seu conjunto');
  perform ok((select count(*) from jsonb_array_elements(public.recursos_listar()->'recursos')) = v_n, 'a lista traz todos');

  raise notice 'Adicionar';
  r := public.recurso_salvar(jsonb_build_object('url', 'https://exemplo.com/ferramenta', 'nome', 'Ferramenta de Exemplo', 'funcao', 'Faz uma coisa útil.',
         'tipo', 'servico', 'tags', jsonb_build_array('Teste', 'teste', ' Outra  tag ', ''), 'plataformas', '["Web"]', 'acesso', '["gratis"]', 'padrao_nro', true));
  perform ok(r->>'status' = 'ok' and r->>'slug' = 'ferramenta-de-exemplo', 'qualquer membro adiciona (slug pelo nome)');
  v_slug := r->>'slug';
  perform ok((select tags from recursos where slug = v_slug) = array['Teste', 'Outra tag'], 'tags limpas: sem repetir, sem vazios, espaços ajustados');
  perform ok(not (select padrao_nro from recursos where slug = v_slug), 'membro comum não marca "Padrão da NRO"');
  perform ok((select criado_por from recursos where slug = v_slug) = 11, 'guarda quem adicionou');
  r := public.recurso_salvar(jsonb_build_object('url', 'HTTPS://www.exemplo.com/ferramenta/', 'nome', 'Outro nome', 'funcao', 'Repetido.'));
  perform ok(r->>'status' = 'duplicado' and r->>'slug' = v_slug, 'o mesmo endereço (mesmo com www, maiúsculas e barra) não repete');
  perform ok(public.recurso_salvar('{"url":"nao-e-url","nome":"X","funcao":"Y"}')->>'campo' = 'url', 'endereço inválido');
  perform ok(public.recurso_salvar('{"url":"https://a.com","nome":"","funcao":"Y"}')->>'campo' = 'nome', 'sem nome');
  perform ok(public.recurso_salvar('{"url":"https://a.com","nome":"X","funcao":""}')->>'campo' = 'funcao', 'sem dizer o que faz');
  perform ok(public.recurso_salvar('{"url":"https://a.com","nome":"X","funcao":"Y","acesso":["de-graca"]}')->>'campo' = 'acesso', 'acesso fora da lista');
  r := public.recurso_salvar(jsonb_build_object('url', 'https://outro.com', 'nome', 'Ferramenta de Exemplo', 'funcao', 'Outro com o mesmo nome.'));
  perform ok(r->>'slug' = 'ferramenta-de-exemplo-2', 'nome igual ganha um número no endereço da página');

  raise notice 'Editar (qualquer membro; padrão só a gestão)';
  perform eu(41, 'leitura');
  r := public.recurso_salvar(jsonb_build_object('id', (select id from recursos where slug = v_slug), 'url', 'https://exemplo.com/ferramenta', 'nome', 'Ferramenta de Exemplo',
         'funcao', 'Faz uma coisa útil, agora melhor descrita.', 'instrucoes_usar', '1. Abra.\n2. Use.', 'status', 'inativo', 'padrao_nro', true));
  perform ok(r->>'status' = 'ok' and (select atualizado_por from recursos where slug = v_slug) = 41 and (select status from recursos where slug = v_slug) = 'inativo', 'outro membro edita e vira o "atualizado por"');
  perform ok(not (select padrao_nro from recursos where slug = v_slug), 'e também não marca o padrão');
  perform eu(4, 'admin');
  perform ok((public.recursos_listar()->>'gestao')::boolean, 'o admin é gestão');
  r := public.recurso_salvar(jsonb_build_object('id', (select id from recursos where slug = v_slug), 'url', 'https://exemplo.com/ferramenta', 'nome', 'Ferramenta de Exemplo',
         'funcao', 'Faz uma coisa útil.', 'padrao_nro', true));
  perform ok((select padrao_nro from recursos where slug = v_slug), 'a gestão marca "Padrão da NRO"');
  perform eu(11, 'leitura');
  r := public.recurso_salvar(jsonb_build_object('id', (select id from recursos where slug = v_slug), 'url', 'https://exemplo.com/ferramenta', 'nome', 'Ferramenta de Exemplo', 'funcao', 'Só texto.'));
  perform ok((select padrao_nro from recursos where slug = v_slug), 'uma edição sem o campo não derruba o padrão');

  raise notice 'Avaliar';
  r := public.recurso_avaliar(v_slug, 5);
  perform ok(r->>'status' = 'ok' and (r->'recurso'->>'media')::numeric = 5 and (r->'recurso'->>'minha')::int = 5, 'uma avaliação');
  perform eu(41, 'leitura'); perform public.recurso_avaliar(v_slug, 2);
  r := public.recurso_ler(v_slug);
  perform ok((r->'recurso'->>'media')::numeric = 3.5 and (r->'recurso'->>'avaliacoes')::int = 2, 'a média de duas pessoas');
  perform public.recurso_avaliar(v_slug, 4);
  perform ok((public.recurso_ler(v_slug)->'recurso'->>'media')::numeric = 4.5 and (select count(*) from recurso_avaliacoes where recurso_id = (select id from recursos where slug = v_slug)) = 2,
    'avaliar de novo troca a nota, não soma');
  perform ok(public.recurso_avaliar(v_slug, 9)->>'status' = 'invalido', 'só de 1 a 5');
  perform public.recurso_avaliar(v_slug, 0);
  perform ok((public.recurso_ler(v_slug)->'recurso'->>'avaliacoes')::int = 1 and (public.recurso_ler(v_slug)->'recurso'->'minha') = 'null'::jsonb, 'zero retira a avaliação');

  raise notice 'Comentar';
  r := public.recurso_comentar(v_slug, '  Funcionou bem na bancada.  ');
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'comentarios_lista') = 1 and r->'comentarios_lista'->0->>'texto' = 'Funcionou bem na bancada.', 'comentar (texto aparado)');
  v_com := (r->'comentarios_lista'->0->>'id')::uuid;
  perform ok((r->'comentarios_lista'->0->>'meu')::boolean and (r->'comentarios_lista'->0->>'pode_apagar')::boolean, 'o autor apaga o próprio');
  perform ok(public.recurso_comentar(v_slug, '   ')->>'status' = 'invalido' and public.recurso_comentar(v_slug, repeat('x', 2001))->>'status' = 'invalido', 'vazio e longo demais não passam');
  perform eu(11, 'leitura');
  perform ok(not (public.recurso_ler(v_slug)->'recurso'->'comentarios_lista'->0->>'pode_apagar')::boolean, 'outro membro não apaga comentário alheio');
  perform ok(public.recurso_comentario_apagar(v_com)->>'status' = 'sem_permissao', 'e a função recusa');
  perform eu(4, 'admin');
  r := public.recurso_comentario_apagar(v_com);
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'comentarios_lista') = 0 and (public.recurso_ler(v_slug)->'recurso'->>'comentarios')::int = 0, 'a gestão apaga');
  perform ok(public.recurso_ler('nao-existe')->>'status' = 'nao_encontrado', 'recurso que não existe');

  raise notice 'A lista traz o resumo';
  r := public.recursos_listar();
  perform ok(exists (select 1 from jsonb_array_elements(r->'recursos') x where x->>'slug' = v_slug and (x->>'avaliacoes')::int = 1 and x ? 'minha')
             and not exists (select 1 from jsonb_array_elements(r->'recursos') x where x ? 'instrucoes_usar'), 'a lista tem média e contagens, sem as instruções (que só vêm na página do recurso)');
  perform ok((select count(*) from recursos where slug = 'ghidra') = 1, 'rodar a semente de novo não duplica');
end $$;

-- as tabelas não são legíveis pela API
set role authenticated;
do $$ begin
  begin perform count(*) from public.recursos; raise exception 'FALHOU: leu a tabela';
  exception when insufficient_privilege then perform ok(true, 'as tabelas só se leem pelas funções'); end;
end $$;
reset role;
\echo Tudo certo.
