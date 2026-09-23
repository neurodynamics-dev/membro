/* ============================================================
   MÓDULO · PROJETOS
   Um projeto é uma equipe e um rol de arquivos. A equipe é um grupo
   — dentro de NRO_PROJECTS, então quem entra na equipe entra também
   lá —, e um membro dela é o supervisor, que cuida de quem está nela.
   O rol é o padrão de projeto (Arquivos › Configurações) aplicado a
   este projeto: o PMO põe uma série no padrão e todo projeto passa a
   tê-la.

   Rotas:
     #/projetos                    todos os projetos
     #/projetos/novo               idem, com o formulário de projeto novo aberto
     #/projetos/<CÓDIGO>           o projeto: equipe, supervisor, resumo do rol
     #/projetos/<CÓDIGO>/arquivos  o rol de arquivos do projeto

   Precisa da migração db/v20_projetos_arquivos.sql. O rol é desenhado
   por mod-arquivos, carregado antes com carregarModulo('arquivos').

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, ic, ibtn, confirma, falha, motivoRPC, avatarFoto,
   nomeDe, carregarModulo, registrarBusca, filtrarSimples, can,
   gruposEfetivos, gruposAcima, grupoPorId, viaDoGrupo, docGestor,
   logoProjeto, carregarGrupos, carregarProjetosEArquivos, desenharMenu.
   ============================================================ */

const projetosM = { lista:[], arquivos:[], padrao:[], erro:null, ver:'meus', status:'ativo',
                    novo:null, equipe:null };
const STATUS_PROJETO = { ativo:['Ativo', 'ok', 'p-ok'], pausado:['Pausado', 'warn', 'p-warn'], encerrado:['Encerrado', 'gray', ''] };
const ATIVOS_PJ = ['Ativo', 'Em pausa / avaliação'];

const pjEu = () => (state.membros || []).find(m => m.registro === state.perfil?.registro);
const pjGrupo = p => grupoPorId(p.grupo_id);
/* A equipe: quem está no grupo do projeto, contando subgrupos. */
function pjEquipe(p){
  const g = pjGrupo(p); if (!g) return [];
  return (state.membros || []).filter(m => ATIVOS_PJ.includes(m.status) && gruposEfetivos(m).has(g.nome))
    .map(m => ({ m, via: viaDoGrupo(m, g.nome) }))
    .sort((a, b) => (b.m.registro === p.supervisor) - (a.m.registro === p.supervisor) || a.m.nome.localeCompare(b.m.nome, 'pt-BR'));
}
const pjSouDaEquipe = p => { const g = pjGrupo(p); return !!g && gruposEfetivos(pjEu()).has(g.nome); };
const pjPodeEditar = p => docGestor() || (p.supervisor != null && p.supervisor === state.perfil?.registro);
/* Pôr e tirar gente da equipe: admin, pessoal, e quem é responsável pelo
   grupo do projeto ou por um grupo acima dele (o supervisor é). */
function pjPodeEquipe(p){
  if (can()) return true;
  const eu = state.perfil?.registro; if (eu == null) return false;
  return gruposAcima(pjGrupo(p)).some(g => (g.responsaveis || []).includes(eu));
}
const pjPill = s => { const x = STATUS_PROJETO[s] || STATUS_PROJETO.ativo;
  return `<span class="pill ${x[2]}"><span class="dt dt-${x[1]}"></span>${x[0]}</span>`; };

async function pjCarregar(){
  const [pj, ar, pd] = await Promise.all([
    sb.from('projetos').select('*').order('nome'),
    sb.from('doc_arquivos').select('id,projeto_id,serie_id,status,rev_pendente'),
    sb.from('doc_padrao_projeto').select('serie_id,quantidade')
  ]);
  if (pj.error){ projetosM.erro = pj.error; return; }
  projetosM.erro = null;
  projetosM.lista = pj.data || [];
  projetosM.arquivos = (ar.data || []).filter(a => a.projeto_id);
  projetosM.padrao = pd.data || [];
}
/* Quanto do padrão o projeto já tem em vigor: uma série do padrão conta
   quando o projeto tem ao menos um PN dela ativo. */
function pjProgresso(p){
  const doPj = projetosM.arquivos.filter(a => a.projeto_id === p.id);
  const series = projetosM.padrao.map(pd => doPj.filter(a => a.serie_id === pd.serie_id));
  return {
    total: projetosM.padrao.length,
    ativos: series.filter(s => s.some(a => a.status === 'ativo')).length,
    revisao: series.filter(s => !s.some(a => a.status === 'ativo') && s.some(a => a.rev_pendente || a.status === 'em_revisao')).length,
    rascunho: series.filter(s => s.length && s.every(a => a.status === 'rascunho' && !a.rev_pendente)).length
  };
}
function pjBarra(pr){
  if (!pr.total) return '<span class="n">sem padrão de projeto</span>';
  const pc = n => (100 * n / pr.total).toFixed(1) + '%';
  return `<span class="trilho" title="${pr.ativos} em vigor, ${pr.revisao} em revisão, ${pr.rascunho} em rascunho, de ${pr.total} do padrão">
      <span style="width:${pc(pr.ativos)};background:var(--ok)"></span><span style="width:${pc(pr.revisao)};background:var(--warn)"></span>
      <span style="width:${pc(pr.rascunho)};background:var(--dim)"></span></span>
    <span class="n">${pr.ativos} de ${pr.total}</span>`;
}

/* ---------------- rota ---------------- */
async function pageProjetos(sub, sub2){
  $('#main').innerHTML = '<div class="carregando"><span class="spin"></span> Carregando os projetos…</div>';
  await pjCarregar();
  if (projetosM.erro){
    $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Projetos</span><h1>Projetos</h1></div></div>
      <div class="aviso-box err"><b>Projetos ainda não estão no banco.</b> ${esc(projetosM.erro.message || '')}<br>
      <span class="small">Falta aplicar a migração <code>db/v20_projetos_arquivos.sql</code>.</span></div>`;
    return;
  }
  if (!sub || sub === 'novo'){
    pjLista();
    if (sub === 'novo' && docGestor()) pjModalNovo();
    return;
  }
  const p = projetosM.lista.find(x => x.codigo === String(sub).toUpperCase());
  if (!p){
    $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div>
      <h3>Nenhum projeto com o código ${esc(sub)}</h3><p>Ele pode ter mudado de código — procure na lista.</p>
      <a class="btn ghost" href="#/projetos">Todos os projetos</a></div>`;
    return;
  }
  return pjPagina(p, sub2 === 'arquivos' ? 'arquivos' : '');
}

/* ---------------- a lista ---------------- */
function pjLista(){
  const f = projetosM;
  const mostra = f.lista.filter(p => (f.ver === 'todos' || pjSouDaEquipe(p)) && (!f.status || p.status === f.status));
  const meus = f.lista.filter(pjSouDaEquipe).length;
  $('#main').innerHTML = `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Projetos</span>
      <h1>Projetos</h1><p class="lead">Cada projeto é uma equipe — um grupo dentro de NRO_PROJECTS — e um rol de
      arquivos, que segue o padrão de projeto definido pelo PMO.</p></div>
      ${docGestor() ? `<div class="acoes"><button class="btn solid mini" onclick="pjModalNovo()">${ic('plus')} Novo projeto</button></div>` : ''}</div>
    <div class="filtros" style="align-items:center">
      <div class="seg" role="group" aria-label="Quais projetos">
        <button class="${f.ver === 'meus' ? 'on' : ''}" aria-pressed="${f.ver === 'meus'}" onclick="projetosM.ver='meus';pjLista()">Meus · ${meus}</button>
        <button class="${f.ver === 'todos' ? 'on' : ''}" aria-pressed="${f.ver === 'todos'}" onclick="projetosM.ver='todos';pjLista()">Todos · ${f.lista.length}</button></div>
      <div class="seg" role="group" aria-label="Status">
        ${[['ativo', 'Ativos'], ['pausado', 'Pausados'], ['encerrado', 'Encerrados'], ['', 'Qualquer status']].map(([k, l]) =>
          `<button class="${f.status === k ? 'on' : ''}" aria-pressed="${f.status === k}" onclick="projetosM.status='${k}';pjLista()">${l}</button>`).join('')}</div>
    </div>
    ${mostra.length ? `<div class="pj-grade">${mostra.map(pjCartao).join('')}</div>`
      : `<div class="vazio"><div class="glyph">◇</div><h3>${f.ver === 'meus' && f.lista.length ? 'Você não está na equipe de nenhum projeto' + (f.status ? ' com esse status' : '') : 'Nenhum projeto ainda'}</h3>
        <p>${f.ver === 'meus' && f.lista.length ? 'Veja todos os projetos da equipe.' : docGestor() ? 'Crie o primeiro: ele ganha um grupo, uma logo e o rol do padrão.' : 'O PMO cria os projetos.'}</p>
        ${f.ver === 'meus' && f.lista.length ? `<button class="btn ghost" onclick="projetosM.ver='todos';pjLista()">Ver todos</button>`
          : docGestor() ? `<button class="btn solid" onclick="pjModalNovo()">Novo projeto</button>` : ''}</div>`}`;
}
function pjCartao(p){
  const eq = pjEquipe(p), sup = eq.find(x => x.m.registro === p.supervisor)?.m;
  return `<a class="pj-card" href="#/projetos/${esc(p.codigo)}">
    <span class="topo">${logoProjeto(p.logo_semente, 52, p.nome)}
      <span class="tx"><span class="nm">${esc(p.nome)}</span><span class="cd">${esc(p.codigo)}</span></span></span>
    <span class="desc">${esc(p.descricao || 'Sem descrição.')}</span>
    <span class="pj-prog">${pjBarra(pjProgresso(p))}</span>
    <span class="rodape"><span class="pj-rostos">${eq.slice(0, 5).map(x => avatarFoto(x.m, 24, 9)).join('')}
        ${eq.length > 5 ? `<span class="mais">+${eq.length - 5}</span>` : ''}${eq.length ? '' : 'sem equipe'}</span>
      <span>${sup ? 'Supervisão: ' + esc(sup.nome.split(' ')[0]) : 'sem supervisor'} · ${pjPill(p.status)}</span></span>
  </a>`;
}

/* ---------------- um projeto ---------------- */
async function pjPagina(p, aba){
  const g = pjGrupo(p);
  const eq = pjEquipe(p);
  const sup = (state.membros || []).find(m => m.registro === p.supervisor);
  const pr = pjProgresso(p);
  const quadro = g && g.quadro !== false;
  $('#main').innerHTML = `<div class="pj-topo">
      ${logoProjeto(p.logo_semente, 72, p.nome)}
      <div class="tx"><span class="eyebrow">Projeto · ${esc(p.codigo)}</span><h1>${esc(p.nome)}</h1>
        ${p.descricao ? `<p class="lead">${esc(p.descricao)}</p>` : ''}</div>
      <div class="acoes">${pjPill(p.status)}
        ${quadro ? `<a class="btn ghost mini" href="#/atividades/${esc(g.prefixo)}">${ic('quadro')} Quadro</a>` : ''}
        ${pjPodeEditar(p) ? `<button class="btn ghost mini" onclick="pjModalEditar('${p.id}')">${ic('pencil')} Editar</button>` : ''}</div>
    </div>
    <nav class="abas"><a href="#/projetos/${esc(p.codigo)}" class="${aba ? '' : 'on'}">Visão geral</a>
      <a href="#/projetos/${esc(p.codigo)}/arquivos" class="${aba === 'arquivos' ? 'on' : ''}">Arquivos · ${pr.ativos} de ${pr.total}</a></nav>
    <div id="pj-corpo" style="margin-top:18px"></div>`;

  if (aba === 'arquivos'){
    $('#pj-corpo').innerHTML = '<div class="carregando"><span class="spin"></span> Carregando o rol…</div>';
    try { await carregarModulo('arquivos'); }
    catch(e){ $('#pj-corpo').innerHTML = `<div class="aviso-box err">O rol não carregou (${esc(e.message)}). Recarregue a página.</div>`; return; }
    const { html } = await arqRolDoProjeto(p, pjSouDaEquipe(p) || docGestor());
    $('#pj-corpo').innerHTML = `<p class="small muted" style="margin-bottom:12px;line-height:1.6">O padrão de projeto aplicado ao
      ${esc(p.nome)}: uma linha por série do padrão — o PN deste projeto, ou "a criar". ${pjSouDaEquipe(p) || docGestor()
        ? 'Criar um PN o deixa em rascunho; a primeira versão enviada vai para revisão.' : 'Quem cria os PNs é a equipe do projeto.'}</p>` + html;
    return;
  }

  $('#pj-corpo').innerHTML = `<div class="pj-cols">
    <div class="card"><h3 style="display:flex;align-items:center;gap:10px">Equipe · ${eq.length}
        ${pjPodeEquipe(p) ? `<button class="btn ghost mini" style="margin-left:auto" onclick="pjModalEquipe('${p.id}')">${ic('users')} Gerenciar</button>` : ''}</h3>
      ${!sup ? '<div class="aviso-box warn" style="margin:6px 0 10px">O projeto está sem supervisor.</div>'
        : !eq.some(x => x.m.registro === sup.registro) ? `<div class="aviso-box warn" style="margin:6px 0 10px">${esc(sup.nome)}, supervisor, não está mais na equipe.</div>` : ''}
      ${eq.map(({ m, via }) => `<div class="pj-membro">${avatarFoto(m, 32, 11)}
          <span class="tx"><span class="nm">${esc(m.nome)}</span><span class="cg">${esc(m.cargo || '—')}${
            via && g && via !== g.nome ? ` · por ${esc(via)}` : ''}</span></span>
          ${m.registro === p.supervisor ? '<span class="pj-sup">Supervisor</span>' : ''}</div>`).join('')
        || '<p class="muted small">Ninguém na equipe ainda.</p>'}
      <p class="small muted" style="margin-top:12px;line-height:1.6">A equipe é o grupo <b>${esc(g?.nome || '—')}</b>. Quem está nela
        está também em ${esc(gruposAcima(g).slice(1).map(x => x.nome).join(' e ') || 'nenhum grupo acima')}, e lê os arquivos controlados do projeto.</p>
    </div>
    <div class="card"><h3>Rol de arquivos</h3>
      <div class="pj-prog" style="margin-top:4px">${pjBarra(pr)}</div>
      <div class="pj-resumo"><div><b>${pr.ativos}</b><span>em vigor</span></div><div><b>${pr.revisao}</b><span>em revisão</span></div>
        <div><b>${pr.rascunho}</b><span>rascunho</span></div><div><b>${Math.max(0, pr.total - pr.ativos - pr.revisao - pr.rascunho)}</b><span>a criar</span></div></div>
      <a class="btn ghost mini" style="margin-top:14px" href="#/projetos/${esc(p.codigo)}/arquivos">Abrir o rol ${ic('chevron')}</a>
      <p class="small muted" style="margin-top:14px;line-height:1.6">Criado em ${fmtD(p.criado_em)}.</p>
    </div></div>`;
}

/* ---------------- novo projeto ---------------- */
const pjCodigoDe = nome => String(nome || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^[0-9]+/, '').slice(0, 16);
const pjSemente = () => Math.random().toString(36).slice(2, 10);

function pjModalNovo(){
  projetosM.novo = { semente:null, mexeuCodigo:false, equipe:new Set(), busca:'' };
  const pais = (state.grupos || []).filter(g => !(state.projetos || []).some(p => p.grupo_id === g.id));
  abreModal(`<h3>Novo projeto</h3>
    <div class="form-grid">
      <div class="fld"><label for="pn-nome">Nome</label><input id="pn-nome" placeholder="Nebula" oninput="pjNovoNome()"></div>
      <div class="fld"><label for="pn-cod">Código</label><input id="pn-cod" placeholder="NEBULA" maxlength="16"
        style="text-transform:uppercase;font-family:var(--fm)" oninput="projetosM.novo.mexeuCodigo=true;pjNovoLogo()"></div>
      <div class="fld full"><div class="pj-logo-ed"><span id="pn-logo">${logoProjeto('?', 56)}</span>
        <span class="tx">A logo sai do código, como os avatares do GitHub — o mesmo código, a mesma logo.
          Não gostou? Sorteie outra.</span>
        <button type="button" class="btn ghost mini" onclick="projetosM.novo.semente=pjSemente();pjNovoLogo()">${ic('refazer')} Outra</button></div></div>
      <div class="fld full"><label for="pn-desc">Descrição</label><textarea id="pn-desc" rows="2" placeholder="Para que serve o projeto"></textarea></div>
      <div class="fld full"><label for="pn-sup">Supervisor</label><select id="pn-sup"><option value="">— escolha —</option>
        ${(state.membros || []).filter(m => ATIVOS_PJ.includes(m.status)).map(m => `<option value="${m.registro}">${esc(m.nome)}</option>`).join('')}</select>
        <span class="mailer-sub tight">Entra na equipe e passa a cuidar dela: põe e tira gente sem precisar da administração.</span></div>
      <div class="fld full"><label>Equipe</label>
        <input id="pn-busca" type="search" placeholder="Buscar pessoas…" oninput="projetosM.novo.busca=this.value;pjNovoLista()" style="margin-bottom:8px">
        <div class="gr-cands" id="pn-lista" style="max-height:200px"></div></div>
      <div class="fld full"><label for="pn-grupo">Grupo da equipe</label><select id="pn-grupo">
        <option value="">Criar um grupo novo dentro de ${esc((state.grupos || []).find(g => g.chave === 'projetos')?.nome || 'NRO_PROJECTS')}</option>
        ${pais.map(g => `<option value="${g.id}">Usar ${esc(g.nome)}, que já existe</option>`).join('')}</select></div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="pn-btn" onclick="pjCriar()">Criar o projeto</button></div>`, 'largo', true);
  pjNovoLista(); $('#pn-nome').focus();
}
function pjNovoNome(){ if (!projetosM.novo.mexeuCodigo) $('#pn-cod').value = pjCodigoDe($('#pn-nome').value); pjNovoLogo(); }
function pjNovoLogo(){ const n = projetosM.novo, cod = $('#pn-cod').value.trim().toUpperCase();
  $('#pn-logo').innerHTML = logoProjeto(n.semente || cod.toLowerCase() || '?', 56, 'Logo'); }
function pjNovoLista(){
  const n = projetosM.novo, q = norm(n.busca);
  const lista = (state.membros || []).filter(m => ATIVOS_PJ.includes(m.status)
    && (!q || [m.nome, m.cargo, m.departamento].some(x => norm(x).includes(q))))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('#pn-lista').innerHTML = lista.map(m => `<label class="gr-cand"><input type="checkbox" ${n.equipe.has(m.registro) ? 'checked' : ''}
      onchange="this.checked?projetosM.novo.equipe.add(${m.registro}):projetosM.novo.equipe.delete(${m.registro})">
      ${avatarFoto(m, 24, 9)}<span class="tx"><span class="nm">${esc(m.nome)}</span><span class="cg">${esc(m.cargo || '—')}</span></span></label>`).join('')
    || '<p class="muted small" style="padding:8px 0">Ninguém com essa busca.</p>';
}
async function pjCriar(){
  const n = projetosM.novo;
  const p = { nome: $('#pn-nome').value.trim(), codigo: $('#pn-cod').value.trim().toUpperCase(),
    descricao: $('#pn-desc').value.trim(), supervisor: $('#pn-sup').value ? Number($('#pn-sup').value) : null,
    equipe: [...n.equipe], grupo_id: $('#pn-grupo').value ? Number($('#pn-grupo').value) : null };
  if (n.semente) p.logo_semente = n.semente;
  if (!p.nome) return toast('O nome é obrigatório.', true);
  if (!/^[A-Z][A-Z0-9]{1,15}$/.test(p.codigo)) return toast('O código vai de 2 a 16 letras e números, começando por letra — NEBULA, ORION2.', true);
  if (!p.supervisor) return toast('Escolha o supervisor.', true);
  const b = $('#pn-btn'); if (b){ b.disabled = true; b.textContent = 'Criando…'; }
  try{
    const { data, error } = await sb.rpc('projeto_salvar', { p });
    if (error) throw error;
    if (data?.status === 'duplicado')
      return toast({ codigo:'Já existe um projeto com esse código.', grupo_nome:`Já existe um grupo chamado NRO_PROJECT_${p.codigo}.`,
                     grupo_id:'Esse grupo já é a equipe de outro projeto.' }[data.campo] || 'Já existe.', true);
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível criar o projeto'), true);
    fechaModal();
    await Promise.all([carregarGrupos(), carregarProjetosEArquivos(), pjRecarregarFichas()]);
    toast(`${p.nome} criado, com a equipe no grupo dele.`);
    location.hash = '#/projetos/' + data.codigo;
  }catch(e){ falha(e, 'Erro ao criar o projeto'); }
  finally{ const x = $('#pn-btn'); if (x){ x.disabled = false; x.textContent = 'Criar o projeto'; } }
}
async function pjRecarregarFichas(){
  const r = await sb.from('membros').select('registro,grupos');
  (r.data || []).forEach(x => { const m = (state.membros || []).find(y => y.registro === x.registro); if (m) m.grupos = x.grupos; });
  desenharMenu();
}

/* ---------------- editar ---------------- */
function pjModalEditar(id){
  const p = projetosM.lista.find(x => x.id === id); if (!p) return;
  projetosM.novo = { semente: p.logo_semente };
  const eq = pjEquipe(p).map(x => x.m);
  const outros = (state.membros || []).filter(m => ATIVOS_PJ.includes(m.status) && !eq.includes(m));
  abreModal(`<h3>${esc(p.nome)}</h3>
    <div class="form-grid">
      <div class="fld"><label for="pe-nome">Nome</label><input id="pe-nome" value="${esc(p.nome)}"></div>
      <div class="fld"><label for="pe-st">Status</label><select id="pe-st">${Object.entries(STATUS_PROJETO).map(([k, v]) =>
        `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v[0]}</option>`).join('')}</select></div>
      <div class="fld full"><div class="pj-logo-ed"><span id="pe-logo">${logoProjeto(p.logo_semente, 56, p.nome)}</span>
        <span class="tx">O código continua ${esc(p.codigo)}; só a logo muda.</span>
        <button type="button" class="btn ghost mini" onclick="projetosM.novo.semente=pjSemente();$('#pe-logo').innerHTML=logoProjeto(projetosM.novo.semente,56)">${ic('refazer')} Outra</button>
        <button type="button" class="btn ghost mini" onclick="projetosM.novo.semente='${esc(p.codigo.toLowerCase())}';$('#pe-logo').innerHTML=logoProjeto(projetosM.novo.semente,56)">A original</button></div></div>
      <div class="fld full"><label for="pe-desc">Descrição</label><textarea id="pe-desc" rows="3">${esc(p.descricao || '')}</textarea></div>
      <div class="fld full"><label for="pe-sup">Supervisor</label><select id="pe-sup" ${docGestor() ? '' : 'disabled'}>
        <option value="">— sem supervisor —</option>
        <optgroup label="Da equipe">${eq.map(m => `<option value="${m.registro}" ${m.registro === p.supervisor ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</optgroup>
        <optgroup label="De fora — entra na equipe">${outros.map(m => `<option value="${m.registro}">${esc(m.nome)}</option>`).join('')}</optgroup></select>
        ${docGestor() ? '' : '<span class="mailer-sub tight">Trocar o supervisor é do PMO.</span>'}</div>
    </div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="pe-btn" onclick="pjSalvar('${p.id}')">Salvar</button></div>`, 'largo');
}
async function pjSalvar(id){
  const p = projetosM.lista.find(x => x.id === id);
  const d = { id, nome: $('#pe-nome').value.trim(), status: $('#pe-st').value, descricao: $('#pe-desc').value.trim(),
    logo_semente: projetosM.novo.semente };
  if (!$('#pe-sup').disabled){ const s = $('#pe-sup').value ? Number($('#pe-sup').value) : null; if (s !== p.supervisor) d.supervisor = s; }
  if (!d.nome) return toast('O nome é obrigatório.', true);
  const b = $('#pe-btn'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('projeto_salvar', { p: d });
    if (error) throw error;
    if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível salvar'), true);
    fechaModal(); toast('Projeto salvo.');
    await Promise.all([carregarGrupos(), carregarProjetosEArquivos(), pjRecarregarFichas()]);
    pageProjetos(p.codigo);
  }catch(e){ falha(e, 'Erro ao salvar'); }
  finally{ const x = $('#pe-btn'); if (x) x.disabled = false; }
}

/* ---------------- a equipe ----------------
   Pôr e tirar gente é pôr e tirar do grupo do projeto — a mesma função
   da tela de Grupos, que confere se quem pede é responsável. */
function pjModalEquipe(id){
  const p = projetosM.lista.find(x => x.id === id); if (!p) return;
  projetosM.equipe = { id, marcados:new Set(), busca:'' };
  abreModal(`<h3>A equipe de ${esc(p.nome)}</h3>
    <p class="sub" style="margin-bottom:12px">É o grupo ${esc(pjGrupo(p)?.nome || '')}. Quem entra passa a estar também em
      ${esc(gruposAcima(pjGrupo(p)).slice(1).map(x => x.nome).join(' e ') || 'nenhum grupo acima')}.</p>
    <div id="pq-corpo"></div>`, 'largo', true);
  pjEquipeDesenhar();
}
function pjEquipeDesenhar(){
  const e = projetosM.equipe, p = projetosM.lista.find(x => x.id === e.id), g = pjGrupo(p);
  const eq = pjEquipe(p), dentro = new Set(eq.map(x => x.m.registro)), q = norm(e.busca);
  const cands = (state.membros || []).filter(m => ATIVOS_PJ.includes(m.status) && !dentro.has(m.registro)
    && (!q || [m.nome, m.cargo, m.departamento].some(x => norm(x).includes(q)))).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('#pq-corpo').innerHTML = `<div class="adm-grupo" style="margin-top:0">Na equipe · ${eq.length}</div>
    <div class="gr-pessoas" style="max-height:220px">${eq.map(({ m, via }) => `<div class="gr-pessoa">${avatarFoto(m, 28, 10)}
      <div class="tx"><div class="nm">${esc(m.nome)}</div><div class="cg">${esc(m.cargo || '—')}</div></div>
      ${m.registro === p.supervisor ? '<span class="pj-sup">Supervisor</span>' : ''}
      ${via === g.nome ? ibtn('x', 'Tirar ' + esc(m.nome), `pjTirar(${m.registro})`, 'perigo sm')
        : `<span class="gr-via" title="Está na equipe por ${esc(via)}">por ${esc(via)}</span>`}</div>`).join('') || '<p class="muted small">Ninguém ainda.</p>'}</div>
    <div class="adm-grupo">Pôr na equipe</div>
    <input type="search" id="pq-busca" placeholder="Buscar por nome, cargo ou departamento…" value="${esc(e.busca)}"
      oninput="projetosM.equipe.busca=this.value;clearTimeout(window._pqT);window._pqT=setTimeout(()=>{pjEquipeDesenhar();const i=$('#pq-busca');i.focus();i.setSelectionRange(i.value.length,i.value.length)},120)"
      style="width:100%;margin-bottom:8px">
    <div class="gr-cands" style="max-height:220px">${cands.map(m => `<label class="gr-cand">
      <input type="checkbox" ${e.marcados.has(m.registro) ? 'checked' : ''} onchange="pjMarcar(${m.registro}, this.checked)">
      ${avatarFoto(m, 24, 9)}<span class="tx"><span class="nm">${esc(m.nome)}</span><span class="cg">${esc(m.cargo || '—')}</span></span></label>`).join('')
      || '<p class="muted small" style="padding:8px 0">Ninguém com essa busca.</p>'}</div>
    <div class="acts" style="justify-content:space-between"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <button class="btn solid" id="pq-btn" ${e.marcados.size ? '' : 'disabled'} onclick="pjPor()">${ic('plus')} ${e.marcados.size
        ? `Pôr ${e.marcados.size} pessoa${e.marcados.size > 1 ? 's' : ''}` : 'Pôr na equipe'}</button></div>`;
}
function pjMarcar(r, sim){
  const e = projetosM.equipe; sim ? e.marcados.add(r) : e.marcados.delete(r);
  const b = $('#pq-btn'); if (b){ b.disabled = !e.marcados.size;
    b.innerHTML = `${ic('plus')} ${e.marcados.size ? `Pôr ${e.marcados.size} pessoa${e.marcados.size > 1 ? 's' : ''}` : 'Pôr na equipe'}`; }
}
async function pjMexerEquipe(p, corpo, ok){
  const { data, error } = await sb.rpc('grupo_membros_salvar', { p: { grupo_id: p.grupo_id, ...corpo } });
  if (error) return falha(error, 'Erro ao mexer na equipe');
  if (data?.status === 'sem_permissao') return toast('Só o supervisor, o Depto de Pessoal e a administração mexem na equipe.', true);
  if (data?.status !== 'ok') return toast(motivoRPC(data, null, 'Não foi possível'), true);
  await pjRecarregarFichas();
  toast(ok(data));
  pjEquipeDesenhar();
}
async function pjPor(){
  const e = projetosM.equipe, p = projetosM.lista.find(x => x.id === e.id);
  const regs = [...e.marcados]; e.marcados.clear(); e.busca = '';
  await pjMexerEquipe(p, { adicionar: regs }, d => `${d.adicionados} pessoa${d.adicionados === 1 ? '' : 's'} na equipe.`);
}
async function pjTirar(reg){
  const e = projetosM.equipe, p = projetosM.lista.find(x => x.id === e.id);
  const m = (state.membros || []).find(x => x.registro === reg);
  if (reg === p.supervisor && !await confirma(`${esc(m?.nome || '')} é o supervisor. Sem estar na equipe, continua supervisor até o PMO trocar. Tirar mesmo assim?`, 'Tirar')) return;
  await pjMexerEquipe(p, { remover: [reg] }, () => `${m?.nome || 'A pessoa'} saiu da equipe.`);
}

registrarBusca({
  fonte:'projetos', rotulo:'Projetos',
  buscar: (t) => filtrarSimples(projetosM.lista.map(p => ({
    codigo: p.codigo, titulo: p.nome, sub: (STATUS_PROJETO[p.status] || [])[0] || '',
    href: '#/projetos/' + p.codigo })), t, 5)
});
