---
titulo: Confidencialidade da informação
codigo: NRO-TRE-005
resumo: O que é conhecimento sensível, por que uma equipe de estudantes tem o que proteger, como o SOMA classifica a informação e como se defender de engenharia social, de descuidos nas redes e de vazamento de dados pessoais. Com base no Programa Nacional de Proteção do Conhecimento Sensível, da ABIN.
categoria: Segurança
carga_horaria: 60
nota_minima: 80
validade_meses: 12
---

# O que nós temos a proteger

Ao fim deste módulo, você reconhece o conhecimento sensível da NeuroDynamics e entende por que protegê-lo é parte do trabalho.

A Agência Brasileira de Inteligência (ABIN) mantém, desde 1997, o **Programa Nacional de Proteção do Conhecimento Sensível (PNPC)**. É uma consultoria que a agência leva a instituições que detêm conhecimento estratégico — centros de pesquisa, universidades, empresas de tecnologia — para protegê-lo contra espionagem, sabotagem e vazamento. Boa parte deste treinamento vem das cartilhas do PNPC.

O PNPC trabalha com um conceito: **conhecimento sensível** é *"todo conhecimento, sigiloso ou estratégico, cujo acesso não autorizado pode comprometer a consecução dos objetivos nacionais e resultar em prejuízos ao País, necessitando de medidas especiais de proteção"*.

Troque "País" por "equipe" e a definição serve para nós. Uma equipe de estudantes tem, sim, o que proteger:

- **o que os projetos ainda não tornaram público** — o projeto de um dispositivo, um algoritmo, um resultado de teste;
- **o que pode virar patente** — e deixa de poder se for divulgado antes da hora;
- **o que os parceiros nos confiaram** — o LABBIO, a Visuri e outros abrem as portas sob termo de sigilo;
- **os dados de pessoas** — voluntários de testes, pacientes, os próprios membros.

## Confidencialidade, integridade, disponibilidade

A segurança da informação protege três coisas, a tríade que a ISO/IEC 27001 — a norma internacional de segurança da informação, adotada por bancos, hospitais e empresas de tecnologia no mundo todo — usa como base:

| | Quer dizer | Quando falha |
|---|---|---|
| **Confidencialidade** | só lê quem pode | o projeto aparece num post antes da hora |
| **Integridade** | a informação é a certa, sem alteração indevida | alguém edita a planilha de resultados sem registro |
| **Disponibilidade** | quem pode, consegue ler quando precisa | o único arquivo estava no computador de quem saiu |

Este treinamento trata sobretudo da primeira. O [treinamento de documentação](treinamento:NRO-TRE-003) cuida das outras duas.

> **Importante:** na maior parte das vezes, o vazamento não vem de um espião. Vem de um descuido: um link aberto para qualquer pessoa, uma foto com a tela ao fundo, uma conversa no ônibus. Por isso a proteção é trabalho de cada um — e o PNPC começa sempre pela sensibilização das pessoas.

## Links relacionados

- [O que é o PNPC](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/o-que-e-1) — o programa da ABIN, com os objetivos.
- [As fases do PNPC](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/fases-do-pnpc) — sensibilização, avaliação de riscos e acompanhamento.
- [Boas práticas do PNPC](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boas-praticas-1) — as cartilhas de proteção, para ler inteiras.

## Verificação de conhecimento

1. O que é conhecimento sensível, na definição do PNPC?
   - [ ] Qualquer informação pessoal de um membro
   - [x] O conhecimento, sigiloso ou estratégico, cujo acesso não autorizado pode causar prejuízo e que precisa de medidas especiais de proteção
   - [ ] Só os documentos que o governo classifica como secretos
   > A definição não se limita a documentos do governo: o que conta é o prejuízo que o acesso indevido pode causar.

2. O que a NeuroDynamics tem a proteger? {multipla}
   - [x] O que os projetos ainda não tornaram público
   - [x] O que os parceiros nos confiaram sob termo de sigilo
   - [x] Os dados de voluntários, pacientes e membros
   - [ ] Nada: somos uma equipe de estudantes
   > Projeto não divulgado, informação de parceiro e dado pessoal são conhecimento sensível — numa equipe de estudantes ou numa multinacional.

3. Verdadeiro ou falso: {vf}
   - [V] A maior parte dos vazamentos vem de descuidos, não de espionagem.
   - [F] Segurança da informação é assunto só de quem cuida da TI.
   - [V] Integridade quer dizer que a informação é a certa, sem alteração indevida.
   > Por isso o PNPC começa pela sensibilização das pessoas: cada membro é parte da proteção.

# Quem lê o quê

Ao fim deste módulo, você sabe como o SOMA classifica a informação, como pedir um acesso e e por que o seu termo de sigilo continua valendo depois.

## A necessidade de conhecer

Órgãos de inteligência, bancos e hospitais trabalham com um princípio: **cada pessoa tem acesso ao que precisa para o seu trabalho — e só a isso**. É a *necessidade de conhecer*. Não é desconfiança: é que cada acesso a mais é uma porta a mais para vazar, e ninguém consegue proteger o que nem sabe que tem.

A ISO/IEC 27001 pede que a informação seja **classificada**, para que todo mundo saiba o cuidado que cada uma exige. No SOMA, cada série de arquivos tem uma classe:

| Classe | Quem lê o conteúdo |
|---|---|
| **Público** | toda a equipe |
| **Controlado** | quem está no grupo do emissor, na equipe do projeto, no grupo revisor ou num grupo de leitura |
| **Confidencial** | só os grupos de leitura e o grupo revisor |

Os **metadados** — o código, o título, a revisão, o status — ficam à vista de toda a equipe, mesmo num arquivo confidencial. Abra o [quadro de pessoal](arquivo:NRO-PES-005): você vê que ele existe e qual é a revisão vigente, mas não o conteúdo. Saber que um documento existe é o que permite pedir acesso a ele quando for preciso.

> **Atenção:** "público" no SOMA quer dizer **público para a equipe**, não para a internet. O que pode sair da equipe está nas [informações públicas de projetos](arquivo:NRO-MKT-002).

## Pedir um acesso

Precisa ler um arquivo, entrar numa pasta do Drive ou num repositório? Abra uma **Solicitação de acesso** em *Serviços*. Diga **por que** e **por quanto tempo**: é com isso que o Depto. de Pessoal decide. Cada acesso concedido fica registrado na sua ficha. E quando alguém sai da equipe, o portal aponta os acessos que continuam ativos, para que sejam revogados — acesso esquecido é porta aberta.

[VÍDEO A GRAVAR: NRO-TRE-005/V1 — ver a classe de um arquivo em Arquivos, entender por que o conteúdo não abre e pedir o acesso por uma Solicitação de acesso]

## O termo de sigilo

O termo de sigilo da NeuroDynamics — e o de cada parceiro com quem você trabalha, como o LABBIO e a Visuri — fica registrado na sua ficha, junto com os acessos. Para trabalhar no LABBIO, o termo é enviado pelo [formulário do termo de sigilo](arquivo:NRO-PES-016). Se você ainda não assinou o da NeuroDynamics, fale com o Depto. de Pessoal.

O dever de sigilo **não acaba quando você sai**. A própria Lei de Propriedade Industrial (Lei 9.279/1996, art. 195, XI) trata como concorrência desleal divulgar a informação confidencial a que se teve acesso por contrato, mesmo depois do fim dele.

## Links relacionados

- [Solicitação de acesso](#/servicos/acesso) — para pedir acesso a um documento, sistema ou local.
- [Formulário do termo de sigilo do LABBIO](arquivo:NRO-PES-016) — o envio do termo para trabalhar no laboratório.
- [Política de acesso ao LABBIO](arquivo:NRO-PES-015) — as regras do laboratório.

## Verificação de conhecimento

1. Um arquivo é da classe confidencial. Quem lê o conteúdo?
   - [ ] Toda a equipe
   - [ ] Quem está no grupo do emissor
   - [x] Só os grupos de leitura e o grupo revisor
   > Na classe confidencial, nem o grupo do emissor lê por padrão: só os grupos de leitura escolhidos e o grupo revisor.

2. Você precisa de um documento que não abre para você. O que faz?
   - [ ] Pede para um colega que tem acesso baixar e mandar pelo WhatsApp
   - [x] Abre uma Solicitação de acesso dizendo por que e por quanto tempo precisa
   - [ ] Espera alguém perceber e liberar
   > O colega que repassa o arquivo fura a necessidade de conhecer e deixa uma cópia fora de controle. A Solicitação de acesso é registrada e decidida por quem responde por aquilo.

3. Verdadeiro ou falso: {vf}
   - [F] "Público" no SOMA quer dizer que o arquivo pode ir para a internet.
   - [V] O código e o título de um arquivo confidencial ficam à vista da equipe.
   - [F] O dever de sigilo acaba quando você sai da equipe.
   > "Público" é público para a equipe. Os metadados ficam à vista para que se saiba o que pedir. E o sigilo continua depois da saída.

# Engenharia social

Ao fim deste módulo, você reconhece uma tentativa de engenharia social e sabe o que fazer diante de uma.

Não é preciso invadir um sistema quando basta **pedir**. A cartilha de engenharia social do PNPC define: é o uso de **dissimulação, manipulação ou exploração da confiança**, sem violência, para que a própria pessoa entregue a informação — por vontade própria, sem perceber o que está fazendo.

Funciona porque explora o que temos de melhor: a vontade de ajudar, o respeito à hierarquia, a curiosidade. É por isso que grandes empresas fazem simulações de phishing com os próprios funcionários: o elo mais visado é o humano.

## Rede e arpão

- **Phishing** é a **rede**: a mesma mensagem para milhares de pessoas, esperando que alguém morda — "sua conta será bloqueada", "você ganhou um prêmio".
- **Spearphishing** é o **arpão**: uma mensagem feita para você, com o seu nome, o nome do seu projeto, o nome da sua coordenadora. Quem manda pesquisou antes — muitas vezes nas nossas próprias redes.

Um exemplo de arpão: *"Oi, aqui é da equipe da Visuri. A Profa. pediu para você me mandar a última versão do relatório de testes do projeto, a reunião é daqui a meia hora."* Tem nome certo, tem urgência, tem autoridade. E pode ser falso.

## Os sinais

| Sinal | Como aparece |
|---|---|
| **Urgência** | "é para agora", "senão o acesso é bloqueado" |
| **Autoridade** | "a coordenação pediu", "é da diretoria" |
| **Canal estranho** | um pedido de trabalho pelo número pessoal, por um e-mail que não é o institucional |
| **Pedido fora do normal** | senha, código de verificação, um arquivo que a pessoa teria como pedir pelo portal |
| **Curiosidade ou prêmio** | "veja quem comentou sobre você", "clique para receber" |

[VÍDEO A GRAVAR: NRO-TRE-005/V2 — dissecar na tela um e-mail de phishing e uma mensagem de spearphishing de exemplo, apontando cada sinal]

## O que fazer

- **Confirme por outro canal.** Recebeu um pedido estranho "da coordenação"? Pergunte à coordenação — pelo contato que você já tem, não pelo que veio na mensagem.
- **Não clique, não baixe, não responda** até ter certeza.
- **Ninguém da equipe vai pedir a sua senha** nem o código de verificação da sua conta. Quem pede, não é da equipe.
- **Ative a verificação em duas etapas** na conta Google da NeuroDynamics e nas contas das redes da equipe.
- **Avise.** Conte ao seu gestor imediato e à liderança do projeto. A tentativa que você recebeu provavelmente chegou a outras pessoas.

## Links relacionados

- [Cartilha de engenharia social](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/cartilha-engenharia-social-guia-para-protecao-de-conhecimentos-sensiveis) — o guia do PNPC sobre o tema.
- [Segurança na internet](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/seguranca-na-internet-guia-para-protecao-de-conhecimentos-sensiveis.pdf) — o guia do PNPC para e-mail, senhas e navegação.

## Verificação de conhecimento

1. Qual é a diferença entre phishing e spearphishing?
   - [ ] O phishing é por e-mail e o spearphishing, por telefone
   - [x] O phishing é a mesma mensagem para muita gente; o spearphishing é feito para uma pessoa, com informações sobre ela
   - [ ] O spearphishing é inofensivo
   > Rede e arpão: o spearphishing usa o que o atacante descobriu sobre você e a instituição, e por isso é muito mais convincente.

2. Uma mensagem pelo seu número pessoal diz ser da coordenação e pede, com urgência, o relatório de testes de um projeto. Quais sinais de engenharia social ela tem? {multipla}
   - [x] Urgência
   - [x] Autoridade
   - [x] Canal estranho
   - [ ] Nenhum: a coordenação pode pedir o que quiser
   > Urgência, autoridade e um canal fora do normal juntos são o retrato da engenharia social. Confirme com a coordenação pelo contato que você já tem.

3. Alguém diz ser do suporte e pede o código de verificação que chegou no seu celular. O que você faz?
   - [ ] Passa o código, porque é do suporte
   - [x] Não passa o código e avisa o seu gestor imediato
   - [ ] Passa o código só se a pessoa souber o seu nome completo
   > Ninguém da equipe pede senha nem código de verificação. Saber o seu nome não prova nada: o spearphishing se baseia justamente no que dá para descobrir sobre você.

# Redes, conversas e eventos

Ao fim deste módulo, você publica e conversa sobre o seu trabalho sem entregar o que não deve.

## O que as redes contam

A cartilha de redes sociais do PNPC lembra que cada publicação, somada às outras, conta uma história — e que quem pesquisa antes de um spearphishing começa por aí. Antes de publicar:

- **A localização em tempo real.** Pense bem antes de dizer onde você está *agora*. Poste depois.
- **O fundo da foto.** Uma tela aberta, um quadro branco, uma bancada com o protótipo, um crachá. Olhe o fundo antes do rosto.
- **O detalhe demais.** "Estou no projeto X" é ótimo. "Estou no projeto X, que usa o sensor Y com o parceiro Z para resolver W" pode ser o que o projeto ainda não tornou público.
- **O perfil que chega do nada.** Serviços de inteligência como o MI5 britânico já alertaram publicamente para perfis falsos de recrutadores no LinkedIn usados para se aproximar de pesquisadores. Uma proposta boa demais, de alguém que você não conhece, pedindo detalhes do seu trabalho, merece desconfiança.

O [treinamento de redes sociais](treinamento:NRO-TRE-004) mostra como a equipe publica pelo Studio, com aprovação.

## Conversas

O bandejão, o ônibus, a fila do evento. Uma conversa sobre o projeto em lugar público é ouvida por quem está perto — e você não sabe quem é. Fale do assunto, não dos detalhes. Numa ligação de trabalho, procure um lugar reservado.

## Eventos e publicações

Um pôster, uma apresentação, um artigo, um vídeo no YouTube: tudo isso é **divulgação pública**. E divulgação conta contra uma patente.

- No Brasil, a Lei de Propriedade Industrial (Lei 9.279/1996, art. 12) dá um **período de graça** de 12 meses: a divulgação feita pelo próprio inventor até 12 meses antes do pedido não destrói a novidade.
- Em boa parte do mundo, **não há** esse período — na Europa, por exemplo. Publicar antes de depositar pode custar a patente lá fora.

Por isso, antes de apresentar um resultado de projeto fora da equipe, **confira com a liderança do projeto** se ele pode sair e se há pedido de patente a fazer antes — na UFMG, com a CTIT, o núcleo de inovação tecnológica. Na indústria, nenhum engenheiro apresenta um resultado em congresso sem a liberação do jurídico de propriedade intelectual.

## Links relacionados

- [Redes sociais — guia do PNPC](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/redessociais_27062022.pdf) — os cuidados da ABIN com redes sociais.
- [Informações públicas de projetos](arquivo:NRO-MKT-002) — o que de cada projeto já pode sair.
- [Política de redes sociais](arquivo:NRO-MKT-001) — como a equipe se apresenta nas redes.

## Verificação de conhecimento

1. Você quer postar uma foto sua na bancada do laboratório. O que confere antes? {multipla}
   - [x] O que aparece nas telas e no quadro ao fundo
   - [x] Se o protótipo que aparece já é público
   - [x] Se vale postar a localização só depois
   - [ ] Nada, se o post for no seu perfil pessoal
   > O perfil pessoal também é lido por quem pesquisa a equipe. O fundo da foto e a localização em tempo real contam mais do que parece.

2. Um projeto quer apresentar um resultado num congresso internacional. O que vem antes?
   - [ ] Nada: congresso é ambiente acadêmico e não conta como divulgação
   - [x] Conferir com a liderança do projeto se o resultado pode sair e se há patente a pedir antes
   - [ ] Pedir a patente depois do congresso, porque o Brasil dá 12 meses de graça
   > Apresentar em congresso é divulgação pública. O período de graça brasileiro não vale em boa parte do mundo, e a patente no exterior pode se perder.

3. Verdadeiro ou falso: {vf}
   - [V] Um pôster num congresso é divulgação pública.
   - [F] Conversar sobre os detalhes do projeto no ônibus não tem risco, porque ninguém entende.
   - [V] Perfis falsos de recrutadores já foram usados para se aproximar de pesquisadores.
   > Você não sabe quem está ouvindo, nem o que a pessoa entende. Fale do assunto, não dos detalhes.

# Dados pessoais e a LGPD

Ao fim deste módulo, você trata os dados de voluntários, pacientes e colegas como a lei pede e sabe o que fazer quando algo vaza.

## O que a lei diz

A **Lei Geral de Proteção de Dados** (LGPD, Lei 13.709/2018) vale para qualquer organização que trata dados de pessoas — a NeuroDynamics incluída. Ela separa dois tipos:

- **Dado pessoal** — o que identifica uma pessoa ou permite identificá-la: nome, CPF, e-mail, matrícula, foto.
- **Dado pessoal sensível** (art. 5º, II) — entre outros, o dado **referente à saúde**, o **genético** e o **biométrico**. Exige cuidado redobrado.

Numa equipe de engenharia biomédica, dado sensível é rotina: o sinal de EMG de um voluntário, a ficha de um paciente, a biometria de acesso ao laboratório. É por isso que os relatórios do portal com dados pessoais saem marcados como **confidencial — LGPD**.

> **Nota:** quando um teste envolve pessoas, pergunte à liderança do projeto se ele tem a aprovação de um Comitê de Ética em Pesquisa. A pesquisa com seres humanos no Brasil segue a Resolução CNS 466/2012.

## Boas práticas

- **Colete só o necessário.** Se o teste precisa da idade, não peça o CPF.
- **Separe o nome do dado.** Identifique o voluntário por um código (`V-07`) e guarde a tabela que liga o código ao nome à parte, com acesso restrito.
- **Não leve para fora.** Dado de voluntário não vai para o computador pessoal, o pen drive, o WhatsApp ou o e-mail pessoal. Fica no Drive da equipe, na pasta com acesso controlado.
- **Apague o que não precisa mais**, quando o projeto disser que pode.
- **Colegas também são titulares.** O telefone, o endereço e o desempenho de um membro não se repassam.

## Quando algo vaza

Mandou a planilha para a pessoa errada? Perdeu o notebook com dados de um teste? Deixou o link da pasta aberto para qualquer pessoa?

**Avise na hora** o seu gestor imediato e a liderança do projeto. A LGPD (art. 48) obriga a organização a comunicar à Autoridade Nacional de Proteção de Dados e às pessoas afetadas o incidente que possa trazer risco ou dano relevante — e isso só é possível se quem viu o problema contar. Esconder um vazamento não o desfaz: só tira de quem pode agir o tempo de agir.

> **Importante:** quem avisa de um erro próprio está fazendo a coisa certa. Toda organização séria de saúde trata o relato de incidente como contribuição, não como culpa — é assim que se aprende a não repetir.

## Links relacionados

- [Lei Geral de Proteção de Dados](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm) — o texto da LGPD no Planalto.
- [Segurança na internet](https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/seguranca-na-internet-guia-para-protecao-de-conhecimentos-sensiveis.pdf) — o guia do PNPC para cuidar de arquivos e contas.

## Verificação de conhecimento

1. Quais destes são dados pessoais sensíveis, na LGPD? {multipla}
   - [x] O sinal de EMG de um voluntário
   - [x] A biometria de acesso ao laboratório
   - [x] O diagnóstico de um paciente
   - [ ] O nome do projeto em que um membro trabalha
   > Dado de saúde, genético e biométrico é sensível. O nome do projeto não é dado pessoal sensível.

2. Como guardar os dados de voluntários de um teste?
   - [ ] Numa planilha com nome, CPF e resultados, no computador de quem aplicou o teste
   - [x] Com um código no lugar do nome, e a tabela que liga código e nome à parte, com acesso restrito
   - [ ] No grupo de WhatsApp do projeto, para todo mundo achar fácil
   > Separar o nome do dado reduz o estrago de um vazamento, e o Drive da equipe controla quem acessa.

3. Você percebe que o link de uma pasta com dados de voluntários ficou aberto para qualquer pessoa. O que faz?
   - [ ] Fecha o link e não comenta, para não se complicar
   - [x] Fecha o link e avisa na hora o gestor imediato e a liderança do projeto
   - [ ] Espera a reunião geral para contar
   > A organização pode ter de comunicar o incidente à ANPD e às pessoas afetadas. Só dá para agir se quem viu contar — e logo.
