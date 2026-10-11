-- ============================================================
-- SOMA 2.19.1: recadastro semestral (os dados de cada membro, conferidos)
--
-- A cada semestre o Pessoal liga uma campanha de recadastro: cada membro
-- confere e completa os próprios dados no SOMA. Na entrada, o portal pede
-- o recadastro; a primeira vez pode ficar para depois, as seguintes não.
-- Férias e afastamento pausam o pedido.
--
-- Uma campanha pode incluir outra obrigação: a de 2026/2 inclui o termo de
-- sigilo do LABBIO (2.19.1_termo.sql). Aí ela só termina com os dados
-- conferidos E o termo assinado enviado. Nas próximas, basta conferir os
-- dados.
--
-- A confirmação dos dados também vale fora de campanha (Serviços › Meus
-- dados, e o onboarding): cada confirmação fica no histórico, e o termo é
-- emitido com a confirmação mais recente.
--
-- O que esta migração faz:
--   1. dados_pessoais ganha os campos de documento e endereço em partes;
--   2. cadastro_confirmacoes (histórico), recadastro_campanhas e
--      recadastro_pendencias (só por função);
--   3. as funções: cadastro_meus_dados, cadastro_confirmar, cadastro_cpf_valido,
--      ausencia_vigente, recadastro_estado, recadastro_dispensar,
--      recadastro_painel, recadastro_campanha_ativar.
-- Só acrescenta; pode rodar de novo.
-- ============================================================

-- 1. os dados (os que já existem na produção ficam como estão)
alter table public.dados_pessoais
  add column if not exists cpf text,
  add column if not exists matricula text,
  add column if not exists endereco text,
  add column if not exists curso text,
  add column if not exists instituicao text,
  add column if not exists data_nascimento date,
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
  add column if not exists sem_matricula boolean not null default false;

-- 2. o histórico das confirmações, as campanhas e a pendência de cada pessoa
create table if not exists public.cadastro_confirmacoes (
  id            bigserial primary key,
  registro      integer not null,
  confirmado_em timestamptz not null default clock_timestamp(),
  campanha      text,                 -- a campanha de recadastro em curso, se havia
  dados         jsonb not null        -- a fotografia confirmada
);
create index if not exists cadastro_conf_reg on public.cadastro_confirmacoes (registro, confirmado_em desc);

create table if not exists public.recadastro_campanhas (
  id         text primary key,        -- '2026-2'
  titulo     text not null,           -- 'Recadastro 2026/2'
  termo      text,                    -- a campanha do termo que vem junto (termo_campanhas.id), ou nada
  ativa      boolean not null default false,
  ativada_em timestamptz,
  criada_em  timestamptz not null default now()
);
create table if not exists public.recadastro_pendencias (
  campanha          text not null references public.recadastro_campanhas(id),
  registro          integer not null,
  dispensa_usada_em timestamptz,      -- a única dispensa, por pessoa e campanha (vale em qualquer aparelho)
  concluido_em      timestamptz,
  primary key (campanha, registro)
);
alter table public.cadastro_confirmacoes enable row level security;
alter table public.recadastro_campanhas  enable row level security;
alter table public.recadastro_pendencias enable row level security;
revoke all on public.cadastro_confirmacoes, public.recadastro_campanhas, public.recadastro_pendencias from public, anon, authenticated;

-- 3. funções
create or replace function public.cadastro_cpf_valido(p text)
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

create or replace function public.cadastro_elegivel(p_reg integer)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from membros where registro = p_reg and status in ('Ativo', 'Em pausa / avaliação'));
$$;

-- férias e afastamento: o pedido (e a cobrança) espera a volta
create or replace function public.ausencia_vigente(p_reg integer)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v boolean := false;
begin
  if to_regclass('public.agenda_ausencias') is null then return false; end if;
  execute 'select exists (select 1 from agenda_ausencias where registro = $1 and tipo in (''ferias'', ''afastamento'')
             and inicio <= now() and fim >= now())' into v using p_reg;
  return coalesce(v, false);
end $$;

create or replace function public.recadastro_campanha_atual()
returns text language sql stable security definer set search_path = public as $$
  select id from recadastro_campanhas where ativa order by ativada_em desc nulls last limit 1;
$$;

-- a última confirmação da pessoa (o termo é emitido com ela)
create or replace function public.cadastro_ultima(p_reg integer)
returns public.cadastro_confirmacoes language sql stable security definer set search_path = public as $$
  select * from cadastro_confirmacoes where registro = p_reg order by confirmado_em desc, id desc limit 1;
$$;

-- os dados de quem está logado (membros não leem dados_pessoais pela API)
create or replace function public.cadastro_meus_dados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); r jsonb; u cadastro_confirmacoes;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  u := public.cadastro_ultima(v_reg);
  select jsonb_build_object('status', 'ok', 'registro', m.registro, 'nome', m.nome, 'confirmado_em', u.confirmado_em,
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

-- confere, grava em dados_pessoais e guarda a fotografia no histórico.
-- Obrigatórios: os do termo, nascimento, matrícula (ou "não tenho"),
-- instituição, curso e telefone. Os de bolsa não entram.
create or replace function public.cadastro_confirmar(p jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); e jsonb := '{}'::jsonb; d jsonb; v_nasc date;
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
  if not public.cadastro_cpf_valido(d->>'cpf') then e := e || '{"cpf":"CPF inválido. Confira os 11 números."}'; end if;
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
  insert into cadastro_confirmacoes(registro, campanha, dados) values (v_reg, public.recadastro_campanha_atual(), d);
  perform public.recadastro_concluir(v_reg);
  return jsonb_build_object('status', 'ok', 'dados', d);
end $$;

-- a situação do termo de uma pessoa numa campanha do termo (a 2.19.1_termo.sql
-- define termo_situacao; sem ela, a campanha sem termo segue funcionando)
create or replace function public.recadastro_termo_ok(p_reg integer, p_termo text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare s text;
begin
  if p_termo is null then return true; end if;
  if to_regprocedure('public.termo_situacao(integer,text)') is null then return false; end if;
  execute 'select public.termo_situacao($1, $2)' into s using p_reg, p_termo;
  return s in ('enviado', 'conferido');
end $$;

-- dados conferidos durante a campanha (e o termo, se ela o inclui): concluído
create or replace function public.recadastro_concluir(p_reg integer)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare c recadastro_campanhas; ok boolean;
begin
  select * into c from recadastro_campanhas where id = public.recadastro_campanha_atual();
  if not found or not public.cadastro_elegivel(p_reg) then return false; end if;
  ok := exists (select 1 from cadastro_confirmacoes where registro = p_reg and confirmado_em >= c.ativada_em)
        and public.recadastro_termo_ok(p_reg, c.termo);
  insert into recadastro_pendencias(campanha, registro) values (c.id, p_reg) on conflict do nothing;
  update recadastro_pendencias set concluido_em = case when ok then coalesce(concluido_em, clock_timestamp()) end
   where campanha = c.id and registro = p_reg;
  return ok;
end $$;

-- o estado de quem está logado: o que a campanha pede e o que já foi feito
create or replace function public.recadastro_estado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); c recadastro_campanhas; p recadastro_pendencias;
        u cadastro_confirmacoes; v_pausa boolean; dados_ok boolean; termo jsonb := null; ok boolean;
begin
  select * into c from recadastro_campanhas where id = public.recadastro_campanha_atual();
  if v_reg is null or not found or not public.cadastro_elegivel(v_reg) then return jsonb_build_object('status', 'nenhum'); end if;
  ok := public.recadastro_concluir(v_reg);
  select * into p from recadastro_pendencias where campanha = c.id and registro = v_reg;
  u := public.cadastro_ultima(v_reg);
  dados_ok := u.confirmado_em is not null and u.confirmado_em >= c.ativada_em;
  if c.termo is not null and to_regprocedure('public.termo_estado_de(integer,text)') is not null then
    execute 'select public.termo_estado_de($1, $2)' into termo using v_reg, c.termo;
  end if;
  v_pausa := public.ausencia_vigente(v_reg);
  return jsonb_build_object(
    'status', case when ok then 'concluido' else 'pendente' end,
    'campanha', c.id, 'titulo', c.titulo, 'termo_campanha', c.termo,
    'dados_confirmados_em', case when dados_ok then u.confirmado_em end,
    'termo', termo,
    'pausado', v_pausa,
    'dispensa_disponivel', p.dispensa_usada_em is null,
    'bloqueia', not ok and p.dispensa_usada_em is not null and not v_pausa);
end $$;

create or replace function public.recadastro_dispensar()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); v_c text := public.recadastro_campanha_atual(); n integer;
begin
  if v_reg is null or v_c is null then return jsonb_build_object('status', 'nenhum'); end if;
  insert into recadastro_pendencias(campanha, registro) values (v_c, v_reg) on conflict do nothing;
  update recadastro_pendencias set dispensa_usada_em = now()
   where campanha = v_c and registro = v_reg and dispensa_usada_em is null;
  get diagnostics n = row_count;
  return jsonb_build_object('status', case when n = 1 then 'ok' else 'ja_usada' end);
end $$;

-- o painel do Pessoal: cada elegível, com a confirmação e o fim da campanha
create or replace function public.recadastro_painel()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare c recadastro_campanhas;
begin
  if not public.tenho_papel('pessoal') then return jsonb_build_object('status', 'sem_permissao'); end if;
  select * into c from recadastro_campanhas order by ativa desc, ativada_em desc nulls last, criada_em desc limit 1;
  return jsonb_build_object('status', 'ok',
    'campanha', case when c.id is null then null else jsonb_build_object('id', c.id, 'titulo', c.titulo, 'termo', c.termo, 'ativa', c.ativa, 'ativada_em', c.ativada_em) end,
    'pessoas', coalesce((select jsonb_agg(jsonb_build_object(
        'registro', m.registro, 'nome', m.nome,
        'confirmado_em', (select max(x.confirmado_em) from cadastro_confirmacoes x where x.registro = m.registro),
        'na_campanha', c.id is not null and exists (select 1 from cadastro_confirmacoes x where x.registro = m.registro and x.confirmado_em >= c.ativada_em),
        'concluido_em', (select concluido_em from recadastro_pendencias rp where rp.campanha = c.id and rp.registro = m.registro),
        'pausado', public.ausencia_vigente(m.registro)) order by m.nome)
      from membros m where m.status in ('Ativo', 'Em pausa / avaliação')), '[]'::jsonb));
end $$;

-- ligar (ou desligar) a campanha do semestre (admin). Ao ligar, avisa quem
-- não está de férias. p_termo: a campanha do termo que vem junto, ou nulo.
create or replace function public.recadastro_campanha_ativar(p_id text, p_titulo text, p_termo text, p_ativa boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare regs integer[]; corpo text;
begin
  if public.papel_atual() <> 'admin' then return jsonb_build_object('status', 'sem_permissao'); end if;
  if not p_ativa then
    update recadastro_campanhas set ativa = false where id = p_id;
    return jsonb_build_object('status', 'ok', 'avisados', 0);
  end if;
  if coalesce(btrim(p_id), '') = '' or coalesce(btrim(p_titulo), '') = '' then return jsonb_build_object('status', 'invalido'); end if;
  insert into recadastro_campanhas(id, titulo, termo) values (btrim(p_id), btrim(p_titulo), nullif(p_termo, ''))
  on conflict (id) do update set titulo = excluded.titulo, termo = excluded.termo;
  update recadastro_campanhas set ativa = (id = btrim(p_id)),
         ativada_em = case when id = btrim(p_id) then coalesce(ativada_em, clock_timestamp()) else ativada_em end;
  select array_agg(m.registro) into regs from membros m
   where m.status in ('Ativo', 'Em pausa / avaliação') and not public.ausencia_vigente(m.registro);
  corpo := case when nullif(p_termo, '') is null then 'Confira e atualize seus dados no SOMA.'
                else 'Confira seus dados e envie o termo de sigilo do LABBIO assinado no gov.br.' end;
  perform public.notificar(regs, 'recadastro', btrim(p_titulo), corpo, '#/servicos/recadastro');
  return jsonb_build_object('status', 'ok', 'avisados', coalesce(array_length(regs, 1), 0));
end $$;

do $$ declare f text; begin
  foreach f in array array['cadastro_meus_dados()', 'cadastro_confirmar(jsonb)', 'cadastro_cpf_valido(text)',
    'recadastro_estado()', 'recadastro_dispensar()', 'recadastro_painel()', 'recadastro_campanha_ativar(text,text,text,boolean)',
    'cadastro_elegivel(integer)', 'ausencia_vigente(integer)', 'recadastro_campanha_atual()', 'cadastro_ultima(integer)',
    'recadastro_termo_ok(integer,text)', 'recadastro_concluir(integer)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- quem conclui é o banco, ao confirmar ou enviar
  execute 'revoke all on function public.recadastro_concluir(integer) from authenticated';
  execute 'revoke all on function public.cadastro_ultima(integer) from authenticated';
end $$;

insert into public.migracoes(id, descricao) values('2.19.1_recadastro',
 'SOMA 2.19.1: recadastro semestral: dados de documento e endereço em dados_pessoais, histórico de confirmações, campanhas e as funções cadastro_* e recadastro_*')
on conflict(id) do nothing;

-- CONFERIR (somente leitura)
-- select id, titulo, termo, ativa from public.recadastro_campanhas;
-- select count(*) from public.cadastro_confirmacoes;
-- Ligar a de 2026/2, com o termo: select public.recadastro_campanha_ativar('2026-2', 'Recadastro 2026/2', 'labbio-2026', true);
