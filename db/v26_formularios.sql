-- ============================================================
-- SOMA 26.0 — MIGRAÇÃO · NeuroDynamics
-- ESCREVER O REGISTRO NO PRÓPRIO PORTAL.
--
-- Uma ata, um relatório de execução de teste: até aqui, era baixar o
-- template, preencher no Word e subir de volta. Agora a série pode
-- ter um FORMULÁRIO — os campos que o template pede —, e o PN se
-- escreve na tela do arquivo. O portal guarda o que foi escrito,
-- desenha o documento no modelo da NRO com a revisão EM VIGOR do
-- template e manda a versão para revisão, como sempre: o PN nasce do
-- template, a revisão fica pendente até o grupo revisor aprovar, e
-- registro aprovado não muda mais.
--
--   doc_series.formulario       a definição: os campos e, se a série
--                               quiser, como eles se imprimem (a ata
--                               escreve em prosa e numera as linhas)
--   doc_formulario_rascunhos    o que a pessoa está escrevendo, um por
--                               PN — grava sozinho, e qualquer um que
--                               mexe no arquivo continua de onde parou
--   doc_revisoes.formulario     o que gerou cada versão enviada: a
--                               definição e os dados. É dali que sai a
--                               próxima revisão de um documento
--
-- A definição diz para qual revisão do template ela foi feita (rev):
-- quando o template muda de letra e o formulário não acompanha, a tela
-- avisa o PMO — o formulário é o template, escrito de outro jeito.
--
-- Vêm dois prontos, dos templates em uso: a ata de reunião
-- (NRO-PUB-003) e o relatório de execução de teste (NRO-PRO-003). Os
-- outros o PMO escreve em Arquivos › Configurações › Formulários.
--
-- Pré-requisito: SOMA 25.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regprocedure('public.doc_revisao_enviar(jsonb)') is null then
    raise exception using message = 'Falta aplicar a v20 antes desta migração.',
      detail = 'A 26.0 escreve os PNs das séries do controle de arquivos, criadas pela 20.0.';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'doc_series' and column_name = 'pn_origem') then
    raise exception using message = 'Falta aplicar a v25 antes desta migração.',
      detail = 'Série cujos PNs não moram no rol (doc_series.pn_origem, da 25.0) não ganha formulário.';
  end if;
end $$;

-- ============================================================
-- 1. AS COLUNAS
-- ------------------------------------------------------------
alter table public.doc_series   add column if not exists formulario jsonb;
alter table public.doc_revisoes add column if not exists formulario jsonb;

comment on column public.doc_series.formulario is
  'O formulário da série: {versao, rev, titulo, cabecalho, complemento, numerar_linhas, campos:[…], '
  'impressao:[…]}. Nulo = sem formulário: o PN se faz baixando o template. O leitor e o desenho moram '
  'em mod-formularios.js e doc-nro.js; a conferência, em doc_formulario_problemas().';
comment on column public.doc_revisoes.formulario is
  'Quando a versão foi escrita no portal: {def, dados} — a definição usada e o que se escreveu.';

create table if not exists public.doc_formulario_rascunhos (
  arquivo_id       uuid primary key references public.doc_arquivos(id) on delete cascade,
  dados            jsonb not null default '{}'::jsonb,
  atualizado_em    timestamptz not null default now(),
  atualizado_por   integer references public.membros(registro) on delete set null,
  atualizado_nome  text
);
alter table public.doc_formulario_rascunhos enable row level security;
-- lê o rascunho quem pode mexer no arquivo; escrever, só pela função
drop policy if exists dfr_select on public.doc_formulario_rascunhos;
create policy dfr_select on public.doc_formulario_rascunhos for select to authenticated
  using (public.doc_pode_editar(arquivo_id));
grant select on public.doc_formulario_rascunhos to authenticated;

-- ============================================================
-- 2. A DEFINIÇÃO — o que ela precisa ter para a tela não quebrar
--    Uma lista de problemas, em português, como a dos treinamentos:
--    vazia, a definição vale.
-- ------------------------------------------------------------
create or replace function public.doc_formulario_problemas(f jsonb)
returns text[] language plpgsql immutable as $$
declare
  p      text[] := '{}';
  c      jsonb;
  b      jsonb;
  col    jsonb;
  ids    text[] := '{}';
  v_id   text;
  i      integer := 0;
  tipos  constant text[] := array['texto','paragrafo','data','hora','numero','escolha','membro','projeto',
                                  'pessoas','lista','tabela','redacao'];
begin
  if f is null or jsonb_typeof(f) <> 'object' then return array['A definição precisa ser um objeto.']; end if;
  if length(f::text) > 65536 then p := p || 'A definição passa de 64 KB.'::text; end if;
  if jsonb_typeof(f->'campos') is distinct from 'array' or jsonb_array_length(f->'campos') = 0 then
    return p || 'O formulário não tem nenhum campo.'::text;
  end if;
  if nullif(trim(coalesce(f->>'titulo', '')), '') is null then p := p || 'Falta o título do documento.'::text; end if;
  for c in select * from jsonb_array_elements(f->'campos') loop
    i := i + 1;
    v_id := c->>'id';
    if v_id is null or v_id !~ '^[a-z][a-z0-9_]{0,40}$' then
      p := p || format('Campo %s: identificador inválido (letras minúsculas, números e _).', i);
    elsif v_id = any(ids) then
      p := p || format('Campo %s: identificador repetido (%s).', i, v_id);
    else
      ids := ids || v_id;
    end if;
    if not (c->>'tipo' = any(tipos)) then
      p := p || format('Campo %s: tipo desconhecido (%s).', i, coalesce(c->>'tipo', 'vazio'));
    end if;
    if nullif(trim(coalesce(c->>'rotulo', '')), '') is null then
      p := p || format('Campo %s: falta o rótulo.', i);
    end if;
    if c->>'tipo' = 'escolha' and (jsonb_typeof(c->'opcoes') is distinct from 'array' or jsonb_array_length(c->'opcoes') = 0) then
      p := p || format('Campo %s: escolha sem opções.', i);
    end if;
    if c->>'tipo' = 'tabela' then
      if jsonb_typeof(c->'colunas') is distinct from 'array' or jsonb_array_length(c->'colunas') = 0 then
        p := p || format('Campo %s: tabela sem colunas.', i);
      else
        for col in select * from jsonb_array_elements(c->'colunas') loop
          if coalesce(col->>'id', '') !~ '^[a-z][a-z0-9_]{0,40}$' or nullif(trim(coalesce(col->>'rotulo', '')), '') is null then
            p := p || format('Campo %s: coluna sem identificador ou sem rótulo.', i);
          end if;
        end loop;
      end if;
    end if;
  end loop;
  if f ? 'impressao' then
    if jsonb_typeof(f->'impressao') <> 'array' then
      p := p || 'A impressão precisa ser uma lista de blocos.'::text;
    else
      i := 0;
      for b in select * from jsonb_array_elements(f->'impressao') loop
        i := i + 1;
        if not (b->>'tipo' = any(array['ficha','secao','texto','campo'])) then
          p := p || format('Impressão, bloco %s: tipo desconhecido (%s).', i, coalesce(b->>'tipo', 'vazio'));
        end if;
        if b->>'tipo' = 'campo' and not (b->>'campo' = any(ids)) then
          p := p || format('Impressão, bloco %s: o campo %s não existe.', i, coalesce(b->>'campo', 'vazio'));
        end if;
        if b->>'tipo' = 'secao' and jsonb_typeof(b->'campos') = 'array'
           and exists (select 1 from jsonb_array_elements_text(b->'campos') x where not (x = any(ids))) then
          p := p || format('Impressão, bloco %s: a seção cita um campo que não existe.', i);
        end if;
      end loop;
    end if;
  end if;
  return p;
end $$;

-- O que falta preencher: os campos obrigatórios vazios, pelo rótulo.
create or replace function public.doc_formulario_faltam(f jsonb, d jsonb)
returns text[] language sql immutable as $$
  select coalesce(array_agg(c->>'rotulo' order by n), '{}')
    from jsonb_array_elements(coalesce(f->'campos', '[]'::jsonb)) with ordinality as x(c, n)
   where coalesce((c->>'obrigatorio')::boolean, false)
     and (   d->(c->>'id') is null
          or jsonb_typeof(d->(c->>'id')) = 'null'
          or (jsonb_typeof(d->(c->>'id')) = 'string' and trim(d->>(c->>'id')) = '')
          or (jsonb_typeof(d->(c->>'id')) = 'array' and jsonb_array_length(d->(c->>'id')) = 0)
          or (jsonb_typeof(d->(c->>'id')) = 'object' and nullif(trim(coalesce(d->(c->>'id')->>'nome', '')), '') is null));
$$;

-- ============================================================
-- 3. DEFINIR — o PMO (e admin) põe, troca ou tira o formulário de
--    uma série com PN. Fica no registro de alterações da cabeça.
-- ------------------------------------------------------------
create or replace function public.doc_formulario_definir(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_serie uuid := nullif(p->>'serie_id', '')::uuid;
  v_f     jsonb := case when jsonb_typeof(p->'formulario') = 'object' then p->'formulario' end;
  s       public.doc_series;
  v_cab   uuid;
  v_probs text[];
begin
  if not public.doc_gestor() then return jsonb_build_object('status','sem_permissao'); end if;
  select * into s from doc_series where id = v_serie;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if not s.multiplo then return jsonb_build_object('status','sem_pn'); end if;
  if s.pn_origem is not null then return jsonb_build_object('status','pn_fora_do_rol'); end if;
  if v_f is not null then
    v_probs := public.doc_formulario_problemas(v_f);
    if cardinality(v_probs) > 0 then
      return jsonb_build_object('status','invalido','problemas',to_jsonb(v_probs));
    end if;
  end if;
  update doc_series set formulario = v_f, atualizado_em = now() where id = v_serie;
  select id into v_cab from doc_arquivos where serie_id = v_serie and pn is null;
  if v_cab is not null then
    perform public.doc_evento(v_cab, 'formulario',
      case when v_f is null then 'tirado: os PNs voltam a se fazer baixando o template'
           else 'definido — ' || jsonb_array_length(v_f->'campos') || ' campos'
                || coalesce(', para a Rev. ' || nullif(v_f->>'rev', ''), '') end);
  end if;
  return jsonb_build_object('status','ok');
end $$;

-- ============================================================
-- 4. ESCREVER — o rascunho de um PN
--    Abrir devolve o que já foi escrito, a definição de agora, a
--    revisão em vigor do template e a última versão escrita no portal
--    (com o destino dela): sem rascunho, a tela começa dali — da
--    versão devolvida, para corrigir; da aprovada, para a revisão
--    seguinte.
-- ------------------------------------------------------------
create or replace function public.doc_formulario_abrir(p_arquivo uuid)
returns jsonb language plpgsql stable security definer
set search_path = public as $$
declare
  a     record;
  r     public.doc_formulario_rascunhos;
  v_bas jsonb;
begin
  select ar.*, s.formulario as def, s.tipo, s.titulo as serie_titulo, s.classe, s.prefixo, s.sn,
         e.nome as emissor, t.rev_vigente as template_rev_atual, t.codigo as template_codigo
    into a
    from doc_arquivos ar
    join doc_series s on s.id = ar.serie_id
    join doc_emissores e on e.prefixo = s.prefixo
    left join doc_arquivos t on t.serie_id = s.id and t.pn is null
   where ar.id = p_arquivo;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if a.pn is null then return jsonb_build_object('status','sem_pn'); end if;
  if a.def is null then return jsonb_build_object('status','sem_formulario'); end if;
  if not public.doc_pode_editar(p_arquivo) then return jsonb_build_object('status','sem_permissao'); end if;
  select * into r from doc_formulario_rascunhos where arquivo_id = p_arquivo;
  select jsonb_build_object('dados', v.formulario->'dados', 'estado', v.estado, 'rev', v.rev,
                            'enviado_em', v.enviado_em, 'enviado_nome', v.enviado_nome,
                            'revisor_nome', v.revisor_nome, 'parecer', v.parecer) into v_bas
    from doc_revisoes v where v.arquivo_id = p_arquivo and v.formulario is not null
   order by v.enviado_em desc limit 1;
  return jsonb_build_object('status','ok',
    'def', a.def, 'dados', r.dados, 'atualizado_em', r.atualizado_em, 'atualizado_nome', r.atualizado_nome,
    'ultima', v_bas, 'template_codigo', a.template_codigo, 'template_rev', a.template_rev_atual,
    'emissor', a.emissor, 'classe', a.classe, 'tipo', a.tipo, 'codigo', a.codigo, 'titulo', a.titulo,
    'status_arquivo', a.status, 'rev_vigente', a.rev_vigente,
    'pendente', exists (select 1 from doc_revisoes v where v.arquivo_id = p_arquivo and v.estado = 'pendente'),
    'fechado', a.tipo = 'registro' and exists (select 1 from doc_revisoes v where v.arquivo_id = p_arquivo
                                                  and v.estado = 'aprovada'));
end $$;

create or replace function public.doc_formulario_salvar(p_arquivo uuid, p_dados jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  a    record;
  v_em timestamptz := now();
begin
  select ar.id, ar.pn, ar.status, s.formulario, s.tipo into a
    from doc_arquivos ar join doc_series s on s.id = ar.serie_id where ar.id = p_arquivo;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if a.pn is null or a.formulario is null then return jsonb_build_object('status','sem_formulario'); end if;
  if not public.doc_pode_editar(p_arquivo) then return jsonb_build_object('status','sem_permissao'); end if;
  if a.status = 'obsoleto' then return jsonb_build_object('status','obsoleto'); end if;
  if a.tipo = 'registro' and exists (select 1 from doc_revisoes where arquivo_id = p_arquivo and estado = 'aprovada') then
    return jsonb_build_object('status','registro_fechado');
  end if;
  if jsonb_typeof(p_dados) is distinct from 'object' then return jsonb_build_object('status','invalido'); end if;
  if length(p_dados::text) > 262144 then return jsonb_build_object('status','invalido','campo','tamanho'); end if;
  insert into doc_formulario_rascunhos (arquivo_id, dados, atualizado_em, atualizado_por, atualizado_nome)
  values (p_arquivo, p_dados, v_em, public.portal_registro_atual(), public.doc_meu_nome())
  on conflict (arquivo_id) do update
    set dados = excluded.dados, atualizado_em = excluded.atualizado_em,
        atualizado_por = excluded.atualizado_por, atualizado_nome = excluded.atualizado_nome;
  return jsonb_build_object('status','ok','atualizado_em',v_em);
end $$;

-- ============================================================
-- 5. ENVIAR — a versão escrita no portal vai para revisão
--    O PDF já subiu para o Storage (o portal o desenha no modelo da
--    NRO); aqui ele vira a revisão pendente, pelo mesmo caminho de
--    quem sobe um arquivo — doc_revisao_enviar confere tudo o que
--    confere sempre —, e a revisão guarda a definição e os dados.
--    A revisão do template é a EM VIGOR: o formulário se aplica sempre
--    ao último template.
-- ------------------------------------------------------------
create or replace function public.doc_formulario_enviar(p jsonb)
returns jsonb language plpgsql volatile security definer
set search_path = public as $$
declare
  v_arq   uuid := nullif(p->>'arquivo_id', '')::uuid;
  v_dados jsonb := case when jsonb_typeof(p->'dados') = 'object' then p->'dados' end;
  a       record;
  v_falta text[];
  r       jsonb;
begin
  select ar.id, ar.pn, s.formulario as def, t.rev_vigente as tpl_rev into a
    from doc_arquivos ar
    join doc_series s on s.id = ar.serie_id
    left join doc_arquivos t on t.serie_id = s.id and t.pn is null
   where ar.id = v_arq;
  if not found then return jsonb_build_object('status','nao_encontrado'); end if;
  if a.pn is null or a.def is null then return jsonb_build_object('status','sem_formulario'); end if;
  if v_dados is null then return jsonb_build_object('status','invalido','campo','dados'); end if;
  v_falta := public.doc_formulario_faltam(a.def, v_dados);
  if cardinality(v_falta) > 0 then return jsonb_build_object('status','faltam','faltam',to_jsonb(v_falta)); end if;

  r := public.doc_revisao_enviar(p - 'dados' || jsonb_build_object(
         'mime', 'application/pdf', 'template_rev', a.tpl_rev));
  if r->>'status' <> 'ok' then return r; end if;
  update doc_revisoes set formulario = jsonb_build_object('def', a.def, 'dados', v_dados)
   where id = (r->>'id')::uuid;
  delete from doc_formulario_rascunhos where arquivo_id = v_arq;
  return r || jsonb_build_object('formulario', true);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'doc_formulario_definir(jsonb)', 'doc_formulario_abrir(uuid)', 'doc_formulario_salvar(uuid,jsonb)',
    'doc_formulario_enviar(jsonb)', 'doc_formulario_problemas(jsonb)', 'doc_formulario_faltam(jsonb,jsonb)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

-- ============================================================
-- 6. OS DOIS FORMULÁRIOS QUE JÁ VÊM
--    Tirados dos templates em uso. Só entram na série que ainda não
--    tem formulário — rodar de novo não desfaz o que o PMO mudou.
-- ------------------------------------------------------------
-- A ATA DE REUNIÃO (NRO-PUB-003): em prosa, com as linhas numeradas,
-- como o template. O cabeçalho diz quem se reuniu (a Gerência, a
-- Diretoria…), não o emissor da série.
update public.doc_series s set formulario = $json$
{
  "versao": 1, "rev": "A", "titulo": "Ata de reunião",
  "cabecalho": "{orgao}", "complemento": "{assunto}", "numerar_linhas": true,
  "campos": [
    {"id": "orgao", "rotulo": "Quem se reuniu", "tipo": "escolha", "obrigatorio": true, "secao": "A reunião",
     "opcoes": ["Gerência", "Diretoria", "Reunião geral", "Supervisão", "Conselho"], "livre": true,
     "ajuda": "Vai no cabeçalho do documento, no lugar do departamento."},
    {"id": "assunto", "rotulo": "Qual reunião", "tipo": "texto", "obrigatorio": true, "secao": "A reunião",
     "exemplo": "Reunião de Gerência de abril", "ajuda": "Vai no título do registro, depois do nome da série."},
    {"id": "data", "rotulo": "Data", "tipo": "data", "obrigatorio": true, "secao": "A reunião"},
    {"id": "hora", "rotulo": "Horário de início", "tipo": "hora", "obrigatorio": true, "secao": "A reunião"},
    {"id": "local", "rotulo": "Onde — como entra na frase", "tipo": "texto", "obrigatorio": true, "secao": "A reunião",
     "exemplo": "na Sala de Reuniões do LABBIO, na Escola de Engenharia da UFMG",
     "ajuda": "A ata começa: “Às 16 horas do dia 24 de abril de 2026, reuniram-se [aqui]:”."},
    {"id": "presentes", "rotulo": "Quem esteve", "tipo": "pessoas", "obrigatorio": true, "secao": "Quem esteve",
     "nota": "observação", "exemplo_nota": "online · a partir das 17h"},
    {"id": "pauta", "rotulo": "Pauta", "tipo": "lista", "obrigatorio": true, "secao": "Pauta",
     "exemplo": "Definir horário recorrente para as reuniões da Gerência"},
    {"id": "discussao", "rotulo": "O que se discutiu e decidiu", "tipo": "paragrafo", "obrigatorio": true,
     "secao": "Discussão", "linhas": 14,
     "ajuda": "Um parágrafo por assunto, na ordem da pauta (deixe uma linha em branco entre eles). Os encaminhamentos vão no texto: quem ficou responsável pelo quê, e até quando."},
    {"id": "redacao", "rotulo": "Quem redigiu", "tipo": "redacao", "obrigatorio": true, "secao": "Redação",
     "ajuda": "Se a ata foi escrita com apoio de IA, diga qual: ela sai “pelo LLM Gemini, aos cuidados de Fulano”."},
    {"id": "data_redacao", "rotulo": "Redigida no dia", "tipo": "data", "obrigatorio": true, "secao": "Redação", "padrao": "hoje"},
    {"id": "hora_redacao", "rotulo": "Às", "tipo": "hora", "obrigatorio": true, "secao": "Redação", "padrao": "agora"}
  ],
  "impressao": [
    {"tipo": "texto", "texto": "Às {hora} do dia {data}, reuniram-se {local}:"},
    {"tipo": "campo", "campo": "presentes", "marcador": "1.", "pontuacao": ";", "final": ","},
    {"tipo": "texto", "texto": "com o objetivo de discutir sobre a seguinte pauta:"},
    {"tipo": "campo", "campo": "pauta", "marcador": "A.", "pontuacao": ";", "final": "."},
    {"tipo": "campo", "campo": "discussao"},
    {"tipo": "texto", "texto": "Esta ata foi redigida {redacao}, às {hora_redacao} do dia {data_redacao}.", "estilo": "italico"}
  ]
}
$json$::jsonb
 where s.prefixo = 'PUB' and s.sn = 3 and s.multiplo and s.formulario is null and s.pn_origem is null;

-- O RELATÓRIO DE EXECUÇÃO DE TESTE (NRO-PRO-003): a ficha no alto,
-- as seções do template e o roteiro em tabela, com o status de cada
-- passo.
update public.doc_series s set formulario = $json$
{
  "versao": 1, "rev": "A", "titulo": "Relatório de Execução de Teste", "complemento": "{nome}",
  "campos": [
    {"id": "nome", "rotulo": "Nome do teste", "tipo": "texto", "obrigatorio": true, "secao": "O teste"},
    {"id": "numero", "rotulo": "#", "tipo": "texto", "secao": "O teste", "ajuda": "O número ou o identificador do teste no plano, se houver."},
    {"id": "data", "rotulo": "Data", "tipo": "data", "obrigatorio": true, "secao": "O teste"},
    {"id": "hora", "rotulo": "Hora", "tipo": "hora", "secao": "O teste"},
    {"id": "local", "rotulo": "Local", "tipo": "texto", "secao": "O teste", "exemplo": "Bancada 2, LABBIO"},
    {"id": "projeto", "rotulo": "Projeto", "tipo": "projeto", "secao": "O teste"},
    {"id": "resultado", "rotulo": "Resultado", "tipo": "escolha", "obrigatorio": true, "secao": "O teste",
     "opcoes": ["Aprovado", "Aprovado com ressalvas", "Reprovado", "Inconclusivo"]},
    {"id": "responsavel", "rotulo": "Responsável", "tipo": "membro", "obrigatorio": true, "secao": "O teste", "padrao": "eu"},
    {"id": "objetivo", "rotulo": "Objetivo do teste", "tipo": "paragrafo", "obrigatorio": true, "secao": "Objetivo do teste",
     "ajuda": "Descreva o(s) propósito(s) do teste; o que está sendo verificado, qual comportamento ou requisito está em foco e por que este teste é necessário."},
    {"id": "envolvidos", "rotulo": "Envolvidos", "tipo": "pessoas", "secao": "Envolvidos", "nota": "função no teste",
     "exemplo_nota": "operador da bancada"},
    {"id": "equipamentos", "rotulo": "Equipamentos e ferramentas", "tipo": "paragrafo", "secao": "Preparação", "linhas": 3},
    {"id": "precondicoes", "rotulo": "Pré-condições", "tipo": "paragrafo", "secao": "Preparação", "linhas": 3},
    {"id": "versoes", "rotulo": "Versões de software e firmware", "tipo": "paragrafo", "secao": "Preparação", "linhas": 2},
    {"id": "configuracoes", "rotulo": "Configurações especiais", "tipo": "paragrafo", "secao": "Preparação", "linhas": 2},
    {"id": "roteiro", "rotulo": "Roteiro", "tipo": "tabela", "obrigatorio": true, "secao": "Roteiro", "numerada": true,
     "colunas": [
       {"id": "passo", "rotulo": "Passo / ação", "tipo": "paragrafo", "largura": 3},
       {"id": "esperado", "rotulo": "Resultado esperado", "tipo": "paragrafo", "largura": 2},
       {"id": "obtido", "rotulo": "Resultado obtido", "tipo": "paragrafo", "largura": 2},
       {"id": "status", "rotulo": "Status", "tipo": "escolha", "largura": 1,
        "opcoes": [{"valor": "ok", "rotulo": "Ok", "simbolo": "ok"}, {"valor": "falhou", "rotulo": "Falhou", "simbolo": "x"},
                   {"valor": "parcial", "rotulo": "Parcial", "simbolo": "~"}, {"valor": "na", "rotulo": "N/A", "simbolo": "-"}]},
       {"id": "comentarios", "rotulo": "Comentários", "tipo": "paragrafo", "largura": 2}]},
    {"id": "conclusao", "rotulo": "Conclusão", "tipo": "paragrafo", "obrigatorio": true, "secao": "Conclusão"}
  ],
  "impressao": [
    {"tipo": "ficha", "linhas": [
      [{"rotulo": "Nome do teste", "valor": "{nome}"}, {"rotulo": "#", "valor": "{numero}", "estreito": true}],
      [{"rotulo": "Data e hora", "valor": "{data}{hora?, às }{hora}"}, {"rotulo": "Local", "valor": "{local}"}],
      [{"rotulo": "Projeto", "valor": "{projeto}"}, {"rotulo": "Resultado", "valor": "{resultado}"}],
      [{"rotulo": "Responsável", "valor": "{responsavel}"}]]},
    {"tipo": "secao", "titulo": "Objetivo do teste",
     "instrucao": "Descreva o(s) propósito(s) do teste; o que está sendo verificado, qual comportamento ou requisito está em foco e por que este teste é necessário.",
     "campos": ["objetivo"], "moldura": true},
    {"tipo": "secao", "titulo": "Envolvidos", "campos": ["envolvidos"], "colunas": ["Nome", "Função no teste"]},
    {"tipo": "secao", "titulo": "Preparação", "campos": ["equipamentos", "precondicoes", "versoes", "configuracoes"], "layout": "chave-valor"},
    {"tipo": "secao", "titulo": "Roteiro", "campos": ["roteiro"], "legenda": "status"},
    {"tipo": "secao", "titulo": "Conclusão", "campos": ["conclusao"], "moldura": true}
  ]
}
$json$::jsonb
 where s.prefixo = 'PRO' and s.sn = 3 and s.multiplo and s.formulario is null and s.pn_origem is null;

-- no registro de alterações da cabeça, uma vez
insert into public.doc_eventos (arquivo_id, tipo, detalhe, nome)
select a.id, 'formulario', 'definido — ' || jsonb_array_length(s.formulario->'campos') || ' campos, para a Rev. '
       || coalesce(s.formulario->>'rev', '—') || ' (formulário que já vem com o portal)', 'SOMA 26.0'
  from public.doc_series s join public.doc_arquivos a on a.serie_id = s.id and a.pn is null
 where s.formulario is not null
   and ((s.prefixo = 'PUB' and s.sn = 3) or (s.prefixo = 'PRO' and s.sn = 3))
   and not exists (select 1 from public.doc_eventos e where e.arquivo_id = a.id and e.tipo = 'formulario');

-- ============================================================
-- 7. REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('v26_formularios', 'Formulários de registro: a série pode ter os campos do template, o PN se escreve na tela do arquivo, o portal gera o documento no modelo da NRO com a revisão em vigor do template e manda para revisão; ata de reunião e relatório de execução de teste já vêm prontos')
on conflict (id) do nothing;

select public.doc_codigo(s.prefixo, s.sn, null) as "série com formulário", s.titulo,
       jsonb_array_length(s.formulario->'campos') as campos, s.formulario->>'rev' as "feito para a Rev.",
       a.rev_vigente as "template em vigor"
  from public.doc_series s left join public.doc_arquivos a on a.serie_id = s.id and a.pn is null
 where s.formulario is not null
 order by s.prefixo, s.sn;

-- ============================================================
-- FIM — SOMA 26.0
--
-- Depois de rodar: abra NRO-PUB-003 ou NRO-PRO-003 em Arquivos — o
-- template ganhou "Escrever no portal". Para as outras séries, o PMO
-- define o formulário em Arquivos › Configurações › Formulários.
-- ============================================================
