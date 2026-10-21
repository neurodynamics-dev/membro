-- ============================================================
-- Teste da 2.17.0: bugs e sugestões, a foto enviada pelo portal e os
-- cartões de Atividades (outras pessoas, etiquetas, checklists, cópia
-- para outro quadro, comentário editável). Roda num banco com o
-- esqueleto, o Storage, o Vault e a 15.0 à 19.0 (veja db/LEIAME.md),
-- aplica a 2.17.0 no começo e de novo no fim, junto com a 15.0.
-- ============================================================
\set ON_ERROR_STOP on
\pset pager off
create or replace function ok(cond boolean, txt text) returns void language plpgsql as $$
begin
  if cond then raise notice '  ok   %', txt;
  else raise exception 'FALHOU: %', txt; end if;
end $$;
create or replace function eu(p_reg integer, p_papel text) returns void language plpgsql as $$
begin
  perform set_config('teste.registro', coalesce(p_reg::text, ''), true);
  perform set_config('teste.papel', p_papel, true);
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), true);
end $$;
create or replace function gid(p_nome text) returns integer language sql as $$
  select id from grupos where nome = p_nome $$;
create or replace function atv(p_cod text) returns uuid language sql as $$
  select id from atividades where codigo = p_cod $$;
create or replace function avisos(p_reg integer, p_tipo text) returns integer language sql as $$
  select count(*)::integer from notificacoes where registro = p_reg and tipo = p_tipo $$;

-- As contas: Ana (4) é admin, Elis (31) é do Depto. de Pessoal, e o
-- resto é leitura. No quadro, Ana e Carla (17) estão na Órtese; Bruno
-- (11) está em Sinais e só lê a Órtese.
insert into perfis (id, email, papel, registro, nome) values
  ('00000000-0000-0000-0000-000000000004', 'ana@nro.dev',   'admin',   4,  'Ana Figueiredo'),
  ('00000000-0000-0000-0000-000000000011', 'bruno@nro.dev', 'leitura', 11, 'Bruno Tavares'),
  ('00000000-0000-0000-0000-000000000017', 'carla@nro.dev', 'leitura', 17, 'Carla Mendonça'),
  ('00000000-0000-0000-0000-000000000031', 'elis@nro.dev',  'pessoal', 31, 'Elis Ramalho')
on conflict (id) do nothing;

\ir ../2.17.0_notas_fotos_e_cartoes.sql

-- ------------------------------------------------------------
-- 1. BUGS E SUGESTÕES
-- ------------------------------------------------------------
do $$ declare r jsonb; begin
  perform eu(null, 'leitura');
  r := feedback_salvar('{"tipo":"bug","titulo":"O quadro não abre"}');
  perform ok(r->>'status' = 'sem_registro', 'conta sem registro não relata');
  perform eu(11, 'leitura');
  r := feedback_salvar('{"tipo":"bug","titulo":"x"}');
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'titulo', 'título curto demais volta com o campo');
  r := feedback_salvar('{"tipo":"elogio","titulo":"Muito bom"}');
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'tipo', 'só bug ou sugestão');
  r := feedback_salvar(jsonb_build_object('tipo','bug','titulo','  O quadro   não abre no celular ',
    'corpo','Fica girando.','versao','2.17.0','tela','#/atividades/ORT','aparelho','Chrome no Android'));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'BUG-' || (r->>'id'), 'o relato de bug ganha o código BUG-<n>');
  perform ok((select titulo from soma_feedback where id = (r->>'id')::bigint) = 'O quadro não abre no celular',
             'o título chega sem os espaços sobrando');
  perform ok((select versao || ' ' || tela || ' ' || aparelho from soma_feedback where id = (r->>'id')::bigint)
             = '2.17.0 #/atividades/ORT Chrome no Android', 'guarda a versão, a tela e o aparelho');
  perform ok(avisos(4, 'feedback_novo') = 1, 'admin é avisado do relato novo');
  perform ok(avisos(11, 'feedback_novo') = 0 and avisos(31, 'feedback_novo') = 0,
             'quem relatou e quem não é admin, não');
  r := feedback_salvar('{"tipo":"sugestao","titulo":"Modo compacto no quadro"}');
  perform ok(r->>'codigo' = 'SUG-' || (r->>'id'), 'a sugestão é SUG-<n>, na mesma numeração');
end $$;

do $$ declare b bigint := (select id from soma_feedback where tipo = 'bug'); r jsonb; n integer; begin
  perform eu(17, 'leitura');
  r := feedback_votar(jsonb_build_object('id', b));
  perform ok(r->>'status' = 'ok' and (r->>'votos')::int = 1, 'Carla vota: "também acontece comigo"');
  r := feedback_votar(jsonb_build_object('id', b));
  perform ok((r->>'votos')::int = 1, 'votar de novo não conta duas vezes');
  select votos, votei::int into n from soma_feedback_lista where id = b;
  perform ok(n = 1 and (select votei from soma_feedback_lista where id = b), 'a lista diz quantos votos e que ela votou');
  perform eu(31, 'pessoal');
  perform feedback_votar(jsonb_build_object('id', b));
  perform feedback_votar(jsonb_build_object('id', b, 'voto', false));
  perform ok((select votos from soma_feedback_lista where id = b) = 1, 'tirar o voto tira');

  perform eu(17, 'leitura');
  r := feedback_comentar(jsonb_build_object('id', b, 'corpo', 'No iPhone também.'));
  perform ok(r->>'status' = 'ok', 'comentar um relato');
  perform ok(avisos(11, 'feedback_comentario') = 1, 'quem relatou é avisado do comentário');
  perform eu(11, 'leitura');
  perform feedback_comentar(jsonb_build_object('id', b, 'corpo', 'Obrigado.'));
  perform ok(avisos(17, 'feedback_comentario') = 1, 'e quem já comentou também');
  perform ok((select comentarios from soma_feedback_lista where id = b) = 2, 'a lista conta os comentários');
  r := feedback_comentar(jsonb_build_object('id', b, 'corpo', '   '));
  perform ok(r->>'status' = 'invalido', 'comentário vazio não entra');
end $$;

do $$ declare b bigint := (select id from soma_feedback where tipo = 'bug');
             s bigint := (select id from soma_feedback where tipo = 'sugestao'); r jsonb; begin
  perform eu(17, 'leitura');
  r := feedback_salvar(jsonb_build_object('id', b, 'tipo', 'bug', 'titulo', 'Troca de título'));
  perform ok(r->>'status' = 'sem_permissao', 'só quem relatou corrige o relato');
  perform eu(31, 'pessoal');
  r := feedback_decidir(jsonb_build_object('id', b, 'status', 'feito'));
  perform ok(r->>'status' = 'sem_permissao', 'decidir é de admin, não do Depto. de Pessoal');
  perform eu(4, 'admin');
  r := feedback_decidir(jsonb_build_object('id', b, 'status', 'quase'));
  perform ok(r->>'status' = 'invalido', 'status que não existe volta');
  r := feedback_decidir(jsonb_build_object('id', s, 'status', 'duplicado'));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'duplicado_de', 'duplicado pede de qual relato');
  r := feedback_decidir(jsonb_build_object('id', b, 'status', 'feito', 'versao_feito', '2.18.0',
    'resposta', 'O quadro passou a caber no celular.'));
  perform ok(r->>'status' = 'ok', 'admin marca como feito, com a versão');
  perform ok((select status || ' ' || versao_feito || ' ' || decidido_por from soma_feedback where id = b) = 'feito 2.18.0 4',
             'fica o status, a versão e quem decidiu');
  perform ok(exists (select 1 from notificacoes where registro = 11 and tipo = 'feedback_status'
                       and corpo = 'Feito na versão 2.18.0.'), 'quem relatou é avisado: "Feito na versão 2.18.0."');
  perform ok(avisos(17, 'feedback_status') = 1, 'e quem votou também');
  perform eu(11, 'leitura');
  r := feedback_salvar(jsonb_build_object('id', b, 'tipo', 'bug', 'titulo', 'Outro título'));
  perform ok(r->>'status' = 'fechado', 'depois de decidido, o autor não muda o texto');
  r := feedback_excluir(jsonb_build_object('id', b));
  perform ok(r->>'status' = 'sem_permissao', 'nem exclui');
  r := feedback_salvar(jsonb_build_object('id', s, 'tipo', 'sugestao', 'titulo', 'Modo compacto no quadro de atividades'));
  perform ok(r->>'status' = 'ok', 'enquanto aberto, corrige o próprio relato');
  perform eu(4, 'admin');
  r := feedback_decidir(jsonb_build_object('id', s, 'status', 'duplicado', 'duplicado_de', b));
  perform ok((select duplicado_de_codigo from soma_feedback_lista where id = s) = 'BUG-' || b,
             'duplicado aponta para o outro relato, com o código');
  perform ok(exists (select 1 from notificacoes where registro = 11 and corpo = 'Duplicado de BUG-' || b || '.'),
             'e o aviso diz de qual');
  r := feedback_excluir(jsonb_build_object('id', s));
  perform ok(r->>'status' = 'ok' and not exists (select 1 from soma_feedback where id = s), 'admin exclui qualquer relato');
end $$;

-- ------------------------------------------------------------
-- 2. A FOTO ENVIADA PELO PORTAL
-- ------------------------------------------------------------
do $$ begin
  perform ok((select public from storage.buckets where id = 'fotos'), 'o bucket "fotos" existe e é público');
  perform eu(11, 'leitura');
  perform ok(membro_foto_pode('11/1759100000000.jpg'), 'Bruno grava na pasta do próprio registro');
  perform ok(not membro_foto_pode('17/1759100000000.jpg'), 'e não na da Carla');
  perform ok(not membro_foto_pode('11/../17/x.jpg') and not membro_foto_pode('11/sub/x.jpg'),
             'caminho torto não passa');
  perform eu(31, 'pessoal');
  perform ok(membro_foto_pode('17/1759100000000.jpg'), 'o Depto. de Pessoal grava em qualquer pasta');
end $$;

do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  r := membro_foto_definir('{"caminho":"11/1759100000000.jpg"}');
  perform ok(r->>'status' = 'sem_arquivo', 'foto que não subiu não entra na ficha');
  insert into storage.objects (bucket_id, name, owner) values ('fotos', '11/1759100000000.jpg', auth.uid());
  r := membro_foto_definir('{"caminho":"11/1759100000000.jpg"}');
  perform ok(r->>'status' = 'ok', 'Bruno põe a própria foto');
  perform ok((select foto_url from membros where registro = 11)
             = 'https://rxzmkyjttzzpwtodqkve.supabase.co/storage/v1/object/public/fotos/11/1759100000000.jpg',
             'foto_url vira o endereço público do bucket');
  perform ok(r->>'anterior' is null, 'não havia foto anterior no bucket');
  r := membro_foto_definir('{"registro":17,"caminho":"17/1.jpg"}');
  perform ok(r->>'status' = 'sem_permissao', 'e não põe a da Carla');
  r := membro_foto_definir('{"caminho":"17/1759100000000.jpg"}');
  perform ok(r->>'status' = 'invalido', 'nem aponta a sua ficha para a pasta de outra pessoa');
  insert into storage.objects (bucket_id, name, owner) values ('fotos', '11/1759200000000.webp', auth.uid());
  r := membro_foto_definir('{"caminho":"11/1759200000000.webp"}');
  perform ok(r->>'anterior' = '11/1759100000000.jpg', 'trocar devolve a foto velha, para apagar do bucket');
end $$;

do $$ declare r jsonb; begin
  -- com o endereço do projeto no Vault (a 32.0 o guarda), é ele que vale
  insert into vault.secrets (name, secret) values ('soma_url_projeto', 'https://exemplo.supabase.co/');
  perform eu(31, 'pessoal');
  insert into storage.objects (bucket_id, name) values ('fotos', '17/1759300000000.png');
  r := membro_foto_definir('{"registro":17,"caminho":"17/1759300000000.png"}');
  perform ok(r->>'status' = 'ok' and r->>'foto_url' = 'https://exemplo.supabase.co/storage/v1/object/public/fotos/17/1759300000000.png',
             'o Depto. de Pessoal põe a foto da Carla, com o endereço do Vault');
  r := membro_foto_definir('{"registro":17,"caminho":null}');
  perform ok(r->>'status' = 'ok' and (select foto_url from membros where registro = 17) is null
             and r->>'anterior' = '17/1759300000000.png', 'e tira: a ficha volta ao arquivo do repositório');
  update membros set foto_url = 'https://drive.google.com/foto.jpg' where registro = 23;
  insert into storage.objects (bucket_id, name) values ('fotos', '23/1.jpg');
  r := membro_foto_definir('{"registro":23,"caminho":"23/1.jpg"}');
  perform ok(r->>'anterior' is null, 'foto anterior de fora do bucket não é para apagar');
  delete from vault.secrets where name = 'soma_url_projeto';
end $$;

-- ------------------------------------------------------------
-- 3. OS CARTÕES
-- ------------------------------------------------------------
do $$ declare r jsonb; begin
  perform eu(4, 'admin');
  r := atividade_criar(jsonb_build_object('grupo_id', gid('Órtese'), 'titulo', 'Calibrar o encoder',
    'responsavel', 17, 'pessoas', jsonb_build_array(11, '17', 4, 999, 'x', 11),
    'etiquetas', jsonb_build_array(' Firmware ', 'firmware', 'Bancada  2', '')));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'ORT-1', 'cria o ORT-1 com responsável e outras pessoas');
  perform ok((select pessoas from atividades where codigo = 'ORT-1') = '{4,11}',
             'as outras pessoas: só quem existe, sem repetir e sem o responsável');
  perform ok((select etiquetas from atividades where codigo = 'ORT-1') = '{Firmware,"Bancada 2"}',
             'as etiquetas: sem espaço sobrando, e Firmware e firmware são uma');
  perform ok(avisos(11, 'atividade_atribuida') = 1 and avisos(17, 'atividade_atribuida') = 1,
             'responsável e incluídos são avisados');
  perform ok(avisos(4, 'atividade_atribuida') = 0, 'quem criou não se avisa');
  perform ok((select count(*) from atividade_seguidores where atividade_id = atv('ORT-1')) = 3,
             'os três seguem o cartão');
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'incluiu'
                       and para = 'Ana Figueiredo, Bruno Tavares'), 'o histórico diz quem foi incluído');
end $$;

do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  delete from notificacoes;
  r := atividade_editar(jsonb_build_object('id', atv('ORT-1'), 'pessoas', jsonb_build_array(4, 23)));
  perform ok(r->>'status' = 'ok', 'Carla, do grupo, mexe nas pessoas');
  perform ok((select pessoas from atividades where codigo = 'ORT-1') = '{4,23}', 'Diego entra, Bruno sai');
  perform ok(avisos(23, 'atividade_atribuida') = 1 and avisos(4, 'atividade_atribuida') = 0,
             'só quem entrou é avisado');
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'retirou' and para = 'Bruno Tavares'),
             'e quem saiu fica no histórico');
  r := atividade_editar(jsonb_build_object('id', atv('ORT-1'), 'responsavel', 23));
  perform ok((select responsavel from atividades where codigo = 'ORT-1') = 23
             and (select pessoas from atividades where codigo = 'ORT-1') = '{4}',
             'quem vira responsável sai das outras pessoas');
  perform ok(not exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'retirou' and para = 'Diego Prado'),
             'e isso não conta como ter saído do cartão');
  r := atividade_editar(jsonb_build_object('id', atv('ORT-1'), 'etiquetas', jsonb_build_array('Firmware', 'Urgente')));
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'etiquetas'
                       and de = 'Firmware, Bancada 2' and para = 'Firmware, Urgente'), 'trocar etiquetas fica no histórico');
  r := atividade_editar(jsonb_build_object('id', atv('ORT-1'), 'titulo', 'Calibrar o encoder da bancada'));
  perform ok((select pessoas from atividades where codigo = 'ORT-1') = '{4}'
             and (select etiquetas from atividades where codigo = 'ORT-1') = '{Firmware,Urgente}',
             'editar outra coisa não mexe nas pessoas nem nas etiquetas');
  perform eu(11, 'leitura');
  r := atividade_editar(jsonb_build_object('id', atv('ORT-1'), 'pessoas', jsonb_build_array(11)));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno, que só lê a Órtese, não se inclui');
end $$;

do $$ declare r jsonb; ck uuid; it uuid; begin
  perform eu(17, 'leitura');
  r := atividade_checklist(jsonb_build_object('acao', 'lista_criar', 'atividade_id', atv('ORT-1'),
    'titulo', 'Antes de ligar', 'texto', E'- [ ] Conferir a fonte\n- [x] Aterrar a bancada\n\n  3. Medir a tensão  \n'));
  perform ok(r->>'status' = 'ok' and (r->>'itens')::int = 3, 'uma lista colada vira três itens');
  ck := (r->>'id')::uuid;
  perform ok((select string_agg(texto || ':' || feito, ',' order by ordem) from atividade_checklist_itens where checklist_id = ck)
             = 'Conferir a fonte:false,Aterrar a bancada:true,Medir a tensão:false',
             'sem os marcadores, e o "- [x]" já entra feito');
  r := atividade_checklist(jsonb_build_object('acao', 'item_criar', 'checklist_id', ck, 'texto', 'Registrar a leitura'));
  it := (r->>'id')::uuid;
  perform ok((select texto from atividade_checklist_itens where id = it) = 'Registrar a leitura', 'item novo no fim da lista');
  r := atividade_checklist(jsonb_build_object('acao', 'item_marcar', 'item_id', it));
  perform ok((select feito and feito_por = 17 from atividade_checklist_itens where id = it), 'marcar diz quem e quando');
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'concluiu_item'
                       and para = 'Registrar a leitura'), 'concluir um item fica no histórico');
  perform ok((select check_total || '/' || check_feitos from atividades_quadro where codigo = 'ORT-1') = '4/2',
             'o quadro conta a checklist: 2 de 4');
  r := atividade_checklist(jsonb_build_object('acao', 'item_marcar', 'item_id', it, 'feito', false));
  perform ok(not (select feito from atividade_checklist_itens where id = it)
             and (select feito_por from atividade_checklist_itens where id = it) is null, 'desmarcar limpa quem marcou');
  r := atividade_checklist(jsonb_build_object('acao', 'lista_criar', 'atividade_id', atv('ORT-1')));
  perform ok((select titulo from atividade_checklists where id = (r->>'id')::uuid) = 'Checklist', 'lista sem título vira "Checklist"');
  r := atividade_checklist(jsonb_build_object('acao', 'item_mover', 'item_id', it, 'checklist_id', (r->>'id')::uuid, 'ordem', 1));
  perform ok((select checklist_id from atividade_checklist_itens where id = it) <> ck, 'um item muda de lista no mesmo cartão');
  r := atividade_checklist(jsonb_build_object('acao', 'lista_renomear', 'checklist_id', ck, 'titulo', 'Ligar a bancada'));
  perform ok((select titulo from atividade_checklists where id = ck) = 'Ligar a bancada', 'renomear a lista');
  r := atividade_checklist(jsonb_build_object('acao', 'item_editar', 'item_id', it, 'texto', '  '));
  perform ok(r->>'status' = 'invalido', 'item vazio não');
  r := atividade_checklist(jsonb_build_object('acao', 'voar'));
  perform ok(r->>'status' = 'invalido' and r->>'campo' = 'acao', 'ação que não existe volta');
  perform eu(11, 'leitura');
  r := atividade_checklist(jsonb_build_object('acao', 'item_marcar', 'item_id', it));
  perform ok(r->>'status' = 'sem_permissao', 'quem só lê o quadro não marca item');
end $$;

do $$ declare r jsonb; begin
  perform eu(11, 'leitura');
  delete from notificacoes;
  r := atividade_copiar(jsonb_build_object('id', atv('ORT-1'), 'grupo_id', gid('Órtese')));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno lê a Órtese, mas não cria nela');
  r := atividade_copiar(jsonb_build_object('id', atv('ORT-1'), 'grupo_id', gid('Sinais'), 'status', 'backlog'));
  perform ok(r->>'status' = 'ok' and r->>'codigo' = 'SIN-1', 'e copia o cartão para o quadro dele (SIN-1)');
  perform ok((select titulo || '|' || status || '|' || responsavel || '|' || pessoas::text || '|' || etiquetas::text || '|' || copia_de_codigo
                from atividades_quadro where codigo = 'SIN-1')
             = 'Calibrar o encoder da bancada|backlog|23|{4}|{Firmware,Urgente}|ORT-1',
             'a cópia leva título, pessoas, etiquetas, e diz de onde veio');
  perform ok((select check_total || '/' || check_feitos from atividades_quadro where codigo = 'SIN-1') = '4/1',
             'e as checklists, com o que já estava feito');
  perform ok((select count(*) from atividade_comentarios where atividade_id = atv('SIN-1')) = 0, 'comentários não vão');
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'copiou_para' and para = 'SIN-1')
             and exists (select 1 from atividade_log where atividade_id = atv('SIN-1') and tipo = 'copiou_de' and para = 'ORT-1'),
             'os dois cartões registram a cópia');
  perform ok(avisos(23, 'atividade_atribuida') = 1, 'o responsável é avisado do cartão novo');
  r := atividade_copiar(jsonb_build_object('id', atv('ORT-1'), 'grupo_id', gid('Sinais'), 'arquivar', true));
  perform ok(r->>'status' = 'sem_permissao' and r->>'campo' = 'arquivar', 'arquivar o original pede edição no quadro dele');
  perform eu(17, 'leitura');
  r := atividade_copiar(jsonb_build_object('id', atv('ORT-1'), 'grupo_id', gid('Órtese'), 'titulo', 'Calibrar o encoder da bancada 3',
    'com', jsonb_build_object('pessoas', false, 'checklists', false, 'etiquetas', false)));
  perform ok(r->>'codigo' = 'ORT-2' and (select responsavel is null and pessoas = '{}' and etiquetas = '{}' and check_total = 0
               from atividades_quadro where codigo = 'ORT-2'), 'duplicar no mesmo quadro, sem pessoas, etiquetas e checklists');
  r := atividade_copiar(jsonb_build_object('id', atv('ORT-2'), 'grupo_id', gid('Órtese'), 'arquivar', true));
  perform ok(r->>'codigo' = 'ORT-3' and (select arquivada from atividades where codigo = 'ORT-2'),
             'copiar e arquivar o original: mover');
end $$;

do $$ declare r jsonb; c uuid; begin
  perform eu(17, 'leitura');
  r := atividade_comentar(jsonb_build_object('atividade_id', atv('ORT-1'), 'corpo', 'Falta a fonte.', 'mencionados', jsonb_build_array(4)));
  c := (r->>'id')::uuid;
  delete from notificacoes;
  r := atividade_comentario_editar(jsonb_build_object('id', c, 'corpo', 'Falta a fonte. @Ana Figueiredo @Diego Prado', 'mencionados', jsonb_build_array(4, 23)));
  perform ok(r->>'status' = 'ok' and (select editado_em is not null and mencionados = '{4,23}' from atividade_comentarios where id = c),
             'Carla corrige o comentário, que fica marcado como editado');
  perform ok(avisos(23, 'atividade_mencao') = 1 and avisos(4, 'atividade_mencao') = 0,
             'só a menção nova é avisada');
  perform eu(4, 'admin');
  r := atividade_comentario_editar(jsonb_build_object('id', c, 'corpo', 'outro texto'));
  perform ok(r->>'status' = 'sem_permissao', 'nem admin reescreve o comentário de outra pessoa');
  perform eu(11, 'leitura');
  r := atividade_comentario_excluir(jsonb_build_object('id', c));
  perform ok(r->>'status' = 'sem_permissao', 'Bruno não apaga o comentário da Carla');
  perform eu(31, 'pessoal');
  r := atividade_comentario_excluir(jsonb_build_object('id', c));
  perform ok(r->>'status' = 'ok' and not exists (select 1 from atividade_comentarios where id = c), 'o Depto. de Pessoal modera');
  perform ok(exists (select 1 from atividade_log where atividade_id = atv('ORT-1') and tipo = 'apagou_comentario'),
             'e fica no histórico que um comentário saiu');
end $$;

do $$ declare r jsonb; begin
  perform eu(17, 'leitura');
  r := atividade_editar(jsonb_build_object('id', atv('ORT-3'), 'arquivada', true));
  r := atividade_editar(jsonb_build_object('id', atv('ORT-3'), 'arquivada', false));
  perform ok((select string_agg(tipo, ',' order by id) from atividade_log where atividade_id = atv('ORT-3') and tipo in ('arquivou','restaurou'))
             = 'arquivou,restaurou', 'arquivar e restaurar ficam no histórico');
  perform ok((select abertas from atividades_carga where registro = 4) = 2,
             'a carga da Ana conta os cartões em que ela é uma das pessoas (ORT-1 e SIN-1)');
end $$;

-- ------------------------------------------------------------
-- 4. RLS, como usuário comum
-- ------------------------------------------------------------
-- como no Supabase, o papel tem os privilégios da tabela: quem barra é a RLS
grant select on all tables in schema public to authenticated;
grant insert, update, delete on soma_feedback, soma_feedback_votos, atividade_checklist_itens to authenticated;
grant usage, select on all sequences in schema public to authenticated;
set role authenticated;
do $$ declare n integer; pegou boolean := false; begin
  perform eu(11, 'leitura');
  select count(*) into n from soma_feedback_lista;
  perform ok(n = 1, 'RLS: todo mundo lê os relatos');
  begin
    insert into soma_feedback (tipo, titulo, autor) values ('bug', 'Direto na tabela', 11);
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'mas ninguém escreve direto na tabela');
  pegou := false;
  begin
    insert into storage.objects (bucket_id, name) values ('fotos', '17/intruso.jpg');
  exception when insufficient_privilege then pegou := true; end;
  perform ok(pegou, 'RLS do Storage: Bruno não sobe foto na pasta da Carla');
  insert into storage.objects (bucket_id, name) values ('fotos', '11/1759400000000.jpg');
  perform ok(true, 'e sobe na dele');
  select count(*) into n from atividade_checklists where atividade_id = atv('ORT-1');
  perform ok(n = 2, 'RLS: quem lê o quadro lê as checklists');
end $$;
reset role;

-- quadro reservado: quem não entra não vê a checklist nem a pessoa
do $$ declare r jsonb; n integer; begin
  perform eu(31, 'pessoal');
  r := atividade_criar(jsonb_build_object('grupo_id', gid('Depto de Pessoal'), 'titulo', 'Afastamento de alguém'));
  perform atividade_checklist(jsonb_build_object('acao', 'lista_criar', 'atividade_id', (r->>'id')::uuid, 'texto', 'Conferir o atestado'));
  update grupos set reservado = true where nome = 'Depto de Pessoal';
  -- o id vai guardado antes de trocar de papel: como o Bruno, a RLS nem o deixaria achar
  perform set_config('teste.dep', (r->>'id'), false);
end $$;
set role authenticated;
do $$ declare n integer; r jsonb; pegou boolean := false; begin
  perform eu(11, 'leitura');
  select count(*) into n from atividade_checklist_itens i join atividade_checklists k on k.id = i.checklist_id
   join atividades a on a.id = k.atividade_id where a.codigo like 'DEP-%';
  perform ok(n = 0, 'RLS: o quadro reservado esconde a checklist de quem não é do grupo');
  r := atividade_copiar(jsonb_build_object('id', current_setting('teste.dep'), 'grupo_id', gid('Sinais')));
  perform ok(r->>'status' = 'nao_encontrado', 'e ninguém copia de lá para fora, nem sabendo o id');
  -- sem política de escrita, o update direto não alcança linha nenhuma
  update atividade_checklist_itens set texto = 'hack' where texto = 'Conferir a fonte';
  get diagnostics n = row_count;
  perform ok(n = 0, 'nem mexe em item direto na tabela, mesmo no quadro que lê');
end $$;
reset role;

-- ------------------------------------------------------------
-- 5. RODAR DE NOVO
--    A 15.0 não desfaz a 2.17.0 (as funções e as views continuam as
--    dela), e a 2.17.0 de novo não duplica nada.
-- ------------------------------------------------------------
\ir ../v15_atividades.sql
\ir ../2.17.0_notas_fotos_e_cartoes.sql
do $$ declare r jsonb; begin
  perform ok(exists (select 1 from information_schema.columns
                      where table_name = 'atividades_quadro' and column_name = 'check_total'),
             'rodar a 15.0 depois não tira as colunas novas do quadro');
  perform eu(4, 'admin');
  r := atividade_criar(jsonb_build_object('grupo_id', gid('Sinais'), 'titulo', 'Depois da 15.0', 'pessoas', jsonb_build_array(11)));
  perform ok((select pessoas from atividades where codigo = r->>'codigo') = '{11}',
             'e atividade_criar continua aceitando as outras pessoas');
  perform ok((select count(*) from migracoes where id = '2.17.0_notas_fotos_e_cartoes') = 1, 'a 2.17.0 está registrada uma vez');
  perform ok((select count(*) from storage.buckets where id = 'fotos') = 1, 'e o bucket existe uma vez');
end $$;
