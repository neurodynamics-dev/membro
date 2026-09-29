/* ============================================================
   MÓDULO · ATIVIDADES
   O quadro de trabalho de cada grupo. Carregado sob demanda em
   #/atividades. Script clássico, não módulo ES — os handlers são
   onclick="…" e dependem de escopo global.

   Rotas:
     #/atividades                       o quadro do seu grupo
     #/atividades/<prefixo>             o quadro de um grupo (ORT, SIN…)
     #/atividades/<prefixo>/arquivadas  os cartões arquivados do quadro, para reabrir
     #/atividades/carga                 quanto cada pessoa está carregando
     #/atividades/card/<codigo>         uma atividade (ORT-14)

   Precisa da migração db/v15_atividades.sql. Sem ela, a tela diz
   isso em vez de quebrar. A db/v16_pessoal.sql acrescenta os
   cartões que nascem de um fato (solicitação, apontamento,
   ocorrência) e a decisão que concede acesso — sem ela o quadro
   funciona igual, só não tem bloco de origem.

   A 2.17.0 (db/2.17.0_notas_fotos_e_cartoes.sql) dá ao cartão as
   outras pessoas atribuídas, as etiquetas, as checklists, a cópia para
   outro quadro e o comentário que se corrige; a descrição e os
   comentários passam a ser Markdown (md(), na casca), e marcar alguém é
   digitar @. Sem a migração, o cartão abre como antes: o que depende
   dela some ou avisa.

   Depende da casca para: sb, $, esc, norm, state, can, toast,
   abreModal, fechaModal, confirma, copiar, fmtD, hojeISO, pad3,
   avatarFoto, md, mdInline, mdBarra, rotuloMencao, ic, ibtn, dica,
   motivoRPC, registrarBusca, filtrarSimples, carregarNotificacoes,
   gruposEfetivos, state.itensAcesso (catálogo, para conceder na decisão).
   ============================================================ */

const atividades = {
  pronto:false, grupos:[], itens:[], grupoAtual:null, erro:null,
  filtro:{ q:'', pessoa:null, so:'', etiqueta:'' },   /* so: '' | 'atrasadas' | 'sinalizadas' | 'minhas' */
  card:null, arrastando:null, origem:null, reabrir:false,
  checks:null,        /* as checklists do cartão aberto: [{ ...lista, itens:[] }], ou null sem a 2.17.0 */
  mudouPessoas:false  /* o seletor mexeu no cartão: ao fechar, o histórico é relido */
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
   ETIQUETAS E PESSOAS (2.17.0)
   A cor da etiqueta sai do nome: a mesma etiqueta tem a mesma cor em
   todo quadro, sem ninguém precisar escolher. São cores de status da
   casca, que já têm a versão do tema claro.
   ============================================================ */
const ETIQUETA_CORES = ['var(--teal)', 'var(--info)', 'rgb(var(--roxo-rgb))', 'var(--warn)', 'var(--ok)', 'var(--bad)', 'var(--syn-borda)', 'rgb(var(--cinza-rgb))'];
function corEtiqueta(nome){
  let h = 0;
  for (const c of norm(nome)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ETIQUETA_CORES[h % ETIQUETA_CORES.length];
}
const etiquetaHTML = (e, extra, attrs) => `<span class="et" style="--et:${corEtiqueta(e)}"${attrs || ''}>${esc(e)}${extra || ''}</span>`;
/* as etiquetas em uso num quadro, as mais usadas primeiro: são as opções
   que o seletor oferece */
function etiquetasDoQuadro(grupoId){
  const n = new Map();
  atividades.itens.filter(a => a.grupo_id === grupoId).forEach(a => (a.etiquetas || []).forEach(e => n.set(e, (n.get(e) || 0) + 1)));
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt')).map(([e]) => e);
}
/* todas as pessoas do cartão, o responsável primeiro */
function pessoasDoCartao(a){
  const regs = [a.responsavel, ...(a.pessoas || [])].filter(r => r != null);
  return [...new Set(regs)].map(r => (state.membros || []).find(m => m.registro === r) || { registro:r, nome:'Registro ' + r });
}
const noCartao = (a, reg) => reg != null && (a.responsavel === reg || (a.pessoas || []).includes(reg));
function rostosHTML(ps, max, px){
  if (!ps.length) return '';
  return `<span class="kb-rostos" title="${esc(ps.map(m => m.nome).join(', '))}">${ps.slice(0, max).map(m => avatarFoto(m, px, 9)).join('')}${
    ps.length > max ? `<span class="mais">+${ps.length - max}</span>` : ''}</span>`;
}

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
const grupoDoCartao = a => atividades.grupos.find(g => g.id === a?.grupo_id) || null;
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
const MIGRACAO_217 = 'Falta aplicar a migração db/2.17.0_notas_fotos_e_cartoes.sql.';
const semMigracao217 = (e) => /atividade_(checklist|copiar|comentario_)|pessoas|etiquetas|does not exist|schema cache/i.test(e?.message || '');

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
      <div class="vazio"><div class="glyph">—</div><h3>Nenhum quadro</h3>
      <p>Os quadros são por grupo, e ainda não existe nenhum. Quem cria é a
      Administração, em Grupos.</p></div>`;
    return;
  }
  atividades.grupoAtual = gs.find(g => g.prefixo === (sub||'').toUpperCase())
    || gs.find(g => g.id === atividades.grupoAtual?.id)
    || grupoPadrao();
  if (sub2 === 'arquivadas' && posso.ver(atividades.grupoAtual)) return telaArquivadas();
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

  /* a etiqueta escolhida em outro quadro não vale neste */
  const ets = etiquetasDoQuadro(g.id);
  if (f.etiqueta && !ets.includes(f.etiqueta)) f.etiqueta = '';
  $('#main').innerHTML = topoQuadro(g, true) + `
    <div class="filtros kb-filtros">
      <div class="fld cresce"><label>Buscar</label>
        <input value="${esc(f.q)}" placeholder="Código, título, pessoa ou etiqueta"
          oninput="atividades.filtro.q=this.value;desenhaColunas()"></div>
      <div class="fld"><label>Pessoa</label>
        <select onchange="atividades.filtro.pessoa=this.value?+this.value:null;desenhaColunas()">
          <option value="">Todas</option>
          ${pessoasDoGrupo().map(m => `<option value="${m.registro}" ${f.pessoa===m.registro?'selected':''}
            >${esc(m.nome)}</option>`).join('')}</select></div>
      ${ets.length ? `<div class="fld et-f"><label>Etiqueta</label>
        <select onchange="atividades.filtro.etiqueta=this.value;desenhaColunas()">
          <option value="">Todas</option>
          ${ets.map(e => `<option value="${esc(e)}" ${f.etiqueta===e?'selected':''}>${esc(e)}</option>`).join('')}</select></div>` : ''}
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
        ${comAcoes ? `<a class="btn ghost" href="#/atividades/${esc(g.prefixo)}/arquivadas" title="Os cartões arquivados deste quadro">${ic('arquivar')} Arquivadas</a>` : ''}
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
  const nomes = a => pessoasDoCartao(a).map(m => m.nome).join(' ');
  return atividades.itens.filter(a =>
    a.grupo_id === g.id &&
    (!f.pessoa || noCartao(a, f.pessoa)) &&
    (f.so !== 'minhas'      || noCartao(a, state.perfil?.registro)) &&
    (f.so !== 'atrasadas'   || a.atrasada) &&
    (f.so !== 'sinalizadas' || a.sinalizada) &&
    (!f.etiqueta || (a.etiquetas || []).includes(f.etiqueta)) &&
    (!q || norm(a.codigo).includes(q) || norm(a.titulo).includes(q)
        || norm(a.responsavel_nome).includes(q) || norm(nomes(a)).includes(q)
        || (a.etiquetas || []).some(e => norm(e).includes(q)))
  );
}

function desenhaColunas(){
  const vis = itensVisiveis();
  const atrasadas = vis.filter(a => a.atrasada).length;
  const sinal     = vis.filter(a => a.sinalizada).length;
  const semDono   = vis.filter(a => !a.responsavel && !(a.pessoas || []).length && a.status !== 'concluida').length;

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
  const pessoas = pessoasDoCartao(a);
  const edito = posso.editar(atividades.grupoAtual);
  /* O brilho no topo é o sinal sempre presente: cor da prioridade, ou
     âmbar quando o cartão está sinalizado — sinalizado é "olhe para
     mim", que é justamente o que um brilho quer dizer. O ponto de
     prioridade continua ali, então nada se perde na troca. Concluída
     não pede atenção: o brilho sai e fica só o ponto. */
  const cor = a.sinalizada ? 'var(--warn)' : corPrioridade(a.prioridade);
  const arraste = edito
    ? `draggable="true"
       ondragstart="atividades.arrastando='${a.id}';this.classList.add('mov');event.dataTransfer.effectAllowed='move'"
       ondragend="this.classList.remove('mov');document.querySelectorAll('.kb-col').forEach(c=>c.classList.remove('sobre'))"
       ondragover="event.preventDefault();event.stopPropagation()"
       ondrop="event.stopPropagation();soltarEm(event,'${a.status}','${a.id}')"`
    : '';
  const ets = a.etiquetas || [];
  const ck = Number(a.check_total) || 0, ckf = Number(a.check_feitos) || 0;
  return `<article class="kb-card${a.sinalizada?' sinalizada':''}${a.status==='concluida'?' concluida':''}${edito?'':' fixo'}"
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
    ${ets.length ? `<div class="kb-ets">${ets.slice(0, 3).map(e => etiquetaHTML(e)).join('')}${
      ets.length > 3 ? `<span class="et" style="--et:transparent">+${ets.length - 3}</span>` : ''}</div>` : ''}
    <div class="kb-tit">${esc(a.titulo)}</div>
    ${a.sinalizada ? `<div class="kb-flag">${esc(a.sinalizada_motivo || 'Precisa de atenção')}</div>` : ''}
    <div class="kb-pe">
      ${pessoas.length ? rostosHTML(pessoas, 3, 22) : '<span class="kb-sem">sem responsável</span>'}
      <span class="kb-meta">
        ${ck ? `<span class="ck${ckf === ck ? ' cheia' : ''}" title="Checklist: ${ckf} de ${ck}">${ic('checklist')}${ckf}/${ck}</span>` : ''}
        ${a.prazo ? `<span class="${a.atrasada?'atrasado':''}">${fmtD(a.prazo)}</span>` : ''}
        ${a.comentarios ? `<span class="cmt" title="${a.comentarios} comentário(s)">${a.comentarios}c</span>` : ''}
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
   OS ARQUIVADOS — #/atividades/<prefixo>/arquivadas
   Arquivar tira o cartão do quadro, não do sistema: aqui ele se acha
   e volta para a coluna em que estava.
   ============================================================ */
async function telaArquivadas(){
  const g = atividades.grupoAtual, edito = posso.editar(g);
  $('#main').innerHTML = `<div class="topo-gestao">
      <div style="padding-top:34px"><a class="icon-btn" href="#/atividades/${esc(g.prefixo)}" title="Voltar ao quadro" aria-label="Voltar ao quadro">${ic('back')}</a></div>
      <div class="tx"><span class="eyebrow">Atividades, ${esc(g.nome)}</span><h1>Arquivadas</h1></div></div>
    <div class="card" id="arq-lista"><div class="carregando"><span class="spin"></span></div></div>`;
  const { data, error } = await sb.from('atividades_quadro').select('*').eq('grupo_id', g.id).eq('arquivada', true)
    .order('atualizado_em', { ascending:false }).limit(200);
  const el = $('#arq-lista'); if (!el) return;
  if (error){ el.innerHTML = `<div class="aviso-box err">Não foi possível ler os arquivados: ${esc(error.message)}</div>`; return; }
  const lista = (data || []).filter(a => a.grupo_id === g.id && a.arquivada);
  el.innerHTML = lista.length ? `<div class="arq-lista">${lista.map(a => `<div class="arq">
      <span class="cod">${esc(a.codigo)}</span>
      <a class="tt" href="#/atividades/card/${esc(a.codigo)}">${esc(a.titulo)}</a>
      <span class="q">${esc(rotuloStatus(a.status))}, ${fmtQuando(a.atualizado_em || a.criado_em)}</span>
      ${edito ? `<button class="btn ghost mini" onclick="restaurarAtividade('${a.id}','${esc(a.codigo)}',true)">Restaurar</button>` : ''}
    </div>`).join('')}</div>`
    : '<div class="kb-vazio" style="text-align:left">Nenhuma atividade arquivada neste quadro.</div>';
}
async function restaurarAtividade(id, codigo, naLista){
  const { data, error } = await sb.rpc('atividade_editar', { p:{ id, arquivada:false } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível restaurar'), true);
  toast(`${codigo} de volta ao quadro.`);
  await atvCarregar(true);
  if (naLista) telaArquivadas(); else telaCard(codigo);
}

/* ============================================================
   NOVA ATIVIDADE
   ============================================================ */
function modalNovaAtividade(status){
  const g = atividades.grupoAtual;
  const ets = etiquetasDoQuadro(g.id);
  atividades.novasEtiquetas = [];
  abreModal(`<h3>Nova atividade</h3>
    <p class="sub" style="margin-bottom:16px">Em ${esc(g.nome)}, o código sai na hora de salvar</p>
    <div class="form-grid">
      <div class="fld full"><label>O que precisa ser feito</label>
        <input id="na-tit" placeholder="Calibrar o encoder do protótipo"></div>
      <div class="fld full"><label for="na-desc">Detalhes (opcional)</label>${mdBarra('na-desc')}
        <textarea id="na-desc" rows="4" placeholder="Contexto, critério de pronto, links. Aceita Markdown."></textarea></div>
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
      <div class="fld full"><label>Outras pessoas ${dica('Além do responsável. Quem entra é avisado, segue o cartão e o vê em Suas tarefas.')}</label>
        <div class="multi" style="max-height:132px">${pessoasMencionaveis(g.id).map(m => `<label class="check">
          <input type="checkbox" class="na-pes" value="${m.registro}"> ${esc(m.nome)}</label>`).join('')
          || '<div class="small dim">Ninguém para incluir.</div>'}</div></div>
      <div class="fld full"><label for="na-ets-in">Etiquetas</label>
        <div class="pills-ed" onclick="if(event.target===this)document.getElementById('na-ets-in').focus()">
          <span id="na-ets-lista"></span>
          <input id="na-ets-in" list="na-ets-dl" autocomplete="off" placeholder="digite e tecle Enter"
            onkeydown="naEtTecla(event)" onblur="naEtAdicionar()">
        </div>
        <datalist id="na-ets-dl">${ets.map(e => `<option value="${esc(e)}">`).join('')}</datalist>
        ${ets.length ? `<div class="cd-linha" style="margin-top:8px">${ets.slice(0, 8).map(e =>
          `<button type="button" class="et" style="--et:${corEtiqueta(e)}" onclick="naEtAdicionar(this.dataset.et)" data-et="${esc(e)}">${esc(e)}</button>`).join('')}</div>` : ''}</div>
    </div>
    <p class="err-msg" id="na-erro"></p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="na-btn" onclick="salvarNovaAtividade()">Criar</button></div>`, true);
  setTimeout(() => $('#na-tit')?.focus(), 50);
}
/* as etiquetas da atividade nova, no editor de pills: Enter (ou vírgula)
   põe, o × tira, e a sugestão do quadro entra com a grafia de lá */
function naEtDesenhar(){
  const l = $('#na-ets-lista'); if (!l) return;
  l.innerHTML = (atividades.novasEtiquetas || []).map((e, i) => `<span class="pill-ed">${esc(e)}<button type="button"
    onclick="naEtTirar(${i})" aria-label="Tirar a etiqueta ${esc(e)}" title="Tirar">×</button></span>`).join('');
  document.querySelectorAll('#modal .cd-linha .et[data-et]').forEach(b =>
    b.classList.toggle('on', (atividades.novasEtiquetas || []).some(x => norm(x) === norm(b.dataset.et))));
}
function naEtAdicionar(valor){
  const inp = $('#na-ets-in'); if (!inp) return;
  const lista = atividades.novasEtiquetas ||= [];
  const conhecidas = etiquetasDoQuadro(atividades.grupoAtual.id);
  String(valor ?? inp.value).split(',').map(x => x.trim().replace(/\s+/g, ' ').slice(0, 32)).filter(Boolean).forEach(e => {
    const can = conhecidas.find(x => norm(x) === norm(e)) || e;
    if (!lista.some(x => norm(x) === norm(can)) && lista.length < 10) lista.push(can);
  });
  if (valor == null) inp.value = '';
  naEtDesenhar();
}
function naEtTirar(i){ (atividades.novasEtiquetas || []).splice(i, 1); naEtDesenhar(); $('#na-ets-in')?.focus(); }
function naEtTecla(ev){
  if (ev.key === 'Enter' || ev.key === ','){ ev.preventDefault(); naEtAdicionar(); return; }
  if (ev.key === 'Backspace' && !ev.target.value && (atividades.novasEtiquetas || []).length){
    ev.preventDefault(); atividades.novasEtiquetas.pop(); naEtDesenhar();
  }
}
async function salvarNovaAtividade(){
  const tit = $('#na-tit').value.trim();
  if (!tit){ $('#na-erro').textContent = 'Diga o que precisa ser feito.'; return; }
  naEtAdicionar();   /* o que ficou digitado sem Enter também vale */
  const pessoas = [...document.querySelectorAll('.na-pes:checked')].map(x => +x.value);
  const etiquetas = [...(atividades.novasEtiquetas || [])];
  $('#na-btn').disabled = true;
  try{
    const p = {
      grupo_id: atividades.grupoAtual.id,
      titulo: tit,
      descricao: $('#na-desc').value.trim() || null,
      responsavel: $('#na-resp').value || null,
      prazo: $('#na-prazo').value || null,
      prioridade: $('#na-pri').value,
      status: $('#na-status').value
    };
    /* sem a 2.17.0 a função não conhece os dois campos, e os ignora */
    if (pessoas.length) p.pessoas = pessoas;
    if (etiquetas.length) p.etiquetas = etiquetas;
    const { data, error } = await sb.rpc('atividade_criar', { p });
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
  /* o cartão vai ser redesenhado: o seletor aberto perderia o botão */
  if (seletor.el){ seletor.el.remove(); seletor.el = null; seletor.cfg = null; }
  atividades.mudouPessoas = false;
  mencaoFechar();
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando ${esc(codigo)}…</div>`;
  await atvCarregar(true);
  let a = atividades.itens.find(x => norm(x.codigo) === norm(codigo));
  /* arquivada não está no quadro: busca-se pelo código */
  if (!a){
    const r = await sb.from('atividades_quadro').select('*').eq('codigo', String(codigo).toUpperCase()).maybeSingle();
    if (!r.error && r.data?.arquivada) a = r.data;
  }
  if (!a){
    $('#main').innerHTML = `<div class="topo-gestao"><div class="tx">
      <span class="eyebrow">Atividade</span><h1>${esc(codigo)} não encontrada</h1>
      <p class="lead">O código não existe, ou você não tem acesso ao quadro dela.</p></div></div>
      <div class="acts"><a class="btn ghost" href="#/atividades">Voltar ao quadro</a></div>`;
    return;
  }
  atividades.card = a;
  const [c, l, s, o] = await Promise.all([
    sb.from('atividade_comentarios').select('*').eq('atividade_id', a.id).order('criado_em'),
    sb.from('atividade_log').select('*').eq('atividade_id', a.id).order('criado_em', { ascending:false }).limit(40),
    sb.from('atividade_seguidores').select('registro').eq('atividade_id', a.id),
    a.origem_tipo ? sb.rpc('atividade_origem_detalhe', { p_codigo: a.codigo }) : Promise.resolve({ data:null }),
    ckCarregar(a)
  ]);
  atividades.origem = o.data || null;
  desenhaCard(a, c.data || [], l.data || [], (s.data || []).map(x => x.registro), o.data || null);
}

function desenhaCard(a, comentarios, log, seguidores, origem){
  const sigo = seguidores.includes(state.perfil?.registro);
  const g = grupoDoCartao(a), edito = posso.editar(g);
  const pes  = pessoasDoGrupoDe(a.grupo_id, a.responsavel);
  const copias = log.filter(e => e.tipo === 'copiou_para' && e.para).map(e => e.para);
  atividades.comentarios = comentarios;

  $('#main').innerHTML = `
    <div class="topo-gestao">
      <div style="padding-top:34px"><a class="icon-btn" href="#/atividades/${esc(a.grupo_prefixo)}"
        title="Voltar ao quadro" aria-label="Voltar ao quadro">
        <svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
          stroke-linecap="round"><path d="M14.5 5.5 8 12l6.5 6.5"/></svg></a></div>
      <div class="tx"><span class="eyebrow">${esc(a.grupo)}, ${esc(a.codigo)}</span>
        <h1 id="cd-titulo" class="${edito ? 'editavel' : ''}" ${edito ? 'onclick="editarTitulo()"' : ''}>${esc(a.titulo)}</h1>
        ${a.atrasada ? `<p class="lead" style="color:var(--bad)">Atrasada desde ${fmtD(a.prazo)}.</p>` : ''}</div>
      <div class="acoes">
        <button class="btn ghost" onclick="alternarSeguir(${sigo})">${sigo?'Seguindo':'Seguir'}</button>
        <button class="btn ${a.sinalizada?'solid':'ghost'}" onclick="modalSinalizar()">
          ${a.sinalizada ? 'Sinalizada' : 'Sinalizar'}</button>
      </div>
    </div>

    ${a.arquivada ? `<div class="aviso-box warn"><b>Arquivada.</b> Fora do quadro${edito
      ? `: <button class="btn ghost mini" onclick="restaurarAtividade('${a.id}','${esc(a.codigo)}')">Restaurar</button>` : '.'}</div>` : ''}
    ${a.sinalizada ? `<div class="aviso-box warn"><b>Precisa de atenção.</b>
      ${esc(a.sinalizada_motivo || '')}</div>` : ''}

    <div class="cd-grade">
      <div>
        ${blocoOrigem(a, origem)}
        <div class="card" style="margin-bottom:16px">
          <h3>Descrição</h3>
          <div id="cd-desc" class="cd-desc md${edito ? ' editavel' : ''}" ${edito ? 'onclick="editarDescricao(event)"' : ''}>${
            a.descricao ? md(a.descricao) : `<span class="muted">${edito ? 'Sem detalhes. Clique para escrever.' : 'Sem detalhes.'}</span>`}</div>
        </div>

        ${ckCartaoHTML(a, edito)}

        <div class="card" style="margin-bottom:16px">
          <h3>Comentários ${comentarios.length ? `<span class="muted">(${comentarios.length})</span>` : ''}</h3>
          <p class="sub" style="margin-bottom:16px">Quem é marcado com @ é avisado</p>
          <div class="cd-coments" id="cd-coments">${comentarios.map(comentarioHTML).join('')
            || '<div class="kb-vazio" style="text-align:left">Nenhum comentário.</div>'}</div>
          <div class="cd-novo">
            <textarea id="cd-coment" rows="3" placeholder="Escreva um comentário. Digite @ para marcar alguém."></textarea>
            <div class="cd-novo-pe">
              <span class="small muted">Aceita Markdown</span>
              <button type="button" class="btn ghost mini" onclick="mencaoIniciar('cd-coment')" title="Marcar alguém">${ic('mencao')} Marcar</button>
              <button class="btn solid" id="cd-btn" onclick="enviarComentario()">Comentar</button>
            </div>
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
          ${a.pessoas !== undefined ? `
          <div class="cd-bloco"><label>Outras pessoas</label>
            <div class="cd-linha" id="cd-pessoas">${pessoasChipsHTML(a, edito)}</div></div>
          <div class="cd-bloco"><label>Etiquetas</label>
            <div class="cd-linha" id="cd-etiquetas">${etiquetasChipsHTML(a, edito)}</div></div>` : ''}
          <div class="dl" style="margin-top:6px">
            <div class="it"><dt>Criada por</dt><dd>${esc(a.criado_por_nome || '—')}</dd></div>
            <div class="it"><dt>Criada em</dt><dd>${fmtD(String(a.criado_em).slice(0,10))}</dd></div>
          </div>
          ${a.copia_de_codigo ? `<p class="cd-copia">Cópia de <a href="#/atividades/card/${esc(a.copia_de_codigo)}">${esc(a.copia_de_codigo)}</a></p>` : ''}
          ${copias.length ? `<p class="cd-copia">Cópias: ${[...new Set(copias)].map(c =>
            `<a href="#/atividades/card/${esc(c)}">${esc(c)}</a>`).join(', ')}</p>` : ''}
          <div class="acts" style="margin-top:14px">
            ${a.pessoas !== undefined ? `<button class="btn ghost" onclick="modalCopiar()">${ic('copy')} Copiar para outro quadro</button>` : ''}
            <button class="btn ghost" onclick="copiarLinkCartao()">${ic('link')} Copiar link</button>
            ${edito && !a.arquivada ? `<button class="btn ghost" onclick="arquivarAtividade()">${ic('arquivar')} Arquivar</button>` : ''}
          </div>
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
  ligarMencoes('cd-coment', a.grupo_id);
  ckLigarArraste(edito);
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
      origem não foi encontrado.</p></div>`;
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
      ${esc(TIPOS_SOL[o.especie] || o.especie)}, <span class="pill"><span class="dt"
        style="background:${esc(STATUS_SOL[o.status]?.c || 'var(--dim)')}"></span
        >${esc(STATUS_SOL[o.status]?.l || o.status)}</span></p>
    <div class="dl">
      ${linhaDl('Quem pediu', `<a href="#/equipe/${o.registro}">${esc(o.membro || ('Registro '+o.registro))}</a>`)}
      ${linhaDl('Aberta em', fmtD(String(o.criado_em).slice(0,10)))}
      ${campos}
    </div>
    ${o.resposta ? `<div class="aviso-box" style="margin-top:14px"><b>Resposta:</b>
      ${esc(o.resposta)}<br><span class="small muted">${esc(o.respondido_por || '')}${
        o.respondido_em ? ', ' + fmtD(String(o.respondido_em).slice(0,10)) : ''}</span></div>` : ''}
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
          <span>${esc(i.nome)}${jaAtivo.has(i.id) ? ' (já concedido)' : ''}</span>
        </label>`).join('')}</div>`
        : '<p class="sub">O catálogo de acessos está vazio.</p>'}
      <p class="small muted" style="margin-top:6px">Os itens marcados entram nos acessos da pessoa com a decisão.</p>
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
          placeholder="Obrigatória para recusar"></textarea></div>
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
/* Quem se pode marcar e atribuir num quadro: num quadro reservado, só
   quem está no grupo (os outros nem leem o cartão); nos abertos, a equipe
   ativa, com o grupo primeiro. */
function pessoasMencionaveis(grupoId){
  const g = atividades.grupos.find(x => x.id === grupoId);
  const doGrupo = pessoasDoGrupoDe(grupoId);
  if (g?.reservado) return doGrupo;
  const ja = new Set(doGrupo.map(m => m.registro));
  return [...doGrupo, ...(state.membros || []).filter(m => !ja.has(m.registro)
    && ['Ativo','Em pausa / avaliação','Sob demanda'].includes(m.status))];
}

function frasesLog(e){
  switch (e.tipo){
    case 'criou':        return 'Criou a atividade';
    case 'moveu':        return `Moveu de "${rotuloStatus(e.de)}" para "${rotuloStatus(e.para)}"`;
    case 'atribuiu':     return e.para ? `Atribuiu a ${e.para}` : 'Removeu o responsável';
    case 'incluiu':      return `Incluiu ${e.para}`;
    case 'retirou':      return `Retirou ${e.para}`;
    case 'etiquetas':    return e.para ? `Etiquetas: ${e.para}` : 'Tirou as etiquetas';
    case 'prazo':        return e.para ? `Prazo para ${fmtD(e.para)}` : 'Removeu o prazo';
    case 'prioridade':   return `Prioridade: ${rotuloPrioridade(e.de)} → ${rotuloPrioridade(e.para)}`;
    case 'sinalizou':    return e.para ? `Sinalizou: ${e.para}` : 'Sinalizou como precisando de atenção';
    case 'dessinalizou': return 'Tirou a sinalização';
    case 'comentou':     return 'Comentou';
    case 'apagou_comentario': return 'Apagou um comentário';
    case 'checklist':    return `Criou a checklist "${e.para}"`;
    case 'checklist_excluida': return `Excluiu a checklist "${e.para}"`;
    case 'concluiu_item':return `Concluiu "${e.para}"`;
    case 'copiou_de':    return `Copiada de ${e.para}`;
    case 'copiou_para':  return `Copiada para ${e.para}`;
    case 'arquivou':     return e.para ? `Arquivou (a cópia seguiu em ${e.para})` : 'Arquivou';
    case 'restaurou':    return 'Restaurou ao quadro';
    case 'decidiu':      return `Decidiu a solicitação: ${e.de||'aberta'} → ${e.para}`;
    case 'concedeu':     return `Concedeu acesso: ${e.para}`;
    case 'editou':       return e.campo === 'grupo' ? `Mudou de quadro: ${e.de} → ${e.para}` : 'Editou o conteúdo';
    default:             return e.tipo;
  }
}

/* ---- edições no lugar ---- */
function editarTitulo(){
  const a = atividades.card, el = $('#cd-titulo');
  el.innerHTML = `<input id="cd-tit-in" value="${esc(a.titulo)}"
    style="width:100%;font:inherit;background:var(--campo);border:1px solid var(--line2);
    border-radius:10px;padding:4px 10px;color:inherit">`;
  const i = $('#cd-tit-in'); i.focus(); i.select();
  const fim = () => mudarCampo('titulo', i.value.trim() || a.titulo);
  i.onblur = fim;
  i.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); i.blur(); }
                       if (e.key === 'Escape'){ i.onblur = null; telaCard(a.codigo); } };
}
/* A descrição em Markdown: a barra de formatação, escrever e ver antes
   de salvar. Um link dentro da descrição continua sendo link — clicar
   nele não abre o editor. */
function editarDescricao(ev){
  if (ev?.target?.closest('a')) return;
  const a = atividades.card, el = $('#cd-desc');
  el.classList.remove('editavel'); el.onclick = null;
  el.innerHTML = `${mdBarra('cd-desc-in')}
    <textarea id="cd-desc-in" rows="8"
      style="width:100%;background:var(--campo);border:1px solid var(--line2);
      border-radius:10px;padding:10px 12px;color:var(--ink);font:inherit;font-size:13.5px"
      placeholder="Contexto, critério de pronto, links. **negrito**, - lista, - [ ] tarefa">${esc(a.descricao||'')}</textarea>
    <div class="md md-ver" id="cd-desc-ver" hidden></div>
    <div class="acts" style="margin-top:10px">
      <button class="btn solid" onclick="salvarDescricao()">Salvar</button>
      <button class="btn ghost" id="cd-desc-alt" onclick="alternarVerDescricao()">Ver</button>
      <button class="btn ghost" onclick="telaCard('${esc(a.codigo)}')">Cancelar</button></div>`;
  $('#cd-desc-in').focus();
}
function alternarVerDescricao(){
  const ta = $('#cd-desc-in'), ver = $('#cd-desc-ver'), bt = $('#cd-desc-alt');
  const vendo = !ver.hidden;
  if (!vendo) ver.innerHTML = ta.value.trim() ? md(ta.value) : '<span class="muted">Nada escrito.</span>';
  ver.hidden = vendo; ta.hidden = !vendo;
  document.querySelector('#cd-desc .md-barra')?.toggleAttribute('hidden', !vendo);
  bt.textContent = vendo ? 'Ver' : 'Escrever';
  if (vendo) ta.focus();
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

/* ============================================================
   OUTRAS PESSOAS E ETIQUETAS (2.17.0)
   Um seletor só, que abre embaixo do botão: marcar e desmarcar salva
   na hora, e ao fechar o cartão é relido (o histórico ganhou a linha).
   ============================================================ */
function pessoasChipsHTML(a, edito){
  const ps = (a.pessoas || []).map(r => (state.membros || []).find(m => m.registro === r) || { registro:r, nome:'Registro ' + r });
  return ps.map(m => `<span class="pessoa-chip">${avatarFoto(m, 20, 8)}<span class="nm">${esc(m.nome)}</span>${
      edito ? `<button type="button" onclick="pessoaTirar(${m.registro})" title="Tirar do cartão" aria-label="Tirar ${esc(m.nome)} do cartão">×</button>` : ''}</span>`).join('')
    + (edito ? `<button type="button" class="cd-add" id="cd-add-pessoa" onclick="seletorPessoas(event)">${ic('plus')} Pessoa</button>`
             : (ps.length ? '' : '<span class="small muted">Ninguém além do responsável.</span>'));
}
function etiquetasChipsHTML(a, edito){
  const ets = a.etiquetas || [];
  return ets.map(e => etiquetaHTML(e, edito ? `<button type="button" class="x" onclick="etiquetaTirar(this.parentNode.dataset.et)" title="Tirar a etiqueta" aria-label="Tirar a etiqueta ${esc(e)}">×</button>` : '',
      ` data-et="${esc(e)}"`)).join('')
    + (edito ? `<button type="button" class="cd-add" id="cd-add-etiqueta" onclick="seletorEtiquetas(event)">${ic('etiqueta')} Etiqueta</button>`
             : (ets.length ? '' : '<span class="small muted">Nenhuma.</span>'));
}
async function cartaoSalvar(p, desfaz){
  const a = atividades.card;
  const { data, error } = await sb.rpc('atividade_editar', { p:{ id:a.id, ...p } });
  if (error || data?.status !== 'ok'){
    desfaz?.();
    toast(semMigracao217(error) ? MIGRACAO_217 : data?.status === 'sem_permissao'
      ? 'Só quem está no grupo edita as atividades dele.' : motivoRPC(data, error, 'Não foi possível salvar'), true);
    return false;
  }
  atividades.mudouPessoas = true;
  return true;
}
function pessoasRedesenhar(){
  const el = $('#cd-pessoas'), a = atividades.card; if (el && a) el.innerHTML = pessoasChipsHTML(a, true);
  const e2 = $('#cd-etiquetas'); if (e2 && a) e2.innerHTML = etiquetasChipsHTML(a, true);
}
async function pessoaTirar(reg){
  const a = atividades.card, antes = [...(a.pessoas || [])];
  a.pessoas = antes.filter(r => r !== reg); pessoasRedesenhar();
  if (await cartaoSalvar({ pessoas:a.pessoas }, () => { a.pessoas = antes; pessoasRedesenhar(); })) telaCard(a.codigo);
}
async function etiquetaTirar(e){
  const a = atividades.card, antes = [...(a.etiquetas || [])];
  a.etiquetas = antes.filter(x => x !== e); pessoasRedesenhar();
  if (await cartaoSalvar({ etiquetas:a.etiquetas }, () => { a.etiquetas = antes; pessoasRedesenhar(); })) telaCard(a.codigo);
}

/* o seletor genérico: itens [{ id, rotulo, sub, pre, grupo }] */
const seletor = { el:null, cfg:null, ativo:0 };
function seletorAbrir(ancora, cfg){
  seletorFechar();
  const el = document.createElement('div');
  el.className = 'sel-pop'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', cfg.titulo);
  el.innerHTML = `<input id="sel-q" placeholder="${esc(cfg.busca || 'Buscar')}" autocomplete="off"><div class="sel-lista" id="sel-lista" role="listbox"></div>`;
  document.body.appendChild(el);
  Object.assign(seletor, { el, cfg, ativo:0, ancora });
  const r = ancora.getBoundingClientRect();
  el.style.position = 'fixed';
  el.style.left = Math.max(12, Math.min(r.left, innerWidth - 332)) + 'px';
  const alto = 340, embaixo = r.bottom + 6 + alto <= innerHeight;
  el.style.top = (embaixo ? r.bottom + 6 : Math.max(12, r.top - 6 - alto)) + 'px';
  const q = el.querySelector('#sel-q');
  q.oninput = () => { seletor.ativo = 0; seletorDesenhar(); };
  q.onkeydown = e => {
    const ops = [...el.querySelectorAll('.sel-op')];
    if (e.key === 'ArrowDown'){ e.preventDefault(); seletor.ativo = Math.min(ops.length - 1, seletor.ativo + 1); seletorDesenhar(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); seletor.ativo = Math.max(0, seletor.ativo - 1); seletorDesenhar(); }
    else if (e.key === 'Enter'){ e.preventDefault(); ops[seletor.ativo]?.click(); }
    else if (e.key === 'Escape'){ e.preventDefault(); seletorFechar(); ancora.focus?.(); }
  };
  seletorDesenhar();
  q.focus();
}
function seletorDesenhar(){
  const { el, cfg } = seletor; if (!el) return;
  const q = norm(el.querySelector('#sel-q').value.trim());
  const itens = cfg.itens().filter(i => !q || norm(i.rotulo + ' ' + (i.sub || '')).includes(q));
  const marcados = cfg.marcados();
  const criar = cfg.criar && q && !cfg.itens().some(i => norm(i.rotulo) === q) ? el.querySelector('#sel-q').value.trim() : null;
  let grupo = null, k = 0;
  const ops = [];
  itens.forEach(i => {
    if (i.grupo && i.grupo !== grupo){ grupo = i.grupo; ops.push(`<div class="sel-grp">${esc(grupo)}</div>`); }
    ops.push(`<button type="button" class="sel-op${k === seletor.ativo ? ' ativo' : ''}" role="option" aria-selected="${marcados.has(i.id)}"
      data-id="${esc(String(i.id))}" onclick="seletorEscolher(this.dataset.id)">${i.pre || ''}<span class="nm">${esc(i.rotulo)}</span>${
        i.sub ? `<span class="sub">${esc(i.sub)}</span>` : ''}${marcados.has(i.id) ? ic('check', 'ok') : ''}</button>`);
    k++;
  });
  if (criar) ops.push(`<button type="button" class="sel-op${k === seletor.ativo ? ' ativo' : ''}" onclick="seletorCriar()">${ic('plus')}
    <span class="nm">Criar "${esc(criar)}"</span></button>`);
  el.querySelector('#sel-lista').innerHTML = ops.join('') || `<div class="sel-vazio">${esc(cfg.vazio || 'Nada encontrado.')}</div>`;
  el.querySelector('.sel-op.ativo')?.scrollIntoView({ block:'nearest' });
}
function seletorEscolher(id){
  const { cfg } = seletor; if (!cfg) return;
  const i = cfg.itens().find(x => String(x.id) === id); if (!i) return;
  cfg.alternar(i.id);
  seletorDesenhar();
}
function seletorCriar(){
  const { el, cfg } = seletor; if (!cfg?.criar) return;
  const t = el.querySelector('#sel-q').value.trim(); if (!t) return;
  cfg.criar(t); el.querySelector('#sel-q').value = ''; seletorDesenhar();
}
function seletorFechar(){
  if (!seletor.el) return;
  seletor.el.remove(); seletor.el = null; seletor.cfg = null;
  if (atividades.mudouPessoas && atividades.card){ atividades.mudouPessoas = false; telaCard(atividades.card.codigo); }
}
document.addEventListener('mousedown', e => {
  if (seletor.el && !seletor.el.contains(e.target) && !e.target.closest('.cd-add')) seletorFechar();
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && seletor.el) seletorFechar(); });

function seletorPessoas(ev){
  ev?.stopPropagation();
  const a = atividades.card, g = grupoDoCartao(a);
  const doGrupo = new Set(pessoasDoGrupoDe(a.grupo_id).map(m => m.registro));
  seletorAbrir(ev.currentTarget, {
    titulo:'Outras pessoas', busca:'Buscar pessoa', vazio:'Ninguém com esse nome.',
    itens: () => pessoasMencionaveis(a.grupo_id).filter(m => m.registro !== a.responsavel).map(m => ({
      id:m.registro, rotulo:m.nome, sub:m.cargo || '', pre:avatarFoto(m, 22, 9),
      grupo: g?.reservado ? null : (doGrupo.has(m.registro) ? 'Do grupo ' + g?.nome : 'Outras pessoas') })),
    marcados: () => new Set(a.pessoas || []),
    alternar: async (reg) => {
      const antes = [...(a.pessoas || [])];
      a.pessoas = antes.includes(reg) ? antes.filter(r => r !== reg) : [...antes, reg];
      pessoasRedesenhar();
      await cartaoSalvar({ pessoas:a.pessoas }, () => { a.pessoas = antes; pessoasRedesenhar(); seletorDesenhar(); });
    }
  });
}
function seletorEtiquetas(ev){
  ev?.stopPropagation();
  const a = atividades.card;
  /* as opções: as do quadro, e as de toda a equipe depois */
  const doQuadro = etiquetasDoQuadro(a.grupo_id);
  const outras = [...new Set(atividades.itens.flatMap(x => x.etiquetas || []))].filter(e => !doQuadro.includes(e))
    .sort((x, y) => x.localeCompare(y, 'pt'));
  const alternar = async (e) => {
    const antes = [...(a.etiquetas || [])];
    const tem = antes.some(x => norm(x) === norm(e));
    if (!tem && antes.length >= 10) return toast('Até dez etiquetas por cartão.', true);
    a.etiquetas = tem ? antes.filter(x => norm(x) !== norm(e)) : [...antes, e];
    pessoasRedesenhar();
    await cartaoSalvar({ etiquetas:a.etiquetas }, () => { a.etiquetas = antes; pessoasRedesenhar(); seletorDesenhar(); });
  };
  seletorAbrir(ev.currentTarget, {
    titulo:'Etiquetas', busca:'Buscar ou criar etiqueta', vazio:'Digite para criar a primeira.',
    itens: () => [...new Set([...(a.etiquetas || []), ...doQuadro, ...outras])].map(e => ({
      id:e, rotulo:e, pre:`<span class="et" style="--et:${corEtiqueta(e)};padding:0;border:0"></span>`,
      grupo: doQuadro.includes(e) || (a.etiquetas || []).includes(e) ? 'Deste quadro' : 'De outros quadros' })),
    marcados: () => new Set(a.etiquetas || []),
    alternar,
    criar: (t) => alternar(t.replace(/\s+/g, ' ').slice(0, 32))
  });
}

/* ============================================================
   CHECKLISTS (2.17.0)
   Uma ou mais por cartão. Marcar salva na hora; colar uma lista cria um
   item por linha (e "- [x]" já entra marcado); arrastar reordena, e leva
   o item de uma lista para outra do mesmo cartão.
   ============================================================ */
async function ckCarregar(a){
  atividades.checks = null;
  const l = await sb.from('atividade_checklists').select('*').eq('atividade_id', a.id).order('ordem');
  if (l.error) return;   /* sem a 2.17.0 */
  const listas = l.data || [];
  const ids = listas.map(x => x.id);
  const i = ids.length ? await sb.from('atividade_checklist_itens').select('*').in('checklist_id', ids).order('ordem') : { data:[] };
  const itens = i.data || [];
  atividades.checks = listas.map(x => ({ ...x, itens: itens.filter(y => y.checklist_id === x.id).sort((p, q) => p.ordem - q.ordem) }));
}
function ckCartaoHTML(a, edito){
  const ls = atividades.checks;
  if (!ls || (!ls.length && !edito)) return '';
  return `<div class="card" style="margin-bottom:16px" id="cd-checks">
    <div class="head" style="display:flex;align-items:center;justify-content:space-between;gap:10px">
      <h3>Checklist</h3>
      ${edito ? `<button class="btn ghost mini" onclick="ckNovaLista()">${ic('plus')} Checklist</button>` : ''}</div>
    <div id="ck-corpo" style="margin-top:12px">${ckListasHTML(edito)}</div>
  </div>`;
}
function ckListasHTML(edito){
  const ls = atividades.checks || [];
  if (!ls.length) return '<p class="small muted">Nenhuma checklist.</p>';
  return ls.map(l => {
    const t = l.itens.length, f = l.itens.filter(i => i.feito).length, pct = t ? Math.round(100 * f / t) : 0;
    return `<div class="ck-lista" data-lista="${l.id}">
      <div class="ck-topo">${ic('checklist')}
        <h4 id="ck-tit-${l.id}" class="${edito ? 'editavel' : ''}" ${edito ? `onclick="ckRenomear('${l.id}')"` : ''}>${esc(l.titulo)}</h4>
        <span class="n">${f}/${t}</span>
        ${edito ? ibtn('trash', 'Excluir a checklist', `ckExcluirLista('${l.id}')`, 'sm') : ''}</div>
      <div class="ck-barra${t && f === t ? ' cheia' : ''}"><i style="width:${pct}%"></i></div>
      <div class="ck-itens" data-lista="${l.id}">${l.itens.map(i => `<div class="ck-item${i.feito ? ' feito' : ''}" data-id="${i.id}"${edito ? ' draggable="true"' : ''}>
          <input type="checkbox" ${i.feito ? 'checked' : ''} ${edito ? '' : 'disabled'} onchange="ckMarcar('${i.id}', this.checked)" aria-label="${esc(i.texto)}">
          <span class="tx${edito ? ' editavel' : ''}" id="ck-tx-${i.id}" ${edito ? `onclick="ckEditarItem(event,'${i.id}')"` : ''}>${mdInline(i.texto)}</span>
          ${edito ? `<span class="acs">${ibtn('trash', 'Excluir o item', `ckExcluirItem('${i.id}')`, 'sm')}</span>` : ''}
        </div>`).join('')}</div>
      ${edito ? `<div class="ck-novo">
        <textarea id="ck-novo-${l.id}" class="ck-in" rows="1" placeholder="Adicionar item (colar uma lista cria vários)"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();ckAdicionar('${l.id}')}"
          oninput="this.style.height='auto';this.style.height=this.scrollHeight+'px'"></textarea>
        <button class="btn ghost mini" onclick="ckAdicionar('${l.id}')">Adicionar</button></div>` : ''}
    </div>`;
  }).join('');
}
function ckRedesenhar(focarLista){
  const el = $('#ck-corpo'), edito = posso.editar(grupoDoCartao(atividades.card)); if (!el) return;
  el.innerHTML = ckListasHTML(edito);
  ckLigarArraste(edito);
  if (focarLista) $('#ck-novo-' + focarLista)?.focus();
}
async function ckAcao(p, msg){
  const { data, error } = await sb.rpc('atividade_checklist', { p });
  if (error || data?.status !== 'ok'){
    toast(semMigracao217(error) ? MIGRACAO_217 : data?.status === 'sem_permissao'
      ? 'Só quem está no grupo mexe na checklist.' : motivoRPC(data, error, msg || 'Não foi possível salvar'), true);
    return null;
  }
  return data;
}
async function ckRecarregar(focarLista){ await ckCarregar(atividades.card); ckRedesenhar(focarLista); }
async function ckNovaLista(){
  const a = atividades.card;
  abreModal(`<h3>Nova checklist</h3>
    <div class="form-grid" style="margin-top:12px">
      <div class="fld full"><label for="ckn-tit">Título</label><input id="ckn-tit" maxlength="80" placeholder="Checklist"></div>
      <div class="fld full"><label for="ckn-itens">Itens (opcional) ${dica('Um por linha. Uma lista colada em Markdown também serve: "- [x]" entra marcado.')}</label>
        <textarea id="ckn-itens" rows="5" placeholder="Conferir a fonte&#10;Aterrar a bancada"></textarea></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="ckn-btn" onclick="ckCriarLista()">Criar</button></div>`);
  setTimeout(() => $('#ckn-tit')?.focus(), 50);
  atividades.ckPara = a.id;
}
async function ckCriarLista(){
  const bt = $('#ckn-btn'); if (bt) bt.disabled = true;
  const d = await ckAcao({ acao:'lista_criar', atividade_id:atividades.ckPara, titulo:$('#ckn-tit').value.trim() || null,
    texto:$('#ckn-itens').value || null }, 'Não foi possível criar a checklist');
  if (bt) bt.disabled = false;
  if (!d) return;
  fechaModal();
  await ckRecarregar(d.id);
}
async function ckAdicionar(listaId){
  const ta = $('#ck-novo-' + listaId), t = (ta?.value || '').trim(); if (!t) return;
  ta.disabled = true;
  const d = await ckAcao({ acao:'item_criar', checklist_id:listaId, texto:t });
  ta.disabled = false;
  if (!d) return;
  ta.value = '';
  await ckRecarregar(listaId);
}
async function ckMarcar(itemId, feito){
  const l = (atividades.checks || []).find(x => x.itens.some(i => i.id === itemId));
  const i = l?.itens.find(x => x.id === itemId); if (!i) return;
  const antes = i.feito; i.feito = feito; ckRedesenhar();
  const d = await ckAcao({ acao:'item_marcar', item_id:itemId, feito });
  if (!d){ i.feito = antes; ckRedesenhar(); }
}
async function ckExcluirItem(itemId){
  if (await ckAcao({ acao:'item_excluir', item_id:itemId })) await ckRecarregar();
}
async function ckExcluirLista(listaId){
  const l = (atividades.checks || []).find(x => x.id === listaId); if (!l) return;
  if (!await confirma(`Excluir a checklist <b>${esc(l.titulo)}</b>${l.itens.length ? ` e os ${l.itens.length} itens dela` : ''}?`, 'Excluir')) return;
  if (await ckAcao({ acao:'lista_excluir', checklist_id:listaId })) telaCard(atividades.card.codigo);
}
function ckEditarTexto(el, valor, salvar){
  el.onclick = null; el.classList.remove('editavel');
  el.innerHTML = `<input value="${esc(valor)}" style="width:100%;font:inherit;background:var(--campo);border:1px solid var(--line2);border-radius:8px;padding:3px 8px;color:inherit">`;
  const i = el.querySelector('input'); i.focus(); i.select();
  let feito = false;
  const fim = async (grava) => { if (feito) return; feito = true;
    const v = i.value.trim();
    if (grava && v && v !== valor) await salvar(v);
    ckRedesenhar(); };
  i.onblur = () => fim(true);
  i.onkeydown = e => { if (e.key === 'Enter'){ e.preventDefault(); i.blur(); } if (e.key === 'Escape'){ e.preventDefault(); fim(false); } };
}
function ckEditarItem(ev, itemId){
  if (ev?.target?.closest('a')) return;
  const l = (atividades.checks || []).find(x => x.itens.some(i => i.id === itemId));
  const i = l?.itens.find(x => x.id === itemId); if (!i) return;
  ckEditarTexto($('#ck-tx-' + itemId), i.texto, async v => { if (await ckAcao({ acao:'item_editar', item_id:itemId, texto:v })) i.texto = v; });
}
function ckRenomear(listaId){
  const l = (atividades.checks || []).find(x => x.id === listaId); if (!l) return;
  ckEditarTexto($('#ck-tit-' + listaId), l.titulo, async v => { if (await ckAcao({ acao:'lista_renomear', checklist_id:listaId, titulo:v })) l.titulo = v; });
}
/* arrastar um item: solta antes do item de baixo, ou no fim da lista */
function ckLigarArraste(edito){
  if (!edito) return;
  let arrastado = null;
  document.querySelectorAll('#ck-corpo .ck-item[draggable]').forEach(el => {
    el.addEventListener('dragstart', e => { arrastado = el.dataset.id; e.dataTransfer.effectAllowed = 'move'; el.style.opacity = '.5'; });
    el.addEventListener('dragend', () => { el.style.opacity = ''; });
  });
  document.querySelectorAll('#ck-corpo .ck-itens').forEach(box => {
    box.addEventListener('dragover', e => { if (arrastado){ e.preventDefault(); } });
    box.addEventListener('drop', async e => {
      if (!arrastado) return; e.preventDefault();
      const listaId = box.dataset.lista, l = atividades.checks.find(x => x.id === listaId);
      const sobre = e.target.closest('.ck-item');
      const outros = l.itens.filter(i => i.id !== arrastado);
      let ordem;
      if (sobre && sobre.dataset.id !== arrastado){
        const ix = outros.findIndex(i => i.id === sobre.dataset.id);
        const r = sobre.getBoundingClientRect(), depois = e.clientY > r.top + r.height / 2;
        const a1 = depois ? outros[ix] : outros[ix - 1], b1 = depois ? outros[ix + 1] : outros[ix];
        ordem = a1 && b1 ? (a1.ordem + b1.ordem) / 2 : a1 ? a1.ordem + 1 : (b1 ? b1.ordem - 1 : 1);
      } else ordem = (outros.length ? outros[outros.length - 1].ordem : 0) + 1;
      const id = arrastado; arrastado = null;
      if (await ckAcao({ acao:'item_mover', item_id:id, checklist_id:listaId, ordem })) await ckRecarregar();
    });
  });
}

/* ============================================================
   COMENTÁRIOS: Markdown, @ para marcar, e o seu se corrige (2.17.0)
   ============================================================ */
const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function comentarioHTML(c){
  const q = (state.membros || []).find(m => m.registro === c.registro);
  const menc = (c.mencionados || []).map(r => (state.membros || []).find(m => m.registro === r)).filter(Boolean);
  /* marcado pelo jeito antigo (os botões com o nome) não tem @ no texto:
     a linha de baixo diz quem foi marcado */
  const foraDoTexto = menc.filter(m => !new RegExp('@(' + escRe(m.nome) + '|' + escRe(rotuloMencao(m)) + ')', 'u').test(c.corpo || ''));
  const meu = c.registro != null && c.registro === state.perfil?.registro;
  const g = grupoDoCartao(atividades.card);
  return `<div class="cm" id="cm-${c.id}">
    ${q ? avatarFoto(q, 28, 10) : ''}
    <div class="cm-cx"><div class="cm-tp"><b>${esc(q?.nome || 'Alguém')}</b>
      <span>${fmtQuando(c.criado_em)}</span>${c.editado_em ? '<span class="ed">editado</span>' : ''}</div>
    <div class="cm-cp md" id="cm-cp-${c.id}">${md(c.corpo, { mencoes: menc })}</div>
    ${foraDoTexto.length ? `<div class="cm-marcou">Marcou: ${foraDoTexto.map(m =>
      `<a class="mencao${m.registro === state.perfil?.registro ? ' eu' : ''}" href="#/equipe/${m.registro}">@${esc(rotuloMencao(m))}</a>`).join(' ')}</div>` : ''}
    ${(meu && posso.editar(g)) || can() ? `<div class="cm-acs">
      ${meu && posso.editar(g) ? `<button type="button" onclick="comentarioEditar('${c.id}')">Editar</button>` : ''}
      <button type="button" onclick="comentarioExcluir('${c.id}')">Excluir</button></div>` : ''}
    </div></div>`;
}
/* os marcados de um texto: quem do quadro aparece como @Nome */
function mencoesNoTexto(texto, grupoId){
  const t = String(texto || '');
  return pessoasMencionaveis(grupoId).filter(m => m.registro !== state.perfil?.registro
    && new RegExp('@(' + escRe(m.nome) + '|' + escRe(rotuloMencao(m)) + ')(?![\\p{L}\\p{N}])', 'u').test(t)).map(m => m.registro);
}

async function enviarComentario(){
  const a = atividades.card;
  const cx = $('#cd-coment'), b = $('#cd-btn');
  const corpo = (cx?.value || '').trim();
  if (!corpo || !a) return;
  const mencionados = mencoesNoTexto(corpo, a.grupo_id);

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
function comentarioEditar(id){
  const c = (atividades.comentarios || []).find(x => x.id === id); if (!c) return;
  const el = $('#cm-cp-' + id); if (!el) return;
  el.classList.remove('md');
  el.innerHTML = `<textarea id="cm-ed-${id}" rows="3" style="width:100%;background:var(--campo);border:1px solid var(--line2);
      border-radius:10px;padding:8px 10px;color:var(--ink);font:inherit;font-size:13px">${esc(c.corpo)}</textarea>
    <div class="acts" style="margin-top:8px"><button class="btn solid mini" onclick="comentarioSalvar('${id}')">Salvar</button>
      <button class="btn ghost mini" onclick="telaCard(atividades.card.codigo)">Cancelar</button></div>`;
  ligarMencoes('cm-ed-' + id, atividades.card.grupo_id);
  $('#cm-ed-' + id).focus();
}
async function comentarioSalvar(id){
  const corpo = ($('#cm-ed-' + id)?.value || '').trim(); if (!corpo) return;
  const { data, error } = await sb.rpc('atividade_comentario_editar', { p:{ id, corpo,
    mencionados: mencoesNoTexto(corpo, atividades.card.grupo_id) } });
  if (error || data?.status !== 'ok')
    return toast(semMigracao217(error) ? MIGRACAO_217 : motivoRPC(data, error, 'Não foi possível salvar o comentário'), true);
  carregarNotificacoes();
  telaCard(atividades.card.codigo);
}
async function comentarioExcluir(id){
  if (!await confirma('Excluir este comentário?', 'Excluir')) return;
  const { data, error } = await sb.rpc('atividade_comentario_excluir', { p:{ id } });
  if (error || data?.status !== 'ok')
    return toast(semMigracao217(error) ? MIGRACAO_217 : motivoRPC(data, error, 'Não foi possível excluir o comentário'), true);
  toast('Comentário excluído.');
  telaCard(atividades.card.codigo);
}

/* ---- @ para marcar ----
   Digitar @ abre a lista de quem se pode marcar no quadro, filtrada pelo
   que vem depois (sem acento, pelo nome e pelo sobrenome). Setas e Enter
   (ou Tab) escolhem; Esc fecha. Entra no texto "@Nome Sobrenome", que é
   como a menção aparece no comentário e como o banco sabe quem avisar. */
const mencao = { el:null, ta:null, grupo:null, lista:[], ativo:0, ini:0 };
function ligarMencoes(id, grupoId){
  const ta = document.getElementById(id); if (!ta || ta.dataset.menc) return;
  ta.dataset.menc = '1';
  ta.addEventListener('input', () => mencaoAtualizar(ta, grupoId));
  ta.addEventListener('click', () => mencaoAtualizar(ta, grupoId));
  ta.addEventListener('keydown', e => {
    if (!mencao.el || mencao.ta !== ta) return;
    if (e.key === 'ArrowDown'){ e.preventDefault(); mencao.ativo = (mencao.ativo + 1) % mencao.lista.length; mencaoDesenhar(); }
    else if (e.key === 'ArrowUp'){ e.preventDefault(); mencao.ativo = (mencao.ativo - 1 + mencao.lista.length) % mencao.lista.length; mencaoDesenhar(); }
    else if (e.key === 'Enter' || e.key === 'Tab'){ e.preventDefault(); mencaoEscolher(mencao.ativo); }
    else if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); mencaoFechar(); }
  });
  ta.addEventListener('blur', () => setTimeout(() => { if (mencao.ta === ta && document.activeElement !== ta) mencaoFechar(); }, 150));
}
function mencaoAtualizar(ta, grupoId){
  const antes = ta.value.slice(0, ta.selectionStart);
  const m = antes.match(/(^|[\s(])@([\p{L}\p{N}._-]{0,30})$/u);
  if (!m) return mencaoFechar();
  const q = norm(m[2]);
  const lista = pessoasMencionaveis(grupoId).filter(p => p.registro !== state.perfil?.registro)
    .filter(p => !q || norm(p.nome).split(/\s+/).some(w => w.startsWith(q)) || norm(p.nome).startsWith(q)).slice(0, 8);
  if (!lista.length) return mencaoFechar();
  Object.assign(mencao, { ta, grupo:grupoId, lista, ini: ta.selectionStart - m[2].length - 1,
    ativo: mencao.ta === ta && mencao.el ? Math.min(mencao.ativo, lista.length - 1) : 0 });
  if (!mencao.el){
    mencao.el = document.createElement('div');
    mencao.el.className = 'menc-pop'; mencao.el.setAttribute('role', 'listbox'); mencao.el.setAttribute('aria-label', 'Marcar alguém');
    document.body.appendChild(mencao.el);
  }
  mencaoDesenhar();
  const p = posicaoDoCursor(ta);
  const w = 300, h = mencao.el.offsetHeight;
  mencao.el.style.left = Math.max(12, Math.min(p.x, innerWidth - w - 12)) + 'px';
  mencao.el.style.top = (p.y + 6 + h > innerHeight - 8 ? Math.max(8, p.y - p.alto - h - 6) : p.y + 6) + 'px';
}
function mencaoDesenhar(){
  if (!mencao.el) return;
  const g = grupoDoCartao(atividades.card);
  const doGrupo = new Set(pessoasDoGrupoDe(mencao.grupo).map(m => m.registro));
  mencao.el.innerHTML = mencao.lista.map((m, i) => `<button type="button" class="menc-op${i === mencao.ativo ? ' ativo' : ''}" role="option"
    aria-selected="${i === mencao.ativo}" onmousedown="event.preventDefault();mencaoEscolher(${i})">${avatarFoto(m, 22, 9)}
    <span class="nm">${esc(m.nome)}</span><span class="sub">${doGrupo.has(m.registro) ? esc(g?.prefixo || '') : ''}</span></button>`).join('');
}
function mencaoEscolher(i){
  const m = mencao.lista[i], ta = mencao.ta; if (!m || !ta) return;
  const ins = '@' + rotuloMencao(m) + ' ';
  const fim = ta.selectionStart;
  ta.value = ta.value.slice(0, mencao.ini) + ins + ta.value.slice(fim);
  const pos = mencao.ini + ins.length;
  ta.setSelectionRange(pos, pos); ta.focus();
  mencaoFechar();
}
function mencaoFechar(){ mencao.el?.remove(); mencao.el = null; mencao.ta = null; mencao.ativo = 0; }
/* o botão "Marcar": põe o @ onde está o cursor e abre a lista */
function mencaoIniciar(id){
  const ta = document.getElementById(id); if (!ta) return;
  const p = ta.selectionStart ?? ta.value.length, antes = ta.value.slice(0, p);
  const ins = (antes && !/\s$/.test(antes) ? ' ' : '') + '@';
  ta.value = antes + ins + ta.value.slice(p);
  ta.focus(); ta.setSelectionRange(p + ins.length, p + ins.length);
  ta.dispatchEvent(new Event('input'));
}
/* onde está o cursor no textarea, na tela: um espelho invisível com o
   mesmo estilo mede até o cursor */
function posicaoDoCursor(ta){
  const cs = getComputedStyle(ta), d = document.createElement('div');
  ['boxSizing','width','borderTopWidth','borderRightWidth','borderBottomWidth','borderLeftWidth','paddingTop','paddingRight',
   'paddingBottom','paddingLeft','fontStyle','fontVariant','fontWeight','fontSize','lineHeight','fontFamily','textAlign',
   'textTransform','textIndent','letterSpacing','wordSpacing','tabSize'].forEach(k => d.style[k] = cs[k]);
  Object.assign(d.style, { position:'absolute', visibility:'hidden', whiteSpace:'pre-wrap', overflowWrap:'break-word', top:'0', left:'-9999px' });
  d.textContent = ta.value.slice(0, ta.selectionStart);
  const s = document.createElement('span'); s.textContent = ta.value.slice(ta.selectionStart) || '.'; d.appendChild(s);
  document.body.appendChild(d);
  const r = ta.getBoundingClientRect(), alto = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.45;
  const x = r.left + s.offsetLeft - ta.scrollLeft, y = r.top + s.offsetTop - ta.scrollTop + alto;
  d.remove();
  return { x, y: Math.min(y, r.bottom), alto };
}
window.addEventListener('scroll', e => { if (mencao.el && e.target !== mencao.ta) mencaoFechar(); }, true);

/* ============================================================
   COPIAR PARA OUTRO QUADRO (2.17.0)
   Para o mesmo quadro é duplicar. Arrastar para outro quadro não
   existe porque o código leva o prefixo do grupo: mover é copiar e
   arquivar o original, e a cópia guarda de onde veio.
   ============================================================ */
function modalCopiar(){
  const a = atividades.card, g = grupoDoCartao(a);
  const destinos = meusGrupos().filter(x => posso.editar(x));
  if (!destinos.length) return toast('Você não edita nenhum quadro.', true);
  const leva = [['descricao', 'Descrição'], ['checklists', 'Checklists'], ['pessoas', 'Responsável e outras pessoas'],
                ['etiquetas', 'Etiquetas'], ['prazo', 'Prazo']];
  abreModal(`<h3>Copiar ${esc(a.codigo)}</h3>
    <div class="form-grid" style="margin-top:14px">
      <div class="fld"><label for="cp-grupo">Para o quadro</label>
        <select id="cp-grupo">${destinos.map(x => `<option value="${x.id}" ${x.id === a.grupo_id ? 'selected' : ''}>${esc(x.prefixo)} ${esc(x.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label for="cp-status">Coluna</label>
        <select id="cp-status">${COLUNAS.map(([k, l]) => `<option value="${k}" ${k === a.status ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld full"><label for="cp-tit">Título</label><input id="cp-tit" value="${esc(a.titulo)}"></div>
      <div class="fld full"><label>Levar junto ${dica('Comentários e histórico ficam no cartão de origem: são a conversa de lá.')}</label>
        <div class="multi" style="max-height:none">${leva.map(([k, l]) =>
          `<label class="check"><input type="checkbox" class="cp-com" value="${k}" checked> ${l}</label>`).join('')}</div></div>
      ${posso.editar(g) && !a.arquivada ? `<div class="fld full"><label class="check"><input type="checkbox" id="cp-arq">
        Arquivar ${esc(a.codigo)} depois de copiar (mover)</label></div>` : ''}
    </div>
    <p class="err-msg" id="cp-erro"></p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="cp-btn" onclick="copiarCartao()">Copiar</button></div>`, true);
}
async function copiarCartao(){
  const a = atividades.card, bt = $('#cp-btn');
  const com = {}; document.querySelectorAll('.cp-com').forEach(x => com[x.value] = x.checked);
  bt.disabled = true;
  try{
    const { data, error } = await sb.rpc('atividade_copiar', { p:{ id:a.id, grupo_id:+$('#cp-grupo').value,
      status:$('#cp-status').value, titulo:$('#cp-tit').value.trim() || null, com, arquivar: !!$('#cp-arq')?.checked } });
    if (error || data?.status !== 'ok'){
      $('#cp-erro').textContent = semMigracao217(error) ? MIGRACAO_217
        : data?.status === 'sem_permissao' ? 'Só quem edita o quadro de destino cria cartão nele.'
        : motivoRPC(data, error, 'Não foi possível copiar');
      return;
    }
    fechaModal();
    toast(`${a.codigo} copiada como ${data.codigo}.`);
    await atvCarregar(true);
    location.hash = '#/atividades/card/' + data.codigo;
  } finally { const b = $('#cp-btn'); if (b) b.disabled = false; }
}
function copiarLinkCartao(){
  copiar(location.origin + location.pathname + '#/atividades/card/' + atividades.card.codigo);
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
  const linhas = (data || []).filter(x => x.abertas > 0 || x.atrasadas > 0);
  const max = Math.max(1, ...linhas.map(x => x.abertas));
  $('#main').innerHTML = `
    <div class="topo-gestao"><div class="tx"><span class="eyebrow">Trabalho</span>
      <h1>Carga da equipe</h1>
      <p class="lead">Atividades abertas, atrasadas e sinalizadas por pessoa, como responsável ou incluída.</p></div>
      <div class="acoes"><a class="btn ghost" href="#/atividades">${ic('back')} Quadro</a></div></div>
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
      : '<div class="vazio"><div class="glyph">0</div><h3>Ninguém com atividade aberta</h3></div>'}`;
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   ============================================================ */
registrarBusca({
  fonte:'atividades', rotulo:'Atividades',
  buscar: (t) => filtrarSimples(atividades.itens.map(a => ({
    titulo: a.titulo,
    sub: `${rotuloStatus(a.status)}, ${a.grupo}${a.responsavel_nome ? ', ' + a.responsavel_nome : ''}${
      (a.etiquetas || []).length ? ', ' + a.etiquetas.join(', ') : ''}`,
    codigo: a.codigo,
    href: '#/atividades/card/' + a.codigo
  })), t, 6)
});
