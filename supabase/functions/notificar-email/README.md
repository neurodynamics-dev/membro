# notificar-email — os avisos do portal também por e-mail

O sininho do portal só avisa quem está com a tela aberta. Quem entra uma vez
por semana descobre a atividade atrasada na semana seguinte — e a culpa acaba
caindo no quadro, não no canal.

Esta função roda **em intervalo**, pergunta ao banco quem tem o que receber,
manda **um e-mail por pessoa** com tudo o que está pendente e dá baixa.

Agrupar é de propósito: cinco avisos na mesma hora viram um e-mail, não cinco.

## O que decide quem recebe o quê

Nada aqui. A regra inteira mora no banco, em `notificacoes_email_lote()`
(migração `db/v16_pessoal.sql`), e é curta:

- quem escolheu **A cada aviso** recebe o que estiver pendente;
- quem escolheu **Um resumo por dia** só entra se já faz mais de 20h desde o
  último e-mail;
- quem escolheu **Só no portal** nunca entra;
- quem nunca escolheu nada recebe como "a cada aviso" — a ausência de
  preferência não pode virar silêncio;
- membro desligado ou sem endereço de e-mail fica de fora.

Cada pessoa muda isso sozinha: sininho → **Preferências de e-mail**.

O endereço usado é o `email_nro`; não havendo, o `email_pessoal`.

## Publicar

```bash
supabase functions deploy notificar-email
```

Deixe a **verificação de JWT ligada** (o padrão). Diferente do `agenda-ics`,
aqui não há token na URL e ninguém de fora precisa chamar: quem chama é o
agendamento, com a service role.

## Configurar o SMTP

Sem estas três, a função responde `smtp_nao_configurado` e **não** queima
tentativa de envio — as notificações ficam esperando, intactas.

```bash
supabase secrets set \
  SMTP_HOST=smtp.exemplo.org \
  SMTP_USER=portal@neurodynamics.dev \
  SMTP_SENHA='…'
```

| Variável | Padrão | Para que serve |
|---|---|---|
| `SMTP_HOST` | — | servidor de saída |
| `SMTP_PORT` | `587` | porta |
| `SMTP_USER` | — | usuário da autenticação |
| `SMTP_SENHA` | — | senha da autenticação |
| `SMTP_DE` | o `SMTP_USER` | remetente que aparece no e-mail |
| `SMTP_TLS` | ligado | `nao` desliga (só para servidor interno) |
| `PORTAL_URL` | `https://membro.neurodynamics.dev` | endereço nos links |
| `MAILER_URL` | `https://membro.neurodynamics.dev/mailer` | de onde vem a logo |
| `NOTIF_LOTE` | `200` | quantas notificações por execução |

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já existem no ambiente das Edge
Functions — não precisa defini-las.

> Na renomeação para `soma.neurodynamics.dev`, troque `PORTAL_URL`. O
> `MAILER_URL` é opcional trocar e melhor **não** trocar sem necessidade: as
> imagens precisam continuar no ar para os e-mails já enviados.

## Agendar

A função não se agenda sozinha. Com `pg_cron` e `pg_net` (os dois disponíveis
no Supabase), no SQL Editor — trocando a URL do projeto e a chave:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('notificar-email', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<projeto>.supabase.co/functions/v1/notificar-email',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer <SERVICE_ROLE_KEY>')
  );
$$);
```

Cinco minutos é um bom intervalo: perto o bastante de "imediato" para quem
espera resposta, longe o bastante para juntar a rajada de avisos que uma
mesma ação gera.

Para conferir o que rodou:

```sql
select * from cron.job_run_details order by start_time desc limit 10;
```

## As respostas

| `status` | O que é |
|---|---|
| `ok` | rodou; vem `pessoas`, `enviadas`, `falhas` |
| `smtp_nao_configurado` | falta segredo de SMTP; nada foi consumido |
| `sem_configuracao` | falta `SUPABASE_URL`/`SERVICE_ROLE_KEY` |
| `erro_no_lote` | o banco recusou a consulta (migração aplicada?) |
| `enviou_mas_nao_deu_baixa` | e-mails saíram mas a baixa falhou — **pode repetir** |

Uma falha de envio para uma pessoa não derruba o lote: o resto sai, e a
notificação que falhou conta a tentativa. Depois de 5, ela para de ser
tentada e continua visível no sininho — o portal nunca depende do e-mail.

## Testes

Só as funções puras (montagem do e-mail); enviar de verdade exige servidor.

```bash
node --experimental-strip-types email.test.ts
```

Entre elas está o caso que mais importa: **título e corpo escritos por gente**
(um comentário, o nome de uma atividade) são escapados antes de entrar no
HTML.
