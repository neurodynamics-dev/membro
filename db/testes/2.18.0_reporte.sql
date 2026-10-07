\set ON_ERROR_STOP on
-- Execute após testes/2.18.0_soma.sql, em PostgreSQL local.
begin;
update grupos set responsaveis='{42}' where nome='Sinais';
select eu(42,'x');
set role authenticated;
select ok(reporte_gestor(),'liderança pode reportar');
select reporte_ciclo_atual() as ciclo \gset
reset role;
update reporte_ciclos set prazo=now()+interval '1 day' where id=:'ciclo';
select id as frente from reporte_frentes where responsavel=42 and grupo_id=gid('Sinais') \gset
set role authenticated;
select ok(jsonb_array_length(reporte_painel()->'frentes')=1,'liderança vê sua frente');
select reporte_abrir(:'ciclo',:'frente')->'reporte'->>'id' as reporte \gset
select ok(jsonb_array_length(reporte_abrir(:'ciclo',:'frente')->'reporte'->'apontamentos')=2,'apontamento só lista membros da frente');
select ok(reporte_salvar(jsonb_build_object('id',:'reporte','versao',1,'etapa',3,
 'apontamentos','[{"registro":11,"assiduidade":"SUFICIENTE","entregas":"INSUFICIENTE","sinalizado":true,"justificativa":"Atraso"},{"registro":47,"assiduidade":"SUFICIENTE","entregas":"SUFICIENTE","sinalizado":false}]'::jsonb,
 'escalonamentos','[{"texto":"Revisar o cronograma"}]'::jsonb,
 'feed','[{"titulo":"Protótipo","subtitulo":"Ensaio concluído","texto":"Resultado da bancada"}]'::jsonb))->>'status'='ok','salva três etapas');
select ok(reporte_salvar(jsonb_build_object('id',:'reporte','versao',1))->>'status'='conflito','rascunho antigo não sobrescreve');
select ok(jsonb_array_length(feed_lista())=0,'rascunho não aparece no feed');
select eu(11,'leitura');
select ok(reporte_abrir(:'ciclo',:'frente')->>'status'='sem_permissao','membro não abre reporte');
select ok(reporte_painel()->>'status'='sem_permissao','membro não lê avaliações');
select eu(43,'x');
select ok(reporte_abrir(:'ciclo',:'frente')->>'status'='sem_permissao','outra liderança não acessa a frente');
select eu(42,'x');
select ok(reporte_enviar(:'reporte',2)->>'status'='ok','envia reporte');
select ok(reporte_enviar(:'reporte',2)->>'status'='ok','envio idempotente');
select ok(reporte_salvar(jsonb_build_object('id',:'reporte','versao',3))->>'status'='encerrado','enviado não é editável');
select eu(11,'leitura');
select ok(jsonb_array_length(feed_lista())=1,'membro ativo lê publicação');
select ok(not ((feed_lista()->0)?'apontamentos'),'feed não revela avaliação');
select eu(46,'x');
select ok(jsonb_array_length(feed_lista())=0,'conta bloqueada não lê feed');
select eu(4,'admin');
select ok(reporte_unificado(:'ciclo')->>'status'='ok','admin gera reporte unificado');
reset role;
select ok((select count(*) from atividades where origem_tipo='reporte' and origem_id=:'reporte'||':11')=1,'sinalização cria exatamente um card');
-- Uma origem externa é preservada; conta bloqueada não recebe convite.
insert into agenda_envios(evento_id,tipo,chave,para_registro,para_email,para_nome,assunto,dados)
select id,'convite','regressao218',46,'blocked@example.test','Bloqueada','Convite','{}' from eventos limit 1;
select ok(not exists(select 1 from jsonb_array_elements(agenda_envios_lote(10000)) x where x->>'para_email'='blocked@example.test'),'fila exclui conta bloqueada');
rollback;
