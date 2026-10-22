-- ============================================================
-- SOMA 2.21.0, MIGRAÇÃO, NeuroDynamics
-- OS PROJETOS DO SITE VIRAM PÁGINAS: cada projeto de
-- neurodynamics.dev ganha uma página própria (#/projects/<slug>),
-- com a animação, os números que mostram a importância dele e a
-- produção: cada artigo, estudo, apresentação e parceria.
--
--   1. site_projetos ganha três colunas: a FAMÍLIA de cor da
--      página (uma família secundária do manual da marca), a
--      ANIMAÇÃO (o nome do arquivo em anim/ no site) e o PROJETO do
--      SOMA a que a página corresponde (projetos.id).
--   2. site_projeto_numeros: os números da página. Cada um tem
--      valor, unidade, rótulo nos três idiomas e a ORIGEM: da
--      literatura (com a fonte, obrigatória) ou do próprio projeto.
--   3. site_projeto_saidas: a produção. Tipo (artigo, apresentação,
--      estudo, parceria, prêmio, patente, software), título como foi
--      publicado, veículo, situação, data, link e uma nota curta nos
--      três idiomas. As parcerias também desenham a faixa de
--      parceiros da página.
--   4. Quem escreve: a gestão do site (eh_gestao(), os mesmos que
--      editam os projetos em Administração, Site institucional)
--      escreve e publica tudo. O SUPERVISOR do projeto do SOMA
--      acrescenta números e produção como rascunho, pela página do
--      projeto no portal; o que está no ar só a gestão altera.
--   5. site_projeto_publico(slug): a página inteira numa chamada,
--      com a chave anon. site_projetos_publico() passa a mandar a
--      família e a animação.
--   6. A CARGA: o conteúdo da planilha NRO-MKT-002 (informações
--      públicas dos projetos) substitui os textos de 2023, que
--      descreviam projetos que não são estes. Antes, a tabela
--      inteira é copiada para site_projetos_antes_2_21. A carga roda
--      uma vez só: rodar a migração de novo não desfaz o que o
--      painel editou depois.
--
-- Pré-requisitos: soma_v09 e soma_v13 (site_projetos), a 20.0
-- (projetos) e a 2.18.0 (eh_gestao). Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o site (website) e o portal.
-- ============================================================

do $$
begin
  if to_regclass('public.site_projetos') is null then
    raise exception using message = 'Falta a tabela site_projetos.',
      detail = 'Aplique antes soma_v09_site.sql e soma_v13_site_idiomas.sql (db/aplicadas).';
  end if;
  if to_regclass('public.projetos') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'A 2.21.0 liga cada página do site ao projeto do SOMA (projetos.id).';
  end if;
  if to_regprocedure('public.eh_gestao()') is null then
    raise exception using message = 'Falta aplicar a 2.18.0 antes desta migração.',
      detail = 'Quem escreve no site é a gestão, eh_gestao(), da 2.18.0.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 1. AS COLUNAS NOVAS DE site_projetos
-- ------------------------------------------------------------
alter table public.site_projetos add column if not exists familia    text;
alter table public.site_projetos add column if not exists animacao   text;
alter table public.site_projetos add column if not exists projeto_id uuid references public.projetos(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'site_projetos_familia_ok') then
    alter table public.site_projetos add constraint site_projetos_familia_ok check (familia is null or familia in
      ('ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'site_projetos_animacao_ok') then
    alter table public.site_projetos add constraint site_projetos_animacao_ok
      check (animacao is null or animacao ~ '^[a-z][a-z0-9-]{1,30}$');
  end if;
end $$;
create unique index if not exists site_projetos_projeto on public.site_projetos (projeto_id) where projeto_id is not null;

comment on column public.site_projetos.familia is
  'A família secundária da página do projeto no site (manual da marca): uma por página, sempre chapada.';
comment on column public.site_projetos.animacao is
  'O nome da animação em anim/<nome>.html no site. Vazio: a página mostra a imagem ou o placeholder.';
comment on column public.site_projetos.projeto_id is
  'O projeto do SOMA a que esta página corresponde. O supervisor dele acrescenta números e produção.';

-- ------------------------------------------------------------
-- 2. QUEM ESCREVE
-- ------------------------------------------------------------
create or replace function public.site_gestor()
returns boolean language sql stable security definer
set search_path = public as $$ select public.eh_gestao() $$;

-- o supervisor do projeto do SOMA ligado a esta página
create or replace function public.site_projeto_supervisor(p_site uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select exists (select 1 from site_projetos s join projetos p on p.id = s.projeto_id
                  where s.id = p_site and p.supervisor is not null
                    and p.supervisor = public.portal_registro_atual());
$$;

create or replace function public.site_projeto_pode_editar(p_site uuid)
returns boolean language sql stable security definer
set search_path = public as $$
  select public.site_gestor() or public.site_projeto_supervisor(p_site);
$$;

do $$
declare f text;
begin
  foreach f in array array['site_gestor()','site_projeto_supervisor(uuid)','site_projeto_pode_editar(uuid)'] loop
    execute format('revoke execute on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function public.%s from anon', f); end if;
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ------------------------------------------------------------
-- 3. OS NÚMEROS
--    "57%" é valor 57 e unidade '%'. As unidades e os prefixos são
--    chaves que o site traduz; o rótulo é a frase que segue o
--    número, nos três idiomas. Número da literatura sem fonte não
--    entra.
-- ------------------------------------------------------------
create table if not exists public.site_projeto_numeros (
  id              uuid primary key default gen_random_uuid(),
  site_projeto_id uuid not null references public.site_projetos(id) on delete cascade,
  valor           numeric not null,
  valor_ate       numeric,                       -- faixa: 13 a 30 Hz
  casas           smallint not null default 0 check (casas between 0 and 2),
  prefixo         text not null default '' check (prefixo in ('','mais_de','ate','cerca_de','menos','mais')),
  unidade         text not null default '' check (unidade in
                    ('','%','pp','h','dias','semanas','meses','min','s','ms','mA','Hz','x','mil','milhoes','ano')),
  rotulo          text,
  rotulo_pt       text,
  rotulo_fr       text,
  origem          text not null default 'literatura' check (origem in ('literatura','projeto')),
  fonte           text,
  fonte_url       text check (fonte_url is null or fonte_url ~* '^https?://'),
  ordem           integer not null default 100,
  publicado       boolean not null default false,
  criado_por      integer,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (coalesce(nullif(trim(rotulo),''), nullif(trim(rotulo_pt),''), nullif(trim(rotulo_fr),'')) is not null),
  check (origem <> 'literatura' or nullif(trim(fonte),'') is not null),
  check (valor_ate is null or valor_ate > valor)
);
create index if not exists site_projeto_numeros_proj on public.site_projeto_numeros (site_projeto_id, publicado, ordem);

-- ------------------------------------------------------------
-- 4. A PRODUÇÃO
--    O título fica na língua em que foi publicado (é nome próprio);
--    a nota curta, nos três idiomas. Numa parceria, o título é o
--    nome da instituição e a nota diz o papel dela; imagem_url é o
--    logo (um endereço https ou um arquivo de assets/ do site).
-- ------------------------------------------------------------
create table if not exists public.site_projeto_saidas (
  id              uuid primary key default gen_random_uuid(),
  site_projeto_id uuid not null references public.site_projetos(id) on delete cascade,
  tipo            text not null check (tipo in ('artigo','apresentacao','estudo','parceria','premio','patente','software')),
  titulo          text not null check (nullif(trim(titulo),'') is not null),
  veiculo         text,
  situacao        text not null default 'em_andamento' check (situacao in
                    ('planejado','em_andamento','submetido','aceito','publicado','apresentado','concluido')),
  data            date,
  url             text check (url is null or url ~* '^https?://'),
  imagem_url      text check (imagem_url is null or imagem_url ~* '^(https://|assets/[a-z0-9._-]+$)'),
  nota            text,
  nota_pt         text,
  nota_fr         text,
  ordem           integer not null default 100,
  publicado       boolean not null default false,
  criado_por      integer,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);
create index if not exists site_projeto_saidas_proj on public.site_projeto_saidas (site_projeto_id, publicado, data desc);

-- ------------------------------------------------------------
-- 5. A GUARDA: o supervisor escreve rascunho
--    Sem security definer de propósito: current_user é quem chama.
--    Pela API é authenticated; no SQL Editor e nas tarefas do banco,
--    não, e a guarda não se mete.
-- ------------------------------------------------------------
create or replace function public.site_item_guarda()
returns trigger language plpgsql
set search_path = public as $$
begin
  if tg_op = 'UPDATE' then new.atualizado_em := now(); end if;
  if current_user not in ('authenticated','anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op = 'INSERT' then new.criado_por := public.portal_registro_atual(); end if;
  if tg_op = 'UPDATE' then new.criado_por := old.criado_por; end if;
  if public.site_gestor() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op in ('UPDATE','DELETE') and old.publicado then
    raise exception using errcode = '42501', message = 'no_ar',
      detail = 'Este item está no site. Só a gestão do site altera ou tira do ar o que foi publicado.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  new.publicado := false;
  return new;
end $$;

drop trigger if exists tg_site_numeros_guarda on public.site_projeto_numeros;
create trigger tg_site_numeros_guarda before insert or update or delete on public.site_projeto_numeros
  for each row execute function public.site_item_guarda();
drop trigger if exists tg_site_saidas_guarda on public.site_projeto_saidas;
create trigger tg_site_saidas_guarda before insert or update or delete on public.site_projeto_saidas
  for each row execute function public.site_item_guarda();

alter table public.site_projeto_numeros enable row level security;
alter table public.site_projeto_saidas  enable row level security;

drop policy if exists site_numeros_select on public.site_projeto_numeros;
create policy site_numeros_select on public.site_projeto_numeros
  for select to authenticated using (true);
drop policy if exists site_numeros_write on public.site_projeto_numeros;
create policy site_numeros_write on public.site_projeto_numeros
  for all to authenticated
  using (public.site_projeto_pode_editar(site_projeto_id))
  with check (public.site_projeto_pode_editar(site_projeto_id));

drop policy if exists site_saidas_select on public.site_projeto_saidas;
create policy site_saidas_select on public.site_projeto_saidas
  for select to authenticated using (true);
drop policy if exists site_saidas_write on public.site_projeto_saidas;
create policy site_saidas_write on public.site_projeto_saidas
  for all to authenticated
  using (public.site_projeto_pode_editar(site_projeto_id))
  with check (public.site_projeto_pode_editar(site_projeto_id));

grant select, insert, update, delete on public.site_projeto_numeros, public.site_projeto_saidas to authenticated;

-- ------------------------------------------------------------
-- 6. O QUE O SITE LÊ (chave anon)
-- ------------------------------------------------------------
create or replace function public.site_projetos_publico()
returns jsonb language sql stable security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'slug', p.slug, 'nome', p.nome,
    'tagline', p.tagline, 'tagline_pt', p.tagline_pt, 'tagline_fr', p.tagline_fr,
    'resumo', p.resumo, 'resumo_pt', p.resumo_pt, 'resumo_fr', p.resumo_fr,
    'descricao', p.descricao, 'descricao_pt', p.descricao_pt, 'descricao_fr', p.descricao_fr,
    'status', p.status, 'tags', to_jsonb(p.tags),
    'imagem_url', p.imagem_url, 'familia', p.familia, 'animacao', p.animacao
  ) order by p.ordem, p.nome), '[]'::jsonb)
  from site_projetos p
  where p.publicado;
$$;
grant execute on function public.site_projetos_publico() to anon, authenticated;

create or replace function public.site_projeto_publico(p_slug text)
returns jsonb language sql stable security definer
set search_path = public
as $$
  select coalesce((
    select jsonb_build_object('status', 'ok',
      'projeto', jsonb_build_object(
        'slug', p.slug, 'nome', p.nome,
        'tagline', p.tagline, 'tagline_pt', p.tagline_pt, 'tagline_fr', p.tagline_fr,
        'resumo', p.resumo, 'resumo_pt', p.resumo_pt, 'resumo_fr', p.resumo_fr,
        'descricao', p.descricao, 'descricao_pt', p.descricao_pt, 'descricao_fr', p.descricao_fr,
        'status', p.status, 'tags', to_jsonb(p.tags),
        'imagem_url', p.imagem_url, 'familia', p.familia, 'animacao', p.animacao),
      'numeros', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'valor', n.valor, 'valor_ate', n.valor_ate, 'casas', n.casas,
          'prefixo', nullif(n.prefixo,''), 'unidade', nullif(n.unidade,''),
          'rotulo', n.rotulo, 'rotulo_pt', n.rotulo_pt, 'rotulo_fr', n.rotulo_fr,
          'origem', n.origem, 'fonte', n.fonte, 'fonte_url', n.fonte_url))
          order by n.ordem, n.criado_em)
        from site_projeto_numeros n where n.site_projeto_id = p.id and n.publicado), '[]'::jsonb),
      'saidas', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
          'tipo', s.tipo, 'titulo', s.titulo, 'veiculo', nullif(s.veiculo,''), 'situacao', s.situacao,
          'data', s.data, 'url', s.url, 'imagem_url', s.imagem_url,
          'nota', s.nota, 'nota_pt', s.nota_pt, 'nota_fr', s.nota_fr))
          order by s.data desc nulls last, s.ordem, s.criado_em)
        from site_projeto_saidas s where s.site_projeto_id = p.id and s.publicado), '[]'::jsonb))
      from site_projetos p
     where p.slug = p_slug and p.publicado),
    jsonb_build_object('status', 'nao_encontrado'));
$$;
grant execute on function public.site_projeto_publico(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 7. A CARGA DA PLANILHA NRO-MKT-002 (uma vez só)
--    Guarda a tabela como estava, troca os textos dos projetos que
--    já existiam, cria os que faltavam, tira a Deriva do ar (a
--    planilha não tem nada sobre ela) e deixa a Arabella oculta
--    até o posicionamento ser alinhado (nota da planilha). Os
--    números vêm com a fonte; a apresentação no CBEB 2026 entra
--    como rascunho da Nebula, para a equipe confirmar.
-- ------------------------------------------------------------
do $carga$
begin
  if exists (select 1 from public.migracoes where id = '2.21.0_site_projetos') then
    raise notice 'A carga da 2.21.0 já rodou; nada do que o painel editou foi tocado.';
    return;
  end if;

  if to_regclass('public.site_projetos_antes_2_21') is null then
    create table public.site_projetos_antes_2_21 as table public.site_projetos;
    alter table public.site_projetos_antes_2_21 enable row level security;
    comment on table public.site_projetos_antes_2_21 is
      'Cópia de site_projetos antes da carga da 2.21.0. Sem política: só o SQL Editor lê.';
  end if;

  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('opalina', 'Opalina', 'In progress', 10, true, 'ion', 'opalina', 'Breathing is muscle work too.', 'Respirar também é músculo.', 'Respirer, c''est aussi un travail musculaire.', 'Diaphragm stimulation synchronised with the mechanical ventilator, to preserve the breathing muscles of patients in intensive care and help them come off the ventilator.', 'Estimulação do diafragma sincronizada com o ventilador mecânico, para preservar a musculatura respiratória de pacientes na UTI e ajudar no desmame.', 'Une stimulation du diaphragme synchronisée avec le ventilateur mécanique, pour préserver les muscles respiratoires des patients en réanimation et faciliter le sevrage.', 'After a long time on a ventilator, the diaphragm, the main breathing muscle, loses strength. Breathing without the machine again becomes slower and harder.

Opalina reads the airflow from the ventilator and releases the stimulus, through the phrenic nerve, only while air flows in. Validation starts on the bench and moves on to the preclinical stage.', 'Quem passa muito tempo no ventilador perde força no diafragma, o principal músculo da respiração. Voltar a respirar sem o aparelho fica mais lento e mais difícil.

A Opalina lê o fluxo de ar do ventilador e só libera o estímulo, pelo nervo frênico, enquanto o ar entra. A validação começa em bancada e segue para a fase pré-clínica.', 'Après un long séjour sous ventilateur, le diaphragme, principal muscle de la respiration, perd de sa force. Respirer de nouveau sans la machine devient plus lent et plus difficile.

Opalina lit le débit d''air du ventilateur et ne délivre le stimulus, par le nerf phrénique, que pendant l''inspiration. La validation commence sur banc et se poursuit en phase préclinique.', array['Electrical stimulation','Critical care','Embedded systems']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 57, null, 0, '', '%', 'literatura', 'Levine et al., New England Journal of Medicine, 2008', 'https://www.nejm.org/doi/full/10.1056/NEJMoa070447', 10, true, 'less cross-sectional area in slow-twitch diaphragm fibres after 18 to 69 hours of mechanical ventilation', 'menor área das fibras lentas do diafragma depois de 18 a 69 horas de ventilação mecânica', 'de surface en moins pour les fibres lentes du diaphragme après 18 à 69 heures de ventilation mécanique' from public.site_projetos where slug = 'opalina';
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 79, null, 0, '', '%', 'literatura', 'Demoule et al., Annals of Intensive Care, 2016', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC4974210/', 20, true, 'of patients on prolonged ventilation developed diaphragm dysfunction during their ICU stay', 'dos pacientes em ventilação prolongada tiveram disfunção do diafragma durante a UTI', 'des patients sous ventilation prolongée ont présenté une dysfonction du diaphragme en réanimation' from public.site_projetos where slug = 'opalina';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Visuri', null, 'em_andamento', 'assets/visuri.png', null, 10, true, 'Platforms and resources for development', 'Plataformas e recursos para o desenvolvimento', 'Plateformes et ressources pour le développement' from public.site_projetos where slug = 'opalina';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'InCor, Instituto do Coração do HC FMUSP', null, 'em_andamento', 'assets/incor.png', null, 20, true, 'Facilities and clinical testing', 'Estrutura e execução dos testes clínicos', 'Infrastructure et essais cliniques' from public.site_projetos where slug = 'opalina';
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('orion', 'Órion', 'Completed', 20, true, 'retina', 'orion', 'Exercise for patients under sedation.', 'Exercício para quem está sedado.', 'De l''exercice pour les patients sous sédation.', 'Electrically stimulated cycling for sedated patients in intensive care. The leg muscles contract in time with a bedside cycle ergometer, with no voluntary effort.', 'Pedalada com eletroestimulação para pacientes sedados na UTI. Os músculos das pernas contraem no ritmo de um cicloergômetro de leito, sem esforço voluntário.', 'Un pédalage par électrostimulation pour les patients sédatés en réanimation. Les muscles des jambes se contractent au rythme d''un cycloergomètre de lit, sans effort volontaire.', 'In intensive care, days without moving weaken the muscles. For someone under sedation, active exercise is not possible.

Órion connects Visuri''s ReCARE® stimulator to inertial sensors on the legs, so stimulation follows each phase of the stroke in bed. The project was developed with IMREA HC FMUSP and Hospital São Luiz Jabaquara, responsible for clinical testing.', 'Na UTI, dias sem se mover enfraquecem os músculos. Para quem está sedado, o exercício ativo não é possível.

O Órion liga o eletroestimulador ReCARE®, da Visuri, a sensores inerciais nas pernas, e a estimulação acompanha cada fase da pedalada no leito. O projeto foi desenvolvido com o IMREA HC FMUSP e o Hospital São Luiz Jabaquara, responsáveis pelos testes clínicos.', 'En réanimation, des jours sans bouger affaiblissent les muscles. Pour une personne sous sédation, l''exercice actif est impossible.

Órion relie le stimulateur ReCARE® de Visuri à des capteurs inertiels sur les jambes : la stimulation suit chaque phase du pédalage au lit. Le projet a été mené avec l''IMREA HC FMUSP et l''Hôpital São Luiz Jabaquara, chargés des essais cliniques.', array['Electrical stimulation','Critical care','Inertial sensing']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 40, null, 0, '', '%', 'literatura', 'Appleton et al., Journal of the Intensive Care Society, 2015', 'https://doi.org/10.1177/1751143714563016', 10, true, 'of ICU patients studied developed ICU-acquired weakness', 'dos pacientes de UTI estudados tiveram fraqueza adquirida na UTI', 'des patients de réanimation étudiés ont développé une faiblesse acquise en réanimation' from public.site_projetos where slug = 'orion';
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 1.78, null, 2, 'menos', 'dias', 'literatura', 'Pazo-Palacios et al., Annals of Physical and Rehabilitation Medicine, 2025', 'https://www.sciencedirect.com/science/article/pii/S1877065725000181', 20, true, 'in hospital, on average, when in-bed cycling is added to rehabilitation', 'de internação hospitalar, em média, quando o cicloergômetro no leito se soma à reabilitação', 'd''hospitalisation, en moyenne, lorsque le cycloergomètre au lit s''ajoute à la rééducation' from public.site_projetos where slug = 'orion';
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 0.93, null, 2, 'menos', 'dias', 'literatura', 'Pazo-Palacios et al., Annals of Physical and Rehabilitation Medicine, 2025', 'https://www.sciencedirect.com/science/article/pii/S1877065725000181', 30, true, 'in intensive care in the same meta-analysis, with no significant difference in muscle strength or mortality', 'na UTI, na mesma meta-análise, sem diferença significativa em força muscular ou mortalidade', 'en réanimation dans la même méta-analyse, sans différence significative de force musculaire ni de mortalité' from public.site_projetos where slug = 'orion';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Visuri', null, 'concluido', 'assets/visuri.png', null, 10, true, 'Platforms and resources for development', 'Plataformas e recursos para o desenvolvimento', 'Plateformes et ressources pour le développement' from public.site_projetos where slug = 'orion';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'IMREA, Instituto de Medicina Física e Reabilitação do HC FMUSP', null, 'concluido', 'assets/imrea.png', null, 20, true, 'Facilities and clinical testing', 'Estrutura e execução dos testes clínicos', 'Infrastructure et essais cliniques' from public.site_projetos where slug = 'orion';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Hospital São Luiz Jabaquara', null, 'concluido', null, null, 30, true, 'Facilities and clinical testing', 'Estrutura e execução dos testes clínicos', 'Infrastructure et essais cliniques' from public.site_projetos where slug = 'orion';
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('calima', 'Calima', 'In progress', 30, true, 'ritmo', 'calima', 'Pedalling with your own muscles.', 'Pedalar com os próprios músculos.', 'Pédaler avec ses propres muscles.', 'Electrical stimulation timed to the pedal stroke, for rehabilitation after stroke and incomplete spinal cord injury. A wireless sensor reads the pedal angle and decides when each muscle contracts.', 'Eletroestimulação sincronizada com a pedalada, para reabilitação depois de AVC e de lesão medular incompleta. Um sensor sem fio lê o ângulo do pedal e decide quando cada músculo contrai.', 'Une électrostimulation synchronisée avec le pédalage, pour la rééducation après un AVC et une lésion médullaire incomplète. Un capteur sans fil lit l''angle de la pédale et décide quand chaque muscle se contracte.', 'After a stroke, the leg muscles can still contract, but the command that reaches them is weak. The goal is a contraction strong enough to matter to the body, such as keeping muscle mass and circulation.

The system pairs Visuri''s Connect® stimulator with an inertial sensor on the pedal. Each muscle fires at the right phase of the stroke, on clinic or home cycle ergometers.', 'Depois de um AVC, os músculos das pernas continuam capazes de contrair, mas o comando que chega até eles fica fraco. A meta é uma contração forte o bastante para ter efeito no corpo, como manter a massa muscular e a circulação.

O sistema une o eletroestimulador Connect®, da Visuri, a um sensor inercial no pedal. Cada músculo contrai na fase certa da pedalada, em cicloergômetros de clínica ou de casa.', 'Après un AVC, les muscles des jambes peuvent encore se contracter, mais la commande qui leur parvient est faible. L''objectif est une contraction assez forte pour agir sur le corps, comme préserver la masse musculaire et la circulation.

Le système associe le stimulateur Connect® de Visuri à un capteur inertiel sur la pédale. Chaque muscle se contracte à la bonne phase du pédalage, sur des cycloergomètres en clinique ou à domicile.', array['Electrical stimulation','Rehabilitation','Inertial sensing']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 11.9, null, 1, '', 'milhoes', 'literatura', 'World Stroke Organization, Global Stroke Fact Sheet 2025', 'https://pubmed.ncbi.nlm.nih.gov/39635884/', 10, true, 'new strokes worldwide in 2021', 'de AVCs novos no mundo em 2021', 'de nouveaux AVC dans le monde en 2021' from public.site_projetos where slug = 'calima';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Visuri', null, 'em_andamento', 'assets/visuri.png', null, 10, true, 'Platforms and resources for development', 'Plataformas e recursos para o desenvolvimento', 'Plateformes et ressources pour le développement' from public.site_projetos where slug = 'calima';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Hospital Paulo de Tarso', null, 'em_andamento', 'assets/paulo.png', null, 20, true, 'Facilities and follow-up of clinical testing', 'Estrutura e acompanhamento dos testes clínicos', 'Infrastructure et suivi des essais cliniques' from public.site_projetos where slug = 'calima';
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('nebula', 'Nebula', 'In progress', 40, true, 'dendrito', 'nebula', 'Think of the movement, and the muscle answers.', 'Pensar no movimento, e o músculo responde.', 'Penser au mouvement, et le muscle répond.', 'A non-invasive brain-computer interface that detects movement intention in the EEG and triggers electrical stimulation at that same moment, for rehabilitation after spinal cord injury.', 'Uma interface cérebro-máquina não invasiva que detecta a intenção de movimento no EEG e aciona a eletroestimulação no mesmo instante, para reabilitação depois de lesão medular.', 'Une interface cerveau-machine non invasive qui détecte l''intention de mouvement dans l''EEG et déclenche l''électrostimulation au même instant, pour la rééducation après une lésion médullaire.', 'After a spinal cord injury, the brain still plans the movement, but the signal does not reach the muscle.

Nebula reads the beta rhythm over the frontal cortex, which changes as a person prepares to move. The aim is to detect that intention sooner than motor imagery allows and close the loop with a contraction, to encourage neuroplasticity.', 'Depois de uma lesão medular, o cérebro continua planejando o movimento, mas o sinal não chega ao músculo.

A Nebula lê o ritmo beta no córtex frontal, que muda quando a pessoa se prepara para se mover. A aposta é detectar essa intenção antes do que a imagética motora permite e fechar o ciclo com a contração, para estimular a neuroplasticidade.', 'Après une lésion médullaire, le cerveau planifie toujours le mouvement, mais le signal n''atteint pas le muscle.

Nebula lit le rythme bêta au niveau du cortex frontal, qui change lorsque la personne se prépare à bouger. L''objectif est de détecter cette intention plus tôt que ne le permet l''imagerie motrice et de boucler le cycle par une contraction, pour stimuler la neuroplasticité.', array['Brain-computer interface','EEG','Electrical stimulation']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 15, null, 0, 'mais_de', 'milhoes', 'literatura', 'World Health Organization, Spinal cord injury fact sheet', 'https://www.who.int/news-room/fact-sheets/detail/spinal-cord-injury', 10, true, 'people live with a spinal cord injury worldwide', 'de pessoas vivem com lesão medular no mundo', 'de personnes vivent avec une lésion médullaire dans le monde' from public.site_projetos where slug = 'nebula';
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 13, 30, 0, '', 'Hz', 'projeto', null, null, 20, true, 'the beta rhythm band the interface follows over the frontal cortex', 'a faixa do ritmo beta que a interface acompanha no córtex frontal', 'la bande du rythme bêta que l''interface suit au niveau du cortex frontal' from public.site_projetos where slug = 'nebula';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'apresentacao', 'BCI-FES Integration for Motor Rehabilitation', 'CBEB 2026', 'apresentado', null, null, 10, false, 'Scoping review presented at the Brazilian Congress of Biomedical Engineering', 'Revisão de escopo apresentada no Congresso Brasileiro de Engenharia Biomédica', 'Revue de la portée présentée au Congrès brésilien de génie biomédical' from public.site_projetos where slug = 'nebula';
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('gaia', 'Gaia', 'In progress', 50, true, 'neuron', 'gaia', 'What the evidence says about electrically stimulated cycling.', 'O que a evidência diz sobre pedalar com eletroestimulação.', 'Ce que disent les données sur le pédalage par électrostimulation.', 'A systematic review of FES cycling: protocols, stimulation parameters and clinical outcomes, following the PRISMA guidelines.', 'Uma revisão sistemática sobre FES-cycling: protocolos, parâmetros de estimulação e desfechos clínicos, conforme as diretrizes PRISMA.', 'Une revue systématique du FES-cycling : protocoles, paramètres de stimulation et résultats cliniques, selon les recommandations PRISMA.', 'FES cycling has been studied for decades, but each study applies the therapy differently and measures different outcomes. That makes it hard to tell what works, and for whom.

Gaia searches and appraises the published studies in the main databases of the field, such as PubMed, Embase and PEDro, with independent reviewers. The findings shape the protocols of Calima and Órion.', 'O FES-cycling é estudado há décadas, mas cada pesquisa aplica a terapia de um jeito e mede resultados diferentes. Fica difícil saber o que funciona, e para quem.

A Gaia busca e avalia os estudos publicados nas principais bases da área, como PubMed, Embase e PEDro, com revisores independentes. O resultado orienta os protocolos da Calima e do Órion.', 'Le FES-cycling est étudié depuis des décennies, mais chaque étude applique la thérapie à sa manière et mesure des résultats différents. Difficile de savoir ce qui fonctionne, et pour qui.

Gaia recherche et évalue les études publiées dans les principales bases du domaine, comme PubMed, Embase et PEDro, avec des relecteurs indépendants. Les résultats orientent les protocoles de Calima et d''Órion.', array['Systematic review','Electrical stimulation','Rehabilitation']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('equio', 'Équio', 'Ready to start', 60, true, 'nexo', 'equio', 'Neuromodulation on a device that already exists.', 'Neuromodulação em um aparelho que já existe.', 'La neuromodulation sur un appareil qui existe déjà.', 'Transcranial direct current stimulation (tDCS) and galvanic vestibular stimulation (GVS) on Visuri''s Connect® stimulator, to lower the cost of access to these therapies.', 'Estimulação transcraniana por corrente contínua (tDCS) e estimulação vestibular galvânica (GVS) no eletroestimulador Connect®, da Visuri, para reduzir o custo de acesso a essas terapias.', 'La stimulation transcrânienne à courant continu (tDCS) et la stimulation vestibulaire galvanique (GVS) sur le stimulateur Connect® de Visuri, pour réduire le coût d''accès à ces thérapies.', 'tDCS, with electrodes on the head, is studied in depression, chronic pain and stroke rehabilitation. GVS, applied behind the ears, acts on balance. Both kinds of equipment remain expensive and hard to find.

Équio adapts the hardware and firmware of a platform already used in rehabilitation to deliver stable direct current, with ramps, impedance monitoring and safety limits.', 'A tDCS, com eletrodos sobre a cabeça, é estudada em depressão, dor crônica e reabilitação depois de AVC. A GVS, aplicada atrás das orelhas, atua no equilíbrio. Os dois equipamentos ainda são caros e pouco disponíveis.

O Équio adapta o hardware e o firmware de uma plataforma já usada em reabilitação para gerar corrente contínua estável, com rampas, monitoramento de impedância e limites de segurança.', 'La tDCS, avec des électrodes sur la tête, est étudiée dans la dépression, la douleur chronique et la rééducation après un AVC. La GVS, appliquée derrière les oreilles, agit sur l''équilibre. Les deux équipements restent chers et peu disponibles.

Équio adapte le matériel et le firmware d''une plateforme déjà utilisée en rééducation pour produire un courant continu stable, avec rampes, surveillance de l''impédance et limites de sécurité.', array['Neuromodulation','Firmware','Hardware']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 2, null, 0, 'ate', 'mA', 'projeto', null, null, 10, true, 'the typical tDCS current, delivered through electrodes on the head', 'a corrente típica da tDCS, aplicada por eletrodos sobre a cabeça', 'le courant typique de la tDCS, délivré par des électrodes sur la tête' from public.site_projetos where slug = 'equio';
  insert into public.site_projeto_numeros (site_projeto_id, valor, valor_ate, casas, prefixo, unidade, origem, fonte, fonte_url, ordem, publicado, rotulo, rotulo_pt, rotulo_fr)
  select id, 2025, null, 0, '', 'ano', 'literatura', 'Medical Economics, 2025', 'https://www.medicaleconomics.com/view/flow-neuroscience-wins-first-fda-approval-for-at-home-brain-stimulation-depression-treatment', 20, true, 'the FDA approves the first at-home tDCS device, for major depression', 'a FDA aprova o primeiro aparelho de tDCS de uso em casa, para depressão maior', 'la FDA autorise le premier appareil de tDCS à domicile, pour la dépression majeure' from public.site_projetos where slug = 'equio';
  insert into public.site_projeto_saidas (site_projeto_id, tipo, titulo, veiculo, situacao, imagem_url, url, ordem, publicado, nota, nota_pt, nota_fr)
  select id, 'parceria', 'Visuri', null, 'em_andamento', 'assets/visuri.png', null, 10, true, 'The Connect® platform and resources for development', 'A plataforma Connect® e recursos para o desenvolvimento', 'La plateforme Connect® et des ressources pour le développement' from public.site_projetos where slug = 'equio';
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('zefiro', 'Zéfiro', 'Concept', 70, true, 'glia', 'zefiro', 'The gaze that already speaks can also switch on the TV.', 'O olhar que já conversa também liga a TV.', 'Le regard qui parle déjà peut aussi allumer la télé.', 'A module that learns the signals of the remote controls at home, and an accessible app, so that people who communicate with their eyes can control the devices around them.', 'Um módulo que aprende os sinais dos controles remotos da casa e um aplicativo acessível, para que pessoas que se comunicam pelo olhar controlem os aparelhos ao redor.', 'Un module qui apprend les signaux des télécommandes de la maison et une application accessible, pour que les personnes qui communiquent par le regard pilotent les appareils autour d''elles.', 'People with ALS, high spinal cord injury or cerebral palsy already talk through a tablet, with their eyes or facial movements. Switching on the TV or adjusting the air conditioning still depends on someone else.

Zéfiro links a small infrared emitter to the tablet over Bluetooth and offers an interface built for eye tracking, scanning and switches.', 'Pessoas com ELA, lesão medular alta ou paralisia cerebral já conversam por um tablet, com o olhar ou com movimentos do rosto. Ligar a TV ou ajustar o ar-condicionado ainda depende de outra pessoa.

O Zéfiro conecta um pequeno emissor de infravermelho ao tablet por Bluetooth e oferece uma interface feita para rastreamento ocular, varredura e acionadores.', 'Les personnes atteintes de SLA, de lésion médullaire haute ou de paralysie cérébrale conversent déjà grâce à une tablette, par le regard ou les mouvements du visage. Allumer la télé ou régler la climatisation dépend encore de quelqu''un d''autre.

Zéfiro relie un petit émetteur infrarouge à la tablette en Bluetooth et propose une interface conçue pour le suivi oculaire, le balayage et les contacteurs.', array['Accessibility','Assistive technology','Embedded systems']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('aurora', 'Aurora', 'Concept', 80, true, 'iris', 'aurora', 'The anatomy collection, open in 3D.', 'O acervo de anatomia, aberto em 3D.', 'La collection d''anatomie, ouverte en 3D.', 'Three-dimensional digitisation of UFMG''s collection of anatomical specimens, and a web platform to study each one in the browser or on a phone.', 'Digitalização tridimensional do acervo de peças anatômicas da UFMG e uma plataforma web para estudar cada peça pelo navegador ou pelo celular.', 'La numérisation en trois dimensions de la collection de pièces anatomiques de l''UFMG, et une plateforme web pour étudier chaque pièce dans le navigateur ou sur un téléphone.', 'Anatomical specimens can only be studied inside the laboratory, during class hours, and they wear with handling.

Aurora photographs and scans each specimen to build a 3D model reviewed by faculty, with its structures labelled. The original collection is preserved, with respect for the people whose bodies form it.', 'As peças anatômicas só podem ser estudadas dentro do laboratório, no horário de aula, e se desgastam com o manuseio.

A Aurora fotografa e escaneia cada peça para gerar um modelo 3D revisado por docentes, com as estruturas identificadas. O acervo original fica preservado, com respeito às pessoas cujos corpos o compõem.', 'Les pièces anatomiques ne peuvent être étudiées qu''au laboratoire, aux heures de cours, et elles s''usent à la manipulation.

Aurora photographie et numérise chaque pièce pour produire un modèle 3D relu par des enseignants, avec ses structures identifiées. La collection d''origine est préservée, dans le respect des personnes dont les corps la composent.', array['3D scanning','Education','Software']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;
  insert into public.site_projetos (slug, nome, status, ordem, publicado, familia, animacao, tagline, tagline_pt, tagline_fr, resumo, resumo_pt, resumo_fr, descricao, descricao_pt, descricao_fr, tags)
  values ('arabella', 'Arabella', 'Concept', 90, false, 'plexo', null, 'The data a hospital already has, read together.', 'Os dados que o hospital já tem, lidos juntos.', 'Les données dont l''hôpital dispose déjà, lues ensemble.', 'An artificial intelligence platform that brings together a hospital''s operational and clinical data to forecast demand, length of stay and readmission risk.', 'Uma plataforma de inteligência artificial que reúne dados operacionais e clínicos do hospital para prever demanda, tempo de permanência e risco de reinternação.', 'Une plateforme d''intelligence artificielle qui réunit les données opérationnelles et cliniques de l''hôpital pour prévoir la demande, la durée de séjour et le risque de réhospitalisation.', 'Admissions, exams, records, pharmacy and beds produce data every day, in systems that do not talk to each other.

Arabella integrates these sources, preferably on the HL7 FHIR standard, and uses interpretable models to show bottlenecks and support management decisions, with data protection under Brazil''s LGPD.', 'Admissão, exames, prontuário, farmácia e leitos geram dados todos os dias, em sistemas que não se falam.

A Arabella integra essas fontes, de preferência no padrão HL7 FHIR, e usa modelos interpretáveis para mostrar gargalos e apoiar decisões de gestão, com proteção de dados conforme a LGPD.', 'Admissions, examens, dossiers, pharmacie et lits produisent des données chaque jour, dans des systèmes qui ne communiquent pas.

Arabella intègre ces sources, de préférence selon la norme HL7 FHIR, et utilise des modèles interprétables pour révéler les goulets d''étranglement et appuyer les décisions de gestion, avec une protection des données conforme à la LGPD brésilienne.', array['AI','Clinical data','Interoperability']::text[])
  on conflict (slug) do update set nome = excluded.nome, status = excluded.status, ordem = excluded.ordem, publicado = excluded.publicado, familia = excluded.familia, animacao = excluded.animacao, tagline = excluded.tagline, tagline_pt = excluded.tagline_pt, tagline_fr = excluded.tagline_fr, resumo = excluded.resumo, resumo_pt = excluded.resumo_pt, resumo_fr = excluded.resumo_fr, descricao = excluded.descricao, descricao_pt = excluded.descricao_pt, descricao_fr = excluded.descricao_fr, tags = excluded.tags;

  update public.site_projetos set publicado = false, status = 'On hold', ordem = 100 where slug = 'deriva';

  update public.site_projetos s set projeto_id = p.id
    from public.projetos p
   where s.projeto_id is null and p.codigo = upper(s.slug)
     and not exists (select 1 from public.site_projetos o where o.projeto_id = p.id);
end $carga$;

insert into public.migracoes (id, descricao) values
  ('2.21.0_site_projetos', 'Os projetos do site viram páginas: família de cor, animação e projeto do SOMA em site_projetos; os números (site_projeto_numeros, com fonte) e a produção (site_projeto_saidas: artigos, estudos, parcerias); o supervisor rascunha, a gestão publica; site_projeto_publico(slug); a carga da planilha NRO-MKT-002')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM
-- ------------------------------------------------------------
select p.ordem, p.nome, p.status, case when p.publicado then 'no ar' else 'oculto' end as site,
       p.familia, p.animacao, coalesce(pj.codigo, 'sem projeto do SOMA') as "projeto do SOMA",
       (select count(*) from site_projeto_numeros n where n.site_projeto_id = p.id and n.publicado) as numeros,
       (select count(*) from site_projeto_saidas s where s.site_projeto_id = p.id and s.publicado) as producao
  from site_projetos p left join projetos pj on pj.id = p.projeto_id
 order by p.ordem, p.nome;

-- ============================================================
-- FIM, SOMA 2.21.0
--
-- Depois de rodar:
--   1) confira acima a coluna "projeto do SOMA": a página só se liga
--      sozinha quando o código do projeto é o slug em maiúsculas
--      (NEBULA, CALIMA). As outras se ligam em Administração, Site
--      institucional, no campo Projeto do SOMA;
--   2) publique o site (website) e o portal;
--   3) se precisar do texto antigo de algum projeto, ele está em
--      site_projetos_antes_2_21.
-- ============================================================
