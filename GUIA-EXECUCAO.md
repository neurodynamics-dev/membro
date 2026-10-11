# Guia de execução da 2.19.1 (para quem executa as fichas [S])

Leia inteiro antes da primeira ficha. Ele vale junto com
`PLANO-EXECUCAO-2.19.1.md` (o que fazer e os contratos) e com o plano funcional
da coordenação (as regras de negócio). Se algo aqui conflitar com o código,
**pare e pergunte**: não invente um padrão novo.

## 1. Repositórios e branches

| Repositório | Branch de quem desenha o banco ([O]) | Branch do executor ([S]) | PR |
|---|---|---|---|
| `neurodynamics-dev/membro` | `slp/ecstatic-noether-evq50w` | `astra/2.19.1` | membro#37 é da branch [O]; o executor abre um PR **de `astra/2.19.1` para `slp/ecstatic-noether-evq50w`** (nunca para `main`) |
| `neurodynamics-dev/brand` | `slp/ecstatic-noether-evq50w` | `astra/2.19.1` (só se a ficha mandar mexer no design system) | idem, para `slp/ecstatic-noether-evq50w` |
| `website`, `selecao` | não entram nestas fichas | — | — |

- `astra/2.19.1` nasce do commit que a ficha indicar em "Base" (sempre um
  commit de `slp/ecstatic-noether-evq50w`).
- **Nunca** rebase, amend nem force-push em nenhuma das duas branches. Para
  trazer o que entrou depois na branch [O]:
  `git fetch origin slp/ecstatic-noether-evq50w && git merge origin/slp/ecstatic-noether-evq50w`.
- Um commit por ficha (pode haver commits de correção depois da revisão).
  Mensagem em português, no imperativo ou descritiva, como as do `git log`.
  Nenhum nome de modelo de IA em commit, PR, código ou comentário.
- Não mexa em `db/*.sql` de migração nem em `db/testes/*.sql`: isso é [O].
  Se a ficha precisar de algo que o contrato não dá, pare e registre no PR.

## 2. Ambiente

```sh
# testes de navegador (uma vez)
cd testes && npm install && cd ..
# servir o portal (da raiz do repositório membro), em outro terminal
python3 -m http.server 8765
# rodar um teste
node testes/reporte.mjs
# rodar todos (resumo no fim; logs em testes/.logs/)
bash testes/rodar-tudo.sh
```

- O Chromium do Playwright: os testes chamam
  `chromium.launch({ executablePath:'/opt/pw-browsers/chromium' })`. Se o seu
  ambiente tiver o Chromium em outro lugar, ajuste **só localmente**, sem
  commitar a mudança.
- Auditor do design system (precisa da pasta `brand` ao lado de `membro`):
  `cd ../brand && node scripts/auditar.mjs ../membro` → tem de terminar com
  `0 violação(ões)`.
- Testes de banco: não são do executor, mas para conferir um contrato:
  `bash db/testes/preparar-base.sh` (PostgreSQL 16 local) e
  `bash db/testes/preparar-base.sh teste t1 2.18.0_soma.sql 2.19.0.sql ...`.

## 3. Como o portal é montado (o que você precisa saber)

- **Uma página só**: `index.html` é a casca (login, menu, roteador, helpers).
  Cada espaço grande mora num `mod-<nome>.js`, baixado na primeira visita por
  `carregarModulo(nome)`. Os módulos são scripts clássicos: tudo o que
  declaram é global. **Dois módulos não podem declarar o mesmo `const`** (o
  teste `testes/colisoes.mjs` pega). Prefixe nomes com o módulo (`rep...`,
  `lab...`).
- **Rotas por hash**: `#/<rota>/<sub>/<sub2>`. `ROTAS` (índice da casca) diz
  qual função desenha e de qual módulo; `ALIAS` redireciona endereços antigos
  (endereço antigo nunca quebra). Serviços têm o mapa `SERVICOS_MODULO`
  (`sub → [modulo, função]`). Parâmetros de tela vão depois de `?`
  (`#/servicos/dados?de=termo`): o roteador ignora o que vem depois de `?`.
- **Menu lateral**: `desenharMenu()` em `index.html` (procure
  `rot:'Serviços'`). Item novo condicionado ao papel: `tenhoPapel('lideranca')`,
  `souAdmin()`, `can()` (admin ou pessoal).
- **Helpers da casca** (use, não reescreva):
  - `cabecalho({ espaco, titulo, voltar:[rótulo, href], meta, lead, acoes, secoes })`:
    o topo de toda tela. `espaco` é sempre o nome do item do menu.
  - `etapas(lista, atual, hrefDe)` + `layoutFluxo({ passos, corpo, salvo, acoes })`:
    telas em passos. `layoutLeitura(html)`, `layoutObjeto(principal, lateral)`,
    `ferramentas({ busca, filtros, total })`, `spec(pares)`.
  - `estado.carregando('lista'|undefined)`, `estado.vazio({texto, acao})`,
    `estado.erro({texto, acao})`: os quatro estados, sempre estes.
  - `abreModal(html, tamanho, persistente)` / `fechaModal()`, `confirma(msg, rótulo)`
    (promessa), `toast(msg, erro)`, `ic(nome)` (ícones: o mapa `ICONS` no
    `index.html`; ícone novo entra lá), `esc(texto)` (**escape obrigatório** de todo dado no HTML),
    `fmtD`, `fmtDT`, `$`.
  - `sb.rpc(nome, args)` → `{ data, error }`. RPCs do SOMA devolvem
    `{ status:'ok', ... }` ou `{ status:'<motivo>' }`; trate os dois.
- **CSS**: `soma.css` (portal) por cima de `ds/neuro.css` e `ds/tokens.css`
  (design system, **não edite `ds/`**: ele vem do `brand` por
  `node scripts/distribuir.mjs`, rodado da raiz do `brand`). Só tokens:
  nenhuma cor literal (`#fff`, `rgb(...)`), nenhuma sombra de elevação em
  cartão. Exceção justificada leva o comentário `/* auditar: ok, <motivo> */`
  na mesma linha.
- **Componentes do DS já prontos**: `.widget` (com `.w-rot`, `.w-num`),
  `.btn` (`solid` só um por tela, `ghost`, `mini`), `.pill`, `.aviso-box`
  (`info|warn|err`), `.fld`, `.fgrid`, `.tabela.trabalho`, `.etapas`,
  `.check`, `select` (embrulhado por `ds/select.js`). Antes de criar um
  componente, procure em `ds/neuro.css` e em `#/dev/templates`.

## 4. Textos da interface

- Português do Brasil, frases curtas, voz ativa, sem jargão técnico
  ("Não foi possível enviar o reporte agora. Tente de novo." e não "Erro 500").
- Sem travessão como pontuação; use vírgula, dois-pontos ou ponto.
- Rótulo de botão é verbo: "Enviar o reporte", "Estive ausente".
- O eyebrow é o espaço do menu ("Serviços"), nunca um slogan.
- Acessibilidade: todo controle com rótulo; switch com `role="switch"` e
  `aria-checked`; foco visível; estado nunca só por cor (texto ou ícone junto).

## 5. Testes de navegador

- Um arquivo por assunto em `testes/`. Modelo a copiar:
  `testes/recadastro.mjs` (função `abrir()`, `confere(nome, ok, detalhe)`,
  falhas contadas, saída "Tudo certo.").
- O Supabase é falso: `testes/stub-supabase.js`. RPC nova entra lá, num bloco
  com comentário, lendo um estado de `window.__teste.<assunto>` (veja o bloco
  `cadastro|recadastro|termo`). Registre chamadas em `window.__rpcs` para o
  teste conferir os argumentos.
- Cada ficha diz o que o teste precisa conferir. Além disso, sempre:
  "sem erro de página" (`pageerror` vazio) e a suíte inteira verde.
- Testes que mudaram de expectativa por causa da ficha (ex.: contagem de itens
  do menu em `menu-lateral.mjs`) são atualizados **com comentário dizendo por
  quê**. Nunca apague nem pule um teste para ficar verde.

## 6. Antes de cada push (checklist)

1. `bash testes/rodar-tudo.sh` sem falhas.
2. Auditor do DS com `0 violação(ões)`.
3. `node --check` em cada `.js` alterado.
4. Captura de tela da tela nova, claro e escuro, 1440 px e 390 px, anexada ao
   PR (não commitar as imagens).
5. Releia o diff: nada de `console.log` de depuração, nada fora do escopo da
   ficha, nada de dado inventado (nomes, CPFs, e-mails reais).

## 7. Não faça

- Não mexa em migrações, testes de banco, `ds/`, `vendor/`, `termos/`.
- Não adicione dependências nem CDNs novas (o portal carrega local).
- Não guarde segredo, senha ou token no código.
- Não troque a arquitetura (framework, bundler, módulos ES): é JS clássico.
- Não "melhore" telas fora da ficha. Achou um problema? Anote no PR.
- Não use `localStorage` para estado que o servidor precisa saber.

## 8. Formato das fichas

Cada ficha em `PLANO-EXECUCAO-2.19.1.md` (ou num arquivo `fichas/<id>.md`
indicado ali) traz:

- **Base**: o commit de `slp/ecstatic-noether-evq50w` de onde partir (ou
  "a ponta de `astra/2.19.1`").
- **Contrato**: as RPCs e o formato exato do que devolvem.
- **Arquivos**: os que pode tocar.
- **Tela**: o que aparece, em que ordem, e os textos.
- **Teste**: as asserções mínimas.
- **Fora do escopo**.

Ao terminar: push em `astra/2.19.1` e uma linha no PR dizendo qual ficha, o
resultado de `rodar-tudo.sh` e o que ficou de dúvida.
