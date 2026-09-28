\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 28.0 — a agenda no modelo do Google Agenda.
-- Rode num banco com o esqueleto, o de Storage, a 15.0 a 19.0, o
-- esqueleto da agenda e a 28.0.
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
create or replace function gid(p_nome text) returns integer language sql as $$ select id from grupos where nome = p_nome $$;
create or replace function resp(p_ev uuid, p_reg integer) returns text language sql as $$
  select resposta from evento_participantes where evento_id = p_ev and registro = p_reg $$;
create or replace function fila(p_ev uuid, p_tipo text) returns text language sql as $$
  select coalesce(string_agg(para_email, ',' order by para_email), '') from agenda_envios
   where evento_id = p_ev and tipo = p_tipo and enviado_em is null $$;

-- A equipe: 4 Ana (admin, Órtese e Gestão), 11 Bruno (Sinais), 17 Carla
-- (Órtese), 23 Diego (Comunicação), 31 Elis (Depto de Pessoal).
-- Sinais fica dentro de Órtese: quem convida Órtese convida o Bruno.
update grupos set pai_id = gid('Órtese') where nome = 'Sinais';
update membros set email_pessoal = 'bruno.pessoal@gmail.com', email_nro = null where registro = 11;
update membros set email_nro = null, email_pessoal = null where registro = 23;   -- o Diego não tem e-mail

do $$
declare
  r jsonb; v_ev uuid; v_tok uuid; v_serie uuid; v_n integer; v_d date := current_date + 10;
begin
  raise notice 'Criar';
  perform eu(17, 'leitura');
  r := agenda_evento_salvar(jsonb_build_object(
    'titulo', 'Revisão do protótipo', 'data', v_d, 'hora_inicio', '14:00', 'hora_fim', '15:00',
    'local', 'Sala 2', 'descricao', 'Levar a órtese', 'lembretes', jsonb_build_array(30, 1440),
    'grupos', jsonb_build_array(gid('Órtese')), 'obrigatorios', jsonb_build_array(23),
    'externos', jsonb_build_array(jsonb_build_object('email','Cliente@Hospital.org','nome','Dra. Lima'),
                                  jsonb_build_object('email','nao-e-email'))));
  perform ok(r->>'status' = 'ok', 'cria o evento');
  v_ev := (r->>'id')::uuid;
  perform ok((select array_agg(registro order by registro) from evento_participantes where evento_id = v_ev) = '{4,11,17,23}',
    'convidados: o grupo (com o subgrupo), a pessoa e quem organiza');
  perform ok(resp(v_ev, 17) = 'vou' and resp(v_ev, 4) = 'pendente', 'quem organiza já vai; os outros, pendentes');
  perform ok((select count(distinct token) from evento_participantes where evento_id = v_ev) = 4, 'cada convite tem o seu token');
  perform ok((select email from evento_externos where evento_id = v_ev) = 'cliente@hospital.org', 'o de fora entra com o e-mail em minúsculas; o que não é e-mail, não');
  perform ok(fila(v_ev, 'convite') = 'ana@nro.dev,bruno.pessoal@gmail.com,cliente@hospital.org',
    'convite por e-mail: a quem tem endereço, ao de fora, e nunca a quem organizou');
  perform ok((select dados->>'quando' from agenda_envios where evento_id = v_ev limit 1) like '%, das 14:00 às 15:00',
    'o e-mail diz quando, por extenso');
  perform ok((select count(*) from notificacoes where tipo = 'agenda_convite' and registro in (4,11,23) and email_em is not null) = 3,
    'o sino avisa os três, sem repetir o e-mail');
  perform ok((select lembretes from eventos where id = v_ev) = '{30,1440}', 'os lembretes ficam no evento');

  raise notice 'Ler';
  perform eu(31, 'leitura');
  perform ok(agenda_evento(v_ev)->>'status' = 'nao_encontrado', 'quem não foi convidado não lê um evento de convidados');
  perform eu(11, 'leitura');
  r := agenda_evento(v_ev);
  perform ok(r->>'status' = 'ok' and (r->>'pode_editar')::boolean = false and r->>'minha_resposta' = 'pendente'
    and jsonb_array_length(r->'participantes') = 4, 'o convidado lê, com a lista e a própria resposta, e não edita');
  perform ok(r->'externos'->0->>'email' is null and r->'externos'->0->>'nome' = 'Dra. Lima',
    'o e-mail do de fora só quem edita vê');
  perform eu(31, 'pessoal');
  perform ok((agenda_evento(v_ev)->>'pode_editar')::boolean, 'o Depto. de Pessoal lê e edita');

  raise notice 'Responder';
  perform eu(11, 'leitura');
  perform ok(agenda_responder(v_ev, 'talvez')->>'status' = 'ok' and resp(v_ev, 11) = 'talvez', 'responder pelo portal');
  perform ok((select count(*) from notificacoes where registro = 17 and tipo = 'agenda_resposta') = 1, 'quem organiza é avisado no sino');
  perform eu(31, 'leitura');
  perform ok(agenda_responder(v_ev, 'vou')->>'status' = 'nao_convidado', 'quem não foi convidado não responde');

  select token into v_tok from evento_participantes where evento_id = v_ev and registro = 4;
  perform eu(null, 'leitura');
  r := agenda_rsvp_token(v_tok, null);
  perform ok(r->>'status' = 'ok' and r->>'resposta' = 'pendente' and r->>'nome' = 'Ana' and r->>'titulo' = 'Revisão do protótipo',
    'o link do e-mail, sem resposta, só mostra o evento');
  r := agenda_rsvp_token(v_tok, 'nao');
  perform ok(r->>'resposta' = 'nao' and resp(v_ev, 4) = 'nao', 'e com a resposta, responde — sem login');
  select token into v_tok from evento_externos where evento_id = v_ev;
  r := agenda_rsvp_token(v_tok, 'vou');
  perform ok(r->>'membro' = 'false' and (select resposta from evento_externos where evento_id = v_ev) = 'vou',
    'o de fora responde pelo token dele');
  perform ok(agenda_rsvp_token(gen_random_uuid(), 'vou')->>'status' = 'nao_encontrado', 'token que não existe não acha nada');
  perform ok(agenda_rsvp_token(v_tok, 'depois')->>'status' = 'invalido', 'resposta fora das três é recusada');

  raise notice 'Reagendar';
  perform eu(11, 'leitura');
  perform ok(agenda_evento_salvar(jsonb_build_object('id', v_ev, 'data', v_d + 1))->>'status' = 'sem_permissao',
    'o convidado não reagenda');
  perform eu(17, 'leitura');
  delete from agenda_envios;
  r := agenda_evento_salvar(jsonb_build_object('id', v_ev, 'data', v_d + 1, 'hora_inicio', '15:00', 'hora_fim', '16:30'));
  perform ok(r->>'status' = 'ok' and (select data from eventos where id = v_ev) = v_d + 1
    and (select hora_fim from eventos where id = v_ev) = '16:30', 'reagendar muda o dia e o horário do mesmo evento');
  perform ok(r->'mudou' = '["data","horário"]'::jsonb, 'e diz o que mudou');
  perform ok(fila(v_ev, 'alteracao') = 'bruno.pessoal@gmail.com,cliente@hospital.org',
    'a alteração vai a quem não recusou (a Ana disse que não vai)');
  perform ok(resp(v_ev, 11) = 'talvez', 'a resposta de quem já respondeu continua');
  perform ok((select titulo from eventos where id = v_ev) = 'Revisão do protótipo', 'o que não veio no pedido não muda');

  raise notice 'Mexer nos convidados';
  delete from agenda_envios;
  r := agenda_evento_salvar(jsonb_build_object('id', v_ev, 'obrigatorios', jsonb_build_array(11, 31), 'opcionais', jsonb_build_array(4),
    'externos', jsonb_build_array(jsonb_build_object('email','cliente@hospital.org'), jsonb_build_object('email','novo@parceiro.com'))));
  perform ok((select array_agg(registro order by registro) from evento_participantes where evento_id = v_ev) = '{4,11,17,31}',
    'a lista nova é a lista inteira: o Diego sai, a Elis entra');
  perform ok((select papel from evento_participantes where evento_id = v_ev and registro = 4) = 'opcional', 'a Ana vira opcional');
  perform ok(fila(v_ev, 'convite') = 'elis@nro.dev,novo@parceiro.com', 'quem entrou recebe o convite');
  perform ok(fila(v_ev, 'cancelamento') = '', 'o Diego sai sem e-mail (não tem endereço)');
  perform ok(fila(v_ev, 'alteracao') = '', 'mexer só nos convidados não manda "alterado" a ninguém');

  raise notice 'Lembretes';
  delete from agenda_envios;
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Daily', 'data', current_date,
    'hora_inicio', to_char((now() at time zone 'America/Sao_Paulo') + interval '20 minutes', 'HH24:MI'),
    'lembretes', jsonb_build_array(30, 10), 'obrigatorios', jsonb_build_array(4, 11), 'notificar', false));
  v_ev := (r->>'id')::uuid;
  perform ok(fila(v_ev, 'convite') = '', '"notificar": false não manda convite');
  update evento_participantes set convidado_em = now() - interval '1 hour' where evento_id = v_ev;
  perform ok(jsonb_array_length(agenda_envios_lote(100)) = 3, 'o de 30 minutos já venceu: um lembrete para cada convidado, e para quem organiza');
  perform ok(jsonb_array_length(agenda_envios_lote(100)) = 3, 'o mesmo lembrete não entra duas vezes na fila');
  perform agenda_envios_baixa(jsonb_build_object('enviados', (select jsonb_agg(id) from agenda_envios)));
  perform ok(jsonb_array_length(agenda_envios_lote(100)) = 0, 'dar baixa tira da fila');
  update eventos set lembretes = '{60}' where id = v_ev;
  update evento_participantes set convidado_em = now() where evento_id = v_ev;
  perform ok(jsonb_array_length(agenda_envios_lote(100)) = 0, 'lembrete que venceu antes do convite não sai');
  insert into agenda_preferencias (registro, emails) values (4, false);
  update evento_participantes set convidado_em = now() - interval '2 hours' where evento_id = v_ev;
  perform ok((select string_agg(para_email, ',' order by para_email) from jsonb_to_recordset(agenda_envios_lote(100)) as x(para_email text)) = 'bruno.pessoal@gmail.com,carla@nro.dev',
    'quem desligou os e-mails da agenda não recebe o lembrete');

  raise notice 'Série';
  perform eu(17, 'leitura');
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Reunião do grupo', 'data', current_date + 7,
    'hora_inicio', '10:00', 'hora_fim', '11:00', 'recorrencia', 'Semanal', 'repetir_ate', current_date + 35,
    'obrigatorios', jsonb_build_array(4), 'notificar', false));
  v_serie := (r->>'id')::uuid;
  perform ok((r->>'ocorrencias')::int = 4 and (select count(*) from eventos where serie_id = v_serie) = 5,
    'semanal por cinco semanas: cinco encontros de verdade');
  select id into v_ev from eventos where serie_id = v_serie order by data offset 2 limit 1;
  r := agenda_evento_salvar(jsonb_build_object('id', v_ev, 'aplicar', 'seguintes', 'hora_inicio', '11:00', 'hora_fim', '12:00',
    'data', current_date + 22, 'notificar', false));
  perform ok((r->>'eventos')::int = 3, 'este e os seguintes: três encontros');
  perform ok((select count(*) from eventos where serie_id = v_serie and hora_inicio = '11:00') = 3
    and (select count(*) from eventos where serie_id = v_serie and hora_inicio = '10:00') = 2, 'os anteriores continuam às 10h');
  perform ok((select array_agg(data - current_date order by data) from eventos where serie_id = v_serie) = '{7,14,22,29,36}',
    'e os três andaram um dia');
  r := agenda_evento_excluir(jsonb_build_object('id', v_ev, 'aplicar', 'seguintes', 'notificar', false));
  perform ok((r->>'eventos')::int = 3 and (select count(*) from eventos where serie_id = v_serie and status = 'Cancelado') = 3,
    'excluir este e os seguintes cancela três');
  perform ok((select bool_and(serie_ate = current_date + 21) from eventos where serie_id = v_serie), 'e a série termina antes deste');
  perform ok(agenda_manter_series(120) = 0, 'esticar o horizonte não recria o que foi cancelado');

  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Plantão', 'data', date_trunc('week', current_date)::date + 7,
    'recorrencia', 'Dias úteis', 'repetir_ate', date_trunc('week', current_date)::date + 20, 'notificar', false));
  v_serie := (r->>'id')::uuid;
  perform ok((select count(*) from eventos where serie_id = v_serie) = 10
    and not exists (select 1 from eventos where serie_id = v_serie and extract(isodow from data) > 5),
    'dias úteis: duas semanas, dez dias, nenhum fim de semana');
  select id into v_ev from eventos where serie_id = v_serie order by data offset 5 limit 1;
  perform agenda_evento_salvar(jsonb_build_object('id', v_ev, 'recorrencia', 'Única', 'notificar', false));
  perform ok((select count(*) from eventos where serie_id = v_serie and coalesce(status,'') <> 'Cancelado') = 5
    and (select serie_id from eventos where id = v_ev) is null,
    'mudar a repetição para "não repete": este fica sozinho e os de depois saem');

  raise notice 'Evento de vários dias e a leitura da agenda';
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Congresso', 'data', current_date + 40, 'data_fim', current_date + 43,
    'dia_inteiro', true, 'visibilidade', 'equipe', 'predefinido_id', (select id from agenda_predefinidos where nome = 'Teste'),
    'notificar', false));
  v_ev := (r->>'id')::uuid;
  perform eu(23, 'leitura');
  perform ok((select data_fim from agenda_itens(current_date + 41, current_date + 41) where ref = v_ev) = current_date + 43,
    'o evento de vários dias aparece no meio do período, com o fim');
  perform ok((select cor from agenda_itens(current_date + 40, current_date + 40) where ref = v_ev) = '#F5C36A',
    'e com a cor do predefinido');
  perform ok((select dia_inteiro from agenda_itens(current_date + 40, current_date + 40) where ref = v_ev), 'dia inteiro');
  perform ok(agenda_evento_salvar(jsonb_build_object('data', current_date, 'hora_inicio', '10:00', 'hora_fim', '09:00'))->>'campo' = 'horario',
    'fim antes do começo é recusado');
  perform ok(agenda_evento_salvar(jsonb_build_object('data', current_date, 'recorrencia', 'Às vezes'))->>'campo' = 'recorrencia',
    'repetição que não existe é recusada');

  raise notice 'Cancelar';
  perform eu(17, 'leitura');
  select id into v_ev from eventos where titulo = 'Revisão do protótipo';
  delete from agenda_envios;
  perform ok(agenda_evento_excluir(jsonb_build_object('id', v_ev))->>'status' = 'ok', 'quem organiza cancela');
  perform ok(fila(v_ev, 'cancelamento') = 'bruno.pessoal@gmail.com,cliente@hospital.org,elis@nro.dev,novo@parceiro.com',
    'o cancelamento vai a quem não tinha recusado');
  select token into v_tok from evento_participantes where evento_id = v_ev and registro = 11;
  r := agenda_rsvp_token(v_tok, 'vou');
  perform ok(r->>'status' = 'cancelado' and resp(v_ev, 11) = 'talvez', 'responder um evento cancelado não muda nada');
  perform eu(23, 'leitura');
  perform ok(not exists (select 1 from agenda_itens(current_date, current_date + 60) where ref = v_ev), 'e ele some da agenda');
end $$;

-- ------------------------------------------------------------
-- As portas: a chave anônima só responde pelo token; os predefinidos
-- só a gestão escreve.
-- ------------------------------------------------------------
do $$
begin
  perform ok(has_function_privilege('anon', 'public.agenda_rsvp_token(uuid, text)', 'execute'), 'anon responde pelo token');
  perform ok(not has_function_privilege('anon', 'public.agenda_evento_salvar(jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.agenda_evento(uuid)', 'execute'), 'e só isso');
  perform ok(not has_function_privilege('authenticated', 'public.agenda_envios_lote(integer)', 'execute'),
    'a fila de e-mail não se lê pela sessão');
end $$;

select eu(23, 'leitura');
set role authenticated;
do $$
begin
  begin
    insert into agenda_predefinidos (nome) values ('Pelada');
    raise exception 'FALHOU: leitura criou predefinido';
  exception when insufficient_privilege then
    perform ok(true, 'quem não é da gestão não cria evento predefinido');
  end;
end $$;
reset role;
select eu(31, 'pessoal');
set role authenticated;
insert into agenda_predefinidos (nome, lembretes, grupos) values ('Pelada', '{60}', array[1]);
reset role;
do $$ begin perform ok(exists (select 1 from agenda_predefinidos where nome = 'Pelada'), 'o Depto. de Pessoal cria'); end $$;

do $$ begin
  perform ok((select count(*) from migracoes where id = 'v28_agenda') = 1, 'registra a migração');
end $$;
