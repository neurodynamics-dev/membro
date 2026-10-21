/* ============================================================
   MÓDULO · VERIFICAÇÃO DA FOTO (2.19.2), do pedido de acesso ao LABBIO
   Antes de tirar a foto, o celular confere quatro coisas, ao vivo:
     1. rosto: há um (e só um) rosto na imagem;
     2. margem: ele está dentro do oval, centralizado e do tamanho certo;
     3. luz: nem escuro, nem estourado, nem de um lado só, nem contraluz;
     4. contraste: a pessoa se distingue do fundo.
   Tudo roda no aparelho (MediaPipe, em vendor/mediapipe): a imagem não
   sai dele. É uma conferência básica para ajudar quem tira a foto, não
   uma garantia: o Pessoal e o LABBIO ainda analisam o pedido.
   O envio de arquivo não passa por aqui (é sem verificação).

   Depende de mod-biometria.js (bio, bioParar) e da casca ($, esc).
   Para testes: window.__bioDetector = { detect(canvas) } no lugar do modelo.
   ============================================================ */

/* o oval guia (soma.css .bio-guia, inset 10% 22%) e os limites de cada conferência */
const BIO_LIM = {
  larguraMin: 0.28, larguraMax: 0.58,   // largura do rosto, em partes do quadrado
  desvioX: 0.10, desvioY: 0.12,         // quanto o centro do rosto pode sair do centro
  lumMin: 60, lumMax: 215,              // luz média do rosto (0 a 255)
  estourado: 0.15,                      // parte do rosto acima de 245 (branco puro)
  lado: 0.38,                           // diferença entre a metade esquerda e a direita
  contraluz: 60,                        // fundo mais claro que o rosto por mais que isto
  contraste: 30                         // distância de cor entre o rosto e o fundo (RGB)
};
const BIO_TAM = 320;                    // lado do quadrado analisado

const BIO_ITENS = [['rosto', 'Rosto'], ['margem', 'Enquadramento'], ['luz', 'Iluminação'], ['contraste', 'Contraste com o fundo']];

/* o detector (carrega uma vez; falhou, devolve o erro e quem chama segue sem verificação) */
let _bioDet = null;
function bioDetector(){
  if (window.__bioDetector) return Promise.resolve(window.__bioDetector);
  if (!_bioDet){
    _bioDet = (async () => {
      const base = new URL('vendor/mediapipe/', document.baseURI).href;
      const m = await import(base + 'vision_bundle.mjs');
      const fs = await m.FilesetResolver.forVisionTasks(base + 'wasm');
      return m.FaceDetector.createFromOptions(fs, {
        baseOptions: { modelAssetPath: base + 'blaze_face_short_range.tflite', delegate: 'CPU' },
        runningMode: 'IMAGE', minDetectionConfidence: 0.6 });
    })();
    _bioDet.catch(() => { _bioDet = null; });
  }
  return _bioDet;
}

/* o quadrado central do vídeo (o mesmo recorte que a foto salva), pequeno, para analisar */
function bioAmostra(origem, w, h){
  const c = bioAmostra.c || (bioAmostra.c = document.createElement('canvas'));
  c.width = c.height = BIO_TAM;
  const l = Math.min(w, h), x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(origem, (w - l) / 2, (h - l) / 2, l, l, 0, 0, BIO_TAM, BIO_TAM);
  return c;
}
/* os rostos como caixas de 0 a 1 sobre o quadrado */
async function bioRostos(det, cv){
  const r = det.detect(cv), W = cv.width, H = cv.height;
  return (r?.detections || []).map(d => { const b = d.boundingBox;
    return { x: b.originX / W, y: b.originY / H, w: b.width / W, h: b.height / H }; });
}
const bioLuma = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;

/* médias de uma região (fração do quadrado) */
function bioRegiao(cv, x0, y0, x1, y1){
  const W = cv.width, H = cv.height, ctx = cv.getContext('2d', { willReadFrequently: true });
  const px = Math.max(0, Math.round(x0 * W)), py = Math.max(0, Math.round(y0 * H));
  const pw = Math.max(1, Math.min(W, Math.round(x1 * W)) - px), ph = Math.max(1, Math.min(H, Math.round(y1 * H)) - py);
  const d = ctx.getImageData(px, py, pw, ph).data; let r = 0, g = 0, b = 0, n = 0, claro = 0;
  for (let i = 0; i < d.length; i += 4){ r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; if (bioLuma(d[i], d[i + 1], d[i + 2]) > 245) claro++; }
  return { r: r / n, g: g / n, b: b / n, l: bioLuma(r / n, g / n, b / n), claro: claro / n };
}

/* a conferência: caixas dos rostos + o quadrado → { ok, itens:[{k, rot, ok:true|false|null, txt}] } */
function bioAvaliar(cv, rostos){
  const L = BIO_LIM, itens = BIO_ITENS.map(([k, rot]) => ({ k, rot, ok: null, txt: '' })), medidas = {};
  const it = k => itens.find(i => i.k === k), marca = (k, ok, txt) => { const i = it(k); i.ok = ok; i.txt = txt; };
  if (rostos.length !== 1){
    marca('rosto', false, rostos.length ? 'Há mais de um rosto. Só você deve aparecer.' : 'Não achamos um rosto. Olhe para a câmera, de frente.');
    return { ok: false, itens, medidas };
  }
  marca('rosto', true, 'Rosto encontrado.');
  const b = rostos[0], cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  Object.assign(medidas, { largura: b.w, cx, cy });

  /* enquadramento: tamanho primeiro (é o que a pessoa corrige com o corpo), depois o centro */
  if (b.w < L.larguraMin) marca('margem', false, 'Aproxime-se: o rosto está pequeno no oval.');
  else if (b.w > L.larguraMax) marca('margem', false, 'Afaste-se: o rosto passa do oval.');
  else if (Math.abs(cx - 0.5) > L.desvioX || Math.abs(cy - 0.5) > L.desvioY || b.x < 0.2 || b.x + b.w > 0.8 || b.y < 0.08 || b.y + b.h > 0.92)
    marca('margem', false, 'Centralize o rosto dentro do oval.');
  else marca('margem', true, 'Rosto dentro do oval.');

  /* luz e contraste olham o rosto sem os cantos (cabelo e fundo entram pouco) */
  const fx0 = b.x + b.w * 0.15, fx1 = b.x + b.w * 0.85, fy0 = b.y + b.h * 0.2, fy1 = b.y + b.h * 0.9, fxm = (fx0 + fx1) / 2;
  const rosto = bioRegiao(cv, fx0, fy0, fx1, fy1), esq = bioRegiao(cv, fx0, fy0, fxm, fy1), dir = bioRegiao(cv, fxm, fy0, fx1, fy1);
  /* o fundo: as faixas dos lados e do alto, longe do corpo */
  const ps = [bioRegiao(cv, 0, 0, 0.12, 0.6), bioRegiao(cv, 0.88, 0, 1, 0.6), bioRegiao(cv, 0, 0, 1, 0.06)];
  const fundo = { r: (ps[0].r + ps[1].r + ps[2].r) / 3, g: (ps[0].g + ps[1].g + ps[2].g) / 3, b: (ps[0].b + ps[1].b + ps[2].b) / 3 };
  fundo.l = bioLuma(fundo.r, fundo.g, fundo.b);
  Object.assign(medidas, { lumRosto: rosto.l, lumFundo: fundo.l, estourado: rosto.claro, lado: Math.abs(esq.l - dir.l) / Math.max(esq.l, dir.l, 1) });

  if (fundo.l - rosto.l > L.contraluz && rosto.l < 110) marca('luz', false, 'Contraluz: a luz está atrás de você. Fique de frente para a luz.');
  else if (rosto.l < L.lumMin) marca('luz', false, 'Pouca luz no rosto. Vá para um lugar mais claro.');
  else if (rosto.l > L.lumMax || rosto.claro > L.estourado) marca('luz', false, 'Luz forte demais: o rosto está estourado. Afaste-se da luz direta.');
  else if (Math.abs(esq.l - dir.l) / Math.max(esq.l, dir.l, 1) > L.lado) marca('luz', false, 'A luz bate só de um lado. Fique de frente para ela.');
  else marca('luz', true, 'Boa iluminação.');

  const dist = Math.hypot(rosto.r - fundo.r, rosto.g - fundo.g, rosto.b - fundo.b); medidas.contraste = dist;
  if (dist < L.contraste) marca('contraste', false, 'O fundo é parecido com você. Procure uma parede lisa e clara.');
  else marca('contraste', true, 'Bom contraste com o fundo.');

  return { ok: itens.every(i => i.ok === true), itens, medidas };
}

/* a lista na tela */
const BIO_ICO = { true: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 12.75l6 6 9-13.5"/></svg>',
  false: '<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  null: '<span class="bio-ponto" aria-hidden="true"></span>' };
function bioChecklistHTML(){
  return `<ul class="bio-checks" id="bio-checks" aria-label="Verificação da foto">${BIO_ITENS.map(([k, rot]) =>
    `<li data-k="${k}" class="pend"><span class="bio-ico">${BIO_ICO.null}</span><span class="tx"><b>${esc(rot)}</b><span class="bio-msg"></span></span></li>`).join('')}</ul>`;
}
function bioMostrar(res, nota){
  const ul = $('#bio-checks'); if (!ul) return;
  (res?.itens || BIO_ITENS.map(([k, rot]) => ({ k, rot, ok: null, txt: '' }))).forEach(i => {
    const li = ul.querySelector(`[data-k="${i.k}"]`); if (!li) return;
    li.className = i.ok === true ? 'ok' : i.ok === false ? 'falha' : 'pend';
    li.querySelector('.bio-ico').innerHTML = BIO_ICO[i.ok];
    li.querySelector(".bio-msg").textContent = i.txt || '';
  });
  const n = $('#bio-verif-nota'); if (n) n.textContent = nota || '';
  $('#bio-cena')?.classList.toggle('ok', !!res?.ok);   // o oval fica cheio e verde quando tudo serve
}

/* o laço ao vivo: a cada 250 ms, e o botão só abre depois de três conferências boas seguidas */
async function bioVerificar(){
  const id = ++bio.vez;
  const botao = $('#bio-tirar'); if (botao) botao.disabled = true;
  bioMostrar(null, 'Preparando a verificação…');
  let det;
  try { det = await bioDetector(); }
  catch(e){
    if (id !== bio.vez) return;
    bio.semVerificacao = true; bioMostrar(null, 'Não foi possível ligar a verificação automática neste aparelho. Confira os requisitos ao lado e tire a foto: o Pessoal e o LABBIO analisam o pedido.');
    const b = $('#bio-tirar'); if (b) b.disabled = false;
    return;
  }
  let boas = 0;
  const passo = async () => {
    if (id !== bio.vez || bio.passo !== 'foto' || !bio.stream) return;
    const v = $('#bio-video');
    if (v?.videoWidth){
      try{
        const cv = bioAmostra(v, v.videoWidth, v.videoHeight), res = bioAvaliar(cv, await bioRostos(det, cv));
        if (id !== bio.vez) return;
        bioMostrar(res, res.ok ? 'Tudo certo. Pode tirar a foto.' : '');
        boas = res.ok ? boas + 1 : 0;
        const b = $('#bio-tirar'); if (b) b.disabled = boas < 3;
      }catch(_){ /* um quadro ruim não derruba o laço */ }
    }
    bio.timer = setTimeout(passo, 250);
  };
  passo();
}
