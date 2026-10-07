\set ON_ERROR_STOP on
begin;
insert into agenda_predefinidos(nome,gera_ata) values('Ata de teste',true) returning id as predef \gset
insert into eventos(titulo,data,hora_inicio,hora_fim,local,owner_registro,predefinido_id)
values('Reunião de bancada',current_date,'10:00','11:00','LABBIO',4,:'predef') returning id as evento \gset
insert into evento_participantes(evento_id,registro,resposta) values(:'evento',4,'vou');
select eu(4,'admin');set role authenticated;
select evento_ata_abrir(:'evento')->>'codigo' as codigo \gset
select ok(:'codigo' like 'NRO-PUB-003-%','ata recebe PN da série');
select ok(evento_ata_abrir(:'evento')->>'codigo'=:'codigo','reabrir preserva o PN');
reset role;
select ok((select dados->>'local'='LABBIO' and dados->>'assunto'='Reunião de bancada' from doc_formulario_rascunhos
 where arquivo_id=(select id from doc_arquivos where codigo=:'codigo')),'rascunho nasce preenchido');
select ok((select jsonb_array_length(dados->'presentes')=1 from doc_formulario_rascunhos
 where arquivo_id=(select id from doc_arquivos where codigo=:'codigo')),'participantes entram no rascunho');
set role authenticated;select eu(42,'x');
select ok(evento_ata_abrir(:'evento')->>'status'='sem_permissao','liderança não convidada não abre ata');
reset role;rollback;
