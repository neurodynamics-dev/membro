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
| **Início** | o seu dia: avisos, próximos compromissos, suas atividades, seus pedidos | todos |
| **Agenda** | tempo — compromissos, presença, ausências, marcos | todos |
| **Atividades** | trabalho — o quadro do seu grupo | todos |
| **Equipe** | pessoas — organograma e fichas | todos (a profundidade varia) |
| **Informações** | documentos e políticas | todos |
| **Serviços** | pedidos ao Depto. de Pessoal | todos |
| **Administração** | os painéis: portal, site, seleção, catálogo, importação, auditoria | `admin`, `pessoal` |

Sete destinos, um nível. Comparado com os quinze que a união produziria numa
lista plana, é o que cabe num cabeçalho sem virar sopa.

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
#/informacoes
#/servicos[/<tipo>]
#/pedidos
#/admin[/aba]               painéis
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

Uma caixa no cabeçalho, atalho `/` ou `Ctrl/⌘ K`. Acha **quatro coisas**:

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

---

## 5. Identidade dos objetos

Todo objeto que uma pessoa cita em voz alta precisa de um código curto:

| Objeto | Código | Onde nasce |
|---|---|---|
| Membro | `004` | `membros.registro` |
| Evento | `EVT-012` | `eventos.numero` |
| Atividade | `ORT-14` | `atividades.codigo` — prefixo do grupo + sequência |
| Solicitação | protocolo | `portal_solicitacoes` |

Sequência por grupo, não global: `ORT-14` diz de qual quadro a atividade é.
O prefixo mora em `grupos.prefixo` e é gerado do nome, editável depois.

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

---

## 8. Layout

O design system da marca é a fonte
([brand.neurodynamics.dev](https://brand.neurodynamics.dev)). O CSS da casca
é cópia dele; mexer aqui sem mexer lá é dívida.

Os três erros que mais aparecem ao trazer tela clara para o escuro:

- **verde em texto** — `--axon` não tem contraste sobre o Void. Ação e foco
  são Synapse;
- **sombra** — não existe no escuro. Elevação é borda mais vidro;
- **zebra em tabela** — compete com o hover. Separação é a borda a 8%.
