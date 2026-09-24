# Testes

Nenhum depende de rede, de conta ou do banco de produção: o Supabase é falso
(`stub-supabase.js`) e o Chromium já vem instalado no ambiente.

O stub não grava as tabelas, mas anota: cada `insert`, `update`, `upsert` e
`delete` entra em `window.__escritas` como `{ tabela, op, dados }`. É por
ali que um teste confere o que uma ação mandaria ao banco — o
`okrs-e-selecao.mjs` usa isso em quase todas as asserções.

As funções do banco que a tela usa para grupos, projetos e arquivos
(`grupo_membros_salvar`, `projeto_salvar`, `doc_revisao_enviar`,
`doc_revisao_decidir`…) fazem mais: mudam os dados do stub como o banco
mudaria, para a tela voltar com o resultado. Cada chamada entra em
`window.__rpcs` como `{ nome, p }`, e o Storage anota em `window.__uploads`,
`window.__baixados` e `window.__removidos`. `window.__teste.envio` faz o
`doc_revisao_enviar` recusar com o status que se quiser.

As funções dos treinamentos (`treinamentos_meus`, `treinamento_conteudo`,
`treinamento_responder`, `treinamento_publicar`…) também mudam os dados do
stub, e a correção da verificação é a mesma do banco: o teste responde errado
e certo e confere o que volta. O progresso da pessoa logada fica em
`window.__treProg`.

Da primeira vez, instale o Playwright (só o pacote — o Chromium já está no
ambiente, e é para ele que os testes apontam com `executablePath`) e o jsPDF
2.5.1, o mesmo que o portal busca no cdnjs: o teste dos treinamentos o serve
daqui, para o certificado sair em PDF sem rede:

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
| `okrs-e-selecao.mjs` | OKRs e Processo Seletivo, vindos do SOMA · Gestão: endereços, menu, permissões por papel, o que cada ação grava — com asserções |
| `grupos-arvore.mjs` | grupos dentro de grupos: a árvore em Administração, quem está pela ficha e por subgrupo, pôr várias pessoas de uma vez, tirar, o pai que não fecha círculo, e a herança no menu, na Agenda e no quadro de pessoal — com asserções |
| `menu-lateral.mjs` | o menu lateral: subitens por papel, item atual, a logo e a casinha que levam ao início, recolher e o voo do trilho (a busca vira só a lupa), a gaveta do celular, nenhuma rolagem horizontal; e o tema — o seletor, a escolha guardada e aplicada antes de a página aparecer, o contraste de cada texto no claro, a faixa de destaque que continua escura e as logos — com asserções (sai com código 1 se algo falhar) |
| `arquivos-e-projetos.mjs` | o controle de arquivos e os projetos: a lista de todos os arquivos como primeira tela, o filtro por emissor e a barra secundária (para revisar, templates, visão geral, configurações), o rol por emissor, a tela do arquivo (etapas, registro de alterações, relações), enviar, aprovar e devolver revisão, template e registro, a estrutura de cada série (a coluna da NRO-PUB-001: a conta que filtra, "O que é este arquivo", o "Adicionar" que pergunta antes de criar), configurações, a exportação no formato da NRO-PUB-001, quem não é gestor, a logo gerada, a equipe e o rol de um projeto, e o celular — com asserções |
| `studio.mjs` | o Studio: o quadro (colunas, o cartão que espera a sua aprovação, "pronta" só pela aprovação), o calendário (arrastar muda a data), as ideias, a galeria dos modelos, o criador (desenha, o texto muda a arte, a logo do LABBIO, o tema, lâmina nova, baixar), salvar no quadro (as artes sobem para o bucket, a peça vai junto), aprovar, o plano, as configurações (grupos, imprensa com o id do YouTube, recursos), quem não tem acesso, quem tem mas não aprova, e o celular — com asserções |
| `treinamentos.mjs` | os treinamentos: o espaço no menu (e Meus pedidos dentro de Serviços, com `#/pedidos` ainda abrindo), o obrigatório no início e na busca, o programa, o módulo em Markdown, o vídeo no player do site, o gabarito que não desce, a verificação reprovada e aprovada, o certificado em PDF e a conferência pelo código, a gestão, o editor que grava sozinho, importar o texto de um agente (o do README e um embrulhado em ```markdown), a pré-visualização, exportar e ler de volta, publicar, atribuir, novo do zero e de um texto, o acompanhamento e o CSV, as configurações e o README (ver, salvar, baixar com as referências, voltar ao padrão), a aba da ficha, quem não gere, quem gere por grupo, e o celular — com asserções |

```bash
node colisoes.mjs                       # não precisa de servidor nem de npm install
node origem-e-pills.mjs
node relatorios-por-papel.mjs           # usa o stub padrão (admin)
node carga-por-papel.mjs
node quadro-e-acesso.mjs
node ajustes-de-tela.mjs
node teste-de-email.mjs
node menu-lateral.mjs
node okrs-e-selecao.mjs
node grupos-arvore.mjs
node arquivos-e-projetos.mjs
node studio.mjs
node treinamentos.mjs
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
lugares, e `STATUS_LIST` declarado num módulo e usado por outro.

O teste lê todo `mod-*.js` da raiz, sem lista fixa: módulo novo entra na
conferência no dia em que nasce. (Com lista fixa, os módulos de OKRs e de
Seleção passaram uma versão inteira sem ser conferidos.) As duas
regras que saíram daí:

- a **casca** é dona dos nomes compartilhados;
- **módulo não depende de módulo** — e quando precisa, carrega o outro antes,
  com `carregarModulo`.

## Testes que moram noutro lugar

- `../db/testes/` — as migrações rodando em PostgreSQL de verdade;
- `../supabase/functions/*/`, cada função com o seu `*.test.ts`.
