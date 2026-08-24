# Portal do Membro — membro.neurodynamics.dev

Portal restrito aos membros da NeuroDynamics, com o **mesmo login do SOMA**
e a linguagem visual do site institucional (paleta escura, vidro, fundo
animado, Archivo + IBM Plex Mono). Arquivo único (`index.html`), no mesmo
padrão dos demais apps do SOMA.

## O que o portal faz

- **Quadro de avisos** — banner rotativo na home, com layouts pré-definidos
  (`padrão`, `destaque`, `urgente`, `evento`, `conquista`), mantido pela
  gestão no painel `admin.html`.
- **Resumo da agenda e do check-in** — os próximos eventos do mesmo
  calendário do SOMA (com RSVP dos convites pendentes) e quem está no
  LABBIO agora, pelas presenças do sistema de check-in.
- **Calendário** — três abas:
  - **Mês** — visão mensal apenas com o que é geral da equipe: reuniões
    gerais, confraternizações, visitas e os marcos do calendário (férias,
    processo seletivo, prazos e datas da UFMG);
  - **Agendar reunião** — o assistente de agendamento: escolha as pessoas
    ou o grupo e veja, lado a lado, o livre/ocupado de cada um, com
    sugestões de horário e o convite criado como evento do SOMA (com RSVP);
  - **Minha agenda** — onde cada membro conecta o próprio Google Agenda
    (endereço secreto em formato iCal) e define o seu expediente.
- **Organização** — o mesmo Org Explorer do SOMA (estilo Microsoft Teams):
  cadeia de gestão, colegas de equipe e liderados, com busca.
- **Informações** — biblioteca de documentos e políticas (estatuto,
  políticas, guias, formulários) publicados como links do Google Drive
  pelo Depto. de Pessoal; o controle fino de acesso continua no Drive.
- **Serviços** — solicitações ao Depto. de Pessoal com protocolo:
  - **Solicitação de acesso** a documento, sistema/plataforma ou local,
    com catálogo do SOMA, **justificativa** e **tempo necessário**;
  - afastamento temporário (período + motivo);
  - pedido de desligamento;
  - reunião 1:1 com o gestor imediato;
  - **ouvidoria anônima** para a Gestão de Pessoas (sem vínculo com a
    conta, por projeto de banco — ver `soma_v10.sql`);
  - outras solicitações.
- **Meus pedidos** — acompanhamento das solicitações, com status e
  resposta do Depto. de Pessoal, e cancelamento enquanto pendente.

## Conteúdo

| Arquivo        | O que é |
|----------------|---------|
| `index.html`   | O portal (rotas por hash: `#/`, `#/calendario`, `#/calendario/agendar`, `#/calendario/minha`, `#/organizacao`, `#/informacoes`, `#/servicos`, `#/pedidos`) |
| `admin.html`   | Painel do Depto. de Pessoal: avisos, documentos, triagem de solicitações, ouvidoria e estado das agendas |
| `soma_v10.sql` | Migração do banco (tabelas `portal_*`, RLS e funções) |
| `soma_v11.sql` | Migração da biblioteca de documentos (`portal_documentos`) |
| `soma_v12.sql` | Migração da agenda: `portal_agendas`, blocos de ocupação e o RPC que alimenta o assistente |
| `supabase/functions/agenda-sync/` | Edge Function que lê o `.ics` de cada um e grava os horários ocupados ([detalhes](supabase/functions/agenda-sync/README.md)) |
| `CNAME`        | Domínio do GitHub Pages (`membro.neurodynamics.dev`) |

## Pré-requisitos

Aplicar as migrações **`soma_v10.sql`**, **`soma_v11.sql`** e
**`soma_v12.sql`** (na raiz deste repositório) no SQL Editor do Supabase,
com a SOMA 9.0 já aplicada. Sem elas o portal entra, mas o quadro de avisos,
as solicitações e o assistente de agendamento ficam indisponíveis (as demais
abas — agenda, check-in, calendário e organização — usam as tabelas que
o SOMA já tem).

A sincronização com o Google exige também publicar a Edge Function
**`agenda-sync`** (instruções em
[`supabase/functions/agenda-sync/README.md`](supabase/functions/agenda-sync/README.md);
dá para colar pelo painel, sem CLI). Sem ela o assistente continua
funcionando — só que a disponibilidade vem apenas dos eventos do SOMA e das
ausências, e ninguém consegue conectar o Google Agenda.

## Papéis e permissões

- **Qualquer conta do SOMA** entra no portal, vê avisos publicados,
  agenda, presença, calendário e organograma.
- **Solicitações** exigem conta **vinculada a um registro de membro
  ativo** (vínculo feito pelo Depto. de Pessoal no SOMA · Gestão).
- **Agendar reunião** exige conta vinculada a um registro: o convite é
  criado como um evento do SOMA, em nome de quem agendou.
- **`admin.html`** é liberado só para os papéis `admin` e `pessoal`.
- **Ouvidoria**: a mensagem é gravada por função `security definer`
  sem nenhuma referência à conta, sem gatilho de auditoria e com a data
  truncada para o dia. Anonimato por projeto, não por promessa.

## Como operar (Depto. de Pessoal)

1. **Avisos**: crie e publique em `/admin.html` → *Quadro de avisos*.
   O layout tem pré-visualização ao vivo; a ordem define o rodízio.
2. **Solicitações**: triagem em `/admin.html` → *Solicitações*
   (em análise → aprovar/recusar → concluir, com resposta ao membro).
   Ao aprovar um **acesso**, conceda-o na ficha do membro no
   SOMA · Gestão (aba Acessos) — o painel registra a decisão, a
   concessão continua onde sempre foi.
3. **Ouvidoria**: leia e marque como tratada. Sem como responder
   individualmente — é anônima.
4. **Calendário da UFMG**: datas acadêmicas entram como marcos do
   calendário no SOMA · Gestão (tipo "outro", ou o que couber) e
   aparecem automaticamente no portal.
5. **Agendas**: em `/admin.html` → *Agendas* você vê quem já conectou o
   Google Agenda, o horário da última sincronização e o erro de quem
   falhou, e pode forçar uma sincronização geral. O link `.ics` em si
   **não** aparece ali — a RLS só o devolve ao próprio dono.

## Como publicar

O GitHub Pages atende **um domínio por repositório** — mesmo esquema dos
demais sites:

1. Ative o Pages neste repositório (branch `main`, raiz).
2. No Cloudflare, aponte `membro.neurodynamics.dev` → `CNAME` para
   `neurodynamics-dev.github.io`.

## Segurança

### Agenda e Google Calendar

O link `.ics` é uma credencial: quem o tem lê o calendário inteiro. Por
isso ele mora em `portal_agenda_segredo`, uma tabela separada cuja política
de RLS devolve **só a linha do próprio dono** — nem `admin` nem `pessoal`
leem o link de ninguém. Quem lê é a Edge Function, com a service role key.

Do calendário, o banco guarda apenas início e fim de cada compromisso. O
**título** só é gravado se a pessoa marcar *"mostrar também o título"*; ao
desmarcar, os títulos já gravados são apagados na hora. A disponibilidade
sai pela função `portal_agenda_ocupacao`, que aplica essa regra — as
tabelas de blocos não são lidas direto por ninguém além do dono.

Férias e marcos individuais entram no assistente como *indisponível*, sem
título e sem motivo: o portal continua não expondo por que a pessoa está
fora, como já era no calendário geral.

### Autenticação

O portal usa apenas a chave `anon` do Supabase; tudo depende de sessão
autenticada. As tabelas novas têm RLS: avisos publicados para qualquer
autenticado (rascunhos só para `admin`/`pessoal`); cada membro lê apenas
as próprias solicitações; a escrita passa pelas funções
`portal_abrir_solicitacao` / `portal_cancelar_solicitacao` (validação e
protocolo no banco); a ouvidoria só é lida por `admin`/`pessoal`. O
`admin.html` é só interface — a regra mora no banco.
