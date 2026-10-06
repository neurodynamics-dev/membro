/* ============================================================
   MÓDULO · RELATÓRIOS
   As listas e documentos que a gestão gera: portaria, assinatura
   em evento, e-mails, autorizados e quadro completo. Carregado sob
   demanda em #/admin/relatorios. O Full mailer mora em mod-mailer
   (#/admin/emails) desde a 30.0; o tile daqui leva até lá.

   É aqui que moram as bibliotecas pesadas. No SOMA, xlsx, jsPDF e
   autotable vinham no <head> — quase 1,3 MB baixados em todo
   login, para todo papel, por causa de telas que a maioria nunca
   abre. Agora quem as puxa é a função que precisa delas, e só na
   primeira vez.

   SUPERFÍCIE CLARA DE PROPÓSITO: tudo o que sai daqui é impresso
   ou colado em e-mail. PDF e mailer continuam claros, com Aura,
   Blackout e Cortex — escurecer seria errado, não "consistente".

   Depende da casca para: sb, $, esc, norm, state, can, podeSelecao,
   toast, abreModal, fechaModal, fmtD, hojeISO, pad3, nomeDe,
   quemSouEu, carregarLib, registrarBusca, filtrarSimples, copiar,
   abrirEmail, gmailCompose, marcados, gruposEfetivos, gruposDaEquipe, dica.
   ============================================================ */

const CDN_JSPDF     = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const CDN_AUTOTABLE = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js';
const CDN_XLSX      = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';

/* O autotable precisa do jsPDF já no ar: carrega em ordem, não em paralelo. */
async function precisaPDF(){
  if (!window.jspdf) await carregarLib(CDN_JSPDF);
  if (!window.jspdf?.jsPDF?.API?.autoTable) await carregarLib(CDN_AUTOTABLE);
  if (!LOGO_PDF) await carregarLogoPDF();
}
async function precisaXLSX(){
  if (!window.XLSX) await carregarLib(CDN_XLSX);
}
/* Avisa enquanto a biblioteca desce — na primeira vez leva um instante. */
async function comLib(carregar, fn){
  const t = setTimeout(() => toast('Preparando…'), 400);
  try { await carregar(); clearTimeout(t); return await fn(); }
  catch(e){ clearTimeout(t); toast('Não foi possível carregar a ferramenta: ' + (e.message||''), true); }
}

/* A logo em PNG, usada no cabeçalho dos PDFs. */
let LOGO_PDF = null;
async function carregarLogoPDF(){
  try{
    const r = await fetch(LOGO_URL); if(!r.ok) return;
    const b = await r.blob();
    const dataURL = await new Promise((res,rej)=>{ const fr=new FileReader();
      fr.onload=()=>res(fr.result); fr.onerror=rej; fr.readAsDataURL(b); });
    const img = new Image();
    await new Promise((res,rej)=>{ img.onload=res; img.onerror=rej; img.src=dataURL; });
    LOGO_PDF = {dados:dataURL, prop: img.naturalWidth/img.naturalHeight};
  }catch(e){ /* sem a logo, o PDF usa o símbolo desenhado como reserva */ }
}

/* A foto do membro, para o cabeçalho do relatório. A casca tem avatarFoto
   (que devolve marcação); o PDF precisa só da URL. */
const fotoDe = (m) => m && (m.foto_url || (m.registro != null ? FOTOS_BASE + m.registro + '.jpg' : null));

const LOCAIS_PORTARIA = ['PORTARIA PRINCIPAL (HALL)','PORTARIA DO GALPÃO DA MECÂNICA'];

/* ============================================================
   A GALERIA — #/admin/relatorios
   ============================================================ */
function pageRelatorios(){
  const tiles = [];
  const t = (i,tt,td,fn) => tiles.push([i,tt,td,fn]);
  if (podeVerFicha()){
    t('door','Lista para a portaria','Autorização de entrada na Escola de Engenharia, com espaço para assinatura e envio à SLOG.','modalPortaria()');
    t('clip','Lista de assinatura em evento','Presença dos ativos para imprimir, com nome do evento e data.','modalAssinatura()');
  }
  t('mail','Lista de e-mails','E-mails por grupo e status.','modalEmails()');
  if (podeSelecao())
    t('flag','E-mails dos candidatos','Candidatos do processo seletivo, por status.','modalEmailsCandidatos()');
  /* o Full mailer ganhou tela própria (v30), com envio programado e as
     pílulas de conhecimento: o tile leva até lá */
  t('mailer','Full mailer','E-mail no padrão NeuroDynamics, com a cor da área que assina. Abre em E-mails.',"location.hash='#/admin/emails'");
  /* Estes dois expõem o quadro inteiro — quem tem acesso a quê e a
     exportação geral. Ficam com podeVerFicha() (admin, pessoal, liderança): a Comissão de Seleção precisa
     dos e-mails dos candidatos, não do efetivo. */
  if (podeVerFicha()){
    t('key','Lista de autorizados','Quem tem acesso ativo a um sistema, local ou documento, em PDF.','modalAutorizados()');
    t('down','Quadro completo','Exportação geral do quadro em Excel ou PDF, com filtros.','modalQuadro()');
  }

  $('#sec-relatorios').innerHTML = `
    <p class="sub" style="margin-bottom:18px">Tudo daqui sai para imprimir ou colar em e-mail —
      por isso continua em superfície clara, e não no escuro da tela.</p>
    <div class="gal">${tiles.map(([i,tt,td,fn]) =>
      `<button class="tile" onclick="${fn}"><span class="sq">${icRel(i)}</span>
        <span class="tt">${tt}</span><span class="td">${td}</span></button>`).join('')}</div>`;
}

const ICONES_REL = {
  door:'<path d="M4 21h16M6 21V4.5h9V21M15 8h3.5V21"/><circle cx="12.3" cy="12.8" r=".7"/>',
  clip:'<rect x="6" y="4.5" width="12" height="16.5" rx="2"/><path d="M9.5 4.5a2.5 2.5 0 0 1 5 0M9.5 11h5M9.5 15h5"/>',
  mail:'<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 5.8 7.5-5.8"/>',
  flag:'<path d="M6 21V4.5"/><path d="M6 5c4-2.2 7 2 11 .2V13c-4 1.8-7-2.4-11-.2"/>',
  mailer:'<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="m4.5 7 7.5 5.4L19.5 7"/><path d="M7 15.5h5"/>',
  key:'<circle cx="8.5" cy="14.5" r="4.5"/><path d="M12 11.5 20 4M17 6.5l2.5 2.5M14.5 9l2 2"/>',
  down:'<path d="M12 4v11M6.5 10.5 12 16l5.5-5.5M5 20h14"/>'
};
const icRel = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
  stroke-linecap="round" stroke-linejoin="round">${ICONES_REL[n]||''}</svg>`;

function grupoCheckboxes(idPrefix, selecionados){
  const gs = gruposDaEquipe();
  if(!gs.length) return '<div class="muted small">Nenhum grupo cadastrado no quadro.</div>';
  return `<div class="multi">${gs.map((g,i)=>`<label class="check">
    <input type="checkbox" class="${idPrefix}" value="${esc(g)}" ${selecionados&&selecionados.includes(g)?'checked':''}> ${esc(g)}</label>`).join('')}</div>`;
}
/* ---------------- PDF: modelo de documento NRO ---------------- */
function pdfNovo(orient){ const {jsPDF}=window.jspdf; return new jsPDF({orientation:orient||'portrait',unit:'mm',format:'a4'}); }
function desenhaLogo(doc,x,y,s,cor){
  doc.setFillColor(cor[0],cor[1],cor[2]);
  doc.circle(x+s*0.33, y+s*0.5, s*0.24, 'F');
  doc.circle(x+s*0.8,  y+s*0.26, s*0.13, 'F');
  doc.circle(x+s*0.8,  y+s*0.74, s*0.13, 'F');
  doc.setDrawColor(cor[0],cor[1],cor[2]); doc.setLineWidth(s*0.075);
  doc.line(x+s*0.5, y+s*0.42, x+s*0.68, y+s*0.31);
  doc.line(x+s*0.5, y+s*0.58, x+s*0.68, y+s*0.69);
}
function pdfCabecalho(doc, titulo, subtitulo, codigo){
  const W = doc.internal.pageSize.getWidth();
  // Modelo NRO-PUB-002: logo à esquerda; à direita, alinhado à direita:
  // Departamento (negrito) / [Título do documento ou registro] / código Rev.
  if(LOGO_PDF){
    const h = 8, w = Math.min(h*LOGO_PDF.prop, 68);
    doc.addImage(LOGO_PDF.dados, 'PNG', 12, 9, w, h);
  } else {
    desenhaLogo(doc, 12, 9, 8, [29,29,31]);
    doc.setTextColor(29,29,31); doc.setFont('helvetica','bold'); doc.setFontSize(11.5);
    doc.text('NeuroDynamics', 21.5, 14.6);
  }
  doc.setTextColor(29,29,31); doc.setFontSize(9.5);
  doc.setFont('helvetica','normal');
  let tt = titulo;
  while(tt.length>10 && doc.getTextWidth(tt) > W-108) tt = tt.slice(0,-2);
  if(tt !== titulo) tt = tt.trim()+'…';
  doc.setFont('helvetica','bold');
  doc.text('Departamento de Pessoal', W-12, 10.8, {align:'right'});
  doc.setFont('helvetica','normal');
  doc.text(tt, W-12, 15, {align:'right'});
  doc.text(codigo || 'SOMA 5.0', W-12, 19.2, {align:'right'});
  // Título principal no corpo do documento
  let y = 33;
  doc.setFont('helvetica','bold'); doc.setFontSize(15);
  const tl = doc.splitTextToSize(titulo, W-24);
  doc.text(tl, 12, y); y += tl.length*6.6 + 1.5;
  if(subtitulo){
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(96,96,99);
    const ls = doc.splitTextToSize(subtitulo, W-24);
    doc.text(ls, 12, y); y += ls.length*4.2 + 2;
  }
  doc.setTextColor(29,29,31);
  return y + 3;
}
function pdfRodape(doc, texto){
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const total = doc.getNumberOfPages();
  for(let i=1;i<=total;i++){
    doc.setPage(i); doc.setFontSize(7.5); doc.setTextColor(110,110,115);
    doc.text(texto || `SOMA, uso interno, gerado por ${quemSouEu()} em ${new Date().toLocaleDateString('pt-BR')}`, 12, H-8);
    doc.text(`Página ${i} de ${total}`, W-12, H-8, {align:'right'});
  }
}
function pdfBloco(doc, y, titulo, texto){
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  if(y > H-35){ doc.addPage(); y = 16; }
  doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(29,29,31);
  doc.text(titulo, 12, y); y += 5.5;
  doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(60,60,64);
  const ls = doc.splitTextToSize(texto || '—', W-24);
  for(const linha of ls){
    if(y > H-18){ doc.addPage(); y = 16; }
    doc.text(linha, 12, y); y += 4.5;
  }
  return y + 5;
}
async function buscarMatriculas(regs){
  const map = new Map();
  for(let i=0;i<regs.length;i+=100){
    const {data, error} = await sb.from('dados_pessoais').select('registro, matricula').in('registro', regs.slice(i,i+100));
    if(error) throw error;
    (data||[]).forEach(d=> map.set(d.registro, d.matricula));
  }
  return map;
}
function statusCheckboxes(cls, iniciaisSel){
  return `<div class="multi" style="max-height:none">${STATUS_LIST.map(s=>`<label class="check">
    <input type="checkbox" class="${cls}" value="${s}" ${iniciaisSel.includes(s)?'checked':''}> ${s}</label>`).join('')}</div>`;
}
function filtraPorSelecao(sts, grupos){
  return state.membros.filter(m=>
    (!sts.length || sts.includes(m.status)) &&
    (!grupos.length || grupos.some(g => gruposEfetivos(m).has(g)))
  ).sort((a,b)=>a.nome.localeCompare(b.nome, 'pt-BR'));
}

function secaoTabela(doc, y, titulo, head, body, colStyles){
  const H = doc.internal.pageSize.getHeight();
  if(y > H-40){ doc.addPage(); y = 16; }
  doc.setFont('helvetica','bold'); doc.setFontSize(10.5); doc.setTextColor(29,29,31);
  doc.text(titulo, 12, y);
  doc.autoTable({ startY:y+2.5, head:head||undefined, body, theme:'striped',
    styles:{font:'helvetica', fontSize:8.5, cellPadding:1.8, textColor:[29,29,31]},
    headStyles:{fillColor:[29,29,31], textColor:[245,245,247], fontSize:8.5},
    alternateRowStyles:{fillColor:[246,246,248]},
    columnStyles:colStyles||{}, margin:{left:12,right:12} });
  return doc.lastAutoTable.finalY + 8;
}
async function gerarRelatorioMembro(){
  try{
    const m = membroAtual(); if(!m) return;
    const f = gestao.ficha;
    const temPess = podeVerFicha() && !!f.pess;
    const doc = pdfNovo();
    let y = pdfCabecalho(doc, 'FICHA DO MEMBRO: '+m.nome.toUpperCase(),
      `Registro ${pad3(m.registro)}, ${m.status}, Emitida em ${new Date().toLocaleDateString('pt-BR')}`
      + (temPess?', CONFIDENCIAL: dados pessoais protegidos pela LGPD':''));
    const fu = fotoDe(m);
    if (fu){ try{
      const bl = await (await fetch(fu)).blob();
      if (bl.type.startsWith('image/')){
        const du = await new Promise(res=>{const r=new FileReader();r.onload=()=>res(r.result);r.readAsDataURL(bl);});
        const img = new Image();
        await new Promise((ok,er)=>{img.onload=ok;img.onerror=er;img.src=du;});
        let fw = 24, fh = 24*img.height/img.width;
        if (fh > 32){ fh = 32; fw = 32*img.width/img.height; }
        const W = doc.internal.pageSize.getWidth();
        doc.addImage(du, bl.type.includes('png')?'PNG':'JPEG', W-14-fw, y, fw, fh);
        doc.setDrawColor(200); doc.setLineWidth(.25); doc.rect(W-14-fw, y, fw, fh);
        y += fh + 4;
      }
    }catch(_){ /* segue sem foto */ } }
    const rot = {0:{fontStyle:'bold', cellWidth:58}};
    const inst = CAMPOS_MEMBRO.filter(c=>c.k!=='nome' && c.k!=='foto_url').map(c=>{
      let v = m[c.k];
      if(c.t==='grupos') v = (v||[]).join(', ');
      else if(c.t==='date') v = v? fmtD(v) : '';
      else if(c.t==='gestor') v = v? (nomeDe(v)||'') : '';
      return [c.l.replace(' (separados por vírgula)',''), v||'—'];
    });
    y = secaoTabela(doc, y, 'DADOS INSTITUCIONAIS', null, inst, rot);
    if(f.acessos.length){
      const porItem = new Map(state.itensAcesso.map(i=>[i.id, i]));
      const corpo = f.acessos.map(a=>{ const it = porItem.get(a.item_id);
        return [it?it.nome:'—', a.ativo?'Concedido':'Revogado',
          a.ativo?(a.concedido_em?fmtD(a.concedido_em):'—'):(a.revogado_em?fmtD(a.revogado_em):'—'), a.responsavel||'—'];
      }).sort((a,b)=>a[0].localeCompare(b[0],'pt-BR'));
      y = secaoTabela(doc, y, 'ACESSOS', [['Item','Situação','Data','Responsável']], corpo);
    }
    if(f.ocorr.length) y = secaoTabela(doc, y, 'OCORRÊNCIAS', [['Data','Tipo','Descrição','Responsável']],
      f.ocorr.map(o=>[fmtD(o.data), o.tipo, o.descricao||'—', o.responsavel||'—']), {2:{cellWidth:76}});
    if(f.avals.length) y = secaoTabela(doc, y, 'AVALIAÇÕES PERIÓDICAS',
      [['Ciclo','Data','Assiduidade','Comprometimento','Depto de Pessoal','Responsável']],
      f.avals.map(a=>[a.ciclo, fmtD(a.data), a.assiduidade!=null?a.assiduidade+'/5':'—',
        a.comprometimento!=null?a.comprometimento+'/5':'—',
        a.encaminhar_pessoal?(a.tratado?'Encaminhada, tratada':'Encaminhada, pendente'):'—', a.responsavel||'—']));
    if(f.aponts.length) y = secaoTabela(doc, y, 'APONTAMENTOS SEMANAIS RECENTES',
      [['Data','Grupo','Assiduidade','Entregas','Sinalização']],
      f.aponts.map(a=>[fmtD(a.data), a.apont?.grupo||'—', a.assiduidade||'—', a.entregas||'—',
        a.sinalizado?(a.tratado?'Sinalizado, tratado':'Sinalizado, pendente'):'—']));
    if(temPess){
      const pess = CAMPOS_PESS.map(c=>{ let v = f.pess[c.k];
        if(c.t==='date') v = v? fmtD(v) : '';
        if(c.t==='bool') v = v===true?'Sim':(v===false?'Não':'');
        return [c.l, v||'—']; });
      y = secaoTabela(doc, y, 'DADOS PESSOAIS (CONFIDENCIAL, LGPD)', null, pess, rot);
    }
    pdfRodape(doc, `SOMA, uso interno${temPess?', CONFIDENCIAL (LGPD)':''}, gerado por ${quemSouEu()} em ${new Date().toLocaleDateString('pt-BR')}`);
    doc.save(`NRO-PES_ficha_${pad3(m.registro)}_${hojeISO()}.pdf`);
    toast('Relatório do membro gerado.');
  }catch(e){ falha(e,'Erro ao gerar o relatório'); }
}

/* ---------------- relatórios ---------------- */

/* --- 1. lista para acesso na portaria --- */
function modalPortaria(){
  abreModal(`<h3>Lista para acesso na portaria</h3>
    <div class="form-grid">
      <div class="fld full"><label>Grupos (vazio = todos)</label>${grupoCheckboxes('g-port')}</div>
      <div class="fld full"><label>Status</label>${statusCheckboxes('s-port',['Ativo'])}</div>
      <div class="fld full"><label>Locais de acesso solicitados</label>
        <div class="multi" style="max-height:none">${LOCAIS_PORTARIA.map(l=>`<label class="check">
          <input type="checkbox" class="l-port" value="${l}"> ${l}</label>`).join('')}</div></div>
      <div class="fld"><label>Data do acesso</label><input id="rp-data" type="date"></div>
      <div class="fld"><label>Horário</label><input id="rp-hora" placeholder="ex.: 8h às 12h"></div>
      <div class="fld"><label>Responsável</label><input id="rp-nome" value="${esc(quemSouEu())}"></div>
      <div class="fld"><label>Telefone do responsável</label><input id="rp-tel" placeholder="(31) 9…"></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="gerarListaPortaria()">${ic('doc')} Gerar PDF</button></div>`);
}
async function gerarListaPortaria(){
  const grupos = marcados('g-port'), sts = marcados('s-port'), locais = marcados('l-port');
  const respNome = $('#rp-nome').value.trim(), respTel = $('#rp-tel').value.trim();
  const dataAc = $('#rp-data').value, horaAc = $('#rp-hora').value.trim();
  if(!locais.length){ toast('Selecione pelo menos um local de acesso.', true); return; }
  if(!respNome || !respTel){ toast('Informe o nome e o telefone do responsável.', true); return; }
  try{
    const lista = filtraPorSelecao(sts.length?sts:['Ativo'], grupos);
    if(!lista.length){ toast('Nenhum membro com esses filtros.', true); return; }
    const mats = await buscarMatriculas(lista.map(m=>m.registro));
    const doc = pdfNovo();
    const sub = `Locais: ${locais.join(' e ')}`
      + (dataAc?`\nData do acesso: ${fmtD(dataAc)}${horaAc?', Horário: '+horaAc:''}`:(horaAc?`\nHorário: ${horaAc}`:''))
      + (grupos.length?`\nGrupos: ${grupos.join(', ')}`:'')
      + `\nEmitida em ${new Date().toLocaleDateString('pt-BR')}, ${lista.length} pessoa(s)`;
    const y = pdfCabecalho(doc, 'LISTA PARA ACESSO: ESCOLA DE ENGENHARIA', sub);
    doc.autoTable({ startY:y, theme:'grid',
      head:[['Nome','Matrícula','Assinatura']],
      body:lista.map(m=>[m.nome, mats.get(m.registro)||'—','']),
      styles:{font:'helvetica', fontSize:9, cellPadding:2.2, textColor:[29,29,31], lineColor:[210,210,215], lineWidth:.25, minCellHeight:9},
      headStyles:{fillColor:[29,29,31], textColor:[245,245,247], fontSize:9},
      columnStyles:{0:{cellWidth:86},1:{cellWidth:38},2:{cellWidth:'auto'}}, margin:{left:12,right:12} });
    let fy = doc.lastAutoTable.finalY + 9;
    if(fy > doc.internal.pageSize.getHeight()-22){ doc.addPage(); fy = 16; }
    doc.setFont('helvetica','normal'); doc.setFontSize(9.5); doc.setTextColor(29,29,31);
    doc.text(`Em caso de dúvidas, contatar ${respNome} em ${respTel}.`, 12, fy);
    pdfRodape(doc);
    doc.save(`NRO-PES_lista_portaria_${hojeISO()}.pdf`);
    const corpo =
`Prezados,

Solicitamos a autorização de entrada na Escola de Engenharia para as pessoas relacionadas na lista em anexo.

Local (portaria): ${locais.join(' e ')}
${dataAc?'Data: '+fmtD(dataAc)+'\n':''}${horaAc?'Horário: '+horaAc+'\n':''}Total de pessoas: ${lista.length}

Em caso de dúvidas, contatar ${respNome} em ${respTel}.

Atenciosamente,
Departamento de Pessoal, NeuroDynamics`;
    const assunto = `Autorização de acesso, NeuroDynamics${dataAc?', '+fmtD(dataAc):''}`;
    const mailtoHref = `mailto:slog@eng.ufmg.br?cc=marcondes@neurodynamics.dev&subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    const gmailHref = gmailCompose({to:'slog@eng.ufmg.br', cc:'marcondes@neurodynamics.dev', su:assunto, body:corpo});
    abreModal(`<h3>Lista gerada</h3>
      <p style="line-height:1.6">PDF baixado. O e-mail para a Seção de Logística abre com o texto e cópia para
      marcondes@neurodynamics.dev. <b>Anexe o PDF antes de enviar.</b></p>
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <a class="btn ghost" href="${esc(mailtoHref)}"
        onclick="abrirEmail(this.href);setTimeout(fechaModal,400);return false">${ic('mail')} App de e-mail</a>
      <a class="btn solid" href="${esc(gmailHref)}" target="_blank" rel="noopener"
        onclick="setTimeout(fechaModal,400)">${ic('mail')} Abrir no Gmail</a></div>
      <p class="small muted" style="margin-top:10px">“App de e-mail” usa o programa padrão do computador. Sem programa configurado, use o Gmail.</p>`, true);
  }catch(e){ falha(e,'Erro ao gerar a lista'); }
}
/* --- 2. lista para assinatura em evento --- */
function modalAssinatura(){
  abreModal(`<h3>Lista para assinatura em evento</h3>
    <div class="form-grid">
      <div class="fld full"><label>Grupos (vazio = todos os ativos)</label>${grupoCheckboxes('g-ass')}</div>
      <div class="fld"><label>Nome do evento</label><input id="as-nome" placeholder="ex.: Reunião Geral de Julho"></div>
      <div class="fld"><label>Data do evento</label><input id="as-data" type="date" value="${hojeISO()}"></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="gerarListaAssinatura()">${ic('doc')} Gerar PDF</button></div>`);
}
async function gerarListaAssinatura(){
  const grupos = marcados('g-ass'), nomeEv = $('#as-nome').value.trim(), dataEv = $('#as-data').value;
  if(!nomeEv){ toast('Informe o nome do evento.', true); return; }
  try{
    const lista = filtraPorSelecao(['Ativo'], grupos);
    if(!lista.length){ toast('Nenhum membro ativo com esses filtros.', true); return; }
    const mats = await buscarMatriculas(lista.map(m=>m.registro));
    const doc = pdfNovo();
    const y = pdfCabecalho(doc, 'LISTA DE PRESENÇA: '+nomeEv.toUpperCase(),
      `Data do evento: ${fmtD(dataEv)}${grupos.length?', Grupos: '+grupos.join(', '):''}, ${lista.length} convidado(s)`);
    doc.autoTable({ startY:y, theme:'grid',
      head:[['Nome','Matrícula','Assinatura']],
      body:lista.map(m=>[m.nome, mats.get(m.registro)||'—','']),
      styles:{font:'helvetica', fontSize:9, cellPadding:2.2, textColor:[29,29,31], lineColor:[210,210,215], lineWidth:.25, minCellHeight:9},
      headStyles:{fillColor:[29,29,31], textColor:[245,245,247], fontSize:9},
      columnStyles:{0:{cellWidth:86},1:{cellWidth:38},2:{cellWidth:'auto'}}, margin:{left:12,right:12} });
    pdfRodape(doc);
    doc.save(`NRO-PES_lista_assinatura_${hojeISO()}.pdf`);
    fechaModal(); toast('PDF gerado.');
  }catch(e){ falha(e,'Erro ao gerar a lista'); }
}
/* --- 3. lista de e-mails --- */
function modalEmails(){
  abreModal(`<h3>Lista de e-mails</h3>
    <div class="form-grid">
      <div class="fld full"><label>Grupos (vazio = todos)</label>${grupoCheckboxes('g-eml')}</div>
      <div class="fld full"><label>Status</label>${statusCheckboxes('s-eml',['Ativo'])}</div>
    </div>
    <div id="eml-result"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
    <button class="btn solid" onclick="gerarEmails()">${ic('mail')} Gerar lista</button></div>`);
}
function gerarEmails(){
  const lista = filtraPorSelecao(marcados('s-eml'), marcados('g-eml'));
  const emails = [...new Set(lista.map(m=> (m.email_nro||m.email_pessoal||'').trim().toLowerCase()).filter(Boolean))];
  const semEmail = lista.filter(m=> !(m.email_nro||m.email_pessoal));
  const eu = (state.perfil && state.perfil.email) ? state.perfil.email : '';
  const mailtoHref = `mailto:${eu}?bcc=${encodeURIComponent(emails.join(','))}`;
  const gmailHref = gmailCompose({to:eu, bcc:emails.join(',')});
  $('#eml-result').innerHTML = emails.length ? `
    <div class="fld" style="margin-top:4px"><label>${emails.length} e-mail(s), separados por vírgula</label>
      <textarea id="eml-texto" readonly style="min-height:110px;font-size:12.5px">${esc(emails.join(', '))}</textarea></div>
    ${semEmail.length?`<p class="small muted">⚠ ${semEmail.length} membro(s) sem e-mail cadastrado: ${esc(semEmail.map(m=>m.nome).join('; '))}</p>`:''}
    <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
      <button class="btn ghost" onclick="copiar(document.getElementById('eml-texto').value)">${ic('copy')} Copiar</button>
      <a class="btn ghost" id="eml-mailto" href="${esc(mailtoHref)}" onclick="return abrirEmail(this.href)">${ic('mail')} App de e-mail (Cco)</a>
      <a class="btn ghost" href="${esc(gmailHref)}" target="_blank" rel="noopener">${ic('mail')} Abrir no Gmail (Cco)</a>
    </div>
    ${eu?`<p class="small muted" style="margin-top:6px">Destinatário: ${esc(eu)}; os demais em Cco. Sem programa de e-mail configurado, use o Gmail.</p>`:''}`
    : '<div class="empty">Nenhum e-mail encontrado com esses filtros.</div>';
}
/* --- 3c. lista de e-mails dos candidatos (processo seletivo) ---
   Só aparece para quem acessa o módulo Seleção. Busca os candidatos da
   edição escolhida direto do Supabase — a cada geração, para não repetir
   status que mudaram no módulo Seleção durante a sessão. */
const REL_PS = {edicoes:null};
/* Conjuntos prontos de status — os mesmos recortes usados nas publicações
   do processo, para não errar quem já passou por cada fase. */
const PS_CONJ_EMAIL = [
  ['Aguardando análise', ['inscrito']],
  ['Inscrições deferidas', 'deferimento'],
  ['Indeferidos', ['indeferido']],
  ['Aprovados na dinâmica', 'resultado_dinamica'],
  ['Aprovados na entrevista', 'resultado_entrevista'],
  ['Trainees', ['trainee']],
  ['Aprovados no final', 'resultado_final'],
  ['Todos', null]
];
async function modalEmailsCandidatos(){
  abreModal('<h3>Lista de e-mails dos candidatos</h3><div class="empty">Carregando o processo seletivo…</div>');
  try{
    if(!REL_PS.edicoes){
      const {data, error} = await sb.from('ps_edicoes').select('id,nome,slug').order('criado_em',{ascending:false});
      if(error) throw error;
      REL_PS.edicoes = data||[];
    }
  }catch(e){ fechaModal(); falha(e,'Não foi possível carregar as edições'); return; }
  if(!REL_PS.edicoes.length){
    abreModal(`<h3>Lista de e-mails dos candidatos</h3>
      <div class="empty">Nenhuma edição do processo seletivo cadastrada.</div>
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`);
    return;
  }
  abreModal(`<h3>Lista de e-mails dos candidatos</h3>
    <div class="form-grid">
      <div class="fld full"><label>Edição</label>
        <select id="emlc-ed" onchange="relEmlCandsLimpa()">
          ${REL_PS.edicoes.map(e=>`<option value="${e.id}">${esc(e.nome)}</option>`).join('')}</select></div>
      <div class="fld full"><label>Status no processo seletivo <span class="muted">(vazio = todos)</span></label>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px">
          ${PS_CONJ_EMAIL.map(([l],i)=>`<button class="btn sm" onclick="relEmlCandsConj(${i})">${esc(l)}</button>`).join('')}
        </div>
        <div class="multi">${Object.keys(PS_ST).map(s=>`<label class="check">
          <input type="checkbox" class="s-emlc" value="${s}" onchange="relEmlCandsLimpa()"> ${esc(PS_ST[s][0])}</label>`).join('')}</div></div>
      <div class="fld full"><label>Assunto do e-mail <span class="muted">(opcional, vai preenchido na tela de envio)</span></label>
        <input id="emlc-assunto" placeholder="ex.: Processo Seletivo 2026, resultado da 1ª fase"></div>
      <div class="fld full"><label>Destinatários</label>
        <select id="emlc-modo">
          <option value="bcc">Cco: para mim, candidatos em cópia oculta (recomendado)</option>
          <option value="to">Para: candidatos visíveis entre si</option>
        </select></div>
    </div>
    <div id="emlc-result"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
    <button class="btn solid" onclick="gerarEmailsCandidatos()">${ic('mail')} Gerar lista</button></div>`);
}
function relEmlCandsLimpa(){ const r = $('#emlc-result'); if(r) r.innerHTML=''; }
function relEmlCandsConj(i){
  const conj = PS_CONJ_EMAIL[i][1];
  const sts = conj===null ? [] : (Array.isArray(conj) ? conj : PS_SETS[conj]||[]);
  document.querySelectorAll('input.s-emlc').forEach(cb=> cb.checked = sts.includes(cb.value));
  relEmlCandsLimpa();
}
async function gerarEmailsCandidatos(){
  const edId = $('#emlc-ed').value, sts = marcados('s-emlc');
  let todos;
  try{
    const {data, error} = await sb.from('ps_candidatos')
      .select('nome,email,status,protocolo').eq('edicao_id', edId).order('numero');
    if(error) throw error;
    todos = data||[];
  }catch(e){ falha(e,'Não foi possível carregar os candidatos'); return; }
  const lista = todos.filter(c=> !sts.length || sts.includes(c.status));
  const emails = [...new Set(lista.map(c=>(c.email||'').trim().toLowerCase()).filter(Boolean))];
  const porStatus = {};
  lista.forEach(c=>{ porStatus[c.status] = (porStatus[c.status]||0) + 1; });
  const eu = state.perfil?.email || '';
  $('#emlc-result').innerHTML = emails.length ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin:-2px 0 10px">
      ${Object.keys(porStatus).map(s=>`<span class="chip">${esc((PS_ST[s]||[s])[0])}: ${porStatus[s]}</span>`).join('')}</div>
    <div class="fld"><label>${emails.length} e-mail(s), separados por vírgula <span class="muted">(editável)</span></label>
      <textarea id="emlc-texto" style="min-height:110px;font-size:12.5px">${esc(emails.join(', '))}</textarea></div>
    <div style="display:flex;gap:8px;margin-top:6px;flex-wrap:wrap">
      <button class="btn ghost" onclick="copiar(document.getElementById('emlc-texto').value)">${ic('copy')} Copiar</button>
      <button class="btn ghost" onclick="relEmlCandsEnviar('mailto')">${ic('mail')} App de e-mail</button>
      <button class="btn ghost" onclick="relEmlCandsEnviar('gmail')">${ic('mail')} Abrir no Gmail</button>
    </div>
    ${emails.length>60?`<p class="small muted" style="margin-top:6px">Listas longas podem ser truncadas pelo programa de e-mail. Se necessário, copie a lista para o Cco ou divida o envio.</p>`:''}
    ${eu?`<p class="small muted" style="margin-top:6px">Em Cco, o destinatário é ${esc(eu)}. Sem programa de e-mail configurado, use o Gmail.</p>`:''}`
    : `<div class="empty">Nenhum candidato ${todos.length?'com esses status':'inscrito nesta edição'}.</div>`;
}
function relEmlCandsEnviar(via){
  const ta = $('#emlc-texto'); if(!ta) return;
  const dest = ta.value.split(/[,;\s]+/).map(s=>s.trim()).filter(Boolean);
  if(!dest.length){ toast('Nenhum e-mail na lista.', true); return; }
  const cco = $('#emlc-modo').value==='bcc', su = $('#emlc-assunto').value.trim();
  const eu = state.perfil?.email || '';
  const alvo = cco ? {to:eu, bcc:dest.join(',')} : {to:dest.join(',')};
  if(via==='gmail'){ window.open(gmailCompose({...alvo, su}), '_blank', 'noopener'); return; }
  const enc = l=> l.split(',').map(encodeURIComponent).join(',');
  const p = [];
  if(alvo.bcc) p.push('bcc='+enc(alvo.bcc));
  if(su) p.push('subject='+encodeURIComponent(su));
  abrirEmail(`mailto:${enc(alvo.to||'')}${p.length?'?'+p.join('&'):''}`);
}
/* --- 4. lista de autorizados --- */
function modalAutorizados(){
  if (!podeVerFicha()) return toast('Este relatório é da administração.', true);
  abreModal(`<h3>Lista de autorizados</h3>
    <div class="form-grid">
      <div class="fld full"><label>Sistema, local ou documento</label>
        <select id="au-item">${state.itensAcesso.map(i=>`<option value="${i.id}">${esc(i.nome)}</option>`).join('')}</select></div>
      <div class="fld full"><label>Grupos (vazio = todos)</label>${grupoCheckboxes('g-aut')}</div>
      <div class="fld full"><label>Status</label>${statusCheckboxes('s-aut',['Ativo'])}</div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="gerarAutorizados()">${ic('doc')} Gerar PDF</button></div>`);
}
async function gerarAutorizados(){
  const itemId = $('#au-item').value, grupos = marcados('g-aut'), sts = marcados('s-aut');
  const item = state.itensAcesso.find(i=>i.id===itemId);
  try{
    const {data, error} = await sb.from('acessos_concedidos').select('registro, concedido_em').eq('item_id', itemId).eq('ativo', true);
    if(error) throw error;
    const desde = new Map((data||[]).map(a=>[a.registro, a.concedido_em]));
    const lista = filtraPorSelecao(sts, grupos).filter(m=>desde.has(m.registro));
    if(!lista.length){ toast('Ninguém com acesso ativo a esse item nesses filtros.', true); return; }
    const doc = pdfNovo();
    const y = pdfCabecalho(doc, 'AUTORIZADOS: '+item.nome.toUpperCase(),
      `${CAT_LABEL[item.categoria]}, ${lista.length} pessoa(s) com acesso ativo`
      + (grupos.length?`, Grupos: ${grupos.join(', ')}`:'') + (sts.length?`, Status: ${sts.join(', ')}`:''));
    doc.autoTable({ startY:y, theme:'striped',
      head:[['Reg.','Nome','Departamento','Status','Concedido em']],
      body:lista.map(m=>[pad3(m.registro), m.nome, m.departamento||'—', m.status, desde.get(m.registro)?fmtD(desde.get(m.registro)):'—']),
      styles:{font:'helvetica', fontSize:9, cellPadding:2, textColor:[29,29,31]},
      headStyles:{fillColor:[29,29,31], textColor:[245,245,247], fontSize:9},
      alternateRowStyles:{fillColor:[246,246,248]}, margin:{left:12,right:12} });
    pdfRodape(doc);
    doc.save(`NRO-PES_autorizados_${hojeISO()}.pdf`);
    fechaModal(); toast('PDF gerado.');
  }catch(e){ falha(e,'Erro ao gerar a lista'); }
}
/* --- 5. quadro completo --- */
function modalQuadro(){
  if (!podeVerFicha()) return toast('Este relatório é da administração.', true);
  abreModal(`<h3>Exportar quadro completo</h3>
    <div class="form-grid">
      <div class="fld full"><label>Grupos (vazio = todos)</label>${grupoCheckboxes('g-qd')}</div>
      <div class="fld full"><label>Status (vazio = todos)</label>${statusCheckboxes('s-qd',[])}</div>
    </div>
    <p class="small muted" style="margin:4px 0 0">Inclui registro, nome, status, departamento, cargo, gestor, grupos, e-mails, telefone e datas.
    Dados sensíveis (CPF, endereço, autodeclarações) nunca entram nos relatórios.
    O Excel gerado pode ser editado e reimportado em Operações → Importar planilha, para manutenção em massa.</p>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
    <button class="btn ghost" onclick="exportarExcelQuadro()">Excel</button>
    <button class="btn solid" onclick="exportarPDFQuadro()">PDF</button></div>`);
}
function exportarExcelQuadro(){
  try{
    const lista = filtraPorSelecao(marcados('s-qd'), marcados('g-qd'));
    const rows = lista.map(m=>({
      'Registro':m.registro,'Status':m.status,'Nome':m.nome,'Departamento':m.departamento||'',
      'Cargo':m.cargo||'','Gestor imediato':m.gestor_registro?(nomeDe(m.gestor_registro)||''):'',
      'Grupos':(m.grupos||[]).join(', '),'E-mail NRO':m.email_nro||'','E-mail pessoal':m.email_pessoal||'',
      'Telefone':m.telefone||'','Data de ingresso':m.data_ingresso?fmtD(m.data_ingresso):'',
      'Forma de ingresso':m.forma_ingresso||'','Data de desligamento':m.data_desligamento?fmtD(m.data_desligamento):'',
      'Projeto no fomento':m.projeto_fomento||'','Classificação':m.classificacao||'','Bolsa':m.bolsa||'',
      'Data de encerramento':m.data_encerramento?fmtD(m.data_encerramento):''
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{wch:8},{wch:18},{wch:38},{wch:26},{wch:24},{wch:30},{wch:40},{wch:30},{wch:30},{wch:16},{wch:14},{wch:20},{wch:14},{wch:18},{wch:16},{wch:12},{wch:18}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'QUADRO');
    XLSX.writeFile(wb, `NRO-PES_quadro_${hojeISO()}.xlsx`);
    fechaModal(); toast('Excel gerado.');
  }catch(e){ falha(e,'Erro ao exportar'); }
}
function exportarPDFQuadro(){
  try{
    const grupos = marcados('g-qd'), sts = marcados('s-qd');
    const lista = filtraPorSelecao(sts, grupos);
    const doc = pdfNovo('landscape');
    const y = pdfCabecalho(doc, 'QUADRO DE PESSOAL',
      `${lista.length} registro(s)` + (sts.length?`, Status: ${sts.join(', ')}`:', Todos os status')
      + (grupos.length?`, Grupos: ${grupos.join(', ')}`:''));
    doc.autoTable({ startY:y,
      head:[['Reg.','Nome','Status','Departamento','Cargo','Gestor','Grupos','E-mail','Ingresso']],
      body:lista.map(m=>[pad3(m.registro), m.nome, m.status, m.departamento||'', m.cargo||'',
        m.gestor_registro?(nomeDe(m.gestor_registro)||''):'', (m.grupos||[]).join(', '),
        m.email_nro||m.email_pessoal||'', m.data_ingresso?fmtD(m.data_ingresso):'']),
      styles:{font:'helvetica', fontSize:7.5, cellPadding:1.6, textColor:[29,29,31]},
      headStyles:{fillColor:[29,29,31], textColor:[245,245,247], fontSize:8},
      alternateRowStyles:{fillColor:[246,246,248]}, margin:{left:12,right:12} });
    pdfRodape(doc);
    doc.save(`NRO-PES_quadro_${hojeISO()}.pdf`);
    fechaModal(); toast('PDF gerado.');
  }catch(e){ falha(e,'Erro ao exportar'); }
}


/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'relatorios', rotulo:'Relatórios',
  buscar: (t) => {
    if (!podeVerFicha() && !podeSelecao()) return [];
    /* a busca não pode achar o que a galeria esconde */
    const itens = [
      { titulo:'Lista de e-mails', sub:'Por grupo e status', href:'#/admin/relatorios' },
      { titulo:'Full mailer', sub:'E-mail no padrão da marca', href:'#/admin/emails' }
    ];
    if (podeSelecao())
      itens.push({ titulo:'E-mails dos candidatos', sub:'Por status da fase', href:'#/admin/relatorios' });
    if (podeVerFicha()) itens.push(
      { titulo:'Lista para a portaria', sub:'Autorização de entrada', href:'#/admin/relatorios' },
      { titulo:'Lista de assinatura em evento', sub:'Presença para imprimir', href:'#/admin/relatorios' },
      { titulo:'Lista de autorizados', sub:'Quem tem acesso a quê', href:'#/admin/relatorios' },
      { titulo:'Quadro completo', sub:'Exportar em Excel ou PDF', href:'#/admin/relatorios' });
    return filtrarSimples(itens, t, 5);
  }
});
