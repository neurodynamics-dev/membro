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
     - o registro de contas digitais, exportado do cofre.
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
  /* Tudo o que um documento precisa, na primeira vez. */
  async function precisa(){
    if (!window.jspdf) await carregar(CDN_JSPDF);
    if (typeof window.qrcode !== 'function') await carregar(CDN_QR);
    await carregarLogo();
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

  /* baixar: o nome segue o NRO-PUB-002 ("NRO-XXX-000 TÍTULO REV. B") */
  function baixar(doc, nome){
    const n = nome || doc.__nome || 'documento.pdf';
    window.__docnro = { nome:n, paginas:doc.getNumberOfPages(), textos:doc.__textos.map(p => p.join(' ')) };
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
    declaracaoVinculo, declaracaoParticipacao, registro, registroContas, baixar, blob, abrir,
    textoVinculo, textoParticipacao, preencher, valorTexto, impressaoPadrao, notaDaClasse,
    limpa, dataExtenso, dataCurta, mesAno, horaExtenso, horasExtenso, periodo, momento, tituloFrase
  };
})();
