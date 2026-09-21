\pset pager off
\set ON_ERROR_STOP on
-- conectado como "app": membro de authenticated, NÃO superusuário,
-- não dono das tabelas. É aqui que a RLS vale de verdade.
select current_user as usuario, rolsuper as superusuario from pg_roles where rolname = current_user;

set teste.registro = '11'; set teste.papel = 'leitura';   -- Bruno, grupo Sinais
select 'quadro do Pessoal visto por quem não é do Pessoal' as cenario,
       count(*) as cartoes from atividades_quadro where grupo_id = (select grupo_pessoal());
select 'cartões de grupo comum vistos pelo mesmo Bruno' as cenario,
       count(*) as cartoes from atividades_quadro where grupo_id <> (select grupo_pessoal());
select 'comentários do quadro reservado' as cenario, count(*) as linhas
  from atividade_comentarios c join atividades a on a.id=c.atividade_id
 where a.grupo_id = (select grupo_pessoal());
select 'histórico do quadro reservado' as cenario, count(*) as linhas
  from atividade_log l join atividades a on a.id=l.atividade_id
 where a.grupo_id = (select grupo_pessoal());
select 'detalhe da origem pedido por quem não pode' as cenario,
       coalesce(atividade_origem_detalhe('DEP-1')->>'status','(veio conteúdo!)') as resposta;

set teste.registro = '31'; set teste.papel = 'pessoal';   -- Elis, Depto de Pessoal
select 'quadro do Pessoal visto por quem é do Pessoal' as cenario,
       count(*) as cartoes from atividades_quadro where grupo_id = (select grupo_pessoal());
select 'detalhe da origem pedido por quem pode' as cenario,
       atividade_origem_detalhe('DEP-1')->>'protocolo' as protocolo,
       atividade_origem_detalhe('DEP-1')->>'membro' as membro;

set teste.registro = '4'; set teste.papel = 'admin';
select 'quadro do Pessoal visto pelo admin' as cenario,
       count(*) as cartoes from atividades_quadro where grupo_id = (select grupo_pessoal());

-- a carga continua contando tudo, de propósito (volume, não conteúdo)
set teste.registro = '11'; set teste.papel = 'leitura';
select 'carga: nomes visíveis' as cenario, count(*) as linhas from atividades_carga;
