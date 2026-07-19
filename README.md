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
- **Calendário expandido** — visão mensal apenas com o que é geral da
  equipe: reuniões gerais, confraternizações, visitas e os marcos do
  calendário (férias, processo seletivo, prazos e datas da UFMG).
- **Organização** — o mesmo Org Explorer do SOMA (estilo Microsoft Teams):
  cadeia de gestão, colegas de equipe e liderados, com busca.
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
| `index.html`   | O portal (rotas por hash: `#/`, `#/calendario`, `#/organizacao`, `#/servicos`, `#/pedidos`) |
| `admin.html`   | Painel do Depto. de Pessoal: avisos, triagem de solicitações e ouvidoria |
| `soma_v10.sql` | Migração do banco (tabelas `portal_*`, RLS e funções) |
| `CNAME`        | Domínio do GitHub Pages (`membro.neurodynamics.dev`) |

## Pré-requisitos

Aplicar a migração **`soma_v10.sql`** (na raiz deste repositório) no SQL
Editor do Supabase, com a SOMA 9.0 já aplicada. Sem ela o portal entra,
mas o quadro de avisos e as solicitações ficam indisponíveis (as demais
abas — agenda, check-in, calendário e organização — usam as tabelas que
o SOMA já tem).

## Papéis e permissões

- **Qualquer conta do SOMA** entra no portal, vê avisos publicados,
  agenda, presença, calendário e organograma.
- **Solicitações** exigem conta **vinculada a um registro de membro
  ativo** (vínculo feito pelo Depto. de Pessoal no SOMA · Gestão).
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

## Como publicar

O GitHub Pages atende **um domínio por repositório** — mesmo esquema dos
demais sites:

1. Ative o Pages neste repositório (branch `main`, raiz).
2. No Cloudflare, aponte `membro.neurodynamics.dev` → `CNAME` para
   `neurodynamics-dev.github.io`.

## Segurança

O portal usa apenas a chave `anon` do Supabase; tudo depende de sessão
autenticada. As tabelas novas têm RLS: avisos publicados para qualquer
autenticado (rascunhos só para `admin`/`pessoal`); cada membro lê apenas
as próprias solicitações; a escrita passa pelas funções
`portal_abrir_solicitacao` / `portal_cancelar_solicitacao` (validação e
protocolo no banco); a ouvidoria só é lida por `admin`/`pessoal`. O
`admin.html` é só interface — a regra mora no banco.
