\set ON_ERROR_STOP on
\pset pager off
-- ============================================================
-- Teste da 2.29.0: o NeuroQuiz.
-- Rode num banco feito do tbase do LEIAME com a 2.18.0 aplicada pelo
-- teste dela:
--   bash testes/preparar-base.sh teste tquiz 2.18.0_soma.sql 2.29.0_neuroquiz.sql
-- Um realtime.send falso guarda cada aviso, para conferir que o canal
-- não leva texto, nome nem foto. O relógio do banco não se finge: para
-- simular o tempo de resposta, o teste recua iniciada_em e prazo.
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
  perform set_config('teste.uid', coalesce((select id::text from perfis where registro = p_reg), ''), false);
end $$;

create schema if not exists realtime;
create table if not exists realtime.log (n bigserial primary key, topico text, evento text, payload jsonb);
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean)
returns void language sql as $$ insert into realtime.log (topico, evento, payload) values (topic, event, payload) $$;

\ir ../2.29.0_neuroquiz.sql

-- ------------------------------------------------------------
-- A equipe do teste:
--   90 Lia     liderança (NRO_LEADERSHIP): edita e conduz
--   91 Ana Clara Souza   joga
--   92 Ana Beatriz Lopes joga (outra Ana: o nome curto leva o sobrenome)
--   93 Caio Duarte       joga
--   94 Davi Rocha        joga
--   95 Eva Nunes         Desligada: não joga
-- ------------------------------------------------------------
insert into membros (registro, nome, grupos, status, email_nro, foto_url) values
  (90, 'Lia Quintas',       '{NRO_LEADERSHIP}', 'Ativo',     'lia@nro.dev',  null),
  (91, 'Ana Clara Souza',   '{Sinais}',         'Ativo',     'ana@nro.dev',  'https://exemplo.dev/fotos/91.jpg'),
  (92, 'Ana Beatriz Lopes', '{Sinais}',         'Ativo',     'anab@nro.dev', null),
  (93, 'Caio Duarte',       '{Órtese}',         'Ativo',     'caio@nro.dev', null),
  (94, 'Davi Rocha',        '{Órtese}',         'Ativo',     'davi@nro.dev', null),
  (95, 'Eva Nunes',         '{Órtese}',         'Desligado', 'eva@nro.dev',  null)
on conflict (registro) do nothing;
insert into perfis (id, email, papel, registro, nome) values
  ('00000000-0000-0000-0000-000000000090', 'lia@nro.dev',  'leitura', 90, 'Lia Quintas'),
  ('00000000-0000-0000-0000-000000000091', 'ana@nro.dev',  'leitura', 91, 'Ana Clara Souza'),
  ('00000000-0000-0000-0000-000000000092', 'anab@nro.dev', 'leitura', 92, 'Ana Beatriz Lopes'),
  ('00000000-0000-0000-0000-000000000093', 'caio@nro.dev', 'leitura', 93, 'Caio Duarte'),
  ('00000000-0000-0000-0000-000000000094', 'davi@nro.dev', 'leitura', 94, 'Davi Rocha'),
  ('00000000-0000-0000-0000-000000000095', 'eva@nro.dev',  'leitura', 95, 'Eva Nunes')
on conflict (id) do nothing;

create or replace function sessao() returns uuid language sql as $$
  select id from quiz_sessoes order by criada_em desc limit 1 $$;
create or replace function seq() returns integer language sql as $$
  select seq from quiz_sessoes where id = sessao() $$;
-- recua o relógio da rodada atual: a resposta que chega agora leva p_ms
create or replace function recuar(p_ms integer, p_tempo_s integer default 20) returns void language plpgsql as $$
declare v_ini timestamptz := clock_timestamp() - make_interval(secs => p_ms / 1000.0);
begin
  update quiz_sessoes set iniciada_em = v_ini, prazo = v_ini + make_interval(secs => p_tempo_s) where id = sessao();
  update quiz_rodadas set iniciada_em = v_ini, prazo = v_ini + make_interval(secs => p_tempo_s)
   where sessao_id = sessao() and ordem = (select rodada from quiz_sessoes where id = sessao());
end $$;
create or replace function vencer() returns void language plpgsql as $$
begin
  update quiz_sessoes set prazo = clock_timestamp() - interval '2 seconds' where id = sessao();
  update quiz_rodadas set prazo = clock_timestamp() - interval '2 seconds'
   where sessao_id = sessao() and ordem = (select rodada from quiz_sessoes where id = sessao());
end $$;

-- 1. quem pode
do $$ begin
  raise notice 'Quem pode';
  perform eu(90, 'leitura');
  perform ok(quiz_pode_gerir() and papel_atual() = 'lideranca', 'Lia, da liderança, edita e conduz');
  perform eu(91, 'leitura');
  perform ok(not quiz_pode_gerir() and quiz_pode_jogar(), 'Ana joga, mas não edita');
  perform ok(quiz_perguntas_lista()->>'status' = 'sem_permissao', 'nem lê a lista de perguntas');
  perform ok(quiz_pergunta_salvar('{"texto":"x","alternativas":[]}')->>'status' = 'sem_permissao', 'nem grava');
  perform ok(quiz_sessao_criar()->>'status' = 'sem_permissao', 'nem cria partida');
  perform ok(quiz_membros()->>'status' = 'sem_permissao', 'nem lista os membros pelo quiz');
  perform eu(95, 'leitura');
  perform ok(not quiz_pode_jogar() and quiz_entrar('123456')->>'status' = 'sem_acesso', 'Eva, desligada, não joga');
  perform set_config('teste.uid', '', false);
  perform ok(not quiz_pode_jogar() and quiz_relogio() ? 'agora', 'sem conta, não joga (o relógio responde a qualquer um que entrou)');
end $$;

-- 2. o editor
do $$ declare r jsonb; v_a uuid; v_b uuid; v_c uuid; v_d uuid; v_e uuid; begin
  raise notice 'O editor';
  perform eu(90, 'leitura');
  r := quiz_pergunta_salvar('{"tipo":"classica","texto":"Quantos lados tem um hexágono?","tempo_s":20,
        "alternativas":[{"texto":"Seis","correta":true},{"texto":"Cinco"},{"texto":"Sete"},{"texto":"Oito"}]}');
  v_a := (r->>'id')::uuid;
  perform ok(r->>'status' = 'ok' and (r->>'ativa')::boolean and r->'problemas' = '[]'::jsonb, 'clássica: grava, ativa, sem problema');
  perform ok((select array_agg(letra order by letra) from quiz_alternativas where pergunta_id = v_a) = '{0,1,2,3}'
             and (select correta from quiz_alternativas where pergunta_id = v_a and letra = 0), 'as letras na ordem do array, a A é a certa');
  r := quiz_pergunta_salvar('{"tipo":"quem","texto":"Quem chega primeiro ao laboratório?","tempo_s":20,
        "alternativas":[{"registro":91},{"registro":92},{"registro":93,"correta":true},{"registro":94}]}');
  v_b := (r->>'id')::uuid;
  perform ok(r->>'status' = 'ok' and (r->>'ativa')::boolean, 'quem é quem: grava pelos registros');
  r := quiz_pergunta_salvar('{"tipo":"whatsapp","texto":"Complete a mensagem","autor_registro":91,
        "mensagem":"Bom dia, equipe! Hoje eu…","extra":{"hora":"21:47"},
        "alternativas":[{"texto":"trouxe pão de queijo para todos","correta":true},{"texto":"acordei cedo"},{"texto":"vou à reunião"},{"texto":"estudei"}]}');
  v_c := (r->>'id')::uuid;
  perform ok(r->>'status' = 'ok' and (r->>'ativa')::boolean, 'WhatsApp: autor e mensagem');
  r := quiz_pergunta_salvar('{"tipo":"quem","texto":"Quem toca violão?","tempo_s":10,"pontos":2000,
        "alternativas":[{"registro":93,"correta":true},{"registro":93,"correta":true},{"registro":93,"correta":true},{"registro":93,"correta":true}]}');
  v_d := (r->>'id')::uuid;
  perform ok(r->>'status' = 'ok' and (r->>'ativa')::boolean and r->'problemas' = '["alternativas_iguais"]'::jsonb,
             'o mesmo membro nas quatro, todas certas: só um aviso, continua ativa');
  r := quiz_pergunta_salvar('{"tipo":"quem","texto":"Quem tem uma planta na mesa?",
        "alternativas":[{"registro":91},{"registro":92},{"registro":93},{"registro":999}]}');
  v_e := (r->>'id')::uuid;
  perform ok(not (r->>'ativa')::boolean and r->'problemas' ? 'sem_correta' and r->'problemas' ? 'quem_sem_membro'
             and r->'membros_inexistentes' = '[999]'::jsonb, 'sem correta e com registro que não existe: desativada, com os problemas');
  perform ok(quiz_pergunta_ativar(v_e, true)->>'status' = 'com_problema', 'e não se ativa enquanto tiver problema');
  r := quiz_pergunta_salvar('{"texto":"[membro 42] gosta de café?","alternativas":[{"texto":"Sim","correta":true},{"texto":"Não"}]}');
  perform ok(not (r->>'ativa')::boolean and r->'problemas' = '["marcador_no_texto"]'::jsonb, 'o marcador que sobrou no texto desativa');
  perform quiz_pergunta_excluir((r->>'id')::uuid);
  r := quiz_pergunta_salvar('{"tipo":"whatsapp","texto":"Complete","alternativas":[{"texto":"a","correta":true},{"texto":"b"}]}');
  perform ok(r->'problemas' ? 'whatsapp_sem_autor' and r->'problemas' ? 'whatsapp_sem_mensagem', 'WhatsApp sem autor nem mensagem');
  perform quiz_pergunta_excluir((r->>'id')::uuid);
  perform ok(quiz_pergunta_salvar('{"texto":"","alternativas":[]}')->>'campo' = 'texto', 'texto vazio não grava');
  perform ok(quiz_pergunta_salvar('{"texto":"x","tempo_s":3,"alternativas":[]}')->>'campo' = 'tempo_s', 'tempo fora de 5 a 240 não grava');
  perform ok(quiz_pergunta_salvar('{"texto":"x","pontos":500,"alternativas":[]}')->>'campo' = 'pontos', 'pontos só 0, 1000 ou 2000');
  -- editar mantém o id
  r := quiz_pergunta_salvar(jsonb_build_object('id', v_a, 'tipo', 'classica', 'texto', 'Quantos lados tem um hexágono regular?',
        'alternativas', '[{"texto":"Seis","correta":true},{"texto":"Cinco"},{"texto":"Sete"},{"texto":"Oito"}]'::jsonb));
  perform ok(r->>'id' = v_a::text and (select texto from quiz_perguntas where id = v_a) = 'Quantos lados tem um hexágono regular?',
             'editar grava no mesmo id');
  -- duplicar, ordenar, desativar
  r := quiz_pergunta_duplicar(v_b);
  perform ok((select ordem from quiz_perguntas where id = (r->>'id')::uuid) = (select ordem from quiz_perguntas where id = v_b) + 1
             and not (select ativa from quiz_perguntas where id = (r->>'id')::uuid)
             and (select count(*) from quiz_alternativas where pergunta_id = (r->>'id')::uuid) = 4,
             'duplicar: logo abaixo, desativada, com as alternativas');
  perform quiz_pergunta_excluir((r->>'id')::uuid);
  perform quiz_perguntas_ordenar(array[v_c, v_a, v_b, v_d, v_e]);
  perform ok((select array_agg(id order by ordem) from quiz_perguntas) = array[v_c, v_a, v_b, v_d, v_e], 'reordenar');
  r := quiz_perguntas_lista();
  perform ok(jsonb_array_length(r->'perguntas') = 5 and r->'perguntas'->0->>'tipo' = 'whatsapp'
             and r->'perguntas'->0->'autor'->>'curto' = 'Ana Souza', 'a lista, na ordem, com o autor resolvido (a outra Ana existe: Ana Souza)');
  perform ok(r->'perguntas'->2->'alternativas'->2->'membro'->>'curto' = 'Caio', 'e os membros das alternativas');
  -- importar
  r := quiz_importar('[{"tipo":"classica","texto":"Qual é a capital de Minas Gerais?","origem":"docx:901",
        "alternativas":[{"texto":"Belo Horizonte","correta":true},{"texto":"Ouro Preto"},{"texto":"Uberlândia"},{"texto":"Juiz de Fora"}]},
       {"tipo":"quem","texto":"Quem corre maratona?","origem":"docx:902","alternativas":[{"registro":94,"correta":true},{"registro":91},{"registro":92},{"registro":77}]}]', false);
  perform ok(r->>'status' = 'ok' and (r->>'importadas')::int = 2 and (r->>'ativas')::int = 1
             and r->'resultado'->1->'membros_inexistentes' = '[77]'::jsonb and r->'resultado'->1->>'origem' = 'docx:902',
             'importar: duas entram, a com registro inexistente fica desativada e diz qual');
  perform ok((select max(ordem) from quiz_perguntas) = 7, 'no fim da lista');
  -- só a pergunta importada boa e as quatro do começo jogam; a com problema, não
  perform quiz_pergunta_excluir((select id from quiz_perguntas where origem = 'docx:902'));
  update quiz_perguntas set ativa = false where origem = 'docx:901';
end $$;

-- 3. a partida: criar e entrar
do $$ declare r jsonb; begin
  raise notice 'Criar e entrar';
  perform eu(90, 'leitura');
  r := quiz_sessao_criar('{"titulo":"Integração 2026","leitura_s":5,"placar_cada":1}');
  perform ok(r->>'status' = 'ok' and r->>'pin' ~ '^[0-9]{6}$' and (r->>'total')::int = 4, 'a partida: PIN de seis dígitos e as 4 perguntas ativas sem problema');
  perform ok((select array_agg(pergunta_id order by ordem) from quiz_rodadas where sessao_id = sessao())
             = (select array_agg(id order by ordem) from quiz_perguntas where ativa), 'as rodadas na ordem do editor');
  perform eu(91, 'leitura');
  perform ok(quiz_entrar('000000')->>'status' = 'pin_invalido', 'PIN errado');
  r := quiz_entrar((select pin from quiz_sessoes where id = sessao()));
  perform ok(r->>'status' = 'ok' and r->'sessao'->>'fase' = 'lobby' and r->'eu'->>'curto' = 'Ana Souza'
             and r->'eu'->>'foto_url' = 'https://exemplo.dev/fotos/91.jpg', 'Ana entra com o nome e a foto do SOMA');
  perform ok(quiz_entrar((select pin from quiz_sessoes where id = sessao()))->>'status' = 'ok'
             and (select count(*) from quiz_jogadores where sessao_id = sessao()) = 1, 'entrar de novo não duplica');
  perform eu(92, 'leitura'); perform quiz_entrar((select pin from quiz_sessoes where id = sessao()));
  perform eu(93, 'leitura'); perform quiz_entrar((select pin from quiz_sessoes where id = sessao()));
  perform ok((select curto from quiz_jogadores where registro = 92) = 'Ana Lopes' and (select curto from quiz_jogadores where registro = 93) = 'Caio',
             'nomes curtos: o primeiro, e o sobrenome quando repete');
  perform ok(quiz_estado(sessao())->>'jogadores_n' = '3', 'três no lobby');
  perform eu(94, 'leitura');
  perform ok(quiz_estado(sessao())->>'status' = 'fora', 'quem não entrou não lê o estado');
  perform eu(90, 'leitura');
  r := quiz_tv(sessao());
  perform ok(r->'sessao'->>'fase' = 'lobby' and jsonb_array_length(r->'jogadores') = 3 and r->'jogadores'->0->>'curto' = 'Ana Souza',
             'a TV vê o lobby com os três, na ordem de chegada');
end $$;

-- 4. a primeira pergunta (WhatsApp)
do $$ declare r jsonb; v_seq integer; v_txt text; begin
  raise notice 'A primeira pergunta';
  perform eu(90, 'leitura');
  v_seq := seq();
  perform ok(quiz_avancar(sessao(), v_seq + 7)->>'passo' = 'desatualizado' and seq() = v_seq, 'o seq errado não anda');
  r := quiz_avancar(sessao(), v_seq);
  perform ok(r->>'passo' = 'ok' and r->'sessao'->>'fase' = 'pergunta' and (r->'sessao'->>'rodada')::int = 1, 'o espaço libera a pergunta 1');
  perform ok(quiz_avancar(sessao(), v_seq)->>'passo' = 'desatualizado' and (select rodada from quiz_sessoes where id = sessao()) = 1,
             'o segundo toque, com o seq velho, não pula pergunta');
  perform ok((select abs(extract(epoch from iniciada_em - liberada_em) - 5) < 0.01 and prazo = iniciada_em + interval '20 seconds'
                from quiz_rodadas where sessao_id = sessao() and ordem = 1), 'abre 5 s depois de liberar, e o prazo é 20 s depois');
  perform ok(not (r->'pergunta'->'alternativas'->0 ? 'correta') and r->'pergunta'->>'tipo' = 'whatsapp'
             and r->'pergunta'->'autor'->>'curto' = 'Ana Souza', 'a TV recebe a pergunta, sem a correta');
  perform eu(91, 'leitura');
  r := quiz_estado(sessao());
  v_txt := r::text;
  perform ok(r->'pergunta'->>'n_alt' = '4' and not (r->'pergunta' ? 'texto') and not (r->'pergunta' ? 'alternativas')
             and v_txt not like '%correta%' and v_txt not like '%corretas%', 'o celular recebe só o número de botões, e nada da correta');
  perform ok(quiz_responder(sessao(), 1, 0)->>'status' = 'cedo', 'antes de abrir, recusa');
  perform recuar(2000);
  perform ok(quiz_responder(sessao(), 1, 0)->>'status' = 'ok', 'Ana responde A (a certa) em 2 s');
  perform ok(quiz_responder(sessao(), 1, 2)->>'status' = 'ja_respondeu' and quiz_responder(sessao(), 1, 2)->>'letra' = '0',
             'a segunda resposta não entra: vale a primeira');
  perform ok(quiz_estado(sessao())->'minha'->>'letra' = '0', 'recarregou: o celular sabe que já respondeu');
  perform eu(92, 'leitura');
  perform ok(quiz_responder(sessao(), 1, 7)->>'status' = 'invalido', 'letra que não existe');
  perform ok(quiz_responder(sessao(), 2, 1)->>'status' = 'encerrada', 'rodada que não é a atual');
  perform ok(quiz_responder(sessao(), 1, 1)->>'status' = 'ok', 'Ana Beatriz responde B (errada)');
  perform eu(93, 'leitura');
  perform recuar(300);
  perform ok(quiz_responder(sessao(), 1, 0)->>'status' = 'ok', 'Caio responde A em 0,3 s');
  perform ok((select pontos from quiz_respostas where ordem = 1 and uid = '00000000-0000-0000-0000-000000000093') = 1000,
             'até 0,5 s: os 1000');
  perform ok((select pontos between 948 and 951 from quiz_respostas where ordem = 1 and uid = '00000000-0000-0000-0000-000000000091'),
             'em 2 s de 20: 1000 × (1 − 0,1 ÷ 2) = 950');
  perform ok((select pontos = 0 and not correta from quiz_respostas where ordem = 1 and uid = '00000000-0000-0000-0000-000000000092'), 'errada: 0');
  perform eu(94, 'leitura');
  perform quiz_entrar((select pin from quiz_sessoes where id = sessao()));
  perform ok((select count(*) from quiz_jogadores where sessao_id = sessao()) = 4, 'Davi entra com a pergunta aberta');
  perform eu(90, 'leitura');
  r := quiz_tv(sessao());
  perform ok((r->>'respostas_n')::int = 3 and (r->>'jogadores_n')::int = 4, 'a TV conta 3 respostas de 4 jogadores');
  perform vencer();
  perform eu(94, 'leitura');
  perform ok(quiz_responder(sessao(), 1, 0)->>'status' = 'fora_do_prazo', 'depois do prazo, recusa');
  r := quiz_estado(sessao());
  perform ok(r->'sessao'->>'fase' = 'revelacao', 'o prazo venceu: a primeira consulta fecha a rodada');
  perform ok(r->'minha' = 'null'::jsonb and r->'corretas' = '[0]'::jsonb, 'Davi não respondeu: o celular mostra a certa e nada dele');
end $$;

-- 5. a revelação e o placar
do $$ declare r jsonb; begin
  raise notice 'A revelação';
  perform eu(90, 'leitura');
  r := quiz_tv(sessao());
  perform ok(r->'corretas' = '[0]'::jsonb and r->'contagem' = '[2,1,0,0]'::jsonb, 'a TV: a certa e quantos em cada');
  perform ok(r->'pergunta'->'alternativas'->0->>'correta' = 'true', 'na revelação a TV recebe a correta');
  perform ok(r->'placar'->0->>'curto' = 'Caio' and r->'placar'->1->>'curto' = 'Ana Souza', 'o placar: Caio, depois Ana');
  perform eu(91, 'leitura');
  r := quiz_estado(sessao());
  perform ok((r->'minha'->>'correta')::boolean and (r->'minha'->>'pontos')::int between 948 and 951 and r->'eu'->>'posicao' = '2'
             and r->'atras_de'->>'curto' = 'Caio' and (r->'atras_de'->>'diferenca')::int between 49 and 52,
             'Ana: acertou, ~950, 2ª, ~50 atrás do Caio');
  perform ok((select sequencia from quiz_jogadores where registro = 91) = 1 and (select sequencia from quiz_jogadores where registro = 92) = 0
             and (select sequencia from quiz_jogadores where registro = 94) = 0, 'a sequência: quem acertou tem 1; quem errou ou não respondeu, 0');
  perform eu(90, 'leitura');
  r := quiz_avancar(sessao(), seq());
  perform ok(r->'sessao'->>'fase' = 'placar' and jsonb_array_length(r->'placar') = 4, 'placar_cada 1: o placar depois de cada pergunta');
  r := quiz_avancar(sessao(), seq());
  perform ok(r->'sessao'->>'fase' = 'pergunta' and (r->'sessao'->>'rodada')::int = 2, 'e a pergunta 2');
end $$;

-- 6. a sequência e o fechamento pela TV (rodada 2: a clássica, a certa é A)
do $$ declare r jsonb; begin
  raise notice 'A sequência';
  perform recuar(10000);
  perform eu(91, 'leitura'); perform quiz_responder(sessao(), 2, 0);
  perform eu(93, 'leitura'); perform quiz_responder(sessao(), 2, 0);
  perform eu(92, 'leitura'); perform quiz_responder(sessao(), 2, 0);
  perform ok((select pontos between 749 and 750 and bonus = 100 from quiz_respostas where ordem = 2 and uid = '00000000-0000-0000-0000-000000000091'),
             'Ana: 10 s de 20 vale 750, e o segundo acerto seguido +100');
  perform ok((select bonus = 0 from quiz_respostas where ordem = 2 and uid = '00000000-0000-0000-0000-000000000092'),
             'Ana Beatriz acerta, mas não vinha de acerto: sem bônus');
  perform eu(90, 'leitura');
  r := quiz_avancar(sessao(), seq());
  perform ok(r->'sessao'->>'fase' = 'revelacao', 'o espaço na pergunta fecha antes do prazo');
  perform eu(94, 'leitura');
  perform ok(quiz_responder(sessao(), 2, 0)->>'status' = 'encerrada', 'depois de fechar, recusa');
  perform ok((select sequencia from quiz_jogadores where registro = 91) = 2, 'a sequência da Ana vai a 2');
end $$;

-- 7. quem é quem, todas valem em dobro, a reconexão e o fim
do $$ declare r jsonb; v_pin text; begin
  raise notice 'Quem é quem, todas valem, e o pódio';
  perform eu(90, 'leitura');
  perform quiz_avancar(sessao(), seq());                    -- placar
  r := quiz_avancar(sessao(), seq());                       -- pergunta 3: quem é quem
  perform ok((r->'sessao'->>'rodada')::int = 3 and r->'pergunta'->>'tipo' = 'quem'
             and r->'pergunta'->'alternativas'->2->'membro'->>'curto' = 'Caio' and not (r->'pergunta'->'alternativas'->2 ? 'correta'),
             'a rodada 3, quem é quem: a TV recebe os membros, sem a correta');
  perform recuar(1000);
  perform eu(94, 'leitura');
  perform ok(quiz_responder(sessao(), 3, 2)->>'status' = 'ok', 'Davi responde C');
  perform eu(90, 'leitura');
  perform quiz_avancar(sessao(), seq());                    -- revela 3
  perform quiz_avancar(sessao(), seq());                    -- placar
  r := quiz_avancar(sessao(), seq());                       -- pergunta 4: as quatro iguais, 2000
  perform ok((r->'sessao'->>'rodada')::int = 4 and (select pontos from quiz_rodadas where sessao_id = sessao() and ordem = 4) = 2000
             and (select corretas from quiz_rodadas where sessao_id = sessao() and ordem = 4) = '{0,1,2,3}', 'a rodada 4: todas certas, em dobro');
  perform recuar(0, 10);
  perform eu(92, 'leitura');
  perform ok(quiz_responder(sessao(), 4, 3)->>'status' = 'ok', 'Ana Beatriz responde D na hora');
  perform ok((select correta and pontos = 2000 from quiz_respostas where ordem = 4 and uid = '00000000-0000-0000-0000-000000000092'),
             'qualquer letra vale; até 0,5 s, os 2000');
  -- Ana reconecta no meio da rodada: os pontos ficam
  perform eu(91, 'leitura');
  r := quiz_entrar((select pin from quiz_sessoes where id = sessao()));
  perform ok((r->'eu'->>'pontos')::int = (select pontos from quiz_jogadores where registro = 91) and (r->'eu'->>'pontos')::int > 1700
             and r->'sessao'->>'fase' = 'pergunta' and r->'minha' = 'null'::jsonb, 'reconexão pelo PIN: a mesma partida, os mesmos pontos');
  perform eu(90, 'leitura');
  perform quiz_avancar(sessao(), seq());                    -- revela 4
  perform ok((select sequencia from quiz_jogadores where registro = 91) = 0, 'Ana não respondeu a 3 nem a 4: a sequência zera');
  perform ok((select sequencia from quiz_jogadores where registro = 92) = 1, 'Ana Beatriz acertou a 2, não respondeu a 3 (zera) e acertou a 4: sequência 1');
  r := quiz_avancar(sessao(), seq());
  perform ok(r->'sessao'->>'fase' = 'fim' and (select encerrada_em is not null from quiz_sessoes where id = sessao()),
             'depois da última revelação, o fim (sem placar no meio)');
  perform ok(jsonb_array_length(r->'placar') = 4 and (r->'placar'->0->>'posicao')::int = 1, 'o pódio, com a classificação');
  perform ok(quiz_avancar(sessao(), seq())->>'passo' = 'fim', 'no fim, não anda mais');
  v_pin := (select pin from quiz_sessoes where id = sessao());
  perform eu(93, 'leitura');
  r := quiz_entrar(v_pin);
  perform ok(r->'sessao'->>'fase' = 'fim' and jsonb_array_length(r->'podio') = 3, 'quem jogou reabre o pódio pelo PIN');
  perform eu(95, 'leitura');
  perform ok(quiz_entrar(v_pin)->>'status' = 'sem_acesso', 'a conta bloqueada, não');
  perform eu(90, 'leitura');
  perform ok(quiz_entrar(v_pin)->>'status' = 'pin_invalido', 'quem não jogou, não: a partida acabou');
end $$;

-- 8. o canal de tempo real não leva conteúdo
do $$ begin
  raise notice 'O canal';
  perform ok((select count(*) from realtime.log where evento = 'fase' and topico = 'neuroquiz:' || sessao()) >= 10,
             'cada passo avisa o canal da partida');
  perform ok(not exists (select 1 from realtime.log l, jsonb_object_keys(l.payload) k
                          where k not in ('seq','fase','rodada','total','iniciada_em','prazo','n_alt','corretas','n')),
             'o canal só leva seq, fase, rodada, horários, número de botões, as letras certas e contagens');
  perform ok(not exists (select 1 from realtime.log where payload::text ~* '(Ana|Caio|Davi|Lia|foto|texto|queijo|hexágono|Seis)'),
             'nenhum nome, foto ou texto');
  perform ok(not exists (select 1 from realtime.log where evento = 'fase' and payload->>'fase' = 'pergunta' and payload->'corretas' <> 'null'::jsonb),
             'a certa só vai no aviso da revelação');
  perform ok((select max((payload->>'n')::int) from realtime.log where evento = 'respostas' and topico = 'neuroquiz:' || sessao() || ':tv') = 3,
             'a TV recebe a contagem de respostas no canal dela');
end $$;

-- 9. RLS: a tabela não se lê nem se escreve direto
grant usage on schema realtime to authenticated;
set role authenticated;
do $$ declare n integer; begin
  raise notice 'RLS';
  perform eu(91, 'leitura');
  perform ok((select count(*) from quiz_perguntas) = 0 and (select count(*) from quiz_alternativas) = 0
             and (select count(*) from quiz_respostas) = 0 and (select count(*) from quiz_sessoes) = 0, 'quem joga não lê as tabelas (nem a correta)');
  begin
    insert into quiz_respostas (sessao_id, ordem, uid, letra, tempo_ms, correta, pontos)
    values (sessao(), 1, '00000000-0000-0000-0000-000000000094', 0, 0, true, 5000);
    perform ok(false, 'inserir resposta direto deveria falhar');
  exception when insufficient_privilege then perform ok(true, 'nem grava resposta direto');
  end;
  begin
    update quiz_jogadores set pontos = 99999;
    perform ok(false, 'mudar pontos direto deveria falhar');
  exception when insufficient_privilege then perform ok(true, 'nem muda os pontos direto');
  end;
  begin
    perform quiz__revelar(sessao(), false);
    perform ok(false, 'função interna deveria estar fechada');
  exception when insufficient_privilege then perform ok(true, 'as funções internas não abrem para a API');
  end;
  perform eu(90, 'leitura');
  perform ok((select count(*) from quiz_perguntas) = 6 and (select count(*) from quiz_respostas) > 0, 'a gestão lê');
  begin
    delete from quiz_perguntas;
    perform ok(false, 'apagar direto deveria falhar');
  exception when insufficient_privilege then perform ok(true, 'mas também não escreve direto: só pelas funções');
  end;
end $$;
reset role;
set role anon;
do $$ begin
  begin
    perform quiz_entrar('123456');
    perform ok(false, 'anon deveria ser recusado');
  exception when insufficient_privilege then perform ok(true, 'sem login, nenhuma função do quiz');
  end;
end $$;
reset role;

-- 9b. importar substituindo
do $$ declare r jsonb; v_sid uuid; begin
  raise notice 'Importar substituindo';
  perform eu(90, 'leitura');
  v_sid := (quiz_sessao_criar()->>'id')::uuid;
  perform ok(quiz_importar('[{"texto":"Nova?","alternativas":[{"texto":"sim","correta":true},{"texto":"não"}]}]', true)->>'status' = 'partida_aberta',
             'com partida aberta (mesmo no lobby), substituir é recusado');
  perform quiz_sessao_encerrar(v_sid);
  r := quiz_importar('[{"texto":"Nova?","alternativas":[{"texto":"sim","correta":true},{"texto":"não"}]}]', true);
  perform ok(r->>'status' = 'ok' and (select count(*) from quiz_perguntas) = 1, 'encerrada a partida, substitui: fica só a nova');
  perform ok((select count(*) from quiz_rodadas where pergunta_id is null and conteudo ? 'texto') >= 4,
             'as partidas jogadas guardam a fotografia de cada rodada');
end $$;

-- 10. de novo
\ir ../2.29.0_neuroquiz.sql
do $$ begin
  raise notice 'A 2.29.0 de novo';
  perform ok((select count(*) from quiz_perguntas) = 1 and (select count(*) from quiz_sessoes) = 2
             and (select count(*) from quiz_respostas) > 0, 'nada se perde');
  perform ok((select count(*) from migracoes where id = '2.29.0_neuroquiz') = 1, 'a linha em migracoes');
  perform ok((select count(*) from pg_policies where tablename like 'quiz\_%' and policyname = 'quiz_gestao_le') = 6
             and (select count(*) from pg_policies where tablename like 'quiz\_%' and policyname = 'conta_ativa') = 6,
             'as seis tabelas com a leitura da gestão e a trava de conta ativa');
end $$;

\echo '2.29.0: tudo certo'
