/* ============================================================
   MÓDULO · FEED (2.19.1, ficha F1; contrato em fichas/CONTRATO-FEED.md)
   O feed da equipe, a mesa editorial (quem publica é admin ou o grupo
   NRO_MANAGERS), a newsletter sem votos e a importação da comunidade.

   Rotas:
     #/servicos/feed                feed da equipe (reações nas notícias)
     #/servicos/feed/<id>           o mesmo, com a publicação em foco
     #/servicos/feed/editorial      a mesa editorial (só editor)
     #/servicos/newsletter          próximas edições e as já criadas

   Depende da casca para: sb, $, esc, state, toast, falha, abreModal,
   fechaModal, confirma, fmtD, fmtDT, ic, md, cabecalho, estado,
   layoutLeitura, souAdmin, tenhoPapel, carregarLib.
   ============================================================ */

const feed = { lista:[], tipo:null, fim:false, ocupado:false, ed:{ itens:[], filtro:'pronto' }, edicao:null, vez:0 };
const FEED_EMOJIS = ['👏', '❤️', '🎉', '💡', '🚀', '😮']; // auditar: ok, as reações são dado (o banco só aceita estes seis)
const feedTag = t => `<span class="tag">${t === 'noticia' ? 'Notícia' : 'Tópico'}</span>`;
const feedSlugOk = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/* o status que não é 'ok' fica com quem chamou; erro de rede/permissão vira exceção */
async function feedRPC(nome, p){
  const { data, error } = await sb.rpc(nome, p || {});
  if (error) throw error;
  return data;
}
const feedPartes = () => location.hash.split('?')[0].split('/');

/* ---------------- o feed da equipe ---------------- */
async function pageFeed(){
  const [, , , x] = feedPartes();
  if (x === 'editorial') return feedMesa();
  const vez = ++feed.vez;
  feed.lista = []; feed.fim = false;
  const mesa = state.feedEditor ? '<a class="btn" href="#/servicos/feed/editorial">Mesa editorial</a>' : '';
  $('#main').innerHTML = cabecalho({ espaco:'Serviços', titulo:'Feed da equipe', acoes:[mesa] })
    + `<div class="seg" role="group" aria-label="Tipo de publicação" style="margin-bottom:18px">${[[null, 'Tudo'], ['noticia', 'Notícias'], ['topico', 'Tópicos']].map(([k, l]) =>
      `<button type="button" data-t="${k || ''}" class="${feed.tipo === k ? 'on' : ''}" aria-pressed="${feed.tipo === k}" onclick="feedFiltro(${k ? `'${k}'` : 'null'})">${l}</button>`).join('')}</div>`
    + layoutLeitura('<div id="feed-lista"></div><button id="feed-mais" class="btn ghost" style="margin-top:28px;width:100%;justify-content:center" onclick="feedMais()" hidden>Carregar mais</button>');
  $('#feed-lista').innerHTML = estado.carregando('lista');
  await feedMais(true, vez);
  if (x && x !== 'editorial') document.getElementById('feed-' + x)?.scrollIntoView({ block:'start' });
}
function feedFiltro(t){ feed.tipo = t; pageFeed(); }

async function feedMais(primeira, vez){
  const el = $('#feed-lista'), bt = $('#feed-mais'); if (!el || !bt) return;
  bt.disabled = true;
  try{
    const ult = feed.lista.at(-1);
    const itens = await feedRPC('feed_lista', { ...(ult ? { p_antes:ult.publicado_em, p_id:ult.id } : {}), p_limite:20, p_tipo:feed.tipo });
    if (vez && vez !== feed.vez) return;
    if (primeira) el.innerHTML = '';
    const novos = Array.isArray(itens) ? itens : [];
    feed.lista.push(...novos); bt.hidden = novos.length < 20;
    if (!feed.lista.length) el.innerHTML = estado.vazio({ texto:'Nada publicado ainda. O que a liderança envia no reporte passa pela mesa editorial antes de aparecer aqui.' });
    el.insertAdjacentHTML('beforeend', novos.map(feedArtigo).join(''));
    feedImagens(novos);
  }catch(e){
    el.innerHTML = estado.erro({ texto:'Não foi possível carregar o feed: ' + e.message + '.', acao:'<button class="btn ghost mini" onclick="pageFeed()">Tentar de novo</button>' });
  }finally{ bt.disabled = false; }
}

function feedArtigo(f){
  const acao = state.feedEditor
    ? `<button type="button" class="icbtn sm" style="margin-left:auto" aria-label="Retirar publicação" title="Retirar publicação" onclick="feedRetirar('${f.id}')">${ic('x')}</button>`
    : tenhoPapel('pessoal')
      ? `<button type="button" class="icbtn sm" style="margin-left:auto" aria-label="Ocultar publicação" title="Ocultar publicação" onclick="feedOcultar('${f.id}')">${ic('x')}</button>` : '';
  const imgs = (f.imagens || []).map((i, n) => `<figure><img id="feed-img-${f.id}-${n}" alt="${esc(i.legenda || f.titulo)}" loading="lazy">${i.legenda ? `<figcaption>${esc(i.legenda)}</figcaption>` : ''}</figure>`).join('');
  return `<article class="artigo" id="feed-${esc(f.id)}"><div class="artigo-meta">${feedTag(f.tipo)}<span>${esc(f.autor || '')}</span><time>${fmtDT(f.publicado_em)}</time>${f.publico ? '<span class="tag">No site</span>' : ''}${acao}</div>
    <h2>${esc(f.titulo)}</h2>${f.subtitulo ? `<p class="sub">${esc(f.subtitulo)}</p>` : ''}${imgs}<div class="md">${md(f.texto)}</div>
    ${f.tipo === 'noticia' ? `<div id="feed-reac-${esc(f.id)}">${feedBarra(f)}</div>` : ''}</article>`;
}
async function feedImagens(itens){
  for (const f of itens) for (const [n, i] of (f.imagens || []).entries()){
    try{
      const { data, error } = await sb.storage.from('feed').createSignedUrl(i.path, 300);
      const img = document.getElementById(`feed-img-${f.id}-${n}`);
      if (!error && data?.signedUrl && img) img.src = data.signedUrl;
    }catch(_){ /* a imagem não carrega: o texto continua */ }
  }
}

/* reações: os seis emojis, sempre na mesma ordem */
function feedBarra(f){
  const r = f.reacoes || {};
  return `<div class="reacoes" role="group" aria-label="Reações">${FEED_EMOJIS.map(e => {
    const c = Number(r[e] || 0), meu = f.minha_reacao === e;
    return `<button type="button" class="reacao" aria-pressed="${meu}" aria-label="Reagir com ${e}${c ? ', ' + c + (c === 1 ? ' pessoa' : ' pessoas') : ''}"
      onclick="feedReagir('${f.id}','${e}')">${e}${c ? ` <span class="n">${c}</span>` : ''}</button>`; }).join('')}</div>`;
}
async function feedReagir(id, emoji){
  const f = feed.lista.find(x => x.id === id), el = document.getElementById('feed-reac-' + id); if (!f || !el) return;
  const bts = el.querySelectorAll('button'); bts.forEach(b => b.disabled = true);
  try{
    const d = await feedRPC('feed_reagir', { p_ref:id, p_emoji: f.minha_reacao === emoji ? null : emoji });
    if (d?.status === 'ok'){ f.reacoes = d.reacoes || {}; f.minha_reacao = d.minha_reacao || null; el.innerHTML = feedBarra(f); return; }
    toast(d?.status === 'limite' ? 'Muitas reações seguidas. Espere alguns minutos.' : 'Sua conta não pode reagir a esta publicação.', true);
  }catch(e){ falha(e, 'Não foi possível registrar a reação'); }
  bts.forEach(b => b.disabled = false);
}
async function feedOcultar(id){
  if (!await confirma('A publicação deixará de aparecer no feed.', 'Ocultar publicação')) return;
  try{ await feedRPC('feed_ocultar', { p_id:id }); await pageFeed(); }catch(e){ falha(e, 'Não foi possível ocultar a publicação'); }
}

/* ---------------- retirar e "só para a equipe" ---------------- */
async function feedApagarPublicas(apagar){
  if (!(apagar || []).length) return true;
  try{
    const { error } = await sb.storage.from('noticias').remove(apagar);
    if (error) throw error;
    return true;
  }catch(e){ toast('Retirada. As imagens públicas não foram apagadas: ' + (e.message || 'erro') + '.', true); return false; }
}
async function feedRetirar(id){
  if (!await confirma('Sai do portal, do site e da próxima newsletter agora. As cópias públicas das imagens são apagadas.', 'Retirar publicação')) return;
  try{
    const d = await feedRPC('feed_retirar', { p_id:id });
    if (d?.status !== 'ok') throw new Error(d?.status === 'sem_permissao' ? 'sem permissão' : (d?.status || 'falhou'));
    if (await feedApagarPublicas(d.apagar)) toast('Publicação retirada.');
    location.hash.includes('/editorial') ? feedMesa() : pageFeed();
  }catch(e){ falha(e, 'Não foi possível retirar a publicação'); }
}
async function feedSoEquipe(id){
  if (!await confirma('Sai do site e as imagens públicas são apagadas. Continua no portal.', 'Tirar do site')) return;
  try{
    const d = await feedRPC('feed_retirar', { p_id:id });
    if (d?.status !== 'ok') throw new Error(d?.status || 'falhou');
    await feedApagarPublicas(d.apagar);
    const p = await feedRPC('feed_publicar', { p_id:id, p_publico:false });
    if (p?.status !== 'ok') throw new Error(p?.status || 'falhou');
    toast('Agora só para a equipe.'); feedMesa();
  }catch(e){ falha(e, 'Não foi possível tirar do site'); }
}

/* ---------------- a mesa editorial ---------------- */
const FEED_FILTROS_MESA = [['pronto', 'Prontas'], ['publicando', 'Publicando'], ['publicado', 'Publicadas'], ['retirado', 'Retiradas'], [null, 'Todas']];
async function feedMesa(){
  if (!state.feedEditor){ history.replaceState(null, '', location.pathname + '#/servicos/feed'); return pageFeed(); }
  const topo = cabecalho({ espaco:'Serviços', titulo:'Mesa editorial',
    acoes:['<a class="btn ghost" href="#/servicos/feed">← Feed</a>', '<button class="btn solid" type="button" onclick="feedEditar(null)">Nova publicação</button>'] });
  $('#main').innerHTML = topo + `<div class="seg" role="group" aria-label="Situação" style="margin-bottom:14px">${FEED_FILTROS_MESA.map(([k, l]) =>
    `<button type="button" class="${feed.ed.filtro === k ? 'on' : ''}" aria-pressed="${feed.ed.filtro === k}" onclick="feed.ed.filtro=${k ? `'${k}'` : 'null'};feedMesa()">${l}</button>`).join('')}</div>
    <div id="feed-mesa">${estado.carregando('lista')}</div>`;
  try{
    const d = await feedRPC('feed_editorial', { p_estado:feed.ed.filtro });
    if (d?.status !== 'ok'){ history.replaceState(null, '', location.pathname + '#/servicos/feed'); return pageFeed(); }
    feed.ed.itens = d.itens || [];
    $('#feed-mesa').innerHTML = feed.ed.itens.length ? `<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho" id="feed-mesa-tabela"><thead><tr>
      <th>Tipo</th><th>Publicação</th><th>Autoria</th><th>Origem</th><th>Situação</th><th>Atualizada</th><th></th></tr></thead><tbody>${feed.ed.itens.map(feedLinhaMesa).join('')}</tbody></table></div></div>`
      : estado.vazio({ texto:'Nada aqui.' });
  }catch(e){
    $('#feed-mesa').innerHTML = estado.erro({ texto:'Não foi possível carregar a mesa editorial: ' + e.message + '.', acao:'<button class="btn ghost mini" onclick="feedMesa()">Tentar de novo</button>' });
  }
}
function feedSituacao(f){
  if (f.estado === 'pronto') return '<span class="pill"><span class="dt"></span>Pronta</span>';
  if (f.estado === 'publicando') return '<span class="pill p-warn"><span class="dt dt-warn"></span>Publicação incompleta</span>';
  if (f.estado === 'publicado') return f.publico ? '<span class="pill p-ok"><span class="dt dt-ok"></span>No site</span>' : '<span class="pill"><span class="dt dt-info"></span>Só equipe</span>';
  if (f.estado === 'retirado') return '<span class="pill"><span class="dt dt-gray"></span>Retirada</span>';
  return `<span class="pill">${esc(f.estado)}</span>`;
}
function feedLinhaMesa(f){
  const b = (rot, fn, extra) => `<button class="btn ghost mini" type="button" onclick="${fn}" ${extra || ''}>${rot}</button>`;
  let acoes = '';
  if (f.estado === 'pronto' || f.estado === 'retirado') acoes = b('Editar', `feedEditar('${f.id}')`) + b('Publicar…', `feedPublicarAbrir('${f.id}')`);
  else if (f.estado === 'publicando') acoes = b('Tentar de novo', `feedPublicarAbrir('${f.id}', true, true)`)
    + b('Editar', '', 'disabled title="Termine a publicação antes de editar"');
  else if (f.estado === 'publicado' && !f.publico) acoes = b('Editar', `feedEditar('${f.id}')`) + b('Publicar no site', `feedPublicarAbrir('${f.id}', true)`) + b('Retirar', `feedRetirar('${f.id}')`);
  else if (f.estado === 'publicado') acoes = b('Editar', `feedEditar('${f.id}')`) + b('Só para a equipe', `feedSoEquipe('${f.id}')`) + b('Retirar', `feedRetirar('${f.id}')`)
    + (f.tipo === 'noticia' && feedSlugOk.test(f.slug || '') ? `<a class="btn ghost mini" href="https://neurodynamics.dev/#/news/${esc(f.slug)}" target="_blank" rel="noopener">Ver no site ↗</a>` : '');
  return `<tr id="feed-m-${esc(f.id)}"><td>${feedTag(f.tipo)}</td><td><b>${esc(f.titulo)}</b><div class="small muted" style="white-space:normal">${esc(f.subtitulo || '')}</div></td>
    <td>${esc(f.autor || '—')}</td><td>${f.reporte_id ? 'Reporte' : 'Mesa'}</td><td>${feedSituacao(f)}</td><td class="mono">${fmtDT(f.atualizado_em)}</td>
    <td style="white-space:nowrap">${acoes}</td></tr>`;
}

/* ---------------- o editor ---------------- */
const FEED_ERROS_CAMPO = {
  titulo:'Escreva um título de até 200 caracteres.', subtitulo:'Escreva o resumo, de até 400 caracteres.',
  texto:'Tópico tem até 1.200 caracteres. Para texto longo, escolha Notícia completa.', imagens:'Até 8 imagens, anexadas por esta tela.'
};
function feedEditar(id){
  const f = id ? feed.ed.itens.find(x => x.id === id) : null;
  feed.edicao = { id:f?.id || null, tipo:f?.tipo || 'topico', titulo:f?.titulo || '', subtitulo:f?.subtitulo || '', texto:f?.texto || '',
    slug:f?.slug || '', autor_texto:f?.autor || '', publicado: f?.estado === 'publicado', imagens:structuredClone(f?.imagens || []), enviando:0 };
  feedEditorDesenha();
}
function feedEditorDesenha(){
  const e = feed.edicao, noticia = e.tipo === 'noticia';
  const imgs = !e.id ? '<p class="small muted">Salve o texto para anexar imagens.</p>' : `
    <input type="file" id="fe-arq" accept="image/png,image/jpeg,image/webp" onchange="feedImagemNova(this.files[0]);this.value=''" aria-label="Anexar imagem">
    <div id="fe-imgs">${e.imagens.map((i, n) => `<div class="card" style="display:flex;gap:10px;align-items:center;margin-top:8px;padding:8px">
      <img id="fe-mini-${n}" alt="" width="64" height="48" style="object-fit:cover;border-radius:6px">
      <div class="fld" style="flex:1;margin:0"><label for="fe-leg-${n}">Legenda</label><input id="fe-leg-${n}" value="${esc(i.legenda || '')}" oninput="feed.edicao.imagens[${n}].legenda=this.value"></div>
      <button type="button" class="icbtn" aria-label="Subir" ${n === 0 ? 'disabled' : ''} onclick="feedImagemMover(${n},-1)">↑</button>
      <button type="button" class="icbtn" aria-label="Descer" ${n === e.imagens.length - 1 ? 'disabled' : ''} onclick="feedImagemMover(${n},1)">↓</button>
      <button type="button" class="icbtn" aria-label="Remover imagem" onclick="feedImagemTirar(${n})">${ic('x')}</button></div>`).join('')}</div>`;
  abreModal(`<h3>${e.id ? 'Editar publicação' : 'Nova publicação'}</h3>
    <div class="fld"><span class="small muted">Tipo</span><div class="seg" role="group" aria-label="Tipo" style="margin-top:4px">
      <button type="button" class="${noticia ? '' : 'on'}" aria-pressed="${!noticia}" onclick="feedEditorTipo('topico')">Tópico</button>
      <button type="button" class="${noticia ? 'on' : ''}" aria-pressed="${noticia}" onclick="feedEditorTipo('noticia')">Notícia completa</button></div>
      <p class="small muted" id="fe-dica-tipo">${noticia ? 'Resumo, texto de pelo menos 300 caracteres e imagens com legenda. Ganha página própria no site.' : 'Breve, até 1.200 caracteres. Aparece inteiro no feed e no site.'}</p></div>
    <div class="fld"><label for="fe-titulo">Título</label><input id="fe-titulo" maxlength="200" value="${esc(e.titulo)}" oninput="feed.edicao.titulo=this.value"><p class="small erro-campo" id="fe-e-titulo" hidden></p></div>
    <div class="fld"><label for="fe-sub">Resumo</label><textarea id="fe-sub" rows="2" maxlength="400" oninput="feed.edicao.subtitulo=this.value">${esc(e.subtitulo)}</textarea><p class="small erro-campo" id="fe-e-subtitulo" hidden></p></div>
    <div class="fld"><label for="fe-texto">Texto</label><textarea id="fe-texto" rows="8" oninput="feed.edicao.texto=this.value;feedContador()">${esc(e.texto)}</textarea>
      <p class="small" id="fe-cont"></p><p class="small muted">Aceita **negrito**, *itálico*, listas com - e links [texto](https://...).</p><p class="small erro-campo" id="fe-e-texto" hidden></p></div>
    ${noticia ? `<div class="fld"><label for="fe-slug">Endereço</label><div style="display:flex;align-items:center;gap:6px"><span class="small muted">neurodynamics.dev/#/news/</span>
      <input id="fe-slug" value="${esc(e.slug)}" placeholder="gerado do título" oninput="feed.edicao.slug=this.value"></div>
      ${e.publicado ? '<p class="small muted">Mudar o endereço mantém o antigo funcionando.</p>' : ''}<p class="small erro-campo" id="fe-e-slug" hidden></p></div>` : ''}
    <div class="fld"><label for="fe-autor">Autoria do texto (opcional)</label><input id="fe-autor" value="${esc(e.autor_texto)}" placeholder="Vazio: o seu nome" oninput="feed.edicao.autor_texto=this.value"></div>
    <div class="fld"><span class="small muted">Imagens (até 8; PNG, JPEG ou WebP de até 5 MB)</span>${imgs}<p class="small erro-campo" id="fe-e-imagens" hidden></p></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" type="button" id="fe-salvar" onclick="feedSalvar()">Salvar</button></div>`, 'largo');
  feedContador(); feedMinis();
}
function feedEditorTipo(t){ feed.edicao.tipo = t; feedEditorDesenha(); }
function feedContador(){
  const e = feed.edicao, n = (e.texto || '').length, el = $('#fe-cont'); if (!el) return;
  if (e.tipo === 'topico'){ el.textContent = `${n} de 1.200`; el.style.color = n > 1200 ? 'var(--warn-tx)' : ''; }
  else { el.textContent = `${n} caracteres (mínimo de 300 para publicar)`; el.style.color = ''; }
}
async function feedMinis(){
  for (const [n, i] of (feed.edicao?.imagens || []).entries()){
    try{ const { data } = await sb.storage.from('feed').createSignedUrl(i.path, 300); const el = document.getElementById('fe-mini-' + n); if (data?.signedUrl && el) el.src = data.signedUrl; }catch(_){}
  }
}
async function feedImagemNova(file){
  const e = feed.edicao; if (!file || !e?.id) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024){ toast('Use PNG, JPEG ou WebP de até 5 MB.', true); return; }
  if (e.imagens.length >= 8){ toast('Até 8 imagens por publicação.', true); return; }
  const ext = { 'image/png':'png', 'image/jpeg':'jpg', 'image/webp':'webp' }[file.type];
  const path = `${e.id}/${crypto.randomUUID()}.${ext}`;
  const bt = $('#fe-salvar'); e.enviando++; if (bt) bt.disabled = true;
  try{
    const { error } = await sb.storage.from('feed').upload(path, file, { contentType:file.type });
    if (error) throw error;
    e.imagens.push({ path, legenda:'' }); feedEditorDesenha();
  }catch(er){ falha(er, 'Não foi possível anexar a imagem'); }
  finally{ e.enviando--; const b = $('#fe-salvar'); if (b) b.disabled = e.enviando > 0; }
}
function feedImagemMover(n, d){ const l = feed.edicao.imagens; [l[n], l[n + d]] = [l[n + d], l[n]]; feedEditorDesenha(); }
function feedImagemTirar(n){ feed.edicao.imagens.splice(n, 1); feedEditorDesenha(); }

async function feedSalvar(){
  const e = feed.edicao, bt = $('#fe-salvar');
  document.querySelectorAll('.erro-campo').forEach(x => { x.hidden = true; x.textContent = ''; });
  bt.disabled = true;
  const p = { ...(e.id ? { id:e.id } : {}), tipo:e.tipo, titulo:e.titulo, subtitulo:e.subtitulo, texto:e.texto, autor_texto:e.autor_texto || '',
    imagens:e.imagens.map(i => ({ path:i.path, legenda:i.legenda || '' })), ...(e.tipo === 'noticia' ? { slug:e.slug || '' } : {}) };
  try{
    const d = await feedRPC('feed_item_salvar', { p });
    const campo = (c, t) => { const el = document.getElementById('fe-e-' + c); if (el){ el.hidden = false; el.textContent = t; } };
    if (d?.status === 'invalido'){ campo(d.campo, FEED_ERROS_CAMPO[d.campo] || 'Confira este campo.'); return; }
    if (d?.status === 'slug_em_uso'){ campo('slug', 'Este endereço já é de outra publicação.'); return; }
    if (d?.status === 'em_rascunho_no_reporte'){ toast('Esta contribuição ainda está num reporte que não foi enviado.', true); return; }
    if (d?.status === 'publicando'){ toast('Termine a publicação em andamento antes de editar.', true); return; }
    if (d?.status === 'nao_encontrado'){ toast('Esta publicação não existe mais.', true); fechaModal(); return feedMesa(); }
    if (d?.status !== 'ok'){ toast('Não foi possível salvar.', true); return; }
    if (!e.id){
      e.id = d.id; if (d.slug) e.slug = d.slug;
      toast('Salvo. Agora você pode anexar imagens.'); feedEditorDesenha(); feedMesaQuieta();
      return;
    }
    fechaModal(); toast(e.publicado ? 'Salvo. A mudança já está no ar.' : 'Publicação salva.'); feedMesa();
  }catch(er){ falha(er, 'Não foi possível salvar'); }
  finally{ const b = $('#fe-salvar'); if (b) b.disabled = e.enviando > 0; }
}
/* recarrega a lista por trás do modal, sem fechá-lo */
async function feedMesaQuieta(){
  try{ const d = await feedRPC('feed_editorial', { p_estado:feed.ed.filtro }); if (d?.status === 'ok'){ feed.ed.itens = d.itens || [];
    const el = $('#feed-mesa-tabela tbody'); if (el) el.innerHTML = feed.ed.itens.map(feedLinhaMesa).join(''); } }catch(_){}
}

/* ---------------- publicar ---------------- */
function feedPublicarAbrir(id, noSite, jaComecar){
  const f = feed.ed.itens.find(x => x.id === id); if (!f) return;
  const curta = f.tipo === 'noticia' && (f.texto || '').length < 300;
  abreModal(`<h3>Publicar</h3><p class="small muted" style="margin-bottom:10px">${esc(f.titulo)}</p>
    <fieldset style="border:0;padding:0;min-width:0"><legend class="small muted" style="margin-bottom:6px">Onde publicar</legend>
      <label style="display:block;margin-bottom:10px"><input type="radio" name="feed-onde" value="equipe" ${noSite ? '' : 'checked'}> <b>Só para a equipe</b><br>
        <span class="small muted">Aparece no portal e no boletim semanal da equipe.</span></label>
      <label style="display:block"><input type="radio" name="feed-onde" value="site" ${noSite ? 'checked' : ''}> <b>No site também</b><br>
        <span class="small muted">Aparece em neurodynamics.dev e no boletim mensal da comunidade. As imagens passam a ser públicas.</span></label></fieldset>
    ${curta ? '<div class="aviso-box warn" style="margin-top:12px">A notícia precisa de pelo menos 300 caracteres de texto.</div>' : ''}
    <div id="fp-prog" class="small" style="margin-top:12px" role="status"></div>
    <div id="fp-erro"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" type="button" id="fp-ok" ${curta ? 'disabled' : ''} onclick="feedPublicarExec('${f.id}')">Publicar</button></div>`);
  if (jaComecar) feedPublicarExec(id);
}
async function feedPublicarExec(id){
  const bt = $('#fp-ok'), prog = $('#fp-prog'), er = $('#fp-erro'); if (!bt) return;
  const noSite = (document.querySelector('input[name="feed-onde"]:checked')?.value || 'site') === 'site';
  bt.disabled = true; er.innerHTML = ''; prog.textContent = '';
  const falhou = m => { er.innerHTML = `<div class="aviso-box err" role="alert">A publicação não terminou: ${esc(m)}. Nada foi publicado pela metade; tente de novo.</div>`;
    bt.textContent = 'Tentar de novo'; bt.disabled = false; prog.textContent = ''; };
  try{
    const d = await feedRPC('feed_publicar', { p_id:id, p_publico:noSite });
    if (d?.status === 'noticia_incompleta'){ er.innerHTML = '<div class="aviso-box warn">A notícia precisa de pelo menos 300 caracteres de texto e de um endereço.</div>'; bt.disabled = false; return; }
    if (d?.status === 'em_rascunho_no_reporte'){ er.innerHTML = '<div class="aviso-box warn">Esta contribuição ainda está num reporte que não foi enviado.</div>'; bt.disabled = false; return; }
    if (d?.status !== 'ok') return falhou(d?.status || 'falhou');
    if (d.estado !== 'publicado'){
      const copiar = d.copiar || [];
      for (const [n, c] of copiar.entries()){
        prog.textContent = `Copiando imagens: ${n + 1} de ${copiar.length}…`;
        const { data:blob, error } = await sb.storage.from('feed').download(c.de);
        if (error || !blob) return falhou(error?.message || 'não foi possível ler a imagem');
        const up = await sb.storage.from('noticias').upload(c.para, blob, { contentType:blob.type || 'image/jpeg', upsert:true });
        if (up.error) return falhou(up.error.message);
      }
      const k = await feedRPC('feed_publicar_confirmar', { p_id:id });
      if (k?.status !== 'ok') return falhou(k?.status === 'imagens_pendentes' ? 'faltam imagens na cópia pública' : (k?.status || 'falhou'));
    }
    fechaModal(); toast(noSite ? 'Publicado no site.' : 'Publicado para a equipe.'); feedMesa();
  }catch(e){ falhou(e.message || 'erro'); }
}

/* ---------------- newsletter ---------------- */
async function pageNewsletter(){
  if (!(tenhoPapel('lideranca') || state.feedEditor)){ location.hash = '#/'; return; }
  $('#main').innerHTML = cabecalho({ espaco:'Serviços', titulo:'Newsletters' }) + '<div id="news-corpo">' + estado.carregando('lista') + '</div>';
  try{
    const [pend, lista] = await Promise.all([state.feedEditor ? feedRPC('newsletter_pendentes') : Promise.resolve(null), feedRPC('newsletter_lista')]);
    feed.pend = pend?.status === 'ok' ? pend : null; feed.news = Array.isArray(lista) ? lista : [];
    feedNewsDesenha();
  }catch(e){
    $('#news-corpo').innerHTML = estado.erro({ texto:'Não foi possível carregar as newsletters: ' + e.message + '.', acao:'<button class="btn ghost mini" onclick="pageNewsletter()">Tentar de novo</button>' });
  }
}
function feedNewsDesenha(){
  const p = feed.pend;
  const lst = (arr, vazio) => arr.length ? `<ul style="margin:8px 0 12px;padding-left:18px">${arr.map(i => `<li>${feedTag(i.tipo)} ${esc(i.titulo)}</li>`).join('')}</ul>` : `<p class="small muted">${vazio}</p>`;
  const prox = p ? `<div class="ini-duo" style="margin-bottom:18px">
    <section class="widget"><header><span class="w-rot">Equipe, semanal</span></header><div class="w-corpo">${lst(p.equipe, 'Nada novo desde a última edição.')}
      <button class="btn solid" type="button" id="news-enviar-semanal" ${p.equipe.length ? '' : 'disabled'} onclick="feedNewsEnviar('semanal')">Enviar agora</button></div></section>
    <section class="widget"><header><span class="w-rot">Comunidade, mensal</span></header><div class="w-corpo">${lst(p.comunidade, 'Nada novo desde a última edição.')}
      <p class="small muted">${Number(p.inscritos) || 0} inscritos confirmados</p>
      <button class="btn solid" type="button" id="news-enviar-mensal" ${p.comunidade.length ? '' : 'disabled'} onclick="feedNewsEnviar('mensal')">Enviar agora</button></div></section></div>
    <p class="small muted" style="margin-bottom:22px">Sem envio manual, a edição da equipe sai toda semana e a da comunidade todo mês, só com o que for novo. Se não houver publicação nova, não sai edição.</p>` : '';
  const sit = n => n.status === 'cancelada' ? 'Cancelada' : n.status === 'enviada' || (n.destinatarios && n.enviados >= n.destinatarios) ? 'Enviada' : 'Enviando';
  const linhas = feed.news.map(n => `<tr><td><b>${esc(n.assunto)}</b>${n.manual ? ' <span class="tag">Envio manual</span>' : ''}
      <details><summary class="small muted">${(n.itens || []).length} publicações</summary><ul style="margin:6px 0;padding-left:18px">${(n.itens || []).map(i => `<li>${esc(i.titulo)}</li>`).join('')}</ul></details></td>
    <td>${n.tipo === 'semanal' ? 'Equipe' : 'Comunidade'}</td>
    <td>${Number(n.enviados) || 0} de ${Number(n.destinatarios) || 0}${n.falhas ? ` <span style="color:var(--warn-tx)">, ${n.falhas} falhas</span>` : ''}</td>
    <td><span class="pill ${sit(n) === 'Enviada' ? 'p-ok' : ''}"><span class="dt ${sit(n) === 'Enviada' ? 'dt-ok' : ''}"></span>${sit(n)}</span></td><td class="mono">${fmtDT(n.criado_em)}</td></tr>`).join('');
  $('#news-corpo').innerHTML = prox + `<h3 style="margin-bottom:10px">Edições</h3>` + (feed.news.length
    ? `<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho" id="news-tabela"><thead><tr><th>Edição</th><th>Público</th><th>Envio</th><th>Situação</th><th>Criada</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`
    : estado.vazio({ texto:'Nenhuma edição ainda.' }))
    + (souAdmin() ? '<div class="acts"><button class="btn" type="button" onclick="feedComunidade()">Importar comunidade</button></div>' : '');
}
async function feedNewsEnviar(tipo){
  const itens = (tipo === 'semanal' ? feed.pend.equipe : feed.pend.comunidade).length;
  if (!await confirma(`Enviar agora para ${tipo === 'semanal' ? 'a equipe' : 'a comunidade'} as ${itens} publicações pendentes?`, 'Enviar edição')) return;
  try{
    const d = await feedRPC('newsletter_enviar_agora', { p_tipo:tipo });
    if (d?.status === 'vazio') toast('Nada novo para enviar.', true);
    else if (d?.status === 'ok') toast(`Edição criada: ${d.itens} publicações para ${d.destinatarios} pessoas.`);
    else throw new Error(d?.status || 'falhou');
    pageNewsletter();
  }catch(e){ falha(e, 'Não foi possível enviar a edição'); }
}

/* ---------------- a comunidade (importação) ---------------- */
function feedComunidade(){ if (!souAdmin()) return;
  abreModal(`<h3>Importar comunidade</h3><p class="small muted">Colunas: nome, email, origem. Descadastros anteriores são preservados.</p>
    <input aria-label="Planilha da comunidade" type="file" accept=".xlsx,.xls,.csv" onchange="feedComunidadeLer(this.files[0])"><div id="news-importar"></div>`); }
async function feedComunidadeLer(file){
  try{
    if (!file) return;
    if (!window.XLSX) await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array' });
    feed.importar = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval:'' });
    $('#news-importar').innerHTML = `<p>${feed.importar.length} registros.</p><button class="btn solid" onclick="feedComunidadeSalvar()">Importar</button>`;
  }catch(e){ falha(e, 'Não foi possível ler a planilha'); }
}
async function feedComunidadeSalvar(){
  try{ const d = await feedRPC('comunidade_importar', { p_itens:feed.importar }); fechaModal(); toast(`${d.processados} registros processados.`); }
  catch(e){ falha(e, 'Não foi possível importar a comunidade'); }
}
function feedComunidadePagina(){
  $('#sec-emails').innerHTML = `<div class="card"><h2>Comunidade</h2><p>Familiares, professores associados e parceiros que recebem o boletim mensal.</p>
    <div class="acts"><button class="btn solid" onclick="feedComunidade()">Importar planilha</button><a class="btn" href="#/servicos/newsletter">Newsletters</a></div>
    ${dica('A planilha deve ter nome e e-mail. A importação não reativa quem se descadastrou. A comunidade recebe o boletim mensal com o que foi publicado no site; quem se inscreve pelo site confirma por e-mail.')}</div>`;
}
