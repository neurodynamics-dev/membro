/* ============================================================
   NeuroQuiz · membro.neurodynamics.dev/quiz/
   Fora de qualquer menu; só com a conta do SOMA (a mesma sessão do
   portal, por ser o mesmo endereço). Três telas, pelo endereço:
     /quiz/            o celular: digita o PIN
     /quiz/#123456     o celular, já na partida (é o que o QR abre)
     /quiz/#tv/<id>    a TV, de quem conduz (gestão)
     /quiz/#editor     as perguntas e as partidas (gestão)
   O banco é quem manda: o tempo, as respostas e os pontos saem das
   funções quiz_* (db/2.29.0_neuroquiz.sql). O relógio das telas é o
   do banco, pela diferença medida em cada chamada; o Realtime avisa
   cada passo e, sem ele, as telas consultam sozinhas.
   ============================================================ */
(() => {
  'use strict';

  const PROD = { url: 'https://rxzmkyjttzzpwtodqkve.supabase.co', key: 'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg' };
  // só em localhost a página aceita outro banco (o ambiente de teste); no ar, nunca
  const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && window.NQ_LOCAL && window.NQ_LOCAL.url ? window.NQ_LOCAL : null;
  const CFG = LOCAL || PROD;
  const sb = window.supabase ? window.supabase.createClient(CFG.url, CFG.key) : null;
  const FOTOS_BASE = 'https://raw.githubusercontent.com/neurodynamics-dev/nro-pessoal/refs/heads/main/fotos/';
  const FOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
  const ENDERECO = 'membro.neurodynamics.dev/quiz';
  const LETRA = 'ABCD';
  const FORMA = [
    '<svg class="forma" viewBox="0 0 100 100" aria-hidden="true"><rect x="13" y="13" width="74" height="74" rx="7"/></svg>',
    '<svg class="forma" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 8 L94 88 H6 Z"/></svg>',
    '<svg class="forma" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42"/></svg>',
    '<svg class="forma" viewBox="0 0 100 100" aria-hidden="true"><path d="M36 7h28v29h29v28H64v29H36V64H7V36h29z"/></svg>'];
  const NOME_FORMA = ['quadrado', 'triângulo', 'círculo', 'cruz'];
  const CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const XIS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const TIPO = { classica: 'Clássica', quem: 'Quem é quem', whatsapp: 'Mensagem' };

  const $ = s => document.querySelector(s);
  const app = $('#app');
  const esc = v => v == null ? '' : String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const vibrar = p => { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { /* sem vibração */ } };
  let EU = null;

  /* ---------- o relógio do banco ----------------------------
     offset = hora do banco − hora daqui, medida no meio da ida e
     volta de cada chamada. Fica a amostra de menor ida e volta (a
     mais precisa); as outras corrigem devagar a deriva. */
  const rel = { off: 0, rtt: Infinity, n: 0 };
  function amostra(t0, t1, iso) {
    const srv = Date.parse(iso); if (!isFinite(srv)) return;
    const rtt = t1 - t0, off = srv - (t0 + t1) / 2;
    if (!rel.n || rtt < rel.rtt) { rel.off = off; rel.rtt = rtt; }
    else if (rtt < rel.rtt * 1.5 + 40) rel.off = rel.off * 0.8 + off * 0.2;
    rel.n++;
  }
  const agora = () => Date.now() + rel.off;
  async function sincronizar() { for (let i = 0; i < 4; i++) { try { await rpc('quiz_relogio', {}, { tentativas: 1 }); } catch (e) { /* tenta na próxima */ } } }

  /* ---------- chamar o banco, com Wi-Fi ruim ---------------- */
  const redeCaiu = e => !e || !e.code || /fetch|network|load failed|timeout|abort/i.test(String(e.message || e));
  async function rpc(fn, args = {}, { tentativas = 3 } = {}) {
    for (let i = 0; ; i++) {
      const t0 = Date.now();
      let res;
      try { res = await sb.rpc(fn, args); } catch (e) { res = { error: e }; }
      const t1 = Date.now();
      if (!res.error) { if (res.data && res.data.agora) amostra(t0, t1, res.data.agora); return res.data; }
      if (i < tentativas - 1 && redeCaiu(res.error)) { await espera(350 * Math.pow(2, i)); continue; }
      throw res.error;
    }
  }

  /* ---------- o Realtime (e o plano B) ---------------------- */
  function ouvir(topicos, aoSinal) {
    const st = { conectados: 0, chans: [] };
    st.ok = () => st.conectados === topicos.length;
    st.fechar = () => st.chans.forEach(c => { try { sb.removeChannel(c); } catch (e) { /* já fechado */ } });
    if (!sb || !sb.channel) return st;
    for (const t of topicos) {
      let ok = false;
      const ch = sb.channel(t);
      ['fase', 'respostas', 'jogadores'].forEach(ev => ch.on('broadcast', { event: ev }, m => aoSinal(ev, m.payload || {})));
      ch.subscribe(s => {
        const agoraOk = s === 'SUBSCRIBED';
        if (agoraOk !== ok) { st.conectados += agoraOk ? 1 : -1; ok = agoraOk; }
        if (agoraOk) aoSinal('conectou', {});
      });
      st.chans.push(ch);
    }
    return st;
  }

  /* ---------- a troca de tela -------------------------------- */
  let limpezas = [];
  function sair() {
    limpezas.splice(0).forEach(f => { try { f(); } catch (e) { /* segue */ } });
    if (window.NQSom) NQSom.parar();
    fechaDlg();
    document.body.classList.remove('na-tv');
  }
  const aoSair = f => limpezas.push(f);
  function intervalo(f, ms) { const id = setInterval(f, ms); aoSair(() => clearInterval(id)); return id; }
  function escuta(alvo, ev, f) { alvo.addEventListener(ev, f); aoSair(() => alvo.removeEventListener(ev, f)); }

  /* ---------- pedaços ---------------------------------------- */
  const iniciais = n => String(n || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  window.nqFotoErro = img => {
    const i = Number(img.dataset.ext || 0) + 1, reg = img.dataset.reg;
    if (reg && i < FOTO_EXTS.length) { img.dataset.ext = i; img.src = FOTOS_BASE + reg + '.' + FOTO_EXTS[i]; } else img.remove();
  };
  function av(m, extra = '') {
    if (!m) return `<span class="av ${extra}">?</span>`;
    const u = m.foto_url || (m.registro != null && !LOCAL ? FOTOS_BASE + m.registro + '.jpg' : null);
    const cascata = !m.foto_url && m.registro != null ? ` data-reg="${m.registro}" data-ext="0"` : '';
    return `<span class="av ${extra}">${esc(iniciais(m.curto || m.nome))}${u ? `<img src="${esc(u)}" alt=""${cascata} onerror="nqFotoErro(this)">` : ''}</span>`;
  }
  const pin3 = p => String(p || '').replace(/^(\d{3})(\d{3})$/, '$1 $2');
  const tamTexto = t => (t || '').length > 110 ? 'muito' : (t || '').length > 70 ? 'longo' : '';
  function toast(msg, tipo = 'ok') {
    const box = $('#toast'); if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast ' + tipo; el.innerHTML = `<span class="dt"></span><span>${esc(msg)}</span>`;
    box.appendChild(el); setTimeout(() => el.remove(), 4200);
  }
  function abreDlg(html, cls = '') {
    fechaDlg();
    const veu = document.createElement('div'); veu.className = 'veu open'; veu.id = 'nq-veu';
    const dlg = document.createElement('div'); dlg.className = 'dlg open nq-dlg ' + cls; dlg.id = 'nq-dlg';
    dlg.setAttribute('role', 'dialog'); dlg.setAttribute('aria-modal', 'true'); dlg.innerHTML = html;
    veu.addEventListener('click', fechaDlg);
    document.body.append(veu, dlg);
    return dlg;
  }
  function fechaDlg() { $('#nq-veu')?.remove(); $('#nq-dlg')?.remove(); }

  /* ============================================================
     A ENTRADA: a conta do SOMA
     ============================================================ */
  function centro(html) { sair(); app.innerHTML = `<main class="nq-centro">${html}</main>`; }
  const MARCA = '<div class="nq-marca">Neuro<b>Quiz</b></div>';
  function telaLogin(msg) {
    centro(`${MARCA}<h1>Entre com a sua conta do SOMA</h1>
      <p class="nota">O NeuroQuiz é só da equipe. Você joga com o seu nome e a sua foto do SOMA.</p>
      <form class="nq-form" id="f-entrar" novalidate>
        <div class="fld"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username" required></div>
        <div class="fld"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password" required></div>
        <button class="btn solid" type="submit" id="l-btn">Entrar</button>
        <p class="nq-msg" id="l-msg" role="status">${esc(msg || '')}</p>
      </form>
      <button class="nq-link" type="button" id="l-esqueci">Esqueci minha senha</button>`);
    $('#f-entrar').addEventListener('submit', async ev => {
      ev.preventDefault();
      const bt = $('#l-btn'), m = $('#l-msg'); bt.disabled = true; m.textContent = ''; m.classList.remove('ruim');
      try {
        const { error } = await sb.auth.signInWithPassword({ email: $('#l-email').value.trim(), password: $('#l-senha').value });
        if (error) { m.classList.add('ruim'); m.textContent = /not confirmed/i.test(error.message || '') ? 'Falta confirmar o e-mail da sua conta.' : 'E-mail ou senha incorretos.'; return; }
        await portao();
      } catch (e) { m.classList.add('ruim'); m.textContent = 'Não foi possível entrar agora. Tente de novo.'; }
      finally { if (document.body.contains(bt)) bt.disabled = false; }
    });
    $('#l-esqueci').addEventListener('click', async () => {
      const email = $('#l-email').value.trim(), m = $('#l-msg');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { m.classList.add('ruim'); m.textContent = 'Escreva o seu e-mail acima e toque de novo.'; return; }
      try { await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/' }); } catch (e) { /* responde igual */ }
      m.classList.remove('ruim'); m.textContent = 'Se houver uma conta com este e-mail, o link para criar a senha nova chega em instantes.';
    });
    $('#l-email').focus();
  }
  function telaSemAcesso(email) {
    centro(`${MARCA}<h1>Esta conta não joga</h1>
      <p class="nota">O NeuroQuiz é para membros ativos da NeuroDynamics${email ? `. Você entrou como ${esc(email)}` : ''}.</p>
      <button class="btn ghost" id="l-sair">Sair e entrar com outra conta</button>`);
    $('#l-sair').addEventListener('click', sairDaConta);
  }
  function semPermissao() {
    centro(`${MARCA}<h1>Esta tela é de quem conduz o quiz</h1>
      <p class="nota">O editor e a TV são da gestão do SOMA (administração, Depto. de Pessoal e liderança).</p>
      <a class="btn ghost" href="#">Jogar com um PIN</a>`);
  }
  async function sairDaConta() { try { await sb.auth.signOut(); } catch (e) { /* volta ao login igual */ } EU = null; telaLogin(); }
  function mensagem(titulo, texto, botao, acao) {
    centro(`${MARCA}<h1>${esc(titulo)}</h1><p class="nota">${esc(texto)}</p>${botao ? `<button class="btn ghost" id="m-bt">${esc(botao)}</button>` : ''}`);
    if (botao) $('#m-bt').addEventListener('click', acao);
  }

  async function portao() {
    if (!sb) return mensagem('Não carregou', 'Recarregue a página.');
    let s = null;
    try { s = (await sb.auth.getSession()).data.session; } catch (e) { s = null; }
    if (!s) return telaLogin();
    let jogar, gerir;
    try { [jogar, gerir] = await Promise.all([rpc('quiz_pode_jogar', {}, { tentativas: 4 }), rpc('quiz_pode_gerir', {}, { tentativas: 4 })]); }
    catch (e) { return mensagem('Sem conexão', 'Não consegui falar com o SOMA. Confira a internet.', 'Tentar de novo', portao); }
    if (!jogar) return telaSemAcesso(s.user && s.user.email);
    EU = { uid: s.user.id, email: s.user.email, gestao: !!gerir };
    sincronizar();
    rota();
  }
  function rota() {
    if (!EU) return;
    const h = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
    if (h === 'editor' || h.startsWith('editor/')) return EU.gestao ? editor(h.split('/')[1]) : semPermissao();
    if (h.startsWith('tv/')) return EU.gestao ? tv(h.slice(3)) : semPermissao();
    const pin = h.replace(/\D/g, '');
    if (pin.length === 6) return jogador(pin);
    telaPin();
  }
  window.addEventListener('hashchange', rota);
  if (sb) sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && EU) { EU = null; telaLogin(); } });

  /* ============================================================
     O CELULAR
     ============================================================ */
  function telaPin(msg, valor) {
    centro(`${MARCA}<h1>Digite o PIN que está na TV</h1>
      <form class="nq-form" id="f-pin" novalidate>
        <div class="fld"><label for="pin">PIN do jogo</label>
          <input id="pin" class="nq-pin" inputmode="numeric" pattern="[0-9]*" maxlength="7" autocomplete="off" value="${esc(valor || '')}" placeholder="000 000"></div>
        <button class="btn solid" type="submit">Entrar no jogo</button>
        <p class="nq-msg ${msg ? 'ruim' : ''}" role="status">${esc(msg || '')}</p>
      </form>
      ${EU && EU.gestao ? '<a class="nq-link" href="#editor">Editor de perguntas e partidas</a>' : ''}`);
    const inp = $('#pin');
    inp.addEventListener('input', () => { const d = inp.value.replace(/\D/g, '').slice(0, 6); inp.value = d.length > 3 ? d.slice(0, 3) + ' ' + d.slice(3) : d; });
    $('#f-pin').addEventListener('submit', ev => {
      ev.preventDefault();
      const d = inp.value.replace(/\D/g, '');
      if (d.length !== 6) { $('.nq-msg').classList.add('ruim'); $('.nq-msg').textContent = 'O PIN tem seis números.'; return; }
      if (location.hash === '#' + d) rota(); else location.hash = d;
    });
    inp.focus();
  }

  let J = null;
  async function jogador(pin) {
    sair();
    J = { pin, st: null, enviando: null, buscando: false, ultimo: 0, chave: '', ultBusca: 0 };
    app.innerHTML = `<div class="cel"><div class="cel-corpo"><span class="spin"></span><p>Entrando no jogo…</p></div></div>`;
    let r;
    try { r = await rpc('quiz_entrar', { p_pin: pin }, { tentativas: 5 }); }
    catch (e) { return telaPin('Sem conexão. Confira a internet e tente de novo.', pin3(pin)); }
    if (!r || r.status === 'pin_invalido') return telaPin('Não achei uma partida com esse PIN.', pin3(pin));
    if (r.status !== 'ok') return telaSemAcesso(EU && EU.email);
    aplicaJ(r);
    J.canal = ouvir(['neuroquiz:' + r.sessao.id], sinalJ);
    aoSair(() => J.canal.fechar());
    intervalo(() => { if (!J.canal.ok() || Date.now() - J.ultimo > 15000) atualizaJ(); }, 3000);
    intervalo(tickJ, 100);
    const volta = () => { if (document.visibilityState === 'visible') atualizaJ(); };
    escuta(document, 'visibilitychange', volta);
    escuta(window, 'online', volta);
  }
  function aplicaJ(r) {
    if (!r || r.status !== 'ok') return;
    if (J.st && r.sessao.seq < J.st.sessao.seq) return;      // chegou depois de um aviso mais novo
    J.st = r; J.ultimo = Date.now();
    if (r.minha && J.enviando && J.enviando.rodada === r.sessao.rodada) J.enviando = null;
    desenhaJ();
  }
  async function atualizaJ() {
    if (!J || J.buscando) return;
    J.buscando = true; J.ultBusca = Date.now();
    try {
      let r = await rpc('quiz_estado', { p_sessao: J.st.sessao.id }, { tentativas: 2 });
      if (r && r.status === 'fora') r = await rpc('quiz_entrar', { p_pin: J.pin }, { tentativas: 2 });
      aplicaJ(r);
    } catch (e) { /* a próxima volta tenta de novo */ }
    finally { J.buscando = false; }
  }
  function sinalJ(ev, p) {
    if (!J || !J.st) return;
    if (ev === 'conectou') return atualizaJ();
    if (ev !== 'fase' || p.seq <= J.st.sessao.seq) return;
    const s = J.st.sessao, outra = p.rodada !== s.rodada;
    Object.assign(s, { seq: p.seq, fase: p.fase, rodada: p.rodada, total: p.total, iniciada_em: p.iniciada_em, prazo: p.prazo });
    if (p.fase === 'pergunta' && outra) { J.st.pergunta = { ordem: p.rodada, n_alt: p.n_alt }; J.st.minha = null; J.st.corretas = null; J.enviando = null; }
    if (p.fase === 'revelacao') J.st.corretas = p.corretas;
    desenhaJ();
    setTimeout(atualizaJ, Math.random() * 700);    // os 40 celulares não chegam juntos
  }
  // o que o celular mostra agora
  function subJ() {
    const s = J.st.sessao;
    if (s.fase !== 'pergunta') return s.fase;
    if (J.st.minha || (J.enviando && J.enviando.rodada === s.rodada)) return 'enviada';
    const t = agora();
    if (t < Date.parse(s.iniciada_em)) return 'prep';
    if (t > Date.parse(s.prazo) + 500) return 'tempo';
    return 'botoes';
  }
  function topoJ() {
    const s = J.st.sessao;
    return `<header class="cel-topo"><span>${s.rodada && s.fase !== 'lobby' && s.fase !== 'fim' ? `Pergunta <b>${s.rodada}</b> de ${s.total}` : esc(s.titulo)}</span><span>PIN <b>${pin3(s.pin)}</b></span></header>`;
  }
  function peJ() {
    const e = J.st.eu;
    return `<footer class="cel-pe"><span class="cel-eu">${av(e, '')}<span>${esc(e.curto)}</span></span><span class="cel-pts">${e.pontos}</span></footer>`;
  }
  function desenhaJ() {
    if (!J || !J.st) return;
    const s = J.st.sessao, sub = subJ();
    const chave = [s.seq, sub, J.enviando && J.enviando.estado, J.st.minha && J.st.minha.pontos, J.st.eu.posicao].join('|');
    if (chave === J.chave) return;
    J.chave = chave;
    let corpo;
    const eu = J.st.eu;
    if (sub === 'lobby') corpo = `<div class="cel-corpo">${av(eu, 'grande')}<h2>Você está dentro!</h2><p>Procure o seu nome na TV. O jogo começa já já.</p></div>`;
    else if (sub === 'prep') corpo = `<div class="cel-corpo"><p>Pergunta ${s.rodada}</p><div class="cel-grande" id="cd">…</div><h2>Prepare-se!</h2>
      <div class="cel-barra" style="max-width:280px"><i id="cb"></i></div></div>`;
    else if (sub === 'botoes') {
      const p = J.st.pergunta || {}, n = p.n_alt || 4, comTexto = s.texto_no_celular && p.alternativas;
      corpo = `${comTexto && p.texto ? `<div class="cel-corpo" style="flex:none;padding-bottom:0"><p style="color:var(--ink);font-weight:600">${esc(p.texto)}</p></div>` : ''}
        <div class="cel-barra" style="width:auto;margin:0 10px"><i id="cb"></i></div>
        <div class="cel-botoes ${n === 2 ? 'n2' : ''} ${comTexto ? 'com-texto' : ''}">${Array.from({ length: n }, (_, l) => {
          const a = comTexto ? p.alternativas[l] : null;
          const txt = a ? (a.membro ? (a.texto || a.membro.curto) : a.texto) : '';
          return `<button class="cel-bt op${l}" data-l="${l}" aria-label="${LETRA[l]}, ${NOME_FORMA[l]}${txt ? ': ' + esc(txt) : ''}"><span class="letra">${LETRA[l]}</span>${FORMA[l]}${txt ? `<span class="txt">${esc(txt)}</span>` : ''}</button>`;
        }).join('')}</div>`;
    } else if (sub === 'enviada') {
      const l = J.st.minha ? J.st.minha.letra : J.enviando.letra, falhou = J.enviando && J.enviando.estado === 'falhou';
      corpo = `<div class="cel-corpo"><div class="cel-escolha op${l}">${FORMA[l]}</div>
        <h2>${falhou ? 'Não foi enviada' : J.st.minha ? 'Resposta enviada' : 'Enviando…'}</h2>
        <p>${falhou ? 'A internet falhou. Toque para mandar de novo.' : J.st.minha ? 'Agora é com a TV.' : 'Segure aí um instante.'}</p>
        ${falhou ? `<button class="btn solid" id="reenviar">Mandar de novo</button>` : ''}</div>`;
    } else if (sub === 'tempo') corpo = `<div class="cel-corpo"><div class="cel-grande">0</div><h2>Tempo esgotado</h2><p>Fique de olho na TV.</p></div>`;
    else if (sub === 'revelacao') corpo = resultadoJ();
    else if (sub === 'placar') corpo = `<div class="cel-corpo"><p>Você está em</p><div class="cel-pos">${eu.posicao || '–'}º</div>
      <p>${eu.pontos} pontos${J.st.atras_de ? `, ${J.st.atras_de.diferenca} atrás de ${esc(J.st.atras_de.curto)}` : eu.posicao === 1 ? ': na liderança!' : ''}</p></div>`;
    else if (sub === 'fim') corpo = `<div class="cel-corpo">${eu.posicao && eu.posicao <= 3 ? `<div class="medalha p${eu.posicao}">${eu.posicao}º</div><h2>Você está no pódio!</h2>`
      : `<div class="cel-pos">${eu.posicao || '–'}º</div><h2>Fim de jogo</h2>`}
      <p>${eu.pontos} pontos, ${eu.acertos} ${eu.acertos === 1 ? 'acerto' : 'acertos'} em ${s.total} perguntas.</p></div>`;
    else corpo = `<div class="cel-corpo"><span class="spin"></span></div>`;
    app.innerHTML = `<div class="cel">${topoJ()}${corpo}${peJ()}</div>`;
    app.querySelectorAll('.cel-bt').forEach(b => b.addEventListener('click', () => responder(+b.dataset.l)));
    const re = $('#reenviar'); if (re) re.addEventListener('click', () => { const l = J.enviando.letra; J.enviando = null; responder(l); });
    if (sub === 'revelacao') vibrar(J.st.minha && J.st.minha.correta ? [40, 60, 40] : 120);
    tickJ();
  }
  function resultadoJ() {
    const m = J.st.minha, eu = J.st.eu, corretas = J.st.corretas || [];
    const acertou = m && (m.correta != null ? m.correta : corretas.includes(m.letra));
    const pos = eu.posicao ? `Você está em <b>${eu.posicao}º</b> lugar${J.st.atras_de ? `, ${J.st.atras_de.diferenca} pontos atrás de ${esc(J.st.atras_de.curto)}` : eu.posicao === 1 ? ', na liderança' : ''}.` : '';
    if (!m) return `<div class="cel-res nada"><div class="selo">${XIS}</div><h2>Sem resposta</h2><p>${pos || 'Fica para a próxima.'}</p></div>`;
    if (!acertou) return `<div class="cel-res erro"><div class="selo">${XIS}</div><h2>Não foi dessa vez</h2><p>${pos}</p></div>`;
    return `<div class="cel-res ok"><div class="selo">${CHECK}</div><h2>Correto!</h2>
      ${m.pontos != null ? `<div class="pts">+${m.pontos + (m.bonus || 0)}</div>` : '<span class="spin"></span>'}
      ${m.bonus ? `<div class="seq">${eu.sequencia} acertos seguidos: +${m.bonus} de bônus</div>` : ''}<p>${pos}</p></div>`;
  }
  function tickJ() {
    if (!J || !J.st) return;
    const s = J.st.sessao;
    if (s.fase !== 'pergunta') return;
    const sub = subJ(), t = agora(), ini = Date.parse(s.iniciada_em), pz = Date.parse(s.prazo);
    if (sub !== J.chave.split('|')[1]) return desenhaJ();
    const cd = $('#cd'), cb = $('#cb');
    if (sub === 'prep') {
      if (cd) cd.textContent = Math.max(1, Math.ceil((ini - t) / 1000));
      const lib = ini - 5000; if (cb) cb.style.transform = `scaleX(${Math.min(1, Math.max(0, (t - lib) / (ini - lib)))})`;
    } else if (cb) cb.style.transform = `scaleX(${Math.min(1, Math.max(0, (pz - t) / (pz - ini)))})`;
    // o prazo passou e a revelação não chegou: pergunta (a consulta também fecha a rodada no banco)
    if (t > pz + 2500 && Date.now() - J.ultBusca > 2000) atualizaJ();
  }
  async function responder(l) {
    if (!J || J.st.minha || J.enviando) return;
    const s = J.st.sessao, rodada = s.rodada;
    J.enviando = { letra: l, rodada, estado: 'enviando' };
    vibrar(25);
    desenhaJ();
    try {
      const r = await rpc('quiz_responder', { p_sessao: s.id, p_rodada: rodada, p_letra: l }, { tentativas: 5 });
      if (J.st.sessao.rodada !== rodada) return;
      if (r.status === 'ok' || r.status === 'ja_respondeu') { J.st.minha = { letra: r.letra, recebida_em: r.recebida_em }; J.enviando = null; }
      else if (r.status === 'cedo') { J.enviando = null; toast('Calma: a pergunta ainda não abriu.', 'aviso'); }
      else { J.enviando = null; J.st.minha = null; toast('Tempo esgotado: a resposta chegou depois do prazo.', 'aviso'); }
    } catch (e) { if (J.enviando) J.enviando.estado = 'falhou'; }
    J.chave = ''; desenhaJ();
  }

  /* ============================================================
     A TV
     ============================================================ */
  let T = null;
  async function tv(sid) {
    sair();
    document.body.classList.add('na-tv');
    T = { sid, st: null, busy: false, sub: '', fechando: false, tique: 0, podio: null };
    app.innerHTML = `<div class="tv"><div class="carregando"><span class="spin"></span> Abrindo a partida…</div></div>`;
    await atualizaT();
    if (!T.st) return;
    T.canal = ouvir(['neuroquiz:' + sid, 'neuroquiz:' + sid + ':tv'], sinalT);
    aoSair(() => T.canal.fechar());
    intervalo(tickT, 100);
    intervalo(() => {
      const f = T.st && T.st.sessao.fase, sem = !T.canal.ok();
      if ((sem && (f === 'pergunta' || f === 'lobby')) || Date.now() - (T.ultimo || 0) > (sem ? 4000 : 20000)) atualizaT();
    }, 1000);
    escuta(document, 'keydown', e => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      NQSom.ligar();
      if (e.code === 'Space' || e.key === 'Enter' || e.key === 'ArrowRight') { e.preventDefault(); avancar(); }
      else if (e.key === 'm' || e.key === 'M') alternarSom();
      else if (e.key === 'f' || e.key === 'F') telaCheia();
    });
    escuta(document, 'pointerdown', () => NQSom.ligar());
  }
  async function atualizaT() {
    try { aplicaT(await rpc('quiz_tv', { p_sessao: T.sid })); }
    catch (e) { if (!T.st) mensagem('Sem conexão', 'Não consegui abrir a partida.', 'Tentar de novo', () => tv(T.sid)); }
  }
  function aplicaT(r) {
    if (!T) return;
    if (!r || r.status !== 'ok') { if (!T.st) mensagem('Partida não encontrada', 'Confira o endereço ou crie uma partida no editor.', 'Abrir o editor', () => { location.hash = 'editor/partidas'; }); return; }
    T.ultimo = Date.now();
    const antes = T.st;
    if (antes && r.sessao.seq < antes.sessao.seq) return;
    T.st = r;
    if (!antes || antes.sessao.seq !== r.sessao.seq) { T.fechando = false; T.sub = ''; desenhaT(antes); }
    else parcialT(antes);
  }
  function sinalT(ev, p) {
    if (!T || !T.st) return;
    if (ev === 'conectou' || ev === 'jogadores') return atualizaT();
    if (ev === 'fase' && p.seq > T.st.sessao.seq) return atualizaT();
    if (ev === 'respostas' && p.rodada === T.st.sessao.rodada) {
      T.st.respostas_n = Math.max(T.st.respostas_n || 0, p.n);
      const c = $('#cnt'); if (c) c.textContent = T.st.respostas_n;
    }
  }
  async function avancar() {
    if (!T || !T.st || T.busy) return;
    if (T.st.sessao.fase === 'fim' && T.podio && T.podio.passo < 4) return pularPodio();
    T.busy = true;
    try { aplicaT(await rpc('quiz_avancar', { p_sessao: T.sid, p_seq: T.st.sessao.seq }, { tentativas: 4 })); }
    catch (e) { toast('Não consegui falar com o banco. Tente de novo.', 'erro'); }
    finally { T.busy = false; }
  }
  function alternarSom() { NQSom.definirMudo(!NQSom.mudo()); const b = $('#tv-som'); if (b) b.textContent = NQSom.mudo() ? 'Ligar o som' : 'Som'; }
  function telaCheia() { try { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen(); } catch (e) { /* sem tela cheia */ } }

  function topoT() {
    const s = T.st.sessao;
    const rot = { lobby: 'Começar', pergunta: 'Encerrar a pergunta', revelacao: s.rodada >= s.total ? 'Ver o pódio' : 'Avançar', placar: 'Próxima pergunta', fim: 'Fim' }[s.fase];
    return `<header class="tv-topo"><span class="marca">Neuro<b>Quiz</b></span>
      <span class="dado"><small>PIN</small> ${pin3(s.pin)}</span>
      ${s.fase !== 'lobby' && s.fase !== 'fim' ? `<span class="dado">${s.rodada} <small>de ${s.total}</small></span>` : ''}
      <span class="sep"></span><span class="dado" id="tv-jog">${T.st.jogadores_n} <small>${T.st.jogadores_n === 1 ? 'jogador' : 'jogadores'}</small></span>
      <div class="tv-ctl"><button class="btn ghost" id="tv-som">${NQSom.mudo() ? 'Ligar o som' : 'Som'}</button>
        <button class="btn ghost" id="tv-tela">Tela cheia</button>
        ${s.fase !== 'fim' ? `<button class="btn solid" id="tv-av">${rot}</button>` : `<a class="btn ghost" href="#editor/partidas">Editor</a>`}</div></header>`;
  }
  function ligaTopo() {
    $('#tv-som')?.addEventListener('click', alternarSom);
    $('#tv-tela')?.addEventListener('click', telaCheia);
    $('#tv-av')?.addEventListener('click', () => { NQSom.ligar(); avancar(); });
  }
  function desenhaT(antes) {
    const s = T.st.sessao;
    const corpo = { lobby: lobbyT, pergunta: perguntaT, revelacao: revelacaoT, placar: placarT, fim: podioT }[s.fase]();
    app.innerHTML = `<div class="tv">${topoT()}<main class="tv-corpo">${corpo}</main>${s.fase === 'lobby' ? '<div class="tv-dica"><kbd>Espaço</kbd> começa · <kbd>M</kbd> som · <kbd>F</kbd> tela cheia</div>' : ''}</div>`;
    ligaTopo();
    somT(antes);
    if (s.fase === 'fim') animaPodio();
    tickT();
  }
  function parcialT(antes) {
    const s = T.st.sessao, j = $('#tv-jog');
    if (j) j.innerHTML = `${T.st.jogadores_n} <small>${T.st.jogadores_n === 1 ? 'jogador' : 'jogadores'}</small>`;
    if (s.fase === 'lobby' && antes && (antes.jogadores || []).length !== (T.st.jogadores || []).length) {
      const box = $('#lobby-jog'); if (box) box.outerHTML = jogadoresT();
      if ((T.st.jogadores || []).length > (antes.jogadores || []).length) NQSom.efeito('entrou');
    }
    const c = $('#cnt'); if (c && T.st.respostas_n != null) c.textContent = T.st.respostas_n;
  }
  function somT(antes) {
    const f = T.st.sessao.fase;
    if (f === 'lobby') NQSom.tocar('lobby');
    else if (f === 'pergunta') { NQSom.parar(); NQSom.efeito('vinheta'); }
    else if (f === 'revelacao') { NQSom.parar(); if (antes && antes.sessao.fase === 'pergunta') {
      if (agora() > Date.parse(antes.sessao.prazo)) NQSom.efeito('gongo');
      setTimeout(() => NQSom.efeito(T.st.pergunta && T.st.pergunta.tipo === 'whatsapp' ? 'destrava' : 'revela'), 300); } }
    else if (f === 'placar') NQSom.tocar('placar');
    else if (f === 'fim') NQSom.parar();
  }

  /* lobby */
  function qrSVG(texto) {
    try { const q = qrcode(0, 'M'); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }
    catch (e) { return ''; }
  }
  function jogadoresT() {
    const js = T.st.jogadores || [], n = js.length;
    const tam = n > 30 ? 'calc(var(--u)*2.2)' : n > 16 ? 'calc(var(--u)*2.6)' : '';
    return `<div class="lobby-jog" id="lobby-jog"><h2><b>${n}</b> ${n === 1 ? 'jogador' : 'jogadores'}</h2>
      ${n ? `<div class="jogs" ${tam ? `style="font-size:${tam}"` : ''}>${js.map(j => `<span class="jog" ${tam ? `style="font-size:${tam}"` : ''}>${av(j)}${esc(j.curto)}</span>`).join('')}</div>`
          : '<p class="lobby-vazio">Esperando a primeira pessoa entrar…</p>'}</div>`;
  }
  function lobbyT() {
    const s = T.st.sessao, url = `https://${ENDERECO}/#${s.pin}`;
    return `<div class="lobby"><div class="lobby-entrar"><span class="rot">Entre em</span><span class="url">${ENDERECO}</span>
        <span class="rot">com o PIN</span><span class="pin">${pin3(s.pin)}</span></div>
      <div class="lobby-qr"><div class="qr" aria-label="QR para entrar">${qrSVG(LOCAL ? location.origin + location.pathname + '#' + s.pin : url)}</div></div>
      ${jogadoresT()}</div>`;
  }

  /* pergunta */
  function zapHTML(p, revelado) {
    const a = p.autor || {}, nome = a.rotulo || a.curto || a.nome || '?';
    const certa = revelado && (p.alternativas || []).find(x => (T.st.corretas || []).includes(x.letra));
    const hora = (p.extra && p.extra.hora) || horaFalsa(p.id);
    const grupo = (p.extra && p.extra.grupo) || 'Equipe NRO 🧠';
    const base = esc(String(p.mensagem || '').replace(/…$/, ''));
    return `<div class="zap"><div class="zap-topo"><span class="grupo-ic">🧠</span><span class="g">${esc(grupo)}<small>${T.st.jogadores_n + 5} participantes</small></span></div>
      <div class="zap-msgs">${av(a)}<div class="balao"><div class="quem">${esc(nome)}</div>
        <div class="msg">${base}${certa ? ` <span class="cont destrava">${esc(certa.texto)}</span>` : '<span class="reticencias">…</span>'}</div>
        <div class="hora">${esc(hora)}</div></div></div></div>`;
  }
  function horaFalsa(id) { let h = 0; for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `${String(19 + h % 5).padStart(2, '0')}:${String(h % 60).padStart(2, '0')}`; }
  function textoPerg(p) {
    if (p.tipo === 'whatsapp') return `Complete a mensagem de ${esc((p.autor && (p.autor.rotulo || p.autor.curto)) || '')}`;
    return esc(p.texto);
  }
  function cabT(p) {
    return `<div class="perg-cab"><span>Pergunta ${p.ordem} de ${T.st.sessao.total}</span><span class="tipo">${TIPO[p.tipo] || ''}</span>
      ${p.pontos === 2000 ? '<span class="tipo" style="background:var(--lumen-primary);color:var(--void)">Pontos em dobro</span>' : p.pontos === 0 ? '<span class="tipo">Sem pontos</span>' : ''}</div>`;
  }
  function opsHTML(p, revelado) {
    const corretas = T.st.corretas || [], cont = T.st.contagem || [];
    const longas = (p.alternativas || []).some(a => (a.texto || '').length > 40);
    return `<div class="ops ${longas ? 'longas' : ''} ${revelado ? 'revelado' : ''}">${(p.alternativas || []).map(a => {
      const certa = revelado && corretas.includes(a.letra);
      const nome = a.membro ? (a.texto || a.membro.curto) : a.texto;
      return `<div class="op op${a.letra} ${a.membro ? 'quem' : ''} ${revelado ? (certa ? 'certa' : 'errada') : ''}">${FORMA[a.letra]}<span class="letra">${LETRA[a.letra]}</span>
        ${a.membro ? av(a.membro) : ''}<span class="txt">${esc(nome)}</span>
        ${revelado ? (certa ? `<span class="marca-ok">${CHECK}</span>` : '') : ''}</div>`;
    }).join('')}</div>`;
  }
  function perguntaT() {
    const p = T.st.pergunta, s = T.st.sessao;
    const leitura = agora() < Date.parse(s.iniciada_em);
    T.sub = leitura ? 'leitura' : 'aberta';
    const nota = p.nota ? `<div class="nota-host">${esc(p.nota)}</div>` : '';
    if (leitura) return `<div class="leitura">${cabT(p)}${p.tipo === 'whatsapp' ? `<div class="perg-midia">${zapHTML(p, false)}</div>`
        : `<div class="perg-texto ${tamTexto(p.texto)}">${textoPerg(p)}</div>`}${nota}<div class="leitura-barra"><i id="lb"></i></div></div>`;
    const centro = p.tipo === 'whatsapp' ? zapHTML(p, false) : `<div class="perg-texto ${tamTexto(p.texto)}">${textoPerg(p)}</div>`;
    return `${cabT(p)}${p.tipo === 'whatsapp' ? `<div class="perg-texto" style="font-size:calc(var(--u)*4);padding:calc(var(--u)*1.2) calc(var(--u)*2.4)">${textoPerg(p)}</div>` : ''}
      <div class="perg-meio"><div class="relogio" id="rel">${p.tempo_s}</div><div class="perg-midia">${centro}</div>
        <div class="contador"><b id="cnt">${T.st.respostas_n || 0}</b><span>${(T.st.respostas_n || 0) === 1 ? 'resposta' : 'respostas'}</span></div></div>
      ${nota}${opsHTML(p, false)}`;
  }
  function revelacaoT() {
    const p = T.st.pergunta, corretas = T.st.corretas || [], cont = T.st.contagem || [];
    const max = Math.max(1, ...cont);
    const faixa = corretas.length === (p.alternativas || []).length && corretas.length > 1 ? '<div class="todas">Todas valiam!</div>'
      : corretas.length > 1 ? `<div class="todas">${corretas.length} alternativas valiam</div>` : '';
    const grafico = `<div class="grafico">${(p.alternativas || []).map(a => {
      const n = cont[a.letra] || 0, certa = corretas.includes(a.letra);
      return `<div class="barra-g op${a.letra} ${certa ? '' : 'errada'}"><span class="n">${n}</span>
        <span class="col" style="height:${Math.max(4, Math.round(n / max * 100))}%"></span>
        <span class="pe">${FORMA[a.letra]}${certa ? CHECK : ''}</span></div>`;
    }).join('')}</div>`;
    const centro = p.tipo === 'whatsapp' ? `<div style="display:grid;grid-template-columns:1.6fr 1fr;gap:calc(var(--u)*3);align-items:center;width:100%">${zapHTML(p, true)}${grafico}</div>`
      : `<div style="display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*2);width:100%">${faixa}${grafico}</div>`;
    return `${cabT(p)}<div class="perg-texto ${tamTexto(p.texto)}" style="font-size:calc(var(--u)*4.2);padding:calc(var(--u)*1.4) calc(var(--u)*2.6)">${textoPerg(p)}</div>
      <div class="perg-meio" style="grid-template-columns:1fr">${centro}</div>${opsHTML(p, true)}`;
  }
  function placarT() {
    const linhas = (T.st.placar || []).slice(0, 5);
    return `<div class="placar"><h1>Placar</h1>${linhas.map((j, i) => {
      const subiu = j.posicao_anterior && j.posicao_anterior > j.posicao ? `<span class="seta">▲ ${j.posicao_anterior - j.posicao}</span>` : '';
      return `<div class="linha-p ${j.posicao === 1 ? 'primeiro' : ''}" style="animation-delay:${(linhas.length - i) * 120}ms"><span class="pos">${j.posicao}</span>${av(j)}<span class="nome">${esc(j.curto)}</span>${subiu}<span>${j.pontos}</span></div>`;
    }).join('') || '<p class="lobby-vazio" style="text-align:center">Ninguém pontuou ainda.</p>'}</div>`;
  }
  function podioT() {
    const pl = T.st.placar || [], de = p => pl.find(j => j.posicao === p);
    const degrau = p => { const j = de(p); return `<div class="degrau p${p}" id="dg${p}">${j ? `${av(j)}<div class="nome">${esc(j.curto)}</div><div class="pts">${j.pontos} pts</div>` : ''}<div class="bloco">${p}</div></div>`; };
    const resto = pl.filter(j => j.posicao > 3);
    return `<div class="podio"><h1 id="pd-t">E o pódio é de…</h1><div class="podio-grade">${degrau(2)}${degrau(1)}${degrau(3)}</div>
      <div class="podio-resto" id="pd-r">${resto.map(j => `<span><b>${j.posicao}º</b> ${esc(j.curto)} · ${j.pontos}</span>`).join('')}</div></div>`;
  }
  function animaPodio() {
    if (T.podio && T.podio.seq === T.st.sessao.seq && T.podio.passo >= 4) { mostraPodio(4); return; }
    T.podio = { seq: T.st.sessao.seq, passo: 0, timers: [] };
    const em = (ms, f) => T.podio.timers.push(setTimeout(f, ms));
    NQSom.efeito('rufar', 3);
    em(3000, () => mostraPodio(1)); em(5200, () => mostraPodio(2)); em(7400, () => mostraPodio(3)); em(8600, () => mostraPodio(4));
    aoSair(() => T.podio && T.podio.timers.forEach(clearTimeout));
  }
  function mostraPodio(passo) {
    if (!T.podio) return;
    T.podio.passo = passo;
    if (passo >= 1) $('#dg3')?.classList.add('on');
    if (passo >= 2) $('#dg2')?.classList.add('on');
    if (passo >= 3) { $('#dg1')?.classList.add('on'); const t = $('#pd-t'); if (t) t.textContent = 'Pódio'; }
    if (passo === 3) NQSom.efeito('fanfarra');
    if (passo >= 4) $('#pd-r')?.classList.add('on');
    if (passo < 3) NQSom.efeito('revela');
  }
  function pularPodio() { T.podio.timers.forEach(clearTimeout); NQSom.efeito('fanfarra'); mostraPodio(4); }

  function tickT() {
    if (!T || !T.st) return;
    const s = T.st.sessao;
    if (s.fase !== 'pergunta') return;
    const t = agora(), ini = Date.parse(s.iniciada_em), pz = Date.parse(s.prazo), lib = Date.parse(s.liberada_em || s.iniciada_em);
    const sub = t < ini ? 'leitura' : 'aberta';
    if (sub !== T.sub) { app.querySelector('.tv-corpo').innerHTML = perguntaT(); if (sub === 'aberta') { NQSom.tocar('pergunta'); NQSom.tenso(false); } return; }
    if (sub === 'leitura') { const b = $('#lb'); if (b) b.style.transform = `scaleX(${Math.min(1, Math.max(0, (t - lib) / Math.max(1, ini - lib)))})`; return; }
    const resta = Math.max(0, Math.ceil((pz - t) / 1000)), r = $('#rel');
    if (r && r.textContent !== String(resta)) {
      r.textContent = resta; r.classList.toggle('fim', resta <= 5);
      if (resta <= 5 && resta > 0 && T.tique !== resta) { T.tique = resta; NQSom.tenso(true); NQSom.efeito(resta <= 3 ? 'tiqueAgudo' : 'tique'); }
    }
    // fecha sozinha: o tempo acabou, ou todo mundo que está jogando respondeu
    if (T.fechando || T.busy) return;
    const todos = T.st.ativos_n > 0 && (T.st.respostas_n || 0) >= T.st.ativos_n && t > ini + 300;
    if (t > pz + 600 || todos) { T.fechando = true; avancar(); }
  }

  /* ============================================================
     O EDITOR
     ============================================================ */
  let E = null;
  const IC = {
    sobe: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>', desce: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    editar: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/></svg>',
    copiar: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
    lixo: '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>'
  };
  const PROB = {
    sem_alternativas: 'Menos de duas alternativas', sem_correta: 'Nenhuma alternativa certa', alternativa_vazia: 'Alternativa vazia',
    quem_sem_membro: 'Alternativa sem membro', whatsapp_sem_autor: 'Mensagem sem autor', whatsapp_sem_mensagem: 'Mensagem vazia',
    marcador_no_texto: 'Sobrou um marcador [ ] no texto', membro_inativo: 'Membro que não está ativo', alternativas_iguais: 'Alternativas iguais'
  };
  const BLOQ = ['sem_alternativas', 'sem_correta', 'alternativa_vazia', 'quem_sem_membro', 'whatsapp_sem_autor', 'whatsapp_sem_mensagem', 'marcador_no_texto'];

  async function editor(aba) {
    sair();
    E = { aba: aba === 'partidas' ? 'partidas' : 'perguntas', lista: [], membros: [], sessoes: [] };
    app.innerHTML = `<div class="ed"><div class="ed-cab">${MARCA}<nav class="seg" aria-label="Seções">
        <button data-aba="perguntas">Perguntas</button><button data-aba="partidas">Partidas</button></nav><span class="sep"></span>
        <button class="btn ghost" id="ed-importar">Importar docx</button><button class="btn ghost" id="ed-nova">Nova pergunta</button>
        <button class="btn solid" id="ed-partida">Nova partida</button></div><div id="ed-corpo"><div class="carregando"><span class="spin"></span> Carregando…</div></div></div>`;
    app.querySelectorAll('[data-aba]').forEach(b => b.addEventListener('click', () => { location.hash = 'editor/' + b.dataset.aba; }));
    $('#ed-importar').addEventListener('click', importar);
    $('#ed-nova').addEventListener('click', () => formPergunta(null));
    $('#ed-partida').addEventListener('click', novaPartida);
    try { await Promise.all([carregaPerguntas(), carregaMembros(), carregaSessoes()]); }
    catch (e) { $('#ed-corpo').innerHTML = `<p class="nota">Não consegui carregar: ${esc(e.message || e)}</p>`; return; }
    desenhaEd();
  }
  async function carregaPerguntas() { const r = await rpc('quiz_perguntas_lista'); E.lista = r.perguntas || []; }
  async function carregaMembros() { const r = await rpc('quiz_membros'); E.membros = r.membros || []; }
  async function carregaSessoes() { const r = await rpc('quiz_sessoes_lista'); E.sessoes = r.sessoes || []; }
  function desenhaEd() {
    app.querySelectorAll('[data-aba]').forEach(b => b.classList.toggle('on', b.dataset.aba === E.aba));
    $('#ed-corpo').innerHTML = E.aba === 'partidas' ? partidasHTML() : perguntasHTML();
    ligaEd();
  }
  function perguntasHTML() {
    const at = E.lista.filter(q => q.ativa).length, prob = E.lista.filter(q => (q.problemas || []).some(p => BLOQ.includes(p))).length;
    if (!E.lista.length) return `<div class="vazio" style="padding:60px 0;text-align:center"><p class="nota" style="margin-bottom:16px">Nenhuma pergunta ainda.</p>
      <button class="btn solid" id="vz-imp">Importar o docx</button></div>`;
    return `<p class="ed-resumo">${E.lista.length} perguntas · ${at} ativas · ${prob ? `<b style="color:var(--bad-tx)">${prob} com problema</b>` : 'nenhuma com problema'} · uns ${Math.round(E.lista.filter(q => q.ativa).reduce((s, q) => s + q.tempo_s + 18, 0) / 60)} min de jogo</p>
      <div class="ed-lista">${E.lista.map((q, i) => linhaQ(q, i)).join('')}</div>`;
  }
  function altChip(a) {
    const nome = a.membro ? (a.texto || a.membro.curto) : (a.texto || (a.registro ? 'registro ' + a.registro : '—'));
    return `<span class="alt op${a.letra} ${a.correta ? 'ok' : ''}"><span class="sw">${LETRA[a.letra]}</span>${a.membro ? av(a.membro, '') : ''}${esc(nome)}</span>`;
  }
  function linhaQ(q, i) {
    const probs = q.problemas || [];
    return `<div class="ed-q ${q.ativa ? '' : 'inativa'}" data-id="${q.id}">
      <div class="ord"><button class="icbtn sm" data-sobe aria-label="Subir" ${i ? '' : 'disabled'}>${IC.sobe}</button><span>${String(i + 1).padStart(2, '0')}</span>
        <button class="icbtn sm" data-desce aria-label="Descer" ${i < E.lista.length - 1 ? '' : 'disabled'}>${IC.desce}</button></div>
      <div class="meio"><div class="linha1"><span class="tipo-chip">${TIPO[q.tipo]}</span><span class="meta">${q.tempo_s} s · ${q.pontos === 2000 ? 'dobro' : q.pontos === 0 ? 'sem pontos' : '1000 pts'}${q.origem ? ' · ' + esc(q.origem) : ''}</span></div>
        <div class="tit">${esc(q.texto)}</div>
        ${q.tipo === 'whatsapp' ? `<div class="zapmini">${esc((q.autor && (q.autor.rotulo || q.autor.curto)) || 'sem autor')}: “${esc(q.mensagem || '')}”</div>` : ''}
        <div class="alts">${(q.alternativas || []).map(altChip).join('')}</div>
        ${q.nota ? `<div class="pills"><span class="pp" style="background:rgba(var(--info-rgb),.12);color:var(--info-tx)">Nota para a TV: ${esc(q.nota)}</span></div>` : ''}
        ${probs.length ? `<div class="pills">${probs.map(p => `<span class="pp ${BLOQ.includes(p) ? 'bloq' : ''}">${esc(PROB[p] || p)}</span>`).join('')}</div>` : ''}</div>
      <div class="acoes"><button class="interruptor ${q.ativa ? 'on' : ''}" data-ativa role="switch" aria-checked="${q.ativa}" aria-label="Ativa" title="${q.ativa ? 'Ativa' : 'Desativada'}"></button>
        <button class="icbtn" data-editar aria-label="Editar" title="Editar">${IC.editar}</button>
        <button class="icbtn" data-dup aria-label="Duplicar" title="Duplicar">${IC.copiar}</button>
        <button class="icbtn" data-del aria-label="Excluir" title="Excluir">${IC.lixo}</button></div></div>`;
  }
  function partidasHTML() {
    const FASE = { lobby: 'No lobby', pergunta: 'Pergunta aberta', revelacao: 'Revelação', placar: 'Placar', fim: 'Encerrada' };
    if (!E.sessoes.length) return `<p class="nota" style="padding:40px 0;text-align:center">Nenhuma partida ainda. Use “Nova partida”.</p>`;
    return `<div class="ed-lista">${E.sessoes.map(s => `<div class="sess"><div><div class="t">${esc(s.titulo)} · PIN ${pin3(s.pin)}</div>
      <div class="m">${FASE[s.fase]}${s.fase !== 'lobby' ? ` · ${s.rodada} de ${s.total}` : ` · ${s.total} perguntas`} · ${s.jogadores_n} jogadores · ${new Date(s.criada_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${s.criada_por_nome ? ' · ' + esc(s.criada_por_nome) : ''}</div></div>
      <div class="acts">${s.fase !== 'fim' ? `<a class="btn solid" href="#tv/${s.id}">Abrir na TV</a><button class="btn ghost" data-encerrar="${s.id}">Encerrar</button>` : `<a class="btn ghost" href="#tv/${s.id}">Ver o pódio</a>`}</div></div>`).join('')}</div>`;
  }
  function ligaEd() {
    $('#vz-imp')?.addEventListener('click', importar);
    app.querySelectorAll('.ed-q').forEach(el => {
      const id = el.dataset.id, q = E.lista.find(x => x.id === id), i = E.lista.indexOf(q);
      el.querySelector('[data-editar]').addEventListener('click', () => formPergunta(q));
      el.querySelector('[data-dup]').addEventListener('click', () => acaoEd('quiz_pergunta_duplicar', { p_id: id }, 'Duplicada (desativada, logo abaixo).'));
      el.querySelector('[data-del]').addEventListener('click', () => {
        abreDlg(`<h3>Excluir a pergunta?</h3><p>${esc(q.texto)}</p><div class="acts"><button class="btn ghost" id="d-n">Cancelar</button><button class="btn danger" id="d-s">Excluir</button></div>`);
        $('#d-n').addEventListener('click', fechaDlg);
        $('#d-s').addEventListener('click', () => { fechaDlg(); acaoEd('quiz_pergunta_excluir', { p_id: id }, 'Excluída.'); });
      });
      el.querySelector('[data-ativa]').addEventListener('click', async () => {
        const r = await rpc('quiz_pergunta_ativar', { p_id: id, p_ativa: !q.ativa });
        if (r.status === 'com_problema') toast('Corrija os problemas antes de ativar.', 'aviso');
        await carregaPerguntas(); desenhaEd();
      });
      const mover = d => { const ids = E.lista.map(x => x.id); ids.splice(i + d, 0, ids.splice(i, 1)[0]); acaoEd('quiz_perguntas_ordenar', { p_ids: ids }); };
      el.querySelector('[data-sobe]').addEventListener('click', () => mover(-1));
      el.querySelector('[data-desce]').addEventListener('click', () => mover(1));
    });
    app.querySelectorAll('[data-encerrar]').forEach(b => b.addEventListener('click', async () => {
      await rpc('quiz_sessao_encerrar', { p_sessao: b.dataset.encerrar }); await carregaSessoes(); desenhaEd(); toast('Partida encerrada.');
    }));
  }
  async function acaoEd(fn, args, msg) {
    try { const r = await rpc(fn, args); if (r && r.status && r.status !== 'ok') throw new Error(r.status); if (msg) toast(msg); }
    catch (e) { toast('Não deu: ' + (e.message || e), 'erro'); }
    await carregaPerguntas(); desenhaEd();
  }

  /* a pergunta, no formulário */
  function opcoesMembros(sel) {
    return `<option value="">Escolha um membro</option>` + E.membros.filter(m => m.ativo || m.registro === sel)
      .map(m => `<option value="${m.registro}" ${m.registro === sel ? 'selected' : ''}>${esc(m.nome)} (${String(m.registro).padStart(3, '0')})</option>`).join('');
  }
  function formPergunta(q) {
    const f = q ? JSON.parse(JSON.stringify(q)) : { tipo: 'classica', texto: '', tempo_s: 20, pontos: 1000, ativa: true, extra: {},
      alternativas: [0, 1, 2, 3].map(l => ({ letra: l, texto: '', correta: l === 0 })) };
    while ((f.alternativas || []).length < 2) f.alternativas.push({ letra: f.alternativas.length, texto: '', correta: false });
    const desenha = () => {
      const dlg = abreDlg(`<h3>${q ? 'Editar a pergunta' : 'Nova pergunta'}</h3>
        <form class="ed-form" id="fq">
          <div><span class="lb">Tipo</span><div class="seg" id="fq-tipo">${Object.entries(TIPO).map(([k, v]) => `<button type="button" data-t="${k}" class="${f.tipo === k ? 'on' : ''}">${v}</button>`).join('')}</div></div>
          <div class="fld"><label for="fq-texto">${f.tipo === 'whatsapp' ? 'O que a TV pergunta' : 'Pergunta'}</label><textarea id="fq-texto" rows="2" maxlength="300">${esc(f.texto || (f.tipo === 'whatsapp' ? 'Complete a mensagem' : ''))}</textarea></div>
          ${f.tipo === 'whatsapp' ? `<div class="duas"><div class="fld"><label for="fq-autor">Quem mandou</label><select id="fq-autor">${opcoesMembros(f.autor_registro)}</select></div>
            <div class="fld"><label for="fq-hora">Horário no balão</label><input id="fq-hora" maxlength="5" placeholder="21:47" value="${esc((f.extra || {}).hora || '')}"></div></div>
            <div class="fld"><label for="fq-msg">A mensagem, cortada no “…”</label><textarea id="fq-msg" rows="2" maxlength="300">${esc(f.mensagem || '')}</textarea></div>` : ''}
          <div><span class="lb">Alternativas (marque a certa; mais de uma vale)</span><div style="display:flex;flex-direction:column;gap:8px">${f.alternativas.map((a, i) => `
            <div class="alt-ed op${i}"><span class="sw">${LETRA[i]}</span>
              ${f.tipo === 'quem' ? `<select data-reg="${i}">${opcoesMembros(a.registro)}</select>` : `<input data-txt="${i}" maxlength="120" value="${esc(a.texto || '')}" placeholder="Alternativa ${LETRA[i]}">`}
              <label><input type="checkbox" data-ok="${i}" ${a.correta ? 'checked' : ''}> certa</label>
              <button type="button" class="icbtn" data-tira="${i}" aria-label="Tirar" ${f.alternativas.length <= 2 ? 'disabled' : ''}>${IC.lixo}</button></div>`).join('')}</div>
            ${f.alternativas.length < 4 ? '<button type="button" class="btn ghost" id="fq-mais" style="margin-top:8px">Mais uma alternativa</button>' : ''}</div>
          <div class="duas"><div class="fld"><label for="fq-tempo">Tempo</label><select id="fq-tempo">${[5, 10, 20, 30, 60, 90, 120, 240].map(t => `<option value="${t}" ${f.tempo_s === t ? 'selected' : ''}>${t} segundos</option>`).join('')}</select></div>
            <div class="fld"><label for="fq-pontos">Pontos</label><select id="fq-pontos"><option value="1000" ${f.pontos === 1000 ? 'selected' : ''}>Padrão (até 1000)</option>
              <option value="2000" ${f.pontos === 2000 ? 'selected' : ''}>Dobro (até 2000)</option><option value="0" ${f.pontos === 0 ? 'selected' : ''}>Sem pontos</option></select></div></div>
          <div class="fld"><label for="fq-nota">Nota para quem conduz (aparece na TV)</label><input id="fq-nota" maxlength="300" value="${esc(f.nota || '')}"></div>
          <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm)"><input type="checkbox" id="fq-ativa" ${f.ativa ? 'checked' : ''}> Ativa (entra nas próximas partidas)</label>
          <p class="nq-msg ruim" id="fq-msg-erro"></p>
          <div class="acts"><button type="button" class="btn ghost" id="fq-cancela">Cancelar</button><button type="submit" class="btn solid">Salvar</button></div>
        </form>`);
      const ler = () => {
        f.texto = $('#fq-texto').value; f.tempo_s = +$('#fq-tempo').value; f.pontos = +$('#fq-pontos').value; f.nota = $('#fq-nota').value; f.ativa = $('#fq-ativa').checked;
        if (f.tipo === 'whatsapp') { f.autor_registro = +$('#fq-autor').value || null; f.mensagem = $('#fq-msg').value; f.extra = Object.assign({}, f.extra, { hora: $('#fq-hora').value || undefined }); }
        f.alternativas.forEach((a, i) => {
          a.correta = dlg.querySelector(`[data-ok="${i}"]`).checked;
          if (f.tipo === 'quem') a.registro = +dlg.querySelector(`[data-reg="${i}"]`).value || null; else a.texto = dlg.querySelector(`[data-txt="${i}"]`).value;
        });
      };
      dlg.querySelectorAll('#fq-tipo button').forEach(b => b.addEventListener('click', () => { ler(); f.tipo = b.dataset.t; desenha(); }));
      dlg.querySelectorAll('[data-tira]').forEach(b => b.addEventListener('click', () => { ler(); f.alternativas.splice(+b.dataset.tira, 1); desenha(); }));
      $('#fq-mais')?.addEventListener('click', () => { ler(); f.alternativas.push({ texto: '', correta: false }); desenha(); });
      $('#fq-cancela').addEventListener('click', fechaDlg);
      $('#fq').addEventListener('submit', async ev => {
        ev.preventDefault(); ler();
        const r = await rpc('quiz_pergunta_salvar', { p: { id: q && q.id, tipo: f.tipo, texto: f.texto, autor_registro: f.autor_registro, mensagem: f.mensagem,
          extra: f.extra || {}, tempo_s: f.tempo_s, pontos: f.pontos, nota: f.nota, ativa: f.ativa,
          alternativas: f.alternativas.map(a => ({ texto: a.texto, registro: a.registro, correta: a.correta })) } });
        if (r.status !== 'ok') { $('#fq-msg-erro').textContent = 'Confira o campo: ' + (r.campo || r.status); return; }
        fechaDlg();
        const bloq = (r.problemas || []).filter(p => BLOQ.includes(p));
        toast(bloq.length ? `Salva, mas desativada: ${bloq.map(p => PROB[p]).join(', ')}.` : 'Salva.', bloq.length ? 'aviso' : 'ok');
        await carregaPerguntas(); desenhaEd();
      });
    };
    desenha();
  }

  /* a importação do docx, com a revisão antes de gravar */
  function precisaJSZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((ok, erro) => { const s = document.createElement('script'); s.src = '../vendor/jszip-3.10.1.min.js'; s.onload = () => ok(window.JSZip); s.onerror = erro; document.head.appendChild(s); });
  }
  function importar() {
    const dlg = abreDlg(`<h3>Importar o docx</h3><p>Cada pergunta numerada, com as alternativas em lista logo abaixo e a certa marcada com ✅.
      Os membros entram pelo registro (“membro 30”, “[membro 9]”) ou pelo nome. Nada é gravado antes da revisão.</p>
      <div class="fld"><label for="imp-arq">Arquivo .docx</label><input type="file" id="imp-arq" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"></div>
      <p class="nq-msg" id="imp-msg"></p><div class="acts"><button class="btn ghost" id="imp-c">Cancelar</button></div>`);
    $('#imp-c').addEventListener('click', fechaDlg);
    $('#imp-arq').addEventListener('change', async ev => {
      const arq = ev.target.files[0]; if (!arq) return;
      $('#imp-msg').textContent = 'Lendo…';
      try {
        const JSZip = await precisaJSZip();
        const cruas = await NQImport.lerDocx(await arq.arrayBuffer(), JSZip);
        if (!cruas.length) { $('#imp-msg').textContent = 'Não achei perguntas numeradas neste arquivo.'; return; }
        revisaoImport(NQImport.revisar(cruas, E.membros), arq.name);
      } catch (e) { $('#imp-msg').classList.add('ruim'); $('#imp-msg').textContent = 'Não consegui ler: ' + (e.message || e); }
    });
    void dlg;
  }
  function marcar(texto, trocas) {
    let h = esc(texto);
    [...new Set(trocas.map(t => t.para))].sort((a, b) => b.length - a.length)
      .forEach(n => { h = h.split(esc(n)).join(`<mark>${esc(n)}</mark>`); });
    return h;
  }
  function revisaoImport(qs, nome) {
    const prontas = qs.filter(q => !q.problemas.length).length, comAviso = qs.filter(q => q.avisos.length).length;
    const dlg = abreDlg(`<h3>Revisão: ${esc(nome)}</h3>
      <div class="rev-cab"><span class="rev-n">${qs.length} perguntas</span><span class="pp" style="background:rgba(var(--ok-rgb),.12);color:var(--ok-tx)">${prontas} prontas</span>
        ${qs.length - prontas ? `<span class="pp bloq">${qs.length - prontas} entram desativadas</span>` : ''}${comAviso ? `<span class="pp">${comAviso} com algo a conferir</span>` : ''}</div>
      <p>Os nomes em destaque vieram do SOMA pelo registro. As desativadas precisam de correção no editor antes de jogar.</p>
      <div class="ed ed-lista" style="padding:0;max-height:52vh;overflow:auto">${qs.map(q => `<div class="ed-q ${q.problemas.length ? 'inativa' : ''}" style="grid-template-columns:auto 1fr">
        <div class="ord"><span>${q.numero}</span></div><div class="meio"><div class="linha1"><span class="tipo-chip">${TIPO[q.tipo]}</span>${q.nota ? `<span class="meta">nota: ${esc(q.nota)}</span>` : ''}</div>
        <div class="tit">${marcar(q.texto, q.trocas)}</div>
        ${q.tipo === 'whatsapp' ? `<div class="zapmini">${q.autor ? `<mark>${esc(q.autor.curto)}</mark>` : '?'}: “${marcar(q.mensagem || '', q.trocas)}”</div>` : ''}
        <div class="alts">${q.alternativas.map((a, i) => `<span class="alt op${i} ${a.correta ? 'ok' : ''}"><span class="sw">${LETRA[i]}</span>${a.membro ? av(a.membro) + `<mark>${esc(a.membro.curto)}</mark>` : marcar(a.texto || a.original || '—', q.trocas)}</span>`).join('')}</div>
        ${q.problemas.length || q.avisos.length ? `<div class="pills">${q.problemas.map(p => `<span class="pp bloq">${esc(NQImport.explicar(p))}</span>`).join('')}${q.avisos.map(p => `<span class="pp">${esc(NQImport.explicar(p))}</span>`).join('')}</div>` : ''}
        </div></div>`).join('')}</div>
      ${E.lista.length ? `<label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm);margin-top:14px"><input type="checkbox" id="imp-subst"> Substituir as ${E.lista.length} perguntas que já estão no editor</label>` : ''}
      <p class="nq-msg ruim" id="imp-erro"></p>
      <div class="acts"><button class="btn ghost" id="imp-c">Cancelar</button><button class="btn solid" id="imp-ok">Importar ${qs.length} perguntas</button></div>`, 'largo');
    $('#imp-c').addEventListener('click', fechaDlg);
    $('#imp-ok').addEventListener('click', async () => {
      const bt = $('#imp-ok'); bt.disabled = true;
      try {
        const r = await rpc('quiz_importar', { p_lista: qs.map(NQImport.paraBanco), p_substituir: !!($('#imp-subst') && $('#imp-subst').checked) });
        if (r.status === 'partida_aberta') { $('#imp-erro').textContent = 'Há uma partida aberta. Encerre-a em Partidas antes de substituir.'; bt.disabled = false; return; }
        if (r.status !== 'ok') throw new Error(r.status);
        fechaDlg(); toast(`${r.importadas} perguntas importadas, ${r.ativas} ativas.`);
        await carregaPerguntas(); location.hash = 'editor/perguntas'; desenhaEd();
      } catch (e) { $('#imp-erro').textContent = 'Não deu: ' + (e.message || e); bt.disabled = false; }
    });
    void dlg;
  }

  /* uma partida nova: a TV abre com o PIN */
  function novaPartida() {
    const at = E.lista.filter(q => q.ativa).length;
    abreDlg(`<h3>Nova partida</h3><p>${at} perguntas ativas, na ordem do editor. A TV abre com o PIN e o QR; quem conduz avança com o espaço.</p>
      <form class="ed-form" id="fp">
        <div class="fld"><label for="fp-t">Título</label><input id="fp-t" maxlength="80" value="NeuroQuiz de integração"></div>
        <div><span class="lb">Placar parcial</span><div class="seg" id="fp-placar">${[[1, 'A cada pergunta'], [3, 'A cada 3'], [5, 'A cada 5'], [0, 'Só no fim']].map(([v, t]) => `<button type="button" data-v="${v}" class="${v === 3 ? 'on' : ''}">${t}</button>`).join('')}</div></div>
        <div><span class="lb">Leitura antes das alternativas</span><div class="seg" id="fp-leitura">${[0, 3, 5, 8].map(v => `<button type="button" data-v="${v}" class="${v === 5 ? 'on' : ''}">${v} s</button>`).join('')}</div></div>
        <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm)"><input type="checkbox" id="fp-bonus" checked> Bônus de sequência (+100 por acerto seguido, até +500)</label>
        <label style="display:flex;gap:8px;align-items:center;font-size:var(--fs-sm)"><input type="checkbox" id="fp-texto"> Mostrar a pergunta e as alternativas também no celular</label>
        <p class="nq-msg ruim" id="fp-erro"></p>
        <div class="acts"><button type="button" class="btn ghost" id="fp-c">Cancelar</button><button type="submit" class="btn solid" ${at ? '' : 'disabled'}>Abrir a partida na TV</button></div></form>`);
    ['#fp-placar', '#fp-leitura'].forEach(sel => $(sel).querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      $(sel).querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); })));
    $('#fp-c').addEventListener('click', fechaDlg);
    $('#fp').addEventListener('submit', async ev => {
      ev.preventDefault();
      const r = await rpc('quiz_sessao_criar', { p: { titulo: $('#fp-t').value, placar_cada: +$('#fp-placar .on').dataset.v, leitura_s: +$('#fp-leitura .on').dataset.v,
        bonus_sequencia: $('#fp-bonus').checked, texto_no_celular: $('#fp-texto').checked } });
      if (r.status !== 'ok') { $('#fp-erro').textContent = r.status === 'sem_perguntas' ? 'Nenhuma pergunta ativa.' : 'Confira: ' + (r.campo || r.status); return; }
      fechaDlg(); location.hash = 'tv/' + r.id;
    });
  }

  portao();
})();
