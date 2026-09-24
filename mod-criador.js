/* ============================================================
   MÓDULO · CRIADOR — o criador de conteúdo do Studio
   A arte das publicações, desenhada no navegador, em canvas, no
   tamanho exato de cada rede: nenhuma imagem sai daqui até alguém
   salvar no quadro. É o mesmo caminho do gerador de assets do
   brand e do gerador de publicações do processo seletivo — com
   modelos para a rotina da equipe e liberdade para mexer em tudo.

   Uma PEÇA é um modelo, um tamanho, um estilo e uma ou mais
   LÂMINAS (o carrossel). Cada lâmina tem um LEIAUTE (capa, lista,
   pessoa, na mídia…) e os campos dele. O estilo é da peça inteira:
   tema, acento, decoração, logos, rodapé. A peça vai inteira para o
   banco (studio_publicacoes.peca), e é por ela que a arte reabre.

   Rotas (desenhadas a pedido de mod-studio, que carrega este módulo
   antes de chamar):
     #/studio/criar[/<modelo>]     uma peça nova, de um modelo
     #/studio/POST-14/arte         a arte de uma publicação que existe
     #/studio/modelos              a galeria dos modelos, com prévia

   Texto com destaque: *assim* pinta a palavra com o acento (ou marca,
   ou sublinha, conforme o estilo). Enter quebra a linha.

   Depende da casca para: sb, $, esc, state, toast, abreModal,
   fechaModal, ic, ibtn, confirma, falha, motivoRPC, carregarLib,
   registrarBusca, STUDIO_*, studioTipo, podeAprovarStudio, FOTOS_BASE,
   avatarFoto, primeiroNome, norm.
   ============================================================ */

const criador = { peca:null, pub:null, atual:0, imgs:{}, n:0, pintando:false, pendente:false,
                  sujo:false, previaEsc:0, unsplash:{ termo:'', pagina:1, res:[] } };

/* ---------------- tamanhos ----------------
   O tamanho é da arte; o formato da publicação (STUDIO_FORMATOS) é o
   que ela é na rede. "seguro" é a faixa que a interface do Instagram
   cobre no stories e no reels (em px de 1920): o texto fica fora dela. */
const CR_TAMANHOS = {
  feed:      { l:'Feed 4:5',             w:1080, h:1350, onde:'Instagram, LinkedIn e Facebook', formato:'imagem' },
  quadrado:  { l:'Quadrado 1:1',         w:1080, h:1080, onde:'Feed, LinkedIn e WhatsApp',      formato:'imagem' },
  stories:   { l:'Stories 9:16',         w:1080, h:1920, onde:'Stories e status do WhatsApp',   formato:'stories', seguro:[250, 320] },
  reels:     { l:'Capa de Reels 9:16',   w:1080, h:1920, onde:'Reels, Shorts e TikTok',         formato:'reels',   seguro:[250, 320], grade34:true },
  documento: { l:'Documento 4:5 (PDF)',  w:1080, h:1350, onde:'LinkedIn: o carrossel em PDF',   formato:'documento', pdf:true },
  paisagem:  { l:'Paisagem 1,91:1',      w:1200, h:628,  onde:'LinkedIn e X, imagem larga',     formato:'imagem' },
  thumb:     { l:'Thumbnail 16:9',       w:1280, h:720,  onde:'YouTube',                        formato:'peca_video' },
  video:     { l:'Vídeo 16:9 Full HD',   w:1920, h:1080, onde:'Vídeo horizontal',               formato:'peca_video' },
  video_v:   { l:'Vídeo 9:16 Full HD',   w:1080, h:1920, onde:'Vídeo vertical',                 formato:'peca_video' }
};
/* a resolução da exportação: Instagram guarda até 1440 de largura; a
   máxima é para arquivo e impressão (e o 4K de vídeo) */
const CR_ESCALAS = [[1, 'Padrão'], [4/3, 'Alta'], [2, 'Máxima']];

/* ---------------- temas e acentos ----------------
   Os temas saem da paleta oficial e da auxiliar (brand › Cores). Nos
   claros, o acento de TEXTO escurece — lima não se lê no branco —, e o
   de FORMA (barra, marca-texto, anel) continua vivo. */
const CR_TEMAS = {
  void:     { l:'Void',     escuro:true,  fundo:['#050807','#0B1210','#081511'], fg:'#F5F5F7', fg2:'#A9B4B0', halo:'#00594F', acento:'synapse', base:'3,6,5' },
  cortex:   { l:'Cortex',   escuro:true,  fundo:['#00352F','#00594F','#0A6F62'], fg:'#F5F5F7', fg2:'#C3D3CE', halo:'#CEDC00', acento:'synapse', base:'2,24,21' },
  soma:     { l:'Soma',     escuro:true,  fundo:['#052B26','#0B7D6E','#0F9A88'], fg:'#F5F5F7', fg2:'#CDE3DE', halo:'#2DD4BF', acento:'synapse', base:'3,26,23' },
  ion:      { l:'Íon',      escuro:true,  fundo:['#03110F','#062D28','#041A17'], fg:'#F5F5F7', fg2:'#A8C9C3', halo:'#2DD4BF', acento:'ion',     base:'2,12,11' },
  plasma:   { l:'Plasma',   escuro:true,  fundo:['#060B17','#101E3C','#0A1429'], fg:'#F5F5F7', fg2:'#B6C2DA', halo:'#7FA7F2', acento:'plasma',  base:'5,9,20' },
  dendrito: { l:'Dendrito', escuro:true,  fundo:['#0B0815','#22163F','#140D27'], fg:'#F5F5F7', fg2:'#C3B9DD', halo:'#A78BFA', acento:'dendrito',base:'10,7,20' },
  synapse:  { l:'Synapse',  escuro:false, fundo:['#CEDC00','#C3D200','#DAE54A'], fg:'#00352F', fg2:'#2F5A45', halo:'#00594F', acento:'cortex',  base:'0,40,34' },
  aura:     { l:'Aura',     escuro:false, fundo:['#F5F5F7','#E8EEEB','#F8F7FF'], fg:'#101614', fg2:'#4B5854', halo:'#00594F', acento:'synapse', base:'8,14,12' },
  papel:    { l:'Papel',    escuro:false, fundo:['#FFFFFF','#F1F5F3','#FFFFFF'], fg:'#00352F', fg2:'#45625B', halo:'#CEDC00', acento:'synapse', base:'0,30,26' },
  mielina:  { l:'Mielina',  escuro:false, fundo:['#FBF4E3','#F3E4C1','#FFF9EB'], fg:'#1F1A0E', fg2:'#5F5540', halo:'#F5C36A', acento:'mielina', base:'30,24,10' }
};
const CR_ACENTOS = {
  synapse:  { l:'Synapse',  c:'#CEDC00', tx:'#5B6600' },
  ion:      { l:'Íon',      c:'#2DD4BF', tx:'#0A776B' },
  vital:    { l:'Vital',    c:'#4ADE97', tx:'#12804F' },
  mielina:  { l:'Mielina',  c:'#F5C36A', tx:'#8A5A00' },
  pulso:    { l:'Pulso',    c:'#F1806F', tx:'#B23A26' },
  plasma:   { l:'Plasma',   c:'#7FA7F2', tx:'#2D5BC4' },
  dendrito: { l:'Dendrito', c:'#A78BFA', tx:'#6D4AC8' },
  cortex:   { l:'Cortex',   c:'#00594F', tx:'#00352F' },
  ink:      { l:'Branco',   c:'#F5F5F7', tx:'#1D1D1F' }
};
const CR_DECORACOES = { nenhuma:'Nenhuma', rede:'Rede neural', ondas:'Ondas', formas:'Formas', confete:'Confete' };
const CR_DESTAQUES  = { cor:'Cor', marca:'Marca-texto', sublinhado:'Sublinhado' };
const CR_FILTROS    = { natural:'Natural', pb:'Preto e branco', duotone:'Duotone da marca', verde:'Véu verde' };
const CR_BARRAS     = { solida:'Sólida', vidro:'Vidro', clara:'Clara', linha:'Só a linha' };

/* o estilo que toda peça tem, antes do que o modelo muda */
const CR_ESTILO_PADRAO = {
  tema:'void', acento:'', acentoLivre:'', decoracao:'rede', grade:true, cortes:false,
  destaque:'cor', alinhar:'esquerda', escala:1, caixaAlta:false,
  logo:'topo', logoTam:1, labbio:false, rodape:'', contador:true,
  filtro:'natural', escurecer:62, barra:'solida', formatoArquivo:'auto'
};

function crHex(h){ const n = parseInt(String(h).replace('#','').padEnd(6,'0').slice(0,6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function crLum(h){ const [r, g, b] = crHex(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); });
  return .2126 * r + .7152 * g + .0722 * b; }
const crRgba = (h, a) => `rgba(${crHex(h).join(',')},${a})`;
const crSobre = h => crLum(h) > .32 ? '#0C1512' : '#F5F5F7';
function crMistura(h1, h2, t){ const a = crHex(h1), b = crHex(h2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); }

/* as cores resolvidas de uma peça: tema + acento (+ o livre) */
function crCores(estilo){
  const t = CR_TEMAS[estilo.tema] || CR_TEMAS.void;
  let a = CR_ACENTOS[estilo.acento || t.acento] || CR_ACENTOS.synapse;
  if (estilo.acentoLivre && /^#[0-9a-f]{6}$/i.test(estilo.acentoLivre))
    a = { l:'Livre', c:estilo.acentoLivre, tx: crLum(estilo.acentoLivre) > .25 ? crMistura(estilo.acentoLivre, '#000000', .55) : estilo.acentoLivre };
  const acT = t.escuro ? (crLum(a.c) < .06 ? crMistura(a.c, '#FFFFFF', .55) : a.c) : a.tx;
  return { t, a, fg:t.fg, fg2:t.fg2, ac:a.c, acT, sobreAc: crSobre(a.c), escuro:t.escuro };
}

/* ---------------- as marcas ----------------
   Servidas deste repositório (studio/), para o canvas não ficar
   "sujo" e a exportação funcionar. O imagotipo e a logo do LABBIO
   são silhuetas: pintadas com source-in, saem na cor de cada tema. */
const CR_MARCAS = { nro:'studio/nro-imagotipo.png', labbio:'studio/labbio.png', simbolo:'studio/nro-simbolo.png' };
const crMarca = {};
/* recorta a área com tinta — a logo do LABBIO vem com muita margem */
function crApara(img){
  const c = document.createElement('canvas');
  const w = c.width = img.naturalWidth, h = c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  let d; try { d = x.getImageData(0, 0, w, h).data; } catch(e){ return c; }
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y += 2) for (let xx = 0; xx < w; xx += 2)
    if (d[(y * w + xx) * 4 + 3] > 24){ if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 < 0) return c;
  x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(h - 1, y1 + 2);
  const o = document.createElement('canvas'); o.width = x1 - x0 + 1; o.height = y1 - y0 + 1;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
let _crMarcasProntas = null;
function crCarregarMarcas(){
  if (_crMarcasProntas) return _crMarcasProntas;
  const um = (k, src) => new Promise(ok => {
    const i = new Image();
    i.onload = () => { crMarca[k] = crApara(i); ok(); };
    i.onerror = () => ok();
    i.src = src;
  });
  _crMarcasProntas = Promise.all(Object.entries(CR_MARCAS).map(([k, s]) => um(k, s)));
  return _crMarcasProntas;
}
const _crTinta = new Map();
function crPintada(k, cor){
  const src = crMarca[k]; if (!src) return null;
  const chave = k + cor;
  if (_crTinta.has(chave)) return _crTinta.get(chave);
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
  _crTinta.set(chave, c);
  return c;
}
/* desenha a logo pela ALTURA e devolve a largura usada */
function crLogo(ctx, k, x, y, alt, cor){
  const c = cor ? crPintada(k, cor) : crMarca[k];
  if (!c){
    if (k !== 'nro') return 0;
    ctx.save(); ctx.fillStyle = cor || '#F5F5F7'; ctx.font = crFonte(700, alt * .78);
    ctx.textBaseline = 'middle'; ctx.fillText('NeuroDynamics', x, y + alt / 2);
    const w = ctx.measureText('NeuroDynamics').width; ctx.restore(); return w;
  }
  const w = alt * c.width / c.height;
  ctx.drawImage(c, x, y, w, alt);
  return w;
}
const crLarguraLogo = (k, alt) => crMarca[k] ? alt * crMarca[k].width / crMarca[k].height : alt * 6;
/* só o quadrado do símbolo, à esquerda do imagotipo */
function crTile(ctx, x, y, lado, cor){
  const c = crPintada('nro', cor); if (!c) return;
  ctx.drawImage(c, 0, 0, c.height, c.height, x, y, lado, lado);
}

/* ---------------- texto ----------------
   Todo bloco é posicionado pelo TOPO e devolve o próprio rodapé: pilha
   de blocos é soma de alturas. *assim* é destaque. */
const crFonte = (peso, tam, fam) => `${peso} ${Math.max(1, Math.round(tam))}px ${fam || 'Archivo'}, sans-serif`;
const crMono  = (peso, tam) => crFonte(peso, tam, '"IBM Plex Mono", monospace');

function crPalavras(txt){
  const out = []; let pal = [], seg = '', d = false;
  const fechaSeg = () => { if (seg){ pal.push({ t:seg, d }); seg = ''; } };
  const fechaPal = () => { fechaSeg(); if (pal.length){ out.push(pal); pal = []; } };
  for (const c of String(txt ?? '')){
    if (c === '*'){ fechaSeg(); d = !d; continue; }
    if (c === '\n'){ fechaPal(); out.push('\n'); continue; }
    if (/\s/.test(c)){ fechaPal(); continue; }
    seg += c;
  }
  fechaPal();
  return out;
}
function crPrepara(ctx, o){
  ctx.font = o.fonte;
  if ('letterSpacing' in ctx) ctx.letterSpacing = (o.esp || 0) + 'px';
}
function crLinhas(ctx, txt, o){
  crPrepara(ctx, o);
  const bruto = o.caixaAlta ? String(txt ?? '').toUpperCase() : txt;
  const sp = ctx.measureText(' ').width;
  const linhas = []; let cur = [], w = 0;
  const fecha = () => { linhas.push({ pals:cur, w }); cur = []; w = 0; };
  for (const p of crPalavras(bruto)){
    if (p === '\n'){ fecha(); continue; }
    const folga = o.destaque === 'marca' ? (parseFloat(String(o.fonte).split(' ')[1]) || 0) * .12 : 0;
    const segs = p.map((s, j) => ({ ...s, w: ctx.measureText(s.t).width,
      fe: s.d && folga && (j === 0 || !p[j - 1].d) ? folga : 0, fd: s.d && folga && (j === p.length - 1 || !p[j + 1].d) ? folga : 0 }));
    segs.forEach(s2 => { s2.w += s2.fe + s2.fd; });
    const pw = segs.reduce((t, s) => t + s.w, 0);
    if (cur.length && w + sp + pw > o.maxL) fecha();
    cur.push({ segs, w:pw }); w += (cur.length > 1 ? sp : 0) + pw;
  }
  if (cur.length || !linhas.length) fecha();
  const maior = linhas.reduce((m, l) => Math.max(m, ...l.pals.map(p => p.w), 0), 0);
  return { linhas: o.maxLinhas ? linhas.slice(0, o.maxLinhas) : linhas, sp, maior };
}
function crAltura(ctx, txt, o){
  if (!String(txt ?? '').trim()) return 0;
  ctx.save(); const n = crLinhas(ctx, txt, o).linhas.length; ctx.restore();
  return n * o.lh;
}
function crLarguraTexto(ctx, txt, o){
  ctx.save(); const { linhas } = crLinhas(ctx, txt, o); ctx.restore();
  return linhas.reduce((m, l) => Math.max(m, l.w), 0);
}
function crEscreve(ctx, txt, o){
  if (!String(txt ?? '').trim()) return o.y;
  ctx.save();
  const { linhas, sp } = crLinhas(ctx, txt, o);
  ctx.textBaseline = 'alphabetic';
  let base = o.y + o.lh * .79;
  const tam = parseFloat(String(o.fonte).split(' ')[1]) || o.lh;
  for (const ln of linhas){
    let x = o.x + (o.alinhar === 'centro' ? (o.maxL - ln.w) / 2 : o.alinhar === 'direita' ? o.maxL - ln.w : 0);
    ln.pals.forEach((p, i) => {
      if (i) x += sp;
      p.segs.forEach((s, j) => {
        if (s.d && o.destaque === 'marca'){
          /* o marca-texto cobre também o espaço até a próxima palavra destacada */
          const prox = ln.pals[i + 1]?.segs[0]?.d && j === p.segs.length - 1;
          ctx.fillStyle = o.fundoD || o.corD;
          ctx.fillRect(x, base - tam * .8, s.w + (prox ? sp : 0), tam * .98);
        }
        ctx.fillStyle = s.d ? (o.destaque === 'marca' ? (o.sobreD || '#0C1512') : (o.corD || o.cor)) : o.cor;
        ctx.fillText(s.t, x + (s.fe || 0), base);
        if (s.d && o.destaque === 'sublinhado'){
          ctx.fillStyle = o.fundoD || o.corD;
          ctx.fillRect(x + (s.fe || 0), base + tam * .1, s.w - (s.fe || 0) - (s.fd || 0), Math.max(2, tam * .08));
        }
        x += s.w;
      });
    });
    base += o.lh;
  }
  ctx.restore();
  return o.y + linhas.length * o.lh;
}
/* o maior corpo (até "base") em que o texto cabe em maxA — e em que
   nenhuma palavra sozinha estoura a largura */
function crEncaixa(ctx, txt, base, o){
  const monta = t => ({ ...o, fonte: crFonte(o.peso, t, o.fam), lh: t * o.lhF, esp: (o.espF || 0) * t });
  let t = base;
  while (t > base * .34){
    const op = monta(t);
    ctx.save(); const { linhas, maior } = crLinhas(ctx, txt, op); ctx.restore();
    if (linhas.length * op.lh <= o.maxA && maior <= o.maxL) return op;
    t -= base * .035;
  }
  return monta(t);
}
/* corpo para uma linha só ocupar a largura (o site no rodapé do CTA) */
function crCorpoQueCabe(ctx, txt, largura, peso, maximo, fam){
  ctx.save(); ctx.font = crFonte(peso, 100, fam);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const l = ctx.measureText(String(txt)).width || 1; ctx.restore();
  return Math.min(maximo, largura / l * 100);
}
/* o olho: rótulo curto em mono, caixa alta, espaçado */
function crOlho(ctx, g, txt, x, y, o = {}){
  return crEscreve(ctx, txt, { fonte: crMono(500, g.u * (o.tam || 23)), lh: g.u * (o.tam || 23) * 1.42,
    cor: o.cor || g.acT, maxL: o.maxL || g.larg, x, y, esp: g.u * 4.2, caixaAlta: true, alinhar: o.alinhar || g.alinhar });
}
/* a régua de acento sob um título */
function crRegua(ctx, g, x, y, larg){
  const w = (larg || 96) * g.u, h = Math.max(3, g.u * 6);
  const xx = g.alinhar === 'centro' ? x + (g.larg - w) / 2 : x;
  ctx.fillStyle = g.ac; ctx.fillRect(xx, y, w, h);
  return y + h;
}
/* o título de cada leiaute: Archivo, destaque do estilo, escala do estilo */
function crTituloOp(g, base, maxA, extra = {}){
  return { peso: extra.peso || 800, lhF: extra.lhF || .98, espF: extra.espF ?? -.012, maxL: extra.maxL || g.larg, maxA,
    x: extra.x ?? g.x0, cor: extra.cor || g.fg, corD: g.acT, fundoD: g.ac, sobreD: g.sobreAc,
    destaque: g.estilo.destaque, alinhar: extra.alinhar || g.alinhar, caixaAlta: g.estilo.caixaAlta, _base: base * g.estilo.escala };
}
const crTitulo = (ctx, g, txt, base, maxA, extra) => {
  const o = crTituloOp(g, base, maxA, extra);
  return crEncaixa(ctx, txt, o._base, o);
};
function crRetArred(ctx, x, y, w, h, r){
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/* número pseudoaleatório com semente: a mesma lâmina sai sempre igual */
function crSorte(semente){
  let h = 2166136261;
  for (const c of String(semente)){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const CR_MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const CR_DIAS  = ['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
function crData(iso){
  const p = String(iso || '').slice(0, 10).split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return new Date(p[0], p[1] - 1, p[2]);
}

/* ============================================================
   FUNDO, FOTO E DECORAÇÃO
   ============================================================ */
function crFundo(ctx, g){
  const [a, b, c] = g.t.fundo;
  const lg = ctx.createLinearGradient(0, 0, g.W * .6, g.H);
  lg.addColorStop(0, a); lg.addColorStop(.62, b); lg.addColorStop(1, c);
  ctx.fillStyle = lg; ctx.fillRect(0, 0, g.W, g.H);
  const M = Math.max(g.W, g.H);
  crHalo(ctx, g.W * .92, -g.H * .08, M * .62, g.t.halo, g.escuro ? .24 : .13);
  crHalo(ctx, -g.W * .1, g.H * 1.04, M * .5, g.ac, g.escuro ? .11 : .09);
}
function crHalo(ctx, cx, cy, r, cor, alfa){
  const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  rg.addColorStop(0, crRgba(cor, 1)); rg.addColorStop(1, crRgba(cor, 0));
  ctx.save(); ctx.globalAlpha = alfa; ctx.fillStyle = rg; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore();
}
/* o fundo quadriculado da prévia da barra de nome — só na tela; o PNG
   sai transparente */
function crFundoPrevia(ctx, g){
  const lg = ctx.createLinearGradient(0, 0, g.W, g.H);
  lg.addColorStop(0, '#39443F'); lg.addColorStop(.5, '#59625D'); lg.addColorStop(1, '#2B3230');
  ctx.fillStyle = lg; ctx.fillRect(0, 0, g.W, g.H);
  const p = Math.round(g.u * 26);
  ctx.fillStyle = 'rgba(255,255,255,.035)';
  for (let y = 0; y < g.H; y += p) for (let x = ((y / p) % 2) * p; x < g.W; x += p * 2) ctx.fillRect(x, y, p, p);
  crHalo(ctx, g.W * .5, g.H * .42, g.H * .55, '#C9D6D0', .22);
}
function crGrade(ctx, g){
  const passo = Math.round(g.W / 9);
  ctx.save();
  ctx.strokeStyle = g.escuro || g.sobreFoto ? 'rgba(245,245,247,.052)' : crRgba(g.t.fg, .07);
  ctx.lineWidth = Math.max(1, Math.round(g.W / 1000));
  ctx.beginPath();
  for (let x = passo; x < g.W; x += passo){ ctx.moveTo(x + .5, 0); ctx.lineTo(x + .5, g.H); }
  for (let y = passo; y < g.H; y += passo){ ctx.moveTo(0, y + .5); ctx.lineTo(g.W, y + .5); }
  ctx.stroke(); ctx.restore();
}
function crCortes(ctx, g){
  const s = Math.round(Math.min(g.W, g.H) * .028), m = Math.round(g.m * .45);
  ctx.save(); ctx.strokeStyle = crRgba(g.fg, .3); ctx.lineWidth = Math.max(1.5, g.u * 2);
  const L = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  L(m, m, m + s, m); L(m, m, m, m + s); L(g.W - m, m, g.W - m - s, m); L(g.W - m, m, g.W - m, m + s);
  L(m, g.H - m, m + s, g.H - m); L(m, g.H - m, m, g.H - m - s);
  L(g.W - m, g.H - m, g.W - m - s, g.H - m); L(g.W - m, g.H - m, g.W - m, g.H - m - s);
  ctx.restore();
}
/* A rede neural: nós e sinapses num canto, como o traço da marca —
   ponto solto maior, junção menor, um ou dois disparos no acento. */
function crRede(ctx, g, semente){
  const sorte = crSorte(semente), M = Math.min(g.W, g.H), u = g.u;
  const cluster = (cx, cy, R, n, alfa, disparos) => {
    const pts = [];
    for (let i = 0; i < n; i++){
      const ang = Math.PI * (.45 + sorte() * 1.1), r = R * (.18 + sorte() * .82);
      pts.push({ x: cx + Math.cos(ang) * r, y: cy - Math.sin(ang) * r * .9, v:0 });
    }
    const ligs = [];
    pts.forEach((p, i) => {
      const perto = pts.map((q, j) => [j, Math.hypot(p.x - q.x, p.y - q.y)]).filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1]).slice(0, 2);
      perto.forEach(([j, d]) => { if (d < R * .75 && !ligs.some(l => (l[0] === j && l[1] === i))){ ligs.push([i, j]); p.v++; pts[j].v++; } });
    });
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = crRgba(g.sobreFoto ? '#F5F5F7' : g.fg, alfa * .55); ctx.lineWidth = Math.max(1.5, u * 2.4);
    ligs.forEach(([i, j]) => {
      const a = pts[i], b = pts[j];
      ctx.beginPath(); ctx.moveTo(a.x, a.y);
      const mx = (a.x + b.x) / 2 + (sorte() - .5) * R * .12, my = (a.y + b.y) / 2 + (sorte() - .5) * R * .12;
      ctx.quadraticCurveTo(mx, my, b.x, b.y); ctx.stroke();
    });
    pts.forEach((p, i) => {
      const r = u * (p.v <= 1 ? 7 : 4.6) * (.8 + sorte() * .5);
      const acende = i < disparos;
      ctx.fillStyle = acende ? g.ac : crRgba(g.sobreFoto ? '#F5F5F7' : g.fg, alfa);
      ctx.beginPath(); ctx.arc(p.x, p.y, acende ? r * 1.35 : r, 0, 7); ctx.fill();
      if (acende){ ctx.strokeStyle = crRgba(g.ac, .35); ctx.lineWidth = u * 2.2;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 3.1, 0, 7); ctx.stroke(); }
    });
    ctx.restore();
  };
  cluster(g.W * 1.05, g.topo + crAltLogo(g) * 2.2 + M * .24, M * .36, 10, g.escuro || g.sobreFoto ? .34 : .26, 2);
  cluster(-g.W * .02, g.H * .99, M * .26, 6, g.escuro || g.sobreFoto ? .16 : .13, 0);
}
/* as ondas do site institucional (o traço do hero), atravessando */
function crOndas(ctx, g, semente){
  const sorte = crSorte(semente), sx = g.W / 800, sy = g.H * .46 / 420, dy = g.H * (.02 + sorte() * .06);
  const onda = (desl, cor, larg) => {
    ctx.beginPath();
    const P = (x, y) => [x * sx, y * sy + dy + desl];
    ctx.moveTo(...P(-20, 300));
    ctx.bezierCurveTo(...P(120, 60), ...P(240, 60), ...P(340, 230));
    ctx.bezierCurveTo(...P(440, 400), ...P(560, 430), ...P(690, 190));
    ctx.bezierCurveTo(...P(740, 100), ...P(800, 80), ...P(840, 120));
    ctx.strokeStyle = cor; ctx.lineWidth = larg; ctx.stroke();
  };
  ctx.save(); ctx.lineCap = 'round';
  onda(0, crRgba(g.ac, g.escuro || g.sobreFoto ? .55 : .8), Math.max(2, g.u * 3.4));
  onda(g.u * 30, crRgba(g.sobreFoto ? '#F5F5F7' : g.fg, .16), Math.max(1.5, g.u * 2));
  ctx.restore();
}
function crFormas(ctx, g){
  const M = Math.min(g.W, g.H), u = g.u, fg = g.sobreFoto ? '#F5F5F7' : g.fg;
  ctx.save();
  ctx.strokeStyle = crRgba(g.ac, g.escuro || g.sobreFoto ? .7 : .9); ctx.lineWidth = Math.max(2, u * 5);
  ctx.beginPath(); ctx.arc(g.W * .98, g.H * .03, M * .36, 0, 7); ctx.stroke();
  ctx.fillStyle = g.ac; ctx.beginPath(); ctx.arc(g.W * .98 - M * .36 * Math.cos(.9), g.H * .03 + M * .36 * Math.sin(.9), u * 15, 0, 7); ctx.fill();
  ctx.strokeStyle = crRgba(fg, .16); ctx.lineWidth = Math.max(1.5, u * 2.5);
  ctx.beginPath(); ctx.arc(g.W * .98, g.H * .03, M * .5, 0, 7); ctx.stroke();
  ctx.fillStyle = crRgba(fg, .22);
  const p = u * 22, x0 = g.W - g.m - p * 4, y0 = g.H * .5;
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++){ ctx.beginPath(); ctx.arc(x0 + i * p, y0 + j * p, u * 2.6, 0, 7); ctx.fill(); }
  ctx.restore();
}
function crConfete(ctx, g, semente){
  const sorte = crSorte(semente + 'c'), u = g.u, fg = g.sobreFoto ? '#F5F5F7' : g.fg;
  const cores = [g.ac, g.ac, crRgba(fg, .85), g.t.halo === g.ac ? '#2DD4BF' : g.t.halo, crRgba(g.ac, .6)];
  ctx.save(); ctx.lineCap = 'round';
  let n = 0;
  for (let tent = 0; tent < 260 && n < 46; tent++){
    const x = sorte() * g.W, y = sorte() * g.H;
    /* longe do miolo, onde mora o texto */
    const dx = (x - g.W / 2) / (g.W * .42), dy = (y - g.H * .55) / (g.H * .36);
    if (dx * dx + dy * dy < 1) continue;
    n++;
    const cor = cores[Math.floor(sorte() * cores.length)], s = u * (6 + sorte() * 10), rot = sorte() * Math.PI;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    ctx.fillStyle = cor; ctx.strokeStyle = cor;
    const tipo = Math.floor(sorte() * 4);
    if (tipo === 0){ ctx.beginPath(); ctx.arc(0, 0, s * .55, 0, 7); ctx.fill(); }
    else if (tipo === 1){ ctx.lineWidth = s * .42; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(s, 0); ctx.stroke(); }
    else if (tipo === 2){ ctx.beginPath(); ctx.moveTo(0, -s * .8); ctx.lineTo(s * .75, s * .6); ctx.lineTo(-s * .75, s * .6); ctx.closePath(); ctx.fill(); }
    else { ctx.lineWidth = s * .26; ctx.beginPath(); ctx.arc(0, 0, s * .62, 0, 7); ctx.stroke(); }
    ctx.restore();
  }
  ctx.restore();
}
function crDecora(ctx, g, semente){
  if (g.estilo.grade) crGrade(ctx, g);
  const d = g.estilo.decoracao;
  if (d === 'rede') crRede(ctx, g, semente);
  else if (d === 'ondas') crOndas(ctx, g, semente);
  else if (d === 'formas') crFormas(ctx, g);
  else if (d === 'confete') crConfete(ctx, g, semente);
  if (g.estilo.cortes) crCortes(ctx, g);
}

/* A foto de um espaço da lâmina (foto, foto2), já carregada. */
function crFoto(lam, chave){
  const f = lam.fotos?.[chave];
  const im = f?.ref ? criador.imgs[f.ref] : null;
  return im?.img ? { img: im.img, f, credito: im.credito || '' } : null;
}
const crDim = img => [img.naturalWidth || img.width, img.naturalHeight || img.height];
/* desenha a foto cobrindo x,y,w,h — com enquadramento, zoom e o filtro
   do estilo — recortada pela forma, se houver */
function crFotoEm(ctx, g, foto, x, y, w, h, forma){
  ctx.save();
  if (forma) forma(ctx); else { ctx.beginPath(); ctx.rect(x, y, w, h); }
  ctx.clip();
  const [iw, ih] = crDim(foto.img), f = foto.f || {};
  const k = Math.max(w / iw, h / ih) * Math.max(1, f.zoom || 1);
  const dw = iw * k, dh = ih * k;
  ctx.drawImage(foto.img, x + (w - dw) * ((f.x ?? 50) / 100), y + (h - dh) * ((f.y ?? 50) / 100), dw, dh);
  const fl = g.estilo.filtro;
  if (fl === 'pb' || fl === 'duotone'){
    ctx.globalCompositeOperation = 'saturation'; ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, h);
  }
  if (fl === 'duotone'){
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = crMistura(g.ac, '#FFFFFF', .28); ctx.fillRect(x, y, w, h);
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = crMistura(g.t.fundo[0], '#00352F', g.escuro ? .5 : .85); ctx.fillRect(x, y, w, h);
  } else if (fl === 'verde'){
    ctx.globalCompositeOperation = 'color'; ctx.globalAlpha = .38; ctx.fillStyle = '#0B7D6E'; ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}
/* o espaço de uma foto que ainda não veio: tracejado e o símbolo */
function crSemFoto(ctx, g, x, y, w, h, forma, rotulo){
  ctx.save();
  if (forma) forma(ctx); else crRetArred(ctx, x, y, w, h, g.u * 18);
  ctx.fillStyle = crRgba(g.fg, .06); ctx.fill();
  ctx.setLineDash([g.u * 12, g.u * 10]); ctx.lineWidth = Math.max(1.5, g.u * 2.4);
  ctx.strokeStyle = crRgba(g.fg, .3); ctx.stroke(); ctx.setLineDash([]);
  const lado = Math.min(w, h) * .34;
  if (crMarca.simbolo){ ctx.globalAlpha = .55; ctx.drawImage(crMarca.simbolo, x + (w - lado) / 2, y + (h - lado) / 2 - (rotulo ? g.u * 14 : 0), lado, lado); ctx.globalAlpha = 1; }
  if (rotulo){
    ctx.font = crMono(500, g.u * 17); ctx.fillStyle = crRgba(g.fg, .55); ctx.textAlign = 'center';
    ctx.fillText(rotulo.toUpperCase(), x + w / 2, y + (h + lado) / 2 + g.u * 18);
  }
  ctx.restore();
}
/* a foto como fundo da lâmina: cobre tudo e escurece para o texto ler */
function crFotoFundo(ctx, g, foto){
  crFotoEm(ctx, g, foto, 0, 0, g.W, g.H);
  const f = g.estilo.escurecer / 100, base = g.t.escuro ? g.t.base : '4,12,10';
  ctx.fillStyle = `rgba(${base},${f * .5})`; ctx.fillRect(0, 0, g.W, g.H);
  const lg = ctx.createLinearGradient(0, g.H * .22, 0, g.H);
  lg.addColorStop(0, `rgba(${base},0)`); lg.addColorStop(1, `rgba(${base},${Math.min(.96, f + .3)})`);
  ctx.fillStyle = lg; ctx.fillRect(0, 0, g.W, g.H);
  const tg = ctx.createLinearGradient(0, 0, 0, g.H * .26);
  tg.addColorStop(0, `rgba(${base},${f * .55})`); tg.addColorStop(1, `rgba(${base},0)`);
  ctx.fillStyle = tg; ctx.fillRect(0, 0, g.W, g.H * .26);
}
/* sobre foto, o texto é claro — em qualquer tema */
function crSobreFoto(g){
  g.sobreFoto = true;
  g.fg = '#F5F5F7'; g.fg2 = 'rgba(245,245,247,.86)'; g.corLogo = '#F5F5F7';
  g.acT = crLum(g.ac) < .08 ? crMistura(g.ac, '#FFFFFF', .6) : g.ac;
}

/* ============================================================
   MOLDURA — logo, contador, rodapé e crédito
   ============================================================ */
function crAltLogo(g){ return Math.round(g.u * 44 * (g.estilo.logoTam || 1)); }
function crLarguraMarcas(g, alt){
  let w = crLarguraLogo('nro', alt);
  if (g.estilo.labbio) w += alt * 1.1 + crLarguraLogo('labbio', alt * 1.5);
  return w;
}
function crMarcas(ctx, g, x, y, alt, cor){
  let w = crLogo(ctx, 'nro', x, y, alt, cor);
  if (g.estilo.labbio){
    const gap = alt * .55;
    ctx.save(); ctx.strokeStyle = crRgba(cor, .45); ctx.lineWidth = Math.max(1.5, alt * .045);
    ctx.beginPath(); ctx.moveTo(x + w + gap, y - alt * .12); ctx.lineTo(x + w + gap, y + alt * 1.12); ctx.stroke(); ctx.restore();
    w += gap * 2 + crLogo(ctx, 'labbio', x + w + gap * 2, y - alt * .25, alt * 1.5, cor);
  }
  return w;
}
function crCabecalho(ctx, g, lam, i, total){
  const pos = g.estilo.logo;
  const alt = crAltLogo(g), y = g.topo;
  const cor = g.corLogo || g.fg;
  if (pos === 'topo' || pos === 'topo-centro'){
    const lw = crLarguraMarcas(g, alt);
    crMarcas(ctx, g, pos === 'topo-centro' ? (g.W - lw) / 2 : g.x0, y, alt, cor);
  }
  /* no topo à direita: o selo da lâmina, ou o contador do carrossel */
  const multi = total > 1 && g.estilo.contador;
  const selo = lam.campos?.selo;
  if ((selo || multi) && pos !== 'topo-centro'){
    ctx.save();
    ctx.font = crMono(500, g.u * 21); ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = g.u * 2 + 'px';
    ctx.fillStyle = selo ? g.acT : g.fg2;
    ctx.fillText(selo ? String(selo).toUpperCase() : `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
      g.x1, y + alt / 2);
    ctx.restore();
  }
}
function crRodape(ctx, g, i, total){
  const pos = g.estilo.logo;
  const y = g.base;
  const texto = (g.estilo.rodape || '').trim();
  ctx.save();
  ctx.textBaseline = 'alphabetic';
  if (pos === 'rodape'){
    const alt = crAltLogo(g);
    crMarcas(ctx, g, g.x0, y - alt, alt, g.corLogo || g.fg);
    if (texto){ ctx.font = crMono(500, g.u * 21); ctx.fillStyle = g.fg2; ctx.textAlign = 'right';
      if ('letterSpacing' in ctx) ctx.letterSpacing = g.u * 1.5 + 'px';
      ctx.fillText(texto, g.x1, y - alt * .22); }
  } else {
    if (texto){ ctx.font = crMono(500, g.u * 21); ctx.fillStyle = g.fg2;
      if ('letterSpacing' in ctx) ctx.letterSpacing = g.u * 1.5 + 'px';
      ctx.textAlign = g.alinhar === 'centro' && !(total > 1 && i === 0) ? 'center' : 'left';
      ctx.fillText(texto, ctx.textAlign === 'center' ? g.W / 2 : g.x0, y); }
    if (total > 1 && i === 0 && g.estilo.contador){
      ctx.font = crMono(500, g.u * 21); ctx.textAlign = 'right'; ctx.fillStyle = g.acT;
      ctx.fillText('arraste →', g.x1, y);
    }
  }
  ctx.restore();
}
function crCredito(ctx, g, credito){
  const t = String(credito || '').trim(); if (!t) return;
  ctx.save();
  ctx.font = crMono(400, g.u * 14); ctx.fillStyle = g.sobreFoto ? 'rgba(245,245,247,.62)' : crRgba(g.fg, .5);
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ctx.fillText(/^foto/i.test(t) ? t : 'Foto: ' + t, g.W - g.m * .5, g.H - g.m * .32);
  ctx.restore();
}
/* guias da prévia: a área que a interface da rede cobre */
function crGuias(ctx, g){
  const T = g.T;
  ctx.save();
  ctx.setLineDash([g.u * 10, g.u * 8]); ctx.lineWidth = Math.max(1, g.u * 2);
  if (T.seguro){
    const a = Math.round(g.H * T.seguro[0] / 1920), b = Math.round(g.H * T.seguro[1] / 1920);
    ctx.fillStyle = 'rgba(241,128,111,.12)'; ctx.fillRect(0, 0, g.W, a); ctx.fillRect(0, g.H - b, g.W, b);
    ctx.strokeStyle = 'rgba(241,128,111,.7)';
    ctx.beginPath(); ctx.moveTo(0, a); ctx.lineTo(g.W, a); ctx.moveTo(0, g.H - b); ctx.lineTo(g.W, g.H - b); ctx.stroke();
  }
  if (T.grade34){
    const h34 = g.W * 4 / 3, y = (g.H - h34) / 2;
    ctx.strokeStyle = 'rgba(127,167,242,.85)'; ctx.strokeRect(1, y, g.W - 2, h34);
  }
  if (g.T === CR_TAMANHOS.thumb){
    /* o selo de duração do YouTube cobre o canto de baixo à direita */
    ctx.fillStyle = 'rgba(241,128,111,.16)'; ctx.fillRect(g.W - g.W * .14, g.H - g.H * .13, g.W * .14, g.H * .13);
  }
  ctx.restore();
}

/* ============================================================
   LEIAUTES — o desenho de cada lâmina
   Cada um recebe g (a geometria e as cores resolvidas) e os campos
   da lâmina. A moldura (logo, contador, rodapé) é da casca do motor,
   menos nos leiautes de vídeo, que desenham a própria.
   ============================================================ */
const crVertical = g => g.H / g.W > 1.5;
/* onde o bloco começa: no feed, ancorado como o leiaute pede; no
   vertical, no meio da área livre */
function crAncora(g, altura, pref, y0, y1){
  y0 = y0 ?? g.y0; y1 = y1 ?? g.y1;
  const f = crVertical(g) && pref > .5 ? .55 : pref;
  return Math.max(y0, y0 + (y1 - y0 - altura) * f);
}
const crApoioOp = (g, extra = {}) => ({ fonte: crFonte(500, g.u * (extra.tam || 33)), lh: g.u * (extra.tam || 33) * 1.42,
  cor: extra.cor || g.fg2, maxL: extra.maxL || g.larg, x: extra.x ?? g.x0, alinhar: extra.alinhar || g.alinhar,
  corD: g.acT, fundoD: g.ac, sobreD: g.sobreAc, destaque: g.estilo.destaque });
const crItens = v => (Array.isArray(v) ? v : String(v || '').split('\n')).map(s => String(s).trim()).filter(Boolean);
/* "Título — descrição": a primeira parte em negrito */
function crPartes(s){ const m = String(s).match(/^(.+?)\s+[—–-]\s+(.+)$/) || String(s).match(/^([^:]{2,40}):\s+(.+)$/);
  return m ? [m[1], m[2]] : [s, '']; }
function crFaixaFoto(ctx, g, lam, x, y, w, h, raio, rotulo){
  const foto = crFoto(lam, 'foto');
  const forma = c => crRetArred(c, x, y, w, h, raio);
  if (foto) crFotoEm(ctx, g, foto, x, y, w, h, raio ? forma : null);
  else crSemFoto(ctx, g, x, y, w, h, raio ? forma : null, rotulo || 'foto');
  return foto;
}

function crLCapa(ctx, g, c, lam){
  const u = g.u, modo = lam.fotos?.foto?.modo || 'fundo';
  let y0 = g.y0, pref = 1;
  if (modo === 'topo'){
    const hF = Math.round(g.H * (crVertical(g) ? .5 : g.H > g.W ? .5 : .46));
    crFaixaFoto(ctx, g, lam, 0, 0, g.W, hF, 0);
    const tg = ctx.createLinearGradient(0, 0, 0, g.topo * 2.6);
    tg.addColorStop(0, 'rgba(4,10,9,.55)'); tg.addColorStop(1, 'rgba(4,10,9,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, g.W, g.topo * 2.6);
    ctx.fillStyle = g.ac; ctx.fillRect(0, hF - Math.max(3, u * 6), g.W * .22, Math.max(3, u * 6));
    g.corLogo = '#F5F5F7'; g.corSelo = '#F5F5F7';
    y0 = hF + u * 58; pref = .2;
  }
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 26 : 0;
  const sub = crApoioOp(g), hSub = c.sub ? crAltura(ctx, c.sub, sub) + u * 60 : u * 36;
  const tit = crTitulo(ctx, g, c.titulo, u * 118, g.y1 - y0 - olhoH - hSub);
  const hTit = crAltura(ctx, c.titulo, tit);
  let y = crAncora(g, olhoH + hTit + hSub, pref, y0);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 26;
  y = crEscreve(ctx, c.titulo, { ...tit, y });
  crRegua(ctx, g, g.x0, y + u * 24);
  if (c.sub) crEscreve(ctx, c.sub, { ...sub, y: y + u * 60 });
}

function crLTexto(ctx, g, c, lam){
  const u = g.u, modo = lam.fotos?.foto?.modo || 'nenhuma';
  let y0 = g.y0;
  if (modo === 'moldura'){
    const h = Math.round((g.y1 - g.y0) * (crVertical(g) ? .36 : .4));
    ctx.strokeStyle = g.ac; ctx.lineWidth = Math.max(2, u * 4);
    crRetArred(ctx, g.x0 + u * 16, y0 + u * 16, g.larg, h, u * 22); ctx.stroke();
    crFaixaFoto(ctx, g, lam, g.x0, y0, g.larg, h, u * 22);
    y0 += h + u * 60;
  }
  const itens = crItens(c.itens);
  /* "01", "02": o rótulo que é só número vira o número grande do passo */
  const numerico = /^\d{1,2}$/.test(String(c.olho || '').trim());
  const rot = c.olho ? (numerico ? u * 150 : g.u * 23 * 1.42) + u * 34 : 0;
  const corpo = crApoioOp(g, { tam: 33 });
  const tamItem = itens.length > 5 ? 31 : 36;
  const itemOp = { fonte: crFonte(500, u * tamItem), lh: u * tamItem * 1.34, cor: g.fg, maxL: g.larg - u * 54,
    x: g.x0 + u * 54, alinhar: 'esquerda', corD: g.acT, destaque: g.estilo.destaque, fundoD: g.ac, sobreD: g.sobreAc };
  const hItens = itens.reduce((t, it) => t + crAltura(ctx, it, itemOp) + u * 18, 0);
  const hCorpo = c.corpo ? crAltura(ctx, c.corpo, corpo) + u * 40 : 0;
  const curto = !itens.length && String(c.corpo || '').length < 140;
  const tit = crTitulo(ctx, g, c.titulo, u * (curto ? 96 : 80), Math.max(u * 80, (g.y1 - y0 - rot - hItens - hCorpo - u * 44)), { peso:700, lhF:1.05 });
  const hTit = crAltura(ctx, c.titulo, tit) + u * 44;
  let y = crAncora(g, rot + hTit + hCorpo + hItens, modo === 'moldura' ? 0 : curto ? .62 : .42, y0);
  if (c.olho && numerico){
    crEscreve(ctx, String(c.olho).trim(), { fonte: crFonte(800, u * 150), lh: u * 150, cor: g.acT, maxL: g.larg, x: g.x0, y, esp: -u * 5, alinhar: g.alinhar });
    y += u * 150 + u * 34;
  } else if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 34;
  y = crEscreve(ctx, c.titulo, { ...tit, y }) + u * 44;
  if (c.corpo) y = crEscreve(ctx, c.corpo, { ...corpo, y }) + u * 40;
  for (const it of itens){
    ctx.fillStyle = g.ac;
    ctx.fillRect(g.x0, y + itemOp.lh * .44, u * 28, Math.max(2, u * 5));
    y = crEscreve(ctx, it, { ...itemOp, y }) + u * 18;
  }
}

function crLLista(ctx, g, c){
  const u = g.u, itens = crItens(c.itens).slice(0, 7);
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 30 : 0;
  const disp = g.y1 - g.y0 - olhoH;
  const tit = crTitulo(ctx, g, c.titulo, u * 76, disp * .34, { peso:700, lhF:1.04 });
  const hTit = c.titulo ? crAltura(ctx, c.titulo, tit) + u * 46 : 0;
  /* mede com o corpo cheio e encolhe tudo junto até caber */
  const monta = k => ({
    num: { fonte: crFonte(800, u * 58 * k), lh: u * 58 * k },
    a:   { fonte: crFonte(700, u * 40 * k), lh: u * 40 * k * 1.22, cor: g.fg, maxL: g.larg - u * 118 * k, x: g.x0 + u * 118 * k, alinhar:'esquerda' },
    b:   { fonte: crFonte(500, u * 31 * k), lh: u * 31 * k * 1.38, cor: g.fg2, maxL: g.larg - u * 118 * k, x: g.x0 + u * 118 * k, alinhar:'esquerda' },
    gap: u * 30 * k });
  const altura = o => itens.reduce((t, it) => { const [a, b] = crPartes(it);
    return t + crAltura(ctx, a, o.a) + (b ? crAltura(ctx, b, o.b) + u * 6 : 0) + o.gap * 2; }, 0);
  let k = 1.3, op = monta(k);
  while (k > .5 && altura(op) > (disp - hTit) * .92){ k -= .05; op = monta(k); }
  let y = crAncora(g, olhoH + hTit + altura(op), .5);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 30;
  if (c.titulo) y = crEscreve(ctx, c.titulo, { ...tit, y }) + u * 46;
  itens.forEach((it, n) => {
    const [a, b] = crPartes(it);
    ctx.save(); ctx.font = op.num.fonte; ctx.fillStyle = g.acT; ctx.textBaseline = 'alphabetic';
    ctx.fillText(String(n + 1).padStart(2, '0'), g.x0, y + op.num.lh * .78); ctx.restore();
    let yy = crEscreve(ctx, a, { ...op.a, y: y + (op.num.lh - op.a.lh) * .5 });
    if (b) yy = crEscreve(ctx, b, { ...op.b, y: yy + u * 6 });
    y = yy + op.gap;
    if (n < itens.length - 1){ ctx.fillStyle = crRgba(g.fg, .12); ctx.fillRect(g.x0 + u * 118 * k, y, g.larg - u * 118 * k, Math.max(1, u * 1.5)); }
    y += op.gap;
  });
}

function crLNumero(ctx, g, c){
  const u = g.u, val = String(c.valor || '').trim() || '0';
  const tam = crCorpoQueCabe(ctx, val, g.larg, 800, u * 300);
  const numOp = { fonte: crFonte(800, tam), lh: tam * .98, cor: g.acT, maxL: g.larg * 1.05, x: g.x0, esp: -tam * .03, alinhar: g.alinhar };
  const rot = crTitulo(ctx, g, c.titulo, u * 50, u * 50 * 1.1 * 3, { peso:700, lhF:1.1 });
  const corpo = crApoioOp(g, { tam: 31 });
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 30 : 0;
  const hRot = c.titulo ? crAltura(ctx, c.titulo, rot) + u * 36 : 0;
  const hCorpo = c.corpo ? crAltura(ctx, c.corpo, corpo) : 0;
  let y = crAncora(g, olhoH + numOp.lh + u * 30 + hRot + hCorpo, 1);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 30;
  y = crEscreve(ctx, val, { ...numOp, y }) + u * 30;
  if (c.titulo) y = crEscreve(ctx, c.titulo, { ...rot, y }) + u * 36;
  if (c.corpo) crEscreve(ctx, c.corpo, { ...corpo, y });
}

function crLCitacao(ctx, g, c, lam){
  const u = g.u, foto = crFoto(lam, 'foto');
  const temAutor = c.autor || c.cargo;
  const hAutor = temAutor ? u * 110 : 0;
  const aspasTam = u * 230;
  const y0 = g.y0 + aspasTam * .62;
  const txt = crTitulo(ctx, g, c.titulo, u * 74, g.y1 - y0 - hAutor - u * 40, { peso:600, lhF:1.18, espF:-.008 });
  const hTxt = crAltura(ctx, c.titulo, txt);
  let y = crAncora(g, aspasTam * .62 + hTxt + u * 40 + hAutor, .5);
  ctx.save(); ctx.font = crFonte(800, aspasTam); ctx.fillStyle = g.ac; ctx.textBaseline = 'alphabetic';
  ctx.textAlign = g.alinhar === 'centro' ? 'center' : 'left';
  ctx.fillText('“', g.alinhar === 'centro' ? g.W / 2 : g.x0 - u * 8, y + aspasTam * .78); ctx.restore();
  y += aspasTam * .62;
  y = crEscreve(ctx, c.titulo, { ...txt, y }) + u * 40;
  if (!temAutor) return;
  const d = u * 84;
  let x = g.x0;
  const blocoW = (foto ? d + u * 22 : 0) + Math.max(
    crLarguraTexto(ctx, c.autor || '', { fonte: crFonte(700, u * 32), maxL: g.larg }),
    crLarguraTexto(ctx, c.cargo || '', { fonte: crMono(500, u * 19), maxL: g.larg, esp: u * 2, caixaAlta: true }));
  if (g.alinhar === 'centro') x = (g.W - blocoW) / 2;
  if (foto){
    crFotoEm(ctx, g, foto, x, y, d, d, cc => { cc.beginPath(); cc.arc(x + d / 2, y + d / 2, d / 2, 0, 7); });
    ctx.strokeStyle = g.ac; ctx.lineWidth = Math.max(2, u * 4);
    ctx.beginPath(); ctx.arc(x + d / 2, y + d / 2, d / 2 + u * 7, 0, 7); ctx.stroke();
    x += d + u * 26;
  } else {
    ctx.fillStyle = g.ac; ctx.fillRect(x, y + u * 18, u * 44, Math.max(2, u * 5)); x += u * 62;
    if (g.alinhar === 'centro') x -= u * 31;
  }
  const yT = y + (foto ? d / 2 - u * 34 : 0);
  crEscreve(ctx, c.autor, { fonte: crFonte(700, u * 32), lh: u * 40, cor: g.fg, maxL: g.larg, x, y: yT, alinhar:'esquerda' });
  crEscreve(ctx, c.cargo, { fonte: crMono(500, u * 19), lh: u * 28, cor: g.fg2, maxL: g.larg, x, y: yT + u * 44, esp: u * 2, caixaAlta: true, alinhar:'esquerda' });
}

/* a pessoa: foto em arco, círculo ou quadro, com o anel de acento */
function crLPessoa(ctx, g, c, lam){
  const u = g.u, foto = crFoto(lam, 'foto'), modo = lam.fotos?.foto?.modo || 'arco';
  const largo = g.W / g.H > 1.3;
  const disp = g.y1 - g.y0;
  let D = largo ? Math.min(disp * .9, g.W * .36) : Math.min(g.larg * (crVertical(g) ? .72 : .5), disp * (crVertical(g) ? .44 : .42));
  const hFoto = modo === 'arco' ? D * 1.16 : D;
  const cx = largo ? g.x0 + D / 2 : (g.alinhar === 'centro' ? g.W / 2 : g.x0 + D / 2);
  const fx = cx - D / 2;
  const tx = largo ? g.x0 + D + u * 64 : g.x0, tw = largo ? g.x1 - tx : g.larg;
  const al = largo ? 'esquerda' : g.alinhar;
  const nomeOp = crTituloOp(g, u * 96, 0, { maxL: tw, x: tx, alinhar: al });
  const sub = { fonte: crMono(500, u * 22), lh: u * 32, cor: g.fg2, maxL: tw, x: tx, esp: u * 2.8, caixaAlta: true, alinhar: al };
  const corpo = crApoioOp(g, { tam: 30, maxL: tw, x: tx, alinhar: al });
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 22 : 0;
  const hSub = c.sub ? crAltura(ctx, c.sub, sub) + u * 14 : 0;
  const hCorpo = c.corpo ? crAltura(ctx, c.corpo, corpo) + u * 30 : 0;
  const dispTexto = largo ? disp : disp - hFoto - u * 60;
  const nome = crEncaixa(ctx, c.titulo, nomeOp._base, { ...nomeOp, maxA: Math.max(u * 90, dispTexto - olhoH - hSub - hCorpo) });
  const hNome = crAltura(ctx, c.titulo, nome) + u * 22;
  const hTexto = olhoH + hNome + hSub + hCorpo;
  let fy, y;
  if (largo){ fy = g.y0 + (disp - hFoto) / 2; y = g.y0 + (disp - hTexto) / 2; }
  else { const tot = hFoto + u * 60 + hTexto; fy = crAncora(g, tot, .5); y = fy + hFoto + u * 60; }
  const forma = cc => {
    cc.beginPath();
    if (modo === 'circulo'){ cc.arc(cx, fy + D / 2, D / 2, 0, 7); }
    else if (modo === 'quadro'){ crRetArred(cc, fx, fy, D, hFoto, u * 30); }
    else { cc.moveTo(fx, fy + hFoto); cc.lineTo(fx, fy + D / 2); cc.arc(cx, fy + D / 2, D / 2, Math.PI, 0); cc.lineTo(fx + D, fy + hFoto); cc.closePath(); }
  };
  /* o acento atrás: anel no círculo, a mesma forma deslocada no resto */
  ctx.save();
  ctx.strokeStyle = g.ac; ctx.lineWidth = Math.max(3, u * 6);
  if (modo === 'circulo'){ ctx.beginPath(); ctx.arc(cx, fy + D / 2, D / 2 + u * 16, 0, 7); ctx.stroke(); }
  else { ctx.translate(u * 20, u * 20); forma(ctx); ctx.stroke(); }
  ctx.restore();
  if (foto) crFotoEm(ctx, g, foto, fx, fy, D, hFoto, forma);
  else crSemFoto(ctx, g, fx, fy, D, hFoto, forma, 'foto');
  /* a data, num selo sobre a foto */
  if (c.data){
    const dd = crData(c.data), txt = dd ? `${String(dd.getDate()).padStart(2, '0')} · ${CR_MESES[dd.getMonth()].slice(0, 3).toUpperCase()}` : String(c.data).toUpperCase();
    ctx.save(); ctx.font = crMono(600, u * 22);
    if ('letterSpacing' in ctx) ctx.letterSpacing = u * 2 + 'px';
    const w = ctx.measureText(txt).width + u * 36, h = u * 50;
    const sx = modo === 'circulo' ? cx + D * .3 : fx + D - w * .6, sy = fy + hFoto - h * (modo === 'circulo' ? 1.2 : .6);
    crRetArred(ctx, sx, sy, w, h, h / 2); ctx.fillStyle = g.ac; ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.textBaseline = 'middle'; ctx.fillText(txt, sx + u * 18, sy + h / 2 + u * 1);
    ctx.restore();
  }
  if (c.olho) y = crOlho(ctx, g, c.olho, tx, y, { maxL: tw, alinhar: al }) + u * 22;
  y = crEscreve(ctx, c.titulo, { ...nome, y }) + u * 22;
  if (c.sub) y = crEscreve(ctx, c.sub, { ...sub, y }) + u * 14;
  if (c.corpo) crEscreve(ctx, c.corpo, { ...corpo, y: y + u * 16 });
}

function crIconeRelogio(ctx, x, y, r, cor, lw){
  ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x, y - r * .55); ctx.lineTo(x, y); ctx.lineTo(x + r * .42, y + r * .3); ctx.stroke(); ctx.restore();
}
function crIconeLocal(ctx, x, y, r, cor, lw){
  ctx.save(); ctx.strokeStyle = cor; ctx.lineWidth = lw; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y + r * 1.15);
  ctx.bezierCurveTo(x - r * 1.3, y - r * .1, x - r * .95, y - r * 1.25, x, y - r * 1.2);
  ctx.bezierCurveTo(x + r * .95, y - r * 1.25, x + r * 1.3, y - r * .1, x, y + r * 1.15); ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y - r * .3, r * .36, 0, 7); ctx.stroke(); ctx.restore();
}
function crLEvento(ctx, g, c, lam){
  const u = g.u, modo = lam.fotos?.foto?.modo || 'nenhuma';
  let y0 = g.y0;
  if (modo === 'topo'){
    const hF = Math.round(g.H * .36);
    crFaixaFoto(ctx, g, lam, 0, 0, g.W, hF, 0);
    const tg = ctx.createLinearGradient(0, 0, 0, g.topo * 2.6);
    tg.addColorStop(0, 'rgba(4,10,9,.55)'); tg.addColorStop(1, 'rgba(4,10,9,0)');
    ctx.fillStyle = tg; ctx.fillRect(0, 0, g.W, g.topo * 2.6);
    g.corLogo = '#F5F5F7'; y0 = hF + u * 50;
  }
  const d = crData(c.data);
  const dia = d ? String(d.getDate()).padStart(2, '0') : String(c.data || '—').split(/[\/\s]/)[0];
  const mes = d ? CR_MESES[d.getMonth()] : '';
  const sem = d ? CR_DIAS[d.getDay()] : '';
  const tamDia = u * (modo === 'topo' ? 150 : 200);
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 26 : 0;
  const det = [c.hora && ['hora', c.hora], c.local && ['local', c.local]].filter(Boolean);
  const detOp = { fonte: crFonte(500, u * 30), lh: u * 30 * 1.34, cor: g.fg2, maxL: g.larg - u * 56, x: g.x0 + u * 56, alinhar:'esquerda' };
  const hDet = det.reduce((t, [, v]) => t + crAltura(ctx, v, detOp) + u * 14, 0);
  const hCta = c.cta ? u * 76 + u * 36 : 0;
  const tit = crTitulo(ctx, g, c.titulo, u * 84, g.y1 - y0 - olhoH - tamDia - u * 40 - hDet - hCta - u * 40, { peso:800, lhF:1 , alinhar:'esquerda' });
  const hTit = crAltura(ctx, c.titulo, tit) + u * 38;
  let y = crAncora(g, olhoH + tamDia * .86 + u * 40 + hTit + hDet + hCta, modo === 'topo' ? 0 : .3, y0);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y, { alinhar:'esquerda' }) + u * 26;
  /* o bloco da data: o dia enorme, o mês e o dia da semana ao lado */
  ctx.save(); ctx.font = crFonte(800, tamDia); ctx.fillStyle = g.fg; ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = (-tamDia * .04) + 'px';
  ctx.fillText(dia, g.x0 - tamDia * .04, y + tamDia * .78);
  const wDia = ctx.measureText(dia).width; ctx.restore();
  const xm = g.x0 + wDia + u * 30;
  ctx.fillStyle = g.ac; ctx.fillRect(xm, y + tamDia * .1, Math.max(3, u * 6), tamDia * .66);
  if (mes){
    crEscreve(ctx, mes, { fonte: crMono(600, u * 34), lh: u * 44, cor: g.acT, maxL: g.x1 - xm - u * 30, x: xm + u * 30, y: y + tamDia * .16, esp: u * 4, caixaAlta: true, alinhar:'esquerda' });
    crEscreve(ctx, sem + (d ? ' · ' + d.getFullYear() : ''), { fonte: crMono(500, u * 24), lh: u * 34, cor: g.fg2, maxL: g.x1 - xm - u * 30, x: xm + u * 30, y: y + tamDia * .16 + u * 52, esp: u * 2, caixaAlta: true, alinhar:'esquerda' });
  }
  y += tamDia * .86 + u * 40;
  y = crEscreve(ctx, c.titulo, { ...tit, y }) + u * 38;
  for (const [tipo, v] of det){
    const r = u * 13, cy = y + detOp.lh * .5;
    (tipo === 'hora' ? crIconeRelogio : crIconeLocal)(ctx, g.x0 + r + u * 4, cy, r, g.acT, Math.max(1.5, u * 3));
    y = crEscreve(ctx, v, { ...detOp, y }) + u * 14;
  }
  if (c.cta){
    y += u * 36;
    ctx.save(); ctx.font = crFonte(700, u * 28);
    const w = Math.min(g.larg, ctx.measureText(c.cta).width + u * 64);
    crRetArred(ctx, g.x0, y, w, u * 76, u * 38); ctx.fillStyle = g.ac; ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.textBaseline = 'middle'; ctx.fillText(c.cta, g.x0 + u * 32, y + u * 39); ctx.restore();
  }
}

/* na mídia: o veículo como cabeçalho, a tela com a imagem da
   reportagem e a manchete entre aspas */
function crLMidia(ctx, g, c, lam){
  const u = g.u, foto = crFoto(lam, 'foto');
  const largo = g.W / g.H > 1.3;
  const video = (c.tipo || 'video') === 'video';
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 18 : 0;
  const vei = String(c.veiculo || '').trim();
  const tamV = vei ? Math.min(u * 104, crCorpoQueCabe(ctx, vei, largo ? g.larg * .42 : g.larg, 800, u * 104)) : 0;
  const tw = largo ? g.larg * .44 : g.larg;
  const tx = g.x0;
  const telaW = largo ? g.larg * .5 : g.larg, telaH = telaW * 9 / 16;
  const telaX = largo ? g.x1 - telaW : g.x0;
  const man = crTitulo(ctx, g, c.titulo, u * 50, (largo ? g.y1 - g.y0 : g.y1 - g.y0 - telaH) - olhoH - tamV - u * 190, { peso:600, lhF:1.2, maxL: tw - u * 44, x: tx + u * 44, alinhar:'esquerda' });
  const hMan = c.titulo ? crAltura(ctx, c.titulo, man) : 0;
  const hRodape = (c.sub ? u * 40 : 0) + (c.cta ? u * 48 : 0);
  const hTexto = olhoH + tamV + u * 34 + hMan + u * 34 + hRodape;
  let y, telaY;
  if (largo){ y = crAncora(g, hTexto, .5); telaY = g.y0 + (g.y1 - g.y0 - telaH) / 2; }
  else {
    const tot = olhoH + tamV + u * 36 + telaH + u * 44 + hMan + u * 30 + hRodape;
    y = crAncora(g, tot, .4); telaY = y + olhoH + tamV + u * 36;
  }
  if (c.olho) y = crOlho(ctx, g, c.olho, tx, y, { alinhar:'esquerda' }) + u * 18;
  if (vei){ crEscreve(ctx, vei, { fonte: crFonte(800, tamV), lh: tamV * 1.02, cor: g.fg, maxL: largo ? g.larg * .46 : g.larg, x: tx, y, esp: -tamV * .02, alinhar:'esquerda' }); y += tamV * 1.02; }
  /* a tela */
  const r = u * 20;
  ctx.save();
  ctx.fillStyle = crRgba('#000000', .35); crRetArred(ctx, telaX + u * 6, telaY + u * 14, telaW, telaH, r); ctx.fill();
  ctx.restore();
  if (foto) crFotoEm(ctx, g, foto, telaX, telaY, telaW, telaH, cc => crRetArred(cc, telaX, telaY, telaW, telaH, r));
  else {
    ctx.save(); crRetArred(ctx, telaX, telaY, telaW, telaH, r); ctx.clip();
    const lg = ctx.createLinearGradient(telaX, telaY, telaX + telaW, telaY + telaH);
    lg.addColorStop(0, '#0B7D6E'); lg.addColorStop(1, '#00352F'); ctx.fillStyle = lg; ctx.fillRect(telaX, telaY, telaW, telaH);
    crHalo(ctx, telaX + telaW * .8, telaY, telaW * .6, g.ac, .35); ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = crRgba(g.fg, .22); ctx.lineWidth = Math.max(1.5, u * 2.5);
  crRetArred(ctx, telaX, telaY, telaW, telaH, r); ctx.stroke(); ctx.restore();
  if (video){
    const pr = Math.min(telaW, telaH) * .13, pcx = telaX + telaW / 2, pcy = telaY + telaH / 2;
    ctx.save(); ctx.fillStyle = g.ac; ctx.beginPath(); ctx.arc(pcx, pcy, pr, 0, 7); ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.beginPath();
    ctx.moveTo(pcx - pr * .3, pcy - pr * .45); ctx.lineTo(pcx + pr * .5, pcy); ctx.lineTo(pcx - pr * .3, pcy + pr * .45); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  if (!largo) y = telaY + telaH + u * 44; else y += u * 34;
  if (c.titulo){
    ctx.save(); ctx.font = crFonte(800, u * 78); ctx.fillStyle = g.ac; ctx.textBaseline = 'alphabetic';
    ctx.fillText('“', tx - u * 2, y + u * 58); ctx.restore();
    y = crEscreve(ctx, c.titulo, { ...man, y }) + u * 30;
  }
  if (c.sub) y = crEscreve(ctx, c.sub, { fonte: crMono(500, u * 20), lh: u * 30, cor: g.fg2, maxL: tw, x: tx, y, esp: u * 2.2, caixaAlta: true, alinhar:'esquerda' }) + u * 10;
  if (c.cta) crEscreve(ctx, c.cta + ' →', { fonte: crFonte(700, u * 27), lh: u * 36, cor: g.acT, maxL: tw, x: tx, y, alinhar:'esquerda' });
}

/* o logo de alguém de fora cabe inteiro, sem corte */
function crContem(ctx, img, x, y, w, h){
  const [iw, ih] = crDim(img), k = Math.min(w / iw, h / ih);
  ctx.drawImage(img, x + (w - iw * k) / 2, y + (h - ih * k) / 2, iw * k, ih * k);
}
function crLParceiro(ctx, g, c, lam){
  const u = g.u, logo = crFoto(lam, 'foto2');
  const lado = u * (crVertical(g) ? 170 : 132);
  const nome = String(c.parceiro || '').trim();
  const wP = logo ? Math.min(lado * 2.3, lado * crDim(logo.img)[0] / crDim(logo.img)[1] + lado * .5) : Math.max(lado, u * 40 + (nome.length * u * 22));
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 24 : 0;
  const corpo = crApoioOp(g, { tam: 31 });
  const hCorpo = c.corpo ? crAltura(ctx, c.corpo, corpo) + u * 50 : 0;
  const tit = crTitulo(ctx, g, c.titulo, u * 100, g.y1 - g.y0 - lado - u * 80 - olhoH - hCorpo - u * 40);
  const hTit = crAltura(ctx, c.titulo, tit);
  let y = crAncora(g, lado + u * 80 + olhoH + hTit + hCorpo + u * 40, .55);
  /* o par: o símbolo da NRO × o parceiro */
  const xW = u * 70, total = lado + xW + wP;
  let x = g.alinhar === 'centro' ? (g.W - total) / 2 : g.x0;
  ctx.save();
  crRetArred(ctx, x, y, lado, lado, u * 26); ctx.fillStyle = '#00352F'; ctx.fill();
  crTile(ctx, x + lado * .17, y + lado * .17, lado * .66, '#CEDC00');
  ctx.font = crFonte(500, u * 44); ctx.fillStyle = g.fg2; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('×', x + lado + xW / 2, y + lado / 2);
  const px = x + lado + xW;
  crRetArred(ctx, px, y, wP, lado, u * 26); ctx.fillStyle = '#FFFFFF'; ctx.fill();
  if (logo) crContem(ctx, logo.img, px + lado * .16, y + lado * .16, wP - lado * .32, lado * .68);
  else if (nome){ ctx.font = crFonte(800, u * 34); ctx.fillStyle = '#00352F'; ctx.fillText(nome, px + wP / 2, y + lado / 2); }
  else { ctx.font = crMono(500, u * 16); ctx.fillStyle = '#6B7A75'; ctx.fillText('LOGO', px + wP / 2, y + lado / 2); }
  ctx.restore();
  y += lado + u * 80;
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 24;
  y = crEscreve(ctx, c.titulo, { ...tit, y });
  crRegua(ctx, g, g.x0, y + u * 26);
  if (c.corpo) crEscreve(ctx, c.corpo, { ...corpo, y: y + u * 60 });
}

function crIconesAcao(ctx, g, x, y, lado, cor){
  const u = g.u, r = lado / 2, lw = Math.max(2, u * 3.4);
  const icones = [
    ['Curta', (cx, cy) => { ctx.beginPath(); const s = r * .5;
      ctx.moveTo(cx, cy + s * .9); ctx.bezierCurveTo(cx - s * 2, cy - s * .2, cx - s * .9, cy - s * 1.6, cx, cy - s * .55);
      ctx.bezierCurveTo(cx + s * .9, cy - s * 1.6, cx + s * 2, cy - s * .2, cx, cy + s * .9); ctx.stroke(); }],
    ['Comente', (cx, cy) => { const s = r * .5; ctx.beginPath(); ctx.arc(cx, cy, s, Math.PI * .75, Math.PI * .6 + Math.PI * 2 - .1);
      ctx.lineTo(cx - s * 1.05, cy + s * 1.05); ctx.closePath(); ctx.stroke(); }],
    ['Compartilhe', (cx, cy) => { const s = r * .52; ctx.beginPath(); ctx.moveTo(cx - s, cy - s * .2); ctx.lineTo(cx + s, cy - s);
      ctx.lineTo(cx + s * .15, cy + s); ctx.lineTo(cx - s * .1, cy + s * .05); ctx.closePath(); ctx.moveTo(cx - s * .1, cy + s * .05); ctx.lineTo(cx + s, cy - s); ctx.stroke(); }],
    ['Salve', (cx, cy) => { const s = r * .46; ctx.beginPath(); ctx.moveTo(cx - s * .8, cy - s); ctx.lineTo(cx + s * .8, cy - s);
      ctx.lineTo(cx + s * .8, cy + s * 1.05); ctx.lineTo(cx, cy + s * .45); ctx.lineTo(cx - s * .8, cy + s * 1.05); ctx.closePath(); ctx.stroke(); }]
  ];
  const passo = lado + u * 40;
  ctx.save(); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  icones.forEach(([rot, desenha], n) => {
    const cx = x + n * passo + r, cy = y + r;
    ctx.strokeStyle = crRgba(cor, .28); ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = n === 3 ? g.acT : cor; desenha(cx, cy);
    ctx.font = crMono(500, u * 15); ctx.fillStyle = g.fg2; ctx.textAlign = 'center';
    if ('letterSpacing' in ctx) ctx.letterSpacing = u * 1.4 + 'px';
    ctx.fillText(rot.toUpperCase(), cx, cy + r + u * 34);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  });
  ctx.restore();
  return icones.length * passo - u * 40;
}
function crLCta(ctx, g, c){
  const u = g.u, site = String(c.site || '').trim();
  const tamS = site ? crCorpoQueCabe(ctx, site, g.larg, 700, u * 68) : 0;
  const sub = crApoioOp(g, { tam: 31 });
  const hSub = c.sub ? crAltura(ctx, c.sub, sub) + u * 30 : 0;
  const hIc = c.icones === false ? 0 : u * 150;
  const tit = crTitulo(ctx, g, c.titulo, u * 104, (g.y1 - g.y0) * .5);
  const hTit = crAltura(ctx, c.titulo, tit);
  let y = crAncora(g, hIc + hTit + u * 60 + hSub + (site ? tamS * 1.15 + u * 20 : 0), .9);
  if (hIc){
    const lado = u * 78, w = 4 * lado + 3 * u * 40;
    crIconesAcao(ctx, g, g.alinhar === 'centro' ? (g.W - w) / 2 : g.x0, y, lado, g.fg);
    y += hIc;
  }
  y = crEscreve(ctx, c.titulo, { ...tit, y });
  crRegua(ctx, g, g.x0, y + u * 24);
  y += u * 60;
  if (c.sub) y = crEscreve(ctx, c.sub, { ...sub, y }) + u * 30;
  if (site) crEscreve(ctx, site, { fonte: crFonte(700, tamS), lh: tamS * 1.15, cor: g.fg, maxL: g.larg, x: g.x0, y, esp: -tamS * .02, alinhar: g.alinhar });
}

/* a foto manda: bastidores, registro, um momento */
function crLFoto(ctx, g, c, lam){
  const u = g.u;
  if (!crFoto(lam, 'foto')) crSemFoto(ctx, g, g.x0, g.y0, g.larg, (g.y1 - g.y0) * .62, null, 'a foto é a peça');
  const leg = crApoioOp(g, { tam: 31, cor: g.fg2 });
  const hLeg = c.sub ? crAltura(ctx, c.sub, leg) + u * 28 : 0;
  const tit = crTitulo(ctx, g, c.titulo, u * 72, (g.y1 - g.y0) * .4, { peso:700, lhF:1.06 });
  const hTit = c.titulo ? crAltura(ctx, c.titulo, tit) + u * 24 : 0;
  const hTag = c.olho ? u * 62 + u * 30 : 0;
  let y = crAncora(g, hTag + hTit + hLeg, 1);
  if (c.olho){
    ctx.save(); ctx.font = crMono(600, u * 21);
    if ('letterSpacing' in ctx) ctx.letterSpacing = u * 3 + 'px';
    const t = String(c.olho).toUpperCase(), w = ctx.measureText(t).width + u * 40;
    const x = g.alinhar === 'centro' ? (g.W - w) / 2 : g.x0;
    crRetArred(ctx, x, y, w, u * 62, u * 12); ctx.fillStyle = g.ac; ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.textBaseline = 'middle'; ctx.fillText(t, x + u * 20, y + u * 32);
    ctx.restore(); y += u * 62 + u * 30;
  }
  if (c.titulo) y = crEscreve(ctx, c.titulo, { ...tit, y }) + u * 24;
  if (c.sub) crEscreve(ctx, c.sub, { ...leg, y });
}

/* artigo: a primeira página, em papel, levemente girada */
function crLArtigo(ctx, g, c){
  const u = g.u;
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 34 : 0;
  const hRod = (c.cta ? u * 44 : 0) + u * 40;
  const cw = g.larg * .94, disp = g.y1 - g.y0 - olhoH - hRod;
  const ch = Math.min(disp, cw * (crVertical(g) ? 1.2 : g.H > g.W ? 1 : .62));
  let y = crAncora(g, olhoH + ch + hRod, .5);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 34;
  const cx = g.x0 + (g.larg - cw) / 2, pad = u * 50;
  ctx.save();
  ctx.translate(cx + cw / 2, y + ch / 2); ctx.rotate(-.025); ctx.translate(-(cx + cw / 2), -(y + ch / 2));
  ctx.fillStyle = crRgba(g.ac, .9); crRetArred(ctx, cx + u * 16, y + u * 16, cw, ch, u * 18); ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = u * 40; ctx.shadowOffsetY = u * 14;
  ctx.fillStyle = '#FBFBF8'; crRetArred(ctx, cx, y, cw, ch, u * 18); ctx.fill();
  ctx.shadowColor = 'transparent';
  let yy = y + pad;
  const iw = cw - pad * 2;
  yy = crEscreve(ctx, c.revista || 'Periódico', { fonte: crMono(600, u * 19), lh: u * 28, cor: '#0B7D6E', maxL: iw, x: cx + pad, y: yy, esp: u * 2.2, caixaAlta: true, alinhar:'esquerda' }) + u * 10;
  ctx.fillStyle = 'rgba(0,53,47,.18)'; ctx.fillRect(cx + pad, yy, iw, Math.max(1, u * 2)); yy += u * 30;
  const ano = [c.ano, c.doi].filter(Boolean).join(' · ');
  const hAut = c.autores ? u * 30 * 1.4 * 2 : 0;
  const top = crEncaixa(ctx, c.titulo, u * 50, { peso:700, lhF:1.14, maxL: iw, maxA: ch - (yy - y) - hAut - pad * 2 - u * 120, x: cx + pad, cor:'#101614', alinhar:'esquerda', espF:-.01 });
  yy = crEscreve(ctx, c.titulo, { ...top, y: yy }) + u * 22;
  if (c.autores) yy = crEscreve(ctx, c.autores, { fonte: crFonte(500, u * 25), lh: u * 25 * 1.4, cor:'#4B5854', maxL: iw, x: cx + pad, y: yy, alinhar:'esquerda', maxLinhas:2 }) + u * 28;
  /* o "texto" da página: barras cinza */
  const s = crSorte(c.titulo || 'a');
  while (yy < y + ch - pad - u * 56){
    ctx.fillStyle = 'rgba(16,22,20,.09)';
    ctx.fillRect(cx + pad, yy, iw * (.62 + s() * .38), u * 11); yy += u * 24;
  }
  if (ano) crEscreve(ctx, ano, { fonte: crMono(500, u * 17), lh: u * 26, cor:'#4B5854', maxL: iw, x: cx + pad, y: y + ch - pad - u * 20, alinhar:'esquerda' });
  ctx.restore();
  y += ch + u * 40;
  if (c.cta) crEscreve(ctx, c.cta + ' →', { fonte: crFonte(700, u * 28), lh: u * 38, cor: g.acT, maxL: g.larg, x: g.x0, y, alinhar: g.alinhar });
}

function crLEnquete(ctx, g, c){
  const u = g.u, ops = crItens(c.itens).slice(0, 4);
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 30 : 0;
  const opH = u * 96, gap = u * 22, hOps = ops.length * (opH + gap);
  const tit = crTitulo(ctx, g, c.titulo, u * 92, g.y1 - g.y0 - olhoH - hOps - u * 60);
  const hTit = crAltura(ctx, c.titulo, tit);
  let y = crAncora(g, olhoH + hTit + u * 60 + hOps, .5);
  if (c.olho) y = crOlho(ctx, g, c.olho, g.x0, y) + u * 30;
  y = crEscreve(ctx, c.titulo, { ...tit, y }) + u * 60;
  ops.forEach((o, n) => {
    ctx.save();
    crRetArred(ctx, g.x0, y, g.larg, opH, opH / 2);
    ctx.fillStyle = crRgba(g.fg, .06); ctx.fill();
    ctx.strokeStyle = crRgba(g.fg, .28); ctx.lineWidth = Math.max(1.5, u * 2.5); ctx.stroke();
    const r = opH * .32;
    ctx.fillStyle = g.ac; ctx.beginPath(); ctx.arc(g.x0 + opH / 2, y + opH / 2, r, 0, 7); ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.font = crFonte(800, r * 1.1); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ABCD'[n], g.x0 + opH / 2, y + opH / 2 + u * 1);
    ctx.restore();
    crEscreve(ctx, o, { fonte: crFonte(600, u * 33), lh: u * 40, cor: g.fg, maxL: g.larg - opH - u * 40, x: g.x0 + opH + u * 10, y: y + (opH - u * 40) / 2, alinhar:'esquerda', maxLinhas:1 });
    y += opH + gap;
  });
}

/* thumbnail: o título enorme, a foto de um lado, o selo no canto */
function crLThumb(ctx, g, c, lam){
  const u = g.u, foto = crFoto(lam, 'foto'), largo = g.W > g.H;
  const m = g.m * .8;
  if (largo){
    const fx = g.W * .47;
    const forma = cc => { cc.beginPath(); cc.moveTo(fx + g.W * .08, 0); cc.lineTo(g.W, 0); cc.lineTo(g.W, g.H); cc.lineTo(fx, g.H); cc.closePath(); };
    if (foto) crFotoEm(ctx, g, foto, fx, 0, g.W - fx, g.H, forma);
    else crSemFoto(ctx, g, fx, 0, g.W - fx, g.H, forma, 'foto');
    ctx.save(); forma(ctx); ctx.strokeStyle = g.ac; ctx.lineWidth = Math.max(4, u * 10);
    ctx.beginPath(); ctx.moveTo(fx + g.W * .08, 0); ctx.lineTo(fx, g.H); ctx.stroke(); ctx.restore();
  } else {
    const hF = g.H * .56;
    if (foto) crFotoEm(ctx, g, foto, 0, 0, g.W, hF); else crSemFoto(ctx, g, 0, 0, g.W, hF, null, 'foto');
    const lg = ctx.createLinearGradient(0, hF * .7, 0, hF); lg.addColorStop(0, crRgba(g.t.fundo[0], 0)); lg.addColorStop(1, crRgba(g.t.fundo[0], 1));
    ctx.fillStyle = lg; ctx.fillRect(0, hF * .7, g.W, hF * .3 + 1);
  }
  const tw = largo ? g.W * .5 - m : g.W - m * 2;
  let y = largo ? m : g.H * .56 + u * 30;
  if (c.selo){
    ctx.save(); ctx.font = crMono(600, u * (largo ? 30 : 28));
    if ('letterSpacing' in ctx) ctx.letterSpacing = u * 3 + 'px';
    const t = String(c.selo).toUpperCase(), w = ctx.measureText(t).width + u * 44, h = u * (largo ? 70 : 64);
    const sy = largo ? y : g.topo;
    crRetArred(ctx, m, sy, w, h, u * 10); ctx.fillStyle = g.ac; ctx.fill();
    ctx.fillStyle = g.sobreAc; ctx.textBaseline = 'middle'; ctx.fillText(t, m + u * 22, sy + h / 2 + u);
    ctx.restore();
    if (largo) y += h + u * 34;
  }
  const altLogo = u * (largo ? 38 : 44);
  const fimTexto = largo ? g.H - m - altLogo - u * 34 : g.H - g.m * 1.4 - altLogo - u * 30;
  const tit = crEncaixa(ctx, c.titulo, u * (largo ? 150 : 128) * g.estilo.escala, { ...crTituloOp(g, 0, fimTexto - y, { maxL: tw, x: m, lhF:.96, alinhar:'esquerda' }), maxA: fimTexto - y });
  const hT = crAltura(ctx, c.titulo, tit);
  y = largo ? Math.max(y, y + (fimTexto - y - hT) * .5) : y;
  crEscreve(ctx, c.titulo, { ...tit, y });
  if (g.estilo.logo !== 'nenhum') crMarcas(ctx, g, m, (largo ? g.H - m : g.H - g.m * 1.4) - altLogo, altLogo, g.corLogo || g.fg);
}

/* a tela final do vídeo: agradecimento à esquerda e os espaços que o
   YouTube cobre com os elementos (vídeos, inscrição) à direita */
function crLEncerramento(ctx, g, c, lam, peca, i, total, opt){
  const u = g.u, largo = g.W > g.H, m = g.m;
  const contas = crContas();
  const alt = u * 40;
  crMarcas(ctx, g, m, m, alt, g.corLogo || g.fg);
  const slot = (x, y, w, h, rot) => {
    ctx.save(); crRetArred(ctx, x, y, w, h, u * 16);
    ctx.fillStyle = crRgba(g.fg, .06); ctx.fill();
    ctx.strokeStyle = crRgba(g.fg, .24); ctx.lineWidth = Math.max(1.5, u * 2); ctx.stroke();
    if (opt?.previa){ ctx.font = crMono(500, u * 16); ctx.fillStyle = crRgba(g.fg, .5); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(rot, x + w / 2, y + h / 2); }
    ctx.restore();
  };
  const redes = Object.entries(contas).filter(([, v]) => v).slice(0, 4);
  const tw = largo ? g.W * .46 : g.larg;
  const tit = crTitulo(ctx, g, c.titulo, u * 96, g.H * .36, { maxL: tw, alinhar:'esquerda' });
  const sub = crApoioOp(g, { tam: 30, maxL: tw, alinhar:'esquerda' });
  let y = largo ? g.H * .24 : g.H * .14;
  y = crEscreve(ctx, c.titulo, { ...tit, y });
  crRegua(ctx, { ...g, alinhar:'esquerda' }, m, y + u * 22);
  y += u * 56;
  if (c.sub) y = crEscreve(ctx, c.sub, { ...sub, y }) + u * 44;
  const colW = tw / 2;
  redes.forEach(([k, v], n) => {
    const x = m + (n % 2) * colW, yy = y + Math.floor(n / 2) * u * 84;
    crEscreve(ctx, (STUDIO_REDES[k]?.l || k), { fonte: crMono(500, u * 17), lh: u * 26, cor: g.acT, maxL: colW - u * 20, x, y: yy, esp: u * 2.4, caixaAlta: true, alinhar:'esquerda' });
    crEscreve(ctx, v, { fonte: crFonte(600, u * 27), lh: u * 36, cor: g.fg, maxL: colW - u * 20, x, y: yy + u * 28, alinhar:'esquerda', maxLinhas:1 });
  });
  if (largo){
    const sw = g.W * .31, sh = sw * 9 / 16, sx = g.W - m - sw;
    slot(sx, g.H * .16, sw, sh, 'vídeo sugerido');
    slot(sx, g.H * .16 + sh + u * 36, sw, sh, 'vídeo sugerido');
    const r = g.H * .1;
    ctx.save(); ctx.strokeStyle = crRgba(g.ac, .8); ctx.lineWidth = Math.max(2, u * 4);
    ctx.beginPath(); ctx.arc(sx - r - u * 60, g.H * .16 + sh * 2 + u * 36 - r, r, 0, 7); ctx.stroke(); ctx.restore();
    if (opt?.previa){ ctx.font = crMono(500, u * 15); ctx.fillStyle = crRgba(g.fg, .5); ctx.textAlign = 'center';
      ctx.fillText('INSCREVA-SE', sx - r - u * 60, g.H * .16 + sh * 2 + u * 36 - r + u * 5); ctx.textAlign = 'left'; }
  } else {
    const sw = g.larg, sh = sw * 9 / 16;
    slot(m, g.H - m * 1.2 - sh, sw, sh, 'vídeo sugerido');
  }
}

/* barra de nome (lower third): o PNG sai transparente, para ir por
   cima do vídeo no editor */
function crLBarra(ctx, g, c){
  const u = g.u, largo = g.W > g.H, est = g.estilo.barra;
  const x = largo ? g.W * .065 : g.W * .07, yb = largo ? g.H * .8 : g.H * .7;
  const nome = String(c.titulo || 'Nome').trim(), cargo = String(c.sub || '').trim();
  const nF = crFonte(700, u * (largo ? 46 : 52)), cF = crMono(500, u * (largo ? 19 : 22));
  ctx.save();
  ctx.font = nF; const wN = ctx.measureText(nome).width;
  ctx.font = cF; if ('letterSpacing' in ctx) ctx.letterSpacing = u * 2.4 + 'px';
  const wC = cargo ? ctx.measureText(cargo.toUpperCase()).width : 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const pad = u * 26, hN = u * (largo ? 54 : 62), hC = cargo ? u * (largo ? 32 : 36) : 0;
  const tile = g.estilo.logo !== 'nenhum' && est !== 'linha';
  const hBox = pad * 2 + hN + hC, lTile = tile ? hBox - pad * 1.2 : 0;
  const wBox = pad * 2 + Math.max(wN, wC) + (tile ? lTile + pad * .9 : 0) + u * 10;
  const y = yb - hBox;
  const corTexto = est === 'clara' ? '#101614' : '#F5F5F7', corCargo = est === 'clara' ? '#45625B' : 'rgba(245,245,247,.82)';
  if (est === 'solida'){
    ctx.fillStyle = g.t.escuro ? g.t.fundo[0] : '#00352F'; ctx.fillRect(x, y, wBox, hBox);
    ctx.fillStyle = g.ac; ctx.fillRect(x - u * 10, y, u * 10, hBox);
  } else if (est === 'vidro'){
    crRetArred(ctx, x, y, wBox, hBox, u * 16); ctx.fillStyle = 'rgba(5,10,9,.62)'; ctx.fill();
    ctx.strokeStyle = 'rgba(245,245,247,.2)'; ctx.lineWidth = Math.max(1, u * 1.6); ctx.stroke();
    ctx.fillStyle = g.ac; ctx.fillRect(x + pad * .5, y + hBox - u * 8, u * 70, u * 4);
  } else if (est === 'clara'){
    ctx.fillStyle = '#F5F5F7'; ctx.fillRect(x, y, wBox, hBox);
    ctx.fillStyle = g.ac; ctx.fillRect(x - u * 10, y, u * 10, hBox);
  } else {
    ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = u * 18;
  }
  let tx = x + pad;
  if (tile){ crTile(ctx, tx, y + pad * .6, lTile, est === 'clara' ? '#00352F' : '#F5F5F7'); tx += lTile + pad * .9; }
  if (est === 'linha') tx = x;
  ctx.font = nF; ctx.fillStyle = corTexto; ctx.textBaseline = 'alphabetic';
  ctx.fillText(nome, tx, y + pad + hN * .8);
  if (cargo){
    ctx.font = cF; ctx.fillStyle = est === 'linha' ? '#F5F5F7' : corCargo;
    if ('letterSpacing' in ctx) ctx.letterSpacing = u * 2.4 + 'px';
    ctx.fillText(cargo.toUpperCase(), tx, y + pad + hN + hC * .72);
  }
  if (est === 'linha'){ ctx.shadowColor = 'transparent'; ctx.fillStyle = g.ac; ctx.fillRect(x, y + pad + hN + hC + u * 12, Math.max(wN, wC) * .6, u * 6); }
  ctx.restore();
}

/* cartela de título: o começo do vídeo, ou o começo de um bloco */
function crLCartela(ctx, g, c){
  const u = g.u;
  const al = { ...g, alinhar:'centro' };
  const alt = u * 40;
  const olhoH = c.olho ? g.u * 23 * 1.42 + u * 30 : 0;
  const sub = crApoioOp(al, { tam: 32, alinhar:'centro' });
  const hSub = c.sub ? crAltura(ctx, c.sub, sub) + u * 64 : u * 30;
  const tit = crTitulo(ctx, al, c.titulo, u * 124, g.H * .5, { alinhar:'centro' });
  const hTit = crAltura(ctx, c.titulo, tit);
  let y = (g.H - (olhoH + hTit + hSub)) / 2 - u * 20;
  if (c.olho) y = crOlho(ctx, al, c.olho, g.x0, y, { alinhar:'centro' }) + u * 30;
  y = crEscreve(ctx, c.titulo, { ...tit, y });
  crRegua(ctx, al, g.x0, y + u * 28);
  if (c.sub) crEscreve(ctx, c.sub, { ...sub, y: y + u * 64 });
  if (g.estilo.logo !== 'nenhum'){
    const w = crLarguraMarcas(g, alt);
    crMarcas(ctx, g, (g.W - w) / 2, g.H - g.m - alt, alt, g.corLogo || g.fg);
  }
}

/* ============================================================
   O CATÁLOGO DE LEIAUTES
   campos: [chave, rótulo, tipo, dica]. Tipos: texto, area, lista
   (um item por linha), data, sel:<a|b>. fotos: [chave, rótulo, modos].
   ============================================================ */
const CR_LAYOUTS = {
  capa:     { l:'Capa', d:'Título grande, olho e apoio; a foto de fundo ou em faixa', desenha: crLCapa,
              campos:[['olho','Olho','texto'],['titulo','Título','area'],['sub','Apoio','area']],
              fotos:[['foto','Foto',['fundo','topo','nenhuma']]] },
  texto:    { l:'Texto', d:'Rótulo, título, parágrafo e tópicos', desenha: crLTexto,
              campos:[['olho','Rótulo','texto'],['titulo','Título','area'],['corpo','Texto','area'],['itens','Tópicos','lista']],
              fotos:[['foto','Foto',['nenhuma','moldura','fundo']]] },
  lista:    { l:'Lista numerada', d:'Passos, dicas, etapas: 01, 02, 03…', desenha: crLLista,
              campos:[['olho','Rótulo','texto'],['titulo','Título','area'],['itens','Itens (“Título — descrição”)','lista']],
              fotos:[['foto','Foto',['nenhuma','fundo']]] },
  numero:   { l:'Número', d:'Um dado grande, com o que ele quer dizer', desenha: crLNumero,
              campos:[['olho','Rótulo','texto'],['valor','Número','texto'],['titulo','O que é','area'],['corpo','Contexto','area']],
              fotos:[['foto','Foto',['nenhuma','fundo']]] },
  citacao:  { l:'Citação', d:'Frase, depoimento, com quem disse', desenha: crLCitacao,
              campos:[['titulo','Citação','area'],['autor','Quem disse','texto'],['cargo','Cargo / contexto','texto']],
              fotos:[['foto','Foto de quem disse',['circulo']]] },
  pessoa:   { l:'Pessoa', d:'Aniversário, boas-vindas, destaque: a foto em arco, círculo ou quadro', desenha: crLPessoa,
              campos:[['olho','Olho','texto'],['titulo','Nome','area'],['sub','Cargo / grupo','texto'],['corpo','Mensagem','area'],['data','Data (selo)','data']],
              fotos:[['foto','Foto',['arco','circulo','quadro']]], pessoa:true },
  evento:   { l:'Evento', d:'Data em destaque, hora, local e chamada', desenha: crLEvento,
              campos:[['olho','Olho','texto'],['titulo','Evento','area'],['data','Data','data'],['hora','Hora','texto'],['local','Local','texto'],['cta','Chamada','texto']],
              fotos:[['foto','Foto',['nenhuma','topo','fundo']]] },
  midia:    { l:'Na mídia', d:'O veículo, a tela com a reportagem e a manchete', desenha: crLMidia,
              campos:[['olho','Olho','texto'],['veiculo','Veículo','texto'],['titulo','Manchete','area'],['sub','Programa / data','texto'],['cta','Chamada','texto'],['tipo','Tipo','sel:video|materia']],
              fotos:[['foto','Imagem da reportagem',['tela']]] },
  parceiro: { l:'Parceiro', d:'NeuroDynamics × parceiro: parabéns, parceria, agradecimento', desenha: crLParceiro,
              campos:[['olho','Olho','texto'],['titulo','Título','area'],['corpo','Texto','area'],['parceiro','Nome do parceiro','texto']],
              fotos:[['foto2','Logo do parceiro',['logo']]] },
  cta:      { l:'Chamada final', d:'O fecho do carrossel: salve, compartilhe, o endereço', desenha: crLCta,
              campos:[['titulo','Título','area'],['sub','Apoio','area'],['site','Endereço / perfil','texto']],
              fotos:[['foto','Foto',['nenhuma','fundo']]] },
  foto:     { l:'Foto', d:'A foto é a peça: bastidores, registro', desenha: crLFoto,
              campos:[['olho','Etiqueta','texto'],['titulo','Legenda curta','area'],['sub','Apoio','area']],
              fotos:[['foto','Foto',['fundo']]] },
  artigo:   { l:'Artigo', d:'A primeira página do artigo, em papel', desenha: crLArtigo,
              campos:[['olho','Olho','texto'],['revista','Periódico','texto'],['titulo','Título do artigo','area'],['autores','Autores','area'],['ano','Ano','texto'],['doi','DOI','texto'],['cta','Chamada','texto']],
              fotos:[] },
  enquete:  { l:'Enquete', d:'Pergunta e opções (ponha o adesivo por cima)', desenha: crLEnquete,
              campos:[['olho','Olho','texto'],['titulo','Pergunta','area'],['itens','Opções (até 4)','lista']],
              fotos:[['foto','Foto',['nenhuma','fundo']]] },
  thumb:    { l:'Thumbnail', d:'Título enorme, foto de um lado, selo', desenha: crLThumb, semMoldura:true,
              campos:[['selo','Selo','texto'],['titulo','Título','area']],
              fotos:[['foto','Foto',['lado']]] },
  encerramento: { l:'Encerramento de vídeo', d:'Obrigado, as redes e os espaços dos elementos do YouTube', desenha: crLEncerramento, semMoldura:true,
              campos:[['titulo','Título','area'],['sub','Apoio','area']], fotos:[] },
  barra:    { l:'Barra de nome', d:'Nome e cargo sobre o vídeo, fundo transparente', desenha: crLBarra, semMoldura:true, transparente:true,
              campos:[['titulo','Nome','texto'],['sub','Cargo','texto']], fotos:[] },
  cartela:  { l:'Cartela de título', d:'Olho, título e apoio, no centro', desenha: crLCartela, semMoldura:true,
              campos:[['olho','Olho','texto'],['titulo','Título','area'],['sub','Apoio','area']],
              fotos:[['foto','Foto',['nenhuma','fundo']]] }
};
const CR_MODOS = { fundo:'De fundo', topo:'Em faixa, em cima', nenhuma:'Sem foto', moldura:'Em moldura', arco:'Arco',
  circulo:'Círculo', quadro:'Quadro', tela:'Na tela', logo:'Logo', lado:'Ao lado' };

/* ============================================================
   OS MODELOS
   Cada um é uma peça pronta para mudar: tamanhos que fazem sentido,
   o estilo de partida e as lâminas com um texto de exemplo que já
   ensina o tom. A legenda sugerida vem junto, para o plano.
   ============================================================ */
const CR_HASH = '#NeuroDynamics #UFMG #LABBIO #Bioengenharia';
const crL = (layout, campos, fotos) => ({ layout, campos, fotos: fotos || {} });
const CR_MODELOS = {
  na_midia: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'void', decoracao:'ondas' },
    laminas:[ crL('midia', { olho:'Na mídia', veiculo:'Jornal Nacional', titulo:'Tecnologia criada na UFMG leva atleta paraplégico a competir na Suíça',
      sub:'TV Globo · outubro de 2024', cta:'Assista no link da bio', tipo:'video' }, { foto:{ modo:'tela' } }) ],
    legenda: c => `Saímos no ${c.veiculo || 'jornal'}! 📺\n\n${String(c.titulo || '').replace(/[“”"]/g, '')}\n\nA reportagem completa está no link da bio.\n\n${CR_HASH} #NaMídia` },
  projeto: { tamanhos:['feed','quadrado','documento','stories'], estilo:{ tema:'cortex', decoracao:'rede' },
    laminas:[
      crL('capa', { olho:'Projeto em foco', titulo:'Órion: *instrumentação* sem concessões', sub:'Hardware, firmware e software projetados como um sistema só.' }, { foto:{ modo:'fundo' } }),
      crL('texto', { olho:'01 · O problema', titulo:'Em procedimentos críticos, precisão não é negociável', corpo:'Equipamentos genéricos resolvem o caso médio. O caso que importa quase nunca é o médio.' }),
      crL('texto', { olho:'02 · A solução', titulo:'Um sistema pensado de ponta a ponta', itens:'Sensores e eletrônica projetados aqui\nFirmware em tempo real\nSoftware que o clínico entende' }),
      crL('numero', { olho:'03 · Onde estamos', valor:'0,1 mm', titulo:'de resolução nos testes de bancada', corpo:'Próximo passo: validação com a equipe clínica parceira.' }),
      crL('lista', { olho:'04 · Quem faz', titulo:'Três frentes, uma equipe', itens:'Hardware — projeto e montagem das placas\nFirmware — controle em tempo real\nSoftware — interface e dados' }),
      crL('cta', { titulo:'Quer saber mais?', sub:'Todos os nossos projetos, em detalhe:', site:'neurodynamics.dev' }) ],
    legenda: c => `${String(c.titulo || 'Projeto em foco').replace(/\*/g, '')}\n\n${c.sub || ''}\n\nArraste para ver como ele funciona — e salve para mostrar para alguém. 🧠⚙️\n\n${CR_HASH} #Pesquisa #Engenharia` },
  aniversario: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'cortex', decoracao:'confete', alinhar:'centro', grade:false },
    laminas:[ crL('pessoa', { olho:'Feliz aniversário', titulo:'Ana Figueiredo', sub:'Gerente de projeto', corpo:'Que o novo ano venha com muitos testes que passam de primeira. Parabéns!', data:'' }, { foto:{ modo:'arco' } }) ],
    legenda: c => `Hoje é dia de celebrar ${c.titulo || 'uma pessoa especial'}! 🎉\n\n${c.corpo || ''}\n\nDeixe aqui o seu parabéns 👇\n\n#NeuroDynamics #Aniversário` },
  parabens: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'void', decoracao:'confete', alinhar:'centro', grade:false },
    laminas:[ crL('parceiro', { olho:'Parabéns', titulo:'Parabéns, equipe *Bem-te-vi*!', corpo:'Pelo 1º lugar na competição. Orgulho de caminhar junto com vocês.', parceiro:'Bem-te-vi' }, { foto2:{ modo:'logo' } }) ],
    legenda: c => `${String(c.titulo || 'Parabéns!').replace(/\*/g, '')} 👏\n\n${c.corpo || ''}\n\n#NeuroDynamics #Parceria` },
  boas_vindas: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'void', decoracao:'rede', alinhar:'centro' },
    laminas:[ crL('pessoa', { olho:'Boas-vindas', titulo:'Nome da pessoa', sub:'Engenharia de Software · Firmware', corpo:'Chega para somar ao time de firmware. Seja muito bem-vinda!' }, { foto:{ modo:'circulo' } }) ],
    legenda: c => `Boas-vindas, ${c.titulo || ''}! 👋\n\n${c.corpo || ''}\n\n#NeuroDynamics #NovoMembro` },
  conquista: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'cortex', decoracao:'formas' },
    laminas:[ crL('numero', { olho:'Conquista', valor:'1º lugar', titulo:'no Cybathlon Challenges 2024', corpo:'Na categoria de estimulação elétrica funcional, em Zurique, com a bicicleta desenvolvida no LABBIO.' }, { foto:{ modo:'nenhuma' } }) ],
    legenda: c => `${c.valor || ''} ${c.titulo || ''}! 🏆\n\n${c.corpo || ''}\n\nObrigado a quem fez isso acontecer.\n\n${CR_HASH}` },
  evento: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'void', decoracao:'rede' },
    laminas:[ crL('evento', { olho:'Save the date', titulo:'Demo Day NeuroDynamics', data:'', hora:'14h às 17h', local:'LABBIO · Escola de Engenharia da UFMG', cta:'Inscrições no link da bio' }, { foto:{ modo:'nenhuma' } }) ],
    legenda: c => `📅 ${c.titulo || 'Evento'}\n\n🕑 ${c.hora || ''}\n📍 ${c.local || ''}\n\n${c.cta || ''}\n\n${CR_HASH}` },
  aviso: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'aura', decoracao:'nenhuma' },
    laminas:[ crL('texto', { olho:'Aviso', titulo:'O LABBIO fecha no feriado de 12 de outubro', corpo:'Voltamos na terça, 13, no horário de sempre. Bom descanso!' }) ],
    legenda: c => `${c.titulo || ''}\n\n${c.corpo || ''}\n\n#NeuroDynamics` },
  frase: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'synapse', decoracao:'nenhuma', grade:false },
    laminas:[ crL('citacao', { titulo:'A engenharia só faz sentido quando devolve *autonomia* a alguém.', autor:'NeuroDynamics', cargo:'Manifesto da equipe' }) ],
    legenda: c => `“${String(c.titulo || '').replace(/\*/g, '')}”\n\n— ${c.autor || ''}\n\n#NeuroDynamics #Inspiração` },
  dado: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'plasma', decoracao:'formas' },
    laminas:[ crL('numero', { olho:'Em números', valor:'+2.000', titulo:'horas de teste em bancada em 2026', corpo:'Cada protótipo passa por aqui antes de encontrar uma pessoa.' }) ],
    legenda: c => `${c.valor || ''} ${c.titulo || ''}.\n\n${c.corpo || ''}\n\n${CR_HASH}` },
  bastidores: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'void', decoracao:'nenhuma', grade:false, escurecer:48 },
    laminas:[ crL('foto', { olho:'Bastidores', titulo:'Sexta-feira no LABBIO: calibração do encoder da órtese', sub:'' }, { foto:{ modo:'fundo' } }) ],
    legenda: c => `${c.titulo || 'Bastidores'} 🔧\n\n${c.sub || ''}\n\n#NeuroDynamics #Bastidores #LABBIO` },
  dicas: { tamanhos:['feed','quadrado','documento'], estilo:{ tema:'void', decoracao:'rede' },
    laminas:[
      crL('capa', { olho:'Guia rápido', titulo:'5 coisas que ninguém te conta sobre *prototipar* hardware', sub:'Aprendidas do jeito difícil, no LABBIO.' }, { foto:{ modo:'nenhuma' } }),
      crL('texto', { olho:'01', titulo:'O primeiro protótipo é para aprender, não para funcionar', corpo:'Faça rápido, meça tudo e aceite jogar fora.' }),
      crL('texto', { olho:'02', titulo:'Documente cada fio', corpo:'O você de daqui a três meses não lembra por que aquele resistor está ali.' }),
      crL('texto', { olho:'03', titulo:'Teste a alimentação antes de tudo', corpo:'Metade dos “defeitos misteriosos” é fonte ruim.' }),
      crL('texto', { olho:'04', titulo:'Tenha um plano B para cada peça importada', corpo:'O prazo do fornecedor não é o seu prazo.' }),
      crL('texto', { olho:'05', titulo:'Mostre cedo para quem vai usar', corpo:'A pessoa que usa enxerga o que a bancada não mostra.' }),
      crL('cta', { titulo:'Salve para consultar depois', sub:'E mande para quem está no primeiro protótipo.', site:'' }) ],
    legenda: c => `${String(c.titulo || '').replace(/\*/g, '')} 👇\n\nSalve para consultar depois.\n\n${CR_HASH} #Engenharia #Dicas` },
  vaga: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'cortex', decoracao:'rede' },
    laminas:[
      crL('capa', { olho:'Processo seletivo', titulo:'Venha construir *tecnologia* que devolve movimento', sub:'Inscrições abertas até 15 de outubro.' }, { foto:{ modo:'fundo' } }),
      crL('texto', { olho:'Quem procuramos', titulo:'Estudantes de qualquer curso da UFMG', itens:'Engenharias, computação e design\nVontade de aprender fazendo\n8 horas por semana' }),
      crL('lista', { olho:'Como funciona', titulo:'As etapas', itens:'Inscrição — pelo site, em 5 minutos\nDinâmica em grupo — um desafio de verdade\nEntrevista — uma conversa com a equipe' }),
      crL('cta', { titulo:'Inscreva-se', sub:'Edital, cronograma e perguntas frequentes:', site:'selecao.neurodynamics.dev' }) ],
    legenda: c => `${String(c.titulo || '').replace(/\*/g, '')} 🚀\n\n${c.sub || ''}\n\nTudo sobre o processo em selecao.neurodynamics.dev (link na bio).\n\n${CR_HASH} #ProcessoSeletivo` },
  artigo: { tamanhos:['feed','quadrado','paisagem'], estilo:{ tema:'cortex', decoracao:'rede' },
    laminas:[ crL('artigo', { olho:'Artigo publicado', revista:'Journal of NeuroEngineering and Rehabilitation', titulo:'Functional electrical stimulation cycling for people with spinal cord injury: a field study',
      autores:'A. Figueiredo, B. Tavares, C. Mendonça et al.', ano:'2026', doi:'doi.org/10.0000/jner.2026', cta:'Leia o artigo · link na bio' }) ],
    legenda: c => `Artigo publicado! 📄\n\n“${c.titulo || ''}”\n\n${c.revista || ''}${c.ano ? ', ' + c.ano : ''}.\n\nO texto completo está no link da bio.\n\n${CR_HASH} #Ciência` },
  agradecimento: { tamanhos:['feed','quadrado','stories','paisagem'], estilo:{ tema:'void', decoracao:'ondas' },
    laminas:[ crL('texto', { olho:'Obrigado', titulo:'Nada disso seria possível sem quem caminha com a gente', itens:'LABBIO — Laboratório de Bioengenharia\nEscola de Engenharia da UFMG\nCNPq\nAs famílias e os atletas parceiros' }) ],
    legenda: c => `${c.titulo || 'Obrigado!'} 💚\n\n${crItens(c.itens).join('\n')}\n\n#NeuroDynamics #Gratidão` },
  data: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'dendrito', decoracao:'ondas' },
    laminas:[ crL('capa', { olho:'8 de março', titulo:'Dia Internacional da *Mulher*', sub:'Às engenheiras, pesquisadoras e estudantes que constroem a NeuroDynamics todos os dias.' }, { foto:{ modo:'nenhuma' } }) ],
    legenda: c => `${String(c.titulo || '').replace(/\*/g, '')}.\n\n${c.sub || ''}\n\n#NeuroDynamics` },
  depoimento: { tamanhos:['feed','quadrado','stories'], estilo:{ tema:'ion', decoracao:'rede' },
    laminas:[ crL('citacao', { titulo:'Voltar a pedalar mudou a minha *rotina* — e a minha cabeça.', autor:'Nome do atleta', cargo:'Atleta parceiro do projeto' }, { foto:{ modo:'circulo' } }) ],
    legenda: c => `“${String(c.titulo || '').replace(/\*/g, '')}”\n\n— ${c.autor || ''}, ${c.cargo || ''}\n\n${CR_HASH}` },
  enquete: { tamanhos:['stories','feed','quadrado'], estilo:{ tema:'void', decoracao:'formas' },
    laminas:[ crL('enquete', { olho:'Enquete', titulo:'Qual projeto você quer ver nos próximos stories?', itens:'Órion\nDeriva\nCalima' }) ],
    legenda: c => `${c.titulo || ''}\n\nResponda nos stories! 👆` },
  thumbnail: { tamanhos:['thumb','reels'], estilo:{ tema:'void', decoracao:'nenhuma', grade:false, destaque:'marca', caixaAlta:true },
    laminas:[ crL('thumb', { selo:'Ep. 03', titulo:'Como construímos um *triciclo* adaptado' }, { foto:{ modo:'lado' } }) ],
    legenda: c => `${String(c.titulo || '').replace(/\*/g, '')}\n\n${CR_HASH}` },
  encerramento: { tamanhos:['video','video_v'], estilo:{ tema:'void', decoracao:'nenhuma' },
    laminas:[ crL('encerramento', { titulo:'Obrigado por assistir!', sub:'Inscreva-se para acompanhar os próximos episódios.' }) ] },
  barra_nome: { tamanhos:['video','video_v'], estilo:{ tema:'cortex', barra:'solida' },
    laminas:[ crL('barra', { titulo:'Ana Figueiredo', sub:'Gerente de projeto · NeuroDynamics' }) ] },
  cartela: { tamanhos:['video','video_v','thumb'], estilo:{ tema:'cortex', decoracao:'ondas' },
    laminas:[ crL('cartela', { olho:'Episódio 03', titulo:'Do protótipo à pista', sub:'Uma série sobre o caminho até o Cybathlon' }) ] },
  livre: { tamanhos:Object.keys(CR_TAMANHOS), estilo:{},
    laminas:[ crL('capa', { olho:'', titulo:'Seu título *aqui*', sub:'Troque o leiaute, o tema, a foto: tudo é seu.' }, { foto:{ modo:'nenhuma' } }) ] }
};
const crModelo = id => CR_MODELOS[id] || CR_MODELOS.livre;
const crNomeModelo = id => studioTipo(id)?.[1] || 'Livre';

/* uma peça nova, de um modelo — cópia funda, para não mexer no molde */
function crPecaNova(modelo, tamanho){
  const M = crModelo(modelo);
  const contas = crContas();
  const rodape = contas.instagram || contas.site || 'neurodynamics.dev';
  const hoje = new Date(), iso = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`;
  const laminas = JSON.parse(JSON.stringify(M.laminas)).map(l => {
    if (['evento', 'pessoa'].includes(l.layout) && 'data' in l.campos && !l.campos.data) l.campos.data = iso;
    if (l.layout === 'cta' && !l.campos.site && l.campos.site !== undefined) l.campos.site = rodape;
    return l;
  });
  return { v:1, modelo: CR_MODELOS[modelo] ? modelo : 'livre', tamanho: tamanho && M.tamanhos.includes(tamanho) ? tamanho : M.tamanhos[0],
    estilo: { ...CR_ESTILO_PADRAO, rodape, ...(M.estilo || {}) }, laminas, fotos:{} };
}
/* as contas da equipe, das configurações do Studio */
function crContas(){
  const c = state.studioCfg?.contas || {};
  return { site:'neurodynamics.dev', ...Object.fromEntries(Object.entries(c).filter(([, v]) => String(v || '').trim())) };
}

/* ============================================================
   DESENHAR UMA LÂMINA
   k é a escala: 1 é o tamanho da rede; a prévia usa menos, a
   exportação "alta" usa 4/3. opt.previa desenha as guias e o fundo
   quadriculado da barra de nome, que não saem no arquivo.
   ============================================================ */
function crGeo(peca, k){
  const T = CR_TAMANHOS[peca.tamanho] || CR_TAMANHOS.feed;
  const W = Math.round(T.w * k), H = Math.round(T.h * k);
  const u = Math.min(W, H * 1.25) / 1080;
  const m = Math.round(Math.min(W, H * 1.1) * .074);
  let topo = m, base = H - m;
  if (T.seguro){ topo = Math.round(H * T.seguro[0] / 1920) + Math.round(u * 10); base = H - Math.round(H * T.seguro[1] / 1920); }
  return { T, W, H, u, m, topo, base, larg: W - m * 2, x0: m, x1: W - m };
}
function crPinta(cv, peca, i, k, opt = {}){
  const g = crGeo(peca, k);
  if (cv.width !== g.W) cv.width = g.W;
  if (cv.height !== g.H) cv.height = g.H;
  const ctx = cv.getContext('2d');
  ctx.save();
  ctx.clearRect(0, 0, g.W, g.H);
  const lam = peca.laminas[i] || peca.laminas[0];
  const L = CR_LAYOUTS[lam.layout] || CR_LAYOUTS.capa;
  const estilo = { ...CR_ESTILO_PADRAO, ...(peca.estilo || {}) };
  Object.assign(g, crCores(estilo), { estilo, alinhar: estilo.alinhar, corLogo: null, sobreFoto: false });
  const total = peca.laminas.length;
  if (L.transparente){ if (opt.previa) crFundoPrevia(ctx, g); }
  else crFundo(ctx, g);
  const modo = lam.fotos?.foto?.modo;
  const fundo = modo === 'fundo' && crFoto(lam, 'foto');
  if (fundo){ crFotoFundo(ctx, g, fundo); crSobreFoto(g); }
  else if (modo === 'fundo' && L.fotos?.[0]?.[2]?.[0] === 'fundo' && lam.layout === 'foto'){ /* a lâmina de foto sem foto: o fundo do tema */ }
  if (!L.transparente) crDecora(ctx, g, (peca.modelo || '') + i + lam.layout);
  const alt = crAltLogo(g);
  const logoTopo = ['topo', 'topo-centro'].includes(estilo.logo);
  g.y0 = logoTopo || lam.campos?.selo || total > 1 ? g.topo + alt + g.u * 58 : g.topo;
  g.y1 = estilo.logo === 'rodape' ? g.base - alt - g.u * 44 : (estilo.rodape || (total > 1 && i === 0)) ? g.base - g.u * 60 : g.base;
  L.desenha(ctx, g, lam.campos || {}, lam, peca, i, total, opt);
  if (!L.semMoldura){ crCabecalho(ctx, g, lam, i, total); crRodape(ctx, g, i, total); }
  const cred = ['foto', 'foto2'].map(k2 => crFoto(lam, k2)?.credito).filter(Boolean)[0];
  if (cred && !L.transparente) crCredito(ctx, g, cred);
  if (opt.guias) crGuias(ctx, g);
  ctx.restore();
  return g;
}

/* ============================================================
   IMAGENS — enviar, Unsplash, da equipe, por link
   Toda imagem vira uma referência (f1, f2…) na peça; a lâmina guarda
   a referência, o modo e o enquadramento. O arquivo enviado sobe para
   o Storage só quando a peça é salva no quadro.
   ============================================================ */
const CR_UNSPLASH_BUSCAS = [
  ['Laboratório', 'bioengineering laboratory'], ['Placa e solda', 'circuit board macro'],
  ['Bancada', 'electronics workbench hands'], ['Impressão 3D', '3d printer close up'],
  ['Reabilitação', 'physiotherapy rehabilitation'], ['Esporte adaptado', 'wheelchair athlete'],
  ['Equipe', 'engineering students team'], ['Hospital', 'hospital technology'], ['Neurociência', 'neuroscience brain']
];
function crCarregaImg(src, cors){
  return new Promise((ok, erro) => {
    const i = new Image();
    if (cors) i.crossOrigin = 'anonymous';
    i.onload = () => ok(i);
    i.onerror = () => erro(new Error('A imagem não carregou.'));
    i.src = src;
  });
}
/* a imagem de fora só serve se o servidor dela deixar o canvas usá-la:
   senão a exportação quebraria no fim, na hora de baixar */
function crImgLimpa(img){
  try { const c = document.createElement('canvas'); c.width = c.height = 2;
    const x = c.getContext('2d'); x.drawImage(img, 0, 0, 2, 2); x.getImageData(0, 0, 1, 1); return true; }
  catch(e){ return false; }
}
function crReduz(img, max, tipo){
  const [w, h] = crDim(img), k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas'); c.width = Math.round(w * k); c.height = Math.round(h * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(b => ok(b), tipo, .9));
}
function crNovaRef(){ criador.n++; return 'f' + Date.now().toString(36) + criador.n; }
function crPoeFoto(chave, ref){
  const lam = crLamina(); lam.fotos = lam.fotos || {};
  const L = CR_LAYOUTS[lam.layout];
  const modos = (L.fotos || []).find(f => f[0] === chave)?.[2] || ['fundo'];
  const antes = lam.fotos[chave] || {};
  const modo = antes.modo && modos.includes(antes.modo) && antes.modo !== 'nenhuma' ? antes.modo : (modos.find(m => m !== 'nenhuma') || modos[0]);
  lam.fotos[chave] = { ref, modo, x:50, y: L.pessoa ? 30 : 50, zoom:1 };
  crMudou(true);
}
async function crEnviarFoto(chave, input){
  const f = input.files?.[0]; if (!f) return;
  if (!/^image\//.test(f.type)) return toast('Escolha um arquivo de imagem.', true);
  try {
    const orig = await crCarregaImg(URL.createObjectURL(f));
    const tipo = /png|webp|gif|svg/.test(f.type) ? 'image/png' : 'image/jpeg';
    const blob = await crReduz(orig, 3000, tipo);
    const img = await crCarregaImg(URL.createObjectURL(blob));
    const ref = crNovaRef();
    criador.imgs[ref] = { img, origem:'upload', blob, tipo, credito:'' };
    crPoeFoto(chave, ref);
  } catch(e){ falha(e, 'A foto não abriu'); }
  input.value = '';
}
async function crFotoDeLink(chave, url, credito, origem){
  try {
    const img = await crCarregaImg(url, true);
    if (!crImgLimpa(img)) throw new Error('esse endereço não deixa usar a imagem aqui — baixe e envie o arquivo');
    const ref = crNovaRef();
    criador.imgs[ref] = { img, origem: origem || 'url', url, credito: credito || '' };
    crPoeFoto(chave, ref);
    return true;
  } catch(e){ toast('A imagem não entrou: ' + e.message, true); return false; }
}
function crModalLink(chave){
  abreModal(`<h3>${ic('link')} Imagem por link</h3>
    <p class="small muted" style="line-height:1.6;margin-bottom:12px">Cole o endereço da <b>imagem</b> (termina em .jpg, .png…),
      ou o de uma foto do Unsplash (<code>images.unsplash.com/photo-…</code>). Pastas do Drive e álbuns não servem direto:
      baixe a foto e use <b>Enviar</b>.</p>
    <div class="fld"><label for="cr-lk">Endereço</label><input id="cr-lk" type="url" placeholder="https://…"></div>
    <div class="fld"><label for="cr-lk-c">Crédito (se precisar)</label><input id="cr-lk-c" placeholder="Nome do fotógrafo"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="crLinkOk('${chave}')">Usar</button></div>`);
  setTimeout(() => $('#cr-lk')?.focus(), 30);
}
async function crLinkOk(chave){
  let u = $('#cr-lk').value.trim(); if (!u) return;
  const m = u.match(/photo-[\w-]+/);
  if (m && /unsplash/.test(u)) u = `https://images.unsplash.com/${m[0]}?auto=format&fit=max&q=85&w=2400`;
  if (await crFotoDeLink(chave, u, $('#cr-lk-c').value.trim(), /unsplash/.test(u) ? 'unsplash' : 'url')) fechaModal();
}

/* Unsplash: com a chave de acesso (Studio › Configurações), busca aqui
   mesmo; sem ela, as buscas abrem o site e a foto entra por link. */
function crUnsplash(chave){
  const k = state.studioCfg?.unsplash_chave;
  criador.unsplash.chave = chave;
  abreModal(`<h3>${ic('imagem')} Fotos do Unsplash</h3>
    ${k ? `<div class="cr-us-busca"><input id="cr-us-q" placeholder="Buscar (em inglês rende mais): laboratory, circuit…"
        value="${esc(criador.unsplash.termo)}" onkeydown="if(event.key==='Enter')crUnsplashBusca(1)">
      <button class="btn solid mini" onclick="crUnsplashBusca(1)">${ic('lupa')} Buscar</button></div>`
      : `<div class="aviso-box info">Sem a chave do Unsplash, a busca abre no site. Escolha a foto, clique com o botão direito
        na imagem, <b>Copiar endereço da imagem</b>, e cole em <b>Link</b>. A gestão do Studio põe a chave em
        <a href="#/studio/config/contas" onclick="fechaModal()">Configurações</a> e a busca passa a ser aqui.</div>`}
    <div class="cr-us-sug">${CR_UNSPLASH_BUSCAS.map(([r, q]) => k
      ? `<button class="chip-b" onclick="$('#cr-us-q').value='${q}';crUnsplashBusca(1)">${r}</button>`
      : `<a class="chip-b" target="_blank" rel="noopener" href="https://unsplash.com/s/photos/${encodeURIComponent(q)}">${r} ↗</a>`).join('')}</div>
    <div id="cr-us-res" class="cr-us-res"></div>
    <div class="acts" style="justify-content:flex-end;margin-top:12px">
      ${k ? '' : `<button class="btn ghost" onclick="crModalLink('${chave}')">${ic('link')} Colar um link</button>`}
      <button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'largo');
  if (k && criador.unsplash.res.length) crUnsplashDesenha();
  setTimeout(() => $('#cr-us-q')?.focus(), 30);
}
async function crUnsplashBusca(pagina){
  const q = $('#cr-us-q')?.value.trim(); if (!q) return;
  criador.unsplash.termo = q; criador.unsplash.pagina = pagina;
  const T = CR_TAMANHOS[criador.peca.tamanho];
  const ori = T.w > T.h * 1.2 ? 'landscape' : T.h > T.w * 1.2 ? 'portrait' : 'squarish';
  $('#cr-us-res').innerHTML = '<div class="carregando"><span class="spin"></span> Buscando…</div>';
  try {
    const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=24&page=${pagina}&orientation=${ori}&client_id=${encodeURIComponent(state.studioCfg.unsplash_chave)}`);
    if (!r.ok) throw new Error(r.status === 401 ? 'a chave do Unsplash foi recusada' : 'o Unsplash respondeu ' + r.status);
    const j = await r.json();
    criador.unsplash.res = j.results || []; criador.unsplash.total = j.total_pages || 1;
    crUnsplashDesenha();
  } catch(e){ $('#cr-us-res').innerHTML = `<div class="aviso-box err">A busca falhou: ${esc(e.message)}.</div>`; }
}
function crUnsplashDesenha(){
  const u = criador.unsplash;
  $('#cr-us-res').innerHTML = u.res.length ? `<div class="cr-us-grade">${u.res.map((f, n) => `
      <button class="cr-us-f" onclick="crUnsplashUsa(${n})" title="${esc(f.alt_description || '')}">
        <img src="${esc(f.urls.small)}" alt="" loading="lazy"><span>${esc(f.user?.name || '')}</span></button>`).join('')}</div>
      <div class="cr-us-pag">${u.pagina > 1 ? `<button class="btn ghost mini" onclick="crUnsplashBusca(${u.pagina - 1})">← Anteriores</button>` : ''}
        ${u.pagina < u.total ? `<button class="btn ghost mini" onclick="crUnsplashBusca(${u.pagina + 1})">Mais fotos →</button>` : ''}</div>`
    : '<div class="vazio" style="padding:22px"><p>Nada com essa busca. Tente em inglês, ou mais genérico.</p></div>';
}
async function crUnsplashUsa(n){
  const f = criador.unsplash.res[n]; if (!f) return;
  const url = f.urls.raw + (f.urls.raw.includes('?') ? '&' : '?') + 'auto=format&fit=max&q=85&w=2400';
  const credito = `${f.user?.name || 'Unsplash'} / Unsplash`;
  /* o Unsplash pede que o "download" seja avisado — é como o fotógrafo é contado */
  if (f.links?.download_location)
    fetch(f.links.download_location + (f.links.download_location.includes('?') ? '&' : '?') + 'client_id=' + encodeURIComponent(state.studioCfg.unsplash_chave)).catch(() => {});
  if (await crFotoDeLink(criador.unsplash.chave, url, credito, 'unsplash')) fechaModal();
}

/* Da equipe: a foto e os dados da ficha — aniversário e boas-vindas
   ficam prontos em dois cliques */
function crEquipe(chave){
  criador.equipeChave = chave;
  abreModal(`<h3>${ic('users')} Alguém da equipe</h3>
    <p class="small muted" style="margin-bottom:10px">Traz o nome, o cargo e a foto da ficha.</p>
    <input id="cr-eq-q" placeholder="Buscar pelo nome" oninput="crEquipeLista()" style="width:100%;margin-bottom:10px">
    <div id="cr-eq" class="cr-eq"></div>
    <div class="acts" style="justify-content:flex-end;margin-top:12px"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`);
  crEquipeLista();
  setTimeout(() => $('#cr-eq-q')?.focus(), 30);
}
function crEquipeLista(){
  const q = norm($('#cr-eq-q')?.value || '');
  const ms = (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status) && (!q || norm(m.nome).includes(q))).slice(0, 60);
  $('#cr-eq').innerHTML = ms.map(m => `<button class="cr-eq-p" onclick="crEquipeUsa(${m.registro})">${avatarFoto(m, 34, 12)}
      <span class="tx"><span class="nm">${esc(m.nome)}</span><span class="cg">${esc(m.cargo || '—')}</span></span></button>`).join('')
    || '<p class="muted small">Ninguém com esse nome.</p>';
}
async function crEquipeUsa(reg){
  const m = (state.membros || []).find(x => x.registro === reg); if (!m) return;
  const lam = crLamina(), c = lam.campos = lam.campos || {};
  if (lam.layout === 'citacao'){ c.autor = m.nome; c.cargo = m.cargo || c.cargo; }
  else if (lam.layout === 'barra'){ c.titulo = m.nome; c.sub = [m.cargo, 'NeuroDynamics'].filter(Boolean).join(' · '); }
  else { c.titulo = m.nome; if ('sub' in c || lam.layout === 'pessoa') c.sub = [m.cargo, m.departamento].filter(Boolean).join(' · '); }
  fechaModal();
  const fontes = m.foto_url ? [m.foto_url] : ['jpg', 'jpeg', 'png', 'webp'].map(x => FOTOS_BASE + m.registro + '.' + x);
  if (CR_LAYOUTS[lam.layout].fotos?.some(f => f[0] === criador.equipeChave)){
    for (const u of fontes){
      try { const img = await crCarregaImg(u, true); if (!crImgLimpa(img)) continue;
        const ref = crNovaRef(); criador.imgs[ref] = { img, origem:'equipe', url:u, credito:'' };
        crPoeFoto(criador.equipeChave, ref); crPaineis(); return; } catch(e){}
    }
    toast(`${primeiroNome(m.nome)} não tem foto na ficha que dê para usar — envie uma.`);
  }
  crMudou(true);
}
function crTiraFoto(chave){
  const lam = crLamina();
  if (lam.fotos?.[chave]) lam.fotos[chave] = { modo: lam.fotos[chave].modo };
  crMudou(true);
}

/* ============================================================
   O EDITOR
   ============================================================ */
const crLamina = () => criador.peca.laminas[criador.atual] || criador.peca.laminas[0];
const CR_RASCUNHO = 'nd.studio.rascunho';
function crGuardaRascunho(){
  if (criador.pub) return;
  try { localStorage.setItem(CR_RASCUNHO, JSON.stringify({ quando: Date.now(), titulo: criador.titulo, peca: crSerializa() })); } catch(e){}
}
function crLeRascunho(){ try { return JSON.parse(localStorage.getItem(CR_RASCUNHO) || 'null'); } catch(e){ return null; } }
function crApagaRascunho(){ try { localStorage.removeItem(CR_RASCUNHO); } catch(e){} }

/* a peça que vai para o banco: sem as imagens em memória, só o que
   as encontra de novo */
function crSerializa(){
  const p = JSON.parse(JSON.stringify({ ...criador.peca, fotos: {} }));
  const usadas = new Set(p.laminas.flatMap(l => Object.values(l.fotos || {}).map(f => f.ref)).filter(Boolean));
  usadas.forEach(ref => { const im = criador.imgs[ref]; if (!im) return;
    p.fotos[ref] = { origem: im.origem, url: im.url || null, caminho: im.caminho || null, credito: im.credito || '' }; });
  return p;
}
/* reabre as imagens de uma peça salva */
async function crReabreFotos(peca){
  const fotos = Object.entries(peca.fotos || {});
  const assinadas = {};
  const cams = fotos.map(([, f]) => f.caminho).filter(Boolean);
  if (cams.length){
    const { data } = await sb.storage.from('studio').createSignedUrls(cams, 3600).catch(() => ({ data:null })) || {};
    (data || []).forEach(d => { if (d.signedUrl) assinadas[d.path] = d.signedUrl; });
  }
  await Promise.all(fotos.map(async ([ref, f]) => {
    const src = f.caminho ? assinadas[f.caminho] : f.url;
    if (!src) return;
    try { const img = await crCarregaImg(src, true);
      criador.imgs[ref] = { img, origem: f.origem, url: f.url, caminho: f.caminho, credito: f.credito || '' }; } catch(e){}
  }));
}

/* entradas: mod-studio chama estas depois de carregar o módulo */
async function crPaginaCriar(modelo){
  const rasc = crLeRascunho();
  criador.pub = null; criador.imgs = {}; criador.atual = 0; criador.sujo = false;
  criador.peca = crPecaNova(CR_MODELOS[modelo] ? modelo : (modelo ? 'livre' : 'livre'));
  criador.titulo = '';
  await crMonta();
  if (rasc?.peca && !modelo && Date.now() - rasc.quando < 14 * 864e5){
    $('#cr-rasc').innerHTML = `<div class="aviso-box info cr-rasc">Há uma peça que você começou em ${fmtDT(new Date(rasc.quando).toISOString())}
      ${rasc.titulo ? '(' + esc(rasc.titulo) + ')' : ''} e não salvou.
      <button class="btn ghost mini" onclick="crRecupera()">Continuar de onde parei</button>
      <button class="btn ghost mini" onclick="crApagaRascunho();this.closest('.cr-rasc').remove()">Descartar</button></div>`;
  }
}
async function crRecupera(){
  const r = crLeRascunho(); if (!r) return;
  criador.peca = r.peca; criador.titulo = r.titulo || '';
  await crReabreFotos(r.peca);
  $('#cr-rasc').innerHTML = '';
  $('#cr-nome').value = criador.titulo;
  crPaineis(); crDesenhar();
  const faltam = Object.values(r.peca.fotos || {}).filter(f => f.origem === 'upload' && !f.caminho).length;
  if (faltam) toast(`${faltam === 1 ? 'Uma foto enviada' : faltam + ' fotos enviadas'} não ficaram guardadas no rascunho — envie de novo.`);
}
async function crPaginaArte(pub){
  criador.pub = pub; criador.imgs = {}; criador.atual = 0; criador.sujo = false;
  criador.titulo = pub.titulo;
  criador.peca = pub.peca && pub.peca.laminas ? JSON.parse(JSON.stringify(pub.peca)) : crPecaNova(pub.modelo || pub.categoria || 'livre');
  criador.peca.estilo = { ...CR_ESTILO_PADRAO, ...(criador.peca.estilo || {}) };
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Abrindo a arte…</div>';
  await crReabreFotos(criador.peca);
  await crMonta();
}

async function crMonta(){
  const pub = criador.pub;
  const nome = crNomeModelo(criador.peca.modelo);
  $('#main').innerHTML = `<div class="cr">
    <div class="cr-topo">
      <a class="btn ghost mini" href="${pub ? '#/studio/' + esc(pub.codigo) : '#/studio'}">${ic('back')} ${pub ? esc(pub.codigo) : 'Studio'}</a>
      <input id="cr-nome" class="cr-nome" value="${esc(criador.titulo)}" placeholder="Nome da publicação — ex.: ${esc(nome)} de outubro"
        oninput="criador.titulo=this.value;criador.sujo=true;crGuardaRascunho()" aria-label="Nome da publicação">
      <span class="cr-meta">${pub ? `${esc(pub.codigo)} · versão ${pub.versao || 1} · ${esc(STUDIO_STATUS.find(s => s[0] === pub.status)?.[1] || '')}` : 'Peça nova'}</span>
      <div class="cr-acoes">
        <button class="btn ghost mini" onclick="crModalBaixar()">${ic('down')} Baixar</button>
        <button class="btn solid mini" onclick="crModalSalvar()">${ic('check')} ${pub ? 'Salvar a arte' : 'Salvar no quadro'}</button>
      </div>
    </div>
    <div id="cr-rasc"></div>
    <div class="cr-grade">
      <aside class="cr-esq" id="cr-esq"></aside>
      <section class="cr-palco">
        <div class="cr-palco-topo"><span id="cr-onde" class="cr-onde"></span>
          <label class="cr-chave"><input type="checkbox" id="cr-guias" onchange="crDesenhar()"> Área segura</label></div>
        <div class="cr-tela" id="cr-tela">
          <button class="cr-nav ant" onclick="crIr(criador.atual - 1)" aria-label="Lâmina anterior">${ic('back')}</button>
          <canvas id="cr-cv" aria-label="Prévia da lâmina"></canvas>
          <button class="cr-nav prox" onclick="crIr(criador.atual + 1)" aria-label="Próxima lâmina">${ic('chevron')}</button>
        </div>
        <div class="cr-fita" id="cr-fita"></div>
      </section>
      <aside class="cr-dir" id="cr-dir"></aside>
    </div></div>`;
  await Promise.all([crCarregarMarcas(), crFontes()]);
  crPaineis(); crDesenhar();
  if (!criador._redim){
    criador._redim = true;
    window.addEventListener('resize', () => { if ($('#cr-cv')) crDesenhar(); });
  }
}
let _crFontes = null;
function crFontes(){
  if (_crFontes) return _crFontes;
  _crFontes = Promise.all(['800 100px Archivo', '700 100px Archivo', '600 100px Archivo', '500 100px Archivo',
    '500 30px "IBM Plex Mono"', '600 30px "IBM Plex Mono"', '400 30px "IBM Plex Mono"'].map(f => document.fonts.load(f))).catch(() => {});
  return _crFontes;
}

/* desenha a prévia e a fita — no próximo quadro, uma vez só */
function crDesenhar(){
  if (criador.pintando){ criador.pendente = true; return; }
  criador.pintando = true;
  requestAnimationFrame(() => {
    try { crDesenharAgora(); } catch(e){ console.error(e); }
    criador.pintando = false;
    if (criador.pendente){ criador.pendente = false; crDesenhar(); }
  });
}
function crDesenharAgora(){
  const cv = $('#cr-cv'); if (!cv || !criador.peca) return;
  const peca = criador.peca, T = CR_TAMANHOS[peca.tamanho];
  const tela = $('#cr-tela');
  const larg = Math.max(200, tela.clientWidth - 96), alt = Math.max(260, window.innerHeight * .68);
  const css = Math.min(larg, alt * T.w / T.h);
  const k = Math.min(1, css * (window.devicePixelRatio || 1) / T.w);
  crPinta(cv, peca, criador.atual, k, { previa:true, guias: $('#cr-guias')?.checked });
  cv.style.width = css + 'px'; cv.style.height = (css * T.h / T.w) + 'px';
  const n = peca.laminas.length;
  $('#cr-onde').textContent = `${String(criador.atual + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')} · ${CR_LAYOUTS[crLamina().layout]?.l || ''} · ${T.l} · ${T.w} × ${T.h}`;
  document.querySelectorAll('.cr-nav').forEach(b => b.hidden = n < 2);
  const fita = $('#cr-fita');
  if (fita.children.length !== n + 1){
    fita.innerHTML = peca.laminas.map((l, i) => `<button class="cr-mini" onclick="crIr(${i})" aria-label="Lâmina ${i + 1}"><canvas></canvas><span>${String(i + 1).padStart(2, '0')}</span></button>`).join('')
      + `<button class="cr-mini cr-mais" onclick="crAddLamina()" title="Acrescentar lâmina">${ic('plus')}</button>`;
  }
  const hMini = 96, kM = hMini * (window.devicePixelRatio || 1) / T.h;
  [...fita.querySelectorAll('.cr-mini:not(.cr-mais)')].forEach((b, i) => {
    const c = b.querySelector('canvas');
    crPinta(c, peca, i, kM, { previa:true });
    c.style.height = hMini + 'px'; c.style.width = (hMini * T.w / T.h) + 'px';
    b.classList.toggle('on', i === criador.atual);
  });
}
function crMudou(paineis){
  criador.sujo = true;
  if (paineis) crPaineis();
  crDesenhar();
  clearTimeout(criador._rt); criador._rt = setTimeout(crGuardaRascunho, 600);
}
function crIr(i){
  const n = criador.peca.laminas.length;
  criador.atual = Math.max(0, Math.min(n - 1, i));
  crPaineis(); crDesenhar();
}

/* ---------------- painel da esquerda: a peça e a lâmina ---------------- */
const CR_SEL_ROT = { video:'Vídeo', materia:'Matéria escrita' };
function crCampoHTML(chave, rot, tipo, v){
  const id = 'crc-' + chave;
  const on = `oninput="crCampo('${chave}', this.value)"`;
  if (tipo === 'area' || tipo === 'lista')
    return `<div class="fld"><label for="${id}">${esc(rot)}</label><textarea id="${id}" rows="${tipo === 'lista' ? 4 : 2}" ${on}>${esc(v ?? '')}</textarea></div>`;
  if (tipo === 'data') return `<div class="fld"><label for="${id}">${esc(rot)}</label><input id="${id}" type="date" value="${esc(v ?? '')}" ${on}></div>`;
  if (tipo.startsWith('sel:')) return `<div class="fld"><label for="${id}">${esc(rot)}</label><select id="${id}" onchange="crCampo('${chave}', this.value)">${
    tipo.slice(4).split('|').map(o => `<option value="${o}"${v === o ? ' selected' : ''}>${esc(CR_SEL_ROT[o] || o)}</option>`).join('')}</select></div>`;
  return `<div class="fld"><label for="${id}">${esc(rot)}</label><input id="${id}" value="${esc(v ?? '')}" ${on}></div>`;
}
function crCampo(chave, valor){
  const lam = crLamina(); lam.campos = lam.campos || {};
  lam.campos[chave] = valor;
  crMudou(false);
}
function crFotoHTML(lam, [chave, rot, modos]){
  const f = lam.fotos?.[chave] || {};
  const im = f.ref ? criador.imgs[f.ref] : null;
  const pessoa = CR_LAYOUTS[lam.layout].pessoa || ['citacao', 'barra'].includes(lam.layout);
  const soNenhuma = modos.length === 1 && modos[0] === 'nenhuma';
  if (soNenhuma) return '';
  return `<div class="cr-foto">
    <div class="cr-foto-topo"><span class="rot">${esc(rot)}</span>
      ${modos.length > 1 ? `<select onchange="crModoFoto('${chave}', this.value)" aria-label="Como a foto entra">${modos.map(m =>
        `<option value="${m}"${(f.modo || modos[0]) === m ? ' selected' : ''}>${esc(CR_MODOS[m] || m)}</option>`).join('')}</select>` : ''}</div>
    <div class="cr-foto-corpo">
      <div class="cr-foto-prev">${im ? `<img src="${esc(im.img.src)}" alt="">` : ic('imagem')}</div>
      <div class="cr-foto-bts">
        <label class="btn ghost mini">${ic('subir')} Enviar<input type="file" accept="image/*" hidden onchange="crEnviarFoto('${chave}', this)"></label>
        ${chave === 'foto2' ? '' : `<button class="btn ghost mini" onclick="crUnsplash('${chave}')">${ic('lupa')} Unsplash</button>`}
        ${pessoa ? `<button class="btn ghost mini" onclick="crEquipe('${chave}')">${ic('users')} Da equipe</button>` : ''}
        <button class="btn ghost mini" onclick="crModalLink('${chave}')">${ic('link')} Link</button>
        ${im ? `<button class="btn ghost mini" onclick="crTiraFoto('${chave}')">${ic('x')} Tirar</button>` : ''}
      </div></div>
    ${im ? `<div class="cr-enq">
      <label>Horizontal<input type="range" min="0" max="100" value="${f.x ?? 50}" oninput="crEnq('${chave}','x',this.value)"></label>
      <label>Vertical<input type="range" min="0" max="100" value="${f.y ?? 50}" oninput="crEnq('${chave}','y',this.value)"></label>
      <label>Zoom<input type="range" min="100" max="300" value="${Math.round((f.zoom || 1) * 100)}" oninput="crEnq('${chave}','zoom',this.value/100)"></label>
      </div>
      <div class="fld" style="margin:8px 0 0"><label>Crédito</label><input value="${esc(im.credito || '')}" placeholder="Foto: nome / banco"
        oninput="criador.imgs['${f.ref}'].credito=this.value;crMudou(false)"></div>` : ''}
  </div>`;
}
function crModoFoto(chave, modo){
  const lam = crLamina(); lam.fotos = lam.fotos || {};
  lam.fotos[chave] = { ...(lam.fotos[chave] || {}), modo };
  crMudou(true);
}
function crEnq(chave, eixo, v){
  const f = crLamina().fotos?.[chave]; if (!f) return;
  f[eixo] = +v; crMudou(false);
}
function crPainelEsq(){
  const peca = criador.peca, M = crModelo(peca.modelo), lam = crLamina(), L = CR_LAYOUTS[lam.layout] || CR_LAYOUTS.capa;
  const outros = Object.keys(CR_TAMANHOS).filter(t => !M.tamanhos.includes(t));
  return `<section class="cr-sec"><h4>Modelo</h4>
      <div class="cr-modelo"><span class="nm">${esc(crNomeModelo(peca.modelo))}</span>
        <button class="btn ghost mini" onclick="crTrocarModelo()">${ic('galeria')} Trocar</button></div></section>
    <section class="cr-sec"><h4>Tamanho</h4>
      <div class="cr-chips">${M.tamanhos.map(t => `<button class="chip-b${peca.tamanho === t ? ' on' : ''}" onclick="crTamanho('${t}')"
        title="${esc(CR_TAMANHOS[t].onde)}">${esc(CR_TAMANHOS[t].l)}</button>`).join('')}</div>
      ${outros.length ? `<select class="cr-outros" onchange="if(this.value)crTamanho(this.value)" aria-label="Outros tamanhos">
        <option value="">Outros tamanhos…</option>${outros.map(t => `<option value="${t}"${peca.tamanho === t ? ' selected' : ''}>${esc(CR_TAMANHOS[t].l)} · ${CR_TAMANHOS[t].w}×${CR_TAMANHOS[t].h}</option>`).join('')}</select>` : ''}
      <p class="mini">${esc(CR_TAMANHOS[peca.tamanho].onde)}</p></section>
    <section class="cr-sec"><h4>Lâminas · ${peca.laminas.length}</h4>
      <ol class="cr-lams">${peca.laminas.map((l, i) => `<li class="${i === criador.atual ? 'on' : ''}">
        <button class="cr-lam" onclick="crIr(${i})"><span class="n">${String(i + 1).padStart(2, '0')}</span>
          <span class="nm">${esc(CR_LAYOUTS[l.layout]?.l || l.layout)}</span>
          <span class="tt">${esc(String(l.campos?.titulo || l.campos?.veiculo || '').replace(/\*/g, '').slice(0, 34))}</span></button>
        <span class="bts">${i ? ibtn('back', 'Mover para antes', `crMoverLamina(${i},-1)`, 'cima') : ''}
          ${i < peca.laminas.length - 1 ? ibtn('chevron', 'Mover para depois', `crMoverLamina(${i},1)`, 'baixo') : ''}
          ${ibtn('copy', 'Duplicar', `crDuplicarLamina(${i})`)}
          ${peca.laminas.length > 1 ? ibtn('trash', 'Tirar', `crTirarLamina(${i})`) : ''}</span></li>`).join('')}</ol>
      <div class="cr-add"><select id="cr-novo-lay" aria-label="Leiaute da nova lâmina">${Object.entries(CR_LAYOUTS).map(([k, x]) =>
          `<option value="${k}">${esc(x.l)}</option>`).join('')}</select>
        <button class="btn ghost mini" onclick="crAddLamina($('#cr-novo-lay').value)">${ic('plus')} Lâmina</button></div></section>
    <section class="cr-sec"><h4>Lâmina ${String(criador.atual + 1).padStart(2, '0')}</h4>
      <div class="fld"><label for="cr-lay">Leiaute</label><select id="cr-lay" onchange="crTrocarLayout(this.value)">${Object.entries(CR_LAYOUTS).map(([k, x]) =>
        `<option value="${k}"${lam.layout === k ? ' selected' : ''}>${esc(x.l)}</option>`).join('')}</select>
        <p class="mini">${esc(L.d)}</p></div>
      ${L.campos.map(([k, r, t]) => crCampoHTML(k, r, t, lam.campos?.[k])).join('')}
      <p class="mini cr-dica">Use <b>*asteriscos*</b> para destacar uma palavra; Enter quebra a linha.</p>
      ${(L.fotos || []).map(f => crFotoHTML(lam, f)).join('')}
    </section>`;
}
function crTamanho(t){ criador.peca.tamanho = t; crMudou(true); }
function crTrocarLayout(layout){
  const lam = crLamina(), campos = lam.campos || {};
  lam.layout = layout;
  /* o que tem o mesmo nome continua: título é título em qualquer leiaute */
  lam.campos = campos;
  const L = CR_LAYOUTS[layout];
  const fotos = lam.fotos || {};
  (L.fotos || []).forEach(([k, , modos]) => { if (fotos[k] && !modos.includes(fotos[k].modo)) fotos[k].modo = modos[0]; });
  crMudou(true);
}
function crAddLamina(layout){
  const peca = criador.peca;
  layout = layout || crLamina().layout;
  const ex = { texto:{ olho:'Rótulo', titulo:'Um título que diz o ponto', corpo:'O texto que explica.' },
    lista:{ titulo:'Três passos', itens:'Primeiro — o que fazer\nSegundo — o que vem depois\nTerceiro — como termina' },
    numero:{ valor:'42', titulo:'o que o número quer dizer' }, cta:{ titulo:'Gostou? Salve e compartilhe', site: peca.estilo.rodape || 'neurodynamics.dev' },
    capa:{ olho:'Olho', titulo:'Título da *lâmina*' }, citacao:{ titulo:'Uma frase que merece destaque.', autor:'Quem disse' } }[layout] || { titulo:'Título' };
  peca.laminas.splice(criador.atual + 1, 0, crL(layout, ex, {}));
  criador.atual++;
  if (peca.laminas.length > 1 && ['imagem'].includes(CR_TAMANHOS[peca.tamanho].formato) && !peca._avisouCarrossel){
    peca._avisouCarrossel = true; toast('Com mais de uma lâmina, a publicação vira carrossel.');
  }
  crMudou(true);
}
function crDuplicarLamina(i){
  criador.peca.laminas.splice(i + 1, 0, JSON.parse(JSON.stringify(criador.peca.laminas[i])));
  criador.atual = i + 1; crMudou(true);
}
function crMoverLamina(i, d){
  const ls = criador.peca.laminas, j = i + d; if (j < 0 || j >= ls.length) return;
  [ls[i], ls[j]] = [ls[j], ls[i]]; criador.atual = j; crMudou(true);
}
async function crTirarLamina(i){
  if (!await confirma(`Tirar a lâmina ${String(i + 1).padStart(2, '0')}?`, 'Tirar')) return;
  criador.peca.laminas.splice(i, 1);
  criador.atual = Math.min(criador.atual, criador.peca.laminas.length - 1);
  crMudou(true);
}
/* trocar de modelo: mantém o que dá (o título, as fotos) */
function crTrocarModelo(){
  abreModal(`<h3>${ic('galeria')} Trocar de modelo</h3>
    <p class="small muted" style="margin-bottom:12px">As lâminas passam a ser as do modelo novo. O nome da publicação fica.</p>
    <div class="cr-troca">${STUDIO_TIPOS.filter(t => CR_MODELOS[t[0]]).map(t => `<button class="chip-b${criador.peca.modelo === t[0] ? ' on' : ''}"
      onclick="crTrocarModeloOk('${t[0]}')">${esc(t[1])}</button>`).join('')}</div>
    <div class="acts" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" onclick="fechaModal()">Cancelar</button></div>`, 'largo');
}
function crTrocarModeloOk(id){
  const nova = crPecaNova(id);
  /* as fotos das lâminas de agora vão para as lâminas equivalentes */
  const velhas = criador.peca.laminas;
  nova.laminas.forEach((l, i) => { const v = velhas[i]; if (v?.fotos?.foto?.ref && (CR_LAYOUTS[l.layout].fotos || []).some(f => f[0] === 'foto'))
    l.fotos.foto = { ...v.fotos.foto, modo: l.fotos.foto?.modo || CR_LAYOUTS[l.layout].fotos[0][2][0] }; });
  criador.peca = nova; criador.atual = 0;
  fechaModal(); crMudou(true);
}

/* ---------------- painel da direita: o estilo ---------------- */
function crPainelDir(){
  const e = { ...CR_ESTILO_PADRAO, ...criador.peca.estilo };
  const cores = crCores(e);
  const temBarra = criador.peca.laminas.some(l => l.layout === 'barra');
  const temFoto = criador.peca.laminas.some(l => Object.values(l.fotos || {}).some(f => f.ref));
  const chips = (campo, mapa) => `<div class="cr-chips">${Object.entries(mapa).map(([k, l]) =>
    `<button class="chip-b${e[campo] === k ? ' on' : ''}" onclick="crEstilo('${campo}','${k}')">${esc(l)}</button>`).join('')}</div>`;
  return `<section class="cr-sec"><h4>Tema</h4>
      <div class="cr-temas">${Object.entries(CR_TEMAS).map(([k, t]) => `<button class="cr-tema${e.tema === k ? ' on' : ''}" onclick="crEstilo('tema','${k}')"
        title="${esc(t.l)}" style="background:linear-gradient(135deg,${t.fundo[0]},${t.fundo[1]} 70%,${t.fundo[2]})"><span style="color:${t.fg}">${esc(t.l)}</span></button>`).join('')}</div></section>
    <section class="cr-sec"><h4>Acento</h4>
      <div class="cr-acentos">${Object.entries(CR_ACENTOS).map(([k, a]) => `<button class="cr-ac${!e.acentoLivre && (e.acento || CR_TEMAS[e.tema].acento) === k ? ' on' : ''}"
        onclick="crEstilo('acento','${k}')" title="${esc(a.l)}" aria-label="${esc(a.l)}" style="--c:${a.c}"></button>`).join('')}
        <label class="cr-ac livre${e.acentoLivre ? ' on' : ''}" title="Outra cor" style="--c:${e.acentoLivre || '#888'}">
          <input type="color" value="${e.acentoLivre || cores.ac}" oninput="crEstilo('acentoLivre',this.value)" aria-label="Outra cor"></label></div>
      <p class="mini">Os acentos saem da paleta auxiliar da marca. Nos temas claros, o texto de acento escurece para ler.</p></section>
    <section class="cr-sec"><h4>Decoração</h4>${chips('decoracao', CR_DECORACOES)}
      <label class="cr-chave"><input type="checkbox" ${e.grade ? 'checked' : ''} onchange="crEstilo('grade',this.checked)"> Grade técnica</label>
      <label class="cr-chave"><input type="checkbox" ${e.cortes ? 'checked' : ''} onchange="crEstilo('cortes',this.checked)"> Marcas de corte</label></section>
    <section class="cr-sec"><h4>Texto</h4>
      <span class="cr-rot">Destaque (<b>*palavra*</b>)</span>${chips('destaque', CR_DESTAQUES)}
      <span class="cr-rot">Alinhamento</span>${chips('alinhar', { esquerda:'À esquerda', centro:'Ao centro' })}
      <label class="cr-faixa">Tamanho do título <b>${Math.round(e.escala * 100)}%</b>
        <input type="range" min="70" max="130" value="${Math.round(e.escala * 100)}" oninput="crEstilo('escala',this.value/100,true);this.previousElementSibling.textContent=this.value+'%'"></label>
      <label class="cr-chave"><input type="checkbox" ${e.caixaAlta ? 'checked' : ''} onchange="crEstilo('caixaAlta',this.checked)"> Título em caixa alta</label></section>
    <section class="cr-sec"><h4>Logos</h4>
      <select onchange="crEstilo('logo',this.value)" aria-label="Posição da logo">${[['topo','No topo'],['topo-centro','No topo, ao centro'],['rodape','No rodapé'],['nenhum','Sem logo']].map(([k, l]) =>
        `<option value="${k}"${e.logo === k ? ' selected' : ''}>${l}</option>`).join('')}</select>
      <label class="cr-faixa">Tamanho <b>${Math.round(e.logoTam * 100)}%</b>
        <input type="range" min="70" max="160" value="${Math.round(e.logoTam * 100)}" oninput="crEstilo('logoTam',this.value/100,true);this.previousElementSibling.textContent=this.value+'%'"></label>
      <label class="cr-chave"><input type="checkbox" ${e.labbio ? 'checked' : ''} onchange="crEstilo('labbio',this.checked)"> Com a logo do LABBIO ao lado</label></section>
    <section class="cr-sec"><h4>Rodapé</h4>
      <input value="${esc(e.rodape)}" placeholder="@perfil ou site (vazio: sem rodapé)" oninput="crEstilo('rodape',this.value,true)" style="width:100%">
      <label class="cr-chave"><input type="checkbox" ${e.contador ? 'checked' : ''} onchange="crEstilo('contador',this.checked)"> Contador e “arraste →” no carrossel</label></section>
    ${temFoto ? `<section class="cr-sec"><h4>Fotos</h4>${chips('filtro', CR_FILTROS)}
      <label class="cr-faixa">Escurecer a foto de fundo <b>${e.escurecer}%</b>
        <input type="range" min="10" max="95" value="${e.escurecer}" oninput="crEstilo('escurecer',+this.value,true);this.previousElementSibling.textContent=this.value+'%'"></label></section>` : ''}
    ${temBarra ? `<section class="cr-sec"><h4>Barra de nome</h4>${chips('barra', CR_BARRAS)}</section>` : ''}
    <section class="cr-sec"><h4>Arquivo</h4>${chips('formatoArquivo', { auto:'Automático', png:'PNG', jpg:'JPG' })}
      <p class="mini">Automático: JPG quando a lâmina tem foto (arquivo menor), PNG quando não tem (texto mais nítido). A barra de nome sai sempre em PNG transparente.</p></section>`;
}
function crEstilo(campo, v, semPainel){
  const e = criador.peca.estilo;
  e[campo] = v;
  if (campo === 'acento') e.acentoLivre = '';
  if (campo === 'tema') e.acento = '';
  crMudou(false);
  if (!semPainel) $('#cr-dir').innerHTML = crPainelDir();
}
function crPaineis(){
  const esq = $('#cr-esq'), dir = $('#cr-dir'); if (!esq) return;
  const rol = esq.scrollTop;
  esq.innerHTML = crPainelEsq(); dir.innerHTML = crPainelDir();
  esq.scrollTop = rol;
  $('#cr-fita') && ($('#cr-fita').innerHTML = '');
}

/* ============================================================
   EXPORTAR — PNG/JPG, ZIP com todas, PDF (o documento do LinkedIn)
   ============================================================ */
const CR_CDN_ZIP = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const CR_CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
const crSlug = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48);
/* a lâmina num arquivo: JPG com foto, PNG sem (ou o que o estilo mandar) */
function crArquivo(peca, i, k){
  const lam = peca.laminas[i], L = CR_LAYOUTS[lam.layout] || CR_LAYOUTS.capa;
  const temFoto = Object.values(lam.fotos || {}).some(f => f.ref && criador.imgs[f.ref]);
  const pref = peca.estilo?.formatoArquivo || 'auto';
  const png = L.transparente || pref === 'png' || (pref === 'auto' && !temFoto);
  const cv = document.createElement('canvas');
  crPinta(cv, peca, i, k);
  return new Promise((ok, erro) => {
    try { cv.toBlob(b => b ? ok({ blob:b, ext: png ? 'png' : 'jpg', tipo: png ? 'image/png' : 'image/jpeg', w: cv.width, h: cv.height })
      : erro(new Error('o navegador não gerou a imagem')), png ? 'image/png' : 'image/jpeg', .93); }
    catch(e){ erro(e.name === 'SecurityError' ? new Error('uma das imagens veio de um endereço que não deixa exportar — envie o arquivo') : e); }
  });
}
function crNomeBase(){
  const pub = criador.pub;
  return [pub?.codigo?.toLowerCase(), crSlug(criador.titulo || crNomeModelo(criador.peca.modelo))].filter(Boolean).join('-');
}
const crNomeArquivo = (i, a) => `${crNomeBase()}-${String(i + 1).padStart(2, '0')}-${a.w}x${a.h}.${a.ext}`;
function crSalvaBlob(blob, nome){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function crModalBaixar(){
  const T = CR_TAMANHOS[criador.peca.tamanho], n = criador.peca.laminas.length;
  const kPadrao = T.w >= 1920 ? 1 : 4 / 3;
  abreModal(`<h3>${ic('down')} Baixar</h3>
    <p class="small muted" style="line-height:1.6;margin-bottom:14px">Publique no tamanho gerado: as redes recomprimem o que sobe, e a imagem
      no tamanho certo evita a segunda compressão, que é a que borra o texto.</p>
    <span class="cr-rot">Resolução</span>
    <div class="cr-escalas">${CR_ESCALAS.map(([k, l]) => `<label class="cr-esc"><input type="radio" name="cr-esc" value="${k}"${Math.abs(k - kPadrao) < .01 ? ' checked' : ''}>
      <b>${l}</b><span>${Math.round(T.w * k)} × ${Math.round(T.h * k)}</span></label>`).join('')}</div>
    <div class="acts" style="flex-wrap:wrap;justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      ${n > 1 ? `<button class="btn ghost" onclick="crBaixar('esta')">Só a lâmina ${String(criador.atual + 1).padStart(2, '0')}</button>` : ''}
      ${n > 1 || T.pdf ? `<button class="btn ghost" onclick="crBaixar('pdf')">PDF${T.pdf ? ' (para o LinkedIn)' : ''}</button>` : ''}
      <button class="btn solid" onclick="crBaixar('todas')">${n > 1 ? `Todas as ${n} (ZIP)` : 'Baixar'}</button></div>
    <p class="small muted" id="cr-bx" style="margin-top:10px"></p>`);
}
async function crBaixar(qual){
  const k = +(document.querySelector('input[name=cr-esc]:checked')?.value || 1);
  const peca = criador.peca, n = peca.laminas.length;
  const msg = t => { const e = $('#cr-bx'); if (e) e.textContent = t; };
  try {
    if (qual === 'esta' || (qual === 'todas' && n === 1)){
      const i = qual === 'esta' ? criador.atual : 0;
      const a = await crArquivo(peca, i, k); crSalvaBlob(a.blob, crNomeArquivo(i, a));
    } else if (qual === 'todas'){
      msg('Carregando o compactador…');
      if (!window.JSZip) await carregarLib(CR_CDN_ZIP);
      const zip = new JSZip();
      for (let i = 0; i < n; i++){ msg(`Gerando ${i + 1} de ${n}…`); const a = await crArquivo(peca, i, k); zip.file(crNomeArquivo(i, a), a.blob); }
      crSalvaBlob(await zip.generateAsync({ type:'blob' }), crNomeBase() + '.zip');
    } else {
      msg('Carregando o gerador de PDF…');
      if (!window.jspdf) await carregarLib(CR_CDN_PDF);
      let pdf = null;
      for (let i = 0; i < n; i++){
        msg(`Página ${i + 1} de ${n}…`);
        const cv = document.createElement('canvas'); crPinta(cv, peca, i, k);
        const W = cv.width, H = cv.height, o = W > H ? 'l' : 'p';
        if (!pdf) pdf = new jspdf.jsPDF({ orientation:o, unit:'px', format:[W, H], hotfixes:['px_scaling'], compress:true });
        else pdf.addPage([W, H], o);
        pdf.addImage(cv.toDataURL('image/jpeg', .92), 'JPEG', 0, 0, W, H);
      }
      pdf.save(crNomeBase() + '.pdf');
    }
    fechaModal();
  } catch(e){ msg(''); falha(e, 'Não deu para baixar'); }
}

/* ============================================================
   SALVAR NO QUADRO
   A peça nova vira uma publicação (em produção) com o plano; as
   artes sobem para o Storage na resolução Alta e a peça inteira vai
   junto, para a arte reabrir. O formulário do plano é o mesmo da
   tela da publicação — mora em mod-studio.
   ============================================================ */
function crCamposJuntos(){
  const c = {};
  criador.peca.laminas.forEach(l => Object.entries(l.campos || {}).forEach(([k, v]) => { if (c[k] == null && String(v || '').trim()) c[k] = v; }));
  return c;
}
function crAlt(){
  const ls = criador.peca.laminas;
  const t = l => String([l.campos?.olho, l.campos?.veiculo, l.campos?.valor, l.campos?.titulo].filter(Boolean).join(' — ')).replace(/\*/g, '').replace(/\n/g, ' ');
  return ls.length === 1 ? `Arte da NeuroDynamics: ${t(ls[0])}.`
    : `Carrossel da NeuroDynamics em ${ls.length} lâminas. ` + ls.map((l, i) => `${i + 1}: ${t(l)}.`).join(' ');
}
function crFormatoDaPeca(){
  const T = CR_TAMANHOS[criador.peca.tamanho];
  return criador.peca.laminas.length > 1 && T.formato === 'imagem' ? 'carrossel' : T.formato;
}
function crRedesDaPeca(){
  const t = criador.peca.tamanho;
  return ['paisagem', 'documento'].includes(t) ? ['linkedin'] : ['thumb', 'video', 'video_v'].includes(t) ? ['youtube'] : ['instagram'];
}
async function crModalSalvar(){
  const pub = criador.pub;
  const vazias = criador.peca.laminas.map((l, i) => ({ l, i })).filter(({ l }) =>
    (CR_LAYOUTS[l.layout].fotos || []).some(([k, , modos]) => { const f = l.fotos?.[k];
      return f && f.modo && !['nenhuma'].includes(f.modo) && !f.ref && ['pessoa', 'foto', 'thumb'].includes(l.layout); }));
  const avisoVazias = vazias.length ? `<div class="aviso-box warn">A${vazias.length > 1 ? 's lâminas' : ' lâmina'} ${vazias.map(v => String(v.i + 1).padStart(2, '0')).join(', ')}
    ainda ${vazias.length > 1 ? 'têm' : 'tem'} o espaço da foto vazio. Dá para salvar assim e pôr a foto depois.</div>` : '';
  if (pub){
    abreModal(`<h3>${ic('check')} Salvar a arte de ${esc(pub.codigo)}</h3>
      <p class="small muted" style="line-height:1.6;margin-bottom:12px">A arte vira a versão ${(pub.versao || 1) + 1}. As imagens antigas saem do quadro.
      ${pub.status === 'pronta' ? '<br><b>A publicação estava aprovada</b>: com a arte nova, ela volta para aprovação.' : ''}</p>
      ${avisoVazias}<div id="cr-prog" class="cr-prog"></div>
      <div class="acts" style="justify-content:flex-end;flex-wrap:wrap">
        <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
        ${pub.status === 'producao' || pub.status === 'ideia' ? `<button class="btn ghost" onclick="crSalvar(true)">Salvar e mandar para aprovação</button>` : ''}
        <button class="btn solid" onclick="crSalvar(false)">Salvar</button></div>`, 'largo', true);
    return;
  }
  await carregarModulo('studio');
  const c0 = crCamposJuntos();
  let sug = ''; try { sug = crModelo(criador.peca.modelo).legenda?.(c0) || ''; } catch(e){}
  const tipo = studioTipo(criador.peca.modelo);
  const nome = criador.titulo || [crNomeModelo(criador.peca.modelo), String(c0.titulo || c0.veiculo || '').replace(/\*/g, '').split('\n')[0]].filter(Boolean).join(': ').slice(0, 80);
  abreModal(`<h3>${ic('check')} Salvar no quadro</h3>
    <p class="small muted" style="line-height:1.6;margin-bottom:14px">A publicação entra em <b>Em produção</b>, com a arte na resolução Alta.
      Quem for publicar baixa as imagens e copia a legenda da página dela. Para ficar <b>pronta para publicar</b>, passa pela aprovação.</p>
    ${avisoVazias}
    ${stPlanoHTML({ titulo: nome, redes: crRedesDaPeca(), formato: crFormatoDaPeca(), pilar: tipo?.[2] || '', categoria: criador.peca.modelo,
      responsavel: state.perfil?.registro, legenda: sug, texto_alt: crAlt() }, { sugestao: sug })}
    <div id="cr-prog" class="cr-prog"></div>
    <div class="acts" style="justify-content:flex-end;flex-wrap:wrap">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn ghost" onclick="crSalvar(true)">Salvar e mandar para aprovação</button>
      <button class="btn solid" onclick="crSalvar(false)">Salvar</button></div>`, 'imenso', true);
  stPlanoLigar();
}
async function crSalvar(mandar){
  const pub = criador.pub, peca = criador.peca;
  let plano = null;
  if (!pub){ plano = stPlanoLer(); if (plano.erro) return toast(plano.erro, true); }
  const prog = t => { const e = $('#cr-prog'); if (e) e.innerHTML = t ? `<span class="spin"></span> ${esc(t)}` : ''; };
  document.querySelectorAll('#modal .acts .btn').forEach(b => b.disabled = true);
  const libera = () => document.querySelectorAll('#modal .acts .btn').forEach(b => b.disabled = false);
  try {
    let id = pub?.id, codigo = pub?.codigo;
    if (!id){
      prog('Criando a publicação…');
      const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { ...plano, status:'producao', modelo: peca.modelo, categoria: plano.categoria || peca.modelo } });
      if (error || data?.status !== 'ok') throw new Error(motivoRPC(data, error, 'O banco recusou a publicação'));
      id = data.id; codigo = data.codigo;
      criador.pub = { id, codigo, status:'producao', versao: data.versao, imagens:[] };
    }
    /* as fotos enviadas daqui, que ainda não estão no Storage */
    const usadas = new Set(peca.laminas.flatMap(l => Object.values(l.fotos || {}).map(f => f.ref)).filter(Boolean));
    for (const ref of usadas){
      const im = criador.imgs[ref];
      if (!im?.blob || im.caminho) continue;
      prog('Guardando as fotos de origem…');
      const cam = `${id}/fontes/${ref}.${im.tipo === 'image/png' ? 'png' : 'jpg'}`;
      const { error } = await sb.storage.from('studio').upload(cam, im.blob, { contentType: im.tipo, upsert:true });
      if (error) throw new Error('as fotos não subiram (' + error.message + ')');
      im.caminho = cam;
    }
    /* as artes, na Alta (o vídeo já é Full HD: vai em 1×) */
    const T = CR_TAMANHOS[peca.tamanho], k = T.w >= 1920 ? 1 : 4 / 3;
    const marca = Date.now().toString(36), imagens = [];
    for (let i = 0; i < peca.laminas.length; i++){
      prog(`Gerando e subindo a arte ${i + 1} de ${peca.laminas.length}…`);
      const a = await crArquivo(peca, i, k);
      const cam = `${id}/arte-${marca}-${String(i + 1).padStart(2, '0')}.${a.ext}`;
      const { error } = await sb.storage.from('studio').upload(cam, a.blob, { contentType: a.tipo });
      if (error) throw new Error('a arte não subiu (' + error.message + ')');
      imagens.push({ caminho: cam, largura: a.w, altura: a.h, tipo: a.tipo });
    }
    prog('Registrando…');
    const { data, error } = await sb.rpc('studio_publicacao_salvar', { p: { id, peca: crSerializa(), imagens, modelo: peca.modelo,
      ...(criador.titulo && pub ? { titulo: criador.titulo } : {}) } });
    if (error || data?.status !== 'ok') throw new Error(motivoRPC(data, error, 'O banco recusou a arte'));
    const velhas = (pub?.imagens || []).map(x => x.caminho).filter(c => c && !imagens.some(n => n.caminho === c));
    if (velhas.length) sb.storage.from('studio').remove(velhas).catch(() => {});
    if (mandar){
      prog('Mandando para aprovação…');
      const r = await sb.rpc('studio_mover', { p_id: id, p_status: 'aprovacao' });
      if (r.error || r.data?.status !== 'ok') toast('Salvou, mas não foi para aprovação: ' + motivoRPC(r.data, r.error, 'recusado'), true);
    }
    crApagaRascunho(); criador.sujo = false;
    fechaModal();
    toast(`${codigo} salva${mandar ? ' e mandada para aprovação' : ''}.`);
    location.hash = '#/studio/' + codigo;
  } catch(e){
    prog(''); libera();
    toast('Não deu para salvar: ' + e.message + (/bucket|not found/i.test(e.message) ? ' — falta aplicar a migração v23?' : ''), true);
  }
}

/* ============================================================
   A GALERIA DOS MODELOS
   ============================================================ */
const CR_GRUPOS_MODELOS = [
  ['Institucional', 'O que a equipe fez, onde apareceu, o que publicou', ['na_midia', 'conquista', 'projeto', 'artigo', 'dado', 'aviso']],
  ['Pessoas e parceiros', 'Gente: quem chega, quem faz aniversário, quem caminha com a gente', ['aniversario', 'boas_vindas', 'parabens', 'agradecimento', 'depoimento', 'bastidores']],
  ['Educar, inspirar, convidar', 'Carrosséis que ensinam, datas, frases, chamadas', ['dicas', 'vaga', 'evento', 'data', 'frase', 'enquete']],
  ['Vídeo', 'Thumbnail, capa de reels, barra de nome, cartela e a tela final', ['thumbnail', 'barra_nome', 'cartela', 'encerramento']],
  ['Em branco', 'Todos os leiautes, todos os tamanhos', ['livre']]
];
async function crPaginaModelos(){
  $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Studio</span><h1>Modelos</h1>
      <p class="lead">Cada modelo é uma peça pronta para mudar: troque o texto, a foto, o tema, o acento, acrescente lâminas.
      Todos saem no tamanho exato da rede.</p></div>
      <div class="acoes"><a class="btn solid mini" href="#/studio/criar">${ic('plus')} Peça em branco</a></div></div>
    ${typeof stNav === 'function' ? stNav('modelos') : ''}
    <div class="cr-pilares">${Object.entries(STUDIO_PILARES).map(([k, [l, d, c]]) =>
      `<div class="cr-pilar" style="--c:${c}"><b>${esc(l)}</b><span>${esc(d)}</span></div>`).join('')}</div>
    ${CR_GRUPOS_MODELOS.map(([g, d, ids]) => `<h2 class="cr-gtit">${esc(g)}<span>${esc(d)}</span></h2>
      <div class="cr-galeria">${ids.map(id => {
        const M = crModelo(id), tipo = studioTipo(id), pil = STUDIO_PILARES[tipo?.[2]];
        return `<a class="cr-card${M.laminas.length > 1 ? ' cr-varias' : ''}" href="#/studio/criar/${id}">
          <span class="cr-card-prev" data-modelo="${id}"></span>
          <span class="cr-card-tx"><span class="nm">${esc(tipo?.[1] || id)}</span>
            <span class="sub">${M.laminas.length > 1 ? M.laminas.length + ' lâminas · ' : ''}${M.tamanhos.slice(0, 3).map(t => CR_TAMANHOS[t].l.split(' ')[0]).join(', ')}</span>
            ${pil ? `<span class="pil" style="--c:${pil[2]}">${esc(pil[0])}</span>` : ''}</span></a>`; }).join('')}</div>`).join('')}`;
  await Promise.all([crCarregarMarcas(), crFontes()]);
  const dpr = window.devicePixelRatio || 1;
  for (const el of document.querySelectorAll('.cr-card-prev')){
    const p = crPecaNova(el.dataset.modelo), T = CR_TAMANHOS[p.tamanho];
    const cv = document.createElement('canvas');
    const w = 210, k = w * dpr / T.w;
    crPinta(cv, p, 0, k, { previa:true });
    cv.style.width = w + 'px'; cv.style.height = (w * T.h / T.w) + 'px';
    el.appendChild(cv);
    await new Promise(r => setTimeout(r, 0));   /* devolve o controle entre uma prévia e outra */
  }
}

registrarBusca({
  fonte:'studio-modelos', rotulo:'Modelos do Studio',
  buscar: (t) => filtrarSimples(STUDIO_TIPOS.filter(x => CR_MODELOS[x[0]]).map(x => ({
    titulo: 'Criar: ' + x[1], sub: STUDIO_PILARES[x[2]]?.[0] || 'Modelo', href: '#/studio/criar/' + x[0] })), t, 5)
});
