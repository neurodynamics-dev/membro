# agenda-sync — sincronização com o Google Agenda

Edge Function do Portal do Membro. Lê o link `.ics` que cada pessoa guardou
em **Calendário → Minha agenda** e grava em `portal_agenda_blocos` apenas os
**horários ocupados** — é isso que o Assistente de agendamento desenha.

Ela existe porque o navegador não consegue buscar o `.ics`: o
`calendar.google.com` não devolve cabeçalhos CORS. Quem busca é o servidor.

## Arquivos

| Arquivo        | O que é |
|----------------|---------|
| `index.ts`     | **Tudo**: o leitor de iCalendar (parte 1) e a função em si (parte 2) |
| `ics.test.ts`  | 20 casos de conferência do leitor |

O leitor mora no mesmo arquivo de propósito. O painel do Supabase publica
colando **um** arquivo no editor, e um `import` relativo a um segundo arquivo
não sobrevive a isso — o deploy falha com *Module not found*.

## Publicar

Não precisa de CLI nem de Docker — dá para colar pelo painel:

1. Supabase → **Edge Functions** → *Deploy a new function* → **via editor**.
2. Nome: `agenda-sync`.
3. Cole o `index.ts` inteiro.
4. Deploy.

Pelo CLI, se preferir: `supabase functions deploy agenda-sync`.

As variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`
já são injetadas pelo Supabase; não há nada para configurar.

## Como é chamada

Sempre `POST`, com o `Authorization` da sessão de quem chamou:

| Corpo               | O que faz | Quem pode |
|---------------------|-----------|-----------|
| `{}`                | sincroniza a agenda de quem chamou | qualquer membro |
| `{"registro": 12}`  | sincroniza a de outra pessoa | `admin` e `pessoal` |
| `{"todos": true}`   | todas as agendas conectadas e ativas | `admin`, `pessoal` e a service role (cron) |

O portal chama sozinho ao salvar o link e no botão *Sincronizar agora*; o
`admin.html` chama com `{"todos": true}`. Para rodar de hora em hora sem
ninguém abrir o portal, veja o bloco **OPCIONAL** no fim do `soma_v12.sql`
(pg_cron + pg_net, com a chave no Vault).

## O que ela guarda — e o que não guarda

Guarda: `registro`, `inicio`, `fim`, se é dia inteiro, o `UID` do evento e,
**só se a pessoa tiver marcado "compartilhar títulos"**, o `SUMMARY`.

Não guarda (nem lê para lugar nenhum): convidados, descrição, local, anexos,
organizador. Ficam de fora dos blocos os eventos cancelados, os marcados como
*livre* no Google (`TRANSP:TRANSPARENT`, que é o padrão dos eventos de dia
inteiro) e as ocorrências que a pessoa excluiu de uma série.

A janela sincronizada é de 7 dias para trás a 60 dias para frente; cada
sincronização reescreve os blocos daquela pessoa.

## Limites conhecidos

- **O Google publica o `.ics` com atraso.** O feed do endereço secreto é
  servido de cache: uma reunião criada agora pode levar de alguns minutos a
  algumas horas para aparecer aqui. Para livre/ocupado em tempo real seria
  preciso trocar o link pelo OAuth da API do Google Calendar — outra história,
  e outro cadastro.
- Só o calendário do link. Quem tem vários calendários no Google precisa
  escolher qual conectar (ou, no Google, sobrepor os outros nele).
- `RRULE` cobre `DAILY`, `WEEKLY`, `MONTHLY` e `YEARLY` com `INTERVAL`,
  `COUNT`, `UNTIL`, `BYDAY`, `BYMONTHDAY` e `BYMONTH` — o que o Google
  gera na prática. `BYSETPOS` e `BYWEEKNO` não são interpretados.
- Convites recusados por você continuam ocupando, se ainda estiverem no
  calendário: o `.ics` não diz qual `ATTENDEE` é o dono do feed.

## Conferir o leitor

```
node --experimental-strip-types ics.test.ts     # Node 22+
deno run ics.test.ts                            # ou Deno
```
