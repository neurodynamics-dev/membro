\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 30.0 — os e-mails programados e as pílulas.
-- Rode num banco com o esqueleto, o de Storage e a 15.0 à 19.0; o teste
-- aplica a 30.0.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), false);
  perform set_config('teste.papel', p_papel, false);
end $$;

\ir ../v30_emails.sql
-- de novo: a migração é idempotente (as pílulas não se repetem)
\ir ../v30_emails.sql

-- um grupo abaixo de Órtese, e a Carla nele (pela ficha, só no de baixo)
do $$ begin
  if not exists (select 1 from grupos where nome = 'Órtese / Firmware') then
    insert into grupos (nome, prefixo, pai_id) select 'Órtese / Firmware', 'OFW', id from grupos where nome = 'Órtese';
  end if;
end $$;
update membros set grupos = array['Órtese / Firmware'] where registro = 17;
update membros set email_nro = null, email_pessoal = null where registro = 23;

do $$
declare r jsonb; v_id uuid; v_ortese integer := (select id from grupos where nome = 'Órtese'); v_lote jsonb;
begin
  raise notice 'As pílulas';
  perform ok((select count(*) from email_roteiros where codigo ~ '^PIL-(0[1-9]|1[0-6])$') = 16, 'dezesseis roteiros prontos, sem repetir');
  perform ok((select count(distinct remetente) from email_roteiros where codigo ~ '^PIL-(0[1-9]|1[0-6])$') = 6, 'os seis remetentes, com a Leadership');
  perform ok(not exists (select 1 from email_roteiros where corpo !~ '\{\{primeiro_nome\}\}'), 'todos começam pelo primeiro nome');
  perform ok(not exists (select 1 from email_roteiros where corpo ~ ' — ' or titulo ~ ' — '), 'sem travessão nas frases');

  raise notice 'Programar';
  perform eu(11, 'leitura');
  perform ok(email_programar('{"assunto":"x","html":"<p>x</p>","remetente_nome":"P&D","todos":true,"enviar_em":"2030-01-01T12:00:00Z"}')->>'status' = 'sem_permissao',
    'quem não é da gestão não programa');
  perform ok(email_destinatarios('{"todos":true}')->>'status' = 'sem_permissao', 'nem vê o destino');
  perform eu(31, 'pessoal');
  r := email_destinatarios('{"todos":true}');
  perform ok((r->>'total')::int = 4 and (r->>'sem_email')::int = 1 and r->'sem_email_nomes' ? 'Diego Prado',
    'a equipe toda: quatro com e-mail e o Diego sem');
  r := email_destinatarios(jsonb_build_object('grupos', jsonb_build_array(v_ortese)));
  perform ok((r->>'total')::int = 2, 'o grupo conta quem está no grupo de baixo (a Carla, pelo Firmware)');
  perform ok(email_programar('{"assunto":"x","html":"<p>x</p>","remetente_nome":"P&D","enviar_em":"2030-01-01T12:00:00Z"}')->>'campo' = 'destino',
    'sem destino não programa');
  perform ok(email_programar('{"assunto":"x","html":"<p>x</p>","remetente_nome":"P&D","todos":true,"enviar_em":"2020-01-01T12:00:00Z"}')->>'campo' = 'enviar_em',
    'no passado não programa');
  r := email_programar(jsonb_build_object('itens', jsonb_build_array(
    jsonb_build_object('assunto','Placar','html','<p>Olá, {{primeiro_nome}}.</p>','texto','Olá, {{primeiro_nome}}.','remetente','pessoal',
      'remetente_nome','Departamento de Pessoal | NeuroDynamics','todos',true,'enviar_em', now() - interval '1 minute',
      'roteiro_id', (select id from email_roteiros where codigo = 'PIL-01')),
    jsonb_build_object('assunto','OKRs','html','<p>x</p>','remetente','leadership','remetente_nome','Leadership | NeuroDynamics',
      'grupos', jsonb_build_array(v_ortese),'enviar_em', now() + interval '4 days'))));
  perform ok(r->>'status' = 'ok' and jsonb_array_length(r->'ids') = 2, 'programa vários de uma vez');
  perform ok((select criado_por from email_programados where assunto = 'Placar') = 'Elis Ramalho', 'e guarda quem programou');
  v_id := (select id from email_programados where assunto = 'OKRs');
  r := email_programar(jsonb_build_object('id', v_id, 'assunto','OKRs e agenda','html','<p>y</p>','remetente','leadership',
    'remetente_nome','Leadership | NeuroDynamics','grupos', jsonb_build_array(v_ortese),'enviar_em', now() + interval '8 days'));
  perform ok(r->>'status' = 'ok' and (select assunto from email_programados where id = v_id) = 'OKRs e agenda', 'reagendar edita o programado');

  raise notice 'A fila';
  v_lote := email_programados_lote(10);
  perform ok(jsonb_array_length(v_lote) = 1 and v_lote->0->>'assunto' = 'Placar', 'a fila só traz o que venceu');
  perform ok(jsonb_array_length(v_lote->0->'destinatarios') = 4
    and not exists (select 1 from jsonb_array_elements(v_lote->0->'destinatarios') d where d->>'nome' = 'Diego Prado'),
    'com quem recebe, sem quem não tem e-mail');
  perform ok(v_lote->0->>'remetente_nome' = 'Departamento de Pessoal | NeuroDynamics', 'e o nome do remetente');
  perform ok(jsonb_array_length(email_programados_lote(10)) = 0, 'pegar marca "enviando": a segunda execução não repete');
  r := email_programados_baixa(jsonb_build_object('id', v_lote->0->>'id', 'enviados', 4, 'falhas', 0));
  perform ok(r->>'status' = 'ok' and (select status from email_programados where assunto = 'Placar') = 'enviado', 'a baixa fecha como enviado');
  r := email_programado_cancelar(v_id);
  perform ok(r->>'status' = 'ok' and (select status from email_programados where id = v_id) = 'cancelado', 'cancelar o programado');
  perform ok(email_programado_cancelar(v_id)->>'status' = 'nao_encontrado', 'cancelado não cancela de novo');
end $$;

-- a tabela não aceita escrita direta; os roteiros, só da gestão
select eu(11, 'leitura');
set role authenticated;
do $$
begin
  perform ok((select count(*) from email_programados) = 0, 'quem não é da gestão não lê os programados');
  perform ok((select count(*) from email_roteiros) = 0, 'nem os roteiros');
  begin
    insert into email_roteiros (codigo, remetente, assunto, titulo, corpo) values ('X', 'pd', 'x', 'x', 'x');
    raise exception 'FALHOU: leitura criou roteiro';
  exception when insufficient_privilege then perform ok(true, 'e não cria roteiro'); end;
end $$;
reset role;
select eu(31, 'pessoal');
set role authenticated;
do $$
begin
  begin
    insert into email_programados (assunto, remetente, remetente_nome, html, enviar_em) values ('x','pd','x','<p>x</p>', now());
    raise exception 'FALHOU: escreveu direto em email_programados';
  exception when insufficient_privilege then perform ok(true, 'nem a gestão escreve direto nos programados'); end;
  insert into email_roteiros (codigo, remetente, assunto, titulo, corpo, cta_link) values ('PIL-99', 'leadership', 'x', 'x', 'Olá, {{primeiro_nome}}.', '#/okrs');
  perform ok(exists (select 1 from email_roteiros where codigo = 'PIL-99'), 'a gestão cria roteiro');
  begin
    insert into email_roteiros (codigo, remetente, assunto, titulo, corpo) values ('PIL-98', 'diretoria', 'x', 'x', 'x');
    raise exception 'FALHOU: aceitou remetente desconhecido';
  exception when check_violation then perform ok(true, 'remetente desconhecido é recusado'); end;
end $$;
reset role;

do $$ begin perform ok((select count(*) from migracoes where id = 'v30_emails') = 1, 'registra a migração'); end $$;
