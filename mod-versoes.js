/* ============================================================
   MÓDULO · NOTAS DE VERSÃO, e os bugs e sugestões da equipe
   Carregado sob demanda em #/versoes. A porta de entrada é o rodapé
   (a versão escrita nele, "Notas de versão" e "Bugs e sugestões").

   Rotas:
     #/versoes                           as notas, da versão mais nova à mais antiga
     #/versoes/<x.y.z>                   uma versão em foco (a versão de um relato leva aqui)
     #/versoes/comentarios               bugs e sugestões: os relatos, com voto e andamento
     #/versoes/comentarios/bug|sugestao  relatar, com o tipo já escolhido
     #/versoes/comentarios/<n>           um relato (BUG-12, SUG-13)

   A numeração é major.minor.patch desde a 2.17.0 (README, "Versões"):
   o patch sobe quando a versão só corrige, o minor quando acrescenta, o
   major quando algo deixa de funcionar como antes. As versões de antes
   ganharam o número pela regra N.p = 2.(N-16).p: a 32.0 é a 2.16.0.

   As notas moram aqui, no código, porque descrevem o código: quem sobe
   a VERSAO na casca acrescenta a entrada nova no alto de NOTAS_VERSAO,
   no mesmo commit. Os relatos moram no banco (soma_feedback, 2.17.0):
   todo mundo lê todos (é assim que o mesmo bug não é relatado cinco
   vezes); relata, vota e comenta quem tem registro; o andamento é de
   admin, e o autor e quem votou são avisados.

   Depende da casca para: sb, $, esc, norm, state, can, toast, abreModal,
   fechaModal, confirma, fmtD, fmtDT, fmtQuando, ic, avatarFoto, md,
   mdBarra, navNivel1, dica, motivoRPC, nomeDoAparelho, registrarBusca,
   filtrarSimples, VERSAO.
   ============================================================ */

/* A entrada mais nova fica em cima. "antes" é o número da numeração
   antiga; os itens são [tipo, texto em Markdown]. */
const NOTAS_VERSAO = [
  { v:'2.19.0', data:'2026-10-10', titulo:'Design system v3, quiosque com conta própria e quadro de avisos novo', itens:[
    ['novo', '**Design system v3** em todo o SOMA: um cabeçalho único em todas as telas (rótulo, título e voltar), templates de tela, estados de carregando, vazio e erro, e o catálogo em `#/dev/templates`.'],
    ['novo', '**Quiosque** com conta de serviço: o segredo deixa de ficar no código. Dois layouts (o padrão e `?layout=b`), widgets que giram, a chegada de quem faz check-in e a hora do dia.'],
    ['novo', '**Quadro de avisos** com onze layouts, vindos das bandas e dos widgets da marca: hero, contagem, número, progresso, lista e citação entram. Cada aviso pode ter uma das doze cores, e quem lê escolhe entre rodízio e grade.'],
    ['melhoria', '**Reporte semanal** reconstruído: endereços próprios e um fluxo de quatro passos, com revisão antes de enviar.'],
    ['melhoria', '**Marca** fica no SOMA só com o que exige login (assinatura de e-mail, modelos controlados e configurações). Logos, wallpapers e o kit de interface estão no manual da marca, refeito do zero.'],
    ['melhoria', '**Menu lateral** mais limpo: a logo leva ao início, o botão de recolher fica ao lado dela, e no menu recolhido o símbolo vira o botão de expandir.'],
    ['melhoria', 'Rodapé e cabeçalho iguais aos dos sites da NeuroDynamics, sem a linha de sinal; o botão de contato dos sites ganha contraste.'],
    ['correcao', 'Textos sem pontos médios nem travessões como separador; cores das telas avulsas (convite, validação de documentos, tour) vindas dos tokens.']
  ]},
  { v:'2.18.0', data:'2026-10-07', titulo:'Reporte semanal, Marca e novos controles de acesso', itens:[
    ['novo', '**Reporte semanal** em três etapas: apontamento, escalonamento e publicações no **Feed da equipe**. A liderança preenche suas frentes; o admin acompanha o ciclo e baixa o reporte unificado.'],
    ['novo', '**Newsletters** semanais para membros e mensais para a comunidade, com três aprovações distintas da liderança. A comunidade é importada em Administração › E-mails e pode se descadastrar pelo rodapé.'],
    ['novo', '**Marca** reúne materiais, assinaturas de e-mail e referências de interfaces. Arquivos controlados continuam exigindo a permissão da série. O **Studio** recebe os temas v2 e importa publicações estruturadas por IA como rascunho.'],
    ['novo', 'Tipos de evento podem gerar **ata** em Arquivos, com rascunho preenchido a partir do evento.'],
    ['melhoria', '**Papéis por grupo** para Pessoal, Seleção e Liderança. Admin permanece individual; contas vinculadas a membros Desligados, Egressos ou Sob demanda ficam bloqueadas. Os cartões podem aparecer em mais de um quadro.'],
    ['melhoria', '**Avisos por categoria**: push e frequência de e-mail configuráveis. Quem estava em imediato sem ter escolhido passa ao **resumo semanal**. Convites e pílulas continuam com suas próprias filas.'],
    ['correcao', 'A semana do Início considera eventos nas 24 horas do dia. Contas bloqueadas deixam de receber convites internos; a fila mostra apenas os avisos já devidos. A folha de check-in é única e sua geração fica restrita a admin.'],
    ['melhoria', 'Design system v2 nos temas claro e escuro, seleção por teclado, documentos com fontes locais, páginas públicas e novo manual da marca.']
  ] },
  { v:'2.17.1', data:'2026-09-29',
    titulo:'As entrevistas do PS na agenda e o portal sem avisos que ninguém pediu',
    itens:[
      ['correcao', 'As **entrevistas do processo seletivo** entram na agenda de quem as conduz (quem abriu o horário em Seleção › Agenda), na camada *Entrevistas do PS*, e na semana do início. Cada entrevista tem o candidato, a hora e o link da chamada, com *Entrar na chamada* e a ficha do candidato a um clique. Só o horário com candidato aparece.'],
      ['aviso', 'O portal não abre mais aviso sozinho: sai o convite para receber as notificações no aparelho, do alto do sino, e sai o aviso de versão nova. Ativar as notificações continua em *Preferências de avisos*, no sino ou no rodapé, e as notas de versão continuam no rodapé.']
    ] },
  { v:'2.17.0', data:'2026-09-29',
    titulo:'Notas de versão, a foto enviada pelo portal, OKRs maiores e cartões de atividade mais completos',
    itens:[
      ['aviso', 'O SOMA passa a numerar as versões em **major.minor.patch**. Esta página reúne o que mudou em cada uma, e a versão escrita no rodapé leva a ela. As anteriores ganharam o número novo pela regra `N.p = 2.(N-16).p`: a 32.0 é a 2.16.0.'],
      ['novo', '**Bugs e sugestões** ([#/versoes/comentarios](#/versoes/comentarios)): relatar um bug ou sugerir uma melhoria, votar no que já foi relatado e acompanhar o andamento de cada relato (em análise, planejado, feito na versão X). Quem relatou e quem votou são avisados.'],
      ['novo', '**Foto de perfil enviada pelo portal**, sem publicar a imagem em outro lugar e colar o link: escolher, enquadrar e salvar. Pelo avatar no menu, por *Sua conta* no rodapé ou pela câmera na ficha; o início avisa quem ainda não tem foto. O Depto. de Pessoal envia a de qualquer pessoa.'],
      ['melhoria', '**OKRs**: os cartões cresceram e mostram o título inteiro, e a roda do mouse dá zoom na tela (com Shift, move).'],
      ['novo', '**Atividades**: a descrição e os comentários em Markdown, com barra de formatação e a opção de ver antes de salvar.'],
      ['novo', '**Atividades**: checklists no cartão, uma ou mais, com o progresso no quadro (`3/5`). Colar uma lista cria os itens, e `- [x]` já entra marcado.'],
      ['novo', '**Atividades**: outras pessoas atribuídas além do responsável. Elas são avisadas, seguem o cartão, o veem em *Suas tarefas* e entram na carga da equipe.'],
      ['novo', '**Atividades**: marcar alguém digitando `@` no comentário. A menção aparece destacada e avisa a pessoa.'],
      ['novo', '**Atividades**: etiquetas no cartão, com as do quadro para escolher, a cor tirada do nome e o filtro por etiqueta no quadro.'],
      ['novo', '**Atividades**: copiar o cartão para outro quadro, ou duplicar no mesmo, com a opção de arquivar o original. A cópia diz de onde veio.'],
      ['melhoria', '**Atividades**: os cartões arquivados têm lista própria e voltam ao quadro; o link do cartão se copia com um clique; o próprio comentário se corrige e se apaga.'],
      ['melhoria', 'Os códigos do SOMA escritos num texto viram link: ORT-14 leva ao cartão, NRO-PES-007 ao arquivo, NRO-TRE-003 ao treinamento, BUG-12 ao relato.']
    ] },
  { v:'2.16.0', antes:'32.0', data:'2026-09-28',
    titulo:'Tour do SOMA guiado, a fila de envio que anda sozinha e os avisos no aparelho',
    itens:[
      ['novo', '**Tour do SOMA** (`/tour`) em treze etapas, para quem nunca abriu o sistema: cria a conta ali mesmo e, depois de entrar, mostra cada espaço com os dados da própria pessoa.'],
      ['novo', 'O SOMA se instala na **tela de início** do iPhone e do Android, e os avisos do sino chegam como **notificação do aparelho**, mesmo com o SOMA fechado.'],
      ['melhoria', 'A **fila de envio anda sozinha**: o banco chama o envio a cada minuto e logo depois de cada aviso novo. Em Administração › E-mails › Programados, o card *A fila de envio* diz se ela está em dia.'],
      ['melhoria', 'O **sino não empilha**: cada aviso tem o ×, o alto do sino tem *limpar as lidas*, e o que é antigo sai sozinho.']
    ] },
  { v:'2.15.0', antes:'31.0', data:'2026-09-28',
    titulo:'Entrevistas online no processo seletivo',
    itens:[
      ['novo', 'A entrevista individual é **online**: o link da chamada no lugar do local, com o *Criar no Meet*, e quem abre o horário fica como responsável. Cada horário de entrevista tem uma vaga.'],
      ['novo', 'Os **e-mails das entrevistas**: ao candidato, a reserva, o reagendamento, a troca de link e o cancelamento; a quem abriu os horários, o resumo da véspera com o perfil de cada candidato.']
    ] },
  { v:'2.14.0', antes:'30.0', data:'2026-09-28',
    titulo:'O Full mailer em tela inteira, os e-mails programados e as pílulas de conhecimento',
    itens:[
      ['novo', '**Administração › E-mails**: o Full mailer em tela inteira, com a prévia no computador e no celular e o remetente de cada área (P&D, Clínica, Depto. de Pessoal, Relações Institucionais, Marketing e Leadership).'],
      ['novo', '**E-mails programados** para a equipe, para grupos ou só para quem programa, com a fila, o histórico, reagendar e cancelar.'],
      ['novo', '**Pílulas de conhecimento**: dezesseis e-mails curtos sobre o que o SOMA faz, em série, sem cair em fim de semana.'],
      ['correcao', 'A migração da presença (29.0) deixa de parar nos bancos em que o id do check-in é identity.']
    ] },
  { v:'2.13.0', antes:'29.0', data:'2026-09-27',
    titulo:'Revisão 28: a agenda no modelo do Google, a presença e o início novo',
    itens:[
      ['novo', '**Agenda** refeita no modelo do Google Agenda: dia, semana e mês numa tela só, criar clicando ou arrastando, arrastar para reagendar e a página de cada evento, com convidados de dentro e de fora, repetição, Meet, cor e visibilidade. O convite se responde pelo portal ou pelo e-mail.'],
      ['novo', '**Equipe › Presença**: quem está no LABBIO, o placar do mês, as sequências em dias úteis e as **folhas de check-in** (o QR Code fixo em A4, revogável).'],
      ['melhoria', 'O **início** mostra a sua semana, o placar, as suas tarefas, os links úteis e os abertos por último; o rodapé traz o próximo compromisso.'],
      ['melhoria', '**OKRs** numa tela infinita, como um quadro do Miro; **Projetos** com um Pokémon que evolui; a ficha mostra os grupos herdados; linguagem direta e formal em todo o portal.'],
      ['aviso', 'O SOMA Gestão antigo saiu, junto com o checklist por tipo de evento, o dossiê e a presença por evento. Informações deu lugar a Arquivos.']
    ] },
  { v:'2.11.0', antes:'27.0', data:'2026-09-25',
    titulo:'Documentos emitidos, eventos registrados, o registro escrito no portal e o cofre de senhas',
    itens:[
      ['novo', '**Declaração de vínculo** na hora, em PDF, no modelo da NRO, com código verificador e QR Code, conferível em `auth.neurodynamics.dev`.'],
      ['novo', '**Eventos e participações**: o registro da participação da equipe num evento externo, aprovado por duas pessoas, com a declaração de participação de cada participante por e-mail.'],
      ['novo', '**Escrever o registro no portal**: a ata de reunião e o relatório de teste se escrevem no SOMA, com rascunho que grava sozinho, e viram o PDF que vai para revisão.'],
      ['novo', '**Cofre de senhas**: as contas da equipe com a senha gerada no SOMA, o código de duas etapas calculado no banco, a troca periódica e o registro de uso.']
    ] },
  { v:'2.8.0', antes:'24.0', data:'2026-09-24',
    titulo:'Treinamentos',
    itens:[
      ['novo', '**Treinamentos** com código e revisão (NRO-TRE-003 Rev. B): módulos em Markdown com vídeos, verificação de conhecimento corrigida no banco, atribuição a grupos, conclusão no perfil e o certificado em PDF.'],
      ['novo', 'O texto de um treinamento sai de um agente de IA que segue o README de conteúdo, e entra no portal colado.']
    ] },
  { v:'2.7.0', antes:'23.0', data:'2026-09-24',
    titulo:'Studio: o criador de peças e o planejamento das publicações',
    itens:[
      ['novo', '**O criador**: 23 modelos desenhados no navegador, no tamanho exato de cada rede, com os temas da marca, fotos (upload, Unsplash ou da ficha) e download em PNG, ZIP ou PDF.'],
      ['novo', '**O planejamento**: o quadro das publicações (ideia, produção, aprovação, pronta, publicada), o calendário, a aprovação pelo grupo aprovador e o lembrete da véspera por e-mail.']
    ] },
  { v:'2.6.1', antes:'22.1', data:'2026-09-23',
    titulo:'Arquivos abre na lista, o menu sem "Início" e o tema claro',
    itens:[
      ['melhoria', '**Arquivos** abre direto na lista de todos os arquivos, com filtro por emissor.'],
      ['novo', '**Tema claro**, no botão ao lado do sair; o escuro continua o padrão.'],
      ['melhoria', 'A logo no alto do menu leva ao início, e os e-mails do próprio Supabase (confirmação, nova senha) saem em português, no padrão dos avisos.']
    ] },
  { v:'2.6.0', antes:'22.0', data:'2026-09-23',
    titulo:'A estrutura de cada série de arquivos',
    itens:[
      ['novo', 'Cada série diz o que é (documento único, template com documentos ou template com registros), pela coluna nova da NRO-PUB-001, e a tela do arquivo responde se ele é template, se tem PN e se pode ser alterado.']
    ] },
  { v:'2.5.0', antes:'21.0', data:'2026-09-23',
    titulo:'Grupos dentro de grupos, projetos e o controle de arquivos',
    itens:[
      ['novo', '**Grupos dentro de grupos**: quem está num grupo está também nos de cima, e várias pessoas entram num grupo de uma vez.'],
      ['novo', '**Projetos**: cada um com a equipe, o supervisor e o rol de arquivos que todo projeto deve ter.'],
      ['novo', '**Arquivos**: o controle de documentos e registros que era a planilha NRO-PUB-001, com código, revisão e aprovação pelo grupo revisor.']
    ] },
  { v:'2.4.0', antes:'20.0', data:'2026-09-22',
    titulo:'OKRs e o processo seletivo chegam ao portal',
    itens:[
      ['novo', '**OKRs**: a árvore de objetivos, do estratégico ao operacional, com responsáveis, prazo, status e comentários.'],
      ['novo', '**Seleção**: as oito abas do Comitê de Seleção, cada uma com endereço.']
    ] },
  { v:'2.3.0', antes:'19.0', data:'2026-09-22',
    titulo:'O menu lateral',
    itens:[
      ['melhoria', 'A navegação sai do topo e vira um **menu lateral**, com ícone e subitens em cada espaço; ele recolhe para um trilho de ícones e, no celular, vira gaveta.']
    ] },
  { v:'2.2.3', antes:'18.3', data:'2026-09-22', titulo:'O remetente dos e-mails',
    itens:[['correcao', 'O remetente não cai mais no usuário do envio, e o erro de endereço inválido diz qual valor falhou e onde conferir.']] },
  { v:'2.2.2', antes:'18.2', data:'2026-09-22', titulo:'O envio de e-mail por HTTP',
    itens:[['correcao', 'O envio de e-mail deixa o SMTP e passa a usar HTTP, sem dependência que falhava ao publicar a função.']] },
  { v:'2.2.1', antes:'18.1', data:'2026-09-22', titulo:'O teste de e-mail diz o motivo certo',
    itens:[['correcao', 'A função de e-mail passa a aceitar a chamada do portal, e o teste deixa de dizer "não publicada" para uma função publicada.']] },
  { v:'2.2.0', antes:'18.0', data:'2026-09-22', titulo:'Um botão para testar o envio de e-mail',
    itens:[['novo', 'Em *Preferências de avisos*, **Enviar um e-mail de teste**: cada coisa que pode falhar tem um recado próprio, com o que fazer.']] },
  { v:'2.1.1', antes:'17.1', data:'2026-09-21', titulo:'Cinco correções do primeiro uso real',
    itens:[
      ['correcao', 'Os grupos na ordem configurada, o quadro que abre é o seu, o fundo da lista de grupos e o Full mailer que fechava levando o texto escrito.']
    ] },
  { v:'2.1.0', antes:'17.0', data:'2026-09-21',
    titulo:'O quadro de atividades com espaço e acesso por grupo',
    itens:[
      ['melhoria', 'As cinco colunas cabem na janela, e o que rola é cada coluna; os grupos viram um seletor; o cartão ganha relevo e o brilho da prioridade no topo.'],
      ['novo', 'Cada quadro tem o seu público: nível de edição, leitura ou nenhum por pessoa, com acesso concedido em Administração › Grupos.']
    ] },
  { v:'2.0.0', antes:'16.0', data:'2026-09-21',
    titulo:'Um portal só, com o quadro de atividades',
    itens:[
      ['novo', 'O SOMA Gestão e o Portal do Membro viram um app só, com um login e uma navegação por espaços.'],
      ['novo', '**Atividades**: o quadro de trabalho de cada grupo, com código em cada cartão (ORT-14), responsável, prazo, comentários com menção, sinalização e histórico.'],
      ['novo', 'Solicitação, apontamento e ocorrência viram um cartão no quadro do Depto. de Pessoal, e aprovar um acesso o concede na mesma ação.'],
      ['novo', 'Os avisos do sino também **por e-mail**, a cada aviso ou num resumo por dia.']
    ] },
  { v:'1.x', antes:'até 15.0', data:'2026-09-20',
    titulo:'O SOMA Gestão e o Portal do Membro, separados',
    itens:[
      ['aviso', 'Até a 15.0 da numeração antiga eram dois apps sobre o mesmo banco: o SOMA Gestão (`pessoal.neurodynamics.dev`), do Depto. de Pessoal, e o Portal do Membro. A 14.0 começou a unificação, e a 2.0.0 é o primeiro portal único no ar.']
    ] }
];
const TIPOS_NOTA = { novo:'Novo', melhoria:'Melhoria', correcao:'Correção', aviso:'Aviso' };
const VERSOES_ABERTAS = 5;   /* as mais novas, abertas; o resto fica em "versões anteriores" */
const idVersao = v => 'vs-' + String(v).replace(/[^\w]/g, '-');

/* os relatos */
const FB_STATUS = {
  aberto:     ['Aberto',     'dt-info', 'p-info'],
  em_analise: ['Em análise', 'dt-warn', 'p-warn'],
  planejado:  ['Planejado',  'dt-info', 'p-info'],
  feito:      ['Feito',      'dt-ok',   'p-ok'],
  recusado:   ['Recusado',   'dt-gray', ''],
  duplicado:  ['Duplicado',  'dt-gray', '']
};
const FB_ABERTOS = ['aberto', 'em_analise', 'planejado'];
const FB_MOTIVO = { fechado:'Relato já analisado: o texto não muda mais.', sem_permissao:'Só quem relatou muda o relato.' };
const fbPill = st => { const [l, dt, c] = FB_STATUS[st] || [st, 'dt-gray', ''];
  return `<span class="pill ${c}"><span class="dt ${dt}"></span>${esc(l)}</span>`; };
const fbCod = f => `<span class="fb-cod ${esc(f.tipo)}">${esc(f.codigo || '')}</span>`;
const fbAdmin = () => state.perfil?.papel === 'admin';

const versoes = {
  relatos:null, erro:null, lendo:null,
  filtro:{ tipo:'', status:'abertos', ordem:'votos', q:'' },
  novo:{ tipo:'bug' }
};

async function vsCarregar(forcar){
  if (versoes.relatos && !forcar) return;
  if (versoes.lendo && !forcar) return versoes.lendo;
  versoes.lendo = sb.from('soma_feedback_lista').select('*').order('criado_em', { ascending:false }).limit(500)
    .then(r => { versoes.erro = r.error || null; versoes.relatos = r.error ? [] : (r.data || []); })
    .catch(e => { versoes.erro = e; versoes.relatos = []; })
    .finally(() => { versoes.lendo = null; });
  return versoes.lendo;
}
const vsSemMigracao = () => `<div class="aviso-box err">Bugs e sugestões indisponível: falta aplicar a migração
  <span class="mono">db/2.17.0_notas_fotos_e_cartoes.sql</span>.
  ${versoes.erro?.message ? `<br><span class="small">Detalhe: ${esc(versoes.erro.message)}</span>` : ''}</div>`;

/* ============================================================
   ROTA
   ============================================================ */
async function pageVersoes(sub, sub2){
  if (sub === 'comentarios'){
    if (/^\d+$/.test(sub2 || '')) return telaRelato(+sub2);
    if (['bug', 'sugestao', 'novo'].includes(sub2)) return telaNovoRelato(sub2 === 'novo' ? 'bug' : sub2);
    return telaRelatos();
  }
  telaNotas(sub ? decodeURIComponent(sub) : null);
}

function topoVersoes(secao){
  const abertos = (versoes.relatos || []).filter(f => FB_ABERTOS.includes(f.status)).length;
  return cabecalho({ espaco:'SOMA', titulo:secao === 'comentarios' ? 'Bugs e sugestões' : 'Notas de versão', meta:['Versão ' + esc(VERSAO)],
      acoes:[`<a class="btn solid" href="#/versoes/comentarios/bug">${ic('bug')} Relatar um bug</a>`,
        `<a class="btn ghost" href="#/versoes/comentarios/sugestao">${ic('lampada')} Sugerir melhoria</a>`] }) + `
    ${navNivel1([['notas', 'Notas de versão', '#/versoes'],
      ['comentarios', 'Bugs e sugestões', '#/versoes/comentarios', abertos ? ` (${abertos})` : '']], secao, 'Notas de versão')}`;
}

/* ============================================================
   AS NOTAS
   ============================================================ */
function notaHTML(n){
  const atual = n.v === VERSAO;
  return `<article class="vs-item${atual ? ' atual' : ''}" id="${idVersao(n.v)}">
    <div class="vs-cab">
      <a class="vs-num" href="#/versoes/${esc(n.v)}">${esc(n.v)}</a>
      ${atual ? '<span class="pill p-ok"><span class="dt dt-ok"></span>No ar</span>' : ''}
      ${n.antes ? `<span class="vs-antes">antes ${esc(n.antes)}</span>` : ''}
      <span class="vs-data">${fmtD(n.data)}</span>
    </div>
    <h2 class="vs-tit">${esc(n.titulo)}</h2>
    <ul class="vs-mud">${n.itens.map(([t, tx]) => `<li><span class="vs-tipo ${esc(t)}">${esc(TIPOS_NOTA[t] || t)}</span>
      <div class="md">${md(tx)}</div></li>`).join('')}</ul>
  </article>`;
}
function telaNotas(foco){
  vsCarregar().then(() => { const n = document.querySelector('.nav1 a[href="#/versoes/comentarios"]');
    const abertos = (versoes.relatos || []).filter(f => FB_ABERTOS.includes(f.status)).length;
    if (n && abertos && !/\(\d+\)/.test(n.textContent)) n.textContent += ` (${abertos})`; });
  const novas = NOTAS_VERSAO.slice(0, VERSOES_ABERTAS), antigas = NOTAS_VERSAO.slice(VERSOES_ABERTAS);
  const focoAntiga = foco && antigas.some(n => n.v === foco);
  $('#main').innerHTML = topoVersoes('notas') + `
    <p class="small muted" style="margin:0 0 16px">Versão no ar: <b>${esc(VERSAO)}</b>
      ${dica('Major.minor.patch. O patch sobe quando a versão só corrige; o minor, quando acrescenta sem mudar o que já existia; o major, quando algo deixa de funcionar como antes. As versões anteriores à 2.17.0 ganharam o número pela regra N.p = 2.(N-16).p: a 32.0 é a 2.16.0.', 'Como o SOMA numera as versões')}</p>
    <div class="vs-lista">
      ${novas.map(notaHTML).join('')}
      ${antigas.length ? `<details class="vs-antigas"${focoAntiga ? ' open' : ''}>
        <summary>Versões anteriores (${antigas.length})</summary>
        <div class="vs-lista" style="margin-top:8px">${antigas.map(notaHTML).join('')}</div></details>` : ''}
    </div>`;
  const alvo = foco && document.getElementById(idVersao(foco));
  if (alvo){ alvo.classList.add('foco'); setTimeout(() => alvo.scrollIntoView({ block:'start', behavior:'smooth' }), 60); }
}

/* ============================================================
   BUGS E SUGESTÕES
   ============================================================ */
function relatosFiltrados(){
  const f = versoes.filtro, q = norm(f.q);
  const lista = (versoes.relatos || []).filter(x =>
    (!f.tipo || x.tipo === f.tipo) &&
    (f.status === 'todos' || (f.status === 'abertos' ? FB_ABERTOS.includes(x.status) : x.status === f.status)) &&
    (!q || norm(x.titulo).includes(q) || norm(x.codigo).includes(q) || norm(x.corpo).includes(q)));
  return lista.sort((a, b) => f.ordem === 'votos'
    ? (b.votos - a.votos) || String(b.criado_em).localeCompare(String(a.criado_em))
    : String(b.criado_em).localeCompare(String(a.criado_em)));
}
function relatoLinhaHTML(f){
  const autor = state.membros.find(m => m.registro === f.autor);
  return `<div class="fb-item">
    <button class="fb-voto${f.votei ? ' on' : ''}" onclick="relatoVotar(${f.id}, ${!f.votei})" aria-pressed="${!!f.votei}"
      title="${f.tipo === 'bug' ? 'Também acontece comigo' : 'Também quero'}">${ic('votar')}<b>${f.votos || 0}</b></button>
    <div class="fb-tx">
      <a class="t" href="#/versoes/comentarios/${f.id}">${esc(f.titulo)}</a>
      <div class="fb-sub">${fbCod(f)}
        <span>${esc(autor?.nome || f.autor_nome || 'Alguém')}, ${fmtQuando(f.criado_em)}</span>
        ${f.comentarios ? `<span title="Comentários">${ic('chat')} ${f.comentarios}</span>` : ''}
        ${f.status === 'feito' && f.versao_feito ? `<span>feito na <a href="#/versoes/${esc(f.versao_feito)}">${esc(f.versao_feito)}</a></span>` : ''}
      </div>
    </div>
    ${fbPill(f.status)}
  </div>`;
}
async function telaRelatos(){
  $('#main').innerHTML = topoVersoes('comentarios') + '<div class="carregando"><span class="spin"></span> Carregando…</div>';
  await vsCarregar(true);
  if (route().r !== 'versoes') return;
  if (versoes.erro){ $('#main').innerHTML = topoVersoes('comentarios') + vsSemMigracao(); return; }
  const f = versoes.filtro;
  const segB = (grupo, v, rot) => `<button type="button" class="${f[grupo] === v ? 'on' : ''}"
    onclick="versoes.filtro.${grupo}='${v}';telaRelatosLista()">${rot}</button>`;
  $('#main').innerHTML = topoVersoes('comentarios') + `
    <div class="filtros fb-filtros">
      <div class="fld cresce"><label for="fb-q">Buscar</label>
        <input id="fb-q" value="${esc(f.q)}" placeholder="Título, código ou texto" oninput="versoes.filtro.q=this.value;telaRelatosLista()"></div>
      <div class="fld"><label>Tipo</label><span class="seg" role="group" aria-label="Tipo" id="fb-seg-tipo">
        ${segB('tipo', '', 'Todos')}${segB('tipo', 'bug', 'Bugs')}${segB('tipo', 'sugestao', 'Sugestões')}</span></div>
      <div class="fld"><label for="fb-st">Situação</label>
        <select id="fb-st" onchange="versoes.filtro.status=this.value;telaRelatosLista()">
          ${[['abertos', 'Em aberto'], ['feito', 'Feitos'], ['recusado', 'Recusados'], ['duplicado', 'Duplicados'], ['todos', 'Todos']]
            .map(([k, l]) => `<option value="${k}"${f.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label for="fb-ord">Ordem</label>
        <select id="fb-ord" onchange="versoes.filtro.ordem=this.value;telaRelatosLista()">
          <option value="votos"${f.ordem === 'votos' ? ' selected' : ''}>Mais votados</option>
          <option value="recentes"${f.ordem === 'recentes' ? ' selected' : ''}>Mais recentes</option></select></div>
    </div>
    <div id="fb-lista"></div>`;
  telaRelatosLista();
}
function telaRelatosLista(){
  const el = $('#fb-lista'); if (!el) return;
  document.querySelectorAll('#fb-seg-tipo button').forEach(b =>
    b.classList.toggle('on', b.getAttribute('onclick').includes(`tipo='${versoes.filtro.tipo}'`)));
  const lista = relatosFiltrados();
  const f = versoes.filtro, filtrando = f.q || f.tipo || f.status !== 'abertos';
  el.innerHTML = lista.length ? `<div class="fb-lista">${lista.map(relatoLinhaHTML).join('')}</div>`
    : (versoes.relatos || []).length && filtrando
      ? `<div class="vazio"><h3>Nenhum relato com esse filtro.</h3>
          <div class="acts" style="justify-content:center"><button class="btn ghost" onclick="relatosLimpar()">Limpar filtros</button></div></div>`
      : `<div class="vazio"><div class="glyph">0</div><h3>Nenhum relato em aberto.</h3>
          <div class="acts" style="justify-content:center"><a class="btn ghost" href="#/versoes/comentarios/bug">Relatar um bug</a></div></div>`;
}
function relatosLimpar(){ Object.assign(versoes.filtro, { tipo:'', status:'abertos', q:'' }); telaRelatos(); }

async function relatoVotar(id, voto){
  const f = (versoes.relatos || []).find(x => x.id === id);
  const { data, error } = await sb.rpc('feedback_votar', { p:{ id, voto } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível votar'), true);
  if (f){ f.votos = data.votos; f.votei = data.votei; }
  if (/^#\/versoes\/comentarios\/\d+/.test(location.hash)) telaRelato(id, true); else telaRelatosLista();
}

/* ---------- relatar ---------- */
function telaNovoRelato(tipo){
  versoes.novo.tipo = tipo === 'sugestao' ? 'sugestao' : 'bug';
  const tela = state.telaAnterior && !/^#\/versoes/.test(state.telaAnterior) ? state.telaAnterior : '';
  if (!state.perfil?.registro){
    $('#main').innerHTML = topoVersoes('comentarios') + `<div class="aviso-box warn">${esc(MOTIVO_RPC.sem_registro)}</div>`;
    return;
  }
  $('#main').innerHTML = topoVersoes('comentarios') + `
    <div class="card" style="max-width:760px">
      <h3>${versoes.novo.tipo === 'bug' ? 'Relatar um bug' : 'Sugerir uma melhoria'}</h3>
      <div class="form-grid" style="margin-top:14px">
        <div class="fld full"><label>Tipo</label><span class="seg" role="group" aria-label="Tipo do relato" id="rl-tipo">
          <button type="button" class="${versoes.novo.tipo === 'bug' ? 'on' : ''}" onclick="relatoTipo('bug')">${ic('bug')} Bug</button>
          <button type="button" class="${versoes.novo.tipo === 'sugestao' ? 'on' : ''}" onclick="relatoTipo('sugestao')">${ic('lampada')} Sugestão</button></span></div>
        <div class="fld full"><label for="rl-tit">Título</label>
          <input id="rl-tit" maxlength="160" autocomplete="off" oninput="relatoParecidos()"
            placeholder="${versoes.novo.tipo === 'bug' ? 'O quadro não abre no celular' : 'Exportar o quadro para planilha'}"></div>
        <div class="fld full" id="rl-parecidos" hidden></div>
        <div class="fld full"><label for="rl-corpo">Descrição</label>${mdBarra('rl-corpo')}
          <textarea id="rl-corpo" rows="7" placeholder="${versoes.novo.tipo === 'bug'
            ? 'O que aconteceu, o que era esperado e como repetir.' : 'O que ajudaria, e em que situação.'}"></textarea></div>
        <div class="fld full"><label for="rl-tela">Tela ${dica('A tela em que você estava antes de abrir esta página. Apague se não tiver relação.')}</label>
          <input id="rl-tela" value="${esc(tela)}" placeholder="#/atividades/ORT"></div>
      </div>
      <p class="small muted" style="margin-top:4px">Vai junto: SOMA ${esc(VERSAO)}, ${esc(nomeDoAparelho())}.</p>
      <p class="err-msg" id="rl-erro"></p>
      <div class="acts" style="justify-content:flex-end">
        <a class="btn ghost" href="#/versoes/comentarios">Cancelar</a>
        <button class="btn solid" id="rl-btn" onclick="relatoEnviar()">Enviar</button>
      </div>
    </div>`;
  vsCarregar();
  setTimeout(() => $('#rl-tit')?.focus(), 50);
}
function relatoTipo(t){
  versoes.novo.tipo = t;
  document.querySelectorAll('#rl-tipo button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick').includes(`'${t}'`)));
  const h = document.querySelector('#main .card h3'); if (h) h.textContent = t === 'bug' ? 'Relatar um bug' : 'Sugerir uma melhoria';
  $('#rl-corpo').placeholder = t === 'bug' ? 'O que aconteceu, o que era esperado e como repetir.' : 'O que ajudaria, e em que situação.';
}
/* os relatos parecidos, pelas palavras do título: votar no que existe é
   melhor do que abrir o mesmo de novo */
function relatoParecidos(){
  const el = $('#rl-parecidos'); if (!el) return;
  const palavras = t => new Set(norm(t).split(/[^a-z0-9]+/).filter(w => w.length > 3));
  const q = palavras($('#rl-tit').value);
  const achados = q.size < 2 ? [] : (versoes.relatos || [])
    .map(f => ({ f, n: [...palavras(f.titulo)].filter(w => q.has(w)).length }))
    .filter(x => x.n >= 2).sort((a, b) => b.n - a.n || b.f.votos - a.f.votos).slice(0, 3);
  el.hidden = !achados.length;
  el.innerHTML = achados.length ? `<label>Parecidos: vote no que já existe</label>
    <div class="fb-lista">${achados.map(x => relatoLinhaHTML(x.f)).join('')}</div>` : '';
}
async function relatoEnviar(){
  const titulo = $('#rl-tit').value.trim(), erro = $('#rl-erro'), bt = $('#rl-btn');
  if (titulo.length < 3){ erro.textContent = 'Informe o título.'; return; }
  bt.disabled = true; bt.textContent = 'Enviando…'; erro.textContent = '';
  try {
    const { data, error } = await sb.rpc('feedback_salvar', { p:{ tipo:versoes.novo.tipo, titulo,
      corpo:$('#rl-corpo').value, versao:VERSAO, tela:$('#rl-tela').value.trim(), aparelho:nomeDoAparelho() } });
    if (error && /feedback_salvar/.test(error.message || '')){ erro.textContent = 'Falta aplicar a migração db/2.17.0_notas_fotos_e_cartoes.sql.'; return; }
    if (error || data?.status !== 'ok'){ erro.textContent = motivoRPC(data, error, 'Não foi possível enviar'); return; }
    toast(`${data.codigo} enviado.`);
    await vsCarregar(true);
    location.hash = '#/versoes/comentarios/' + data.id;
  } finally {
    const b = $('#rl-btn'); if (b){ b.disabled = false; b.textContent = 'Enviar'; }
  }
}

/* ---------- um relato ---------- */
async function telaRelato(id, semCarregar){
  if (!semCarregar) $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Carregando…</div>';
  await vsCarregar(!semCarregar);
  if (route().r !== 'versoes') return;
  if (versoes.erro){ $('#main').innerHTML = topoVersoes('comentarios') + vsSemMigracao(); return; }
  const f = (versoes.relatos || []).find(x => x.id === id);
  if (!f){
    $('#main').innerHTML = topoVersoes('comentarios') + `<div class="vazio"><h3>Relato não encontrado.</h3>
      <div class="acts" style="justify-content:center"><a class="btn ghost" href="#/versoes/comentarios">Voltar aos relatos</a></div></div>`;
    return;
  }
  const [c, v] = await Promise.all([
    sb.from('soma_feedback_comentarios').select('*').eq('feedback_id', id).order('criado_em'),
    sb.from('soma_feedback_votos').select('registro,criado_em').eq('feedback_id', id)
  ]);
  const coms = c.data || [], votos = v.data || [];
  const eu = state.perfil?.registro, meu = f.autor === eu, adm = fbAdmin();
  const autor = state.membros.find(m => m.registro === f.autor) || { registro:f.autor, nome:f.autor_nome || 'Alguém' };
  const pessoa = r => state.membros.find(m => m.registro === r) || { registro:r, nome:'Registro ' + r };
  const todos = [...state.membros].filter(m => m.registro !== f.autor);
  $('#main').innerHTML = cabecalho({ espaco:'SOMA', titulo:f.titulo, codigo:f.codigo, voltar:['Bugs e sugestões', '#/versoes/comentarios'],
      acoes:[meu && f.status === 'aberto' ? `<button class="btn ghost" onclick="relatoEditar(${f.id})">${ic('pencil')} Editar</button>` : '',
        (meu && f.status === 'aberto') || adm ? `<button class="btn ghost" onclick="relatoExcluir(${f.id})">${ic('trash')} Excluir</button>` : ''] }) + `
    <div class="fb-det">
      <div>
        <div class="card" style="margin-bottom:16px" id="rl-corpo-card">
          <div class="fb-sub" style="margin:0 0 12px">${fbCod(f)} ${fbPill(f.status)}
            ${avatarFoto(autor, 22, 9)}<span>${esc(autor.nome)}, ${fmtDT(f.criado_em)}</span></div>
          ${f.corpo ? `<div class="md">${md(f.corpo)}</div>` : '<p class="small muted">Sem descrição.</p>'}
          ${f.resposta || (f.status !== 'aberto' && f.decidido_por) ? `<div class="fb-resposta">
            ${f.resposta ? `<div class="md">${md(f.resposta)}</div>` : ''}
            <div class="quem">${esc(FB_STATUS[f.status]?.[0] || f.status)}${f.status === 'feito' && f.versao_feito ? ` na <a href="#/versoes/${esc(f.versao_feito)}">${esc(f.versao_feito)}</a>` : ''}${
              f.status === 'duplicado' && f.duplicado_de ? `: <a href="#/versoes/comentarios/${f.duplicado_de}">${esc(f.duplicado_de_codigo || '')}</a>` : ''},
              ${esc(f.decidido_por_nome || '')}${f.decidido_em ? ', ' + fmtD(f.decidido_em) : ''}</div></div>` : ''}
        </div>
        <div class="card">
          <h3>Comentários ${coms.length ? `<span class="muted">(${coms.length})</span>` : ''}</h3>
          <div class="cd-coments" style="margin-top:14px">${coms.map(k => { const q = pessoa(k.registro);
            return `<div class="cm">${avatarFoto(q, 28, 10)}<div class="cm-cx"><div class="cm-tp"><b>${esc(q.nome)}</b>
              <span>${fmtQuando(k.criado_em)}</span></div><div class="cm-cp md">${md(k.corpo)}</div></div></div>`; }).join('')
            || '<div class="kb-vazio" style="text-align:left">Nenhum comentário.</div>'}</div>
          ${eu != null ? `<div class="cd-novo">${mdBarra('rl-com')}
            <textarea id="rl-com" rows="3" placeholder="${f.tipo === 'bug' ? 'Se acontece também com você, informe a tela e o aparelho.' : 'Um detalhe, um caso de uso.'}"></textarea>
            <div class="acts" style="margin-top:10px"><button class="btn solid" id="rl-com-btn" onclick="relatoComentar(${f.id})">Comentar</button></div></div>` : ''}
        </div>
      </div>
      <div>
        <div class="card" style="margin-bottom:16px">
          <h3>${f.tipo === 'bug' ? 'Também acontece' : 'Também querem'}</h3>
          <div class="cd-linha" style="margin-top:12px">
            <button class="fb-voto${f.votei ? ' on' : ''}" onclick="relatoVotar(${f.id}, ${!f.votei})" aria-pressed="${!!f.votei}"
              title="${f.tipo === 'bug' ? 'Também acontece comigo' : 'Também quero'}">${ic('votar')}<b>${f.votos || 0}</b></button>
            <span class="kb-rostos">${votos.slice(0, 8).map(x => avatarFoto(pessoa(x.registro), 26, 10)).join('')}</span>
          </div>
          <dl class="dl" style="margin-top:14px;grid-template-columns:1fr">
            <div class="it"><dt>Versão</dt><dd>${f.versao ? `<a href="#/versoes/${esc(f.versao)}">${esc(f.versao)}</a>` : '—'}</dd></div>
            <div class="it"><dt>Tela</dt><dd>${f.tela && /^#\/[\w\-/.%]*$/.test(f.tela) ? `<a href="${esc(f.tela)}">${esc(f.tela)}</a>` : esc(f.tela || '—')}</dd></div>
            <div class="it"><dt>Aparelho</dt><dd>${esc(f.aparelho || '—')}</dd></div>
          </dl>
        </div>
        ${adm ? `<div class="card">
          <h3>Andamento</h3>
          <div class="fld" style="margin-top:12px"><label for="rd-st">Situação</label>
            <select id="rd-st" onchange="relatoDecidirCampos()">${Object.entries(FB_STATUS).map(([k, [l]]) =>
              `<option value="${k}"${f.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
          <div class="fld" id="rd-versao-fld"><label for="rd-versao">Feito na versão</label>
            <input id="rd-versao" value="${esc(f.versao_feito || '')}" placeholder="${esc(VERSAO)}"></div>
          <div class="fld" id="rd-dup-fld"><label for="rd-dup">Duplicado de</label>
            <select id="rd-dup"><option value="">—</option>${(versoes.relatos || []).filter(x => x.id !== f.id).map(x =>
              `<option value="${x.id}"${f.duplicado_de === x.id ? ' selected' : ''}>${esc(x.codigo)} ${esc(x.titulo)}</option>`).join('')}</select></div>
          <div class="fld"><label for="rd-tipo">Tipo</label>
            <select id="rd-tipo"><option value="bug"${f.tipo === 'bug' ? ' selected' : ''}>Bug</option>
              <option value="sugestao"${f.tipo === 'sugestao' ? ' selected' : ''}>Sugestão</option></select></div>
          <div class="fld"><label for="rd-resp">Resposta</label>
            <textarea id="rd-resp" rows="3" placeholder="O que foi feito, ou por que não">${esc(f.resposta || '')}</textarea></div>
          <p class="err-msg" id="rd-erro"></p>
          <div class="acts"><button class="btn solid" id="rd-btn" onclick="relatoDecidir(${f.id})">Registrar</button></div>
        </div>` : ''}
      </div>
    </div>`;
  if (adm) relatoDecidirCampos();
}
function relatoDecidirCampos(){
  const st = $('#rd-st')?.value;
  const v = $('#rd-versao-fld'), d = $('#rd-dup-fld');
  if (v) v.hidden = st !== 'feito';
  if (d) d.hidden = st !== 'duplicado';
}
async function relatoDecidir(id){
  const bt = $('#rd-btn'), erro = $('#rd-erro');
  bt.disabled = true; erro.textContent = '';
  const st = $('#rd-st').value;
  const { data, error } = await sb.rpc('feedback_decidir', { p:{ id, status:st, tipo:$('#rd-tipo').value,
    resposta:$('#rd-resp').value, versao_feito: st === 'feito' ? ($('#rd-versao').value.trim() || VERSAO) : null,
    duplicado_de: st === 'duplicado' ? $('#rd-dup').value || null : null } });
  bt.disabled = false;
  if (error || data?.status !== 'ok'){
    erro.textContent = data?.campo === 'duplicado_de' ? 'Escolha o relato de que este é duplicado.' : motivoRPC(data, error, 'Não foi possível registrar');
    return;
  }
  toast('Andamento registrado.');
  await vsCarregar(true); telaRelato(id, true);
}
async function relatoComentar(id){
  const cx = $('#rl-com'), bt = $('#rl-com-btn'), corpo = (cx?.value || '').trim();
  if (!corpo) return;
  bt.disabled = true; bt.textContent = 'Enviando…';
  try {
    const { data, error } = await sb.rpc('feedback_comentar', { p:{ id, corpo } });
    if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível comentar'), true);
    const f = (versoes.relatos || []).find(x => x.id === id); if (f) f.comentarios = (f.comentarios || 0) + 1;
    telaRelato(id, true);
  } finally { const b = $('#rl-com-btn'); if (b){ b.disabled = false; b.textContent = 'Comentar'; } }
}
function relatoEditar(id){
  const f = (versoes.relatos || []).find(x => x.id === id); if (!f) return;
  abreModal(`<h3>Editar ${esc(f.codigo)}</h3>
    <div class="form-grid" style="margin-top:12px">
      <div class="fld full"><label for="re-tit">Título</label><input id="re-tit" maxlength="160" value="${esc(f.titulo)}"></div>
      <div class="fld full"><label for="re-corpo">Descrição</label>${mdBarra('re-corpo')}<textarea id="re-corpo" rows="7">${esc(f.corpo || '')}</textarea></div>
    </div>
    <p class="err-msg" id="re-erro"></p>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="relatoSalvarEdicao(${f.id})">Salvar</button></div>`, true, true);
}
async function relatoSalvarEdicao(id){
  const f = (versoes.relatos || []).find(x => x.id === id); if (!f) return;
  const { data, error } = await sb.rpc('feedback_salvar', { p:{ id, tipo:f.tipo, titulo:$('#re-tit').value, corpo:$('#re-corpo').value } });
  if (error || data?.status !== 'ok'){
    $('#re-erro').textContent = data?.campo === 'titulo' ? 'Informe o título.' : FB_MOTIVO[data?.status] || motivoRPC(data, error, 'Não foi possível salvar');
    return;
  }
  fechaModal(); toast('Relato atualizado.');
  await vsCarregar(true); telaRelato(id, true);
}
async function relatoExcluir(id){
  const f = (versoes.relatos || []).find(x => x.id === id); if (!f) return;
  if (!await confirma(`Excluir <b>${esc(f.codigo)} ${esc(f.titulo)}</b>? Os votos e os comentários saem junto.`, 'Excluir')) return;
  const { data, error } = await sb.rpc('feedback_excluir', { p:{ id } });
  if (error || data?.status !== 'ok') return toast(FB_MOTIVO[data?.status] || motivoRPC(data, error, 'Não foi possível excluir'), true);
  toast(`${f.codigo} excluído.`);
  versoes.relatos = (versoes.relatos || []).filter(x => x.id !== id);
  location.hash = '#/versoes/comentarios';
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'versoes', rotulo:'Notas de versão',
  buscar: (t) => filtrarSimples([
    ...NOTAS_VERSAO.map(n => ({ titulo:`${n.v} ${n.titulo}`, sub:'Notas de versão' + (n.antes ? `, antes ${n.antes}` : ''),
      href:'#/versoes/' + n.v })),
    ...(versoes.relatos || []).map(f => ({ titulo:f.titulo, sub:`${FB_STATUS[f.status]?.[0] || f.status}, ${f.tipo === 'bug' ? 'bug' : 'sugestão'}`,
      codigo:f.codigo, href:'#/versoes/comentarios/' + f.id }))
  ], t, 6)
});
