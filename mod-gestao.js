/* ============================================================
   MÓDULO · GESTÃO DO QUADRO
   Carregado sob demanda pela casca (index.html) quando alguém abre
   o quadro (#/equipe/quadro), uma ficha ou a auditoria (#/admin/auditoria). Script clássico, não módulo ES: os
   handlers são onclick="…" e dependem de escopo global.

   Veio do SOMA · Gestão (pessoal.neurodynamics.dev), re-vestido nos
   tokens da marca. O que mudou em relação ao original:

   - o tema claro virou o escuro do design system: cartão é borda e
     vidro, não sombra; a ação é Synapse, não o verde institucional,
     que não tem contraste sobre o Void;
   - as telas ganharam endereço (#/equipe/quadro, #/equipe/<registro>)
     — no SOMA a navegação era por showView() e nenhuma ficha podia ser
     mandada por mensagem;
   - .tb virou .tabela.trabalho, .filters virou .filtros, .stat virou
     .metrica, .banner virou .aviso-box — os nomes do design system;
   - os tipos de ocorrência moram aqui como gestao.tiposOcorrencia: na
     casca, state.tipos já é o catálogo de tipos de evento da agenda.

   Depende da casca para: sb, $, esc, norm, state, can, podeQuadro, ic, ibtn,
   toast, abreModal, fechaModal, fmtD, fmtDT, hojeISO, pad3, nomeDe,
   quemSouEu, avatarFoto, carregarLib, carregarModulo, confirma, falha,
   gruposEfetivos. A aba Treinamentos chama mod-treinamentos
   (treBaixarCertificado) depois de carregá-lo.
   ============================================================ */

/* ---------------- estado do módulo ---------------- */
const gestao = {
  pronto: false, apont: null,
  tiposOcorrencia: [],
  filtros: { q:'', status:'Ativo', dep:'', grupo:'' },
  ficha: null,
  aud: []
};

/* ---------------- constantes do quadro ---------------- */
/* STATUS_LIST e falha() moraram aqui e foram para a casca: mod-relatorios
   e mod-admin usam os dois, e módulo não pode depender de módulo — quem
   abrisse Relatórios sem ter passado pelo quadro achava "STATUS_LIST is
   not defined" no lugar do formulário. */
const STATUS_DOT  = {'Ativo':['dt-ok','p-ok'], 'Em pausa / avaliação':['dt-warn','p-warn'],
  'Sob demanda':['dt-info','p-info'], 'Desligado':['dt-bad','p-bad'], 'Egresso':['dt-gray','']};
const TAB_LABEL = {membros:'Membros', dados_pessoais:'Dados pessoais', acessos_concedidos:'Acessos',
  ocorrencias:'Ocorrências', avaliacoes:'Avaliações', itens_de_acesso:'Catálogo',
  apontamentos:'Apontamentos', apontamento_itens:'Apontamentos', eventos:'Eventos',
  evento_participantes:'Eventos · presenças', evento_checklist:'Eventos · checklist'};

/* ---------------- utilidades ---------------- */
const pill = (st) => { const [dot, cor] = STATUS_DOT[st] || ['dt-gray',''];
  return `<span class="pill ${cor}"><span class="dt ${dot}"></span>${esc(st||'—')}</span>`; };
function chips(arr, max){
  if (!arr || !arr.length) return '<span class="muted">—</span>';
  const v = arr.slice(0, max||99).map(g => `<span class="chip mini">${esc(g)}</span>`).join(' ');
  return v + (arr.length > (max||99) ? ` <span class="chip mini">+${arr.length-max}</span>` : '');
}
/* Cabeçalho de página no padrão da marca, com as ações à direita. */
function topoGestao({ olho, titulo, lead, acoes, voltar }){
  return `<div class="topo-gestao">
    ${voltar ? `<div style="padding-top:34px">${ibtn('back','Voltar', voltar)}</div>` : ''}
    <div class="tx"><span class="eyebrow">${esc(olho||'Gestão')}</span>
      <h1>${esc(titulo)}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
    ${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
}

/* ============================================================
   CARGA
   A casca carrega membros com as colunas que o plano do membro usa.
   A ficha precisa da linha inteira, então aqui o quadro é relido —
   um superconjunto, inofensivo para quem já o estava usando.
   ============================================================ */
async function gestaoCarregar(){
  if (gestao.pronto) return;
  const [m, t] = await Promise.all([
    sb.from('membros').select('*').order('nome'),
    sb.from('tipos_ocorrencia').select('*').eq('ativo', true).order('nome')
  ]);
  if (m.error) throw m.error;
  state.membros = m.data || [];
  gestao.tiposOcorrencia = t.error ? [] : (t.data || []);
  gestao.pronto = true;
}

/* ============================================================
   #/equipe/quadro — visão geral + lista, ou a ficha quando vem registro
   ============================================================ */
async function pageQuadro(sub){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando o quadro…</div>`;
  try { await gestaoCarregar(); }
  catch(e){
    $('#main').innerHTML = topoGestao({titulo:'Quadro indisponível'})
      + `<div class="aviso-box err">Não foi possível carregar o quadro de pessoal:
         ${esc(e.message)}. Se o erro fala de permissão, o seu papel não dá acesso a esta tela.</div>`;
    return;
  }
  const reg = sub != null ? parseInt(sub, 10) : null;
  if (reg != null && !isNaN(reg)) return abrirFicha(reg);
  renderQuadro();
}

function renderQuadro(){
  const ms = state.membros;
  const c = (st) => ms.filter(m => m.status === st).length;
  const deptos = {};
  ms.filter(m => m.status === 'Ativo').forEach(m => {
    const d = m.departamento || 'Sem departamento'; deptos[d] = (deptos[d]||0) + 1;
  });
  const maxDep = Math.max(1, ...Object.values(deptos));

  $('#main').innerHTML = topoGestao({
    olho: 'Quadro de pessoal',
    titulo: 'Quadro',
    lead: 'O quadro inteiro: quem está ativo, em pausa, sob demanda e desligado — e a ficha de cada um.',
    acoes: can() ? ibtn('plus','Novo membro','modalMembro()','primary') : ''
  }) + abasEquipe('quadro') + `
    <div class="metricas" style="margin-bottom:18px">
      <div class="metrica"><span class="rot">Membros ativos</span><span class="val">${c('Ativo')}</span></div>
      <div class="metrica"><span class="rot">Em pausa / avaliação</span><span class="val">${c('Em pausa / avaliação')}</span></div>
      <div class="metrica"><span class="rot">Sob demanda</span><span class="val">${c('Sob demanda')}</span></div>
      <div class="metrica"><span class="rot">Desligados e egressos</span><span class="val">${c('Desligado')+c('Egresso')}</span></div>
    </div>
    <div id="q-pendencias"></div>
    <div class="card" style="margin-bottom:18px"><h3>Ativos por departamento</h3>
      <p class="sub" style="margin-bottom:14px">${ms.length} registros no quadro</p>
      ${Object.keys(deptos).length ? `<div class="barras">${Object.entries(deptos).sort((a,b)=>b[1]-a[1]).map(([d,n])=>`
        <div class="barra"><span class="k">${esc(d)}</span>
          <span class="trilho"><span class="fill" style="width:${Math.round(n/maxDep*100)}%"></span></span>
          <span class="n">${n}</span></div>`).join('')}</div>`
        : '<div class="empty">Nenhum membro ativo cadastrado.</div>'}
    </div>
    ${filtrosHTML()}
    <div class="card" style="padding:8px 14px"><div id="tb-membros"></div></div>
    <div id="q-ocorr" style="margin-top:18px"></div>`;

  renderTabelaMembros();
  carregarPendencias();
  if (podeQuadro()) carregarOcorrenciasRecentes();
}

function opcoesDe(campo){ return [...new Set(state.membros.map(m=>m[campo]).filter(Boolean))].sort(); }
/* o catálogo mais o que só existe escrito em alguma ficha: grupo
   guarda-chuva (NRO_PROJECTS) não tem ninguém direto e sumiria */
function todosGrupos(){
  return [...new Set([...(state.grupos||[]).map(g=>g.nome), ...state.membros.flatMap(m=>m.grupos||[])])].sort();
}
function membrosFiltrados(){
  const f = gestao.filtros, q = norm(f.q);
  return state.membros.filter(m =>
    (!f.status || m.status === f.status) &&
    (!f.dep || m.departamento === f.dep) &&
    (!f.grupo || gruposEfetivos(m).has(f.grupo)) &&
    (!q || norm(m.nome).includes(q) || norm(m.email_nro).includes(q)
        || norm(m.email_pessoal).includes(q) || String(m.registro).includes(q))
  ).sort((a,b) => a.registro - b.registro);
}
function filtrosHTML(){
  const f = gestao.filtros;
  const sel = (id, label, opts, atual) => `<div class="fld"><label>${label}</label>
    <select onchange="gestao.filtros.${id}=this.value;renderTabelaMembros()">
      <option value="">Todos</option>${opts.map(o=>`<option ${atual===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  return `<div class="filtros">
    <div class="fld cresce"><label>Buscar</label>
      <input value="${esc(f.q)}" placeholder="Nome, e-mail ou registro"
        oninput="gestao.filtros.q=this.value;renderTabelaMembros()"></div>
    ${sel('status','Status', STATUS_LIST, f.status)}
    ${sel('dep','Departamento', opcoesDe('departamento'), f.dep)}
    ${sel('grupo','Grupo', todosGrupos(), f.grupo)}
    ${ibtn('x','Limpar filtros (volta ao padrão de ativos)',
      "gestao.filtros={q:'',status:'Ativo',dep:'',grupo:''};renderQuadro()")}
  </div>`;
}
function renderTabelaMembros(){
  const ms = membrosFiltrados();
  const el = $('#tb-membros'); if (!el) return;
  el.innerHTML = ms.length ? `
    <div class="wrap"><table class="tabela trabalho fixa">
      <thead><tr><th style="width:64px">Reg.</th><th>Nome</th><th>Departamento</th>
        <th>Cargo</th><th style="width:150px">Grupos</th><th style="width:132px">Status</th></tr></thead>
      <tbody>${ms.map(m=>`<tr class="click" tabindex="0" onclick="abrirFicha(${m.registro})"
        onkeydown="if(event.key==='Enter')abrirFicha(${m.registro})">
        <td class="reg">${pad3(m.registro)}</td>
        <td class="nome" title="${esc(m.nome)}">${esc(m.nome)}</td>
        <td title="${esc(m.departamento||'')}">${esc(m.departamento||'—')}</td>
        <td title="${esc(m.cargo||'')}">${esc(m.cargo||'—')}</td>
        <td title="${esc((m.grupos||[]).join(', '))}">${chips(m.grupos,2)}</td>
        <td>${pill(m.status)}</td></tr>`).join('')}</tbody></table></div>
    <div class="small muted" style="padding:10px 4px">${ms.length} de ${state.membros.length} registros</div>`
    : `<div class="empty">Nenhum membro corresponde aos filtros.</div>`;
}

async function carregarPendencias(){
  if (!can()) return;
  try{
    let html = '';
    const desligados = state.membros.filter(m=>['Desligado','Egresso'].includes(m.status)).map(m=>m.registro);
    if (desligados.length){
      const { data:ac } = await sb.from('acessos_concedidos').select('registro').eq('ativo',true).in('registro', desligados);
      const n = new Set((ac||[]).map(a=>a.registro)).size;
      if (n) html += `<div class="aviso-box err"><b>Checklist de revogação pendente:</b>
        ${n} membro(s) desligado(s) ainda com acessos ativos.</div>`;
    }
    const [{data:sin}, {data:av}] = await Promise.all([
      sb.from('apontamento_itens').select('id').eq('sinalizado',true).eq('tratado',false),
      sb.from('avaliacoes').select('id').eq('encaminhar_pessoal',true).eq('tratado',false)
    ]);
    const pend = (sin||[]).length + (av||[]).length;
    if (pend) html += `<div class="aviso-box warn"><b>${pend} encaminhamento(s)</b> aguardando
      o Painel do Depto. de Pessoal.</div>`;
    const el = $('#q-pendencias'); if (el) el.innerHTML = html;
  }catch(e){ /* informativo — não atrapalha o quadro */ }
}

async function carregarOcorrenciasRecentes(){
  try{
    const { data:oc } = await sb.from('ocorrencias').select('*, membro:membros(nome)')
      .order('data',{ascending:false}).order('criado_em',{ascending:false}).limit(8);
    const el = $('#q-ocorr'); if (!el) return;
    el.innerHTML = `<div class="card"><h3>Ocorrências recentes</h3>
      <p class="sub" style="margin-bottom:14px">Os últimos movimentos registrados no quadro</p>
      ${(oc && oc.length) ? `<div class="timeline">${oc.map(o=>`
        <div class="tl-item"><div class="dt">${fmtD(o.data)}</div>
          <div class="tp">${esc(o.tipo)} · <a href="#/equipe/${o.registro}">${esc(o.membro?.nome || 'registro '+o.registro)}</a></div>
          ${o.descricao ? `<div class="ds">${esc(o.descricao)}</div>` : ''}</div>`).join('')}</div>`
        : '<div class="empty">Nenhuma ocorrência registrada ainda.</div>'}</div>`;
  }catch(e){
    const el = $('#q-ocorr'); if (el) el.innerHTML = '';
  }
}

/* ============================================================
   FICHA DO MEMBRO — #/equipe/<registro>
   ============================================================ */
const CAMPOS_MEMBRO = [
  {k:'nome', l:'Nome completo', t:'text'},
  {k:'status', l:'Status', t:'select', opts:STATUS_LIST},
  {k:'departamento', l:'Departamento', t:'datalist', list:'dl-deptos'},
  {k:'cargo', l:'Cargo atual', t:'datalist', list:'dl-cargos'},
  {k:'gestor_registro', l:'Gestor imediato', t:'gestor'},
  {k:'grupos', l:'Grupos', t:'grupos', full:true},
  {k:'email_nro', l:'E-mail NRO', t:'text'},
  {k:'email_pessoal', l:'E-mail pessoal', t:'text'},
  {k:'telefone', l:'Telefone', t:'text'},
  {k:'foto_url', l:'Foto (URL — vazio usa fotos/REG.jpg do repositório)', t:'text', full:true},
  {k:'data_ingresso', l:'Data de ingresso', t:'date'},
  {k:'forma_ingresso', l:'Forma de ingresso', t:'datalist', list:'dl-formas'},
  {k:'data_desligamento', l:'Data de desligamento', t:'date'},
  {k:'projeto_fomento', l:'Projeto no sistema de fomento', t:'text'},
  {k:'classificacao', l:'Classificação', t:'text'},
  {k:'bolsa', l:'Bolsa', t:'text'},
  {k:'data_encerramento', l:'Data de encerramento da bolsa', t:'date'}
];
const CAMPOS_PESS = [
  {k:'cpf', l:'CPF'}, {k:'data_nascimento', l:'Data de nascimento', t:'date'}, {k:'genero', l:'Gênero'},
  {k:'endereco', l:'Endereço', full:true}, {k:'cidade_origem', l:'Cidade de origem'},
  {k:'instituicao', l:'Instituição de ensino'}, {k:'curso', l:'Curso'}, {k:'matricula', l:'Matrícula'},
  {k:'periodo_ingresso', l:'Período de ingresso'}, {k:'tempo_deslocamento', l:'Tempo de deslocamento'},
  {k:'autodeclaracao_racial', l:'Autodeclaração racial'}, {k:'situacao_fump', l:'Situação junto à FUMP'},
  {k:'acessibilidade', l:'Necessidades de acessibilidade', full:true},
  {k:'background', l:'Background', t:'textarea', full:true},
  {k:'lattes', l:'Currículo Lattes', full:true}, {k:'instagram', l:'Instagram'}, {k:'github', l:'GitHub'},
  {k:'autorizacao_imagem', l:'Autorização de uso de imagem', t:'bool'}
];

function datalistsHTML(){
  const dl = (id, vals) => `<datalist id="${id}">${vals.map(v=>`<option value="${esc(v)}">`).join('')}</datalist>`;
  return dl('dl-deptos', opcoesDe('departamento')) + dl('dl-cargos', opcoesDe('cargo'))
       + dl('dl-formas', opcoesDe('forma_ingresso'));
}
function campoInput(c, val, regAtual){
  if (c.t === 'select')   return `<select id="f-${c.k}">${c.opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`;
  if (c.t === 'date')     return `<input type="date" id="f-${c.k}" value="${esc(val||'')}">`;
  if (c.t === 'textarea') return `<textarea id="f-${c.k}" rows="3">${esc(val||'')}</textarea>`;
  if (c.t === 'bool')     return `<select id="f-${c.k}"><option value="" ${val==null?'selected':''}>—</option>
    <option value="sim" ${val===true?'selected':''}>Sim</option>
    <option value="nao" ${val===false?'selected':''}>Não</option></select>`;
  if (c.t === 'gestor'){
    const opts = state.membros.filter(m => m.status==='Ativo' && m.registro !== regAtual)
      .map(m => `<option value="${m.registro}" ${m.registro===val?'selected':''}>${esc(m.nome)}</option>`).join('');
    return `<select id="f-${c.k}"><option value="">— sem gestor —</option>${opts}</select>`;
  }
  if (c.t === 'grupos') return pillsGrupos(val);
  const v = val == null ? '' : val;
  return `<input id="f-${c.k}" value="${esc(v)}"${c.list ? ` list="${c.list}"` : ''}>`;
}

/* ============================================================
   GRUPOS POR PILLS
   Antes era um campo de texto e a instrução "separados por
   vírgula". Quem escrevia "Órtese, ortese" ficava com dois grupos,
   e quem esquecia a vírgula ficava com um grupo de nome comprido.

   O <input type="hidden"> continua sendo a fonte da verdade, no
   mesmo formato de antes: assim lerCampos() não muda e o resto da
   ficha não sabe que a tela mudou.
   ============================================================ */
/* Na ordem configurada em Administração -> Grupos, e não em ordem
   alfabética: é a mesma hierarquia que o seletor do quadro usa, e duas
   listas dos mesmos grupos em ordens diferentes confundem. No fim ficam
   os nomes que só existem em fichas antigas e não estão no catálogo. */
function gruposConhecidos(){
  const doCatalogo = (state.grupos || []).map(g => g.nome);
  const soltos = todosGrupos().filter(n => !doCatalogo.includes(n))
    .sort((a,b) => a.localeCompare(b,'pt'));
  return [...doCatalogo, ...soltos].filter(Boolean);
}
const chaveGrupo = g => norm(String(g).trim());
const grpValores = () => {
  const el = document.getElementById('f-grupos');
  return el ? el.value.split(',').map(x=>x.trim()).filter(Boolean) : [];
};

function pillsGrupos(val){
  const atuais = (val || []).filter(Boolean);
  return `<input type="hidden" id="f-grupos" value="${esc(atuais.join(', '))}">
    <div class="pills-ed" onclick="if(event.target===this)document.getElementById('pe-in').focus()">
      <span id="pe-lista">${pillsGruposLista(atuais)}</span>
      <input id="pe-in" list="dl-grupos-ed" autocomplete="off"
        placeholder="${atuais.length ? 'adicionar…' : 'digite o grupo e tecle Enter'}"
        onkeydown="grpTecla(event)" onblur="grpAdicionar()">
    </div>
    <datalist id="dl-grupos-ed">${gruposConhecidos().map(g =>
      `<option value="${esc(g)}"></option>`).join('')}</datalist>
    <p class="small muted" style="margin-top:6px">Enter ou vírgula adiciona.
      Clique no × para tirar. A lista sugere os grupos que já existem —
      usar a sugestão evita "Órtese" e "ortese" virarem dois.</p>`;
}

function pillsGruposLista(gs){
  if (!gs.length) return '';
  return gs.map((g,i) => `<span class="pill-ed">${esc(g)}<button type="button"
    onclick="grpRemover(${i})" aria-label="Tirar do grupo ${esc(g)}" title="Tirar">×</button></span>`).join('');
}

function grpGravar(arr){
  const el = document.getElementById('f-grupos'); if (!el) return;
  el.value = arr.join(', ');
  const lista = document.getElementById('pe-lista');
  if (lista) lista.innerHTML = pillsGruposLista(arr);
  const inp = document.getElementById('pe-in');
  if (inp) inp.placeholder = arr.length ? 'adicionar…' : 'digite o grupo e tecle Enter';
}

function grpRemover(i){
  const arr = grpValores(); arr.splice(i,1); grpGravar(arr);
  const inp = document.getElementById('pe-in'); if (inp) inp.focus();
}

/* Um nome que já existe no catálogo entra com a grafia do catálogo:
   é isso que impede o mesmo grupo de nascer duas vezes por acento. */
function grpCanonico(nome){
  const achado = gruposConhecidos().find(g => chaveGrupo(g) === chaveGrupo(nome));
  return achado || String(nome).trim();
}

function grpAdicionar(){
  const inp = document.getElementById('pe-in'); if (!inp) return;
  const bruto = inp.value; if (!bruto.trim()) { inp.value=''; return; }
  const arr = grpValores();
  bruto.split(',').map(x => x.trim()).filter(Boolean).forEach(nome => {
    const can = grpCanonico(nome);
    if (!arr.some(g => chaveGrupo(g) === chaveGrupo(can))) arr.push(can);
  });
  inp.value = '';
  grpGravar(arr);
}

function grpTecla(ev){
  if (ev.key === 'Enter' || ev.key === ','){ ev.preventDefault(); grpAdicionar(); return; }
  if (ev.key === 'Backspace' && !ev.target.value){
    const arr = grpValores();
    if (arr.length){ ev.preventDefault(); arr.pop(); grpGravar(arr); }
  }
}
function lerCampos(defs){
  const o = {};
  defs.forEach(c => {
    const el = document.getElementById('f-'+c.k); if (!el) return;
    const v = el.value;
    if (c.t === 'grupos')      o[c.k] = v.split(',').map(x=>x.trim()).filter(Boolean);
    else if (c.t === 'bool')   o[c.k] = v === '' ? null : v === 'sim';
    else if (c.t === 'gestor') o[c.k] = v === '' ? null : parseInt(v, 10);
    else                       o[c.k] = String(v).trim() === '' ? null : String(v).trim();
  });
  return o;
}
const membroAtual = () => state.membros.find(m => m.registro === gestao.ficha?.reg);

async function abrirFicha(reg){
  if (location.hash !== '#/equipe/' + reg) { location.hash = '#/equipe/' + reg; return; }
  gestao.ficha = { reg, tab:'dados', ocorr:[], acessos:[], avals:[], aponts:[], pess:null, editando:false };
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando a ficha…</div>`;
  try { await gestaoCarregar(); await carregarFicha(); renderFicha(); }
  catch(e){ falha(e, 'Erro ao abrir a ficha'); }
}

async function carregarFicha(){
  const reg = gestao.ficha.reg;
  /* Consultas por chave: ocorrências e dados pessoais só para quem tem
     o quadro. Assim o papel de consulta nem chega a pedi-los. */
  const q = {
    acessos: sb.from('acessos_concedidos').select('*').eq('registro', reg),
    avals:   sb.from('avaliacoes').select('*').eq('registro', reg).order('data',{ascending:false}),
    aponts:  sb.from('apontamento_itens').select('*').eq('registro', reg).order('data',{ascending:false}).limit(12)
  };
  if (podeQuadro()) q.ocorr = sb.from('ocorrencias').select('*').eq('registro', reg)
    .order('data',{ascending:false}).order('criado_em',{ascending:false});
  if (can()) q.pess = sb.from('dados_pessoais').select('*').eq('registro', reg).maybeSingle();

  const chaves = Object.keys(q);
  const res = await Promise.all(chaves.map(k => q[k]));
  const out = {}; chaves.forEach((k,i) => out[k] = res[i]);
  const falhou = Object.values(out).find(r => r && r.error);
  if (falhou) throw falhou.error;

  gestao.ficha.ocorr   = out.ocorr?.data || [];
  gestao.ficha.acessos = out.acessos.data || [];
  gestao.ficha.avals   = out.avals.data || [];
  gestao.ficha.aponts  = await juntarCabecalhos(out.aponts.data || []);
  gestao.ficha.pess    = out.pess ? (out.pess.data || null) : null;
  /* os treinamentos (v24) vêm à parte: sem a migração, a ficha abre do
     mesmo jeito, só sem a aba */
  const [tr, co] = await Promise.all([
    sb.rpc('treinamentos_de', { p_reg: reg }),
    sb.from('treinamento_conclusoes').select('*').eq('registro', reg).order('concluido_em', { ascending:false })]);
  gestao.ficha.treinos = tr.error || !Array.isArray(tr.data) ? null : tr.data;
  gestao.ficha.concl   = co.error ? [] : (co.data || []);
}
/* Anexa {apont:{grupo,responsavel}} aos itens buscando os cabeçalhos por
   id. A junção é feita no cliente porque a consulta aninhada do PostgREST
   depende da foreign key declarada — quando ela falta, a consulta inteira
   falha e a ficha aparecia sem os resultados. */
async function juntarCabecalhos(itens){
  const ids = [...new Set(itens.map(x => x.apontamento_id).filter(Boolean))];
  if (!ids.length) return itens.map(x => ({ apont:null, ...x }));
  const { data, error } = await sb.from('apontamentos').select('id,grupo,responsavel').in('id', ids);
  if (error) throw error;
  const por = new Map((data||[]).map(c => [c.id, c]));
  return itens.map(x => ({ ...x, apont: por.get(x.apontamento_id) || null }));
}

function renderFicha(){
  const m = membroAtual();
  if (!m){
    $('#main').innerHTML = topoGestao({titulo:'Registro não encontrado', voltar:"location.hash='#/equipe/quadro'"})
      + '<div class="empty">Nenhum membro com este número de registro.</div>';
    return;
  }
  const f = gestao.ficha;
  const gestor = m.gestor_registro ? nomeDe(m.gestor_registro) : null;
  const abas = [['dados','Dados']];
  if (podeQuadro()) abas.push(['ocorr', `Ocorrências (${f.ocorr.length})`]);
  abas.push(['acessos','Acessos'], ['avals', `Avaliações (${f.avals.length})`]);
  if (f.treinos) abas.push(['treinos', `Treinamentos (${f.concl.length})`]);
  if (can()) abas.push(['pess','Dados pessoais']);

  $('#main').innerHTML = topoGestao({
    olho: 'Ficha do membro',
    titulo: m.nome,
    voltar: podeQuadro() ? "location.hash='#/equipe/quadro'" : "location.hash='#/equipe'",
    acoes: ibtn('doc','Gerar relatório do membro','relatorioDoMembro()')
      + (can() ? ibtn('pencil','Editar dados',
        "gestao.ficha.editando=true;gestao.ficha.tab='dados';renderFicha()") : '')
  }) + `
    <div class="card" style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:16px">
      <span onclick="alternarCampoFoto()" style="line-height:0;cursor:${f.editando&&f.tab==='dados'?'pointer':'default'}"
        title="${f.editando&&f.tab==='dados'?'Clique para alterar o link da foto':''}">${avatarFoto(m, 52, 17)}</span>
      <div style="flex:1;min-width:220px">
        <div style="font-family:var(--fd);font-size:17px;font-weight:600">${esc(m.nome)}</div>
        <div class="small muted" style="margin-top:3px">
          <span class="mono" style="color:var(--dim)">REG ${pad3(m.registro)}</span>
          · ${esc(m.cargo||'Sem cargo')} · ${esc(m.departamento||'Sem departamento')}${gestor?` · Gestor: ${esc(gestor)}`:''}</div>
        <div style="margin-top:8px">${(m.grupos||[]).map(g=>`<span class="chip mini">${esc(g)}</span>`).join(' ')}</div>
      </div>
      <div>${pill(m.status)}</div>
    </div>
    <nav class="abas">${abas.map(([k,l]) => `<button class="aba ${f.tab===k?'on':''}"
      onclick="gestao.ficha.tab='${k}';gestao.ficha.editando=false;renderFicha()">${l}</button>`).join('')}</nav>
    <div id="ficha-body"></div>${datalistsHTML()}`;

  ({dados:renderTabDados, ocorr:renderTabOcorr, acessos:renderTabAcessos,
    avals:renderTabAvals, pess:renderTabPess, treinos:renderTabTreinos}[f.tab])();
}

/* Os treinamentos da pessoa: o que é obrigatório para ela, onde ela
   está e os certificados. O PDF quem desenha é mod-treinamentos —
   carregado aqui, antes de chamar, porque módulo não depende de módulo. */
function renderTabTreinos(){
  const f = gestao.ficha, ts = (f.treinos || []).filter(t => t.obrigatorio != null || t.situacao !== 'pendente');
  const obrig = ts.filter(t => t.obrigatorio), emDia = obrig.filter(t => t.situacao === 'concluido').length;
  const sit = { pendente:['Não começado','dt-gray',''], andamento:['Em andamento','dt-info','p-info'], concluido:['Concluído','dt-ok','p-ok'],
    nova_revisao:['Nova revisão','dt-warn','p-warn'], vencido:['Vencido','dt-bad','p-bad'] };
  const pl = s => { const [l, dt, c] = sit[s] || [s || '—', 'dt-gray', '']; return `<span class="pill ${c}"><span class="dt ${dt}"></span>${l}</span>`; };
  $('#ficha-body').innerHTML = `<div class="card">
      <div class="head"><h3>Treinamentos</h3><span class="small muted">${obrig.length
        ? `${emDia} de ${obrig.length} obrigatório${obrig.length === 1 ? '' : 's'} em dia` : 'Nenhum treinamento obrigatório para esta pessoa'}</span></div>
      ${ts.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Código</th><th>Treinamento</th><th>Atribuição</th>
        <th>Situação</th><th>Progresso</th><th>Concluído em</th></tr></thead><tbody>${ts.map(t => `<tr>
          <td class="reg">${esc(t.codigo)}</td><td class="nome">${esc(t.titulo)}</td>
          <td>${t.obrigatorio ? 'Obrigatório' : t.obrigatorio === false ? 'Opcional' : '<span class="muted">não atribuído</span>'}</td>
          <td>${pl(t.situacao)}</td><td class="mono small">${t.situacao === 'concluido' ? t.n_modulos : t.feitos}/${t.n_modulos}</td>
          <td>${t.concluido_em ? fmtD(t.concluido_em) : '—'}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty">Nenhum treinamento atribuído aos grupos desta pessoa, e nenhum feito por conta própria.</div>'}
    </div>
    <div class="card" style="margin-top:14px"><h3>Certificados</h3>
      <p class="sub" style="margin-bottom:10px">Cada conclusão, com o que foi concluído na época: o certificado não muda quando o treinamento é revisado</p>
      ${f.concl.length ? f.concl.map(c => `<div class="acc-row">
          <span class="nm">${esc(c.titulo)} <span class="mt">${esc(c.codigo)} · Rev. ${esc(c.revisao)}</span></span>
          <span class="mt">${fmtD(c.concluido_em)}${c.nota != null ? ' · ' + c.nota + '%' : ''}</span>
          <span class="mt">${esc(c.certificado)}</span>
          ${ibtn('down', 'Baixar o certificado', `fichaCertificado('${esc(c.certificado)}', this)`, 'sm')}</div>`).join('')
        : '<div class="empty">Nenhum certificado ainda.</div>'}
    </div>`;
}
async function fichaCertificado(cod, bt){
  try { await carregarModulo('treinamentos'); }
  catch(e){ return falha(e, 'Os treinamentos não carregaram'); }
  treBaixarCertificado(cod, bt);
}

function alternarCampoFoto(){
  if (!can() || !gestao.ficha.editando || gestao.ficha.tab !== 'dados') return;
  const w = $('#field-foto_url'); if (!w) return;
  const abrir = w.style.display === 'none';
  w.style.display = abrir ? '' : 'none';
  if (abrir){ const i = $('#f-foto_url'); if (i){ i.focus(); i.scrollIntoView({block:'center', behavior:'smooth'}); } }
}

function renderTabDados(){
  const m = membroAtual();
  if (gestao.ficha.editando && can()){
    $('#ficha-body').innerHTML = `<div class="card"><h3>Editar dados institucionais</h3>
      <p class="sub" style="margin-bottom:18px">Toda alteração fica na trilha de auditoria</p>
      <div class="form-grid">${CAMPOS_MEMBRO.map(c =>
        `<div class="fld ${c.full?'full':''}"${c.k==='foto_url'?' id="field-foto_url" style="display:none"':''}>
          <label>${c.l}</label>${campoInput(c, m[c.k], m.registro)}</div>`).join('')}</div>
      <div class="acts" style="justify-content:flex-end">
        <button class="btn ghost" onclick="gestao.ficha.editando=false;renderFicha()">Cancelar</button>
        <button class="btn solid" onclick="salvarMembro()">${ic('check')} Salvar</button></div>
      <p class="small muted" style="margin-top:14px;line-height:1.6">Para alterar o link da foto, clique no
        avatar acima. Mudanças de status, cargo, departamento, grupos e gestor também geram ocorrências.</p></div>`;
    return;
  }
  $('#ficha-body').innerHTML = `<div class="card"><div class="dl">
    ${CAMPOS_MEMBRO.filter(c => !['nome','status','foto_url'].includes(c.k)).map(c => {
      let v = m[c.k];
      if (c.t === 'grupos')      v = (v && v.length) ? v.join(', ') : null;
      else if (c.t === 'date')   v = v ? fmtD(v) : null;
      else if (c.t === 'gestor') v = v ? nomeDe(v) : null;
      return `<div class="it"><dt>${c.l}</dt>
        <dd>${esc(v) || '<span class="muted">—</span>'}</dd></div>`;
    }).join('')}
    <div class="it"><dt>Cadastro atualizado em</dt><dd>${fmtDT(m.atualizado_em)}</dd></div>
  </div></div>`;
}

async function salvarMembro(){
  const m = membroAtual();
  const novo = lerCampos(CAMPOS_MEMBRO);
  if (!novo.nome) return toast('O nome é obrigatório.', true);
  if (['Desligado','Egresso'].includes(novo.status) && !novo.data_desligamento) novo.data_desligamento = hojeISO();
  try{
    const { error } = await sb.from('membros').update(novo).eq('registro', m.registro);
    if (error) throw error;
    const ocs = [];
    const oc = (tipo, descricao) => ocs.push({ registro:m.registro, tipo, descricao, responsavel:quemSouEu(), data:hojeISO() });
    if (novo.status !== m.status)
      oc(['Desligado','Egresso'].includes(novo.status) ? 'Desligamento' : 'Mudança de status',
         `De "${m.status||'—'}" para "${novo.status}".`);
    if (novo.cargo !== m.cargo) oc('Mudança de cargo', `De "${m.cargo||'—'}" para "${novo.cargo||'—'}".`);
    if (novo.departamento !== m.departamento)
      oc('Mudança de departamento', `De "${m.departamento||'—'}" para "${novo.departamento||'—'}".`);
    if ((novo.gestor_registro||null) !== (m.gestor_registro||null))
      oc('Mudança de gestão', `De "${m.gestor_registro?nomeDe(m.gestor_registro):'—'}" para "${novo.gestor_registro?nomeDe(novo.gestor_registro):'—'}".`);
    const antes = m.grupos||[], depois = novo.grupos||[];
    const add = depois.filter(g=>!antes.includes(g)), rem = antes.filter(g=>!depois.includes(g));
    if (add.length) oc('Adição a grupo', add.join(', '));
    if (rem.length) oc('Remoção de grupo', rem.join(', '));
    if (ocs.length){ const r = await sb.from('ocorrencias').insert(ocs); if (r.error) throw r.error; }
    Object.assign(m, novo);
    gestao.ficha.editando = false;
    await carregarFicha(); renderFicha();
    toast('Dados salvos.');
  }catch(e){ falha(e, 'Erro ao salvar'); }
}

function modalMembro(){
  const prox = state.membros.length ? Math.max(...state.membros.map(x=>x.registro)) + 1 : 1;
  abreModal(`<h3>Novo membro</h3>
    <div class="form-grid">
      <div class="fld"><label>Nº de registro</label><input id="f-registro" type="number" value="${prox}"></div>
      ${CAMPOS_MEMBRO.map(c => `<div class="fld ${c.full?'full':''}"${c.k==='foto_url'?' style="display:none"':''}>
        <label>${c.l}</label>${campoInput(c, c.k==='status' ? 'Ativo' : (c.k==='data_ingresso' ? hojeISO() : null), null)}</div>`).join('')}
    </div>${datalistsHTML()}
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="criarMembro()">Cadastrar</button></div>`, true);
}
async function criarMembro(){
  const novo = lerCampos(CAMPOS_MEMBRO);
  novo.registro = parseInt(document.getElementById('f-registro').value, 10);
  if (!novo.registro || !novo.nome) return toast('Registro e nome são obrigatórios.', true);
  if (state.membros.some(x => x.registro === novo.registro))
    return toast('Já existe um membro com esse número de registro.', true);
  try{
    const { error } = await sb.from('membros').insert(novo); if (error) throw error;
    await sb.from('ocorrencias').insert({ registro:novo.registro, tipo:'Ingresso',
      descricao:`Ingresso via ${novo.forma_ingresso || 'cadastro manual'}.`,
      responsavel:quemSouEu(), data:novo.data_ingresso || hojeISO() });
    state.membros.push(novo);
    state.membros.sort((a,b) => String(a.nome).localeCompare(String(b.nome),'pt-BR'));
    fechaModal(); toast('Membro cadastrado.');
    abrirFicha(novo.registro);
  }catch(e){ falha(e, 'Erro ao cadastrar'); }
}

/* --- aba: ocorrências --- */
function renderTabOcorr(){
  const f = gestao.ficha;
  $('#ficha-body').innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
      <div><h3>Linha do tempo</h3><p class="sub">Tudo o que aconteceu com este registro</p></div>
      ${can() ? ibtn('plus','Registrar ocorrência', `modalOcorrencia(${f.reg})`, 'primary sm') : ''}
    </div>
    ${f.ocorr.length ? `<div class="timeline">${f.ocorr.map(o=>`
      <div class="tl-item"><div class="dt">${fmtD(o.data)}</div>
        <div class="tp">${esc(o.tipo)}</div>
        ${o.descricao ? `<div class="ds">${esc(o.descricao)}</div>` : ''}
        <div class="rp">Registrado por ${esc(o.responsavel||'—')}${can()
          ? ` · <a href="#" onclick="excluirOcorrencia('${o.id}');return false">excluir</a>` : ''}</div>
      </div>`).join('')}</div>`
    : '<div class="empty">Nenhuma ocorrência registrada para este membro.</div>'}
  </div>`;
}
function modalOcorrencia(reg){
  abreModal(`<h3>Registrar ocorrência</h3>
    <div class="fld"><label>Tipo</label><select id="oc-tipo">${
      gestao.tiposOcorrencia.map(t=>`<option>${esc(t.nome)}</option>`).join('')
      || '<option>Outro</option>'}</select></div>
    <div class="fld"><label>Data</label><input id="oc-data" type="date" value="${hojeISO()}"></div>
    <div class="fld"><label>Descrição</label>
      <textarea id="oc-desc" rows="3" placeholder="Contexto, decisão, encaminhamento…"></textarea></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="salvarOcorrencia(${reg})">Registrar</button></div>`);
}
async function salvarOcorrencia(reg){
  try{
    const { error } = await sb.from('ocorrencias').insert({ registro:reg, tipo:$('#oc-tipo').value,
      data:$('#oc-data').value || hojeISO(), descricao:$('#oc-desc').value.trim() || null,
      responsavel:quemSouEu() });
    if (error) throw error;
    fechaModal(); toast('Ocorrência registrada.');
    await carregarFicha(); renderFicha();
  }catch(e){ falha(e, 'Erro ao registrar'); }
}
async function excluirOcorrencia(id){
  if (!await confirma('Excluir esta ocorrência? A exclusão fica registrada na auditoria.', 'Excluir')) return;
  try{
    const { error } = await sb.from('ocorrencias').delete().eq('id', id); if (error) throw error;
    await carregarFicha(); renderFicha(); toast('Ocorrência excluída.');
  }catch(e){ falha(e, 'Erro ao excluir'); }
}

/* --- aba: acessos --- */
function renderTabAcessos(){
  const f = gestao.ficha, m = membroAtual();
  const conc = new Map(f.acessos.map(a => [a.item_id, a]));
  const ativos = f.acessos.filter(a => a.ativo);
  const desligado = ['Desligado','Egresso'].includes(m.status);
  const itensCat = state.itensAcesso || [];
  $('#ficha-body').innerHTML = `
    ${desligado && ativos.length ? `<div class="aviso-box err"><b>Checklist de revogação:</b>
      membro com status "${esc(m.status)}" e ${ativos.length} acesso(s) ativo(s).
      ${can() ? `<button class="btn perigo" style="height:30px;padding:0 12px;font-size:12px;margin-left:8px"
        onclick="revogarTodos()">Revogar todos</button>` : ''}</div>` : ''}
    <div class="card">
    ${['documento','local','sistema'].map(cat => {
      const itens = itensCat.filter(i => i.categoria === cat && (i.ativo || conc.has(i.id)));
      if (!itens.length) return '';
      return `<div class="acc-group"><h4>${CAT_LABEL[cat]}</h4>
        ${itens.map(i => {
          const a = conc.get(i.id);
          let st, mt;
          if (a && a.ativo){
            st = `<span class="pill p-ok"><span class="dt dt-ok"></span>Concedido</span>`;
            mt = `${a.concedido_em ? 'desde '+fmtD(a.concedido_em) : ''}${a.responsavel ? ' · por '+esc(a.responsavel) : ''}`;
          } else if (a){
            st = `<span class="pill"><span class="dt dt-gray"></span>Revogado</span>`;
            mt = `${a.revogado_em ? 'em '+fmtD(a.revogado_em) : ''}${a.responsavel ? ' · por '+esc(a.responsavel) : ''}`;
          } else { st = `<span class="muted small">Não concedido</span>`; mt = ''; }
          const btn = !can() ? '' : (a && a.ativo
            ? ibtn('x','Revogar acesso', `revogarAcesso('${a.id}')`, 'perigo sm')
            : ibtn('key','Conceder acesso', `concederAcesso('${i.id}')`, 'sm'));
          return `<div class="acc-row"><div class="nm">${esc(i.nome)}</div><div class="mt">${mt}</div>
            <div style="display:flex;align-items:center;gap:8px">${st} ${btn}</div></div>`;
        }).join('')}</div>`;
    }).join('') || '<div class="empty">O catálogo de acessos está vazio.</div>'}
    </div>`;
}
async function concederAcesso(itemId){
  try{
    const { error } = await sb.from('acessos_concedidos').upsert({ registro:gestao.ficha.reg, item_id:itemId,
      ativo:true, concedido_em:hojeISO(), revogado_em:null, responsavel:quemSouEu() },
      { onConflict:'registro,item_id' });
    if (error) throw error;
    await carregarFicha(); renderFicha(); toast('Acesso concedido.');
  }catch(e){ falha(e, 'Erro ao conceder'); }
}
async function revogarAcesso(id){
  try{
    const { error } = await sb.from('acessos_concedidos')
      .update({ ativo:false, revogado_em:hojeISO(), responsavel:quemSouEu() }).eq('id', id);
    if (error) throw error;
    await carregarFicha(); renderFicha(); toast('Acesso revogado.');
  }catch(e){ falha(e, 'Erro ao revogar'); }
}
async function revogarTodos(){
  const n = gestao.ficha.acessos.filter(a => a.ativo).length;
  if (!await confirma(`Revogar os ${n} acessos ativos deste membro?`, 'Revogar todos')) return;
  try{
    const { error } = await sb.from('acessos_concedidos')
      .update({ ativo:false, revogado_em:hojeISO(), responsavel:quemSouEu() })
      .eq('registro', gestao.ficha.reg).eq('ativo', true);
    if (error) throw error;
    await carregarFicha(); renderFicha(); toast('Todos os acessos foram revogados.');
  }catch(e){ falha(e, 'Erro ao revogar'); }
}

/* --- aba: avaliações --- */
function cicloAtual(){ const d = new Date(); return d.getFullYear() + '/' + (d.getMonth() < 6 ? '1' : '2'); }
function renderTabAvals(){
  const f = gestao.ficha;
  const score = (n, l) => n == null ? ''
    : `<span class="score"><span class="light ${n<=2?'lt-bad':'lt-ok'}"></span>${l} ${n}/5</span>`;
  const luz = (v) => v == null ? `<span class="light lt-off"></span>`
    : `<span class="light ${v==='SUFICIENTE'?'lt-ok':'lt-bad'}" title="${v}"></span>`;
  const insuf = f.aponts.filter(a => a.assiduidade==='INSUFICIENTE' || a.entregas==='INSUFICIENTE').length;

  $('#ficha-body').innerHTML = `<div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
      <div><h3>Avaliações periódicas</h3><p class="sub">Um registro por ciclo</p></div>
      ${ibtn('plus','Nova avaliação', `modalAval(${f.reg})`, 'primary sm')}
    </div>
    ${f.avals.length ? f.avals.map(a => `
      <div class="aval-card"><div class="hd">
        <div><b>Ciclo ${esc(a.ciclo)}</b>
          <span class="muted small">· ${fmtD(a.data)} · por ${esc(a.responsavel||'—')}</span></div>
        <div>${score(a.assiduidade,'Assiduidade')}${score(a.comprometimento,'Comprometimento')}</div></div>
        ${a.apontamentos ? `<div class="small" style="line-height:1.55;white-space:pre-wrap;color:var(--muted)">${esc(a.apontamentos)}</div>` : ''}
        ${a.encaminhar_pessoal ? `<div style="margin-top:9px"><span class="pill ${a.tratado?'':'p-warn'}">
          <span class="dt ${a.tratado?'dt-gray':'dt-warn'}"></span>${a.tratado?'Tratado pelo Depto. de Pessoal':'Encaminhado — pendente'}</span></div>` : ''}
      </div>`).join('')
    : '<div class="empty">Nenhuma avaliação registrada.</div>'}
  </div>
  <div class="card"><h3>Apontamentos semanais recentes</h3>
    ${f.aponts.length ? `<p class="sub" style="margin-bottom:14px">${insuf
        ? `${insuf} de ${f.aponts.length} com resultado insuficiente`
        : `Todos os ${f.aponts.length} com resultado suficiente`}</p>
    <div class="wrap"><table class="tabela trabalho">
      <thead><tr><th>Data</th><th>Grupo</th><th>Assiduidade</th><th>Entregas</th>
        <th>Sinalização</th><th>Liderança</th></tr></thead>
      <tbody>${f.aponts.map(a => `<tr>
        <td>${fmtD(a.data)}</td><td>${esc(a.apont?.grupo||'—')}</td>
        <td>${luz(a.assiduidade)}</td><td>${luz(a.entregas)}</td>
        <td>${a.sinalizado ? `<span class="pill ${a.tratado?'':'p-bad'}">
          <span class="dt ${a.tratado?'dt-gray':'dt-bad'}"></span>${a.tratado?'Tratada':'Pendente'}</span>` : '<span class="muted">—</span>'}</td>
        <td>${esc(a.apont?.responsavel||'—')}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty">Nenhum apontamento semanal ainda. As lideranças os registram em Operações → Apontamento semanal.</div>'}
  </div>`;
}
function modalAval(reg){
  const notas = (id) => `<select id="${id}"><option value="">—</option>${[1,2,3,4,5].map(n=>`<option>${n}</option>`).join('')}</select>`;
  abreModal(`<h3>Nova avaliação</h3>
    <div class="form-grid">
      <div class="fld"><label>Ciclo</label><input id="av-ciclo" value="${cicloAtual()}"></div>
      <div class="fld"><label>Assiduidade (1 a 5)</label>${notas('av-assid')}</div>
      <div class="fld"><label>Comprometimento (1 a 5)</label>${notas('av-comp')}</div>
      <div class="fld full"><label>Apontamentos e circunstâncias</label>
        <textarea id="av-apont" rows="3" placeholder="Contexto relevante para o Depto. de Pessoal…"></textarea></div>
      <div class="fld full"><label class="check"><input type="checkbox" id="av-enc">
        Encaminhar ao Depto. de Pessoal para conversa</label></div>
    </div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="salvarAval(${reg})">Registrar</button></div>`, true);
}
async function salvarAval(reg){
  try{
    const v = (id) => { const x = $('#'+id).value; return x === '' ? null : parseInt(x, 10); };
    const { error } = await sb.from('avaliacoes').insert({ registro:reg,
      ciclo:$('#av-ciclo').value.trim() || cicloAtual(),
      assiduidade:v('av-assid'), comprometimento:v('av-comp'),
      apontamentos:$('#av-apont').value.trim() || null,
      encaminhar_pessoal:$('#av-enc').checked, responsavel:quemSouEu() });
    if (error) throw error;
    fechaModal(); toast('Avaliação registrada.');
    await carregarFicha(); renderFicha();
  }catch(e){ falha(e, 'Erro ao registrar'); }
}

/* --- aba: dados pessoais --- */
function renderTabPess(){
  const p = gestao.ficha.pess;
  if (gestao.ficha.editando){
    $('#ficha-body').innerHTML = `<div class="card"><h3>Editar dados pessoais</h3>
      <div class="form-grid" style="margin-top:16px">${CAMPOS_PESS.map(c =>
        `<div class="fld ${c.full?'full':''}"><label>${c.l}</label>${campoInput(c, p ? p[c.k] : null, null)}</div>`).join('')}</div>
      <div class="acts" style="justify-content:flex-end">
        <button class="btn ghost" onclick="gestao.ficha.editando=false;renderFicha()">Cancelar</button>
        <button class="btn solid" onclick="salvarPess()">Salvar</button></div></div>`;
    return;
  }
  $('#ficha-body').innerHTML = `<div class="card">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:16px">
      <div><h3>Dados pessoais</h3><p class="sub">Sob a LGPD</p></div>
      ${ibtn('pencil','Editar dados pessoais', "gestao.ficha.editando=true;renderFicha()", 'sm')}</div>
    <div class="aviso-box warn">Dados sensíveis sob a LGPD — visíveis apenas para a Diretoria e o
      Depto. de Pessoal. Não inclua estes campos em relatórios ou comunicações.</div>
    ${p ? `<div class="dl">${CAMPOS_PESS.map(c => {
        let v = p[c.k];
        if (c.t === 'date') v = v ? fmtD(v) : null;
        if (c.t === 'bool') v = v === true ? 'Sim' : v === false ? 'Não' : null;
        return `<div class="it${c.full?' full':''}"><dt>${c.l}</dt>
          <dd>${esc(v) || '<span class="muted">—</span>'}</dd></div>`;
      }).join('')}</div>`
    : '<div class="empty">Nenhum dado pessoal cadastrado. Edite aqui ou importe a aba FORM da planilha.</div>'}
  </div>`;
}
async function salvarPess(){
  try{
    const o = lerCampos(CAMPOS_PESS); o.registro = gestao.ficha.reg;
    const { error } = await sb.from('dados_pessoais').upsert(o, { onConflict:'registro' });
    if (error) throw error;
    gestao.ficha.editando = false;
    await carregarFicha(); renderFicha(); toast('Dados pessoais salvos.');
  }catch(e){ falha(e, 'Erro ao salvar'); }
}

/* ============================================================
   #/auditoria — trilha
   ============================================================ */
async function pageAuditoria(){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando a trilha de auditoria…</div>`;
  try{
    await gestaoCarregar();
    const { data, error } = await sb.from('auditoria').select('*')
      .order('ocorrido_em',{ascending:false}).limit(400);
    if (error) throw error;
    gestao.aud = data || [];
    const tabelas = [...new Set(gestao.aud.map(r => r.tabela))];
    $('#main').innerHTML = topoGestao({
      olho: 'Trilha de auditoria',
      titulo: 'Auditoria',
      lead: 'Quem mudou o quê, quando — os últimos 400 eventos registrados pelo banco.'
    }) + `
      <div class="filtros">
        <div class="fld cresce"><label>Buscar</label>
          <input id="au-q" placeholder="Campo, valor, responsável ou membro" oninput="renderTabelaAud()"></div>
        <div class="fld"><label>Tabela</label><select id="au-tb" onchange="renderTabelaAud()">
          <option value="">Todas</option>${tabelas.map(t=>`<option value="${t}">${TAB_LABEL[t]||t}</option>`).join('')}</select></div>
      </div>
      <div class="card" style="padding:8px 14px"><div id="tb-aud"></div></div>`;
    renderTabelaAud();
  }catch(e){
    $('#main').innerHTML = topoGestao({titulo:'Auditoria indisponível'})
      + `<div class="aviso-box err">Não foi possível carregar a trilha: ${esc(e.message)}</div>`;
  }
}
function nomePorRef(ref){
  const n = parseInt(ref, 10);
  if (!isNaN(n) && String(n) === String(ref)){
    const m = state.membros.find(x => x.registro === n); if (m) return m.nome;
  }
  return null;
}
function renderTabelaAud(){
  const q = norm($('#au-q')?.value), tb = $('#au-tb')?.value;
  const rows = gestao.aud.filter(r =>
    (!tb || r.tabela === tb) &&
    (!q || [r.campo, r.valor_anterior, r.valor_novo, r.responsavel_email, r.registro_ref, nomePorRef(r.registro_ref)]
      .some(v => v && norm(v).includes(q))));
  const OP = {INSERT:'Criação', UPDATE:'Alteração', DELETE:'Exclusão'};
  $('#tb-aud').innerHTML = rows.length ? `
    <div class="wrap"><table class="tabela trabalho fixa">
      <thead><tr><th style="width:132px">Quando</th><th>Responsável</th><th style="width:110px">Tabela</th>
        <th>Registro</th><th style="width:92px">Ação</th><th>Campo</th><th>De</th><th>Para</th></tr></thead>
      <tbody>${rows.slice(0,200).map(r => {
        const nm = nomePorRef(r.registro_ref);
        return `<tr><td>${fmtDT(r.ocorrido_em)}</td>
          <td title="${esc(r.responsavel_email||'')}">${esc(r.responsavel_email||'sistema')}</td>
          <td>${TAB_LABEL[r.tabela] || esc(r.tabela)}</td>
          <td>${nm ? esc(nm) : `<span class="reg">${esc(String(r.registro_ref||'').slice(0,8))}</span>`}</td>
          <td>${OP[r.operacao] || esc(r.operacao)}</td>
          <td>${esc(r.campo||'—')}</td>
          <td title="${esc(r.valor_anterior)}">${esc(r.valor_anterior) || '—'}</td>
          <td title="${esc(r.valor_novo)}">${esc(r.valor_novo) || '—'}</td></tr>`;
      }).join('')}</tbody></table></div>
    <div class="small muted" style="padding:10px 4px">Exibindo ${Math.min(rows.length,200)} de ${rows.length} eventos</div>`
    : '<div class="empty">Nenhum evento encontrado.</div>';
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'quadro', rotulo:'No quadro',
  buscar: (t) => {
    if (!podeQuadro()) return [];
    return filtrarSimples(state.membros.map(m => ({
      titulo: m.nome,
      sub: `${m.status}${m.cargo ? ' · ' + m.cargo : ''}`,
      codigo: pad3(m.registro),
      href: '#/equipe/' + m.registro
    })), t, 6);
  }
});

/* ============================================================
   APONTAMENTO SEMANAL — aba de Equipe
   ============================================================ */
/* ---------------- apontamento semanal ---------------- */
function pageApontamento(){
  const topo = topoGestao({ olho:'Equipe', titulo:'Apontamento semanal',
    lead:'Avaliação rápida de assiduidade e entregas do seu grupo, com sinalização ao Depto. de Pessoal.'
  }) + abasEquipe('apontamento');
  if(!gestao.apont){
    const gs = todosGrupos();
    $('#main').innerHTML = topo + `<div class="card" style="max-width:560px">
      <h3>Iniciar apontamento</h3>
      <p class="small muted" style="line-height:1.6;margin-bottom:14px">Selecione o grupo sob a sua liderança.
      Serão listados os membros ativos e em pausa, para avaliar <b>assiduidade</b> e <b>entregas</b> da semana e,
      se necessário, <b>sinalizar</b> alguém para o Depto de Pessoal.</p>
      ${gs.length?`<div class="fld"><label>Grupo</label><select id="ap-grupo">${gs.map(g=>`<option>${esc(g)}</option>`).join('')}</select></div>
      <button class="btn solid" onclick="iniciarApontamento()">${ic('fwd')} Iniciar</button>`
      :'<div class="empty">Nenhum grupo cadastrado no quadro.</div>'}
    </div>`;
    return;
  }
  renderApontamentoLista();
}
function iniciarApontamento(){
  const g = $('#ap-grupo').value;
  const itens = state.membros
    .filter(m=>['Ativo','Em pausa / avaliação'].includes(m.status) && gruposEfetivos(m).has(g))
    .filter(m=>m.registro !== state.perfil?.registro)
    .sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR'))
    .map(m=>({registro:m.registro, nome:m.nome, cargo:m.cargo, status:m.status,
      assiduidade:'SUFICIENTE', entregas:'SUFICIENTE', sinalizado:false, justificativa:null, abrirOcorrencia:false}));
  if(!itens.length){ toast('Esse grupo não tem membros ativos ou em pausa.', true); return; }
  gestao.apont = {grupo:g, itens};
  renderApontamentoLista();
}
function segNota(i, campo){
  const v = gestao.apont.itens[i][campo];
  return `<span class="seg">
    <button class="${v==='SUFICIENTE'?'on-ok':''}" onclick="setNota(${i},'${campo}','SUFICIENTE')"><span class="light ${v==='SUFICIENTE'?'lt-ok':'lt-off'}"></span>Suficiente</button>
    <button class="${v==='INSUFICIENTE'?'on-bad':''}" onclick="setNota(${i},'${campo}','INSUFICIENTE')"><span class="light ${v==='INSUFICIENTE'?'lt-bad':'lt-off'}"></span>Insuficiente</button>
  </span>`;
}
function setNota(i, campo, v){ gestao.apont.itens[i][campo]=v; renderApontamentoLista(); }
function renderApontamentoLista(){
  const topo = topoGestao({ olho:'Equipe', titulo:'Apontamento semanal' }) + abasEquipe('apontamento');
  const a = gestao.apont;
  const nSin = a.itens.filter(x=>x.sinalizado).length;
  $('#main').innerHTML = topo + `
    <div class="card" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
      <div style="flex:1;min-width:220px"><b>Grupo:</b> ${esc(a.grupo)} <span class="muted small">· ${a.itens.length} membro(s) · ${fmtD(hojeISO())}</span></div>
      <button class="btn" onclick="gestao.apont=null;pageApontamento()">Trocar grupo</button>
      <button class="btn solid" onclick="salvarApontamento()">${ic('check')} Registrar apontamento</button>
    </div>
    ${nSin?`<div class="aviso-box warn">${nSin} membro(s) sinalizado(s) — o Depto de Pessoal será notificado no painel.</div>`:''}
    <div class="card" style="padding:6px 14px">
      <table class="tabela trabalho"><thead><tr><th>Reg.</th><th>Membro</th><th>Assiduidade</th><th>Entregas</th><th style="text-align:right">Sinalizar</th></tr></thead>
      <tbody>${a.itens.map((it,i)=>`<tr>
        <td class="reg">${pad3(it.registro)}</td>
        <td><span style="font-weight:600">${esc(it.nome)}</span><br><span class="small muted">${esc(it.cargo||'—')}${it.status!=='Ativo'?' · '+esc(it.status):''}</span>
          ${it.sinalizado?`<br><span class="small" style="color:var(--bad)">⚑ ${esc(it.justificativa)}</span>`:''}</td>
        <td>${segNota(i,'assiduidade')}</td>
        <td>${segNota(i,'entregas')}</td>
        <td style="text-align:right">${ibtn('flag', it.sinalizado?'Remover sinalização':'Sinalizar para o Depto de Pessoal', `clicarFlag(${i})`, it.sinalizado?'danger':'')}</td>
      </tr>`).join('')}</tbody></table>
    </div>`;
}
async function clicarFlag(i){
  const it = gestao.apont.itens[i];
  if(it.sinalizado){ it.sinalizado=false; it.justificativa=null; it.abrirOcorrencia=false; renderApontamentoLista(); return; }
  let recentes = [];
  try{
    const desde = new Date(Date.now()-30*864e5).toISOString().slice(0,10);
    const {data} = await sb.from('apontamento_itens').select('data').eq('registro',it.registro)
      .eq('sinalizado',true).gte('data',desde).order('data',{ascending:false});
    recentes = data||[];
  }catch(e){ /* segue sem histórico */ }
  const reinc = recentes.length>0;
  abreModal(`<h3>Sinalizar ${esc(it.nome)}</h3>
    ${reinc?`<div class="aviso-box warn"><b>Sinalização reincidente:</b> a última foi em ${fmtD(recentes[0].data)},
      dentro da janela de 30 dias. Você pode abrir uma ocorrência formal junto com esta sinalização —
      nesses casos, o Depto de Pessoal agenda uma reunião com o membro.</div>`
    :`<div class="aviso-box info">Primeira sinalização recente. O Depto de Pessoal será orientado a <b>fazer contato</b> com o membro para avaliar o comprometimento e dialogar.</div>`}
    <div class="fld"><label>Justificativa</label><select id="sn-just">${JUSTIFICATIVAS.map(j=>`<option>${j}</option>`).join('')}</select></div>
    <div class="fld"><label>Detalhes (opcional)</label><textarea id="sn-det" placeholder="Contexto que ajude o Depto de Pessoal…"></textarea></div>
    ${reinc?`<div class="fld"><label class="check"><input type="checkbox" id="sn-oc" checked> Abrir ocorrência de "Sinalização reincidente" na ficha do membro</label></div>`:''}
    <div class="acts" style="justify-content:flex-end"><button class="btn" onclick="fechaModal()">Cancelar</button>
    <button class="btn solid" onclick="confirmarSinalizacao(${i}, ${reinc})">${ic('flag')} Sinalizar</button></div>`);
}
function confirmarSinalizacao(i, reinc){
  const it = gestao.apont.itens[i];
  const det = $('#sn-det').value.trim();
  it.sinalizado = true;
  it.justificativa = $('#sn-just').value + (det? ' — '+det : '');
  it.abrirOcorrencia = reinc && $('#sn-oc') ? $('#sn-oc').checked : false;
  fechaModal(); renderApontamentoLista();
}
async function salvarApontamento(){
  const a = gestao.apont; if(!a) return;
  try{
    const {data:cab, error} = await sb.from('apontamentos')
      .insert({grupo:a.grupo, data:hojeISO(), responsavel:quemSouEu(), responsavel_id:state.perfil.id})
      .select('id').single();
    if(error) throw error;
    const itens = a.itens.map(it=>({apontamento_id:cab.id, registro:it.registro, data:hojeISO(),
      assiduidade:it.assiduidade, entregas:it.entregas, sinalizado:it.sinalizado, justificativa:it.justificativa}));
    const r = await sb.from('apontamento_itens').insert(itens);
    if(r.error) throw r.error;
    const ocs = a.itens.filter(it=>it.abrirOcorrencia).map(it=>({registro:it.registro,
      tipo:'Sinalização reincidente', descricao:it.justificativa, responsavel:quemSouEu(), data:hojeISO()}));
    if(ocs.length){ const r2 = await sb.from('ocorrencias').insert(ocs); if(r2.error) throw r2.error; }
    const nSin = a.itens.filter(x=>x.sinalizado).length;
    gestao.apont = null;
    $('#main').innerHTML = topo + `<div class="card" style="max-width:560px;text-align:center;padding:36px">
      <div class="sq" style="width:52px;height:52px;border-radius:16px;background:var(--soft);color:var(--green);display:inline-flex;align-items:center;justify-content:center;margin-bottom:14px">${ic('check')}</div>
      <h3 style="margin-bottom:8px">Apontamento registrado</h3>
      <p class="small muted" style="line-height:1.6;margin-bottom:18px">Grupo ${esc(a.grupo)} · ${a.itens.length} membro(s) avaliado(s)
      ${nSin?` · ${nSin} sinalização(ões) encaminhada(s) ao Depto de Pessoal`:''}${ocs.length?` · ${ocs.length} ocorrência(s) aberta(s)`:''}.</p>
      <div style="display:flex;gap:10px;justify-content:center">
        <button class="btn ghost" onclick="gestao.apont=null;pageApontamento()">Novo apontamento</button>
        <a class="btn solid" href="#/equipe">Voltar à equipe</a></div>
    </div>`;
    toast('Apontamento registrado.');
  }catch(e){ falha(e,'Erro ao registrar o apontamento'); }
}

/* O relatório em PDF mora no módulo de relatórios, que é quem carrega o
   jsPDF. A ficha só pede — e a biblioteca desce na primeira vez. */
async function relatorioDoMembro(){
  if (typeof gerarRelatorioMembro !== 'function'){
    toast('Preparando o relatório…');
    try { await carregarModulo('relatorios'); }
    catch(e){ toast('Não foi possível carregar o gerador de relatório.', true); return; }
  }
  gerarRelatorioMembro();
}
