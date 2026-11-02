/* ============================================================
   Curadoria de fotos · NeuroDynamics (membro.neurodynamics.dev/curadoria/)
   Página da equipe, fora de qualquer menu: só se chega pelo link e
   só abre com a sessão do SOMA (a mesma do portal, por ser o mesmo
   endereço). Sem sessão, pede o login do SOMA aqui mesmo. Conta de
   membro Desligado, Egresso ou Sob demanda (conta_ativa falso),
   conta sem perfil e conta externa do LABBIO não entram.

   A fila vem de fila.js. As decisões ficam neste aparelho, separadas
   por conta (localStorage), e saem pelo botão "Copiar resultado", em
   JSON, para entrar na galeria do manual.

   Como cada foto carrega, na ordem:
   1. o endereço que a API do banco devolveu, se já houver um;
   2. o endereço público da foto (Unsplash: /photos/<id>/download,
      que redireciona para a imagem; Pexels: images.pexels.com);
   3. se falhar e houver chave salva em Ajustes, a API do banco.
   Sem nada disso, o cartão mostra o link para abrir a foto.
   ============================================================ */
(() => {
  'use strict';

  const D = window.CURADORIA;
  const TEMAS = D.temas;
  const FAMS = [['cortex', 'Cortex'], ['ion', 'Ion'], ['neuron', 'Neuron'], ['glia', 'Glia'], ['retina', 'Retina'],
    ['nexo', 'Nexo'], ['dendrito', 'Dendrito'], ['lumen', 'Lúmen'], ['ritmo', 'Ritmo'], ['impulso', 'Impulso'],
    ['plexo', 'Plexo'], ['iris', 'Íris']];
  const FAM_NOME = Object.fromEntries(FAMS);
  const ENQS = ['feed', 'story', 'banda', 'site'];
  const ENQ_NOME = { feed: 'Feed 4:5', story: 'Story 9:16', banda: 'Banda 1:1', site: 'Site 4:5' };
  const PROPORCAO = { feed: 4 / 5, story: 9 / 16, banda: 1, site: 4 / 5 };
  const BANCO = { u: 'Unsplash', p: 'Pexels', x: 'link direto' };
  const DECISAO = { sim: 'Aprovada', nao: 'Descartada', talvez: 'Talvez' };
  let GUARDA = 'nro-curadoria-v1';
  const CONFIG = {
    SUPABASE_URL: 'https://rxzmkyjttzzpwtodqkve.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg'
  };
  const sb = window.supabase ? window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY) : null;
  let EU = null;

  const $ = s => document.querySelector(s);
  const esc = v => v == null ? '' : String(v).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduzido = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- estado guardado ------------------------------ */
  const novo = () => ({ dec: {}, hist: [], extras: [], enq: 'feed', pal: 'cortex', off: [], res: 'sim',
    chaves: { u: '', p: '' }, cache: {} });
  let S = novo();
  function ler() {
    try {
      const j = JSON.parse(localStorage.getItem(GUARDA) || 'null');
      const s = Object.assign(novo(), j || {});
      if (!ENQS.includes(s.enq)) s.enq = 'feed';
      return s;
    } catch (e) { return novo(); }
  }
  function salvar() { try { localStorage.setItem(GUARDA, JSON.stringify(S)); } catch (e) { /* sem armazenamento: segue na memória */ } }

  /* ---------- a fila --------------------------------------- */
  const chave = f => f.f + ':' + f.id;
  let voltar = null;          // a foto desfeita volta para a frente
  const pulei = [];           // puladas nesta sessão vão para o fim

  function todas() {
    const vistas = new Set(), out = [];
    for (const f of [...S.extras, ...D.fotos]) {
      const k = chave(f);
      if (vistas.has(k)) continue;
      vistas.add(k); out.push(f);
    }
    return out;
  }
  function ordenada() {
    const lista = todas();
    const extras = lista.filter(f => f.o === 'link' || f.o === 'busca');
    const voce = lista.filter(f => f.o === 'voce');
    const porTema = {};
    lista.filter(f => !f.o).forEach(f => (porTema[f.tema] = porTema[f.tema] || []).push(f));
    const filas = Object.values(porTema), rr = [];
    for (let i = 0; filas.some(q => i < q.length); i++) filas.forEach(q => { if (q[i]) rr.push(q[i]); });
    return [...extras, ...voce, ...rr];
  }
  const ativas = () => ordenada().filter(f => !S.off.includes(f.tema));
  function fila() {
    const base = ativas().filter(f => !S.dec[chave(f)]);
    const q = [...base.filter(f => !pulei.includes(chave(f))), ...base.filter(f => pulei.includes(chave(f)))];
    if (voltar) {
      const i = q.findIndex(f => chave(f) === voltar);
      if (i > 0) q.unshift(q.splice(i, 1)[0]);
    }
    return q;
  }
  const tema = f => TEMAS[f.tema] || TEMAS.abstrato;
  const famDe = f => S.pal === 'auto' ? (tema(f).fam || 'cortex') : S.pal;

  /* ---------- endereços das fotos -------------------------- */
  function comLargura(url, w) {
    try {
      const u = new URL(url);
      if (/images\.(unsplash|pexels)\.com$/.test(u.hostname)) { u.searchParams.set('w', String(w)); return u.toString(); }
    } catch (e) { /* endereço sem formato de URL: usa como veio */ }
    return url;
  }
  function endereco(f, w = 1080) {
    const k = chave(f);
    if (S.cache[k]) return comLargura(S.cache[k], w);
    if (f.src) return f.src;
    if (f.f === 'u') return `https://unsplash.com/photos/${encodeURIComponent(f.id)}/download?w=${w}`;
    if (f.f === 'p') return `https://images.pexels.com/photos/${f.id}/pexels-photo-${f.id}.jpeg?auto=compress&cs=tinysrgb&w=${w}`;
    return '';
  }
  function pagina(f) {
    if (f.url) return f.url;
    if (f.f === 'u') return `https://unsplash.com/photos/${encodeURIComponent(f.id)}`;
    if (f.f === 'p') return `https://www.pexels.com/photo/${f.id}/`;
    return f.src || '';
  }

  async function resolver(f) {
    const k = chave(f);
    try {
      if (f.f === 'u' && S.chaves.u) {
        const r = await fetch(`https://api.unsplash.com/photos/${encodeURIComponent(f.id)}`,
          { headers: { Authorization: 'Client-ID ' + S.chaves.u, 'Accept-Version': 'v1' } });
        if (!r.ok) return false;
        const j = await r.json();
        S.cache[k] = j.urls.regular;
        if (!f.a && j.user) f.a = j.user.name;
        salvar(); return true;
      }
      if (f.f === 'p' && S.chaves.p) {
        const r = await fetch(`https://api.pexels.com/v1/photos/${encodeURIComponent(f.id)}`,
          { headers: { Authorization: S.chaves.p } });
        if (!r.ok) return false;
        const j = await r.json();
        S.cache[k] = j.src.large2x || j.src.large;
        if (!f.a) f.a = j.photographer;
        salvar(); return true;
      }
    } catch (e) { /* rede ou chave recusada */ }
    return false;
  }

  const imgs = {};   // chave -> { s: 'carregando' | 'ok' | 'falhou', url, p }
  function carregar(f) {
    const k = chave(f);
    if (imgs[k]) return imgs[k].p;
    const st = imgs[k] = { s: 'carregando', url: endereco(f) };
    st.p = new Promise(res => {
      const tentar = (url, ultima) => {
        const im = new Image();
        im.decoding = 'async';
        im.onload = () => { st.s = 'ok'; st.url = url; res(true); };
        im.onerror = async () => {
          if (!ultima && await resolver(f)) tentar(endereco(f), true);
          else { st.s = 'falhou'; res(false); }
        };
        im.src = url;
      };
      tentar(st.url, false);
    });
    return st.p;
  }

  /* ---------- as peças ------------------------------------- */
  function arte(f, enq, fam) {
    const T = tema(f);
    const st = imgs[chave(f)];
    const url = st && st.url ? st.url : endereco(f);
    const ok = st && st.s === 'ok' ? ' ok' : '';
    const foto = `<div class="moldura"><img class="foto${ok}" src="${esc(url)}" alt="${esc(f.t)}" draggable="false"></div>`;
    const logo = '<span class="logo" role="img" aria-label="NeuroDynamics"></span>';
    const eb = `<span class="eb"><i></i>${esc(T.nome)}</span>`;
    const pe = '<div class="a-pe"><span>LABBIO, UFMG</span><span>neurodynamics.dev</span></div>';
    const cls = `arte enq-${enq} f-${fam}`;

    if (enq === 'feed') return `<div class="${cls}">${foto}
      <div class="faixa"><div class="a-topo">${logo}${eb}</div><h2>${esc(T.titulo)}</h2>${pe}</div></div>`;
    if (enq === 'story') return `<div class="${cls}"><div class="fundo-grade"></div>
      <div class="st-topo">${logo}<span class="st-data">2026</span></div>${foto}
      <div class="st-texto">${eb}<h2>${esc(T.titulo)}</h2><p>${esc(T.sub)}</p></div>
      <span class="st-cta">Conheça o trabalho</span></div>`;
    if (enq === 'banda') return `<div class="${cls}">${foto}
      <div class="bd-faixa"><span class="bd-icone"></span><div class="bd-linha">${eb}${logo}</div><h2>${esc(T.titulo)}</h2></div></div>`;
    return `<div class="${cls}"><div class="fundo-grade"></div>
      <div class="si-topo">${logo}<span class="si-menu" aria-hidden="true"><i></i><i></i><i></i></span></div>
      <div class="si-cartao">${foto}<div class="si-corpo"><span class="si-tag"><i></i>${esc(T.nome)}</span>
      <h2>${esc(T.titulo)}</h2><p>${esc(T.sub)}</p><span class="si-link">Ver projeto</span></div></div></div>`;
  }

  /* ---------- palco ---------------------------------------- */
  const pilha = $('#pilha');
  function medida() {
    const r = pilha.getBoundingClientRect(), p = PROPORCAO[S.enq];
    let w = r.width, h = w / p;
    if (h > r.height) { h = r.height; w = h * p; }
    return { w: Math.floor(w), h: Math.floor(h) };
  }
  function cartao(f, atras) {
    const el = document.createElement('div');
    el.className = 'cartao' + (atras ? ' atras' : '');
    el.dataset.k = chave(f);
    const m = medida();
    el.style.width = m.w + 'px'; el.style.height = m.h + 'px';
    el.innerHTML = arte(f, S.enq, famDe(f)) +
      '<span class="carimbo sim">Aprovada</span><span class="carimbo nao">Descartada</span><span class="carimbo talvez">Talvez</span>';
    if (!atras) {
      el.tabIndex = 0;
      el.setAttribute('role', 'img');
      el.setAttribute('aria-label', `${f.t}, em ${ENQ_NOME[S.enq]}, paleta ${FAM_NOME[famDe(f)]}`);
    }
    const img = el.querySelector('.foto');
    img.addEventListener('load', () => img.classList.add('ok'));
    carregar(f).then(ok => {
      if (!el.isConnected) return;
      const st = imgs[chave(f)];
      if (ok) { if (img.getAttribute('src') !== st.url) img.src = st.url; img.classList.add('ok'); }
      else if (!atras) falha(el, f);
    });
    return el;
  }
  function falha(el, f) {
    const div = document.createElement('div');
    div.className = 'falhou';
    const temChave = f.f === 'u' ? S.chaves.u : f.f === 'p' ? S.chaves.p : 'x';
    div.innerHTML = `<h3>A prévia não carregou</h3>
      <p>${temChave ? 'Abra a foto na página do banco para avaliar, ou pule por agora.'
        : `Abra a foto no ${BANCO[f.f]} para avaliar. Com uma chave do ${BANCO[f.f]} em Ajustes, a página tenta de novo pela API.`}</p>
      <div class="linha"><a class="btn" href="${esc(pagina(f))}" target="_blank" rel="noopener">Abrir no ${esc(BANCO[f.f])}</a>
      <button class="btn" type="button" data-pular>Pular por agora</button></div>`;
    div.querySelector('[data-pular]').addEventListener('click', () => { pulei.push(chave(f)); render(); });
    el.appendChild(div);
  }

  function render() {
    const q = fila();
    pilha.innerHTML = '';
    const f = q[0];
    if (!f) { vazio(); } else {
      if (q[1]) pilha.appendChild(cartao(q[1], true));
      const el = cartao(f, false);
      pilha.appendChild(el);
      arrastar(el);
      q.slice(1, 3).forEach(carregar);
    }
    meta(f);
    contadores();
    controles(f);
  }
  function vazio() {
    const ha = ativas().length;
    pilha.innerHTML = `<div class="vazio">
      <span class="rotulo">Fila em dia</span>
      <h2>${ha ? 'Você avaliou todas as fotos dos temas ativos.' : 'Nenhum tema ativo na fila.'}</h2>
      <p>Copie o resultado para levar as aprovadas à galeria, ou ponha mais fotos na fila por link ou por busca.</p>
      <div class="linha"><button class="btn solid" type="button" data-ir="resultados">Ver resultados</button>
      <button class="btn" type="button" data-ir="fila">Adicionar fotos</button></div></div>`;
    pilha.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () => abrir('folha-' + b.dataset.ir)));
  }
  function meta(f) {
    const m = $('#meta');
    if (!f) { m.innerHTML = ''; return; }
    const T = tema(f);
    m.innerHTML = `<div class="meta-l1"><span class="chip mini">${esc(T.nome)}</span>
      ${f.o === 'voce' ? '<span class="chip mini voce">Sua seleção</span>' : ''}
      ${f.o === 'link' ? '<span class="chip mini">Adicionada por link</span>' : ''}
      ${f.q ? `<span class="meta-q">busca: ${esc(f.q)}</span>` : ''}</div>
      <p class="meta-t" title="${esc(f.t)}">${esc(f.t)}</p>
      <p class="meta-l2">${f.a ? `<span>${esc(f.a)}</span>` : ''}<a href="${esc(pagina(f))}" target="_blank" rel="noopener">Ver no ${esc(BANCO[f.f])}</a></p>`;
  }
  function contadores() {
    const lista = ativas();
    const feitas = lista.filter(f => S.dec[chave(f)]).length;
    $('#cont-feitas').textContent = feitas;
    $('#cont-total').textContent = lista.length;
    $('#barra-fill').style.width = (lista.length ? feitas / lista.length * 100 : 0) + '%';
    const sim = Object.values(S.dec).filter(d => d.d === 'sim').length;
    const b = $('#badge-sim');
    b.textContent = sim; b.hidden = !sim;
  }
  function controles(f) {
    document.querySelectorAll('#seg-enq button').forEach(b => {
      const on = b.dataset.enq === S.enq;
      b.classList.toggle('on', on); b.setAttribute('aria-checked', on);
    });
    const atual = f ? famDe(f) : null;
    const pal = $('#paletas');
    if (!pal.childElementCount) {
      pal.innerHTML = '<button type="button" role="radio" class="pal auto" data-pal="auto" title="A família do tema">Auto</button>' +
        FAMS.map(([id, nome]) => `<button type="button" role="radio" class="pal f-${id}" data-pal="${id}" aria-label="${nome}" title="${nome}"><span class="sw"></span></button>`).join('');
      pal.querySelectorAll('.pal').forEach(b => b.addEventListener('click', () => { S.pal = b.dataset.pal; salvar(); render(); }));
    }
    pal.querySelectorAll('.pal').forEach(b => b.setAttribute('aria-checked', b.dataset.pal === S.pal));
    const auto = pal.querySelector('.auto');
    auto.textContent = S.pal === 'auto' && atual ? 'Auto, ' + FAM_NOME[atual] : 'Auto';
    ['#btn-nao', '#btn-talvez', '#btn-sim'].forEach(s => { $(s).disabled = !f; });
    $('#btn-desfazer').disabled = !S.hist.length;
  }

  /* ---------- decidir -------------------------------------- */
  function decidir(d) {
    const f = fila()[0];
    if (!f) return;
    const k = chave(f);
    S.dec[k] = { d, enq: S.enq, pal: famDe(f), t: Date.now() };
    S.hist.push(k);
    if (S.hist.length > 300) S.hist.shift();
    voltar = null;
    salvar();
    const el = pilha.querySelector('.cartao:not(.atras)');
    if (!el || reduzido()) { render(); return; }
    const c = el.querySelector('.carimbo.' + d);
    if (c) c.style.opacity = 1;
    el.classList.remove('arrastando');
    el.classList.add('saindo');
    const w = window.innerWidth, h = window.innerHeight;
    const dx = d === 'sim' ? w * 1.1 : d === 'nao' ? -w * 1.1 : 0, dy = d === 'talvez' ? -h : 0;
    el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx / 24}deg)`;
    el.style.opacity = 0;
    const atras = pilha.querySelector('.cartao.atras');
    if (atras) { atras.style.transform = 'translate(-50%,-50%) scale(1)'; atras.style.opacity = 1; }
    setTimeout(render, 260);
  }
  function desfazer() {
    const k = S.hist.pop();
    if (!k) { aviso('Nada para desfazer.', 'info'); return; }
    delete S.dec[k];
    voltar = k;
    salvar(); render();
    aviso('A última foto voltou para a fila.', 'info');
  }

  function arrastar(el) {
    let x0 = 0, y0 = 0, dx = 0, dy = 0, ativo = false, moveu = false, id = null;
    const mover = () => {
      el.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${dx / 20}deg)`;
      const L = el.offsetWidth * .28;
      el.querySelector('.carimbo.sim').style.opacity = Math.max(0, Math.min(1, dx / L));
      el.querySelector('.carimbo.nao').style.opacity = Math.max(0, Math.min(1, -dx / L));
      el.querySelector('.carimbo.talvez').style.opacity = Math.abs(dy) > Math.abs(dx) ? Math.max(0, Math.min(1, -dy / L)) : 0;
    };
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || e.target.closest('a,button')) return;
      ativo = true; moveu = false; id = e.pointerId; x0 = e.clientX; y0 = e.clientY; dx = dy = 0;
      try { el.setPointerCapture(id); } catch (err) { /* ponteiro já solto */ }
      el.classList.add('arrastando');
    });
    el.addEventListener('pointermove', e => {
      if (!ativo || e.pointerId !== id) return;
      dx = e.clientX - x0; dy = e.clientY - y0;
      if (Math.abs(dx) + Math.abs(dy) > 8) moveu = true;
      if (moveu) mover();
    });
    const fim = e => {
      if (!ativo) return;
      ativo = false;
      el.classList.remove('arrastando');
      const L = el.offsetWidth * .28;
      if (dx > L) return decidir('sim');
      if (dx < -L) return decidir('nao');
      if (dy < -L && Math.abs(dy) > Math.abs(dx)) return decidir('talvez');
      dx = dy = 0; mover(); el.style.transform = '';
      if (!moveu && e.type === 'pointerup') trocarEnq(1);
    };
    el.addEventListener('pointerup', fim);
    el.addEventListener('pointercancel', fim);
  }

  function trocarEnq(passo) {
    const i = ENQS.indexOf(S.enq);
    S.enq = ENQS[(i + passo + ENQS.length) % ENQS.length];
    salvar(); render();
  }
  function trocarPal(passo) {
    const ids = ['auto', ...FAMS.map(x => x[0])];
    const i = ids.indexOf(S.pal);
    S.pal = ids[(i + passo + ids.length) % ids.length];
    salvar(); render();
  }

  /* ---------- folhas --------------------------------------- */
  const veu = $('#veu');
  let aberta = null, focoAntes = null;
  function abrir(id) {
    fechar();
    const el = document.getElementById(id);
    if (!el) return;
    focoAntes = document.activeElement;
    if (id === 'folha-resultados') renderResultados();
    if (id === 'folha-fila') renderFila();
    if (id === 'folha-ajustes') {
      $('#chave-u').value = S.chaves.u || ''; $('#chave-p').value = S.chaves.p || ''; recomecarPadrao();
      $('#conta-quem').textContent = EU ? `Conectado como ${EU.nome || EU.email}${EU.nome && EU.email ? ', ' + EU.email : ''}.` : '';
    }
    el.hidden = false; veu.classList.add('open'); aberta = el;
    const alvo = el.querySelector('[data-fechar]');
    if (alvo) alvo.focus();
  }
  function fechar() {
    if (!aberta) return;
    aberta.hidden = true; veu.classList.remove('open'); aberta = null;
    if (focoAntes && focoAntes.focus) focoAntes.focus();
  }
  veu.addEventListener('click', fechar);
  document.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
  $('#abrir-fila').addEventListener('click', () => abrir('folha-fila'));
  $('#abrir-resultados').addEventListener('click', () => abrir('folha-resultados'));
  $('#abrir-ajustes').addEventListener('click', () => abrir('folha-ajustes'));

  /* ---------- fila: temas, links e busca ------------------- */
  function opcoesTema(sel, atual) {
    sel.innerHTML = Object.entries(TEMAS).map(([id, t]) => `<option value="${id}"${id === atual ? ' selected' : ''}>${esc(t.nome)}</option>`).join('');
  }
  function renderFila() {
    const lista = ordenada();
    $('#temas').innerHTML = Object.entries(TEMAS).map(([id, t]) => {
      const n = lista.filter(f => f.tema === id).length;
      const pend = lista.filter(f => f.tema === id && !S.dec[chave(f)]).length;
      const on = !S.off.includes(id);
      return `<button type="button" class="chip${on ? ' on' : ''}" data-tema="${id}" aria-pressed="${on}">${esc(t.nome)} <b>${pend}/${n}</b></button>`;
    }).join('');
    $('#temas').querySelectorAll('[data-tema]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.tema;
      S.off = S.off.includes(id) ? S.off.filter(x => x !== id) : [...S.off, id];
      salvar(); renderFila(); render();
    }));
    const t = fila()[0];
    opcoesTema($('#links-tema'), $('#links-tema').value || (t ? t.tema : 'laboratorio'));
    opcoesTema($('#busca-tema'), $('#busca-tema').value || (t ? t.tema : 'laboratorio'));
    sugestoes();
    const temChave = S.chaves.u || S.chaves.p;
    $('#busca-nota').textContent = temChave
      ? 'Os resultados entram no começo da fila. Fotos que já estão na fila não se repetem.'
      : 'Para buscar daqui, salve uma chave do Unsplash ou do Pexels em Ajustes.';
  }
  function sugestoes() {
    const T = TEMAS[$('#busca-tema').value] || TEMAS.laboratorio;
    $('#busca-sugestoes').innerHTML = (T.termos || []).map(q => `<button type="button" class="chip" data-q="${esc(q)}">${esc(q)}</button>`).join('');
    $('#busca-sugestoes').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
      $('#busca-termo').value = b.dataset.q; $('#busca-termo').focus();
    }));
  }
  $('#busca-tema').addEventListener('change', sugestoes);

  const legivel = slug => {
    const s = slug.replace(/[-_]+/g, ' ').trim();
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : 'Foto adicionada por link';
  };
  function lerLinks(txt, temaId) {
    const partes = txt.split(/(?=https?:\/\/)|\s+/).map(s => s.trim()).filter(Boolean);
    const out = [];
    for (const p of partes) {
      let m = p.match(/unsplash\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:photos|fotografias|fotos|photographies|fotografien)\/([A-Za-z0-9_-]+)/i);
      if (m) {
        const slug = m[1];
        const id = slug.length > 11 && slug.charAt(slug.length - 12) === '-' ? slug.slice(-11) : slug;
        const resto = slug.length > 11 ? slug.slice(0, -12) : '';
        out.push({ f: 'u', id, t: legivel(resto), tema: temaId, o: 'link' });
        continue;
      }
      m = p.match(/pexels\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:photo|foto)\/(?:([^/?#\s]*?)-)?(\d+)/i);
      if (m) { out.push({ f: 'p', id: m[2], t: legivel(m[1] || ''), tema: temaId, o: 'link', url: p }); continue; }
      if (/^https:\/\/images\.(unsplash|pexels)\.com\//.test(p)) {
        let h = 0; for (const c of p) h = (h * 31 + c.charCodeAt(0)) | 0;
        out.push({ f: 'x', id: 'l' + (h >>> 0).toString(36), src: p, url: p, t: 'Imagem por link direto', tema: temaId, o: 'link' });
      }
    }
    return out;
  }
  function incluir(novas) {
    const ja = new Set(todas().map(chave));
    const entram = novas.filter(f => { const k = chave(f); if (ja.has(k)) return false; ja.add(k); return true; });
    S.extras = [...entram, ...S.extras];
    salvar();
    return entram.length;
  }
  $('#btn-links').addEventListener('click', () => {
    const novas = lerLinks($('#links').value, $('#links-tema').value);
    if (!novas.length) { aviso('Nenhum link do Unsplash ou do Pexels encontrado no texto.', 'aviso'); return; }
    const n = incluir(novas);
    $('#links').value = '';
    renderFila(); render();
    aviso(n ? `${n} ${n === 1 ? 'foto entrou' : 'fotos entraram'} no começo da fila.` : 'Essas fotos já estavam na fila.', n ? 'ok' : 'info');
  });

  $('#btn-buscar').addEventListener('click', async () => {
    const q = $('#busca-termo').value.trim();
    const banco = $('#busca-banco').value, temaId = $('#busca-tema').value;
    if (!q) { aviso('Escreva um termo de busca.', 'aviso'); return; }
    if (!S.chaves[banco]) { aviso(`Salve a chave do ${BANCO[banco]} em Ajustes para buscar.`, 'aviso'); return; }
    const btn = $('#btn-buscar');
    btn.disabled = true; btn.textContent = 'Buscando';
    try {
      let novas = [];
      if (banco === 'u') {
        const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24&content_filter=high`,
          { headers: { Authorization: 'Client-ID ' + S.chaves.u, 'Accept-Version': 'v1' } });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        novas = (j.results || []).map(p => { S.cache['u:' + p.id] = p.urls.regular;
          return { f: 'u', id: p.id, t: p.alt_description || p.description || q, tema: temaId, a: p.user && p.user.name, q, o: 'busca' }; });
      } else {
        const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(q)}&per_page=24`,
          { headers: { Authorization: S.chaves.p } });
        if (!r.ok) throw new Error(r.status);
        const j = await r.json();
        novas = (j.photos || []).map(p => { S.cache['p:' + p.id] = p.src.large2x || p.src.large;
          return { f: 'p', id: String(p.id), t: p.alt || q, tema: temaId, a: p.photographer, q, o: 'busca', url: p.url }; });
      }
      const n = incluir(novas);
      renderFila(); render();
      aviso(n ? `${n} fotos de "${q}" entraram na fila.` : `A busca por "${q}" não trouxe fotos novas.`, n ? 'ok' : 'info');
    } catch (e) {
      aviso(`O ${BANCO[banco]} recusou a busca. Confira a chave em Ajustes.`, 'erro');
    } finally {
      btn.disabled = false; btn.textContent = 'Buscar e pôr na fila';
    }
  });

  /* ---------- resultados ----------------------------------- */
  const ICONES = {
    sim: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    talvez: '<svg viewBox="0 0 24 24"><path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/></svg>',
    nao: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    fila: '<svg viewBox="0 0 24 24"><path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/></svg>'
  };
  function porDecisao(d) {
    const mapa = Object.fromEntries(todas().map(f => [chave(f), f]));
    return Object.keys(S.dec).filter(k => S.dec[k].d === d && mapa[k])
      .sort((a, b) => S.dec[b].t - S.dec[a].t).map(k => mapa[k]);
  }
  function renderResultados() {
    ['sim', 'talvez', 'nao'].forEach(d => { document.querySelector(`[data-n="${d}"]`).textContent = porDecisao(d).length; });
    document.querySelectorAll('#seg-res button').forEach(b => {
      const on = b.dataset.res === S.res;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', on);
    });
    const itens = porDecisao(S.res);
    const g = $('#grade');
    if (!itens.length) {
      g.innerHTML = `<p class="nota">Nenhuma foto ${S.res === 'sim' ? 'aprovada' : S.res === 'nao' ? 'descartada' : 'marcada como talvez'} ainda.</p>`;
    } else {
      g.innerHTML = itens.map(f => {
        const k = chave(f), dec = S.dec[k];
        const bt = (d, rot) => `<button type="button" data-k="${esc(k)}" data-d="${d}" aria-label="${rot}" title="${rot}" aria-pressed="${dec.d === d}">${ICONES[d]}</button>`;
        return `<figure class="miniatura">
          <a class="mini-foto" href="${esc(pagina(f))}" target="_blank" rel="noopener"><img loading="lazy" src="${esc(endereco(f, 480))}" alt="${esc(f.t)}"></a>
          <figcaption><span class="mini-tema">${esc(tema(f).nome)}</span><span class="mini-t">${esc(f.t)}</span>
          <span class="mini-enq">${esc(ENQ_NOME[dec.enq] || '')}, ${esc(FAM_NOME[dec.pal] || '')}</span></figcaption>
          <div class="mini-acoes">${bt('sim', 'Aprovar')}${bt('talvez', 'Talvez')}${bt('nao', 'Descartar')}${bt('fila', 'Voltar para a fila')}</div>
        </figure>`;
      }).join('');
      g.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => {
        const k = b.dataset.k, d = b.dataset.d;
        if (d === 'fila') { delete S.dec[k]; S.hist = S.hist.filter(x => x !== k); voltar = k; }
        else S.dec[k] = Object.assign({}, S.dec[k], { d, t: Date.now() });
        salvar(); renderResultados(); render();
      }));
    }
    $('#saida').value = JSON.stringify(resultado(), null, 2);
  }
  document.querySelectorAll('#seg-res button').forEach(b => b.addEventListener('click', () => {
    S.res = b.dataset.res; salvar(); renderResultados();
  }));

  function resultado() {
    const mapa = Object.fromEntries(todas().map(f => [chave(f), f]));
    const item = k => {
      const f = mapa[k], d = S.dec[k];
      return {
        banco: BANCO[f.f], id: f.id, pagina: pagina(f), descricao: f.t, tema: f.tema, autor: f.a || null,
        enquadramento: d.enq, paleta: d.pal, busca: f.q || null,
        origem: f.o === 'voce' ? 'equipe' : f.o === 'link' ? 'link' : f.o === 'busca' ? 'busca' : 'sugestao'
      };
    };
    const lista = d => Object.keys(S.dec).filter(k => S.dec[k].d === d && mapa[k]).sort((a, b) => S.dec[a].t - S.dec[b].t);
    return {
      campanha: D.campanha,
      exportado: new Date().toISOString(),
      avaliadas: Object.keys(S.dec).length,
      aprovadas: lista('sim').map(item),
      talvez: lista('talvez').map(item),
      descartadas: lista('nao').map(k => ({ banco: BANCO[mapa[k].f], id: mapa[k].id }))
    };
  }
  async function copiar(texto, msg) {
    const saida = $('#saida');
    saida.value = texto;
    try {
      await navigator.clipboard.writeText(texto);
      aviso(msg, 'ok');
    } catch (e) {
      saida.focus(); saida.select();
      aviso('Texto selecionado. Copie pelo menu do sistema.', 'info');
    }
  }
  $('#btn-copiar-json').addEventListener('click', () => copiar(JSON.stringify(resultado(), null, 2), 'Resultado copiado.'));
  $('#btn-copiar-links').addEventListener('click', () => {
    const links = resultado().aprovadas.map(a => a.pagina).join('\n');
    if (!links) { aviso('Ainda não há fotos aprovadas.', 'info'); return; }
    copiar(links, 'Links das aprovadas copiados.');
  });

  /* ---------- ajustes -------------------------------------- */
  $('#btn-chaves').addEventListener('click', () => {
    S.chaves = { u: $('#chave-u').value.trim(), p: $('#chave-p').value.trim() };
    Object.keys(imgs).forEach(k => { if (imgs[k].s === 'falhou') delete imgs[k]; });
    salvar(); render();
    aviso('Chaves salvas neste aparelho.', 'ok');
  });
  function recomecarPadrao() {
    $('#recomecar-acoes').innerHTML = '<button class="btn" id="btn-recomecar" type="button">Recomeçar a campanha</button>';
    $('#btn-recomecar').addEventListener('click', () => {
      $('#recomecar-acoes').innerHTML = '<button class="btn perigo" id="btn-apagar" type="button">Apagar decisões e fotos adicionadas</button>' +
        '<button class="btn" id="btn-cancelar" type="button">Cancelar</button>';
      $('#btn-cancelar').addEventListener('click', recomecarPadrao);
      $('#btn-apagar').addEventListener('click', () => {
        const chaves = S.chaves;
        S = novo(); S.chaves = chaves; voltar = null; pulei.length = 0;
        salvar(); fechar(); render();
        aviso('A campanha recomeçou.', 'info');
      });
    });
  }

  /* ---------- avisos --------------------------------------- */
  function aviso(msg, tipo) {
    const el = document.createElement('div');
    el.className = 'toast ' + (tipo || 'ok');
    el.innerHTML = '<span class="dt"></span>' + esc(msg);
    $('#toast').appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }

  /* ---------- ligações ------------------------------------- */
  $('#btn-sim').addEventListener('click', () => decidir('sim'));
  $('#btn-nao').addEventListener('click', () => decidir('nao'));
  $('#btn-talvez').addEventListener('click', () => decidir('talvez'));
  $('#btn-desfazer').addEventListener('click', desfazer);
  document.querySelectorAll('#seg-enq button').forEach(b => b.addEventListener('click', () => { S.enq = b.dataset.enq; salvar(); render(); }));

  document.addEventListener('keydown', e => {
    if ($('#app').hidden) return;
    if (e.key === 'Escape' && aberta) { fechar(); return; }
    if (aberta || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest('input,textarea,select')) return;
    const k = e.key.toLowerCase();
    if (k === 'arrowright') { e.preventDefault(); decidir('sim'); }
    else if (k === 'arrowleft') { e.preventDefault(); decidir('nao'); }
    else if (k === 'arrowup') { e.preventDefault(); decidir('talvez'); }
    else if (k === 'z' || k === 'backspace') { e.preventDefault(); desfazer(); }
    else if (k === 'e') trocarEnq(1);
    else if (k === 'p') trocarPal(1);
  });

  let tempo = null;
  new ResizeObserver(() => { clearTimeout(tempo); tempo = setTimeout(() => {
    const m = medida();
    pilha.querySelectorAll('.cartao').forEach(c => { c.style.width = m.w + 'px'; c.style.height = m.h + 'px'; });
  }, 60); }).observe(pilha);

  /* ---------- a entrada ------------------------------------ */
  const corpo = $('#entrada-corpo');
  function mostrarEntrada(html) {
    $('#app').hidden = true; $('#entrada').hidden = false;
    corpo.innerHTML = html;
  }
  function telaLogin(msg) {
    mostrarEntrada(`<h1>Entre com a sua conta do SOMA</h1>
      <p class="nota">Esta página é só da equipe NeuroDynamics.</p>
      <form id="f-entrar" novalidate>
        <label class="campo" for="l-email">E-mail</label>
        <input id="l-email" type="email" autocomplete="username" required>
        <label class="campo" for="l-senha">Senha</label>
        <input id="l-senha" type="password" autocomplete="current-password" required>
        <button class="btn solid" type="submit" id="l-btn">Entrar</button>
        <p class="entrada-msg" id="l-msg" role="status">${esc(msg || '')}</p>
      </form>
      <div class="linha botoes"><button class="link" type="button" id="l-esqueci">Esqueci minha senha</button></div>`);
    $('#f-entrar').addEventListener('submit', entrar);
    $('#l-esqueci').addEventListener('click', esqueci);
    $('#l-email').focus();
  }
  async function entrar(ev) {
    ev.preventDefault();
    const bt = $('#l-btn'), m = $('#l-msg');
    bt.disabled = true; m.textContent = ''; m.classList.remove('ruim');
    try {
      const { error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-senha').value });
      if (error) {
        m.classList.add('ruim');
        m.textContent = error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '')
          ? 'Falta confirmar o e-mail da sua conta.' : 'E-mail ou senha incorretos.';
        return;
      }
      await portao();
    } catch (e) {
      m.classList.add('ruim'); m.textContent = 'Não foi possível entrar agora. Tente de novo.';
    } finally { if (document.body.contains(bt)) bt.disabled = false; }
  }
  async function esqueci() {
    const email = $('#l-email').value.trim(), m = $('#l-msg');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { m.classList.add('ruim'); m.textContent = 'Escreva o seu e-mail acima e toque de novo.'; return; }
    /* a nova senha se cria no portal, que tem a tela para isso */
    try { await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }); } catch (e) { /* responde igual */ }
    m.classList.remove('ruim');
    m.textContent = 'Se houver uma conta com este e-mail, o link para criar a senha nova chega em instantes.';
  }
  function telaSemAcesso(email) {
    mostrarEntrada(`<h1>Esta conta não tem acesso</h1>
      <p class="nota">A curadoria é só para membros ativos da NeuroDynamics${email ? `. Você entrou como ${esc(email)}` : ''}.
      Sair encerra também a sessão do SOMA neste aparelho.</p>
      <div class="linha botoes"><button class="btn" type="button" id="l-sair">Sair e entrar com outra conta</button></div>`);
    $('#l-sair').addEventListener('click', sair);
  }
  async function sair() {
    try { await sb.auth.signOut(); } catch (e) { /* a tela volta ao login do mesmo jeito */ }
    EU = null;
    telaLogin();
  }
  $('#btn-sair').addEventListener('click', () => { fechar(); sair(); });

  async function portao() {
    if (!sb) { mostrarEntrada('<p class="nota">Não foi possível carregar o login. Recarregue a página.</p>'); return; }
    let s = null;
    try { s = (await sb.auth.getSession())?.data?.session || null; } catch (e) { s = null; }
    if (!s) { telaLogin(); return; }
    const uid = s.user && s.user.id;
    const nada = () => ({});
    const [ativa, perfil, labbio] = await Promise.all([
      Promise.resolve(sb.rpc('conta_ativa')).then(r => r || {}, nada),
      Promise.resolve(sb.from('perfis').select('id,nome,email').eq('id', uid).maybeSingle()).then(r => r || {}, nada),
      Promise.resolve(sb.rpc('labbio_eu')).then(r => r || {}, nada)
    ]);
    const externa = ['ok', 'convidado', 'revogado'].includes(labbio.data && labbio.data.status);
    if (ativa.data === false || !perfil.data || externa) { telaSemAcesso(s.user && s.user.email); return; }
    EU = { id: uid, nome: perfil.data.nome || '', email: perfil.data.email || (s.user && s.user.email) || '' };
    GUARDA = 'nro-curadoria-v1:' + uid;
    S = ler();
    $('#entrada').hidden = true; $('#app').hidden = false;
    render();
  }
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && EU) { EU = null; telaLogin(); } });

  portao();
})();
