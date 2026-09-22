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
Cloudflare, no mesmo painel. O portal fala com ele pela **API HTTP** — sem
SMTP, sem porta, sem TLS para acertar. É de graça para o volume de uma equipe do nosso
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
assinar os e-mails. Sugiro `portal@neurodynamics.dev`.

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
| `EMAIL_DE` | `portal@neurodynamics.dev` | o endereço do passo 3 |

Opcional: `EMAIL_DE_NOME` muda o nome que aparece antes do endereço na caixa de
entrada (o padrão é *Portal do Membro*).

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem nesse ambiente — não
crie.

> **Se você já tinha configurado o SMTP antes**, o `SMTP_SENHA` e o `SMTP_DE`
> continuam servindo como reserva de `CF_API_TOKEN` e `EMAIL_DE` — então basta
> acrescentar o `CF_ACCOUNT_ID`. Os demais (`SMTP_HOST`, `SMTP_PORT`,
> `SMTP_USER`, `SMTP_TLS`) não fazem mais nada e podem ser apagados.

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

> **Não mexa na verificação de JWT** (vem ligada, e é assim que tem de ficar).
> Diferente do `agenda-ics`, aqui não há token na URL e ninguém de fora
> precisa chamar: quem chama é o agendamento, autenticado.

> **Quando o arquivo mudar** — porque eu corrigi alguma coisa —, é o mesmo
> caminho: Edge Functions → `notificar-email` → **Code** → apagar, colar a
> versão nova, **Deploy**.

### Passo 5b — Ver se chegou, de verdade

Depois de publicar, o teste é **um clique dentro do próprio portal**:

> sininho (no alto, à direita) → **Preferências de e-mail** → **Enviar um
> e-mail de teste**

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
| A função recusou a autenticação (401) | saia e entre no portal de novo |
| A função respondeu `erro` | o detalhe vem junto; os Logs têm o resto |
| ainda não sabe por onde enviar | volte ao passo 4 — a mensagem diz **qual** segredo falta. Nada se perde |
| rodou mas não enviou nada | vem junto a resposta literal do provedor, que costuma nomear o problema (remetente não verificado, token sem permissão…) |
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

Mesma coisa, sem sair do SQL Editor:

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

Só as funções puras — enviar de verdade exige a conta do provedor.

```bash
node --experimental-strip-types email.test.ts
```

Entre elas estão os casos que mais custam caro:

- **título e corpo escritos por gente** (o nome de uma atividade, um
  comentário) são escapados antes de entrar no HTML;
- o **formato do pedido** de cada provedor — o REST da Cloudflare usa
  `address` onde o binding dos Workers usa `email`, e trocar os dois é o
  engano clássico;
- a **resposta 200 com `success:false`** da Cloudflare, que é recusa: quem
  olha só o código HTTP dá o envio por certo e não manda nada.
