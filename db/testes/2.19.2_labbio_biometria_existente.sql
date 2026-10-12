\set ON_ERROR_STOP on
\pset pager off
-- Teste da 2.19.2_labbio_biometria_existente: o acesso que já existia passa a constar, sem aviso, e rodar de novo não muda nada.
select count(*) as n0 from notificacoes \gset
\i 2.19.2_labbio_biometria_existente.sql
select ok((select count(*) from acessos_concedidos a join membros m on m.registro = a.registro
            where a.item_id = labbio_item_biometria() and a.ativo and a.registro = any(array[1,2,9,11,12,16,18,30,32,43,56]))
          >= (select count(*) from membros where registro = any(array[1,2,9,11,12,16,18,30,32,43,56]) and status in ('Ativo', 'Em pausa / avaliação')),
          'todos os que estão na equipe ficam com o acesso ativo');
select ok((select count(*) from notificacoes) = :n0, 'sem aviso');
select concedido_em as d0, responsavel as r0 from acessos_concedidos where item_id = labbio_item_biometria() and registro = 43 \gset
\i 2.19.2_labbio_biometria_existente.sql
select ok((select responsavel from acessos_concedidos where item_id = labbio_item_biometria() and registro = 43) = :'r0', 'rodar de novo não muda quem já tinha');
\echo Tudo certo.
