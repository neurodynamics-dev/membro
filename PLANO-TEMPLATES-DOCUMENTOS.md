# Plano: templates dos documentos e registros da equipe

Para execução pelo Sonnet. Leia o arquivo inteiro antes de começar. Siga as fases
na ordem; só há **um ponto de parada** (fim da Fase A). O resto roda direto.

## 0. O pedido, em uma frase

Criar os modelos (templates) dos documentos e registros do controle de arquivos
do SOMA (NRO-PUB-001), no formato certo para cada um, no padrão visual da equipe
(NRO-PUB-002), com base em normas técnicas adaptadas a uma equipe de **TRL baixo**
(pesquisa e protótipo de laboratório, TRL 1 a 4).

## 1. Decisões já tomadas (não rediscutir)

| Tema | Decisão |
|---|---|
| Formato | **LaTeX** para o que é longo ou complexo (fórmulas, unidades, muitas figuras, referências, remissões). **DOCX** para o simples. **XLSX** para o que é lista, matriz, registro com conta ou checklist. Critério objetivo na seção 4. |
| Capa | Só o LaTeX longo e o DOCX que sai da equipe ou passa de 6 páginas têm capa. O DOCX simples **não tem capa**. Todo template LaTeX e DOCX com capa aceita também ficar sem (`semcapa`). |
| Onde mora | Repositório `brand`, em `templates/documentos/`. O SOMA não é alterado neste plano. |
| Base visual | O NRO-PUB-002 (`brand/assets/NRO-PUB-002-template-documentos-e-registros.docx`): Arial 20/16/14/11 pt, margens 15 / 12,5 / 32,5 / 25 mm, cabeçalho com logo + departamento em negrito + título + código com `Rev. X`, rodapé com a página. No LaTeX, a mesma folha que a `nro-aacc.cls` já desenha (seção 15 da classe). |
| Códigos e títulos | **Vêm do banco** (Fase A). Nunca invente código, título ou estrutura de série. |
| AACC | `templates/aacc/` (NRO-PES-020) **está pronto e acoplado ao SOMA** (palavras-chave do PDF, `empacotar.sh`). Não mexa nele. Só leia, como referência de padrão. O ZIP enviado pelo usuário é idêntico ao do repositório (conferido). |
| Normas | Ver seção 5. Vale o princípio da proporcionalidade (seção 3). Verifique cada citação (edição, cláusula) com WebSearch antes de escrever num modelo; sem verificar, cite só a norma, sem cláusula. |

## 2. O que já existe (fatos conferidos no código, não releia por completo)

- **Controle de arquivos** (`membro/db/v20…v26*.sql`, `mod-arquivos.js`): tabelas `doc_emissores`, `doc_series`, `doc_arquivos`, `doc_revisoes`, `doc_padrao_projeto`; bucket privado `arquivos`.
- **Código**: `NRO-XXX-YYY-Z`. XXX = emissor (PUB, PES, PRO, CLI, REL, DIR, MKT); YYY = série; Z = PN, quando há mais de um exemplar.
- **Três estruturas de série** (`doc_estrutura()`): `unico` (documento único, sem PN), `documentos` (template; cada PN é um documento que revisa por conta própria), `registros` (template; cada PN é um registro que não muda mais), mais `avulso` (só o NRO-PUB-002). **Template só faz sentido para `documentos`, `registros` e `avulso`.** Série `unico` é o próprio documento: o modelo dela é o documento em branco, e só vale criar se o documento existir como arquivo e o PMO quiser um esqueleto.
- **Registro** não revisa; a "revisão" dele é a do template usado. O cabeçalho do registro mostra a `Rev.` do template.
- **Séries com `formulario`** (v26: ata NRO-PUB-003 e relatório de teste NRO-PRO-003) e **séries com `pn_origem`** (v25: declaração de vínculo NRO-DIR-004, emitida pelo SOMA em `doc-nro.js`) já se escrevem ou emitem no portal. O template delas é só o espelho offline: prioridade baixa e **igual** ao que o portal desenha.
- **Padrão do projeto** (`doc_padrao_projeto`): o rol inicial de um projeto de dispositivo (termo de abertura, USRS, riscos, plano de validação, ISC, DHF, DMF, rastreabilidade, ADR, design record, relatórios). São os candidatos mais fortes a LaTeX e XLSX.
- **Regras de escrita da marca**: `brand/design-system/DIRETRIZES.md`, `v3/readme.md` e a página `/escrita`. Sem travessão como separador, sem ponto médio, sem fonte de código em rótulos. Cores e papéis só de `design-system/tokens.css`.
- **Padrão que o LaTeX do AACC fixou** (reaproveite as ideias, não copie a classe de 3.260 linhas): uma classe que cuida da folha; as regras da equipe fora da classe; **pendências** (tudo o que falta aparece no PDF, caixa amarela no rascunho, vermelha no `final`); `\cod{}` para códigos que nunca quebram; `\NRO` para o nome da equipe; fontes de reserva no pdfLaTeX (TeX Gyre Termes nos títulos, Roboto Light no texto, Archivo nos rótulos, com queda para Times/Helvetica); tabelas com régua (`\reguatopo`, `\cab`, `\reguameio`, `\reguafina`, `\reguabase`); duas regras de quem mexe: sem efeito colateral dentro de `tabularx`, e texto com acento não passa por expansão `x/e` crua.
- **Empacotamento** (`templates/aacc/empacotar.sh`): compila numa cópia limpa e só publica se compilar; o site serve de `brand/assets/`.
- **Ferramentas neste ambiente**: `python-docx` 1.2, `openpyxl` 3.1, LibreOffice, `pdftoppm`, Node 22 estão instalados. **TeX Live não está** (sem `latexmk`/`pdflatex`/`biber`). Veja a Fase B0.

## 3. Princípio de adaptação a TRL baixo

As normas (ISO 13485, IEC 62304, ISO 14971…) foram escritas para quem já tem
produto. A equipe está em TRL 1 a 4. Regra: **a norma dá a estrutura; o TRL dá a
profundidade.** Cada modelo segue estes seis pontos:

1. **Ficha de aplicabilidade.** Todo modelo pergunta o **TRL do item** (1 a 9, escala da ISO 16290) e traz campos marcados `TRL ≥ 5` (ou `≥ 4`). Abaixo desse nível o campo não some: vira "adiado, com o porquê" ou fica recolhido.
   - LaTeX: opção `trl=3` da classe; `\trlmin{5}{…}` esconde o bloco abaixo do nível e o lista numa linha ("adiado até TRL 5: …").
   - DOCX: seção final "Para TRL 5 em diante", opcional, com estilo cinza.
   - XLSX: colunas agrupadas e recolhidas, com cabeçalho "TRL ≥ 5".
2. **Rastreabilidade mínima obrigatória**: toda exigência, risco, teste e decisão tem ID. Isso não se adia: custa pouco e é o que a norma mais cobra depois.
3. **Evidência vale mais que prosa**: onde a norma pede "registro de que foi feito", o modelo pede o identificador de algo que outra pessoa confere (commit, código de arquivo, foto datada, planilha de medição).
4. **Aprovação enxuta**: redator, revisor, aprovador (como no NRO-PUB-002). Nada de cadeia de assinaturas.
5. **Dados de pessoas**: nada de dado pessoal de terceiros nem de participante; onde o assunto é pesquisa com humanos, o modelo aponta o CEP/CONEP e a LGPD e pede só o código anonimizado.
6. **Marcar o que é inspirado, não cumprido**: o texto diz "estrutura inspirada em ISO …", nunca "conforme", porque a equipe não é certificada.

## 4. Critério de formato (aplique a cada série, nesta ordem)

1. **XLSX** se o conteúdo é, na essência, linhas × colunas: rol, matriz, registro de medições, checklist com pontuação, cronograma, orçamento, plano de testes em tabela.
2. **LaTeX** se tem qualquer um destes: equação ou unidade a formatar; 3 ou mais figuras numeradas; referências bibliográficas; remissões e listas geradas (de figuras, tabelas, requisitos); expectativa de mais de 8 páginas; seções que se repetem com ficha técnica.
3. **DOCX** em todo o resto: prosa curta, formulário, declaração, procedimento, política, comunicado, termo.

Capa, nesta ordem: (a) o documento sai da equipe (parceiro, comitê de ética, banca, financiador): **com capa**; (b) mais de 6 páginas esperadas: **com capa**; (c) senão: **sem capa**. Se o critério dá empate, escolha o formato mais simples.

## 5. Matriz de normas (ponto de partida; verifique antes de citar)

| Tema do modelo | Norma de estrutura | Como adaptar a TRL baixo |
|---|---|---|
| Controle de documento, cabeçalho, revisão, registro | ISO 10013:2021 (diretrizes de informação documentada); ISO 9001:2015 7.5; ISO 13485:2016 4.2.4 e 4.2.5; ISO 7200:2004 (campos do cabeçalho) | O cabeçalho é o do NRO-PUB-002; só se acrescenta a tabela de revisões ao fim. |
| Termo de abertura, plano, cronograma | ISO 21502:2020 (gestão de projetos) | Uma página: objetivo, escopo, entregas, equipe, marcos, riscos principais. |
| Exigências do usuário e do sistema (USRS, SRS) | ISO/IEC/IEEE 29148:2018 | ID, texto "o sistema deve…", origem, critério de verificação, prioridade. Sem comitê de mudança. |
| Entradas, saídas, verificação e validação de projeto (DHF, design record, ADR, plano de V&V) | ISO 13485:2016 7.3.2 a 7.3.10; IEEE 1012 | Registro de decisões leve (ADR) no lugar do dossiê pleno; o DHF vira índice com o que existe. |
| Gerenciamento de risco | ISO 14971:2019 e ISO/TR 24971:2020 | Matriz de severidade × probabilidade, risco antes e depois da medida, medida e evidência. Escalas de 3 a 5 níveis, definidas na própria planilha. |
| Software | IEC 62304:2006+A1:2015 | Classe de segurança, requisitos, arquitetura, testes; só o que o TRL justifica. |
| Usabilidade, uso por pacientes | IEC 62366-1:2015+A1:2020 | Especificação de uso e tarefas críticas; teste formativo antes do somativo. |
| Segurança elétrica e EMC | IEC 60601-1; IEC 60601-1-2 | Lista de verificação de pré-conformidade, sem ensaio acreditado. |
| Biocompatibilidade | ISO 10993-1:2018 | Tabela de contato com o corpo e o que se precisaria avaliar. |
| Plano, caso e relatório de teste | ISO/IEC/IEEE 29119-3:2021; ISO/IEC 17025:2017 7.8 (relato de resultado) | Identificação do item e da bancada, método, resultado, incerteza, decisão. Incerteza pelo GUM (JCGM 100:2008). |
| Medição, incerteza, unidades | JCGM 100:2008; ISO 80000-1:2022; SI | Unidades sempre com `siunitx`; incerteza expandida declarada com k. |
| Gestão de configuração, rastreabilidade | ISO 10007:2017 | Matriz exigência ↔ teste ↔ evidência; versão por commit ou código de arquivo. |
| Auditoria e inspeção interna | ISO 19011:2018 | Lista de verificação, constatação, ação, prazo. |
| Treinamento e competência (Pessoal) | ISO 10015:2019 | Quem, o quê, evidência do aprendizado, validade. |
| Pesquisa com humanos, termos | Resoluções CNS nº 466/2012 e 510/2016; ISO 14155:2020; LGPD (Lei nº 13.709/2018) | Termo e protocolo apontam o CEP; dado só anonimizado. |
| Regulatório (horizonte) | ANVISA RDC 751/2022 e RDC 665/2022 | Só uma nota "o que mudará se o item passar do TRL 5". Nada de seção regulatória cheia. |
| Documento acadêmico ou de fomento | ABNT NBR 14724, 6023, 10520, 6024, 6028, 15287 | Só nos modelos de relatório técnico e de projeto de pesquisa. |
| Maturidade da tecnologia | ISO 16290:2013 (TRL) | O campo "TRL do item" de todo modelo. |

## 6. Fases

### Fase A. Levantamento (só leitura) e catálogo. PONTO DE PARADA

**A1.** O usuário vai colar aqui o JSON da consulta da seção 8. Se ele ainda não colou, peça uma vez e pare.

**A2.** Com o JSON, gere `brand/templates/documentos/CATALOGO.md` e `catalogo.json`, uma linha por série, com:
`código da cabeça, título, emissor, estrutura, subtipo, classe, tem arquivo hoje (sim/não, extensão), tem formulário no portal, pn_origem, no padrão de projeto, formato proposto (tex/docx/xlsx/nenhum), capa (sim/não/opcional), normas base (da seção 5), prioridade (P1/P2/P3), observação`.

Regras de preenchimento:
- `estrutura = unico` e já tem arquivo: **nenhum** (o arquivo existente é o documento). Se o PMO nunca anexou arquivo: P3, esqueleto opcional.
- `tem formulário` ou `pn_origem`: **espelho offline**, P3, igual ao que o portal desenha (leia `doc-nro.js` e a definição do formulário antes).
- `padrão de projeto`: P1.
- `registros` e `documentos` fora do padrão de projeto: P2.
- Arquivo atual em `.docx`/`.xlsx` que o PMO anexou: **esse é o ponto de partida do conteúdo**. Baixe, leia o texto (se o JSON trouxer o caminho no bucket e você tiver acesso; senão, só o nome e o tipo) e preserve as seções e os campos que a equipe já usa. O formato novo só muda se o critério da seção 4 disser que o atual está errado; nesse caso, escreva o porquê na observação.
- A série cujo conteúdo você não consegue inferir pelo título e pela descrição vai para uma lista "dúvidas", sem chute.

**A3.** Termine com um resumo curto (contagem por formato, por prioridade, lista de dúvidas) e **pare para o usuário aprovar ou ajustar o catálogo**. Não gere nenhum template antes disso.

### Fase B. Fundações (depois da aprovação)

**B0. Ambiente.** Confira `which latexmk pdflatex biber`. Se faltar, tente `apt-get install -y texlive-latex-extra texlive-lang-portuguese texlive-fonts-extra texlive-bibtex-extra biber latexmk` (e `fonts-roboto`). Se a rede ou o proxy bloquear, rode `read_documentation` (tópico `environment.network` ou `environment.dependencies`) e diga ao usuário o que falta; **não pule** a compilação: gere os `.tex` e marque cada um como "não compilado" no relatório final. DOCX e XLSX seguem normalmente.

**B1. Especificação visual única** (`_gerar/estilo.json`): fontes, tamanhos, cores (nomes dos tokens do `tokens.css` e os valores hexadecimais), margens, o texto do cabeçalho e do rodapé, o estilo da pendência. DOCX, XLSX e LaTeX leem daqui (o LaTeX, copiado à mão para a classe, com comentário apontando o arquivo). Assim os três formatos não divergem.

**B2. Classe `nro-doc.cls`** em `templates/documentos/latex/`. Uma classe **enxuta** (alvo: menos de 900 linhas), nova, **sem** a lógica de AACC (aproveitamento, semestres, SOMA). Leve da `nro-aacc.cls` só o que serve (seções 1, 4, 13 a 18 e a 20, em ideia). Contrato:
- opções: `capa` ou `semcapa` (padrão `semcapa`), `rascunho`/`final`, `trl=N` (padrão 3);
- metadados: `\documento{codigo, titulo, emissor, revisao, redator, revisor, aprovador, data, trl}`; o `codigo` aceita `NRO-PRO-003-7` (com PN);
- a folha do NRO-PUB-002 em toda página, exceto a capa; rodapé com a página "n de N";
- ambientes e comandos: `\secao`-estilo kicker, `\ficha{…}` (a tabela de identificação), `\preencher{…}` (pendência), `\trlmin{N}{…}`, `\cod{}`, `\NRO`, `\exigencia{ID}{texto}{verificação}`, `\decisao{ID}{…}`, `\evidencia{tipo}{id}{o que mostra}{onde conferir}`, `\normabase{…}` (a linha "Base normativa" ao pé do modelo), ambiente `instrucoes` (aparece só em `rascunho`), e `\tabelarevisoes` no fim;
- pendências: lista no começo e na capa, igual ao AACC (`final` com pendência pinta de vermelho e avisa no log);
- fontes e pacotes como na `nro-aacc.cls` (mesma reserva de fontes), `siunitx` com `locale = DE` para vírgula decimal, `biblatex` com `abnt-numeric` só se `\addbibresource` for chamado;
- grava no PDF as palavras-chave `nro-doc`, `documento` (o código), `revisao`, `modo`, `pendencias`.

Aceite: `latexmk -pdf` compila o `modelo-zero.tex` (com e sem capa, `rascunho` e `final`, `trl=2` e `trl=6`) sem aviso de *overfull* gritante; o PDF tem cabeçalho idêntico ao NRO-PUB-002 (compare pelo PNG de `pdftoppm -r 80`).

**B3. Construtor DOCX** (`_gerar/docx_base.py`, `python-docx`). **Parta do próprio NRO-PUB-002.docx**: abra, apague o corpo, preserve estilos, numeração, cabeçalhos e rodapés (ele tem 3 cabeçalhos e 3 rodapés: descubra qual é de capa/primeira página e qual é o padrão). Armadilha conhecida: o texto do cabeçalho vem **partido em vários `w:r`** ("NRO-P", "UB", "-0", "02"), então para trocar o código junte os runs antes. Funções: `novo_documento(codigo, titulo, emissor, rev, com_capa)`, `h1/h2/h3`, `paragrafo`, `tabela(cabecalho, linhas, larguras)`, `pendencia(texto)` (realce amarelo e `[Preencher: …]`), `caixa_instrucao(texto)` (cinza, para apagar), `tabela_revisoes()`, `base_normativa(texto)`. Estilos só os do template (Heading 1/2/3 e Normal). A capa é uma seção própria com cabeçalho diferente na primeira página, e a numeração da página começa no corpo.

Aceite: o `modelo-zero.docx` abre no LibreOffice (converta para PDF e olhe o PNG), os estilos são os do NRO-PUB-002 e nenhuma fonte é diferente de Arial.

**B4. Construtor XLSX** (`_gerar/xlsx_base.py`, `openpyxl`). Convenção:
- 1ª aba `Controle`: código, título, emissor, `Rev.`, TRL do item, redator, revisor, aprovador, data, base normativa, instruções; 2ª em diante: dados;
- Arial 10; cabeçalho de tabela em Cortex com texto branco; células de entrada em amarelo claro (pendência), de fórmula em cinza e **bloqueadas** (proteção da planilha sem senha); validação de dados em toda coluna de categoria (listas dos níveis de risco, status, TRL); tabelas do Excel (`Table`) para filtro e ordenação; linha de cabeçalho congelada;
- impressão em A4, ajustada à largura, cabeçalho e rodapé com código e `Rev.`;
- fórmulas só com funções que o Excel e o LibreOffice leem igual; nada de macro; sem referência externa;
- abas de apoio `Listas` (ocultas) e `Legenda`.

Aceite: abre no LibreOffice sem erro; recalcular (`soffice --headless --convert-to xlsx` e reler com `openpyxl data_only=True`) não deixa `#REF!`, `#NAME?`, `#VALUE!` em nenhuma célula; `modelo-zero.xlsx` com uma matriz 5×5 de risco funcionando.

### Fase C. Os modelos, por prioridade

Para cada linha do catálogo aprovado, na ordem P1, P2, P3, em lotes por emissor (PRO primeiro):

1. Crie `latex/modelos/<codigo>-<slug>/main.tex`, `docx/<codigo> <TITULO EM MAIÚSCULAS>.docx` ou `xlsx/<codigo> <TITULO EM MAIÚSCULAS>.xlsx`. O nome do arquivo segue o padrão do NRO-PUB-002: `NRO-XXX-000 TITULO DOCUMENTO`.
2. Conteúdo de cada modelo:
   - a `ficha` (código com `Rev. A`, título, emissor, redator, revisor, aprovador, data, **TRL do item**);
   - as seções que a norma-base pede, **numeradas**, cada uma com uma instrução de uma a três linhas ("o que escrever aqui") e, quando couber, um exemplo curto em cinza;
   - os blocos `TRL ≥ N`, conforme a seção 3;
   - `Base normativa`: uma linha, com a norma e a cláusula (ou só a norma, se não verificou);
   - a tabela de revisões (Rev, data, o que mudou, redator, revisor, aprovador). **Em registro, não há tabela de revisões**: há a linha "Template usado: NRO-XXX-YYY Rev. N";
   - nenhuma sigla sem definição na primeira vez; pt-BR; regras de escrita da marca.
3. Famílias já previstas (ajuste ao catálogo aprovado, não ao contrário):
   - **LaTeX**: relatório técnico e de teste com incerteza (se não for só o formulário do portal), USRS/SRS, plano de V&V, design record, dossiê (DHF) como índice, análise de segurança de software, projeto de pesquisa. Cada um com **exemplo fictício completo** em `latex/exemplos/` (marca d'água "EXEMPLO FICTÍCIO", como o AACC), com uma equação, uma tabela de unidades e uma figura.
   - **XLSX**: análise de risco (ISO 14971), matriz de rastreabilidade, plano e registro de testes, cronograma/marcos, orçamento, inventário de equipamentos e calibração, lista de verificação de auditoria, registro de treinamentos.
   - **DOCX**: termo de abertura, ADR, política e procedimento, edital, comunicado, termo de consentimento (com CEP), declaração, plano de projeto de uma página.
4. Valide cada um **assim que o criar** (ver seção 7). Não acumule para validar no fim.
5. Se o catálogo trouxer um arquivo atual da equipe, a Fase C começa por ele (preserve, reformate, não reescreva a política da equipe).

### Fase D. Empacotamento e publicação

- `templates/documentos/empacotar.sh`: compila todos os `.tex` numa cópia limpa e só publica se todos compilarem; gera `brand/assets/documentos/` com cada DOCX e XLSX, e um ZIP por modelo LaTeX (classe + `main.tex` + logo, abre direto no Overleaf) e um ZIP `nro-doc-base.zip` com a classe e o `modelo-zero`. **Não** reaproveite nem altere o `empacotar.sh` do AACC.
- `templates/documentos/LEIAME.md`: o critério de formato (seção 4), o princípio de TRL (seção 3), como usar cada formato, como o PMO anexa o arquivo no SOMA (Arquivos, cabeça da série, "Anexar o arquivo desta revisão") e como mudar um modelo (regenerar pelo `_gerar/`, nunca editar o `.docx` à mão sem atualizar o gerador).
- Atualize `brand/aplicacoes/documentos-registros/index.html` (hoje só o NRO-PUB-002) com a lista dos modelos e os links, seguindo o HTML que já existe; e a seção do `brand/README.md` ("Templates de documentos e registros").
- Rode `node scripts/auditar.mjs` e `node scripts/conferir.mjs` do `brand` nos arquivos que tocou, se o ambiente permitir (veja o `README.md` do brand).

### Fase E. Entrega

- Commit nos dois repositórios, **na branch `slp/gallant-bell-ut8abx`** (já é a atual em ambos), mensagens claras; push com `git push -u origin slp/gallant-bell-ut8abx`; **PR em rascunho** para cada repositório que mudou (o `membro` só muda se o plano pedir algo dele; este arquivo de plano pode ficar no `membro`, como os outros `PLANO-*.md`).
- Relatório final curto: o que foi gerado (contagem por formato), o que **não compilou ou não foi verificado** (LaTeX sem TeX Live, normas sem cláusula verificada), as dúvidas pendentes do catálogo e o que o PMO precisa fazer no SOMA (anexar os arquivos).

## 7. Verificação (por modelo, antes de seguir ao próximo)

| Formato | Conferir |
|---|---|
| LaTeX | compila com `latexmk -pdf` em `rascunho` e `final`; `trl` baixo e alto; sem `Overfull \hbox` maior que 5 pt; cabeçalho igual ao NRO-PUB-002; PNG da primeira página e de uma página interna olhados de fato (use `Read` na imagem); nenhuma pendência no exemplo fictício |
| DOCX | converte para PDF no LibreOffice sem perda; só Arial; cabeçalho com o código certo; só estilos do template; busca por `Preencher` acha só o que deve; PNG olhado |
| XLSX | recalcula sem erro; proteção ligada; validações presentes; impressão em A4 na largura; PNG da primeira aba olhado |
| Todos | sem dado pessoal real; nomes de pessoa fictícios só nos exemplos; texto sem travessão como separador e sem ponto médio; código sempre no padrão `NRO-XXX-000` e sem quebra; nome do arquivo no padrão do NRO-PUB-002 |

Um modelo que reprova uma conferência não segue. Corrija ou registre o motivo no relatório final.

## 8. Consulta para o usuário rodar no Supabase (SQL Editor → Run)

Devolve **uma única célula JSON**. Clique na célula, copie o valor e cole no chat.
É só leitura. Se der erro de coluna (`formulario` ou `pn_origem`), a migração
v26 ou v25 não foi aplicada: apague essas duas linhas do `select` e rode de novo.

```sql
with cab as (
  select s.prefixo, s.sn, s.titulo, s.tipo, s.subtipo, s.classe, s.multiplo, s.descricao,
         public.doc_estrutura(s.tipo, s.multiplo, s.subtipo) as estrutura,
         s.pn_origem,
         (s.formulario is not null) as tem_formulario,
         g.nome as grupo_revisor,
         a.codigo, a.status, a.rev_vigente,
         r.nome_original, r.mime, r.tamanho, coalesce(r.importada, false) as rev_importada,
         (r.caminho is not null) as tem_arquivo,
         (select count(*) from public.doc_arquivos f where f.serie_id = s.id and f.pn is not null) as n_pns,
         exists (select 1 from public.doc_padrao_projeto p where p.serie_id = s.id) as padrao_projeto
    from public.doc_series s
    left join public.grupos g on g.id = s.grupo_revisor
    left join public.doc_arquivos a on a.serie_id = s.id and a.pn is null
    left join lateral (
      select r2.* from public.doc_revisoes r2
       where r2.arquivo_id = a.id and r2.estado = 'aprovada'
       order by r2.enviado_em desc limit 1
    ) r on true
)
select jsonb_build_object(
  'emissores', (select jsonb_agg(jsonb_build_object('prefixo', e.prefixo, 'nome', e.nome) order by e.ordem)
                  from public.doc_emissores e),
  'series',    (select jsonb_agg(to_jsonb(c) order by c.prefixo, c.sn) from cab c)
) as resultado;
```

Os campos que o Sonnet usa: `estrutura`, `subtipo`, `tem_arquivo` + `nome_original` +
`mime` (o que a equipe já anexou), `tem_formulario`, `pn_origem`, `padrao_projeto`,
`n_pns` (quantos exemplares já existem) e `descricao`.

## 9. O que **não** fazer

- Não alterar `templates/aacc/`, `nro-aacc.cls`, `doc-nro.js`, nem migrações do SOMA.
- Não inventar código de série, título, nome de departamento ou norma interna.
- Não gerar template antes da aprovação do catálogo (Fase A3).
- Não citar cláusula de norma sem verificar.
- Não pôr dado pessoal real, nem de participante de pesquisa, em nenhum exemplo.
- Não empurrar para outra branch além de `slp/gallant-bell-ut8abx`.
- Não perguntar ao usuário o que este plano já decidiu. Só pare onde está marcado (A3) ou se algo bloquear de fato.
