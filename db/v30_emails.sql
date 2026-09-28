-- ============================================================
-- SOMA 30.0 — MIGRAÇÃO · NeuroDynamics
-- OS E-MAILS DA EQUIPE.
--
--   1. OS LINKS DAS CONTAS: Studio › Configurações › Contas guarda,
--      além do usuário de cada rede, o link dela (studio_config.links).
--      É de lá que o Full mailer tira os ícones do rodapé.
--   2. OS ROTEIROS (email_roteiros): os textos prontos das "pílulas de
--      conhecimento", que apresentam e relembram o que o SOMA faz, cada
--      um com o remetente (a área que assina) e os grupos a quem vai.
--      Dezesseis vêm prontos; a gestão edita e cria outros.
--   3. OS E-MAILS PROGRAMADOS (email_programados): o HTML pronto do Full
--      mailer, o remetente, o destino (a equipe toda, grupos ou pessoas)
--      e a hora. A Edge Function notificar-email pega os que venceram
--      (email_programados_lote), troca {{primeiro_nome}} e {{nome}} para
--      cada destinatário, envia e dá baixa (email_programados_baixa).
--
-- Quem programa: admin e pessoal. A escrita passa pelas funções; a
-- tabela dos programados não aceita escrita direta.
--
-- Pré-requisitos: a 10.0 (portal) e a 19.0 (grupos dentro de grupos).
-- Idempotente. COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- Depois, publique de novo a Edge Function notificar-email.
-- ============================================================

do $$
begin
  if to_regprocedure('public.esta_no_grupo(integer,integer)') is null
     or to_regprocedure('public.papel_atual()') is null
     or to_regprocedure('public.portal_registro_atual()') is null then
    raise exception using message = 'Falta aplicar a 10.0 (portal) e a 19.0 (grupos dentro de grupos).';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. OS LINKS DAS CONTAS DO STUDIO
-- ------------------------------------------------------------
do $$
begin
  if to_regclass('public.studio_config') is not null then
    alter table public.studio_config add column if not exists links jsonb not null default '{}'::jsonb;
    comment on column public.studio_config.links is
      'O link de cada rede da equipe ({"instagram":"https://…"}). O Full mailer monta o rodapé com eles; '
      'o usuário (@…) continua em contas, para as artes.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 2. OS ROTEIROS
-- ------------------------------------------------------------
create table if not exists public.email_roteiros (
  id            uuid primary key default gen_random_uuid(),
  codigo        text not null unique,
  remetente     text not null check (remetente in ('pd','clinica','pessoal','ri','marketing','leadership')),
  grupos        text[] not null default '{}',          -- nomes dos grupos; vazio: a equipe toda
  assunto       text not null check (length(trim(assunto)) > 0),
  preheader     text,
  titulo        text not null check (length(trim(titulo)) > 0),   -- a chamada do corpo
  corpo         text not null check (length(trim(corpo)) > 0),
  cta_rotulo    text,
  cta_link      text check (cta_link is null or cta_link ~* '^(https?://|#/)'),
  ordem         integer not null default 100,
  ativo         boolean not null default true,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
comment on table public.email_roteiros is
  'Os textos prontos das pílulas de conhecimento. {{primeiro_nome}} vira o primeiro nome de quem recebe.';
alter table public.email_roteiros enable row level security;
drop policy if exists eroteiros_gestao on public.email_roteiros;
create policy eroteiros_gestao on public.email_roteiros for all to authenticated
  using (public.papel_atual() in ('admin','pessoal'))
  with check (public.papel_atual() in ('admin','pessoal'));
grant select, insert, update, delete on public.email_roteiros to authenticated;

-- ------------------------------------------------------------
-- 3. OS PROGRAMADOS
-- ------------------------------------------------------------
create table if not exists public.email_programados (
  id             uuid primary key default gen_random_uuid(),
  assunto        text not null check (length(trim(assunto)) > 0),
  remetente      text not null,
  remetente_nome text not null,
  html           text not null check (length(html) between 1 and 400000),
  texto          text not null default '',
  todos          boolean not null default false,
  grupos         integer[] not null default '{}',
  registros      integer[] not null default '{}',
  enviar_em      timestamptz not null,
  status         text not null default 'programado'
                 check (status in ('programado','enviando','enviado','cancelado','erro')),
  roteiro_id     uuid references public.email_roteiros(id) on delete set null,
  criado_por     text,
  criado_em      timestamptz not null default now(),
  enviado_em     timestamptz,
  enviados       integer not null default 0,
  falhas         integer not null default 0,
  erro           text
);
create index if not exists email_programados_fila on public.email_programados (status, enviar_em);
comment on table public.email_programados is
  'E-mails do Full mailer com hora marcada. O HTML já vem pronto; a Edge Function só troca {{primeiro_nome}} e {{nome}}.';
alter table public.email_programados enable row level security;
drop policy if exists eprog_ler on public.email_programados;
create policy eprog_ler on public.email_programados for select to authenticated
  using (public.papel_atual() in ('admin','pessoal'));
revoke insert, update, delete on public.email_programados from authenticated;
grant select on public.email_programados to authenticated;

-- quem recebe: a equipe ativa (e quem está em pausa), pelos grupos
-- (contando os de baixo) ou pelas pessoas escolhidas; com e-mail
create or replace function public.email_destino_membros(p_todos boolean, p_grupos integer[], p_registros integer[])
returns table (registro integer, nome text, email text)
language sql stable security definer set search_path = public as $$
  select m.registro, m.nome, coalesce(nullif(trim(m.email_nro), ''), nullif(trim(m.email_pessoal), '')) as email
    from membros m
   where m.status in ('Ativo', 'Em pausa / avaliação')
     and (coalesce(p_todos, false)
          or m.registro = any(coalesce(p_registros, '{}'))
          or exists (select 1 from unnest(coalesce(p_grupos, '{}')) g where public.esta_no_grupo(g, m.registro)))
   order by m.nome;
$$;
revoke execute on function public.email_destino_membros(boolean, integer[], integer[]) from public, anon, authenticated;

-- a prévia do destino, para a tela: quantos recebem e quem fica sem e-mail
create or replace function public.email_destinatarios(p jsonb)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_total integer; v_sem integer; v_nomes jsonb;
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  select count(*) filter (where email is not null), count(*) filter (where email is null),
         coalesce(jsonb_agg(nome order by nome) filter (where email is null), '[]'::jsonb)
    into v_total, v_sem, v_nomes
    from public.email_destino_membros(coalesce((p->>'todos')::boolean, false),
      coalesce(array(select jsonb_array_elements_text(p->'grupos')::integer), '{}'),
      coalesce(array(select jsonb_array_elements_text(p->'registros')::integer), '{}'));
  return jsonb_build_object('status','ok','total',v_total,'sem_email',v_sem,'sem_email_nomes',v_nomes);
end $$;

-- programar: um e-mail ({…}) ou vários ({"itens":[…]}); com id, edita
-- um que ainda está programado
create or replace function public.email_programar(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_itens jsonb := case when p ? 'itens' then p->'itens' else jsonb_build_array(p) end;
  v jsonb; v_ids uuid[] := '{}'; v_id uuid; v_quando timestamptz;
  v_todos boolean; v_grupos integer[]; v_regs integer[];
  v_quem text := (select nome from membros where registro = public.portal_registro_atual());
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  if jsonb_typeof(v_itens) <> 'array' or jsonb_array_length(v_itens) = 0 then
    return jsonb_build_object('status','invalido','campo','itens');
  end if;
  for v in select * from jsonb_array_elements(v_itens) loop
    v_quando := nullif(v->>'enviar_em','')::timestamptz;
    v_todos  := coalesce((v->>'todos')::boolean, false);
    v_grupos := coalesce(array(select jsonb_array_elements_text(v->'grupos')::integer), '{}');
    v_regs   := coalesce(array(select jsonb_array_elements_text(v->'registros')::integer), '{}');
    if coalesce(trim(v->>'assunto'), '') = '' then return jsonb_build_object('status','invalido','campo','assunto'); end if;
    if coalesce(v->>'html', '') = '' then return jsonb_build_object('status','invalido','campo','html'); end if;
    if coalesce(trim(v->>'remetente_nome'), '') = '' then return jsonb_build_object('status','invalido','campo','remetente'); end if;
    if v_quando is null or v_quando < now() - interval '10 minutes' then
      return jsonb_build_object('status','invalido','campo','enviar_em');
    end if;
    if not v_todos and cardinality(v_grupos) = 0 and cardinality(v_regs) = 0 then
      return jsonb_build_object('status','invalido','campo','destino');
    end if;
    if v ? 'id' and nullif(v->>'id','') is not null then
      update email_programados set
        assunto = v->>'assunto', remetente = coalesce(v->>'remetente',''), remetente_nome = v->>'remetente_nome',
        html = v->>'html', texto = coalesce(v->>'texto',''), todos = v_todos, grupos = v_grupos, registros = v_regs,
        enviar_em = v_quando
       where id = (v->>'id')::uuid and status = 'programado'
      returning id into v_id;
      if v_id is null then return jsonb_build_object('status','nao_encontrado'); end if;
    else
      insert into email_programados (assunto, remetente, remetente_nome, html, texto, todos, grupos, registros,
                                     enviar_em, roteiro_id, criado_por)
      values (v->>'assunto', coalesce(v->>'remetente',''), v->>'remetente_nome', v->>'html', coalesce(v->>'texto',''),
              v_todos, v_grupos, v_regs, v_quando, nullif(v->>'roteiro_id','')::uuid, v_quem)
      returning id into v_id;
    end if;
    v_ids := v_ids || v_id; v_id := null;
  end loop;
  return jsonb_build_object('status','ok','ids', to_jsonb(v_ids));
end $$;

create or replace function public.email_programado_cancelar(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if public.papel_atual() not in ('admin','pessoal') then return jsonb_build_object('status','sem_permissao'); end if;
  update email_programados set status = 'cancelado' where id = p_id and status = 'programado';
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok');
end $$;

-- a fila, para a Edge Function (service role): os que venceram, já com
-- quem recebe. Marca "enviando" ao pegar, para duas execuções ao mesmo
-- tempo não mandarem o mesmo e-mail duas vezes.
create or replace function public.email_programados_lote(p_limite integer default 10)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_out jsonb;
begin
  with vencidos as (
    select id from email_programados
     where status = 'programado' and enviar_em <= now()
     order by enviar_em
     limit greatest(coalesce(p_limite, 10), 1)
     for update skip locked
  ), pegos as (
    update email_programados e set status = 'enviando'
      from vencidos v where e.id = v.id
    returning e.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'assunto', p.assunto, 'remetente_nome', p.remetente_nome, 'html', p.html, 'texto', p.texto,
      'destinatarios', coalesce((select jsonb_agg(jsonb_build_object('registro', d.registro, 'nome', d.nome, 'email', d.email))
                                  from public.email_destino_membros(p.todos, p.grupos, p.registros) d
                                 where d.email is not null), '[]'::jsonb))
    order by p.enviar_em), '[]'::jsonb)
    into v_out from pegos p;
  return v_out;
end $$;

create or replace function public.email_programados_baixa(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_env integer := coalesce((p->>'enviados')::integer, 0); v_fal integer := coalesce((p->>'falhas')::integer, 0);
begin
  update email_programados set
    status = case when v_env > 0 or v_fal = 0 then 'enviado' else 'erro' end,
    enviado_em = now(), enviados = v_env, falhas = v_fal, erro = nullif(p->>'erro','')
   where id = (p->>'id')::uuid and status = 'enviando';
  return jsonb_build_object('status', case when found then 'ok' else 'nao_encontrado' end);
end $$;

revoke execute on function public.email_destinatarios(jsonb)      from public, anon;
revoke execute on function public.email_programar(jsonb)          from public, anon;
revoke execute on function public.email_programado_cancelar(uuid) from public, anon;
revoke execute on function public.email_programados_lote(integer) from public, anon, authenticated;
revoke execute on function public.email_programados_baixa(jsonb)  from public, anon, authenticated;
grant  execute on function public.email_destinatarios(jsonb)      to authenticated;
grant  execute on function public.email_programar(jsonb)          to authenticated;
grant  execute on function public.email_programado_cancelar(uuid) to authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.email_programados_lote(integer) to service_role;
    grant execute on function public.email_programados_baixa(jsonb)  to service_role;
    grant execute on function public.email_destino_membros(boolean, integer[], integer[]) to service_role;
  end if;
end $$;

-- ------------------------------------------------------------
-- 4. AS PÍLULAS QUE JÁ VÊM PRONTAS
--    Uma a cada quatro dias dá dois meses de série. O remetente é a
--    área que assina; os grupos, a quem interessa (vazio: a equipe).
-- ------------------------------------------------------------
insert into public.email_roteiros (codigo, remetente, grupos, assunto, preheader, titulo, corpo, cta_rotulo, cta_link, ordem)
values
('PIL-01', 'pessoal', '{}', 'Novo no SOMA: o placar do LABBIO', 'Ranking do mês e sequência de dias úteis, para todos os membros.',
 'Agora é possível acompanhar o ranking de acessos ao LABBIO',
 E'Olá, {{primeiro_nome}}.\n\nO SOMA passou a mostrar o placar do LABBIO para todos os membros, na página inicial e em Equipe › Presença.\n\nRanking do mês: os dias com check-in de cada pessoa no mês corrente.\nSequência: os dias úteis seguidos com check-in. Fim de semana e feriado não contam nem quebram a sequência.\nNo LABBIO agora: quem fez check-in nas últimas quatro horas.\n\nO check-in continua pelo QR Code da entrada. Com o quiosque desligado, use a folha de check-in afixada no laboratório.',
 'Ver o placar', '#/equipe/presenca', 10),
('PIL-02', 'leadership', '{}', 'A agenda da equipe mudou', 'Dia, semana e mês numa tela só, com resposta pelo e-mail.',
 'Uma agenda só, no modelo do Google Agenda',
 E'Olá, {{primeiro_nome}}.\n\nA agenda do SOMA foi refeita para funcionar como o Google Agenda: dia, semana e mês numa tela só.\n\nCada evento tem página própria, com convidados, local, Meet, repetição e notificações.\nMudar a data ou o horário não apaga o evento: convidados e respostas continuam.\nOs convites chegam por e-mail, e a resposta pode ser dada pelo próprio e-mail.\n\nA agenda também reúne as suas tarefas com prazo, as publicações do Studio e os treinamentos a vencer.',
 'Abrir a agenda', '#/agenda', 20),
('PIL-03', 'pessoal', '{}', 'Declaração de vínculo em PDF, na hora', 'Emitida pelo próprio SOMA, com código verificador.',
 'A declaração de vínculo sai em PDF, sem pedido ao Depto. de Pessoal',
 E'Olá, {{primeiro_nome}}.\n\nA declaração de vínculo é emitida pelo próprio SOMA, em Serviços › Declaração de vínculo.\n\nA primeira folha traz os dados da ficha; a segunda, os treinamentos concluídos e os eventos de que você participou.\nCada emissão tem código verificador e QR Code, conferidos em auth.neurodynamics.dev.\nA segunda via mantém o mesmo código.\n\nSe algum dado da ficha estiver desatualizado, solicite a correção ao Depto. de Pessoal antes de emitir.',
 'Emitir a declaração', '#/servicos/declaracao', 30),
('PIL-04', 'pd', '{NRO_PROJECTS}', 'O rol de arquivos de cada projeto', 'Termo de abertura, USRS e relatórios de teste em um lugar.',
 'Cada projeto tem o seu rol de arquivos',
 E'Olá, {{primeiro_nome}}.\n\nEm Projetos, cada projeto mostra o padrão de documentos que todo projeto da NeuroDynamics deve ter: termo de abertura, USRS, relatórios de teste e as demais séries definidas pelo PMO.\n\nCada linha indica o PN do projeto ou a necessidade de criá-lo.\nO PN nasce em rascunho; a primeira versão enviada segue para revisão.\nNenhuma versão entra em vigor antes da aprovação do grupo revisor.\n\nVerifique o rol do seu projeto e crie os PNs pendentes.',
 'Ver os projetos', '#/projetos', 40),
('PIL-05', 'ri', '{}', 'Registre a participação da equipe em eventos', 'Congressos, feiras e palestras geram declaração de participação.',
 'Eventos externos geram declaração de participação',
 E'Olá, {{primeiro_nome}}.\n\nA participação da equipe em eventos externos é registrada em Serviços › Eventos e participações.\n\nO registro informa quem participou, onde, quando e quantas horas foram dedicadas.\nParticipantes externos entram com nome e e-mail.\nApós a aprovação, cada participante recebe por e-mail a declaração de participação, com código verificador.\n\nRegistre o evento logo após a participação.',
 'Registrar evento', '#/servicos/eventos/novo', 50),
('PIL-06', 'leadership', '{NRO_LEADERSHIP,NRO_MANAGERS}', 'OKRs: o desdobramento em tela infinita', 'Objetivos abertos lado a lado, ligados por fios.',
 'Os OKRs agora se leem como um mapa',
 E'Olá, {{primeiro_nome}}.\n\nA tela de OKRs passou a mostrar a árvore de objetivos num mapa que se arrasta e se amplia.\n\nAbrir um objetivo mostra os desdobramentos abaixo dele, ligados por fios.\nVários objetivos podem ficar abertos ao mesmo tempo.\nO progresso de cada objetivo é calculado pelos objetivos-ponta concluídos.\n\nMantenha status, prazo e responsáveis atualizados e registre o acompanhamento nos comentários.',
 'Abrir os OKRs', '#/okrs', 60),
('PIL-07', 'pessoal', '{}', 'Treinamentos obrigatórios e certificados', 'O que o seu grupo pede, com certificado ao concluir.',
 'Os treinamentos atribuídos ao seu grupo estão no SOMA',
 E'Olá, {{primeiro_nome}}.\n\nEm Treinamentos › Para você estão os treinamentos atribuídos aos seus grupos, com os obrigatórios em primeiro lugar.\n\nCada módulo pode ter vídeo e verificação de conhecimento.\nO progresso é salvo a cada módulo concluído.\nAo concluir, o certificado em PDF fica disponível em Meus certificados.\n\nTreinamentos com revisão nova podem exigir que sejam refeitos.',
 'Ver os treinamentos', '#/treinamentos', 70),
('PIL-08', 'marketing', '{}', 'Studio: peças nas medidas de cada rede', 'Ideias, quadro, calendário e o criador de peças.',
 'O Studio produz as peças da NeuroDynamics',
 E'Olá, {{primeiro_nome}}.\n\nO Studio reúne o planejamento das publicações e um criador de peças com os modelos da marca, no tamanho exato de cada rede.\n\nIdeias: pautas registradas com uma frase e o tipo de publicação.\nQuadro: da produção à aprovação, com lembrete na véspera por e-mail.\nCalendário: o que sai em cada dia, em cada rede.\n\nO acesso ao Studio é concedido por grupo. Para solicitá-lo, use Serviços › Solicitação de acesso.',
 'Abrir o Studio', '#/studio', 80),
('PIL-09', 'pd', '{}', 'Atividades: o quadro do seu grupo', 'Tarefas com prazo aparecem na sua agenda.',
 'Tarefas com prazo aparecem na sua agenda',
 E'Olá, {{primeiro_nome}}.\n\nEm Atividades, cada grupo tem um quadro com as colunas Backlog, A fazer, Em andamento, Em revisão e Concluída.\n\nAs tarefas sob sua responsabilidade aparecem na página inicial e, quando têm prazo, na sua agenda.\nMencionar um colega num comentário envia a ele uma notificação.\nA prioridade é indicada pelo ponto de cor de cada cartão.\n\nMantenha prazos e responsáveis atualizados.',
 'Abrir as atividades', '#/atividades', 90),
('PIL-10', 'pessoal', '{}', 'Cofre de senhas da equipe', 'Usuário, senha e código de duas etapas das contas institucionais.',
 'As contas da equipe ficam no cofre, com o código de duas etapas',
 E'Olá, {{primeiro_nome}}.\n\nO cofre de senhas guarda usuário, senha e código de duas etapas das contas institucionais, em Serviços › Cofre de senhas.\n\nCada pessoa vê apenas as contas dos acessos que possui.\nO código de duas etapas é gerado no próprio cofre.\nToda visualização e cópia fica registrada.\n\nNão compartilhe senhas por mensagem: indique o cofre.',
 'Abrir o cofre', '#/servicos/cofre', 100),
('PIL-11', 'clinica', '{}', 'Registros escritos no portal', 'Atas e relatórios de teste sem baixar o template.',
 'Atas e relatórios de teste são escritos direto no SOMA',
 E'Olá, {{primeiro_nome}}.\n\nA ata de reunião e o relatório de execução de teste são escritos no próprio portal, sem baixar o template.\n\nO formulário segue as seções do template e salva o rascunho automaticamente.\nO PDF é gerado no modelo da NRO, com a revisão em vigor do template.\nO envio segue para a revisão do grupo responsável pela série.\n\nUse esse fluxo nos registros de teste com participantes e equipamentos.',
 'Abrir os arquivos', '#/arquivos', 110),
('PIL-12', 'leadership', '{}', 'A página inicial do SOMA', 'Semana, tarefas e placar numa tela só.',
 'A sua semana em uma tela',
 E'Olá, {{primeiro_nome}}.\n\nA página inicial do SOMA passou a reunir o que importa para a semana.\n\nA semana: os eventos de cada dia, a ocupação do expediente e os convites sem resposta.\nAs suas tarefas: as atrasadas e as de prazo mais próximo primeiro.\nLinks úteis e as telas abertas por último, na coluna da direita.\n\nComece o dia pelo SOMA.',
 'Abrir o SOMA', '#/', 120),
('PIL-13', 'pessoal', '{}', 'Status do dia e intervalos', 'Não perturbe, onde estou e trabalho remoto.',
 'Informe onde você está, sem mensagens em grupo',
 E'Olá, {{primeiro_nome}}.\n\nEm Equipe › Presença é possível definir o status do dia e os intervalos.\n\nNão perturbe: indica foco até o fim do dia.\nOnde estou: informa o local dentro da Escola de Engenharia.\nIntervalos: no LABBIO, trabalho remoto ou fora do escritório, com horário.\n\nFérias e afastamentos são registrados na Agenda, como ausência.',
 'Definir o status', '#/equipe/presenca', 130),
('PIL-14', 'ri', '{NRO_LEADERSHIP,NRO_MANAGERS}', 'Reuniões com stakeholders, prontas em um clique', 'Eventos predefinidos com convidados, local e lembretes.',
 'Eventos predefinidos para as reuniões recorrentes',
 E'Olá, {{primeiro_nome}}.\n\nA agenda do SOMA tem eventos predefinidos, mantidos em Agenda › Configurações › Eventos predefinidos.\n\nCada predefinido traz duração, local, Meet, convidados e notificações.\nAo criar um evento, escolher o predefinido preenche tudo.\nReunião com stakeholder, reunião de gerência e reunião geral já estão disponíveis.\n\nSolicite ao Depto. de Pessoal a inclusão de novos predefinidos.',
 'Criar um evento', '#/agenda/novo', 140),
('PIL-15', 'pd', '{NRO_PROJECTS}', 'Revisão de documentos: nenhuma versão vale antes da aprovação', 'Quem envia não aprova; a versão anterior segue em vigor.',
 'Como funciona a revisão de arquivos',
 E'Olá, {{primeiro_nome}}.\n\nToda versão nova de um arquivo controlado fica pendente até a aprovação do grupo revisor da série.\n\nQuem enviou a versão não pode aprová-la.\nEnquanto a revisão está pendente, a versão anterior continua em vigor.\nA tela Para revisar mostra o que aguarda a sua decisão.\n\nAo enviar, informe o que mudou e confira os arquivos relacionados.',
 'Ver o que aguarda revisão', '#/arquivos/revisoes', 150),
('PIL-16', 'marketing', '{}', 'Atalhos do SOMA', 'Busca global e atalhos de teclado.',
 'Busca e atalhos de teclado',
 E'Olá, {{primeiro_nome}}.\n\nO SOMA tem busca global e atalhos de teclado.\n\n/ ou Ctrl K: abre a busca de telas, pessoas, atividades e eventos.\nNa agenda: T volta a hoje; D, S e M trocam entre dia, semana e mês; J e K avançam e voltam; C cria um evento.\nEsc fecha janelas e menus.\n\nA lista completa está no rodapé do portal, em Atalhos do teclado.',
 'Abrir o SOMA', '#/', 160)
on conflict (codigo) do nothing;

insert into public.migracoes (id, descricao) values
  ('v30_emails', 'E-mails programados pelo Full mailer, os roteiros das pílulas de conhecimento e os links das contas do Studio')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 30.0
-- Depois de aplicar: publique de novo a Edge Function notificar-email.
-- Administração › E-mails: escrever, programar e as pílulas.
-- ============================================================
