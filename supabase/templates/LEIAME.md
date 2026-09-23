# Os e-mails do Supabase, no padrão do portal

O Supabase manda seis e-mails por conta própria: confirmação de cadastro,
convite, link de acesso, troca de e-mail, redefinição de senha e o código de
reautenticação. De fábrica, eles saem em inglês, com o layout dele e pelo
remetente de teste dele.

Os modelos desta pasta trocam isso pelo mesmo desenho dos avisos do portal,
o `corpoHTML` de [`functions/notificar-email`](../functions/notificar-email/index.ts):
fundo cinza-claro, cartão branco, logo teal, "Olá", um bloco com borda, o
botão e o rodapé cinza. O texto é em português.

| Modelo no Supabase | Arquivo | Assunto | Quando sai |
|---|---|---|---|
| **Confirm signup** | `confirmar-cadastro.html` | Confirme o seu e-mail · Portal do Membro | *Criar conta*, na tela de entrada |
| **Invite user** | `convite.html` | Você foi convidado para o Portal do Membro | *Invite user*, no painel do Supabase (o portal não convida) |
| **Magic Link** | `link-de-acesso.html` | Seu link de acesso ao Portal do Membro | entrar sem senha — o portal não oferece hoje |
| **Change Email Address** | `trocar-email.html` | Confirme a troca de e-mail · Portal do Membro | troca do e-mail da conta — o portal não oferece hoje |
| **Reset Password** | `redefinir-senha.html` | Redefina a sua senha · Portal do Membro | *Esqueci minha senha*, e a chavinha de *Administração › Contas* |
| **Reauthentication** | `reautenticacao.html` | Seu código de confirmação · Portal do Membro | confirmação de alteração sensível — o portal não pede hoje |

Os três que o portal não usa hoje também estão aqui. Assim, se um dia
saírem, já saem no mesmo padrão.

---

## Passo 1 — O remetente: o mesmo dos avisos, pela Cloudflare

O envio padrão do Supabase é para teste: poucos e-mails por hora, com
restrição de entrega. Com o SMTP da Cloudflare, os e-mails de conta saem do
mesmo `portal@soma.neurodynamics.dev` dos avisos.

**Crie um token só para isto.** No painel da Cloudflare, em **My Profile →
API Tokens → Create Token → Create Custom Token**, dê a permissão **Account →
Email Sending → Edit**, limitada à conta da NeuroDynamics. Com um token
separado do `CF_API_TOKEN` dos avisos, revogar um não derruba o outro.

No painel do Supabase, em **Authentication → Emails → SMTP Settings**, ligue
**Enable custom SMTP** e preencha:

| Campo | Valor |
|---|---|
| Sender email | `portal@soma.neurodynamics.dev` |
| Sender name | `Portal do Membro` |
| Host | `smtp.mx.cloudflare.net` |
| Port | `465` |
| Username | `api_token` — confira o nome de usuário que a tela de SMTP da Cloudflare mostrar |
| Password | o token acima |

O remetente tem de estar no domínio de envio habilitado na Cloudflare, o do
registro `cf-bounce.`. O [README dos avisos](../functions/notificar-email/README.md)
explica como descobrir qual é.

Com o SMTP próprio, o limite de e-mails por hora passa a ser o de
**Authentication → Rate Limits**, que dá para ajustar.

## Passo 2 — Os modelos

Ainda em **Authentication → Emails**, agora na aba **Templates**, faça o
seguinte para cada modelo da tabela acima:

1. em **Subject**, cole o assunto da tabela;
2. em **Body**, apague o conteúdo e cole o arquivo `.html` **inteiro**, do
   `<!doctype html>` ao `</html>`;
3. clique em **Save changes**.

## Passo 3 — O teste

1. Na tela de entrada do portal, **crie uma conta** com um endereço seu que
   ainda não tenha conta.
2. Depois, use **Esqueci minha senha**.
3. Confira que os dois e-mails chegam em português, com o remetente certo e
   com o botão levando de volta ao portal. Olhe também o spam.

O link volta para o endereço de onde o pedido saiu. Esse endereço precisa
estar em **Authentication → URL Configuration → Redirect URLs**: sem ele, o
Supabase manda para a *Site URL*.

---

## Para mudar um modelo

Os seis nascem de um layout só, em `gerar.mjs`, para não divergirem entre
si nem dos avisos. Não edite os `.html` à mão.

```bash
cd supabase/templates
node gerar.mjs          # regrava os .html
node gerar.mjs --check  # só confere; sai com código 1 se algum estiver desatualizado
```

O script também recusa um modelo em três casos:
- falta nele a variável de que ele depende;
- ele usa uma variável que o Supabase não manda;
- sobrou nele um trecho de JavaScript.

As variáveis usadas são só quatro: `{{ .ConfirmationURL }}`, `{{ .Email }}`,
`{{ .NewEmail }}` (na troca de e-mail) e `{{ .Token }}` (o código da
reautenticação).

Mudou um modelo? Cole de novo no painel. O repositório guarda o original,
mas o Supabase não o lê daqui.

**"O link vale por 1 hora"** é o padrão do Supabase, em **Authentication →
Sign In / Providers → Email → Email OTP Expiration** = 3600. Se mudar o
prazo lá, mude o `UMA_HORA` do `gerar.mjs`, regenere e cole de novo.

O layout é cópia do `corpoHTML` dos avisos. Mudou o desenho lá, mude aqui
também.
