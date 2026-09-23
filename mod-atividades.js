/* ============================================================
   MÓDULO · ATIVIDADES
   O quadro de trabalho de cada grupo. Carregado sob demanda em
   #/atividades. Script clássico, não módulo ES — os handlers são
   onclick="…" e dependem de escopo global.

   Rotas:
     #/atividades                 o quadro do seu grupo
     #/atividades/<prefixo>       o quadro de um grupo (ORT, SIN…)
     #/atividades/carga           quanto cada pessoa está carregando
     #/atividades/card/<codigo>   uma atividade (ORT-14)

   Precisa da migração db/v15_atividades.sql. Sem ela, a tela diz
   isso em vez de quebrar. A db/v16_pessoal.sql acrescenta os
   cartões que nascem de um fato (solicitação, apontamento,
   ocorrência) e a decisão que concede acesso — sem ela o quadro
   funciona igual, só não tem bloco de origem.

   Depende da casca para: sb, $, esc, norm, state, can, toast,
   abreModal, fechaModal, fmtD, hojeISO, pad3, avatarFoto,
   registrarBusca, filtrarSimples, carregarNotificacoes, gruposEfetivos,
   state.itensAcesso (catálogo, para conceder na decisão).
   ============================================================ */

const atividades = {
  pronto:false, grupos:[], itens:[], grupoAtual:null, erro:null,
  filtro:{ q:'', pessoa:null, so:'' },   /* so: '' | 'atrasadas' | 'sinalizadas' | 'minhas' */
  card:null, arrastando:null, origem:null, reabrir:false
};

const COLUNAS = [
  ['backlog',   'Backlog'],
  ['a_fazer',   'A fazer'],
  ['fazendo',   'Em andamento'],
  ['revisao',   'Em revisão'],
  ['concluida', 'Concluída']
];
const PRIORIDADES = [
  ['baixa',  'Baixa',    'var(--dim)'],
  ['media',  'Média',    'var(--info)'],
  ['alta',   'Alta',     'var(--warn)'],
  ['urgente','Urgente',  'var(--bad)']
];
/* de onde o cartão veio, para o selo do quadro */
const ROTULO_ORIGEM = { solicitacao:'solicitação', apontamento:'apontamento', ocorrencia:'ocorrência' };
const rotuloStatus = s => (COLUNAS.find(c => c[0] === s) || [,s])[1];
const corPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [,,'var(--dim)'])[2];
const rotuloPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [,p])[1];

/* ============================================================
   CARGA
   ============================================================ */
async function atvCarregar(forcar){
  if (atividades.pronto && !forcar) return;
  const [g, a] = await Promise.all([
    /* grupos_visiveis traz TODO grupo ativo — inclusive os que eu não
       posso abrir — com o meu nível em cada um. A lista ser completa é
       de propósito: quadro que some não é quadro fechado, é quadro que
       ninguém sabe que precisa pedir acesso. */
    sb.from('grupos_visiveis').select('*').order('ordem').order('nome'),
    sb.from('atividades_quadro').select('*').eq('arquivada', false).order('ordem')
  ]);
  if (g.error || a.error){ atividades.erro = (g.error || a.error); return; }
  atividades.erro = null;
  atividades.grupos = g.data || [];
  atividades.itens  = a.data || [];
  atividades.pronto = true;
}

/* Todo grupo aparece para todo mundo. O que muda é o NÍVEL, que o
   banco calcula em meu_nivel_no_grupo() e manda junto:

     edicao   cria, move, comenta
     leitura  acompanha, não mexe
     nenhum   sabe que o quadro existe e nada mais

   A regra de verdade é a do banco; isto aqui só evita oferecer porta
   fechada. Os meus vêm primeiro na lista, que é o que se quer abrir. */
const nivelNoGrupo = g => g?.meu_nivel || 'nenhum';
const posso = {
  ver:    g => nivelNoGrupo(g) !== 'nenhum',
  editar: g => nivelNoGrupo(g) === 'edicao'
};
/* A ordem é SEMPRE a configurada em Administração -> Grupos. Ela é uma
   hierarquia que a equipe decidiu — escritório, gerência, PMO, supervisão,
   e por aí — e uma lista que se reordena sozinha conforme quem está
   olhando obriga a procurar o item toda vez. */
const meusGrupos = () => [...atividades.grupos].sort((a, b) =>
  (a.ordem || 0) - (b.ordem || 0) || a.nome.localeCompare(b.nome, 'pt'));

/* Mas o quadro que ABRE por padrão é outra pergunta: o mais importante
   entre os que são meus. Primeiro os que eu edito (estou no grupo, ou
   recebi edição), depois os que eu leio, e só então o primeiro da lista —
   que aí mostra a tela de quadro fechado, com a quem pedir.

   Numa equipe onde quase todo quadro é aberto, ordenar por "tenho acesso"
   abriria sempre o primeiro da lista para todo mundo; é o "tenho edição"
   que separa o meu trabalho do trabalho que eu apenas acompanho. */
function grupoPadrao(){
  const gs = meusGrupos();
  return gs.find(g => posso.editar(g)) || gs.find(g => posso.ver(g)) || gs[0];
}

function avisoSemMigracao(){
  return `<div class="aviso-box err"><b>Atividades ainda não está disponível.</b>
    A migração <span class="mono">db/v15_atividades.sql</span> precisa ser aplicada no Supabase.
    ${atividades.erro ? `<br><span class="small">Detalhe: ${esc(atividades.erro.message)}</span>` : ''}</div>`;
}

/* ============================================================
   ROTA
   ============================================================ */
async function pageAtividades(sub, sub2){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando as atividades…</div>`;
  await atvCarregar();
  if (atividades.erro){
    $('#main').innerHTML = `<div class="pg-head"><span class="eyebrow">Trabalho</span>
      <h1>Atividades</h1></div>` + avisoSemMigracao();
    return;
  }
  if (sub === 'card' && sub2) return telaCard(sub2);
  if (sub === 'carga')        return telaCarga();

  const gs = meusGrupos();
  if (!gs.length){
    $('#main').innerHTML = `<div class="pg-head"><span class="eyebrow">Trabalho</span>
      <h1>Atividades</h1></div>
      <div class="vazio"><div class="glyph">—</div><h3>Nenhum quadro ainda</h3>
      <p>Os quadros são por grupo, e ainda não existe nenhum. Quem cria é a
      Administração, em Grupos.</p></div>`;
    return;
  }
  atividades.grupoAtual = gs.find(g => g.prefixo === (sub||'').toUpperCase())
    || gs.find(g => g.id === atividades.grupoAtual?.id)
    || grupoPadrao();
  /* O endereço passa a dizer qual quadro está aberto: #/atividades vira
     #/atividades/ORT. Assim o link copiado abre o mesmo quadro e o menu
     lateral acende o item certo. replaceState não dispara hashchange. */
  const aqui = '#/atividades/' + (atividades.grupoAtual.prefixo || '');
  if (atividades.grupoAtual.prefixo && location.hash !== aqui)
    history.replaceState(null, '', location.pathname + location.search + aqui);
  telaQuadro();
}

/* ============================================================
   O QUADRO
   ============================================================ */
function telaQuadro(){
  const g = atividades.grupoAtual;
  const f = atividades.filtro;
  const edito = posso.editar(g);

  /* Quadro que eu não posso abrir: a tela diz o que é, de quem é e a
     quem pedir. Some seria pior — ninguém pede acesso a uma tela que
     não sabe que existe. */
  if (!posso.ver(g)){
    $('#main').innerHTML = topoQuadro(g, false) + `
      <div class="kb-fechado">
        <div class="cad">${icCadeado()}</div>
        <h3>${esc(g.nome)} é um quadro fechado</h3>
        <p>Você vê que ele existe, mas não as atividades dele. São
           ${g.pessoas || 0} pessoa${(g.pessoas||0)===1?'':'s'} no grupo.</p>
        <p class="sub">Para acompanhar, peça acesso a quem administra o portal —
           é uma permissão por quadro, e não precisa colocar você no grupo.</p>
        <div class="acts"><a class="btn ghost" href="#/servicos/solicitacoes">Abrir uma solicitação</a></div>
      </div>`;
    return;
  }

  $('#main').innerHTML = topoQuadro(g, true) + `
    <div class="filtros kb-filtros">
      <div class="fld cresce"><label>Buscar</label>
        <input value="${esc(f.q)}" placeholder="Código, título ou responsável"
          oninput="atividades.filtro.q=this.value;desenhaColunas()"></div>
      <div class="fld"><label>Pessoa</label>
        <select onchange="atividades.filtro.pessoa=this.value?+this.value:null;desenhaColunas()">
          <option value="">Todas</option>
          ${pessoasDoGrupo().map(m => `<option value="${m.registro}" ${f.pessoa===m.registro?'selected':''}
            >${esc(m.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Recorte</label>
        <select onchange="atividades.filtro.so=this.value;desenhaColunas()">
          <option value="">Tudo</option>
          <option value="minhas"      ${f.so==='minhas'?'selected':''}>Só as minhas</option>
          <option value="atrasadas"   ${f.so==='atrasadas'?'selected':''}>Só atrasadas</option>
          <option value="sinalizadas" ${f.so==='sinalizadas'?'selected':''}>Só sinalizadas</option>
        </select></div>
      <div id="atv-resumo"></div>
    </div>
    <div class="kanban${edito?'':' so-leitura'}" id="kanban"></div>`;
  desenhaColunas();
  ajustarAlturaQuadro();
}

/* ============================================================
   O TOPO — e o seletor de grupo
   Eram abas. Com nove grupos a fileira quebrava em duas linhas e
   empurrava o quadro para baixo, que é justamente o espaço que
   falta. Um botão só, que abre a lista, ocupa uma linha sempre.
   ============================================================ */
function topoQuadro(g, comAcoes){
  const edito = posso.editar(g);
  return `
    <div class="kb-topo">
      <div class="kb-ident">
        <span class="eyebrow">Trabalho</span>
        <div class="kb-linha">
          <h1>Atividades</h1>
          ${seletorGrupo(g)}
        </div>
      </div>
      <div class="kb-acoes">
        <a class="btn ghost" href="#/atividades/carga">Carga da equipe</a>
        ${comAcoes && edito
          ? `<button class="btn solid" onclick="modalNovaAtividade()">Nova atividade</button>` : ''}
        ${comAcoes && !edito
          ? `<span class="kb-selo">${icCadeado(13)} só leitura</span>` : ''}
      </div>
    </div>`;
}

function seletorGrupo(g){
  const gs = meusGrupos();
  return `<div class="grp-sel">
    <button class="grp-btn" onclick="abrirSeletorGrupo(event)" aria-haspopup="listbox">
      <span class="pf">${esc(g.prefixo)}</span>
      <span class="nm">${esc(g.nome)}</span>
      ${gs.length > 1 ? `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        stroke-width="1.8" stroke-linecap="round"><path d="m6 9.5 6 6 6-6"/></svg>` : ''}
    </button>
    <div class="grp-pop" id="grp-pop" hidden>
      ${gs.length > 7 ? `<input id="grp-filtro" placeholder="filtrar…" autocomplete="off"
        oninput="filtrarGrupos(this.value)">` : ''}
      <div class="grp-lista" id="grp-lista" role="listbox">
        ${gs.map(x => `<a href="#/atividades/${x.prefixo}" data-nome="${esc(x.nome)}"
          class="grp-item ${x.id===g.id?'on':''} ${posso.ver(x)?'':'travado'}" role="option">
          <span class="pf">${esc(x.prefixo)}</span>
          <span class="nm">${esc(x.nome)}</span>
          ${posso.ver(x)
            ? (posso.editar(x) ? '' : '<span class="tag">leitura</span>')
            : icCadeado(13)}
        </a>`).join('')}
      </div>
    </div>
  </div>`;
}

const icCadeado = (px) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor"
  stroke-width="1.7" stroke-linecap="round"${px?` style="width:${px}px;height:${px}px"`:''}
  ><rect x="5" y="10.5" width="14" height="9.5" rx="2.5"/><path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7"/></svg>`;

function abrirSeletorGrupo(ev){
  ev?.stopPropagation();
  const p = $('#grp-pop'); if (!p) return;
  p.hidden = !p.hidden;
  if (!p.hidden) $('#grp-filtro')?.focus();
}
function filtrarGrupos(t){
  const q = norm(t);
  document.querySelectorAll('#grp-lista .grp-item').forEach(el => {
    el.style.display = (!q || norm(el.dataset.nome).includes(q)) ? '' : 'none';
  });
}
document.addEventListener('click', e => {
  const p = document.getElementById('grp-pop');
  if (p && !p.hidden && !e.target.closest('.grp-sel')) p.hidden = true;
});

/* O quadro ocupa o que sobra da janela, e cada coluna rola por
   dentro. Assim não há rolagem horizontal nem rolagem da página:
   as cinco colunas cabem sempre, e o que é longo é a coluna. */
function ajustarAlturaQuadro(){
  const k = document.getElementById('kanban'); if (!k) return;
  if (window.innerWidth <= 900){ k.style.height = ''; return; }
  const topo = k.getBoundingClientRect().top + window.scrollY;
  k.style.height = Math.max(340, window.innerHeight - topo - 18) + 'px';
}
window.addEventListener('resize', () => { if (document.getElementById('kanban')) ajustarAlturaQuadro(); });

/* quem está no grupo do quadro — contando quem chegou por um subgrupo */
function pessoasDoGrupo(){
  const g = atividades.grupoAtual;
  return (state.membros || []).filter(m => gruposEfetivos(m).has(g?.nome)
    && ['Ativo','Em pausa / avaliação'].includes(m.status));
}

function itensVisiveis(){
  const g = atividades.grupoAtual, f = atividades.filtro, q = norm(f.q);
  return atividades.itens.filter(a =>
    a.grupo_id === g.id &&
    (!f.pessoa || a.responsavel === f.pessoa) &&
    (f.so !== 'minhas'      || a.responsavel === state.perfil?.registro) &&
    (f.so !== 'atrasadas'   || a.atrasada) &&
    (f.so !== 'sinalizadas' || a.sinalizada) &&
    (!q || norm(a.codigo).includes(q) || norm(a.titulo).includes(q)
        || norm(a.responsavel_nome).includes(q))
  );
}

function desenhaColunas(){
  const vis = itensVisiveis();
  const atrasadas = vis.filter(a => a.atrasada).length;
  const sinal     = vis.filter(a => a.sinalizada).length;
  const semDono   = vis.filter(a => !a.responsavel && a.status !== 'concluida').length;

  const r = $('#atv-resumo');
  if (r) r.innerHTML = (atrasadas || sinal || semDono) ? `<div class="atv-resumo">
    ${atrasadas ? `<button class="res-pill bad" onclick="atividades.filtro.so='atrasadas';telaQuadro()">
      ${atrasadas} atrasada${atrasadas>1?'s':''}</button>` : ''}
    ${sinal ? `<button class="res-pill warn" onclick="atividades.filtro.so='sinalizadas';telaQuadro()">
      ${sinal} sinalizada${sinal>1?'s':''}</button>` : ''}
    ${semDono ? `<span class="res-pill">${semDono} sem responsável</span>` : ''}
  </div>` : '';

  const edito = posso.editar(atividades.grupoAtual);
  $('#kanban').innerHTML = COLUNAS.map(([st, rot]) => {
    const cards = vis.filter(a => a.status === st).sort((a,b) => a.ordem - b.ordem);
    const alvo = edito
      ? `ondragover="event.preventDefault();this.classList.add('sobre')"
         ondragleave="this.classList.remove('sobre')"
         ondrop="soltarEm(event,'${st}',null)"` : '';
    return `<section class="kb-col" data-st="${st}" ${alvo}>
      <header><span>${rot}</span><span class="n">${cards.length}</span></header>
      <div class="kb-itens">${cards.map(cartaoHTML).join('')
        || '<div class="kb-vazio">nada aqui</div>'}</div>
      ${edito ? `<button class="kb-add" onclick="modalNovaAtividade('${st}')">+ atividade</button>` : ''}
    </section>`;
  }).join('');
}

function cartaoHTML(a){
  const dono = (state.membros || []).find(m => m.registro === a.responsavel);
  const edito = posso.editar(atividades.grupoAtual);
  /* O brilho no topo é o sinal sempre presente: cor da prioridade, ou
     âmbar quando o cartão está sinalizado — sinalizado é "olhe para
     mim", que é justamente o que um brilho quer dizer. O ponto de
     prioridade continua ali, então nada se perde na troca. */
  const cor = a.sinalizada ? 'var(--warn)' : corPrioridade(a.prioridade);
  const arraste = edito
    ? `draggable="true"
       ondragstart="atividades.arrastando='${a.id}';this.classList.add('mov');event.dataTransfer.effectAllowed='move'"
       ondragend="this.classList.remove('mov');document.querySelectorAll('.kb-col').forEach(c=>c.classList.remove('sobre'))"
       ondragover="event.preventDefault();event.stopPropagation()"
       ondrop="event.stopPropagation();soltarEm(event,'${a.status}','${a.id}')"`
    : '';
  return `<article class="kb-card${a.sinalizada?' sinalizada':''}${edito?'':' fixo'}"
    style="--pri:${cor}" data-id="${a.id}" ${arraste}
    onclick="location.hash='#/atividades/card/${a.codigo}'">
    <div class="kb-top">
      <span class="kb-ids">
        <span class="cod">${esc(a.codigo)}</span>
        ${a.origem_tipo ? `<span class="org" title="Nasceu de uma ${esc(ROTULO_ORIGEM[a.origem_tipo] || a.origem_tipo)}"
          >${esc(ROTULO_ORIGEM[a.origem_tipo] || a.origem_tipo)}</span>` : ''}
      </span>
      <span class="pri" style="background:${corPrioridade(a.prioridade)}"
        title="Prioridade ${rotuloPrioridade(a.prioridade).toLowerCase()}"></span>
    </div>
    <div class="kb-tit">${esc(a.titulo)}</div>
    ${a.sinalizada ? `<div class="kb-flag">${esc(a.sinalizada_motivo || 'Precisa de atenção')}</div>` : ''}
    <div class="kb-pe">
      ${dono ? avatarFoto(dono, 22, 9) : '<span class="kb-sem">sem responsável</span>'}
      <span class="kb-meta">
        ${a.prazo ? `<span class="${a.atrasada?'atrasado':''}">${fmtD(a.prazo)}</span>` : ''}
        ${a.comentarios ? `<span title="${a.comentarios} comentário(s)">${a.comentarios}c</span>` : ''}
      </span>
    </div>
  </article>`;
}

/* ---- mover: solta na coluna (fim) ou sobre um cartão (antes dele) ---- */
async function soltarEm(ev, status, antesDoId){
  ev.preventDefault();
  document.querySelectorAll('.kb-col').forEach(c => c.classList.remove('sobre'));
  const id = atividades.arrastando; atividades.arrastando = null;
  if (!id) return;
  const a = atividades.itens.find(x => x.id === id);
  if (!a) return;

  const naColuna = atividades.itens
    .filter(x => x.grupo_id === a.grupo_id && x.status === status && x.id !== id)
    .sort((x,y) => x.ordem - y.ordem);
  let ordem;
  if (!antesDoId || antesDoId === id){
    ordem = (naColuna.length ? naColuna[naColuna.length-1].ordem : 0) + 1000;
  } else {
    const ix = naColuna.findIndex(x => x.id === antesDoId);
    const antes = ix > 0 ? naColuna[ix-1].ordem : (naColuna[ix]?.ordem ?? 0) - 2000;
    const alvo  = naColuna[ix]?.ordem ?? 0;
    ordem = (antes + alvo) / 2;
  }
  if (a.status === status && Math.abs(a.ordem - ordem) < 0.0001) return;

  /* pinta na hora e conserta se o banco recusar — arrastar precisa
     parecer instantâneo, e a RLS ainda é quem decide */
  const antesStatus = a.status, antesOrdem = a.ordem;
  a.status = status; a.ordem = ordem;
  if (status === 'concluida' && antesStatus !== 'concluida') a.atrasada = false;
  desenhaColunas();

  const { data, error } = await sb.rpc('atividade_editar', { p: { id, status, ordem } });
  if (error || data?.status !== 'ok'){
    a.status = antesStatus; a.ordem = antesOrdem;
    desenhaColunas();
    toast(data?.status === 'sem_permissao'
      ? 'Só quem está no grupo move as atividades dele.'
      : 'Não foi possível mover' + (error ? ': ' + error.message : '.'), true);
    return;
  }
  await atvCarregar(true); desenhaColunas(); carregarNotificacoes();
}

/* ============================================================
   NOVA ATIVIDADE
   ============================================================ */
function modalNovaAtividade(status){
  const g = atividades.grupoAtual;
  abreModal(`<h3>Nova atividade</h3>
    <p class="sub" style="margin-bottom:16px">Em ${esc(g.nome)} · o código sai na hora de salvar</p>
    <div class="form-grid">
      <div class="fld full"><label>O que precisa ser feito</label>
        <input id="na-tit" placeholder="Calibrar o encoder do protótipo"></div>
      <div class="fld full"><label>Detalhes (opcional)</label>
        <textarea id="na-desc" rows="3" placeholder="Contexto, critério de pronto, links…"></textarea></div>
      <div class="fld"><label>Responsável</label>
        <select id="na-resp"><option value="">— ninguém ainda —</option>
          ${pessoasDoGrupo().map(m => `<option value="${m.registro}"
            ${m.registro===state.perfil?.registro?'selected':''}>${esc(m.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label>Prazo</label><input id="na-prazo" type="date"></div>
      <div class="fld"><label>Prioridade</label>
        <select id="na-pri">${PRIORIDADES.map(([k,l]) =>
          `<option value="${k}" ${k==='media'?'selected':''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label>Coluna</label>
        <select id="na-status">${COLUNAS.map(([k,l]) =>
          `<option value="${k}" ${k===(status||'a_fazer')?'selected':''}>${l}</option>`).join('')}</select></div>
    </div>
    <p class="err-msg" id="na-erro"></p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="na-btn" onclick="salvarNovaAtividade()">Criar</button></div>`, true);
  setTimeout(() => $('#na-tit')?.focus(), 50);
}
async function salvarNovaAtividade(){
  const tit = $('#na-tit').value.trim();
  if (!tit){ $('#na-erro').textContent = 'Diga o que precisa ser feito.'; return; }
  $('#na-btn').disabled = true;
  try{
    const { data, error } = await sb.rpc('atividade_criar', { p: {
      grupo_id: atividades.grupoAtual.id,
      titulo: tit,
      descricao: $('#na-desc').value.trim() || null,
      responsavel: $('#na-resp').value || null,
      prazo: $('#na-prazo').value || null,
      prioridade: $('#na-pri').value,
      status: $('#na-status').value
    }});
    if (error || data?.status !== 'ok'){
      $('#na-erro').textContent = data?.status === 'sem_permissao'
        ? 'Só quem está no grupo cria atividades nele.'
        : 'Não foi possível criar' + (error ? ': ' + error.message : '.');
      return;
    }
    fechaModal();
    toast(`${data.codigo} criada.`);
    await atvCarregar(true);
    if (location.hash.startsWith('#/atividades/card')) telaCard(data.codigo); else desenhaColunas();
  }catch(e){
    falha(e, 'Não foi possível salvar');
  }finally{
    const b = $('#na-btn'); if (b) b.disabled = false;
  }
}

/* ============================================================
   O CARTÃO — #/atividades/card/<codigo>
   ============================================================ */
async function telaCard(codigo){
  if (norm(atividades.card?.codigo || '') !== norm(codigo)) atividades.reabrir = false;
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando ${esc(codigo)}…</div>`;
  await atvCarregar(true);
  const a = atividades.itens.find(x => norm(x.codigo) === norm(codigo));
  if (!a){
    $('#main').innerHTML = `<div class="topo-gestao"><div class="tx">
      <span class="eyebrow">Atividade</span><h1>${esc(codigo)} não encontrada</h1>
      <p class="lead">O código não existe, ou a atividade foi arquivada.</p></div></div>
      <div class="acts"><a class="btn ghost" href="#/atividades">Voltar ao quadro</a></div>`;
    return;
  }
  atividades.card = a;
  const [c, l, s, o] = await Promise.all([
    sb.from('atividade_comentarios').select('*').eq('atividade_id', a.id).order('criado_em'),
    sb.from('atividade_log').select('*').eq('atividade_id', a.id).order('criado_em', { ascending:false }).limit(40),
    sb.from('atividade_seguidores').select('registro').eq('atividade_id', a.id),
    a.origem_tipo ? sb.rpc('atividade_origem_detalhe', { p_codigo: a.codigo }) : Promise.resolve({ data:null })
  ]);
  atividades.origem = o.data || null;
  desenhaCard(a, c.data || [], l.data || [], (s.data || []).map(x => x.registro), o.data || null);
}

function desenhaCard(a, comentarios, log, seguidores, origem){
  const sigo = seguidores.includes(state.perfil?.registro);
  const dono = (state.membros || []).find(m => m.registro === a.responsavel);
  const pes  = pessoasDoGrupoDe(a.grupo_id, a.responsavel);

  $('#main').innerHTML = `
    <div class="topo-gestao">
      <div style="padding-top:34px"><a class="icon-btn" href="#/atividades/${esc(a.grupo_prefixo)}"
        title="Voltar ao quadro" aria-label="Voltar ao quadro">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></a></div>
      <div class="tx"><span class="eyebrow">${esc(a.grupo)} · ${esc(a.codigo)}</span>
        <h1 id="cd-titulo" class="editavel" onclick="editarTitulo()">${esc(a.titulo)}</h1>
        ${a.atrasada ? `<p class="lead" style="color:var(--bad)">Atrasada desde ${fmtD(a.prazo)}.</p>` : ''}</div>
      <div class="acoes">
        <button class="btn ghost" onclick="alternarSeguir(${sigo})">${sigo?'Seguindo':'Seguir'}</button>
        <button class="btn ${a.sinalizada?'solid':'ghost'}" onclick="modalSinalizar()">
          ${a.sinalizada ? 'Sinalizada' : 'Sinalizar'}</button>
      </div>
    </div>

    ${a.sinalizada ? `<div class="aviso-box warn"><b>Precisa de atenção.</b>
      ${esc(a.sinalizada_motivo || '')}</div>` : ''}

    <div class="cd-grade">
      <div>
        ${blocoOrigem(a, origem)}
        <div class="card" style="margin-bottom:16px">
          <h3>Descrição</h3>
          <div id="cd-desc" class="cd-desc editavel" onclick="editarDescricao()">${
            a.descricao ? esc(a.descricao) : '<span class="muted">Sem detalhes. Clique para escrever.</span>'}</div>
        </div>

        <div class="card" style="margin-bottom:16px">
          <h3>Comentários ${comentarios.length ? `<span class="muted">(${comentarios.length})</span>` : ''}</h3>
          <p class="sub" style="margin-bottom:16px">Mencione alguém para escalar o problema — a pessoa é notificada</p>
          <div class="cd-coments">${comentarios.map(c => {
            const q = (state.membros||[]).find(m => m.registro === c.registro);
            return `<div class="cm">
              ${q ? avatarFoto(q, 28, 10) : ''}
              <div class="cm-cx"><div class="cm-tp"><b>${esc(q?.nome || 'Alguém')}</b>
                <span>${fmtQuando(c.criado_em)}</span></div>
              <div class="cm-cp">${esc(c.corpo)}</div></div></div>`;
          }).join('') || '<div class="kb-vazio" style="text-align:left">Nenhum comentário ainda.</div>'}</div>
          <div class="cd-novo">
            <textarea id="cd-coment" rows="2" placeholder="Escreva um comentário…"></textarea>
            <div class="cd-menc">
              <span class="small muted">Marcar:</span>
              ${pes.map(m => `<button class="chip mini" data-reg="${m.registro}"
                onclick="this.classList.toggle('on')">${esc(m.nome.split(' ')[0])}</button>`).join(' ')}
            </div>
            <div class="acts" style="margin-top:10px">
              <button class="btn solid" id="cd-btn" onclick="enviarComentario()">Comentar</button></div>
          </div>
        </div>
      </div>

      <div>
        <div class="card" style="margin-bottom:16px">
          <h3>Situação</h3>
          <div class="cd-campos" style="margin-top:14px">
            <div class="fld"><label>Coluna</label>
              <select onchange="mudarCampo('status', this.value)">${COLUNAS.map(([k,l]) =>
                `<option value="${k}" ${k===a.status?'selected':''}>${l}</option>`).join('')}</select></div>
            <div class="fld"><label>Responsável</label>
              <select onchange="mudarCampo('responsavel', this.value)">
                <option value="">— ninguém —</option>
                ${pes.map(m => `<option value="${m.registro}" ${m.registro===a.responsavel?'selected':''}
                  >${esc(m.nome)}</option>`).join('')}</select></div>
            <div class="fld"><label>Prazo</label>
              <input type="date" value="${esc(a.prazo||'')}" onchange="mudarCampo('prazo', this.value)"></div>
            <div class="fld"><label>Prioridade</label>
              <select onchange="mudarCampo('prioridade', this.value)">${PRIORIDADES.map(([k,l]) =>
                `<option value="${k}" ${k===a.prioridade?'selected':''}>${l}</option>`).join('')}</select></div>
            <div class="fld"><label>Estimativa (horas)</label>
              <input type="number" step="0.5" min="0" value="${a.estimativa_h ?? ''}"
                onchange="mudarCampo('estimativa_h', this.value)"></div>
          </div>
          <div class="dl" style="margin-top:6px">
            <div class="it"><dt>Criada por</dt><dd>${esc(a.criado_por_nome || '—')}</dd></div>
            <div class="it"><dt>Criada em</dt><dd>${fmtD(String(a.criado_em).slice(0,10))}</dd></div>
          </div>
          <div class="acts" style="margin-top:14px">
            <button class="btn ghost" onclick="arquivarAtividade()">Arquivar</button></div>
        </div>

        <div class="card"><h3>Histórico</h3>
          <p class="sub" style="margin-bottom:14px">Tudo o que aconteceu com esta atividade</p>
          <div class="timeline">${log.map(e => {
            const q = (state.membros||[]).find(m => m.registro === e.registro);
            return `<div class="tl-item"><div class="dt">${fmtQuando(e.criado_em)}</div>
              <div class="tp">${esc(frasesLog(e))}</div>
              <div class="rp">${esc(q?.nome || 'sistema')}</div></div>`;
          }).join('') || '<div class="kb-vazio" style="text-align:left">Sem histórico.</div>'}</div>
        </div>
      </div>
    </div>`;
}

/* ============================================================
   DE ONDE VEIO O CARTÃO
   Um cartão do quadro do Pessoal pode ter nascido de uma
   solicitação, de um apontamento ou de uma ocorrência. Este bloco
   mostra o fato e — quando é solicitação — decide.

   Decidir aqui faz o que antes eram dois passos em duas telas:
   responder a solicitação e conceder o acesso na ficha. Quem
   esquecia o segundo deixava a pessoa com um "aprovado" que não
   abria porta nenhuma.
   ============================================================ */
/* STATUS_SOL e TIPOS_SOL são da casca — módulo não redeclara o que a
   casca já é dona de nomear (e, em script clássico, redeclarar um
   const global derruba o módulo inteiro na hora de carregar). */
/* rótulos dos campos que cada tipo de solicitação guarda em "dados" */
const ROTULO_DADOS = {
  item:'Item pedido', justificativa:'Justificativa', tempo_necessario:'Por quanto tempo',
  observacoes:'Observações', data_inicio:'Início', data_fim:'Fim', motivo:'Motivo',
  data_prevista:'Data prevista', gestor_registro:'Gestor', tema:'Tema',
  preferencia:'Preferência', urgencia:'Urgência', descricao:'Descrição'
};

function blocoOrigem(a, o){
  if (!a.origem_tipo) return '';
  if (!o) return `<div class="card" style="margin-bottom:16px"><h3>De onde veio</h3>
    <p class="sub">Este cartão nasceu de ${esc(a.origem_tipo)}, mas o registro de
      origem não foi encontrado — pode ter sido apagado.</p></div>`;
  if (o.status === 'sem_permissao') return `<div class="card" style="margin-bottom:16px">
    <h3>De onde veio</h3><p class="sub">Você não tem acesso ao conteúdo da origem.</p></div>`;

  if (o.tipo === 'solicitacao')  return origemSolicitacao(o);
  if (o.tipo === 'ocorrencia')   return origemOcorrencia(o);
  if (o.tipo === 'apontamento')  return origemApontamento(o);
  return '';
}

const linhaDl = (dt, dd) => `<div class="it"><dt>${esc(dt)}</dt><dd>${dd}</dd></div>`;

function origemSolicitacao(o){
  const dados = o.dados || {};
  const campos = Object.keys(dados)
    .filter(k => k !== 'item_id' && dados[k] != null && String(dados[k]).trim() !== '')
    .map(k => linhaDl(ROTULO_DADOS[k] || k, esc(String(dados[k])))).join('');
  const fechada = ['aprovada','recusada','concluida','cancelada'].includes(o.status)
                  && !atividades.reabrir;

  return `<div class="card" style="margin-bottom:16px">
    <h3>De onde veio</h3>
    <p class="sub" style="margin-bottom:14px">Solicitação ${esc(o.protocolo || '')} —
      ${esc(TIPOS_SOL[o.especie] || o.especie)} · <span class="pill"><span class="dt"
        style="background:${esc(STATUS_SOL[o.status]?.c || 'var(--dim)')}"></span
        >${esc(STATUS_SOL[o.status]?.l || o.status)}</span></p>
    <div class="dl">
      ${linhaDl('Quem pediu', `<a href="#/equipe/${o.registro}">${esc(o.membro || ('Registro '+o.registro))}</a>`)}
      ${linhaDl('Aberta em', fmtD(String(o.criado_em).slice(0,10)))}
      ${campos}
    </div>
    ${o.resposta ? `<div class="aviso-box" style="margin-top:14px"><b>Resposta:</b>
      ${esc(o.resposta)}<br><span class="small muted">${esc(o.respondido_por || '')}${
        o.respondido_em ? ' · ' + fmtD(String(o.respondido_em).slice(0,10)) : ''}</span></div>` : ''}
    ${can() ? formDecisao(o, fechada) : (fechada ? '' :
      `<p class="sub" style="margin-top:14px">Só o Depto de Pessoal decide esta solicitação.</p>`)}
  </div>`;
}

function formDecisao(o, fechada){
  const itens = (state.itensAcesso || []);
  const jaAtivo = new Set((o.acessos || []).filter(x => x.ativo).map(x => x.item_id));
  const pedido  = (o.dados || {}).item_id || null;
  /* o pedido ainda não concedido vem marcado: é a resposta mais provável */
  const marcado = id => id === pedido && !jaAtivo.has(id);

  const listaAcessos = o.especie !== 'acesso' ? '' : `
    <div class="fld full" style="margin-top:4px">
      <label>Conceder acesso a</label>
      ${itens.length ? `<div class="multi" style="max-height:none">${itens.map(i => `
        <label class="check"><input type="checkbox" class="dec-item" value="${esc(i.id)}"
          ${marcado(i.id) ? 'checked' : ''} ${jaAtivo.has(i.id) ? 'disabled' : ''}>
          <span>${esc(i.nome)}${jaAtivo.has(i.id) ? ' — já concedido' : ''}</span>
        </label>`).join('')}</div>`
        : '<p class="sub">O catálogo de acessos está vazio.</p>'}
      <p class="small muted" style="margin-top:6px">O que você marcar entra no quadro de
        acessos da pessoa junto com a decisão — não precisa passar pela ficha depois.</p>
    </div>`;

  if (fechada) return `<div class="acts" style="margin-top:14px">
    <button class="btn ghost" onclick="reabrirDecisao()">Rever a decisão</button></div>`;

  return `<div id="dec-form" style="margin-top:18px;border-top:1px solid var(--line);padding-top:16px">
    <h3 style="margin-bottom:4px">Decidir</h3>
    <div class="form-grid" style="margin-top:12px">
      <div class="fld"><label>Decisão</label>
        <select id="dec-status">
          <option value="aprovada">Aprovar</option>
          <option value="recusada">Recusar</option>
          <option value="em_analise">Deixar em análise</option>
        </select></div>
      <div class="fld full"><label>Resposta para quem pediu</label>
        <textarea id="dec-resposta" rows="3"
          placeholder="Obrigatória para recusar — ninguém merece um &quot;não&quot; sem explicação."></textarea></div>
      ${listaAcessos}
    </div>
    <div class="acts" style="margin-top:14px">
      <button class="btn solid" id="dec-btn" onclick="decidirSolicitacao()">Registrar decisão</button>
    </div>
  </div>`;
}

/* Rever uma decisão já tomada. O sinalizador vive no estado do módulo
   porque telaCard() recarrega a origem do banco: guardá-lo no objeto da
   origem seria apagado no caminho de volta. */
function reabrirDecisao(){
  atividades.reabrir = true;
  if (atividades.card) telaCard(atividades.card.codigo);
}

async function decidirSolicitacao(){
  const o = atividades.origem, a = atividades.card;
  if (!o || !a) return;
  const decisao  = $('#dec-status').value;
  const resposta = $('#dec-resposta').value.trim();
  if (decisao === 'recusada' && !resposta)
    return toast('Escreva o porquê antes de recusar.', true);

  const conceder = [...document.querySelectorAll('.dec-item:checked')].map(c => c.value);
  const btn = $('#dec-btn'); if (btn){ btn.disabled = true; btn.textContent = 'Registrando…'; }
  try{
    const { data, error } = await sb.rpc('pessoal_solicitacao_decidir', {
      p: { solicitacao_id:o.id, decisao, resposta: resposta || null, conceder }
    });
    if (error) throw error;
    if (data?.status === 'invalido')
      return toast(data.campo === 'resposta' ? 'Escreva o porquê antes de recusar.'
                                             : 'Decisão inválida.', true);
    if (data?.status !== 'ok')
      return toast(motivoRPC(data, null, 'Não foi possível registrar a decisão'), true);
    const n = data?.concedidos || 0;
    toast(n ? `Decisão registrada e ${n} acesso(s) concedido(s).` : 'Decisão registrada.');
    atividades.reabrir = false;
    if (typeof carregarNotificacoes === 'function') await carregarNotificacoes();
    await telaCard(a.codigo);
  }catch(e){
    toast('Não foi possível registrar: ' + (e.message || e), true);
  }finally{
    const b = $('#dec-btn'); if (b){ b.disabled = false; b.textContent = 'Registrar decisão'; }
  }
}

function origemOcorrencia(o){
  return `<div class="card" style="margin-bottom:16px">
    <h3>De onde veio</h3>
    <p class="sub" style="margin-bottom:14px">Ocorrência registrada na ficha do membro</p>
    <div class="dl">
      ${linhaDl('Tipo', esc(o.especie || '—'))}
      ${linhaDl('Membro', `<a href="#/equipe/${o.registro}">${esc(o.membro || ('Registro '+o.registro))}</a>`)}
      ${linhaDl('Data', o.data ? fmtD(String(o.data).slice(0,10)) : '—')}
      ${linhaDl('Registrada por', esc(o.responsavel || '—'))}
      ${o.descricao ? linhaDl('Descrição', esc(o.descricao)) : ''}
    </div>
    <div class="acts" style="margin-top:14px">
      <a class="btn ghost" href="#/equipe/${o.registro}">Abrir a ficha</a></div>
  </div>`;
}

function origemApontamento(o){
  const itens = o.itens || [];
  const sin = itens.filter(i => i.sinalizado);
  return `<div class="card" style="margin-bottom:16px">
    <h3>De onde veio</h3>
    <p class="sub" style="margin-bottom:14px">Apontamento semanal do grupo
      ${esc(o.grupo || '—')}${o.data ? ' — ' + fmtD(String(o.data).slice(0,10)) : ''}</p>
    <div class="dl">
      ${linhaDl('Entregue por', esc(o.responsavel || '—'))}
      ${linhaDl('Pessoas no apontamento', String(itens.length))}
      ${linhaDl('Sinalizadas', sin.length ? `<b style="color:var(--warn)">${sin.length}</b>` : '0')}
    </div>
    ${itens.length ? `<table class="tabela trabalho" style="margin-top:14px">
      <thead><tr><th>Membro</th><th>Assiduidade</th><th>Entregas</th><th>Sinalização</th></tr></thead>
      <tbody>${itens.map(i => `<tr>
        <td>${esc(i.membro || ('Registro '+i.registro))}</td>
        <td>${esc(i.assiduidade || '—')}</td>
        <td>${esc(i.entregas || '—')}</td>
        <td>${i.sinalizado
          ? `<span class="pill p-warn"><span class="dt dt-warn"></span>Sim</span>${
              i.justificativa ? `<div class="small muted" style="margin-top:4px">${esc(i.justificativa)}</div>` : ''}`
          : '—'}</td>
      </tr>`).join('')}</tbody></table>` : ''}
  </div>`;
}

/* As pessoas que podem responder por uma atividade do grupo — mais quem
   já responde por ela. Sem essa segunda parte, alguém que saiu do grupo
   sumia da lista, o seletor caía em "ninguém" e o próximo salvamento
   apagava o responsável sem ninguém pedir. */
function pessoasDoGrupoDe(grupoId, incluirRegistro){
  const g = atividades.grupos.find(x => x.id === grupoId);
  const lista = (state.membros || []).filter(m => gruposEfetivos(m).has(g?.nome)
    && ['Ativo','Em pausa / avaliação'].includes(m.status));
  if (incluirRegistro != null && !lista.some(m => m.registro === incluirRegistro)){
    const fora = (state.membros || []).find(m => m.registro === incluirRegistro);
    if (fora) lista.unshift({ ...fora, nome: fora.nome + ' (fora do grupo)' });
  }
  return lista;
}

function frasesLog(e){
  switch (e.tipo){
    case 'criou':        return 'Criou a atividade';
    case 'moveu':        return `Moveu de "${rotuloStatus(e.de)}" para "${rotuloStatus(e.para)}"`;
    case 'atribuiu':     return e.para ? `Atribuiu a ${e.para}` : 'Removeu o responsável';
    case 'prazo':        return e.para ? `Prazo para ${fmtD(e.para)}` : 'Removeu o prazo';
    case 'prioridade':   return `Prioridade: ${rotuloPrioridade(e.de)} → ${rotuloPrioridade(e.para)}`;
    case 'sinalizou':    return e.para ? `Sinalizou: ${e.para}` : 'Sinalizou como precisando de atenção';
    case 'dessinalizou': return 'Tirou a sinalização';
    case 'comentou':     return 'Comentou';
    case 'decidiu':      return `Decidiu a solicitação: ${e.de||'aberta'} → ${e.para}`;
    case 'concedeu':     return `Concedeu acesso: ${e.para}`;
    case 'editou':       return 'Editou o conteúdo';
    default:             return e.tipo;
  }
}

/* ---- edições no lugar ---- */
function editarTitulo(){
  const a = atividades.card, el = $('#cd-titulo');
  el.innerHTML = `<input id="cd-tit-in" value="${esc(a.titulo)}"
    style="width:100%;font:inherit;background:rgba(255,255,255,.05);border:1px solid var(--line2);
    border-radius:10px;padding:4px 10px;color:inherit">`;
  const i = $('#cd-tit-in'); i.focus(); i.select();
  const fim = () => mudarCampo('titulo', i.value.trim() || a.titulo);
  i.onblur = fim;
  i.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); i.blur(); }
                       if (e.key === 'Escape'){ i.onblur = null; telaCard(a.codigo); } };
}
function editarDescricao(){
  const a = atividades.card, el = $('#cd-desc');
  el.innerHTML = `<textarea id="cd-desc-in" rows="5"
    style="width:100%;background:rgba(255,255,255,.05);border:1px solid var(--line2);
    border-radius:10px;padding:10px 12px;color:inherit;font:inherit">${esc(a.descricao||'')}</textarea>
    <div class="acts" style="margin-top:10px">
      <button class="btn solid" onclick="salvarDescricao()">Salvar</button>
      <button class="btn ghost" onclick="telaCard('${esc(a.codigo)}')">Cancelar</button></div>`;
  $('#cd-desc-in').focus();
  el.onclick = null;
}
function salvarDescricao(){ mudarCampo('descricao', $('#cd-desc-in').value); }

async function mudarCampo(campo, valor){
  const a = atividades.card;
  const p = { id: a.id }; p[campo] = valor === '' ? null : valor;
  const { data, error } = await sb.rpc('atividade_editar', { p });
  if (error || data?.status !== 'ok'){
    toast(data?.status === 'sem_permissao'
      ? 'Só quem está no grupo edita as atividades dele.'
      : 'Não foi possível salvar' + (error ? ': ' + error.message : '.'), true);
    return telaCard(a.codigo);
  }
  toast('Salvo.');
  carregarNotificacoes();
  telaCard(a.codigo);
}

async function enviarComentario(){
  const a = atividades.card;
  const cx = $('#cd-coment'), b = $('#cd-btn');
  const corpo = (cx?.value || '').trim();
  if (!corpo || !a) return;
  const mencionados = [...document.querySelectorAll('.cd-menc .chip.on')].map(x => +x.dataset.reg);

  /* O try/finally é o que evita o comentário "pendurado": sem ele, um erro
     em qualquer linha daqui deixava o botão desabilitado para sempre e o
     texto parado na caixa, sem toast nenhum — parecia que o portal tinha
     engolido o comentário. E o texto só sai da caixa depois de o banco
     confirmar, para nunca se perder no caminho. */
  if (b){ b.disabled = true; b.textContent = 'Enviando…'; }
  try{
    const { data, error } = await sb.rpc('atividade_comentar',
      { p: { atividade_id: a.id, corpo, mencionados } });
    if (error || data?.status !== 'ok'){
      toast(motivoRPC(data, error, 'Não foi possível comentar'), true);
      return;
    }
    if (cx) cx.value = '';
    carregarNotificacoes();
    await telaCard(a.codigo);
  }catch(e){
    toast('Não foi possível comentar: ' + (e?.message || e), true);
  }finally{
    const btn = $('#cd-btn');
    if (btn){ btn.disabled = false; btn.textContent = 'Comentar'; }
  }
}

function modalSinalizar(){
  const a = atividades.card;
  if (a.sinalizada){
    abreModal(`<h3>Tirar a sinalização</h3>
      <p style="color:var(--muted);font-size:13.5px">${esc(a.sinalizada_motivo || '')}</p>
      <div class="acts" style="justify-content:flex-end">
        <button class="btn ghost" onclick="fechaModal()">Voltar</button>
        <button class="btn solid" onclick="salvarSinal(false)">Resolvido</button></div>`);
    return;
  }
  abreModal(`<h3>Sinalizar</h3>
    <p style="color:var(--muted);font-size:13.5px;margin-bottom:14px">Quem segue a atividade é avisado —
      e, se houver responsável, o gestor dele também. É assim que se escala um problema.</p>
    <div class="fld"><label>O que está acontecendo</label>
      <textarea id="sn-motivo" rows="3" placeholder="Bloqueada pelo fornecedor; sem resposta há uma semana…"></textarea></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="salvarSinal(true)">Sinalizar</button></div>`);
}
async function salvarSinal(ligar){
  const a = atividades.card;
  const { data, error } = await sb.rpc('atividade_sinalizar', { p: {
    id: a.id, sinalizada: ligar, motivo: ligar ? ($('#sn-motivo')?.value.trim() || null) : null }});
  fechaModal();
  if (error || data?.status !== 'ok'){ toast('Não foi possível sinalizar.', true); return; }
  carregarNotificacoes();
  telaCard(a.codigo);
}
async function alternarSeguir(sigoAgora){
  const a = atividades.card;
  await sb.rpc('atividade_seguir', { p: { id: a.id, seguir: !sigoAgora }});
  telaCard(a.codigo);
}
async function arquivarAtividade(){
  const a = atividades.card;
  const { data } = await sb.rpc('atividade_editar', { p: { id: a.id, arquivada: true }});
  if (data?.status !== 'ok'){ toast('Não foi possível arquivar.', true); return; }
  toast(`${a.codigo} arquivada.`);
  await atvCarregar(true);
  location.hash = '#/atividades/' + a.grupo_prefixo;
}

/* ============================================================
   CARGA DA EQUIPE
   ============================================================ */
async function telaCarga(){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Somando…</div>`;
  const { data, error } = await sb.from('atividades_carga').select('*').order('abertas', { ascending:false });
  const gs = meusGrupos();
  const linhas = (data || []).filter(x => x.abertas > 0 || x.atrasadas > 0);
  const max = Math.max(1, ...linhas.map(x => x.abertas));
  $('#main').innerHTML = `
    <div class="topo-gestao"><div class="tx"><span class="eyebrow">Trabalho</span>
      <h1>Carga da equipe</h1>
      <p class="lead">Quantas atividades abertas cada pessoa carrega, quantas estão atrasadas
        e quantas estão sinalizadas.</p></div></div>
    <nav class="abas">${gs.map(x =>
      `<a href="#/atividades/${x.prefixo}">${esc(x.nome)}</a>`).join('')}
      <a href="#/atividades/carga" class="on">Carga da equipe</a></nav>
    ${error ? avisoSemMigracao() : ''}
    ${linhas.length ? `<div class="card"><div class="barras">${linhas.map(x => `
      <div class="barra carga">
        <span class="k">${esc(x.nome)}</span>
        <span class="trilho"><span class="fill" style="width:${Math.round(x.abertas/max*100)}%"></span></span>
        <span class="n">${x.abertas}</span>
        <span class="tags">
          ${x.atrasadas ? `<span class="pill p-bad"><span class="dt dt-bad"></span>${x.atrasadas} atrasada${x.atrasadas>1?'s':''}</span>` : ''}
          ${x.sinalizadas ? `<span class="pill p-warn"><span class="dt dt-warn"></span>${x.sinalizadas}</span>` : ''}
          ${x.horas_abertas > 0 ? `<span class="small muted">${x.horas_abertas}h</span>` : ''}
        </span>
      </div>`).join('')}</div></div>`
      : '<div class="vazio"><div class="glyph">0</div><h3>Ninguém com atividade aberta</h3><p>Quando houver trabalho no quadro, a carga aparece aqui.</p></div>'}`;
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'atividades', rotulo:'Atividades',
  buscar: (t) => filtrarSimples(atividades.itens.map(a => ({
    titulo: a.titulo,
    sub: `${rotuloStatus(a.status)} · ${a.grupo}${a.responsavel_nome ? ' · ' + a.responsavel_nome : ''}`,
    codigo: a.codigo,
    href: '#/atividades/card/' + a.codigo
  })), t, 6)
});
