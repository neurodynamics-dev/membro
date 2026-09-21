# notificar-email — os avisos do portal também por e-mail

O sininho do portal só avisa quem está com a tela aberta. Quem entra uma vez
por semana descobre a atividade atrasada na semana seguinte — e a culpa acaba
caindo no quadro, não no canal.

Esta função roda **em intervalo**, pergunta ao banco quem tem o que receber,
manda **um e-mail por pessoa** com tudo o que está pendente e dá baixa.

Agrupar é de propósito: cinco avisos na mesma hora viram um e-mail, não cinco.

---

## Antes de tudo: o Cloudflare que você já usa não envia

Os endereços `@neurodynamics.dev` da equipe funcionam pelo **Email Routing**,
que **recebe e encaminha**. Ele não envia, não tem servidor de saída e não é
isso que ele se propõe a ser. Configurar o portal apontando para ele não vai
dar erro claro — vai dar tempo limite de conexão.

Quem envia é outro produto, o **Email Service → Email Sending**, da mesma
Cloudflare, no mesmo painel. É de graça para o volume de uma equipe do nosso
tamanho e é o caminho mais curto, porque o domínio já está lá.

As duas coisas convivem: continuar recebendo em `alguem@neurodynamics.dev`
pelo Routing e enviar por `portal@neurodynamics.dev` pelo Sending, ao mesmo
tempo, sem conflito.

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

### Passo 2 — Criar o token que serve de senha

O SMTP da Cloudflare não usa a senha de ninguém: usa um token de API.

1. canto superior direito → **My Profile** → **API Tokens** → **Create Token**;
2. **Create Custom Token**;
3. em **Permissions**, escolha **Account** → **Email Sending** → **Edit**;
4. em **Account Resources**, limite à conta da NeuroDynamics;
5. **Continue to summary** → **Create Token**;
6. **copie o token agora** — a Cloudflare não mostra de novo. Se perder, é só
   criar outro e apagar o antigo.

### Passo 3 — Criar o endereço remetente

Ainda em **Email Service → Email Sending**, cadastre o endereço que vai
assinar os e-mails. Sugiro `portal@neurodynamics.dev`.

Vale a pena que esse endereço **também** exista no Email Routing, encaminhando
para quem cuida do portal: assim, se alguém responder ao aviso, a resposta
chega em algum lugar em vez de sumir.

---

## Passo 4 — Guardar os segredos no Supabase

No painel do Supabase, no projeto do portal:

**Project Settings** (engrenagem, no rodapé do menu lateral) → **Edge
Functions** → seção **Secrets** → **Add new secret**, um de cada vez:

| Nome | Valor |
|---|---|
| `SMTP_HOST` | `smtp.mx.cloudflare.net` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `api_token` — mas confira: use exatamente o *username* que a tela de SMTP da Cloudflare mostrar |
| `SMTP_SENHA` | o token do passo 2 |
| `SMTP_DE` | `portal@neurodynamics.dev` |

Não defina `SMTP_TLS`. Ela existe só para servidor que foge da convenção da
porta, e a Cloudflare segue a convenção.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem nesse ambiente — não
crie.

> **Por que a porta 465 e não a 587.** Na 465 a conversa é criptografada desde
> o primeiro byte; na 587 ela começa em texto claro e sobe com STARTTLS. A
> Cloudflare só aceita a primeira forma. Trocar as duas não dá erro legível:
> a conexão simplesmente pendura até dar tempo limite.

### Outros provedores

A função não é casada com a Cloudflare. Qualquer SMTP serve — só mude os
segredos:

| Provedor | `SMTP_HOST` | `SMTP_PORT` | `SMTP_USER` |
|---|---|---|---|
| Cloudflare Email Sending | `smtp.mx.cloudflare.net` | `465` | `api_token` |
| Resend | `smtp.resend.com` | `465` | `resend` |
| Brevo | `smtp-relay.brevo.com` | `587` | o e-mail da conta |
| Gmail / Workspace | `smtp.gmail.com` | `465` | o endereço completo |

No Gmail a senha **não** é a da conta: é uma *senha de app*, e ela só aparece
depois de ligar a verificação em duas etapas.

---

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

> **Não mexa na verificação de JWT** (vem ligada, e é assim que tem de ficar).
> Diferente do `agenda-ics`, aqui não há token na URL e ninguém de fora
> precisa chamar: quem chama é o agendamento, autenticado.

> **Quando o arquivo mudar** — porque eu corrigi alguma coisa —, é o mesmo
> caminho: Edge Functions → `notificar-email` → **Code** → apagar, colar a
> versão nova, **Deploy**.

### Passo 5b — Ver se ela responde

O jeito mais simples é **fazer o passo 6 primeiro** (agendar) e, cinco minutos
depois, olhar os registros. Mas se quiser provocar uma execução na hora, dá,
pelo navegador:

No **SQL Editor** → **New query**, cole e clique em **Run**:

```sql
create extension if not exists pg_net;

select net.http_post(
  url     := 'https://<referencia-do-projeto>.supabase.co/functions/v1/notificar-email',
  headers := jsonb_build_object(
               'Content-Type',  'application/json',
               'Authorization', 'Bearer <a-chave-service_role>')
);
```

Onde achar as duas coisas entre `<>`:

| O que | Onde |
|---|---|
| **referência do projeto** | Project Settings → General → *Reference ID*. É também o pedaço do meio do endereço do painel |
| **chave service_role** | Project Settings → API → *Project API keys* → linha `service_role` → **Reveal** |

> A chave `service_role` **dá acesso total ao banco**. Não cole em conversa, em
> issue nem em nenhum lugar público. Se vazar, dá para gerar outra no mesmo
> lugar.

Esse comando responde só um número — o id da chamada. **O que a função
respondeu de verdade** está em **Edge Functions** → `notificar-email` → aba
**Logs**, alguns segundos depois:

| Aparece nos logs | O que quer dizer |
|---|---|
| `"status":"ok"` | rodou. Vem junto `pessoas`, `enviadas` e `falhas` |
| `"status":"smtp_nao_configurado"` | falta `SMTP_HOST`, `SMTP_USER` ou `SMTP_SENHA` no passo 4 — e **nada foi consumido**, dá para configurar e rodar de novo |
| `"status":"erro_no_lote"` | o banco recusou a consulta. A migração `v16_pessoal.sql` foi aplicada? |
| `"status":"sem_configuracao"` | problema do próprio ambiente do Supabase; me avise |
| `"status":"enviou_mas_nao_deu_baixa"` | os e-mails saíram mas o banco não registrou. Pode chegar repetido na rodada seguinte — me avise |

`"pessoas":0` na primeira vez é normal: quer dizer que não havia aviso pendente
para ninguém. Para criar um, peça a alguém que atribua uma atividade a você e
rode de novo.

## Passo 6 — Agendar

A função não se chama sozinha: alguém precisa acordá-la de tempos em tempos.

### Pelo painel — é o caminho curto

1. menu lateral → **Integrations** → **Cron**;
2. se aparecer um convite para ligar as extensões `pg_cron` e `pg_net`,
   aceite — são o relógio e o telefone do banco;
3. **Create job**;
4. preencha:
   - **Name**: `notificar-email`
   - **Schedule**: `*/5 * * * *` (a cada cinco minutos)
   - **Type**: *Supabase Edge Function* → escolha `notificar-email` na lista;
5. **Create**.

O painel cuida da autenticação sozinho — por isso este caminho é melhor: não
precisa colar chave nenhuma.

Cinco minutos é um bom intervalo: perto o bastante de "imediato" para quem
espera resposta, e longe o bastante para juntar numa mensagem só a rajada de
avisos que uma mesma ação gera.

### Pelo SQL, se o painel não oferecer o Cron

No **SQL Editor**, uma vez só. A chave fica guardada no cofre do banco, em vez
de escrita dentro da tabela de agendamentos:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('<a-chave-service_role>', 'chave_servico');

select cron.schedule('notificar-email', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<referencia-do-projeto>.supabase.co/functions/v1/notificar-email',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' ||
                   (select decrypted_secret from vault.decrypted_secrets
                     where name = 'chave_servico'))
  );
$$);
```

### Conferir se está rodando

**SQL Editor**, quando quiser:

```sql
select status, start_time, return_message
  from cron.job_run_details
 order by start_time desc
 limit 10;
```

`succeeded` na coluna `status` quer dizer que a chamada saiu. **Se o que você
quer saber é se o e-mail saiu**, isso está nos Logs da função, como no passo 5b.

Para desligar por um tempo: `select cron.unschedule('notificar-email');`

> **"CLI"** é o jeito de mexer no Supabase digitando comandos numa janela preta
> de terminal, em vez de clicando no painel. Dá no mesmo, e nada neste arquivo
> precisa dela. Se um dia alguém da equipe preferir esse caminho, os comandos
> equivalentes são `npx supabase functions deploy notificar-email` e
> `npx supabase secrets set …`.

## Quem recebe o quê

A regra inteira mora no banco, em `notificacoes_email_lote()`, e é curta:

- quem escolheu **A cada aviso** recebe o que estiver pendente;
- quem escolheu **Um resumo por dia** só entra se já faz mais de 20h desde o
  último e-mail;
- quem escolheu **Só no portal** nunca entra;
- quem nunca escolheu nada recebe como "a cada aviso" — a ausência de
  preferência não pode virar silêncio;
- membro desligado, ou sem nenhum endereço na ficha, fica de fora.

Cada pessoa muda isso sozinha: **sininho → Preferências de e-mail**.

O endereço usado é o `email_nro`; não havendo, o `email_pessoal`. Quem não tem
nenhum dos dois na ficha nunca recebe — vale conferir isso no quadro antes de
concluir que a função está quebrada.

Uma falha de envio para uma pessoa não derruba o lote: o resto sai, e a
notificação que falhou conta a tentativa. Depois de 5, ela para de ser tentada
e continua visível no sininho — **o portal nunca depende do e-mail**.

---

## Na renomeação para `soma.neurodynamics.dev`

Troque só `PORTAL_URL` nos segredos (ou defina, se nunca definiu — o padrão é
`https://membro.neurodynamics.dev`).

**Não** troque `MAILER_URL`: é de onde vêm as imagens, e os e-mails já
enviados apontam para lá. Endereço de imagem em e-mail já entregue não se
reescreve.

---

## Testes

Só as funções puras — enviar de verdade exige servidor.

```bash
node --experimental-strip-types email.test.ts
```

Entre elas estão os dois casos que mais custam caro: **título e corpo escritos
por gente** (o nome de uma atividade, um comentário) são escapados antes de
entrar no HTML; e a **porta certa com o TLS certo**, que é a diferença entre
enviar e pendurar sem mensagem de erro.
