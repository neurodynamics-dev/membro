-- ============================================================
-- SOMA 2.18.0 — MIGRAÇÃO · NeuroDynamics
-- Um arquivo só para a versão: cada etapa acrescenta a sua seção.
--
--   Check-in: folha única. Uma só folha de QR ativa por vez; só admin
--     (papel admin) gera; gerar invalida a anterior (o QR antigo passa
--     a ser recusado); o token não é mais legível por select, então o
--     PDF só existe no momento da geração (baixada_em e baixada_por
--     registram quem baixou).
--
-- Pré-requisito: a 29.0 (checkin_folhas).
-- Idempotente.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.checkin_folhas') is null then
    raise exception using message = 'Falta a 29.0 (checkin_folhas).',
      detail = 'Aplique db/v29_presenca_e_inicio.sql antes desta migração.';
  end if;
end $$;

-- ------------------------------------------------------------
-- Check-in: folha única
-- ------------------------------------------------------------
alter table public.checkin_folhas add column if not exists revogada_motivo text;
alter table public.checkin_folhas add column if not exists baixada_em timestamptz;
alter table public.checkin_folhas add column if not exists baixada_por text;

-- as folhas que estavam ativas ao mesmo tempo: fica só a mais recente
update public.checkin_folhas
   set revogada_em = now(), revogada_por = 'Migração 2.18.0', revogada_motivo = 'substituída'
 where revogada_em is null
   and id <> (select id from public.checkin_folhas where revogada_em is null
               order by criada_em desc, numero desc limit 1);

create unique index if not exists checkin_folhas_ativa_unica
  on public.checkin_folhas ((true)) where revogada_em is null;

-- o token só sai na chamada que gera a folha
revoke select on public.checkin_folhas from authenticated;
grant select (id, numero, rotulo, criada_em, criada_por, revogada_em, revogada_por,
              revogada_motivo, usos, ultimo_uso, baixada_em, baixada_por)
  on public.checkin_folhas to authenticated;

create or replace function public.checkin_folha_criar(p_rotulo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare f public.checkin_folhas%rowtype; v_quem text;
begin
  if public.papel_atual() is distinct from 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  v_quem := coalesce(v_quem, 'Portal');
  update checkin_folhas set revogada_em = now(), revogada_por = v_quem, revogada_motivo = 'substituída'
   where revogada_em is null;
  insert into checkin_folhas (rotulo, criada_por, baixada_em, baixada_por)
  values (nullif(trim(p_rotulo),''), v_quem, now(), v_quem)
  returning * into f;
  return jsonb_build_object('status','ok','id',f.id,'numero',f.numero,'token',f.token,'criada_em',f.criada_em,'criada_por',f.criada_por);
end $$;

create or replace function public.checkin_folha_revogar(p_id uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_quem text;
begin
  if public.papel_atual() is distinct from 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  update checkin_folhas set revogada_em = now(), revogada_por = coalesce(v_quem, 'Portal'), revogada_motivo = 'revogada'
   where id = p_id and revogada_em is null;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  return jsonb_build_object('status','ok');
end $$;

revoke execute on function public.checkin_folha_criar(text), public.checkin_folha_revogar(uuid) from public, anon;
grant execute on function public.checkin_folha_criar(text), public.checkin_folha_revogar(uuid) to authenticated;
