\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 25.0 — documentos emitidos, validação pública e o
-- registro de eventos.
-- Rode num banco com o esqueleto (e o de Storage), a 15.0 a 24.0 e a
-- 25.0. A 21.0 entra para haver o NRO-DIR-004 da planilha.
-- ============================================================
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
create or replace function evx(p_codigo text) returns uuid language sql as $$
  select id from eventos_ext where codigo = p_codigo $$;
create or replace function avisos(p_reg integer, p_like text) returns integer language sql as $$
  select count(*)::integer from notificacoes where registro = p_reg and tipo = 'evento_ext' and titulo like p_like $$;

-- ------------------------------------------------------------
-- A equipe do teste, além do esqueleto:
--   4  Ana      admin
--   11 Bruno    Sinais
--   17 Carla    Órtese
--   23 Diego    Comunicação
--   31 Elis     Depto de Pessoal (papel pessoal) — aprova
--   52 Gabi     Depto de Pessoal (papel leitura) — aprova pelo grupo
--   60 Hugo     desligado
-- O Depto de Pessoal é o grupo aprovador que a 25.0 semeia.
-- ------------------------------------------------------------
alter table membros add column if not exists data_ingresso date;
alter table membros add column if not exists data_desligamento date;
create table if not exists dados_pessoais (registro integer primary key references membros(registro), cpf text);
insert into membros(registro, nome, grupos, status, email_nro) values
  (52, 'Gabi Rocha', '{"Depto de Pessoal"}', 'Ativo', 'gabi@nro.dev'),
  (60, 'Hugo Lima',  '{Órtese}',            'Desligado', 'hugo@nro.dev')
on conflict do nothing;
update membros set cargo = 'Desenvolvedora de software', data_ingresso = '2025-06-02' where registro = 17;
update membros set cargo = 'Pesquisador', data_ingresso = '2024-03-01', data_desligamento = '2026-05-31' where registro = 60;
insert into dados_pessoais (registro, cpf) values (17, '09169507600'), (60, '123.456.789-09') on conflict do nothing;
insert into perfis(id, email, papel, registro) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17),
  ('00000000-0000-0000-0000-000000000023', 'diego@nro.dev', 'leitura', 23),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31),
  ('00000000-0000-0000-0000-000000000052', 'gabi@nro.dev',  'leitura', 52),
  ('00000000-0000-0000-0000-000000000060', 'hugo@nro.dev',  'leitura', 60)
on conflict do nothing;
-- um treinamento concluído pela Carla, duas vezes (vale a mais recente)
insert into treinamento_conclusoes (certificado, registro, nome, codigo, titulo, revisao, carga_horaria_min, concluido_em)
values ('CERT-0000-0001', 17, 'Carla Mendonça', 'NRO-TRE-001', 'Agenda no SOMA', 'A', 30, '2026-03-10 14:00-03'),
       ('CERT-0000-0002', 17, 'Carla Mendonça', 'NRO-TRE-001', 'Agenda no SOMA', 'B', 30, '2026-08-10 14:00-03')
on conflict do nothing;

-- 1. as séries
do $$ declare pegou text; begin
  perform ok((select titulo from doc_series where prefixo = 'DIR' and sn = 4) = 'DECLARAÇÃO DE VÍNCULO',
             'a DIR-004 da planilha passa a ter o nome do modelo em uso');
  perform ok((select pn_origem from doc_series where prefixo = 'DIR' and sn = 4) like 'Os PNs desta série não são registrados no rol%',
             'e diz que os PNs não moram no rol');
  perform ok((select tipo = 'registro' and multiplo from doc_series where prefixo = 'DIR' and sn = 4),
             'cada declaração é um registro, filho do template');
  perform ok((select titulo from doc_series where id = (select serie_participacao from doc_emissao_config))
             = 'DECLARAÇÃO DE PARTICIPAÇÃO EM EVENTO', 'a de participação nasce no próximo SN da Diretoria');
  perform ok((select sn from doc_series where id = (select serie_participacao from doc_emissao_config)) = 6, 'que é o 6');
  perform ok((select count(*) from doc_eventos e join doc_arquivos a on a.id = e.arquivo_id
               where a.codigo = 'NRO-DIR-004' and e.tipo = 'pn_origem') = 1, 'a mudança entra no registro de alterações, uma vez');
  perform eu(4, 'admin');
  begin
    perform doc_arquivo_criar(jsonb_build_object('serie_id', (select id from doc_series where prefixo = 'DIR' and sn = 4)));
  exception when others then pegou := sqlerrm; end;
  perform ok(pegou = 'doc_pn_fora_do_rol', 'e o banco recusa PN novo nela, mesmo de admin');
end $$;

-- 2. o código verificador
do $$ declare c text; i integer; v_ok boolean := true; begin
  for i in 1..200 loop
    c := doc_novo_verificador();
    if c !~ '^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$' then v_ok := false; end if;
  end loop;
  perform ok(v_ok, 'o código tem 12 caracteres de Crockford, em três grupos: ' || c);
  perform ok(doc_normalizar_verificador(' 7k4q xp9m-2a5c ') = '7K4Q-XP9M-2A5C', 'o que se digita é normalizado');
  perform ok(doc_normalizar_verificador('7K4Q-XP9M-2A5O') = '7K4Q-XP9M-2A50', 'O vira zero');
  perform ok(doc_normalizar_verificador('7K4Q-XP9M-2A5') is null, 'onze caracteres não é código');
  perform ok(doc_normalizar_verificador('7K4Q-XP9M-2A5U') is null, 'U não existe no alfabeto');
  perform ok(doc_cpf_mascarado('091.695.076-00') = '***.695.076-**', 'o CPF mascarado mostra só os seis do meio');
end $$;

-- 3. a declaração de vínculo
do $$ declare r jsonb; v_cod text; begin
  perform eu(17, 'leitura');
  r := doc_vinculo_previa();
  perform ok(r->>'status' = 'ok' and r->>'documento' = 'NRO-DIR-004-17', 'o PN é o registro: NRO-DIR-004-17');
  perform ok(r->>'revisao' = 'A', 'com a Rev. em vigor do template');
  perform ok(r->'dados'->>'cpf' = '091.695.076-00', 'o CPF da ficha sai formatado');
  perform ok(jsonb_array_length(r->'faltam') = 0, 'nada falta na ficha da Carla');
  perform ok(jsonb_array_length(r->'dados'->'treinamentos') = 1
             and r->'dados'->'treinamentos'->0->>'revisao' = 'B', 'de cada treinamento, a conclusão mais recente');
  perform ok((r->'dados'->>'vigente')::boolean and r->'dados'->>'desde' = '2025-06-02', 'vigente, desde o ingresso');
  r := doc_vinculo_previa(11);
  perform ok(r->>'status' = 'sem_permissao', 'a Carla não pede a declaração do Bruno');

  r := doc_vinculo_emitir();
  perform ok(r->>'status' = 'ok' and r->>'documento' = 'NRO-DIR-004-17' and r->>'titulo' = 'Declaração de vínculo',
             'emitir devolve a emissão');
  v_cod := r->>'codigo';
  perform ok(r->>'controle' ~ '^[0-9A-F]{8}$', 'com o código de controle');
  perform ok((select dados->>'nome' from doc_emitidos where codigo = v_cod) = 'Carla Mendonça', 'e a fotografia fica guardada');
  perform ok((select controle from doc_emitidos where codigo = v_cod)
             = doc_controle(v_cod, 'NRO-DIR-004-17', (select emitido_em from doc_emitidos where codigo = v_cod),
                            (select dados from doc_emitidos where codigo = v_cod)), 'o controle confere com o que foi impresso');
  perform set_config('teste.v1', v_cod, false);
  r := doc_vinculo_emitir();
  perform ok(r->>'codigo' <> v_cod, 'cada emissão ganha um código novo');

  perform eu(11, 'leitura');
  r := doc_vinculo_emitir(17);
  perform ok(r->>'status' = 'sem_permissao', 'o Bruno não emite a da Carla');
  perform eu(31, 'pessoal');
  r := doc_vinculo_emitir(60);
  perform ok(r->>'status' = 'ok', 'o Depto. de Pessoal emite a de qualquer um');
  perform ok(not (r->'dados'->>'vigente')::boolean and r->'dados'->>'ate' = '2026-05-31', 'quem saiu, com o fim do vínculo');
  perform ok(r->>'emitido_nome' = 'Elis Ramalho', 'e fica quem emitiu');
  r := doc_vinculo_previa(23);
  perform ok(r->'faltam' ? 'cpf' and r->'faltam' ? 'desde' and r->'faltam' ? 'cargo', 'a prévia diz o que falta na ficha do Diego');
  perform eu(null, 'leitura');
  r := doc_vinculo_emitir();
  perform ok(r->>'status' = 'sem_registro', 'conta sem registro não emite');
  -- nulo = 17 é nulo, não falso: sem o coalesce, isto passava
  r := doc_vinculo_previa(17);
  perform ok(r->>'status' = 'sem_permissao', 'nem pede a de outra pessoa pelo número');
  perform set_config('teste.papel', '', true);
  r := doc_vinculo_emitir(17);
  perform ok(r->>'status' = 'sem_permissao', 'nem sem papel nenhum');
end $$;

-- 4. a validação pública
do $$ declare r jsonb; v_cod text := current_setting('teste.v1'); begin
  r := doc_validar(lower(replace(v_cod, '-', ' ')));
  perform ok(r->>'status' = 'ok' and r->>'situacao' = 'autentico', 'o código, digitado de qualquer jeito, valida');
  perform ok(r->'dados'->>'cpf' = '***.695.076-**', 'com o CPF mascarado');
  perform ok(r->>'registro' is null and r->>'emitido_nome' is null, 'sem o registro nem quem emitiu');
  perform ok(r->>'documento' = 'NRO-DIR-004-17' and r->>'titular' = 'Carla Mendonça', 'com o documento e o titular');
  perform ok(not (r->>'segunda_via')::boolean, 'a de vínculo não tem segunda via pública');
  perform ok((select consultas from doc_emitidos where codigo = v_cod) = 1, 'e a consulta conta');
  r := doc_validar('0000-0000-0000');
  perform ok(r->>'status' = 'nao_encontrado', 'código que não existe');
  r := doc_validar('abc');
  perform ok(r->>'status' = 'invalido', 'e o que nem é código');
end $$;

-- 5. revogar
do $$ declare r jsonb; v_cod text := current_setting('teste.v1'); begin
  perform eu(11, 'leitura');
  r := doc_emitido_revogar(v_cod, 'engano');
  perform ok(r->>'status' = 'sem_permissao', 'o Bruno não revoga a declaração da Carla');
  perform eu(17, 'leitura');
  r := doc_emitido_revogar(v_cod, '  ');
  perform ok(r->>'status' = 'invalido', 'revogar pede o motivo');
  r := doc_emitido_revogar(v_cod, 'Emiti antes de atualizar o cargo.');
  perform ok(r->>'status' = 'ok', 'a titular revoga a própria');
  r := doc_validar(v_cod);
  perform ok(r->>'situacao' = 'revogado' and r->>'revogado_motivo' = 'Emiti antes de atualizar o cargo.',
             'e a validação passa a dizer revogado, com o motivo');
  r := doc_emitido_revogar(v_cod, 'de novo');
  perform ok(r->>'status' = 'ja_revogado', 'revogar duas vezes não');
  perform eu(null, 'leitura');
  r := doc_emitido_revogar((select codigo from doc_emitidos where registro = 17 and revogado_em is null limit 1), 'furo');
  perform ok(r->>'status' = 'sem_permissao', 'conta sem registro não revoga a declaração de ninguém');
  perform eu(17, 'leitura');
  perform ok((select count(*) from doc_emitidos_de()) = 2, 'a lista das minhas emissões');
end $$;

-- 6. registrar um evento
do $$ declare r jsonb; v_id uuid; begin
  perform eu(17, 'leitura');
  r := evento_ext_salvar(jsonb_build_object('nome', 'Congresso Brasileiro de Engenharia Biomédica',
         'data_inicio', '2026-09-10', 'data_fim', '2026-09-12', 'horas', 16, 'modalidade', 'presencial',
         'participantes', '[]'::jsonb));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'local', 'presencial pede o local');
  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026', 'local', 'Vitória (ES)',
         'data_inicio', '2026-09-10', 'data_fim', '2026-09-12', 'horas', 16, 'participantes', '[]'::jsonb));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'participantes', 'e ao menos um participante');
  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026', 'local', 'Vitória (ES)',
         'data_inicio', '2026-09-10', 'data_fim', '2026-09-08', 'horas', 16, 'participantes', '[{"registro":17}]'::jsonb));
  perform ok(r->>'campo' = 'data_fim', 'o fim não vem antes do início');
  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026', 'local', 'Vitória (ES)', 'data_inicio', '2026-09-10',
         'horas', 0, 'participantes', '[{"registro":17}]'::jsonb));
  perform ok(r->>'campo' = 'horas', 'horas dedicadas precisam ser positivas');
  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026', 'local', 'Vitória (ES)', 'data_inicio', '2026-09-10',
         'horas', 16, 'participantes', '[{"registro":17},{"nome":"Rui Alves","email":"rui@"}]'::jsonb));
  perform ok(r->>'campo' = 'participantes' and r->>'motivo' = 'email' and (r->>'linha')::int = 2,
             'o externo precisa de um e-mail que pareça e-mail, e a linha vem junto');
  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026', 'local', 'Vitória (ES)', 'data_inicio', '2026-09-10',
         'horas', 16, 'participantes', '[{"registro":17},{"registro":17}]'::jsonb));
  perform ok(r->>'motivo' = 'repetido', 'a mesma pessoa duas vezes não');

  r := evento_ext_salvar(jsonb_build_object('nome', 'CBEB 2026 — Congresso Brasileiro de Engenharia Biomédica',
         'descricao', 'Apresentação do pôster do projeto Nebula.', 'local', 'Vitória (ES)', 'modalidade', 'presencial',
         'data_inicio', '2026-09-10', 'data_fim', '2026-09-12', 'hora_inicio', '08:00', 'hora_fim', '18:00', 'horas', 16,
         'participantes', jsonb_build_array(
            jsonb_build_object('registro', 17, 'papel', 'Apresentadora'),
            jsonb_build_object('registro', 11, 'horas', 8),
            jsonb_build_object('nome', 'Rui Alves', 'email', 'Rui.Alves@UFES.br', 'papel', 'Coautor'))));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'EXT-1', 'o primeiro evento é EXT-1');
  v_id := (r->>'id')::uuid;
  perform ok((select status from eventos_ext where id = v_id) = 'rascunho', 'e nasce rascunho');
  perform ok((select email from eventos_ext_participantes where evento_id = v_id and registro is null) = 'rui.alves@ufes.br',
             'o e-mail do externo fica em minúsculas');
  perform ok((select nome from eventos_ext_participantes where evento_id = v_id and registro = 11) = 'Bruno Tavares',
             'o membro leva o nome da ficha');

  -- quem vê
  perform eu(23, 'leitura');
  perform ok(not evento_ext_pode_ver(v_id), 'o Diego não vê o rascunho de outro');
  perform ok((evento_ext_ler('EXT-1'))->>'status' = 'nao_encontrado', 'nem pela página');
  perform eu(11, 'leitura');
  perform ok(evento_ext_pode_ver(v_id), 'o Bruno, que participa, vê');
  r := evento_ext_ler('ext-1');
  perform ok(r->'participantes'->2->>'email' is null, 'mas não o e-mail do externo');
  perform ok(not (r->'pode'->>'editar')::boolean, 'nem edita o registro da Carla');
  r := evento_ext_salvar(jsonb_build_object('id', v_id, 'nome', 'Furo', 'local', 'x', 'data_inicio', '2026-09-10',
         'horas', 1, 'participantes', '[{"registro":11}]'::jsonb));
  perform ok(r->>'status' = 'sem_permissao', 'e a função confere também');
  perform eu(17, 'leitura');
  r := evento_ext_ler('EXT-1');
  perform ok(r->'participantes'->2->>'email' = 'rui.alves@ufes.br', 'quem registrou vê o e-mail');
end $$;

-- 7. enviar e aprovar
do $$ declare r jsonb; v_id uuid := evx('EXT-1'); v2 uuid; begin
  perform eu(17, 'leitura');
  r := evento_ext_salvar(jsonb_build_object('nome', 'Semana de Engenharia 2099', 'local', 'UFMG',
         'data_inicio', '2099-05-10', 'horas', 4, 'participantes', '[{"registro":17}]'::jsonb));
  v2 := (r->>'id')::uuid;
  r := evento_ext_enviar(v2);
  perform ok(r->>'status' = 'futuro', 'evento que ainda não aconteceu não vai para aprovação');

  r := evento_ext_enviar(v_id);
  perform ok(r->>'status' = 'ok' and (r->>'aprovadores')::int = 2, 'enviado; Elis e Gabi aprovam');
  perform ok(avisos(31, 'EXT-1 · % aguarda a sua aprovação') = 1 and avisos(52, 'EXT-1 · %') = 1,
             'os dois são avisados');
  perform ok(avisos(4, 'EXT-1 · %') = 0, 'com grupo aprovador, admin não é avisado');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'aprovar'));
  perform ok(r->>'status' = 'sem_permissao', 'quem registrou não está no grupo aprovador');

  perform eu(23, 'leitura');
  perform ok(evento_ext_pode_ver(v_id) = false, 'em aprovação, o Diego ainda não vê');
  perform eu(52, 'leitura');
  perform ok(eventos_ext_pendentes() = 1, 'a Gabi tem um evento esperando por ela');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'devolver'));
  perform ok(r->>'campo' = 'parecer', 'devolver pede o porquê');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'aprovar', 'parecer', 'Confere com a programação.'));
  perform ok(r->>'status' = 'ok' and r->>'situacao' = 'aprovacao' and (r->>'faltam')::int = 1,
             'uma aprovação não basta: faltam uma');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'aprovar'));
  perform ok(r->>'status' = 'ja_aprovou', 'a mesma pessoa não aprova duas vezes');
  perform ok(eventos_ext_pendentes() = 0, 'e sai da fila dela');

  -- mexer em aprovação cria a versão seguinte
  perform eu(17, 'leitura');
  r := evento_ext_salvar(jsonb_build_object('id', v_id, 'nome', 'CBEB 2026 — Congresso Brasileiro de Engenharia Biomédica',
         'descricao', 'Apresentação do pôster do projeto Nebula.', 'local', 'Vitória (ES)',
         'data_inicio', '2026-09-10', 'data_fim', '2026-09-12', 'hora_inicio', '08:00', 'hora_fim', '18:00', 'horas', 16,
         'participantes', jsonb_build_array(
            jsonb_build_object('registro', 17, 'papel', 'Apresentadora'),
            jsonb_build_object('registro', 11, 'horas', 8),
            jsonb_build_object('nome', 'Rui Alves', 'email', 'rui.alves@ufes.br', 'papel', 'Coautor'),
            jsonb_build_object('registro', 60))));
  perform ok(r->>'status' = 'ok' and (r->>'versao')::int = 2 and r->>'situacao' = 'aprovacao',
             'editar em aprovação faz a versão 2, ainda em aprovação');
  perform ok(avisos(52, 'EXT-1 · % mudou depois da sua aprovação') = 1, 'e quem já tinha aprovado fica sabendo');
  perform eu(52, 'leitura');
  perform ok(eventos_ext_pendentes() = 1, 'a Gabi precisa aprovar de novo');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'aprovar'));
  perform ok((r->>'faltam')::int = 1, 'a aprovação da versão 1 não conta mais');

  perform eu(31, 'pessoal');
  r := evento_ext_decidir(jsonb_build_object('id', v_id, 'decisao', 'aprovar', 'parecer', 'ok'));
  perform ok(r->>'status' = 'ok' and r->>'situacao' = 'aprovado' and (r->>'declaracoes')::int = 4,
             'a segunda aprovação fecha: quatro declarações');
end $$;

-- 8. as declarações de participação
do $$ declare r jsonb; v_id uuid := evx('EXT-1'); v_rui text; v_bruno text; begin
  perform ok((select count(*) from doc_emitidos where evento_id = v_id and tipo = 'participacao') = 4,
             'uma emissão por participante');
  perform ok((select count(distinct documento) from doc_emitidos where evento_id = v_id) = 1
             and (select documento from doc_emitidos where evento_id = v_id limit 1) = 'NRO-DIR-006-1',
             'todas NRO-DIR-006-1: o PN é o número do evento');
  select declaracao into v_rui from eventos_ext_participantes where evento_id = v_id and registro is null;
  select declaracao into v_bruno from eventos_ext_participantes where evento_id = v_id and registro = 11;
  perform ok(v_rui is not null and v_bruno is not null, 'cada participante leva o seu código');
  perform ok((select (dados->>'horas')::numeric from doc_emitidos where codigo = v_bruno) = 8, 'o Bruno, com as 8 h dele');
  perform ok((select (dados->>'horas')::numeric from doc_emitidos where codigo = v_rui) = 16, 'o Rui, com as do evento');
  perform ok((select dados->'evento'->>'hora_inicio' from doc_emitidos where codigo = v_rui) = '08:00', 'o horário vai junto');

  perform ok((select count(*) from doc_envios where codigo in (select codigo from doc_emitidos where evento_id = v_id)) = 4,
             'quatro e-mails na fila');
  perform ok((select para_email from doc_envios where codigo = v_rui) = 'rui.alves@ufes.br', 'o do Rui vai para o e-mail dele');
  perform ok((select count(*) from notificacoes where tipo = 'evento_ext' and titulo like 'Sua declaração de participação%'
               and email_em is not null) = 3, 'os três membros no sino, sem segundo e-mail');

  r := doc_validar(v_rui);
  perform ok(r->>'situacao' = 'autentico' and (r->>'segunda_via')::boolean, 'a do externo valida, e tem segunda via');
  perform ok(r->'dados'->'evento'->>'nome' like 'CBEB 2026%', 'com o evento');

  perform eu(23, 'leitura');
  perform ok(evento_ext_pode_ver(v_id), 'aprovado, o evento é da equipe: o Diego vê');
  r := evento_ext_ler('EXT-1');
  perform ok(r->'participantes'->0->>'declaracao' is null, 'mas não os códigos dos outros');
  perform ok((doc_emitido_ler(v_rui))->>'status' = 'nao_encontrado', 'nem a segunda via da declaração do Rui');
  perform eu(17, 'leitura');
  perform ok((doc_emitido_ler(v_rui))->>'status' = 'ok', 'quem registrou lê a do externo, para mandar de novo');
  perform ok((evento_ext_reenviar((select id from eventos_ext_participantes where declaracao = v_rui)))->>'status' = 'na_fila',
             'reenviar o que ainda está na fila não duplica');
  perform eu(11, 'leitura');
  perform ok((doc_emitido_ler(v_bruno))->>'status' = 'ok', 'o Bruno lê a dele');
  perform ok((select count(*) from doc_emitidos_de()) = 1, 'e ela aparece nas emissões dele');
  r := doc_vinculo_previa();
  perform ok(jsonb_array_length(r->'dados'->'eventos') = 1 and (r->'dados'->'eventos'->0->>'horas')::numeric = 8,
             'e a declaração de vínculo dele já lista o evento, com as horas dele');
end $$;

-- 9. a fila de e-mail, pela Edge Function
do $$ declare r jsonb; v_ids jsonb; begin
  r := doc_envios_lote(50);
  perform ok(jsonb_array_length(r) = 4, 'o lote traz os quatro');
  perform ok((select count(*) from jsonb_array_elements(r) x where x->>'para_email' = 'bruno@nro.dev') = 1,
             'o do membro vai para o e-mail da ficha');
  perform ok((select x->'dados'->>'url' from jsonb_array_elements(r) x where x->>'para_email' = 'rui.alves@ufes.br')
             like 'https://auth.neurodynamics.dev/?c=%', 'com o link da validação');
  select jsonb_agg(x->'id') into v_ids from jsonb_array_elements(r) x where x->>'para_email' <> 'rui.alves@ufes.br';
  r := doc_envios_baixa(jsonb_build_object('enviados', v_ids, 'falhas',
         (select jsonb_agg(x->'id') from jsonb_array_elements(doc_envios_lote(50)) x where x->>'para_email' = 'rui.alves@ufes.br'),
         'erro', 'caixa cheia'));
  perform ok((r->>'enviados')::int = 3, 'três saíram');
  perform ok(jsonb_array_length(doc_envios_lote(50)) = 1, 'o que falhou volta no próximo lote');
  perform ok((select erro from doc_envios where para_email = 'rui.alves@ufes.br') = 'caixa cheia', 'com o erro guardado');
end $$;

-- 10. reabrir revoga
do $$ declare r jsonb; v_id uuid := evx('EXT-1'); v_rui text; begin
  select declaracao into v_rui from eventos_ext_participantes where evento_id = v_id and registro is null;
  perform eu(17, 'leitura');
  r := evento_ext_reabrir(v_id, 'O Hugo não foi.');
  perform ok(r->>'status' = 'sem_permissao', 'quem registrou não reabre');
  perform eu(52, 'leitura');
  r := evento_ext_reabrir(v_id, '');
  perform ok(r->>'campo' = 'motivo', 'reabrir pede o motivo');
  r := evento_ext_reabrir(v_id, 'O Hugo não foi.');
  perform ok(r->>'status' = 'ok' and (r->>'revogadas')::int = 4, 'quem aprova reabre, e as quatro são revogadas');
  perform ok((doc_validar(v_rui))->>'situacao' = 'revogado', 'a validação diz revogado');
  perform ok((doc_validar(v_rui))->>'revogado_motivo' = 'EXT-1 reaberto para correção: O Hugo não foi.', 'e por quê');
  perform ok((select count(*) from doc_envios where enviado_em is null and codigo = v_rui) = 0,
             'o e-mail que ainda não tinha saído sai da fila');
  perform ok((select status || ' v' || versao from eventos_ext where id = v_id) = 'rascunho v3', 'volta a rascunho, versão 3');
  perform ok(avisos(11, 'EXT-1 · % foi reaberto para correção') = 1, 'e os participantes são avisados');
  perform eu(17, 'leitura');
  r := evento_ext_cancelar(v_id, 'Vamos registrar de novo.');
  perform ok(r->>'status' = 'ok', 'um rascunho se cancela');
  r := evento_ext_enviar(v_id);
  perform ok(r->>'status' = 'fechado', 'e cancelado não volta');
end $$;

-- 11. configurar
--     authenticated tem grant em tudo, como no Supabase, e o que
--     segura é a política
grant select, insert, update, delete on all tables in schema public to authenticated, anon;
grant usage, select on all sequences in schema public to authenticated;
do $$ begin perform set_config('teste.registro', '11', false); perform set_config('teste.papel', 'leitura', false); end $$;
set role authenticated;
update eventos_ext_config set aprovacoes_minimas = 1;
reset role;
do $$ declare pegou boolean := false; begin
  perform ok((select aprovacoes_minimas from eventos_ext_config) = 2, 'o Bruno não muda quantas aprovações bastam');
  perform eu(31, 'pessoal');
  update eventos_ext_config set aprovacoes_minimas = 1, grupos_aprovadores = array[gid('Depto de Pessoal'), 9999];
  perform ok((select grupos_aprovadores from eventos_ext_config) = array[gid('Depto de Pessoal')],
             'grupo que não existe sai da lista');
  begin
    update eventos_ext_config set aprovacoes_minimas = 5;
  exception when check_violation then pegou := true; end;
  perform ok(pegou, 'mais de três aprovações não');
  update doc_emissao_config set url_validacao = 'https://auth.neurodynamics.dev/';
  perform ok((select url_validacao from doc_emissao_config) = 'https://auth.neurodynamics.dev', 'a barra do fim sai do endereço');
end $$;

-- 12. RLS: a tabela de emissões, para quem não é dono
set role authenticated;
do $$ begin perform set_config('teste.registro', '11', false); perform set_config('teste.papel', 'leitura', false); end $$;
do $$ begin
  perform ok((select count(*) from doc_emitidos) = 1, 'direto na tabela, o Bruno vê só a emissão dele');
  perform ok((select count(*) from eventos_ext) = 0, 'e os eventos não se leem direto — só pelas funções');
  perform ok((select count(*) from doc_envios) = 0, 'nem a fila de e-mail');
end $$;
reset role;
do $$ begin perform set_config('teste.registro', '', false); end $$;

-- 13. a chave anônima alcança a validação — e só ela
set role anon;
do $$ declare pegou boolean := false; begin
  perform ok((doc_validar('0000-0000-0000'))->>'status' = 'nao_encontrado', 'anon chama a validação');
  begin
    perform doc_vinculo_emitir(17);
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'mas não emite nada');
  pegou := false;
  begin
    perform evento_ext_ler('EXT-1');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'nem lê um evento');
  perform ok((select count(*) from doc_emitidos) = 0, 'e a tabela, mesmo com o grant do Supabase, não devolve nada');
end $$;
reset role;

-- 14. rodar de novo não muda nada
\ir ../v25_documentos_eventos.sql
do $$ begin
  perform ok((select count(*) from doc_series where titulo = 'DECLARAÇÃO DE PARTICIPAÇÃO EM EVENTO') = 1,
             'rodar a 25.0 de novo não cria outra série de participação');
  perform ok((select count(*) from doc_eventos e join doc_arquivos a on a.id = e.arquivo_id
               where a.codigo = 'NRO-DIR-004' and e.tipo = 'pn_origem') = 1, 'nem repete o registro de alterações');
  perform ok((select aprovacoes_minimas from eventos_ext_config) = 1, 'nem desfaz a configuração');
end $$;
\echo '== 25.0: tudo certo'
