# Portal do Membro — membro.neurodynamics.dev

Portal restrito aos membros da NeuroDynamics, com o **mesmo login do SOMA**
e a linguagem visual do site institucional (paleta escura, vidro, fundo
animado, Archivo + IBM Plex Mono).

Uma casca (`index.html`) e módulos carregados sob demanda — é para aqui que o
SOMA · Gestão está sendo trazido, conforme o
[plano de unificação](PLANO-UNIFICACAO.md).

## O que o portal faz

- **Quadro de avisos** — banner rotativo na home, com layouts pré-definidos
  (`padrão`, `destaque`, `urgente`, `evento`, `conquista`), mantido pela
  gestão em Administração → Quadro de avisos.
- **Resumo da agenda e do check-in** — os próximos eventos do mesmo
  calendário do SOMA (com RSVP dos convites pendentes) e quem está no
  LABBIO agora, pelas presenças do sistema de check-in.
- **Agenda** — a agenda da equipe, uma só, em cinco abas. É aqui que mora
  o que antes era o SOMA App:
  - **Próximos** — o que vem pela frente para você, com RSVP, edição de
    convidados, cancelamento e criação em dois toques;
  - **Mês** — a mesma agenda em grade: eventos, cerimônias, marcos do
    semestre e ausências, cada um com a cor do seu tipo;
  - **Agendar** — o assistente de disponibilidade: escolha as pessoas ou o
    grupo e veja, lado a lado, o livre/ocupado de cada um, com sugestões de
    horário;
  - **Presença** — check-in do LABBIO pelo QR da entrada, quem está lá
    agora, *find me at*, *não perturbe* e os intervalos ("estou no
    laboratório até as 18h", "saí para almoçar");
  - **Minha agenda** — o Google Agenda nos dois sentidos: o portal lê o seu
    `.ics` (para saber quando você está ocupado) e você assina o feed da
    NeuroDynamics (para receber a agenda da equipe na sua agenda pessoal).

  Todo item da agenda — compromisso, marco do semestre ou ausência — abre o
  mesmo painel e é **editável por quem o criou**. Nenhum tipo escolhe repetição
  por você: o padrão é não repetir.

  Um compromisso que precisa de preparo abre o **dossiê**
  (`#/agenda/evento/<id>`): checklist de preparação, presenças, pauta,
  deliberações e a **ata em PDF**. No SOMA isso era uma tela separada, com
  lista própria, sobre a mesma linha de `eventos` — a equipe marcava na agenda
  e preparava em outro lugar.
- **Equipe** — o Org Explorer (estilo Microsoft Teams):
  cadeia de gestão, colegas de equipe e liderados, com busca.
- **Informações** — biblioteca de documentos e políticas (estatuto,
  políticas, guias, formulários) publicados como links do Google Drive
  pelo Depto. de Pessoal; o controle fino de acesso continua no Drive.
- **Serviços** — solicitações ao Depto. de Pessoal com protocolo:
  - **Solicitação de acesso** a documento, sistema/plataforma ou local,
    com catálogo do SOMA, **justificativa** e **tempo necessário**;
  - afastamento temporário (período + motivo);
  - pedido de desligamento;
  - reunião 1:1 com o gestor imediato;
  - **ouvidoria anônima** para a Gestão de Pessoas (sem vínculo com a
    conta, por projeto de banco — ver `db/aplicadas/soma_v10_portal.sql`);
  - outras solicitações.
- **Meus pedidos** — acompanhamento das solicitações, com status e
  resposta do Depto. de Pessoal, e cancelamento enquanto pendente.
- **Ferramentas da equipe** — trilho na página inicial com tudo o que a
  NeuroDynamics usa: agenda, atividades, equipe, documentos, tour, site
  institucional, brand guidelines, processo seletivo e GitHub.

## Como o sistema se organiza

A navegação é por **espaços** — o que você está fazendo —, não por qual app
a tela veio: **Início · Agenda · Atividades · OKRs · Equipe · Informações ·
Serviços · Meus pedidos**, e, para quem tem o papel, **Seleção** e
**Administração**. Eles ficam num **menu lateral** à esquerda,
cada um com ícone e com os seus subitens logo abaixo — as abas da Agenda, os
quadros dos seus grupos, as categorias de documento, cada serviço, cada
painel da Administração. O menu **recolhe** para um trilho de ícones (o
botão fica no pé dele; passar o mouse num ícone mostra os subitens ao lado),
e no celular vira uma gaveta, aberta pelo botão da barra de topo. Os
detalhes e o porquê estão em [`PADROES.md`](PADROES.md).

Há uma **busca global** no topo do menu (atalho `/` ou `Ctrl/⌘ K`) que acha telas
e ações, pessoas, atividades por código ou título, e compromissos da agenda.
Cada módulo registra o que sabe achar — quem adiciona um módulo novo adiciona
uma fonte de busca junto.

Endereço antigo não quebra: `#/organizacao`, `#/quadro`, `#/calendario` e
`#/auditoria` continuam levando ao lugar certo.

## Atividades

O quadro de trabalho de cada grupo, em `#/atividades`:

- **cinco colunas** — Backlog, A fazer, Em andamento, Em revisão, Concluída —
  com arrastar e soltar;
- **cada cartão tem código** (`ORT-14`): prefixo do grupo mais sequência,
  gravado na criação. É por ele que a equipe se refere à atividade, e é por ele
  que a busca acha;
- responsável, prazo, prioridade, estimativa e **comentários com menção** —
  mencionar alguém é como se escala um problema: a pessoa é notificada;
- **sinalizar** uma atividade avisa quem a segue e o gestor de quem responde
  por ela;
- o quadro mostra de saída quantas estão **atrasadas**, **sinalizadas** e
  **sem responsável**, e filtra por pessoa ou por recorte;
- **Carga da equipe** mostra quanto cada pessoa está carregando;
- **cada quadro tem o seu público**: aberto, que toda a equipe lê, ou fechado,
  que só abre para quem está no grupo (contando quem está num subgrupo dele)
  mais quem receber acesso em *Administração → Grupos*. Quadro fechado continua **aparecendo** para todo
  mundo, com cadeado — quem não entra sabe que ele existe e a quem pedir;
- **todo movimento vira histórico** no cartão: quem moveu, quem atribuiu, quem
  mudou o prazo, quem sinalizou.

As notificações aparecem no sino do pé do menu (no celular, no topo) e, se você quiser, também no
seu e-mail: um e-mail por pessoa com tudo o que está pendente — cinco avisos
na mesma hora chegam juntos, não cinco vezes. Cada um escolhe como quer
receber no **sininho → Preferências de e-mail**: a cada aviso, um resumo por
dia, ou só no portal.

Ligar o envio é [uma configuração do
projeto](supabase/functions/notificar-email/README.md); enquanto ela não
existir, os avisos continuam no sino, intactos.

## O plano de gestão

Para quem tem papel de gestão (`admin` ou `pessoal`), o menu ganha
**Administração**, e **Equipe** ganha a aba do quadro — as telas que até aqui
só existiam no `pessoal.neurodynamics.dev`:

- **Quadro de pessoal** (`#/equipe/quadro`) — quantos estão ativos, em pausa, sob
  demanda e desligados; ativos por departamento; a lista inteira com busca e
  filtros por status, departamento e grupo; e as ocorrências recentes.
- **Ficha do membro** (`#/equipe/<registro>`) — dados institucionais (com
  edição, que gera ocorrência e entra na auditoria), linha do tempo de
  ocorrências, acessos concedidos e revogados, avaliações periódicas com os
  apontamentos semanais, e dados pessoais sob a LGPD.
- **Apontamento semanal** (`#/equipe/apontamento`) — a avaliação de assiduidade
  e entregas do seu grupo, com sinalização ao Depto. de Pessoal. Não é papel de
  gestão: é de quem lidera um grupo.
- **Administração** (`#/admin`) — doze painéis, em galeria e não em abas, cada
  um com endereço próprio:

  | Grupo | Painéis |
  |---|---|
  | **Portal** | Quadro de avisos · Documentos · Solicitações · Ouvidoria · Agendas |
  | **Pessoas** | Contas e perfis · Catálogo de acessos · Grupos e quadros · Importar planilha |
  | **Registro** | Relatórios · Auditoria |
  | **Conteúdo** | Site institucional |

  Os dois `admin.html` que existiam (deste repositório e do `website`) deixam
  de ser páginas: eram duas telas de login a mais para a mesma conta. E o
  Comitê de Seleção chega aos e-mails dos candidatos por Relatórios, que é o
  único painel aberto a ele.

## Grupos

Os grupos formam uma **árvore**: um grupo pode estar dentro de outro, e quem
está num grupo está também em todos os de cima. `NRO_LEADERSHIP` contém
`NRO_MANAGERS` e `NRO_SUPERVISORS`; `NRO_PROJECTS` contém um grupo por
projeto. Pôr alguém em `NRO_PROJECT_NEBULA` põe essa pessoa em
`NRO_PROJECTS`, sem ninguém escrever `NRO_PROJECTS` na ficha dela — e tirar
de um tira do outro.

A pertença herdada é **calculada, não copiada**: a ficha guarda só o que
alguém decidiu, e a regra mora num lugar só, `esta_no_grupo()` no banco
(`gruposEfetivos()` na casca, para a tela). O quadro de atividades, o convite
de grupo na Agenda, os filtros do quadro de pessoal e dos relatórios e o
acesso aos arquivos perguntam todos para ela.

Em *Administração → Grupos e quadros* (`#/admin/grupos/<prefixo>`):

- a árvore à esquerda, com filtro; à direita o grupo escolhido, com o caminho
  até a raiz, os subgrupos e quem está nele — **pela ficha** ou **por um
  subgrupo**, e por qual;
- **pôr várias pessoas de uma vez**: marque na lista (ou marque todos de outro
  grupo) e um clique põe todas, com a mesma ocorrência na ficha que a edição
  da ficha deixaria;
- um grupo pode **não ter quadro** em Atividades — grupo guarda-chuva, que
  existe para dar acesso, não para ter trabalho;
- um grupo pode ter **responsáveis**: além de admin e Depto de Pessoal, põem e
  tiram gente dele e dos grupos abaixo dele (o supervisor de um projeto é
  responsável pelo grupo do projeto);
- um grupo desativado para de passar gente para cima — quando um projeto
  termina, a equipe dele deixa de contar como gente de `NRO_PROJECTS`.

Um pai só por grupo, de propósito: é o modelo das equipes aninhadas do
GitHub. O dia em que isto controlar acesso a repositório, cada grupo vira uma
equipe, o pai continua sendo o pai e os responsáveis viram os *maintainers*.

## OKRs

O planejamento estratégico da equipe, em `#/okrs` — veio do SOMA · Gestão
(`mod-okrs.js`). É uma árvore de objetivos, do **estratégico** ao **tático**
e ao **operacional**, desenhada como o organograma: quem está acima, o
objetivo em foco, os desdobramentos dele e os que estão no mesmo nível.

- cada objetivo tem **código** (`OE1`, `OT1.2`, `OP1.2.1`), responsáveis,
  eixo, prazo com o trimestre, status e **comentários** — mudar status ou
  prazo deixa um registro automático;
- o **progresso** de um objetivo é a fração dos objetivos-ponta do
  desdobramento que já foram concluídos (os cancelados ficam de fora);
- cada objetivo tem endereço (`#/okrs/OT1.2`), e os estratégicos são os
  subitens de OKRs no menu lateral;
- todos veem; **criar e excluir** é de `admin` e `pessoal`; **editar e mover
  o status** é deles e dos responsáveis do objetivo.

## Processo seletivo

Os bastidores do processo seletivo, para o Comitê de Seleção (`admin`,
`pessoal` e `selecao`), em `#/selecao` — também veio do SOMA · Gestão
(`mod-selecao.js`). O site público, `selecao.neurodynamics.dev`, é o outro
lado: inscrição, acompanhamento, agendamento e as páginas da dinâmica leem
daqui o que foi publicado. Cada aba tem endereço e é subitem de Seleção no
menu:

| Aba | O que tem |
|---|---|
| **Visão geral** | métricas, funil, pendências e os próximos horários |
| **Candidatos** | a lista com busca e filtro, movimentação em lote, exportação CSV e a ficha (`#/selecao/candidatos/<id>`): dados, competências, avaliações, e-mail de confirmação e a integração ao quadro |
| **Avaliação** | por fase, cada membro do comitê dá nota por critério; a nota do candidato é a média |
| **Agenda** | as janelas de dinâmica e entrevista que o candidato escolhe no site, com presença |
| **Dinâmica** | painel, roteiro, desafio, critérios e janelas — tudo o que as três páginas da dinâmica mostram no dia |
| **Publicações** | edital, avisos e resultados: o site só mostra o que estiver publicado |
| **FAQ** | as perguntas frequentes do site |
| **Configurações** | a edição, o cronograma público e quem está no comitê |

Duas coisas que a unificação trouxe de graça:

- **cada ficha tem endereço.** No SOMA a navegação era por `showView()`, sem
  URL — não dava para mandar "olha a ficha da fulana" por mensagem;
- **quem não tem o papel não baixa o código.** O `mod-gestao.js` só desce
  para quem abre a rota, e a rota só abre para quem pode. A barreira de
  verdade continua sendo a RLS do banco — isto é só não oferecer porta
  fechada, e não pesar no celular de quem nunca vai usar.

## Conteúdo

| Arquivo        | O que é |
|----------------|---------|
| `index.html`   | A casca e o plano do membro (`#/`, `#/agenda`, `#/equipe`, `#/informacoes`, `#/servicos`, `#/pedidos`) |
| `mod-atividades.js` | O quadro de trabalho de cada grupo (`#/atividades`) |
| `mod-gestao.js`| Quadro de pessoal, ficha e auditoria (`#/equipe/quadro`, `#/equipe/<registro>`) |
| `mod-admin.js` | Os doze painéis da gestão (`#/admin`, `#/admin/<painel>`) |
| `mod-relatorios.js` | Portaria, assinatura, e-mails, autorizados, quadro completo e o Full mailer |
| `mod-evento.js` | O dossiê de um compromisso: preparo, presenças e ata (`#/agenda/evento/<id>`) |
| `mod-okrs.js`  | O planejamento estratégico: a árvore de objetivos (`#/okrs`, `#/okrs/<codigo>`) |
| `mod-selecao.js` | O processo seletivo, por dentro: as oito abas do Comitê de Seleção (`#/selecao`, `#/selecao/<aba>`) |
| `admin.html`   | Encaminhamento — o painel virou `#/admin` |
| `quiosque.html`| O quiosque do check-in do LABBIO, para a tela da entrada |
| `mailer/`      | Ícones e logos recoloridas que o Full mailer embute nos e-mails |
| `tour.html`    | O tour pelos sistemas da equipe |
| [`PADROES.md`](PADROES.md) | Os padrões do sistema: navegação, rotas, busca, módulos, identidade |
| `db/`          | As migrações, em uma linha só ([LEIAME](db/LEIAME.md)) |
| `supabase/functions/agenda-sync/` | Edge Function (arquivo único) que lê o `.ics` de cada um e grava os horários ocupados ([detalhes](supabase/functions/agenda-sync/README.md)) |
| `supabase/functions/agenda-ics/`  | Edge Function (arquivo único) que serve o feed da agenda para assinar no Google ([detalhes](supabase/functions/agenda-ics/README.md)) |
| `CNAME`        | Domínio do GitHub Pages (`membro.neurodynamics.dev`) |
| [`PLANO-UNIFICACAO.md`](PLANO-UNIFICACAO.md) | O plano de fusão com o SOMA · Gestão |

## Arquitetura

O `index.html` é a **casca**: tokens da marca, menu lateral, login,
roteador, modal e toast — mais as telas do plano do membro (início, agenda,
organização, informações, serviços e pedidos).

O resto desce sob demanda. Quando alguém abre uma rota de outro plano, o
roteador injeta o `mod-<nome>.js` correspondente, uma vez por sessão, e só
então desenha. O mesmo vale para as bibliotecas pesadas (planilha, PDF): quem
as pede é o módulo que precisa delas, não todo mundo em todo login.

São scripts clássicos, não módulos ES, de propósito — o código usa
`onclick="…"` em toda parte e isso depende de escopo global.

**Módulo não depende de módulo.** O que mais de um usa (`ic`, `ibtn`,
`quemSouEu`, `CAT_LABEL`, `fmtD`, `fmtDT`, `confirma`, `copiar`) mora na
casca — senão abrir uma tela quebraria porque outra ainda não foi carregada.

As bibliotecas pesadas descem com quem precisa delas: jsPDF e autotable com
os relatórios, xlsx com a importação e com a exportação do quadro. No SOMA as
três vinham no `<head>`, quase 1,3 MB em todo login, para todo papel.

Declarar uma rota nova é uma linha em `ROTAS`:

```js
quadro: { desenha:'pageQuadro', modulo:'gestao', permite: podeQuadro }
```

`desenha` é o nome da função que o módulo define; `modulo`, o arquivo a
buscar antes; `permite`, a mesma barreira de papel do menu — rota sem
permissão devolve para o início, em vez de desenhar uma tela vazia.

O layout segue o design system da marca
([brand.neurodynamics.dev](https://brand.neurodynamics.dev)). Os componentes
de tela densa — tabela de trabalho, barra de filtros, galeria de tiles,
métricas — são o card *Telas de trabalho* do `design-system/neuro.css`,
copiados para o `<style>` da casca. **Ao mexer neles, mexa lá primeiro:**
aqui é cópia, não fonte.

## Pré-requisitos

Aplicar as migrações de [`db/`](db/LEIAME.md) no SQL Editor do Supabase, em
ordem numérica, com a SOMA 9.0 já aplicada. Depois da 14.0, o banco responde
sozinho o que já rodou:

```sql
select id, aplicada_em from public.migracoes order by id;
```

Sem as migrações do portal o app entra, mas o quadro de avisos, as
solicitações e o assistente de agendamento ficam indisponíveis (as demais
abas — agenda, check-in, calendário e organização — usam as tabelas que
o SOMA já tem).

Duas Edge Functions completam o par com o Google (as duas dá para colar
pelo painel, sem CLI):

- **`agenda-sync`** — lê o Google Agenda de cada um e grava os horários
  ocupados ([como publicar](supabase/functions/agenda-sync/README.md)). Sem
  ela o assistente continua funcionando, só que a disponibilidade vem apenas
  da agenda da equipe e das ausências;
- **`agenda-ics`** — serve o feed para assinar no Google
  ([como publicar](supabase/functions/agenda-ics/README.md)). **Precisa ser
  publicada com a verificação de JWT desligada**, porque quem busca o arquivo
  é o Google, sem sessão.

O repositório `nro-pessoal` deixa de ser um app: `pessoal.neurodynamics.dev`
passa a só encaminhar, e continua servindo duas pastas que não podem sumir —
`mailer/` (as imagens dos e-mails já enviados apontam para lá) e `fotos/` (as
fotos do quadro, buscadas por `raw.githubusercontent.com`).

## Uma agenda só

Antes desta versão a equipe tinha duas agendas separadas no banco (os
`eventos`, com convidados e RSVP, e os `calendario_itens`, com os marcos) e
uma terceira escrita à mão no HTML do portal (a agenda fixa do semestre).
Agora existe **uma leitura só** — a função `agenda_itens` —, que junta:

| Fonte | O que é | Quem vê |
|---|---|---|
| `eventos` | reuniões, testes, cerimônias, trabalho no LABBIO | conforme a **visibilidade** do evento |
| `calendario_itens` | marcos do semestre, feriados, calendário da UFMG, prazos | todo mundo (os pessoais, só a pessoa e admin/pessoal) |
| `agenda_ausencias` | férias, afastamento e os intervalos de presença | férias e afastamento são privados; os intervalos são da equipe |

**Visibilidade de cada evento**, escolhida no momento de criar (com o padrão
vindo do tipo):

- `equipe` — todo mundo vê. É o padrão da **Reunião geral**;
- `convidados` — só o dono, os convidados e o Depto. de Pessoal;
- `privado` — só o dono e o Depto. de Pessoal.

**Tipos de evento** deixaram de ser uma lista no código dos dois apps: moram
em `evento_tipos`, com cor, visibilidade padrão, checklist e a marcação de
quais aparecem na criação rápida. Criar um tipo novo virou uma linha no banco.

**Recorrência é recorrência.** Marcar um compromisso como semanal, quinzenal
ou mensal cria as ocorrências futuras de verdade, cada uma com os seus
convidados e o seu RSVP — não um "evento fantasma" que só existe na tela.
O horizonte é de 120 dias e o portal o estica sozinho sempre que alguém abre
a agenda. Dá para editar ou cancelar **só um encontro** ou **a série daqui
para a frente**.

**Cerimônias de scrum** são um caso dessa recorrência: cada grupo define em
*Agenda → Cerimônias do grupo* os dias, o horário, a duração e o link do
Meet da daily, da abertura e do fechamento de sprint, do review e da
retrospectiva. O banco cria a série e convida quem está no grupo.

## Papéis e permissões

- **Qualquer conta do SOMA** entra no portal, vê avisos publicados,
  agenda, presença, calendário e organograma.
- **Solicitações** exigem conta **vinculada a um registro de membro
  ativo** (vínculo feito pelo Depto. de Pessoal no SOMA · Gestão).
- **Marcar compromissos** exige conta vinculada a um registro: o convite é
  criado como um evento do SOMA, em nome de quem agendou.
- **Editar convidados e cancelar** é de quem organiza o compromisso (ou de
  `admin`/`pessoal`).
- **Cerimônias de scrum de um grupo** são configuradas por quem está no
  grupo (ou por `admin`/`pessoal`).
- **Ausências** são de cada um: só a própria pessoa (ou o Depto. de Pessoal)
  cria e remove as suas.
- **Administração** (`#/admin`) é liberada só para os papéis `admin` e `pessoal`
  (o Comitê de Seleção entra só em Relatórios).
- **Seleção** (`#/selecao`) é de `admin`, `pessoal` e `selecao`.
- **OKRs** (`#/okrs`) todos veem; criar e excluir é de `admin`/`pessoal`, e
  editar é deles e dos responsáveis de cada objetivo.
- **Ouvidoria**: a mensagem é gravada por função `security definer`
  sem nenhuma referência à conta, sem gatilho de auditoria e com a data
  truncada para o dia. Anonimato por projeto, não por promessa.

## Como operar (Depto. de Pessoal)

1. **Avisos**: crie e publique em *Administração → Quadro de avisos*.
   O layout tem pré-visualização ao vivo; a ordem define o rodízio.
2. **Solicitações**: cada solicitação nova vira **um cartão** no quadro
   de Atividades do Depto de Pessoal, e é lá que ela se resolve — o
   cartão tem responsável, coluna e histórico, como qualquer outro.
   No cartão, o bloco *De onde veio* mostra o pedido e decide: ao
   **aprovar um acesso**, marque os itens do catálogo e a concessão
   entra no quadro de acessos da pessoa **na mesma ação**. Não há mais
   um segundo passo na ficha.
   A triagem antiga em *Administração → Solicitações* continua no ar
   para consulta.
3. **Ouvidoria**: leia e marque como tratada. Sem como responder
   individualmente — é anônima.
4. **Calendário da UFMG**: datas acadêmicas entram como marcos do
   calendário no SOMA · Gestão (tipo "outro", ou o que couber) e
   aparecem automaticamente no portal.
5. **Agendas**: em *Administração → Agendas* você vê quem já conectou o
   Google Agenda, o horário da última sincronização e o erro de quem
   falhou, e pode forçar uma sincronização geral. O link `.ics` em si
   **não** aparece ali — a RLS só o devolve ao próprio dono.
6. **Tipos de evento**: a lista vive em `evento_tipos`. Para criar um tipo
   novo, insira uma linha (nome, categoria, cor, visibilidade padrão, se
   entra na criação rápida e o checklist). Nenhum deploy é necessário.

## Como publicar

O GitHub Pages atende **um domínio por repositório** — mesmo esquema dos
demais sites:

1. Ative o Pages neste repositório (branch `main`, raiz).
2. No Cloudflare, aponte `membro.neurodynamics.dev` → `CNAME` para
   `neurodynamics-dev.github.io`.

## Segurança

### Agenda e Google Calendar

A visibilidade dos eventos (`equipe` / `convidados` / `privado`) é aplicada
na leitura da agenda, em `agenda_itens`. A tabela `eventos` continua com as
políticas de RLS que o SOMA já tinha: a migração não as toca, porque
políticas permissivas só somam acesso e apagar as antigas às cegas quebraria
a Gestão. O rodapé do `db/aplicadas/soma_v13_agenda_unificada.sql` traz a consulta para conferir os nomes
das políticas atuais, caso a equipe queira fechar também a leitura direta da
tabela num passo à parte.


O link `.ics` é uma credencial: quem o tem lê o calendário inteiro. Por
isso ele mora em `portal_agenda_segredo`, uma tabela separada cuja política
de RLS devolve **só a linha do próprio dono** — nem `admin` nem `pessoal`
leem o link de ninguém. Quem lê é a Edge Function, com a service role key.

Do calendário, o banco guarda apenas início e fim de cada compromisso. O
**título** só é gravado se a pessoa marcar *"mostrar também o título"*; ao
desmarcar, os títulos já gravados são apagados na hora. A disponibilidade
sai pela função `portal_agenda_ocupacao`, que aplica essa regra — as
tabelas de blocos não são lidas direto por ninguém além do dono.

Férias e marcos individuais entram no assistente como *indisponível*, sem
título e sem motivo: o portal continua não expondo por que a pessoa está
fora, como já era no calendário geral.

### Autenticação

O portal usa apenas a chave `anon` do Supabase; tudo depende de sessão
autenticada. As tabelas novas têm RLS: avisos publicados para qualquer
autenticado (rascunhos só para `admin`/`pessoal`); cada membro lê apenas
as próprias solicitações; a escrita passa pelas funções
`portal_abrir_solicitacao` / `portal_cancelar_solicitacao` (validação e
protocolo no banco); a ouvidoria só é lida por `admin`/`pessoal`. O
A tela de Administração é só interface — a regra mora no banco.
