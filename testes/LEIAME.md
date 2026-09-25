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

As da 25.0 à 27.0 também: a declaração emite e revoga, o evento anda de
rascunho a aprovado com as regras do banco (quem vê, quem aprova, nunca quem
mandou) e emite uma declaração por participante; o cofre decide quem usa e
quem mantém como o banco, e o código de duas etapas é calculado de verdade
(RFC 6238, com o crypto do navegador) — o teste confere com o que calcula por
conta própria; o formulário grava o rascunho e manda a revisão. Com
`window.__teste.dir` posto **antes** de a página carregar (um
`addInitScript`), o rol ganha a Diretoria e as duas séries das declarações,
cujos PNs não moram no rol — sem ele, o rol é o de sempre, e os testes de
Arquivos não mudam.

Os PDFs são conferidos pelo texto que o modelo escreveu: `DocNRO.baixar` (e
`DocNRO.abrir`, na prévia) deixam em `window.__docnro` o nome do arquivo, o
número de folhas e o texto de cada uma.

Da primeira vez, instale o Playwright (só o pacote — o Chromium já está no
ambiente, e é para ele que os testes apontam com `executablePath`) e as
bibliotecas que o portal busca na rede, nas mesmas versões: o jsPDF 2.5.1 (do
cdnjs), o qrcode-generator 1.4.4 e o jsQR 1.4.0 (do jsDelivr). Os testes os
servem daqui, para os PDFs e os QR Codes saírem sem rede:

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
| `documentos-e-eventos.mjs` | a declaração de vínculo e os eventos (v25): o bloco "Documentos e acessos" em Serviços e o aviso no início, a prévia (CPF mascarado na tela), emitir — o PDF no modelo da NRO, duas folhas, a frase, a legenda de autenticação em cada folha —, a segunda via, revogar com motivo, a de outra pessoa e o que falta na ficha dela, quem saiu "atuou"; os eventos — meus, para aprovar, todos, a busca, a página do aprovado, a minha declaração em PDF, os e-mails dos externos e mandar de novo, aprovar o que falta e as declarações saírem, registrar com membro e externo (e-mail inválido volta com a linha, o evento no futuro não vai), editar, reabrir revoga, cancelar, as configurações; quem só lê e quem só participou; o celular — com asserções |
| `cofre.mjs` | o cofre (v27): o aviso no início, as contas por categoria, filtrar, ver a senha (e ela sumir sozinha), copiar a senha e o usuário (a área de transferência de verdade), o código de duas etapas conferido pela RFC 6238, as notas, a anterior, trocar a senha com o gerador (tamanho, conjuntos, sem parecidos), a busca; a gestão — todas, os acessos sem conta, o registro de contas em PDF sem segredo nenhum, nova conta com o 2FA pela chave e pelo QR Code de uma imagem, desativar, desligar o 2FA, o registro de uso filtrado, excluir, as configurações; quem só usa e o responsável que não mexe em quem usa; o celular — com asserções |
| `formularios.mjs` | escrever o registro no portal (v26): a série que se escreve no portal, criar o PN e ir direto escrever, as seções, o que já vem preenchido, o que falta, o rascunho que grava sozinho e volta, a prévia em PDF (a frase da ata, as listas com a pontuação do template, as linhas numeradas), mandar — o PDF no bucket, a revisão pendente com os dados, o complemento do título, "escrito no portal" no registro de alterações —; o relatório de teste com a ficha e o roteiro em tabela; o registro aprovado que foi arquivo; Configurações › Formulários (JSON quebrado, tipo que não existe, começar de outro, salvar); as declarações sem "Novo PN"; quem não edita; o celular — com asserções |
| `validacao.mjs` | o `auth.neurodynamics.dev` (a página de `../auth/`): o código em grupos de quatro, O lido como 0, código curto que não vai ao banco, autêntico com e sem o código de controle, controle que não confere, revogado, código que não existe, o QR Code que abre já consultado, a frase do mesmo modelo do portal, a segunda via só da de participação, nova consulta, o celular — com asserções |
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
node documentos-e-eventos.mjs
node cofre.mjs
node formularios.mjs
node validacao.mjs                      # a página de ../auth/, servida pelo mesmo servidor
```

Os testes que baixam PDF lançam o Chromium com `LANG=C.UTF-8`: o nome dos
arquivos tem acento (`NRO-DIR-004-17 DECLARAÇÃO DE VÍNCULO - …pdf`), e num
ambiente sem locale UTF-8 o Chromium troca o nome por "download".

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
