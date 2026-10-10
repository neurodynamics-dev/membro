# SOMA 2.19.1: reconciliação com a 2.19.0 (etapa P0)

Fonte: `SOMA Versão 2.19.1.md` (requisitos) e `PLANO-IMPLEMENTACAO-SOMA-2.19.1.md`
(plano), ambos de 10/10/2026. Ponto de partida: a 2.19.0 desta branch
(`slp/ecstatic-noether-evq50w`), com `VERSAO = '2.19.0'` e as migrações
`db/2.19.0_quiosque.sql` e `db/2.19.0_avisos.sql`.

Os testes de banco rodam em PostgreSQL 16 local, com a base `tbase` do
`db/LEIAME.md` (15.0 a 24.0) mais a 2.18.0: os 193 testes da 2.18.0 e os 19
da 2.19.0 passam. Cada pacote da 2.19.1 entra com o seu teste nesse banco.

Legenda: **atendido**, **parcial**, **ausente**, **incompatível** (o que
existe precisa mudar de comportamento).

## Matriz

| Requisito | Estado na 2.19.0 | O que muda | Teste |
|---|---|---|---|
| Reporte em Serviços, só lideranças | incompatível: rota `#/equipe/reporte`, menu Equipe | rota `#/servicos/reporte`, redirecionar as antigas | navegador |
| Um reporte por líder e semana, sem escolher grupo | incompatível: unidade é a frente (`reporte_frentes`, grupo × responsável) | nova unidade autor × ciclo; frentes antigas ficam consultáveis | banco |
| Liderados diretos automáticos + participante externo | ausente: `reporte_abrir` lista os membros do grupo | `membros.gestor_registro`; fotografia da cadeia no reporte | banco |
| Entregas e assiduidade, suficiente por padrão, na ficha | parcial: SUFICIENTE/SUFICIENTE já pré-preenchidos, não vão à ficha | gravar no histórico do membro ao enviar (idempotente) | banco |
| Sinalização com confirmação de conversa | parcial: sinalizar exige justificativa; cria card no **Pessoal** (`atividade_de_origem` usa `grupo_pessoal()`) | 1ª em 30 dias → card NRO_PMO; 2ª em 60 dias → NRO_PESSOAL e NRO_COORD_OFFICE | banco (dias 0, 7, 31, 60, 61) |
| Enviar depois do prazo | incompatível: `reporte_salvar` e `reporte_enviar` devolvem `encerrado` com `prazo < now()` | separar cobrança (sexta 16h) de fechamento do ciclo | banco |
| Pop-up de sexta 7h–16h, obrigatório depois, "estive ausente" | ausente | coordenador de obrigações na entrada, hora do servidor | navegador + banco |
| Férias e afastamento pausam e-mails e avisos | ausente: `notificar-email` só filtra status e canal | consulta comum de ausência (`agenda_ausencias` tipos `ferias`, `afastamento`) | banco + fila |
| Reporte unificado em tabelas (NRO-PUB-002) | incompatível: `reporteUnificado` (doc-nro.js) só tem parágrafos; sinalizados saem como "Registro N" sem nome | usar `e.tabela` do DocNRO; apontamentos, escalonamentos, atrasados, feed | navegador (PDF) |
| Erros na geração de PDF | parcial: logo vem de `brand.neurodynamics.dev` por fetch entre origens; jsPDF e QR por CDN | logo local em `ds/marca`; mensagens e repetição seguras | navegador |
| Feed sem 3 aprovações, NRO_MANAGERS publica | incompatível: publicar só via `reporte_enviar`; 3 aprovações em `newsletter_decidir` | RPC de publicação para managers; newsletter sem votos | banco |
| Tópico e notícia completa, página de reportagem | ausente: `feed_itens` só tem título, subtítulo, texto e imagem | tipo, slug, autoria do texto, várias imagens | banco + navegador |
| Widget na Início, página no site, reações | ausente: `feed_lista` exige conta ativa; bucket `feed` privado | projeção pública só do publicado; reação por identidade | banco + navegador |
| Inscrição pública na newsletter | ausente (só importação e descadastro) | formulário no site com confirmação por link | banco |
| PCM mensal anônima | ausente | campanha, participação separada da resposta, agregados ≥ 5 | banco |
| Trainees no SOMA principal, NRO_TRAINEE, filtro por interesse | incompatível: `ps_integrar` já cria membro Ativo e marca integrado | ingresso como trainee (vínculo próprio), efetivação depois | banco |
| Onboarding detalhado | parcial: `tour.html` com progresso só no navegador | trilha versionada, progresso no servidor, ligada aos treinamentos | navegador |
| Studio: setas | defeito confirmado: `.icon-btn.cima` gira +90° um chevron à esquerda, `.baixo` gira −90° um chevron à direita: os dois apontam para cima (`soma.css`) | corrigir a rotação | navegador |
| Studio: selects estreitos | defeito confirmado: `ds/select.js` embrulha o select em `span.nro-select` sem largura; as regras de largura do `soma.css` miram o select escondido | largura no embrulho | navegador |
| Studio: arrastar lâminas | ausente | arrastar e soltar, com os botões como alternativa | navegador |
| Check-in da folha com localização | ausente: `registrar_checkin_folha(p_token uuid)` só recebe o token | nova assinatura com coordenadas; a antiga deixa de servir | banco |
| Painel LABBIO em `/labbio` | ausente | entrada estática própria, Retina, logo LABBIO | navegador |
| Gestores do LABBIO (conta sem membro) | ausente; `conta_ativa()` não barra conta sem registro | capacidade própria, negada no portal principal pelo servidor | banco |
| Termo de sigilo centralizado | ausente: hoje é item de acesso "Termo de sigilo: LABBIO" (importação) e a série PES-016 | campanha de recadastro e termo (aguarda o modelo) | banco + navegador |
| Acesso biométrico com foto | parcial: `portal_solicitacoes` tipo `acesso`; aprovar em `pessoal_solicitacao_decidir` concede o acesso na hora | subtipo LABBIO: Pessoal encaminha, LABBIO implanta; foto pela câmera | banco + navegador |
| Agenda: consulta ao LABBIO para Sala de Reuniões e Auditório | ausente; `espacos` existe (fora do repositório), sem esses nomes nos dados | marcar os dois espaços; consulta consultiva por ocorrência | banco |
| Tablets na porta das salas | ausente | URL por sala, token do aparelho, ocupação momentânea | navegador |

## Ordem de execução

1. **Correções sem insumo**: Studio (setas, selects, arrastar), PDF (logo local,
   tabelas no reporte unificado).
2. **Reporte** (nova unidade, sinalizações, cobrança de sexta, PDF) e a
   **ausência comum** que ele usa.
3. **Feed e newsletter** (publicação por managers, tipos, widget, site,
   reações, inscrição).
4. **LABBIO**: identidade e gestores, `/labbio`, membros e acesso, solicitação
   biométrica, check-ins, treinamentos, consulta de salas e tablets.
5. **Recadastro e termo** (estrutura pronta; ativa com o modelo), **trainees e
   onboarding**, **PCM**, **check-in com localização**.

## Insumos que faltam (não impedem construir; impedem ativar)

| Item | Quem fornece |
|---|---|
| Modelo oficial do termo de sigilo do LABBIO | Coordenação |
| Campos e formato de foto exigidos pela Intelbras | Gestores do LABBIO |
| Primeiro gestor do LABBIO e o responsável principal (estrela); logo do LABBIO em vetor ou PNG grande | LABBIO |
| Centro e raio do LABBIO para o check-in da folha | Medir no local |
| Questionário, escala e prazo da PCM | Pessoal |
| Conteúdo do onboarding (contexto, organização, segurança) | Coordenação |
| Confirmar os grupos reais NRO_PMO, NRO_PESSOAL, NRO_COORD_OFFICE e NRO_TRAINEE (só NRO_LEADERSHIP e NRO_MANAGERS aparecem nas migrações) | Admin |
| Cadência da newsletter (manter semanal e mensal, ou enviar ao publicar) | Coordenação |
