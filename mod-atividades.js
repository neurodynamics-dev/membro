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
   isso em vez de quebrar.

   Depende da casca para: sb, $, esc, norm, state, can, toast,
   abreModal, fechaModal, fmtD, hojeISO, pad3, avatarFoto,
   registrarBusca, filtrarSimples, carregarNotificacoes.
   ============================================================ */

const atividades = {
  pronto:false, grupos:[], itens:[], grupoAtual:null, erro:null,
  filtro:{ q:'', pessoa:null, so:'' },   /* so: '' | 'atrasadas' | 'sinalizadas' | 'minhas' */
  card:null, arrastando:null
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
const rotuloStatus = s => (COLUNAS.find(c => c[0] === s) || [,s])[1];
const corPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [,,'var(--dim)'])[2];
const rotuloPrioridade = p => (PRIORIDADES.find(x => x[0] === p) || [,p])[1];

/* ============================================================
   CARGA
   ============================================================ */
async function atvCarregar(forcar){
  if (atividades.pronto && !forcar) return;
  const [g, a] = await Promise.all([
    sb.from('grupos').select('*').eq('ativo', true).order('nome'),
    sb.from('atividades_quadro').select('*').eq('arquivada', false).order('ordem')
  ]);
  if (g.error || a.error){ atividades.erro = (g.error || a.error); return; }
  atividades.erro = null;
  atividades.grupos = g.data || [];
  atividades.itens  = a.data || [];
  atividades.pronto = true;
}

const meusGrupos = () => {
  const meus = (state.membros.find(m => m.registro === state.perfil?.registro)?.grupos) || [];
  const lista = atividades.grupos.filter(g => meus.includes(g.nome));
  return (can() || !lista.length) ? atividades.grupos : lista;
};

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
      <div class="vazio"><div class="glyph">—</div><h3>Nenhum grupo ainda</h3>
      <p>O quadro é por grupo. Assim que o Depto. de Pessoal colocar você em um,
      ele aparece aqui.</p></div>`;
    return;
  }
  atividades.grupoAtual = gs.find(g => g.prefixo === (sub||'').toUpperCase())
    || gs.find(g => g.id === atividades.grupoAtual?.id) || gs[0];
  telaQuadro();
}

/* ============================================================
   O QUADRO
   ============================================================ */
function telaQuadro(){
  const g = atividades.grupoAtual, gs = meusGrupos();
  const f = atividades.filtro;
  $('#main').innerHTML = `
    <div class="topo-gestao">
      <div class="tx"><span class="eyebrow">Trabalho</span>
        <h1>Atividades</h1>
        <p class="lead">O quadro do grupo, com prazo, responsável e o que precisa de atenção.
          Cada cartão tem um código — é por ele que a equipe se refere à atividade.</p></div>
      <div class="acoes"><button class="btn solid" onclick="modalNovaAtividade()">Nova atividade</button></div>
    </div>
    ${gs.length > 1 ? `<nav class="abas">${gs.map(x =>
      `<a href="#/atividades/${x.prefixo}" class="${x.id===g.id?'on':''}">${esc(x.nome)}</a>`).join('')}
      <a href="#/atividades/carga">Carga da equipe</a></nav>`
      : `<nav class="abas"><a href="#/atividades/${g.prefixo}" class="on">${esc(g.nome)}</a>
         <a href="#/atividades/carga">Carga da equipe</a></nav>`}
    <div class="filtros">
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
    </div>
    <div id="atv-resumo"></div>
    <div class="kanban" id="kanban"></div>`;
  desenhaColunas();
}

function pessoasDoGrupo(){
  const g = atividades.grupoAtual;
  return (state.membros || []).filter(m => (m.grupos||[]).includes(g?.nome)
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

  $('#kanban').innerHTML = COLUNAS.map(([st, rot]) => {
    const cards = vis.filter(a => a.status === st).sort((a,b) => a.ordem - b.ordem);
    return `<section class="kb-col" data-st="${st}"
      ondragover="event.preventDefault();this.classList.add('sobre')"
      ondragleave="this.classList.remove('sobre')"
      ondrop="soltarEm(event,'${st}',null)">
      <header><span>${rot}</span><span class="n">${cards.length}</span></header>
      <div class="kb-itens">${cards.map(cartaoHTML).join('')
        || '<div class="kb-vazio">nada aqui</div>'}</div>
      <button class="kb-add" onclick="modalNovaAtividade('${st}')">+ atividade</button>
    </section>`;
  }).join('');
}

function cartaoHTML(a){
  const atrasada = a.atrasada;
  const dono = (state.membros || []).find(m => m.registro === a.responsavel);
  return `<article class="kb-card${a.sinalizada?' sinalizada':''}" draggable="true"
    data-id="${a.id}" ondragstart="atividades.arrastando='${a.id}';this.classList.add('mov')"
    ondragend="this.classList.remove('mov');document.querySelectorAll('.kb-col').forEach(c=>c.classList.remove('sobre'))"
    ondragover="event.preventDefault();event.stopPropagation()"
    ondrop="event.stopPropagation();soltarEm(event,'${a.status}','${a.id}')"
    onclick="location.hash='#/atividades/card/${a.codigo}'">
    <div class="kb-top">
      <span class="cod">${esc(a.codigo)}</span>
      <span class="pri" style="background:${corPrioridade(a.prioridade)}"
        title="Prioridade ${rotuloPrioridade(a.prioridade).toLowerCase()}"></span>
    </div>
    <div class="kb-tit">${esc(a.titulo)}</div>
    ${a.sinalizada ? `<div class="kb-flag">${esc(a.sinalizada_motivo || 'Precisa de atenção')}</div>` : ''}
    <div class="kb-pe">
      ${dono ? avatarFoto(dono, 22, 9) : '<span class="kb-sem">sem responsável</span>'}
      <span class="kb-meta">
        ${a.prazo ? `<span class="${atrasada?'atrasado':''}">${fmtD(a.prazo)}</span>` : ''}
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
  const { data, error } = await sb.rpc('atividade_criar', { p: {
    grupo_id: atividades.grupoAtual.id,
    titulo: tit,
    descricao: $('#na-desc').value.trim() || null,
    responsavel: $('#na-resp').value || null,
    prazo: $('#na-prazo').value || null,
    prioridade: $('#na-pri').value,
    status: $('#na-status').value
  }});
  $('#na-btn').disabled = false;
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
}

/* ============================================================
   O CARTÃO — #/atividades/card/<codigo>
   ============================================================ */
async function telaCard(codigo){
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
  const [c, l, s] = await Promise.all([
    sb.from('atividade_comentarios').select('*').eq('atividade_id', a.id).order('criado_em'),
    sb.from('atividade_log').select('*').eq('atividade_id', a.id).order('criado_em', { ascending:false }).limit(40),
    sb.from('atividade_seguidores').select('registro').eq('atividade_id', a.id)
  ]);
  desenhaCard(a, c.data || [], l.data || [], (s.data || []).map(x => x.registro));
}

function desenhaCard(a, comentarios, log, seguidores){
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

/* As pessoas que podem responder por uma atividade do grupo — mais quem
   já responde por ela. Sem essa segunda parte, alguém que saiu do grupo
   sumia da lista, o seletor caía em "ninguém" e o próximo salvamento
   apagava o responsável sem ninguém pedir. */
function pessoasDoGrupoDe(grupoId, incluirRegistro){
  const g = atividades.grupos.find(x => x.id === grupoId);
  const lista = (state.membros || []).filter(m => (m.grupos||[]).includes(g?.nome)
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
  const corpo = $('#cd-coment').value.trim();
  if (!corpo) return;
  const mencionados = [...document.querySelectorAll('.cd-menc .chip.on')].map(b => +b.dataset.reg);
  $('#cd-btn').disabled = true;
  const { data, error } = await sb.rpc('atividade_comentar', { p: { atividade_id: a.id, corpo, mencionados }});
  $('#cd-btn').disabled = false;
  if (error || data?.status !== 'ok'){
    toast('Não foi possível comentar' + (error ? ': ' + error.message : '.'), true); return;
  }
  carregarNotificacoes();
  telaCard(a.codigo);
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
