-- ============================================================
-- SOMA 2.23.0, MIGRAÇÃO DE DADOS, NeuroDynamics
-- OS TRABALHOS DOS TRAINEES DO PS 2026/2 (TRB-1 a TRB-14).
--
-- As fichas de trabalho (as 14 .docx de 22/10) e a planilha
-- "trabalhos trainee" (15/10), revisadas e postas num formato só:
--
--   1. a ficha de cada trabalho, nas seções da tela: escopo,
--      justificativa, entregáveis, necessidades e dependências,
--      critérios de sucesso e cenário (forças, fraquezas,
--      oportunidades e ameaças). Os roteiros longos (TRB-1 e TRB-2)
--      cabem nas mesmas seções: a visão geral e o resumo das etapas
--      vão no escopo; as regras de segurança e o material de apoio,
--      em necessidades e dependências; as metas do fim do trainee,
--      em critérios de sucesso;
--   2. as ETAPAS dos roteiros viram cartões no quadro do trabalho
--      (T1-1 a T1-8, T2-1 a T2-9): as do escopo do trainee em
--      "A fazer", as de depois em "Backlog", com etiqueta;
--   3. "trabalho 5" vira TRB-5 em todo texto, que é link no portal;
--   4. os RESPONSÁVEIS são os da ficha e os da planilha, somados
--      onde as duas divergem. Cada nome é procurado entre os membros
--      ativos (o nome inteiro, ou as palavras na ordem, a primeira
--      no começo); o que não acha ninguém, ou acha mais de um, fica
--      de fora e aparece no quadro do fim, para pôr pela tela;
--   5. o PROJETO (Équio, Calima, Arabella, Zéfiro) é ligado quando
--      existe em Projetos, pelo código ou pelo nome;
--   6. os DOCUMENTOS do rol citados nas fichas (NRO-REL-001-1,
--      NRO-REL-001-2, NRO-PRO-016, NRO-MKT-002) entram nos documentos
--      do trabalho quando existem em Arquivos.
--
-- Cria o grupo de cada trabalho (NRO_TRABALHO_<N>, com quadro), põe
-- os responsáveis na equipe e avisa cada um, como a tela faz. Quem não
-- é responsável entra pela tela Pessoas e trabalhos.
--
-- Se um trabalho com o mesmo número já existir, a ficha dele é
-- substituída pela revisada (status, datas preenchidas, equipe e
-- quadro ficam) e os responsáveis daqui se somam aos que já tinha.
-- Roda uma vez só: depois de registrada em migracoes, rodar de novo
-- só mostra o quadro do fim.
--
-- Pré-requisito: db/2.23.0_trabalhos.sql.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.trabalhos') is null or to_regprocedure('public.grupo_trabalhos()') is null then
    raise exception using message = 'Falta aplicar a db/2.23.0_trabalhos.sql antes desta migração.';
  end if;
  if public.grupo_trabalhos() is null then
    raise exception using message = 'O grupo NRO_TRABALHOS (chave trabalhos) não existe.',
      detail = 'Rode de novo a db/2.23.0_trabalhos.sql, que cria ou adota o grupo.';
  end if;
end $$;

-- ------------------------------------------------------------
-- 0. OS AJUDANTES (temporários: somem com a sessão)
-- ------------------------------------------------------------
create temp table if not exists trb_rel (
  numero integer primary key, codigo text, situacao text, responsaveis text,
  sem_membro text, projeto text, documentos integer not null default 0, atividades integer not null default 0);
truncate trb_rel;

create or replace function pg_temp.trb_ja() returns boolean language sql stable as $$
  select exists (select 1 from public.migracoes where id = '2.23.0_trabalhos_2026_2') $$;

create or replace function pg_temp.trb_norm(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(
    translate(lower(coalesce(t, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn'),
    '[^a-z ]', ' ', 'g'), '\s+', ' ', 'g')) $$;

-- o membro ativo pelo nome escrito na ficha: o nome inteiro; senão as
-- palavras na ordem, a primeira no começo ("Pedro Caversan" acha
-- "Pedro Henrique Caversan"). Só vale quando acha uma pessoa só.
create or replace function pg_temp.trb_membro(p_nome text) returns integer language plpgsql stable as $$
declare q text := pg_temp.trb_norm(p_nome); v integer[]; padrao text;
begin
  if q = '' then return null; end if;
  select array_agg(registro) into v from public.membros
   where status in ('Ativo', 'Em pausa / avaliação') and pg_temp.trb_norm(nome) = q;
  if cardinality(v) = 1 then return v[1]; end if;
  if cardinality(v) > 1 then return null; end if;
  padrao := '^' || array_to_string(string_to_array(q, ' '), '( [a-z]+)* ') || '( [a-z]+)*$';
  select array_agg(registro) into v from public.membros
   where status in ('Ativo', 'Em pausa / avaliação') and pg_temp.trb_norm(nome) ~ padrao;
  return case when cardinality(v) = 1 then v[1] end;
end $$;

-- um trabalho: cria (com o grupo e a equipe) ou, se o número existe,
-- troca a ficha pela revisada e soma os responsáveis
create or replace function pg_temp.trb(
  numero integer, referencia text, tipo text, projeto text, responsaveis text[], alocacao text,
  complexidade integer, esforco integer, escopo text, justificativa text, entregaveis text,
  dependencias text, criterios text, forcas text[], fraquezas text[], oportunidades text[], ameacas text[],
  inicio date default null, fim date default null)
returns void language plpgsql as $$
declare
  v_t      public.trabalhos%rowtype;
  v_novo   boolean := false;
  v_resp   integer[] := '{}';
  v_falta  text[] := '{}';
  v_nm     text;
  v_r      integer;
  v_pj     uuid;
  v_pjnome text;
  v_g      integer;
  v_gnome  text := 'NRO_TRABALHO_' || numero;
  v_pref   text;
  v_n      integer := 1;
  v_novos  integer[];
  v_cen    jsonb;
  v_quem   text := 'Migração dos trabalhos 2026/2';
  v_lim    text := E'\n';
begin
  if pg_temp.trb_ja() then
    insert into trb_rel (numero, codigo, situacao) values (numero, 'TRB-' || numero, 'migração já aplicada')
    on conflict on constraint trb_rel_pkey do nothing;
    return;
  end if;
  foreach v_nm in array coalesce(responsaveis, '{}') loop
    v_r := pg_temp.trb_membro(v_nm);
    if v_r is null then v_falta := v_falta || v_nm;
    elsif not v_r = any(v_resp) then v_resp := v_resp || v_r; end if;
  end loop;
  if projeto is not null then
    select p.id, p.nome into v_pj, v_pjnome from public.projetos p
     where pg_temp.trb_norm(p.codigo) = pg_temp.trb_norm(projeto) or pg_temp.trb_norm(p.nome) = pg_temp.trb_norm(projeto)
        or pg_temp.trb_norm(p.nome) = 'projeto ' || pg_temp.trb_norm(projeto)
     order by (pg_temp.trb_norm(p.codigo) = pg_temp.trb_norm(projeto)) desc limit 1;
  end if;
  v_cen := jsonb_build_object('forcas', to_jsonb(coalesce(forcas, '{}')), 'fraquezas', to_jsonb(coalesce(fraquezas, '{}')),
    'oportunidades', to_jsonb(coalesce(oportunidades, '{}')), 'ameacas', to_jsonb(coalesce(ameacas, '{}')));

  select * into v_t from public.trabalhos t where t.numero = trb.numero;
  if not found then
    ------------------------------------------------ o grupo da equipe, como a tela cria
    select id into v_g from public.grupos where nome = v_gnome;
    if v_g is not null and exists (select 1 from public.trabalhos where grupo_id = v_g) then
      raise exception 'O grupo % já é a equipe de outro trabalho.', v_gnome;
    end if;
    if v_g is null then
      v_pref := 'T' || numero;
      while exists (select 1 from public.grupos where prefixo = v_pref) loop
        v_n := v_n + 1;
        v_pref := (array['T','TR','TB','TJ','TX'])[least(v_n, 5)] || numero || case when v_n > 5 then (v_n - 5)::text else '' end;
      end loop;
      insert into public.grupos (nome, prefixo, pai_id, quadro, descricao, responsaveis)
      values (v_gnome, v_pref, public.grupo_trabalhos(), true, 'A equipe do trabalho TRB-' || numero || ': ' || referencia || '.', v_resp)
      returning id into v_g;
    else
      update public.grupos g set pai_id = coalesce(g.pai_id, public.grupo_trabalhos()), quadro = true,
             responsaveis = array(select distinct x from unnest(g.responsaveis || v_resp) x)
       where g.id = v_g;
    end if;
    insert into public.trabalhos (numero, referencia, tipo, status, ciclo, inicio, fim, alocacao, complexidade, esforco,
      escopo, justificativa, entregaveis, dependencias, criterios, cenario, projeto_id, grupo_id, responsaveis)
    values (numero, referencia, tipo, 'a_iniciar', '2026/2', inicio, fim, alocacao, complexidade, esforco,
      btrim(escopo, v_lim), btrim(justificativa, v_lim), btrim(entregaveis, v_lim), btrim(dependencias, v_lim), btrim(criterios, v_lim),
      v_cen, v_pj, v_g, v_resp)
    returning * into v_t;
    v_novo := true;
  else
    ------------------------------------------------ já existe: a ficha revisada, os responsáveis somados
    update public.trabalhos t set referencia = trb.referencia, tipo = trb.tipo, ciclo = '2026/2',
      inicio = coalesce(t.inicio, trb.inicio), fim = coalesce(t.fim, trb.fim), alocacao = trb.alocacao,
      complexidade = trb.complexidade, esforco = trb.esforco, escopo = btrim(trb.escopo, v_lim),
      justificativa = btrim(trb.justificativa, v_lim), entregaveis = btrim(trb.entregaveis, v_lim),
      dependencias = btrim(trb.dependencias, v_lim), criterios = btrim(trb.criterios, v_lim), cenario = v_cen,
      projeto_id = coalesce(t.projeto_id, v_pj),
      responsaveis = array(select x from unnest(t.responsaveis || v_resp) with ordinality u(x, o) group by x order by min(o)),
      atualizado_em = now()
     where t.id = v_t.id;
    update public.grupos g set responsaveis = array(select distinct x from unnest(g.responsaveis || v_resp) x) where g.id = v_t.grupo_id;
  end if;

  -- os responsáveis entram na equipe, com a ocorrência na ficha
  select nome into v_gnome from public.grupos where id = v_t.grupo_id;
  with feitos as (
    update public.membros set grupos = array_append(coalesce(grupos, '{}'), v_gnome)
     where registro = any(v_resp) and not (coalesce(grupos, '{}') @> array[v_gnome])
    returning registro
  ) insert into public.ocorrencias (registro, tipo, descricao, data, responsavel)
    select registro, 'Adição a grupo', v_gnome, current_date, v_quem from feitos;
  v_novos := array(select r from unnest(v_resp) r where v_novo or not r = any(v_t.responsaveis));
  if cardinality(v_novos) > 0 then
    perform public.notificar(v_novos, 'projeto_equipe', 'Você é responsável pelo trabalho TRB-' || numero,
      referencia, '#/projetos/TRB-' || numero);
  end if;

  -- o quadro do fim mostra o trabalho como ficou (no que já existia, com o de antes)
  select * into v_t from public.trabalhos t where t.id = v_t.id;
  insert into trb_rel (numero, codigo, situacao, responsaveis, sem_membro, projeto)
  values (numero, 'TRB-' || numero, case when v_novo then 'criado' else 'já existia: ficha revisada' end,
    nullif(array_to_string(array(select m.nome from unnest(v_t.responsaveis) with ordinality u(r, o)
      join public.membros m on m.registro = u.r order by u.o), ', '), ''),
    nullif(array_to_string(v_falta, ', '), ''),
    coalesce((select p.nome from public.projetos p where p.id = v_t.projeto_id),
             case when projeto is not null then projeto || ' (não está em Projetos)' end))
  on conflict on constraint trb_rel_pkey do update set situacao = excluded.situacao, responsaveis = excluded.responsaveis,
    sem_membro = excluded.sem_membro, projeto = excluded.projeto;
end $$;

-- uma etapa do roteiro, como cartão do quadro do trabalho (uma vez só)
create or replace function pg_temp.trb_etapa(p_numero integer, p_titulo text, p_status text, p_etiquetas text[], p_descricao text)
returns void language plpgsql as $$
declare v_t public.trabalhos%rowtype; v_seq integer; v_cod text; v_id uuid;
begin
  if pg_temp.trb_ja() then return; end if;
  select * into v_t from public.trabalhos where numero = p_numero;
  if not found or exists (select 1 from public.atividades where grupo_id = v_t.grupo_id and titulo = p_titulo) then return; end if;
  perform pg_advisory_xact_lock(hashtext('atividade_seq'), v_t.grupo_id);
  select coalesce(max(seq), 0) + 1 into v_seq from public.atividades where grupo_id = v_t.grupo_id;
  select prefixo || '-' || v_seq into v_cod from public.grupos where id = v_t.grupo_id;
  insert into public.atividades (codigo, grupo_id, seq, titulo, descricao, status, prioridade, etiquetas, criado_por, ordem)
  values (v_cod, v_t.grupo_id, v_seq, p_titulo, btrim(p_descricao, E'\n'), p_status, 'media', p_etiquetas,
          v_t.responsaveis[1], extract(epoch from now()) + v_seq)
  returning id into v_id;
  insert into public.atividade_log (atividade_id, registro, tipo, para) values (v_id, v_t.responsaveis[1], 'criou', v_cod);
  update trb_rel set atividades = atividades + 1 where numero = p_numero;
end $$;

-- um documento do rol citado na ficha, nos documentos do trabalho (se existe em Arquivos)
create or replace function pg_temp.trb_doc(p_numero integer, p_codigo text) returns void language plpgsql as $$
declare v_t uuid; v_a uuid;
begin
  if pg_temp.trb_ja() then return; end if;
  select id into v_t from public.trabalhos where numero = p_numero;
  select id into v_a from public.doc_arquivos where codigo = p_codigo;
  if v_t is null or v_a is null or exists (select 1 from public.trabalho_documentos where trabalho_id = v_t and arquivo_id = v_a) then return; end if;
  insert into public.trabalho_documentos (trabalho_id, arquivo_id, ordem)
  values (v_t, v_a, coalesce((select max(ordem) + 1 from public.trabalho_documentos where trabalho_id = v_t), 0));
  update trb_rel set documentos = documentos + 1 where numero = p_numero;
end $$;

-- ============================================================
-- TRB-1  Projeto Équio (software e firmware)
-- ============================================================
select pg_temp.trb(
  numero => 1, referencia => 'Projeto Équio (software e firmware)', tipo => 'etapa', projeto => 'Équio',
  responsaveis => array['Gabriel Matos Veneziano'],
  alocacao => '2 a 3 trainees de desenvolvimento', complexidade => 3, esforco => 3,
  escopo => $md$
Implementar o protocolo de tDCS (*transcranial direct current stimulation*) no Connect, do estudo inicial à validação em bancada e à entrega da documentação.

O hardware necessário já existe na placa do Connect, mas nenhuma camada de firmware ou de software usa hoje o módulo tDCS. O trabalho é construir essas camadas e documentá-las. O Projeto Équio também inclui a GVS (*galvanic vestibular stimulation*), que usa o mesmo módulo de hardware e boa parte da mesma lógica. Este trabalho trata só do tDCS; a GVS segue em planejamento próprio e aproveita o que for construído aqui.

- **Dentro do escopo:** firmware do ATSAM (controle da corrente e segurança), firmware do ESP32 (comunicação BLE), módulo tDCS no aplicativo e documentação do sistema.
- **Fora do escopo:** alterações no hardware da placa, testes em pessoas (dependem de aprovação no Comitê de Ética) e implementação da GVS.

## Visão geral do sistema

O Connect é um estimulador sem fio com dois microcontroladores. A separação garante que a corrente no paciente continue sob controle mesmo se a conexão Bluetooth cair.

| Parte | Tecnologia | Papel no tDCS |
|---|---|---|
| Aplicativo | Flutter, Clean Architecture e Cubit | Configura o protocolo, envia os comandos e mostra a sessão em tempo real |
| ESP32 | ESP-IDF e BLE | Ponte entre BLE e UART: guarda os valores na tabela GATT e os repassa ao ATSAM sem interpretá-los |
| ATSAM (ATSAMC20) | C++ *bare-metal*, sem RTOS | Controla a corrente, as rampas, o tempo de sessão e a resposta a falhas |
| Módulo tDCS | Circuito analógico da placa CFCU | Gera a corrente contínua nos eletrodos do canal 4, com proteções próprias por hardware |

O aplicativo se comunica com o ESP32 por BLE e identifica cada característica pelo UUID. O ESP32 se comunica com o ATSAM por UART, pelo WeProtocol, que envolve cada mensagem com *header*, *checksum* e *footer*. Os detalhes do circuito (como a corrente é definida, medida e limitada) estão no documento técnico do módulo tDCS.

## Etapas

O trabalho tem oito etapas, e as etapas 1 a 4 formam o escopo do trainee. Firmware e software trabalham juntos nas etapas 2, 7 e 8; nas demais, cada frente segue em paralelo. Cada etapa é um cartão do quadro do trabalho.

| Etapa | Firmware | Software |
|---|---|---|
| 1. Onboarding | Ambiente, gravação e depuração do ESP32 e do ATSAM | Ambiente, compilação e depuração do aplicativo |
| 2. FSM *top-level* e contrato de comunicação | FSM do fluxo completo da terapia e definição das variáveis | Em conjunto com o firmware |
| 3. Comunicação e telas | Pacotes entre aplicativo, ESP32 e ATSAM | *Mockups* no Figma, interativos e documentados |
| 4. Validação e telas em código | Validação com o nRF Connect | Telas em código, só navegação e visual |
| 5. Serviço tDCS e BLE | tDCS Service, StimulusService e validação do estímulo | Conexão com o ESP32 por BLE no aplicativo |
| 6. Integração no sistema | SystemController e testes em bancada | Protocolo, telemetria e botões por BLE |
| 7. Validação completa | Fluxo real do aplicativo com o Connect | Em conjunto com o firmware |
| 8. Documentação final e repasse | Documentos finais e entrega à equipe clínica | Em conjunto com o firmware |
$md$,
  justificativa => $md$
- Terapias de tDCS têm se tornado mais abrangentes: em novembro de 2025, o FDA aprovou o primeiro dispositivo para o tratamento domiciliar da depressão.
- Tratamentos com tecnologias de ponta ainda são limitados e pouco acessíveis.
- O Connect, base de muitos projetos da equipe, já tem o hardware do tDCS, mas nenhuma funcionalidade o usa. Implementá-la agrega valor de mercado ao dispositivo e abre caminho para estudos clínicos na equipe.
- A GVS tem potencial exploratório, por exemplo para aumentar a imersão em sistemas de reabilitação gamificados e em treinos de desempenho.
$md$,
  entregaveis => $md$
- *User and System Requirements Specifications* (URS e SRS).
- Código do firmware e documentação relativa no *Design History File* (DHF).
- *Interface Specification Control* (ISC), com as características BLE e os pacotes de comunicação.
- Código do aplicativo e documentação relativa no DHF, com as telas e os *mockups*.
- *Design Master File* (DMF) do sistema de tDCS como um todo.
- Matriz de rastreabilidade de requisitos.
$md$,
  dependencias => $md$
- O Connect é compartilhado com outros trabalhos e projetos da equipe (como o TRB-5): o uso precisa ser agendado com antecedência.
- Os limites de corrente e de duração precisam ser validados pela equipe clínica (TRB-2) antes da implementação final.
- Testes em pessoas e publicações dependem de aprovação no Comitê de Ética.
- O módulo tDCS compartilha recursos com o FES: ao final da implementação, o firmware precisa ser testado para garantir que o FES não foi afetado.
- Há muitos membros novos ao mesmo tempo. Dúvidas sobre o código vão ao responsável antes de virar retrabalho.

## Regras de segurança na bancada

- Nenhuma estimulação em pessoas durante o desenvolvimento: todos os testes de corrente usam carga resistiva.
- Ligar a alta tensão e estimular só com o acompanhamento de um membro experiente, até a autorização do responsável.
- Desligar o aparelho antes de mexer em cabos, eletrodos ou na carga de teste.

## Material de apoio

- NRO-REL-001-1: *Product Concept, tDCS Mode for Visuri Connect*.
- NRO-REL-001-2: *Product Concept, Project Onboarding*.
- NRO-PRO-016: *Trainee Work Script* do Projeto Équio (software e firmware, e clínica).
- SCH070105: esquemático da placa CFCU, onde fica o módulo tDCS.
- SCH070102: esquemático da placa CTCE (expansão dos canais 5 a 8, sem o módulo tDCS).
- NeuroDev: apostila de software, firmware e hardware.
- Documentos de onboarding de firmware, software e hardware.
- Documento técnico do módulo tDCS.
- Repositórios de firmware e de software, com os vídeos de onboarding.

Todo o material está no Drive e no GitHub da equipe.
$md$,
  criterios => $md$
- Protocolo de tDCS executado no Connect em bancada, dentro dos limites de segurança definidos nos requisitos.
- Todos os documentos listados entregues, revisados pelo responsável e com rastreabilidade entre requisitos, código e testes.
- Parâmetros e restrições do protocolo entregues à equipe clínica (TRB-2) para o Projeto de Pesquisa.

## Ao final do trainee

O processo de trainee termina no início de dezembro e não cobre o trabalho inteiro. As metas abaixo correspondem às etapas 1 a 4 e formam a base para quem continuar. Ao final, a equipe apresenta o que foi implementado, validado e entregue ao supervisor do projeto e a convidados (os detalhes serão enviados).

| Frente | Meta | Como é verificada |
|---|---|---|
| Firmware e software | Diagrama da máquina de estados finitos (FSM) *top-level* do fluxo completo da terapia | Revisão do diagrama com o responsável |
| Firmware | Comunicação completa entre ESP32 e ATSAM, com todas as variáveis de envio e recebimento definidas | Variáveis documentadas e trocadas entre as placas |
| Firmware | Leitura e escrita de todos os UUIDs definidos no firmware | Teste com o app nRF Connect |
| Software | *Mockup* no Figma de todas as telas do fluxo completo da terapia, com legenda e explicação de cada tela | Revisão do fluxo com o responsável |
| Software | Telas implementadas em código, só o visual, ainda sem comunicação com o firmware | Navegação por todas as telas no aplicativo |
| Hardware | Nenhuma atividade de desenvolvimento (os esquemáticos são lidos no onboarding) | Não se aplica |
$md$,
  forcas => array['Pedro e Sarah já conhecem o caminho.', 'Fortalece a relação com a Visuri.'],
  fraquezas => array['Onboarding com muitos novatos ao mesmo tempo.'],
  oportunidades => array['Formação de talentos.', 'Projeto de excelente custo-benefício.'],
  ameacas => array['Disputa do Connect com os demais trabalhos.', 'O trabalho para se a equipe perder o Connect.',
                   'Publicações dependem da aprovação no Comitê de Ética.']);

select pg_temp.trb_etapa(1, 'Etapa 1: Onboarding', 'a_fazer', array['Escopo do trainee'], $md$
Entender o projeto como um todo e deixar o ambiente pronto.

- Ler os repositórios do firmware do ESP32, do firmware do ATSAM e do aplicativo no GitHub, com os documentos de apoio de firmware e de software.
- Assistir aos vídeos de onboarding dos repositórios.
- Ler o documento técnico do módulo tDCS e os esquemáticos elétricos da placa do Connect.
- Configurar o ambiente de desenvolvimento.
- Gravar o firmware no ESP32 e no ATSAM, compilar o aplicativo e depurar o firmware e o aplicativo. Todos os trainees, de firmware e de software, precisam saber fazer isso.

**Entregável:** ambiente configurado, com cada trainee gravando as duas placas, compilando o aplicativo e depurando os dois lados.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 2: FSM top-level e contrato de comunicação', 'a_fazer', array['Escopo do trainee'], $md$
Descrever o comportamento completo da terapia antes de escrever código. Firmware e software trabalham juntos: a FSM e as variáveis definidas aqui são a referência dos dois lados.

- Desenhar a máquina de estados finitos (FSM) *top-level* da terapia: do envio do pacote pelo aplicativo à chegada ao ATSAM, a comunicação entre os microcontroladores, o início da terapia, as pausas, os botões de emergência e a finalização.
- Incluir na FSM tudo o que o protocolo clínico de tDCS exige do sistema, inclusive o comportamento em cada falha: sobrecorrente, eletrodo solto e perda da conexão BLE.
- Definir todas as variáveis de envio e recebimento: para cada característica BLE, o UUID, o tipo, a unidade, a faixa válida, as permissões (leitura, escrita e notificação) e o ID correspondente na UART. Esse contrato é a base do ISC.
- Levantar com a equipe clínica (TRB-2) os parâmetros do protocolo, como faixa de corrente, rampas, duração e limites de segurança. Eles definem as faixas válidas das variáveis e alimentam a URS e a SRS.

**Entregável:** diagrama da FSM *top-level* e primeira versão do ISC.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 3: Comunicação e telas', 'a_fazer', array['Escopo do trainee'], $md$
Fazer os dados definidos na etapa 2 circularem entre as placas e desenhar todas as telas do aplicativo.

**Firmware**

- Implementar no ESP32 o recebimento dos pacotes de cada UUID do tDCS.
- Repassar ao ATSAM os pacotes recebidos pelo ESP32.
- Enviar os pacotes desses UUIDs do ATSAM ao ESP32 e, dele, ao aplicativo.

**Software**

- Desenhar no Figma o *mockup* de todas as telas de que o tDCS precisa: segurança, instruções, configuração do protocolo e as demais telas do fluxo.
- Tornar o protótipo interativo no Figma e documentar cada tela com legenda e explicação.

**Entregável:** comunicação implementada nos dois microcontroladores e protótipo navegável e documentado no Figma.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 4: Validação da comunicação e telas em código', 'a_fazer', array['Escopo do trainee'], $md$
Confirmar que a comunicação funciona nos dois sentidos e levar as telas para o aplicativo.

**Firmware**

- Validar com o app nRF Connect a comunicação entre aplicativo, ESP32 e ATSAM nos dois sentidos, lendo e escrevendo todos os UUIDs definidos e conferindo que as notificações voltam.

**Software**

- Implementar em código todas as telas principais, com o fluxo completo de navegação e o visual, ainda sem a lógica de BLE.

**Entregável:** comunicação validada com o nRF Connect e telas navegáveis no aplicativo.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 5: Serviço tDCS e BLE no aplicativo', 'backlog', array['Depois do trainee'], $md$
Gerar a corrente no ATSAM pelo driver e começar a ligar o aplicativo ao Connect.

**Firmware**

- Estudar o driver do tDCS e o hardware do módulo, pelo documento técnico.
- Usar o driver para implementar o tDCS Service, com rampa de subida, platô, rampa de descida e tempo de sessão, seguindo a FSM da etapa 2.
- Implementar no tDCS Service a resposta a falhas e a parada de emergência.
- Atualizar o StimulusService para conviver com o tDCS Service, garantindo que FES e tDCS nunca estimulem ao mesmo tempo.
- Validar o estímulo gerado em carga resistiva.

**Software**

- Estudar como o aplicativo já usa o BLE em outras funções.
- Fazer a conexão com o ESP32 funcionar, com os botões respondendo e validados com o firmware.

**Entregável:** tDCS Service validado em bancada e aplicativo conectado ao Connect.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 6: Integração no sistema', 'backlog', array['Depois do trainee'], $md$
Integrar o tDCS ao fluxo principal do firmware e controlar a sessão inteira pelo aplicativo.

**Firmware**

- Atualizar o SystemController para chamar o *handler* do tDCS Service e coordenar a estimulação.
- Testar em bancada, em carga resistiva, se o estímulo é chamado corretamente e responde aos parâmetros enviados.
- Testar o disparo de cada proteção: sobrecorrente, eletrodo solto e botão de emergência.

**Software**

- Usar o BLE nas principais funções do aplicativo.
- Enviar os pacotes de criação de protocolo.
- Mostrar em tempo real a telemetria vinda do ATSAM.
- Implementar os botões de iniciar, pausar e parar o protocolo e o botão de emergência.
- Salvar o histórico das sessões.

**Entregável:** firmware integrado e aplicativo controlando a sessão pelo BLE.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 7: Validação completa', 'backlog', array['Depois do trainee'], $md$
Verificar o sistema de ponta a ponta. Firmware e software trabalham juntos, e toda estimulação continua em carga resistiva.

- Validar o fluxo real de uso do aplicativo com o Connect para o tDCS.
- Verificar a comunicação, o envio de pacotes, as funções do aplicativo, a resposta do firmware, os UUIDs e as variáveis de segurança.
- Testar a perda da conexão BLE no meio de uma sessão.
- Repetir os testes do FES para confirmar que ele continua funcionando como antes.
- Registrar cada teste ligado ao requisito que ele verifica.

**Entregável:** tDCS funcionando de ponta a ponta no Connect, em bancada, com os testes registrados.
$md$);
select pg_temp.trb_etapa(1, 'Etapa 8: Documentação final e repasse', 'backlog', array['Depois do trainee'], $md$
Consolidar o que foi feito para que o projeto possa ser revisado, usado pela equipe clínica e continuado.

- Fechar a URS, a SRS, o DMF, os DHFs de firmware e de software, o ISC e a matriz de rastreabilidade.
- Entregar à equipe clínica (TRB-2) os parâmetros e as restrições do protocolo para o Projeto de Pesquisa.

**Entregável:** documentação completa, revisada e com rastreabilidade entre requisitos, código e testes.
$md$);
select pg_temp.trb_doc(1, 'NRO-REL-001-1');
select pg_temp.trb_doc(1, 'NRO-REL-001-2');
select pg_temp.trb_doc(1, 'NRO-PRO-016');

-- ============================================================
-- TRB-2  Projeto Équio (clínica)
-- ============================================================
select pg_temp.trb(
  numero => 2, referencia => 'Projeto Équio (clínica)', tipo => 'etapa', projeto => 'Équio',
  responsaveis => array['Gabriel Matos Veneziano', 'Matheus Marcondes'],
  alocacao => '1 trainee de clínica, com o suporte da Nádia', complexidade => 5, esforco => 4,
  escopo => $md$
Planejar o estudo clínico do tDCS no Connect, escrever o Projeto de Pesquisa e o protocolo de testes, submetê-los ao Comitê de Ética em Pesquisa (CEP) e, depois da aprovação, conduzir os testes e publicar os resultados.

Nenhum teste com pessoas pode acontecer, e nenhum resultado pode ser publicado, sem a aprovação do estudo por um CEP. O Projeto Équio também inclui a GVS (*galvanic vestibular stimulation*), que usa o mesmo módulo de hardware. Este trabalho trata só do tDCS; a GVS terá protocolo e submissão próprios, que aproveitam a estrutura e os documentos construídos aqui.

- **Dentro do escopo:** desenho do estudo, protocolo de testes, Projeto de Pesquisa, TCLE e demais documentos exigidos pelo CEP, submissão na Plataforma Brasil, respostas a pendências e, depois da aprovação, execução e acompanhamento dos testes.
- **Fora do escopo:** firmware, aplicativo e validação em bancada (TRB-1), alterações no hardware do Connect e protocolo da GVS.

## Quem participa

| Parte | Papel no estudo |
|---|---|
| Trainee de clínica, com a Nádia | Planeja o estudo, escreve o protocolo e os documentos e prepara a submissão |
| Responsáveis pelo trabalho | Revisam os documentos e garantem o alinhamento com o software e o firmware |
| Equipe de software e firmware (TRB-1) | Fornece os parâmetros, os limites de segurança, a documentação técnica e a validação em bancada do Connect |
| Pesquisador responsável | Docente ou técnico da instituição proponente que assina o projeto e responde pelo estudo perante o CEP |
| Instituição proponente e locais da coleta | Assinam a folha de rosto e os termos de anuência e recebem os testes |
| Plataforma Brasil | Sistema em que o projeto é cadastrado, submetido e acompanhado |
| CEP | Analisa o projeto e emite o parecer; recebe também relatórios, emendas e notificações de eventos adversos |
| CONEP | Faz uma segunda análise em áreas temáticas especiais, como dispositivos terapêuticos novos ou sem registro |
| ANVISA | Só participa se o estudo servir para registrar um dispositivo de classe III ou IV (RDC 837/2023) |

A regulação da ética em pesquisa está em transição. A Lei 14.874/2024 e o Decreto 12.651/2025 criaram um novo sistema nacional, com uma nova instância nacional no lugar da CONEP. Enquanto essa instância não publica regras próprias, as resoluções do Conselho Nacional de Saúde (como a Resolução 466/2012) continuam valendo, e a submissão continua pela Plataforma Brasil. Antes de submeter, confira no site do CEP se algo mudou.

## Etapas

O trabalho tem nove etapas. As etapas 1 a 5 vão até a submissão ao CEP e formam o escopo do trainee; as seguintes dependem do tempo de análise do CEP e da validação em bancada do TRB-1. Cada etapa é um cartão do quadro do trabalho.

| Etapa | O que é feito | Entregável |
|---|---|---|
| 1. Onboarding | Estudo de tDCS, segurança e ética em pesquisa | Fichamento e cadastro na Plataforma Brasil |
| 2. Desenho do estudo | Objetivo, tipo de estudo, instituição e enquadramento regulatório | Resumo do desenho aprovado |
| 3. Protocolo de testes | População, critérios, parâmetros, segurança e desfechos | Protocolo revisado |
| 4. Documentos para o CEP | Projeto de Pesquisa, TCLE, anuências e documentação do dispositivo | Pacote de documentos completo |
| 5. Revisão e submissão | Revisão final e cadastro na Plataforma Brasil | Comprovante de submissão |
| 6. Tramitação no CEP | Triagem, parecer e respostas a pendências | Parecer de aprovação |
| 7. Preparação | Registro no ReBEC, treinamento e materiais | Equipe e materiais prontos |
| 8. Execução | Testes, eventos adversos e relatórios ao CEP | Coleta concluída |
| 9. Análise e publicação | Análise dos dados, relatório e artigo | Relatório final e artigo |
$md$,
  justificativa => $md$
- Sem aprovação do CEP não há testes com participantes nem publicação dos resultados do Projeto Équio.
- A equipe já tem projetos semelhantes aprovados, que servem de referência, e conta com o apoio e o conhecimento da Nádia.
- Viabiliza a pesquisa clínica com o Équio e forma talentos na área clínica.
$md$,
  entregaveis => $md$
- Projeto de Pesquisa completo, no formato exigido pelo CEP.
- Protocolo de testes do tDCS: população, critérios de inclusão e exclusão, parâmetros de estimulação, medidas de segurança e desfechos.
- TCLE, termos de anuência, cartas das instituições parceiras e demais documentos exigidos pelo CEP.
- Submissão na Plataforma Brasil, com comprovante, e respostas às pendências apontadas pelo CEP.
- Depois da aprovação: registros da coleta, relatórios ao CEP e relatório final com os resultados.
$md$,
  dependencias => $md$
- Os parâmetros e os limites de segurança vêm do software e firmware (TRB-1). Se mudarem depois da submissão, o projeto precisa de uma emenda.
- Se o tDCS no Connect for considerado um dispositivo terapêutico novo, o projeto passa também pela CONEP, o que pode acrescentar meses à aprovação.
- O pesquisador responsável precisa ter vínculo com a instituição proponente. Ele deve ser definido logo no início, porque assina e responde pelo estudo.
- As regras de ética em pesquisa estão em transição por causa da Lei 14.874/2024: formulários, prazos e a própria plataforma podem mudar durante o trabalho.
- Assinaturas institucionais, como a folha de rosto e os termos de anuência, costumam atrasar e devem ser pedidas cedo.
- O conhecimento necessário é muito específico. Dúvidas vão logo à Nádia, e o que for aprendido fica registrado para os próximos membros.

## Regras de ética e segurança

- Nenhum teste com pessoas antes do parecer de aprovação, nem mesmo um piloto com membros da equipe.
- Nenhum recrutamento ou divulgação para participantes antes da aprovação.
- Nenhuma mudança no protocolo aprovado sem a aprovação da emenda pelo CEP.
- Dados dos participantes anonimizados, com acesso restrito à equipe do estudo.
- Sessões só com o Connect na versão validada pelo TRB-1, conduzidas por uma pessoa treinada no protocolo.

## Material de apoio

- NRO-PRO-016: *Trainee Work Script* do Projeto Équio (clínica, e software e firmware).
- NRO-REL-001-1: *Product Concept, tDCS Mode for Visuri Connect*.
- NRO-REL-001-2: *Product Concept, Project Onboarding*.
- Projetos semelhantes já aprovados pela equipe (pedir à Nádia).
- Resolução CNS 466/2012 e Norma Operacional CNS 001/2013.
- Carta Circular CONEP 172/2017, sobre a escolha das áreas temáticas.
- Lei 14.874/2024 e Decreto 12.651/2025.
- RDC ANVISA 837/2023, sobre investigações clínicas com dispositivos médicos.
- Lei Geral de Proteção de Dados (Lei 13.709/2018).
- Antal et al. (2017). *Low intensity transcranial electric stimulation: safety, ethical, legal regulatory and application guidelines*. Clinical Neurophysiology.
- Bikson et al. (2016). *Safety of transcranial direct current stimulation: evidence based update 2016*. Brain Stimulation.
- Brunoni et al. (2011). *A systematic review on reporting and assessment of adverse effects associated with transcranial direct current stimulation*. International Journal of Neuropsychopharmacology.

O restante do material está no Drive do projeto.
$md$,
  criterios => $md$
- Projeto submetido ao CEP sem pendências documentais na triagem.
- Documentos revisados pela Nádia e pelos responsáveis antes do envio.
- Protocolo de testes coerente com os requisitos e com os limites de segurança do TRB-1.
- Estudo aprovado pelo CEP e executado conforme o protocolo aprovado, com todos os eventos adversos registrados.

## Ao final do trainee

O processo de trainee termina no início de dezembro e não cobre o trabalho inteiro. As metas abaixo correspondem às etapas 1 a 5 e formam a base para quem continuar. A aprovação do CEP não entra nas metas, porque depende do tempo de análise do comitê. Ao final, a equipe apresenta o que foi produzido e submetido ao supervisor do projeto e a convidados (os detalhes serão enviados).

| Meta | Como é verificada |
|---|---|
| Fichamento das diretrizes de segurança do tDCS e das regras de ética em pesquisa | Revisão com a Nádia |
| Desenho do estudo definido: objetivo, tipo de estudo, instituição e enquadramento regulatório | Aprovação da Nádia e dos responsáveis |
| Protocolo de testes completo | Revisão da Nádia e conferência com os limites do TRB-1 |
| Projeto de Pesquisa, TCLE e demais documentos exigidos pelo CEP | Conferência item a item com o *checklist* do CEP |
| Projeto submetido na Plataforma Brasil | Comprovante de submissão |
$md$,
  forcas => array['A equipe já tem projetos semelhantes aprovados.', 'Apoio e conhecimento da Nádia.'],
  fraquezas => array['Conhecimento muito específico.'],
  oportunidades => array['Formação de talentos.', 'Viabiliza a pesquisa com o Équio.'],
  ameacas => array['A capacidade atual da equipe pode não bastar para concluir a submissão ao CEP.']);

select pg_temp.trb_etapa(2, 'Etapa 1: Onboarding', 'a_fazer', array['Escopo do trainee'], $md$
Entender o que é o tDCS, o que o Connect vai fazer e como funciona a aprovação ética de uma pesquisa com pessoas.

- Ler o Product Concept do tDCS (NRO-REL-001-1), o documento de onboarding do projeto (NRO-REL-001-2) e o roteiro de software e firmware (TRB-1).
- Estudar o tDCS: como a corrente age no cérebro, as montagens de eletrodos no sistema 10-20, os parâmetros de um protocolo (corrente, densidade de corrente, duração, rampas, número de sessões) e a estimulação simulada (*sham*).
- Ler as diretrizes de segurança do tDCS (Antal et al., 2017; Bikson et al., 2016) e os efeitos adversos mais comuns.
- Estudar as regras de ética em pesquisa: a Resolução CNS 466/2012, a Norma Operacional 001/2013 e o que a Lei 14.874/2024 mudou.
- Ler os projetos semelhantes que a equipe já aprovou, com os TCLEs e as respostas a pendências.
- Criar o cadastro na Plataforma Brasil e conhecer o site e a lista de documentos (*checklist*) do CEP em que o projeto será submetido.
- Conhecer o Connect e o aplicativo com um membro de software e firmware.

**Entregável:** fichamento das diretrizes de segurança e das regras de ética, e cadastro na Plataforma Brasil.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 2: Pergunta de pesquisa e desenho do estudo', 'a_fazer', array['Escopo do trainee'], $md$
Decidir o que o estudo quer responder e como. Todas as etapas seguintes partem dessas decisões.

- Definir com a Nádia e os responsáveis o objetivo do primeiro estudo; por exemplo, avaliar a segurança, a tolerabilidade e a viabilidade do tDCS aplicado pelo Connect em voluntários saudáveis.
- Fazer uma revisão da literatura sobre estudos parecidos: protocolos usados, desfechos medidos e resultados de segurança.
- Escolher o tipo de estudo (piloto aberto, controlado com *sham*, cruzado ou com grupos paralelos) e se haverá randomização e cegamento.
- Definir a instituição proponente, o local da coleta e o pesquisador responsável. No CEP da UFMG, o pesquisador responsável precisa ser docente ou técnico da universidade; estudantes entram como assistentes.
- Verificar a situação do Connect na ANVISA. Um dispositivo terapêutico sem registro, ou usado para uma indicação diferente da registrada, leva o projeto também à análise da CONEP, depois do CEP.

**Entregável:** resumo de uma ou duas páginas com objetivo, hipótese, tipo de estudo, instituição e enquadramento regulatório, aprovado pela Nádia e pelos responsáveis.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 3: Protocolo de testes', 'a_fazer', array['Escopo do trainee'], $md$
Descrever em detalhe como cada teste será feito. O protocolo precisa ser específico o bastante para que outra pessoa treinada repita a sessão exatamente igual.

- Definir a população e o tamanho da amostra, com justificativa.
- Definir os critérios de inclusão e exclusão. Entre as exclusões comuns em tDCS estão implantes metálicos na cabeça, dispositivos eletrônicos implantados, histórico de convulsões, gravidez e lesões de pele no local dos eletrodos.
- Definir os parâmetros de estimulação: montagem, tamanho e tipo dos eletrodos, corrente, duração, rampas de subida e descida, número de sessões, intervalo entre elas e a condição *sham*. Os valores precisam caber nos limites do Connect, definidos com o TRB-1.
- Descrever o passo a passo de uma sessão: triagem, preparo da pele, posicionamento dos eletrodos, estimulação e avaliação depois da sessão.
- Definir as medidas de segurança: o que é monitorado durante a sessão, os critérios de interrupção, a inspeção da pele e o questionário de efeitos adversos (Brunoni et al., 2011).
- Definir o registro e a notificação de eventos adversos.
- Definir os desfechos primários e secundários, como cada um será medido e o plano de análise dos dados.
- Definir a gestão dos dados, conforme a LGPD: anonimização, quem acessa, onde ficam guardados e por quanto tempo.

**Entregável:** protocolo de testes revisado pela Nádia e conferido com os limites de segurança do TRB-1.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 4: Documentos para o CEP', 'a_fazer', array['Escopo do trainee'], $md$
Transformar o desenho e o protocolo no conjunto de documentos que o CEP exige.

- Escrever o Projeto de Pesquisa no formato do CEP: introdução, justificativa, objetivos, metodologia, riscos e benefícios, critérios para suspender o estudo, cronograma, orçamento e referências.
- Escrever o TCLE em linguagem acessível, com os riscos, os benefícios, a liberdade de recusar ou sair do estudo a qualquer momento, o ressarcimento, a indenização e os contatos do pesquisador e do CEP.
- Reunir os termos de anuência dos locais da coleta e as cartas das instituições parceiras.
- Preparar com o TRB-1 a documentação do dispositivo: descrição técnica do Connect e do módulo tDCS, proteções de segurança e resultados dos testes em bancada. O CEP usa essas informações para avaliar o risco do estudo.
- Montar o cronograma, com a coleta começando só depois da aprovação, e o orçamento, mesmo que o financiamento seja próprio.

**Entregável:** pacote completo de documentos, conferido item a item com o *checklist* do CEP.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 5: Revisão e submissão', 'a_fazer', array['Escopo do trainee'], $md$
Revisar tudo e submeter o projeto na Plataforma Brasil.

- Enviar os documentos com antecedência para a revisão da Nádia, dos responsáveis e do pesquisador responsável.
- Conferir se as informações batem entre o Projeto de Pesquisa, o protocolo, o TCLE e o formulário da Plataforma Brasil. Informação divergente entre documentos é uma das causas mais comuns de pendência.
- Cadastrar o projeto na Plataforma Brasil, escolher a área temática correta, anexar os documentos e gerar a folha de rosto.
- Colher a assinatura da folha de rosto pelo responsável da instituição e submeter.

**Entregável:** projeto submetido na Plataforma Brasil, com comprovante.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 6: Tramitação no CEP', 'backlog', array['Depois do trainee'], $md$
Acompanhar a análise até a aprovação.

- Acompanhar a tramitação na Plataforma Brasil ao menos uma vez por semana.
- Passar pela triagem documental (até 10 dias) e aguardar o parecer do CEP (cerca de 30 dias depois da aceitação).
- Responder às pendências no prazo, com uma carta que responda a cada ponto e os documentos atualizados.
- Se o projeto for para a CONEP, acompanhar também essa segunda análise.

**Entregável:** parecer de aprovação do CEP (e da CONEP, se for o caso).
$md$);
select pg_temp.trb_etapa(2, 'Etapa 7: Preparação para os testes', 'backlog', array['Depois do trainee'], $md$
Deixar a equipe, o equipamento e os materiais prontos antes do primeiro participante.

- Registrar o estudo no Registro Brasileiro de Ensaios Clínicos (ReBEC), se ele for um ensaio clínico. A maioria das revistas só publica ensaios registrados antes do primeiro participante.
- Confirmar com o TRB-1 que o tDCS foi validado em bancada e definir as versões de firmware e de aplicativo usadas em todo o estudo.
- Treinar a equipe no protocolo: triagem, posicionamento dos eletrodos, operação do Connect e conduta em emergências.
- Preparar os materiais: fichas de triagem, formulário de coleta de dados, questionários e agenda das sessões.

**Entregável:** equipe treinada, estudo registrado (se for o caso) e materiais prontos.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 8: Execução e acompanhamento', 'backlog', array['Depois do trainee'], $md$
Conduzir os testes exatamente como o protocolo aprovado descreve.

- Recrutar os participantes e aplicar o TCLE.
- Executar as sessões conforme o protocolo e registrar os dados no formulário de coleta.
- Registrar todo evento adverso e notificar o CEP conforme as normas.
- Submeter ao CEP, como emenda, qualquer mudança no protocolo antes de aplicá-la.
- Enviar ao CEP os relatórios parciais e o relatório final.

**Entregável:** coleta concluída e relatórios enviados ao CEP.
$md$);
select pg_temp.trb_etapa(2, 'Etapa 9: Análise, publicação e repasse', 'backlog', array['Depois do trainee'], $md$
Fechar o estudo e devolver ao projeto o que foi aprendido.

- Analisar os dados conforme o plano definido no protocolo.
- Escrever o relatório final e o artigo científico.
- Repassar ao TRB-1 os resultados de segurança e usabilidade, que alimentam os requisitos (URS e SRS) do dispositivo.
- Usar a experiência deste estudo como base para o protocolo da GVS.

**Entregável:** relatório final e artigo submetido.
$md$);
select pg_temp.trb_doc(2, 'NRO-PRO-016');
select pg_temp.trb_doc(2, 'NRO-REL-001-1');
select pg_temp.trb_doc(2, 'NRO-REL-001-2');

-- ============================================================
-- TRB-3  Estande NRO
-- ============================================================
select pg_temp.trb(
  numero => 3, referencia => 'Estande NRO', tipo => 'campanha', projeto => null,
  responsaveis => array['Clévio'],
  alocacao => '2 trainees de mecânica e 1 de relações institucionais', complexidade => 2, esforco => 5,
  escopo => $md$
Projetar e fabricar um estande físico e um kit de divulgação da marca NRO, reutilizáveis nos eventos de que a equipe participar.
$md$,
  justificativa => $md$
- Um kit de evento pronto aumenta o impacto da NRO nos eventos de que participa.
- O LABBIO e o Baja têm bastante equipamento para a fabricação.
$md$,
  entregaveis => $md$
- Projeto do estande (desenhos com dimensões, lista de materiais e orçamento), aprovado pelo responsável antes da fabricação.
- Estande fabricado e montado ao menos uma vez, em teste completo.
- Kit de divulgação da marca (banners, material impresso e itens de demonstração dos projetos), com conteúdo baseado no NRO-MKT-002.
- Instruções de montagem, desmontagem, transporte e armazenamento do conjunto.
$md$,
  dependencias => $md$
- Lista de compras e orçamento aprovados pelo responsável antes de qualquer compra. Compras prováveis: estrutura e painéis do estande, fixadores, iluminação, impressão de banners e materiais gráficos, caixas ou *cases* para transporte.
- Acesso à infraestrutura do LABBIO e do Baja para a fabricação.
$md$,
  criterios => $md$
- Estande montável e desmontável pela equipe, sem ferramentas especiais, e transportável em veículo comum.
- Kit de divulgação completo, com a identidade visual da NRO.
- Custo final dentro do orçamento aprovado.
$md$,
  forcas => array['O LABBIO e o Baja têm bastante equipamento para a fabricação.'],
  fraquezas => array['A equipe não tem suporte dedicado ao estande.'],
  oportunidades => array['Um kit de evento aumenta o impacto da NRO nos eventos de que participa.'],
  ameacas => array['O trabalho deve gerar custos.']);
select pg_temp.trb_doc(3, 'NRO-MKT-002');

-- ============================================================
-- TRB-4  Módulo de treinamentos do SOMA
-- ============================================================
select pg_temp.trb(
  numero => 4, referencia => 'Módulo de treinamentos do SOMA', tipo => 'campanha', projeto => null,
  responsaveis => array['Matheus Marcondes'],
  alocacao => '1 trainee responsável, com a colaboração de outros', complexidade => 2, esforco => 3,
  escopo => $md$
Desenvolver uma série de treinamentos para a equipe e publicá-los no SOMA, com a gravação e o registro pela infraestrutura da plataforma.
$md$,
  justificativa => $md$
- Uma plataforma de treinamentos completa facilita o onboarding, atrai talentos, forma pessoas e pode servir de moeda de troca.
- A infraestrutura do SOMA facilita a gravação e o registro dos treinamentos.
- O trabalho pode ser conduzido por quem participa, ao mesmo tempo, de outros trabalhos.
$md$,
  entregaveis => $md$
- Lista priorizada dos treinamentos de que a equipe precisa, aprovada pelo responsável.
- Cronograma de produção, com entregas parciais periódicas (por treinamento).
- Treinamentos gravados e publicados no SOMA, cada um com roteiro e material de apoio.
- Treinamentos organizados numa trilha de onboarding para novos membros.
$md$,
  dependencias => null,
  criterios => $md$
- Treinamentos priorizados publicados e acessíveis a toda a equipe no SOMA.
- Cada treinamento revisado, antes da publicação, por um membro com domínio do tema.
- Trilha de onboarding validada por pelo menos um membro novo.
$md$,
  forcas => array['A infraestrutura do SOMA facilita a gravação e o registro dos treinamentos.',
                  'Pode ser conduzido por quem participa, ao mesmo tempo, de outros trabalhos.'],
  fraquezas => array['Os conteúdos são extensos e o trabalho é moroso.'],
  oportunidades => array['Uma plataforma de treinamentos completa facilita o onboarding, atrai talentos, forma pessoas e pode servir de moeda de troca.'],
  ameacas => array['Desistência pela morosidade do trabalho.']);

-- ============================================================
-- TRB-5  Projeto Calima (firmware)
-- ============================================================
select pg_temp.trb(
  numero => 5, referencia => 'Projeto Calima (firmware)', tipo => 'etapa', projeto => 'Calima',
  responsaveis => array['Pedro Caversan'],
  alocacao => '2 trainees de desenvolvimento', complexidade => 3, esforco => 4,
  escopo => $md$
Implementar no firmware do Connect Cycling a compensação angular dinâmica da latência, pela estimativa da cadência em tempo real, e validá-la em testes de bancada e funcionais, em comparação com a compensação estática atual.
$md$,
  justificativa => $md$
- A cadência da pedalada é variável. Uma compensação dinâmica da latência pode reduzir o erro temporal médio da estimulação em relação à compensação estática implementada hoje.
$md$,
  entregaveis => $md$
- Firmware com a compensação angular dinâmica, com os parâmetros do filtro do sinal de cadência fáceis de ajustar (sensibilidade a variações e persistência dos valores anteriores; por exemplo, EMA com o parâmetro alfa).
- Seleção entre a compensação estática e a dinâmica em tempo de execução, para os testes.
- *Commits* bem documentados sobre as alterações.
- Testes de bancada da sincronização entre o ângulo estimado e a estimulação, em comparação com a compensação estática, rigorosamente documentados.
- Testes funcionais padronizados de comparação com a compensação estática, em tempo de pedalada.
$md$,
  dependencias => $md$
- O Connect é compartilhado com outros trabalhos e projetos da equipe (como o TRB-1 e o TRB-6): o uso precisa ser agendado com antecedência.
- As revisões da literatura do TRB-6 e do TRB-14 trazem recomendações de parâmetros e de métodos para a compensação.
$md$,
  criterios => $md$
- Em bancada, com cadência variável: erro absoluto médio do estímulo (MAE) menor que o da compensação estática, e P95 não superior. Com cadência constante, com a real e a estimada concordando: MAE equivalente.
- Determinada a combinação de parâmetros do filtro que leva a redução do erro para perto do ótimo nesse contexto.
- Código revisado pelo responsável e documentação entregue.
- Sistema apto a ser usado nos estudos do TRB-6.

Os testes de bancada são o critério principal: medem a proximidade entre o instante efetivo e o configurado do estímulo, o que nem sempre se traduz em mais tempo de pedalada.
$md$,
  forcas => array['Acompanhamento de perto do Pedro.',
                  'Baixa complexidade computacional e de implementação, com possível grande ganho funcional.'],
  fraquezas => array['A etapa de testes pode ser muito extensa.',
                     'A bancada de latência foi validada só em cadência constante: os perfis de cadência variável ainda precisam ser padronizados.',
                     'É necessária bastante dedicação ao trabalho.'],
  oportunidades => array['Desenvolver mais estrutura de firmware na equipe.',
                         'Concluir de forma integrada (one-for-all) o desenvolvimento do Connect Cycling.'],
  ameacas => array['Disputa do Connect com os demais trabalhos.', 'O trabalho para se a equipe perder o Connect.']);

-- ============================================================
-- TRB-6  Projeto Calima (clínica: compensação de latência)
-- ============================================================
select pg_temp.trb(
  numero => 6, referencia => 'Projeto Calima (clínica: compensação de latência)', tipo => 'etapa', projeto => 'Calima',
  responsaveis => array['Pedro Caversan', 'Ana Clara'],
  alocacao => '1 a 2 trainees de clínica', complexidade => 3, esforco => 3,
  escopo => $md$
Revisar a literatura sobre métodos de compensação de latência em sistemas que sentem um movimento cíclico e atuam sincronizados a ele, no FES-cycling e fora dele, para identificar os métodos e as faixas de parâmetros que se aplicam ao Calima.
$md$,
  justificativa => $md$
- Fundamenta o desenvolvimento da compensação dinâmica de latência (TRB-5) e ajuda a explorar os tipos e as combinações de parâmetros de filtro para esse tipo de compensação.
- A literatura pode reduzir o espaço de busca dos testes da compensação dinâmica.
- Partir do trabalho de outros pesquisadores, e não do zero, poupa esforço e dá mais base às decisões.
- É um trabalho de grande interesse para estudantes de medicina.
$md$,
  entregaveis => $md$
- Revisão da literatura, com os métodos agrupados por classe e avaliados pela magnitude da redução do erro temporal médio, pela confiabilidade dos testes de validação e pela semelhança com o sistema do Calima, entre outros critérios, seguindo o PRISMA-ScR.
- Relatório final com recomendações de parâmetros ao TRB-5 (firmware) e de métodos candidatos a teste no Calima.
- Rascunho de resumo ou artigo, se os resultados permitirem.
$md$,
  dependencias => null,
  criterios => $md$
- Relatório entregue com recomendações fundamentadas, aceito pelo responsável.
- Recomendações recebidas e consideradas pela equipe de firmware (TRB-5).
$md$,
  forcas => array['Trabalho de grande interesse para estudantes de medicina.',
                  'Serve de base para a validação futura no próprio sistema do Calima.'],
  fraquezas => array['Conhecimento muito específico.'],
  oportunidades => array['Desenvolve a capacidade de pesquisa acadêmica da equipe de clínica.',
                         'Embasa e completa outros resultados do Projeto Calima.',
                         'Resultados acadêmicos valiosos por si só.'],
  ameacas => array['Pouca literatura sobre o tema.']);

-- ============================================================
-- TRB-7  Encapsulamentos
-- ============================================================
select pg_temp.trb(
  numero => 7, referencia => 'Encapsulamentos', tipo => 'campanha', projeto => null,
  responsaveis => array['Sarah Fernanda'],
  alocacao => '1 a 2 trainees', complexidade => 4, esforco => 4,
  escopo => $md$
Desenvolver encapsulamentos para os sistemas embarcados da NRO, com atenção à segurança, à apresentação em demonstrações públicas e à identidade visual da marca.
$md$,
  justificativa => $md$
- Encapsulamentos dão mais segurança e melhor apresentação aos protótipos.
- Reforçam a visibilidade da marca em demonstrações públicas.
- O LABBIO tem bastante infraestrutura, e a atuação correta aproxima a NRO da impressão 3D do laboratório.
$md$,
  entregaveis => $md$
- Levantamento dos sistemas embarcados a encapsular (dimensões, conectores, interfaces e requisitos de uso).
- Modelos CAD e arquivos de fabricação de cada encapsulamento.
- Encapsulamentos fabricados, montados e testados com o sistema embarcado correspondente.
- Combinado de uso da impressão 3D com o LABBIO, registrado por escrito.
$md$,
  dependencias => $md$
- Lista de compras e orçamento aprovados pelo responsável antes de qualquer compra. Itens prováveis: materiais de impressão e de fixação (filamento, parafusos, insertos), a confirmar com o LABBIO o que ele fornece.
- O trabalho depende do LABBIO: o perfil do trainee alocado precisa ser colaborativo.
$md$,
  criterios => $md$
- Ao menos os sistemas priorizados pelo responsável encapsulados e funcionando.
- Encapsulamentos com a identidade visual da NRO e arquivos de fabricação documentados.
- Relação com o LABBIO preservada e regras de uso da impressão acordadas sem prejuízo à NRO.
$md$,
  forcas => array['O LABBIO tem bastante infraestrutura para a prática.'],
  fraquezas => array['O trabalho depende do LABBIO, que tem sido pouco receptivo.',
                     'A equipe tem pouco conhecimento técnico sobre o assunto.'],
  oportunidades => array['Novos encapsulamentos dão mais segurança e apresentação aos protótipos.',
                         'Os encapsulamentos reforçam a visibilidade da marca em demonstrações públicas.',
                         'Os kits de desmontagem trazem organização à rotina do laboratório.',
                         'Feito da forma correta, o trabalho aproxima a NRO da impressão 3D do LABBIO.'],
  ameacas => array['Sem um perfil colaborativo e político de quem for alocado, o trabalho pode afastar o LABBIO e gerar regras de uso da impressão desfavoráveis à NRO.']);

-- ============================================================
-- TRB-8  Kits de manejo e procedimentos de hardware
-- ============================================================
select pg_temp.trb(
  numero => 8, referencia => 'Kits de manejo e procedimentos de hardware', tipo => 'campanha', projeto => null,
  responsaveis => array['Sarah Fernanda'],
  alocacao => '1 trainee', complexidade => 2, esforco => 4,
  escopo => $md$
Desenvolver kits de manejo, ferramentas de organização e procedimentos para as operações de hardware feitas no laboratório.
$md$,
  justificativa => $md$
- Padroniza e organiza a rotina de trabalho com hardware no laboratório.
- Complementa os trabalhos de encapsulamento (TRB-7) e de organização dos equipamentos (TRB-9).
$md$,
  entregaveis => $md$
- Levantamento das operações de hardware feitas com frequência (montagem, soldagem, desmontagem, manuseio e armazenamento).
- Kits de manejo montados e identificados, com as ferramentas e os consumíveis de cada operação.
- Ferramentas de organização (organizadores, bancadas ou caixas) instaladas no laboratório.
- Procedimentos escritos das operações, no padrão de procedimentos da NRO.
$md$,
  dependencias => $md$
- Lista de compras e orçamento aprovados pelo responsável antes de qualquer compra. Itens prováveis: ferramentas manuais, itens de proteção contra descarga eletrostática, organizadores, caixas com divisórias e etiquetas.
$md$,
  criterios => $md$
- Kits completos, conforme o levantamento, e guardados em local definido.
- Procedimentos revisados pelo responsável e seguidos por pelo menos um membro que não os escreveu.
- Laboratório organizado também depois do fim do trabalho.
$md$,
  forcas => array['A equipe já conhece os sistemas embarcados da NRO e os problemas que surgem no manuseio deles.',
                  'Baixa complexidade técnica e baixo custo: o trabalho pode ser feito com os recursos que a equipe já tem.'],
  fraquezas => null, oportunidades => null, ameacas => null);

-- ============================================================
-- TRB-9  Organização dos equipamentos
-- ============================================================
select pg_temp.trb(
  numero => 9, referencia => 'Organização dos equipamentos', tipo => 'campanha', projeto => null,
  responsaveis => array['Maria Teresa'],
  alocacao => '2 trainees', complexidade => 1, esforco => 4,
  escopo => $md$
Levantar o inventário dos bens da NRO e organizar os seus pertences.
$md$,
  justificativa => $md$
- Um sistema de organização simples e de fácil manutenção permite a todos os membros da NRO e do LABBIO identificar os equipamentos da NRO.
- Um módulo de inventário no SOMA pode ajudar na implementação e na manutenção.
- A NRO não tem tantos pertences, o que torna o trabalho viável.
$md$,
  entregaveis => $md$
- Inventário completo dos bens da NRO (descrição, quantidade, estado e localização).
- Identificação de cada item (etiqueta ou código) e local de guarda definido.
- Organização física concluída e sinalizada.
- Procedimento de manutenção do inventário e, se viável, módulo de inventário no SOMA, alinhado com o TRB-11.
$md$,
  dependencias => $md$
- Lista de compras e orçamento aprovados pelo responsável antes de qualquer compra. Itens prováveis: etiquetas, organizadores e, se necessário, prateleiras ou armários.
- Acordo com o LABBIO sobre os espaços de guarda.
$md$,
  criterios => $md$
- Todos os bens da NRO inventariados, identificados e guardados em local definido.
- Qualquer membro da NRO ou do LABBIO localiza um equipamento pelo inventário.
- Procedimento de atualização definido, com um responsável pela manutenção.
$md$,
  forcas => array['Um módulo de inventário no SOMA pode ajudar na implementação e na manutenção da organização.',
                  'A NRO não tem tantos pertences.'],
  fraquezas => array['O trabalho depende do LABBIO, que tem sido pouco receptivo.'],
  oportunidades => array['Um sistema de organização simples e de fácil manutenção, que permita a todos os membros da NRO e do LABBIO identificar os equipamentos da NRO.'],
  ameacas => array['Desmotivação pela morosidade do trabalho.']);

-- ============================================================
-- TRB-10  Calendário de publicação
-- ============================================================
select pg_temp.trb(
  numero => 10, referencia => 'Calendário de publicação', tipo => 'campanha', projeto => null,
  responsaveis => array['Maria Teresa', 'Tiago Morais'],
  alocacao => '2 trainees, com a colaboração de outros', complexidade => 1, esforco => 2,
  escopo => $md$
Planejar e completar o repositório de ideias de publicação da NRO e organizá-las num calendário de publicação.
$md$,
  justificativa => $md$
- Organiza e dá visibilidade aos resultados dos projetos da NRO.
- As informações públicas dos projetos (NRO-MKT-002) servem de base para as ideias de publicação.
$md$,
  entregaveis => $md$
- Repositório de ideias de publicação, com tema, projeto de origem, formato, canal e dependências.
- Critérios de priorização das ideias, aprovados pelo responsável.
- Calendário de publicação para o período definido pelo responsável.
$md$,
  dependencias => null,
  criterios => $md$
- Repositório com ideias para todos os projetos ativos da NRO.
- Calendário aprovado pelo responsável, com as datas e os responsáveis de cada publicação.
- Ideias que dependem de aprovação (por exemplo, do CEP) sinalizadas.
$md$,
  forcas => null, fraquezas => null, oportunidades => null, ameacas => null);
select pg_temp.trb_doc(10, 'NRO-MKT-002');

-- ============================================================
-- TRB-11  SOMA (gestão e manutenção)
-- ============================================================
select pg_temp.trb(
  numero => 11, referencia => 'SOMA (gestão e manutenção)', tipo => 'campanha', projeto => null,
  responsaveis => array['Matheus Marcondes'],
  alocacao => '1 trainee', complexidade => 3, esforco => 2,
  escopo => $md$
Implantar o sistema de gestão e manutenção da plataforma SOMA.
$md$,
  justificativa => $md$
- O SOMA sustenta o registro dos treinamentos e pode abrigar o inventário da NRO (TRB-4 e TRB-9).
- A plataforma precisa de gestão e manutenção contínuas para continuar útil à equipe.
$md$,
  entregaveis => $md$
- Levantamento do estado atual da plataforma e das pendências.
- Fluxo de gestão da plataforma: pedidos de melhoria e de correção, priorização e versionamento.
- Rotinas de manutenção documentadas (por exemplo, backup, atualizações e controle de acessos).
- Documentação técnica da plataforma e passagem de conhecimento a pelo menos mais um membro.
$md$,
  dependencias => $md$
- O escopo detalhado é confirmado pelo responsável no início do trabalho, a partir do levantamento do estado atual.
$md$,
  criterios => $md$
- Fluxo de gestão e rotinas de manutenção em uso pela equipe.
- Documentação entregue e revisada pelo responsável.
- Plataforma mantida por mais de uma pessoa.
$md$,
  forcas => null, fraquezas => null, oportunidades => null, ameacas => null);

-- ============================================================
-- TRB-12  Projeto Arabella (product concept)
-- ============================================================
select pg_temp.trb(
  numero => 12, referencia => 'Projeto Arabella (product concept)', tipo => 'viabilidade', projeto => 'Arabella',
  responsaveis => array['Clévio'],
  alocacao => null, complexidade => null, esforco => null,
  escopo => $md$
Formalizar a proposta do Projeto Arabella, um ERP de gestão hospitalar para as demandas da Federassantas. O projeto está em fase de conceito e sem supervisor definido.
$md$,
  justificativa => $md$
- Transformar a demanda do stakeholder em proposta formal é a condição para o projeto avançar.
- A proposta permite avaliar a viabilidade, os recursos e os parceiros antes de começar o desenvolvimento.
$md$,
  entregaveis => $md$
- Registro das demandas da Federassantas (reuniões ou entrevistas realizadas).
- Proposta de projeto: problema, objetivos gerais e específicos, escopo, parceiros, resultados esperados, riscos, recursos, cronograma e estimativa de custos.
- Informações públicas do projeto no formato do NRO-MKT-002 (título técnico, resumos técnico e para o público geral, objetivos e parceiros).
- Sugestão de supervisor para o projeto.
$md$,
  dependencias => null,
  criterios => $md$
- Proposta validada pelo stakeholder e aprovada pela liderança da NRO.
- Informações públicas redigidas no formato do NRO-MKT-002.
- Supervisor sugerido, se a proposta for aprovada.
$md$,
  forcas => null, fraquezas => null, oportunidades => null, ameacas => null);
select pg_temp.trb_doc(12, 'NRO-MKT-002');

-- ============================================================
-- TRB-13  Projeto Zéfiro (product concept)
-- ============================================================
select pg_temp.trb(
  numero => 13, referencia => 'Projeto Zéfiro (product concept)', tipo => 'viabilidade', projeto => 'Zéfiro',
  responsaveis => array['Nicolas Henrique'],
  alocacao => '2 a 3 trainees', complexidade => 3, esforco => 4,
  inicio => date '2026-11-07', fim => date '2026-12-13',
  escopo => $md$
Formalizar a proposta do Projeto Zéfiro, um controle remoto universal para as demandas de Théo Carvalho. O projeto está em fase de conceito e sem supervisor definido.
$md$,
  justificativa => $md$
- Transformar a demanda do stakeholder em proposta formal é a condição para o projeto avançar.
- A proposta permite avaliar a viabilidade, os recursos e os parceiros antes de começar o desenvolvimento.
- O NRO-MKT-002 descreve o Zéfiro como um sistema de controle ambiental integrado a tecnologias de comunicação aumentativa e alternativa, para pessoas com deficiências motoras e de fala severas.
$md$,
  entregaveis => $md$
- Registro das demandas de Théo Carvalho (reuniões ou entrevistas realizadas).
- Proposta de projeto: problema, objetivos gerais e específicos, escopo, parceiros, resultados esperados, riscos, recursos, cronograma e estimativa de custos.
- Informações públicas do projeto atualizadas no formato do NRO-MKT-002, se o escopo mudar.
- Sugestão de supervisor para o projeto.
$md$,
  dependencias => null,
  criterios => $md$
- Proposta validada pelo stakeholder e aprovada pela liderança da NRO.
- Proposta coerente com as informações públicas do NRO-MKT-002.
- Supervisor sugerido, se a proposta for aprovada.
$md$,
  forcas => array['Proposta de projeto prático, com demanda real.', 'Pode ser generalizado para outras aplicações.'],
  fraquezas => array['A usabilidade da entrega final depende muito do feedback iterativo do stakeholder.'],
  oportunidades => array['Desenvolvimento de tecnologia assistiva de baixa complexidade.',
                         'Capacitação em hardware de quem participa.',
                         'Repercussão na mídia e reconhecimento local.'],
  ameacas => array['Alto custo de prototipação.']);
select pg_temp.trb_doc(13, 'NRO-MKT-002');

-- ============================================================
-- TRB-14  Projeto Calima (clínica: atraso eletromecânico)
-- ============================================================
select pg_temp.trb(
  numero => 14, referencia => 'Projeto Calima (clínica: atraso eletromecânico)', tipo => 'etapa', projeto => 'Calima',
  responsaveis => array['Pedro Caversan'],
  alocacao => '2 trainees de clínica', complexidade => 4, esforco => 4,
  escopo => $md$
Revisar a literatura sobre o atraso eletromecânico (*electromechanical delay*) em cada músculo dos membros inferiores: o valor médio e a variância em pessoas com atrofia muscular crônica, lesão medular ou AVC e em pessoas sem essas condições, e como fatores externos (fadiga, hidratação, entre outros) o influenciam. A busca não se limita a artigos de FES-cycling.
$md$,
  justificativa => $md$
- Tema muito relevante, de conhecimento menos específico que o de outros trabalhos de clínica.
- Conhecimento indispensável para um modelo prático completo da compensação do atraso total do sistema (TRB-5).
$md$,
  entregaveis => $md$
- Revisão da literatura sobre o atraso eletromecânico, com os valores médios e a variância para os diferentes grupos e condições, considerando o nível de confiança da evidência.
- Relatório final com recomendações práticas para integrar os resultados ao modelo de compensação angular (TRB-5).
- Rascunho de resumo ou artigo, se os resultados permitirem.
$md$,
  dependencias => null,
  criterios => $md$
- Relatório entregue com recomendações fundamentadas, aceito pelo responsável.
- Recomendações recebidas e consideradas pela equipe de firmware (TRB-5).
$md$,
  forcas => array['Trabalho acessível para estudantes de medicina ou fisioterapia.', 'Vital e urgente para o projeto.'],
  fraquezas => array['Escopo amplo e pesquisa extensa, que podem confundir ou desanimar.'],
  oportunidades => array['Desenvolve a capacidade de pesquisa acadêmica da equipe de clínica.',
                         'Possível texto científico: revisão bibliográfica ou meta-análise.'],
  ameacas => array['Fracasso por falta de orientação técnica.']);

-- ------------------------------------------------------------
-- O REGISTRO
-- ------------------------------------------------------------
insert into public.migracoes (id, descricao) values
  ('2.23.0_trabalhos_2026_2', 'Os trabalhos dos trainees do PS 2026/2 (TRB-1 a TRB-14): as fichas revisadas, os responsáveis das fichas e da planilha, as etapas dos roteiros do TRB-1 e do TRB-2 como cartões e os documentos do rol citados')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- O QUE O SQL EDITOR MOSTRA NO FIM: confira "sem membro"
-- ------------------------------------------------------------
select codigo as trabalho, situacao, coalesce(responsaveis, '—') as responsaveis,
       coalesce(sem_membro, '') as "sem membro (pôr pela tela)", coalesce(projeto, '—') as projeto,
       documentos, atividades as cartoes
  from trb_rel order by numero;

-- ============================================================
-- FIM
--
-- Depois de rodar, confira a coluna "sem membro": cada nome ali não
-- achou um membro ativo só (ou achou nenhum, ou mais de um). Ponha a
-- pessoa como responsável pela tela (Projetos, Trabalhos, o trabalho,
-- Editar). Os trainees entram em Projetos, Pessoas e trabalhos.
-- ============================================================
