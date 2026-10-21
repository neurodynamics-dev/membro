-- ============================================================
-- SOMA 2.19.2: o check-in pela folha confere onde a pessoa está
--
-- Antes, quem tinha o QR da folha registrava presença de qualquer lugar.
-- Agora o celular manda a posição junto com o código da folha e o banco
-- confere se ela cai dentro do raio do LABBIO.
--
--   1. checkin_local: a configuração (uma linha): o centro, o raio e se a
--      conferência está ligada. Nasce com o LABBIO e 150 m;
--   2. registrar_checkin_folha(token, latitude, longitude, precisao_m): a
--      versão só com o token é apagada, para não servir de atalho;
--   3. checkin_local_ler() e checkin_local_salvar(...): a gestão (admin)
--      lê e ajusta a configuração.
--
-- A regra: a distância até o centro, menos a imprecisão do aparelho (no
-- máximo 100 m de desconto), tem de caber no raio. Posição com imprecisão
-- acima do limite (200 m) é recusada: o celular precisa de um sinal melhor.
-- As coordenadas não são guardadas: o que fica é só a presença.
--
-- Atenção: a posição vem do aparelho de quem faz o check-in. Isto barra o
-- check-in de casa por engano ou preguiça; não impede quem forja a
-- localização de propósito.
--
-- Depois da v29 (folhas). Pode rodar de novo.
-- ============================================================

create table if not exists public.checkin_local (
  id            boolean primary key default true check (id),
  ativo         boolean not null default true,
  latitude      double precision not null check (latitude between -90 and 90),
  longitude     double precision not null check (longitude between -180 and 180),
  raio_m        integer not null default 150 check (raio_m between 20 and 5000),
  precisao_max_m integer not null default 200 check (precisao_max_m between 20 and 2000),
  atualizado_em timestamptz not null default now(),
  atualizado_por text);
alter table public.checkin_local enable row level security;
revoke all on public.checkin_local from public, anon, authenticated;

-- o LABBIO (só na primeira vez: depois, a configuração é da gestão)
insert into public.checkin_local (id, latitude, longitude, raio_m, atualizado_por)
values (true, -19.870585008331524, -43.96169940068524, 150, 'Migração 2.19.2')
on conflict (id) do nothing;

-- a distância entre dois pontos da Terra, em metros (fórmula de haversine)
create or replace function public.distancia_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2)
    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2)))) $$;

-- 1. a versão antiga (só o token) sai: o QR sozinho não basta mais
drop function if exists public.registrar_checkin_folha(uuid);

-- 2. o check-in pela folha, agora com a posição
create or replace function public.registrar_checkin_folha(p_token uuid, p_lat double precision default null,
                                                           p_lon double precision default null, p_precisao double precision default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_reg   integer := public.portal_registro_atual();
  v_nome  text;
  v_ult   timestamptz;
  v_mes   integer;
  c       checkin_local;
  v_dist  double precision;
begin
  if auth.uid() is null then return jsonb_build_object('status','sessao'); end if;
  if v_reg is null then return jsonb_build_object('status','sem_vinculo'); end if;
  if not exists (select 1 from checkin_folhas where token = p_token and revogada_em is null) then
    return jsonb_build_object('status','folha_invalida');
  end if;

  select * into c from checkin_local where id;
  if found and c.ativo then
    if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180
       or p_lat <> p_lat or p_lon <> p_lon then   -- NaN é diferente de si mesmo
      return jsonb_build_object('status','sem_localizacao');
    end if;
    if p_precisao is null or p_precisao < 0 or p_precisao <> p_precisao or p_precisao > c.precisao_max_m then
      return jsonb_build_object('status','localizacao_imprecisa','precisao_max_m',c.precisao_max_m);
    end if;
    v_dist := public.distancia_m(c.latitude, c.longitude, p_lat, p_lon);
    if v_dist - least(p_precisao, 100) > c.raio_m then
      return jsonb_build_object('status','fora_do_local','distancia_m',round(v_dist)::integer,'raio_m',c.raio_m);
    end if;
  end if;

  select nome into v_nome from membros where registro = v_reg;
  select max(registrado_em) into v_ult from presencas where registro = v_reg;
  if v_ult is not null and v_ult > now() - interval '4 hours' then
    return jsonb_build_object('status','repetido','nome',v_nome);
  end if;
  insert into presencas (registro, registrado_em, origem) values (v_reg, now(), 'folha');
  update checkin_folhas set usos = usos + 1, ultimo_uso = now() where token = p_token;
  select count(distinct (registrado_em at time zone 'America/Sao_Paulo')::date) into v_mes
    from presencas where registro = v_reg
     and registrado_em >= date_trunc('month', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  return jsonb_build_object('status','ok','nome',v_nome,'visitas_mes',v_mes,
    'anterior', case when v_ult is null then null
      else to_char(v_ult at time zone 'America/Sao_Paulo', 'DD/MM "às" HH24:MI') end);
end $$;

-- 3. a gestão: ler e ajustar (só o admin)
create or replace function public.checkin_local_ler()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c checkin_local;
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  select * into c from checkin_local where id;
  if not found then return jsonb_build_object('status','ok','configurado',false); end if;
  return jsonb_build_object('status','ok','configurado',true,'ativo',c.ativo,'latitude',c.latitude,'longitude',c.longitude,
    'raio_m',c.raio_m,'precisao_max_m',c.precisao_max_m,'atualizado_em',c.atualizado_em,'atualizado_por',c.atualizado_por);
end $$;

create or replace function public.checkin_local_salvar(p_ativo boolean, p_lat double precision, p_lon double precision,
                                                        p_raio integer, p_precisao_max integer default 200)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_quem text;
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status','sem_permissao'); end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then
    return jsonb_build_object('status','invalido','campo','coordenadas'); end if;
  if p_raio is null or p_raio not between 20 and 5000 then return jsonb_build_object('status','invalido','campo','raio'); end if;
  if p_precisao_max is null or p_precisao_max not between 20 and 2000 then return jsonb_build_object('status','invalido','campo','precisao'); end if;
  select nome into v_quem from membros where registro = public.portal_registro_atual();
  insert into checkin_local (id, ativo, latitude, longitude, raio_m, precisao_max_m, atualizado_em, atualizado_por)
  values (true, coalesce(p_ativo, true), p_lat, p_lon, p_raio, p_precisao_max, now(), coalesce(v_quem, 'Portal'))
  on conflict (id) do update set ativo = excluded.ativo, latitude = excluded.latitude, longitude = excluded.longitude,
    raio_m = excluded.raio_m, precisao_max_m = excluded.precisao_max_m, atualizado_em = now(), atualizado_por = excluded.atualizado_por;
  return jsonb_build_object('status','ok');
end $$;

-- 4. permissões
do $$ declare f text; begin
  foreach f in array array['registrar_checkin_folha(uuid,double precision,double precision,double precision)',
                           'checkin_local_ler()', 'checkin_local_salvar(boolean,double precision,double precision,integer,integer)'] loop
    execute 'revoke execute on function public.' || f || ' from public, anon';
    execute 'grant execute on function public.' || f || ' to authenticated';
  end loop;
  revoke execute on function public.distancia_m(double precision,double precision,double precision,double precision) from public, anon;
  grant execute on function public.distancia_m(double precision,double precision,double precision,double precision) to authenticated;
end $$;
select public.conta_ativa_travar();

insert into public.migracoes(id, descricao) values('2.19.2_checkin_local',
 'SOMA 2.19.2: o check-in pela folha confere a posição (centro e raio do LABBIO, 150 m), com a imprecisão do aparelho descontada; a versão só com o token deixa de existir')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select * from public.checkin_local;
-- select public.distancia_m(-19.870585008331524, -43.96169940068524, -19.8715, -43.96169940068524);  -- uns 100 m ao sul
-- Ajustar (admin, pelo app: Equipe › Presença › Local do check-in), ou no SQL Editor:
--   update public.checkin_local set raio_m = 200 where id;
-- Desligar a conferência: update public.checkin_local set ativo = false where id;
