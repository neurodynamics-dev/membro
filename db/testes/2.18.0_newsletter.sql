\set ON_ERROR_STOP on
begin;
update membros set grupos=array_append(grupos,'NRO_LEADERSHIP') where registro=47;
insert into feed_itens(autor,titulo,subtitulo,texto,publicado_em)
values(42,'Resultado','Bancada','Ensaio concluído',date_trunc('week',now())-interval '2 days');
select eu(4,'admin');set role authenticated;
select ok(comunidade_importar('[{"nome":"Comunidade","email":"teste@example.test"}]')->>'status'='ok','admin importa comunidade');
select newsletter_gerar('semanal')->>'id' as news \gset
select ok(newsletter_decidir(:'news',1,true)->>'status'='sem_permissao','admin sem liderança não substitui voto');
select eu(42,'x');
select ok(newsletter_decidir(:'news',1,true)->>'status'='ok','primeira aprovação');
select ok(newsletter_decidir(:'news',1,true)->>'status'='ok','repetição substitui voto');
select eu(43,'x');select ok(newsletter_decidir(:'news',1,true)->>'status'='ok','segunda aprovação');
reset role;
select ok((select status='em_aprovacao' from newsletters where id=:'news'),'dois votos não autorizam envio');
select ok((select count(*) from newsletter_envios where newsletter_id=:'news')=0,'sem destinatários antes de três votos');
set role authenticated;select eu(42,'x');
select ok(newsletter_revisar(:'news','Novo boletim','[{"titulo":"Título","subtitulo":"Subtítulo","texto":"Texto"}]')->>'status'='ok','conteúdo revisado');
reset role;select ok((select count(*) from newsletter_aprovacoes where newsletter_id=:'news')=0,'revisão invalida aprovações');
set role authenticated;
select ok(newsletter_decidir(:'news',1,true)->>'status'='conflito','não aprova versão antiga');
select newsletter_decidir(:'news',2,true);
select eu(43,'x');select newsletter_decidir(:'news',2,true);
select eu(47,'x');select newsletter_decidir(:'news',2,true);
reset role;
select ok((select status='aprovada' from newsletters where id=:'news'),'três lideranças aprovam');
select ok((select count(*) from newsletter_envios where newsletter_id=:'news')>0,'aprovação forma fila');
select ok(not exists(select 1 from newsletter_envios where registro in (44,45,46)),'fila exclui inativos');
select ok((select a.status='concluida' from atividades a join newsletters n on n.card_id=a.id where n.id=:'news'),'card concluído após aprovação');
select token as token from comunidade_inscritos where email='teste@example.test' \gset
set role anon;
select ok(comunidade_descadastrar(:'token')->>'status'='ok','descadastro sem login');
select ok(comunidade_descadastrar(:'token')->>'status'='ok','descadastro idempotente');
reset role;
select ok((select descadastrado_em is not null from comunidade_inscritos where token=:'token'),'descadastro persistido');
select eu(4,'admin');set role authenticated;
select comunidade_importar('[{"nome":"Comunidade","email":"teste@example.test"}]');
reset role;
select ok((select descadastrado_em is not null from comunidade_inscritos where token=:'token'),'reimportação não reinscreve');
select ok(jsonb_typeof(newsletter_lote(10))='array','lote periódico executa');
rollback;
