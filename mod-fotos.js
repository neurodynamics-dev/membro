/* ============================================================
   MÓDULO · FOTOS — o banco de fotos da marca (2.24.0; sem votação desde a 2.25.0)
   A curadoria mora no Studio; o banco (a galeria), na Marca; e o
   criador pede fotos daqui (fotoEscolher, fotoDoBanco). Quem chama
   passa o cabeçalho da própria tela, para este módulo não depender de
   outro.

   Rotas (anunciadas por mod-studio e mod-marca):
     #/studio/curadoria               as sugestões: escolher o que entra no banco
     #/studio/curadoria/descartadas   as descartadas: pôr no banco ou devolver
     #/marca/fotos                    o banco (a galeria), com busca por texto e por tag

   Sem votação (db/2.25.0_fotos_sem_votacao.sql): quem gere o Studio
   escolhe nas sugestões, busca nos bancos ou põe por link, e a foto
   entra direto no banco. Quem só entra no Studio vê as sugestões.
   O banco também se lê sem conta, por fotos_banco_publico: é por ali
   que o Claude busca fotos para peças, wallpapers e banners.

   O endereço da imagem: com a chave do Unsplash (ou do Pexels) em
   Studio › Configurações, a página pergunta à API do banco e guarda o
   endereço (foto_imagem_definir). É ele que o canvas do criador aceita.

   Precisa das migrações db/2.24.0_fotos.sql e db/2.25.0_fotos_sem_votacao.sql.
   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, confirma, motivoRPC, copiar, fmtD, ic, navNivel2,
   ferramentas, estado, spec, dica, podeStudio, podeAprovarStudio.
   ============================================================ */

const fotosM = { temas:null, lista:[], aba:'', sel:new Set(), cq:'', ctema:'', galeria:null, gq:'', gtags:[], gtema:'', imgs:{},
  busca:{ banco:'u', q:'', res:[], marcadas:new Set(), pagina:1 }, escolher:null, cab:null };

const FT_FAMS = [['cortex','Cortex'], ['ion','Ion'], ['neuron','Neuron'], ['glia','Glia'], ['retina','Retina'], ['nexo','Nexo'],
  ['dendrito','Dendrito'], ['lumen','Lúmen'], ['ritmo','Ritmo'], ['impulso','Impulso'], ['plexo','Plexo'], ['iris','Íris']];
const FT_FAM_NOME = Object.fromEntries(FT_FAMS);
const FT_ENQ = [['feed','Feed 4:5', 4 / 5], ['story','Story 9:16', 9 / 16], ['banda','Banda 1:1', 1], ['site','Site 4:5', 4 / 5]];
const FT_BANCO = { unsplash:'Unsplash', pexels:'Pexels', link:'link' };
const FT_COLS = 'id,banco,banco_id,pagina,imagem,descricao,tema,tags,autor,licenca,busca,origem,status,votos_sim,votos_nao,votos_talvez,enquadramento,paleta,decidida_em';

/* ---------------- dados comuns ---------------- */
async function ftTemas(){
  if (fotosM.temas) return fotosM.temas;
  const { data, error } = await sb.from('foto_temas').select('chave,nome,familia,titulo,sub,termos,ordem').order('ordem');
  if (error) throw error;
  fotosM.temas = data || [];
  return fotosM.temas;
}
const ftTema = k => (fotosM.temas || []).find(t => t.chave === k) || { chave:k || '', nome:'Sem tema', familia:'cortex', titulo:'Sistemas inteligentes para a saúde humana.', sub:'', termos:[] };
const ftCurador = () => podeStudio();
const ftGestor = () => podeAprovarStudio();
const ftChave = b => b === 'pexels' ? state.studioCfg?.pexels_chave : b === 'unsplash' ? state.studioCfg?.unsplash_chave : null;
const ftPill = (t, c) => `<span class="pill ${c || ''}"><span class="dt ${c === 'p-ok' ? 'dt-ok' : c === 'p-warn' ? 'dt-warn' : ''}"></span>${esc(t)}</span>`;

/* ---------------- o endereço da imagem ---------------- */
function ftComLargura(url, w){
  try {
    const u = new URL(url);
    if (u.hostname === 'images.unsplash.com'){ u.searchParams.set('auto', 'format'); u.searchParams.set('fit', 'max'); u.searchParams.set('q', '80'); u.searchParams.set('w', String(w)); }
    else if (u.hostname === 'images.pexels.com'){ u.searchParams.set('auto', 'compress'); u.searchParams.set('cs', 'tinysrgb'); u.searchParams.set('w', String(w)); }
    return u.toString();
  } catch(e){ return url; }
}
function ftImgUrl(f, w = 1080){
  const im = fotosM.imgs[f.id]?.url || f.imagem;
  if (im) return ftComLargura(im, w);
  if (f.banco === 'unsplash') return `https://unsplash.com/photos/${encodeURIComponent(f.banco_id)}/download?w=${w}`;
  if (f.banco === 'pexels') return `https://images.pexels.com/photos/${encodeURIComponent(f.banco_id)}/pexels-photo-${encodeURIComponent(f.banco_id)}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
  return f.banco_id;
}
const ftPagina = f => f.pagina || (f.banco === 'unsplash' ? `https://unsplash.com/photos/${encodeURIComponent(f.banco_id)}`
  : f.banco === 'pexels' ? `https://www.pexels.com/photo/${encodeURIComponent(f.banco_id)}/` : f.imagem || f.banco_id);

/* pergunta à API do banco pelo endereço da imagem e guarda no banco de fotos */
async function ftResolver(f){
  if (f.imagem) return true;
  if (!await ftResolverSemSalvar(f)) return false;
  sb.rpc('foto_imagem_definir', { p_foto:f.id, p_imagem:f.imagem, p_autor:f.autor || null }).then(() => {}, () => {});
  return true;
}
/* a miniatura que não carregou: com a chave, pergunta à API pelo endereço */
async function ftImgFalhou(img, id){
  if (img.dataset.tentou) return; img.dataset.tentou = '1';
  const f = [...(fotosM.lista || []), ...(fotosM.galeria || [])].find(x => x.id === id);
  if (f && await ftResolver(f)) img.src = ftComLargura(f.imagem, 480);
}
/* o erro de uma função do banco de fotos; sem a 2.25.0, diz qual migração falta */
function ftMotivo(data, error, base){
  if (error && /fotos_decidir|could not find|schema cache/i.test(error.message || '')) return base + ': falta aplicar a migração db/2.25.0_fotos_sem_votacao.sql.';
  return motivoRPC(data, error, base);
}

/* ============================================================
   A CURADORIA (Studio), sem votação
   As sugestões são as fotos que chegaram e ninguém escolheu ainda.
   A gestão marca as que servem e elas entram no banco; o resto pode
   ser descartado (e volta das descartadas quando quiser).
   ============================================================ */
async function fotoCuradoria(sub, cab){
  fotosM.cab = cab; fotosM.aba = sub === 'descartadas' ? 'descartadas' : ''; fotosM.sel = new Set();
  $('#main').innerHTML = ftCab() + estado.carregando('lista');
  try { await ftTemas(); await ftCurCarrega(); }
  catch(e){ return ftSemBanco(e); }
  ftCurDesenha();
}
function ftCab(){
  const acoes = ftGestor() ? [`<button class="btn ghost" onclick="ftModalBusca()">${ic('lupa')} Buscar nos bancos</button>`,
    `<button class="btn ghost" onclick="ftModalLinks()">${ic('link')} Pôr por link</button>`] : [];
  const n = !fotosM.aba && fotosM.lista.length ? ` <span class="n">${fotosM.lista.length}</span>` : '';
  return fotosM.cab(acoes) + navNivel2([['', 'Sugestões', '#/studio/curadoria', n], ['descartadas', 'Descartadas', '#/studio/curadoria/descartadas']],
    fotosM.aba, 'Curadoria');
}
function ftSemBanco(e){
  $('#main').innerHTML = ftCab() + `<div class="aviso-box err"><b>O banco de fotos ainda não está no banco.</b> ${esc(e?.message || '')}<br>
    <span class="small">Falta aplicar as migrações <code>db/2.24.0_fotos.sql</code> e <code>db/2.25.0_fotos_sem_votacao.sql</code>.</span></div>`;
}
async function ftCurCarrega(){
  const st = fotosM.aba === 'descartadas' ? 'descartada' : 'fila';
  const { data, error } = await sb.from('fotos').select(FT_COLS).eq('status', st).order('criado_em', { ascending:false });
  if (error) throw error;
  /* a seleção da equipe e o que acabou de chegar por link ou busca vêm antes das sugestões por tema */
  const peso = f => f.origem === 'equipe' ? 0 : ['link', 'busca'].includes(f.origem) ? 1 : 2;
  fotosM.lista = (data || []).map((f, i) => [f, i]).sort((x, y) => peso(x[0]) - peso(y[0]) || x[1] - y[1]).map(x => x[0]);
  const ids = new Set(fotosM.lista.map(f => f.id)); fotosM.sel.forEach(id => { if (!ids.has(id)) fotosM.sel.delete(id); });
}
function ftCurFiltradas(){
  const termos = norm(fotosM.cq).trim().split(/\s+/).filter(Boolean);
  return fotosM.lista.filter(f => (!fotosM.ctema || f.tema === fotosM.ctema)
    && (!termos.length || termos.every(t => norm([f.descricao, f.autor, f.busca, ftTema(f.tema).nome, ...(f.tags || [])].join(' ')).includes(t))));
}
function ftCurDesenha(){
  const g = ftGestor(), lista = ftCurFiltradas(), desc = fotosM.aba === 'descartadas';
  $('#main').innerHTML = ftCab()
    + (g ? '' : `<div class="aviso-box info">Quem gere o Studio escolhe o que entra no banco. As escolhidas ficam na <a href="#/marca/fotos">Galeria de fotos</a>, para toda a equipe.</div>`)
    + ferramentas({ busca:{ id:'ft-cq', rotulo:'Buscar', exemplo:'UTI, microscópio, equipe', valor:fotosM.cq, oninput:'ftCurBusca(this.value)' },
        filtros:`<div class="fld"><label for="ft-ctema">Tema</label><select id="ft-ctema" onchange="fotosM.ctema=this.value;ftCurDesenha()">
          <option value="">Todos</option>${ftOpcoesTema(fotosM.ctema)}</select></div>`, total:lista.length })
    + (lista.length ? `<div class="marca-grid ft-galeria ft-escolha">${lista.map(f => ftEscolhaTile(f, g)).join('')}</div>`
      : fotosM.lista.length ? estado.vazio({ texto:'Nenhuma foto com esse filtro.', acao:'<button class="btn ghost" onclick="fotosM.cq=\'\';fotosM.ctema=\'\';ftCurDesenha()">Limpar filtros</button>' })
      : estado.vazio({ texto: desc ? 'Nenhuma foto descartada.' : 'Nenhuma sugestão esperando. O banco está em dia.',
          acao: g && !desc ? `<button class="btn ghost" onclick="ftModalBusca()">${ic('lupa')} Buscar nos bancos</button>` : '' }))
    + (g ? `<div class="ft-barra" id="ft-barra" role="region" aria-label="As fotos escolhidas" hidden>
        <span class="ft-barra-n" id="ft-barra-n"></span>
        <button class="btn ghost mini" onclick="ftMarcarTodas()">Escolher todas</button>
        <button class="btn ghost mini" onclick="fotosM.sel=new Set();ftCurDesenha()">Limpar</button>
        <span class="cresce"></span>
        ${desc ? `<button class="btn ghost" onclick="ftDecidir('fila')">Devolver às sugestões</button>`
               : `<button class="btn ghost" onclick="ftDecidir('descartada')">${ic('x')} Descartar</button>`}
        <button class="btn solid" id="ft-por" onclick="ftDecidir('aprovada')">${ic('check')} Pôr no banco</button></div>` : '');
  ftBarra();
}
function ftEscolhaTile(f, g){
  const on = fotosM.sel.has(f.id);
  const img = `<img loading="lazy" src="${esc(ftImgUrl(f, 480))}" alt="" onerror="ftImgFalhou(this,'${f.id}')">`;
  return `<article class="card marca-tile ft-tile${on ? ' on' : ''}">
    ${g ? `<button type="button" class="ft-tile-foto ft-marcar" aria-pressed="${on}" onclick="ftMarcar('${f.id}')" aria-label="Escolher: ${esc(f.descricao)}">${img}<i class="ft-bf-ok">${ic('check')}</i></button>`
        : `<a class="ft-tile-foto" href="${esc(ftPagina(f))}" target="_blank" rel="noopener" aria-label="${esc(f.descricao)}">${img}</a>`}
    <div class="marca-tile-corpo"><h3>${esc(f.descricao)}</h3>
      <div class="marca-tile-meta">${ftPill(ftTema(f.tema).nome)}${f.origem === 'equipe' ? ftPill('Seleção da equipe', 'p-ok') : ''}</div>
      <span class="small muted">${(f.tags || []).slice(0, 3).map(esc).join(', ')}</span>
      <span class="small muted">${f.autor ? esc(f.autor) + ', ' : ''}<a href="${esc(ftPagina(f))}" target="_blank" rel="noopener">${esc(FT_BANCO[f.banco] || f.banco)}</a></span></div></article>`;
}
function ftBarra(){
  const b = $('#ft-barra'); if (!b) return;
  const n = fotosM.sel.size; b.hidden = !n;
  $('#ft-barra-n').textContent = n === 1 ? '1 escolhida' : `${n} escolhidas`;
  $('#ft-por').innerHTML = `${ic('check')} Pôr ${n === 1 ? 'a foto' : n} no banco`;
}
function ftMarcar(id){
  fotosM.sel.has(id) ? fotosM.sel.delete(id) : fotosM.sel.add(id);
  const on = fotosM.sel.has(id), bt = document.querySelector(`.ft-marcar[onclick="ftMarcar('${id}')"]`);
  if (bt){ bt.setAttribute('aria-pressed', on); bt.closest('.ft-tile').classList.toggle('on', on); }
  ftBarra();
}
function ftMarcarTodas(){ ftCurFiltradas().forEach(f => fotosM.sel.add(f.id)); ftCurDesenha(); }
function ftCurBusca(v){
  fotosM.cq = v; clearTimeout(fotosM._cq);
  fotosM._cq = setTimeout(() => { ftCurDesenha(); const e = $('#ft-cq'); if (e){ e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 220);
}
async function ftDecidir(status){
  const ids = [...fotosM.sel]; if (!ids.length) return;
  /* no banco, a foto precisa do endereço da imagem para o criador: com a chave, já pergunta */
  if (status === 'aprovada') await Promise.all(fotosM.lista.filter(f => ids.includes(f.id) && !f.imagem).map(ftResolver));
  const { data, error } = await sb.rpc('fotos_decidir', { p_ids:ids, p_status:status });
  if (error || data?.status !== 'ok') return toast(ftMotivo(data, error, 'As fotos não mudaram'), true);
  const n = data.fotos, um = n === 1;
  toast(status === 'aprovada' ? `${n} ${um ? 'foto entrou' : 'fotos entraram'} no banco.`
    : status === 'descartada' ? `${n} ${um ? 'foto descartada' : 'fotos descartadas'}.` : `${n} de volta às sugestões.`);
  fotosM.sel = new Set(); fotosM.galeria = null;
  try { await ftCurCarrega(); } catch(e){ return ftSemBanco(e); }
  ftCurDesenha();
}

/* ---------------- pôr no banco: por link e pela busca ---------------- */
const ftOpcoesTema = sel => (fotosM.temas || []).map(t => `<option value="${esc(t.chave)}"${t.chave === sel ? ' selected' : ''}>${esc(t.nome)}</option>`).join('');
const ftTagsDe = s => String(s || '').split(',').map(t => t.trim()).filter(Boolean);
function ftModalLinks(){
  const t = fotosM.ctema || fotosM.temas?.[0]?.chave;
  abreModal(`<h3>${ic('link')} Pôr por link</h3>
    <div class="fld"><label for="ft-lk">Links das fotos ${dica('Endereços do Unsplash ou do Pexels, um por linha ou todos juntos. Também vale o endereço direto de uma imagem (images.unsplash.com, images.pexels.com).')}</label>
      <textarea id="ft-lk" rows="5" placeholder="https://unsplash.com/photos/..."></textarea></div>
    <div class="fld"><label for="ft-lk-tema">Tema</label><select id="ft-lk-tema">${ftOpcoesTema(t)}</select></div>
    <div class="fld"><label for="ft-lk-tags">Tags, separadas por vírgula</label><input id="ft-lk-tags" placeholder="UTI, monitor"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="ftLinksOk()">Pôr no banco</button></div>`);
  setTimeout(() => $('#ft-lk')?.focus(), 30);
}
const ftLegivel = slug => { const s = String(slug || '').replace(/[-_]+/g, ' ').trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; };
function ftLerLinks(txt){
  const out = [];
  for (const p of String(txt || '').split(/(?=https?:\/\/)|\s+/).map(s => s.trim()).filter(Boolean)){
    let m = p.match(/unsplash\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:photos|fotografias|fotos|photographies|fotografien)\/([A-Za-z0-9_-]+)/i);
    if (m){ const slug = m[1], id = slug.length > 11 && slug.charAt(slug.length - 12) === '-' ? slug.slice(-11) : slug;
      out.push({ banco:'unsplash', banco_id:id, pagina:`https://unsplash.com/photos/${id}`, descricao:ftLegivel(slug.length > 11 ? slug.slice(0, -12) : '') }); continue; }
    m = p.match(/pexels\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:photo|foto)\/(?:([^/?#\s]*?)-)?(\d+)/i);
    if (m){ out.push({ banco:'pexels', banco_id:m[2], pagina:`https://www.pexels.com/photo/${m[2]}/`, descricao:ftLegivel(m[1]) }); continue; }
    m = p.match(/^https:\/\/images\.(unsplash|pexels)\.com\/[^\s]+/);
    if (m) out.push({ banco:'link', banco_id:p.split('?')[0], imagem:p, pagina:p, descricao:'' });
  }
  return out;
}
/* com a chave, já leva o endereço da imagem e o autor de cada foto posta por link */
async function ftComImagem(f){
  if (f.imagem || f.banco === 'link') return f;
  const x = { ...f }; return await ftResolverSemSalvar(x) ? x : f;
}
/* o endereço da imagem, o autor e a descrição pela API do banco (com a chave), sem gravar */
async function ftResolverSemSalvar(f){
  const k = ftChave(f.banco); if (!k) return false;
  try {
    if (f.banco === 'unsplash'){
      const r = await fetch(`https://api.unsplash.com/photos/${encodeURIComponent(f.banco_id)}?client_id=${encodeURIComponent(k)}`); if (!r.ok) return false;
      const j = await r.json(); f.imagem = j.urls?.raw || j.urls?.regular; f.autor = f.autor || j.user?.name || null;
      if (!f.descricao) f.descricao = j.alt_description || j.description || '';
    } else if (f.banco === 'pexels'){
      const r = await fetch(`https://api.pexels.com/v1/photos/${encodeURIComponent(f.banco_id)}`, { headers:{ Authorization:k } }); if (!r.ok) return false;
      const j = await r.json(); f.imagem = j.src?.original || j.src?.large2x; f.autor = f.autor || j.photographer || null;
      if (!f.descricao) f.descricao = j.alt || '';
    }
    return !!f.imagem;
  } catch(e){ return false; }
}
async function ftLinksOk(){
  const lista = ftLerLinks($('#ft-lk').value), tema = $('#ft-lk-tema').value, tags = ftTagsDe($('#ft-lk-tags').value);
  if (!lista.length) return toast('Nenhum link do Unsplash ou do Pexels no texto.', true);
  const prontas = await Promise.all(lista.map(ftComImagem));
  await ftPorNoBanco(prontas.map(f => ({ ...f, tema, tags, origem:'link' })));
}
async function ftPorNoBanco(lista){
  const { data, error } = await sb.rpc('fotos_adicionar', { p_fotos:lista });
  if (error || data?.status !== 'ok') return toast(ftMotivo(data, error, 'As fotos não entraram'), true);
  fechaModal(); fotosM.galeria = null;
  const n = (data.novas || 0) + (data.reativadas || 0);
  toast(n ? `${n} ${n === 1 ? 'foto entrou' : 'fotos entraram'} no banco${data.repetidas ? `; ${data.repetidas} já ${data.repetidas === 1 ? 'estava' : 'estavam'}` : ''}.`
    : 'Essas fotos já estavam no banco.');
  if ($('#ft-cq')){ try { await ftCurCarrega(); ftCurDesenha(); } catch(e){ ftSemBanco(e); } }
}

function ftModalBusca(){
  const b = fotosM.busca, temChave = ftChave('unsplash') || ftChave('pexels');
  if (!ftChave(b.banco === 'p' ? 'pexels' : 'unsplash')) b.banco = ftChave('unsplash') ? 'u' : 'p';
  const t = fotosM.ctema || fotosM.temas?.[0]?.chave;
  abreModal(`<h3>${ic('lupa')} Buscar nos bancos</h3>
    ${temChave ? `<div class="ft-busca-linha">
        <div class="seg" role="group" aria-label="Banco">${[['u', 'Unsplash'], ['p', 'Pexels']].map(([k, l]) =>
          `<button type="button" class="${b.banco === k ? 'on' : ''}" aria-pressed="${b.banco === k}"${ftChave(k === 'u' ? 'unsplash' : 'pexels') ? '' : ' disabled'}
            onclick="fotosM.busca.banco='${k}';ftModalBusca()">${l}</button>`).join('')}</div>
        <div class="fld cresce"><label class="sr" for="ft-bq">Termo</label><input id="ft-bq" placeholder="Em inglês rende mais: lab automation" value="${esc(b.q)}"
          onkeydown="if(event.key==='Enter')ftBusca(1)"></div>
        <button class="btn ghost" onclick="ftBusca(1)">Buscar</button></div>
      <div class="ft-busca-sug" id="ft-bsug"></div>
      <div id="ft-bres" class="ft-bres"></div>
      <div class="ft-busca-pe">
        <div class="fld"><label for="ft-b-tema">Tema</label><select id="ft-b-tema" onchange="ftBuscaSugestoes()">${ftOpcoesTema(t)}</select></div>
        <div class="fld cresce"><label for="ft-b-tags">Tags, separadas por vírgula</label><input id="ft-b-tags" placeholder="laboratório, automação"></div>
      </div>
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
        <button class="btn solid" id="ft-b-ok" onclick="ftBuscaOk()" disabled>Pôr no banco</button></div>`
    : `<div class="aviso-box info">Para buscar daqui, ponha a chave do Unsplash ou do Pexels em
        <a href="#/studio/config/contas" onclick="fechaModal()">Studio, Configurações</a>. Sem chave, use <b>Pôr por link</b>.</div>
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`}`, 'largo');
  if (temChave){ ftBuscaSugestoes(); if (b.res.length) ftBuscaDesenha(); setTimeout(() => $('#ft-bq')?.focus(), 30); }
}
function ftBuscaSugestoes(){
  const T = ftTema($('#ft-b-tema')?.value), s = $('#ft-bsug'); if (!s) return;
  s.innerHTML = (T.termos || []).map(q => `<button type="button" class="chip" onclick="$('#ft-bq').value='${esc(q)}';ftBusca(1)">${esc(q)}</button>`).join('');
}
async function ftBusca(pagina){
  const b = fotosM.busca, q = $('#ft-bq')?.value.trim(); if (!q) return;
  b.q = q; b.pagina = pagina; b.marcadas = new Set();
  $('#ft-bres').innerHTML = estado.carregando();
  try {
    if (b.banco === 'u'){
      const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24&page=${pagina}&content_filter=high&client_id=${encodeURIComponent(ftChave('unsplash'))}`);
      if (!r.ok) throw new Error(r.status === 401 ? 'a chave do Unsplash foi recusada' : 'o Unsplash respondeu ' + r.status);
      const j = await r.json();
      b.res = (j.results || []).map(p => ({ banco:'unsplash', banco_id:p.id, pagina:p.links?.html || `https://unsplash.com/photos/${p.id}`, imagem:p.urls?.raw,
        mini:p.urls?.small, descricao:p.alt_description || p.description || q, autor:p.user?.name || null }));
      b.total = j.total_pages || 1;
    } else {
      const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=24&page=${pagina}`, { headers:{ Authorization:ftChave('pexels') } });
      if (!r.ok) throw new Error(r.status === 401 ? 'a chave do Pexels foi recusada' : 'o Pexels respondeu ' + r.status);
      const j = await r.json();
      b.res = (j.photos || []).map(p => ({ banco:'pexels', banco_id:String(p.id), pagina:p.url, imagem:p.src?.original, mini:p.src?.medium,
        descricao:p.alt || q, autor:p.photographer || null }));
      b.total = j.next_page ? pagina + 1 : pagina;
    }
    ftBuscaDesenha();
  } catch(e){ $('#ft-bres').innerHTML = estado.erro({ texto:'A busca falhou: ' + e.message + '.' }); }
}
function ftBuscaDesenha(){
  const b = fotosM.busca;
  $('#ft-bres').innerHTML = b.res.length ? `<div class="cr-us-grade">${b.res.map((f, i) => `
      <button type="button" class="cr-us-f ft-bf${b.marcadas.has(i) ? ' on' : ''}" aria-pressed="${b.marcadas.has(i)}" onclick="ftBuscaMarca(${i})" title="${esc(f.descricao)}">
        <img src="${esc(f.mini)}" alt="" loading="lazy"><span>${esc(f.autor || '')}</span><i class="ft-bf-ok">${ic('check')}</i></button>`).join('')}</div>
    <div class="cr-us-pag">${b.pagina > 1 ? `<button class="btn ghost mini" onclick="ftBusca(${b.pagina - 1})">Anteriores</button>` : ''}
      ${b.pagina < b.total ? `<button class="btn ghost mini" onclick="ftBusca(${b.pagina + 1})">Mais fotos</button>` : ''}</div>`
    : estado.vazio({ texto:'Nada com essa busca. Tente em inglês, ou mais genérico.' });
  const ok = $('#ft-b-ok'); if (ok){ ok.disabled = !b.marcadas.size; ok.textContent = b.marcadas.size ? `Pôr ${b.marcadas.size} no banco` : 'Pôr no banco'; }
}
function ftBuscaMarca(i){ const s = fotosM.busca.marcadas; s.has(i) ? s.delete(i) : s.add(i); ftBuscaDesenha(); }
async function ftBuscaOk(){
  const b = fotosM.busca, tema = $('#ft-b-tema').value, tags = ftTagsDe($('#ft-b-tags').value);
  const lista = [...b.marcadas].map(i => b.res[i]).filter(Boolean).map(({ mini, ...f }) => ({ ...f, tema, tags, busca:b.q, origem:'busca' }));
  if (lista.length) await ftPorNoBanco(lista);
}

/* ============================================================
   A GALERIA (Marca)
   ============================================================ */
async function fotoGaleria(cab){
  fotosM.cab = cab;
  $('#main').innerHTML = cab('Galeria de fotos', 'fotos') + estado.carregando('lista');
  try {
    await ftTemas();
    const { data, error } = await sb.from('fotos').select(FT_COLS).eq('status', 'aprovada').order('decidida_em', { ascending:false });
    if (error) throw error;
    fotosM.galeria = data || [];
  } catch(e){
    $('#main').innerHTML = cab('Galeria de fotos', 'fotos') + estado.erro({ texto:'A galeria não abriu: ' + e.message + '. Falta aplicar a migração db/2.24.0_fotos.sql?' });
    return;
  }
  ftGalDesenha();
}
function ftGalFiltradas(){
  const q = norm(fotosM.gq).trim(), termos = q ? q.split(/\s+/) : [];
  return (fotosM.galeria || []).filter(f => {
    if (fotosM.gtema && f.tema !== fotosM.gtema) return false;
    const tags = (f.tags || []).map(norm);
    if (fotosM.gtags.some(t => !tags.includes(norm(t)))) return false;
    if (!termos.length) return true;
    const texto = norm([f.descricao, f.autor, ftTema(f.tema).nome, ...(f.tags || [])].join(' '));
    return termos.every(t => texto.includes(t));
  });
}
function ftGalDesenha(){
  const lista = ftGalFiltradas(), todas = fotosM.galeria || [];
  const conta = {}; todas.forEach(f => (f.tags || []).forEach(t => { conta[t] = (conta[t] || 0) + 1; }));
  const tops = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 18).map(x => x[0]);
  fotosM.gtags.forEach(t => { if (!tops.includes(t)) tops.unshift(t); });
  $('#main').innerHTML = fotosM.cab('Galeria de fotos', 'fotos', {
      lead:`O banco de fotos da marca, escolhido pela gestão do Studio. ${dica('Copiar a lista leva as fotos filtradas em JSON (descrição, tema, tags, autor, licença e os links). O Claude também lê o banco direto, pela função fotos_banco_publico.')}`,
      acoes:[`<button class="btn ghost" onclick="ftCopiarLista()"${lista.length ? '' : ' disabled'}>${ic('copy')} Copiar a lista</button>`,
        ...(podeStudio() ? ['<a class="btn ghost" href="#/studio/curadoria">Curadoria</a>'] : [])] })
    + ferramentas({ busca:{ id:'ft-gq', rotulo:'Buscar', exemplo:'UTI, microscópio, equipe', valor:fotosM.gq, oninput:'ftGalBusca(this.value)' },
        filtros:`<div class="fld"><label for="ft-gtema">Tema</label><select id="ft-gtema" onchange="fotosM.gtema=this.value;ftGalDesenha()">
          <option value="">Todos</option>${ftOpcoesTema(fotosM.gtema)}</select></div>`, total:lista.length })
    + `<div class="ft-tags" role="group" aria-label="Tags">${tops.map(t => { const on = fotosM.gtags.includes(t);
        return `<button type="button" class="chip${on ? ' on' : ''}" aria-pressed="${on}" onclick="ftGalTag(this.dataset.t)" data-t="${esc(t)}">${esc(t)}${conta[t] ? ` <b>${conta[t]}</b>` : ''}</button>`; }).join('')}</div>`
    + (lista.length ? `<div class="marca-grid ft-galeria">${lista.map(f => `<article class="card marca-tile ft-tile">
        <button type="button" class="ft-tile-foto" onclick="ftDetalhe('${f.id}')" aria-label="${esc(f.descricao)}"><img loading="lazy" src="${esc(ftImgUrl(f, 480))}" alt=""></button>
        <div class="marca-tile-corpo"><h3>${esc(f.descricao)}</h3>
          <div class="marca-tile-meta">${(f.tags || []).slice(0, 3).map(t => `<span class="chip mini">${esc(t)}</span>`).join('')}</div>
          <span class="small muted">${esc(ftTema(f.tema).nome)}${f.autor ? ', ' + esc(f.autor) : ''}</span></div></article>`).join('')}</div>`
      : todas.length ? estado.vazio({ texto:'Nenhuma foto com esse filtro.', acao:'<button class="btn ghost" onclick="ftGalLimpar()">Limpar filtros</button>' })
      : estado.vazio({ texto:'O banco ainda está vazio.', acao: podeStudio() ? '<a class="btn ghost" href="#/studio/curadoria">Abrir a curadoria</a>' : '' }));
}
function ftGalBusca(v){
  fotosM.gq = v; clearTimeout(fotosM._q);
  fotosM._q = setTimeout(() => { ftGalDesenha(); const e = $('#ft-gq'); if (e){ e.focus(); e.setSelectionRange(e.value.length, e.value.length); } }, 220);
}
function ftGalTag(t){ const a = fotosM.gtags; fotosM.gtags = a.includes(t) ? a.filter(x => x !== t) : [...a, t]; ftGalDesenha(); }
function ftGalLimpar(){ fotosM.gq = ''; fotosM.gtags = []; fotosM.gtema = ''; ftGalDesenha(); }

function ftDetalhe(id){
  const f = (fotosM.galeria || []).find(x => x.id === id); if (!f) return;
  const banco = FT_BANCO[f.banco] || f.banco;
  abreModal(`<div class="ft-det"><img src="${esc(ftImgUrl(f, 1600))}" alt="${esc(f.descricao)}"></div>
    <h3>${esc(f.descricao)}</h3>
    ${spec([['Tema', esc(ftTema(f.tema).nome)], ['Tags', (f.tags || []).map(t => `<span class="chip mini">${esc(t)}</span>`).join(' ') || '—'],
      ['Autor', esc(f.autor || '—')], ['Banco e licença', `${esc(banco)}${f.licenca ? ', ' + esc(f.licenca) : ''}`],
      ['No banco desde', fmtD(f.decidida_em)], f.enquadramento ? ['Peça da aprovação', `${esc(FT_ENQ.find(e => e[0] === f.enquadramento)?.[1] || f.enquadramento)}${f.paleta ? ', ' + esc(FT_FAM_NOME[f.paleta] || f.paleta) : ''}`] : null])}
    <div class="acts ft-det-acoes">
      <a class="btn ghost" href="${esc(ftPagina(f))}" target="_blank" rel="noopener">${ic('externo')} Abrir no ${esc(banco)}</a>
      ${f.imagem ? `<button class="btn ghost" onclick="copiar('${esc(ftComLargura(f.imagem, 2400))}')">${ic('copy')} Copiar o link da imagem</button>` : ''}
      ${ftCurador() ? `<button class="btn ghost" onclick="ftEditar('${f.id}')">${ic('pencil')} Editar</button>` : ''}
      ${ftGestor() ? `<button class="btn ghost" onclick="ftTirar('${f.id}')">${ic('trash')} Tirar da galeria</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'largo');
}
function ftEditar(id){
  const f = (fotosM.galeria || []).find(x => x.id === id); if (!f) return;
  abreModal(`<h3>${ic('pencil')} Editar a foto</h3>
    <div class="fld"><label for="ft-e-d">Descrição</label><input id="ft-e-d" value="${esc(f.descricao)}"></div>
    <div class="fld"><label for="ft-e-t">Tema</label><select id="ft-e-t">${ftOpcoesTema(f.tema)}</select></div>
    <div class="fld"><label for="ft-e-tags">Tags, separadas por vírgula</label><input id="ft-e-tags" value="${esc((f.tags || []).join(', '))}"></div>
    <div class="fld"><label for="ft-e-a">Autor</label><input id="ft-e-a" value="${esc(f.autor || '')}"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="ftDetalhe('${f.id}')">Cancelar</button>
      <button class="btn solid" onclick="ftSalvarEdicao('${f.id}')">Salvar</button></div>`);
}
async function ftSalvarEdicao(id){
  const p = { id, descricao:$('#ft-e-d').value, tema:$('#ft-e-t').value, tags:ftTagsDe($('#ft-e-tags').value), autor:$('#ft-e-a').value };
  const { data, error } = await sb.rpc('foto_salvar', { p });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'A foto não foi salva'), true);
  const f = (fotosM.galeria || []).find(x => x.id === id);
  if (f) Object.assign(f, { descricao:p.descricao.trim() || f.descricao, tema:p.tema, tags:[...new Set(p.tags)].slice(0, 12), autor:p.autor.trim() || null });
  toast('Foto salva.'); fechaModal(); ftGalDesenha();
}
async function ftTirar(id){
  if (!await confirma('A foto sai do banco e do criador, e fica nas descartadas da curadoria.', 'Tirar da galeria')) return;
  const { data, error } = await sb.rpc('foto_status_definir', { p_foto:id, p_status:'descartada' });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'A foto não saiu da galeria'), true);
  fotosM.galeria = (fotosM.galeria || []).filter(x => x.id !== id);
  toast('A foto saiu da galeria.'); ftGalDesenha();
}
function ftCopiarLista(){
  const lista = ftGalFiltradas().map(f => ({ descricao:f.descricao, tema:ftTema(f.tema).nome, tags:f.tags || [], autor:f.autor || null,
    banco:FT_BANCO[f.banco] || f.banco, licenca:f.licenca || null, pagina:ftPagina(f), imagem:f.imagem ? ftComLargura(f.imagem, 2400) : null }));
  copiar(JSON.stringify({ fonte:'Galeria de fotos da NeuroDynamics (SOMA, Marca)', exportado_em:new Date().toISOString(), fotos:lista }, null, 2));
}

/* ============================================================
   O SELETOR DO CRIADOR
   fotoEscolher(aoEscolher): a galeria num modal; ao escolher, chama
   aoEscolher(foto, url) com o endereço que o canvas aceita.
   ============================================================ */
async function fotoEscolher(aoEscolher){
  fotosM.escolher = { ao:aoEscolher, q:'' };
  abreModal(`<h3>${ic('galeria')} Fotos da galeria</h3>
    <div class="fld"><label class="sr" for="ft-esc-q">Buscar</label><input id="ft-esc-q" placeholder="Buscar por tag ou descrição: UTI, microscópio" oninput="fotosM.escolher.q=this.value;ftEscolherLista()"></div>
    <div id="ft-esc" class="ft-esc">${estado.carregando()}</div>
    <div class="acts" style="justify-content:flex-end;margin-top:12px"><a class="btn ghost" href="#/marca/fotos" onclick="fechaModal()">Abrir a galeria</a>
      <button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'largo');
  setTimeout(() => $('#ft-esc-q')?.focus(), 30);
  try {
    await ftTemas();
    if (!fotosM.galeria){
      const { data, error } = await sb.from('fotos').select(FT_COLS).eq('status', 'aprovada').order('decidida_em', { ascending:false });
      if (error) throw error; fotosM.galeria = data || [];
    }
    ftEscolherLista();
  } catch(e){ const el = $('#ft-esc'); if (el) el.innerHTML = estado.erro({ texto:'A galeria não abriu: ' + e.message + '.' }); }
}
function ftEscolherLista(){
  const el = $('#ft-esc'); if (!el) return;
  const termos = norm(fotosM.escolher?.q || '').trim().split(/\s+/).filter(Boolean);
  const lista = (fotosM.galeria || []).filter(f => !termos.length
    || termos.every(t => norm([f.descricao, f.autor, ftTema(f.tema).nome, ...(f.tags || [])].join(' ')).includes(t)));
  el.innerHTML = lista.length ? `<div class="cr-us-grade">${lista.map(f => `<button type="button" class="cr-us-f" onclick="ftEscolhe('${f.id}')" title="${esc(f.descricao)}">
      <img src="${esc(ftImgUrl(f, 400))}" alt="" loading="lazy"><span>${esc((f.tags || []).slice(0, 2).join(', '))}</span></button>`).join('')}</div>`
    : estado.vazio({ texto: (fotosM.galeria || []).length ? 'Nenhuma foto com essa busca.' : 'O banco ainda está vazio. Quem gere o Studio põe fotos em Studio, Curadoria.' });
}
async function ftEscolhe(id){
  const f = (fotosM.galeria || []).find(x => x.id === id); if (!f || !fotosM.escolher) return;
  const url = await fotoUrlCanvas(f);
  if (!url) return;
  fotosM.escolher.ao(f, url, `${f.autor || FT_BANCO[f.banco] || 'Foto'} / ${FT_BANCO[f.banco] || 'link'}`);
}
/* uma foto do banco para o criador, sem escolher (2.25.0): da família pedida, se houver,
   sem repetir as que a peça já usa; só as que já têm o endereço da imagem */
async function fotoDoBanco({ familia, evitar = [] } = {}){
  await ftTemas();
  if (!fotosM.galeria){
    const { data, error } = await sb.from('fotos').select(FT_COLS).eq('status', 'aprovada').order('decidida_em', { ascending:false });
    if (error) throw error; fotosM.galeria = data || [];
  }
  const usaveis = fotosM.galeria.filter(f => f.imagem && !evitar.includes(f.id));
  if (!usaveis.length) return null;
  const daFam = familia ? usaveis.filter(f => (f.paleta || ftTema(f.tema).familia) === familia) : [];
  const lista = daFam.length ? daFam : usaveis;
  const f = lista[Math.floor(Math.random() * lista.length)];
  const url = await fotoUrlCanvas(f);
  return url ? { f, url, credito:`${f.autor || FT_BANCO[f.banco] || 'Foto'} / ${FT_BANCO[f.banco] || 'link'}` } : null;
}
/* o endereço que o canvas aceita (o CDN do banco); o Unsplash pede que o uso seja avisado */
async function fotoUrlCanvas(f){
  if (!f.imagem && !await ftResolver(f)){
    toast(`Esta foto ainda não tem o endereço da imagem. Ponha a chave do ${FT_BANCO[f.banco] || 'banco'} em Studio, Configurações.`, true);
    return null;
  }
  const k = ftChave('unsplash');
  if (f.banco === 'unsplash' && k) fetch(`https://api.unsplash.com/photos/${encodeURIComponent(f.banco_id)}/download?client_id=${encodeURIComponent(k)}`).catch(() => {});
  return f.banco === 'link' ? f.imagem : ftComLargura(f.imagem, 2400);
}
