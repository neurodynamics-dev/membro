/* ============================================================
   MÓDULO · DOCUMENTOS — o que o SOMA emite, e os eventos
   Dois serviços que terminam num documento autenticável, desenhado
   no modelo da NRO (doc-nro.js):

   DECLARAÇÃO DE VÍNCULO. Sai na hora, com os dados da ficha, os
   treinamentos concluídos e os eventos aprovados. Não fica guardada:
   cada emissão ganha um código verificador, e o que foi impresso fica
   no banco para a validação (auth.neurodynamics.dev) e para a segunda
   via. O PN é o registro do membro: a do 17 é NRO-DIR-004-17.

   EVENTOS E PARTICIPAÇÕES. O registro da participação da equipe num
   evento (EXT-14): quem foi — membros e externos, estes só com nome e
   e-mail —, onde, quando e quantas horas. Como uma publicação do
   Studio, só vale aprovado, por gente dos grupos escolhidos e nunca
   por quem mandou; aprovado, cada participante ganha a declaração de
   participação (NRO-DIR-006-14) e um e-mail com o link.

   Rotas (Serviços é da casca; ela desce este módulo e chama):
     #/servicos/declaracao                 a sua declaração
     #/servicos/declaracao/<registro>      a de outra pessoa (Depto. de Pessoal)
     #/servicos/eventos                    os seus eventos
     #/servicos/eventos/aprovar            os que esperam a sua aprovação
     #/servicos/eventos/todos              todos os aprovados da equipe
     #/servicos/eventos/novo               registrar um
     #/servicos/eventos/EXT-14             um evento
     #/servicos/eventos/EXT-14/editar      editar (quem registrou)
     #/servicos/eventos/config             quem aprova (admin e Depto. de Pessoal)

   Precisa da migração db/v25_documentos_eventos.sql.

   Depende da casca para: sb, $, esc, norm, state, can, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, confirma, falha, motivoRPC, nomeDe,
   avatarFoto, registrarBusca, precisaDocNRO, hojeISO, grupoPorId.
   ============================================================ */

const docs = { previa:null, emitidas:null, alvo:null, ev:{ lista:null, erro:null }, evAtual:null, evForm:null, cfg:null };

const EVX_STATUS = {
  rascunho:  { l:'Rascunho',     dt:'dt-gray', p:'' },
  aprovacao: { l:'Em aprovação', dt:'dt-warn', p:'p-warn' },
  aprovado:  { l:'Aprovado',     dt:'dt-ok',   p:'p-ok' },
  cancelado: { l:'Cancelado',    dt:'dt-bad',  p:'p-bad' }
};
const EVX_MODALIDADE = { presencial:'Presencial', online:'Online', hibrido:'Híbrido' };
const EVX_PAPEIS = ['Participante', 'Palestrante', 'Apresentador(a) de trabalho', 'Expositor(a)', 'Organização',
  'Mediação', 'Ouvinte', 'Apoio', 'Coautor(a)'];
const DOC_FALTA = {
  cpf:   'A ficha não tem CPF: a declaração sai sem ele.',
  cargo: 'A ficha não tem cargo: a declaração diz só que integra a equipe.',
  desde: 'A ficha não tem a data de ingresso: a declaração sai sem o “desde quando”.'
};
const MOTIVO_DOC = {
  sem_serie: 'A série da declaração não está configurada — falta aplicar a migração v25.',
  futuro: 'O evento ainda não aconteceu: registre agora e mande para aprovação depois dele.',
  propria: 'Quem mandou para aprovação não aprova o próprio registro.',
  ja_aprovou: 'Você já aprovou esta versão.',
  fora_de_aprovacao: 'O evento não está mais em aprovação.',
  fechado: 'Este registro já está fechado.',
  ja_enviado: 'Já está em aprovação.',
  nao_aprovado: 'O evento não está aprovado.',
  ja_revogado: 'Esta emissão já estava revogada.',
  na_fila: 'O e-mail ainda está na fila: sai no próximo envio, em poucos minutos.'
};
const docMotivo = (data, error, padrao) => error ? motivoRPC(null, error, padrao)
  : MOTIVO_DOC[data?.status] || motivoRPC(data, null, padrao);
const docTopo = (titulo, lead, acoes, olho) => `<div class="topo-gestao"><div class="tx">
  <span class="eyebrow">${esc(olho || 'Serviços · Documentos')}</span><h1>${titulo}</h1>
  ${lead ? `<p class="lead">${lead}</p>` : ''}</div>${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
const docFaltaBanco = (erro, titulo) => `${docTopo(titulo, '')}<div class="aviso-box err"><b>Isto ainda não está no banco.</b>
  ${esc(erro?.message || '')}<br><span class="small">Falta aplicar a migração <code>db/v25_documentos_eventos.sql</code>.</span></div>`;
const docCarregando = t => `<div class="carregando"><span class="spin"></span> ${t || 'Carregando…'}</div>`;
const docHost = url => String(url || 'https://auth.neurodynamics.dev').replace(/^https?:\/\//, '').replace(/\/+$/, '');

/* O PDF de uma emissão, desenhado de novo a partir do que foi
   impresso — a primeira via e a segunda saem daqui, iguais. */
async function docBaixarEmissao(e){
  const t = setTimeout(() => toast('Preparando o PDF…'), 350);
  try{
    await precisaDocNRO();
    const doc = e.tipo === 'participacao' ? DocNRO.declaracaoParticipacao(e) : DocNRO.declaracaoVinculo(e);
    DocNRO.baixar(doc);
  }catch(err){ falha(err, 'Não foi possível gerar o PDF'); }
  finally{ clearTimeout(t); }
}
async function docSegundaVia(codigo){
  const { data, error } = await sb.rpc('doc_emitido_ler', { p_codigo: codigo });
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível abrir a emissão'), true);
  docBaixarEmissao(data);
}

/* ============================================================
   A DECLARAÇÃO DE VÍNCULO
   ============================================================ */
async function pageDeclaracao(sub2){
  const reg = can() && /^\d+$/.test(String(sub2 || '')) ? Number(sub2) : state.perfil?.registro;
  docs.alvo = reg;
  if (!reg){
    $('#main').innerHTML = `${docTopo('Declaração de vínculo', '')}<div class="aviso-box warn">A sua conta ainda não está ligada a
      um registro do quadro, e a declaração sai dos dados da ficha. O Depto. de Pessoal faz o vínculo em
      <b>Administração › Contas</b>.</div>`;
    return;
  }
  $('#main').innerHTML = docCarregando('Lendo a ficha…');
  const [pv, em] = await Promise.all([
    sb.rpc('doc_vinculo_previa', { p_registro: reg }),
    sb.rpc('doc_emitidos_de', { p_registro: reg })
  ]);
  if (pv.error){ $('#main').innerHTML = docFaltaBanco(pv.error, 'Declaração de vínculo'); return; }
  if (pv.data?.status !== 'ok'){
    $('#main').innerHTML = `${docTopo('Declaração de vínculo', '')}<div class="aviso-box err">${esc(docMotivo(pv.data, null, 'Não foi possível ler a ficha'))}</div>`;
    return;
  }
  docs.previa = pv.data;
  docs.emitidas = Array.isArray(em.data) ? em.data : [];
  dclDesenhar();
}

function dclDesenhar(){
  const p = docs.previa, d = p.dados || {}, eu = docs.alvo === state.perfil?.registro;
  const nT = (d.treinamentos || []).length, nE = (d.eventos || []).length;
  const vinc = d.vigente === false
    ? (d.desde && d.ate ? `de ${DocNRO_mesAno(d.desde)} a ${DocNRO_mesAno(d.ate)}` : d.ate ? `até ${DocNRO_mesAno(d.ate)}` : 'encerrado')
    : (d.desde ? `desde ${DocNRO_mesAno(d.desde)}` : 'vigente');
  const outros = can() ? `<div class="fld dcl-quem"><label for="dcl-quem">Emitir para</label>
      <select id="dcl-quem" onchange="location.hash = '#/servicos/declaracao/' + this.value">${[...state.membros]
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
        .map(m => `<option value="${m.registro}" ${m.registro === docs.alvo ? 'selected' : ''}>${esc(m.nome)}${
          m.status && m.status !== 'Ativo' ? ' · ' + esc(m.status) : ''}</option>`).join('')}</select></div>` : '';
  const ativas = docs.emitidas.filter(x => x.tipo === 'vinculo');
  const part = docs.emitidas.filter(x => x.tipo === 'participacao');
  $('#main').innerHTML = `${docTopo('Declaração de vínculo',
      `A declaração sai na hora, em PDF, no modelo da NRO: os dados da ${eu ? 'sua ' : ''}ficha na primeira folha e, na segunda,
       os treinamentos concluídos e os eventos de que ${eu ? 'você participou' : 'a pessoa participou'}. Ela não fica guardada no
       portal — cada emissão ganha um código verificador, e quem a receber confere em ${esc(docHost(p.url_validacao))}.`)}
    ${outros}
    <div class="dcl-grade">
      <div class="card dcl-previa">
        <div class="dcl-folha" aria-hidden="true">
          <div class="dcl-folha-cab"><span class="lg">NeuroDynamics</span>
            <span class="dp"><b>${esc(p.emissor || 'Diretoria')}</b><br>Declaração de vínculo<br>${esc(p.documento || '')}${p.revisao ? ' Rev. ' + esc(p.revisao) : ''}</span></div>
          <p>Declaramos, para os devidos fins, que <b>${esc(String(d.nome || '').toUpperCase())}</b>${d.cpf ? ', CPF nº ' + esc(dclCpfTela(d.cpf)) + ',' : ''}
            ${d.vigente === false ? 'atuou' : 'atua'} ${d.cargo ? 'como ' + esc(String(d.cargo).toUpperCase()) : 'na equipe'} da NeuroDynamics PD&amp;I ${esc(vinc)}.</p>
          <div class="dcl-folha-pe">${ic('dado')} código verificador · QR Code · ${esc(docHost(p.url_validacao))}</div>
        </div>
        <dl class="dcl-dados">
          <div><dt>Documento</dt><dd class="mono">${esc(p.documento || '—')}${p.revisao ? ' Rev. ' + esc(p.revisao) : ''}</dd></div>
          <div><dt>Nome</dt><dd>${esc(d.nome || '—')}</dd></div>
          <div><dt>CPF</dt><dd class="mono">${d.cpf ? esc(dclCpfTela(d.cpf)) : '<span class="dim">não consta na ficha</span>'}</dd></div>
          <div><dt>Cargo</dt><dd>${esc(d.cargo || '—')}</dd></div>
          <div><dt>Vínculo</dt><dd>${esc(vinc.charAt(0).toUpperCase() + vinc.slice(1))}</dd></div>
          <div><dt>Segunda folha</dt><dd>${nT} ${nT === 1 ? 'treinamento' : 'treinamentos'} · ${nE} ${nE === 1 ? 'evento' : 'eventos'}</dd></div>
        </dl>
        ${(p.faltam || []).length ? `<div class="aviso-box warn" style="margin:14px 0 0">${(p.faltam || []).map(f => esc(DOC_FALTA[f] || f)).join('<br>')}
          <br><span class="small">Quem atualiza a ficha é o Depto. de Pessoal${can() ? ` — <a href="#/equipe/${docs.alvo}" style="text-decoration:underline">abrir a ficha</a>` : ''}.</span></div>` : ''}
        <div class="acts" style="margin-top:18px">
          <button class="btn solid" id="dcl-btn" onclick="dclEmitir()">${ic('selo')} Emitir a declaração</button>
          <span class="small muted">Sem assinatura: vale o código.</span>
        </div>
      </div>
      <aside class="card dcl-como">
        <h3>${ic('shield')} Como se confere</h3>
        <ol>
          <li>O rodapé de cada folha traz o <b>código verificador</b>, o código de controle e um QR Code.</li>
          <li>Quem recebe abre <b>${esc(docHost(p.url_validacao))}</b> — ou lê o QR Code — e vê o que foi impresso, com o CPF mascarado.</li>
          <li>Qualquer diferença entre o papel e a tela é adulteração. Uma emissão revogada aparece como revogada.</li>
        </ol>
        <p class="small muted" style="margin-top:10px">O portal não guarda o arquivo: guarda o que foi impresso, o código e quando. A
          segunda via sai igual, com o mesmo código.</p>
      </aside>
    </div>
    <div class="tre-sec" style="margin-top:26px"><h2>Emitidas <span class="n">${ativas.length}</span></h2>
      ${ativas.length ? dclTabela(ativas) : `<p class="small muted" style="margin-top:6px">Nenhuma declaração emitida ainda.</p>`}</div>
    ${part.length ? `<div class="tre-sec"><h2>Declarações de participação <span class="n">${part.length}</span></h2>${dclTabela(part)}</div>` : ''}`;
}
/* o CPF na tela: só os seis do meio, como a validação pública mostra */
const dclCpfTela = c => { const d = String(c || '').replace(/\D/g, '');
  return d.length === 11 ? `•••.${d.slice(3, 6)}.${d.slice(6, 9)}-••` : '•••'; };
const DocNRO_mesAno = iso => { const [a, m] = String(iso || '').split('-').map(Number);
  return a ? `${['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'][m - 1]} de ${a}` : ''; };

function dclTabela(lista){
  return `<div class="tabela-rolar"><table class="tabela trabalho dcl-tab"><thead><tr><th>Código verificador</th><th>Documento</th>
    <th>Emitida</th><th>Conferida</th><th>Situação</th><th></th></tr></thead><tbody>${lista.map(x => `<tr>
      <td class="mono">${esc(x.codigo)}</td>
      <td><span class="mono">${esc(x.documento)}${x.revisao ? ' Rev. ' + esc(x.revisao) : ''}</span>${x.evento_codigo
        ? ` <a class="chip mini" href="#/servicos/eventos/${esc(x.evento_codigo)}">${esc(x.evento_codigo)}</a>` : ''}</td>
      <td>${fmtDT(x.emitido_em)}<span class="small dim" style="display:block">${esc(x.emitido_nome || '')}</span></td>
      <td>${x.consultas ? `${x.consultas}× <span class="small dim">· ${fmtD(x.consultado_em)}</span>` : '<span class="dim">ainda não</span>'}</td>
      <td>${x.revogado_em ? `<span class="pill p-bad" title="${esc(x.revogado_motivo || '')}"><span class="dt dt-bad"></span>Revogada</span>`
        : '<span class="pill p-ok"><span class="dt dt-ok"></span>Válida</span>'}</td>
      <td class="acoes-linha">
        <button class="btn ghost mini" onclick="docSegundaVia('${esc(x.codigo)}')">${ic('down')} Segunda via</button>
        ${!x.revogado_em && x.tipo === 'vinculo' ? `<button class="btn ghost mini" onclick="dclRevogar('${esc(x.codigo)}')">Revogar</button>` : ''}
      </td></tr>`).join('')}</tbody></table></div>`;
}

async function dclEmitir(){
  const b = $('#dcl-btn'); if (b){ b.disabled = true; b.textContent = 'Emitindo…'; }
  try{
    const { data, error } = await sb.rpc('doc_vinculo_emitir', { p_registro: docs.alvo });
    if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível emitir'), true);
    await docBaixarEmissao(data);
    toast(`Declaração emitida. Código verificador ${data.codigo}.`);
    const em = await sb.rpc('doc_emitidos_de', { p_registro: docs.alvo });
    docs.emitidas = Array.isArray(em.data) ? em.data : docs.emitidas;
    dclDesenhar();
  } finally { const x = $('#dcl-btn'); if (x){ x.disabled = false; x.innerHTML = `${ic('selo')} Emitir a declaração`; } }
}
function dclRevogar(codigo){
  abreModal(`<h3>Revogar a declaração ${esc(codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">A validação passa a dizer que ela foi revogada, com o motivo. Revogar não apaga nada — e
      não tem volta: emita outra, se precisar.</p>
    <div class="fld"><label for="dcl-mot">Motivo</label>
      <textarea id="dcl-mot" rows="3" placeholder="Emitida antes de a ficha ser atualizada."></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn perigo" onclick="dclRevogarConfirma('${esc(codigo)}')">Revogar</button></div>`);
}
async function dclRevogarConfirma(codigo){
  const mot = $('#dcl-mot')?.value.trim();
  if (!mot) return toast('Diga o motivo — é o que a validação vai mostrar.', true);
  const { data, error } = await sb.rpc('doc_emitido_revogar', { p_codigo: codigo, p_motivo: mot });
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível revogar'), true);
  fechaModal(); toast('Declaração revogada.');
  pageDeclaracao(docs.alvo !== state.perfil?.registro ? docs.alvo : null);
}

/* ============================================================
   OS EVENTOS
   ============================================================ */
const evxPodeConfigurar = () => can();
async function pageEventosExt(sub2){
  const s = String(sub2 || '');
  const extra = String(location.hash.split('/')[4] || '');
  if (s === 'novo') return evxFormulario(null);
  if (s === 'config') return can() ? evxConfig() : (location.hash = '#/servicos/eventos');
  if (/^ext-\d+$/i.test(s)) return extra === 'editar' ? evxFormulario(s.toUpperCase()) : evxPagina(s.toUpperCase());
  return evxLista(['aprovar', 'todos'].includes(s) ? s : 'meus');
}
async function evxCarregar(){
  const { data, error } = await sb.rpc('eventos_ext_lista');
  if (error || !Array.isArray(data)){ docs.ev.erro = error || { message:'eventos_ext_lista não devolveu a lista' }; return false; }
  docs.ev.erro = null; docs.ev.lista = data;
  return true;
}
function evxNav(atual){
  const l = docs.ev.lista || [];
  const nAp = l.filter(e => e.posso_aprovar).length;
  const it = [['', 'Meus'], ['aprovar', 'Para aprovar'], ['todos', 'Todos da equipe']];
  return `<nav class="arq-nav" aria-label="Eventos">${it.map(([k, rot]) => `<a href="#/servicos/eventos${k ? '/' + k : ''}"
    class="${atual === (k || 'meus') ? 'on' : ''}">${rot}${k === 'aprovar' && nAp ? ` <span class="n sua">${nAp}</span>` : ''}</a>`).join('')}
    ${evxPodeConfigurar() ? `<a href="#/servicos/eventos/config" class="${atual === 'config' ? 'on' : ''}">${ic('engrenagem')} Configurações</a>` : ''}</nav>`;
}
const evxPill = st => { const s = EVX_STATUS[st] || { l:st, dt:'dt-gray', p:'' };
  return `<span class="pill ${s.p}"><span class="dt ${s.dt}"></span>${s.l}</span>`; };
const evxPeriodo = e => e.data_fim && e.data_fim !== e.data_inicio ? `${fmtD(e.data_inicio)} a ${fmtD(e.data_fim)}` : fmtD(e.data_inicio);
const evxHoras = h => { const t = Math.round(Number(h || 0) * 60), hh = Math.floor(t / 60), mm = t % 60;
  return mm ? `${hh}h${String(mm).padStart(2, '0')}` : `${hh}h`; };
const evxOnde = e => e.modalidade === 'online' ? 'Online' : (e.local || '—') + (e.modalidade === 'hibrido' ? ' · híbrido' : '');

async function evxLista(filtro){
  $('#main').innerHTML = docCarregando();
  if (!(await evxCarregar())){ $('#main').innerHTML = docFaltaBanco(docs.ev.erro, 'Eventos e participações'); return; }
  const cfg = await evxCfgCarregar();
  const eu = state.perfil?.registro;
  const l = docs.ev.lista;
  const lista = filtro === 'aprovar' ? l.filter(e => e.posso_aprovar)
    : filtro === 'todos' ? l.filter(e => e.status === 'aprovado')
    : l.filter(e => e.eu_participo || e.criado_por === eu);
  const grupos = (cfg?.grupos_aprovadores || []).map(id => grupoPorId(id)?.nome).filter(Boolean);
  $('#main').innerHTML = `${docTopo('Eventos e participações',
      `A participação da equipe num evento — um congresso, uma feira, uma palestra. Registrado, ele vai para a aprovação de
       ${cfg?.aprovacoes_minimas || 2} ${Number(cfg?.aprovacoes_minimas || 2) === 1 ? 'pessoa' : 'pessoas'} ${grupos.length
         ? 'de ' + esc(grupos.join(', ')) : 'da administração'}; aprovado, cada participante recebe por e-mail a declaração de
       participação, autenticável.`,
      `<a class="btn solid" href="#/servicos/eventos/novo">${ic('plus')} Registrar evento</a>`)}
    ${evxNav(filtro)}
    ${lista.length ? `<div class="evx-lista">${lista.map(evxCartao).join('')}</div>`
      : `<div class="vazio"><div class="glyph">${filtro === 'aprovar' ? '✓' : '·'}</div>
          <h3>${filtro === 'aprovar' ? 'Nada esperando a sua aprovação' : filtro === 'todos' ? 'Nenhum evento aprovado ainda'
            : 'Você ainda não registrou nem participou de nenhum evento'}</h3>
          <p>${filtro === 'aprovar' ? 'Quando alguém mandar um registro para aprovação, ele aparece aqui — e no seu início.'
            : 'Foi a um evento representando a equipe? Registre: quem foi, onde, quando e quantas horas.'}</p>
          ${filtro !== 'aprovar' ? `<a class="btn ghost" href="#/servicos/eventos/novo">Registrar evento</a>` : ''}</div>`}`;
}
function evxCartao(e){
  const minha = e.minha_declaracao;
  return `<a class="evx-card" href="#/servicos/eventos/${esc(e.codigo)}">
    <span class="evx-data"><b>${esc(String(e.data_inicio || '').slice(8, 10))}</b>${esc(['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'][Number(String(e.data_inicio).slice(5, 7)) - 1] || '')}
      <i>${esc(String(e.data_inicio || '').slice(0, 4))}</i></span>
    <span class="evx-tx"><span class="cod">${esc(e.codigo)}</span>
      <span class="tt">${esc(e.nome)}</span>
      <span class="mt">${esc(evxPeriodo(e))} · ${esc(evxOnde(e))} · ${evxHoras(e.horas)} · ${e.participantes} ${e.participantes === 1 ? 'pessoa' : 'pessoas'}</span>
      <span class="nm">${(e.nomes || []).map(esc).join(', ')}${e.participantes > (e.nomes || []).length ? '…' : ''}</span></span>
    <span class="evx-lado">${evxPill(e.status)}
      ${e.status === 'aprovacao' ? `<span class="small">${e.aprovacoes} de ${e.aprovacoes_minimas} aprovações</span>` : ''}
      ${e.posso_aprovar ? `<span class="tag-mini evx-sua">espera você</span>` : ''}
      ${minha ? `<span class="small mono" title="O código verificador da sua declaração">${esc(minha)}</span>` : ''}</span></a>`;
}

/* ---------------- a página de um evento ---------------- */
async function evxPagina(codigo){
  $('#main').innerHTML = docCarregando('Abrindo o evento…');
  const { data, error } = await sb.rpc('evento_ext_ler', { p_codigo: codigo });
  if (error){ $('#main').innerHTML = docFaltaBanco(error, 'Eventos e participações'); return; }
  if (data?.status !== 'ok'){
    $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div><h3>Nenhum evento ${esc(codigo)} para você</h3>
      <p>O código pode estar errado, ou o registro é um rascunho de outra pessoa.</p>
      <a class="btn ghost" href="#/servicos/eventos">Eventos e participações</a></div>`;
    return;
  }
  docs.evAtual = data;
  evxDesenharPagina();
}
function evxDesenharPagina(){
  const d = docs.evAtual, e = d.evento, pode = d.pode || {};
  const eu = state.perfil?.registro;
  const meu = (d.participantes || []).find(p => p.registro === eu);
  const devolucao = e.status === 'rascunho' && e.motivo
    ? (d.historico || []).filter(h => ['devolveu','reabriu'].includes(h.acao)).slice(-1)[0] : null;
  const aprovVersao = (d.aprovacoes || []).filter(a => a.versao === e.versao && a.decisao === 'aprovada');
  const acoes = [
    pode.editar ? `<a class="btn ghost" href="#/servicos/eventos/${esc(e.codigo)}/editar">${ic('pencil')} Editar</a>` : '',
    pode.enviar ? `<button class="btn solid" onclick="evxEnviar()">${ic('enviar')} Enviar para aprovação</button>` : '',
    pode.reabrir ? `<button class="btn ghost" onclick="evxModalMotivo('reabrir')">Reabrir para correção</button>` : '',
    pode.cancelar ? `<button class="btn ghost" onclick="evxModalMotivo('cancelar')">Cancelar o registro</button>` : ''
  ].join('');
  $('#main').innerHTML = `
    <a class="tre-voltar" href="#/servicos/eventos" style="margin-top:22px">${ic('back')} Eventos e participações</a>
    ${docTopo(esc(e.nome), '', acoes, `${e.codigo} · evento registrado`)}
    <div class="evx-selos">${evxPill(e.status)}
      <span class="pill"><span class="dt dt-info"></span>${esc(EVX_MODALIDADE[e.modalidade] || e.modalidade)}</span>
      ${e.versao > 1 ? `<span class="pill"><span class="dt dt-gray"></span>versão ${e.versao}</span>` : ''}</div>
    ${devolucao ? `<div class="aviso-box warn">${devolucao.acao === 'reabriu' ? 'Reaberto' : 'Devolvido'} por <b>${esc(devolucao.nome || '')}</b>:
      ${esc(e.motivo)}${devolucao.acao === 'reabriu' ? ' As declarações anteriores foram revogadas.' : ''}</div>` : ''}
    ${e.status === 'cancelado' ? `<div class="aviso-box err">Cancelado: ${esc(e.motivo || '')}</div>` : ''}
    ${meu && meu.declaracao && e.status === 'aprovado' ? `<div class="evx-minha">
      <span>${ic('selo')}</span><div><b>A sua declaração de participação</b>
      <span class="small">Código verificador <span class="mono">${esc(meu.declaracao)}</span> · ${evxHoras(meu.horas || e.horas)} · também foi para o seu e-mail</span></div>
      <button class="btn solid" onclick="docSegundaVia('${esc(meu.declaracao)}')">${ic('down')} Baixar</button></div>` : ''}
    <div class="evx-cols">
      <div class="evx-main">
        <div class="card"><dl class="dcl-dados evx-dados">
          <div><dt>Quando</dt><dd>${esc(evxPeriodo(e))}${e.hora_inicio ? ` · ${esc(e.hora_inicio)}${e.hora_fim ? ' às ' + esc(e.hora_fim) : ''}` : ''}</dd></div>
          <div><dt>Onde</dt><dd>${esc(evxOnde(e))}</dd></div>
          <div><dt>Horas dedicadas</dt><dd>${evxHoras(e.horas)} <span class="dim small">por participante, salvo indicação</span></dd></div>
          <div><dt>Registrado por</dt><dd>${esc(e.criado_nome || '—')} <span class="dim small">· ${fmtD(e.criado_em)}</span></dd></div>
          ${e.descricao ? `<div class="full"><dt>Como a equipe participou</dt><dd>${esc(e.descricao)}</dd></div>` : ''}
        </dl></div>
        <div class="tre-sec" style="margin-top:22px"><h2>Participantes <span class="n">${(d.participantes || []).length}</span></h2>
          <div class="tabela-rolar"><table class="tabela trabalho evx-tab"><thead><tr><th>Nome</th><th>Função</th><th>Horas</th>
            ${pode.emails ? '<th>E-mail</th>' : ''}${e.status === 'aprovado' && pode.declaracoes ? '<th>Declaração</th>' : ''}</tr></thead>
            <tbody>${(d.participantes || []).map(p => `<tr>
              <td><span class="nome">${esc(p.nome)}</span>${p.registro == null ? ' <span class="tag-mini">externo</span>' : ''}</td>
              <td>${esc(p.papel || 'Participante')}</td>
              <td class="mono">${evxHoras(p.horas || e.horas)}</td>
              ${pode.emails ? `<td class="small">${esc(p.email || (p.registro != null ? 'o da ficha' : '—'))}</td>` : ''}
              ${e.status === 'aprovado' && pode.declaracoes ? `<td class="acoes-linha">${p.declaracao ? `<span class="mono small">${esc(p.declaracao)}</span>
                <button class="icon-btn sm" title="Baixar a declaração de ${esc(p.nome)}" aria-label="Baixar a declaração de ${esc(p.nome)}"
                  onclick="docSegundaVia('${esc(p.declaracao)}')">${ic('down')}</button>
                <button class="icon-btn sm" title="Mandar o e-mail de novo" aria-label="Mandar o e-mail de ${esc(p.nome)} de novo"
                  onclick="evxReenviar('${esc(p.id)}')">${ic('mail')}</button>
                ${p.envio_erro ? `<span class="small" style="color:var(--bad-tx)" title="${esc(p.envio_erro)}">falhou</span>`
                  : p.enviado_em ? `<span class="small dim">enviado</span>` : `<span class="small dim">na fila</span>`}` : '—'}</td>` : ''}
            </tr>`).join('')}</tbody></table></div></div>
      </div>
      <aside class="evx-lado-col">
        <div class="card evx-aprov">
          <h3>${ic('shield')} Aprovação</h3>
          <p class="small muted">${e.status === 'aprovado' ? `Aprovado em ${fmtD(e.aprovado_em)}.`
            : e.status === 'aprovacao' ? `${d.aprovacoes_validas} de ${d.aprovacoes_minimas} aprovações da versão ${e.versao}.`
            : e.status === 'rascunho' ? `Precisa de ${d.aprovacoes_minimas} aprovações depois de enviado.` : 'Cancelado.'}</p>
          ${e.status === 'aprovacao' || e.status === 'aprovado' ? `<div class="evx-barra"><i style="width:${Math.min(100,
            Math.round(100 * (e.status === 'aprovado' ? 1 : d.aprovacoes_validas / Math.max(1, d.aprovacoes_minimas))))}%"></i></div>` : ''}
          <ul class="evx-quem">${aprovVersao.map(a => `<li>${ic('check')} <b>${esc(a.nome || '')}</b> <span class="dim small">${fmtDT(a.criado_em)}</span>
            ${a.parecer ? `<span class="small" style="display:block">${esc(a.parecer)}</span>` : ''}</li>`).join('')}</ul>
          ${pode.aprovar ? `<div class="acts" style="margin-top:12px">
            <button class="btn solid mini" onclick="evxModalDecidir('aprovar')">${ic('check')} Aprovar</button>
            <button class="btn ghost mini" onclick="evxModalDecidir('devolver')">Devolver</button></div>` : ''}
        </div>
        <div class="card evx-hist"><h3>${ic('relogio')} Histórico</h3>
          <ol>${(d.historico || []).slice().reverse().map(h => `<li><span class="qd">${fmtDT(h.criado_em)}</span>
            <b>${esc(h.nome || '')}</b> ${esc(EVX_ACAO[h.acao] || h.acao)}${h.detalhe ? `<span class="small" style="display:block">${esc(h.detalhe)}</span>` : ''}</li>`).join('')}</ol></div>
      </aside>
    </div>`;
}
const EVX_ACAO = { criou:'registrou', editou:'editou', enviou:'mandou para aprovação', aprovou:'aprovou', devolveu:'devolveu',
  emitiu:'— saíram as declarações:', reabriu:'reabriu para correção', cancelou:'cancelou', reenviou:'mandou de novo' };

async function evxEnviar(){
  const e = docs.evAtual?.evento; if (!e) return;
  const ok = await confirma(`Mandar <b>${esc(e.codigo)}</b> para aprovação? Quem aprova recebe o aviso no sino e por e-mail. Depois de
    aprovado, o registro fecha e cada participante recebe a declaração.`, 'Enviar');
  if (!ok) return;
  const { data, error } = await sb.rpc('evento_ext_enviar', { p_id: e.id });
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível enviar'), true);
  toast(data.aprovadores ? `Enviado. ${data.aprovadores} ${data.aprovadores === 1 ? 'pessoa foi avisada' : 'pessoas foram avisadas'}.`
    : 'Enviado — mas ninguém está no grupo que aprova. Avise o Depto. de Pessoal.', !data.aprovadores);
  evxPagina(e.codigo);
}
function evxModalDecidir(dec){
  const e = docs.evAtual.evento;
  const faltam = docs.evAtual.aprovacoes_minimas - docs.evAtual.aprovacoes_validas;
  abreModal(`<h3>${dec === 'aprovar' ? 'Aprovar' : 'Devolver'} ${esc(e.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">${dec === 'aprovar'
      ? (faltam <= 1 ? `A sua é a última aprovação que falta: o registro fecha e as declarações de participação saem para os
          ${(docs.evAtual.participantes || []).length} participantes, com e-mail.`
        : `Faltam ${faltam} aprovações; a sua conta como uma delas.`)
      : 'O registro volta para quem o mandou, com o seu parecer.'}</p>
    <div class="fld"><label for="evx-par">Parecer${dec === 'aprovar' ? ' (opcional)' : ''}</label>
      <textarea id="evx-par" rows="3" placeholder="${dec === 'aprovar' ? 'Confere com a programação do evento.' : 'O Hugo não foi; tire da lista.'}"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="evx-dbtn" onclick="evxDecidir('${dec}')">${dec === 'aprovar' ? 'Aprovar' : 'Devolver'}</button></div>`);
}
async function evxDecidir(dec){
  const par = $('#evx-par')?.value.trim() || '';
  if (dec === 'devolver' && !par) return toast('Diga o que precisa mudar.', true);
  const b = $('#evx-dbtn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('evento_ext_decidir', { p: { id: docs.evAtual.evento.id, decisao: dec, parecer: par } });
  if (b) b.disabled = false;
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível registrar a decisão'), true);
  fechaModal();
  toast(data.situacao === 'aprovado' ? `Aprovado. Saíram ${data.declaracoes} declarações de participação.`
    : data.situacao === 'aprovacao' ? `Aprovação registrada. ${data.faltam === 1 ? 'Falta uma.' : `Faltam ${data.faltam}.`}`
    : 'Devolvido para ajuste.');
  evxPagina(docs.evAtual.evento.codigo);
}
function evxModalMotivo(acao){
  const e = docs.evAtual.evento;
  abreModal(`<h3>${acao === 'reabrir' ? 'Reabrir' : 'Cancelar'} ${esc(e.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">${acao === 'reabrir'
      ? 'As declarações de participação já emitidas são <b>revogadas</b> — a validação passa a dizer isso —, o registro volta a rascunho, e quem o registrou corrige e manda de novo. Aprovado outra vez, cada participante recebe uma declaração nova.'
      : 'O registro deixa de valer e não volta. Para registrar de novo, crie outro.'}</p>
    <div class="fld"><label for="evx-mot">Motivo</label><textarea id="evx-mot" rows="3"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Voltar</button>
      <button class="btn perigo" onclick="evxMotivo('${acao}')">${acao === 'reabrir' ? 'Reabrir e revogar' : 'Cancelar o registro'}</button></div>`);
}
async function evxMotivo(acao){
  const mot = $('#evx-mot')?.value.trim();
  if (!mot) return toast('Diga o motivo.', true);
  const { data, error } = await sb.rpc(acao === 'reabrir' ? 'evento_ext_reabrir' : 'evento_ext_cancelar',
    { p_id: docs.evAtual.evento.id, p_motivo: mot });
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível'), true);
  fechaModal();
  toast(acao === 'reabrir' ? `Reaberto: ${data.revogadas} ${data.revogadas === 1 ? 'declaração revogada' : 'declarações revogadas'}.` : 'Registro cancelado.');
  evxPagina(docs.evAtual.evento.codigo);
}
async function evxReenviar(id){
  const { data, error } = await sb.rpc('evento_ext_reenviar', { p_participante: id });
  if (error || data?.status !== 'ok') return toast(docMotivo(data, error, 'Não foi possível mandar de novo'), !!error || data?.status !== 'na_fila');
  toast('O e-mail entra na fila de novo e sai em poucos minutos.');
}

/* ---------------- registrar e editar ---------------- */
async function evxFormulario(codigo){
  let base = { nome:'', descricao:'', modalidade:'presencial', local:'', data_inicio:'', data_fim:'', hora_inicio:'', hora_fim:'', horas:'',
               participantes: state.perfil?.registro ? [{ registro: state.perfil.registro, nome: nomeDe(state.perfil.registro), papel:'', horas:'' }] : [] };
  if (codigo){
    $('#main').innerHTML = docCarregando();
    const { data, error } = await sb.rpc('evento_ext_ler', { p_codigo: codigo });
    if (error || data?.status !== 'ok' || !data.pode?.editar){
      toast(error ? docMotivo(null, error, 'Não foi possível abrir') : 'Este registro não está aberto para edição.', true);
      location.hash = '#/servicos/eventos/' + codigo; return;
    }
    const e = data.evento;
    base = { id:e.id, codigo:e.codigo, status:e.status, versao:e.versao, nome:e.nome, descricao:e.descricao || '', modalidade:e.modalidade,
      local:e.local || '', data_inicio:e.data_inicio || '', data_fim:e.data_fim || '', hora_inicio:e.hora_inicio || '', hora_fim:e.hora_fim || '',
      horas: String(Number(e.horas)), participantes:(data.participantes || []).map(p => ({ registro:p.registro, nome:p.nome, email:p.email || '',
        papel:p.papel || '', horas: p.horas != null ? String(Number(p.horas)) : '' })) };
  }
  docs.evForm = base;
  const f = base;
  $('#main').innerHTML = `
    <a class="tre-voltar" href="#/servicos/eventos${f.codigo ? '/' + esc(f.codigo) : ''}" style="margin-top:22px">${ic('back')} ${f.codigo ? esc(f.codigo) : 'Eventos e participações'}</a>
    ${docTopo(f.codigo ? `Editar ${esc(f.codigo)}` : 'Registrar evento',
      f.status === 'aprovacao' ? `Está em aprovação: salvar cria a versão ${f.versao + 1}, e as aprovações recomeçam.`
      : 'O que foi, onde, quando, quantas horas e quem foi. Depois de o evento acontecer, mande para aprovação: aprovado, cada participante recebe a declaração de participação por e-mail.')}
    <div class="form-card evx-form">
      <div class="form-grid">
        <div class="fld full"><label for="ef-nome">Nome do evento</label>
          <input id="ef-nome" maxlength="200" value="${esc(f.nome)}" placeholder="CBEB 2026 — Congresso Brasileiro de Engenharia Biomédica"></div>
        <div class="fld full"><label for="ef-desc">Como a equipe participou <span class="opc">(opcional — vai na declaração)</span></label>
          <textarea id="ef-desc" rows="2" maxlength="2000" placeholder="Apresentação do pôster do projeto Nebula no estande da UFMG.">${esc(f.descricao)}</textarea></div>
        <div class="fld full"><label>Modalidade</label>
          <div class="seg" role="group" aria-label="Modalidade" id="ef-mod">${Object.entries(EVX_MODALIDADE).map(([k, l]) =>
            `<button type="button" class="${f.modalidade === k ? 'on' : ''}" aria-pressed="${f.modalidade === k}" onclick="evxModalidade('${k}')">${l}</button>`).join('')}</div></div>
        <div class="fld full" id="ef-local-w" ${f.modalidade === 'online' ? 'hidden' : ''}><label for="ef-local">Local</label>
          <input id="ef-local" maxlength="200" value="${esc(f.local)}" placeholder="Centro de Convenções de Vitória (ES)"></div>
        <div class="fld"><label for="ef-ini">Data</label><input id="ef-ini" type="date" value="${esc(f.data_inicio)}"></div>
        <div class="fld"><label for="ef-fim">Até <span class="opc">(se durou mais de um dia)</span></label><input id="ef-fim" type="date" value="${esc(f.data_fim)}"></div>
        <div class="fld"><label for="ef-hi">Horário <span class="opc">(opcional)</span></label><input id="ef-hi" type="time" value="${esc(f.hora_inicio)}"></div>
        <div class="fld"><label for="ef-hf">Até</label><input id="ef-hf" type="time" value="${esc(f.hora_fim)}"></div>
        <div class="fld"><label for="ef-horas">Horas dedicadas</label><input id="ef-horas" type="number" min="0.5" max="9999" step="0.5" value="${esc(f.horas)}" placeholder="8">
          <p class="mini">Por participante. Quem ficou menos (ou mais) tem as suas, na lista abaixo.</p></div>
      </div>
      <div class="adm-grupo">Participantes</div>
      <div id="ef-parts"></div>
      <div class="evx-add">
        <div class="fld" style="margin:0;flex:1;min-width:220px"><label for="ef-membro">Membro da equipe</label>
          <input id="ef-membro" list="ef-membros" placeholder="Comece a digitar o nome" onkeydown="if(event.key==='Enter'){event.preventDefault();evxAddMembro()}">
          <datalist id="ef-membros">${state.membros.filter(m => m.status !== 'Desligado' && m.status !== 'Egresso')
            .map(m => `<option value="${esc(m.nome)}">`).join('')}</datalist></div>
        <button type="button" class="btn ghost mini" onclick="evxAddMembro()">${ic('plus')} Membro</button>
        <button type="button" class="btn ghost mini" onclick="evxAddExterno()">${ic('plus')} Externo</button>
      </div>
      <datalist id="ef-papeis">${EVX_PAPEIS.map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <p class="err-msg" id="ef-erro"></p>
      <div class="acts">
        <button class="btn ghost" id="ef-salvar" onclick="evxSalvar(false)">Salvar rascunho</button>
        ${f.status !== 'aprovacao' ? `<button class="btn solid" id="ef-enviar" onclick="evxSalvar(true)">${ic('enviar')} Salvar e enviar para aprovação</button>`
          : `<button class="btn solid" id="ef-enviar" onclick="evxSalvar(false)">Salvar a versão ${f.versao + 1}</button>`}
        <a class="btn ghost" href="#/servicos/eventos${f.codigo ? '/' + esc(f.codigo) : ''}">Cancelar</a>
      </div>
    </div>`;
  evxDesenharParticipantes();
}
function evxModalidade(k){
  evxLerCampos(); docs.evForm.modalidade = k;
  document.querySelectorAll('#ef-mod button').forEach(b => { const on = b.textContent === EVX_MODALIDADE[k];
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  const w = $('#ef-local-w'); if (w) w.hidden = k === 'online';
}
function evxLerCampos(){
  const f = docs.evForm; if (!f) return;
  const v = id => $(id)?.value ?? '';
  Object.assign(f, { nome:v('#ef-nome').trim(), descricao:v('#ef-desc').trim(), local:v('#ef-local').trim(), data_inicio:v('#ef-ini'),
    data_fim:v('#ef-fim'), hora_inicio:v('#ef-hi'), hora_fim:v('#ef-hf'), horas:v('#ef-horas') });
  document.querySelectorAll('#ef-parts .evx-part').forEach((l, i) => {
    const p = f.participantes[i]; if (!p) return;
    p.papel = l.querySelector('.ep-papel')?.value.trim() || '';
    p.horas = l.querySelector('.ep-horas')?.value || '';
    if (p.registro == null){ p.nome = l.querySelector('.ep-nome')?.value.trim() || ''; p.email = l.querySelector('.ep-email')?.value.trim() || ''; }
  });
}
function evxDesenharParticipantes(){
  const f = docs.evForm, el = $('#ef-parts'); if (!el) return;
  el.innerHTML = f.participantes.length ? f.participantes.map((p, i) => `<div class="evx-part" data-i="${i}">
      ${p.registro != null ? `<span class="ep-quem">${avatarFoto(state.membros.find(m => m.registro === p.registro) || { nome:p.nome }, 26, 10)}
          <b>${esc(p.nome)}</b></span>`
        : `<span class="ep-quem ext"><input class="ep-nome" aria-label="Nome do participante externo" placeholder="Nome completo" value="${esc(p.nome || '')}">
          <input class="ep-email" type="email" aria-label="E-mail do participante externo" placeholder="e-mail" value="${esc(p.email || '')}"></span>`}
      <input class="ep-papel" list="ef-papeis" aria-label="Função de ${esc(p.nome || 'participante')}" placeholder="Função (participante)" value="${esc(p.papel || '')}">
      <input class="ep-horas" type="number" min="0.5" step="0.5" aria-label="Horas de ${esc(p.nome || 'participante')}" placeholder="horas" value="${esc(p.horas || '')}">
      <button type="button" class="icon-btn sm" title="Tirar da lista" aria-label="Tirar ${esc(p.nome || 'participante')} da lista" onclick="evxTirar(${i})">${ic('x')}</button>
    </div>`).join('')
    : `<p class="small muted" style="margin:0 0 10px">Ninguém ainda. Acrescente os membros que foram — e quem foi de fora, com nome e e-mail.</p>`;
}
function evxAddMembro(){
  evxLerCampos();
  const nome = $('#ef-membro')?.value.trim();
  const m = state.membros.find(x => norm(x.nome) === norm(nome)) || state.membros.find(x => norm(x.nome).startsWith(norm(nome)) && nome.length > 2);
  if (!m) return toast('Escolha um nome da lista.', true);
  if (docs.evForm.participantes.some(p => p.registro === m.registro)) return toast(`${m.nome} já está na lista.`, true);
  docs.evForm.participantes.push({ registro:m.registro, nome:m.nome, papel:'', horas:'' });
  $('#ef-membro').value = '';
  evxDesenharParticipantes();
}
function evxAddExterno(){
  evxLerCampos();
  docs.evForm.participantes.push({ registro:null, nome:'', email:'', papel:'', horas:'' });
  evxDesenharParticipantes();
  const ns = document.querySelectorAll('#ef-parts .ep-nome'); ns[ns.length - 1]?.focus();
}
function evxTirar(i){ evxLerCampos(); docs.evForm.participantes.splice(i, 1); evxDesenharParticipantes(); }

const EVX_CAMPO = {
  nome:'Dê o nome do evento (ao menos três letras).', data_inicio:'Diga a data do evento.', data_fim:'O fim não pode vir antes do início.',
  hora_fim:'O horário de fim precisa ser depois do de início.', horas:'Diga quantas horas foram dedicadas.', local:'Diga onde foi — ou marque online.',
  modalidade:'Escolha a modalidade.', participantes:'Acrescente ao menos um participante.', descricao:'A descrição passou de 2.000 caracteres.'
};
const EVX_PART = { nome:'falta o nome', email:'o e-mail não parece um e-mail', repetido:'aparece duas vezes', horas:'as horas não valem',
  membro:'não está no quadro', papel:'a função passou de 80 caracteres' };
async function evxSalvar(enviar){
  evxLerCampos();
  const f = docs.evForm, err = $('#ef-erro'); err.textContent = '';
  const p = { id:f.id || null, nome:f.nome, descricao:f.descricao, modalidade:f.modalidade, local:f.modalidade === 'online' ? '' : f.local,
    data_inicio:f.data_inicio, data_fim:f.data_fim, hora_inicio:f.hora_inicio, hora_fim:f.hora_fim, horas:f.horas,
    participantes: f.participantes.map(x => x.registro != null
      ? { registro:x.registro, papel:x.papel, horas:x.horas }
      : { nome:x.nome, email:x.email, papel:x.papel, horas:x.horas }) };
  if (enviar && f.data_inicio && (f.data_fim || f.data_inicio) > hojeISO()){
    err.textContent = MOTIVO_DOC.futuro; return;
  }
  ['#ef-salvar', '#ef-enviar'].forEach(s => { const b = $(s); if (b) b.disabled = true; });
  try{
    const { data, error } = await sb.rpc('evento_ext_salvar', { p });
    if (error) return err.textContent = docMotivo(null, error, 'Não foi possível salvar');
    if (data?.status === 'invalido'){
      err.textContent = data.campo === 'participantes' && data.linha
        ? `Participante ${data.linha}${f.participantes[data.linha - 1]?.nome ? ' (' + f.participantes[data.linha - 1].nome + ')' : ''}: ${EVX_PART[data.motivo] || 'confira'}.`
        : (EVX_CAMPO[data.campo] || 'Confira os campos.');
      return;
    }
    if (data?.status !== 'ok') return err.textContent = docMotivo(data, null, 'Não foi possível salvar');
    if (enviar){
      const r = await sb.rpc('evento_ext_enviar', { p_id: data.id });
      if (r.error || r.data?.status !== 'ok'){
        toast(`Salvo como ${data.codigo}, mas não foi para aprovação: ${docMotivo(r.data, r.error, 'erro')}`, true);
      } else toast(`${data.codigo} registrado e enviado para aprovação.`);
    } else toast(f.id ? 'Alterações salvas.' : `${data.codigo} registrado como rascunho.`);
    location.hash = '#/servicos/eventos/' + data.codigo;
  } finally { ['#ef-salvar', '#ef-enviar'].forEach(s => { const b = $(s); if (b) b.disabled = false; }); }
}

/* ---------------- configurações ---------------- */
async function evxCfgCarregar(){
  const [a, b] = await Promise.all([
    sb.from('eventos_ext_config').select('*').maybeSingle(),
    sb.from('doc_emissao_config').select('*').maybeSingle()
  ]);
  docs.cfg = { ...(a.data || {}), doc: b.data || null };
  return docs.cfg;
}
async function evxConfig(){
  $('#main').innerHTML = docCarregando();
  await evxCarregar();
  const c = await evxCfgCarregar();
  const gs = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const sel = new Set(c.grupos_aprovadores || []);
  const d = c.doc || {};
  $('#main').innerHTML = `${docTopo('Configurações dos eventos e das declarações', 'Quem aprova os registros de evento e o que toda declaração emitida pelo SOMA repete.')}
    ${evxNav('config')}
    <div class="evx-cfg">
      <div class="card"><h3>Quem aprova os eventos</h3>
        <p class="small muted" style="margin:4px 0 12px">Quem está num destes grupos (contando os subgrupos) aprova — nunca quem mandou para
          aprovação. Sem grupo nenhum, aprova quem é admin.</p>
        <div class="multi" style="max-height:260px">${gs.map(g => `<label class="check"><input type="checkbox" class="evc-g" value="${g.id}"
          ${sel.has(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}</div>
        <div class="fld" style="margin-top:14px"><label for="evc-min">Aprovações necessárias</label>
          <select id="evc-min">${[1, 2, 3].map(n => `<option ${Number(c.aprovacoes_minimas || 2) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <button class="btn solid" onclick="evxCfgSalvar()">Salvar</button></div>
      <div class="card"><h3>O que as declarações repetem</h3>
        ${d.id ? `<div class="fld"><label for="dcc-cidade">Cidade da data</label><input id="dcc-cidade" value="${esc(d.cidade || '')}"></div>
        <div class="fld"><label for="dcc-inst">O parágrafo que apresenta a NeuroDynamics</label>
          <textarea id="dcc-inst" rows="5">${esc(d.texto_instituicao || '')}</textarea>
          <p class="mini">Vale para as próximas emissões. As que já saíram guardam o texto da época.</p></div>
        <div class="fld"><label for="dcc-url">Onde se confere a autenticidade</label><input id="dcc-url" value="${esc(d.url_validacao || '')}"></div>
        <button class="btn ghost" onclick="dccSalvar()">Salvar</button>`
        : '<p class="small muted">Falta aplicar a migração v25.</p>'}</div>
    </div>`;
}
async function evxCfgSalvar(){
  const grupos = [...document.querySelectorAll('input.evc-g:checked')].map(x => Number(x.value));
  const { error } = await sb.from('eventos_ext_config').update({ grupos_aprovadores: grupos, aprovacoes_minimas: Number($('#evc-min').value) }).eq('id', true);
  if (error) return falha(error, 'Não foi possível salvar');
  toast('Quem aprova os eventos foi atualizado.');
}
async function dccSalvar(){
  const url = $('#dcc-url').value.trim();
  if (!/^https:\/\/[^\s/]+/.test(url)) return toast('O endereço de validação precisa começar com https://', true);
  const { error } = await sb.from('doc_emissao_config').update({ cidade: $('#dcc-cidade').value.trim() || 'Belo Horizonte',
    texto_instituicao: $('#dcc-inst').value.trim(), url_validacao: url }).eq('id', true);
  if (error) return falha(error, 'Não foi possível salvar');
  toast('Salvo. As próximas declarações saem assim.');
}

/* ---------------- a busca ---------------- */
registrarBusca({
  fonte: 'eventos_ext',
  rotulo: 'Eventos registrados',
  buscar: termo => {
    const t = norm(termo);
    return (docs.ev.lista || []).filter(e => norm(e.codigo).includes(t) || norm(e.nome).includes(t)).slice(0, 8)
      .map(e => ({ titulo: `${e.codigo} · ${e.nome}`, sub: `${(EVX_STATUS[e.status] || {}).l || e.status} · ${evxPeriodo(e)}`,
                   href: '#/servicos/eventos/' + e.codigo, peso: norm(e.codigo) === t ? 10 : 4 }));
  }
});
