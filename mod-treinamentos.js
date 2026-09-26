/* ============================================================
   MÓDULO · TREINAMENTOS — a formação da equipe
   Um treinamento tem código e revisão, como todo documento da NRO
   (NRO-TRE-003 Rev. B), e é feito de MÓDULOS: o corpo em Markdown —
   texto, vídeos do YouTube no mesmo player do site institucional,
   links para os arquivos e as telas do portal — e, quando o módulo
   pede, uma VERIFICAÇÃO DE CONHECIMENTO (uma correta, várias
   corretas, V ou F). É atribuído a grupos, obrigatório ou opcional;
   concluir registra no perfil e dá um certificado em PDF.

   O texto de um treinamento vai e volta como UM arquivo Markdown —
   o formato que o README de conteúdo descreve e que os agentes de
   IA escrevem. treLerTexto() lê esse arquivo e treEscreverTexto() o
   escreve de volta, e o README padrão mora aqui, ao lado dos dois:
   quem mudar o formato muda o README no mesmo lugar.

   O gabarito não desce para quem faz o treinamento: o conteúdo
   chega por treinamento_conteudo(), sem as respostas, e quem
   corrige é o banco (treinamento_responder).

   Rotas:
     #/treinamentos                          para você: o que os seus grupos pedem
     #/treinamentos/todos                    todos os publicados
     #/treinamentos/certificados             os seus certificados
     #/treinamentos/NRO-TRE-003              um treinamento: o programa e onde você está
     #/treinamentos/NRO-TRE-003/2            o módulo 2, com a verificação
     #/treinamentos/NRO-TRE-003/editar       o rascunho (quem gere)
     #/treinamentos/NRO-TRE-003/acompanhamento  quem fez e quem deve (quem gere)
     #/treinamentos/config                   todos, com rascunhos e arquivados (quem gere)
     #/treinamentos/config/geral|readme      gestores, nota, certificado, README
     #/treinamentos/novo                     criar — ou começar de um texto
     #/treinamentos/gestao                   endereço antigo: abre #/treinamentos/config
     #/treinamentos/certificado/CERT-XXXX-XXXX  conferir um certificado

   Precisa da migração db/v24_treinamentos.sql.

   A busca dos treinamentos mora na casca (ela lê a lista no login,
   para o início); este módulo a mantém em dia em state.treMeus.

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, ibtn, confirma, falha, motivoRPC,
   MOTIVO_RPC, copiar, carregarLib, can, grupoPorId, gereTreinamentos,
   carregarTreinamentoConfig, IC_DOC.
   ============================================================ */

const treino = { lista:null, erro:null, cat:'', q:'', atual:null, vf:{}, ed:null, acomp:null,
  acompFiltro:'', gestao:null, cfg:null, ytApi:null, players:{}, nVideo:0 };

const TRE_SITUACAO = {
  pendente:     { l:'Não começado', dt:'dt-gray', p:'' },
  andamento:    { l:'Em andamento', dt:'dt-info', p:'p-info' },
  concluido:    { l:'Concluído',    dt:'dt-ok',   p:'p-ok' },
  nova_revisao: { l:'Nova revisão', dt:'dt-warn', p:'p-warn' },
  vencido:      { l:'Vencido',      dt:'dt-bad',  p:'p-bad' }
};
const TRE_TIPOS = {
  unica:    { l:'Uma correta',     dica:'Escolha uma alternativa.' },
  multipla: { l:'Várias corretas', dica:'Marque todas as corretas.' },
  vf:       { l:'V ou F',          dica:'Diga se cada afirmação é verdadeira ou falsa.' }
};
const TRE_CATEGORIAS = ['Integração', 'Sistemas', 'Laboratório', 'Segurança', 'Projetos', 'Gestão', 'Comunicação'];
const TRE_CDN_PDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';

const treEu = () => state.perfil?.registro;
const trePill = s => { const x = TRE_SITUACAO[s] || { l:s || '—', dt:'dt-gray', p:'' };
  return `<span class="pill ${x.p}"><span class="dt ${x.dt}"></span>${esc(x.l)}</span>`; };
const treObrig = o => o === true ? '<span class="tag-mini tre-obr">Obrigatório</span>'
  : o === false ? '<span class="tag-mini">Opcional</span>' : '';
function treDuracao(min){
  const m = +min; if (!m) return '';
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
}
const treRev = r => r ? `Rev. ${r}` : 'sem revisão publicada';
const treId = p => p + Math.random().toString(36).slice(2, 8);
function treDataLonga(iso){
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('pt-BR', { day:'numeric', month:'long', year:'numeric' });
}
function treBaixarTexto(nome, texto, tipo){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type: tipo || 'text/markdown;charset=utf-8' }));
  a.download = nome; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const treSlug = t => norm(t).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

/* ============================================================
   MARKDOWN
   Um leitor pequeno e seguro por construção: tudo é escapado, e só
   o que está aqui vira marcação. É o conjunto que o README diz para
   usar — o que ele não diz, esta função não desenha.
     ## e ### títulos · parágrafos · **negrito** · *itálico* ·
     `código` · listas (com - ou 1.), aninhadas · > citação (e as
     caixas "Dica:", "Atenção:", "Importante:", "Nota:") · tabelas ·
     --- · ```video (o player) · links: https, arquivo:NRO-XXX-YYY,
     treinamento:NRO-TRE-XXX e as telas do portal (#/agenda)
   ============================================================ */
const TRE_RX_ITEM = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const TRE_RX_SEP  = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const treIndent = l => (l.match(/^\s*/)[0].replace(/\t/g, '    ')).length;

function treYoutubeId(u){
  const t = String(u || '').trim();
  if (/^[\w-]{11}$/.test(t)) return t;
  const m = t.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be)\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)?([\w-]{11})(?:[?&#].*)?$/i);
  return m ? m[1] : null;
}

/* Para onde um link aponta. arquivo:NRO-PES-015 é o arquivo em
   Arquivos, treinamento:NRO-TRE-002 é outro treinamento, #/agenda é
   uma tela do portal; o resto só se for http(s) ou mailto. Um código
   solto (NRO-PES-015) também vale — é o que a pessoa escreveria. */
function treHref(url){
  const u = String(url || '').trim();
  let m;
  if ((m = u.match(/^(?:treinamento:\s*)?(NRO-TRE-\d{3,})$/i)))
    return { href:'#/treinamentos/' + m[1].toUpperCase(), tipo:'treinamento', codigo:m[1].toUpperCase() };
  if ((m = u.match(/^(?:arquivo:\s*)?(NRO-[A-Z]{3}-\d{3}(?:-\d+)?)$/i)))
    return { href:'#/arquivos/' + m[1].toUpperCase(), tipo:'arquivo', codigo:m[1].toUpperCase() };
  if (/^#\/[\w\-/.%]*$/.test(u)) return { href:u, tipo:'portal' };
  if (/^https?:\/\/[^\s<>"]+$/i.test(u)) return { href:u, tipo:'externo' };
  if (/^mailto:[^\s<>"]+$/i.test(u)) return { href:u, tipo:'externo' };
  return null;
}
const treEnfase = t => t
  .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
  .replace(/__(?=\S)([\s\S]*?\S)__/g, '<strong>$1</strong>')
  .replace(/(^|[^*\w])\*(?=[^\s*])([^*]*?[^\s*])\*(?!\*)/g, '$1<em>$2</em>')
  .replace(/(^|[^_\w])_(?=[^\s_])([^_]*?[^\s_])_(?![\w_])/g, '$1<em>$2</em>')
  .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');
function treLinkHTML(texto, url){
  const h = treHref(url);
  if (!h) return `<span class="tre-link-ruim" title="Link não reconhecido: ${esc(url)}">${treEnfase(esc(texto))}</span>`;
  const ext = h.tipo === 'externo' ? ' target="_blank" rel="noopener"' : '';
  return `<a class="tre-a" href="${esc(h.href)}"${ext}${h.codigo ? ` title="${esc(h.codigo)}"` : ''}>${treEnfase(esc(texto))}</a>`;
}
function treInline(s){
  const ph = [];
  const guarda = html => { ph.push(html); return `\u0000${ph.length - 1}\u0000`; };
  let t = String(s || '');
  t = t.replace(/``\s?(.+?)\s?``|`([^`]+)`/g, (_, d, c) => guarda(`<code>${esc(d ?? c)}</code>`));
  t = t.replace(/!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, alt, url) => guarda(
    /^https:\/\/[^\s<>"]+$/i.test(url) && !treYoutubeId(url)
      ? `<img class="tre-img" src="${esc(url)}" alt="${esc(alt)}" loading="lazy">`
      : treLinkHTML(alt || url, url)));
  t = t.replace(/\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g, (_, txt, url) => guarda(treLinkHTML(txt, url)));
  t = t.replace(/<(https?:\/\/[^>\s]+)>/g, (_, u) => guarda(treLinkHTML(u, u)));
  t = t.replace(/(^|[\s(])(https?:\/\/[^\s<)]*[^\s<).,;:!?'"])/g, (_, pre, u) => pre + guarda(treLinkHTML(u, u)));
  t = treEnfase(esc(t));
  return t.replace(/\u0000(\d+)\u0000/g, (_, n) => ph[+n]);
}

/* O começo de um bloco: o que interrompe um parágrafo. */
function treInicioDeBloco(l){
  return /^\s*(```|~~~)/.test(l) || /^\s{0,3}#{1,6}\s/.test(l) || /^\s{0,3}>/.test(l)
    || TRE_RX_ITEM.test(l) || /^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l);
}
const TRE_CAIXAS = { dica:'Dica', atencao:'Atenção', importante:'Importante', nota:'Nota', exemplo:'Exemplo' };
function treMd(src, ctx){
  ctx = ctx || { videos:0 };
  const L = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  while (i < L.length){
    const l = L[i];
    if (!l.trim()){ i++; continue; }
    let m;
    /* bloco cercado: ```video é o player; o resto, código */
    if ((m = l.match(/^\s*(```+|~~~+)\s*([\w-]*)\s*$/))){
      /* fecha com a mesma cerca, de tamanho igual ou maior: ```` guarda ``` dentro */
      const cerca = m[1], info = m[2].toLowerCase(), corpo = [];
      const fecha = x => { const f = x.trim().match(/^(`{3,}|~{3,})\s*$/); return f && f[1][0] === cerca[0] && f[1].length >= cerca.length; };
      i++;
      while (i < L.length && !fecha(L[i])){ corpo.push(L[i]); i++; }
      i++;
      out.push(info === 'video' || info === 'youtube' ? treBlocoVideo(corpo, ctx)
        : `<pre class="tre-code"><code>${esc(corpo.join('\n'))}</code></pre>`);
      continue;
    }
    if ((m = l.match(/^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/))){
      const n = Math.min(4, Math.max(2, m[1].length));
      out.push(`<h${n}>${treInline(m[2])}</h${n}>`); i++; continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)){ out.push('<hr>'); i++; continue; }
    if (/^\s{0,3}>/.test(l)){
      const q = [];
      while (i < L.length && /^\s{0,3}>/.test(L[i])){ q.push(L[i].replace(/^\s{0,3}>\s?/, '')); i++; }
      let txt = q.join('\n'), cls = '';
      const cx = txt.match(/^\s*(?:\*\*|__)?\s*(dica|aten[çc][ãa]o|importante|nota|exemplo)\s*:?\s*(?:\*\*|__)?\s*:?\s*/i);
      if (cx){ cls = norm(cx[1]).replace(/[^a-z]/g, ''); txt = txt.slice(cx[0].length); }
      out.push(cls
        ? `<aside class="tre-caixa ${cls}"><span class="tre-caixa-t">${TRE_CAIXAS[cls]}</span>${treMd(txt, ctx)}</aside>`
        : `<blockquote>${treMd(txt, ctx)}</blockquote>`);
      continue;
    }
    if (l.includes('|') && L[i + 1] != null && TRE_RX_SEP.test(L[i + 1])){
      const celulas = r => r.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const cab = celulas(l), alin = celulas(L[i + 1]).map(c => /^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : '');
      i += 2;
      const linhas = [];
      while (i < L.length && L[i].includes('|') && L[i].trim()){ linhas.push(celulas(L[i])); i++; }
      const td = (tag, c, k) => `<${tag}${alin[k] ? ` style="text-align:${alin[k]}"` : ''}>${treInline(c)}</${tag}>`;
      out.push(`<div class="tre-tabela"><table><thead><tr>${cab.map((c, k) => td('th', c, k)).join('')}</tr></thead>
        <tbody>${linhas.map(r => `<tr>${cab.map((_, k) => td('td', r[k] || '', k)).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (TRE_RX_ITEM.test(l)){ const r = treLista(L, i, ctx); out.push(r.html); i = r.fim; continue; }
    /* um link do YouTube sozinho na linha também vira o player */
    const soYt = l.trim().match(/^(?:!\[([^\]]*)\]\(\s*(\S+?)\s*\)|<?(\S+?)>?)$/);
    if (soYt && treYoutubeId(soYt[2] || soYt[3]) && /^https?:/i.test(soYt[2] || soYt[3])){
      out.push(treBlocoVideo([soYt[2] || soYt[3], soYt[1] || ''], ctx)); i++; continue;
    }
    const p = [];
    while (i < L.length && L[i].trim() && (!p.length || !treInicioDeBloco(L[i]))){ p.push(L[i]); i++; }
    out.push(`<p>${p.map((x, k) => treInline(x.trim()) + (k < p.length - 1 && /(\s{2,}|\\)$/.test(x) ? '<br>' : '')).join(' ')
      .replace(/\\(<br>)/g, '$1')}</p>`);
  }
  return out.join('\n');
}
function treLista(L, i, ctx){
  const m0 = L[i].match(TRE_RX_ITEM), ind0 = treIndent(m0[1]), ord = /\d/.test(m0[2]);
  const desloc = ind0 + m0[2].length + 1;
  const itens = [];
  let atual = null;
  while (i < L.length){
    const l = L[i], m = l.match(TRE_RX_ITEM);
    if (m && treIndent(m[1]) === ind0 && /\d/.test(m[2]) === ord){ atual = [m[3]]; itens.push(atual); i++; continue; }
    if (!l.trim()){
      const prox = L[i + 1], mp = prox != null ? prox.match(TRE_RX_ITEM) : null;
      if (prox != null && prox.trim() && (treIndent(prox) > ind0 || (mp && treIndent(mp[1]) === ind0 && /\d/.test(mp[2]) === ord))){
        atual.push(''); i++; continue;
      }
      break;
    }
    if (treIndent(l) > ind0){ atual.push(l.replace(/\t/g, '    ').slice(Math.min(treIndent(l), desloc))); i++; continue; }
    if (!treInicioDeBloco(l) && atual[atual.length - 1].trim()){ atual.push(l.trim()); i++; continue; }
    break;
  }
  const lis = itens.map(it => {
    let tarefa = '';
    const t0 = it[0].match(/^\[( |x|X)\]\s+(.*)$/);
    if (t0){ tarefa = t0[1] === ' ' ? 'tarefa' : 'tarefa feita'; it[0] = t0[2]; }
    let h = treMd(it.join('\n'), ctx);
    const soUm = h.match(/^<p>([\s\S]*?)<\/p>/);
    if (soUm && !it.some(x => !x.trim())) h = soUm[1] + h.slice(soUm[0].length);
    return `<li${tarefa ? ` class="${tarefa}"` : ''}>${h}</li>`;
  }).join('');
  const inicio = ord ? parseInt(m0[2], 10) : 1;
  return { html: ord ? `<ol${inicio !== 1 ? ` start="${inicio}"` : ''}>${lis}</ol>` : `<ul>${lis}</ul>`, fim:i };
}

/* ============================================================
   VÍDEOS — o player do site institucional (a seção "Quem somos"):
   o palco 16:9, o botão de vidro no meio, a barra de progresso
   Synapse de 2px e a linha de baixo com o número, o título e a
   fonte. Só desce o player do YouTube (youtube-nocookie) quando a
   pessoa aperta o play — uma aula com seis vídeos não abre seis
   iframes.
   ============================================================ */
function treBlocoVideo(linhas, ctx){
  const ls = linhas.map(x => String(x || '').trim()).filter(Boolean);
  const kv = {};
  ls.forEach(x => { const m = x.match(/^(url|link|titulo|título|title|fonte|descricao|descrição)\s*:\s*(.+)$/i); if (m) kv[norm(m[1])] = m[2]; });
  const url = kv.url || kv.link || ls.find(x => /^https?:|^[\w-]{11}$/.test(x)) || '';
  const titulo = kv.titulo || kv.title || ls.find(x => x !== url && !/^\w+\s*:/.test(x)) || '';
  const id = treYoutubeId(url);
  if (!id) return `<div class="aviso-box warn tre-video-ruim"><b>Vídeo sem link do YouTube.</b>
    ${url ? `Não reconheci <code>${esc(url)}</code>.` : 'O bloco não trouxe link.'} Os vídeos dos treinamentos são publicados no YouTube.</div>`;
  ctx.videos = (ctx.videos || 0) + 1;
  const n = String(ctx.videos).padStart(2, '0');
  const dom = 'trv-' + (++treino.nVideo);
  return `<figure class="tre-video" id="${dom}" data-yt="${esc(id)}">
    <div class="tre-vstage">
      <img class="tre-vcapa" src="https://i.ytimg.com/vi/${esc(id)}/hqdefault.jpg" alt="" loading="lazy" onerror="this.remove()">
      <div class="tre-vframe"></div>
      <button class="tre-vgate" type="button" onclick="treVideoTocar('${dom}')" aria-label="Assistir${titulo ? ': ' + esc(titulo) : ''}">
        <i>${ic('play')}</i></button>
    </div>
    <div class="tre-vbar"><i></i></div>
    <figcaption class="tre-vinfo"><span class="no">V${n}</span>
      <span class="ttl">${esc(titulo || 'Vídeo')}</span><span class="src">YouTube</span>
      <span class="vacts"><a class="tre-vbtn" href="https://youtu.be/${esc(id)}" target="_blank" rel="noopener">YouTube ↗</a></span>
    </figcaption></figure>`;
}
function treYtApi(){
  return treino.ytApi || (treino.ytApi = new Promise((ok, erro) => {
    if (window.YT?.Player) return ok(window.YT);
    const antes = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { antes?.(); ok(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = () => { treino.ytApi = null; erro(new Error('o YouTube não respondeu')); };
    document.head.appendChild(s);
    setTimeout(() => erro(new Error('o YouTube demorou demais')), 9000);
  }));
}
/* um vídeo tocando por vez: dar play num pausa o outro */
function trePausarOutros(dom){
  Object.entries(treino.players).forEach(([k, p]) => { if (k !== dom) try { p.yt?.pauseVideo?.(); } catch(e){} });
}
function treVideoTocar(dom){
  const fig = document.getElementById(dom); if (!fig) return;
  const id = fig.dataset.yt, box = fig.querySelector('.tre-vframe');
  fig.classList.add('tocando');
  trePausarOutros(dom);
  const assento = document.createElement('div');
  box.innerHTML = ''; box.appendChild(assento);
  /* sem a API (rede fechada, bloqueador), o iframe simples ainda toca */
  const simples = () => { box.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${esc(id)}?autoplay=1&rel=0&playsinline=1&modestbranding=1"
    title="Vídeo" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`; };
  treYtApi().then(YT => {
    if (!assento.isConnected) return;
    const p = { yt:null, poll:null };
    treino.players[dom] = p;
    p.yt = new YT.Player(assento, {
      videoId:id, host:'https://www.youtube-nocookie.com',
      playerVars:{ autoplay:1, rel:0, playsinline:1, modestbranding:1,
        ...(location.protocol.startsWith('http') ? { origin: location.origin } : {}) },
      events:{
        onReady: e => { e.target.playVideo(); },
        onStateChange: e => { if (e.data === 1) trePausarOutros(dom); },
        onError: () => { clearInterval(p.poll); simples(); }
      }
    });
    p.poll = setInterval(() => {
      if (!fig.isConnected){ clearInterval(p.poll); delete treino.players[dom]; return; }
      try { const d = p.yt.getDuration?.(), t = p.yt.getCurrentTime?.();
        if (d > 0) fig.querySelector('.tre-vbar i').style.width = Math.min(100, t / d * 100) + '%'; } catch(e){}
    }, 300);
  }).catch(simples);
}
function treVideosParar(){
  Object.values(treino.players).forEach(p => { clearInterval(p.poll); try { p.yt?.destroy?.(); } catch(e){} });
  treino.players = {};
}

/* ============================================================
   O FORMATO DE TEXTO — o que o agente escreve e o que o portal lê
     ---                              o cabeçalho: titulo, resumo,
     titulo: Agenda no SOMA           categoria, carga_horaria (min),
     carga_horaria: 45                nota_minima, validade_meses
     ---
     # Título do módulo               cada "# " abre um módulo
     corpo em Markdown…
     ## Links relacionados            - [título](link) — descrição
     ## Verificação de conhecimento   1. Enunciado {multipla}
                                         - [x] certa   - [ ] errada
                                         - [V] / [F]   (V ou F)
                                         > explicação
   treLerTexto devolve { meta, conteudo, avisos } e nunca quebra: o
   que não entende vira aviso, para a pessoa ver antes de importar.
   ============================================================ */
const TRE_SECAO_LINKS = ['links relacionados', 'links', 'para saber mais', 'leituras', 'referencias', 'materiais'];
const TRE_SECAO_VERIF = ['verificacao de conhecimento', 'verificacao', 'verificacao do conhecimento', 'quiz',
  'questionario', 'perguntas', 'questoes', 'teste seus conhecimentos', 'avaliacao'];
function treMinutos(v){
  const t = norm(v).replace(/\s+/g, '');
  if (!t) return null;
  let m = t.match(/^(\d+)h(?:oras?)?(\d+)?(?:min)?$/);
  if (m) return (+m[1]) * 60 + (+m[2] || 0);
  m = t.match(/^(\d+)(?:min(?:utos?)?)?$/);
  return m ? +m[1] : null;
}
function treLerTexto(bruto, anteriores){
  const avisos = [];
  let txt = String(bruto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  /* agentes às vezes devolvem o arquivo inteiro dentro de ```markdown */
  const cercado = txt.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (cercado) txt = cercado[1].trim();
  const meta = {};
  const fm = txt.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (fm){
    txt = txt.slice(fm[0].length);
    fm[1].split('\n').forEach(l => {
      const m = l.match(/^\s*([^:#]+?)\s*:\s*(.*?)\s*$/); if (!m) return;
      const k = norm(m[1]).replace(/\s+/g, '_'), v = m[2].replace(/^["']|["']$/g, '').trim();
      if (!v) return;
      if (['titulo', 'title', 'nome'].includes(k)) meta.titulo = v;
      else if (['resumo', 'descricao', 'objetivo', 'summary'].includes(k)) meta.resumo = v;
      else if (k === 'categoria') meta.categoria = v;
      else if (['carga_horaria', 'carga', 'duracao', 'tempo'].includes(k)){
        const n = treMinutos(v); if (n) meta.carga_horaria_min = n; else avisos.push(`Carga horária "${v}" não reconhecida: use minutos (45) ou horas (1h30).`); }
      else if (['nota_minima', 'nota', 'aprovacao'].includes(k)){
        const n = parseInt(v, 10); if (n >= 0 && n <= 100) meta.nota_minima = n; else avisos.push(`Nota mínima "${v}" fora de 0 a 100.`); }
      else if (['validade_meses', 'validade'].includes(k)){
        const a = norm(v).match(/^(\d+)\s*(anos?|meses|mes)?$/);
        if (a) meta.validade_meses = +a[1] * (/^ano/.test(a[2] || '') ? 12 : 1);
        else if (!/^(nao|sem|nenhuma|-)/.test(norm(v))) avisos.push(`Validade "${v}" não reconhecida: use meses (12).`); }
      else if (k === 'codigo') meta.codigo = v;
    });
  }
  const L = txt.split('\n');
  /* os módulos são os títulos de nível 1. Sem nenhum, mas com
     "## Módulo …", o nível 1 é o título do treinamento e os módulos
     estão um nível abaixo — o jeito que agentes às vezes escrevem. */
  const cercas = [];
  let dentro = false;
  L.forEach((l, k) => { if (/^\s*(```|~~~)/.test(l)) dentro = !dentro; cercas[k] = dentro || /^\s*(```|~~~)/.test(l); });
  const nivel = n => L.map((l, k) => !cercas[k] && new RegExp(`^#{${n}}\\s+\\S`).test(l) ? k : -1).filter(k => k >= 0);
  let marca = 1, cabecas = nivel(1);
  const h2mod = nivel(2).filter(k => /^##\s+m[oó]dulo\b/i.test(L[k]));
  if (cabecas.length <= 1 && h2mod.length >= 1){
    if (cabecas.length === 1 && !meta.titulo) meta.titulo = L[cabecas[0]].replace(/^#\s+/, '').trim();
    marca = 2; cabecas = h2mod;
  }
  if (!cabecas.length){
    avisos.push('Nenhum módulo: cada módulo começa com um título de nível 1 ("# Título do módulo").');
    return { meta, conteudo:{ modulos:[] }, avisos };
  }
  const antes = L.slice(0, cabecas[0]).join('\n').trim();
  if (antes && marca === 1) avisos.push('Havia texto antes do primeiro módulo; ele ficou de fora.');
  const usados = new Set();
  const modulos = cabecas.map((ini, n) => {
    const fim = cabecas[n + 1] ?? L.length;
    const titulo = L[ini].replace(/^#+\s+/, '').replace(/^m[oó]dulo\s*\d*\s*[—–:.-]\s*/i, '').trim();
    const corpo = L.slice(ini + 1, fim);
    const mod = treLerModulo(titulo, corpo, marca, n + 1, avisos);
    /* o id: o do módulo de mesmo título no rascunho (a volta do
       exportar/importar mantém o progresso), senão o título em slug */
    const velho = (anteriores || []).find(x => norm(x.titulo) === norm(titulo) && !usados.has(x.id));
    let id = velho?.id || 'm-' + (treSlug(titulo) || n + 1);
    while (usados.has(id)) id += '-' + (n + 1);
    usados.add(id);
    return { id, ...mod };
  });
  return { meta, conteudo:{ modulos }, avisos };
}
function treLerModulo(titulo, linhas, marca, n, avisos){
  const sub = '#'.repeat(marca + 1);
  const rx = new RegExp(`^${sub}\\s+(.+?)\\s*#*\\s*$`);
  const corpo = [], links = [], questoes = [];
  let secao = 'corpo', dentro = false;
  let q = null;
  const fechaQ = () => { if (q){ questoes.push(q); q = null; } };
  for (const l of linhas){
    if (/^\s*(```|~~~)/.test(l)) dentro = !dentro;
    const h = !dentro && l.match(rx);
    if (h){
      const nome = norm(h[1]).replace(/[^a-z ]/g, '').trim();
      if (TRE_SECAO_VERIF.includes(nome)){ fechaQ(); secao = 'verif'; continue; }
      if (TRE_SECAO_LINKS.includes(nome)){ fechaQ(); secao = 'links'; continue; }
      if (secao !== 'corpo'){ fechaQ(); secao = 'corpo'; }
    }
    if (secao === 'corpo'){ corpo.push(marca === 2 ? l.replace(/^#(#+\s)/, '$1') : l); continue; }
    if (secao === 'links'){
      const m = l.match(/^\s*[-*+]\s+\[([^\]]+)\]\(\s*<?([^)\s>]+)>?\s*\)\s*(?:[—–:-]\s*(.*))?$/);
      if (m){
        if (!treHref(m[2])) avisos.push(`Módulo ${n}: o link "${m[2]}" não é endereço que o portal abra.`);
        links.push({ titulo:m[1].trim(), url:m[2].trim(), descricao:(m[3] || '').trim() });
      } else if (l.trim()) corpo.push(l);
      continue;
    }
    /* a verificação */
    let m;
    if ((m = l.match(/^\s{0,3}(?:\d{1,2}[.)]|#{3,5}\s*(?:quest[aã]o|pergunta)?\s*\d*[.:)]?|(?:quest[aã]o|pergunta)\s*\d+\s*[.:)-])\s*(.+)$/i))
        && !/^\s*[-*+]\s/.test(l)){
      fechaQ();
      q = { enunciado:m[1].trim(), opcoes:[], explicacao:'', marcas:new Set() };
      continue;
    }
    if (!q){ if (l.trim()) avisos.push(`Módulo ${n}: linha fora de uma questão na verificação ("${l.trim().slice(0, 40)}").`); continue; }
    if ((m = l.match(/^\s*[-*+]\s+\[\s*([ xX✓✔vVfF]?)\s*\]\s+(.+)$/))){
      const c = m[1].toLowerCase();
      const k = /[vf]/.test(c) ? 'vf' : 'x';
      q.marcas.add(k);
      q.opcoes.push({ texto:m[2].trim(), correta: c === 'x' || c === '✓' || c === '✔' || c === 'v', _k:k });
      continue;
    }
    if ((m = l.match(/^\s*>\s?(.*)$/))){
      const t = m[1].replace(/^\s*(?:\*\*)?(explica[çc][ãa]o|por qu[eê]|resposta|justificativa)\s*:?\s*(?:\*\*)?\s*:?\s*/i, '');
      q.explicacao = (q.explicacao ? q.explicacao + '\n' : '') + t;
      continue;
    }
    if (l.trim() && !q.opcoes.length) q.enunciado += '\n' + l.trim();
    else if (l.trim()) avisos.push(`Módulo ${n}: linha solta depois das alternativas ("${l.trim().slice(0, 40)}").`);
  }
  fechaQ();
  const qs = questoes.map((x, j) => {
    const pre = `Módulo ${n} · questão ${j + 1}`;
    let tipo = null;
    const mk = x.enunciado.match(/\s*\{\s*(unica|única|multipla|múltipla|varias|várias|vf|v\/f|verdadeiro ou falso)\s*\}\s*$/i);
    if (mk){ x.enunciado = x.enunciado.slice(0, mk.index).trim();
      const t = norm(mk[1]); tipo = t === 'unica' ? 'unica' : /^(multipla|varias)$/.test(t) ? 'multipla' : 'vf'; }
    if (!tipo) tipo = x.marcas.has('vf') ? 'vf' : x.opcoes.filter(o => o.correta).length > 1 ? 'multipla' : 'unica';
    if (x.marcas.size > 1) avisos.push(`${pre}: mistura [x] com [V]/[F] — use um só jeito por questão.`);
    const opcoes = x.opcoes.map((o, k) => ({ id:String.fromCharCode(97 + k), texto:o.texto, correta:!!o.correta }));
    const nc = opcoes.filter(o => o.correta).length;
    if (tipo !== 'vf' && opcoes.length < 2) avisos.push(`${pre}: precisa de pelo menos duas alternativas.`);
    if (tipo === 'unica' && nc !== 1) avisos.push(`${pre}: questão de uma correta com ${nc} marcadas.`);
    if (tipo === 'multipla' && !nc) avisos.push(`${pre}: nenhuma alternativa marcada como correta.`);
    if (tipo === 'vf' && !opcoes.length) avisos.push(`${pre}: V ou F sem afirmações.`);
    if (!x.explicacao.trim()) avisos.push(`${pre}: sem explicação (a linha que começa com ">").`);
    return { id:'q' + (j + 1), tipo, enunciado:x.enunciado.trim(), opcoes, explicacao:x.explicacao.trim() };
  });
  const mod = { titulo, corpo: corpo.join('\n').replace(/^\n+|\n+$/g, '') };
  if (links.length) mod.links = links;
  if (qs.length) mod.verificacao = { questoes:qs };
  if (!titulo) avisos.push(`Módulo ${n}: sem título.`);
  if (!mod.corpo.trim()) avisos.push(`Módulo ${n}: o corpo está vazio.`);
  return mod;
}
/* O caminho de volta: o mesmo arquivo que treLerTexto lê. */
function treEscreverTexto(meta, conteudo){
  const fm = ['---', `titulo: ${meta.titulo || ''}`];
  if (meta.codigo) fm.push(`codigo: ${meta.codigo}`);
  if (meta.resumo) fm.push(`resumo: ${String(meta.resumo).replace(/\n+/g, ' ')}`);
  if (meta.categoria) fm.push(`categoria: ${meta.categoria}`);
  if (meta.carga_horaria_min) fm.push(`carga_horaria: ${meta.carga_horaria_min}`);
  if (meta.nota_minima != null && meta.nota_minima !== '') fm.push(`nota_minima: ${meta.nota_minima}`);
  if (meta.validade_meses) fm.push(`validade_meses: ${meta.validade_meses}`);
  fm.push('---');
  const blocos = (conteudo?.modulos || []).map(m => {
    const b = [`# ${m.titulo || ''}`, '', String(m.corpo || '').trim()];
    if ((m.links || []).length){
      b.push('', '## Links relacionados', '');
      m.links.forEach(k => b.push(`- [${k.titulo || k.url}](${k.url})${k.descricao ? ' — ' + k.descricao : ''}`));
    }
    const qs = m.verificacao?.questoes || [];
    if (qs.length){
      b.push('', '## Verificação de conhecimento', '');
      qs.forEach((q, j) => {
        const marca = q.tipo === 'multipla' ? ' {multipla}' : q.tipo === 'vf' ? ' {vf}' : '';
        const en = String(q.enunciado || '').split('\n');
        b.push(`${j + 1}. ${en[0]}${en.length === 1 ? marca : ''}`);
        en.slice(1).forEach((x, k) => b.push(`   ${x}${k === en.length - 2 ? marca : ''}`));
        (q.opcoes || []).forEach(o => b.push(`   - [${q.tipo === 'vf' ? (o.correta ? 'V' : 'F') : (o.correta ? 'x' : ' ')}] ${o.texto}`));
        if (q.explicacao) String(q.explicacao).split('\n').forEach(x => b.push(`   > ${x}`));
        b.push('');
      });
    }
    return b.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  });
  return fm.join('\n') + '\n\n' + blocos.join('\n\n') + '\n';
}

/* Os problemas que impedem publicar — os mesmos da
   treinamento_problemas() do banco, que é quem decide —, mais os
   que só o portal enxerga: vídeo sem link do YouTube, link que não
   abre e as marcas de pendência que o README manda deixar. */
function treProblemas(c){
  const out = [];
  const mods = c?.modulos || [];
  if (!mods.length) return ['O treinamento não tem nenhum módulo.'];
  const ids = new Set(), rx = /^[A-Za-z0-9_-]{1,64}$/;
  mods.forEach((m, i) => {
    const pre = `Módulo ${i + 1}`;
    if (!m.id) out.push(`${pre}: sem identificador.`);
    else if (!rx.test(m.id)) out.push(`${pre}: identificador com caracteres que não valem (só letras, números, - e _).`);
    else if (ids.has(m.id)) out.push(`${pre}: identificador repetido (${m.id}).`); else ids.add(m.id);
    if (!String(m.titulo || '').trim()) out.push(`${pre}: sem título.`);
    if (!String(m.corpo || '').trim()) out.push(`${pre}: o corpo está vazio.`);
    const corpo = String(m.corpo || '');
    const pend = corpo.match(/\[(?:V[ÍI]DEO A GRAVAR|PENDENTE|CONFIRMAR[^\]]*)[^\]]*\]/gi);
    if (pend) out.push(`${pre}: ${pend.length === 1 ? 'uma pendência marcada' : pend.length + ' pendências marcadas'} no texto (${pend[0].slice(0, 48)}).`);
    let fora = false, exemplo = false;
    corpo.replace(/```\s*(?:video|youtube)\s*\n([\s\S]*?)```/gi, (_, b) => {
      const url = b.split('\n').map(x => x.trim()).map(x => x.replace(/^(url|link)\s*:\s*/i, '')).find(x => /^https?:|^[\w-]{11}$/.test(x));
      if (!treYoutubeId(url)) fora = true;
      else if (/^x{11}$/i.test(treYoutubeId(url))) exemplo = true;
      return '';
    });
    if (fora) out.push(`${pre}: há um bloco de vídeo sem link do YouTube.`);
    if (exemplo) out.push(`${pre}: um vídeo ainda está com o link de exemplo do README (XXXXXXXXXXX).`);
    const ruins = [...corpo.matchAll(/\]\(\s*<?([^)\s>]+)>?[^)]*\)/g)].map(x => x[1]).filter(u => !treHref(u) && !/^https:/.test(u));
    (m.links || []).forEach(k => { if (!treHref(k.url)) ruins.push(k.url); });
    if (ruins.length) out.push(`${pre}: link que o portal não abre (${ruins[0]}).`);
    const qids = new Set();
    (m.verificacao?.questoes || []).forEach((q, j) => {
      const pq = `${pre} · questão ${j + 1}`;
      if (!q.id || qids.has(q.id) || !rx.test(q.id) || (q.opcoes || []).some(o => !rx.test(String(o.id || ''))))
        out.push(`${pq}: identificador vazio, repetido ou com caracteres que não valem.`);
      qids.add(q.id);
      if (!String(q.enunciado || '').trim()) out.push(`${pq}: sem enunciado.`);
      const ops = q.opcoes || [], nc = ops.filter(o => o.correta).length;
      if (ops.some(o => !String(o.texto || '').trim())) out.push(`${pq}: há uma alternativa sem texto.`);
      if (q.tipo === 'vf'){ if (!ops.length) out.push(`${pq}: V ou F sem nenhuma afirmação.`); }
      else {
        if (ops.length < 2) out.push(`${pq}: precisa de pelo menos duas alternativas.`);
        if (q.tipo === 'unica' && nc !== 1) out.push(`${pq}: uma correta só — há ${nc} marcadas.`);
        else if (q.tipo === 'multipla' && !nc) out.push(`${pq}: nenhuma alternativa marcada como correta.`);
      }
    });
  });
  return out;
}

/* ============================================================
   O README DE CONTEÚDO — o padrão
   É o guia que vai junto do pedido aos agentes de IA: estrutura,
   tom, vídeos, links, questões. Mora aqui, e não no banco, porque
   descreve o formato que treLerTexto() lê: mudar um sem o outro é
   ensinar o agente a escrever o que o portal não entende. A equipe
   pode reescrever o dela em Treinamentos › Configurações ›
   README (treinamento_config.readme); vazio, vale este.
   ============================================================ */
const TRE_README_PADRAO = `# README · Treinamentos da NeuroDynamics

Guia para escrever os treinamentos do portal do membro (membro.neurodynamics.dev › Treinamentos). Vale para quem escreve à mão e, principalmente, para os agentes de IA: entregue este arquivo junto com o pedido. O texto que voltar é colado em **Treinamentos › Importar texto** e vira o rascunho do treinamento — alguém da equipe revisa e publica.

## 1. Quem somos e para quem se escreve

A NeuroDynamics é uma iniciativa sem fins lucrativos de pesquisa e desenvolvimento em tecnologia para a saúde, formada por estudantes da Escola de Engenharia da UFMG e sediada no LABBIO, o Laboratório de Bioengenharia da universidade. O SOMA é o sistema interno da equipe, e o portal do membro é onde ele mora: agenda, atividades, projetos, arquivos, treinamentos.

Quem faz os treinamentos são os membros — estudantes de engenharia, muitos no primeiro semestre na equipe. Sabem estudar; ainda não sabem como as coisas funcionam aqui. Escreva para essa pessoa.

## 2. O tom

- **Direto e em segunda pessoa.** "Abra a Agenda e escolha **Novo compromisso**", não "o usuário deverá acessar o módulo de agenda".
- **Frase curta, voz ativa, uma ideia por parágrafo.** Parágrafo de até quatro linhas.
- **Diga o porquê.** Toda regra vem com o motivo, em uma frase — é o motivo que faz a regra ser lembrada.
- **Concreto.** Nomes de tela, de botão e de documento exatamente como aparecem no portal, em **negrito** na primeira vez. Exemplos do dia a dia da equipe, não genéricos.
- **Português do Brasil, sem jargão desnecessário.** Termo técnico, quando precisa, é explicado na primeira vez em que aparece.
- **Sem** emojis, pontos de exclamação em série, "Olá, pessoal!", "Neste módulo você vai aprender…" e conclusões que repetem o módulo.
- Os sistemas e os documentos se chamam pelo nome: *a Agenda*, *o quadro de Atividades*, *a política de acesso ao LABBIO (NRO-PES-015)*.

## 3. A estrutura

Um treinamento é **um arquivo Markdown**: um cabeçalho e os módulos.

\`\`\`
---
titulo: Agenda no SOMA
resumo: Como marcar, responder e acompanhar os compromissos da equipe.
categoria: Sistemas
carga_horaria: 30
---

# Primeiro módulo

…

# Segundo módulo

…
\`\`\`

**O cabeçalho**, entre as duas linhas \`---\`:

| Campo | O que é |
|---|---|
| \`titulo\` | o nome do treinamento, curto (até uns 60 caracteres), sem "Treinamento de" |
| \`resumo\` | uma ou duas frases: o que a pessoa vai saber fazer ao terminar |
| \`categoria\` | Integração, Sistemas, Laboratório, Segurança, Projetos, Gestão ou Comunicação |
| \`carga_horaria\` | o tempo estimado, em minutos, contando os vídeos e as verificações |
| \`nota_minima\` | opcional: a porcentagem para passar em cada verificação (o padrão é 70) |
| \`validade_meses\` | opcional: depois de quantos meses é preciso refazer (segurança, por exemplo) |

O código (NRO-TRE-XXX) e a revisão (Rev. A, B…) quem dá é o portal, não o texto.

**Os módulos.** Cada módulo começa com um título de nível 1 (\`# \`) e vai até o próximo. O portal numera os módulos — não escreva "Módulo 1" no título.

- de **3 a 7 módulos**; cada um com **3 a 8 minutos** de leitura (300 a 900 palavras), fora os vídeos;
- o módulo abre com **uma frase** dizendo o que a pessoa vai conseguir fazer ao fim dele;
- dentro do módulo, subtítulos com \`##\` e \`###\` — nunca \`#\`, que abre outro módulo;
- procedimento é **lista numerada**, um passo por item, começando pelo verbo;
- o módulo termina no último passo ou na última ideia. Sem resumo do que acabou de ser dito.

Dois subtítulos são reservados e, quando existem, fecham o módulo, nesta ordem: \`## Links relacionados\` e \`## Verificação de conhecimento\`.

## 4. O Markdown que o portal desenha

Use só isto — o resto aparece como texto:

- \`## Subtítulo\` e \`### Subtítulo menor\`;
- parágrafos, separados por uma linha em branco;
- \`**negrito**\` para nomes de tela e de botão; \`*itálico*\` para ênfase, com parcimônia;
- \`\` \`código\` \`\` para o que se digita (um endereço, um comando, um nome de arquivo);
- listas com \`-\`, ou numeradas com \`1.\`, que podem ter subitens (dois espaços de recuo);
- tabelas simples (\`| a | b |\`, com a linha \`|---|---|\` embaixo do cabeçalho), para comparar;
- \`---\` sozinho numa linha, para separar partes;
- as caixas: um parágrafo que começa com \`> **Dica:**\`, \`> **Atenção:**\`, \`> **Importante:**\` ou \`> **Nota:**\` vira uma caixa colorida. Uma ou duas por módulo, no máximo — caixa demais é caixa nenhuma.

**Não use** HTML, imagens de fora (a não ser que o pedido traga o link), título de nível 1 dentro do módulo, nota de rodapé e emoji.

## 5. Vídeos

Os vídeos da equipe ficam no **YouTube** (pode ser "não listado"; privado não abre) e aparecem no portal no mesmo player do site institucional. Para pôr um vídeo, use um bloco \`video\`, em linha própria, no ponto do texto em que o vídeo cabe:

\`\`\`\`
\`\`\`video
https://www.youtube.com/watch?v=XXXXXXXXXXX
Como cadastrar a sua agenda no SOMA
\`\`\`
\`\`\`\`

A primeira linha é o link do vídeo; a segunda, o título que aparece embaixo do player.

- **Nunca invente link de vídeo.** Use só os que vieram no pedido.
- O vídeo ainda não existe? Deixe a marca \`[VÍDEO A GRAVAR: o que o vídeo mostra, em uma frase]\`, num parágrafo só dela, no lugar dele. O portal não publica enquanto houver marca.
- Diga, no parágrafo antes, o que a pessoa vai ver no vídeo. E não repita no texto, passo a passo, o que o vídeo já mostra: o texto é para quem não pode ouvir agora e para quem volta para consultar.

## 6. Links

| Para | Escreva | Exemplo |
|---|---|---|
| um arquivo da equipe (Arquivos) | \`arquivo:\` e o código | \`[política de acesso ao LABBIO](arquivo:NRO-PES-015)\` |
| outro treinamento | \`treinamento:\` e o código | \`[Agenda no SOMA](treinamento:NRO-TRE-001)\` |
| uma tela do portal | o endereço dela | \`[Agenda](#/agenda)\`, \`[Serviços](#/servicos)\` |
| fora do portal | o endereço completo | \`[site institucional](https://neurodynamics.dev)\` |

As telas do portal que se pode citar: \`#/agenda\` (e \`#/agenda/mes\`, \`#/agenda/agendar\`, \`#/agenda/presenca\`, \`#/agenda/minha\`), \`#/atividades\`, \`#/okrs\`, \`#/projetos\`, \`#/arquivos\`, \`#/equipe\`, \`#/treinamentos\`, \`#/informacoes\` e \`#/servicos\` (e \`#/servicos/acesso\`, \`#/servicos/pedidos\`).

- **Nunca invente código de documento.** Use só os da lista de referências que acompanha este arquivo (quando acompanha) ou os que vieram no pedido. Não sabe o código? Escreva o nome do documento e a marca \`[CONFIRMAR LINK: nome do documento]\`.
- O texto do link diz para onde ele leva: "a [política de acesso ao LABBIO](arquivo:NRO-PES-015)", nunca "clique [aqui](…)".

### Links relacionados

No fim do módulo, a seção \`## Links relacionados\` junta o que vale abrir depois: documentos, telas, outros treinamentos, a fonte do conteúdo. Uma linha por link, com uma descrição curta depois do travessão:

\`\`\`
## Links relacionados

- [Política de acesso ao LABBIO](arquivo:NRO-PES-015) — quem entra, em que horário e com que acompanhamento.
- [Agenda do mês](#/agenda/mes) — onde aparecem os horários reservados do laboratório.
\`\`\`

## 7. A verificação de conhecimento

É opcional em cada módulo: ponha onde há algo que vale conferir — um procedimento, uma regra, uma decisão. Módulo de apresentação pode não ter. Ela fica na seção \`## Verificação de conhecimento\`, a última do módulo, com **de 2 a 5 questões**.

Cada questão é um item numerado; as alternativas vêm logo abaixo, com recuo; a explicação, numa linha que começa com \`>\`:

\`\`\`
## Verificação de conhecimento

1. Onde você vê, lado a lado, o livre e o ocupado de várias pessoas?
   - [ ] Na aba Mês
   - [x] No assistente Agendar
   - [ ] Em Minha agenda
   > O assistente Agendar junta a agenda de cada pessoa escolhida e sugere os horários livres.

2. O que aparece na Agenda da equipe? {multipla}
   - [x] Os compromissos da equipe
   - [x] Os marcos do semestre
   - [ ] Os e-mails recebidos
   > A Agenda junta compromissos, marcos e ausências — e-mail não entra.

3. Verdadeiro ou falso: {vf}
   - [V] O portal lê o seu Google Agenda para saber quando você está ocupado.
   - [F] Todo compromisso novo se repete toda semana.
   > O padrão é não repetir: a repetição se escolhe ao criar o compromisso.
\`\`\`

**Os três tipos:**

| Tipo | Como marcar | Quando usar |
|---|---|---|
| uma correta | uma alternativa com \`[x]\`, as outras com \`[ ]\` | a pergunta tem uma resposta |
| várias corretas | \`{multipla}\` no fim do enunciado, e \`[x]\` em todas as corretas | uma lista de coisas que valem |
| verdadeiro ou falso | \`{vf}\` no fim do enunciado, e cada afirmação com \`[V]\` ou \`[F]\` | afirmações que a pessoa costuma confundir |

A correção é **tudo ou nada** por questão: em várias corretas, vale o conjunto exato; no V ou F, todas as afirmações. Por isso, V ou F com **2 a 4 afirmações**.

**Boas questões:**

- testam **entender e aplicar**, não decorar: "o que você faz quando…" vale mais que "em que ano…";
- têm **3 ou 4 alternativas**, de tamanho parecido e todas plausíveis — alternativa boba não ensina nada;
- a correta muda de posição de uma questão para outra;
- **sem** "todas as anteriores", "nenhuma das anteriores" e pegadinha; negação, só em **negrito** ("qual **não**…");
- no V ou F, a afirmação é claramente verdadeira ou falsa pelo que o módulo disse — sem "sempre" e "nunca" para enganar;
- **toda questão tem explicação** (a linha com \`>\`), dizendo por que a certa é certa. Ela aparece para a pessoa depois que ela passa;
- a resposta está no módulo. Nada que o texto não tenha dito.

## 8. Transformar um link ou um documento em treinamento

Quando o pedido traz uma fonte (uma página, um documento, um vídeo):

- **reorganize para quem aprende**: da tarefa mais comum para a exceção, não na ordem da fonte;
- **resuma com fidelidade** — nada que a fonte não diga. Onde ela é vaga, deixe a marca \`[CONFIRMAR: o que falta saber]\`;
- traga para o nosso contexto: os nomes das nossas telas, dos nossos documentos, do LABBIO;
- não copie trechos longos; cite a fonte em **Links relacionados**.

## 9. Antes de entregar

- [ ] o cabeçalho tem \`titulo\`, \`resumo\`, \`categoria\` e \`carga_horaria\`;
- [ ] cada módulo começa com \`# \` e com a frase do que a pessoa vai conseguir fazer;
- [ ] nenhum link, vídeo ou código de documento foi inventado; o que falta está marcado;
- [ ] cada vídeo é um bloco \`video\` com um link do YouTube que veio no pedido;
- [ ] cada questão tem as alternativas marcadas e a explicação;
- [ ] a resposta é **só o texto do treinamento**, em Markdown, começando pelo \`---\` do cabeçalho — sem comentário antes nem depois.

## 10. Um exemplo inteiro

\`\`\`\`
---
titulo: Acesso ao LABBIO
resumo: Quem pode entrar no laboratório, em que horário e o que fazer antes de ir.
categoria: Laboratório
carga_horaria: 20
---

# Antes de ir ao laboratório

Ao fim deste módulo, você sabe o que precisa estar certo antes de ir ao LABBIO.

O LABBIO é o Laboratório de Bioengenharia da Escola de Engenharia, e a NeuroDynamics divide o espaço com outros grupos. Por isso o acesso segue a [política de acesso ao LABBIO](arquivo:NRO-PES-015).

1. Confira na [Agenda do mês](#/agenda/mes) se há horário reservado.
2. Ao chegar, faça o check-in pelo QR code da entrada.
3. Ao sair, deixe a bancada como encontrou.

> **Atenção:** sem o termo de acesso assinado, a portaria não libera a entrada.

No vídeo, o caminho da portaria até a bancada, e onde fica o QR code.

\`\`\`video
https://youtu.be/XXXXXXXXXXX
Como fazer o check-in na entrada do LABBIO
\`\`\`

## Links relacionados

- [Política de acesso ao LABBIO](arquivo:NRO-PES-015) — as regras completas.
- [Presença e check-in](#/agenda/presenca) — quem está no laboratório agora.

## Verificação de conhecimento

1. O que você faz ao chegar ao LABBIO?
   - [ ] Avisa no grupo da equipe
   - [x] Faz o check-in pelo QR code da entrada
   - [ ] Assina a lista na portaria
   > O check-in pelo QR registra a sua presença no portal, e a equipe vê quem está no laboratório.
\`\`\`\`
`;
/* o pedido que vai junto do README, para a pessoa completar */
const TRE_PEDIDO_MODELO = `Você vai escrever um treinamento da NeuroDynamics para o portal do membro.
Siga à risca o README anexo (README-treinamentos.md): a estrutura, o tom, o Markdown permitido, o jeito de pôr vídeos e links e o formato das questões.

Tema: [ex.: como marcar e responder compromissos na Agenda do SOMA]
Público: [ex.: membros novos, no primeiro mês na equipe]
Fontes: [links, documentos ou o que você já sabe sobre o assunto]
Vídeos disponíveis: [os links do YouTube, com o título de cada um — ou "nenhum"]
Tamanho: [ex.: de 3 a 5 módulos, uns 30 minutos no total]

Devolva só o texto do treinamento, em Markdown, começando pelo cabeçalho entre --- e ---.`;

/* ============================================================
   A ROTA
   ============================================================ */
async function pageTreinamentos(sub, sub2){
  treVideosParar();
  if (treino.ed && (treino.ed.sujoM || treino.ed.sujoC)) treEdSalvar();   /* saiu do editor com algo por gravar */
  const s = String(sub || '');
  const so = f => gereTreinamentos() ? f() : treSemPermissao();
  if (!s) return treParaVoce();
  if (s === 'todos') return treTodos();
  if (s === 'certificados') return treCertificados();
  if (s === 'certificado') return treVerificar(sub2);
  if (s === 'gestao'){ history.replaceState(null, '', location.pathname + '#/treinamentos/config'); return so(treGestao); }
  if (s === 'novo') return so(treNovo);
  if (s === 'config') return so(() => sub2 === 'geral' || sub2 === 'readme' ? treConfig(sub2) : treGestao());
  if (/^nro-tre-\d{3,}$/i.test(s)){
    const cod = s.toUpperCase();
    if (sub2 === 'editar') return so(() => treEditor(cod));
    if (sub2 === 'acompanhamento') return so(() => treAcompanhamento(cod));
    if (/^\d+$/.test(sub2 || '')) return treModulo(cod, +sub2);
    return treTreinamento(cod);
  }
  return treNaoAchou(s);
}
/* rota de quem gere, aberta por quem não gere: a primeira tela do
   espaço, sem porta fechada */
function treSemPermissao(){
  history.replaceState(null, '', location.pathname + '#/treinamentos');
  return treParaVoce();
}
function treNaoAchou(cod){
  $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div>
    <h3>Nenhum treinamento ${esc(cod)}</h3><p>O código pode estar errado, ou o treinamento ainda não foi publicado.</p>
    <a class="btn ghost" href="#/treinamentos/todos">Todos os treinamentos</a></div>`;
}
const treCarregando = t => `<div class="carregando"><span class="spin"></span> ${t || 'Carregando…'}</div>`;
function treFaltaBanco(erro){
  $('#main').innerHTML = `${treTopo('Treinamentos', '')}<div class="aviso-box err"><b>Os treinamentos ainda não estão no banco.</b>
    ${esc(erro?.message || '')}<br><span class="small">Falta aplicar a migração <code>db/v24_treinamentos.sql</code>.</span></div>`;
}
/* Nível 1: as seções do espaço. Configurações (de quem gere) reúne a
   lista de todos os treinamentos, o geral e o README, no nível 2. */
function treNav(atual){
  const n = (treino.lista || []).filter(t => t.obrigatorio && t.situacao !== 'concluido').length;
  const it = [['', 'Para você', '#/treinamentos', n ? `<span class="n sua" title="Obrigatórios pendentes">${n}</span>` : ''],
    ['todos', 'Todos', '#/treinamentos/todos'], ['certificados', 'Meus certificados', '#/treinamentos/certificados']];
  if (gereTreinamentos()) it.push(['config', 'Configurações', '#/treinamentos/config']);
  return navNivel1(it, atual, 'Treinamentos');
}
function treNavConfig(atual){
  return navNivel2([['', 'Treinamentos', '#/treinamentos/config'], ['geral', 'Geral', '#/treinamentos/config/geral'],
    ['readme', 'README de conteúdo', '#/treinamentos/config/readme']], atual, 'Configurações');
}
function treTopo(titulo, lead, acoes, olho){
  return `<div class="topo-gestao"><div class="tx"><span class="eyebrow">${esc(olho || 'Treinamentos')}</span><h1>${titulo}</h1>
    ${lead ? `<p class="lead">${lead}</p>` : ''}</div>${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
}
async function treCarregarLista(){
  const { data, error } = await sb.rpc('treinamentos_meus');
  if (error || !Array.isArray(data)){ treino.erro = error || { message:'treinamentos_meus não devolveu a lista' }; return false; }
  treino.erro = null; treino.lista = data;
  state.treMeus = treino.lista;                 /* a casca usa no início e na busca */
  return true;
}
async function treConfigCarregar(){
  const { data } = await sb.from('treinamento_config').select('*').maybeSingle();
  treino.cfg = data || {};
  return treino.cfg;
}

/* ============================================================
   PARA VOCÊ — o que os seus grupos pedem
   ============================================================ */
function treAcao(t){
  const s = t.situacao;
  return s === 'concluido' ? 'Rever' : s === 'andamento' ? 'Continuar' : (s === 'vencido' || s === 'nova_revisao') ? 'Refazer' : 'Começar';
}
function treCartao(t){
  const s = t.situacao, n = t.n_modulos || 0;
  const pct = s === 'concluido' ? 100 : n ? Math.round(100 * (t.feitos || 0) / n) : 0;
  return `<a class="tre-card s-${esc(s)}" href="#/treinamentos/${esc(t.codigo)}" data-cod="${esc(t.codigo)}">
    <div class="tre-card-top"><span class="cod">${esc(t.codigo)} · ${esc(treRev(t.revisao))}</span>${treObrig(t.obrigatorio)}</div>
    <div class="tt">${esc(t.titulo)}</div>
    ${t.resumo ? `<div class="rs">${esc(t.resumo)}</div>` : ''}
    <div class="meta">${[n + (n === 1 ? ' módulo' : ' módulos'), treDuracao(t.carga_horaria_min), t.categoria].filter(Boolean).map(esc).join(' · ')}</div>
    <div class="tre-prog" title="${t.feitos || 0} de ${n} módulos"><i style="width:${pct}%"></i></div>
    <div class="pe">${trePill(s)}<span class="go">${treAcao(t)} →</span></div></a>`;
}
async function treParaVoce(){
  $('#main').innerHTML = treCarregando('Carregando os seus treinamentos…');
  if (!await treCarregarLista()) return treFaltaBanco(treino.erro);
  const L = treino.lista;
  const obrig  = L.filter(t => t.obrigatorio && t.situacao !== 'concluido');
  const andam  = L.filter(t => !t.obrigatorio && t.situacao === 'andamento');
  const recom  = L.filter(t => t.obrigatorio === false && t.situacao !== 'concluido' && t.situacao !== 'andamento');
  const feitos = L.filter(t => t.situacao === 'concluido');
  const sec = (tit, sub, itens) => itens.length ? `<section class="tre-sec"><h2>${tit}<span class="n">${itens.length}</span></h2>
    ${sub ? `<p class="small muted">${sub}</p>` : ''}<div class="tre-grade">${itens.map(treCartao).join('')}</div></section>` : '';
  const semNada = !obrig.length && !andam.length && !recom.length;
  $('#main').innerHTML = `${treTopo('Para você',
      'Os treinamentos que os seus grupos pedem — os obrigatórios primeiro. Ao concluir, o certificado fica em <a href="#/treinamentos/certificados">Meus certificados</a>.',
      gereTreinamentos() ? `<a class="btn solid mini" href="#/treinamentos/novo">${ic('plus')} Novo treinamento</a>` : '')}
    ${treNav('')}
    ${!treEu() ? `<div class="aviso-box warn">A sua conta ainda não está ligada a um registro do quadro: dá para ler os
      treinamentos, mas o progresso e o certificado não ficam guardados. O Depto. de Pessoal faz o vínculo.</div>` : ''}
    <div class="st-resumo">
      <span class="st-num${obrig.length ? ' vez' : ''}"><b>${obrig.length}</b> obrigatório${obrig.length === 1 ? '' : 's'} por fazer</span>
      <span class="st-num"><b>${L.filter(t => t.situacao === 'andamento').length}</b> em andamento</span>
      <span class="st-num"><b>${feitos.length}</b> concluído${feitos.length === 1 ? '' : 's'}</span></div>
    ${sec('Obrigatórios', 'Atribuídos a um grupo seu como obrigatórios. Um vencido ou com revisão nova precisa ser refeito.', obrig)}
    ${sec('Em andamento', '', andam)}
    ${sec('Recomendados para o seu grupo', 'Opcionais: atribuídos a um grupo seu, sem obrigação.', recom)}
    ${semNada ? `<div class="vazio"><div class="glyph">✓</div><h3>${L.length ? 'Nada pendente para você' : 'Nenhum treinamento publicado ainda'}</h3>
      <p>${L.length ? 'Nenhum treinamento atribuído aos seus grupos espera por você. Os outros estão em Todos os treinamentos.'
        : 'Quando a equipe publicar o primeiro treinamento, ele aparece aqui.'}</p>
      ${L.length ? '<a class="btn ghost" href="#/treinamentos/todos">Todos os treinamentos</a>' : ''}</div>` : ''}
    ${sec('Concluídos', '', feitos)}`;
}

/* ============================================================
   TODOS — o catálogo
   ============================================================ */
async function treTodos(){
  $('#main').innerHTML = treCarregando();
  if (!await treCarregarLista()) return treFaltaBanco(treino.erro);
  treTodosDesenhar();
}
function treTodosDesenhar(){
  const q = norm(treino.q), cats = [...new Set(treino.lista.map(t => t.categoria).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  const vis = treino.lista.filter(t => (!treino.cat || t.categoria === treino.cat)
    && (!q || norm([t.codigo, t.titulo, t.resumo, t.categoria].join(' ')).includes(q)));
  $('#main').innerHTML = `${treTopo('Todos os treinamentos', 'Tudo o que a equipe publicou. Qualquer um pode fazer qualquer treinamento — o que a atribuição muda é o que é obrigatório para quem.')}
    ${treNav('todos')}
    <div class="filtros">
      ${cats.length ? `<div class="chips" role="group" aria-label="Categoria"><button class="chip-b${!treino.cat ? ' on' : ''}" onclick="treino.cat='';treTodosDesenhar()">Todas</button>
        ${cats.map(c => `<button class="chip-b${treino.cat === c ? ' on' : ''}" onclick="treino.cat=this.dataset.c;treTodosDesenhar()" data-c="${esc(c)}">${esc(c)}</button>`).join('')}</div>` : ''}
      <div class="fld cresce"><input id="tre-q" placeholder="Buscar por código, título ou assunto" value="${esc(treino.q)}"
        oninput="treino.q=this.value;clearTimeout(treino._q);treino._q=setTimeout(()=>{treTodosDesenhar();const e=$('#tre-q');e.focus();e.setSelectionRange(e.value.length,e.value.length)},220)"></div></div>
    ${vis.length ? `<div class="tre-grade">${vis.map(treCartao).join('')}</div>`
      : `<div class="vazio"><h3>${treino.lista.length ? 'Nenhum treinamento com esse filtro' : 'Nenhum treinamento publicado ainda'}</h3>
        ${treino.lista.length ? `<p><button class="btn ghost" onclick="treino.q='';treino.cat='';treTodosDesenhar()">Limpar filtros</button></p>` : ''}</div>`}`;
}

/* ============================================================
   MEUS CERTIFICADOS
   ============================================================ */
async function treCertificados(){
  $('#main').innerHTML = treCarregando();
  const [ok, c] = await Promise.all([treCarregarLista(),
    treEu() ? sb.from('treinamento_conclusoes').select('*').eq('registro', treEu()).order('concluido_em', { ascending:false })
            : Promise.resolve({ data:[] })]);
  if (!ok) return treFaltaBanco(treino.erro);
  const lista = c.data || [];
  treino.conclusoes = lista;
  const estado = x => {
    const t = treino.lista.find(y => y.codigo === x.codigo);
    if (t && t.certificado === x.certificado && t.situacao === 'concluido')
      return `<span class="pill p-ok"><span class="dt dt-ok"></span>Em dia${t.vence_em ? ' até ' + fmtD(t.vence_em) : ''}</span>`;
    return '<span class="pill"><span class="dt dt-gray"></span>Histórico</span>';
  };
  $('#main').innerHTML = `${treTopo('Meus certificados', 'Cada treinamento concluído, com o certificado em PDF. O código no pé do certificado confere que ele é da equipe.')}
    ${treNav('certificados')}
    ${lista.length ? `<div class="tre-certs">${lista.map((x, i) => `<div class="tre-cert-tile">
        <div class="tre-cert-fita"></div>
        <div class="tre-cert-tx"><span class="cod">${esc(x.codigo)} · Rev. ${esc(x.revisao)}</span>
          <div class="tt">${esc(x.titulo)}</div>
          <div class="meta">Concluído em ${esc(treDataLonga(x.concluido_em))}${x.nota != null ? ` · nota ${x.nota}%` : ''}${x.carga_horaria_min ? ' · ' + esc(treDuracao(x.carga_horaria_min)) : ''}</div>
          <div class="pe">${estado(x)}<span class="mono small dim">${esc(x.certificado)}</span></div></div>
        <div class="tre-cert-acs"><button class="btn solid mini" onclick="treBaixarCertificado('${esc(x.certificado)}', this)">${ic('down')} Baixar PDF</button>
          <button class="btn ghost mini" onclick="copiar('${esc(x.certificado)}')">${ic('copy')} Código</button></div></div>`).join('')}</div>`
      : `<div class="vazio"><div class="glyph">—</div><h3>Nenhum certificado ainda</h3>
        <p>Ao concluir o último módulo de um treinamento, o certificado aparece aqui.</p>
        <a class="btn ghost" href="#/treinamentos">Para você</a></div>`}
    <div class="card tre-conferir"><h3>Conferir um certificado</h3>
      <p class="small muted" style="margin:4px 0 12px">Recebeu um certificado da equipe? O código fica no pé dele.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="tre-cc" placeholder="CERT-XXXX-XXXX" style="max-width:220px;font-family:var(--fm)"
        onkeydown="if(event.key==='Enter')location.hash='#/treinamentos/certificado/'+this.value.trim()">
        <button class="btn ghost" onclick="location.hash='#/treinamentos/certificado/'+$('#tre-cc').value.trim()">Conferir</button></div></div>`;
}
async function treVerificar(cod){
  $('#main').innerHTML = treCarregando('Conferindo…');
  const { data, error } = await sb.rpc('treinamento_certificado', { p_codigo: cod || '' });
  const ok = !error && data?.status === 'ok';
  $('#main').innerHTML = `${treTopo('Conferir certificado', '')}${treNav('certificados')}
    ${ok ? `<div class="card tre-verif-cert ${data.em_dia ? 'ok' : ''}">
        <span class="eyebrow">${data.em_dia ? 'Certificado válido' : 'Certificado da equipe'}</span>
        <h2>${esc(data.nome)}</h2>
        <p>concluiu <b>${esc(data.titulo)}</b> (${esc(data.codigo)} · Rev. ${esc(data.revisao)}) em ${esc(treDataLonga(data.concluido_em))}.</p>
        <div class="dl" style="margin-top:14px">
          <div class="it"><dt>Código</dt><dd class="mono">${esc(data.certificado)}</dd></div>
          <div class="it"><dt>Carga horária</dt><dd>${esc(treDuracao(data.carga_horaria_min)) || '—'}</dd></div>
          <div class="it"><dt>Nota</dt><dd>${data.nota != null ? data.nota + '%' : '—'}</dd></div>
          <div class="it"><dt>Situação hoje</dt><dd>${data.em_dia ? 'Em dia' + (data.vence_em ? ' até ' + fmtD(data.vence_em) : '')
            : data.revisao_atual && data.revisao_atual !== data.revisao ? `Refeito o treinamento? A revisão atual é a ${esc(data.revisao_atual)}.` : 'Vencido'}</dd></div>
        </div></div>`
      : `<div class="aviso-box err"><b>Nenhum certificado com o código ${esc(cod || '')}.</b> Confira as letras e os números — o código tem o formato CERT-XXXX-XXXX.</div>`}`;
}

/* ============================================================
   O TREINAMENTO — o programa e onde você está
   ============================================================ */
async function treCarregarAtual(cod, forcar){
  if (!forcar && treino.atual?.treinamento?.codigo === cod) return true;
  const { data, error } = await sb.rpc('treinamento_conteudo', { p_codigo: cod });
  if (error){ treino.erro = error; return false; }
  if (data?.status !== 'ok'){ treino.atual = null; return null; }
  treino.atual = data;
  return true;
}
function treModInfo(m){
  const corpo = String(m.corpo || '');
  const v = (corpo.match(/```\s*(video|youtube)\b/gi) || []).length;
  const q = m.verificacao?.questoes?.length || 0;
  return { v, q };
}
async function treTreinamento(cod){
  $('#main').innerHTML = treCarregando();
  const r = await treCarregarAtual(cod, true);
  if (r === false) return treFaltaBanco(treino.erro);
  if (r === null) return treNaoAchou(cod);
  const a = treino.atual, t = a.treinamento, mods = a.modulos || [], feitos = new Set(a.feitos || []);
  const s = a.situacao, prox = mods.findIndex(m => !feitos.has(m.id));
  const nota = t.nota_minima;
  let faixa = '';
  if (a.conclusao && s === 'concluido') faixa = `<div class="tre-faixa ok"><span class="ic">${ic('check')}</span><div class="tx">
      <b>Concluído em ${esc(treDataLonga(a.conclusao.concluido_em))}</b> · Rev. ${esc(a.conclusao.revisao)}${a.conclusao.nota != null ? ` · nota ${a.conclusao.nota}%` : ''}
      ${a.conclusao.vence_em ? `<span class="small muted"> · vale até ${fmtD(a.conclusao.vence_em)}</span>` : ''}</div>
      <button class="btn solid mini" onclick="treBaixarCertificado('${esc(a.conclusao.certificado)}', this)">${ic('down')} Certificado</button></div>`;
  else if (s === 'vencido') faixa = `<div class="tre-faixa bad"><div class="tx"><b>Venceu${a.conclusao?.vence_em ? ' em ' + fmtD(a.conclusao.vence_em) : ''}.</b>
      Este treinamento vale ${t.validade_meses} ${t.validade_meses === 1 ? 'mês' : 'meses'}: para ficar em dia, refaça os módulos. O certificado de antes continua no seu perfil.</div>
      <button class="btn solid mini" onclick="treRecomecar()">${ic('refazer')} Refazer</button></div>`;
  else if (s === 'nova_revisao') faixa = `<div class="tre-faixa warn"><div class="tx"><b>A Rev. ${esc(t.revisao)} pede que todos refaçam.</b>
      ${t.notas_revisao ? esc(t.notas_revisao) : ''} O certificado da Rev. ${esc(a.conclusao?.revisao || '')} continua no seu perfil.</div></div>`;
  $('#main').innerHTML = `<div class="tre-hero">
      <div class="tre-hero-tx">
        <a class="tre-voltar" href="#/treinamentos">${ic('back')} Treinamentos</a>
        <span class="eyebrow">${esc(t.codigo)} · Rev. ${esc(t.revisao)}${t.categoria ? ' · ' + esc(t.categoria) : ''}</span>
        <h1>${esc(t.titulo)}</h1>
        ${t.resumo ? `<p class="lead">${esc(t.resumo)}</p>` : ''}
        <div class="tre-hero-tags">${trePill(s)} ${treObrig(a.obrigatorio)}</div>
      </div>
      <dl class="tre-ficha">
        <div><dt>Módulos</dt><dd>${mods.length}</dd></div>
        ${t.carga_horaria_min ? `<div><dt>Carga horária</dt><dd>${esc(treDuracao(t.carga_horaria_min))}</dd></div>` : ''}
        ${mods.some(m => m.verificacao) ? `<div><dt>Para passar</dt><dd>${nota}% em cada verificação</dd></div>` : ''}
        ${t.validade_meses ? `<div><dt>Validade</dt><dd>${t.validade_meses} ${t.validade_meses === 1 ? 'mês' : 'meses'}</dd></div>` : ''}
        ${t.responsavel_nome ? `<div><dt>Responsável</dt><dd>${esc(t.responsavel_nome)}</dd></div>` : ''}
        <div><dt>Publicado</dt><dd>${fmtD(t.publicado_em)}</dd></div>
      </dl>
    </div>
    ${faixa}
    ${gereTreinamentos() ? `<div class="tre-gere"><span class="small muted">Você gere este treinamento.</span>
      <a class="btn ghost mini" href="#/treinamentos/${esc(t.codigo)}/editar">${ic('pencil')} Editar</a>
      <a class="btn ghost mini" href="#/treinamentos/${esc(t.codigo)}/acompanhamento">${ic('users')} Acompanhamento</a></div>` : ''}
    <section class="tre-programa card">
      <div class="tre-programa-hd"><h2>Programa</h2>
        <span class="small muted">${feitos.size} de ${mods.length} módulos concluídos</span></div>
      <div class="tre-prog grande"><i style="width:${mods.length ? Math.round(100 * feitos.size / mods.length) : 0}%"></i></div>
      <ol class="tre-mods">${mods.map((m, i) => { const x = treModInfo(m), f = feitos.has(m.id);
        return `<li class="${f ? 'feito' : ''}${i === prox ? ' prox' : ''}"><a href="#/treinamentos/${esc(t.codigo)}/${i + 1}">
          <span class="n">${f ? ic('check') : String(i + 1).padStart(2, '0')}</span>
          <span class="tt">${esc(m.titulo)}</span>
          <span class="tags">${x.v ? `<span class="tag-mini">${x.v === 1 ? 'vídeo' : x.v + ' vídeos'}</span>` : ''}
            ${x.q ? `<span class="tag-mini">verificação · ${x.q}</span>` : ''}</span></a></li>`; }).join('')}</ol>
      <div class="acts">${s !== 'vencido' ? `<a class="btn solid" href="#/treinamentos/${esc(t.codigo)}/${prox >= 0 ? prox + 1 : 1}">
        ${prox < 0 ? 'Rever do começo' : feitos.size ? 'Continuar do módulo ' + (prox + 1) : 'Começar'} →</a>` : ''}
        ${s === 'concluido' ? `<button class="btn ghost" onclick="treRecomecar()">${ic('refazer')} Refazer do zero</button>` : ''}</div>
    </section>
    ${t.notas_revisao && t.revisao !== 'A' ? `<p class="small muted tre-notas-rev">O que mudou na Rev. ${esc(t.revisao)}: ${esc(t.notas_revisao)}</p>` : ''}`;
}
async function treRecomecar(){
  const t = treino.atual?.treinamento; if (!t) return;
  if (!treEu()) return toast(MOTIVO_RPC.sem_registro, true);
  if (!await confirma(`Recomeçar <b>${esc(t.titulo)}</b> do zero? Os módulos voltam a ficar por fazer. Os certificados que você já tem continuam no seu perfil.`, 'Recomeçar')) return;
  const { data, error } = await sb.rpc('treinamento_recomecar', { p_id: t.id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para recomeçar'), true);
  treino.lista = null;
  location.hash = `#/treinamentos/${t.codigo}/1`;
}

/* ============================================================
   UM MÓDULO — o corpo, os links e a verificação
   ============================================================ */
async function treModulo(cod, n){
  if (treino.atual?.treinamento?.codigo !== cod) $('#main').innerHTML = treCarregando();
  const r = await treCarregarAtual(cod);
  if (r === false) return treFaltaBanco(treino.erro);
  if (r === null) return treNaoAchou(cod);
  const a = treino.atual, t = a.treinamento, mods = a.modulos || [];
  if (n < 1 || n > mods.length){ history.replaceState(null, '', `#/treinamentos/${cod}`); return treTreinamento(cod); }
  const m = mods[n - 1], feitos = new Set(a.feitos || []), feito = feitos.has(m.id);
  const res = a.respostas?.[m.id];
  treino.vf = {};
  const ctx = { videos:0 };
  const qs = m.verificacao?.questoes || [];
  $('#main').innerHTML = `<div class="tre-player">
    <aside class="tre-lado">
      <a class="tre-voltar" href="#/treinamentos/${esc(t.codigo)}">${ic('back')} ${esc(t.codigo)}</a>
      <div class="tre-lado-tt">${esc(t.titulo)}</div>
      <div class="tre-prog"><i style="width:${Math.round(100 * feitos.size / mods.length)}%"></i></div>
      <span class="small muted">${feitos.size} de ${mods.length} módulos</span>
      <ol class="tre-mods mini">${mods.map((x, i) => `<li class="${feitos.has(x.id) ? 'feito' : ''}${i === n - 1 ? ' atual' : ''}">
        <a href="#/treinamentos/${esc(t.codigo)}/${i + 1}"${i === n - 1 ? ' aria-current="page"' : ''}><span class="n">${feitos.has(x.id) ? ic('check') : String(i + 1).padStart(2, '0')}</span>
        <span class="tt">${esc(x.titulo)}</span></a></li>`).join('')}</ol>
    </aside>
    <article class="tre-conteudo">
      ${a.situacao === 'vencido' ? `<div class="aviso-box warn">Este treinamento venceu: o que você fizer agora não renova o certificado.
        Para ficar em dia, <button class="tre-a" style="font:inherit" onclick="treRecomecar()">recomece do zero</button>.</div>` : ''}
      <span class="eyebrow">Módulo ${String(n).padStart(2, '0')} de ${String(mods.length).padStart(2, '0')}${feito ? ' · concluído' : ''}</span>
      <h1>${esc(m.titulo)}</h1>
      <div class="tre-md">${treMd(m.corpo, ctx)}</div>
      ${(m.links || []).length ? `<section class="tre-links"><h2>Links relacionados</h2><div class="doc-grid">${m.links.map(treLinkCartao).join('')}</div></section>` : ''}
      ${qs.length ? treVerificacaoHTML(m, qs, res, t) : `<div class="tre-concluir">
        ${feito ? `<span class="tre-ok">${ic('check')} Módulo concluído</span>` : ''}
        ${!feito ? `<button class="btn solid" onclick="treConcluirModulo()">${ic('check')} Concluir o módulo${n < mods.length ? ' e seguir' : ''}</button>` : ''}</div>`}
      <nav class="tre-passos">
        ${n > 1 ? `<a class="btn ghost" href="#/treinamentos/${esc(t.codigo)}/${n - 1}" title="${esc(mods[n - 2].titulo)}"><span>← ${esc(mods[n - 2].titulo)}</span></a>` : '<span></span>'}
        ${n < mods.length ? `<a class="btn ghost" href="#/treinamentos/${esc(t.codigo)}/${n + 1}" title="${esc(mods[n].titulo)}"><span>${esc(mods[n].titulo)} →</span></a>`
          : `<a class="btn ghost" href="#/treinamentos/${esc(t.codigo)}"><span>Programa →</span></a>`}</nav>
    </article></div>`;
  treino.modAtual = { n, id:m.id };
}
function treLinkCartao(k){
  const h = treHref(k.url);
  const ext = h?.tipo === 'externo';
  const onde = !h ? 'link que o portal não abre' : h.tipo === 'arquivo' ? `${h.codigo} · Arquivos →` : h.tipo === 'treinamento' ? `${h.codigo} · Treinamentos →`
    : h.tipo === 'portal' ? 'No portal →' : (() => { try { return new URL(h.href).hostname.replace(/^www\./, '') + ' ↗'; } catch(e){ return 'Abrir ↗'; } })();
  return `<a class="doc" href="${esc(h?.href || '#')}"${ext ? ' target="_blank" rel="noopener"' : ''}>
    <span class="ic">${IC_DOC}</span><span class="tx"><span class="tt">${esc(k.titulo || k.url)}</span>
    ${k.descricao ? `<span class="ds" style="display:block">${esc(k.descricao)}</span>` : ''}<span class="go">${esc(onde)}</span></span></a>`;
}
function treVerificacaoHTML(m, qs, res, t){
  const ja = res?.aprovado;
  return `<section class="tre-verif card" id="tre-verif">
    <div class="tre-verif-hd"><span class="eyebrow">Verificação de conhecimento</span>
      <h2>${qs.length} ${qs.length === 1 ? 'questão' : 'questões'}</h2>
      <p class="small muted">${ja ? `Você já passou nesta verificação (melhor nota: ${res.melhor_nota}%). Pode refazer, se quiser — a nota que vale é a melhor.`
        : `Para concluir o módulo, acerte pelo menos ${t.nota_minima}%. Cada questão vale um ponto, e só conta inteira. Dá para tentar de novo quantas vezes precisar.`}</p></div>
    <ol class="tre-qs">${qs.map((q, j) => `<li class="tre-q" data-q="${esc(q.id)}">
      <div class="tre-q-en"><span class="n">${String(j + 1).padStart(2, '0')}</span><div>${treInline(q.enunciado).replace(/\n/g, '<br>')}
        <span class="tre-q-dica">${TRE_TIPOS[q.tipo]?.dica || ''}</span></div></div>
      <div class="tre-ops">${q.tipo === 'vf'
        ? (q.opcoes || []).map(o => `<div class="tre-vf" data-o="${esc(o.id)}"><span class="tx">${treInline(o.texto)}</span>
            <span class="seg" role="group" aria-label="Verdadeiro ou falso">
              <button type="button" data-v="1" onclick="treVF(this)">V</button>
              <button type="button" data-v="0" onclick="treVF(this)">F</button></span></div>`).join('')
        : (q.opcoes || []).map(o => `<label class="tre-op" data-o="${esc(o.id)}"><input type="${q.tipo === 'multipla' ? 'checkbox' : 'radio'}"
            name="tre-${esc(q.id)}" value="${esc(o.id)}"><span>${treInline(o.texto)}</span></label>`).join('')}</div>
      <div class="tre-q-exp" hidden></div></li>`).join('')}</ol>
    <div class="acts"><button class="btn solid" id="tre-enviar" onclick="treEnviar()">${ic('enviar')} Enviar respostas</button>
      <span class="tre-res" id="tre-res" role="status"></span></div></section>`;
}
/* os ids vêm de data-*, nunca de dentro do onclick: um id escrito à mão
   não vira código na tela de quem faz o treinamento */
function treVF(bt){
  const q = bt.closest('.tre-q').dataset.q, o = bt.closest('.tre-vf').dataset.o, v = bt.dataset.v === '1';
  (treino.vf[q] ||= {})[o] = v;
  bt.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === bt));
}
function treRespostas(){
  const out = {};
  document.querySelectorAll('#tre-verif .tre-q').forEach(li => {
    const q = li.dataset.q;
    if (li.querySelector('.tre-vf')) out[q] = { ...(treino.vf[q] || {}) };
    else out[q] = [...li.querySelectorAll('input:checked')].map(i => i.value);
  });
  return out;
}
async function treEnviar(){
  const a = treino.atual, t = a.treinamento, mid = treino.modAtual?.id;
  if (!treEu()) return toast(MOTIVO_RPC.sem_registro, true);
  const resp = treRespostas();
  const faltam = Object.entries(resp).filter(([, v]) => Array.isArray(v) ? !v.length : false).length
    + [...document.querySelectorAll('#tre-verif .tre-vf')].filter(el => treino.vf[el.closest('.tre-q').dataset.q]?.[el.dataset.o] === undefined).length;
  if (faltam && !await confirma(`Há ${faltam === 1 ? 'uma resposta' : faltam + ' respostas'} em branco — em branco conta como errada. Enviar assim mesmo?`, 'Enviar')) return;
  const bt = $('#tre-enviar'); if (bt) bt.disabled = true;
  const { data, error } = await sb.rpc('treinamento_responder', { p_id: t.id, p_modulo: mid, p_respostas: resp });
  if (bt) bt.disabled = false;
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para enviar as respostas'), true);
  const erradas = new Set(data.erradas || []);
  document.querySelectorAll('#tre-verif .tre-q').forEach(li => {
    const q = li.dataset.q, g = data.gabarito?.[q];
    li.classList.toggle('errada', erradas.has(q));
    li.classList.toggle('certa', !!data.aprovado && !erradas.has(q));
    li.querySelectorAll('.tre-op, .tre-vf').forEach(el => el.classList.remove('e-certa', 'e-errada'));
    if (g){
      if (g.corretas) li.querySelectorAll('.tre-op').forEach(el => {
        const c = g.corretas.includes(el.dataset.o), marc = el.querySelector('input').checked;
        el.classList.toggle('e-certa', c); el.classList.toggle('e-errada', marc && !c); });
      if (g.vf) li.querySelectorAll('.tre-vf').forEach(el => {
        const c = g.vf[el.dataset.o]; el.classList.add(treino.vf[q]?.[el.dataset.o] === c ? 'e-certa' : 'e-errada');
        el.querySelector('.seg').dataset.certa = c ? 'V' : 'F'; });
      const ex = li.querySelector('.tre-q-exp');
      if (g.explicacao){ ex.innerHTML = `<b>Por quê:</b> ${treInline(g.explicacao)}`; ex.hidden = false; }
    }
  });
  const el = $('#tre-res');
  el.className = 'tre-res ' + (data.aprovado ? 'ok' : 'bad');
  el.innerHTML = data.aprovado
    ? `<b>Aprovado com ${data.nota}%</b> · ${data.acertos} de ${data.total}.`
    : `<b>${data.acertos} de ${data.total} (${data.nota}%)</b> — a mínima é ${data.nota_minima}%. As questões marcadas estão erradas: reveja o módulo e tente de novo.`;
  a.feitos = data.feitos || a.feitos;
  a.situacao = data.situacao;
  (a.respostas ||= {})[mid] = { ...(a.respostas[mid] || {}), aprovado: data.aprovado || a.respostas[mid]?.aprovado,
    melhor_nota: Math.max(data.nota, a.respostas[mid]?.melhor_nota || 0) };
  treino.lista = null;
  if (data.aprovado) treAtualizarLado();
  if (data.certificado && data.situacao === 'concluido') treParabens(data.certificado);
  else if (data.aprovado) treSeguir();
}
async function treConcluirModulo(){
  const a = treino.atual, t = a.treinamento, mid = treino.modAtual?.id;
  if (!treEu()) return toast(MOTIVO_RPC.sem_registro, true);
  const { data, error } = await sb.rpc('treinamento_concluir_modulo', { p_id: t.id, p_modulo: mid });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para concluir o módulo'), true);
  a.feitos = data.feitos || a.feitos; a.situacao = data.situacao; treino.lista = null;
  if (data.certificado && data.situacao === 'concluido') return treParabens(data.certificado);
  const n = treino.modAtual.n;
  let prox = a.modulos.findIndex((m, i) => i >= n && !a.feitos.includes(m.id));
  if (prox < 0) prox = a.modulos.findIndex(m => !a.feitos.includes(m.id));
  if (prox < 0 || prox === n - 1) return treModulo(t.codigo, n);
  location.hash = `#/treinamentos/${t.codigo}/${prox + 1}`;
}
function treAtualizarLado(){
  const a = treino.atual, f = new Set(a.feitos || []);
  document.querySelectorAll('.tre-lado .tre-mods li').forEach((li, i) => {
    const feito = f.has(a.modulos[i]?.id);
    li.classList.toggle('feito', feito);
    if (feito) li.querySelector('.n').innerHTML = ic('check');
  });
  const pct = Math.round(100 * f.size / a.modulos.length);
  const b = document.querySelector('.tre-lado .tre-prog i'); if (b) b.style.width = pct + '%';
}
function treSeguir(){
  const a = treino.atual, n = treino.modAtual.n, t = a.treinamento;
  let prox = a.modulos.findIndex((m, i) => i >= n && !(a.feitos || []).includes(m.id));
  if (prox < 0) prox = a.modulos.findIndex(m => !(a.feitos || []).includes(m.id));
  const acts = $('#tre-verif .acts');
  if (acts && prox >= 0 && !acts.querySelector('.tre-prox'))
    acts.insertAdjacentHTML('beforeend', `<a class="btn ghost tre-prox" href="#/treinamentos/${esc(t.codigo)}/${prox + 1}">Próximo módulo →</a>`);
}
function treParabens(cert){
  const t = treino.atual.treinamento;
  abreModal(`<div class="tre-parabens"><div class="tre-selo">${ic('capelo')}</div>
    <span class="eyebrow">Treinamento concluído</span>
    <h3>${esc(t.titulo)}</h3>
    <p class="small muted">${esc(t.codigo)} · Rev. ${esc(t.revisao)}. A conclusão ficou registrada no seu perfil, e o certificado está pronto.</p>
    <p class="mono small" style="margin-top:10px">${esc(cert)}</p>
    <div class="acts" style="justify-content:center">
      <button class="btn ghost" onclick="fechaModal();location.hash='#/treinamentos'">Voltar aos treinamentos</button>
      <button class="btn solid" onclick="treBaixarCertificado('${esc(cert)}', this)">${ic('down')} Baixar o certificado</button></div></div>`);
  treAtualizarLado();
}

/* ============================================================
   GESTÃO — todos os treinamentos, com rascunhos e arquivados
   ============================================================ */
const TRE_ST_TREIN = { rascunho:['Rascunho', 'dt-gray', ''], publicado:['Publicado', 'dt-ok', 'p-ok'], arquivado:['Arquivado', 'dt-gray', ''] };
async function treGestao(){
  $('#main').innerHTML = treCarregando();
  const [t, a, c, r] = await Promise.all([
    sb.from('treinamentos').select('id,numero,codigo,titulo,categoria,status,revisao_atual,responsavel,atualizado_em').order('numero'),
    sb.from('treinamento_atribuicoes').select('treinamento_id,grupo_id,obrigatorio'),
    sb.from('treinamento_conclusoes').select('treinamento_id,registro'),
    sb.from('treinamento_revisoes').select('treinamento_id,status,atualizado_em')]);
  if (t.error) return treFaltaBanco(t.error);
  treino.gestao = { lista:t.data || [], atr:a.data || [], concl:c.data || [], revs:r.data || [], filtro: treino.gestao?.filtro || '' };
  if (!treino.lista) treCarregarLista();
  treGestaoDesenhar();
}
function treGestaoDesenhar(){
  const G = treino.gestao, f = G.filtro;
  const vis = G.lista.filter(t => !f || (f === 'rascunho' ? (t.status === 'rascunho' || G.revs.some(r => r.treinamento_id === t.id && r.status === 'rascunho')) : t.status === f));
  const atrib = t => G.atr.filter(a => a.treinamento_id === t.id).map(a => `<span class="chip mini${a.obrigatorio ? ' tem' : ''}" title="${a.obrigatorio ? 'Obrigatório' : 'Opcional'}">${esc(a.grupo_id == null ? 'Toda a equipe' : grupoPorId(a.grupo_id)?.nome || 'grupo ' + a.grupo_id)}</span>`).join(' ');
  const cont = st => G.lista.filter(t => t.status === st).length;
  $('#main').innerHTML = `${treTopo('Configurações', '',
      `<a class="btn solid mini" href="#/treinamentos/novo">${ic('plus')} Novo treinamento</a>`)}
    ${treNav('config')}${treNavConfig('')}
    <div class="filtros"><div class="seg" role="group" aria-label="Situação">
      ${[['', 'Todos', G.lista.length], ['publicado', 'Publicados', cont('publicado')], ['rascunho', 'Com rascunho', null], ['arquivado', 'Arquivados', cont('arquivado')]].map(([k, l, n]) =>
        `<button class="${f === k ? 'on' : ''}" onclick="treino.gestao.filtro='${k}';treGestaoDesenhar()">${l}${n != null ? ` (${n})` : ''}</button>`).join('')}</div></div>
    ${vis.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Código</th><th>Título</th><th>Situação</th><th>Revisão</th>
        <th>Atribuído a</th><th class="num">Concluíram</th><th>Atualizado</th><th></th></tr></thead><tbody>
      ${vis.map(t => { const [l, dt, p] = TRE_ST_TREIN[t.status] || ['—', 'dt-gray', ''];
        const rasc = G.revs.some(r => r.treinamento_id === t.id && r.status === 'rascunho') && t.revisao_atual;
        return `<tr class="click" tabindex="0" onclick="location.hash='#/treinamentos/${esc(t.codigo)}/editar'"
            onkeydown="if(event.key==='Enter')this.click()">
          <td class="reg">${esc(t.codigo)}</td><td class="nome">${esc(t.titulo)}</td>
          <td><span class="pill ${p}"><span class="dt ${dt}"></span>${l}</span>${rasc ? ' <span class="tag-mini">rascunho aberto</span>' : ''}</td>
          <td class="mono">${t.revisao_atual ? 'Rev. ' + esc(t.revisao_atual) : '—'}</td>
          <td style="white-space:normal">${atrib(t) || '<span class="dim small">ninguém ainda</span>'}</td>
          <td class="num">${new Set(G.concl.filter(c => c.treinamento_id === t.id).map(c => c.registro)).size}</td>
          <td class="small muted">${fmtD(t.atualizado_em)}</td>
          <td onclick="event.stopPropagation()">${t.revisao_atual ? `<a class="btn ghost mini" href="#/treinamentos/${esc(t.codigo)}/acompanhamento">Acompanhamento</a>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>`
      : `<div class="vazio"><div class="glyph">+</div><h3>${G.lista.length ? 'Nenhum treinamento com esse filtro' : 'Nenhum treinamento ainda'}</h3>
        <p>${G.lista.length ? '' : 'Comece do zero ou de um texto escrito por um agente de IA, seguindo o README de conteúdo.'}</p>
        <a class="btn solid" href="#/treinamentos/novo">${ic('plus')} Novo treinamento</a></div>`}`;
}

/* ============================================================
   NOVO — do zero, ou de um texto
   ============================================================ */
function treNovo(){
  treino.ed = null; _treImp = null;
  $('#main').innerHTML = `${treTopo('Novo treinamento', 'O código sai sozinho (o seguinte ao último) — ou escolha o número, se o treinamento já tinha código fora do portal. A revisão começa na A, ao publicar.')}
    ${treNav('config')}
    <div class="tre-novo">
      <div class="card"><h3>Do zero</h3>
        <div class="form-grid" style="margin-top:14px">
          <div class="fld full"><label for="tn-titulo">Título</label><input id="tn-titulo" placeholder="Ex.: Agenda no SOMA"></div>
          <div class="fld"><label for="tn-numero">Número (opcional)</label><input id="tn-numero" type="number" min="1" placeholder="o seguinte"><p class="mini">NRO-TRE-<span id="tn-cod">…</span></p></div>
          <div class="fld"><label for="tn-cat">Categoria</label><input id="tn-cat" list="tre-cats" placeholder="Sistemas, Laboratório…"></div>
          <div class="fld"><label for="tn-carga">Carga horária (min)</label><input id="tn-carga" type="number" min="1" placeholder="30"></div>
          <div class="fld full"><label for="tn-resumo">Resumo</label><textarea id="tn-resumo" rows="2" placeholder="O que a pessoa vai saber fazer ao terminar."></textarea></div>
        </div>${treDatalistCats()}
        <div class="acts"><button class="btn solid" onclick="treCriar(false)">${ic('plus')} Criar e abrir o editor</button></div></div>
      <div class="card"><h3>De um texto</h3>
        <p class="small muted" style="margin:6px 0 12px;line-height:1.6">Peça o treinamento a um agente de IA com o <b>README</b> e o <b>pedido-modelo</b>,
          e cole aqui o que ele devolver. O portal lê os módulos, os vídeos, os links e as questões, e mostra o que precisar de conserto antes de criar.</p>
        <div class="tre-imp-passos">
          <button class="btn ghost mini" onclick="treBaixarReadme(true)">${ic('down')} README</button>
          <button class="btn ghost mini" onclick="copiar(TRE_PEDIDO_MODELO)">${ic('copy')} Pedido-modelo</button>
          <label class="btn ghost mini">${ic('doc')} Abrir arquivo .md<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onchange="treImpArquivo(this)"></label></div>
        <div class="fld"><label for="tre-imp-txt">O texto</label><textarea id="tre-imp-txt" rows="10" class="mono tre-imp-txt" oninput="treImpLer()"
          placeholder="---&#10;titulo: …&#10;resumo: …&#10;---&#10;&#10;# Primeiro módulo&#10;…"></textarea></div>
        <div id="tre-imp-previa"></div>
        <div class="acts"><button class="btn solid" id="tre-imp-ok" disabled onclick="treCriar(true)">${ic('subir')} Criar com este texto</button></div></div>
    </div>`;
  const ult = Math.max(0, ...(treino.gestao?.lista || []).map(t => t.numero || 0));
  $('#tn-cod').textContent = ult ? String(ult + 1).padStart(3, '0') : '…';
  $('#tn-numero').oninput = e => { $('#tn-cod').textContent = e.target.value ? String(+e.target.value).padStart(3, '0') : (ult ? String(ult + 1).padStart(3, '0') : '…'); };
  $('#tn-titulo').focus();
}
const treDatalistCats = () => `<datalist id="tre-cats">${TRE_CATEGORIAS.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`;
async function treCriar(deTexto){
  const v = id => $(id)?.value.trim() || '';
  const p = {};
  let conteudo = null;
  if (deTexto){
    const r = treImpUltimo();
    if (!r?.conteudo.modulos.length) return toast('O texto não tem nenhum módulo ("# Título do módulo").', true);
    Object.assign(p, r.meta); delete p.codigo;
    conteudo = r.conteudo;
  } else {
    if (!v('#tn-titulo')) return toast('Dê um título ao treinamento.', true);
    Object.assign(p, { titulo:v('#tn-titulo'), categoria:v('#tn-cat'), resumo:v('#tn-resumo'), carga_horaria_min:v('#tn-carga') });
    if (v('#tn-numero')) p.numero = v('#tn-numero');
  }
  if (!p.titulo) return toast('O texto não trouxe título: ponha "titulo:" no cabeçalho, entre as linhas ---.', true);
  if (conteudo) p.conteudo = conteudo;
  const { data, error } = await sb.rpc('treinamento_salvar', { p });
  if (error || data?.status !== 'ok') return toast(data?.status === 'duplicado' ? 'Já existe um treinamento com esse número.' : motivoRPC(data, error, 'Não deu para criar'), true);
  toast(`${data.codigo} criado, em rascunho.`);
  treino.gestao = null;
  location.hash = `#/treinamentos/${data.codigo}/editar`;
}

/* ---------------- importar um texto ---------------- */
let _treImp = null;
const treImpUltimo = () => _treImp;
function treImpArquivo(inp){
  const f = inp.files?.[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => { $('#tre-imp-txt').value = String(r.result || ''); treImpLer(); };
  r.readAsText(f, 'utf-8');
}
function treImpLer(){
  const txt = $('#tre-imp-txt')?.value || '';
  const el = $('#tre-imp-previa'), ok = $('#tre-imp-ok');
  if (!txt.trim()){ _treImp = null; if (el) el.innerHTML = ''; if (ok) ok.disabled = true; return; }
  _treImp = treLerTexto(txt, treino.ed?.conteudo?.modulos);
  if (el) el.innerHTML = treImpPreviaHTML(_treImp);
  if (ok) ok.disabled = !_treImp.conteudo.modulos.length;
}
function treImpPreviaHTML(r){
  const ms = r.conteudo.modulos;
  const nq = ms.reduce((s, m) => s + (m.verificacao?.questoes?.length || 0), 0);
  const nv = ms.reduce((s, m) => s + treModInfo(m).v, 0);
  const probs = [...new Set([...r.avisos, ...treProblemas(r.conteudo).filter(p => !r.avisos.includes(p))])];
  return `<div class="tre-imp-res">
    <div class="tre-imp-cab"><b>${esc(r.meta.titulo || 'Sem título no cabeçalho')}</b>
      <span class="small muted">${ms.length} ${ms.length === 1 ? 'módulo' : 'módulos'} · ${nv} ${nv === 1 ? 'vídeo' : 'vídeos'} · ${nq} ${nq === 1 ? 'questão' : 'questões'}${r.meta.carga_horaria_min ? ' · ' + esc(treDuracao(r.meta.carga_horaria_min)) : ''}</span></div>
    ${ms.length ? `<ol class="tre-imp-mods">${ms.map(m => `<li>${esc(m.titulo || '(sem título)')}${m.verificacao ? ` <span class="tag-mini">${m.verificacao.questoes.length} q.</span>` : ''}</li>`).join('')}</ol>` : ''}
    ${probs.length ? `<div class="aviso-box warn"><b>${probs.length === 1 ? 'Um ponto' : probs.length + ' pontos'} para conferir</b> — dá para importar assim e consertar no editor; publicar, só depois:
      <ul>${probs.slice(0, 12).map(x => `<li>${esc(x)}</li>`).join('')}${probs.length > 12 ? `<li>e mais ${probs.length - 12}…</li>` : ''}</ul></div>`
      : ms.length ? '<div class="aviso-box lima">Tudo certo: o texto segue o formato do README.</div>' : ''}</div>`;
}

/* ============================================================
   O EDITOR — o rascunho de uma revisão
   Os dados (título, resumo, carga, nota, validade, responsável)
   valem na hora; o conteúdo (os módulos) mora no rascunho e só vale
   ao publicar. Grava sozinho, dois segundos e meio depois da última
   mudança.
   ============================================================ */
const treRevOrd = r => !r ? 0 : [...r].reduce((s, c) => s * 26 + (c.charCodeAt(0) - 64), 0);
function treRevLetra(n){ let s = ''; while (n > 0){ n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; }
const treProxLetra = () => treRevLetra(Math.max(treRevOrd(treino.ed.t.revisao_atual),
  ...treino.ed.revs.map(r => treRevOrd(r.revisao))) + 1);
function treMetaDe(t){
  return { titulo:t.titulo || '', resumo:t.resumo || '', categoria:t.categoria || '',
    carga_horaria_min:t.carga_horaria_min ?? '', nota_minima:t.nota_minima ?? '', validade_meses:t.validade_meses ?? '',
    responsavel:t.responsavel ?? '' };
}
async function treEditor(cod){
  $('#main').innerHTML = treCarregando('Abrindo o editor…');
  const { data:t, error } = await sb.from('treinamentos').select('*').eq('codigo', cod).maybeSingle();
  if (error) return treFaltaBanco(error);
  if (!t) return treNaoAchou(cod);
  const [rv, at] = await Promise.all([
    sb.from('treinamento_revisoes').select('*').eq('treinamento_id', t.id).order('criado_em'),
    sb.from('treinamento_atribuicoes').select('grupo_id,obrigatorio').eq('treinamento_id', t.id)]);
  const revs = rv.data || [];
  const rasc = revs.find(r => r.status === 'rascunho') || null, pub = revs.find(r => r.status === 'publicada') || null;
  const conteudo = JSON.parse(JSON.stringify((rasc || pub)?.conteudo || { modulos:[] }));
  if (!Array.isArray(conteudo.modulos)) conteudo.modulos = [];
  const meta = treMetaDe(t);
  treino.ed = { t, revs, rasc, pub, conteudo, meta, metaOrig: JSON.stringify(treMetaPayload(meta)),
    notas: rasc?.notas || '', atrib: (at.data || []).map(a => ({ k: a.grupo_id == null ? 'todos' : String(a.grupo_id), obrigatorio: a.obrigatorio })),
    atribSujo:false, abertos: new Set(conteudo.modulos.length ? [conteudo.modulos[0].id] : []), vendo: new Set(),
    sujoM:false, sujoC:false, salvando:null, salvoEm: rasc?.atualizado_em || null };
  treEdDesenhar();
}
function treMetaPayload(m){
  const n = v => v === '' || v == null ? '' : String(parseInt(v, 10) || '');
  return { titulo:String(m.titulo || '').trim(), resumo:m.resumo || '', categoria:m.categoria || '',
    carga_horaria_min:n(m.carga_horaria_min), nota_minima:n(m.nota_minima), validade_meses:n(m.validade_meses), responsavel:n(m.responsavel) };
}
function treEdDesenhar(){
  const ed = treino.ed, t = ed.t, letra = treProxLetra();
  const estado = ed.rasc
    ? (t.revisao_atual ? `Rascunho da Rev. ${letra}. Quem faz o treinamento continua vendo a Rev. ${esc(t.revisao_atual)} até você publicar.`
                       : 'Rascunho — ainda não publicado: ninguém vê o treinamento até você publicar.')
    : `Rev. ${esc(t.revisao_atual)} publicada${t.status === 'arquivado' ? ' e arquivada' : ''}. Mudar o conteúdo abre o rascunho da Rev. ${letra}.`;
  $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">${esc(t.codigo)} · Editor</span>
      <h1 id="tre-ed-h1">${esc(ed.meta.titulo || 'Sem título')}</h1><p class="lead">${estado}</p></div>
      <div class="acoes">
        <button class="btn ghost mini" onclick="trePrevia(0)">${ic('eye')} Pré-visualizar</button>
        <button class="btn ghost mini" onclick="treImportarModal()">${ic('subir')} Importar texto</button>
        <button class="btn ghost mini" onclick="treExportar()">${ic('down')} Exportar</button>
        <button class="btn solid mini" onclick="treEdPublicarModal()">${ic('enviar')} Publicar a Rev. ${letra}</button></div></div>
    <div class="tre-ed-status" id="tre-ed-st" role="status"></div>
    <div class="tre-ed">
      <div class="tre-ed-main">
        <div id="tre-ed-mods">${treEdModsHTML()}</div>
        <button class="kb-add tre-ed-addmod" onclick="treEdAddModulo()">${ic('plus')} Módulo</button>
      </div>
      <aside class="tre-ed-lado">
        <div class="card"><h3>Dados</h3><p class="sub" style="margin-bottom:12px">Valem na hora, sem publicar</p>
          <div class="fld"><label for="te-titulo">Título</label><input id="te-titulo" value="${esc(ed.meta.titulo)}" oninput="treEdMeta('titulo',this.value)"></div>
          <div class="fld"><label for="te-resumo">Resumo</label><textarea id="te-resumo" rows="3" oninput="treEdMeta('resumo',this.value)">${esc(ed.meta.resumo)}</textarea></div>
          <div class="dupla">
            <div class="fld"><label for="te-cat">Categoria</label><input id="te-cat" list="tre-cats" value="${esc(ed.meta.categoria)}" oninput="treEdMeta('categoria',this.value)"></div>
            <div class="fld"><label for="te-carga">Carga (min)</label><input id="te-carga" type="number" min="1" value="${esc(ed.meta.carga_horaria_min)}" oninput="treEdMeta('carga_horaria_min',this.value)"></div>
            <div class="fld"><label for="te-nota">Nota mínima (%)</label><input id="te-nota" type="number" min="0" max="100" placeholder="${esc(treino.cfg?.nota_minima ?? state.treCfg?.nota_minima ?? 70)} (padrão)" value="${esc(ed.meta.nota_minima)}" oninput="treEdMeta('nota_minima',this.value)"></div>
            <div class="fld"><label for="te-val">Validade (meses)</label><input id="te-val" type="number" min="1" max="120" placeholder="não vence" value="${esc(ed.meta.validade_meses)}" oninput="treEdMeta('validade_meses',this.value)"></div>
          </div>
          <div class="fld"><label for="te-resp">Responsável</label><select id="te-resp" onchange="treEdMeta('responsavel',this.value)"><option value="">—</option>
            ${state.membros.filter(m => !['Desligado', 'Egresso'].includes(m.status) || m.registro === t.responsavel).map(m =>
              `<option value="${m.registro}"${String(m.registro) === String(ed.meta.responsavel) ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div>
          ${treDatalistCats()}</div>
        <div class="card" id="tre-ed-prob"></div>
        <div class="card" id="tre-ed-atr">${treEdAtribHTML()}</div>
        <div class="card"><h3>O que mudou</h3><p class="sub" style="margin-bottom:10px">Vai com a revisão, para quem faz o treinamento</p>
          <textarea rows="3" placeholder="${t.revisao_atual ? 'Ex.: a aba Agendar foi refeita; vídeo novo no módulo 2.' : 'Versão inicial.'}" oninput="treino.ed.notas=this.value;treEdSujo('c')">${esc(ed.notas)}</textarea></div>
        ${treEdRevisoesHTML()}
        <div class="card tre-ed-zona"><h3>Mais</h3>
          ${ed.rasc && t.revisao_atual ? `<button class="btn ghost mini" onclick="treEdDescartar()">${ic('x')} Descartar o rascunho</button>` : ''}
          ${t.revisao_atual ? `<button class="btn ghost mini" onclick="treEdArquivar(${t.status !== 'arquivado'})">${t.status === 'arquivado' ? 'Desarquivar' : 'Arquivar'}</button>` : ''}
          ${!t.revisao_atual ? `<button class="btn perigo mini" onclick="treEdExcluir()">${ic('trash')} Excluir o treinamento</button>` : ''}
          ${t.revisao_atual ? `<a class="btn ghost mini" href="#/treinamentos/${esc(t.codigo)}">Ver como quem faz</a>` : ''}</div>
      </aside>
    </div>`;
  treEdStatus(); treEdProblemasDesenhar();
}
function treEdRevisoesHTML(){
  const rs = treino.ed.revs.filter(r => r.revisao).sort((a, b) => treRevOrd(b.revisao) - treRevOrd(a.revisao));
  if (!rs.length) return '';
  return `<div class="card"><h3>Revisões</h3><div class="timeline" style="margin-top:10px">${rs.map(r => `<div class="tl-item">
    <div class="dt">Rev. ${esc(r.revisao)} · ${fmtD(r.publicado_em)}${r.status === 'publicada' ? ' · em vigor' : ''}</div>
    <div class="tp">${esc(r.publicado_nome || '—')}${r.exige_refazer && r.revisao !== 'A' ? ' · pediu que refizessem' : ''}</div>
    ${r.notas ? `<div class="ds">${esc(r.notas)}</div>` : ''}</div>`).join('')}</div></div>`;
}
function treEdStatus(){
  const el = $('#tre-ed-st'), ed = treino.ed; if (!el || !ed) return;
  el.className = 'tre-ed-status' + (ed.sujoM || ed.sujoC ? ' sujo' : '');
  el.textContent = ed.salvando ? 'Salvando…' : (ed.sujoM || ed.sujoC) ? 'Alterações por salvar'
    : ed.salvoEm ? `Rascunho salvo às ${new Date(ed.salvoEm).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}` : 'Nada por salvar';
}
function treEdSujo(qual){
  const ed = treino.ed; if (!ed) return;
  if (qual === 'm') ed.sujoM = true; else ed.sujoC = true;
  treEdStatus();
  clearTimeout(ed.timer); ed.timer = setTimeout(treEdSalvar, 2500);
  clearTimeout(ed.tp); ed.tp = setTimeout(treEdProblemasDesenhar, 350);
}
async function treEdSalvar(){
  const ed = treino.ed; if (!ed) return true;
  clearTimeout(ed.timer);
  if (ed.salvando){ ed.denovo = true; return ed.salvando; }
  if (!ed.sujoM && !ed.sujoC) return true;
  ed.salvando = (async () => {
    let ok = true;
    const meta = treMetaPayload(ed.meta), mj = JSON.stringify(meta);
    if (ed.sujoM){
      ed.sujoM = false;
      if (mj !== ed.metaOrig){
        if (!meta.titulo){ ok = false; ed.sujoM = true; toast('O treinamento precisa de título.', true); }
        else {
          const { data, error } = await sb.rpc('treinamento_salvar', { p: { id: ed.t.id, ...meta } });
          if (error || data?.status !== 'ok'){ ok = false; ed.sujoM = true; toast(motivoRPC(data, error, 'Não deu para salvar os dados'), true); }
          else { ed.metaOrig = mj; Object.assign(ed.t, { titulo:meta.titulo }); }
        }
      }
    }
    if (ed.sujoC){
      ed.sujoC = false;
      const { data, error } = await sb.rpc('treinamento_rascunho_salvar', { p_id: ed.t.id, p_conteudo: ed.conteudo, p_notas: ed.notas || '' });
      if (error || data?.status !== 'ok'){ ok = false; ed.sujoC = true; toast(motivoRPC(data, error, 'Não deu para salvar o rascunho'), true); }
      else if (!ed.rasc){ ed.rasc = { id: data.revisao_id, status:'rascunho' }; ed.revs.push(ed.rasc); treEdDesenharCabeca(); }
    }
    if (ok) ed.salvoEm = new Date().toISOString();
    return ok;
  })();
  treEdStatus();
  const r = await ed.salvando;
  ed.salvando = null; treEdStatus();
  if (ed.denovo){ ed.denovo = false; if (ed.sujoM || ed.sujoC) return treEdSalvar(); }
  return r;
}
/* o rascunho acabou de nascer: o topo passa a dizer "rascunho da Rev. X" */
function treEdDesenharCabeca(){
  const ed = treino.ed, lead = document.querySelector('.topo-gestao .lead');
  if (!ed || !$('#tre-ed-h1')) return;
  if (lead && ed.t.revisao_atual) lead.textContent = `Rascunho da Rev. ${treProxLetra()}. Quem faz o treinamento continua vendo a Rev. ${ed.t.revisao_atual} até você publicar.`;
}
function treEdMeta(k, v){
  treino.ed.meta[k] = v;
  if (k === 'titulo'){ const h = $('#tre-ed-h1'); if (h) h.textContent = v || 'Sem título'; }
  treEdSujo('m');
}
function treEdProblemasDesenhar(){
  const el = $('#tre-ed-prob'); if (!el) return;
  const p = treProblemas(treino.ed.conteudo);
  el.innerHTML = p.length
    ? `<h3>Para publicar <span class="tre-nprob">${p.length}</span></h3><ul class="tre-probs">${p.slice(0, 14).map(x => `<li>${esc(x)}</li>`).join('')}${p.length > 14 ? `<li>e mais ${p.length - 14}…</li>` : ''}</ul>`
    : '<h3>Para publicar</h3><p class="small tre-pronto">' + ic('check') + ' Nada impede: o conteúdo está completo.</p>';
}

/* ---------------- os módulos ---------------- */
const treEdM = i => treino.ed.conteudo.modulos[i];
const treP2 = n => String(n).padStart(2, '0');
function treEdModsHTML(){
  const ms = treino.ed.conteudo.modulos;
  if (!ms.length) return `<div class="vazio"><h3>Nenhum módulo ainda</h3><p>Escreva o primeiro, ou importe o texto que um agente de IA escreveu seguindo o README.</p>
    <div class="acts" style="justify-content:center"><button class="btn ghost" onclick="treImportarModal()">${ic('subir')} Importar texto</button>
    <button class="btn solid" onclick="treEdAddModulo()">${ic('plus')} Primeiro módulo</button></div></div>`;
  return ms.map(treEdModHTML).join('');
}
function treEdRedesenharMods(){ const el = $('#tre-ed-mods'); if (el) el.innerHTML = treEdModsHTML(); }
function treEdModHTML(m, i){
  const ed = treino.ed, aberto = ed.abertos.has(m.id), vendo = ed.vendo.has(m.id), n = ed.conteudo.modulos.length;
  const x = treModInfo(m);
  return `<div class="tre-ed-mod card${aberto ? ' aberto' : ''}" data-i="${i}">
    <div class="tre-ed-mod-hd">
      <button class="tre-ed-abre" onclick="treEdAlterna(${i})" aria-expanded="${aberto}" aria-label="${aberto ? 'Recolher' : 'Abrir'} o módulo ${i + 1}">${ic('chevron')}</button>
      <span class="n">${treP2(i + 1)}</span>
      <input class="tre-ed-tit" value="${esc(m.titulo)}" placeholder="Título do módulo" aria-label="Título do módulo ${i + 1}" oninput="treEdMod(${i},'titulo',this.value)">
      <span class="tags">${x.v ? `<span class="tag-mini">${x.v === 1 ? 'vídeo' : x.v + ' vídeos'}</span>` : ''}${x.q ? `<span class="tag-mini">${x.q} ${x.q === 1 ? 'questão' : 'questões'}</span>` : ''}</span>
      <span class="bts">${i > 0 ? ibtn('back', 'Subir', `treEdMover(${i},-1)`, 'sm cima') : ''}${i < n - 1 ? ibtn('back', 'Descer', `treEdMover(${i},1)`, 'sm baixo') : ''}
        ${ibtn('copy', 'Duplicar', `treEdDuplicar(${i})`, 'sm')}${ibtn('trash', 'Excluir o módulo', `treEdExcluirModulo(${i})`, 'sm perigo')}</span>
    </div>
    ${aberto ? `<div class="tre-ed-mod-bd">
      <div class="tre-ed-barra">
        <span class="seg"><button class="${!vendo ? 'on' : ''}" onclick="treEdVer(${i},false)">Escrever</button><button class="${vendo ? 'on' : ''}" onclick="treEdVer(${i},true)">Ver</button></span>
        ${!vendo ? `<span class="tre-ed-ferr">
          <button onclick="treEdInserir(${i},'negrito')" title="Negrito"><b>N</b></button>
          <button onclick="treEdInserir(${i},'titulo')" title="Subtítulo">T</button>
          <button onclick="treEdInserir(${i},'lista')" title="Passo a passo">1.</button>
          <button onclick="treEdInserir(${i},'link')" title="Link">${ic('link')}</button>
          <button onclick="treEdEscolherArquivo(${i})" title="Link para um arquivo da equipe">${ic('pasta')}</button>
          <button onclick="treEdVideoModal(${i})" title="Vídeo do YouTube">${ic('play')}</button>
          <button onclick="treEdInserir(${i},'dica')" title="Caixa de dica">${ic('lampada')}</button></span>
          <a class="small tre-ed-ajuda" href="#/treinamentos/config/readme" target="_blank" rel="noopener">o que o Markdown aceita ↗</a>` : ''}
      </div>
      ${vendo ? `<div class="tre-md tre-ed-previa">${treMd(m.corpo) || '<p class="dim">O corpo está vazio.</p>'}</div>`
        : `<textarea id="tre-c-${i}" class="tre-ed-corpo mono" rows="14" oninput="treEdMod(${i},'corpo',this.value)"
            placeholder="O corpo do módulo, em Markdown. Comece por uma frase: o que a pessoa vai conseguir fazer ao fim dele.">${esc(m.corpo)}</textarea>`}
      <div class="tre-ed-sub"><h4>Links relacionados</h4>
        ${(m.links || []).map((k, j) => `<div class="tre-ed-link">
          <input value="${esc(k.titulo)}" placeholder="Título" aria-label="Título do link" oninput="treEdLink(${i},${j},'titulo',this.value)">
          <input value="${esc(k.url)}" placeholder="arquivo:NRO-PES-015, #/agenda ou https://…" aria-label="Endereço" class="mono" oninput="treEdLink(${i},${j},'url',this.value)">
          <input value="${esc(k.descricao || '')}" placeholder="Descrição curta (opcional)" aria-label="Descrição" oninput="treEdLink(${i},${j},'descricao',this.value)">
          ${ibtn('x', 'Tirar o link', `treEdLinkTirar(${i},${j})`, 'sm')}</div>`).join('')}
        <button class="kb-add" onclick="treEdLinkAdd(${i})">${ic('plus')} Link</button></div>
      <div class="tre-ed-sub"><h4>Verificação de conhecimento <span class="small muted">— opcional</span></h4>
        ${(m.verificacao?.questoes || []).map((q, j) => treEdQHTML(i, j, q, m.verificacao.questoes.length)).join('')}
        <div class="tre-ed-addq">${Object.entries(TRE_TIPOS).map(([k, v]) => `<button class="kb-add" onclick="treEdQAdd(${i},'${k}')">${ic('plus')} ${v.l}</button>`).join('')}</div></div>
    </div>` : ''}</div>`;
}
function treEdQHTML(i, j, q, nq){
  const ops = q.opcoes || [], vf = q.tipo === 'vf';
  return `<div class="tre-ed-q" data-j="${j}">
    <div class="tre-ed-q-hd"><span class="n">Q${j + 1}</span>
      <select aria-label="Tipo da questão" onchange="treEdQTipo(${i},${j},this.value)">${Object.entries(TRE_TIPOS).map(([k, v]) =>
        `<option value="${k}"${q.tipo === k ? ' selected' : ''}>${v.l}</option>`).join('')}</select>
      <span class="bts">${j > 0 ? ibtn('back', 'Subir', `treEdQMover(${i},${j},-1)`, 'sm cima') : ''}${j < nq - 1 ? ibtn('back', 'Descer', `treEdQMover(${i},${j},1)`, 'sm baixo') : ''}
        ${ibtn('trash', 'Excluir a questão', `treEdQTirar(${i},${j})`, 'sm perigo')}</span></div>
    <textarea rows="2" placeholder="Enunciado" aria-label="Enunciado" oninput="treEdQ(${i},${j},'enunciado',this.value)">${esc(q.enunciado)}</textarea>
    <div class="tre-ed-ops">${ops.map((o, k) => `<div class="tre-ed-op">
      ${vf ? `<button class="tre-ed-vf ${o.correta ? 'v' : 'f'}" onclick="treEdOCorreta(${i},${j},${k})" title="${o.correta ? 'Verdadeira' : 'Falsa'} — clique para trocar">${o.correta ? 'V' : 'F'}</button>`
        : `<button class="tre-ed-marca${o.correta ? ' on' : ''}" onclick="treEdOCorreta(${i},${j},${k})" aria-pressed="${!!o.correta}"
            title="${o.correta ? 'Correta' : 'Marcar como correta'}">${ic('check')}</button>`}
      <input value="${esc(o.texto)}" placeholder="${vf ? 'Afirmação' : 'Alternativa'}" aria-label="${vf ? 'Afirmação' : 'Alternativa'} ${k + 1}" oninput="treEdO(${i},${j},${k},this.value)">
      ${ibtn('x', 'Tirar', `treEdOTirar(${i},${j},${k})`, 'sm')}</div>`).join('')}
      <button class="kb-add" onclick="treEdOAdd(${i},${j})">${ic('plus')} ${vf ? 'Afirmação' : 'Alternativa'}</button></div>
    <textarea rows="2" placeholder="Explicação: por que a certa é certa (a pessoa vê depois de passar)" aria-label="Explicação" oninput="treEdQ(${i},${j},'explicacao',this.value)">${esc(q.explicacao || '')}</textarea>
  </div>`;
}
function treEdMod(i, k, v){ treEdM(i)[k] = v; treEdSujo('c'); }
function treEdAlterna(i){ const id = treEdM(i).id, s = treino.ed.abertos; s.has(id) ? s.delete(id) : s.add(id); treEdRedesenharMods(); }
function treEdVer(i, v){ const id = treEdM(i).id; v ? treino.ed.vendo.add(id) : treino.ed.vendo.delete(id); treEdRedesenharMods(); }
function treEdMover(i, d){
  const ms = treino.ed.conteudo.modulos, j = i + d; if (j < 0 || j >= ms.length) return;
  [ms[i], ms[j]] = [ms[j], ms[i]]; treEdSujo('c'); treEdRedesenharMods();
}
function treEdDuplicar(i){
  const ms = treino.ed.conteudo.modulos, c = JSON.parse(JSON.stringify(ms[i]));
  c.id = treId('m-'); c.titulo = (c.titulo || '') + ' (cópia)';
  ms.splice(i + 1, 0, c); treino.ed.abertos.add(c.id); treEdSujo('c'); treEdRedesenharMods();
}
async function treEdExcluirModulo(i){
  const m = treEdM(i);
  if (!await confirma(`Excluir o módulo <b>${esc(m.titulo || treP2(i + 1))}</b> do rascunho? A revisão publicada não muda até você publicar.`, 'Excluir')) return;
  treino.ed.conteudo.modulos.splice(i, 1); treEdSujo('c'); treEdRedesenharMods();
}
function treEdAddModulo(){
  const m = { id: treId('m-'), titulo:'', corpo:'' };
  treino.ed.conteudo.modulos.push(m); treino.ed.abertos.add(m.id); treEdSujo('c'); treEdRedesenharMods();
  const els = document.querySelectorAll('.tre-ed-tit'); els[els.length - 1]?.focus();
}
/* insere no corpo onde está o cursor (ou em volta do que está selecionado) */
function treEdColar(i, antes, depois, padrao){
  const ta = $('#tre-c-' + i); if (!ta) return;
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a, sel = ta.value.slice(a, b) || padrao || '';
  ta.value = ta.value.slice(0, a) + antes + sel + (depois || '') + ta.value.slice(b);
  ta.focus(); ta.setSelectionRange(a + antes.length, a + antes.length + sel.length);
  treEdMod(i, 'corpo', ta.value);
}
function treEdInserir(i, tipo){
  const ta = $('#tre-c-' + i); if (!ta) return;
  const nl = ta.selectionStart > 0 && ta.value[ta.selectionStart - 1] !== '\n' ? '\n\n' : '';
  if (tipo === 'negrito') return treEdColar(i, '**', '**', 'texto');
  if (tipo === 'titulo') return treEdColar(i, nl + '## ', '\n', 'Subtítulo');
  if (tipo === 'lista') return treEdColar(i, nl + '1. ', '\n2. \n3. \n', 'Primeiro passo');
  if (tipo === 'link') return treEdColar(i, '[', '](https://)', 'texto do link');
  if (tipo === 'dica') return treEdColar(i, nl + '> **Dica:** ', '\n', 'o atalho que poupa tempo');
}
function treEdVideoModal(i){
  abreModal(`<h3>${ic('play')} Vídeo do YouTube</h3>
    <p class="small muted" style="margin-bottom:12px">O vídeo aparece no mesmo player do site institucional. "Não listado" funciona; "privado", não.</p>
    <div class="fld"><label for="tv-url">Link do vídeo</label><input id="tv-url" placeholder="https://www.youtube.com/watch?v=…" oninput="treEdVideoPrevia()"></div>
    <div class="fld"><label for="tv-tit">Título, embaixo do player</label><input id="tv-tit" placeholder="Ex.: Como cadastrar a sua agenda no SOMA"></div>
    <div id="tv-prev" class="small"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="treEdVideoPor(${i})">Pôr o vídeo</button></div>`);
  $('#tv-url').focus();
}
function treEdVideoPrevia(){
  const id = treYoutubeId($('#tv-url').value), el = $('#tv-prev');
  el.innerHTML = id ? `<img src="https://i.ytimg.com/vi/${esc(id)}/mqdefault.jpg" alt="" style="width:160px;border-radius:8px;display:block;margin-bottom:6px"><span class="mono dim">${esc(id)}</span>`
    : ($('#tv-url').value.trim() ? '<span style="color:var(--bad-tx)">Não reconheci o link do YouTube.</span>' : '');
}
function treEdVideoPor(i){
  const url = $('#tv-url').value.trim(), id = treYoutubeId(url), tit = $('#tv-tit').value.trim();
  if (!id) return toast('Cole o link de um vídeo do YouTube.', true);
  fechaModal();
  treino.ed.vendo.delete(treEdM(i).id);
  if (!$('#tre-c-' + i)) treEdRedesenharMods();
  const ta = $('#tre-c-' + i), nl = ta && ta.selectionStart > 0 && ta.value[ta.selectionStart - 1] !== '\n' ? '\n\n' : '';
  treEdColar(i, `${nl}\`\`\`video\nhttps://youtu.be/${id}\n${tit}`, '\n```\n', '');
}
async function treEdEscolherArquivo(i){
  abreModal(`<h3>${ic('pasta')} Link para um arquivo</h3><div class="fld"><input id="ta-q" placeholder="Código ou título (ex.: NRO-PES-015, acesso)" oninput="treEdArquivosFiltrar(${i})"></div>
    <div id="ta-lista" class="tre-arq-lista">${treCarregando()}</div>`, 'largo');
  if (!treino.arquivos){
    const { data, error } = await sb.from('doc_rol').select('codigo,titulo,status').order('codigo');
    treino.arquivos = error ? [] : (data || []).filter(a => a.status !== 'obsoleto');
  }
  treEdArquivosFiltrar(i); $('#ta-q')?.focus();
}
function treEdArquivosFiltrar(i){
  const q = norm($('#ta-q')?.value || ''), el = $('#ta-lista'); if (!el) return;
  const vis = treino.arquivos.filter(a => !q || norm(a.codigo + ' ' + a.titulo).includes(q)).slice(0, 40);
  el.innerHTML = !treino.arquivos.length ? `<p class="small muted">Não consegui ler o rol de arquivos. Escreva o link à mão: <code>[nome](arquivo:NRO-XXX-000)</code>.</p>`
    : vis.length ? vis.map((a, k) => `<button class="tre-arq" onclick="treEdArquivoPor(${i},${treino.arquivos.indexOf(a)})"><span class="mono">${esc(a.codigo)}</span><span>${esc(a.titulo)}</span></button>`).join('')
    : '<p class="small muted">Nenhum arquivo com esse código ou título.</p>';
}
function treEdArquivoPor(i, k){
  const a = treino.arquivos[k]; fechaModal();
  const tit = String(a.titulo || a.codigo).toLowerCase().replace(/^./, c => c.toUpperCase());
  treEdColar(i, '[', `](arquivo:${a.codigo})`, tit);
}
/* links relacionados */
function treEdLink(i, j, k, v){ treEdM(i).links[j][k] = v; treEdSujo('c'); }
function treEdLinkAdd(i){ const m = treEdM(i); (m.links ||= []).push({ titulo:'', url:'', descricao:'' }); treEdSujo('c'); treEdRedesenharMods(); }
function treEdLinkTirar(i, j){ const m = treEdM(i); m.links.splice(j, 1); if (!m.links.length) delete m.links; treEdSujo('c'); treEdRedesenharMods(); }
/* as questões */
const treEdQs = i => (treEdM(i).verificacao ||= { questoes:[] }).questoes;
function treEdQAdd(i, tipo){
  const qs = treEdQs(i), n = Math.max(0, ...qs.map(q => parseInt(String(q.id).replace(/\D/g, ''), 10) || 0)) + 1;
  qs.push({ id:'q' + n, tipo, enunciado:'', explicacao:'', opcoes: tipo === 'vf'
    ? [{ id:'a', texto:'', correta:true }, { id:'b', texto:'', correta:false }]
    : [{ id:'a', texto:'', correta:true }, { id:'b', texto:'', correta:false }, { id:'c', texto:'', correta:false }] });
  treEdSujo('c'); treEdRedesenharMods();
}
function treEdQ(i, j, k, v){ treEdQs(i)[j][k] = v; treEdSujo('c'); }
function treEdQTipo(i, j, tipo){
  const q = treEdQs(i)[j]; q.tipo = tipo;
  if (tipo === 'unica'){ let achou = false; q.opcoes.forEach(o => { if (o.correta && !achou) achou = true; else o.correta = false; }); if (!achou && q.opcoes[0]) q.opcoes[0].correta = true; }
  treEdSujo('c'); treEdRedesenharMods();
}
function treEdQMover(i, j, d){ const qs = treEdQs(i), k = j + d; if (k < 0 || k >= qs.length) return; [qs[j], qs[k]] = [qs[k], qs[j]]; treEdSujo('c'); treEdRedesenharMods(); }
function treEdQTirar(i, j){ const m = treEdM(i); m.verificacao.questoes.splice(j, 1); if (!m.verificacao.questoes.length) delete m.verificacao; treEdSujo('c'); treEdRedesenharMods(); }
function treEdO(i, j, k, v){ treEdQs(i)[j].opcoes[k].texto = v; treEdSujo('c'); }
function treEdOAdd(i, j){
  const q = treEdQs(i)[j], usados = new Set(q.opcoes.map(o => o.id));
  let c = 97; while (usados.has(String.fromCharCode(c))) c++;
  q.opcoes.push({ id:String.fromCharCode(c), texto:'', correta: q.tipo === 'vf' });
  treEdSujo('c'); treEdRedesenharMods();
}
function treEdOTirar(i, j, k){ treEdQs(i)[j].opcoes.splice(k, 1); treEdSujo('c'); treEdRedesenharMods(); }
function treEdOCorreta(i, j, k){
  const q = treEdQs(i)[j];
  if (q.tipo === 'unica') q.opcoes.forEach((o, x) => { o.correta = x === k; });
  else q.opcoes[k].correta = !q.opcoes[k].correta;
  treEdSujo('c'); treEdRedesenharMods();
}

/* ---------------- a atribuição ---------------- */
/* os grupos em árvore, cada um com a profundidade: atribuir a um
   grupo atribui a quem está nos de baixo — a árvore mostra isso */
function treGruposArvore(){
  const gs = (state.grupos || []).filter(g => g.ativo !== false);
  const filhos = new Map();
  gs.forEach(g => { const p = gs.some(x => x.id === g.pai_id) ? g.pai_id : null; (filhos.get(p) || filhos.set(p, []).get(p)).push(g); });
  const out = [], vistos = new Set();
  const desce = (p, prof) => (filhos.get(p) || []).sort((a, b) => a.nome.localeCompare(b.nome, 'pt')).forEach(g => {
    if (vistos.has(g.id)) return; vistos.add(g.id); out.push({ g, prof }); desce(g.id, prof + 1); });
  desce(null, 0);
  return out;
}
function treEdAtribHTML(){
  const ed = treino.ed, sel = new Map(ed.atrib.map(a => [a.k, a.obrigatorio]));
  const linhas = [{ k:'todos', nome:'Toda a equipe', prof:0 }, ...treGruposArvore().map(x => ({ k:String(x.g.id), nome:x.g.nome, prof:x.prof }))];
  return `<h3>Atribuição</h3><p class="sub" style="margin-bottom:10px">A grupos — quem está num grupo de baixo recebe também</p>
    <div class="tre-atr">${linhas.map(r => { const on = sel.has(r.k), ob = sel.get(r.k);
      return `<div class="tre-atr-l${on ? ' on' : ''}" style="--prof:${r.prof}">
        <label class="check"><input type="checkbox"${on ? ' checked' : ''} onchange="treEdAtrib('${r.k}', this.checked ? true : null)"> ${esc(r.nome)}</label>
        ${on ? `<span class="seg"><button class="${ob ? 'on' : ''}" onclick="treEdAtrib('${r.k}', true)">Obrigatório</button><button class="${!ob ? 'on' : ''}" onclick="treEdAtrib('${r.k}', false)">Opcional</button></span>` : ''}</div>`; }).join('')}</div>
    <div class="acts" style="margin-top:12px"><button class="btn ${ed.atribSujo ? 'solid' : 'ghost'} mini" onclick="treEdAtribSalvar()"${ed.atribSujo ? '' : ' disabled'}>Salvar a atribuição</button>
      <span class="small muted">${ed.t.status === 'publicado' ? 'Quem passar a dever o treinamento é avisado.' : 'Os avisos saem quando você publicar.'}</span></div>`;
}
function treEdAtrib(k, v){
  const ed = treino.ed, i = ed.atrib.findIndex(a => a.k === k);
  if (v === null){ if (i >= 0) ed.atrib.splice(i, 1); }
  else if (i >= 0) ed.atrib[i].obrigatorio = v; else ed.atrib.push({ k, obrigatorio:v });
  ed.atribSujo = true;
  $('#tre-ed-atr').innerHTML = treEdAtribHTML();
}
async function treEdAtribSalvar(){
  const ed = treino.ed;
  const lista = ed.atrib.map(a => ({ grupo_id: a.k === 'todos' ? null : +a.k, obrigatorio: a.obrigatorio }));
  const { data, error } = await sb.rpc('treinamento_atribuir', { p_id: ed.t.id, p_lista: lista });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para salvar a atribuição'), true);
  ed.atribSujo = false; $('#tre-ed-atr').innerHTML = treEdAtribHTML();
  treino.lista = null;
  toast('Atribuição salva.' + (data.avisados ? ` ${data.avisados} ${data.avisados === 1 ? 'pessoa avisada' : 'pessoas avisadas'}.` : ''));
}

/* ---------------- publicar, descartar, arquivar, excluir ---------------- */
function treEdPublicarModal(){
  const ed = treino.ed, t = ed.t, letra = treProxLetra(), probs = treProblemas(ed.conteudo);
  if (!ed.rasc && !ed.sujoC && t.revisao_atual)
    return abreModal(`<h3>Nada novo para publicar</h3><p class="small muted" style="line-height:1.6">O conteúdo é o mesmo da Rev. ${esc(t.revisao_atual)}, que já está publicada.
      Mude um módulo e o rascunho da Rev. ${letra} se abre sozinho.</p><div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Voltar</button></div>`);
  abreModal(`<h3>${ic('enviar')} Publicar a Rev. ${letra}</h3>
    ${probs.length ? `<div class="aviso-box err" style="margin-top:12px"><b>Antes de publicar, resolva:</b><ul class="tre-probs">${probs.map(p => `<li>${esc(p)}</li>`).join('')}</ul></div>
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Voltar ao editor</button></div>`
    : `<p class="small muted" style="line-height:1.6;margin:8px 0 14px">Publicada, a Rev. ${letra} passa a ser a que todos fazem${t.revisao_atual ? `, e a Rev. ${esc(t.revisao_atual)} fica como substituída` : ''}.</p>
      <div class="fld"><label for="tre-pub-notas">O que mudou</label><textarea id="tre-pub-notas" rows="3" placeholder="${t.revisao_atual ? 'Ex.: a aba Agendar foi refeita; vídeo novo no módulo 2.' : 'Versão inicial.'}">${esc(ed.notas || '')}</textarea></div>
      ${t.revisao_atual ? `<label class="check tre-refazer"><input type="checkbox" id="tre-pub-refazer"> <span><b>Pedir que todos refaçam.</b> Quem concluiu a Rev. ${esc(t.revisao_atual)} volta a dever o treinamento e é avisado.
        Sem isso, quem concluiu continua em dia — é para mudança de conteúdo, não para correção de texto.</span></label>`
        : '<p class="small muted">Quem tem o treinamento como obrigatório é avisado no sino e por e-mail, conforme a preferência de cada um.</p>'}
      ${!ed.atrib.length ? '<div class="aviso-box warn" style="margin-top:12px">Ainda não foi atribuído a nenhum grupo: publicado, fica em Todos os treinamentos, sem ser obrigatório para ninguém.</div>' : ''}
      <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
        <button class="btn solid" id="tre-pub-ok" onclick="treEdPublicar()">Publicar a Rev. ${letra}</button></div>`}`);
}
async function treEdPublicar(){
  const ed = treino.ed, bt = $('#tre-pub-ok');
  const notas = $('#tre-pub-notas')?.value.trim() || '', refazer = !!$('#tre-pub-refazer')?.checked;
  if (bt) bt.disabled = true;
  ed.notas = notas; ed.sujoC = true;
  if (!await treEdSalvar()){ if (bt) bt.disabled = false; return; }
  const { data, error } = await sb.rpc('treinamento_publicar', { p_id: ed.t.id, p_exige_refazer: refazer, p_notas: notas });
  if (error || data?.status !== 'ok'){
    if (bt) bt.disabled = false;
    return toast(data?.status === 'invalido' ? 'O banco recusou: ' + (data.problemas || []).slice(0, 2).join(' ') : motivoRPC(data, error, 'Não deu para publicar'), true);
  }
  fechaModal();
  toast(`Rev. ${data.revisao} publicada.` + (data.avisados ? ` ${data.avisados} ${data.avisados === 1 ? 'pessoa avisada' : 'pessoas avisadas'}.` : ''));
  treino.lista = null; treino.atual = null; treino.gestao = null;
  treEditor(ed.t.codigo);
}
async function treEdDescartar(){
  const ed = treino.ed;
  if (!await confirma(`Jogar fora o rascunho? O conteúdo volta a ser o da Rev. ${esc(ed.t.revisao_atual)}, a publicada.`, 'Descartar')) return;
  clearTimeout(ed.timer); ed.sujoC = false;
  const { data, error } = await sb.rpc('treinamento_rascunho_descartar', { p_id: ed.t.id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para descartar'), true);
  toast('Rascunho descartado.'); treEditor(ed.t.codigo);
}
async function treEdArquivar(arquivar){
  const ed = treino.ed;
  if (arquivar && !await confirma('Arquivar? O treinamento sai de Todos os treinamentos e das pendências de todo mundo. Os certificados continuam valendo, e dá para desarquivar.', 'Arquivar')) return;
  const { data, error } = await sb.rpc('treinamento_arquivar', { p_id: ed.t.id, p_arquivar: arquivar });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para arquivar'), true);
  toast(arquivar ? 'Arquivado.' : 'Desarquivado.'); treino.lista = null; treEditor(ed.t.codigo);
}
async function treEdExcluir(){
  const ed = treino.ed;
  if (!await confirma(`Excluir ${esc(ed.t.codigo)} de vez? Ele nunca foi publicado, então ninguém o fez.`, 'Excluir')) return;
  clearTimeout(ed.timer); ed.sujoC = ed.sujoM = false;
  const { data, error } = await sb.rpc('treinamento_excluir', { p_id: ed.t.id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não deu para excluir'), true);
  treino.ed = null; treino.gestao = null; toast(`${data.codigo} excluído.`);
  location.hash = '#/treinamentos/config';
}

/* ---------------- importar, exportar, pré-visualizar ---------------- */
function treImportarModal(){
  _treImp = null;
  abreModal(`<h3>${ic('subir')} Importar um texto</h3>
    <p class="small muted" style="line-height:1.6;margin:6px 0 12px">Cole o que o agente de IA devolveu — ou um arquivo exportado daqui. O formato é o do
      <a href="#/treinamentos/config/readme" target="_blank" rel="noopener" style="text-decoration:underline">README de conteúdo</a>.</p>
    <div class="tre-imp-passos">
      <button class="btn ghost mini" onclick="treBaixarReadme(true)">${ic('down')} README</button>
      <button class="btn ghost mini" onclick="copiar(TRE_PEDIDO_MODELO)">${ic('copy')} Pedido-modelo</button>
      <label class="btn ghost mini">${ic('doc')} Abrir arquivo .md<input type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onchange="treImpArquivo(this)"></label></div>
    <div class="fld"><label for="tre-imp-txt">O texto do treinamento</label><textarea id="tre-imp-txt" rows="11" class="mono tre-imp-txt" oninput="treImpLer()"
      placeholder="---&#10;titulo: …&#10;---&#10;&#10;# Primeiro módulo&#10;…"></textarea></div>
    <div id="tre-imp-previa"></div>
    <div class="fld"><label>Os módulos do texto</label>
      <span class="seg" id="tre-imp-modo"><button class="on" data-m="substituir" onclick="treImpModo(this)">Substituem os do rascunho</button>
        <button data-m="acrescentar" onclick="treImpModo(this)">Entram no fim</button></span></div>
    <label class="check"><input type="checkbox" id="tre-imp-meta" checked> Usar também o título, o resumo, a categoria e a carga horária do texto</label>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="tre-imp-ok" disabled onclick="treImpAplicar()">Importar</button></div>`, 'largo', true);
  $('#tre-imp-txt').focus();
}
function treImpModo(bt){ bt.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === bt)); }
function treImpAplicar(){
  const r = _treImp, ed = treino.ed; if (!r?.conteudo.modulos.length) return;
  const modo = document.querySelector('#tre-imp-modo .on')?.dataset.m || 'substituir';
  if (modo === 'substituir') ed.conteudo.modulos = r.conteudo.modulos;
  else {
    const usados = new Set(ed.conteudo.modulos.map(m => m.id));
    r.conteudo.modulos.forEach(m => { while (usados.has(m.id)) m.id = treId('m-'); usados.add(m.id); ed.conteudo.modulos.push(m); });
  }
  if ($('#tre-imp-meta')?.checked){
    ['titulo', 'resumo', 'categoria', 'carga_horaria_min', 'nota_minima', 'validade_meses'].forEach(k => { if (r.meta[k] != null && r.meta[k] !== '') ed.meta[k] = r.meta[k]; });
    treEdSujo('m');
  }
  ed.abertos = new Set(ed.conteudo.modulos.slice(0, 1).map(m => m.id));
  fechaModal(); treEdSujo('c'); treEdDesenhar();
  toast(`${r.conteudo.modulos.length} ${r.conteudo.modulos.length === 1 ? 'módulo importado' : 'módulos importados'} para o rascunho.`);
}
function treExportar(){
  const ed = treino.ed, t = ed.t;
  const nome = `${t.codigo}-${ed.rasc ? 'rascunho-rev-' + treProxLetra() : 'rev-' + t.revisao_atual}.md`;
  treBaixarTexto(nome, treEscreverTexto({ ...ed.meta, codigo:t.codigo }, ed.conteudo));
}
/* a pré-visualização: o módulo como quem faz vai ver, com o gabarito marcado */
function trePrevia(i){
  const ms = treino.ed.conteudo.modulos;
  if (!ms.length) return toast('Nenhum módulo para pré-visualizar ainda.', true);
  i = Math.max(0, Math.min(i, ms.length - 1));
  const m = ms[i], qs = m.verificacao?.questoes || [];
  abreModal(`<div class="tre-previa">
    <div class="tre-previa-abas">${ms.map((x, k) => `<button class="${k === i ? 'on' : ''}" onclick="trePrevia(${k})">${treP2(k + 1)} · ${esc(x.titulo || 'sem título')}</button>`).join('')}</div>
    <span class="eyebrow">Módulo ${treP2(i + 1)} de ${treP2(ms.length)} · pré-visualização</span>
    <h2 class="tre-previa-tt">${esc(m.titulo || 'Sem título')}</h2>
    <div class="tre-md">${treMd(m.corpo)}</div>
    ${(m.links || []).length ? `<section class="tre-links"><h2>Links relacionados</h2><div class="doc-grid">${m.links.map(treLinkCartao).join('')}</div></section>` : ''}
    ${qs.length ? `<section class="tre-verif card"><div class="tre-verif-hd"><span class="eyebrow">Verificação de conhecimento · com o gabarito</span></div>
      <ol class="tre-qs">${qs.map((q, j) => `<li class="tre-q"><div class="tre-q-en"><span class="n">${treP2(j + 1)}</span><div>${treInline(q.enunciado).replace(/\n/g, '<br>')}
        <span class="tre-q-dica">${TRE_TIPOS[q.tipo]?.l || ''}</span></div></div>
        <div class="tre-ops">${(q.opcoes || []).map(o => q.tipo === 'vf'
          ? `<div class="tre-vf e-certa"><span class="tx">${treInline(o.texto)}</span><span class="tre-vf-g">${o.correta ? 'V' : 'F'}</span></div>`
          : `<div class="tre-op${o.correta ? ' e-certa' : ''}"><span>${treInline(o.texto)}</span></div>`).join('')}</div>
        ${q.explicacao ? `<div class="tre-q-exp"><b>Por quê:</b> ${treInline(q.explicacao)}</div>` : ''}</li>`).join('')}</ol></section>` : ''}
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div></div>`, 'imenso');
}

/* ============================================================
   ACOMPANHAMENTO — quem fez e quem deve
   ============================================================ */
async function treAcompanhamento(cod){
  $('#main').innerHTML = treCarregando();
  const { data:t, error } = await sb.from('treinamentos').select('id,codigo,titulo,revisao_atual,status,validade_meses').eq('codigo', cod).maybeSingle();
  if (error) return treFaltaBanco(error);
  if (!t) return treNaoAchou(cod);
  const r = await sb.rpc('treinamento_acompanhamento', { p_id: t.id });
  if (r.error) return treFaltaBanco(r.error);
  treino.acomp = { t, linhas: r.data || [] };
  treAcompDesenhar();
}
function treAcompDesenhar(){
  const { t, linhas } = treino.acomp, f = treino.acompFiltro;
  const obr = linhas.filter(l => l.obrigatorio);
  const emDia = obr.filter(l => l.situacao === 'concluido').length;
  const pct = obr.length ? Math.round(100 * emDia / obr.length) : 0;
  const vis = linhas.filter(l => !f || (f === 'devem' ? l.obrigatorio && l.situacao !== 'concluido'
    : f === 'em_dia' ? l.situacao === 'concluido' : f === 'opcional' ? l.obrigatorio === false : true));
  $('#main').innerHTML = `${treTopo(`${esc(t.titulo)}`, `${esc(t.codigo)} · ${t.revisao_atual ? 'Rev. ' + esc(t.revisao_atual) : 'não publicado'}. Quem tem o treinamento, pela atribuição, e quem o fez sem ter.`,
      `<a class="btn ghost mini" href="#/treinamentos/${esc(t.codigo)}/editar">${ic('pencil')} Editar</a>
       <button class="btn ghost mini" onclick="treAcompCSV()">${ic('down')} Planilha (CSV)</button>`, 'Acompanhamento')}
    ${treNav('config')}
    <div class="metricas" style="margin-bottom:18px">
      <div class="metrica"><span class="rot">Obrigatório para</span><span class="val">${obr.length}</span><span class="var neutro">pessoas ativas</span></div>
      <div class="metrica"><span class="rot">Em dia</span><span class="val">${pct}%</span><span class="var ${pct === 100 ? 'sobe' : 'neutro'}">${emDia} de ${obr.length}</span></div>
      <div class="metrica"><span class="rot">Em andamento</span><span class="val">${linhas.filter(l => l.situacao === 'andamento').length}</span><span class="var neutro">começaram</span></div>
      <div class="metrica"><span class="rot">Por refazer</span><span class="val">${linhas.filter(l => l.situacao === 'vencido' || l.situacao === 'nova_revisao').length}</span><span class="var neutro">vencido ou revisão nova</span></div></div>
    <div class="filtros"><div class="seg" role="group" aria-label="Recorte">${[['', 'Todos'], ['devem', 'Devem'], ['em_dia', 'Em dia'], ['opcional', 'Opcional']].map(([k, l]) =>
      `<button class="${f === k ? 'on' : ''}" onclick="treino.acompFiltro='${k}';treAcompDesenhar()">${l}</button>`).join('')}</div></div>
    ${vis.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Pessoa</th><th>Atribuição</th><th>Situação</th><th>Progresso</th>
      <th>Concluído em</th><th class="num">Nota</th><th>Certificado</th></tr></thead><tbody>${vis.map(l => `<tr>
        <td class="nome">${esc(l.nome)} <span class="reg">${String(l.registro).padStart(3, '0')}</span></td>
        <td>${l.obrigatorio ? 'Obrigatório' : l.obrigatorio === false ? 'Opcional' : '<span class="dim">não atribuído</span>'}</td>
        <td>${trePill(l.situacao)}</td>
        <td><span class="tre-prog mini"><i style="width:${l.total ? Math.round(100 * (l.situacao === 'concluido' ? l.total : l.feitos) / l.total) : 0}%"></i></span>
          <span class="small muted">${l.situacao === 'concluido' ? l.total : l.feitos}/${l.total}</span></td>
        <td class="small">${l.concluido_em ? fmtD(l.concluido_em) + (l.revisao ? ' · Rev. ' + esc(l.revisao) : '') : '—'}</td>
        <td class="num">${l.nota != null ? l.nota + '%' : '—'}</td>
        <td>${l.certificado ? `<button class="btn ghost mini" onclick="treBaixarCertificado('${esc(l.certificado)}', this)">${ic('down')} PDF</button>` : ''}</td></tr>`).join('')}
      </tbody></table></div>`
      : `<div class="vazio"><h3>${linhas.length ? 'Ninguém nesse recorte' : 'Ninguém tem este treinamento ainda'}</h3>
        <p>${linhas.length ? '' : 'Atribua a um grupo, no editor, para ele aparecer para as pessoas.'}</p></div>`}`;
}
function treAcompCSV(){
  const { t, linhas } = treino.acomp;
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const cab = ['Registro', 'Nome', 'Atribuição', 'Situação', 'Módulos feitos', 'Módulos', 'Concluído em', 'Revisão', 'Nota', 'Certificado'];
  const rows = linhas.map(l => [String(l.registro).padStart(3, '0'), l.nome, l.obrigatorio ? 'Obrigatório' : l.obrigatorio === false ? 'Opcional' : '',
    TRE_SITUACAO[l.situacao]?.l || l.situacao, l.situacao === 'concluido' ? l.total : l.feitos, l.total, l.concluido_em ? fmtD(l.concluido_em) : '', l.revisao || '', l.nota ?? '', l.certificado || '']);
  treBaixarTexto(`${t.codigo}-acompanhamento.csv`, '﻿' + [cab, ...rows].map(r => r.map(c).join(';')).join('\n'), 'text/csv;charset=utf-8');
}

/* ============================================================
   CONFIGURAÇÕES — quem gere, a nota, o certificado e o README
   ============================================================ */
async function treConfig(aba){
  $('#main').innerHTML = treCarregando();
  const cfg = await treConfigCarregar();
  if (!cfg || cfg.id == null) return treFaltaBanco({ message:'treinamento_config não respondeu' });
  aba = aba === 'readme' ? 'readme' : 'geral';
  const topo = `${treTopo('Configurações', '')}
    ${treNav('config')}${treNavConfig(aba)}`;
  if (aba === 'readme') return treConfigReadme(topo, cfg);
  const gestores = new Set(cfg.grupos_gestores || []);
  treino.cfgGestores = new Set(gestores);
  $('#main').innerHTML = `${topo}
    <div class="tre-cfg">
      <div class="card"><h3>Quem gere</h3>
        <p class="small muted" style="margin:4px 0 12px;line-height:1.6">Admin e o Depto. de Pessoal gerem sempre. Quem está num destes grupos (ou num grupo abaixo deles)
          também cria, edita, publica e atribui. ${can() ? '' : '<b>Só admin e o Depto. de Pessoal mudam esta lista.</b>'}</p>
        <div class="chips" id="tc-gestores">${treGruposArvore().map(({ g }) => `<button class="chip-b${gestores.has(g.id) ? ' on' : ''}"${can() ? '' : ' disabled'}
          onclick="treCfgGestor(${g.id}, this)">${esc(g.nome)}</button>`).join('') || '<span class="small muted">Nenhum grupo cadastrado.</span>'}</div></div>
      <div class="card"><h3>Para passar</h3>
        <div class="fld" style="margin-top:12px;max-width:220px"><label for="tc-nota">Nota mínima padrão (%)</label>
          <input id="tc-nota" type="number" min="0" max="100" value="${esc(cfg.nota_minima ?? 70)}"></div>
        <p class="small muted">Vale para cada verificação de conhecimento, nos treinamentos que não têm nota própria.</p></div>
      <div class="card tre-cfg-cert"><h3>O certificado</h3>
        <div class="dupla" style="margin-top:12px">
          <div class="fld"><label for="tc-ass">Quem assina</label><input id="tc-ass" value="${esc(cfg.assinatura_nome || '')}" placeholder="Departamento de Pessoal" oninput="treCfgPrevia()"></div>
          <div class="fld"><label for="tc-cargo">Cargo ou área</label><input id="tc-cargo" value="${esc(cfg.assinatura_cargo || '')}" placeholder="NeuroDynamics" oninput="treCfgPrevia()"></div></div>
        <div id="tc-previa" class="tre-cert-previa">${treCarregando()}</div>
        <div class="acts"><button class="btn ghost mini" onclick="treCertExemplo()">${ic('down')} Baixar um de exemplo</button></div></div>
    </div>
    <div class="acts"><button class="btn solid" onclick="treCfgSalvar()">${ic('check')} Salvar as configurações</button></div>`;
  treCfgPrevia();
}
function treCfgGestor(id, bt){ const s = treino.cfgGestores; s.has(id) ? s.delete(id) : s.add(id); bt.classList.toggle('on', s.has(id)); }
async function treCfgSalvar(){
  const nota = parseInt($('#tc-nota').value, 10);
  if (!(nota >= 0 && nota <= 100)) return toast('A nota mínima vai de 0 a 100.', true);
  const d = { nota_minima: nota, assinatura_nome: $('#tc-ass').value.trim() || null, assinatura_cargo: $('#tc-cargo').value.trim() || null };
  if (can()) d.grupos_gestores = [...treino.cfgGestores];
  const { error } = await sb.from('treinamento_config').update(d).eq('id', true);
  if (error) return toast('Não deu para salvar: ' + (/tre_so_admin/.test(error.message) ? 'só admin e o Depto. de Pessoal mudam quem gere.' : error.message), true);
  Object.assign(treino.cfg, d);
  if (d.grupos_gestores) carregarTreinamentoConfig();
  toast('Configurações salvas.');
}
function treCertAmostra(){
  return { certificado:'CERT-0000-0000', nome: state.perfil?.nome || 'Nome da Pessoa', codigo:'NRO-TRE-001', titulo:'Agenda no SOMA',
    revisao:'A', carga_horaria_min:45, nota:92, modulos:['O que é a agenda', 'As cinco abas', 'Presença e check-in'], concluido_em:new Date().toISOString() };
}
async function treCfgPrevia(){
  clearTimeout(treino._pv);
  treino._pv = setTimeout(async () => {
    const el = $('#tc-previa'); if (!el) return;
    const cv = await treCertificadoCanvas(treCertAmostra(), { assinatura_nome: $('#tc-ass')?.value.trim(), assinatura_cargo: $('#tc-cargo')?.value.trim() }, .3);
    cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Prévia do certificado');
    el.innerHTML = ''; el.appendChild(cv);
  }, 200);
}
function treCertExemplo(){
  treCertificadoPDF(treCertAmostra(), { assinatura_nome: $('#tc-ass')?.value.trim(), assinatura_cargo: $('#tc-cargo')?.value.trim() })
    .catch(e => falha(e, 'Não deu para gerar o certificado'));
}

/* ---------------- o README ---------------- */
const treReadme = () => treino.cfg?.readme || TRE_README_PADRAO;
function treConfigReadme(topo, cfg){
  const proprio = !!cfg.readme;
  $('#main').innerHTML = `${topo}
    <div class="tre-readme-topo card">
      <div class="tx"><b>${proprio ? 'README da equipe' : 'README padrão do portal'}</b>
        <span class="small muted">${proprio ? `Mudado em ${fmtDT(cfg.readme_atualizado_em)}${cfg.readme_atualizado_por ? ' por ' + esc(cfg.readme_atualizado_por) : ''}.`
          : 'Ninguém o mudou ainda: vale o que vem com o portal, que acompanha o formato que ele lê.'}</span></div>
      <div class="acts" style="margin:0">
        <button class="btn ghost mini" onclick="treBaixarReadme(false)">${ic('down')} Baixar (.md)</button>
        <button class="btn ghost mini" onclick="treBaixarReadme(true)" title="Com a lista dos arquivos e dos treinamentos que o texto pode citar">${ic('down')} Baixar com as referências</button>
        <button class="btn ghost mini" onclick="copiar(TRE_PEDIDO_MODELO)">${ic('copy')} Copiar o pedido-modelo</button></div></div>
    <div class="tre-readme">
      <div class="tre-readme-ed">
        <div class="tre-ed-barra"><span class="seg"><button class="on" data-m="ed" onclick="treReadmeVer(false,this)">Escrever</button>
          <button data-m="ver" onclick="treReadmeVer(true,this)">Ver</button></span>
          <span class="small muted">Markdown — o mesmo que ele descreve.</span></div>
        <textarea id="tr-readme" class="mono tre-readme-txt" rows="30" oninput="$('#tr-salvar').disabled=false">${esc(treReadme())}</textarea>
        <div id="tr-readme-ver" class="tre-md tre-readme-ver" hidden></div>
        <div class="acts"><button class="btn solid" id="tr-salvar" disabled onclick="treReadmeSalvar()">${ic('check')} Salvar o README</button>
          ${proprio ? `<button class="btn ghost" onclick="treReadmeRestaurar()">${ic('refazer')} Voltar ao padrão</button>` : ''}</div></div>
      <aside class="tre-readme-lado">
        <div class="card"><h3>Como usar</h3><ol class="tre-passos-lista">
          <li>Baixe o README <b>com as referências</b> — a lista dos códigos de arquivo e de treinamento que existem, para o agente não inventar nenhum.</li>
          <li>Copie o <b>pedido-modelo</b> e complete: o tema, o público, as fontes e os vídeos.</li>
          <li>Entregue os dois ao agente. O que ele devolver, cole em <b>Novo treinamento › De um texto</b> ou, num que já existe, em <b>Importar texto</b>.</li>
          <li>Revise no editor, veja a pré-visualização e publique.</li></ol></div>
        <div class="card"><h3>O pedido-modelo</h3><pre class="tre-code tre-pedido">${esc(TRE_PEDIDO_MODELO)}</pre></div>
      </aside>
    </div>`;
}
function treReadmeVer(ver, bt){
  bt.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === bt));
  const ta = $('#tr-readme'), v = $('#tr-readme-ver');
  if (ver){ v.innerHTML = treMd(ta.value); }
  ta.hidden = ver; v.hidden = !ver;
}
async function treReadmeSalvar(){
  const txt = $('#tr-readme').value;
  const igual = txt.trim() === TRE_README_PADRAO.trim();
  const { error } = await sb.from('treinamento_config').update({ readme: igual ? null : txt }).eq('id', true);
  if (error) return toast('Não deu para salvar o README: ' + error.message, true);
  toast(igual ? 'É igual ao padrão: fica valendo o do portal.' : 'README salvo. É ele que desce, daqui em diante.');
  treConfig('readme');
}
async function treReadmeRestaurar(){
  if (!await confirma('Voltar ao README padrão do portal? O texto da equipe é apagado (a auditoria guarda quem mudou).', 'Voltar ao padrão')) return;
  const { error } = await sb.from('treinamento_config').update({ readme: null }).eq('id', true);
  if (error) return toast('Não deu: ' + error.message, true);
  toast('Voltou ao README padrão.'); treConfig('readme');
}
/* o README que desce. Com as referências, ganha um anexo com os
   códigos que existem de verdade — é o que impede o agente de
   inventar um NRO-PES-042 que ninguém nunca escreveu. */
async function treBaixarReadme(comRefs){
  if (!treino.cfg) await treConfigCarregar();
  let txt = treReadme().trimEnd() + '\n';
  if (comRefs){
    const [a, t] = await Promise.all([
      sb.from('doc_rol').select('codigo,titulo,status').order('codigo'),
      sb.from('treinamentos').select('codigo,titulo,status').eq('status', 'publicado').order('numero')]);
    const arqs = (a.data || []).filter(x => x.status !== 'obsoleto' && x.status !== 'rascunho');
    const trs = t.data || [];
    txt += `\n## Anexo · As referências que existem\n\nGerado pelo portal em ${new Date().toLocaleDateString('pt-BR')}. Só estes códigos existem — qualquer outro é invenção.\n`;
    txt += `\n### Arquivos (use arquivo:CÓDIGO)\n\n${arqs.length ? arqs.map(x => `- ${x.codigo} — ${x.titulo}`).join('\n') : '- (nenhum arquivo em vigor)'}\n`;
    txt += `\n### Treinamentos publicados (use treinamento:CÓDIGO)\n\n${trs.length ? trs.map(x => `- ${x.codigo} — ${x.titulo}`).join('\n') : '- (nenhum ainda)'}\n`;
  }
  treBaixarTexto(comRefs ? 'README-treinamentos-com-referencias.md' : 'README-treinamentos.md', txt);
}

/* ============================================================
   O CERTIFICADO
   Desenhado em canvas (A4 deitado, 10 px por milímetro, com as
   fontes e as marcas da casa) e posto num PDF, com uma camada de
   texto invisível por cima: o PDF se busca e se copia. A faixa
   Cortex à esquerda leva uma rede neural sorteada do código do
   certificado — cada certificado tem a sua, e a mesma sempre.
   ============================================================ */
const TRE_MARCAS = { nro:'studio/nro-imagotipo.png', labbio:'studio/labbio.png', simbolo:'studio/nro-simbolo.png' };
const treMarca = {};
let _treMarcas = null, _treFontes = null;
function treCarregarMarcas(){
  return _treMarcas || (_treMarcas = Promise.all(Object.entries(TRE_MARCAS).map(([k, src]) => new Promise(ok => {
    const i = new Image();
    i.onload = () => { try { treMarca[k] = treApara(i); } catch(e){} ok(); };
    i.onerror = () => ok();
    i.src = src;
  }))));
}
function treApara(img){
  const c = document.createElement('canvas'), w = c.width = img.naturalWidth, h = c.height = img.naturalHeight;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y += 2) for (let xx = 0; xx < w; xx += 2) if (d[(y * w + xx) * 4 + 3] > 24){
    if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 <= x0 || y1 <= y0) return c;
  const o = document.createElement('canvas'); o.width = x1 - x0 + 2; o.height = y1 - y0 + 2;
  o.getContext('2d').drawImage(c, x0, y0, o.width, o.height, 0, 0, o.width, o.height);
  return o;
}
function treTinta(src, cor){
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const x = c.getContext('2d'); x.drawImage(src, 0, 0);
  x.globalCompositeOperation = 'source-in'; x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
  return c;
}
function treFontes(){
  return _treFontes || (_treFontes = Promise.race([
    Promise.all(['700 100px Archivo', '600 100px Archivo', '500 100px Archivo', '500 30px "IBM Plex Mono"', '600 30px "IBM Plex Mono"']
      .map(f => document.fonts.load(f))).catch(() => {}),
    new Promise(ok => setTimeout(ok, 2500))]));
}
function treSorteio(semente){
  let h = 2166136261;
  for (const c of String(semente || '?')){ h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function treQuebra(x, texto, larg, max){
  const pal = String(texto || '').split(/\s+/).filter(Boolean), out = [];
  let l = '';
  for (const p of pal){ const t = l ? l + ' ' + p : p; if (x.measureText(t).width > larg && l){ out.push(l); l = p; } else l = t; }
  if (l) out.push(l);
  if (out.length > max){ const r = out.slice(0, max); r[max - 1] = r[max - 1].replace(/\s*\S*$/, '') + '…'; return r; }
  return out;
}
async function treCertificadoCanvas(c, cfg, k){
  await Promise.all([treCarregarMarcas(), treFontes()]);
  k = k || 1;
  const u = 10 * k, W = Math.round(297 * u), H = Math.round(210 * u);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  const F = (p, mm) => `${p} ${Math.max(1, Math.round(mm * u))}px Archivo, "Segoe UI", Arial, sans-serif`;
  const M = (p, mm) => `${p} ${Math.max(1, Math.round(mm * u))}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  const esp = mm => { if ('letterSpacing' in x) x.letterSpacing = (mm * u).toFixed(1) + 'px'; };
  const linha = (x0, y0, x1, y1) => { x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke(); };
  /* o papel */
  x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, W, H);
  const halo = x.createRadialGradient(W * .92, -H * .1, 0, W * .92, -H * .1, W * .62);
  halo.addColorStop(0, 'rgba(206,220,0,.13)'); halo.addColorStop(1, 'rgba(206,220,0,0)');
  x.fillStyle = halo; x.fillRect(0, 0, W, H);
  const B = 66 * u;
  x.strokeStyle = 'rgba(0,53,47,.05)'; x.lineWidth = Math.max(1, .14 * u);
  for (let gx = B + 10 * u; gx < W; gx += 10 * u) linha(gx, 0, gx, H);
  for (let gy = 10 * u; gy < H; gy += 10 * u) linha(B, gy, W, gy);
  /* a faixa Cortex, com a rede neural do certificado */
  const gb = x.createLinearGradient(0, 0, B * .7, H);
  gb.addColorStop(0, '#00594F'); gb.addColorStop(.55, '#00352F'); gb.addColorStop(1, '#012520');
  x.fillStyle = gb; x.fillRect(0, 0, B, H);
  const rnd = treSorteio(c.certificado);
  const pts = Array.from({ length:30 }, () => [(5 + rnd() * 56) * u, (6 + rnd() * 198) * u, rnd()]);
  x.lineWidth = .32 * u;
  pts.forEach((p, i) => pts.slice(i + 1).forEach(q => {
    const d = Math.hypot(p[0] - q[0], p[1] - q[1]), lim = 30 * u;
    if (d < lim){ x.strokeStyle = `rgba(206,220,0,${(.34 * (1 - d / lim)).toFixed(3)})`; linha(p[0], p[1], q[0], q[1]); } }));
  pts.forEach(p => { x.fillStyle = p[2] > .8 ? 'rgba(206,220,0,.9)' : 'rgba(45,212,191,.55)';
    x.beginPath(); x.arc(p[0], p[1], (p[2] > .8 ? 1.1 : .7) * u, 0, Math.PI * 2); x.fill(); });
  if (treMarca.simbolo){
    const s = treMarca.simbolo, h = 30 * u, w = h * s.width / s.height;
    x.fillStyle = 'rgba(1,37,32,.55)'; x.beginPath(); x.arc(B / 2, 40 * u, 24 * u, 0, Math.PI * 2); x.fill();
    x.drawImage(s, (B - w) / 2, 40 * u - h / 2, w, h);
  }
  x.save(); x.translate(B / 2 + 1.2 * u, H - 14 * u); x.rotate(-Math.PI / 2);
  x.font = M(500, 3.1); x.fillStyle = 'rgba(245,245,247,.78)'; esp(.9); x.textAlign = 'left';
  x.fillText('CERTIFICADO · NEURODYNAMICS · UFMG', 0, 0); x.restore(); esp(0);
  /* marcas de corte nos cantos do papel */
  x.strokeStyle = 'rgba(0,53,47,.35)'; x.lineWidth = .25 * u;
  [[W - 8 * u, 8 * u, -1, 1], [W - 8 * u, H - 8 * u, -1, -1]].forEach(([cx, cy, sx, sy]) => {
    linha(cx, cy, cx + sx * 6 * u, cy); linha(cx, cy, cx, cy + sy * 6 * u); });
  /* o topo: as duas marcas */
  const X0 = 88 * u, XR = W - 20 * u;
  if (treMarca.nro){ const s = treTinta(treMarca.nro, '#00352F'), h = 9.5 * u; x.drawImage(s, X0, 21 * u, h * s.width / s.height, h); }
  if (treMarca.labbio){ const s = treTinta(treMarca.labbio, '#00594F'), h = 10.5 * u, w = h * s.width / s.height; x.drawImage(s, XR - w, 20.5 * u, w, h); }
  /* o texto */
  x.fillStyle = '#CEDC00'; x.fillRect(X0, 49.3 * u, 2.3 * u, 2.3 * u);
  x.font = M(500, 3.4); x.fillStyle = '#45625B'; esp(.75); x.textBaseline = 'alphabetic';
  x.fillText('CERTIFICADO DE CONCLUSÃO', X0 + 5.2 * u, 51.9 * u); esp(0);
  x.font = F(500, 5); x.fillStyle = '#45625B'; x.fillText('Certificamos que', X0, 69 * u);
  let tam = 15.5; x.font = F(700, tam);
  while (x.measureText(c.nome).width > XR - X0 && tam > 8){ tam -= .5; x.font = F(700, tam); }
  x.fillStyle = '#0F1714'; esp(-.02 * tam); x.fillText(c.nome, X0, 87 * u); esp(0);
  x.font = F(500, 5); x.fillStyle = '#45625B'; x.fillText('concluiu o treinamento', X0, 102 * u);
  let tt = 10.5, ls;
  do { x.font = F(700, tt); ls = treQuebra(x, c.titulo, XR - X0, 2); tt -= .5; } while (ls.length > 1 && x.measureText(ls[0]).width > XR - X0 && tt > 6);
  x.fillStyle = '#00352F';
  const lh = (tt + .5) * 1.18 * u;
  ls.forEach((l, i) => x.fillText(l, X0, 116 * u + i * lh));
  let y = 116 * u + (ls.length - 1) * lh;
  x.fillStyle = '#CEDC00'; x.fillRect(X0, y + 5 * u, 26 * u, 1.4 * u);
  const meta = [`${c.codigo} · REV. ${c.revisao}`, c.carga_horaria_min ? 'CARGA HORÁRIA ' + treDuracao(c.carga_horaria_min).toUpperCase() : null,
    c.nota != null ? `NOTA ${c.nota}%` : null].filter(Boolean).join('   ·   ');
  x.font = M(500, 3.3); x.fillStyle = '#45625B'; esp(.45); x.fillText(meta, X0, y + 16 * u); esp(0);
  if ((c.modulos || []).length){
    x.font = F(500, 3.5); x.fillStyle = '#66726D';
    const txt = 'Conteúdo: ' + c.modulos.map((m, i) => `${i + 1}. ${m}`).join(' · ');
    treQuebra(x, txt, XR - X0, 2).forEach((l, i) => x.fillText(l, X0, y + 25 * u + i * 5 * u));
  }
  /* o pé: a data, a assinatura e o código */
  const yb = 187 * u;
  x.strokeStyle = 'rgba(0,53,47,.14)'; x.lineWidth = .25 * u; linha(X0, yb - 15 * u, XR, yb - 15 * u);
  const rot = (t, xx, al) => { x.font = M(500, 2.7); x.fillStyle = '#66726D'; esp(.55); x.textAlign = al || 'left'; x.fillText(t, xx, yb - 6 * u); esp(0); };
  rot('CONCLUÍDO EM', X0);
  x.font = F(600, 4.6); x.fillStyle = '#0F1714'; x.textAlign = 'left'; x.fillText(treDataLonga(c.concluido_em), X0, yb + 1.5 * u);
  const SX = X0 + 60 * u, SW = 56 * u;
  x.strokeStyle = '#00352F'; x.lineWidth = .3 * u; linha(SX, yb - 2 * u, SX + SW, yb - 2 * u);
  x.font = F(600, 4.1); x.fillStyle = '#0F1714'; x.textAlign = 'center';
  x.fillText(cfg?.assinatura_nome || 'Departamento de Pessoal', SX + SW / 2, yb + 4 * u);
  x.font = F(500, 3.1); x.fillStyle = '#66726D'; x.fillText(cfg?.assinatura_cargo || 'NeuroDynamics', SX + SW / 2, yb + 9 * u);
  rot('CÓDIGO DO CERTIFICADO', XR, 'right');
  x.font = M(600, 4.4); x.fillStyle = '#00352F'; esp(.3); x.textAlign = 'right'; x.fillText(c.certificado, XR, yb + 1.5 * u); esp(0);
  x.font = F(500, 2.8); x.fillStyle = '#66726D'; x.fillText('Confira em membro.neurodynamics.dev', XR, yb + 7 * u);
  x.textAlign = 'left';
  return cv;
}
async function treCertificadoPDF(c, cfg){
  if (!window.jspdf) await carregarLib(TRE_CDN_PDF);
  const cv = await treCertificadoCanvas(c, cfg, 1);
  const pdf = new jspdf.jsPDF({ orientation:'landscape', unit:'mm', format:'a4', compress:true });
  pdf.setProperties({ title:`Certificado · ${c.codigo} · ${c.nome}`, subject:c.titulo, author:'NeuroDynamics',
    keywords:[c.certificado, c.codigo, 'Rev. ' + c.revisao].join(', '), creator:'Portal do Membro · NeuroDynamics' });
  pdf.addImage(cv.toDataURL('image/jpeg', .93), 'JPEG', 0, 0, 297, 210);
  /* a camada de texto, invisível: busca e cópia no PDF */
  pdf.setFontSize(9);
  [[c.nome, 88, 87], [c.titulo, 88, 116], [`${c.codigo} Rev. ${c.revisao}`, 88, 132], [treDataLonga(c.concluido_em), 88, 188], [c.certificado, 240, 188]]
    .forEach(([t, xx, yy]) => { try { pdf.text(String(t || ''), xx, yy, { renderingMode:'invisible' }); } catch(e){} });
  const nome = `certificado-${c.codigo}-rev-${c.revisao}-${treSlug(c.nome)}.pdf`.toLowerCase();
  pdf.save(nome);
  return nome;
}
async function treBaixarCertificado(codigo, bt){
  if (bt) bt.disabled = true;
  try {
    const [c] = await Promise.all([sb.from('treinamento_conclusoes').select('*').eq('certificado', codigo).maybeSingle(),
      treino.cfg ? null : treConfigCarregar()]);
    if (c.error) throw c.error;
    if (!c.data) throw new Error('certificado não encontrado');
    await treCertificadoPDF(c.data, treino.cfg);
  } catch(e){ falha(e, 'Não deu para gerar o certificado'); }
  finally { if (bt) bt.disabled = false; }
}

/* A busca dos treinamentos mora na casca: é ela que lê a lista no
   login (o início precisa dela), e treCarregarLista a mantém em dia
   em state.treMeus. */
