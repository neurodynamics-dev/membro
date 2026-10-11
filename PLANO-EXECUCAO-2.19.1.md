# SOMA 2.19.1: plano de execução (Reporte, LABBIO, Trainees)

Complementa `PLANO-2.19.1.md` (a matriz) e o plano funcional da coordenação
(`PLANO-IMPLEMENTACAO-SOMA-2.19.1.md`, §5, §7, §8 e §11), que continua sendo a
referência de **regras**. Aqui fica o **como**: arquivos, contratos, ordem,
testes e quem executa.

## Como ler

- **[O]**: desenho e SQL com permissão, regra de tempo ou mudança em dado
  existente. Rodar com Opus (esforço alto nas migrações).
- **[S]**: tela, CSS, rota, stub e teste de navegador sobre um contrato já
  definido aqui. Rodar com Sonnet.
- Cada pacote fecha com: migração + teste de banco (`db/testes/`), stub em
  `testes/stub-supabase.js`, teste de navegador em `testes/`, nota em
  `db/LEIAME.md` e `PUBLICACAO-2.19.md`. Um commit por tarefa, na branch
  `slp/ecstatic-noether-evq50w`.
- Sem agentes em paralelo. Uma tarefa por vez, suíte inteira antes do push
  (`/tmp/runall.sh` ou equivalente).

## Decisões em aberto (respostas padrão, se ninguém disser o contrário)

| # | Pergunta | Padrão adotado |
|---|---|---|
| D1 | Grupos reais de PMO, Pessoal, Coord. Office e Trainee | Pelo nome (`NRO_PMO`, `NRO_PESSOAL`, `NRO_COORD_OFFICE`, `NRO_TRAINEE`) ou pela chave já usada (`pmo`, `pessoal`). A migração não cria grupo: avisa o que falta, e o efeito que depende dele fica registrado sem cartão |
| D2 | "Fato distinto" na reincidência | Uma ocorrência contável por pessoa e ciclo; dois líderes no mesmo ciclo = uma |
| D3 | Pendência de sexta no fim de semana | Fica até resolver; não acumula duas semanas (a nova substitui a velha, a velha vira "não enviado") |
| D4 | Ciclo e fechamento | A sprint abre na segunda e fecha na sexta; a reunião da gerência é sexta 16h. Cobrança: sexta 16h (a hora da reunião). O ciclo fecha quando a sprint seguinte abre (segunda 0h, America/Sao_Paulo): entre sexta 16h e segunda 0h o envio é aceito e marcado como atrasado |
| D5 | Campos da ficha visíveis ao LABBIO | Nome, nome civil, foto, e-mail, telefone, situação, cargo, área, gestor, CPF e matrícula (só no pedido de acesso), termo, acesso. Sem bolsa, avaliação, autodeclaração, acessibilidade |
| D6 | Situações que exigem revogação física | Desligamento e dispensa de trainee. Férias e afastamento: não |
| D7 | Ocupação temporária do tablet | Compartilhada (servidor), até 30 min, limitada à próxima reserva |
| D8 | Vínculo trainee | Pelo cargo: `membros.cargo = 'Trainee'`, sem coluna nova; status operacional continua `Ativo`. Função `eh_trainee(reg)` centraliza a regra |

---

## Pacote R: Reporte semanal (estrutura muda pouco; o grosso é tela)

O banco atual (`db/2.18.0_soma.sql`, linhas 1313–1520) já tem ciclos, reporte
com versão, salvar e enviar, feed por reporte e o unificado. Muda: a unidade
(autor em vez de frente), a separação cobrança × fechamento, as sinalizações e
a gravação na ficha. `membros.gestor_registro` já existe (usado em
`v15_atividades.sql`).

### R1 [O] Migração `db/2.19.1_reporte.sql` (feita; contrato em `fichas/CONTRATO-REPORTE.md`)

> O que segue é o desenho original. Onde divergir, vale o contrato e a migração.

- `reportes.frente_id` passa a aceitar nulo; nova coluna `modelo`
  (`'frente'` legado, `'lider'` novo); índice único parcial
  `(ciclo_id, autor) where modelo = 'lider'`. Reportes antigos ficam como estão.
- `reportes.pessoas jsonb`: fotografia da cadeia ao abrir
  (`[{registro, nome, origem: 'direto'|'excepcional', justificativa}]`).
- `reporte_ciclos`: `fecha_em timestamptz` (D4: segunda 0h seguinte) ao lado
  do `prazo` (sexta 16h, a cobrança e a reunião da gerência).
  `reporte_salvar`/`reporte_enviar` passam a checar `fecha_em`; `reportes`
  ganha `atrasado bool` (enviado depois do `prazo`). `reporte_config` passa a
  ter padrão sexta 16h (`dia_prazo = 5`, `hora_prazo = '16:00'`); a reunião
  (`dia_reuniao`, `hora_reuniao`) passa a ser sexta 16h também.
- `reporte_sinalizacoes(id, registro, reporte_id, ciclo_id, autor,
  relato, conversa_confirmada bool not null, criada_em, sequencia_id)` e
  `reporte_sequencias(id, registro, aberta_em, pmo_card, offboarding_em,
  offboarding_cards)`. Processamento com `pg_advisory_xact_lock(registro)`.
  Regra do §8.3: dia 0 → card `NRO_PMO`; até 60 dias (inclusive) → cards em
  `NRO_PESSOAL` e `NRO_COORD_OFFICE` (dois cards, `atividade_de_origem` com
  origem incluindo o destino); offboarding aberto → só histórico; 61+ → nova
  sequência; card de PMO no máximo um a cada 30 dias.
- `membro_reporte_avaliacoes(registro, ciclo_id, autor, entregas,
  assiduidade, fonte, criada_em, unique(registro, ciclo_id, autor))`: o que
  vai à ficha, gravado no envio, idempotente.
- `reporte_cobrancas(ciclo_id, registro, resolvido_em, como
  'enviado'|'ausente'|'ferias', unique(ciclo_id, registro))`.
- `ausencia_vigente(registro, instante)` já existe (recadastro): reaproveitar
  para férias/afastamento.
- RPCs novas/trocadas:
  - `reporte_meu(p_ciclo uuid default null)` → `{status, ciclo, reporte,
    pessoas, mudancas_na_cadeia[], feed[]}` (abre se não existir; liderados
    diretos = `gestor_registro = eu` e status ativo).
  - `reporte_participante(p_id, p_registro, p_justificativa, p_incluir bool)`.
  - `reporte_salvar(p)` aceita `apontamentos[].sinalizacao = {relato,
    conversa_confirmada}`; rascunho não cria efeito.
  - `reporte_enviar(p_id, p_versao)`: grava avaliações, sinalizações,
    sequências, resolve cobrança; publica nada no feed (pacote F).
  - `reporte_cobranca_estado()` → `{status: 'nenhuma'|'aviso'|'obrigatoria',
    ciclo, desde}` calculado com `now() at time zone 'America/Sao_Paulo'`
    (sexta 7h–16h aviso; ≥16h obrigatória até resolver).
  - `reporte_ausente(p_ciclo)` → resolve com `como = 'ausente'`.
  - `reporte_unificado(p_ciclo)` refeito para o modelo líder (mantém o legado
    para ciclos antigos), com `gerado_em` congelado no retorno. Gerado para a
    reunião de sexta 16h; quem enviar depois aparece numa nova geração,
    marcado como atrasado.
- Ativação: `reporte_config.modelo_lider_desde date`. Ciclos anteriores não
  geram cobrança (§8.4, sem retroativo).
- **Teste** `db/testes/2.19.1_reporte.sql`: dias 0/7/31/60/61, reenvio
  idempotente, terceiro aviso sem duplicar, dois líderes no mesmo ciclo,
  envio após 16h aceito, após `fecha_em` recusado, ausente sem avaliação
  fictícia, férias dispensam, cobrança não retroativa, mudança de gestor não
  reescreve enviado.

### R2 [S] Rota e menu (ficha: `fichas/R2.md`)

- `#/servicos/reporte` (e `/1..4`, `/config`); `#/equipe/reporte*` redireciona
  (ALIAS em `index.html`). Item em Serviços só com `tenhoPapel('lideranca')`.
  Atualizar busca (`acoesDaCasca`), links de notificação e `tour.html`.
- Teste: `testes/reporte.mjs` (rotas antigas redirecionam; leitura não vê).

### R3 [S] Tela do reporte (`mod-reporte.js`) (ficha: `fichas/R3.md`)

- Lista some: abre direto o reporte da semana (`reporte_meu`).
- Passo 1 Apontamentos: uma linha por pessoa, dois **switches**
  (`role="switch"`, rótulo "Entregas: suficiente/insuficiente"), padrão
  suficiente; origem (direto/excepcional); botão "Sinalizar" abre modal com
  relato obrigatório e caixa "Já conversei com a pessoa para corrigir"
  obrigatória. "Adicionar participante" com busca de membros e justificativa.
  Faixa de "a cadeia mudou desde que você abriu" quando `mudancas_na_cadeia`.
  Sem liderados: texto explicando e segue para o passo 2.
- Passos 2 e 3 como hoje (o editor do feed muda no pacote F).
- Passo 4 Revisão: resumo + envio; depois do envio, só leitura.
- Componentes já existentes: `layoutFluxo`, `etapas`, `.switch` do DS (se não
  houver, criar em `brand/design-system` e distribuir).

### R4 [S] Cobrança de sexta (ficha: `fichas/R4.md`)

- Casca: `carregarObrigacoes()` ganha `reporte_cobranca_estado`; se `aviso`,
  pop-up dispensável (por sessão); se `obrigatoria`, mesmo guard do
  recadastro (`obrigacaoBloqueia`) levando a `#/servicos/reporte`, com botão
  "Estive ausente" → `reporte_ausente`. Reavaliar em `visibilitychange` e a
  cada 5 min com a aba visível. Hora sempre do servidor.
- Teste de navegador com o stub devolvendo cada estado.

### R5 [S] PDF unificado (ficha: `fichas/R5.md`)

- `doc-nro.js` `reporteUnificado` com `e.tabela`: cabeçalho do ciclo
  (cobertura, enviados, ausentes, pendentes), apontamentos (inclui
  insuficiência sem sinalização), escalonamentos, atrasados, divulgação.
  Contrato vem de R1. Teste em `testes/documentos-e-eventos.mjs` ou novo.

---

## Pacote L: LABBIO

Ordem obrigatória: L1 (identidade, segurança) antes de qualquer tela.

### L1 [O] Migração `db/2.19.1_labbio_base.sql` (feita: 52 asserções; a defesa tem também a porta da API, `api_pre_request`)

- `labbio_gestores(user_id uuid pk references auth.users, nome, email,
  situacao 'convidado'|'ativo'|'revogado', principal bool, convidado_por,
  convidado_em, aceito_em, revogado_em, ultimo_acesso)`; índice único parcial
  `where principal and situacao = 'ativo'`.
- `labbio_convites(token_hash, email, expira_em, usado_em, criado_por)`.
- `conta_labbio()` (gestor ativo). **`conta_ativa()` passa a ser falsa para
  conta LABBIO** (como foi feito com o quiosque), então nenhuma tabela e
  nenhuma RPC interna lê. As RPCs `labbio_*` checam `conta_labbio()` a cada
  chamada (revogação vale na hora, sem esperar o JWT).
- RPCs: `labbio_gestores_lista`, `labbio_convidar(email)` (admin ou gestor),
  `labbio_aceitar(token)`, `labbio_revogar(user_id)` (recusa o último
  principal sem substituto), `labbio_principal(user_id)` (troca atômica),
  `labbio_eu()` (atualiza `ultimo_acesso`).
- E-mail do convite pela fila existente (destino por e-mail, sem registro
  fictício).
- **Teste**: conta LABBIO não lê `membros`, `atividades`, Storage `fotos`/`termos`
  direto; revogada não chama nada; um principal sempre.

### L2 [S] Casca `/labbio`

- `labbio/index.html` + `labbio/labbio.js` + `labbio/labbio.css`, sem carregar
  o `index.html` do SOMA. Hash routing dentro de `/labbio/` (o host é
  estático: `/labbio/` resolve para o index; nada de rotas por caminho).
- Tema Retina só no escopo `.labbio` (tokens do DS; exceção marcada com
  `auditar: ok`). Logo LABBIO à esquerda da NRO (`marca/` + `studio/labbio.png`
  até chegar o vetor).
- Login próprio; sessão sem `conta_labbio()` → mensagem e sair. No SOMA, conta
  LABBIO que abrir `index.html` é mandada para `/labbio/`.
- Rotas: início, membros, membro/:reg, solicitações, check-ins,
  treinamentos, agenda, gestores.
- Admin no SOMA: painel `labbio` em PAINEIS (lista, convidar, revogar, estrela).

### L3 [O] Migração `db/2.19.1_labbio_dados.sql` (consultas) (feita: 25 asserções)

- `labbio_membros(p_busca, p_filtros)`: só os campos de D5; termo
  (`termo_situacao`) e acesso (`acessos_concedidos` do item LABBIO).
- `labbio_membro(p_reg)`: perfil + histórico de acesso + termo
  (`labbio_termo_url(p_reg)` gera URL assinada curta do bucket `termos`;
  policy nova para a conta LABBIO só via essa função).
- `labbio_checkins(p_de, p_ate, p_reg, p_origem, p_pagina)`.
- `labbio_treinamentos()`: matriz pessoa × treinamento/revisão com
  conclusão/validade, sem gabarito (lê `treinamento_conclusoes`).
- `labbio_revogacoes()` + `labbio_revogacao_confirmar(id)`: gatilho em
  `membros` (status para desligado, D6) cria pendência **sem notificar**.
  Cobre também a dispensa de trainee (T1 põe o status em Desligado).
- **Teste**: cada função recusa conta comum; campos fora de D5 não saem.

### L4 [S] Telas de consulta

Membros (tabela com busca/filtros, ícone + texto para termo e acesso),
perfil, check-ins (paginado, painel lateral explicando as origens),
treinamentos (matriz com filtros), faixa de revogações no início.

### L5 [O] Solicitação de acesso biométrico (feita: `db/2.19.1_labbio_acesso.sql`, 48 asserções)

- `portal_solicitacoes` ganha subtipo pelo id estável do catálogo
  (`acessos.chave = 'labbio_biometria'`); estados novos
  `pessoal_analise → labbio_analise → implantacao → concedido`, mais
  `devolvido`, `negado_pessoal`, `negado_labbio`, `cancelado`.
- `pessoal_solicitacao_decidir` muda **só para esse subtipo**: aprovar
  encaminha (não concede) e enfileira um e-mail ao principal.
- `labbio_solicitacoes`, `labbio_solicitacao_decidir(id, ok, motivo)`,
  `labbio_implantacao_confirmar(id)` (só aí `acessos_concedidos`).
- Foto: bucket privado `biometria` (separado de `fotos`), versão por envio;
  corrigir cria nova versão e volta para análise.
- **Teste**: outros tipos de solicitação seguem iguais; aprovar do Pessoal não
  concede; só a confirmação concede.

### L6 [S] Telas do pedido

Formulário do membro com câmera (frontal, guia oval, prévia, refazer,
desligar ao sair, fallback de upload), trilha visual no modelo de Arquivos;
no `/labbio`, fila de pedidos com copiar por campo, baixar foto, negar com
motivo, confirmar implantação.

### L7 [O] Agenda: consulta de salas (feita: `db/2.19.1_labbio_salas.sql`, 19 asserções)

- `espacos.labbio bool`, `espacos.consulta_labbio bool` (Sala de Reuniões,
  Auditório). `labbio_consultas(evento_id, ocorrencia, versao, situacao
  'pendente'|'ok'|'conflito', motivo)`; gatilho em `agenda_evento_salvar`
  invalida consultas de versão antiga. Silêncio = evento válido.
- `labbio_agenda(p_de, p_ate)`, `labbio_consulta_decidir(id, ok, motivo)`
  (conflito notifica o organizador uma vez).

### L8 [S] Agenda no `/labbio` e aviso ao organizador.

### L9 [O] Tablets (feita: `db/2.19.1_labbio_tablets.sql`, 17 asserções; gestão em `labbio_dispositivo_*`)

- `sala_dispositivos(id, espaco_id, rotulo, token_hash, ativo)`,
  `sala_ocupacoes(espaco_id, ate, criada_por_dispositivo)`.
- `sala_estado(p_token)` (anon, só o operacional), `sala_ocupar(p_token,
  p_minutos)`, `sala_liberar(p_token)`; limite pela próxima reserva, hora do
  servidor.

### L10 [S] `sala.html?d=<token>`: tela de tablet 6–7", polling de 60 s,
"sem atualização desde hh:mm" offline, QR de detalhes sem token.

---

## Pacote T: Trainees

### T1 [O] Migração `db/2.19.1_trainees.sql` (feita: 33 asserções; trainee pelo cargo, sem coluna nova)

- Sem coluna nova (D8): trainee é `membros.cargo = 'Trainee'`, lido só por
  `eh_trainee(p_reg) returns boolean`. Como o status continua `Ativo`, os
  filtros existentes (`status in ('Ativo', ...)`) já incluem o trainee;
  conferir só os pontos que devem **excluir** trainee (ex.: avaliações de
  efetivos, se houver) e listar no teste.
- `ps_admitir_trainee(p_candidatos uuid[], p_area, p_gestor, p_grupos int[])`:
  idempotente por candidato (`registro_membro`), cria `membros` com
  `cargo = 'Trainee'`, status `Ativo`, põe em `NRO_TRAINEE` + grupos, liga conta por
  e-mail se existir; não marca o candidato como integrado.
- `trainee_efetivar(p_reg, p_cargo)` (troca o cargo, tira de `NRO_TRAINEE`), `trainee_dispensar(p_reg, p_motivo)` (dispensa
  cria pendência de revogação LABBIO se houver acesso, L3).
- `trainees_quadro(p_area_interesse)`.
- Recadastro/termo: `cadastro_elegivel` já cobre (status Ativo).
- **Teste**: admissão repetida não duplica; efetivação preserva tudo;
  dispensa não apaga.

### T2 [S] Telas

- Seleção › aba "Trainees": lista dos candidatos já em `trainee`, admissão
  individual/lote com prévia (área, gestor, grupos), botões efetivar/dispensar.
- Equipe › Quadro de pessoal: filtro "trainees" e por área de interesse;
  chip "Trainee" consistente (ficha, organograma, busca).

### T3 [O+S] Onboarding com progresso no servidor

- [O] `onboarding_trilhas(versao, etapas jsonb)`, `onboarding_progresso
  (registro, versao, etapa, concluida_em)`; etapas obrigatórias leem o fato
  real (dados conferidos, termo enviado, treinamento concluído).
- [S] `tour.html` lê/grava o progresso quando logado; conteúdo das etapas
  de organização e segurança fica com marcador "a validar" até a coordenação
  mandar.

---

## Ordem e checkpoints

1. R1 → R2 → R3 → R4 → R5 (o reporte destrava o resto da casca).
2. L1 → L3 → L2 → L4 → L5 → L6 → L7 → L8 → L9 → L10.
3. T1 → T2 → T3.

Cada [O] termina com o contrato publicado aqui (RPC, campos, estados) e o
teste de banco passando. A partir daí, a [S] correspondente pode ir para o
Sonnet só com este arquivo, o contrato e o teste de navegador a escrever.
