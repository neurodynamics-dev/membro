/* ============================================================
   MÓDULO · STUDIO — o planejamento do conteúdo digital
   O quadro das publicações (ideia → produção → aprovação → pronta
   → publicada), o calendário da conta, as ideias soltas, a página
   de cada publicação — com o plano, a arte para baixar, a
   aprovação e o histórico — e as configurações: quem entra, quem
   aprova, as contas, a imprensa do site e os recursos de imagem.

   O criador (a arte) é outro módulo, mod-criador.js, que este
   carrega antes de abrir a tela dele.

   Rotas:
     #/studio                      o quadro
     #/studio/calendario           o mês, com o que sai em cada dia
     #/studio/ideias               as ideias soltas, e a captura rápida
     #/studio/criar[/<modelo>]     o criador (mod-criador)
     #/studio/modelos              a galeria dos modelos (mod-criador)
     #/studio/POST-14              uma publicação
     #/studio/POST-14/arte         a arte dela, no criador
     #/studio/config[/<aba>]       acesso, contas, imprensa, recursos

   Precisa da migração db/v23_studio.sql.

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, ibtn, confirma, falha, motivoRPC,
   avatarFoto, nomeDe, primeiroNome, copiar, carregarModulo,
   carregarLib, registrarBusca, filtrarSimples, can, grupoPorId,
   gruposEfetivos, carregarStudioConfig, podeStudio,
   podeAprovarStudio, STUDIO_STATUS, STUDIO_REDES, STUDIO_FORMATOS,
   STUDIO_PILARES, STUDIO_TIPOS, studioTipo, MES_CURTO, DIAS_LB.
   ============================================================ */

const studioM = { pubs:[], aprov:[], erro:null, lembrou:false, urls:{},
  filtro:{ rede:'', quem:'', q:'' }, verPublicadas:false,
  cal:{ ano:new Date().getFullYear(), mes:new Date().getMonth() }, pilar:'',
  recursos:null, imprensa:null, arrastando:null };

const ST_COLUNAS = STUDIO_STATUS.map(s => s[0]);
const ST_COR_STATUS = { ideia:'var(--dim)', producao:'var(--info)', aprovacao:'var(--warn)', pronta:'var(--syn-borda)', publicada:'var(--ok)', arquivada:'var(--dim)' };
const stRotStatus = s => STUDIO_STATUS.find(x => x[0] === s)?.[1] || (s === 'arquivada' ? 'Arquivada' : s);
const stEu = () => state.perfil?.registro;
const stMin = () => state.studioCfg?.aprovacoes_minimas || 1;

/* ---------------- dados ---------------- */
const ST_COLS = 'id,numero,codigo,titulo,status,modelo,categoria,pilar,redes,formato,data_publicacao,responsavel,criado_por,'
  + 'imagens,versao,enviado_por,enviado_em,aprovado_em,link,publicado_em,colaboradores,criado_em,atualizado_em';
async function stCarregar(){
  const [p, a] = await Promise.all([
    sb.from('studio_publicacoes').select(ST_COLS).order('data_publicacao', { ascending:true }),
    sb.from('studio_aprovacoes').select('publicacao_id,versao,registro,nome,decisao,criado_em')
  ]);
  if (p.error){ studioM.erro = p.error; return false; }
  studioM.erro = null;
  studioM.pubs = p.data || [];
  studioM.aprov = a.data || [];
  /* o lembrete da véspera: se o pg_cron não estiver ligado, quem abre o
     Studio dispara (a função é idempotente) */
  if (!studioM.lembrou){ studioM.lembrou = true; sb.rpc('studio_lembretes').then(() => {}, () => {}); }
  return true;
}
const stAprovacoes = p => studioM.aprov.filter(a => a.publicacao_id === p.id && a.versao === p.versao && a.decisao === 'aprovada');
const stEsperaMim = p => p.status === 'aprovacao' && podeAprovarStudio() && p.enviado_por !== stEu()
  && !stAprovacoes(p).some(a => a.registro === stEu());
/* links assinados das artes, guardados por uma hora */
async function stUrls(caminhos){
  const agora = Date.now();
  const faltam = [...new Set(caminhos.filter(c => c && !(studioM.urls[c]?.ate > agora)))];
  if (faltam.length){
    const { data } = await sb.storage.from('studio').createSignedUrls(faltam, 3600).catch(() => ({ data:null })) || {};
    (data || []).forEach(d => { if (d.signedUrl) studioM.urls[d.path] = { url: d.signedUrl, ate: agora + 3500e3 }; });
  }
  return c => studioM.urls[c]?.url || '';
}
function stQuando(iso, curto){
  if (!iso) return '';
  const d = new Date(iso);
  const dia = d.toLocaleDateString('pt-BR', curto ? { day:'2-digit', month:'2-digit' } : { weekday:'short', day:'2-digit', month:'short' }).replace('.', '');
  return `${dia} · ${d.toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`;
}
const stAtrasada = p => p.data_publicacao && !['publicada', 'arquivada'].includes(p.status) && new Date(p.data_publicacao) < new Date();
const stRedesHTML = redes => (redes || []).map(r => { const x = STUDIO_REDES[r];
  return x ? `<span class="st-rede" style="--c:${x.c}" title="${esc(x.l)}">${esc(x.s)}</span>` : ''; }).join('');

/* ---------------- a rota ---------------- */
async function pageStudio(sub, sub2){
  if (sub === 'criar' || sub === 'modelos'){
    $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Abrindo o criador…</div>';
    try { await carregarModulo('criador'); }
    catch(e){ $('#main').innerHTML = `<div class="aviso-box err">O criador não carregou (${esc(e.message)}). Recarregue a página.</div>`; return; }
    return sub === 'criar' ? crPaginaCriar(sub2) : crPaginaModelos();
  }
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Carregando o Studio…</div>';
  const ok = await stCarregar();
  if (!ok){
    $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Studio</span><h1>Studio</h1></div></div>
      <div class="aviso-box err"><b>O Studio ainda não está no banco.</b> ${esc(studioM.erro?.message || '')}<br>
      <span class="small">Falta aplicar a migração <code>db/v23_studio.sql</code>. O criador já funciona:
      <a href="#/studio/criar">criar uma peça</a> e baixar, sem salvar no quadro.</span></div>`;
    return;
  }
  if (!sub) return stQuadro();
  if (sub === 'calendario') return stCalendario();
  if (sub === 'ideias') return stIdeias();
  if (sub === 'config') return stConfig(sub2 || 'acesso');
  if (/^post-\d+$/i.test(sub)){
    const cod = sub.toUpperCase();
    if (sub2 === 'arte'){
      const { data, error } = await sb.from('studio_publicacoes').select('*').eq('codigo', cod).maybeSingle();
      if (error || !data) return stNaoAchou(cod);
      try { await carregarModulo('criador'); } catch(e){ return toast('O criador não carregou: ' + e.message, true); }
      return crPaginaArte(data);
    }
    return stPublicacao(cod);
  }
  return stNaoAchou(sub);
}
function stNaoAchou(cod){
  $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div>
    <h3>Nada com o código ${esc(cod)}</h3><p>A publicação pode ter sido apagada. Procure no quadro.</p>
    <a class="btn ghost" href="#/studio">Quadro do Studio</a></div>`;
}
/* a navegação de dentro do Studio: a mesma linha de links de Arquivos */
function stNav(atual){
  const n = studioM.pubs.filter(stEsperaMim).length;
  const it = [['', 'Quadro'], ['calendario', 'Calendário'], ['ideias', 'Ideias'], ['criar', 'Criar'], ['modelos', 'Modelos'], ['config', 'Configurações']];
  return `<nav class="arq-nav st-nav" aria-label="Studio">${it.map(([k, l]) =>
    `<a href="#/studio${k ? '/' + k : ''}" class="${atual === k ? 'on' : ''}">${l}${k === '' && n
      ? ` <span class="n sua" title="Esperando a sua aprovação">${n}</span>` : ''}</a>`).join('')}</nav>`;
}
function stTopo(titulo, lead, acoes){
  return `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Studio</span><h1>${titulo}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}</div>
    <div class="acoes">${acoes ?? `<button class="btn ghost mini" onclick="stModalIdeia()">${ic('lampada')} Nova ideia</button>
      <a class="btn solid mini" href="#/studio/criar">${ic('plus')} Criar publicação</a>`}</div></div>`;
}

/* ============================================================
   O QUADRO
   ============================================================ */
function stFiltradas(){
  const f = studioM.filtro, q = norm(f.q);
  return studioM.pubs.filter(p => p.status !== 'arquivada'
    && (!f.rede || (p.redes || []).includes(f.rede))
    && (!f.quem || p.responsavel === stEu() || p.criado_por === stEu())
    && (!q || norm([p.codigo, p.titulo, p.categoria && studioTipo(p.categoria)?.[1]].join(' ')).includes(q)));
}
async function stQuadro(){
  const f = studioM.filtro;
  const vis = stFiltradas();
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const semana = new Date(hoje.getTime() + 7 * 864e5);
  const nSemana = vis.filter(p => p.data_publicacao && new Date(p.data_publicacao) >= hoje && new Date(p.data_publicacao) < semana && p.status !== 'publicada').length;
  const nAtras = vis.filter(stAtrasada).length;
  const nMim = vis.filter(stEsperaMim).length;
  const redesUsadas = [...new Set(studioM.pubs.flatMap(p => p.redes || []))].filter(r => STUDIO_REDES[r]);
  $('#main').innerHTML = `${stTopo('Quadro de publicações', 'Da ideia ao ar. Arraste o cartão para mudar de coluna — menos para “Pronta para publicar”: lá só se chega pela aprovação.')}
    ${stNav('')}
    <div class="st-resumo">
      <span class="st-num"><b>${nSemana}</b> nos próximos 7 dias</span>
      <span class="st-num${nMim ? ' vez' : ''}"><b>${nMim}</b> esperando a sua aprovação</span>
      <span class="st-num${nAtras ? ' atras' : ''}"><b>${nAtras}</b> com a data vencida</span>
      <span class="st-num"><b>${vis.filter(p => !p.data_publicacao && p.status !== 'publicada').length}</b> sem data</span></div>
    <div class="filtros kb-filtros">
      <div class="seg" role="group" aria-label="Rede"><button class="${!f.rede ? 'on' : ''}" onclick="studioM.filtro.rede='';stQuadro()">Todas</button>
        ${redesUsadas.map(r => `<button class="${f.rede === r ? 'on' : ''}" onclick="studioM.filtro.rede='${r}';stQuadro()">${esc(STUDIO_REDES[r].l)}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="De quem"><button class="${!f.quem ? 'on' : ''}" onclick="studioM.filtro.quem='';stQuadro()">Da equipe</button>
        <button class="${f.quem ? 'on' : ''}" onclick="studioM.filtro.quem='eu';stQuadro()">Minhas</button></div>
      <div class="fld cresce"><input id="st-q" placeholder="Buscar por código ou título" value="${esc(f.q)}"
        oninput="studioM.filtro.q=this.value;clearTimeout(studioM._q);studioM._q=setTimeout(()=>{stQuadro();const e=$('#st-q');e.focus();e.setSelectionRange(e.value.length,e.value.length)},250)"></div>
    </div>
    <div class="kanban st-kanban" id="st-kanban">${ST_COLUNAS.map(st => stColuna(st, vis)).join('')}</div>`;
  stAjustaAltura();
  const urls = await stUrls(vis.map(p => p.imagens?.[0]?.caminho));
  document.querySelectorAll('.st-card[data-cam]').forEach(el => { const u = urls(el.dataset.cam);
    if (u) el.querySelector('.st-thumb').innerHTML = `<img src="${esc(u)}" alt="" loading="lazy">`; });
}
function stAjustaAltura(){
  const k = $('#st-kanban'); if (!k) return;
  if (window.innerWidth <= 900){ k.style.height = ''; return; }
  const topo = k.getBoundingClientRect().top + window.scrollY;
  k.style.height = Math.max(380, window.innerHeight - topo - 18) + 'px';
}
window.addEventListener('resize', () => { if ($('#st-kanban')) stAjustaAltura(); });
function stColuna(st, vis){
  let itens = vis.filter(p => p.status === st);
  if (st === 'publicada') itens.sort((a, b) => new Date(b.publicado_em || b.data_publicacao || 0) - new Date(a.publicado_em || a.data_publicacao || 0));
  else itens.sort((a, b) => (a.data_publicacao ? new Date(a.data_publicacao) : 8.64e15) - (b.data_publicacao ? new Date(b.data_publicacao) : 8.64e15));
  const total = itens.length;
  if (st === 'publicada' && !studioM.verPublicadas) itens = itens.slice(0, 12);
  const def = STUDIO_STATUS.find(s => s[0] === st);
  return `<div class="kb-col st-col" data-st="${st}" ondragover="event.preventDefault();this.classList.add('sobre')"
      ondragleave="this.classList.remove('sobre')" ondrop="stSoltar(event,'${st}')">
    <header title="${esc(def[2])}"><span><i class="st-pt" style="background:${ST_COR_STATUS[st]}"></i> ${esc(def[1])}</span><span class="n">${total}</span></header>
    <div class="kb-itens">${itens.map(stCartao).join('') || `<div class="kb-vazio">${st === 'ideia' ? 'Nenhuma ideia guardada.' : st === 'aprovacao' ? 'Nada esperando aprovação.' : 'Vazio.'}</div>`}
      ${st === 'publicada' && total > 12 ? `<button class="kb-add" onclick="studioM.verPublicadas=!studioM.verPublicadas;stQuadro()">${studioM.verPublicadas ? 'Mostrar só as recentes' : `Ver as ${total} publicadas`}</button>` : ''}</div>
    ${st === 'ideia' ? `<button class="kb-add" onclick="stModalIdeia()">${ic('plus')} Nova ideia</button>` : ''}
    ${st === 'producao' ? `<a class="kb-add" href="#/studio/criar" style="text-align:center">${ic('plus')} Criar publicação</a>` : ''}
  </div>`;
}
function stCartao(p){
  const ap = stAprovacoes(p), cam = p.imagens?.[0]?.caminho;
  const resp = (state.membros || []).find(m => m.registro === p.responsavel);
  const tipo = studioTipo(p.categoria);
  const pil = STUDIO_PILARES[p.pilar];
  return `<div class="kb-card st-card${stEsperaMim(p) ? ' vez' : ''}${stAtrasada(p) ? ' atras' : ''}" draggable="true" data-id="${p.id}"
      ${cam ? `data-cam="${esc(cam)}"` : ''} ondragstart="studioM.arrastando='${p.id}';this.classList.add('mov');event.dataTransfer.effectAllowed='move'"
      ondragend="this.classList.remove('mov')" onclick="location.hash='#/studio/${esc(p.codigo)}'">
    ${cam ? `<div class="st-thumb"></div>` : ''}
    <div class="kb-top"><span class="kb-ids"><span class="cod">${esc(p.codigo)}</span></span>
      <span class="st-redes">${stRedesHTML(p.redes)}</span></div>
    <div class="kb-tit">${esc(p.titulo)}</div>
    <div class="st-tags">${tipo ? `<span>${esc(tipo[1])}</span>` : ''}${p.formato ? `<span>${esc(STUDIO_FORMATOS[p.formato] || p.formato)}</span>` : ''}
      ${pil ? `<span class="pil" style="--c:${pil[2]}">${esc(pil[0])}</span>` : ''}</div>
    <div class="kb-pe"><span class="kb-meta">${p.data_publicacao ? `<span class="${stAtrasada(p) ? 'atrasado' : ''}">${esc(stQuando(p.data_publicacao, true))}</span>` : '<span>sem data</span>'}
      ${p.status === 'aprovacao' ? `<span title="Aprovações da versão atual">${ap.length}/${stMin()} ✓</span>` : ''}</span>
      ${resp ? avatarFoto(resp, 22, 9) : ''}</div>
    ${stEsperaMim(p) ? '<div class="st-aviso">Esperando a sua aprovação</div>' : ''}
  </div>`;
}
async function stSoltar(ev, st){
  ev.preventDefault();
  document.querySelectorAll('.st-col.sobre').forEach(c => c.classList.remove('sobre'));
  const p = studioM.pubs.find(x => x.id === studioM.arrastando); studioM.arrastando = null;
  if (!p || p.status === st) return;
  if (st === 'pronta' && stAprovacoes(p).length < stMin())
    return toast(p.status === 'aprovacao' ? 'Só a aprovação deixa pronta para publicar: quem aprova decide na página da publicação.'
      : 'Para ficar pronta, a publicação passa pela aprovação: mande para “Em aprovação”.', true);
  if (st === 'publicada'){
    if (p.status !== 'pronta') return toast('Só publicação pronta (aprovada) vai para publicada.', true);
    return stModalPublicada(p.id);
  }
  if (st === 'ideia' && p.imagens?.length && !await confirma(`${esc(p.codigo)} já tem arte. Voltar para ideias mesmo assim?`, 'Voltar')) return;
  await stMover(p.id, st);
}
async function stMover(id, st, link){
  const { data, error } = await sb.rpc('studio_mover', { p_id: id, p_status: st, p_link: link || null });
  if (error || data?.status !== 'ok'){
    toast(data?.status === 'precisa_aprovacao' ? 'Precisa da aprovação antes.' : motivoRPC(data, error, 'Não deu para mover'), true);
    return false;
  }
  toast(st === 'aprovacao' ? 'Mandada para aprovação — quem aprova foi avisado.' : `Movida para “${stRotStatus(st)}”.`);
  await stRecarregarTela();
  return true;
}
async function stRecarregarTela(){ const r = route(); await pageStudio(r.sub, r.sub2); }
function stModalPublicada(id){
  const p = studioM.pubs.find(x => x.id === id);
  abreModal(`<h3>${ic('check')} Marcar como publicada</h3>
    <p class="small muted" style="margin-bottom:12px">${esc(p?.codigo || '')} · ${esc(p?.titulo || '')}</p>
    <div class="fld"><label for="st-link">Link da publicação (opcional)</label><input id="st-link" type="url" placeholder="https://www.instagram.com/p/…"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="stPublicadaOk('${id}')">Publicada</button></div>`);
  setTimeout(() => $('#st-link')?.focus(), 30);
}
async function stPublicadaOk(id){ const l = $('#st-link').value.trim(); fechaModal(); await stMover(id, 'publicada', l); }

/* ============================================================
   IDEIAS
   ============================================================ */
const ST_PARTIDAS = {
  educar:        ['Como funciona, em 5 lâminas, a tecnologia de um dos nossos projetos', 'Um termo técnico explicado para quem não é da área', 'O erro mais comum de quem começa em eletrônica'],
  inspirar:      ['A história de um atleta ou paciente parceiro', 'Uma frase de alguém da equipe sobre por que faz o que faz', 'Uma data que importa para a engenharia e a saúde'],
  conectar:      ['Um dia de trabalho no LABBIO, em fotos', 'Quem é quem: apresentar um grupo da equipe', 'Parabéns para uma equipe parceira'],
  entreter:      ['Enquete: qual projeto você quer ver nos stories?', 'Antes e depois de um protótipo', 'Caixa de perguntas sobre engenharia biomédica'],
  institucional: ['Saímos na mídia: a reportagem mais recente', 'Artigo publicado: o resumo em linguagem simples', 'Conquista: o resultado de uma competição'],
  convidar:      ['Save the date do próximo evento', 'Processo seletivo: as inscrições abriram', 'Convite para conhecer o laboratório']
};
function stIdeias(){
  const ideias = studioM.pubs.filter(p => p.status === 'ideia' && (!studioM.pilar || p.pilar === studioM.pilar))
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em));
  const todas = studioM.pubs.filter(p => p.status === 'ideia');
  $('#main').innerHTML = `${stTopo('Ideias', 'Esboços sem data: às vezes só uma frase e o tipo de publicação. Quando uma amadurece, vira arte e vai para o quadro.',
      `<a class="btn solid mini" href="#/studio/criar">${ic('plus')} Criar publicação</a>`)}
    ${stNav('ideias')}
    <div class="st-ideia-nova card">
      <div class="fld"><label for="id-txt">A ideia</label>
        <textarea id="id-txt" rows="2" placeholder="Nem que seja uma frase — ex.: mostrar a bancada de testes da órtese num reels"></textarea></div>
      <div class="st-ideia-campos">
        <div class="fld"><label for="id-tipo">Tipo</label><select id="id-tipo" onchange="stIdeiaTipo(this.value)"><option value="">—</option>${STUDIO_TIPOS.map(t =>
          `<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select></div>
        <div class="fld"><label for="id-formato">Formato</label><select id="id-formato"><option value="">—</option>${Object.entries(STUDIO_FORMATOS).map(([k, l]) =>
          `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
        <div class="fld"><label for="id-pilar">Pilar</label><select id="id-pilar"><option value="">—</option>${Object.entries(STUDIO_PILARES).map(([k, [l]]) =>
          `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
        <div class="fld"><label>Onde</label><div class="st-chips-redes" id="id-redes">${stRedesChips([])}</div></div>
      </div>
      <div class="acts" style="justify-content:flex-end;margin-top:4px"><button class="btn solid mini" onclick="stGuardarIdeia()">${ic('lampada')} Guardar ideia</button></div>
      <details class="st-partidas"><summary>Sem ideia? Pontos de partida, por pilar</summary>
        <div class="st-partidas-g">${Object.entries(ST_PARTIDAS).map(([k, xs]) => `<div><b style="--c:${STUDIO_PILARES[k][2]}">${esc(STUDIO_PILARES[k][0])}</b>
          ${xs.map(x => `<button class="chip-b" onclick="$('#id-txt').value='${esc(x.replace(/'/g, '’'))}';$('#id-pilar').value='${k}';$('#id-txt').focus()">${esc(x)}</button>`).join('')}</div>`).join('')}</div>
      </details>
    </div>
    <div class="st-pilares-f"><button class="chip-b${!studioM.pilar ? ' on' : ''}" onclick="studioM.pilar='';stIdeias()">Todas · ${todas.length}</button>
      ${Object.entries(STUDIO_PILARES).map(([k, [l, , c]]) => { const n = todas.filter(p => p.pilar === k).length;
        return n ? `<button class="chip-b${studioM.pilar === k ? ' on' : ''}" style="--c:${c}" onclick="studioM.pilar='${k}';stIdeias()"><i class="pt"></i>${esc(l)} · ${n}</button>` : ''; }).join('')}</div>
    ${ideias.length ? `<div class="st-ideias">${ideias.map(stIdeiaCartao).join('')}</div>`
      : `<div class="vazio"><div class="glyph">✦</div><h3>${todas.length ? 'Nenhuma ideia neste pilar' : 'Nenhuma ideia guardada'}</h3>
        <p>${todas.length ? 'Veja todas as ideias.' : 'Escreva a primeira aí em cima — uma frase já basta.'}</p></div>`}`;
}
function stRedesChips(sel){
  return Object.entries(STUDIO_REDES).map(([k, r]) => `<button type="button" class="st-rchip${sel.includes(k) ? ' on' : ''}" data-rede="${k}" style="--c:${r.c}"
    aria-pressed="${sel.includes(k)}" onclick="this.classList.toggle('on');this.setAttribute('aria-pressed',this.classList.contains('on'))">${esc(r.l)}</button>`).join('');
}
const stRedesLidas = sel => [...document.querySelectorAll(sel + ' .st-rchip.on')].map(b => b.dataset.rede);
function stIdeiaTipo(t){
  const x = studioTipo(t); if (!x) return;
  if (x[2] && !$('#id-pilar').value) $('#id-pilar').value = x[2];
  if (x[3] && !$('#id-formato').value) $('#id-formato').value = x[3];
}
function stIdeiaCartao(p){
  const tipo = studioTipo(p.categoria), pil = STUDIO_PILARES[p.pilar];
  const quem = (state.membros || []).find(m => m.registro === p.criado_por);
  return `<article class="st-ideia" style="--c:${pil?.[2] || 'var(--line2)'}">
    <div class="st-ideia-tx">${esc(p.titulo)}</div>
    <div class="st-tags">${tipo ? `<span>${esc(tipo[1])}</span>` : ''}${p.formato ? `<span>${esc(STUDIO_FORMATOS[p.formato] || p.formato)}</span>` : ''}
      ${pil ? `<span class="pil" style="--c:${pil[2]}">${esc(pil[0])}</span>` : ''}${stRedesHTML(p.redes)}</div>
    <div class="st-ideia-pe"><span class="small muted">${esc(p.codigo)} · ${quem ? esc(primeiroNome(quem.nome)) + ', ' : ''}${fmtD(p.criado_em)}</span>
      <span class="bts"><a class="btn ghost mini" href="#/studio/${esc(p.codigo)}/arte">${ic('imagem')} Criar a arte</a>
        ${ibtn('cal', 'Pôr data', `stModalData('${p.id}')`)}${ibtn('eye', 'Abrir', `location.hash='#/studio/${esc(p.codigo)}'`)}
        ${p.criado_por === stEu() || podeAprovarStudio() ? ibtn('trash', 'Apagar', `stExcluir('${p.id}')`) : ''}</span></div>
  </article>`;
}
async function stGuardarIdeia(){
  const titulo = $('#id-txt').value.trim();
  if (!titulo) return toast('Escreva a ideia — uma frase basta.', true);
  const p = { titulo, status:'ideia', categoria: $('#id-tipo').value, formato: $('#id-formato').value, pilar: $('#id-pilar').value,
    redes: stRedesLidas('#id-redes'), modelo: $('#id-tipo').value };
  const { data, error } = await sb.rpc('studio_publicacao_salvar', { p });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para guardar'), true);
  toast(`Ideia guardada: ${data.codigo}.`);
  await stCarregar(); stIdeias();
}
function stModalIdeia(){
  abreModal(`<h3>${ic('lampada')} Nova ideia</h3>
    <div class="fld"><label for="mi-txt">A ideia</label><textarea id="mi-txt" rows="3" placeholder="Nem que seja uma frase"></textarea></div>
    <div class="st-ideia-campos">
      <div class="fld"><label for="mi-tipo">Tipo</label><select id="mi-tipo"><option value="">—</option>${STUDIO_TIPOS.map(t => `<option value="${t[0]}">${esc(t[1])}</option>`).join('')}</select></div>
      <div class="fld"><label for="mi-formato">Formato</label><select id="mi-formato"><option value="">—</option>${Object.entries(STUDIO_FORMATOS).map(([k, l]) => `<option value="${k}">${esc(l)}</option>`).join('')}</select></div>
    </div>
    <div class="fld"><label>Onde</label><div class="st-chips-redes" id="mi-redes">${stRedesChips([])}</div></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="stModalIdeiaOk()">Guardar</button></div>`, 'largo', true);
  setTimeout(() => $('#mi-txt')?.focus(), 30);
}
async function stModalIdeiaOk(){
  const titulo = $('#mi-txt').value.trim(); if (!titulo) return toast('Escreva a ideia.', true);
  const tipo = $('#mi-tipo').value;
  const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { titulo, status:'ideia', categoria: tipo, modelo: tipo,
    formato: $('#mi-formato').value || studioTipo(tipo)?.[3] || '', pilar: studioTipo(tipo)?.[2] || '', redes: stRedesLidas('#mi-redes') } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para guardar'), true);
  fechaModal(); toast(`Ideia guardada: ${data.codigo}.`);
  await stRecarregarTela();
}
function stModalData(id){
  const p = studioM.pubs.find(x => x.id === id); if (!p) return;
  const d = p.data_publicacao ? new Date(p.data_publicacao) : null;
  const dd = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` : '';
  const hh = d ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : '18:00';
  abreModal(`<h3>${ic('cal')} Quando sai</h3><p class="small muted" style="margin-bottom:12px">${esc(p.codigo)} · ${esc(p.titulo)}</p>
    <div class="st-ideia-campos"><div class="fld"><label for="md-d">Dia</label><input id="md-d" type="date" value="${dd}"></div>
      <div class="fld"><label for="md-h">Hora</label><input id="md-h" type="time" value="${hh}"></div></div>
    <p class="small muted">Na véspera, quem responde pela publicação recebe um lembrete por e-mail.</p>
    <div class="acts" style="justify-content:flex-end">${d ? `<button class="btn ghost" onclick="stDataOk('${id}',true)">Tirar a data</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button><button class="btn solid" onclick="stDataOk('${id}')">Salvar</button></div>`);
}
async function stDataOk(id, tirar){
  const d = $('#md-d').value, h = $('#md-h').value || '18:00';
  if (!tirar && !d) return toast('Escolha o dia.', true);
  const iso = tirar ? '' : new Date(`${d}T${h}`).toISOString();
  const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { id, data_publicacao: iso } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para salvar'), true);
  fechaModal(); toast(tirar ? 'Sem data.' : 'Data marcada.');
  await stRecarregarTela();
}
async function stExcluir(id){
  const p = studioM.pubs.find(x => x.id === id);
  if (!await confirma(`Apagar ${esc(p?.codigo || 'a publicação')}${p?.imagens?.length ? ' e as artes dela' : ''}? Não tem volta.`, 'Apagar')) return;
  const { data, error } = await sb.rpc('studio_excluir', { p_id: id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para apagar'), true);
  /* as artes e as fotos de origem, no Storage */
  const { data: arqs } = await sb.storage.from('studio').list(id).catch(() => ({ data:null })) || {};
  const { data: fontes } = await sb.storage.from('studio').list(id + '/fontes').catch(() => ({ data:null })) || {};
  const cams = [...(arqs || []).filter(a => a.id).map(a => id + '/' + a.name), ...(fontes || []).map(a => id + '/fontes/' + a.name),
    ...(data.imagens || []).map(x => x.caminho)].filter(Boolean);
  if (cams.length) sb.storage.from('studio').remove([...new Set(cams)]).catch(() => {});
  toast(`${data.codigo} apagada.`);
  if (/^#\/studio\/post-/i.test(location.hash)) location.hash = '#/studio';
  else await stRecarregarTela();
}

registrarBusca({
  fonte:'studio', rotulo:'Publicações',
  buscar: (t) => filtrarSimples(studioM.pubs.filter(p => p.status !== 'arquivada').map(p => ({
    codigo: p.codigo, titulo: p.titulo,
    sub: stRotStatus(p.status) + (p.data_publicacao ? ' · ' + stQuando(p.data_publicacao, true) : ''),
    href: '#/studio/' + p.codigo })), t, 6)
});

/* ============================================================
   CALENDÁRIO — o mês da conta. Arrastar um cartão para um dia muda
   a data (mantendo a hora); o que não tem data fica ao lado, pronto
   para ser arrastado.
   ============================================================ */
const ST_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
function stCalendario(){
  const { ano, mes } = studioM.cal;
  const f = studioM.filtro;
  const vis = stFiltradas();
  const ini = new Date(ano, mes, 1), dow = (ini.getDay() + 6) % 7;
  const dias = new Date(ano, mes + 1, 0).getDate();
  const hoje = new Date(); const hojeK = `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;
  const doDia = {};
  vis.filter(p => p.data_publicacao).forEach(p => { const d = new Date(p.data_publicacao);
    if (d.getFullYear() === ano && d.getMonth() === mes) (doDia[d.getDate()] ||= []).push(p); });
  Object.values(doDia).forEach(l => l.sort((a, b) => new Date(a.data_publicacao) - new Date(b.data_publicacao)));
  const semData = vis.filter(p => !p.data_publicacao && ['ideia', 'producao', 'aprovacao', 'pronta'].includes(p.status));
  const celulas = [];
  for (let i = 0; i < dow; i++) celulas.push('<div class="st-dia fora"></div>');
  for (let d = 1; d <= dias; d++){
    const ds = new Date(ano, mes, d), fds = [0, 6].includes(ds.getDay());
    celulas.push(`<div class="st-dia${fds ? ' fds' : ''}${`${ano}-${mes}-${d}` === hojeK ? ' hoje' : ''}" data-dia="${d}"
        ondragover="event.preventDefault();this.classList.add('sobre')" ondragleave="this.classList.remove('sobre')" ondrop="stSoltarDia(event,${d})">
      <span class="d">${d}</span>${(doDia[d] || []).map(p => stChipCal(p)).join('')}</div>`);
  }
  while (celulas.length % 7) celulas.push('<div class="st-dia fora"></div>');
  const redesUsadas = [...new Set(studioM.pubs.flatMap(p => p.redes || []))].filter(r => STUDIO_REDES[r]);
  $('#main').innerHTML = `${stTopo('Calendário', 'O que sai em cada dia, em cada rede. Arraste para mudar a data; na véspera, o responsável recebe o lembrete por e-mail.')}
    ${stNav('calendario')}
    <div class="st-cal-topo">
      <div class="st-cal-mes"><button class="icon-btn" onclick="stMes(-1)" aria-label="Mês anterior">${ic('back')}</button>
        <h2>${ST_MESES[mes]} <span>${ano}</span></h2>
        <button class="icon-btn" onclick="stMes(1)" aria-label="Próximo mês">${ic('chevron')}</button>
        <button class="btn ghost mini" onclick="studioM.cal={ano:new Date().getFullYear(),mes:new Date().getMonth()};stCalendario()">Hoje</button></div>
      <div class="seg" role="group" aria-label="Rede"><button class="${!f.rede ? 'on' : ''}" onclick="studioM.filtro.rede='';stCalendario()">Todas</button>
        ${redesUsadas.map(r => `<button class="${f.rede === r ? 'on' : ''}" onclick="studioM.filtro.rede='${r}';stCalendario()">${esc(STUDIO_REDES[r].l)}</button>`).join('')}</div>
      <div class="st-legenda">${ST_COLUNAS.map(s => `<span><i style="background:${ST_COR_STATUS[s]}"></i>${esc(stRotStatus(s))}</span>`).join('')}</div>
    </div>
    <div class="st-cal-grade">
      <div class="st-cal">
        ${DIAS_LB.map(d => `<div class="st-dsem">${d}</div>`).join('')}
        ${celulas.join('')}
      </div>
      <aside class="st-semdata" ondragover="event.preventDefault();this.classList.add('sobre')" ondragleave="this.classList.remove('sobre')" ondrop="stSoltarDia(event,null)">
        <h3>Sem data · ${semData.length}</h3>
        <p class="small muted">Arraste para um dia do mês.</p>
        ${semData.map(p => stChipCal(p, true)).join('') || '<p class="small muted" style="margin-top:10px">Tudo tem data.</p>'}
      </aside>
    </div>`;
}
function stChipCal(p, comStatus){
  const d = p.data_publicacao ? new Date(p.data_publicacao) : null;
  return `<a class="st-chip${stAtrasada(p) ? ' atras' : ''}" href="#/studio/${esc(p.codigo)}" draggable="true" style="--st:${ST_COR_STATUS[p.status]}"
      ondragstart="studioM.arrastando='${p.id}';event.dataTransfer.effectAllowed='move'" title="${esc(p.codigo + ' · ' + p.titulo + ' · ' + stRotStatus(p.status))}">
    ${d ? `<b>${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</b>` : ''}
    <span class="st-chip-redes">${(p.redes || []).map(r => `<i style="background:${STUDIO_REDES[r]?.c || 'var(--dim)'}" title="${esc(STUDIO_REDES[r]?.l || r)}"></i>`).join('')}</span>
    <span class="tt">${esc(p.titulo)}</span>${comStatus ? `<span class="stt">${esc(stRotStatus(p.status))}</span>` : ''}</a>`;
}
function stMes(d){
  let { ano, mes } = studioM.cal; mes += d;
  if (mes < 0){ mes = 11; ano--; } if (mes > 11){ mes = 0; ano++; }
  studioM.cal = { ano, mes }; stCalendario();
}
async function stSoltarDia(ev, dia){
  ev.preventDefault();
  document.querySelectorAll('.sobre').forEach(c => c.classList.remove('sobre'));
  const p = studioM.pubs.find(x => x.id === studioM.arrastando); studioM.arrastando = null;
  if (!p) return;
  let iso = '';
  if (dia){
    const antes = p.data_publicacao ? new Date(p.data_publicacao) : null;
    const d = new Date(studioM.cal.ano, studioM.cal.mes, dia, antes ? antes.getHours() : 18, antes ? antes.getMinutes() : 0);
    iso = d.toISOString();
    if (antes && Math.abs(antes - d) < 60e3) return;
  } else if (!p.data_publicacao) return;
  const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { id: p.id, data_publicacao: iso } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para mudar a data'), true);
  p.data_publicacao = iso || null;
  toast(dia ? `${p.codigo} para ${dia}/${studioM.cal.mes + 1}.` : `${p.codigo} ficou sem data.`);
  stCalendario();
}

/* ============================================================
   O PLANO — o formulário que o criador (ao salvar) e a página da
   publicação usam. Tudo com o prefixo sp-.
   ============================================================ */
function stPlanoHTML(d, o = {}){
  const dt = d.data_publicacao ? new Date(d.data_publicacao) : null;
  const dia = dt ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` : '';
  const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '';
  const ativos = (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status));
  const sel = (id, lista, v, vazio) => `<select id="${id}">${vazio ? `<option value="">${vazio}</option>` : ''}${lista.map(([k, l]) =>
    `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="st-plano">
    <div class="st-plano-col">
      <div class="fld"><label for="sp-titulo">Nome da publicação</label><input id="sp-titulo" value="${esc(d.titulo || '')}" placeholder="Ex.: Aniversário da Ana"></div>
      <div class="st-plano-2"><div class="fld"><label for="sp-dia">Quando</label><input id="sp-dia" type="date" value="${dia}"></div>
        <div class="fld"><label for="sp-hora">Hora</label><input id="sp-hora" type="time" value="${hora}" placeholder="18:00"></div></div>
      <div class="fld"><label>Onde</label><div class="st-chips-redes" id="sp-redes">${stRedesChips(d.redes || [])}</div></div>
      <div class="st-plano-2">
        <div class="fld"><label for="sp-formato">Formato</label>${sel('sp-formato', Object.entries(STUDIO_FORMATOS), d.formato, '—')}</div>
        <div class="fld"><label for="sp-tipo">Tipo</label>${sel('sp-tipo', STUDIO_TIPOS.map(t => [t[0], t[1]]), d.categoria, '—')}</div></div>
      <div class="st-plano-2">
        <div class="fld"><label for="sp-pilar">Pilar</label>${sel('sp-pilar', Object.entries(STUDIO_PILARES).map(([k, [l]]) => [k, l]), d.pilar, '—')}</div>
        <div class="fld"><label for="sp-resp">Quem responde</label>${sel('sp-resp', ativos.map(m => [m.registro, m.nome]), d.responsavel, '—')}</div></div>
      <div class="fld"><label for="sp-colab">Contas para convidar como collab ou marcar</label>
        <input id="sp-colab" value="${esc(d.colaboradores || '')}" placeholder="@labbio.ufmg, @escoladeengenhariaufmg"></div>
      <div class="fld"><label for="sp-notas">Notas para quem for publicar</label>
        <textarea id="sp-notas" rows="3" placeholder="Ex.: convidar @labbio.ufmg como colaborador; marcar a Ana na foto; publicar depois do evento">${esc(d.notas || '')}</textarea></div>
    </div>
    <div class="st-plano-col">
      <div class="fld"><label for="sp-legenda">Legenda</label>
        <textarea id="sp-legenda" rows="9" oninput="stContaLegenda()">${esc(d.legenda || '')}</textarea>
        <div class="st-conta" id="sp-conta"></div>
        ${o.sugestao && o.sugestao !== d.legenda ? `<button type="button" class="btn ghost mini" style="margin-top:6px" onclick="$('#sp-legenda').value=${esc(JSON.stringify(o.sugestao))};stContaLegenda()">Usar a legenda sugerida pelo modelo</button>` : ''}</div>
      <div class="fld"><label for="sp-coment">Primeiro comentário</label>
        <textarea id="sp-coment" rows="2" placeholder="O link vai aqui no LinkedIn: no corpo, link costuma custar alcance">${esc(d.primeiro_comentario || '')}</textarea></div>
      <div class="fld"><label for="sp-alt">Texto alternativo</label>
        <textarea id="sp-alt" rows="2" placeholder="O que a imagem mostra, para quem usa leitor de tela">${esc(d.texto_alt || '')}</textarea></div>
    </div></div>`;
}
function stPlanoLigar(){
  document.querySelectorAll('#sp-redes .st-rchip').forEach(b => b.addEventListener('click', stContaLegenda));
  stContaLegenda();
}
function stContaLegenda(){
  const el = $('#sp-conta'), t = $('#sp-legenda')?.value || ''; if (!el) return;
  const redes = stRedesLidas('#sp-redes');
  const tags = (t.match(/#[\p{L}\p{N}_]+/gu) || []).length;
  const partes = redes.filter(r => STUDIO_REDES[r]?.legenda).map(r => {
    const lim = STUDIO_REDES[r].legenda;
    return `<span class="${t.length > lim ? 'passou' : ''}">${esc(STUDIO_REDES[r].l)} ${t.length}/${lim}</span>`;
  });
  el.innerHTML = [...partes, `<span class="${tags > 30 ? 'passou' : ''}">${tags} hashtag${tags === 1 ? '' : 's'}${tags > 30 ? ' — o Instagram aceita 30' : ''}</span>`,
    redes.includes('instagram') ? `<span>os primeiros 125 caracteres aparecem antes do “mais”</span>` : ''].filter(Boolean).join('');
}
function stPlanoLer(){
  const titulo = $('#sp-titulo')?.value.trim();
  if (!titulo) return { erro:'Dê um nome à publicação.' };
  const dia = $('#sp-dia').value, hora = $('#sp-hora').value || '18:00';
  return { titulo, data_publicacao: dia ? new Date(`${dia}T${hora}`).toISOString() : '',
    redes: stRedesLidas('#sp-redes'), formato: $('#sp-formato').value, categoria: $('#sp-tipo').value, pilar: $('#sp-pilar').value,
    responsavel: $('#sp-resp').value ? +$('#sp-resp').value : null, colaboradores: $('#sp-colab').value.trim(),
    notas: $('#sp-notas').value.trim(), legenda: $('#sp-legenda').value, primeiro_comentario: $('#sp-coment').value.trim(),
    texto_alt: $('#sp-alt').value.trim() };
}

/* ============================================================
   UMA PUBLICAÇÃO
   ============================================================ */
/* o que quem publica precisa lembrar, por rede */
const ST_COMO = {
  instagram: ['Baixe as imagens na ordem e suba todas no mesmo post (carrossel).',
              'Collab: na tela de publicar, “Marcar pessoas” → “Convidar colaborador”. A outra conta precisa aceitar.',
              'Texto alternativo: “Configurações avançadas” → “Escrever texto alternativo”.'],
  linkedin:  ['Documento: suba o PDF (Baixar → PDF) em “Adicionar documento”, com um título.',
              'Link no primeiro comentário, logo depois de publicar — no corpo, costuma custar alcance.',
              'Marque as páginas parceiras com @ no texto.'],
  youtube:   ['Thumbnail: “Detalhes” → “Miniatura” → enviar.', 'Tela final: “Tela final” → importar do vídeo ou pôr os elementos sobre os espaços da arte.'],
  tiktok:    ['Capa: escolha “Enviar capa” ao publicar o vídeo.'],
  x:         ['Até 280 caracteres: corte a legenda se precisar.'],
  facebook:  ['Programe pela Meta Business Suite junto com o Instagram, se for o caso.'],
  whatsapp:  ['Quadrado é o que aparece inteiro na conversa. Mande a imagem primeiro e o texto embaixo.'],
  site:      ['Peça a quem cuida do site para subir a imagem e o texto.']
};
async function stPublicacao(cod){
  const [p, a, h] = await Promise.all([
    sb.from('studio_publicacoes').select('*').eq('codigo', cod).maybeSingle(),
    sb.from('studio_aprovacoes').select('*').eq('publicacao_id', studioM.pubs.find(x => x.codigo === cod)?.id || '00000000-0000-0000-0000-000000000000').order('criado_em'),
    sb.from('studio_historico').select('*').eq('publicacao_id', studioM.pubs.find(x => x.codigo === cod)?.id || '00000000-0000-0000-0000-000000000000').order('criado_em', { ascending:false })
  ]);
  const pub = p.data;
  if (!pub) return stNaoAchou(cod);
  studioM.atual = pub;
  const aprov = a.data || [], hist = h.data || [];
  const validas = aprov.filter(x => x.versao === pub.versao && x.decisao === 'aprovada');
  const tipo = studioTipo(pub.categoria);
  const eu = stEu();
  const podeApagar = pub.criado_por === eu || podeAprovarStudio();
  const passos = ST_COLUNAS.map((s, i) => { const at = ST_COLUNAS.indexOf(pub.status);
    return `<li class="${i < at ? 'feito' : i === at ? 'agora' : ''}"><span>${esc(stRotStatus(s))}</span></li>`; }).join('');
  const redesComo = (pub.redes || []).filter(r => ST_COMO[r]);
  $('#main').innerHTML = `<div class="topo-gestao st-pub-topo"><div class="tx"><span class="eyebrow">Studio · ${esc(pub.codigo)}</span>
      <h1>${esc(pub.titulo)}</h1>
      <p class="lead">${[tipo?.[1], pub.formato && STUDIO_FORMATOS[pub.formato], (pub.redes || []).map(r => STUDIO_REDES[r]?.l).filter(Boolean).join(', ')].filter(Boolean).map(esc).join(' · ') || 'Sem tipo nem rede ainda'}
        ${pub.data_publicacao ? ` — <b>${esc(stQuando(pub.data_publicacao))}</b>` : ''}</p></div>
      <div class="acoes">${pub.formato === 'texto' ? '' : `<a class="btn ${pub.imagens?.length ? 'ghost' : 'solid'} mini" href="#/studio/${esc(pub.codigo)}/arte">${ic('imagem')} ${pub.imagens?.length ? 'Editar a arte' : 'Criar a arte'}</a>`}
        ${pub.status !== 'arquivada' ? `<button class="btn ghost mini" onclick="stArquivar('${pub.id}')">Arquivar</button>` : `<button class="btn ghost mini" onclick="stMover('${pub.id}','ideia')">Desarquivar</button>`}
        ${podeApagar ? ibtn('trash', 'Apagar', `stExcluir('${pub.id}')`) : ''}</div></div>
    ${stNav('')}
    ${pub.status === 'arquivada' ? '<div class="aviso-box info">Arquivada: fora do quadro e do calendário.</div>' : `<ol class="st-passos">${passos}</ol>`}
    <div class="st-pub">
      <div class="st-pub-esq">
        <section class="card st-arte"><h3>Arte${pub.imagens?.length ? ` · ${pub.imagens.length} ${pub.imagens.length === 1 ? 'imagem' : 'imagens'}` : ''}${pub.versao > 1 ? ` <span class="small muted">versão ${pub.versao}</span>` : ''}</h3>
          <div id="st-arte-corpo">${pub.imagens?.length ? '<div class="carregando"><span class="spin"></span></div>'
            : pub.formato === 'texto' ? '<p class="small muted" style="margin-top:8px">Publicação só de texto: não precisa de arte.</p>'
            : `<div class="vazio" style="padding:26px"><p>Ainda sem arte.</p><a class="btn solid mini" href="#/studio/${esc(pub.codigo)}/arte">${ic('imagem')} Criar a arte</a></div>`}</div>
        </section>
        <section class="card st-aprov">${stAprovHTML(pub, validas, aprov)}</section>
        ${redesComo.length || pub.colaboradores || pub.notas ? `<section class="card st-como"><h3>Para quem for publicar</h3>
          ${pub.notas ? `<div class="st-nota">${esc(pub.notas)}</div>` : ''}
          ${pub.colaboradores ? `<p class="st-colab">${ic('users')} Convidar / marcar: <b>${esc(pub.colaboradores)}</b></p>` : ''}
          ${redesComo.map(r => `<h4>${esc(STUDIO_REDES[r].l)}</h4><ul>${ST_COMO[r].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
        </section>` : ''}
      </div>
      <div class="st-pub-dir">
        <section class="card"><h3 style="display:flex;align-items:center;gap:10px">O plano
            <button class="btn ghost mini" style="margin-left:auto" onclick="copiar($('#sp-legenda').value)">${ic('copy')} Copiar a legenda</button></h3>
          ${pub.status === 'pronta' ? '<div class="aviso-box warn" style="margin-top:10px">Aprovada. Mudar a legenda devolve para aprovação (o resto do plano, não).</div>' : ''}
          ${stPlanoHTML(pub)}
          <div class="acts" style="justify-content:flex-end"><button class="btn solid mini" onclick="stSalvarPlano('${pub.id}')">${ic('check')} Salvar o plano</button></div>
        </section>
        <section class="card st-hist"><h3>Histórico</h3>
          <ol>${hist.map(x => `<li><span class="q">${esc(fmtDT(x.criado_em))}</span><span><b>${esc(x.nome || 'Portal')}</b> ${esc(ST_ACOES[x.acao] || x.acao)}${x.detalhe ? ` <span class="d">${esc(x.detalhe)}</span>` : ''}</span></li>`).join('')
            || '<li class="small muted">Nada ainda.</li>'}</ol></section>
      </div>
    </div>`;
  stPlanoLigar();
  if (pub.imagens?.length) stArte(pub);
}
const ST_ACOES = { criou:'criou', moveu:'moveu', agendou:'marcou a data', versao:'salvou a arte', responsavel:'passou a responsabilidade para',
  aprovou:'aprovou', devolveu:'devolveu:' };
function stAprovHTML(pub, validas, todas){
  const min = stMin(), eu = stEu();
  const devolvidas = todas.filter(x => x.decisao === 'devolvida').slice(-1);
  let h = `<h3>Aprovação</h3>`;
  if (pub.status === 'ideia' || pub.status === 'producao'){
    h += `<p class="small muted" style="line-height:1.6;margin:6px 0 12px">Para ficar <b>pronta para publicar</b>, a publicação passa pelo grupo aprovador${min > 1 ? ` (${min} aprovações)` : ''}.
      Quem manda para aprovação não aprova a própria.</p>
      ${devolvidas.length ? `<div class="aviso-box warn">Devolvida por <b>${esc(devolvidas[0].nome)}</b>: ${esc(devolvidas[0].parecer || '')}</div>` : ''}
      <button class="btn solid mini" onclick="stMover('${pub.id}','aprovacao')">${ic('enviar')} Mandar para aprovação</button>`;
  } else if (pub.status === 'aprovacao'){
    const quem = (state.membros || []).find(m => m.registro === pub.enviado_por);
    h += `<p class="small muted" style="margin:6px 0 10px">Mandada por ${esc(quem?.nome || '—')}${pub.enviado_em ? ' em ' + esc(fmtDT(pub.enviado_em)) : ''} · versão ${pub.versao}</p>
      <div class="st-aprov-barra"><span style="width:${Math.min(100, 100 * validas.length / min)}%"></span></div>
      <p class="small" style="margin:6px 0 12px"><b>${validas.length} de ${min}</b> ${min === 1 ? 'aprovação' : 'aprovações'}${validas.length ? ': ' + validas.map(v => esc(v.nome)).join(', ') : ''}</p>
      ${podeAprovarStudio() && pub.enviado_por !== eu && !validas.some(v => v.registro === eu)
        ? `<div class="acts"><button class="btn solid mini" onclick="stModalDecidir('${pub.id}','aprovar')">${ic('check')} Aprovar</button>
           <button class="btn ghost mini" onclick="stModalDecidir('${pub.id}','devolver')">Devolver</button></div>`
        : pub.enviado_por === eu ? '<p class="small muted">Você mandou esta versão: a aprovação é de outra pessoa do grupo aprovador.</p>'
        : validas.some(v => v.registro === eu) ? '<p class="small muted">Você já aprovou esta versão.</p>'
        : '<p class="small muted">Esperando o grupo aprovador.</p>'}`;
  } else if (pub.status === 'pronta'){
    h += `<div class="aviso-box info" style="margin-top:8px">Aprovada${validas.length ? ' por ' + validas.map(v => esc(v.nome)).join(', ') : ''}. É só publicar na data.</div>
      <button class="btn solid mini" onclick="stModalPublicada('${pub.id}')">${ic('check')} Marcar como publicada</button>`;
  } else if (pub.status === 'publicada'){
    h += `<p style="margin-top:8px">Publicada${pub.publicado_em ? ' em ' + esc(fmtDT(pub.publicado_em)) : ''}.</p>
      ${pub.link ? `<a class="btn ghost mini" href="${esc(pub.link)}" target="_blank" rel="noopener">${ic('link')} Ver no ar</a>`
        : `<button class="btn ghost mini" onclick="stModalPublicada('${pub.id}')">${ic('link')} Pôr o link</button>`}`;
  }
  return h;
}
function stModalDecidir(id, dec){
  abreModal(`<h3>${dec === 'aprovar' ? 'Aprovar' : 'Devolver para produção'}</h3>
    <div class="fld"><label for="dc-par">${dec === 'aprovar' ? 'Comentário (opcional)' : 'O que precisa mudar'}</label>
      <textarea id="dc-par" rows="3" placeholder="${dec === 'aprovar' ? 'Ex.: pode sair.' : 'Ex.: falta o crédito da foto; trocar “órtese” por “exoesqueleto”.'}"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="stDecidirOk('${id}','${dec}')">${dec === 'aprovar' ? 'Aprovar' : 'Devolver'}</button></div>`, false, true);
  setTimeout(() => $('#dc-par')?.focus(), 30);
}
async function stDecidirOk(id, dec){
  const parecer = $('#dc-par').value.trim();
  if (dec === 'devolver' && !parecer) return toast('Diga o que precisa mudar.', true);
  const { data, error } = await sb.rpc('studio_decidir', { p: { id, decisao: dec, parecer } });
  const MOT = { propria:'Quem mandou para aprovação não aprova a própria.', ja_aprovou:'Você já aprovou esta versão.',
    fora_de_aprovacao:'A publicação não está mais em aprovação.' };
  if (error || data?.status !== 'ok') return toast(MOT[data?.status] || motivoRPC(data, error, 'Não deu'), true);
  fechaModal();
  toast(dec === 'devolver' ? 'Devolvida — quem responde foi avisado.' : data.situacao === 'pronta' ? 'Aprovada: pronta para publicar.'
    : `Aprovação registrada. Falta${data.faltam > 1 ? 'm' : ''} ${data.faltam}.`);
  await stRecarregarTela();
}
async function stSalvarPlano(id){
  const p = stPlanoLer(); if (p.erro) return toast(p.erro, true);
  const antes = studioM.atual;
  if (antes?.status === 'pronta' && (p.legenda || '') !== (antes.legenda || '')
      && !await confirma('A publicação está aprovada. Com a legenda nova, ela volta para aprovação. Salvar?', 'Salvar')) return;
  const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { id, ...p } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para salvar'), true);
  toast(data.situacao === 'aprovacao' && antes?.status === 'pronta' ? 'Salvo — voltou para aprovação.' : 'Plano salvo.');
  await stCarregar(); await stPublicacao(antes.codigo);
}
async function stArquivar(id){
  if (!await confirma('Arquivar? Sai do quadro e do calendário; a página continua no endereço.', 'Arquivar')) return;
  await stMover(id, 'arquivada');
}
/* a arte: as imagens salvas, para ver e baixar */
async function stArte(pub){
  const urls = await stUrls(pub.imagens.map(x => x.caminho));
  const im = pub.imagens;
  const el = $('#st-arte-corpo'); if (!el) return;
  el.innerHTML = `<div class="st-carrossel" id="st-car">${im.map((x, i) => `<figure class="${i ? '' : 'on'}"><img src="${esc(urls(x.caminho))}" alt="Imagem ${i + 1}"></figure>`).join('')}
      ${im.length > 1 ? `<button class="cr-nav ant" onclick="stCar(-1)" aria-label="Anterior">${ic('back')}</button><button class="cr-nav prox" onclick="stCar(1)" aria-label="Próxima">${ic('chevron')}</button>` : ''}</div>
    ${im.length > 1 ? `<div class="st-car-pts">${im.map((x, i) => `<button class="${i ? '' : 'on'}" onclick="stCar(null,${i})" aria-label="Imagem ${i + 1}"></button>`).join('')}</div>` : ''}
    <div class="st-baixar">${im.length > 1 ? `<button class="btn solid mini" onclick="stBaixarTodas()">${ic('down')} Baixar todas (ZIP)</button>` : ''}
      ${im.map((x, i) => `<button class="btn ghost mini" onclick="stBaixar(${i})">${ic('down')} ${String(i + 1).padStart(2, '0')}</button>`).join('')}
      <span class="small muted">${im[0].largura} × ${im[0].altura} px</span></div>`;
  studioM.carI = 0;
}
function stCar(d, i){
  const fs = [...document.querySelectorAll('#st-car figure')]; if (!fs.length) return;
  studioM.carI = i ?? (studioM.carI + d + fs.length) % fs.length;
  fs.forEach((f, n) => f.classList.toggle('on', n === studioM.carI));
  document.querySelectorAll('.st-car-pts button').forEach((b, n) => b.classList.toggle('on', n === studioM.carI));
}
const stNomeImagem = (pub, i, x) => `${pub.codigo.toLowerCase()}-${String(i + 1).padStart(2, '0')}-${x.largura}x${x.altura}.${/png/.test(x.tipo || x.caminho) ? 'png' : 'jpg'}`;
async function stBaixar(i){
  const pub = studioM.atual, x = pub?.imagens?.[i]; if (!x) return;
  const { data, error } = await sb.storage.from('studio').createSignedUrl(x.caminho, 120, { download: stNomeImagem(pub, i, x) });
  if (error || !data?.signedUrl) return toast('Não deu para baixar: ' + (error?.message || 'sem link'), true);
  const a = document.createElement('a'); a.href = data.signedUrl; a.download = stNomeImagem(pub, i, x);
  document.body.appendChild(a); a.click(); a.remove();
}
async function stBaixarTodas(){
  const pub = studioM.atual; if (!pub?.imagens?.length) return;
  toast('Juntando as imagens…');
  try {
    if (!window.JSZip) await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip = new JSZip();
    const urls = await stUrls(pub.imagens.map(x => x.caminho));
    for (const [i, x] of pub.imagens.entries()){
      const r = await fetch(urls(x.caminho)); if (!r.ok) throw new Error('a imagem ' + (i + 1) + ' não veio');
      zip.file(stNomeImagem(pub, i, x), await r.blob());
    }
    const blob = await zip.generateAsync({ type:'blob' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = pub.codigo.toLowerCase() + '.zip';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch(e){ falha(e, 'Não deu para baixar'); }
}

/* ============================================================
   CONFIGURAÇÕES
   Acesso e aprovação e as contas são da gestão do Studio (admin e
   quem aprova). A imprensa do site, dela e de admin/pessoal (como o
   painel do site). Os recursos, de todo mundo que entra no Studio.
   ============================================================ */
const ST_ABAS_CONFIG = [['acesso', 'Acesso e aprovação'], ['contas', 'Contas e integrações'], ['imprensa', 'Imprensa do site'], ['recursos', 'Recursos de imagem']];
const stGestor = () => podeAprovarStudio();
const stEditaImprensa = () => podeAprovarStudio() || can();
async function stConfig(aba){
  if (!ST_ABAS_CONFIG.some(a => a[0] === aba)) aba = 'acesso';
  $('#main').innerHTML = `${stTopo('Configurações', 'Quem entra no Studio e quem aprova, as contas da equipe, a imprensa do site e onde estão as nossas fotos.', '')}
    ${stNav('config')}
    <nav class="abas">${ST_ABAS_CONFIG.map(([k, l]) => `<a href="#/studio/config/${k}" class="${aba === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="st-cfg"><div class="carregando"><span class="spin"></span></div></div>`;
  if (aba === 'acesso') return stCfgAcesso();
  if (aba === 'contas') return stCfgContas();
  if (aba === 'imprensa') return stCfgImprensa();
  return stCfgRecursos();
}

/* ---------------- acesso e aprovação ---------------- */
function stGruposPicker(id, sel, pode){
  const gs = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  return `<div class="st-gp" id="${id}">${gs.map(g => `<label class="st-gp-i${sel.includes(g.id) ? ' on' : ''}">
      <input type="checkbox" value="${g.id}" ${sel.includes(g.id) ? 'checked' : ''} ${pode ? '' : 'disabled'}
        onchange="this.parentElement.classList.toggle('on',this.checked);stCfgResumo()">
      <span class="nm">${esc(g.nome)}</span>${g.pai_id && grupoPorId(g.pai_id) ? `<span class="pai">em ${esc(grupoPorId(g.pai_id).nome)}</span>` : ''}</label>`).join('')
    || '<p class="small muted">Os grupos ainda não carregaram.</p>'}</div>`;
}
const stMarcados = id => [...document.querySelectorAll(`#${id} input:checked`)].map(i => +i.value);
function stQuemEsta(ids){
  const nomes = new Set(ids.map(i => grupoPorId(i)?.nome).filter(Boolean));
  return (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status)
    && [...gruposEfetivos(m)].some(n => nomes.has(n)));
}
function stCfgResumo(){
  const a = stMarcados('st-gp-acesso'), p = stMarcados('st-gp-aprov');
  const ea = stQuemEsta([...a, ...p]), ep = stQuemEsta(p);
  const lista = ms => ms.slice(0, 8).map(m => avatarFoto(m, 24, 9)).join('') + (ms.length > 8 ? `<span class="mais">+${ms.length - 8}</span>` : '');
  $('#st-cfg-res').innerHTML = `<div><b>${ea.length}</b> ${ea.length === 1 ? 'pessoa entra' : 'pessoas entram'} no Studio (além de admin) <span class="pj-rostos">${lista(ea)}</span></div>
    <div><b>${ep.length || 'Admin'}</b> ${ep.length ? (ep.length === 1 ? 'pessoa aprova' : 'pessoas aprovam') : 'aprova, enquanto não houver grupo aprovador'} <span class="pj-rostos">${lista(ep)}</span></div>`;
}
function stCfgAcesso(){
  const c = state.studioCfg || {}, pode = stGestor();
  $('#st-cfg').innerHTML = `${pode ? '' : '<div class="aviso-box info">Só admin e quem aprova mexem aqui. Você vê como está.</div>'}
    <div class="st-cfg-2">
      <section class="card"><h3>Quem entra no Studio</h3>
        <p class="small muted" style="line-height:1.6;margin:4px 0 12px">Os grupos que usam o Studio. Quem está num subgrupo entra também.
          Sem nenhum, só admin e quem aprova entram.</p>
        ${stGruposPicker('st-gp-acesso', c.grupos_acesso || [], pode)}</section>
      <section class="card"><h3>Quem aprova</h3>
        <p class="small muted" style="line-height:1.6;margin:4px 0 12px">Antes de ficar <b>pronta para publicar</b>, a publicação passa por
          alguém destes grupos — que não seja quem mandou. Sem nenhum, aprova admin. Quem aprova também configura o Studio.</p>
        ${stGruposPicker('st-gp-aprov', c.grupos_aprovadores || [], pode)}
        <div class="st-plano-2" style="margin-top:14px">
          <div class="fld"><label for="st-min">Aprovações necessárias</label><select id="st-min" ${pode ? '' : 'disabled'}>${[1, 2, 3].map(n =>
            `<option value="${n}"${(c.aprovacoes_minimas || 1) === n ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
          <label class="cr-chave" style="align-self:end;margin-bottom:14px"><input type="checkbox" id="st-lemb" ${c.lembrete_email !== false ? 'checked' : ''} ${pode ? '' : 'disabled'}>
            Lembrete por e-mail na véspera</label></div>
        <p class="small muted" style="line-height:1.6">O lembrete sai para quem responde pela publicação (e para quem aprova, se ela ainda não foi aprovada),
          mesmo para quem escolheu receber só resumo ou só no portal: é compromisso com dia marcado.</p></section>
    </div>
    <div class="card st-cfg-res" id="st-cfg-res"></div>
    ${pode ? `<div class="acts" style="justify-content:flex-end;margin-top:14px"><button class="btn solid" onclick="stCfgSalvarAcesso()">${ic('check')} Salvar</button></div>` : ''}`;
  stCfgResumo();
}
async function stCfgSalvarAcesso(){
  const dados = { grupos_acesso: stMarcados('st-gp-acesso'), grupos_aprovadores: stMarcados('st-gp-aprov'),
    aprovacoes_minimas: +$('#st-min').value, lembrete_email: $('#st-lemb').checked };
  if (!dados.grupos_aprovadores.length && !await confirma('Sem grupo aprovador, só admin aprova. Continuar?', 'Continuar')) return;
  const eu = (state.membros || []).find(m => m.registro === stEu());
  const nomes = new Set(dados.grupos_aprovadores.map(i => grupoPorId(i)?.nome));
  if (state.perfil?.papel !== 'admin' && ![...gruposEfetivos(eu)].some(n => nomes.has(n))
      && !await confirma('Você não está em nenhum dos grupos aprovadores escolhidos: depois de salvar, não poderá mais mexer aqui. Continuar?', 'Continuar')) return;
  const { data, error } = await sb.from('studio_config').update(dados).eq('id', true).select();
  if (error || (Array.isArray(data) && !data.length)) return toast('Não deu para salvar' + (error ? ': ' + error.message : ' — sem permissão.'), true);
  await carregarStudioConfig();
  toast('Configuração salva.');
  if (!podeStudio()){ location.hash = '#/'; return; }
  stCfgAcesso();
}

/* ---------------- contas e integrações ---------------- */
const ST_CONTAS = [['instagram', 'Instagram', '@neurodynamics'], ['linkedin', 'LinkedIn', 'NeuroDynamics'], ['youtube', 'YouTube', '@neurodynamics'],
  ['tiktok', 'TikTok', '@neurodynamics'], ['x', 'X', '@neurodynamics'], ['facebook', 'Facebook', 'NeuroDynamics'], ['site', 'Site', 'neurodynamics.dev']];
function stCfgContas(){
  const c = state.studioCfg || {}, contas = c.contas || {}, pode = stGestor();
  $('#st-cfg').innerHTML = `<div class="st-cfg-2">
    <section class="card"><h3>As contas da equipe</h3>
      <p class="small muted" style="line-height:1.6;margin:4px 0 12px">Entram no rodapé das artes e na tela de encerramento dos vídeos.</p>
      ${ST_CONTAS.map(([k, l, ph]) => `<div class="fld"><label for="ct-${k}">${l}</label><input id="ct-${k}" value="${esc(contas[k] || '')}" placeholder="${ph}" ${pode ? '' : 'disabled'}></div>`).join('')}
    </section>
    <section class="card"><h3>Unsplash</h3>
      <p class="small muted" style="line-height:1.6;margin:4px 0 12px">Com a chave, a busca de fotos do Unsplash acontece dentro do criador,
        e o crédito do fotógrafo entra sozinho. Sem ela, a busca abre o site e a foto entra por link.</p>
      <div class="fld"><label for="ct-us">Access Key</label><input id="ct-us" value="${esc(c.unsplash_chave || '')}" placeholder="a chave de acesso (não a Secret Key)" ${pode ? '' : 'disabled'}></div>
      <ol class="st-passos-txt"><li>Entre em <a href="https://unsplash.com/oauth/applications" target="_blank" rel="noopener">unsplash.com/oauth/applications</a> com a conta da equipe.</li>
        <li><b>New Application</b>, aceite os termos e dê um nome (ex.: Studio NeuroDynamics).</li>
        <li>Copie a <b>Access Key</b> e cole aqui. A chave de demonstração faz 50 buscas por hora — para a equipe, sobra.</li></ol>
    </section></div>
    ${pode ? `<div class="acts" style="justify-content:flex-end;margin-top:14px"><button class="btn solid" onclick="stCfgSalvarContas()">${ic('check')} Salvar</button></div>` : ''}`;
}
async function stCfgSalvarContas(){
  const contas = Object.fromEntries(ST_CONTAS.map(([k]) => [k, $('#ct-' + k).value.trim()]).filter(([, v]) => v));
  const { data, error } = await sb.from('studio_config').update({ contas, unsplash_chave: $('#ct-us').value.trim() || null }).eq('id', true).select();
  if (error || (Array.isArray(data) && !data.length)) return toast('Não deu para salvar' + (error ? ': ' + error.message : ' — sem permissão.'), true);
  await carregarStudioConfig(); toast('Contas salvas.'); stCfgContas();
}

/* ---------------- imprensa do site ---------------- */
function stYoutubeId(v){
  const t = String(v || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([\w-]{11})/);
  return m ? m[1] : '';
}
async function stCfgImprensa(){
  const { data, error } = await sb.from('site_imprensa').select('*').order('ordem').order('criado_em');
  if (error){ $('#st-cfg').innerHTML = `<div class="aviso-box err">A imprensa não carregou: ${esc(error.message)}. Falta a migração v23?</div>`; return; }
  studioM.imprensa = data || [];
  const pode = stEditaImprensa();
  const lista = tipo => studioM.imprensa.filter(i => i.tipo === tipo);
  const linha = (i, n, tot) => `<div class="st-imp${i.publicado ? '' : ' off'}">
      ${i.tipo === 'video' ? `<span class="st-imp-th">${i.youtube ? `<img src="https://img.youtube.com/vi/${esc(i.youtube)}/mqdefault.jpg" alt="" loading="lazy">` : ic('play')}</span>`
        : `<span class="st-imp-th txt">${ic('doc')}</span>`}
      <span class="tx"><span class="nm">${esc(i.titulo || i.veiculo || 'Sem título')}</span>
        <span class="sub">${esc([i.titulo ? i.veiculo : '', i.ano].filter(Boolean).join(' · '))}${i.publicado ? '' : ' · <b>fora do site</b>'}</span></span>
      ${pode ? `<span class="bts">${n ? ibtn('back', 'Subir', `stImpOrdem('${i.id}',-1)`, 'cima') : ''}${n < tot - 1 ? ibtn('chevron', 'Descer', `stImpOrdem('${i.id}',1)`, 'baixo') : ''}
        ${ibtn(i.publicado ? 'eye' : 'x', i.publicado ? 'Tirar do site' : 'Pôr no site', `stImpPublicar('${i.id}',${!i.publicado})`)}
        ${ibtn('pencil', 'Editar', `stImpModal('${i.tipo}','${i.id}')`)}${ibtn('trash', 'Apagar', `stImpApagar('${i.id}')`)}</span>` : ''}</div>`;
  const vs = lista('video'), ms = lista('materia');
  $('#st-cfg').innerHTML = `${pode ? '' : '<div class="aviso-box info">Quem edita a imprensa é a gestão do Studio, admin e o Depto. de Pessoal.</div>'}
    <p class="small muted" style="line-height:1.6;margin-bottom:14px">A seção <b>Quem somos</b> do <a href="https://neurodynamics.dev/#/about" target="_blank" rel="noopener">site institucional</a>
      e a página <b>A NeuroDynamics</b> do <a href="https://selecao.neurodynamics.dev" target="_blank" rel="noopener">site do processo seletivo</a> leem daqui, na hora.
      A ordem aqui é a ordem lá. O título de vídeo é opcional: sem ele, o veículo vira o rótulo.</p>
    <div class="st-cfg-2">
      <section class="card"><h3 style="display:flex;align-items:center;gap:10px">${ic('play')} Vídeos · ${vs.length}
          ${pode ? `<button class="btn ghost mini" style="margin-left:auto" onclick="stImpModal('video')">${ic('plus')} Vídeo</button>` : ''}</h3>
        <div class="st-imps">${vs.map((i, n) => linha(i, n, vs.length)).join('') || '<p class="small muted">Nenhum vídeo: o carrossel some do site.</p>'}</div></section>
      <section class="card"><h3 style="display:flex;align-items:center;gap:10px">${ic('doc')} Matérias escritas · ${ms.length}
          ${pode ? `<button class="btn ghost mini" style="margin-left:auto" onclick="stImpModal('materia')">${ic('plus')} Matéria</button>` : ''}</h3>
        <div class="st-imps">${ms.map((i, n) => linha(i, n, ms.length)).join('') || '<p class="small muted">Nenhuma matéria: os cartões somem do site.</p>'}</div></section>
    </div>`;
}
function stImpModal(tipo, id){
  const i = studioM.imprensa.find(x => x.id === id) || {};
  const video = tipo === 'video';
  abreModal(`<h3>${video ? ic('play') + ' Vídeo' : ic('doc') + ' Matéria'} ${id ? '' : 'nova'}</h3>
    ${video ? `<div class="fld"><label for="im-yt">Link do YouTube</label><input id="im-yt" value="${esc(i.youtube ? 'https://youtu.be/' + i.youtube : '')}"
        placeholder="https://www.youtube.com/watch?v=…" oninput="stImpPrevia()"><p class="mini">Vídeo "não listado" funciona; "privado", não. O canal precisa permitir incorporar.</p></div>
      <div id="im-prev" class="st-imp-prev"></div>` : ''}
    <div class="fld"><label for="im-tit">${video ? 'Título (opcional)' : 'Manchete, como foi publicada'}</label><input id="im-tit" value="${esc(i.titulo || '')}"></div>
    <div class="st-plano-2"><div class="fld"><label for="im-vei">Veículo</label><input id="im-vei" value="${esc(i.veiculo || '')}" placeholder="TV UFMG, Globo Esporte…"></div>
      <div class="fld"><label for="im-ano">Ano</label><input id="im-ano" value="${esc(i.ano || '')}" placeholder="${new Date().getFullYear()}"></div></div>
    <div class="fld"><label for="im-url">${video ? 'Link da matéria (opcional: vira o botão “Fonte”)' : 'Link da matéria'}</label><input id="im-url" type="url" value="${esc(i.url || '')}" placeholder="https://…"></div>
    <label class="cr-chave"><input type="checkbox" id="im-pub" ${i.publicado === false ? '' : 'checked'}> No site</label>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="stImpSalvar('${tipo}','${id || ''}')">Salvar</button></div>`, 'largo', true);
  if (video) stImpPrevia();
}
function stImpPrevia(){
  const id = stYoutubeId($('#im-yt')?.value), el = $('#im-prev'); if (!el) return;
  el.innerHTML = id ? `<img src="https://img.youtube.com/vi/${esc(id)}/mqdefault.jpg" alt=""><span class="mono small">${esc(id)}</span>`
    : ($('#im-yt').value.trim() ? '<span class="small" style="color:var(--bad)">Não reconheci o link do YouTube.</span>' : '');
}
async function stImpSalvar(tipo, id){
  const d = { tipo, titulo: $('#im-tit').value.trim() || null, veiculo: $('#im-vei').value.trim() || null,
    ano: $('#im-ano').value.trim() || null, url: $('#im-url').value.trim() || null, publicado: $('#im-pub').checked };
  if (tipo === 'video'){ d.youtube = stYoutubeId($('#im-yt').value); if (!d.youtube) return toast('Cole o link do vídeo no YouTube.', true);
    if (!d.titulo && !d.veiculo) return toast('Sem título, o veículo é o rótulo: preencha um dos dois.', true); }
  else { if (!d.titulo || !d.url) return toast('A matéria precisa da manchete e do link.', true); }
  if (d.url && !/^https?:\/\//i.test(d.url)) return toast('O link precisa começar com https://', true);
  if (!id) d.ordem = (Math.max(0, ...studioM.imprensa.filter(x => x.tipo === tipo).map(x => x.ordem || 0)) + 10);
  const q = id ? sb.from('site_imprensa').update(d).eq('id', id) : sb.from('site_imprensa').insert(d);
  const { error } = await q;
  if (error) return toast('Não deu para salvar: ' + error.message, true);
  fechaModal(); toast('Salvo — o site já mostra.'); stCfgImprensa();
}
async function stImpOrdem(id, d){
  const i = studioM.imprensa.find(x => x.id === id);
  const lista = studioM.imprensa.filter(x => x.tipo === i.tipo);
  const n = lista.indexOf(i), outro = lista[n + d]; if (!outro) return;
  /* reescreve a ordem da lista inteira, de 10 em 10: nada empata */
  [lista[n], lista[n + d]] = [lista[n + d], lista[n]];
  const r = await Promise.all(lista.map((x, k) => (x.ordem === (k + 1) * 10) ? null : sb.from('site_imprensa').update({ ordem: (k + 1) * 10 }).eq('id', x.id)));
  if (r.some(x => x?.error)) toast('A ordem não salvou inteira.', true);
  stCfgImprensa();
}
async function stImpPublicar(id, v){
  const { error } = await sb.from('site_imprensa').update({ publicado: v }).eq('id', id);
  if (error) return toast(error.message, true);
  toast(v ? 'No site.' : 'Fora do site.'); stCfgImprensa();
}
async function stImpApagar(id){
  if (!await confirma('Apagar da imprensa? Para só esconder do site, use o olho.', 'Apagar')) return;
  const { error } = await sb.from('site_imprensa').delete().eq('id', id);
  if (error) return toast(error.message, true);
  stCfgImprensa();
}

/* ---------------- recursos de imagem ---------------- */
const ST_RECURSO_TIPOS = { pasta:'Pasta do Drive', album:'Álbum compartilhado', repositorio:'Repositório', banco:'Banco de imagens', video:'Vídeos', marca:'Marca e logos', outro:'Outro' };
async function stCfgRecursos(){
  const { data, error } = await sb.from('studio_recursos').select('*').order('ordem').order('titulo');
  if (error){ $('#st-cfg').innerHTML = `<div class="aviso-box err">Os recursos não carregaram: ${esc(error.message)}.</div>`; return; }
  studioM.recursos = data || [];
  const porTipo = Object.keys(ST_RECURSO_TIPOS).map(t => [t, studioM.recursos.filter(r => r.tipo === t)]).filter(([, l]) => l.length);
  $('#st-cfg').innerHTML = `<p class="small muted" style="line-height:1.6;margin-bottom:14px">Onde estão as fotos e os vídeos da equipe: pastas do Drive,
      álbuns compartilhados, repositórios, bancos de imagem. Quem entra no Studio cadastra; para usar uma foto no criador, baixe e use <b>Enviar</b>.</p>
    <div class="acts" style="margin-bottom:14px"><button class="btn solid mini" onclick="stRecModal()">${ic('plus')} Recurso</button>
      <a class="btn ghost mini" href="https://brand.neurodynamics.dev" target="_blank" rel="noopener">${ic('link')} Brand guidelines</a></div>
    ${porTipo.length ? porTipo.map(([t, l]) => `<h4 class="adm-grupo">${esc(ST_RECURSO_TIPOS[t])}</h4>
      <div class="st-recs">${l.map(stRecCartao).join('')}</div>`).join('')
      : `<div class="vazio"><div class="glyph">▣</div><h3>Nenhum recurso ainda</h3><p>Cadastre a pasta de fotos do Drive, o álbum do último evento, o repositório com as fotos dos projetos.</p>
        <button class="btn solid" onclick="stRecModal()">Cadastrar o primeiro</button></div>`}`;
}
function stRecCartao(r){
  let host = ''; try { host = new URL(r.url).host.replace(/^www\./, ''); } catch(e){}
  const pode = r.criado_por === stEu() || stGestor();
  return `<div class="st-rec"><a href="${esc(r.url)}" target="_blank" rel="noopener" class="st-rec-a">
      <span class="ico">${ic(r.tipo === 'video' ? 'play' : r.tipo === 'repositorio' ? 'ramo' : r.tipo === 'marca' ? 'studio' : r.tipo === 'pasta' ? 'pasta' : 'imagem')}</span>
      <span class="tx"><span class="nm">${esc(r.titulo)}</span>${r.descricao ? `<span class="ds">${esc(r.descricao)}</span>` : ''}<span class="hs">${esc(host)} ↗</span></span></a>
    ${pode ? `<span class="bts">${ibtn('pencil', 'Editar', `stRecModal('${r.id}')`)}${ibtn('trash', 'Apagar', `stRecApagar('${r.id}')`)}</span>` : ''}</div>`;
}
function stRecModal(id){
  const r = (studioM.recursos || []).find(x => x.id === id) || {};
  abreModal(`<h3>${ic('pasta')} ${id ? 'Editar recurso' : 'Novo recurso'}</h3>
    <div class="fld"><label for="rc-tit">Nome</label><input id="rc-tit" value="${esc(r.titulo || '')}" placeholder="Ex.: Fotos do Cybathlon 2024"></div>
    <div class="st-plano-2"><div class="fld"><label for="rc-tipo">Tipo</label><select id="rc-tipo">${Object.entries(ST_RECURSO_TIPOS).map(([k, l]) =>
      `<option value="${k}"${(r.tipo || 'pasta') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label for="rc-url">Link</label><input id="rc-url" type="url" value="${esc(r.url || '')}" placeholder="https://drive.google.com/…"></div></div>
    <div class="fld"><label for="rc-desc">O que tem lá (opcional)</label><textarea id="rc-desc" rows="2">${esc(r.descricao || '')}</textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="stRecSalvar('${id || ''}')">Salvar</button></div>`, 'largo', true);
}
async function stRecSalvar(id){
  const d = { titulo: $('#rc-tit').value.trim(), tipo: $('#rc-tipo').value, url: $('#rc-url').value.trim(), descricao: $('#rc-desc').value.trim() || null };
  if (!d.titulo || !d.url) return toast('Nome e link, os dois.', true);
  if (!/^https?:\/\//i.test(d.url)) return toast('O link precisa começar com https://', true);
  const { error } = id ? await sb.from('studio_recursos').update(d).eq('id', id)
    : await sb.from('studio_recursos').insert({ ...d, criado_por: stEu() });
  if (error) return toast('Não deu para salvar: ' + error.message, true);
  fechaModal(); toast('Recurso salvo.'); stCfgRecursos();
}
async function stRecApagar(id){
  if (!await confirma('Apagar este recurso da lista? (A pasta em si continua onde está.)', 'Apagar')) return;
  const { error } = await sb.from('studio_recursos').delete().eq('id', id);
  if (error) return toast(error.message, true);
  stCfgRecursos();
}
