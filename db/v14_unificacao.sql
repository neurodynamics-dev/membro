-- ============================================================
-- SOMA 14.0 — MIGRAÇÃO · NeuroDynamics
-- UNIFICAÇÃO: o SOMA · Gestão e o Portal do Membro passam a ser
-- um app só. As duas plataformas sempre usaram este mesmo banco,
-- então não há dado para mover — esta migração não cria tabela de
-- negócio nem altera nenhuma existente.
--
-- O que ela faz é arrumar a casa: até aqui, "qual migração já
-- rodou?" era pergunta de memória. Pior, as versões 10 a 13 foram
-- escritas em dois repositórios ao mesmo tempo, com conteúdos
-- diferentes e o mesmo número — havia dois "SOMA 10.0", dois
-- "11.0", dois "12.0" e dois "13.0", todos aplicados aqui.
--
-- A partir desta versão existe uma linha só, registrada no banco.
--
-- Segura para rodar mais de uma vez.
-- ============================================================

-- ------------------------------------------------------------
-- 1) O registro de migrações
--    Quem responde "isso já rodou?" passa a ser o banco.
-- ------------------------------------------------------------
create table if not exists public.migracoes(
  id          text primary key,
  descricao   text,
  aplicada_em timestamptz not null default now()
);

comment on table public.migracoes is
  'Migrações aplicadas neste projeto, em ordem. Cada arquivo de '
  '/db termina inserindo a própria linha. As de antes da 14.0 '
  'foram registradas retroativamente, com a data em que a 14.0 '
  'rodou — o banco não guardava quando cada uma foi aplicada.';

alter table public.migracoes enable row level security;

-- Leitura para qualquer conta autenticada: é informação de
-- diagnóstico, não dado de pessoa. Escrita ninguém tem pela API —
-- migração roda no SQL Editor, que passa por cima da RLS.
drop policy if exists migracoes_select on public.migracoes;
create policy migracoes_select on public.migracoes
  for select to authenticated using (true);

-- ------------------------------------------------------------
-- 2) A história, registrada retroativamente
--    Os nomes são os dos arquivos em /db/aplicadas/, já sem a
--    colisão: o sufixo diz de qual repositório cada um veio.
--    `on conflict do nothing` mantém a data real de quem já
--    estiver registrado.
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('soma_v06_selecao',           'Processo seletivo: inscrição sem login, etapas e comitê'),
  ('soma_v07_selecao_slots',     'Processo seletivo: agendamento de dinâmicas e entrevistas'),
  ('soma_v08_okrs',              'OKRs: objetivos estratégicos e comentários'),
  ('soma_v09_site',              'Site institucional: projetos editáveis pelo painel'),
  ('soma_v10_apontamento',       'Apontamento semanal: resultados e sinalizações'),
  ('soma_v10_portal',            'Portal do Membro: avisos, solicitações e ouvidoria'),
  ('soma_v11_ps_faq',            'Processo seletivo: FAQ no banco'),
  ('soma_v11_portal_documentos', 'Portal do Membro: biblioteca de documentos'),
  ('soma_v12_ps_dinamica',       'Processo seletivo: dinâmica em grupo'),
  ('soma_v12_portal_agenda',     'Portal do Membro: agenda e sincronização com o Google'),
  ('soma_v13_site_idiomas',      'Site institucional em três idiomas'),
  ('soma_v13_agenda_unificada',  'Agenda unificada: tipos, visibilidade, recorrência e feed')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 3) Esta migração
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v14_unificacao', 'Unificação do SOMA com o Portal do Membro: registro de migrações')
on conflict (id) do nothing;

-- ============================================================
-- FIM — SOMA 14.0
--
-- Confira o que o banco acha que tem:
--
--   select id, aplicada_em from public.migracoes order by id;
--
-- Se alguma linha da seção 2 não corresponder ao que realmente
-- rodou neste projeto, corrija agora — daqui para a frente esta
-- tabela é a fonte da verdade:
--
--   delete from public.migracoes where id = '<id que não rodou>';
--
-- Nada além disso é necessário para esta versão: a unificação é
-- de interface, e as duas plataformas já liam estas mesmas
-- tabelas com as mesmas políticas de RLS.
-- ============================================================
