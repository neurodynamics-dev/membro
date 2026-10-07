\set ON_ERROR_STOP on
begin;
select eu(11,'leitura');set role authenticated;
select ok((select count(*) from marca_vinculos)=14,'membro lê o catálogo de vínculos');
do $$begin
 begin insert into marca_vinculos(chave) values('invasao');raise exception 'escrita indevida';
 exception when insufficient_privilege then perform ok(true,'membro não modifica vínculos');end;
end $$;
select eu(4,'admin');
update marca_vinculos set serie_id=(select id from doc_series where prefixo='PUB' and sn=2) where chave='carta';
select ok((select atualizado_por is not null from marca_vinculos where chave='carta'),'admin configura e registra autoria');
select eu(46,'x');
select ok((select count(*) from marca_vinculos)=0,'conta bloqueada não lê Marca');
reset role;
insert into feed_itens(id,autor,titulo,subtitulo,texto,publicado_em)
select ('00000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,4,'Item '||i,'Subtítulo','Texto',now() from generate_series(1,25)i;
select eu(11,'leitura');set role authenticated;
select ok(jsonb_array_length(feed_lista(null,20))=20,'primeira página limitada');
select ok(jsonb_array_length(feed_lista(now(),20,'00000000-0000-0000-0000-000000000006'))=5,'cursor inclui empates sem perder itens');
select ok(not has_function_privilege('authenticated','public.reporte_ciclo_materializar()','execute'),'materialização interna não fica aberta');
select ok(not has_function_privilege('anon','public.newsletter_lote(integer)','execute'),'lote não fica aberto');
reset role;
rollback;
