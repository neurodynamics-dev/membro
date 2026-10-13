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
const marcas = () => `<span class="lb-marcas"><span class="lb-logo" role="img" aria-label="LABBIO"></span><span class="lb-sep" aria-hidden="true"></span>
  <img class="lb-nro lb-nro-escuro" src="../studio/nro-imagotipo-branco.png" alt="NeuroDynamics"><img class="lb-nro lb-nro-claro" src="../studio/nro-imagotipo.png" alt="NeuroDynamics"></span>`;

function abreModal(html, persistente = false){
  $('#lb-modal').dataset.persistente = persistente ? '1' : ''; $('#lb-modal').innerHTML = html; $('#lb-modal').hidden = false; $('#lb-veu').hidden = false;
  $('#lb-modal').querySelector('input,textarea,button')?.focus(); }
function fechaModal(){ $('#lb-modal').dataset.persistente = ''; $('#lb-modal').hidden = true; $('#lb-veu').hidden = true; $('#lb-modal').innerHTML = ''; }
function confirma(texto, rotulo){
  return new Promise(res => {
    abreModal(`<h3>Confirmar</h3><p>${esc(texto)}</p><div class="acts">
      <button class="btn ghost" type="button" id="cf-nao">Cancelar</button><button class="btn solid" type="button" id="cf-sim">${esc(rotulo || 'Confirmar')}</button></div>`);
    $('#cf-nao').onclick = () => { fechaModal(); res(false); };
    $('#cf-sim').onclick = () => { fechaModal(); res(true); };
  });
}
$('#lb-veu').addEventListener('click', () => { if ($('#lb-modal').dataset.persistente !== '1') fechaModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#lb-modal').hidden && $('#lb-modal').dataset.persistente !== '1') fechaModal(); });

/* ---------------- a rota ---------------- */
function rota(){
  const h = (location.hash || '#/').replace(/^#\/?/, '');
  const [cam, q = ''] = h.split('?');
  const [sec = '', sub = ''] = cam.split('/');
  return { sec, sub, q:new URLSearchParams(q) };
}

/* 'admin': o admin do SOMA, com a própria conta de membro (não é gestor nem conta externa) */
const PODE_ENTRAR = ['ok', 'admin'];
/* toda chamada passa por aqui: sem_permissao no meio do uso pode ser revogação */
async function rpc(nome, args){
  const { data, error } = await sb.rpc(nome, args || {});
  if (error) throw error;
  if (data?.status === 'sem_permissao' && nome !== 'labbio_eu'){
    const eu = await sb.rpc('labbio_eu').then(r => r.data, () => null);
    if (!PODE_ENTRAR.includes(eu?.status)){ telaAcesso(eu?.status || 'revogado'); throw new Error('sem_acesso'); }
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
  if (!PODE_ENTRAR.includes(eu?.status)) return telaAcesso(eu?.status || 'erro');
  lab.eu = eu.gestor;
  $('#lb-topo').hidden = false;
  $('#lb-eu-nome').textContent = lab.eu?.nome || '';
  // o admin volta ao SOMA em vez de sair: sair encerraria a sessão do portal também
  $('#lb-voltar').hidden = !lab.eu?.admin; $('#lb-sair-bt').hidden = !!lab.eu?.admin;
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
  ({ '':pgInicio, gestores:pgGestores, membros:pgMembros, checkins:pgCheckins, treinamentos:pgTreinamentos, solicitacoes:pgSolicitacoes, agenda:pgAgenda }[sec] || pgEmBreve)(sec, r.sub);
}
function pgEmBreve(sec){
  const rot = (NAV.find(([k]) => k === sec) || [, 'Painel'])[1];
  $('#lb-main').innerHTML = cabecalho({ titulo:rot }) + estado.vazio('Em breve.');
}

/* gestores: a lista, o convite, a estrela e a revogação */
/* a situação como marca de estado (ícone e texto), sem pill: o mesmo marcador do quadro de membros */
const SIT = { ativo:['ok', 'ok', 'Ativo'], convidado:['warn', 'relogio', 'Convidado'], revogado:['neutro', 'menos', 'Revogado'] };
const pillSit = s => { const [tom, i, t] = SIT[s] || ['neutro', 'menos', s]; return marcaEstado(tom, i, t); };
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
  const souPrincipal = !!(lab.eu?.principal || lab.eu?.admin);  // o banco deixa o admin passar a estrela e revogar
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
    const eu = (await sb.rpc('labbio_eu')).data; if (PODE_ENTRAR.includes(eu?.status)) lab.eu = eu.gestor;
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

/* ============================================================
   CONSULTAS (ficha L4): início com as revogações pendentes, membros
   e perfil, check-ins e a matriz de treinamentos. Só leitura, menos
   a confirmação de que o acesso biométrico foi retirado.
   ============================================================ */
const IC = {
  relogio:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  doc:'<path d="M7 3.5h7l4 4V20.5H7z"/><path d="M13.5 3.5V8h4.5"/>',
  selo:'<circle cx="12" cy="10" r="5.5"/><path d="m9.5 10 1.8 1.8 3.2-3.3M8.5 14.5 7 21l5-2.5 5 2.5-1.5-6.5"/>',
  x:'<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  ok:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  menos:'<path d="M6 12h12"/>',
  alerta:'<path d="M12 4 21 19.5H3z"/><path d="M12 10v4M12 17v.5"/>',
  seta:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  copiar:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
const fmtD = d => d ? new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
const isoDia = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const iniciais = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
/* a foto: a da ficha (foto_url) ou, sem ela, a do repositório de fotos (nro-pessoal/fotos/<registro>.jpg, .jpeg, .png ou
   .webp), a mesma cascata do portal; sem nenhuma, ficam as iniciais, que já estão por baixo da imagem */
const FOTOS_BASE = 'https://raw.githubusercontent.com/neurodynamics-dev/nro-pessoal/refs/heads/main/fotos/';
const FOTO_EXTS = ['jpg', 'jpeg', 'png', 'webp'];
function lbFotoErro(img){
  const i = Number(img.dataset.ext || 0) + 1, reg = img.dataset.reg;
  if (reg && i < FOTO_EXTS.length){ img.dataset.ext = i; img.src = FOTOS_BASE + reg + '.' + FOTO_EXTS[i]; }
  else img.remove();
}
const avatar = (p, t = 30) => {
  const u = p.foto_url || (p.registro != null ? FOTOS_BASE + p.registro + '.jpg' : null);
  const cascata = !p.foto_url && p.registro != null ? ` data-reg="${esc(p.registro)}" data-ext="0"` : '';
  return `<span class="lb-av" style="width:${t}px;height:${t}px" aria-hidden="true">${esc(iniciais(p.nome))}${u
    ? `<img src="${esc(u)}" alt="" loading="lazy"${cascata} onerror="lbFotoErro(this)">` : ''}</span>`;
};
const marcaEstado = (tom, icone, texto) => `<span class="lb-est lb-${tom}">${ic(icone)}<span>${esc(texto)}</span></span>`;
const TERMO = { pendente:['warn', 'relogio', 'Pendente'], enviado:['info', 'doc', 'Enviado'], conferido:['ok', 'selo', 'Conferido'],
                devolvido:['err', 'x', 'Devolvido'], sem_campanha:['neutro', 'menos', 'Sem campanha'] };
const termoHTML = t => { const [tom, i, txt] = TERMO[t?.situacao] || TERMO.sem_campanha; return marcaEstado(tom, i, txt); };
const SUB_PEDIDO = { pessoal:'no Pessoal', labbio:'no LABBIO', devolvido:'devolvido ao membro', rascunho:'em rascunho' };
function acessoHTML(a){
  if (a?.sub === 'revogacao_pendente') return marcaEstado('err', 'alerta', 'Revogação pendente');
  if (a?.estado === 'possui') return marcaEstado('ok', 'ok', 'Possui');
  if (a?.estado === 'solicitado') return marcaEstado('info', 'relogio', 'Solicitado' + (SUB_PEDIDO[a.sub] ? ', ' + SUB_PEDIDO[a.sub] : ''));
  return marcaEstado('neutro', 'menos', 'Não possui');
}
const comBiometria = p => p.acesso?.estado === 'possui' && p.acesso?.sub !== 'revogacao_pendente';
/* o status no quadro, como marca de estado (no lugar da liderança, que fica no perfil) */
const STATUS_MEMBRO = { 'Ativo':['ok', 'ok'], 'Em pausa / avaliação':['warn', 'relogio'], 'Desligado':['neutro', 'menos'], 'Egresso':['neutro', 'menos'] };
const statusHTML = s => { const [tom, i] = STATUS_MEMBRO[s] || ['neutro', 'menos']; return marcaEstado(tom, i, s || '—'); };
const chipTrainee = p => p.trainee ? ' <span class="lb-sub">Trainee</span>' : '';

/* ---------------- início: o dashboard (2.19.2) ----------------
   Uma chamada (labbio_inicio) e quatro blocos: os números do dia, o que espera resposta do LABBIO (pedidos de
   biometria e consultas de sala), o dia no laboratório (eventos e check-ins) e a equipe (presença de 14 dias,
   biometria, termo e treinamentos). As revogações pendentes ficam no alto, antes de tudo. */
const fmtHora = d => new Date(d).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
const fmtDiaCurto = s => { const [a, m, d] = String(s).slice(0, 10).split('-'); return `${d}/${m}`; };
const DIAS_SEM = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
function haQuanto(d){
  const dias = Math.floor((Date.now() - new Date(d).getTime()) / 864e5);
  return dias <= 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
}
function quandoConsulta(c, hoje){
  const amanha = labAgSomar(hoje, 1);
  const dia = c.data === hoje ? 'Hoje' : c.data === amanha ? 'Amanhã' : `${DIAS_SEM[new Date(c.data + 'T12:00:00').getDay()]}, ${fmtDiaCurto(c.data)}`;
  return dia + (c.hora_inicio ? `, ${c.hora_inicio}${c.hora_fim ? '–' + c.hora_fim : ''}` : '');
}
const CONSULTA_EST = { pendente:['warn', 'Consulta sem resposta'], disponivel:['ok', 'Disponível'], conflito:['err', 'Conflito'] };

/* um número do topo: rótulo, valor, apoio e o destino */
const kpi = (href, rot, num, apoio, tom = '') => `<a class="lb-kpi${tom ? ' ' + tom : ''}" href="${href}"><section class="widget">
  <header><span class="w-rot">${esc(rot)}</span></header><div class="w-corpo"><span class="w-num">${num}</span>${apoio ? `<span class="lb-kpi-apoio">${apoio}</span>` : ''}</div></section></a>`;

/* barra empilhada com legenda (biometria, termo) */
function empilhada(id, rot, partes){
  const total = partes.reduce((t, [, n]) => t + n, 0);
  if (!total) return '';
  return `<div class="lb-emp" id="${id}"><p class="lb-emp-rot">${esc(rot)}</p>
    <div class="lb-emp-barra" role="img" aria-label="${esc(rot + ': ' + partes.map(([n, v]) => `${v} ${n.toLowerCase()}`).join(', '))}">${
      partes.filter(([, n]) => n).map(([, n, tom]) => `<span class="lb-${tom}" style="flex:${n}"></span>`).join('')}</div>
    <ul class="lb-emp-leg">${partes.map(([n, v, tom]) => `<li><i class="lb-${tom}" aria-hidden="true"></i>${esc(n)} <b>${v}</b></li>`).join('')}</ul></div>`;
}

/* presença dos últimos 14 dias, em colunas (com a tabela para leitor de tela) */
function seriePresenca(serie){
  if (!serie?.length) return '';
  const max = Math.max(1, ...serie.map(x => Number(x.pessoas) || 0));
  const col = x => { const n = Number(x.pessoas) || 0, d = new Date(x.dia + 'T12:00:00'), fds = [0, 6].includes(d.getDay());
    return `<li class="${fds ? 'fds' : ''}" title="${esc(fmtDiaCurto(x.dia))}: ${n} ${n === 1 ? 'pessoa' : 'pessoas'}">
      <span class="lb-col-n">${n || ''}</span><span class="lb-col" style="height:${Math.round(n / max * 100)}%"></span>
      <span class="lb-col-d">${d.getDate()}</span></li>`; };
  const media = serie.reduce((t, x) => t + (Number(x.pessoas) || 0), 0) / serie.length;
  return `<div class="lb-serie"><ol aria-hidden="true">${serie.map(col).join('')}</ol>
    <p class="lb-serie-pe">Média de ${media.toLocaleString('pt-BR', { maximumFractionDigits:1 })} ${media === 1 ? 'pessoa' : 'pessoas'} por dia, contando fins de semana.</p>
    <table class="lb-sr"><caption>Pessoas por dia</caption><tbody>${serie.map(x => `<tr><th>${esc(fmtDiaCurto(x.dia))}</th><td>${Number(x.pessoas) || 0}</td></tr>`).join('')}</tbody></table></div>`;
}

async function pgInicio(){
  $('#lb-main').innerHTML = cabecalho({ titulo:'Início', lead:'O dia no LABBIO: o que espera resposta, quem está no laboratório e a situação da equipe.' })
    + `<div id="lb-ini">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_inicio');
    if (d?.status !== 'ok') throw new Error(d?.status);
    lab.revogacoes = d.revogacoes || [];
    const el = $('#lb-ini'); if (!el) return;
    el.innerHTML = dashboard(d);
  } catch(e){
    if (e.message === 'sem_acesso') return;
    $('#lb-ini').innerHTML = estado.erro('Não foi possível carregar o início.', '<button class="btn ghost mini" type="button" onclick="pgInicio()">Tentar de novo</button>');
  }
}
function dashboard(d){
  const n = v => Number(v) || 0;
  const hoje = d.hoje_data || isoDia(new Date()), h = d.hoje || {};
  const membros = n(d.membros), comAcesso = n(d.com_acesso), ped = n(d.pedidos_abertos), cons = n(d.consultas_pendentes), pres = n(h.presentes);
  const pedidos = d.pedidos || [], consultas = d.consultas || [], eventos = h.eventos || [], ultimos = h.ultimos || [];

  const kpis = `<div class="lb-kpis">
    ${kpi('#/solicitacoes', 'Pedidos para analisar', ped, ped ? 'Esperando o LABBIO' : 'Nada pendente', ped ? 'atencao' : '')}
    ${kpi('#/agenda', 'Consultas de sala', cons, cons ? 'Sem resposta' : 'Todas respondidas', cons ? 'atencao' : '')}
    ${kpi('#/checkins', 'No LABBIO hoje', pres, pres === 1 ? 'pessoa com check-in' : 'pessoas com check-in')}
    ${kpi('#/membros', 'Com biometria', comAcesso, `de ${membros} ${membros === 1 ? 'membro ativo' : 'membros ativos'}`)}
  </div>`;

  const itensPedido = pedidos.map(p => `<li><a class="lb-fila-item" href="#/solicitacoes/${esc(p.id)}">${avatar(p, 32)}
      <span class="lb-fila-tx"><b>${esc(p.nome)}</b><small>Acesso biométrico, encaminhado ${esc(haQuanto(p.encaminhado_em))}</small></span>${ic('seta')}</a></li>`);
  const itensConsulta = consultas.map(c => `<li><a class="lb-fila-item" href="#/agenda"><span class="lb-fila-ic" aria-hidden="true">${ic('relogio')}</span>
      <span class="lb-fila-tx"><b>${esc(c.titulo)}</b><small>${esc(c.espaco)}, ${esc(quandoConsulta(c, hoje))}</small></span>${ic('seta')}</a></li>`);
  const restoPed = ped - pedidos.length, restoCons = cons - consultas.length;
  const fila = `<section class="card lb-bloco" aria-labelledby="lb-b-fila"><header class="lb-bloco-cab"><h2 id="lb-b-fila">Para responder</h2>
      ${ped + cons ? `<span class="lb-bloco-total">${ped + cons} ${ped + cons === 1 ? 'item' : 'itens'}</span>` : ''}</header>
    ${ped + cons === 0 ? `<p class="lb-vazio">${ic('ok')} Nada esperando o LABBIO.</p>` : `
      ${pedidos.length ? `<h3 class="lb-bloco-sub">Pedidos de biometria</h3><ul class="lb-fila">${itensPedido.join('')}</ul>
        ${restoPed > 0 ? `<a class="lb-mais" href="#/solicitacoes">Mais ${restoPed} ${restoPed === 1 ? 'pedido' : 'pedidos'}</a>` : ''}` : ''}
      ${consultas.length ? `<h3 class="lb-bloco-sub">Consultas de sala</h3><ul class="lb-fila">${itensConsulta.join('')}</ul>
        ${restoCons > 0 ? `<a class="lb-mais" href="#/agenda">Mais ${restoCons} ${restoCons === 1 ? 'consulta' : 'consultas'}</a>` : ''}` : ''}`}
  </section>`;

  const evHTML = eventos.length ? `<ul class="lb-dia">${eventos.map(e => { const [tom, txt] = CONSULTA_EST[e.consulta] || [];
      return `<li><span class="mono lb-dia-hora">${esc(e.hora_inicio || 'Dia todo')}${e.hora_fim ? '<br>' + esc(e.hora_fim) : ''}</span>
        <span class="lb-fila-tx"><b>${esc(e.titulo)}</b><small>${esc(e.espaco)}${tom ? ` <span class="lb-est lb-${tom}">${esc(txt)}</span>` : ''}</small></span></li>`; }).join('')}</ul>`
    : '<p class="lb-vazio">Nenhum evento hoje nas salas do LABBIO.</p>';
  const chegadas = ultimos.length ? `<ul class="lb-chegadas">${ultimos.map(u => `<li><a href="#/membros/${esc(u.registro)}">${avatar(u, 28)}<span>${esc(u.nome)}</span><time class="mono">${esc(fmtHora(u.registrado_em))}</time></a></li>`).join('')}</ul>
      ${pres > ultimos.length ? `<a class="lb-mais" href="#/checkins">Ver os ${pres} check-ins de hoje</a>` : ''}`
    : '<p class="lb-vazio">Ninguém fez check-in hoje.</p>';
  const dia = `<section class="card lb-bloco" aria-labelledby="lb-b-dia"><header class="lb-bloco-cab"><h2 id="lb-b-dia">Hoje no LABBIO</h2>
      <a class="lb-bloco-link" href="#/agenda">Agenda</a></header>
    <h3 class="lb-bloco-sub">Salas</h3>${evHTML}
    <h3 class="lb-bloco-sub">Últimos check-ins</h3>${chegadas}</section>`;

  const ac = d.acesso || {}, te = d.termo, trein = n(d.treinamentos_pendentes);
  const equipe = `<section class="card lb-bloco lb-larga" aria-labelledby="lb-b-eq"><header class="lb-bloco-cab"><h2 id="lb-b-eq">Equipe</h2>
      <a class="lb-bloco-link" href="#/membros">Membros</a></header>
    <div class="lb-eq">
      <div><h3 class="lb-bloco-sub">Presença nos últimos 14 dias</h3>${seriePresenca(d.serie) || '<p class="lb-vazio">Sem dados de presença.</p>'}</div>
      <div class="lb-eq-dir">
        ${empilhada('lb-emp-bio', 'Acesso biométrico', [['Possui', n(ac.possui), 'ok'], ['Pedido em andamento', n(ac.solicitado), 'info'], ['Não possui', n(ac.nao_possui), 'neutro']])}
        ${te ? empilhada('lb-emp-termo', 'Termo de sigilo', [['Conferido', n(te.conferido), 'ok'], ['Enviado', n(te.enviado), 'info'], ['Pendente', n(te.pendente), 'warn'], ['Devolvido', n(te.devolvido), 'err']])
             : '<p class="lb-vazio">Sem campanha do termo de sigilo aberta.</p>'}
        <a class="lb-trein${trein ? ' atencao' : ''}" href="#/treinamentos">${ic(trein ? 'alerta' : 'selo')}<span>${trein
          ? `<b>${trein}</b> ${trein === 1 ? 'pessoa com treinamento obrigatório em aberto' : 'pessoas com treinamento obrigatório em aberto'}`
          : 'Treinamentos obrigatórios em dia'}</span>${ic('seta')}</a>
      </div>
    </div></section>`;

  return `<div id="lb-rev">${faixasRevogacao()}</div>${kpis}<div class="lb-dash">${fila}${dia}${equipe}</div>`;
}
function faixasRevogacao(){
  return (lab.revogacoes || []).map(v => `<div class="aviso-box warn lb-rev" id="lb-rev-${esc(v.id)}">
      <span>${esc(v.nome)} saiu da equipe (${esc(v.status_para)}, em ${fmtD(v.criada_em)}). Retire o acesso biométrico na Intelbras e confirme aqui.</span>
      <button class="btn ghost mini" type="button" onclick="labRevConfirmar('${esc(v.id)}')">Confirmar a retirada</button></div>`).join('');
}
function labRevConfirmar(id){
  const v = (lab.revogacoes || []).find(x => x.id === id); if (!v) return;
  abreModal(`<h3>Retirada do acesso de ${esc(v.nome)}</h3><p>Confirme só depois de retirar a biometria na Intelbras.</p>
    <div class="fld"><label for="rvc-obs">Observação (opcional)</label><textarea id="rvc-obs" rows="3"></textarea></div>
    <p class="lb-msg ruim" id="rvc-msg"></p>
    <div class="acts"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" type="button" id="rvc-ok">Confirmar a retirada</button></div>`);
  $('#rvc-ok').onclick = async () => {
    try {
      const d = await rpc('labbio_revogacao_confirmar', { p_id:id, p_observacao:$('#rvc-obs').value.trim() || null });
      if (d?.status !== 'ok'){ $('#rvc-msg').textContent = 'Não foi possível confirmar agora.'; return; }
      fechaModal(); toast('Retirada confirmada.');
      lab.revogacoes = lab.revogacoes.filter(x => x.id !== id);
      const el = $('#lb-rev'); if (el) el.innerHTML = faixasRevogacao();
    } catch(e){ if (e.message !== 'sem_acesso') $('#rvc-msg').textContent = 'Não foi possível confirmar agora.'; }
  };
}

/* ---------------- membros ---------------- */
const FILTROS_MEMBROS = [['todos', 'Todos', () => true], ['com', 'Com biometria', comBiometria],
  ['pedido', 'Pedido em andamento', p => p.acesso?.estado === 'solicitado'],
  ['sem', 'Sem biometria', p => p.acesso?.estado === 'nao_possui'],
  ['termo', 'Termo pendente', p => ['pendente', 'devolvido'].includes(p.termo?.situacao)]];
const labM = { busca:'', filtro:'todos', lista:[], timer:null, vez:0, sel:new Set(), pessoas:new Map(), tipoEmail:'nro' };
async function pgMembros(sec, sub){
  if (sub) return pgPerfil(Number(sub));
  $('#lb-main').innerHTML = cabecalho({ titulo:'Membros', lead:'Quem tem vínculo com o laboratório: o termo de sigilo e o acesso biométrico.' }) + `
    <div class="lb-ferr">
      <div class="fld lb-busca"><label for="lb-m-busca">Buscar</label><input id="lb-m-busca" type="search" value="${esc(labM.busca)}" placeholder="Nome ou registro" autocomplete="off"></div>
      <div class="seg" role="group" aria-label="Filtrar membros">${FILTROS_MEMBROS.map(([k, l]) =>
        `<button type="button" data-f="${k}" aria-pressed="${labM.filtro === k}" class="${labM.filtro === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div>
    </div>
    <div id="lb-m-lista">${estado.carregando()}</div>`;
  $('#lb-m-busca').addEventListener('input', e => { labM.busca = e.target.value; clearTimeout(labM.timer); labM.timer = setTimeout(carregarMembros, 300); });
  document.querySelectorAll('.lb-ferr .seg button').forEach(b => b.onclick = () => {
    labM.filtro = b.dataset.f;
    document.querySelectorAll('.lb-ferr .seg button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    desenharMembros();
  });
  await carregarMembros();
}
async function carregarMembros(){
  const vez = ++labM.vez;
  try {
    const d = await rpc('labbio_membros', { p_busca: labM.busca.trim() || null });
    if (vez !== labM.vez) return;
    if (d?.status !== 'ok') throw new Error(d?.status);
    labM.lista = d.membros || []; desenharMembros();
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#lb-m-lista'); if (el) el.innerHTML = estado.erro('Não foi possível carregar os membros.', '<button class="btn ghost mini" type="button" onclick="carregarMembros()">Tentar de novo</button>');
  }
}
function desenharMembros(){
  const el = $('#lb-m-lista'); if (!el) return;
  const f = (FILTROS_MEMBROS.find(([k]) => k === labM.filtro) || FILTROS_MEMBROS[0])[2];
  const ms = labM.lista.filter(f);
  labM.lista.forEach(p => labM.pessoas.set(p.registro, p));   // a seleção vale entre buscas e filtros
  const marcados = ms.filter(p => labM.sel.has(p.registro)).length;
  el.innerHTML = ms.length ? `<p class="lb-total" aria-live="polite"><b>${ms.length}</b> ${ms.length === 1 ? 'pessoa' : 'pessoas'}</p>
    <div id="lb-m-sel">${barraSelecao()}</div>
    <div class="lb-wrap"><table class="lb-tabela" id="lb-m-tabela"><thead><tr>
      <th class="c-sel"><input type="checkbox" id="lb-m-todos" aria-label="Selecionar todos desta lista"${marcados && marcados === ms.length ? ' checked' : ''}></th><th>Membro</th><th>Área</th><th>Status</th><th>Termo</th><th>Acesso</th></tr></thead>
    <tbody>${ms.map(p => `<tr data-reg="${p.registro}"${labM.sel.has(p.registro) ? ' class="sel"' : ''}>
      <td class="c-sel"><input type="checkbox" data-sel="${p.registro}" aria-label="Selecionar ${esc(p.nome)}"${labM.sel.has(p.registro) ? ' checked' : ''}></td>
      <td><a class="lb-pessoa" href="#/membros/${p.registro}">${avatar(p)}<span>${esc(p.nome)}</span></a>${chipTrainee(p)}</td>
      <td>${esc(p.area || '—')}</td><td class="c-status">${statusHTML(p.status)}</td>
      <td class="c-termo">${termoHTML(p.termo)}</td><td class="c-acesso">${acessoHTML(p.acesso)}</td></tr>`).join('')}</tbody></table></div>`
    : estado.vazio('Ninguém com este filtro.');
  const todos = $('#lb-m-todos'); if (todos) todos.indeterminate = marcados > 0 && marcados < ms.length;
  if (!el.dataset.ligado){
    el.dataset.ligado = '1';
    el.addEventListener('change', e => {
      const c = e.target;
      if (c.id === 'lb-m-todos'){
        const f2 = (FILTROS_MEMBROS.find(([k]) => k === labM.filtro) || FILTROS_MEMBROS[0])[2];
        labM.lista.filter(f2).forEach(p => c.checked ? labM.sel.add(p.registro) : labM.sel.delete(p.registro));
        desenharMembros();
      } else if (c.dataset.sel){
        const r = Number(c.dataset.sel); c.checked ? labM.sel.add(r) : labM.sel.delete(r);
        c.closest('tr')?.classList.toggle('sel', c.checked);
        const t = $('#lb-m-todos'), vis = [...el.querySelectorAll('[data-sel]')], n = vis.filter(x => x.checked).length;
        if (t){ t.checked = n === vis.length; t.indeterminate = n > 0 && n < vis.length; }
        $('#lb-m-sel').innerHTML = barraSelecao();
      } else if (c.id === 'lb-m-tipo'){ labM.tipoEmail = c.value; $('#lb-m-sel').innerHTML = barraSelecao(); }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-sel-acao]'); if (!b) return;
      const { lista } = emailsSelecionados();
      if (b.dataset.selAcao === 'copiar') labCopiar(lista.join(', '));
      else if (b.dataset.selAcao === 'limpar'){ labM.sel.clear(); desenharMembros(); }
    });
  }
}
/* a lista de e-mails dos marcados: o da NRO, o pessoal ou os dois; quem não tem o e-mail escolhido aparece à parte */
function emailsSelecionados(){
  const ps = [...labM.sel].map(r => labM.pessoas.get(r)).filter(Boolean);
  const de = p => labM.tipoEmail === 'pessoal' ? [p.email_pessoal] : labM.tipoEmail === 'ambos' ? [p.email_nro, p.email_pessoal] : [p.email_nro];
  const lista = [...new Set(ps.flatMap(p => de(p).filter(Boolean).map(x => String(x).trim().toLowerCase())))];
  const sem = ps.filter(p => !de(p).some(Boolean)).map(p => p.nome);
  return { ps, lista, sem };
}
function barraSelecao(){
  const { ps, lista, sem } = emailsSelecionados();
  if (!ps.length) return '';
  const mailto = 'mailto:?bcc=' + encodeURIComponent(lista.join(','));
  return `<div class="lb-selbar" role="region" aria-label="Membros selecionados">
    <span class="lb-selbar-n"><b>${ps.length}</b> ${ps.length === 1 ? 'selecionado' : 'selecionados'}</span>
    <div class="fld"><label for="lb-m-tipo" class="lb-sr">Qual e-mail</label><select id="lb-m-tipo">
      ${[['nro', 'E-mail da NRO'], ['pessoal', 'E-mail pessoal'], ['ambos', 'Os dois']].map(([k, r]) => `<option value="${k}"${labM.tipoEmail === k ? ' selected' : ''}>${r}</option>`).join('')}</select></div>
    <button type="button" class="btn solid mini" data-sel-acao="copiar"${lista.length ? '' : ' disabled'}>${ic('copiar')} Copiar ${lista.length} ${lista.length === 1 ? 'e-mail' : 'e-mails'}</button>
    ${lista.length ? `<a class="btn ghost mini" href="${esc(mailto)}">Escrever para eles (Cco)</a>` : ''}
    <button type="button" class="btn ghost mini" data-sel-acao="limpar">Limpar a seleção</button>
    ${sem.length ? `<p class="lb-selbar-sem">Sem esse e-mail: ${esc(sem.join(', '))}.</p>` : ''}
    ${lista.length ? `<textarea class="lb-selbar-lista" readonly rows="2" aria-label="Lista de e-mails">${esc(lista.join(', '))}</textarea>` : ''}</div>`;
}
async function pgPerfil(reg){
  $('#lb-main').innerHTML = `<a class="lb-voltar" href="#/membros">← Membros</a><div id="lb-perfil">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_membro', { p_registro:reg });
    const el = $('#lb-perfil'); if (!el) return;
    if (d?.status === 'nao_encontrado'){ el.innerHTML = estado.vazio('Esta pessoa não está na lista do LABBIO.'); return; }
    if (d?.status !== 'ok') throw new Error(d?.status);
    const m = d.membro; lab.perfil = m;
    const spec = (k, v) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`;
    const termoArq = m.termo?.arquivo && ['enviado', 'conferido'].includes(m.termo?.situacao);
    el.innerHTML = cabecalho({ titulo:m.nome }) + `<div class="lb-objeto">
      <div class="lb-principal">
        <section class="lb-bloco"><h2>Contato</h2><dl class="lb-dados">
          ${campoCopiar('Nome', m.nome, { mono:false })}${campoCopiar('Registro', String(m.registro).padStart(3, '0'))}
          ${campoCopiar('E-mail da NRO', m.email_nro)}${campoCopiar('E-mail pessoal', m.email_pessoal)}${campoCopiar('Telefone', m.telefone)}
        </dl></section>
        <section class="lb-bloco"><h2>Na equipe</h2><dl class="lb-spec">
          ${spec('Área', esc(m.area || '—'))}${spec('Cargo', esc(m.cargo || '—') + chipTrainee(m))}
          ${spec('Liderança', m.gestor ? `<a href="#/membros/${Number(m.gestor)}">${esc(m.gestor_nome || '—')}</a>` : '—')}
          ${spec('Liderados', (d.liderados || []).length ? d.liderados.map(l => `<a href="#/membros/${Number(l.registro)}">${esc(l.nome)}</a>`).join(', ') : '—')}
        </dl></section>
        <section class="lb-bloco"><h2>Termo de sigilo</h2><p>${termoHTML(m.termo)}
          ${m.termo?.enviado_em ? `<span class="lb-sub">enviado em ${fmtD(m.termo.enviado_em)}</span>` : ''}
          ${m.termo?.conferido_em ? `<span class="lb-sub">conferido em ${fmtD(m.termo.conferido_em)}</span>` : ''}</p>
          ${termoArq ? '<button class="btn ghost mini" type="button" id="lb-termo-abrir">Abrir o termo assinado ↗</button>' : ''}
          ${lab.eu?.admin && m.termo && m.termo.situacao !== 'sem_campanha' ? `<div class="lb-termo-up">
            <p class="lb-sub">Admin: envie o termo assinado por ${esc(m.nome.split(' ')[0])}. A pessoa é avisada e o Pessoal confere.</p>
            <label class="btn ghost mini">Escolher o PDF<input type="file" id="lb-termo-arq" accept="application/pdf,.pdf" hidden></label>
            <label class="lb-check"><input type="checkbox" id="lb-termo-ja" checked> É um termo que a pessoa já tinha</label>
            <span class="lb-sub" id="lb-termo-nome" role="status"></span>
            <button class="btn solid mini" type="button" id="lb-termo-enviar" disabled>Enviar o termo</button></div>` : ''}</section>
        <section class="lb-bloco"><h2>Pedidos de biometria</h2>${(d.pedidos || []).length
          ? `<ul class="lb-lista">${d.pedidos.map(p => `<li><a href="#/solicitacoes/${esc(p.id)}">${esc(p.protocolo || 'Pedido')}</a> <span class="lb-sub">${esc(p.etapa)}, atualizado em ${fmtD(p.atualizado_em)}</span></li>`).join('')}</ul>`
          : '<p class="lb-sub">Nenhum pedido.</p>'}</section>
        <section class="lb-bloco"><h2>Revogações</h2>${(d.revogacoes || []).length
          ? `<ul class="lb-lista">${d.revogacoes.map(v => `<li>${esc(v.status_de || '')} → ${esc(v.status_para || '')}, em ${fmtD(v.criada_em)}: ${v.confirmada_em
              ? `retirada confirmada em ${fmtD(v.confirmada_em)}${v.confirmada_por ? ' por ' + esc(v.confirmada_por) : ''}${v.observacao ? ` (${esc(v.observacao)})` : ''}` : '<b>retirada pendente</b>'}</li>`).join('')}</ul>`
          : '<p class="lb-sub">Nenhuma.</p>'}</section>
      </div>
      <aside class="lb-lateral">${avatar(m, 112)}<div class="lb-acesso-dest"><span class="w-rot">Acesso biométrico</span>${acessoHTML(m.acesso)}
        ${m.acesso?.desde ? `<span class="lb-sub">desde ${fmtD(m.acesso.desde)}</span>` : ''}</div></aside>
    </div>`;
    $('#lb-termo-abrir')?.addEventListener('click', () => abrirTermo(m.termo.arquivo));
    ligarEnvioTermo(m);
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#lb-perfil'); if (el) el.innerHTML = estado.erro('Não foi possível carregar o perfil.', `<button class="btn ghost mini" type="button" onclick="pgPerfil(${reg})">Tentar de novo</button>`);
  }
}
/* 2.19.2: o admin envia o termo por um membro (o banco confere que é admin e grava na pasta da pessoa) */
function ligarEnvioTermo(m){
  const arq = $('#lb-termo-arq'); if (!arq) return;
  let escolhido = null;
  arq.addEventListener('change', async () => {
    const f = arq.files?.[0]; escolhido = null; $('#lb-termo-enviar').disabled = true;
    if (!f) return;
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (f.size > 10 * 1024 * 1024) { $('#lb-termo-nome').textContent = 'O arquivo passa de 10 MB.'; return; }
    if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') { $('#lb-termo-nome').textContent = 'Este arquivo não é um PDF.'; return; }
    escolhido = { f, bytes }; $('#lb-termo-nome').textContent = `${f.name}, ${(f.size / 1024).toFixed(0)} KB`; $('#lb-termo-enviar').disabled = false;
  });
  $('#lb-termo-enviar').addEventListener('click', async () => {
    if (!escolhido) return;
    const b = $('#lb-termo-enviar'); b.disabled = true;
    try {
      const c = await rpc('termo_admin_caminho', { p_registro:m.registro });
      if (c?.status !== 'ok') throw new Error({ sem_campanha:'não há campanha do termo aberta', sem_permissao:'só o admin envia por outra pessoa' }[c?.status] || c?.status);
      const up = await sb.storage.from('termos').upload(c.caminho, escolhido.f, { contentType:'application/pdf', upsert:false });
      if (up.error) throw up.error;
      const h = await crypto.subtle.digest('SHA-256', escolhido.bytes);
      const sha = [...new Uint8Array(h)].map(x => x.toString(16).padStart(2, '0')).join('');
      const r = await rpc('termo_registrar_envio_admin', { p_registro:m.registro, p_arquivo:c.caminho, p_sha256:sha, p_bytes:escolhido.bytes.length, p_existente:$('#lb-termo-ja').checked });
      if (r?.status !== 'ok') throw new Error(r?.status);
      toast('Termo enviado. A pessoa foi avisada e o Pessoal confere.');
      pgPerfil(m.registro);
    } catch(e){ toast('Não foi possível enviar o termo: ' + (e.message || e), true); b.disabled = false; }
  });
}
/* o termo abre em nova guia por um link assinado de 2 minutos; o caminho nunca aparece */
async function abrirTermo(arquivo){
  const w = window.open('', '_blank');
  try {
    const { data, error } = await sb.storage.from('termos').createSignedUrl(arquivo, 120);
    if (error || !data?.signedUrl) throw error || new Error('sem link');
    if (w){ w.opener = null; w.location.href = data.signedUrl; } else location.href = data.signedUrl;
  } catch(_){ if (w) w.close(); toast('Não foi possível abrir o termo agora.', true); }
}

/* ---------------- check-ins ---------------- */
const labC = { de:'', ate:'', reg:'', origem:'', pagina:1, membros:null };
async function pgCheckins(){
  if (!labC.de){ const hoje = new Date(); labC.ate = isoDia(hoje); labC.de = isoDia(Date.now() - 7 * 864e5); }
  if (!labC.membros) try { labC.membros = (await rpc('labbio_membros', {}))?.membros || []; } catch(e){ if (e.message === 'sem_acesso') return; labC.membros = []; }
  $('#lb-main').innerHTML = cabecalho({ titulo:'Check-ins' }) + `<div class="lb-objeto">
    <div class="lb-principal">
      <div class="lb-ferr">
        <div class="fld"><label for="ck-de">De</label><input id="ck-de" type="date" value="${esc(labC.de)}"></div>
        <div class="fld"><label for="ck-ate">Até</label><input id="ck-ate" type="date" value="${esc(labC.ate)}"></div>
        <div class="fld"><label for="ck-reg">Pessoa</label><select id="ck-reg"><option value="">Todas</option>${labC.membros.map(m =>
          `<option value="${m.registro}"${String(m.registro) === String(labC.reg) ? ' selected' : ''}>${esc(m.nome)}</option>`).join('')}</select></div>
        <div class="seg" role="group" aria-label="Origem">${[['', 'Todas'], ['quiosque', 'Quiosque'], ['folha', 'Folha']].map(([k, l]) =>
          `<button type="button" data-o="${k}" aria-pressed="${labC.origem === k}" class="${labC.origem === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      </div>
      <div id="ck-lista">${estado.carregando()}</div>
    </div>
    <aside class="lb-lateral lb-nota"><p>O check-in é o registro de chegada no LABBIO, feito pelo QR que gira no quiosque ou pela folha impressa na entrada. Não é registro da catraca nem acompanhamento contínuo: mostra quando a pessoa disse que chegou.</p></aside>
  </div>`;
  const mudou = () => { labC.pagina = 1; carregarCheckins(); };
  $('#ck-de').onchange = e => { labC.de = e.target.value; mudou(); };
  $('#ck-ate').onchange = e => { labC.ate = e.target.value; mudou(); };
  $('#ck-reg').onchange = e => { labC.reg = e.target.value; mudou(); };
  document.querySelectorAll('[data-o]').forEach(b => b.onclick = () => {
    labC.origem = b.dataset.o;
    document.querySelectorAll('[data-o]').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', String(x === b)); });
    mudou();
  });
  await carregarCheckins();
}
async function carregarCheckins(){
  const el = $('#ck-lista'); if (!el) return;
  try {
    const d = await rpc('labbio_checkins', { p_de:labC.de, p_ate:labC.ate, p_registro: labC.reg ? Number(labC.reg) : null,
      p_origem: labC.origem || null, p_pagina:labC.pagina });
    if (d?.status === 'invalido'){ el.innerHTML = estado.erro('Confira o período: o fim vem depois do começo, e no máximo um ano.'); return; }
    if (d?.status !== 'ok') throw new Error(d?.status);
    const pags = Math.max(1, Math.ceil((d.total || 0) / (d.por_pagina || 50)));
    el.innerHTML = (d.itens || []).length ? `<p class="lb-total" aria-live="polite"><b>${d.total}</b> check-ins</p>
      <div class="lb-wrap"><table class="lb-tabela" id="ck-tabela"><thead><tr><th>Pessoa</th><th>Data e hora</th><th>Origem</th></tr></thead>
      <tbody>${d.itens.map(x => `<tr><td>${esc(x.nome)}</td><td>${fmtDT(x.registrado_em)}</td><td>${x.origem === 'folha' ? 'Folha' : 'Quiosque'}</td></tr>`).join('')}</tbody></table></div>
      <div class="lb-pag"><button class="btn ghost mini" type="button" id="ck-ant" ${d.pagina <= 1 ? 'disabled' : ''}>Anterior</button>
        <span id="ck-pag">Página ${d.pagina} de ${pags}</span>
        <button class="btn ghost mini" type="button" id="ck-prox" ${d.pagina >= pags ? 'disabled' : ''}>Próxima</button></div>`
      : estado.vazio('Nenhum check-in neste período.');
    $('#ck-ant')?.addEventListener('click', () => { labC.pagina--; carregarCheckins(); });
    $('#ck-prox')?.addEventListener('click', () => { labC.pagina++; carregarCheckins(); });
  } catch(e){
    if (e.message === 'sem_acesso') return;
    el.innerHTML = estado.erro('Não foi possível carregar os check-ins.', '<button class="btn ghost mini" type="button" onclick="carregarCheckins()">Tentar de novo</button>');
  }
}

/* ---------------- treinamentos ---------------- */
const SIT_TRE = { concluido:['ok', 'ok', 'Em dia'], andamento:['info', 'relogio', 'Em andamento'], pendente:['warn', 'relogio', 'Pendente'],
                  nova_revisao:['warn', 'doc', 'Nova revisão'], vencido:['err', 'alerta', 'Vencido'] };
const labT = { dados:null, area:'', tre:'', soPend:false };
const pendencia = c => c && c.obrigatorio === true && ['pendente', 'vencido', 'nova_revisao'].includes(c.situacao);
async function pgTreinamentos(){
  $('#lb-main').innerHTML = cabecalho({ titulo:'Treinamentos' }) + `<div id="tr-corpo">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_treinamentos');
    if (d?.status !== 'ok') throw new Error(d?.status);
    labT.dados = d; desenharTreinamentos();
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#tr-corpo'); if (el) el.innerHTML = estado.erro('Não foi possível carregar os treinamentos.', '<button class="btn ghost mini" type="button" onclick="pgTreinamentos()">Tentar de novo</button>');
  }
}
function desenharTreinamentos(){
  const el = $('#tr-corpo'); if (!el || !labT.dados) return;
  const { treinamentos:ts, pessoas } = labT.dados;
  const areas = [...new Set(pessoas.map(p => p.area).filter(Boolean))].sort();
  const cols = ts.filter(t => !labT.tre || t.id === labT.tre);
  const linhas = pessoas.filter(p => (!labT.area || p.area === labT.area) && (!labT.soPend || cols.some(t => pendencia(p.celulas?.[t.id]))));
  const celula = (c, t) => {
    if (!c || !c.situacao) return '<td class="tr-c"><span class="sr">Sem situação</span></td>';
    const [tom, i, txt] = SIT_TRE[c.situacao] || ['neutro', 'menos', c.situacao];
    const det = [c.concluido_em ? 'concluído em ' + fmtD(c.concluido_em) : null, c.revisao ? 'revisão ' + c.revisao : null,
                 c.vence_em ? 'vale até ' + fmtD(c.vence_em) : null].filter(Boolean).join(', ') || txt;
    return `<td class="tr-c"><span class="lb-est lb-${tom}" tabindex="0" title="${esc(det)}" aria-label="${esc(t.codigo + ': ' + txt + (c.obrigatorio ? ', obrigatório' : '') + '. ' + det)}">${ic(i)}<span>${esc(txt)}</span>${c.obrigatorio
      ? '<i class="tr-obrig" aria-hidden="true"></i>' : ''}</span></td>`;
  };
  el.innerHTML = `<p class="lb-nota-curta">Concluir um módulo de leitura não é certificação. A validade vem do treinamento; o conteúdo e as provas ficam com a equipe da NeuroDynamics.</p>
    <div class="lb-ferr">
      <div class="fld"><label for="tr-area">Área</label><select id="tr-area"><option value="">Todas</option>${areas.map(a => `<option${a === labT.area ? ' selected' : ''}>${esc(a)}</option>`).join('')}</select></div>
      <div class="fld"><label for="tr-tre">Treinamento</label><select id="tr-tre"><option value="">Todos</option>${ts.map(t => `<option value="${esc(t.id)}"${t.id === labT.tre ? ' selected' : ''}>${esc(t.codigo)}</option>`).join('')}</select></div>
      <button type="button" class="btn ghost mini${labT.soPend ? ' on' : ''}" id="tr-pend" aria-pressed="${labT.soPend}">Só pendências</button>
    </div>
    <p class="lb-sub"><i class="tr-obrig" aria-hidden="true"></i> obrigatório para a pessoa</p>
    ${linhas.length ? `<div class="lb-wrap tr-wrap"><table class="lb-tabela tr-matriz" id="tr-tabela"><thead><tr><th class="tr-fixa">Pessoa</th>${cols.map(t =>
      `<th title="${esc(t.titulo)}"><abbr title="${esc(t.titulo)}">${esc(t.codigo)}</abbr></th>`).join('')}</tr></thead>
      <tbody>${linhas.map(p => `<tr data-reg="${p.registro}"><th class="tr-fixa" scope="row"><a href="#/membros/${p.registro}">${esc(p.nome)}</a><span class="lb-sub">${esc(p.area || '')}</span></th>
        ${cols.map(t => celula(p.celulas?.[t.id], t)).join('')}</tr>`).join('')}</tbody></table></div>`
      : estado.vazio('Ninguém com este filtro.')}`;
  $('#tr-area').onchange = e => { labT.area = e.target.value; desenharTreinamentos(); };
  $('#tr-tre').onchange = e => { labT.tre = e.target.value; desenharTreinamentos(); };
  $('#tr-pend').onclick = () => { labT.soPend = !labT.soPend; desenharTreinamentos(); };
}

/* ============================================================
   SOLICITAÇÕES (ficha L6): os pedidos de biometria que o Pessoal
   encaminhou. O gestor copia os dados e a foto para a Intelbras,
   confirma o cadastro, devolve ou nega.
   ============================================================ */
const ETAPA_EVENTO = { pessoal:'Enviado ao Pessoal', labbio:'Encaminhado ao LABBIO', devolvido:'Devolvido para correção',
  negado_pessoal:'Negado', negado_labbio:'Negado', concedido:'Acesso cadastrado', cancelado:'Cancelado', rascunho:'Em rascunho' };
const ETAPA_PEDIDO = { rascunho:'Em rascunho', pessoal:'No Pessoal', labbio:'No LABBIO', concedido:'Acesso cadastrado', devolvido:'Devolvido ao membro',
  negado_pessoal:'Negado pelo Pessoal', negado_labbio:'Negado pelo LABBIO', cancelado:'Cancelado' };
const ROTULO_DADO = { nome_civil:'Nome civil', cpf:'CPF', matricula:'Matrícula', nome:'Nome', confirmado_em:'Dados conferidos em' };
function trilhaPedido(p){
  const ev = p.eventos || [];
  if (!ev.length) return '<p class="lb-sub">Nenhum movimento ainda.</p>';
  return `<ol class="lb-trilha">${ev.map((e, i) => `<li${i === ev.length - 1 ? ' class="atual" aria-current="step"' : ''}>
    <b>${esc(ETAPA_EVENTO[e.para] || e.para)}</b> <span class="lb-sub">${esc(e.ator_nome || e.ator || '')}, ${fmtDT(e.quando)}</span>
    ${e.motivo ? `<div class="lb-sub" style="margin:2px 0 0">${esc(e.motivo)}</div>` : ''}</li>`).join('')}</ol>`;
}
const labP = { filtro:'abertos' };
async function pgSolicitacoes(sec, sub){
  if (sub) return pgPedido(sub);
  $('#lb-main').innerHTML = cabecalho({ titulo:'Solicitações', lead:'Pedidos de acesso biométrico que o Pessoal encaminhou ao LABBIO.' }) + `
    <div class="seg" role="group" aria-label="Situação" style="margin-bottom:14px">${[['abertos', 'Abertos'], ['encerrados', 'Encerrados'], ['todos', 'Todos']].map(([k, l]) =>
      `<button type="button" class="${labP.filtro === k ? 'on' : ''}" aria-pressed="${labP.filtro === k}" onclick="labP.filtro='${k}';pgSolicitacoes()">${l}</button>`).join('')}</div>
    <div id="sol-lista">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_solicitacoes', { p_situacao:labP.filtro });
    if (d?.status !== 'ok') throw new Error(d?.status);
    const el = $('#sol-lista'); if (!el) return;
    el.innerHTML = (d.pedidos || []).length ? `<div class="lb-wrap"><table class="lb-tabela" id="sol-tabela"><thead><tr><th>Membro</th><th>Protocolo</th><th>Versão</th><th>Encaminhado em</th><th>Etapa</th></tr></thead>
      <tbody>${d.pedidos.map(p => `<tr><td><a href="#/solicitacoes/${esc(p.id)}">${esc(p.nome)}</a></td><td>${esc(p.protocolo || '—')}</td><td>${Number(p.versao) || 1}</td>
        <td>${fmtDT(p.encaminhado_em)}</td><td>${esc(ETAPA_PEDIDO[p.etapa] || p.etapa)}</td></tr>`).join('')}</tbody></table></div>`
      : estado.vazio('Nenhum pedido neste filtro.');
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#sol-lista'); if (el) el.innerHTML = estado.erro('Não foi possível carregar as solicitações.', '<button class="btn ghost mini" type="button" onclick="pgSolicitacoes()">Tentar de novo</button>');
  }
}
async function pgPedido(id){
  $('#lb-main').innerHTML = `<a class="lb-voltar" href="#/solicitacoes">← Solicitações</a><div id="ped-corpo">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_pedido_ler', { p_id:id });
    const el = $('#ped-corpo'); if (!el) return;
    if (d?.status !== 'ok'){ el.innerHTML = estado.vazio('Este pedido não está disponível.'); return; }
    const p = d.pedido; lab.pedido = p;
    const env = p.enviada || {}, dados = env.dados || {};
    const linha = (k, v) => campoCopiar(ROTULO_DADO[k] || k, k === 'confirmado_em' ? fmtDT(v) : v, { copiavel: k !== 'confirmado_em' });
    const aberto = p.etapa === 'labbio';
    el.innerHTML = cabecalho({ titulo:`${p.nome}, ${p.protocolo || 'pedido'}`, lead:`Etapa: ${ETAPA_PEDIDO[p.etapa] || p.etapa}. Versão ${Number(p.versao) || 1}.` }) + `
      <div class="lb-objeto"><div class="lb-principal">
        <section class="lb-bloco"><h2>Dados para o cadastro</h2><dl class="lb-dados">${Object.entries(dados).filter(([, v]) => v != null && v !== '').map(([k, v]) => linha(k, v)).join('') || '<p class="lb-sub">Sem dados.</p>'}</dl></section>
        <section class="lb-bloco"><h2>Pedido</h2><dl class="lb-spec"><div><dt>Justificativa</dt><dd>${esc(p.justificativa || '—')}</dd></div><div><dt>Tempo</dt><dd>${esc(p.tempo || '—')}</dd></div></dl></section>
        <section class="lb-bloco"><h2>Movimentos</h2>${trilhaPedido(p)}</section>
        ${aberto ? `<section class="lb-bloco"><h2>Decisão</h2>
          <div class="acts" style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn solid" type="button" id="ped-ok" onclick="labPedidoConfirmar()">Confirmar o cadastro na biometria</button>
          <button class="btn ghost" type="button" onclick="labPedidoMotivo('devolver')">Devolver para correção</button>
          <button class="btn ghost" type="button" onclick="labPedidoMotivo('negar')">Negar</button></div></section>` : ''}
      </div><aside class="lb-lateral"><div id="ped-foto"><p class="lb-sub">Carregando a foto…</p></div></aside></div>`;
    if (env.foto_path) try {
      const { data, error } = await sb.storage.from('biometria').createSignedUrl(env.foto_path, 120);
      if (error || !data?.signedUrl) throw error || new Error('sem link');
      const f = $('#ped-foto'); if (f) f.innerHTML = `<img src="${esc(data.signedUrl)}" alt="Foto enviada por ${esc(p.nome)}" style="width:220px;max-width:100%;border-radius:12px">
        <a class="btn ghost mini" href="${esc(data.signedUrl)}" download="foto-${esc(p.registro)}.jpg">Baixar a foto</a>`;
    } catch(_){ const f = $('#ped-foto'); if (f) f.innerHTML = '<p class="lb-sub">Não foi possível abrir a foto agora.</p>'; }
    else $('#ped-foto').innerHTML = '<p class="lb-sub">Sem foto.</p>';
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#ped-corpo'); if (el) el.innerHTML = estado.erro('Não foi possível carregar o pedido.', `<button class="btn ghost mini" type="button" onclick="pgPedido('${esc(id)}')">Tentar de novo</button>`);
  }
}
/* um dado numa linha: rótulo, valor (inteiro, sem quebrar no meio) e o botão de copiar, com ícone */
function campoCopiar(rot, valor, { mono = true, copiavel = true } = {}){
  const v = valor == null || valor === '' ? '' : String(valor);
  return `<div class="lb-dado"><dt>${esc(rot)}</dt><dd class="${mono ? 'mono' : ''}" title="${esc(v)}">${v ? esc(v) : '—'}</dd>${v && copiavel
    ? `<button type="button" class="btn ghost mini lb-copiar" onclick="labCopiar(${esc(JSON.stringify(v))})" aria-label="Copiar ${esc(rot.toLowerCase())}" title="Copiar">${ic('copiar')}<span>Copiar</span></button>` : '<span class="lb-copiar-vazio"></span>'}</div>`;
}
function labCopiar(v){ navigator.clipboard?.writeText(v).then(() => toast('Copiado.'), () => toast('Não foi possível copiar.', true)); }
const MOTIVO_DECIDIR = { conflito:'O pedido mudou em outra tela. Recarregue.', encerrado:'Este pedido já foi decidido.', motivo_obrigatorio:'Escreva o motivo.' };
async function labDecidir(acao, motivo){
  const p = lab.pedido;
  const d = await rpc('labbio_pedido_decidir', { p_id:p.id, p_versao:p.versao, p_acao:acao, p_motivo:motivo || null });
  return d;
}
async function labPedidoConfirmar(){
  if (!await confirma('Confirme só depois de cadastrar na Intelbras. O acesso passa a constar na ficha da pessoa.', 'Confirmar o cadastro')) return;
  try {
    const d = await labDecidir('implantado');
    if (d?.status !== 'ok') return toast(MOTIVO_DECIDIR[d?.status] || 'Não foi possível confirmar agora.', true);
    toast('Cadastro confirmado.'); pgPedido(lab.pedido.id);
  } catch(e){ if (e.message !== 'sem_acesso') toast('Não foi possível confirmar agora.', true); }
}
function labPedidoMotivo(acao){
  const rot = acao === 'negar' ? 'Negar o pedido' : 'Devolver para correção';
  abreModal(`<h3>${rot}</h3><div class="fld"><label for="pm-motivo">Motivo (obrigatório)</label><textarea id="pm-motivo" rows="3"></textarea></div>
    <p class="lb-msg ruim" id="pm-msg"></p><div class="acts"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button>
    <button class="btn ${acao === 'negar' ? 'danger' : 'solid'}" type="button" id="pm-ok">${rot}</button></div>`);
  $('#pm-ok').onclick = async () => {
    const m = $('#pm-motivo').value.trim();
    if (!m){ $('#pm-msg').textContent = 'Escreva o motivo.'; return; }
    try {
      const d = await labDecidir(acao, m);
      if (d?.status !== 'ok'){ $('#pm-msg').textContent = MOTIVO_DECIDIR[d?.status] || 'Não foi possível registrar agora.'; return; }
      fechaModal(); toast(acao === 'negar' ? 'Pedido negado.' : 'Pedido devolvido.'); pgPedido(lab.pedido.id);
    } catch(e){ if (e.message !== 'sem_acesso') $('#pm-msg').textContent = 'Não foi possível registrar agora.'; }
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

/* ---------------- agenda das salas e tablets (L8) ---------------- */
const labAgDia = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const labAgData = s => new Date(s+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
function labAgSegunda(s){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()-(d.getDay()+6)%7);return labAgDia(d);}
function labAgSomar(s,n){const d=new Date(s+'T12:00:00');d.setDate(d.getDate()+n);return labAgDia(d);}
async function pgAgenda(){
 lab.agenda ||= {de:labAgSegunda(labAgDia(new Date())),espaco:'',dados:null,dispositivos:[],versao:0};
 const a=lab.agenda;
 $('#lb-main').innerHTML=cabecalho({titulo:'Agenda',lead:'A consulta é consultiva: sem resposta, o evento continua marcado. A agenda do SOMA não mostra toda a ocupação do LABBIO.'})
  +`<div class="lb-ferr"><button class="btn ghost" onclick="labAgSemana(-7)">Semana anterior</button><div class="fld"><label for="lb-ag-dia">Ir para a semana de</label><input id="lb-ag-dia" type="date" value="${esc(a.de)}" onchange="labAgEscolherDia(this.value)"></div><button class="btn ghost" onclick="labAgSemana(7)">Próxima semana</button><p class="lb-ag-periodo" id="lb-ag-periodo"></p></div>
   <div id="lb-ag-filtros"></div><div id="lb-ag-eventos">${estado.carregando()}</div>
   <section class="lb-ag-tablets" aria-labelledby="lb-ag-tablets-titulo"><div class="cab-linha"><h2 id="lb-ag-tablets-titulo">Tablets das salas</h2><button class="btn solid" id="lb-ag-cadastrar" onclick="labAgNovoTablet()" disabled>Cadastrar tablet</button></div><div id="lb-ag-tablets">${estado.carregando()}</div></section>`;
 await labAgCarregar();
}
function labAgSemana(n){lab.agenda.de=labAgSomar(lab.agenda.de,n);labAgCarregar();}
function labAgEscolherDia(s){if(/^\d{4}-\d{2}-\d{2}$/.test(s)){lab.agenda.de=labAgSegunda(s);labAgCarregar();}}
async function labAgCarregar(){
 const a=lab.agenda,versao=++a.versao;
 $('#lb-ag-dia').value=a.de;$('#lb-ag-periodo').textContent=labAgData(a.de)+' a '+labAgData(labAgSomar(a.de,6));
 $('#lb-ag-eventos').innerHTML=estado.carregando();$('#lb-ag-cadastrar').disabled=true;
 try{
  const [d,t]=await Promise.all([rpc('labbio_agenda',{p_de:a.de,p_ate:labAgSomar(a.de,6)}),rpc('labbio_dispositivos')]);
  if(versao!==a.versao||rota().sec!=='agenda'||!lab.eu)return;
  if(d?.status!=='ok'||t?.status!=='ok')throw new Error('indisponivel');
  a.dados=d;a.dispositivos=t.dispositivos||[];
  if(a.espaco&&!d.espacos.some(s=>String(s.id)===a.espaco))a.espaco='';
  $('#lb-ag-cadastrar').disabled=!d.espacos.length;
  labAgDesenhar();labAgTablets();
 }catch(e){
  if(versao!==a.versao||rota().sec!=='agenda'||e.message==='sem_acesso')return;
  $('#lb-ag-eventos').innerHTML=estado.erro('Não foi possível carregar a agenda.', '<button class="btn ghost mini" onclick="labAgCarregar()">Tentar de novo</button>');
  $('#lb-ag-tablets').innerHTML=estado.erro('Não foi possível carregar os tablets.');
 }
}
function labAgFiltrar(id){lab.agenda.espaco=String(id);labAgDesenhar();}
function labAgDesenhar(){
 const a=lab.agenda;
 $('#lb-ag-filtros').innerHTML=`<div class="seg" role="group" aria-label="Filtrar por espaço">${[{id:'',nome:'Todos'},...a.dados.espacos].map(s=>`<button class="${a.espaco===String(s.id)?'on':''}" aria-pressed="${a.espaco===String(s.id)}" onclick="labAgFiltrar('${esc(s.id)}')">${esc(s.nome)}</button>`).join('')}</div>`;
 const eventos=a.dados.eventos.filter(e=>!a.espaco||String(e.espaco_id)===a.espaco).sort((x,y)=>(x.data+(x.hora_inicio||'')).localeCompare(y.data+(y.hora_inicio||'')));
 let dia='';
 $('#lb-ag-eventos').innerHTML=eventos.length?eventos.map(e=>{
  const c=e.consulta,sit={pendente:['warn','relogio','Sem resposta'],disponivel:['ok','ok','Disponível'],conflito:['err','alerta','Conflito']}[c?.situacao];
  const nomes=e.convidados||[],convidados=nomes.slice(0,3).join(', ')+(nomes.length>3?' e mais '+(nomes.length-3):'');
  const cab=dia!==e.data?`<h2 class="sub-h lb-ag-dia">${esc(new Date(e.data+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'}))}</h2>`:'';dia=e.data;
  return cab+`<article class="lb-ag-evento" data-evento="${esc(e.id)}"><p class="mono lb-ag-hora">${esc(e.hora_inicio||'Dia inteiro')}${e.hora_fim?' às '+esc(e.hora_fim):''}</p>
   <div class="lb-ag-descricao"><h3>${esc(e.titulo)}</h3><p>${esc(e.espaco)}. Organização: ${esc(e.organizador||'Não informada')}</p>${convidados?`<p>Convidados: ${esc(convidados)}</p>`:''}
   ${sit?`<div class="lb-ag-consulta">${marcaEstado(sit[0],sit[1],sit[2]).replace('class="lb-est','class="lb-est lb-ag-sit')}${c.situacao==='conflito'?`<span>${esc(c.motivo)}</span>`:''}
    ${c.situacao==='pendente'?`<button class="btn ghost mini" onclick="labAgDecidir('${esc(c.id)}',true)">Disponível</button><button class="btn ghost mini" onclick="labAgConflito('${esc(c.id)}')">Conflito</button>`:''}</div>`:''}
   ${(e.sobreposicoes||[]).map(o=>`<div class="aviso-box warn">Cruza com ${esc(o.titulo)} (${esc(o.hora_inicio)}–${esc(o.hora_fim)}).</div>`).join('')}</div></article>`;
 }).join(''):estado.vazio('Nenhum evento nesta semana para este espaço.');
}
function labAgConflito(id){
 abreModal(`<h3>Apontar conflito</h3><form id="lb-ag-conflito" novalidate><div class="fld"><label for="lb-ag-motivo">Motivo do conflito</label><textarea id="lb-ag-motivo" rows="3" required></textarea></div><p id="lb-ag-motivo-erro" class="lb-msg ruim" role="alert"></p><div class="acts"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button><button class="btn solid" type="submit">Apontar conflito</button></div></form>`);
 $('#lb-ag-conflito').onsubmit=ev=>{ev.preventDefault();const motivo=$('#lb-ag-motivo').value.trim();if(!motivo){$('#lb-ag-motivo-erro').textContent='Informe o motivo do conflito.';$('#lb-ag-motivo').focus();return;}labAgDecidir(id,false,motivo);};
}
async function labAgDecidir(id,disponivel,motivo){
 if(lab.agenda.mutando)return;lab.agenda.mutando=true;
 const botoes=[...document.querySelectorAll('#lb-ag-eventos button, #lb-modal button')];botoes.forEach(b=>b.disabled=true);
 try{
  const d=await rpc('labbio_consulta_decidir',{p_id:id,p_disponivel:disponivel,...(!disponivel?{p_motivo:motivo}:{})});
  if(!['ok','invalidada'].includes(d?.status))throw new Error('indisponivel');
  fechaModal();toast(d.status==='invalidada'?'O evento mudou; recarregue.':'Consulta registrada.');
  if(rota().sec==='agenda')await labAgCarregar();
 }catch(e){if(e.message!=='sem_acesso')toast('Não foi possível registrar a consulta. Tente de novo.',true);}
 finally{lab.agenda.mutando=false;botoes.forEach(b=>b.disabled=false);}
}
function labAgTablets(){
 const ds=lab.agenda.dispositivos;
 $('#lb-ag-tablets').innerHTML=ds.length?`<div class="lb-wrap"><table class="lb-tabela tabela trabalho"><thead><tr><th>Rótulo</th><th>Sala</th><th>Situação</th><th>Último contato</th><th><span class="sr">Ações</span></th></tr></thead><tbody>${ds.map(d=>`<tr data-tablet="${esc(d.id)}"><td>${esc(d.rotulo)}</td><td>${esc(d.espaco)}</td><td>${pillSit(d.ativo?'ativo':'revogado')}</td><td>${esc(fmtDT(d.ultimo_contato))}</td><td>${d.ativo?`<button class="btn ghost mini" onclick="labAgRevogar('${esc(d.id)}')" aria-label="Revogar ${esc(d.rotulo)}">Revogar</button>`:''}</td></tr>`).join('')}</tbody></table></div>`:estado.vazio('Nenhum tablet cadastrado.');
}
function labAgNovoTablet(){
 // labbio_agenda já limita os espaços aos que pertencem ao LABBIO.
 const espacos=lab.agenda.dados?.espacos||[];if(!espacos.length)return;
 abreModal(`<h3>Cadastrar tablet</h3><form id="lb-ag-tablet-form" novalidate><div class="fld"><label for="lb-ag-sala">Sala</label><select id="lb-ag-sala">${espacos.map(s=>`<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('')}</select></div><div class="fld"><label for="lb-ag-rotulo">Rótulo</label><input id="lb-ag-rotulo" required maxlength="120"></div><p class="lb-msg ruim" id="lb-ag-tablet-erro" role="alert"></p><div class="acts"><button class="btn ghost" type="button" onclick="fechaModal()">Cancelar</button><button class="btn solid" type="submit">Cadastrar tablet</button></div></form>`);
 $('#lb-ag-tablet-form').onsubmit=labAgCadastrar;
}
async function labAgCadastrar(ev){
 ev.preventDefault();if(lab.agenda.mutando)return;
 const rotulo=$('#lb-ag-rotulo').value.trim(),espaco=Number($('#lb-ag-sala').value),erro=$('#lb-ag-tablet-erro');
 if(!rotulo){erro.textContent='Informe um rótulo para o tablet.';$('#lb-ag-rotulo').focus();return;}
 lab.agenda.mutando=true;const form=ev.target;for(const b of form.querySelectorAll('button'))b.disabled=true;
 try{
  const d=await rpc('labbio_dispositivo_criar',{p_espaco:espaco,p_rotulo:rotulo});
  if(d?.status!=='ok')throw new Error('indisponivel');
  const endereco=new URL(d.endereco,location.origin+'/');
  if(endereco.origin!==location.origin||endereco.pathname!=='/sala.html')throw new Error('endereco_invalido');
  abreModal(`<h3>Abrir no tablet</h3><p>Este endereço só aparece agora. Abra no tablet e salve como favorito; quem tiver o endereço controla o tablet.</p><div class="fld"><label for="lb-ag-endereco">Endereço do tablet</label><input id="lb-ag-endereco" readonly value="${esc(endereco.href)}"></div><div class="acts"><button class="btn ghost" onclick="fechaModal()">Fechar</button><button class="btn solid" onclick="labAgCopiarEndereco()">Copiar</button></div>`,true);
  if(rota().sec==='agenda')await labAgCarregar();
 }catch(e){if(e.message!=='sem_acesso'){if(erro.isConnected)erro.textContent='Não foi possível cadastrar o tablet. Tente de novo.';else toast('Não foi possível carregar o endereço do tablet.',true);}}
 finally{lab.agenda.mutando=false;for(const b of form.querySelectorAll('button'))b.disabled=false;}
}
async function labAgCopiarEndereco(){
 const input=$('#lb-ag-endereco');if(!input)return;
 try{await navigator.clipboard.writeText(input.value);toast('Endereço copiado.');}
 catch(_){input.focus();input.select();toast('Selecione e copie o endereço.',true);}
}
async function labAgRevogar(id){
 if(lab.agenda.mutando||!await confirma('Revogar este tablet? Ele deixará de consultar e controlar a sala.','Revogar'))return;
 if(lab.agenda.mutando)return;lab.agenda.mutando=true;
 try{const d=await rpc('labbio_dispositivo_revogar',{p_id:id});if(d?.status!=='ok')throw new Error('indisponivel');toast('Tablet revogado.');if(rota().sec==='agenda')await labAgCarregar();}
 catch(e){if(e.message!=='sem_acesso')toast('Não foi possível revogar o tablet. Tente de novo.',true);}
 finally{lab.agenda.mutando=false;}
}
