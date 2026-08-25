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
- **Agenda** — a agenda da equipe, uma só, em cinco abas. É aqui que mora
  o que antes era o SOMA App:
  - **Próximos** — o que vem pela frente para você, com RSVP, edição de
    convidados, cancelamento e criação em dois toques;
  - **Mês** — a mesma agenda em grade: eventos, cerimônias, marcos do
    semestre e ausências, cada um com a cor do seu tipo;
  - **Agendar** — o assistente de disponibilidade: escolha as pessoas ou o
    grupo e veja, lado a lado, o livre/ocupado de cada um, com sugestões de
    horário;
  - **Presença** — check-in do LABBIO pelo QR da entrada, quem está lá
    agora, *find me at*, *não perturbe* e os intervalos ("estou no
    laboratório até as 18h", "saí para almoçar");
  - **Minha agenda** — o Google Agenda nos dois sentidos: o portal lê o seu
    `.ics` (para saber quando você está ocupado) e você assina o feed da
    NeuroDynamics (para receber a agenda da equipe na sua agenda pessoal).
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
- **Ferramentas da equipe** — trilho na página inicial com tudo o que a
  NeuroDynamics usa: agenda, organização, documentos, SOMA · Gestão, tour,
  site institucional, brand guidelines, processo seletivo e GitHub.

## Conteúdo

| Arquivo        | O que é |
|----------------|---------|
| `index.html`   | O portal (rotas por hash: `#/`, `#/calendario`, `#/calendario/agendar`, `#/calendario/minha`, `#/organizacao`, `#/informacoes`, `#/servicos`, `#/pedidos`) |
| `admin.html`   | Painel do Depto. de Pessoal: avisos, documentos, triagem de solicitações, ouvidoria e estado das agendas |
| `soma_v10.sql` | Migração do banco (tabelas `portal_*`, RLS e funções) |
| `soma_v11.sql` | Migração da biblioteca de documentos (`portal_documentos`) |
| `soma_v12.sql` | Migração da agenda: `portal_agendas`, blocos de ocupação e o RPC que alimenta o assistente |
| `soma_v13.sql` | Migração da **agenda unificada**: catálogo de tipos, visibilidade, recorrência de verdade, ausências, cerimônias de scrum e o feed do Google |
| `supabase/functions/agenda-sync/` | Edge Function que lê o `.ics` de cada um e grava os horários ocupados ([detalhes](supabase/functions/agenda-sync/README.md)) |
| `supabase/functions/agenda-ics/`  | Edge Function que serve o feed da agenda para assinar no Google ([detalhes](supabase/functions/agenda-ics/README.md)) |
| `CNAME`        | Domínio do GitHub Pages (`membro.neurodynamics.dev`) |

## Pré-requisitos

Aplicar as migrações **`soma_v10.sql`**, **`soma_v11.sql`**,
**`soma_v12.sql`** e **`soma_v13.sql`** (na raiz deste repositório, nesta
ordem) no SQL Editor do Supabase, com a SOMA 9.0 já aplicada. Sem elas o portal entra, mas o quadro de avisos,
as solicitações e o assistente de agendamento ficam indisponíveis (as demais
abas — agenda, check-in, calendário e organização — usam as tabelas que
o SOMA já tem).

Duas Edge Functions completam o par com o Google (as duas dá para colar
pelo painel, sem CLI):

- **`agenda-sync`** — lê o Google Agenda de cada um e grava os horários
  ocupados ([como publicar](supabase/functions/agenda-sync/README.md)). Sem
  ela o assistente continua funcionando, só que a disponibilidade vem apenas
  da agenda da equipe e das ausências;
- **`agenda-ics`** — serve o feed para assinar no Google
  ([como publicar](supabase/functions/agenda-ics/README.md)). **Precisa ser
  publicada com a verificação de JWT desligada**, porque quem busca o arquivo
  é o Google, sem sessão.

Do lado do repositório `nro-pessoal`, publique também o `quiosque.html` (o QR
do check-in passa a levar ao portal) e o `app.html` (o SOMA App vira um
encaminhamento, para os QRs e favoritos antigos continuarem funcionando).

## Uma agenda só

Antes desta versão a equipe tinha duas agendas separadas no banco (os
`eventos`, com convidados e RSVP, e os `calendario_itens`, com os marcos) e
uma terceira escrita à mão no HTML do portal (a agenda fixa do semestre).
Agora existe **uma leitura só** — a função `agenda_itens` —, que junta:

| Fonte | O que é | Quem vê |
|---|---|---|
| `eventos` | reuniões, testes, cerimônias, trabalho no LABBIO | conforme a **visibilidade** do evento |
| `calendario_itens` | marcos do semestre, feriados, calendário da UFMG, prazos | todo mundo (os pessoais, só a pessoa e admin/pessoal) |
| `agenda_ausencias` | férias, afastamento e os intervalos de presença | férias e afastamento são privados; os intervalos são da equipe |

**Visibilidade de cada evento**, escolhida no momento de criar (com o padrão
vindo do tipo):

- `equipe` — todo mundo vê. É o padrão da **Reunião geral**;
- `convidados` — só o dono, os convidados e o Depto. de Pessoal;
- `privado` — só o dono e o Depto. de Pessoal.

**Tipos de evento** deixaram de ser uma lista no código dos dois apps: moram
em `evento_tipos`, com cor, visibilidade padrão, checklist e a marcação de
quais aparecem na criação rápida. Criar um tipo novo virou uma linha no banco.

**Recorrência é recorrência.** Marcar um compromisso como semanal, quinzenal
ou mensal cria as ocorrências futuras de verdade, cada uma com os seus
convidados e o seu RSVP — não um "evento fantasma" que só existe na tela.
O horizonte é de 120 dias e o portal o estica sozinho sempre que alguém abre
a agenda. Dá para editar ou cancelar **só um encontro** ou **a série daqui
para a frente**.

**Cerimônias de scrum** são um caso dessa recorrência: cada grupo define em
*Agenda → Cerimônias do grupo* os dias, o horário, a duração e o link do
Meet da daily, da abertura e do fechamento de sprint, do review e da
retrospectiva. O banco cria a série e convida quem está no grupo.

## Papéis e permissões

- **Qualquer conta do SOMA** entra no portal, vê avisos publicados,
  agenda, presença, calendário e organograma.
- **Solicitações** exigem conta **vinculada a um registro de membro
  ativo** (vínculo feito pelo Depto. de Pessoal no SOMA · Gestão).
- **Marcar compromissos** exige conta vinculada a um registro: o convite é
  criado como um evento do SOMA, em nome de quem agendou.
- **Editar convidados e cancelar** é de quem organiza o compromisso (ou de
  `admin`/`pessoal`).
- **Cerimônias de scrum de um grupo** são configuradas por quem está no
  grupo (ou por `admin`/`pessoal`).
- **Ausências** são de cada um: só a própria pessoa (ou o Depto. de Pessoal)
  cria e remove as suas.
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
6. **Tipos de evento**: a lista vive em `evento_tipos`. Para criar um tipo
   novo, insira uma linha (nome, categoria, cor, visibilidade padrão, se
   entra na criação rápida e o checklist). Nenhum deploy é necessário.

## Como publicar

O GitHub Pages atende **um domínio por repositório** — mesmo esquema dos
demais sites:

1. Ative o Pages neste repositório (branch `main`, raiz).
2. No Cloudflare, aponte `membro.neurodynamics.dev` → `CNAME` para
   `neurodynamics-dev.github.io`.

## Segurança

### Agenda e Google Calendar

A visibilidade dos eventos (`equipe` / `convidados` / `privado`) é aplicada
na leitura da agenda, em `agenda_itens`. A tabela `eventos` continua com as
políticas de RLS que o SOMA já tinha: a migração não as toca, porque
políticas permissivas só somam acesso e apagar as antigas às cegas quebraria
a Gestão. O rodapé do `soma_v13.sql` traz a consulta para conferir os nomes
das políticas atuais, caso a equipe queira fechar também a leitura direta da
tabela num passo à parte.


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
