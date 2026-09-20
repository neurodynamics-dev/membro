/* ============================================================
   MÓDULO · ADMINISTRAÇÃO
   Os painéis que antes eram páginas soltas, agora dentro do mesmo
   site, em abas: quadro de avisos, biblioteca de documentos,
   triagem de solicitações, ouvidoria, estado das agendas, o site
   institucional e a trilha de auditoria.

   Rotas: #/admin[/<aba>]. Só para admin e pessoal — a barreira é a
   RLS do banco; a rota apenas não oferece porta fechada.

   O conteúdo das cinco primeiras abas veio do admin.html deste
   repositório e o da aba Site veio do admin.html do repositório
   website. Os dois arquivos deixam de existir: eram duas telas de
   login a mais para a mesma conta.

   Depende da casca para: sb, $, esc, state, toast, fmtD, abreModal,
   fechaModal, can, registrarBusca, filtrarSimples, quemSouEu.
   ============================================================ */

const adminP = {
  pronto:false, aba:'avisos',
  avisos:[], sel:null,
  docs:[], docSel:null,
  sols:[], filtro:'pendentes', solAbertas:new Set(),
  ouvidoria:[], agendas:[],
  projetos:[], projSel:null, projIdioma:'en'
};

const LAYOUTS = {padrao:'Padrão', destaque:'Destaque (banda verde)', urgente:'Urgente',
                 evento:'Evento (bloco de data)', conquista:'Conquista'};
const CAT_DOC_ADM = {institucional:'Institucional', politica:'Política', guia:'Guia',
                     formulario:'Formulário', outro:'Outro'};

const ABAS_ADMIN = [
  ['avisos',       'Quadro de avisos'],
  ['documentos',   'Documentos'],
  ['solicitacoes', 'Solicitações'],
  ['ouvidoria',    'Ouvidoria'],
  ['agendas',      'Agendas'],
  ['site',         'Site institucional'],
  ['auditoria',    'Auditoria']
];

/* ============================================================
   ROTA
   ============================================================ */
async function pageAdmin(sub){
  const aba = ABAS_ADMIN.some(([k]) => k === sub) ? sub : 'avisos';
  adminP.aba = aba;

  $('#main').innerHTML = `
    <div class="topo-gestao"><div class="tx">
      <span class="eyebrow">Administração</span>
      <h1>Painéis</h1>
      <p class="lead">O que a gestão mantém: avisos, documentos, solicitações, ouvidoria,
        agendas, o site institucional e a trilha de auditoria.</p></div></div>
    <nav class="abas">${ABAS_ADMIN.map(([k,l]) =>
      `<a href="#/admin/${k}" class="${k===aba?'on':''}">${l}<span class="n" id="n-${k}"></span></a>`).join('')}</nav>
    <section id="sec-avisos"       ${aba!=='avisos'?'hidden':''}></section>
    <section id="sec-documentos"   ${aba!=='documentos'?'hidden':''}></section>
    <section id="sec-solicitacoes" ${aba!=='solicitacoes'?'hidden':''}></section>
    <section id="sec-ouvidoria"    ${aba!=='ouvidoria'?'hidden':''}></section>
    <section id="sec-agendas"      ${aba!=='agendas'?'hidden':''}></section>
    <section id="sec-site"         ${aba!=='site'?'hidden':''}></section>
    <section id="sec-auditoria"    ${aba!=='auditoria'?'hidden':''}></section>`;

  if (aba === 'auditoria'){
    $('#sec-auditoria').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando…</div>`;
    try {
      await carregarModulo('gestao');
      /* a auditoria desenha em #main; aqui ela fica dentro da aba */
      const alvo = $('#sec-auditoria');
      const guarda = $('#main').innerHTML;
      await pageAuditoria();
      alvo.innerHTML = $('#main').innerHTML;
      $('#main').innerHTML = guarda;
      $('#sec-auditoria').innerHTML = alvo.innerHTML;
      $('#sec-auditoria').hidden = false;
      renderTabelaAud();
    } catch(e){
      $('#sec-auditoria').innerHTML = `<div class="aviso-box err">Não foi possível carregar a auditoria: ${esc(e.message)}</div>`;
    }
    return;
  }

  if (aba === 'site') return admCarregarProjetos();

  if (!adminP.pronto){
    $('#sec-'+aba).innerHTML = `<div class="carregando"><span class="spin"></span> Carregando…</div>`;
    await Promise.all([admCarregarAvisos(), admCarregarDocs(), admCarregarSols(),
                       admCarregarOuvidoria(), admCarregarAgendas()]);
    adminP.pronto = true;
  }
  admContagens();
}

function admContagens(){
  const p = adminP.sols.filter(s => ['aberta','em_analise'].includes(s.status)).length;
  const o = adminP.ouvidoria.filter(m => !m.tratada).length;
  const a = adminP.agendas.filter(x => x.erro).length;
  const põe = (id, n) => { const el = $('#n-'+id); if (el) el.textContent = n ? ' ' + n : ''; };
  põe('solicitacoes', p); põe('ouvidoria', o); põe('agendas', a);
}
/* ============================================================
   ABA 1 — QUADRO DE AVISOS
   ============================================================ */
async function admCarregarAvisos(){
  const { data, error } = await sb.from('portal_avisos').select('*')
    .order('ordem').order('criado_em', {ascending:false});
  if (error){
    $('#sec-avisos').innerHTML = `<div class="aviso-box err">Erro ao carregar os avisos: ${esc(error.message)}.
      A migração <b>soma_v10_portal.sql</b> foi aplicada?</div>`;
    return;
  }
  adminP.avisos = data || [];
  if (!adminP.sel || !adminP.avisos.find(a=>a.id===adminP.sel))
    adminP.sel = adminP.avisos[0]?.id || null;
  desenhaAvisos();
}
function desenhaAvisos(){
  $('#sec-avisos').innerHTML = `
    <div class="aviso-box info">O quadro rotaciona os avisos <b>publicados</b> na home do portal,
      na ordem definida. Layouts: banda verde para destaques, coral para urgências, bloco de data
      para eventos e acento lima para conquistas.</div>
    <div class="editor">
      <div>
        <div class="lista" id="av-lista">${adminP.avisos.length ? adminP.avisos.map(a=>`
          <button class="item ${a.id===adminP.sel?'on':''}" onclick="selAviso('${a.id}')">
            <span><span class="nm">${esc(a.titulo)}</span>
            <span class="sl">${esc(LAYOUTS[a.layout]||a.layout)} · ordem ${esc(a.ordem)}</span></span>
            ${a.publicado ? '' : '<span class="off">oculto</span>'}
          </button>`).join('')
          : '<div class="vazio">Nenhum aviso ainda.</div>'}</div>
        <button class="btn ghost" style="width:100%;justify-content:center;margin-top:12px" onclick="novoAviso()">+ Novo aviso</button>
      </div>
      <div class="form" id="av-form"></div>
    </div>`;
  desenhaFormAviso();
}
function selAviso(id){ adminP.sel = id; desenhaAvisos(); }
function previewAviso(a){
  const TAGS = {padrao:'Aviso', destaque:'Quadro de avisos', urgente:'Urgente',
                conquista:'Conquista', evento:'Evento'};
  if (a.layout==='evento'){
    const d = a.data_evento || a.data_inicio;
    const dt = d ? new Date(d+'T12:00') : null;
    return `<div class="preview pv-evento">
      ${dt?`<div class="quando"><div class="d">${dt.getDate()}</div><div class="m">${MES_CURTO[dt.getMonth()]}</div></div>`:''}
      <div><span class="sl-tag">${TAGS.evento}</span>
      <h3>${esc(a.titulo||'Título do aviso')}</h3>
      ${a.corpo?`<p>${esc(a.corpo)}</p>`:''}</div></div>`;
  }
  return `<div class="preview pv-${esc(a.layout||'padrao')}">
    <span class="sl-tag">${TAGS[a.layout]||'Aviso'}</span>
    <h3>${esc(a.titulo||'Título do aviso')}</h3>
    ${a.corpo?`<p>${esc(a.corpo)}</p>`:''}</div>`;
}
function lerFormAviso(){
  return {
    titulo: $('#a-titulo').value.trim(),
    corpo: $('#a-corpo').value.trim() || null,
    layout: $('#a-layout').value,
    link_url: $('#a-url').value.trim() || null,
    link_rotulo: $('#a-rotulo').value.trim() || null,
    data_evento: $('#a-devento').value || null,
    data_inicio: $('#a-dini').value || null,
    data_fim: $('#a-dfim').value || null,
    ordem: parseInt($('#a-ordem').value, 10) || 100,
    publicado: $('#a-pub').checked
  };
}
function desenhaFormAviso(){
  const a = adminP.avisos.find(x=>x.id===adminP.sel);
  const el = $('#av-form'); if(!el) return;
  if (!a){ el.innerHTML = '<div class="vazio">Selecione ou crie um aviso.</div>'; return; }
  el.innerHTML = `
    <h2>${esc(a.titulo)}</h2>
    <p class="sub">id ${esc(a.id).slice(0,8)} · atualizado ${a.atualizado_em?new Date(a.atualizado_em).toLocaleString('pt-BR'):'—'}</p>
    <div id="a-preview">${previewAviso(a)}</div>
    <div class="fgrid">
      <div class="fld full"><label>Título</label><input id="a-titulo" value="${esc(a.titulo)}" oninput="atualizaPreview()"></div>
      <div class="fld full"><label>Corpo (1–2 frases)</label>
        <textarea id="a-corpo" rows="2" oninput="atualizaPreview()">${esc(a.corpo||'')}</textarea></div>
      <div class="fld"><label>Layout</label>
        <select id="a-layout" onchange="atualizaPreview();$('#a-devento-wrap').style.display=this.value==='evento'?'':'none'">
          ${Object.entries(LAYOUTS).map(([k,l])=>`<option value="${k}" ${a.layout===k?'selected':''}>${l}</option>`).join('')}
        </select></div>
      <div class="fld" id="a-devento-wrap" style="${a.layout==='evento'?'':'display:none'}">
        <label>Data do evento (bloco de data)</label>
        <input id="a-devento" type="date" value="${esc(a.data_evento||'')}" onchange="atualizaPreview()"></div>
      <div class="fld"><label>Link (opcional)</label><input id="a-url" value="${esc(a.link_url||'')}" placeholder="https://…"></div>
      <div class="fld"><label>Rótulo do link</label><input id="a-rotulo" value="${esc(a.link_rotulo||'')}" placeholder="Saiba mais"></div>
      <div class="fld"><label>Exibir a partir de (vazio = já)</label><input id="a-dini" type="date" value="${esc(a.data_inicio||'')}"></div>
      <div class="fld"><label>Exibir até (vazio = sem prazo)</label><input id="a-dfim" type="date" value="${esc(a.data_fim||'')}"></div>
      <div class="fld"><label>Ordem no rodízio</label><input id="a-ordem" type="number" value="${esc(a.ordem)}"></div>
      <label class="check" style="align-self:end"><input id="a-pub" type="checkbox" ${a.publicado?'checked':''}>
        Publicado no portal</label>
    </div>
    <div class="acts">
      <button class="btn solid" id="a-salvar" onclick="salvarAviso('${a.id}')">Salvar alterações</button>
      <button class="btn perigo" onclick="excluirAviso('${a.id}')">Excluir</button>
    </div>`;
}
function atualizaPreview(){
  const el = $('#a-preview'); if(!el) return;
  el.innerHTML = previewAviso(lerFormAviso());
}
async function salvarAviso(id){
  const v = lerFormAviso();
  if (!v.titulo){ toast('O título é obrigatório.', true); return; }
  if (v.data_inicio && v.data_fim && v.data_fim < v.data_inicio){ toast('O fim da exibição vem antes do início.', true); return; }
  $('#a-salvar').disabled = true;
  const { error } = await sb.from('portal_avisos').update(v).eq('id', id);
  $('#a-salvar').disabled = false;
  if (error){ toast('Erro ao salvar: ' + error.message, true); return; }
  toast('Aviso salvo' + (v.publicado ? ', já está girando no portal.' : ' (oculto).'));
  await admCarregarAvisos();
}
async function novoAviso(){
  const titulo = prompt('Título do novo aviso:');
  if (!titulo) return;
  const { data, error } = await sb.from('portal_avisos')
    .insert({ titulo, layout:'padrao', publicado:false,
      ordem: 100 + adminP.avisos.length * 10, criado_por: quemSouEu() })
    .select().single();
  if (error){ toast('Erro ao criar: ' + error.message, true); return; }
  toast('Aviso criado. Começa oculto: publique quando estiver pronto.');
  adminP.sel = data.id;
  await admCarregarAvisos();
}
async function excluirAviso(id){
  const a = adminP.avisos.find(x=>x.id===id);
  if (!confirm(`Excluir "${a?.titulo}"? Se for temporário, prefira desmarcar "Publicado".`)) return;
  const { error } = await sb.from('portal_avisos').delete().eq('id', id);
  if (error){ toast('Erro ao excluir: ' + error.message, true); return; }
  toast('Aviso excluído.');
  adminP.sel = null;
  await admCarregarAvisos();
}

/* ============================================================
   ABA 2 — DOCUMENTOS (aba "Informações" do portal)
   ============================================================ */
async function admCarregarDocs(){
  const { data, error } = await sb.from('portal_documentos').select('*')
    .order('categoria').order('ordem').order('titulo');
  if (error){
    $('#sec-documentos').innerHTML = `<div class="aviso-box err">Erro ao carregar os documentos:
      ${esc(error.message)}. A migração <b>soma_v11_portal_documentos.sql</b> foi aplicada?</div>`;
    return;
  }
  adminP.docs = data || [];
  if (!adminP.docSel || !adminP.docs.find(d=>d.id===adminP.docSel))
    adminP.docSel = adminP.docs[0]?.id || null;
  desenhaDocs();
}
function desenhaDocs(){
  $('#sec-documentos').innerHTML = `
    <div class="aviso-box info">Os documentos aparecem na aba <b>Informações</b> do portal,
      agrupados por categoria. Cole o link de compartilhamento do Drive. O controle fino de
      acesso continua lá; aqui é a vitrine.</div>
    <div class="editor">
      <div>
        <div class="lista">${adminP.docs.length ? adminP.docs.map(d=>`
          <button class="item ${d.id===adminP.docSel?'on':''}" onclick="selDoc('${d.id}')">
            <span><span class="nm">${esc(d.titulo)}</span>
            <span class="sl">${esc(CAT_DOC_ADM[d.categoria]||d.categoria)} · ordem ${esc(d.ordem)}</span></span>
            ${d.publicado ? '' : '<span class="off">oculto</span>'}
          </button>`).join('')
          : '<div class="vazio">Nenhum documento ainda.</div>'}</div>
        <button class="btn ghost" style="width:100%;justify-content:center;margin-top:12px" onclick="novoDoc()">+ Novo documento</button>
      </div>
      <div class="form" id="doc-form"></div>
    </div>`;
  desenhaFormDoc();
}
function selDoc(id){ adminP.docSel = id; desenhaDocs(); }
function desenhaFormDoc(){
  const d = adminP.docs.find(x=>x.id===adminP.docSel);
  const el = $('#doc-form'); if(!el) return;
  if (!d){ el.innerHTML = '<div class="vazio">Selecione ou crie um documento.</div>'; return; }
  el.innerHTML = `
    <h2>${esc(d.titulo)}</h2>
    <p class="sub">id ${esc(d.id).slice(0,8)} · atualizado ${d.atualizado_em?new Date(d.atualizado_em).toLocaleString('pt-BR'):'—'}</p>
    <div class="fgrid">
      <div class="fld full"><label>Título</label><input id="d-titulo" value="${esc(d.titulo)}"></div>
      <div class="fld full"><label>Descrição (1 frase, opcional)</label>
        <input id="d-desc" value="${esc(d.descricao||'')}" placeholder="ex.: Regras de uso dos espaços do LABBIO"></div>
      <div class="fld full"><label>Link do Drive</label>
        <input id="d-url" value="${esc(d.url||'')}" placeholder="https://drive.google.com/…">
        <p class="mini">Use o link de compartilhamento ("qualquer pessoa na organização com o link", de preferência).</p></div>
      <div class="fld"><label>Categoria</label>
        <select id="d-cat">${Object.entries(CAT_DOC_ADM).map(([k,l])=>
          `<option value="${k}" ${d.categoria===k?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Ordem na lista</label><input id="d-ordem" type="number" value="${esc(d.ordem)}"></div>
      <label class="check full"><input id="d-pub" type="checkbox" ${d.publicado?'checked':''}>
        Publicado na aba Informações</label>
    </div>
    <div class="acts">
      <button class="btn solid" id="d-salvar" onclick="salvarDoc('${d.id}')">Salvar alterações</button>
      <button class="btn perigo" onclick="excluirDoc('${d.id}')">Excluir</button>
      ${d.url?`<a class="btn ghost" href="${esc(d.url)}" target="_blank" rel="noopener">Testar link ↗</a>`:''}
    </div>`;
}
async function salvarDoc(id){
  const v = {
    titulo: $('#d-titulo').value.trim(),
    descricao: $('#d-desc').value.trim() || null,
    url: $('#d-url').value.trim(),
    categoria: $('#d-cat').value,
    ordem: parseInt($('#d-ordem').value, 10) || 100,
    publicado: $('#d-pub').checked
  };
  if (!v.titulo){ toast('O título é obrigatório.', true); return; }
  if (!/^https?:\/\//i.test(v.url)){ toast('O link precisa começar com http(s)://', true); return; }
  $('#d-salvar').disabled = true;
  const { error } = await sb.from('portal_documentos').update(v).eq('id', id);
  $('#d-salvar').disabled = false;
  if (error){ toast('Erro ao salvar: ' + error.message, true); return; }
  toast('Documento salvo.');
  await admCarregarDocs();
}
async function novoDoc(){
  const titulo = prompt('Título do novo documento:');
  if (!titulo) return;
  const url = prompt('Link do Drive (pode ajustar depois):') || 'https://';
  const { data, error } = await sb.from('portal_documentos')
    .insert({ titulo, url, categoria:'outro', publicado:false,
      ordem: 100 + adminP.docs.length * 10, criado_por: quemSouEu() })
    .select().single();
  if (error){ toast('Erro ao criar: ' + error.message, true); return; }
  toast('Documento criado. Começa oculto: publique quando o link estiver certo.');
  adminP.docSel = data.id;
  await admCarregarDocs();
}
async function excluirDoc(id){
  const d = adminP.docs.find(x=>x.id===id);
  if (!confirm(`Excluir "${d?.titulo}" da biblioteca? O arquivo no Drive não é afetado.`)) return;
  const { error } = await sb.from('portal_documentos').delete().eq('id', id);
  if (error){ toast('Erro ao excluir: ' + error.message, true); return; }
  toast('Documento excluído.');
  adminP.docSel = null;
  await admCarregarDocs();
}

/* ============================================================
   ABA 3 — SOLICITAÇÕES
   ============================================================ */
async function admCarregarSols(){
  const { data, error } = await sb.from('portal_solicitacoes').select('*')
    .order('criado_em', {ascending:false});
  if (error){
    $('#sec-solicitacoes').innerHTML = `<div class="aviso-box err">Erro ao carregar: ${esc(error.message)}</div>`;
    return;
  }
  adminP.sols = data || [];
  const pend = adminP.sols.filter(s=>['aberta','em_analise'].includes(s.status)).length;
  $('#n-solicitacoes').textContent = pend ? pend : '';
  desenhaSols();
}
function desenhaSols(){
  const f = adminP.filtro;
  const lista = adminP.sols.filter(s =>
    f==='todas' ? true :
    f==='pendentes' ? ['aberta','em_analise'].includes(s.status) :
    s.status===f);
  const conta = k => k==='todas' ? adminP.sols.length
    : k==='pendentes' ? adminP.sols.filter(s=>['aberta','em_analise'].includes(s.status)).length
    : adminP.sols.filter(s=>s.status===k).length;
  const chips = [['pendentes','Pendentes'],['todas','Todas'],['aprovada','Aprovadas'],
                 ['recusada','Recusadas'],['concluida','Concluídas'],['cancelada','Canceladas']];
  $('#sec-solicitacoes').innerHTML = `
    <div class="filtros">${chips.map(([k,l])=>
      `<button class="chip ${f===k?'on':''}" onclick="adminP.filtro='${k}';desenhaSols()">${l}<span class="n">${conta(k)}</span></button>`).join('')}</div>
    ${lista.length ? lista.map(cartaoSol).join('')
      : '<div class="vazio">Nada por aqui com esse filtro.</div>'}`;
}
function cartaoSol(s){
  const st = STATUS_SOL[s.status] || {l:s.status, c:'#8E8E93'};
  const aberto = adminP.solAbertas.has(s.id);
  const d = s.dados || {};
  const it = (dt, dd, full) => dd ? `<div class="it ${full?'full':''}"><dt>${dt}</dt><dd>${esc(dd)}</dd></div>` : '';
  let campos = '';
  if (s.tipo==='acesso') campos = [
    it('Acesso', d.item), it('Categoria', CAT_ACESSO[d.categoria]||d.categoria),
    it('Tempo necessário', d.tempo_necessario),
    it('Justificativa', d.justificativa, true), it('Observações', d.observacoes, true)].join('');
  else if (s.tipo==='afastamento') campos = [
    it('Período', `${fmtD(d.data_inicio)} a ${fmtD(d.data_fim)}`),
    it('Motivo', d.motivo, true), it('Observações', d.observacoes, true)].join('');
  else if (s.tipo==='desligamento') campos = [
    it('Data pretendida', fmtD(d.data_prevista)),
    it('Motivo', d.motivo, true), it('Observações', d.observacoes, true)].join('');
  else if (s.tipo==='reuniao_1_1') campos = [
    it('Gestor', d.gestor_registro ? nomeDe(d.gestor_registro) : null),
    it('Urgência', d.urgencia), it('Preferência', d.preferencia), it('Tema', d.tema, true)].join('');
  else campos = it('Descrição', d.descricao, true);
  const stBtn = (novo, label, cls) =>
    `<button class="btn mini ${cls||'ghost'}" onclick="mudarStatus('${s.id}','${novo}')">${label}</button>`;
  return `<div class="sol" onclick="toggleSol('${s.id}')">
    <div class="top-row">
      <span class="prot">${esc(s.protocolo||'—')}</span>
      <span class="pill">${esc(TIPOS_SOL[s.tipo]||s.tipo)}</span>
      <span class="t">${esc(s.titulo)}</span>
      <span class="quem">${esc(nomeDe(s.registro))}</span>
      <span class="pill"><span class="dt" style="background:${st.c}"></span>${st.l}</span>
      <span class="quando">${new Date(s.criado_em).toLocaleDateString('pt-BR')}</span>
    </div>
    ${aberto ? `<div class="det" onclick="event.stopPropagation()">
      <div class="dl">${campos || '<div class="it full"><dd>Sem detalhes.</dd></div>'}</div>
      <div class="st-btns">
        ${s.status==='aberta' ? stBtn('em_analise','Marcar em análise') : ''}
        ${['aberta','em_analise'].includes(s.status) ? stBtn('aprovada','Aprovar','solid')+stBtn('recusada','Recusar','perigo') : ''}
        ${s.status==='aprovada' ? stBtn('concluida','Concluir','solid') : ''}
      </div>
      <div class="fld"><label>Resposta ao membro</label>
        <textarea id="resp-${s.id}" rows="2" placeholder="O que foi feito, próximos passos, o porquê da decisão…">${esc(s.resposta||'')}</textarea></div>
      <button class="btn ghost mini" onclick="salvarResposta('${s.id}')">Salvar resposta</button>
      ${s.tipo==='acesso' ? `<p style="font-size:11.5px;color:var(--dim);margin-top:10px">Ao aprovar,
        conceda o acesso na ficha do membro no SOMA (aba Acessos). Este painel só registra a decisão.</p>` : ''}
      ${s.respondido_por ? `<p style="font-size:11px;color:var(--dim);margin-top:8px">Última resposta:
        ${esc(s.respondido_por)}${s.respondido_em?' · '+new Date(s.respondido_em).toLocaleString('pt-BR'):''}</p>` : ''}
    </div>` : ''}
  </div>`;
}
function toggleSol(id){
  adminP.solAbertas.has(id) ? adminP.solAbertas.delete(id) : adminP.solAbertas.add(id);
  desenhaSols();
}
async function mudarStatus(id, novo){
  const resp = document.getElementById('resp-'+id)?.value.trim() || null;
  const { error } = await sb.from('portal_solicitacoes').update({
    status: novo, resposta: resp,
    respondido_por: quemSouEu(), respondido_em: new Date().toISOString()
  }).eq('id', id);
  if (error){ toast('Erro ao atualizar: '+error.message, true); return; }
  toast('Status atualizado para "' + (STATUS_SOL[novo]?.l||novo) + '".');
  await admCarregarSols();
}
async function salvarResposta(id){
  const resp = document.getElementById('resp-'+id)?.value.trim() || null;
  const { error } = await sb.from('portal_solicitacoes').update({
    resposta: resp, respondido_por: quemSouEu(), respondido_em: new Date().toISOString()
  }).eq('id', id);
  if (error){ toast('Erro ao salvar: '+error.message, true); return; }
  toast('Resposta salva.');
  await admCarregarSols();
}

/* ============================================================
   ABA 4 — OUVIDORIA
   ============================================================ */
const CAT_OUV = {gestao_pessoas:'Gestão de pessoas', conduta:'Conduta', sugestao:'Sugestão', outro:'Outro'};
async function admCarregarOuvidoria(){
  const { data, error } = await sb.from('portal_ouvidoria').select('*')
    .order('dia', {ascending:false});
  if (error){
    $('#sec-ouvidoria').innerHTML = `<div class="aviso-box err">Erro ao carregar: ${esc(error.message)}</div>`;
    return;
  }
  adminP.ouvidoria = data || [];
  const pend = adminP.ouvidoria.filter(o=>!o.tratado).length;
  $('#n-ouvidoria').textContent = pend ? pend : '';
  desenhaOuvidoria();
}
function desenhaOuvidoria(){
  $('#sec-ouvidoria').innerHTML = `
    <div class="aviso-box info">As mensagens chegam <b>sem nenhuma identificação</b>: sem conta,
      sem registro e com a data truncada para o dia. Trate cada uma com o cuidado de quem confiou
      no canal.</div>
    ${adminP.ouvidoria.length ? adminP.ouvidoria.map(o=>`
      <div class="ouv ${o.tratado?'tratado':''}">
        <div class="meta">
          <span class="pill">${esc(CAT_OUV[o.categoria]||o.categoria)}</span>
          <span class="mono" style="font-size:11px;color:var(--dim)">${fmtD(o.dia)}</span>
          ${o.tratado ? `<span class="pill"><span class="dt" style="background:var(--ok)"></span>Tratada${o.tratado_por?' · '+esc(o.tratado_por):''}</span>` : ''}
          <span style="flex:1"></span>
          <button class="btn mini ${o.tratado?'ghost':'solid'}" onclick="marcarOuv('${o.id}', ${!o.tratado})">
            ${o.tratado?'Reabrir':'Marcar como tratada'}</button>
        </div>
        <div class="msg">${esc(o.mensagem)}</div>
      </div>`).join('')
    : '<div class="vazio">Nenhuma mensagem na ouvidoria.</div>'}`;
}
async function marcarOuv(id, tratado){
  const { error } = await sb.from('portal_ouvidoria').update({
    tratado, tratado_por: tratado ? quemSouEu() : null
  }).eq('id', id);
  if (error){ toast('Erro: '+error.message, true); return; }
  await admCarregarOuvidoria();
}

boot();
/* ============================================================
   AGENDAS — quem conectou o Google Agenda e como está a
   sincronização. O painel NÃO lê o link .ics de ninguém: a RLS
   do banco só devolve o link para o próprio dono. Aqui só
   aparecem o estado e o erro da última tentativa.
   ============================================================ */
async function admCarregarAgendas(){
  const { data, error } = await sb.from('portal_agendas')
    .select('registro,conectado,ativo,fuso,expediente_inicio,expediente_fim,dias_uteis,ultima_sync,ultimo_erro,blocos_sync');
  if (error){
    $('#sec-agendas').innerHTML = `<div class="aviso-box err">Erro ao carregar as agendas:
      ${esc(error.message)}. A migração <b>soma_v12_portal_agenda.sql</b> foi aplicada?</div>`;
    return;
  }
  adminP.agendas = data || [];
  const comErro = adminP.agendas.filter(a => a.conectado && a.ultimo_erro).length;
  const n = $('#n-agendas');
  if (comErro){ n.textContent = comErro; n.style.display = ''; } else { n.style.display = 'none'; }
  desenhaAgendas();
}
function desenhaAgendas(){
  const porReg = {};
  adminP.agendas.forEach(a => { porReg[a.registro] = a; });
  const conectadas = adminP.agendas.filter(a => a.conectado);
  const semAgenda = state.membros.filter(m => !porReg[m.registro]?.conectado);
  const linha = a => {
    const m = state.membros.find(x => x.registro === a.registro);
    let dot = 'espera', txt = 'Esperando a primeira sincronização';
    if (a.ultimo_erro){ dot = 'erro'; txt = 'Falhou na última tentativa'; }
    else if (a.ultima_sync){ dot = 'ok'; txt = `${a.blocos_sync ?? 0} compromisso${a.blocos_sync === 1 ? '' : 's'}`; }
    if (!a.ativo){ dot = 'espera'; txt = 'Sincronização pausada pelo membro'; }
    return `<div class="ag-linha">
      <span class="dot ${dot}"></span>
      <div><span class="nm">${esc(m?.nome || 'Registro ' + a.registro)}</span>
        <span class="sl">${esc(m?.departamento || '')}${m?.departamento ? ' · ' : ''}${
          esc(String(a.expediente_inicio || '').slice(0,5))}–${esc(String(a.expediente_fim || '').slice(0,5))} · ${esc(a.fuso)}</span>
        ${a.ultimo_erro ? `<div class="ag-erro">${esc(a.ultimo_erro)}</div>` : ''}</div>
      <div class="quando"><b>${esc(txt)}</b>${a.ultima_sync ? fmtD(a.ultima_sync) : '—'}</div>
    </div>`;
  };
  $('#sec-agendas').innerHTML = `
    <div class="aviso-box info">Cada membro conecta a própria agenda em
      <b>membro.neurodynamics.dev/#/calendario/minha</b>, colando o endereço secreto em formato
      iCal do Google Agenda. O link fica visível só para o dono — nem por aqui dá para lê-lo.
      Daqui você acompanha o estado e força uma sincronização geral.</div>
    <div class="acts" style="margin:0 0 16px">
      <button class="btn solid" id="ag-btn" onclick="sincronizarTodas()">Sincronizar todas agora</button>
      <button class="btn ghost" onclick="admCarregarAgendas()">Atualizar a lista</button>
      <span class="mono" style="font-size:11.5px;color:var(--dim)">${conectadas.length} de
        ${state.membros.length} ${state.membros.length === 1 ? 'membro conectou' : 'membros conectaram'}</span>
    </div>
    ${conectadas.length
      ? `<div class="lista">${conectadas
          .sort((a,b) => (b.ultimo_erro ? 1 : 0) - (a.ultimo_erro ? 1 : 0))
          .map(linha).join('')}</div>`
      : `<div class="vazio">Ninguém conectou o Google Agenda ainda. Sem isso, o assistente de
          agendamento mostra apenas os eventos do SOMA.</div>`}
    ${semAgenda.length ? `<h2 style="font-size:14px;margin:26px 0 10px">Ainda sem agenda conectada</h2>
      <p class="mono" style="font-size:11.5px;color:var(--dim);line-height:1.9">${
        semAgenda.map(m => esc(m.nome)).join(' · ')}</p>` : ''}`;
}
async function sincronizarTodas(){
  const b = $('#ag-btn'); b.disabled = true; b.textContent = 'Sincronizando…';
  try{
    const { data, error } = await sb.functions.invoke('agenda-sync', { body:{ todos:true } });
    if (error) throw error;
    const falhas = data?.falhas || 0;
    toast(`${data?.sincronizadas || 0} agenda(s) atualizada(s)` + (falhas ? `, ${falhas} com erro.` : '.'), !!falhas);
  }catch(e){
    const msg = String(e?.message || e);
    toast(/Function not found|404|Failed to send/i.test(msg)
      ? 'A Edge Function "agenda-sync" ainda não foi publicada no Supabase.'
      : 'Erro ao sincronizar: ' + msg, true);
  }
  b.disabled = false; b.textContent = 'Sincronizar todas agora';
  await admCarregarAgendas();
}
/* ============================================================
   ABA · SITE INSTITUCIONAL
   Veio do admin.html do repositório website. Os projetos que
   aparecem em neurodynamics.dev, em três idiomas.
   ============================================================ */
const IDIOMAS = [ { k:'en', lb:'EN', sf:'' }, { k:'pt', lb:'PT', sf:'_pt' }, { k:'fr', lb:'FR', sf:'_fr' } ];

async function admCarregarProjetos(){
  $('#sec-site').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando os projetos…</div>`;
  const { data, error } = await sb.from('site_projetos').select('*')
    .order('ordem', { ascending:true }).order('nome', { ascending:true });
  if (error){
    $('#sec-site').innerHTML = `<div class="aviso-box err">Erro ao carregar os projetos: ${esc(error.message)}.
      As migrações <b>soma_v09_site.sql</b> e <b>soma_v13_site_idiomas.sql</b> foram aplicadas?</div>`;
    return;
  }
  adminP.projetos = data || [];
  if (!adminP.projSel || !adminP.projetos.find(p => p.id === adminP.projSel))
    adminP.projSel = adminP.projetos[0]?.id || null;
  admDesenhaSite();
}

function admDesenhaSite(){
  $('#sec-site').innerHTML = `
    <div class="adm-grade">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
          <div><h3>Projetos</h3><p class="sub">no ar em neurodynamics.dev</p></div>
          <button class="btn ghost" style="height:34px;padding:0 13px;font-size:12.5px"
            onclick="admNovoProjeto()">Novo</button>
        </div>
        <div id="site-lista"></div>
      </div>
      <div class="card"><div id="site-form"></div></div>
    </div>`;
  $('#site-lista').innerHTML = adminP.projetos.length ? adminP.projetos.map(p => `
    <button class="adm-item ${p.id===adminP.projSel?'on':''}" onclick="admSelProjeto('${p.id}')">
      <span class="ordem">${esc(p.ordem)}</span>
      <span class="tx"><span class="nm">${esc(p.nome)}</span>
      <span class="sl">/${esc(p.slug)}</span></span>
      ${p.publicado ? '' : '<span class="off">oculto</span>'}</button>`).join('')
    : '<div class="kb-vazio" style="text-align:left">Nenhum projeto ainda.</div>';
  admDesenhaFormProjeto();
}
function admSelProjeto(id){ adminP.projSel = id; admDesenhaSite(); }

function admDesenhaFormProjeto(){
  const p = adminP.projetos.find(x => x.id === adminP.projSel);
  const el = $('#site-form');
  if (!p){ el.innerHTML = '<div class="kb-vazio" style="text-align:left">Selecione ou crie um projeto.</div>'; return; }
  el.innerHTML = `
    <h3>${esc(p.nome)}</h3>
    <p class="sub" style="margin-bottom:16px">id ${esc(String(p.id).slice(0,8))} ·
      atualizado ${p.atualizado_em ? fmtD(p.atualizado_em) : '—'}</p>
    <div class="form-grid">
      <div class="fld"><label>Nome</label><input id="sp-nome" value="${esc(p.nome)}"></div>
      <div class="fld"><label>Slug (url)</label><input id="sp-slug" value="${esc(p.slug)}">
        <p class="mini">minúsculas, sem espaço ou acento</p></div>
      <div class="fld full">
        <nav class="abas" style="margin-bottom:14px">${IDIOMAS.map(l =>
          `<button class="aba ${l.k===adminP.projIdioma?'on':''}"
            onclick="admTrocaIdioma('${l.k}')">${l.lb}</button>`).join('')}</nav>
        <p class="mini" style="margin:-8px 0 12px">O que ficar vazio em PT ou FR cai no texto em inglês.</p>
        ${IDIOMAS.map(l => `<div data-idioma="${l.k}" ${l.k===adminP.projIdioma?'':'hidden'}>
          <div class="fld"><label>Tagline · ${l.lb}</label>
            <input id="sp-tagline${l.sf}" value="${esc(p['tagline'+l.sf]||'')}"></div>
          <div class="fld"><label>Resumo · ${l.lb} (cartão da home)</label>
            <textarea id="sp-resumo${l.sf}" rows="2">${esc(p['resumo'+l.sf]||'')}</textarea></div>
          <div class="fld"><label>Descrição · ${l.lb}</label>
            <textarea id="sp-descricao${l.sf}" rows="5">${esc(p['descricao'+l.sf]||'')}</textarea></div>
        </div>`).join('')}
      </div>
      <div class="fld"><label>Status</label><input id="sp-status" list="sp-status-sug" value="${esc(p.status||'')}">
        <datalist id="sp-status-sug"><option value="Applied research"><option value="Prototype">
        <option value="In development"><option value="Field pilot"></datalist></div>
      <div class="fld"><label>Ordem de exibição</label>
        <input id="sp-ordem" type="number" value="${esc(p.ordem)}"></div>
      <div class="fld full"><label>Tags (separadas por vírgula)</label>
        <input id="sp-tags" value="${esc((p.tags||[]).join(', '))}"></div>
      <div class="fld full"><label>URL da imagem (em branco = placeholder)</label>
        <input id="sp-imagem" value="${esc(p.imagem_url||'')}" placeholder="https://…"></div>
      <div class="fld full"><label class="check"><input id="sp-pub" type="checkbox" ${p.publicado?'checked':''}>
        Publicado no site</label></div>
    </div>
    <div class="acts">
      <button class="btn solid" id="sp-salvar" onclick="admSalvarProjeto('${p.id}')">Salvar alterações</button>
      <button class="btn perigo" onclick="admExcluirProjeto('${p.id}')">Excluir</button>
      <a class="btn ghost" href="https://neurodynamics.dev/#/projects" target="_blank" rel="noopener">ver o site ↗</a>
    </div>`;
}
function admTrocaIdioma(k){
  adminP.projIdioma = k;
  document.querySelectorAll('#site-form .abas .aba').forEach(b =>
    b.classList.toggle('on', b.textContent.trim() === IDIOMAS.find(l=>l.k===k).lb));
  document.querySelectorAll('[data-idioma]').forEach(d => d.hidden = (d.dataset.idioma !== k));
}
function admLerProjeto(){
  const v = {
    nome: $('#sp-nome').value.trim(),
    slug: $('#sp-slug').value.trim().toLowerCase(),
    status: $('#sp-status').value.trim() || 'In development',
    ordem: parseInt($('#sp-ordem').value, 10) || 100,
    tags: $('#sp-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    imagem_url: $('#sp-imagem').value.trim() || null,
    publicado: $('#sp-pub').checked
  };
  IDIOMAS.forEach(l => ['tagline','resumo','descricao'].forEach(c => {
    v[c + l.sf] = $('#sp-' + c + l.sf).value.trim() || null;
  }));
  return v;
}
async function admSalvarProjeto(id){
  const v = admLerProjeto();
  if (!v.nome || !v.slug){ toast('Nome e slug são obrigatórios.', true); return; }
  $('#sp-salvar').disabled = true;
  const { error } = await sb.from('site_projetos').update(v).eq('id', id);
  $('#sp-salvar').disabled = false;
  if (error){ toast('Erro ao salvar: ' + error.message, true); return; }
  toast('Projeto salvo — já está no ar.');
  await admCarregarProjetos();
}
async function admNovoProjeto(){
  const nome = prompt('Nome do novo projeto:');
  if (!nome) return;
  const slug = nome.normalize('NFD').replace(/[̀-ͯ]/g,'')
    .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  const { data, error } = await sb.from('site_projetos')
    .insert({ nome, slug, publicado:false, ordem: 100 + adminP.projetos.length * 10 })
    .select().single();
  if (error){ toast('Erro ao criar: ' + error.message, true); return; }
  toast('Projeto criado — começa oculto; publique quando estiver pronto.');
  adminP.projSel = data.id;
  await admCarregarProjetos();
}
async function admExcluirProjeto(id){
  const p = adminP.projetos.find(x => x.id === id);
  abreModal(`<h3>Excluir projeto</h3>
    <p style="color:var(--muted);font-size:13.5px">Excluir <b>${esc(p?.nome||'')}</b> não tem volta.
      Se for temporário, prefira desmarcar "Publicado".</p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn perigo" onclick="admConfirmaExcluirProjeto('${id}')">Excluir</button></div>`);
}
async function admConfirmaExcluirProjeto(id){
  fechaModal();
  const { error } = await sb.from('site_projetos').delete().eq('id', id);
  if (error){ toast('Erro ao excluir: ' + error.message, true); return; }
  toast('Projeto excluído.');
  adminP.projSel = null;
  await admCarregarProjetos();
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'admin', rotulo:'Administração',
  buscar: (t) => {
    if (!can()) return [];
    const itens = [
      ...adminP.docs.map(d => ({ titulo:d.titulo, sub:'Documento · ' + (CAT_DOC_ADM[d.categoria]||''), href:'#/admin/documentos' })),
      ...adminP.avisos.map(a => ({ titulo:a.titulo, sub:'Aviso', href:'#/admin/avisos' })),
      ...adminP.projetos.map(p => ({ titulo:p.nome, sub:'Projeto do site', href:'#/admin/site' }))
    ];
    return filtrarSimples(itens, t, 6);
  }
});
