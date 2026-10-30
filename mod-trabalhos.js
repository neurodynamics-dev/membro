/* ============================================================
   MÓDULO · TRABALHOS (2.23.0)
   Um trabalho é um projeto pequeno: um conjunto de atividades, quase
   sempre passado a trainees, citado pelo número ("o trabalho 5") e sem
   nome, só uma referência. Pode ser um estudo de viabilidade, o começo
   de um projeto, uma etapa de um projeto ou uma campanha.

   A equipe é um grupo (NRO_TRABALHO_<número>, dentro de NRO_TRABALHOS)
   e o kanban é o quadro desse grupo em Atividades, desenhado aqui
   dentro pelo próprio mod-atividades. Os responsáveis cuidam da equipe.
   Gente de fora entra como convidado, com um membro efetivo que
   responde por ela. Os documentos são os arquivos do rol que dizem
   respeito ao trabalho (e links, para o que mora fora).

   Rotas (o roteador de Projetos, mod-projetos, chama pageTrabalhos):
     #/projetos/trabalhos[/novo]    os trabalhos
     #/projetos/alocacao            pessoas e trabalhos: arrastar os rostos
                                    para as linhas, ou a lista por pessoa
     #/projetos/TRB-5               o trabalho: a ficha
     #/projetos/TRB-5/quadro        o quadro (mod-atividades)
     #/projetos/TRB-5/documentos    os documentos

   Precisa da migração db/2.23.0_trabalhos.sql. A ficha do membro
   (mod-gestao) chama trbHabilidadesHTML e modalHabilidades daqui,
   depois de carregarModulo('trabalhos').

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, ic, ibtn, dica, md, mdBarra, confirma, falha,
   motivoRPC, avatarFoto, nomeDe, cabecalho, navNivel1, layoutObjeto,
   spec, estado, carregarModulo, carregarLib, carregarGrupos,
   carregarProjetosEArquivos, desenharMenu, gruposEfetivos, gruposAcima,
   grupoPorId, ehTrainee, logoProjeto, trabalhoGestor, secoesProjetos,
   trabalhosDe, TRB_ABERTO, iconeArquivo.
   ============================================================ */

const trab = {
  lista:[], tconv:[], docs:[], conv:[], hab:new Map(), catalogo:[], rol:null, erro:null, em:0,
  filtro:{ q:'', status:'abertos' },
  aloc:{ visao:'trabalhos', q:'', quem:'trainees', so:'abertos', sel:null, arrastando:null },
  ed:null, eq:null
};
const TRB_TIPOS = { viabilidade:'Estudo de viabilidade', desenvolvimento:'Início de projeto', etapa:'Etapa de projeto',
  campanha:'Campanha', outro:'Outro' };
const TRB_STATUS = { a_iniciar:['A iniciar', 'gray', ''], em_andamento:['Em andamento', 'info', 'p-info'],
  pausado:['Pausado', 'warn', 'p-warn'], concluido:['Concluído', 'ok', 'p-ok'], cancelado:['Cancelado', 'bad', ''] };
const TRB_CENARIO = [['forcas', 'Forças'], ['fraquezas', 'Fraquezas'], ['oportunidades', 'Oportunidades'], ['ameacas', 'Ameaças']];
const TRB_TEXTOS = [['escopo', 'Escopo do trabalho'], ['justificativa', 'Justificativa'], ['entregaveis', 'Entregáveis'],
  ['dependencias', 'Necessidades e dependências'], ['criterios', 'Critérios de sucesso']];
const CONV_MOTIVOS = { integracao:'Integração à equipe', intercambio:'Intercâmbio', convite:'Convite', conveniencia:'Conveniência' };
const TRB_ATIVOS = ['Ativo', 'Em pausa / avaliação'];

const trbEu = () => state.perfil?.registro ?? null;
const trbEuM = () => (state.membros || []).find(m => m.registro === trbEu());
const trbGrupo = t => grupoPorId(t?.grupo_id);
const trbHref = t => '#/projetos/' + t.codigo;
const trbPill = st => { const x = TRB_STATUS[st] || TRB_STATUS.a_iniciar;
  return `<span class="pill ${x[2]}"><span class="dt dt-${x[1]}"></span>${x[0]}</span>`; };
const trbProjeto = t => (state.projetos || []).find(p => p.id === t.projeto_id) || null;
/* a mesma regra de trabalho_pode_editar(): a gestão, os responsáveis e
   quem responde pelo grupo do trabalho ou por um acima dele */
function trbPodeEditar(t){
  if (trabalhoGestor()) return true;
  const eu = trbEu(); if (eu == null) return false;
  return (t.responsaveis || []).includes(eu) || gruposAcima(trbGrupo(t)).some(g => (g.responsaveis || []).includes(eu));
}
const trbDaEquipe = (t, m) => !!trbGrupo(t) && gruposEfetivos(m).has(trbGrupo(t).nome);
const trbPodeDoc = t => trbPodeEditar(t) || trbDaEquipe(t, trbEuM());
const trbPodeConvidar = () => trabalhoGestor() || trab.lista.some(t => (t.responsaveis || []).includes(trbEu()));

/* a equipe: quem está no grupo (contando subgrupos), os responsáveis primeiro */
function trbEquipe(t){
  const g = trbGrupo(t); if (!g) return [];
  const resp = t.responsaveis || [];
  return (state.membros || []).filter(m => TRB_ATIVOS.includes(m.status) && gruposEfetivos(m).has(g.nome))
    .sort((a, b) => (resp.includes(b.registro) - resp.includes(a.registro)) || (resp.indexOf(a.registro) - resp.indexOf(b.registro))
      || a.nome.localeCompare(b.nome, 'pt-BR'));
}
const trbConvidados = t => trab.tconv.filter(x => x.trabalho_id === t.id)
  .map(x => trab.conv.find(c => c.id === x.convidado_id)).filter(c => c && c.ativo);
const trbDoConvidado = c => trab.tconv.filter(x => x.convidado_id === c.id).map(x => trab.lista.find(t => t.id === x.trabalho_id)).filter(Boolean);
const trbHab = reg => trab.hab.get(reg) || { tem:[], quer:[] };
const nomeCurto = n => { const p = String(n || '').trim().split(/\s+/); return p.length > 1 ? p[0] + ' ' + p[p.length - 1] : p[0] || ''; };
/* o convidado no lugar de um membro: o avatar lê nome e foto_url */
const convAvatar = (c, px, fs) => avatarFoto({ nome:c.nome, foto_url:c.foto_url }, px, fs);

/* ---------------- carga ---------------- */
async function trbCarregar(forcar){
  if (!forcar && trab.em && Date.now() - trab.em < 15000) return;
  const [t, tc, d, h, c, cat] = await Promise.all([
    sb.from('trabalhos').select('*').order('numero'),
    sb.from('trabalho_convidados').select('*'),
    sb.from('trabalho_documentos').select('*').order('ordem'),
    sb.from('membro_habilidades').select('*'),
    sb.rpc('convidados_lista'),
    sb.from('ps_competencias').select('grupo,nome,ativa,ordem').order('ordem')
  ]);
  if (t.error){ trab.erro = t.error; return; }
  trab.erro = null; trab.em = Date.now();
  trab.lista = (t.data || []).sort((a, b) => a.numero - b.numero);
  trab.tconv = tc.data || [];
  trab.docs = d.data || [];
  trab.hab = new Map((h.data || []).map(x => [x.registro, x]));
  trab.conv = Array.isArray(c.data) ? c.data : [];
  trab.catalogo = cat.error ? [] : (cat.data || []).filter(x => x.ativa !== false);
  /* o menu e a busca leem a lista da casca: fica igual à daqui */
  state.trabalhos = trab.lista.map(x => ({ id:x.id, numero:x.numero, codigo:x.codigo, referencia:x.referencia, tipo:x.tipo,
    status:x.status, grupo_id:x.grupo_id, projeto_id:x.projeto_id, responsaveis:x.responsaveis }));
  desenharMenu();
}
async function trbRecarregarFichas(){
  const r = await sb.from('membros').select('registro,grupos');
  (r.data || []).forEach(x => { const m = (state.membros || []).find(y => y.registro === x.registro); if (m) m.grupos = x.grupos; });
  desenharMenu();
}

/* ---------------- rota ---------------- */
async function pageTrabalhos(sub, sub2){
  await trbCarregar(true);
  if (trab.erro){
    $('#main').innerHTML = cabecalho({ espaco:'Projetos', titulo:'Trabalhos', secoes:secoesProjetos('trabalhos') }) + `
      <div class="aviso-box err"><b>Os trabalhos ainda não estão no banco.</b> ${esc(trab.erro.message || '')}<br>
      <span class="small">Falta aplicar a migração <code>db/2.23.0_trabalhos.sql</code>.</span></div>`;
    return;
  }
  if (sub === 'alocacao') return trbAlocacao();
  if (sub === 'trabalhos'){
    trbLista();
    if (sub2 === 'novo' && trabalhoGestor()) trbModal();
    return;
  }
  const t = trab.lista.find(x => x.codigo === String(sub).toUpperCase());
  if (!t){
    $('#main').innerHTML = cabecalho({ espaco:'Projetos', titulo:'Trabalho não encontrado', voltar:['Trabalhos', '#/projetos/trabalhos'] })
      + estado.vazio({ texto:`Nenhum trabalho com o código ${String(sub).toUpperCase()}.`,
          acao:'<a class="btn ghost" href="#/projetos/trabalhos">Todos os trabalhos</a>' });
    return;
  }
  return trbPagina(t, ['quadro', 'documentos'].includes(sub2) ? sub2 : '');
}

/* ============================================================
   A LISTA
   ============================================================ */
function trbLista(){
  const f = trab.filtro, q = norm(f.q);
  const mostra = trab.lista.filter(t => (f.status === 'todos' || (f.status === 'abertos') === TRB_ABERTO(t))
    && (!q || [t.codigo, 'trabalho ' + t.numero, t.referencia, t.alocacao, TRB_TIPOS[t.tipo], t.ciclo].some(x => norm(x).includes(q))));
  const meus = new Set(trabalhosDe(trbEuM()).map(t => t.id));
  $('#main').innerHTML = cabecalho({ espaco:'Projetos', titulo:'Trabalhos', secoes:secoesProjetos('trabalhos'),
      acoes:[trabalhoGestor() ? `<button class="btn solid" onclick="trbModal()">${ic('plus')} Novo trabalho</button>` : ''] }) + `
    <div class="filtros" style="align-items:flex-end">
      <div class="fld cresce"><label for="trb-q">Buscar</label><input id="trb-q" type="search" value="${esc(f.q)}"
        placeholder="Número, referência, alocação" oninput="trab.filtro.q=this.value;clearTimeout(window._trbQ);window._trbQ=setTimeout(()=>{trbLista();const i=$('#trb-q');i.focus();i.setSelectionRange(i.value.length,i.value.length)},150)"></div>
      <div class="seg" role="group" aria-label="Situação">${[['abertos', 'Abertos'], ['fechados', 'Concluídos e cancelados'], ['todos', 'Todos']].map(([k, l]) =>
        `<button class="${f.status === k ? 'on' : ''}" aria-pressed="${f.status === k}" onclick="trab.filtro.status='${k}';trbLista()">${l}</button>`).join('')}</div>
    </div>
    ${mostra.length ? `<div class="trb-grade">${mostra.map(t => trbCartao(t, meus.has(t.id))).join('')}</div>`
      : estado.vazio({ texto: trab.lista.length ? 'Nenhum trabalho com esse filtro.' : trabalhoGestor() ? 'Nenhum trabalho. Crie o primeiro, ou importe a ficha.' : 'Nenhum trabalho.',
          acao: trab.lista.length ? `<button class="btn ghost" onclick="trab.filtro={q:'',status:'todos'};trbLista()">Limpar filtros</button>`
            : trabalhoGestor() ? `<button class="btn solid" onclick="trbModal()">Novo trabalho</button>` : '' })}`;
}
const trbPontos = (n, rot) => n ? `<span class="trb-pontos" role="img" aria-label="${rot} ${n} de 5" title="${rot}: ${n} de 5">${
  [1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>` : '';
function trbRostos(t, max){
  const ps = [...trbEquipe(t).map(m => avatarFoto(m, 26, 9)), ...trbConvidados(t).map(c => `<span class="conv-anel">${convAvatar(c, 26, 9)}</span>`)];
  return ps.length ? `<span class="pj-rostos">${ps.slice(0, max).join('')}${ps.length > max ? `<span class="mais">+${ps.length - max}</span>` : ''}</span>`
    : '<span class="muted">sem equipe</span>';
}
function trbCartao(t, meu){
  const resp = (t.responsaveis || []).map(r => nomeCurto(nomeDe(r)));
  const pj = trbProjeto(t);
  return `<a class="trb-card${meu ? ' meu' : ''}" href="${trbHref(t)}">
    <span class="topo"><span class="trb-num" aria-hidden="true">${t.numero}</span>
      <span class="tx"><span class="cd">${esc(t.codigo)}${t.ciclo ? ', PS ' + esc(t.ciclo) : ''}</span>
        <span class="ref">${esc(t.referencia)}</span>
        <span class="tp">${esc(TRB_TIPOS[t.tipo] || 'Outro')}${pj ? `, ${esc(pj.nome)}` : ''}</span></span></span>
    ${t.alocacao ? `<span class="aloc">${ic('users')}${esc(t.alocacao)}</span>` : ''}
    ${t.complexidade || t.esforco ? `<span class="trb-ce"><span>Complexidade ${trbPontos(t.complexidade, 'Complexidade')}</span>
      <span>Esforço ${trbPontos(t.esforco, 'Esforço')}</span></span>` : ''}
    <span class="rodape">${trbRostos(t, 6)}<span class="trb-resp">${resp.length ? esc(resp.join(', ')) : 'sem responsável'} ${trbPill(t.status)}</span></span>
  </a>`;
}

/* ============================================================
   UM TRABALHO
   ============================================================ */
async function trbPagina(t, aba){
  const pj = trbProjeto(t), edito = trbPodeEditar(t);
  const nDocs = trab.docs.filter(d => d.trabalho_id === t.id).length;
  const g = trbGrupo(t);
  $('#main').innerHTML = cabecalho({ espaco:'Projetos', titulo:'Trabalho ' + t.numero, codigo:t.codigo, voltar:['Trabalhos', '#/projetos/trabalhos'],
      lead:esc(t.referencia),
      meta:[trbPill(t.status), `<span class="chip mini">${esc(TRB_TIPOS[t.tipo] || 'Outro')}</span>`,
        pj ? `<a class="chip mini pt-pj" href="#/projetos/${esc(pj.codigo)}">${logoProjeto(pj.logo_semente, 16, pj.nome)}${esc(pj.nome)}</a>` : ''],
      acoes:[edito ? `<button class="btn ghost" onclick="trbModalEquipe('${t.id}')">${ic('users')} Pessoas</button>` : '',
        edito ? `<button class="btn ghost" onclick="trbModal('${t.id}')">${ic('pencil')} Editar</button>` : ''] })
    + navNivel1([['', 'Ficha', trbHref(t)],
        ['quadro', 'Quadro', trbHref(t) + '/quadro', g ? ` <span class="n">${esc(g.prefixo)}</span>` : ''],
        ['documentos', 'Documentos', trbHref(t) + '/documentos', nDocs ? ` <span class="n">${nDocs}</span>` : '']], aba, 'Trabalho')
    + '<div id="trb-corpo"></div>';
  if (aba === 'quadro') return trbQuadro(t);
  if (aba === 'documentos') return trbDocumentos(t);
  trbFicha(t);
}

function trbFicha(t){
  const textos = TRB_TEXTOS.filter(([k]) => (t[k] || '').trim());
  const cen = t.cenario || {}, temCen = TRB_CENARIO.some(([k]) => (cen[k] || []).length);
  const principal = (textos.length || temCen) ? textos.map(([k, l]) => `<section class="card trb-sec"><h3>${l}</h3>
        <div class="md">${md(t[k])}</div></section>`).join('')
      + (temCen ? `<section class="card trb-sec"><h3>Cenário</h3><div class="trb-swot">${TRB_CENARIO.map(([k, l]) =>
          `<div class="q q-${k}"><h4>${l}</h4>${(cen[k] || []).length ? `<ul>${cen[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`
            : '<p class="muted small">—</p>'}</div>`).join('')}</div></section>` : '')
    : estado.vazio({ texto:'A ficha do trabalho está em branco.',
        acao: trbPodeEditar(t) ? `<button class="btn ghost" onclick="trbModal('${t.id}')">Preencher a ficha</button>` : '' });
  const pj = trbProjeto(t);
  const lateral = `<div class="card">${spec([
      ['Número', String(t.numero), true],
      ['PS de origem', t.ciclo ? esc(t.ciclo) : null],
      ['Início', t.inicio ? fmtD(t.inicio) : null], ['Fim', t.fim ? fmtD(t.fim) : null],
      ['Alocação', t.alocacao ? esc(t.alocacao) : null],
      ['Complexidade', t.complexidade ? `${trbPontos(t.complexidade, 'Complexidade')} ${t.complexidade}` : null],
      ['Esforço', t.esforco ? `${trbPontos(t.esforco, 'Esforço')} ${t.esforco}` : null],
      ['Projeto', pj ? `<a href="#/projetos/${esc(pj.codigo)}">${esc(pj.nome)}</a>` : null]])}</div>
    <div class="card">${trbEquipeHTML(t)}</div>`;
  $('#trb-corpo').innerHTML = layoutObjeto(principal, lateral);
}
function trbEquipeHTML(t){
  const eq = trbEquipe(t), cv = trbConvidados(t), resp = t.responsaveis || [], g = trbGrupo(t);
  const fora = resp.filter(r => !eq.some(m => m.registro === r));
  return `<h3 style="display:flex;align-items:center;gap:8px">Equipe (${eq.length + cv.length})
      ${trbPodeEditar(t) ? `<button class="btn ghost mini" style="margin-left:auto" onclick="trbModalEquipe('${t.id}')">${ic('users')} Pôr e tirar</button>` : ''}</h3>
    ${!resp.length ? '<div class="aviso-box warn" style="margin:6px 0 10px">O trabalho está sem responsável.</div>' : ''}
    ${eq.map(m => `<div class="pj-membro">${avatarFoto(m, 32, 11)}<span class="tx"><span class="nm">${esc(m.nome)}</span>
        <span class="cg">${esc(m.cargo || '—')}${m.departamento ? ', ' + esc(m.departamento) : ''}</span></span>
        ${resp.includes(m.registro) ? '<span class="pj-sup">Responsável</span>' : ''}</div>`).join('')}
    ${fora.map(r => `<div class="pj-membro"><span class="tx"><span class="nm">${esc(nomeDe(r))}</span><span class="cg">fora da equipe</span></span>
        <span class="pj-sup">Responsável</span></div>`).join('')}
    ${cv.map(c => `<div class="pj-membro"><span class="conv-anel">${convAvatar(c, 32, 11)}</span><span class="tx"><span class="nm">${esc(c.nome)}</span>
        <span class="cg">${esc(CONV_MOTIVOS[c.motivo] || 'Convidado')}${c.instituicao ? ', ' + esc(c.instituicao) : ''}, por ${esc(nomeCurto(nomeDe(c.responsavel)))}</span></span>
        <span class="chip mini conv">Convidado</span></div>`).join('')}
    ${!eq.length && !cv.length ? '<p class="muted small">Ninguém na equipe.</p>' : ''}
    ${g ? `<p class="small muted" style="margin-top:12px">Grupo ${esc(g.nome)} ${dica('A equipe é o grupo do trabalho, dentro de ' +
      (gruposAcima(g)[1]?.nome || 'NRO_TRABALHOS') + '. Quem está nele mexe no quadro. Convidados não têm conta: aparecem aqui e na alocação.')}</p>` : ''}`;
}

/* ---------------- o quadro: o do grupo, desenhado por mod-atividades ---------------- */
async function trbQuadro(t){
  const el = $('#trb-corpo');
  el.innerHTML = estado.carregando();
  try { await carregarModulo('atividades'); await atvCarregar(true); }
  catch(e){ el.innerHTML = estado.erro({ texto:`O quadro não carregou (${e.message}). Recarregue a página.` }); return; }
  if (atividades.erro){ el.innerHTML = avisoSemMigracao(); return; }
  const g = atividades.grupos.find(x => x.id === t.grupo_id);
  if (!g){ el.innerHTML = estado.vazio({ texto:'O grupo do trabalho não tem quadro em Atividades.' }); return; }
  if (!posso.ver(g)){ el.innerHTML = estado.vazio({ texto:`${g.nome} é um quadro fechado.` }); return; }
  atividades.grupoAtual = g;
  atividades.filtro = { q:'', pessoa:null, so:'', etiqueta:'' };
  el.innerHTML = `<div class="trb-quadro-topo"><span class="small muted">Atividades ${esc(g.prefixo)}-1, ${esc(g.prefixo)}-2… ${
      dica('O quadro é o do grupo ' + g.nome + ' em Atividades: o mesmo, com os mesmos cartões. Arrastar move; quem não está na equipe só acompanha.')}</span>
    <div id="atv-resumo"></div>
    <a class="btn ghost mini" href="#/atividades/${esc(g.prefixo)}">Abrir em Atividades ${ic('chevron')}</a></div>
    <div class="kanban${posso.editar(g) ? '' : ' so-leitura'}" id="kanban"></div>`;
  desenhaColunas();
  ajustarAlturaQuadro();
}

/* ---------------- os documentos ---------------- */
async function trbRol(){
  if (trab.rol) return trab.rol;
  const r = await sb.from('doc_rol').select('*').order('codigo');
  trab.rol = r.error ? [] : (r.data || []);
  return trab.rol;
}
async function trbDocumentos(t){
  const el = $('#trb-corpo'), pode = trbPodeDoc(t);
  el.innerHTML = estado.carregando();
  const docs = trab.docs.filter(d => d.trabalho_id === t.id);
  const rol = docs.some(d => d.arquivo_id) ? await trbRol() : [];
  const tile = d => {
    const r = d.arquivo_id ? rol.find(x => x.id === d.arquivo_id) : null;
    const tirar = pode ? `<button class="trb-doc-x" type="button" title="Tirar do trabalho" aria-label="Tirar ${esc(r?.codigo || d.titulo || '')} do trabalho"
      onclick="event.preventDefault();event.stopPropagation();trbDocTirar('${d.id}','${t.id}')">${ic('x')}</button>` : '';
    if (r) return `<a class="arq-item" href="#/arquivos/${esc(r.codigo)}">${iconeArquivo(r, 60)}
      <span class="nm"><span class="cd">${esc(r.codigo)}</span><span class="tt">${esc(r.titulo)}</span>
        <span class="st"><span class="dt dt-${(ARQ_ST_COR[r.status] || 'gray')}"></span>${esc(ARQ_ST_ROT[r.status] || r.status)}${r.rev_vigente ? ', Rev. ' + esc(r.rev_vigente) : ''}</span></span>${tirar}</a>`;
    if (d.url){ let host = ''; try { host = new URL(d.url).hostname.replace(/^www\./, ''); } catch(_){}
      return `<a class="arq-item" href="${esc(d.url)}" target="_blank" rel="noopener"><span class="arqv link" style="--h:60px" aria-hidden="true">${ic('link')}</span>
        <span class="nm"><span class="cd">${esc(host)}</span><span class="tt">${esc(d.titulo)}</span>${d.nota ? `<span class="st">${esc(d.nota)}</span>` : ''}</span>${tirar}</a>`; }
    return '';
  };
  el.innerHTML = `<div class="trb-docs-topo">
      ${pode ? `<button class="btn ghost mini" onclick="trbModalDocRol('${t.id}')">${ic('pasta')} Pôr arquivo do rol</button>
        <button class="btn ghost mini" onclick="trbModalDocLink('${t.id}')">${ic('link')} Pôr link</button>` : ''}
      <span class="small muted">${dica('Os documentos e registros do trabalho são os do rol de Arquivos: quem lê o conteúdo segue a classe da série. O que mora fora (uma pasta do Drive) entra como link.')}</span></div>
    ${docs.length ? `<div class="arq-grade">${docs.map(tile).join('')}</div>`
      : estado.vazio({ texto:'Nenhum documento no trabalho.' })}`;
}
const ARQ_ST_ROT = { rascunho:'Rascunho', em_revisao:'Em revisão', ativo:'Ativo', obsoleto:'Obsoleto' };
const ARQ_ST_COR = { rascunho:'gray', em_revisao:'warn', ativo:'ok', obsoleto:'bad' };
async function trbModalDocRol(tid){
  abreModal(`<h3>Pôr arquivo do rol</h3>
    <input type="search" id="trd-q" placeholder="Código ou título" oninput="trbDocRolLista('${tid}')" style="width:100%;margin-bottom:10px" aria-label="Buscar no rol">
    <div class="gr-cands" id="trd-lista" style="max-height:340px">${estado.carregando()}</div>
    <div class="acts" style="justify-content:space-between"><a class="btn ghost" href="#/arquivos" onclick="fechaModal()">Criar em Arquivos</a>
      <button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'largo');
  await trbRol(); trbDocRolLista(tid); $('#trd-q')?.focus();
}
function trbDocRolLista(tid){
  const el = $('#trd-lista'); if (!el) return;
  const ja = new Set(trab.docs.filter(d => d.trabalho_id === tid).map(d => d.arquivo_id));
  const q = norm($('#trd-q')?.value);
  const lista = (trab.rol || []).filter(r => !ja.has(r.id) && (!q || norm(r.codigo).includes(q) || norm(r.titulo).includes(q))).slice(0, 60);
  el.innerHTML = lista.map(r => `<button type="button" class="gr-cand trd-op" onclick="trbDocPor('${tid}','${r.id}')">${iconeArquivo(r, 30)}
      <span class="tx"><span class="nm">${esc(r.codigo)}</span><span class="cg">${esc(r.titulo)}</span></span></button>`).join('')
    || '<p class="muted small" style="padding:8px 0">Nenhum arquivo com essa busca.</p>';
}
async function trbDocPor(tid, arquivo){
  const { data, error } = await sb.rpc('trabalho_documento_salvar', { p:{ trabalho_id:tid, arquivo_id:arquivo } });
  if (error || data?.status !== 'ok') return toast(data?.status === 'duplicado' ? 'O arquivo já está no trabalho.' : motivoRPC(data, error, 'Não foi possível pôr o arquivo'), true);
  fechaModal(); toast('Arquivo no trabalho.');
  await trbCarregar(true); const t = trab.lista.find(x => x.id === tid); if (t) trbPagina(t, 'documentos');
}
function trbModalDocLink(tid){
  abreModal(`<h3>Pôr link</h3>
    <div class="form-grid">
      <div class="fld full"><label for="trl-tit">Título</label><input id="trl-tit" maxlength="160" placeholder="Banco de fotos"></div>
      <div class="fld full"><label for="trl-url">Endereço</label><input id="trl-url" type="url" placeholder="https://"></div>
      <div class="fld full"><label for="trl-nota">Nota</label><input id="trl-nota" maxlength="200"></div></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="trbDocLinkSalvar('${tid}')">Pôr</button></div>`);
  $('#trl-tit').focus();
}
async function trbDocLinkSalvar(tid){
  const p = { trabalho_id:tid, titulo:$('#trl-tit').value.trim(), url:$('#trl-url').value.trim(), nota:$('#trl-nota').value.trim() };
  if (!p.titulo) return toast('Informe o título.', true);
  if (!/^https?:\/\/\S+$/i.test(p.url)) return toast('O endereço começa com https://.', true);
  const { data, error } = await sb.rpc('trabalho_documento_salvar', { p });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível pôr o link'), true);
  fechaModal(); toast('Link no trabalho.');
  await trbCarregar(true); const t = trab.lista.find(x => x.id === tid); if (t) trbPagina(t, 'documentos');
}
async function trbDocTirar(id, tid){
  const { data, error } = await sb.rpc('trabalho_documento_tirar', { p_id:id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível tirar'), true);
  toast('Tirado do trabalho.');
  await trbCarregar(true); const t = trab.lista.find(x => x.id === tid); if (t) trbPagina(t, 'documentos');
}

/* ============================================================
   CRIAR E EDITAR
   A ficha de trabalho, campo a campo; a importação lê o .docx da
   ficha (a tabela do alto, as seções e o cenário) e preenche o
   formulário, que se confere antes de salvar.
   ============================================================ */
function trbModal(id){
  const t = id ? trab.lista.find(x => x.id === id) : null;
  if (t ? !trbPodeEditar(t) : !trabalhoGestor()) return;
  const prox = Math.max(0, ...trab.lista.map(x => x.numero)) + 1;
  trab.ed = { id: t?.id || null, resp: [...(t?.responsaveis || [])] };
  const cen = t?.cenario || {};
  const sel = (k, ops, v) => `<select id="te-${k}">${ops.map(([a, b]) => `<option value="${a}" ${String(v ?? '') === String(a) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
  const notas = [['', '—'], ...[1, 2, 3, 4, 5].map(n => [n, String(n)])];
  abreModal(`<h3>${t ? 'Trabalho ' + t.numero : 'Novo trabalho'}</h3>
    ${!t ? `<label class="trb-importar"><input type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onchange="trbImportar(this.files[0])" hidden>${ic('subir')} <span><b>Importar a ficha (.docx)</b> A ficha de trabalho preenche o formulário.</span></label>` : ''}
    <div class="form-grid">
      <div class="fld"><label for="te-numero">Número</label><input id="te-numero" type="number" min="1" max="9999" value="${t ? t.numero : ''}"
        placeholder="${prox}" ${t ? 'disabled' : ''}></div>
      <div class="fld"><label for="te-tipo">Tipo</label>${sel('tipo', Object.entries(TRB_TIPOS), t?.tipo || 'outro')}</div>
      <div class="fld full"><label for="te-ref">Referência ${dica('O trabalho não tem nome: a referência diz do que se trata, como "Projeto Calima (firmware)".')}</label>
        <input id="te-ref" maxlength="160" value="${esc(t?.referencia || '')}" placeholder="Projeto Calima (firmware)"></div>
      <div class="fld"><label for="te-status">Status</label>${sel('status', Object.entries(TRB_STATUS).map(([k, v]) => [k, v[0]]), t?.status || 'a_iniciar')}</div>
      <div class="fld"><label for="te-ciclo">PS de origem</label><input id="te-ciclo" maxlength="20" value="${esc(t?.ciclo || '')}" placeholder="2026/2"></div>
      <div class="fld"><label for="te-inicio">Início</label><input id="te-inicio" type="date" value="${t?.inicio || ''}"></div>
      <div class="fld"><label for="te-fim">Fim</label><input id="te-fim" type="date" value="${t?.fim || ''}"></div>
      <div class="fld full"><label>Responsáveis ${dica('Entram na equipe e cuidam dela: põem e tiram gente e editam o trabalho. Trocar os responsáveis é da gestão.')}</label>
        <div id="te-resp"></div></div>
      <div class="fld full"><label for="te-aloc">Alocação</label><input id="te-aloc" maxlength="160" value="${esc(t?.alocacao || '')}" placeholder="2 trainees Dev, 1 trainee RI"></div>
      <div class="fld"><label for="te-complexidade">Complexidade</label>${sel('complexidade', notas, t?.complexidade)}</div>
      <div class="fld"><label for="te-esforco">Esforço</label>${sel('esforco', notas, t?.esforco)}</div>
      <div class="fld full"><label for="te-projeto">Projeto ${dica('Opcional. O trabalho pode ser uma etapa de um projeto, o começo de um ou nada disso.')}</label>
        ${sel('projeto', [['', 'Nenhum'], ...(state.projetos || []).filter(p => p.status !== 'encerrado' || p.id === t?.projeto_id).map(p => [p.id, p.nome + ' (' + p.codigo + ')'])], t?.projeto_id || '')}</div>
      ${TRB_TEXTOS.map(([k, l]) => `<div class="fld full"><label for="te-${k}">${l}</label>${mdBarra('te-' + k)}
        <textarea id="te-${k}" rows="${k === 'escopo' ? 3 : 4}" placeholder="${k === 'escopo' ? '' : '- um item por linha'}">${esc(t?.[k] || '')}</textarea></div>`).join('')}
      <div class="fld full"><label>Cenário ${dica('Um item por linha em cada quadrante.')}</label>
        <div class="trb-swot ed">${TRB_CENARIO.map(([k, l]) => `<div class="q q-${k}"><label for="te-c-${k}">${l}</label>
          <textarea id="te-c-${k}" rows="3">${esc((cen[k] || []).join('\n'))}</textarea></div>`).join('')}</div></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="te-btn" onclick="trbSalvar()">${t ? 'Salvar' : 'Criar o trabalho'}</button></div>`, 'largo', true);
  trbRespDesenhar();
  if (!t) $('#te-ref').focus();
}
function trbRespDesenhar(){
  const el = $('#te-resp'); if (!el) return;
  const e = trab.ed, gestor = trabalhoGestor();
  const ativos = (state.membros || []).filter(m => TRB_ATIVOS.includes(m.status) && !e.resp.includes(m.registro))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  el.innerHTML = `<div class="pills-ed${gestor ? '' : ' fixo'}">${e.resp.map((r, i) => `<span class="pill-ed">${esc(nomeDe(r))}${i === 0 && e.resp.length > 1 ? ' (principal)' : ''}${
      gestor ? `<button type="button" onclick="trab.ed.resp.splice(${i},1);trbRespDesenhar()" aria-label="Tirar ${esc(nomeDe(r))}" title="Tirar">×</button>` : ''}</span>`).join('')
    || '<span class="muted small">A definir</span>'}
    ${gestor ? `<select aria-label="Pôr responsável" onchange="if(this.value){trab.ed.resp.push(+this.value);trbRespDesenhar()}">
      <option value="">Pôr responsável</option>${ativos.map(m => `<option value="${m.registro}">${esc(m.nome)}${ehTrainee(m) ? ' (trainee)' : ''}</option>`).join('')}</select>` : ''}</div>`;
}
const trbLinhas = v => String(v || '').split('\n').map(x => x.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean);
async function trbSalvar(){
  const e = trab.ed, v = k => $('#te-' + k).value.trim();
  const p = { referencia:v('ref'), tipo:v('tipo'), status:v('status'), ciclo:v('ciclo'), inicio:v('inicio') || null, fim:v('fim') || null,
    alocacao:v('aloc'), complexidade:v('complexidade') || null, esforco:v('esforco') || null, projeto_id:v('projeto') || null,
    cenario:Object.fromEntries(TRB_CENARIO.map(([k]) => [k, trbLinhas($('#te-c-' + k).value)])) };
  TRB_TEXTOS.forEach(([k]) => p[k] = v(k));
  if (trabalhoGestor()) p.responsaveis = e.resp;
  if (e.id) p.id = e.id; else if (v('numero')) p.numero = Number(v('numero'));
  if (!p.referencia) return toast('Informe a referência.', true);
  if (p.inicio && p.fim && p.fim < p.inicio) return toast('O fim vem depois do início.', true);
  const b = $('#te-btn'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('trabalho_salvar', { p });
    if (error) throw error;
    if (data?.status === 'duplicado') return toast(data.campo === 'numero' ? `Já existe o trabalho ${p.numero}.` : `Já existe o grupo NRO_TRABALHO_${p.numero}.`, true);
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível salvar o trabalho'), true);
    fechaModal();
    await Promise.all([carregarGrupos(), trbRecarregarFichas()]);
    await carregarProjetosEArquivos(); await trbCarregar(true);
    toast(e.id ? 'Trabalho salvo.' : `${data.codigo} criado, com o quadro ${data.prefixo || ''} em Atividades.`);
    location.hash = '#/projetos/' + data.codigo;
    if (e.id) pageTrabalhos(data.codigo);
  }catch(x){ falha(x, 'Erro ao salvar o trabalho'); }
  finally{ const x = $('#te-btn'); if (x) x.disabled = false; }
}

/* ---------------- importar a ficha (.docx) ----------------
   A ficha de trabalho: uma tabela com os pares rótulo e valor (Ref.,
   Num. série, PS original, datas, Responsável, Status, Alocação,
   Complexidade / Esforço), as seções em parágrafos e listas, e o
   cenário numa tabela de quatro quadrantes. */
const TRB_IMP_STATUS = { 'a iniciar':'a_iniciar', 'em andamento':'em_andamento', 'andamento':'em_andamento', 'pausado':'pausado',
  'em pausa':'pausado', 'concluido':'concluido', 'concluído':'concluido', 'cancelado':'cancelado' };
const TRB_IMP_SECOES = { 'escopo do trabalho':'escopo', 'escopo':'escopo', 'justificativa':'justificativa', 'entregaveis':'entregaveis',
  'necessidades e dependencias':'dependencias', 'dependencias':'dependencias', 'criterios de sucesso':'criterios', 'cenario':'cenario' };
const TRB_IMP_SWOT = { 'forcas':'forcas', 'fraquezas':'fraquezas', 'oportunidades':'oportunidades', 'ameacas':'ameacas' };
const semAcento = s => norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[.:]+$/, '').trim();
/* "trabalhos 5 e 6" vira "trabalhos TRB-5 e TRB-6": o código vira link */
const trbCitacoes = s => String(s || '').replace(/\b(trabalhos?)\s+((?:\d+)(?:\s*(?:,|e)\s*\d+)*)/gi,
  (_, p, ns) => p + ' ' + ns.replace(/\d+/g, n => 'TRB-' + n));
async function trbImportar(arq){
  if (!arq) return;
  try{
    if (!window.JSZip) await carregarLib('vendor/jszip-3.10.1.min.js');
    const zip = await JSZip.loadAsync(arq);
    const xml = await zip.file('word/document.xml')?.async('string');
    if (!xml) throw new Error('não é um .docx');
    const f = trbLerFicha(new DOMParser().parseFromString(xml, 'application/xml'));
    trbPreencher(f);
  }catch(e){ toast('Não foi possível ler a ficha: ' + (e.message || 'arquivo inválido') + '.', true); }
}
function trbLerFicha(doc){
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const filhos = (el, nome) => [...el.childNodes].filter(n => n.namespaceURI === W && n.localName === nome);
  const texto = el => [...el.getElementsByTagNameNS(W, 't')].map(x => x.textContent).join('').trim();
  const lista = p => p.getElementsByTagNameNS(W, 'numPr').length > 0;
  const paras = el => [...el.getElementsByTagNameNS(W, 'p')].map(p => ({ t:texto(p), li:lista(p) })).filter(p => p.t);
  const body = doc.getElementsByTagNameNS(W, 'body')[0];
  const f = { campos:{}, secoes:{}, cenario:{} };
  let secao = null, tabelas = 0;
  for (const n of [...(body?.childNodes || [])]){
    if (n.namespaceURI !== W) continue;
    if (n.localName === 'tbl'){
      tabelas++;
      const linhas = filhos(n, 'tr').map(tr => filhos(tr, 'tc'));
      if (secao === 'cenario'){
        /* quadrantes: uma linha de títulos, a de baixo com as listas */
        for (let i = 0; i < linhas.length; i++){
          const tit = linhas[i].map(c => TRB_IMP_SWOT[semAcento(texto(c))]);
          if (tit.some(Boolean) && linhas[i + 1]) tit.forEach((k, j) => { if (k && linhas[i + 1][j]) f.cenario[k] = paras(linhas[i + 1][j]).map(p => p.t); });
        }
      } else if (tabelas === 1){
        linhas.forEach(cs => { for (let j = 0; j + 1 < cs.length; j += 2) f.campos[semAcento(texto(cs[j]))] = texto(cs[j + 1]); });
      }
      continue;
    }
    if (n.localName !== 'p') continue;
    const t = texto(n); if (!t) continue;
    const k = !lista(n) && TRB_IMP_SECOES[semAcento(t)];
    if (k){ secao = k; f.secoes[k] ||= []; continue; }
    if (secao && secao !== 'cenario') f.secoes[secao].push({ t, li:lista(n) });
  }
  return f;
}
/* o membro pelo nome escrito na ficha: nome inteiro, ou o primeiro e o último */
function trbMembroPorNome(txt){
  const q = semAcento(txt); if (!q || /^a definir/.test(q)) return null;
  const ativos = (state.membros || []).filter(m => TRB_ATIVOS.includes(m.status));
  return ativos.find(m => semAcento(m.nome) === q) || ativos.find(m => semAcento(nomeCurto(m.nome)) === q)
    || ativos.find(m => semAcento(m.nome).startsWith(q + ' ')) || (q.split(' ').length === 1 ? ativos.find(m => semAcento(m.nome).split(' ')[0] === q) : null) || null;
}
function trbPreencher(f){
  const c = f.campos, put = (id, v) => { const el = $('#te-' + id); if (el && v != null && v !== '') el.value = v; };
  const dt = v => { const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/); return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : ''; };
  put('ref', c['ref'] || c['referencia']);
  if (/^\d+$/.test(c['num. serie'] || c['num serie'] || c['numero'] || '')) put('numero', c['num. serie'] || c['num serie'] || c['numero']);
  put('ciclo', c['ps original'] || c['ps de origem']);
  put('inicio', dt(c['data inicio'])); put('fim', dt(c['data fim']));
  put('status', TRB_IMP_STATUS[semAcento(c['status'] || '')]);
  put('aloc', c['alocacao']);
  const ce = String(c['complexidade / esforco'] || c['complexidade/esforco'] || '').match(/([1-5])\s*\/\s*([1-5])/);
  if (ce){ put('complexidade', ce[1]); put('esforco', ce[2]); }
  /* o responsável e quem dá suporte: "Gabriel Matos (suporte: Nádia)" */
  const nomes = String(c['responsavel'] || '').replace(/suporte\s*:/i, ',').split(/[(),;]|\se\s/).map(x => x.trim()).filter(Boolean);
  const achados = [], faltou = [];
  nomes.forEach(nm => { const m = trbMembroPorNome(nm); m ? achados.includes(m.registro) || achados.push(m.registro) : /^a definir$/i.test(nm) || faltou.push(nm); });
  if (trabalhoGestor() && achados.length){ trab.ed.resp = achados; trbRespDesenhar(); }
  Object.entries(f.secoes).forEach(([k, ps]) => {
    const txt = ps.map(p => (p.li ? '- ' : '') + p.t).join(ps.some(p => p.li) ? '\n' : '\n\n');
    put(k, trbCitacoes(txt));
  });
  TRB_CENARIO.forEach(([k]) => put('c-' + k, (f.cenario[k] || []).join('\n')));
  /* o tipo pela referência: o que diz campanha, viabilidade… */
  const ref = semAcento(c['ref'] || '');
  if (/viabilidade/.test(ref)) put('tipo', 'viabilidade'); else if (/^projeto\b/.test(ref)) put('tipo', 'etapa');
  const n = Object.keys(c).length + Object.keys(f.secoes).length;
  toast(n ? `Ficha lida.${faltou.length ? ' Sem membro com o nome: ' + faltou.join(', ') + '.' : ''} Confira antes de criar.` : 'A ficha não tem os campos esperados.', !n);
}

/* ============================================================
   PÔR E TIRAR GENTE DE UM TRABALHO
   ============================================================ */
function trbModalEquipe(id){
  const t = trab.lista.find(x => x.id === id); if (!t || !trbPodeEditar(t)) return;
  trab.eq = { id, marcados:new Set(), busca:'' };
  abreModal(`<h3>Trabalho ${t.numero}: equipe</h3><p class="sub" style="margin-bottom:12px">${esc(t.referencia)}</p>
    <div id="tq-corpo"></div>`, 'largo', true);
  trbEquipeDesenhar();
}
function trbEquipeDesenhar(){
  const e = trab.eq, t = trab.lista.find(x => x.id === e.id), g = trbGrupo(t);
  const eq = trbEquipe(t), cv = trbConvidados(t), dentro = new Set(eq.map(m => m.registro)), q = norm(e.busca);
  const casa = (...xs) => !q || xs.some(x => norm(x).includes(q));
  const cands = (state.membros || []).filter(m => TRB_ATIVOS.includes(m.status) && !dentro.has(m.registro) && casa(m.nome, m.cargo, m.departamento))
    .sort((a, b) => ehTrainee(b) - ehTrainee(a) || a.nome.localeCompare(b.nome, 'pt-BR'));
  const cconv = trab.conv.filter(c => c.ativo && !cv.includes(c) && casa(c.nome, c.instituicao));
  const via = m => (m.grupos || []).includes(g.nome);
  $('#tq-corpo').innerHTML = `<div class="adm-grupo" style="margin-top:0">Na equipe (${eq.length + cv.length})</div>
    <div class="gr-pessoas" style="max-height:220px">${eq.map(m => `<div class="gr-pessoa">${avatarFoto(m, 28, 10)}
      <div class="tx"><div class="nm">${esc(m.nome)}</div><div class="cg">${esc(m.cargo || '—')}</div></div>
      ${(t.responsaveis || []).includes(m.registro) ? '<span class="pj-sup">Responsável</span>' : ''}
      ${via(m) ? ibtn('x', 'Tirar ' + esc(m.nome), `trbMexer('${t.id}',{remover:[${m.registro}]})`, 'perigo sm')
        : '<span class="gr-via">por um subgrupo</span>'}</div>`).join('')}
      ${cv.map(c => `<div class="gr-pessoa"><span class="conv-anel">${convAvatar(c, 28, 10)}</span>
        <div class="tx"><div class="nm">${esc(c.nome)}</div><div class="cg">Convidado, por ${esc(nomeCurto(nomeDe(c.responsavel)))}</div></div>
        ${ibtn('x', 'Tirar ' + esc(c.nome), `trbMexer('${t.id}',{convidados_remover:['${c.id}']})`, 'perigo sm')}</div>`).join('')
      || '<p class="muted small">Ninguém ainda.</p>'}</div>
    <div class="adm-grupo">Pôr na equipe</div>
    <input type="search" id="tq-busca" placeholder="Buscar por nome, cargo ou departamento" value="${esc(e.busca)}" aria-label="Buscar pessoas"
      oninput="trab.eq.busca=this.value;clearTimeout(window._tqT);window._tqT=setTimeout(()=>{trbEquipeDesenhar();const i=$('#tq-busca');i.focus();i.setSelectionRange(i.value.length,i.value.length)},120)"
      style="width:100%;margin-bottom:8px">
    <div class="gr-cands" style="max-height:240px">${cands.map(m => `<label class="gr-cand">
      <input type="checkbox" ${e.marcados.has('m:' + m.registro) ? 'checked' : ''} onchange="trbMarcar('m:${m.registro}', this.checked)">
      ${avatarFoto(m, 24, 9)}<span class="tx"><span class="nm">${esc(m.nome)}${ehTrainee(m) ? ' <span class="chip mini">Trainee</span>' : ''}</span>
        <span class="cg">${esc(m.cargo || '—')}${m.departamento ? ', ' + esc(m.departamento) : ''}</span></span></label>`).join('')}
      ${cconv.map(c => `<label class="gr-cand"><input type="checkbox" ${e.marcados.has('c:' + c.id) ? 'checked' : ''} onchange="trbMarcar('c:${c.id}', this.checked)">
        <span class="conv-anel">${convAvatar(c, 24, 9)}</span><span class="tx"><span class="nm">${esc(c.nome)} <span class="chip mini conv">Convidado</span></span>
        <span class="cg">${esc(c.instituicao || CONV_MOTIVOS[c.motivo] || '')}</span></span></label>`).join('')}
      ${!cands.length && !cconv.length ? '<p class="muted small" style="padding:8px 0">Ninguém com essa busca.</p>' : ''}</div>
    <div class="acts" style="justify-content:space-between">
      <span>${trbPodeConvidar() ? `<button class="btn ghost" onclick="trbModalConvidado(null,'${t.id}')">${ic('plus')} Convidado de fora</button>` : ''}</span>
      <span style="display:flex;gap:8px"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <button class="btn solid" id="tq-btn" ${e.marcados.size ? '' : 'disabled'} onclick="trbPorMarcados()">${ic('plus')} ${trbRotPor()}</button></span></div>`;
}
const trbRotPor = () => { const n = trab.eq.marcados.size; return n ? `Pôr ${n} pessoa${n > 1 ? 's' : ''}` : 'Pôr na equipe'; };
function trbMarcar(k, sim){
  const e = trab.eq; sim ? e.marcados.add(k) : e.marcados.delete(k);
  const b = $('#tq-btn'); if (b){ b.disabled = !e.marcados.size; b.innerHTML = `${ic('plus')} ${trbRotPor()}`; }
}
async function trbPorMarcados(){
  const e = trab.eq, ks = [...e.marcados]; e.marcados.clear(); e.busca = '';
  await trbMexer(e.id, { adicionar: ks.filter(k => k[0] === 'm').map(k => Number(k.slice(2))),
                         convidados_adicionar: ks.filter(k => k[0] === 'c').map(k => k.slice(2)) });
}
/* a mesma porta para o modal, a alocação e a ficha: trabalho_pessoas */
async function trbMexer(tid, corpo, quieto){
  const { data, error } = await sb.rpc('trabalho_pessoas', { p:{ trabalho_id:tid, ...corpo } });
  if (error){ falha(error, 'Erro ao mexer na equipe'); return false; }
  if (data?.status === 'sem_permissao'){ toast('Só a gestão e os responsáveis do trabalho mexem na equipe.', true); return false; }
  if (data?.status !== 'ok'){ toast(motivoRPC(data, null, 'Não foi possível'), true); return false; }
  await Promise.all([trbRecarregarFichas(), trbCarregar(true)]);
  const n = (data.adicionados || 0) + (data.convidados_adicionados || 0), r = (data.removidos || 0) + (data.convidados_removidos || 0);
  if (!quieto) toast(n ? `${n} pessoa${n > 1 ? 's' : ''} no trabalho.` : r ? `${r} pessoa${r > 1 ? 's' : ''} fora do trabalho.` : 'Nada mudou.');
  if ($('#tq-corpo')) trbEquipeDesenhar();
  const t = trab.lista.find(x => x.id === tid);
  if (location.hash.startsWith('#/projetos/alocacao')) trbAlocDesenhar();
  else if (t && location.hash === trbHref(t) && $('#trb-corpo')) trbFicha(t);
  return true;
}

/* ============================================================
   CONVIDADOS
   ============================================================ */
function trbModalConvidado(id, incluirEm){
  const c = id ? trab.conv.find(x => x.id === id) : null;
  const efetivos = (state.membros || []).filter(m => m.status === 'Ativo' && !ehTrainee(m)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const eu = trbEu();
  abreModal(`<h3>${c ? esc(c.nome) : 'Convidado de fora'}</h3>
    <p class="sub" style="margin-bottom:14px">Participa de trabalhos sem ser membro da equipe ${dica('Integração, intercâmbio, convite ou conveniência. O convidado não tem conta no SOMA; um membro efetivo (ativo, não trainee) responde por ele. O e-mail só a gestão e o responsável veem.')}</p>
    <div class="form-grid">
      <div class="fld full"><label for="cv-nome">Nome</label><input id="cv-nome" maxlength="120" value="${esc(c?.nome || '')}"></div>
      <div class="fld"><label for="cv-email">E-mail</label><input id="cv-email" type="email" value="${esc(c?.email || '')}"></div>
      <div class="fld"><label for="cv-inst">Instituição</label><input id="cv-inst" maxlength="120" value="${esc(c?.instituicao || '')}"></div>
      <div class="fld"><label for="cv-motivo">Motivo</label><select id="cv-motivo">${Object.entries(CONV_MOTIVOS).map(([k, l]) =>
        `<option value="${k}" ${(c?.motivo || 'convite') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label for="cv-resp">Responsável</label><select id="cv-resp"><option value="">Escolha</option>${efetivos.map(m =>
        `<option value="${m.registro}" ${(c ? c.responsavel : eu) === m.registro ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div>
      <div class="fld full"><label for="cv-foto">Foto (endereço)</label><input id="cv-foto" type="url" placeholder="https://" value="${esc(c?.foto_url || '')}"></div>
      <div class="fld full"><label for="cv-tem">Já sabe</label><input id="cv-tem" placeholder="Separe por vírgula" value="${esc((c?.habilidades || []).join(', '))}"></div>
      <div class="fld full"><label for="cv-quer">Quer desenvolver</label><input id="cv-quer" placeholder="Separe por vírgula" value="${esc((c?.quer_desenvolver || []).join(', '))}"></div>
      <div class="fld full"><label for="cv-obs">Observação</label><textarea id="cv-obs" rows="2">${esc(c?.observacao || '')}</textarea></div>
    </div>
    <div class="acts" style="justify-content:space-between">
      <span>${c && c.gere ? `<button class="btn ghost perigo" onclick="trbConvidadoSalvar('${c.id}', null, false)">Desativar</button>` : ''}</span>
      <span style="display:flex;gap:8px"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="cv-btn" onclick="trbConvidadoSalvar(${c ? `'${c.id}'` : 'null'}, ${incluirEm ? `'${incluirEm}'` : 'null'})">${c ? 'Salvar' : incluirEm ? 'Convidar e pôr no trabalho' : 'Convidar'}</button></span></div>`, 'largo');
  $('#cv-nome').focus();
}
const trbVirgulas = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
async function trbConvidadoSalvar(id, incluirEm, ativo){
  const p = ativo === false ? { id, ativo:false } : { nome:$('#cv-nome').value.trim(), email:$('#cv-email').value.trim(), instituicao:$('#cv-inst').value.trim(),
    motivo:$('#cv-motivo').value, responsavel:$('#cv-resp').value ? Number($('#cv-resp').value) : null, foto_url:$('#cv-foto').value.trim(),
    habilidades:trbVirgulas($('#cv-tem').value), quer_desenvolver:trbVirgulas($('#cv-quer').value), observacao:$('#cv-obs').value.trim() };
  if (id) p.id = id;
  if (ativo !== false){
    if (p.nome.length < 2) return toast('Informe o nome.', true);
    if (!p.responsavel) return toast('Escolha o membro efetivo que responde pelo convidado.', true);
    if (p.foto_url && !/^https:\/\//i.test(p.foto_url)) return toast('A foto precisa de um endereço https://.', true);
  }
  const { data, error } = await sb.rpc('convidado_salvar', { p });
  if (error) return falha(error, 'Erro ao salvar o convidado');
  if (data?.status !== 'ok') return toast({ responsavel:'O responsável precisa ser um membro efetivo: ativo e não trainee.', email:'Confira o e-mail.',
    email_de_membro:'Este e-mail é de um membro da equipe.', foto_url:'A foto precisa de um endereço https://.', nome:'Informe o nome.' }[data?.campo]
    || motivoRPC(data, null, 'Não foi possível salvar o convidado'), true);
  fechaModal();
  if (incluirEm){ await trbMexer(incluirEm, { convidados_adicionar:[data.id] }, true); toast(`${p.nome} convidado e no trabalho.`); return; }
  toast(ativo === false ? 'Convidado desativado.' : id ? 'Convidado salvo.' : `${p.nome} convidado.`);
  await trbCarregar(true);
  if (location.hash.startsWith('#/projetos/alocacao')) trbAlocDesenhar();
}

/* ============================================================
   HABILIDADES: o que a pessoa já sabe e o que quer desenvolver
   ============================================================ */
function trbHabilidadesHTML(reg){
  const h = trbHab(reg);
  return `<div class="trb-hab"><div><span class="rot">Já sabe</span>${h.tem.length ? h.tem.map(x => `<span class="chip mini tem">${esc(x)}</span>`).join(' ') : '<span class="muted small">—</span>'}</div>
    <div><span class="rot">Quer desenvolver</span>${h.quer.length ? h.quer.map(x => `<span class="chip mini quer">${esc(x)}</span>`).join(' ') : '<span class="muted small">—</span>'}</div></div>`;
}
function modalHabilidades(reg, aoSalvar){
  reg = reg ?? trbEu(); if (reg == null) return;
  if (reg !== trbEu() && !can()) return;
  const h = trbHab(reg);
  trab.habEd = { reg, tem:[...h.tem], quer:[...h.quer], aoSalvar };
  abreModal(`<h3>${reg === trbEu() ? 'Minhas habilidades' : 'Habilidades de ' + esc(nomeDe(reg))}</h3>
    <p class="sub" style="margin-bottom:14px">Aparecem para quem monta as equipes dos trabalhos</p>
    <div id="hab-corpo"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="hab-btn" onclick="trbHabSalvar()">Salvar</button></div>`, 'largo');
  trbHabDesenhar();
}
function trbHabDesenhar(){
  const e = trab.habEd, el = $('#hab-corpo'); if (!el) return;
  const grupos = [...new Set(trab.catalogo.map(c => c.grupo || 'Outras'))];
  const lado = (k, rot) => `<div class="fld full"><label>${rot}</label>
    <div class="pills-ed">${e[k].map((x, i) => `<span class="pill-ed">${esc(x)}<button type="button" onclick="trab.habEd.${k}.splice(${i},1);trbHabDesenhar()"
      aria-label="Tirar ${esc(x)}" title="Tirar">×</button></span>`).join('')}
      <input id="hab-${k}" list="hab-dl" placeholder="digite e tecle Enter" onkeydown="if(event.key==='Enter'||event.key===','){event.preventDefault();trbHabPor('${k}',this.value)}"></div>
    ${trab.catalogo.length ? `<div class="hab-cat">${grupos.map(g => `<div><span class="rot">${esc(g)}</span>${trab.catalogo.filter(c => (c.grupo || 'Outras') === g).map(c =>
      `<button type="button" class="chip mini ${e[k].includes(c.nome) ? k : ''}" aria-pressed="${e[k].includes(c.nome)}" onclick="trbHabAlternar('${k}', this.dataset.n)" data-n="${esc(c.nome)}">${esc(c.nome)}</button>`).join(' ')}</div>`).join('')}</div>` : ''}</div>`;
  el.innerHTML = `<div class="form-grid">${lado('tem', 'Já sabe')}${lado('quer', 'Quer desenvolver')}</div>
    <datalist id="hab-dl">${trab.catalogo.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist>`;
}
function trbHabPor(k, v){
  const e = trab.habEd; trbVirgulas(v).forEach(x => { if (!e[k].some(y => norm(y) === norm(x)) && e[k].length < 30) e[k].push(x.slice(0, 80)); });
  trbHabDesenhar(); $('#hab-' + k)?.focus();
}
function trbHabAlternar(k, n){ const e = trab.habEd; e[k] = e[k].includes(n) ? e[k].filter(x => x !== n) : [...e[k], n]; trbHabDesenhar(); }
async function trbHabSalvar(){
  const e = trab.habEd;
  ['tem', 'quer'].forEach(k => { const i = $('#hab-' + k); if (i?.value.trim()) trbHabPor(k, i.value); });
  const { data, error } = await sb.rpc('habilidades_salvar', { p:{ registro:e.reg, tem:e.tem, quer:e.quer } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível salvar as habilidades'), true);
  trab.hab.set(e.reg, { registro:e.reg, tem:e.tem, quer:e.quer });
  fechaModal(); toast('Habilidades salvas.');
  if (typeof e.aoSalvar === 'function') e.aoSalvar();
  else if (location.hash.startsWith('#/projetos/alocacao')) trbAlocDesenhar();
}

/* ============================================================
   PESSOAS E TRABALHOS — #/projetos/alocacao
   Cada trabalho é uma linha alta; à esquerda, a galeria das pessoas.
   Arrastar um rosto para uma linha põe a pessoa no trabalho (sem
   mouse: escolher o rosto e usar "Pôr aqui" na linha). Passar o
   mouse num rosto mostra o que a pessoa já sabe e o que quer
   desenvolver. A outra visão é a lista por pessoa.
   ============================================================ */
function trbAlocacao(){
  const a = trab.aloc;
  $('#main').innerHTML = cabecalho({ espaco:'Projetos', titulo:'Pessoas e trabalhos', secoes:secoesProjetos('alocacao'),
      acoes:[trbEu() != null ? `<button class="btn ghost" onclick="modalHabilidades()">${ic('pencil')} Minhas habilidades</button>` : '',
        trbPodeConvidar() ? `<button class="btn ghost" onclick="trbModalConvidado()">${ic('plus')} Convidado de fora</button>` : ''] }) + `
    <div class="filtros aloc-filtros">
      <div class="seg" role="group" aria-label="Visão">${[['trabalhos', 'Por trabalho'], ['pessoas', 'Por pessoa']].map(([k, l]) =>
        `<button class="${a.visao === k ? 'on' : ''}" aria-pressed="${a.visao === k}" onclick="trab.aloc.visao='${k}';trbAlocacao()">${l}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Pessoas">${[['trainees', 'Trainees'], ['membros', 'Toda a equipe'], ['convidados', 'Convidados']].map(([k, l]) =>
        `<button class="${a.quem === k ? 'on' : ''}" aria-pressed="${a.quem === k}" onclick="trab.aloc.quem='${k}';trbAlocDesenhar()">${l}</button>`).join('')}</div>
      <div class="seg" role="group" aria-label="Trabalhos">${[['abertos', 'Trabalhos abertos'], ['todos', 'Todos']].map(([k, l]) =>
        `<button class="${a.so === k ? 'on' : ''}" aria-pressed="${a.so === k}" onclick="trab.aloc.so='${k}';trbAlocDesenhar()">${l}</button>`).join('')}</div>
      <div class="fld cresce"><label for="al-q">Buscar pessoa</label><input id="al-q" type="search" value="${esc(a.q)}" placeholder="Nome, cargo ou habilidade"
        oninput="trab.aloc.q=this.value;clearTimeout(window._alQ);window._alQ=setTimeout(trbAlocDesenhar,120)"></div>
    </div>
    <div id="aloc-corpo"></div>`;
  trbAlocDesenhar();
}
/* as pessoas da galeria: membros ativos e convidados, como "m:<reg>" e "c:<id>" */
function trbPessoas(){
  const a = trab.aloc, q = norm(a.q);
  const casa = (...xs) => !q || xs.flat().some(x => norm(x).includes(q));
  const ms = a.quem === 'convidados' ? [] : (state.membros || []).filter(m => TRB_ATIVOS.includes(m.status) && (a.quem !== 'trainees' || ehTrainee(m)))
    .filter(m => casa(m.nome, m.cargo, m.departamento, trbHab(m.registro).tem, trbHab(m.registro).quer))
    .map(m => ({ k:'m:' + m.registro, m, nome:m.nome, trabalhos:trabalhosDe(m).filter(t => a.so === 'todos' || TRB_ABERTO(t)) }));
  const cs = a.quem === 'trainees' ? [] : trab.conv.filter(c => c.ativo && casa(c.nome, c.instituicao, c.habilidades, c.quer_desenvolver))
    .map(c => ({ k:'c:' + c.id, c, nome:c.nome, trabalhos:trbDoConvidado(c).filter(t => a.so === 'todos' || TRB_ABERTO(t)) }));
  return [...ms, ...cs].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'));
}
function trbAlocDesenhar(){
  const el = $('#aloc-corpo'); if (!el) return;
  const a = trab.aloc, ps = trbPessoas();
  if (a.sel && !ps.some(p => p.k === a.sel)) a.sel = null;
  const ts = trab.lista.filter(t => a.so === 'todos' || TRB_ABERTO(t));
  if (a.visao === 'pessoas'){ el.innerHTML = trbPorPessoaHTML(ps); return; }
  const algum = ts.some(trbPodeEditar);
  el.innerHTML = `<div class="aloc">
    <aside class="aloc-gente" aria-label="Pessoas">
      <div class="aloc-gente-topo"><b>${ps.length}</b> ${ps.length === 1 ? 'pessoa' : 'pessoas'} ${algum ? dica('Arraste um rosto para a linha de um trabalho. Sem mouse: escolha o rosto e use "Pôr aqui" na linha.') : ''}</div>
      <div class="aloc-galeria">${ps.map(p => trbBloco(p, algum)).join('') || '<p class="muted small" style="padding:10px">Ninguém com esse filtro.</p>'}</div>
    </aside>
    <div class="aloc-linhas">${ts.map(trbLinha).join('') || estado.vazio({ texto:'Nenhum trabalho aberto.',
      acao: trabalhoGestor() ? '<a class="btn ghost" href="#/projetos/trabalhos/novo">Novo trabalho</a>' : '' })}</div>
  </div>`;
}
function trbBloco(p, arrasta){
  const sel = trab.aloc.sel === p.k, n = p.trabalhos.length;
  const sub = p.m ? (p.m.cargo || '—') : (p.c.instituicao || 'Convidado');
  return `<button type="button" class="aloc-pessoa${p.c ? ' conv' : ''}${sel ? ' sel' : ''}${n ? '' : ' livre'}" data-k="${p.k}" aria-pressed="${sel}"
      ${arrasta ? `draggable="true" ondragstart="trbArrastar(event,'${p.k}')" ondragend="trbArrasteFim()"` : ''}
      onclick="trbEscolher('${p.k}')" onmouseenter="trbCartaoPessoa(this,'${p.k}')" onmouseleave="trbCartaoFechar()"
      onfocus="trbCartaoPessoa(this,'${p.k}')" onblur="trbCartaoFechar()" aria-describedby="aloc-pop">
    <span class="foto">${p.m ? avatarFoto(p.m, 56, 17) : convAvatar(p.c, 56, 17)}${n ? `<span class="n" title="${n} trabalho${n > 1 ? 's' : ''}">${n}</span>` : ''}</span>
    <span class="nm">${esc(nomeCurto(p.nome))}</span><span class="cg">${esc(sub)}</span></button>`;
}
/* o cartão do hover: o que a pessoa já sabe, o que quer e onde está */
function trbCartaoPessoa(el, k){
  const p = trbPessoaDe(k); if (!p) return;
  let pop = document.getElementById('aloc-pop');
  if (!pop){ pop = document.createElement('div'); pop.id = 'aloc-pop'; pop.setAttribute('role', 'tooltip'); document.body.appendChild(pop); }
  const tem = p.m ? trbHab(p.m.registro).tem : (p.c.habilidades || []), quer = p.m ? trbHab(p.m.registro).quer : (p.c.quer_desenvolver || []);
  pop.innerHTML = `<div class="topo">${p.m ? avatarFoto(p.m, 40, 13) : convAvatar(p.c, 40, 13)}<div><b>${esc(p.nome)}</b>
      <span>${p.m ? esc([p.m.cargo, p.m.departamento].filter(Boolean).join(', ') || '—')
        : `Convidado, ${esc(CONV_MOTIVOS[p.c.motivo] || '')}${p.c.instituicao ? ', ' + esc(p.c.instituicao) : ''}. Responde: ${esc(nomeCurto(nomeDe(p.c.responsavel)))}`}</span></div></div>
    <div class="lado"><span class="rot">Já sabe</span>${tem.length ? tem.map(x => `<span class="chip mini tem">${esc(x)}</span>`).join(' ') : '<span class="muted">sem registro</span>'}</div>
    <div class="lado"><span class="rot">Quer desenvolver</span>${quer.length ? quer.map(x => `<span class="chip mini quer">${esc(x)}</span>`).join(' ') : '<span class="muted">sem registro</span>'}</div>
    <div class="lado"><span class="rot">Trabalhos</span>${p.trabalhos.length ? p.trabalhos.map(t => `<span class="chip mini">${esc(t.codigo)}</span>`).join(' ') : '<span class="muted">nenhum</span>'}</div>`;
  pop.hidden = false;
  const r = el.getBoundingClientRect(), w = Math.min(320, innerWidth - 32);
  pop.style.width = w + 'px';
  let x = r.right + 10; if (x + w > innerWidth - 16) x = Math.max(16, r.left - w - 10);
  const y = Math.max(16, Math.min(r.top, innerHeight - pop.offsetHeight - 16));
  pop.style.left = x + 'px'; pop.style.top = y + 'px';
}
function trbCartaoFechar(){ const pop = document.getElementById('aloc-pop'); if (pop) pop.hidden = true; }
function trbPessoaDe(k){
  if (k.startsWith('m:')){ const m = (state.membros || []).find(x => x.registro === Number(k.slice(2)));
    return m && { k, m, nome:m.nome, trabalhos:trabalhosDe(m) }; }
  const c = trab.conv.find(x => x.id === k.slice(2));
  return c && { k, c, nome:c.nome, trabalhos:trbDoConvidado(c) };
}
function trbLinha(t){
  const a = trab.aloc, edito = trbPodeEditar(t), eq = trbEquipe(t), cv = trbConvidados(t), resp = t.responsaveis || [];
  const selP = a.sel ? trbPessoaDe(a.sel) : null, jaSel = selP && selP.trabalhos.some(x => x.id === t.id);
  const rosto = (k, av, nome, extra, tirar) => `<span class="aloc-rosto${extra}">${av}<span class="nm">${esc(nome)}</span>${
    edito && tirar ? `<button type="button" class="x" title="Tirar ${esc(nome)}" aria-label="Tirar ${esc(nome)} do trabalho ${t.numero}" onclick="trbTirar('${t.id}','${k}')">×</button>` : ''}</span>`;
  const g = trbGrupo(t);
  return `<section class="aloc-linha${edito ? ' edita' : ''}" data-t="${t.id}" aria-label="Trabalho ${t.numero}"
      ${edito ? `ondragover="trbSobre(event,this)" ondragleave="this.classList.remove('sobre')" ondrop="trbSoltar(event,'${t.id}')"` : ''}>
    <header><a class="num" href="${trbHref(t)}" title="${esc(t.codigo)}">${t.numero}</a>
      <span class="tx"><a class="ref" href="${trbHref(t)}">${esc(t.referencia)}</a>
        <span class="meta">${esc(TRB_TIPOS[t.tipo] || 'Outro')}${t.alocacao ? `, pede ${esc(t.alocacao)}` : ''}${
          t.complexidade ? `, complexidade ${t.complexidade}` : ''}${t.esforco ? `, esforço ${t.esforco}` : ''}</span></span>
      ${trbPill(t.status)}</header>
    <div class="aloc-grade">
      ${eq.map(m => rosto('m:' + m.registro, avatarFoto(m, 44, 14), nomeCurto(m.nome), resp.includes(m.registro) ? ' resp' : '',
        (m.grupos || []).includes(g?.nome))).join('')}
      ${cv.map(c => rosto('c:' + c.id, convAvatar(c, 44, 14), nomeCurto(c.nome), ' conv', true)).join('')}
      ${!eq.length && !cv.length ? `<span class="aloc-vazio">${edito ? 'Arraste as pessoas para cá' : 'Ninguém ainda'}</span>` : ''}
      ${edito && selP && !jaSel ? `<button type="button" class="aloc-por" onclick="trbPor('${t.id}','${a.sel}')">${ic('plus')} Pôr ${esc(nomeCurto(selP.nome))} aqui</button>` : ''}
    </div></section>`;
}
function trbEscolher(k){ trab.aloc.sel = trab.aloc.sel === k ? null : k; trbCartaoFechar(); trbAlocDesenhar();
  document.querySelector(`.aloc-pessoa[data-k="${k}"]`)?.focus({ preventScroll:true }); }
function trbArrastar(ev, k){
  trab.aloc.arrastando = k; trbCartaoFechar();
  ev.dataTransfer.effectAllowed = 'copy'; ev.dataTransfer.setData('text/plain', k);
  ev.currentTarget.classList.add('mov'); document.querySelector('.aloc')?.classList.add('arrastando');
}
function trbArrasteFim(){
  trab.aloc.arrastando = null;
  document.querySelectorAll('.aloc-pessoa.mov, .aloc-linha.sobre').forEach(x => x.classList.remove('mov', 'sobre'));
  document.querySelector('.aloc')?.classList.remove('arrastando');
}
function trbSobre(ev, el){ ev.preventDefault(); ev.dataTransfer.dropEffect = 'copy'; el.classList.add('sobre'); }
async function trbSoltar(ev, tid){
  ev.preventDefault();
  const k = trab.aloc.arrastando || ev.dataTransfer.getData('text/plain');
  trbArrasteFim();
  if (k) await trbPor(tid, k);
}
async function trbPor(tid, k){
  const p = trbPessoaDe(k), t = trab.lista.find(x => x.id === tid); if (!p || !t) return;
  if (p.trabalhos.some(x => x.id === tid)) return toast(`${nomeCurto(p.nome)} já está no trabalho ${t.numero}.`);
  const ok = await trbMexer(tid, p.m ? { adicionar:[p.m.registro] } : { convidados_adicionar:[p.c.id] }, true);
  if (ok) toast(`${nomeCurto(p.nome)} no trabalho ${t.numero}.`, false, { rotulo:'Desfazer', fn:() => trbTirar(tid, k, true) });
}
async function trbTirar(tid, k, quieto){
  const p = trbPessoaDe(k), t = trab.lista.find(x => x.id === tid); if (!p || !t) return;
  const ok = await trbMexer(tid, p.m ? { remover:[p.m.registro] } : { convidados_remover:[p.c.id] }, true);
  if (ok && !quieto) toast(`${nomeCurto(p.nome)} fora do trabalho ${t.numero}.`, false, { rotulo:'Desfazer', fn:() => trbPor(tid, k) });
}
/* a outra visão: cada pessoa e os trabalhos e projetos com ela */
function trbPorPessoaHTML(ps){
  if (!ps.length) return estado.vazio({ texto:'Ninguém com esse filtro.' });
  return `<div class="card" style="padding:0"><div class="wrap" style="max-height:none"><table class="tabela trabalho aloc-tab">
    <thead><tr><th>Pessoa</th><th>Trabalhos</th><th>Projetos</th><th>Já sabe</th><th>Quer desenvolver</th></tr></thead>
    <tbody>${ps.map(p => {
      const tem = p.m ? trbHab(p.m.registro).tem : (p.c.habilidades || []), quer = p.m ? trbHab(p.m.registro).quer : (p.c.quer_desenvolver || []);
      const pjs = p.m ? projetosDe(p.m).filter(x => x.status !== 'encerrado') : [];
      return `<tr><td><span class="aloc-quem">${p.m ? avatarFoto(p.m, 30, 10) : `<span class="conv-anel">${convAvatar(p.c, 30, 10)}</span>`}
          <span class="tx"><span class="nm">${esc(p.nome)}</span><span class="cg">${p.m ? esc(p.m.cargo || '—') : 'Convidado, por ' + esc(nomeCurto(nomeDe(p.c.responsavel)))}</span></span></span></td>
        <td>${p.trabalhos.length ? `<ul class="aloc-lista">${p.trabalhos.map(t => `<li><a href="${trbHref(t)}"><b>${esc(t.codigo)}</b> ${esc(t.referencia)}</a>${
            p.m && (t.responsaveis || []).includes(p.m.registro) ? ' <span class="pj-sup">Responsável</span>' : ''}</li>`).join('')}</ul>`
          : '<span class="muted">nenhum</span>'}</td>
        <td>${pjs.length ? `<ul class="aloc-lista">${pjs.map(x => `<li><a href="#/projetos/${esc(x.codigo)}">${esc(x.nome)}</a></li>`).join('')}</ul>` : '<span class="muted">—</span>'}</td>
        <td>${tem.map(x => `<span class="chip mini tem">${esc(x)}</span>`).join(' ') || '<span class="muted">—</span>'}</td>
        <td>${quer.map(x => `<span class="chip mini quer">${esc(x)}</span>`).join(' ') || '<span class="muted">—</span>'}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
}
