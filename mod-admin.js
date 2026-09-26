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

   Depende da casca para: sb, $, esc, norm, state, toast, fmtD, abreModal,
   fechaModal, can, registrarBusca, filtrarSimples, quemSouEu, ic, ibtn,
   avatarFoto, confirma, falha, motivoRPC, carregarGrupos, desenharMenu,
   PAINEIS, GRUPOS_PAINEL, painelPermitido.
   ============================================================ */

const adminP = {
  pronto:false, aba:'avisos',
  avisos:[], sel:null,
  sols:[], filtro:'pendentes', solAbertas:new Set(),
  ouvidoria:[], agendas:[],
  projetos:[], projSel:null, projIdioma:'en'
};

const LAYOUTS = {padrao:'Padrão', destaque:'Destaque (banda verde)', urgente:'Urgente',
                 evento:'Evento (bloco de data)', conquista:'Conquista'};

/* Com onze painéis, aba não cabe mais: a Administração vira galeria —
   o componente "galeria de tiles" do design system — e cada painel tem
   endereço próprio. A lista (PAINEIS, GRUPOS_PAINEL, painelPermitido)
   mora na casca: o menu lateral também a lê, antes deste módulo existir. */

const ICONES_ADM = {
  grupos:'<circle cx="8" cy="9" r="2.6"/><circle cx="16.5" cy="8" r="2.1"/><path d="M3.5 18.5c0-2.5 2-4.2 4.5-4.2s4.5 1.7 4.5 4.2"/><path d="M14.8 13.6c2.3.2 3.9 1.8 3.9 4"/>',
  avisos:'<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8A3 3 0 0 1 6 15.4"/>',
  documentos:'<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
  solicitacoes:'<path d="M4 5.5h16v11H10L5.5 20v-3.5H4z"/>',
  ouvidoria:'<path d="M12 3a4 4 0 0 1 4 4v4a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
  agendas:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17"/>',
  contas:'<path d="M12 3.5 5 6v6c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
  acessos:'<circle cx="8.5" cy="14.5" r="4.5"/><path d="M12 11.5 20 4M17 6.5l2.5 2.5M14.5 9l2 2"/>',
  importar:'<path d="M12 16V5M6.5 9.5 12 4l5.5 5.5M5 20h14"/>',
  relatorios:'<path d="M4 20h16M7 20V9M12 20V4M17 20v-7"/>',
  auditoria:'<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.5M4.5 12h.5M4.5 18h.5"/>',
  site:'<circle cx="12" cy="12" r="9"/><path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18"/>'
};
const icAdm = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round">${ICONES_ADM[n]||''}</svg>`;

/* ============================================================
   ROTA
   ============================================================ */
async function pageAdmin(sub, sub2){
  const p = PAINEIS.find(([k]) => k === sub);
  if (!p || !painelPermitido(p)) return galeriaAdmin();

  const [k, titulo, , lead] = p;
  $('#main').innerHTML = `
    <div class="topo-gestao">
      <div style="padding-top:34px"><a class="icon-btn" href="#/admin" title="Voltar" aria-label="Voltar">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></a></div>
      <div class="tx"><span class="eyebrow">Administração</span>
        <h1>${esc(titulo)}</h1><p class="lead">${esc(lead)}</p></div></div>
    ${PAINEIS.filter(painelPermitido).map(([x]) => `<section id="sec-${x}" ${x===k?'':'hidden'}>${
      x===k ? '<div class="carregando"><span class="spin"></span> Carregando…</div>' : ''}</section>`).join('')}`;

  if (k === 'site')       return admCarregarProjetos();
  if (k === 'relatorios') return comModulo('relatorios', () => pageRelatorios());
  if (k === 'auditoria')  return comModulo('gestao', async () => {
    await pageAuditoria();
    /* pageAuditoria desenha em #main; aqui ela mora dentro do painel */
    const corpo = $('#main').innerHTML;
    $('#main').innerHTML = guardaTopo + `<section id="sec-auditoria">${corpo}</section>`;
    renderTabelaAud();
  });
  if (k === 'contas')     return pageContas();
  if (k === 'grupos')     return admCarregarGrupos(sub2);
  if (k === 'acessos')    return admCarregarCatalogo();
  if (k === 'importar')   return pageImportar();

  /* Um painel por vez: só existe um #sec-* na tela, e carregar os cinco
     juntos fazia quatro deles escreverem em contêiner inexistente. */
  const carga = { avisos: admCarregarAvisos,
                  solicitacoes: admCarregarSols, ouvidoria: admCarregarOuvidoria,
                  agendas: admCarregarAgendas };
  if (carga[k]) await carga[k]();
}

/* O cabeçalho antigo tinha um contador por aba; agora a contagem vive nos
   tiles da galeria, então escrever nele é opcional. */
function porTexto(id, txt){ const el = $('#'+id); if (el) el.textContent = txt; }

let guardaTopo = '';
async function comModulo(nome, fn){
  guardaTopo = $('#main').innerHTML.replace(/<section id="sec-[a-z]+">[\s\S]*<\/section>/, '');
  try { await carregarModulo(nome); }
  catch(e){
    $('#main').innerHTML = guardaTopo
      + `<div class="aviso-box err">Não foi possível carregar: ${esc(e.message)}</div>`;
    return;
  }
  await fn();
}

function galeriaAdmin(){
  const pend = adminP.sols.filter(s => ['aberta','em_analise'].includes(s.status)).length;
  const ouv  = adminP.ouvidoria.filter(m => !m.tratada).length;
  const conta = { solicitacoes: pend, ouvidoria: ouv };
  $('#main').innerHTML = `
    <div class="topo-gestao"><div class="tx"><span class="eyebrow">Administração</span>
      <h1>Painéis</h1>
      <p class="lead">O que a gestão mantém. Cada painel tem endereço próprio — dá para
        mandar o link de um deles por mensagem.</p></div></div>
    ${GRUPOS_PAINEL.map(g => {
      const itens = PAINEIS.filter(([,, gr]) => gr === g).filter(painelPermitido);
      if (!itens.length) return '';
      return `<div class="adm-grupo">${g}</div>
        <div class="gal" style="margin-bottom:26px">${itens.map(([k, titulo, , lead]) =>
          `<a class="tile" href="#/admin/${k}"><span class="sq">${icAdm(k)}</span>
            <span class="tt">${esc(titulo)}${conta[k] ? ` <span class="tile-n">${conta[k]}</span>` : ''}</span>
            <span class="td">${esc(lead)}</span></a>`).join('')}</div>`;
    }).join('')}`;
  /* as contagens dos tiles pedem os dados; carrega em segundo plano */
  if (!adminP.pronto) Promise.all([admCarregarSols(), admCarregarOuvidoria()])
    .then(() => { if (location.hash.replace(/^#\//,'') === 'admin') galeriaAdmin(); }, () => {});
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
  try{
    const { error } = await sb.from('portal_avisos').update(v).eq('id', id);
    if (error){ toast('Erro ao salvar: ' + error.message, true); return; }
    toast('Aviso salvo' + (v.publicado ? ', já está girando no portal.' : ' (oculto).'));
    await admCarregarAvisos();
  }catch(e){
    falha(e, 'Não foi possível salvar');
  }finally{
    const b = $('#a-salvar'); if (b) b.disabled = false;
  }
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
  porTexto('n-solicitacoes', pend ? pend : '');
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
  porTexto('n-ouvidoria', pend ? pend : '');
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
  porTexto('n-agendas', comErro ? String(comErro) : '');
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
   PAINÉIS · CATÁLOGO DE ACESSOS, IMPORTAÇÃO E CONTAS
   Vieram de Operações no SOMA, que deixa de existir como tela:
   cada ferramenta virou um painel com endereço próprio.
   ============================================================ */
/* ---------------- catálogo de acessos ---------------- */
async function admCarregarCatalogo(){
  const { data } = await sb.from('itens_de_acesso').select('*').order('ordem');
  state.itensAcesso = data || [];
  pageCatalogo();
}
function pageCatalogo(){
  $('#sec-acessos').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
      <p class="sub" style="margin:0">Os sistemas, locais e documentos cujo acesso a NRO controla</p>
      ${can() ? ibtn('plus','Novo item','modalItem()','primary') : ''}</div>
    <div class="card">
    <p class="small muted" style="line-height:1.6;margin-bottom:14px">Cada linha é um sistema, local ou documento controlado.
    Um item novo passa a valer para todos os membros na hora, sem alterar a estrutura.</p>
    <table class="tabela trabalho"><thead><tr><th>Item</th><th>Categoria</th><th>Situação</th>${can()?'<th></th>':''}</tr></thead>
    <tbody>${state.itensAcesso.map(i=>`<tr>
      <td style="font-weight:600">${esc(i.nome)}</td>
      <td>${CAT_LABEL[i.categoria]||esc(i.categoria)}</td>
      <td><span class="pill"><span class="dt ${i.ativo?'dt-ok':'dt-gray'}"></span>${i.ativo?'Em uso':'Desativado'}</span></td>
      ${can()?`<td style="text-align:right;white-space:nowrap">
        ${ibtn('pencil','Editar item',`modalItem('${i.id}')`,'sm')}
        ${ibtn(i.ativo?'x':'check', i.ativo?'Desativar':'Reativar', `alternarItem('${i.id}', ${!i.ativo})`,'sm')}</td>`:''}
    </tr>`).join('')}</tbody></table></div>`;
}
function modalItem(id){
  const i = id ? state.itensAcesso.find(x=>x.id===id) : null;
  abreModal(`<h3>${i?'Editar item de acesso':'Novo item de acesso'}</h3>
    <div class="fld"><label>Nome</label><input id="it-nome" value="${esc(i?.nome||'')}" placeholder="ex.: Figma, Sala de reuniões, Termo de sigilo — Parceiro X"></div>
    <div class="fld"><label>Categoria</label><select id="it-cat">
      ${['sistema','local','documento'].map(c=>`<option value="${c}" ${i?.categoria===c?'selected':''}>${CAT_LABEL[c]}</option>`).join('')}</select></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="salvarItem(${i?`'${i.id}'`:'null'})">${i?'Salvar':'Criar item'}</button></div>`, true);
}
async function salvarItem(id){
  const nome = $('#it-nome').value.trim(), categoria = $('#it-cat').value;
  if(!nome){ toast('Informe o nome do item.', true); return; }
  try{
    const {error} = id
      ? await sb.from('itens_de_acesso').update({nome, categoria}).eq('id', id)
      : await sb.from('itens_de_acesso').insert({nome, categoria});
    if(error) throw error;
    const {data} = await sb.from('itens_de_acesso').select('*').order('ordem'); state.itensAcesso = data||[];
    fechaModal(); pageCatalogo(); toast(id?'Item atualizado.':'Item criado.');
  }catch(e){ falha(e, e?.code==='23505'?'Já existe um item com esse nome':'Erro ao salvar'); }
}
async function alternarItem(id, ativo){
  try{
    const {error} = await sb.from('itens_de_acesso').update({ativo}).eq('id', id); if(error) throw error;
    const it = state.itensAcesso.find(x=>x.id===id); if(it) it.ativo = ativo;
    pageCatalogo(); toast(ativo?'Item reativado.':'Item desativado. Concessões existentes foram preservadas.');
  }catch(e){ falha(e,'Erro ao atualizar'); }
}

/* ---------------- importar planilha ---------------- */
const MAPA_INST = {'REGISTRO':'registro','STATUS':'status','NOME':'nome','DEPARTAMENTO':'departamento',
  'CARGO ATUAL':'cargo','GRUPOS':'grupos','EMAIL NRO':'email_nro','EMAIL PESSOAL':'email_pessoal','TELEFONE':'telefone',
  'DATA DE INGRESSO':'data_ingresso','FORMA DE INGRESSO':'forma_ingresso','DATA DE DESLIGAMENTO':'data_desligamento',
  'PROJETO REGISTRADO NO SISTEMA DE FOMENTO':'projeto_fomento','CLASSIFICAÇÃO':'classificacao','BOLSA':'bolsa',
  'DATA DE ENCERRAMENTO':'data_encerramento'};
/* Cabeçalhos do Excel que o próprio SOMA exporta (Relatórios → Quadro
   completo). Permitem reimportar o arquivo exportado — inclusive editado —
   para manutenção em massa (renomear cargos, trocar grupos, e-mails etc.).
   "Gestor imediato" traz o NOME do gestor; vira gestor_registro numa segunda
   passada da importação. Os cabeçalhos oficiais acima têm prioridade. */
const ALIAS_INST = {'CARGO':'cargo','E-MAIL NRO':'email_nro','E-MAIL PESSOAL':'email_pessoal',
  'PROJETO NO FOMENTO':'projeto_fomento','GESTOR IMEDIATO':'_gestor_nome'};
const MAPA_ACESSOS = {
  'POSSUI TERMO DE SIGILO DO LABBIO ASSINADO?':'Termo de sigilo — LABBIO',
  'POSSUI TERMO DE SIGILO DA VISURI ASSINADO?':'Termo de sigilo — Visuri',
  'POSSUI TERMO DE SIGILO DA NRO ASSINADO?':'Termo de sigilo — NRO',
  'ACESSO BIOMÉTRICO AO LABBIO':'Biometria — LABBIO',
  'ACESSO BIOMÉTRICO AO LEB':'Biometria — LEB',
  'PASTAS COM ACESSO NO DRIVE CTA-EEUFMG':'Drive CTA-EEUFMG',
  'ACESSO A TIMES NO GITHUB CTA-EEUFMG':'GitHub CTA-EEUFMG',
  'ACESSO À CONTA DE EMAIL ZIMBRA':'E-mail Zimbra',
  'ACESSO À CONTA GOOGLE NRO':'Conta Google NRO',
  'ACESSO À CONTA GOOGLE CTA-EEUFMG':'Conta Google CTA-EEUFMG',
  'ACESSO AO TIME CANVA':'Canva',
  'ACESSO AO INSTAGRAM':'Instagram',
  'ACESSO AO LINKEDIN':'LinkedIn',
  'ACESSO AO WIX':'Wix',
  'ACESSO AO CLOUDFLARE':'Cloudflare',
  'ACESSO AO WHATSAPP BUSINESS':'WhatsApp Business',
  'ACESSO AO NOTION':'Notion'};
const MAPA_FORM = {'CPF':'cpf','DATA DE NASCIMENTO':'data_nascimento','ENDEREÇO':'endereco','CIDADE DE ORIGEM':'cidade_origem',
  'INSTITUIÇÃO DE ENSINO':'instituicao','CURSO':'curso','MATRÍCULA':'matricula','PERÍODO DE INGRESSO':'periodo_ingresso',
  'BACKGROUND':'background','LINK DO CURRÍCULO LATTES':'lattes','TEMPO DE DESLOCAMENTO ATÉ A UNIVERSIDADE':'tempo_deslocamento',
  'AUTODECLARAÇÃO RACIAL':'autodeclaracao_racial','SITUAÇÃO JUNTO À FUMP':'situacao_fump',
  'NECESSIDADES ESPECÍFICAS DE ACESSIBILIDADE':'acessibilidade','GÊNERO':'genero','PERFIL DO INSTAGRAM':'instagram',
  'USUÁRIO DO GITHUB':'github'};
let pacote = null;

const t = (v)=>{ if(v==null) return null; const s=String(v).trim(); return s===''||s==='--' ? null : s; };
const textoNum = (v)=>{ if(v==null||v==='') return null; if(typeof v==='number') return v.toFixed(0); return t(v); };
const ehVerdade = (v)=> v===true || String(v).trim().toUpperCase()==='TRUE';
function dataISO(v){
  if(v==null||v==='') return null;
  if(typeof v==='number'){ if(v<20000||v>80000) return null;
    return new Date(Math.round((v-25569)*86400*1000)).toISOString().slice(0,10); }
  if(v instanceof Date && !isNaN(v)) return v.toISOString().slice(0,10);
  const s=String(v).trim();
  let m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if(m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  if(/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0,10);
  return null;
}
function normLinhas(ws){
  return window.XLSX.utils.sheet_to_json(ws, {defval:null, raw:true}).map(r=>{
    const o={}; Object.keys(r).forEach(k=> o[k.trim().toUpperCase()] = r[k]); return o;
  });
}
function pageImportar(){
  pacote = null;
  $('#sec-importar').innerHTML = `
    <div class="card"><h3>Importar planilha do quadro</h3>
      <p class="small muted" style="line-height:1.65;margin-bottom:16px">
        Dois formatos são aceitos: a planilha oficial <b>NRO-PES-005</b> (abas INSTITUCIONAL, FORM e
        ACESSOS) e o <b>Excel exportado pelo próprio SOMA</b> (Relatórios → Quadro completo), inclusive
        editado — ideal para manutenção em massa, como renomear cargos ou reorganizar grupos.
        Só as colunas presentes no arquivo são atualizadas; registros existentes são casados pelo
        número de registro — pode importar quantas vezes quiser sem duplicar.</p>
      <div class="dropzone" onclick="document.getElementById('imp-file').click()">
        Clique para selecionar o arquivo<br><b>NRO-PES-005 ou exportação do SOMA (.xlsx)</b>
      </div>
      <input id="imp-file" type="file" accept=".xlsx,.xls,.csv" hidden onchange="lerArquivo(this.files[0])">
    </div>
    <div id="imp-resumo"></div>`;
}
async function lerArquivo(file){
  if(!file) return;
  if(!window.XLSX){ toast('Preparando o leitor de planilha…');
    try{ await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'); }
    catch(e){ toast('Não foi possível carregar o leitor de planilha.', true); return; } }
  try{
    const wb = window.XLSX.read(new Uint8Array(await file.arrayBuffer()), {type:'array'});
    const acha = (nome)=>{ const n = wb.SheetNames.find(s=>s.trim().toUpperCase()===nome); return n? wb.Sheets[n] : null; };
    let wsInst = acha('INSTITUCIONAL') || acha('QUADRO'), wsForm = acha('FORM'), wsAcc = acha('ACESSOS');
    if(!wsInst && wb.SheetNames.length===1){
      const unica = wb.Sheets[wb.SheetNames[0]];
      const teste = normLinhas(unica)[0]||{};
      if('REGISTRO' in teste && 'NOME' in teste) wsInst = unica;
    }
    const linhasInst = wsInst ? normLinhas(wsInst) : [];
    /* Só as colunas presentes no arquivo entram na atualização — uma planilha
       com apenas REGISTRO e CARGO ATUAL, por exemplo, mexe só nos cargos e
       preserva todo o resto do cadastro. */
    const presentes = new Set(); linhasInst.forEach(r=> Object.keys(r).forEach(k=> presentes.add(k)));
    const PARES_INST = [...Object.entries(MAPA_INST), ...Object.entries(ALIAS_INST)];
    const jaExiste = new Set(state.membros.map(m=>m.registro));
    const membros = linhasInst.map(r=>{
      const o={};
      PARES_INST.forEach(([h,k])=>{
        if(!presentes.has(h) || (k in o)) return;
        const v=r[h];
        if(k==='registro') o[k] = v==null||v===''? null : Math.round(Number(v));
        else if(k==='grupos') o[k] = t(v)? String(v).split(',').map(x=>x.trim()).filter(Boolean) : [];
        else if(k.startsWith('data_')) o[k] = dataISO(v);
        else o[k] = t(v);
      });
      if(presentes.has('STATUS') && !o.status) o.status='Ativo';
      return o;
    }).filter(o=> o.registro && (o.nome || (!presentes.has('NOME') && jaExiste.has(o.registro))));
    const colunasInst = PARES_INST.filter(([h])=>presentes.has(h)).map(([h])=>h);
    const pess = !wsForm ? [] : normLinhas(wsForm).map(r=>{
      const o={_nome: t(r['NOME COMPLETO'])};
      Object.entries(MAPA_FORM).forEach(([h,k])=>{
        const v=r[h];
        if(k==='data_nascimento') o[k]=dataISO(v);
        else if(k==='matricula') o[k]=textoNum(v);
        else o[k]=t(v);
      });
      const term = t(r['TERMO DE AUTORIZAÇÃO DO USO DE IMAGEM']);
      o.autorizacao_imagem = term ? term.toLowerCase().startsWith('autorizo') : null;
      return o;
    }).filter(o=>o._nome);
    const acessos = [];
    if(wsAcc) normLinhas(wsAcc).forEach(r=>{
      const nome = t(r['NOME']); if(!nome) return;
      Object.entries(MAPA_ACESSOS).forEach(([h,item])=>{ if(ehVerdade(r[h])) acessos.push({_nome:nome, _item:item}); });
    });
    if(!membros.length && !pess.length && !acessos.length){
      toast('Não encontrei dados reconhecíveis nesse arquivo. Confira se é a planilha NRO-PES-005 ou uma exportação do SOMA.', true); return;
    }
    pacote = {membros, pess, acessos};
    const nNovos = membros.filter(m=>!jaExiste.has(m.registro)).length;
    $('#imp-resumo').innerHTML = `<div class="card"><h3>Pronto para importar — ${esc(file.name)}</h3>
      <label class="check"><input type="checkbox" id="ck-m" ${membros.length?'checked':'disabled'}>
        <span><b>${membros.length}</b> membros — ${nNovos} novo(s), ${membros.length-nNovos} atualização(ões)</span></label>
      ${membros.length?`<p class="small muted" style="margin:2px 0 6px 26px">Colunas reconhecidas (só elas serão atualizadas): ${esc(colunasInst.join(', '))}</p>`:''}
      <label class="check"><input type="checkbox" id="ck-p" ${pess.length?'checked':'disabled'}>
        <span><b>${pess.length}</b> fichas de dados pessoais (aba FORM)</span></label>
      <label class="check"><input type="checkbox" id="ck-a" ${acessos.length?'checked':'disabled'}>
        <span><b>${acessos.length}</b> concessões de acesso marcadas (aba ACESSOS)</span></label>
      <div style="display:flex;gap:10px;margin-top:14px">
        <button class="btn solid" id="imp-go" onclick="executarImport()">${ic('upload')} Importar agora</button>
        <button class="btn ghost" onclick="pageImportar()">Escolher outro arquivo</button></div>
      <div id="imp-log" class="log" style="margin-top:16px" hidden></div></div>`;
  }catch(e){ falha(e,'Não consegui ler o arquivo'); }
}
async function executarImport(){
  if(!pacote) return;
  const log = $('#imp-log'); log.hidden=false; log.textContent='';
  const diz = (s)=>{ log.textContent += s+'\n'; log.scrollTop = log.scrollHeight; };
  $('#imp-go').disabled = true;
  try{
    if($('#ck-m').checked && pacote.membros.length){
      const jaExiste = new Set(state.membros.map(m=>m.registro));
      /* o lote precisa ter as mesmas colunas em todas as linhas; além disso,
         cadastros novos nascem com status mesmo quando a coluna não veio. */
      const linhas = pacote.membros.map(({_gestor_nome, ...m})=>m);
      const novos  = linhas.filter(m=>!jaExiste.has(m.registro)).map(m=>({status:'Ativo', ...m}));
      const atuais = linhas.filter(m=> jaExiste.has(m.registro));
      diz(`Importando ${linhas.length} membros (${novos.length} novo(s), ${atuais.length} atualização(ões))…`);
      if(atuais.length) await upsertLotes('membros', atuais, 'registro');
      if(novos.length)  await upsertLotes('membros', novos, 'registro');
      const {data} = await sb.from('membros').select('*').order('registro');
      state.membros = data||[];
      diz(`✔ Membros importados. O quadro agora tem ${state.membros.length} registros.`);
      /* 2ª passada: coluna "Gestor imediato" (arquivo exportado pelo SOMA)
         traz o nome do gestor — resolvida aqui, depois que todos os membros
         do arquivo já existem no quadro. Célula vazia desfaz o vínculo. */
      const comGestor = pacote.membros.filter(m=>'_gestor_nome' in m);
      if(comGestor.length){
        const porNomeM = new Map(state.membros.map(m=>[norm(m.nome), m.registro]));
        const vinc=[], semPar=[];
        comGestor.forEach(m=>{
          if(m._gestor_nome==null){ vinc.push({registro:m.registro, gestor_registro:null}); return; }
          const g = porNomeM.get(norm(m._gestor_nome));
          if(g && g!==m.registro) vinc.push({registro:m.registro, gestor_registro:g});
          else semPar.push(`${m._gestor_nome} (reg. ${m.registro})`);
        });
        if(vinc.length){
          await upsertLotes('membros', vinc, 'registro');
          const r2 = await sb.from('membros').select('*').order('registro');
          state.membros = r2.data||[];
          diz(`✔ Gestor imediato atualizado em ${vinc.length} registro(s).`);
        }
        if(semPar.length) diz(`⚠ Gestor não encontrado pelo nome em ${semPar.length} caso(s): ${semPar.join('; ')}`);
      }
    }
    const porNome = new Map(state.membros.map(m=>[norm(m.nome), m.registro]));
    if($('#ck-p').checked && pacote.pess.length){
      const linhas=[], semPar=[];
      pacote.pess.forEach(p=>{
        const reg = porNome.get(norm(p._nome));
        if(!reg){ semPar.push(p._nome); return; }
        const {_nome, ...resto} = p; linhas.push({registro:reg, ...resto});
      });
      diz(`Importando ${linhas.length} fichas de dados pessoais…`);
      await upsertLotes('dados_pessoais', linhas, 'registro');
      diz(`✔ Dados pessoais importados.`);
      if(semPar.length) diz(`⚠ ${semPar.length} resposta(s) do FORM sem membro correspondente: ${semPar.join('; ')}`);
    }
    if($('#ck-a').checked && pacote.acessos.length){
      const porItem = new Map(state.itensAcesso.map(i=>[i.nome, i.id]));
      const linhas=[]; let semMembro=0, semItem=0;
      pacote.acessos.forEach(a=>{
        const reg = porNome.get(norm(a._nome)); if(!reg){ semMembro++; return; }
        const item = porItem.get(a._item); if(!item){ semItem++; return; }
        linhas.push({registro:reg, item_id:item, ativo:true, responsavel:'Importação da planilha'});
      });
      diz(`Importando ${linhas.length} concessões de acesso…`);
      await upsertLotes('acessos_concedidos', linhas, 'registro,item_id');
      diz(`✔ Acessos importados.`);
      if(semMembro) diz(`⚠ ${semMembro} concessão(ões) ignorada(s): nome sem membro correspondente.`);
      if(semItem) diz(`⚠ ${semItem} concessão(ões) ignorada(s): item fora do catálogo.`);
    }
    diz('');
    diz('Importação concluída. Confira o quadro na aba Membros.');
    toast('Importação concluída.');
  }catch(e){
    diz('✖ ERRO: ' + (e?.message || e));
    falha(e, 'A importação foi interrompida');
  }finally{
    /* o botão volta ao normal aconteça o que acontecer — sem isto, um erro
       aqui deixava "Importar" desabilitado até recarregar a página */
    const b = $('#imp-go'); if (b) b.disabled = false;
  }
}

/* ---------------- operações ---------------- */

function modalReuniaoDP(){
  const opts = state.membros.filter(m=>['Ativo','Em pausa / avaliação','Sob demanda'].includes(m.status))
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
    .map(m=>`<option value="${m.registro}">${esc(m.nome)}</option>`).join('');
  abreModal(`<h3>Reunião com o Depto de Pessoal</h3>
    <div class="fld"><label>Membro</label><select id="dp-reg">${opts}</select></div>
    <div class="fld"><label>Data</label><input id="dp-data" type="date" value="${hojeISO()}"></div>
    <div class="fld"><label>Resumo do alinhamento</label><textarea id="dp-desc" placeholder="Pontos conversados, combinados e próximos passos…"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="salvarReuniaoDP()">Registrar</button></div>`, true);
}
async function salvarReuniaoDP(){
  try{
    const {error} = await sb.from('ocorrencias').insert({registro:parseInt($('#dp-reg').value,10),
      tipo:'Conversa com o Depto de Pessoal', data:$('#dp-data').value||hojeISO(),
      descricao:$('#dp-desc').value.trim()||null, responsavel:quemSouEu()});
    if(error) throw error;
    fechaModal(); toast('Reunião registrada na ficha do membro.');
  }catch(e){ falha(e,'Erro ao registrar'); }
}

/* Upsert em lotes de 100 — o PostgREST tem limite de tamanho de corpo,
   e uma planilha inteira em uma chamada só estoura. */
async function upsertLotes(tabela, linhas, conflito){
  for (let i = 0; i < linhas.length; i += 100){
    const { error } = await sb.from(tabela).upsert(linhas.slice(i, i+100), { onConflict: conflito });
    if (error) throw error;
  }
}

/* ---------------- contas e perfis ---------------- */
let _contas = [];
/* renderContas veio do SOMA escrevendo num modal; aqui ela é um painel. */
function porContas(html){
  const el = $('#sec-contas');
  if (el) el.innerHTML = html.replace(/^<h3>Contas e perfis<\/h3>/, '');
  else abreModal(html, true);
}
async function pageContas(){
  try{
    const {data, error} = await sb.from('perfis').select('id,email,nome,papel,registro').order('email');
    if(error) throw error;
    _contas = data||[];
    renderContas(_contas);
  }catch(e){ const el = $('#sec-contas');
    if (el) el.innerHTML = `<div class="aviso-box err">Erro ao carregar as contas: ${esc(e.message)}</div>`;
    else falha(e,'Erro ao carregar as contas'); }
}
function renderContas(perfis){
  const souAdmin = state.perfil.papel==='admin';
  const emailsComConta = new Set(perfis.map(p=>norm(p.email)));
  const semConta = state.membros.filter(m=> m.status==='Ativo'
    && ![m.email_nro, m.email_pessoal].some(e=> e && emailsComConta.has(norm(e))));
  const regOpts = (sel)=> `<option value="">— sem vínculo —</option>` + state.membros.slice()
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
    .map(m=>`<option value="${m.registro}" ${m.registro===sel?'selected':''}>${esc(m.nome)}</option>`).join('');
  porContas(`<h3>Contas e perfis</h3>
    <p class="small muted" style="line-height:1.6;margin-bottom:12px">Cada conta nasce com papel <b>Consulta</b>,
    vinculada ao membro pelo e-mail usado no cadastro. Ajuste aqui o papel e o vínculo${souAdmin?'':' (somente administradores alteram papéis)'};
    a chavinha envia o link de redefinição de senha para o e-mail da conta.</p>
    <div style="overflow:auto;max-height:56vh">
    <table class="tabela trabalho"><thead><tr><th>Conta</th><th>Membro vinculado</th><th>Papel</th><th style="text-align:right">Senha</th></tr></thead>
    <tbody>${perfis.map(p=>`<tr>
      <td><b>${esc(p.nome||p.email)}</b><br><span class="small muted">${esc(p.email)}</span></td>
      <td><select onchange="ctVincular('${p.id}', this.value)" ${souAdmin?'':'disabled'} style="min-width:170px">${regOpts(p.registro)}</select></td>
      <td><select onchange="ctPapel('${p.id}', this.value)" ${souAdmin && p.id!==state.perfil.id?'':'disabled'}
          title="${p.id===state.perfil.id?'Seu próprio papel não pode ser alterado por aqui':''}">
        ${Object.entries(PAPEIS).map(([k,l])=>`<option value="${k}" ${p.papel===k?'selected':''}>${l}</option>`).join('')}</select></td>
      <td style="text-align:right">${ibtn('key','Enviar link de redefinição de senha',`ctReset('${p.id}')`,'sm ghost')}</td>
    </tr>`).join('')}</tbody></table></div>
    ${semConta.length?`<div class="aviso-box info" style="margin-top:14px"><b>${semConta.length} membro(s) ativo(s) ainda sem conta.</b>
      Peçam que criem a conta na própria tela de login do SOMA, com o e-mail do quadro — o vínculo é automático.<br>
      <button class="btn ghost" style="margin-top:8px" onclick="ctConvite()">${ic('copy')} Copiar instruções de acesso</button></div>`:''}
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`,
    /* uma tabela de contas não cabe em 520px. O `querySelector('.modal')`
       que estava aqui vinha do SOMA antigo, onde o modal era uma classe;
       no portal é um id, então a linha nunca alargou nada. */
    'largo');
}
async function ctPapel(id, papel){
  try{
    const {error} = await sb.from('perfis').update({papel}).eq('id', id);
    if(error) throw error;
    toast('Papel atualizado para '+(PAPEIS[papel]||papel)+'.');
  }catch(e){ falha(e,'Erro ao mudar o papel'); pageContas(); }
}
async function ctVincular(id, reg){
  try{
    const r = reg ? parseInt(reg,10) : null;
    const nome = r ? nomeDe(r) : null;
    const {error} = await sb.from('perfis').update({registro:r, ...(nome?{nome}:{})}).eq('id', id);
    if(error) throw error;
    toast(r ? 'Conta vinculada a '+nome+'.' : 'Vínculo removido.');
  }catch(e){ falha(e,'Erro ao vincular'); pageContas(); }
}
async function ctReset(id){
  const email = _contas.find(p=>p.id===id)?.email;
  if(!email) return;
  try{
    const {error} = await sb.auth.resetPasswordForEmail(email, {redirectTo:URL_APP()});
    if(error) throw error;
    toast('Link de redefinição enviado para '+email+'.');
  }catch(e){ falha(e,'Erro ao enviar o link'); }
}
function ctConvite(){
  copiar(`Acesso ao SOMA — NeuroDynamics
1) Abra ${URL_APP()}
2) Clique em "Criar conta" e use o e-mail que está no quadro de pessoal (NRO ou pessoal).
3) Confirme o e-mail pelo link recebido e faça login.
A conta começa com acesso de consulta; papéis adicionais são atribuídos pelo Depto de Pessoal.`);
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
    <div class="aviso-box info">Os vídeos e as matérias da seção <b>Quem somos</b> são editados no Studio${podeStudio()
      ? `: <a href="#/studio/config/imprensa" style="text-decoration:underline">Studio › Configurações › Imprensa</a>.`
      : ', pela gestão do Studio (admin e o grupo aprovador).'}</div>
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
  try{
    const { error } = await sb.from('site_projetos').update(v).eq('id', id);
    if (error){ toast('Erro ao salvar: ' + error.message, true); return; }
    toast('Projeto salvo — já está no ar.');
    await admCarregarProjetos();
  }catch(e){
    falha(e, 'Não foi possível salvar');
  }finally{
    const b = $('#sp-salvar'); if (b) b.disabled = false;
  }
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
      ...adminP.avisos.map(a => ({ titulo:a.titulo, sub:'Aviso', href:'#/admin/avisos' })),
      ...adminP.projetos.map(p => ({ titulo:p.nome, sub:'Projeto do site', href:'#/admin/site' }))
    ];
    return filtrarSimples(itens, t, 6);
  }
});

/* ============================================================
   GRUPOS E QUADROS — #/admin/grupos[/<prefixo>]

   Os grupos formam uma árvore (v19): um grupo pode ter pai, e quem
   está num grupo está também nos de cima — pôr alguém em
   NRO_PROJECT_NEBULA põe essa pessoa em NRO_PROJECTS. A tela existe
   para isso ficar à vista: à esquerda a árvore; à direita o grupo
   escolhido, de onde ele vem, o que tem embaixo, quem está nele pela
   ficha e quem chegou por um subgrupo — e uma lista para pôr várias
   pessoas de uma vez.

   O que já morava aqui continua:
   - o NOME e o PREFIXO. O prefixo entra no código de toda atividade
     (ORT-14) e não muda retroativamente;
   - renomear, que também corrige a ficha de quem está no grupo — o
     vínculo é por nome, e o banco faz as duas coisas numa transação;
   - quem ENXERGA o quadro. Grupo reservado só abre para quem está
     nele; para os outros, é aqui que se concede.

   Sem a v19 a tela continua funcionando como lista plana: não há pai,
   quadro opcional nem responsáveis para editar, e a tela diz por quê.
   ============================================================ */
const admGrupos = { lista:[], acessos:[], abertoId:null, pronto:false, carregadoEm:0,
                    sel:null, fechados:new Set(), filtro:'', ver:'todas',
                    busca:'', marcados:new Set() };
const ATIVOS_E_PAUSA = ['Ativo','Em pausa / avaliação'];

async function admCarregarGrupos(prefixo, forcar){
  const alvo = $('#sec-grupos'); if (!alvo) return;
  const velho = Date.now() - admGrupos.carregadoEm > 30000;
  if (forcar || !admGrupos.pronto || velho){
    if (!admGrupos.pronto)
      alvo.innerHTML = '<div class="carregando"><span class="spin"></span> Carregando os grupos…</div>';
    const [g, a] = await Promise.all([
      sb.from('grupos').select('*').order('ordem').order('nome'),
      sb.from('grupo_acessos').select('*')
    ]);
    if (g.error){
      alvo.innerHTML = `<div class="aviso-box err"><b>Não foi possível listar os grupos.</b>
        ${esc(g.error.message)}<br><span class="small">Se o erro fala de relação inexistente,
        falta aplicar a migração <code>db/v17_grupos_acesso.sql</code>.</span></div>`;
      return;
    }
    admGrupos.lista   = g.data || [];
    admGrupos.acessos = a.data || [];
    admGrupos.pronto  = true;
    admGrupos.carregadoEm = Date.now();
  }
  const achado = prefixo && admGrupos.lista.find(x => x.prefixo === String(prefixo).toUpperCase());
  if (achado && achado.id !== admGrupos.sel){ admGrupos.sel = achado.id; admGrupos.marcados.clear(); admGrupos.busca = ''; }
  if (!admGrupos.lista.some(x => x.id === admGrupos.sel)) admGrupos.sel = admRaizes()[0]?.id ?? null;
  if (!$('#sec-grupos')) return;   /* a pessoa saiu da tela enquanto carregava */
  renderGrupos();
}

/* ---------------- a árvore ---------------- */
/* A v19 trouxe pai, quadro e responsáveis; sem ela, lista plana. */
const admTemArvore = () => admGrupos.lista.some(g => 'quadro' in g);
const admGrupo = id => admGrupos.lista.find(g => g.id === id) || null;
const admOrdem = (a, b) => (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, 'pt-BR');
const admFilhos = id => admGrupos.lista.filter(g => g.pai_id === id).sort(admOrdem);
const admRaizes = () => admGrupos.lista.filter(g => !g.pai_id || !admGrupo(g.pai_id)).sort(admOrdem);
function admCaminho(g){
  const out = [], vistos = new Set();
  for (let x = g; x && !vistos.has(x.id); x = admGrupo(x.pai_id)){ vistos.add(x.id); out.unshift(x); }
  return out;
}
/* O grupo e todos os de baixo, contando os inativos — para não
   oferecer como pai um grupo que fecharia um círculo. */
function admAbaixoTodos(id){
  const out = new Set([id]);
  for (let novo = true; novo; ){
    novo = false;
    admGrupos.lista.forEach(g => { if (g.pai_id && out.has(g.pai_id) && !out.has(g.id)){ out.add(g.id); novo = true; } });
  }
  return out;
}
/* Quem está no grupo, com a regra do banco (esta_no_grupo): o próprio
   grupo, e os de baixo só por grupo ativo. Devolve [{m, via}], em que
   via é o grupo da ficha pelo qual a pessoa chegou. */
function admPessoasDo(g){
  const nomes = new Map([[g.nome, g]]);
  for (let novo = true; novo; ){
    novo = false;
    admGrupos.lista.forEach(x => {
      if (x.ativo !== false && x.pai_id && [...nomes.values()].some(y => y.id === x.pai_id) && !nomes.has(x.nome)){
        nomes.set(x.nome, x); novo = true;
      }
    });
  }
  return (state.membros || []).filter(m => ATIVOS_E_PAUSA.includes(m.status))
    .map(m => {
      const gs = m.grupos || [];
      const via = gs.includes(g.nome) ? g.nome : gs.find(n => nomes.has(n));
      return via ? { m, via } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.m.nome.localeCompare(b.m.nome, 'pt-BR'));
}

const prefixoColide = (g) => admGrupos.lista.some(o =>
  o.id !== g.id && o.prefixo.replace(/\d+$/,'') === g.prefixo.replace(/\d+$/,''));

function admNoArvore(g, nivel){
  const filhos = admFilhos(g.id);
  const fechado = admGrupos.fechados.has(g.id);
  const q = norm(admGrupos.filtro);
  /* com filtro, a árvore se abre inteira e mostra só o que casa, com o
     caminho até lá — um galho sem nada que case some */
  const casa = x => !q || norm(x.nome).includes(q) || norm(x.prefixo).includes(q);
  const algumAbaixo = x => casa(x) || admFilhos(x.id).some(algumAbaixo);
  if (q && !algumAbaixo(g)) return '';
  const n = admPessoasDo(g).length;
  const aberto = q ? true : !fechado;
  return `<div class="gr-ramo">
    <div class="gr-no">
      ${filhos.length
        ? `<button class="gr-caret" aria-expanded="${aberto}" aria-label="${aberto ? 'Recolher' : 'Abrir'} ${esc(g.nome)}"
             onclick="admAlternarRamo(${g.id})">${ic('chevron')}</button>`
        : '<span class="gr-caret sem" aria-hidden="true"></span>'}
      <a class="gr-link${g.id === admGrupos.sel ? ' on' : ''}${g.ativo === false ? ' off' : ''}"
         href="#/admin/grupos/${encodeURIComponent(g.prefixo)}" ${g.id === admGrupos.sel ? 'aria-current="page"' : ''}>
        <span class="gr-dot" style="${g.cor ? `background:${esc(g.cor)}` : ''}"></span>
        <span class="nm" title="${esc(g.nome)}">${esc(g.nome)}</span>
        ${g.reservado ? `<span title="Quadro fechado">${ic('cadeado')}</span>` : ''}
        ${g.quadro === false ? `<span class="gr-semq" title="Sem quadro em Atividades">sem quadro</span>` : ''}
        <span class="n" title="${n} pessoa${n === 1 ? '' : 's'}, contando os subgrupos">${n}</span>
      </a>
    </div>
    ${filhos.length && aberto ? `<div class="gr-filhos">${filhos.map(f => admNoArvore(f, nivel + 1)).join('')}</div>` : ''}
  </div>`;
}
function admAlternarRamo(id){
  admGrupos.fechados.has(id) ? admGrupos.fechados.delete(id) : admGrupos.fechados.add(id);
  const arv = $('#gr-arvore'); if (arv) arv.innerHTML = admArvoreHTML();
}
function admArvoreHTML(){
  const html = admRaizes().map(g => admNoArvore(g, 0)).join('');
  return html || `<div class="muted small" style="padding:8px 6px">${admGrupos.filtro
    ? 'Nenhum grupo com esse nome.' : 'Nenhum grupo cadastrado.'}</div>`;
}
function admFiltrarArvore(v){
  admGrupos.filtro = v;
  const arv = $('#gr-arvore'); if (arv) arv.innerHTML = admArvoreHTML();
}

/* ---------------- a tela ---------------- */
function renderGrupos(){
  const alvo = $('#sec-grupos'); if (!alvo) return;
  const temArvore = admTemArvore();
  alvo.innerHTML = `
    ${temArvore ? '' : `<div class="aviso-box warn" style="margin-bottom:16px">
      <b>A árvore de grupos ainda não está no banco.</b> Sem a migração
      <code>db/v19_grupos_hierarquia.sql</code> os grupos continuam numa lista plana:
      dá para editar e pôr pessoas, mas não para pôr um grupo dentro de outro.</div>`}
    <div class="gr-lay">
      <div class="card gr-arv">
        <div class="gr-arv-topo">
          <input id="gr-filtro" type="search" placeholder="Filtrar grupos…" aria-label="Filtrar grupos"
            value="${esc(admGrupos.filtro)}" oninput="admFiltrarArvore(this.value)">
          ${ibtn('plus', 'Novo grupo', 'modalGrupo()', 'sm')}
        </div>
        <nav id="gr-arvore" aria-label="Árvore de grupos">${admArvoreHTML()}</nav>
      </div>
      <div id="gr-detalhe">${admDetalheHTML()}</div>
    </div>`;
}

function admDetalheHTML(){
  const g = admGrupo(admGrupos.sel);
  if (!g) return `<div class="vazio"><div class="glyph">∅</div><h3>Nenhum grupo ainda</h3>
    <p>Crie o primeiro grupo — depois dá para pôr outros dentro dele.</p>
    <button class="btn solid" onclick="modalGrupo()">Novo grupo</button></div>`;
  const temArvore = admTemArvore();
  const caminho = admCaminho(g);
  const filhos = admFilhos(g.id);
  const pessoas = admPessoasDo(g);
  const diretos = pessoas.filter(p => p.via === g.nome);
  const herdados = pessoas.filter(p => p.via !== g.nome);
  const resp = (g.responsaveis || []).map(r => state.membros.find(m => m.registro === r)).filter(Boolean);
  const lista = admGrupos.ver === 'ficha' ? diretos : admGrupos.ver === 'sub' ? herdados : pessoas;
  const chave = { pessoal:'Depto de Pessoal', projetos:'Pai dos projetos', pmo:'PMO' }[g.chave];

  return `<div class="card gr-det">
    ${caminho.length > 1 ? `<nav class="gr-caminho" aria-label="Caminho">${caminho.map((x, i) =>
      i < caminho.length - 1
        ? `<a href="#/admin/grupos/${encodeURIComponent(x.prefixo)}">${esc(x.nome)}</a><span aria-hidden="true">›</span>`
        : `<b>${esc(x.nome)}</b>`).join('')}</nav>` : ''}
    <div class="gr-cab">
      <h2>${esc(g.nome)}</h2>
      <span class="cod-pf${prefixoColide(g) ? ' colide' : ''}"
        ${prefixoColide(g) ? 'title="Outro grupo começa com o mesmo prefixo"' : 'title="Prefixo do código das atividades"'}>${esc(g.prefixo)}</span>
      ${chave ? `<span class="pill"><span class="dt dt-info"></span>${chave}</span>` : ''}
      ${g.quadro === false
        ? '<span class="pill"><span class="dt dt-gray"></span>Sem quadro</span>'
        : g.reservado
          ? '<span class="pill p-warn"><span class="dt dt-warn"></span>Quadro fechado</span>'
          : '<span class="pill"><span class="dt dt-ok"></span>Quadro aberto</span>'}
      ${g.ativo === false ? '<span class="pill p-bad"><span class="dt dt-bad"></span>Inativo</span>' : ''}
    </div>
    ${g.descricao ? `<p class="gr-desc">${esc(g.descricao)}</p>` : ''}
    <div class="acts" style="margin-top:14px">
      <button class="btn ghost mini" onclick="modalGrupo(${g.id})">${ic('pencil')} Editar</button>
      ${temArvore ? `<button class="btn ghost mini" onclick="modalGrupo(null, ${g.id})">${ic('plus')} Subgrupo</button>` : ''}
      ${g.quadro !== false ? `<button class="btn ghost mini" onclick="modalAcessoGrupo(${g.id})">${ic('key')} Quem enxerga o quadro</button>` : ''}
    </div>

    <div class="metricas gr-met">
      <div class="metrica"><span class="rot">Pessoas</span><span class="val">${pessoas.length}</span>
        <span class="var neutro">ativas ou em pausa</span></div>
      <div class="metrica"><span class="rot">Pela ficha</span><span class="val">${diretos.length}</span>
        <span class="var neutro">postas neste grupo</span></div>
      <div class="metrica"><span class="rot">Por subgrupo</span><span class="val">${herdados.length}</span>
        <span class="var neutro">vieram de baixo</span></div>
      <div class="metrica"><span class="rot">Subgrupos</span><span class="val">${filhos.length}</span>
        <span class="var neutro">logo abaixo</span></div>
    </div>

    ${temArvore ? `
    <div class="adm-grupo">Subgrupos</div>
    ${filhos.length ? `<div class="gr-sub">${filhos.map(f => `<a class="chip" href="#/admin/grupos/${encodeURIComponent(f.prefixo)}">
        ${esc(f.nome)} <span class="muted small">· ${admPessoasDo(f).length}</span></a>`).join('')}</div>`
      : `<p class="muted small">Nenhum. Quem entrar num subgrupo de ${esc(g.nome)} passa a estar também aqui.</p>`}

    <div class="adm-grupo">Responsáveis</div>
    ${resp.length ? `<div class="gr-sub">${resp.map(m => `<span class="chip mini" style="padding:4px 10px">${esc(m.nome)}</span>`).join('')}</div>
      <p class="muted small" style="margin-top:8px">Põem e tiram gente deste grupo e dos que estão abaixo dele.</p>`
      : `<p class="muted small">Só admin e Depto de Pessoal mexem em quem está aqui. Responsáveis se escolhem em Editar.</p>`}` : ''}

    <div class="adm-grupo">Pessoas</div>
    ${temArvore && herdados.length ? `<div class="seg" role="group" aria-label="Quais pessoas" style="margin-bottom:10px">
      ${[['todas', 'Todas', pessoas.length], ['ficha', 'Pela ficha', diretos.length], ['sub', 'Por subgrupo', herdados.length]]
        .map(([k, r, n]) => `<button class="${admGrupos.ver === k ? 'on' : ''}" aria-pressed="${admGrupos.ver === k}"
          onclick="admVerPessoas('${k}')">${r} · ${n}</button>`).join('')}</div>` : ''}
    <div class="gr-pessoas">${lista.map(({ m, via }) => `<div class="gr-pessoa">
        ${avatarFoto(m, 30, 11)}
        <div class="tx"><div class="nm">${esc(m.nome)}</div><div class="cg">${esc(m.cargo || '—')}${m.status !== 'Ativo' ? ' · em pausa' : ''}</div></div>
        ${via === g.nome
          ? `<span class="gr-via dir">pela ficha</span>${ibtn('x', 'Tirar de ' + esc(g.nome), `admTirarDoGrupo(${m.registro})`, 'perigo sm')}`
          : `<a class="gr-via" href="#/admin/grupos/${encodeURIComponent(grupoPrefixoDe(via))}"
               title="Está aqui por estar em ${esc(via)}">por ${esc(via)}</a>`}
      </div>`).join('') || `<p class="muted small">${admGrupos.ver === 'sub'
        ? 'Ninguém chegou por um subgrupo.' : 'Ninguém neste grupo ainda.'}</p>`}</div>

    <div class="adm-grupo">Pôr pessoas neste grupo</div>
    <div id="gr-add">${admAddHTML(g, pessoas)}</div>
  </div>`;
}
const grupoPrefixoDe = nome => admGrupos.lista.find(x => x.nome === nome)?.prefixo || '';
function admVerPessoas(k){ admGrupos.ver = k; const d = $('#gr-detalhe'); if (d) d.innerHTML = admDetalheHTML(); }

/* A lista de quem pode entrar: ativos e em pausa que ainda não estão no
   grupo pela ficha. Quem já está por um subgrupo aparece, com o aviso —
   pôr direto não muda nada hoje, mas segura a pessoa aqui se ela sair
   do subgrupo. */
function admCandidatos(g){
  const q = norm(admGrupos.busca);
  return (state.membros || [])
    .filter(m => ATIVOS_E_PAUSA.includes(m.status) && !(m.grupos || []).includes(g.nome))
    .filter(m => !q || [m.nome, m.cargo, m.departamento, ...(m.grupos || [])].some(x => norm(x).includes(q)))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}
function admAddHTML(g, pessoas){
  const ja = new Map((pessoas || admPessoasDo(g)).filter(p => p.via !== g.nome).map(p => [p.m.registro, p.via]));
  const cands = admCandidatos(g);
  const n = admGrupos.marcados.size;
  const outros = admGrupos.lista.filter(x => x.id !== g.id && x.ativo !== false).sort(admOrdem);
  return `<div class="gr-add-topo">
      <input id="gr-busca" type="search" placeholder="Buscar por nome, cargo, departamento ou grupo…"
        aria-label="Buscar pessoas" value="${esc(admGrupos.busca)}" oninput="admBuscarCandidatos(this.value)">
      <select aria-label="Marcar quem está em outro grupo" onchange="admMarcarDoGrupo(this.value); this.value=''">
        <option value="">Marcar todos de um grupo…</option>
        ${outros.map(x => `<option value="${x.id}">${esc(x.nome)}</option>`).join('')}
      </select>
    </div>
    <div class="gr-cands" id="gr-cands" role="group" aria-label="Pessoas para pôr no grupo">
      ${cands.map(m => `<label class="gr-cand">
        <input type="checkbox" ${admGrupos.marcados.has(m.registro) ? 'checked' : ''}
          onchange="admMarcar(${m.registro}, this.checked)">
        ${avatarFoto(m, 26, 10)}
        <span class="tx"><span class="nm">${esc(m.nome)}</span>
          <span class="cg">${esc(m.cargo || '—')}${ja.has(m.registro) ? ` · <span class="ja">já está por ${esc(ja.get(m.registro))}</span>` : ''}</span></span>
      </label>`).join('') || `<p class="muted small" style="padding:10px 0">${admGrupos.busca
        ? 'Ninguém com essa busca.' : 'Todo mundo que está ativo já está neste grupo.'}</p>`}
    </div>
    <div class="gr-add-barra">
      <span class="small muted">${n ? `${n} marcada${n > 1 ? 's' : ''}` : 'Marque quem entra.'}
        ${n ? ` · <button class="gr-limpa" onclick="admGrupos.marcados.clear(); admRedesenharAdd()">limpar</button>` : ''}</span>
      <button class="btn solid mini" id="gr-add-btn" ${n ? '' : 'disabled'} onclick="admPorNoGrupo()">
        ${ic('plus')} ${n ? `Pôr ${n} pessoa${n > 1 ? 's' : ''}` : 'Pôr no grupo'}</button>
    </div>`;
}
function admRedesenharAdd(){
  const g = admGrupo(admGrupos.sel), box = $('#gr-add'); if (!g || !box) return;
  const foco = document.activeElement?.id === 'gr-busca';
  const pos = foco ? document.activeElement.selectionStart : null;
  box.innerHTML = admAddHTML(g);
  if (foco){ const i = $('#gr-busca'); i.focus(); i.setSelectionRange(pos, pos); }
}
let _admBuscaT = null;
function admBuscarCandidatos(v){
  admGrupos.busca = v;
  clearTimeout(_admBuscaT); _admBuscaT = setTimeout(admRedesenharAdd, 120);
}
function admMarcar(reg, sim){
  sim ? admGrupos.marcados.add(reg) : admGrupos.marcados.delete(reg);
  const g = admGrupo(admGrupos.sel), barra = document.querySelector('#gr-add .gr-add-barra');
  if (!g || !barra) return;
  /* só a barra muda: redesenhar a lista tiraria a rolagem do lugar */
  const tmp = document.createElement('div'); tmp.innerHTML = admAddHTML(g);
  barra.replaceWith(tmp.querySelector('.gr-add-barra'));
}
function admMarcarDoGrupo(id){
  const g = admGrupo(admGrupos.sel), outro = admGrupo(Number(id)); if (!g || !outro) return;
  const vem = admPessoasDo(outro).map(p => p.m).filter(m => !(m.grupos || []).includes(g.nome));
  vem.forEach(m => admGrupos.marcados.add(m.registro));
  admGrupos.busca = '';
  admRedesenharAdd();
  toast(vem.length ? `${vem.length} pessoa${vem.length > 1 ? 's' : ''} de ${outro.nome} marcada${vem.length > 1 ? 's' : ''}.`
                   : `Todo mundo de ${outro.nome} já está em ${g.nome}.`);
}

async function admPorNoGrupo(){
  const g = admGrupo(admGrupos.sel); if (!g || !admGrupos.marcados.size) return;
  const regs = [...admGrupos.marcados];
  const b = $('#gr-add-btn'); if (b){ b.disabled = true; b.textContent = 'Pondo…'; }
  try{
    const { data, error } = await sb.rpc('grupo_membros_salvar', { p: { grupo_id: g.id, adicionar: regs } });
    if (error) throw error;
    if (data?.status === 'sem_permissao') return toast('Seu papel não põe gente neste grupo.', true);
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível pôr no grupo.'), true);
    admGrupos.marcados.clear(); admGrupos.busca = '';
    await admRecarregarFichas();
    const acima = admCaminho(g).slice(0, -1).map(x => x.nome).reverse();
    const n = data.adicionados ?? regs.length;
    toast(`${n} pessoa${n === 1 ? '' : 's'} em ${g.nome}` + (acima.length ? ` — e, por ele, em ${acima.join(' e ')}.` : '.'));
    renderGrupos();
  }catch(e){ admFalhaGrupo(e, 'Erro ao pôr no grupo'); }
  finally{ const x = $('#gr-add-btn'); if (x && admGrupos.marcados.size){ x.disabled = false; } }
}

async function admTirarDoGrupo(reg){
  const g = admGrupo(admGrupos.sel), m = state.membros.find(x => x.registro === reg); if (!g || !m) return;
  const acima = admCaminho(g).slice(0, -1).map(x => x.nome);
  if (!await confirma(`Tirar <b>${esc(m.nome)}</b> de <b>${esc(g.nome)}</b>?` + (acima.length
      ? `<br><span class="small muted">Sai também de ${acima.map(esc).join(', ')}, a menos que esteja lá por outro grupo.</span>` : ''), 'Tirar')) return;
  try{
    const { data, error } = await sb.rpc('grupo_membros_salvar', { p: { grupo_id: g.id, remover: [reg] } });
    if (error) throw error;
    if (data?.status === 'sem_permissao') return toast('Seu papel não tira gente deste grupo.', true);
    if (data?.status !== 'ok') return toast('Não foi possível tirar do grupo.', true);
    await admRecarregarFichas();
    toast(`${m.nome} saiu de ${g.nome}.`);
    renderGrupos();
  }catch(e){ admFalhaGrupo(e, 'Erro ao tirar do grupo'); }
}

/* Sem a v19, grupo_membros_salvar não existe: a tela diz qual migração
   falta, em vez de "function does not exist". */
function admFalhaGrupo(e, ctx){
  if (/grupo_membros_salvar|grupo_estrutura_salvar|does not exist|schema cache/i.test(e?.message || ''))
    return toast('Falta aplicar a migração db/v19_grupos_hierarquia.sql no banco.', true);
  falha(e, ctx);
}
/* O quadro, as fichas e o menu leem state.membros: depois de mexer em
   quem está onde, a memória precisa acompanhar o banco. */
async function admRecarregarFichas(){
  const r = await sb.from('membros').select('registro,grupos');
  (r.data || []).forEach(x => {
    const m = (state.membros || []).find(y => y.registro === x.registro);
    if (m) m.grupos = x.grupos;
  });
  desenharMenu();
}

/* ---------------- criar / editar ---------------- */
/* O prefixo sugerido sai do fim do nome, sem o NRO: NRO_PROJECT_NEBULA
   vira NEB, "Depto de Pessoal" vira PES. Só enquanto ninguém digitou. */
function admSugerirPrefixo(nome, id){
  const partes = String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[\s_\-.]+/).filter(p => p && p.toUpperCase() !== 'NRO');
  const base = (partes.pop() || '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
  if (base.length < 2) return '';
  let tenta = base, n = 1;
  while (admGrupos.lista.some(o => o.id !== id && o.prefixo === tenta)) tenta = base + (++n);
  return tenta;
}
function admPrefixoAuto(id){
  const pf = $('#gr-pref'); if (!pf || pf.dataset.mexido) return;
  pf.value = admSugerirPrefixo($('#gr-nome').value, id);
}

function modalGrupo(id, paiSugerido){
  const g = admGrupos.lista.find(x => x.id === id) ||
    { nome:'', prefixo:'', reservado:false, ativo:true, quadro:true, pai_id: paiSugerido ?? null, responsaveis:[] };
  const temArvore = admTemArvore();
  const proibidos = id ? admAbaixoTodos(id) : new Set();
  const pais = admGrupos.lista.filter(x => !proibidos.has(x.id)).sort(admOrdem);
  const rotuloPai = x => admCaminho(x).map(y => y.nome).join(' › ');
  admGrupos.respEd = [...(g.responsaveis || [])];

  abreModal(`<h3>${id ? 'Editar grupo' : paiSugerido ? 'Novo subgrupo' : 'Novo grupo'}</h3>
    <div class="form-grid">
      <div class="fld full"><label for="gr-nome">Nome</label>
        <input id="gr-nome" value="${esc(g.nome)}" placeholder="NRO_PROJECT_NEBULA"
          ${id ? '' : `oninput="admPrefixoAuto(null)"`}></div>
      <div class="fld"><label for="gr-pref">Prefixo do código</label>
        <input id="gr-pref" value="${esc(g.prefixo)}" maxlength="6" placeholder="NEB"
          oninput="this.dataset.mexido='1'" style="text-transform:uppercase;font-family:var(--fm)"></div>
      <div class="fld"><label for="gr-ordem">Ordem na lista</label>
        <input id="gr-ordem" type="number" value="${g.ordem ?? 0}"></div>
      ${temArvore ? `
      <div class="fld full"><label for="gr-pai">Dentro de</label>
        <select id="gr-pai"><option value="">— nenhum: fica na raiz —</option>
          ${pais.map(x => `<option value="${x.id}" ${x.id === g.pai_id ? 'selected' : ''}>${esc(rotuloPai(x))}</option>`).join('')}
        </select>
        <span class="mailer-sub tight">Quem estiver neste grupo passa a estar também no grupo de cima.</span></div>
      <div class="fld full"><div class="multi" style="max-height:none"><label class="check">
        <input type="checkbox" id="gr-quadro" ${g.quadro !== false ? 'checked' : ''}
          onchange="document.getElementById('gr-vis').hidden = !this.checked">
        <span><b style="color:var(--ink)">Tem quadro em Atividades</b><br>desmarque para grupo guarda-chuva,
          que existe só para dar acesso (NRO_PROJECTS, NRO_LEADERSHIP)</span></label></div></div>` : ''}
      <div class="fld full" id="gr-vis" ${g.quadro === false ? 'hidden' : ''}><label>Quem enxerga o quadro</label>
        <div class="multi" style="max-height:none">
          <label class="check"><input type="radio" name="gr-res" value="nao"
            ${g.reservado ? '' : 'checked'}><span><b style="color:var(--ink)">Aberto</b><br>
            toda a equipe lê as atividades; quem está no grupo edita</span></label>
          <label class="check"><input type="radio" name="gr-res" value="sim"
            ${g.reservado ? 'checked' : ''}><span><b style="color:var(--ink)">Fechado</b><br>
            só quem está no grupo, mais quem receber acesso. Todo mundo continua
            vendo que o quadro existe</span></label>
        </div></div>
      ${temArvore ? `
      <div class="fld full"><label for="gr-desc">Descrição</label>
        <textarea id="gr-desc" rows="2" placeholder="Para que serve o grupo">${esc(g.descricao || '')}</textarea></div>
      <div class="fld full"><label>Responsáveis</label>
        <div id="gr-resp">${admRespHTML()}</div>
        <span class="mailer-sub tight">Além de admin e Depto de Pessoal, põem e tiram gente deste grupo e dos de baixo.</span></div>` : ''}
      ${id ? `<div class="fld full"><label for="gr-ativo">Situação</label>
        <select id="gr-ativo"><option value="sim" ${g.ativo !== false ? 'selected' : ''}>Ativo</option>
          <option value="nao" ${g.ativo === false ? 'selected' : ''}>Inativo (some das listas e deixa de passar gente para cima)</option>
        </select></div>` : ''}
    </div>
    ${id ? `<p class="small muted" style="margin-top:12px;line-height:1.6">
      Renomear aqui <b>também corrige a ficha</b> de quem está no grupo, na mesma
      operação — o vínculo é por nome, e mudar só de um lado esvaziaria o grupo.</p>` : ''}
    <div class="acts" style="justify-content:space-between">
      ${id ? `<button class="btn ghost" onclick="modalFundirGrupo(${id})">Fundir com outro…</button>` : '<span></span>'}
      <span><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="gr-btn" onclick="salvarGrupo(${id ?? 'null'})">Salvar</button></span></div>`, 'largo');
  if (!id){ const n = $('#gr-nome'); if (n) n.focus(); }
}
function admRespHTML(){
  const nomes = admGrupos.respEd.map(r => state.membros.find(m => m.registro === r)).filter(Boolean);
  const fora = (state.membros || []).filter(m => ATIVOS_E_PAUSA.includes(m.status) && !admGrupos.respEd.includes(m.registro))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  return `<div class="pills-ed" style="cursor:default">
    ${nomes.map(m => `<span class="pill-ed">${esc(m.nome)}<button type="button" aria-label="Tirar ${esc(m.nome)}"
      onclick="admRespTirar(${m.registro})">×</button></span>`).join('')}
    <select aria-label="Adicionar responsável" onchange="admRespPor(this.value)"
      style="flex:1 1 160px;min-width:150px;border:none;background:none;height:28px;padding:0 4px;color:var(--muted)">
      <option value="">${nomes.length ? 'adicionar…' : 'escolha quem…'}</option>
      ${fora.map(m => `<option value="${m.registro}">${esc(m.nome)}</option>`).join('')}</select></div>`;
}
function admRespPor(v){ const r = Number(v); if (r && !admGrupos.respEd.includes(r)) admGrupos.respEd.push(r); $('#gr-resp').innerHTML = admRespHTML(); }
function admRespTirar(r){ admGrupos.respEd = admGrupos.respEd.filter(x => x !== r); $('#gr-resp').innerHTML = admRespHTML(); }

async function salvarGrupo(id){
  const p = {
    id, nome: $('#gr-nome').value.trim(),
    prefixo: $('#gr-pref').value.trim().toUpperCase(),
    ordem: parseInt($('#gr-ordem').value, 10) || 0,
    reservado: document.querySelector('input[name="gr-res"]:checked')?.value === 'sim'
  };
  const at = $('#gr-ativo'); if (at) p.ativo = at.value === 'sim';
  if (!p.nome)    return toast('O nome é obrigatório.', true);
  if (!/^[A-Z][A-Z0-9]{1,5}$/.test(p.prefixo))
    return toast('O prefixo vai de 2 a 6 caracteres, começando por letra — ORT, DP2.', true);
  const estrutura = admTemArvore() ? {
    pai_id: $('#gr-pai').value ? Number($('#gr-pai').value) : null,
    quadro: $('#gr-quadro').checked,
    descricao: $('#gr-desc').value,
    responsaveis: admGrupos.respEd
  } : null;

  const b = $('#gr-btn'); if (b){ b.disabled = true; b.textContent = 'Salvando…'; }
  try{
    const { data, error } = await sb.rpc('grupo_salvar', { p });
    if (error) throw error;
    if (data?.status === 'duplicado')
      return toast(`Já existe outro grupo com esse ${data.campo === 'nome' ? 'nome' : 'prefixo'}.`, true);
    if (data?.status === 'invalido')  return toast('Confira o ' + data.campo + '.', true);
    if (data?.status !== 'ok')        return toast('Não foi possível salvar.', true);
    if (estrutura){
      const r = await sb.rpc('grupo_estrutura_salvar', { p: { id: data.id, ...estrutura } });
      if (r.error) throw r.error;
      if (r.data?.status === 'ciclo')
        return toast('Esse grupo já está abaixo deste — pô-lo como pai fecharia um círculo.', true);
      if (r.data?.status !== 'ok') return toast('O grupo foi salvo, mas a posição na árvore não.', true);
    }
    fechaModal();
    const n = data.renomeados || 0;
    toast(n ? `Salvo. A ficha de ${n} pessoa${n>1?'s':''} foi corrigida junto.` : 'Grupo salvo.');
    admGrupos.pronto = false;
    await admRecarregarFichas();
    carregarGrupos();   /* o menu lê o catálogo da casca */
    const pref = p.prefixo;
    if (location.hash !== '#/admin/grupos/' + pref) location.hash = '#/admin/grupos/' + pref;
    else await admCarregarGrupos(pref, true);
  }catch(e){ admFalhaGrupo(e, 'Erro ao salvar'); }
  finally{ const x = $('#gr-btn'); if (x){ x.disabled = false; x.textContent = 'Salvar'; } }
}

/* --- fundir dois grupos que eram o mesmo escrito de dois jeitos --- */
function modalFundirGrupo(id){
  const g = admGrupos.lista.find(x => x.id === id); if (!g) return;
  const outros = admGrupos.lista.filter(x => x.id !== id);
  if (!outros.length) return toast('Não há outro grupo para fundir.', true);
  const filhos = admFilhos(id), pai = admGrupo(g.pai_id);
  abreModal(`<h3>Fundir grupo</h3>
    <p class="sub" style="margin-bottom:16px">As atividades de <b>${esc(g.nome)}</b> passam
      para o grupo escolhido e <b>ganham código novo</b>, com o prefixo dele. As pessoas
      também passam. O grupo <b>${esc(g.nome)}</b> deixa de existir.</p>
    <div class="form-grid">
      <div class="fld full"><label>Fundir ${esc(g.nome)} em</label>
        <select id="fu-alvo">${outros.map(x =>
          `<option value="${x.id}">${esc(x.nome)} (${esc(x.prefixo)})</option>`).join('')}</select></div>
    </div>
    ${filhos.length ? `<div class="aviso-box warn" style="margin-top:14px">Os subgrupos de ${esc(g.nome)}
      (${filhos.map(f => esc(f.nome)).join(', ')}) sobem um nível e ficam
      ${pai ? `debaixo de <b>${esc(pai.nome)}</b>` : 'na raiz'}. Depois, mova-os se precisar.</div>` : ''}
    <div class="aviso-box err" style="margin-top:14px">O código antigo de cada cartão
      fica no histórico, mas quem tiver anotado <code>${esc(g.prefixo)}-7</code> em algum
      lugar não vai mais encontrar por esse nome. Isto não se desfaz.</div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn perigo" id="fu-btn" onclick="fundirGrupo(${id})">Fundir</button></div>`);
}

async function fundirGrupo(de){
  const para = parseInt($('#fu-alvo').value, 10);
  const b = $('#fu-btn'); if (b){ b.disabled = true; b.textContent = 'Fundindo…'; }
  try{
    const { data, error } = await sb.rpc('grupo_fundir', { p: { de, para } });
    if (error) throw error;
    if (data?.status !== 'ok') return toast('Não foi possível fundir.', true);
    fechaModal();
    toast(`Fundido em ${data.nome}: ${data.atividades} atividade(s) e ${data.pessoas} pessoa(s).`);
    admGrupos.sel = para;
    await admRecarregarFichas();
    carregarGrupos();
    await admCarregarGrupos(null, true);
  }catch(e){ falha(e, 'Erro ao fundir'); }
  finally{ const x = $('#fu-btn'); if (x){ x.disabled = false; x.textContent = 'Fundir'; } }
}

/* --- quem enxerga --- */
const NIVEIS_GRUPO = [
  ['nenhum',  'Sem acesso',  'vê que o quadro existe, não vê as atividades'],
  ['leitura', 'Leitura',     'acompanha as atividades, não mexe'],
  ['edicao',  'Edição',      'cria, move e comenta, como quem está no grupo']
];

function modalAcessoGrupo(id){
  const g = admGrupos.lista.find(x => x.id === id); if (!g) return;
  admGrupos.abertoId = id;
  const noGrupo = admPessoasDo(g);
  const dentro = new Set(noGrupo.map(p => p.m.registro));
  const conc = admGrupos.acessos.filter(x => x.grupo_id === id);
  const nomeDe = r => (state.membros||[]).find(m => m.registro === r)?.nome || ('Registro ' + r);
  const fora = (state.membros || []).filter(m =>
    ATIVOS_E_PAUSA.includes(m.status) && !dentro.has(m.registro)
    && !conc.some(c => c.registro === m.registro));

  abreModal(`<h3>Quem enxerga ${esc(g.nome)}</h3>
    <p class="sub" style="margin-bottom:18px">${g.reservado
      ? 'Quadro fechado: só quem está na lista abaixo abre as atividades. Os demais veem que ele existe.'
      : 'Quadro aberto: <b>toda a equipe já lê</b> este quadro. Conceder acesso aqui só serve para dar <b>edição</b> a quem não está no grupo.'}</p>

    <div class="adm-grupo" style="margin-top:0">No grupo — edição</div>
    <div class="multi" style="max-height:170px">${noGrupo.map(({ m, via }) =>
      `<div class="acc-row" style="padding:6px 2px"><div class="nm">${esc(m.nome)}</div>
        <div class="mt">${esc(m.cargo || '')}</div><span class="muted small">${via === g.nome ? 'pela ficha' : 'por ' + esc(via)}</span></div>`
      ).join('') || '<div class="muted small">Ninguém no grupo ainda.</div>'}</div>

    <div class="adm-grupo">Acesso concedido</div>
    <div id="ac-lista">${conc.length ? conc.map(c => `
      <div class="acc-row" style="padding:6px 2px"><div class="nm">${esc(nomeDe(c.registro))}</div>
        <div class="mt"></div>
        <div style="display:flex;align-items:center;gap:8px">
          <select onchange="mudarAcessoGrupo(${c.registro}, this.value)"
            style="height:30px;padding:0 8px;font-size:12.5px">
            ${NIVEIS_GRUPO.filter(([k]) => k !== 'nenhum').map(([k, r]) =>
              `<option value="${k}" ${c.nivel===k?'selected':''}>${r}</option>`).join('')}
          </select>
          ${ibtn('x','Tirar o acesso', `mudarAcessoGrupo(${c.registro}, 'nenhum')`, 'perigo sm')}
        </div></div>`).join('')
      : '<div class="muted small">Ninguém de fora do grupo tem acesso.</div>'}</div>

    <div class="adm-grupo">Conceder a</div>
    <div class="form-grid">
      <div class="fld"><label>Pessoa</label>
        <select id="ac-quem"><option value="">— escolha —</option>
          ${fora.map(m => `<option value="${m.registro}">${esc(m.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Nível</label>
        <select id="ac-nivel">${NIVEIS_GRUPO.filter(([k]) => k !== 'nenhum').map(([k, r, d]) =>
          `<option value="${k}" title="${esc(d)}">${r}</option>`).join('')}</select></div>
    </div>
    <div class="acts" style="justify-content:space-between">
      <button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <button class="btn solid" id="ac-btn" onclick="concederAcessoGrupo()">Conceder</button></div>`, true);
}

async function concederAcessoGrupo(){
  const registro = parseInt($('#ac-quem').value, 10);
  if (!registro) return toast('Escolha a pessoa.', true);
  await mudarAcessoGrupo(registro, $('#ac-nivel').value);
}

async function mudarAcessoGrupo(registro, nivel){
  const grupo_id = admGrupos.abertoId;
  try{
    const { data, error } = await sb.rpc('grupo_acesso_salvar', { p: { grupo_id, registro, nivel } });
    if (error) throw error;
    if (data?.status === 'sem_permissao') return toast('Seu papel não concede acesso a quadro.', true);
    if (data?.status !== 'ok')            return toast('Não foi possível salvar.', true);
    const { data: acc } = await sb.from('grupo_acessos').select('*');
    admGrupos.acessos = acc || [];
    renderGrupos();
    modalAcessoGrupo(grupo_id);
    toast(nivel === 'nenhum' ? 'Acesso retirado.' : 'Acesso concedido.');
  }catch(e){ falha(e, 'Erro ao salvar o acesso'); }
}

registrarBusca({
  fonte:'grupos', rotulo:'Grupos',
  buscar: (t) => can()
    ? filtrarSimples(admGrupos.lista.map(g => ({
        codigo: g.prefixo, titulo: g.nome,
        sub: [admCaminho(g).slice(0, -1).map(x => x.nome).join(' › '),
              g.quadro === false ? 'sem quadro' : g.reservado ? 'quadro fechado' : 'quadro aberto']
             .filter(Boolean).join(' · '),
        href: '#/admin/grupos/' + encodeURIComponent(g.prefixo) })), t, 5)
    : []
});
