# Plano de unificação — SOMA · Gestão + Portal do Membro

Trazer tudo o que hoje mora em `pessoal.neurodynamics.dev` (repositório
`nro-pessoal`) para `membro.neurodynamics.dev` (este repositório), que depois
passa a se chamar `soma.neurodynamics.dev`. Um endereço, um login, uma
navegação, o layout da marca.

As decisões estão na seção 2; quem quiser só a ordem das coisas, pule para a 7.

## Estado

| Fase | Situação |
|---|---|
| **0 · Preparo** | **Feita.** Casca com módulos sob demanda, papéis, componentes de tela de trabalho no design system, `db/` renumerado com registro de migrações, cópia velha do site apagada |
| **1 · Quadro** | **Feita.** Login com os cinco modos; `#/quadro`, `#/quadro/<registro>` e `#/auditoria` em `mod-gestao.js`; organograma com "abrir ficha" |
| **Reorganização** | **Feita.** Navegação por espaços, busca global (`/` ou `Ctrl/⌘ K`), notificações no sino |
| **Atividades** | **Feita.** Quadro por grupo, cartões com código, comentários com menção, sinalização, carga da equipe — pedido fora do plano original |
| **4 · Painéis** | **Feita.** Os dois `admin.html` (portal e site) viraram `#/admin` — hoje uma galeria de onze painéis |
| **Agenda (revisão)** | **Feita.** Tudo editável depois de criado; marcos e ausências saem do back-end; nenhum tipo força recorrência |
| **2 · Operações** | **Feita.** Apontamento em Equipe; relatórios, importação, contas e catálogo viram painéis de Administração, agora em galeria |
| **3 · Eventos** | **Feita.** O dossiê vira a profundidade de um item da agenda (`#/agenda/evento/<id>`), com checklist, presenças e ata |
| **5 · Corte** | **Feita.** `nro-pessoal` vira encaminhamento e acervo; o app antigo fica em `soma-legado.html` como rede de segurança; `brand`, `selecao` e o tour apontam para o portal |
| **Pessoal no quadro** | **Feita.** Solicitação, apontamento e ocorrência viram cartão no quadro do Depto de Pessoal; o cartão de origem decide e concede o acesso na mesma transação; o quadro do Pessoal fecha (`reservado`) |
| **Notificação por e-mail** | **Feita.** Edge Function `notificar-email` com SMTP por variável de ambiente, três modos por pessoa (a cada aviso / resumo diário / só no portal), agendamento documentado |
| **Quadro e acesso** | **Feita.** Cinco colunas que cabem na janela (sem rolagem horizontal), grupos num seletor em vez de abas, cartão com relevo e brilho de prioridade, e nível de acesso por pessoa em cada quadro |
| 6 · Renomeação | **preparada.** O UID do iCal já está separado do endereço (era a armadilha 1.5.2); falta o DNS, o `CNAME`, as Redirect URLs do Supabase, trocar `SITE` na Edge Function do iCal e `PORTAL_URL` na do e-mail |

Três defeitos que só a execução mostrou, e que valem registro porque a
mesma armadilha volta:

- **a view era o furo, não a política.** `atividades_quadro` era uma view
  comum, e view comum roda como dona e ignora RLS. Enquanto todo cartão era
  público não fazia diferença; no dia em que o quadro do Pessoal passou a
  guardar pedido de afastamento, fazia toda. Fechar um quadro é fechar a
  política **e** pôr `security_invoker = true` na view.
- **rodar a migração de novo reabria o quadro.** O quadro reservado nasceu na
  16.0 enquanto a política de leitura continuava sendo escrita também pela
  15.0 — e a 15.0 diz, com razão, que pode rodar de novo. Rodar devolvia
  "todo mundo lê", sem erro nenhum. Mudou de dona: a trava inteira está na
  15.0, a 16.0 só diz em qual grupo ela fecha.
- **módulo dependendo de módulo.** `mod-relatorios` usava `STATUS_LIST`, que
  era de `mod-gestao`. Quem ia direto para Relatórios sem passar pelo quadro
  encontrava "STATUS_LIST is not defined" no lugar do formulário. Foi para a
  casca, junto com `falha()`; `testes/colisoes.mjs` passa a vigiar a família
  inteira desse defeito.

Duas correções que a execução trouxe ao que estava escrito aqui:

- **os componentes não faltavam no design system — faltavam na folha.**
  Abas, métricas, barras, carregamento, estado vazio e diálogo já eram da
  marca, mas viviam só dentro dos previews; o `neuro.css`, que é o que os
  apps consomem, não os tinha. Foram promovidos. Genuinamente novos eram
  três: tabela de trabalho, barra de filtros e galeria de tiles. Tudo isso
  virou o card 15, *Telas de trabalho*;
- **o `gerarRelatorioMembro()` da ficha ficou para a Fase 2**, junto com o
  resto dos relatórios — ele depende do jsPDF, que é carregado sob demanda
  pelo `mod-relatorios.js`.

---

## 1. Onde estamos hoje

### 1.1 O que já é comum (e por isso a unificação é barata)

As duas plataformas **já compartilham o mesmo banco**: o projeto Supabase
`rxzmkyjttzzpwtodqkve`, com as mesmas tabelas (`perfis`, `membros`, `eventos`,
`avaliacoes`, `apontamento_itens`, `auditoria`, …) e o mesmo Supabase Auth.
O README do portal já diz isso em uma linha — "mesmo login do SOMA" — mas vale
soletrar a consequência:

> **Não existe migração de dados neste projeto.** Nenhuma linha muda de tabela,
> nenhuma conta é recriada, nenhum usuário perde histórico. O que precisa ser
> unificado é a **interface** e a **arquitetura de informação**.

Isso muda a natureza do trabalho: não é um port, é uma fusão de front-end.
O risco fica concentrado em layout, permissões de tela e endereços — não em
integridade de dados.

### 1.2 As duas plataformas, lado a lado

|  | `pessoal.neurodynamics.dev` (`nro-pessoal`) | `membro.neurodynamics.dev` (este repo) |
|---|---|---|
| Nome | SOMA · Gestão | Portal do Membro |
| Público | `admin`, `pessoal`, `selecao`, `leitura` | qualquer conta do SOMA |
| Casca | barra lateral, **tema claro** (`--bg:#F5F5F7`) | cabeçalho flutuante de vidro, **tema escuro da marca** |
| Navegação | 10 destinos via `showView()`, **sem URL** | 6 rotas por hash (`#/agenda`, `#/servicos`, …) |
| Tamanho | 5 225 linhas / 328 KB | 3 545 linhas / 197 KB |
| Bibliotecas | supabase + **xlsx + jsPDF + autotable** (todas no `<head>`) | supabase apenas |
| Anexos | `quiosque.html`, `app.html`, `mailer/`, `fotos/`, `site/` | `admin.html`, `tour.html`, 2 Edge Functions |

### 1.3 O que está duplicado

| Recurso | No SOMA | No Portal | Resolução |
|---|---|---|---|
| **Organograma** | `renderOrganizacao()` (`index.html:1425`) | `pageOrganizacao()` (`index.html:3039`) | uma implementação só; abrir a ficha fica atrás do papel |
| **Calendário / agenda** | `renderCalendario()` lê `eventos` e `calendario_itens` direto | `agenda_itens` já une eventos + marcos + ausências (SOMA 13.0) | fica a do portal; a do SOMA é apagada |
| **Evento** | `renderEventos()` / `renderEvento()` — dossiê com checklist e ata | criação, RSVP, convidados, recorrência | um objeto só, em duas profundidades: lista na Agenda, dossiê em `#/agenda/evento/:id` |
| **Acessos** | catálogo (`view-acessos`) + concessão na ficha | *solicitação* de acesso (`#/servicos/acesso`) | o ciclo pedir → triar → conceder passa a ser um fluxo só |
| **Login** | tela própria, com **cadastro e recuperação de senha** | tela própria, **só entrada** | uma tela, com os cinco modos do SOMA |
| **Painel administrativo** | `view-pessoal` (sinalizações, avaliações) | `admin.html` (avisos, documentos, triagem, ouvidoria, agendas) | um painel só, em abas |

### 1.4 O que está fora do padrão da marca

O `brand/design-system/tokens.css` é escuro por definição (`--bg: var(--void)`,
`#050807`). O Portal do Membro já segue isso à risca. **O SOMA · Gestão não**:
o tema da marca aparece só na tela de login (`index.html:33`); assim que a
sessão abre, o app vira claro — `--bg:#F5F5F7`, `--panel:#FFFFFF`,
`--ink:#1D1D1F`, `--r:12px`, sombras em vez de bordas.

Então "o layout deve seguir o brand" quer dizer, concretamente: **a casca é a
do portal e os módulos do SOMA são re-vestidos**, não o contrário. A seção 5
traz o mapa de conversão.

### 1.5 Cinco armadilhas encontradas na leitura

Estas não aparecem em nenhum README e cada uma quebra algo de verdade:

1. **Colisão de numeração das migrações.** Existem `soma_v10.sql`,
   `soma_v11.sql`, `soma_v12.sql` e `soma_v13.sql` **nos dois repositórios,
   com conteúdos completamente diferentes**, todos se apresentando como
   "SOMA 10.0/11.0/12.0/13.0" e todos aplicados no mesmo banco. Hoje ninguém
   sabe, olhando um arquivo, se ele já foi rodado. Resolver isso é pré-requisito
   da fusão (seção 6).

2. **O UID do iCal está preso ao domínio.**
   `supabase/functions/agenda-ics/index.ts:28` define
   `DOMINIO = "membro.neurodynamics.dev"` e a linha 120 monta o identificador
   de cada evento como `${origem}-${ref}@${DOMINIO}`. Se esse valor mudar na
   renomeação, **todo evento já sincronizado vira um evento novo** na agenda de
   quem assinou o feed — duplicata em cima de duplicata. O domínio do UID é um
   namespace opaco, não um endereço: ele fica **congelado** em
   `membro.neurodynamics.dev` para sempre. Só a linha 147 (o link na descrição)
   acompanha a renomeação.

3. **Cadastro e recuperação de senha só existem no SOMA.**
   `nro-pessoal/index.html:796` e `:817` são os únicos pontos do ecossistema que
   chamam `signUp` e `resetPasswordForEmail`. O portal nunca teve essas telas —
   ele depende do SOMA para isso. Desligar `pessoal.neurodynamics.dev` sem
   trazer os cinco modos da tela de login deixa a equipe sem como criar conta
   nem recuperar senha.

4. **O SOMA carrega 3 bibliotecas pesadas para todo mundo, em todo login.**
   `nro-pessoal/index.html:538-540` traz xlsx, jsPDF e autotable no `<head>`,
   antes de saber quem entrou. No app unificado isso passaria a pesar no
   celular de **todos os membros**, para um recurso que só a Diretoria e o
   Depto. de Pessoal usam. A fusão é a hora de corrigir.

5. **`nro-pessoal/site/` é uma cópia velha do repositório `website`.**
   81 KB contra 105 KB do original, defasada de pelo menos uma versão do site
   institucional. É peso morto e fonte de confusão sobre qual é o site de
   verdade. Some na virada.

---

## 2. Decisões

### D1 — O destino é este repositório

`membro` recebe tudo; `nro-pessoal` vira repositório de redirecionamento.

*Por quê:* este repositório já tem (a) a casca correta da marca, (b) o motor
de agenda mais novo — `agenda_itens`, recorrência de verdade, visibilidade por
evento (SOMA 13.0) —, (c) as duas Edge Functions e (d) o roteamento por hash,
que o SOMA não tem. Trazer o portal para dentro do SOMA significaria refazer
os quatro.

### D2 — Uma casca, módulos carregados sob demanda. Sem build.

`index.html` continua sendo a página, com a casca (tokens, cabeçalho, menu,
login, roteador, ícones, modal, toast) e o **plano do membro** dentro. Os
módulos pesados saem para arquivos `.js` irmãos, injetados por `<script>`
quando a rota é aberta pela primeira vez:

```
index.html        casca + Início, Agenda, Organização, OKRs, Informações, Serviços, Pedidos
mod-gestao.js     Quadro, ficha, Operações, Apontamento, Importar, Contas, Auditoria
mod-pessoal.js    Painel do Depto. de Pessoal (funde o admin.html de hoje)
mod-relatorios.js Relatórios + Full mailer  (puxa jsPDF sob demanda)
mod-selecao.js    Processo seletivo
```

*Por quê não um arquivo único:* a soma dos dois `index.html` dá ~8 800 linhas
e meio megabyte, e obrigaria cada membro a baixar toda a superfície
administrativa. A convenção de "arquivo único" da equipe serve bem a um app
com um propósito; a união de cinco não é o mesmo animal. O que realmente
importa da convenção — **estático, sem build, servido pelo GitHub Pages** —
continua valendo integralmente.

*Por quê `<script>` injetado e não `import()` dinâmico:* o código atual usa
`onclick="fn()"` em quase todo lugar, e isso depende de escopo global. Módulos
ES têm escopo próprio e quebrariam cada um desses handlers. Um `<script>`
clássico injetado preserva o estilo do código como está hoje — a migração de
cada módulo vira recortar e colar, não reescrever.

*Consequência boa:* xlsx e jsPDF passam a ser carregados pelo módulo que
precisa deles, resolvendo a armadilha 1.5.4.

### D3 — A marca é a fonte do layout, e o design system cresce para caber

Nada de "aproximar do visual". O app unificado consome os tokens de
`brand/design-system/tokens.css` e as classes de `neuro.css`. Onde o design
system ainda não tem o componente que a gestão precisa (tabela densa, galeria
de tiles, barra de filtros, abas de página, cartão de indicador), **o
componente é promovido para o design system primeiro** e consumido depois
(seção 5.2). Assim a próxima interface interna já nasce certa, em vez de
copiar CSS de um app para o outro mais uma vez.

### D4 — Uma navegação só, com três planos por papel

Não existe "o portal" e "a gestão" como lugares diferentes. Existe um app, e o
que você vê depende do seu papel — exatamente como o `NAV` do SOMA já faz
(`index.html:837-848`), só que agora cobrindo as duas superfícies.

### D5 — Numeração de migração passa a ser única e registrada no banco

Uma linha só, continuando em `v14`, com uma tabela `migracoes` que responde
"o que já foi aplicado?" sem depender de memória (seção 6).

### D6 — A renomeação é a última fase, não a primeira

Mover o conteúdo e trocar o endereço são dois projetos. Feitos juntos, qualquer
defeito fica ambíguo — foi a fusão ou foi o DNS? A ordem é: unificar em
`membro.`, estabilizar, **depois** renomear para `soma.` (seção 8).

---

## 3. A arquitetura proposta

### 3.1 Rotas

Uma tabela de rotas só, no roteador que já existe (`index.html:997`):

| Rota | Tela | Quem vê |
|---|---|---|
| `#/` | Início — avisos, resumo da agenda, quem está no LABBIO, trilho de ferramentas | todos |
| `#/agenda` `…/mes` `…/agendar` `…/presenca` `…/minha` | Agenda (as 5 abas de hoje) | todos |
| `#/agenda/evento/:id` | **novo** — dossiê do evento (checklist, ata, convidados) | organizador, convidados, `admin`/`pessoal` |
| `#/organizacao` | organograma único | todos |
| `#/okrs` | planejamento estratégico | todos (edição: `admin`/`pessoal`) |
| `#/informacoes` | biblioteca de documentos | todos |
| `#/servicos[/…]` | solicitações ao Depto. de Pessoal | conta vinculada a membro ativo |
| `#/pedidos` | acompanhamento das solicitações | todos |
| `#/quadro` | lista de membros | `podeQuadro()` |
| `#/quadro/:registro` | ficha (Dados, Ocorrências, Acessos, Avaliações, Dados pessoais) | `podeQuadro()` |
| `#/operacoes[/apontamento\|importar\|acessos]` | operações | conforme hoje |
| `#/relatorios` | relatórios e mailer | todos (portaria/assinatura: `can()`) |
| `#/pessoal` | painel do Depto. de Pessoal (funde o `admin.html`) | `admin`, `pessoal` |
| `#/auditoria` | trilha de auditoria | `admin`, `pessoal` |
| `#/selecao[/…]` | processo seletivo | `selecao`, `admin` |

**Ganho colateral:** o SOMA hoje não tem URL nenhuma — não dá para mandar
"olha a ficha da fulana" por mensagem. Depois da fusão, tudo é endereçável.

### 3.2 Navegação

O cabeçalho flutuante da marca não aguenta 15 destinos. A proposta mantém o
cabeçalho como identidade e âncora do plano atual, e usa as **abas de página**
(o componente `.abas` que a Agenda já usa) para a profundidade:

```
cabeçalho:   [marca]  Início · Agenda · Organização · Informações · Serviços   [Gestão ▾] [eu]
"Gestão ▾":  Quadro · Operações · Relatórios · OKRs · Painel do Pessoal · Auditoria · Seleção
```

Quem não tem papel de gestão simplesmente não vê o grupo — mesma mecânica do
`navPermite()` de hoje. No celular, o menu de tela cheia que já existe recebe
o segundo grupo abaixo do primeiro.

### 3.3 Papéis (sem mudança no banco)

| Papel | Plano do membro | Plano da gestão | Seleção |
|---|---|---|---|
| (qualquer conta) | ✔ | — | — |
| `leitura` | ✔ | organograma e fichas pelo organograma | — |
| `selecao` | ✔ | — | ✔ |
| `pessoal` | ✔ | ✔ | — |
| `admin` | ✔ | ✔ | ✔ |

---

## 4. Inventário da migração

Módulo a módulo, o que vem de `nro-pessoal/index.html`:

| # | Módulo (origem) | Linhas | Destino | O que muda além do tema |
|---|---|---|---|---|
| 1 | Login / cadastro / recuperação (`:33`, `:748-834`) | ~200 | `index.html` | absorve os 5 modos; o portal ganha cadastro e recuperação |
| 2 | Visão geral (`:913`) | ~60 | `mod-gestao.js` | vira o topo do `#/quadro` |
| 3 | Membros + ficha (`:997-1489`) | ~490 | `mod-gestao.js` | ficha ganha URL própria |
| 4 | Organização (`:1425`) | ~230 | **descartado** — fica a do portal | a do portal ganha o botão "abrir ficha" |
| 5 | PDF · modelo NRO (`:1490-1655`) | ~165 | `mod-relatorios.js` | jsPDF sob demanda; superfície clara mantida |
| 6 | Relatórios (`:1656-2211`) | ~555 | `mod-relatorios.js` | — |
| 7 | Operações + contas (`:2212-2320`) | ~110 | `mod-gestao.js` | — |
| 8 | Calendário (`:2321-2447`) | ~125 | **descartado** — funde na Agenda → Mês | "Novo marco" vira ação dentro da Agenda |
| 9 | Apontamento semanal (`:2448-2566`) | ~120 | `mod-gestao.js` | — |
| 10 | Eventos + dossiê (`:2567-2845`) | ~280 | `index.html` (Agenda) | vira `#/agenda/evento/:id`; criação/RSVP já são do portal |
| 11 | Painel do Pessoal (`:2846-2938`) | ~95 | `mod-pessoal.js` | funde com o `admin.html` |
| 12 | Catálogo de acessos (`:2939-2983`) | ~45 | `mod-gestao.js` | conecta com a solicitação do portal |
| 13 | Auditoria (`:2984-3034`) | ~50 | `mod-gestao.js` | — |
| 14 | Importar planilha (`:3035-3252`) | ~220 | `mod-gestao.js` | xlsx sob demanda |
| 15 | Processo seletivo (`:3253-4871`) | ~1 620 | `mod-selecao.js` | — |
| 16 | OKRs (`:4872-5225`) | ~355 | `index.html` | visível a todos, como já é |

E os arquivos soltos:

| Arquivo | Destino |
|---|---|
| `quiosque.html` | vem para cá como está (já aponta para o portal) |
| `app.html` | fica em `nro-pessoal` como stub de redirecionamento |
| `mailer/` (ícones e logos recoloridos) | vem para cá — o Full mailer depende deles |
| `fotos/` | vem para cá se ainda é usado pelas fichas; conferir antes |
| `site/` | **apagado** — cópia defasada do repositório `website` |
| `soma_v6..v13.sql` | para `db/aplicadas/`, renomeados (seção 6) |
| `admin.html` (deste repo) | fundido em `#/pessoal`, o arquivo deixa de existir |
| `tour.html` | fica, com os endereços atualizados |

**Total inventariado:** ~4 720 linhas. Dessas, ~355 são **descartadas** por
duplicação (itens 4 e 8) e ~1 620 são o módulo de seleção, que migra
praticamente sem alteração por já ser autocontido — sobram ~2 745 linhas de
trabalho de verdade, quase todo ele re-vestimento.

---

## 5. Conformidade com a marca

### 5.1 Mapa de conversão (claro → escuro)

A tradução não é mecânica em dois pontos, marcados com ⚠:

| SOMA hoje | No app unificado | Token da marca |
|---|---|---|
| `--bg:#F5F5F7` | `#050807` | `--void` |
| `--panel:#FFFFFF` | `#0B1210` (painel) ou `rgba(255,255,255,.03)` (cartão) | `--painel` / `--card` |
| `--ink:#1D1D1F` | `#F5F5F7` | `--ink` |
| `--muted:#6E6E73` | `#9AA5A1` | `--nevoa` |
| `--soft:#F0F0F2` | `rgba(255,255,255,.04)` | — |
| `--line:#E8E8ED` / `--line2:#D2D2D7` | translúcidos sobre o escuro | `--line` / `--line2` |
| ⚠ `--green:#00594F` em texto, link e botão | **`--synapse` (`#CEDC00`)** para ação, foco e seleção | `--synapse` |
| `--ok:#1F8A5B` | `#4ADE97` | `--vital` |
| `--bad:#C0392B` | `#F1806F` | `--pulso` |
| `--warn:#B7791F` | `#F5C36A` | `--mielina` |
| `--info:#4C6FBF` | `#7FA7F2` | `--plasma` |
| `--r:12px` | `18px` (cartão) / `11px` (botão e campo) | `--r` / `--r-sm` |
| ⚠ `--sh:0 1px 2px rgba(0,0,0,.05)` | **sem sombra** — a elevação vem de borda + vidro | `--line2`, `--glass` |

⚠ **O verde não atravessa.** `#00594F` sobre `#050807` tem contraste
insuficiente para texto. Na marca, o verde é estrutura (banda, gradiente,
fundo) e o **Synapse é o disparo** — ação, foco, seleção, em dose pequena.
Portar os links verdes do SOMA como estão é o erro mais provável desta fusão.

⚠ **Sombra não existe no escuro.** Onde o SOMA usa `--sh` para destacar cartão,
o equivalente da marca é `1px` de borda (`--line`) mais `backdrop-filter`.

### 5.2 O que faltava no design system *(feito)*

A leitura do `brand/` mostrou que o problema não era o que a marca não tinha,
e sim onde estava: **abas, métricas, barras, carregamento, estado vazio e
diálogo já eram do design system, mas só existiam dentro dos previews.** O
`neuro.css` — a folha que os apps consomem — não os tinha, e foi por isso que
cada app acabou copiando CSS do outro. Esses foram promovidos, sem mudar de
desenho.

Genuinamente novos eram três:

| Componente | De onde vem | Por que precisa existir no design system |
|---|---|---|
| **Tabela de trabalho** | `.tb`, `.tb-fixa` do SOMA | a `.tabela` é de leitura; esta é de trabalho — cabeçalho fixo, linha clicável, corte em reticências, registro em mono |
| **Barra de filtros** | `.filters` (Membros, Auditoria) | busca que cresce + recortes em select, empilhando no celular |
| **Galeria de tiles** | `.gal` / `.tile` (Relatórios, Operações) | o "escolha uma ferramenta" que aparece em três telas |

Os três saíram no card 15, *Telas de trabalho*, que fecha com as três
proibições que mais aparecem ao portar uma interface clara para o escuro —
zebra, sombra e verde em texto.

A superfície clara **continua valendo** onde é certa: PDF de portaria, lista de
assinatura, lista de autorizados, relatório do membro, assinatura de e-mail e
o Full mailer. A marca já tem o componente para isso — `.claro`, com `--aura`,
`--blackout` e `--cortex`. Nada disso deve ser "escurecido".

---

## 6. Banco de dados

### 6.1 Desfazer a colisão de numeração

Nenhum arquivo é alterado no conteúdo — só o nome e o lugar, para que a
história pare de mentir:

```
db/
├── LEIAME.md                  a ordem real em que foram aplicados
├── aplicadas/
│   ├── soma_v06_selecao.sql           (de nro-pessoal)
│   ├── soma_v07_selecao_slots.sql     (de nro-pessoal)
│   ├── soma_v08_okrs.sql              (de nro-pessoal)
│   ├── soma_v09_site.sql              (de nro-pessoal)
│   ├── soma_v10_apontamento.sql       (de nro-pessoal)
│   ├── soma_v10_portal.sql            (deste repo)   ← colidiam
│   ├── soma_v11_ps_faq.sql            (de nro-pessoal)
│   ├── soma_v11_portal_docs.sql       (deste repo)   ← colidiam
│   ├── soma_v12_ps_dinamica.sql       (de nro-pessoal)
│   ├── soma_v12_portal_agenda.sql     (deste repo)   ← colidiam
│   ├── soma_v13_site_idiomas.sql      (de nro-pessoal)
│   └── soma_v13_agenda_unificada.sql  (deste repo)   ← colidiam
└── v14_unificacao.sql
```

### 6.2 Um registro de migrações

Para a pergunta "isso já rodou?" parar de depender de memória:

```sql
create table if not exists migracoes(
  id          text primary key,
  aplicada_em timestamptz not null default now()
);
```

Cada migração nova termina inserindo o próprio id. As já aplicadas entram de
uma vez no `v14`, como registro histórico.

### 6.3 O que o `v14` precisa fazer

Quase nada — é a vantagem de o banco já ser compartilhado. Só o que a fusão
habilita de fato:

1. o registro de migrações acima;
2. **fechar o ciclo de acesso**: hoje aprovar uma solicitação no painel só
   *anota* a decisão — a concessão continua manual, na ficha do membro
   (está escrito assim no README, item 2 de "Como operar"). Com os dois lados
   no mesmo app, `portal_solicitacoes` ganha referência a `itens_de_acesso` e
   uma função `pessoal_conceder_acesso(solicitacao)` que aprova e concede na
   mesma transação, com a auditoria de sempre.

O item 2 é opcional para a unificação e pode ficar para depois — está aqui
porque é a melhoria que a fusão torna barata, e ficaria estranho não notar.

---

## 7. Fases

Cada fase é publicável sozinha. **O `pessoal.neurodynamics.dev` continua no ar
e autoritativo até a Fase 5** — nada é desligado antes de o substituto estar
em pé.

| Fase | O que entra | Pronto quando |
|---|---|---|
| **0 · Preparo** | Casca extraída; carregador de módulos; os 5 componentes no `brand/design-system`; `db/` renumerado e `LEIAME.md`; `nro-pessoal/site/` apagado | portal idêntico ao de hoje aos olhos de quem usa, já sobre a casca nova |
| **1 · Quadro** | Login com os 5 modos; Quadro, ficha, Visão geral, Auditoria; organograma unificado | dá para consultar e editar o quadro inteiro no endereço novo |
| **2 · Operações** | Apontamento, Importar, Contas, Catálogo de acessos, Relatórios e mailer (libs sob demanda) | nenhuma operação do Depto. de Pessoal exige mais o endereço antigo |
| **3 · Agenda e eventos** | Dossiê do evento em `#/agenda/evento/:id`; "Novo marco" dentro da Agenda; calendário antigo apagado | existe uma agenda só, em um lugar só |
| **4 · Painéis** | `admin.html` fundido em `#/pessoal`; Seleção e OKRs migrados | `admin.html` deixa de existir; `selecao.neurodynamics.dev` aponta para cá |
| **5 · Corte** | `nro-pessoal` vira repositório de redirecionamento; READMEs, `tour.html` e links de `brand`/`selecao`/`website` atualizados | `pessoal.neurodynamics.dev` só encaminha; nada de novo mora lá |
| **6 · Renomeação** | `soma.neurodynamics.dev` (seção 8) | o endereço novo responde e os antigos encaminham |

Ordem pensada para que a **Fase 1 seja a mais arriscada e a mais cedo**: ela
carrega o login (armadilha 1.5.3) e prova o re-vestimento em cima da tela mais
densa que existe, a ficha. Se o mapa da seção 5.1 estiver errado, a gente
descobre na Fase 1, não na 4.

---

## 8. A renomeação para `soma.neurodynamics.dev`

### 8.1 A restrição que decide o resto

**O GitHub Pages serve um domínio por repositório.** Quando o `CNAME` deste
repositório passar a dizer `soma.neurodynamics.dev`, o
`membro.neurodynamics.dev` deixa de ser servido por ele — e há endereços em
circulação apontando para lá: as descrições dos convites já enviados no Google
Agenda (`index.html:1482`), o `quiosque.html`, o `app.html` e os favoritos de
todo mundo.

Duas saídas:

| | Como | Custo | Preserva caminho e `#hash` |
|---|---|---|---|
| **A · Regra no Cloudflare** *(recomendada)* | Redirect Rule `membro.neurodynamics.dev/*` → `soma.neurodynamics.dev/$1`, 301 | zero repositórios, zero manutenção | sim — o fragmento é do navegador e viaja no redirecionamento |
| B · Repositório de redirecionamento | um repo novo só com `CNAME` + `index.html` de encaminhamento | mais um repo para manter | sim, se escrito para isso |

A **A** é melhor porque resolve no DNS o que é um problema de DNS. Mantemos o
`nro-pessoal` como repositório de encaminhamento só para o `pessoal.` — ali
existe o caso do `app.html?t=<token>`, que precisa de lógica de verdade para
levar o token do QR até o check-in.

### 8.2 Checklist da virada

1. **Cloudflare:** `soma.neurodynamics.dev` → `CNAME` para
   `neurodynamics-dev.github.io`.
2. **Repositório:** `CNAME` deste repo passa a `soma.neurodynamics.dev`;
   confirmar o domínio nas configurações de Pages e aguardar o certificado.
3. **Cloudflare:** Redirect Rule de `membro.` para `soma.` (301, preservando
   caminho).
4. **Supabase → Authentication → URL Configuration:** incluir
   `https://soma.neurodynamics.dev` na Site URL e nas Redirect URLs. **Sem
   isso, criar conta e recuperar senha param de funcionar** — os links do
   e-mail voltam para um endereço não autorizado. O código não precisa mudar:
   `URL_APP()` já se deriva de `location.origin` (`nro-pessoal/index.html:749`).
5. **Edge Function `agenda-ics`:** ~~separar as duas constantes~~ **já
   separadas.** `UID_DOMINIO` está congelado em `membro.neurodynamics.dev`
   com a explicação ao lado, e o teste do feed falha se alguém o trocar.
   Na virada, basta mudar `SITE` para `soma.neurodynamics.dev` e
   republicar a função.
   O endereço do feed que as pessoas assinaram aponta para
   `…supabase.co/functions/v1/agenda-ics` e **não** é afetado pela renomeação.
6. **Edge Function `agenda-sync`:** conferir se há referência ao domínio.
7. **Constantes nos arquivos:** `quiosque.html` (`APP_URL`), `app.html`
   (destino), `tour.html`, o trilho de ferramentas da home, o `brand/index.html`
   ("Portal ↗" e "SOMA ↗"), `selecao/dinamica-avaliador.html`,
   `website` e os READMEs.
8. **QR do LABBIO:** o do quiosque é gerado na hora e se corrige sozinho com
   o item 7. Se houver **QR impresso** na entrada apontando para
   `pessoal.neurodynamics.dev/app?t=…`, ele continua valendo pelo stub do
   `nro-pessoal` — mas vale reimprimir para tirar um salto da corrente.
9. **Varredura final:** nenhum `membro.neurodynamics.dev` sobrando no código
   além do `UID_DOMINIO` congelado, que tem comentário explicando por quê.

---

## 9. Riscos

| Risco | Como fica coberto |
|---|---|
| Re-vestir 4 400 linhas introduz regressão visual difusa | a Fase 0 entrega os componentes no design system; cada módulo migrado usa classe da marca, não CSS próprio. A Fase 1 pega a tela mais densa primeiro, de propósito |
| Alguém perde acesso a uma tela que usava | a tabela de papéis (3.3) é a mesma de hoje, item a item; nenhum papel é redesenhado nesta obra |
| Duplicação de eventos nas agendas pessoais | `UID_DOMINIO` congelado e verificado no teste que já existe (`ics-feed.test.ts:31`) |
| Cadastro/recuperação quebram na virada | entram na Fase 1, cinco fases antes da renomeação, e a Redirect URL é item 4 do checklist |
| Migração aplicada duas vezes ou nenhuma | a numeração deixa de colidir e o banco passa a registrar o que rodou (seção 6) |
| App fica pesado no celular | os módulos de gestão e as bibliotecas de planilha e PDF só descem para quem abre a tela que precisa |
| A obra parar no meio | toda fase é publicável; até a Fase 5, o endereço antigo continua servindo o que ainda não migrou |

---

## 10. Por onde começar

1. **Confirmar as decisões da seção 2** — principalmente a D2 (a casca com
   módulos sob demanda rompe a convenção de arquivo único) e a escolha A da
   seção 8.1 (regra no Cloudflare em vez de repositório extra).
2. **Fase 0**, que não mexe em nada no ar: extrair a casca, subir os cinco
   componentes para o `brand/design-system`, arrumar o `db/` e apagar o
   `nro-pessoal/site/`.
3. **Fase 1** logo em seguida, para que o mapa de cores da seção 5.1 seja
   testado na ficha do membro enquanto ainda dá para voltar atrás barato.

Duas perguntas que o plano não resolve sozinho e valem decisão antes da Fase 2:

- **`fotos/`** (no `nro-pessoal`) ainda alimenta as fichas ou virou histórico?
  Se estiver morto, some junto com o `site/`.
- **Fechar o ciclo de acesso** (6.3, item 2) entra nesta obra ou vira projeto
  à parte? Fica barato agora e caro depois.
