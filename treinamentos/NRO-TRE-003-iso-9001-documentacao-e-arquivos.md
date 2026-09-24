---
titulo: ISO 9001: documentação e o sistema de Arquivos
codigo: NRO-TRE-003
resumo: Por que a indústria documenta do jeito que documenta, a diferença entre documento e registro, e como achar, criar e revisar os arquivos da equipe no SOMA.
categoria: Projetos
carga_horaria: 55
---

# Por que documentar

Ao fim deste módulo, você sabe o que é a ISO 9001, por que ela importa para uma equipe que desenvolve tecnologia para a saúde e o que o sistema de Arquivos tem a ver com ela.

Qualidade, para a indústria, não é "fazer bem feito uma vez". É **conseguir repetir** o que deu certo — e provar que repetiu. Uma bancada de testes montada do mesmo jeito todas as vezes, um procedimento que qualquer membro novo consegue seguir, um teste que qualquer pessoa consegue refazer e chegar ao mesmo resultado. Nada disso acontece se o jeito de fazer mora só na cabeça de quem fez.

## A ISO 9001

A **ISO 9001** é a norma internacional de sistemas de gestão da qualidade, publicada pela ISO (a Organização Internacional de Normalização). É a norma de gestão mais usada do mundo: mais de um milhão de organizações seguem os requisitos dela — de montadoras e fabricantes de aviões a hospitais, universidades e empresas de software. A edição mais recente, a **ISO 9001:2026**, saiu em setembro de 2026.

Um dos requisitos centrais é o controle da **informação documentada** (a cláusula 7.5): todo documento que o trabalho usa precisa ser identificado, revisado e aprovado antes de valer, estar disponível para quem precisa, protegido contra alteração indevida e ter as suas versões controladas.

A edição de 2026 reforça dois pontos que valem para nós: a **cultura da qualidade** — as pessoas, em todos os níveis, vivendo esses cuidados no dia a dia — e **reter e compartilhar o conhecimento** da organização.

## Por que isso importa aqui

A NeuroDynamics é formada por estudantes, e estudante se forma. Todo semestre, alguém sai levando o que sabia e alguém chega sem saber nada. O documento é o que fica: é como o conhecimento de uma geração da equipe chega à seguinte.

E há um segundo motivo. Quem desenvolve dispositivos médicos segue a **ISO 13485**, a norma de qualidade do setor, construída sobre a mesma base da ISO 9001 — e ainda mais exigente com a documentação. As boas práticas de fabricação que a ANVISA cobra dos fabricantes vão na mesma direção, e desde fevereiro de 2026 a FDA, nos Estados Unidos, adota a ISO 13485 como base da sua própria regra de qualidade para dispositivos.

> **Nota:** o que você aprende aqui não é burocracia de laboratório. É o mesmo controle de documentos que uma Medtronic, uma Siemens Healthineers ou uma Embraer praticam — só que numa escala que cabe na equipe.

## Links relacionados

- [ISO 9001:2026](https://www.iso.org/standard/88464.html) — a página da norma, na ISO.
- [ISO 13485:2016](https://www.iso.org/standard/59752.html) — a norma de qualidade para dispositivos médicos.
- [Controle de documentos e registros](arquivo:NRO-PUB-001) — a lista de todos os arquivos da equipe.

## Verificação de conhecimento

1. Para a indústria, o que é qualidade?
   - [ ] Fazer um trabalho excelente uma vez
   - [x] Conseguir repetir o que deu certo e provar que repetiu
   - [ ] Ter o maior número possível de documentos
   > Qualidade é repetibilidade com evidência. Documento em excesso não é qualidade; o documento certo, controlado, é.

2. Por que a documentação importa ainda mais numa equipe de estudantes? {multipla}
   - [x] Porque as pessoas se formam e saem, e o documento é o que fica
   - [x] Porque dispositivos médicos seguem normas ainda mais exigentes com documentação, como a ISO 13485
   - [ ] Porque estudantes erram mais que profissionais
   > A rotatividade faz o conhecimento se perder se não estiver escrito, e o setor de saúde exige que o desenvolvimento seja documentado e rastreável.

3. Verdadeiro ou falso: {vf}
   - [V] A ISO 9001 pede que um documento seja revisado e aprovado antes de valer.
   - [F] A ISO 9001 vale só para fábricas.
   - [V] A ISO 13485, de dispositivos médicos, é construída sobre a mesma base da ISO 9001.
   > A ISO 9001 é usada por organizações de todo tipo — da indústria a hospitais e universidades. A ISO 13485 parte da mesma estrutura e acrescenta o que o setor de saúde exige.

# Documento e registro

Ao fim deste módulo, você distingue um documento de um registro e sabe o que cada um pode e não pode mudar.

A ISO 9001 separa a informação documentada em duas espécies, e o sistema de Arquivos segue a mesma separação.

| | Documento | Registro |
|---|---|---|
| **O que é** | diz **como fazer** | prova **o que foi feito** |
| **Exemplos** | política, procedimento, manual, template | ata, relatório de teste, formulário preenchido |
| **Muda?** | sim, por revisão: Rev. A, B, C… | não, depois de aprovado |
| **Na norma** | informação documentada que deve estar disponível | informação documentada disponível como evidência |

Um procedimento melhora com o tempo — por isso revisa. Uma ata de reunião de março registra o que se decidiu em março, e mudar isso seria reescrever a história. Por isso **registro não muda**: um erro num registro se corrige com **outro registro**, que diz o que estava errado.

## As três estruturas de uma série

No SOMA, cada espécie de arquivo é uma **série**, e toda série tem uma de três estruturas:

| Estrutura | O que é | Exemplo |
|---|---|---|
| **Documento único** | um documento para toda a equipe, sem template e sem exemplares | a [política de acesso ao LABBIO](arquivo:NRO-PES-015) |
| **Template → documentos** | um template, e cada exemplar é um documento que revisa por conta própria | o [termo de abertura de projeto](arquivo:NRO-PRO-001): um por projeto |
| **Template → registros** | um template, e cada exemplar é um registro que não muda depois de aprovado | a [ata de reunião](arquivo:NRO-PUB-003): uma por reunião |

O **template** é o modelo de onde os exemplares nascem, e ele também revisa. Quando o template da ata muda, as atas antigas continuam como foram feitas — cada uma diz qual revisão do template usou.

> **Dica:** na dúvida entre documento e registro, pergunte: "isto descreve como fazer, ou prova que foi feito?". A resposta decide.

## Links relacionados

- [Template de documentos e registros](arquivo:NRO-PUB-002) — o modelo de base de todos os arquivos da equipe.
- [Relatório de execução de testes](arquivo:NRO-PRO-003) — um exemplo de template de registros.
- [Templates](#/arquivos/templates) — todos os templates, e onde cada um é usado.

## Verificação de conhecimento

1. O relatório de um teste de bancada feito ontem é documento ou registro?
   - [ ] Documento, porque foi escrito num arquivo de texto
   - [x] Registro, porque prova o que foi feito
   - [ ] Depende de quem escreveu
   > Registro é evidência do que aconteceu. O formato do arquivo não muda o que ele é.

2. Você achou um erro de digitação numa ata aprovada no mês passado. O que faz?
   - [ ] Envia uma revisão B da ata com a correção
   - [ ] Apaga a ata e cria outra do zero
   - [x] Registra a correção num novo registro, que diz o que estava errado
   > Registro aprovado não recebe revisão. A correção vira outro registro, e a ata original continua mostrando o que foi aprovado na época.

3. Verdadeiro ou falso: {vf}
   - [V] O template de uma série também tem revisões.
   - [F] Quando o template muda, os exemplares antigos são atualizados sozinhos.
   - [V] Cada exemplar diz qual revisão do template usou.
   > O template revisa, mas o que já nasceu dele fica como foi feito — e registra de qual revisão do template veio.

# O código e a revisão

Ao fim deste módulo, você lê o código de um arquivo, sabe em que situação ele está e acha o que precisa em Arquivos.

## O código

Todo arquivo da equipe tem um código no formato `NRO-XXX-YYY-Z`:

| Parte | O que é | Exemplo |
|---|---|---|
| `XXX` | o **emissor**: o departamento que emite | `PES` (Pessoal), `PRO` (Pesquisa e Desenvolvimento), `CLI` (Clínico), `REL` (Relações Institucionais), `DIR` (Diretoria), `MKT` (Marketing), `PUB` (o que é de todos) |
| `YYY` | o **número de série**: a espécie de arquivo | `007`, o procedimento de desligamento |
| `Z` | o **exemplar**, quando a série tem mais de um | `3`, o termo de abertura de um projeto |

A **revisão** não entra no código — ela aparece ao lado: `NRO-PES-007 Rev. B`. É de propósito: o procedimento de desligamento continua sendo `NRO-PES-007` na Rev. A e na Rev. F, e é esse endereço que os outros arquivos, os links e os treinamentos citam.

## A situação de um arquivo

- **rascunho** — ainda não tem revisão aprovada;
- **em revisão** — há uma versão nova esperando aprovação (a anterior continua valendo);
- **ativo** — em vigor;
- **obsoleto** — substituído ou fora de uso. Não se usa.

## A lista mestra

A norma pede que se saiba, a qualquer momento, quais documentos existem e qual revisão de cada um está em vigor. É a **lista mestra**. Na equipe, ela era a planilha [NRO-PUB-001](arquivo:NRO-PUB-001) — e virou a primeira tela de **Arquivos**: todos os arquivos, com código, título, revisão, status e quem mexeu por último, com filtro por emissor.

A tela de cada arquivo responde, no alto, **o que é este arquivo**: template ou arquivo real, se tem exemplares, se pode ser alterado. Mais abaixo, de qual template e revisão ele nasceu, as **relações** com outros arquivos e o **registro de alterações** — quem criou, quem enviou e quem aprovou cada revisão.

[VÍDEO A GRAVAR: NRO-TRE-003/V1 — achar um arquivo em Arquivos e ler a tela dele: código, revisão, status e o registro de alterações]

## Links relacionados

- [Arquivos](#/arquivos) — a lista de todos os arquivos da equipe.
- [Visão geral](#/arquivos/visao) — os números de cada emissor.
- [Procedimento de desligamento](arquivo:NRO-PES-007) — um arquivo para abrir e explorar.

## Verificação de conhecimento

1. No código `NRO-PRO-001-3`, o que significa o `3`?
   - [ ] A terceira revisão do arquivo
   - [x] O terceiro exemplar da série, como o termo de abertura de um projeto
   - [ ] O terceiro departamento da equipe
   > O último número é o exemplar. A revisão fica fora do código, ao lado dele: `Rev. C`.

2. Por que a revisão não faz parte do código?
   - [ ] Porque o sistema não aceita letras no código
   - [x] Para que o arquivo continue com o mesmo endereço em qualquer revisão, e as citações não quebrem
   - [ ] Porque a revisão só importa para o PMO
   > O código identifica o arquivo; a revisão identifica a versão. Separar os dois mantém os links e as referências valendo.

3. Um arquivo está "em revisão". Qual versão vale enquanto isso?
   - [x] A última revisão aprovada
   - [ ] A versão nova, que está esperando aprovação
   - [ ] Nenhuma, até a aprovação sair
   > Nenhuma versão vale antes de ser aprovada. Enquanto a nova espera, a equipe continua usando a anterior.

# Criar e revisar

Ao fim deste módulo, você cria um arquivo a partir de um template, envia uma revisão e sabe como a aprovação funciona.

## Criar

Em **Arquivos**, **Adicionar** pergunta o que você quer antes de criar:

- **um exemplar de uma série que já existe** — por exemplo, a ata da reunião de hoje. Ele nasce do template, e a tela diz antes se vai ser documento ou registro;
- **uma série nova** — uma espécie de arquivo que a equipe ainda não tem. Isso é com o PMO, que escolhe a estrutura, a classe e o grupo que revisa.

Revisão nova de um arquivo que já existe **não é adicionar**: é **Submeter nova revisão**, na tela dele. Mesmo código, letra seguinte.

## Enviar uma revisão

1. Abra o arquivo e escolha **Submeter nova revisão** (na primeira vez, **Enviar a primeira versão**).
2. Suba o arquivo novo.
3. Diga **o que mudou**, em uma ou duas frases. "Os prazos da etapa 3 passaram a contar em dias úteis" ajuda quem revisa; "atualização" não.
4. Confira os **pais e os filhos** do arquivo: se o procedimento muda, o checklist que depende dele precisa mudar também? Para cada um, diga se **revisou junto** ou se **não precisa mudar**. O envio não sai sem essa conferência.

[VÍDEO A GRAVAR: NRO-TRE-003/V2 — criar um exemplar a partir do template e enviar uma revisão, com o que mudou e a conferência das relações]

## A aprovação: quatro olhos

A revisão enviada fica **pendente**, e o grupo revisor da série é avisado no sino e por e-mail. Ela só passa a valer quando **alguém do grupo revisor que não a enviou** aprova. É o **princípio dos quatro olhos**, usado em bancos, na aviação e na indústria de saúde: quem faz não é quem confere, porque o autor lê o que quis escrever, não o que escreveu.

- quem revisa **aprova** ou **devolve**, com o parecer;
- revisão devolvida **não gasta letra**: a próxima tentativa continua sendo a mesma revisão;
- o que você tem para revisar aparece em **Arquivos › Para revisar**.

[VÍDEO A GRAVAR: NRO-TRE-003/V3 — revisar uma versão: ler o que mudou, comparar e aprovar ou devolver com parecer]

> **Atenção:** registro aprovado não recebe revisão. Se algo num registro está errado, a correção é outro registro.

## Links relacionados

- [Para revisar](#/arquivos/revisoes) — as versões que esperam a sua revisão.
- [Checklist de organização de reunião geral](arquivo:NRO-PES-014) — um documento para ver as relações de perto.

## Verificação de conhecimento

1. O procedimento de admissão mudou. O que você faz no sistema?
   - [ ] Adicionar, criando um arquivo novo com o texto atualizado
   - [x] Submeter nova revisão, na tela do próprio procedimento
   - [ ] Substituir o arquivo no Drive e avisar no grupo
   > Mudança num documento que existe é revisão: mesmo código, letra seguinte, e a versão só vale depois de aprovada.

2. Quem pode aprovar a revisão que você enviou?
   - [ ] Você mesmo, se estiver no grupo revisor
   - [x] Outra pessoa do grupo revisor da série
   - [ ] Qualquer membro da equipe
   > O princípio dos quatro olhos: quem enviou não aprova. A aprovação é de alguém do grupo revisor (ou do PMO, quando a série não tem grupo revisor).

3. O que acompanha uma revisão enviada? {multipla}
   - [x] O que mudou, dito por quem enviou
   - [x] A conferência dos pais e dos filhos do arquivo
   - [ ] A aprovação automática depois de sete dias
   > Quem envia explica a mudança e confere o impacto nos arquivos relacionados. A aprovação nunca é automática.

# Boas práticas de documentação

Ao fim deste módulo, você escreve e guarda documentos e registros do jeito que uma auditoria esperaria encontrar.

## Registro que se sustenta: ALCOA

A indústria farmacêutica e a de dispositivos médicos resumem o que um bom registro precisa ter em cinco letras. A FDA usa a sigla **ALCOA** para definir integridade de dados:

| Letra | Quer dizer | Na prática |
|---|---|---|
| **A** — atribuível | dá para saber quem fez | o registro diz o autor, e o sistema guarda quem enviou e quem aprovou |
| **L** — legível | qualquer pessoa consegue ler | sem abreviação que só você entende |
| **C** — contemporâneo | registrado quando aconteceu | o relatório do teste se escreve no dia do teste, não uma semana depois |
| **O** — original | é o registro de verdade, ou uma cópia fiel | o que vale é o que está no sistema |
| **A** — exato | está correto e completo | o dado que falhou também entra |

## Hábitos que evitam problema

- **Um arquivo, um lugar.** O arquivo que vale é o que está em Arquivos. `relatorio_final_v3_agora_vai.docx` no grupo de mensagens não é versão de nada.
- **Baixou, consultou.** Uma cópia baixada ou impressa não é controlada: amanhã pode estar desatualizada. Antes de seguir um procedimento, confira a revisão em vigor.
- **Obsoleto não se usa.** Se o arquivo está obsoleto, procure o que o substituiu.
- **Use o template.** Ele garante o cabeçalho, o código e os campos que todo arquivo da equipe precisa ter.
- **Registre o que deu errado.** Um teste que falhou é informação valiosa. Esconder a falha é o erro mais caro que um registro pode ter.
- **Respeite a classe.** Cada série é pública, controlada ou confidencial, e isso decide quem lê o conteúdo. O treinamento de confidencialidade trata disso em detalhe.

> **Nota:** auditorias de qualidade costumam começar pedindo um registro qualquer e seguindo o fio: quem fez, com qual procedimento, em qual revisão, quem aprovou. Com o sistema de Arquivos, esse fio está na tela de cada arquivo.

## Links relacionados

- [Template de documentos e registros](arquivo:NRO-PUB-002) — o ponto de partida de todo arquivo.
- [Confidencialidade da informação](treinamento:NRO-TRE-005) — as classes e o cuidado com o que é sigiloso.

## Verificação de conhecimento

1. Você terminou um teste de bancada numa terça. Quando escreve o relatório?
   - [x] No mesmo dia, com os dados ainda à mão
   - [ ] Na semana seguinte, junto com os outros testes
   - [ ] Só se o teste tiver dado certo
   > Registro contemporâneo: escrito quando aconteceu, com tudo o que aconteceu — inclusive a falha.

2. Quais destes hábitos seguem as boas práticas? {multipla}
   - [x] Conferir a revisão em vigor antes de seguir um procedimento baixado há meses
   - [x] Registrar o resultado de um teste que falhou
   - [ ] Guardar a versão mais recente no grupo de mensagens do projeto
   - [x] Criar o arquivo a partir do template da série
   > O arquivo que vale é o do sistema, e a falha registrada é informação. Mensagem solta não é controle de versão.

3. Verdadeiro ou falso: {vf}
   - [V] "Atribuível" quer dizer que dá para saber quem fez o registro.
   - [F] Uma cópia impressa de um procedimento continua valendo mesmo depois de uma nova revisão.
   > A cópia impressa não acompanha as revisões. O que vale é a revisão em vigor, no sistema.
