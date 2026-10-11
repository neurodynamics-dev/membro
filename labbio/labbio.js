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
  ({ '':pgInicio, gestores:pgGestores, membros:pgMembros, checkins:pgCheckins, treinamentos:pgTreinamentos, solicitacoes:pgSolicitacoes }[sec] || pgEmBreve)(sec, r.sub);
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
  seta:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const ic = n => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[n] || ''}</svg>`;
const fmtD = d => d ? new Date(d).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' }) : '—';
const isoDia = d => { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const iniciais = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
const avatar = (p, t = 30) => p.foto_url
  ? `<img class="lb-av" src="${esc(p.foto_url)}" alt="" width="${t}" height="${t}" loading="lazy">`
  : `<span class="lb-av" style="width:${t}px;height:${t}px" aria-hidden="true">${esc(iniciais(p.nome))}</span>`;
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
const chipTrainee = p => p.trainee ? ' <span class="pill">Trainee</span>' : '';

/* ---------------- início ---------------- */
async function pgInicio(){
  $('#lb-main').innerHTML = cabecalho({ titulo:'Início', lead:'O que o LABBIO acompanha da equipe da NeuroDynamics.' }) + `<div id="lb-ini">${estado.carregando()}</div>`;
  try {
    const d = await rpc('labbio_inicio');
    if (d?.status !== 'ok') throw new Error(d?.status);
    lab.revogacoes = d.revogacoes || [];
    const el = $('#lb-ini'); if (!el) return;
    el.innerHTML = `<div id="lb-rev">${faixasRevogacao()}</div>
      <div class="lb-atalhos">
        <a href="#/membros"><section class="widget"><header><span class="w-rot">Membros ativos</span></header><div class="w-corpo"><span class="w-num">${Number(d.membros) || 0}</span></div></section></a>
        <a href="#/membros"><section class="widget"><header><span class="w-rot">Com biometria</span></header><div class="w-corpo"><span class="w-num">${Number(d.com_acesso) || 0}</span></div></section></a>
        <a href="#/solicitacoes"><section class="widget"><header><span class="w-rot">Pedidos para analisar</span></header><div class="w-corpo"><span class="w-num">${Number(d.pedidos_abertos) || 0}</span></div></section></a>
      </div>`;
  } catch(e){
    if (e.message === 'sem_acesso') return;
    $('#lb-ini').innerHTML = estado.erro('Não foi possível carregar o início.', '<button class="btn ghost mini" type="button" onclick="pgInicio()">Tentar de novo</button>');
  }
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
const labM = { busca:'', filtro:'todos', lista:[], timer:null, vez:0 };
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
  el.innerHTML = ms.length ? `<p class="lb-total" aria-live="polite"><b>${ms.length}</b> ${ms.length === 1 ? 'pessoa' : 'pessoas'}</p>
    <div class="lb-wrap"><table class="lb-tabela" id="lb-m-tabela"><thead><tr><th>Membro</th><th>Área</th><th>Liderança</th><th>Termo</th><th>Acesso</th></tr></thead>
    <tbody>${ms.map(p => `<tr data-reg="${p.registro}">
      <td><a class="lb-pessoa" href="#/membros/${p.registro}">${avatar(p)}<span>${esc(p.nome)}</span></a>${chipTrainee(p)}</td>
      <td>${esc(p.area || '—')}</td><td>${esc(p.gestor_nome || '—')}</td>
      <td class="c-termo">${termoHTML(p.termo)}</td><td class="c-acesso">${acessoHTML(p.acesso)}</td></tr>`).join('')}</tbody></table></div>`
    : estado.vazio('Ninguém com este filtro.');
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
        <section class="lb-bloco"><h2>Dados</h2><dl class="lb-spec">
          ${spec('E-mail da NRO', esc(m.email_nro || '—'))}${spec('E-mail pessoal', esc(m.email_pessoal || '—'))}
          ${spec('Telefone', esc(m.telefone || '—'))}${spec('Área', esc(m.area || '—'))}${spec('Cargo', esc(m.cargo || '—') + chipTrainee(m))}
          ${spec('Liderança', m.gestor ? `<a href="#/membros/${Number(m.gestor)}">${esc(m.gestor_nome || '—')}</a>` : '—')}
          ${spec('Liderados', (d.liderados || []).length ? d.liderados.map(l => `<a href="#/membros/${Number(l.registro)}">${esc(l.nome)}</a>`).join(', ') : '—')}
        </dl></section>
        <section class="lb-bloco"><h2>Termo de sigilo</h2><p>${termoHTML(m.termo)}
          ${m.termo?.enviado_em ? `<span class="lb-sub">enviado em ${fmtD(m.termo.enviado_em)}</span>` : ''}
          ${m.termo?.conferido_em ? `<span class="lb-sub">conferido em ${fmtD(m.termo.conferido_em)}</span>` : ''}</p>
          ${termoArq ? '<button class="btn ghost mini" type="button" id="lb-termo-abrir">Abrir o termo assinado ↗</button>' : ''}</section>
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
  } catch(e){
    if (e.message === 'sem_acesso') return;
    const el = $('#lb-perfil'); if (el) el.innerHTML = estado.erro('Não foi possível carregar o perfil.', `<button class="btn ghost mini" type="button" onclick="pgPerfil(${reg})">Tentar de novo</button>`);
  }
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
    const linha = (k, v) => `<div class="lb-dado"><dt>${esc(ROTULO_DADO[k] || k)}</dt><dd>${esc(k === 'confirmado_em' ? fmtDT(v) : v)}</dd>
      ${k === 'confirmado_em' ? '' : `<button type="button" class="btn ghost mini" onclick="labCopiar(${JSON.stringify(String(v)).replace(/"/g, '&quot;')})">Copiar</button>`}</div>`;
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
