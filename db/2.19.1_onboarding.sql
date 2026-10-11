-- ============================================================
-- SOMA 2.19.1: a trilha de onboarding, com progresso no servidor
--
-- Uma trilha versionada (onboarding_trilhas); cada etapa é de leitura
-- (a pessoa marca que leu) ou de fato (o SOMA confere sozinho):
--   dados          Meus dados conferidos nos últimos 180 dias
--   termo          termo de sigilo enviado ou conferido (sem campanha: feito)
--   treinamentos   nenhum treinamento obrigatório pendente
-- O progresso de leitura fica em onboarding_progresso, por pessoa, versão e
-- etapa: retoma em qualquer aparelho. Nada aqui bloqueia o SOMA.
--
-- Depende da 2.19.1_termo (e, por ela, do recadastro), da 2.19.1_trainees e dos treinamentos
-- (v24). Só acrescenta; pode rodar de novo.
-- ============================================================

create table if not exists public.onboarding_trilhas (
  versao    integer primary key,
  etapas    jsonb not null,      -- [{ id, titulo, tipo: 'leitura'|'fato', fato?, ancora? }]
  ativa     boolean not null default true,
  criada_em timestamptz not null default now(),
  criada_por integer references membros(registro));
create unique index if not exists onboarding_trilha_ativa on public.onboarding_trilhas (ativa) where ativa;

create table if not exists public.onboarding_progresso (
  registro    integer not null references membros(registro) on delete cascade,
  versao      integer not null references onboarding_trilhas(versao),
  etapa       text not null,
  concluida_em timestamptz not null default now(),
  primary key (registro, versao, etapa));

do $$ declare t text; begin
  foreach t in array array['onboarding_trilhas', 'onboarding_progresso'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
  end loop;
end $$;

-- a trilha 1, a do plano (o conteúdo de cada etapa mora no tour.html, pela âncora)
insert into public.onboarding_trilhas (versao, etapas) values (1, '[
  {"id":"contexto",     "titulo":"A NeuroDynamics, o LABBIO e os objetivos da equipe", "tipo":"leitura", "ancora":"bem-vindo"},
  {"id":"organizacao",  "titulo":"Áreas, grupos, liderança e a cadeia de reporte",     "tipo":"leitura", "ancora":"equipe"},
  {"id":"dados",        "titulo":"Conferir os seus dados",                              "tipo":"fato", "fato":"dados", "ancora":"conta"},
  {"id":"termo",        "titulo":"Assinar o termo de sigilo do LABBIO",                 "tipo":"fato", "fato":"termo", "ancora":"servicos"},
  {"id":"soma",         "titulo":"Usar o SOMA: tarefas, agenda, presença e Serviços",   "tipo":"leitura", "ancora":"inicio"},
  {"id":"treinamentos", "titulo":"Treinamentos obrigatórios e segurança no laboratório", "tipo":"fato", "fato":"treinamentos", "ancora":"treinamentos"},
  {"id":"proximos",     "titulo":"Próximos passos com a sua liderança",                 "tipo":"leitura", "ancora":"ajuda"}
]'::jsonb) on conflict (versao) do nothing;

-- o fato de cada etapa, conferido agora
create or replace function public.onboarding_fato(p_reg integer, p_fato text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_c text;
begin
  if p_fato = 'dados' then
    return coalesce((public.cadastro_ultima(p_reg)).confirmado_em > now() - interval '180 days', false);
  elsif p_fato = 'termo' then
    v_c := public.termo_campanha_atual();
    return v_c is null or public.termo_situacao(p_reg, v_c) in ('enviado', 'conferido');
  elsif p_fato = 'treinamentos' then
    return not exists (select 1 from treinamentos t where t.status = 'publicado'
                        and public.treinamento_obrigatorio_para(t.id, p_reg) is true
                        and public.treinamento_situacao(t.id, p_reg) is distinct from 'concluido');
  end if;
  return false;
end $$;

create or replace function public.onboarding_de(p_reg integer)
returns jsonb language sql stable security definer set search_path = public as $$
  with t as (select * from onboarding_trilhas where ativa limit 1),
  e as (select x, ord from t, jsonb_array_elements(t.etapas) with ordinality as a(x, ord)),
  s as (select e.ord, e.x, case when e.x->>'tipo' = 'fato' then public.onboarding_fato(p_reg, e.x->>'fato')
                                else exists (select 1 from onboarding_progresso p, t where p.registro = p_reg and p.versao = t.versao and p.etapa = e.x->>'id') end as feita,
               (select p.concluida_em from onboarding_progresso p, t where p.registro = p_reg and p.versao = t.versao and p.etapa = e.x->>'id') as feita_em
          from e)
  select jsonb_build_object('versao', (select versao from t),
    'etapas', coalesce((select jsonb_agg(s.x || jsonb_build_object('feita', s.feita, 'feita_em', s.feita_em) order by s.ord) from s), '[]'),
    'feitas', (select count(*) from s where s.feita), 'total', (select count(*) from s)) $$;

create or replace function public.onboarding_meu()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual();
begin
  if v_reg is null or not conta_ativa() then return jsonb_build_object('status', 'sem_registro'); end if;
  return jsonb_build_object('status', 'ok') || onboarding_de(v_reg);
end $$;

-- marcar (ou desmarcar) uma etapa de leitura
create or replace function public.onboarding_marcar(p_etapa text, p_feita boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := portal_registro_atual(); t onboarding_trilhas;
begin
  if v_reg is null or not conta_ativa() then return jsonb_build_object('status', 'sem_registro'); end if;
  select * into t from onboarding_trilhas where ativa;
  if not exists (select 1 from jsonb_array_elements(t.etapas) x where x->>'id' = p_etapa and x->>'tipo' = 'leitura') then
    return jsonb_build_object('status', 'invalido'); end if;
  if p_feita then
    insert into onboarding_progresso (registro, versao, etapa) values (v_reg, t.versao, p_etapa) on conflict do nothing;
  else
    delete from onboarding_progresso where registro = v_reg and versao = t.versao and etapa = p_etapa;
  end if;
  return jsonb_build_object('status', 'ok') || onboarding_de(v_reg);
end $$;

-- a gestão acompanha (Pessoal, admin e liderança); trainees primeiro
create or replace function public.onboarding_painel()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when not (public.conta_ativa() and (public.papel_atual() in ('admin', 'pessoal') or public.tenho_papel('lideranca')))
    then jsonb_build_object('status', 'sem_permissao')
    else jsonb_build_object('status', 'ok', 'versao', (select versao from onboarding_trilhas where ativa),
      'pessoas', coalesce((select jsonb_agg(jsonb_build_object('registro', m.registro, 'nome', m.nome, 'trainee', public.eh_trainee(m.registro),
          'gestor_nome', (select nome from membros g where g.registro = m.gestor_registro),
          'feitas', (o->>'feitas')::integer, 'total', (o->>'total')::integer,
          'pendentes', (select coalesce(jsonb_agg(x->>'titulo'), '[]') from jsonb_array_elements(o->'etapas') x where not (x->>'feita')::boolean))
        order by public.eh_trainee(m.registro) desc, m.nome)
        from membros m cross join lateral (select public.onboarding_de(m.registro) o) q
       where m.status in ('Ativo', 'Em pausa / avaliação')), '[]')) end $$;

-- uma versão nova da trilha (admin); as marcações antigas ficam com a versão delas
create or replace function public.onboarding_trilha_salvar(p_etapas jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v integer; x jsonb;
begin
  if not (conta_ativa() and papel_atual() = 'admin') then return jsonb_build_object('status', 'sem_permissao'); end if;
  if jsonb_typeof(p_etapas) is distinct from 'array' or jsonb_array_length(p_etapas) = 0 then return jsonb_build_object('status', 'invalido'); end if;
  for x in select * from jsonb_array_elements(p_etapas) loop
    if coalesce(x->>'id', '') !~ '^[a-z0-9_-]+$' or length(btrim(coalesce(x->>'titulo', ''))) = 0
       or x->>'tipo' not in ('leitura', 'fato') or (x->>'tipo' = 'fato' and x->>'fato' not in ('dados', 'termo', 'treinamentos'))
      then return jsonb_build_object('status', 'invalido', 'etapa', x); end if;
  end loop;
  select coalesce(max(versao), 0) + 1 into v from onboarding_trilhas;
  update onboarding_trilhas set ativa = false where ativa;
  insert into onboarding_trilhas (versao, etapas, criada_por) values (v, p_etapas, portal_registro_atual());
  return jsonb_build_object('status', 'ok', 'versao', v);
end $$;

do $$ declare f text; begin
  foreach f in array array['onboarding_fato(integer,text)', 'onboarding_de(integer)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon, authenticated';
  end loop;
  foreach f in array array['onboarding_meu()', 'onboarding_marcar(text,boolean)', 'onboarding_painel()', 'onboarding_trilha_salvar(jsonb)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.1_onboarding',
 'SOMA 2.19.1: trilha de onboarding versionada, com progresso no servidor; dados, termo e treinamentos conferidos pelos fatos')
on conflict(id) do nothing;
