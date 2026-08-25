# agenda-ics — o feed da agenda no Google

Edge Function que serve **um arquivo `.ics` por membro**. A pessoa assina esse
endereço uma vez no Google Agenda e, daí em diante, tudo o que o portal mostra
para ela aparece na agenda pessoal dela — sem mais nenhum passo.

```
/functions/v1/agenda-ics?t=<token>
```

O token é gerado pelo próprio membro em **Agenda → Minha agenda → Receber a
agenda da NeuroDynamics no Google**, e ele pode trocá-lo quando quiser (o
anterior para de valer na hora).

## O que entra no arquivo

Exatamente o que o portal mostraria para aquela pessoa, porque é a **mesma
função do banco** que responde às duas telas (`agenda_feed` → `agenda_itens_para`):

- reuniões e eventos marcados como *toda a equipe*;
- os compromissos dos grupos dela e aqueles em que foi convidada;
- as cerimônias de scrum do time;
- os marcos do semestre (feriados, calendário da UFMG, prazos);
- as **próprias** férias e ausências.

O que **não** entra: compromissos de que ela não participa, férias dos colegas
e os sinais de presença dos outros ("no LABBIO", "temporariamente ausente") —
esses ficam no portal, não fazem sentido na agenda pessoal de mais ninguém.

## Publicar

1. Supabase → **Edge Functions** → *Deploy a new function* → **via editor**.
2. Nome: `agenda-ics`. Cole o `index.ts`. Deploy.
3. **Desligue a verificação de JWT desta função.** Quem busca o arquivo é o
   Google, que não tem sessão; a credencial é o token da URL.

Pelo CLI: `supabase functions deploy agenda-ics --no-verify-jwt`.

As variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` já são injetadas.

## Os dois caminhos até o Google — e quando usar cada um

| | Feed (esta função) | "Convidar pelo Google" (botão no compromisso) |
|---|---|---|
| Esforço | assinar uma vez | um clique de quem organiza, por evento |
| Chega em | uma agenda separada, no Google | a caixa de entrada, como convite com RSVP |
| Velocidade | o Google atualiza quando quer (costuma levar horas) | na hora |
| Serve para | ver a agenda da equipe no dia a dia | a reunião que precisa de confirmação |

O botão monta o formulário do Google já preenchido — inclusive com os
convidados, pelo **e-mail pessoal** de cada um (o Gmail do cadastro; o
`@neurodynamics.dev` não é uma conta Google e não receberia o convite na
agenda). Quem organiza clica em *Salvar* e o Google dispara os convites.

## Formato

- `DTSTART`/`DTEND` em UTC para compromissos com hora; `VALUE=DATE` com fim
  exclusivo para os de dia inteiro.
- `UID` estável por item (`<origem>-<id>@membro.neurodynamics.dev`), para o
  Google atualizar em vez de duplicar.
- Eventos entram como `TRANSP:OPAQUE` (ocupam a agenda); marcos e ausências
  como `TRANSP:TRANSPARENT` (aparecem sem bloquear).
- Quem respondeu "talvez" recebe `STATUS:TENTATIVE`.
- Janela publicada: 60 dias para trás, 365 para frente.
- Linhas dobradas em 75 octetos, contando acentos como 2 (RFC 5545).

## Conferir

```
node --experimental-strip-types ics-feed.test.ts
```
