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

As da 2.18.0: `papeis_atuais` devolve o papel da conta do stub (ou
`perfis[0].papeis`, se o teste puser a lista), `conta_ativa` responde falso com
`window.__teste.bloqueada`, e `window.__teste.v218 = 'falta'` faz as funções
novas não existirem, como num banco sem a migração. `grupo_papel_definir`
muda `grupo_papeis` (só admin), `contas_papeis` dá o papel efetivo de cada
conta, e `atividade_espelhar`, `atividade_espelho_remover` e `atividade_mover`
mudam os espelhos do cartão (`espelhos`, `espelhos_ordem`) como o banco.

As da 31.0 (`ps_reagendar`, `ps_slot_editar`, `ps_slot_excluir`) movem,
mudam e excluem o horário no stub, e devolvem quantos candidatos seriam
avisados. Com `window.__teste.ps31` posto antes de a página carregar, a Agenda
da Seleção ganha dois horários de entrevista online abertos pela Ana, a Lia
agendada no primeiro e a confirmação dela já enviada; sem o flag, os testes da
Seleção veem os dados de sempre.

As da 30.0 (`email_destinatarios`, `email_programar`,
`email_programado_cancelar`) contam quem recebe pelos grupos, com os de baixo,
põem na fila e cancelam como o banco; `update` em `email_roteiros` muda a
pílula de verdade, para a tela voltar com o resultado. As imagens do e-mail,
que no ar moram em `membro.neurodynamics.dev/mailer/`, o teste serve da pasta
`../mailer/`: assim ele confere que o PNG de cada cor existe.

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

As da 32.0 (`notificacoes_limpar`, `fila_empurrar`, `fila_situacao`,
`push_inscrever`, `push_cancelar`, `push_meus`, `push_teste`) apagam, inscrevem
e cancelam no stub como o banco; `push_chave_publica` devolve uma chave P-256 de
verdade, para o Chromium aceitar a inscrição. `window.__teste.fila`
(`'parada'` ou `'sem_cron'`) muda o que `fila_situacao` conta, e
`window.__teste.fn` (`'ocupada'`, `'push'`) muda o que a Edge Function
responde. Cada chamada a uma função entra em `window.__invocacoes` como
`{ nome, corpo }`.

As da 2.17.0 também mudam o stub como o banco: `feedback_salvar`,
`feedback_votar`, `feedback_comentar`, `feedback_decidir` e `feedback_excluir`
sobre `soma_feedback_lista` (três relatos: o BUG-1 aberto, a SUG-2 planejada e
o BUG-3 feito); `membro_foto_definir` põe na ficha um endereço que carrega de
verdade (uma imagem em `data:`), para o avatar aparecer; `atividade_editar`,
`atividade_criar`, `atividade_checklist`, `atividade_copiar` e o comentário
que se corrige e se apaga mexem em `atividades_quadro`, na checklist do ORT-1
e nos comentários, com a mesma regra de nível do quadro. O quadro tem o ORT-4
arquivado, para a lista de arquivados. Cada chamada entra em `window.__rpcs`.

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
| `ajustes-de-tela.mjs` | ordem dos grupos, quadro padrão, fundo do dropdown, o Full mailer em tela inteira e o comentário que falha |
| `teste-de-email.mjs` | o botão "Enviar um e-mail de teste": cada coisa que pode falhar vira um recado próprio, e o teste que a passada do agendamento levou antes da do botão conta como enviado |
| `okrs-e-selecao.mjs` | OKRs e Processo Seletivo, vindos do SOMA · Gestão: endereços, menu, permissões por papel, o que cada ação grava — com asserções |
| `grupos-arvore.mjs` | grupos dentro de grupos: a árvore em Administração, quem está pela ficha e por subgrupo, pôr várias pessoas de uma vez, tirar, o pai que não fecha círculo, e a herança no menu, na Agenda e no quadro de pessoal — com asserções |
| `menu-lateral.mjs` | o menu lateral: subitens por papel, item atual, a logo e a casinha que levam ao início, recolher e o voo do trilho (a busca vira só a lupa), a gaveta do celular, nenhuma rolagem horizontal; e o tema — o seletor, a escolha guardada e aplicada antes de a página aparecer, o contraste de cada texto no claro, a faixa de destaque que continua escura e as logos — com asserções (sai com código 1 se algo falhar) |
| `arquivos-e-projetos.mjs` | o controle de arquivos e os projetos: a lista de todos os arquivos como primeira tela, o filtro por emissor e a barra secundária (para revisar, templates, visão geral, configurações), o rol por emissor, a tela do arquivo (etapas, registro de alterações, relações), enviar, aprovar e devolver revisão, template e registro, a estrutura de cada série (a coluna da NRO-PUB-001: a conta que filtra, "O que é este arquivo", o "Adicionar" que pergunta antes de criar), configurações, a exportação no formato da NRO-PUB-001, quem não é gestor, o Pokémon do projeto (escolher e evoluir), a equipe e o rol de um projeto, e o celular — com asserções |
| `studio.mjs` | o Studio: o quadro (colunas, o cartão que espera a sua aprovação, "pronta" só pela aprovação), o calendário (o mesmo componente de mês da Agenda; arrastar muda a data), as ideias, a galeria dos modelos, o criador (desenha, o texto muda a arte, a logo do LABBIO, o tema, lâmina nova, baixar), salvar no quadro (as artes sobem para o bucket, a peça vai junto), aprovar, o plano, as configurações (grupos, imprensa com o id do YouTube, recursos), quem não tem acesso, quem tem mas não aprova, e o celular — com asserções |
| `documentos-e-eventos.mjs` | a declaração de vínculo e os eventos (v25): o bloco "Documentos e acessos" em Serviços e o aviso no início, a prévia (CPF mascarado na tela), emitir — o PDF no modelo da NRO, duas folhas, a frase, a legenda de autenticação em cada folha —, a segunda via, revogar com motivo, a de outra pessoa e o que falta na ficha dela, quem saiu "atuou"; os eventos — meus, para aprovar, todos, a busca, a página do aprovado, a minha declaração em PDF, os e-mails dos externos e mandar de novo, aprovar o que falta e as declarações saírem, registrar com membro e externo (e-mail inválido volta com a linha, o evento no futuro não vai), editar, reabrir revoga, cancelar, as configurações; quem só lê e quem só participou; o celular — com asserções |
| `cofre.mjs` | o cofre (v27): o aviso no início, as contas por categoria, filtrar, ver a senha (e ela sumir sozinha), copiar a senha e o usuário (a área de transferência de verdade), o código de duas etapas conferido pela RFC 6238, as notas, a anterior, trocar a senha com o gerador (tamanho, conjuntos, sem parecidos), a busca; a gestão — todas, os acessos sem conta, o registro de contas em PDF sem segredo nenhum, nova conta com o 2FA pela chave e pelo QR Code de uma imagem, desativar, desligar o 2FA, o registro de uso filtrado, excluir, as configurações; quem só usa e o responsável que não mexe em quem usa; o celular — com asserções |
| `formularios.mjs` | escrever o registro no portal (v26): a série que se escreve no portal, criar o PN e ir direto escrever, as seções, o que já vem preenchido, o que falta, o rascunho que grava sozinho e volta, a prévia em PDF (a frase da ata, as listas com a pontuação do template, as linhas numeradas), mandar — o PDF no bucket, a revisão pendente com os dados, o complemento do título, "escrito no portal" no registro de alterações —; o relatório de teste com a ficha e o roteiro em tabela; o registro aprovado que foi arquivo; Configurações › Formulários (JSON quebrado, tipo que não existe, começar de outro, salvar); as declarações sem "Novo PN"; quem não edita; o celular — com asserções |
| `validacao.mjs` | o `auth.neurodynamics.dev` (a página de `../auth/`): o código em grupos de quatro, O lido como 0, código curto que não vai ao banco, autêntico com e sem o código de controle, controle que não confere, revogado, código que não existe, o QR Code que abre já consultado, a frase do mesmo modelo do portal, a segunda via só da de participação, nova consulta, o celular — com asserções |
| `agenda-e-inicio.mjs` | a agenda no modelo do Google (a semana com as camadas, os atalhos M, D, J, T, criar rápido, a página do evento com predefinido e convidado, reagendar sem apagar perguntando se avisa, responder ao convite, os eventos predefinidos), a presença (quem está no LABBIO, o placar, gerar a folha de check-in: o QR desenhado no PDF é lido de volta com o jsQR e tem de ser o endereço com o token fixo; abrir esse endereço registra; folha revogada não vale), o início (a semana, o convite respondido ali, o placar, as tarefas, os links sem `javascript:`, os abertos por último), o rodapé, os atalhos e Administração › Links úteis — com asserções |
| `treinamentos.mjs` | os treinamentos: o espaço no menu (e Meus pedidos dentro de Serviços, com `#/pedidos` ainda abrindo), o obrigatório no início e na busca, o programa, o módulo em Markdown, o vídeo no player do site, o gabarito que não desce, a verificação reprovada e aprovada, o certificado em PDF e a conferência pelo código, a gestão, o editor que grava sozinho, importar o texto de um agente (o do README e um embrulhado em ```markdown), a pré-visualização, exportar e ler de volta, publicar, atribuir, novo do zero e de um texto, o acompanhamento e o CSV, as configurações e o README (ver, salvar, baixar com as referências, voltar ao padrão), a aba da ficha, quem não gere, quem gere por grupo, e o celular — com asserções |
| `emails.mjs` | os e-mails (v30): o Full mailer em tela inteira (o tile de Relatórios leva até ele), a prévia com o nome de quem escreve, as redes vindas de Studio › Contas (link salvo ou montado pelo usuário, e desmarcar), o botão para uma tela do portal, o rodapé sem link morto, as cores dos seis remetentes (departamentos claros e distintos, a Leadership escura; as imagens da cor nova existem), o rascunho que sobrevive, a marca do nome fora do que se copia; programar (quem recebe e quem está sem e-mail, por grupo com os de baixo, só para mim; o que vai ao banco), a fila e o histórico, reagendar, cancelar; as pílulas (quem assina, para quem, grupo extinto, a série de quatro em quatro dias sem fim de semana e sem repetir a fila, pôr na série, editar, link recusado, abrir no mailer); o link de cada rede no Studio; o Comitê de Seleção sem programar, quem só lê sem entrar, e o celular — com asserções |
| `notificacoes.mjs` | o sino que não empilha e o aviso no aparelho (v32): o × de cada aviso, limpar as lidas, o recado de migração que falta; ativar as notificações neste aparelho (a permissão, a inscrição com a chave do servidor, o nome do aparelho), a notificação de teste, desativar, os outros aparelhos e remover, a permissão bloqueada, o iPhone fora da tela de início, o sino sem convite (ativar é em Preferências de avisos, 2.17.1), sair da conta cancela a inscrição; o empurrão da fila (quando o banco diz que está parada, e só então); o teste de e-mail com a fila ocupada; o card "A fila de envio" em Programados (em dia, parada, sem agendamento) e o "Rodar a fila agora"; o manifesto, os ícones e o `sw.js` — com asserções |
| `tour.mjs` | o tour do SOMA (`tour.html`), de quem ainda não tem conta a quem já entrou: as treze etapas sem erro; criar a conta (o que o formulário recusa, o e-mail em minúsculas, o link que volta para o tour, "confira o seu e-mail", reenviar com espera), entrar (senha errada, e-mail não confirmado, a conta pronta com o primeiro nome), esqueci a senha; com conta, o que é da pessoa: o menu com o que ela alcança, o perfil e os grupos, as tarefas e os quadros dela, a posição no placar, o check-in, os treinamentos, o Studio conforme o acesso (e o que muda para quem não é dos grupos dele), a agenda, a equipe, o celular (iPhone, Android, o QR para o computador, as notificações no aparelho) e a ajuda; o celular de 390 px (nada vaza, a barra de baixo, a gaveta das etapas), os links do e-mail de confirmação vencido e de nova senha, o tema e o "continuar de onde parou" — com asserções |
| `versoes-fotos-e-cartoes.mjs` | a 2.17.0: a versão no rodapé (a que está no ar, lida da casca) e nenhum aviso de versão nova aberto sozinho (2.17.1); as notas (a versão no ar, o número antigo ao lado, a versão em foco pelo endereço, as antigas recolhidas, a busca); os bugs e sugestões (em aberto por votos, filtros, votar, o relato em Markdown, comentar, o andamento pela administração, relatar com a tela de onde se veio e os parecidos, quem não é admin); a foto (o aviso do início, enquadrar e enviar, o arquivo no bucket, a ficha, a câmera no organograma e na ficha só para quem pode); os OKRs (o título inteiro, a mesma altura na linha, a roda que dá zoom e o Shift que move, o fio do pé do pai); os cartões (etiquetas, pessoas e a checklist no quadro, o filtro por etiqueta, a descrição em Markdown com a barra e o Ver, a checklist, pessoas e etiquetas pelo seletor, o @ que marca, o comentário corrigido, a menção antiga, espelhar em outro quadro, tirar o espelho e mover (2.18.0), os arquivados, a atividade nova com pessoas e etiquetas, quem só lê); e o celular — com asserções |
| `papeis-por-grupo.mjs` | os papéis por grupo (2.18.0): a liderança (Administração só com a lista de escrita, o quadro de pessoal, a Seleção, a ficha sem ocorrências e sem editar), a conta bloqueada ("Acesso encerrado." e o portal fechado), o banco sem a 2.18.0 (vale o papel da conta), o papel do grupo em Administração › Grupos (só admin muda) e o papel efetivo com a origem em Contas — com asserções |
| `ps-entrevistas.mjs` | as entrevistas online do PS (v31), em Seleção › Agenda: o link da chamada no lugar do local, com "Criar no Meet"; sem link ou sem https:// não cria; quem abre fica responsável; a dinâmica continua com local; o chip online com o nome; o horário antigo tracejado; o horário com o link, quem abriu e o último e-mail; reagendar o candidato com motivo; mudar hora e link avisando; assumir o horário antigo; excluir avisando; a ficha com a chamada; o celular; e a entrevista reservada na agenda de quem conduz (2.17.1): a camada Entrevistas do PS, só o horário com candidato, a janela com a chamada e a ficha, desligar a camada, o mês, a semana do início e quem não é do comitê sem a camada — com asserções |

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
node agenda-e-inicio.mjs
node emails.mjs
node ps-entrevistas.mjs
node notificacoes.mjs
node tour.mjs
node versoes-fotos-e-cartoes.mjs
node papeis-por-grupo.mjs
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
