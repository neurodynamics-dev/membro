\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 31.0 — as entrevistas online e os e-mails do PS.
-- Rode num banco com o esqueleto, o de Storage e o do processo
-- seletivo (esqueleto_ps.sql, que aplica a 6.0 e a 7.0); o teste
-- aplica a 31.0 duas vezes.
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

-- uma entrevista aberta antes da 31.0: com local, sem link, sem responsável
insert into ps_edicoes (id, nome, slug, status, inscricoes_inicio, inscricoes_fim)
values ('00000000-0000-0000-0000-00000000ed01', 'PS de teste', 'ps-teste', 'publicada', current_date - 30, current_date - 10);
insert into ps_slots (id, edicao_id, fase, data, hora_inicio, hora_fim, local)
values ('00000000-0000-0000-0000-0000000000a0', '00000000-0000-0000-0000-00000000ed01', 'entrevista',
        current_date + 3, '10:00', '10:30', 'LABBIO');

\ir ../v31_ps_entrevistas.sql
\ir ../v31_ps_entrevistas.sql

-- a publicação do resultado da dinâmica: é ela que libera a entrevista para o candidato
insert into ps_publicacoes (edicao_id, tipo, titulo, publicado)
values ('00000000-0000-0000-0000-00000000ed01', 'resultado_dinamica', 'Resultado da 1ª fase', true);
insert into ps_candidatos (id, edicao_id, protocolo, status, nome, email, telefone, curso, instituicao, periodo,
                           areas_interesse, motivacao, lattes, github)
values
  ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000ed01', 'PS26-0001', 'aprovado_dinamica',
   'Lia Moreira', 'lia@exemplo.com', '31 99999-0001', 'Engenharia Biomédica', 'UFMG', '5º',
   '{Órtese,Sinais}', 'Quero trabalhar com reabilitação.', 'http://lattes.cnpq.br/1', 'https://github.com/lia'),
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000ed01', 'PS26-0002', 'aprovado_dinamica',
   'Rui Campos', 'rui@exemplo.com', null, 'Engenharia Elétrica', 'UFMG', '3º', '{Sinais}', null, null, null);
insert into ps_avaliacoes (candidato_id, fase, nota, recomendacao, avaliador_id, avaliador)
values ('00000000-0000-0000-0000-0000000000c1', 'dinamica', 4.5, 'aprovar', gen_random_uuid(), 'Ana'),
       ('00000000-0000-0000-0000-0000000000c1', 'dinamica', 3.5, 'em_duvida', gen_random_uuid(), 'Bruno');

do $$
declare r jsonb; v_s1 uuid; v_s2 uuid; v_s3 uuid; v_ag uuid; v_lote jsonb; v_n integer;
  v_amanha date := (now() at time zone 'America/Sao_Paulo')::date + 1;
begin
  raise notice 'Quem abriu e o link';
  perform eu(4, 'selecao');
  begin
    insert into ps_slots (edicao_id, fase, data, hora_inicio, hora_fim) values
      ('00000000-0000-0000-0000-00000000ed01', 'entrevista', v_amanha, '14:00', '14:30');
    raise exception 'FALHOU: entrevista sem link entrou';
  exception when check_violation then perform ok(true, 'entrevista nova sem link não entra'); end;
  begin
    insert into ps_slots (edicao_id, fase, data, hora_inicio, hora_fim, link_reuniao) values
      ('00000000-0000-0000-0000-00000000ed01', 'entrevista', v_amanha, '14:00', '14:30', 'meet.google.com/abc');
    raise exception 'FALHOU: link sem https entrou';
  exception when check_violation then perform ok(true, 'link sem https:// não entra'); end;
  insert into ps_slots (edicao_id, fase, data, hora_inicio, hora_fim, link_reuniao) values
    ('00000000-0000-0000-0000-00000000ed01', 'entrevista', v_amanha, '14:00', '14:30', 'https://meet.google.com/abc-defg-hij'),
    ('00000000-0000-0000-0000-00000000ed01', 'entrevista', v_amanha, '14:30', '15:00', 'https://meet.google.com/abc-defg-hij');
  select id into v_s1 from ps_slots where hora_inicio = '14:00';
  select id into v_s2 from ps_slots where hora_inicio = '14:30';
  perform ok((select criado_por from ps_slots where id = v_s1) = 'Ana Figueiredo'
             and (select criado_por_registro from ps_slots where id = v_s1) = 4, 'o horário guarda quem abriu a janela');
  insert into ps_slots (edicao_id, fase, data, hora_inicio, hora_fim, local, capacidade) values
    ('00000000-0000-0000-0000-00000000ed01', 'dinamica', v_amanha, '18:00', '19:30', 'LABBIO', 8);
  perform ok(true, 'a dinâmica continua presencial, sem link');
  update ps_slots set ativo = false where id = '00000000-0000-0000-0000-0000000000a0';
  update ps_slots set ativo = true where id = '00000000-0000-0000-0000-0000000000a0';
  perform ok(true, 'o horário antigo, sem link, ainda se desativa e reativa');

  raise notice 'O site';
  perform eu(null, 'leitura');
  r := ps_horarios('PS26-0001', 'lia@exemplo.com');
  perform ok(r->>'status' = 'ok' and (select bool_and((x->>'online')::boolean) from jsonb_array_elements(r->'slots') x
                                      where x->>'id' in (v_s1::text, v_s2::text))
             and not (r::text ~ 'meet.google.com'), 'os horários dizem que são online, sem mostrar o link antes da reserva');
  r := ps_agendar('PS26-0001', 'lia@exemplo.com', v_s1);
  perform ok(r->>'status' = 'ok' and r->>'link' = 'https://meet.google.com/abc-defg-hij' and (r->>'email')::boolean,
    'reservar devolve o link e avisa que o e-mail vai');
  perform ok((select count(*) from ps_envios where tipo = 'confirmacao' and candidato_id = '00000000-0000-0000-0000-0000000000c1') = 1,
    'a reserva põe a confirmação na fila');
  perform ok((select dados->>'link' = 'https://meet.google.com/abc-defg-hij' and dados->>'responsavel' = 'Ana Figueiredo'
                     and assunto = 'Entrevista confirmada: ' || to_char(v_amanha, 'DD/MM') || ', 14:00'
                from ps_envios where tipo = 'confirmacao'), 'com o link, quem conduz e o assunto com dia e hora');
  r := ps_agendar('PS26-0001', 'lia@exemplo.com', v_s1);
  perform ok(r->>'status' = 'ok' and not (r->>'email')::boolean
             and (select count(*) from ps_envios where tipo = 'confirmacao') = 1, 'manter o mesmo horário não manda outro e-mail');
  r := ps_acompanhar('PS26-0001', 'lia@exemplo.com');
  perform ok(r->'agendamentos'->0->>'link' = 'https://meet.google.com/abc-defg-hij'
             and (r->'agendamentos'->0->>'online')::boolean and r->'agendamentos'->0->>'responsavel' = 'Ana Figueiredo',
    'o acompanhamento mostra o link da chamada');
  r := ps_agendar('PS26-0002', 'rui@exemplo.com', v_s1);
  perform ok(r->>'status' = 'lotado', 'horário de uma vaga lota');
  r := ps_agendar('PS26-0002', 'rui@exemplo.com', v_s2);
  perform ok(r->>'status' = 'ok', 'o segundo candidato fica às 14:30');

  raise notice 'O comitê reagenda';
  perform eu(11, 'leitura');
  select id into v_ag from ps_agendamentos where candidato_id = '00000000-0000-0000-0000-0000000000c1';
  perform ok(ps_reagendar(v_ag, v_s2)->>'status' = 'sem_permissao', 'quem não é do comitê não reagenda');
  perform ok(ps_slot_editar(v_s1, '{"hora_inicio":"15:00","hora_fim":"15:30"}')->>'status' = 'sem_permissao', 'nem edita o horário');
  perform eu(4, 'selecao');
  perform ok(ps_reagendar(v_ag, v_s2)->>'status' = 'lotado', 'não move para horário cheio');
  insert into ps_slots (edicao_id, fase, data, hora_inicio, hora_fim, link_reuniao) values
    ('00000000-0000-0000-0000-00000000ed01', 'entrevista', v_amanha, '16:00', '16:30', 'https://meet.google.com/xyz-abcd-efg');
  select id into v_s3 from ps_slots where hora_inicio = '16:00';
  r := ps_reagendar(v_ag, v_s3, 'Imprevisto na agenda do entrevistador');
  perform ok(r->>'status' = 'ok' and (select slot_id from ps_agendamentos where id = v_ag) = v_s3
             and (select reagendado_por from ps_agendamentos where id = v_ag) = 'Ana Figueiredo', 'mover o candidato registra quem moveu');
  perform ok((select dados->'antes'->>'hora_inicio' = '14:00' and dados->>'hora_inicio' = '16:00'
                     and dados->>'link' = 'https://meet.google.com/xyz-abcd-efg' and dados->>'motivo' = 'Imprevisto na agenda do entrevistador'
                from ps_envios where tipo = 'reagendamento'), 'e o e-mail leva o horário antigo, o novo, o link e o motivo');

  r := ps_slot_editar(v_s2, '{"hora_inicio":"17:00","hora_fim":"17:30","motivo":"Sala remarcada"}');
  perform ok(r->>'status' = 'ok' and (r->>'avisados')::int = 1
             and (select count(*) from ps_envios where tipo = 'reagendamento' and candidato_id = '00000000-0000-0000-0000-0000000000c2') = 1,
    'mudar a hora do horário avisa quem está nele');
  r := ps_slot_editar(v_s2, '{"link_reuniao":"https://meet.google.com/nov-link-abc"}');
  perform ok(r->>'status' = 'ok' and (select count(*) from ps_envios where tipo = 'link') = 1, 'trocar só o link manda o aviso do link');
  perform ok(ps_slot_editar(v_s2, '{"link_reuniao":""}')->>'campo' = 'link_reuniao', 'entrevista não fica sem link');
  perform ok(ps_slot_editar(v_s2, '{"hora_inicio":"18:00","hora_fim":"17:00"}')->>'campo' = 'hora_fim', 'fim antes do início é recusado');
  perform ok(ps_slot_editar(v_s2, '{"hora_inicio":"17:00","hora_fim":"17:30"}')->>'avisados' = '0', 'sem mudança, ninguém é avisado');

  r := ps_slot_editar('00000000-0000-0000-0000-0000000000a0',
               '{"link_reuniao":"https://meet.google.com/ant-igoo-abc","assumir":true}');
  perform ok(r->>'status' = 'ok'
             and (select criado_por from ps_slots where id = '00000000-0000-0000-0000-0000000000a0') = 'Ana Figueiredo',
    'o horário antigo ganha link e responsável');

  raise notice 'O resumo da véspera';
  v_n := public._ps_resumos(((v_amanha - 1) + time '17:00') at time zone 'America/Sao_Paulo');
  perform ok(v_n = 0, 'antes das 18h, nada');
  v_n := public._ps_resumos(((v_amanha - 1) + time '18:05') at time zone 'America/Sao_Paulo');
  perform ok(v_n = 1, 'às 18h, um resumo para quem abriu os horários');
  perform ok((select jsonb_array_length(dados->'itens') = 2
                     and dados->'itens'->0->>'hora_inicio' = '16:00'
                     and dados->'itens'->0->'candidato'->>'nome' = 'Lia Moreira'
                     and dados->'itens'->0->'candidato'->>'github' = 'https://github.com/lia'
                     and dados->'itens'->0->>'link' = 'https://meet.google.com/xyz-abcd-efg'
                     and (dados->'itens'->0->'dinamica'->>'nota')::numeric = 4.0
                     and dados->'itens'->0->>'href' = '#/selecao/candidatos/00000000-0000-0000-0000-0000000000c1'
                     and para_email = 'ana@nro.dev' and assunto = 'Entrevistas de amanhã: 2'
                from ps_envios where tipo = 'resumo'), 'com as duas entrevistas, na ordem, com o perfil, a dinâmica e o link');
  perform ok(public._ps_resumos(((v_amanha - 1) + time '19:00') at time zone 'America/Sao_Paulo') = 0, 'e não repete');
  delete from ps_agendamentos where candidato_id = '00000000-0000-0000-0000-0000000000c2';
  v_n := public._ps_resumos(((v_amanha - 1) + time '20:00') at time zone 'America/Sao_Paulo');
  perform ok(v_n = 1 and (select count(*) from ps_envios where tipo = 'resumo' and assunto = 'Entrevistas de amanhã (atualizado): 1') = 1,
    'se a lista muda, sai um resumo atualizado');

  raise notice 'Excluir e a fila';
  r := ps_slot_excluir(v_s3, 'O entrevistador ficou doente');
  perform ok(r->>'status' = 'ok' and (r->>'avisados')::int = 1
             and (select count(*) from ps_envios where tipo = 'cancelamento' and dados->>'motivo' = 'O entrevistador ficou doente') = 1
             and not exists (select 1 from ps_agendamentos where candidato_id = '00000000-0000-0000-0000-0000000000c1'),
    'excluir o horário avisa o candidato para escolher outro');
  v_lote := ps_envios_lote(50, ((v_amanha - 1) + time '10:00') at time zone 'America/Sao_Paulo');
  perform ok(jsonb_array_length(v_lote) = (select count(*) from ps_envios where enviado_em is null), 'a fila traz o que não saiu');
  r := ps_envios_baixa(jsonb_build_object('enviados', (select jsonb_agg(x->'id') from jsonb_array_elements(v_lote) x where x->>'tipo' <> 'resumo'),
                                          'falhas', (select jsonb_agg(x->'id') from jsonb_array_elements(v_lote) x where x->>'tipo' = 'resumo'),
                                          'erro', 'caixa cheia'));
  perform ok((select count(*) from ps_envios where enviado_em is null) = 2
             and (select bool_and(tentativas = 1 and erro = 'caixa cheia') from ps_envios where tipo = 'resumo'),
    'a baixa fecha o que saiu e conta a tentativa do que falhou');
end $$;

-- a fila não aceita escrita direta; quem não é do comitê não a lê
select eu(4, 'selecao');
set role authenticated;
do $$
begin
  perform ok((select count(*) from ps_envios) > 0, 'o comitê lê a fila');
  begin
    insert into ps_envios (tipo, para_email, assunto) values ('confirmacao', 'x@x.com', 'x');
    raise exception 'FALHOU: escreveu direto na fila';
  exception when insufficient_privilege then perform ok(true, 'nem o comitê escreve direto na fila'); end;
end $$;
reset role;
select eu(11, 'leitura');
set role authenticated;
do $$ begin perform ok((select count(*) from ps_envios) = 0, 'quem não é do comitê não vê os e-mails'); end $$;
reset role;

do $$ begin perform ok((select count(*) from migracoes where id = 'v31_ps_entrevistas') = 1, 'registra a migração'); end $$;
