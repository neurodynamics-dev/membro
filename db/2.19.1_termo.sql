-- ============================================================
-- SOMA 2.19.1: o termo de sigilo do LABBIO, com recadastro
--
-- Todos os membros (e, depois, os trainees) refazem o termo, mesmo quem já
-- tinha um. O caminho de cada pessoa:
--   1. confere e completa os dados cadastrais (obrigatórios: os que o termo
--      leva, mais nascimento, matrícula, instituição, curso e telefone);
--   2. baixa o termo: o PDF original do LABBIO (termos/termo_sigilo_labbio_3.pdf),
--      sem nenhuma alteração além dos campos do próprio formulário,
--      preenchidos com os dados que ela acabou de confirmar;
--   3. assina no gov.br e envia o PDF assinado, que é guardado como veio
--      (sem reescrever, para não quebrar a assinatura).
-- O Pessoal confere o arquivo e pode devolver com motivo.
--
-- A campanha nasce desligada. Com termo_campanha_ativar(true), cada membro
-- elegível recebe um aviso (e o e-mail, pelas preferências), e o portal passa
-- a abrir o pedido na entrada: a primeira vez pode ser dispensada, as
-- seguintes não. Férias e afastamento pausam o pedido.
--
-- O que esta migração faz:
--   1. dados_pessoais ganha os campos que o termo pede (RG, órgão, estado
--      civil, endereço em partes, telefone...);
--   2. termo_campanhas, termo_pendencias e termo_envios (só por função);
--   3. o bucket privado "termos", com uma pasta por campanha e registro;
--   4. as funções: termo_estado, termo_meus_dados, termo_confirmar_dados,
--      termo_emitir, termo_registrar_envio, termo_dispensar, termo_painel,
--      termo_conferir, termo_campanha_ativar, termo_cpf_valido.
-- Só acrescenta; pode rodar de novo.
-- ============================================================

-- 1. os dados que o termo leva (os que já existem na produção ficam como estão)
alter table public.dados_pessoais
  add column if not exists cpf text,
  add column if not exists matricula text,
  add column if not exists endereco text,
  add column if not exists nome_civil text,
  add column if not exists rg text,
  add column if not exists rg_orgao text,
  add column if not exists nacionalidade text,
  add column if not exists estado_civil text,
  add column if not exists telefone text,
  add column if not exists end_logradouro text,
  add column if not exists end_numero text,
  add column if not exists end_complemento text,
  add column if not exists end_bairro text,
  add column if not exists end_cep text,
  add column if not exists end_cidade text,
  add column if not exists end_uf text,
  add column if not exists sem_matricula boolean not null default false,
  add column if not exists curso text,
  add column if not exists instituicao text,
  add column if not exists data_nascimento date;

-- 2. campanha, pendência por pessoa e o histórico de envios
create table if not exists public.termo_campanhas (
  id            text primary key,
  titulo        text not null,
  modelo        text not null,      -- o PDF original, servido pelo portal
  modelo_sha256 text not null,      -- confere que o modelo não mudou
  ativa         boolean not null default false,
  ativada_em    timestamptz,
  criada_em     timestamptz not null default now()
);
insert into public.termo_campanhas(id, titulo, modelo, modelo_sha256)
values ('labbio-2026', 'Termo de sigilo do LABBIO', 'termos/termo_sigilo_labbio_3.pdf',
        '7739da5d1285a5062f361dac5f2fd41188133244b18c6f2fa69dc42895a77cec')
on conflict (id) do nothing;

create table if not exists public.termo_pendencias (
  campanha             text not null references public.termo_campanhas(id),
  registro             integer not null,
  dispensa_usada_em    timestamptz,     -- a única dispensa, por pessoa e campanha (vale em qualquer aparelho)
  dados_confirmados_em timestamptz,
  dados                jsonb,           -- a fotografia dos dados confirmados: é o que vai no termo
  emitido_em           timestamptz,     -- o termo baixado com essa fotografia
  enviado_em           timestamptz,
  arquivo              text,            -- caminho no bucket "termos"
  arquivo_sha256       text,
  arquivo_bytes        integer,
  conferido_em         timestamptz,
  conferido_por        text,
  rejeitado_em         timestamptz,
  motivo               text,
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

-- 3. o bucket privado
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('termos', 'termos', false, 10485760, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4. funções
create or replace function public.termo_gestao()
returns boolean language sql stable security definer set search_path = public as $$
  select public.tenho_papel('pessoal');
$$;

create or replace function public.termo_cpf_valido(p text)
returns boolean language plpgsql immutable as $$
declare d text := regexp_replace(coalesce(p, ''), '\D', '', 'g'); s integer; k integer; dv integer;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  for k in 9..10 loop
    s := 0;
    for i in 1..k loop s := s + substr(d, i, 1)::integer * (k + 2 - i); end loop;
    dv := (s * 10) % 11; if dv = 10 then dv := 0; end if;
    if dv <> substr(d, k + 1, 1)::integer then return false; end if;
  end loop;
  return true;
end $$;

create or replace function public.termo_campanha_atual()
returns text language sql stable security definer set search_path = public as $$
  select id from termo_campanhas where ativa order by ativada_em desc nulls last limit 1;
$$;

create or replace function public.termo_elegivel(p_reg integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where registro = p_reg and status in ('Ativo', 'Em pausa / avaliação'));
$$;

-- férias e afastamento pausam o pedido (e a cobrança)
create or replace function public.termo_pausado(p_reg integer)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean := false;
begin
  if to_regclass('public.agenda_ausencias') is null then return false; end if;
  execute 'select exists (select 1 from agenda_ausencias where registro = $1 and tipo in (''ferias'', ''afastamento'')
             and inicio <= now() and fim >= now())' into v using p_reg;
  return coalesce(v, false);
end $$;

-- o estado do termo de quem está logado; cria a pendência quando a campanha está ativa
create or replace function public.termo_estado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual();
        p termo_pendencias; c termo_campanhas; v_status text; v_pausa boolean;
begin
  if v_reg is null or v_c is null or not public.termo_elegivel(v_reg) then
    return jsonb_build_object('status', 'nenhum');
  end if;
  insert into termo_pendencias(campanha, registro) values (v_c, v_reg) on conflict do nothing;
  select * into p from termo_pendencias where campanha = v_c and registro = v_reg;
  select * into c from termo_campanhas where id = v_c;
  v_status := case when p.conferido_em is not null and (p.rejeitado_em is null or p.rejeitado_em < p.conferido_em) then 'conferido'
                   when p.enviado_em is not null and (p.rejeitado_em is null or p.rejeitado_em < p.enviado_em) then 'enviado'
                   when p.rejeitado_em is not null then 'devolvido'
                   else 'pendente' end;
  v_pausa := public.termo_pausado(v_reg);
  return jsonb_build_object(
    'status', v_status, 'campanha', c.id, 'titulo', c.titulo, 'modelo', c.modelo, 'modelo_sha256', c.modelo_sha256,
    'pausado', v_pausa,
    'dispensa_disponivel', p.dispensa_usada_em is null,
    'dispensa_usada_em', p.dispensa_usada_em,
    'bloqueia', v_status in ('pendente', 'devolvido') and p.dispensa_usada_em is not null and not v_pausa,
    'dados_confirmados_em', p.dados_confirmados_em, 'emitido_em', p.emitido_em,
    'enviado_em', p.enviado_em, 'conferido_em', p.conferido_em, 'motivo', case when v_status = 'devolvido' then p.motivo end);
end $$;

-- a única dispensa: registrada no servidor, vale em qualquer aparelho
create or replace function public.termo_dispensar()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual(); n integer;
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  update termo_pendencias set dispensa_usada_em = now()
   where campanha = v_c and registro = v_reg and dispensa_usada_em is null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', case when n = 1 then 'ok' else 'ja_usada' end);
end $$;

-- os dados de quem está logado (membros não leem dados_pessoais pela API)
create or replace function public.termo_meus_dados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); r jsonb;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  select jsonb_build_object('status', 'ok', 'registro', m.registro, 'nome', m.nome,
           'email', coalesce(m.email_nro, ''), 'foto', m.foto_url is not null and m.foto_url <> '') ||
         coalesce((select jsonb_build_object(
           'nome_civil', coalesce(d.nome_civil, m.nome), 'cpf', d.cpf, 'data_nascimento', d.data_nascimento,
           'matricula', d.matricula, 'sem_matricula', d.sem_matricula, 'instituicao', d.instituicao, 'curso', d.curso,
           'rg', d.rg, 'rg_orgao', d.rg_orgao, 'nacionalidade', coalesce(d.nacionalidade, 'brasileira'),
           'estado_civil', d.estado_civil, 'telefone', d.telefone,
           'end_logradouro', d.end_logradouro, 'end_numero', d.end_numero, 'end_complemento', d.end_complemento,
           'end_bairro', d.end_bairro, 'end_cep', d.end_cep, 'end_cidade', d.end_cidade, 'end_uf', d.end_uf,
           'endereco_antigo', d.endereco)
           from dados_pessoais d where d.registro = m.registro),
           jsonb_build_object('nome_civil', m.nome, 'nacionalidade', 'brasileira'))
    into r from membros m where m.registro = v_reg;
  return r;
end $$;

-- confere e grava; a fotografia é o que vai no termo. Mudou algo depois de
-- baixar? O termo baixado deixa de valer e é preciso baixar de novo.
create or replace function public.termo_confirmar_dados(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual();
        e jsonb := '{}'::jsonb; d jsonb; v_nasc date; ant jsonb;
        t text;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  d := jsonb_build_object(
    'nome_civil', btrim(regexp_replace(coalesce(p->>'nome_civil', ''), '\s+', ' ', 'g')),
    'cpf', regexp_replace(coalesce(p->>'cpf', ''), '\D', '', 'g'),
    'data_nascimento', nullif(p->>'data_nascimento', ''),
    'matricula', btrim(coalesce(p->>'matricula', '')),
    'sem_matricula', coalesce((p->>'sem_matricula')::boolean, false),
    'instituicao', btrim(coalesce(p->>'instituicao', '')), 'curso', btrim(coalesce(p->>'curso', '')),
    'rg', btrim(coalesce(p->>'rg', '')), 'rg_orgao', upper(btrim(coalesce(p->>'rg_orgao', ''))),
    'nacionalidade', lower(btrim(coalesce(p->>'nacionalidade', ''))),
    'estado_civil', btrim(coalesce(p->>'estado_civil', '')),
    'telefone', regexp_replace(coalesce(p->>'telefone', ''), '\D', '', 'g'),
    'end_logradouro', btrim(coalesce(p->>'end_logradouro', '')), 'end_numero', btrim(coalesce(p->>'end_numero', '')),
    'end_complemento', btrim(coalesce(p->>'end_complemento', '')), 'end_bairro', btrim(coalesce(p->>'end_bairro', '')),
    'end_cep', regexp_replace(coalesce(p->>'end_cep', ''), '\D', '', 'g'),
    'end_cidade', btrim(coalesce(p->>'end_cidade', '')), 'end_uf', upper(btrim(coalesce(p->>'end_uf', ''))));

  if d->>'nome_civil' !~ '\S+\s+\S+' then e := e || '{"nome_civil":"Escreva o nome completo, como no documento."}'; end if;
  if not public.termo_cpf_valido(d->>'cpf') then e := e || '{"cpf":"CPF inválido. Confira os 11 números."}'; end if;
  begin v_nasc := (d->>'data_nascimento')::date; exception when others then v_nasc := null; end;
  if v_nasc is null or v_nasc > current_date - interval '14 years' or v_nasc < date '1930-01-01' then
    e := e || '{"data_nascimento":"Informe a data de nascimento."}'; end if;
  if d->>'matricula' = '' and not (d->>'sem_matricula')::boolean then
    e := e || '{"matricula":"Informe a matrícula, ou marque que não tem."}'; end if;
  if d->>'instituicao' = '' then e := e || '{"instituicao":"Informe a instituição de ensino."}'; end if;
  if d->>'curso' = '' then e := e || '{"curso":"Informe o curso."}'; end if;
  if length(d->>'rg') < 4 then e := e || '{"rg":"Informe o número da carteira de identidade."}'; end if;
  if d->>'rg_orgao' = '' then e := e || '{"rg_orgao":"Informe o órgão expedidor (por exemplo, PC-MG)."}'; end if;
  if d->>'nacionalidade' = '' then e := e || '{"nacionalidade":"Informe a nacionalidade."}'; end if;
  if d->>'estado_civil' not in ('solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a) judicialmente', 'em união estável') then
    e := e || '{"estado_civil":"Escolha o estado civil."}'; end if;
  if length(d->>'telefone') not between 10 and 11 then e := e || '{"telefone":"Telefone com DDD, 10 ou 11 números."}'; end if;
  if d->>'end_logradouro' = '' then e := e || '{"end_logradouro":"Informe a rua, avenida ou praça."}'; end if;
  if d->>'end_numero' = '' then e := e || '{"end_numero":"Informe o número (ou s/n)."}'; end if;
  if d->>'end_bairro' = '' then e := e || '{"end_bairro":"Informe o bairro."}'; end if;
  if length(d->>'end_cep') <> 8 then e := e || '{"end_cep":"CEP com 8 números."}'; end if;
  if d->>'end_cidade' = '' then e := e || '{"end_cidade":"Informe a cidade."}'; end if;
  if d->>'end_uf' !~ '^[A-Z]{2}$' then e := e || '{"end_uf":"UF com duas letras."}'; end if;
  if e <> '{}'::jsonb then return jsonb_build_object('status', 'invalido', 'campos', e); end if;

  insert into dados_pessoais(registro) values (v_reg) on conflict (registro) do nothing;
  update dados_pessoais set
    nome_civil = d->>'nome_civil', cpf = d->>'cpf', data_nascimento = v_nasc,
    matricula = nullif(d->>'matricula', ''), sem_matricula = (d->>'sem_matricula')::boolean,
    instituicao = d->>'instituicao', curso = d->>'curso', rg = d->>'rg', rg_orgao = d->>'rg_orgao',
    nacionalidade = d->>'nacionalidade', estado_civil = d->>'estado_civil', telefone = d->>'telefone',
    end_logradouro = d->>'end_logradouro', end_numero = d->>'end_numero', end_complemento = nullif(d->>'end_complemento', ''),
    end_bairro = d->>'end_bairro', end_cep = d->>'end_cep', end_cidade = d->>'end_cidade', end_uf = d->>'end_uf'
   where registro = v_reg;

  if v_c is not null and public.termo_elegivel(v_reg) then
    insert into termo_pendencias(campanha, registro) values (v_c, v_reg) on conflict do nothing;
    select dados into ant from termo_pendencias where campanha = v_c and registro = v_reg;
    update termo_pendencias set dados = d, dados_confirmados_em = now(),
           emitido_em = case when ant is not distinct from d then emitido_em end
     where campanha = v_c and registro = v_reg;
  end if;
  return jsonb_build_object('status', 'ok', 'dados', d);
end $$;

-- o termo baixado: devolve a fotografia confirmada e a data por extenso
create or replace function public.termo_emitir()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual();
        p termo_pendencias; c termo_campanhas; hoje date := (now() at time zone 'America/Sao_Paulo')::date;
        meses text[] := array['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  select * into p from termo_pendencias where campanha = v_c and registro = v_reg;
  if p.dados_confirmados_em is null or p.dados is null then return jsonb_build_object('status', 'dados_pendentes'); end if;
  update termo_pendencias set emitido_em = now() where campanha = v_c and registro = v_reg;
  select * into c from termo_campanhas where id = v_c;
  return jsonb_build_object('status', 'ok', 'modelo', c.modelo, 'modelo_sha256', c.modelo_sha256, 'dados', p.dados,
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

-- o envio do PDF assinado: o arquivo tem que estar no bucket, na pasta da pessoa
create or replace function public.termo_registrar_envio(p_arquivo text, p_sha256 text, p_bytes integer)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.termo_campanha_atual(); p termo_pendencias;
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  select * into p from termo_pendencias where campanha = v_c and registro = v_reg;
  if p.dados_confirmados_em is null then return jsonb_build_object('status', 'dados_pendentes'); end if;
  if p.emitido_em is null then return jsonb_build_object('status', 'nao_emitido'); end if;
  if split_part(p_arquivo, '/', 1) <> v_c or split_part(p_arquivo, '/', 2) <> v_reg::text
     or not exists (select 1 from storage.objects where bucket_id = 'termos' and name = p_arquivo) then
    return jsonb_build_object('status', 'arquivo_ausente');
  end if;
  if p_sha256 !~ '^[0-9a-f]{64}$' or coalesce(p_bytes, 0) <= 0 then return jsonb_build_object('status', 'invalido'); end if;
  insert into termo_envios(campanha, registro, arquivo, sha256, bytes) values (v_c, v_reg, p_arquivo, p_sha256, p_bytes);
  update termo_pendencias set enviado_em = clock_timestamp(), arquivo = p_arquivo, arquivo_sha256 = p_sha256, arquivo_bytes = p_bytes,
         conferido_em = null, conferido_por = null, rejeitado_em = null
   where campanha = v_c and registro = v_reg;
  return jsonb_build_object('status', 'ok');
end $$;

-- o painel do Pessoal (e, na 2.19.1, dos gestores do LABBIO): todos os elegíveis
create or replace function public.termo_painel(p_campanha text default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_c text := coalesce(p_campanha, public.termo_campanha_atual(), (select id from termo_campanhas order by criada_em desc limit 1));
begin
  if not public.termo_gestao() then return jsonb_build_object('status', 'sem_permissao'); end if;
  return jsonb_build_object('status', 'ok', 'campanha', v_c,
    'ativa', (select ativa from termo_campanhas where id = v_c),
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', m.registro, 'nome', m.nome, 'status_membro', m.status,
        'situacao', case when t.conferido_em is not null and (t.rejeitado_em is null or t.rejeitado_em < t.conferido_em) then 'conferido'
                         when t.enviado_em is not null and (t.rejeitado_em is null or t.rejeitado_em < t.enviado_em) then 'enviado'
                         when t.rejeitado_em is not null then 'devolvido'
                         when t.dados_confirmados_em is not null then 'dados_confirmados'
                         else 'pendente' end,
        'dados_confirmados_em', t.dados_confirmados_em, 'enviado_em', t.enviado_em, 'arquivo', t.arquivo,
        'conferido_em', t.conferido_em, 'motivo', t.motivo, 'pausado', public.termo_pausado(m.registro))
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
    perform public.notificar(array[p_registro], 'termo', 'Termo de sigilo devolvido',
      'O Pessoal devolveu o termo enviado: ' || btrim(p_motivo), '#/servicos/termo');
  end if;
  return jsonb_build_object('status', 'ok');
end $$;

-- ligar e desligar a campanha (admin). Ao ligar, avisa quem ainda não enviou e não está de férias.
create or replace function public.termo_campanha_ativar(p_ativa boolean, p_campanha text default 'labbio-2026')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare regs integer[];
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status', 'sem_permissao'); end if;
  if p_ativa then
    update termo_campanhas set ativa = (id = p_campanha), ativada_em = case when id = p_campanha then coalesce(ativada_em, now()) else ativada_em end;
    select array_agg(m.registro) into regs from membros m
     where m.status in ('Ativo', 'Em pausa / avaliação') and not public.termo_pausado(m.registro)
       and not exists (select 1 from termo_pendencias t where t.campanha = p_campanha and t.registro = m.registro and t.enviado_em is not null);
    perform public.notificar(regs, 'termo', 'Termo de sigilo do LABBIO',
      'Confira seus dados, baixe o termo, assine no gov.br e envie pelo SOMA.', '#/servicos/termo');
  else
    update termo_campanhas set ativa = false where id = p_campanha;
  end if;
  return jsonb_build_object('status', 'ok', 'avisados', coalesce(array_length(regs, 1), 0));
end $$;

do $$ declare f text; begin
  foreach f in array array['termo_estado()', 'termo_dispensar()', 'termo_meus_dados()', 'termo_confirmar_dados(jsonb)',
    'termo_emitir()', 'termo_registrar_envio(text,text,integer)', 'termo_painel(text)', 'termo_conferir(integer,boolean,text)',
    'termo_campanha_ativar(boolean,text)', 'termo_cpf_valido(text)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  foreach f in array array['termo_gestao()', 'termo_campanha_atual()', 'termo_elegivel(integer)', 'termo_pausado(integer)',
    'termo_arquivo_pode(text,boolean)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_termo',
 'SOMA 2.19.1: termo de sigilo do LABBIO com recadastro: dados do termo em dados_pessoais, campanha, pendências, bucket termos e as funções termo_*')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, ativa, modelo_sha256 from public.termo_campanhas;
-- select count(*) from public.termo_pendencias;
-- select id, public, file_size_limit from storage.buckets where id = 'termos';
-- Ligar: select public.termo_campanha_ativar(true);
