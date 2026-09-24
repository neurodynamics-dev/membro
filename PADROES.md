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
| **Agenda** | tempo — compromissos, presença, ausências, marcos | todos |
| **Atividades** | trabalho — o quadro do seu grupo | todos |
| **OKRs** | planejamento — os objetivos e o desdobramento de cada um | todos (edição: `admin`, `pessoal` e os responsáveis) |
| **Projetos** | cada projeto: equipe, supervisor e o rol de arquivos | todos (criar: PMO e `admin`; editar: eles e o supervisor) |
| **Arquivos** | documentos e registros controlados — código, revisão, status | todos no rol; o conteúdo segue a classe de cada série |
| **Studio** | comunicação — criar as peças, planejar e aprovar as publicações | os grupos de acesso e os aprovadores (Studio › Configurações), e `admin` |
| **Equipe** | pessoas — organograma e fichas | todos (a profundidade varia) |
| **Informações** | documentos e políticas | todos |
| **Serviços** | pedidos ao Depto. de Pessoal | todos |
| **Meus pedidos** | o andamento do que você pediu | todos |
| **Seleção** | os bastidores do processo seletivo | `admin`, `pessoal`, `selecao` |
| **Administração** | os painéis: portal, site, catálogo, importação, auditoria | `admin`, `pessoal` (e `selecao`, só Relatórios) |

O **início** — o seu dia: avisos, próximos compromissos, suas atividades,
seus pedidos — não é item da lista: a logo no alto do menu leva a ele, e uma
casinha menor, ao lado dela, diz que leva. No trilho a casinha sai; a logo
basta. Um item "Início" repetiria o caminho da logo e empurraria os espaços
para baixo.

Até dez destinos no primeiro nível para toda a equipe (mais Seleção e
Administração, para quem tem o papel), cada um com ícone, no **menu lateral**
à esquerda. Com o Studio são dez: **o próximo precisa caber dentro de um que
já existe, ou tomar o lugar dele**. O Studio é o único espaço do primeiro nível
que some para quem não é dos grupos dele — é uma ferramenta de trabalho de uma
equipe, como Seleção, e não um lugar da equipe inteira. O segundo nível são os subitens de cada espaço — as abas da
Agenda, os quadros dos grupos da pessoa, as categorias de documento, cada
serviço, cada painel —, pendurados numa linha-guia debaixo do espaço, como
no painel da Cloudflare. Tudo o que tem endereço próprio vira subitem; o que
é filtro dentro de uma tela, não.

O menu **recolhe** para um trilho de ícones (a escolha fica no navegador de
cada pessoa; sem escolha, tela abaixo de 1280px começa recolhida). No
trilho, passar o mouse — ou chegar pelo Tab — num ícone abre os subitens ao
lado. Abaixo de 900px o menu vira gaveta, puxada pela barra de topo.

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
#/agenda[/mes|agendar|presenca|minha]
#/agenda/<id>               um compromisso
#/atividades[/<grupo>]      o quadro
#/atividades/card/<codigo>  uma atividade (ex.: #/atividades/card/ORT-14)
#/equipe                    organograma
#/equipe/<registro>         a ficha
#/okrs[/<codigo>]           a árvore de objetivos, com um em foco (OE1, OT1.2…)
#/projetos[/novo]           os projetos
#/projetos/<CÓDIGO>         um projeto (ex.: #/projetos/NEBULA)
#/projetos/<CÓDIGO>/arquivos  o rol de arquivos do projeto
#/arquivos                  todos os arquivos — a primeira tela, que filtra por emissor
#/arquivos/<EMISSOR>        a lista de um emissor (ex.: #/arquivos/PES)
#/arquivos/visao            a visão geral: os números de cada emissor
#/arquivos/revisoes|templates|config
#/arquivos/<código>         um arquivo (ex.: #/arquivos/NRO-PES-007-2)
#/informacoes[/<categoria>]
#/servicos[/<tipo>]
#/pedidos
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
```

**Regras:**

- toda tela tem endereço. Se não dá para mandar por mensagem, não está pronto;
- o primeiro segmento é o espaço, o segundo é o recorte ou o objeto;
- endereço antigo nunca quebra: entra uma linha em `ALIAS` no roteador
  (`calendario` → `agenda`, `quadro` → `equipe`, `organizacao` → `equipe`);
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
   mesmo de outro (o dossiê de evento gera PDF), ele chama
   `carregarModulo('relatorios')` **antes**, dentro da função.

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

Sequência por grupo, não global: `ORT-14` diz de qual quadro a atividade é.
O prefixo mora em `grupos.prefixo` e é gerado do nome, editável depois.

O código de arquivo segue a mesma ideia, com um nível a mais: o emissor diz
de onde o arquivo veio, o SN diz que espécie de arquivo ele é e o PN, qual
exemplar. A revisão não entra no código de propósito — `NRO-PES-007` continua
sendo o mesmo procedimento na Rev. A e na Rev. F, e é esse endereço que as
relações, os templates e os links apontam.

A logo de um projeto também é identidade: sai de uma semente
(`projetos.logo_semente`) por `logoProjeto()`, na casca, e a mesma semente dá
a mesma logo em toda tela — no cartão, no menu e na página do projeto.

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
perde.

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

## 8. Layout

O design system da marca é a fonte
([brand.neurodynamics.dev](https://brand.neurodynamics.dev)). O CSS da casca
é cópia dele; mexer aqui sem mexer lá é dívida.

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
