/* ============================================================
   MÓDULO · BIBLIOTECA (2.19.2)
   A Biblioteca, o catálogo colaborativo de ferramentas da equipe: softwares, repositórios,
   serviços, benefícios de estudante e a gravação de microcontroladores.
   Qualquer membro adiciona itens, edita, avalia (1 a 5 estrelas) e comenta; só a
   gestão marca "NRO Standard". O banco é db/2.19.2_recursos.sql.

     #/biblioteca                galeria, com os filtros na lateral
     #/biblioteca/novo           adicionar (basta o endereço, o nome e o que faz)
     #/biblioteca/<slug>         a página do item
     #/biblioteca/<slug>/editar  editar

   Depende da casca para: sb, $, esc, state, toast, cabecalho, estado, ic,
   layoutObjeto, spec, fmtD, fmtDT, VERSAO.
   Os nomes daqui começam com rcs (nenhum outro módulo usa).
   ============================================================ */

const RCS_TIPOS = [['software', 'Software'], ['extensao', 'Extensão'], ['repositorio', 'Repositório'], ['servico', 'Serviço'], ['base', 'Base de pesquisa'], ['beneficio', 'Benefício'], ['referencia', 'Referência']];
const RCS_ACESSO = [['gratis', 'Gratuito'], ['freemium', 'Plano gratuito'], ['pago', 'Pago'], ['estudante', 'Grátis para estudantes'], ['labbio', 'Licença NRO/LABBIO']];
const RCS_PLATS = ['Windows', 'macOS', 'Linux', 'Web', 'VS Code', 'Chrome', 'Firefox', 'Edge', 'Safari', 'Android', 'iOS'];
const RCS_ORDENS = [['destaque', 'Em destaque'], ['nome', 'Nome'], ['nota', 'Melhor avaliados'], ['comentarios', 'Mais comentados'], ['recentes', 'Mais recentes']];
const RCS_ESTRELA = 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z';
const rcsRot = (lista, k) => (lista.find(([v]) => v === k) || [, k])[1];
const rcsFiltroVazio = () => ({ q:'', tipo:[], acesso:[], plat:[], tags:[], status:'ativo', padrao:false, nota:0, ordem:'destaque' });
const rcsM = { lista:null, gestao:false, f:rcsFiltroVazio(), tagQ:'', tagsTodas:false, painel:false, item:null, form:null };

const rcsNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const rcsHost = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e){ return ''; } };
/* a logo: a que foi informada, o avatar do dono (GitHub) ou o ícone do site */
function rcsLogoDe(url){
  try {
    const u = new URL(url), h = u.hostname.replace(/^www\./, '');
    if (h === 'github.com'){ const dono = u.pathname.split('/')[1]; if (dono) return `https://github.com/${encodeURIComponent(dono)}.png?size=96`; }
    return h ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=128` : '';
  } catch(e){ return ''; }
}
/* o publicador sugerido pelo endereço: o dono no GitHub, ou o nome do site */
function rcsPublicadorDe(url){
  try {
    const u = new URL(url), h = u.hostname.replace(/^www\./, '');
    if (h === 'github.com') return u.pathname.split('/')[1] || '';
    const p = h.split('.'); const nome = p.length > 2 && /^(co|com|org|gov|edu)$/.test(p[p.length - 2]) ? p[p.length - 3] : p[Math.max(0, p.length - 2)];
    return nome ? nome[0].toUpperCase() + nome.slice(1) : '';
  } catch(e){ return ''; }
}
const rcsIni = nome => String(nome || '?').trim().split(/[\s\-_.]+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';
function rcsLogo(r, px){
  const src = r.logo_url || rcsLogoDe(r.url);
  return `<span class="rcs-logo" style="--px:${px}px" data-ini="${esc(rcsIni(r.nome))}" aria-hidden="true">${src
    ? `<img src="${esc(src)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">` : ''}</span>`;
}
const rcsNum = n => Number(n).toLocaleString('pt-BR', { minimumFractionDigits:1, maximumFractionDigits:1 });
/* as estrelas: média em cinco estrelas preenchidas por partes, mais o texto */
function rcsEstrelas(media, n, { texto = true } = {}){
  const m = Number(media) || 0, pct = Math.round(m / 5 * 100);
  if (!n) return `<span class="rcs-est vazia" role="img" aria-label="Ainda sem avaliações"><svg class="rcs-est-um" width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="${RCS_ESTRELA}"/></svg><span class="rcs-est-tx">?</span></span>`;
  const cinco = `<span class="rcs-cinco" aria-hidden="true">${Array.from({ length:5 }, () => `<svg width="14" height="14" viewBox="0 0 24 24"><path d="${RCS_ESTRELA}"/></svg>`).join('')}</span>`;
  const rot = `Nota ${rcsNum(m)} de 5, ${n} ${n === 1 ? 'avaliação' : 'avaliações'}`;
  return `<span class="rcs-est" role="img" aria-label="${rot}"><span class="rcs-est-f"><span class="rcs-est-base">${cinco}</span><span class="rcs-est-cheia" style="width:${pct}%">${cinco}</span></span>${texto
    ? `<span class="rcs-est-tx"><b>${rcsNum(m)}</b> (${n})</span>` : ''}</span>`;
}
/* o texto das instruções: passos numerados, listas com "-", `código` e endereços; uma linha só de código vira bloco com Copiar */
function rcsTexto(t){
  const inline = s => String(s).split(/(`[^`]+`)/).map(seg => /^`[^`]+`$/.test(seg) ? `<code>${esc(seg.slice(1, -1))}</code>`
    : esc(seg).replace(/(https?:\/\/[^\s<]+[^\s<.,;:)])/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')).join('');
  let html = '', lista = null;
  const fecha = () => { if (lista){ html += `</${lista}>`; lista = null; } };
  for (const bruta of String(t || '').replace(/\r/g, '').split('\n')){
    const l = bruta.trim();
    if (!l){ fecha(); continue; }
    let m;
    if ((m = /^`([^`]+)`$/.exec(l))){ fecha(); html += `<div class="rcs-cod"><code>${esc(m[1])}</code><button type="button" class="btn ghost mini" data-rcs-copiar="${esc(m[1])}" aria-label="Copiar o comando">${ic('copy')}<span>Copiar</span></button></div>`; }
    else if ((m = /^\d+[.)]\s+(.*)$/.exec(l))){ if (lista !== 'ol'){ fecha(); html += '<ol>'; lista = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
    else if ((m = /^[-*]\s+(.*)$/.exec(l))){ if (lista !== 'ul'){ fecha(); html += '<ul>'; lista = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
    else { fecha(); html += `<p>${inline(l)}</p>`; }
  }
  fecha(); return html;
}

/* ---------------- a rota ---------------- */
async function pageRecursos(sub, sub2){
  if (!sub) return rcsGaleria();
  if (sub === 'novo') return rcsFormulario(null);
  return sub2 === 'editar' ? rcsFormulario(sub) : rcsPagina(sub);
}
async function rcsCarregar(forcar){
  if (rcsM.lista && !forcar) return true;
  const { data, error } = await sb.rpc('recursos_listar');
  if (error || data?.status !== 'ok') return false;
  rcsM.lista = data.recursos || []; rcsM.gestao = !!data.gestao; return true;
}

/* ============================================================
   A GALERIA
   ============================================================ */
function rcsPassa(r, f, ign){
  if (ign !== 'q' && f.q){
    const hay = rcsNorm([r.nome, r.publicador, r.funcao, (r.tags || []).join(' ')].join(' '));
    if (!rcsNorm(f.q).split(/\s+/).filter(Boolean).every(w => hay.includes(w))) return false;
  }
  if (ign !== 'status' && f.status !== 'todos' && r.status !== f.status) return false;
  if (ign !== 'padrao' && f.padrao && !r.padrao_nro) return false;
  if (ign !== 'tipo' && f.tipo.length && !f.tipo.includes(r.tipo)) return false;
  if (ign !== 'acesso' && f.acesso.length && !f.acesso.some(a => (r.acesso || []).includes(a))) return false;
  if (ign !== 'plat' && f.plat.length && !f.plat.some(a => (r.plataformas || []).includes(a))) return false;
  if (ign !== 'tags' && f.tags.length && !f.tags.every(t => (r.tags || []).includes(t))) return false;
  if (ign !== 'nota' && f.nota && !(Number(r.media || 0) >= f.nota)) return false;
  return true;
}
function rcsOrdenar(lista, ordem){
  const nome = (a, b) => a.nome.localeCompare(b.nome, 'pt', { sensitivity:'base' });
  const l = lista.slice();
  if (ordem === 'nome') return l.sort(nome);
  if (ordem === 'nota') return l.sort((a, b) => (Number(b.media) || 0) - (Number(a.media) || 0) || b.avaliacoes - a.avaliacoes || nome(a, b));
  if (ordem === 'comentarios') return l.sort((a, b) => b.comentarios - a.comentarios || nome(a, b));
  if (ordem === 'recentes') return l.sort((a, b) => String(b.criado_em).localeCompare(String(a.criado_em)) || nome(a, b));
  return l.sort((a, b) => (b.padrao_nro - a.padrao_nro) || (Number(b.media) || 0) * Math.min(b.avaliacoes, 3) - (Number(a.media) || 0) * Math.min(a.avaliacoes, 3) || nome(a, b));
}
async function rcsGaleria(){
  $('#main').innerHTML = cabecalho({ espaco:'Equipe', titulo:'Biblioteca', lead:'As ferramentas que a equipe usa, conhece e quer testar: os padrões, os softwares, a gravação de placas, os benefícios de estudante. Qualquer pessoa pode adicionar, avaliar e comentar.' }) + estado.carregando();
  if (!await rcsCarregar(true)){
    $('#main').innerHTML = cabecalho({ espaco:'Equipe', titulo:'Biblioteca' }) + estado.erro({ texto:'Não foi possível carregar a Biblioteca agora.',
      acao:'<button class="btn ghost mini" type="button" onclick="rcsGaleria()">Tentar de novo</button>' });
    return;
  }
  $('#main').innerHTML = cabecalho({ espaco:'Equipe', titulo:'Biblioteca',
      lead:'As ferramentas que a equipe usa, conhece e quer testar: os padrões, os softwares, a gravação de placas, os benefícios de estudante. Qualquer pessoa pode adicionar, avaliar e comentar.',
      acoes:'<a class="btn solid rcs-mais" href="#/biblioteca/novo" id="rcs-novo" title="Adicionar item" aria-label="Adicionar item">' + ic('plus') + '</a>' }) + `
    <div class="rcs-layout">
      <aside class="rcs-filtros${rcsM.painel ? ' aberto' : ''}" id="rcs-filtros" aria-label="Filtros da Biblioteca">
        <div class="fld busca"><label for="rcs-q">Buscar</label><input id="rcs-q" type="search" placeholder="Nome, tag ou o que faz" autocomplete="off" value="${esc(rcsM.f.q)}"></div>
        <div id="rcs-fac"></div>
      </aside>
      <section class="rcs-corpo" aria-label="Itens da Biblioteca">
        <div class="rcs-topo"><button type="button" class="btn ghost mini rcs-abre" id="rcs-abre" aria-expanded="${rcsM.painel}" aria-controls="rcs-filtros">Filtros <span id="rcs-nf"></span></button>
          <span class="total" id="rcs-total" aria-live="polite"></span>
          <div class="fld rcs-ord"><label for="rcs-ordem">Ordenar</label><select id="rcs-ordem">${RCS_ORDENS.map(([k, l]) => `<option value="${k}"${rcsM.f.ordem === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div></div>
        <div class="rcs-grade" id="rcs-grade"></div>
      </section>
    </div>`;
  $('#rcs-q').addEventListener('input', e => { rcsM.f.q = e.target.value; rcsAtualizar(false); });
  $('#rcs-ordem').addEventListener('change', e => { rcsM.f.ordem = e.target.value; rcsAtualizar(false); });
  $('#rcs-abre').addEventListener('click', e => { rcsM.painel = !rcsM.painel; $('#rcs-filtros').classList.toggle('aberto', rcsM.painel); e.currentTarget.setAttribute('aria-expanded', String(rcsM.painel)); });
  $('#rcs-filtros').addEventListener('change', rcsAoMarcar);
  $('#rcs-filtros').addEventListener('input', e => { if (e.target.id === 'rcs-tag-q'){ rcsM.tagQ = e.target.value; rcsAtualizar(true, 'rcs-tag-q'); } });
  $('#rcs-filtros').addEventListener('click', e => {
    const b = e.target.closest('[data-rcs]'); if (!b) return;
    if (b.dataset.rcs === 'limpar'){ const { ordem, q } = rcsM.f; rcsM.f = { ...rcsFiltroVazio(), ordem, q }; rcsM.tagQ = ''; rcsAtualizar(true); }
    else if (b.dataset.rcs === 'mais-tags'){ rcsM.tagsTodas = !rcsM.tagsTodas; rcsAtualizar(true, 'rcs-mais-tags'); }
  });
  rcsAtualizar(true);
}
/* uma caixa marcada ou um botão de opção: atualiza o filtro e a galeria */
function rcsAoMarcar(e){
  const c = e.target, g = c.dataset.rcsG; if (!g) return;
  const f = rcsM.f;
  if (g === 'padrao') f.padrao = c.checked;
  else if (g === 'status' || g === 'nota') f[g] = g === 'nota' ? Number(c.value) : c.value;
  else { const v = c.value; f[g] = c.checked ? [...new Set([...f[g], v])] : f[g].filter(x => x !== v); }
  rcsAtualizar(true, c.id);
}
function rcsAtualizar(painel, foco){
  const f = rcsM.f, todos = rcsM.lista;
  const vis = rcsOrdenar(todos.filter(r => rcsPassa(r, f)), f.ordem);
  const grade = $('#rcs-grade'); if (!grade) return;
  $('#rcs-total').innerHTML = `<b>${vis.length}</b> ${vis.length === 1 ? 'item' : 'itens'}`;
  const ativos = f.tipo.length + f.acesso.length + f.plat.length + f.tags.length + (f.padrao ? 1 : 0) + (f.nota ? 1 : 0) + (f.status !== 'ativo' ? 1 : 0);
  $('#rcs-nf').textContent = ativos ? `(${ativos})` : '';
  grade.innerHTML = vis.length ? vis.map(rcsCartao).join('') : `<div class="rcs-vazio">${estado.vazio({ texto:'Nenhum item com estes filtros.',
    acao:'<button type="button" class="btn ghost mini" data-rcs="limpar" onclick="document.querySelector(\'#rcs-filtros [data-rcs=limpar]\')?.click()">Limpar os filtros</button>' })}</div>`;
  if (painel) rcsFacetas(foco);
}
function rcsCartao(r){
  const marcas = [r.padrao_nro ? '<span class="rcs-padrao">NRO Standard</span>' : '', r.status === 'inativo' ? '<span class="rcs-inativo">Inativo</span>' : ''].filter(Boolean).join('');
  return `<a class="rcs-card${r.status === 'inativo' ? ' inativo' : ''}" href="#/biblioteca/${encodeURIComponent(r.slug)}">
    ${rcsLogo(r, 52)}
    <span class="rcs-nome">${esc(r.nome)}</span>
    <span class="rcs-pub">${esc(r.publicador || rcsHost(r.url))}</span>
    <span class="rcs-meta"><span class="rcs-tipo">${esc(rcsRot(RCS_TIPOS, r.tipo))}</span>${rcsEstrelas(r.media, r.avaliacoes)}</span>
    ${marcas ? `<span class="rcs-marcas">${marcas}</span>` : ''}</a>`;
}
/* os grupos de filtro, com a contagem de cada opção sem contar o próprio grupo */
function rcsFacetas(foco){
  const f = rcsM.f, el = $('#rcs-fac'); if (!el) return;
  const conta = (grupo, valores) => { const base = rcsM.lista.filter(r => rcsPassa(r, f, grupo)); const n = {};
    base.forEach(r => valores(r).forEach(v => { n[v] = (n[v] || 0) + 1; })); return n; };
  const grupo = (g, titulo, ops, n, sel) => `<fieldset class="rcs-grupo"><legend>${titulo}</legend>${ops.map(([v, l]) => `<label class="rcs-op${(n[v] || 0) === 0 && !sel.includes(v) ? ' zero' : ''}">
      <input type="checkbox" id="rcs-${g}-${esc(String(v).replace(/\W/g, '_'))}" data-rcs-g="${g}" value="${esc(v)}"${sel.includes(v) ? ' checked' : ''}><span>${esc(l)}</span><span class="n">${n[v] || 0}</span></label>`).join('')}</fieldset>`;
  const nTipo = conta('tipo', r => [r.tipo]), nAc = conta('acesso', r => r.acesso || []), nPl = conta('plat', r => r.plataformas || []), nTag = conta('tags', r => r.tags || []);
  const plats = [...new Set([...RCS_PLATS, ...rcsM.lista.flatMap(r => r.plataformas || [])])].filter(p => nPl[p] || f.plat.includes(p) || RCS_PLATS.includes(p));
  const tagsOrd = Object.keys(nTag).sort((a, b) => nTag[b] - nTag[a] || a.localeCompare(b, 'pt', { sensitivity:'base' }));
  const buscaTag = rcsNorm(rcsM.tagQ);
  let tags = [...new Set([...f.tags, ...tagsOrd])].filter(t => !buscaTag || rcsNorm(t).includes(buscaTag));
  const total = tags.length; if (!rcsM.tagsTodas && !buscaTag) tags = tags.slice(0, Math.max(14, f.tags.length));
  const nNota = { 3: rcsM.lista.filter(r => rcsPassa(r, f, 'nota') && Number(r.media) >= 3).length, 4: rcsM.lista.filter(r => rcsPassa(r, f, 'nota') && Number(r.media) >= 4).length };
  el.innerHTML = `
    <fieldset class="rcs-grupo"><legend>Situação</legend><div class="rcs-seg" role="radiogroup" aria-label="Situação">${[['ativo', 'Ativos'], ['inativo', 'Inativos'], ['todos', 'Todos']].map(([v, l]) =>
      `<label><input type="radio" name="rcs-status" id="rcs-status-${v}" data-rcs-g="status" value="${v}"${f.status === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div>
      <label class="rcs-op"><input type="checkbox" id="rcs-padrao" data-rcs-g="padrao"${f.padrao ? ' checked' : ''}><span>Só o NRO Standard</span><span class="n">${rcsM.lista.filter(r => r.padrao_nro && rcsPassa(r, f, 'padrao')).length}</span></label></fieldset>
    ${grupo('tipo', 'Tipo', RCS_TIPOS, nTipo, f.tipo)}
    ${grupo('acesso', 'Acesso', RCS_ACESSO, nAc, f.acesso)}
    ${grupo('plat', 'Plataforma', plats.map(p => [p, p]), nPl, f.plat)}
    <fieldset class="rcs-grupo"><legend>Avaliação mínima</legend><div class="rcs-seg" role="radiogroup" aria-label="Avaliação mínima">${[[0, 'Qualquer'], [3, '3 ou mais'], [4, '4 ou mais']].map(([v, l]) =>
      `<label><input type="radio" name="rcs-nota" id="rcs-nota-${v}" data-rcs-g="nota" value="${v}"${f.nota === v ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
    <fieldset class="rcs-grupo"><legend>Tags</legend>
      <div class="fld rcs-tag-busca"><label for="rcs-tag-q" class="rcs-sr">Procurar uma tag</label><input id="rcs-tag-q" type="search" placeholder="Procurar uma tag" autocomplete="off" value="${esc(rcsM.tagQ)}"></div>
      ${tags.map(t => `<label class="rcs-op${f.tags.includes(t) ? '' : (nTag[t] ? '' : ' zero')}"><input type="checkbox" id="rcs-tags-${esc(String(t).replace(/\W/g, '_'))}" data-rcs-g="tags" value="${esc(t)}"${f.tags.includes(t) ? ' checked' : ''}><span>${esc(t)}</span><span class="n">${nTag[t] || 0}</span></label>`).join('')
        || '<p class="rcs-nada">Nenhuma tag com esse nome.</p>'}
      ${!buscaTag && total > 14 ? `<button type="button" class="rcs-mais" id="rcs-mais-tags" data-rcs="mais-tags">${rcsM.tagsTodas ? 'Mostrar menos' : `Mostrar as ${total} tags`}</button>` : ''}
    </fieldset>
    <button type="button" class="btn ghost mini rcs-limpar" data-rcs="limpar">Limpar os filtros</button>`;
  if (foco){ const alvo = document.getElementById(foco); if (alvo){ alvo.focus({ preventScroll:true }); if (alvo.type === 'search') alvo.setSelectionRange(alvo.value.length, alvo.value.length); } }
}

/* ============================================================
   A PÁGINA DO RECURSO
   ============================================================ */
async function rcsPagina(slug){
  $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo:'Item', voltar:['Biblioteca', '#/biblioteca'] }) + estado.carregando();
  const { data, error } = await sb.rpc('recurso_ler', { p_slug:slug });
  if (error || data?.status !== 'ok'){
    $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo:'Item', voltar:['Biblioteca', '#/biblioteca'] }) + (data?.status === 'nao_encontrado'
      ? estado.vazio({ texto:'Este item não existe (ou foi renomeado).', acao:'<a class="btn ghost mini" href="#/biblioteca">Ver toda a Biblioteca</a>' })
      : estado.erro({ texto:'Não foi possível carregar o recurso agora.', acao:`<button class="btn ghost mini" type="button" onclick="rcsPagina('${esc(slug)}')">Tentar de novo</button>` }));
    return;
  }
  rcsM.item = data.recurso; rcsM.gestao = !!data.gestao;
  rcsDesenharPagina();
}
function rcsDesenharPagina(){
  const r = rcsM.item; if (!r) return;
  const secao = (id, titulo, corpo, extra = '') => `<section class="card rcs-sec" id="${id}" aria-labelledby="${id}-t"><div class="rcs-sec-cab"><h2 id="${id}-t">${titulo}</h2>${extra}</div>${corpo}</section>`;
  const vazioInstr = '<p class="rcs-nada">Ainda sem instruções. Sabe como se faz? <a href="#/biblioteca/' + encodeURIComponent(r.slug) + '/editar">Edite e conte para a equipe</a>.</p>';
  const meta = [`<span>${esc(r.publicador || rcsHost(r.url))}</span>`, `<span>${esc(rcsRot(RCS_TIPOS, r.tipo))}</span>`,
    r.padrao_nro ? '<span class="rcs-padrao">NRO Standard</span>' : '', r.status === 'inativo' ? '<span class="rcs-inativo">Inativo</span>' : ''].filter(Boolean);
  const principal = `
    ${secao('rcs-faz', 'O que faz', `<p class="rcs-faz">${esc(r.funcao)}</p>`)}
    ${secao('rcs-baixar', 'Como baixar ou acessar', r.instrucoes_baixar ? `<div class="rcs-texto">${rcsTexto(r.instrucoes_baixar)}</div>` : vazioInstr)}
    ${secao('rcs-usar', 'Como começar a usar e configurar', r.instrucoes_usar ? `<div class="rcs-texto">${rcsTexto(r.instrucoes_usar)}</div>` : vazioInstr)}
    ${secao('rcs-coment', `Comentários <span class="rcs-conta" id="rcs-conta">${r.comentarios}</span>`, `<div id="rcs-lista">${rcsComentarios(r.comentarios_lista)}</div>
      <form class="rcs-form-com" id="rcs-form-com" onsubmit="rcsComentar(event)"><div class="fld"><label for="rcs-com-txt">Seu comentário</label>
        <textarea id="rcs-com-txt" rows="3" maxlength="2000" placeholder="Como foi usar? Deu certo? Alguma dica ou problema?"></textarea></div>
        <button class="btn solid" type="submit" id="rcs-com-bt">Comentar</button></form>`)}`;
  const lateral = `
    <div class="rcs-lat-logo">${rcsLogo(r, 84)}</div>
    <a class="btn solid rcs-abrir" href="${esc(r.url)}" target="_blank" rel="noopener" id="rcs-abrir">Abrir o site</a>
    <div class="rcs-aval" id="rcs-aval">${rcsAvaliacaoHTML(r)}</div>
    ${spec([['Publicador', esc(r.publicador || rcsHost(r.url))], ['Tipo', esc(rcsRot(RCS_TIPOS, r.tipo))],
      ['Acesso', (r.acesso || []).map(a => esc(rcsRot(RCS_ACESSO, a))).join(', ') || '—'],
      ['Plataformas', (r.plataformas || []).map(esc).join(', ') || '—'],
      ['Endereço', `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="rcs-url">${esc(rcsHost(r.url) + (new URL(r.url).pathname.length > 1 ? '/…' : ''))}</a>`],
      ['Adicionado', r.criado_por_nome ? esc(r.criado_por_nome) + ', ' + fmtD(r.criado_em) : fmtD(r.criado_em)],
      ['Editado', r.atualizado_por_nome ? esc(r.atualizado_por_nome) + ', ' + fmtD(r.atualizado_em) : fmtD(r.atualizado_em)]])}
    ${(r.tags || []).length ? `<div class="rcs-tags" aria-label="Tags">${r.tags.map(t => `<a class="rcs-tag" href="#/biblioteca" data-rcs-tag="${esc(t)}">${esc(t)}</a>`).join('')}</div>` : ''}`;
  $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo:r.nome, voltar:['Biblioteca', '#/biblioteca'], meta,
    acoes:`<a class="btn ghost" href="#/biblioteca/${encodeURIComponent(r.slug)}/editar" id="rcs-editar">${ic('pencil')} Editar</a>` }) + layoutObjeto(principal, lateral);
}
/* a avaliação: a média de todos e as cinco estrelas para dar a sua */
function rcsAvaliacaoHTML(r){
  const minha = r.minha || 0;
  return `<div class="rcs-aval-media">${rcsEstrelas(r.media, r.avaliacoes)}</div>
    <div class="rcs-aval-minha" role="radiogroup" aria-label="Sua avaliação"><span class="rcs-aval-rot">${minha ? 'Sua nota' : 'Dê a sua nota'}</span>
      <span class="rcs-aval-bts">${[1, 2, 3, 4, 5].map(n => `<button type="button" role="radio" aria-checked="${minha === n}" aria-label="${n} ${n === 1 ? 'estrela' : 'estrelas'}" class="rcs-estr${n <= minha ? ' on' : ''}" data-rcs-nota="${n}"><svg width="22" height="22" viewBox="0 0 24 24"><path d="${RCS_ESTRELA}"/></svg></button>`).join('')}</span>
      ${minha ? '<button type="button" class="rcs-tirar" data-rcs-nota="0">Tirar a minha nota</button>' : ''}</div>`;
}
function rcsComentarios(lista){
  if (!lista?.length) return '<p class="rcs-nada" id="rcs-sem-com">Ninguém comentou ainda. Seja a primeira pessoa.</p>';
  return `<ul class="rcs-coms">${lista.map(c => `<li data-id="${esc(c.id)}"><div class="rcs-com-cab"><b>${esc(c.autor)}</b><time datetime="${esc(c.criado_em)}">${esc(fmtDT(c.criado_em))}</time>
    ${c.pode_apagar ? `<button type="button" class="rcs-apagar" data-rcs-apagar="${esc(c.id)}" aria-label="Apagar o comentário de ${esc(c.autor)}">${ic('trash')}</button>` : ''}</div>
    <p>${esc(c.texto)}</p></li>`).join('')}</ul>`;
}
async function rcsAvaliar(n){
  const r = rcsM.item; if (!r) return;
  const { data, error } = await sb.rpc('recurso_avaliar', { p_slug:r.slug, p_estrelas:n });
  if (error || data?.status !== 'ok') return toast('Não foi possível registrar a nota agora.', true);
  Object.assign(r, { media:data.recurso.media, avaliacoes:data.recurso.avaliacoes, minha:data.recurso.minha });
  if (rcsM.lista){ const x = rcsM.lista.find(y => y.slug === r.slug); if (x) Object.assign(x, { media:r.media, avaliacoes:r.avaliacoes, minha:r.minha }); }
  const el = $('#rcs-aval'); if (el) el.innerHTML = rcsAvaliacaoHTML(r);
  document.querySelector(`#rcs-aval [data-rcs-nota="${n || 1}"]`)?.focus();
  toast(n ? 'Nota registrada.' : 'Nota retirada.');
}
async function rcsComentar(ev){
  ev.preventDefault();
  const r = rcsM.item, t = $('#rcs-com-txt'), b = $('#rcs-com-bt'); if (!r || !t.value.trim()) { t.focus(); return; }
  b.disabled = true;
  const { data, error } = await sb.rpc('recurso_comentar', { p_slug:r.slug, p_texto:t.value });
  b.disabled = false;
  if (error || data?.status !== 'ok') return toast('Não foi possível publicar o comentário.', true);
  t.value = ''; rcsAtualizarComentarios(data.comentarios_lista); toast('Comentário publicado.');
}
function rcsAtualizarComentarios(lista){
  const r = rcsM.item; r.comentarios_lista = lista; r.comentarios = lista.length;
  if (rcsM.lista){ const x = rcsM.lista.find(y => y.slug === r.slug); if (x) x.comentarios = lista.length; }
  $('#rcs-lista').innerHTML = rcsComentarios(lista); $('#rcs-conta').textContent = lista.length;
}
async function rcsApagarComentario(id){
  const { data, error } = await sb.rpc('recurso_comentario_apagar', { p_id:id });
  if (error || data?.status !== 'ok') return toast('Não foi possível apagar o comentário.', true);
  rcsAtualizarComentarios(data.comentarios_lista); toast('Comentário apagado.');
}

/* ============================================================
   ADICIONAR E EDITAR
   ============================================================ */
async function rcsFormulario(slug){
  const titulo = slug ? 'Editar item' : 'Adicionar item';
  $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo, voltar:['Biblioteca', slug ? '#/biblioteca/' + encodeURIComponent(slug) : '#/biblioteca'] }) + estado.carregando();
  let r = { id:null, url:'', nome:'', publicador:'', logo_url:'', tipo:'software', funcao:'', instrucoes_baixar:'', instrucoes_usar:'', tags:[], plataformas:[], acesso:[], status:'ativo', padrao_nro:false };
  if (slug){
    const { data, error } = await sb.rpc('recurso_ler', { p_slug:slug });
    if (error || data?.status !== 'ok'){ $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo, voltar:['Biblioteca', '#/biblioteca'] }) + estado.vazio({ texto:'Este recurso não existe.' }); return; }
    r = { ...r, ...data.recurso }; rcsM.gestao = !!data.gestao;
  } else await rcsCarregar();
  const sugestoes = [...new Set((rcsM.lista || []).flatMap(x => x.tags || []))].sort((a, b) => a.localeCompare(b, 'pt', { sensitivity:'base' }));
  rcsM.form = { slug, r, tags:[...(r.tags || [])], sugestoes, tocouNome:!!r.nome, tocouPub:!!r.publicador, erro:{} };
  const f = rcsM.form;
  const plats = [...new Set([...RCS_PLATS, ...(r.plataformas || [])])];
  const campo = (id, rot, corpo, ajuda = '') => `<div class="fld" id="rcs-f-${id}"><label for="rcs-${id}">${rot}</label>${corpo}${ajuda ? `<span class="hint">${ajuda}</span>` : ''}<span class="msg" id="rcs-e-${id}" role="alert"></span></div>`;
  $('#main').innerHTML = cabecalho({ espaco:'Biblioteca', titulo, voltar:['Biblioteca', slug ? '#/biblioteca/' + encodeURIComponent(slug) : '#/biblioteca'],
    lead: slug ? 'Qualquer pessoa pode melhorar a descrição, as instruções e as tags. A alteração fica registrada com o seu nome.' : 'Cole o endereço da ferramenta, diga o nome e o que ela faz. O resto (instruções, tags) dá para completar agora ou depois, e qualquer pessoa pode melhorar.' }) + `
    <form class="rcs-form" id="rcs-form" onsubmit="rcsSalvar(event)" novalidate>
      <div class="rcs-form-topo">
        <div class="rcs-form-logo" id="rcs-prev">${rcsLogo({ nome:r.nome || '?', url:r.url, logo_url:r.logo_url }, 64)}</div>
        <div class="rcs-form-campos">
          ${campo('url', 'Endereço (link) da ferramenta', `<input id="rcs-url" type="url" inputmode="url" placeholder="https://" value="${esc(r.url)}" autocomplete="off" required>`,
            'A logo vem do endereço. No GitHub, é a do dono do repositório.')}
          <div class="rcs-dupla">
            ${campo('nome', 'Nome', `<input id="rcs-nome" value="${esc(r.nome)}" maxlength="120" autocomplete="off" required>`)}
            ${campo('publicador', 'Quem publica', `<input id="rcs-publicador" value="${esc(r.publicador || '')}" maxlength="120" autocomplete="off">`, 'A empresa, a pessoa ou a organização.')}
          </div>
        </div>
      </div>
      ${campo('funcao', 'O que ele faz', `<textarea id="rcs-funcao" rows="3" maxlength="600" required placeholder="Em uma ou duas frases: para que serve e por que a equipe usaria.">${esc(r.funcao)}</textarea>`,
        '<span id="rcs-funcao-n">' + (600 - r.funcao.length) + '</span> caracteres restantes. Diga a função com clareza: é isto que aparece primeiro na página.')}
      <div class="rcs-dupla">
        ${campo('tipo', 'Tipo', `<select id="rcs-tipo">${RCS_TIPOS.map(([k, l]) => `<option value="${k}"${r.tipo === k ? ' selected' : ''}>${l}</option>`).join('')}</select>`)}
        ${campo('status', 'Situação', `<select id="rcs-status"><option value="ativo"${r.status === 'ativo' ? ' selected' : ''}>Ativo (a equipe pode usar)</option><option value="inativo"${r.status === 'inativo' ? ' selected' : ''}>Inativo (descontinuado ou sem uso)</option></select>`)}
      </div>
      <fieldset class="rcs-grupo"><legend>Acesso</legend><div class="rcs-checks">${RCS_ACESSO.map(([v, l]) =>
        `<label class="rcs-op"><input type="checkbox" name="rcs-acesso" value="${v}"${(r.acesso || []).includes(v) ? ' checked' : ''}><span>${l}</span></label>`).join('')}</div></fieldset>
      <fieldset class="rcs-grupo"><legend>Plataformas</legend><div class="rcs-checks">${plats.map(p =>
        `<label class="rcs-op"><input type="checkbox" name="rcs-plat" value="${esc(p)}"${(r.plataformas || []).includes(p) ? ' checked' : ''}><span>${esc(p)}</span></label>`).join('')}</div></fieldset>
      <div class="fld" id="rcs-f-tags"><label for="rcs-tag-novo">Tags</label>
        <div class="rcs-tags-ed" id="rcs-tags-ed"></div>
        <input id="rcs-tag-novo" list="rcs-tag-sug" placeholder="Digite uma tag e aperte Enter" autocomplete="off" maxlength="32">
        <datalist id="rcs-tag-sug">${sugestoes.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
        <span class="hint">Reaproveite as tags que já existem (aparecem ao digitar): IDE, PCB, ESP32, Estudante, Claude Code...</span></div>
      ${campo('instrucoes_baixar', 'Como baixar ou acessar (opcional)', `<textarea id="rcs-instrucoes_baixar" rows="6" maxlength="8000">${esc(r.instrucoes_baixar || '')}</textarea>`,
        'Passos numerados começam com 1., 2.; itens com -; comandos entre crases: `git --version`. Uma linha só de comando ganha o botão Copiar.')}
      ${campo('instrucoes_usar', 'Como começar a usar e configurar (opcional)', `<textarea id="rcs-instrucoes_usar" rows="8" maxlength="8000">${esc(r.instrucoes_usar || '')}</textarea>`,
        'Configuração inicial, o primeiro uso e as armadilhas que você já encontrou.')}
      <details class="rcs-mais-opc"><summary>Mais opções</summary>
        ${campo('logo_url', 'Logo (opcional)', `<input id="rcs-logo_url" type="url" inputmode="url" placeholder="https://..." value="${esc(r.logo_url || '')}" autocomplete="off">`, 'Só se a logo automática não ficar boa. Precisa ser um endereço https de uma imagem.')}
        ${rcsM.gestao ? `<label class="rcs-op rcs-padrao-op"><input type="checkbox" id="rcs-padrao_nro"${r.padrao_nro ? ' checked' : ''}><span><b>NRO Standard</b>: é a ferramenta que a equipe adota como padrão. Só a gestão marca.</span></label>` : ''}
      </details>
      <p class="aviso-box err" id="rcs-erro" role="alert" hidden></p>
      <div class="barra-acoes"><span></span><div class="dir"><a class="btn ghost" href="${slug ? '#/biblioteca/' + encodeURIComponent(slug) : '#/biblioteca'}">Cancelar</a>
        <button class="btn solid" type="submit" id="rcs-salvar">${slug ? 'Salvar' : 'Adicionar à Biblioteca'}</button></div></div>
    </form>`;
  rcsDesenharTags();
  const url = $('#rcs-url');
  url.addEventListener('input', () => rcsDeduzir());
  $('#rcs-nome').addEventListener('input', e => { f.tocouNome = !!e.target.value; rcsPrevia(); });
  $('#rcs-publicador').addEventListener('input', e => { f.tocouPub = !!e.target.value; });
  $('#rcs-logo_url').addEventListener('input', () => rcsPrevia());
  $('#rcs-funcao').addEventListener('input', e => { $('#rcs-funcao-n').textContent = 600 - e.target.value.length; });
  const novo = $('#rcs-tag-novo');
  novo.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); rcsAddTag(novo.value); novo.value = ''; }
    else if (e.key === 'Backspace' && !novo.value && f.tags.length){ f.tags.pop(); rcsDesenharTags(); }
  });
  novo.addEventListener('change', () => { if (novo.value){ rcsAddTag(novo.value); novo.value = ''; } });
  novo.addEventListener('blur', () => { if (novo.value.trim()){ rcsAddTag(novo.value); novo.value = ''; } });
  $('#rcs-tags-ed').addEventListener('click', e => { const b = e.target.closest('[data-rcs-rm]'); if (!b) return; f.tags = f.tags.filter(t => t !== b.dataset.rcsRm); rcsDesenharTags(); });
  (slug ? $('#rcs-nome') : url).focus();
}
function rcsAddTag(txt){
  const f = rcsM.form, t = String(txt).replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
  if (!t || f.tags.some(x => x.toLowerCase() === t.toLowerCase())) return;
  if (f.tags.length >= 24) return toast('No máximo 24 tags.', true);
  // usa a grafia que já existe no catálogo
  f.tags.push(f.sugestoes.find(s => s.toLowerCase() === t.toLowerCase()) || t); rcsDesenharTags();
}
function rcsDesenharTags(){
  const el = $('#rcs-tags-ed'); if (!el) return;
  el.innerHTML = rcsM.form.tags.map(t => `<span class="rcs-tag ed">${esc(t)}<button type="button" data-rcs-rm="${esc(t)}" aria-label="Tirar a tag ${esc(t)}">×</button></span>`).join('');
}
/* ao colar o endereço: a logo e, se ainda estiverem vazios, o nome e o publicador */
function rcsDeduzir(){
  const f = rcsM.form, url = $('#rcs-url').value.trim();
  if (!f.tocouPub){ const p = rcsPublicadorDe(url); if (p || !$('#rcs-publicador').value) $('#rcs-publicador').value = p; }
  if (!f.tocouNome && !f.slug){ try { const u = new URL(url); const seg = u.hostname.replace(/^www\./, '') === 'github.com' ? u.pathname.split('/')[2] : ''; $('#rcs-nome').value = seg || ''; } catch(e){ $('#rcs-nome').value = ''; } }
  rcsPrevia();
}
function rcsPrevia(){
  const el = $('#rcs-prev'); if (!el) return;
  const url = $('#rcs-url').value.trim(), logo = $('#rcs-logo_url').value.trim();
  el.innerHTML = rcsLogo({ nome:$('#rcs-nome').value || '?', url:/^https?:\/\//i.test(url) ? url : '', logo_url:/^https:\/\//i.test(logo) ? logo : '' }, 64);
}
async function rcsSalvar(ev){
  ev.preventDefault();
  const f = rcsM.form, v = id => ($('#rcs-' + id)?.value ?? '').trim();
  const marca = nome => [...document.querySelectorAll(`input[name="${nome}"]:checked`)].map(x => x.value);
  document.querySelectorAll('.rcs-form .msg').forEach(m => { m.textContent = ''; });
  document.querySelectorAll('.rcs-form .fld.erro').forEach(m => m.classList.remove('erro'));
  $('#rcs-erro').hidden = true;
  const p = { id:f.r.id, url:v('url'), nome:v('nome'), publicador:v('publicador'), logo_url:v('logo_url'), tipo:v('tipo'), status:v('status'), funcao:v('funcao'),
    instrucoes_baixar:v('instrucoes_baixar'), instrucoes_usar:v('instrucoes_usar'), tags:f.tags, plataformas:marca('rcs-plat'), acesso:marca('rcs-acesso') };
  if (rcsM.gestao) p.padrao_nro = !!$('#rcs-padrao_nro')?.checked;
  const erro = (campo, txt) => { const c = $('#rcs-f-' + campo); c?.classList.add('erro'); const m = $('#rcs-e-' + campo); if (m) m.textContent = txt; $('#rcs-' + campo)?.focus(); };
  if (!/^https?:\/\/[^\s/]+\.[^\s/]+/i.test(p.url)) return erro('url', 'Cole o endereço completo, começando por https://');
  if (!p.nome) return erro('nome', 'Escreva o nome da ferramenta.');
  if (!p.funcao) return erro('funcao', 'Diga o que ela faz, em uma ou duas frases.');
  const b = $('#rcs-salvar'); b.disabled = true;
  try {
    const { data, error } = await sb.rpc('recurso_salvar', { p });
    if (error) throw error;
    if (data.status === 'duplicado'){
      $('#rcs-erro').innerHTML = `Este endereço já está na Biblioteca: <a href="#/biblioteca/${encodeURIComponent(data.slug)}">${esc(data.nome)}</a>. Abra o item e edite por lá.`; $('#rcs-erro').hidden = false; return;
    }
    if (data.status === 'invalido'){
      const rot = { url:'Confira o endereço.', nome:'Confira o nome.', funcao:'Confira o texto de "O que faz" (até 600 caracteres).', logo_url:'A logo precisa ser um endereço https.', instrucoes:'As instruções passam de 8000 caracteres.', acesso:'Confira o acesso.', tipo:'Confira o tipo.' };
      if (['url', 'nome', 'funcao', 'logo_url'].includes(data.campo)) { if (data.campo === 'logo_url') $('.rcs-mais-opc').open = true; return erro(data.campo, rot[data.campo]); }
      $('#rcs-erro').textContent = rot[data.campo] || 'Confira os campos.'; $('#rcs-erro').hidden = false; return;
    }
    if (data.status !== 'ok') throw new Error(data.status);
    rcsM.lista = null; rcsM.item = null;
    toast(f.slug ? 'Item atualizado.' : 'Item adicionado à Biblioteca.');
    location.hash = '#/biblioteca/' + encodeURIComponent(data.slug);
  } catch(e){ $('#rcs-erro').textContent = 'Não foi possível salvar agora. Tente de novo.'; $('#rcs-erro').hidden = false; }
  finally { const bb = $('#rcs-salvar'); if (bb) bb.disabled = false; }
}

/* ---------------- cliques que valem em qualquer tela do módulo ---------------- */
document.addEventListener('click', e => {
  const cp = e.target.closest('[data-rcs-copiar]');
  if (cp){ navigator.clipboard?.writeText(cp.dataset.rcsCopiar).then(() => toast('Copiado.'), () => toast('Não foi possível copiar.', true)); return; }
  const nt = e.target.closest('[data-rcs-nota]'); if (nt){ rcsAvaliar(Number(nt.dataset.rcsNota)); return; }
  const ap = e.target.closest('[data-rcs-apagar]'); if (ap){ rcsApagarComentario(ap.dataset.rcsApagar); return; }
  const tg = e.target.closest('[data-rcs-tag]'); if (tg){ rcsM.f = { ...rcsFiltroVazio(), tags:[tg.dataset.rcsTag], status:'todos' }; rcsM.tagQ = ''; rcsM.tagsTodas = false; }
});
