---
titulo: Gestão de projetos
codigo: NRO-TRE-006
resumo: O que é um projeto, como ele vive no SOMA e os métodos com que a equipe trabalha — Kanban, Scrum, OKRs e o ciclo de requisitos, riscos e verificação —, os mesmos que a indústria usa para levar um produto da ideia ao usuário.
categoria: Projetos
carga_horaria: 75
---

# O que é um projeto

Ao fim deste módulo, você sabe o que distingue um projeto de uma rotina e por que a NeuroDynamics o gerencia com método.

O Project Management Institute (PMI), cujo guia PMBOK é a referência mundial em gerenciamento de projetos, define: **projeto é um esforço temporário, empreendido para criar um produto, serviço ou resultado único**.

As duas palavras importam:

- **Temporário** — tem começo e fim. Uma órtese que precisa ser projetada é um projeto; a limpeza semanal do laboratório é uma rotina.
- **Único** — ninguém fez aquilo exatamente daquele jeito antes. Por isso há incerteza, e por isso é preciso método.

## O que se equilibra

Todo projeto negocia o tempo todo entre **escopo** (o que se entrega), **prazo** e **recursos** (pessoas, horas, dinheiro), sem abrir mão da **qualidade**. Aumentar um puxa os outros: mais escopo no mesmo prazo pede mais gente; menos gente no mesmo escopo pede mais prazo. Gerenciar um projeto é fazer essas trocas **de propósito**, e não descobri-las no fim.

## Planejar ou adaptar

| Abordagem | Como funciona | Quando serve |
|---|---|---|
| **Preditiva** (cascata) | planeja tudo no começo e executa em fases | quando o que se quer está claro e muda pouco |
| **Ágil** | entrega em ciclos curtos e reajusta a cada um | quando se aprende fazendo |
| **Híbrida** | fases e marcos definidos, ciclos ágeis dentro delas | o normal em dispositivos médicos |

Na NeuroDynamics o normal é o híbrido. A ISO 13485 — a norma de qualidade de dispositivos médicos — pede um projeto com etapas documentadas: requisitos, riscos, verificação, validação. Dentro delas, os grupos trabalham em ciclos curtos, com quadro e sprints. Não é contradição: a AAMI TIR45, usada pela indústria de dispositivos médicos, descreve justamente como usar métodos ágeis sob essas exigências.

> **Nota:** o PMI certifica gerentes de projeto no mundo inteiro, e o PMBOK é leitura de base em cursos de engenharia e de administração. O que você aprende aqui é o começo desse caminho.

## Links relacionados

- [Project Management Institute](https://www.pmi.org/) — o instituto que mantém o PMBOK.
- [Termo de abertura de projeto](arquivo:NRO-PRO-001) — o documento que abre cada projeto da equipe.

## Verificação de conhecimento

1. Qual destes é um projeto?
   - [ ] A limpeza semanal do laboratório
   - [x] Desenvolver o primeiro protótipo de uma órtese
   - [ ] A reunião geral de todo mês
   > Projeto é temporário e cria algo único. A limpeza e a reunião se repetem: são rotinas.

2. O escopo de um projeto cresceu, e a equipe e o prazo continuam os mesmos. O que tende a acontecer?
   - [ ] Nada, se todo mundo se esforçar
   - [x] A qualidade cai ou o prazo estoura, a não ser que se renegocie escopo, prazo ou recursos
   - [ ] O projeto fica mais barato
   > Escopo, prazo e recursos se puxam. Gerenciar é renegociar de propósito, antes que a conta chegue.

3. Verdadeiro ou falso: {vf}
   - [V] Um projeto pode ter fases documentadas e, dentro delas, trabalhar em ciclos ágeis.
   - [F] Métodos ágeis não podem ser usados em dispositivos médicos.
   > A abordagem híbrida é a regra em dispositivos médicos, e a AAMI TIR45 orienta o uso de métodos ágeis nesse contexto.

# O projeto no SOMA

Ao fim deste módulo, você acha o seu projeto no portal, sabe quem responde por ele e o que precisa estar documentado.

## A equipe e o supervisor

Em **Projetos**, cada projeto tem um código (`NEBULA`), uma descrição, um status — **ativo**, **pausado** ou **encerrado** — e uma equipe. A equipe é um grupo, `NRO_PROJECT_NEBULA`, dentro de `NRO_PROJECTS`: entrar na equipe põe você no quadro de atividades do grupo, nos compromissos do grupo e nos arquivos controlados do projeto.

Um membro da equipe é o **supervisor**. Ele responde pelo projeto no dia a dia, põe e tira gente da equipe e edita a descrição e o status. Quem cria projetos é o **PMO**, o escritório de projetos — como nas grandes empresas, é quem cuida para que todos os projetos sigam o mesmo padrão.

## O rol de arquivos

O **padrão de projeto** é a lista das séries que todo projeto precisa ter, definida pelo PMO. Na aba **Arquivos** do projeto, cada série do padrão aparece numa linha: o exemplar do projeto, ou **a criar**. A barra mostra quanto do padrão já está **em vigor**, **em revisão** e **em rascunho**.

O primeiro documento é o **termo de abertura** — o *project charter*, no PMBOK. É ele que diz para que o projeto existe, o que entra e o que fica de fora do escopo, quem participa e quais são os marcos. Projeto sem termo de abertura é projeto que cada um entende de um jeito.

[VÍDEO A GRAVAR: NRO-TRE-006/V1 — a página de um projeto: a equipe, o supervisor, o quadro e o rol de arquivos, com a criação de um exemplar que está "a criar"]

> **Dica:** abra a sua lista em **Projetos › Meus**. Se você trabalha num projeto e ele não aparece ali, fale com o supervisor: você ainda não está no grupo da equipe e, por isso, não lê os arquivos dela.

O [treinamento de documentação](treinamento:NRO-TRE-003) mostra como criar, enviar e revisar cada um desses arquivos.

## Links relacionados

- [Projetos](#/projetos) — todos os projetos da equipe.
- [Termo de abertura de projeto](arquivo:NRO-PRO-001) — o template do documento que abre cada projeto.
- [Portfólio](arquivo:NRO-PRO-007) — o registro do conjunto de projetos da equipe.

## Verificação de conhecimento

1. O que o supervisor de um projeto pode fazer? {multipla}
   - [x] Pôr e tirar gente da equipe
   - [x] Editar a descrição e o status do projeto
   - [ ] Aprovar sozinho os documentos que ele mesmo enviou
   > O supervisor cuida do projeto e da equipe. Revisar um documento é sempre de outra pessoa, nunca de quem enviou.

2. Para que serve o termo de abertura?
   - [ ] Para registrar as horas de cada membro
   - [x] Para dizer para que o projeto existe, o que entra e o que fica de fora do escopo, quem participa e os marcos
   - [ ] Para substituir o quadro de atividades
   > É o *project charter* do PMBOK: o documento que autoriza o projeto e o torna igual para todos que trabalham nele.

3. Você trabalha num projeto, mas não consegue ler os arquivos controlados dele. Qual é o motivo mais provável?
   - [x] Você ainda não está no grupo da equipe do projeto
   - [ ] O portal esconde os arquivos de quem é novo
   - [ ] Os arquivos controlados só abrem para o supervisor
   > Os arquivos controlados do projeto são da equipe, e a equipe é o grupo `NRO_PROJECT_<CÓDIGO>`. Peça ao supervisor para incluir você.

# O quadro: Kanban

Ao fim deste módulo, você usa o quadro de atividades do seu grupo como a indústria usa um quadro Kanban.

**Kanban** é "cartão" ou "sinal visual" em japonês. O método nasceu na Toyota, com Taiichi Ohno, como parte do Sistema Toyota de Produção — a origem do que hoje se chama *lean*. Nos anos 2000 foi levado ao trabalho de conhecimento, em software e em projetos. Três ideias o sustentam:

- **Tornar o trabalho visível.** O que não está no quadro não existe para a equipe.
- **Limitar o trabalho em andamento.** Começar muitas coisas ao mesmo tempo é o jeito mais rápido de não terminar nenhuma. O lema é *pare de começar, comece a terminar*.
- **Puxar, não empurrar.** Quem termina puxa a próxima tarefa, em vez de receber uma pilha.

## As colunas

Em **Atividades**, cada grupo tem o seu quadro, e cada atividade, um código (`ORT-14`):

| Coluna | O que é |
|---|---|
| **Backlog** | o que precisa ser feito um dia, ainda sem prioridade para agora |
| **A fazer** | o que a equipe se comprometeu a fazer neste ciclo |
| **Em andamento** | o que alguém está fazendo agora |
| **Em revisão** | pronto, esperando outra pessoa conferir |
| **Concluída** | feito e conferido |

Só quem está no grupo move as atividades dele.

## Uma boa atividade

- **O título é uma ação:** "Calibrar o encoder do protótipo", não "Encoder".
- **A descrição diz quando está pronta** — o *critério de pronto*. "Calibrado, com o relatório de teste enviado" não deixa dúvida.
- **Tem responsável, prazo e prioridade** — baixa, média, alta ou urgente — e, se der, a **estimativa** em horas.
- **Cabe em poucos dias.** Se não cabe, quebre em várias.

## Quando trava

- **Comente** e marque quem precisa saber: a pessoa é notificada.
- **Siga** uma atividade para ser avisado do que acontece com ela.
- **Sinalize** quando ela precisa de atenção: quem a segue é avisado e, se houver responsável, o gestor dele também. É assim que se escala um problema — cedo, com o motivo escrito.

Em **Atividades › Carga da equipe**, cada pessoa aparece com as atividades abertas, as atrasadas, as sinalizadas e as horas estimadas. É ali que se vê quem está sobrecarregado antes que isso vire atraso.

[VÍDEO A GRAVAR: NRO-TRE-006/V2 — criar uma atividade com critério de pronto, movê-la pelo quadro, comentar marcando alguém, sinalizar e ver a carga da equipe]

## Links relacionados

- [Atividades](#/atividades) — o quadro do seu grupo.
- [Carga da equipe](#/atividades/carga) — quanto cada pessoa está carregando.

## Verificação de conhecimento

1. Qual destes títulos de atividade está melhor escrito?
   - [ ] Encoder
   - [ ] Ver aquela coisa do encoder
   - [x] Calibrar o encoder do protótipo
   > Um título é uma ação: diz o que fazer e em quê. O critério de pronto vai na descrição.

2. Quais são ideias centrais do Kanban? {multipla}
   - [x] Tornar o trabalho visível
   - [x] Limitar o trabalho em andamento
   - [x] Puxar a próxima tarefa quando termina a atual
   - [ ] Começar o máximo de tarefas ao mesmo tempo
   > Muitas tarefas abertas ao mesmo tempo é o jeito mais rápido de não terminar nenhuma.

3. A sua atividade está parada há uma semana esperando um fornecedor. O que faz?
   - [ ] Espera: uma hora o fornecedor responde
   - [x] Sinaliza a atividade, escrevendo o motivo
   - [ ] Move a atividade de volta para o Backlog sem avisar
   > Sinalizar avisa quem segue a atividade e o gestor do responsável. Escalar cedo é o que dá tempo de resolver.

# Scrum e as cerimônias

Ao fim deste módulo, você sabe para que serve cada cerimônia do Scrum e como o seu grupo as coloca na agenda.

O nome vem do rúgbi — a formação em que o time avança junto. Foi usado pela primeira vez para desenvolvimento de produtos por Hirotaka Takeuchi e Ikujiro Nonaka, num artigo de 1986 na Harvard Business Review que estudava como Honda, Canon e Fuji-Xerox desenvolviam produtos. Em 1995, Ken Schwaber e Jeff Sutherland apresentaram o Scrum como método, e hoje ele é o framework ágil mais usado do mundo. As regras estão no **Scrum Guide**, curto e gratuito.

## O ciclo

O trabalho acontece em **sprints**: ciclos de duração fixa, de no máximo um mês — em times de estudantes, costuma ser de duas semanas. Cada sprint tem uma **meta** e termina com algo que funciona e pode ser mostrado.

| Cerimônia | Para quê | No portal |
|---|---|---|
| **Planejamento da sprint** | escolher o que entra na sprint e a meta dela | *Abertura de sprint* |
| **Daily** | 15 minutos para o time se alinhar: o que avançou, o que vem, o que trava | *Daily* |
| **Review** | mostrar o que foi feito a quem interessa e colher retorno | *Review* |
| **Retrospectiva** | olhar para o próprio jeito de trabalhar e escolher o que melhorar | *Retrospectiva* |

O portal tem também o **fechamento de sprint**, para o time fechar a sprint junto.

A retrospectiva é a mais esquecida e a mais importante: é nela que o time melhora. Uma pergunta basta para começar — *o que faremos diferente na próxima sprint?*

## Os papéis

- **Product Owner** — decide a ordem do backlog: o que tem mais valor vem primeiro.
- **Scrum Master** — cuida para que o Scrum funcione e remove o que atrapalha o time.
- **Desenvolvedores** — quem faz o trabalho da sprint. Em Scrum, não é só quem programa: é o engenheiro, o designer, quem faz o teste.

No quadro de Atividades, o **Backlog** é o backlog do produto, e **A fazer** é o que a sprint escolheu.

## As cerimônias na agenda

Em **Agenda › Cerimônias do grupo**, o próprio time escolhe, para cada cerimônia, os dias, o horário, a duração, a repetição — semanal, quinzenal ou mensal — e o link do Meet. O portal cria os encontros e convida quem está no grupo. Mudou o horário? Reconfigure, e os encontros futuros são refeitos.

[VÍDEO A GRAVAR: NRO-TRE-006/V3 — configurar a daily e a retrospectiva de um grupo em Cerimônias do grupo e ver os encontros aparecerem na agenda]

> **Dica:** o Scrum Guide pede uma daily todos os dias úteis. Um time de estudantes, com aulas no meio, pode escolher dias fixos da semana — o portal deixa. Adaptar é normal; perder a inspeção e a adaptação, não.

## Links relacionados

- [Scrum Guide](https://scrumguides.org/) — as regras do Scrum, pelos autores.
- [Agenda](#/agenda) — as cerimônias do seu grupo, com os demais compromissos.
- [Gestão de tempo e agenda](treinamento:NRO-TRE-002) — como marcar reuniões que valem o tempo.

## Verificação de conhecimento

1. Para que serve a retrospectiva?
   - [ ] Para mostrar o produto aos parceiros
   - [x] Para o time olhar o próprio jeito de trabalhar e escolher o que melhorar
   - [ ] Para distribuir as tarefas da próxima sprint
   > Mostrar o produto é a review; escolher o trabalho é o planejamento. A retrospectiva é sobre o processo.

2. Quem configura as cerimônias de um grupo no portal?
   - [ ] Só o Depto. de Pessoal
   - [x] Quem está no grupo
   - [ ] O PMO
   > O time escolhe o próprio horário. O Depto. de Pessoal também pode ajudar, mas a decisão é do time.

3. Verdadeiro ou falso: {vf}
   - [V] Uma sprint dura no máximo um mês.
   - [F] Em Scrum, desenvolvedor é só quem programa.
   - [V] O Backlog do quadro de Atividades faz o papel do backlog do produto.
   > Desenvolvedor, no Scrum, é todo mundo que faz o trabalho da sprint — engenharia, design, testes.

# OKRs: do objetivo à tarefa

Ao fim deste módulo, você entende como os objetivos da equipe se desdobram até o seu trabalho e escreve um objetivo que dá para medir.

Os **OKRs** — *Objectives and Key Results*, objetivos e resultados-chave — foram criados por Andy Grove na Intel, nos anos 1970. John Doerr, que os aprendeu lá, levou-os ao Google em 1999, quando a empresa tinha cerca de quarenta pessoas, e o Google os usa até hoje. O livro dele, *Measure What Matters* (*Avalie o que importa*), espalhou o método por empresas de todos os tamanhos.

A ideia cabe numa frase: **vou [objetivo], medido por [resultados-chave]**.

- O **objetivo** é qualitativo e diz aonde se quer chegar.
- Os **resultados-chave** são mensuráveis e dizem como saber que se chegou. Se não dá para medir, não é resultado-chave.

## O desdobramento no portal

Em **OKRs**, os objetivos formam uma árvore:

| Nível | Código | Exemplo |
|---|---|---|
| **Estratégico** | `OE1` | Consolidar a NeuroDynamics como referência em reabilitação assistida |
| **Tático** | `OT1.2` | Validar o protótipo da órtese com usuários até o terceiro trimestre |
| **Operacional** | `OP1.2.1` | Concluir dez sessões de teste com voluntários até 30 de agosto |

Cada objetivo tem **eixo**, **responsáveis**, **prazo**, **status** — não iniciado, em andamento, em risco, concluído ou cancelado — e comentários, que são o registro do acompanhamento. O progresso de um objetivo é a parte dos objetivos da ponta, abaixo dele, que já está concluída.

O campo **Descrição / critério de sucesso** é onde mora o resultado-chave: escreva ali o número que prova que o objetivo foi alcançado.

## Do objetivo ao quadro

Os objetivos operacionais viram atividades nos quadros dos grupos. O caminho vale nos dois sentidos: toda atividade importante deveria responder a um objetivo. Se uma atividade não responde a nenhum, vale perguntar por que ela está sendo feita.

[VÍDEO A GRAVAR: NRO-TRE-006/V4 — navegar pela árvore de OKRs, do estratégico ao operacional, e registrar um comentário de acompanhamento com a mudança de status]

> **Atenção:** um objetivo em risco não é um fracasso: é uma informação. Mudar o status para **em risco** a tempo é o que permite à equipe ajudar.

## Links relacionados

- [OKRs](#/okrs) — os objetivos da equipe e o desdobramento de cada um.
- [What Matters](https://www.whatmatters.com/) — o site de John Doerr sobre OKRs, com exemplos.

## Verificação de conhecimento

1. Qual destes é um bom resultado-chave?
   - [ ] Melhorar o protótipo
   - [ ] Trabalhar mais no projeto
   - [x] Concluir dez sessões de teste com voluntários até 30 de agosto
   > Resultado-chave se mede: tem número e prazo. "Melhorar" e "trabalhar mais" não dizem quando se chegou.

2. Onde se registra, no portal, o que prova que um objetivo foi alcançado?
   - [x] No campo Descrição / critério de sucesso do objetivo
   - [ ] No título do projeto
   - [ ] Numa mensagem ao supervisor
   > O critério de sucesso é o resultado-chave do objetivo: fica junto dele, à vista de todos.

3. Verdadeiro ou falso: {vf}
   - [V] Os OKRs nasceram na Intel e foram levados ao Google em 1999.
   - [F] Mudar um objetivo para "em risco" é admitir fracasso e deve ser evitado.
   - [V] O progresso de um objetivo vem dos objetivos da ponta concluídos abaixo dele.
   > Em risco é informação, e dada a tempo é o que permite ajudar.

# Requisitos, riscos e verificação

Ao fim deste módulo, você conhece o ciclo de documentos que leva um dispositivo da ideia ao teste e por que cada um existe.

Um dispositivo médico não pode só funcionar: é preciso **provar** que ele faz o que deve, para quem deve, sem riscos inaceitáveis. É isso que a ISO 13485 pede no projeto e desenvolvimento, e que reguladores como a ANVISA e a FDA cobram. A NeuroDynamics segue o mesmo caminho, com os documentos da série `PRO`.

## O caminho

| Etapa | A pergunta | O documento |
|---|---|---|
| **Requisitos** | o que o usuário e o sistema precisam? | a [USRS](arquivo:NRO-PRO-004) |
| **Riscos** | o que pode dar errado, e com que gravidade? | a [matriz de riscos](arquivo:NRO-PRO-006) |
| **Projeto** | que decisões tomamos, e por quê? | o [design record](arquivo:NRO-PRO-014) e o [ADR](arquivo:NRO-PRO-013) |
| **Verificação** | o que construímos atende aos requisitos? | o [relatório de testes](arquivo:NRO-PRO-003) |
| **Validação** | atende ao usuário, no uso real? | o [plano de validação](arquivo:NRO-PRO-005) |
| **Rastreabilidade** | cada requisito foi testado? | a [matriz de rastreabilidade](arquivo:NRO-PRO-011) |

## Verificar e validar

Barry Boehm, pioneiro da engenharia de software, resumiu a diferença em duas perguntas:

- **Verificação:** *estamos construindo o produto do jeito certo?* — ele atende aos requisitos escritos?
- **Validação:** *estamos construindo o produto certo?* — ele resolve o problema de quem vai usá-lo?

Um dispositivo pode passar em todos os testes de bancada e, ainda assim, não servir ao paciente. Por isso as duas existem.

## Riscos

A gestão de riscos de dispositivos médicos segue a **ISO 14971**: identificar o que pode causar dano, estimar a probabilidade e a gravidade, reduzir o risco e verificar que a redução funcionou. Um risco anotado cedo custa uma linha na matriz. Descoberto num teste com voluntário, pode custar muito mais.

## Rastrear

A matriz de rastreabilidade liga cada requisito ao risco que ele trata, à decisão de projeto que o atende e ao teste que o prova. Quando um requisito muda, ela mostra tudo o que precisa ser revisto. Quando um auditor pergunta "como vocês sabem que isso funciona?", ela é a resposta.

> **Importante:** documentar não é burocracia depois do trabalho: é o trabalho deixando rastro. Um teste sem relatório, para qualquer auditor, não aconteceu.

## Links relacionados

- [USRS](arquivo:NRO-PRO-004) — os requisitos de usuário e de sistema.
- [Relatório de execução de testes](arquivo:NRO-PRO-003) — o registro de cada teste.
- [ISO 13485](https://www.iso.org/standard/59752.html) — a norma de gestão da qualidade de dispositivos médicos.

## Verificação de conhecimento

1. Qual é a diferença entre verificação e validação?
   - [ ] São a mesma coisa com nomes diferentes
   - [x] Verificação confere se o produto atende aos requisitos; validação confere se ele resolve o problema do usuário
   - [ ] Verificação é feita pelo usuário, e validação, pela equipe
   > Construir o produto do jeito certo e construir o produto certo: um dispositivo pode passar na bancada e não servir ao paciente.

2. Para que serve a matriz de rastreabilidade? {multipla}
   - [x] Ligar cada requisito ao teste que o prova
   - [x] Mostrar o que precisa ser revisto quando um requisito muda
   - [x] Responder a um auditor como se sabe que algo funciona
   - [ ] Registrar as horas trabalhadas no projeto
   > A rastreabilidade liga requisito, risco, projeto e teste. Horas ficam no quadro, como estimativa.

3. Qual norma trata da gestão de riscos de dispositivos médicos?
   - [ ] ISO 9001
   - [x] ISO 14971
   - [ ] ISO/IEC 27001
   > A ISO 9001 é de qualidade em geral, e a ISO/IEC 27001, de segurança da informação. A de riscos de dispositivos médicos é a ISO 14971.
