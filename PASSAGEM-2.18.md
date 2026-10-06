# SOMA 2.18.0: passagem de trabalho

Documento único para quem assume a versão 2.18.0 a partir do branch `claude/soma-2.18` (PR #35, rascunho, base `main`).
Contém o pedido, as decisões já tomadas pelo dono do produto, o que já foi feito, o plano detalhado do que falta e, nos anexos, as especificações e os mapas do código.
**Remova este arquivo no commit final da integração** (é documento de trabalho, não do produto).

---

## 1. Contexto

- **Repositório `neurodynamics-dev/membro`**: o SOMA, portal do membro da NeuroDynamics (`membro.neurodynamics.dev`). SPA em script clássico:
  - `index.html` é a casca: CSS inteiro, tokens, roteador (`ROTAS`, `ALIAS`), menu (`arvoreDoMenu()`), helpers (`dica`, `toast`, `abreModal`, `confirma`, `copiar`, `navNivel1/2`, `can()`, `gruposEfetivos`, `registrarBusca`, `carregarModulo`, `ICONS`/`ic`, `MOTIVO_RPC`, `URL_APP`).
  - `mod-*.js` são módulos carregados sob demanda; um módulo nunca depende de outro (o que é compartilhado sobe para a casca).
  - Banco no Supabase com RLS; migrações em `db/`; documentação em `README.md`, `PADROES.md` (regras do projeto: **leia inteiro**), `db/LEIAME.md`, `testes/LEIAME.md`.
- **Repositório `neurodynamics-dev/brand`** (`brand.neurodynamics.dev`): design system v2 em `design-system/` (`DIRETRIZES.md`, `tokens.css`, `neuro.css`, `formal.css`, `previews/`), templates em `templates/`, logos em `assets/`. É a fonte das regras visuais.
- **Pedido original do dono (resumo fiel):**
  1. Aplicar o design system v2 ao portal.
  2. Criar no portal o módulo interno de marca (galeria com downloads, templates guardados em Arquivos, controlados com download restrito a grupos, assinatura de e-mail, exportações de interface e prompts para LLMs).
  3. Transformar o site brand num manual da marca interativo, por páginas, com **uma barra de navegação só**, o mais expressivo possível (animações de rolagem, mockups, galeria criativa), downloads só pelo Brandfetch, levando ao módulo interno.
  4. Rever a linguagem do SOMA inteiro: direta, formal, menos explicativa; explicação necessária vai para o ícone de informação (`dica()`); remover travessões e pontos médios onde não cabem. Exemplo dado pelo dono de texto a remover (óbvio): "A declaração sai na hora, em PDF, no modelo da NRO: os dados da sua ficha na primeira folha e, na segunda, os treinamentos concluídos e os eventos de que você participou. Ela não fica guardada no portal — cada emissão ganha um código verificador, e quem a receber confere em auth.neurodynamics.dev."
  5. URLs limpas (sem `.html`).
  6. Mais oito pedidos acrescentados depois (reporte semanal, notificações, agenda, autosave, QR, papéis por grupo, ata de evento, Studio por IA) e dois extras (copiar e-mail do candidato, card espelhado). Os já feitos estão na seção 3; os restantes, na seção 4.
- **Tudo sai numa versão só: 2.18.0.** Uma migração só: `db/2.18.0_soma.sql` (cada etapa acrescenta uma seção), teste de banco em `db/testes/2.18.0_soma.sql`.

## 2. Decisões vinculantes do dono

**Linguagem (todo texto novo ou reescrito):** direto, formal, impessoal ou imperativo; sem conversa ("dá para", "é só", "a gente", exclamação, pergunta retórica); não explicar o óbvio; explicação necessária em `dica(texto)`; estado vazio é uma linha; sem travessão nem ponto médio em frase ou rótulo (exceções: "—" como marca de campo vazio; "·" só na tipografia dos PDFs e nas artes do Studio); erros "Não foi possível <ação>: <motivo>."; sem permissão via `MOTIVO_RPC.sem_permissao`; sem emoji; glifos permitidos → ↓ ✓ ! × i; caixa de frase; separadores 1.284 e 0,94. Detalhes em PADROES.md §9 e no anexo A.

**Design v2 (pontos que mais se erram):** famílias de quatro tons; Synapse (#CEDC00) só para foco, o único CTA sólido, marcas curtas e contadores de pendência; seleção nunca em Synapse (9% neutro, ink 600); funcional (Nominal, Caution, Critical, Signal, Idle) só para estados de interface e nunca como texto no tom primary; uma família por superfície; brilho e gradiente só no Cortex; sem pílula (chips 6px, pills/tags 5px, contadores 4px, botões/campos 11px); rótulos em Archivo 600 caixa alta; IBM Plex Mono só para código e dado; texto corrido em Instrument Sans; barras de comparação em traços; select nunca com a lista nativa. Tokens decididos para a casca: anexo B ("Tokens da casca").

**Papéis e permissões (já implementados, seção 3):**
- admin: individual (`perfis.papel='admin'`), acesso ilimitado, recebe avisos de sistema (bugs novos etc.).
- pessoal = grupo `NRO_PESSOAL`; seleção = `NRO_PS`; liderança = `NRO_LEADERSHIP` (gerentes e supervisores; cada um responde por um departamento ou projeto).
- Liderança: todos os módulos; escreve em OKRs, avisos, documentos, agenda, Studio, treinamentos, projetos/arquivos, e-mails programados, Seleção, links úteis e site; não escreve em contas, grupos, solicitações de acesso, ouvidoria, cofre e folha de check-in; vê todos os quadros mas só escreve nos dos seus grupos; vê a ficha completa dos membros, exceto ocorrências.
- leitura: padrão de todo membro ativo. Desligado, Egresso e Sob demanda: sem acesso a nada.
- Card espelhado: o mesmo card visível em vários quadros; edita quem tem escrita em qualquer quadro ligado; espelhar card de quadro reservado num quadro aberto o torna visível a quem lê o quadro aberto (aceito).

**Reporte semanal e newsletter:** cada membro de `NRO_LEADERSHIP` preenche o reporte do seu departamento ou projeto; a newsletter (semanal para membros, mensal para a comunidade) só sai após aprovação: gera um card de aprovação que exige pelo menos três aprovações de membros de `NRO_LEADERSHIP`.

**Check-in:** uma folha de QR estático para todo o check-in; só admin gera; gerar invalida a anterior (com aviso); não existe baixar de novo (já implementado).

**Notificações:** padrão e-mail semanal; preferência por tipo × canal; convites de evento e pílulas sempre e-mail instantâneo (já implementado).

**Repositório brand:** o material controlado que hoje está público (templates de certificado, convite, crachá, selos, o .docx) fica como está; os estáticos (wallpapers, capa do LinkedIn) são arquivos prontos no repo brand em `downloads/`, gerados por script com as fontes reais, e o portal aponta direto para eles.

## 3. O que já foi feito (no branch, enviado ao PR #35)

**Etapa 1, correções** (commits c96fb17…2eb0627):
- Apontamento semanal: `topo` indefinido corrigido em `salvarApontamento` (a tela travava depois de gravar); trava de envio duplo; lista só os grupos do membro (`gruposApontaveis()`). A tela será substituída pelo Reporte semanal (seção 4.1).
- Card de atividade (`mod-atividades.js`): `mudarCampo` não redesenha; texto salva 1,5 s após a última tecla e no blur; clicar dentro do título em edição não recria o campo (a causa real do bug relatado).
- Agenda: disponibilidade nas 24 h (`AG_D0=0`, `AG_D1=24`); "Próximo horário livre" varre a partir do último sugerido. Pendência: a carga do Início ainda usa `EXPEDIENTE` (`index.html`, ~6311).
- Seleção: botão de copiar ao lado do e-mail do candidato (ficha e lista).
- Check-in: folha única de QR, só admin gera (`checkin_folha_criar`/`_revogar`), confirma() avisa, PDF só na geração, token fora do grant de select. Pendência: `db/testes/v29_presenca.sql` assume que Pessoal gera folha; ajustar ou documentar no LEIAME.

**Etapa 2, papéis por grupo e card espelhado:**
- `grupo_papeis`, `papeis_atuais()`, `tenho_papel()`, `papel_atual()` por precedência (admin > pessoal > lideranca > selecao > leitura; conta bloqueada/sem perfil recebe `'nenhum'`, não null), `conta_ativa()` e política restrictive em todas as tabelas com RLS via `conta_ativa_travar()` (**toda seção nova que criar tabela com RLS deve chamar `select public.conta_ativa_travar();` no fim**).
- Ficha: dados_pessoais, avaliações e acessos para admin, pessoal e liderança; ocorrências só admin e pessoal; inserts abertos fechados (a ocorrência da sinalização do apontamento passa por `apontamento_ocorrencias`). Isso fecha um furo real de produção (anexo C).
- Front: `state.perfil.papeis`, helpers por papel, tela "Acesso encerrado.", papel do grupo em Administração › Grupos (só admin), papel efetivo e origem em Contas.
- Card: "Copiar para outro quadro" virou "Espelhar ou mover".
- Teste novo `testes/papeis-por-grupo.mjs`. Avisos e riscos para produção no anexo D (inclui consultas que o admin deve rodar antes de aplicar).

**Etapa 3, notificações por tipo e canal:**
- `notificacao_canais` (membro × tipo; sem linha = push ligado + e-mail semanal), migração das preferências antigas, categorias de tipo (tabela no README de `supabase/functions/notificar-email`).
- `notificar-email`: instantâneo, resumo diário 8h e semanal segunda 8h (Brasília) agrupados por categoria, pelo cron `soma-fila` existente; push respeita a escolha; conta inativa não recebe. `agenda-sync` usa `papeis_atuais()` e recusa conta inativa.
- Tela de preferências: tabela tipo × (push, e-mail). Convites e pílulas numa linha informativa.
- Pendências: convites de evento ainda vão para membros "Sob demanda" (agora bloqueados): filtrar na fila; o painel da fila conta avisos à espera do resumo como pendentes. Produção no anexo E.

**Nada foi feito ainda** das etapas 4 a 12 abaixo, nem no repositório brand.

## 4. Plano do que falta (nesta ordem)

Regras de trabalho que funcionaram: uma etapa por vez, direto no branch; telas novas já nascem na linguagem nova e nos componentes v2 que existirem; testes do domínio a cada etapa e bateria completa só na integração; commits temáticos em português no estilo do repo.

### 4.1 Reporte semanal, feed e newsletter
Substitui o "Apontamento semanal" (mod-gestao.js) por **Reporte semanal**, visível só para `NRO_LEADERSHIP` (mais admin). Rito em três etapas, por departamento ou projeto de cada responsável:
1. **Apontamento dos membros** (o que já existe, corrigido na etapa 1), com sinalização que abre card para o Depto. de Pessoal (mecanismo existente).
2. **Escalonamento:** o responsável aponta cards e acrescenta tópicos livres para a próxima reunião (ex.: "card X parado por falta de material"; "fulano saiu da equipe e não há para quem passar a atividade").
3. **Feed da equipe:** itens com título, subtítulo obrigatório, texto completo e imagem opcional (Storage), sobre a equipe toda (conquistas, progressos). Os itens formam o **feed da equipe**, visível no portal para todos.
- **Ciclo programado:** prazo de preenchimento e reunião designada (configuração por admin/liderança).
- **Painel do admin** (o dono chamou de "meu painel"): quem do NRO_LEADERSHIP já preencheu e botão para baixar o **Reporte unificado** (PDF pelo `doc-nro.js`, registro formal): resumo dos reportes, cards atrasados, cards com mais de dois replanejamentos de prazo (o histórico de prazo já é gravado), outras ocorrências relevantes. Serve de pauta da reunião.
- **Newsletter:** semanal para membros, mensal para a comunidade (familiares, professores associados, stakeholders), montada com o conteúdo do feed nos templates de e-mail novos do brand (`templates/email/Boletim.html` e variantes por família). Antes de sair, gera **card de aprovação que exige 3 aprovações de NRO_LEADERSHIP**. Lista da comunidade: cadastro por admin (importação de planilha em Administração), sem conta no SOMA, com **descadastro por link com token no rodapé** (página pública, por exemplo `/descadastrar?t=…`, RPC security definer). Notificações do tipo "reporte" usam a categoria criada na etapa 3.
- Esboço de dados no anexo F (§4 do diagnóstico). Duas sessões sugeridas: portal; newsletter.

### 4.2 Ata de evento
Nos tipos de evento predefinidos (agenda), opção "gerar ata". Na página do evento, botão abre o formulário de ata de Arquivos (mesmo mecanismo de `mod-formularios.js`) já preenchido com os dados do evento; o membro completa, **salva o rascunho antes de gerar o arquivo** e registra a ata (PN) na série de atas. Ver anexo F.

### 4.3 Casca no design v2
Tokens escuro e claro, fontes, rótulos, formas, seleção quieta, componentes, logos (escuro com o arquivo branco, claro com o preto, URLs do brand), select v2 por realce progressivo global (o `<select>` nativo fica no DOM com opacidade 0 para `page.selectOption()` continuar funcionando), tabelas de cor do JS. Plano completo e seletores no anexo G (`css-casca.md`) e decisões no anexo B. Atenção aos testes de contraste e da "ilha" em `testes/menu-lateral.mjs` (o teste exige >40 tokens no bloco `:root[data-tema="claro"]` com grafia idêntica dentro de `.sl-destaque`).

### 4.4 Módulo Marca
Espaço "Marca" (ícone palette), depois de Studio e antes de Equipe; ordem esperada nos testes `Agenda|Atividades|OKRs|Projetos|Arquivos|Studio|Marca|Equipe|Treinamentos|Serviços|Seleção|Administração` (ajustar `testes/menu-lateral.mjs:80-83` e `testes/treinamentos.mjs:75`). Rotas `#/marca`, `#/marca/assinatura`, `#/marca/interfaces`, `#/marca/config`. Especificação completa no anexo B ("Módulo Marca"). **Diferença em relação ao anexo B:** a migração não é `2.18.0_marca.sql`; vai como seção da `db/2.18.0_soma.sql`.

### 4.5 Studio
Criador na v2 (temas por família com mapa de apelidos para peças salvas, logos v2, Instrument Sans, sem logo em Synapse, sem pílula, sem emoji), certificado de treinamento no padrão `certificate-brand`, "Brand guidelines" → "Manual da marca" com atalho a `#/marca`. **Novo:** README padrão para IA (como o de treinamentos em `mod-treinamentos.js`), que descreve templates, leiautes, tamanhos, temas, regras da marca e um formato de arquivo (Markdown com bloco estruturado ou JSON) que a IA produz; importação desse arquivo em "nova ideia"/criador, que interpreta e gera a publicação planejada (modelo, sequência de lâminas, textos). Baseado nas diretrizes novas do brand. Disponibilizar o README para download no Studio e no Marca › Interfaces. Plano visual no anexo H (`studio-e-brand.md`, parte A).

### 4.6 Linguagem
Casca e módulos, em lotes, só texto (anexo I, `linguagem.md`, com contagens, exemplos de reescrita, armadilhas que não podem mudar e testes que leem texto). Corrigir antes o seletor da dica para `button.dica` (bug documentado no anexo I §3). Telas criadas nas etapas 4.1 a 4.5 já devem nascer no padrão.

### 4.7 PDFs, e-mail e páginas avulsas
`doc-nro.js` e `mod-relatorios.js` no registro formal v2 (paleta, sem justificar, sem zebra, cabeçalho de documento controlado, código fora de Courier); `mod-mailer.js` nas famílias v2; `tour.html` (acrescentar Marca nas cópias do menu), `quiosque.html` (regras de quiosque), `rsvp.html` (pública, sem a onda branca), `auth/index.html` (tema claro), `admin.html`; templates de e-mail do Supabase (`supabase/templates/gerar.mjs`); URLs limpas (`/rsvp`, `/quiosque`, `URL_APP()` sem `index.html`); normalizar " — " dos títulos de aviso para ": " na exibição (sino e e-mail). Detalhes nos anexos G2 (§2 e §3) e I.

### 4.8 Site brand (repositório `neurodynamics-dev/brand`)
Branch novo a partir de `main` (ex.: `claude/manual-paginas`). Especificação completa no anexo J (`BRAND.md`): páginas `/`, `/marca`, `/cores`, `/tipografia`, `/escrita`, `/elementos`, `/aplicacoes`, `/galeria`, `404`; cabeçalho e rodapé carimbados por script; uma barra de navegação; mockups; galeria expressionista; nomes fictícios (elenco no anexo A); miniaturas regeneradas; `downloads/` com 16 wallpapers e a capa do LinkedIn (script); favicon sem a onda branca; `template.html` v2; tema claro do portal e regras do menu acrescentados ao design system; redirecionamento dos hashes antigos.

### 4.9 Integração
- `db/2.18.0_soma.sql`: insert em `migracoes` (`'2.18.0_soma'`), bloco CONFERIR, cabeçalho com pré-requisitos; `db/LEIAME.md` (ordem, tabela, parágrafo da 2.18.0, comandos de teste e contagem de asserções).
- `VERSAO = '2.18.0'` em `index.html` (mantenha o formato da linha: um teste lê com regex) e entrada nova no alto de `NOTAS_VERSAO` (`mod-versoes.js`), no tom do §9. Avisar na nota: quem tinha "imediato" sem ter escolhido passa ao resumo semanal; papéis agora vêm dos grupos.
- README (tabela de arquivos, módulos novos), PADROES §1 e §2 (espaço Marca, rotas), `testes/LEIAME.md` (testes novos: `papeis-por-grupo`, `marca`, `select` se houver).
- Bateria completa de navegador e de banco; checklist de produção (anexos D e E e o que as etapas seguintes acrescentarem); PR #35 sai de rascunho; PR do brand.
- Apagar este arquivo.

## 5. Como rodar os testes

- **Navegador:** na raiz, `python3 -m http.server 8765`; em `testes/`, `npm install` (uma vez) e `node <teste>.mjs`. Chromium em `/opt/pw-browsers/chromium` (ambiente Claude Code na nuvem). Lista e ordem em `testes/LEIAME.md`. Bateria completa ~15 min. Stub do Supabase em `testes/stub-supabase.js` (escritas não mudam os dados; RPC desconhecida devolve ok, então ramo que falta passa calado).
- **Banco:** PostgreSQL local (`pg_ctlcluster 16 main start`), como usuário `postgres` (`runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1`), banco novo a partir de `db/testes/esqueleto.sql` (+ `esqueleto_storage.sql`) e das migrações na ordem do `db/LEIAME.md`, depois `db/testes/2.18.0_soma.sql` (193 asserções verdes ao fim da etapa 3).
- Funções do Supabase: os `.ts` rodam com Node 22 `--experimental-strip-types` (Deno não está instalado).
- Nunca escreva no Supabase de produção.

---

# Anexos

Os anexos foram escritos antes ou durante as etapas 1 a 3. Números de linha dos mapas (anexos G, H, I e parte do F) referem-se a `main` bdfdba9 e já se deslocaram; use grep. Onde os anexos falam em worktrees, portas 8801-8810, agentes paralelos ou `$S/teste.sh`, ignore: o trabalho agora é sequencial no branch, com a porta 8765.



---

## Anexo A: regras comuns (linguagem, design, nomes fictícios, URLs)

### Comum a todos os agentes (SOMA 2.18.0 e site brand)

Scratchpad: `S=(scratchpad da sessão anterior, indisponível)`

### O pedido do usuário
Texto literal em `$S/pedido-usuario.txt`. Leia antes de começar. Resumo:
- **Portal (repo `neurodynamics-dev/membro`, o SOMA):** aplicar o design system v2 (repo brand, `design-system/`);
  criar o módulo interno de marca; revisar a linguagem do SOMA inteiro.
- **Site brand (`brand.neurodynamics.dev`):** manual da marca interativo, organizado por páginas, com UMA barra de navegação só;
  a ferramenta mais expressiva; downloads só do que é público (Brandfetch); leva ao módulo interno.

### Decisões já tomadas pelo usuário (vinculantes)
- O material controlado que está público no repo brand (templates de certificado, convite, crachá, selos, o .docx) **fica como está**. Não apague nem mova.
- Os estáticos (wallpapers, capa de rede social) são **arquivos prontos no repo brand**, em `downloads/`, renderizados na resolução final com as fontes reais, com um script que os regenera. O portal aponta direto para eles.

### Linguagem (vale para TODO texto que você escrever ou revisar, nos dois repos)
Fonte: `/home/claude/membro/PADROES.md` §9 (leia inteiro) e `$S/mapa/linguagem.md`.
- Direto, formal, impessoal ou imperativo. Sem conversa ("dá para", "é só", "a gente", "você consegue", exclamação, pergunta retórica).
- Não explique o óbvio. O que o usuário descobre ao abrir o documento, ou o que ele já espera (o PDF sai na hora, está no padrão da NRO), não vira texto.
  Exemplo do usuário, a remover: "A declaração sai na hora, em PDF, no modelo da NRO: os dados da sua ficha na primeira folha e, na segunda, os treinamentos concluídos e os eventos de que você participou. Ela não fica guardada no portal — cada emissão ganha um código verificador, e quem a receber confere em auth.neurodynamics.dev."
- O que precisa de explicação vai para o ícone de informação: `dica(texto, rotulo)` da casca (no portal). Estado vazio é uma linha.
- Sem travessão (—) nem ponto médio (·) em frase ou rótulo. Use vírgula, dois-pontos, ponto, parênteses ou o layout.
  Exceções do portal: "—" como marca de campo vazio; "·" só na tipografia dos PDFs e nas artes do Studio (decisão mantida). Travessão só para atribuir citação.
- Erros: "Não foi possível <ação>: <motivo>." Sem permissão: `MOTIVO_RPC.sem_permissao` (index.html). Nunca "Não deu para", "Erro ao", "Falha ao", "Algo falhou".
- Sem emoji. Glifos permitidos: → ↓ ✓ ! × i.
- Português do Brasil, caixa de frase em títulos; caixa alta só em rótulo (Archivo 600, tracking aberto). Separadores brasileiros: 1.284 e 0,94.
- Plural com "(s)": evite quando reescrever ("2 enviados", "Arquivos (2)"); não precisa caçar todos.

### Design system v2 (fonte de verdade)
`/home/claude/brand/design-system/` (`DIRETRIZES.md`, `tokens.css`, `neuro.css`, `formal.css`, `previews/*.html`). Pontos que mais se erram:
- Famílias com quatro tons (light, medium, primary, dark). Conjunto primário Cortex: light #E3EFEC, medium #A9CCC4, primary #00594F (Axon), dark #00352F (Cortex), accent #CEDC00 (Synapse).
- Synapse só para foco, o único CTA sólido da tela, marcas curtas (barra ativa de aba ou subitem) e contadores de pendência. Seleção nunca em Synapse (9% neutro, texto ink 600). Logo nunca em Synapse.
- Conjunto funcional (Nominal, Caution, Critical, Signal, Idle) só para estados de interface; nunca em peça de marca; primary funcional é linha e indicador, não texto (texto usa o medium no escuro).
- Uma família por superfície. Brilho, blur, gradiente e transparência só no conjunto primário.
- Sem forma de pílula: chips 6px, pills e tags 5px, contadores 4px; botões e campos 11px.
- Rótulos em Archivo 600 caixa alta; IBM Plex Mono só para códigos e dados (nunca rótulo, título ou data); texto corrido em Instrument Sans.
- Barras de comparação em traços (tick 1,5px, vão 4,5px, pontas retas). Select nunca com a lista nativa.
- Movimento .15s/.25s sem quique; tudo respeita `prefers-reduced-motion`.

### Nomes fictícios (elenco único, use sempre estes)
Substituem os nomes reais que vazaram nos templates e miniaturas:
| Real (não usar) | Fictício |
|---|---|
| Matheus Marcondes / Matheus Marcondes de Oliveira / M. Marcondes | Lucas Andrade / Lucas Andrade Moreira / L. Andrade |
| Sarah Fernanda / S. Fernanda | Beatriz Lacerda / B. Lacerda |
| Paula Caversan / P. Caversan | Renata Brandão / R. Brandão |
| ID 2022112517 | ID 2024000117 |
| ID 2021098833 | ID 2024000233 |
| ID 2023104412 (Ana Alice Ribeiro) | ID 2024000345 |
Os demais nomes dos templates (Ana Ribeiro, Rafael Mendes, Mariana Costa Albuquerque, Dra. Paula Viana, Helena Duarte, Bruno Okafor, Marina Takahashi, Rafael Lins, Júlia Prado, Caio Ferreira) já são fictícios e podem ficar.
Use nome de pessoa só onde de fato entra um nome (crachá, assinatura, cartão). Nunca como texto de demonstração de fonte.

### URLs
- Portal: `https://membro.neurodynamics.dev/` (espaço Marca: `https://membro.neurodynamics.dev/#/marca`, assinatura `#/marca/assinatura`, interfaces `#/marca/interfaces`).
- Site brand: `https://brand.neurodynamics.dev/` com URLs limpas (`/cores`, não `/cores.html`). O GitHub Pages serve `x.html` em `/x`.
- Brandfetch (único download público): `https://brandfetch.com/neurodynamics.dev`.
- Estáticos prontos (manifesto fixo; os dois lados dependem destes nomes):
  - `https://brand.neurodynamics.dev/downloads/wallpapers/<estilo>-<formato>.jpg`
    - estilo: `rede` (mesh), `ondas` (waves), `circuito` (circuit), `pulso` (pulse)
    - formato: `desktop` 2560×1440, `celular` 1179×2556, `tablet` 2048×2732, `videochamada` 1920×1080
  - `https://brand.neurodynamics.dev/downloads/redes/linkedin-capa.png` (1584×396)
  - Miniaturas para galerias: `https://brand.neurodynamics.dev/assets/manual/<nome>.jpg` (lista em `/home/claude/brand/assets/manual/`; os nomes atuais ficam).
  - Logos públicos: `https://brand.neurodynamics.dev/assets/logo-imagotipo-black.png`, `logo-imagotipo-white.png`, `icon-square-solid-black.png`, `icon-square-solid-white.png`, `icon-colored-transparent.png`, `logo-imagotipo-<familia>-dark|light.png`.
  - CSS do design system: `https://brand.neurodynamics.dev/design-system/tokens.css`, `neuro.css`, `formal.css`.

### Regras de trabalho
- Nunca escreva no Supabase de produção. Nunca faça push. Nunca abra PR. Quem integra é o orquestrador.
- Commit só dos seus arquivos, com caminho explícito (`git add <arquivos>`; nunca `git add -A` nem `git add .`), mensagem em português no estilo do repo, terminando com:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01VLr8kFi5vYuUBRVhBjGxNQ
  ```
- Não toque em arquivo fora da sua lista de dono. Se precisar de mudança fora dela, descreva no relatório final ("pedidos para o integrador").
- Relatório final curto (até 40 linhas): o que fez, testes rodados e resultado (cite FALHAs reais), pendências, pedidos para o integrador.


---

## Anexo B: especificação do portal (tokens da casca e módulo Marca)

### SOMA 2.18.0: especificação para os agentes do portal (repo membro)

Leia antes: `spec/COMUM.md` (mesma pasta), `/home/claude/membro/PADROES.md` inteiro e os mapas em `$S/mapa/` indicados no seu prompt.
Os números de linha dos mapas referem-se a `main` bdfdba9, que é a base de todos os worktrees.

### Worktrees, portas e donos
Cada agente trabalha SÓ no seu worktree (branch `wt/<nome>`, base `claude/soma-2.18` = bdfdba9) e só nos arquivos de que é dono.
Rode testes com `$S/teste.sh <seu-worktree> <sua-porta> <teste...>` (nunca suba servidor na 8765; não rode a bateria inteira, só os testes do seu domínio, mais `colisoes`).

| Agente | Worktree | Porta | Dono de |
|---|---|---|---|
| design-casca | /home/claude/wt/design-casca | 8801 | `index.html`: o `<link>` de fontes (l.22) e todo o `<style>` (l.23–3334); as logos (constantes `LOGO_URL`/nova `LOGO_BRANCO_URL`, `<img>` do login e do rodapé, l.3575, 4585, 4694); a meta theme-color (l.5305). Testes: trechos de cor/tema/logo/geometria de `menu-lateral.mjs`, `ajustes-de-tela.mjs`, e o `route` que aborta domínios externos em todos os testes (acrescentar `brand.neurodynamics.dev`). `PADROES.md` §8 e a linha do `.seg` no §1. |
| select-e-cores | /home/claude/wt/select-e-cores | 8802 | O select da v2 na casca: JS novo (função própria, chamada uma vez na partida) e CSS num bloco novo inserido imediatamente antes de `</style>`, aberto por `/* ============ SELECT (2.18.0) ============ */`. As tabelas de cor do JS da casca: `STATUS_SOL` (3649-3656), `STUDIO_REDES.site` (4322-4331), `STUDIO_PILARES` (4341-4348), `corDoItem` (6477), camadas da agenda (6496-6502), 6600, 7162. As cores antigas do stub (`stub-supabase.js` 689-709, 1829-1854). |
| marca | /home/claude/wt/marca | 8803 | `mod-marca.js` (novo); `db/2.18.0_marca.sql` e `db/testes/2.18.0_marca.sql` (novos); `testes/marca.mjs` (novo); acréscimos no `stub-supabase.js` para Marca; em `index.html` só: `ROTAS`, `ALIAS`, o nó Marca em `arvoreDoMenu()`, `desenharMenu()` (suporte a subitem com `href` externo), `ICONS.marca`, entradas novas em `acoesDaCasca()`, `LINKS_PADRAO`, a função nova `copiarHTML(html, msg)` na casca e o CSS do módulo num bloco novo inserido imediatamente antes da linha `/* ============ MODAL / TOAST ============ */`; em `mod-mailer.js` só a remoção de `copiarHTML` (l.305) passando as chamadas à da casca; as linhas de ordem do menu em `testes/menu-lateral.mjs:80-83` e `testes/treinamentos.mjs:75`; `README.md` (tabela de arquivos e a seção do módulo), `PADROES.md` §1 e §2, `testes/LEIAME.md`, `db/LEIAME.md`. |
| ling-casca | /home/claude/wt/ling-casca | 8804 | Todo texto visível de `index.html` fora do `<style>` (HTML 3335-3558 e JS), exceto o que é dos outros (acima). Inclui: correção do seletor da dica (`button.dica`), `MOTIVO_RPC`, `URL_APP()` sem `index.html`, normalização de título de aviso no sino (trocar " — " por ": " na exibição), textos do check-in, serviços, declaração, sino vazio, erros do `render`. `PADROES.md` §9 (registrar a convenção de erro e o uso de `dica()`). Ajustes de asserção de texto nos testes que leem esses textos. |
| studio | /home/claude/wt/studio | 8805 | `mod-studio.js`, `mod-criador.js`, `mod-treinamentos.js`, pasta `studio/` (logos v2 novos). Testes `studio.mjs`, `treinamentos.mjs` (menos a linha 75). |
| arquivos | /home/claude/wt/arquivos | 8806 | `mod-arquivos.js`, `mod-formularios.js`, `mod-projetos.js`. Testes `arquivos-e-projetos.mjs`, `formularios.mjs`. |
| selecao | /home/claude/wt/selecao | 8807 | `mod-selecao.js`, `mod-agenda.js`, `mod-presenca.js`. Testes `ps-entrevistas.mjs`, `okrs-e-selecao.mjs` (parte de seleção), `agenda-e-inicio.mjs` (parte de agenda). |
| gestao | /home/claude/wt/gestao | 8808 | `mod-cofre.js`, `mod-gestao.js`, `mod-admin.js`, `mod-atividades.js`, `mod-okrs.js`, `mod-versoes.js` (sem tocar em `NOTAS_VERSAO`). Testes `cofre`, `grupos-arvore`, `quadro-e-acesso`, `okrs-e-selecao` (parte de OKRs), `carga-por-papel`, `relatorios-por-papel`, `menu-lateral` (parte de Administração). |
| documentos | /home/claude/wt/documentos | 8809 | `mod-documentos.js`, `mod-mailer.js` (menos `copiarHTML`), `mod-relatorios.js`, `doc-nro.js`, pasta `mailer/`. Testes `documentos-e-eventos`, `emails`, `validacao`, `formularios` (só para conferir o PDF), `agenda-e-inicio` (folha de check-in). |
| avulsas | /home/claude/wt/avulsas | 8810 | `tour.html`, `quiosque.html`, `rsvp.html`, `admin.html`, `auth/index.html`, `supabase/` (templates e functions), `manifest.webmanifest`. Testes `tour.mjs`, `validacao.mjs` (parte da página auth). No `README.md`, só as menções a `rsvp.html`/`quiosque.html` (URLs limpas). |

Ninguém toca em `VERSAO`, `NOTAS_VERSAO`, `sw.js` nem no histórico de notas de versão: é do integrador.
Se dois agentes precisam do mesmo trecho, quem é dono faz; o outro pede no relatório.

### Tokens da casca (decisões, para design-casca; os demais só consomem)
Base: `$S/mapa/css-casca.md` §1. Nomes de token ficam (os módulos dependem deles); mudam os valores.
- **Escuro (`:root`):**
  - `--ink #E8EDEB`, `--ink-rgb 232,237,235`; `--line`/`--line2` derivam de `--ink-rgb`.
  - Funcional primary: `--bad #FF2D20`, `--ok #00F59B`, `--warn #FFAA00`, `--info #00C8FF`, com os trios `-rgb`.
  - Texto sobre caixa tingida (medium): `--bad-tx #FF948C`, `--warn-tx #FFD470`, `--info-tx #7FE0FF`, novo `--ok-tx #7DFFC8`.
  - `--cinza-rgb 124,132,153` (Idle). `--roxo-tx #CDBEFC`.
  - `--teal`: usos decorativos (`.avx`, `a.ini-rc .ic-q`, `a.ft-t>.ic`, `.cof-ic`) passam a `--muted`; usos de categoria mantêm `--teal` como apelido de Ion: `--teal #93E8DB` (texto), `--teal-rgb 91,191,176`.
  - `--green2` sai (a barra vira traços). `--lima-tx` passa a Cortex medium `#A9CCC4` e as caixas `.aviso-box.lima`/`.tre-caixa.dica` passam a tinta Cortex `rgba(0,89,79,.12)`.
  - Constantes v2 novas fora do bloco de tema (raios `--r-sm 11 --r-md 14 --r-lg 20 --r-xl 24 --r-chip 6 --r-tag 5 --r-badge 4`, `--t-fast .15s --t .25s --ease cubic-bezier(.2,.7,.2,1)`, e as famílias que a casca usar: `--ion-*`, `--lumen-*`, `--retina-*`, `--dendrito-*`, `--cortex-*`, `--fn-*`).
- **Claro (`:root[data-tema="claro"]`, um bloco só, mesmo seletor):**
  - `--bg #E8EDEB` (Pia light; atualizar o teste e a meta theme-color); `--panel`, `--campo`, `--toast` `#FFFFFF`; `--card rgba(255,255,255,.74)`; `--bg-topo #E3EFEC`; `--fundo-rgb 255,255,255`.
  - `--ink #1D1D1F` (`--tom`/`--ink-rgb 29,29,31`), `--muted #2E3533`, `--dim #616C68`. Texto dim nunca sobre tinta: hover e `.on` sobem para `--muted`/`--ink`.
  - Funcional: texto e ponto no tom dark (`--ok #00422A`, `--warn #4D3300`, `--bad #5C0A05`, `--info #003A4D`; os `-tx` iguais; `--ok-tx #00422A`), trios `-rgb` no primary.
  - Synapse no claro vira Axon: `--syn-tx`, `--syn-borda`, `--foco` `#00594F`; `--syn-rgb 0,89,79`; `--lima-tx #00352F`. `.btn.solid` continua Synapse com texto `--deep`.
  - `--teal #0B4F48`, `--teal-rgb 11,79,72`; `--roxo-rgb 59,35,120`, `--roxo-tx #3B2378`; `--cinza-rgb 124,132,153`.
  - Todo token de tema novo entra em três lugares: `:root`, bloco claro e a ilha `.sl-destaque`. O teste da ilha exige >40 tokens e grafia idêntica.
  - Preenchidos com texto escuro que quebram no claro (`.evp-p .rs.*`, `.tre-ed-marca.on`, `.agw-chip`, `.agw-ev`): token próprio de texto sobre estado cheio.
- **Fontes:** Archivo 500/600/700, IBM Plex Mono 400/500 (os 600 em mono descem para 500), Instrument Sans 400/500/600 e 400 itálico. `--f` = `'Instrument Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif`. Corpo em 15px/1.6 se não estourar nada a 390px; senão fica 14.5 (registre a escolha em PADROES §8).
- **Checkbox marcado continua Synapse** (`accent-color: var(--syn-borda)`), decisão tomada.
- **Logos:** escuro usa o arquivo branco, claro o preto, sem filtro de inversão (a v2 proíbe inverter o preto). `LOGO_URL = 'https://brand.neurodynamics.dev/assets/logo-imagotipo-black.png'` e `LOGO_BRANCO_URL = 'https://brand.neurodynamics.dev/assets/logo-imagotipo-white.png'` (o Pages manda `Access-Control-Allow-Origin: *`). Os testes abortam `brand.neurodynamics.dev` como hoje abortam `raw.githubusercontent.com`. `doc-nro.js`, `mod-relatorios.js` e `auth/index.html` trocam a URL pela mesma (cada dono no seu arquivo). A onda branca (`favicon.png`) é permitida no portal (sistema interno) mas não em página pública (rsvp, auth, quiosque).

### Cor padrão de evento da agenda
Nova cor padrão: Ion primary `#5BBFB0` (front: selecao; banco: a migração da marca acrescenta o `alter … set default` guardado por `to_regclass`).
Paletas de categoria (agenda, etiquetas, eixos de OKR, pilares do Studio) passam aos primary das famílias secundárias: Ion #5BBFB0, Neuron, Glia, Retina, Nexo, Dendrito #A78BFA, Lúmen, Ritmo, Impulso, Plexo, Íris (valores em `/home/claude/brand/design-system/tokens.css`). Nunca funcional nem Synapse como categoria. Dados já gravados no banco com hex antigo continuam funcionando (não precisa migrar).

### URLs no portal
- `URL_APP()` (casca) devolve a URL sem `index.html`. Os módulos que montam URL com `location.pathname` passam a usar `URL_APP()`: `mod-admin.js:941,948` (gestao), `mod-presenca.js:171` (selecao), `mod-atividades.js:1608` (gestao).
- Link de RSVP gerado pela função de e-mail: `${PORTAL}/rsvp?t=…` (o `rsvp.html` continua servido para links antigos). `quiosque` citado como `/quiosque`.

### Módulo Marca (agente marca)
Rotas: `#/marca` (galeria), `#/marca/assinatura`, `#/marca/interfaces`, `#/marca/config` (só `docGestor()`).
Menu: espaço "Marca" (ícone `marca`, o "palette" do Lucide, ver `$S/mapa/casca-js.md` §3) logo depois de Studio e antes de Equipe. Ordem esperada nos testes: `Agenda|Atividades|OKRs|Projetos|Arquivos|Studio|Marca|Equipe|Treinamentos|Serviços|Seleção|Administração`. Subitens: Galeria, Assinatura de e-mail, Interfaces, Configurações (só gestor) e um link externo "Manual da marca" para `https://brand.neurodynamics.dev` (ícone `externo`).
`ALIAS`: `brand` → `['marca', null]`, `assinatura` → `['marca','assinatura']`. `acoesDaCasca`: "Assinatura de e-mail", "Wallpapers e logos", "Prompts para LLMs".

**Galeria** (`#/marca`), catálogo fixo `MARCA_ITENS` em `mod-marca.js`, em três grupos, cada item com miniatura (imagens públicas do brand, `assets/manual/*.jpg`, `assets/seal-axon.png`), nome e ação. Imagens não abrem em tela cheia.
1. **Estáticos**, download direto (fetch → blob → `<a download>`; se o fetch falhar, abre a URL em nova aba): Wallpapers (4 estilos; cada um com os 4 formatos), Capa do LinkedIn, Logos (imagotipo preto e branco, ícone quadrado preto e branco, símbolo colorido) e o link "Mais formatos no Brandfetch".
2. **Templates**, guardados em Arquivos: relatório, apresentação formal, apresentação de marca, carta, memorando, documentos e registros (NRO-PUB-002), boletim, comunicado. O item leva a `#/arquivos/<código>` da série vinculada. Sem vínculo: "Sem arquivo vinculado" (gestor vê "Vincular" que leva a `#/marca/config`).
3. **Controlados**, visíveis para todos, download só para grupos autorizados: certificado, certificado de marca, convite, selo, crachá, cartão de visita. Mesmo vínculo com Arquivos; o cadeado vem de `sb.rpc('doc_pode_ler', { p_arquivo: <id da cabeça> })` (nunca recalcular a regra no front). Sem permissão: cadeado e "Download restrito", o item continua clicável e leva à página do arquivo.
O vínculo item → série é a tabela `marca_vinculos` (abaixo), lida junto com `doc_rol` (`pn is null`), sem carregar `mod-arquivos`.

**Assinatura de e-mail** (`#/marca/assinatura`): porte do gerador do brand (`/home/claude/brand/index.html` 1872-1990: `SIG_ORG`, `sigEmail`, `sigReply`, `sigDdi`, `sigCopiar`), preenchido com os dados de `state` (nome, cargo, departamento, e-mail NRO, telefone), campos editáveis (pronomes manual, não gravado), versões completa e resposta, prévia, "Copiar assinatura" com cópia rica via `copiarHTML(html, 'Assinatura copiada.')`. Instruções por cliente (Gmail, Outlook) em `dica()`. Logo pela URL pública do brand.

**Interfaces** (`#/marca/interfaces`): o que a equipe exporta para montar páginas no padrão.
- Arquivos do design system (`tokens.css`, `neuro.css`, `formal.css` do brand): copiar o `<link>`, baixar.
- Página-base: HTML inicial embutido (fontes, tokens, neuro.css, cabeçalho de site, fundo Void, seções de exemplo), "Baixar página-base".
- Componentes: trechos de HTML copiáveis (botão, campo, select, chips, pill, alerta, cartão, tabela, métrica, estado vazio, banda de família), com prévia em `iframe srcdoc` que carrega o CSS do brand.
- Prompts para LLMs (Markdown embutido em `mod-marca.js`), cada um com "Copiar" e "Baixar .md", mais "Baixar todos": (1) página da equipe no padrão; (2) texto de interface (linguagem do §9); (3) comunicado e e-mail; (4) post para redes (uma família por peça, sem emoji); (5) documento formal (conjunto formal, código, cabeçalho). Os prompts ensinam as regras da v2 e da linguagem de forma completa e autocontida.

**Configurações** (`#/marca/config`, só `docGestor()`): cada item de Templates e Controlados com um select de séries (`doc_series` + `doc_emissores`) e Salvar (upsert em `marca_vinculos`).

**Migração `db/2.18.0_marca.sql`** (convenções em `$S/mapa/banco-e-testes.md` §1):
- `marca_vinculos(chave text primary key, serie_id uuid references public.doc_series(id) on delete set null, atualizado_em timestamptz not null default now(), atualizado_por text)`; RLS: select para `authenticated` `using (true)`; insert/update/delete só `doc_gestor()`; gatilho de carimbo; semente das chaves (serie_id nulo; `documentos-e-registros` já ligada à série PUB 002 se existir).
- `update public.portal_links set titulo = 'Manual da marca' where url ilike 'https://brand.neurodynamics.dev%' and titulo = 'Brand guidelines'` (guardado por `to_regclass`).
- Cor padrão da agenda: `alter table … alter column cor set default '#5BBFB0'` (tabela da v28, guardado por `to_regclass`).
- Pré-requisitos (`doc_series`, `doc_gestor()`), idempotente, `insert into migracoes ('2.18.0_marca', …)`, bloco CONFERIR. Teste em `db/testes/2.18.0_marca.sql` no padrão dos outros (RLS por papel, idempotência).

**Stub e teste:** emissor MKT, séries e linhas de `doc_rol`/`doc_revisoes` para alguns itens (um template público, um controlado confidencial com `grupos_leitura`), `DADOS.marca_vinculos`; `doc_pode_ler` do stub passa a considerar `grupos_leitura` contra os grupos efetivos do membro logado (sem quebrar `arquivos-e-projetos` e `formularios`: rode os dois). `testes/marca.mjs` cobre menu, galeria (URLs exatas dos estáticos, link de template para `#/arquivos/<código>`, cadeado para papel leitura e download para admin), assinatura (dados preenchidos, cópia), interfaces (copiar prompt), config só para gestor (escrita anotada), 390px sem rolagem lateral e sem `pageerror`.


---

## Anexo C: definições lidas da produção

### Definições lidas da produção (fornecidas pelo usuário em 2026-10-05)

### Funções
papel_atual(): language sql stable security definer, search_path public
  select papel from public.perfis where id = auth.uid();
portal_registro_atual(): language sql stable security definer, search_path public
  select registro from public.perfis where id = auth.uid();

### Políticas (pg_policies), todas `to authenticated`
| tabela | política | cmd | using | with check |
|---|---|---|---|---|
| acessos_concedidos | acessos_select | SELECT | true | |
| acessos_concedidos | acessos_write | ALL | papel_atual() in (admin, pessoal) | idem |
| avaliacoes | aval_delete | DELETE | papel_atual() in (admin, pessoal) | |
| avaliacoes | aval_insert | INSERT | | true |
| avaliacoes | aval_select | SELECT | true | |
| avaliacoes | aval_update | UPDATE | papel_atual() in (admin, pessoal) | idem |
| dados_pessoais | dados_all | ALL | papel_atual() in (admin, pessoal) | idem |
| ocorrencias | ocorr_delete | DELETE | papel_atual() in (admin, pessoal) | |
| ocorrencias | ocorr_insert | INSERT | | true |
| ocorrencias | ocorr_select | SELECT | true | |
| ocorrencias | ocorr_update | UPDATE | papel_atual() in (admin, pessoal) | idem |

ACHADO DE SEGURANÇA: ocorrencias, avaliacoes e acessos_concedidos são legíveis por QUALQUER conta logada (select using true), e ocorrencias/avaliacoes aceitam insert de qualquer conta (with check true). A etapa 2 fecha isso.


---

## Anexo D: etapa 2: produção e riscos

### SOMA 2.18.0, etapa 2: papéis por grupo, conta bloqueada, ficha e card espelhado

Branch `claude/soma-2.18`. Migração nas seções "Papéis por grupo" e "Card espelhado" de `db/2.18.0_soma.sql` (mais o bloco final "Conta bloqueada: a trava em toda tabela com RLS"). Teste de banco em `db/testes/2.18.0_soma.sql` (150 asserções). Teste de navegador novo: `testes/papeis-por-grupo.mjs`.

### O que mudou no banco

- `grupo_papeis (grupo_id pk, papel in pessoal|selecao|lideranca)`. A semente procura `NRO_PESSOAL` (ou o grupo com `chave='pessoal'`), `NRO_PS` e `NRO_LEADERSHIP` pelo nome, sem diferenciar maiúsculas. Grupo que não existe vira `NOTICE`, sem erro. Um papel só é semeado se ainda não tiver grupo nenhum. Escrita só por `grupo_papel_definir(p jsonb)`, e só admin chama.
- `papeis_atuais()` devolve `text[]` ordenado (admin > pessoal > lideranca > selecao > leitura). Também: `tenho_papel(p)`, `eh_gestao()` (admin, pessoal ou liderança), `conta_ativa()` e `status_bloqueado(status)` (Desligado, Egresso, Sob demanda). A pertença conta subgrupos por `grupos_de()`; um grupo inativo não dá papel.
- `papel_atual()` mantém a assinatura e devolve o papel mais forte. **Desvio do plano:** a conta bloqueada, sem sessão ou sem perfil recebe `'nenhum'`, e não `null`. Motivo: há 15 testes `papel_atual() not in (...)` e 4 `<> 'admin'`. Com `null`, a condição vira nula, o `if` não dispara e a função libera o acesso (`grupo_salvar`, `feedback_decidir`, `evento_ext_salvar`…). Com `'nenhum'`, o acesso é negado.
- `portal_registro_atual()` devolve nulo para conta bloqueada, e as RPCs respondem `sem_registro`. Admin sem registro (conta técnica) continua admin.
- `perfis.papel` 'pessoal' e 'selecao' ainda valem nesta versão (origem "legado").
- `meu_nivel_no_grupo`: conta bloqueada → `nenhum`. Liderança fica com `edicao` nos grupos dela, o nível de `grupo_acessos` quando houver, e `leitura` no resto, inclusive em quadro reservado.
- `eh_comite()` = admin, pessoal, ou quem tem os papéis seleção ou liderança (pela lista de papéis, não pelo mais forte). `fila_situacao` aceita gestão ou seleção.
- Lista de escrita da liderança: as definições **que estão no banco** são reescritas por texto (`pg_get_functiondef` e `pg_policies`). Onde houver `papel_atual() in ('admin','pessoal')`, entra `eh_gestao()`:
  - funções: okr_pode_atualizar, agenda_gestor, agenda_marco_salvar/remover, agenda_editar_evento/cancelar/scrum_salvar, site_imprensa_editor, treinamento_gestor, email_destinatarios/programar/programado_cancelar, doc_vinculo_pode, evento_ext_* (8), doc_emitido_ler/revogar;
  - políticas: okr_insert, okr_delete, okrcom_delete, pavisos_select/write, plinks_write, pdocs_select/write, evtipos_write, agpred_write, siteprj_write, eroteiros_gestao, eprog_ler, doc_emcfg_update, evx_cfg_update, doc_emit_select;
  - trocas avulsas: `doc_gestor` e `studio_pode_aprovar` ganham `or tenho_papel('lideranca')`; `agenda_pode_ver` deixa de usar `agenda_gestor()` e passa a ser admin e pessoal, para que a liderança não veja evento fechado alheio.
  - Fora da lista, de propósito: contas, grupos, solicitações, ouvidoria, cofre, folha de check-in, ausências, foto dos outros, moderação de comentário, catálogo de acessos e os gestores dos treinamentos.
  - Decisões minhas (confirmar): os **links úteis** entram junto com os avisos, e o **site institucional** (`site_projetos`) entra junto com o Studio.
- Ficha:
  - `dados_pessoais`: leitura para admin, pessoal e liderança; escrita para admin e pessoal.
  - `avaliacoes` e `acessos_concedidos`: leitura para admin, pessoal e liderança.
  - `ocorrencias`: leitura para admin e pessoal.
  - Inclusão em `ocorrencias` e `avaliacoes`: só admin e pessoal.
  - A sinalização reincidente do apontamento semanal gravava ocorrência direto da conta de quem apontava. Agora passa por `apontamento_ocorrencias(p_apontamento, p_registros)`, que só abre ocorrência para itens sinalizados de um apontamento da própria conta (ou de admin e pessoal) e não repete.
  - Nenhuma tela mostrava ao membro dados dele dessas quatro tabelas, então não havia o que preservar.
- Trava: a política `conta_ativa` (`as restrictive`, `to authenticated`, `using ((select conta_ativa()))`) entra em toda tabela de `public` com RLS, pela função `conta_ativa_travar()`. O anon (rsvp, quiosque, site) não é afetado.
- Card espelhado:
  - Tabela `atividade_quadros`, funções `posso_ver_atividade`/`posso_editar_atividade`, `atividade_espelhar`, `atividade_espelho_remover` e `atividade_mover` (move com cópia e arquivamento, e os espelhos vão para o cartão novo).
  - `atividade_editar` foi reescrita a partir da 2.17.0: edita quem escreve em qualquer quadro ligado; arquivar e desarquivar continuam com o quadro dono; com `quadro` de um espelho, a ordem gravada é a desse quadro.
  - Comentar, checklists, seguir, comentário editado, origem e cópia passam a perguntar pelo cartão, por troca de texto na definição.
  - A view `atividades_quadro` ganha `espelhos int[]` e `espelhos_ordem jsonb` no fim (`create or replace`, grants mantidos).
- Avisos de sistema (bugs novos e afins): já vão só para `perfis.papel = 'admin'` (2.17.0:168, v20:605, v23:150, v25:700, v27:718). Nada mudou.

### O que um admin confere em produção ANTES de aplicar

Rode cada consulta no SQL Editor e guarde o resultado.

1. **Os grupos da semente existem com esses nomes?**
   ```sql
   select id, nome, chave, ativo, pai_id from grupos
    where upper(nome) in ('NRO_PESSOAL','NRO_PS','NRO_LEADERSHIP') or chave = 'pessoal';
   ```
   Se o nome real for outro (por exemplo "Depto de Pessoal" sem `NRO_PESSOAL`), a semente usa o de `chave='pessoal'` para pessoal. Seleção e liderança ficam sem grupo, com um aviso, e precisam ser definidas em Administração › Grupos logo depois.

2. **Relatório `perfis.papel` × grupos (quem ganha e quem perde).**
   ```sql
   with gp(nome, papel) as (values ('NRO_PESSOAL','pessoal'), ('NRO_PS','selecao'), ('NRO_LEADERSHIP','lideranca'))
   select p.email, p.papel as papel_na_conta, m.nome, m.status,
          (select string_agg(gp.papel || ' via ' || g.nome, ', ')
             from gp join grupos g on upper(g.nome) = gp.nome
            where g.id = any(grupos_de(p.registro))) as papeis_por_grupo
     from perfis p left join membros m on m.registro = p.registro
    order by p.papel, p.email;
   ```
   - `papel_na_conta = 'pessoal'` ou `'selecao'` sem o papel correspondente por grupo: a pessoa continua com acesso nesta versão (legado), mas perde quando a transição acabar. Ponha-a no grupo.
   - `papeis_por_grupo` com liderança: a pessoa passa a ler a ficha de todos (dados pessoais, avaliações, acessos) e todos os quadros. Confira se é isso.

3. **Quem fica bloqueado ao aplicar** (contas que perdem tudo na hora, inclusive admin):
   ```sql
   select p.email, p.papel, m.nome, m.status from perfis p join membros m on m.registro = p.registro
    where m.status in ('Desligado','Egresso','Sob demanda') order by p.papel, m.status;
   ```
   Um **admin** que apareça aqui perde o acesso. Antes de aplicar, corrija o status ou desvincule a conta (registro nulo).

4. **As funções e políticas da lista existem com o texto esperado?** Depois de aplicar, procure no resultado do Run as linhas `NOTICE: Papéis por grupo: não reconheci ...` e `Card espelhado: não reconheci ...`. Cada uma é uma função cujo teste de papel ficou como estava e precisa de ajuste à mão. O resultado também mostra `N trocas na lista de escrita` e `N tabelas com a trava`. Para conferir:
   ```sql
   select tablename, policyname, qual, with_check from pg_policies
    where policyname in ('okr_insert','okr_delete','okrcom_delete','pavisos_select','pavisos_write','plinks_write',
      'pdocs_select','pdocs_write','evtipos_write','agpred_write','siteprj_write','eroteiros_gestao','eprog_ler',
      'doc_emcfg_update','evx_cfg_update','doc_emit_select');
   select proname from pg_proc where pronamespace = 'public'::regnamespace
      and prosrc ~ 'papel_atual\(\)\s*(not\s+)?in\s*\(\s*''admin''\s*,\s*''pessoal''\s*\)';   -- o que ficou admin/pessoal
   ```

5. **Políticas da ficha de produção.** A migração apaga e recria `dados_all`, `aval_select`, `aval_insert`, `acessos_select`, `ocorr_select` e `ocorr_insert`. Se produção tiver outra política nessas tabelas com `using (true)`, ela continua abrindo a leitura:
   ```sql
   select tablename, policyname, cmd, qual, with_check from pg_policies
    where tablename in ('dados_pessoais','avaliacoes','acessos_concedidos','ocorrencias') order by 1, 2;
   ```

6. **Custo.**
   - Medido no teste: a liderança lê 3.000 cartões de três quadros em cerca de 25 a 75 ms. As regras do quadro rodam uma vez por consulta (InitPlan).
   - `papel_atual()` custa cerca de 60 µs por chamada, contra cerca de 15 µs antes. As políticas antigas que o chamam linha a linha ficam proporcionalmente mais caras.
   - Em produção, rode como um membro de NRO_LEADERSHIP e confira o tempo:
     ```sql
     set role authenticated;
     select set_config('request.jwt.claims', json_build_object('sub', '<uuid>', 'role', 'authenticated')::text, true);
     explain analyze select * from atividades_quadro where not arquivada;
     ```

### Riscos

- **Espelhar num quadro aberto abre o cartão.** Um cartão do quadro reservado espelhado num quadro comum fica visível a todos que leem esse quadro. É consequência da regra (quem espelha escreve nos dois), e o teste registra isso. Se não for o desejado, a regra precisa mudar: por exemplo, vale a visibilidade mais restrita.
- **Troca de texto nas definições.** É robusta a diferenças de produção, mas uma função escrita de outro jeito (por exemplo, `papel_atual() = any(array[...])`) não é reconhecida. Daí o aviso do item 4.
- **Seções futuras da 2.18.0** que criarem tabela com RLS precisam terminar com `select public.conta_ativa_travar();`, ou a tabela nova fica sem a trava. Na integração, deixar o bloco "Conta bloqueada" por último resolve.
- **Edge Function `agenda-sync`** ainda lê `perfis.papel` com a chave de serviço (`index.ts:549,638`):
  - pessoal **por grupo** não sincroniza "todas as agendas";
  - um membro bloqueado ainda sincroniza a própria agenda.

  A mudança é pequena (pedir `papeis_atuais` com o token da pessoa) e exige republicar a função. Ficou fora desta etapa.
- **Legado na conta.**
  - Contas com `perfis.papel = 'pessoal'/'selecao'` continuam valendo. O select de Contas oferece só admin e consulta, e mostra o legado enquanto existir.
  - A tela da Seleção perdeu o "Incluir no comitê" (gravava `selecao` na conta). Agora lista o comitê pelos grupos, e admin tira o legado.
- **Liderança** é gestão em `eh_gestao()`, mas fica abaixo de pessoal na precedência: quem é liderança e pessoal recebe `pessoal`, que inclui tudo.
- **Semente.** Se admin apagar o papel de um grupo, rodar a migração de novo semeia de novo, mas só quando nenhum grupo tiver aquele papel.
- Na **conta sem perfil** (logada antes de o perfil ser criado), `conta_ativa()` é verdadeira, para não travar a autocriação do perfil, e `papeis_atuais()` vem vazio. O front então usa o papel da conta, que é `leitura`.

### Testes

- Banco:
  ```
  createdb -T tbase t218
  psql -d t218 -f testes/2.18.0_soma.sql
  ```
  `tbase` é o do `db/LEIAME.md`: esqueleto, Storage e a 15.0 à 24.0. O próprio teste aplica Vault, 25.0 à 32.0 e 2.17.0, recria as políticas de produção da ficha e as das migrações em `aplicadas/` que a lista de escrita troca, e aplica a 2.18.0 duas vezes. São 150 asserções.
  - Papéis: admin, pessoal por grupo, liderança por grupo e por subgrupo, seleção por sub-subgrupo, leitura, legado.
  - Bloqueados: desligado (mesmo com a conta e o grupo de pessoal), egresso e sob demanda, que não leem nem a tabela `using (true)`. O anon fica intacto.
  - Liderança: lê o reservado, não escreve no quadro alheio, não lê ocorrências e não inclui avaliação.
  - A lista de escrita, pelas funções e pela RLS; o apontamento; o espelho (espelhar, editar por quem escreve num só, ordem por quadro, arquivar só no dono, tirar, mover); o custo; a idempotência.
- Navegador, todos verdes:
  - pedidos: colisoes, menu-lateral, quadro-e-acesso, grupos-arvore, carga-por-papel, relatorios-por-papel, okrs-e-selecao, cofre;
  - os que tocam o que mudou: versoes-fotos-e-cartoes, agenda-e-inicio, documentos-e-eventos, emails, treinamentos, studio, arquivos-e-projetos, ps-entrevistas, origem-e-pills, ajustes-de-tela;
  - o novo, papeis-por-grupo.

  Dois testes antigos foram ajustados ao comportamento novo: o "copiar" de versoes-fotos-e-cartoes virou espelhar, tirar e mover, e a "lista de perfis" de okrs-e-selecao virou o comitê pelos grupos.
- Para a integração:
  - pôr `papeis-por-grupo` na lista TODOS do `teste.sh`;
  - acrescentar em `db/LEIAME.md` o comando do teste e a contagem;
  - o insert em `migracoes`.


---

## Anexo E: etapa 3: produção

### SOMA 2.18.0, etapa 3: notificações por tipo

Branch `claude/soma-2.18`. Migração na seção "Notificações por tipo" de `db/2.18.0_soma.sql` (no fim do arquivo, depois de "Conta bloqueada", e termina com `select public.conta_ativa_travar();`). Teste de banco em `db/testes/2.18.0_soma.sql` (agora 193 asserções; 43 novas).

### O que mudou

- **Banco**
  - `notificacao_categoria(tipo)` e `notificacao_categorias()` (9 categorias, na ordem da tela).
  - Tabela `notificacao_canais (registro, categoria, push, email)`. Sem linha = push ligado e e-mail semanal. Leitura: a própria pessoa, admin e pessoal. Escrita só por `notificacao_canais_salvar(p jsonb)`; a tela lê por `notificacao_canais_meus()`.
  - Migração do modo antigo, só de quem escolheu: resumo → diário, nunca → nunca, imediato escolhido → instantâneo, em todas as categorias. A linha que a baixa do e-mail criou sozinha (`ultimo_email = atualizado_em`) não conta como escolha e fica no padrão semanal. Uma vez só (`notificacao_preferencias.canais_migrados_em`).
  - `notificacao_preferencia_salvar` (a tela antiga em cache) continua e aplica o modo a todas as categorias.
  - `notificacoes_email_lote` reescrita: até três envelopes por pessoa (`modo` instantaneo, diario, semanal). Resumo diário às 8h, semanal na segunda às 8h (America/Sao_Paulo), por `notificacao_resumo_marco`. Sem relógio por pessoa: o resumo é devido quando há aviso pendente do modo criado antes do marco. Janelas: instantâneo 3 dias, diário 2, semanal 8. `notificacoes_email_baixa` não mudou.
  - `push_lote` reescrita: respeita o push da categoria e exclui conta bloqueada.
- **Sempre na hora, fora da preferência:** convites e lembretes de evento (`agenda_envios`), pílulas e e-mails programados (`email_programados`), teste de e-mail e de push. O `studio_lembrete` sai na hora, a não ser que o e-mail do Studio esteja desligado.
- **notificar-email:** resumo agrupado por categoria, assunto "Resumo diário do SOMA (N avisos)" e "Resumo semanal do SOMA (N avisos)". README com a tabela de categorias e o agendamento.
- **agenda-sync:** papéis por `papeis_atuais()` com o token da pessoa (pessoal por grupo sincroniza todas); conta bloqueada recebe 403. Sem a 2.18.0 no banco, vale `perfis.papel`.
- **Front:** sino › Preferências de avisos vira a tabela tipo × (push, e-mail), salva por `notificacao_canais_salvar`.

### Mapeamento tipo → categoria

| Categoria | Tipos |
|---|---|
| Atividades | atividade_atribuida, atividade_mencao, atividade_moveu, atividade_prazo, atividade_sinalizada, quadro_liberado, projeto_equipe |
| Bugs e melhorias | feedback_novo, feedback_status, feedback_comentario |
| Documentos | doc_revisao, doc_aprovada, doc_devolvida |
| Studio | studio_aprovacao, studio_decisao, studio_lembrete |
| Reporte | reporte_*, newsletter* (etapa 4) |
| Agenda | agenda_convite, agenda_resposta, agenda_cancelamento, evento_ext |
| Pessoal | pessoal_<tipo>, solicitacao_respondida |
| Treinamentos | treinamento |
| Sistema | cofre_troca e qualquer tipo sem categoria |

A etapa 4 (reporte) deve gravar os avisos com tipo `reporte_*` ou `newsletter*` para cair em Reporte.

### O que fazer em produção

1. Aplicar `db/2.18.0_soma.sql` (na integração). Conferir:
   ```sql
   select count(*), count(distinct registro) from notificacao_canais;            -- quem tinha escolha migrada
   select email_modo, count(*) from notificacao_preferencias group by 1;
   select notificacoes_email_lote(500);                                          -- o que sairia agora
   ```
   Atenção: com o padrão novo, quem nunca escolheu passa de "imediato" para **resumo semanal**. Avisar a equipe na nota de versão.
2. **Republicar as Edge Functions** `notificar-email` e `agenda-sync` (colar o `index.ts` de cada uma no painel). `notificar-email` continua com a verificação de JWT **desligada**. Ordem: o banco primeiro é seguro (a função antiga lê o lote novo e manda o resumo sem agrupar); a função nova com o banco antigo também funciona (trata `imediato`/`resumo`).
3. **Cron:** nada novo. O `soma-fila` da 32.0 (a cada minuto) já leva os resumos:
   ```sql
   select jobname, schedule, active from cron.job where jobname = 'soma-fila';
   ```
4. **Segredos:** nenhum novo. A `agenda-sync` usa `SUPABASE_ANON_KEY`, que o Supabase já injeta.
5. Na integração: acrescentar a contagem (193) em `db/LEIAME.md`; a nota de versão (preferências por tipo; padrão semanal; convites e pílulas sempre na hora).

### Pontos em aberto

- `agenda_envios_lote` (28.0) ainda inclui membros "Sob demanda" nos convites (`v28:878`). Não mexi: é fila fora da preferência, e o convidado pode ser externo. Se Sob demanda deve ficar sem convite, ajustar ali.
- `fila_situacao` conta como "avisos esperando" os pendentes dos resumos (esperam a segunda-feira). É só a contagem do painel.
- O lote limita itens (200 por passada); um resumo maior que isso sai em duas partes, na mesma janela.


---

## Anexo F: diagnóstico (etapa 0)

### SOMA 2.18.0: Etapa 0, diagnóstico

Base: `/home/claude/membro`, branch `claude/soma-2.18`, VERSAO 2.17.1. Nenhum arquivo do repo foi editado e a árvore continua limpa (`.t8811/` é ignorada). O banco `t_diag` foi criado e apagado, e o cluster continua de pé. Script de reprodução: `scratchpad/diag/ap.mjs` (uso: `node ap.mjs <papel> <grupo>`, com o portal servido em 8811).

---

### 1. Bug do apontamento semanal

**Reprodução (stub, admin e leitura, grupo "Sinais"):** Iniciar → Registrar apontamento. Aparece o toast **"Erro ao registrar o apontamento: topo is not defined"**, com `pageerror` em `salvarApontamento (mod-gestao.js:1060)`. As duas escritas, porém, já foram feitas (`__escritas`): `apontamentos` insert e `apontamento_itens` insert.

**Causa (certa):** `mod-gestao.js:1060`, `$('#main').innerHTML = topo + ...`. `topo` é `const` local de `pageApontamento` (954) e de `renderApontamentoLista` (993) e não existe em `salvarApontamento` (1044). O `ReferenceError` cai no `catch` (1070) **depois** dos inserts.

Efeitos em produção:
- A pessoa vê "Erro", mas o apontamento foi gravado. A v16 cria o card no quadro do Pessoal pelo gatilho `tg_card_apontamento`, `db/v16_pessoal.sql:250-304`.
- A tela fica parada na lista. Como `gestao.apont = null` já foi feito (1057), um novo clique em "Registrar" não faz nada (retorna em 1045). Clicar em Suficiente/Insuficiente chama `renderApontamentoLista`, que lê `gestao.apont.grupo` e quebra com `TypeError`. Quem recarrega e refaz o apontamento **duplica** o registro e o card.
- Se houver ocorrências marcadas, elas são inseridas antes do erro (1054-1055) e ficam gravadas.

**Correção:** em `salvarApontamento`, declarar `const topo = topoGestao({ olho:'Equipe', titulo:'Apontamento semanal' }) + abasEquipe('apontamento');` antes do `$('#main')`, ou montar a tela de sucesso por uma função própria. Convém também desabilitar o botão durante o envio, para evitar duplo envio.

**Banco: nomes batem.** Tabelas `apontamentos(grupo,data,responsavel,responsavel_id)` e `apontamento_itens(apontamento_id,registro,data,assiduidade,entregas,sinalizado,justificativa,tratado)`: `db/aplicadas/soma_v10_apontamento.sql:24-71` mais `db/testes/esqueleto.sql:48-53`. As políticas v10 são `ap_select_v10`/`ap_insert_v10`/`api_*_v10` para `authenticated` (true), então o `insert().select('id').single()` passa. O gatilho v16 roda (rodei `v16_comportamento.sql` em `t_diag`: 33 ok, inclusive "apontamento gerou 1 cartão").

**O que verificar em produção** (o stub não tem):
- `select polname, cmd, qual from pg_policies where tablename in ('apontamentos','apontamento_itens','ocorrencias');`. As políticas de `ocorrencias` vêm de antes do repo, e nenhuma migração do repo as cria. Se o insert for só admin/pessoal, quem é "leitura" e marca "abrir ocorrência" (reincidente) leva um segundo erro em 1055.
- `select grupo, data, count(*) from apontamentos group by 1,2 having count(*)>1;`: duplicatas geradas pelo bug.
- `select id, chave from grupos where chave='pessoal';`: sem isso, `atividade_de_origem` devolve null e não há card (`v16:118-123`).

**Outros problemas da tela** (entram como contexto para o Reporte, que a substitui):
- `todosGrupos()` (`mod-gestao.js:143`) lista **todos** os grupos, embora o comentário de `index.html:6725` diga "a lista de grupos é que filtra". Na prática, qualquer membro aponta qualquer grupo.
- A rota está em `index.html:6708-6721` (`#/equipe/apontamento`) e a aba em `index.html:6726-6731`. Também aparece em `index.html:4439` (atalhos) e em `index.html:4901` (menu).

---

### 2. Papéis por grupo

### 2.1 Hoje, no banco

- `papel_atual()` e `portal_registro_atual()` **não estão no repo**: vieram de antes da v06 (produção). Nos testes, o esqueleto as simula (`esqueleto.sql:55-58`). A suposição é que `papel_atual()` = `perfis.papel` de `auth.uid()`. **Ler a definição real em produção antes da etapa 2:** `select pg_get_functiondef('public.papel_atual()'::regprocedure);` (e o mesmo para `portal_registro_atual`).
- `perfis.papel` tem check `('admin','pessoal','selecao','leitura')` (`soma_v07:28-29`). `fn_perfil_blindado` força 'leitura' na autocriação (`soma_v10_apontamento.sql:140`). A tela Contas troca o papel (`mod-admin.js:883-926`, `ctPapel`).
- Comparações com `papel_atual()` (contagem textual em `db/**/*.sql`):

| Forma | Ocorrências |
|---|---|
| `in ('admin','pessoal')` | 57 |
| `not in ('admin','pessoal')` | 15 |
| `<> 'admin'` / `= 'admin'` | 4 / 3 |
| `in ('admin','pessoal','selecao')` | 1 (`v32:298`) + `eh_comite()` (`soma_v07:36-41`) |

- **Uso direto de `perfis.papel = 'admin'`** (destinatários de avisos de sistema): `2.17.0:168` (feedback_novo), `v20:605`, `v23:150`, `v25:700`, `v27:718`. Esses **devem continuar** lendo o admin individual.
- Funções e políticas que usam `papel_atual()`, por migração:

| Migração | Funções | Políticas |
|---|---|---|
| soma_v06 | eh_comite | pscom_write |
| soma_v07 | eh_comite | — |
| soma_v08 | okr_pode_atualizar | okr_insert, okr_delete, okrcom_delete |
| soma_v09 | — | siteprj_write |
| soma_v10_apontamento | fn_perfil_blindado | api_update_v10 |
| soma_v10_portal | — | pavisos_select, pavisos_write, psol_select, psol_gestao, pouv_select, pouv_update |
| soma_v11_documentos | — | pdocs_select, pdocs_write |
| soma_v13_agenda | agenda_itens, agenda_editar_evento, agenda_cancelar, agenda_scrum_salvar | evtipos_write, agausencias_select, agausencias_write |
| v15 | sou_do_grupo (versão pré-v17), agenda_marco_salvar/remover, agenda_ausencia_salvar | grupos_write |
| v16 | pessoal_solicitacao_decidir | notifp_select |
| v17 | meu_nivel_no_grupo, grupo_salvar, grupo_fundir, grupo_acesso_salvar | gacc_select |
| v19 | meu_nivel_no_grupo, posso_gerir_grupo, grupo_estrutura_salvar | — |
| v20 | doc_gestor, grupo_chave_definir | — |
| v23 | studio_pode_aprovar, site_imprensa_editor | — |
| v24 | treinamento_gestor, treinamento_config_carimbo | — |
| v25 | doc_vinculo_pode, evento_ext_* (8), doc_emitido_ler/revogar | doc_emcfg_update, evx_cfg_update, doc_emit_select |
| v27 | cofre_gestor, cofre_config_carimbo | — |
| v28 | agenda_gestor | agpred_write |
| v29 | checkin_folha_criar/revogar | chkf_gestao, plinks_write |
| v30 | email_destinatarios, email_programar, email_programado_cancelar | eroteiros_gestao, eprog_ler |
| v32 | fila_situacao | — |
| 2.17.0 | feedback_salvar/decidir/excluir, membro_foto_pode/definir, atividade_comentario_excluir | — |

Cerca de 50 funções e 33 políticas. Há também cerca de 31 políticas `to authenticated using (true)`, que não olham papel nenhum.

- **Quadros:** a única regra é `meu_nivel_no_grupo()` (`v19:236-258`). Admin e pessoal → 'edicao' em tudo; membro do grupo (com herança) → 'edicao'; `grupo_acessos` → nível concedido; reservado → 'nenhum'; comum → 'leitura'. `posso_ver_grupo`/`posso_editar_grupo` (`v17:122-132`) e as políticas `atv_select`/`atv_write` (`v15:335-342`) dependem dela.
- **Chaves de grupo:** `grupos.chave` é única (`v15:56-72`) e hoje vale `'pessoal'` (`grupo_pessoal()`, `v16:96-100`), `'pmo'` e `'projetos'` (`v20:83-108`, `grupo_chave_definir` em `v20:1170`).

### 2.2 Hoje, no front

- `index.html:4232-4236`: `can()` = admin|pessoal; `podeQuadro()` = `can()`; `podeSelecao()` = admin|pessoal|selecao; `PAPEIS` (rótulos, usados no select de Contas, `mod-admin.js:909`).
- Usos de `can()` por arquivo: index 10, gestao 12, relatorios 8, agenda 6, documentos 5, admin 5, okrs 4, selecao 3, treinamentos 3, atividades 2, mailer 2, presenca 2, projetos 1, studio 1. `podeQuadro()`: index 6, gestao 5. `podeSelecao()`: index 7, relatorios 3, agenda 1, selecao 1.
- `papel === 'admin'` direto: `index.html:4981` (docGestor), `index.html:5024` (podeAprovarStudio), `mod-admin.js:892`, `mod-arquivos.js:1384`, `mod-cofre.js:736,764`, `mod-selecao.js:1662`, `mod-studio.js:791`, `mod-versoes.js:187`.
- Ficha (`mod-gestao.js:427-436`): ocorrências só com `podeQuadro()`, dados pessoais só com `can()`, abas em 483.
- Status do membro: **nenhum bloqueio** hoje para Desligado/Egresso (`STATUS_LIST`, `index.html:3590`). Só e-mails e cards filtram `status in ('Ativo','Em pausa / avaliação')`.

### 2.3 Desenho proposto

**Dados**
- Tabela `grupo_papeis (grupo_id int pk → grupos, papel text check in ('pessoal','selecao','lideranca'), definido_por, definido_em)`. A herança vem de `esta_no_grupo()` (`v19:165`), que já conta subgrupos: quem está em `NRO_PS_ENTREVISTAS` abaixo de `NRO_PS` herda selecao.
- Prefiro tabela a reaproveitar `grupos.chave`, porque `chave` é 1:1 e já tem outro significado (o quadro do Pessoal, o PMO). Semente: `NRO_PESSOAL→pessoal` (o mesmo grupo de `chave='pessoal'`, se for o caso), `NRO_PS→selecao`, `NRO_LEADERSHIP→lideranca`.
- `perfis.papel` passa a ser só `admin | leitura` na prática (admin individual) e fica como **reserva de transição**: durante a 2.18, valores 'pessoal'/'selecao' ainda valem como `union` (opcional, com data para sair).

**Funções**
- `papeis_atuais() returns text[]` (stable, security definer). Regras:
  1. Sem registro/perfil → `{}`.
  2. Membro com status `Desligado`/`Egresso` → `{}`, **mesmo que perfis.papel diga outra coisa**. Exceção: admin sem registro, que é conta técnica.
  3. `admin` se `perfis.papel='admin'`.
  4. Mais `distinct gp.papel` de `grupo_papeis gp where esta_no_grupo(gp.grupo_id, registro)`.
  5. Mais `perfis.papel` legado ('pessoal'/'selecao') enquanto durar a transição.
  6. Mais `leitura` se ativo.
- `tenho_papel(p text) returns boolean`: `p = any(papeis_atuais())` ou `'admin' = any(...)`.
- **`papel_atual()` mantém a assinatura e passa a devolver o papel de maior precedência:** `admin > pessoal > lideranca > selecao > leitura > null`. Assim as 57+15 comparações `in ('admin','pessoal')` seguem certas **sem reescrita**: lideranca não entra em pessoal, e um egresso devolve null (e `null in (...)` é null, que nega).
- Ponto de atenção: quem está em NRO_PS **e** em NRO_LEADERSHIP recebe `lideranca` em `papel_atual()` e perderia selecao. Por isso `eh_comite()` e `v32:298` passam a usar `tenho_papel('selecao') or tenho_papel('lideranca')`, ou só `'selecao'`, conforme a decisão abaixo. São dois lugares só.
- Desempenho: `papel_atual()` é chamada por linha em políticas. Fazer `papeis_atuais()` como SQL simples com `stable`, que o planner avalia uma vez por statement quando o argumento é constante. Medir com `explain analyze` num quadro grande.

**Papel "lideranca": ajustes específicos** (o que não sai de graça pela precedência)

| Onde | Ajuste |
|---|---|
| `meu_nivel_no_grupo` (`v19:236`) | se `tenho_papel('lideranca')`: membro do grupo → 'edicao'; `grupo_acessos` → o nível; senão → **'leitura' mesmo em grupo reservado**. Assim vê todos os quadros e escreve só nos seus. É a única regra de quadro; `atv_*`, `posso_*` e a view `grupos_visiveis` herdam. |
| Ficha completa exceto ocorrências | `dados_pessoais`, `avaliacoes` e `acessos_concedidos`: política de select passa a `papel_atual() in ('admin','pessoal','lideranca')`. São políticas de produção, fora do repo: ler antes. `ocorrencias` continua admin/pessoal. Front: `can()` dividido em `podeVerFicha()` (admin, pessoal, lideranca) e `podeEditarPessoas()` (admin, pessoal); `mod-gestao.js:427-436` usa `podeVerFicha()` para pess/avals e `podeQuadro()` para ocorrências. |
| "Escrita na maioria dos módulos" | decidir **módulo a módulo**: por padrão o helper `eh_gestao()` = admin, pessoal ou lideranca e trocar só nas políticas/funções da lista. Candidatos naturais a incluir lideranca: OKRs (`okr_*`), avisos do portal (`pavisos_write`), documentos (`pdocs_write`), agenda (`evtipos_write`, `agpred_write`, `agenda_gestor`), Studio (`studio_pode_aprovar`), treinamentos (`treinamento_gestor`), projetos/arquivos (`doc_gestor`), e-mails (`email_programar`, `eroteiros_gestao`). Manter fora (só admin/pessoal): Contas e papéis, grupos (`grupo_salvar`, `grupo_fundir`, `grupo_acesso_salvar`, `posso_gerir_grupo`), solicitações e decisão de acesso (`pessoal_solicitacao_decidir`, `psol_gestao`), ouvidoria (`pouv_*`), cofre (`cofre_gestor`), folha de check-in (vira só admin, veja §4.5), `fila_situacao`. |
| Front | `PAPEIS` ganha `lideranca:'Liderança'`, mas o select de Contas passa a oferecer só admin/leitura e mostra os papéis derivados como rótulo ("via NRO_PS"). `state.perfil.papeis = rpc('papeis_atuais')` em `abrirPortal` (`index.html:4661`); `can`/`podeSelecao`/etc. passam a ler `state.perfil.papeis`. Os oito `papel === 'admin'` diretos continuam valendo. |

**Egressos e desligados sem acesso**
- `papel_atual()` → null já nega as políticas de papel, mas **não** as ~31 `using (true)` nem as RPCs security definer.
- Proposta: (a) `portal_registro_atual()` devolve null para status inativo, e as RPCs já respondem `sem_registro`. Exige ler a definição de produção. (b) Uma política **`as restrictive`** `to authenticated using (public.conta_ativa())` em cada tabela com RLS, num laço `do $$` sobre `pg_tables where rowsecurity`. Ela soma um AND a todas as políticas sem reescrevê-las. (c) Gate no front: em `abrirPortal`, status inativo → tela "Acesso encerrado" e `signOut`.
- Falta decidir sobre `Sob demanda`.

**Telas**
- Administração › Grupos: coluna/ação "Papel do grupo" (pessoal/seleção/liderança).
- Administração › Contas: papel efetivo e a origem de cada papel.

### 2.4 Riscos

- `papel_atual()` de produção pode ter lógica extra (por exemplo, perfis sem registro); reescrevê-la às cegas quebra tudo. Ler antes.
- Alguém hoje com `perfis.papel='pessoal'` fora de NRO_PESSOAL perderia acesso ao fim da transição. Rodar o relatório `perfis.papel` × grupos antes de virar.
- Política restrictive em tabela usada por `anon` (rsvp, quiosque, site): aplicar só `to authenticated`.
- `meu_nivel_no_grupo` é chamada por linha em `grupos_visiveis`; o custo extra de `papeis_atuais()` precisa ser medido.
- Admin que também está em NRO_LEADERSHIP: a precedência resolve.

### 2.5 Plano de migração e teste (etapa 2)

1. Migração cria `grupo_papeis`, a semente por nome de grupo (com `raise notice` se o grupo não existir), `papeis_atuais`, `tenho_papel`, a nova `papel_atual`, o ajuste em `meu_nivel_no_grupo`/`eh_comite`/`v32:298`, as políticas de ficha e a restrictive. Idempotente.
2. O teste de banco novo substitui o `papel_atual()` do esqueleto pela versão real, com um `perfis` e `auth.uid()` vindos de `esqueleto_storage`. Matriz por papel: admin, pessoal-via-grupo, pessoal-via-subgrupo, selecao, lideranca dentro/fora do grupo e em quadro reservado, leitura, desligado, egresso. Para cada um: ver/editar card, ler ocorrência, ler dados_pessoais, chamar uma RPC de gestão, `select` numa tabela `using(true)`.
3. Rodar a bateria de banco inteira (as asserções antigas usam `teste.papel`: manter um modo de compatibilidade no esqueleto).
4. Navegador: `relatorios-por-papel`, `carga-por-papel`, `menu-lateral` e `quadro-e-acesso` com stub `papeis:[...]`.

---

### 3. Card espelhado

**Hoje:** botão "Copiar para outro quadro", em `mod-atividades.js:742` → `modalCopiar` (1564-1587) → `copiarCartao` (1588-1606) → RPC `atividade_copiar` (`db/2.17.0_notas_fotos_e_cartoes.sql:859-950`).
- Cria um **card novo** no destino, com código e seq do prefixo do destino. Copia, se escolhidos, descrição, checklists (cópia dos itens), pessoas, etiquetas e prazo, e grava `copia_de`. Comentários e histórico não vão. Grava log `copiou_de`/`copiou_para` e notifica.
- Arquivar o original ("mover") é opcional.
- Permissão: lê a origem (`posso_ver_grupo`) e escreve no destino (`sou_do_grupo`).
- Destinos no front: `meusGrupos().filter(posso.editar)`.
- Exibição: "Cópia de X" e "Cópias: ..." (`mod-atividades.js:657, 738-741`).

**Modelo proposto**
- Tabela `atividade_quadros (atividade_id → atividades on delete cascade, grupo_id → grupos, ordem double, adicionado_por int, adicionado_em, pk (atividade_id, grupo_id))`. O quadro "dono" continua sendo `atividades.grupo_id`, que dá código e prefixo; os espelhos são linhas aqui.
- Status, título, prazo, checklists, comentários e log são **um só** (é o mesmo registro). Só a ordem na coluna é por quadro.
- Visibilidade: nova `posso_ver_atividade(a)` = `posso_ver_grupo(a.grupo_id) or exists espelho com posso_ver_grupo`. Troca `atv_select` (`v15:336`) e as políticas de comentários, log e seguidores que hoje chamam `posso_ver_grupo(grupo_id)`.
- View `atividades_quadro` (`2.17.0:1025`) passa a ter `quadro_id` (= grupo_id na linha dona, união com as linhas de espelho) e `espelho boolean`. O front filtra por `quadro_id` em vez de `grupo_id`. Atenção: o filtro de `atvCarregar` precisa ser trocado em cada lugar que usa `grupo_id=eq`.
- **Regra de escrita** (pedido: "respeitando a permissão de escrita do criador em todos os grupos ligados"):
  - **Espelhar** (criar o vínculo) exige `posso_editar_grupo` no quadro dono **e** no quadro novo. Quem espelha tem de escrever nos dois.
  - **Editar** o card: proponho `posso_editar_grupo` em **qualquer** quadro ligado. É o mesmo card, então quem trabalha no quadro espelhado precisa mexer nele. A alternativa estrita, editar só com escrita em todos os quadros, fica para o usuário confirmar.
  - **Desvincular** um espelho: edição naquele quadro. **Arquivar/excluir**: edição no quadro dono.
- `atividade_editar` troca `sou_do_grupo(v_a.grupo_id)` por `posso_editar_atividade(v_a.id)`. A política `atv_write` também.
- Front: no modal, opção "Espelhar (o mesmo card nos dois quadros)" × "Copiar (card novo)"; chip "também em ORT, SIN" no card; no quadro, um selo de espelho.
- Notificações: os seguidores já são por card, então nada muda.

**Depende da etapa 2** (lideranca vê todos os quadros mas não escreve; a regra precisa de `posso_editar_grupo` já com o papel novo). Sugiro que entre na etapa 2.

---

### 4. Esboço de dados

### 4.1 Reporte semanal (substitui o Apontamento)

**Tabelas**
- `reporte_frentes (id, tipo 'departamento'|'projeto', grupo_id?, projeto_id?, nome, responsavel_registro, ativo)`: o departamento ou projeto que cada membro de NRO_LEADERSHIP responde. Um responsável pode ter mais de uma frente.
- `reporte_ciclos (id, semana date unique, prazo timestamptz, reuniao_em timestamptz, reuniao_evento_id?, status 'aberto'|'fechado', criado_por)`. Um agendador (fila v32) abre o ciclo seguinte. A configuração do padrão fica em `reporte_config (dia_prazo, hora_prazo, dia_reuniao, hora_reuniao, newsletter_*)`.
- `reportes (id, ciclo_id, frente_id, autor_registro, etapa smallint 1-3, enviado_em, atualizado_em, unique(ciclo_id, frente_id))`.
- Etapa 1, apontamento: `reporte_apontamentos (reporte_id, registro, assiduidade, entregas, sinalizado, justificativa, card_id?)`. Herda o modelo de `apontamento_itens`. **A sinalização abre card no quadro do Pessoal** via `atividade_de_origem('reporte', item_id, ...)` (`v16:107`), com `origem_tipo` novo no check de `v15:159`, `p_avisar=true`. A reincidência em 30 dias continua sugerindo ocorrência, mas a ocorrência é criada **pelo Pessoal** a partir do card, não pela liderança (resolve o risco de RLS de §1).
- Etapa 2, escalonamento: `reporte_escalonamentos (reporte_id, tipo 'card'|'topico', atividade_id?, texto, ordem)`, os cards e tópicos para a reunião.
- Etapa 3, feed: `feed_itens` (veja 4.2), com `reporte_id` preenchido.
- Histórico: `apontamentos`/`apontamento_itens` ficam só leitura na ficha (`mod-gestao.js:432`, 786-799).

**RPCs**
- `reporte_abrir(ciclo, frente)`, `reporte_salvar(p jsonb)` (rascunho por etapa), `reporte_enviar(id)`.
- `reporte_painel(ciclo)`: quem preencheu ou não, por frente.
- `reporte_unificado(ciclo) returns jsonb`. Para o PDF (doc-nro): resumo por frente; cards atrasados (`atividades_quadro.atrasada`); cards com **mais de 2 replanejamentos** = `count(atividade_log where tipo='prazo' and de is not null) > 2` (o log já existe: `2.17.0`, linhas ~701-703); ocorrências do período (só para quem lê ocorrências: admin/pessoal; lideranca vê só a contagem).
- Permissão: `tenho_papel('lideranca')` e ser o responsável da frente (admin vê tudo).

### 4.2 Feed da equipe

- `feed_itens (id, titulo not null, subtitulo not null, texto, imagem_path (storage, bucket 'feed'), autor_registro, reporte_id?, frente_id?, publicado_em, status 'rascunho'|'publicado'|'oculto', fixado bool)`.
- RLS: select para membros ativos e publicado; escrita para o autor (via reporte) e para admin/pessoal (moderar).
- RPCs: `feed_publicar`, `feed_ocultar`, `feed_lista(antes, limite)`.
- Tela: no Início ou em `#/feed`.

### 4.3 Newsletter

- `newsletters (id, tipo 'semanal'|'mensal', publico 'membros'|'comunidade', periodo_ini, periodo_fim, assunto, html, texto, status 'rascunho'|'em_aprovacao'|'aprovada'|'enviada'|'cancelada', card_id, programado_id → email_programados, criado_por)`. O conteúdo nasce dos `feed_itens` do período.
- **Aprovação por card:** ao pedir aprovação, cria um card (`atividade_de_origem('newsletter', id, ...)`, generalizada para receber o grupo; hoje ela é fixa no quadro do Pessoal, `v16:117`) no quadro de NRO_LEADERSHIP. Tabela `newsletter_aprovacoes (newsletter_id, registro, decisao 'aprova'|'recusa', comentario, em, pk(newsletter_id, registro))`. A RPC `newsletter_decidir` exige `tenho_papel('lideranca')`. Com 3 aprovações e 0 recusas, status 'aprovada'; então `email_programar` (`v30:142`) agenda o envio e o card vai para concluída. Qualquer edição do conteúdo zera as aprovações.
- **Comunidade (sem conta):** `comunidade_inscritos (id, email unique citext, nome, origem, inscrito_em, confirmado_em, token uuid unique, descadastrado_em)`. RPCs `anon`: `comunidade_inscrever(email, nome)` (double opt-in recomendado) e `comunidade_descadastrar(token)`, idempotente, sem login; página `descadastro.html?t=...`. O envio para a comunidade sai por um lote próprio na `notificar-email` (`comunidade_lote`), com `List-Unsubscribe` e `List-Unsubscribe-Post` no cabeçalho e link com o token por destinatário. Membros: o semanal vai como tipo `reporte` nas preferências (4.4); o mensal da comunidade fica fora das preferências.

### 4.4 Preferências de notificação (tipo × canal)

**Hoje**
- `notificacao_preferencias (registro pk, email_modo 'imediato'|'resumo'|'nunca', ultimo_email)` (`v16:532-571`), salva por `notificacao_preferencia_salvar`. "Resumo" é um envio a cada 20 h ou mais, não um resumo de verdade.
- O lote `notificacoes_email_lote` (dona atual: `v23_studio.sql`; versões em v16 e v18) agrupa por pessoa.
- Push: `push_inscricoes`, `push_lote`/`push_baixa` (`v32:462-651`), que hoje vai para todo aviso, sem preferência; `notificacoes.push_em`.
- Edge `supabase/functions/notificar-email/index.ts` (1371 linhas). `passada()` (1293) chama `notificacoes_email_lote` (1313), mais `enviarAgenda` (610, convites/alterações/lembretes via `agenda_envios`), `enviarDocumentos` (636), `enviarPS` (895), `enviarProgramados` (943, as **pílulas** e os e-mails programados, `email_programados` com `roteiro_id`, `v30:79`) e `enviarPush` (1191).
- Tipos gravados em `notificacoes.tipo` (via `notificar()`, `v15:259`): atividade_atribuida, atividade_mencao, atividade_moveu, atividade_prazo, atividade_sinalizada, quadro_liberado, projeto_equipe, feedback_novo/status/comentario, doc_revisao/aprovada/devolvida, studio_aprovacao/decisao, treinamento, evento_ext, solicitacao_respondida, `pessoal_<tipo>`.

**O que muda**
- `notificacao_categorias (tipo_prefixo → categoria)` ou uma função `notificacao_categoria(tipo)`. Categorias: atividades, bugs_melhorias (feedback_*), documentos (doc_*), studio, reporte (reporte_*, newsletter semanal), agenda (evento_ext, agenda_*), pessoal, treinamentos, sistema.
- `notificacao_pref_canais (registro, categoria, push bool default true, email text check in ('instantaneo','diario','semanal','nunca') default 'semanal', pk(registro, categoria))`. Sem linha = padrão (push sim, e-mail semanal). `notificacao_preferencias` fica com `ultimo_diario`, `ultimo_semanal` e o fuso; `email_modo` vira legado, migrado para todas as categorias.
- `notificacoes_email_lote` passa a separar: instantâneo (pendentes de categorias 'instantaneo'), **diário** (um envio por dia num horário fixo, agrupado por categoria) e **semanal**. `push_lote` respeita `push=false`.
- **Sempre e-mail instantâneo:** convites de evento (`agenda_envios`) e pílulas (`email_programados`) já correm por filas próprias, fora de `notificacoes`, então basta **não** colocá-los sob preferência (documentar e testar).
- Edge: novos templates "resumo diário" e "resumo semanal" (agrupados por categoria, nos templates novos de e-mail) e a chamada do lote com `p_modo`. Na tela do sininho, uma grade categoria × (push, e-mail).

### 4.5 QR estático de check-in

**Hoje:** `checkin_folhas (id, numero identity, token uuid, rotulo, criada_*, revogada_*, usos, ultimo_uso)` (`v29:59-75`). Criar e revogar: admin|pessoal (`v29:77-99`). **Várias folhas ativas ao mesmo tempo.** O `token` é legível por select (admin/pessoal), então o PDF pode ser baixado de novo a qualquer momento (`mod-presenca.js:163-176`, `presBaixarFolha`, botão "PDF" em 142). Check-in: `registrar_checkin_folha(token)` (`v29:103`). UI: `presFolhas` / `presNovaFolha` / `presCriarFolha` (`mod-presenca.js:133-185`).

**Muda para**
- Índice único parcial `on checkin_folhas ((true)) where revogada_em is null`: uma folha ativa.
- `checkin_folha_criar` só para admin (`perfis.papel='admin'`): na mesma transação revoga a ativa (`revogada_por`, motivo 'substituída') e cria a nova. Devolve o token **só nessa chamada**.
- Colunas `baixada_em`, `baixada_por`: o download é registrado na criação. `revoke select (token)`: uma view `checkin_folhas_lista` sem token para a lista.
- Front: tira o botão "PDF" das folhas antigas. "Gerar nova folha" mostra o aviso "a folha CHK-00N deixa de valer" e baixa direto. Se o PDF falhar, é preciso gerar outra. Avaliar com o usuário um "baixar de novo" só para admin e registrado (mais simples: não ter).

### 4.6 Ata de evento

**Hoje**
- Tipos predefinidos: `agenda_predefinidos` (`v28:97-125`), com nome, duração, local, convidados, grupos, lembretes e recorrência. Escrita admin|pessoal. Aplicados no evento por `agAplicarPredefinido` (`mod-agenda.js:478-482, 607, 663`); o evento guarda `predefinido_id`.
- Formulário de ata: `mod-formularios.js`, chamado por Arquivos em `#/arquivos/<PN>/escrever` (`frmEscrever`, linha 64). O PN precisa existir antes (`doc_arquivo_criar`, `mod-arquivos.js:1136`). A definição do formulário fica em `doc_series.formulario` (`v26`), o rascunho em `doc_formulario_rascunhos` (`v26:63`), as RPCs são `doc_formulario_abrir/salvar/enviar` (`v26:212-283`) e os valores padrão em `frmPadroes` (`mod-formularios.js:91-105`: hoje, agora, eu, projeto). O tipo "ata" existe nos rótulos de série (`mod-arquivos.js:46, 1419`).
- `evento_tipos` (`soma_v13:87`) é outra tabela (cor e categoria), não a de predefinidos.

**Muda para**
- `agenda_predefinidos` ganha `gera_ata bool default false` e `ata_serie_id → doc_series`. Na falta de série, usa uma série padrão de atas configurada em Arquivos.
- `eventos` (ou a tabela de evento do v13) ganha `ata_arquivo_id → doc_arquivos`, um PN por evento.
- RPC `evento_ata_abrir(evento_id)`: se já há PN, devolve-o; senão cria o PN na série (reaproveita a lógica de `doc_arquivo_criar`), grava `ata_arquivo_id` e um **rascunho inicial** em `doc_formulario_rascunhos` com data, hora, local, participantes (convidados e confirmados) e projeto, mapeados pelos `id` de campo da definição. Devolve `{codigo}`. A permissão é ser organizador ou convidado do evento e poder escrever na série.
- Front: botão "Gerar ata" na página do evento (`agEventoPagina`, `mod-agenda.js:611`) → RPC → `#/arquivos/<PN>/escrever`. O formulário abre com origem 'rascunho', então os padrões não sobrescrevem. "Salva o rascunho antes de gerar" é atendido pelo rascunho gravado na RPC, e o PN fica registrado.

---

### 5. Agenda e atividades (arquivo:linha)

- **Filtro de horário de trabalho**
  - `mod-agenda.js:909-913`: `agProximoLivre` só considera `EXPEDIENTE` (08-18, seg-sex, constante global em `index.html:3584`) e ignora o expediente pessoal de `portal_agendas`.
  - Faixa de disponibilidade fixa em 7-21h: `AG_D0/AG_D1` (`mod-agenda.js:856`, usada em 869-897).
  - O expediente pessoal é configurado em `mod-agenda.js:1127-1184`.
  - A carga do Início também usa `EXPEDIENTE` (`index.html:6311-6325`).
  - A RPC `portal_agenda_ocupacao` (`soma_v13:1058`) não filtra horário.
- **"Próximo horário livre"**
  - Botão em `mod-agenda.js:689`; função em `mod-agenda.js:899-923`.
  - Defeito: sempre busca a partir de `new Date()` (904, 910-916), então cada clique devolve o mesmo horário.
  - Correção: começar de `fim do horário selecionado` (`f.data` + `f.hi`) quando o clique se repete, ou guardar um cursor em `agenda.ev`. A janela deixa de ser limitada ao expediente (o pedido é tirar o filtro).
- **Autosave do card que redesenha a cada ação**
  - `mod-atividades.js:1048-1060` (`mudarCampo`): cada `onchange` grava e chama `telaCard(a.codigo)` (1059), que redesenha o card inteiro e perde o foco.
  - Disparos: status, responsável, prazo, prioridade e estimativa (`mod-atividades.js:713-727`), título (`editarTitulo`, 1008-1013) e descrição (`salvarDescricao`, 1046).
  - `cartaoSalvar` (1082-1093) já é o modelo sem redesenho (pessoas e etiquetas).
  - Correção: debounce de ~1,5 s e no blur, atualizar `atividades.card` localmente e redesenhar só ao fechar ou ao receber erro.
- **Ficha do candidato com e-mails**
  - `mod-selecao.js:420` (`psAbrirFicha`); o e-mail aparece em `mod-selecao.js:448` (lista `dl`, `['E-mail', c.email]`).
  - Também na lista de candidatos (`mod-selecao.js:312`), na agenda de entrevistas (765) e no modal de e-mail (399).
  - `copiar()` já está importado da casca (`mod-selecao.js:22`).

---

### 6. Estado dos testes

- `colisoes`: rc=0, "Nenhuma colisão de nome global."
- `menu-lateral`: rc=0, 79 ok, 0 FALHA (45 s).
- Banco: `v16_comportamento.sql` sobre esqueleto + v15 + v16 em `t_diag`: 33 ok. O banco foi apagado.

Base verde.

---

### Perguntas abertas para o usuário

1. Liderança acessa o módulo Seleção (fichas de candidatos)? "Todos os módulos" sugere que sim. Se sim, `eh_comite()` inclui lideranca.
2. Card espelhado: editar com escrita em **qualquer** quadro ligado (proposta) ou em **todos**?
3. Status "Sob demanda": tem acesso (como leitura) ou não?
4. Re-download da folha de QR: proibido (proposta) ou permitido ao admin com registro?
5. Lista de "escrita na maioria" para liderança: confirmar a tabela de §2.3 (dentro e fora).


---

## Anexo G: mapa do CSS da casca

### Inventário: CSS da casca (`/home/claude/membro/index.html`, `<style>` nas linhas 23 a 3334) contra o design system v2

Não editei nenhum arquivo. Os contrastes abaixo foram calculados com a fórmula de luminância do próprio `testes/menu-lateral.mjs` (linhas 372 a 373). O script de cálculo está em `(scratchpad da sessão anterior, indisponível)/c.mjs` e `c2.mjs`.

**Premissa que muda o trabalho:** a v2 não tem tema claro.
- `DIRETRIZES.md:14` diz que a interface usa sempre superfícies escuras Void.
- `PADROES.md:578` cita um "card *Tema claro* do design system", mas esse card não existe nos `previews/01` a `18`.
- Por isso, os valores do claro abaixo são proposta minha. Eles saem de duas fontes da v2:
  - a regra de pareamento: fundo claro leva o tom dark da família (`DIRETRIZES.md:34`, `tokens.css:19`);
  - a escala de tinta formal que já existe em `tokens.css:104-110` (`--paper`, `--paper-tint`, `--formal-ink`, `-2`, `-3`).

---

### 1. Tokens

### 1a. `:root` (linhas 32 a 57), valor atual e equivalente v2

**Ficam como estão (já são v2):**
- `--bg #050807` = `--sulco-dark` (`--void`).
- `--panel #0B1210` = `--sulco-primary` (`--painel`).
- `--muted #9AA5A1` = `--pia-primary` (`--nevoa`).
- `--dim #616C68` = `--sulco-light` (`--grafite`).
  - Dá 3,69:1 sobre o void e 3,52:1 sobre o cartão. Reprova AA em texto, e a própria v2 avisa isso em `tokens.css:75`. Nenhum teste mede o escuro.
- `--deep #00352F` = `--cortex-dark`.
- `--green #00594F` = `--cortex-primary` (Axon).
  - Só tem dois usos: `.tre-cert-fita` (2902) e `mod-gestao.js:1061`.
- `--syn #CEDC00` e `--syn-rgb 206,220,0` = `--cortex-accent`. `--syn-tx`, `--syn-borda` e `--foco` também ficam em `#CEDC00`.
- `--bg-topo #081511` = literal de `.nd-bg` (neuro.css:74).
- `--toast #151B19` = `.toast` (neuro.css:695).
- `--campo rgba(255,255,255,.05)` = `.fld input` (neuro.css:178).
- `--card` = `--card`.
- `--painel-rgb 11,18,16` = `--sulco-primary`.
- `--r 18px` e `--max 1240px`.
- `--fd` e `--fm` são idênticos.

**Mudam:**
- **`--ink #F5F5F7` → `--pia-light #E8EDEB`**, e `--ink-rgb 245,245,247` → `232,237,235`.
  - O `tokens.css:84-85` continua escrevendo `--line` e `--line2` com o literal `245,245,247`, uma inconsistência da v2.
  - A diferença na linha a 8% é desprezível (24,27,26 contra 23,26,25). Recomendo `--line` continuar derivando de `--ink-rgb`.
- **Conjunto funcional.** `--bad`, `--ok`, `--warn` e `--info` passam ao tom primary, que serve de linha, indicador e texto de pill, como em `.pill[class*="st-"]` (neuro.css:252). Os trios `-rgb` acompanham:

  | Token | Atual | Proposto | `-rgb` proposto | Contraste no void |
  |---|---|---|---|---|
  | `--bad` | `#F1806F` | `--fn-critical-primary #FF2D20` | `255,45,32` | 5,41:1 |
  | `--ok` | `#4ADE97` | `--fn-nominal-primary #00F59B` | `0,245,155` | 13,9:1 |
  | `--warn` | `#F5C36A` | `--fn-caution-primary #FFAA00` | `255,170,0` | 10,5:1 |
  | `--info` | `#7FA7F2` | `--fn-signal-primary #00C8FF` | `0,200,255` | 10,3:1 |

- **Textos sobre caixa tingida** passam ao tom medium, que é o "rótulo" de `tokens.css:59-60`:
  - `--bad-tx #F5B0A5` → `--fn-critical-medium #FF948C`: 8,96:1 sobre `rgba(255,45,32,.09)` no void;
  - `--warn-tx #EFD9A8` → `--fn-caution-medium #FFD470`;
  - `--info-tx #B9CEF5` → `--fn-signal-medium #7FE0FF`.
- **Token novo `--ok-tx` = `--fn-nominal-medium #7DFFC8`.** Hoje a casca usa `--ok` direto como texto em:
  - `.aviso-box.ok` (2402), `.tre-ok` (2889), `.frm-pronto` (3151);
  - `.ml-st.ok` (2397), `.vs-tipo.novo` (1482), `.tre-res.ok` (2886), `.badge-pub.sim` (1835).
- **`--cinza-rgb 142,142,147` → `--fn-idle-primary` (`124,132,153`).** Idle é o "offline ou desativado" da v2.
  - O cinza literal `#8E8E93` aparece no CSS em `.calm-chip` (948), `.ini-ev` (1194) e `.int-row .pt` (1305).
  - Aparece também no JS em `STATUS_SOL.cancelada` (3655), `corDoItem` (6477), 6600 e 7162. Todos passam para `var(--dim)` ou Idle.
- **`--roxo-rgb 167,139,250` já é `--dendrito-primary #A78BFA`.** Só `--roxo-tx #C4B5FD` muda, para `--dendrito-medium #CDBEFC`.
- **`--teal #2DD4BF` e `--teal-rgb` (resto do Soma) não têm equivalente.** Proposta, separando por papel:
  - **Usos decorativos vão para neutro**, como na v2 (`.tile .sq` em Névoa; `.lt-eu .av` com fundo Cortex e texto ink):
    - `.avx` (898), `a.ini-rc .ic-q` (1271), `a.ft-t>.ic` (1448), `.cof-ic` (3210).
  - **Usos de categoria ou dado mantêm o nome como apelido de Ion:**
    - onde: `.tag-mini.equipe` (1278), `.arq-ic.registro` (1955), `.evd-t i.soma` (1145), `.t-gelo` e `.t-dragao` (1867), `ETIQUETA_CORES` em `mod-atividades.js:67`;
    - valores: `--teal` = `--ion-medium #93E8DB` (14,2:1) e `--teal-rgb` = `91,191,176` (`--ion-primary`).
  - Ressalva da v2: família secundária "nunca ao lado de Synapse ou de um CTA Cortex" (`DIRETRIZES.md:30`).
- **`--green2 #0B7D6E`** só é usado em `.barra .fill` (1586), além do literal na `.b2` (linha 114).
  - Remover. A barra vira traços em `var(--fam-primary, var(--ion-primary))` (neuro.css:662), e o `.b2` vira `--cortex-primary` (neuro.css:85).
- **`--lima-tx #E4EB9C`** não tem equivalente, porque Synapse tem um tom só.
  - É usado em `.aviso-box.lima` (1764) e `.tre-caixa.dica` (2824).
  - Synapse não tinge caixa, então essas caixas viram Cortex: tinta `rgba(0,89,79,.12)` e texto `--cortex-medium #A9CCC4`.
- **Tokens mortos**, sem uso em `index.html` nem em `mod-*.js`: `--teal-tx`, `--ocup-tx`, `--fora-tx`, `--cinza-tx` e `--glass`. Ver o limite do teste no item 4.
- **Faltam na casca e entram como constantes**, fora do bloco de tema e fora da ilha:
  - raios: `--r-sm 11`, `--r-md 14`, `--r-lg 20`, `--r-xl 24`, `--r-chip 6`, `--r-tag 5`, `--r-badge 4`;
  - movimento: `--t-fast`, `--t`, `--ease`;
  - tipografia e espaço: `--fs-*`, `--tr-*`, `--s1` a `--s10`;
  - as famílias de que a casca precisar: `--fn-*`, `--ion-*`, `--lumen-*`, `--cortex-*`.
  - Detalhe: `--lt-ease` (142) é `cubic-bezier(.2,.8,.3,1)`; na v2 é `var(--ease)` = `(.2,.7,.2,1)`.

### 1b. `:root[data-tema="claro"]` (linhas 62 a 75), proposta

**Superfícies e tinta** (escada formal da `tokens.css`):
- `--bg #F2F5F1` → `--pia-light #E8EDEB` (= `--paper-tint`).
  - Alternativa: manter `#F2F5F1`, que não é de família, mas é o que o teste fixa (item 4).
- `--panel`, `--campo` e `--toast` ficam em `#FFFFFF` (`--paper`).
- `--card` fica `rgba(255,255,255,.74)`.
- `--bg-topo #E2EEE8` → `--cortex-light #E3EFEC`.
- `--fundo-rgb 250,252,249` → `255,255,255`.
- `--ink #0F1714` → `--sulco-medium #1D1D1F` (`--blackout`/`--formal-ink`).
  - `--tom` e `--ink-rgb` passam a `29,29,31`.
  - Contraste: 14,22:1 na página e 16,13:1 no cartão.
- `--muted #48554F` → `--pia-dark #2E3533` (`--formal-ink-2`): 10,61:1 na página.
- `--dim #66726D` → `--sulco-light #616C68` (`--formal-ink-3`).
  - Passa em repouso: 4,61:1 na página, 5,22:1 no cartão, 5,17:1 no `#hd` e 5,45:1 sobre branco.
  - Reprova sobre tinta: 4,19:1 com hover `.05`, 4,03:1 com `.07`, 3,87:1 com seleção `.09` na página, e 3,95:1 sobre tinta Axon `.10`.
  - Regra que decorre: texto dim nunca fica sobre tinta; hover e `.on` sobem para `--muted` ou `--ink`.

**Funcionais.** Texto e ponto usam o tom dark (9,8 a 11,8:1 na página). O trio `-rgb` usa o primary, porque tinta a 6–9% sobre branco dá aproximadamente o tom light da família:

| Token | Atual | Proposto (texto e ponto) | `-rgb` proposto |
|---|---|---|---|
| `--ok` | `#12804F` | `--fn-nominal-dark #00422A` | `0,245,155` |
| `--warn` | `#9A5B00` | `--fn-caution-dark #4D3300` | `255,170,0` |
| `--bad` | `#C2412D` | `--fn-critical-dark #5C0A05` | `255,45,32` |
| `--info` | `#2D5BC4` | `--fn-signal-dark #003A4D` | `0,200,255` |

- `--bad-tx`, `--warn-tx` e `--info-tx` usam o mesmo dark: cerca de 10,6:1 sobre a caixa tingida. `--ok-tx` também = `#00422A`.
- Custo dessa escolha: a borda `.35` do primary fica quase invisível (1,18 a 1,66:1). É decorativa, mas é a forma da pill.
- **Não use primary como texto no claro:** nominal 1,22:1, caution 1,61:1, signal 1,66:1, critical 3,14:1.

**Synapse no claro vira Axon.** A v2 descreve o Synapse como "the spark for Axon", e a regra de pareamento dá o tom da família:
- `--syn-tx #5B6600` → `--cortex-primary #00594F`: 6,98:1 na página, 7,92:1 no cartão, 5,98:1 sobre tinta Axon `.10`.
- `--syn-borda #7C8700` e `--foco #5B6600` → `#00594F`: 6,98:1 como não-texto, contra 3,33:1 hoje. Synapse no papel dá 1,28:1.
- `--syn-rgb 124,135,0` → `0,89,79`.
- `--lima-tx #4D5700` → `--cortex-dark #00352F`.
- `.btn.solid` continua Synapse com `--deep` (8,94:1).

**Secundárias:**
- `--teal #0A776B` → `--ion-dark #0B4F48` (7,97:1); `--teal-rgb` → `11,79,72`.
- `--roxo-rgb 109,74,200` → dendrito-dark `59,35,120`; `--roxo-tx #5B3FB0` → `--dendrito-dark #3B2378` (10,45:1).
  - A borda pode ficar em dendrito-primary, para atender "roxo sempre em mais de um tom".
- `--cinza-rgb 100,104,110` → idle-primary `124,132,153` (3,16:1, aceito como não-texto).

**Contrastes que ainda precisam ser medidos:**
- (a) Cada token de texto do claro contra cinco fundos: página, cartão (`.74` sobre `--bg`), `#hd` (`rgba(--fundo-rgb,.84)`), branco, e caixas tingidas (`rgba(--X-rgb,.06-.09)` sobre o cartão).
- (b) `--muted` e `--dim` sobre as tintas de estado `rgba(--tom,.05/.07/.09)`.
- (c) Não-texto ≥ 3:1: `--syn-borda` e `--foco` contra página e branco; pontos de status contra o cartão.
- (d) Preenchidos com texto `--deep`, que quebram no claro quando `--ok`/`--bad` escurecem (cerca de 1,2:1):
  - `.evp-p .rs.ok/.warn/.bad` (1127-1129);
  - `.tre-ed-marca.on` (2970, fundo `--ok` com texto `--bg`);
  - `.agw-chip` e `.agw-ev` (texto `--deep` sobre `--cc`).
  - Precisam de um token próprio para o texto sobre o estado cheio.
- (e) `.btn.danger` da v2 (`#FFF` sobre `#FF2D20`) dá 3,72:1 e reprova AA a 14px/600 nos dois temas.
- (f) `.btn.claro` no claro: `--bg` sobre `--ink` dá 14,22:1.

---

### 2. Fontes

- **`index.html:22`** carrega `Archivo:wght@500;600;700;800` e `IBM+Plex+Mono:wght@400;500;600`. Trocar por `Archivo:wght@500;600;700`, `IBM+Plex+Mono:wght@400;500;600` e `Instrument+Sans:ital,wght@0,400;0,500;0,600;1,400`.
  - O 800 não tem nenhum uso.
  - A v2 (neuro.css:9) só carrega Plex Mono 400 e 500, mas a casca usa 600 em mono:
    - `.lt-pe .bolha` (243), `.tm-bt .bolha` (314), `.tile-n` (407);
    - `.calm-cel.hoje .calm-n` (945), `.tre-vf-g` (2883), `.tre-ed-vf` (2971).
    - Manter o 600 ou baixar esses seletores para 500.
  - O itálico 400 é necessário: `.kb-sem` (523), `.cm-tp .ed` (656), `.okr-com.sistema .tx` (1756), `.frm-frase` (3157).
  - `font-weight:650` (`.md strong` 693, `.tre-md strong` 2803) vira 600.
  - Instrument Serif não é necessária: é só do registro formal.
- **`index.html:56`**: `--f:-apple-system,...` → `'Instrument Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif` (tokens.css:122).
- **`index.html:78`**: o corpo está em 14.5px/1.6; a v2 usa 15px/1.65 (`--fs-body`/`--lh-body`).
  - Na primeira passada, recomendo manter 14.5. A Instrument Sans tem métricas diferentes das fontes do sistema e pode mudar truncamentos em `.lt-filho`, `.kb-tit`, `.pl-item .tt` e `.pj-card .nm`.
- **`index.html:85`**: o campo base está em 14.5; na v2, campo solto é 13.5 (`--fs-sm`) e `.fld` é 15.
- **Herdam a fonte do corpo sem `font-family`**, e precisam de `var(--fd)` 600:
  - `.fld label` (787);
  - `.ml-mais summary` (2367).
- **Plex Mono usada em texto que não é código nem dado.** A v2 proíbe mono em rótulos, títulos e datas, então estes vão para `--f`:
  - `.card .sub` (744), `.form .sub` (2233), `.sn-item .qd` (390), `.cm-tp span` (575);
  - `.resposta .quem` (1434), `.fb-resposta .quem` (1513), `.vs-data` (1475), `.arq-ev .qd` (2118);
  - `.evx-hist .qd` (3108), `.cof-log .qd` (3241), `.st-hist .q` (2526), `.int-row .qd` (1306);
  - `.ag-linha .quando` (2245), `a.ini-tf .pz` (1255), `.okr-prazo` (1697), `.tre-ed-status` (2925), `.acc-row .mt` (1673).
  - Hora e número do dia continuam mono, como a própria v2 faz em `.calm-n` e `.calm-chip .h`.
- **Fora da casca, mesmo trabalho depois:** `admin.html:12`, `rsvp.html:11` e `tour.html:18` têm cópias próprias. `quiosque.html:11` ainda usa Space Grotesk, Inter e JetBrains Mono (marca antiga).

---

### 3. Componente por componente

**Rótulos: Plex Mono em caixa alta → Archivo 600** (`.rotulo` e `.fld label` da v2: 10–10.5px, tracking .12–.14em, `--dim` ou `--muted`). São cerca de 77 seletores no total:
- Menu e busca: `.hd-tag` 174, `.lt-rotulo` 231, `.lt-divisor` 235, `.pl-grp` 347, `.adm-grupo` 399.
- Quadro e cartão: `.kb-selo` 419, `.grp-item .tag` 447, `.kb-col header` 465, `.kb-top .org` 518, `.cd-bloco>label` 610, `.sel-grp` 631.
- Markdown: `.md-dica` 675, `.md h5` 691, `.md-tabela th` 715.
- Topo e avisos: `.eyebrow` 735, `.sl-tag` 811, `.sl-evento .quando .m` 859 (mês: data), `.card .head a` 882.
- Agenda: `.calm-cab span` 930, `.agx-camadas h5` 1000, `.agw-dcab .dw` 1022, `.evp-op` 1130, `.evp-disp h4` 1135.
- Início: `.ini-grp` 1170, `.ini-dh .dw` 1187, `.ini-limpar` 1262, `.tag-mini` 1275.
- Equipe e serviços: `.org-sec h4` 1379, `a.srv .lb` 1389, `a.srv .go` 1392, `.form-card .voltar` 1401, `.dl .it dt` 1429.
- Rodapé: `a.ft-t .k` 1450, `.ft-grid h4` 1514, `.ft-base` 1519, `.atl h4` 1523.
- Dados: `.tabela th` 1537, `.metrica .rot` 1575, `.tl-item .dt` 1660 (data).
- Gestão e seleção: `.acc-group h4` 1669, `.ps-rot` 1770, `.slot-dia h4` 1799, `.comp-bloco>h5` 1837.
- Projetos e arquivos: `.pj-sup` 1930, `.pj-resumo span` 1938, `.arq-fita` 2007, `.arq-meta dt` 2037, `.arq-sec h3` 2045, `.arq-oque .rot` 2074, `.arq-rel .rot` 2093.
- Admin: `.adm-item .off` 2217, `.lista .item .off` 2229, `.preview .sl-tag` 2250, `.pv-evento .quando .m` 2256.
- Studio e criador: `.st-partidas-g b` 2476, `.st-como h4` 2518, `.st-conta-cab` 2537, `.cr-sec h4` e `.cr-rot` 2584.
- Treinamentos: `.tre-ficha dt` 2748, `.tre-md h4` 2795, `.tre-tabela th` 2816, `.tre-caixa-t` 2822, `.tre-vinfo .src` 2849, `.tre-vbtn` 2851, `.tre-links h2` 2857, `.tre-vf .seg[data-certa]::after` 2881, `.tre-ed-sub h4` 2953.
- Documentos, formulários e cofre: `.srv-bloco` 3023, `.dcl-dados dt` 3064, `.frm-sec h2` 3134, `.frm-tab th` 3167, `.cof-campo .lb` 3222, `.cof-sem .lb` 3276, `.pn-sec` 3303.
- **Ficam em mono** (estado de sistema, como `.pill` na neuro.css:229): `.pill` 766, `.res-pill` 554, `.ml-st` 2393, `.vs-tipo` 1480, `.badge-pub` 1833, e os contadores `.n`.

**Botões** (747-761, 1762):
- `.btn` de 13.5px passa a 14px.
- `.btn[disabled]` de opacidade .5 passa a .4; acrescentar `.btn.disabled` (neuro.css:143).
- `.btn.perigo` (756) é contorno em `--bad`. A v2 tem `.btn.danger` sólido em `--fn-critical-primary` com `#FFF`, que dá 3,72:1. Manter `.perigo` como contorno Critical com texto `--bad-tx`, ou aceitar `.danger` depois de corrigir a cor do texto.
- `.btn.mini`: na casca 32px, raio 9 e 12px; na v2 34px e padding `0 13px`.
- `.icon-btn` (1619-1630; 44 usos; helper `ibtn()` na linha 3986): 36px, raio 10, borda `line2`.
  - Manter para ações de página.
  - As ações utilitárias (copiar, revelar, baixar) passam ao `.icbtn` da v2 (neuro.css:148-156): 32px, raio 6, véu 5,5%, Névoa, nunca Synapse.
  - `.icon-btn.primary` (1623) só vale como envio de campo único (`.fld .enviar`).

**Campos** (85-93, 786-794):
- `.fld label` (787) hoje: corpo, 700, .08em, `--muted`. Na v2 (neuro.css:176): `--fd` 600, 10.5px, .12em.
- `.fld`: margem 14 → coluna flex com gap 7 e margem 16.
- Faltam `.fld.ok`, `.fld.erro` e `.fld.off`. Hoje só existe `.frm-fld.erro` (3138-3139, borda `rgba(bad,.6)`); a v2 usa borda `--fn-critical-primary` e `.mini` em Critical.
- Checkbox:
  - A casca usa `accent-color:var(--syn-borda)` em 91, 644, 1416, 2198 e 2273, e `.md li.tarefa.feita` (700/2802) preenche em `--syn`.
  - A v2 base usa `--ink` (neuro.css:50), mas `.ck-item` usa Synapse (neuro.css:911), e `PADROES.md:561` diz "controle marcado = `--syn-borda`". Há conflito, e quem decide é a marca.
- Select: a v2 proíbe a lista nativa e define `.sel` + `.lista` (neuro.css:204-218). A casca usa `<select>` nativo em tudo.
  - **Colisão de nome:** a casca já tem `.lista` (2222-2230), usada em `mod-admin.js:223` e `:537`.
- `.pills-ed` (2332) usa `rgba(tom,.05)` e não `--campo`, e fica cinza no claro, contra a regra de `PADROES.md:567`.

**Seleção nunca em Synapse** (passa a 9% de branco, borda `line2`, ink 600):
- `.chip` (1407-1411):
  - hoje: padding `8px 14px`, raio 18, 13px, `.on` em `--syn`;
  - v2 (neuro.css:223-228): `4px 11px`, `--r-chip` 6, 12px 500, fundo 2%, borda `line`, Névoa, altura de uns 26px.
- `.chip.mini` (1642, raio 14) e `.chip.tem` (1846, tinta Synapse).
- `.chip-b.on` (2437), `.cch.tem` (1843), `.mag-dias button.on` (1345).
- `.seg button.on` (1789), `.seg a.on` (2294), `.arq-conf-l .seg button.on` (2131).
- `.tre-previa-abas button.on` (2997).
- `.grp-item.on` (444, tinta syn .08). A v2 (neuro.css:800) usa 9% branco, ink 600.
- `.pkm-op.on` (1886), `.arq-leg.on` (2067), `.cr-lams li.on` (2598), `.st-gp-i.on` (2543).
- `.adm-item.on` (2212), `.lista .item.on` (2226), `button.pub-row.on` (1832), `.fb-voto.on` (1500), `.cr-esc:has(:checked)` (2655), `.tre-op:has(:checked)` (2875).
- `.gr-link.on` (2160): fundo neutro, e a barrinha de 2px fica em `--syn-borda` (é marca curta, permitida).
- **Ficam em Synapse**, porque a v2 permite (CTA, contador de pendência, barra curta, foco):
  - `.btn.solid`, `.agx-fab`, `.lt-pe .bolha`, `.tm-bt .bolha`, `.tile-n`, `.nav1 .n.sua`;
  - `.eyebrow::before`, `.lt-filho[aria-current]::before`, `.abas`, `.board-dots .on`;
  - o hoje do calendário (`.calm-cel.hoje .calm-n` 945, `.agw-dcab.hoje .dn` 1026, `.agx-mini-grade .hoje` 999);
  - `.st-card.vez`.
- **A própria v2 deixa `.et.on` em Synapse** (neuro.css:895). Sinalizar.

**`.seg`** (2288-2294, 2321-2322):
- Hoje: borda `line2`, raio 10, `overflow:hidden`, sem padding, botões 11.5px/600 em `--dim`.
- v2 (neuro.css:466-471): altura 32, padding 2, gap 2, borda `line`, raio 8, fundo 2%, botões raio 6, 12.5px/500 Névoa.
- A casca usa `flex-wrap`, e altura fixa com quebra estoura.
- `.seg button.on-ok` e `.on-bad` (2321) e `.rec-seg .on-ap/.on-du/.on-re` (1795-1797) são chaves de estado. Vão para `.chave` com `st-*` (neuro.css:266-273): tinta de 14% e cor funcional.

**`.nav1`** (2298-2309): já é cópia da v2 (neuro.css:453-463). Muda só `.nav1 .n` e `.abas .n` (2305) de raio 999px para `--r-badge`.

**`.abas`** (1154-1159, 1592-1596):
- `.abas a` (que é o que `navNivel2()` gera, na linha 4002) hoje tem borda inferior de 2px na largura toda, sempre em `--fd` 600, margem 22.
- v2 `.aba` (neuro.css:476-485): `::after` com `left/right:12px`, raio 2; 600 só no `.on`; hover a 3%; raio `9px 9px 0 0`; margem 18; barra de rolagem escondida.
- Restilizar `.abas a` com essa receita sem mexer na marcação: os testes leem `.abas a.on`.

**`.pill`** (766-769, 1612-1616; 59 usos de `p-*` e 98 de `dt-*`):
- Hoje: 10px, .12em, raio 999, ponto redondo de 7px.
- v2 (neuro.css:230-233, 252): 500, 10.5px, .06em, `--r-tag` 5, `flex:none`, Névoa, ponto quadrado de 6px com raio 1, borda a 45%.
- Manter os nomes `.p-ok`/`.dt-ok` e só trocar a receita. `.dt-gray` vira Idle.

**`.tag`** (v2 neuro.css:234: Archivo 600, 10px, .12em, raio 5):
- `.tag-mini` (1275-1279, 2722, 3088) está em mono 9px com raio 4.
- `.pj-sup` 1930, `.evp-op` 1130, `.arq-fita` 2007, `.okr-eixo` 1694 e `.gr-via` 2186 estão em 999px.
- `.arq-cls` 1976 está em mono. É classificação, não estado de sistema; vai para Archivo.

**Sem formato pílula:**
- **Chips para 6px:** `.chip` 1407, `.chip.mini` 1642, `.et` 590, `.pessoa-chip` 612, `.cd-add` 617, `.cch` 1840, `.chip-b` 2433, `.st-rchip` 2468, `.pill-ed` 2341 (8px, vira a receita de `.fb-tag`).
- **Pills e tags para 5px:** `.hd-tag` 174, `.res-pill` 554, `.pill` 766, `.evp-op` 1130, `.okr-eixo` 1694, `.badge-pub` 1833, `.pj-sup` 1930, `.arq-pend` 1971, `.arq-fita` 2007, `.gr-via` 2186, `.adm-item .off` 2217, `.lista .item .off` 2229 (3px), `.ml-st` 2393, `.vs-tipo` 1480 (6px), `.nota-badge` 1783 (8px).
- **Contadores para 4px:** `.lt-pe .bolha` 242, `.tm-bt .bolha` 313, `.tile-n` 406 (todos 9px), `.card .head h3 .n` 885, `.calm-n` 942, `.agx-mini-grade button` 995 e 999, `.arq-npn` 1974, `.nav1 .n` e `.abas .n` 2305, `.st-semdata h3 .n` 2496, `.tre-sec h2 .n` 2704, `.tre-nprob` 2980.

**Estados no conjunto funcional.** As classes da v2 que gostam de medium e a casca liga a cores cheias:
- `.res-pill.bad/.warn` (557-558) → `-tx` (medium), borda a 45%.
- `.kb-flag` (521) → `--warn-tx`.
- `.kb-meta .atrasado` (525) → `--bad-tx`.
- `.cod-pf.colide` (405) → `--warn-tx`.

**Avisos:**
- `.aviso-box` (762-765; 125 usos) contra `.alerta` da v2 (neuro.css:255-262):
  - raio 12 → `--r-md` 14; borda a 35%; fundo a 7%;
  - na v2 o texto é ink/Névoa e só o ícone tem cor; a casca pinta o texto todo com `-tx`.
- `.aviso-box.lima` (1764) e `.tre-caixa.dica` (2823) saem de Synapse para Cortex.
- Seguem a mesma receita: `.tre-faixa` 2750, `.tre-caixa` 2820, `.st-nota` 2520, `.frm-falta` 3149, `.arq-pendente` 2042, `a.pend-i` 3033, `.evx-minha` 3091, `.aviso-vinculo` 3313.

**Tabelas** (1536-1553, 715, 2816, 3167):
- `th`: mono 10.5px, .14em, 500 → v2 Archivo 600, 10px, .12em, `--dim` (neuro.css:569).
- A v2 põe `td:first-child` em 600 (neuro.css:572) e `th.num` em `--fd`. A casca não tem nenhum dos dois.
- Já não há zebra. `.frm-tab th` tem fundo a 3%: é cabeçalho, não zebra.

**Métricas** (1571-1580, 2175-2177, 1766):
- `.metrica .rot` está em mono, .16em → Archivo.
- A v2 tem coluna flex com `space-between`, gap 16, altura 100%, wrapper `.base`, `.val small`, e as setas `↑`/`↓` em `.var::before`.

**Barras.** As barras de comparação viram traços:
- `.barras` e `.barra` (1582-1588), usadas em `mod-gestao.js:125`, `mod-selecao.js:243` e `mod-atividades.js:1667-1668`:
  - hoje: cheia arredondada em `--green2`;
  - v2 (neuro.css:655-663): grid de 3 colunas, `.barra{display:contents}`, trilho e preenchimento em `repeating-linear-gradient` com `--tick` 1.5px, vão de 3x, pontas retas.
- **Conflito:** `.barra.carga` (582-584) define grid próprio de 4 colunas (`150px 1fr 40px auto`) e deixa de funcionar com `display:contents`. Precisa de uma variante `.barras.carga` de 4 colunas.
- `.plc-l .bar` (1242-1243) e `.ini-carga` (1190-1191) estão em Synapse arredondado. Viram traços. O placar vai para Lúmen (`DIRETRIZES.md:72`).
- **Progresso pode continuar como está** (equivale a `.progresso`, neuro.css:716-717): `.ck-barra` 639, `.okr-prog` 1700, `.tre-prog` 2718, `.evx-barra` 3101, `.st-aprov-barra` 2516.
- `.pj-prog .trilho span` (1915) é proporção. Vai para `.prop-bar` com os quatro tons de uma família.
- `.arq-etapa.agora` (2026-2029) tem brilho funcional. A regra do conjunto funcional é "chapado", então o brilho sai.

**Toast** (3321-3325; JS `toast()` na linha 3688, com 494 chamadas):
- Falta o ponto `.dt` e as classes de estado `.ok`/`.erro`/`.aviso`/`.info` (neuro.css:698-703).
- A casca usa a classe `err`; a v2 usa `erro`.
- Duração: 5200 ms na casca, 4,2 s na v2.

**Diálogo:**
- `#veil` (3292): `.66` com blur 8px. A `.veu` da v2 usa `.55` com blur 3px.
- `#modal` (3295-3300; `.largo` 1282, `.imenso` 1285): 520px e raio 18.
- `.dlg` da v2: 420px, `--r-lg` 20, transições de opacidade e escala, ações alinhadas à direita.
- O `.acts` genérico (1412) alinha à esquerda. Usar `#modal .acts{justify-content:flex-end}`.

**Vazio e carregando:**
- `.vazio` (1598-1603) é centralizado. Na v2 (neuro.css:722-727) é alinhado à esquerda, coluna, gap 8, `p` de 13px com largura máxima de 420.
- `.empty` (745; 45 usos), `.kb-vazio` 526, `.pl-vazio` 357 e `.sn-vazio` 396 também são centralizados. A diretriz diz "texto à esquerda".
- `.spin` (771): 18px com borda de 2.5px. Na v2: 22px, 2px, `line2` + Synapse.
- `.carregando` (774) é centralizado com padding de 70px.
- Não existe `.skel` na casca.

**Menu lateral** (129-331):
- `#hd` (145-148): vidro `.84` com blur. Na v2, `.nd-lateral` é `--painel` sólido.
- `.lt-simbolo` (159-160): é um `<img>` do `favicon.png` com anel. Na v2 é uma máscara do ícone quadrado em `--ink`. A v2 manda usar o imagotipo com o menu aberto; a casca usa o nome em texto (comentário em 170-172). Decisão de marca.
- `.hd-tag` (174): mono, Synapse, 999px. Na v2 (neuro.css:336): Archivo 600, 9.5px, .14em, `--dim`, sem borda.
- `.lt-rotulo` e `.lt-divisor` (231, 235): mono → Archivo 600, 9.5px, .14em.
- `.lt-pe .bolha` raio 4. `.lt-nome` gap 6 → 7.
- `.lt-eu .avx` (247) com iniciais teal. Na v2, `.lt-eu .av` (neuro.css:397) tem fundo Cortex e texto ink.
- **Exclusivos da casca e testados (manter e subir para a v2):** a busca no trilho sem caixa (268-270) e `.lt-casa` (165-169). A v2 não tem essa regra da busca (neuro.css:338-346).

**Kanban** (410-659):
- `.kb-selo`, `.kb-col header`, `.kb-top .org`, `.grp-item .tag`, `.cd-bloco>label` e `.sel-grp` → Archivo.
- `.kb-card`: raio 12 → `--r-sm` 11. `.sinalizada` com borda Caution a 32%.
- `.et`, `.pessoa-chip` e `.cd-add` com raio 6.
- O relevo do cartão e o brilho no topo ficam (`PADROES.md:310-322`; neuro.css:837-866).

**Calendário e agenda** (925-1151):
- `.calm-cab span` → Archivo.
- `.calm-n` e `.agx-mini-grade button` com raio 4.
- `.calm-chip` (948): cor padrão `#8E8E93` → `var(--dim)`.
- `.calm-chip.atras` → `color-mix` de Critical a 60%.
- `.calm-cab span.fds` (932) só existe na casca.
- `.agx-*` e `.agw-*` não existem na v2.

**Tiles e galeria:**
- `.tile .sq` (1565-1566) usa tinta Synapse e ícone `--syn-tx`. Na v2 (neuro.css:616-617): `rgba(tom,.055)` e Névoa.
- `a.srv .lb` e `.go` → Archivo. `a.srv.hero` (1394) é Cortex e já está conforme.
- `.cr-card:hover` (2684-2685) tem sombra. Tile não tem sombra (`PADROES.md:312`).

**Login** (776-799):
- `.login` (778-779) tem sombra de elevação; a v2 não usa.
- `.login .lg img` (781, 783) inverte o imagotipo preto por filtro (`LOGO_URL`, linha 3575). A v2 diz "never invert the black one": usar `brand/design-system/marca/imagotipo-branco.webp`.
- `.login .err-msg` (798) e `.err-msg` (1413) → `--bad-tx`.

**Rodapé** (1436-1462, 1514-1521):
- `.ft-grid h4`, `.ft-base` e `a.ft-t .k` → Archivo 600, 10.5px, .12em (`.ft-in` da v2, neuro.css:749-751).
- `a.ft-t>.ic` (1448): teal → `--muted`.
- `.ft-grid img` (1459-1460): filtro de inversão. Mesmo caso do login.

**Quadro de avisos:**
- `.sl-destaque` (834) é igual a `.band`. Fica.
- `.sl-urgente::after` (842-843) é um brilho coral com blur. Pela v2, só Cortex pode brilhar; o brilho sai.
- `.sl-tag` → receita de `.eyebrow`.
- `.board` com raio 22 → `--r-xl` 24.

**Eyebrow** (735-737):
- Hoje: mono 11px, .22em, `--dim`. Na v2: Archivo 600, 11.5px, .14em, `--muted`.
- `.frm-sec h2` (3134) põe o texto em `--syn-tx`. Só o quadradinho pode ser Synapse.

**Outros que estão fora da regra:**
- Celebração não usa Synapse: `.tre-selo` (2895) e `.pres-hero .n` (888) passam a Cortex ou Lúmen.
- Funcional não pode ser gradiente:
  - `.arq-folha.tpl` (2002-2006), que é gradiente com `--info-rgb`;
  - `.logo-pj.pkm` (1855-1868), que é radial com trios funcionais.
- `.cr-ac.livre` (2629) tem um `conic-gradient` com a paleta antiga em literais.
- **Tokens indefinidos:**
  - `--ion` em `.tl-item .tp a` (1662). Hoje o link herda a cor do pai.
  - `--painel-dot` (1659).
  - `--soft` em `mod-gestao.js:1061`.
- **Regras duplicadas:**
  - `.check` em 1414 e de novo em 1636;
  - `.pj-resumo` em 1935, sobrescrita em 2201;
  - `.seg .on` em 1789 e 2294.
- **Cores literais no JS da casca:** `STATUS_SOL` (3650-3655), `REDES` (4325-4330), pilares do Studio (4342-4347), camadas da agenda (6496-6502).

---

### 4. Riscos nos testes

**`testes/menu-lateral.mjs`:**
- **356-357 e 425:** o fundo escuro precisa ser `rgb(5, 8, 7)`. Não muda.
- **362-364:** o fundo claro precisa ser `rgb(242, 245, 241)` e a meta `#F2F5F1`.
  - Quebra se o `--bg` claro virar `#E8EDEB`.
  - Mudar junto `index.html:5305`, onde o JS grava a meta `theme-color`.
- **370-389:** 4,5:1 ou mais no claro para 13 amostras:
  - `main h1`, `.topo-gestao .lead`, `.topo-gestao .eyebrow`, `#lt-nav .lt-item .lt-rot`;
  - `.arq-tab .cod`, `.arq-tab .sub`, `.arq-tab .arq-quem`, `.arq-cls.controlado` (`--warn`);
  - `.pill.p-ok` (`--ok`), `.nav1 a:not(.on)`, `.hd-tag`, `.arq-leg .fr`, `.fld label`.
  - Riscos:
    - qualquer funcional do claro em tom primary (1,2 a 3,4:1);
    - a folga do `--dim` (4,61:1 sobre `#E8EDEB`);
    - a troca de cor do `.hd-tag` e do `.eyebrow`.
  - O teste compõe só `backgroundColor` dos ancestrais e ignora gradiente e `backdrop`.
- **392-406:** a ilha dentro de `.sl-destaque`.
  - O teste coleta todos os custom properties da regra cujo `selectorText` é exatamente `:root[data-tema="claro"]`. Trocar o seletor ou dividir o bloco em duas regras faz o teste não achar os tokens.
  - Compara como texto o valor de cada um dentro da ilha com o do `:root`. A grafia precisa ser idêntica.
  - Exige `n > 40`. Hoje são 43 tokens mais `--line` e `--line2`, dando 45.
    - Tirar os quatro `-tx` mortos deixa 41.
    - Tirar também `--glass` deixa 40, e o teste quebra.
  - Exige `ilha.cor === 'rgb(245, 245, 247)'`. Com `--ink` em `#E8EDEB`, isso quebra e passa a ser `rgb(232, 237, 235)`.
  - Todo token de tema novo (`--ok-tx`, por exemplo) entra em três lugares: `:root`, bloco claro e ilha (821-833).
- **408-415:** exige o filtro `brightness(0) invert(0.0x)` nas logos no claro. Quebra se a casca adotar os arquivos branco e preto sem filtro, como a v2 manda.
- **194-205:** geometria do trilho:
  - item com `left` 10 e largura até 48, ícone em x=34;
  - busca com borda e fundo transparentes, legenda e `kbd` com opacidade 0;
  - `.lt-casa` com `display:none`.
  - Copiar o menu da v2 literalmente quebra esse trecho.

**Outros testes:**
- **`ajustes-de-tela.mjs:28`:** `#grp-pop` precisa ter fundo opaco. Colar `var(--painel)` da neuro.css sem definir o token dá fundo transparente, que é exatamente a regressão que esse teste vigia.
- **`quadro-e-acesso.mjs:52-73`:** só imprime, não asserta. Mostra sombra e brilho do `.kb-card` e as camadas de sombra do `.mov`. Muda se alguém aplicar "sem sombra" ao cartão.
- **`versoes-fotos-e-cartoes.mjs:273-274`:** confere que cada etiqueta tem um `--et` não vazio e diferente dos outros. Se `--teal` for removido, o valor `var(--teal)` continua passando no teste, mas renderiza transparente sem ninguém notar.
- **Seletores de classe que precisam continuar existindo na marcação:**
  - `.cal-barra .seg button.on` (`agenda-e-inicio.mjs:63`);
  - `.nav1 a.on` (`arquivos-e-projetos.mjs:92`);
  - `#mp-modo button.on` (`emails.mjs:166`);
  - `#sel-corpo .abas a.on` (`okrs-e-selecao.mjs:245`);
  - `.pill` (`arquivos-e-projetos.mjs:58`, `cofre.mjs:87-88` e 143, `grupos-arvore.mjs:83`);
  - `.pill-ed` (`origem-e-pills.mjs:57-78`), `.slot-chip` (`ps-entrevistas.mjs:93`), `.tile` e `.toast` (`ajustes-de-tela.mjs:48` e 67).
- **Testes de layout:** `.ini-semana` com 1 coluna no celular (`agenda-e-inicio.mjs:257`), as 5 colunas do kanban sem rolagem lateral (`quadro-e-acesso.mjs:40-46` e 123), alturas dos nós de OKR (`versoes-fotos-e-cartoes.mjs:239`).
  - 14 dos 23 testes abortam `fonts.googleapis.com` (por exemplo, `menu-lateral.mjs:34`). Rodam com a fonte de reserva, então **nenhum teste pega regressão de fonte**: truncamento, quebra de linha ou estouro em 390px.
- **Dados de teste:** `stub-supabase.js:689-709` e `1829-1854` trazem cores da paleta antiga (`#2DD4BF`, `#4ADE97`, `#F5C36A`, `#A78BFA`).

---

### 5. Estratégia de migração recomendada

**0. Primeiro na marca.** O `PADROES.md:537` diz que mexer na casca sem mexer na marca é dívida. Levar para a v2:
- um bloco ou card de tema claro com os valores escolhidos;
- a regra da busca no trilho e a `.lt-casa`;
- as inconsistências da própria v2:
  - checkbox em ink (base) contra Synapse (`.ck-item`);
  - `.pill` em primary como texto, contra "nunca texto";
  - `.et.on` em Synapse;
  - `.btn.danger` a 3,72:1;
  - `--line` com o literal `245,245,247`;
  - a regra global `.claro` (neuro.css:754), que vaza borda e padding para `.btn.claro`.

**1. Só tokens, sem mexer em componente:**
- Acrescentar ao `:root` as constantes da v2: famílias, raios, movimento e escala. Elas não entram no bloco claro nem na ilha.
- Trocar os valores dos tokens da casca conforme o item 1. No escuro, a mudança visível é `--ink` e o conjunto funcional; o claro segue a proposta.
- Atualizar a ilha (821-833) com a mesma grafia do `:root` e acrescentar `--ok-tx` nos três lugares.
- Ajustar `menu-lateral.mjs:406` (`rgb(232, 237, 235)`) e, se o fundo claro mudar, as linhas 363-364 e `index.html:5305`.
- Rodar `menu-lateral.mjs`.

**2. Fontes:**
- Link da linha 22 e `--f` da linha 56.
- `font-family:var(--fd)` em `.fld label`.
- Corpo continua em 14.5px nesta etapa.

**3. Rótulos e datas:**
- Mono em caixa alta vira Archivo 600 (lista do item 3).
- Datas e subtítulos em mono vão para `--f`.

**4. Formas:** trocar 999px e raios grandes por `--r-chip`, `--r-tag` e `--r-badge`.

**5. Seleção quieta:** todos os `.on` e `.tem` em Synapse da lista do item 3 passam a 9% neutro.

**6. Componentes para a receita da v2:**
- `.seg` (geometria e `.chave` para estados), `.abas a` com a receita de `.aba`, `.pill` e `.tag`.
- `.eyebrow`, `th`, `.metrica`.
- `.barras` em traços, com a variante `.barras.carga` de 4 colunas.
- Toast (ponto, `erro`, 4,2 s), `#modal`/`#veil`, `.vazio` e `.empty` à esquerda, `.spin`, `.aviso-box` aproximando `.alerta`, `.tile .sq` neutro.
- Logos do login e do rodapé, junto com o teste.

**7. Limpeza:**
- Brilhos funcionais, placar em Lúmen, `.tre-selo`, teal decorativo.
- Tokens indefinidos: `--ion`, `--painel-dot`, `--soft`.
- Cores literais no JS e no stub.

**O que fica igual:**
- **Nomes de token**, porque os módulos dependem deles: `--syn`, `--syn-tx`, `--syn-borda`, `--foco`, `--tom`, os `--*-rgb`, os `--*-tx`, `--sombra-k`, `--veu-k`, `--campo`, `--deep`, `--green`, `--panel`, `--muted`, `--dim`.
  - Exemplos: `mod-atividades.js:51` e `:67`; 11 módulos têm `style` inline com cor.
- **Ids:** `#hd`, `#topo-m`, `#lt-veu`, `#modal`, `#veil`, `#toast`, `#paleta`.
- **Classes usadas por módulos e testes:** `.pill.p-*`/`.dt-*`, `.seg button.on`, `.nav1 a.on`, `.abas a.on`, `.chip.on`, `.aviso-box.*`, `.empty`, `.icon-btn`, `.lista`.
- **O relevo do `.kb-card`.**
- **A ilha `.sl-destaque`.**
- **Os valores escuros já conformes:** `--bg`, `--panel`, `--muted`, `--dim`, `--syn`, `--deep`, `--green`.

**Não colar a neuro.css inteira.** Ela traz regras globais que quebram a casca:
- `main{padding:130px 26px 90px}` (linha 59);
- `section{margin:0 0 var(--sec)}` (60), que atingiria 44 `<section>`;
- `.lead` (101), com 25 usos;
- `.lista` (210), que colide com a da casca;
- `.claro` (754), `.nota` (104), `.container`, `.row`.

Traduzir cada regra para os nomes da casca:
- `--painel` → `--panel`; `--nevoa` → `--muted`; `--grafite` → `--dim`; `--cortex` → `--deep`.
- `--synapse` → `--syn`, `--syn-tx` ou `--syn-borda`, conforme o papel.
- `--fn-*-primary` → `--ok`, `--bad` etc.
- `rgba(255,255,255,x)` → `rgba(var(--tom),x)`; `rgba(206,220,0,x)` → `rgba(var(--syn-rgb),x)`.

Literal de cor num componente quebra o tema claro (`PADROES.md:553`).



---

## Anexo G2: mapa de estilo dos módulos, páginas avulsas e PDFs

### Inventário de estilo nos módulos do SOMA para o design system v2

Só leitura, nenhum arquivo editado. Regras usadas: `/home/claude/brand/design-system/DIRETRIZES.md` (citado como DIR:linha), `neuro.css` e `formal.css`.

### 0. Leitura rápida

**Quem tem CSS próprio.** Nenhum `mod-*.js` injeta `<style>`. Todo o visual dos módulos vem das classes da casca (`.pill`, `.chip`, `.mono`, `.cod`, `.eyebrow`, `.adm-grupo`, `.tabela`, `.dl dt`, `.kb-*`, `.evp-*` etc.), de cerca de 870 `style="..."` inline e de tabelas JS de cores. Os inline são quase todos de layout (margem, justify, gap) e não mudam com a v2. Só cinco arquivos têm CSS próprio: `quiosque.html`, `rsvp.html`, `tour.html`, `admin.html` e `auth/index.html`.

**(a) Muda sozinho se a casca trocar tokens e classes.**
- Toda referência inline a `var(--ok|bad|warn|info|teal|green|green2|dim|muted|ink|line|line2|campo|fm|fd|*-tx|*-rgb)`.
- Toda classe da casca. Por exemplo, Plex Mono em rótulo, raio 999px e Synapse em seleção (`.calm-n`, `.eyebrow`, `.pill`) se corrigem na casca: `index.html:735`, `766` e `942`.
- Os tokens antigos que precisam ser remapeados estão em `index.html:36-41`: `--ok:#4ADE97`, `--warn:#F5C36A`, `--bad:#F1806F`, `--info:#7FA7F2`, `--teal:#2DD4BF`, `--green2:#0B7D6E`, `--ink:#F5F5F7`.

**Ressalvas a (a).**
1. As tabelas JS de cor da casca não são tokens e exigem edição, embora morem na casca:
   - `STATUS_SOL` (`index.html:3649-3656`, hex antigos), usada em `mod-admin.js:375,402` e `mod-atividades.js:813`;
   - `STUDIO_REDES` (`index.html:4322-4331`, cores de marca das redes), usada em `mod-studio.js:412,434` e `mod-criador.js:1210`;
   - `STUDIO_PILARES` (`index.html:4341-4348`, `#7FA7F2 #A78BFA #2DD4BF #F5C36A #CEDC00 #4ADE97`), usada em `mod-criador.js:2282-2291`.
2. A v2 diz que o primary funcional é linha e indicador, nunca texto (tokens.css:59-60). Por isso, os módulos que usam cor funcional como texto precisam passar a `*-tx`, mesmo com o token trocado:
   - `mod-arquivos.js:235`;
   - `mod-atividades.js:668`, `936`;
   - `mod-gestao.js:1008`;
   - `mod-studio.js:907`.
3. A casca não tem select próprio, e a v2 proíbe a lista nativa (DIR:66). São 121 `<select>` nativos nos módulos: admin 13, agenda 15, arquivos 14, atividades 12, seleção 10, gestão 9, studio 8, criador 6, projetos 5, versões 5, cofre 4, e os demais com 1 a 3. Isso só é (a) se a casca ganhar um realce global de `<select>`; senão, é edição módulo a módulo.
4. A casca não carrega Instrument Sans (`index.html:22` traz só Archivo e Plex Mono), e `--f` é fonte de sistema (`index.html:56`).

**Falsos positivos descartados** (seletores `$('#aed-…')`, `#dec-…`, `#dcc-…` lidos como hex): `mod-arquivos.js:1020-1021`, `mod-atividades.js:881-906`, `mod-documentos.js:638-641`.

---

### 1. Módulos

### mod-admin.js
- **(a)** 12 refs a tokens (dim 5, ink 3, muted 2, ok 1, fm 1), por exemplo 415, 470, 1550, 1589.
- **(b)** 5 pontos:
  - 375: fallback `'#8E8E93'`;
  - 402: ponto de status pintado com `STATUS_SOL[].c` (tabela da casca);
  - 469: data `fmtD(o.dia)` em `class="mono"` (DIR:48: mono nunca para datas);
  - 986 e 1719: botão com altura inline de 34 e 30px em vez de `.btn.mini`.
- **Dado do banco:** 1253, `gr-dot` com `g.cor`.
- **Glifos fora da lista** (DIR:52): ✔ 778/796/811/824, ⚠ 798/812/825/826, ✖ 832, ↗ 1045, ∅ 1301.

### mod-agenda.js
- **(a)** Nenhum token inline; tudo vem das classes `evp-*`/`agw-*` da casca.
- **(b)**
  - 44: `AG_CORES` com 8 cores: `#2DD4BF #CEDC00 #4ADE97 #7FA7F2 #A78BFA #F5C36A #F1806F #8E8E93`. Há Synapse como cor de categoria e tons antigos; na v2 seriam os primary das famílias secundárias.
  - 707 e 1057: default `'#2DD4BF'`.
  - O default também está no banco: `db/v28_agenda.sql:109` (`cor text not null default '#2DD4BF'`). Mudar exige migração, e as linhas já gravadas ficam com hex antigo. `quiosque.html:308` também lê `e.cor`.
- **Glifos:** ✕ 49, ● 877, ⌘ 1084.

### mod-arquivos.js
- **(a)** 13 refs (fm 6, ink 4, syn-tx 2, warn 1). Plex Mono em código está correto: 742, 1048, 1231, 1320, 1345.
- **(b)**
  - 199 e 1346: código em `color:var(--syn-tx)`. Synapse como cor de texto de código não está entre os usos da v2 (DIR:64). A casca repete o padrão em `.cod`/`.arq-lista .cod`.
  - 235: `--warn` como texto.
  - 1169: `-·` como marcador de revisão.

### mod-atividades.js
- **(a)** 30 refs. `PRIORIDADES` 50-53 e 396 são indicadores e passam sozinhos.
- **(b)**
  - 67: `ETIQUETA_CORES` mistura funcional, Synapse (`--syn-borda`), `--roxo-rgb` e `--cinza-rgb` como cor de categoria. Na v2, categoria é família secundária, e funcional nunca é identidade (DIR:31).
  - 668 e 936: funcional como texto.
  - Campos com estilo inline duplicado, raio 10 e 8px (v2: 11px; o `input` da casca já veste):
    - 1010;
    - 1027-1028;
    - 1334;
    - 1447-1448.

### mod-cofre.js
- Nenhuma cor. **(b)** Só 727, glifo `·` no estado vazio. Os `•` de máscara de senha (166 etc.) são funcionais.

### mod-documentos.js
- **(a)** 354 usa `--bad-tx`.
- **(b)** 272: glifo `·` no vazio. Os `•` da máscara de CPF (174) ficam.

### mod-formularios.js
- **(b)**
  - 351: `font:14px system-ui` na janela "Gerando o PDF…".
  - 492: `-·` no código.
  - Glifo ↑ em 223.

### mod-gestao.js
- **(a)** 499 (`--fd`), 501 (REG em `.mono`, é código), 780.
- **(b)**
  - 1061: `background:var(--soft)` usa um token que não existe na casca, e `color:var(--green)` põe Axon em ícone sobre escuro (o erro de "verde em texto" do PADROES §8).
  - 1008: ⚑ e `--bad` como texto.
  - 705: botão inline de 30px.

### mod-mailer.js (e-mail HTML: peça de marca, não interface)
- **(b)**
  - `THEMES_MAILER` 45-53: 9 temas, cerca de 63 hex fora da paleta v2 (ciano `#0F7C8A`, bronze `#8A6D1F`, anil `#3B4D9A`, lima `#5C7A00`, `#EDF2C8`). Na v2 seriam Ion, Retina, Lúmen etc.
  - 50 (tema `leadership`): `logo:'#CEDC00'`, ou seja, imagotipo em Synapse, que DIR:38 proíbe; também tem `onBand:'#F5F5F7'`.
  - `construirMailerHTML` 83-143:
    - fonte de sistema em 128 (o template da marca, `brand/templates/email/Comunicado.html`, usa Instrument Sans e Archivo);
    - cinzas literais `#2A2A2E #B5B5BA #9A9AA0 #EFEFF1 #7A7A80 #D9D9DE` em 83, 117, 119, 124, 126, 142, 143 (passariam a Sulco/Pia: `#2E3533 #616C68 #E8EDEB`);
    - título em peso 300 (134) e h1 em 400 (137), quando a v2 pede Archivo 500-700.
  - 486 e 789: datas em `.mono`.
  - 615: o chip `.ml-rem` pinta a interface com as cores do tema do e-mail.
- **(a)** `*-tx` em 491, 643, 791.

### mod-okrs.js
- **(b)**
  - 32-33: `OKR_EIXOS_CORES` com 6 hex fora da paleta (`#4C6FBF #7C5CBF #00594F #B7791F #C05B3B #3D8B8B`).
  - 42: fallback `#8E8E93`.

### mod-presenca.js
- Só (a): 21-23 são indicadores (`--cc` em 62).
- O PDF sai por `DocNRO.folhaCheckin` (171).

### mod-projetos.js
- **(a)** 81-82: barra de proporção ok/warn/dim. Decidir: a v2 pede os quatro tons de uma família (DIR:68).
- 209: mono em código, correto.
- **(b)** Glifo ◇ em 128.

### mod-relatorios.js
- Interface só com layout (a). PDFs na seção 3.

### mod-selecao.js
- **(a)** 87, 479 (`--line`), 435 (`--fd`).
- **(b)**
  - 1204: `class="pill mono" style="letter-spacing:.16em"` com o texto "— sem código —" em mono.
  - ★ em 317, 478, 585.
  - ↗ em 426, 1229, 1230.
  - `·` em frase de interface: 392 e 1222.

### mod-studio.js
- **(a)** 41: `ST_COR_STATUS`, todo em tokens.
- **(b)**
  - 41: o estado `pronta` usa `var(--syn-borda)`, ou seja, estado em Synapse; a v2 pede conjunto funcional.
  - 434: pontos com as cores de `STUDIO_REDES`.
  - 907: `--bad` como texto.
  - Glifos ✦ 299, ▣ 957, ↗ 965.

### mod-treinamentos.js
- **Interface (a):** 1011 (input de código em mono, correto); 1707 (miniatura com raio 8px).
- O certificado está na seção 3.

### mod-versoes.js
- Nada fora de layout.

### mod-criador.js e doc-nro.js
- Ver seção 3.

---

### 2. Páginas avulsas (nada muda pela casca)

### quiosque.html
Tudo (b): CSS próprio de 12 a 144, e nada da casca nem da v2.
- **Tokens e fontes:**
  - tokens próprios 13-19 (`--deepwave`, `--crystal:#F8F7FF`);
  - fontes Space Grotesk, Inter e JetBrains Mono em 11, 23, 40, 57, 63, 73, 82, 86, 100, 110, 116, 119, 140;
  - rótulos em caixa alta em Inter (41, 43, 52, 74, 141), quando a v2 pede Archivo 600.
- **Forma e sombra:**
  - raio 26px em 51;
  - `.tag-live` com raio 12px (pílula) e fundo Synapse (90-92);
  - ponto `.pulse` redondo (44);
  - sombras em 98 e 139.
- **Cores fora da paleta:** `#FBBF24` 105, `#7DD3FC` 126, `#FDA4AF` 127, `#FB7185` 294, `#94A3B8` 308, `#00251f` 275.
- **Regras de widget e quiosque (DIR:72) violadas:**
  - as boas-vindas usam anel e brilho Synapse (138-139); a v2 manda brilhar em Axon/Cortex, nunca Synapse;
  - o contador de presença está em Synapse (110); na v2, o placar é Lúmen;
  - o fundo é um gradiente próprio (24-28); a v2 pede grade Cortex, blob Axon e um segundo blob conforme a hora do dia (Lúmen, Synapse 5%, Ritmo, Retina);
  - o arco solar é fixo em Synapse (453-456).
- **`·` em interface:** 6, 153, 166, 167, 312, 354.

### rsvp.html
- **Tokens:** cópia própria em 20-28: `--ok/--bad/--warn` antigos (23), `--ink:#F5F5F7` (21), `--line` a .1 e `--line2` a .18 (22; a v2 usa .08/.16). Isso só é (a) se essa cópia for atualizada junto.
- **(b)**
  - `.olho` (37) e `dt` (43) em Plex Mono caixa alta: rótulo em mono;
  - `.bts button.on` (50): escolha Vou/Talvez/Não vou preenchida em Synapse (DIR:64 proíbe Synapse em seleção);
  - `.msg.ok/.err` (53): funcional como texto;
  - sem Instrument Sans (11, 26);
  - título com `·` (6).

### tour.html
- **Tokens:** cópia da casca em 23-54; (a) se for sincronizada. São 424 usos de token.
- **(b) rótulos em mono (15 regras):** 130 `.hd-tag`, 196 `.eyebrow`, 211 `.sub-h`, 242 `.tile .ir`, 250 `.vivo-tag`, 305 `.dl dt`, 318 `.fld label`, 379 `.mm-div`, 409 `.kb-col .h`, 453, 487, 503, 514, 604, 651.
- **(b) pílulas de 999px na interface:** 131, 251, 281 (`.pill`), 286 (`.chip`), 517. Em 522 e 567 são simulações de aparelho (pode ficar).
- **(b) Synapse em seleção:** 176, 492, 518, 537.
- **(b) marcadores numerados redondos em Synapse:** 171/176, 393, 403, 431 (a v2 pede contador com raio de 4px).
- **(b) gradientes e fundos fora do conjunto primário:**
  - 201: gradiente com `#7BE8C4`; no claro, 203 usa `#0A776B`;
  - 89: blob em `#0B7D6E`.
- **(b) simulações com cores literais**, que precisam espelhar as peças novas:
  - `.mk-email` 352-362 (cinzas Tailwind);
  - `.mk-quiosque` 451-460;
  - `.mk-fone` 463-473 (`#4ADE97` em 469);
  - `.mk-cert` 502-505;
  - `.cr-arte` 520-527;
  - simulações de iOS/Android 552-575 (`#7FA7F2` em 554);
  - amostras de tema e acento do criador 1847-1850 (hex antigos).
- **Contagem:** 34 hex antigos e 137 cores literais no total.

### admin.html (redireciona em 2,2 s)
- 14: tokens próprios com `#F5F5F7`.
- 20-21: `.tag` em Plex Mono caixa alta, raio 999px, texto Synapse.
- 17: fonte de sistema.
- Prioridade baixa.

### auth/index.html
Página pública clara, de propósito "estilo portal de governo" (comentário 41). Decidir se vai para a interface (`neuro.css`, escura) ou para o registro formal (`formal.css`). Hoje é (b) inteiro:
- tokens próprios 25-33, com Arial e Courier New;
- status em cores próprias (28-30);
- rótulos em caixa alta em negrito (50, 63, 81, 92);
- `text-align:justify` em 94 (a v2 nunca justifica, DIR:49);
- raio 0 em campos e botões (68, 72);
- códigos em Courier (85);
- `·` em 6, 120, 173-174, 296;
- ✕ em 274, 285, 289, 306 (o glifo permitido é ×).
- A página também carrega `doc-nro.js` e herda o que mudar nele.

---

### 3. Canvas e PDF: o que vale diferente

**Quem desenha documento ou peça:**
- `mod-criador.js`: canvas, exporta PNG, JPG, ZIP e PDF via jsPDF (2069, 2128-2139). São as artes do Studio, domínio "Documents/brand pieces".
- `mod-treinamentos.js`: certificado em canvas, depois PDF (2187-2290).
- `doc-nro.js`: PDF vetorial jsPDF. É usado por `mod-documentos.js:81`, `mod-formularios.js:344/355/411/496`, `mod-cofre.js:703`, `mod-presenca.js:171` e `auth/index.html`.
- `mod-relatorios.js`: jsPDF com autotable (115-210, 313-377, 541-548).
- `mod-mailer.js` não é canvas, mas é peça de marca (e-mail).

Nesses arquivos não valem as regras de interface: não há tema, nem `--syn-tx`, nem conjunto funcional. Valem as regras de documento. Mas três regras valem nos dois domínios e são violadas:
- Plex Mono só para códigos e dados (DIR:48);
- sem emoji (DIR:52);
- nunca justificar (DIR:49).

**Conflito a decidir.** O PADROES §9 (`PADROES.md:597-601`) permite ponto médio na tipografia dos PDFs e nas artes do Studio. A v2 proíbe ponto médio como separador nos dois domínios (DIR:51 está em "Content fundamentals (both domains)"). Pontos afetados:
- `mod-criador.js`: 841, 902, 1104, mais textos-modelo em 1364-1441 e 1680-1681;
- `mod-treinamentos.js`: 2225 e 2250-2251;
- `doc-nro.js`: 592, 602, 604, 660, 853, 880, 921, e o `creator:'SOMA · NeuroDynamics'` em 646, 707, 776, 867, 898.

### mod-criador.js (tudo b)
- **Tabelas de cor:**
  - `CR_TEMAS` 57-66 e `CR_ACENTOS` 69-77 usam a paleta antiga, inclusive nomes antigos (soma, ion, plasma, dendrito, mielina, aura) e acentos que são cores funcionais antigas (`vital #4ADE97`, `mielina #F5C36A`, `pulso #F1806F`, `plasma #7FA7F2`). A v2 proíbe o funcional em peça de marca (DIR:31). Remapear para famílias v2 com `light/medium/primary/dark`.
  - Tema `synapse` (63): Synapse como fundo inteiro; a v2 o quer só como destaque (DIR:28).
  - Halos e gradientes dos temas ion, plasma, dendrito, soma e mielina usam cores fora do conjunto primário (DIR:28). Validar contra `templates/social` e o tratamento de banda de família (DIR:30).
- **Marca em Synapse:** em 997, `crTile(…,'#CEDC00')` pinta o ícone da NRO em Synapse, o que DIR:38-39 proíbe.
- **Cores literais:** 47 hex antigos, sendo `#F5F5F7` 24 vezes, e 107 literais no total (`#0B7D6E` em 496, 954, 1102; `rgba(245,245,247,…)` em 354, 530, 601, 1245, 1251).
- **Mono em rótulo e data:**
  - `crMono` (179) aparece em 24 chamadas.
  - O olho é `crOlho` (279-282, 12 usos), descrito no próprio código como "rótulo curto em mono, caixa alta".
  - Cargo em 785/798, subtítulo em 813/972, data em 842/901-902, selo em 1072/1165, nome da revista em 1102, rede em 1210, cargo da barra de nome em 1234.
  - Dado legítimo: só o contador "01 / 05" (566-569).
- **Texto corrido:** em Archivo 500 (`crApoioOp` 643, `crFonte` 178); a v2 pede Instrument Sans, que não é carregada em `crFontes` 1811-1812.
- **Forma e sombra:**
  - pílulas (raio igual a metade da altura) em 846, 915, 1132;
  - sombras em 1097 e 1257;
  - filtros de foto (pb, duotone, véu verde `#0B7D6E`) em 489-497.
- **Emoji nas legendas** (texto que vai para a rede social, não para a arte): 1365-1434.
- **Prévia e interface do editor:**
  - guias de prévia (só aparecem no editor) com o vermelho e o azul antigos: 614, 615, 620, 624;
  - interface do editor: amostras 2017 e 2020-2021 (fallback `#888`), pilares 2282-2291 via `STUDIO_PILARES`.

### mod-treinamentos.js, certificado (b)
- **Mono em rótulo:** "CERTIFICADO · NEURODYNAMICS · UFMG" (2224-2225), "CERTIFICADO DE CONCLUSÃO" (2236-2237), a linha de metadados (2252) e "CONCLUÍDO EM" / "CÓDIGO DO CERTIFICADO" (2261-2262). O código em mono (2270) está correto.
- **Cores:**
  - brilho com o teal antigo `rgba(45,212,191,.55)` em 2216, fora do conjunto primário;
  - `rgba(245,245,247,.78)` em 2224;
  - cinzas `#45625B #66726D #0F1714` (2236-2271), que passariam a `--formal-ink #1D1D1F`, `--formal-ink-2 #2E3533` e `--formal-ink-3 #616C68`.
- **Fontes:** Archivo 500 no texto corrido (2193).
- **Desenho:** fundo branco, halo Synapse (2199-2201) e faixa em gradiente de 66mm (2207-2209). O template `certificate-brand` pede fundo claro da família e faixa chapada no tom escuro da família. O rótulo no corpo deveria ser substituído pelo tipo do documento no cabeçalho, e a cidade e a data deveriam seguir o parágrafo (DIR:56, DIR:103).
- O símbolo em moldura redonda (2218-2222) é permitido.

### doc-nro.js (b)
- **Fonte:** Helvetica (106, 201), por limitação Windows-1252 (27-29). Trocar exige embutir TTF de Archivo e Instrument Serif no jsPDF.
- **Paleta** (44-46):
  - `TINTA [29,29,31]` já é `#1D1D1F`, igual a `--formal-ink`;
  - `CINZA [96,96,99]` deveria ser `#616C68`;
  - `LINHA [150,150,155]` deveria ser Pia medium `#C4CCC9`;
  - `FUNDO [217,217,217]` como fundo de cabeçalho de tabela e `FUNDO_CLARO` como zebra (432): o DataTable formal não tem fundo nem zebra, só fios.
- **Texto:** justificado por padrão (280: `alinhar = o.alinhar || 'justify'`), o que a v2 proíbe.
- **Margens:** `PAG esq:15 dir:12.5` (42), contra 22mm na v2.
- **Cabeçalho** (226-246): departamento em negrito, título e código. A v2 pede o tipo do documento em caixa de frase e o código logo abaixo, na mesma fonte e corpo (DIR:55, `formal.css .timbre .controle`).
- **Outros:**
  - código em Courier negrito (601); o formal pede Archivo 400/500 e nunca mono;
  - aviso em caixa alta com `·` (592);
  - logo vinda de `raw.githubusercontent.com/matheusmarcondes1/nro` (38), e não dos `assets/` da marca;
  - `roundedRect` com raio 4 na moldura do QR (911).

### mod-relatorios.js, PDFs (b)
- `pdfCabecalho` 125-159: "Departamento de Pessoal" fixo (142) e código padrão `'SOMA 5.0'` (145).
- Títulos em caixa alta: 220, 313, 371, 541.
- Autotable:
  - zebra em `theme:'striped'` com `alternateRowStyles [246,246,248]` (207, 210, 544);
  - cabeçalho preto `[29,29,31]` com texto `[245,245,247]` (209, 318, 377, 548);
  - linhas `[210,210,215]` (317, 376), que deveriam ser Pia medium.
- Helvetica em tudo; rodapé em `[110,110,115]` (164).

---

### 4. Contagem de (b) por arquivo

Itens que exigem edição, sem contar os `<select>` nativos.

| Arquivo | Itens (b) |
|---|---|
| mod-criador | cerca de 154 cores literais, 24 mono, 3 pílulas, 2 sombras, 2 tabelas de paleta |
| tour.html | cerca de 171 literais, 15 regras de rótulo em mono, 5 pílulas, 4 Synapse em seleção |
| mod-mailer | cerca de 71 literais, 2 datas em mono |
| quiosque.html | 35 literais, 3 famílias de fonte fora da marca, mais as regras de widget |
| auth/index.html | 28 literais, decisão de registro |
| doc-nro | cerca de 10 pontos estruturais |
| mod-treinamentos | 32 literais no certificado, 5 mono em rótulo |
| mod-relatorios | cerca de 12 pontos de estilo de PDF |
| rsvp.html | 17 literais, 2 rótulos em mono, 1 Synapse em seleção |
| mod-agenda | 1 paleta de 8 cores, 2 defaults, 1 migração |
| mod-okrs | 7 hex |
| mod-atividades | 1 paleta, 2 textos funcionais, 4 campos inline |
| mod-arquivos | 3 pontos |
| mod-gestao | 3 pontos (um token inexistente) |
| mod-admin | 5 pontos |
| mod-selecao | 2 pontos de estilo, mais glifos e `·` |
| mod-studio | 2 pontos de estilo, mais glifos |
| admin.html | 3 pontos |
| mod-projetos, mod-formularios, mod-documentos, mod-cofre | só glifos ou `·` |
| mod-presenca, mod-versoes, mod-relatorios (interface) | só (a) |



---

## Anexo H: mapa do Studio e do repositório brand

**Portal do Studio e site brand: inventário para o módulo "Marca" e para o site multipágina**

Fiz só leitura, sem editar nada. No brand, o checkout está em `claude/manual-abas` e tem o mesmo conteúdo de `origin/main` (merge do PR #11, 50b8ac8). O `main` local está desatualizado (f737510). Pela API, o repositório é público, o Pages está ativo e o branch padrão é `main`.

---

### (A) Portal: Studio

### A1. O que o criador já gera (mod-criador.js)

- **Peça.** É formada por modelo, tamanho, estilo e lâminas. É gravada em `studio_publicacoes.peca`, e as artes vão para o bucket `studio` do Storage (`crSalvar`, 2207).
- **Modelos.** São 23, em `CR_MODELOS` (1361-1446): na_midia, projeto, aniversario, parabens, boas_vindas, conquista, evento, aviso, frase, dado, bastidores, dicas, vaga, artigo, agradecimento, data, depoimento, enquete, thumbnail, encerramento, barra_nome, cartela e livre.
  - Os nomes e pilares ficam em `STUDIO_TIPOS` (index.html:4350).
  - A galeria em `#/studio/modelos` usa `crPaginaModelos` (2276) e `CR_GRUPOS_MODELOS` (2269).
  - Cada modelo traz uma `legenda` sugerida.
- **Leiautes.** São 17, em `CR_LAYOUTS` (1299-1349): capa, texto, lista, numero, citacao, pessoa, evento, midia, parceiro, cta, foto, artigo, enquete, thumb, encerramento, barra (PNG transparente) e cartela.
- **Tamanhos.** São 9, em `CR_TAMANHOS` (37-47): feed 1080×1350, quadrado, stories, reels, documento (PDF), paisagem 1200×628, thumb 1280×720, video e video_v.
- **Opções de estilo** (`CR_ESTILO_PADRAO`, 85):
  - temas: `CR_TEMAS` (56-67), 10 temas: void, cortex, soma, ion, plasma, dendrito, synapse, aura, papel, mielina;
  - acentos: `CR_ACENTOS` (68-78), 9 acentos (synapse, ion, vital, mielina, pulso, plasma, dendrito, cortex, ink), mais `acentoLivre` com qualquer hex;
  - decoração (rede, ondas, formas, confete), grade, marcas de corte;
  - destaque `*palavra*` (cor, marca-texto, sublinhado);
  - filtros de foto (`duotone`, `verde`) e estilos da barra de nome.
- **Logo.** Posição `logo` (topo, topo-centro, rodape, nenhum), tamanho `logoTam` e a opção `labbio` (logo do LABBIO ao lado, `crMarcas`, 543).
- **Fontes.** `crFonte` usa Archivo por padrão para tudo; `crMono` usa IBM Plex Mono (178-179). `crFontes` (1809) só pré-carrega Archivo e Plex Mono.
- **Fotos.** Upload, Unsplash, foto da equipe (`FOTOS_BASE`) e link.
- **Exportação** (`crModalBaixar`, 2097; `crBaixar`, 2113): PNG ou JPG por lâmina, ZIP (JSZip do cdnjs) ou PDF (jsPDF), em três escalas: 1, 4/3 e 2.

### A2. Onde mora a logo e os assets que o portal usa

**Pasta `/home/claude/membro/studio/`** (todos idênticos, por md5, a arquivos do brand):

| Arquivo do portal | Equivale a (brand) | Situação no v2 |
|---|---|---|
| `nro-imagotipo.png` (1563×265) | `assets/imagotipo preto.png`, nome antigo | Não é o `logo-imagotipo-black.png` do v2: mesmo tamanho, md5 diferente |
| `nro-simbolo.png` | `assets/NRO ICON (COLORED TRANSPARENT BACKGOUND).png` | Não é o `icon-colored-transparent.png` do v2 |
| `labbio.png` | não existe no brand | — |

- Quem usa: `CR_MARCAS` (mod-criador.js:115), `TRE_MARCAS` (mod-treinamentos.js:2137, certificado de treinamento) e tour.html:664.
- O carregamento está duplicado: `crCarregarMarcas` e `crApara` no criador, `treCarregarMarcas` e `treApara` nos treinamentos.

**Ícones na raiz do portal.**
- `favicon.png` é idêntico a `brand/favicon.png` e a `brand/assets/NRO ICON MONOCHROMATIC.png`, ou seja, a onda branca.
- Usos: ícone do menu `.lt-simbolo` (index.html:3415, 3476) e rsvp.html:62 e 81. A rsvp é uma página para convidados de fora, e o DIRETRIZES diz que a onda branca é "Never public".
- Ícones do PWA: `icone-180.png`, `icone-192.png`, `icone-512.png`, `icone-badge.png`.

**`LOGO_URL` aponta para um repositório pessoal:** `https://raw.githubusercontent.com/matheusmarcondes1/nro/refs/heads/main/imagotipo%20preto.png`.
- Onde aparece: index.html:3575 (login `#logo-login` em 4585, rodapé `#logo-ft` em 4694), doc-nro.js:38 e 66 (o cabeçalho dos PDFs), mod-relatorios.js:48, auth/index.html:123 e mailer/README.md:33.
- No CSS, o imagotipo preto é invertido para virar branco (index.html:781, 783, 1459, 1460; tour.html:126). O v2 manda usar o arquivo branco próprio e nunca inverter o preto.

**Fontes.** O portal carrega só Archivo 500-800 e IBM Plex Mono (index.html:22). `--f` é a pilha do sistema (index.html:56), sem Instrument Sans.

### A3. O que da marca o Studio oferece para baixar

- **Nenhum arquivo de marca.** O Studio só baixa as artes geradas: `crBaixar` no criador; `stBaixar` e `stBaixarTodas` na publicação (mod-studio.js:694 e 701).
- **Studio › Configurações › Recursos de imagem** (`stCfgRecursos`, mod-studio.js:946) lista links cadastrados à mão em `studio_recursos`.
  - O tipo `'marca'` aparece como "Marca e logos" (`ST_RECURSO_TIPOS`, 945; check em db/v23_studio.sql:733).
  - Há um botão fixo "Brand guidelines" que leva a https://brand.neurodynamics.dev (954).

### A4. O que no Studio está fora do design system v2

**Temas e cores do canvas**
- Nomes antigos em `CR_TEMAS`: `soma`, `ion` (hex do v1 `#2DD4BF`; o v2 usa `--ion-primary #5BBFB0`), `plasma`, `mielina` e `aura`.
  - No v2, `--soma`, `--plasma` e `--mielina` são aliases legados: plasma vira Signal e mielina vira Caution, ambos do conjunto funcional, que é proibido em peças.
  - Aura é só o alias `--aura`, que vale `pia-light`.
- O comentário em mod-criador.js:52-55 ("paleta oficial e auxiliar") está desatualizado.
- **Synapse como fundo.** O tema `synapse` tem fundo `#CEDC00` e é usado pelo modelo `frase` (1393). O teste testes/studio.mjs:122-123 depende dele (`.cr-tema[title="Synapse"]`).
- **Gradiente e halo fora do primário.** `crFundo` (326) e `crHalo` são aplicados aos temas soma, ion, plasma, dendrito e mielina, com halos `#2DD4BF`, `#7FA7F2`, `#A78BFA` e `#F5C36A`. No v2, brilho e gradiente são só do Cortex, e as demais famílias são chapadas.
- **Mais de uma família por peça.** Qualquer tema aceita qualquer acento, além de `acentoLivre`. O confete mistura `#2DD4BF` (440), `crFotoEm` usa `verde` `#0B7D6E` (496), e crLMidia (954) e crLArtigo (1102) também usam `#0B7D6E` (Soma v1).
- Os acentos vital, mielina, pulso e plasma são hexes do v1 que equivalem ao conjunto funcional do v2.

**Marcas**
- `crTile` recorta o quadrado do imagotipo em vez de usar `icon-square-solid-*`.
- Em `crLParceiro` o tile sai em Synapse: `crTile(..., '#CEDC00')` (997). O v2 diz "logo nunca em Synapse".
- O branco é obtido pintando o arquivo preto com `source-in` (`crPintada`, 145), em vez de usar `logo-imagotipo-white.png`.
- O símbolo colorido aparece a 55% como placeholder em molduras não redondas (`crSemFoto`, 508). No v2, o símbolo é só para moldura redonda e nunca reenquadrado; o substituto previsto é o "placeholder técnico FIG.".
- A logo sai em toda lâmina do carrossel (`logo:'topo'` por padrão). Nas apresentações, o v2 põe logo só na capa e na contracapa.

**Mono em rótulos e datas.** O v2 restringe Plex Mono a códigos e dados. Pontos onde o criador usa mono em rótulo ou data:
- `crOlho` (280);
- selo em `crCabecalho` (566);
- `crRodape` (583-593, inclusive "arraste →");
- `crCredito` (601);
- rótulo em `crSemFoto` (510);
- cargo em `crLCitacao` (785, 798);
- `sub` e selo de data em `crLPessoa` (813, 842);
- mês e dia da semana em `crLEvento` (901-902);
- `sub` em `crLMidia` (972);
- `crIconesAcao` (1032);
- etiqueta em `crLFoto` (1072);
- selo em `crLThumb` (1165);
- redes em `crLEncerramento` (1210);
- cargo em `crLBarra` (1234);
- revista e ano em `crLArtigo` (1102, 1115).

Os títulos e o texto de apoio saem em Archivo (`crApoioOp`, 643). No v2, o texto corrido é Instrument Sans.

**Separadores e emoji**
- Ponto médio: `${dd} · ${MES}` (841), `sem + ' · ' + ano` (902), `join(' · ')` (1104).
- Textos dos modelos com " · ": 1364, 1369-1372, 1382, 1421, 1441.
- `crAlt` junta com " — " (2159).
- As legendas sugeridas trazem emoji (1365-1434), e o v2 diz "No emoji".
- Há conflito de regras: PADROES.md §9 (linhas 599-601) permite ponto médio "nas artes do Studio", e o DIRETRIZES proíbe.

**Pílula**
- CTA em `crLEvento` (915), opções em `crLEnquete` (1132) e selo em `crLPessoa` (846).

**Interface do Studio (CSS da casca)**
- Mono em rótulos: `.cr-sec h4` e `.cr-rot` (index.html:2584), `.cr-tema` (2622-2623), `.st-partidas-g b` (2476) e `.st-como h4` (2518).
- Mono em datas: `.st-hist .q` (2526).
- `.chip-b.on` tem fundo Synapse e `border-radius:999px` (2433, 2437). Os chips do criador usam essa classe, e o v2 diz que seleção nunca é Synapse e que chip tem raio de 6px.
- `.cr-ac.livre` usa um conic-gradient com hexes do v1 (2624).
- `STUDIO_PILARES` (index.html:4341) e `STUDIO_REDES.site` usam a paleta auxiliar do v1. O pilar institucional usa `#CEDC00`.

### A5. O que seria preciso para alinhar

1. **Temas.** Trocar `CR_TEMAS` por:
   - `void` e `cortex`, os únicos com halo ou gradiente;
   - um tema claro chapado (branco, Pia light ou Medula light, com tinta Cortex dark);
   - um tema chapado por família secundária (Ion, Neuron, Glia, Retina, Nexo, Dendrito, Lúmen, Ritmo, Impulso, Plexo, Íris), com a regra de pareamento: light com dark; dark com branco; primary com dark, exceto Cortex, Retina e Nexo, que levam branco.
   - O acento passa a ser um tom da mesma família. Synapse fica só em void e cortex. Sair `acentoLivre` e os acentos vital, mielina, pulso e plasma.
2. **Peças já salvas.** É preciso um mapa de aliases para `peca.estilo.tema` e `acento`. Hoje `crCores` (103) cai em `void` sem avisar quando a chave não existe. Mapa sugerido: soma→cortex, plasma→retina, mielina→lumen, aura→claro, synapse→cortex (ou claro), ion e dendrito→versões chapadas.
3. **Modelos e teste.** Atualizar os modelos frase (synapse), aviso (aura), dado (plasma), depoimento (ion) e data (dendrito), e o teste testes/studio.mjs:122.
4. **Marcas.** Copiar do brand `logo-imagotipo-black.png`, `logo-imagotipo-white.png`, os `logo-imagotipo-<familia>-dark|light.png`, `icon-square-solid-*` e `icon-colored-transparent.png` para `studio/`, na mesma origem, para não "sujar" o canvas.
   - Usar o arquivo branco em vez de pintar o preto.
   - Tirar o tile Synapse de `crLParceiro`.
   - Trocar o placeholder do símbolo pelo FIG.
   - Fazer o mesmo em `TRE_MARCAS`.
   - Trocar `LOGO_URL` (index.html, doc-nro.js, auth) por um asset da organização.
5. **Tipografia.** Carregar Instrument Sans (index.html:22 e `crFontes`). Os rótulos passam a Archivo 600, caixa alta, tracking .14em. O texto de apoio passa a Instrument Sans. O mono fica só em código ou dado (contador 01/05, DOI, POST-14).
6. **Separadores, emoji e pílulas.** Remover ponto médio, travessão e emoji dos textos e legendas. Raios: 11 no CTA, 5 nas tags. Decidir a divergência PADROES §9 x DIRETRIZES.
7. **CSS da casca.** Ajustar `.chip-b.on`, `.cr-sec h4`, `.cr-rot`, `.cr-tema`, `.st-partidas-g b`, `.st-como h4` e `.st-hist .q`. Remapear `STUDIO_PILARES` para famílias do v2.

### A6. Para não duplicar com o módulo "Marca"

- O Studio não tem kit de marca: não oferece logos, paleta nem tokens para baixar, só links.
- Os assets de marca do portal estão espalhados em três lugares: `studio/`, a raiz e `LOGO_URL` externo.
- O módulo Marca pode ser o dono único dos arquivos de marca e da regra de logo, e o criador e os treinamentos passam a consumir dele (a carga de logo hoje está duplicada).

**Sobreposição com o Estúdio do brand** (`RECURSOS`, brand/index.html:1435):
- os dois geram feed, story e thumbnail do YouTube;
- só o brand gera crachá, wallpapers, pôster, capa de apresentação, capa de relatório, avatar com anel, fundo de reunião e banners;
- só o portal gera carrossel, PDF do LinkedIn e peças de vídeo.

**Assinaturas.** Já usam o mesmo Supabase do portal: `rxzmkyjttzzpwtodqkve` (brand/index.html:1134 e membro/index.html:3565), lendo `perfis` e `membros`. São candidatas naturais ao módulo Marca. A tour linka `brand.neurodynamics.dev/#assinaturas` (tour.html:2183).

---

### (B) Repositório brand

### B1. Inventário

São 157 arquivos rastreados.

- **`index.html`** (2023 linhas): página única em 6 abas, com endereço `#aba/sub`.
  - Navegação: `ABAS`, `ativarAba`, `ativarSub`, `lerEndereco`, `irPara` (1154-1212). `#executivo` é tratado à parte (1186).
  - CSS próprio inline (17-303). Carrega `design-system/tokens.css` e `neuro.css`, e as fontes Archivo 300-700, Plex Mono, Instrument Sans e Instrument Serif.
  - Abas:
    - **Cores:** `PALETA` (1305), `PROPORCAO`, `BRANCO_NO_PRIMARY`, `desenhaCores`, `baixarPaletaJSON`, `copiarTokensCSS`.
    - **Tipografia.**
    - **Elementos:** marcas, superfícies, bandas, forma.
    - **Interfaces:** demos vivas e `criarSelect` (1218).
    - **Creative gallery:** galeria e Estúdio. O Estúdio clona `templates/` por `fetch` e DOMParser (`montarPeca`, 1507), exporta com html-to-image 1.11.13 do jsDelivr (1683) e tem um motor de canvas (`desenhaBase`, 1723; `desenhaCanvas`, 1800).
    - **Aplicações:** documentos, apresentações, digital, assinaturas (login Supabase, 1134-1135; `SIG_ORG`, 1872) e downloads.
  - `LOGO_URL` aponta para o repositório pessoal (1131).
  - `SIMB_IMG` carrega `favicon.png`, que é a onda branca, embora o comentário diga "tile verde" (1408-1413).
- **`template.html`:** está no padrão v1. O logo vem do repositório pessoal e é invertido por `filter:brightness(0) invert(1)` (70 e 116), e o texto recomenda "rótulos técnicos em IBM Plex Mono caixa alta" (139).
- **`templates/`:** 14 pastas e um README.
  - Pastas: badges, brand-deck, business-card, certificate, certificate-brand, email (Boletim, Comunicado, Cabecalhos e 22 variantes), formal-deck, formal-report, invitation, letterhead, posters, social, wallpapers.
  - É HTML estático exportado do Claude Design, com `data-screen-label` lido pelo Estúdio.
  - Wallpapers.html tem 997KB.
- **`assets/`:**
  - legados com espaço no nome: `NRO ICON ...` e `NRO SQUARE ICON ...` (7 arquivos), `imagotipo preto.png` e `imagotipo branco.png`;
  - nomes do v2: `logo-imagotipo-black` e `-white`; `-<familia>-light|dark` para cortex, dendrito, glia, impulso, ion, iris, lumen, neuron, nexo, plexo, retina e ritmo; `-pia-dark`; `icon-*` (9 arquivos);
  - selos: `seal-axon.png`, `seal-cortex.png`, `seal-white.png` (800×800) e `seal-laurel.svg`;
  - o modelo controlado `NRO-PUB-002-template-documentos-e-registros.docx`;
  - `manual/`: 32 miniaturas JPG.
- **`design-system/`:** tokens.css, neuro.css, formal.css, DIRETRIZES.md, README.md, build.mjs, `_ds_manifest.json`, `marca/` (5 webp, LEIAME, gerar-artes.mjs) e `previews/` (18 cards autocontidos, 458KB). Não existe `previews/` na raiz.
- Na raiz: `favicon.png`, CNAME e README.md.

### B2. O que é reaproveitável no site multipágina

**Direto**
- `design-system/tokens.css`, `neuro.css` e `formal.css`, como folhas de todas as páginas.
- `DIRETRIZES.md` como texto-base das regras.
- Os assets com nome do v2 (`logo-imagotipo-*`, `icon-*`).
- O cabeçalho e o rodapé (`.nd-header`, `.hd-nav`, que passam a ser links de verdade), o fundo `.nd-bg`, e o CSS de 17-303 extraído para um site.css comum.
- Os blocos JS:
  - `PALETA` e as funções de cores vão para `cores.html`;
  - `criarSelect` e `toast` vão para um js comum.

**Mapa sugerido de seções para páginas**

| Hoje (aba) | Página nova |
|---|---|
| Cores (principal, secundario, funcional, uso como âncoras) | `cores.html` |
| Tipografia (`#executivo` vira âncora) | `tipografia.html` |
| Elementos (marcas pode virar `marca.html`) | `elementos.html` |
| Interfaces | `interfaces.html` |
| Creative gallery | `galeria.html` |
| Aplicações | `aplicacoes.html` |
| Downloads | `downloads.html` |

**Com ajuste**
- As miniaturas de `assets/manual/` precisam ser refeitas onde há nomes (B4).
- O `index.html` precisa de um script que redirecione os hashes antigos (`#cores/secundario`, `#assinaturas`, `#executivo`), porque a tour do portal linka `#assinaturas`.
- Os previews do design system servem como espécimes (iframe ou link), mas são pesados e carregam data URIs.

**Não reaproveitar como está**
- `template.html` (v1).
- `LOGO_URL` do repositório pessoal.
- O Estúdio e as Assinaturas, que deveriam ir para o portal (B3 e A6).

### B3. Material controlado exposto publicamente

O repositório é público. Não basta tirar os arquivos do site: eles também estão no histórico do git.

- **Selos.**
  - `assets/seal-axon.png`, `seal-cortex.png` e `seal-white.png`, além de `seal-laurel.svg`, que é a fonte vetorial e permite falsificar o selo.
  - A página mostra os selos em index.html:609, e os downloads anunciam "selos" (1077).
- **Certificados.**
  - `templates/certificate/Certificate.html`: selo Axon, código NRO-CERT-2026-0412, "Verificável em neurodynamics.dev".
  - `templates/certificate-brand/CertificateBrand.html`.
  - São HTML editáveis, o que facilita falsificar algo que o portal emite e valida (`CERT-…`, `doc_validar`).
- **Convite.** `templates/invitation/Invitation.html` (NRO-EVT-2026-09).
- **Crachás.**
  - `templates/badges/Badges.html` traz ID, nível de acesso, "QR de acesso", "Áreas liberadas" (LABBIO salas 1 a 4, 24 h; Biotério com escolta) e o crachá de visitante.
  - O Estúdio público (`RECURSOS.cracha`, brand/index.html:1443-1450) deixa qualquer pessoa preencher nome e foto e baixar o PNG em 2×.
- **Documentos controlados e modelos.** Carta e memorando (NRO-CAR, NRO-MEM, "Uso interno") em letterhead; FormalReport ("Uso interno"); `assets/NRO-PUB-002-template-documentos-e-registros.docx`, com download público (index.html:1093).
- **Pôsteres.** As pranchas do NeuroAmp-32 estão marcadas "CONFIDENCIAL" e "USO INTERNO" e trazem PCB, diagrama de blocos e firmware.
- **Onda branca.** `icon-monochromatic.png` e `favicon.png` são servidos publicamente como favicon, e a regra é "nunca pública".
- **Outros.** Quase todo arquivo tem a Supabase publishable key (normal, protegida por RLS). `LOGO_URL` também aparece em template.html:116.

### B4. Nomes próprios

**Nos templates (`templates/*/*.html`)**

| Arquivo | Nomes |
|---|---|
| badges/Badges.html | **Matheus Marcondes** (frente; no verso, **"Matheus Marcondes de Oliveira"**, "ID 2022112517", ND-0331, "Senior manager"; no Retrato, "Project manager", ID 2022112517); **Sarah Fernanda** (ID 2021098833, ND-0418, Sr developer, P&D); **Ana Alice Ribeiro** (ID 2023104412); **Bruno Okafor** (visitante V-0072) |
| business-card | Ana Ribeiro (telefone +55 31 99812 4407) |
| certificate | Mariana Costa Albuquerque, Ana Ribeiro, Rafael Mendes |
| certificate-brand | Mariana Costa Albuquerque, Ana Ribeiro |
| letterhead | Profa. Helena Duarte, Ana Ribeiro, Rafael Lins, Bruno Okafor, Marina Takahashi |
| formal-report | Ana Ribeiro |
| brand-deck e formal-deck | Ana Ribeiro (ana.ribeiro@neurodynamics.dev), Rafael Mendes, Júlia Prado, Caio Ferreira |
| social | Dra. Paula Viana (também em brand/index.html:527) |
| email/Comunicado.html e as 11 variantes Comunicado-* | Paula Caversan |
| email/Boletim.html e as 11 variantes | "A. Ribeiro" |
| posters | P. Caversan, S. Fernanda, M. Marcondes (blocos de título das pranchas; cada nome aparece 4 vezes no HTML) |
| invitation, wallpapers, Cabecalhos | nenhum |

**Nas miniaturas (`assets/manual/`)**, conferidas por imagem:

| Miniatura | Nomes |
|---|---|
| cracha-sinal.jpg | Matheus Marcondes, ND-0331 |
| cracha-retrato.jpg | Matheus Marcondes, ID 2022112517 |
| cracha-ficha.jpg | Sarah Fernanda, ID 2021098833 |
| certificado.jpg | Mariana Costa Albuquerque, Ana Ribeiro, Rafael Mendes |
| certificado-marca-ion.jpg | Mariana Costa Albuquerque, Ana Ribeiro |
| cartao-verso.jpg | Ana Ribeiro, com telefone |
| timbre-executivo.jpg | Helena Duarte, Ana Ribeiro |
| timbre-operacional.jpg | Bruno Okafor, Marina Takahashi |
| relatorio-texto.jpg | Ana Ribeiro |
| deck-marca-capa.jpg e deck-formal-capa.jpg | Ana Ribeiro |
| email-comunicado-retina.jpg | Paula Caversan |
| poster-pcb.jpg e poster-blocos.jpg | P. Caversan, S. Fernanda, M. Marcondes |
| social-story.jpg | Dra. Paula Viana |

- Sem nomes: cartao-frente, convite-cortex, relatorio-capa, social-feed-retina, social-linkedin, deck-formal-numeros e o recorte de email-boletim.
- As demais (convite-retina, deck-marca-grafico, deck-marca-paineis, social-feed-cortex, poster-sinal, poster-simplicidade, wall-*) não foram abertas como imagem; os templates de origem não têm nomes nessas peças.

**Provavelmente reais.** "Matheus Marcondes (de Oliveira)" combina com o dono de `matheusmarcondes1/nro` e com `MMARCONDES` no stub de teste do portal (testes/stub-supabase.js:320). O ID 2022112517 tem formato de matrícula da UFMG. Paula Caversan e Sarah Fernanda se repetem com papéis consistentes. Os outros parecem fictícios; o README dos templates diz que são "de exemplo".

Fora do escopo, os previews do design system também têm nomes de exemplo: Ana Faria, Caio Mendes, Bruna Teixeira, Ana Figueiredo, Davi Lopes, André Lima, Gabriela Nunes, Fábio Queiroz, Elisa Ramalho e Diego Prado.

### B5. Assets do brand que o portal referencia por URL

**Nenhum.** O portal não carrega imagem, CSS nem JS de brand.neurodynamics.dev. Há só links de navegação:
- PADROES.md:536 e README.md:1073;
- mod-studio.js:954 e index.html:6100 (link útil padrão);
- db/v29_presenca_e_inicio.sql:230 (seed);
- tour.html:707, 1894, 1898, 2183 (`/#assinaturas`, que quebra se o hash mudar) e 2188.

Os logos do portal são cópias locais em `studio/` e `favicon.png`, mais o `LOGO_URL` do repositório pessoal. O CSS da casca é cópia manual do design system (PADROES §4 e §8).

### B6. GitHub Pages, CNAME e 404

- **`/cores` a partir de `cores.html`:** sim, é o comportamento padrão do Pages, que serve `x.html` para `/x`, com ou sem Jekyll. `/cores.html` continua respondendo. Não testei no site: o proxy recusou a conexão com brand.neurodynamics.dev.
  - Não criar `cores.html` e uma pasta `cores/` juntos.
  - Evitar páginas com o nome de pastas que já existem: `templates`, `assets`, `design-system`.
- **CNAME:** existe e contém `brand.neurodynamics.dev`.
- **404:** não existe `404.html` nem `404.md`, então o Pages mostra a 404 padrão do GitHub.
- **Jekyll:** não há `.nojekyll` nem `_config.yml`, então o Jekyll roda. Por isso `design-system/_ds_manifest.json` não é publicado (arquivo começando com `_`).

---

## Anexo I: auditoria de linguagem

### Auditoria de linguagem (PADROES.md §9) do portal SOMA

### Método e escopo
- Extraí os literais de string e o texto HTML com um tokenizador que descarta comentários JS/HTML e o CSS. São cerca de 5.900 fragmentos visíveis com mais de uma palavra.
- Varri esses fragmentos atrás de: travessão (—), ponto médio (·), expressões de conversa ("dá/deu para", "é só", "a gente", "não deu", exclamação, pergunta) e parágrafos `<p class="sub|lead|small muted|mini|desc|nota|hint">` com 90 caracteres ou mais.
- Ficaram fora da contagem de violação:
  - "—" como marca de campo vazio (`|| '—'`, `<span class="dim">—</span>`, `<option value="">—</option>`);
  - "·" nas artes do Studio (mod-criador.js) e nos certificados em PDF (mod-treinamentos.js:2225, 2250, 2251);
  - perguntas de `confirma()` ("Excluir este evento?").
- A marca dá a mesma regra: /home/claude/brand/design-system/DIRETRIZES.md:51 ("No middle dots or em dashes as separators… Em dashes only to attribute a quote") e :52 (sem emoji).
- Formato das contagens abaixo: TR = travessão em frase ou rótulo; PM = ponto médio; CONV = tom de conversa; EXPL = parágrafos explicativos que deveriam sair ou virar dica().

### 1–2. Por arquivo: contagens, exemplos e reescritas

### index.html (casca; HTML 3335–3558, JS 3560–7223)
Contagem: TR 0 (os 8 "—" em string são marca de vazio: 3593, 3703, 3440, 3449, 6756, 6788, 7166, 7202) · PM 0 · CONV cerca de 12 · EXPL cerca de 8.

Exemplos:
- **4549** `'Não deu para enviar agora: ' + (error.message || 'tente de novo em instantes.')`
  → `'Não foi possível enviar o link: ' + error.message`
- **3680–3683**, aviso-vinculo: "A sua conta ainda não está ligada a um registro do quadro. Você consegue navegar, mas não comentar, abrir solicitação nem receber atividade. Peça ao Depto. de Pessoal…"
  → "Conta sem vínculo com um registro de membro. O vínculo é feito em Administração › Contas." Esse texto já existe em `MOTIVO_RPC.sem_registro`, linha 3637.
- **6659–6662**, check-in:
  - "Bem-vindo, ${nome}!" e "Primeira visita registrada!" → título "Check-in registrado", corpo "${nome}, 3ª visita em outubro." e "Primeira visita do mês.";
  - "Você já está aqui" → "Check-in já registrado";
  - 6656 "Algo falhou" → "Check-in não registrado".
  - Armadilha: tour.mjs:156 confere a mesma frase na maquete do tour.
- **6922 / 6932** "O que você precisa acessar?" → "Acesso". **6937** "Por quanto tempo?" → "Prazo".
- **5715 / 6227** "A migração `db/v16_pessoal.sql` foi aplicada?" (pergunta retórica) → "Verifique a migração db/v16_pessoal.sql." Em 5709–5711, "A função está no ar, mas ainda não sabe por onde enviar… Nada foi perdido…" → "Função sem provedor de e-mail configurado. O aviso sai quando o segredo for definido (README, passo 4)."
- **6962** `<p class="desc">O Depto. de Pessoal entra em contato para a transição…</p>`, **6920** "Documento, sistema, plataforma ou local. Analisada pelo Depto. de Pessoal." e **6051** "Aparece no menu, nos cartões, no placar e na sua ficha" → remover, ou passar para dica() no `<h2>`.

### mod-admin.js
Contagem: TR 5 (todos armadilha, ver §4) · PM 0 · CONV cerca de 5 · EXPL cerca de 5 · plural "(s)" 11.

Exemplos:
- **328** "Aviso criado. Começa oculto: publique quando estiver pronto." → "Aviso criado, oculto."
- **210–211, 499, 968** "…A migração <b>soma_v10_portal.sql</b> foi aplicada?" → "Verifique a migração soma_v10_portal.sql."
- **812** `⚠ ${n} resposta(s) do FORM sem membro correspondente: …` → `Respostas do FORM sem membro (${n}): …`
- **1649** "Atividades e pessoas de X passam para o grupo escolhido… X é excluído." → passar para dica() no rótulo do campo de destino.

### mod-agenda.js
Contagem: TR 0 · PM 0 · CONV 1 · EXPL 1. Quatro dicas já em uso (665, 1014, 1146, 1152).

Exemplos:
- **531** `<p class="small muted">Férias e afastamento: visíveis para você e para o Depto. de Pessoal. Para a equipe, o horário aparece ocupado.</p>` → dica() no rótulo do tipo de ausência.
- **731** "Você vai?" → "Resposta". É opcional: é uma pergunta funcional. O par está em rsvp.html:91 e notificar-email:575.

### mod-arquivos.js
Contagem: TR 1 frase e 5 opções "— x —" (23 marcas de vazio) · PM 1 · CONV 1 · EXPL cerca de 9 (contando os leads do topo).

Exemplos:
- **752** `<span class="dim">— a série não tem grupo próprio</span>` → `<span class="dim"> (sem grupo próprio)</span>`
- **1012, 1128, 1386** `<option value="">— nenhum —</option>` → `Nenhum`. **1268** "— o PMO —" → "PMO". **1318** "— sem grupo —" → "Sem grupo".
- **1104–1105** "Uma revisão nova de um arquivo que já existe não se adiciona aqui: abra o arquivo e use Enviar revisão. Ele continua…" → dica('Revisão de arquivo existente: abra o arquivo e use Enviar revisão. O código se mantém; a letra avança.')
- **316–317** lead do topo "Rol da NRO-PUB-001. Toda versão nova passa por revisão antes de entrar em vigor." → "Rol da NRO-PUB-001." + dica() com a segunda frase. Mesmo tratamento para **387–388** e **1193–1194**.
- **1311** (150 caracteres, "O emissor é o XXX de NRO-XXX-YYY…") → dica() no rótulo "Emissor".

### mod-atividades.js
Contagem: TR 4 frases e 2 opções · PM 0 · CONV 2 · EXPL 4.

Exemplos:
- **210–211** "Para acompanhar, peça acesso a quem administra o portal — é uma permissão por quadro…" → "Acesso ao quadro: peça a quem administra o portal." + dica('A permissão é por quadro e não inclui a pessoa no grupo.')
- **1622–1623** "Quem segue a atividade é avisado — e, se houver responsável, o gestor dele também. É assim que se escala um problema." → remover o parágrafo e pôr `<h3>Sinalizar ${dica('Avisa quem segue a atividade e o gestor do responsável.')}</h3>`.
- **932** `${o.grupo} — ${data}` → `${o.grupo}, ${data}`. **811** `Solicitação ${protocolo} —` → `Solicitação ${protocolo},`.
- **522** "— ninguém ainda —" → "Sem responsável". **717** "— ninguém —" → "Ninguém".
- **175–176** "Os quadros são por grupo, e ainda não existe nenhum. Quem cria é a…" → manter só "Nenhum quadro." mais a ação.

### mod-cofre.js
Contagem: TR 5 · PM 1 (o glifo de vazio da linha 727) · CONV 1 · EXPL cerca de 6.

Exemplos:
- **621** "Gere a senha — ou marque que a conta não tem." → "Gere a senha ou marque que a conta não tem senha."
- **589** "Há notas guardadas — veja pela lista, em "Notas secretas"." → "Notas guardadas. Consulta em "Notas secretas"."
- **600** "(opcional — ficam no cofre, como a senha)" → "(opcional)" + dica('Ficam no cofre, como a senha.')
- **128–129** "…Precisa de uma? Peça o acesso." → "Nenhuma conta disponível." + o botão já existente + dica() com a regra.
- **663–665** lead "…o endereço, o usuário e a senha — e quem usa, quem mantém e quando troca." → `${n} contas no cofre.` + dica().
- **70** "Falta aplicar a migração db/v27_cofre.sql — e, antes dela, ligar o…" → trocar o "—" por ". Antes dela, …".

### mod-criador.js
Contagem: TR 7 na interface (cerca de 8 no conteúdo dos modelos, de 1361 a 1441 e na linha 1965) · PM 14 (todos de arte ou modelo, permitidos) · CONV 3 na interface · EXPL 6. Nenhuma dica() hoje.

Exemplos:
- **1578** 'esse endereço não deixa usar a imagem aqui — baixe e envie o arquivo' → 'Imagem bloqueada pelo endereço de origem. Baixe e envie o arquivo.' O mesmo vale para **2083**.
- **1690** `${nome} não tem foto na ficha que dê para usar — envie uma.` → `${nome} sem foto utilizável na ficha. Envie uma.`
- **2262** `'Não deu para salvar: ' + msg + ' — falta aplicar a migração v23?'` → `'Não foi possível salvar: ' + msg + '. Verifique a migração v23.'`. A linha **2142** "Não deu para baixar" segue o mesmo padrão.
- **1307**, rótulo 'Itens ("Título — descrição")' → 'Itens (Título: descrição)'. **1778**, placeholder "Nome da publicação — ex.: …" → "Ex.: …". O parser `crPartes` (648) já aceita ":", então é seguro.
- **1587, 2047, 2101, 2195, 2278**: parágrafos de 140 a 190 caracteres → dica() nos rótulos.
- O conteúdo dos modelos (exclamações, "a gente" em 1424 e 2271, emojis em 1374, 1422, 1425 e 1434) é texto das artes. Fica fora do §9, mas fere DIRETRIZES:52 (sem emoji).

### mod-documentos.js
Contagem: TR 1 · PM 1 (o glifo da linha 272) · CONV 1 · EXPL 3.

Exemplos:
- **379** `EVX_ACAO.emitiu: '— saíram as declarações:'` → `'emitiu as declarações:'`
- **208** "A validação passa a exibir a revogação e o motivo. A ação é irreversível." → dica() no título do modal. A regra é citada no próprio §9.
- **55** "O evento ainda não aconteceu: registre agora e mande para aprovação depois dele." → "Evento futuro: aprovação só depois da data." O teste documentos-e-eventos.mjs:209 procura `/ainda não aconteceu/`.

### mod-formularios.js
Contagem: TR 2 e 1 opção · PM 1 · CONV 2 · EXPL 3.

Exemplos:
- **152–153** "Prefere o Word? Ele continua valendo: na tela do arquivo, … sobe o arquivo pronto." → dica('O Word continua valendo: na tela do arquivo, "Enviar o registro" sobe o arquivo pronto.') ao lado do botão.
- **118–121** lead "…, escrito aqui mesmo. O rascunho grava sozinho; ao mandar, o portal gera o PDF…" → `Template ${cod} Rev. ${rev}.` + dica().
- **192**, placeholder "Com apoio de IA? Qual — LLM Gemini" → "Ex.: LLM Gemini". **186** "— nenhum —" → "Nenhum".
- **340** (`' — '` no título do PN) e **492** (`-·`) são armadilha (ver §4).

### mod-gestao.js
Contagem: TR 1 e 1 opção (26 marcas de vazio) · PM 0 · CONV 1 · EXPL 4 · plural "(s)" 8. Nenhuma dica() hoje.

Exemplos:
- **323–325** "Enter ou vírgula adiciona. Clique no × para tirar. A lista sugere os grupos que já existem — usar a sugestão evita…" → "Enter ou vírgula adiciona; × remove." + dica('Use a sugestão: evita grupos duplicados, como "Órtese" e "ortese".')
- **569–570** "Para enviar a foto, use a câmera no avatar; para colar um link, clique no avatar. Mudanças de status… geram ocorrências." → dica().
- **961–962** lead do Apontamento (189 caracteres) → "Grupo sob a sua liderança." + dica().
- **279** "— sem gestor —" → "Sem gestor". **93** "o seu papel não dá acesso a esta tela" → "Sem permissão para esta tela."

### mod-mailer.js
Contagem: TR 0 · PM 0 · CONV 1 (dentro de uma dica) · EXPL 1 · plural "(s)" 6. É o módulo que mais segue o padrão (10 dicas).

Exemplos:
- **759–760** "As pílulas marcadas entram na fila, na ordem…" → dica() no `<h3>Programar série`.
- **498**, texto da dica: "…o portal aberto dá um empurrão a cada dois minutos" → "…o portal aberto aciona a fila a cada dois minutos".

### Módulos já limpos ou com pouco a fazer
- **mod-okrs.js**: limpo. `OKR_STATUS` (31) é armadilha.
- **mod-versoes.js**: limpo, com 2 dicas.
- **mod-presenca.js**:
  - o texto da dica do Placar (71) está duplicado em index.html:6458 com pontuação diferente;
  - **149** rótulo "Onde vai ficar" → "Local".

### mod-projetos.js
Contagem: 2 opções com "—" · EXPL 2.
- **212** "— escolha —" → "Escolha". **355** "— sem supervisor —" → "Sem supervisor".
- **186–187** "A equipe é o grupo X. Quem está nela está também em X, e lê os arquivos controlados…" → dica() no `<h3>Equipe (n)`.
- **172** 'Os PNs são criados pela equipe do projeto.' → manter, uma linha só.

### mod-relatorios.js
Contagem: TR 1 · EXPL 4 · plural "(s)" 7.
- **89–90** "Tudo daqui sai para imprimir ou colar em e-mail — por isso continua em superfície clara…" → remover: explica o design.
- **563** (278 caracteres) → "Registro, nome, status, departamento, cargo, gestor, grupos, e-mails, telefone e datas." + dica('Dados sensíveis (CPF, endereço, autodeclarações) nunca entram. O Excel pode ser reimportado em Operações › Importar planilha.'). Nessa frase, "Operações → Importar" usa "→" no lugar do "›" do resto do portal.
- **500** e **349** → dica().

### mod-selecao.js
Contagem: TR 3 · PM 2 · CONV 2 · EXPL 12 (já tem 9 dicas).

Exemplos:
- **1135–1139** "As duas tolerâncias definem… não devolvem nada — nem para quem tem login. Trinta minutos dão folga…" → "Tolerâncias de abertura e fechamento." + dica('Fora do intervalo, mesa, painel e página do candidato não respondem, nem com login.')
- **1548** "Catálogo vazio — use o campo abaixo para incluir etiquetas." → "Catálogo vazio."
- **1204** '— sem código —' → 'Sem código'.
- **392** `<b>${nome}</b> · ${protocolo}` → `<b>${nome}</b>, ${protocolo}`. **1222** `${local} · ${n} de ${cap} lugares` → `${local}, ${n} de ${cap} lugares`.
- **704** "Horários abertos: 3" → "Horários abertos (3)".
- **171–172** lead "Os bastidores do processo: candidatos, avaliação…" → remover: as abas já dizem isso. **266–268** → dica().

### mod-studio.js
Contagem: TR 2 (281, 283, 285, 339 e 340 são `<option value="">—</option>`, vazio aceitável) · PM 0 · CONV 14 · EXPL 8.

Exemplos:
- **794 e 847** `toast('Não deu para salvar' + (error ? ': ' + msg : ' — sem permissão.'), true)` → `toast(error ? 'Não foi possível salvar: ' + msg : MOTIVO_RPC.sem_permissao, true)`
- "Não deu para…" aparece 13 vezes: 240, 331, 352, 373, 381, 654, 666, 697, 715, 794, 847, 919, 985 → "Não foi possível …".
- **290** `<summary>Sem ideia? Pontos de partida, por pilar</summary>` → "Pontos de partida, por pilar".
- **778** (193 caracteres, sobre o lembrete) e **876** e **951** → dica().
- **581** "Arte, 2 imagens" → "Arte (2)".

### mod-treinamentos.js
Contagem: TR 1 na interface (13 no README de conteúdo e no prompt, linhas 600 a 834) · PM 3 (certificado em PDF, permitido) · CONV 18 · EXPL cerca de 3.

Exemplos:
- "Não deu para…" aparece 16 vezes: 1111, 1214, 1250, 1388, 1547, 1555, 1811, 1843, 1855, 1862, 1870, 2035, 2055, 2100, 2107, 2298 → "Não foi possível …".
- **1029** "Refeito o treinamento? A revisão atual é a X." → "Vencido. Revisão atual: X."
- **1031** "Nenhum certificado com o código X. Confira as letras e os números — o código tem o formato CERT-XXXX-XXXX." → "Nenhum certificado com o código X. Formato: CERT-XXXX-XXXX."
- **1422** "Tudo certo: o texto segue o formato do README." → "Texto no formato do README."
- **518**, exportação Markdown `' — ' + descricao` → `': '`. O parser (448) aceita `[—–:-]`.
- O README de conteúdo (600 a 834) é documento para quem escreve e para agentes. Pede uma passada própria para tirar o "—", já que a dica de mod-mailer.js:701 manda escrever "sem travessão".

### quiosque.html (não carrega dica)
Contagem: TR 2 · PM 6 · CONV 0 · inglês 1.
- **460** 'noite — o sol ainda não nasceu' e 'noite — o sol já se pôs' → 'noite, antes do nascer do sol' e 'noite, depois do pôr do sol'.
- **153** "SOMA · Painel de entrada" → "Painel de entrada". **6** `<title>` → "Painel | NeuroDynamics".
- **166–167** "Sensação --° · Precip. --" e "· Campus UFMG" → separar por layout ou vírgula.
- **312** `<b>espaço</b> · N confirmados` → vírgula. **354** `.join(' · ')` → `.join(', ')`.
- **344** "Find me at ${local}" (inglês) → "Em ${local}".

### rsvp.html
PM 1: **6** "Resposta ao convite · NeuroDynamics" → "Resposta ao convite | NeuroDynamics". **91** "Ana, você vai?": pergunta funcional, opcional "Confirme a presença.".

### tour.html (onboarding próprio, sem dica)
Contagem: TR 0 · PM 0 · CONV cerca de 27 (perguntas usadas como abertura de item) · EXPL: é o conteúdo da página. Recomendo corrigir só o tom, sem cortar.

Exemplos:
- **1567–1572** "Começou? / Travou? / Terminou? / Quer acompanhar…?" → "Ao começar: … / Impedimento: … / Ao terminar: … / Para acompanhar: …"
- **1143** "Não chegou em alguns minutos? Procure no spam…" → "Sem e-mail em alguns minutos: confira o spam…"
- **1297** "…Esqueceu a senha? Use a aba… Ainda não tem conta? Crie a sua na primeira aba." → "…Senha esquecida: aba Esqueci a senha. Sem conta: primeira aba."
- **2192** "Pronto. Agora é com você." → remover. **1221** "Criar leva dois minutos, e é aqui mesmo." → remover.
- **1656**, maquete '"Bem-vindo! Check-in registrado no LABBIO"' → acompanhar a mudança em index.html:6659.

### admin.html
TR 1 e CONV 1, nas linhas **35–36**: "…estão em Administração — sem uma segunda tela de login. Estamos te levando para lá." → "…estão em Administração, no mesmo login." e remover a última frase.

### auth/index.html (validação pública, sem dica; a classe `.dica` em CSS:74 é outra coisa)
Contagem: TR 4 frases e 2 separadores · PM 5.
- **134** "…no rodapé do documento — ou leia o QR Code…" → "…no rodapé do documento, ou leia o QR Code…"
- **275** "Confira a digitação — as letras I, L, O e U não são usadas." → "Confira a digitação (as letras I, L, O e U não são usadas)."
- **291** "…foi alterado — compare-o com os dados abaixo." → "…foi alterado. Compare-o com os dados abaixo."
- **162** "…depois de emitido — por exemplo, quando…" → "…depois de emitido, por exemplo quando…"
- **296** `' · Rev. '` e **298** `' — ' + emissor` → "NRO-DIR-004-4 Rev. B" e "NeuroDynamics PD&I, Diretoria". Os dois têm teste (§4).
- **363**, comprovante "código verificador X — resultado." → "código verificador X: resultado."
- **6, 120, 173–174**: título e rodapé com "·" → vírgula ou quebra de linha.

### supabase/templates
Os .html são gerados por gerar.mjs; `node gerar.mjs --check` (linha 25) acusa divergência.
- PM: 4 `<title>` e 4 assuntos em gerar.mjs (113, 146, 157, 168), no formato "X · Portal do Membro". Os assuntos também ficam no painel do Supabase (tabela do LEIAME.md).
- TR 1 e CONV 1:
  - **gerar.mjs:117** "Depois é só entrar com esse e-mail e a senha que você escolheu." → "Depois, entre com esse e-mail e a senha escolhida."
  - **gerar.mjs:161** "…na tela de nova senha — escolha uma com pelo menos 8 caracteres." → "…na tela de nova senha. Mínimo de 8 caracteres."
- As linhas 133, 144 e 166 são metadado da tabela do LEIAME, não vão para o e-mail.

### supabase/functions
- **notificar-email/index.ts**: TR 7 visíveis e 3 de operador · PM 2 · CONV 1.
  - **320** "Para receber um resumo por dia — ou não receber —, abra o sininho…" → "Para mudar a frequência dos e-mails, abra o sino no topo do portal e clique em Preferências de e-mail." É preciso manter "Preferências de e-mail" (email.test.ts:197).
  - **442** "…pelo código verificador — ou pela leitura do QR Code…" → "…pelo código verificador ou pelo QR Code…"
  - **338, 463, 606**: assinatura em texto puro `\n\n—\nPortal do Membro · NeuroDynamics` → `\n\nPortal do Membro, NeuroDynamics`.
  - **580** `&nbsp;·&nbsp;` entre links → quebra de linha.
  - **167–170**, `DICA_10202` ("— quase sempre quer dizer… de onde dá para enviar") → reescrever mantendo "SUBDOMÍNIO" e "cf-bounce" (email.test.ts:131–132).
  - **108, 114**: mensagens de operador com "—".
- **agenda-sync/index.ts:572** "Ele pode ter sido redefinido — copie o endereço secreto de novo." → ". Copie o endereço secreto de novo."
- **agenda-ics/index.ts:159** "Agenda da NeuroDynamics · https://…" → vírgula ou quebra de linha. É a descrição do feed ICS.

### Achados adjacentes (fora de §9 estrito)
- **Prefixos de erro inconsistentes**: "Não foi possível" (149 ocorrências), "Erro ao" (61), "Falha ao" (31), "Não deu para" (32). Proponho "Não foi possível X: motivo", que casa com o argumento `padrao` de `motivoRPC` (index.html:3643).
- **Plural com "(s)"**: 44 ocorrências, como "2 enviado(s)" e "Programar 4 e-mail(s)". As de emails.mjs:163 e 202 têm teste.
- **Hífen curto (–) em intervalos de horário** (14:00–14:30): não é travessão, deixar como está. ps-entrevistas.mjs:88–89 e 174 testam.

### 3. dica(): como é hoje
- **Definição**: index.html:4006–4042.
  - Assinatura `dica(texto, rotulo)`. Devolve `<button type="button" class="dica" aria-label="${esc(rotulo||'Informação')}" data-dica="${esc(texto)}">${ic('info')}</button>`.
  - Um balão só, `#dica-pop` (`role=tooltip`, criado sob demanda), aberto por `mostrarDica(bt, fixo)`, com largura máxima de min(300 px, janela − 32) e posicionado abaixo do botão ou acima se faltar espaço.
  - Abre no mouseover/focusin, fixa no clique (capture), fecha no clique fora e no Esc. Põe `aria-describedby` no botão.
  - CSS em index.html:2312–2317 (`.dica`, `#dica-pop`).
- **Formato do texto**: puro (`textContent`), sem HTML nem links. Como fica em `data-dica`, não aparece no `textContent` da página, e os testes que leem texto não o veem.
- **Uso**: 48 chamadas em 15 arquivos.
  - mod-mailer 10, mod-selecao 9, mod-agenda 4, mod-admin 4, mod-atividades 3, mod-presenca 3, mod-studio 3, index.html 2 (6458 e 6996), mod-cofre 2, mod-treinamentos 2, mod-versoes 2, e 1 em cada um de mod-arquivos, mod-projetos, mod-formularios e mod-documentos.
  - Nenhuma em mod-criador, mod-gestao, mod-okrs e mod-relatorios.
  - tour, quiosque, rsvp e auth não carregam a casca, então não têm dica().
- **Padrões em uso**:
  - **No título**: `<h3>Placar do LABBIO ${dica(…)}</h3>` (6458, mod-presenca:71, 73, 87; mod-agenda:1014; mod-mailer:498).
  - **No rótulo do campo**: `<label>Remetente ${dica(…)}</label>` (mod-mailer:226, 238, 396, 701, 705; mod-atividades:532, 1291, 1577; mod-versoes:366; mod-selecao:690).
  - **No fim de uma linha curta**: `<p class="small muted">Contas dos seus acessos. ${dica(…)}</p>` (mod-cofre:117, mod-selecao:1164, 1167, 1183, 1586; mod-admin:220, 681).
  - **Como o lead inteiro do topo**: mod-studio:158, em `stTopo('Quadro de publicações', dica(…))`.
  - **Com rótulo próprio**: mod-versoes:255 ('Como o SOMA numera as versões'), index.html:6996 ('Sobre o anonimato'), mod-admin:220 ('Layouts').
- **Teste existente**: versoes-fotos-e-cartoes.mjs:91–96 confere `#main .dica` na tela de versões.
- **Bug (seletor amplo)**:
  - mod-treinamentos.js:194 desenha `<aside class="tre-caixa dica">` para as caixas "Dica" do Markdown.
  - Os handlers da casca usam `e.target.closest('.dica')` (index.html:4033–4041). Passar o mouse numa caixa Dica abre um `#dica-pop` vazio, e o clique em capture faz `preventDefault()` e `stopPropagation()`, o que bloqueia links dentro da caixa.
  - Correção: trocar o seletor para `button.dica` ou `.dica[data-dica]`, antes de espalhar mais dicas.

### 4. Armadilhas

### Strings que são chave ou valor (não mudar sem mudar o banco ou o código que compara)
- **mod-admin.js:632–636**, `MAPA_ACESSOS` 'Termo de sigilo — LABBIO' e os outros quatro: casam com `itens_acesso.nome` no banco (`porItem.get(a._item)`, linha 815–819). Mudar exige renomear as linhas da tabela.
- **mod-arquivos.js:244** `r.rev_pendente === '—'`: sentinela gravada pelo banco (db/v20_projetos_arquivos.sql:972 `coalesce(v_rev,'—')`; v22:212).
- **mod-formularios.js:340**: título do PN = `serie_titulo + ' — ' + complemento`. Vai para o banco e para o nome do PDF (formularios.mjs:129 espera "…ATA DE REUNIAO _ REUNIAO DE GERENCIA DE SETEMBRO.pdf"). O stub tem 'ATA DE REUNIÃO — reunião geral de setembro' (stub-supabase.js:327, 362).
- **mod-arquivos.js:1169 e mod-formularios.js:492**: código provisório `-·` ("NRO-PRO-004-·"), testado em arquivos-e-projetos.mjs:452.
- **mod-arquivos.js:65–75**, `ARQ_ESTRUTURAS.frase`: espelha `doc_estrutura_frase()` (db/v22) e a coluna da exportação. Testes em arquivos-e-projetos.mjs:297–299, 312, 334, 348.
- **Status gravados por extenso no banco**:
  - `STATUS_LIST` (index.html:3590, com 'Em pausa / avaliação') e `ATIVOS_E_PAUSA` (mod-admin.js:1156);
  - comparações `status==='Ativo'` e `==='Em pausa / avaliação'` (index.html:6688, 6756; mod-gestao.js:105; mod-documentos.js:491);
  - `OKR_STATUS` e `OKR_EIXOS_CORES` (mod-okrs.js:31–32);
  - `LOCAIS_STATUS` (mod-presenca.js:19), `TEMPOS` (index.html:3665), `TRE_CATEGORIAS` (mod-treinamentos.js:61);
  - `EVX_PAPEIS` 'Apresentador(a) de trabalho' (mod-documentos.js:46), impresso na declaração;
  - 'Importação da planilha' (mod-admin.js:820, gravada em `responsavel`).
- **Formatos lidos por parser**: `TRE_CAIXAS` e `TRE_SECAO_*` (mod-treinamentos.js:160, 355) e a regex de links (448). Trocar "—" por ":" é seguro, porque `crPartes` e a regex aceitam os dois.
- **Banco, fora do escopo da varredura mas visível no sino e no e-mail**:
  - títulos de notificação montados como `codigo || ' — ' || titulo` em cerca de 10 funções (db/2.17.0:585, 593, 655, 669, 686, 705, 933, 979; v15, v16, v17, v20, v23, v25, v26, v27, v28, v32);
  - testados em supabase/functions/notificar-email/email.test.ts:193 ("ORT-14 — Revisar a bancada", "DEP-3 — SOL26-0001");
  - o stub (stub-supabase.js:89, 162, 165) segue esse formato. Mudar exige uma migração nova.
- **Assuntos dos e-mails do Supabase**: ficam também no painel. Mudar só gerar.mjs deixa o painel divergente.

### Testes que procuram texto de interface (testes/*.mjs)
Os mais expostos à reescrita:
- **validacao.mjs**:
  - 63–64 `'NRO-DIR-004-4 · Rev. B'` e `'NeuroDynamics PD&I — Diretoria'` (auth:296, 298);
  - 62, 78, 81, 85: /Documento autêntico/, /controle conferido/, /não confere/, /Documento revogado/, /Nenhum documento com este código/;
  - 103: /…na condição de coautor\(a\)…/.
- **arquivos-e-projetos.mjs**:
  - 452: `·NRO-PRO-004-·`;
  - 297–348: frases de `ARQ_ESTRUTURAS` e rótulos 'Template → registros', 'Template → documentos', 'Documento único', 'Template avulso';
  - 77, 104: 'Todos os arquivos|Para revisar 1|…' (contagem sem parêntese no nav);
  - 194, 197, 201: /Escolha o arquivo/, /Diga o que mudou/, /Falta dizer o que fez com NRO-PES-007/;
  - 224, 234, 244, 246: /Já há uma versão aguardando revisão/, /Template de documento: molde, não documento/, /Registro aprovado não recebe revisão/, /Este registro foi feito na A e fica assim/;
  - 363–364: /Vai nascer NRO-PRO-003-2: …/, /Registro aprovado não se altera/;
  - 203 'Não precisa mudar', 427 /Você não está na equipe de nenhum projeto/.
- **formularios.mjs**:
  - 70 /são escritos no portal/ (mod-arquivos:614);
  - 73 /rascunho é salvo automaticamente/ (toast mod-arquivos:1141);
  - 82 /Falta preencher/, 104–105 /Rascunho gravado/ e /Tudo o que é obrigatório/;
  - 125 /fica pendente até a aprovação de PMO/;
  - 201–206: mensagens do validador de JSON;
  - 219–237: /não são registrados no rol/, /fora do rol/, /Mudança na série: os PNs não moram no rol/, /Quem escreve os PNs desta série/ (FRM_MOTIVO, mod-formularios:39–40);
  - 129: nome do PDF.
- **notificacoes.mjs**:
  - 106 'mesmo com o SOMA fechado' (precisa estar ausente);
  - 119 'Ao sair da conta, este aparelho deixa de receber' (index.html:5848);
  - 86 /1 aviso lido saiu do sino/, 242 /Passada feita/, 74 '30 dias' (index.html:3511).
- **ps-entrevistas.mjs**: 66–68 'Responsável: Ana Figueiredo', 'As entrevistas reservadas entram na sua agenda' (mod-selecao:699); 107, 123, 136 'recebe o novo horário por e-mail', '1 candidato recebe o aviso por e-mail', 'recebe um e-mail para escolher outro horário'; 128 /Responsável não registrado/; 88–89 e 174 os horários com "–".
- **okrs-e-selecao.mjs**: 273 /visível apenas para admin\/pessoal/ (mod-selecao:1708); 170 '1 inscrições aguardando deferimento|1 aprovados sem entrevista agendada|…'.
- **treinamentos.mjs**:
  - 384 /Somente admin e Depto\. de Pessoal/ (mod-treinamentos:2011);
  - 236 /Nada impede/ (1583); 211 /Antes de publicar, resolva/;
  - 185, 202 /Nenhum certificado/, /Nenhum treinamento com esse filtro/; 354 'Treinamentos (1)';
  - 118 /^Dica\s*a busca abre/ (caixa `.tre-caixa.dica`).
- **documentos-e-eventos.mjs**: 176 /entra na fila/, 182 /última aprovação que falta/ (mod-documentos:396), 186 /Saíram 2 declarações/, 205 /…o e-mail não parece um e-mail\./, 209 /ainda não aconteceu/ (mod-documentos:55), 74 /Um evento aguarda aprovação/.
- **cofre.mjs**: 247 /pelo acesso concedido/ e 254 /gestão do cofre/ (`COF_VIA`, mod-cofre:44); 103 /limpa em 60 segundos/; 177 /não parece válido/; 230 /Confira os números/; 86 /2 contas mantidas por você precisam de troca de senha/.
- **emails.mjs**: 140 '2 pessoas recebem. Sem e-mail na ficha: Carla Mendonça.'; 142 'Escolha pelo menos um grupo.'; 163 '2 enviado(s)'; 202 'Programar 4 e-mail(s)'; 201 'fica de fora'; 228 'começa com https:// ou #/'; 259 'O link de Site precisa começar com https://'.
- **tour.mjs**:
  - 64 'Bem-vindo ao SOMA', 156 'Bem-vindo, Ana!' (maquete do check-in);
  - 75, 78, 81 'Preencha o e-mail e a senha', 'pelo menos 8', 'não conferem';
  - 90, 96, 100, 102 'Confira o seu e-mail', 'Espere um minuto', 'E-mail ou senha incorretos', 'Falta confirmar o e-mail';
  - 104, 109 'Sua conta está pronta, Ana', 'Conta ligada ao quadro de pessoal';
  - 161, 166, 185 'Você entra no Studio e aprova publicações', 'Colegas dos seus grupos', 'O Studio não aparece para você';
  - 231 'expirou ou já foi usado'.
- **agenda-e-inicio.mjs**: 219 /3 no LABBIO agora/, 224 /Nenhuma tela recente/, 230 /Próximo compromisso/, 155 /Recepção, gerada em .* por Ana Figueiredo/.
- **studio.mjs**: 70 /1\s*esperando a sua aprovação/, 215 /grupo aprovador/, 66 os nomes das colunas (`STUDIO_STATUS`, index.html:4315).
- **versoes-fotos-e-cartoes.mjs**: 182 /Você ainda não tem foto/ (index.html:6050), 93–96 'Notas de versão', 'No ar', e a presença de `.dica`.
- **menu-lateral.mjs**: 357, 363, 422 'Usar o tema claro', 'Usar o tema escuro', 'Tema escuro'.
- **Deno (supabase/functions)**: email.test.ts:131–132 ('SUBDOMÍNIO', 'cf-bounce'), 193 (títulos com "—"), 194 'Há 2 avisos', 197 'Preferências de e-mail', 245 'Olá, Helena.', 276 'Carla Mendonça convidou você', 299 'Vou: ' e 'Não vou: '.
- **Regra geral**: mover um parágrafo para dica() tira o texto do `textContent`. Todo teste acima que procura frase explicativa (formularios:70, notificacoes:119, ps-entrevistas:68, okrs-e-selecao:273, treinamentos:384, cofre:247/254) precisa passar a ler `[data-dica]` ou ser ajustado. Os testes rodam com `python3 -m http.server 8765` na raiz e `node testes/<x>.mjs`.

### 5. Volume e fatiamento
- **Volume estimado**:
  - cerca de 55 travessões em frase ou rótulo na interface (cerca de 42 em mod-*, 0 na casca, 9 em quiosque, admin e auth), mais cerca de 11 em e-mails e funções;
  - cerca de 25 pontos médios fora de PDF e arte;
  - cerca de 95 trechos de conversa (32 "Não deu para", cerca de 27 perguntas do tour, cerca de 12 na casca, cerca de 8 "…foi aplicada?");
  - cerca de 70 parágrafos para remover ou passar para dica();
  - opcionais: 44 plurais "(s)", 13 travessões no README de treinamentos, emojis nos modelos do Studio.
  - Ao todo, 250 a 280 edições, cerca de 30 asserções de teste a ajustar e uma migração opcional para os títulos de notificação.
- **Pré-passo (um agente, antes dos outros)**:
  - corrigir o seletor da dica (`button.dica`);
  - fixar a convenção de erro: "Não foi possível X: motivo." e `MOTIVO_RPC` para permissão.
- **Fatias sem arquivo compartilhado** (cada agente roda os testes do seu domínio):
  - **A. index.html, um agente.** O trabalho é pouco (cerca de 35 edições). Se precisar dividir: A1 linhas 3335–4714 (HTML estático, login 4498–4570, `MOTIVO_RPC` 3636); A2 4714–5998 (roteador, menu, tema, paleta, notificações, teste de envio 5617–5764, push 5764–5940); A3 5998–7223 (início 5998–6465, agenda 6465–6629, check-in 6629–6685, organização, serviços 6809–7134, pedidos). Testes: notificacoes, versoes-fotos-e-cartoes, agenda-e-inicio, menu-lateral. Combinar com F a frase do check-in (tour.mjs:156).
  - **B. Erros mecânicos:** mod-studio.js, mod-treinamentos.js (sem o README), mod-criador.js (só interface). Testes: studio, treinamentos.
  - **C. Arquivos e formulários:** mod-arquivos.js, mod-formularios.js, mod-projetos.js. Concentra a maior parte das armadilhas: `-·`, `rev_pendente '—'`, título do PN, `ARQ_ESTRUTURAS`. Testes: arquivos-e-projetos, formularios.
  - **D. Seleção, agenda e presença:** mod-selecao.js, mod-agenda.js, mod-presenca.js. Testes: ps-entrevistas, okrs-e-selecao, agenda-e-inicio.
  - **E. Gestão:** mod-cofre.js, mod-gestao.js, mod-admin.js (sem `MAPA_ACESSOS`), mod-relatorios.js, mod-atividades.js, mod-documentos.js, mais mod-okrs, mod-mailer e mod-versoes, que estão quase limpos. Testes: cofre, documentos-e-eventos, emails, quadro-e-acesso, grupos-arvore.
  - **F. Páginas avulsas e e-mails:** tour.html, quiosque.html, rsvp.html, admin.html, auth/index.html (com validacao.mjs), supabase/templates/gerar.mjs (regerar com `node gerar.mjs`, avisar que os assuntos precisam mudar no painel) e supabase/functions (com os testes Deno).
  - **G (opcional, separado):** títulos "COD — título" no banco: migração nova com `CREATE OR REPLACE` das funções, mais stub-supabase.js e email.test.ts:193.
  - O README de conteúdo dos treinamentos (mod-treinamentos.js:590–840) pode ser uma subtarefa de B ou ficar de fora.

Os scripts de extração e as listagens completas estão em (scratchpad da sessão anterior, indisponível) (strs.jsonl, viol.txt, conversa.txt, conversa2.txt, paras.txt, testes.txt). Nenhum arquivo dos repositórios foi editado.



---

## Anexo I2: mapa do JS da casca

**Relatório: casca do SOMA (JS em `/home/claude/membro/index.html`, depois de `</style>` na linha 3334), para o espaço "Marca" e a reforma de linguagem.** Nenhum arquivo foi editado.

### 1. Menu hoje e onde entra "Marca"

`arvoreDoMenu()` (index.html:4847-4936) tem hoje 9 espaços para a equipe, em `arv`:
- Agenda (ícone `agenda`), Atividades (`quadro`), OKRs (`alvo`), Projetos (`projeto`), Arquivos (`pasta`).
- Studio (`studio`), só quando `podeStudio()`.
- Equipe (`users`), Treinamentos (`capelo`), Serviços (`servicos`).
- Depois vem `gestao`: Seleção (`bandeira`) e Administração (`engrenagem`), com `divisor:'Gestão'` no primeiro deles.

Com Marca ficam dez, o limite de PADROES §1. O texto de PADROES §1 (linhas 40-45) e a tabela (19-31) precisam ser atualizados. O comentário de index.html:4909 fala em "décimo primeiro espaço".

Formato de um nó:
- `{ r, rot, ic, filhos:[…], divisor? }`.
- Cada filho é um destes:
  - `{ sub, rot, pf?, tambem? }`. `tambem` é uma regex em minúsculas que acende o subitem para outros `sub`.
  - `{ rotulo:'…' }`, que vira `.lt-rotulo`.
  - `{ sep:true }`, que vira `.lt-sep`.

`desenharMenu()` (5217-5243):
- Monta `#lt-nav` com `.lt-sec[data-r]`, `.lt-item`, `.lt-seta`, `.lt-sub` > `.lt-voo` e `.lt-filho[data-sub][data-tambem]`.
- O link é sempre `'#/' + r + '/' + sub`. **Não há suporte a subitem com URL externa.** Um subitem que leve a brand.neurodynamics.dev exige um campo novo, por exemplo `href`, nessa função.

Outras funções do menu:
- `marcarMenu(rt)` (5249-5273) marca `aria-current`, `.ativa` e `.aberta`. `alternarSecao(k)` está em 5284.
- `quadrosDoMenu()` está em 4840.
- O menu é redesenhado quando chegam os dados: `carregarGrupos` 4249, `carregarOKRsDoMenu` 4948, `carregarProjetosEArquivos` 4960, `carregarStudioConfig` 4992, `carregarTreinamentoConfig` 5031.

Testes que fixam a ordem exata dos espaços e precisam mudar:
- `testes/menu-lateral.mjs:82`
- `testes/treinamentos.mjs:75`

Os dois esperam `'Agenda|Atividades|OKRs|Projetos|Arquivos|Studio|Equipe|Treinamentos|Serviços|Seleção|Administração'`. Além disso, `menu-lateral.mjs:84` exige ícone com `innerHTML.length > 20` em todo espaço.

O tour tem cópias do menu:
- `tour.html:1356-1375` (`espacos()`)
- `tour.html:801` (`ICONS` próprio)
- `tour.html:2214` (`ETAPAS`)

### 2. Roteador

- **`ROTAS`** (4723-4748): `{ desenha:'pageX', modulo?:'x', permite?:()=>bool, espera?:()=>Promise }`.
  - Exemplo com módulo: `okrs:{ desenha:'pageOkrs', modulo:'okrs' }`.
  - Exemplo com permissão e espera: `studio:{…, permite:()=>podeStudio(), espera:()=>state.studioPronto }`.
- **`ALIAS`** (4752-4762): `nome: (sub) => [rota, sub]`. Exemplo: `pedidos: () => ['servicos','pedidos']`.
- **`ALIAS_AGENDA`** fica em 4765.
- **`route()`** (4767-4776): devolve `{r, sub, sub2}`; rota desconhecida vira `home`.
- **`render(rt)`** (4784-4817):
  1. Faz `espera` e depois `permite`; sem permissão, volta para `#/`.
  2. Chama `marcarMenu`.
  3. Se `def.modulo` existe e `window[def.desenha]` ainda não é função, mostra `.carregando` e chama `carregarModulo`. Se falhar, desenha "Não carregou".
  4. Chama `await window[def.desenha](rt.sub, rt.sub2)`.
  5. Depois: `marcarMenu(route())`, `registrarRecente`, `atualizarRodape`.
- `registrarRecente` (6129) usa `arvoreDoMenu().find(n => n.r === rt.r)` para pegar o rótulo e o ícone. Um espaço novo aparece em "Abertos por último" sem código extra, desde que o ícone exista em `ICONS` (6147 cai em `historico`).

### 3. Ícones

- `const ICONS = {…}` (3901-3983), SVG interno em traço. `ic(n, cls)` está em 3984: `stroke-width 1.7`, `fill="none"`, e devolve vazio se a chave não existe. `ibtn(icone, titulo, onclick, extra)` está em 3986.
- **Não há ícone de paleta ou marca.** Os mais próximos já têm dono:
  - `studio`: o Studio.
  - `imagem`.
  - `selo`: certificados e Declaração (6848).
  - `etiqueta`, `camadas`, `galeria`.
- mod-admin tem mapa próprio, `ICONES_ADM` e `icAdm` (mod-admin.js:40-55), mas sem paleta.
- Na marca, `DIRETRIZES.md:76` diz que não há ícones definidos pela marca. Se preciso, usar traço fino (Lucide), sinalizado como substituição.
- Sugestão: nova chave `marca` em `ICONS`, com o "palette" do Lucide:
  - `<path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.93 0 1.65-.75 1.65-1.69 0-.44-.18-.84-.44-1.13-.29-.29-.44-.65-.44-1.13a1.64 1.64 0 0 1 1.67-1.67h2c3.05 0 5.55-2.5 5.55-5.55C21.97 6.01 17.46 2 12 2z"/>`
  - Mais quatro `<circle … r="1" fill="currentColor"/>`, com o fill explícito, porque `ic()` usa `fill="none"`.
- Evitar a chave `paleta`: na casca esse nome é a busca (`#paleta`, `abrirPaleta()`, `.pl-*`).

### 4. Componentes da casca

- **`navNivel1(itens, atual, rotulo)`** (3997): gera `<nav class="nav1">`.
  - `itens` são `[chave, rótulo, href, extra]`.
  - O item atual recebe `class="on"` e `aria-current="page"`.
  - O rótulo e o `extra` não são escapados. Só o `aria-label` é.
- **`navNivel2`** (4001): igual, mas gera `<nav class="abas">`. Exemplo de uso: `abasEquipe()` em 6727.
- **`dica(texto, rotulo)`** (4010): gera `<button class="dica" data-dica>` com `ic('info')`. O balão único é `#dica-pop`, posicionado por `mostrarDica` e `esconderDica` (4015-4042), por delegação: mouseover, focusin, clique fixa, Esc fecha.
- **Avisos curtos:**
  - `toast(msg, err)` (3688): `textContent`, sem HTML, 5,2 s.
  - `falha(e, ctx)` (3591): `console.error` e toast de erro.
  - `copiar(texto)` (3605): só texto puro.
  - `motivoRPC(data, error, padrao)` com `MOTIVO_RPC` (3636-3647).
- **Modal:**
  - `abreModal(html, tamanho, persistente)` (5971): `tamanho` aceita `true`, `'largo'` ou `'imenso'`.
  - `fechaModal()` está em 5979 e `fecharPeloVeu()` em 5987.
  - `confirma(msg, rotulo)` (3596) devolve `Promise<boolean>` via `window.__cf`.
  - **Defeito:** o keydown global de 4652 chama `fechaModal()` no Esc antes do handler de 5994. Por isso o Esc fecha também modal persistente, como `modalPreferenciaNotif` (5613), sem o aviso.

### 5. Papéis e grupos

- **Perfil:** `state.perfil` vem de `perfis` com `id,nome,email,papel,registro` (abrirPortal, 4664). `state` em si está declarado em 3691.
- **Papéis** (4232-4236):
  - `can()`: admin ou pessoal.
  - `podeQuadro()` é o mesmo que `can()`.
  - `podeSelecao()`: admin, pessoal ou selecao.
  - `PAPEIS = {admin, pessoal, selecao, leitura}`.
- **Regras derivadas:**
  - `docGestor()` (4980): admin ou grupo com `chave='pmo'`.
  - `estouEmAlgum(ids)` (5019).
  - `podeAprovarStudio` e `podeStudio` (5024-5025).
  - `gereTreinamentos` (5036).
- **Grupos:**
  - `state.grupos` vem de `carregarGrupos()` (4249): `COLUNAS_GRUPO` (`id,nome,prefixo,cor,ativo,reservado,ordem,chave`) mais `pai_id,quadro,responsaveis`. Só os ativos.
  - Funções: `grupoPorNome`, `grupoPorId` (4256-4257); `gruposAcima(g)` (4260); `gruposEfetivos(m)` (4266, um Set de nomes com os herdados); `viaDoGrupo(m, nome)` (4273).
  - `membrosDoGrupo(g)` (6483) filtra status Ativo e "Em pausa / avaliação" com `gruposEfetivos`. `gruposDaEquipe()` está em 6486.
- **Membros:** `state.membros` vem de `membros` com `registro,nome,cargo,departamento,status,grupos,gestor_registro,foto_url,email_nro,email_pessoal,telefone` (4665), lido por todos.
- **A própria pessoa:** `state.membros.find(m => m.registro === state.perfil?.registro)`. O padrão aparece em 3765, 4841, 5020 e 6042.

### 6. Busca e carregamento

- **`registrarBusca(f)`** (4420): substitui pela chave `fonte` dentro de `FONTES_BUSCA` (4419).
  - Itens de resultado: `{titulo, sub, href, codigo?, acao?}`.
  - **`peso` é ignorado:** `buscarNaPaleta` (5414) só corta em 8 itens, na ordem recebida.
  - `filtrarSimples(lista, termo, max)` está em 5446.
  - Fontes da própria casca: `pessoas`, `treinamentos`, `agenda` (5479-5506).
- **`acoesDaCasca()`** (4428-4496): as ações e telas que aparecem antes de o módulo carregar. A "Assinatura de e-mail" deve entrar aqui.
- **Carregamento:**
  - `carregarScript(src)` (4389) guarda em cache e não usa async.
  - `carregarModulo = nome => carregarScript(`mod-${nome}.js?v=${VERSAO}`)` (4403). `VERSAO` está em 3574.
  - `carregarLib = carregarScript` (4404).
  - `precisaDocNRO()` (4410) carrega `doc-nro.js`.
- **Módulo carregado por dentro da casca** (sem `modulo` em `ROTAS`):
  - `pageServicos` com `SERVICOS_MODULO` (6815-6835).
  - `pageEquipe` com `carregarModulo('presenca')` e `'gestao'` (6698-6722).

### 7. Início e links úteis

**`pageHome()`** (6006-6033) monta:
- `#sec-board`: avisos de `portal_avisos`, por `carregarBoard` (6221).
- `#sec-pend`: `carregarPendenciasInicio` (6039), que mostra foto ausente (`temFoto`), `eventos_ext_pendentes` e `cofre_pendencias`.
- `#sec-treinos`: `carregarTreinamentosResumo` (6072).
- `#card-semana`: `carregarSemana`.
- `#card-placar`: `carregarPlacarInicio`.
- `#card-tarefas`: `carregarTarefasInicio`.
- Na coluna `aside.ini-lado`: `#card-links` (`carregarLinksInicio`, 6105) e `#card-recentes` (`desenharRecentes`, 6142).
- O estado fica em `const inicio` (6005).

**Links úteis:**
- A fonte real é a tabela `portal_links` (db/v29_presenca_e_inicio.sql:207-234): `titulo, url, descricao, grupo, ordem, ativo`.
  - Há um CHECK com `url ~* '^(https?://|#/)'`.
  - Escrita só por admin e pessoal.
  - A semente inclui 'Brand guidelines' em v29:230.
- Quem edita: Administração › Links úteis, em `admCarregarLinks` (mod-admin.js:142-197). O painel está em `PAINEIS` (index.html:4286).
- **`LINKS_PADRAO`** (6098-6103, link brand em 6100) é só reserva, usado se a tabela der erro.
- `linkSeguro` (6104) aceita `#/`. Link interno sai sem `target` e com `ic('chevron')`; link externo sai com `ic('externo')` (6114-6116).
- Para apontar o card para `#/marca` é preciso mudar `LINKS_PADRAO` **e** os dados: um `update portal_links` numa migração, ou pelo painel.

**Todas as ocorrências de brand.neurodynamics.dev:**
- index.html:6100
- db/v29:230
- mod-studio.js:954: botão "Brand guidelines" em Studio › Configurações › Recursos. `studio_recursos` também tem o tipo `marca:'Marca e logos'` (mod-studio.js:945).
- tour.html:707 (rodapé), 1894 e 1898 (etapa Studio, para quem não é dos grupos), 2183 e 2188.
- **tour.html:2183 está quebrado:** usa `https://brand.neurodynamics.dev/#assinaturas`. A âncora não está em `ABAS` (brand/index.html:1154); `ativarAba` (1169) cai em "cores". O certo é `#aplicacoes/assinaturas`.
- Âncoras do brand: `#cores/{principal,secundario,funcional,uso}`, `#tipografia`, `#elementos/{marcas,superficies,bandas,forma}`, `#interfaces/{acoes,formularios,navegacao,dados,feedback,widgets}`, `#galeria/{galeria,estudio}`, `#aplicacoes/{documentos,apresentacoes,digital,assinaturas,downloads}`.

### 8. Passo a passo de um módulo novo (mod-marca.js)

1. Criar `/home/claude/membro/mod-marca.js`, script clássico.
   - Abrir com o cabeçalho de comentário padrão: "MÓDULO · MARCA", as rotas, a migração e a linha "Depende da casca para: …". Modelo em mod-cofre.js:1-30.
   - Declarar um objeto de estado só, por exemplo `const marca = {…}`. Não há colisão: a casca só tem `marcados`, `marcarMenu`, `marcarPaleta` e `marcarTudoLido`.
   - Não pendurar nada em `state`.
2. Definir `async function pageMarca(sub, sub2)`.
   - Seções com `navNivel1([...['', 'Manual', '#/marca'], ['assinatura', 'Assinatura de e-mail', '#/marca/assinatura'] …], sub || '', 'Marca')`.
   - Estados de tela: `.carregando` e `.spin`, `.vazio`, `.aviso-box err`.
3. No fim do arquivo, `registrarBusca({ fonte:'marca', rotulo:'Marca', buscar: t => filtrarSimples([...], t, 6) })`.
4. Biblioteca pesada só dentro da função, com `carregarLib(url)`.
5. Na casca:
   - `ROTAS`: `marca:{ desenha:'pageMarca', modulo:'marca' }`, sem `permite` porque é para todos.
   - O nó `{ r:'marca', rot:'Marca', ic:'marca', filhos:[{sub:'',rot:'…'}, {sub:'assinatura',rot:'Assinatura de e-mail'}, …] }` dentro de `arv`.
   - A chave `marca` em `ICONS`.
   - As entradas em `acoesDaCasca()`.
   - Opcionalmente, em `ALIAS`: `brand:()=>['marca',null]` e `assinatura:()=>['marca','assinatura']`.
6. Código compartilhado sobe para a casca. `copiarHTML(html)` mora em mod-mailer.js:305, com o toast fixo 'E-mail copiado.'. A Marca precisa dele, e PADROES §4 proíbe depender de outro módulo: mover para a casca com a mensagem como parâmetro.
7. Fechamento:
   - Subir `VERSAO` (3574), a entrada de `NOTAS_VERSAO` (mod-versoes.js) e o item `mod-marca.js` na tabela de arquivos do README (README.md:990-1011).
   - Atualizar PADROES §1 e §2.
   - Testes: os dois de ordem do menu; `testes/colisoes.mjs` já pega `mod-*.js` sozinho; tabela nova pede dados no `DADOS` de `testes/stub-supabase.js`.
   - Atualizar o tour (seção 1).

### 9. Dados para a assinatura de e-mail

| Dado | Origem | Observação |
|---|---|---|
| nome | `membros.nome`, ou `perfis.nome` | já em `state` |
| cargo | `membros.cargo` | já em `state` |
| departamento | `membros.departamento` | já em `state` |
| e-mail | `membros.email_nro`, depois `email_pessoal`, depois `perfis.email` | já em `state` |
| telefone | `membros.telefone` | já em `state` |
| foto | `membros.foto_url`, ou `FOTOS_BASE` (3576) mais o registro | já em `state` |
| grupos | `gruposEfetivos(eu)` | calculado na casca |
| logo | `LOGO_URL` (3575) | o mesmo da assinatura do brand (brand/index.html:1131) |
| redes da equipe | `linkDaConta(k)` (5008), sobre `state.studioCfg` | `studio_config`, legível por todo autenticado (db/v23_studio.sql:167) |

- **Pronomes não existem** em nenhuma tabela nem arquivo do membro.
  - No brand o campo `#sig-pron` é manual e não é gravado (brand/index.html:1976).
  - Para gravar: migração com uma coluna como `membros.pronomes`, mais uma RPC de autoedição no modelo de `membro_foto_definir` (db/2.17.0_notas_fotos_e_cartoes.sql:378). A ficha só é escrita pela gestão (mod-gestao.js:593).
- **`dados_pessoais`** tem `genero`, `lattes`, `instagram`, `github` e outros (mod-gestao.js:252-261). Só admin e pessoal leem (mod-gestao.js:436), então não serve para a pessoa sem uma RPC.
- **O gerador do brand** pode ser portado:
  - `sigAbrir` (brand/index.html:1950-1971) lê `perfis` (nome, email, registro) e `membros` (nome, cargo, email_nro, email_pessoal, telefone).
  - `SIG_ORG` (1872-1879) tem saudação, unidade, endereço, site e disclaimer.
  - `sigEmail` e `sigReply` (1904-1933) montam o HTML; `sigDdi` (1892) põe o +55.
  - A cópia rica é `sigCopiar` (1989).
  - Hoje o brand pede um segundo login, porque é outra origem.

### 10. URLs limpas sem .html

O GitHub Pages já serve `x.html` em `/x`.

- **tour.html:**
  - A casca já usa o endereço limpo: `href="tour"` (index.html:3528) e `tour#celular` (5845). README.md:218 cita `/tour`.
  - No próprio tour, `URL_VOLTA()` (tour.html:745) usa `location.pathname`, e o QR (2135) depende dele.
  - `testes/tour.mjs:88` espera `…/tour.html`.
  - O redirect do Supabase é `/**` (README.md:254), então `/tour` passa.
- **rsvp.html:**
  - Gerado em `supabase/functions/notificar-email/index.ts:496` como `${PORTAL}/rsvp.html?t=…&r=…`. Comentário em :472.
  - Testes em `email.test.ts:279` e `:290`.
  - Documentação: README.md:27, :993, :1185; db/LEIAME.md:256; notificar-email/README.md:467.
  - E-mails já enviados continuam abrindo, porque `rsvp.html` segue servido.
- **quiosque.html:** nenhum link no portal; abre direto na tela da entrada (README.md:1009). Pode virar `/quiosque`. O alvo `APP_URL` (233 e 272) já é limpo.
- **admin.html:** só encaminha para `./#/admin` (admin.html:40-41). `/admin` já funciona e o arquivo deve ficar.
- **auth:** domínio próprio com `/?c=` (doc-nro.js:39 `URL_VALIDACAO`, mod-documentos.js:73), já limpo. A pasta `auth/` também é servida em `membro…/auth/`.
- **Sufixo `/index.html` vazando:** `URL_APP()` (4507) e outros pontos usam `location.pathname`. Quem abriu o portal por `/index.html` leva o sufixo para:
  - o signup e o reset do Supabase (4528, 4547, mod-admin.js:941 e 948);
  - o QR da folha de check-in (mod-presenca.js:171, passando por doc-nro.js:900);
  - o link copiado de cartão (mod-atividades.js:1608).
  - Correção: tirar `index.html` do pathname.
- **Fora deste repositório:** mod-selecao.js:1081, 1208, 1210, 1229, 1231 apontam para `selecao.neurodynamics.dev/dinamica-painel.html` e `/dinamica.html`.
- **Testes locais:** usam `python3 -m http.server 8765` (testes/LEIAME.md:86), que não resolve caminho sem extensão. Os testes abrem `index.html`, `tour.html` e `auth/index.html`.

### 11. Reforma de linguagem: textos da casca fora do §9

Travessão nos textos de tela: só como campo vazio (6756, 6788, 7166, 7202). Ponto médio: nenhum.

**Conversa ou explicação demais:**
- 3365 e 3380: dicas do login.
- 3680-3683 (`mostrarAvisoSemVinculo`): "Você consegue navegar…", "Peça ao…".
- 4530-4532 e 4540: "Enviamos um link…", "volte aqui e entre".
- 4549: "Não deu para enviar agora", "tente de novo".
- 4550-4551.
- 4625-4626: o erro de login explica o óbvio.
- 3511: "As lidas saem sozinhas em 30 dias." Vai para `dica`.
- **5540:** o sino vazio é um parágrafo. Deve virar uma linha mais `dica`.
- 5607 e 5842-5848: textos do push.
- 5868.
- 5688-5736 (`testarEmail`): "Não consegui", "Mandando sair", "Nada foi perdido".
- 5642-5676 (`motivoDaFuncao`).
- 6050-6051: pendência da foto.
- 6082: "todos os seus →".

**Pergunta:**
- 6227: "A migração … já foi aplicada?"
- 5715: o mesmo.

**Check-in** (6656-6670): "Algo falhou", "Bem-vindo, X!", "Primeira visita registrada!", "Você já está aqui", "Fale com o Depto.".

**Serviços:**
- 6913-6914, 7120, 7145: "Sua conta ainda não está vinculada… Fale com…". O texto padrão é `MOTIVO_RPC.sem_registro`.
- 7082: "Diga qual acesso você precisa." Deve ser "Informe o acesso.".
- 7084 e 7098: "Conte brevemente o motivo.".
- 4798-4807: erros do `render`, longos.

**Também:**
- 6251: o 'Saiba mais' padrão dos avisos.
- Subtítulos de `acoesDaCasca` como "Guardar uma ideia, nem que seja uma frase" (4477).



---

## Anexo I3: mapa de Arquivos para o módulo Marca

### Arquivos para o módulo Marca: modelo de dados, download, permissão e stub

### Resumo

- O arquivo de um item mora em `#/arquivos/<CÓDIGO>`, por exemplo `#/arquivos/NRO-MKT-006`.
- O download usa uma URL assinada do bucket privado `arquivos`. A política do Storage cai em `doc_pode_ler(arquivo_id)`.
- `doc_pode_ler` pode ser chamada do front: há `grant execute ... to authenticated` em v20:615, e `mod-arquivos.js:430` já a usa.
- Nem `doc_arquivos` nem `doc_rol` têm coluna de permissão.
- Para o cadeado, a recomendação é chamar `sb.rpc('doc_pode_ler', { p_arquivo })` para cada item. O stub já responde a essa chamada.

### 1. Modelo de dados (db/v20_projetos_arquivos.sql, salvo indicação)

**Código.** `doc_codigo(prefixo, sn, pn)` (v20:489-492) monta `NRO-XXX-YYY[-Z]`. A revisão fica fora do código. Prefixo e SN nunca mudam, porque formam o código (v20:702-705; PADROES.md:278-282).

**Emissores.** `doc_emissores` (v20:291-297) tem:
- `prefixo` com 3 letras, como chave;
- `nome`, `ordem`;
- `grupo_id`: o grupo dono, cujos membros criam PN e enviam versões.

Na produção, a v21:65-73 cria PUB, PES, PRO, CLI, REL, DIR e MKT. Só PES vem com grupo. MKT, "Departamento de Marketing", fica com `grupo_id` nulo.

**Séries (SN).** Tabela `doc_series` (v20:300-319), com `unique(prefixo, sn)`. Colunas:
- `id`, `prefixo`, `sn` (de 1 a 999), `titulo`;
- `tipo`: `documento` ou `registro`;
- `subtipo`, com check em v20:306-308: politica, procedimento, manual, template, formulario, planilha, checklist, relatorio, ata, inventario, declaracao, outro;
- `classe`: `publico`, `controlado` ou `confidencial`, com padrão `controlado`;
- `multiplo`: se a série tem PN;
- `grupo_revisor`, `grupos_leitura integer[]`, `descricao`.

A v25:113 acrescenta `pn_origem` e o gatilho `tg_doc_pn_fora_do_rol` (v25:118-132), que recusa PN novo quando `pn_origem` está preenchido. A v26:53 acrescenta `formulario jsonb`.

**Estrutura da série.** `doc_estrutura(tipo, multiplo, subtipo)` (v22:67-75) dá quatro casos:

| Estrutura | Como se define |
|---|---|
| `unico` | documento sem PN |
| `documentos` | template, e cada PN é um documento |
| `registros` | template, e cada PN é um registro |
| `avulso` | sem PN e com `subtipo='template'`, como o NRO-PUB-002 |

As frases ficam em `doc_estrutura_frase` (v22:77-85). No front, o espelho é `ARQ_ESTRUTURAS` e `arqEstrutura` (mod-arquivos.js:65-80). Mudar a estrutura gera um evento `estrutura` pelo gatilho `tg_doc_serie_estrutura` (v22:101-124).

**Arquivos (cabeça e PNs).** Tabela `doc_arquivos` (v20:331-353). Colunas:
- `id`, `serie_id`, `pn` (nulo na cabeça), `codigo` (único);
- `titulo`: o complemento do título da série;
- `projeto_id`, `template_id`, `template_rev`;
- `status`: rascunho, em_revisao, ativo ou obsoleto;
- `rev_vigente`, `rev_pendente` (vale `'—'` quando um registro está pendente);
- `autor`, `autor_nome`, `alterado_*`, `obsoleto_*`.

O índice `doc_arquivos_cabeca_ix` (v20:354) garante uma cabeça por série. Toda série nasce com a cabeça, criada por `doc_serie_salvar` (v20:751-755).

**Templates de série.** A cabeça de uma série com PN é o template. Cada PN nasce com `template_id` apontando para a cabeça e `template_rev` igual à `rev_vigente` dela (`doc_arquivo_criar`, v20:827-832). Qualquer arquivo pode declarar `template_id` apontando para um arquivo de `natureza='template'` (`doc_arquivo_editar`, v20:849-853). Um registro não revisa: a "Rev." dele é a `template_rev`.

**Revisões.** Tabela `doc_revisoes` (v20:372-393). Colunas:
- `rev`: A, B, …, Z, AA…, calculada por `doc_proxima_rev` (v20:871-885); é nula em registro;
- `estado`: pendente, aprovada, devolvida, substituida ou cancelada;
- `caminho`, `nome_original`, `mime`, `tamanho`, `mudancas`, `relacionados`, `template_rev`;
- `enviado_*`, `revisor_*`, `parecer`, `importada`.

Só pode haver uma pendente por arquivo (índice `doc_rev_uma_pendente_ix`, v20:394). A v26:54 acrescenta `formulario`.

**Outras tabelas:**
- `doc_relacoes`: pai e filho, sem ciclo (v20:408-435);
- `doc_padrao_projeto` (v20:439-457);
- `doc_eventos` (v20:463-472);
- `doc_formulario_rascunhos` (v26:63-75);
- `doc_emissao_config` (v25:60-75), com `serie_vinculo` e `serie_participacao`. É um precedente de "uma funcionalidade aponta para uma série por uuid".

**View `doc_rol`.** Fica em v20:668-696, com `security_invoker`. Traz uma linha por arquivo com:
- `natureza`: `template` quando `pn` é nulo e a série é `multiplo` ou tem `subtipo='template'`; senão o tipo da série;
- `titulo`: concatena `' — '` com o complemento;
- `serie_titulo`, `complemento`, `classe`, `grupo_revisor`, `grupos_leitura`, `n_pns`, entre outras.

Ela traz os dados de entrada da regra, mas nenhuma coluna `pode_ler`.

**Quem lê o conteúdo, por classe** (`doc_pode_ler`, v20:495-522):

| Classe | Quem lê |
|---|---|
| todas | PMO e admin (`doc_gestor()`, v20:111-116) |
| `publico` | todos |
| `controlado` | o autor do arquivo, o grupo revisor, os `grupos_leitura`, o grupo do emissor e a equipe do projeto |
| `confidencial` | o autor do arquivo, o grupo revisor e os `grupos_leitura` |

A pertença é a efetiva, via `esta_no_grupo`: quem está num subgrupo conta.

### 2. Rota e URL

- `pageArquivos(sub, sub2)` (mod-arquivos.js:143-159). Se `sub` em maiúsculas casa com `RE_CODIGO = /^NRO-[A-Z]{3}-\d{3}(-\d+)?$/` (l.86), ela chama `arqTela(codigo, sub2)` (l.412).
- O único `sub2` aceito é `escrever` (l.457). Não existe modo "baixar".
- O redirecionamento da galeria é `location.hash = '#/arquivos/' + codigo`.
- A rota está registrada em ROTAS (index.html:4734).

### 3. Como o download acontece

- `arqLadoHTML` (mod-arquivos.js:711) só mostra "Baixar a Rev. X" quando há versão vigente `v` com `v.caminho`, e `t.ler` é verdadeiro. `t.ler` vem de `sb.rpc('doc_pode_ler', …)` em l.430.
- Se a revisão aprovada não tem arquivo, por ter sido importada da planilha, a tela diz isso (l.712-714).
- `arqBaixar(id)` (l.779-791) chama `sb.storage.from('arquivos').createSignedUrl(v.caminho, 120, { download: arqNomeBaixado(t.r, v) })`. O nome segue o NRO-PUB-002 (l.775-778).
- Essa função depende de `arq.tela` e não serve fora da tela do arquivo.
- O upload é `arqSubir` (l.866-877), no caminho `<arquivo_id>/<uuid>/<nome seguro>`.
- **Bucket.** `arquivos` é privado, com limite de 50 MB (v20:1258-1260). A política `doc_obj_select` (v20:1265-1267) usa `doc_pode_baixar_objeto(name)` (v20:1226-1246):
  - revisão aprovada ou substituída: `doc_pode_ler(arquivo_id)`;
  - pendente: quem enviou, o gestor e o grupo revisor;
  - devolvida: `doc_pode_editar`.
- **RLS das tabelas.** `doc_revisoes` (`drev_select`, v20:647-649) e `doc_eventos` usam `doc_pode_ler(arquivo_id)`. `doc_arquivos`, `doc_series` e `doc_emissores` são lidas por todos, com `using (true)`.

### 4. Como a tela decide se a pessoa lê o conteúdo

- **RPC.** `doc_pode_ler(p_arquivo uuid) returns boolean` é `security definer` e tem `grant` para `authenticated` (v20:609, 615).
- O mesmo vale para `doc_pode_editar`, `doc_pode_criar`, `doc_pode_revisar` e `doc_gestor` (v20:616-619).
- `arqTela` chama `doc_pode_ler` e `doc_pode_editar` em paralelo (mod-arquivos.js:425-432) e guarda o resultado em `t.ler` e `t.editar` (l.437).
- **Sem permissão:**
  - `doc_revisoes` volta vazia pela RLS;
  - não há botão Baixar;
  - o registro de alterações vira um texto explicativo (l.629-633);
  - os metadados continuam visíveis.
- **Duplicações que já existem no front.** `arqPossoCriar` (l.1075-1081) refaz `doc_pode_criar` com `gruposEfetivos`, e `arqPossoRevisar` (l.134-140) refaz `doc_pode_revisar`. Não convém repetir esse padrão para leitura.

### 5. O que é #/arquivos/templates

- `arqTemplates()` (mod-arquivos.js:396-407) lista as linhas de `arq.rol` com `natureza === 'template'`.
- Isso abrange as cabeças de série com PN e os avulsos, como o NRO-PUB-002.
- Cada linha mostra quantos arquivos têm `template_id` igual a ela e quantos usam uma revisão anterior (`template_rev !== rev_vigente`).
- É o controle de moldes do NRO-PUB-001, não uma galeria de marca.
- Uma série de marca criada como `unico` com `subtipo='template'` vira avulso e aparece ali automaticamente. Com `subtipo='outro'`, não aparece.

### 6. Como o módulo Marca deve achar o arquivo de cada item

**Leitura dos metadados.** Ler `doc_rol` direto, sem carregar `mod-arquivos` (PADROES §4, l.237-243):
```js
sb.from('doc_rol').select('id,codigo,serie_titulo,classe,status,rev_vigente,natureza').in('codigo', CODIGOS)
```
O stub suporta `.in` (stub-supabase.js, builder l.784).

**Opção A, sem migração.** Um mapa fixo em `mod-marca.js`, de item para código, usando o código no link `#/arquivos/<código>`. O código é estável por desenho. Há precedente em mod-cofre.js:699 (`.eq('codigo','NRO-DIR-003')`).
- Problema: as séries ainda não existem.
- Criada pela tela, a série recebe o próximo SN livre (v20:739-740). Na produção, MKT vai até o 005 (v21:160-164).
- Ou a migração cria as séries com SN explícito, ou o código só se conhece depois que o PMO criar.

**Opção B, recomendada se houver migração.** Seguir o precedente de `doc_emissao_config.serie_vinculo/serie_participacao` (v25:70-71):
- uma tabela como `marca_itens(chave text pk, grupo 'template'|'controlado', serie_id uuid references doc_series, ordem)`;
- `select` para `authenticated` e escrita só para `doc_gestor()`;
- a galeria junta com `doc_rol` por `serie_id` e `pn is null`.

Assim o front não fixa SN, e o PMO religa um item sem deploy.

**Como criar as séries.** Use `doc_serie_salvar`, que só o gestor executa (v20:706-793).
- Os subtipos atuais não têm apresentação, carta, memorando, certificado, convite, selo nem crachá.
- O caminho sem mudança de schema é usar `template` (avulso) ou `outro`.
- Um subtipo novo exige mexer em três lugares: o check em v20:306-308, `ARQ_SUBTIPOS` (mod-arquivos.js:43-47) e `PARA_PLANILHA.subtipo` (l.1418-1420).

### 7. Como mostrar o cadeado sem duplicar a regra

**Recomendado.** Chamar `Promise.all(itens.map(r => sb.rpc('doc_pode_ler', { p_arquivo: r.id })))`, exatamente como mod-arquivos.js:430. São 8 chamadas leves e a regra continua com um dono só.
- Cadeado com `ic('cadeado')` (index.html:3920) quando o retorno for `false`.
- O tile continua clicável e leva à página, em vez de sumir (PADROES §1 "Degradar, não desaparecer", l.80-83; §7 l.402-404).
- Só faz sentido falar em baixar quando há versão em vigor (`status==='ativo'` e `rev_vigente`). Sem isso, o tile mostra "sem versão em vigor".
- Não calcular a permissão com `grupos_leitura` e `gruposEfetivos`: isso criaria um segundo dono da regra.

**Alternativa em uma consulta, sem migração.** Usar `sb.from('doc_revisoes').select('arquivo_id,caminho').eq('estado','aprovada').in('arquivo_id', ids)`. A RLS `drev_select` aplica `doc_pode_ler`, então a linha ausente indica falta de permissão. Duas desvantagens:
- a ausência é ambígua com "sem versão aprovada";
- o stub não aplica RLS e devolve todas as linhas, então o teste nunca mostraria cadeado.

**Alternativa com migração.**
- Acrescentar `public.doc_pode_ler(a.id) as pode_ler` à `doc_rol`. Funciona porque a view é `security_invoker` e a função lê `portal_registro_atual()` de quem chama. Arquivos ganharia isso de graça, mas cada `select('*')` de `arqCarregar` (l.107) passaria a calcular a regra por linha.
- Ou criar uma RPC em lote, `doc_pode_ler_varios(uuid[])`, que só chama `doc_pode_ler`.
- Nos dois casos, o stub precisa acompanhar.

**Mapeamento de classes.** "Só grupos específicos baixam" corresponde a `confidencial` com `grupos_leitura` igual aos grupos permitidos. Mesmo assim, também leem o grupo revisor, o autor da cabeça (quem criou a série) e PMO e admin. A classe `controlado` também abre para o grupo do emissor e a equipe do projeto. Os templates de uso geral ficam `publico`.

### 8. O que o stub dos testes tem (testes/stub-supabase.js)

**Emissores** (l.299-303):
- PUB, PES (grupo 3) e PRO.
- DIR só com `window.__teste.dir` (l.618-637).
- Não há MKT.

**Séries** (l.304-315): `s-pub2` (avulso), `s-pub3`, `s-pes4`, `s-pes5`, `s-pes7`, `s-pes14`, `s-pro1`, `s-pro3` e `s-pro4`. Com `dir` entram `s-dir4` e `s-dir6`, que têm `pn_origem`. A série `s-pes5` é confidencial, com `grupo_revisor:6` e `grupos_leitura:[3]`. `s-pub3` e `s-pro3` ganham `formulario` em l.674-675.

**doc_rol** (l.316-371): 12 linhas.

| Classe | Linhas |
|---|---|
| `publico` | `a-pub2`, `a-pub3`, `a-pub3-1`, `a-pes4`, `a-pes7`, `a-pes14` |
| `confidencial` | `a-pes5` (sem revisão) |
| `controlado` | `a-pro1`, `a-pro1-1`, `a-pro3`, `a-pro3-1`, `a-pro4` |

`doc_arquivos` é derivado de `doc_rol` em l.773-774. Por isso, linhas acrescentadas a `doc_rol` antes desse ponto entram nele.

**Outras tabelas:**
- `doc_padrao_projeto`: 3 linhas (l.372-376);
- `doc_eventos`: 2;
- `doc_relacoes`: 1;
- `doc_formulario_rascunhos`: vazio;
- `doc_revisoes` (l.377-405): 11 linhas, com `caminho` exceto `r-pub2-a`, que é importada. Entre elas, `r-pes7-c` está pendente.

**RPCs** (l.1124-1240):

| RPC | Comportamento no stub |
|---|---|
| `doc_pode_ler` | `true` se admin ou `classe==='publico'`; ignora grupos |
| `doc_pode_editar` | `true` se admin |
| `doc_pode_revisar` | `true` se admin, revisão pendente e `enviado_por !== 4` |
| `doc_revisao_enviar`, `doc_revisao_decidir`, `doc_arquivo_criar`, `doc_formulario_*` | simuladas |
| outras de escrita | devolvem ok e ficam anotadas em `window.__rpcs` |

**Storage** (l.1997-2010): `upload` anota em `__uploads`; `createSignedUrl` anota em `__baixados` e devolve `javascript:void(0)`; `remove` anota em `__removidos`.

**Papel e PMO.**
- O perfil é admin (l.4); os testes trocam com `stubDe(papel)` (arquivos-e-projetos.mjs:27).
- Não há grupo com `chave:'pmo'`, então `docGestor()` só vale para admin.

**Falta para testar a Marca:**
- as séries e linhas de `doc_rol` dos 8 itens, com revisões aprovadas e `caminho`;
- de preferência o emissor MKT;
- para o caso "membro de grupo de leitura vê sem cadeado", o `doc_pode_ler` do stub precisa olhar `grupos_leitura` contra os grupos do membro;
- hoje qualquer não-admin fica sem acesso a tudo que não é público.

### 9. Problemas e restrições encontrados

- **Texto da tela sem permissão.** mod-arquivos.js:631-633 diz que lê o controlado quem está "no grupo do emissor, na equipe do projeto ou no grupo revisor". Omite os grupos de leitura, o que diverge de `doc_pode_ler` (v20:516) e de `ARQ_CLASSES.controlado` (l.56). Esse texto é o que a pessoa vê ao chegar pela Marca sem permissão.
- **Sem pedido de acesso.** Arquivos não tem "pedir acesso". O lado só diz quem envia versões (l.723-724) e não diz por que não há Baixar.
- **Rota `#/arquivos/marca` é engolida.** `pageArquivos` não a reconhece e a reescreve para `#/arquivos` (l.156-158).
- **Limite do menu.** O primeiro nível está no limite: "o próximo precisa caber dentro de um que já existe" (PADROES.md:40-45). Uma rota própria precisa de entrada em `ROTAS` (index.html:4723) e em `arvoreDoMenu` (index.html:4873, o bloco de Arquivos).
- **Travessão no título.** `doc_rol.titulo` concatena com `' — '` (v20:671). Para rótulos sem travessão (PADROES §9), use `serie_titulo` e `complemento`.
- **Certificado não é emissão.** O "certificado" da marca é o modelo em branco. Não é o `CERT-…` de `treinamento_conclusoes` nem `doc_emitidos`, cujo `tipo` só aceita `vinculo` ou `participacao` (v25:358).

### 10. Insumos do repositório brand para a galeria

**Arquivos de origem** (DIRETRIZES.md:84-108):

| Item | Arquivo |
|---|---|
| relatório | `templates/formal-report/FormalReport.html` |
| apresentação | `templates/formal-deck/` e `templates/brand-deck/` |
| carta e memorando | `templates/letterhead/Letterhead.html` (A4, carta e memo) |
| certificado | `templates/certificate/` e `templates/certificate-brand/` |
| convite | `templates/invitation/` |
| selo | `assets/seal-axon.png` e `assets/seal-laurel.svg` |
| crachá | `templates/badges/Badges.html` |

O próprio NRO-PUB-002 está em `/home/claude/brand/assets/NRO-PUB-002-template-documentos-e-registros.docx`.

**Componentes da casca:**
- galeria: `.gal` e `.tile` (index.html:1560-1569), já usados em mod-admin.js:127 e mod-relatorios.js:92;
- selo de classe: `.arq-cls.controlado` e `.arq-cls.confidencial` (index.html:1976-1979).



---

## Anexo I4: banco e testes

Nenhum arquivo dos dois repositórios foi editado. A bateria de navegador rodou numa cópia em `(scratchpad da sessão anterior, indisponível)/membro`, com `npm install` feito lá. Os testes de banco rodaram no cluster local 16/main, lendo os arquivos direto de `/home/claude/membro/db`. No fim apaguei os bancos e os papéis criados e parei o cluster de novo. `git status` de `/home/claude/membro` está limpo. As duas baterias passaram inteiras na árvore atual (VERSAO 2.17.1).

### 1. Banco: convenções de migração (modelo para `db/2.18.0_<assunto>.sql`)

**Nome e registro**
- Desde a 2.17.0 a migração leva a versão no nome (`db/LEIAME.md:20-25`).
- O arquivo termina inserindo a própria linha em `migracoes`, com `on conflict (id) do nothing` (`db/2.17.0_notas_fotos_e_cartoes.sql:1073-1075`; modelo original em `v14_unificacao.sql:69-71`). Para esta versão: `insert into public.migracoes (id, descricao) values ('2.18.0_marca', 'SOMA 2.18.0: …') on conflict (id) do nothing;`.
- Depois vem um bloco de comentário "CONFERIR" com os selects de verificação (`2.17.0…sql:1077-1082`, `v23_studio.sql:901-914`).

**Cabeçalho**
- Bloco de comentário com "SOMA 2.18.0 — MIGRAÇÃO · NeuroDynamics", o que a migração faz, os pré-requisitos, "Idempotente." e "COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run." (`2.17.0…sql:1-40`).

**Pré-requisitos**
- Um bloco `do $$` que confere a existência de objetos e para com `raise exception using message = …, detail = …` (`v23_studio.sql:51-61`, `2.17.0…sql:42-53`).
- Para Marca, os mínimos:
  - `to_regprocedure('public.esta_no_grupo(integer,integer)')` (19.0, para `grupos_de()`);
  - se depender do Studio, `to_regprocedure('public.studio_gestor()')` (23.0);
  - se o vínculo usar `doc_arquivos`, `to_regclass('public.doc_arquivos')` (20.0).

**Tabela de configuração de uma linha** (padrão do Studio)
- Tabela com `id boolean primary key default true check (id)`, seguida de `insert … values (true) on conflict (id) do nothing`, e um `comment on table` (`v23_studio.sql:77-92`).
- Gatilho de carimbo `before update`, com `drop trigger if exists` antes do `create trigger`. Ele força `new.id := true`, `atualizado_em := now()` e `atualizado_por := studio_meu_nome()` (`v23_studio.sql:175-185`).
- Acrescentar coluna numa config de outra migração: `alter table public.studio_config add column if not exists links jsonb not null default '{}'`, guardado por `to_regclass` (`v30_emails.sql:40-42`). É a alternativa a criar `marca_config`.
- Semente idempotente: só semeia com a tabela vazia, via `where not exists (select 1 from …)` (`v23_studio.sql:845`). Outra forma é só preencher quando o campo ainda está vazio (`v23_studio.sql:96-108`).

**Vínculo item da galeria → código de arquivo**
- `doc_arquivos.codigo` é `text not null unique` e o id é `uuid` (`v20_projetos_arquivos.sql:331-353`).
- PADROES §5 (`PADROES.md:278-282`) diz que o código sem revisão (`NRO-PES-007`) é o endereço que relações e links apontam.
- Opção A: guardar o código como texto, sem FK. É o padrão "sobrevive ao fato" do `origem_id` (`PADROES.md:300-301`), e a migração não passa a depender da 20.0. A Studio também não depende dela (`db/LEIAME.md:364`).
- Opção B: `arquivo_id uuid references public.doc_arquivos(id) on delete set null`, o que exige a 20.0 no pré-requisito.
- Quem lê o conteúdo do arquivo continua sendo `doc_pode_ler()` (`v20…sql:495`). Os metadados são de toda a equipe (`PADROES.md:418-431`).

**Funções de permissão**
- `language sql stable security definer set search_path = public`, sobre `papel_atual()`, `portal_registro_atual()` e `grupos_de(registro) && <int[] da config>`. A pertença é efetiva, com subgrupos (`v23_studio.sql:115-152`).
- Depois, `revoke execute … from public, anon` e `grant execute … to authenticated` (`v23_studio.sql:154-160`).

**RLS**
- Sempre na sequência `alter table … enable row level security` → `drop policy if exists X on …` → `create policy X … to authenticated using (…)` → `grant select[, insert, update, delete] … to authenticated`.
- Estilo 1, config editável direto da tela: política `for update using (gestor()) with check (gestor())` mais `grant select, update` (`v23_studio.sql:162-173`). A tela trata `data` vazio no `update().eq('id', true).select()` como sem permissão (`mod-studio.js:793-794`).
- Estilo 2, tabela com escrita por política e "em nome de quem cadastrou": `with check (… and criado_por is not distinct from portal_registro_atual())`, com update e delete para o dono ou a gestão (`studio_recursos`, `v23_studio.sql:729-757`).
- Estilo 3, escrita só por funções: a tabela não tem política de escrita (`2.17.0…sql:105-114`). As funções são `security definer` e devolvem `jsonb` com `status` (`ok`, `sem_permissao`, `invalido` mais `campo`, `nao_encontrado`, `sem_registro`) (`2.17.0…sql:142-188`).
- O grant das funções `(jsonb)` é feito em laço, guardado pela existência de `anon` (`2.17.0…sql:319-328`).
- Os status viram texto na casca por `MOTIVO_RPC` e `motivoRPC()` (`index.html:3636-3647`). Status novo precisa de texto próprio.

**View**
- Sempre `with (security_invoker = true)` (`2.17.0…sql:122-137`). Sem isso a view fura a RLS (`PADROES.md:332-333`).

**Erros de regra em gatilho**
- `raise exception using errcode = 'P0001', message = 'codigo_curto', detail = 'frase'` (`v23_studio.sql:274-275`).

**Auditoria e Storage, ambos condicionais**
- Auditoria só se `to_regprocedure('public.fn_auditoria()')` existir (`v23_studio.sql:882-892`).
- Bucket só se `to_regclass('storage.buckets')` existir, com as políticas criadas por `execute` (`v23_studio.sql:853-876`).

**Documentação a atualizar junto (`db/LEIAME.md`)**
- `:9-10`, a ordem de aplicação;
- a árvore em `:50-69`;
- a tabela em `:73-93`;
- um parágrafo "A 2.18.0 …" com o "Confira:", como em `:281-310`;
- o bloco de comandos de teste com a contagem de asserções, como em `:443-451`.

### 2. Testes de banco: como rodam

**Não há runner.** Não existe script nem CI: só os blocos de comando de `db/LEIAME.md:326-451`, um banco novo por migração (ou `createdb -T tbase`).

**Como uma falha aparece**
- Cada teste para na primeira falha: `ok()` dá `raise exception 'FALHOU: …'` e o arquivo tem `\set ON_ERROR_STOP on`.
- Sucesso é sair com código 0. Alguns arquivos terminam com `\echo '…: tudo certo'` (`v23_studio.sql:368`).
- Os comandos de preparação do LEIAME não passam `ON_ERROR_STOP`, então um erro na preparação passa rolando. Eu rodei com `-v ON_ERROR_STOP=1`.

**Neste ambiente**
- Existe o cluster 16/main parado, porta 5432, socket `/var/run/postgresql`.
- `pg_ctl` e `initdb` não estão no PATH (estão em `/usr/lib/postgresql/16/bin`); `psql` e `createdb` estão em `/usr/bin`.
- root não tem papel no Postgres e o `pg_hba` local é `peer`, então tudo roda como o usuário `postgres`:

```
pg_ctlcluster 16 main start
cd /home/claude/membro/db
P="runuser -u postgres -- psql -X -q -v ON_ERROR_STOP=1"
runuser -u postgres -- createdb t218
$P -d t218 -f testes/esqueleto.sql -f testes/esqueleto_storage.sql
$P -d t218 -f v15_atividades.sql -f v16_pessoal.sql -f v17_grupos_acesso.sql -f v18_teste_email.sql -f v19_grupos_hierarquia.sql
###   (+ -f v20_projetos_arquivos.sql se usar doc_arquivos; + -f v23_studio.sql se depender do Studio)
$P -d t218 -f testes/2.18.0_marca.sql
pg_ctlcluster 16 main stop
```

**Resultado da bateria inteira de banco**
- **12 s** no total, de 0 a 1 s por teste, tudo verde.
- Contagens de "ok": v16_comportamento 33, v17 29, v18 12, v19 48, v20 114, v21 16, v22 39, v23 89, v24 117, v25 130, v26 48, v27 91, v28 62, v29 23, v29b 4, v30 27, v31 36, v32 113, 2.17.0 106.
- O LEIAME diz 90 para a v23. A diferença vem de `v23_studio.sql:333-336`, onde só um de dois `ok` alternativos executa.
- `v16_rls.sql` não tem asserções: é saída para ler. Rodado como manda o LEIAME (`PGPASSWORD=x psql -h localhost -U app -d t16 -f testes/v16_rls.sql`), falha com `permission denied for view atividades_quadro`. Só funciona depois de `grant select on all tables in schema public to authenticated` (e execute nas funções), passo que o LEIAME não menciona.

**Esqueletos**
- `testes/esqueleto.sql` cria `pgcrypto`, os papéis `anon`, `authenticated` e `app` (login, senha `x`), as tabelas do núcleo e `migracoes`. Também cria `portal_registro_atual()` e `papel_atual()`, que leem `teste.registro` e `teste.papel` (`:55-58`).
- Ele semeia os membros 4 Ana, 11 Bruno, 17 Carla, 23 Diego (Comunicação) e 31 Elis (`:60-65`). A 15.0 cria os grupos a partir de `membros.grupos`.
- `esqueleto_storage.sql` cria `auth.uid()` (lê `teste.uid`), o schema `storage` com RLS ligada e a coluna `perfis.nome` (`:26`), que o teste da 2.17.0 usa.
- `esqueleto_vault.sql` só é preciso se usar o Vault.

**Formato de um teste** (modelos `db/testes/v23_studio.sql` e `db/testes/2.17.0_notas_fotos_e_cartoes.sql`)
- Comentário de cabeçalho dizendo sobre qual base o teste roda, depois `\set ON_ERROR_STOP on` e `\pset pager off`.
- Funções auxiliares (`v23:8-27`):
  - `ok(cond, txt)`;
  - `eu(reg, papel)`, que faz `set_config` de `teste.registro`, `teste.papel` e `teste.uid`;
  - `gid(nome)`;
  - helpers do próprio módulo.
- Insere `perfis` com ids `'00000000-0000-0000-0000-0000000000NN'` (`v23:41-48`).
- Cria grupos com `grupo_salvar` e `grupo_estrutura_salvar` (`v23:50-55`).
- Aplicação da migração, duas variantes:
  - pelo comando de fora (v23);
  - ou com `\ir ../2.17.0_….sql` logo no começo (`2.17.0 teste:38`).
- Cada seção é um `do $$ declare r jsonb; begin perform eu(…); r := fn(jsonb_build_object(…)); perform ok(r->>'status' = 'ok', '…'); end $$;`.
- Bloco de RLS (`v23:261-324`):
  - `grant select, insert, update, delete on all tables in schema public to authenticated, anon; grant usage, select on all sequences … to authenticated; set role authenticated;`;
  - recusa conferida com `exception when insufficient_privilege then pegou := true`;
  - update bloqueado conferido com `get diagnostics n = row_count` e `n = 0`;
  - fecha com `reset role`.
- Bloco `set role anon` (`v23:326-338`).
- Idempotência no fim: `\ir ../<migração>.sql` de novo, mais as asserções de que nada duplicou e de que `migracoes` tem uma linha só (`v23:352-366`; `2.17.0 teste:387-399`).

### 3. Testes de navegador

**Como sobem o portal** (`testes/studio.mjs:23-49`)
- Leem `stub-supabase.js` como string e lançam o Chromium com `executablePath:'/opt/pw-browsers/chromium'`.
- `p.route('**/*supabase*.js', …fulfill({ body: stub }))` troca o supabase-js do CDN (`index.html:3559`) pelo stub.
- Abortam `fonts.googleapis.com`, `raw.githubusercontent.com` e `img.youtube.com`.
- `addInitScript` grava o `localStorage` (`nd.menu`) e, quando o teste precisa, as flags `window.__teste` antes do load (`testes/LEIAME.md:27-30, 44-48`).
- `goto('http://localhost:8765/index.html' + hash)`; a porta 8765 está escrita em cada teste.

**Como logam**
- O stub devolve sessão do usuário `u1` (`stub-supabase.js:2038-2047`), e `perfis[0]` é a Ana, admin, registro 4 (`:4`).
- "Logado" é `waitForSelector('#hd:not([hidden])')` mais `waitForTimeout(1000)`.
- Trocar o papel: `stub.replace("papel:'admin'", "papel:'leitura'")` (`studio.mjs:27`; `stubDe` em `versoes-fotos-e-cartoes.mjs:30`).
- Trocar os grupos: replace do literal `grupos:['Órtese','Gestão'], gestor_registro:null` (`studio.mjs:28`).
- `relatorios-por-papel` e `carga-por-papel` aceitam o caminho de um stub em `argv[2]` (`testes/LEIAME.md:147-155`).

**Como navegam e conferem**
- `ir(p, '#/…')` troca `location.hash` e espera (`studio.mjs:50`).
- Conferem por:
  - `window.__rpcs` (`{nome, p}`) e `window.__escritas` (`{tabela, op, dados}`) (`:51-52`);
  - `.toast` (`:53`);
  - `scrollWidth <= clientWidth` (`:54`);
  - erros de página com `p.on('pageerror')`.
- Cada asserção imprime `  ok ` ou `FALHA` e o arquivo termina com `process.exit(falhas ? 1 : 0)`.
- Exceção: `ajustes-de-tela`, `carga-por-papel`, `origem-e-pills`, `quadro-e-acesso`, `relatorios-por-papel` e `teste-de-email` nunca saem com código ≠ 0. Imprimem um JSON para ler a olho.

**Como acrescentar tabelas ao stub**
- Os dados são o objeto `DADOS` (`stub-supabase.js:3-411`). Blocos posteriores acrescentam `DADOS.x = [...]`, como o do Studio (`:412-455`). Para Marca: `DADOS.marca_config = [{ id:true, … }]` e `DADOS.marca_vinculos = [...]`, logo depois de `:455`.
- `builder(tabela)` (`:776-812`):
  - copia `DADOS[tabela]`; tabela que não existe devolve `[]`;
  - só filtra `eq` (inclusive `a.b`), `neq` e `in`; `gte/lte/gt/lt/or/not/is/ilike/order/limit` não fazem nada;
  - `single` e `maybeSingle` devolvem a primeira linha ou `null`.
- **Escritas não mudam `DADOS`.** `insert/update/upsert/delete` só anotam em `window.__escritas`. As exceções são o `update` de `treinamento_config` (`:791`) e o de `email_roteiros`, por `b._muda` (`:793, :800`). Daí:
  - `update(...).eq(...).select()` devolve a linha antiga, não vazia, e a tela entende "salvou";
  - `insert(...).select().single()` devolve a primeira linha já existente, não a inserida.
- Se a tela de Marca reler depois de gravar, ou se acrescenta `if (tabela === 'marca_…') b._muda = d;` em `update`, ou a escrita vai por RPC.

**Como acrescentar RPCs ao stub**
- Um `if (nome === 'marca_…'){ (window.__rpcs ||= []).push({ nome, p: args?.p ?? args }); …mutar DADOS…; return { data:{ status:'ok', … }, error:null }; }` (padrão do Studio em `:1261-1306`, ou o helper `regra(k, p)` em `:896`).
- O ramo vai **antes** do fallback em `:1994`. Esse fallback devolve `{ status:'ok', codigo:'ORT-9', id:'novo' }` para qualquer RPC desconhecida, então um ramo que falta passa calado.
- "Migração que falta" se simula com uma flag em `window.__teste` devolvendo `{ data:null, error:{ message:'function public.X does not exist' } }` (`:899`, `:823`).
- Storage (`:1997-2010`):
  - `upload` anota em `__uploads` `{bucket, caminho}`;
  - `createSignedUrl` devolve `javascript:void(0)`;
  - `createSignedUrls` devolve SVGs em `data:`;
  - `remove` anota em `__removidos`;
  - `list` devolve `[]`;
  - **não existem** `getPublicUrl` nem `download`.
- Documentar o comportamento novo num parágrafo de `testes/LEIAME.md`, como em `:59-67`, e acrescentar a linha na tabela (`:91-115`) e o comando na lista (`:117-141`).
- Atenção: o stub já tem o membro Diego com `grupos:['Marca']` (`stub-supabase.js:14-15`), sem grupo correspondente em `DADOS.grupos`.

**Comandos exatos da bateria inteira**
1. Uma vez: `cd testes && npm install`. `testes/node_modules` não existe hoje; instala em cerca de 4 s, e `node_modules` e `package-lock.json` estão no `.gitignore`.
2. Da raiz do repositório: `python3 -m http.server 8765`.
3. Em `testes/`: `node colisoes.mjs` (sem servidor), depois `node X.mjs` para cada arquivo, na ordem de `testes/LEIAME.md:118-140`.

**Tempo, em série: 812 s (cerca de 13,5 min)**, todos sem FALHA.

| Teste | Tempo (s) |
|---|---|
| colisoes | 0 |
| origem-e-pills | 11 |
| relatorios-por-papel | 2 |
| carga-por-papel | 3 |
| quadro-e-acesso | 6 |
| ajustes-de-tela | 7 |
| teste-de-email | 11 |
| menu-lateral | 44 |
| okrs-e-selecao | 40 |
| grupos-arvore | 15 |
| arquivos-e-projetos | 74 |
| studio | 54 |
| treinamentos | 84 |
| documentos-e-eventos | 60 |
| cofre | 50 |
| formularios | 54 |
| validacao | 12 |
| agenda-e-inicio | 47 |
| emails | 41 |
| ps-entrevistas | 37 |
| notificacoes | 40 |
| tour | 54 |
| versoes-fotos-e-cartoes | 66 |

`colisoes.mjs` lê todo `mod-*.js` sozinho (`colisoes.mjs:48-49`), então um `mod-marca.js` entra na conferência sem mexer no teste.

### 4. Testes que dependem de texto de UI (o que Marca pode quebrar)

**`menu-lateral.mjs`**
- `:80-83` compara a lista exata de espaços: `'Agenda|Atividades|OKRs|Projetos|Arquivos|Studio|Equipe|Treinamentos|Serviços|Seleção|Administração'`. Um espaço novo quebra esse teste e também PADROES §1 (`PADROES.md:40-47`: "o próximo precisa caber dentro de um que já existe").
- `:127` exige Administração com 14 filhos e rótulos `Portal,Pessoas,Registro,Conteúdo`.
- `:436-446`, por papel: selecao `'Todos os painéis|E-mails|Relatórios'`, pessoal 14.
- `:153-156` exige Serviços com 11 visíveis.
- Um painel novo em Administração quebra essas asserções.

**`studio.mjs`**
- Subitens (`:64`): usa `every(includes)` sobre `Quadro, Calendário, Ideias, Criar publicação, Modelos, Configurações`. Um subitem `{ sub:'marca', rot:'Marca' }` em `arvoreDoMenu()` (`index.html:4887-4895`) passa.
- Contagens exatas:
  - colunas `'Ideias|Em produção|Em aprovação|Pronta para publicar|Publicada'` (`:66`);
  - "23 modelos" na galeria (`:111`); acrescentar modelo quebra;
  - `.st-imp` = 3 (`:176`) e `.st-rec` = 2 (`:184`).
- Botões por `has-text`:
  - "Guardar ideia" (`:103`), "Baixar" (`:128`), "Só a lâmina" (`:129`), "Salvar no quadro" (`:131`);
  - "Aprovar" (`:155`), "Salvar o plano" (`:164`), "Mandar para aprovação" (`:166`);
  - `#main .btn.solid:has-text("Salvar")` em config/acesso (`:172`), "Vídeo" (`:177`), "Recurso" (`:185`).
- Regex sobre texto: `/esperando a sua aprovação/` (`:70`), `/Marcar como publicada/` (`:159`), `/Criar: Aniversário/` (`:196`), `/grupo aprovador/` (`:215`).
- Quem não gere: todos os `#st-gp-acesso input` desabilitados e nenhum `#st-cfg .btn.solid` (`:217-218`).
- As abas de configuração moram em `ST_ABAS_CONFIG` (`mod-studio.js:724`). Uma aba Marca ali não toca o teste.

**`versoes-fotos-e-cartoes.mjs`**
- Lê a versão da casca pela regex `/const VERSAO = '([^']+)'/` (`:32`). A linha tem de continuar exatamente nesse formato.
- A primeira `.vs-item .vs-num` tem de ser igual a VERSAO, com "No ar" (`:93`).
- A 2.16.0 mostra "antes 32.0" (`:94`).
- A 2.17.0 mantém os tipos Novo e Melhoria e mais de 5 `code/strong` (`:86-89`, `:95`).
- `#/versoes/2.2.0` precisa continuar nas versões recolhidas (`VERSOES_ABERTAS = 5`, `mod-versoes.js:170`) (`:97-100`).
- O rodapé mostra `'SOMA ' + VERSAO` (`:76`), e `versao_feito === VERSAO` (`:146`).

**`tour.mjs`**
- O menu precisa de itens que começam com Studio, Seleção e Administração (`:135-136`).
- Textos fixos: "Criar uma peça, em seis passos", "Entre na sua conta", "Você entra no Studio e aprova publicações", "O Studio não aparece para você" (`:122-123, :161, :185`).

**`emails.mjs`**
- Depende das contas do Studio: `.ml-rede` = 2 e `a.ml-studio[href="#/studio/config/contas"]` (`:80-84`, `:249-261`).

**Os demais com muito texto, alheios a Marca a menos que se mexa em componente compartilhado**
- `has-text`/`textContent` por arquivo: arquivos-e-projetos 39/61, tour 0/42, versoes 2/42, treinamentos 11/31, okrs-e-selecao 6/29, documentos-e-eventos 25/6, formularios 25/4, grupos-arvore 7/19, notificacoes 0/17, cofre 15/4, emails 15/3, agenda-e-inicio 13/4, ps-entrevistas 13/5.

### 5. VERSAO e NOTAS_VERSAO na 2.18.0

**A regra** (`PADROES.md:619-631`, `README.md:141-176`)
- Um commit só, com três coisas:
  - `VERSAO` na casca;
  - a entrada no alto de `NOTAS_VERSAO`;
  - a migração com o número no nome e a mesma id em `migracoes`.
- É minor (2.17.1 → 2.18.0) porque acrescenta.
- A nota diz o que muda para quem usa, no tom do §9 (`PADROES.md:583-604`): impessoal ou imperativo, sem travessão nem ponto médio na frase.

**VERSAO**
- `index.html:3574`: `const VERSAO = '2.17.1';` passa a `const VERSAO = '2.18.0';`.
- O valor também entra na query dos módulos (`index.html:4403`).
- `sw.js` não tem versão.

**NOTAS_VERSAO**
- `mod-versoes.js:33`: a entrada nova vai antes da linha 34.
- Formato: `{ v, data:'AAAA-MM-DD', titulo, itens:[[tipo, texto Markdown], …] }`. `antes` só existe nas versões da numeração antiga.
- Tipos em `TIPOS_NOTA` (`mod-versoes.js:169`): `novo`, `melhoria`, `correcao`, `aviso`.
- Entrada existente copiada literalmente (`mod-versoes.js:34-39`):

```js
  { v:'2.17.1', data:'2026-09-29',
    titulo:'As entrevistas do PS na agenda e o portal sem avisos que ninguém pediu',
    itens:[
      ['correcao', 'As **entrevistas do processo seletivo** entram na agenda de quem as conduz (quem abriu o horário em Seleção › Agenda), na camada *Entrevistas do PS*, e na semana do início. Cada entrevista tem o candidato, a hora e o link da chamada, com *Entrar na chamada* e a ficha do candidato a um clique. Só o horário com candidato aparece.'],
      ['aviso', 'O portal não abre mais aviso sozinho: sai o convite para receber as notificações no aparelho, do alto do sino, e sai o aviso de versão nova. Ativar as notificações continua em *Preferências de avisos*, no sino ou no rodapé, e as notas de versão continuam no rodapé.']
    ] },
```

**Outras referências a acompanhar**
- `PADROES.md:268`: o exemplo da linha "Versão do SOMA" ainda diz `2.17.0`.
- `PADROES.md:129-134`: rotas do Studio, se entrar `#/studio/marca`.
- `testes/LEIAME.md` e `db/LEIAME.md`, conforme as seções 2 e 3.



---

## Anexo J: especificação do site brand

### Site brand: especificação para os agentes do repo brand

Leia antes: `spec/COMUM.md` (mesma pasta), `$S/pedido-usuario.txt`, `/home/claude/brand/design-system/DIRETRIZES.md`, e os previews `design-system/previews/*.html` (abra-os no navegador para ver a linguagem visual).
Repo: `/home/claude/brand`, branch `claude/manual-paginas` (base origin/main 50b8ac8). Todos os agentes do brand trabalham nesse mesmo checkout, cada um só nos seus arquivos; commit com caminhos explícitos (se der `index.lock`, espere e tente de novo).

### O que deu errado antes (não repetir)
A versão em abas virou uma "lambança": duas barras de navegação (cabeçalho + barra de abas/subabas), conteúdo de consulta misturado com ferramentas (Estúdio, gerador de assinaturas, downloads), miniaturas que abriam em tela cheia, nomes reais nas peças, texto explicativo demais.

### O que o site é
Manual da marca, para consulta fácil e para dar cara à expressão da marca. É a ferramenta mais expressiva da NeuroDynamics: explora ao máximo a marca, com animações de rolagem. Mostra como os elementos harmonizam e o potencial deles, com mockups de aplicações na vida real, paletas, formas de escrita.
- **Organizado por páginas, com URLs limpas** (`/cores`, nunca `/cores.html` nos links). **Uma barra de navegação só**: o cabeçalho flutuante de vidro (SiteHeader da v2). Nenhuma barra de abas, subabas, índice fixo lateral ou segunda faixa de links. Dentro da página, seções com título e âncora (`/cores#funcional`), sem menu próprio. No fim de cada página, um link simples para o próximo capítulo é permitido (não é barra).
- **Downloads: só o que é público, e só pelo Brandfetch** (`https://brandfetch.com/neurodynamics.dev`). Nenhum outro botão de baixar no site (copiar hex ao clicar é permitido). Wallpapers, templates, assinatura, prompts e afins ficam no portal: o site leva para lá ("Área da equipe" → `https://membro.neurodynamics.dev/#/marca`).
- **Templates aparecem só como imagem**, para mostrar como os elementos ornam entre si. Nenhuma imagem é link, nenhuma abre em tela cheia ou lightbox (nem o cartão de visita).
- **Mockups** (CSS e SVG, com as miniaturas de `assets/manual/` como "tela" ou "impressão") mostram as aplicações na vida real: cartão de visita sobre uma mesa, crachá no cordão, carta e memorando, apresentação num notebook ou projetor, post num celular, wallpaper num notebook e num celular, e-mail num cliente de correio, certificado emoldurado, tela de quiosque.
- **Nomes fictícios** do elenco de `COMUM.md`; nome só onde entra nome.
- **Creative gallery**: criativa e expressionista. Composições que combinam os elementos (campos de cor das famílias, tipografia em escala de cartaz, padrões rede/ondas/circuito/pulso, colagens das peças em ângulos, centelhas de Synapse), montadas em CSS/SVG/canvas e com as miniaturas.
- **Linguagem**: as regras de `COMUM.md`. O site é expressivo no visual, não no palavrório: frases curtas e diretas, sem travessão nem ponto médio, sem emoji.

### Páginas (arquivos na raiz) e capítulos
| URL | Arquivo | Conteúdo |
|---|---|---|
| `/` | `index.html` | Abertura: hero expressivo com a marca em movimento, manifesto curto, "uma marca, dois registros" (interface escura e documento formal claro), os capítulos como cartões grandes, "Área da equipe" (o único CTA sólido Synapse da página) e Brandfetch. Também redireciona os hashes antigos (abaixo). |
| `/marca` | `marca.html` | Imagotipo, ícone quadrado, símbolo, versões por família (`assets/logo-imagotipo-<familia>-light|dark.png`), área de proteção, tamanho mínimo, fundos permitidos, usos incorretos desenhados (esticar, Synapse, inverter o preto, reenquadrar o símbolo), selo solene como imagem, onde a logo entra e onde não entra. |
| `/cores` | `cores.html` | Conjunto primário (Cortex em cinco tons, Synapse como centelha), neutros (Sulco, Pia, Medula), as famílias secundárias em quatro tons, pareamentos (claro com dark, escuro com branco, primary com dark exceto Cortex, Retina, Nexo), proporção, "uma família por superfície" demonstrado, harmonias (cada família aplicada a uma peça), conjunto funcional (só interface) à parte. Hex copiável. |
| `/tipografia` | `tipografia.html` | Operacional como principal (Archivo, Instrument Sans, IBM Plex Mono: papéis, escala, pesos, rótulos, dados); executiva como um "extra" (Instrument Serif e Archivo Light), demonstrada com os elementos que ornam com ela (papel claro, Cortex, selo, fio, kicker), nunca com texto de nome como espécime. |
| `/escrita` | `escrita.html` | Formas de escrita: tom (calmo, profissional, direto), princípios com pares "assim / não assim", registro de interface e de documento, números, datas, códigos (`NRO-PUB-002`), separadores (sem travessão nem ponto médio), mensagens de erro ("Não foi possível X: motivo."), rótulos, títulos em caixa de frase, sem emoji. Base: `/home/claude/membro/PADROES.md` §9 e DIRETRIZES "Content fundamentals". |
| `/elementos` | `elementos.html` | Superfícies (Void, Painel, grade e brilho Cortex), bandas de família, formas e raios, padrões (rede, ondas, circuito, pulso), fotografia (sem filtros, retangular), dados (traços, proporção em quatro tons), glifos permitidos, e a interface como expressão (botão, campo, chips, pills) só para ver, sem código para copiar (o código fica no portal, em Marca › Interfaces). |
| `/aplicacoes` | `aplicacoes.html` | Os mockups da vida real, agrupados por uso (papelaria, apresentações, digital e redes, eventos e identificação). |
| `/galeria` | `galeria.html` | A creative gallery. |
| (404) | `404.html` | Página de erro na mesma linguagem, com link para o início. |
Não crie página com nome de pasta existente (`templates`, `assets`, `design-system`, `downloads`) nem `x.html` junto de uma pasta `x/`.

### Estrutura compartilhada (agente fundacao)
- `site/site.css` (base de todas as páginas, sobre `design-system/tokens.css` e `neuro.css`, sem regras globais que vazem), `site/site.js` (animações de rolagem, menu do celular, copiar, utilidades). CSS e JS próprios de página em `site/<pagina>.css` e `site/<pagina>.js`.
- Cabeçalho e rodapé numa fonte só: `site/partes/cabecalho.html` e `site/partes/rodape.html`, carimbados em cada página entre `<!-- cabecalho -->…<!-- /cabecalho -->` e `<!-- rodape -->…<!-- /rodape -->` por `scripts/carimbar.mjs` (marca o item atual com `aria-current="page"`). Rodar o script é obrigatório depois de mexer nas partes.
- `scripts/servir.mjs`: servidor local que resolve `/x` → `x.html` e serve `404.html` (para prévia e testes; `python3 -m http.server` não resolve URL limpa).
- Cabeçalho: logo (link para `/`), Marca, Cores, Tipografia, Escrita, Elementos, Aplicações, Galeria, e à direita "Área da equipe". No celular, um botão abre os mesmos links num painel (é a mesma barra, não outra).
- Rodapé discreto: Brandfetch, Área da equipe, NeuroDynamics, LABBIO, Escola de Engenharia, UFMG. Sem repetir a lista de capítulos.
- Animações: revelar ao rolar (IntersectionObserver), efeitos guiados pela rolagem (`animation-timeline: view()` com alternativa), números e cores que se transformam; nada pisca; tudo desliga com `prefers-reduced-motion`.
- `<head>` de cada página: `<title>` "<Capítulo> | NeuroDynamics" (início: "Manual da marca | NeuroDynamics"), description, Open Graph, favicon `/favicon.png`, fontes do Google (Archivo 300–700, Instrument Sans 400/500/600 e itálico, Instrument Serif 400 e itálico, IBM Plex Mono 400/500).
- Links internos sempre absolutos e limpos (`/cores`, `/cores#funcional`, `/`), imagens com `loading="lazy"` e `alt`.
- Hashes antigos (o portal e e-mails antigos ainda apontam para eles), tratados em `index.html`:
  `#cores[/x]` → `/cores#x`; `#tipografia` → `/tipografia`; `#executivo` → `/tipografia#executiva`; `#elementos/marcas` → `/marca`; `#elementos/x` → `/elementos#x`; `#interfaces[/x]` → `https://membro.neurodynamics.dev/#/marca/interfaces`; `#galeria`, `#galeria/galeria` → `/galeria`; `#galeria/estudio` → `https://membro.neurodynamics.dev/#/marca`; `#aplicacoes/assinaturas`, `#assinaturas` → `https://membro.neurodynamics.dev/#/marca/assinatura`; `#aplicacoes/downloads` → `https://brandfetch.com/neurodynamics.dev`; `#aplicacoes[/x]` → `/aplicacoes`.
- Sai do site: o Estúdio, o gerador de assinaturas, o login do Supabase, as demos de interface com código, os downloads (JSON de paleta, docx, selos). Os arquivos de `templates/` e `assets/` continuam no repositório (decisão do usuário), só não são oferecidos pelo site.

### Recursos (agente recursos)
- Trocar os nomes reais pelos do elenco em `templates/**/*.html` (inclusive `templates/email/variantes/`), sem mexer em mais nada das peças.
- `scripts/gerar-miniaturas.mjs`: renderiza as telas (`data-screen-label`) dos templates em JPG para `assets/manual/` com as fontes reais (fontsource local, como o harness em `/tmp/claude-0/-home-claude-brand/ca9cb8df-f3b3-55cb-ac3f-0fb995078637/scratchpad/fonts.mjs`). Regenera as atuais que tinham nome real e acrescenta um conjunto extra útil para mockups e galeria, com `assets/manual/indice.json` (nome, template de origem, tela, largura, altura).
- `scripts/gerar-downloads.mjs`: os estáticos do manifesto de `COMUM.md` em `downloads/` (wallpapers JPG qualidade ~90 na resolução final; capa do LinkedIn PNG), mais `downloads/LEIAME.md`.
- `scripts/package.json` com as dependências (playwright, @fontsource/*), `node_modules` fora do git (`.gitignore`).
- `favicon.png` público sem a onda branca (DIRETRIZES: a onda branca nunca é pública); escolha a marca permitida para ícone pequeno (ícone quadrado sólido sobre o fundo certo) e gere 32, 180 e 512 px se fizer sentido.
- `template.html` para a v2 (fontes, tokens, neuro.css, logos do próprio repo, sem filtro de inversão, sem Plex Mono em rótulo).
- No design system, acrescentar o que o portal usa e a v2 não tem: o tema claro do portal (valores em `spec/SOMA.md`, "Tokens da casca", bloco claro), a busca no trilho do menu recolhido e a `.lt-casa`; registrar em `DIRETRIZES.md` e `design-system/README.md`; se fizer sentido, um preview novo.

### Páginas (agentes paginas-a e paginas-b)
- paginas-a: `marca.html`, `cores.html`, `tipografia.html`, `escrita.html` (+ `site/<pagina>.css|js`).
- paginas-b: `elementos.html`, `aplicacoes.html`, `galeria.html` (+ `site/<pagina>.css|js`).
- Não edite `site/site.css`, `site/site.js`, as partes nem as páginas do outro. Precisou mudar a base: peça no relatório.
- Use as miniaturas de `assets/manual/` (veja `indice.json`) e os logos de `assets/`. Nada de imagem como link.

### Conferência (agente qa)
Abre todas as páginas em 1440px e 390px (servidas por `scripts/servir.mjs`), com e sem `prefers-reduced-motion`; confere: uma barra de navegação só; links internos limpos e válidos (nenhum 404, nenhum `.html`); nenhuma imagem clicável nem lightbox; nenhum nome real (busca por Marcondes, Caversan, Sarah Fernanda, 2022112517, 2021098833, 2023104412 no site e nas miniaturas usadas); linguagem (sem —, sem ·, sem emoji, sem conversa); só Brandfetch como download; sem erro no console; sem rolagem lateral; contraste; peso das páginas. Corrige o que achar e atualiza `README.md` do repo.


---

## Anexo K: pedido original do dono (literal)

aplique o novo design no portal. comecei a aplicar no repo brand. minha expectativa é que ele vire um manual da marca interativo. porém, acabou virando uma lambança. estou aumentando o esforço do modelo justamente para corrigir isso e implementar as próximas partes com chances maiores de sucesso. um dos pontos, é que eu quero que a consulta para o brand seja fácil, por isso orientei a organização por páginas. no entanto, o modelo colocou duas barras de navegação. 

Site brand: será um manual da marca. Explica os elementos e serve para consulta: mostra como eles harmonizam, o potencial, usa mockups para apresentar alguns dos elementos, paletas, formas de escrita, dá uma cara para a expressão da marca. Downloads apenas de conteúdo público (brandfetch). Permite direcionar para o módulo de brand interno. É a ferramenta mais expressiva, explora ao máximo a marca, animações de rolagem de tela etc. Mostra os elementos (usando nomes fictícios), e de uma forma criativa e expressionista, monta a creative gallery.
Módulo de brand interno: dentro do portal do membro, é onde ficam os elementos para download. Em formato de galeria, eles são apresentados. Estáticos (como wallpaper, header para redes sociais etc.) ficam disponíveis diretamente para download. Templates (como de relatórios, apresentações, cartas, memorandos etc) ficam guardados no módulo de arquivos, mas também aparecem na galeria do brand interno. Assinatura de email, por exemplo também fica aí. Ele redireciona para baixar lá na página de arquivo de cada um. Templates e elementos controlados, como certificados, convites, selo, crachá, ficam visíveis para todos, mas apenas grupos específicos podem fazer download. Na parte de interfaces, mostra todo o conteúdo para ser exportado e montar páginas da equipe no padrão, além de prompts para serem exportados que ensinam LLMs a gerar conteúdo uniforme. 

Não se esqueça de usar as definições de linguagem (com base na última revisão do repo membro, instruções copiadas aqui embaixo), e dar preferência a urls cleans, sem .htlm, por exemplo.

para o soma como um todo, quero que a linguagem usada para instruções seja revista. hoje ela é muito próxima do usuário, como o seguinte exemplo: "A declaração sai na hora, em PDF, no modelo da NRO: os dados da sua ficha na primeira folha e, na segunda, os treinamentos concluídos e os eventos de que você participou. Ela não fica guardada no portal — cada emissão ganha um código verificador, e quem a receber confere em auth.neurodynamics.dev.". eu não preciso que o portal tenha esse tom, muito artificial, eu espero algo mais direto e formal, e menos explicativo. para alguns do pontos os quais precisam de uma explicação, convém adicionar um ícone de informação, e colocar ali o texto de instrução, mas para casos como o do exemplo, onde o usuário já conseguiria saber disso se abrisse o documento, além de que é esperado pelo usuário, por exemplo, que o documento saia na hora e esteja no padrão da NRO, não é necessário colocar esse texto. quero que você adote uma linguagem mais robusta nesse sentido, e por favor retire os em-dashes e middle points onde não convém.
