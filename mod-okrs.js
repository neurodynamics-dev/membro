/* ============================================================
   MÓDULO · OKRs — planejamento estratégico
   Veio do SOMA · Gestão (soma-legado.html, SOMA 8.0), com a lógica
   intacta e a marcação refeita para o portal. É uma árvore de
   objetivos (estratégico, tático, operacional) desenhada num mapa que
   se arrasta e se amplia, como um quadro do Miro: os estratégicos em
   cima e, abaixo de cada objetivo aberto, os desdobramentos dele,
   ligados por fios. O que se abre fica aberto (neste navegador).
   Cada objetivo tem responsáveis, prazo, status e comentários.

   Rotas:
     #/okrs            o primeiro objetivo estratégico em foco
     #/okrs/<codigo>   um objetivo (OE1, OT1.2…): abre o caminho até ele
                       e o centra na tela. O endereço firma no código do
                       que está em foco, para o link copiado abrir o
                       mesmo lugar

   Todos veem. Criar e excluir: admin e pessoal. Editar e mudar status:
   admin, pessoal e os responsáveis do objetivo. A regra de verdade é a
   RLS de okr_objetivos (migração soma_v08_okrs.sql).

   Depende da casca para: sb, $, esc, norm, state, can, toast, falha,
   abreModal, fechaModal, confirma, fmtD, fmtDT, ic, ibtn, avatarFoto,
   quemSouEu, marcados, route, registrarBusca, filtrarSimples,
   carregarOKRsDoMenu.
   ============================================================ */

const OKR_NIVEL = {estrategico:'Objetivo estratégico', tatico:'Objetivo tático', operacional:'Objetivo operacional'};
const OKR_SUBNIVEL = {estrategico:'tatico', tatico:'operacional', operacional:'operacional'};
const OKR_PREFIXO = {estrategico:'OE', tatico:'OT', operacional:'OP'};
const OKR_STATUS = {'Não iniciado':'dt-gray','Em andamento':'dt-info','Em risco':'dt-warn','Concluído':'dt-ok','Cancelado':'dt-bad'};
const OKR_EIXOS_CORES = {'Tecnologia':'#4C6FBF','Científico':'#7C5CBF','Gestão':'#00594F',
  'Prospecção':'#B7791F','Parcerias':'#C05B3B','Formação':'#3D8B8B'};
const OKR = { pronto:false, erro:null, itens:[], foco:null };

const okrPorId = (id)=> OKR.itens.find(o=>o.id===id);
const okrPorCodigo = (c)=> OKR.itens.find(o=>norm(o.codigo)===norm(c));
const okrOrdena = (a,b)=> (a.ordem-b.ordem) || String(a.codigo).localeCompare(String(b.codigo),'pt-BR',{numeric:true});
const okrFilhos = (id)=> OKR.itens.filter(o=>o.pai_id===id).sort(okrOrdena);
const okrRaizes = ()=> OKR.itens.filter(o=>!o.pai_id || !okrPorId(o.pai_id)).sort(okrOrdena);
const okrPill = (st)=> `<span class="pill"><span class="dt ${OKR_STATUS[st]||'dt-gray'}"></span>${esc(st||'—')}</span>`;
const okrEixoChip = (e)=> e ? `<span class="okr-eixo"><span class="dt" style="background:${OKR_EIXOS_CORES[e]||'#8E8E93'}"></span>${esc(e)}</span>` : '';
const okrTrimestre = (d)=> d ? 'Q'+Math.ceil(parseInt(String(d).slice(5,7),10)/3) : '';
const okrBarra = (pr, texto)=> `<span class="okr-prog"><span class="trilho"><span class="fill" style="width:${pr.pct}%"></span></span>
  <span class="pc">${texto || pr.pct + '%'}</span></span>`;

function okrPodeEditar(o){
  if(can()) return true;
  const reg = state.perfil?.registro;
  return reg!=null && (o.responsaveis||[]).includes(reg);
}
function okrCadeia(o){ // ancestrais, do topo até o pai imediato (com proteção contra ciclos)
  const cadeia=[], vistos=new Set([o.id]);
  let p = o.pai_id ? okrPorId(o.pai_id) : null;
  while(p && !vistos.has(p.id) && cadeia.length<10){ cadeia.unshift(p); vistos.add(p.id); p = p.pai_id ? okrPorId(p.pai_id) : null; }
  return cadeia;
}
function okrFolhas(id, vistos){ // objetivos "ponta" (sem desdobramento) abaixo de id
  vistos = vistos||new Set(); if(vistos.has(id)) return []; vistos.add(id);
  const fs = okrFilhos(id);
  if(!fs.length){ const o = okrPorId(id); return o?[o]:[]; }
  return fs.flatMap(f=>okrFolhas(f.id, vistos));
}
function okrDescendentes(id, vistos){
  vistos = vistos||new Set();
  return okrFilhos(id).flatMap(f=> vistos.has(f.id) ? [] : (vistos.add(f.id), [f, ...okrDescendentes(f.id, vistos)]));
}
function okrProgresso(o){ // % de folhas concluídas no desdobramento (canceladas ficam de fora)
  if(!okrFilhos(o.id).length) return null;
  const folhas = okrFolhas(o.id).filter(x=>x.status!=='Cancelado');
  if(!folhas.length) return null;
  const done = folhas.filter(x=>x.status==='Concluído').length;
  return {pct:Math.round(done/folhas.length*100), done, total:folhas.length};
}
function okrPrazoInfo(o){
  if(!o.prazo) return {txt:'sem prazo', cls:'off'};
  const rot = `${okrTrimestre(o.prazo)} · ${fmtD(o.prazo)}`;
  if(o.status==='Concluído' || o.status==='Cancelado') return {txt:rot, cls:'off'};
  const hj = new Date(); hj.setHours(12,0,0,0);
  const dias = Math.round((new Date(o.prazo+'T12:00') - hj)/864e5);
  if(dias<0)   return {txt:`${rot} · atrasado há ${-dias} dia${dias===-1?'':'s'}`, cls:'bad'};
  if(dias===0) return {txt:`${rot} · vence hoje`, cls:'warn'};
  if(dias<=14) return {txt:`${rot} · faltam ${dias} dia${dias===1?'':'s'}`, cls:'warn'};
  return {txt:`${rot} · faltam ${dias} dias`, cls:'ok'};
}
function okrResps(o){ return (o.responsaveis||[]).map(r=>state.membros.find(m=>m.registro===r)||{registro:r, nome:'Reg. '+r}); }
function okrRespAvatares(o){
  const ms = okrResps(o);
  if(!ms.length) return '<span class="small dim">sem responsável</span>';
  return `<span class="okr-resps" title="${esc(ms.map(m=>m.nome).join(', '))}">
    ${ms.slice(0,5).map(m=>avatarFoto(m, 24, 9)).join('')}
    ${ms.length>5?`<span class="small muted" style="margin-left:6px">+${ms.length-5}</span>`:''}</span>`;
}

async function okrCarregar(){
  const {data, error} = await sb.from('okr_objetivos').select('*').order('ordem').order('codigo');
  if(error) throw error;
  OKR.itens = data||[]; OKR.pronto = true; OKR.erro = null;
}

/* ============================================================
   ROTA
   ============================================================ */
async function pageOkrs(sub){
  const topo = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Planejamento estratégico</span>
      <h1>OKRs</h1></div>
    ${can() ? `<div class="acoes"><button class="btn solid" onclick="modalOKREditar(null,null)">${ic('plus')}
      Novo objetivo estratégico</button></div>` : ''}</div>`;
  if(!OKR.pronto){
    $('#main').innerHTML = topo + '<div class="carregando"><span class="spin"></span> Carregando…</div>';
    try{ await okrCarregar(); }
    catch(e){
      OKR.erro = e;
      $('#main').innerHTML = topo + `<div class="aviso-box err">Não foi possível carregar os OKRs: ${esc(e.message)}.
        ${/okr_objetivos/.test(e.message || '') ? 'Falta aplicar a migração db/aplicadas/soma_v08_okrs.sql.' : ''}</div>`;
      return;
    }
  }
  if(!OKR.itens.length){
    $('#main').innerHTML = topo + `<div class="vazio"><div class="glyph">0</div><h3>Nenhum objetivo</h3></div>`;
    return;
  }
  const alvo = sub && okrPorCodigo(decodeURIComponent(sub));
  if(alvo) OKR.foco = alvo.id;
  if(!OKR.foco || !okrPorId(OKR.foco)) OKR.foco = (okrRaizes()[0]||OKR.itens[0]).id;
  /* o endereço diz qual objetivo está em foco (replaceState não dispara
     hashchange; o roteador remarca o menu depois de desenhar) */
  const aqui = '#/okrs/' + encodeURIComponent(okrPorId(OKR.foco).codigo);
  if(location.hash !== aqui) history.replaceState(null, '', location.pathname + location.search + aqui);
  /* o caminho até o foco fica aberto; o que já estava aberto continua */
  okrCadeia(okrPorId(OKR.foco)).forEach(o => OKR.abertos.add(o.id));
  if(sub && alvo) OKR.abertos.add(alvo.id);
  okrGuardarAbertos();
  const jaTinha = !!$('#okr-tela');
  if(!jaTinha){
    $('#main').innerHTML = topo + `<div class="okr-tela" id="okr-tela" tabindex="0" aria-label="Mapa dos objetivos. Arraste para mover; Ctrl e a roda do mouse, ou os botões, para o zoom.">
        <div class="okr-mundo" id="okr-mundo"></div>
        <div class="okr-ferr okr-ferr-busca">
          <div class="org-busca"><input id="okr-q" placeholder="Buscar objetivo" autocomplete="off" oninput="okrBuscar(this.value)">
            <div id="okr-achados"></div></div>
        </div>
        <div class="okr-ferr okr-ferr-zoom" role="group" aria-label="Zoom">
          ${ibtn('menos_zoom', 'Menos zoom', 'okrZoom(1/1.2)', 'sm')}
          <button class="okr-pct" id="okr-pct" title="Tamanho real" onclick="okrZoom(null)">100%</button>
          ${ibtn('mais_zoom', 'Mais zoom', 'okrZoom(1.2)', 'sm')}
          ${ibtn('enquadrar', 'Enquadrar tudo', 'okrEnquadrar(true)', 'sm')}
          <button class="btn ghost mini" onclick="okrRecolherTudo()">Recolher</button>
        </div>
      </div>`;
    okrLigarTela();
  }
  okrDesenharTela();
  if(!OKR.vista || !jaTinha && !alvo) okrEnquadrar(false);
  if(alvo || jaTinha) okrCentrar(OKR.foco, jaTinha);
}
/* Focar é navegar: o objetivo ganha endereço e o voltar do navegador volta. */
function focarOKR(id){
  const o = okrPorId(id); if(!o) return;
  location.hash = '#/okrs/' + encodeURIComponent(o.codigo);
}
/* compatibilidade: quem ainda chama desenhaOKR redesenha a tela */
function desenhaOKR(){ okrDesenharTela(); }

/* ============================================================
   A TELA — um mapa quase infinito, como um quadro do Miro. Cada
   estratégico no topo; abrir um objetivo mostra os desdobramentos dele
   embaixo, ligados por fios, e o que se abriu fica aberto. Arrastar o
   fundo move; Ctrl e a roda (ou o pinçar) dá zoom; a roda sozinha rola.
   ============================================================ */
const OKR_W = 272, OKR_H = 172, OKR_GX = 28, OKR_GY = 76;
OKR.abertos = new Set((() => { try { return JSON.parse(localStorage.getItem('nd.okr.abertos') || '[]'); } catch(e){ return []; } })());
OKR.vista = null;           /* { x, y, k }: o deslocamento e o zoom */
OKR.pos = {};               /* id → { x, y } no mundo */
function okrGuardarAbertos(){ try { localStorage.setItem('nd.okr.abertos', JSON.stringify([...OKR.abertos])); } catch(e){} }

/* a disposição: cada nó ocupa a largura da sua subárvore aberta, e o pai
   fica centrado sobre os filhos (o desenho de um organograma) */
function okrLayout(){
  const pos = {}, larg = {};
  const filhosAbertos = o => OKR.abertos.has(o.id) ? okrFilhos(o.id) : [];
  const medir = (o, vistos) => {
    if(vistos.has(o.id)) return larg[o.id] = OKR_W; vistos.add(o.id);
    const fs = filhosAbertos(o);
    const soma = fs.reduce((t, f) => t + medir(f, vistos), 0) + Math.max(0, fs.length - 1) * OKR_GX;
    return larg[o.id] = Math.max(OKR_W, soma);
  };
  const por = (o, x0, nivel, vistos) => {
    if(vistos.has(o.id)) return; vistos.add(o.id);
    const w = larg[o.id];
    pos[o.id] = { x: x0 + (w - OKR_W) / 2, y: nivel * (OKR_H + OKR_GY) };
    let x = x0;
    const fs = filhosAbertos(o);
    const soma = fs.reduce((t, f) => t + larg[f.id], 0) + Math.max(0, fs.length - 1) * OKR_GX;
    x += (w - soma) / 2;
    fs.forEach(f => { por(f, x, nivel + 1, vistos); x += larg[f.id] + OKR_GX; });
  };
  const raizes = okrRaizes(), m = new Set();
  raizes.forEach(r => medir(r, m));
  let x = 0; const v = new Set();
  raizes.forEach(r => { por(r, x, 0, v); x += larg[r.id] + OKR_GX * 2; });
  return pos;
}
function okrNo(o){
  const pr = okrProgresso(o), pz = okrPrazoInfo(o), nf = okrFilhos(o.id).length, ab = OKR.abertos.has(o.id);
  const cor = OKR_EIXOS_CORES[o.eixo] || 'var(--line2)';
  return `<div class="okr-no n-${esc(o.nivel)}${o.id === OKR.foco ? ' foco' : ''}${ab && nf ? ' aberto' : ''}" data-id="${o.id}"
      style="left:${OKR.pos[o.id].x}px;top:${OKR.pos[o.id].y}px;--eixo:${cor}">
    <div class="ln1"><span class="okr-cod">${esc(o.codigo)}</span>${okrPill(o.status)}</div>
    <button class="nm" onclick="modalOKRDetalhe('${o.id}')" title="Detalhes e comentários">${esc(o.titulo)}</button>
    <div class="mt"><span class="okr-prazo ${pz.cls}">${esc(pz.txt)}</span>${(o.responsaveis || []).length ? okrRespAvatares(o) : ''}</div>
    ${pr ? okrBarra(pr, `${pr.done}/${pr.total}`) : '<span class="okr-sem-prog"></span>'}
    <div class="pe">
      ${nf ? `<button class="okr-abre" onclick="okrAlternar('${o.id}')" aria-expanded="${ab}">
          ${ab ? 'Recolher' : 'Desdobramentos'} <span class="n">${nf}</span>${ic('chevron', ab ? 'cima' : 'baixo')}</button>`
        : '<span class="okr-folha">Sem desdobramento</span>'}
      ${can() ? ibtn('plus', 'Desdobrar', `modalOKREditar(null,'${o.id}')`, 'sm') : ''}
    </div>
  </div>`;
}
function okrDesenharTela(){
  const mundo = $('#okr-mundo'); if(!mundo) return;
  OKR.pos = okrLayout();
  const ids = Object.keys(OKR.pos);
  const fios = ids.map(id => {
    const o = okrPorId(id), pai = o.pai_id && OKR.pos[o.pai_id];
    if(!pai) return '';
    const a = { x: pai.x + OKR_W / 2, y: pai.y + OKR_H }, b = { x: OKR.pos[id].x + OKR_W / 2, y: OKR.pos[id].y };
    const my = a.y + OKR_GY / 2, r = Math.min(10, Math.abs(b.x - a.x) / 2);
    const d = Math.abs(b.x - a.x) < 1 ? `M${a.x},${a.y} V${b.y}`
      : `M${a.x},${a.y} V${my - r} Q${a.x},${my} ${a.x + Math.sign(b.x - a.x) * r},${my} H${b.x - Math.sign(b.x - a.x) * r} Q${b.x},${my} ${b.x},${my + r} V${b.y}`;
    return `<path d="${d}"/>`;
  }).join('');
  const maxX = Math.max(...ids.map(id => OKR.pos[id].x)) + OKR_W, maxY = Math.max(...ids.map(id => OKR.pos[id].y)) + OKR_H;
  mundo.innerHTML = `<svg class="okr-fios" width="${maxX + 40}" height="${maxY + 40}" aria-hidden="true">${fios}</svg>
    ${ids.map(id => okrNo(okrPorId(id))).join('')}`;
  okrAplicarVista();
}
function okrAlternar(id){
  const antes = OKR.pos[id] && { ...OKR.pos[id] };
  if(OKR.abertos.has(id)){
    OKR.abertos.delete(id);
    okrDescendentes(id).forEach(d => OKR.abertos.delete(d.id));   /* recolher recolhe o que está embaixo */
  } else OKR.abertos.add(id);
  okrGuardarAbertos();
  okrDesenharTela();
  /* o objetivo clicado não sai do lugar na tela */
  const depois = OKR.pos[id];
  if(antes && depois && OKR.vista){ OKR.vista.x -= (depois.x - antes.x) * OKR.vista.k; OKR.vista.y -= (depois.y - antes.y) * OKR.vista.k; okrAplicarVista(); }
}
function okrRecolherTudo(){ OKR.abertos.clear(); okrGuardarAbertos(); okrDesenharTela(); okrEnquadrar(true); }

/* ---------- a vista: deslocar e dar zoom ---------- */
function okrAplicarVista(animar){
  const m = $('#okr-mundo'), v = OKR.vista; if(!m || !v) return;
  m.classList.toggle('anima', !!animar);
  m.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.k})`;
  const pc = $('#okr-pct'); if(pc) pc.textContent = Math.round(v.k * 100) + '%';
  if(animar) setTimeout(() => m.classList.remove('anima'), 320);
}
function okrZoom(f, cx, cy){
  const t = $('#okr-tela'); if(!t || !OKR.vista) return;
  const r = t.getBoundingClientRect(), v = OKR.vista;
  const k = f == null ? 1 : Math.min(1.6, Math.max(.25, v.k * f));
  const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
  v.x = px - (px - v.x) * (k / v.k); v.y = py - (py - v.y) * (k / v.k); v.k = k;
  okrAplicarVista(cx == null);
}
function okrEnquadrar(animar){
  const t = $('#okr-tela'); if(!t) return;
  const ids = Object.keys(OKR.pos); if(!ids.length) return;
  const r = t.getBoundingClientRect(), pad = 40;
  const minX = Math.min(...ids.map(id => OKR.pos[id].x)), minY = Math.min(...ids.map(id => OKR.pos[id].y));
  const maxX = Math.max(...ids.map(id => OKR.pos[id].x)) + OKR_W, maxY = Math.max(...ids.map(id => OKR.pos[id].y)) + OKR_H;
  const k = Math.min(1, Math.max(.25, Math.min((r.width - pad * 2) / (maxX - minX), (r.height - pad * 2 - 50) / (maxY - minY))));
  OKR.vista = { k, x: (r.width - (maxX - minX) * k) / 2 - minX * k, y: pad + 50 - minY * k };
  okrAplicarVista(animar);
}
function okrCentrar(id, animar){
  const t = $('#okr-tela'), p = OKR.pos[id]; if(!t || !p) return;
  const r = t.getBoundingClientRect();
  const k = Math.min(1, OKR.vista?.k || 1);
  const fs = OKR.abertos.has(id) ? okrFilhos(id).map(f => OKR.pos[f.id]).filter(Boolean) : [];
  /* o objetivo no terço de cima, com os desdobramentos abaixo dele */
  const cx = fs.length ? (Math.min(p.x, ...fs.map(f => f.x)) + Math.max(p.x, ...fs.map(f => f.x)) + OKR_W) / 2 : p.x + OKR_W / 2;
  /* o pai também à vista, se couber */
  const acima = okrPorId(id)?.pai_id && OKR.pos[okrPorId(id).pai_id] && 70 + (2 * OKR_H + OKR_GY) * k <= r.height ? (OKR_H + OKR_GY) * k : 0;
  OKR.vista = { k, x: r.width / 2 - cx * k, y: 70 + acima - p.y * k };
  okrAplicarVista(animar);
}
function okrLigarTela(){
  const t = $('#okr-tela'); if(!t) return;
  const toques = new Map(); let arr = null, pinca = null;
  t.addEventListener('pointerdown', e => {
    if(e.target.closest('button, input, a, .okr-ferr')) return;
    t.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(toques.size === 2){
      const [a, b] = [...toques.values()];
      pinca = { d: Math.hypot(a.x - b.x, a.y - b.y), k: OKR.vista.k }; arr = null;
    } else arr = { x:e.clientX, y:e.clientY, vx:OKR.vista.x, vy:OKR.vista.y };
    t.classList.add('arrastando');
  });
  t.addEventListener('pointermove', e => {
    if(!toques.has(e.pointerId)) return;
    toques.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if(pinca && toques.size === 2){
      const [a, b] = [...toques.values()], r = t.getBoundingClientRect();
      okrZoom((pinca.k * Math.hypot(a.x - b.x, a.y - b.y) / pinca.d) / OKR.vista.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    } else if(arr){
      OKR.vista.x = arr.vx + e.clientX - arr.x; OKR.vista.y = arr.vy + e.clientY - arr.y; okrAplicarVista();
    }
  });
  const soltar = e => { toques.delete(e.pointerId); if(toques.size < 2) pinca = null; if(!toques.size){ arr = null; t.classList.remove('arrastando'); } };
  t.addEventListener('pointerup', soltar); t.addEventListener('pointercancel', soltar);
  t.addEventListener('wheel', e => {
    if(e.target.closest('.okr-ferr')) return;
    e.preventDefault();
    const r = t.getBoundingClientRect();
    if(e.ctrlKey || e.metaKey) okrZoom(Math.exp(-e.deltaY * .0025), e.clientX - r.left, e.clientY - r.top);
    else { OKR.vista.x -= e.deltaX; OKR.vista.y -= e.deltaY; okrAplicarVista(); }
  }, { passive:false });
  t.addEventListener('keydown', e => {
    if(e.target.closest('input')) return;
    if(e.key === '+' || e.key === '='){ e.preventDefault(); okrZoom(1.2); }
    else if(e.key === '-'){ e.preventDefault(); okrZoom(1/1.2); }
    else if(e.key === '0'){ e.preventDefault(); okrEnquadrar(true); }
    else if(e.key.startsWith('Arrow')){
      e.preventDefault(); const d = 60;
      OKR.vista.x += e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0;
      OKR.vista.y += e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0; okrAplicarVista();
    }
  });
}
function okrBuscar(v){
  const el = $('#okr-achados'); if(!el) return;
  const q = norm(v);
  const achados = q ? OKR.itens.filter(o => norm(o.titulo).includes(q) || norm(o.codigo).includes(q)).slice(0, 7) : [];
  el.innerHTML = achados.length ? `<div class="org-res">${achados.map(o => `<div class="op" onclick="okrIrPara('${o.id}')">
      <span class="okr-cod">${esc(o.codigo)}</span><span>${esc(o.titulo)}</span></div>`).join('')}</div>` : '';
}
function okrIrPara(id){ const q = $('#okr-q'); if(q) q.value = ''; okrBuscar(''); focarOKR(id); }

/* ============================================================
   DETALHE E COMENTÁRIOS
   ============================================================ */
function modalOKRDetalhe(id){
  const o = okrPorId(id); if(!o) return;
  const pz = okrPrazoInfo(o), pr = okrProgresso(o), ms = okrResps(o);
  const pai = o.pai_id ? okrPorId(o.pai_id) : null;
  const podeEd = okrPodeEditar(o);
  abreModal(`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px">
      <span class="okr-cod">${esc(o.codigo)}</span>
      <span class="small dim">${OKR_NIVEL[o.nivel]||o.nivel} · ciclo ${o.ano}</span>
      <span style="flex:1"></span>${okrPill(o.status)}
    </div>
    <h3 style="margin-bottom:6px">${esc(o.titulo)}</h3>
    ${pai?`<div class="small muted" style="margin-bottom:12px">Desdobra
      <a href="#/okrs/${encodeURIComponent(pai.codigo)}" onclick="fechaModal()" style="text-decoration:underline">${esc(pai.codigo)}</a>
      — ${esc(pai.titulo)}</div>`:''}
    ${o.descricao?`<p class="small muted" style="line-height:1.6;margin-bottom:14px;white-space:pre-wrap">${esc(o.descricao)}</p>`:''}
    <dl class="dl" style="margin-bottom:16px">
      <div class="it"><dt>Eixo</dt><dd>${okrEixoChip(o.eixo)||'—'}</dd></div>
      <div class="it"><dt>Prazo</dt><dd><span class="okr-prazo ${pz.cls}">${pz.txt}</span></dd></div>
      <div class="it"><dt>Responsáveis</dt><dd>${ms.length?esc(ms.map(m=>m.nome).join(', ')):'<span class="dim">—</span>'}</dd></div>
      ${pr?`<div class="it"><dt>Progresso do desdobramento</dt><dd>${pr.done}/${pr.total} concluídos (${pr.pct}%)</dd></div>`:''}
      <div class="it"><dt>Atualizado em</dt><dd>${fmtDT(o.atualizado_em)}</dd></div>
    </dl>
    ${podeEd?`<div class="fld"><label>Mover status</label><div class="chips">
      ${Object.keys(OKR_STATUS).map(s=>`<button class="chip ${o.status===s?'on':''}" onclick="okrMudarStatus('${o.id}','${s}')">${s}</button>`).join('')}
    </div></div>`:''}
    <h3 style="margin:18px 0 6px;font-size:15px">Comentários</h3>
    <div id="okr-coms" style="max-height:280px;overflow-y:auto"><div class="carregando" style="padding:18px 0"><span class="spin"></span></div></div>
    <div class="fld" style="margin-top:12px"><label>Novo comentário</label>
      <textarea id="okr-novo-com" rows="3" placeholder="Registro de acompanhamento, decisões, bloqueios…"></textarea></div>
    <div class="acts" style="justify-content:space-between">
      <span>${can()?`<button class="btn perigo" onclick="okrExcluir('${o.id}')">${ic('trash')} Excluir</button>`:''}</span>
      <span style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn ghost" onclick="fechaModal()">Fechar</button>
        ${podeEd?`<button class="btn ghost" onclick="modalOKREditar('${o.id}',null)">${ic('pencil')} Editar</button>`:''}
        <button class="btn solid" id="okr-com-btn" onclick="okrComentar('${o.id}')">${ic('chat')} Comentar</button>
      </span>
    </div>`, 'largo');
  okrCarregarComentarios(id);
}
async function okrCarregarComentarios(id){
  const el = $('#okr-coms'); if(!el) return;
  try{
    const {data, error} = await sb.from('okr_comentarios').select('*')
      .eq('objetivo_id', id).order('criado_em',{ascending:false});
    if(error) throw error;
    el.innerHTML = (data&&data.length) ? data.map(c=>`<div class="okr-com ${c.tipo==='sistema'?'sistema':''}">
        <div class="hd"><b>${esc(c.autor)}</b> · ${fmtDT(c.criado_em)}${c.tipo==='sistema'?' · automático':''}</div>
        <div class="tx">${esc(c.texto)}</div></div>`).join('')
      : '<div class="empty">Nenhum comentário ainda. Registre o primeiro acompanhamento.</div>';
  }catch(e){ el.innerHTML = `<div class="aviso-box err">Erro ao carregar os comentários: ${esc(e.message)}</div>`; }
}
async function okrComentar(id){
  const campo = $('#okr-novo-com'), bt = $('#okr-com-btn');
  const t = (campo?.value||'').trim();
  if(!t){ toast('Escreva o comentário antes de enviar.', true); return; }
  if(bt) bt.disabled = true;
  try{
    const {error} = await sb.from('okr_comentarios').insert({objetivo_id:id, autor:quemSouEu(),
      registro: state.perfil?.registro||null, texto:t});
    if(error) throw error;
    campo.value='';
    okrCarregarComentarios(id);
  }catch(e){ falha(e,'Erro ao comentar'); }
  finally{ if(bt) bt.disabled = false; }
}
async function okrLogSistema(id, texto){
  try{ await sb.from('okr_comentarios').insert({objetivo_id:id, autor:quemSouEu(),
    registro: state.perfil?.registro||null, tipo:'sistema', texto}); }
  catch(e){ console.error('histórico do OKR', e); }
}
async function okrMudarStatus(id, novo){
  const o = okrPorId(id); if(!o || o.status===novo) return;
  try{
    const {error} = await sb.from('okr_objetivos').update({status:novo}).eq('id', id);
    if(error) throw error;
    await okrLogSistema(id, `Status alterado de "${o.status}" para "${novo}".`);
    await okrCarregar();
    modalOKRDetalhe(id);
    if(route().r==='okrs') okrDesenharTela();
  }catch(e){ falha(e,'Erro ao mudar o status'); }
}

/* ============================================================
   CRIAR, EDITAR, EXCLUIR
   ============================================================ */
function okrSugereCodigo(pai){
  if(!pai){
    const ns = okrRaizes().map(o=>parseInt(String(o.codigo).replace(/\D+/g,''),10)).filter(n=>!isNaN(n));
    return 'OE' + ((ns.length?Math.max(...ns):0)+1);
  }
  const nivel = OKR_SUBNIVEL[pai.nivel]||'operacional';
  const base = String(pai.codigo).replace(/^[A-Za-z]+/,'');
  const ns = okrFilhos(pai.id).map(o=>parseInt(String(o.codigo).split('.').pop(),10)).filter(n=>!isNaN(n));
  return (OKR_PREFIXO[nivel]||'OKR') + base + '.' + ((ns.length?Math.max(...ns):0)+1);
}
function modalOKREditar(id, paiId){
  const o = id ? okrPorId(id) : null;
  if(id && !o) return;
  if(o && !okrPodeEditar(o)){ toast('Você não tem permissão para editar este objetivo.', true); return; }
  const pai = o ? (o.pai_id?okrPorId(o.pai_id):null) : (paiId?okrPorId(paiId):null);
  const nivel = o ? o.nivel : (pai ? (OKR_SUBNIVEL[pai.nivel]||'operacional') : 'estrategico');
  const eixos = [...new Set([...Object.keys(OKR_EIXOS_CORES), ...OKR.itens.map(x=>x.eixo).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,'pt-BR'));
  const membros = state.membros.filter(m=>['Ativo','Em pausa / avaliação','Sob demanda'].includes(m.status))
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'));
  const sel = o ? (o.responsaveis||[]) : [];
  const ano = o ? o.ano : (pai ? pai.ano : new Date().getFullYear());
  const temFilhos = o ? okrFilhos(o.id).length : 0;
  abreModal(`<h3>${o?'Editar objetivo':'Novo objetivo'} <span class="small dim" style="font-weight:400">· ${OKR_NIVEL[nivel]||nivel}${pai?` · desdobra ${esc(pai.codigo)}`:''}</span></h3>
    <div class="form-grid" style="margin-top:14px">
      <div class="fld"><label>Código</label><input id="okr-f-codigo" value="${esc(o?o.codigo:okrSugereCodigo(pai))}"></div>
      <div class="fld"><label>Status</label><select id="okr-f-status">${Object.keys(OKR_STATUS).map(s=>`<option ${((o?o.status:'Não iniciado')===s)?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="fld full"><label>Título</label><input id="okr-f-titulo" value="${esc(o?o.titulo:'')}" placeholder="ex.: Finalizar versão estável do FES-Connect até Q2"></div>
      <div class="fld full"><label>Descrição / critério de sucesso (opcional)</label><textarea id="okr-f-desc" rows="3">${esc(o?o.descricao||'':'')}</textarea></div>
      <div class="fld"><label>Eixo</label><input id="okr-f-eixo" list="dl-okr-eixos" value="${esc(o?o.eixo||'':'')}" placeholder="ex.: Tecnologia">
        <datalist id="dl-okr-eixos">${eixos.map(e=>`<option value="${esc(e)}">`).join('')}</datalist></div>
      <div class="fld"><label>Ano do ciclo</label><input id="okr-f-ano" type="number" value="${ano}"></div>
      <div class="fld full"><label>Prazo</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <input type="date" id="okr-f-prazo" value="${esc(o?o.prazo||'':'')}" style="max-width:180px">
          ${['Q1','Q2','Q3','Q4'].map((qq,i)=>`<button type="button" class="btn ghost mini" onclick="okrPrazoTrim(${i})" title="Fim do ${qq} do ano do ciclo">${qq}</button>`).join('')}
          ${temFilhos?`<button type="button" class="btn ghost mini" onclick="okrPrazoDosFilhos('${o.id}')" title="Usa o prazo mais distante entre os desdobramentos">${ic('cal')} Pelos desdobramentos</button>`:''}
        </div></div>
      <div class="fld full"><label>Responsáveis</label>
        <div class="multi">${membros.map(m=>`<label class="check"><input type="checkbox" class="okr-resp" value="${m.registro}" ${sel.includes(m.registro)?'checked':''}> ${esc(m.nome)} <span class="small dim">· ${esc(m.cargo||m.departamento||'')}</span></label>`).join('')
          || '<div class="small dim">Nenhum membro ativo no quadro.</div>'}</div></div>
    </div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="${o?`modalOKRDetalhe('${o.id}')`:'fechaModal()'}">Cancelar</button>
      <button class="btn solid" id="okr-salvar" onclick="okrSalvar(${o?`'${o.id}'`:'null'}, ${pai?`'${pai.id}'`:'null'}, '${nivel}')">${ic('check')} Salvar</button>
    </div>`, 'largo');
}
function okrPrazoTrim(i){
  const ano = parseInt($('#okr-f-ano').value,10) || new Date().getFullYear();
  $('#okr-f-prazo').value = `${ano}-${['03-31','06-30','09-30','12-31'][i]}`;
}
function okrPrazoDosFilhos(id){
  const prazos = okrFilhos(id).filter(f=>f.status!=='Cancelado').map(f=>f.prazo).filter(Boolean).sort();
  if(!prazos.length){ toast('Nenhum desdobramento com prazo definido.', true); return; }
  $('#okr-f-prazo').value = prazos[prazos.length-1];
  toast('Prazo recalculado: o mais distante entre os desdobramentos. Salve para confirmar.');
}
async function okrSalvar(id, paiId, nivel){
  const o = id ? okrPorId(id) : null;
  const codigo = $('#okr-f-codigo').value.trim();
  const titulo = $('#okr-f-titulo').value.trim();
  if(!codigo || !titulo){ toast('Código e título são obrigatórios.', true); return; }
  if(OKR.itens.some(x=>norm(x.codigo)===norm(codigo) && x.id!==id)){ toast('Já existe um objetivo com este código.', true); return; }
  const dados = {
    codigo, titulo, nivel,
    descricao: $('#okr-f-desc').value.trim()||null,
    eixo: $('#okr-f-eixo').value.trim()||null,
    ano: parseInt($('#okr-f-ano').value,10)||new Date().getFullYear(),
    prazo: $('#okr-f-prazo').value||null,
    status: $('#okr-f-status').value,
    responsaveis: marcados('okr-resp').map(v=>parseInt(v,10))
  };
  const bt = $('#okr-salvar'); if(bt) bt.disabled = true;
  try{
    if(o){
      const {error} = await sb.from('okr_objetivos').update(dados).eq('id', o.id);
      if(error) throw error;
      if((o.prazo||null)!==(dados.prazo||null))
        await okrLogSistema(o.id, `Prazo alterado de ${o.prazo?fmtD(o.prazo):'—'} para ${dados.prazo?fmtD(dados.prazo):'—'}.`);
      if(o.status!==dados.status)
        await okrLogSistema(o.id, `Status alterado de "${o.status}" para "${dados.status}".`);
      toast('Objetivo atualizado.');
    }else{
      const irmaos = paiId ? okrFilhos(paiId) : okrRaizes();
      dados.pai_id = paiId||null;
      dados.ordem = irmaos.length ? Math.max(...irmaos.map(f=>f.ordem||0))+10 : 10;
      const {data:novo, error} = await sb.from('okr_objetivos').insert(dados).select('id').single();
      if(error) throw error;
      OKR.foco = novo?.id || OKR.foco;
      toast('Objetivo criado.');
    }
    fechaModal();
    await okrCarregar();
    /* objetivo estratégico novo ou renomeado muda o menu lateral */
    if(nivel === 'estrategico') carregarOKRsDoMenu();
    if(route().r==='okrs'){
      const f = okrPorId(OKR.foco);
      if(paiId) OKR.abertos.add(paiId);
      if(f && decodeURIComponent(route().sub||'') !== f.codigo) focarOKR(f.id); else okrDesenharTela();
    }
  }catch(e){ falha(e,'Erro ao salvar o objetivo'); }
  finally{ if(bt) bt.disabled = false; }
}
async function okrExcluir(id){
  const o = okrPorId(id); if(!o) return;
  const n = okrDescendentes(id).length;
  if(!await confirma(`Excluir <b>${esc(o.codigo)} — ${esc(o.titulo)}</b>?`
      +(n?`<br>Os ${n} desdobramento(s) abaixo dele serão excluídos junto.`:'')
      +'<br>Os comentários também são removidos.','Excluir')){ modalOKRDetalhe(id); return; }
  try{
    const {error} = await sb.from('okr_objetivos').delete().eq('id', id);
    if(error) throw error;
    OKR.foco = o.pai_id||null;
    await okrCarregar();
    if(!o.pai_id) carregarOKRsDoMenu();
    toast('Objetivo excluído.');
    if(route().r==='okrs'){
      const f = okrPorId(OKR.foco) || okrRaizes()[0];
      if(f) focarOKR(f.id); else pageOkrs(null);
    }
  }catch(e){ falha(e,'Erro ao excluir'); }
}

/* A busca global acha objetivo por código ou título — depois que a
   tela de OKRs foi aberta uma vez, como as atividades. */
registrarBusca({
  fonte:'okrs', rotulo:'OKRs',
  buscar: (t) => filtrarSimples(OKR.itens.map(o => ({
    titulo: o.titulo,
    sub: `${OKR_NIVEL[o.nivel]||o.nivel} · ${o.status}`,
    codigo: o.codigo,
    href: '#/okrs/' + encodeURIComponent(o.codigo)
  })), t, 6)
});
