-- ============================================================
-- SOMA 2.19.2: quem já tinha acesso biométrico ao LABBIO antes do SOMA
--
-- Estas pessoas já estão cadastradas na biometria (Intelbras) do LABBIO:
-- registros 001, 002, 009, 011, 012, 016, 018, 030, 032, 043 e 056. O SOMA
-- passa a saber disso: o acesso aparece na ficha delas, no painel do LABBIO
-- (Membros, "Com biometria") e conta na revogação quando alguém sai.
--
-- Não manda aviso nem e-mail e não cria pedido. Quem já está com o acesso
-- ativo fica como está (a data e o responsável não mudam). Registro que não
-- existe em membros, ou de quem já saiu da equipe, é só relatado. Depois da 2.19.1_labbio_acesso. Pode
-- rodar de novo.
-- ============================================================
do $$
declare
  v_item uuid := public.labbio_item_biometria();
  v_regs integer[] := array[1, 2, 9, 11, 12, 16, 18, 30, 32, 43, 56];
  v_novos integer; v_faltam integer[]; v_fora text[];
begin
  if v_item is null then raise exception 'O item labbio_biometria não existe: aplique antes a 2.19.1_labbio_acesso.'; end if;
  select array_agg(r order by r) into v_faltam from unnest(v_regs) r where not exists (select 1 from membros where registro = r);
  -- quem já saiu da equipe fica de fora: o acesso dele é caso de revogação, não de cadastro
  select array_agg(registro || ' (' || status || ')' order by registro) into v_fora from membros
   where registro = any(v_regs) and status not in ('Ativo', 'Em pausa / avaliação');
  insert into acessos_concedidos (registro, item_id, ativo, concedido_em, revogado_em, responsavel)
  select m.registro, v_item, true, current_date, null, 'LABBIO: acesso anterior ao SOMA'
    from membros m where m.registro = any(v_regs) and m.status in ('Ativo', 'Em pausa / avaliação')
  on conflict (registro, item_id) do update set ativo = true, revogado_em = null,
    concedido_em = case when acessos_concedidos.ativo then acessos_concedidos.concedido_em else excluded.concedido_em end,
    responsavel = case when acessos_concedidos.ativo then acessos_concedidos.responsavel else excluded.responsavel end
  where not acessos_concedidos.ativo or acessos_concedidos.revogado_em is not null;
  get diagnostics v_novos = row_count;
  raise notice 'Acesso biométrico registrado ou reativado para % pessoa(s).', v_novos;
  if v_fora is not null then raise notice 'Fora da equipe, sem acesso registrado (confira com o LABBIO): %', v_fora; end if;
  if v_faltam is not null then raise notice 'Registros que não existem em membros (nada feito): %', v_faltam; end if;
end $$;

insert into public.migracoes(id, descricao) values('2.19.2_labbio_biometria_existente',
 'SOMA 2.19.2: o acesso biométrico ao LABBIO que já existia (registros 001, 002, 009, 011, 012, 016, 018, 030, 032, 043 e 056) passa a constar no SOMA, sem aviso')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select a.registro, m.nome, a.ativo, a.concedido_em, a.responsavel from public.acessos_concedidos a
--   join public.membros m on m.registro = a.registro
--  where a.item_id = public.labbio_item_biometria() order by a.registro;
-- Pedidos de biometria ainda abertos dessas pessoas (o LABBIO pode encerrá-los):
-- select p.registro, m.nome, p.etapa from public.labbio_pedidos p join public.membros m on m.registro = p.registro
--  where p.registro in (1, 2, 9, 11, 12, 16, 18, 30, 32, 43, 56) and p.etapa in ('rascunho', 'pessoal', 'labbio', 'devolvido');
