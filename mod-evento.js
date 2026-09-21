/* ============================================================
   MÓDULO · DOSSIÊ DO EVENTO
   Carregado sob demanda em #/agenda/evento/<id>. Script clássico,
   não módulo ES — os handlers são onclick="…".

   Veio de Operações → Eventos, no SOMA. Lá era uma tela separada,
   com lista própria: a equipe marcava um compromisso na agenda e
   preparava o evento em outro lugar, sobre a mesma linha de
   `eventos`. Aqui é a profundidade de um item da agenda — a lista
   é a própria agenda, e o dossiê é o que se abre quando o
   compromisso precisa de preparo, presença e ata.

   Preparação (checklist) e Execução (presenças, pauta,
   deliberações e a ata em PDF).

   Depende da casca para: sb, $, esc, state, can, toast, abreModal,
   fechaModal, fmtD, hojeISO, pad3, nomeDe, quemSouEu, ic, ibtn,
   carregarModulo, registrarBusca, filtrarSimples.
   ============================================================ */

const evento = { ev:null, parts:[], chk:[], aba:'prep' };

const ST_EVENTO = { 'Preparação':'p-info', 'Realizado':'p-ok', 'Cancelado':'' };
const DOT_EVENTO = { 'Preparação':'dt-info', 'Realizado':'dt-ok', 'Cancelado':'dt-gray' };

/* Quem organiza (ou o Depto. de Pessoal) mexe; o resto lê. */
const mexoNoEvento = () => can() ||
  (state.perfil?.registro != null && evento.ev?.owner_registro === state.perfil.registro);

/* ============================================================
   ROTA — #/agenda/evento/<id>
   ============================================================ */
async function pageEvento(id){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando o evento…</div>`;
  try{
    const [e1, e2, e3] = await Promise.all([
      sb.from('eventos').select('*').eq('id', id).single(),
      sb.from('evento_participantes').select('*, membro:membros(nome, cargo)').eq('evento_id', id),
      sb.from('evento_checklist').select('*').eq('evento_id', id).order('ordem')
    ]);
    if (e1.error) throw e1.error;
    const parts = (e2.data || []).sort((a,b) =>
      (a.membro?.nome||'').localeCompare(b.membro?.nome||'', 'pt-BR'));
    evento.ev = e1.data; evento.parts = parts; evento.chk = e3.data || []; evento.aba = 'prep';
    renderEvento();
  }catch(e){
    $('#main').innerHTML = `<div class="topo-gestao"><div class="tx">
      <span class="eyebrow">Agenda</span><h1>Evento não encontrado</h1>
      <p class="lead">${esc(e.message || 'Talvez você não possa vê-lo, ou ele foi removido.')}</p></div></div>
      <div class="acts"><a class="btn ghost" href="#/agenda">Voltar à agenda</a></div>`;
  }
}

function renderEvento(){
  const { ev, parts, chk, aba } = evento;
  const feitos = chk.filter(c => c.feito).length;
  const podeMexer = mexoNoEvento();

  $('#main').innerHTML = `
    <div class="topo-gestao">
      <div style="padding-top:34px"><a class="icon-btn" href="#/agenda" title="Voltar à agenda"
        aria-label="Voltar à agenda"><svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.7" stroke-linecap="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></a></div>
      <div class="tx"><span class="eyebrow">Agenda · EVT-${pad3(ev.numero)}</span>
        <h1>${esc(ev.titulo)}</h1>
        <p class="lead">${esc(ev.tipo || 'Compromisso')} · ${fmtD(ev.data)}${ev.hora ? ' · ' + esc(ev.hora) : ''}</p></div>
      ${podeMexer ? `<div class="acoes"><button class="btn ghost" onclick="modalCancelar('${ev.id}')">Cancelar compromisso</button></div>` : ''}
    </div>

    <div class="card" style="margin-bottom:16px"><div class="dl">
      <div class="it"><dt>Tipo</dt><dd>${esc(ev.tipo) || '<span class="muted">—</span>'}</dd></div>
      <div class="it"><dt>Quando</dt><dd>${fmtD(ev.data)}${ev.hora ? ' · ' + esc(ev.hora) : ''}</dd></div>
      <div class="it"><dt>Onde</dt><dd>${esc(ev.local) || '<span class="muted">—</span>'}</dd></div>
      <div class="it"><dt>Repete</dt><dd>${esc(ev.recorrencia || 'Não repete')}</dd></div>
      <div class="it"><dt>Organizador</dt>
        <dd>${esc(ev.owner_registro ? (nomeDe(ev.owner_registro) || '—') : '—')}</dd></div>
      <div class="it"><dt>Convidados</dt><dd>${parts.length} pessoa(s)${
        (ev.grupos||[]).length ? ' · ' + (ev.grupos||[]).map(g=>`<span class="chip mini">${esc(g)}</span>`).join(' ') : ''}</dd></div>
      <div class="it"><dt>Situação</dt><dd>${podeMexer
        ? `<select style="max-width:190px" onchange="mudarStatusEvento(this.value)">${
            ['Preparação','Realizado','Cancelado'].map(s =>
              `<option ${ev.status===s?'selected':''}>${s}</option>`).join('')}</select>`
        : `<span class="pill ${ST_EVENTO[ev.status]||''}"><span class="dt ${DOT_EVENTO[ev.status]||'dt-gray'}"></span>${esc(ev.status||'—')}</span>`
      }</dd></div>
      ${ev.meet_url ? `<div class="it full"><dt>Chamada</dt><dd><a href="${esc(ev.meet_url)}"
        target="_blank" rel="noopener" style="color:var(--teal);text-decoration:underline">${esc(ev.meet_url)}</a></dd></div>` : ''}
    </div></div>

    <nav class="abas">
      <button class="aba ${aba==='prep'?'on':''}" onclick="evento.aba='prep';renderEvento()">Preparação (${feitos}/${chk.length})</button>
      <button class="aba ${aba==='exec'?'on':''}" onclick="evento.aba='exec';renderEvento()">Execução</button>
    </nav>
    <div id="ev-body"></div>`;

  aba === 'prep' ? abaPreparacao(podeMexer) : abaExecucao(podeMexer);
}

/* ---------------- preparação: o checklist ---------------- */
function abaPreparacao(podeMexer){
  const { chk } = evento;
  const feitos = chk.filter(c => c.feito).length;
  const pct = chk.length ? Math.round(feitos / chk.length * 100) : 0;
  $('#ev-body').innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:6px">
      <div><h3>Preparação</h3><p class="sub">O que precisa estar pronto antes</p></div>
      ${podeMexer ? ibtn('plus','Adicionar item','modalItemChecklist()','primary sm') : ''}
    </div>
    <div class="barra" style="grid-template-columns:1fr 54px;margin:16px 0 18px">
      <span class="trilho"><span class="fill" style="width:${pct}%"></span></span>
      <span class="n">${feitos}/${chk.length}</span>
    </div>
    ${chk.length ? `<div class="chk-lista">${chk.map(c => `
      <label class="chk-row ${c.feito?'feito':''}">
        <input type="checkbox" ${c.feito?'checked':''} ${podeMexer?'':'disabled'}
          onchange="toggleChecklist('${c.id}', this.checked)">
        <span>${esc(c.item)}</span>
        ${podeMexer ? `<button class="chk-x" title="Remover"
          onclick="event.preventDefault();removerItemChecklist('${c.id}')">×</button>` : ''}
      </label>`).join('')}</div>`
      : `<div class="vazio"><div class="glyph">✓</div><h3>Checklist vazio</h3>
         <p>O checklist vem do tipo do evento. Se este não trouxe nenhum,
         ${podeMexer ? 'adicione os itens com o botão +' : 'peça a quem organiza para montá-lo'}.</p></div>`}
    <p class="small muted" style="margin-top:14px;line-height:1.6">Os itens vêm do catálogo de
      tipos de evento (<span class="mono">evento_tipos</span>) — criar um tipo com checklist novo
      é uma linha no banco, não um deploy.</p>
  </div>`;
}

function modalItemChecklist(){
  abreModal(`<h3>Adicionar ao checklist</h3>
    <div class="fld"><label>Item</label>
      <input id="ck-novo" placeholder="ex.: Confirmar o equipamento de projeção"></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="salvarItemChecklist()">Adicionar</button></div>`);
  setTimeout(() => $('#ck-novo')?.focus(), 50);
}
async function salvarItemChecklist(){
  const item = $('#ck-novo').value.trim(); if (!item) return;
  try{
    const maxOrd = Math.max(0, ...evento.chk.map(c => c.ordem || 0));
    const { data, error } = await sb.from('evento_checklist')
      .insert({ evento_id: evento.ev.id, item, ordem: maxOrd + 10 }).select('*').single();
    if (error) throw error;
    evento.chk.push(data); fechaModal(); renderEvento();
  }catch(e){ falhaEvento(e, 'Erro ao adicionar'); }
}
async function toggleChecklist(id, feito){
  try{
    const { error } = await sb.from('evento_checklist').update({ feito }).eq('id', id);
    if (error) throw error;
    const c = evento.chk.find(x => x.id === id); if (c) c.feito = feito;
    renderEvento();
  }catch(e){ falhaEvento(e, 'Erro ao atualizar'); }
}
async function removerItemChecklist(id){
  try{
    const { error } = await sb.from('evento_checklist').delete().eq('id', id);
    if (error) throw error;
    evento.chk = evento.chk.filter(x => x.id !== id);
    renderEvento();
  }catch(e){ falhaEvento(e, 'Erro ao remover'); }
}

/* ---------------- execução: presenças, pauta, ata ---------------- */
function abaExecucao(podeMexer){
  const { ev, parts } = evento;
  const presentes = parts.filter(p => p.presente === true).length;
  const RSVP = { vou:'Vou', talvez:'Talvez', nao:'Não vou' };
  $('#ev-body').innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <h3>Presenças</h3>
      <p class="sub" style="margin-bottom:16px">${presentes} presente(s) de ${parts.length} convidado(s)</p>
      ${parts.length ? `<div class="wrap"><table class="tabela trabalho">
        <thead><tr><th>Participante</th><th>Cargo</th><th style="width:96px">Convite</th>
          <th style="width:190px;text-align:right">Presença</th></tr></thead>
        <tbody>${parts.map(p => `<tr>
          <td class="nome">${esc(p.membro?.nome || 'Reg. ' + p.registro)}</td>
          <td>${esc(p.membro?.cargo || '—')}</td>
          <td>${RSVP[p.resposta] || '<span class="muted">—</span>'}</td>
          <td style="text-align:right">${podeMexer ? `<span class="seg">
            <button class="${p.presente===true?'on-ok':''}" onclick="setPresenca('${p.id}', true)">Presente</button>
            <button class="${p.presente===false?'on-bad':''}" onclick="setPresenca('${p.id}', false)">Ausente</button>
          </span>` : (p.presente === true ? 'Presente' : p.presente === false ? 'Ausente' : '—')}</td>
        </tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Ninguém foi convidado ainda.</div>'}
    </div>

    <div class="card" style="margin-bottom:16px"><h3>Pauta</h3>
      <p class="sub" style="margin-bottom:14px">Um item por linha</p>
      <textarea id="ev-pauta" rows="5" ${podeMexer?'':'disabled'}
        placeholder="Itens de pauta, um por linha…">${esc(ev.pauta || '')}</textarea></div>

    <div class="card" style="margin-bottom:16px"><h3>Deliberações</h3>
      <p class="sub" style="margin-bottom:14px">O que foi decidido, quem faz e até quando</p>
      <textarea id="ev-delib" rows="5" ${podeMexer?'':'disabled'}
        placeholder="Decisões tomadas, responsáveis e prazos…">${esc(ev.deliberacoes || '')}</textarea></div>

    ${podeMexer ? `<div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="salvarExecucao(false)">Salvar</button>
      <button class="btn solid" onclick="salvarExecucao(true)">Salvar e gerar a ata</button></div>` : ''}`;
}

async function setPresenca(id, v){
  try{
    const p = evento.parts.find(x => x.id === id);
    const novo = (p && p.presente === v) ? null : v;   /* clicar de novo desmarca */
    const { error } = await sb.from('evento_participantes').update({ presente: novo }).eq('id', id);
    if (error) throw error;
    if (p) p.presente = novo;
    renderEvento();
  }catch(e){ falhaEvento(e, 'Erro ao marcar presença'); }
}
async function mudarStatusEvento(s){
  try{
    const { error } = await sb.from('eventos').update({ status: s }).eq('id', evento.ev.id);
    if (error) throw error;
    evento.ev.status = s; toast('Situação atualizada.');
  }catch(e){ falhaEvento(e, 'Erro ao atualizar'); }
}
async function salvarExecucao(gerarDepois){
  const ev = evento.ev;
  try{
    const pauta = $('#ev-pauta').value.trim() || null;
    const deliberacoes = $('#ev-delib').value.trim() || null;
    const { error } = await sb.from('eventos').update({ pauta, deliberacoes }).eq('id', ev.id);
    if (error) throw error;
    ev.pauta = pauta; ev.deliberacoes = deliberacoes;
    toast('Salvo.');
    if (gerarDepois) await gerarAta();
  }catch(e){ falhaEvento(e, 'Erro ao salvar'); }
}

/* A ata é papel: sai clara, com o modelo de documento da NRO. O jsPDF
   vem do módulo de relatórios, carregado só agora. */
async function gerarAta(){
  if (typeof pdfNovo !== 'function'){
    toast('Preparando a ata…');
    try { await carregarModulo('relatorios'); }
    catch(e){ toast('Não foi possível carregar o gerador de PDF.', true); return; }
  }
  try{
    await precisaPDF();
    const { ev, parts } = evento;
    const doc = pdfNovo();
    let y = pdfCabecalho(doc, 'ATA — ' + String(ev.titulo).toUpperCase(),
      `Registro EVT-${pad3(ev.numero)} · ${ev.tipo || '—'} · ${fmtD(ev.data)}`
      + `${ev.hora ? ' às ' + ev.hora : ''}${ev.local ? ' · ' + ev.local : ''}`
      + ` · Organizador: ${ev.owner_registro ? (nomeDe(ev.owner_registro) || '—') : '—'}`);
    y = pdfBloco(doc, y + 2, 'PAUTA', ev.pauta);
    y = pdfBloco(doc, y, 'DELIBERAÇÕES', ev.deliberacoes);
    if (y > doc.internal.pageSize.getHeight() - 50){ doc.addPage(); y = 16; }
    doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(29,29,31);
    doc.text('PRESENÇAS', 12, y);
    doc.autoTable({ startY:y+3, theme:'striped',
      head:[['Participante','Situação']],
      body: parts.map(p => [p.membro?.nome || ('Reg. ' + p.registro),
        p.presente === true ? 'Presente' : (p.presente === false ? 'Ausente' : '—')]),
      styles:{ font:'helvetica', fontSize:9, cellPadding:2, textColor:[29,29,31] },
      headStyles:{ fillColor:[29,29,31], textColor:[245,245,247], fontSize:9 },
      alternateRowStyles:{ fillColor:[246,246,248] }, margin:{ left:12, right:12 } });
    let fy = doc.lastAutoTable.finalY + 20;
    if (fy > doc.internal.pageSize.getHeight() - 25){ doc.addPage(); fy = 36; }
    doc.setDrawColor(29,29,31); doc.setLineWidth(.3); doc.line(12, fy, 95, fy);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text(`${ev.owner_registro ? (nomeDe(ev.owner_registro) || '') : ''} — Organizador`, 12, fy+5);
    pdfRodape(doc, `SOMA · Ata do evento EVT-${pad3(ev.numero)} · gerada por ${quemSouEu()} `
      + `em ${new Date().toLocaleDateString('pt-BR')}`);
    doc.save(`NRO-EVT-${pad3(ev.numero)}_ATA_${hojeISO()}.pdf`);
    toast('Ata gerada.');
  }catch(e){ falhaEvento(e, 'Erro ao gerar a ata'); }
}

function falhaEvento(e, ctx){
  console.error(ctx, e);
  toast((ctx ? ctx + ': ' : '') + (e?.message || 'erro inesperado'), true);
}
