# Contrato: feed editorial, notícias do site, reações e newsletter

Banco: `db/2.19.1_feed.sql` (testado em `db/testes/2.19.1_feed.sql`).
Stub: bloco `window.__teste.feed` em `testes/stub-supabase.js` (estado em
`window.__fd`). Fichas: F1 (portal), F2 (site), F3 (página de reação).

Tudo que está aqui é **fechado**: nomes de função, parâmetros, códigos de
status e campos. Se uma tela precisar de algo que não está aqui, pare e
anote no PR; não invente RPC nem campo.

## Regras de negócio (as que a tela precisa saber)

- **Uma fonte só**: `feed_itens` alimenta o widget do início, o feed da
  equipe, as notícias do site e a newsletter.
- **Estados**: `rascunho` → `pronto` → (`publicando`) → `publicado` →
  `retirado`. O reporte só **contribui**: enviar o reporte deixa a
  contribuição `pronto`; ela **não** aparece no feed até alguém publicar.
- **Quem publica (editor)**: admin ou quem está no grupo `NRO_MANAGERS`
  (com herança). Sem votação. `feed_editor()` diz se a conta é editora.
- **Dois tipos**: `topico` (breve; texto até 1.200 caracteres; sem página
  própria) e `noticia` (resumo + texto de pelo menos 300 caracteres para
  publicar, imagens com legenda, página própria com `slug`).
- **Interno ou no site**: cada publicação escolhe. Interno = só a equipe
  (portal e boletim semanal). No site = também em neurodynamics.dev e no
  boletim mensal da comunidade.
- **Autoria**: `autor` é o texto de autoria (`autor_texto`, se preenchido,
  senão o nome de quem criou). Quem publicou aparece só na mesa editorial
  (`publicado_por`).
- **Reações**: só em **notícia** (tópico não tem reação). Um emoji por pessoa e notícia, entre
  `👏 ❤️ 🎉 💡 🚀 😮`. Trocar substitui; mandar `null` remove. Reage quem
  tem conta no SOMA com registro no quadro, **em qualquer status** (membro,
  ex-membro, egresso). Publicação interna só aceita conta ativa. Conta do
  LABBIO não reage.
- **Newsletter**: sem aprovação. Uma edição leva as publicações ainda não
  enviadas àquele público. Semanal = equipe (tudo que foi publicado);
  mensal = comunidade (só o que foi publicado no site). Sem item, sem
  edição. O editor pode mandar uma edição na hora.

## Imagens

- Bucket privado `feed` (como hoje): a imagem do item mora em
  `feed/<id do item>/<arquivo>` (item criado na mesa) ou
  `feed/<id do reporte>/<arquivo>` (veio do reporte). Para ler no portal:
  `sb.storage.from('feed').createSignedUrl(path, 300)`.
- Item novo nasce **sem imagem**: salve o texto primeiro (`feed_item_salvar`
  devolve o `id`), suba as imagens em `feed/<id>/...` e salve de novo com
  `imagens`. Máximo de 8 imagens; `png`, `jpeg`, `webp`.
- Bucket **público** `noticias`: só as cópias das imagens das publicações
  que estão no site, em `noticias/<id>/<n>.<ext>`. URL pública:
  `${CONFIG.SUPABASE_URL}/storage/v1/object/public/` + o campo `url`/`imagem`
  que o banco devolve (já vem começando por `noticias/`).

## RPCs do portal (conta logada)

### `feed_editor()` → `boolean`

### `feed_lista(p_antes timestamptz, p_limite int, p_id uuid, p_tipo text)` → `array`

Publicados, do mais novo para o mais antigo. Paginação: passe o
`publicado_em` e o `id` do último que você tem (`p_antes`, `p_id`).
`p_limite` até 50 (padrão 20). `p_tipo`: `'topico'`, `'noticia'` ou nulo.
Conta não ativa recebe `[]`.

Cada item:

```
{ id, tipo, slug, titulo, subtitulo, texto, autor, publicado_em, publico,
  imagens: [{ path, legenda, publico_path? }],   // path no bucket privado feed
  imagem_path,                                   // a primeira (legado)
  reacoes: { "👏": 3, "❤️": 1 },                  // só os emojis com contagem
  minha_reacao: "👏" | null }
```

### `feed_editorial(p_estado text)` → `{status, itens}`

Editor. `p_estado` nulo = todos (menos rascunhos de reporte ainda não
enviado). Cada item = o de `feed_lista` + `estado`, `reporte_id`,
`criado_em`, `atualizado_em`, `publicado_por` (nome), `retirado_em`.
Ordenado por `atualizado_em` desc. `sem_permissao` se não for editor.

### `feed_item_salvar(p jsonb)` → `{status, id?, slug?, campo?}`

Editor. Cria (sem `id`) ou edita (com `id`).

```
p = { id?, tipo: 'topico'|'noticia', titulo, subtitulo, texto,
      slug?,            // só notícia; vazio = gerado do título
      autor_texto?,     // vazio = o nome de quem criou
      imagens?: [{ path, legenda }] }   // ordem = ordem na página
```

- `ok` → `{id, slug}` (slug só para notícia).
- `invalido` + `campo`: `tipo`, `titulo` (1–200), `subtitulo` (1–400),
  `texto` (tópico > 1.200), `imagens` (> 8, ou caminho fora da pasta do
  item/reporte, ou imagem em item novo).
- `slug_em_uso` + `slug`; `nao_encontrado`; `em_rascunho_no_reporte`
  (contribuição de reporte ainda não enviado); `publicando` (termine ou
  repita a publicação antes de editar); `sem_permissao`.
- Editar um item **publicado** atualiza o que está no ar. Mudar o slug de
  notícia mantém o antigo redirecionando.

### `feed_publicar(p_id uuid, p_publico boolean)` → `{status, estado, copiar?, slug?}`

Editor.
- `p_publico = false`: publica interno, na hora → `{status:'ok',
  estado:'publicado', copiar:[]}`. Também republica um item `retirado`.
- **Tirar do site, mantendo na equipe** (ação "Só para a equipe" num item
  publicado no site): `feed_retirar(id)` → `remove(apagar)` no bucket
  `noticias` → `feed_publicar(id, false)`. Nesta ordem: o banco só deixa
  apagar a cópia pública de item `retirado`.
- `p_publico = true`, sem imagens → `{status:'ok', estado:'publicado', slug}`.
- `p_publico = true`, com imagens → `{status:'ok', estado:'publicando',
  copiar:[{de, para}]}`. A tela **copia** cada imagem e confirma:
  1. `const {data:blob} = await sb.storage.from('feed').download(de)`;
  2. `await sb.storage.from('noticias').upload(para, blob, {contentType: blob.type, upsert:true})`;
  3. depois de todas, `feed_publicar_confirmar(p_id)`.
  Falhou no meio: a publicação fica em `publicando` (invisível); a tela
  mostra o erro e o botão "Tentar de novo", que chama `feed_publicar` de
  novo (é idempotente).
- Erros: `noticia_incompleta` (notícia com texto < 300 ou sem slug),
  `em_rascunho_no_reporte`, `nao_encontrado`, `sem_permissao`.

### `feed_publicar_confirmar(p_id uuid)` → `{status, estado?, slug?, faltam?}`

`ok` → publicado. `imagens_pendentes` + `faltam` (caminhos públicos que
não chegaram ao bucket). `invalido` se o item não está em `publicando`.

### `feed_retirar(p_id uuid)` → `{status, apagar}`

Editor. Tira do portal, do site e da próxima newsletter na hora. A tela
apaga as cópias públicas: `sb.storage.from('noticias').remove(apagar)`
(se `apagar` não for vazio). Falha ao apagar não desfaz a retirada:
toast de aviso, só.

### `feed_ocultar(p_id uuid)` → `{status}`

Mantida para o Pessoal (retira sem apagar cópias). A tela nova usa
`feed_retirar` quando a conta é editora e `feed_ocultar` só para o papel
`pessoal` que não é editor.

### `feed_reagir(p_ref uuid, p_emoji text|null)` → `{status, reacoes?, minha_reacao?}`

`ok` com as contagens novas. `sem_permissao` (inclusive para tópico), `invalido`, `limite` (30
mudanças em 10 minutos: toast "Muitas reações seguidas. Espere alguns
minutos.").

### `newsletter_pendentes()` → `{status, equipe, comunidade, inscritos}`

Editor. `equipe` e `comunidade`: `[{id, titulo, tipo, publicado_em}]` do
que vai na próxima edição de cada público. `inscritos`: comunidade
confirmada.

### `newsletter_enviar_agora(p_tipo 'semanal'|'mensal')` → `{status, id?, destinatarios?, itens?}`

Editor. `ok`, `vazio` (nada pendente), `sem_permissao`, `invalido`.

### `newsletter_lista()` → `array`

Editor ou liderança. As 50 últimas edições:
`{id, tipo, periodo_ini, periodo_fim, assunto, itens:[{id,tipo,titulo,subtitulo,texto,url,imagem}], status, manual, criado_em, destinatarios, enviados, falhas}`.
`status`: `aprovada` (na fila ou enviando), `enviada`, `cancelada` (as
antigas que esperavam votos). Não há mais votos nem versões.

`newsletter_decidir`, `newsletter_revisar` respondem `descontinuado`;
`newsletter_gerar` = `newsletter_enviar_agora`. A tela não chama nenhuma
delas.

## RPCs públicas (site, anônimo)

### `noticias_publicas(p_antes timestamptz, p_limite int)` → `array`

Até 30 (padrão 12), do mais novo para o mais antigo. Paginação por
`p_antes` = `publicado_em` do último.

```
{ tipo, slug, titulo, resumo, texto,   // texto só para tópico (notícia: abre a página)
  autor, publicado_em,
  imagem: "noticias/<id>/1.jpg" | null,
  reacoes: { "👏": 3 } | null,         // null para tópico
  ref }                                // ref = id, para a página de reação
```

### `noticia_publica(p_slug text)` → `{status, ...}`

- `nao_encontrada`.
- `ok` → `{slug, redirecionar, tipo, titulo, subtitulo, texto, autor,
  publicado_em, publico, imagens:[{url, legenda}], reacoes, minha_reacao, ref}`.
  `redirecionar = true` quando `p_slug` é um slug antigo: troque o endereço
  para `slug` com `history.replaceState` (sem recarregar).

### `comunidade_inscrever(p_email, p_nome, p_consentimento boolean)` → `{status}`

`ok` (sempre igual, exista ou não o e-mail: a tela diz "Se o endereço
estiver certo, você vai receber um e-mail para confirmar a inscrição."),
`email_invalido`, `nome_invalido`, `consentimento`, `limite`.

### `comunidade_confirmar(p_token uuid)` → `{status}`

`ok` ou `invalido` (link expirado em 7 dias, já usado ou errado). O link
do e-mail é `https://neurodynamics.dev/#/newsletter/confirmar?t=<token>`.

## Endereços

| O quê | Endereço |
|---|---|
| Feed da equipe | `#/equipe/feed` (portal) |
| Mesa editorial | `#/equipe/feed/editorial` (portal, só editor) |
| Newsletter | `#/equipe/newsletter` (portal, editor ou liderança) |
| Lista de notícias | `https://neurodynamics.dev/#/news` |
| Notícia | `https://neurodynamics.dev/#/news/<slug>` |
| Confirmar inscrição | `https://neurodynamics.dev/#/newsletter/confirmar?t=<token>` |
| Reagir (fora do portal) | `https://membro.neurodynamics.dev/noticia.html?n=<slug>` |

## O que fica de fora (decidido)

- **Metadados por matéria para redes sociais** (Open Graph por notícia):
  o site é estático com rotas `#/`; robôs de redes não executam JS. Fica a
  descrição geral do site. Para ter prévia por matéria é preciso um passo de
  build ou um proxy; decisão do usuário, fora da 2.19.1.
- Comentários: não há.
