-- ============================================================
-- SOMA 2.19.2: as salas em tempo real
--
-- O tablet na porta e a sala no celular ouvem um canal de broadcast do
-- Supabase Realtime por sala ("sala-<id>"). O canal não leva dado nenhum:
-- só diz "mudou", e quem ouve consulta de novo pelas funções de sempre
-- (sala_estado, sala_painel), com as mesmas regras de acesso.
--
-- O tablet e o celular avisam o canal quando eles mesmos mudam a sala.
-- Esta migração faz o banco avisar também, para o que muda por fora:
--   - a ocupação avulsa (sala_ocupacoes), de qualquer origem;
--   - um evento da agenda numa sala do LABBIO (criado, mudado, cancelado,
--     apagado; quando muda de sala, as duas salas são avisadas);
--   - uma reserva do LABBIO (criada, mudada, cancelada).
--
-- Usa realtime.send (Supabase). Sem ele, ou se o envio falhar, nada
-- acontece: a gravação nunca é desfeita por causa do aviso, e o tablet
-- segue consultando a cada minuto. Depois da 2.19.2_salas. Pode rodar de novo.
-- ============================================================

create or replace function public.sala_avisar(p_espaco integer)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if p_espaco is null or to_regprocedure('realtime.send(jsonb,text,text,boolean)') is null then return; end if;
  if not exists (select 1 from espacos where id = p_espaco and labbio) then return; end if;
  execute 'select realtime.send($1, $2, $3, false)' using '{}'::jsonb, 'mudou', 'sala-' || p_espaco;
exception when others then null;   -- o aviso nunca derruba a gravação
end $$;

create or replace function public.sala_mudou()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- a sala de antes (mudou ou saiu) e, se é outra, a de agora
  if tg_op <> 'INSERT' then perform sala_avisar(old.espaco_id); end if;
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.espaco_id is distinct from old.espaco_id) then perform sala_avisar(new.espaco_id); end if;
  return null;
end $$;

drop trigger if exists sala_mudou on public.sala_ocupacoes;
create trigger sala_mudou after insert or update or delete on public.sala_ocupacoes
  for each row execute function public.sala_mudou();
drop trigger if exists sala_mudou on public.labbio_reservas;
create trigger sala_mudou after insert or update or delete on public.labbio_reservas
  for each row execute function public.sala_mudou();
-- na agenda, só o que muda a ocupação: data, horário, sala e situação (o título aparece no tablet também)
drop trigger if exists sala_mudou on public.eventos;
create trigger sala_mudou after insert or delete or update of data, hora_inicio, hora_fim, espaco_id, status, titulo, visibilidade, owner_registro
  on public.eventos for each row execute function public.sala_mudou();

revoke execute on function public.sala_avisar(integer) from public, anon, authenticated;
revoke execute on function public.sala_mudou() from public, anon, authenticated;

insert into public.migracoes(id, descricao) values('2.19.2_salas_tempo_real',
 'SOMA 2.19.2: o banco avisa o canal da sala (Realtime, broadcast "sala-<id>") quando muda a ocupação, um evento ou uma reserva do LABBIO; o tablet e o celular atualizam sem esperar')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select tgname, tgrelid::regclass from pg_trigger where tgname = 'sala_mudou';
-- select to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null as realtime_disponivel;
