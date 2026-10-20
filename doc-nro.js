/* ============================================================
   DOC-NRO — o modelo de documento da NeuroDynamics
   O desenho do NRO-PUB-002, o template de base dos outros: a logo
   à esquerda e, alinhados à direita, o departamento (em negrito), o
   título do documento e o código com a revisão. É o mesmo cabeçalho
   que os PDFs do SOMA sempre tiveram (pdfCabecalho, em
   mod-relatorios.js), agora com o departamento de cada documento.

   Tudo o que o SOMA EMITE sai daqui:
     - a declaração de vínculo (NRO-DIR-004, o PN é o registro);
     - a declaração de participação em evento (o PN é o evento);
     - o registro escrito no portal (a ata, o relatório de teste…);
     - o registro de contas digitais, exportado do cofre;
     - a folha de aprovação do aproveitamento de AACC, com o selo
       solene, que entra no relatório no lugar da folha reservada.
   As declarações levam no rodapé a legenda de autenticação — o código
   verificador, o de controle, o endereço de validação e o QR Code.

   Script clássico, sem depender da casca: o portal o carrega com
   carregarLib, e o auth.neurodynamics.dev, que desenha a segunda via
   das declarações de participação, também. Um nome só no escopo
   global — window.DocNRO —, para não colidir com nada da casca.

   Bibliotecas, sob demanda: o jsPDF 2.5.1 do cdnjs (o mesmo dos
   relatórios; se já estiver na página, não desce de novo — descer
   de novo apagaria o autotable que os relatórios penduram nele) e o
   qrcode-generator 1.4.4 do jsDelivr, que só diz quais módulos do QR
   são escuros: o desenho é vetorial, nítido em qualquer impressão.

   A fonte é a Helvetica do PDF, a mesma métrica da Arial dos
   templates. Ela só escreve o que existe no Windows-1252; limpa()
   troca o resto (setas, emojis) antes de desenhar.
   ============================================================ */
(function(){
  'use strict';
  if (window.DocNRO) return;

  const CDN_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  const CDN_QR    = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
  const LOGO_URL  = 'https://raw.githubusercontent.com/matheusmarcondes1/nro/refs/heads/main/imagotipo%20preto.png';
  const URL_VALIDACAO = 'https://auth.neurodynamics.dev';

  /* A página: A4, com as margens do template (a de cima deixa o
     cabeçalho respirar; a de baixo é a do rodapé). */
  const PAG = { w:210, h:297, esq:15, dir:12.5, topo:32.5 };
  const LARG = PAG.w - PAG.esq - PAG.dir;                      /* 182,5 mm */
  const TINTA = [29, 29, 31], CINZA = [96, 96, 99], CLARO = [138, 138, 143];
  const LINHA = [150, 150, 155], FUNDO = [217, 217, 217], FUNDO_CLARO = [242, 242, 242];

  /* ---------------- carregar ---------------- */
  const _scripts = new Map();
  function carregar(src){
    if (_scripts.has(src)) return _scripts.get(src);
    const p = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = src; s.async = false;
      s.onload = () => ok(src);
      s.onerror = () => { _scripts.delete(src); falha(new Error('não foi possível carregar ' + src)); };
      document.head.appendChild(s);
    });
    _scripts.set(src, p);
    return p;
  }
  let LOGO = null;          /* {dados, prop} — ou false, se não veio: aí desenha-se o símbolo */
  async function carregarLogo(){
    if (LOGO !== null) return;
    try{
      const r = await fetch(LOGO_URL); if (!r.ok) throw new Error(r.status);
      const b = await r.blob();
      const dados = await new Promise((ok, falha) => { const fr = new FileReader();
        fr.onload = () => ok(fr.result); fr.onerror = falha; fr.readAsDataURL(b); });
      const img = new Image();
      await new Promise((ok, falha) => { img.onload = ok; img.onerror = falha; img.src = dados; });
      LOGO = { dados, prop: img.naturalWidth / img.naturalHeight };
    }catch(e){ LOGO = false; }
  }
  /* O selo solene (a onda dentro da coroa de louros, em Axon sobre
     branco): só nos atos de chancelaria, como a folha de aprovação do
     aproveitamento de AACC. Mora ao lado deste arquivo, no portal: o
     auth.neurodynamics.dev, que carrega o doc-nro.js do portal, busca
     o selo lá também. */
  const BASE = (() => { try { return new URL('.', document.currentScript.src).href; } catch(e){ return location.origin + '/'; } })();
  const SELO_URL = BASE + 'selo-solene.png';
  let SELO = null;          /* os dados da imagem, ou false: aí a folha sai sem o selo */
  async function carregarSelo(){
    if (SELO !== null) return;
    try{
      const r = await fetch(SELO_URL); if (!r.ok) throw new Error(r.status);
      const b = await r.blob();
      SELO = await new Promise((ok, falha) => { const fr = new FileReader();
        fr.onload = () => ok(fr.result); fr.onerror = falha; fr.readAsDataURL(b); });
    }catch(e){ SELO = false; }
  }
  /* Tudo o que um documento precisa, na primeira vez. */
  async function precisa(op){
    if (!window.jspdf) await carregar(CDN_JSPDF);
    if (typeof window.qrcode !== 'function') await carregar(CDN_QR);
    await carregarLogo();
    if (op && op.selo) await carregarSelo();
  }

  /* ---------------- texto ---------------- */
  /* O que a Helvetica do PDF escreve: Latin-1 mais os extras do
     Windows-1252 (aspas curvas, travessões, reticências, marcador). */
  const EXTRAS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
  const TROCA = { '→':'->', '←':'<-', '⇒':'=>', '≥':'>=', '≤':'<=', '≠':'!=', '✓':'v', '✔':'v', '✗':'x', '✘':'x',
                  ' ':' ', ' ':' ', ' ':' ', '‐':'-', '‑':'-', '−':'-', '→':'->' };
  function limpa(s){
    return String(s == null ? '' : s).normalize('NFC').replace(/\r\n?/g, '\n')
      .replace(/[\s\S]/gu, c => TROCA[c] !== undefined ? TROCA[c]
        : (c.charCodeAt(0) <= 0xFF || EXTRAS.includes(c)) ? c
        : c.length > 1 ? '' : '?');
  }

  /* As larguras da Helvetica e da Helvetica-Bold, em milésimos do corpo
     (as da tabela AFM, as que o leitor de PDF usa para desenhar), na
     ordem de ALFA: ASCII, Latin-1 e os extras do Windows-1252. O
     getTextWidth do jsPDF não serve para diagramar: arredonda as
     larguras e aplica kerning na medida — "Ta" mede menos do que o PDF
     desenha —, e texto justificado palavra a palavra sai encavalado. */
  const ALFA = (() => { let a = ''; for (let c = 32; c < 127; c++) a += String.fromCharCode(c);
    for (let c = 160; c < 256; c++) a += String.fromCharCode(c); return a + EXTRAS; })();
  const W_HELV = '278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,333,333,333,556,537,278,333,333,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500,556,222,556,333,1000,556,556,333,1000,667,333,1000,611,222,222,333,333,350,556,1000,333,1000,500,333,944,500,667'.split(',').map(Number);
  const W_HEBO = '278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,333,333,333,611,556,278,333,333,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556,556,278,556,500,1000,556,556,333,1000,667,333,1000,611,278,278,500,500,350,556,1000,333,1000,556,333,944,500,667'.split(',').map(Number);
  const POS = new Map([...ALFA].map((c, i) => [c, i]));
  let FONTE = { estilo:'normal', tam:10, familia:'helvetica' };
  /* a largura, em mm, na fonte corrente (ou na que se pedir) */
  function mede(t, estilo, tam){
    estilo = estilo || FONTE.estilo; tam = tam || FONTE.tam;
    let u = 0;
    if (FONTE.familia === 'courier' && !arguments[1]) u = [...String(t)].length * 600;
    else { const W = /bold/.test(estilo) ? W_HEBO : W_HELV;
      for (const c of String(t)){ const i = POS.get(c); u += i == null ? 556 : W[i]; } }
    return u / 1000 * tam * 25.4 / 72;
  }
  /* quebra um texto em linhas que cabem em larg (mm), na fonte corrente;
     palavra maior que a linha se parte */
  function quebra(texto, larg){
    const out = []; let linha = '';
    for (let p of String(texto).split(' ')){
      while (mede(p) > larg){
        if (linha){ out.push(linha); linha = ''; }
        let n = p.length; while (n > 1 && mede(p.slice(0, n)) > larg) n--;
        out.push(p.slice(0, n)); p = p.slice(n);
      }
      const tent = linha ? linha + ' ' + p : p;
      if (!linha || mede(tent) <= larg) linha = tent;
      else { out.push(linha); linha = p; }
    }
    out.push(linha);
    return out;
  }

  const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const partes = iso => { const [a, m, d] = String(iso || '').slice(0, 10).split('-').map(Number); return { a, m, d }; };
  const valida = iso => /^\d{4}-\d{2}-\d{2}/.test(String(iso || ''));
  function dataExtenso(iso){ if (!valida(iso)) return ''; const { a, m, d } = partes(iso);
    return `${d === 1 ? '1º' : d} de ${MESES[m - 1]} de ${a}`; }
  function mesAno(iso){ if (!valida(iso)) return ''; const { a, m } = partes(iso); return `${MESES[m - 1]} de ${a}`; }
  function dataCurta(iso){ if (!valida(iso)) return ''; const { a, m, d } = partes(iso);
    return `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`; }
  /* "16:00" → "16 horas", "16:30" → "16h30", "01:00" → "1 hora" */
  function horaExtenso(hhmm){
    const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); if (!m) return '';
    const h = +m[1], mi = +m[2];
    return mi ? `${h}h${String(mi).padStart(2, '0')}` : `${h} ${h === 1 ? 'hora' : 'horas'}`;
  }
  const horaCurta = hhmm => { const m = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || '')); if (!m) return '';
    return +m[2] ? `${+m[1]}h${m[2]}` : `${+m[1]}h`; };
  /* 8 → "8 horas"; 2,5 → "2 horas e 30 minutos"; 0,5 → "30 minutos" */
  function horasExtenso(n){
    const t = Math.round(Number(n || 0) * 60), h = Math.floor(t / 60), mi = t % 60;
    const ph = h ? `${h} ${h === 1 ? 'hora' : 'horas'}` : '', pm = mi ? `${mi} ${mi === 1 ? 'minuto' : 'minutos'}` : '';
    return ph && pm ? `${ph} e ${pm}` : (ph || pm || '0 hora');
  }
  const horasCurto = n => { const t = Math.round(Number(n || 0) * 60), h = Math.floor(t / 60), mi = t % 60;
    return mi ? `${h}h${String(mi).padStart(2, '0')}` : `${h}h`; };
  const minutosCurto = min => { if (!min) return '—'; const h = Math.floor(min / 60), mi = min % 60;
    return h ? `${h} h${mi ? ' ' + mi + ' min' : ''}` : `${mi} min`; };
  /* o período de um evento, como a frase o diz */
  function periodo(ini, fim){
    if (!valida(ini)) return '';
    if (!valida(fim) || String(fim).slice(0, 10) === String(ini).slice(0, 10)) return `no dia ${dataExtenso(ini)}`;
    const a = partes(ini), b = partes(fim);
    if (a.a === b.a && a.m === b.m){
      const di = a.d === 1 ? '1º' : a.d;
      return b.d === a.d + 1 ? `nos dias ${di} e ${b.d} de ${MESES[b.m - 1]} de ${b.a}`
                             : `de ${di} a ${b.d} de ${MESES[b.m - 1]} de ${b.a}`;
    }
    if (a.a === b.a) return `de ${a.d === 1 ? '1º' : a.d} de ${MESES[a.m - 1]} a ${dataExtenso(fim)}`;
    return `de ${dataExtenso(ini)} a ${dataExtenso(fim)}`;
  }
  const periodoCurto = (ini, fim) => valida(fim) && String(fim).slice(0, 10) !== String(ini).slice(0, 10)
    ? `${dataCurta(ini)} a ${dataCurta(fim)}` : dataCurta(ini);
  /* "2026-09-24T18:23:00Z" → "24/09/2026, às 15h23" (horário de Brasília) */
  function momento(ts){
    const d = new Date(ts); if (isNaN(d)) return '';
    const f = new Intl.DateTimeFormat('pt-BR', { timeZone:'America/Sao_Paulo', day:'2-digit', month:'2-digit',
      year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }).formatToParts(d);
    const v = t => f.find(x => x.type === t)?.value || '';
    return `${v('day')}/${v('month')}/${v('year')}, às ${v('hour')}h${v('minute')}`;
  }
  /* "DECLARAÇÃO DE VÍNCULO" → "Declaração de vínculo" (o que está entre
     parênteses fica como está: é sigla) */
  function tituloFrase(t){
    const s = String(t || '').trim();
    if (!s || /[a-zà-ÿ]/.test(s)) return s;
    const low = s.toLowerCase().replace(/\(([^)]*)\)/g, (x, y) => '(' + y.toUpperCase() + ')');
    return low.charAt(0).toUpperCase() + low.slice(1);
  }

  /* ---------------- a página ---------------- */
  function novo(){
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4', compress:true });
    doc.__textos = [[]];           /* o que foi escrito, por página — os testes leem */
    return doc;
  }
  const cor = (doc, c) => doc.setTextColor(c[0], c[1], c[2]);
  function fonte(doc, estilo, tamanho){
    doc.setFont('helvetica', estilo || 'normal'); if (tamanho) doc.setFontSize(tamanho);
    FONTE = { estilo: estilo || 'normal', tam: tamanho || FONTE.tam, familia:'helvetica' };
  }
  /* escreve e anota: a camada de texto do PDF é esta mesma */
  function escreve(doc, txt, x, y, op){
    const t = limpa(txt); if (!t) return;
    /* o alinhamento também pela medida certa (o do jsPDF erra como a medida dele) */
    const al = op && op.align;
    if (al === 'right') x -= mede(t);
    else if (al === 'center') x -= mede(t) / 2;
    doc.text(t, x, y);
    const pg = doc.internal.getCurrentPageInfo().pageNumber;
    (doc.__textos[pg - 1] = doc.__textos[pg - 1] || []).push(t);
  }

  /* o símbolo da marca, desenhado — a reserva quando a logo não veio */
  function simbolo(doc, x, y, s){
    doc.setFillColor(TINTA[0], TINTA[1], TINTA[2]);
    doc.circle(x + s * .33, y + s * .5, s * .24, 'F');
    doc.circle(x + s * .8,  y + s * .26, s * .13, 'F');
    doc.circle(x + s * .8,  y + s * .74, s * .13, 'F');
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(s * .075);
    doc.line(x + s * .5, y + s * .42, x + s * .68, y + s * .31);
    doc.line(x + s * .5, y + s * .58, x + s * .68, y + s * .69);
  }

  /* O cabeçalho do NRO-PUB-002, em toda folha: a logo à esquerda; à
     direita, o departamento em negrito, o título e o código com a
     revisão. */
  function cabecalho(doc, c){
    const x1 = PAG.w - PAG.dir;
    if (LOGO){
      const h = 8.6, w = Math.min(h * LOGO.prop, 70);
      doc.addImage(LOGO.dados, 'PNG', PAG.esq, 10.2, w, h);
    } else {
      simbolo(doc, PAG.esq, 10.2, 8.6);
      cor(doc, TINTA); fonte(doc, 'bold', 12.5);
      escreve(doc, 'NeuroDynamics', PAG.esq + 10.4, 16.5);
    }
    cor(doc, TINTA);
    const cortar = (t, max) => { let s = limpa(t); while (s.length > 8 && mede(s) > max) s = s.slice(0, -2);
      return s === limpa(t) ? s : s.trim() + '…'; };
    fonte(doc, 'bold', 9.5);  escreve(doc, cortar(c.departamento || 'NeuroDynamics', 100), x1, 12.6, { align:'right' });
    fonte(doc, 'normal', 9.5); escreve(doc, cortar(c.titulo || '', 100), x1, 16.8, { align:'right' });
    escreve(doc, (c.codigo || '') + (c.rev ? ' Rev. ' + c.rev : ''), x1, 21, { align:'right' });
  }

  /* ============================================================
     O ESCRITOR — escreve de cima para baixo, quebra a página quando
     não cabe (com o cabeçalho na folha nova), numera as linhas quando
     o documento pede (a ata) e justifica o texto como o Word justifica:
     toda linha de um parágrafo, menos a última.
     ============================================================ */
  function escritor(doc, cab, op = {}){
    const e = {
      doc, cab, y: PAG.topo, x0: PAG.esq, x1: PAG.w - PAG.dir, larg: LARG,
      base: PAG.h - (op.rodape || 24), numerar: !!op.numerar, linha: 0, corpo: op.corpo || 10.5
    };
    cabecalho(doc, cab);
    e.novaPagina = () => {
      doc.addPage(); doc.__textos.push([]);
      cabecalho(doc, cab); e.y = PAG.topo;
    };
    e.garante = h => { if (e.y + h > e.base) e.novaPagina(); };
    e.espaco = mm => { e.y += mm; };
    /* o número da linha, na margem, para ninguém inserir nada depois */
    const numero = y => {
      if (!e.numerar) return;
      e.linha++;
      cor(doc, CLARO); fonte(doc, 'normal', 7.5);
      escreve(doc, String(e.linha), e.x0 - 3.2, y, { align:'right' });
    };

    /* Um parágrafo de trechos com estilo: [{t, b, i}]. Trechos que se
       tocam sem espaço ("MARINHO" em negrito e a vírgula depois dele)
       formam uma unidade só: não se separam na quebra de linha, e o
       espaço da justificação só entra onde o texto tem espaço. */
    e.rico = (trechos, o = {}) => {
      const tam = o.tamanho || e.corpo, lh = o.entrelinha || tam * .52, larg = o.largura || (e.larg - (o.recuo || 0));
      const x0 = e.x0 + (o.recuo || 0), alinhar = o.alinhar || 'justify';
      const est = t => t.b && t.i ? 'bolditalic' : t.b ? 'bold' : t.i ? 'italic' : 'normal';
      /* as unidades: pedaços colados, cada pedaço com o seu estilo */
      const unidades = [];
      let cur = null, colado = false;
      trechos.forEach(t => {
        String(limpa(t.t)).split(/(\n| +)/).forEach(p => {
          if (p === '') return;
          if (p === '\n'){ unidades.push({ quebra:true }); cur = null; colado = false; return; }
          if (/^ +$/.test(p)){ cur = null; colado = false; return; }
          if (cur && colado) cur.pedacos.push({ t:p, e:est(t) });
          else { cur = { pedacos:[{ t:p, e:est(t) }] }; unidades.push(cur); }
          colado = true;
        });
      });
      fonte(doc, 'normal', tam);
      const esp = mede(' ');
      const medir = u => { u.w = 0; u.pedacos.forEach(p => { fonte(doc, p.e, tam); p.w = mede(p.t); u.w += p.w; }); };
      /* unidade maior que a linha se parte em pedaços que cabem */
      const us = [];
      unidades.forEach(u => {
        if (u.quebra) return us.push(u);
        medir(u);
        if (u.w <= larg) return us.push(u);
        u.pedacos.forEach(p => {
          fonte(doc, p.e, tam); let resto = p.t;
          while (resto){ let n = resto.length;
            while (n > 1 && mede(resto.slice(0, n)) > larg) n--;
            const pd = resto.slice(0, n); us.push({ pedacos:[{ t:pd, e:p.e, w:mede(pd) }], w:mede(pd) });
            resto = resto.slice(n); }
        });
      });
      /* as linhas */
      const linhas = []; let lin = [], w = 0;
      us.forEach(u => {
        if (u.quebra){ linhas.push({ us:lin, ultima:true }); lin = []; w = 0; return; }
        const add = lin.length ? esp + u.w : u.w;
        if (lin.length && w + add > larg){ linhas.push({ us:lin, ultima:false }); lin = [u]; w = u.w; }
        else { lin.push(u); w += add; }
      });
      if (lin.length || !linhas.length) linhas.push({ us:lin, ultima:true });
      linhas.forEach(l => {
        e.garante(lh);
        const y = e.y + lh * .78;
        numero(y);
        cor(doc, o.cor || TINTA);
        const soma = l.us.reduce((s, u) => s + u.w, 0);
        const vaos = l.us.length - 1;
        let gap = esp;
        if (alinhar === 'justify' && !l.ultima && vaos > 0) gap = (larg - soma) / vaos;
        let x = x0;
        if (alinhar === 'center') x = x0 + (larg - soma - esp * vaos) / 2;
        if (alinhar === 'right')  x = x0 + larg - soma - esp * vaos;
        /* o espaço vai escrito depois da palavra (e a justificação só
           acrescenta distância): quem copia o texto do PDF recebe as
           palavras separadas */
        l.us.forEach((u, iu) => {
          u.pedacos.forEach((p, ip) => { fonte(doc, p.e, tam);
            escreve(doc, ip === u.pedacos.length - 1 && iu < l.us.length - 1 ? p.t + ' ' : p.t, x, y); x += p.w; });
          x += gap;
        });
        e.y += lh;
      });
      e.y += o.depois == null ? tam * .32 : o.depois;
      return e;
    };
    /* texto simples; **negrito** vira trecho */
    e.paragrafo = (txt, o = {}) => e.rico(trechosDe(txt, o), o);

    /* o título de uma seção, como os templates escrevem ("Objetivo do teste") */
    e.titulo = (txt, o = {}) => {
      e.garante(16);
      e.y += o.antes == null ? 3 : o.antes;
      cor(doc, TINTA); fonte(doc, o.negrito ? 'bold' : 'normal', o.tamanho || 14);
      escreve(doc, txt, e.x0, e.y + 5.2);
      e.y += 8;
      return e;
    };
    e.subtitulo = txt => {
      e.garante(12);
      cor(doc, TINTA); fonte(doc, 'bold', 10.5);
      escreve(doc, txt, e.x0, e.y + 4.2);
      e.y += 7;
      return e;
    };
    e.instrucao = txt => e.rico([{ t:txt, i:true }], { tamanho:9, cor:CINZA, alinhar:'left', depois:2 });
    e.nota = txt => e.rico([{ t:txt, i:true }], { tamanho:9, cor:CLARO, alinhar:'left', depois:2 });

    /* uma lista: "1.", "A.", "a.", "I." ou "•"; a pontuação vai no fim de
       cada item e a do último é a que a frase pede (a ata: ";" e ",") */
    e.lista = (itens, o = {}) => {
      const tam = o.tamanho || e.corpo, recuo = 8.5;
      itens.forEach((it, i) => {
        const txt = String(it || '').trim() + (o.pontuacao ? (i === itens.length - 1 ? (o.final ?? '') : o.pontuacao) : '');
        const mk = marcador(o.marcador || '•', i);
        e.garante(tam * .52);
        cor(doc, TINTA); fonte(doc, 'normal', tam);
        escreve(doc, mk, e.x0 + recuo - 2, e.y + tam * .52 * .78, { align:'right' });
        e.rico(trechosDe(txt, o), { tamanho:tam, recuo, depois:i === itens.length - 1 ? tam * .32 : .6, alinhar:o.alinhar || 'left' });
      });
      return e;
    };

    /* uma caixa com texto dentro — o "Objetivo do teste" do template */
    e.moldura = (txt, o = {}) => {
      const tam = o.tamanho || 10, pad = 2.6, lh = tam * .5;
      fonte(doc, 'normal', tam);
      const ls = String(limpa(txt || '')).split('\n').flatMap(p => p ? quebra(p, e.larg - pad * 2) : ['']);
      let i = 0;
      while (i < ls.length || i === 0){
        e.garante(Math.min(lh * 3, (ls.length - i) * lh) + pad * 2);
        const cabe = Math.max(1, Math.floor((e.base - e.y - pad * 2) / lh));
        const parte = ls.slice(i, i + cabe);
        const h = Math.max(parte.length, o.minimo || 2) * lh + pad * 2;
        doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.25);
        doc.rect(e.x0, e.y, e.larg, h);
        cor(doc, TINTA); fonte(doc, 'normal', tam);
        parte.forEach((l, k) => { const y = e.y + pad + lh * (k + .78); numero(y); escreve(doc, l, e.x0 + pad, y); });
        e.y += h + 3; i += parte.length;
        if (!ls.length) break;
      }
      return e;
    };

    /* A tabela do template: borda fina, cabeçalho cinza em maiúsculas,
       texto quebrado dentro da célula, e o cabeçalho de novo na folha
       seguinte. Célula pode ser texto ou {simbolo:'ok'|'x'|'~'|'-'}. */
    e.tabela = (colunas, linhas, o = {}) => {
      const tam = o.tamanho || 8.6, pad = 1.6, lh = tam * .46, total = colunas.reduce((s, c) => s + (c.largura || 1), 0);
      const ws = colunas.map(c => e.larg * (c.largura || 1) / total);
      const xs = ws.reduce((a, w, i) => (a.push(i ? a[i - 1] + ws[i - 1] : e.x0), a), []);
      const linhasDe = (txt, w, estilo, t) => { fonte(doc, estilo, t);
        return String(limpa(txt ?? '')).split('\n').flatMap(p => p ? quebra(p, w - pad * 2) : ['']); };
      const cabec = () => {
        const cels = colunas.map((c, i) => linhasDe(String(c.rotulo || '').toUpperCase(), ws[i], 'bold', 6.8));
        const h = Math.max(...cels.map(l => l.length)) * 6.8 * .45 + pad * 2;
        colunas.forEach((c, i) => {
          doc.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.25);
          doc.rect(xs[i], e.y, ws[i], h, 'FD');
          cor(doc, TINTA); fonte(doc, 'bold', 6.8);
          cels[i].forEach((l, k) => escreve(doc, l, xs[i] + pad, e.y + pad + 6.8 * .45 * (k + .8)));
        });
        e.y += h;
      };
      e.garante(22);
      if (o.cabecalho !== false) cabec();
      linhas.forEach((ln, r) => {
        const cels = ln.map((v, i) => v && typeof v === 'object' && v.simbolo ? { sim:v.simbolo, rot:v.rotulo }
          : { ls: linhasDe(v, ws[i], (colunas[i].negrito ? 'bold' : 'normal'), tam) });
        const h = Math.max(o.alturaMin || 0, ...cels.map(c => c.ls ? c.ls.length * lh : lh)) + pad * 2;
        if (e.y + h > e.base){ e.novaPagina(); if (o.cabecalho !== false) cabec(); }
        cels.forEach((c, i) => {
          if (o.zebra && r % 2) { doc.setFillColor(FUNDO_CLARO[0], FUNDO_CLARO[1], FUNDO_CLARO[2]); doc.rect(xs[i], e.y, ws[i], h, 'F'); }
          doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.25); doc.rect(xs[i], e.y, ws[i], h);
          cor(doc, TINTA); fonte(doc, colunas[i].negrito ? 'bold' : 'normal', tam);
          if (c.sim){ glifo(doc, c.sim, xs[i] + ws[i] / 2, e.y + pad + lh * .45, lh * .95); }
          else c.ls.forEach((l, k) => escreve(doc, l, colunas[i].alinhar === 'center' ? xs[i] + ws[i] / 2
            : colunas[i].alinhar === 'right' ? xs[i] + ws[i] - pad : xs[i] + pad,
            e.y + pad + lh * (k + .8), colunas[i].alinhar && colunas[i].alinhar !== 'left' ? { align:colunas[i].alinhar } : undefined));
        });
        e.y += h;
      });
      e.y += o.depois == null ? 4 : o.depois;
      return e;
    };

    /* A ficha do alto do relatório: pares RÓTULO | valor, dois por linha. */
    e.ficha = (linhas, o = {}) => {
      const tam = 8.8, pad = 1.8, lh = tam * .46, wr = o.rotulo || 27;
      linhas.forEach(ln => {
        const pares = ln.length;
        const wEstreito = 26;
        const temEstreito = ln.some(c => c.estreito);
        const wVal = pares === 1 ? e.larg - wr
          : temEstreito ? null : (e.larg - wr * pares) / pares;
        const larguras = ln.map(c => pares === 1 ? wVal : temEstreito
          ? (c.estreito ? wEstreito : e.larg - wr * pares - wEstreito) : wVal);
        const cels = ln.map((c, i) => { fonte(doc, 'normal', tam);
          return String(limpa(c.valor || '')).split('\n').flatMap(p => p ? quebra(p, larguras[i] - pad * 2) : ['']); });
        const rots = ln.map(c => { fonte(doc, 'bold', 6.8); return quebra(limpa(String(c.rotulo || '').toUpperCase()), wr - pad * 2); });
        const h = Math.max(7.4, ...cels.map(l => l.length * lh + pad * 2), ...rots.map(l => l.length * 6.8 * .45 + pad * 2));
        e.garante(h);
        let x = e.x0;
        ln.forEach((c, i) => {
          doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.25);
          doc.setFillColor(FUNDO[0], FUNDO[1], FUNDO[2]); doc.rect(x, e.y, wr, h, 'FD');
          cor(doc, TINTA); fonte(doc, 'bold', 6.8);
          rots[i].forEach((l, k) => escreve(doc, l, x + pad, e.y + h / 2 - (rots[i].length - 1) * 6.8 * .45 / 2 + 1));
          x += wr;
          doc.rect(x, e.y, larguras[i], h);
          fonte(doc, 'normal', tam);
          cels[i].forEach((l, k) => escreve(doc, l, x + pad, e.y + pad + lh * (k + .8)));
          x += larguras[i];
        });
        e.y += h;
      });
      e.y += 5;
      return e;
    };
    /* RÓTULO | valor, um por linha — a "Preparação" do relatório de teste */
    e.chaveValor = (pares, o = {}) => e.tabela(
      [{ rotulo:'', largura:o.rotulo || 1, negrito:true }, { rotulo:'', largura:o.valor || 2.6 }],
      pares.map(([r, v]) => [String(r).toUpperCase(), v || '']), { cabecalho:false, alturaMin: o.alturaMin || 7, tamanho:8.6 });

    return e;
  }

  /* os marcadores de lista */
  function marcador(tipo, i){
    const romano = n => [['M',1000],['CM',900],['D',500],['CD',400],['C',100],['XC',90],['L',50],['XL',40],['X',10],['IX',9],['V',5],['IV',4],['I',1]]
      .reduce((s, [r, v]) => { while (n >= v){ s += r; n -= v; } return s; }, '');
    const letra = n => { let s = ''; n++; while (n){ n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; };
    switch (tipo){
      case '1.': return (i + 1) + '.';
      case 'A.': return letra(i) + '.';
      case 'a.': return letra(i).toLowerCase() + '.';
      case 'I.': return romano(i + 1) + '.';
      case '–':  return '–';
      default:   return '•';
    }
  }
  /* **negrito** num texto simples. (Sem lookbehind nas expressões: o
     auth.neurodynamics.dev abre em qualquer celular, e um Safari antigo
     recusaria o arquivo inteiro.) */
  function trechosDe(txt, o = {}){
    const s = String(txt ?? '');
    if (o.cru) return [{ t:s, b:!!o.negrito, i:!!o.italico }];
    const out = []; const re = /\*\*([^*]+)\*\*/g; let k = 0, m;
    while ((m = re.exec(s))){
      if (m.index > k) out.push({ t:s.slice(k, m.index), b:!!o.negrito, i:!!o.italico });
      out.push({ t:m[1], b:true, i:!!o.italico });
      k = m.index + m[0].length;
    }
    if (k < s.length) out.push({ t:s.slice(k), b:!!o.negrito, i:!!o.italico });
    return out.length ? out : [{ t:'', b:false }];
  }

  /* o status do roteiro, desenhado (a Helvetica do PDF não tem ✔ nem ✘) */
  function glifo(doc, s, cx, cy, t){
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(.35);
    const h = t / 2;
    if (s === 'ok'){ doc.line(cx - h, cy, cx - h * .25, cy + h * .7); doc.line(cx - h * .25, cy + h * .7, cx + h, cy - h * .75); }
    else if (s === 'x'){ doc.line(cx - h * .8, cy - h * .8, cx + h * .8, cy + h * .8); doc.line(cx - h * .8, cy + h * .8, cx + h * .8, cy - h * .8); }
    else if (s === '~'){ fonte(doc, 'bold', 10); escreve(doc, '~', cx, cy + h * .7, { align:'center' }); }
    else { doc.line(cx - h * .7, cy, cx + h * .7, cy); }
  }

  /* ---------------- o QR Code ---------------- */
  /* Vetorial: um retângulo por trecho de módulos escuros na mesma linha. */
  function qr(doc, texto, x, y, lado){
    const q = window.qrcode(0, 'M'); q.addData(texto); q.make();
    const n = q.getModuleCount(), m = lado / n;
    doc.setFillColor(0, 0, 0);
    for (let r = 0; r < n; r++){
      let c = 0;
      while (c < n){
        if (!q.isDark(r, c)){ c++; continue; }
        let f = c; while (f < n && q.isDark(r, f)) f++;
        doc.rect(x + c * m, y + r * m, (f - c) * m + .01, m + .01, 'F');
        c = f;
      }
    }
    return n;
  }

  /* ---------------- os rodapés ---------------- */
  const artigo = nome => /^departamento/i.test(nome || '') ? 'do' : 'da';
  /* A nota da classe do documento, como o relatório de teste traz. */
  function notaDaClasse(classe, emissor, natureza){
    if (classe !== 'controlado' && classe !== 'confidencial') return '';
    const quem = emissor && !/^geral$/i.test(emissor) ? `${artigo(emissor)} ${emissor} da NRO` : 'da NeuroDynamics PD&I';
    return `Este ${natureza === 'documento' ? 'documento' : 'registro'} é propriedade confidencial da NeuroDynamics PD&I, `
      + `e não deve ser compartilhado, distribuído, copiado ou divulgado sem autorização expressa ${quem}.`;
  }
  /* O rodapé de um registro: a nota da classe, centralizada e em itálico,
     e a linha com o código, de onde veio e a página. */
  function rodape(doc, o){
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++){
      doc.setPage(i);
      let y = PAG.h - 14.5;
      if (o.nota){
        cor(doc, CINZA); fonte(doc, 'italic', 7.4);
        const ls = quebra(limpa(o.nota), LARG - 10);
        y -= (ls.length - 1) * 3.1;
        ls.forEach((l, k) => escreve(doc, l, PAG.w / 2, y + k * 3.1, { align:'center' }));
      }
      doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.2);
      doc.line(PAG.esq, PAG.h - 10.5, PAG.w - PAG.dir, PAG.h - 10.5);
      cor(doc, CLARO); fonte(doc, 'normal', 7.2);
      if (o.texto) escreve(doc, o.texto, PAG.esq, PAG.h - 7);
      escreve(doc, `Página ${i} de ${total}`, PAG.w - PAG.dir, PAG.h - 7, { align:'right' });
    }
  }
  /* A LEGENDA DE AUTENTICAÇÃO, em toda folha de um documento emitido:
     o QR Code à esquerda e, ao lado, a certidão — quando e por quem foi
     emitido, que dispensa assinatura, e como conferir. Embaixo, o código
     do documento e a página. */
  function rodapeAutenticado(doc, a){
    const total = doc.getNumberOfPages();
    const url = (a.url || a.url_validacao || URL_VALIDACAO).replace(/\/+$/, '');
    const link = `${url}/?c=${a.codigo}`;
    const host = url.replace(/^https?:\/\//, '');
    for (let i = 1; i <= total; i++){
      doc.setPage(i);
      const top = PAG.h - 37, h = 25.5, lado = 21;
      doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(.3);
      doc.rect(PAG.esq, top, LARG, h);
      doc.setLineWidth(.15); doc.rect(PAG.esq + .8, top + .8, LARG - 1.6, h - 1.6);
      qr(doc, link, PAG.esq + 2.6, top + (h - lado) / 2, lado);
      const tx = PAG.esq + lado + 6.2, tw = LARG - lado - 9.5;
      cor(doc, TINTA); fonte(doc, 'bold', 7.2);
      escreve(doc, 'DOCUMENTO EMITIDO ELETRONICAMENTE · AUTENTICIDADE VERIFICÁVEL', tx, top + 5.1);
      fonte(doc, 'normal', 7.1); cor(doc, [60, 60, 64]);
      const corpo = `Documento emitido pelo SOMA, o sistema de gestão da NeuroDynamics PD&I, em ${momento(a.emitido_em)} `
        + `(horário oficial de Brasília), com a informação registrada no sistema nessa data. Dispensa assinatura. `
        + `A autenticidade deste documento pode ser conferida em ${host}, informando o código verificador `
        + `${a.codigo} e o código de controle ${a.controle}, ou pela leitura do QR Code ao lado.`;
      const ls = quebra(limpa(corpo), tw);
      ls.forEach((l, k) => escreve(doc, l, tx, top + 9.2 + k * 3.05));
      /* o código em destaque, como se lê em voz alta */
      cor(doc, TINTA); doc.setFont('courier', 'bold'); doc.setFontSize(8.4); FONTE = { estilo:'bold', tam:8.4, familia:'courier' };
      escreve(doc, `CÓDIGO VERIFICADOR ${a.codigo}   ·   CONTROLE ${a.controle}`, tx, top + h - 2.6);
      cor(doc, CLARO); fonte(doc, 'normal', 7.2);
      escreve(doc, `${a.documento}${a.revisao ? ' Rev. ' + a.revisao : ''} · ${host}`, PAG.esq, PAG.h - 7);
      escreve(doc, `Página ${i} de ${total}`, PAG.w - PAG.dir, PAG.h - 7, { align:'right' });
    }
  }

  /* ============================================================
     OS DOCUMENTOS
     ============================================================ */
  const INSTITUICAO = 'A NeuroDynamics PD&I é uma Instituição de Ciência e Tecnologia, vinculada ao Laboratório de '
    + 'Engenharia Biomédica e ao Laboratório de Bioengenharia da Escola de Engenharia da Universidade Federal de Minas '
    + 'Gerais (UFMG), voltada ao desenvolvimento, integração e aplicação de soluções em engenharia biomédica que '
    + 'conectam saúde, tecnologia e sistemas complexos.';
  const nomeArq = s => limpa(s).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();

  /* A frase da declaração de vínculo, em trechos (o nome vai em
     negrito, como no modelo). Sem o que o SOMA não sabe: nada de
     atribuições escritas à mão, nada de finalidade. */
  function textoVinculo(d){
    const cargo = d.cargo ? String(d.cargo).toUpperCase() : null;
    const t = [{ t:'Declaramos, para os devidos fins, que ' }, { t:String(d.nome || '').toUpperCase(), b:true }];
    if (d.cpf) t.push({ t:`, CPF nº ${d.cpf},` });
    if (d.vigente !== false){
      t.push({ t: cargo ? ` atua como ${cargo} da NeuroDynamics PD&I` : ' integra a equipe da NeuroDynamics PD&I' });
      if (d.desde) t.push({ t:` desde ${mesAno(d.desde)}` });
    } else {
      t.push({ t: cargo ? ` atuou como ${cargo} da NeuroDynamics PD&I` : ' integrou a equipe da NeuroDynamics PD&I' });
      if (d.desde && d.ate) t.push({ t:` de ${mesAno(d.desde)} a ${mesAno(d.ate)}` });
      else if (d.desde) t.push({ t:` a partir de ${mesAno(d.desde)}` });
      else if (d.ate) t.push({ t:` até ${mesAno(d.ate)}` });
    }
    t.push({ t:'.' });
    return t;
  }

  /* A DECLARAÇÃO DE VÍNCULO. e = a emissão (código, controle, documento,
     revisão, emissor, emitido_em, url); e.dados = a fotografia. */
  function declaracaoVinculo(e){
    const d = e.dados || {};
    const doc = novo();
    const cab = { departamento:e.emissor || 'Diretoria', titulo:e.titulo || 'Declaração de vínculo', codigo:e.documento, rev:e.revisao };
    const w = escritor(doc, cab, { rodape:40 });
    doc.setProperties({ title:`${e.documento} ${cab.titulo} — ${d.nome || ''}`, subject:`Código verificador ${e.codigo}`,
      author:'NeuroDynamics PD&I', creator:'SOMA · NeuroDynamics' });
    w.paragrafo(`${d.cidade || 'Belo Horizonte'}, ${dataExtenso(d.data)}`, { alinhar:'left', cru:true, depois:9 });
    w.rico(textoVinculo(d), { depois:3.4 });
    w.paragrafo(d.texto_instituicao || INSTITUICAO, { cru:true, depois:3.4 });
    const nT = (d.treinamentos || []).length, nE = (d.eventos || []).length;
    w.paragrafo(nT || nE
      ? `Na folha seguinte constam ${nT ? (nT === 1 ? 'o treinamento concluído' : 'os treinamentos concluídos') : ''}${nT && nE ? ' e ' : ''}${
          nE ? (nE === 1 ? 'o evento de que participou' : 'os eventos de que participou') : ''} pela NeuroDynamics PD&I, conforme os registros do SOMA na data de emissão.`
      : 'Na folha seguinte consta o registro de formação e de participação em eventos, conforme os registros do SOMA na data de emissão.',
      { cru:true, depois:3.4 });

    /* a segunda folha: o breve registro */
    w.novaPagina();
    w.titulo('Registro de formação e de participação em eventos', { antes:0, tamanho:13 });
    w.paragrafo(`${String(d.nome || '').toUpperCase()} · registros do SOMA em ${dataExtenso(d.data)}.`, { cru:true, tamanho:9, cor:CINZA, alinhar:'left', depois:4 });
    w.subtitulo('Treinamentos concluídos');
    if (nT){
      w.tabela([{ rotulo:'Código', largura:1.35 }, { rotulo:'Treinamento', largura:3.6 }, { rotulo:'Rev.', largura:.55, alinhar:'center' },
                { rotulo:'Carga horária', largura:1.15 }, { rotulo:'Conclusão', largura:1.1 }, { rotulo:'Certificado', largura:1.6 }],
        d.treinamentos.map(t => [t.codigo, t.titulo, t.revisao || '—', minutosCurto(t.carga_horaria_min), dataCurta(t.concluido_em), t.certificado || '—']));
      const min = d.treinamentos.reduce((s, t) => s + (t.carga_horaria_min || 0), 0);
      if (min) w.nota(`Carga horária somada: ${minutosCurto(min)}.`);
    } else w.nota('Nenhum treinamento concluído até a data de emissão.');
    w.espaco(3);
    w.subtitulo('Participação em eventos');
    if (nE){
      w.tabela([{ rotulo:'Código', largura:.9 }, { rotulo:'Evento', largura:3.4 }, { rotulo:'Período', largura:1.55 },
                { rotulo:'Local', largura:1.8 }, { rotulo:'Função', largura:1.25 }, { rotulo:'Horas', largura:.75, alinhar:'right' }],
        d.eventos.map(v => [v.codigo, v.nome, periodoCurto(v.data_inicio, v.data_fim),
          v.modalidade === 'online' ? 'Online' : (v.local || '—'), v.papel || 'Participante', horasCurto(v.horas)]));
      const h = d.eventos.reduce((s, v) => s + Number(v.horas || 0), 0);
      w.nota(`Horas dedicadas, somadas: ${horasExtenso(h)}.`);
    } else w.nota('Nenhum evento registrado e aprovado até a data de emissão.');

    rodapeAutenticado(doc, e);
    doc.__nome = `${e.documento} ${tituloFrase(cab.titulo).toUpperCase()} - ${nomeArq(d.nome || '')}.pdf`;
    return doc;
  }

  /* A frase da declaração de participação. */
  function textoParticipacao(d){
    const ev = d.evento || {};
    const t = [{ t:'Declaramos, para os devidos fins, que ' }, { t:String(d.nome || '').toUpperCase(), b:true },
      { t: d.membro ? ' participou, como integrante da NeuroDynamics PD&I' : ' participou, junto à equipe da NeuroDynamics PD&I' }];
    if (d.papel) t.push({ t:`, na condição de ${String(d.papel).trim().toLowerCase()}` });
    t.push({ t:', do evento ' }, { t:String(ev.nome || '').trim(), b:true });
    const onde = ev.modalidade === 'online' ? ', realizado online'
      : ev.modalidade === 'hibrido' ? `, realizado em formato híbrido${ev.local ? ', em ' + ev.local : ''}`
      : ev.local ? `, realizado em ${ev.local}` : '';
    t.push({ t:onde + ', ' + periodo(ev.data_inicio, ev.data_fim) });
    if (ev.hora_inicio && ev.hora_fim && !ev.data_fim) t.push({ t:`, das ${horaCurta(ev.hora_inicio)} às ${horaCurta(ev.hora_fim)}` });
    else if (ev.hora_inicio && !ev.data_fim) t.push({ t:`, a partir das ${horaCurta(ev.hora_inicio)}` });
    t.push({ t:`, com dedicação de ${horasExtenso(d.horas)}.` });
    return t;
  }
  function declaracaoParticipacao(e){
    const d = e.dados || {}, ev = d.evento || {};
    const doc = novo();
    const cab = { departamento:e.emissor || 'Diretoria', titulo:e.titulo || 'Declaração de participação', codigo:e.documento, rev:e.revisao };
    const w = escritor(doc, cab, { rodape:40 });
    doc.setProperties({ title:`${e.documento} ${cab.titulo} — ${d.nome || ''}`, subject:`Código verificador ${e.codigo}`,
      author:'NeuroDynamics PD&I', creator:'SOMA · NeuroDynamics' });
    w.paragrafo(`${d.cidade || 'Belo Horizonte'}, ${dataExtenso(d.data)}`, { alinhar:'left', cru:true, depois:9 });
    w.rico(textoParticipacao(d), { depois:3.4 });
    if (ev.descricao) w.rico([{ t:'Descrição da participação: ', i:true }, { t:String(ev.descricao).trim() }], { depois:3.4 });
    w.paragrafo(d.texto_instituicao || INSTITUICAO, { cru:true, depois:3.4 });
    w.paragrafo(`Registro de evento ${ev.codigo || ''}, aprovado no SOMA.`, { cru:true, tamanho:9, cor:CINZA, alinhar:'left' });
    rodapeAutenticado(doc, e);
    doc.__nome = `${e.documento} DECLARAÇÃO DE PARTICIPAÇÃO - ${nomeArq(d.nome || '')}.pdf`;
    return doc;
  }

  /* ============================================================
     O REGISTRO ESCRITO NO PORTAL
     A definição (doc_series.formulario) diz os campos e, quando quer,
     como imprimi-los: a ficha, as seções, a prosa com os campos no meio
     ({data}, {hora?, às }). Sem "impressao", cada campo curto vai para a
     ficha do alto e cada campo longo vira uma seção com o rótulo.
     m = {codigo, rev, emissor, titulo, classe, natureza, autor, em}
     ============================================================ */
  const CURTOS = ['texto','data','hora','numero','escolha','membro','projeto'];
  /* o valor de um campo, como a frase o escreve */
  function valorTexto(c, v){
    if (v == null || v === '') return '';
    switch (c?.tipo){
      case 'data':    return dataExtenso(v);
      case 'hora':    return horaExtenso(v);
      case 'membro':  return v.nome || '';
      case 'projeto': return v.nome ? (v.codigo ? `${v.nome} (${v.codigo})` : v.nome) : (v.codigo || '');
      case 'redacao': return v.ia ? `pelo ${String(v.ia).trim()}, aos cuidados de ${v.nome || ''}` : `por ${v.nome || ''}`;
      case 'escolha': { const o = (c.opcoes || []).find(x => typeof x === 'object' && x.valor === v); return o ? o.rotulo : String(v); }
      case 'pessoas': return (v || []).map(p => p.nome + (p.nota ? ` (${p.nota})` : '')).join(', ');
      case 'lista':   return (v || []).join('; ');
      default:        return String(v);
    }
  }
  /* "{data}{hora?, às }{hora}": {campo} é o valor; {campo?texto} escreve
     o texto só se o campo tiver valor */
  function preencher(modelo, def, dados, curto){
    const campo = id => (def.campos || []).find(c => c.id === id);
    return String(modelo || '').replace(/\{([a-z][a-z0-9_]*)(\?([^}]*))?\}/g, (x, id, q, lit) => {
      const v = dados[id], c = campo(id);
      const vazio = v == null || v === '' || (Array.isArray(v) && !v.length);
      if (q !== undefined) return vazio ? '' : lit;
      if (curto && c?.tipo === 'data') return dataCurta(v);
      if (curto && c?.tipo === 'hora') return String(v || '').slice(0, 5);
      return valorTexto(c, v);
    });
  }
  /* A impressão padrão, quando a definição não traz a dela. */
  function impressaoPadrao(def){
    const curtos = (def.campos || []).filter(c => CURTOS.includes(c.tipo));
    const out = [];
    if (curtos.length){
      const linhas = [];
      for (let i = 0; i < curtos.length; i += 2)
        linhas.push(curtos.slice(i, i + 2).map(c => ({ rotulo:c.rotulo, valor:'{' + c.id + '}' })));
      out.push({ tipo:'ficha', linhas, curta:true });
    }
    (def.campos || []).filter(c => !CURTOS.includes(c.tipo)).forEach(c =>
      out.push({ tipo:'secao', titulo:c.rotulo, instrucao:c.instrucao, campos:[c.id], moldura: c.tipo === 'paragrafo' }));
    return out;
  }

  function registro(def, dados, m){
    dados = dados || {};
    const doc = novo();
    const cab = { departamento: def.cabecalho ? (preencher(def.cabecalho, def, dados) || m.emissor) : m.emissor,
                  titulo: def.titulo || tituloFrase(m.titulo), codigo:m.codigo, rev:m.rev };
    const w = escritor(doc, cab, { numerar: !!def.numerar_linhas, rodape: 28 });
    doc.setProperties({ title:`${m.codigo} ${cab.titulo}`, author:'NeuroDynamics PD&I', creator:'SOMA · NeuroDynamics' });
    const campo = id => (def.campos || []).find(c => c.id === id);

    const imprimeCampo = (c, b = {}) => {
      const v = dados[c.id];
      const vazio = v == null || v === '' || (Array.isArray(v) && !v.length);
      if (c.tipo === 'paragrafo'){
        if (b.moldura) return w.moldura(v || '', { minimo:3 });
        if (vazio) return w.nota('—');
        return String(v).split(/\n\s*\n/).forEach(p => w.paragrafo(p.trim(), { cru:true, depois:2.6 }));
      }
      if (c.tipo === 'lista'){
        if (vazio) return w.nota('—');
        return w.lista(v, { marcador:b.marcador || c.marcador || '•', pontuacao:b.pontuacao, final:b.final, cru:true });
      }
      if (c.tipo === 'pessoas'){
        if (b.colunas) return w.tabela([{ rotulo:b.colunas[0], largura:2.2 }, { rotulo:b.colunas[1] || c.nota || '', largura:1.3 }],
          vazio ? [['', ''], ['', '']] : v.map(p => [p.nome || '', p.nota || '']), { alturaMin:6 });
        if (vazio) return w.nota('—');
        return w.lista(v.map(p => p.nome + (p.nota ? ` (${p.nota})` : '')),
          { marcador:b.marcador || '1.', pontuacao:b.pontuacao, final:b.final, cru:true });
      }
      if (c.tipo === 'tabela'){
        const cols = c.colunas || [];
        const colunas = [...(c.numerada ? [{ rotulo:'#', largura:.35, alinhar:'center' }] : []),
          ...cols.map(k => ({ rotulo:k.rotulo, largura:k.largura || 1, alinhar: k.tipo === 'escolha' && (k.opcoes || []).some(o => o.simbolo) ? 'center' : undefined }))];
        const linhas = (Array.isArray(v) && v.length ? v : [{}]).map((ln, i) => [
          ...(c.numerada ? [String(i + 1)] : []),
          ...cols.map(k => {
            const x = ln[k.id];
            if (k.tipo === 'escolha'){ const o = (k.opcoes || []).find(o => (typeof o === 'object' ? o.valor : o) === x);
              if (o && typeof o === 'object' && o.simbolo) return { simbolo:o.simbolo, rotulo:o.rotulo };
              return o ? (typeof o === 'object' ? o.rotulo : o) : (x || ''); }
            return x || '';
          })]);
        w.tabela(colunas, linhas, { alturaMin:8, depois:1.5 });
        if (b.legenda){
          const k = cols.find(k => k.id === b.legenda) || cols.find(k => (k.opcoes || []).some(o => o.simbolo));
          if (k){ w.legendaStatus(k); }
        }
        return w.espaco(3);
      }
      /* curtos soltos numa seção: rótulo e valor */
      return w.paragrafo(`**${c.rotulo}:** ${valorTexto(c, v) || '—'}`);
    };
    /* a legenda do status: os mesmos glifos da tabela */
    w.legendaStatus = k => {
      w.garante(6);
      let x = w.x0; const y = w.y + 2.8;
      cor(doc, CINZA); fonte(doc, 'italic', 8);
      escreve(doc, 'Legenda do status:', x, y); x += mede('Legenda do status:') + 3;
      (k.opcoes || []).filter(o => typeof o === 'object').forEach(o => {
        glifo(doc, o.simbolo, x + 1.3, y - 1.1, 2.6); x += 3.8;
        cor(doc, CINZA); fonte(doc, 'italic', 8); escreve(doc, o.rotulo, x, y); x += mede(limpa(o.rotulo)) + 5;
      });
      w.y += 5;
    };

    (def.impressao && def.impressao.length ? def.impressao : impressaoPadrao(def)).forEach(b => {
      if (b.tipo === 'texto'){
        const txt = preencher(b.texto, def, dados);
        return w.rico([{ t:txt, i: b.estilo === 'italico', b: b.estilo === 'negrito' }], { depois:2.4 });
      }
      if (b.tipo === 'campo'){ const c = campo(b.campo); if (c) imprimeCampo(c, b); return; }
      if (b.tipo === 'ficha'){
        return w.ficha((b.linhas || []).map(l => l.map(x => ({ rotulo:x.rotulo, valor:preencher(x.valor, def, dados, !!b.curta), estreito:!!x.estreito }))));
      }
      if (b.tipo === 'secao'){
        w.titulo(b.titulo || '');
        if (b.instrucao) w.instrucao(b.instrucao);
        const cs = (b.campos || []).map(campo).filter(Boolean);
        if (b.layout === 'chave-valor') return w.chaveValor(cs.map(c => [c.rotulo, valorTexto(c, dados[c.id])]), { alturaMin:10 });
        cs.forEach(c => imprimeCampo(c, b));
      }
    });

    rodape(doc, { nota: notaDaClasse(m.classe, m.emissor, m.natureza),
      texto: `${m.codigo}${m.rev ? ' Rev. ' + m.rev : ''} · escrito no SOMA${m.autor ? ' por ' + m.autor : ''}${m.em ? ' em ' + dataCurta(m.em) : ''}` });
    doc.__nome = `${m.codigo} ${String(tituloFrase(m.titulo || cab.titulo)).toUpperCase()}${m.natureza !== 'registro' && m.rev ? ' REV. ' + m.rev : ''}.pdf`;
    return doc;
  }

  /* ============================================================
     O REGISTRO DE CONTAS DIGITAIS — a fotografia do cofre, sem segredo
     nenhum: que conta existe, de qual acesso, quem usa, quem mantém,
     se tem 2FA e quando a senha foi trocada.
     ============================================================ */
  function registroContas(contas, m){
    const doc = novo();
    const cab = { departamento:m.emissor || 'Diretoria', titulo:'Registro de contas digitais', codigo:m.codigo || 'Cofre do SOMA', rev:m.rev };
    const w = escritor(doc, cab, { rodape:28 });
    doc.setProperties({ title:`${cab.codigo} ${cab.titulo}`, author:'NeuroDynamics PD&I', creator:'SOMA · NeuroDynamics' });
    w.titulo('Registro de contas digitais', { antes:0, tamanho:13 });
    w.paragrafo(`As contas guardadas no cofre do SOMA em ${dataExtenso(m.data)}. As senhas, os códigos de duas etapas e as notas `
      + 'secretas não saem do cofre e não constam deste registro.', { cru:true, tamanho:9, cor:CINZA, alinhar:'left', depois:4 });
    const sit = { em_dia:'Em dia', vence_logo:'Vence logo', vencida:'Vencida', exposta:'Trocar: exposta', sem_troca:'Sem prazo',
                  sem_senha:'Sem senha', desativada:'Desativada' };
    w.tabela([{ rotulo:'Acesso / conta', largura:2.2 }, { rotulo:'Usuário', largura:1.7 }, { rotulo:'2FA', largura:.45, alinhar:'center' },
              { rotulo:'Quem usa', largura:1.7 }, { rotulo:'Quem mantém', largura:1.4 }, { rotulo:'Trocada em', largura:.95 },
              { rotulo:'Situação', largura:1 }],
      contas.map(c => [c.item_nome + (c.rotulo ? ' — ' + c.rotulo : ''), c.usuario || '—', c.tem_totp ? { simbolo:'ok' } : '—',
        c.quem_usa || '—', (c.responsaveis_nomes || []).join(', ') || 'Gestão do cofre', c.trocada_em ? dataCurta(String(c.trocada_em).slice(0, 10)) : '—',
        sit[c.situacao] || c.situacao || '']), { tamanho:7.8 });
    rodape(doc, { nota: notaDaClasse('confidencial', m.emissor || 'Diretoria', 'documento'),
      texto: `${cab.codigo}${m.rev ? ' Rev. ' + m.rev : ''} · exportado do cofre do SOMA${m.autor ? ' por ' + m.autor : ''} em ${dataCurta(m.data)}` });
    doc.__nome = `${cab.codigo} REGISTRO DE CONTAS DIGITAIS ${dataCurta(m.data).split('/').reverse().join('-')}.pdf`;
    return doc;
  }

  /* ============================================================
     A FOLHA DE CHECK-IN — o QR Code fixo do LABBIO, para quando o
     quiosque não está ligado. O QR leva ao portal com o token da folha;
     quem lê entra com a própria conta, e a presença é registrada como a
     do quiosque. A folha é controlada: tem número, quem gerou e quando,
     e deixa de valer ao ser revogada no portal.
       f: { numero, token, rotulo, criada_em, criada_por, url }
     ============================================================ */
  function folhaCheckin(f){
    const doc = novo();
    const codigo = `CHK-${String(f.numero || 0).padStart(3, '0')}`;
    const cab = { departamento:'Departamento de Pessoal', titulo:'Folha de check-in do LABBIO', codigo };
    cabecalho(doc, cab);
    doc.setProperties({ title:`${codigo} Folha de check-in do LABBIO`, author:'NeuroDynamics PD&I', creator:'SOMA · NeuroDynamics' });
    /* o endereço do portal (com ou sem index.html) e o token da folha */
    const u = new URL(f.url || 'https://membro.neurodynamics.dev/');
    u.search = '?t=F-' + f.token; u.hash = '';
    const url = u.toString();
    const cx = PAG.w / 2;
    cor(doc, TINTA); fonte(doc, 'bold', 30);
    escreve(doc, 'Check-in no LABBIO', cx, 58, { align:'center' });
    fonte(doc, 'normal', 13); cor(doc, CINZA);
    escreve(doc, 'Leia o QR Code com a câmera do celular e entre com a sua conta.', cx, 68, { align:'center' });
    /* o QR, grande, com a margem branca que a leitura pede */
    const lado = 128, x = cx - lado / 2, y = 80;
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(.6);
    doc.roundedRect(x - 9, y - 9, lado + 18, lado + 18, 4, 4, 'S');
    qr(doc, url, x, y, lado);
    cor(doc, TINTA); fonte(doc, 'bold', 16);
    escreve(doc, `Folha ${codigo}`, cx, y + lado + 22, { align:'center' });
    fonte(doc, 'normal', 10.5); cor(doc, CINZA);
    const linha2 = [f.rotulo, `gerada em ${dataCurta(String(f.criada_em || '').slice(0, 10))}${f.criada_por ? ` por ${f.criada_por}` : ''}`].filter(Boolean).join(', ');
    escreve(doc, linha2, cx, y + lado + 29, { align:'center' });
    fonte(doc, 'normal', 9.5);
    escreve(doc, 'Vale como o QR do quiosque até ser revogada em Equipe > Presença. Não copie nem fotografe esta folha.', cx, y + lado + 36, { align:'center' });
    rodape(doc, { nota: notaDaClasse('controlado', 'Departamento de Pessoal', 'documento'),
      texto: `${codigo} · folha controlada do SOMA` });
    doc.__nome = `${codigo} FOLHA DE CHECK-IN DO LABBIO.pdf`;
    doc.__url = url;
    return doc;
  }

  /* ============================================================
     O APROVEITAMENTO DE AACC
     O que a Resolução nº 02/2019 da Congregação da Escola de Engenharia
     permite pedir pela participação na equipe. É o mesmo catálogo do
     template LaTeX (nro/aproveitamento.tex, no brand): mudou lá, muda
     aqui. A tela do portal e a validação leem daqui.
     ============================================================ */
  const AACC = {
    EQC: { nome:'Participação em equipe de competição estudantil', dispositivo:'art. 1º, II, c; art. 11',
           base:'semestre', creditos:3, regra:'3 créditos por semestre letivo (art. 11, III)' },
    EXT: { nome:'Projeto de extensão com vínculo formal', dispositivo:'art. 1º, I, c; arts. 3º e 8º',
           base:'semestre', creditos:3, semestres:'siex', regra:'3 créditos por semestre na ação registrada na PROEX (art. 8º, III)' },
    IC:  { nome:'Iniciação científica com vínculo formal', dispositivo:'art. 1º, I, a; arts. 3º e 8º',
           base:'semestre', creditos:3, semestres:'ic', regra:'3 créditos por semestre com vínculo formal na PRPq (art. 8º, III)' },
    VPC: { nome:'Vivência profissional complementar', dispositivo:'art. 1º, IV, a; art. 17',
           base:'horas', creditos:1, unidade:300, regra:'1 crédito a cada 300 horas (art. 17, I)' }
  };
  const CONCEITO = n => n >= 90 ? 'A' : n >= 80 ? 'B' : n >= 70 ? 'C' : n >= 60 ? 'D' : n >= 40 ? 'E' : 'F';
  const virgula = n => String(n == null ? '' : n).replace('.', ',');
  /* "2023/1, 2023/2 e 2024/1" */
  const lista = xs => xs.length < 2 ? (xs[0] || '') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
  /* o período na equipe, como a declaração o diz */
  function periodoEquipe(q, ate){
    if (!valida(q.inicio)) return '';
    if (q.situacao === 'egresso' && valida(q.fim)) return `de ${mesAno(q.inicio)} a ${mesAno(q.fim)}`;
    return `de ${mesAno(q.inicio)} até ${valida(ate) ? dataExtenso(ate) : 'a data desta folha'}`;
  }

  /* A declaração do professor orientador (art. 11, I e II; art. 3º,
     II), em trechos: a folha a imprime, e a validação a mostra. */
  function textoAproveitamento(d, documento){
    const est = d.estudante || {}, eq = d.equipe || {}, rel = d.relatorio || {}, pr = d.professor || {};
    const sem = (d.semestres || []).filter(s => s.situacao === 'conta');
    const nota = Number(pr.nota), conc = pr.conceito || CONCEITO(nota);
    const norma = d.norma || 'Resolução nº 02/2019 da Congregação da Escola de Engenharia da UFMG';
    return [{ t:'Declaro que ' }, { t:String(est.nome || '').toUpperCase(), b:true },
      { t:`${est.matricula ? ', matrícula ' + est.matricula : ''}${est.curso ? ', do curso de ' + est.curso : ''}, participou da NeuroDynamics PD&I, `
        + `equipe de competição estudantil da Escola de Engenharia da UFMG, ${periodoEquipe(eq, d.data)}`
        + `${sem.length ? `, com ${sem.length} ${sem.length === 1 ? 'semestre letivo' : 'semestres letivos'} de participação efetiva` : ''}, `
        + `e que examinei o relatório de atividades ${documento || ''}, versão ${rel.versao || 1}. Avaliei-o pelo barema abaixo, com a nota final ` },
      { t:`${virgula(nota)} de 100 (conceito ${conc})`, b:true },
      { t:`, e aprovo o seu aproveitamento como Atividade Acadêmica Curricular Complementar, nos termos da ${norma}.` }];
  }

  /* A FOLHA DE APROVAÇÃO. Uma página, que o portal põe no lugar da folha
     reservada do relatório (a segunda): o cabeçalho é o do relatório, o
     NRO-PUB-002, e o rodapé também, com a página que ela ocupa. Leva o
     selo solene, as aprovações da equipe (uma pessoa por etapa), a
     declaração e a nota do professor orientador (art. 3º, II; art. 11,
     I e II) e a legenda de autenticação, conferível em
     auth.neurodynamics.dev.
     e = a emissão (doc_emitido_json); o = { pagina, paginas }. */
  function folhaAprovacaoAacc(e, o = {}){
    /* uma página só: se o pedido tem muitas etapas ou muitas linhas, a
       folha se aperta (as entrelinhas, depois o corpo) até caber */
    let r;
    for (const k of [0, 1, 2]){ r = montarFolhaAacc(e, o, k); if (r.cabe) break; }
    return r.doc;
  }
  function montarFolhaAacc(e, o, k){
    const C = [{ lhV:4.05, gapV:1.15, ap:5.8, bar:4.5, sec:8.2, pad:2.5, corpo:9.2, dado:9 },
               { lhV:3.75, gapV:.6,  ap:4.9, bar:4.0, sec:7.4, pad:1.5, corpo:9,   dado:8.8 },
               { lhV:3.5,  gapV:.35, ap:4.4, bar:3.7, sec:6.8, pad:1,   corpo:8.4, dado:8.4 }][k];
    const d = e.dados || {}, est = d.estudante || {}, eq = d.equipe || {}, enq = d.enquadramento || {};
    const cr = d.creditos || {}, rel = d.relatorio || {}, pr = d.professor || {};
    const pagina = o.pagina || rel.folha || 2, paginas = o.paginas || rel.paginas || pagina;
    const CORTEX = [0, 53, 47], TEXTO2 = [74, 79, 77], CINZA_DS = [97, 108, 104], REGUA = [217, 222, 220];
    const x0 = PAG.esq, x1 = PAG.w - PAG.dir;
    const doc = novo();
    const titSerie = tituloFrase(d.serie_titulo || 'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC').replace(/\baacc\b/g, 'AACC');
    const cab = { departamento:e.emissor || 'Departamento de Pessoal', titulo:titSerie, codigo:e.documento, rev:e.revisao };
    /* o escritor só para os parágrafos: a folha é uma página, e a
       diagramação é daqui (sem quebra de página) */
    const w = escritor(doc, cab, { rodape:6 });
    doc.setProperties({ title:`${e.documento} Folha de aprovação, ${est.nome || ''}`, subject:`Código verificador ${e.codigo}`,
      author:'NeuroDynamics PD&I', creator:'SOMA, NeuroDynamics' });
    const serif = (estilo, tam) => { doc.setFont('times', estilo || 'normal'); doc.setFontSize(tam);
      FONTE = { estilo:estilo || 'normal', tam, familia:'times' }; };
    /* a Times do PDF não tem a tabela de larguras daqui: mede pelo jsPDF,
       que basta para texto curto alinhado */
    const escreveSerif = (txt, x, y, al) => { const t = limpa(txt); if (!t) return;
      const lw = doc.getTextWidth(t); doc.text(t, al === 'right' ? x - lw : al === 'center' ? x - lw / 2 : x, y);
      const pg = doc.internal.getCurrentPageInfo().pageNumber; (doc.__textos[pg - 1] = doc.__textos[pg - 1] || []).push(t); };
    const regua = (y, c, lw) => { doc.setDrawColor(c[0], c[1], c[2]); doc.setLineWidth(lw); doc.line(x0, y, x1, y); };
    const secao = (txt, y) => { regua(y, CORTEX, .18); cor(doc, CORTEX); fonte(doc, 'bold', 8.2); escreve(doc, txt, x0, y + 4.4); return y + C.sec; };

    /* o kicker do relatório formal: a régua, o rótulo e o código do pedido */
    let y = PAG.topo;
    regua(y, CORTEX, .18);
    cor(doc, CORTEX); fonte(doc, 'bold', 8.6); escreve(doc, 'Folha de aprovação', x0, y + 5.1);
    serif('italic', 12.5); escreveSerif(d.pedido || '', x1, y + 5.3, 'right');

    /* o selo solene, à direita do título */
    const lado = 31, sx = x1 - lado, sy = y + 9.5;
    if (SELO) doc.addImage(SELO, 'PNG', sx, sy, lado, lado, 'selo', 'SLOW');
    const largTit = (SELO ? sx - 6 : x1) - x0;
    cor(doc, TINTA); serif('normal', 21);
    escreveSerif('Aprovação do relatório de atividades', x0, y + 18.5);
    w.y = y + 22.5; w.x0 = x0;
    w.rico([{ t:`Relatório ${e.documento}, pedido ${d.pedido || ''} no SOMA, de ` }, { t:String(est.nome || ''), b:true },
      { t:`, para o aproveitamento como Atividade Acadêmica Curricular Complementar (AACC), nos termos da ${d.norma || 'Resolução nº 02/2019 da Congregação da Escola de Engenharia da UFMG'}. `
        + 'Esta folha ocupa o lugar da folha reservada ao SOMA e vale para a versão do relatório identificada abaixo.' }],
      { tamanho:9.4, largura:largTit, alinhar:'left', cor:TEXTO2, depois:0 });
    y = Math.max(w.y, sy + lado) + 4;

    /* 1. o estudante e o pedido: rótulo à esquerda, valor à direita */
    y = secao('O estudante e o pedido', y);
    const sem = (d.semestres || []).filter(s => s.situacao === 'conta').map(s => s.rotulo);
    const alt = (enq.alternativas || []).map(k => AACC[k] ? `${AACC[k].nome} (${AACC[k].dispositivo})` : k);
    const pri = AACC[enq.principal] ? `${AACC[enq.principal].nome} (${AACC[enq.principal].dispositivo})` : (enq.principal || '');
    const nCred = Number(cr.total), nPri = Number(cr.principal_creditos), nIt = Number(cr.itens);
    const linhas = [
      ['Estudante', `${String(est.nome || '').toUpperCase()}${est.matricula ? ', matrícula ' + est.matricula : ''}`],
      ['Curso', [est.curso, est.ingresso ? 'ingresso em ' + est.ingresso : ''].filter(Boolean).join(', ')],
      ...(est.colegiado || enq.colegiado ? [['Colegiado', est.colegiado || enq.colegiado]] : []),
      ['Na equipe', `${periodoEquipe(eq, d.data)} (${eq.situacao === 'egresso' ? 'egresso' : 'membro ativo'})${eq.cargo ? ', como ' + eq.cargo : ''}`],
      ['Enquadramento', pri],
      ...(alt.length ? [[alt.length === 1 ? 'Alternativa' : 'Alternativas', alt.join('; ')]] : []),
      ...(enq.siex && enq.siex.length ? [['Registro no SIEX', lista(enq.siex)]] : []),
      ...(enq.ic && enq.ic.length ? [['Vínculo de IC', lista(enq.ic)]] : []),
      ['Semestres letivos', sem.length ? `${lista(sem)} (${sem.length}, com ao menos quatro meses de participação cada)` : 'nenhum'],
      ...(Number.isFinite(nCred) ? [['Créditos declarados', `${nCred} ${nCred === 1 ? 'crédito' : 'créditos'}`
        + (Number.isFinite(nPri) && Number.isFinite(nIt) && nIt > 0 ? `: ${nPri} pelo enquadramento e ${nIt} em atividades que contam à parte` : '')
        + ', conforme o relatório']] : []),
      ['Relatório', `versão ${rel.versao || 1}, ${rel.paginas || paginas} páginas, enviada em ${dataCurta(String(rel.enviado_em || '').slice(0, 10))}`
        + (rel.sha256 ? `; SHA-256 ${String(rel.sha256).slice(0, 16)}` : '')]
    ];
    const wr = 34, tamV = C.dado, lhV = C.lhV;
    linhas.forEach(([r, v]) => {
      fonte(doc, 'normal', tamV); const ls = quebra(limpa(v || ''), x1 - x0 - wr);
      cor(doc, CINZA_DS); fonte(doc, 'normal', 7.8); escreve(doc, r, x0, y + 3.3);
      cor(doc, TINTA); fonte(doc, 'normal', tamV);
      ls.forEach((l, k) => escreve(doc, l, x0 + wr, y + 3.3 + k * lhV));
      y += Math.max(1, ls.length) * lhV + C.gapV;
    });
    y += C.pad;

    /* 2. as aprovações da equipe */
    y = secao('As aprovações da equipe', y);
    const cols = [x0, x0 + 56, x0 + 128];
    cor(doc, CINZA_DS); fonte(doc, 'normal', 7.8);
    escreve(doc, 'Etapa', cols[0], y + 3); escreve(doc, 'Aprovado por', cols[1], y + 3); escreve(doc, 'Em', cols[2], y + 3);
    y += 4.6;
    (d.aprovacoes || []).forEach(a => {
      regua(y, REGUA, .2);
      cor(doc, TINTA); fonte(doc, 'normal', 9);
      escreve(doc, `${a.etapa}. ${a.rotulo || ''}`, cols[0], y + C.ap * .69); escreve(doc, a.nome || '', cols[1], y + C.ap * .69);
      cor(doc, TEXTO2); escreve(doc, momento(a.em), cols[2], y + C.ap * .69);
      y += C.ap;
    });
    regua(y, REGUA, .2);
    y += C.pad + 2.5;

    /* 3. o professor orientador: a declaração (art. 11, I e II), a nota
       (art. 3º, II) e o barema */
    y = secao('O professor orientador', y);
    const nota = Number(pr.nota), conc = pr.conceito || CONCEITO(nota);
    const quem = String(pr.titulo || '').trim() + ' ' + String(pr.nome || '').trim();
    const fem = /^profa/i.test(String(pr.titulo || ''));
    w.y = y; w.x0 = x0;
    w.rico(textoAproveitamento(d, e.documento),
      { tamanho:C.corpo, largura:x1 - x0, depois:1.5 });
    y = w.y;

    /* o bloco de baixo, de altura conhecida: o barema à esquerda e a
       aprovação à direita; o parecer cabe no que sobra */
    const bar = Array.isArray(pr.barema) ? pr.barema : [];
    const hBloco = Math.max(31, 4.6 + bar.length * C.bar + 6.5);
    const topoAut = PAG.h - 25 - 24.5;
    if (pr.parecer){
      const sobra = topoAut - 4 - hBloco - y - 2;
      fonte(doc, 'italic', 8.4);
      let ls = quebra(limpa('Parecer: ' + pr.parecer), x1 - x0);
      const nl = Math.max(0, Math.floor(sobra / 3.6));
      if (ls.length > nl){
        ls = ls.slice(0, nl);
        const fim = '… (o parecer completo consta da validação)';
        if (ls.length){ let u = ls[ls.length - 1];
          do { u = u.replace(/\s*\S*$/, ''); } while (u && mede(u + fim) > x1 - x0);
          ls[ls.length - 1] = u + fim; }
      }
      cor(doc, TEXTO2);
      ls.forEach((l, k) => escreve(doc, l, x0, y + 3 + k * 3.6));
      y += ls.length * 3.6 + (ls.length ? 2 : 0);
    }
    const cabe = y + 1 <= topoAut - 4 - hBloco;
    y = Math.max(y + 1, topoAut - 4 - hBloco);
    const bx = [x0, x0 + 62, x0 + 76, x0 + 93], bw = 108;
    cor(doc, CINZA_DS); fonte(doc, 'normal', 7.6);
    escreve(doc, 'Critério do barema', bx[0], y + 3); escreve(doc, 'Peso', bx[1] + 8, y + 3, { align:'right' });
    escreve(doc, 'Nota (0 a 10)', bx[2] + 13, y + 3, { align:'right' }); escreve(doc, 'Pontos', bx[0] + bw, y + 3, { align:'right' });
    let yb = y + 4.6;
    bar.forEach(b => {
      doc.setDrawColor(REGUA[0], REGUA[1], REGUA[2]); doc.setLineWidth(.2); doc.line(x0, yb, x0 + bw, yb);
      cor(doc, TINTA); fonte(doc, 'normal', 8.4);
      escreve(doc, b.nome || b.chave, bx[0], yb + C.bar * .73);
      escreve(doc, String(b.peso), bx[1] + 8, yb + C.bar * .73, { align:'right' });
      escreve(doc, virgula(b.nota), bx[2] + 13, yb + C.bar * .73, { align:'right' });
      escreve(doc, virgula(b.pontos), bx[0] + bw, yb + C.bar * .73, { align:'right' });
      yb += C.bar;
    });
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(.3); doc.line(x0, yb, x0 + bw, yb);
    cor(doc, TINTA); fonte(doc, 'bold', 8.6);
    escreve(doc, 'Nota final', bx[0], yb + 4); escreve(doc, '100', bx[1] + 8, yb + 4, { align:'right' });
    escreve(doc, virgula(nota), bx[0] + bw, yb + 4, { align:'right' });
    /* a aprovação: a nota em destaque e quem aprovou */
    const ax = x0 + bw + 10;
    cor(doc, CORTEX); serif('normal', 30); escreveSerif(virgula(nota), ax, y + 11);
    const wn = doc.getTextWidth(limpa(virgula(nota)));
    cor(doc, TEXTO2); fonte(doc, 'normal', 8.6); escreve(doc, `de 100, conceito ${conc}`, ax + wn + 2, y + 11);
    doc.setDrawColor(TINTA[0], TINTA[1], TINTA[2]); doc.setLineWidth(.2); doc.line(ax, y + 16, x1, y + 16);
    cor(doc, TINTA); serif('normal', 13); escreveSerif(quem, ax, y + 21.5);
    cor(doc, TEXTO2); fonte(doc, 'normal', 8.2);
    escreve(doc, `${fem ? 'Professora orientadora' : 'Professor orientador'}${pr.email ? ', ' + pr.email : ''}`, ax, y + 25.6);
    escreve(doc, `Aprovou no SOMA em ${momento(pr.em)}`, ax, y + 29.4);

    /* a legenda de autenticação, sem assinatura */
    const url = (e.url_validacao || URL_VALIDACAO).replace(/\/+$/, ''), host = url.replace(/^https?:\/\//, '');
    const link = `${url}/?c=${e.codigo}`, ladoQ = 19.5, ha = 24.5, ta = topoAut;
    doc.setFillColor(227, 239, 236); doc.rect(x0, ta, x1 - x0, ha, 'F');
    doc.setDrawColor(CORTEX[0], CORTEX[1], CORTEX[2]); doc.setLineWidth(.18); doc.line(x0, ta, x1, ta);
    doc.setFillColor(255, 255, 255); doc.rect(x0 + 2.2, ta + 2.5, ladoQ + 1.2, ladoQ + 1.2, 'F');
    qr(doc, link, x0 + 2.8, ta + 3.1, ladoQ);
    const tx = x0 + ladoQ + 7.5, tw = x1 - tx - 3;
    cor(doc, CORTEX); fonte(doc, 'bold', 8); escreve(doc, 'Autenticação', tx, ta + 5);
    cor(doc, TEXTO2); fonte(doc, 'normal', 7.4);
    const corpo = `Folha emitida pelo SOMA, o sistema de gestão da NeuroDynamics PD&I, em ${momento(e.emitido_em)} (horário de Brasília), `
      + `com as aprovações registradas no sistema nessa data. Dispensa assinatura. Confira em ${host} com o código verificador `
      + `e o código de controle abaixo, ou pela leitura do QR Code ao lado. Vale para o relatório ${e.documento}, versão ${rel.versao || 1}.`;
    quebra(limpa(corpo), tw).forEach((l, k) => escreve(doc, l, tx, ta + 9 + k * 3.05));
    cor(doc, TINTA); fonte(doc, 'normal', 7.6); escreve(doc, 'Código verificador', tx, ta + ha - 3);
    fonte(doc, 'bold', 9); escreve(doc, e.codigo, tx + 25, ta + ha - 3);
    fonte(doc, 'normal', 7.6); escreve(doc, 'Controle', tx + 62, ta + ha - 3);
    fonte(doc, 'bold', 9); escreve(doc, e.controle || '', tx + 74, ta + ha - 3);
    if (e.situacao === 'revogado'){
      cor(doc, [110, 10, 26]); fonte(doc, 'bold', 8); escreve(doc, 'Revogada', x1 - 3, ta + 5, { align:'right' });
    }
    doc.__link = { url:link, x:x0, y:ta, w:x1 - x0, h:ha };

    /* o rodapé do relatório: a nota, a régua, o código e a página */
    cor(doc, CINZA); fonte(doc, 'italic', 7.2);
    const nota2 = quebra(limpa('Registro destinado à análise do aproveitamento de AACC pelo Colegiado do curso. Contém dados pessoais do '
      + 'estudante e informações da NeuroDynamics PD&I; não deve ser divulgado para outros fins.'), 172);
    nota2.forEach((l, k) => escreve(doc, l, PAG.w / 2, PAG.h - 13.6 - (nota2.length - 1 - k) * 2.9, { align:'center' }));
    doc.setDrawColor(LINHA[0], LINHA[1], LINHA[2]); doc.setLineWidth(.2); doc.line(x0, PAG.h - 10.4, x1, PAG.h - 10.4);
    cor(doc, CLARO); fonte(doc, 'normal', 7.2);
    escreve(doc, `${e.documento}${e.revisao ? ' Rev. ' + e.revisao : ''}, ${est.nome || ''}`, x0, PAG.h - 7);
    escreve(doc, `Página ${pagina} de ${paginas}`, x1, PAG.h - 7, { align:'right' });

    doc.__nome = `${e.documento} FOLHA DE APROVAÇÃO - ${nomeArq(est.nome || '')}.pdf`;
    return { doc, cabe };
  }

  /* baixar: o nome segue o NRO-PUB-002 ("NRO-XXX-000 TÍTULO REV. B") */
  function baixar(doc, nome){
    const n = nome || doc.__nome || 'documento.pdf';
    window.__docnro = { nome:n, paginas:doc.getNumberOfPages(), textos:doc.__textos.map(p => p.join(' ')), url:doc.__url || null };
    doc.save(n);
    return n;
  }
  function blob(doc){ return doc.output('blob'); }
  /* abrir numa aba: a prévia do registro escrito no portal. A janela vem
     aberta de quem chama — aberta no clique, antes de o PDF ficar pronto,
     o bloqueador de janelas não a barra; sem ela, o PDF desce. */
  function abrir(doc, janela){
    const n = doc.__nome || 'documento.pdf';
    window.__docnro = { nome:n, paginas:doc.getNumberOfPages(), textos:doc.__textos.map(p => p.join(' ')), previa:true };
    const url = URL.createObjectURL(doc.output('blob'));
    if (janela && !janela.closed) janela.location.href = url;
    else doc.save(n);
    setTimeout(() => URL.revokeObjectURL(url), 120000);
    return n;
  }

  window.DocNRO = {
    versao: '1', URL_VALIDACAO, precisa, novo, escritor, cabecalho, rodape, rodapeAutenticado, qr,
    declaracaoVinculo, declaracaoParticipacao, registro, registroContas, folhaCheckin, folhaAprovacaoAacc, textoAproveitamento, AACC,
    baixar, blob, abrir,
    textoVinculo, textoParticipacao, preencher, valorTexto, impressaoPadrao, notaDaClasse,
    limpa, dataExtenso, dataCurta, mesAno, horaExtenso, horasExtenso, periodo, momento, tituloFrase
  };
})();
