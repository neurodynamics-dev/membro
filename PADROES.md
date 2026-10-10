# Padrões do sistema

Com a unificação, o que eram cinco apps vira um. Isto aqui é o que mantém
esse um coerente: como a navegação se organiza, como um módulo novo entra, o
que a busca encontra, como um objeto ganha identidade.

Regra geral: **quando algo aqui e o código discordarem, o código é o errado.**

---

## 1. Navegação: espaços, não departamentos

O menu antigo crescia por origem — "isto veio do SOMA, aquilo do Portal". Não
escala e não ajuda ninguém: a pessoa não pensa "preciso abrir o sistema de
gestão", pensa "preciso achar a ficha do Bruno".

A navegação passa a ser organizada por **o que você está fazendo**:

| Espaço | O que é | Quem vê |
|---|---|---|
| **Agenda** | tempo — eventos, marcos, ausências, e o que tem prazo (tarefas, publicações, treinamentos) | todos |
| **Atividades** | trabalho — o quadro do seu grupo | todos |
| **OKRs** | planejamento — os objetivos e o desdobramento de cada um | todos (edição: `admin`, `pessoal` e os responsáveis) |
| **Projetos** | cada projeto: equipe, supervisor e o rol de arquivos | todos (criar: PMO e `admin`; editar: eles e o supervisor) |
| **Arquivos** | documentos e registros controlados — código, revisão, status | todos no rol; o conteúdo segue a classe de cada série |
| **Studio** | comunicação — criar as peças, planejar e aprovar as publicações | os grupos de acesso e os aprovadores (Studio › Configurações), e `admin` |
| **Marca** | materiais, assinaturas, interfaces e manual da marca | todos; vínculos geridos por quem administra Arquivos |
| **Equipe** | pessoas — organograma, fichas, presença, reporte e feed | todos (a profundidade varia) |
| **Treinamentos** | formação — o que os seus grupos pedem, fazer, os certificados | todos (gerir: `admin`, `pessoal` e os grupos gestores) |
| **Serviços** | pedidos ao Depto. de Pessoal — e, em *Meus pedidos*, o andamento deles | todos |
| **Seleção** | os bastidores do processo seletivo | `admin`, `pessoal`, `selecao` |
| **Administração** | os painéis: portal, site, catálogo, importação, auditoria | `admin`, `pessoal` (e `selecao`, só Relatórios) |

O **início** — a sua semana: avisos, o que espera a sua ação, a semana na
agenda, o placar do LABBIO, as suas tarefas, os links úteis e o que você abriu
por último — não é item da lista: a logo no alto do menu leva a ele, e uma
casinha menor, ao lado dela, diz que leva. No trilho a casinha sai; a logo
basta. Um item "Início" repetiria o caminho da logo e empurraria os espaços
para baixo.

A ordem do primeiro nível é Agenda, Atividades, OKRs, Projetos, Arquivos,
Studio, Marca, Equipe, Treinamentos, Serviços, Seleção e Administração.
Studio, Seleção e Administração aparecem conforme as permissões. Marca
fica disponível para toda a equipe, entre Studio e Equipe. Novos destinos
precisam de revisão da arquitetura de navegação.
O segundo nível são os subitens de cada espaço — o calendário e
as configurações da Agenda, os quadros dos grupos da pessoa, cada serviço,
cada painel —, pendurados numa linha-guia debaixo do espaço, como
no painel da Cloudflare. Tudo o que tem endereço próprio vira subitem; o que
é filtro dentro de uma tela, não.

O menu **recolhe** para um trilho de ícones (a escolha fica no navegador de
cada pessoa; sem escolha, tela abaixo de 1280px começa recolhida). No
trilho, passar o mouse — ou chegar pelo Tab — num ícone abre os subitens ao
lado. Abaixo de 900px o menu vira gaveta, puxada pela barra de topo.

**Seletores dentro de uma tela.** Uma regra só, em todo espaço:

| Nível | Componente | Onde |
|---|---|---|
| 1 — as seções da tela | `.nav1`, o seletor segmentado com a pílula clara no item atual (`navNivel1()`) | as seções de um espaço (Arquivos, Studio, Treinamentos, Equipe, Seleção, Cofre, Eventos) ou de um objeto (a ficha, o projeto, o candidato) |
| 2 — os recortes de uma seção | `.abas`, sublinhadas (`navNivel2()`) | Configurações › Geral · README; Dinâmica › Painel · Roteiro… |
| filtro, que não troca de seção | `.seg`, o controle segmentado com o item ligado quieto (9% e tinta, como o nível 1; seleção nunca é Synapse) | Meus, Todos; status; idioma; a visão da Agenda |

Aba sublinhada no primeiro nível ou pílula no segundo é o erro que esta regra
existe para evitar. O componente está no design system (card *Navegação*).

A árvore mora em `arvoreDoMenu()`, na casca. Tela nova com endereço próprio
entra lá como subitem do espaço dela; se a tela firma o endereço sozinha
(como Atividades, que troca `#/atividades` pelo quadro que abriu), o menu
acompanha sem precisar de nada.

**Dois princípios por trás disso:**

**Um objeto, um lugar.** "Quadro de pessoal" e "Organização" eram duas telas
sobre os mesmos dados; viram **Equipe**. A ficha é a mesma para todo mundo —
o que muda é quanto dela você enxerga, não por qual porta você entrou.

**Degradar, não desaparecer.** Um espaço não some porque você não tem papel
para a parte administrativa dele: ele mostra menos. Some apenas o que é
inteiramente administrativo (**Administração**). Menu que muda de forma
conforme quem entra é menu que ninguém aprende.

---

## 2. Rotas

```
#/                          Início
#/agenda                    a semana (o dia, no celular)
#/agenda/dia|semana/<AAAA-MM-DD>
#/agenda/mes/<AAAA-MM>
#/agenda/evento/<id>        um evento: ver, responder, editar
#/agenda/novo[/<AAAA-MM-DD>[T<HH:MM>[~<HH:MM>]]]
#/agenda/config[/predefinidos|google]
#/atividades[/<grupo>]      o quadro
#/atividades/<grupo>/arquivadas  os cartões arquivados do quadro, para restaurar
#/atividades/card/<codigo>  uma atividade (ex.: #/atividades/card/ORT-14)
#/equipe                    organograma
#/equipe/<registro>         a ficha
#/marca                    os modelos controlados e templates (Arquivos é o dono do download)
#/marca/assinatura|config  a assinatura de e-mail; o vínculo de cada modelo com uma série
#/equipe/quadro|presenca|feed|newsletter
#/equipe/reporte            o ciclo da semana
#/equipe/reporte/<frente>/<1-4>  preencher ou consultar uma frente (apontamentos, escalonamentos, feed, revisão)
#/equipe/reporte/config     prazo e reunião (admin)
#/admin/emails/comunidade
# /equipe/apontamento é alias de /equipe/reporte; /feed e /marca/interfaces são endereços antigos
#/okrs[/<codigo>]           a árvore de objetivos, com um em foco (OE1, OT1.2…)
#/projetos[/novo]           os projetos
#/projetos/<CÓDIGO>         um projeto (ex.: #/projetos/NEBULA)
#/projetos/<CÓDIGO>/arquivos  o rol de arquivos do projeto
#/arquivos                  todos os arquivos — a primeira tela, que filtra por emissor
#/arquivos/<EMISSOR>        a lista de um emissor (ex.: #/arquivos/PES)
#/arquivos/visao            a visão geral: os números de cada emissor
#/arquivos/revisoes|templates|config
#/arquivos/<código>         um arquivo (ex.: #/arquivos/NRO-PES-007-2)
#/servicos[/<tipo>]
#/servicos/pedidos          meus pedidos (o antigo #/pedidos, que ainda abre)
#/servicos/declaracao[/<registro>]  a declaração de vínculo (a de outra pessoa: Depto. de Pessoal)
#/servicos/eventos[/aprovar|todos|novo|config]  os eventos registrados
#/servicos/eventos/EXT-14[/editar]  um evento
#/servicos/cofre[/<id>]     as contas que você usa (com uma em destaque)
#/servicos/cofre/gestao|uso|config|nova[/<item>]|editar/<id>
#/arquivos/<código>/escrever  escrever o PN no portal (ex.: #/arquivos/NRO-PUB-003-12/escrever)
#/treinamentos              para você: o que os seus grupos pedem
#/treinamentos/todos|certificados
#/treinamentos/NRO-TRE-003  um treinamento: o programa e onde você está
#/treinamentos/NRO-TRE-003/2  o módulo 2, com a verificação
#/treinamentos/NRO-TRE-003/editar|acompanhamento
#/treinamentos/novo
#/treinamentos/config[/geral|readme]  a gestão, quem gere, a nota, o README
                            (#/treinamentos/gestao ainda abre)
#/treinamentos/certificado/CERT-3F9A-C21B  conferir um certificado
#/studio                    o quadro das publicações
#/studio/calendario|ideias|modelos
#/studio/criar[/<modelo>]   o criador (ex.: #/studio/criar/aniversario)
#/studio/POST-14            uma publicação
#/studio/POST-14/arte       a arte dela, no criador
#/studio/config[/<aba>]     acesso, contas, imprensa, recursos
#/selecao[/<aba>]           processo seletivo (candidatos, avaliacao, agenda,
                            dinamica, publicacoes, faq, config)
#/selecao/candidatos/<id>   a ficha de um candidato
#/selecao/dinamica/<sub>    painel, roteiro, desafio, criterios, janelas
#/admin[/aba]               painéis
#/admin/grupos/<prefixo>    a árvore de grupos, com um em foco
#/admin/emails[/programados|pilulas]  o Full mailer, a fila e as pílulas
#/versoes[/<x.y.z>]         as notas de versão, com uma em foco (fora do menu: a porta é o rodapé)
#/versoes/comentarios       bugs e sugestões
#/versoes/comentarios/bug|sugestao  relatar
#/versoes/comentarios/<n>   um relato (BUG-12, SUG-13)
```

**Regras:**

- toda tela tem endereço. Se não dá para mandar por mensagem, não está pronto;
- o primeiro segmento é o espaço, o segundo é o recorte ou o objeto;
- endereço antigo nunca quebra: entra uma linha em `ALIAS` no roteador
  (`calendario` → `agenda`, `quadro` → `equipe`, `organizacao` → `equipe`,
  `pedidos` → `servicos/pedidos`, `informacoes` → `arquivos`) — e, na
  agenda, em `ALIAS_AGENDA` (`agenda/presenca` → `equipe/presenca`,
  `agenda/agendar` → `agenda/novo`, `agenda/minha` → `agenda/config/google`);
- rota sem permissão devolve para o início — nunca uma tela vazia dizendo
  "sem acesso" para quem nunca deveria ter visto o link.

---

## 3. A busca

Uma caixa no topo do menu lateral, atalho `/` ou `Ctrl/⌘ K` — no trilho,
só a lupa, sem caixa nem legenda, no eixo dos outros ícones. Acha **quatro coisas**:

| Fonte | Exemplo do que casa |
|---|---|
| **Ações e telas** | "novo evento", "importar", "auditoria", "férias" |
| **Pessoas** | nome, registro, cargo, grupo, e-mail |
| **Atividades** | código (`ORT-14`), título, responsável |
| **Agenda e documentos** | título do compromisso, nome do documento |
| **Treinamentos** | código (`NRO-TRE-003`), título |
| **Eventos registrados** | código (`EXT-14`), nome |
| **Cofre** | a conta (acesso e rótulo), o usuário, o endereço — nunca a senha |
| **Notas de versão e relatos** | a versão (`2.16.0`) e o título dela; o código (`BUG-12`) e o título do relato |

**O contrato.** Cada módulo registra as próprias fontes ao carregar:

```js
registrarBusca({
  fonte: 'atividades',
  rotulo: 'Atividades',
  buscar: (termo) => [
    { titulo: 'ORT-14 · Calibrar o encoder',
      sub: 'Em andamento · Bruno Tavares',
      href: '#/atividades/card/ORT-14',
      peso: 10 }
  ]
});
```

`buscar` é síncrono, roda sobre o que já está em memória e devolve no máximo
oito itens. A busca é para **navegar**, não para consultar o banco: quem
precisa de relatório usa os filtros da tela, que têm recorte de verdade.

Ações sempre vêm primeiro — quem digita "novo" quer criar, não ler.

A exceção ao "cada módulo registra" é de quem já tem os dados: os
treinamentos a casca lê no login (o início mostra os obrigatórios por fazer),
então a fonte deles mora na casca, sobre `state.treMeus`, e acha o
treinamento antes de alguém abrir o espaço. `mod-treinamentos` só mantém a
lista em dia.

---

## 4. Como um módulo entra

Um módulo é um `<script>` clássico, `mod-<nome>.js`, carregado na primeira
visita a uma rota sua. Clássico e não módulo ES porque o código usa
`onclick="…"` — e isso depende de escopo global.

O que ele faz, nesta ordem:

1. declara o próprio estado num objeto só, com o nome do módulo
   (`gestao`, `atividades`) — **nunca** pendura campo novo em `state`, que é
   da casca;
2. define `pageX(sub)` para cada rota que a casca anunciou em `ROTAS`;
3. chama `registrarBusca({...})` com o que ele sabe achar;
4. carrega biblioteca pesada com `carregarLib(url)`, dentro da função que
   precisa dela — nunca no topo.

O que ele **não** faz: mexer no cabeçalho, no rodapé, no roteador ou no CSS
da casca. Precisou de um componente novo? Ele vai para o design system
(`brand/design-system/neuro.css`) e desce daqui para a casca.

### Escopo é um só — e isso tem duas consequências

Script clássico não tem módulo: casca e módulos dividem o mesmo escopo
global. Daí duas regras que não são estilo, são o que faz a tela abrir:

1. **A casca é dona dos nomes compartilhados.** Um `const` declarado nos dois
   lugares derruba o módulo **inteiro** no carregamento, e o que aparece na
   tela é uma rota vazia — sem erro visível. Vocabulário que mais de um
   módulo usa (`STATUS_SOL`, `TIPOS_SOL`, `STATUS_LIST`, `CAT_LABEL`, `ic`,
   `ibtn`, `falha`) mora na casca, mesmo quando foi um módulo que o inventou.
2. **Módulo não depende de módulo.** `mod-relatorios` usar uma constante de
   `mod-gestao` funciona enquanto alguém passa pelo quadro antes de abrir
   Relatórios — e quebra para quem vai direto. Quando um módulo precisa
   mesmo de outro, ele chama `carregarModulo('<nome>')` **antes**, dentro da
   função. O que duas telas dividem sobe para a casca: o calendário do mês
   (Agenda e Studio), a leitura da agenda (Agenda e início), o placar do
   LABBIO (Presença e início).

`node testes/colisoes.mjs` confere a primeira. A segunda é leitura de
diff — e as duas já falharam nesta base.

---

## 5. Identidade dos objetos

Todo objeto que uma pessoa cita em voz alta precisa de um código curto:

| Objeto | Código | Onde nasce |
|---|---|---|
| Membro | `004` | `membros.registro` |
| Evento | `EVT-012` | `eventos.numero` |
| Atividade | `ORT-14` | `atividades.codigo` — prefixo do grupo + sequência |
| Solicitação | protocolo | `portal_solicitacoes` |
| Projeto | `NEBULA` | `projetos.codigo` — o grupo da equipe é `NRO_PROJECT_NEBULA` |
| Arquivo | `NRO-PES-007-2` | `doc_arquivos.codigo` — emissor, série (SN) e part number (PN); a revisão (`Rev. B`) fica fora do código |
| Publicação | `POST-14` | `studio_publicacoes.codigo` — sequência única; a versão da arte fica fora do código, como a revisão de um arquivo |
| Treinamento | `NRO-TRE-003` | `treinamentos.codigo` — do número; a revisão (`Rev. B`) fica fora do código, como num arquivo. O prefixo `TRE` não pode virar emissor em Arquivos |
| Certificado | `CERT-3F9A-C21B` | `treinamento_conclusoes.certificado` — um por conclusão; confere-se em `#/treinamentos/certificado/<código>` |
| Evento registrado | `EXT-14` | `eventos_ext.codigo` — sequência única; a participação da equipe num evento de fora (o `EVT-012` é um compromisso da agenda) |
| Documento emitido | `Q8RT-5WZN-2KDH` | `doc_emitidos.codigo` — o código verificador: 12 caracteres do alfabeto de Crockford, sorteados. O documento em si é `NRO-DIR-004-17` (o PN é o registro) ou `NRO-DIR-006-14` (o PN é o evento); confere-se em `auth.neurodynamics.dev/?c=<código>` |
| Relato (bug ou sugestão) | `BUG-12`, `SUG-13` | `soma_feedback.id` — um número só para os dois tipos; o prefixo diz o tipo, e o número não muda se a administração reclassificar |
| Versão do SOMA | `2.17.0` | `VERSAO`, na casca — major.minor.patch (§ 10); as notas moram em `NOTAS_VERSAO` (`mod-versoes.js`) |

Escrito num texto de trabalho (a descrição e os comentários de um cartão, um
relato), o código vira link sozinho — `md()`, na casca, conhece os formatos
desta tabela. O de quadro (`ORT-14`) só com prefixo de grupo que existe:
`COVID-19` continua texto.

Sequência por grupo, não global: `ORT-14` diz de qual quadro a atividade é.
O prefixo mora em `grupos.prefixo` e é gerado do nome, editável depois.

O código de arquivo segue a mesma ideia, com um nível a mais: o emissor diz
de onde o arquivo veio, o SN diz que espécie de arquivo ele é e o PN, qual
exemplar. A revisão não entra no código de propósito — `NRO-PES-007` continua
sendo o mesmo procedimento na Rev. A e na Rev. F, e é esse endereço que as
relações, os templates e os links apontam.

O Pokémon de um projeto também é identidade: é escolhido na criação, mora em
`projetos.logo_semente` como `pkm:<número da Pokédex>` e sai por
`logoProjeto()`, na casca, igual em toda tela (no cartão, no menu e na página
do projeto). A arte vem do repositório público da PokeAPI. A linha evolutiva
aparece na página do projeto, e quem edita o projeto evolui o Pokémon com um
clique. Projeto com semente antiga, de texto, ganha um Pokémon sorteado pela
semente, sempre o mesmo, até alguém escolher.

### Um fato, um cartão

Solicitação, apontamento e ocorrência **não** viram uma caixa de entrada
paralela: viram cartão no quadro do Depto de Pessoal, com código próprio
(`DEP-7`), responsável, coluna e histórico — como qualquer outro trabalho.

- **"Exatamente um"** é garantia do índice único `(origem_tipo, origem_id)`,
  não da disciplina de quem escreve o gatilho.
- O cartão **sobrevive ao fato**: `origem_id` é texto, sem chave
  estrangeira. Apagar a ocorrência não apaga a decisão que se tomou sobre ela.
- Ocorrência que é só **espelho** de uma mudança já feita na ficha (mudou o
  cargo, mudou o grupo) não vira cartão: o quadro é de trabalho a fazer, não
  de histórico. A lista está em `ocorrencia_espelho()`, uma função — mudar
  de ideia é uma linha.
- O cartão de origem tem o que nenhum outro tem: um bloco que **decide**.
  Aprovar um acesso concede o acesso na mesma transação. Dois passos em duas
  telas eram um passo esquecível.

### O cartão tem relevo, o tile não

Tile de galeria é estático e a marca não lhe dá sombra — elevação ali é borda
mais vidro. O cartão do quadro é a exceção, e o motivo é funcional: **ele é para
ser pego com a mão**, e a sombra é a única pista de que dá para arrastar. Ao
pegar, inclina, cresce e sobe.

O sinal de prioridade é um **brilho no topo**, não uma barra na lateral: barra
lateral come a largura de uma coluna que já tem 230px, e some quando a coluna
estreita. Sinalizado troca a cor do brilho para âmbar — "olhe para mim" é o que
um brilho quer dizer — e o ponto de prioridade continua ali, então nada se
perde. Na coluna Concluída o brilho sai e fica só o ponto: trabalho entregue
não pede atenção.

### Quadro reservado

Um grupo pode ser `reservado`: aí só quem está nele lê os cartões. Existe um
só — o do Pessoal, porque recebe pedido de afastamento e de desligamento.

Fechar isso são **três** coisas, e esquecer qualquer uma não dá erro nenhum:

1. a política de RLS (`posso_ver_grupo`);
2. `security_invoker = true` na view que a tela lê. Sem isso a view roda como
   dona, ignora RLS e devolve tudo — a view seria o furo, não a política;
3. **toda função `security definer` que escreve** precisa checar o grupo por
   conta própria. Elas passam por cima da RLS por definição: `comentar`,
   `sinalizar` e `seguir` nasceram sem checagem nenhuma, e quem tivesse o id de
   um cartão escrevia nele — no caso do `seguir`, passava a receber o conteúdo
   por notificação.

---

## 6. Estados de tela

Quatro, sempre os mesmos, sempre com texto que diz o que fazer:

| Estado | Componente | Regra |
|---|---|---|
| Carregando | `.carregando` + `.spin` | só se passar de ~300 ms |
| Vazio | `.vazio` | diz **por que** está vazio e qual é o próximo passo |
| Erro | `.aviso-box err` | o que falhou e o que a pessoa pode fazer |
| Sem permissão | devolve ao início | nunca uma tela de porta fechada |

"Nenhum resultado" nunca é uma tela vazia: é "nenhuma atividade com esse
filtro — limpar filtros".

### O que ninguém pediu não aparece sozinho

Toast e faixa só respondem ao que a pessoa acabou de fazer (salvou, errou,
copiou). Novidade de versão, convite para ativar as notificações no
aparelho, dica de recurso: ficam onde se procura (o rodapé, *Preferências de
avisos*, a ajuda), nunca num aviso que abre por conta própria. O que espera
a ação da pessoa tem lugar fixo: o sino e as pendências do início (2.17.1).

---

## 7. Permissão

A barreira de verdade é a **RLS do banco**. O que o front-end faz é não
oferecer porta fechada e não baixar código inútil.

```js
can()         // admin ou pessoal — edita
podeQuadro()  // vê o quadro inteiro
podeSelecao() // comitê de seleção
```

Numa rota: `permite: podeQuadro`. Num botão: `${can() ? ibtn(...) : ''}`.
Nunca só esconder o botão e deixar a função aberta — a função também confere.

E a busca não pode achar o que a galeria esconde: quem registra uma fonte
filtra pelo mesmo papel que desenha os botões. `testes/relatorios-por-papel.mjs`
confere os três caminhos — galeria, busca e chamada direta pelo console.

### Quadro de atividades: nível, não papel

Papel é do sistema inteiro. Quadro é por grupo, e aí o que vale é o **nível**,
que o banco calcula em `meu_nivel_no_grupo()` e manda junto com a lista:

| Nível | O que é |
|---|---|
| `edicao` | cria, move, comenta |
| `leitura` | acompanha, não mexe |
| `nenhum` | sabe que o quadro existe e nada mais |

Sai de quatro coisas, nesta ordem: admin/pessoal → `edicao`; estar no grupo —
pela ficha ou por um grupo abaixo dele — → `edicao`; um acesso concedido em
*Administração → Grupos* → o que foi concedido; o grupo não ser reservado →
`leitura`.

Duas consequências que não são detalhe:

- **`nenhum` não some da navegação.** O grupo continua na lista, com cadeado, e
  abrir mostra de quem é o quadro e como pedir acesso. Quadro que some não é
  quadro fechado — é quadro que ninguém sabe que precisa pedir.
- **Conceder acesso não põe ninguém no grupo.** São coisas diferentes: estar no
  grupo é um fato da ficha; acessar o quadro é uma permissão.

### Grupos dentro de grupos

Desde a v19 os grupos formam uma árvore, e **quem está num grupo está em todos
os de cima**. A pertença herdada é calculada, nunca gravada na ficha, e a regra
tem um dono em cada lado: `esta_no_grupo()` no banco e `gruposEfetivos()` na
casca. Perguntar "quem está no grupo X?" olhando direto `membros.grupos` é o
defeito que esta seção existe para evitar — acha só quem foi posto à mão e
esquece quem chegou por um subgrupo. Para listar pessoas de um grupo, use
`membrosDoGrupo(nome)`; para os grupos de uma pessoa, `gruposEfetivos(m)`.

### Arquivos: o rol é de todos, o conteúdo é da classe

Os metadados de um arquivo — código, título, revisão, status, quem mexeu por
último — a equipe inteira lê, como lia a planilha. É o cadeado do quadro de
novo: rol que some não é rol fechado, é rol que ninguém sabe que precisa
pedir. O conteúdo — as revisões, o registro de alterações, o arquivo no
Storage — segue a **classe** da série, e a regra tem um dono só,
`doc_pode_ler()`:

| Classe | Quem lê o conteúdo |
|---|---|
| `publico` | toda a equipe |
| `controlado` | o grupo do emissor, a equipe do projeto, o grupo revisor, os grupos de leitura |
| `confidencial` | o grupo revisor e os grupos de leitura |

Em todas, o autor do exemplar lê o que é dele, e o PMO e `admin` leem tudo.
"Estar no grupo" é a pertença efetiva: quem está num subgrupo do emissor lê o
que o emissor controla.

**Revisar não é papel, é grupo.** Quem aprova uma versão é alguém do grupo
revisor da série (sem grupo revisor, o PMO) que **não** a enviou — a
`doc_revisao_decidir()` confere as duas coisas, e a tela só não oferece o
botão. O arquivo no Storage segue a mesma regra por política própria, em
`storage.objects`: a versão pendente só desce para quem a enviou e para quem
revisa, e um objeto que já é revisão não se apaga.

**Escrever no portal é enviar do mesmo jeito.** O registro escrito no portal
(a ata, o relatório de teste) vira um PDF que sobe para o mesmo bucket e entra
pela mesma porta (`doc_formulario_enviar` chama `doc_revisao_enviar`): a
revisão fica pendente, o grupo revisor decide, e a regra de leitura é a da
classe. A revisão guarda a definição e os dados que a geraram. O formato do
formulário tem três lugares que andam juntos: a conferência no banco
(`doc_formulario_problemas`), o editor (`mod-formularios.js`) e o desenho
(`DocNRO.registro`, em `doc-nro.js`) — mudar a gramática é mudar os três no
mesmo diff.

---

### Studio: pronta é a aprovação que diz

Uma publicação anda por ideia → produção → aprovação → pronta → publicada, e
arrastar o cartão move — menos para **pronta**. Lá só se chega pela aprovação
de alguém do grupo aprovador que não mandou a publicação para aprovação: é a
regra de "revisar não é papel, é grupo", e mora num gatilho de
`studio_publicacoes`, não na tela — nem um `update` direto furaria.

A aprovação vale para uma **versão**: mudar a arte ou a legenda de uma
publicação aprovada cria outra versão e a devolve para aprovação. Mudar a nota
para quem publica, não.

A escrita das publicações é só pelas funções (`studio_publicacao_salvar`,
`studio_mover`, `studio_decidir`, `studio_excluir`): a tabela não tem política
de escrita. É nelas que moram os avisos — quem aprova é avisado quando algo
chega, quem responde é avisado da decisão.

### Documentos emitidos: o modelo tem um dono só

Tudo o que o SOMA emite ou exporta como documento sai do **modelo da NRO**,
em `doc-nro.js`: o cabeçalho do NRO-PUB-002 (logo, departamento em negrito,
título, código e revisão), as tabelas de cabeçalho cinza, a nota da classe e,
nos documentos emitidos, a **legenda de autenticação** — o QR Code, a
certidão, o código verificador e o de controle. Documento novo não desenha
cabeçalho próprio: acrescenta uma função ali. O `auth.neurodynamics.dev`
carrega o mesmo arquivo; não há cópia.

Documento emitido **não se guarda**: guarda-se a fotografia do que foi
impresso (`doc_emitidos.dados`), o código verificador e o de controle, e a
segunda via se desenha de novo, igual. A validação pública lê por uma porta
só (`doc_validar`), a única aberta à chave anônima, e mostra o CPF mascarado.
Emitido não se corrige: **revoga-se** (com o motivo, que a validação mostra)
e emite-se outro.

### Eventos: como no Studio, aprovado é a aprovação que diz

O registro de um evento anda por rascunho → aprovação → aprovado, e só as
funções escrevem (`evento_ext_salvar`, `evento_ext_enviar`,
`evento_ext_decidir`…). Aprovar é dos grupos escolhidos (e `admin`), nunca de
quem mandou, uma vez por versão; mexer num evento em aprovação cria a versão
seguinte, e as aprovações recomeçam. Com as que bastam, o banco emite as
declarações, põe os e-mails na fila (`doc_envios`) e avisa no sino. Os
e-mails dos externos são dado pessoal: só quem registrou, quem aprova e o
Depto. de Pessoal os veem.

### Cofre: o segredo sai um de cada vez, e registrado

A lista das contas (`cofre_lista`) não traz segredo nenhum. A senha, a
anterior e as notas saem por `cofre_revelar`, uma por clique, e cada saída
entra no registro de uso (`viu_senha`, `copiou_senha`…); o código de duas
etapas sai por `cofre_codigo`, calculado no banco — o segredo do 2FA nunca
volta ao navegador. O que é segredo mora no Vault; as tabelas não têm
política nenhuma, e quem usa, quem mantém e quem gere é regra de função
(`cofre_via`, `cofre_mantem`, `cofre_gestor`). Na tela: a senha vista some
em 20 segundos, e a área de transferência é limpa em 60.

### Treinamentos: o gabarito não desce

Quem faz um treinamento nunca recebe as respostas certas. O conteúdo —
`treinamento_revisoes`, onde mora o gabarito — só quem gere lê direto; quem
faz lê por `treinamento_conteudo()`, que tira `correta` e a explicação de cada
questão. Quem corrige é o banco (`treinamento_responder`), e a explicação só
volta para quem passou. Progresso, conclusão e certificado nascem de funções
(`treinamento_concluir_modulo`, `treinamento_responder`, que fecham o
treinamento sozinhas no último módulo): as tabelas não têm política de
escrita, e nem um `insert` direto forja um certificado.

A conclusão é uma **fotografia**: nome, título, revisão, carga horária, nota e
os módulos da época. Revisar ou arquivar o treinamento depois não muda o
certificado de ninguém — o que muda é se a pessoa continua **em dia**, e isso
se calcula (`treinamento_situacao`), nunca se grava.

O formato do texto de um treinamento tem **um dono só**: o README padrão, o
leitor (`treLerTexto`) e o escritor (`treEscreverTexto`) moram juntos em
`mod-treinamentos.js`. Mudar o formato é mudar os três no mesmo diff — senão o
README ensina os agentes de IA a escrever o que o portal não lê.

## 8. Layout

O design system da marca é a fonte
([brand.neurodynamics.dev](https://brand.neurodynamics.dev)). O SOMA o recebe
em `ds/` (tokens, componentes, casca do rodapé, select), gerada no brand por
`scripts/distribuir.mjs`: **não edite `ds/`**. O CSS próprio do SOMA mora em
`soma.css`, carregado depois. Componente que outro app também usaria vai
para o `neuro.css` do brand, não para o `soma.css`.

### Uma tela, um template

Toda tela é um dos templates do `PLANO-DESIGN-SYSTEM.md` (seção 3): Lista,
Objeto, Fluxo, Painel, Leitura, Ajustes, Área de trabalho ou Avulsa. O topo
é sempre `cabecalho()`, na casca:

- o eyebrow é o espaço do menu (Equipe, Arquivos...), nunca slogan, trilha
  ou código; o h1 é a tela, num tamanho só;
- voltar só em objeto e subtela (`voltar: ['Quadro de pessoal', '#/equipe/quadro']`);
  com três níveis ou mais, `trilha`; seção irmã não tem voltar, tem o
  SectionNav (`secoes`);
- o código do objeto vai em `codigo`, numa Tag em Plex Mono;
- no máximo um `.btn.solid`; no celular as outras ações vão para "Mais".

As funções de cada template (`ferramentas`, `layoutObjeto`, `spec`,
`etapas`, `layoutFluxo`, `layoutLeitura`, `ajuste`, `estado`) estão ao lado
de `cabecalho()`. O catálogo vivo é `#/dev/templates` (só admin), e
`testes/templates.mjs` confere e fotografa cada um. Tela nova passa no
auditor do brand: `node ../brand/scripts/auditar.mjs --falhar <arquivos>`.

Os três erros que mais aparecem ao trazer tela clara para o escuro:

- **verde em texto** — `--axon` não tem contraste sobre o Void. Ação e foco
  são Synapse;
- **sombra** — não existe no escuro. Elevação é borda mais vidro;
- **zebra em tabela** — compete com o hover. Separação é a borda a 8%.

### Dois temas, os mesmos nomes

O escuro é o da marca e o padrão; o claro (`<html data-tema="claro">`) é
escolha de cada pessoa — o botão ao lado do *sair*, na linha da conta. Os
tokens são os mesmos nos dois: o bloco `:root[data-tema="claro"]`, no alto da
casca, só troca os valores. Por isso:

- **nenhuma cor literal num componente.** Transparência se escreve com trio:
  `rgba(var(--tom),.05)`, não `rgba(255,255,255,.05)` — `--tom` clareia no
  escuro e escurece no claro; `--ink-rgb`, `--fundo-rgb`, `--painel-rgb` e os
  de status (`--ok-rgb`, `--bad-rgb`…) seguem a mesma ideia. Sombra:
  `rgba(var(--sombra-rgb),calc(.45 * var(--sombra-k)))`; véu, o mesmo com
  `--veu-rgb` e `--veu-k`;
- **o Synapse tem três usos.** Como fundo (botão, chip ligado, bolha) é
  `--syn`, nos dois temas, com texto `--deep`. Como texto, `--syn-tx`. Como
  borda, linha de estado (aba ativa, subitem atual, ponto do carrossel, barra
  de progresso) ou controle marcado, `--syn-borda`. No escuro os três são o
  mesmo lima; no claro, texto e linha viram oliva — lima de 2px no papel não
  se vê;
- **texto sobre caixa tingida** usa os `*-tx` (`--bad-tx`, `--warn-tx`,
  `--info-tx`…), não a cor de status pura;
- **campo** tem fundo `--campo`: branco no claro — cinza parece desativado;
- **ilha escura.** A faixa de destaque (`.sl-destaque`) continua escura no
  claro, e dentro dela todo token que o claro troca volta ao do escuro. Token
  de tema novo entra em três lugares — o `:root`, o bloco claro e a ilha —, e
  `testes/menu-lateral.mjs` confere a ilha;
- **logo em `<img>`** pintada de branco por filtro precisa da exceção do
  claro, que a pinta de tinta.

O tema vale antes de a página pintar: uma linha de script no `<head>` lê o
`localStorage` (`nd.tema`) e põe o atributo, e a página nunca pisca escura.
Todo texto do claro lê a 4,5:1 ou mais sobre o fundo real — o teste do menu
mede. O card *Tema claro* do design system traz os valores e o contraste de
cada token.

---

## 9. Linguagem

O portal fala como um documento da NRO: direto, formal e curto.

- **Não explique o óbvio.** Que a declaração sai na hora e no modelo da NRO,
  que um botão faz o que diz, que a lista vazia vai se encher: nada disso
  precisa de frase. Estado vazio é uma linha ("Nenhuma tarefa aberta.").
- **O que precisa de explicação vai para o ícone de informação**, `dica(texto)`
  — uma regra de negócio, uma consequência que não se vê (revogar invalida a
  validação; recolher o objetivo recolhe os de baixo). Nunca um parágrafo no
  alto da tela para isso.
- **Sem conversa.** Nada de "dá para", "é só", "por enquanto", "a gente";
  nada de pergunta retórica. Impessoal ou imperativo: "Informe o motivo.",
  não "Diga o motivo — é o que a validação vai mostrar."
- **Sem travessão nem ponto médio em frase e rótulo.** Vírgula, dois-pontos
  ou parênteses. Contagem no título vai entre parênteses ("Equipe (4)");
  código e título, lado a lado ("ORT-14 Calibrar o encoder"). O travessão
  fica como marca de campo vazio (`—`). Documentos e artes também usam
  vírgula ou dois-pontos, sem ponto médio como separador.
- **Erros dizem o que houve, não quem errou**: "Sem permissão para esta
  ação.", "Conta sem vínculo com um registro de membro." — os textos comuns
  moram em `MOTIVO_RPC`, na casca.

### O texto de trabalho é Markdown

O que a equipe escreve para a equipe ler — a descrição e os comentários de um
cartão, um relato de bug, as notas de versão — é Markdown, desenhado por
`md()`, na casca: seguro por construção (tudo é escapado e só vira marcação o
que está previsto), com os códigos do SOMA como link e `@Nome` como menção
(`op.mencoes`). O campo de escrever tem a barra (`mdBarra`) e, quando o texto
é longo, o *Ver* antes de salvar. Marcar alguém é digitar `@`: a lista abre
perto do cursor, e o que entra no texto é o nome e o sobrenome, que é como a
menção aparece e como o banco sabe quem avisar.

---

## 10. Versões

O SOMA se numera em **major.minor.patch** desde a 2.17.0. Minor quando a
versão acrescenta sem mudar o que existia; patch quando só corrige; major
quando algo deixa de funcionar como antes (uma tela sai, um endereço muda de
sentido, um dado muda de forma). A numeração antiga virou `2.(N-16).p`: a 32.0
é a 2.16.0.

Subir a versão é um commit só: `VERSAO` na casca, a entrada no alto de
`NOTAS_VERSAO` (`mod-versoes.js`, com o tipo de cada item) e, se houver, a
migração com o número no nome (`db/2.17.0_notas_fotos_e_cartoes.sql`). Nota de
versão diz o que muda para quem usa, no tom do § 9 — não o que mudou no
código.

