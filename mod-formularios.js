/* ============================================================
   MÓDULO · FORMULÁRIOS — escrever o registro no próprio portal
   A ata de reunião, o relatório de execução de teste: em vez de baixar
   o template, preencher no Word e subir de volta, a pessoa escreve
   aqui. O rascunho grava sozinho — e quem mais mexe no arquivo
   continua de onde ele parou. Ao mandar, o portal desenha o documento
   no modelo da NRO (doc-nro.js) com a revisão EM VIGOR do template e a
   versão vai para revisão como qualquer outra: pendente até o grupo
   revisor aprovar; registro aprovado não muda mais.

   Não tem rota própria: é um pedaço de Arquivos. mod-arquivos desce
   este módulo na primeira vez e chama
     frmEscrever(tela, { depois })       #/arquivos/<PN>/escrever
     frmConfig(series, rol, { emissores, depois })
                                         Arquivos › Configurações › Formulários
   `depois` é o que Arquivos faz quando algo muda (recarregar o rol):
   daqui não se mexe no estado dele.

   A definição de cada formulário mora em doc_series.formulario; a
   gramática está em db/v26_formularios.sql e no README (Arquivos).

   Precisa da migração db/v26_formularios.sql.

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, confirma, falha, motivoRPC,
   precisaDocNRO, hojeISO, grupoPorId, nomeDe, docGestor.
   ============================================================ */

const frm = { t:null, meta:null, def:null, dados:{}, origem:'novo', sujo:false, timer:null, salvando:null,
              salvoEm:null, erro:null, tocado:false, depois:null, decisoes:{}, faltou:false, faltouRel:false, cfg:null };

const FRM_TIPOS = {
  texto:'Texto curto', paragrafo:'Texto longo (parágrafos)', data:'Data', hora:'Hora', numero:'Número', escolha:'Escolha',
  membro:'Uma pessoa da equipe', projeto:'Um projeto', pessoas:'Lista de pessoas (nome e observação)', lista:'Lista de itens',
  tabela:'Tabela (colunas definidas)', redacao:'Quem redigiu (e com apoio de IA)'
};
const FRM_MOTIVO = {
  sem_formulario: 'Esta série não tem formulário: o PN se faz baixando o template e subindo o arquivo.',
  sem_pn: 'Só um PN se escreve no portal — o template, não.',
  sem_permissao: 'Quem escreve os PNs desta série é o grupo do emissor, a equipe do projeto e quem criou o PN.',
  registro_fechado: 'Este registro já foi aprovado: registro não se altera.',
  obsoleto: 'O arquivo está obsoleto.',
  ja_pendente: 'Já há uma versão aguardando revisão. Espere a decisão (ou retire o envio) antes de mandar outra.',
  arquivo_nao_enviado: 'O PDF não chegou ao Storage. Tente de novo.',
  pn_fora_do_rol: 'Os PNs desta série não moram no rol: ela não ganha formulário.'
};
const frmMotivo = (data, error, padrao) => error ? motivoRPC(null, error, padrao)
  : FRM_MOTIVO[data?.status] || motivoRPC(data, null, padrao);
const frmCampos = () => frm.def?.campos || [];
const frmCampo = id => frmCampos().find(c => c.id === id);
const frmAgora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const frmEu = () => { const r = state.perfil?.registro; return { registro: r ?? null, nome: r ? nomeDe(r) : (state.perfil?.nome || '') }; };
const frmRevisores = r => grupoPorId(r.grupo_revisor)?.nome || 'PMO';
const frmOps = c => (c.opcoes || []).map(o => typeof o === 'object' ? o : { valor:o, rotulo:o });
/* "Z" → "AA", como a letra da revisão anda */
const frmProxRev = r => { const v = String(r || '').toUpperCase(); if (!v) return 'A';
  for (let i = v.length - 1; i >= 0; i--) if (v[i] !== 'Z')
    return v.slice(0, i) + String.fromCharCode(v.charCodeAt(i) + 1) + 'A'.repeat(v.length - 1 - i);
  return 'A'.repeat(v.length + 1); };

/* ============================================================
   ESCREVER UM PN
   ============================================================ */
async function frmEscrever(t, op = {}){
  frm.t = t; frm.depois = op.depois || null; frm.erro = null; frm.sujo = false; frm.tocado = false; frm.faltou = false;
  clearTimeout(frm.timer);
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Abrindo o formulário…</div>';
  const { data, error } = await sb.rpc('doc_formulario_abrir', { p_arquivo: t.r.id });
  if (error || data?.status !== 'ok'){
    $('#main').innerHTML = `<a class="tre-voltar" href="#/arquivos/${esc(t.r.codigo)}" style="margin-top:22px">${ic('back')} ${esc(t.r.codigo)}</a>
      <div class="aviso-box ${error ? 'err' : 'warn'}" style="margin-top:18px">${error
        ? `<b>O formulário ainda não está no banco.</b> ${esc(error.message || '')}<br><span class="small">Falta aplicar a migração <code>db/v26_formularios.sql</code>.</span>`
        : esc(frmMotivo(data, null, 'Não foi possível abrir o formulário'))}</div>`;
    return;
  }
  if (data.fechado && !data.dados && !data.ultima){
    /* aprovado, e não foi escrito aqui: foi o arquivo que subiu */
    $('#main').innerHTML = `<a class="tre-voltar" href="#/arquivos/${esc(t.r.codigo)}" style="margin-top:22px">${ic('back')} ${esc(t.r.codigo)}</a>
      <div class="aviso-box info" style="margin-top:18px">Este registro já foi aprovado — e foi enviado como arquivo, não escrito no
        portal. Registro aprovado não se altera: o que ele diz está no arquivo, na tela de ${esc(t.r.codigo)}.</div>`;
    return;
  }
  frm.meta = data; frm.def = data.def || { campos:[] };
  if (data.dados){ frm.dados = frmCopia(data.dados); frm.origem = 'rascunho'; frm.salvoEm = data.atualizado_em; }
  else if (data.ultima?.dados){ frm.dados = frmCopia(data.ultima.dados); frm.origem = 'ultima'; frm.salvoEm = null; }
  else { frm.dados = frmPadroes(frm.def, t.r); frm.origem = 'novo'; frm.salvoEm = null; }
  frmDesenhar();
}
const frmCopia = o => JSON.parse(JSON.stringify(o || {}));

/* O que já vem preenchido num PN novo: eu, hoje, agora e o projeto do PN. */
function frmPadroes(def, r){
  const d = {};
  (def.campos || []).forEach(c => {
    if (c.padrao === 'hoje') d[c.id] = hojeISO();
    else if (c.padrao === 'agora') d[c.id] = frmAgora();
    else if (c.padrao === 'eu' && c.tipo === 'membro') d[c.id] = frmEu();
    else if (c.tipo === 'redacao') d[c.id] = { ...frmEu(), ia:'' };
    else if (c.tipo === 'projeto' && r.projeto_id){
      const p = (state.projetos || []).find(x => x.id === r.projeto_id);
      if (p) d[c.id] = { id:p.id, codigo:p.codigo, nome:p.nome };
    }
    else if (typeof c.padrao === 'string' && !['hoje','agora','eu'].includes(c.padrao)) d[c.id] = c.padrao;
  });
  return d;
}

function frmDesenhar(){
  const t = frm.t, r = t.r, m = frm.meta, def = frm.def;
  const reg = m.tipo === 'registro';
  const u = m.ultima;
  const secoes = [];
  frmCampos().forEach(c => { const s = c.secao || ''; let x = secoes.find(y => y.nome === s);
    if (!x){ x = { nome:s, campos:[] }; secoes.push(x); } x.campos.push(c); });
  const revDoc = reg ? m.template_rev : frmProxRev(m.rev_vigente);
  const defVelha = def.rev && m.template_rev && def.rev !== m.template_rev;
  $('#main').innerHTML = `
    <a class="tre-voltar" href="#/arquivos/${esc(r.codigo)}" style="margin-top:22px">${ic('back')} ${esc(r.codigo)}</a>
    <div class="topo-gestao"><div class="tx"><span class="eyebrow">Arquivos · escrever no portal</span>
      <h1>${esc(r.codigo)} <span class="frm-h1-t">${esc(def.titulo || r.serie_titulo || '')}</span></h1>
      <p class="lead">O que iria no template ${esc(m.template_codigo || '')}${m.template_rev ? ' Rev. ' + esc(m.template_rev) : ''}, escrito aqui mesmo.
        O rascunho grava sozinho; ao mandar, o portal gera o PDF no modelo da NRO e ${reg ? 'o registro' : `a Rev. ${esc(revDoc)}`} vai
        para a revisão de ${esc(frmRevisores(r))}.</p></div></div>
    ${m.fechado ? `<div class="aviso-box info">Este registro já foi aprovado e não se altera mais — ele diz o que aconteceu. O que está abaixo é o que foi escrito.</div>` : ''}
    ${!m.fechado && m.pendente ? `<div class="aviso-box warn">Há uma versão aguardando revisão. Enquanto a decisão não sai, não dá para mandar outra —
      mas o rascunho continua gravando.</div>` : ''}
    ${!m.fechado && frm.origem === 'ultima' && u?.estado === 'devolvida' ? `<div class="aviso-box warn"><b>A versão de ${fmtD(u.enviado_em)} voltou para ajuste</b>${
      u.revisor_nome ? ` — ${esc(u.revisor_nome)}` : ''}: ${esc(u.parecer || 'sem parecer')}.<br><span class="small">O formulário começa do que foi mandado: corrija e mande de novo.</span></div>` : ''}
    ${!m.fechado && frm.origem === 'ultima' && u?.estado !== 'devolvida' ? `<div class="aviso-box info">O formulário começa da última versão escrita no portal${
      u?.rev ? ' (Rev. ' + esc(u.rev) + ')' : ''}: mude o que for preciso para a próxima.</div>` : ''}
    ${defVelha ? `<div class="aviso-box warn">O formulário foi feito para a Rev. ${esc(def.rev)} do template, e o template está na Rev. ${esc(m.template_rev)}.
      O documento sai com a Rev. ${esc(m.template_rev)}: se faltar algum campo da revisão nova, avise o PMO.</div>` : ''}
    <div class="frm-cols">
      <div class="frm-corpo">
        <datalist id="frm-membros">${(state.membros || []).filter(x => !['Desligado','Egresso'].includes(x.status))
          .map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
        ${secoes.map(s => `<section class="card frm-sec">${s.nome ? `<h2>${esc(s.nome)}</h2>` : ''}
          ${s.campos.map(frmCampoHTML).join('')}</section>`).join('')}
      </div>
      <aside class="frm-lado">
        <div class="card">
          <h3>${ic('escrever')} O documento</h3>
          <dl class="dcl-dados frm-ficha">
            <div class="full"><dt>Código</dt><dd class="mono">${esc(r.codigo)}${revDoc ? ' Rev. ' + esc(revDoc) : ''}</dd></div>
            <div class="full"><dt>Template</dt><dd>${esc(m.template_codigo || '—')}${m.template_rev ? ' · Rev. ' + esc(m.template_rev) + ' em vigor' : ''}</dd></div>
            <div class="full"><dt>Revisa</dt><dd>${esc(frmRevisores(r))}</dd></div>
          </dl>
          <p class="frm-status" id="frm-status"></p>
          <div id="frm-faltam"></div>
          <div class="frm-acs">
            <button class="btn ghost" onclick="frmPrevia()">${ic('eye')} Ver o PDF</button>
            ${m.fechado ? '' : `<button class="btn solid" id="frm-enviar" onclick="frmEnviarModal()" ${m.pendente ? 'disabled' : ''}>${ic('enviar')} Mandar para revisão</button>`}
          </div>
          <p class="small dim" style="margin-top:10px;line-height:1.5">Prefere o Word? Ele continua valendo: na tela do arquivo,
            ${reg ? '"Enviar o registro"' : '"Submeter nova revisão"'} sobe o arquivo pronto.</p>
        </div>
      </aside>
    </div>`;
  if (m.fechado) document.querySelectorAll('.frm-corpo input, .frm-corpo textarea, .frm-corpo select, .frm-corpo button').forEach(x => { x.disabled = true; });
  frmStatus(); frmFaltasAtualizar();
  document.querySelectorAll('.frm-corpo textarea').forEach(frmCrescer);
}

/* ---------------- os campos ---------------- */
function frmCampoHTML(c){
  const v = frm.dados[c.id], id = `frm-f-${c.id}`;
  const lab = `<label for="${id}">${esc(c.rotulo)}${c.obrigatorio ? ' <span class="frm-obr" title="obrigatório">*</span>' : ''}</label>`;
  const ajuda = c.ajuda ? `<p class="mini">${esc(c.ajuda)}</p>` : '';
  const ph = c.exemplo ? ` placeholder="${esc(c.exemplo)}"` : '';
  const on = `oninput="frmSet('${c.id}', this.value)"`;
  const caixa = corpo => `<div class="fld frm-fld" data-campo="${c.id}">${lab}${corpo}${ajuda}</div>`;
  switch (c.tipo){
    case 'texto':  return caixa(`<input id="${id}" maxlength="500" value="${esc(v || '')}"${ph} ${on}>`);
    case 'numero': return caixa(`<input id="${id}" type="number" step="any" value="${esc(v ?? '')}"${ph} ${on}>`);
    case 'data':   return caixa(`<input id="${id}" type="date" value="${esc(v || '')}" ${on}>`);
    case 'hora':   return caixa(`<input id="${id}" type="time" value="${esc(v || '')}" ${on}>`);
    case 'paragrafo': return caixa(`<textarea id="${id}" rows="${Math.min(Number(c.linhas) || 5, 16)}"${ph}
      oninput="frmSet('${c.id}', this.value); frmCrescer(this)">${esc(v || '')}</textarea>`);
    case 'escolha': {
      const ops = frmOps(c);
      if (c.livre) return caixa(`<input id="${id}" list="${id}-l" value="${esc(v || '')}"${ph} ${on}>
        <datalist id="${id}-l">${ops.map(o => `<option value="${esc(o.valor)}">`).join('')}</datalist>`);
      return caixa(`<select id="${id}" onchange="frmSet('${c.id}', this.value)"><option value="">Escolha…</option>${ops.map(o =>
        `<option value="${esc(o.valor)}" ${o.valor === v ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`);
    }
    case 'membro': return caixa(`<input id="${id}" list="frm-membros" value="${esc(v?.nome || '')}" placeholder="Nome"
      oninput="frmSetPessoa('${c.id}', this.value)">`);
    case 'projeto': return caixa(`<select id="${id}" onchange="frmSetProjeto('${c.id}', this.value)"><option value="">— nenhum —</option>${
      (state.projetos || []).filter(p => p.status !== 'encerrado' || p.id === v?.id).map(p =>
        `<option value="${esc(p.id)}" ${p.id === v?.id ? 'selected' : ''}>${esc(p.nome)} (${esc(p.codigo)})</option>`).join('')}</select>`);
    case 'redacao': return caixa(`<div class="frm-redacao">
        <input id="${id}" list="frm-membros" value="${esc(v?.nome || '')}" placeholder="Quem redigiu" aria-label="Quem redigiu"
          oninput="frmSetRedacao('${c.id}', 'nome', this.value)">
        <input value="${esc(v?.ia || '')}" placeholder="Com apoio de IA? Qual — LLM Gemini" aria-label="Com apoio de IA"
          oninput="frmSetRedacao('${c.id}', 'ia', this.value)"></div>
      <p class="mini frm-frase" id="${id}-frase">${esc(frmFraseRedacao(v))}</p>`);
    case 'pessoas': case 'lista': case 'tabela':
      return `<div class="fld frm-fld" data-campo="${c.id}"><label>${esc(c.rotulo)}${c.obrigatorio ? ' <span class="frm-obr" title="obrigatório">*</span>' : ''}</label>
        <div id="frm-c-${c.id}">${frmMultiHTML(c)}</div>${ajuda}</div>`;
    default: return caixa(`<input id="${id}" value="${esc(typeof v === 'string' ? v : '')}" ${on}>`);
  }
}
const frmFraseRedacao = v => v?.nome ? `Sai assim: “redigida ${v.ia ? `pelo ${v.ia}, aos cuidados de ${v.nome}` : `por ${v.nome}`}”.` : '';
function frmCrescer(el){ if (!el || el.tagName !== 'TEXTAREA') return; el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight + 2, 640) + 'px'; }

/* pessoas, listas e tabelas: redesenha só o campo quando muda a forma */
function frmMultiHTML(c){
  const l = Array.isArray(frm.dados[c.id]) ? frm.dados[c.id] : [];
  if (c.tipo === 'pessoas') return `<div class="frm-linhas">${l.map((p, i) => `<div class="frm-pessoa">
      <input list="frm-membros" value="${esc(p.nome || '')}" placeholder="Nome" aria-label="Nome ${i + 1}" oninput="frmMuda('${c.id}', ${i}, 'nome', this.value)">
      <input value="${esc(p.nota || '')}" placeholder="${esc(c.exemplo_nota || c.nota || 'observação')}" aria-label="${esc(c.nota || 'Observação')} ${i + 1}"
        oninput="frmMuda('${c.id}', ${i}, 'nota', this.value)">
      <button type="button" class="icon-btn sm" title="Tirar" aria-label="Tirar ${esc(p.nome || 'a linha ' + (i + 1))}" onclick="frmTira('${c.id}', ${i})">${ic('x')}</button></div>`).join('')}</div>
    <div class="frm-add"><button type="button" class="btn ghost mini" onclick="frmMais('${c.id}')">${ic('plus')} Pessoa</button>
      ${state.perfil?.registro && !l.some(p => p.registro === state.perfil.registro) ? `<button type="button" class="btn ghost mini" onclick="frmMais('${c.id}', frmEu())">Eu</button>` : ''}</div>`;
  if (c.tipo === 'lista') return `<div class="frm-linhas">${l.map((x, i) => `<div class="frm-item"><span class="n">${i + 1}</span>
      <input value="${esc(x || '')}" ${i === 0 && c.exemplo ? `placeholder="${esc(c.exemplo)}"` : ''} aria-label="${esc(c.rotulo)} ${i + 1}"
        oninput="frmMuda('${c.id}', ${i}, null, this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();frmMais('${c.id}', '', ${i + 1})}">
      <button type="button" class="icon-btn sm" title="Tirar" aria-label="Tirar o item ${i + 1}" onclick="frmTira('${c.id}', ${i})">${ic('x')}</button></div>`).join('')}</div>
    <div class="frm-add"><button type="button" class="btn ghost mini" onclick="frmMais('${c.id}', '')">${ic('plus')} Item</button></div>`;
  const cols = c.colunas || [];
  return `<div class="frm-tab-w"><table class="frm-tab"><thead><tr>${c.numerada ? '<th class="n">#</th>' : ''}${cols.map(k =>
      `<th style="width:${Math.round(100 * (k.largura || 1) / cols.reduce((s, x) => s + (x.largura || 1), 0))}%">${esc(k.rotulo)}</th>`).join('')}<th class="acs"></th></tr></thead>
    <tbody>${l.map((ln, i) => `<tr>${c.numerada ? `<td class="n">${i + 1}</td>` : ''}${cols.map(k => `<td>${frmCelula(c, k, ln, i)}</td>`).join('')}
      <td class="acs"><button type="button" class="icon-btn sm" title="Subir" aria-label="Subir a linha ${i + 1}" onclick="frmMove('${c.id}', ${i}, -1)" ${i ? '' : 'disabled'}>↑</button>
        <button type="button" class="icon-btn sm" title="Tirar" aria-label="Tirar a linha ${i + 1}" onclick="frmTira('${c.id}', ${i})">${ic('x')}</button></td></tr>`).join('')}</tbody></table></div>
    <div class="frm-add"><button type="button" class="btn ghost mini" onclick="frmMais('${c.id}', {})">${ic('plus')} Linha</button></div>`;
}
function frmCelula(c, k, ln, i){
  const v = ln?.[k.id] ?? '', lab = `aria-label="${esc(k.rotulo)}, linha ${i + 1}"`;
  const on = `oninput="frmMuda('${c.id}', ${i}, '${k.id}', this.value)"`;
  if (k.tipo === 'escolha') return `<select ${lab} onchange="frmMuda('${c.id}', ${i}, '${k.id}', this.value)"><option value=""></option>${frmOps(k).map(o =>
    `<option value="${esc(o.valor)}" ${o.valor === v ? 'selected' : ''}>${esc(o.rotulo)}</option>`).join('')}</select>`;
  if (k.tipo === 'data') return `<input type="date" ${lab} value="${esc(v)}" ${on}>`;
  if (k.tipo === 'hora') return `<input type="time" ${lab} value="${esc(v)}" ${on}>`;
  if (k.tipo === 'numero') return `<input type="number" step="any" ${lab} value="${esc(v)}" ${on}>`;
  return `<textarea rows="2" ${lab} oninput="frmMuda('${c.id}', ${i}, '${k.id}', this.value); frmCrescer(this)">${esc(v)}</textarea>`;
}

/* ---------------- mudar o que está escrito ---------------- */
function frmSet(id, v){ frm.dados[id] = v; frmSujo(); }
function frmAchaMembro(nome){ const n = norm(String(nome || '').trim()); return n ? (state.membros || []).find(m => norm(m.nome) === n) : null; }
function frmSetPessoa(id, nome){ const m = frmAchaMembro(nome);
  frm.dados[id] = String(nome || '').trim() ? { registro: m?.registro ?? null, nome: m ? m.nome : String(nome).trim() } : null; frmSujo(); }
function frmSetProjeto(id, pid){ const p = (state.projetos || []).find(x => x.id === pid);
  frm.dados[id] = p ? { id:p.id, codigo:p.codigo, nome:p.nome } : null; frmSujo(); }
function frmSetRedacao(id, k, v){
  const r = { ...(frm.dados[id] || {}) };
  if (k === 'nome'){ const m = frmAchaMembro(v); r.nome = m ? m.nome : String(v || '').trim(); r.registro = m?.registro ?? null; }
  else r.ia = String(v || '').trim();
  frm.dados[id] = r;
  const f = document.getElementById(`frm-f-${id}-frase`); if (f) f.textContent = frmFraseRedacao(r);
  frmSujo();
}
function frmMuda(id, i, k, v){
  const c = frmCampo(id), l = Array.isArray(frm.dados[id]) ? frm.dados[id] : (frm.dados[id] = []);
  if (c.tipo === 'lista') l[i] = v;
  else if (c.tipo === 'pessoas'){ const p = l[i] || (l[i] = {});
    if (k === 'nome'){ const m = frmAchaMembro(v); p.nome = v; p.registro = m?.registro ?? null; } else p.nota = v; }
  else { (l[i] || (l[i] = {}))[k] = v; }
  frmSujo();
}
function frmMais(id, novo, pos){
  const c = frmCampo(id), l = Array.isArray(frm.dados[id]) ? frm.dados[id] : (frm.dados[id] = []);
  const item = novo !== undefined ? novo : c.tipo === 'pessoas' ? { nome:'', nota:'' } : c.tipo === 'tabela' ? {} : '';
  l.splice(pos ?? l.length, 0, typeof item === 'object' && item ? { ...item } : item);
  frmRedesenha(id, pos ?? l.length - 1); frmSujo();
}
function frmTira(id, i){ const l = frm.dados[id]; if (!Array.isArray(l)) return; l.splice(i, 1); frmRedesenha(id); frmSujo(); }
function frmMove(id, i, d){ const l = frm.dados[id], j = i + d; if (!Array.isArray(l) || j < 0 || j >= l.length) return;
  [l[i], l[j]] = [l[j], l[i]]; frmRedesenha(id); frmSujo(); }
function frmRedesenha(id, foco){
  const el = document.getElementById('frm-c-' + id); if (!el) return;
  el.innerHTML = frmMultiHTML(frmCampo(id));
  el.querySelectorAll('textarea').forEach(frmCrescer);
  if (foco != null){ const linhas = el.querySelectorAll('.frm-linhas > div, .frm-tab tbody tr');
    linhas[foco]?.querySelector('input, textarea, select')?.focus(); }
}

/* ---------------- o rascunho grava sozinho ---------------- */
function frmSujo(){
  if (frm.meta?.fechado) return;
  frm.sujo = true; frm.erro = null; frmStatus();
  clearTimeout(frm.timer); frm.timer = setTimeout(frmGravar, 1200);
  frmFaltasAtualizar();
}
async function frmGravar(){
  clearTimeout(frm.timer);
  if (frm.meta?.fechado || !frm.t) return true;
  if (frm.salvando) await frm.salvando;
  if (!frm.sujo) return !frm.erro;
  frm.sujo = false; frmStatus('gravando');
  frm.salvando = sb.rpc('doc_formulario_salvar', { p_arquivo: frm.t.r.id, p_dados: frmCopia(frm.dados) })
    .then(({ data, error }) => {
      if (error || data?.status !== 'ok'){ frm.sujo = true; frm.erro = frmMotivo(data, error, 'Não gravou'); frmStatus(); return false; }
      frm.salvoEm = data.atualizado_em || new Date().toISOString(); frm.erro = null; frmStatus(); return true;
    }, e => { frm.sujo = true; frm.erro = e?.message || 'sem conexão'; frmStatus(); return false; })
    .finally(() => { frm.salvando = null; });
  return frm.salvando;
}
function frmStatus(estado){
  const el = $('#frm-status'); if (!el) return;
  if (frm.meta?.fechado){ el.textContent = ''; return; }
  el.className = 'frm-status' + (frm.erro ? ' bad' : frm.sujo ? ' sujo' : '');
  el.textContent = frm.erro ? `Não gravou: ${frm.erro}` : estado === 'gravando' ? 'Gravando o rascunho…'
    : frm.sujo ? 'Alterações por gravar…'
    : frm.salvoEm ? `Rascunho gravado ${fmtDT(frm.salvoEm)}${frm.meta?.atualizado_nome && frm.origem === 'rascunho' && !frm.tocado ? ' por ' + frm.meta.atualizado_nome : ''}.`
    : frm.origem === 'novo' ? 'Nada escrito ainda.' : 'O rascunho grava sozinho enquanto você escreve.';
  if (estado === 'gravando') frm.tocado = true;
}

/* ---------------- o que falta ---------------- */
/* o que vai: sem linha em branco, sem pessoa sem nome */
function frmLimpo(d){
  const o = frmCopia(d);
  frmCampos().forEach(c => {
    const v = o[c.id];
    if (c.tipo === 'lista' && Array.isArray(v)) o[c.id] = v.map(x => String(x || '').trim()).filter(Boolean);
    if (c.tipo === 'pessoas' && Array.isArray(v)) o[c.id] = v.filter(p => String(p?.nome || '').trim())
      .map(p => ({ nome:String(p.nome).trim(), ...(p.registro != null ? { registro:p.registro } : {}), ...(String(p.nota || '').trim() ? { nota:String(p.nota).trim() } : {}) }));
    if (c.tipo === 'tabela' && Array.isArray(v)) o[c.id] = v.filter(ln => ln && Object.values(ln).some(x => String(x ?? '').trim()));
    if (typeof v === 'string') o[c.id] = c.tipo === 'paragrafo' ? v.replace(/\s+$/, '') : v.trim();
  });
  return o;
}
/* a mesma conta de doc_formulario_faltam() */
const frmVazio = v => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
  || (typeof v === 'object' && !Array.isArray(v) && !String(v.nome || '').trim());
const frmFaltam = d => frmCampos().filter(c => c.obrigatorio && frmVazio(d[c.id])).map(c => c.rotulo);
function frmFaltasAtualizar(){
  const el = $('#frm-faltam'); if (!el || frm.meta?.fechado) return;
  const f = frmFaltam(frmLimpo(frm.dados));
  el.innerHTML = f.length ? `<p class="frm-falta"><b>Falta${f.length > 1 ? 'm' : ''} ${f.length}:</b> ${f.map(esc).join(', ')}.</p>`
    : `<p class="frm-pronto">${ic('check')} Tudo o que é obrigatório está preenchido.</p>`;
  if (frm.faltou) document.querySelectorAll('.frm-fld').forEach(x => {
    const c = frmCampo(x.dataset.campo); x.classList.toggle('erro', !!c?.obrigatorio && frmVazio(frmLimpo(frm.dados)[c.id])); });
}

/* ---------------- o PDF ---------------- */
function frmTitulo(d){
  const comp = frm.def.complemento ? DocNRO.preencher(frm.def.complemento, frm.def, d).trim() : null;
  return { comp, titulo: (frm.t.r.serie_titulo || frm.t.r.titulo) + (comp ? ' — ' + comp : (frm.t.r.complemento ? ' — ' + frm.t.r.complemento : '')) };
}
function frmDocumento(d){
  const m = frm.meta, r = frm.t.r, reg = m.tipo === 'registro';
  return DocNRO.registro(frm.def, d, { codigo:r.codigo, rev: reg ? m.template_rev : frmProxRev(m.rev_vigente),
    emissor:m.emissor, titulo: frmTitulo(d).titulo, classe:m.classe, natureza:m.tipo,
    autor: state.perfil?.nome || nomeDe(state.perfil?.registro) || '', em: hojeISO() });
}
async function frmPrevia(){
  /* a janela abre no clique; o PDF chega depois */
  const janela = window.open('', '_blank');
  try{ janela?.document.write('<p style="font:14px system-ui;margin:24px">Gerando o PDF…</p>'); }catch(e){}
  try{
    await frmGravar();
    await precisaDocNRO();
    DocNRO.abrir(frmDocumento(frmLimpo(frm.dados)), janela);
  }catch(e){ try{ janela?.close(); }catch(_){} falha(e, 'Não foi possível gerar o PDF'); }
}

/* ---------------- mandar para revisão ---------------- */
function frmRelacionados(){ const t = frm.t;
  return [...(t.pais || []).map(x => ({ x, lado:'pai' })), ...(t.filhos || []).map(x => ({ x, lado:'filho' }))].filter(({ x }) => x.status !== 'obsoleto'); }
async function frmEnviarModal(){
  await frmGravar();
  const d = frmLimpo(frm.dados), f = frmFaltam(d);
  if (f.length){
    frm.faltou = true; frmFaltasAtualizar();
    document.querySelector('.frm-fld.erro')?.scrollIntoView({ block:'center', behavior:'smooth' });
    return toast(`Falta preencher: ${f.join(', ')}.`, true);
  }
  const r = frm.t.r, m = frm.meta, reg = m.tipo === 'registro', rev = reg ? null : frmProxRev(m.rev_vigente);
  const rels = frmRelacionados(); frm.decisoes = {};
  abreModal(`<h3>Mandar ${reg ? 'o registro' : 'a Rev. ' + esc(rev) + ' de'} ${esc(r.codigo)} para revisão</h3>
    <p class="sub" style="margin-bottom:14px">O portal gera o PDF no modelo da NRO, com o template ${esc(m.template_codigo || '')}${
      m.template_rev ? ' Rev. ' + esc(m.template_rev) : ''}, e ${reg ? 'o registro fica pendente' : 'a revisão fica pendente'} até alguém de
      <b>${esc(frmRevisores(r))}</b> — que não seja você — aprovar.${reg ? ' Aprovado, o registro não se altera mais.'
        : m.rev_vigente ? ` Até lá, a Rev. ${esc(m.rev_vigente)} continua valendo.` : ''}</p>
    ${!reg ? `<div class="fld"><label for="fe-mud">O que mudou${m.rev_vigente ? '' : ' (opcional na primeira versão)'}</label>
      <textarea id="fe-mud" rows="3" placeholder="${m.rev_vigente ? 'O resultado do passo 4 e a conclusão.' : 'Versão inicial.'}"></textarea></div>` : ''}
    ${rels.length ? `<div class="adm-grupo">Os relacionados</div>
      <p class="small muted" style="margin:-4px 0 10px;line-height:1.55">Mudar ${esc(r.codigo)} pode obrigar a mudar estes. Para cada um, diga o
        que você fez — é isto que fica no registro de alterações.</p><div class="arq-conf" id="fe-conf">${frmConfHTML()}</div>` : ''}
    <div class="acts" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="fe-btn" onclick="frmEnviar()">${ic('enviar')} Gerar o PDF e mandar</button></div>`, 'largo');
}
function frmConfHTML(){
  return frmRelacionados().map(({ x, lado }) => { const d = frm.decisoes[x.id];
    return `<div class="arq-conf-l${frm.faltouRel && !d ? ' falta' : ''}"><span class="tx"><span class="cd">${esc(x.codigo)}</span>
      <span class="small muted">· ${lado}</span><span class="tt">${esc(x.titulo)}</span></span>
      <div class="seg" role="group" aria-label="O que você fez com ${esc(x.codigo)}">
        <button type="button" class="${d === 'revisado' ? 'on' : ''}" aria-pressed="${d === 'revisado'}" onclick="frmDecide('${x.id}','revisado')">Revisei junto</button>
        <button type="button" class="${d === 'sem_mudanca' ? 'on' : ''}" aria-pressed="${d === 'sem_mudanca'}" onclick="frmDecide('${x.id}','sem_mudanca')">Não precisa mudar</button>
      </div></div>`; }).join('');
}
function frmDecide(id, d){ frm.decisoes[id] = d; const c = $('#fe-conf'); if (c) c.innerHTML = frmConfHTML(); }
const frmNomeSeguro = n => String(n || 'registro.pdf').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'registro.pdf';
async function frmEnviar(){
  const r = frm.t.r, m = frm.meta, reg = m.tipo === 'registro';
  const mud = $('#fe-mud')?.value.trim() || '';
  if (!reg && m.rev_vigente && !mud) return toast('Diga o que mudou nesta revisão.', true);
  const rels = frmRelacionados(), faltam = rels.filter(({ x }) => !frm.decisoes[x.id]);
  if (faltam.length){ frm.faltouRel = true; const c = $('#fe-conf'); if (c) c.innerHTML = frmConfHTML();
    return toast(`Falta dizer o que fez com ${faltam.map(({ x }) => x.codigo).join(', ')}.`, true); }
  const b = $('#fe-btn'); if (b){ b.disabled = true; b.textContent = 'Gerando o PDF…'; }
  let caminho = null;
  try{
    await frmGravar();
    await precisaDocNRO();
    const d = frmLimpo(frm.dados);
    const doc = frmDocumento(d), blob = DocNRO.blob(doc);
    caminho = `${r.id}/${crypto.randomUUID()}/${frmNomeSeguro(doc.__nome)}`;
    if (b) b.textContent = 'Enviando…';
    const up = await sb.storage.from('arquivos').upload(caminho, blob, { contentType:'application/pdf', upsert:false });
    if (up.error){ caminho = null; throw new Error(/row-level|policy|unauthorized|403/i.test(up.error.message || '')
      ? 'você não envia arquivos para este código' : up.error.message); }
    const { data, error } = await sb.rpc('doc_formulario_enviar', { p: {
      arquivo_id: r.id, caminho, nome_original: doc.__nome, tamanho: blob.size, mudancas: mud || null,
      relacionados: rels.map(({ x }) => ({ arquivo_id: x.id, decisao: frm.decisoes[x.id] })), dados: d } });
    if (error) throw error;
    if (data?.status !== 'ok'){
      await sb.storage.from('arquivos').remove([caminho]).catch(() => {}); caminho = null;
      if (data?.status === 'faltam') return toast(`Falta preencher: ${(data.faltam || []).join(', ')}.`, true);
      if (data?.status === 'conferir_relacionados') return toast('Confira também: ' + (data.faltam || []).join(', ') + '.', true);
      return toast(frmMotivo(data, null, 'Não foi possível mandar'), true);
    }
    caminho = null;
    /* o complemento do título acompanha o que foi escrito (a ata "de abril", o teste "da bancada 2") */
    const { comp } = frmTitulo(d);
    if (comp && comp !== (r.complemento || '')) await sb.rpc('doc_arquivo_editar', { p: { id: r.id, titulo: comp } }).catch(() => {});
    fechaModal();
    frm.sujo = false; clearTimeout(frm.timer);
    toast(`${data.rev ? 'Rev. ' + data.rev : 'Registro'} enviado. ${frmRevisores(r)} recebeu o aviso para revisar.`);
    if (frm.depois) await frm.depois();
    location.hash = '#/arquivos/' + r.codigo;
  }catch(e){
    if (caminho) sb.storage.from('arquivos').remove([caminho]).catch(() => {});
    falha(e, 'Não foi possível mandar');
  }finally{ const x = $('#fe-btn'); if (x){ x.disabled = false; x.innerHTML = `${ic('enviar')} Gerar o PDF e mandar`; } }
}

/* ============================================================
   CONFIGURAÇÕES › FORMULÁRIOS (o PMO)
   A definição é um JSON: os campos e, se a série quiser, como se
   imprimem. A tela confere o que dá para conferir aqui; o banco
   confere de novo (doc_formulario_problemas) antes de gravar.
   ============================================================ */
function frmConfig(series, rol, op = {}){
  frm.cfg = { series, rol, emissores: op.emissores || [], depois: op.depois || null };
  const el = $('#cfg-corpo'); if (!el) return;
  const cab = s => rol.find(r => r.serie_id === s.id && r.pn == null);
  const cod = s => `NRO-${s.prefixo}-${String(s.sn).padStart(3, '0')}`;
  const comPN = series.filter(s => s.multiplo);
  const com = comPN.filter(s => s.formulario && !s.pn_origem), sem = comPN.filter(s => !s.formulario && !s.pn_origem);
  const fora = comPN.filter(s => s.pn_origem);
  const linha = s => { const c = cab(s), f = s.formulario, velho = f?.rev && c?.rev_vigente && f.rev !== c.rev_vigente;
    return `<tr><td><a class="mono" href="#/arquivos/${esc(cod(s))}">${esc(cod(s))}</a><span class="small dim" style="display:block">${esc(s.titulo)}</span></td>
      <td>${f ? `${(f.campos || []).length} campos` : '<span class="dim">—</span>'}</td>
      <td>${f ? `Rev. ${esc(f.rev || '—')}${velho ? ` <span class="pill p-warn" title="O template está na Rev. ${esc(c.rev_vigente)}"><span class="dt dt-warn"></span>template na ${esc(c.rev_vigente)}</span>` : ''}`
        : `<span class="dim">template ${c?.rev_vigente ? 'Rev. ' + esc(c.rev_vigente) : 'sem revisão'}</span>`}</td>
      <td class="acoes-linha">${f ? `<button class="btn ghost mini" onclick="frmCfgPrevia('${s.id}')">${ic('eye')} Ver como fica</button>` : ''}
        <button class="btn ${f ? 'ghost' : 'solid'} mini" onclick="frmCfgEditar('${s.id}')">${ic(f ? 'pencil' : 'plus')} ${f ? 'Editar' : 'Criar o formulário'}</button></td></tr>`; };
  el.innerHTML = `<p class="small muted" style="max-width:760px;line-height:1.6;margin-bottom:14px">Uma série com PN pode ter um formulário:
      os campos que o template pede. Com ele, o PN se escreve na tela do arquivo — sem baixar o template — e o portal gera o
      documento no modelo da NRO com a revisão em vigor do template. Quando o template mudar de letra, confira se o formulário
      acompanha e mude a "rev" dele.</p>
    <div class="tabela-rolar"><table class="tabela trabalho frm-cfg-tab"><thead><tr><th>Série</th><th>Campos</th><th>Feito para</th><th></th></tr></thead>
      <tbody>${com.map(linha).join('')}${sem.length ? `<tr><td colspan="4" class="adm-grupo" style="padding:14px 12px 6px">Sem formulário</td></tr>${sem.map(linha).join('')}` : ''}</tbody></table></div>
    ${fora.length ? `<p class="small dim" style="margin-top:12px">Fora daqui, porque os PNs não moram no rol: ${fora.map(s => esc(cod(s))).join(', ')}.</p>` : ''}`;
}
/* dados de exemplo, para ver como a definição imprime */
function frmExemplo(def){
  const eu = frmEu(), d = {};
  (def.campos || []).forEach(c => {
    const ops = frmOps(c);
    d[c.id] = { texto: c.exemplo || c.rotulo, paragrafo: c.exemplo || `${c.rotulo}: o texto que a pessoa escreve aqui, em um ou mais parágrafos.`,
      data: hojeISO(), hora: '14:00', numero: '1', escolha: ops[0]?.valor || '', membro: eu,
      projeto: (state.projetos || [])[0] ? { id:state.projetos[0].id, codigo:state.projetos[0].codigo, nome:state.projetos[0].nome } : null,
      pessoas: [{ ...eu, nota: c.exemplo_nota || '' }, { nome:'Fulano de Tal', nota:'' }],
      lista: [c.exemplo || 'Primeiro item', 'Segundo item'],
      tabela: [0, 1].map(i => Object.fromEntries((c.colunas || []).map(k => [k.id, k.tipo === 'escolha' ? (frmOps(k)[i]?.valor || '') : `${k.rotulo} ${i + 1}`]))),
      redacao: { ...eu, ia:'' } }[c.tipo] ?? '';
  });
  return d;
}
async function frmCfgPrevia(id, defTexto){
  const s = frm.cfg.series.find(x => x.id === id); if (!s) return;
  let def = s.formulario;
  if (defTexto != null){ try { def = JSON.parse(defTexto); } catch(e){ return toast('O JSON não se lê: ' + e.message, true); } }
  const janela = window.open('', '_blank');
  try{
    await precisaDocNRO();
    const c = frm.cfg.rol.find(r => r.serie_id === s.id && r.pn == null);
    const cod = `NRO-${s.prefixo}-${String(s.sn).padStart(3, '0')}-·`;
    const em = frm.cfg.emissores.find(e => e.prefixo === s.prefixo);
    const dados = frmExemplo(def);
    const comp = def.complemento ? DocNRO.preencher(def.complemento, def, dados) : '';
    const doc = DocNRO.registro(def, dados, { codigo:cod, rev: s.tipo === 'registro' ? c?.rev_vigente : 'A', emissor: em?.nome || s.prefixo,
      titulo: s.titulo + (comp ? ' — ' + comp : ''), classe:s.classe, natureza:s.tipo, autor:'exemplo', em:hojeISO() });
    DocNRO.abrir(doc, janela);
  }catch(e){ try{ janela?.close(); }catch(_){} falha(e, 'Não foi possível desenhar'); }
}
function frmCfgEditar(id){
  const s = frm.cfg.series.find(x => x.id === id); if (!s) return;
  const c = frm.cfg.rol.find(r => r.serie_id === s.id && r.pn == null);
  const modelos = frm.cfg.series.filter(x => x.formulario && x.id !== id);
  const base = s.formulario || { versao:1, rev: c?.rev_vigente || 'A', titulo: frmTituloFrase(s.titulo), complemento:'{assunto}',
    campos:[{ id:'assunto', rotulo:'Assunto', tipo:'texto', obrigatorio:true }, { id:'data', rotulo:'Data', tipo:'data', obrigatorio:true, padrao:'hoje' },
      { id:'texto', rotulo:'Texto', tipo:'paragrafo', obrigatorio:true }] };
  abreModal(`<h3>Formulário de ${esc(`NRO-${s.prefixo}-${String(s.sn).padStart(3, '0')}`)}</h3>
    <p class="sub" style="margin-bottom:10px">${esc(s.titulo)} · template ${c?.rev_vigente ? 'Rev. ' + esc(c.rev_vigente) + ' em vigor' : 'sem revisão em vigor'}</p>
    ${modelos.length ? `<div class="frm-modelo"><span class="small muted">Começar de:</span>${modelos.map(x =>
      `<button type="button" class="chip mini" onclick="frmCfgCopiar('${x.id}', '${c?.rev_vigente || ''}')">${esc(`NRO-${x.prefixo}-${String(x.sn).padStart(3, '0')}`)}</button>`).join('')}</div>` : ''}
    <textarea id="fc-json" class="frm-json mono" rows="20" spellcheck="false" oninput="frmCfgConferir()">${esc(JSON.stringify(base, null, 2))}</textarea>
    <div id="fc-probs"></div>
    <details class="frm-ajuda"><summary>Como se escreve</summary>${frmAjudaHTML()}</details>
    <div class="acts" style="justify-content:flex-end;margin-top:14px">
      ${s.formulario ? `<button class="btn perigo" style="margin-right:auto" onclick="frmCfgSalvar('${id}', true)">Tirar o formulário</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn ghost" onclick="frmCfgPrevia('${id}', $('#fc-json').value)">${ic('eye')} Ver como fica</button>
      <button class="btn solid" id="fc-btn" onclick="frmCfgSalvar('${id}')">Salvar</button></div>`, 'largo', true);
  frmCfgConferir();
}
function frmCfgCopiar(de, rev){
  const s = frm.cfg.series.find(x => x.id === de); if (!s?.formulario) return;
  const f = frmCopia(s.formulario); if (rev) f.rev = rev;
  $('#fc-json').value = JSON.stringify(f, null, 2); frmCfgConferir();
}
const frmTituloFrase = t => { const s = String(t || '').toLowerCase(); return s.charAt(0).toUpperCase() + s.slice(1); };
/* o que dá para conferir aqui — o banco confere de novo */
function frmProblemas(f){
  const p = [];
  if (!f || typeof f !== 'object' || Array.isArray(f)) return ['A definição precisa ser um objeto.'];
  if (!Array.isArray(f.campos) || !f.campos.length) return ['O formulário não tem nenhum campo.'];
  if (!String(f.titulo || '').trim()) p.push('Falta o título do documento.');
  const ids = [];
  f.campos.forEach((c, i) => {
    const n = i + 1;
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(c?.id || '')) p.push(`Campo ${n}: identificador inválido (letras minúsculas, números e _).`);
    else if (ids.includes(c.id)) p.push(`Campo ${n}: identificador repetido (${c.id}).`); else ids.push(c.id);
    if (!FRM_TIPOS[c?.tipo]) p.push(`Campo ${n}: tipo desconhecido (${c?.tipo || 'vazio'}).`);
    if (!String(c?.rotulo || '').trim()) p.push(`Campo ${n}: falta o rótulo.`);
    if (c?.tipo === 'escolha' && !(Array.isArray(c.opcoes) && c.opcoes.length)) p.push(`Campo ${n}: escolha sem opções.`);
    if (c?.tipo === 'tabela'){
      if (!(Array.isArray(c.colunas) && c.colunas.length)) p.push(`Campo ${n}: tabela sem colunas.`);
      else if (c.colunas.some(k => !/^[a-z][a-z0-9_]{0,40}$/.test(k?.id || '') || !String(k?.rotulo || '').trim()))
        p.push(`Campo ${n}: coluna sem identificador ou sem rótulo.`);
    }
  });
  if ('impressao' in f){
    if (!Array.isArray(f.impressao)) p.push('A impressão precisa ser uma lista de blocos.');
    else f.impressao.forEach((b, i) => {
      if (!['ficha','secao','texto','campo'].includes(b?.tipo)) p.push(`Impressão, bloco ${i + 1}: tipo desconhecido (${b?.tipo || 'vazio'}).`);
      if (b?.tipo === 'campo' && !ids.includes(b.campo)) p.push(`Impressão, bloco ${i + 1}: o campo ${b.campo || 'vazio'} não existe.`);
      if (b?.tipo === 'secao' && (b.campos || []).some(x => !ids.includes(x))) p.push(`Impressão, bloco ${i + 1}: a seção cita um campo que não existe.`);
      const txt = b?.tipo === 'texto' ? b.texto : b?.tipo === 'ficha' ? JSON.stringify(b.linhas || []) : '';
      (String(txt || '').match(/\{([a-z][a-z0-9_]*)/g) || []).map(x => x.slice(1)).filter(x => !ids.includes(x))
        .forEach(x => p.push(`Impressão, bloco ${i + 1}: {${x}} não é um campo.`));
    });
  }
  ['cabecalho', 'complemento'].forEach(k => (String(f[k] || '').match(/\{([a-z][a-z0-9_]*)/g) || []).map(x => x.slice(1))
    .filter(x => !ids.includes(x)).forEach(x => p.push(`${k === 'cabecalho' ? 'O cabeçalho' : 'O complemento'}: {${x}} não é um campo.`)));
  return p;
}
function frmCfgConferir(){
  const el = $('#fc-probs'), txt = $('#fc-json')?.value; if (!el) return null;
  let f; try { f = JSON.parse(txt); } catch(e){ el.innerHTML = `<ul class="tre-probs"><li>O JSON não se lê: ${esc(e.message)}</li></ul>`; return null; }
  const p = frmProblemas(f);
  el.innerHTML = p.length ? `<ul class="tre-probs">${p.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
    : `<p class="tre-pronto">${ic('check')} ${f.campos.length} campos, sem problema — pronto para salvar.</p>`;
  return p.length ? null : f;
}
async function frmCfgSalvar(id, tirar){
  let f = null;
  if (tirar){
    if (!await confirma('Tirar o formulário desta série? Os PNs voltam a se fazer baixando o template. Os rascunhos em andamento ficam guardados, mas sem formulário ninguém os abre.', 'Tirar')) return;
  } else { f = frmCfgConferir(); if (!f) return toast('Corrija a definição antes de salvar.', true); }
  const b = $('#fc-btn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('doc_formulario_definir', { p: { serie_id: id, formulario: f } });
  if (b) b.disabled = false;
  if (error) return falha(error, 'Não foi possível salvar');
  if (data?.status === 'invalido'){ const el = $('#fc-probs');
    if (el) el.innerHTML = `<ul class="tre-probs">${(data.problemas || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    return toast('O banco achou problema na definição.', true); }
  if (data?.status !== 'ok') return toast(frmMotivo(data, null, 'Não foi possível salvar'), true);
  fechaModal(); toast(tirar ? 'Formulário tirado.' : 'Formulário salvo. Os PNs da série já se escrevem no portal.');
  if (frm.cfg.depois) await frm.cfg.depois();
}
function frmAjudaHTML(){
  return `<div class="frm-ajuda-c small">
    <p><b>O alto:</b> <code>titulo</code> (o nome do documento, no cabeçalho), <code>rev</code> (a revisão do template para a qual o
      formulário foi feito), <code>cabecalho</code> (o departamento no cabeçalho — sem ele, o emissor), <code>complemento</code> (o
      que vai no título do PN, depois do nome da série) e <code>numerar_linhas</code> (como a ata).</p>
    <p><b>Os campos</b> (<code>campos</code>): <code>id</code>, <code>rotulo</code>, <code>tipo</code> e, se quiser,
      <code>obrigatorio</code>, <code>secao</code> (agrupa na tela), <code>ajuda</code>, <code>exemplo</code> e <code>padrao</code>
      (<code>"hoje"</code>, <code>"agora"</code>, <code>"eu"</code>). Os tipos:</p>
    <ul>${Object.entries(FRM_TIPOS).map(([k, v]) => `<li><code>${k}</code> — ${esc(v)}</li>`).join('')}</ul>
    <p><code>escolha</code> leva <code>opcoes</code> (texto, ou <code>{"valor","rotulo","simbolo"}</code> — o símbolo é o glifo da
      tabela: ok, x, ~, -) e, com <code>"livre": true</code>, aceita o que se escrever. <code>tabela</code> leva <code>colunas</code>
      (<code>id</code>, <code>rotulo</code>, <code>tipo</code>, <code>largura</code>) e <code>numerada</code>.
      <code>pessoas</code> leva <code>nota</code> (o nome da segunda coluna).</p>
    <p><b>A impressão</b> (<code>impressao</code>, opcional — sem ela, os campos curtos vão para uma ficha e os longos viram seções):
      blocos <code>texto</code> (uma frase com os campos no meio: <code>{data}</code> escreve o valor, <code>{hora?, às }</code>
      escreve ", às " só se houver hora), <code>campo</code> (uma lista ou um texto longo, com <code>marcador</code>,
      <code>pontuacao</code> e <code>final</code>), <code>ficha</code> (as <code>linhas</code> de rótulo e valor) e
      <code>secao</code> (<code>titulo</code>, <code>instrucao</code>, <code>campos</code>, <code>moldura</code>,
      <code>layout: "chave-valor"</code>, <code>colunas</code>, <code>legenda</code>).</p></div>`;
}
