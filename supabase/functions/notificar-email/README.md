# notificar-email — os avisos do portal também por e-mail

O sininho do portal só avisa quem está com a tela aberta. Quem entra uma vez
por semana descobre a atividade atrasada na semana seguinte — e a culpa acaba
caindo no quadro, não no canal.

Esta função roda **em intervalo**, pergunta ao banco quem tem o que receber,
manda **um e-mail por pessoa** com tudo o que está pendente e dá baixa.

Agrupar é de propósito: cinco avisos na mesma hora viram um e-mail, não cinco.

Desde a 32.0 a fila **anda sozinha**: o próprio banco chama a função a cada
minuto e logo depois de cada aviso novo, sem chave para colar em lugar
nenhum (passo 6). A mesma passada leva os avisos do sino **ao aparelho** de
quem ativou as notificações no navegador ou no celular (Web Push, ver
[No aparelho](#no-aparelho-320)).

---

## Antes de tudo: o Cloudflare que você já usa não envia

Os endereços `@neurodynamics.dev` da equipe funcionam pelo **Email Routing**,
que **recebe e encaminha**. Ele não envia, não tem servidor de saída e não é
isso que ele se propõe a ser. Configurar o portal apontando para ele não vai
dar erro claro — vai dar tempo limite de conexão.

Quem envia é outro produto, o **Email Service → Email Sending**, da mesma
Cloudflare, no mesmo painel. O portal fala com ele pela **API HTTP** — sem
SMTP, sem porta, sem TLS para acertar. É de graça para o volume de uma equipe do nosso
tamanho e é o caminho mais curto, porque o domínio já está lá.

As duas coisas convivem: continuar recebendo em `alguem@neurodynamics.dev`
pelo Routing e enviar por `portal@soma.neurodynamics.dev` pelo Sending, ao
mesmo tempo, sem conflito — são domínios diferentes, cada um com o seu papel.

---

## Passo 1 — Habilitar o envio na Cloudflare

No painel da Cloudflare, **com a conta que administra `neurodynamics.dev`**:

1. menu lateral → **Compute** → **Email Service** → aba **Email Sending**;
2. **Add domain** (ou *Onboard domain*) e escolha `neurodynamics.dev`;
3. a Cloudflare mostra os registros de DNS que faltam (DKIM, e possivelmente
   um SPF e um MX de retorno). Como o DNS do domínio já é da Cloudflare, há um
   botão para **adicionar tudo automaticamente** — use esse botão em vez de
   digitar à mão;
4. espere o domínio sair de *Pending* e ficar **Verified**. Costuma levar
   minutos.

> **Se a Cloudflare reclamar de conflito no registro SPF:** é porque o Email
> Routing já criou um. Só pode existir **um** registro SPF por domínio — dois
> quebram os dois. A saída é juntar os dois `include:` num TXT só, na forma
> `v=spf1 include:_spf.mx.cloudflare.net include:<o que o Sending pedir> ~all`.
> Se aparecer, me manda o que está lá hoje e o que ele pediu, que eu monto a
> linha certa.

> Se algum registro pedido for **CNAME**, deixe a nuvem **cinza** (proxy
> desligado). Proxy em registro de e-mail quebra a verificação. TXT e MX não
> têm proxy, então não há o que fazer neles.

### Passo 2 — Criar o token que autoriza o envio

O envio pela Cloudflare não usa a senha de ninguém: usa um token de API.

1. canto superior direito → **My Profile** → **API Tokens** → **Create Token**;
2. **Create Custom Token**;
3. em **Permissions**, escolha **Account** → **Email Sending** → **Edit**;
4. em **Account Resources**, limite à conta da NeuroDynamics;
5. **Continue to summary** → **Create Token**;
6. **copie o token agora** — a Cloudflare não mostra de novo. Se perder, é só
   criar outro e apagar o antigo.

### Passo 3 — Criar o endereço remetente

Ainda em **Email Service → Email Sending**, cadastre o endereço que vai
assinar os e-mails.

### Descubra de qual domínio você pode enviar — isto é a parte traiçoeira

A Cloudflare habilita o envio **por subdomínio**, e nem sempre é o que você
imagina. O jeito de saber qual é: no painel do Email Sending, olhe os registros
de DNS que ela criou e ache o que começa com **`cf-bounce.`**

```
cf-bounce.soma.neurodynamics.dev     <- o que vem depois do ponto
          ^^^^^^^^^^^^^^^^^^^^^^        é o seu domínio de envio
```

No nosso caso é **`soma.neurodynamics.dev`**. Então o remetente tem de ser
algo como **`portal@soma.neurodynamics.dev`** — e **não** `soma@neurodynamics.dev`,
que parece certo e não é.

Enviar de um domínio que não está habilitado produz o erro `10202
email.sending.error.email.invalid`, que não diz qual endereço recusou nem por
quê. É a causa quase certa desse código.

> **Para onde vão as respostas.** O subdomínio de envio normalmente não
> *recebe* nada, então responder um aviso cairia no vazio. Defina o segredo
> `EMAIL_RESPONDER_PARA` com um endereço de verdade — um que exista no Email
> Routing, como `soma@neurodynamics.dev`. Quem apertar "Responder" escreve
> para lá.

Vale a pena que esse endereço **também** exista no Email Routing, encaminhando
para quem cuida do portal: assim, se alguém responder ao aviso, a resposta
chega em algum lugar em vez de sumir.

---

## Passo 4 — Guardar os segredos no Supabase

O envio é por **HTTP**, com a API da Cloudflare — não por SMTP. Então não há
host, porta nem TLS para acertar: são três valores.

No painel do Supabase, no projeto do portal:

**Project Settings** (engrenagem, no rodapé do menu lateral) → **Edge
Functions** → seção **Secrets** → **Add new secret**, um de cada vez:

| Nome | Valor | Onde achar |
|---|---|---|
| `CF_ACCOUNT_ID` | o id da sua conta na Cloudflare | painel da Cloudflare → menu lateral → **Manage Account** → *Account ID*. É também o trecho depois de `dash.cloudflare.com/` no endereço |
| `CF_API_TOKEN` | o token do passo 2 | você copiou no passo 2 |
| `EMAIL_DE` | `portal@soma.neurodynamics.dev` | o endereço do passo 3 — **no domínio do `cf-bounce.`**, escrito igual |
| `EMAIL_RESPONDER_PARA` | `soma@neurodynamics.dev` | para onde vai a resposta de quem apertar "Responder" (opcional, mas sem ele a resposta some) |

Opcional: `EMAIL_DE_NOME` é o nome que aparece antes do endereço na caixa de
entrada — *Portal do Membro* se você não definir. Como o endereço é
`soma@`, vale pôr **SOMA** ali, que é como a equipe chama o sistema.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem nesse ambiente — não
crie.

> **Se você já tinha configurado o SMTP antes**, o `SMTP_SENHA` serve de
> reserva para `CF_API_TOKEN`, e o `SMTP_DE` para `EMAIL_DE` — **desde que o
> `SMTP_DE` seja mesmo um endereço**. Na dúvida, defina o `EMAIL_DE`
> explicitamente: é uma linha, e tira a dúvida.
>
> O `SMTP_USER` **não** serve de remetente. No SMTP ele era o usuário da
> autenticação — na Cloudflare, a string `api_token` —, e não um endereço.
> Ele, `SMTP_HOST`, `SMTP_PORT` e `SMTP_TLS` não fazem mais nada e podem ser
> apagados.

### Outro provedor, se um dia sair da Cloudflare

A função não é casada com ela. Para usar o [Resend](https://resend.com), dois
segredos a mais e nada de código:

| Nome | Valor |
|---|---|
| `EMAIL_PROVEDOR` | `resend` |
| `RESEND_API_KEY` | a chave da conta |

`EMAIL_DE` continua valendo, e o domínio precisa estar verificado lá também.

## Passo 5 — Publicar a função

Tudo pelo navegador, sem instalar nada.

1. no painel do Supabase, menu lateral → **Edge Functions**;
2. botão **Deploy a new function** → escolha **Via Editor**;
3. no campo do nome, escreva exatamente `notificar-email` (com hífen, tudo
   minúsculo — é esse nome que vira o endereço);
4. o editor abre com um código de exemplo. **Apague tudo** o que estiver lá;
5. em outra aba, abra o arquivo
   [`index.ts`](https://github.com/neurodynamics-dev/membro/blob/main/supabase/functions/notificar-email/index.ts)
   aqui do repositório, clique no botão **Copy raw file** (o ícone de duas
   folhas, no alto à direita do código) e **cole** no editor do Supabase;
6. botão **Deploy function**. Leva menos de um minuto.

Deu certo quando `notificar-email` aparece na lista de Edge Functions com o
status **Active**.

> **O arquivo precisa ser o atual.** A liberação de origem (CORS) entrou depois
> das primeiras versões; sem ela o botão de teste do portal não consegue ler a
> resposta, mesmo com a função no ar.

> **Desligue a verificação de JWT** (desde a 32.0): Edge Functions →
> `notificar-email` → **Details** → *Enforce JWT verification* desligado →
> **Save**. A função confere sozinha quem chama: a senha que a 32.0 guardou
> no Vault (o agendamento do banco), a service role ou a sessão de quem está
> no portal. Com a verificação ligada, o painel recusa, antes de a função ver
> o pedido, todo chamado do agendamento que chegue sem um JWT (e as chaves
> novas do Supabase, `sb_secret_…`, não são JWT): a fila só anda quando
> alguém aperta o teste do portal, que vai com a sessão da pessoa. É o
> sintoma que a 32.0 corrige.

> **Quando o arquivo mudar** — porque eu corrigi alguma coisa —, é o mesmo
> caminho: Edge Functions → `notificar-email` → **Code** → apagar, colar a
> versão nova, **Deploy**.

### Passo 5b — Ver se chegou, de verdade

Depois de publicar, o teste é **um clique dentro do próprio portal**:

> sininho (no pé do menu; no celular, no topo) → **Preferências de avisos**
> → **Enviar um e-mail de teste**

Ele faz o ciclo inteiro na hora: cria um aviso para você, manda a função rodar
sem esperar o agendamento, e conta o que aconteceu em cada etapa. Não depende
de ninguém atribuir nada a você, e não depende do relógio.

O recado que aparece ali diz **qual** das coisas falhou, e é por isso que ele
existe — "não chegou nada" sozinho não ajuda ninguém:

| O que aparece | O que fazer |
|---|---|
| **Enviado.** com o seu endereço | deu certo. Não chegando em um minuto, procure no spam — e confira se o endereço mostrado é mesmo o seu |
| A sua conta ainda não está ligada a um registro do quadro | Administração › Contas, vincule a conta ao registro |
| A sua ficha não tem e-mail | Equipe › a sua ficha › preencha *E-mail NRO* ou *E-mail pessoal* |
| A função não foi encontrada | volte ao passo 5 — e confira o nome, que tem de ser exatamente `notificar-email` |
| O navegador não conseguiu falar com a função | ou ela não está publicada, ou está numa versão antiga, sem a liberação de origem. Veja o quadro abaixo |
| A função recusou a autenticação (401) | saia e entre no portal de novo. Persistindo, republique a função com o arquivo atual e desligue a verificação de JWT (passo 5) |
| A função respondeu `erro` | o detalhe vem junto; os Logs têm o resto |
| ainda não sabe por onde enviar | volte ao passo 4 — a mensagem diz **qual** segredo falta. Nada se perde |
| rodou mas não enviou nada | vem junto a resposta literal do provedor **e o remetente que ele tentou usar**. Quando *todas* falham, o suspeito é o remetente: é o único dado comum a todas as tentativas |
| `10202 email.sending.error.email.invalid` | o remetente quase certamente não está no domínio de envio. Confira o `cf-bounce.` no DNS (passo 3) e ajuste o `EMAIL_DE`. Falhando só uma, aí sim é a ficha daquela pessoa |
| A função não conseguiu ler a lista no banco | falta aplicar `db/v16_pessoal.sql` |
| Não consegui criar o aviso de teste (função inexistente) | falta aplicar `db/v18_teste_email.sql` |

> **Se aparecer "o navegador não conseguiu falar com a função" e ela estiver
> como Active:** é a versão publicada que está velha. As primeiras versões
> deste arquivo não traziam a liberação de origem (CORS), e sem ela o navegador
> descarta a resposta mesmo com tudo funcionando do outro lado. Republique
> pelo passo 5 com o arquivo atual e teste de novo.
>
> Um detalhe dessa versão antiga: a sondagem que o navegador manda antes do
> pedido de verdade **executava a rotina inteira**. Então é possível que o
> e-mail de teste tenha saído, e só a resposta é que se perdeu — vale olhar a
> caixa de entrada antes de concluir que nada funciona.

> **O teste fura a sua preferência de propósito.** Mesmo quem escolheu *um
> resumo por dia* ou *só no portal* recebe o e-mail de teste — senão não dá
> para saber se o silêncio foi a preferência ou o envio. Só o teste faz isso;
> os avisos do dia a dia respeitam a escolha de cada um.

Se quiser ver os detalhes da execução, eles ficam em **Edge Functions** →
`notificar-email` → aba **Logs**.

### Testar pelo SQL, se preferir

Mesma coisa, sem sair do SQL Editor. Desde a 32.0, uma linha manda a função
rodar agora, com a senha do Vault, sem chave nenhuma à mão:

```sql
select fila_chamar('manual');
```

Ela devolve o id da chamada (ou nulo, quando já há uma passada rodando ou
houve uma chamada nos últimos 20 segundos), e a passada aparece em
`fila_passadas`, como no passo 6.

Antes da 32.0, o caminho era chamar pelo `pg_net` com a service role:

```sql
-- 1. cria o aviso de teste para VOCÊ (usa a sua sessão)
select notificacao_teste();

-- 2. manda a função rodar agora
create extension if not exists pg_net;
select net.http_post(
  url     := 'https://<referencia-do-projeto>.supabase.co/functions/v1/notificar-email',
  headers := jsonb_build_object(
               'Content-Type',  'application/json',
               'Authorization', 'Bearer <a-chave-service_role>')
);
```

| O que | Onde |
|---|---|
| **referência do projeto** | Project Settings → General → *Reference ID* |
| **chave service_role** | Project Settings → API → *Project API keys* → `service_role` → **Reveal** |

> A chave `service_role` **dá acesso total ao banco**. Não cole em conversa, em
> issue nem em lugar público. Se vazar, gere outra no mesmo lugar.

O `net.http_post` devolve só um número (o id da chamada) — o resultado de
verdade está nos **Logs** da função.

## Passo 6 — Agendar (a migração 32.0 faz isso)

A função não se chama sozinha: alguém precisa acordá-la de tempos em tempos.
Desde a 32.0, quem acorda é o **próprio banco**, e não há nada para montar à
mão. Aplique [`db/v32_fila_e_notificacoes.sql`](../../../db/v32_fila_e_notificacoes.sql)
no SQL Editor (o arquivo inteiro, **Run**) e confira as duas coisas do passo 5:
a função publicada com o arquivo atual e a verificação de JWT desligada.

O que a migração monta:

- **o relógio**: liga o `pg_cron` e o `pg_net` (o relógio e o telefone do
  banco) e agenda `soma-fila`, **a cada minuto**, que chama
  `fila_chamar('agendamento')`;
- **a senha**: gera uma e guarda no Vault (`soma_fila_token`). O banco manda
  a senha no cabeçalho `x-soma-fila` e a função confere com
  `fila_token_confere()`. Nenhuma chave de API fica escrita no agendamento;
- **o aviso na hora**: um aviso novo no sino, um e-mail da agenda, uma
  declaração ou um e-mail do processo seletivo acordam a fila logo depois de
  gravados (o gatilho `fila_acordar`), sem esperar o minuto do relógio. Os
  avisos de teste não acordam: quem testa manda a função rodar em seguida;
- **uma passada de cada vez** (`fila_passada_inicio` e `_fim`): as funções
  que leem as filas não reservam linhas, e duas passadas ao mesmo tempo
  mandariam o mesmo e-mail duas vezes. Quem chega com outra rodando recebe
  `{"status":"ocupada"}` e desiste, porque a outra leva o que estiver na fila;
- **o registro**: cada passada fica em `fila_passadas` (de onde veio, quando,
  o que saiu), com as últimas 2000;
- **a rede de segurança**: sem o agendamento, o portal aberto dá o empurrão
  (`fila_empurrar`), no máximo um a cada dois minutos para a equipe inteira,
  e só quando a fila está parada.

O agendamento antigo, `notificar-email`, montado pelo passo 6 das versões
anteriores deste arquivo, **sai**: com os dois, a fila passaria duas vezes.
O endereço do projeto e a chave que estavam escritos nele ficam guardados no
Vault. Se você criou o agendamento com **outro nome**, apague-o em
Integrations → Cron: o `soma-fila` faz o mesmo.

> **Se a migração avisar que não conseguiu ligar o `pg_cron` ou o `pg_net`:**
> ligue os dois pelo painel (Integrations → **Cron**; Database → Extensions →
> **pg_net**) e rode a 32.0 de novo. Enquanto isso, a fila anda pelo portal
> aberto e pelo teste.

### Conferir se está rodando

O jeito curto é **Administração › E-mails › Programados**, no card *A fila de
envio*: ele diz se a fila anda sozinha, quando foi a última passada do
agendamento, o que espera em cada fila e o último erro. Quando o agendamento
existe mas as passadas não chegam, o recado aponta a verificação de JWT. O
botão **Rodar a fila agora** faz uma passada na hora.

Pelo **SQL Editor**:

```sql
-- o agendamento
select jobname, schedule, active from cron.job where jobname = 'soma-fila';

-- as últimas passadas, com o que cada uma respondeu
select origem, inicio, fim, resultado
  from fila_passadas
 order by id desc
 limit 10;
```

A origem diz quem chamou: `agendamento` (o relógio), `evento` (um aviso
novo), `portal` (o empurrão), `teste` (o botão do portal), `manual` (o
`fila_chamar('manual')` do passo 5b) ou `servico` (a service role por extenso). Sem nenhuma linha `agendamento` nos
últimos minutos, o relógio não está chegando: confira a verificação de JWT e
a resposta do `pg_net`:

```sql
select status_code, content, created
  from net._http_response
 order by created desc
 limit 5;
```

Para desligar por um tempo: `select cron.unschedule('soma-fila');`. Para
ligar de novo, rode a 32.0 outra vez.

> **"CLI"** é o jeito de mexer no Supabase digitando comandos numa janela preta
> de terminal, em vez de clicando no painel. Dá no mesmo, e nada neste arquivo
> precisa dela. Se um dia alguém da equipe preferir esse caminho, os comandos
> equivalentes são `npx supabase functions deploy notificar-email --no-verify-jwt`
> e `npx supabase secrets set …`.

## Quem recebe o quê

A regra inteira mora no banco, em `notificacoes_email_lote()` e `push_lote()`
(donas desde a 2.18.0, seção "Notificações por tipo" de `db/2.18.0_soma.sql`).

Cada aviso do sino tem um tipo, e cada tipo pertence a uma **categoria**
(`notificacao_categoria(tipo)`):

| Categoria | Tipos |
|---|---|
| Atividades | `atividade_*` (atribuída, menção, moveu, prazo, sinalizada), `quadro_liberado`, `projeto_equipe` |
| Bugs e melhorias | `feedback_*` (novo, status, comentário) |
| Documentos | `doc_*` (revisão, aprovada, devolvida) |
| Studio | `studio_*` (aprovação, decisão, lembrete) |
| Reporte | `reporte_*`, `newsletter*` |
| Agenda | `agenda_*` (convite, resposta, cancelamento no sino), `evento_*` |
| Pessoal | `pessoal_*`, `solicitacao_respondida` |
| Treinamentos | `treinamento*` |
| Sistema | o resto (`cofre_troca` e o que vier sem categoria) |

Para cada categoria a pessoa escolhe (tabela `notificacao_canais`):

- **push**: ligado ou desligado (só na hora);
- **e-mail**: desligado, instantâneo, resumo diário ou resumo semanal.

Sem escolha, vale o padrão: **push ligado e e-mail em resumo semanal**.

- **instantâneo**: sai na próxima passada (avisos dos últimos 3 dias);
- **resumo diário**: um e-mail às **8h** (horário de Brasília) com os avisos
  pendentes das categorias em diário, agrupados por categoria;
- **resumo semanal**: um e-mail na **segunda às 8h**, do mesmo jeito (avisos
  dos últimos 8 dias);
- o lote devolve cada pessoa em até três envelopes (`modo`: `instantaneo`,
  `diario`, `semanal`). Um resumo é devido quando há aviso pendente daquele
  modo criado antes do último marco (`notificacao_resumo_marco`), e leva tudo
  o que está pendente do modo. Não há relógio guardado por pessoa;
- saem **sempre na hora**, fora da preferência: o e-mail de teste, os
  **convites e lembretes de evento** (fila `agenda_envios`) e as **pílulas e
  e-mails programados** (fila `email_programados`). O lembrete da véspera do
  Studio (`studio_lembrete`) sai na hora, a não ser que o e-mail do Studio
  esteja desligado;
- conta bloqueada (Desligado, Egresso, Sob demanda), membro fora de Ativo ou
  Em pausa, ou sem nenhum endereço na ficha, fica de fora do e-mail e do push;
- o sino recebe tudo, sempre.

**Agendamento.** Os resumos não pedem cron próprio: o `soma-fila` da 32.0
(`* * * * *`, `select public.fila_chamar('agendamento')`) chama a função a cada
minuto, e o banco decide quando o diário e o semanal são devidos. Basta conferir
que ele existe e está ativo:

```sql
select jobname, schedule, active from cron.job where jobname = 'soma-fila';
-- se não existir: select cron.schedule('soma-fila', '* * * * *', $$select public.fila_chamar('agendamento')$$);
```

Sem o `soma-fila`, o resumo só sai quando o portal aberto empurra a fila.

Cada pessoa muda isso sozinha: **sininho → Preferências de avisos**.

O endereço usado é o `email_nro`; não havendo, o `email_pessoal`. Quem não tem
nenhum dos dois na ficha nunca recebe — vale conferir isso no quadro antes de
concluir que a função está quebrada.

Uma falha de envio para uma pessoa não derruba o lote: o resto sai, e a
notificação que falhou conta a tentativa. Depois de 5, ela para de ser tentada
e continua visível no sininho — **o portal nunca depende do e-mail**.

### No aparelho (32.0)

Cada pessoa ativa as notificações **em cada aparelho** que quiser: sininho →
**Preferências de avisos** → *Neste aparelho* → **Ativar neste aparelho** (o
sino também convida, uma vez, quem ainda não ativou). O navegador pede a
permissão, cria a inscrição e o portal a grava por `push_inscrever()` na
tabela `push_inscricoes`. A cada passada, a função pega os avisos novos de quem
tem inscrição (`push_lote()`), cifra cada mensagem para o aparelho (RFC 8291),
assina com a chave VAPID (RFC 8292) e entrega ao serviço de push do
navegador, que a mostra mesmo com o SOMA fechado. O toque na notificação abre
o SOMA na tela do aviso (`sw.js`, na raiz do portal).

- **Não há nada para configurar.** O par de chaves VAPID nasce na primeira
  passada depois da 32.0 e fica no Vault (`soma_vapid_publica`,
  `soma_vapid_privada`). Apagar a privada desfaz todas as inscrições: cada
  aparelho precisa ativar de novo;
- o aparelho recebe **só o que nasceu depois de ativar**; vários avisos de uma
  vez viram um resumo ("5 avisos novos no SOMA", com os títulos);
- a preferência de e-mail **não** vale aqui: quem ativou no aparelho recebe
  no aparelho. Desativar é no mesmo lugar, e sair da conta desativa o
  aparelho de onde se saiu. A lista *Outros aparelhos que recebem* remove os
  que ficaram para trás;
- **no iPhone e no iPad** (iOS 16.4 ou mais novo), o Safari só entrega
  notificação ao SOMA **instalado na tela de início** e aberto pelo ícone. O
  tour (`tour#celular`) ensina o passo a passo;
- inscrição que o serviço de push dá por morta (404 ou 410: o navegador
  revogou ou foi desinstalado) sai na hora; a que falha 20 vezes seguidas,
  também;
- o teste é **Enviar uma notificação de teste**, ao lado do *Desativar*: cria
  um aviso só para o aparelho (`push_teste()`, sem e-mail e já lido) e roda a
  fila.

A resposta da função traz `push` (quantas saíram), `push_falhas`,
`push_mortas` e, quando algo falha, `push_detalhe`; sem a 32.0,
`push: "sem_migracao_32"`, e o e-mail segue como antes.

### O sino que não empilha (32.0)

- cada aviso tem o **×** para apagar, e o alto do sino tem **limpar as
  lidas** (`notificacoes_limpar()`, sempre só os da própria pessoa);
- o **expurgo** roda na passada da fila, uma vez por hora
  (`notificacoes_expurgar()`): sai o que foi lido há mais de 30 dias,
  qualquer aviso com mais de 120 e os de teste depois de um dia;
- o **aviso do e-mail de teste** substitui o anterior e já nasce lido: é um
  teste do envio, não uma novidade no sino.

### As declarações de participação (desde a 25.0)

Um evento registrado em **Serviços › Eventos e participações**, quando
aprovado, emite uma declaração de participação por participante — e cada uma
entra numa fila à parte, `doc_envios`. A mesma rodada da função entrega essa
fila, antes dos avisos do sino, com três diferenças:

- **um e-mail por declaração**, não um resumo: é a entrega de um documento;
- **sai sempre**, qualquer que seja a preferência de e-mail — e sai também
  para o **participante externo**, que não tem conta no portal (o endereço
  dele é o que foi registrado no evento; o do membro, o da ficha);
- o link leva à **validação pública** (`auth.neurodynamics.dev/?c=<código>`),
  que mostra o documento e baixa a segunda via. O membro ganha também o link
  do evento no portal.

Quem lê e dá baixa são `doc_envios_lote()` e `doc_envios_baixa()`, com a mesma
service role. Declaração revogada antes de sair (o evento foi reaberto) não é
enviada. A resposta da função traz `documentos` (quantas saíram),
`documentos_falhas` e, sem a migração 25.0 aplicada, `documentos:
"sem_migracao_25"` — o sino continua funcionando do mesmo jeito.

Não há nada novo para configurar: o provedor, o remetente e o agendamento são
os mesmos. Depois de aplicar a 25.0, **publique a função de novo**.

### A agenda (28.0)

A agenda tem fila própria, `agenda_envios`, lida por `agenda_envios_lote()` e
baixada por `agenda_envios_baixa()`, com a mesma service role. Entram nela:

- o **convite**, com *Sim*, *Talvez* e *Não*: cada botão é um link para
  `rsvp.html?t=<token>&r=<resposta>`, que responde sem login (o token é do
  convite, um por pessoa, e só serve para responder);
- a **mudança** de data, horário ou local, quando quem salvou escolheu avisar;
- o **cancelamento**;
- os **lembretes** de cada evento (os minutos antes definidos no evento ou
  no predefinido), gerados pelo próprio `agenda_envios_lote()` na janela certa.

Os convidados de fora recebem o convite e respondem pelo mesmo link. O aviso
também entra nas notificações do portal, marcado como já enviado, para o
resumo diário não repetir. A resposta da função traz `agenda` e
`agenda_falhas`; sem a 28.0, `agenda: "sem_migracao_28"`. Depois de aplicar a
28.0, **publique a função de novo**.

### Os e-mails programados (30.0)

O Full mailer (`#/admin/emails`) grava na fila `email_programados` o HTML
pronto, o assunto, a área que assina e o destino (a equipe toda, grupos ou
pessoas). A cada passada, a função pega até dez que venceram por
`email_programados_lote()` (que já traz quem recebe, com e-mail, e marca
*enviando* para duas passadas não mandarem o mesmo e-mail), troca
`{{primeiro_nome}}` e `{{nome}}` para cada pessoa (escapados no HTML) e envia
com o nome da área no remetente: `Leadership | NeuroDynamics <o DE de
sempre>`. O endereço continua o mesmo; muda só o nome de exibição. No fim,
`email_programados_baixa()` fecha como *enviado* (ou *erro*, se nenhum saiu)
com as contagens. As pílulas de conhecimento entram pelo mesmo caminho. A
resposta traz `programados` e `programados_falhas`; sem a 30.0,
`programados: "sem_migracao_30"`. Depois de aplicar a 30.0, **publique a
função de novo**.

### As entrevistas do processo seletivo (31.0)

A fila é `ps_envios`, lida por `ps_envios_lote()` e baixada por
`ps_envios_baixa()`, com a mesma service role e o remetente
`Processo Seletivo | NeuroDynamics`. Ao candidato: a **confirmação** da reserva
(com o link da chamada, quem conduz, o Google Agenda e a página de
acompanhamento já preenchida), o **reagendamento** feito pela equipe (o
horário antigo riscado, o novo e o motivo), a **troca do link** e o
**cancelamento** do horário (com o botão para escolher outro). A quem abriu os
horários: o **resumo da véspera**, gerado pelo próprio `ps_envios_lote()` a
partir das 18h (Brasília), com o perfil de cada candidato do dia seguinte, a
nota da dinâmica, os links e a ficha no portal. O endereço do site sai do
segredo `PS_SITE_URL` (padrão `https://selecao.neurodynamics.dev`). A resposta
da função traz `ps` e `ps_falhas`; sem a 31.0, `ps: "sem_migracao_31"`.

---

## Na renomeação para `soma.neurodynamics.dev`

Troque só `PORTAL_URL` nos segredos (ou defina, se nunca definiu — o padrão é
`https://membro.neurodynamics.dev`).

**Não** troque `MAILER_URL`: é de onde vêm as imagens, e os e-mails já
enviados apontam para lá. Endereço de imagem em e-mail já entregue não se
reescreve.

---

## Testes

Só as funções puras — enviar de verdade exige a conta do provedor.

```bash
node --experimental-strip-types email.test.ts
node --experimental-strip-types fila.test.ts
```

O `fila.test.ts` roda a função inteira (`servir`) com o banco e os serviços
de fora simulados: quem pode chamar (a senha do banco, a service role, a
sessão, a chave anônima antiga, ninguém), a vez de cada passada (a segunda
recebe *ocupada*, e a vez volta mesmo quando a passada falha) e o aviso que
chega ao aparelho, decifrado e com a assinatura VAPID conferida.

Entre elas estão os casos que mais custam caro:

- **título e corpo escritos por gente** (o nome de uma atividade, um
  comentário) são escapados antes de entrar no HTML;
- o **formato do pedido** de cada provedor — o REST da Cloudflare usa
  `address` onde o binding dos Workers usa `email`, e trocar os dois é o
  engano clássico;
- a **resposta 200 com `success:false`** da Cloudflare, que é recusa: quem
  olha só o código HTTP dá o envio por certo e não manda nada;
- o **e-mail da declaração de participação**: o período por extenso (virando
  o mês e o ano), as horas, o link com o código para a validação pública, o
  nome do evento escapado, e o link do portal só para quem é membro;
- os **e-mails da agenda**: o convite com os três links de resposta, a
  mudança, o cancelamento e o lembrete, com o título escapado;
- a **cifra do aviso no aparelho**, conferida byte a byte com o exemplo da
  RFC 8291, e o JWT da VAPID (ES256) com a assinatura verificada.
