/* ============================================================
   MÓDULO · ARQUIVOS
   O controle de documentos e registros — o que a planilha NRO-PUB-001
   fazia, com as regras do template NRO-PUB-002, agora vivo: cada
   arquivo com código, revisão, status e quem mexeu por último, e toda
   versão nova passando por revisão antes de valer.

   Rotas:
     #/arquivos                       o rol: todos os arquivos, com filtro por emissor
     #/arquivos/<PES>                 o mesmo rol, já filtrado por um emissor (uma aba da planilha)
     #/arquivos/NRO-PES-007[-2]       a tela de um arquivo
     #/arquivos/revisoes              tudo o que aguarda revisão
     #/arquivos/templates             os templates e onde cada um é usado
     #/arquivos/visao                 visão geral: o que aguarda você, os mexidos, os emissores
     #/arquivos/config[/<aba>]        séries, emissores, padrão de projeto (gestor)
   O rol é a tela; o resto é secundário, na linha de links logo abaixo do
   título (arqNavHTML) e no fim da seção, no menu.

   O rol de um projeto (#/projetos/<código>/arquivos) é desenhado daqui
   também: mod-projetos carrega este módulo antes e chama arqRolDoProjeto.

   Precisa da migração db/v20_projetos_arquivos.sql (e a 21.0 traz a
   planilha como rol inicial). Sem ela, a tela diz isso em vez de quebrar.

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, ibtn, confirma, falha, motivoRPC,
   avatarFoto, nomeDe, carregarLib, registrarBusca, filtrarSimples,
   gruposEfetivos, grupoPorId, docGestor, logoProjeto,
   carregarProjetosEArquivos.
   ============================================================ */

const arq = {
  pronto:false, em:0, erro:null, rol:[], emissores:[], padrao:[], pendentes:[], series:[],
  filtro:{ q:'', status:'', natureza:'', estrutura:'', subtipo:'', classe:'', pend:false },
  abertos:new Set(), ordem:{ col:'codigo', dir:1 },
  tela:null, envio:null, cfgFiltro:{ emissor:'', q:'' }
};

const ARQ_SUBTIPOS = {
  politica:'Política', procedimento:'Procedimento', manual:'Manual ou guia', template:'Template ou modelo',
  formulario:'Formulário', planilha:'Planilha', checklist:'Lista ou checklist', relatorio:'Relatório',
  ata:'Ata', inventario:'Inventário', declaracao:'Declaração', outro:'Outro'
};
const ARQ_STATUS = {
  rascunho:   ['Rascunho',   'gray', ''],
  em_revisao: ['Em revisão', 'warn', 'p-warn'],
  ativo:      ['Ativo',      'ok',   'p-ok'],
  obsoleto:   ['Obsoleto',   'bad',  'p-bad']
};
const ARQ_CLASSES = {
  publico:      ['Público',      'toda a equipe lê'],
  controlado:   ['Controlado',   'lê quem está no grupo do emissor, na equipe do projeto, no grupo revisor ou num grupo de leitura'],
  confidencial: ['Confidencial', 'só os grupos de leitura e o grupo revisor']
};
const ARQ_ICONE = { template:'molde', documento:'doc', registro:'registro' };
/* A estrutura de uma série — a coluna ao lado do título na NRO-PUB-001.
   É ela que diz o que a cabeça (o arquivo sem PN) é, e o que cada PN é.
   No banco, tipo + multiplo da série; as frases são as mesmas de
   doc_estrutura_frase() (db/v22_estrutura_das_series.sql). "avulso" é
   o NRO-PUB-002: documento sem PN com subtipo template. */
const ARQ_ESTRUTURAS = {
  unico:      { rot:'Documento único', curto:'Documento único · sem PN',
                frase:'um documento para toda a equipe, sem template e sem filhos', tipo:'documento', multiplo:false,
                ex:'uma política, um procedimento: existe um só, e revisa (Rev. A, B…)' },
  documentos: { rot:'Template → documentos', curto:'Template · cada PN é um documento',
                frase:'um template, cada pn é um documento filho da série', tipo:'documento', multiplo:true,
                ex:'um termo de abertura por projeto: cada PN é um documento, e cada um revisa' },
  registros:  { rot:'Template → registros', curto:'Template · cada PN é um registro',
                frase:'um template, cada pn é um registro filho da série', tipo:'registro', multiplo:true,
                ex:'uma ata por reunião: cada PN é um registro, que depois de aprovado não muda' },
  avulso:     { rot:'Template avulso', curto:'Template avulso · sem PN',
                frase:'um template avulso, sem pn', tipo:'documento', multiplo:false,
                ex:'o modelo de base dos outros, como o NRO-PUB-002' }
};
const arqEstrutura = s => s.multiplo ? (s.tipo === 'registro' ? 'registros' : 'documentos')
  : s.subtipo === 'template' ? 'avulso' : 'unico';
/* O que a linha é, em poucas palavras: o template e o que nasce dele,
   o documento único, ou o PN — documento ou registro. */
const arqComoE = r => r.pn != null
  ? `${r.tipo === 'registro' ? 'Registro' : 'Documento'} · PN ${r.pn}`
  : ARQ_ESTRUTURAS[arqEstrutura(r)].curto;
const RE_CODIGO = /^NRO-[A-Z]{3}-\d{3}(-\d+)?$/;

const arqNatureza = r => r.natureza === 'template'
  ? (r.tipo === 'registro' ? 'Template de registro' : 'Template de documento')
  : r.natureza === 'registro' ? 'Registro' : (r.pn ? 'Documento com PN' : 'Documento');
const arqEu = () => (state.membros || []).find(m => m.registro === state.perfil?.registro);
const arqGrupoNome = id => grupoPorId(id)?.nome || null;
const arqRevisores = r => arqGrupoNome(r.grupo_revisor) || 'PMO';
const arqEmissor = p => arq.emissores.find(e => e.prefixo === p);
const arqPendente = id => arq.pendentes.find(p => p.arquivo_id === id) || null;
const arqProjeto = id => (state.projetos || []).find(p => p.id === id) || null;

/* ---------------- carga ---------------- */
async function arqCarregar(forcar){
  if (arq.pronto && !forcar && Date.now() - arq.em < 20000) return;
  const [rol, emi, pad, pend] = await Promise.all([
    sb.from('doc_rol').select('*').order('codigo'),
    sb.from('doc_emissores').select('*').order('ordem').order('prefixo'),
    sb.from('doc_padrao_projeto').select('*').order('ordem'),
    sb.from('doc_revisoes').select('id,arquivo_id,rev,estado,enviado_por,enviado_nome,enviado_em').eq('estado', 'pendente')
  ]);
  if (rol.error){ arq.erro = rol.error; arq.pronto = false; return; }
  arq.erro = null;
  arq.rol = rol.data || [];
  arq.emissores = emi.data || [];
  arq.padrao = pad.data || [];
  arq.pendentes = pend.data || [];
  arq.pronto = true; arq.em = Date.now();
}
function arqSemMigracao(){
  $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Arquivos</span>
      <h1>Controle de documentos e registros</h1></div></div>
    <div class="aviso-box err"><b>O controle de arquivos ainda não está no banco.</b>
      ${esc(arq.erro?.message || '')}<br><span class="small">Falta aplicar a migração
      <code>db/v20_projetos_arquivos.sql</code> (e, para trazer a planilha NRO-PUB-001,
      a <code>db/v21_rol_nro_pub_001.sql</code>).</span></div>`;
}

/* Posso revisar a versão pendente deste arquivo? A mesma regra de
   doc_pode_revisar(): estar no grupo revisor (ou ser gestor, se a série
   não tem grupo) e não ter sido quem enviou. Aqui só decide o botão. */
function arqPossoRevisar(r){
  const p = arqPendente(r.id); if (!p) return false;
  if (p.enviado_por != null && p.enviado_por === state.perfil?.registro) return false;
  if (!r.grupo_revisor) return docGestor();
  const g = arqGrupoNome(r.grupo_revisor);
  return !!g && gruposEfetivos(arqEu()).has(g);
}

/* ---------------- rota ---------------- */
async function pageArquivos(sub, sub2){
  if (sub && RE_CODIGO.test(String(sub).toUpperCase())) return arqTela(String(sub).toUpperCase());
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Carregando o rol…</div>';
  await arqCarregar();
  if (arq.erro) return arqSemMigracao();
  if (!sub) return arqLista('');
  if (sub === 'visao')     return arqVisao();
  if (sub === 'revisoes')  return arqRevisoes();
  if (sub === 'templates') return arqTemplates();
  if (sub === 'config'){
    if (!docGestor()){ history.replaceState(null, '', location.pathname + '#/arquivos'); return arqLista(''); }
    return arqConfig(sub2);
  }
  if (/^[A-Za-z]{3}$/.test(sub) && arqEmissor(sub.toUpperCase())) return arqLista(sub.toUpperCase());
  history.replaceState(null, '', location.pathname + '#/arquivos');
  arqLista('');
}

/* A navegação de dentro de Arquivos. O rol é a tela; o que aguarda
   revisão, os templates, a visão geral e (para o gestor) as
   configurações são secundários: uma linha de links, logo abaixo do
   título, em toda tela do módulo. */
function arqNavHTML(atual){
  const paraMim = arq.rol.filter(arqPossoRevisar).length;
  const it = (sub, rot, extra = '') => `<a href="#/arquivos${sub ? '/' + sub : ''}"${atual === sub
      ? ' class="on" aria-current="page"' : ''}>${rot}${extra}</a>`;
  return `<nav class="arq-nav" aria-label="Arquivos">
    ${it('', 'Todos os arquivos')}
    ${it('revisoes', 'Para revisar', arq.pendentes.length
      ? ` <span class="n${paraMim ? ' sua' : ''}" title="${paraMim ? paraMim + ' com você' : 'nenhuma com você'}">${arq.pendentes.length}</span>` : '')}
    ${it('templates', 'Templates')}
    ${it('visao', 'Visão geral')}
    ${docGestor() ? it('config', 'Configurações') : ''}
  </nav>`;
}

function arqTopo(eyebrow, titulo, lead, acoes){
  return `<div class="topo-gestao"><div class="tx"><span class="eyebrow">${eyebrow}</span>
      <h1>${titulo}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
    ${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
}
const arqPill = st => { const s = ARQ_STATUS[st] || ARQ_STATUS.rascunho;
  return `<span class="pill ${s[2]}"><span class="dt dt-${s[1]}"></span>${s[0]}</span>`; };

/* ============================================================
   VISÃO GERAL
   ============================================================ */
function arqVisao(){
  const rol = arq.rol;
  const n = st => rol.filter(r => r.status === st).length;
  const paraMim = rol.filter(arqPossoRevisar);
  const meus = arq.pendentes.filter(p => p.enviado_por === state.perfil?.registro)
    .map(p => ({ p, r: rol.find(r => r.id === p.arquivo_id) })).filter(x => x.r);
  const recentes = [...rol].sort((a, b) => String(b.alterado_em).localeCompare(String(a.alterado_em))).slice(0, 8);
  const fila = (r, extra) => `<a class="arq-fila" href="#/arquivos/${esc(r.codigo)}">
      <span class="arq-ic ${r.natureza}">${ic(ARQ_ICONE[r.natureza])}</span>
      <span class="tx"><span class="tt"><span class="arq-rev" style="color:var(--syn-tx)">${esc(r.codigo)}</span> · ${esc(r.titulo)}</span>
        <span class="mt">${extra}</span></span></a>`;

  $('#main').innerHTML = arqTopo('Arquivos', 'Visão geral',
    'O que aguarda você, o que se mexeu por último e como o rol se organiza, por emissor e por estrutura.',
    `<button class="btn ghost mini" onclick="arqExportar()">${ic('down')} Exportar planilha</button>
     ${arqPossoAdicionar() ? `<button class="btn solid mini" onclick="arqModalAdicionar()">${ic('plus')} Adicionar</button>` : ''}`)
  + arqNavHTML('visao')
  + `<div class="metricas" style="margin-bottom:18px">
      <div class="metrica"><span class="rot">Ativos</span><span class="val">${n('ativo')}</span><span class="var neutro">em vigor</span></div>
      <div class="metrica"><span class="rot">Em revisão</span><span class="val">${arq.pendentes.length}</span><span class="var neutro">versões aguardando</span></div>
      <div class="metrica"><span class="rot">Rascunho</span><span class="val">${n('rascunho')}</span><span class="var neutro">sem versão aprovada</span></div>
      <div class="metrica"><span class="rot">Para você</span><span class="val">${paraMim.length}</span>
        <span class="var ${paraMim.length ? 'sobe' : 'neutro'}">${paraMim.length ? 'revisar agora' : 'nada pendente'}</span></div>
    </div>
    <div class="pj-cols" style="margin-bottom:18px">
      <div class="card"><h3>Para você revisar</h3>
        ${paraMim.length ? paraMim.map(r => { const p = arqPendente(r.id);
            return fila(r, `${p.rev ? 'Rev. ' + esc(p.rev) + ' · enviada' : 'Registro · enviado'} por ${esc(p.enviado_nome || '—')} em ${fmtD(p.enviado_em)}`); }).join('')
          : '<p class="muted small">Nada aguardando a sua revisão.</p>'}
        ${meus.length ? `<h3 style="margin-top:18px">Seus envios aguardando</h3>${meus.map(({ p, r }) =>
            fila(r, `${p.rev ? 'Rev. ' + esc(p.rev) : 'Registro'} · com ${esc(arqRevisores(r))} desde ${fmtD(p.enviado_em)}`)).join('')}` : ''}
      </div>
      <div class="card"><h3>Mexidos por último</h3>
        ${recentes.map(r => fila(r, `${fmtD(r.alterado_em)} · ${esc(r.alterado_nome || '—')}`)).join('') || '<p class="muted small">Nenhum arquivo ainda.</p>'}
      </div>
    </div>
    <div class="adm-grupo" style="margin-top:0">Como o rol se organiza</div>
    ${arqLegendaHTML(rol.filter(r => r.pn == null))}
    <div class="adm-grupo">Emissores</div>
    <div class="arq-emis">${arq.emissores.map(e => {
      const d = rol.filter(r => r.prefixo === e.prefixo);
      return `<a class="arq-emi" href="#/arquivos/${e.prefixo}"><span class="pf">NRO-${esc(e.prefixo)}</span>
        <span class="nm">${esc(e.nome)}</span>
        <span class="ns"><span><b>${d.filter(r => r.pn == null).length}</b> séries</span>
          <span><b>${d.filter(r => r.status === 'ativo').length}</b> ativos</span>
          ${d.some(r => arqPendente(r.id)) ? `<span style="color:var(--warn)"><b>${d.filter(r => arqPendente(r.id)).length}</b> em revisão</span>` : ''}</span></a>`;
    }).join('') || '<p class="muted small">Nenhum emissor cadastrado. O gestor cadastra em Configurações.</p>'}</div>`;
}

/* ============================================================
   O ROL — a tabela, como a lista do Drive
   ============================================================ */
function arqLinha(r, o = {}){
  const pend = r.rev_pendente
    ? `<span class="arq-pend" title="Versão aguardando revisão">${r.rev_pendente === '—' ? 'em revisão' : esc(r.rev_pendente) + ' em revisão'}</span>` : '';
  const rev = r.natureza === 'registro'
    ? (r.template_rev ? `<span class="tpl" title="Registro não se revisa: esta é a revisão do template usado">Rev. ${esc(r.template_rev)} · tpl</span>` : '—')
    : (r.rev_vigente ? `Rev. ${esc(r.rev_vigente)}` : '—');
  const cls = r.classe !== 'publico'
    ? ` · <span class="arq-cls ${r.classe}">${ic(r.classe === 'confidencial' ? 'cadeado' : 'shield')}${ARQ_CLASSES[r.classe][0]}</span>` : '';
  const npn = r.pn == null && Number(r.n_pns) > 0 ? `<span class="arq-npn">${r.n_pns} PN</span>` : '';
  const caret = o.caret
    ? (Number(r.n_pns) > 0
        ? `<button class="arq-caret" aria-expanded="${arq.abertos.has(r.serie_id)}" aria-label="Mostrar os PNs de ${esc(r.codigo)}"
             onclick="event.stopPropagation(); arqAlternarSerie('${r.serie_id}')">${ic('chevron')}</button>`
        : '<span class="arq-caret sem" aria-hidden="true"></span>')
    : '';
  const sub = o.sub ?? `${esc(arqComoE(r))} · ${esc(ARQ_SUBTIPOS[r.subtipo] || r.subtipo)}${cls}`;
  return `<tr class="click${r.pn != null && o.aninhado ? ' pn' : ''}" tabindex="0"
      onclick="location.hash='#/arquivos/${esc(r.codigo)}'" onkeydown="if(event.key==='Enter')this.click()">
    <td><div class="cel-cod">${caret}<span class="arq-ic ${r.natureza}">${ic(ARQ_ICONE[r.natureza])}</span>
      <span class="cod">${esc(r.codigo)}</span></div></td>
    <td><span class="tit" title="${esc(r.titulo)}">${esc(r.titulo)}${npn}</span><span class="sub">${sub}</span></td>
    <td class="arq-rev">${rev}${pend}</td>
    ${o.compacto ? '' : `<td>${fmtD(r.alterado_em)}<span class="arq-quem">${esc(r.alterado_nome || '—')}</span></td>`}
    <td>${arqPill(r.status)}</td>
  </tr>`;
}
/* Compacta: a tabela que mora dentro da tela de um arquivo (onde é
   usado, os PNs), sem a coluna de última alteração. */
function arqTabela(corpo, o = {}){
  const th = (col, rot, w) => `<th ${w ? `style="width:${w}"` : ''} class="${o.ordenar ? 'ord' : ''}"
      ${o.ordenar ? `aria-sort="${arq.ordem.col === col ? (arq.ordem.dir > 0 ? 'ascending' : 'descending') : 'none'}"
      onclick="arqOrdenar('${col}')"` : ''}>${rot}</th>`;
  return `<div class="card" style="padding:0"><div class="wrap" style="max-height:none">
    <table class="tabela trabalho fixa arq-tab">
      <thead><tr>${th('codigo', 'Código', o.compacto ? '180px' : '210px')}${th('titulo', 'Título')}${th('rev', 'Rev.', o.compacto ? '130px' : '150px')}
        ${o.compacto ? '' : th('alterado_em', 'Última alteração', '160px')}${th('status', 'Status', o.compacto ? '110px' : '120px')}</tr></thead>
      <tbody>${corpo || `<tr><td colspan="${o.compacto ? 4 : 5}" class="empty">${o.vazio || 'Nenhum arquivo.'}</td></tr>`}</tbody>
    </table></div></div>`;
}
function arqOrdenar(col){
  arq.ordem = { col, dir: arq.ordem.col === col ? -arq.ordem.dir : 1 };
  arqRedesenharRol();
}
function arqAlternarSerie(id){
  arq.abertos.has(id) ? arq.abertos.delete(id) : arq.abertos.add(id);
  arqRedesenharRol();
}
const ORDEM_STATUS = { rascunho:0, em_revisao:1, ativo:2, obsoleto:3 };
function arqCompara(a, b){
  const { col, dir } = arq.ordem;
  const v = r => col === 'status' ? ORDEM_STATUS[r.status] : col === 'rev' ? (r.rev_vigente || r.template_rev || '')
    : String(r[col] ?? '');
  const x = v(a), y = v(b);
  return (x < y ? -1 : x > y ? 1 : a.codigo.localeCompare(b.codigo)) * dir;
}
function arqFiltra(r){
  const f = arq.filtro, q = norm(f.q);
  return (!q || norm(r.codigo).includes(q) || norm(r.titulo).includes(q))
    && (!f.status || r.status === f.status) && (!f.natureza || r.natureza === f.natureza)
    && (!f.estrutura || arqEstrutura(r) === f.estrutura)
    && (!f.subtipo || r.subtipo === f.subtipo) && (!f.classe || r.classe === f.classe)
    && (!f.pend || !!arqPendente(r.id));
}
const arqFiltroAtivo = () => { const f = arq.filtro; return !!(f.q || f.status || f.natureza || f.estrutura || f.subtipo || f.classe || f.pend); };

/* O ROL — a primeira tela de Arquivos: todos os arquivos, como a lista
   do Drive, e o filtro por emissor (#/arquivos/PES é o mesmo rol, já
   filtrado — cada aba da planilha). As cabeças de série, e os PNs de
   cada uma a um clique. Com filtro, a lista vira plana: o que casa,
   cabeça ou PN. */
function arqLista(pref){
  const e = pref ? arqEmissor(pref) : null;
  arq.rolAtual = pref || '';
  const arg = pref ? `'${pref}'` : '';
  $('#main').innerHTML = arqTopo(pref ? `Arquivos · NRO-${esc(pref)}` : 'Arquivos', pref ? esc(e.nome) : 'Todos os arquivos',
    pref ? `A aba ${esc(pref)} da NRO-PUB-001.${e.grupo_id ? ` Quem responde por ela é o grupo <b>${esc(arqGrupoNome(e.grupo_id) || '—')}</b>.` : ''}`
         : 'O rol da NRO-PUB-001, vivo: cada arquivo com código, revisão, status e quem mexeu por último — e toda versão nova passa por revisão antes de valer.',
    `<button class="btn ghost mini" onclick="arqExportar(${arg})">${ic('down')} Exportar</button>
     ${arqPossoAdicionar(pref) ? `<button class="btn solid mini" onclick="arqModalAdicionar(${arg})">${ic('plus')} Adicionar</button>` : ''}`)
  + arqNavHTML('')
  + arqLegendaHTML(arq.rol.filter(r => r.pn == null && (!pref || r.prefixo === pref)), true)
  + arqFiltrosHTML() + '<div id="arq-rol"></div>';
  arqRedesenharRol();
}
/* As estruturas, com quantas séries há de cada — a coluna ao lado do
   título na NRO-PUB-001, contada. No rol de um emissor, cada uma
   filtra; um segundo clique tira o filtro. */
function arqLegendaHTML(cabecas, filtra){
  const n = k => cabecas.filter(r => arqEstrutura(r) === k).length;
  return `<div class="arq-legenda">${Object.entries(ARQ_ESTRUTURAS).filter(([k]) => k !== 'avulso' || n(k)).map(([k, e]) => {
    const on = !!filtra && arq.filtro.estrutura === k;
    const tag = filtra ? 'button' : 'div';
    return `<${tag} class="arq-leg${on ? ' on' : ''}" data-est="${k}" ${filtra ? `aria-pressed="${on}"
        onclick="arq.filtro.estrutura=arq.filtro.estrutura==='${k}'?'':'${k}';arqLista(arq.rolAtual)"` : ''}>
      <span class="arq-ic ${k === 'registros' ? 'registro' : k === 'unico' ? 'documento' : 'template'}">${ic(k === 'registros' ? 'registro' : k === 'unico' ? 'doc' : 'molde')}</span>
      <span class="tx"><b>${e.rot}</b> <span class="n">${n(k)}</span><span class="fr">${k === 'avulso' ? 'sem frase na coluna: o modelo de base dos outros' : '“' + e.frase + '”'}</span></span></${tag}>`;
  }).join('')}</div>`;
}
function arqFiltrosHTML(){
  const f = arq.filtro;
  const sel = (k, rot, ops) => `<div class="fld"><label>${rot}</label><select onchange="arq.filtro.${k}=this.value;arqRedesenharRol()">
      <option value="">Todos</option>${ops.map(([v, l]) => `<option value="${v}" ${f[k] === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
  return `<div class="filtros arq-filtros">
    <div class="fld cresce"><label for="arq-q">Buscar</label><input id="arq-q" value="${esc(f.q)}" placeholder="Código ou título"
      oninput="arq.filtro.q=this.value;arqRedesenharRol(true)"></div>
    <div class="fld"><label for="arq-emissor">Emissor</label><select id="arq-emissor"
        onchange="location.hash = this.value ? '#/arquivos/' + this.value : '#/arquivos'">
      <option value="">Todos</option>${arq.emissores.map(e => `<option value="${e.prefixo}" ${arq.rolAtual === e.prefixo ? 'selected' : ''}>NRO-${esc(e.prefixo)} — ${
        esc(e.nome.replace(/^Departamento\s+(de|d[oa]s?)\s+/i, ''))}</option>`).join('')}</select></div>
    ${sel('status', 'Status', Object.entries(ARQ_STATUS).map(([k, v]) => [k, v[0]]))}
    ${sel('estrutura', 'Estrutura da série', Object.entries(ARQ_ESTRUTURAS).map(([k, v]) => [k, v.rot]))}
    ${sel('natureza', 'Natureza', [['template', 'Template'], ['documento', 'Documento'], ['registro', 'Registro']])}
    ${sel('subtipo', 'Subtipo', Object.entries(ARQ_SUBTIPOS))}
    ${sel('classe', 'Classe', Object.entries(ARQ_CLASSES).map(([k, v]) => [k, v[0]]))}
    <label class="check" style="align-self:center;margin-bottom:9px"><input type="checkbox" ${f.pend ? 'checked' : ''}
      onchange="arq.filtro.pend=this.checked;arqRedesenharRol()"> só com versão em revisão</label>
  </div>`;
}
let _arqQ = null;
function arqRedesenharRol(digitando){
  if (digitando){ clearTimeout(_arqQ); _arqQ = setTimeout(() => arqRedesenharRol(), 120); return; }
  const box = $('#arq-rol'); if (!box) return;
  const doEmissor = arq.rol.filter(r => !arq.rolAtual || r.prefixo === arq.rolAtual);
  let corpo;
  if (arqFiltroAtivo()){
    corpo = doEmissor.filter(arqFiltra).sort(arqCompara).map(r => arqLinha(r)).join('');
  } else {
    corpo = doEmissor.filter(r => r.pn == null).sort(arqCompara).map(c => arqLinha(c, { caret:true })
      + (arq.abertos.has(c.serie_id)
          ? doEmissor.filter(r => r.serie_id === c.serie_id && r.pn != null).sort((a, b) => a.pn - b.pn)
              .map(r => arqLinha(r, { aninhado:true, sub: r.projeto_codigo ? 'Projeto ' + esc(r.projeto_nome || r.projeto_codigo) : undefined })).join('')
          : '')).join('');
  }
  box.innerHTML = arqTabela(corpo, { ordenar:true, vazio: arqFiltroAtivo()
    ? 'Nenhum arquivo com esse filtro.' : arq.rolAtual ? 'Nenhuma série neste emissor ainda.' : 'Nenhum arquivo no rol ainda.' });
}

/* ============================================================
   REVISÕES E TEMPLATES
   ============================================================ */
function arqRevisoes(){
  const itens = arq.pendentes.map(p => ({ p, r: arq.rol.find(r => r.id === p.arquivo_id) })).filter(x => x.r)
    .sort((a, b) => String(a.p.enviado_em).localeCompare(String(b.p.enviado_em)));
  const minhas = itens.filter(x => arqPossoRevisar(x.r));
  const linha = ({ p, r }) => arqLinha(r, { sub: `${p.rev ? 'Rev. ' + esc(p.rev) + ' · enviada' : 'Registro · enviado'} por ${esc(p.enviado_nome || '—')} em ${fmtD(p.enviado_em)} · revisa ${esc(arqRevisores(r))}` });
  $('#main').innerHTML = arqTopo('Arquivos', 'Para revisar',
    'Toda versão nova — a primeira de um arquivo ou uma revisão — fica pendente até alguém do grupo revisor da série, que não seja quem enviou, aprovar. Até lá, ela não está disponível.')
  + arqNavHTML('revisoes')
  + `<div class="adm-grupo" style="margin-top:0">Com você · ${minhas.length}</div>`
  + arqTabela(minhas.map(linha).join(''), { vazio:'Nada aguardando a sua revisão.' })
  + `<div class="adm-grupo">Todas as pendentes · ${itens.length}</div>`
  + arqTabela(itens.map(linha).join(''), { vazio:'Nenhuma versão aguardando revisão.' });
}

function arqTemplates(){
  const tpls = arq.rol.filter(r => r.natureza === 'template').sort((a, b) => a.codigo.localeCompare(b.codigo));
  $('#main').innerHTML = arqTopo('Arquivos', 'Templates',
    'Os moldes: a cabeça de cada série com PN — cada PN nasce do template da sua série — e o NRO-PUB-002, o modelo de base. Quando um template ganha revisão, a tela dele mostra quem ainda usa a anterior.')
  + arqNavHTML('templates')
  + arqTabela(tpls.map(t => {
      const usos = arq.rol.filter(r => r.template_id === t.id);
      const velhos = usos.filter(r => r.template_rev && t.rev_vigente && r.template_rev !== t.rev_vigente).length;
      return arqLinha(t, { sub: `${esc(arqComoE(t))} · usado por ${usos.length} arquivo${usos.length === 1 ? '' : 's'}${velhos
        ? ` · <span class="arq-velho">${velhos} numa revisão anterior</span>` : ''}` });
    }).join(''), { vazio:'Nenhum template ainda.' });
}

/* ============================================================
   A TELA DE UM ARQUIVO
   ============================================================ */
async function arqTela(codigo){
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Abrindo o arquivo…</div>';
  await arqCarregar();
  if (arq.erro) return arqSemMigracao();
  let r = arq.rol.find(x => x.codigo === codigo);
  if (!r){ await arqCarregar(true); r = arq.rol.find(x => x.codigo === codigo); }
  if (!r){
    $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div>
      <h3>Nenhum arquivo com o código ${esc(codigo)}</h3>
      <p>Confira o código — ou procure pelo título no rol do emissor.</p>
      <a class="btn ghost" href="#/arquivos">Voltar aos arquivos</a></div>`;
    return;
  }
  const [revs, evs, comoPai, comoFilho, ler, editar] = await Promise.all([
    sb.from('doc_revisoes').select('*').eq('arquivo_id', r.id).order('enviado_em'),
    sb.from('doc_eventos').select('*').eq('arquivo_id', r.id).order('criado_em'),
    sb.from('doc_relacoes').select('*').eq('pai_id', r.id),
    sb.from('doc_relacoes').select('*').eq('filho_id', r.id),
    sb.rpc('doc_pode_ler',    { p_arquivo: r.id }),
    sb.rpc('doc_pode_editar', { p_arquivo: r.id })
  ]);
  const t = {
    r, revs: revs.data || [], evs: evs.data || [],
    filhos: (comoPai.data || []).map(x => arq.rol.find(a => a.id === x.filho_id)).filter(Boolean),
    pais:   (comoFilho.data || []).map(x => arq.rol.find(a => a.id === x.pai_id)).filter(Boolean),
    ler: !!ler.data, editar: !!editar.data, irmaos: [], tplRevs: [], podeRevisar: false
  };
  if (t.pais.length){
    const ir = await sb.from('doc_relacoes').select('*').in('pai_id', t.pais.map(p => p.id));
    t.irmaos = [...new Set((ir.data || []).map(x => x.filho_id))].filter(id => id !== r.id)
      .map(id => arq.rol.find(a => a.id === id)).filter(Boolean);
  }
  if (r.template_id){
    const tr = await sb.from('doc_revisoes').select('id,rev,estado,enviado_nome,enviado_em,revisor_nome,revisado_em')
      .eq('arquivo_id', r.template_id);
    t.tplRevs = (tr.data || []).filter(v => ['aprovada', 'substituida'].includes(v.estado));
  }
  t.pend = t.revs.find(v => v.estado === 'pendente') || null;
  if (t.pend){ const pr = await sb.rpc('doc_pode_revisar', { p_revisao: t.pend.id }); t.podeRevisar = !!pr.data; }
  t.vigente = [...t.revs].reverse().find(v => v.estado === 'aprovada') || null;
  arq.tela = t;
  arqDesenharTela();
}

function arqDesenharTela(){
  const t = arq.tela, r = t.r;
  const tpl = r.natureza === 'template';
  const e = arqEmissor(r.prefixo);
  const cabeca = r.pn != null ? arq.rol.find(x => x.serie_id === r.serie_id && x.pn == null) : null;
  const pj = arqProjeto(r.projeto_id);
  $('#main').innerHTML = `<div class="arq-folha${tpl ? ' tpl' : ''}">
    ${tpl ? `<span class="arq-fita">${ic('molde')} ${esc(arqNatureza(r))} — molde, não documento</span>` : ''}
    <nav class="arq-migalha" aria-label="Caminho"><a href="#/arquivos">Arquivos</a><span>›</span>
      <a href="#/arquivos/${esc(r.prefixo)}">${esc(e?.nome || r.prefixo)}</a>
      ${cabeca ? `<span>›</span><a href="#/arquivos/${esc(cabeca.codigo)}">${esc(cabeca.codigo)}</a>` : ''}
      <span>›</span><b>${esc(r.codigo)}</b></nav>
    <div class="arq-cab">
      <span class="arq-ic ${r.natureza}">${ic(ARQ_ICONE[r.natureza])}</span>
      <div class="tx"><span class="cod">${esc(r.codigo)}</span>
        <h1>${esc(r.titulo)}</h1>
        <div class="arq-selos">${arqPill(r.status)}
          <span class="pill"><span class="dt dt-info"></span>${esc(arqNatureza(r))}</span>
          <span class="pill"><span class="dt dt-gray"></span>${esc(ARQ_SUBTIPOS[r.subtipo] || r.subtipo)}</span>
          <span class="arq-cls ${r.classe}" title="${esc(ARQ_CLASSES[r.classe][1])}">${ic(r.classe === 'publico' ? 'eye' : r.classe === 'confidencial' ? 'cadeado' : 'shield')}${ARQ_CLASSES[r.classe][0]}</span>
          ${pj ? `<a class="chip mini" style="display:inline-flex;align-items:center;gap:6px;padding:3px 9px 3px 4px"
              href="#/projetos/${esc(pj.codigo)}">${logoProjeto(pj.logo_semente, 16, pj.nome)}${esc(pj.nome)}</a>` : ''}
        </div></div>
    </div>
    ${arqEtapasHTML(t)}
    <div class="arq-cols">
      <div class="arq-main">${arqPrincipalHTML(t)}</div>
      <aside class="arq-lado">${arqLadoHTML(t)}</aside>
    </div></div>`;
}

/* A barra de status: rascunho → em revisão → ativo → obsoleto. Um
   arquivo ativo com revisão nova pendente está nos dois lugares ao
   mesmo tempo, e a barra diz isso: "em revisão" é o agora, e "ativo"
   fica aceso com a revisão que segue valendo. */
function arqEtapasHTML(t){
  const r = t.r, p = t.pend;
  const devolvida = [...t.revs].reverse().find(v => v.estado !== 'cancelada');
  const agora = r.status === 'obsoleto' ? 3 : p ? 1 : r.status === 'ativo' ? 2 : 0;
  const rotRev = v => v?.rev ? 'Rev. ' + v.rev : 'o registro';
  const sub = [
    agora === 0 ? (devolvida?.estado === 'devolvida' ? 'a última versão voltou para ajuste' : 'sem versão enviada ainda')
                : 'criado em ' + fmtD(r.criado_em),
    p ? `${rotRev(p)} com ${esc(arqRevisores(r))}` : '',
    r.status === 'obsoleto' ? '' : r.rev_vigente ? `Rev. ${esc(r.rev_vigente)} ${p ? 'segue em vigor' : 'em vigor'}`
      : r.status === 'ativo' ? 'registro aprovado' : '',
    r.status === 'obsoleto' ? esc(r.obsoleto_motivo || '') : ''
  ];
  const cor = ['', 'warn', 'ok', 'bad'][agora];
  return `<div class="arq-etapas" role="list" aria-label="Status do arquivo">${['Rascunho', 'Em revisão', 'Ativo', 'Obsoleto']
    .map((nome, i) => {
      const feita = i < agora || (i === 2 && p && r.status === 'ativo');
      return `<div role="listitem" class="arq-etapa${feita && i !== agora ? ' feita' : ''}${i === agora ? ' agora ' + cor : ''}"
        ${i === agora ? 'aria-current="step"' : ''}>${nome}<span class="sub">${sub[i] || '&nbsp;'}</span></div>`;
    }).join('')}</div>`;
}

/* O que é este arquivo, nos três eixos da NRO-PUB-001: template ou
   arquivo real; integrante de uma série (com PN) ou arquivo único; e
   se pode ser alterado — documento revisa, registro não (o template
   de registros, sim). A frase é a da coluna ao lado do título. */
function arqOQueEHTML(r){
  const est = arqEstrutura(r), E = ARQ_ESTRUTURAS[est];
  const cab = r.pn != null ? arq.rol.find(x => x.serie_id === r.serie_id && x.pn == null) : r;
  const npn = arq.rol.filter(x => x.serie_id === r.serie_id && x.pn != null).length;
  const tpl = r.natureza === 'template', reg = r.natureza === 'registro';
  const eixo = (rot, val, dt) => `<div class="eixo"><span class="rot">${rot}</span><b>${val}</b><span class="dt">${dt}</span></div>`;
  const oQue = tpl
    ? eixo('Template ou arquivo real', 'Template', est === 'avulso'
        ? 'o modelo de base: outro arquivo pode dizer que foi feito sobre ele'
        : `o molde da série: os arquivos reais são os PNs, e cada um nasce daqui`)
    : eixo('Template ou arquivo real', 'Arquivo real', r.pn != null
        ? `nasceu do template ${esc(cab?.codigo || '')}${r.template_rev ? ', Rev. ' + esc(r.template_rev) : ''}`
        : r.template_id ? `o próprio documento — escrito sobre o modelo ${esc(r.template_codigo || '')}`
        : 'o próprio documento: não nasce de template');
  const naSerie = r.pn != null
    ? eixo('Na série', `Integrante · PN ${r.pn}`, npn === 1 ? `o único PN da série ${esc(cab?.codigo || '')} até agora`
        : `um dos ${npn} PNs da série ${esc(cab?.codigo || '')}`)
    : tpl && est !== 'avulso'
      ? eixo('Na série', 'Cabeça · sem PN', `cada ${est === 'registros' ? 'registro' : 'documento'} é um PN desta série:
          ${esc(r.codigo)}-1, -2… — ${npn ? npn + ' até agora' : 'nenhum ainda'}`)
      : eixo('Na série', 'Arquivo único · sem PN', 'a série é só ele: sem template e sem filhos');
  const muda = reg
    ? eixo('Pode ser alterado?', 'Não · registro', 'depois de aprovado, fica como está: ele diz o que aconteceu. A Rev. dele é a do template usado')
    : tpl
      ? eixo('Pode ser alterado?', 'Sim · template', est === 'registros'
          ? 'o template revisa (Rev. A, B…); os registros que nascem dele, não'
          : 'revisa: Rev. A, B, C…')
      : eixo('Pode ser alterado?', 'Sim · documento', r.pn != null ? 'revisa: Rev. A, B… — independente dos outros PNs' : 'revisa: Rev. A, B, C…');
  return `<div class="arq-sec"><h3>${ic('pasta')} O que é este arquivo</h3>
    <div class="arq-oque">${oQue}${naSerie}${muda}</div>
    <p class="arq-frase">${est === 'avulso'
      ? `${E.rot}: a coluna de estrutura da NRO-PUB-001 veio vazia para ele.`
      : `Estrutura da série${r.pn != null ? ' ' + esc(cab?.codigo || '') : ''}, na NRO-PUB-001: <span class="q">“${E.frase}”</span>`}</p></div>`;
}

function arqPrincipalHTML(t){
  const r = t.r;
  const tplLinha = r.template_id ? arq.rol.find(x => x.id === r.template_id) : null;
  let h = arqOQueEHTML(r);
  /* de qual template nasceu */
  if (tplLinha){
    const velho = r.template_rev && tplLinha.rev_vigente && r.template_rev !== tplLinha.rev_vigente;
    h += `<div class="arq-sec"><a class="arq-nasce" href="#/arquivos/${esc(tplLinha.codigo)}">
      <span class="arq-ic template">${ic('molde')}</span>
      <span class="tx">Feito sobre o template <span class="cd">${esc(tplLinha.codigo)}</span>${r.template_rev ? ` — <b>Rev. ${esc(r.template_rev)}</b>` : ''}
        <span class="small muted" style="display:block">${esc(tplLinha.titulo)}</span>
        ${velho ? `<span class="small arq-velho" style="display:block">O template já está na Rev. ${esc(tplLinha.rev_vigente)}.
          ${r.natureza === 'registro' ? `Este registro foi feito na ${esc(r.template_rev)} e fica assim: registro não se revisa.`
            : 'Na próxima revisão, confira se este arquivo acompanha.'}</span>` : ''}</span>
      ${ic('chevron')}</a></div>`;
  }
  /* template: onde é usado. Na série com PN, o uso são os PNs dela — uma
     lista só, com a revisão do template que cada um usou; outro arquivo
     que diga ter sido feito sobre ele vem à parte. */
  if (r.natureza === 'template'){
    const subUso = u => `${u.projeto_codigo ? 'Projeto ' + esc(u.projeto_nome || u.projeto_codigo) + ' · ' : ''}${
      u.template_rev ? 'usa a Rev. ' + esc(u.template_rev) : 'revisão do template não informada'}${
      u.template_rev && r.rev_vigente && u.template_rev !== r.rev_vigente ? ` · <span class="arq-velho">anterior à ${esc(r.rev_vigente)}</span>` : ''}`;
    const tabela = lista => arqTabela(lista.map(u => arqLinha(u, { compacto:true, sub: subUso(u) })).join(''), { compacto:true });
    const outros = arq.rol.filter(x => x.template_id === r.id && x.serie_id !== r.serie_id).sort((a, b) => a.codigo.localeCompare(b.codigo));
    if (r.multiplo){
      const pns = arq.rol.filter(x => x.serie_id === r.serie_id && x.pn != null).sort((a, b) => a.pn - b.pn);
      h += `<div class="arq-sec"><h3>Onde é usado · os PNs desta série · ${pns.length}
          ${arqPossoCriar(r) && r.status !== 'obsoleto' ? `<span class="acts"><button class="btn ghost mini" onclick="arqModalNovoPN('${r.serie_id}')">${ic('plus')} Novo PN</button></span>` : ''}</h3>
        ${pns.length ? tabela(pns)
          : `<p class="muted small">Nenhum ainda. Cada ${r.tipo === 'registro' ? 'registro' : 'documento'} desta série é um PN que nasce deste template.</p>`}</div>`;
    }
    if (!r.multiplo || outros.length)
      h += `<div class="arq-sec"><h3>${r.multiplo ? 'Também feitos sobre ele' : 'Onde é usado'} · ${outros.length}</h3>
        ${outros.length ? tabela(outros) : '<p class="muted small">Nenhum arquivo diz que foi feito sobre este template ainda.</p>'}</div>`;
  }
  /* relações */
  h += `<div class="arq-sec"><h3>${ic('ramo')} Relações
      ${t.editar ? `<span class="acts"><button class="btn ghost mini" onclick="arqModalRelacao('pai')">${ic('plus')} Pai</button>
        <button class="btn ghost mini" onclick="arqModalRelacao('filho')">${ic('plus')} Filho</button></span>` : ''}</h3>
    <div class="card">${arqRelacoesHTML(t)}</div></div>`;
  /* registro de alterações */
  h += `<div class="arq-sec"><h3>${ic('relogio')} Registro de alterações</h3><div class="card">${t.ler
    ? arqLogHTML(t)
    : `<p class="muted small" style="line-height:1.6">O conteúdo e o histórico deste arquivo são de quem ${r.classe === 'confidencial'
        ? 'está num grupo de leitura ou no grupo revisor' : 'está no grupo do emissor, na equipe do projeto ou no grupo revisor'}
        (classe ${ARQ_CLASSES[r.classe][0].toLowerCase()}). Os metadados ao lado continuam à vista de toda a equipe.</p>`}</div></div>`;
  return h;
}

function arqNo(x, o = {}){
  if (!x) return '';
  const tira = o.tirar ? `<button class="x" title="Desfazer a relação" aria-label="Desfazer a relação com ${esc(x.codigo)}"
      onclick="event.preventDefault(); event.stopPropagation(); arqTirarRelacao('${o.tirar[0]}', '${o.tirar[1]}')">×</button>` : '';
  return `<${o.foco ? 'div' : 'a'} class="arq-no${o.foco ? ' foco' : ''}${x.status === 'obsoleto' ? ' obs' : ''}"
      ${o.foco ? '' : `href="#/arquivos/${esc(x.codigo)}"`} title="${esc(x.codigo)} — ${esc(x.titulo)}">
    <span class="arq-ic ${x.natureza}">${ic(ARQ_ICONE[x.natureza])}</span>
    <span class="tx"><span class="cd">${esc(x.codigo)}${x.rev_vigente ? ' · Rev. ' + esc(x.rev_vigente) : ''}</span>
      <span class="tt">${esc(x.titulo)}</span></span>${tira}</${o.foco ? 'div' : 'a'}>`;
}
function arqRelacoesHTML(t){
  const r = t.r;
  if (!t.pais.length && !t.filhos.length) return `<p class="muted small" style="line-height:1.6">Sem pai nem filho.
    Relacione quando mudar um arquivo obrigar a olhar outro — o checklist de offboarding é filho do procedimento de
    desligamento: revisar o procedimento pede conferir o checklist.</p>`;
  const tira = (pai, filho) => t.editar ? [pai, filho] : null;
  return `<div class="arq-rel">
    ${t.pais.length ? `<span class="rot">Pai${t.pais.length > 1 ? 's' : ''}</span>
      <div class="fila">${t.pais.map(p => arqNo(p, { tirar: tira(p.id, r.id) })).join('')}</div><span class="liga"></span>` : ''}
    ${arqNo(r, { foco:true })}
    ${t.filhos.length ? `<span class="liga"></span><div class="fila">${t.filhos.map(f => arqNo(f, { tirar: tira(r.id, f.id) })).join('')}</div>
      <span class="rot" style="margin:7px 0 0">Filho${t.filhos.length > 1 ? 's' : ''}</span>` : ''}
    ${t.irmaos.length ? `<div class="arq-irmaos"><span class="rot">Irmãos — filhos do mesmo pai</span>
      <div class="fila">${t.irmaos.map(x => arqNo(x)).join('')}</div></div>` : ''}
  </div>`;
}

/* O registro de alterações, na ordem em que aconteceu: o template (na
   revisão usada), a criação deste arquivo, cada versão enviada e o que
   se decidiu sobre ela, e o resto (relações, obsoleto, grupo revisor). */
const ROT_EVENTO = {
  relacionou:'Relação criada:', desrelacionou:'Relação desfeita:', obsoletou:'Tornado obsoleto:',
  reativou:'Reativado', anexou:'Arquivo anexado à revisão importada:', revisor:'Grupo revisor passou a ser',
  template:'Passou a dizer que usa o template', importou:'Registrado a partir da planilha', estrutura:'Estrutura:'
};
function arqLogHTML(t){
  const r = t.r, ev = [];
  const tr = t.tplRevs.find(v => v.rev === r.template_rev);
  if (tr) ev.push({ q: tr.revisado_em || tr.enviado_em, c:'tpl',
    tx: `Template ${esc(r.template_codigo)} Rev. ${esc(tr.rev)} — redigido por ${esc(tr.enviado_nome || '—')}${
      tr.revisor_nome ? `, revisado por ${esc(tr.revisor_nome)}` : ''}` });
  ev.push({ q: r.criado_em, c:'', tx: `${esc(r.codigo)} criado por ${esc(r.autor_nome || '—')}` });
  t.evs.forEach(e => { if (e.tipo === 'criou') return;
    ev.push({ q: e.criado_em, c: e.tipo === 'obsoletou' ? 'bad' : '',
      tx: `${ROT_EVENTO[e.tipo] || esc(e.tipo)} ${esc(e.detalhe || '')}`, ob: e.nome && e.tipo !== 'importou' ? 'por ' + esc(e.nome) : '' }); });
  t.revs.forEach(v => {
    /* "a Rev. A foi enviada", "o registro foi enviado" */
    const nome = v.rev ? 'Rev. ' + esc(v.rev) : 'Registro', a = v.rev ? 'a' : 'o';
    ev.push({ q: v.enviado_em, c:'', tx: `${nome} enviad${a} por ${esc(v.enviado_nome || '—')}`, ob: esc(v.mudancas || ''),
      confere: v.relacionados, baixar: v.caminho && v.estado !== 'pendente' ? v.id : null });
    if (['aprovada', 'substituida'].includes(v.estado))
      ev.push({ q: v.revisado_em, c:'ok', tx: `${nome} aprovad${a}${v.revisor_nome ? ' por ' + esc(v.revisor_nome) : ''}${v.importada ? ' — na planilha NRO-PUB-001' : ''}`,
        ob: esc(v.parecer || '') });
    if (v.estado === 'devolvida') ev.push({ q: v.revisado_em, c:'bad', tx: `${nome} devolvid${a} por ${esc(v.revisor_nome || '—')}`, ob: esc(v.parecer || '') });
    if (v.estado === 'cancelada') ev.push({ q: v.enviado_em, c:'', tx: `${nome} retirad${a} por quem enviou, antes da revisão` });
    if (v.estado === 'pendente')  ev.push({ q: null, c:'warn', tx: `${nome} aguarda a revisão de ${esc(arqRevisores(r))}` });
  });
  ev.sort((a, b) => (a.q == null) - (b.q == null) || String(a.q).localeCompare(String(b.q)));
  return `<div class="arq-log">${ev.map(x => `<div class="arq-ev ${x.c}">
      <div class="qd">${x.q ? fmtDT(x.q) : 'agora'}</div><div class="tx">${x.tx}</div>
      ${x.ob ? `<div class="ob">${x.ob}</div>` : ''}
      ${(x.confere || []).length ? `<div class="confere">${x.confere.map(c => `<span class="chip mini">${esc(c.codigo)} · ${
          c.decisao === 'revisado' ? 'revisado junto' : 'sem mudança'}</span>`).join('')}</div>` : ''}
      ${x.baixar ? `<button class="gr-limpa" style="margin-top:4px" onclick="arqBaixar('${x.baixar}')">baixar esta versão</button>` : ''}
    </div>`).join('')}</div>`;
}

function arqLadoHTML(t){
  const r = t.r, p = t.pend, v = t.vigente;
  const souEmissor = gruposEfetivos(arqEu()).has(arqGrupoNome(arqEmissor(r.prefixo)?.grupo_id));
  const registroFechado = r.natureza === 'registro' && !!v;
  const acao = r.natureza === 'registro' ? 'Enviar o registro'
    : (r.rev_vigente || t.revs.some(x => x.estado === 'aprovada')) ? 'Submeter nova revisão' : 'Enviar a primeira versão';
  let a = '';
  if (v && v.caminho && t.ler) a += `<button class="btn solid" onclick="arqBaixar('${v.id}')">${ic('down')} Baixar ${v.rev ? 'a Rev. ' + esc(v.rev) : 'o registro'}</button>`;
  else if (v && !v.caminho) a += `<p class="small muted" style="line-height:1.55">${v.rev ? 'A Rev. ' + esc(v.rev) : 'Esta versão'} foi aprovada na planilha
      NRO-PUB-001 e o arquivo ainda não subiu para o portal — o original está no Drive CTA.</p>
    ${docGestor() ? `<button class="btn ghost" onclick="arqModalAnexar('${v.id}')">${ic('subir')} Anexar o arquivo desta revisão</button>` : ''}`;
  if (t.editar && r.status !== 'obsoleto' && !p && !registroFechado)
    a += `<button class="btn ${v ? 'ghost' : 'solid'}" onclick="arqModalEnviar()">${ic('subir')} ${acao}</button>`;
  if (registroFechado) a += `<p class="small muted" style="line-height:1.55">Registro aprovado não se revisa: ele diz o que aconteceu.</p>`;
  if (!t.editar && r.status !== 'obsoleto' && !p) a += `<p class="small muted" style="line-height:1.55">Quem envia versões deste arquivo é
    ${r.projeto_id ? 'a equipe do projeto, ' : ''}o grupo do emissor${arqEmissor(r.prefixo)?.grupo_id ? ` (${esc(arqGrupoNome(arqEmissor(r.prefixo).grupo_id) || '—')})` : ''} e quem o criou.</p>`;

  const pendHTML = p ? `<div class="arq-pendente">
      <h4>${p.rev ? 'Rev. ' + esc(p.rev) : 'O registro'} aguarda revisão</h4>
      <p>${p.rev ? 'Enviada' : 'Enviado'} por ${esc(p.enviado_nome || '—')} em ${fmtDT(p.enviado_em)}. Revisa: <b>${esc(arqRevisores(r))}</b>.
        Até ${p.rev ? 'ser aprovada, ela' : 'ser aprovado, ele'} não está disponível para a equipe.</p>
      ${p.mudancas ? `<p style="margin-top:6px"><b style="color:var(--ink)">O que mudou:</b> ${esc(p.mudancas)}</p>` : ''}
      <div class="arq-acoes" style="margin-top:12px">
        ${t.podeRevisar ? `${p.caminho ? `<button class="btn ghost" onclick="arqBaixar('${p.id}')">${ic('down')} Baixar para revisar</button>` : ''}
          <button class="btn solid" onclick="arqModalDecidir('aprovar')">${ic('check')} Aprovar</button>
          <button class="btn ghost" onclick="arqModalDecidir('devolver')">Devolver com parecer</button>` : ''}
        ${(p.enviado_por === state.perfil?.registro || docGestor()) ? `<button class="btn ghost" onclick="arqCancelarEnvio()">Retirar o envio</button>` : ''}
      </div></div>` : '';

  const pj = arqProjeto(r.projeto_id);
  const tplLinha = r.template_id ? arq.rol.find(x => x.id === r.template_id) : null;
  const it = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;
  const meta = `<dl class="arq-meta">
    ${it('Código', `<span style="font-family:var(--fm)">${esc(r.codigo)}</span>${r.pn != null ? ` <span class="dim">· PN ${r.pn}</span>` : ''}`)}
    ${it('Natureza', `${esc(arqNatureza(r))} · ${esc(ARQ_SUBTIPOS[r.subtipo] || r.subtipo)}`)}
    ${it('Classe', `${ARQ_CLASSES[r.classe][0]} <span class="dim">— ${ARQ_CLASSES[r.classe][1]}</span>`)}
    ${it('Emissor', `<a href="#/arquivos/${esc(r.prefixo)}">${esc(arqEmissor(r.prefixo)?.nome || r.prefixo)}</a>`)}
    ${pj ? it('Projeto', `<a href="#/projetos/${esc(pj.codigo)}">${esc(pj.nome)}</a>`) : ''}
    ${it('Autor deste arquivo', `${esc(r.autor_nome || '—')} <span class="dim">· criou em ${fmtD(r.criado_em)}</span>`)}
    ${r.natureza === 'registro'
      ? it('Revisão', r.template_rev ? `Rev. ${esc(r.template_rev)} <span class="dim">do template</span>` : '—')
      : it('Revisão em vigor', r.rev_vigente ? `Rev. ${esc(r.rev_vigente)}${v?.revisado_em ? ` <span class="dim">· aprovada em ${fmtD(v.revisado_em)}</span>` : ''}` : '<span class="dim">nenhuma ainda</span>')}
    ${v ? it('Revisado por', `${esc(v.revisor_nome || '—')}`) : ''}
    ${it('Grupo revisor', `${esc(arqRevisores(r))}${r.grupo_revisor ? '' : ' <span class="dim">— a série não tem grupo próprio</span>'}`)}
    ${tplLinha ? it('Template', `<a href="#/arquivos/${esc(tplLinha.codigo)}">${esc(tplLinha.codigo)}</a>${r.template_rev ? ` <span class="dim">· Rev. ${esc(r.template_rev)}</span>` : ''}`) : ''}
    ${it('Última alteração', `${fmtD(r.alterado_em)} <span class="dim">· ${esc(r.alterado_nome || '—')}</span>`)}
  </dl>`;

  const gestao = [];
  if (t.editar) gestao.push(`<button class="btn ghost mini" onclick="arqModalEditar()">${ic('pencil')} Título e template</button>`);
  if (r.status !== 'obsoleto' && (docGestor() || souEmissor))
    gestao.push(`<button class="btn ghost mini" onclick="arqModalObsoleto()">Tornar obsoleto</button>`);
  if (r.status === 'obsoleto' && docGestor())
    gestao.push(`<button class="btn ghost mini" onclick="arqReativar()">Reativar</button>`);
  if (docGestor())
    gestao.push(`<a class="btn ghost mini" href="#/arquivos/config/serie-${esc(arq.rol.find(x => x.serie_id === r.serie_id && x.pn == null)?.codigo || '')}">${ic('engrenagem')} Configurar a série</a>`);

  return `${pendHTML}
    ${a ? `<div class="card"><div class="arq-acoes">${a}</div></div>` : ''}
    <div class="card">${meta}</div>
    ${gestao.length ? `<div class="card"><div class="acts" style="margin:0;flex-wrap:wrap;gap:8px">${gestao.join('')}</div></div>` : ''}`;
}

/* ---------------- baixar ---------------- */
/* O nome que o arquivo ganha ao baixar segue o NRO-PUB-002:
   "NRO-XXX-000 TITULO DOCUMENTO REV. B". */
function arqNomeBaixado(r, v){
  const ext = String(v.nome_original || v.caminho || '').includes('.') ? '.' + String(v.nome_original || v.caminho).split('.').pop() : '';
  return `${r.codigo} ${String(r.titulo).replace(/[\\/:*?"<>|]+/g, '-')}${v.rev ? ' REV. ' + v.rev : ''}${ext}`;
}
async function arqBaixar(id){
  const t = arq.tela, v = t?.revs.find(x => x.id === id);
  if (!v?.caminho) return toast('Esta versão não tem arquivo no portal.', true);
  try{
    const { data, error } = await sb.storage.from('arquivos').createSignedUrl(v.caminho, 120, { download: arqNomeBaixado(t.r, v) });
    if (error) throw error;
    const a = document.createElement('a'); a.href = data.signedUrl; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
  }catch(e){
    toast(/not found|row-level|permission|policy/i.test(e?.message || '')
      ? 'Você não tem acesso a esta versão.' : 'Não foi possível baixar: ' + (e?.message || 'erro'), true);
  }
}

/* ---------------- enviar uma versão ---------------- */
const arqProximaRev = r => { const v = String(r || '').toUpperCase(); if (!v) return 'A';
  for (let i = v.length - 1; i >= 0; i--) if (v[i] !== 'Z')
    return v.slice(0, i) + String.fromCharCode(v.charCodeAt(i) + 1) + 'A'.repeat(v.length - 1 - i);
  return 'A'.repeat(v.length + 1); };

function arqModalEnviar(){
  const t = arq.tela, r = t.r;
  const registro = r.natureza === 'registro';
  const primeira = !registro && !r.rev_vigente;
  const rev = registro ? null : arqProximaRev(r.rev_vigente);
  const rels = [...t.pais.map(x => ({ x, lado:'pai' })), ...t.filhos.map(x => ({ x, lado:'filho' }))]
    .filter(({ x }) => x.status !== 'obsoleto');
  const tpl = r.template_id ? arq.rol.find(x => x.id === r.template_id) : null;
  arq.envio = { arquivo:null, decisoes:{}, rels };
  const titulo = registro ? `Enviar o registro ${r.codigo}` : primeira ? `Enviar a primeira versão de ${r.codigo}` : `Submeter a Rev. ${rev} de ${r.codigo}`;
  abreModal(`<h3>${esc(titulo)}</h3>
    <p class="sub" style="margin-bottom:14px">${registro ? 'O registro' : `A Rev. ${rev}`} fica <b>pendente</b> até alguém de
      <b>${esc(arqRevisores(r))}</b> — que não seja você — aprovar. Eles recebem o aviso no sino e por e-mail.
      ${registro ? 'Aprovado, o registro não se revisa mais.' : primeira ? '' : `Até lá, a Rev. ${esc(r.rev_vigente)} continua valendo.`}</p>
    <input type="file" id="ae-arq" hidden onchange="arqEscolheu(this.files[0])">
    <div class="arq-arrasta" id="ae-zona" tabindex="0" role="button" onclick="document.getElementById('ae-arq').click()"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}"
      ondragover="event.preventDefault();this.classList.add('sobre')" ondragleave="this.classList.remove('sobre')"
      ondrop="event.preventDefault();this.classList.remove('sobre');arqEscolheu(event.dataTransfer.files[0])">
      <b>Escolha o arquivo</b> ou solte aqui<br><span class="small">.docx, .xlsx, .pdf, .pptx… até 50 MB</span></div>
    ${registro ? '' : `<div class="fld" style="margin-top:14px"><label for="ae-mud">O que mudou${primeira ? ' (opcional na primeira versão)' : ''}</label>
      <textarea id="ae-mud" rows="3" placeholder="${primeira ? 'Versão inicial.' : 'Inclui a devolução de crachá na etapa 4.'}"></textarea></div>`}
    ${tpl ? `<div class="fld"><label for="ae-tpl">Feito sobre o template ${esc(tpl.codigo)}</label>
      <select id="ae-tpl">${(t.tplRevs.length ? t.tplRevs.map(v => v.rev) : [tpl.rev_vigente].filter(Boolean))
        .map(x => `<option ${x === tpl.rev_vigente ? 'selected' : ''}>${esc(x)}</option>`).join('') || '<option value="">—</option>'}</select></div>` : ''}
    ${rels.length ? `<div class="adm-grupo">Os relacionados</div>
      <p class="small muted" style="margin:-4px 0 10px;line-height:1.55">Mudar ${esc(r.codigo)} pode obrigar a mudar estes.
        Para cada um, diga o que você fez — é isto que fica no registro de alterações.</p>
      <div class="arq-conf" id="ae-conf">${arqConfHTML()}</div>` : ''}
    <div class="acts" style="justify-content:flex-end;margin-top:16px">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="ae-btn" onclick="arqEnviar()">${ic('subir')} Enviar para revisão</button></div>`, 'largo', true);
}
function arqConfHTML(){
  const e = arq.envio;
  return e.rels.map(({ x, lado }) => {
    const d = e.decisoes[x.id];
    const pend = arqPendente(x.id);
    return `<div class="arq-conf-l${e.faltou && !d ? ' falta' : ''}">
      <span class="tx"><span class="cd">${esc(x.codigo)}</span> <span class="small muted">· ${lado}</span>
        <span class="tt">${esc(x.titulo)} — ${x.rev_vigente ? 'Rev. ' + esc(x.rev_vigente) : 'sem revisão em vigor'}${pend ? `, ${pend.rev ? 'Rev. ' + esc(pend.rev) : 'versão'} em revisão` : ''}</span></span>
      <div class="seg" role="group" aria-label="O que você fez com ${esc(x.codigo)}">
        <button type="button" class="${d === 'revisado' ? 'on' : ''}" aria-pressed="${d === 'revisado'}" onclick="arqDecide('${x.id}','revisado')">Revisei junto</button>
        <button type="button" class="${d === 'sem_mudanca' ? 'on' : ''}" aria-pressed="${d === 'sem_mudanca'}" onclick="arqDecide('${x.id}','sem_mudanca')">Não precisa mudar</button>
      </div></div>`;
  }).join('');
}
function arqDecide(id, d){ arq.envio.decisoes[id] = d; const c = $('#ae-conf'); if (c) c.innerHTML = arqConfHTML(); }
function arqEscolheu(f){
  if (!f) return;
  if (f.size > 50 * 1024 * 1024) return toast('O arquivo passa de 50 MB, o limite do portal.', true);
  arq.envio.arquivo = f;
  const z = $('#ae-zona');
  if (z){ z.classList.add('tem'); z.innerHTML = `<b>${esc(f.name)}</b><br><span class="small">${(f.size / 1024).toLocaleString('pt-BR', { maximumFractionDigits:0 })} KB · clique para trocar</span>`; }
}
/* O nome guardado no Storage: sem acento e sem caractere que atrapalhe
   um caminho. O nome original, com acento, fica na revisão. */
const arqNomeSeguro = n => String(n || 'arquivo').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || 'arquivo';
const MOTIVO_ENVIO = {
  ja_pendente: 'Já há uma versão aguardando revisão. Espere a decisão (ou retire o envio) antes de mandar outra.',
  registro_fechado: 'Registro aprovado não se revisa.',
  obsoleto: 'O arquivo está obsoleto.',
  arquivo_nao_enviado: 'O arquivo não chegou ao Storage. Tente de novo.',
  sem_registro: MOTIVO_RPC.sem_registro,
  sem_permissao: 'Você não envia versões deste arquivo.'
};
async function arqSubir(r, f){
  const caminho = `${r.id}/${crypto.randomUUID()}/${arqNomeSeguro(f.name)}`;
  const { error } = await sb.storage.from('arquivos').upload(caminho, f,
    { contentType: f.type || 'application/octet-stream', upsert:false });
  if (error){
    const m = error.message || '';
    throw new Error(/bucket not found/i.test(m) ? 'o bucket "arquivos" não existe — falta aplicar a migração v20'
      : /row-level|policy|unauthorized|403/i.test(m) ? 'você não envia arquivos para este código'
      : /too large|exceeded|413/i.test(m) ? 'o arquivo passa do limite do Storage' : m);
  }
  return caminho;
}
async function arqEnviar(){
  const t = arq.tela, r = t.r, e = arq.envio;
  const mud = $('#ae-mud')?.value.trim() || '';
  if (!e.arquivo) return toast('Escolha o arquivo.', true);
  if (r.natureza !== 'registro' && r.rev_vigente && !mud) return toast('Diga o que mudou nesta revisão.', true);
  const faltam = e.rels.filter(({ x }) => !e.decisoes[x.id]);
  if (faltam.length){ e.faltou = true; $('#ae-conf').innerHTML = arqConfHTML();
    return toast(`Falta dizer o que fez com ${faltam.map(({ x }) => x.codigo).join(', ')}.`, true); }
  const b = $('#ae-btn'); if (b){ b.disabled = true; b.textContent = 'Enviando…'; }
  let caminho = null;
  try{
    caminho = await arqSubir(r, e.arquivo);
    const { data, error } = await sb.rpc('doc_revisao_enviar', { p: {
      arquivo_id: r.id, caminho, nome_original: e.arquivo.name, mime: e.arquivo.type || null, tamanho: e.arquivo.size,
      mudancas: mud || null, template_rev: $('#ae-tpl')?.value || null,
      relacionados: e.rels.map(({ x }) => ({ arquivo_id: x.id, decisao: e.decisoes[x.id] })) } });
    if (error) throw error;
    if (data?.status !== 'ok'){
      await sb.storage.from('arquivos').remove([caminho]).catch(() => {});
      if (data?.status === 'conferir_relacionados')
        return toast('Confira também: ' + (data.faltam || []).join(', ') + '.', true);
      if (data?.status === 'invalido' && data.campo === 'mudancas') return toast('Diga o que mudou nesta revisão.', true);
      return toast(MOTIVO_ENVIO[data?.status] || motivoRPC(data, null, 'Não foi possível enviar'), true);
    }
    fechaModal();
    toast(`${data.rev ? 'Rev. ' + data.rev : 'Registro'} enviado. ${arqRevisores(r)} recebeu o aviso para revisar.`);
    await arqCarregar(true);
    arqTela(r.codigo);
  }catch(err){
    if (caminho) sb.storage.from('arquivos').remove([caminho]).catch(() => {});
    falha(err, 'Erro ao enviar');
  }finally{ const x = $('#ae-btn'); if (x){ x.disabled = false; x.innerHTML = `${ic('subir')} Enviar para revisão`; } }
}

/* ---------------- revisar ---------------- */
function arqModalDecidir(dec){
  const t = arq.tela, p = t.pend;
  abreModal(`<h3>${dec === 'aprovar' ? 'Aprovar' : 'Devolver'} ${p.rev ? 'a Rev. ' + esc(p.rev) : 'o registro'} de ${esc(t.r.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">${dec === 'aprovar'
      ? `Aprovada, ${p.rev ? `a Rev. ${esc(p.rev)} passa a valer${t.r.rev_vigente ? ` no lugar da ${esc(t.r.rev_vigente)}` : ''}` : 'o registro fica disponível e fechado'},
         e ${esc(p.enviado_nome || 'quem enviou')} é avisado.`
      : `A versão volta para ${esc(p.enviado_nome || 'quem enviou')}, com o seu parecer. ${t.r.rev_vigente ? `A Rev. ${esc(t.r.rev_vigente)} continua valendo.` : ''}`}</p>
    <div class="fld"><label for="ad-par">Parecer${dec === 'aprovar' ? ' (opcional)' : ''}</label>
      <textarea id="ad-par" rows="4" placeholder="${dec === 'aprovar' ? 'Conferido com o procedimento de admissão.' : 'O que precisa mudar, e onde.'}"></textarea></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn ${dec === 'aprovar' ? 'solid' : 'perigo'}" id="ad-btn" onclick="arqDecidir('${dec}')">${dec === 'aprovar' ? 'Aprovar' : 'Devolver'}</button></div>`);
}
async function arqDecidir(dec){
  const t = arq.tela, par = $('#ad-par').value.trim();
  if (dec === 'devolver' && !par) return toast('Devolver pede um parecer — é o que a pessoa vai ler.', true);
  const b = $('#ad-btn'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('doc_revisao_decidir', { p: { revisao_id: t.pend.id, decisao: dec, parecer: par || null } });
    if (error) throw error;
    if (data?.status === 'mesma_pessoa') return toast('Quem enviou não revisa a própria versão.', true);
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível registrar a revisão'), true);
    fechaModal();
    toast(dec === 'aprovar' ? 'Aprovada. A versão já está em vigor.' : 'Devolvida, com o seu parecer.');
    await arqCarregar(true); arqTela(t.r.codigo);
  }catch(e){ falha(e, 'Erro ao revisar'); }
  finally{ const x = $('#ad-btn'); if (x) x.disabled = false; }
}
async function arqCancelarEnvio(){
  const t = arq.tela;
  if (!await confirma(`Retirar ${t.pend.rev ? 'a Rev. ' + esc(t.pend.rev) : 'o envio'} de ${esc(t.r.codigo)}? Ninguém mais precisa revisá-la.`, 'Retirar')) return;
  const { data, error } = await sb.rpc('doc_revisao_cancelar', { p: { revisao_id: t.pend.id } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível retirar'), true);
  toast('Envio retirado.'); await arqCarregar(true); arqTela(t.r.codigo);
}

/* ---------------- obsoleto, anexar, editar ---------------- */
function arqModalObsoleto(){
  const r = arq.tela.r;
  abreModal(`<h3>Tornar ${esc(r.codigo)} obsoleto</h3>
    <p class="sub" style="margin-bottom:14px">Sai de vigor e para de aceitar versões. O histórico fica, e o gestor pode reativar.</p>
    <div class="fld"><label for="ao-mot">Motivo</label>
      <textarea id="ao-mot" rows="3" placeholder="Incorporado ao procedimento NRO-PES-007 Rev. C."></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn perigo" onclick="arqObsoletar()">Tornar obsoleto</button></div>`);
}
async function arqObsoletar(){
  const r = arq.tela.r, motivo = $('#ao-mot').value.trim();
  if (!motivo) return toast('Diga o motivo.', true);
  const { data, error } = await sb.rpc('doc_arquivo_obsoletar', { p: { arquivo_id: r.id, motivo } });
  if (error || data?.status !== 'ok') return toast(data?.status === 'ja_pendente'
    ? 'Há uma versão aguardando revisão: decida sobre ela antes.' : motivoRPC(data, error, 'Não foi possível'), true);
  fechaModal(); toast(`${r.codigo} está obsoleto.`); await arqCarregar(true); arqTela(r.codigo);
}
async function arqReativar(){
  const r = arq.tela.r;
  if (!await confirma(`Reativar ${esc(r.codigo)}?`, 'Reativar')) return;
  const { data, error } = await sb.rpc('doc_arquivo_obsoletar', { p: { arquivo_id: r.id, reativar: true } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível reativar'), true);
  toast('Reativado.'); await arqCarregar(true); arqTela(r.codigo);
}
function arqModalAnexar(revId){
  const t = arq.tela, v = t.revs.find(x => x.id === revId);
  arq.envio = { arquivo:null, decisoes:{}, rels:[] };
  abreModal(`<h3>Anexar o arquivo da ${v.rev ? 'Rev. ' + esc(v.rev) : 'versão'} de ${esc(t.r.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">A aprovação já aconteceu, na planilha NRO-PUB-001. Aqui o arquivo só
      ganha o seu lugar no portal — não é uma revisão nova, e ninguém precisa aprovar de novo.</p>
    <input type="file" id="ae-arq" hidden onchange="arqEscolheu(this.files[0])">
    <div class="arq-arrasta" id="ae-zona" tabindex="0" role="button" onclick="document.getElementById('ae-arq').click()"
      ondragover="event.preventDefault();this.classList.add('sobre')" ondragleave="this.classList.remove('sobre')"
      ondrop="event.preventDefault();this.classList.remove('sobre');arqEscolheu(event.dataTransfer.files[0])">
      <b>Escolha o arquivo</b> ou solte aqui</div>
    <div class="acts" style="justify-content:flex-end;margin-top:14px"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="ae-btn" onclick="arqAnexar('${revId}')">Anexar</button></div>`, 'largo', true);
}
async function arqAnexar(revId){
  const t = arq.tela, f = arq.envio.arquivo;
  if (!f) return toast('Escolha o arquivo.', true);
  const b = $('#ae-btn'); if (b){ b.disabled = true; b.textContent = 'Anexando…'; }
  let caminho = null;
  try{
    caminho = await arqSubir(t.r, f);
    const { data, error } = await sb.rpc('doc_revisao_anexar', { p: { revisao_id: revId, caminho,
      nome_original: f.name, mime: f.type || null, tamanho: f.size } });
    if (error) throw error;
    if (data?.status !== 'ok'){ sb.storage.from('arquivos').remove([caminho]).catch(() => {});
      return toast(data?.status === 'ja_tem_arquivo' ? 'Esta revisão já tem arquivo.' : motivoRPC(data, null, 'Não foi possível anexar'), true); }
    fechaModal(); toast('Arquivo anexado.'); await arqCarregar(true); arqTela(t.r.codigo);
  }catch(e){ if (caminho) sb.storage.from('arquivos').remove([caminho]).catch(() => {}); falha(e, 'Erro ao anexar'); }
  finally{ const x = $('#ae-btn'); if (x){ x.disabled = false; x.textContent = 'Anexar'; } }
}
function arqModalEditar(){
  const r = arq.tela.r;
  const tpls = arq.rol.filter(x => x.natureza === 'template' && x.id !== r.id).sort((a, b) => a.codigo.localeCompare(b.codigo));
  abreModal(`<h3>${esc(r.codigo)}</h3>
    <div class="form-grid">
      ${r.pn != null ? `<div class="fld full"><label for="aed-tit">Complemento do título</label>
        <input id="aed-tit" value="${esc(r.complemento || '')}" placeholder="${esc(r.projeto_nome || 'bancada 2')}">
        <span class="mailer-sub tight">Aparece depois do título da série: ${esc(r.serie_titulo)} — …</span></div>` : ''}
      <div class="fld full"><label for="aed-tpl">Feito sobre o template</label>
        <select id="aed-tpl"><option value="">— nenhum —</option>${tpls.map(x =>
          `<option value="${x.id}" ${x.id === r.template_id ? 'selected' : ''}>${esc(x.codigo)} — ${esc(x.titulo)}</option>`).join('')}</select></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="arqSalvarEdicao()">Salvar</button></div>`);
}
async function arqSalvarEdicao(){
  const r = arq.tela.r, p = { id: r.id };
  const tit = $('#aed-tit'); if (tit) p.titulo = tit.value.trim();
  const tpl = $('#aed-tpl').value || null; if (tpl !== (r.template_id || null)) p.template_id = tpl;
  const { data, error } = await sb.rpc('doc_arquivo_editar', { p });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível salvar'), true);
  fechaModal(); toast('Salvo.'); await arqCarregar(true); arqTela(r.codigo);
}

/* ---------------- relações ---------------- */
function arqModalRelacao(lado){
  arq.relLado = lado; arq.relBusca = '';
  const r = arq.tela.r;
  abreModal(`<h3>${lado === 'pai' ? 'Um pai' : 'Um filho'} para ${esc(r.codigo)}</h3>
    <p class="sub" style="margin-bottom:12px">${lado === 'pai'
      ? `Quando o pai mudar, quem revisá-lo vai precisar conferir ${esc(r.codigo)}.`
      : `Quando ${esc(r.codigo)} mudar, quem revisá-lo vai precisar conferir o filho.`}</p>
    <input id="ar-q" type="search" placeholder="Código ou título" oninput="arq.relBusca=this.value;arqListaRelacao()"
      style="width:100%;margin-bottom:10px">
    <div class="gr-cands" id="ar-lista" style="max-height:320px"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'largo');
  arqListaRelacao(); $('#ar-q').focus();
}
function arqListaRelacao(){
  const t = arq.tela, r = t.r, q = norm(arq.relBusca);
  const ja = new Set([r.id, ...t.pais.map(x => x.id), ...t.filhos.map(x => x.id)]);
  const lista = arq.rol.filter(x => !ja.has(x.id) && x.status !== 'obsoleto'
    && (!q || norm(x.codigo).includes(q) || norm(x.titulo).includes(q))).slice(0, 40);
  $('#ar-lista').innerHTML = lista.map(x => `<button class="gr-cand" style="width:100%;text-align:left" onclick="arqRelacionar('${x.id}')">
      <span class="arq-ic ${x.natureza}">${ic(ARQ_ICONE[x.natureza])}</span>
      <span class="tx"><span class="nm" style="font-family:var(--fm);font-size:12px">${esc(x.codigo)}</span><span class="cg">${esc(x.titulo)}</span></span></button>`).join('')
    || '<p class="muted small" style="padding:10px 0">Nada com essa busca.</p>';
}
async function arqRelacionar(outro){
  const r = arq.tela.r;
  const p = arq.relLado === 'pai' ? { pai_id: outro, filho_id: r.id } : { pai_id: r.id, filho_id: outro };
  const { data, error } = await sb.rpc('doc_relacao_salvar', { p });
  if (error) return falha(error, 'Erro ao relacionar');
  if (data?.status === 'ciclo') return toast('Essa relação fecharia um círculo: um já está acima do outro.', true);
  if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível relacionar'), true);
  fechaModal(); toast('Relação criada.'); arqTela(r.codigo);
}
async function arqTirarRelacao(pai, filho){
  if (!await confirma('Desfazer esta relação? A conferência ao revisar deixa de valer entre os dois.', 'Desfazer')) return;
  const { data, error } = await sb.rpc('doc_relacao_salvar', { p: { pai_id: pai, filho_id: filho, remover: true } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível desfazer'), true);
  toast('Relação desfeita.'); arqTela(arq.tela.r.codigo);
}

/* ---------------- adicionar ----------------
   "Adicionar um arquivo" pode ser coisas bem diferentes, e a tela
   pergunta qual antes de criar: um arquivo real numa série que já
   existe (um PN, que nasce do template da série) ou uma série nova —
   um documento único, ou um template com os PNs que vão nascer dele.
   Revisão nova de um arquivo que já existe não é adicionar: é "Enviar
   revisão", na tela dele.
   Quem pode criar PN: a mesma regra de doc_pode_criar() no banco. */
function arqPossoCriar(r){
  if (docGestor()) return true;
  const meus = gruposEfetivos(arqEu());
  const tem = id => id != null && meus.has(arqGrupoNome(id));
  if (r.classe === 'confidencial') return (r.grupos_leitura || []).some(tem) || tem(r.grupo_revisor);
  return tem(arqEmissor(r.prefixo)?.grupo_id);
}
const arqTemplatesDe = pref => arq.rol.filter(r => r.pn == null && r.multiplo && r.status !== 'obsoleto'
  && (!pref || r.prefixo === pref) && arqPossoCriar(r)).sort((a, b) => a.codigo.localeCompare(b.codigo));
const arqPossoAdicionar = pref => docGestor() || arqTemplatesDe(pref).length > 0;

function arqModalAdicionar(pref){
  const tpls = arqTemplatesDe(pref);
  const op = (ic_, cls, titulo, texto, corpo) => `<div class="arq-add-op">
      <div class="cab"><span class="arq-ic ${cls}">${ic(ic_)}</span><div><b>${titulo}</b><span>${texto}</span></div></div>${corpo}</div>`;
  abreModal(`<h3>Adicionar ${pref ? 'ao NRO-' + esc(pref) : 'ao rol'}</h3>
    <p class="sub" style="margin-bottom:14px">O que você vai pôr no rol? Cada caminho cria uma coisa diferente.</p>
    <div class="arq-add">
      ${op('doc', 'documento', 'Um arquivo real, integrante de uma série',
        'Um PN novo — uma ata, um relatório de teste, o termo de abertura de um projeto. Nasce do template da série: escolha qual.',
        tpls.length ? `<div class="fld" style="margin:0"><label for="aa-tpl">Série</label><select id="aa-tpl">${tpls.map(r =>
            `<option value="${r.serie_id}">${esc(r.codigo)} — ${esc(r.titulo)} (${r.tipo === 'registro' ? 'cada PN é um registro' : 'cada PN é um documento'})</option>`).join('')}</select></div>
          <div class="acts" style="justify-content:flex-end;margin:10px 0 0">
            <button class="btn solid mini" onclick="arqModalNovoPN(document.getElementById('aa-tpl').value)">Continuar</button></div>`
        : `<p class="muted small" style="margin:0">Nenhuma série com PN em que você possa criar${pref ? ' neste emissor' : ''}.</p>`)}
      ${docGestor() ? op('molde', 'template', 'Uma série nova',
        'Uma espécie de arquivo que o rol ainda não tem. Nasce a cabeça da série, sem PN: o próprio documento, ou o template de onde os PNs vão nascer.',
        `<div class="acts" style="margin:10px 0 0;flex-wrap:wrap;gap:8px">${['unico', 'documentos', 'registros'].map(k =>
          `<button class="btn ghost mini" onclick="arqModalSerie(null, '${pref || ''}', '${k}')" title="${esc(ARQ_ESTRUTURAS[k].frase)}">${ARQ_ESTRUTURAS[k].rot}</button>`).join('')}</div>`)
        : '<p class="small muted" style="margin:0">Série nova — documento único ou template — quem cria é o PMO.</p>'}
      <p class="small muted" style="margin:0;line-height:1.6">Uma revisão nova de um arquivo que já existe não se adiciona aqui:
        abra o arquivo e use <b style="color:var(--ink)">Submeter nova revisão</b>. Ele continua com o mesmo código, e ganha a letra seguinte.</p>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button></div>`, 'largo');
}

/* ---------------- PN novo ---------------- */
function arqModalNovoPN(serieId, projetoId){
  const cab = arq.rol.find(x => x.serie_id === serieId && x.pn == null);
  if (!cab) return;
  const projs = (state.projetos || []).filter(p => p.status !== 'encerrado');
  const reg = cab.tipo === 'registro';
  const prox = Math.max(0, ...arq.rol.filter(x => x.serie_id === serieId && x.pn != null).map(x => x.pn)) + 1;
  abreModal(`<h3>Novo PN de ${esc(cab.codigo)}</h3>
    <div class="arq-nasce-pn"><span class="arq-ic ${reg ? 'registro' : 'documento'}">${ic(reg ? 'registro' : 'doc')}</span>
      <div>Vai nascer <b>${esc(cab.codigo)}-${prox}</b>: ${reg ? 'um <strong>registro</strong>' : 'um <strong>documento</strong>'},
        arquivo real, integrante da série ${esc(cab.titulo)}.
        <span class="dt">Nasce em rascunho, do template ${esc(cab.codigo)}${cab.rev_vigente ? ' Rev. ' + esc(cab.rev_vigente) : ''}, e você é o autor.
          ${reg ? 'Depois de aprovado, registro não se altera — o que mudar vira outro registro.'
                : 'Documento revisa: Rev. A, B… — este PN por conta própria.'}</span></div></div>
    <div class="form-grid">
      <div class="fld full"><label for="apn-tit">Complemento do título (opcional)</label>
        <input id="apn-tit" placeholder="bancada 2, reunião geral de setembro…"></div>
      <div class="fld full"><label for="apn-pj">Projeto</label>
        <select id="apn-pj" ${projetoId ? 'disabled' : ''}><option value="">— nenhum —</option>${projs.map(p =>
          `<option value="${p.id}" ${p.id === projetoId ? 'selected' : ''}>${esc(p.nome)} (${esc(p.codigo)})</option>`).join('')}</select></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="apn-btn" onclick="arqCriarPN('${serieId}')">Criar o PN</button></div>`);
}
async function arqCriarPN(serieId, projetoId, titulo){
  const p = { serie_id: serieId, projeto_id: projetoId ?? ($('#apn-pj')?.value || null), titulo: titulo ?? ($('#apn-tit')?.value.trim() || null) };
  const { data, error } = await sb.rpc('doc_arquivo_criar', { p });
  if (error) return falha(error, 'Erro ao criar');
  if (data?.status === 'ja_existe'){ fechaModal(); toast(`Este projeto já tem o seu: ${data.codigo}.`); location.hash = '#/arquivos/' + data.codigo; return; }
  if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível criar'), true);
  fechaModal(); toast(`${data.codigo} criado. Agora envie a primeira versão.`);
  await arqCarregar(true);
  location.hash = '#/arquivos/' + data.codigo;
}

/* ============================================================
   O ROL DE UM PROJETO
   O padrão de projeto aplicado a ele: cada série do padrão vira uma
   linha — o PN do projeto, se existe, ou uma linha "a criar". As
   séries de "vários" listam todos os PNs do projeto. PN do projeto
   fora do padrão aparece no fim, em "outros".
   ============================================================ */
async function arqRolDoProjeto(pj, podeCriar){
  await arqCarregar(true);
  if (arq.erro) return { html: `<div class="aviso-box err">O controle de arquivos ainda não está no banco (falta a migração
      <code>db/v20_projetos_arquivos.sql</code>).</div>`, resumo: null };
  const doProjeto = arq.rol.filter(r => r.projeto_id === pj.id);
  const noPadrao = new Set();
  let corpo = '', resumo = { ativos:0, revisao:0, rascunho:0, criar:0 };
  arq.padrao.forEach(pd => {
    const cab = arq.rol.find(r => r.serie_id === pd.serie_id && r.pn == null); if (!cab) return;
    noPadrao.add(pd.serie_id);
    const pns = doProjeto.filter(r => r.serie_id === pd.serie_id).sort((a, b) => a.pn - b.pn);
    pns.forEach(r => { corpo += arqLinha(r, { sub: `${esc(arqComoE(r))} · ${esc(ARQ_SUBTIPOS[r.subtipo])}${pd.quantidade === 'varios' ? ' · um de vários' : ''}` });
      resumo[r.status === 'ativo' ? 'ativos' : arqPendente(r.id) || r.status === 'em_revisao' ? 'revisao' : 'rascunho']++; });
    if (!pns.length || pd.quantidade === 'varios'){
      if (!pns.length) resumo.criar++;
      corpo += `<tr class="previsto"><td><div class="cel-cod"><span class="arq-ic ${cab.tipo === 'registro' ? 'registro' : 'documento'}">${ic(cab.tipo === 'registro' ? 'registro' : 'doc')}</span>
          <span class="cod">${esc(cab.codigo)}-·</span></div></td>
        <td><span class="tit">${esc(cab.titulo)}</span><span class="sub">${pns.length ? 'mais um' : 'a criar'} · ${cab.tipo === 'registro' ? 'um registro' : 'um documento'} do template ${esc(cab.codigo)}${cab.rev_vigente ? ' Rev. ' + esc(cab.rev_vigente) : ''}</span></td>
        <td class="arq-rev">—</td><td>—</td>
        <td>${podeCriar ? `<button class="btn ghost mini" onclick="arqCriarPN('${pd.serie_id}', '${pj.id}', null)">${ic('plus')} Criar</button>`
          : '<span class="muted small">a criar</span>'}</td></tr>`;
    }
  });
  const outros = doProjeto.filter(r => !noPadrao.has(r.serie_id));
  if (outros.length) corpo += `<tr><td colspan="5" class="adm-grupo" style="padding:14px 12px 6px;border-bottom:none">Fora do padrão</td></tr>`
    + outros.map(r => arqLinha(r)).join('');
  return { html: arqTabela(corpo, { vazio: 'O padrão de projeto está vazio. O PMO define as séries que todo projeto tem em Arquivos › Configurações.' }), resumo };
}

/* ============================================================
   CONFIGURAÇÕES (gestor da documentação)
   ============================================================ */
const ABAS_CFG = [['series', 'Séries'], ['emissores', 'Emissores'], ['padrao', 'Padrão de projeto'], ['chaves', 'PMO e projetos']];
async function arqConfig(aba){
  let serieAbrir = null;
  if (aba && /^serie-/.test(aba)){ serieAbrir = aba.slice(6).toUpperCase(); aba = 'series'; }
  aba = ABAS_CFG.some(([k]) => k === aba) ? aba : 'series';
  const s = await sb.from('doc_series').select('*').order('prefixo').order('sn');
  arq.series = s.data || [];
  $('#main').innerHTML = arqTopo('Arquivos', 'Configurações',
    'Quem revisa e quem lê cada série, os emissores e o padrão de projeto. Mudar aqui vale para todos os arquivos da série — e o padrão, para o rol de todos os projetos.')
    + arqNavHTML('config')
    + `<nav class="abas">${ABAS_CFG.map(([k, l]) => `<a href="#/arquivos/config/${k}" class="${k === aba ? 'on' : ''}">${l}</a>`).join('')}</nav>
    <div id="cfg-corpo" style="margin-top:18px"></div>`;
  ({ series: arqCfgSeries, emissores: arqCfgEmissores, padrao: arqCfgPadrao, chaves: arqCfgChaves })[aba]();
  if (serieAbrir){ const x = arq.series.find(y => `NRO-${y.prefixo}-${String(y.sn).padStart(3, '0')}` === serieAbrir); if (x) arqModalSerie(x.id); }
}
const arqCodSerie = s => `NRO-${s.prefixo}-${String(s.sn).padStart(3, '0')}`;
function arqCfgSeries(){
  const f = arq.cfgFiltro, q = norm(f.q);
  const lista = arq.series.filter(s => (!f.emissor || s.prefixo === f.emissor)
    && (!q || norm(arqCodSerie(s)).includes(q) || norm(s.titulo).includes(q)));
  $('#cfg-corpo').innerHTML = `<div class="filtros">
      <div class="fld cresce"><label>Buscar</label><input value="${esc(f.q)}" placeholder="Código ou título"
        oninput="arq.cfgFiltro.q=this.value;clearTimeout(window._cfgT);window._cfgT=setTimeout(arqCfgSeries,150)"></div>
      <div class="fld"><label>Emissor</label><select onchange="arq.cfgFiltro.emissor=this.value;arqCfgSeries()">
        <option value="">Todos</option>${arq.emissores.map(e => `<option value="${e.prefixo}" ${f.emissor === e.prefixo ? 'selected' : ''}>${esc(e.prefixo)} — ${esc(e.nome)}</option>`).join('')}</select></div>
      <button class="btn solid mini" style="align-self:flex-end;margin-bottom:2px" onclick="arqModalSerie(null, arq.cfgFiltro.emissor)">${ic('plus')} Nova série</button>
    </div>
    <div class="card" style="padding:0"><div class="wrap" style="max-height:none"><table class="tabela trabalho fixa">
      <thead><tr><th style="width:120px">Série</th><th>Título</th><th style="width:190px">Estrutura</th><th style="width:120px">Classe</th>
        <th style="width:170px">Revisa</th><th style="width:170px">Lê também</th><th style="width:56px"></th></tr></thead>
      <tbody>${lista.map(s => `<tr>
        <td style="font-family:var(--fm)">${arqCodSerie(s)}</td>
        <td title="${esc(s.titulo)}">${esc(s.titulo)}</td>
        <td title="${esc(ARQ_ESTRUTURAS[arqEstrutura(s)].frase)}">${ARQ_ESTRUTURAS[arqEstrutura(s)].rot}</td>
        <td><span class="arq-cls ${s.classe}">${ARQ_CLASSES[s.classe][0]}</span></td>
        <td>${s.grupo_revisor ? esc(arqGrupoNome(s.grupo_revisor) || '—') : '<span class="muted">PMO</span>'}</td>
        <td>${(s.grupos_leitura || []).map(g => esc(arqGrupoNome(g) || '—')).join(', ') || '<span class="muted">—</span>'}</td>
        <td style="text-align:right">${ibtn('pencil', 'Configurar ' + arqCodSerie(s), `arqModalSerie('${s.id}')`, 'sm')}</td></tr>`).join('')
        || '<tr><td colspan="7" class="empty">Nenhuma série com esse filtro.</td></tr>'}</tbody></table></div></div>`;
}
function arqModalSerie(id, prefixo, estrutura){
  const s = id ? arq.series.find(x => x.id === id) : null;
  const temPN = s && arq.rol.some(r => r.serie_id === s.id && r.pn != null);
  /* a estrutura é a coluna ao lado do título na NRO-PUB-001; "avulso"
     não é escolha, é documento único com subtipo template */
  const est = s ? (arqEstrutura(s) === 'avulso' ? 'unico' : arqEstrutura(s)) : (ARQ_ESTRUTURAS[estrutura] ? estrutura : 'unico');
  const grupos = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const opG = sel => grupos.map(g => `<option value="${g.id}" ${g.id === sel ? 'selected' : ''}>${esc(g.nome)}</option>`).join('');
  const pref = s?.prefixo || prefixo || arq.emissores[0]?.prefixo || '';
  const proxSN = p => Math.max(0, ...(arq.series.length ? arq.series : arq.rol).filter(x => x.prefixo === p).map(x => x.sn || 0)) + 1;
  abreModal(`<h3>${s ? 'Série ' + arqCodSerie(s) : 'Nova série'}</h3>
    <div class="form-grid">
      ${s ? '' : `<div class="fld"><label for="as-pref">Emissor</label><select id="as-pref" onchange="document.getElementById('as-sn').placeholder='próximo livre: '+String(arqProxSN(this.value)).padStart(3,'0')">
          ${arq.emissores.map(e => `<option value="${e.prefixo}" ${e.prefixo === pref ? 'selected' : ''}>${esc(e.prefixo)} — ${esc(e.nome)}</option>`).join('')}</select></div>
        <div class="fld"><label for="as-sn">Número de série (SN)</label><input id="as-sn" type="number" min="1" max="999"
          placeholder="próximo livre: ${String(proxSN(pref)).padStart(3, '0')}"></div>`}
      <div class="fld full"><label for="as-tit">Título</label><input id="as-tit" value="${esc(s?.titulo || '')}" placeholder="PROCEDIMENTO DE ADMISSÃO"></div>
      <div class="fld full"><label>Estrutura — a coluna ao lado do título na NRO-PUB-001</label>
        <div class="multi" id="as-est" style="max-height:none">${['unico', 'documentos', 'registros'].map(k => { const E = ARQ_ESTRUTURAS[k];
          return `<label class="check"><input type="radio" name="as-est" value="${k}" ${est === k ? 'checked' : ''} ${temPN ? 'disabled' : ''}>
            <span><b style="color:var(--ink)">${E.rot}</b> — “${E.frase}”<br><span class="dim">${E.ex}</span></span></label>`; }).join('')}</div>
        ${temPN ? '<span class="mailer-sub tight">A série já tem PN: a estrutura não muda mais por aqui.</span>' : ''}</div>
      <div class="fld"><label for="as-sub">Subtipo</label><select id="as-sub">${Object.entries(ARQ_SUBTIPOS).map(([k, v]) =>
        `<option value="${k}" ${(s?.subtipo || 'outro') === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        <span class="mailer-sub tight">Documento único com subtipo Template/modelo é um template avulso, como o NRO-PUB-002.</span></div>
      <div class="fld full"><label>Classe</label><div class="multi" style="max-height:none">${Object.entries(ARQ_CLASSES).map(([k, [l, d]]) =>
        `<label class="check"><input type="radio" name="as-cls" value="${k}" ${(s?.classe || 'controlado') === k ? 'checked' : ''}>
          <span><b style="color:var(--ink)">${l}</b> — ${d}</span></label>`).join('')}</div></div>
      <div class="fld full"><label for="as-rev">Grupo revisor</label><select id="as-rev"><option value="">— o PMO —</option>${opG(s?.grupo_revisor)}</select>
        <span class="mailer-sub tight">Quem aprova cada versão nova desta série — e recebe o aviso por e-mail. Quem enviou nunca aprova a própria.</span></div>
      <div class="fld full"><label>Grupos que também leem</label><div class="multi" id="as-leit">${grupos.map(g =>
        `<label class="check"><input type="checkbox" value="${g.id}" ${(s?.grupos_leitura || []).includes(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}</div>
        <span class="mailer-sub tight">Na classe confidencial, são os únicos (com o grupo revisor). Quem está num subgrupo também lê.</span></div>
      <div class="fld full"><label for="as-desc">Observação</label><textarea id="as-desc" rows="2">${esc(s?.descricao || '')}</textarea></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="as-btn" onclick="arqSalvarSerie(${s ? `'${s.id}'` : 'null'})">Salvar</button></div>`, 'largo');
}
function arqProxSN(p){ return Math.max(0, ...arq.series.filter(x => x.prefixo === p).map(x => x.sn || 0), ...arq.rol.filter(x => x.prefixo === p).map(x => x.sn || 0)) + 1; }
async function arqSalvarSerie(id){
  const p = {
    titulo: $('#as-tit').value.trim(), subtipo: $('#as-sub').value,
    classe: document.querySelector('input[name="as-cls"]:checked')?.value,
    grupo_revisor: $('#as-rev').value ? Number($('#as-rev').value) : null,
    grupos_leitura: [...document.querySelectorAll('#as-leit input:checked')].map(x => Number(x.value)),
    descricao: $('#as-desc').value
  };
  const est = document.querySelector('input[name="as-est"]:checked');
  if (est && !est.disabled){ p.tipo = ARQ_ESTRUTURAS[est.value].tipo; p.multiplo = ARQ_ESTRUTURAS[est.value].multiplo; }
  if (!p.titulo) return toast('O título é obrigatório.', true);
  if (id) p.id = id;
  else { p.prefixo = $('#as-pref').value; const sn = parseInt($('#as-sn').value, 10); if (sn) p.sn = sn; }
  const b = $('#as-btn'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('doc_serie_salvar', { p });
    if (error) throw error;
    const msg = { duplicado:'Esse SN já existe neste emissor.', tem_pn:'A série já tem PN: a estrutura não muda mais.',
                  no_padrao:'A série está no padrão de projeto: precisa continuar com PN — não pode ser documento único.' }[data?.status];
    if (data?.status !== 'ok') return toast(msg || motivoRPC(data, null, 'Não foi possível salvar'), true);
    fechaModal();
    toast(id ? 'Série salva.' : `${data.codigo} criada, em rascunho.`);
    await arqCarregar(true);
    if (!id) { location.hash = '#/arquivos/' + data.codigo; return; }
    const r = route(); if (r.sub === 'config') arqConfig(r.sub2 && !/^serie-/.test(r.sub2) ? r.sub2 : 'series');
    else if (arq.tela) arqTela(arq.tela.r.codigo);
  }catch(e){ falha(e, 'Erro ao salvar a série'); }
  finally{ const x = $('#as-btn'); if (x) x.disabled = false; }
}

function arqCfgEmissores(){
  const grupos = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('#cfg-corpo').innerHTML = `<p class="small muted" style="margin-bottom:12px;line-height:1.6">O emissor é o XXX de
      NRO-XXX-YYY: o departamento ou grupo que emite o arquivo. Quem está no grupo dele cria PNs e envia versões
      das séries do emissor.</p>
    <div class="card arq-cfg-lista">${arq.emissores.map(e => `<div class="acc-row">
        <span class="cod-pf">${esc(e.prefixo)}</span>
        <input class="nm" value="${esc(e.nome)}" aria-label="Nome do emissor ${esc(e.prefixo)}" id="em-n-${e.prefixo}" style="height:34px">
        <select id="em-g-${e.prefixo}" aria-label="Grupo do emissor ${esc(e.prefixo)}" style="height:34px;max-width:240px">
          <option value="">— sem grupo —</option>${grupos.map(g => `<option value="${g.id}" ${g.id === e.grupo_id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
        <button class="btn ghost mini" onclick="arqSalvarEmissor('${e.prefixo}')">Salvar</button></div>`).join('')}
      <div class="acc-row"><input id="em-novo-p" maxlength="3" placeholder="XXX" style="width:70px;height:34px;text-transform:uppercase;font-family:var(--fm)">
        <input id="em-novo-n" class="nm" placeholder="Departamento Clínico" style="height:34px">
        <button class="btn solid mini" onclick="arqSalvarEmissor(null)">${ic('plus')} Emissor</button></div></div>`;
}
async function arqSalvarEmissor(pref){
  let q;
  if (pref) q = sb.from('doc_emissores').update({ nome: $('#em-n-' + pref).value.trim(),
    grupo_id: $('#em-g-' + pref).value ? Number($('#em-g-' + pref).value) : null }).eq('prefixo', pref);
  else {
    const p = $('#em-novo-p').value.trim().toUpperCase(), n = $('#em-novo-n').value.trim();
    if (!/^[A-Z]{3}$/.test(p) || !n) return toast('O prefixo tem três letras, e o nome é obrigatório.', true);
    q = sb.from('doc_emissores').insert({ prefixo: p, nome: n, ordem: arq.emissores.length });
  }
  const { error } = await q;
  if (error) return falha(error, 'Erro ao salvar o emissor');
  toast('Emissor salvo.'); await arqCarregar(true); carregarProjetosEArquivos(); arqCfgEmissores();
}

function arqCfgPadrao(){
  const pad = [...arq.padrao].sort((a, b) => a.ordem - b.ordem);
  const cab = id => arq.rol.find(r => r.serie_id === id && r.pn == null);
  const fora = arq.rol.filter(r => r.pn == null && r.multiplo && !pad.some(p => p.serie_id === r.serie_id));
  $('#cfg-corpo').innerHTML = `<p class="small muted" style="margin-bottom:12px;line-height:1.6">As séries que todo projeto
      tem. O rol de cada projeto é este padrão aplicado a ele — mudar aqui muda o de todos, na hora. Só entra série com
      PN: cada projeto ganha o seu.</p>
    <div class="card arq-cfg-lista">${pad.map((p, i) => { const c = cab(p.serie_id); return `<div class="acc-row">
        <span class="muted small" style="font-family:var(--fm);width:22px">${i + 1}</span>
        <span class="nm"><span style="font-family:var(--fm);color:var(--syn-tx)">${esc(c?.codigo || '?')}</span> ${esc(c?.titulo || '')}</span>
        <select aria-label="Quantos por projeto" onchange="arqPadraoQtd('${p.serie_id}', this.value)" style="height:32px">
          <option value="um" ${p.quantidade === 'um' ? 'selected' : ''}>um por projeto</option>
          <option value="varios" ${p.quantidade === 'varios' ? 'selected' : ''}>vários por projeto</option></select>
        ${ibtn('back', 'Subir', `arqPadraoMover(${i}, -1)`, 'sm')}
        ${ibtn('x', 'Tirar do padrão', `arqPadraoTirar('${p.serie_id}')`, 'perigo sm')}</div>`; }).join('')
      || '<p class="muted small">O padrão está vazio.</p>'}
      <div class="acc-row"><select id="pd-add" style="flex:1;height:34px"><option value="">Pôr uma série no padrão…</option>${fora.map(r =>
        `<option value="${r.serie_id}">${esc(r.codigo)} — ${esc(r.titulo)}</option>`).join('')}</select>
        <button class="btn solid mini" onclick="arqPadraoPor()">${ic('plus')} Pôr</button></div></div>`;
}
async function arqPadraoRecarregar(){ await arqCarregar(true); arqCfgPadrao(); }
async function arqPadraoPor(){
  const id = $('#pd-add').value; if (!id) return;
  const { error } = await sb.from('doc_padrao_projeto').insert({ serie_id: id, ordem: arq.padrao.length + 1, quantidade:'um' });
  if (error) return falha(error, 'Erro'); toast('Posta no padrão. O rol de todos os projetos já tem esta linha.'); arqPadraoRecarregar();
}
async function arqPadraoTirar(id){
  if (!await confirma('Tirar esta série do padrão? Os PNs que os projetos já criaram continuam existindo — só deixam de ser cobrados.', 'Tirar')) return;
  const { error } = await sb.from('doc_padrao_projeto').delete().eq('serie_id', id);
  if (error) return falha(error, 'Erro'); arqPadraoRecarregar();
}
async function arqPadraoQtd(id, q){
  const { error } = await sb.from('doc_padrao_projeto').update({ quantidade: q }).eq('serie_id', id);
  if (error) return falha(error, 'Erro'); toast('Salvo.'); arqPadraoRecarregar();
}
async function arqPadraoMover(i, d){
  const pad = [...arq.padrao].sort((a, b) => a.ordem - b.ordem), j = i + d;
  if (j < 0 || j >= pad.length) return;
  [pad[i], pad[j]] = [pad[j], pad[i]];
  for (let k = 0; k < pad.length; k++)
    if (pad[k].ordem !== k + 1) await sb.from('doc_padrao_projeto').update({ ordem: k + 1 }).eq('serie_id', pad[k].serie_id);
  arqPadraoRecarregar();
}

function arqCfgChaves(){
  const grupos = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const atual = k => grupos.find(g => g.chave === k)?.id;
  const admin = state.perfil?.papel === 'admin';
  const sel = (k, rot, ajuda) => `<div class="fld"><label for="ch-${k}">${rot}</label>
    <select id="ch-${k}" ${admin ? '' : 'disabled'}><option value="">— nenhum —</option>${grupos.map(g =>
      `<option value="${g.id}" ${g.id === atual(k) ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
    <span class="mailer-sub tight">${ajuda}</span></div>`;
  $('#cfg-corpo').innerHTML = `<div class="card" style="max-width:640px">
    ${sel('pmo', 'O grupo do PMO', 'Quem está nele administra a documentação: cria séries, configura revisores e o padrão de projeto, e revisa as séries sem grupo revisor.')}
    ${sel('projetos', 'O pai dos projetos', 'Cada projeto novo ganha um grupo dentro deste. Quem está na equipe de um projeto está nele também.')}
    ${admin ? `<div class="acts" style="justify-content:flex-end"><button class="btn solid" onclick="arqSalvarChaves()">Salvar</button></div>`
      : '<p class="small muted">Só a administração escolhe estes dois grupos.</p>'}</div>`;
}
async function arqSalvarChaves(){
  for (const k of ['pmo', 'projetos']){
    const g = $('#ch-' + k).value ? Number($('#ch-' + k).value) : null;
    if (g === ((state.grupos || []).find(x => x.chave === k)?.id ?? null)) continue;
    const { data, error } = await sb.rpc('grupo_chave_definir', { p: { chave: k, grupo_id: g } });
    if (error) return falha(error, 'Erro');
    if (data?.status === 'ocupado') return toast(`Esse grupo já é o de "${data.chave}".`, true);
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível salvar'), true);
  }
  toast('Salvo.'); await carregarGrupos(); arqCfgChaves();
}

/* ============================================================
   EXPORTAR — a planilha no formato da NRO-PUB-001
   Uma aba por emissor, as mesmas colunas: código, nome, a estrutura
   (a coluna sem cabeçalho ao lado do nome, com as mesmas frases),
   status, tipo, subtipo, classe, redigido/revisado/aprovado por, e
   Rev. B a P com responsável, data e change log. Para quem ainda
   precisa do .xlsx (uma auditoria, o Drive CTA).
   ============================================================ */
const XLSX_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
const PARA_PLANILHA = {
  status: { ativo:'EM VIGÊNCIA', rascunho:'RASCUNHO', em_revisao:'EM REVISÃO', obsoleto:'SUBSTITUÍDO' },
  subtipo: { politica:'POLÍTICA', procedimento:'PROCEDIMENTO', manual:'MANUAL/GUIA', template:'TEMPLATE/MODELO',
    formulario:'FORMULÁRIO', planilha:'PLANILHA', checklist:'LISTA/CHECKLIST', relatorio:'RELATÓRIO', ata:'ATA',
    inventario:'INVENTÁRIO', declaracao:'DECLARAÇÃO', outro:'OUTROS' },
  classe: { publico:'PÚBLICO', controlado:'CONTROLADO', confidencial:'CONFIDENCIAL' }
};
async function arqExportar(soPrefixo){
  try{
    if (!window.XLSX) await carregarLib(XLSX_CDN);
    await arqCarregar(true);
    const rv = await sb.from('doc_revisoes').select('arquivo_id,rev,estado,enviado_nome,enviado_em,revisor_nome,revisado_em,mudancas')
      .in('estado', ['aprovada', 'substituida']);
    const revs = rv.data || [];
    const d = x => x ? String(x).slice(0, 10).split('-').reverse().join('/') : '';
    const wb = XLSX.utils.book_new();
    const letras = 'BCDEFGHIJKLMNOP'.split('');
    const cab1 = ['CÓDIGO', 'NOME DO ARQUIVO', '', 'STATUS', 'TIPO', 'SUBTIPO', 'CLASSE', 'REDIGIDO POR', '', 'REVISADO POR', '', 'APROVADO POR', '',
      ...letras.flatMap(l => ['Rev. ' + l, '', ''])];
    const cab2 = ['', '', '', '', '', '', '', 'AUTOR', 'DATA', 'REVISADOR', 'DATA', 'APROVADOR', 'DATA',
      ...letras.flatMap(() => ['RESPONSÁVEL', 'DATA', 'CHANGE LOG'])];
    /* a coluna de estrutura: a frase da série na cabeça (o avulso fica
       em branco, como na planilha); no PN, de qual série ele é filho */
    const estrutura = r => r.pn != null
      ? `um ${r.tipo === 'registro' ? 'registro' : 'documento'}, pn da série ${arq.rol.find(x => x.serie_id === r.serie_id && x.pn == null)?.codigo || ''}`
      : arqEstrutura(r) === 'avulso' ? '' : ARQ_ESTRUTURAS[arqEstrutura(r)].frase;
    arq.emissores.filter(e => !soPrefixo || e.prefixo === soPrefixo).forEach(e => {
      const linhas = arq.rol.filter(r => r.prefixo === e.prefixo).sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR', { numeric:true }));
      const dados = linhas.map(r => {
        const doArq = revs.filter(v => v.arquivo_id === r.id);
        const a = doArq.find(v => v.rev === 'A' || v.rev == null);
        const lin = [r.codigo, r.titulo, estrutura(r), PARA_PLANILHA.status[r.status], r.tipo === 'registro' ? 'REGISTRO' : 'DOCUMENTO',
          PARA_PLANILHA.subtipo[r.subtipo] || '', PARA_PLANILHA.classe[r.classe] || '',
          a?.enviado_nome || r.autor_nome || '', d(a?.enviado_em), a?.revisor_nome || '', d(a?.revisado_em), '', ''];
        letras.forEach(l => { const v = doArq.find(x => x.rev === l); lin.push(v?.enviado_nome || '', d(v?.revisado_em), v?.mudancas || ''); });
        return lin;
      });
      const ws = XLSX.utils.aoa_to_sheet([cab1, cab2, ...dados]);
      ws['!merges'] = [0, 1, 3, 4, 5, 6].map(c => ({ s:{ r:0, c }, e:{ r:1, c } }))
        .concat([7, 9, 11].map(c => ({ s:{ r:0, c }, e:{ r:0, c: c + 1 } })))
        .concat(letras.map((_, i) => ({ s:{ r:0, c: 13 + i * 3 }, e:{ r:0, c: 15 + i * 3 } })));
      ws['!cols'] = [{ wch:14 }, { wch:48 }, { wch:46 }, { wch:14 }, { wch:12 }, { wch:18 }, { wch:14 }];
      XLSX.utils.book_append_sheet(wb, ws, 'NRO-' + e.prefixo);
    });
    XLSX.writeFile(wb, `NRO-PUB-001 CONTROLE DE DOCUMENTOS E REGISTROS (portal ${new Date().toISOString().slice(0, 10)}).xlsx`);
  }catch(e){ falha(e, 'Erro ao exportar'); }
}

registrarBusca({
  fonte:'arquivos', rotulo:'Arquivos',
  buscar: (t) => filtrarSimples(arq.rol.map(r => ({
    codigo: r.codigo, titulo: r.titulo,
    sub: [arqNatureza(r), (ARQ_STATUS[r.status] || [])[0], r.rev_vigente ? 'Rev. ' + r.rev_vigente : ''].filter(Boolean).join(' · '),
    href: '#/arquivos/' + r.codigo })), t, 6)
});
