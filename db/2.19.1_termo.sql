-- ============================================================
-- SOMA 2.19.1: o termo de sigilo do LABBIO (Serviços)
--
-- Depende de 2.19.1_recadastro.sql (os dados conferidos).
--
-- Todos os membros refazem o termo, mesmo quem já tinha um. O caminho:
--   1. dados conferidos (Serviços › Meus dados, ou o recadastro): o termo
--      sai da confirmação mais recente, e ela não pode ter mais de 180 dias;
--   2. baixar o termo: o PDF original do LABBIO (termos/termo_sigilo_labbio_3.pdf),
--      sem nenhuma alteração além dos campos do próprio formulário;
--   3. assinar no gov.br;
--   4. enviar o PDF assinado, guardado como veio (para não quebrar a assinatura).
-- O Pessoal confere o arquivo e pode devolver com motivo.
--
-- O termo é um serviço à parte, sempre disponível. Quem cobra é o
-- recadastro: a campanha 2026/2 inclui o termo e só termina com ele enviado.
--
-- O que esta migração faz:
--   1. termo_campanhas (o modelo vigente), termo_pendencias e termo_envios;
--   2. o bucket privado "termos", com uma pasta por campanha e registro;
--   3. as funções: termo_estado, termo_estado_de, termo_situacao, termo_emitir,
--      termo_registrar_envio, termo_painel, termo_conferir.
-- Só acrescenta; pode rodar de novo.
-- ============================================================

do $$ begin
  if to_regprocedure('public.cadastro_ultima(integer)') is null then
    raise exception 'Aplique antes db/2.19.1_recadastro.sql.';
  end if;
end $$;

-- 1. o modelo, a situação de cada pessoa e o histórico de envios
create table if not exists public.termo_campanhas (
  id            text primary key,
  titulo        text not null,
  modelo        text not null,      -- o PDF original, servido pelo portal
  modelo_sha256 text not null,      -- confere que o modelo não mudou
  ativa         boolean not null default true,
  criada_em     timestamptz not null default now()
);
insert into public.termo_campanhas(id, titulo, modelo, modelo_sha256)
values ('labbio-2026', 'Termo de sigilo do LABBIO', 'termos/termo_sigilo_labbio_3.pdf',
        '7739da5d1285a5062f361dac5f2fd41188133244b18c6f2fa69dc42895a77cec')
on conflict (id) do nothing;

create table if not exists public.termo_pendencias (
  campanha       text not null references public.termo_campanhas(id),
  registro       integer not null,
  emitido_em     timestamptz,
  emitido_dados  jsonb,           -- a fotografia dos dados que foi para o PDF
  enviado_em     timestamptz,
  arquivo        text,            -- caminho no bucket "termos"
  arquivo_sha256 text,
  arquivo_bytes  integer,
  conferido_em   timestamptz,
  conferido_por  text,
  rejeitado_em   timestamptz,
  motivo         text,
  primary key (campanha, registro)
);
create table if not exists public.termo_envios (
  id         bigserial primary key,
  campanha   text not null,
  registro   integer not null,
  arquivo    text not null,
  sha256     text,
  bytes      integer,
  enviado_em timestamptz not null default now()
);
alter table public.termo_campanhas  enable row level security;
alter table public.termo_pendencias enable row level security;
alter table public.termo_envios     enable row level security;
revoke all on public.termo_campanhas, public.termo_pendencias, public.termo_envios from public, anon, authenticated;

-- 2. o bucket privado
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('termos', 'termos', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 3. funções
create or replace function public.termo_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.tenho_papel('pessoal');
$$;

create or replace function public.termo_campanha_atual()
returns text language sql stable security definer set search_path = public as $$
  select id from termo_campanhas where ativa order by criada_em desc limit 1;
$$;

-- pendente, enviado, conferido ou devolvido
create or replace function public.termo_situacao(p_reg integer, p_campanha text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select case
      when t.conferido_em is not null and (t.rejeitado_em is null or t.rejeitado_em < t.conferido_em) then 'conferido'
      when t.enviado_em is not null and (t.rejeitado_em is null or t.rejeitado_em < t.enviado_em) then 'enviado'
      when t.rejeitado_em is not null then 'devolvido'
      else 'pendente' end
    from termo_pendencias t where t.campanha = p_campanha and t.registro = p_reg), 'pendente');
$$;

-- os dados do termo valem se a última confirmação tem até 180 dias
create or replace function public.termo_dados_recentes(p_reg integer)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((public.cadastro_ultima(p_reg)).confirmado_em > now() - interval '180 days', false);
$$;

create or replace function public.termo_estado_de(p_reg integer, p_campanha text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t termo_pendencias; c termo_campanhas; u cadastro_confirmacoes; v_sit text;
begin
  select * into c from termo_campanhas where id = p_campanha;
  if not found then return jsonb_build_object('status', 'nenhum'); end if;
  select * into t from termo_pendencias where campanha = p_campanha and registro = p_reg;
  u := public.cadastro_ultima(p_reg);
  v_sit := public.termo_situacao(p_reg, p_campanha);
  return jsonb_build_object('status', v_sit, 'campanha', c.id, 'titulo', c.titulo,
    'modelo', c.modelo, 'modelo_sha256', c.modelo_sha256,
    'dados_confirmados_em', u.confirmado_em, 'dados_recentes', public.termo_dados_recentes(p_reg),
    -- o termo baixado vale se saiu com os dados da última confirmação
    'emitido_em', case when t.emitido_em is not null and t.emitido_dados is not distinct from u.dados then t.emitido_em end,
    'enviado_em', t.enviado_em, 'conferido_em', t.conferido_em,
    'motivo', case when v_sit = 'devolvido' then t.motivo end);
end $$;

create or replace function public.termo_estado()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual();
begin
  if v_reg is null or v_c is null or not public.cadastro_elegivel(v_reg) then return jsonb_build_object('status', 'nenhum'); end if;
  return public.termo_estado_de(v_reg, v_c);
end $$;

-- o termo baixado: devolve a última confirmação dos dados e a data por extenso
create or replace function public.termo_emitir()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual();
        u cadastro_confirmacoes; c termo_campanhas; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
begin
  if v_reg is null or v_c is null or not public.cadastro_elegivel(v_reg) then return jsonb_build_object('status', 'nenhum'); end if;
  if not public.termo_dados_recentes(v_reg) then return jsonb_build_object('status', 'dados_pendentes'); end if;
  u := public.cadastro_ultima(v_reg);
  insert into termo_pendencias(campanha, registro) values (v_c, v_reg) on conflict do nothing;
  update termo_pendencias set emitido_em = clock_timestamp(), emitido_dados = u.dados where campanha = v_c and registro = v_reg;
  select * into c from termo_campanhas where id = v_c;
  return jsonb_build_object('status', 'ok', 'modelo', c.modelo, 'modelo_sha256', c.modelo_sha256, 'dados', u.dados,
    'dia', extract(day from hoje)::integer, 'mes', meses[extract(month from hoje)::integer], 'ano', extract(year from hoje)::integer,
    'registro', v_reg);
end $$;

-- quem pode ler e gravar no bucket: a própria pessoa, na pasta dela; o Pessoal lê tudo
create or replace function public.termo_arquivo_pode(p_nome text, p_gravar boolean default false)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); partes text[] := string_to_array(p_nome, '/');
begin
  if array_length(partes, 1) <> 3 or partes[3] !~ '^[0-9a-f-]{36}\.pdf$' then return false; end if;
  if p_gravar then
    return v_reg is not null and partes[1] = public.termo_campanha_atual() and partes[2] = v_reg::text;
  end if;
  return public.termo_gestao() or (v_reg is not null and partes[2] = v_reg::text);
end $$;
drop policy if exists termos_ler on storage.objects;
create policy termos_ler on storage.objects for select to authenticated
  using (bucket_id = 'termos' and public.termo_arquivo_pode(name));
drop policy if exists termos_inserir on storage.objects;
create policy termos_inserir on storage.objects for insert to authenticated
  with check (bucket_id = 'termos' and public.termo_arquivo_pode(name, true));

-- o envio do PDF assinado: o termo tem que ter saído com os dados atuais,
-- e o arquivo tem que estar no bucket, na pasta da pessoa
create or replace function public.termo_registrar_envio(p_arquivo text, p_sha256 text, p_bytes integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual(); t termo_pendencias;
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  select * into t from termo_pendencias where campanha = v_c and registro = v_reg;
  if t.emitido_em is null or t.emitido_dados is distinct from (public.cadastro_ultima(v_reg)).dados then
    return jsonb_build_object('status', 'nao_emitido');
  end if;
  if split_part(p_arquivo, '/', 1) <> v_c or split_part(p_arquivo, '/', 2) <> v_reg::text
     or not exists (select 1 from storage.objects where bucket_id = 'termos' and name = p_arquivo) then
    return jsonb_build_object('status', 'arquivo_ausente');
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or coalesce(p_bytes, 0) <= 0 then return jsonb_build_object('status', 'invalido'); end if;
  insert into termo_envios(campanha, registro, arquivo, sha256, bytes) values (v_c, v_reg, p_arquivo, p_sha256, p_bytes);
  update termo_pendencias set enviado_em = clock_timestamp(), arquivo = p_arquivo, arquivo_sha256 = p_sha256, arquivo_bytes = p_bytes,
         conferido_em = null, conferido_por = null, rejeitado_em = null
   where campanha = v_c and registro = v_reg;
  -- o recadastro que pedia o termo pode ter terminado agora
  if to_regprocedure('public.recadastro_concluir(integer)') is not null then perform public.recadastro_concluir(v_reg); end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- o painel do Pessoal (e, na 2.19.1, dos gestores do LABBIO): todos os elegíveis
create or replace function public.termo_painel(p_campanha text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c text := coalesce(p_campanha, public.termo_campanha_atual());
begin
  if not public.termo_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'campanha', v_c,
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', m.registro, 'nome', m.nome, 'status_membro', m.status,
        'situacao', public.termo_situacao(m.registro, v_c),
        'enviado_em', t.enviado_em, 'arquivo', t.arquivo, 'conferido_em', t.conferido_em, 'motivo', t.motivo)
        order by m.nome)
      from membros m left join termo_pendencias t on t.campanha = v_c and t.registro = m.registro
     where m.status in ('Ativo', 'Em pausa / avaliação')), '[]'::jsonb));
end $$;

create or replace function public.termo_conferir(p_registro integer, p_ok boolean, p_motivo text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_c text := public.termo_campanha_atual(); n integer; quem text;
begin
  if not public.termo_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not p_ok and coalesce(btrim(p_motivo), '') = '' then return jsonb_build_object('status', 'motivo_obrigatorio'); end if;
  select coalesce(nome, email) into quem from perfis where id = auth.uid();
  if p_ok then
    update termo_pendencias set conferido_em = clock_timestamp(), conferido_por = quem, motivo = null
     where campanha = v_c and registro = p_registro and enviado_em is not null;
  else
    update termo_pendencias set rejeitado_em = clock_timestamp(), conferido_em = null, conferido_por = quem, motivo = btrim(p_motivo)
     where campanha = v_c and registro = p_registro and enviado_em is not null;
  end if;
  get diagnostics n = row_count;
  if n = 0 then return jsonb_build_object('status', 'sem_envio'); end if;
  if not p_ok then
    -- devolvido: o recadastro que pedia o termo volta a ficar pendente
    update recadastro_pendencias set concluido_em = null
     where registro = p_registro and campanha in (select id from recadastro_campanhas where termo = v_c);
    perform public.notificar(array[p_registro], 'termo', 'Termo de sigilo devolvido',
      'O Pessoal devolveu o termo enviado: ' || btrim(p_motivo), '#/servicos/termo');
  end if;
  return jsonb_build_object('status', 'ok');
end $$;

do $$ declare f text; begin
  foreach f in array array['termo_estado()', 'termo_emitir()', 'termo_registrar_envio(text,text,integer)',
    'termo_painel(text)', 'termo_conferir(integer,boolean,text)', 'termo_gestao()', 'termo_campanha_atual()',
    'termo_situacao(integer,text)', 'termo_dados_recentes(integer)', 'termo_estado_de(integer,text)',
    'termo_arquivo_pode(text,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- o estado de outra pessoa só pelo recadastro (security definer)
  execute 'revoke all on function public.termo_estado_de(integer,text) from authenticated';
  execute 'revoke all on function public.termo_situacao(integer,text) from authenticated';
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_termo',
 'SOMA 2.19.1: termo de sigilo do LABBIO: modelo, situação por pessoa, bucket termos e as funções termo_*')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, ativa, modelo_sha256 from public.termo_campanhas;
-- select id, public, file_size_limit from storage.buckets where id = 'termos';
