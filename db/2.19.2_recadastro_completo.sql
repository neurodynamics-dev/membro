-- ============================================================
-- SOMA 2.19.2: o recadastro atualiza todos os dados pessoais
--
-- Antes, conferir os dados (Serviços › Meus dados, e o recadastro) gravava
-- só os campos do termo e do LABBIO: nome civil, documentos, telefone,
-- endereço em partes e o vínculo acadêmico. A aba "Dados pessoais" da ficha
-- mostrava outros campos, que o recadastro nunca tocava, e o endereço de
-- uma linha ficava o antigo.
--
-- Agora:
--   1. o formulário traz também, opcionais, os demais campos da ficha:
--      gênero, cidade de origem, período de ingresso, tempo de
--      deslocamento, autodeclaração racial, situação junto à FUMP,
--      acessibilidade, background, Lattes, Instagram, GitHub, autorização
--      de uso de imagem e o e-mail pessoal;
--   2. confirmar grava tudo: o que veio em branco apaga, o que não veio
--      (um formulário antigo aberto) fica como estava;
--   3. o endereço de uma linha é montado a partir das partes, e o e-mail
--      pessoal (e o telefone, onde o quadro tem a coluna) vai para membros.
--
-- Os dados de bolsa continuam só com o Depto. de Pessoal. Depois da
-- 2.19.1_recadastro. Pode rodar de novo.
-- ============================================================

-- os campos da ficha (na produção já existem; aqui só para a base de teste)
alter table public.dados_pessoais
  add column if not exists genero text, add column if not exists endereco text, add column if not exists cidade_origem text,
  add column if not exists periodo_ingresso text, add column if not exists tempo_deslocamento text,
  add column if not exists autodeclaracao_racial text, add column if not exists situacao_fump text,
  add column if not exists acessibilidade text, add column if not exists background text, add column if not exists lattes text,
  add column if not exists instagram text, add column if not exists github text, add column if not exists autorizacao_imagem boolean;

create or replace function public.cadastro_meus_dados()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_reg integer := public.portal_registro_atual(); r jsonb; u cadastro_confirmacoes;
begin
  if v_reg is null then return jsonb_build_object('status', 'sem_registro'); end if;
  u := public.cadastro_ultima(v_reg);
  select jsonb_build_object('status', 'ok', 'registro', m.registro, 'nome', m.nome, 'confirmado_em', u.confirmado_em,
           'email', coalesce(m.email_nro, ''), 'email_pessoal', coalesce(m.email_pessoal, ''), 'foto', m.foto_url is not null and m.foto_url <> '') ||
         coalesce((select jsonb_build_object(
           'nome_civil', coalesce(d.nome_civil, m.nome), 'cpf', d.cpf, 'data_nascimento', d.data_nascimento,
           'matricula', d.matricula, 'sem_matricula', d.sem_matricula, 'instituicao', d.instituicao, 'curso', d.curso,
           'rg', d.rg, 'rg_orgao', d.rg_orgao, 'nacionalidade', coalesce(d.nacionalidade, 'brasileira'),
           'estado_civil', d.estado_civil, 'telefone', d.telefone,
           'end_logradouro', d.end_logradouro, 'end_numero', d.end_numero, 'end_complemento', d.end_complemento,
           'end_bairro', d.end_bairro, 'end_cep', d.end_cep, 'end_cidade', d.end_cidade, 'end_uf', d.end_uf,
           'endereco_antigo', d.endereco,
           'genero', d.genero, 'cidade_origem', d.cidade_origem, 'periodo_ingresso', d.periodo_ingresso,
           'tempo_deslocamento', d.tempo_deslocamento, 'autodeclaracao_racial', d.autodeclaracao_racial,
           'situacao_fump', d.situacao_fump, 'acessibilidade', d.acessibilidade, 'background', d.background,
           'lattes', d.lattes, 'instagram', d.instagram, 'github', d.github, 'autorizacao_imagem', d.autorizacao_imagem)
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
declare v_reg integer := public.portal_registro_atual(); e jsonb := '{}'::jsonb; d jsonb; v_nasc date; o jsonb; k text;
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
  -- os opcionais (2.19.2): só entram os que o formulário mandou; vazio apaga
  o := '{}'::jsonb;
  foreach k in array array['genero', 'cidade_origem', 'periodo_ingresso', 'tempo_deslocamento', 'autodeclaracao_racial',
                           'situacao_fump', 'acessibilidade', 'background', 'lattes', 'instagram', 'github'] loop
    if p ? k then o := o || jsonb_build_object(k, nullif(btrim(regexp_replace(coalesce(p->>k, ''), '[ \t]+', ' ', 'g')), '')); end if;
  end loop;
  if p ? 'autorizacao_imagem' then o := o || jsonb_build_object('autorizacao_imagem', case p->>'autorizacao_imagem' when 'true' then true when 'false' then false end); end if;
  if p ? 'email_pessoal' then
    o := o || jsonb_build_object('email_pessoal', nullif(lower(btrim(coalesce(p->>'email_pessoal', ''))), ''));
    if o->>'email_pessoal' is not null and o->>'email_pessoal' !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      e := e || '{"email_pessoal":"E-mail inválido."}'; end if;
  end if;
  if o->>'lattes' is not null and o->>'lattes' !~* '^(https?://)?(www\.)?lattes\.cnpq\.br/' then
    e := e || '{"lattes":"Cole o endereço do Lattes (lattes.cnpq.br/...)."}'; end if;
  d := d || o;
  if e <> '{}'::jsonb then return jsonb_build_object('status', 'invalido', 'campos', e); end if;

  insert into dados_pessoais(registro) values (v_reg) on conflict (registro) do nothing;
  update dados_pessoais set
    nome_civil = d->>'nome_civil', cpf = d->>'cpf', data_nascimento = v_nasc,
    matricula = nullif(d->>'matricula', ''), sem_matricula = (d->>'sem_matricula')::boolean,
    instituicao = d->>'instituicao', curso = d->>'curso', rg = d->>'rg', rg_orgao = d->>'rg_orgao',
    nacionalidade = d->>'nacionalidade', estado_civil = d->>'estado_civil', telefone = d->>'telefone',
    end_logradouro = d->>'end_logradouro', end_numero = d->>'end_numero', end_complemento = nullif(d->>'end_complemento', ''),
    end_bairro = d->>'end_bairro', end_cep = d->>'end_cep', end_cidade = d->>'end_cidade', end_uf = d->>'end_uf',
    -- o endereço de uma linha (o que a ficha e os relatórios antigos mostram) acompanha as partes
    endereco = concat_ws(', ', d->>'end_logradouro' || ', ' || (d->>'end_numero') || coalesce(' ' || nullif(d->>'end_complemento', ''), ''),
                         d->>'end_bairro', (d->>'end_cidade') || '/' || (d->>'end_uf'), 'CEP ' || substr(d->>'end_cep', 1, 5) || '-' || substr(d->>'end_cep', 6)),
    genero = case when o ? 'genero' then o->>'genero' else genero end,
    cidade_origem = case when o ? 'cidade_origem' then o->>'cidade_origem' else cidade_origem end,
    periodo_ingresso = case when o ? 'periodo_ingresso' then o->>'periodo_ingresso' else periodo_ingresso end,
    tempo_deslocamento = case when o ? 'tempo_deslocamento' then o->>'tempo_deslocamento' else tempo_deslocamento end,
    autodeclaracao_racial = case when o ? 'autodeclaracao_racial' then o->>'autodeclaracao_racial' else autodeclaracao_racial end,
    situacao_fump = case when o ? 'situacao_fump' then o->>'situacao_fump' else situacao_fump end,
    acessibilidade = case when o ? 'acessibilidade' then o->>'acessibilidade' else acessibilidade end,
    background = case when o ? 'background' then o->>'background' else background end,
    lattes = case when o ? 'lattes' then o->>'lattes' else lattes end,
    instagram = case when o ? 'instagram' then o->>'instagram' else instagram end,
    github = case when o ? 'github' then o->>'github' else github end,
    autorizacao_imagem = case when o ? 'autorizacao_imagem' then (o->>'autorizacao_imagem')::boolean else autorizacao_imagem end
   where registro = v_reg;
  -- o e-mail pessoal mora no quadro (membros), e o telefone também, onde a coluna existe
  if o ? 'email_pessoal' then update membros set email_pessoal = o->>'email_pessoal' where registro = v_reg; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'membros' and column_name = 'telefone') then
    execute 'update public.membros set telefone = $1 where registro = $2' using d->>'telefone', v_reg;
  end if;
  insert into cadastro_confirmacoes(registro, campanha, dados) values (v_reg, public.recadastro_campanha_atual(), d);
  perform public.recadastro_concluir(v_reg);
  return jsonb_build_object('status', 'ok', 'dados', d);
end $$;


revoke execute on function public.cadastro_meus_dados() from public, anon;
grant execute on function public.cadastro_meus_dados() to authenticated;
revoke execute on function public.cadastro_confirmar(jsonb) from public, anon;
grant execute on function public.cadastro_confirmar(jsonb) to authenticated;

insert into public.migracoes(id, descricao) values('2.19.2_recadastro_completo',
 'SOMA 2.19.2: o recadastro (Meus dados) atualiza todos os dados pessoais da ficha, com os campos opcionais, o endereço de uma linha e o e-mail pessoal')
on conflict(id) do nothing;

-- CONFERIR (somente leitura): quem conferiu os dados e se a ficha acompanhou
-- select c.registro, c.confirmado_em, d.endereco, d.telefone, d.genero from public.cadastro_confirmacoes c
--   join public.dados_pessoais d on d.registro = c.registro order by c.confirmado_em desc limit 10;
