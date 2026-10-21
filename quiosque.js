/* ============================================================
   Quiosque do LABBIO: a tela da entrada.
   - A conta: o aparelho entra uma vez com a conta do quiosque
     (e-mail e senha, nunca neste arquivo) e a sessão fica no
     navegador. Sem segredo no código público.
   - Dados: quiosque_estado_conta() (QR, agenda de hoje, presentes,
     últimos check-ins), labbio_placar() (ranking e sequências) e
     quiosque_painel() (avisos e novos membros; opcional).
   - Parâmetros: ?layout=b (faixa e palco), ?fase=madrugada|dia|
     entardecer|noite (força a hora do dia, para teste).
   - Widgets giram de 10 a 15 s, até 4 slides, com progresso
     segmentado; relógio, QR e presença nunca giram; slide sem
     conteúdo é pulado; com movimento reduzido nada gira.
   ============================================================ */
const CONFIG = {
  SUPABASE_URL: 'https://rxzmkyjttzzpwtodqkve.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg',
  APP_URL: 'https://membro.neurodynamics.dev/',
  LAT: -19.8657, LON: -43.9648,  // Campus Pampulha, UFMG
  FOTOS_BASE: 'https://raw.githubusercontent.com/neurodynamics-dev/nro-pessoal/refs/heads/main/fotos/'
};
const $ = id => document.getElementById(id);
/* a biblioteca do QR pede cor em hex: lê do token */
const token = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const params = new URLSearchParams(location.search);
const reduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'nd.quiosque' } });
const S = { estado: null, placar: null, painel: null, sunrise: null, sunset: null, token: null, expira: 0, visto: undefined, rodando: false };

if (params.get('layout') === 'b') document.body.classList.replace('layout-a', 'layout-b');

/* ---------- a conta ---------- */
function mostrarEntrada(msg) { $('entrar').classList.add('on'); $('q-erro').textContent = msg || ''; }
$('form-entrar').addEventListener('submit', async e => {
  e.preventDefault(); $('q-ok').disabled = true; $('q-erro').textContent = '';
  const { error } = await sb.auth.signInWithPassword({ email: $('q-email').value.trim(), password: $('q-senha').value });
  $('q-ok').disabled = false;
  if (error) return $('q-erro').textContent = 'E-mail ou senha incorretos. Confira os dados da conta do quiosque.';
  $('entrar').classList.remove('on'); $('q-senha').value = ''; iniciar();
});
async function boot() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return mostrarEntrada();
  iniciar();
}
/* sessão perdida ou conta sem permissão: volta a pedir a conta */
const semSessao = e => e && (e.status === 401 || /JWT|sem_permissao|not authorized/i.test(String(e.message || e.code || '')));

/* ---------- a hora do dia: fundo e arco do sol ---------- */
function fase() {
  const f = params.get('fase'); if (['madrugada', 'dia', 'entardecer', 'noite'].includes(f)) return f;
  const agora = new Date(), t = agora.getHours() + agora.getMinutes() / 60;
  if (S.sunrise && S.sunset) {
    const a = S.sunrise, p = S.sunset, m = 45 * 6e4;
    if (agora >= a - m && agora < +a + m) return 'madrugada';
    if (agora >= +a + m && agora < p - m) return 'dia';
    if (agora >= p - m && agora < +p + m) return 'entardecer';
    return 'noite';
  }
  return t >= 5 && t < 7 ? 'madrugada' : t >= 7 && t < 17 ? 'dia' : t >= 17 && t < 19 ? 'entardecer' : 'noite';
}
function pintarFase() {
  const f = fase();
  ['madrugada', 'dia', 'entardecer', 'noite'].forEach(x => document.body.classList.toggle('fase-' + x, x === f));
}

/* ---------- relógio, tempo e sol ---------- */
function tick() {
  const d = new Date();
  $('hhmm').textContent = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  $('ss').textContent = d.toLocaleTimeString('pt-BR', { second: '2-digit' }).padStart(2, '0');
  const dt = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  $('data').textContent = dt.charAt(0).toUpperCase() + dt.slice(1);
  if (S.expira > 0) { S.expira -= 1; $('qrfill').style.width = Math.max(0, S.expira / 40 * 100) + '%'; if (S.expira <= 1) atualizar(); }
  if (d.getSeconds() === 0) { desenharSol(); pintarFase(); }
}
const WMO = c => c === 0 ? ['Céu limpo', 'sol'] : c <= 2 ? ['Parcialmente nublado', 'solnuvem'] : c === 3 ? ['Nublado', 'nuvem'] : c <= 48 ? ['Neblina', 'neblina']
  : c <= 57 ? ['Garoa', 'chuva'] : c <= 67 ? ['Chuva', 'chuva'] : c <= 82 ? ['Pancadas de chuva', 'chuva'] : c <= 99 ? ['Tempestade', 'raio'] : ['—', 'nuvem'];
const ICONES = {
  sol: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.4"/><path stroke-linecap="round" d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2L19 19M19 5l-1.8 1.8M6.8 17.2L5 19"/></svg>',
  solnuvem: '<svg viewBox="0 0 24 24"><circle cx="8.5" cy="8" r="3.1"/><path stroke-linejoin="round" d="M8 20h9.4a3.4 3.4 0 0 0 .5-6.8A5 5 0 0 0 8.4 14 3.4 3.4 0 0 0 8 20z"/></svg>',
  nuvem: '<svg viewBox="0 0 24 24"><path stroke-linejoin="round" d="M7 19h10.6a3.7 3.7 0 0 0 .6-7.4A5.4 5.4 0 0 0 7.5 10 4.3 4.3 0 0 0 7 19z"/></svg>',
  neblina: '<svg viewBox="0 0 24 24"><path stroke-linecap="round" d="M4 9h16M6 13h13M4 17h14"/></svg>',
  chuva: '<svg viewBox="0 0 24 24"><path stroke-linejoin="round" d="M7 15h10.6a3.7 3.7 0 0 0 .6-7.4A5.4 5.4 0 0 0 7.5 6 4.3 4.3 0 0 0 7 15z"/><path stroke-linecap="round" d="M8.5 18l-1 2.6M12.5 18l-1 2.6M16.5 18l-1 2.6"/></svg>',
  raio: '<svg viewBox="0 0 24 24"><path stroke-linejoin="round" d="M7 14h10.6a3.7 3.7 0 0 0 .6-7.4A5.4 5.4 0 0 0 7.5 5 4.3 4.3 0 0 0 7 14z"/><path stroke-linejoin="round" d="M12.5 15.5 10 20h3l-1.4 3.6"/></svg>'
};
async function atualizarTempo() {
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.LAT}&longitude=${CONFIG.LON}&current=temperature_2m,apparent_temperature,precipitation,weather_code&daily=temperature_2m_max,temperature_2m_min,sunrise,sunset&timezone=America%2FSao_Paulo`;
    const j = await (await fetch(u)).json(), c = j.current, d = j.daily;
    $('wtemp').textContent = Math.round(c.temperature_2m) + '°';
    $('wfeel').textContent = Math.round(c.apparent_temperature) + '°';
    $('wprec').textContent = (Number(c.precipitation) || 0).toFixed(1).replace('.', ',') + ' mm';
    $('wmax').textContent = Math.round(d.temperature_2m_max[0]) + '°'; $('wmin').textContent = Math.round(d.temperature_2m_min[0]) + '°';
    const [desc, ic] = WMO(c.weather_code); $('wdesc').textContent = desc; $('wicone').innerHTML = ICONES[ic];
    S.sunrise = new Date(d.sunrise[0]); S.sunset = new Date(d.sunset[0]);
    const hm = x => x.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    $('nascer').textContent = hm(S.sunrise); $('poente').textContent = hm(S.sunset);
    desenharSol(); pintarFase();
  } catch (e) { /* mantém o último estado */ }
}
const bez = (t, a, b, c) => { const u = 1 - t; return { x: u * u * a.x + 2 * u * t * b.x + t * t * c.x, y: u * u * a.y + 2 * u * t * b.y + t * t * c.y }; };
function desenharSol() {
  const P0 = { x: 24, y: 112 }, P1 = { x: 200, y: -40 }, P2 = { x: 376, y: 112 };
  const trecho = n => { let d = 'M' + P0.x + ' ' + P0.y; for (let i = 1; i <= n; i++) { const p = bez(i / n, P0, P1, P2); d += ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`; } return d; };
  let sol = '', trilha = '', msg = '';
  if (S.sunrise && S.sunset) {
    const agora = new Date(), t = (agora - S.sunrise) / (S.sunset - S.sunrise);
    if (t >= 0 && t <= 1) {
      let tr = 'M' + P0.x + ' ' + P0.y; const n = Math.max(1, Math.round(40 * t));
      for (let i = 1; i <= n; i++) { const p = bez(i / n * t, P0, P1, P2); tr += ` L${p.x.toFixed(1)} ${p.y.toFixed(1)}`; }
      trilha = `<path d="${tr}" fill="none" stroke="var(--synapse)" stroke-width="2" stroke-linecap="round" opacity=".85"/>`;
      const s = bez(t, P0, P1, P2);
      sol = `<circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="7" fill="var(--synapse)"/><circle cx="${s.x.toFixed(1)}" cy="${s.y.toFixed(1)}" r="12" fill="var(--synapse)" opacity=".18"/>`;
      const r = Math.max(0, S.sunset - agora), h = Math.floor(r / 3.6e6), m = Math.round(r % 3.6e6 / 6e4);
      msg = `Pôr do sol em ${h > 0 ? h + 'h ' : ''}${m}min`;
    } else msg = agora < S.sunrise ? 'Antes do nascer do sol' : 'Depois do pôr do sol';
  }
  $('solmsg').textContent = msg;
  $('solarsvg').innerHTML = `<line x1="14" y1="112" x2="386" y2="112" stroke="rgba(232,237,235,.16)"/><path d="${trecho(40)}" fill="none" stroke="rgba(232,237,235,.22)" stroke-width="1.6" stroke-dasharray="3 6" stroke-linecap="round"/>${trilha}${sol}`;
}

/* ---------- avatares ---------- */
const letras = n => String(n || '?').trim().split(/\s+/).map(p => p[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const EXTS = ['jpg', 'jpeg', 'png', 'webp'];
function fotoErro(img) {
  const i = Number(img.dataset.ext || 0) + 1, reg = img.dataset.reg;
  if (reg && i < EXTS.length) { img.dataset.ext = i; img.src = CONFIG.FOTOS_BASE + reg + '.' + EXTS[i]; } else img.remove();
}
function avatar(m, px) {
  const u = m.foto_url || (m.registro != null ? CONFIG.FOTOS_BASE + m.registro + '.jpg' : null);
  const cascata = !m.foto_url && m.registro != null ? ` data-reg="${m.registro}" data-ext="0"` : '';
  return `<span class="avk" style="width:${px}rem;height:${px}rem;font-size:${px * .36}rem">${esc(letras(m.nome))}${u ? `<img src="${esc(u)}" alt=""${cascata} onerror="fotoErro(this)">` : ''}</span>`;
}
const abrevia = d => { d = (d || '').toLowerCase(); return !d ? '' : d.includes('diretoria') ? 'DIR' : d.includes('market') ? 'MKT' : d.includes('rela') ? 'REL'
  : /p&d|pesquisa|desenvolv/.test(d) ? 'P&D' : /clín|clin/.test(d) ? 'CLI' : d.slice(0, 3).toUpperCase(); };

/* ---------- widgets que giram ---------- */
const cadeia = n => `<div class="cadeia">${'<i></i>'.repeat(Math.min(n, 16))}</div>`;
const ticks = (v, max) => `<span class="ticks"><i style="--p:${Math.min(100, v / Math.max(1, max) * 100)}%"></i></span>`;
function widget(el, { rot, interval, slides }) {
  const w = { el, rot, interval, slides, i: -1, timer: null, p: null };
  w.mostrar = () => {
    const vivos = w.slides.map(s => ({ s, html: s.render() })).filter(x => x.html).slice(0, 4);
    if (!vivos.length) { el.hidden = true; return; }
    el.hidden = false;
    w.i = (w.i + 1) % vivos.length;
    const { s, html } = vivos[w.i];
    el.className = 'widget ' + el.dataset.base + (s.familia ? ' fam f-' + s.familia : '');
    el.innerHTML = `<header><span class="w-rot">${esc(s.rot)}</span>${s.meta ? `<span class="w-meta">${esc(s.meta())}</span>` : ''}
      <span class="w-passos">${vivos.map((_, k) => `<span><i style="--p:${k < w.i ? 100 : 0}%"></i></span>`).join('')}</span></header>
      <div class="w-corpo">${html}</div>`;
    const barra = el.querySelectorAll('.w-passos i')[w.i];
    if (barra && !reduz) { barra.style.transition = `width ${w.interval}s linear`; requestAnimationFrame(() => requestAnimationFrame(() => barra.style.setProperty('--p', '100%'))); }
    else if (barra) barra.style.setProperty('--p', '100%');
    clearTimeout(w.timer);
    if (!reduz && vivos.length > 1) w.timer = setTimeout(w.mostrar, w.interval * 1000);
  };
  el.dataset.base = [...el.classList].filter(c => c !== 'widget' && !c.startsWith('fam') && !c.startsWith('f-')).join(' ');
  return w;
}
const hoje = () => (S.estado && S.estado.eventos_hoje) || [];
const horaMin = h => { const m = /(\d+):(\d+)/.exec(h || ''); return m ? +m[1] * 60 + +m[2] : null; };
function agendaSlide() {
  return { rot: 'Agenda do LABBIO', meta: () => new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), render() {
    const ev = hoje(); if (!ev.length) return null;
    const agora = new Date().getHours() * 60 + new Date().getMinutes();
    return `<div class="ag">${ev.slice(0, 6).map(e => {
      const fim = horaMin(e.fim), passou = fim != null && fim < agora && !e.em_andamento;
      return `<div class="ag-i ${e.em_andamento ? 'agora' : ''} ${passou ? 'passou' : ''}"><div class="h">${esc(e.inicio || '—')}<small>${esc(e.fim || '')}</small></div>
        <div><div class="tt">${esc(e.titulo)}</div><div class="mm">${esc(e.espaco || '')}${e.espaco ? ', ' : ''}${e.confirmados} confirmado${e.confirmados === 1 ? '' : 's'}</div></div>
        ${e.em_andamento ? '<span class="pill-agora"><i></i>agora</span>' : ''}</div>`; }).join('')}</div>`; } };
}
function proximoSlide() {
  return { rot: 'Próximo evento', render() {
    const agora = new Date().getHours() * 60 + new Date().getMinutes();
    const e = hoje().find(x => !x.em_andamento && horaMin(x.inicio) != null && horaMin(x.inicio) > agora) || hoje().find(x => x.em_andamento);
    if (!e) return null;
    return `<div class="destaque"><span class="quando">${esc(e.inicio || '')}${e.fim ? ', até ' + esc(e.fim) : ''}</span><h3>${esc(e.titulo)}</h3>
      <p>${esc(e.espaco || '')}${e.espaco ? ', ' : ''}${e.confirmados} confirmado${e.confirmados === 1 ? '' : 's'}</p></div>`; } };
}
function avisoSlide() {
  return { rot: 'Aviso', familia: 'retina', render() {
    const a = S.painel && (S.painel.avisos || [])[0]; if (!a) return null;
    return `<div class="destaque"><h3>${esc(a.titulo)}</h3>${a.corpo ? `<p>${esc(a.corpo)}</p>` : ''}</div>`; } };
}
function placarSlide() {
  return { rot: 'Placar do mês', familia: 'lumen', meta: () => 'dias presentes', render() {
    const r = S.placar && S.placar.ranking || []; if (!r.length) return null;
    const max = Math.max(...r.map(x => x.dias), 1);
    return `<div class="rank">${r.slice(0, 5).map((x, k) => `<span class="k">${k + 1}</span>${avatar(x, 2.2)}<span class="nm">${esc(x.nome)}</span>${ticks(x.dias, max)}<span class="v">${x.dias}</span>`).join('')}</div>`; } };
}
function sequenciasSlide() {
  return { rot: 'Sequências', familia: 'lumen', meta: () => 'dias úteis seguidos', render() {
    const r = S.placar && S.placar.sequencias || []; if (!r.length) return null;
    return `<div class="seq">${r.slice(0, 4).map(x => `<div class="seq-l">${avatar(x, 2.2)}<span class="nm">${esc(x.nome)}</span><span class="dias">${x.atual}</span>${cadeia(x.atual)}</div>`).join('')}</div>`; } };
}
function laboratorioSlide() {
  return { rot: 'Laboratório agora', render() {
    const p = S.estado && S.estado.presentes || []; if (!p.length) return null;
    const por = {}; p.forEach(x => { const a = abrevia(x && x.departamento); if (a) por[a] = (por[a] || 0) + 1; });
    const linhas = Object.entries(por).sort((a, b) => b[1] - a[1]).slice(0, 4);
    return `<div class="lab"><div><div class="num-g">${p.length}</div><div>${p.length === 1 ? 'pessoa' : 'pessoas'} no laboratório</div></div>
      <div class="areas">${linhas.map(([a, n]) => `<div><span>${esc(a)}</span>${ticks(n, p.length)}<span class="v">${n}</span></div>`).join('')}</div></div>`; } };
}
function boasVindasSlide() {
  return { rot: 'Boas-vindas', familia: 'neuron', render() {
    const n = S.painel && S.painel.novos || []; if (!n.length) return null;
    return `<div class="destaque"><h3>${n.length === 1 ? 'Uma pessoa chegou' : n.length + ' pessoas chegaram'} ao time este mês</h3>
      <div class="avs">${n.slice(0, 6).map(m => avatar(m, 3)).join('')}</div><p>${n.slice(0, 3).map(m => esc(String(m.nome || '').split(' ')[0])).join(', ')}</p></div>`; } };
}
const widgets = [
  widget($('r1'), { interval: 12, slides: [laboratorioSlide(), sequenciasSlide(), boasVindasSlide()] }),
  widget($('r2'), { interval: 14, slides: [agendaSlide(), proximoSlide(), avisoSlide(), placarSlide()] })
];
const redesenhar = () => widgets.forEach(w => { w.i = -1; w.mostrar(); });

/* ---------- a coluna do check-in ---------- */
function desenharUltimos(ultimos, presentes) {
  $('presn').textContent = (presentes || []).length;
  $('ultimos').innerHTML = !ultimos || !ultimos.length ? '<div class="vazio-w">Nenhum check-in hoje ainda.</div>'
    : ultimos.map(c => `<div class="ck">${avatar(c, 2.1)}<span><span class="cn" style="display:block">${esc(c.nome)}</span>${abrevia(c.departamento) ? `<span class="cs">${esc(abrevia(c.departamento))}</span>` : ''}</span><span class="h">${esc(c.hora)}</span></div>`).join('');
}
function online(ok) {
  $('qrwrap').style.display = ok ? '' : 'none'; $('qroff').style.display = ok ? 'none' : 'block';
  $('vivotxt').textContent = ok ? 'ao vivo' : 'offline'; $('vivo').classList.toggle('off', !ok);
  if (!ok) S.token = null;
}
let qr = null;
async function atualizar() {
  try {
    const { data, error } = await sb.rpc('quiosque_estado_conta');
    if (error) throw error;
    if (data && data.status && data.status !== 'ok') throw Object.assign(new Error(data.status), { status: 401 });
    online(true); S.estado = data;
    S.expira = data.expira_em; $('qrfill').style.width = S.expira / 40 * 100 + '%';
    if (data.token !== S.token) {
      S.token = data.token; const url = CONFIG.APP_URL + '?t=' + S.token;
      if (window.QRCode) { if (!qr) qr = new QRCode($('qrbox'), { text: url, width: 420, height: 420, colorDark: token('--cortex-dark'), colorLight: token('--paper'), correctLevel: QRCode.CorrectLevel.M }); else { qr.clear(); qr.makeCode(url); } }
    }
    desenharUltimos(data.ultimos_checkins, data.presentes);
    if (S.visto === undefined) S.visto = data.ultimo_evento ? data.ultimo_evento.presenca_id : null;
    else if (data.ultimo_evento && data.ultimo_evento.presenca_id !== S.visto) { S.visto = data.ultimo_evento.presenca_id; chegada(data.ultimo_evento); }
    if (!S.rodando) { S.rodando = true; redesenhar(); }
  } catch (e) {
    if (semSessao(e)) { online(false); S.rodando = false; return mostrarEntrada('A sessão do quiosque terminou. Entre de novo com a conta do quiosque.'); }
    online(false);
  }
}
async function lerPlacar() {
  try { const { data } = await sb.rpc('labbio_placar', { p_limite: 10 }); if (data) { S.placar = data; if (S.rodando) redesenhar(); } } catch (e) { /* mantém o último */ }
}
async function lerPainel() {
  try { const { data, error } = await sb.rpc('quiosque_painel'); if (!error && data && !data.status) { S.painel = data; if (S.rodando) redesenhar(); } } catch (e) { /* o painel é opcional */ }
}

/* ---------- a chegada: o momento do check-in ---------- */
let chegadaTimer = null;
function chegada(ev) {
  const seq = ((S.placar && S.placar.sequencias) || []).find(s => s.registro === ev.registro);
  $('chegada').innerHTML = `<span class="rot">Chegada registrada</span>${avatar(ev, 11.25)}<h2>Bem-vindo, ${esc(String(ev.nome || '').split(' ')[0])}!</h2>
    ${ev.departamento ? `<div class="area">${esc(ev.departamento)}</div>` : ''}
    <div class="info"><b>${esc(ev.visitas_mes)}ª visita</b> em ${esc(new Date().toLocaleDateString('pt-BR', { month: 'long' }))}<br>${ev.anterior ? 'Último check-in: ' + esc(ev.anterior) : 'Primeira visita registrada'}</div>
    ${seq && seq.atual > 1 ? `${cadeia(seq.atual)}<div class="info">${seq.atual} dias úteis seguidos</div>` : ''}`;
  const w = $('chegada'); clearTimeout(chegadaTimer); w.classList.add('on');
  requestAnimationFrame(() => w.classList.add('vis'));
  chegadaTimer = setTimeout(() => { w.classList.remove('vis'); setTimeout(() => w.classList.remove('on'), reduz ? 0 : 500); }, 8000);
}

/* ---------- modo quiosque: o cursor some quando parado ---------- */
let cursorTimer;
document.addEventListener('mousemove', () => { document.body.classList.add('cursor'); clearTimeout(cursorTimer); cursorTimer = setTimeout(() => document.body.classList.remove('cursor'), 3000); });

function iniciar() {
  atualizar(); lerPlacar(); lerPainel();
  if (!iniciar.feito) {
    iniciar.feito = true;
    setInterval(atualizar, 6000); setInterval(lerPlacar, 5 * 6e4); setInterval(lerPainel, 5 * 6e4);
    setInterval(tick, 1000); setInterval(atualizarTempo, 15 * 6e4);
    tick(); atualizarTempo(); desenharSol(); pintarFase();
  }
}
boot();
