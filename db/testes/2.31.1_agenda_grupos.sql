\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.31.1 — a agenda segue os grupos e o desligamento.
-- Rode num banco com a cadeia da 28.0 (esqueleto, Storage, 15.0 a
-- 19.0, esqueleto da agenda e a 28.0) e a 2.31.1 aplicada.
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
-- os dias (a partir de hoje) em que a pessoa é convidada na série
create or replace function dias(p_serie uuid, p_reg integer) returns integer[] language sql as $$
  select coalesce(array_agg(e.data - current_date order by e.data), '{}')
    from eventos e join evento_participantes p on p.evento_id = e.id
   where e.serie_id = p_serie and p.registro = p_reg and coalesce(e.status,'') <> 'Cancelado' $$;
create or replace function papel(p_ev uuid, p_reg integer) returns text language sql as $$
  select papel from evento_participantes where evento_id = p_ev and registro = p_reg $$;

-- A equipe do esqueleto: 4 Ana (Órtese, Gestão), 11 Bruno (Sinais),
-- 17 Carla (Órtese), 23 Diego (Comunicação), 31 Elis (Depto de Pessoal).
-- Sinais fica dentro de Órtese.
update grupos set pai_id = gid('Órtese') where nome = 'Sinais';

do $$
declare
  r jsonb; v_serie uuid; v_ev uuid; v_unico uuid; v_passado uuid; v_hoje uuid;
begin
  raise notice 'A série com grupo';
  perform eu(17, 'leitura');
  r := agenda_evento_salvar(jsonb_build_object(
    'titulo', 'Reunião da Órtese', 'data', current_date - 14, 'hora_inicio', '10:00', 'hora_fim', '11:00',
    'recorrencia', 'Semanal', 'repetir_ate', current_date + 28,
    'grupos', jsonb_build_array(gid('Órtese')), 'opcionais', jsonb_build_array(11)));
  perform ok(r->>'status' = 'ok', 'cria a série');
  v_serie := (r->>'id')::uuid;
  perform ok((select bool_and(grupo_ids = array[gid('Órtese')]) from eventos where serie_id = v_serie),
    'todas as ocorrências guardam o grupo pelo id');
  perform ok(dias(v_serie, 4) = '{-14,-7,0,7,14,21,28}' and dias(v_serie, 11) = '{-14,-7,0,7,14,21,28}',
    'o grupo e o subgrupo estão em todas');
  perform ok((select bool_and(papel = 'opcional') from evento_participantes p join eventos e on e.id = p.evento_id
               where e.serie_id = v_serie and p.registro = 11),
    'o opcional que veio pelo grupo continua opcional');
  perform ok((select origem from evento_participantes where evento_id = v_serie and registro = 4) = 'grupo'
    and (select origem from evento_participantes where evento_id = v_serie and registro = 11) = 'grupo',
    'a origem diz quem veio pelo grupo');
  select id into v_hoje from eventos where serie_id = v_serie and data = current_date;

  -- uma reunião única com o mesmo grupo, e uma que já passou com a Ana
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Revisão única', 'data', current_date + 3,
    'hora_inicio', '14:00', 'hora_fim', '15:00', 'grupos', jsonb_build_array(gid('Órtese'))));
  v_unico := (r->>'id')::uuid;
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Retro passada', 'data', current_date - 3,
    'hora_inicio', '14:00', 'hora_fim', '15:00', 'obrigatorios', jsonb_build_array(4)));
  v_passado := (r->>'id')::uuid;

  raise notice 'Entrar no grupo';
  perform eu(31, 'pessoal');
  delete from notificacoes;
  update membros set grupos = array_append(grupos, 'Órtese') where registro = 23;
  perform ok(dias(v_serie, 23) = '{0,7,14,21,28}', 'o Diego entra nas ocorrências de hoje em diante, não nas passadas');
  perform ok((select origem from evento_participantes where evento_id = v_hoje and registro = 23) = 'grupo'
    and (select resposta from evento_participantes where evento_id = v_hoje and registro = 23) = 'pendente',
    'pelo grupo, com a resposta pendente');
  perform ok((select count(*) from agenda_envios where para_registro = 23 and tipo = 'convite') = 1
    and (select evento_id from agenda_envios where para_registro = 23 and tipo = 'convite') = v_hoje,
    'um convite por e-mail para a série, o da próxima ocorrência');
  perform ok((select count(*) from notificacoes where registro = 23 and tipo = 'agenda_convite') = 1, 'e um aviso no sino');
  perform ok(not exists (select 1 from evento_participantes where evento_id = v_unico and registro = 23),
    'a reunião única não muda');

  update membros set email_pessoal = 'diego@gmail.com' where registro = 23;
  update membros set grupos = array_append(grupos, 'Gestão') where registro = 23;
  perform ok((select count(*) from agenda_envios where para_registro = 23 and tipo = 'convite') = 1,
    'mexer em outra coisa da ficha não convida de novo');

  update membros set grupos = array_append(grupos, 'Sinais') where registro = 31;
  perform ok(dias(v_serie, 31) = '{0,7,14,21,28}', 'pelo subgrupo também');

  raise notice 'Desligar';
  perform ok(exists (select 1 from agenda_envios where para_registro = 4 and enviado_em is null), 'a Ana tem e-mail na fila');
  update membros set status = 'Desligado' where registro = 4;
  perform ok(dias(v_serie, 4) = '{-14,-7}', 'a Ana sai das ocorrências de hoje em diante; as passadas ficam');
  perform ok(not exists (select 1 from evento_participantes where evento_id = v_unico and registro = 4),
    'e da reunião única que ainda vai acontecer');
  perform ok(exists (select 1 from evento_participantes where evento_id = v_passado and registro = 4),
    'a reunião que já passou fica como estava');
  perform ok(not exists (select 1 from agenda_envios where para_registro = 4 and enviado_em is null),
    'a fila de e-mail dela se esvazia');
  perform ok(not exists (select 1 from agenda_envios where para_registro = 4 and tipo = 'cancelamento'),
    'sem e-mail de cancelamento');

  raise notice 'A série que cresce';
  update eventos set serie_ate = null where serie_id = v_serie;
  perform ok(agenda_gerar_serie(v_serie, current_date + 42) = 2, 'a série gera mais duas');
  perform ok(dias(v_serie, 23) = '{0,7,14,21,28,35,42}' and dias(v_serie, 31) = '{0,7,14,21,28,35,42}',
    'quem entrou no grupo já nasce nelas');
  perform ok(dias(v_serie, 4) = '{-14,-7}', 'quem foi desligado não volta pela cópia');
  perform ok(papel((select id from eventos where serie_id = v_serie and data = current_date + 42), 11) = 'opcional',
    'o opcional segue opcional');
  perform ok((select grupo_ids from eventos where serie_id = v_serie and data = current_date + 42) = array[gid('Órtese')],
    'e o grupo vai junto');

  raise notice 'Este e os seguintes';
  perform eu(17, 'leitura');
  r := agenda_evento_salvar(jsonb_build_object('id', (select id from eventos where serie_id = v_serie and data = current_date + 7),
    'aplicar', 'seguintes', 'notificar', false, 'grupos', jsonb_build_array(gid('Órtese')),
    'obrigatorios', jsonb_build_array(17), 'opcionais', jsonb_build_array(11, 23)));
  perform ok(r->>'status' = 'ok', 'o Diego vira opcional de +7 em diante');
  perform ok(agenda_gerar_serie(v_serie, current_date + 49) = 1, 'a série gera mais uma');
  perform ok(papel((select id from eventos where serie_id = v_serie and data = current_date + 49), 23) = 'opcional',
    'a ocorrência nova copia a lista do último encontro, não a do primeiro');

  raise notice 'Desligado não é convidado';
  r := agenda_evento_salvar(jsonb_build_object('titulo', 'Com a Ana', 'data', current_date + 5,
    'hora_inicio', '09:00', 'hora_fim', '10:00', 'obrigatorios', jsonb_build_array(4, 11)));
  perform ok((select array_agg(registro order by registro) from evento_participantes where evento_id = (r->>'id')::uuid) = '{11,17}',
    'quem está desligado fica fora do convite novo');

  raise notice 'Voltar';
  perform eu(31, 'pessoal');
  update membros set status = 'Ativo' where registro = 4;
  perform ok(dias(v_serie, 4) = '{-14,-7,0,7,14,21,28,35,42,49}', 'quem volta a Ativo volta às próximas do grupo');

  raise notice 'Renomear o grupo';
  update membros set grupos = array_replace(grupos, 'Órtese', 'Órteses') where 'Órtese' = any(grupos);
  update grupos set nome = 'Órteses' where nome = 'Órtese';
  perform eu(17, 'leitura');
  perform ok(agenda_evento(v_hoje)->'evento'->'grupos' = '["Órteses"]'::jsonb, 'o evento mostra o nome de agora');
  perform eu(31, 'pessoal');
  update membros set grupos = '{Comunicação}' where registro = 23;
  update membros set grupos = '{Comunicação,Órteses}' where registro = 23;
  perform ok(dias(v_serie, 23) = '{0,7,14,21,28,35,42,49}', 'sem duplicar quem já estava');
end $$;

do $$
begin
  perform ok(not has_function_privilege('authenticated', 'public.agenda_sincronizar_membro(integer)', 'execute')
    and not has_function_privilege('anon', 'public.agenda_sincronizar_membro(integer)', 'execute'),
    'a sincronização não se chama pela sessão');
  perform ok((select count(*) from migracoes where id = '2.31.1_agenda_grupos') = 1, 'registra a migração');
end $$;
