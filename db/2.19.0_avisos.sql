-- ============================================================
-- SOMA 2.19.0: quadro de avisos com mais layouts
--
-- Seis layouts novos, vindos dos desenhos de banda e de widget do design
-- system: hero, numero, contagem, lista, citacao e progresso (os cinco de
-- antes continuam). Duas colunas novas:
--   familia  a família de cor do aviso (cortex, ion, ...); vazio = a do layout
--   valor    o número do layout "numero" ou a porcentagem de "progresso"
--
-- A migração só acrescenta: nenhum aviso existente muda. Pode rodar de novo.
-- ============================================================

do $$
begin
  if to_regclass('public.portal_avisos') is null then
    raise exception 'public.portal_avisos não existe: aplique antes a migração soma_v10_portal.sql.';
  end if;
end $$;

alter table public.portal_avisos
  add column if not exists familia text,
  add column if not exists valor   text;

-- a restrição de layout tem nome automático: remove toda check que cite "layout"
do $$
declare c record;
begin
  for c in select conname from pg_constraint
            where conrelid = 'public.portal_avisos'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ilike '%layout%'
  loop
    execute format('alter table public.portal_avisos drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.portal_avisos drop constraint if exists portal_aviso_layout;
alter table public.portal_avisos add constraint portal_aviso_layout check (layout in
  ('padrao','destaque','urgente','evento','conquista','hero','numero','contagem','lista','citacao','progresso'));

alter table public.portal_avisos drop constraint if exists portal_aviso_familia;
alter table public.portal_avisos add constraint portal_aviso_familia check (familia is null or familia in
  ('cortex','ion','neuron','glia','retina','nexo','dendrito','lumen','ritmo','impulso','plexo','iris'));

alter table public.portal_avisos drop constraint if exists portal_aviso_valor;
alter table public.portal_avisos add constraint portal_aviso_valor check (valor is null or char_length(valor) <= 24);

insert into public.migracoes(id, descricao) values('2.19.0_avisos',
 'SOMA 2.19.0: quadro de avisos com os layouts hero, numero, contagem, lista, citacao e progresso; colunas familia e valor')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, aplicada_em from public.migracoes where id='2.19.0_avisos';
-- select column_name from information_schema.columns where table_name='portal_avisos' and column_name in ('familia','valor');
