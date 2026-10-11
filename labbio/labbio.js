/* ============================================================
   PAINEL DO LABBIO (/labbio, 2.19.1, ficha L2)
   Página própria dos gestores do LABBIO. A conta deles é externa: o
   banco só deixa chamar funções labbio_* (contrato em
   fichas/CONTRATO-LABBIO.md). Por isso esta página não lê tabela
   nenhuma e não carrega a casca do portal.

   Rotas (hash): #/ início, #/membros, #/solicitacoes, #/checkins,
   #/treinamentos, #/agenda (L4, L6 e L8 preenchem), #/gestores e
   #/aceitar?c=<token> (o link do convite).
   ============================================================ */
const CONFIG = {
  SUPABASE_URL: 'https://rxzmkyjttzzpwtodqkve.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg'
};
const sb = supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
const $ = s => document.querySelector(s);
const esc = v => v == null ? '' : String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const fmtDT = d => d ? new Date(d).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
const TOKEN_OK = /^[0-9a-f]{48}$/;
/* a estrela do responsável principal (ícone, não glifo) */
const ESTRELA = '<svg class="ic-estrela" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" fill="currentColor"/></svg>';
const CHAVE_CONVITE = 'nd.labbio.convite';

const lab = { eu:null, sessao:null, gestores:null };

const NAV = [['', 'Início'], ['membros', 'Membros'], ['solicitacoes', 'Solicitações'], ['checkins', 'Check-ins'],
             ['treinamentos', 'Treinamentos'], ['agenda', 'Agenda'], ['gestores', 'Gestores']];

/* ---------------- utilidades de tela ---------------- */
function toast(msg, erro){
  const t = document.createElement('div'); t.className = 'toast' + (erro ? ' err' : ''); t.textContent = msg;
  $('#toast').appendChild(t); setTimeout(() => t.remove(), 4600);
}
const estado = {
  carregando: () => '<div class="carregando" aria-busy="true"><span class="spin"></span> Carregando…</div>',
  vazio: texto => `<div class="vazio"><p>${esc(texto)}</p></div>`,
  erro: (texto, acao) => `<div class="aviso-box err" role="alert"><span>${esc(texto)}</span>${acao || ''}</div>`
};
const cabecalho = ({ titulo, lead, acoes }) => `<header class="cab"><span class="eyebrow">LABBIO</span>
  <div class="cab-linha"><h1 id="lb-h1" tabindex="-1">${esc(titulo)}</h1>${acoes || ''}</div>${lead ? `<p class="cab-lead">${esc(lead)}</p>` : ''}</header>`;
const marcas = () => `<span class="lb-marcas"><img class="lb-logo" src="../studio/labbio.png" alt="LABBIO"><span class="lb-sep" aria-hidden="true"></span>
  <img class="lb-nro lb-nro-escuro" src="../studio/nro-imagotipo-branco.png" alt="NeuroDynamics"><img class="lb-nro lb-nro-claro" src="../studio/nro-imagotipo.png" alt="NeuroDynamics"></span>`;

function abreModal(html){ $('#lb-modal').innerHTML = html; $('#lb-modal').hidden = false; $('#lb-veu').hidden = false;
  $('#lb-modal').querySelector('input,textarea,button')?.focus(); }
function fechaModal(){ $('#lb-modal').hidden = true; $('#lb-veu').hidden = true; $('#lb-modal').innerHTML = ''; }
function confirma(texto, rotulo){
  return new Promise(res => {
    abreModal(`<h3>Confirmar</h3><p>${esc(texto)}</p><div class="acts">
      <button class="btn ghost" type="button" id="cf-nao">Cancelar</button><button class="btn solid" type="button" id="cf-sim">${esc(rotulo || 'Confirmar')}</button></div>`);
    $('#cf-nao').onclick = () => { fechaModal(); res(false); };
    $('#cf-sim').onclick = () => { fechaModal(); res(true); };
  });
}
$('#lb-veu').addEventListener('click', fechaModal);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lb-modal').hidden) fechaModal(); });

/* ---------------- a rota ---------------- */
function rota(){
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const [cam, q = ''] = h.split('?');
  const [sec = '', sub = ''] = cam.split('/');
  return { sec, sub, q:new URLSearchParams(q) };
}

/* toda chamada passa por aqui: sem_permissao no meio do uso pode ser revogação */
async function rpc(nome, args){
  const { data, error } = await sb.rpc(nome, args || {});
  if (error) throw error;
  if (data?.status === 'sem_permissao' && nome !== 'labbio_eu'){
    const eu = await sb.rpc('labbio_eu').then(r => r.data, () => null);
    if (eu?.status !== 'ok'){ telaAcesso(eu?.status || 'revogado'); throw new Error('sem_acesso'); }
  }
  return data;
}

/* ---------------- entrada ---------------- */
async function iniciar(){
  const r = rota();
  if (r.sec === 'aceitar'){
    const t = r.q.get('c') || '';
    if (TOKEN_OK.test(t)) try { localStorage.setItem(CHAVE_CONVITE, t); } catch(_){}
  }
  try { lab.sessao = (await sb.auth.getSession())?.data?.session || null; } catch(_){ lab.sessao = null; }
  const convite = r.sec === 'aceitar' ? (r.q.get('c') || '') : (() => { try { return localStorage.getItem(CHAVE_CONVITE) || ''; } catch(_){ return ''; } })();
  if (!lab.sessao) return r.sec === 'aceitar' ? telaConvite(convite) : telaLogin();
  if (convite && (r.sec === 'aceitar' || lab.eu == null)) { const ok = await aceitar(convite); if (!ok) return; }
  await carregarEu();
}

async function carregarEu(){
  let eu = null;
  try { eu = (await sb.rpc('labbio_eu')).data; } catch(_){ eu = null; }
  if (eu?.status !== 'ok') return telaAcesso(eu?.status || 'erro');
  lab.eu = eu.gestor;
  $('#lb-topo').hidden = false;
  $('#lb-eu-nome').textContent = lab.eu?.nome || '';
  if (rota().sec === 'aceitar') history.replaceState(null, '', location.pathname + '#/');
  desenhar();
}

function telaEntrada(html){
  $('#lb-topo').hidden = true;
  $('#lb-main').innerHTML = `<div class="lb-entrada">${marcas()}${html}</div>`;
}
function telaLogin(msg){
  telaEntrada(`<h1>Painel do LABBIO</h1>
    <p class="lead">Entre com a conta de gestor do laboratório.</p>
    <form id="f-entrar" novalidate>
      <div class="fld"><label for="l-email">E-mail</label><input id="l-email" type="email" autocomplete="username"></div>
      <div class="fld"><label for="l-senha">Senha</label><input id="l-senha" type="password" autocomplete="current-password"></div>
      <button class="btn solid" type="submit" id="l-btn">Entrar</button>
      <p class="lb-msg" id="l-msg" role="status">${esc(msg || '')}</p>
    </form>
    <button type="button" class="lb-lk" id="l-esqueci">Esqueci minha senha</button>`);
  $('#f-entrar').onsubmit = entrar;
  $('#l-esqueci').onclick = esqueci;
}
async function entrar(ev){
  ev.preventDefault();
  const bt = $('#l-btn'), m = $('#l-msg'); bt.disabled = true; m.textContent = ''; m.classList.remove('ruim');
  try {
    const { error } = await sb.auth.signInWithPassword({ email:$('#l-email').value.trim(), password:$('#l-senha').value });
    if (error){
      m.classList.add('ruim');
      m.textContent = error.code === 'email_not_confirmed' || /not confirmed/i.test(error.message || '')
        ? 'Falta confirmar o e-mail da sua conta.' : 'E-mail ou senha incorretos.';
      return;
    }
    await iniciar();
  } catch(_){ m.classList.add('ruim'); m.textContent = 'Não foi possível entrar agora. Tente de novo.'; }
  finally { if (document.body.contains(bt)) bt.disabled = false; }
}
async function esqueci(){
  const email = $('#l-email').value.trim(), m = $('#l-msg');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ m.classList.add('ruim'); m.textContent = 'Escreva o seu e-mail acima e clique de novo.'; return; }
  try { await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + '/labbio/' }); } catch(_){}
  m.classList.remove('ruim'); m.textContent = 'Se houver uma conta com este e-mail, o link para criar a senha nova chega em instantes.';
}

/* o convite: criar a conta (ou entrar) e aceitar */
const MOTIVO_CONVITE = {
  invalido:'Este convite não vale mais. Peça um novo.',
  usado:'Este convite já foi usado. Entre com a sua conta.',
  expirado:'O convite venceu. Peça um novo a quem convidou.',
  email_diferente:'Entre com o mesmo e-mail que recebeu o convite.',
  conta_de_membro:'Esta é uma conta do portal da equipe. Crie outra, com o e-mail do convite.'
};
function telaConvite(token, msg){
  if (!TOKEN_OK.test(token || '')) return telaEntrada(`<h1>Convite</h1><p class="lead">${esc(MOTIVO_CONVITE.invalido)}</p>`);
  telaEntrada(`<h1>Convite para o painel do LABBIO</h1>
    <p class="lead">Crie a sua conta com o e-mail que recebeu o convite.</p>
    <form id="f-criar" novalidate>
      <div class="fld"><label for="c-nome">Nome</label><input id="c-nome" autocomplete="name"></div>
      <div class="fld"><label for="c-email">E-mail</label><input id="c-email" type="email" autocomplete="email"></div>
      <div class="fld"><label for="c-senha">Senha</label><input id="c-senha" type="password" autocomplete="new-password"></div>
      <div class="fld"><label for="c-senha2">Confirme a senha</label><input id="c-senha2" type="password" autocomplete="new-password"></div>
      <button class="btn solid" type="submit" id="c-btn">Criar conta</button>
      <p class="lb-msg${msg ? ' ruim' : ''}" id="c-msg" role="status">${esc(msg || '')}</p>
    </form>
    <p class="lb-msg">Já tenho conta: <button type="button" class="lb-lk" id="c-entrar">entrar</button></p>`);
  $('#f-criar').onsubmit = ev => criarConta(ev, token);
  $('#c-entrar').onclick = () => telaLogin();
}
async function criarConta(ev, token){
  ev.preventDefault();
  const m = $('#c-msg'), bt = $('#c-btn'), s1 = $('#c-senha').value, s2 = $('#c-senha2').value;
  const ruim = t => { m.classList.add('ruim'); m.textContent = t; };
  if (!$('#c-nome').value.trim()) return ruim('Escreva o seu nome.');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test($('#c-email').value.trim())) return ruim('Confira o e-mail.');
  if (s1.length < 8) return ruim('A senha precisa de pelo menos 8 caracteres.');
  if (s1 !== s2) return ruim('As duas senhas não são iguais.');
  bt.disabled = true;
  try {
    const { data, error } = await sb.auth.signUp({ email:$('#c-email').value.trim(), password:s1,
      options:{ data:{ nome:$('#c-nome').value.trim() }, emailRedirectTo: location.href } });
    if (error) return ruim(/registered|exists/i.test(error.message || '') ? 'Este e-mail já tem conta: entre com ela.' : 'Não foi possível criar a conta agora.');
    if (!data?.session){ m.classList.remove('ruim'); m.textContent = 'Conta criada. Confirme pelo link que chegou no seu e-mail e volte por ele.'; return; }
    await iniciar();
  } catch(_){ ruim('Não foi possível criar a conta agora.'); }
  finally { if (document.body.contains(bt)) bt.disabled = false; }
}
async function aceitar(token){
  let d = null;
  try { d = (await sb.rpc('labbio_aceitar', { p_token:token })).data; } catch(_){ d = null; }
  if (d?.status === 'ok'){
    try { localStorage.removeItem(CHAVE_CONVITE); } catch(_){}
    toast('Bem-vindo ao painel do LABBIO.');
    return true;
  }
  /* convite que já não vale não fica preso no navegador */
  if (['invalido', 'usado', 'expirado'].includes(d?.status)) try { localStorage.removeItem(CHAVE_CONVITE); } catch(_){}
  if (rota().sec !== 'aceitar' && d?.status === 'usado') return true;
  telaEntrada(`<h1>Convite</h1><p class="lead">${esc(MOTIVO_CONVITE[d?.status] || 'Não foi possível aceitar o convite agora.')}</p>
    <button class="btn ghost" type="button" onclick="labSair()">Sair</button>`);
  return false;
}

function telaAcesso(status){
  const txt = {
    convidado:['Convite pendente', 'Seu convite ainda não foi aceito. Abra o link do e-mail.'],
    revogado:['Acesso encerrado', 'Seu acesso ao painel do LABBIO foi encerrado.'],
    nao_gestor:['Conta do portal', 'Esta conta é do portal da equipe, não do painel do LABBIO.']
  }[status] || ['Painel do LABBIO', 'Não foi possível conferir o seu acesso agora. Tente de novo em instantes.'];
  telaEntrada(`<h1>${esc(txt[0])}</h1><p class="lead" id="lb-acesso">${esc(txt[1])}</p>
    <div class="acts" style="display:flex;gap:10px;flex-wrap:wrap">
      ${status === 'nao_gestor' ? '<a class="btn solid" href="../">Abrir o portal da equipe</a>' : ''}
      <button class="btn ghost" type="button" onclick="labSair()">Sair</button></div>`);
}
async function labSair(){
  try { await sb.auth.signOut(); } catch(_){}
  lab.eu = null; lab.sessao = null;
  history.replaceState(null, '', location.pathname + '#/');
  telaLogin();
}

/* ---------------- o painel ---------------- */
function desenhar(){
  if (!lab.eu) return;
  const r = rota(), sec = NAV.some(([k]) => k === r.sec) ? r.sec : '';
  $('#lb-nav').innerHTML = NAV.map(([k, l]) => `<a href="#/${k}"${k === sec ? ' aria-current="page"' : ''}>${esc(l)}</a>`).join('');
  $('#lb-topo').classList.remove('aberto'); $('#lb-menu-bt').setAttribute('aria-expanded', 'false');
  ({ '':pgInicio, gestores:pgGestores }[sec] || pgEmBreve)(sec);
}
function pgInicio(){
  $('#lb-main').innerHTML = cabecalho({ titulo:'Início', lead:'O que o LABBIO acompanha da equipe da NeuroDynamics.' }) + `
    <div class="lb-atalhos">
      <a href="#/membros"><section class="widget"><header><span class="w-rot">Membros</span></header><div class="w-corpo"><p>Quem tem vínculo com o laboratório, o termo e o acesso.</p></div></section></a>
      <a href="#/solicitacoes"><section class="widget"><header><span class="w-rot">Solicitações</span></header><div class="w-corpo"><p>Os pedidos de acesso biométrico encaminhados pelo Pessoal.</p></div></section></a>
      <a href="#/gestores"><section class="widget"><header><span class="w-rot">Gestores</span></header><div class="w-corpo"><p>Quem gerencia este painel, convites e a estrela.</p></div></section></a>
    </div>`;
}
function pgEmBreve(sec){
  const rot = (NAV.find(([k]) => k === sec) || [, 'Painel'])[1];
  $('#lb-main').innerHTML = cabecalho({ titulo:rot }) + estado.vazio('Em breve.');
}

/* gestores: a lista, o convite, a estrela e a revogação */
const SIT = { ativo:['Ativo', 'p-ok'], convidado:['Convidado', 'p-warn'], revogado:['Revogado', ''] };
const pillSit = s => { const [t, c] = SIT[s] || [s, '']; return `<span class="pill ${c}"><span class="dt"></span>${esc(t)}</span>`; };
async function pgGestores(){
  $('#lb-main').innerHTML = cabecalho({ titulo:'Gestores', lead:'Quem gerencia o painel do LABBIO. A estrela marca o responsável principal.' })
    + `<div id="lb-gest">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_gestores_lista');
    if (d?.status !== 'ok') throw new Error(d?.status || 'falhou');
    lab.gestores = d.gestores || [];
    desenharGestores();
  } catch(e){
    if (e.message === 'sem_acesso') return;
    $('#lb-gest').innerHTML = estado.erro('Não foi possível carregar os gestores.', '<button class="btn ghost mini" type="button" onclick="pgGestores()">Tentar de novo</button>');
  }
}
function desenharGestores(){
  const el = $('#lb-gest'); if (!el) return;
  const souPrincipal = !!lab.eu?.principal;
  el.innerHTML = `${tabelaGestores(lab.gestores, souPrincipal, 'lab')}
    <form class="lb-form-linha" id="f-convidar" novalidate aria-labelledby="h-convidar">
      <h2 id="h-convidar" class="sr">Convidar gestor</h2>
      <div class="fld"><label for="cv-nome">Nome</label><input id="cv-nome" autocomplete="off"></div>
      <div class="fld"><label for="cv-email">E-mail</label><input id="cv-email" type="email" autocomplete="off"></div>
      <button class="btn solid" type="submit" id="cv-btn">Convidar gestor</button>
    </form>
    <p class="lb-msg" id="cv-msg" role="status"></p>`;
  $('#f-convidar').onsubmit = convidar;
}
/* a mesma tabela serve o painel do SOMA (mod-admin.js tem a sua cópia) */
function tabelaGestores(gs, podeAcoes, pf){
  if (!gs.length) return estado.vazio('Nenhum gestor ainda.');
  return `<div class="lb-wrap"><table class="lb-tabela" id="lb-gest-tabela"><thead><tr><th>Nome</th><th>E-mail</th><th>Situação</th>
    <th>Convidado por</th><th>Aceito em</th><th>Último acesso</th>${podeAcoes ? '<th><span class="sr">Ações</span></th>' : ''}</tr></thead>
    <tbody>${gs.map(g => `<tr data-g="${esc(g.id)}">
      <td>${g.principal ? `<span class="estrela">${ESTRELA}</span> ` : ''}${esc(g.nome)}${g.principal ? '<span class="sr"> (Responsável principal)</span>' : ''}</td>
      <td>${esc(g.email)}</td><td>${pillSit(g.situacao)}</td><td>${esc(g.convidado_por || '—')}</td>
      <td>${fmtDT(g.aceito_em)}</td><td>${fmtDT(g.ultimo_acesso)}</td>
      ${podeAcoes ? `<td><div class="lb-acoes">
        ${g.situacao === 'ativo' && !g.principal ? `<button class="btn ghost mini" type="button" onclick="${pf}Estrela('${esc(g.id)}')">Passar a estrela</button>` : ''}
        ${g.situacao !== 'revogado' ? `<button class="btn ghost mini" type="button" onclick="${pf}Revogar('${esc(g.id)}')">Revogar</button>` : ''}
      </div></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}
const MOTIVO_CONVIDAR = {
  email_invalido:'Confira o e-mail.', nome_obrigatorio:'Escreva o nome de quem vai receber o convite.',
  email_de_membro:'Este e-mail é de um membro da NeuroDynamics. Use outro e-mail para o painel.',
  ja_ativo:'Esta pessoa já é gestora do painel.'
};
async function convidar(ev){
  ev.preventDefault();
  const m = $('#cv-msg'), bt = $('#cv-btn'), email = $('#cv-email').value.trim();
  bt.disabled = true; m.classList.remove('ruim'); m.textContent = '';
  try {
    const d = await rpc('labbio_convidar', { p_email:email, p_nome:$('#cv-nome').value.trim() });
    if (d?.status !== 'ok'){ m.classList.add('ruim'); m.textContent = MOTIVO_CONVIDAR[d?.status] || 'Não foi possível convidar agora.'; return; }
    toast(`Convite enviado para ${email}.`);
    await pgGestores();
    const m2 = $('#cv-msg'); if (m2) m2.textContent = `Convite enviado para ${email}.`;
  } catch(e){ if (e.message !== 'sem_acesso'){ m.classList.add('ruim'); m.textContent = 'Não foi possível convidar agora.'; } }
  finally { if (document.body.contains(bt)) bt.disabled = false; }
}
async function labEstrela(id){
  const g = lab.gestores.find(x => x.id === id); if (!g) return;
  if (!await confirma(`Passar a estrela de responsável principal para ${g.nome}?`, 'Passar a estrela')) return;
  try {
    const d = await rpc('labbio_principal', { p_id:id });
    if (d?.status !== 'ok') return toast(d?.status === 'invalido' ? 'Só um gestor ativo pode receber a estrela.' : 'Não foi possível passar a estrela.', true);
    toast(`${g.nome} agora é o responsável principal.`);
    const eu = (await sb.rpc('labbio_eu')).data; if (eu?.status === 'ok') lab.eu = eu.gestor;
    pgGestores();
  } catch(e){ if (e.message !== 'sem_acesso') toast('Não foi possível passar a estrela.', true); }
}
function labRevogar(id){
  const g = lab.gestores.find(x => x.id === id); if (!g) return;
  abreModal(`<h3>Revogar ${esc(g.nome)}</h3><p>O acesso ao painel do LABBIO acaba na hora.</p>
    <div class="fld"><label for="rv-motivo">Motivo (opcional)</label><textarea id="rv-motivo" rows="3"></textarea></div>
    <p class="lb-msg ruim" id="rv-msg"></p>
    <div class="acts"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button>
      <button class="btn danger" type="button" id="rv-ok">Revogar</button></div>`);
  $('#rv-ok').onclick = async () => {
    try {
      const d = await rpc('labbio_revogar', { p_id:id, p_motivo:$('#rv-motivo').value.trim() || null });
      if (d?.status === 'transfira_antes'){ $('#rv-msg').textContent = 'Passe a estrela para outro gestor antes de sair.'; return; }
      if (d?.status !== 'ok'){ $('#rv-msg').textContent = 'Não foi possível revogar.'; return; }
      fechaModal(); toast(`Acesso de ${g.nome} revogado.`);
      if (g.id === lab.eu?.id) return carregarEu();
      pgGestores();
    } catch(e){ if (e.message !== 'sem_acesso') $('#rv-msg').textContent = 'Não foi possível revogar.'; }
  };
}

/* ---------------- os eventos ---------------- */
$('#lb-menu-bt').addEventListener('click', () => {
  const t = $('#lb-topo'), ab = !t.classList.contains('aberto');
  t.classList.toggle('aberto', ab); $('#lb-menu-bt').setAttribute('aria-expanded', String(ab));
});
window.addEventListener('hashchange', () => {
  if (rota().sec === 'aceitar' || !lab.eu) return iniciar();
  desenhar(); window.scrollTo(0, 0); $('#lb-h1')?.focus({ preventScroll:true });
});
sb.auth.onAuthStateChange(ev => { if (ev === 'SIGNED_OUT' && lab.eu){ lab.eu = null; setTimeout(telaLogin, 0); } });
iniciar();
