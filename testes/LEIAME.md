# Testes

Nenhum depende de rede, de conta ou do banco de produção: o Supabase é falso
(`stub-supabase.js`) e o Chromium já vem instalado no ambiente.

Da primeira vez, instale o Playwright (só o pacote — o Chromium já está no
ambiente, e é para ele que os testes apontam com `executablePath`):

```bash
cd testes && npm install
```

Depois suba o portal num servidor estático, **da raiz do repositório**:

```bash
python3 -m http.server 8765
```

e rode daqui.

| Arquivo | O que verifica |
|---|---|
| `colisoes.mjs` | nomes globais repetidos entre a casca e os módulos |
| `origem-e-pills.mjs` | cartão de origem, decisão que concede acesso, pills de grupo, preferência de e-mail |
| `relatorios-por-papel.mjs` | quais relatórios cada papel alcança — na galeria, na busca e por chamada direta |
| `carga-por-papel.mjs` | que papel baixa qual módulo (um `leitura` não baixa o `mod-gestao`) |
| `quadro-e-acesso.mjs` | espaço do quadro, rolagem horizontal, nível de acesso por grupo e o cartão |
| `ajustes-de-tela.mjs` | ordem dos grupos, quadro padrão, fundo do dropdown, Full mailer e o comentário que falha |
| `teste-de-email.mjs` | o botão "Enviar um e-mail de teste": as nove coisas que podem falhar viram nove recados distintos |

```bash
node colisoes.mjs                       # não precisa de servidor nem de npm install
node origem-e-pills.mjs
node relatorios-por-papel.mjs           # usa o stub padrão (admin)
node carga-por-papel.mjs
node quadro-e-acesso.mjs
node ajustes-de-tela.mjs
node teste-de-email.mjs
```

Para rodar por papel, gere um stub com o papel trocado:

```bash
for p in leitura selecao pessoal admin; do
  sed "s/papel:'admin'/papel:'$p'/" stub-supabase.js > /tmp/stub-$p.js
  node relatorios-por-papel.mjs /tmp/stub-$p.js
  node carga-por-papel.mjs      /tmp/stub-$p.js
done
```

## Por que o `colisoes.mjs` existe

Os módulos são **script clássico**, não módulo ES — de propósito, porque os
handlers são `onclick="…"` e precisam de escopo global. O preço é que todos
dividem o mesmo escopo: um `const` repetido entre a casca e um módulo derruba
o módulo **inteiro** no carregamento, e o que aparece na tela é só uma rota
vazia.

Aconteceu duas vezes durante esta fase — `STATUS_SOL` declarado nos dois
lugares, e `STATUS_LIST` declarado num módulo e usado por outro. As duas
regras que saíram daí:

- a **casca** é dona dos nomes compartilhados;
- **módulo não depende de módulo** — e quando precisa, carrega o outro antes,
  com `carregarModulo`.

## Testes que moram noutro lugar

- `../db/testes/` — as migrações rodando em PostgreSQL de verdade;
- `../supabase/functions/*/`, cada função com o seu `*.test.ts`.
