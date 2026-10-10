# Plano: design system da NeuroDynamics nas plataformas

Escopo: `brand`, `membro` (SOMA), `website` e `selecao`. A fonte é o pacote
`nro_design_system` (readme.md, interface-rules.md, tokens, componentes,
cards). Nas interfaces vale `interface-rules.md` e só o modo operacional.
Este documento diz **o que** fazer, **em que ordem** e **como saber que
ficou pronto**. Cada fase pode ser executada numa sessão própria, citando a
seção correspondente.

## Estado

| Fase | Situação |
|---|---|
| Casca dos sites (cabeçalho e rodapé) | Feita: brand, website, selecao e o rodapé do SOMA |
| 0 | Feita (brand): tokens com tema, `neuro.css` v3, `casca.*`, `v3/`, `distribuir.mjs`, `auditar.mjs` |
| 1 | Feita (membro): `ds/`, `soma.css`, `cabecalho()` e templates, `#/dev/templates`, `testes/templates.mjs` |
| 2 | Feita (membro): Equipe inteira no cabeçalho único (Organograma, Quadro, Ficha, Presença, Feed), Reporte reconstruído com endereços e fluxo de 4 passos, Marca reconstruída. A Ficha mantém o corpo atual (a lateral com SpecList e os Newsletters ficam para a Fase 4) |
| 3 a 7 | A fazer |

## 0. Decisões tomadas

| Tema | Decisão |
|---|---|
| Quiosque | As duas composições do card de widgets: A (três colunas, padrão) e B (faixa e palco), trocadas por `?layout=b`. Os widgets são os mesmos |
| SOMA › Marca | Fica no SOMA só o que exige login: assinatura de e-mail, modelos controlados (ligados a Arquivos) e configurações. Logos, wallpapers, kit de interface e prompts vão para o brand, que é público |
| Tema claro | Continua como opção da pessoa. O DS permite ambiente claro trocando as variáveis, com Axon no lugar de Synapse. Todo template é conferido nos dois temas |
| website e selecao | Refatoração completa, com os mesmos templates de site do brand |
| Nomes de classe | Os nomes atuais (`.nav1`, `.abas`, `.seg`, `.fld`, `.btn`, `.pill`, `.chip`, `.card`) continuam sendo a API. São mais de mil usos e renomear não traz ganho visual. A tabela da seção 2.3 liga cada classe ao componente do DS |
| Valores de token | Onde o pacote e `brand/design-system/tokens.css` divergem, vale o do repositório (seção 2.1) |

## 1. Diagnóstico

### 1.1 SOMA (membro)

**Cabeçalhos de tela: dois padrões concorrentes.** O `.pg-head` (h1 de 28 a
44px), usado em Equipe, Serviços, Marca, Presença e Reporte, convive com o
`topoGestao()`/`.topo-gestao .tx` (h1 de 24 a 34px), usado em Quadro de
pessoal, Arquivos, Projetos, Studio, Treinamentos, Cofre e Admin. Por isso o
título do Organograma (`pg-head`, "Equipe") é bem maior que o do Quadro de
pessoal (`topo-gestao`). Além disso, cada módulo monta o próprio topo:
`repTopo`, `marcaTopo`, `topoGestao` e HTML solto.

**O eyebrow muda de função a cada tela:**

| Tela | Eyebrow hoje | Problema |
|---|---|---|
| Organograma | "Quem é quem" + h1 "Equipe" | slogan; o h1 repete o espaço |
| Atividades, Carga | "Trabalho" | nome que não existe no menu |
| OKRs | "Planejamento estratégico" | idem |
| Seleção | "Comitê de Seleção" | idem |
| Meus pedidos | "Acompanhamento" | idem |
| Cofre, Documentos, Formulários | "Serviços › Cofre", "Arquivos › Escrever no portal" | trilha dentro do eyebrow, com separador |
| Studio, Projetos | "Studio" + h1 "Studio" | redundante |
| Atividade, Publicação, Treinamento | "ORT, ORT-14", "Studio › POST-14", "NRO-TRE-003, Rev. B" | código (dado) dentro de rótulo |
| Feed da equipe | nenhum | e sem a navegação de Equipe |

**Voltar: quatro padrões.** `ibtn('back')` no `topoGestao`, o link `.voltar`
em maiúsculas, o `.tre-voltar` dos treinamentos e o botão "Voltar" no rodapé
do Reporte. O Feed não tem nenhum.

**CSS copiado à mão.** O `<style>` do `index.html` tem 243 KB, com comentários
"neuro.css, ao mexer, mexa lá primeiro". A cópia diverge do brand sem que
ninguém perceba.

**Violações do checklist (seção 13 das regras), contadas por script:**
`index.html` tem 216 hex literais, 56 raios de pílula, 16 pontos médios e 44
`box-shadow`. O `.seg` e o `.chip.on` usam fundo Synapse para seleção (regra
4: seleção é 9% de branco e tinta). O `.chip` tem raio 18 (deve ser 6). O
`.card` tem `backdrop-filter` (vidro só em superfície do conjunto primário).
O `.empty` e o `.vazio` são dois estados vazios. `tour.html` tem 136 hex e 34
pílulas; `quiosque.html`, 25 hex e 12 fontes literais.

**Reporte semanal (mod-reporte.js), UX e UI:**
- A navegação de etapas usa o seletor de seções (`navNivel1` com
  `javascript:`). Etapa é progresso, não seção.
- O fluxo não tem endereço: a frente aberta vive só em memória, e recarregar
  a página perde o lugar (PADROES §2: toda tela tem endereço).
- Há cartões dentro de cartões: frente › membro › campos.
- Os valores aparecem como `SUFICIENTE`/`INSUFICIENTE` em maiúsculas, num
  select para uma escolha de dois valores.
- A justificativa fica sempre aberta, mesmo quando nada a exige.
- Todos os botões são iguais, sem ação principal clara. O "Voltar" fica no
  rodapé e o "Enviar" aparece só na etapa 3, sem revisão antes do envio.
- Um reporte travado aparece como formulário desativado (opacidade .4), o
  que dificulta a leitura.
- **Duas implementações:** `#/equipe/apontamento` ainda abre
  `pageApontamento()` (mod-gestao.js:954), embora o PADROES a declare alias
  de `#/equipe/reporte`.

**SOMA › Marca (mod-marca.js):** repete dentro do portal o que é público
(wallpapers, logos, CSS, componentes em iframe, prompts). Os tiles usam
`style=` com hex, sem empty state nem skeleton. A configuração é uma pilha de
selects sem contexto. O "README para IA do Studio" pertence ao Studio.

**Quiosque:** a tela atual tem três colunas fixas (hora e clima, agenda, QR e
check-ins) e uma sobreposição de boas-vindas. Faltam a rotação de widgets com
progresso segmentado, o fundo que muda com a hora do dia, o placar e as
sequências (Lúmen), o laboratório agora, a semana, os avisos e as boas-vindas
em faixa de família, o momento de check-in no conjunto primário e a
composição B. Todos os dados vêm de uma RPC só, `quiosque_estado`.

### 1.2 brand

- As capas de capítulo ocupam 72vh com um rótulo em Plex Mono ("MANUAL DA
  MARCA / 02"). Isso viola a regra 3 e esconde o conteúdo.
- `cores.html` tem 405 hex literais. Os swatches são HTML escrito à mão, e
  não saem dos tokens.
- Não existe porta de entrada por público. Parceiro, fornecedor e
  desenvolvedor caem no mesmo texto corrido. Downloads ficam espalhados entre
  a Galeria e o SOMA.
- "Área da equipe" em texto Synapse no cabeçalho, como um segundo destaque.
- **Ponto positivo:** `design-system/tokens.css` está mais correto que o
  pacote (seção 2.1) e já serve o portal.

### 1.3 website e selecao

- Tokens próprios com nomes antigos (`--green`, `--green2`, `--teal`,
  `--syn`, `--deep`, `--panel`, `--ambar`, `--azul`, `--roxo`). Nenhum link
  para o design system.
- `selecao/index.html` tem 26 raios de pílula e 57 hex. `cartazes.html` tem
  66 pontos médios e `redes.html`, 34. `website/index.html` tem 23 pontos
  médios.
- O seletor de idioma do website aparece no cabeçalho fechado do celular
  (regra 6: só com o menu aberto).
- `cartazes.html` e `redes.html` geram **peças** (cartaz, post), não
  interfaces. Seguem as regras de documento (modo operacional, uma família
  por peça), não as de interface. A `dinamica-painel.html` é projetada em
  sala: segue o registro do quiosque (widgets).

## 2. Fase 0: a base compartilhada (brand/design-system)

Tudo depende desta fase. Faça-a com o modelo mais forte disponível, porque
ela define os padrões que as fases seguintes só aplicam.

### 2.1 Tokens

`brand/design-system/tokens.css` continua sendo a fonte. Ajustes:

- **Manter os valores do repositório** onde o pacote está desatualizado:
  `--tr-label: .14em` (o pacote diz .22em, o que contradiz a regra 3),
  `--r-pill: 7px` (o readme do pacote diz 7, os tokens dele dizem 6),
  `--r-chip: 6px`, `--r-tag: 5px`, `--r-badge: 4px`, `--veil`.
- Corrigir o comentário de `--fs-label` e `--fs-micro`, que fala de "Plex
  Mono, uppercase". Rótulo é Archivo 600.
- `base.css` do pacote pinta links com `var(--ion)`, uma família secundária
  ao lado de Synapse (regra 4). Link em interface fica em tinta com
  sublinhado de 1px `--line2`; no hover, o sublinhado fica `--synapse`.
- **Levar o tema claro do SOMA para o tokens.css** (`:root[data-tema="claro"]`
  e a "ilha escura"), junto com o trio `--tom`, `--ink-rgb`, `--syn`,
  `--syn-tx` e `--syn-borda`. Assim o claro deixa de ser só do SOMA, e o
  contraste de 4,5:1 é testado na fonte.
- Novos tokens de layout para os templates: `--w-leitura: 720px`,
  `--w-fluxo: 760px`, `--w-lateral: 320px`, `--w-quiosque-col: 420px`.
- Aliases antigos (`--soma`, `--vital`, `--mielina`, `--pulso`, `--plasma`,
  `--ion` solto) ficam marcados como obsoletos e saem na Fase 7, depois que o
  auditor confirmar zero usos.

### 2.2 Importar o pacote

- `design-system/v3/`: `interface-rules.md`, `readme.md`, os `.d.ts` e
  `.prompt.md` de cada componente, e os `*.card.html` (com `_ds_bundle.js`).
  São a referência visual; o código de produção continua em CSS e JS puros.
- O `DIRETRIZES.md` passa a apontar para `v3/readme.md` e
  `v3/interface-rules.md` como fonte, em vez de manter uma terceira cópia das
  regras.

### 2.3 neuro.css v3: um componente do DS, uma classe

Paridade com os JSX do pacote. As classes que já existem ficam; corrige-se o
visual.

| DS | Classe | O que muda |
|---|---|---|
| SectionNav | `.nav1` | contador `.n` (4px; Synapse só para pendência) |
| Tabs | `.abas` | nada |
| Segmented | `.seg` | `.on` passa a 9% de branco e tinta, sem Synapse |
| FilterBar | `.fb` | trazer o do card: grupos, contador neutro, tags removíveis, "Limpar filtros", total |
| Field | `.fld` | `actions` (ícones utilitários) e `submit` (envio Synapse no campo) |
| Select | `select.js` | já é o listbox do DS; vira o único |
| Button, IconButton | `.btn`, `.icbtn` | variantes `danger` (Critical) e `family`; `.claro` sai |
| Chip | `.chip` | raio 6, cerca de 26px de altura, `.on` quieto |
| Pill, Tag | `.pill`, `.tag` | raio 5; cor de estado sempre com rótulo |
| Card | `.card` | sem `backdrop-filter` |
| Band | `.band` | `.f-<família>`: ícone grande a 6%, botão da família |
| Widget | `.widget` (nova) | painel Sulco, slides, progresso segmentado |
| Metric | `.metrica` | número e informação embaixo, rótulo no alto |
| DataGrid | `.tabela` | números em mono à direita, linhas a 8%, cabeçalho a 16%, sem zebra |
| BarList | `.barras` | marcas discretas (1,5px e 4,5px, pontas retas) |
| ProportionBar | `.prop-bar` | quatro tons da família |
| SpecList | `.spec` (nova) | pares chave e valor da lateral do template Objeto |
| EmptyState | `.vazio` | absorve `.empty`; sempre com ação |
| Alert | `.alerta` | absorve `.aviso-box` (alias até a Fase 7) |
| Toast, Dialog | `.nd-toast`, `.dlg` | 4,2s; Dialog para decisão |
| Skeleton, Progress | `.skel`, `.progresso` | formas por template (seção 3.4) |
| Breadcrumb | `.trilha` (nova) | rótulos Archivo 600 maiúsculos, separador "/" |
| SiteHeader, MobileSiteMenu | `.nd-header` | igual aos cards |
| SideMenu, MobileAppMenu | `.lt-*` | conferir contra `sidemenu.card.html` e `mobile-navigation.card.html` (ordem do bloco de baixo, ícone quadrado no trilho, gaveta de 84%, etiqueta "SOMA") |
| Eyebrow | `.eyebrow` | quadrado Synapse, Archivo 600, .14em |

Também entram aqui as classes de **template** (seção 3) e de **site** (seção
6.2), porque brand, website e selecao as usam.

### 2.4 Distribuição sem build nos consumidores

O "sem build" do PLANO-UNIFICACAO (D2) continua valendo. O que muda é a
cópia: em vez de colar CSS no `index.html`, cada repositório recebe uma pasta
`ds/` gerada.

- `brand/scripts/distribuir.mjs` copia `tokens.css`, `neuro.css` e
  `select.js` para `../membro/ds`, `../website/ds` e `../selecao/ds`, com o
  cabeçalho `/* NRO DS 3.x.y, brand@<sha> */`.
- Cada consumidor liga `ds/tokens.css` e `ds/neuro.css`, e põe numa folha
  própria (`soma.css`, `site.css`) só o que é exclusivo dele.
- `testes/ds.mjs` em cada consumidor falha se `ds/` não bater com a versão
  publicada no brand.
- No membro, o `sw.js` passa a listar `ds/*` e `soma.css`.
- **Por que copiar e não linkar o CSS publicado no brand:** o portal e o
  quiosque não podem quebrar porque o brand publicou algo, nem ficar sem
  estilo quando estão offline.

### 2.5 Auditor

`brand/scripts/auditar.mjs` implementa o checklist da seção 13 como regras
de texto: hex fora de `tokens.css`, raio ≥ 15px fora de avatar e blob, Plex
Mono em rótulo, ponto médio e travessão separador em texto de UI, fundo
Synapse em seletor `.on`, `box-shadow` de elevação, emoji e `font-family`
literal. Ele roda sobre um repositório inteiro ou sobre os arquivos de um
diff. **É a cerca que faltou na tentativa anterior:** modelo nenhum entrega
fase com o auditor apontando violação nos arquivos que tocou.

**Pronto quando:** os cards do pacote e as previews do brand ficam visualmente
iguais lado a lado; `auditar.mjs` dá zero em `design-system/`; e
`distribuir.mjs` gera `ds/` nos três consumidores.

## 3. Templates do SOMA

Toda tela do SOMA é exatamente um destes templates. Eles moram na casca
(`index.html`), como funções que devolvem HTML, no mesmo estilo de
`navNivel1()`.

### 3.1 O cabeçalho único

Substitui `.pg-head`, `topoGestao()`, `repTopo()`, `marcaTopo()` e os topos
escritos à mão.

```js
cabecalho({
  espaco:  'Equipe',               // eyebrow: SEMPRE o nome do espaço no menu
  titulo:  'Organograma',          // h1: o nome da tela ou do objeto
  voltar:  ['Quadro de pessoal', '#/equipe/quadro'],  // só em objeto e subtela
  trilha:  [...],                  // em vez de voltar, quando a profundidade for 3 ou mais
  codigo:  'ORT-14',               // Tag em Plex Mono, na linha de meta
  meta:    [pill('Em andamento','signal'), 'Ana Silva'],  // linha de meta abaixo do h1
  lead:    '',                     // raro: uma linha (PADROES §9, o resto vai para dica())
  acoes:   [btn(...), btnSolid(...)],  // à direita; no máximo um sólido Synapse na tela
  secoes:  abasEquipe, atual: ''   // SectionNav logo abaixo, sempre no mesmo lugar
})
```

Regras:

1. **Eyebrow é o espaço.** Agenda, Atividades, OKRs, Projetos, Arquivos,
   Studio, Marca, Equipe, Treinamentos, Serviços, Seleção, Administração, e
   "Início" na tela inicial. Nunca slogan, trilha ou código.
2. **O h1 é o nome da tela,** e nunca repete o eyebrow. "Equipe / Organograma",
   não "Quem é quem / Equipe". Usa um tamanho só em todos os templates:
   `--fs-h2` (26 a 42px), Archivo 600, -.015em.
3. **Voltar tem um padrão só:** "← Quadro de pessoal", em Instrument Sans
   13,5px Névoa, acima do eyebrow, com área de toque de 44px. Se a tela
   anterior é do mesmo espaço, volta pelo histórico; se não é, vai para o
   pai. Com profundidade 3 ou mais, a trilha (Breadcrumb) substitui o voltar.
4. **Seções irmãs não têm voltar, têm SectionNav.** Feed, Presença e
   Organograma são seções de Equipe. Quem está nelas troca de seção pelo
   SectionNav, que fica sempre no mesmo lugar.
5. **O código do objeto** vai como Tag em Plex Mono na linha de meta
   (`ORT-14`, `NRO-PES-007-2`, `POST-14`), nunca dentro do eyebrow.
6. **No celular:** as ações recolhem num IconButton "Mais ações", menos a
   ação principal; o SectionNav rola na horizontal.

### 3.2 Os templates

Larguras pelos tokens: os templates L, O e P vão até `--max` (1240px), o F
até `--w-fluxo` e o E até `--w-leitura`. O T usa a tela inteira.

| | Template | Anatomia | Exemplos |
|---|---|---|---|
| **L** | Lista | cabeçalho, SectionNav, barra de ferramentas (busca; Segmented para um filtro só ou FilterBar para vários; total "24 resultados"), DataGrid ou grade de tiles | Quadro de pessoal, Arquivos, Projetos, Treinamentos, Meus pedidos, Cofre, Candidatos |
| **O** | Objeto | voltar ou trilha, cabeçalho com código e meta, SectionNav do objeto, duas colunas: principal e lateral de `--w-lateral` com SpecList (responsável, datas, estado, relações). No celular a lateral desce | Ficha do membro, projeto, arquivo, atividade, publicação, evento, candidato, relato |
| **F** | Fluxo | voltar, cabeçalho, **etapas** (Progress segmentado com rótulos, nunca SectionNav), coluna única, barra de ações fixa embaixo: estado do salvamento à esquerda, ação principal Synapse à direita | Reporte, novo evento, novo projeto, pedir serviço, relatar bug, importar |
| **P** | Painel | cabeçalho, grade de Widget e Metric, uma Band de destaque no máximo | Início, Presença, Painéis, Arquivos › Visão, Carga da equipe |
| **E** | Leitura | cabeçalho, SectionNav quando a tela pertence a um espaço, coluna de leitura; itens separados por linha a 8%, sem cartão dentro de cartão | Feed, Notas de versão, módulo de treinamento, README |
| **A** | Ajustes | cabeçalho, SectionNav (Configurações é uma seção), Tabs para as subáreas, linhas de ajuste (rótulo e dica à esquerda, controle à direita), salvar por grupo | Configurações de Agenda, Arquivos, Studio, Treinamentos, Marca, Cofre e Reporte |
| **T** | Área de trabalho | o mesmo cabeçalho em uma linha (eyebrow e h1 à esquerda, controles à direita, sem lead), conteúdo na largura toda | Quadro de Atividades, Agenda, Organograma, OKRs, Criador do Studio, editores |
| **X** | Avulsa | fora da casca: fundo expressivo, imagotipo, painel estreito | Login, auth (validação), rsvp, descadastrar, certificado conferido |

O Quiosque tem template próprio (seção 5).

### 3.3 Funções da casca

`cabecalho()`, `barraFerramentas({busca, filtros, total, acoes})`,
`layoutObjeto(principal, lateral)`, `layoutFluxo({etapas, atual, corpo,
acoes, salvo})`, `layoutLeitura(corpo)`, `linhaAjuste({rotulo, dica,
controle})` e `estado.carregando(forma)`, `estado.vazio({texto, acao})` e
`estado.erro({texto, acao})`. Cada template põe uma classe em `#main`
(`.tpl-l`, `.tpl-o`...), que define a largura. Nenhum módulo escreve
largura, margem de topo ou tamanho de título por conta própria.

### 3.4 Estados por template

- **Carregando:** skeleton com a forma do template (linhas da DataGrid no L,
  cabeçalho e lateral no O, cards no P), depois de 300 ms. O spinner fica só
  para o que não tem forma conhecida.
- **Vazio:** EmptyState de uma linha e uma ação ("Nenhuma atividade com esse
  filtro." e "Limpar filtros").
- **Erro:** Alert Critical que diz o que fazer, com a ação "Tentar de novo".
- **Sem permissão:** volta para o início (como hoje).

### 3.5 Catálogo de templates

A rota `#/dev/templates` (só admin, fora do menu) mostra cada template com
dados fictícios, em cada estado. `testes/templates.mjs` fotografa o catálogo
em 1440 e 390px, nos temas escuro e claro. Isso serve de referência para
quem refatora e de teste de regressão.

## 4. Refatoração tela a tela (SOMA)

Ordem: Equipe primeiro, porque concentra as reclamações e exercita cinco
templates. Para cada tela: trocar o topo por `cabecalho()`, aplicar o
template e passar o auditor nos arquivos tocados.

### 4.1 Equipe (piloto)

SectionNav de Equipe: Organograma, Quadro de pessoal (com permissão),
Presença, Feed, Reporte semanal (liderança). O mesmo em todas as seções.

| Rota | Template | Mudanças |
|---|---|---|
| `#/equipe` | T | h1 "Organograma"; o eyebrow "Quem é quem" sai |
| `#/equipe/quadro` | L | FilterBar (grupo, cargo, situação), DataGrid, exportar como ação ghost |
| `#/equipe/<registro>` | O | "← Quadro de pessoal" (ou Organograma, pelo histórico); registro como Tag; lateral com SpecList |
| `#/equipe/presenca` | P | Metric "no LABBIO agora", BarList por área, Placar em Lúmen (marcas discretas), ausências em DataGrid |
| `#/equipe/feed` | E | ganha eyebrow, h1 e SectionNav de Equipe; post como artigo (meta "autor, data" em Névoa, sem eyebrow por post); imagem com raio 18 e skeleton; "Ocultar" como IconButton com Dialog; "Carregar mais" ghost. `#/feed` vira alias de `#/equipe/feed` |
| `#/equipe/reporte` | L, F, A | seção 4.2 |
| `#/equipe/newsletter` | L e F | lista de edições e composição |

### 4.2 Reporte semanal: reconstrução

**Uma implementação só.** `pageApontamento()` (mod-gestao.js) sai, e
`#/equipe/apontamento` vira alias de verdade no `ALIAS`. Antes, conferir se
a tela antiga tem algo que o reporte não tem (ela tinha lead e `topoGestao`).

**Endereços novos:**
- `#/equipe/reporte`: o ciclo da semana
- `#/equipe/reporte/<frente>`: preencher ou consultar uma frente
- `#/equipe/reporte/<frente>/<etapa>`: a etapa
- `#/equipe/reporte/config`: o ciclo (admin)

**`#/equipe/reporte`, template L:**
- Faixa de Metric: semana, prazo (Pill Caution quando faltar menos de 24h),
  reunião, e "3 de 7 enviados" com ProportionBar.
- DataGrid das frentes: Frente, Responsável, Situação (Pendente em Caution,
  Rascunho em Idle, Enviado em Nominal, Encerrado em Idle, sempre com
  rótulo), Atualizado em (mono, à direita) e a ação "Preencher" ou
  "Consultar", só nas frentes da pessoa.
- Ações de admin no cabeçalho: "Baixar reporte unificado" (ghost, com ícone)
  e "Configurar ciclo" (leva ao template A).

**`#/equipe/reporte/<frente>`, template F,** com 4 etapas no Progress:
1. **Apontamentos:** uma linha por membro, sem cartão: avatar e nome,
   Assiduidade (Segmented "Suficiente | Insuficiente"), Entregas (idem),
   "Sinalizar ao Pessoal" (Switch). A justificativa só aparece, e só se torna
   obrigatória, quando há "Insuficiente" ou sinalização. O erro diz o que
   falta ("Informe a justificativa de Ana Silva.").
2. **Escalonamentos:** lista de tópicos com Markdown (`mdBarra`) e o campo
   "Atividade relacionada". Um código válido vira link com o título do
   cartão; um inválido mostra uma dica Critical. Remover é um IconButton ×,
   com toast "Tópico removido" e a ação "Desfazer".
3. **Publicações no feed:** título, subtítulo, texto (Markdown com "Ver") e
   imagem (área de soltar, prévia e Progress do envio). Ao lado fica a prévia
   **igual ao Feed**, usando a mesma função de render do template E.
4. **Revisão:** resumo somente leitura de tudo, com avisos ("2 membros
   sinalizados ao Pessoal"). Só aqui aparece "Enviar reporte" (Synapse), que
   abre um Dialog: "Depois de enviado, o reporte não pode ser editado."

- **Barra fixa:** à esquerda, "Salvo às 14:32" (salvamento automático com
  espera de 2s, além do "Salvar rascunho" ghost); à direita, "Etapa
  anterior" (ghost) e "Continuar" (Synapse, a ação principal da etapa).
- **Travado** (enviado ou prazo encerrado): Alert Signal no alto ("Enviado em
  10/10, 17:42") e os valores como texto, nunca como campos desativados.
- **Conflito de versão:** Alert com a ação "Recarregar o reporte".

**`#/equipe/reporte/config`, template A:** dia e hora do prazo, reunião, e o
vínculo das frentes (atalho para Administração › Grupos).

### 4.3 Marca: reconstrução

SectionNav: Modelos, Assinatura de e-mail, Configurações (só para quem gere
Arquivos). No menu, um subitem "Manual da marca ↗" (externo).

| Rota | Template | Conteúdo |
|---|---|---|
| `#/marca` | L | **Modelos controlados**: grade de tiles (miniatura, nome, Tag com o código da série, ex. `NRO-PUB-002`). Ação "Abrir em Arquivos" (Arquivos é o dono do download controlado) ou "Pedir acesso". "Criar no Studio" nas peças que o criador gera (crachá, cartão, certificado). Uma Band Cortex no fim: "Logos, cores e o kit de interface estão no manual público", com "Abrir o manual ↗" |
| `#/marca/assinatura` | F simples | Formulário à esquerda: os dados vêm da ficha, em leitura, com "Editar na ficha"; pronomes e telefone ficam locais. Prévia à direita sobre papel branco (e-mail é claro), com Segmented "Nova mensagem, Resposta". Ação principal "Copiar assinatura"; "Copiar HTML" como ícone utilitário. Instruções por cliente (Gmail, Outlook, Apple Mail) em Tabs recolhidas |
| `#/marca/config` | A | DataGrid: Item, Série vinculada (listbox), Situação; salvar |
| `#/marca/interfaces` | alias | Band apontando para `brand.neurodynamics.dev/interface` |

Saem do SOMA: a Galeria (vai para Downloads no brand), Interfaces (CSS,
componentes, página-base e prompts vão para brand › Interface) e o "README
para IA do Studio" (vai para Studio › Configurações › Recursos).

### 4.4 Demais espaços

| Espaço | Rotas e templates | Atenção |
|---|---|---|
| Início | `#/` P | eyebrow "Início"; avisos e pendências como Widget; a semana; Placar em Lúmen; uma Band no máximo |
| Agenda | dia, semana e mês T; `evento/<id>` O; `novo` F; `config` A | o título da agenda (`agTitulo`) vai na linha de controles do T; o h1 continua "Agenda" |
| Atividades | quadro T; `arquivadas` L; `card/<código>` O; carga P | o eyebrow "Trabalho" sai; o cartão do quadro mantém o relevo funcional (PADROES §5, exceção registrada) |
| OKRs | `#/okrs[/código]` T com lateral de objeto | o eyebrow "Planejamento estratégico" sai |
| Projetos | lista L (tiles); `novo` F; `<CÓDIGO>` O; `<CÓDIGO>/arquivos` L dentro do objeto | o h1 não repete "Projetos" no eyebrow |
| Arquivos | `#/arquivos` e `<EMISSOR>` L; `visao` P; `revisoes`, `templates` L; `config` A; `<código>` O; `<código>/escrever` T | eyebrow "Arquivos" (sem "›") |
| Studio | quadro e calendário T; `ideias`, `modelos` L; `criar` e `POST-14/arte` T; `POST-14` O; `config` A | `mod-criador.js` tem 163 hex: separar as cores **das peças** (legítimas, são arte) das cores **da interface** (vão para tokens) |
| Treinamentos | "Para você", `todos`, `certificados` L; `NRO-TRE-003` O; `/<n>` E com a verificação no fim; `editar` T; `acompanhamento` P; `novo` F; `config` A; certificado X | o `.tre-voltar` sai |
| Serviços | `#/servicos` L (catálogo em tiles); `/<tipo>`, `declaracao` F; `pedidos` L; eventos L, O, F e A; cofre L, O, P, F e A | eyebrow "Serviços" (sem "› Cofre") |
| Seleção | abas L; `candidatos/<id>` O; `dinamica/<sub>` com Tabs | o eyebrow "Comitê de Seleção" sai |
| Administração | `#/admin` P; abas L e A; `grupos/<prefixo>` T com lateral; e-mails L e F | |
| Versões | `#/versoes` E; `comentarios` L; `bug`, `sugestao` F; `<n>` O | |
| Fora da casca | login, `auth/`, `rsvp.html`, `descadastrar.html` X; `tour.html` X | `tour.html` (136 hex, 34 pílulas) passa pelo auditor por inteiro |

## 5. Quiosque

Template próprio, em `quiosque.html`, consumindo `ds/`. Desenhado em
1440×900 e escalado para 1920×1080 (a TV); conferir nas duas medidas.

- **Composição:** `?layout=a` (padrão) ou `?layout=b`, com a mesma coluna
  de check-in de 420px à direita. Em A: Agora (relógio, clima e sol) e um
  widget giratório à esquerda; a agenda giratória no centro. Em B: uma faixa
  com hora, clima e sol, e um palco grande que gira agenda, próximo evento,
  aviso e placar.
- **Fundo:** Void, grade Cortex de 44px a 5% e blob Axon fixo. O segundo
  blob e o arco do sol mudam com a fase do dia (madrugada Lúmen, dia Synapse
  a 5%, entardecer Ritmo, noite Retina), com transição de 2s. `?fase=` força
  uma fase para teste.
- **Widgets:** de 10 a 15s por slide, no máximo 4 slides, progresso
  segmentado Synapse. Um slide sem conteúdo é pulado. Relógio, QR, contagem
  e últimos check-ins nunca giram. Avisos em faixa Retina, boas-vindas em
  Neuron, placar e sequências em Lúmen; uma família por slide.
- **Momento do check-in:** a sobreposição atual vira "Chegada registrada",
  com brilho do conjunto primário (Axon e Cortex), nome, área e a sequência
  em quadrados Lúmen. É celebratório e nunca usa Synapse.
- **Estado:** "Ao vivo" em Pill Signal; offline em Idle, com o QR escondido
  e a mensagem atual.
- **Dados:** estender a RPC `quiosque_estado` (security definer, só campos
  públicos: primeiro nome, área, horários) com o placar do mês, as
  sequências, a ocupação por área, os avisos ativos, os novos membros do mês
  e o próximo evento. **Conferir a RLS antes:** o quiosque roda sem sessão
  de membro.
- **Movimento:** com `prefers-reduced-motion`, nada gira sozinho
  (fica o primeiro slide) e o fundo não transiciona.

## 6. brand: o manual, do zero

### 6.1 Arquitetura de informação por público

A página inicial pergunta **o que a pessoa veio fazer**, não quem ela é:

| Porta | Público | Destino |
|---|---|---|
| "Vou citar ou divulgar a NeuroDynamics" | parceiros, imprensa, eventos | `/imprensa` |
| "Vou produzir uma peça" | equipe, fornecedores gráficos | `/aplicacoes` |
| "Vou construir um site ou sistema" | terceiros contratados, desenvolvedores | `/interface` |
| "Quero entender a marca" | todos | `/fundamentos` |

Abaixo das portas ficam os downloads rápidos (pacote do imagotipo, kit de
imprensa, tokens CSS), a versão e data do manual e quem aprova peças novas.

**Mapa do site:**
- `/fundamentos`: `marca` (quem somos, tom, os nomes neurais),
  `assinaturas` (imagotipo, ícone quadrado, símbolo, onda, selo; área de
  proteção e tamanho mínimo marcados como pendentes), `cor` (os quatro
  conjuntos, swatches gerados dos tokens, contraste, regras), `tipografia`
  (os dois modos; o executivo só como espécime em papel), `elementos` (fundo
  expressivo, banda, raios, espaço, imagem), `redacao`.
- `/aplicacoes`: catálogo com FilterBar (Domínio: Documentos, Digital,
  Ambientes; Modo: Operacional, Executivo; Família) e uma ficha por peça em
  `/aplicacoes/<peca>` (quando usar, regras específicas, Assim e Evite,
  arquivos). Cobre os 15 templates do pacote.
- `/interface`: Começar (o pacote `ds/`, o `<link>`, a página-base), Regras
  (o `interface-rules.md` em página, com o checklist), Componentes (prévia
  viva de cada um, estados, Assim e Evite, HTML para copiar), **Padrões de
  página** (os templates L a X e os de site da seção 6.2), Widgets e
  quiosque, e Prompts para LLMs (vindos do SOMA).
- `/imprensa`: textos institucionais em três tamanhos (curto, médio, longo)
  em português, inglês e francês, com botão de copiar; grafia correta do
  nome; logos para fundo claro e escuro; regras de assinatura conjunta com
  parceiros (posição, divisor, área de proteção, ordem); contato.
- `/downloads`: catálogo único com FilterBar (Tipo, Formato, Família) e
  busca, gerado de `downloads/index.json`, que passa a ser a fonte de tudo o
  que se baixa.
- `/404`.

**Endereços antigos** (`/marca`, `/cores`, `/tipografia`, `/escrita`,
`/elementos`, `/aplicacoes`, `/galeria`) redirecionam para os novos.

### 6.2 Templates de site (brand, website e selecao)

| | Template | Anatomia |
|---|---|---|
| **S1** | Capa | SiteHeader de vidro, hero curto (no máximo 56vh) com eyebrow Archivo (nunca mono), display e lead; depois seções |
| **S2** | Capítulo | coluna de `--w-leitura`; índice "Nesta página" fixo à esquerda a partir de 1100px; figuras podem ir até 1240px; "Próximo capítulo" no fim |
| **S3** | Catálogo | cabeçalho, FilterBar, total e grade de tiles; vazio com "Limpar filtros" |
| **S4** | Ficha de peça | prévia grande e lateral com SpecList (formato, modo, família, arquivos) e os downloads |
| **S5** | Formulário público | etapas, coluna única, um CTA (inscrição, contato) |

Blocos próprios do manual: Swatch (tom, hex, RGB, e CMYK e Pantone como
pendentes), Espécime tipográfico, par **Assim** e **Evite** (✓ Nominal e ×
Critical, sempre com texto), Bloco de cópia e Bloco de download.

### 6.3 Como é feito

- HTML estático gerado no commit por `scripts/montar.mjs` (estende o
  `carimbar.mjs`), a partir de `conteudo/*.json`, dos tokens e do
  `downloads/index.json`. As páginas continuam legíveis sem JavaScript, e
  nenhum hex fica escrito à mão no HTML.
- O manual usa `ds/neuro.css`, como os outros consumidores. Se uma peça do
  manual não sai dos componentes, falta componente na Fase 0.
- Saem: as capas de 72vh, o rótulo mono "MANUAL DA MARCA / 0X" e o Synapse
  em "Área da equipe" (vira um link ghost com ↗).
- Pendências do dono da marca continuam visíveis como pendências: CMYK e
  Pantone, tamanho mínimo, área de proteção, fluxo de aprovação e conjunto
  de ícones.

## 7. website e selecao: refatoração completa

**website** (três idiomas):
- Tokens antigos trocados pelos do DS (`--green` vira `--axon`, `--syn` vira
  `--synapse`, `--deep` vira `--cortex`, `--panel` vira `--painel`; `--teal`
  só se for família Ion, com uma família por superfície).
- SiteHeader e MobileSiteMenu do DS, com o idioma só no menu aberto.
- Home em S1; Quem somos e Contato em S2 e S5; Projetos em S3 e S4.
- Pontos médios e travessões separadores saem dos três idiomas.
- `admin.html` vira um app pequeno: X para entrar, L e F para os projetos.

**selecao:**
- `index.html`: S1 a S5, como o website. A inscrição em S5, o
  acompanhamento em S4 (protocolo como Tag mono).
- `dinamica.html` (o candidato, no celular): X e F, mobile primeiro, toque
  de 44px.
- `dinamica-avaliador.html` (o comitê, no tablet): T, com DataGrid e
  Segmented para as notas.
- `dinamica-painel.html` (projetado): o registro do quiosque, com widgets e
  fundo expressivo.
- `cartazes.html` e `redes.html`: **regras de documento**. Modo operacional,
  uma família por peça, sem pontos médios (66 e 34 hoje), templates
  `posters` e `social` do pacote como referência.

## 8. Fases e entregas

| Fase | Repositório | Entrega | Depende de |
|---|---|---|---|
| 0 | brand | tokens, `v3/`, neuro.css v3, `distribuir.mjs`, `auditar.mjs` | n/a |
| 1 | membro | `ds/`, CSS da casca dividido em `ds/` e `soma.css`, `cabecalho()` e templates, estados, `#/dev/templates` | 0 |
| 2 | membro | Equipe inteira, Reporte reconstruído, Marca reconstruída | 1 |
| 3 | membro | Quiosque (A e B), RPC estendida | 0 |
| 4 | membro | demais espaços, um PR por espaço, na ordem da tabela 4.4 | 1 |
| 5 | brand | manual do zero (6.1 a 6.3) | 0 |
| 6 | website, selecao | seção 7 | 0 e templates de site da 5 |
| 7 | todos | aliases obsoletos removidos (`--soma`, `.aviso-box`, `.empty`...), auditor zerado nos quatro repositórios | 2 a 6 |

As fases 3 e 5 podem correr em paralelo às 2 e 4.

**Pronto, em toda fase:**
- `auditar.mjs` zerado nos arquivos tocados;
- capturas em 1440 e 390px, nos temas escuro e claro, comparadas com o card
  do DS;
- `testes/` existentes passando;
- nenhum hex, raio ou fonte literal novo fora de `tokens.css`;
- sem erro no console;
- o PADROES.md atualizado onde a regra mudou (§1 seletores: o `.seg` deixa
  de ser Synapse; §8 layout: os templates).

## 9. Como gastar poucos tokens executando isto

- **Fases 0 e 1 com o modelo mais forte.** São as que decidem. Da Fase 2 em
  diante, o trabalho é aplicar template a tela, e um modelo mais barato dá
  conta, **desde que** o prompt aponte o template, a linha da tabela 4.x e o
  auditor. A tentativa anterior falhou por falta dessa cerca, não por falta
  de capacidade do modelo.
- **Uma sessão por fase ou por espaço**, com um prompt curto: "Leia
  PLANO-DESIGN-SYSTEM.md §4.2 e interface-rules.md. Refatore o Reporte
  conforme a seção. Rode `auditar.mjs` e `testes/templates.mjs`."
- **Não ler o `index.html` inteiro.** A casca tem 475 KB; procure as funções
  pelo nome (`grep -n "function cabecalho"`).
- **O catálogo `#/dev/templates`** é o que evita reabrir os cards do DS a
  cada tela.

## 10. Pendências e pontos a conferir na execução

- A RLS de `quiosque_estado` para os dados novos (seção 5).
- O que a `pageApontamento()` tem que o Reporte não tem, antes de removê-la.
- O conteúdo do `tour.html` (188 KB): o tour continua a existir depois do
  redesenho, ou é refeito sobre os templates?
- A ordem do bloco de baixo do menu lateral contra o card (Avisos, linha de
  ícones, perfil por último) e a "casinha" do início (PADROES §1) contra a
  regra de não duplicar marca.
- Pendências da marca, com o dono: CMYK e Pantone, tamanho mínimo, área de
  proteção, aprovação e ícones (Lucide 1,5px segue como substituição
  declarada).
