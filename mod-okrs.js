/* ============================================================
   MÓDULO · OKRs — planejamento estratégico
   Veio do SOMA · Gestão (soma-legado.html, SOMA 8.0), com a lógica
   intacta e a marcação refeita para o portal. É uma árvore de
   objetivos — estratégico → tático → operacional —, desenhada como o
   organograma: quem está acima, o objetivo em foco, os desdobramentos
   dele e os que estão no mesmo nível. Cada objetivo tem responsáveis,
   prazo, status e comentários.

   Rotas:
     #/okrs            o primeiro objetivo estratégico em foco
     #/okrs/<codigo>   um objetivo (OE1, OT1.2…) — o endereço firma no
                       código do que está em foco, para o link copiado
                       abrir o mesmo lugar

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
      <h1>OKRs</h1><p class="lead">Os objetivos da equipe e o desdobramento de cada um: do estratégico
      ao operacional, com responsáveis, prazo e o registro do acompanhamento.</p></div>
    ${can() ? `<div class="acoes"><button class="btn solid" onclick="modalOKREditar(null,null)">${ic('plus')}
      Novo objetivo estratégico</button></div>` : ''}</div>`;
  if(!OKR.pronto){
    $('#main').innerHTML = topo + '<div class="carregando"><span class="spin"></span> Carregando o planejamento…</div>';
    try{ await okrCarregar(); }
    catch(e){
      OKR.erro = e;
      $('#main').innerHTML = topo + `<div class="aviso-box err">Não foi possível carregar os OKRs: ${esc(e.message)}.
        Se a tabela <span class="mono">okr_objetivos</span> ainda não existir, a migração
        <b>db/aplicadas/soma_v08_okrs.sql</b> precisa ser aplicada no Supabase.</div>`;
      return;
    }
  }
  if(!OKR.itens.length){
    $('#main').innerHTML = topo + `<div class="vazio"><div class="glyph">0</div><h3>Nenhum objetivo ainda</h3>
      <p>${can()?'Comece pelo primeiro objetivo estratégico, no botão acima.':'Quando a gestão cadastrar os objetivos, eles aparecem aqui.'}</p></div>`;
    return;
  }
  const alvo = sub && okrPorCodigo(decodeURIComponent(sub));
  if(alvo) OKR.foco = alvo.id;
  if(!OKR.foco || !okrPorId(OKR.foco)) OKR.foco = (okrRaizes()[0]||OKR.itens[0]).id;
  /* o endereço diz qual objetivo está em foco (replaceState não dispara
     hashchange; o roteador remarca o menu depois de desenhar) */
  const aqui = '#/okrs/' + encodeURIComponent(okrPorId(OKR.foco).codigo);
  if(location.hash !== aqui) history.replaceState(null, '', location.pathname + location.search + aqui);
  $('#main').innerHTML = topo + '<div id="okr-area"></div>';
  desenhaOKR('');
}
/* Focar é navegar: o objetivo ganha endereço e o voltar do navegador volta. */
function focarOKR(id){
  const o = okrPorId(id); if(!o) return;
  location.hash = '#/okrs/' + encodeURIComponent(o.codigo);
}

function cartaoOKR(o){
  const pr = okrProgresso(o), pz = okrPrazoInfo(o);
  const nf = okrFilhos(o.id).length, ms = okrResps(o);
  return `<button class="okr-card" onclick="focarOKR('${o.id}')" title="${esc(o.titulo)}">
    <span class="ln1"><span class="okr-cod">${esc(o.codigo)}</span>${okrPill(o.status)}${okrEixoChip(o.eixo)}</span>
    <span class="nm">${esc(o.titulo)}</span>
    <span class="mt"><span class="okr-prazo ${pz.cls}">${pz.txt}</span>
      ${ms.length?okrRespAvatares(o):''}${nf?`<span>${nf} desdobramento${nf===1?'':'s'}</span>`:''}</span>
    ${pr?okrBarra(pr):''}
  </button>`;
}
function desenhaOKR(filtro){
  const el = $('#okr-area'); if(!el) return;
  const foco = okrPorId(OKR.foco);
  if(!foco){ OKR.foco=null; pageOkrs(null); return; }
  const cadeia = okrCadeia(foco);
  const filhos = okrFilhos(foco.id);
  const irmaos = (foco.pai_id && okrPorId(foco.pai_id) ? okrFilhos(foco.pai_id) : okrRaizes()).filter(o=>o.id!==foco.id);
  const q = norm(filtro);
  const achados = q ? OKR.itens.filter(o=>(norm(o.titulo).includes(q)||norm(o.codigo).includes(q)) && o.id!==foco.id).slice(0,7) : [];
  const raizAtual = cadeia.length ? cadeia[0] : foco;
  const pz = okrPrazoInfo(foco), pr = okrProgresso(foco), ms = okrResps(foco);
  el.innerHTML = `
    <div class="okr-oes">${okrRaizes().map(o=>{const p=okrProgresso(o);
      return `<button class="okr-oe ${o.id===raizAtual.id?'on':''}" onclick="focarOKR('${o.id}')" title="${esc(o.titulo)}">
        <span class="cd">${esc(o.codigo)}</span><span class="tt">${esc(o.titulo)}</span>
        ${p?okrBarra(p).replace('okr-prog"','okr-prog" style="margin:0"'):okrPill(o.status)}
      </button>`;}).join('')}</div>
    <div class="org-busca">
      <input id="okr-q" placeholder="Buscar objetivo por código ou título…" value="${esc(filtro)}" oninput="desenhaOKR(this.value)">
      ${achados.length?`<div class="org-res">${achados.map(o=>`<div class="op" onclick="focarOKR('${o.id}')">
        <span class="okr-cod">${esc(o.codigo)}</span><span>${esc(o.titulo)}</span></div>`).join('')}</div>`:''}
    </div>
    <div class="org-chain">
      ${cadeia.map(o=>cartaoOKR(o)+'<span class="org-link"></span>').join('')}
      <div class="okr-card okr-focus">
        <span class="ln1"><span class="okr-cod">${esc(foco.codigo)}</span>
          <span class="small dim">${OKR_NIVEL[foco.nivel]||foco.nivel} · ${foco.ano}</span>
          <span style="flex:1"></span>${okrPill(foco.status)}</span>
        <span class="nm" style="font-size:16px">${esc(foco.titulo)}</span>
        ${foco.descricao?`<span class="small muted" style="display:block;margin-top:5px;line-height:1.55;white-space:pre-wrap">${esc(foco.descricao)}</span>`:''}
        <span class="mt" style="margin-top:10px">${okrEixoChip(foco.eixo)}<span class="okr-prazo ${pz.cls}">${pz.txt}</span></span>
        <span class="mt" style="margin-top:10px">${okrRespAvatares(foco)}
          ${ms.length?`<span class="small muted">${esc(ms.map(m=>String(m.nome||'').split(' ')[0]).join(', '))}</span>`:''}</span>
        ${pr?okrBarra(pr, `${pr.done}/${pr.total} concluídos · ${pr.pct}%`):''}
        <span class="mt" style="margin-top:14px;gap:8px">
          <button class="btn ghost mini" onclick="modalOKRDetalhe('${foco.id}')">${ic('eye')} Detalhes e comentários</button>
          ${can()?`<button class="btn ghost mini" onclick="modalOKREditar(null,'${foco.id}')">${ic('plus')} Desdobrar</button>`:''}
        </span>
      </div>
    </div>
    <div class="org-bottom">
      <div class="org-sec"><h4>Desdobramentos (${filhos.length})</h4>
        ${filhos.length? filhos.map(cartaoOKR).join('') : `<div class="empty">Este objetivo ainda não foi desdobrado.${can()?' Use o botão “Desdobrar” acima.':''}</div>`}</div>
      <div class="org-sec"><h4>No mesmo nível (${irmaos.length})</h4>
        ${irmaos.length? irmaos.map(cartaoOKR).join('') : '<div class="empty">Nenhum outro objetivo neste nível.</div>'}</div>
    </div>`;
  if(q){ const inp = document.getElementById('okr-q');
    if(inp){ inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); } }
}

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
    if(route().r==='okrs') desenhaOKR('');
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
      if(f && decodeURIComponent(route().sub||'') !== f.codigo) focarOKR(f.id); else desenhaOKR('');
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
