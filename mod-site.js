/* ============================================================
   MÓDULO · SITE (neurodynamics.dev)
   As páginas dos projetos do site: o texto nos três idiomas, a
   família de cor, a animação, o projeto do SOMA a que a página
   corresponde, os números e a produção (artigos, apresentações,
   estudos, parcerias...).

   Dois lugares usam este módulo:
   - Administração › Site institucional (#/admin/site[/numeros|
     /producao]): a gestão escreve e publica tudo;
   - a página do projeto no portal (#/projetos/<CÓDIGO>): o
     supervisor acrescenta números e produção da página dele, que
     chegam como rascunho; a gestão do site publica. Quem vê a
     página do projeto vê o que está no site e o que está esperando.

   A regra mora no banco (2.21.0_site_projetos.sql): o supervisor não
   publica, e o que está no ar só a gestão altera. A tela só não
   oferece o botão que o banco recusaria.

   Depende da casca para: sb, $, esc, toast, falha, abreModal,
   fechaModal, confirma, ic, ibtn, fmtD, nomeDe, podeGerir, podeStudio,
   state.
   ============================================================ */

const siteM = { projetos:[], somaProjetos:[], numeros:[], saidas:[], sel:null, idioma:'pt',
                aba:'', alvo:null, contexto:null, ed:null };

const SITE_URL_PUB = 'https://neurodynamics.dev';
/* o português primeiro; o inglês é a coluna base (o site abre em inglês) */
const SITE_IDIOMAS = [ { k:'pt', lb:'PT', sf:'_pt' }, { k:'en', lb:'EN', sf:'' }, { k:'fr', lb:'FR', sf:'_fr' } ];
const SITE_FAMILIAS = [['ion','Ion'],['neuron','Neuron'],['glia','Glia'],['retina','Retina'],['nexo','Nexo'],
  ['dendrito','Dendrito'],['lumen','Lúmen'],['ritmo','Ritmo'],['impulso','Impulso'],['plexo','Plexo'],['iris','Íris']];
/* as animações que o site tem em anim/<nome>.html */
const SITE_ANIMACOES = [['opalina','Opalina: diafragma na UTI'],['orion','Órion: pedalada no leito da UTI'],
  ['calima','Calima: triciclo com eletroestimulação'],['nebula','Nebula: EEG e eletroestimulação'],
  ['gaia','Gaia: revisão sistemática'],['equio','Équio: tDCS e GVS'],['zefiro','Zéfiro: controle pelo olhar'],
  ['aurora','Aurora: digitalização 3D']];
const SITE_STATUS = [['In progress','Em andamento'],['Ready to start','Pronto para iniciar'],['Completed','Concluído'],
  ['On hold','Em pausa'],['Concept','Conceito'],['Applied research','Pesquisa aplicada'],['Prototype','Protótipo'],
  ['In development','Em desenvolvimento'],['Field pilot','Piloto em campo']];
const SITE_UNIDADES = [['','sem unidade'],['%','% (porcentagem)'],['pp','pontos percentuais'],['h','horas'],['dias','dias'],
  ['semanas','semanas'],['meses','meses'],['min','minutos'],['s','segundos'],['ms','milissegundos'],['mA','mA'],['Hz','Hz'],
  ['x','vezes (×)'],['mil','mil'],['milhoes','milhões'],['ano','ano (sem ponto de milhar)']];
const SITE_PREFIXOS = [['','nenhum'],['mais_de','mais de'],['ate','até'],['cerca_de','cerca de'],
  ['menos','sinal de menos (−)'],['mais','sinal de mais (+)']];
const SITE_TIPOS = [['artigo','Artigo'],['apresentacao','Apresentação'],['estudo','Estudo'],['parceria','Parceria'],
  ['premio','Prêmio'],['patente','Patente'],['software','Software']];
const SITE_SITUACOES = [['planejado','Planejado'],['em_andamento','Em andamento'],['submetido','Submetido'],['aceito','Aceito'],
  ['publicado','Publicado'],['apresentado','Apresentado'],['concluido','Concluído']];
const rotuloDe = (lista, k) => (lista.find(x => x[0] === k) || [k, k])[1];
const siteGestor = () => podeGerir();
const opcoes = (lista, atual) => lista.map(([k, l]) => `<option value="${esc(k)}"${k === (atual ?? '') ? ' selected' : ''}>${esc(l)}</option>`).join('');

/* "57%", "mais de 15 milhões", "−1,78 dia", "13 a 30 Hz", "2025": como o site mostra, em português */
function siteNumeroTexto(n){
  const casas = Math.min(2, Math.max(0, +n.casas || 0));
  const f = v => Number(v).toLocaleString('pt-BR', { minimumFractionDigits:casas, maximumFractionDigits:casas, useGrouping:n.unidade !== 'ano' });
  const ate = n.valor_ate != null && n.valor_ate !== '' ? Number(n.valor_ate) : null;
  const plural = Math.abs(ate ?? Number(n.valor)) >= 2;
  const UN = { '%':'%', pp:' p.p.', h:' h', dias:plural ? ' dias' : ' dia', semanas:plural ? ' semanas' : ' semana',
    meses:plural ? ' meses' : ' mês', min:' min', s:' s', ms:' ms', mA:' mA', Hz:' Hz', x:'×', mil:' mil',
    milhoes:plural ? ' milhões' : ' milhão' };
  const pre = { mais_de:'mais de ', ate:'até ', cerca_de:'cerca de ', menos:'−', mais:'+' }[n.prefixo] || '';
  return pre + f(n.valor) + (ate != null ? ' a ' + f(ate) : '') + (UN[n.unidade] || '');
}
const sitePill = it => it.publicado ? '<span class="pill p-ok"><span class="dt dt-ok"></span>No site</span>'
                                    : '<span class="pill p-warn"><span class="dt dt-warn"></span>Rascunho</span>';
/* o supervisor mexe só no que ainda não foi publicado; a gestão, em tudo */
const sitePodeItem = (it, pode) => pode && (siteGestor() || !it.publicado);
const siteErro = e => /no_ar/.test(e?.message || '') ? 'Este item está no site. Só a gestão do site altera o que foi publicado.'
  : /row-level security|42501/.test(e?.message || '') ? 'Sem permissão para editar esta página.' : (e?.message || 'erro inesperado');

/* ============================================================
   CARGA
   ============================================================ */
async function siteCarregar(){
  const [sp, pj, nu, sa] = await Promise.all([
    sb.from('site_projetos').select('*').order('ordem', { ascending:true }).order('nome', { ascending:true }),
    sb.from('projetos').select('id,codigo,nome,supervisor,status').order('nome', { ascending:true }),
    sb.from('site_projeto_numeros').select('*').order('ordem', { ascending:true }),
    sb.from('site_projeto_saidas').select('*').order('ordem', { ascending:true })
  ]);
  if (sp.error) throw sp.error;
  siteM.projetos = sp.data || [];
  siteM.somaProjetos = pj.error ? [] : (pj.data || []);
  /* sem a 2.21.0 as duas tabelas não existem: a tela avisa, o resto funciona */
  siteM.semMigracao = !!(nu.error || sa.error);
  siteM.numeros = nu.error ? [] : (nu.data || []);
  siteM.saidas = sa.error ? [] : (sa.data || []);
}
const siteNumerosDe = id => siteM.numeros.filter(n => n.site_projeto_id === id)
  .sort((a, b) => (a.ordem - b.ordem) || String(a.criado_em).localeCompare(String(b.criado_em)));
const siteSaidasDe = id => siteM.saidas.filter(s => s.site_projeto_id === id)
  .sort((a, b) => String(b.data || '').localeCompare(String(a.data || '')) || (a.ordem - b.ordem));

/* ============================================================
   ADMINISTRAÇÃO › SITE INSTITUCIONAL
   ============================================================ */
async function siteAdmin(el, aba){
  siteM.alvo = el; siteM.contexto = 'admin'; siteM.aba = ['numeros','producao'].includes(aba) ? aba : '';
  el.innerHTML = '<div class="carregando"><span class="spin"></span> Carregando os projetos…</div>';
  try{ await siteCarregar(); }
  catch(e){
    el.innerHTML = `<div class="aviso-box err">Não foi possível carregar os projetos do site (${esc(e.message)}).
      Confira se as migrações <b>soma_v09_site.sql</b>, <b>soma_v13_site_idiomas.sql</b> e <b>2.21.0_site_projetos.sql</b> foram aplicadas.</div>`;
    return;
  }
  if (!siteM.sel || !siteM.projetos.find(p => p.id === siteM.sel)) siteM.sel = siteM.projetos[0]?.id || null;
  siteDesenharAdmin();
}

function siteDesenharAdmin(){
  const el = siteM.alvo; if (!el) return;
  const espera = id => siteNumerosDe(id).filter(n => !n.publicado).length + siteSaidasDe(id).filter(s => !s.publicado).length;
  el.innerHTML = `
    <p class="small muted" style="margin-bottom:12px">Cada projeto publicado tem uma página em neurodynamics.dev/#/projects/&lt;slug&gt;.
      Vídeos e matérias da seção Quem somos: ${podeStudio()
        ? `<a href="#/studio/config/imprensa" style="text-decoration:underline">Studio › Configurações › Imprensa</a>.`
        : 'Studio, pela gestão do Studio.'}</p>
    ${siteM.semMigracao ? `<div class="aviso-box warn">Números e produção dependem da migração <b>2.21.0_site_projetos.sql</b>. O texto das páginas continua editável.</div>` : ''}
    <div class="adm-grade">
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:14px">
          <div><h3>Projetos</h3><p class="sub">na ordem do site</p></div>
          <button class="btn ghost mini" onclick="siteNovoProjeto()">${ic('plus')} Novo projeto</button>
        </div>
        <div id="site-lista">${siteM.projetos.length ? siteM.projetos.map(p => `
          <button class="adm-item ${p.id === siteM.sel ? 'on' : ''}" onclick="siteSelecionar('${p.id}')">
            <span class="ordem">${esc(p.ordem)}</span>
            <span class="tx"><span class="nm">${esc(p.nome)}</span><span class="sl">/${esc(p.slug)}</span></span>
            ${espera(p.id) ? `<span class="pill p-warn" title="Rascunhos esperando publicação"><span class="dt dt-warn"></span>${espera(p.id)}</span>` : ''}
            ${p.publicado ? '' : '<span class="off">oculto</span>'}</button>`).join('')
          : '<div class="kb-vazio" style="text-align:left">Nenhum projeto. Crie o primeiro.</div>'}</div>
      </div>
      <div class="card" id="site-painel"></div>
    </div>`;
  siteDesenharPainel();
}
function siteSelecionar(id){ siteM.sel = id; siteDesenharAdmin(); }

function siteDesenharPainel(){
  const el = $('#site-painel'); if (!el) return;
  const p = siteM.projetos.find(x => x.id === siteM.sel);
  if (!p){ el.innerHTML = '<div class="kb-vazio" style="text-align:left">Selecione ou crie um projeto.</div>'; return; }
  const nn = siteNumerosDe(p.id).length, ns = siteSaidasDe(p.id).length;
  const abas = [['', 'Página', ''], ['numeros', 'Números', nn], ['producao', 'Produção', ns]];
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><h3>${esc(p.nome)}</h3>
        <p class="sub">${p.publicado ? 'no site' : 'oculto'}, atualizado ${p.atualizado_em ? fmtD(p.atualizado_em) : '—'}</p></div>
      ${p.publicado ? `<a class="btn ghost mini" href="${SITE_URL_PUB}/#/projects/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver a página ${ic('externo')}</a>` : ''}
    </div>
    <nav class="abas" aria-label="Partes da página" style="margin-top:14px">${abas.map(([k, l, n]) =>
      `<a href="#/admin/site${k ? '/' + k : ''}" class="${siteM.aba === k ? 'on' : ''}"${siteM.aba === k ? ' aria-current="page"' : ''}>${l}${
        n !== '' ? `<span class="n">${n}</span>` : ''}</a>`).join('')}</nav>
    <div id="site-aba"></div>`;
  if (siteM.aba === 'numeros') return siteListaNumeros($('#site-aba'), p, true);
  if (siteM.aba === 'producao') return siteListaSaidas($('#site-aba'), p, true);
  siteFormPagina($('#site-aba'), p);
}

/* ---------------- a página: texto, cor, animação ---------------- */
function siteFormPagina(el, p){
  const pjs = [['', 'Nenhum'], ...siteM.somaProjetos.map(x => [x.id, `${x.codigo}, ${x.nome}`])];
  el.innerHTML = `
    <div class="form-grid">
      <div class="fld"><label for="sp-nome">Nome</label><input id="sp-nome" value="${esc(p.nome)}"></div>
      <div class="fld"><label for="sp-slug">Endereço (slug)</label><input id="sp-slug" value="${esc(p.slug)}">
        <p class="mini">minúsculas, sem espaço nem acento: /projects/${esc(p.slug)}</p></div>
      <div class="fld"><label for="sp-status">Fase</label><select id="sp-status">${opcoes(
        SITE_STATUS.some(s => s[0] === p.status) ? SITE_STATUS : [...SITE_STATUS, [p.status, p.status]], p.status)}</select></div>
      <div class="fld"><label for="sp-ordem">Ordem no site</label><input id="sp-ordem" type="number" value="${esc(p.ordem)}"></div>
      <div class="fld"><label for="sp-familia">Família de cor</label><select id="sp-familia">${opcoes([['', 'Nenhuma'], ...SITE_FAMILIAS], p.familia || '')}</select>
        <p class="mini">Uma família secundária do manual da marca, chapada, na página inteira.</p></div>
      <div class="fld"><label for="sp-anim">Animação</label><select id="sp-anim">${opcoes([['', 'Nenhuma: imagem ou placeholder'], ...SITE_ANIMACOES], p.animacao || '')}</select></div>
      <div class="fld full"><label for="sp-projeto">Projeto do SOMA</label><select id="sp-projeto">${opcoes(pjs, p.projeto_id || '')}</select>
        <p class="mini">O supervisor deste projeto acrescenta números e produção pela página dele no portal.</p></div>
      <div class="fld full">
        <div class="seg" role="group" aria-label="Idioma do texto" style="margin-bottom:14px">${SITE_IDIOMAS.map(l =>
          `<button type="button" class="${l.k === siteM.idioma ? 'on' : ''}" aria-pressed="${l.k === siteM.idioma}" data-idioma-bt="${l.k}"
            onclick="siteTrocaIdioma('${l.k}')">${l.lb}</button>`).join('')}</div>
        <p class="mini" style="margin:-8px 0 12px">O site mostra o idioma de quem lê; sem tradução, cai no inglês e depois no português.</p>
        ${SITE_IDIOMAS.map(l => `<div data-idioma="${l.k}" ${l.k === siteM.idioma ? '' : 'hidden'}>
          <div class="fld"><label for="sp-tagline${l.sf}">Frase (${l.lb})</label>
            <input id="sp-tagline${l.sf}" value="${esc(p['tagline' + l.sf] || '')}" maxlength="140">
            <p class="mini">Uma frase, sob o nome. Diz o que o projeto faz, sem slogan.</p></div>
          <div class="fld"><label for="sp-resumo${l.sf}">Resumo (${l.lb})</label>
            <textarea id="sp-resumo${l.sf}" rows="3" maxlength="400">${esc(p['resumo' + l.sf] || '')}</textarea>
            <p class="mini">Uma ou duas frases: o cartão do início e o topo da página.</p></div>
          <div class="fld"><label for="sp-descricao${l.sf}">Por que existe (${l.lb})</label>
            <textarea id="sp-descricao${l.sf}" rows="6" maxlength="1200">${esc(p['descricao' + l.sf] || '')}</textarea>
            <p class="mini">Até dois parágrafos curtos, separados por uma linha em branco. O primeiro sai grande.</p></div>
        </div>`).join('')}
      </div>
      <div class="fld full"><label for="sp-tags">Áreas (separadas por vírgula, em inglês)</label>
        <input id="sp-tags" value="${esc((p.tags || []).join(', '))}"></div>
      <div class="fld full"><label for="sp-imagem">Imagem (https)</label>
        <input id="sp-imagem" value="${esc(p.imagem_url || '')}" placeholder="https://…">
        <p class="mini">Em branco: o pôster da animação, ou o placeholder.</p></div>
      <div class="fld full"><label class="check"><input id="sp-pub" type="checkbox" ${p.publicado ? 'checked' : ''}> Publicado no site</label></div>
    </div>
    <div class="acts">
      <button class="btn solid" id="sp-salvar" onclick="siteSalvarProjeto('${p.id}')">Salvar alterações</button>
      <button class="btn perigo" onclick="siteExcluirProjeto('${p.id}')">Excluir</button>
    </div>`;
}
function siteTrocaIdioma(k){
  siteM.idioma = k;
  document.querySelectorAll('[data-idioma-bt]').forEach(b => { const on = b.dataset.idiomaBt === k;
    b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-idioma]').forEach(d => d.hidden = d.dataset.idioma !== k);
}
function siteLerProjeto(){
  const v = {
    nome: $('#sp-nome').value.trim(),
    slug: $('#sp-slug').value.trim().toLowerCase(),
    status: $('#sp-status').value || 'In progress',
    ordem: parseInt($('#sp-ordem').value, 10) || 100,
    familia: $('#sp-familia').value || null,
    animacao: $('#sp-anim').value || null,
    projeto_id: $('#sp-projeto').value || null,
    tags: $('#sp-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    imagem_url: $('#sp-imagem').value.trim() || null,
    publicado: $('#sp-pub').checked
  };
  SITE_IDIOMAS.forEach(l => ['tagline','resumo','descricao'].forEach(c => {
    v[c + l.sf] = $('#sp-' + c + l.sf).value.trim() || null;
  }));
  return v;
}
async function siteSalvarProjeto(id){
  const v = siteLerProjeto();
  if (!v.nome) return toast('Escreva o nome do projeto.', true);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v.slug)) return toast('O endereço usa só minúsculas, números e hífen, como opalina ou nova-ideia.', true);
  if (v.imagem_url && !/^https:\/\//.test(v.imagem_url)) return toast('A imagem precisa de um endereço que comece com https://.', true);
  if (v.projeto_id && siteM.projetos.some(p => p.id !== id && p.projeto_id === v.projeto_id))
    return toast('Esse projeto do SOMA já está ligado a outra página. Desligue a outra antes.', true);
  const bt = $('#sp-salvar'); if (bt) bt.disabled = true;
  try{
    const { error } = await sb.from('site_projetos').update(v).eq('id', id);
    if (error) throw error;
    toast(v.publicado ? 'Página salva. O site mostra a versão nova na próxima visita.' : 'Página salva. Ela continua fora do site.');
    await siteRecarregar();
  }catch(e){ toast('Não foi possível salvar: ' + siteErro(e), true); }
  finally{ const b = $('#sp-salvar'); if (b) b.disabled = false; }
}
async function siteNovoProjeto(){
  abreModal(`<h3>Novo projeto no site</h3>
    <div class="fld"><label for="snp-nome">Nome</label><input id="snp-nome" maxlength="60" autocomplete="off"></div>
    <p class="small muted" style="line-height:1.6">Nasce oculto. Preencha a página e marque Publicado quando estiver pronta.</p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="siteCriarProjeto()">Criar projeto</button></div>`);
  setTimeout(() => $('#snp-nome')?.focus(), 30);
}
async function siteCriarProjeto(){
  const nome = $('#snp-nome').value.trim();
  if (!nome) return toast('Escreva o nome do projeto.', true);
  const slug = nome.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (siteM.projetos.some(p => p.slug === slug)) return toast(`Já existe uma página em /projects/${slug}. Escolha outro nome.`, true);
  try{
    const { data, error } = await sb.from('site_projetos')
      .insert({ nome, slug, publicado:false, status:'Concept', ordem: 100 + siteM.projetos.length * 10 }).select().single();
    if (error) throw error;
    fechaModal();
    toast('Projeto criado, oculto no site.');
    siteM.sel = data?.id || null; siteM.aba = '';
    if (location.hash !== '#/admin/site') location.hash = '#/admin/site'; else await siteRecarregar();
  }catch(e){ toast('Não foi possível criar: ' + siteErro(e), true); }
}
async function siteExcluirProjeto(id){
  const p = siteM.projetos.find(x => x.id === id);
  const n = siteNumerosDe(id).length + siteSaidasDe(id).length;
  if (!await confirma(`Excluir <b>${esc(p?.nome || '')}</b> do site? ${n ? `Os ${n} números e itens de produção vão junto. ` : ''}Não é possível desfazer. Para tirar do ar por um tempo, desmarque Publicado.`, 'Excluir projeto')) return;
  try{
    const { error } = await sb.from('site_projetos').delete().eq('id', id);
    if (error) throw error;
    toast('Projeto excluído do site.');
    siteM.sel = null;
    await siteRecarregar();
  }catch(e){ toast('Não foi possível excluir: ' + siteErro(e), true); }
}

/* ---------------- números ---------------- */
function siteListaNumeros(el, p, pode){
  const ns = siteNumerosDe(p.id);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <p class="small muted" style="max-width:560px;line-height:1.6">Cada número traz a fonte. Os da literatura medem o problema ou o que já foi estudado;
        os do projeto, o que a equipe mediu ou definiu. Sem fonte, número da literatura não entra.</p>
      ${pode ? `<button class="btn ghost mini" onclick="siteModalNumero('${p.id}')">${ic('plus')} Novo número</button>` : ''}
    </div>
    ${ns.length ? `<div class="wrap"><table class="tabela trabalho site-tab">
      <thead><tr><th>Número</th><th>O que diz</th><th>Origem</th><th>Situação</th><th><span class="sr">Ações</span></th></tr></thead>
      <tbody>${ns.map(n => `<tr>
        <td class="site-n">${esc(siteNumeroTexto(n))}</td>
        <td class="site-rot" title="${esc(n.rotulo_pt || n.rotulo || n.rotulo_fr || '')}">${esc(n.rotulo_pt || n.rotulo || n.rotulo_fr || '')}
          ${n.origem === 'literatura' && n.fonte ? `<span class="site-fonte">${esc(n.fonte)}</span>` : ''}</td>
        <td>${n.origem === 'projeto' ? 'Do projeto' : 'Literatura'}</td>
        <td>${sitePill(n)}${!n.publicado && n.criado_por ? `<span class="site-fonte">de ${esc(nomeDe(n.criado_por))}</span>` : ''}</td>
        <td style="white-space:nowrap">${siteAcoes('numero', n, pode)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">Nenhum número ainda.${pode ? ' Acrescente o primeiro, com a fonte.' : ''}</div>`}`;
}
function siteAcoes(tipo, it, pode){
  if (!sitePodeItem(it, pode)) return '';
  const tab = tipo === 'numero' ? 'site_projeto_numeros' : 'site_projeto_saidas';
  const editar = tipo === 'numero' ? `siteModalNumero('${it.site_projeto_id}','${it.id}')` : `siteModalSaida('${it.site_projeto_id}','${it.id}')`;
  return [ibtn('pencil', 'Editar', editar),
    siteGestor() ? ibtn('eye', it.publicado ? 'Tirar do site' : 'Publicar no site', `sitePublicar('${tab}','${it.id}',${!it.publicado})`) : '',
    ibtn('trash', 'Excluir', `siteExcluirItem('${tab}','${it.id}')`)].join(' ');
}

function siteCamposIdioma(prefixo, it, campo, rotulo, max, linhas){
  return `<div class="seg" role="group" aria-label="Idioma" style="margin-bottom:10px">${SITE_IDIOMAS.map(l =>
      `<button type="button" class="${l.k === 'pt' ? 'on' : ''}" aria-pressed="${l.k === 'pt'}" data-ed-bt="${l.k}" onclick="siteEdIdioma('${l.k}')">${l.lb}</button>`).join('')}</div>
    ${SITE_IDIOMAS.map(l => `<div class="fld" data-ed-idioma="${l.k}" ${l.k === 'pt' ? '' : 'hidden'}>
      <label for="${prefixo}-${campo}${l.sf}">${rotulo} (${l.lb})</label>
      <textarea id="${prefixo}-${campo}${l.sf}" rows="${linhas}" maxlength="${max}">${esc(it?.[campo + l.sf] || '')}</textarea></div>`).join('')}`;
}
function siteEdIdioma(k){
  document.querySelectorAll('[data-ed-bt]').forEach(b => { const on = b.dataset.edBt === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-ed-idioma]').forEach(d => d.hidden = d.dataset.edIdioma !== k);
}
const siteNum = s => { const t = String(s ?? '').trim().replace(/\s/g, '');
  if (!t) return null;
  /* 1.284,5 ou 1284.5: o último separador é o decimal quando há só um tipo com casas */
  const n = Number(/,/.test(t) ? t.replace(/\./g, '').replace(',', '.') : t);
  return Number.isFinite(n) ? n : NaN; };

function siteModalNumero(siteId, id){
  const n = id ? siteM.numeros.find(x => x.id === id) : null;
  siteM.ed = { siteId, id:id || null };
  const fmt = v => v == null ? '' : String(v).replace('.', ',');
  abreModal(`<h3>${n ? 'Editar número' : 'Novo número'}</h3>
    <p class="small muted" style="margin:-4px 0 14px;line-height:1.6">${siteGestor() ? 'Publicado, aparece na página do projeto no site.'
      : 'Fica como rascunho até a gestão do site publicar.'}</p>
    <div class="form-grid">
      <div class="fld full"><label>Origem</label>
        <div class="seg" role="group" aria-label="Origem">${[['literatura','Da literatura'],['projeto','Do projeto']].map(([k, l]) =>
          `<button type="button" data-origem="${k}" class="${(n?.origem || 'literatura') === k ? 'on' : ''}" aria-pressed="${(n?.origem || 'literatura') === k}"
            onclick="siteOrigem('${k}')">${l}</button>`).join('')}</div></div>
      <div class="fld"><label for="sn-pre">Antes do número</label><select id="sn-pre" onchange="sitePrevia()">${opcoes(SITE_PREFIXOS, n?.prefixo || '')}</select></div>
      <div class="fld"><label for="sn-valor">Valor</label><input id="sn-valor" inputmode="decimal" value="${esc(fmt(n?.valor))}" placeholder="57 ou 1,78" oninput="sitePrevia()"></div>
      <div class="fld"><label for="sn-ate">Até (para faixa)</label><input id="sn-ate" inputmode="decimal" value="${esc(fmt(n?.valor_ate))}" placeholder="30" oninput="sitePrevia()"></div>
      <div class="fld"><label for="sn-casas">Casas decimais</label><select id="sn-casas" onchange="sitePrevia()">${opcoes([['0','0'],['1','1'],['2','2']], String(n?.casas ?? 0))}</select></div>
      <div class="fld"><label for="sn-uni">Unidade</label><select id="sn-uni" onchange="sitePrevia()">${opcoes(SITE_UNIDADES, n?.unidade || '')}</select></div>
      <div class="fld"><label for="sn-ordem">Ordem</label><input id="sn-ordem" type="number" value="${esc(n?.ordem ?? (siteNumerosDe(siteId).length + 1) * 10)}"></div>
      <div class="fld full">${siteCamposIdioma('sn', n, 'rotulo', 'O que o número diz', 240, 2)}
        <p class="mini">A frase que vem depois do número: "57%" + "menor área das fibras do diafragma depois de 18 a 69 horas de ventilação".</p></div>
      <div class="fld full" data-so-lit><label for="sn-fonte">Fonte</label><input id="sn-fonte" value="${esc(n?.fonte || '')}" maxlength="200"
          placeholder="Autor et al., Revista, ano"></div>
      <div class="fld full" data-so-lit><label for="sn-url">Link da fonte (https)</label><input id="sn-url" value="${esc(n?.fonte_url || '')}" placeholder="https://doi.org/…"></div>
      ${siteGestor() ? `<div class="fld full"><label class="check"><input id="sn-pub" type="checkbox" ${n?.publicado ? 'checked' : ''}> Publicado no site</label></div>` : ''}
    </div>
    <p class="site-previa" id="sn-previa" aria-live="polite"></p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="sn-salvar" onclick="siteSalvarNumero()">${n ? 'Salvar número' : 'Acrescentar número'}</button></div>`, false, true);
  siteOrigem(n?.origem || 'literatura');
}
function siteOrigem(k){
  document.querySelectorAll('[data-origem]').forEach(b => { const on = b.dataset.origem === k; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  document.querySelectorAll('[data-so-lit]').forEach(d => d.hidden = k !== 'literatura');
  sitePrevia();
}
function siteLerNumero(){
  const origem = document.querySelector('[data-origem].on')?.dataset.origem || 'literatura';
  const v = { origem, prefixo:$('#sn-pre').value, valor:siteNum($('#sn-valor').value), valor_ate:siteNum($('#sn-ate').value),
    casas:+$('#sn-casas').value || 0, unidade:$('#sn-uni').value, ordem:parseInt($('#sn-ordem').value, 10) || 100,
    fonte: origem === 'literatura' ? ($('#sn-fonte').value.trim() || null) : null,
    fonte_url: origem === 'literatura' ? ($('#sn-url').value.trim() || null) : null };
  SITE_IDIOMAS.forEach(l => { v['rotulo' + l.sf] = $('#sn-rotulo' + l.sf).value.trim() || null; });
  if ($('#sn-pub')) v.publicado = $('#sn-pub').checked;
  return v;
}
function sitePrevia(){
  const el = $('#sn-previa'); if (!el) return;
  const v = siteLerNumero();
  el.innerHTML = v.valor == null || Number.isNaN(v.valor) ? '' : `<b>${esc(siteNumeroTexto(v))}</b> ${esc(v.rotulo_pt || v.rotulo || '')}`;
}
async function siteSalvarNumero(){
  const v = siteLerNumero(), ed = siteM.ed;
  if (v.valor == null || Number.isNaN(v.valor)) return toast('Escreva o valor em número, como 57 ou 1,78.', true);
  if (Number.isNaN(v.valor_ate)) return toast('O fim da faixa também vai em número, como 30.', true);
  if (v.valor_ate != null && v.valor_ate <= v.valor) return toast('O fim da faixa precisa ser maior que o valor.', true);
  if (!v.rotulo && !v.rotulo_pt && !v.rotulo_fr) return toast('Escreva o que o número diz em pelo menos um idioma.', true);
  if (v.origem === 'literatura' && !v.fonte) return toast('Número da literatura precisa da fonte: autor, revista e ano.', true);
  if (v.fonte_url && !/^https?:\/\//.test(v.fonte_url)) return toast('O link da fonte começa com https://.', true);
  const bt = $('#sn-salvar'); if (bt) bt.disabled = true;
  try{
    const q = ed.id ? sb.from('site_projeto_numeros').update(v).eq('id', ed.id)
                    : sb.from('site_projeto_numeros').insert({ ...v, site_projeto_id:ed.siteId });
    const { error } = await q;
    if (error) throw error;
    fechaModal();
    toast(siteGestor() ? (v.publicado ? 'Número salvo e publicado.' : 'Número salvo, fora do site.') : 'Número salvo como rascunho. A gestão do site publica.');
    await siteRecarregar();
  }catch(e){ toast('Não foi possível salvar: ' + siteErro(e), true); }
  finally{ const b = $('#sn-salvar'); if (b) b.disabled = false; }
}

/* ---------------- produção ---------------- */
function siteListaSaidas(el, p, pode){
  const ss = siteSaidasDe(p.id);
  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px">
      <p class="small muted" style="max-width:560px;line-height:1.6">Cada artigo, apresentação, estudo, parceria ou prêmio do projeto.
        O título vai como foi publicado; as parcerias também formam a linha de parceiros da página.</p>
      ${pode ? `<button class="btn ghost mini" onclick="siteModalSaida('${p.id}')">${ic('plus')} Novo item</button>` : ''}
    </div>
    ${ss.length ? `<div class="wrap"><table class="tabela trabalho site-tab">
      <thead><tr><th>Tipo</th><th>Título</th><th>Situação</th><th>Data</th><th>No site</th><th><span class="sr">Ações</span></th></tr></thead>
      <tbody>${ss.map(s => `<tr>
        <td>${esc(rotuloDe(SITE_TIPOS, s.tipo))}</td>
        <td class="site-rot" title="${esc(s.titulo)}">${esc(s.titulo)}${s.veiculo ? `<span class="site-fonte">${esc(s.veiculo)}</span>` : ''}</td>
        <td>${esc(rotuloDe(SITE_SITUACOES, s.situacao))}</td>
        <td>${s.data ? fmtD(s.data) : '—'}</td>
        <td>${sitePill(s)}${!s.publicado && s.criado_por ? `<span class="site-fonte">de ${esc(nomeDe(s.criado_por))}</span>` : ''}</td>
        <td style="white-space:nowrap">${siteAcoes('saida', s, pode)}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="empty">Nada ainda.${pode ? ' Acrescente o primeiro artigo, estudo ou parceria.' : ''}</div>`}`;
}
function siteModalSaida(siteId, id){
  const s = id ? siteM.saidas.find(x => x.id === id) : null;
  siteM.ed = { siteId, id:id || null };
  abreModal(`<h3>${s ? 'Editar item' : 'Novo item de produção'}</h3>
    <p class="small muted" style="margin:-4px 0 14px;line-height:1.6">${siteGestor() ? 'Publicado, aparece na seção Produção da página do projeto.'
      : 'Fica como rascunho até a gestão do site publicar.'}</p>
    <div class="form-grid">
      <div class="fld"><label for="ss-tipo">Tipo</label><select id="ss-tipo" onchange="siteTipoSaida()">${opcoes(SITE_TIPOS, s?.tipo || 'artigo')}</select></div>
      <div class="fld"><label for="ss-sit">Situação</label><select id="ss-sit">${opcoes(SITE_SITUACOES, s?.situacao || 'em_andamento')}</select></div>
      <div class="fld full"><label for="ss-titulo" id="ss-titulo-lb">Título, como foi publicado</label>
        <input id="ss-titulo" value="${esc(s?.titulo || '')}" maxlength="300"></div>
      <div class="fld full" data-nao-parc><label for="ss-veiculo">Revista, evento ou registro</label>
        <input id="ss-veiculo" value="${esc(s?.veiculo || '')}" maxlength="200" placeholder="CBEB 2026, J Neural Eng, PROSPERO…"></div>
      <div class="fld"><label for="ss-data">Data</label><input id="ss-data" type="date" value="${esc(s?.data || '')}"></div>
      <div class="fld"><label for="ss-ordem">Ordem (sem data)</label><input id="ss-ordem" type="number" value="${esc(s?.ordem ?? 100)}"></div>
      <div class="fld full"><label for="ss-url">Link (https)</label><input id="ss-url" value="${esc(s?.url || '')}" placeholder="https://doi.org/…"></div>
      <div class="fld full" data-so-parc><label for="ss-img">Logo (https ou assets/arquivo.png do site)</label>
        <input id="ss-img" value="${esc(s?.imagem_url || '')}" placeholder="assets/visuri.png"></div>
      <div class="fld full">${siteCamposIdioma('ss', s, 'nota', 'Nota curta', 240, 2)}
        <p class="mini" id="ss-nota-dica"></p></div>
      ${siteGestor() ? `<div class="fld full"><label class="check"><input id="ss-pub" type="checkbox" ${s?.publicado ? 'checked' : ''}> Publicado no site</label></div>` : ''}
    </div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="ss-salvar" onclick="siteSalvarSaida()">${s ? 'Salvar item' : 'Acrescentar item'}</button></div>`, false, true);
  siteTipoSaida();
}
function siteTipoSaida(){
  const parc = $('#ss-tipo').value === 'parceria';
  document.querySelectorAll('[data-so-parc]').forEach(d => d.hidden = !parc);
  document.querySelectorAll('[data-nao-parc]').forEach(d => d.hidden = parc);
  $('#ss-titulo-lb').textContent = parc ? 'Instituição parceira' : 'Título, como foi publicado';
  $('#ss-nota-dica').textContent = parc ? 'O papel da instituição: "Estrutura e execução dos testes clínicos".'
    : 'Uma frase de contexto: "Revisão de escopo apresentada no CBEB".';
}
async function siteSalvarSaida(){
  const ed = siteM.ed, parc = $('#ss-tipo').value === 'parceria';
  const v = { tipo:$('#ss-tipo').value, situacao:$('#ss-sit').value, titulo:$('#ss-titulo').value.trim(),
    veiculo: parc ? null : ($('#ss-veiculo').value.trim() || null), data:$('#ss-data').value || null,
    ordem:parseInt($('#ss-ordem').value, 10) || 100, url:$('#ss-url').value.trim() || null,
    imagem_url: parc ? ($('#ss-img').value.trim() || null) : null };
  SITE_IDIOMAS.forEach(l => { v['nota' + l.sf] = $('#ss-nota' + l.sf).value.trim() || null; });
  if ($('#ss-pub')) v.publicado = $('#ss-pub').checked;
  if (!v.titulo) return toast(parc ? 'Escreva o nome da instituição.' : 'Escreva o título, como foi publicado.', true);
  if (v.url && !/^https?:\/\//.test(v.url)) return toast('O link começa com https://.', true);
  if (v.imagem_url && !/^(https:\/\/|assets\/[a-z0-9._-]+$)/.test(v.imagem_url))
    return toast('O logo é um endereço https ou um arquivo de assets/ do site, como assets/visuri.png.', true);
  const bt = $('#ss-salvar'); if (bt) bt.disabled = true;
  try{
    const q = ed.id ? sb.from('site_projeto_saidas').update(v).eq('id', ed.id)
                    : sb.from('site_projeto_saidas').insert({ ...v, site_projeto_id:ed.siteId });
    const { error } = await q;
    if (error) throw error;
    fechaModal();
    toast(siteGestor() ? (v.publicado ? 'Item salvo e publicado.' : 'Item salvo, fora do site.') : 'Item salvo como rascunho. A gestão do site publica.');
    await siteRecarregar();
  }catch(e){ toast('Não foi possível salvar: ' + siteErro(e), true); }
  finally{ const b = $('#ss-salvar'); if (b) b.disabled = false; }
}

/* ---------------- publicar e excluir ---------------- */
async function sitePublicar(tabela, id, sim){
  try{
    const { error } = await sb.from(tabela).update({ publicado:sim }).eq('id', id);
    if (error) throw error;
    toast(sim ? 'Publicado. Aparece no site na próxima visita.' : 'Fora do site. Continua guardado aqui.');
    await siteRecarregar();
  }catch(e){ toast('Não foi possível mudar: ' + siteErro(e), true); }
}
async function siteExcluirItem(tabela, id){
  const lista = tabela === 'site_projeto_numeros' ? siteM.numeros : siteM.saidas;
  const it = lista.find(x => x.id === id);
  const nome = tabela === 'site_projeto_numeros' ? siteNumeroTexto(it || {}) : (it?.titulo || '');
  if (!await confirma(`Excluir <b>${esc(nome)}</b>? Não é possível desfazer.${it?.publicado ? ' Ele sai do site também.' : ''}`, 'Excluir')) return;
  try{
    const { error } = await sb.from(tabela).delete().eq('id', id);
    if (error) throw error;
    toast('Excluído.');
    await siteRecarregar();
  }catch(e){ toast('Não foi possível excluir: ' + siteErro(e), true); }
}

async function siteRecarregar(){
  try{ await siteCarregar(); }catch(e){ return falha(e, 'Não foi possível recarregar'); }
  if (siteM.contexto === 'admin'){
    if (!siteM.sel || !siteM.projetos.find(p => p.id === siteM.sel)) siteM.sel = siteM.projetos[0]?.id || null;
    siteDesenharAdmin();
  } else if (siteM.contexto === 'projeto') siteDesenharNoProjeto();
}

/* ============================================================
   NA PÁGINA DO PROJETO (#/projetos/<CÓDIGO>)
   ============================================================ */
async function siteNoProjeto(el, pj){
  siteM.alvo = el; siteM.contexto = 'projeto'; siteM.pj = pj;
  try{ await siteCarregar(); }
  catch(_){ el.innerHTML = ''; return; }
  siteDesenharNoProjeto();
}
function siteDesenharNoProjeto(){
  const el = siteM.alvo, pj = siteM.pj; if (!el || !pj) return;
  const p = siteM.projetos.find(x => x.projeto_id === pj.id);
  const pode = siteGestor() || (pj.supervisor != null && pj.supervisor === state.perfil?.registro);
  if (!p){
    el.innerHTML = siteGestor() ? `<div class="card site-no-pj"><h3>No site</h3>
      <p class="small muted" style="line-height:1.6">Este projeto ainda não tem página em neurodynamics.dev. Ligue uma página a ele em
        <a href="#/admin/site" style="text-decoration:underline">Administração › Site institucional</a>, no campo Projeto do SOMA.</p></div>` : '';
    return;
  }
  const espera = siteNumerosDe(p.id).filter(n => !n.publicado).length + siteSaidasDe(p.id).filter(s => !s.publicado).length;
  el.innerHTML = `<div class="card site-no-pj">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div><h3>No site</h3>
        <p class="small muted" style="line-height:1.6;max-width:620px">A página pública de ${esc(p.nome)}: números com fonte e a produção do projeto.
          ${pode && !siteGestor() ? 'O que você acrescentar chega como rascunho; a gestão do site publica.' : ''}
          ${espera ? `<b>${espera} ${espera === 1 ? 'item espera' : 'itens esperam'} publicação.</b>` : ''}</p></div>
      ${p.publicado ? `<a class="btn ghost mini" href="${SITE_URL_PUB}/#/projects/${encodeURIComponent(p.slug)}" target="_blank" rel="noopener">Ver a página ${ic('externo')}</a>`
        : '<span class="pill"><span class="dt dt-gray"></span>Fora do site</span>'}
    </div>
    <h4 class="site-sub">Números</h4><div id="site-pj-num"></div>
    <h4 class="site-sub">Produção</h4><div id="site-pj-saidas"></div>
  </div>`;
  siteListaNumeros($('#site-pj-num'), p, pode);
  siteListaSaidas($('#site-pj-saidas'), p, pode);
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'site', rotulo:'Site',
  buscar: (t) => siteGestor() ? filtrarSimples(siteM.projetos.map(p => ({ titulo:p.nome, sub:'Página do site', href:'#/admin/site' })), t, 6) : []
});
