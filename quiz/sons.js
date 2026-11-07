/* ============================================================
   NeuroQuiz · o som da TV
   Tudo sintetizado aqui, com a Web Audio API: nenhuma faixa gravada,
   nenhum arquivo. As trilhas e os efeitos são composições próprias
   que fazem o papel de sempre num quiz de auditório: o lobby, a
   contagem (que aperta nos últimos 5 segundos), o gongo do fim do
   tempo, a revelação, o placar, o rufar e a fanfarra do pódio.
   Só a TV toca. O navegador só libera o som depois de um toque ou
   tecla: a TV liga no primeiro clique ou espaço.
   ============================================================ */
window.NQSom = (() => {
  'use strict';
  let ctx = null, mestre = null, ruido = null, mudo = false;
  let atual = null;            // a trilha que toca: { nome, passo, bpm, i, prox, extra }
  let relogio = null;

  function ligar() {
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14; comp.ratio.value = 3;
        mestre = ctx.createGain(); mestre.gain.value = mudo ? 0 : 0.8;
        mestre.connect(comp); comp.connect(ctx.destination);
        ruido = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const d = ruido.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { /* sem áudio: o jogo segue mudo */ }
    return !!ctx;
  }
  const pronto = () => ctx && ctx.state === 'running';

  /* ---------- instrumentos --------------------------------- */
  const hz = n => 440 * Math.pow(2, (n - 69) / 12);          // nota MIDI → Hz
  function nota(t, midi, dur, o = {}) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.tipo || 'triangle';
    osc.frequency.setValueAtTime(hz(midi), t);
    if (o.desafina) osc.detune.value = o.desafina;
    const v = o.vol ?? 0.18, a = o.ataque ?? 0.005, s = o.solta ?? 0.12;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.setValueAtTime(v, t + Math.max(a, dur - s));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let fim = g;
    if (o.filtro) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.filtro; f.Q.value = o.q || 0.7;
      osc.connect(f); f.connect(g); } else osc.connect(g);
    fim.connect(mestre);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function bumbo(t, v = 0.55) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.frequency.setValueAtTime(140, t); osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g); g.connect(mestre); osc.start(t); osc.stop(t + 0.25);
  }
  function chiado(t, dur, v, tipo, freq, q = 1) {
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = ruido; f.type = tipo; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(mestre); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  const chimbal = (t, v = 0.07) => chiado(t, 0.045, v, 'highpass', 7500);
  const caixa = (t, v = 0.22) => { chiado(t, 0.14, v, 'bandpass', 1900, 0.8); nota(t, 50, 0.08, { tipo: 'triangle', vol: v * 0.5, solta: 0.06 }); };
  const prato = (t, v = 0.22) => chiado(t, 1.6, v, 'highpass', 5200, 0.5);

  /* ---------- as trilhas (compasso de 16 semicolcheias) ---- */
  // Lobby: Ré maior, leve, I – vi – IV – V, arpejo e baixo.
  const LOBBY = { bpm: 116, acordes: [[62, 66, 69, 73], [59, 62, 66, 69], [55, 59, 62, 66], [57, 61, 64, 69]],
    passo(i, t, dt) {
      const c = this.acordes[Math.floor(i / 16) % 4], s = i % 16;
      if (s % 4 === 0) bumbo(t, s === 0 ? 0.5 : 0.35);
      if (s % 4 === 2) chimbal(t, 0.06);
      if (s === 4 || s === 12) caixa(t, 0.12);
      if (s % 8 === 0) nota(t, c[0] - 24, dt * 3.5, { tipo: 'sawtooth', vol: 0.12, filtro: 420 });
      if (s % 2 === 0) nota(t, c[[0, 1, 2, 3, 2, 1, 3, 2][(s / 2) % 8]] + 12, dt * 1.6, { tipo: 'triangle', vol: 0.09, solta: 0.08 });
      if (s === 14 && Math.floor(i / 16) % 4 === 3) nota(t, 81, dt * 2, { tipo: 'square', vol: 0.04, filtro: 2400 });
    } };
  // Pergunta: Lá menor, ostinato que pulsa; nos últimos 5 s, dobra e sobe.
  const PERGUNTA = { bpm: 132, notas: [57, 60, 64, 57, 62, 65, 57, 64],
    passo(i, t, dt) {
      const s = i % 16, tenso = this.extra?.tenso;
      if (s % 4 === 0) bumbo(t, 0.42);
      if (s % 2 === 1 || tenso) chimbal(t, tenso ? 0.09 : 0.05);
      if (s % 2 === 0) nota(t, this.notas[(i / 2) % 8 | 0] - 12 + (tenso ? 12 : 0), dt * 1.2,
        { tipo: 'square', vol: 0.06, filtro: tenso ? 2600 : 1300, solta: 0.05 });
      if (s === 0) nota(t, 45, dt * 15, { tipo: 'sawtooth', vol: 0.09, filtro: 300 });
    } };
  // Placar: Fá maior, balanço tranquilo.
  const PLACAR = { bpm: 100, acordes: [[65, 69, 72], [62, 65, 69], [58, 62, 65], [60, 64, 67]],
    passo(i, t, dt) {
      const c = this.acordes[Math.floor(i / 16) % 4], s = i % 16;
      if (s === 0 || s === 10) bumbo(t, 0.4);
      if (s === 4 || s === 12) caixa(t, 0.1);
      if (s % 4 === 2) chimbal(t, 0.05);
      if (s === 0 || s === 6 || s === 12) c.forEach(n => nota(t, n, dt * 3, { tipo: 'triangle', vol: 0.055 }));
      if (s % 4 === 0) nota(t, c[0] - 24, dt * 3, { tipo: 'sine', vol: 0.18 });
    } };
  const TRILHAS = { lobby: LOBBY, pergunta: PERGUNTA, placar: PLACAR };

  function tocar(nome, extra) {
    if (!ligar()) return;
    if (atual && atual.nome === nome) { atual.extra = Object.assign(atual.extra || {}, extra); return; }
    parar();
    const tr = TRILHAS[nome]; if (!tr) return;
    atual = Object.assign(Object.create(tr), { nome, i: 0, prox: ctx.currentTime + 0.08, extra: extra || {} });
    relogio = setInterval(agenda, 25);
  }
  function agenda() {
    if (!atual || !pronto()) return;
    const dt = 60 / atual.bpm / 4;
    while (atual.prox < ctx.currentTime + 0.12) {
      try { atual.passo(atual.i, atual.prox, dt); } catch (e) { /* uma nota a menos */ }
      atual.i++; atual.prox += dt;
    }
  }
  function parar() { clearInterval(relogio); relogio = null; atual = null; }
  function tenso(b) { if (atual && atual.nome === 'pergunta') atual.extra.tenso = !!b; }

  /* ---------- os efeitos ----------------------------------- */
  const EF = {
    entrou(t) { nota(t, 84, 0.09, { tipo: 'sine', vol: 0.12 }); nota(t + 0.06, 91, 0.12, { tipo: 'sine', vol: 0.1 }); },
    tique(t) { nota(t, 96, 0.05, { tipo: 'square', vol: 0.06, filtro: 4000, solta: 0.03 }); },
    tiqueAgudo(t) { nota(t, 100, 0.07, { tipo: 'square', vol: 0.1, filtro: 5000, solta: 0.04 }); },
    vinheta(t) { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      s.buffer = ruido; f.type = 'bandpass'; f.Q.value = 2; f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(6000, t + 0.5);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      s.connect(f); f.connect(g); g.connect(mestre); s.start(t); s.stop(t + 0.62);
      nota(t + 0.5, 74, 0.25, { tipo: 'triangle', vol: 0.15 }); nota(t + 0.5, 81, 0.35, { tipo: 'triangle', vol: 0.12 }); },
    gongo(t) { [[48, 0.35], [55.2, 0.18], [60.4, 0.12], [64.1, 0.08], [70.7, 0.05]].forEach(([n, v]) =>
      nota(t, n, 2.6, { tipo: 'sine', vol: v, ataque: 0.003, solta: 2.4 })); chiado(t, 0.3, 0.12, 'lowpass', 900); },
    revela(t) { [60, 64, 67, 72].forEach((n, k) => nota(t + k * 0.07, n + 12, 0.5 - k * 0.05, { tipo: 'triangle', vol: 0.13 }));
      prato(t + 0.28, 0.1); },
    destrava(t) { nota(t, 76, 0.18, { tipo: 'sine', vol: 0.1 }); nota(t + 0.12, 83, 0.4, { tipo: 'sine', vol: 0.12 }); chiado(t, 0.5, 0.05, 'highpass', 3000); },
    rufar(t, dur = 3) { let x = 0; while (x < dur) { const r = x / dur; caixa(t + x, 0.06 + 0.16 * r); x += 0.11 - 0.075 * r; } },
    fanfarra(t) { const b = 0.16;
      [[60, 0], [64, 1], [67, 2], [72, 3], [67, 4.5], [72, 5], [76, 6]].forEach(([n, k]) => {
        nota(t + k * b, n, b * (k === 6 ? 6 : 1.4), { tipo: 'sawtooth', vol: 0.09, filtro: 2200, ataque: 0.02 });
        nota(t + k * b, n - 12, b * (k === 6 ? 6 : 1.4), { tipo: 'square', vol: 0.05, filtro: 1200, ataque: 0.02 }); });
      bumbo(t + 6 * b, 0.6); prato(t + 6 * b, 0.25); [72, 76, 79, 84].forEach(n => nota(t + 6 * b, n, 1.6, { tipo: 'triangle', vol: 0.06, solta: 1.2 })); },
    fim(t) { [72, 67, 64, 60].forEach((n, k) => nota(t + k * 0.09, n, 0.4, { tipo: 'triangle', vol: 0.1 })); }
  };
  function efeito(nome, ...a) { if (!ligar() || !EF[nome]) return; try { EF[nome](ctx.currentTime + 0.02, ...a); } catch (e) { /* mudo */ } }

  function definirMudo(b) { mudo = !!b; if (mestre) mestre.gain.setTargetAtTime(mudo ? 0 : 0.8, ctx.currentTime, 0.05); }
  return { ligar, pronto, tocar, parar, tenso, efeito, definirMudo, mudo: () => mudo };
})();
