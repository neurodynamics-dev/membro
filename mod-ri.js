/* ============================================================
   2.19.2: Relações institucionais (RI) — só NRO_RELAC e NRO_COORD_OFFICE.
   Rotas:
     #/ri                 a galeria de entrada: Conexões, Missões, Financiamento
     #/ri/conexoes        o mapa (a rede de contatos)
     #/ri/tabela          a tabela de todos
     #/ri/kanban          o kanban pela qualidade da conexão
     #/ri/<id>            a ficha de uma pessoa ou organização
     #/ri/<id>/editar     editar ,  #/ri/novo  novo contato
     #/ri/missoes         as missões (eventos, visitas e encontros de RI),  #/ri/missoes/<id|novo>
     #/ri/financiamento   os editais e as submissões (mod-ri-financiamento.js)
     #/ri/indicacoes      as indicações que os membros fazem pelos Serviços
   O banco é db/2.19.2_ri.sql: tudo passa pelas funções ri_*.
   Mapa, tabela e kanban são o mesmo dado (ri_dados) visto de jeitos diferentes,
   com os mesmos filtros.
   ============================================================ */

/* a função de cada contato para a NRO: a cor no mapa (tokens do DS, iguais no claro e no escuro) */
const RI_FUNCOES = [
  ['stakeholder', 'Stakeholder', '--fn-idle-primary'], ['parceiro', 'Parceiro', '--neuron-primary'],
  ['investidor', 'Investidor', '--lumen-primary'], ['fomento', 'Fomento e editais', '--ritmo-primary'],
  ['academia', 'Academia', '--retina-primary'], ['governo', 'Governo e reguladores', '--nexo-primary'],
  ['saude', 'Saúde e clínica', '--ion-primary'], ['empresa', 'Empresa', '--dendrito-primary'],
  ['mentor', 'Mentor', '--iris-primary'], ['imprensa', 'Imprensa', '--plexo-primary'],
  ['fornecedor', 'Fornecedor', '--glia-primary'], ['membro', 'Membro da NRO', '--fn-signal-primary'],
  ['ex_membro', 'Ex-membro', '--pia-primary'], ['apoiador', 'Apoiador', '--cortex-medium'],
  ['concorrente', 'Concorrente', '--impulso-primary']];
/* a qualidade da conexão: as colunas do kanban */
const RI_ESTAGIOS = [
  ['identificado', 'Identificado', 'Sabemos quem é; ainda sem contato.'],
  ['primeiro_contato', 'Primeiro contato', 'Já houve uma conversa ou apresentação.'],
  ['conhecendo', 'Conhecendo', 'Trocas em andamento; entendendo a pessoa.'],
  ['interesses_definidos', 'Interesses definidos', 'Sabemos o que cada lado quer.'],
  ['colaborando', 'Colaborando', 'Há algo concreto acontecendo junto.'],
  ['parceria', 'Parceria', 'Relação firme, de confiança e recorrente.'],
  ['pausado', 'Em pausa', 'Esfriou ou não é o momento.']];
const RI_PROX = ['', 'Distante', 'Conhecido', 'Próximo', 'Muito próximo', 'Aliado'];
const RI_INTER = [['reuniao', 'Reunião'], ['email', 'E-mail'], ['ligacao', 'Ligação'], ['mensagem', 'Mensagem'], ['evento', 'Evento'],
  ['visita', 'Visita'], ['apresentacao', 'Apresentação'], ['outro', 'Outro']];
const RI_EV_TIPOS = [['congresso', 'Congresso'], ['feira', 'Feira'], ['rodada', 'Rodada de negócios'], ['pitch', 'Pitch ou demo day'],
  ['reuniao', 'Reunião institucional'], ['visita', 'Visita técnica'], ['workshop', 'Workshop'], ['premiacao', 'Premiação'],
  ['edital', 'Edital ou chamada'], ['outro', 'Outro']];
const RI_EV_STATUS = [['prospectado', 'Prospectado'], ['avaliando', 'Avaliando'], ['confirmado', 'Confirmado'], ['participou', 'Participou'], ['descartado', 'Descartado']];
const RI_CANAIS = [['email', 'E-mail'], ['telefone', 'Telefone'], ['linkedin', 'LinkedIn'], ['site', 'Site'], ['instagram', 'Instagram'], ['outro', 'Outro']];
const RI_TAGS_REL = ['Trabalho', 'Acadêmica', 'Investimento', 'Mentoria', 'Família', 'Amizade', 'Influência', 'Fornecimento', 'Ex-colegas', 'Conflito'];
const RI_OBJETIVOS = ['Conhecer stakeholders', 'Apresentar a NRO', 'Alinhar interesses', 'Captar recursos', 'Buscar parceiros', 'Recrutar', 'Aprender', 'Divulgar'];

const riRot = (lista, k) => (lista.find(x => x[0] === k) || [k, k])[1];
const riCor = f => `var(${(RI_FUNCOES.find(x => x[0] === f) || RI_FUNCOES[0])[2]})`;
const riOpac = p => [0, .3, .48, .66, .84, 1][p || 1];
const riFiltroVazio = () => ({ q:'', funcoes:[], natureza:'', org:'', estagio:'', prox:1, conex:0, tag:'', sinal:'', resp:'', inativos:false });

const RI = { d:null, vista:'mapa', f:riFiltroVazio(), painel:false, pos:null, vistaMapa:null, ligar:false, ordem:['nome', 1], evs:null, inds:null };

async function riCarregar(forcar){
  if (RI.d && !forcar) return RI.d;
  const { data, error } = await sb.rpc('ri_dados');
  if (error || data?.status !== 'ok') throw new Error(data?.status || error?.message || 'erro');
  RI.d = data;
  RI.porId = new Map(data.contatos.map(c => [c.id, c]));
  /* conexões de cada um: as relações e o vínculo pessoa ↔ organização */
  RI.grau = new Map(data.contatos.map(c => [c.id, 0]));
  data.relacoes.forEach(r => { RI.grau.set(r.a, (RI.grau.get(r.a) || 0) + 1); RI.grau.set(r.b, (RI.grau.get(r.b) || 0) + 1); });
  data.contatos.forEach(c => { if (c.organizacao_id && RI.porId.has(c.organizacao_id)){
    RI.grau.set(c.id, RI.grau.get(c.id) + 1); RI.grau.set(c.organizacao_id, (RI.grau.get(c.organizacao_id) || 0) + 1); } });
  return data;
}
const riSemPermissao = () => { $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Sem acesso' })
  + estado.vazio({ texto:'Esta área é só do NRO_RELAC e do NRO_COORD_OFFICE.' }); };
const riErro = e => { $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Relações institucionais' })
  + estado.erro({ texto:'Não foi possível carregar agora (' + (e?.message || 'erro') + ').', acao:'<button class="btn ghost mini" onclick="render(route())">Tentar de novo</button>' }); };

async function pageRI(sub, sub2){
  if (!sub) return riGaleria();
  if (sub === 'financiamento'){
    if (typeof pageRIFin !== 'function'){
      $('#main').innerHTML = estado.carregando();
      try { await carregarModulo('ri-financiamento'); } catch(e){ return riErro(e); }
    }
    return pageRIFin(sub2);
  }
  if (sub === 'missoes') return sub2 ? riMissao(sub2) : riMissoes();
  if (sub === 'indicacoes') return riIndicacoes();
  if (sub === 'novo') return riFormulario(null);
  if (/^\d+$/.test(sub || '')) return sub2 === 'editar' ? riFormulario(+sub) : riFicha(+sub);
  RI.vista = ['tabela', 'kanban'].includes(sub) ? sub : 'mapa';
  return riPainel();
}

/* ---------- a entrada: uma galeria com as três áreas ---------- */
async function riGaleria(){
  const cab = (x = {}) => cabecalho({ espaco:'Relações institucionais', titulo:'Relações institucionais',
    lead:'As conexões da NRO, as missões em que a equipe a representa e o financiamento que buscamos. Informação sensível: só o NRO_RELAC e o NRO_COORD_OFFICE veem.', ...x });
  $('#main').innerHTML = cab() + estado.carregando();
  const { data:r, error } = await sb.rpc('ri_resumo');
  if (error || r?.status !== 'ok') return r?.status === 'sem_permissao' ? riSemPermissao() : riErro(error || { message:r?.status });
  const n = (v, um, varios) => `<b>${v}</b> ${v === 1 ? um : varios}`;
  const area = (href, icone, titulo, texto, linhas, id) => `<a class="ri-area" href="${href}" id="${id}">
    <span class="ri-area-ic">${ic(icone)}</span><h2>${titulo}</h2><p>${texto}</p>
    <span class="ri-area-nums">${linhas.filter(Boolean).map(l => `<span>${l}</span>`).join('')}</span><span class="go">Abrir →</span></a>`;
  $('#main').innerHTML = cab({ acoes:r.indicacoes_abertas ? `<a class="btn ghost" href="#/ri/indicacoes">Indicações <span class="ri-n">${r.indicacoes_abertas}</span></a>` : '' }) + `
    <div class="ri-areas">
      ${area('#/ri/conexoes', 'rede', 'Conexões', 'Pessoas e organizações, as relações entre elas e o histórico de cada conversa. Em mapa, tabela ou kanban.',
        [n(r.contatos, 'contato ativo', 'contatos ativos'), n(r.organizacoes, 'organização', 'organizações'),
         r.passos_atrasados ? `<span class="ri-frio">${n(r.passos_atrasados, 'próximo passo atrasado', 'próximos passos atrasados')}</span>` : null], 'ri-a-conexoes')}
      ${area('#/ri/missoes', 'evento', 'Missões', 'Eventos, visitas e encontros em que a equipe representa a NRO: para conhecer stakeholders, apresentar e alinhar interesses.',
        [n(r.missoes_proximas, 'missão por vir', 'missões por vir'), n(r.missoes_realizadas, 'realizada', 'realizadas')], 'ri-a-missoes')}
      ${area('#/ri/financiamento', 'doc', 'Financiamento', 'Editais de financiamento e o acompanhamento de cada submissão: cronograma, checklist e o arranjo de cada um.',
        [n(r.editais_ativos, 'edital em aberto', 'editais em aberto'),
         r.prazos_30 ? `<span class="ri-frio">${n(r.prazos_30, 'prazo em 30 dias', 'prazos em 30 dias')}</span>` : null,
         n(r.em_execucao, 'aprovado ou em execução', 'aprovados ou em execução')], 'ri-a-financiamento')}
    </div>
    <div class="ri-atalhos">
      <a class="btn ghost mini" href="#/ri/novo">${ic('plus')} Novo contato</a>
      <a class="btn ghost mini" href="#/ri/missoes/novo">${ic('plus')} Nova missão</a>
      <a class="btn ghost mini" href="#/ri/financiamento/importar">${ic('doc')} Importar edital</a>
      <a class="btn ghost mini" href="#/ri/indicacoes">Indicações dos membros</a>
    </div>`;
}

/* ---------- o painel: abas, filtros e a vista ---------- */
async function riPainel(){
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Conexões', voltar:['Relações institucionais', '#/ri'] }) + estado.carregando();
  try { await riCarregar(true); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  const n = RI.d.indicacoes_novas;
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Conexões', voltar:['Relações institucionais', '#/ri'],
      lead:'Pessoas e organizações com que a equipe se relaciona. Informação sensível: registre só o necessário à finalidade institucional.',
      acoes:(n ? `<a class="btn ghost" href="#/ri/indicacoes">Indicações <span class="ri-n">${n}</span></a>` : '')
        + `<a class="btn solid ri-mais" href="#/ri/novo" id="ri-novo" title="Novo contato" aria-label="Novo contato">${ic('plus')}</a>` }) + `
    <div class="ri-barra">
      <nav class="seg" aria-label="Vista">${[['mapa', 'Mapa', '#/ri/conexoes'], ['tabela', 'Tabela', '#/ri/tabela'], ['kanban', 'Kanban', '#/ri/kanban']]
        .map(([k, l, h]) => `<a href="${h}" class="${RI.vista === k ? 'on' : ''}"${RI.vista === k ? ' aria-current="page"' : ''}>${l}</a>`).join('')}</nav>
      <div class="fld busca ri-q"><label for="ri-q" class="sr">Buscar</label><input id="ri-q" type="search" placeholder="Buscar por nome, organização ou tag" autocomplete="off" value="${esc(RI.f.q)}"></div>
      <button type="button" class="btn ghost mini" id="ri-abre-f" aria-expanded="${RI.painel}" aria-controls="ri-filtros">Filtros <span id="ri-nf"></span></button>
      <span class="ri-total" id="ri-total" aria-live="polite"></span>
    </div>
    <div class="ri-filtros" id="ri-filtros"${RI.painel ? '' : ' hidden'}></div>
    <div id="ri-vista"></div>`;
  $('#ri-q').addEventListener('input', e => { RI.f.q = e.target.value; riAplicar(); });
  $('#ri-abre-f').addEventListener('click', () => { RI.painel = !RI.painel; $('#ri-filtros').hidden = !RI.painel; $('#ri-abre-f').setAttribute('aria-expanded', RI.painel); });
  riDesenharFiltros();
  riDesenharVista();
}

function riDesenharFiltros(){
  const f = RI.f, d = RI.d;
  const orgs = d.contatos.filter(c => c.natureza === 'organizacao');
  const tags = [...new Set(d.relacoes.flatMap(r => r.tags))].sort((a, b) => a.localeCompare(b, 'pt'));
  const sel = (id, rot, ops, v) => `<div class="fld"><label for="${id}">${rot}</label><select id="${id}" data-ri-f>${ops.map(([k, l]) =>
    `<option value="${esc(k)}"${String(v) === String(k) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  $('#ri-filtros').innerHTML = `
    <div class="ri-filtros-grade">
      ${sel('ri-f-natureza', 'Natureza', [['', 'Pessoas e organizações'], ['pessoa', 'Só pessoas'], ['organizacao', 'Só organizações']], f.natureza)}
      ${sel('ri-f-org', 'Organização', [['', 'Todas'], ...orgs.map(o => [o.id, o.nome])], f.org)}
      ${sel('ri-f-estagio', 'Estágio', [['', 'Todos'], ...RI_ESTAGIOS.map(([k, l]) => [k, l])], f.estagio)}
      ${sel('ri-f-prox', 'Proximidade mínima', [1, 2, 3, 4, 5].map(n => [n, n + ' (' + RI_PROX[n] + ')']), f.prox)}
      ${sel('ri-f-conex', 'Conexões', [[0, 'Qualquer número'], [1, '1 ou mais'], [2, '2 ou mais'], [3, '3 ou mais'], [5, '5 ou mais']], f.conex)}
      ${sel('ri-f-tag', 'Tipo de relação', [['', 'Qualquer'], ...tags.map(t => [t, t])], f.tag)}
      ${sel('ri-f-sinal', 'Sinal da relação', [['', 'Qualquer'], ['positiva', 'Positiva'], ['neutra', 'Neutra'], ['negativa', 'Negativa']], f.sinal)}
      ${sel('ri-f-resp', 'Responsável', [['', 'Qualquer'], ...d.equipe.map(m => [m.registro, m.nome])], f.resp)}
    </div>
    <fieldset class="ri-funcoes"><legend>Função</legend>${RI_FUNCOES.map(([k, l]) => {
      const n = d.contatos.filter(c => c.funcao === k).length;
      return `<label class="ri-fn${n ? '' : ' zero'}"><input type="checkbox" value="${k}" data-ri-fn${f.funcoes.includes(k) ? ' checked' : ''}>
        <span class="ri-bola" style="background:${riCor(k)}"></span>${esc(l)} <span class="n">${n}</span></label>`; }).join('')}</fieldset>
    <div class="ri-filtros-pe">
      <label class="ri-fn"><input type="checkbox" id="ri-f-inativos"${f.inativos ? ' checked' : ''}> Mostrar inativos</label>
      <button type="button" class="btn ghost mini" id="ri-limpar">Limpar os filtros</button>
    </div>`;
  const ler = () => {
    f.natureza = $('#ri-f-natureza').value; f.org = $('#ri-f-org').value; f.estagio = $('#ri-f-estagio').value;
    f.prox = +$('#ri-f-prox').value; f.conex = +$('#ri-f-conex').value; f.tag = $('#ri-f-tag').value; f.sinal = $('#ri-f-sinal').value;
    f.resp = $('#ri-f-resp').value; f.inativos = $('#ri-f-inativos').checked;
    f.funcoes = [...document.querySelectorAll('[data-ri-fn]:checked')].map(x => x.value);
    riAplicar();
  };
  $('#ri-filtros').addEventListener('change', ler);
  $('#ri-limpar').addEventListener('click', () => { const q = RI.f.q; RI.f = { ...riFiltroVazio(), q }; riDesenharFiltros(); riAplicar(); });
}

/* quem passa nos filtros (o mapa esmaece o resto em vez de esconder: a nuvem continua inteira) */
function riPassa(c){
  const f = RI.f;
  if (!f.inativos && !c.ativo) return false;
  if (f.natureza && c.natureza !== f.natureza) return false;
  if (f.org && String(c.organizacao_id) !== f.org && String(c.id) !== f.org) return false;
  if (f.estagio && c.estagio !== f.estagio) return false;
  if ((c.proximidade || 1) < f.prox) return false;
  if ((RI.grau.get(c.id) || 0) < f.conex) return false;
  if (f.resp && String(c.responsavel) !== f.resp) return false;
  if (f.funcoes.length && !f.funcoes.includes(c.funcao)) return false;
  if (f.tag || f.sinal){
    const ok = RI.d.relacoes.some(r => (r.a === c.id || r.b === c.id) && (!f.tag || r.tags.includes(f.tag)) && (!f.sinal || r.sinal === f.sinal));
    if (!ok) return false;
  }
  if (f.q){
    const q = norm(f.q);
    if (![c.nome, c.organizacao, c.cargo, c.cidade, ...(c.tags || [])].some(x => norm(x).includes(q))) return false;
  }
  return true;
}
const riRelPassa = r => (!RI.f.tag || r.tags.includes(RI.f.tag)) && (!RI.f.sinal || r.sinal === RI.f.sinal);
function riNumFiltros(){
  const f = RI.f;
  return [f.natureza, f.org, f.estagio, f.prox > 1, f.conex, f.tag, f.sinal, f.resp, f.inativos, f.funcoes.length].filter(Boolean).length;
}
function riAplicar(){
  const n = riNumFiltros(); $('#ri-nf').textContent = n ? '(' + n + ')' : '';
  const passam = RI.d.contatos.filter(riPassa).length;
  $('#ri-total').innerHTML = `<b>${passam}</b> de ${RI.d.contatos.length}`;
  if (RI.vista === 'mapa') riMapaFiltrar(); else riDesenharVista();
}
function riDesenharVista(){
  if (RI.vista === 'tabela') riTabela(); else if (RI.vista === 'kanban') riKanban(); else riMapa();
  const n = riNumFiltros(); $('#ri-nf').textContent = n ? '(' + n + ')' : '';
  $('#ri-total').innerHTML = `<b>${RI.d.contatos.filter(riPassa).length}</b> de ${RI.d.contatos.length}`;
}

/* ---------- o mapa: a nuvem de pontos, que se arrasta, amplia e liga ---------- */
function riPosCarregar(){
  if (RI.pos) return;
  try { RI.pos = JSON.parse(localStorage.getItem('ri.pos') || '{}'); } catch(e){ RI.pos = {}; }
}
function riPosGuardar(){ try { localStorage.setItem('ri.pos', JSON.stringify(RI.pos)); } catch(e){} }
/* o arranjo: Fruchterman-Reingold, com os pontos já arranjados presos no lugar */
function riArranjar(todos){
  riPosCarregar();
  const cs = RI.d.contatos, n = cs.length; if (!n) return;
  const lado = Math.max(400, Math.sqrt(n) * 150), k = lado / Math.sqrt(n) * .9;
  const soltos = new Set(cs.filter(c => todos || !RI.pos[c.id]).map(c => c.id));
  cs.forEach(c => {
    if (!soltos.has(c.id)) return;
    const org = c.organizacao_id && RI.pos[c.organizacao_id];
    RI.pos[c.id] = org && !soltos.has(c.organizacao_id) ? { x:org.x + (Math.random() - .5) * 80, y:org.y + (Math.random() - .5) * 80 }
      : { x:(Math.random() - .5) * lado, y:(Math.random() - .5) * lado };
  });
  if (!soltos.size) return;
  const arestas = RI.d.relacoes.map(r => [r.a, r.b, .6 + r.forca / 5])
    .concat(cs.filter(c => c.organizacao_id && RI.porId.has(c.organizacao_id)).map(c => [c.id, c.organizacao_id, 1.4]));
  let t = lado / 8;
  for (let it = 0; it < 260; it++){
    const desl = new Map(cs.map(c => [c.id, { x:0, y:0 }]));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++){
      const a = RI.pos[cs[i].id], b = RI.pos[cs[j].id];
      let dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || .01;
      const f = k * k / d; dx /= d; dy /= d;
      desl.get(cs[i].id).x += dx * f; desl.get(cs[i].id).y += dy * f;
      desl.get(cs[j].id).x -= dx * f; desl.get(cs[j].id).y -= dy * f;
    }
    arestas.forEach(([u, v, w]) => {
      const a = RI.pos[u], b = RI.pos[v]; if (!a || !b) return;
      let dx = a.x - b.x, dy = a.y - b.y; const d = Math.hypot(dx, dy) || .01, f = d * d / k * w;
      dx /= d; dy /= d;
      desl.get(u).x -= dx * f; desl.get(u).y -= dy * f; desl.get(v).x += dx * f; desl.get(v).y += dy * f;
    });
    cs.forEach(c => {
      if (!soltos.has(c.id)) return;
      const p = RI.pos[c.id], dd = desl.get(c.id);
      dd.x -= p.x * .02 * k / 10; dd.y -= p.y * .02 * k / 10;      // um pouco de gravidade: a nuvem não se espalha
      const m = Math.hypot(dd.x, dd.y) || .01;
      p.x += dd.x / m * Math.min(m, t); p.y += dd.y / m * Math.min(m, t);
    });
    t *= .975;
  }
  cs.forEach(c => { const p = RI.pos[c.id]; p.x = Math.round(p.x); p.y = Math.round(p.y); });
  riPosGuardar();
}
const riRaio = c => (c.natureza === 'organizacao' ? 13 : 8) + Math.min(14, Math.sqrt(RI.grau.get(c.id) || 0) * 3);

function riMapa(){
  riArranjar(false);
  $('#ri-vista').innerHTML = `
    <div class="ri-tela" id="ri-tela" tabindex="0" aria-label="Mapa de contatos. Arraste o fundo para mover, use a roda para ampliar.">
      <svg class="ri-svg" id="ri-svg"><g id="ri-mundo"><g class="ri-arestas" id="ri-arestas"></g><line id="ri-fio" class="ri-fio" hidden></line><g class="ri-nos" id="ri-nos"></g></g></svg>
      <div class="okr-ferr ri-ferr-topo" role="group" aria-label="Ferramentas do mapa">
        <button type="button" class="btn ghost mini" id="ri-ligar" aria-pressed="${RI.ligar}" title="Arraste de um ponto a outro para criar a relação (ou segure Shift)">${ic('plus')} Ligar pontos</button>
        <button type="button" class="btn ghost mini" id="ri-rearranjar" title="Distribuir de novo todos os pontos">Reorganizar</button>
      </div>
      <div class="okr-ferr okr-ferr-zoom" role="group" aria-label="Zoom">
        ${ibtn('menos_zoom', 'Menos zoom', 'riZoom(1/1.2)', 'sm')}
        <button class="okr-pct" id="ri-pct" title="Tamanho real" onclick="riZoom(null)">100%</button>
        ${ibtn('mais_zoom', 'Mais zoom', 'riZoom(1.2)', 'sm')}
        ${ibtn('enquadrar', 'Enquadrar tudo', 'riEnquadrar(true)', 'sm')}
      </div>
      <div class="ri-legenda" aria-hidden="true">
        <span><svg width="12" height="12"><circle cx="6" cy="6" r="5"/></svg> pessoa</span>
        <span><svg width="12" height="12"><rect x="1" y="1" width="10" height="10" rx="2.5"/></svg> organização</span>
        <span><i class="l pos"></i> positiva</span><span><i class="l neg"></i> negativa</span>
        <span class="dim">opacidade = proximidade, tamanho = conexões</span>
      </div>
      <div class="ri-pop" id="ri-pop" hidden></div>
      ${RI.d.contatos.length ? '' : '<div class="ri-tela-vazia">Nenhum contato ainda. Comece pelo <b>+</b>, ou aceite uma indicação.</div>'}
    </div>`;
  riDesenharMapa();
  if (RI.vistaMapa) riAplicarVista(); else riEnquadrar(false);
  riLigarMapa();
  $('#ri-ligar').addEventListener('click', e => { RI.ligar = !RI.ligar; e.currentTarget.setAttribute('aria-pressed', RI.ligar); $('#ri-tela').classList.toggle('ligando', RI.ligar); });
  $('#ri-rearranjar').addEventListener('click', () => { riArranjar(true); riDesenharMapa(); riEnquadrar(true); });
}
function riDesenharMapa(){
  const P = RI.pos, d = RI.d;
  const orgLinks = d.contatos.filter(c => c.organizacao_id && P[c.organizacao_id]).map(c => {
    const a = P[c.id], b = P[c.organizacao_id];
    return `<line class="ri-a-org" data-de="${c.id}" data-para="${c.organizacao_id}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`; }).join('');
  const rels = d.relacoes.map(r => {
    const a = P[r.a], b = P[r.b]; if (!a || !b) return '';
    const nome = x => RI.porId.get(x)?.nome || '';
    return `<g class="ri-a ${r.sinal}" data-rel="${r.id}" data-de="${r.a}" data-para="${r.b}" tabindex="0" role="button"
        aria-label="Relação ${r.sinal} entre ${esc(nome(r.a))} e ${esc(nome(r.b))}${r.tags.length ? ': ' + esc(r.tags.join(', ')) : ''}">
      <line class="toque" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>
      <line class="traco" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" style="stroke-width:${.8 + r.forca * .55}"/></g>`; }).join('');
  $('#ri-arestas').innerHTML = orgLinks + rels;
  $('#ri-nos').innerHTML = d.contatos.map(c => {
    const p = P[c.id], r = riRaio(c), cor = riCor(c.funcao), op = riOpac(c.proximidade);
    const forma = c.natureza === 'organizacao'
      ? `<rect x="${-r}" y="${-r}" width="${2 * r}" height="${2 * r}" rx="${r * .3}" style="fill:${cor};fill-opacity:${op};stroke:${cor}"/>`
      : `<circle r="${r}" style="fill:${cor};fill-opacity:${op};stroke:${cor}"/>`;
    return `<g class="ri-no${c.ativo ? '' : ' inativo'}" data-id="${c.id}" transform="translate(${p.x},${p.y})" tabindex="0" role="button"
        aria-label="${esc(c.nome)}, ${esc(riRot(RI_FUNCOES, c.funcao))}, proximidade ${c.proximidade}">${forma}
      <text y="${r}" dy="1.15em">${esc(c.nome.length > 26 ? c.nome.slice(0, 25) + '…' : c.nome)}</text></g>`; }).join('');
  riMapaFiltrar();
}
function riMapaFiltrar(){
  const svg = $('#ri-svg'); if (!svg) return;
  const passa = new Set(RI.d.contatos.filter(riPassa).map(c => c.id)), filtrando = riNumFiltros() || RI.f.q;
  svg.querySelectorAll('.ri-no').forEach(g => g.classList.toggle('fora', !passa.has(+g.dataset.id)));
  svg.querySelectorAll('.ri-a').forEach(g => {
    const r = RI.d.relacoes.find(x => x.id === +g.dataset.rel);
    g.classList.toggle('fora', !(passa.has(+g.dataset.de) && passa.has(+g.dataset.para) && (!filtrando || riRelPassa(r))));
  });
  svg.querySelectorAll('.ri-a-org').forEach(l => l.classList.toggle('fora', !(passa.has(+l.dataset.de) && passa.has(+l.dataset.para))));
}

function riAplicarVista(){
  const v = RI.vistaMapa, m = $('#ri-mundo'); if (!m || !v) return;
  m.setAttribute('transform', `translate(${v.x},${v.y}) scale(${v.k})`);
  m.style.setProperty('--k', v.k);      // os nomes mantêm o tamanho na tela, com qualquer zoom
  const pc = $('#ri-pct'); if (pc) pc.textContent = Math.round(v.k * 100) + '%';
  $('#ri-tela')?.classList.toggle('longe', v.k < .55);      // longe, os nomes somem (menos os em foco)
}
function riZoom(f, cx, cy){
  const t = $('#ri-tela'); if (!t || !RI.vistaMapa) return;
  const r = t.getBoundingClientRect(), v = RI.vistaMapa;
  const k = f == null ? 1 : Math.min(3, Math.max(.12, v.k * f));
  const px = cx ?? r.width / 2, py = cy ?? r.height / 2;
  v.x = px - (px - v.x) * (k / v.k); v.y = py - (py - v.y) * (k / v.k); v.k = k;
  riAplicarVista();
}
function riEnquadrar(){
  const t = $('#ri-tela'); if (!t) return;
  const r = t.getBoundingClientRect(), ps = RI.d.contatos.map(c => RI.pos[c.id]).filter(Boolean);
  if (!ps.length){ RI.vistaMapa = { x:r.width / 2, y:r.height / 2, k:1 }; return riAplicarVista(); }
  const minX = Math.min(...ps.map(p => p.x)) - 40, maxX = Math.max(...ps.map(p => p.x)) + 40;
  const minY = Math.min(...ps.map(p => p.y)) - 40, maxY = Math.max(...ps.map(p => p.y)) + 50;
  const k = Math.min(1.4, Math.max(.12, Math.min((r.width - 40) / (maxX - minX), (r.height - 110) / (maxY - minY))));
  RI.vistaMapa = { k, x:r.width / 2 - (minX + maxX) / 2 * k, y:(r.height + 30) / 2 - (minY + maxY) / 2 * k };
  riAplicarVista();
}
const riMundoXY = (t, e) => { const r = t.getBoundingClientRect(), v = RI.vistaMapa; return { x:(e.clientX - r.left - v.x) / v.k, y:(e.clientY - r.top - v.y) / v.k }; };
function riLigarMapa(){
  const t = $('#ri-tela'); if (!t) return;
  const toques = new Map(); let acao = null, pinca = null;
  t.addEventListener('pointerdown', e => {
    if (e.target.closest('button, input, a, select, .okr-ferr, .ri-pop')) return;
    t.setPointerCapture(e.pointerId);
    toques.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (toques.size === 2){ const [a, b] = [...toques.values()]; pinca = { d:Math.hypot(a.x - b.x, a.y - b.y), k:RI.vistaMapa.k }; acao = null; return; }
    const no = e.target.closest('.ri-no'), ar = e.target.closest('.ri-a');
    if (no){
      const id = +no.dataset.id;
      acao = (RI.ligar || e.shiftKey) ? { tipo:'ligar', id } : { tipo:'mover', id, x0:e.clientX, y0:e.clientY, el:no, moveu:false };
      if (acao.tipo === 'ligar'){ const p = RI.pos[id], fio = $('#ri-fio'); fio.hidden = false;
        ['x1', 'x2'].forEach(a => fio.setAttribute(a, p.x)); ['y1', 'y2'].forEach(a => fio.setAttribute(a, p.y)); }
    } else if (ar) acao = { tipo:'aresta', id:+ar.dataset.rel, x0:e.clientX, y0:e.clientY };
    else { acao = { tipo:'pan', x:e.clientX, y:e.clientY, vx:RI.vistaMapa.x, vy:RI.vistaMapa.y, x0:e.clientX, y0:e.clientY }; t.classList.add('arrastando'); }
  });
  t.addEventListener('pointermove', e => {
    if (!toques.has(e.pointerId)) return;
    toques.set(e.pointerId, { x:e.clientX, y:e.clientY });
    if (pinca && toques.size === 2){
      const [a, b] = [...toques.values()], r = t.getBoundingClientRect();
      return riZoom((pinca.k * Math.hypot(a.x - b.x, a.y - b.y) / pinca.d) / RI.vistaMapa.k, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
    }
    if (!acao) return;
    if (acao.tipo === 'pan'){ RI.vistaMapa.x = acao.vx + e.clientX - acao.x; RI.vistaMapa.y = acao.vy + e.clientY - acao.y; riAplicarVista(); }
    else if (acao.tipo === 'ligar'){ const p = riMundoXY(t, e), fio = $('#ri-fio'); fio.setAttribute('x2', p.x); fio.setAttribute('y2', p.y); }
    else if (acao.tipo === 'mover'){
      if (!acao.moveu && Math.hypot(e.clientX - acao.x0, e.clientY - acao.y0) < 5) return;
      acao.moveu = true; riFecharPop();
      const p = riMundoXY(t, e); RI.pos[acao.id] = { x:Math.round(p.x), y:Math.round(p.y) };
      acao.el.setAttribute('transform', `translate(${RI.pos[acao.id].x},${RI.pos[acao.id].y})`);
      riMoverArestas(acao.id);
    }
  });
  const soltar = e => {
    toques.delete(e.pointerId); if (toques.size < 2) pinca = null;
    if (toques.size) return;
    t.classList.remove('arrastando');
    const a = acao; acao = null; if (!a) return;
    if (a.tipo === 'ligar'){
      $('#ri-fio').hidden = true;
      const alvo = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ri-no');
      if (alvo && +alvo.dataset.id !== a.id) riRelacaoModal(a.id, +alvo.dataset.id);
    } else if (a.tipo === 'mover'){ if (a.moveu) riPosGuardar(); else riAbrirPop(a.id); }
    else if (a.tipo === 'aresta'){ if (Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) riRelacaoModal(null, null, a.id); }
    else if (a.tipo === 'pan' && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) riFecharPop();
  };
  t.addEventListener('pointerup', soltar); t.addEventListener('pointercancel', soltar);
  t.addEventListener('wheel', e => {
    if (e.target.closest('.okr-ferr, .ri-pop')) return;
    e.preventDefault(); riFecharPop();
    const r = t.getBoundingClientRect(), passo = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 400 : 1;
    const dx = e.deltaX * passo, dy = e.deltaY * passo;
    if (e.shiftKey || (!e.ctrlKey && !e.metaKey && Math.abs(dx) > Math.abs(dy))){ RI.vistaMapa.x -= dx || dy; RI.vistaMapa.y -= dx ? dy : 0; return riAplicarVista(); }
    const pin = (e.ctrlKey || e.metaKey) && Math.abs(dy) < 40;
    riZoom(Math.exp(-Math.max(-240, Math.min(240, dy)) * (pin ? .012 : .0022)), e.clientX - r.left, e.clientY - r.top);
  }, { passive:false });
  t.addEventListener('keydown', e => {
    const no = e.target.closest?.('.ri-no'), ar = e.target.closest?.('.ri-a');
    if ((e.key === 'Enter' || e.key === ' ') && no){ e.preventDefault(); return riAbrirPop(+no.dataset.id); }
    if ((e.key === 'Enter' || e.key === ' ') && ar){ e.preventDefault(); return riRelacaoModal(null, null, +ar.dataset.rel); }
    if (e.key === 'Escape') return riFecharPop();
    if (e.target.closest('input, select')) return;
    if (e.key === '+' || e.key === '='){ e.preventDefault(); riZoom(1.2); }
    else if (e.key === '-'){ e.preventDefault(); riZoom(1 / 1.2); }
    else if (e.key === '0'){ e.preventDefault(); riEnquadrar(); }
  });
}
function riMoverArestas(id){
  const p = RI.pos[id];
  document.querySelectorAll(`#ri-arestas [data-de="${id}"], #ri-arestas [data-para="${id}"]`).forEach(g => {
    const ponta = +g.dataset.de === id ? '1' : '2';
    (g.tagName === 'line' ? [g] : g.querySelectorAll('line')).forEach(l => { l.setAttribute('x' + ponta, p.x); l.setAttribute('y' + ponta, p.y); });
  });
}
/* o pop-up de um ponto: o básico, e o caminho para a ficha */
function riAbrirPop(id){
  const c = RI.porId.get(id), pop = $('#ri-pop'), t = $('#ri-tela'); if (!c || !pop) return;
  const v = RI.vistaMapa, p = RI.pos[id], r = t.getBoundingClientRect();
  const dias = c.ultima_interacao ? Math.round((Date.now() - new Date(c.ultima_interacao + 'T12:00:00')) / 864e5) : null;
  pop.innerHTML = `
    <div class="ri-pop-cab"><span class="ri-bola" style="background:${riCor(c.funcao)}"></span>
      <div><b>${esc(c.nome)}</b><span>${esc([c.cargo, c.organizacao].filter(Boolean).join(', ') || (c.natureza === 'organizacao' ? 'Organização' : 'Pessoa'))}</span></div>
      <button type="button" class="ri-pop-x" aria-label="Fechar" onclick="riFecharPop()">×</button></div>
    ${c.resumo ? `<p>${esc(c.resumo)}</p>` : ''}
    <dl class="ri-pop-dl">
      <div><dt>Função</dt><dd>${esc(riRot(RI_FUNCOES, c.funcao))}</dd></div>
      <div><dt>Estágio</dt><dd>${esc(riRot(RI_ESTAGIOS, c.estagio))}</dd></div>
      <div><dt>Proximidade</dt><dd>${riPontos(c.proximidade)} ${RI_PROX[c.proximidade]}</dd></div>
      <div><dt>Conexões</dt><dd>${RI.grau.get(id) || 0}</dd></div>
      <div><dt>Última interação</dt><dd>${c.ultima_interacao ? fmtD(c.ultima_interacao) + (dias != null ? ` <span class="${dias > 60 ? 'ri-frio' : 'dim'}">(${dias} d)</span>` : '') : '—'}</dd></div>
      ${c.proximo_passo ? `<div><dt>Próximo passo</dt><dd>${esc(c.proximo_passo)}${c.proximo_em ? ', ' + fmtD(c.proximo_em) : ''}</dd></div>` : ''}
    </dl>
    ${(c.tags || []).length ? `<div class="ri-tags">${c.tags.map(x => `<span class="ri-tag">${esc(x)}</span>`).join('')}</div>` : ''}
    <div class="ri-pop-acoes"><a class="btn solid mini" href="#/ri/${id}">Abrir a ficha</a>
      <button type="button" class="btn ghost mini" onclick="riInteracaoModal([${id}])">Registrar interação</button></div>`;
  pop.hidden = false;
  const sx = v.x + p.x * v.k, sy = v.y + p.y * v.k, w = Math.min(320, r.width - 24);
  pop.style.width = w + 'px';
  pop.style.left = Math.max(12, Math.min(r.width - w - 12, sx + 18)) + 'px';
  pop.style.top = Math.max(60, Math.min(r.height - pop.offsetHeight - 12, sy - 30)) + 'px';
  $('#ri-svg').querySelectorAll('.ri-no.sel').forEach(g => g.classList.remove('sel'));
  $(`#ri-nos [data-id="${id}"]`)?.classList.add('sel');
}
function riFecharPop(){ const p = $('#ri-pop'); if (p) p.hidden = true; $('#ri-svg')?.querySelectorAll('.ri-no.sel').forEach(g => g.classList.remove('sel')); }
const riPontos = n => `<span class="ri-pontos" aria-hidden="true">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= (n || 0) ? 'on' : ''}"></i>`).join('')}</span>`;

/* a relação: tags, sinal, força e nota (criar arrastando, ou clicar numa linha para editar) */
function riRelacaoModal(a, b, relId){
  const r = relId ? RI.d.relacoes.find(x => x.id === relId) : RI.d.relacoes.find(x => (x.a === Math.min(a, b) && x.b === Math.max(a, b)));
  if (r){ a = r.a; b = r.b; }
  const A = RI.porId.get(a), B = RI.porId.get(b); if (!A || !B) return;
  const tags = new Set(r?.tags || []);
  const sugest = [...new Set([...RI_TAGS_REL, ...RI.d.relacoes.flatMap(x => x.tags)])];
  abreModal(`
    <h3>${r ? 'Relação' : 'Nova relação'}</h3>
    <p class="small muted" style="margin:-4px 0 14px"><b>${esc(A.nome)}</b> ↔ <b>${esc(B.nome)}</b></p>
    <div class="fld"><label>Sinal</label><div class="seg" role="radiogroup" id="ri-rel-sinal">${[['positiva', 'Positiva'], ['neutra', 'Neutra'], ['negativa', 'Negativa']]
      .map(([k, l]) => `<button type="button" role="radio" data-v="${k}" class="${(r?.sinal || 'positiva') === k ? 'on' : ''}" aria-checked="${(r?.sinal || 'positiva') === k}">${l}</button>`).join('')}</div></div>
    <div class="fld"><label for="ri-rel-forca">Força da relação</label><select id="ri-rel-forca">${[1, 2, 3, 4, 5].map(n =>
      `<option value="${n}"${(r?.forca || 3) === n ? ' selected' : ''}>${n} (${['', 'Fraca', 'Ocasional', 'Regular', 'Forte', 'Muito forte'][n]})</option>`).join('')}</select></div>
    <div class="fld"><label for="ri-rel-tag">O que compõe a relação</label>
      <div class="ri-chips" id="ri-rel-tags"></div>
      <input id="ri-rel-tag" list="ri-rel-sug" placeholder="Digite e tecle Enter (ex.: Trabalho, Família)" autocomplete="off">
      <datalist id="ri-rel-sug">${sugest.map(t => `<option value="${esc(t)}">`).join('')}</datalist>
      <div class="ri-sug">${RI_TAGS_REL.map(t => `<button type="button" class="ri-tag" data-t="${esc(t)}">${esc(t)}</button>`).join('')}</div></div>
    <div class="fld"><label for="ri-rel-nota">Nota <span class="opc">(opcional)</span></label><textarea id="ri-rel-nota" rows="2" maxlength="1000">${esc(r?.nota || '')}</textarea></div>
    <p class="aviso-box err" id="ri-rel-erro" hidden></p>
    <div class="acts" style="justify-content:space-between">
      ${r ? `<button type="button" class="btn ghost" id="ri-rel-apagar">${ic('trash')} Apagar</button>` : '<span></span>'}
      <span style="display:flex;gap:8px"><button type="button" class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button type="button" class="btn solid" id="ri-rel-salvar">Salvar</button></span></div>`);
  const pintar = () => { $('#ri-rel-tags').innerHTML = [...tags].map(t => `<span class="ri-chip">${esc(t)}<button type="button" aria-label="Tirar ${esc(t)}" data-x="${esc(t)}">×</button></span>`).join(''); };
  pintar();
  const add = v => { v = String(v || '').trim().replace(/\s+/g, ' '); if (v && tags.size < 12) tags.add(v.slice(0, 40)); pintar(); };
  $('#ri-rel-tag').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ','){ e.preventDefault(); add(e.target.value); e.target.value = ''; } });
  $('#ri-rel-tag').addEventListener('change', e => { if (sugest.includes(e.target.value)){ add(e.target.value); e.target.value = ''; } });
  $('#modal').querySelector('.ri-sug').addEventListener('click', e => { const b2 = e.target.closest('[data-t]'); if (b2) add(b2.dataset.t); });
  $('#ri-rel-tags').addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x){ tags.delete(x.dataset.x); pintar(); } });
  $('#ri-rel-sinal').addEventListener('click', e => { const b2 = e.target.closest('[data-v]'); if (!b2) return;
    $('#ri-rel-sinal').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b2); x.setAttribute('aria-checked', x === b2); }); });
  $('#ri-rel-salvar').addEventListener('click', async () => {
    add($('#ri-rel-tag').value);
    const p = { a, b, tags:[...tags], sinal:$('#ri-rel-sinal .on').dataset.v, forca:+$('#ri-rel-forca').value, nota:$('#ri-rel-nota').value };
    const { data, error } = await sb.rpc('ri_relacao_salvar', { p });
    if (error || data?.status !== 'ok'){ $('#ri-rel-erro').textContent = 'Não foi possível salvar (' + (data?.status || error?.message) + ').'; $('#ri-rel-erro').hidden = false; return; }
    fechaModal(); toast(r ? 'Relação atualizada.' : 'Relação criada.'); riDepoisDeMudar();
  });
  $('#ri-rel-apagar')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta relação?')) return;
    const { data } = await sb.rpc('ri_relacao_excluir', { p_id:r.id });
    if (data?.status === 'ok'){ fechaModal(); toast('Relação apagada.'); riDepoisDeMudar(); }
  });
}
/* depois de uma mudança: recarrega e redesenha onde se estava (o mapa não perde a vista) */
async function riDepoisDeMudar(){
  await riCarregar(true);
  if (/^#\/ri\/\d+$/.test(location.hash)) return riFicha(+location.hash.split('/')[2]);
  if ($('#ri-vista')){ riDesenharFiltros(); riDesenharVista(); }
}

/* a interação: reunião, e-mail, ligação... com quem, quando, o que se falou e o próximo passo */
function riInteracaoModal(ids, inter){
  riFecharPop();
  const opcoes = RI.d.contatos.slice().sort((x, y) => x.nome.localeCompare(y.nome, 'pt'));
  const sel = new Set(inter?.contatos || ids || []);
  abreModal(`
    <h3>${inter ? 'Editar interação' : 'Registrar interação'}</h3>
    <div class="ri-dupla">
      <div class="fld"><label for="ri-i-data">Data</label><input type="date" id="ri-i-data" value="${inter?.data || hojeISO()}"></div>
      <div class="fld"><label for="ri-i-tipo">Tipo</label><select id="ri-i-tipo">${RI_INTER.map(([k, l]) => `<option value="${k}"${(inter?.tipo || 'reuniao') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    </div>
    <div class="fld"><label for="ri-i-quem">Com quem</label>
      <div class="ri-chips" id="ri-i-chips"></div>
      <input id="ri-i-quem" list="ri-i-ops" placeholder="Acrescentar outra pessoa ou organização" autocomplete="off">
      <datalist id="ri-i-ops">${opcoes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></div>
    <div class="fld"><label for="ri-i-resumo">O que aconteceu</label><textarea id="ri-i-resumo" rows="4" maxlength="4000" placeholder="O que se falou, o que se combinou.">${esc(inter?.resumo || '')}</textarea></div>
    ${inter ? '' : `<div class="ri-dupla">
      <div class="fld"><label for="ri-i-passo">Próximo passo <span class="opc">(opcional)</span></label><input id="ri-i-passo" maxlength="300" placeholder="Ex.: mandar a proposta"></div>
      <div class="fld"><label for="ri-i-em">Até</label><input type="date" id="ri-i-em"></div></div>`}
    <p class="aviso-box err" id="ri-i-erro" hidden></p>
    <div class="acts" style="justify-content:space-between">
      ${inter ? `<button type="button" class="btn ghost" id="ri-i-apagar">${ic('trash')} Apagar</button>` : '<span></span>'}
      <span style="display:flex;gap:8px"><button type="button" class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button type="button" class="btn solid" id="ri-i-salvar">Salvar</button></span></div>`, false, true);
  const pintar = () => { $('#ri-i-chips').innerHTML = [...sel].map(id => `<span class="ri-chip">${esc(RI.porId.get(id)?.nome || '?')}<button type="button" aria-label="Tirar" data-x="${id}">×</button></span>`).join(''); };
  pintar();
  $('#ri-i-quem').addEventListener('change', e => { const c = opcoes.find(x => x.nome === e.target.value); if (c){ sel.add(c.id); pintar(); e.target.value = ''; } });
  $('#ri-i-chips').addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x){ sel.delete(+x.dataset.x); pintar(); } });
  $('#ri-i-salvar').addEventListener('click', async () => {
    const p = { id:inter?.id || null, data:$('#ri-i-data').value, tipo:$('#ri-i-tipo').value, resumo:$('#ri-i-resumo').value, contatos:[...sel] };
    if (!inter && $('#ri-i-passo').value.trim()){ p.proximo_passo = $('#ri-i-passo').value; p.proximo_em = $('#ri-i-em').value || null; }
    const erro = t => { $('#ri-i-erro').textContent = t; $('#ri-i-erro').hidden = false; };
    if (!p.contatos.length) return erro('Escolha ao menos uma pessoa ou organização.');
    if (!p.resumo.trim()) return erro('Conte o que aconteceu.');
    const { data, error } = await sb.rpc('ri_interacao_salvar', { p });
    if (error || data?.status !== 'ok') return erro('Não foi possível salvar (' + (data?.status || error?.message) + ').');
    fechaModal(); toast('Interação registrada.'); riDepoisDeMudar();
  });
  $('#ri-i-apagar')?.addEventListener('click', async () => {
    if (!confirm('Apagar esta interação do histórico?')) return;
    const { data } = await sb.rpc('ri_interacao_excluir', { p_id:inter.id });
    if (data?.status === 'ok'){ fechaModal(); toast('Interação apagada.'); riDepoisDeMudar(); }
  });
}

/* ---------- a tabela ---------- */
function riTabela(){
  const [col, dir] = RI.ordem;
  const val = (c, k) => k === 'conex' ? (RI.grau.get(c.id) || 0) : k === 'funcao' ? riRot(RI_FUNCOES, c.funcao)
    : k === 'estagio' ? RI_ESTAGIOS.findIndex(x => x[0] === c.estagio) : k === 'mapa' ? (c.influencia || 0) * 10 + (c.interesse || 0) : (c[k] ?? '');
  const l = RI.d.contatos.filter(riPassa).sort((a, b) => {
    const x = val(a, col), y = val(b, col);
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt')) * dir;
  });
  const th = (k, rot) => `<th aria-sort="${col === k ? (dir > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" data-ord="${k}">${rot}${col === k ? (dir > 0 ? ' ↑' : ' ↓') : ''}</button></th>`;
  $('#ri-vista').innerHTML = l.length ? `<div class="ri-tab-rola"><table class="tabela trabalho ri-tab">
    <thead><tr>${th('nome', 'Nome')}${th('organizacao', 'Organização')}${th('funcao', 'Função')}${th('proximidade', 'Proximidade')}${th('estagio', 'Estágio')}
      ${th('mapa', 'Influência × interesse')}${th('conex', 'Conexões')}${th('ultima_interacao', 'Última interação')}${th('proximo_em', 'Próximo passo')}${th('responsavel_nome', 'Responsável')}</tr></thead>
    <tbody>${l.map(c => `<tr>
      <td><a href="#/ri/${c.id}" class="ri-nome"><span class="ri-bola${c.natureza === 'organizacao' ? ' q' : ''}" style="background:${riCor(c.funcao)};opacity:${riOpac(c.proximidade)}"></span>${esc(c.nome)}</a>${c.ativo ? '' : ' <span class="dim">(inativo)</span>'}</td>
      <td>${esc(c.natureza === 'organizacao' ? (c.cargo || 'Organização') : (c.organizacao || '—'))}</td>
      <td>${esc(riRot(RI_FUNCOES, c.funcao))}</td><td>${riPontos(c.proximidade)}</td><td>${esc(riRot(RI_ESTAGIOS, c.estagio))}</td>
      <td class="num">${c.influencia || '—'} × ${c.interesse || '—'}</td><td class="num">${RI.grau.get(c.id) || 0}</td>
      <td>${c.ultima_interacao ? fmtD(c.ultima_interacao) : '—'}</td>
      <td title="${esc(c.proximo_passo || '')}">${c.proximo_passo ? esc(c.proximo_passo.slice(0, 40)) + (c.proximo_em ? ', ' + fmtD(c.proximo_em) : '') : '—'}</td>
      <td>${esc(c.responsavel_nome || '—')}</td></tr>`).join('')}</tbody></table></div>`
    : estado.vazio({ texto:RI.d.contatos.length ? 'Ninguém passa nesses filtros.' : 'Nenhum contato ainda.' });
  $('#ri-vista').querySelectorAll('[data-ord]').forEach(b => b.addEventListener('click', () => {
    RI.ordem = [b.dataset.ord, RI.ordem[0] === b.dataset.ord ? -RI.ordem[1] : 1]; riTabela(); }));
}

/* ---------- o kanban: cada cartão é uma pessoa ou organização, na coluna da qualidade da conexão ---------- */
function riKanban(){
  const l = RI.d.contatos.filter(riPassa);
  $('#ri-vista').innerHTML = `<div class="ri-kanban">${RI_ESTAGIOS.map(([k, rot, desc]) => {
    const cs = l.filter(c => c.estagio === k);
    return `<section class="ri-col" data-estagio="${k}" aria-label="${esc(rot)}">
      <header><h3>${esc(rot)} <span class="n">${cs.length}</span></h3><p>${esc(desc)}</p></header>
      <div class="ri-col-corpo">${cs.map(c => {
        const dias = c.ultima_interacao ? Math.round((Date.now() - new Date(c.ultima_interacao + 'T12:00:00')) / 864e5) : null;
        return `<article class="ri-card" draggable="true" data-id="${c.id}">
          <a href="#/ri/${c.id}" class="ri-nome"><span class="ri-bola${c.natureza === 'organizacao' ? ' q' : ''}" style="background:${riCor(c.funcao)};opacity:${riOpac(c.proximidade)}"></span>${esc(c.nome)}</a>
          <span class="sub">${esc([riRot(RI_FUNCOES, c.funcao), c.natureza === 'organizacao' ? null : c.organizacao].filter(Boolean).join(', '))}</span>
          <span class="sub">${riPontos(c.proximidade)} ${dias == null ? 'sem interação' : `<span class="${dias > 60 ? 'ri-frio' : ''}">há ${dias} d</span>`}</span>
          <label class="sr" for="ri-mv-${c.id}">Estágio de ${esc(c.nome)}</label>
          <select class="ri-mv" id="ri-mv-${c.id}" data-id="${c.id}">${RI_ESTAGIOS.map(([k2, r2]) => `<option value="${k2}"${k2 === k ? ' selected' : ''}>${r2}</option>`).join('')}</select>
        </article>`; }).join('') || '<p class="ri-col-vazia">Nenhum.</p>'}</div></section>`; }).join('')}</div>`;
  const mover = async (id, estagio) => {
    const c = RI.porId.get(id); if (!c || c.estagio === estagio) return;
    const antes = c.estagio; c.estagio = estagio; riKanban();
    const { data, error } = await sb.rpc('ri_contato_estagio', { p_id:id, p_estagio:estagio });
    if (error || data?.status !== 'ok'){ c.estagio = antes; riKanban(); toast('Não foi possível mover agora.'); }
    else toast(`${c.nome}: ${riRot(RI_ESTAGIOS, estagio)}.`);
  };
  const v = $('#ri-vista');
  v.querySelectorAll('.ri-mv').forEach(s => s.addEventListener('change', () => mover(+s.dataset.id, s.value)));
  v.querySelectorAll('.ri-card').forEach(card => card.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', card.dataset.id); card.classList.add('arrastando'); }));
  v.querySelectorAll('.ri-card').forEach(card => card.addEventListener('dragend', () => card.classList.remove('arrastando')));
  v.querySelectorAll('.ri-col').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('sobre'); });
    col.addEventListener('dragleave', () => col.classList.remove('sobre'));
    col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('sobre'); mover(+e.dataTransfer.getData('text/plain'), col.dataset.estagio); });
  });
}

/* ---------- a ficha de uma pessoa ou organização ---------- */
async function riFicha(id){
  const cab = t => cabecalho({ espaco:'Relações institucionais', titulo:t, voltar:['Conexões', '#/ri/conexoes'] });
  $('#main').innerHTML = cab('Contato') + estado.carregando();
  try { await riCarregar(); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  const { data, error } = await sb.rpc('ri_contato_ler', { p_id:id });
  if (error || data?.status !== 'ok'){ $('#main').innerHTML = cab('Contato') + estado.vazio({ texto:data?.status === 'nao_encontrado' ? 'Este contato não existe (ou foi excluído).' : 'Não foi possível carregar.' }); return; }
  const c = data.contato, org = c.natureza === 'organizacao';
  const atrasado = c.proximo_em && c.proximo_em < hojeISO();
  const nome = x => RI.porId.get(x)?.nome || '—';
  const principal = `
    ${c.resumo ? `<section class="card ri-sec"><h2>Em resumo</h2><p class="ri-texto">${esc(c.resumo)}</p></section>` : ''}
    <section class="card ri-sec ri-passo${atrasado ? ' atrasado' : ''}"><h2>Próximo passo</h2>
      ${c.proximo_passo ? `<p class="ri-texto">${esc(c.proximo_passo)}${c.proximo_em ? ` <span class="${atrasado ? 'ri-frio' : 'dim'}">, até ${fmtD(c.proximo_em)}${atrasado ? ' (atrasado)' : ''}</span>` : ''}</p>`
        : '<p class="dim">Nenhum combinado. Registrar uma interação com um próximo passo evita que o contato esfrie.</p>'}</section>
    <section class="card ri-sec"><div class="ri-sec-cab"><h2>Histórico de interações <span class="n">${data.interacoes.length}</span></h2>
      <button type="button" class="btn ghost mini" id="ri-f-inter">${ic('plus')} Registrar</button></div>
      ${data.interacoes.length ? `<ol class="ri-linha">${data.interacoes.map((i, n) => `<li>
        <div class="ri-linha-cab"><b>${esc(riRot(RI_INTER, i.tipo))}</b>, ${fmtD(i.data)}${i.missao ? `, <a href="#/ri/missoes/${i.missao_id}">${esc(i.missao)}</a>` : ''}
          <span class="dim">, ${esc(i.autor_nome || '—')}</span>
          <button type="button" class="ri-mini" data-inter="${n}" aria-label="Editar a interação">${ic('pencil')}</button></div>
        <p class="ri-texto">${esc(i.resumo)}</p>
        ${i.contatos.length > 1 ? `<p class="small dim">Com ${i.contatos.filter(x => x !== id).map(x => `<a href="#/ri/${x}">${esc(nome(x))}</a>`).join(', ')}</p>` : ''}</li>`).join('')}</ol>`
        : '<p class="dim">Nenhuma interação registrada.</p>'}</section>
    <section class="card ri-sec"><div class="ri-sec-cab"><h2>Relações <span class="n">${data.relacoes.length}</span></h2>
      <button type="button" class="btn ghost mini" id="ri-f-rel">${ic('plus')} Nova relação</button></div>
      ${data.relacoes.length ? `<ul class="ri-rels">${data.relacoes.map(r => { const o = r.a === id ? r.b : r.a; return `<li>
        <span class="ri-sinal ${r.sinal}" title="${r.sinal}">${r.sinal === 'positiva' ? '+' : r.sinal === 'negativa' ? '−' : '='}</span>
        <a href="#/ri/${o}">${esc(nome(o))}</a> <span class="dim">força ${r.forca}</span>
        ${r.tags.map(t => `<span class="ri-tag">${esc(t)}</span>`).join('')}
        <button type="button" class="ri-mini" data-rel="${r.id}" aria-label="Editar a relação">${ic('pencil')}</button></li>`; }).join('')}</ul>`
        : '<p class="dim">Nenhuma relação. No mapa, ligue dois pontos arrastando de um ao outro.</p>'}</section>
    ${org ? `<section class="card ri-sec"><h2>Pessoas desta organização <span class="n">${data.membros.length}</span></h2>
      ${data.membros.length ? `<ul class="ri-rels">${data.membros.map(m => `<li><a href="#/ri/${m.id}">${esc(m.nome)}</a> <span class="dim">${esc(m.cargo || '')}</span></li>`).join('')}</ul>`
        : '<p class="dim">Ninguém ligado ainda. Na ficha de uma pessoa, escolha esta organização.</p>'}</section>` : ''}
    <section class="card ri-sec"><h2>Missões <span class="n">${data.missoes.length}</span></h2>
      ${data.missoes.length ? `<ul class="ri-rels">${data.missoes.map(e => `<li><a href="#/ri/missoes/${e.id}">${esc(e.nome)}</a> <span class="dim">${e.inicio ? fmtD(e.inicio) : ''}, ${esc(riRot(RI_EV_STATUS, e.status))}</span></li>`).join('')}</ul>`
        : '<p class="dim">Em nenhuma missão.</p>'}</section>
    ${c.notas ? `<section class="card ri-sec"><h2>Notas</h2><p class="ri-texto">${esc(c.notas)}</p></section>` : ''}`;
  const lateral = `
    <div class="ri-ficha-marca"><span class="ri-bola g${org ? ' q' : ''}" style="background:${riCor(c.funcao)};opacity:${riOpac(c.proximidade)}"></span>
      <span>${esc(riRot(RI_FUNCOES, c.funcao))}</span></div>
    ${spec([['Natureza', org ? 'Organização' : 'Pessoa'], [org ? 'Tipo' : 'Cargo', esc(c.cargo || '')],
      !org ? ['Organização', c.organizacao_id ? `<a href="#/ri/${c.organizacao_id}">${esc(c.organizacao)}</a>` : ''] : null,
      ['Estágio', esc(riRot(RI_ESTAGIOS, c.estagio))], ['Proximidade', `${riPontos(c.proximidade)} ${RI_PROX[c.proximidade]}`],
      ['Influência', c.influencia ? c.influencia + ' de 5' : ''], ['Interesse', c.interesse ? c.interesse + ' de 5' : ''],
      ['Conexões', String(RI.grau.get(id) || 0)], ['Responsável', esc(c.responsavel_nome || '')], ['Cidade', esc(c.cidade || '')],
      ['Origem', esc(c.origem || '')], ['Situação', c.ativo ? 'Ativo' : 'Inativo'],
      ['Atualizado', `${fmtD(c.atualizado_em)}${c.atualizado_por_nome ? ', ' + esc(c.atualizado_por_nome) : ''}`]])}
    ${c.canais.length ? `<h3 class="ri-lat-tit">Contatos</h3><ul class="ri-canais">${c.canais.map(k => `<li><span class="dim">${esc(riRot(RI_CANAIS, k.tipo))}</span>
      <span class="v">${riCanalLink(k)}</span><button type="button" class="ri-mini" data-copiar="${esc(k.valor)}" aria-label="Copiar">${ic('copy')}</button></li>`).join('')}</ul>` : ''}
    ${(c.tags || []).length ? `<h3 class="ri-lat-tit">Interesses</h3><div class="ri-tags">${c.tags.map(t => `<span class="ri-tag">${esc(t)}</span>`).join('')}</div>` : ''}`;
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:c.nome, voltar:['Conexões', '#/ri/conexoes'],
      meta:[riRot(RI_FUNCOES, c.funcao), riRot(RI_ESTAGIOS, c.estagio), !org && c.organizacao ? c.organizacao : null].filter(Boolean).map(x => `<span>${esc(x)}</span>`),
      acoes:`<a class="btn ghost" href="#/ri/${id}/editar" id="ri-editar">${ic('pencil')} Editar</a>` }) + layoutObjeto(principal, lateral);
  $('#ri-f-inter').addEventListener('click', () => riInteracaoModal([id]));
  $('#ri-f-rel').addEventListener('click', () => riEscolherPar(id));
  $('#main').querySelectorAll('[data-inter]').forEach(b => b.addEventListener('click', () => riInteracaoModal(null, data.interacoes[+b.dataset.inter])));
  $('#main').querySelectorAll('[data-rel]').forEach(b => b.addEventListener('click', () => riRelacaoModal(null, null, +b.dataset.rel)));
  $('#main').querySelectorAll('[data-copiar]').forEach(b => b.addEventListener('click', () => { navigator.clipboard?.writeText(b.dataset.copiar); toast('Copiado.'); }));
}
function riCanalLink(k){
  const v = esc(k.valor);
  if (k.tipo === 'email') return `<a href="mailto:${v}">${v}</a>`;
  if (k.tipo === 'telefone') return `<a href="tel:${esc(k.valor.replace(/[^\d+]/g, ''))}">${v}</a>`;
  if (/^https?:\/\//i.test(k.valor)) return `<a href="${v}" target="_blank" rel="noopener">${v}</a>`;
  return v;
}
/* a relação a partir da ficha: escolher o outro lado */
function riEscolherPar(id){
  const opcoes = RI.d.contatos.filter(c => c.id !== id).sort((x, y) => x.nome.localeCompare(y.nome, 'pt'));
  abreModal(`<h3>Nova relação</h3>
    <div class="fld"><label for="ri-par">Com quem</label><input id="ri-par" list="ri-par-ops" autocomplete="off" placeholder="Nome da pessoa ou organização">
      <datalist id="ri-par-ops">${opcoes.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></div>
    <p class="aviso-box err" id="ri-par-erro" hidden>Escolha um nome da lista.</p>
    <div class="acts" style="justify-content:flex-end"><button type="button" class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button type="button" class="btn solid" id="ri-par-ok">Continuar</button></div>`);
  $('#ri-par-ok').addEventListener('click', () => {
    const o = opcoes.find(c => c.nome === $('#ri-par').value);
    if (!o){ $('#ri-par-erro').hidden = false; return; }
    riRelacaoModal(id, o.id);
  });
}

/* ---------- o formulário de contato ---------- */
async function riFormulario(id){
  const titulo = id ? 'Editar contato' : 'Novo contato';
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo, voltar:['Conexões', '#/ri/conexoes'] }) + estado.carregando();
  try { await riCarregar(); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  let c = { natureza:'pessoa', nome:'', cargo:'', organizacao_id:null, funcao:'stakeholder', proximidade:2, estagio:'identificado', influencia:null, interesse:null,
    tags:[], canais:[], cidade:'', resumo:'', notas:'', origem:'', responsavel:state.perfil?.registro || null, proximo_passo:'', proximo_em:null, ativo:true };
  if (id){
    const { data } = await sb.rpc('ri_contato_ler', { p_id:id });
    if (data?.status !== 'ok'){ $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo, voltar:['Conexões', '#/ri/conexoes'] }) + estado.vazio({ texto:'Este contato não existe.' }); return; }
    c = data.contato;
  }
  const orgs = RI.d.contatos.filter(o => o.natureza === 'organizacao' && o.id !== id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const op = (lista, v) => lista.map(([k, l]) => `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const escala = (idc, v, rots) => `<select id="${idc}"><option value="">—</option>${[1, 2, 3, 4, 5].map(n => `<option value="${n}"${v === n ? ' selected' : ''}>${n}${rots ? ' (' + rots[n] + ')' : ''}</option>`).join('')}</select>`;
  let tags = [...(c.tags || [])], canais = (c.canais || []).map(x => ({ ...x }));
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo, voltar:['Conexões', '#/ri/conexoes'] }) + `
    <form class="ri-form" id="ri-form" novalidate>
      <div class="seg" role="radiogroup" aria-label="Natureza" id="ri-nat">${[['pessoa', 'Pessoa'], ['organizacao', 'Organização']].map(([k, l]) =>
        `<button type="button" role="radio" data-v="${k}" class="${c.natureza === k ? 'on' : ''}" aria-checked="${c.natureza === k}">${l}</button>`).join('')}</div>
      <div class="ri-dupla">
        <div class="fld"><label for="ri-nome">Nome</label><input id="ri-nome" maxlength="160" required value="${esc(c.nome)}"></div>
        <div class="fld"><label for="ri-cargo" id="ri-cargo-rot">${c.natureza === 'organizacao' ? 'Tipo (universidade, hospital, empresa...)' : 'Cargo'}</label><input id="ri-cargo" maxlength="160" value="${esc(c.cargo || '')}"></div>
      </div>
      <div class="ri-dupla">
        <div class="fld" id="ri-org-fld"${c.natureza === 'organizacao' ? ' hidden' : ''}><label for="ri-org">Organização</label>
          <select id="ri-org"><option value="">Nenhuma</option>${orgs.map(o => `<option value="${o.id}"${c.organizacao_id === o.id ? ' selected' : ''}>${esc(o.nome)}</option>`).join('')}</select></div>
        <div class="fld"><label for="ri-cidade">Cidade</label><input id="ri-cidade" maxlength="120" value="${esc(c.cidade || '')}"></div>
      </div>
      <div class="fld"><label for="ri-resumo">Em resumo <span class="opc">(aparece no mapa)</span></label><textarea id="ri-resumo" rows="2" maxlength="600" placeholder="Quem é e por que importa para a NRO, em uma ou duas frases.">${esc(c.resumo || '')}</textarea></div>
      <h2 class="ri-form-tit">Na rede da NRO</h2>
      <div class="ri-tres">
        <div class="fld"><label for="ri-funcao">Função ${dica('A cor do ponto no mapa: o papel que este contato tem para a NRO.')}</label><select id="ri-funcao">${op(RI_FUNCOES.map(x => [x[0], x[1]]), c.funcao)}</select></div>
        <div class="fld"><label for="ri-estagio">Estágio ${dica('A qualidade da conexão: a coluna no kanban.')}</label><select id="ri-estagio">${op(RI_ESTAGIOS.map(x => [x[0], x[1]]), c.estagio)}</select></div>
        <div class="fld"><label for="ri-prox">Proximidade ${dica('O quão perto da nossa rede está, de 1 (distante) a 5 (aliado): a opacidade do ponto.')}</label><select id="ri-prox">${op([1, 2, 3, 4, 5].map(n => [n, n + ' (' + RI_PROX[n] + ')']), c.proximidade)}</select></div>
        <div class="fld"><label for="ri-infl">Influência ${dica('Quanto pode afetar os nossos objetivos (poder, recursos, decisão), de 1 a 5. Com o interesse, forma a matriz poder × interesse.')}</label>${escala('ri-infl', c.influencia)}</div>
        <div class="fld"><label for="ri-inter">Interesse ${dica('Quanto se interessa pelo que fazemos, de 1 a 5.')}</label>${escala('ri-inter', c.interesse)}</div>
        <div class="fld"><label for="ri-resp">Responsável na NRO</label><select id="ri-resp"><option value="">Ninguém</option>${op(RI.d.equipe.map(m => [m.registro, m.nome]), c.responsavel)}</select></div>
      </div>
      <div class="fld"><label for="ri-tag">Interesses e temas</label><div class="ri-chips" id="ri-tags"></div>
        <input id="ri-tag" placeholder="Digite e tecle Enter (ex.: Reabilitação, EMG, investimento-anjo)" autocomplete="off"></div>
      <h2 class="ri-form-tit">Como falar</h2>
      <div id="ri-canais"></div>
      <button type="button" class="btn ghost mini" id="ri-canal-mais">${ic('plus')} Acrescentar contato</button>
      <h2 class="ri-form-tit">Acompanhamento</h2>
      <div class="ri-dupla">
        <div class="fld"><label for="ri-passo">Próximo passo</label><input id="ri-passo" maxlength="300" value="${esc(c.proximo_passo || '')}"></div>
        <div class="fld"><label for="ri-passo-em">Até</label><input type="date" id="ri-passo-em" value="${c.proximo_em || ''}"></div>
      </div>
      <div class="fld"><label for="ri-origem">Origem ${dica('De onde veio o contato (indicação de quem, qual evento). Ajuda a lembrar e a responder a quem pedir, pela LGPD, de onde vieram os dados.')}</label><input id="ri-origem" maxlength="300" value="${esc(c.origem || '')}"></div>
      <div class="fld"><label for="ri-notas">Notas</label><textarea id="ri-notas" rows="5" maxlength="20000">${esc(c.notas || '')}</textarea></div>
      <label class="ri-fn"><input type="checkbox" id="ri-ativo"${c.ativo ? ' checked' : ''}> Ativo (desmarque para tirar das vistas sem apagar)</label>
      <p class="aviso-box err" id="ri-erro" hidden></p>
      <div class="ri-form-pe">
        ${id ? `<button type="button" class="btn ghost" id="ri-excluir">${ic('trash')} Excluir de vez</button>` : '<span></span>'}
        <span style="display:flex;gap:8px"><a class="btn ghost" href="${id ? '#/ri/' + id : '#/ri/conexoes'}">Cancelar</a><button type="submit" class="btn solid" id="ri-salvar">Salvar</button></span>
      </div>
    </form>`;
  const pintarTags = () => { $('#ri-tags').innerHTML = tags.map(t => `<span class="ri-chip">${esc(t)}<button type="button" aria-label="Tirar ${esc(t)}" data-x="${esc(t)}">×</button></span>`).join(''); };
  const pintarCanais = () => { $('#ri-canais').innerHTML = canais.map((k, i) => `<div class="ri-canal">
      <select aria-label="Tipo" data-i="${i}" data-k="tipo">${op(RI_CANAIS, k.tipo)}</select>
      <input aria-label="Contato" data-i="${i}" data-k="valor" maxlength="300" value="${esc(k.valor || '')}">
      <button type="button" class="ri-mini" data-tira="${i}" aria-label="Tirar">${ic('trash')}</button></div>`).join(''); };
  pintarTags(); pintarCanais();
  $('#ri-tag').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ','){ e.preventDefault(); const v = e.target.value.trim(); if (v && !tags.includes(v) && tags.length < 30) tags.push(v.slice(0, 60)); e.target.value = ''; pintarTags(); } });
  $('#ri-tags').addEventListener('click', e => { const x = e.target.closest('[data-x]'); if (x){ tags = tags.filter(t => t !== x.dataset.x); pintarTags(); } });
  $('#ri-canal-mais').addEventListener('click', () => { canais.push({ tipo:'email', valor:'' }); pintarCanais(); $('#ri-canais').querySelector('.ri-canal:last-child input')?.focus(); });
  $('#ri-canais').addEventListener('input', e => { const el = e.target.closest('[data-i]'); if (el) canais[+el.dataset.i][el.dataset.k] = el.value; });
  $('#ri-canais').addEventListener('click', e => { const x = e.target.closest('[data-tira]'); if (x){ canais.splice(+x.dataset.tira, 1); pintarCanais(); } });
  $('#ri-nat').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return;
    $('#ri-nat').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    $('#ri-org-fld').hidden = b.dataset.v === 'organizacao';
    $('#ri-cargo-rot').textContent = b.dataset.v === 'organizacao' ? 'Tipo (universidade, hospital, empresa...)' : 'Cargo'; });
  $('#ri-form').addEventListener('submit', async e => {
    e.preventDefault();
    const v = s => $(s).value, num = s => $(s).value ? +$(s).value : null;
    const t = $('#ri-tag').value.trim(); if (t && !tags.includes(t)) tags.push(t);
    const p = { id, natureza:$('#ri-nat .on').dataset.v, nome:v('#ri-nome'), cargo:v('#ri-cargo'), organizacao_id:num('#ri-org'), cidade:v('#ri-cidade'),
      resumo:v('#ri-resumo'), funcao:v('#ri-funcao'), estagio:v('#ri-estagio'), proximidade:num('#ri-prox'), influencia:num('#ri-infl'), interesse:num('#ri-inter'),
      responsavel:num('#ri-resp'), tags, canais:canais.filter(k => (k.valor || '').trim()), proximo_passo:v('#ri-passo'), proximo_em:v('#ri-passo-em') || null,
      origem:v('#ri-origem'), notas:v('#ri-notas'), ativo:$('#ri-ativo').checked };
    const erro = t2 => { $('#ri-erro').textContent = t2; $('#ri-erro').hidden = false; };
    if (!p.nome.trim()){ $('#ri-nome').focus(); return erro('Escreva o nome.'); }
    $('#ri-salvar').disabled = true;
    const { data, error } = await sb.rpc('ri_contato_salvar', { p });
    $('#ri-salvar').disabled = false;
    if (error || data?.status !== 'ok') return erro('Não foi possível salvar' + (data?.campo ? ': confira "' + data.campo + '"' : '') + '.');
    RI.d = null; toast(id ? 'Contato atualizado.' : 'Contato criado.');
    const destino = '#/ri/' + data.id;
    if (state.telaAnterior === destino) history.back(); else location.replace(destino);
  });
  $('#ri-excluir')?.addEventListener('click', async () => {
    if (!confirm(`Excluir ${c.nome} de vez? Somem a ficha, as relações e a participação nas interações e nos eventos. Use quando a pessoa pedir (LGPD) ou o registro não tiver mais finalidade. Para só tirar das vistas, desmarque "Ativo".`)) return;
    const { data } = await sb.rpc('ri_contato_excluir', { p_id:id });
    if (data?.status === 'ok'){ RI.d = null; if (RI.pos) { delete RI.pos[id]; riPosGuardar(); } toast('Contato excluído.'); location.replace('#/ri/conexoes'); }
  });
}

/* ---------- eventos de RI ---------- */
async function riMissoes(){
  const cab = (x = {}) => cabecalho({ espaco:'Relações institucionais', titulo:'Missões', voltar:['Relações institucionais', '#/ri'],
    lead:'Eventos, visitas e encontros em que a equipe representa a NRO, para conhecer stakeholders, apresentar e alinhar interesses: onde vale estar e o que rendeu.', ...x });
  $('#main').innerHTML = cab() + estado.carregando();
  const { data, error } = await sb.rpc('ri_missoes_listar');
  if (error || data?.status !== 'ok') return data?.status === 'sem_permissao' ? riSemPermissao() : riErro(error || { message:data?.status });
  RI.evs = data.missoes;
  const hoje = hojeISO();
  const grupos = [
    ['Próximos', e => ['confirmado', 'prospectado', 'avaliando'].includes(e.status) && (!e.inicio || (e.fim || e.inicio) >= hoje)],
    ['Realizados', e => e.status === 'participou' || (e.status === 'confirmado' && (e.fim || e.inicio) < hoje)],
    ['Passaram sem a equipe', e => ['prospectado', 'avaliando'].includes(e.status) && e.inicio && (e.fim || e.inicio) < hoje],
    ['Descartados', e => e.status === 'descartado']];
  const card = e => `<a class="ri-ev" href="#/ri/missoes/${e.id}">
    <span class="ri-ev-data">${e.inicio ? fmtD(e.inicio) + (e.fim && e.fim !== e.inicio ? ' a ' + fmtD(e.fim) : '') : 'Sem data'}</span>
    <b>${esc(e.nome)}</b>
    <span class="sub">${esc([riRot(RI_EV_TIPOS, e.tipo), e.local, e.modalidade !== 'presencial' ? (e.modalidade === 'online' ? 'Online' : 'Híbrido') : null].filter(Boolean).join(', '))}</span>
    <span class="ri-ev-pe"><span class="pill">${esc(riRot(RI_EV_STATUS, e.status))}</span>
      <span class="dim">${e.participantes.length} da equipe, ${e.contatos.length} contatos${e.avaliacao ? ', nota ' + e.avaliacao + ' de 5' : ''}</span></span></a>`;
  $('#main').innerHTML = cab({ acoes:`<a class="btn solid ri-mais" href="#/ri/missoes/novo" title="Nova missão" aria-label="Nova missão">${ic('plus')}</a>` })
    + (RI.evs.length ? grupos.map(([t, f]) => { const l = RI.evs.filter(f); return l.length ? `<h2 class="srv-bloco">${t} <span class="n">${l.length}</span></h2><div class="ri-evs">${l.map(card).join('')}</div>` : ''; }).join('')
      : estado.vazio({ texto:'Nenhuma missão registrada.', acao:'<a class="btn ghost mini" href="#/ri/missoes/novo">Registrar a primeira</a>' }));
}
async function riMissao(sub){
  const novo = sub === 'novo', id = novo ? null : +sub;
  const titulo = novo ? 'Nova missão' : 'Missão';
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo, voltar:['Missões', '#/ri/missoes'] }) + estado.carregando();
  try { await riCarregar(); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  let e = { nome:'', tipo:'congresso', status:'prospectado', inicio:null, fim:null, local:'', modalidade:'presencial', link:'', organizador:'', objetivos:[],
    publico:'', custo:null, participantes:[], contatos:[], resultados:'', avaliacao:null, notas:'' };
  if (!novo){
    if (!RI.evs){ const { data } = await sb.rpc('ri_missoes_listar'); RI.evs = data?.missoes || []; }
    const achado = RI.evs.find(x => x.id === id);
    if (!achado){ $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo, voltar:['Missões', '#/ri/missoes'] }) + estado.vazio({ texto:'Esta missão não existe.' }); return; }
    e = achado;
  }
  const op = (lista, v) => lista.map(([k, l]) => `<option value="${esc(k)}"${String(v ?? '') === String(k) ? ' selected' : ''}>${esc(l)}</option>`).join('');
  const membros = (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const contatos = RI.d.contatos.slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt'));
  const parts = new Set(e.participantes), cs = new Set(e.contatos), objs = new Set(e.objetivos);
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:novo ? titulo : e.nome, voltar:['Missões', '#/ri/missoes'] }) + `
    <form class="ri-form" id="ri-ev-form" novalidate>
      <div class="fld"><label for="ri-ev-nome">Nome</label><input id="ri-ev-nome" maxlength="200" value="${esc(e.nome)}"></div>
      <div class="ri-tres">
        <div class="fld"><label for="ri-ev-tipo">Tipo</label><select id="ri-ev-tipo">${op(RI_EV_TIPOS, e.tipo)}</select></div>
        <div class="fld"><label for="ri-ev-status">Situação</label><select id="ri-ev-status">${op(RI_EV_STATUS, e.status)}</select></div>
        <div class="fld"><label for="ri-ev-mod">Modalidade</label><select id="ri-ev-mod">${op([['presencial', 'Presencial'], ['online', 'Online'], ['hibrido', 'Híbrido']], e.modalidade)}</select></div>
        <div class="fld"><label for="ri-ev-ini">Início</label><input type="date" id="ri-ev-ini" value="${e.inicio || ''}"></div>
        <div class="fld"><label for="ri-ev-fim">Fim</label><input type="date" id="ri-ev-fim" value="${e.fim || ''}"></div>
        <div class="fld"><label for="ri-ev-custo">Custo previsto (R$)</label><input type="number" min="0" step="0.01" id="ri-ev-custo" value="${e.custo ?? ''}"></div>
      </div>
      <div class="ri-dupla">
        <div class="fld"><label for="ri-ev-local">Local</label><input id="ri-ev-local" maxlength="200" value="${esc(e.local || '')}"></div>
        <div class="fld"><label for="ri-ev-org">Organizador</label><input id="ri-ev-org" maxlength="200" value="${esc(e.organizador || '')}"></div>
      </div>
      <div class="fld"><label for="ri-ev-link">Página do evento</label><input id="ri-ev-link" type="url" placeholder="https://" maxlength="500" value="${esc(e.link || '')}"></div>
      <fieldset class="ri-funcoes"><legend>Objetivos</legend>${[...new Set([...RI_OBJETIVOS, ...objs])].map(o =>
        `<label class="ri-fn"><input type="checkbox" data-obj value="${esc(o)}"${objs.has(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('')}</fieldset>
      <div class="fld"><label for="ri-ev-publico">Quem estará lá</label><textarea id="ri-ev-publico" rows="2" maxlength="2000" placeholder="Stakeholders, investidores, órgãos, empresas esperados.">${esc(e.publico || '')}</textarea></div>
      <div class="ri-dupla">
        <div class="fld"><label for="ri-ev-p">Da equipe</label><div class="ri-chips" id="ri-ev-pchips"></div>
          <input id="ri-ev-p" list="ri-ev-pops" placeholder="Acrescentar membro" autocomplete="off"><datalist id="ri-ev-pops">${membros.map(m => `<option value="${esc(m.nome)}">`).join('')}</datalist></div>
        <div class="fld"><label for="ri-ev-c">Contatos (encontrados ou esperados)</label><div class="ri-chips" id="ri-ev-cchips"></div>
          <input id="ri-ev-c" list="ri-ev-cops" placeholder="Acrescentar contato" autocomplete="off"><datalist id="ri-ev-cops">${contatos.map(c => `<option value="${esc(c.nome)}">`).join('')}</datalist></div>
      </div>
      <h2 class="ri-form-tit">Depois do evento</h2>
      <div class="fld"><label for="ri-ev-res">O que rendeu</label><textarea id="ri-ev-res" rows="4" maxlength="8000" placeholder="Contatos feitos, acordos, aprendizados, próximos passos.">${esc(e.resultados || '')}</textarea></div>
      <div class="ri-dupla">
        <div class="fld"><label for="ri-ev-av">Valeu a pena?</label><select id="ri-ev-av"><option value="">—</option>${op([1, 2, 3, 4, 5].map(n => [n, n + ' (' + ['', 'Não valeu', 'Pouco', 'Razoável', 'Valeu', 'Valeu muito'][n] + ')']), e.avaliacao)}</select></div>
        <div class="fld"><label for="ri-ev-notas">Notas</label><textarea id="ri-ev-notas" rows="2" maxlength="8000">${esc(e.notas || '')}</textarea></div>
      </div>
      <p class="aviso-box err" id="ri-ev-erro" hidden></p>
      <div class="ri-form-pe">
        ${novo ? '<span></span>' : `<button type="button" class="btn ghost" id="ri-ev-excluir">${ic('trash')} Excluir</button>`}
        <span style="display:flex;gap:8px">${novo ? '' : `<button type="button" class="btn ghost" id="ri-ev-inter">Registrar interação</button>`}<button type="submit" class="btn solid" id="ri-ev-salvar">Salvar</button></span>
      </div>
    </form>`;
  const chips = (alvo, set, nomeDe2) => { $(alvo).innerHTML = [...set].map(x => `<span class="ri-chip">${esc(nomeDe2(x))}<button type="button" data-x="${x}" aria-label="Tirar">×</button></span>`).join(''); };
  const nomeM = r => membros.find(m => m.registro === r)?.nome || nomeDe(r), nomeC = i => RI.porId.get(i)?.nome || '?';
  const pintar = () => { chips('#ri-ev-pchips', parts, nomeM); chips('#ri-ev-cchips', cs, nomeC); };
  pintar();
  $('#ri-ev-p').addEventListener('change', ev => { const m = membros.find(x => x.nome === ev.target.value); if (m){ parts.add(m.registro); ev.target.value = ''; pintar(); } });
  $('#ri-ev-c').addEventListener('change', ev => { const c = contatos.find(x => x.nome === ev.target.value); if (c){ cs.add(c.id); ev.target.value = ''; pintar(); } });
  $('#ri-ev-pchips').addEventListener('click', ev => { const x = ev.target.closest('[data-x]'); if (x){ parts.delete(+x.dataset.x); pintar(); } });
  $('#ri-ev-cchips').addEventListener('click', ev => { const x = ev.target.closest('[data-x]'); if (x){ cs.delete(+x.dataset.x); pintar(); } });
  $('#ri-ev-inter')?.addEventListener('click', () => riInteracaoModal([...cs]));
  $('#ri-ev-form').addEventListener('submit', async ev => {
    ev.preventDefault();
    const v = s => $(s).value;
    const p = { id, nome:v('#ri-ev-nome'), tipo:v('#ri-ev-tipo'), status:v('#ri-ev-status'), modalidade:v('#ri-ev-mod'), inicio:v('#ri-ev-ini') || null, fim:v('#ri-ev-fim') || null,
      custo:v('#ri-ev-custo') || null, local:v('#ri-ev-local'), organizador:v('#ri-ev-org'), link:v('#ri-ev-link'),
      objetivos:[...document.querySelectorAll('[data-obj]:checked')].map(x => x.value), publico:v('#ri-ev-publico'),
      participantes:[...parts], contatos:[...cs], resultados:v('#ri-ev-res'), avaliacao:v('#ri-ev-av') ? +v('#ri-ev-av') : null, notas:v('#ri-ev-notas') };
    const erro = t => { $('#ri-ev-erro').textContent = t; $('#ri-ev-erro').hidden = false; };
    if (!p.nome.trim()) return erro('Escreva o nome da missão.');
    if (p.inicio && p.fim && p.fim < p.inicio) return erro('O fim vem antes do início.');
    if (p.link && !/^https?:\/\//i.test(p.link)) return erro('A página do evento precisa começar por https://');
    const { data, error } = await sb.rpc('ri_missao_salvar', { p });
    if (error || data?.status !== 'ok') return erro('Não foi possível salvar' + (data?.campo ? ': confira "' + data.campo + '"' : '') + '.');
    RI.evs = null; toast(novo ? 'Missão registrada.' : 'Missão atualizada.');
    location.replace('#/ri/missoes');
  });
  $('#ri-ev-excluir')?.addEventListener('click', async () => {
    if (!confirm('Excluir esta missão?')) return;
    const { data } = await sb.rpc('ri_missao_excluir', { p_id:id });
    if (data?.status === 'ok'){ RI.evs = null; toast('Missão excluída.'); location.replace('#/ri/missoes'); }
  });
}

/* ---------- as indicações dos membros ---------- */
async function riIndicacoes(){
  const cab = () => cabecalho({ espaco:'Relações institucionais', titulo:'Indicações', voltar:['Relações institucionais', '#/ri'],
    lead:'Contatos e eventos que os membros indicam pelos Serviços. Quem indicou é avisado a cada passo.' });
  $('#main').innerHTML = cab() + estado.carregando();
  const { data, error } = await sb.rpc('ri_indicacoes_listar');
  if (error || data?.status !== 'ok') return data?.status === 'sem_permissao' ? riSemPermissao() : riErro(error || { message:data?.status });
  RI.inds = data.indicacoes;
  const ST = { nova:'Nova', em_analise:'Em análise', aceita:'Aceita', recusada:'Recusada' };
  const abertas = RI.inds.filter(i => ['nova', 'em_analise'].includes(i.status)), fechadas = RI.inds.filter(i => !['nova', 'em_analise'].includes(i.status));
  const card = i => { const d = i.dados || {}; const aberta = ['nova', 'em_analise'].includes(i.status);
    return `<article class="card ri-sec ri-ind" data-id="${i.id}">
      <div class="ri-ind-cab"><span class="pill">${i.tipo === 'contato' ? 'Contato' : 'Evento'}</span><b>${esc(d.nome || '—')}</b>
        <span class="pill ${i.status}">${ST[i.status]}</span></div>
      <p class="small dim">Indicado por ${esc(i.autor_nome || '—')} em ${fmtD(i.criado_em)}${i.analisado_por_nome ? `, analisado por ${esc(i.analisado_por_nome)}` : ''}</p>
      ${spec([['Por que', esc(d.por_que || '')], i.tipo === 'contato' ? ['Quem é', esc([d.cargo, d.organizacao].filter(Boolean).join(', '))] : ['Quando e onde', esc([d.data ? fmtD(d.data) : '', d.local].filter(Boolean).join(', '))],
        i.tipo === 'contato' ? ['Relação com quem indicou', esc(d.relacao || '')] : ['Organizador', esc(d.organizador || '')],
        i.tipo === 'contato' ? ['Como contatar', esc(d.contato || '')] : ['Página', d.link ? `<a href="${esc(d.link)}" target="_blank" rel="noopener">${esc(d.link)}</a>` : ''],
        i.tipo === 'contato' ? ['Sabe da indicação', d.sabe ? 'Sim' : 'Não informado'] : null])}
      ${i.resposta ? `<p class="small"><b>Resposta:</b> ${esc(i.resposta)}</p>` : ''}
      ${i.contato_id ? `<p><a href="#/ri/${i.contato_id}">Abrir o contato criado →</a></p>` : i.missao_id ? `<p><a href="#/ri/missoes/${i.missao_id}">Abrir a missão criada →</a></p>` : ''}
      ${aberta ? `<div class="fld"><label for="ri-ind-r-${i.id}">Resposta para quem indicou</label><textarea id="ri-ind-r-${i.id}" rows="2" maxlength="1000"></textarea></div>
        <div class="acts">${i.status === 'nova' ? `<button type="button" class="btn ghost mini" data-acao="em_analise">Pegar para analisar</button>` : ''}
          <button type="button" class="btn ghost mini" data-acao="recusar">Recusar</button>
          <button type="button" class="btn solid mini" data-acao="aceitar">Aceitar e criar ${i.tipo === 'contato' ? 'o contato' : 'a missão'}</button></div>
        <p class="aviso-box err" hidden></p>` : ''}
    </article>`; };
  $('#main').innerHTML = cab() + (RI.inds.length
    ? `${abertas.length ? `<h2 class="srv-bloco">Para analisar <span class="n">${abertas.length}</span></h2><div class="ri-inds">${abertas.map(card).join('')}</div>` : '<p class="dim">Nenhuma indicação esperando análise.</p>'}
       ${fechadas.length ? `<h2 class="srv-bloco">Analisadas <span class="n">${fechadas.length}</span></h2><div class="ri-inds">${fechadas.map(card).join('')}</div>` : ''}`
    : estado.vazio({ texto:'Nenhuma indicação ainda. Os membros indicam pelos Serviços, em "Indicar contato ou evento".' }));
  $('#main').querySelectorAll('[data-acao]').forEach(b => b.addEventListener('click', async () => {
    const art = b.closest('.ri-ind'), id = +art.dataset.id, resp = art.querySelector('textarea')?.value || '', err = art.querySelector('.aviso-box');
    if (b.dataset.acao === 'recusar' && !resp.trim()){ err.textContent = 'Para recusar, escreva a resposta para quem indicou.'; err.hidden = false; return; }
    const { data: d2, error: e2 } = await sb.rpc('ri_indicacao_decidir', { p_id:id, p_acao:b.dataset.acao, p_resposta:resp || null, p_criar:true });
    if (e2 || d2?.status !== 'ok'){ err.textContent = 'Não foi possível (' + (d2?.status || e2?.message) + ').'; err.hidden = false; return; }
    RI.d = null;
    toast(b.dataset.acao === 'aceitar' ? 'Aceita. Quem indicou foi avisado.' : b.dataset.acao === 'recusar' ? 'Recusada. Quem indicou foi avisado.' : 'Em análise. Quem indicou foi avisado.');
    if (d2.contato_id) location.hash = '#/ri/' + d2.contato_id + '/editar';
    else if (d2.missao_id) location.hash = '#/ri/missoes/' + d2.missao_id;
    else riIndicacoes();
  }));
}
