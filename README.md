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
- **Meus pedidos** (em Serviços) — acompanhamento das solicitações, com
  status e resposta do Depto. de Pessoal, e cancelamento enquanto pendente.
- **Treinamentos** — a formação da equipe: treinamentos com código e revisão
  (`NRO-TRE-003 Rev. B`), módulos em Markdown com vídeos do YouTube no player
  do site institucional, verificação de conhecimento corrigida no banco,
  atribuição a grupos (obrigatório ou opcional), a conclusão no perfil e o
  certificado em PDF. O texto vem, quase sempre, de um agente de IA que segue
  o README de conteúdo. Ver [Treinamentos](#treinamentos).
- **Projetos** — cada projeto com código, logo gerada, supervisor, equipe
  (um grupo dentro de `NRO_PROJECTS`) e o rol de arquivos que todo projeto
  deve ter.
- **Arquivos** — o controle de documentos e registros que era a planilha
  NRO-PUB-001: código `NRO-XXX-YYY-Z`, revisão, status, template, relações
  entre arquivos, e nenhuma versão valendo antes de alguém revisar.
- **Studio** — a comunicação: um criador de peças para as redes, no tamanho
  exato de cada uma, e o planejamento das publicações — quadro, calendário,
  ideias, aprovação e o lembrete da véspera por e-mail. Ver [Studio](#studio).
- **Ferramentas da equipe** — trilho na página inicial com tudo o que a
  NeuroDynamics usa: agenda, atividades, equipe, documentos, tour, site
  institucional, brand guidelines, processo seletivo e GitHub.

## Como o sistema se organiza

A navegação é por **espaços** — o que você está fazendo —, não por qual app
a tela veio: **Agenda · Atividades · OKRs · Projetos · Arquivos · Studio ·
Equipe · Treinamentos · Informações · Serviços** (o Studio, para quem está
nos grupos dele), e, para quem tem o papel, **Seleção** e **Administração**. Eles ficam num **menu lateral** à esquerda,
cada um com ícone e com os seus subitens logo abaixo — as abas da Agenda, os
quadros dos seus grupos, as categorias de documento, cada serviço, cada
painel da Administração. O **início** não é item da lista: a logo no alto do
menu leva a ele, e a casinha ao lado dela diz que leva. O menu **recolhe**
para um trilho de ícones (o botão fica no pé dele; passar o mouse num ícone
mostra os subitens ao lado), e no celular vira uma gaveta, aberta pelo botão
da barra de topo. Os detalhes e o porquê estão em [`PADROES.md`](PADROES.md).

Há uma **busca global** no topo do menu (atalho `/` ou `Ctrl/⌘ K`; no
trilho, é só a lupa) que acha telas e ações, pessoas, atividades por código
ou título, e compromissos da agenda. Cada módulo registra o que sabe achar —
quem adiciona um módulo novo adiciona uma fonte de busca junto.

**Tema claro ou escuro.** O escuro é o da marca e o padrão; o claro é
escolha de cada pessoa, no botão ao lado do *sair*, na linha da sua conta
(com o menu recolhido, pelo voo da conta). A escolha fica no navegador e vale
desde o primeiro quadro da página — sem piscar escuro antes.

Endereço antigo não quebra: `#/organizacao`, `#/quadro`, `#/calendario`,
`#/auditoria` e `#/pedidos` (que desde a v24 é `#/servicos/pedidos`) continuam
levando ao lugar certo.

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

## Projetos

Em `#/projetos` (`mod-projetos.js`). Um projeto é **uma equipe e um rol de
arquivos**:

- a equipe é um grupo, `NRO_PROJECT_<CÓDIGO>`, criado junto com o projeto
  dentro de `NRO_PROJECTS` — por isso quem entra na equipe entra também em
  `NRO_PROJECTS`. Dá para criar o projeto sobre um grupo que já existe;
- um membro da equipe é o **supervisor**, e ele vira responsável pelo grupo:
  ele mesmo põe e tira gente da equipe e edita o projeto;
- o projeto tem código (`NEBULA`), nome, descrição, status (ativo, pausado,
  encerrado) e uma **logo gerada** de uma semente, como os avatares do
  GitHub, mas com a paleta e o traço da marca: uma grade 5×5 espelhada, com
  os quadrados ligados como trilhas de circuito. A mesma semente dá sempre a
  mesma logo; "Outra" sorteia outra antes de criar;
- o **rol** do projeto (`#/projetos/<código>/arquivos`) é o **padrão de
  projeto** aplicado a ele: as séries que todo projeto tem (termo de
  abertura, USRS, relatórios de teste…). O PMO põe uma série no padrão e
  **todo projeto passa a tê-la**, com um botão *Criar* onde o PN do projeto
  ainda não existe;
- criar projeto é do PMO (e de `admin`); quem está na equipe quando o
  projeto nasce é avisado.

## Arquivos

O controle de documentos e registros, em `#/arquivos` (`mod-arquivos.js`) — o
que a planilha NRO-PUB-001 fazia, com as regras do NRO-PUB-002, agora vivo. É
um PLM pequeno: cada arquivo tem código, revisão, status e quem mexeu por
último, e **nenhuma versão vale antes de alguém revisar**.

O código é `NRO-XXX-YYY-Z`:

| Parte | O que é |
|---|---|
| `XXX` | o **emissor** — departamento ou grupo que emitiu (`PES`, `PRO`, `PUB`…) |
| `YYY` | o **número de série** (SN): um por espécie de arquivo |
| `Z`   | o **part number** (PN): um por exemplar, quando existe mais de um — um relatório de teste por teste, um termo de abertura por projeto. Política não tem PN: existe uma só |

Toda série tem uma **cabeça**, o arquivo sem PN. O que a cabeça é — e o que
cada PN é — sai da **estrutura** da série: a coluna ao lado do título na
NRO-PUB-001. São três:

| Estrutura — a frase da coluna | A cabeça, sem PN | Cada PN | Exemplo |
|---|---|---|---|
| **Documento único** — "um documento para toda a equipe, sem template e sem filhos" | o próprio documento; revisa | — | `NRO-PES-015`, política de acesso ao LABBIO |
| **Template → documentos** — "um template, cada pn é um documento filho da série" | o template; revisa | um documento; revisa, por conta própria | `NRO-PRO-001` e o `NRO-PRO-001-3`, o termo de abertura de um projeto |
| **Template → registros** — "um template, cada pn é um registro filho da série" | o template; revisa | um registro; **não** muda depois de aprovado — a "Rev." dele é a do template usado | `NRO-PUB-003` e a `NRO-PUB-003-12`, uma ata |

Daí as três perguntas que todo arquivo responde — e que a tela dele mostra no
alto, em *O que é este arquivo*:

- **template ou arquivo real?** A cabeça de uma série com PN é template; todo
  o resto é arquivo real;
- **integrante de uma série (tem PN) ou arquivo único (não tem)?**
- **pode ser alterado?** Documento, sim (Rev. A, B, C…); registro, não; o
  template, sim — inclusive o de registros.

O `NRO-PUB-002` é o caso à parte: documento sem PN com subtipo template — o
modelo de base dos outros —, e a coluna de estrutura dele veio vazia.

**A primeira tela** (`#/arquivos`) já é a lista de todos os arquivos, como
uma lista do Drive: código, título, revisão, última alteração e quem a fez,
status. Filtra por **emissor** — escolher um leva ao rol dele
(`#/arquivos/PES`), que é a aba daquela planilha —, por status, natureza,
subtipo e classe; ordena por coluna; as séries com PN abrem os PNs logo
abaixo. No alto, quantas séries há de cada estrutura — clicar numa filtra.
*Exportar* devolve a planilha no mesmo formato da NRO-PUB-001, com a coluna
de estrutura.

O resto do módulo fica numa barra secundária, logo abaixo do título:
*Para revisar* (com a contagem, acesa quando há revisão esperando por você),
*Templates*, *Visão geral* (`#/arquivos/visao`, os números de cada emissor)
e, para o PMO e `admin`, *Configurações*.

**Adicionar** pergunta o que é antes de criar: um arquivo real numa série que
já existe — um PN, que nasce do template, e a tela diz antes se vai ser
documento ou registro — ou uma série nova, do PMO, já com a estrutura
escolhida. Revisão nova de um arquivo que já existe não é adicionar: é
*Enviar revisão*, na tela dele — mesmo código, letra seguinte.

**A tela de um arquivo** (`#/arquivos/NRO-PES-007`):

- a **barra de status** — rascunho, em revisão, ativo, obsoleto;
- **nasce de**: o template e a revisão dele que foi usada, com aviso quando
  o template já mudou;
- as **relações** num desenho: pais em cima, irmãos ao lado, filhos embaixo.
  O checklist de offboarding é filho do procedimento de desligamento: quem
  revisa o procedimento vê que o checklist precisa de conferência;
- o **registro de alterações**: quem criou o template (na revisão usada),
  quem criou o arquivo, quem enviou e quem revisou cada revisão, com o
  parecer;
- à direita, os **metadados** (o autor é quem criou *este* exemplar, não o
  template), o grupo revisor, *Baixar* e *Enviar revisão*.

A tela de um **template** tem outro fundo — papel de planta — e mostra **onde
ele é usado**: numa série com PN, os PNs dela, com a revisão do template que
cada um usou.

**Revisar.** *Enviar revisão* sobe o arquivo novo, que fica no mesmo código
com a letra seguinte e **pendente**: o grupo revisor da série é avisado no
sino e por e-mail (conforme a preferência de cada um), e até alguém dele —
que não seja quem enviou — aprovar, a versão em vigor continua sendo a
anterior. Quem envia diz o que mudou e **confere os pais e os filhos** do
arquivo: sem essa conferência o envio não sai. Revisão devolvida não gasta
letra. Registro aprovado não recebe revisão — erro num registro se corrige
com outro registro.

**Acesso.** O rol — código, título, revisão, status — é da equipe toda, como
a planilha era. O conteúdo segue a **classe** da série:

- **público** — toda a equipe lê;
- **controlado** — lê quem está no grupo do emissor, na equipe do projeto,
  no grupo revisor ou num dos grupos de leitura da série;
- **confidencial** — só os grupos de leitura e o grupo revisor.

Tudo pela pertença efetiva dos grupos. Os arquivos ficam no bucket privado
`arquivos` do Supabase Storage (até 50 MB cada), e a mesma regra vale lá: a
versão pendente só desce para quem enviou e para quem revisa.

**Configurações** (`#/arquivos/config`, do PMO e de `admin`): as séries —
título, natureza, subtipo, classe, grupo revisor, grupos de leitura —, os
emissores e o grupo de cada um, o padrão de projeto e qual grupo é o PMO e
qual é o pai dos projetos.

**Para começar**, depois de aplicar as migrações 19.0 a 22.0 (a 21.0 traz a
planilha como rol inicial; a 22.0, a estrutura de cada série pela coluna nova
dela):

1. em *Arquivos → Configurações → PMO e projetos*, escolha o grupo do PMO —
   sem ele, só `admin` administra a documentação;
2. escolha o grupo revisor de cada série (sem grupo revisor, quem revisa é o
   PMO);
3. ligue cada emissor ao grupo dele — é o que abre os arquivos controlados
   para o departamento;
4. anexe o arquivo das revisões A que vieram da planilha: elas entram
   aprovadas, mas sem arquivo (*Anexar o arquivo desta revisão*, na tela de
   cada um).

## Studio

O espaço da comunicação, em `#/studio` (`mod-studio.js`, o planejamento, e
`mod-criador.js`, a arte). Entra quem está num dos **grupos de acesso** ou num
dos **grupos aprovadores** escolhidos em *Studio › Configurações* (contando
subgrupos, como sempre), e `admin`.

### O criador

Em `#/studio/criar` — o mesmo caminho do gerador de assets do brand e do
gerador de publicações do processo seletivo, com mais liberdade. Tudo é
desenhado no navegador, em canvas, no **tamanho exato de cada rede**: feed
4:5, quadrado, stories, capa de reels, documento do LinkedIn (sai em PDF),
paisagem, thumbnail do YouTube e vídeo 16:9 e 9:16.

- **23 modelos**, em `#/studio/modelos`, cada um com prévia: *na mídia*,
  *projeto em foco* (carrossel de seis lâminas), *aniversário*, *parabéns a
  parceiros* (a logo do parceiro ao lado da nossa), *boas-vindas*,
  *conquista*, *evento*, *aviso*, *frase*, *dado*, *bastidores*, *carrossel
  educativo*, *vaga e processo seletivo*, *artigo publicado*, *agradecimento*,
  *data comemorativa*, *depoimento*, *enquete*, e os de vídeo — *thumbnail*
  (e capa de reels), *tela de encerramento* (com os espaços dos elementos do
  YouTube), *barra de nome* (PNG transparente, para ir sobre o vídeo) e
  *cartela de título* —, mais uma peça em branco;
- a peça é uma ou mais **lâminas** (o carrossel), cada uma com um de 17
  **leiautes** (capa, texto, lista numerada, número, citação, pessoa, evento,
  na mídia, parceiro, chamada final, foto, artigo, enquete, thumbnail,
  encerramento, barra de nome, cartela). Acrescentar, duplicar, reordenar e
  trocar o leiaute de uma lâmina não perde o texto;
- o **estilo** é da peça: dez temas da paleta oficial e da auxiliar (Void,
  Cortex, Soma, Íon, Plasma, Dendrito, Synapse, Aura, Papel, Mielina), nove
  acentos (e uma cor livre), decoração (rede neural, ondas, formas, confete),
  grade técnica, marcas de corte, destaque (`*palavra*` pinta, marca ou
  sublinha), alinhamento, tamanho do título, caixa alta, a posição e o
  tamanho da logo, **a logo do LABBIO ao lado da nossa**, rodapé e contador
  do carrossel. Nos temas claros, o acento de texto escurece para ler;
- **fotos**: enviar, do **Unsplash** (com a chave em *Configurações*, a busca
  acontece ali mesmo e o crédito entra sozinho), **da equipe** (o nome, o
  cargo e a foto da ficha, para aniversário e boas-vindas) ou por link. Cada
  uma com enquadramento, zoom e filtro (natural, preto e branco, duotone da
  marca, véu verde);
- **baixar** em três resoluções (a Alta é a de 1440 px, o máximo que o
  Instagram guarda), uma lâmina, todas num ZIP ou em PDF;
- **salvar no quadro** pede o plano — quando, onde, formato, pilar, quem
  responde, a legenda (o modelo sugere uma), o primeiro comentário, o texto
  alternativo, as contas para convidar como collab e as **notas para quem for
  publicar** — e sobe as artes na resolução Alta para o bucket privado
  `studio`. A peça inteira vai junto: a arte reabre para editar
  (`#/studio/POST-14/arte`). Uma peça que ainda não foi salva fica guardada
  no navegador, para continuar depois.

### O planejamento

Cada publicação tem código (`POST-14`) e anda por cinco colunas no **quadro**
(`#/studio`):

| Coluna | O que é |
|---|---|
| **Ideias** | esboços sem data — às vezes só uma frase e o tipo de publicação (`#/studio/ideias`, com pontos de partida por pilar) |
| **Em produção** | a arte e a legenda sendo feitas |
| **Em aprovação** | esperando o grupo aprovador |
| **Pronta para publicar** | aprovada: é só publicar na data |
| **Publicada** | no ar, com o link |

- **"Pronta" só se alcança pela aprovação.** Quem aprova é alguém de um grupo
  aprovador que **não** mandou a publicação para aprovação — a mesma regra das
  revisões de arquivo. Dá para exigir duas ou três aprovações. Devolver pede o
  porquê, e quem responde é avisado;
- **mexer na arte ou na legenda de uma publicação aprovada devolve para
  aprovação**: o que foi aprovado era a versão anterior. Notas, data e o resto
  do plano não contam;
- o **calendário** (`#/studio/calendario`) mostra o mês, com a cor do status;
  arrastar muda a data, e o que não tem data fica ao lado, para ser arrastado;
- na **véspera** da data, quem responde pela publicação (e quem aprova, se ela
  ainda não foi aprovada) recebe um lembrete no sino e **por e-mail** — o
  único aviso do Studio que sai por e-mail mesmo para quem escolheu resumo ou
  "só no portal": é compromisso com dia marcado. O `pg_cron` roda o lembrete
  de hora em hora, das 8h às 20h; sem ele, quem abre o Studio dispara;
- a página da publicação (`#/studio/POST-14`) tem a arte para baixar (uma a
  uma ou num ZIP), o plano, a aprovação, o histórico e, para quem publica, o
  passo a passo de cada rede (como convidar um colaborador no Instagram, onde
  vai o link no LinkedIn…).

A classificação vem dos blogs de conteúdo: o **pilar** diz por que publicar
(educar, inspirar, conectar, entreter, institucional, convidar), o **tipo** diz
o que é (aniversário, na mídia…), o **formato** diz o que ela é na rede
(imagem única, carrossel, stories, reels, documento, vídeo, só texto) e as
**redes** dizem onde.

### Configurações

Em `#/studio/config`: os **grupos de acesso** e os **grupos aprovadores**,
quantas aprovações bastam e o lembrete; as **contas** da equipe em cada rede
(entram no rodapé das artes e na tela de encerramento) e a chave do Unsplash;
a **imprensa do site** — os vídeos e as matérias da seção *Quem somos* do site
institucional e da página *A NeuroDynamics* do site do processo seletivo, que
os dois leem na hora por `site_imprensa_publico()`; e os **recursos de
imagem** — pastas do Drive, álbuns compartilhados, repositórios com fotos da
equipe.

Acesso e contas são da gestão do Studio (admin e quem aprova); a imprensa,
dela e de `admin`/`pessoal`, como o painel do site; os recursos, de quem
entra no Studio.

## Treinamentos

A formação da equipe, em `#/treinamentos` (`mod-treinamentos.js`). Todo mundo
faz; **gere** — cria, edita, publica, atribui e acompanha — quem é `admin`, do
Depto. de Pessoal ou de um dos **grupos gestores** escolhidos em *Treinamentos ›
Configurações* (contando subgrupos, como sempre).

### O que é um treinamento

| Parte | O que é |
|---|---|
| **Código** | `NRO-TRE-003`, dado pelo portal (o seguinte ao último, ou um número escolhido ao criar). O prefixo `TRE` fica reservado: Arquivos não aceita um emissor com ele |
| **Revisão** | `Rev. A`, `B`, `C`… fora do código, como nos arquivos. Uma revisão por vez é rascunho; publicar dá a letra seguinte |
| **Módulos** | o corpo de cada um em Markdown — texto, vídeos do YouTube, links para os arquivos (`arquivo:NRO-PES-015`), outros treinamentos e as telas do portal — mais os links relacionados |
| **Verificação de conhecimento** | opcional por módulo: questões de uma correta, de várias corretas ou de verdadeiro e falso, cada uma com a explicação |
| **Atribuição** | a grupos (ou à equipe inteira), obrigatório ou opcional. Atribuir a `NRO_PROJECTS` atribui a quem está em cada projeto |
| **Dados** | resumo, categoria, carga horária, nota mínima (a padrão é 70%), validade em meses (segurança, por exemplo) e o responsável |

### Fazer

- **Para você** (`#/treinamentos`) é o que os grupos da pessoa pedem: os
  obrigatórios primeiro, depois os que estão em andamento e os recomendados.
  **Todos** é o catálogo — qualquer um faz qualquer treinamento publicado; a
  atribuição só diz o que é obrigatório para quem. O **início** mostra os
  obrigatórios por fazer, e a busca acha os treinamentos pelo código e pelo nome;
- a página do treinamento (`#/treinamentos/NRO-TRE-003`) tem o programa e onde a
  pessoa está; cada módulo tem endereço (`#/treinamentos/NRO-TRE-003/2`);
- os **vídeos** aparecem no mesmo player da seção *Quem somos* do site
  institucional — o palco 16:9, o botão de vidro, a barra Synapse e a linha com
  o número, o título e a fonte —, e o player do YouTube (youtube-nocookie) só
  desce quando a pessoa aperta o play;
- módulo sem verificação se conclui lendo; com verificação, passando nela. A
  correção é **no banco** (`treinamento_responder`): o gabarito nunca desce para
  quem faz o treinamento. Cada questão vale um ponto, tudo ou nada; reprovado, a
  pessoa sabe quais errou, não qual era a certa; aprovado, recebe as explicações.
  Dá para tentar de novo quantas vezes precisar, e vale a melhor nota;
- o último módulo **fecha o treinamento**: a conclusão fica no perfil da pessoa
  com um código de certificado (`CERT-XXXX-XXXX`) e uma fotografia do que foi
  concluído — nome, título, revisão, carga horária, nota e os módulos. O
  **certificado** sai em PDF (A4 deitado, com a faixa Cortex, a rede neural
  sorteada do código, as marcas da NRO e do LABBIO e quem assina), com uma
  camada de texto por baixo, para o PDF se buscar e se copiar;
- **Meus certificados** junta os de cada um, e qualquer membro confere um
  certificado pelo código (`#/treinamentos/certificado/CERT-…`);
- a **ficha** do membro, em Equipe, ganha a aba **Treinamentos**: o que é
  obrigatório para a pessoa, onde ela está e os certificados.

### Revisar sem perder quem já fez

Publicar uma revisão pergunta se ela **pede que todos refaçam**. Sem isso (uma
correção de texto, um vídeo trocado), quem concluiu a anterior continua em dia,
e quem estava no meio leva para a revisão nova os módulos que **não mudaram
nada**. Com isso, quem concluiu volta a dever o treinamento e é avisado — o
certificado da revisão anterior continua no perfil. Um treinamento com
**validade** vence depois dos meses dela, e refazer é recomeçar do zero.

Quem deve um treinamento obrigatório (na primeira publicação, quando uma
revisão pede que refaçam e quando passa a ser de um grupo seu) recebe o aviso no
sino e por e-mail, conforme a preferência de cada um.

### Escrever com um agente de IA

O texto de um treinamento é **um arquivo Markdown**: um cabeçalho (título,
resumo, categoria, carga horária) e os módulos, cada um começando por `# `, com
as seções `## Links relacionados` e `## Verificação de conhecimento` no fim. O
**README de conteúdo** explica o formato inteiro, o tom da equipe, como pôr
vídeos e links, como escrever boas questões e como transformar um link ou um
documento num treinamento nosso — é o arquivo que vai junto do pedido ao agente.

1. Em *Treinamentos › Configurações › README de conteúdo*, baixe o README
   **com as referências**: ele desce com a lista dos arquivos e dos treinamentos
   que existem, para o agente não inventar código nenhum;
2. copie o **pedido-modelo** e complete o tema, o público, as fontes e os
   vídeos;
3. o que o agente devolver, cole em *Novo treinamento › De um texto* (ou, num
   treinamento que já existe, em *Importar texto*, no editor). O portal lê o
   texto, mostra o que precisa de conserto — link que o portal não abre, questão
   sem a certa marcada, vídeo sem link do YouTube, marca `[VÍDEO A GRAVAR]` — e
   cria o rascunho;
4. revise no editor, veja a **pré-visualização** (com o gabarito marcado) e
   publique.

O README é da equipe: dá para editá-lo ali mesmo e baixá-lo; sem edição, vale
o padrão do portal, que mora em `mod-treinamentos.js` ao lado do leitor do
formato que ele descreve. **Exportar**, no editor, devolve o treinamento no
mesmo formato — é assim que se pede a um agente a Rev. B de um treinamento que
já existe.

### O editor

Em `#/treinamentos/NRO-TRE-003/editar`: os módulos (título, corpo com barra de
atalhos para negrito, subtítulo, passo a passo, link, arquivo, vídeo e caixa de
dica, e a alternância escrever/ver), os links relacionados e as questões, um
painel com **o que impede publicar**, a atribuição, o "o que mudou" da revisão,
as revisões anteriores e arquivar ou excluir (excluir só o que nunca foi
publicado). Os dados valem na hora; o conteúdo mora no rascunho, grava sozinho
e só vale ao publicar. *Acompanhamento* mostra quem deve, quem está em dia e
quem começou, e baixa a planilha.

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
| `index.html`   | A casca e o plano do membro (`#/`, `#/agenda`, `#/equipe`, `#/informacoes`, `#/servicos`, `#/servicos/pedidos`) |
| `mod-atividades.js` | O quadro de trabalho de cada grupo (`#/atividades`) |
| `mod-gestao.js`| Quadro de pessoal, ficha e auditoria (`#/equipe/quadro`, `#/equipe/<registro>`) |
| `mod-admin.js` | Os doze painéis da gestão (`#/admin`, `#/admin/<painel>`) |
| `mod-relatorios.js` | Portaria, assinatura, e-mails, autorizados, quadro completo e o Full mailer |
| `mod-evento.js` | O dossiê de um compromisso: preparo, presenças e ata (`#/agenda/evento/<id>`) |
| `mod-okrs.js`  | O planejamento estratégico: a árvore de objetivos (`#/okrs`, `#/okrs/<codigo>`) |
| `mod-selecao.js` | O processo seletivo, por dentro: as oito abas do Comitê de Seleção (`#/selecao`, `#/selecao/<aba>`) |
| `mod-projetos.js` | Os projetos: equipe, supervisor, logo e rol (`#/projetos`, `#/projetos/<código>`) |
| `mod-arquivos.js` | O controle de arquivos: a lista de todos os arquivos (filtra por emissor), tela do arquivo, revisões, templates, visão geral e configurações (`#/arquivos`, `#/arquivos/<código>`) |
| `mod-studio.js` | O planejamento do Studio: quadro, calendário, ideias, a publicação e as configurações (`#/studio`, `#/studio/POST-14`) |
| `mod-treinamentos.js` | A formação da equipe: para você, o catálogo, o módulo com a verificação, os certificados em PDF, o editor com a importação do texto dos agentes de IA, o acompanhamento e o README de conteúdo (`#/treinamentos`, `#/treinamentos/NRO-TRE-003`) |
| `mod-criador.js` | O criador do Studio: o motor de desenho, os 23 modelos, o editor, a galeria, baixar e salvar no quadro (`#/studio/criar`, `#/studio/modelos`) |
| `studio/` | As marcas que o criador desenha: o imagotipo da NRO, o símbolo e a logo do LABBIO (do repositório do site), servidas daqui para o canvas poder exportar |
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

Os e-mails que o próprio Supabase manda — a confirmação de cadastro, a
redefinição de senha, o convite e os outros três — têm modelos em português,
no mesmo padrão dos avisos do portal, em
[`supabase/templates/`](supabase/templates/LEIAME.md). Lá está o passo a
passo para colá-los no painel e para enviá-los pelo mesmo remetente da
Cloudflare.

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
- **Projetos** (`#/projetos`) todos veem; criar é do PMO e de `admin`, e
  editar e cuidar da equipe é deles e do supervisor do projeto.
- **Arquivos** (`#/arquivos`): o rol é de todos; o conteúdo segue a classe
  da série; revisar é do grupo revisor da série (sem ele, do PMO), nunca de
  quem enviou; configurar é do PMO e de `admin`.
- **Studio** (`#/studio`): entra quem está num grupo de acesso ou num grupo
  aprovador, e `admin`; aprovar é do grupo aprovador (sem ele, de `admin`),
  nunca de quem mandou para aprovação; configurar é de quem aprova e de
  `admin`. A escrita das publicações passa por funções do banco — é nelas, e
  num gatilho, que mora a regra de "pronta só com aprovação".
- **Treinamentos** (`#/treinamentos`): todos fazem; gerir é de `admin`, do
  Depto. de Pessoal e dos grupos gestores; quem entra na gestão, só `admin` e o
  Depto. de Pessoal escolhem. O conteúdo com o gabarito só quem gere lê; quem faz
  o treinamento recebe o conteúdo sem as respostas, e a correção, a conclusão e o
  certificado saem de funções do banco — nenhuma escrita direta nas tabelas.
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
