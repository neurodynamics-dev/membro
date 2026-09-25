/* ============================================================
   MÓDULO · COFRE — as senhas e os códigos das contas da equipe
   Cada acesso do catálogo pode ter contas no cofre: o endereço, o
   usuário, a senha — gerada aqui —, o segredo do código de duas
   etapas e as notas que também são segredo. O segredo não desce com
   a lista: sai uma conta por vez, pelo botão, e sai registrado (quem
   viu, quem copiou, quando). O código de duas etapas é calculado no
   banco, a cada pedido: o segredo do 2FA não vem para o navegador
   depois de guardado, e a equipe não depende do celular de ninguém.

   Quem usa uma conta: os grupos dela e quem tem o acesso concedido na
   ficha. Quem mantém (troca a senha, o 2FA, as notas): os
   responsáveis e a gestão do cofre. A troca tem prazo — o banco avisa
   os responsáveis no sino e por e-mail — e a senha anterior fica
   guardada por um tempo, para ninguém ficar trancado do lado de fora.

   Rotas (Serviços é da casca; ela desce este módulo e chama):
     #/servicos/cofre                  as contas que você usa
     #/servicos/cofre/<id>             a mesma lista, com a conta em destaque
     #/servicos/cofre/gestao           todas, e os acessos ainda sem conta
     #/servicos/cofre/uso              o registro de uso de todas
     #/servicos/cofre/config           quem gere e os prazos
     #/servicos/cofre/nova[/<item>]    cadastrar uma conta (gestão)
     #/servicos/cofre/editar/<id>      mudar uma conta (gestão e quem mantém)

   Precisa da migração db/v27_cofre.sql.

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, confirma, falha, motivoRPC, registrarBusca,
   precisaDocNRO, hojeISO, grupoPorId, carregarLib, CAT_ACESSO.
   ============================================================ */

const cof = { lista:null, erro:null, gestor:false, cfg:null, lembrou:false, form:null, limpeza:null, esconde:new Map() };

const COF_SIT = {
  em_dia:     { l:'Em dia',             p:'p-ok',   dt:'dt-ok' },
  vence_logo: { l:'Troca vence logo',   p:'p-warn', dt:'dt-warn' },
  vencida:    { l:'Troca vencida',      p:'p-bad',  dt:'dt-bad' },
  exposta:    { l:'Trocar: exposta',    p:'p-bad',  dt:'dt-bad' },
  sem_troca:  { l:'Sem prazo de troca', p:'',       dt:'dt-gray' },
  sem_senha:  { l:'Sem senha',          p:'',       dt:'dt-gray' },
  desativada: { l:'Desativada',         p:'',       dt:'dt-gray' }
};
const COF_VIA = { gestao:'gestão do cofre', responsavel:'você mantém', grupo:'pelo seu grupo', acesso:'pelo acesso concedido' };
const COF_ACAO = {
  criou:'cadastrou a conta', editou:'mudou', trocou:'trocou a senha', excluiu:'excluiu a conta',
  viu_senha:'viu a senha', copiou_senha:'copiou a senha', viu_anterior:'viu a senha anterior',
  copiou_anterior:'copiou a senha anterior', viu_notas:'viu as notas secretas', copiou_notas:'copiou as notas secretas',
  codigo:'gerou um código de duas etapas'
};
const COF_CAMPO = {
  item_id:'Escolha o acesso do catálogo a que a conta pertence.',
  url:'O endereço precisa começar com https:// (ou http://).',
  rotulo:'O rótulo passou de 80 caracteres.', usuario:'O usuário passou de 200 caracteres.',
  instrucoes:'As instruções passaram de 2.000 caracteres.', notas:'As notas passaram de 5.000 caracteres.',
  senha:'A senha precisa ter de 1 a 500 caracteres.', rotacao_dias:'O prazo de troca não vale.',
  totp:'O segredo do código de duas etapas não parece válido: são letras de A a Z e números de 2 a 7, 16 ou mais.'
};
const COF_MOTIVO = {
  vazio:'Não há nada guardado aqui.', sem_totp:'Esta conta não tem código de duas etapas.',
  totp_invalido:'O segredo do código de duas etapas guardado não é válido — quem mantém a conta precisa colá-lo de novo.'
};
const cofMotivo = (data, error, padrao) => error ? motivoRPC(null, error, padrao)
  : COF_MOTIVO[data?.status] || motivoRPC(data, null, padrao);
const cofCarregando = t => `<div class="carregando"><span class="spin"></span> ${t || 'Abrindo o cofre…'}</div>`;
const cofTopo = (titulo, lead, acoes) => `<div class="topo-gestao"><div class="tx">
  <span class="eyebrow">Serviços · Cofre</span><h1>${titulo}</h1>${lead ? `<p class="lead">${lead}</p>` : ''}</div>
  ${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
const cofFaltaBanco = erro => `${cofTopo('Cofre de senhas', '')}<div class="aviso-box err"><b>O cofre ainda não está no banco.</b>
  ${esc(erro?.message || '')}<br><span class="small">Falta aplicar a migração <code>db/v27_cofre.sql</code> — e, antes dela, ligar o
  Vault do Supabase (Database › Extensions › supabase_vault).</span></div>`;
const cofNome = c => c ? `${c.item_nome}${c.rotulo ? ' — ' + c.rotulo : ''}` : '';
const cofHost = url => String(url || '').replace(/^https?:\/\//i, '').replace(/[/?#].*$/, '');
const cofPorId = id => (cof.lista || []).find(c => c.id === id) || null;

async function cofCarregar(){
  const [l, g, c] = await Promise.all([
    sb.rpc('cofre_lista'),
    sb.rpc('cofre_gestor'),
    sb.from('cofre_config').select('*').maybeSingle()
  ]);
  if (l.error || !Array.isArray(l.data)){ cof.erro = l.error || { message:'cofre_lista não devolveu a lista' }; return false; }
  cof.lista = l.data; cof.gestor = g.data === true; cof.cfg = c.data || null; cof.erro = null;
  /* sem o pg_cron, o lembrete da troca sai quando alguém abre o cofre */
  if (!cof.lembrou){ cof.lembrou = true; sb.rpc('cofre_lembretes').then(() => {}, () => {}); }
  return true;
}

async function pageCofre(sub2){
  const s = String(sub2 || ''), extra = String(location.hash.split('/')[4] || '');
  $('#main').innerHTML = cofCarregando();
  if (!(await cofCarregar())){ $('#main').innerHTML = cofFaltaBanco(cof.erro); return; }
  if (s === 'gestao') return cof.gestor ? cofGestao() : (location.hash = '#/servicos/cofre');
  if (s === 'uso')    return cof.gestor ? cofUsoTodos() : (location.hash = '#/servicos/cofre');
  if (s === 'config') return cof.gestor ? cofConfig() : (location.hash = '#/servicos/cofre');
  if (s === 'nova')   return cof.gestor ? cofFormulario(null, extra) : (location.hash = '#/servicos/cofre');
  if (s === 'editar') return cofFormulario(extra);
  return cofMinhas(/^[0-9a-f-]{36}$/i.test(s) ? s : null);
}

function cofNav(atual){
  if (!cof.gestor) return '';
  const it = [['', 'Minhas contas'], ['gestao', 'Gestão'], ['uso', 'Registro de uso'], ['config', 'Configurações']];
  return `<nav class="arq-nav" aria-label="Cofre">${it.map(([k, rot]) => `<a href="#/servicos/cofre${k ? '/' + k : ''}"
    class="${atual === (k || 'minhas') ? 'on' : ''}">${k === 'config' ? ic('engrenagem') + ' ' : ''}${rot}</a>`).join('')}</nav>`;
}

/* ============================================================
   AS CONTAS QUE VOCÊ USA
   ============================================================ */
function cofMinhas(destaque){
  const l = (cof.lista || []).filter(c => c.ativo || c.mantem);
  const cats = [...new Set(l.map(c => c.item_categoria || 'outros'))]
    .sort((a, b) => (a === 'sistema' ? -1 : b === 'sistema' ? 1 : String(a).localeCompare(String(b))));
  const pede = l.filter(c => c.mantem && ['vencida','vence_logo','exposta'].includes(c.situacao));
  $('#main').innerHTML = `${cofTopo('Cofre de senhas',
      'As contas dos acessos que você tem: o usuário, a senha e o código de duas etapas, para entrar e copiar. Tudo o que sai do '
      + 'cofre fica registrado — quem viu, quem copiou e quando.',
      cof.gestor ? `<a class="btn solid" href="#/servicos/cofre/nova">${ic('plus')} Nova conta</a>` : '')}
    ${cofNav('minhas')}
    ${pede.length ? `<div class="aviso-box warn">${pede.length === 1 ? 'Uma conta que você mantém pede' : pede.length + ' contas que você mantém pedem'}
      a troca da senha: ${pede.map(c => `<a href="#/servicos/cofre/${c.id}" style="text-decoration:underline">${esc(cofNome(c))}</a>`).join(', ')}.</div>` : ''}
    ${l.length ? `<div class="cof-filtro"><input id="cof-busca" type="search" placeholder="Filtrar pelo nome, usuário ou endereço"
        aria-label="Filtrar as contas" oninput="cofFiltrar(this.value)"></div>
      ${cats.map(k => `<section class="cof-sec" data-cat="${esc(k)}"><h2 class="srv-bloco">${esc(CAT_ACESSO[k] || (k === 'outros' ? 'Outros' : k))}</h2>
        <div class="cof-lista">${l.filter(c => (c.item_categoria || 'outros') === k).map(cofCartao).join('')}</div></section>`).join('')}
      <p class="small dim cof-rodape">Falta uma conta aqui? Ela aparece para quem está num dos grupos dela e para quem tem o acesso
        concedido na ficha — peça em <a href="#/servicos/acesso" style="text-decoration:underline">Serviços › Solicitação de acesso</a>.</p>`
    : `<div class="vazio"><div class="glyph">${ic('cofre')}</div><h3>Nenhuma conta para você no cofre</h3>
        <p>As contas aparecem para quem está num dos grupos delas e para quem tem o acesso concedido na ficha.
          Precisa de uma? Peça o acesso.</p>
        <a class="btn ghost" href="#/servicos/acesso">Solicitação de acesso</a>
        ${cof.gestor ? ` <a class="btn solid" href="#/servicos/cofre/gestao">Cadastrar as contas</a>` : ''}</div>`}`;
  if (destaque){
    const el = document.getElementById('cof-' + destaque);
    if (el){ el.classList.add('destaque'); el.scrollIntoView({ block:'center' }); }
  }
}
function cofFiltrar(t){
  const q = norm(t || '');
  document.querySelectorAll('.cof-card').forEach(el => { el.hidden = !!q && !norm(el.dataset.busca || '').includes(q); });
  document.querySelectorAll('.cof-sec').forEach(s => { s.hidden = ![...s.querySelectorAll('.cof-card')].some(el => !el.hidden); });
}
const COF_IC = { sistema:'key', local:'cadeado', documento:'doc' };
function cofPrazo(c){
  if (!c.tem_senha) return c.mantem ? 'Sem senha no cofre — cadastre em Trocar a senha.' : 'Sem senha no cofre.';
  const troca = c.trocada_em ? `Trocada em ${fmtD(c.trocada_em)}${c.trocada_nome ? ' por ' + esc(c.trocada_nome) : ''}` : '';
  if (!c.vence_em) return troca + (troca ? ' · ' : '') + 'sem prazo de troca';
  const venc = new Date(c.vence_em) < new Date() ? 'venceu em' : 'troca até';
  return `${troca}${troca ? ' · ' : ''}${venc} ${fmtD(c.vence_em)}`;
}
function cofCartao(c){
  const s = COF_SIT[c.situacao] || { l:c.situacao, p:'', dt:'dt-gray' };
  return `<article class="cof-card${c.ativo ? '' : ' off'}" id="cof-${c.id}"
      data-busca="${esc([c.item_nome, c.rotulo, c.usuario, cofHost(c.url)].filter(Boolean).join(' '))}">
    <header class="cof-hd">
      <span class="cof-ic">${ic(COF_IC[c.item_categoria] || 'cofre')}</span>
      <div class="tx"><h3>${esc(c.item_nome)}${c.rotulo ? ` <span class="rot">— ${esc(c.rotulo)}</span>` : ''}</h3>
        <span class="mt">${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(cofHost(c.url))} ${ic('link')}</a> · ` : ''}${esc(COF_VIA[c.via] || '')}</span></div>
      <span class="pill ${s.p}"><span class="dt ${s.dt}"></span>${s.l}</span>
    </header>
    <div class="cof-campos">
      <div class="cof-campo"><span class="lb">Usuário</span>
        <span class="vl">${c.usuario ? `<span class="v mono" title="${esc(c.usuario)}">${esc(c.usuario)}</span>
          <button class="icon-btn sm" title="Copiar o usuário" aria-label="Copiar o usuário de ${esc(cofNome(c))}" onclick="cofCopiarUsuario('${c.id}')">${ic('copy')}</button>`
          : '<span class="v dim">—</span>'}</span></div>
      <div class="cof-campo"><span class="lb">Senha</span>
        <span class="vl">${c.tem_senha ? `<span class="v mono cof-sen" id="cofs-${c.id}">••••••••••••</span>
          <button class="icon-btn sm" id="cofv-${c.id}" title="Mostrar a senha" aria-label="Mostrar a senha de ${esc(cofNome(c))}" onclick="cofVer('${c.id}')">${ic('eye')}</button>
          <button class="icon-btn sm primary" title="Copiar a senha" aria-label="Copiar a senha de ${esc(cofNome(c))}" onclick="cofCopiar('${c.id}','senha')">${ic('copy')}</button>`
          : '<span class="v dim">sem senha no cofre</span>'}</span></div>
      ${c.tem_totp ? `<div class="cof-campo cof-2fa" id="cofc-${c.id}"><span class="lb" title="O código de duas etapas (2FA)">Duas etapas</span>
        <span class="vl"><button class="btn ghost mini" onclick="cofCodigo('${c.id}')">${ic('shield')} Gerar o código</button></span></div>` : ''}
    </div>
    ${c.instrucoes ? `<p class="cof-instr">${esc(c.instrucoes)}</p>` : ''}
    <footer class="cof-pe"><span class="small dim">${cofPrazo(c)}</span>
      <span class="acs">${c.tem_notas ? `<button class="btn ghost mini" onclick="cofNotas('${c.id}')">${ic('cadeado')} Notas secretas</button>` : ''}
        ${c.mantem && c.tem_anterior ? `<button class="btn ghost mini" onclick="cofAnterior('${c.id}')">Senha anterior</button>` : ''}
        ${c.mantem ? `<button class="btn ghost mini" onclick="cofTrocar('${c.id}')">${ic('refazer')} ${c.tem_senha ? 'Trocar a senha' : 'Pôr a senha'}</button>
          <a class="btn ghost mini" href="#/servicos/cofre/editar/${c.id}">${ic('pencil')} Editar</a>
          <button class="btn ghost mini" onclick="cofUso('${c.id}')">${ic('relogio')} Uso</button>` : ''}</span></footer>
  </article>`;
}

/* ---------------- o segredo sai ----------------
   Visto, some sozinho em 20 segundos; copiado, a área de
   transferência é limpa em 60 — se nada novo foi copiado por cima. */
const COF_MOSTRA_S = 20, COF_LIMPA_S = 60;
async function cofRevelar(id, campo, acao){
  const { data, error } = await sb.rpc('cofre_revelar', { p_id: id, p_campo: campo, p_acao: acao });
  if (error || data?.status !== 'ok'){ toast(cofMotivo(data, error, 'Não foi possível abrir o cofre'), true); return null; }
  return data.valor;
}
async function cofParaAreaDeTransferencia(texto, feito){
  try{ await navigator.clipboard.writeText(texto); }
  catch(e){ const ta = document.createElement('textarea'); ta.value = texto; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
    document.execCommand('copy'); ta.remove(); }
  clearTimeout(cof.limpeza);
  cof.limpeza = setTimeout(() => {
    if (!document.hasFocus()) return;
    navigator.clipboard?.writeText('').catch(() => {});
  }, COF_LIMPA_S * 1000);
  toast(`${feito}. A área de transferência é limpa em ${COF_LIMPA_S} segundos.`);
}
async function cofCopiar(id, campo){
  const v = await cofRevelar(id, campo, 'copiar');
  if (v != null) cofParaAreaDeTransferencia(v, campo === 'anterior' ? 'Senha anterior copiada' : campo === 'notas' ? 'Notas copiadas' : 'Senha copiada');
}
function cofCopiarUsuario(id){
  const c = cofPorId(id); if (!c?.usuario) return;
  navigator.clipboard.writeText(c.usuario).then(() => toast('Usuário copiado.'),
    () => { const ta = document.createElement('textarea'); ta.value = c.usuario; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); toast('Usuário copiado.'); });
}
async function cofVer(id){
  const el = document.getElementById('cofs-' + id), bt = document.getElementById('cofv-' + id);
  if (!el) return;
  if (el.classList.contains('aberta')) return cofEsconder(id);
  const v = await cofRevelar(id, 'senha', 'ver'); if (v == null) return;
  el.textContent = v; el.classList.add('aberta');
  if (bt){ bt.innerHTML = ic('olho_fechado'); bt.title = 'Esconder a senha'; }
  clearTimeout(cof.esconde.get(id));
  cof.esconde.set(id, setTimeout(() => cofEsconder(id), COF_MOSTRA_S * 1000));
}
function cofEsconder(id){
  const el = document.getElementById('cofs-' + id), bt = document.getElementById('cofv-' + id);
  clearTimeout(cof.esconde.get(id)); cof.esconde.delete(id);
  if (el){ el.textContent = '••••••••••••'; el.classList.remove('aberta'); }
  if (bt){ bt.innerHTML = ic('eye'); bt.title = 'Mostrar a senha'; }
}
async function cofNotas(id){
  const v = await cofRevelar(id, 'notas', 'ver'); if (v == null) return;
  abreModal(`<h3>Notas secretas · ${esc(cofNome(cofPorId(id)))}</h3>
    <p class="sub" style="margin-bottom:12px">Códigos de recuperação, perguntas de segurança — o que também é segredo. Ver ficou registrado.</p>
    <pre class="cof-notas">${esc(v)}</pre>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <button class="btn solid" onclick="cofCopiar('${id}','notas')">${ic('copy')} Copiar</button></div>`);
}
function cofAnterior(id){
  const c = cofPorId(id); if (!c) return;
  abreModal(`<h3>A senha anterior · ${esc(cofNome(c))}</h3>
    <p class="sub" style="margin-bottom:14px">Guardada até ${fmtD(c.anterior_ate)}, para o caso de o serviço não ter aceitado a troca. Se a
      nova já funciona, ela não serve para mais nada.</p>
    <div class="cof-campo solto"><span class="lb">Senha anterior</span><span class="vl"><span class="v mono cof-sen" id="cofant">••••••••••••</span>
      <button class="icon-btn sm" title="Mostrar" aria-label="Mostrar a senha anterior" onclick="cofVerAnterior('${id}')">${ic('eye')}</button>
      <button class="icon-btn sm primary" title="Copiar" aria-label="Copiar a senha anterior" onclick="cofCopiar('${id}','anterior')">${ic('copy')}</button></span></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`);
}
async function cofVerAnterior(id){
  const v = await cofRevelar(id, 'anterior', 'ver'); const el = $('#cofant');
  if (v != null && el){ el.textContent = v; el.classList.add('aberta'); setTimeout(() => { const x = $('#cofant'); if (x) x.textContent = '••••••••••••'; }, COF_MOSTRA_S * 1000); }
}

/* ---------------- o código de duas etapas ----------------
   Cada código pedido é um registro no uso da conta: não se renova
   sozinho. Vencido, o botão pede outro. */
const cofCodigoFmt = c => String(c || '').length === 8 ? c.slice(0, 4) + ' ' + c.slice(4) : String(c || '').replace(/^(\d{3})(\d+)$/, '$1 $2');
async function cofCodigo(id){
  const box = document.getElementById('cofc-' + id); if (!box) return;
  const vl = box.querySelector('.vl');
  vl.innerHTML = '<span class="small dim">gerando…</span>';
  const { data, error } = await sb.rpc('cofre_codigo', { p_id: id });
  if (error || data?.status !== 'ok'){
    vl.innerHTML = `<button class="btn ghost mini" onclick="cofCodigo('${id}')">${ic('shield')} Gerar o código</button>`;
    return toast(cofMotivo(data, error, 'Não foi possível gerar o código'), true);
  }
  const periodo = Number(data.periodo) || 30, ate = Date.now() + Number(data.restante) * 1000;
  vl.innerHTML = `<span class="v mono cof-cod" data-cod="${esc(data.codigo)}">${esc(cofCodigoFmt(data.codigo))}</span>
    <span class="cof-anel" style="--p:${Math.max(0, Math.min(1, data.restante / periodo))}" title="O código vale por mais ${data.restante} segundos"><b>${data.restante}</b></span>
    <button class="icon-btn sm primary" title="Copiar o código" aria-label="Copiar o código" onclick="cofCopiarCodigo('${id}')">${ic('copy')}</button>`;
  const t = setInterval(() => {
    const cod = box.querySelector('.cof-cod'), anel = box.querySelector('.cof-anel');
    if (!document.body.contains(box) || !cod){ clearInterval(t); return; }
    const r = Math.max(0, Math.round((ate - Date.now()) / 1000));
    if (anel){ anel.style.setProperty('--p', String(r / periodo)); anel.querySelector('b').textContent = r; anel.title = `O código vale por mais ${r} segundos`; }
    if (r <= 0){
      clearInterval(t);
      vl.innerHTML = `<span class="v mono cof-cod venceu">${esc(cofCodigoFmt(data.codigo))}</span>
        <button class="btn ghost mini" onclick="cofCodigo('${id}')">${ic('refazer')} Outro código</button>`;
    }
  }, 1000);
}
function cofCopiarCodigo(id){
  const cod = document.querySelector(`#cofc-${id} .cof-cod:not(.venceu)`)?.dataset.cod;
  if (cod) cofParaAreaDeTransferencia(cod, 'Código copiado');
}

/* ---------------- quem usou ---------------- */
async function cofUso(id){
  const c = cofPorId(id);
  const { data, error } = await sb.rpc('cofre_log_ler', { p_id: id, p_limite: 100 });
  if (error) return falha(error, 'Não foi possível ler o registro de uso');
  abreModal(`<h3>Registro de uso · ${esc(cofNome(c))}</h3>
    <p class="sub" style="margin-bottom:12px">Os cem movimentos mais recentes: quem viu ou copiou um segredo, gerou um código, mudou a conta.</p>
    ${(data || []).length ? `<ol class="cof-log">${data.map(cofLogLinha).join('')}</ol>` : '<p class="small muted">Ninguém usou esta conta ainda.</p>'}
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`);
}
const cofLogLinha = l => `<li><span class="qd">${fmtDT(l.criado_em)}</span> <b>${esc(l.nome || '—')}</b> ${esc(COF_ACAO[l.acao] || l.acao)}${
  l.detalhe ? `<span class="small dim"> — ${esc(l.detalhe)}</span>` : ''}</li>`;

/* ============================================================
   O GERADOR DE SENHAS
   Sorteio do crypto do navegador, sem viés (rejeição), com ao menos
   um caractere de cada conjunto marcado. "Sem parecidos" tira os
   que se confundem ao ditar ou digitar: 0 e O, 1, l e I.
   ============================================================ */
const COF_CONJ = {
  mai: ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'IO'], min: ['abcdefghijkmnopqrstuvwxyz', 'l'],
  num: ['23456789', '01'], sim: ['!@#$%&*+-=?_.:', '']
};
const cofGer = { tam:20, mai:true, min:true, num:true, sim:true, claros:true };
function cofSorteio(n){
  const lim = Math.floor(0x100000000 / n) * n, b = new Uint32Array(1);
  do { crypto.getRandomValues(b); } while (b[0] >= lim);
  return b[0] % n;
}
function cofGerarSenha(o = cofGer){
  const conj = Object.keys(COF_CONJ).filter(k => o[k]).map(k => COF_CONJ[k][0] + (o.claros ? '' : COF_CONJ[k][1]));
  if (!conj.length) conj.push(COF_CONJ.min[0]);
  const tam = Math.max(8, Math.min(128, Number(o.tam) || 20));
  const todos = conj.join('');
  const s = conj.map(c => c[cofSorteio(c.length)]);
  while (s.length < tam) s.push(todos[cofSorteio(todos.length)]);
  for (let i = s.length - 1; i > 0; i--){ const j = cofSorteio(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
  return s.join('');
}
/* a força, em bits: o tamanho vezes o log2 do alfabeto que se vê */
function cofForca(senha){
  const s = String(senha || '');
  if (!s) return { bits:0, l:'' };
  let n = 0;
  if (/[a-z]/.test(s)) n += 26; if (/[A-Z]/.test(s)) n += 26; if (/\d/.test(s)) n += 10; if (/[^a-zA-Z\d]/.test(s)) n += 20;
  const bits = Math.round(s.length * Math.log2(Math.max(n, 2)));
  return { bits, l: bits >= 100 ? 'muito forte' : bits >= 75 ? 'forte' : bits >= 55 ? 'razoável' : 'fraca',
           c: bits >= 75 ? 'ok' : bits >= 55 ? 'warn' : 'bad' };
}
/* o campo com o gerador: alvo é o id do <input> */
function cofGerador(alvo){
  return `<div class="cof-ger">
    <div class="cof-ger-cp"><input id="${alvo}" class="mono" autocomplete="off" spellcheck="false" autocapitalize="off"
        data-lpignore="true" data-1p-ignore oninput="cofMedir('${alvo}')" aria-label="Senha">
      <button type="button" class="icon-btn" title="Gerar outra" aria-label="Gerar outra senha" onclick="cofNova('${alvo}')">${ic('dado')}</button>
      <button type="button" class="icon-btn" title="Copiar" aria-label="Copiar a senha gerada" onclick="cofCopiarCampo('${alvo}')">${ic('copy')}</button></div>
    <div class="cof-ger-op">
      <label class="cof-tam">Tamanho <input type="range" min="12" max="64" value="${cofGer.tam}" aria-label="Tamanho da senha"
        oninput="cofGer.tam = +this.value; this.nextElementSibling.textContent = this.value; cofNova('${alvo}')"><b class="mono">${cofGer.tam}</b></label>
      ${[['mai','A–Z'], ['min','a–z'], ['num','0–9'], ['sim','!@#'], ['claros','sem parecidos']].map(([k, r]) =>
        `<label class="check"><input type="checkbox" ${cofGer[k] ? 'checked' : ''} onchange="cofGer.${k} = this.checked; cofNova('${alvo}')"> ${r}</label>`).join('')}
      <span class="cof-forca" id="${alvo}-forca"></span>
    </div></div>`;
}
function cofNova(alvo){ const el = document.getElementById(alvo); if (!el) return; el.value = cofGerarSenha(); cofMedir(alvo); }
function cofMedir(alvo){
  const el = document.getElementById(alvo), f = cofForca(el?.value), out = document.getElementById(alvo + '-forca');
  if (out) out.innerHTML = f.bits ? `<span class="${f.c}">${f.l}</span> · ${f.bits} bits · ${el.value.length} caracteres` : '';
}
function cofCopiarCampo(alvo){ const v = document.getElementById(alvo)?.value; if (v) cofParaAreaDeTransferencia(v, 'Senha copiada'); }

/* ---------------- trocar a senha ---------------- */
function cofTrocar(id){
  const c = cofPorId(id); if (!c) return;
  const dias = cof.cfg?.anterior_dias ?? 30;
  abreModal(`<h3>${c.tem_senha ? 'Trocar a senha' : 'Pôr a senha'} · ${esc(cofNome(c))}</h3>
    <ol class="cof-passos">
      <li>O cofre gerou uma senha nova, abaixo. Copie.</li>
      <li>${c.tem_senha ? 'Troque no serviço' : 'Ponha no serviço'}${c.url ? ` — <a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">${esc(cofHost(c.url))}</a>` : ''}.
        ${c.tem_senha ? `Se ele pedir a senha atual, <button type="button" class="linkish" onclick="cofCopiar('${id}','senha')">copie a atual</button>.` : ''}</li>
      <li>Registre aqui a senha nova.${c.tem_senha && dias ? ` A atual fica guardada como anterior por ${dias} dias.` : ''}</li>
    </ol>
    ${cofGerador('cof-nova')}
    <p class="err-msg" id="cof-t-erro"></p>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="cof-t-btn" onclick="cofTrocarGrava('${id}')">Registrar a senha nova</button></div>`);
  cofNova('cof-nova');
}
async function cofTrocarGrava(id){
  const nova = $('#cof-nova')?.value || '', err = $('#cof-t-erro');
  if (!nova) return err.textContent = 'Gere ou escreva a senha nova.';
  const b = $('#cof-t-btn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('cofre_trocar_senha', { p_id: id, p_nova: nova });
  if (b) b.disabled = false;
  if (error) return err.textContent = cofMotivo(null, error, 'Não foi possível registrar');
  if (data?.status === 'invalido') return err.textContent = data.motivo === 'igual' ? 'É a mesma senha que já está no cofre.' : COF_CAMPO.senha;
  if (data?.status !== 'ok') return err.textContent = cofMotivo(data, null, 'Não foi possível registrar');
  fechaModal();
  toast(data.vence_em ? `Senha registrada. A próxima troca é até ${fmtD(data.vence_em)}.` : 'Senha registrada.');
  pageCofre(location.hash.split('/')[3] || '');
}

/* ============================================================
   O CÓDIGO DE DUAS ETAPAS NA CONFIGURAÇÃO
   O segredo chega colado (a "chave" que o serviço mostra quando não
   se consegue ler o QR), num link otpauth:// ou lido de uma imagem do
   QR. Aqui ele só é conferido — o código de agora, calculado no
   navegador, é o que o serviço pede para terminar de ligar o 2FA.
   Guardado, ele não volta mais: o código passa a vir do banco.
   ============================================================ */
const COF_ALFA32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function cofBase32(s){
  const t = String(s || '').toUpperCase().replace(/[\s=-]/g, '');
  if (!t || /[^A-Z2-7]/.test(t)) return null;
  const out = []; let buf = 0, bits = 0;
  for (const ch of t){ buf = (buf << 5) | COF_ALFA32.indexOf(ch); bits += 5;
    if (bits >= 8){ bits -= 8; out.push((buf >>> bits) & 255); buf &= (1 << bits) - 1; } }
  return new Uint8Array(out);
}
async function cofTotp(segredo, o = {}){
  const chave = cofBase32(segredo); if (!chave || !crypto.subtle) return null;
  const periodo = Number(o.periodo) || 30, digitos = Number(o.digitos) || 6;
  const hash = { SHA1:'SHA-1', SHA256:'SHA-256', SHA512:'SHA-512' }[String(o.algoritmo || 'SHA1').toUpperCase()] || 'SHA-1';
  const t = Math.floor(Date.now() / 1000 / periodo);
  const msg = new ArrayBuffer(8), v = new DataView(msg);
  v.setUint32(0, Math.floor(t / 0x100000000)); v.setUint32(4, t >>> 0);
  const k = await crypto.subtle.importKey('raw', chave, { name:'HMAC', hash }, false, ['sign']);
  const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg));
  const x = h[h.length - 1] & 15;
  const bin = ((h[x] & 127) << 24) | (h[x + 1] << 16) | (h[x + 2] << 8) | h[x + 3];
  return String(bin % 10 ** digitos).padStart(digitos, '0');
}
/* "otpauth://totp/Conta?secret=…&issuer=…" ou a chave solta */
function cofOtpauth(txt){
  const s = String(txt || '').trim();
  if (!s) return null;
  if (!/^otpauth:\/\//i.test(s)) return { segredo: s.toUpperCase().replace(/[\s=-]/g, ''), digitos:6, periodo:30, algoritmo:'SHA1' };
  let u; try { u = new URL(s); } catch(e){ return { erro:'link' }; }
  if (u.host.toLowerCase() !== 'totp') return { erro:'hotp' };
  const q = u.searchParams, rot = decodeURIComponent(u.pathname.replace(/^\//, ''));
  return { segredo:(q.get('secret') || '').toUpperCase().replace(/[\s=-]/g, ''), digitos:Number(q.get('digits') || 6),
    periodo:Number(q.get('period') || 30), algoritmo:(q.get('algorithm') || 'SHA1').toUpperCase(),
    emissor: q.get('issuer') || (rot.includes(':') ? rot.split(':')[0] : ''), conta: rot.includes(':') ? rot.split(':').slice(1).join(':').trim() : rot };
}
function cofTotpValido(o){
  return !!o && !o.erro && (cofBase32(o.segredo)?.length || 0) >= 10 && o.segredo.length >= 16
    && [6, 7, 8].includes(o.digitos) && [15, 30, 60].includes(o.periodo) && ['SHA1','SHA256','SHA512'].includes(o.algoritmo);
}
let cofTotpTimer = null;
async function cofTotpConferir(){
  const el = $('#cf-totp'), out = $('#cf-totp-ok'); if (!el || !out) return;
  clearInterval(cofTotpTimer);
  const o = cofOtpauth(el.value);
  if (!o){ out.innerHTML = ''; return; }
  if (o.erro) { out.innerHTML = `<span class="bad">${o.erro === 'hotp' ? 'Este link é de um código por contador (HOTP), que o cofre não gera.' : 'O link não pôde ser lido.'}</span>`; return; }
  if (!cofTotpValido(o)){ out.innerHTML = `<span class="bad">${esc(COF_CAMPO.totp)}</span>`; return; }
  const mostra = async () => {
    if (!document.body.contains(out)) return clearInterval(cofTotpTimer);
    const cod = await cofTotp(o.segredo, o);
    const r = o.periodo - Math.floor(Date.now() / 1000) % o.periodo;
    out.innerHTML = `<span class="ok">${ic('check')} Chave válida</span>${o.emissor ? ` · ${esc(o.emissor)}` : ''}${o.conta ? ` · ${esc(o.conta)}` : ''}
      · ${o.digitos} dígitos a cada ${o.periodo} s${o.algoritmo !== 'SHA1' ? ' · ' + o.algoritmo : ''}
      <span class="cof-agora">Código agora: <b class="mono">${esc(cofCodigoFmt(cod))}</b> <span class="dim">(${r} s)</span></span>`;
  };
  await mostra();
  cofTotpTimer = setInterval(mostra, 1000);
}
/* ler o QR de um print: o jsQR, sob demanda, do jsDelivr */
const COF_JSQR = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
async function cofLerQR(inp){
  const f = inp.files?.[0]; inp.value = '';
  if (!f) return;
  try{
    if (typeof window.jsQR !== 'function') await carregarLib(COF_JSQR);
    const url = URL.createObjectURL(f);
    const img = await new Promise((ok, erro) => { const i = new Image(); i.onload = () => ok(i); i.onerror = erro; i.src = url; });
    const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); URL.revokeObjectURL(url);
    const px = cx.getImageData(0, 0, cv.width, cv.height);
    const r = window.jsQR(px.data, cv.width, cv.height, { inversionAttempts:'attemptBoth' });
    if (!r?.data) return toast('Não achei um QR Code nessa imagem. Recorte só o QR e tente de novo — ou cole a chave.', true);
    if (!/^otpauth:\/\//i.test(r.data)) return toast('O QR Code dessa imagem não é de código de duas etapas.', true);
    $('#cf-totp').value = r.data; cofTotpConferir();
    toast('QR Code lido. Confira o código de agora com o que o serviço pede.');
  }catch(e){ falha(e, 'Não foi possível ler a imagem'); }
}

/* ============================================================
   CADASTRAR E MUDAR UMA CONTA
   ============================================================ */
async function cofFormulario(id, itemId){
  let c = null;
  if (id){
    c = cofPorId(id);
    if (!c || !c.mantem){ toast('Esta conta não está com você para mudar.', true); location.hash = '#/servicos/cofre'; return; }
  }
  const itens = (state.itensAcesso || []).filter(i => i.ativo !== false || i.id === c?.item_id);
  const cats = [...new Set(itens.map(i => i.categoria || 'outros'))];
  const gest = cof.gestor;
  cof.form = { id: c?.id || null, totp: c?.tem_totp ? 'manter' : 'novo', notas: c?.tem_notas ? 'manter' : 'novas',
               grupos: new Set(c?.grupos || []), resp: new Set(c?.responsaveis || []) };
  const padrao = cof.cfg?.rotacao_padrao_dias ?? 180;
  const prazos = [[null, `O padrão (${padrao ? padrao + ' dias' : 'sem troca'})`], [30, '30 dias'], [60, '60 dias'], [90, '90 dias'],
    [180, '180 dias'], [365, 'Um ano'], [0, 'Não pedir troca']];
  const atual = c && !c.rotacao_padrao ? c.rotacao_dias : null;
  if (atual != null && !prazos.some(([v]) => v === atual)) prazos.push([atual, `${atual} dias`]);
  const gs = (state.grupos || []).filter(g => g.ativo !== false).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ms = (state.membros || []).filter(m => !['Desligado','Egresso'].includes(m.status) || cof.form.resp.has(m.registro))
    .slice().sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  $('#main').innerHTML = `
    <a class="tre-voltar" href="#/servicos/cofre${gest ? '/gestao' : ''}" style="margin-top:22px">${ic('back')} ${gest ? 'Gestão do cofre' : 'Cofre de senhas'}</a>
    ${cofTopo(c ? `Editar ${esc(cofNome(c))}` : 'Nova conta no cofre',
      c ? 'A senha se troca pelo botão "Trocar a senha", na lista: a anterior fica guardada.' :
      'O endereço, o usuário e a senha — que o cofre gera —, o código de duas etapas, se o serviço tiver, e quem usa a conta.')}
    <div class="form-card cof-form">
      <div class="form-grid">
        <div class="fld full"><label for="cf-item">Acesso do catálogo</label>
          <select id="cf-item" ${gest ? '' : 'disabled'}><option value="">Escolha…</option>${cats.map(k => `<optgroup label="${esc(CAT_ACESSO[k] || k)}">${
            itens.filter(i => (i.categoria || 'outros') === k).map(i => `<option value="${esc(i.id)}" ${i.id === (c?.item_id || itemId) ? 'selected' : ''}>${esc(i.nome)}</option>`).join('')}</optgroup>`).join('')}</select>
          <p class="mini">Os acessos são os de Administração › Catálogo de acessos. Quem tem o acesso concedido na ficha usa a conta.</p></div>
        <div class="fld"><label for="cf-rot">Rótulo <span class="opc">(se o acesso tiver mais de uma conta)</span></label>
          <input id="cf-rot" maxlength="80" value="${esc(c?.rotulo || '')}" placeholder="Conta principal"></div>
        <div class="fld"><label for="cf-url">Endereço para entrar</label>
          <input id="cf-url" maxlength="500" value="${esc(c?.url || '')}" placeholder="https://accounts.google.com"></div>
        <div class="fld full"><label for="cf-usu">Usuário</label>
          <input id="cf-usu" maxlength="200" value="${esc(c?.usuario || '')}" placeholder="equipe@neurodynamics.dev" autocomplete="off" class="mono"></div>
        ${c ? '' : `<div class="fld full"><label for="cf-senha">Senha <span class="opc">(o cofre gera; ponha a mesma no serviço)</span></label>
          ${cofGerador('cf-senha')}
          <label class="check" style="margin-top:8px"><input type="checkbox" id="cf-sem-senha" onchange="$('#cf-senha').disabled = this.checked">
            A conta não tem senha (entra por outra conta, por link) — ou ela vem depois</label></div>`}
      </div>

      <div class="adm-grupo">Código de duas etapas</div>
      <div id="cf-2fa"></div>

      <div class="adm-grupo">Notas secretas</div>
      <div id="cf-notas-w"></div>

      <div class="fld" style="margin-top:14px"><label for="cf-instr">Instruções <span class="opc">(não são segredo: quem usa lê na lista)</span></label>
        <textarea id="cf-instr" rows="3" maxlength="2000" placeholder="Entre pelo navegador do laboratório. A conta é da equipe: não troque o e-mail de recuperação.">${esc(c?.instrucoes || '')}</textarea></div>

      ${gest ? `<div class="adm-grupo">Quem usa e quem mantém</div>
      <div class="cof-quem">
        <div class="fld"><label>Grupos que usam <span class="opc">(e os subgrupos)</span></label>
          <div class="multi" style="max-height:230px">${gs.map(g => `<label class="check"><input type="checkbox" class="cf-g" value="${g.id}"
            ${cof.form.grupos.has(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}</div>
          <p class="mini">Além dos grupos, usa quem tem o acesso do catálogo concedido na ficha.</p></div>
        <div class="fld"><label>Quem mantém <span class="opc">(troca a senha e recebe o lembrete)</span></label>
          <input type="search" placeholder="Filtrar" aria-label="Filtrar pessoas" oninput="cofFiltrarPessoas(this.value)" style="margin-bottom:6px">
          <div class="multi" id="cf-resp" style="max-height:192px">${ms.map(m => `<label class="check" data-n="${esc(norm(m.nome))}"><input type="checkbox" class="cf-r"
            value="${m.registro}" ${cof.form.resp.has(m.registro) ? 'checked' : ''}> ${esc(m.nome)}</label>`).join('')}</div>
          <p class="mini">Sem ninguém, o lembrete da troca vai para a gestão do cofre.</p></div>
      </div>
      <div class="form-grid">
        <div class="fld"><label for="cf-prazo">Prazo de troca da senha</label>
          <select id="cf-prazo">${prazos.map(([v, r]) => `<option value="${v == null ? '' : v}" ${v === atual ? 'selected' : ''}>${r}</option>`).join('')}</select>
          <p class="mini">${cof.cfg?.aviso_dias ?? 14} dias antes, quem mantém recebe o aviso no sino e por e-mail.</p></div>
        ${c ? `<div class="fld"><label>Situação</label><label class="check"><input type="checkbox" id="cf-ativo" ${c.ativo ? 'checked' : ''}>
          Ativa — desmarcada, some da lista de quem usa, e o que está guardado fica</label></div>` : ''}
      </div>` : `<p class="small dim" style="margin-top:12px">Quem usa, quem mantém e o prazo de troca são da gestão do cofre.</p>`}

      <p class="err-msg" id="cf-erro"></p>
      <div class="acts">
        <button class="btn solid" id="cf-salvar" onclick="cofSalvar()">${c ? 'Salvar' : 'Guardar no cofre'}</button>
        <a class="btn ghost" href="#/servicos/cofre${gest ? '/gestao' : ''}">Cancelar</a>
        ${c && gest ? `<button class="btn perigo" style="margin-left:auto" onclick="cofExcluir('${c.id}')">${ic('trash')} Excluir a conta</button>` : ''}
      </div>
    </div>`;
  if (!c) cofNova('cf-senha');
  cofDesenharTotp(); cofDesenharNotas();
}
function cofFiltrarPessoas(t){
  const q = norm(t || '');
  document.querySelectorAll('#cf-resp label').forEach(l => { l.hidden = !!q && !l.dataset.n.includes(q); });
}
function cofDesenharTotp(){
  const el = $('#cf-2fa'), f = cof.form; if (!el) return;
  const c = f.id ? cofPorId(f.id) : null;
  clearInterval(cofTotpTimer);
  if (f.totp === 'manter'){
    el.innerHTML = `<div class="cof-ja"><span>${ic('shield')} Ligado · ${c?.totp_digitos || 6} dígitos a cada ${c?.totp_periodo || 30} s.
      O segredo está no cofre e não se mostra.</span>
      <span class="acs"><button type="button" class="btn ghost mini" onclick="cof.form.totp = 'novo'; cofDesenharTotp()">Substituir</button>
      <button type="button" class="btn ghost mini" onclick="cof.form.totp = 'tirar'; cofDesenharTotp()">Desligar</button></span></div>`;
    return;
  }
  if (f.totp === 'tirar'){
    el.innerHTML = `<div class="cof-ja warn"><span>O código de duas etapas sai do cofre quando você salvar. Desligue também no serviço.</span>
      <span class="acs"><button type="button" class="btn ghost mini" onclick="cof.form.totp = 'manter'; cofDesenharTotp()">Desfazer</button></span></div>`;
    return;
  }
  el.innerHTML = `<div class="fld" style="margin-bottom:6px"><label for="cf-totp">A chave do serviço, ou o link otpauth://
      <span class="opc">(opcional)</span></label>
    <div class="cof-totp-l"><input id="cf-totp" class="mono" autocomplete="off" spellcheck="false" placeholder="JBSW Y3DP EHPK 3PXP …"
      oninput="cofTotpConferir()">
      <label class="btn ghost mini cof-qr">${ic('imagem')} Ler o QR de uma imagem<input type="file" accept="image/*" hidden onchange="cofLerQR(this)"></label>
      ${c?.tem_totp ? `<button type="button" class="btn ghost mini" onclick="cof.form.totp = 'manter'; cofDesenharTotp()">Manter o atual</button>` : ''}</div>
    <p class="mini">Ao ligar o 2FA, o serviço mostra um QR Code e, em "não consegue ler?", a chave. Cole a chave (ou tire um print do QR):
      o código de agora aparece aqui, para você terminar de ligar no serviço. Daí em diante, quem usa a conta gera o código pelo cofre.</p>
    <p class="cof-totp-ok" id="cf-totp-ok"></p></div>`;
  f.totp = 'novo';
}
function cofDesenharNotas(){
  const el = $('#cf-notas-w'), f = cof.form; if (!el) return;
  if (f.notas === 'manter'){
    el.innerHTML = `<div class="cof-ja"><span>${ic('cadeado')} Há notas guardadas — veja pela lista, em "Notas secretas".</span>
      <span class="acs"><button type="button" class="btn ghost mini" onclick="cof.form.notas = 'novas'; cofDesenharNotas()">Substituir</button>
      <button type="button" class="btn ghost mini" onclick="cof.form.notas = 'tirar'; cofDesenharNotas()">Apagar</button></span></div>`;
    return;
  }
  if (f.notas === 'tirar'){
    el.innerHTML = `<div class="cof-ja warn"><span>As notas saem do cofre quando você salvar.</span>
      <span class="acs"><button type="button" class="btn ghost mini" onclick="cof.form.notas = 'manter'; cofDesenharNotas()">Desfazer</button></span></div>`;
    return;
  }
  el.innerHTML = `<div class="fld" style="margin-bottom:0"><label for="cf-notas">Códigos de recuperação, perguntas de segurança
      <span class="opc">(opcional — ficam no cofre, como a senha)</span></label>
    <textarea id="cf-notas" rows="3" maxlength="5000" class="mono" autocomplete="off" spellcheck="false"></textarea></div>`;
}

async function cofSalvar(){
  const f = cof.form, err = $('#cf-erro'); err.textContent = '';
  const v = id => $(id)?.value ?? '';
  let url = v('#cf-url').trim();
  if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url;
  const p = { rotulo: v('#cf-rot').trim(), url, usuario: v('#cf-usu').trim(), instrucoes: v('#cf-instr').trim() };
  if (f.id) p.id = f.id;
  if (cof.gestor){
    p.item_id = v('#cf-item');
    if (!p.item_id) return err.textContent = COF_CAMPO.item_id;
    p.grupos = [...document.querySelectorAll('input.cf-g:checked')].map(x => Number(x.value));
    p.responsaveis = [...document.querySelectorAll('input.cf-r:checked')].map(x => Number(x.value));
    p.rotacao_dias = v('#cf-prazo') === '' ? null : Number(v('#cf-prazo'));
    if (f.id && $('#cf-ativo')) p.ativo = $('#cf-ativo').checked;
  }
  if (!f.id && !$('#cf-sem-senha')?.checked){
    p.senha = v('#cf-senha');
    if (!p.senha) return err.textContent = 'Gere a senha — ou marque que a conta não tem.';
  }
  if (f.totp === 'novo' && v('#cf-totp').trim()){
    const o = cofOtpauth(v('#cf-totp'));
    if (!cofTotpValido(o)) return err.textContent = COF_CAMPO.totp;
    p.totp = { segredo:o.segredo, digitos:o.digitos, periodo:o.periodo, algoritmo:o.algoritmo };
  } else if (f.totp === 'tirar') p.totp = null;
  if (f.notas === 'novas' && v('#cf-notas').trim()) p.notas = v('#cf-notas');
  else if (f.notas === 'tirar') p.notas = '';
  const b = $('#cf-salvar'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('cofre_salvar', { p });
    if (error) return err.textContent = cofMotivo(null, error, 'Não foi possível guardar');
    if (data?.status === 'invalido') return err.textContent = COF_CAMPO[data.campo] || 'Confira os campos.';
    if (data?.status !== 'ok') return err.textContent = data?.campo === 'gestao'
      ? 'Quem usa, quem mantém e o prazo são da gestão do cofre.' : cofMotivo(data, null, 'Não foi possível guardar');
    clearInterval(cofTotpTimer);
    toast(f.id ? 'Conta atualizada.' : 'Conta guardada no cofre.');
    location.hash = '#/servicos/cofre/' + data.id;
  } finally { const x = $('#cf-salvar'); if (x) x.disabled = false; }
}
async function cofExcluir(id){
  const c = cofPorId(id);
  const ok = await confirma(`Excluir <b>${esc(cofNome(c))}</b> do cofre? A senha, o código de duas etapas e as notas são apagados e não
    voltam. O registro de uso fica. Se a conta ainda existe no serviço, guarde a senha antes em outro lugar seguro.`, 'Excluir');
  if (!ok) return;
  const { data, error } = await sb.rpc('cofre_excluir', { p_id: id });
  if (error || data?.status !== 'ok') return toast(cofMotivo(data, error, 'Não foi possível excluir'), true);
  toast('Conta excluída do cofre.');
  location.hash = '#/servicos/cofre/gestao';
}

/* ============================================================
   A GESTÃO: todas as contas, os acessos sem conta, a exportação
   ============================================================ */
const cofQuemUsa = c => [(c.grupos || []).map(id => grupoPorId(id)?.nome).filter(Boolean).join(', '), 'acesso concedido']
  .filter(Boolean).join(' · ');
function cofGestao(){
  const l = cof.lista || [];
  const comConta = new Set(l.map(c => c.item_id));
  const sem = (state.itensAcesso || []).filter(i => i.ativo !== false && !comConta.has(i.id));
  const semCats = [...new Set(sem.map(i => i.categoria || 'outros'))].sort((a, b) => (a === 'sistema' ? -1 : b === 'sistema' ? 1 : 0));
  $('#main').innerHTML = `${cofTopo('Gestão do cofre',
      `${l.length} ${l.length === 1 ? 'conta' : 'contas'} no cofre. Para cada acesso do catálogo que tem conta, o endereço, o usuário e a senha —
       e quem usa, quem mantém e quando troca.`,
      `<button class="btn ghost" onclick="cofExportar()">${ic('down')} Exportar o registro</button>
       <a class="btn solid" href="#/servicos/cofre/nova">${ic('plus')} Nova conta</a>`)}
    ${cofNav('gestao')}
    ${l.length ? `<div class="tabela-rolar"><table class="tabela trabalho cof-tab"><thead><tr><th>Conta</th><th>Usuário</th><th>2FA</th>
      <th>Quem usa</th><th>Quem mantém</th><th>Troca</th><th>Situação</th><th>Último uso</th><th></th></tr></thead><tbody>
      ${l.map(c => { const s = COF_SIT[c.situacao] || { l:c.situacao, p:'', dt:'dt-gray' };
        return `<tr class="${c.ativo ? '' : 'off'}"><td><span class="nome">${esc(c.item_nome)}</span>${c.rotulo ? ` <span class="dim">— ${esc(c.rotulo)}</span>` : ''}</td>
          <td class="mono small">${esc(c.usuario || '—')}</td>
          <td>${c.tem_totp ? `<span class="tag-mini equipe" title="${c.totp_digitos} dígitos a cada ${c.totp_periodo} s">2FA</span>` : '<span class="dim">—</span>'}</td>
          <td class="small">${esc(cofQuemUsa(c))}</td>
          <td class="small">${esc((c.responsaveis_nomes || []).join(', ') || 'a gestão')}</td>
          <td class="small">${c.vence_em ? fmtD(c.vence_em) : '<span class="dim">—</span>'}<span class="dim" style="display:block">${c.rotacao_padrao ? 'padrão' : c.rotacao_dias ? c.rotacao_dias + ' dias' : 'sem troca'}</span></td>
          <td><span class="pill ${s.p}"><span class="dt ${s.dt}"></span>${s.l}</span></td>
          <td class="small">${c.ultimo_uso ? fmtDT(c.ultimo_uso) : '<span class="dim">nunca</span>'}</td>
          <td class="acoes-linha"><a class="btn ghost mini" href="#/servicos/cofre/editar/${c.id}">${ic('pencil')} Editar</a>
            <button class="icon-btn sm" title="Registro de uso" aria-label="Registro de uso de ${esc(cofNome(c))}" onclick="cofUso('${c.id}')">${ic('relogio')}</button></td></tr>`; }).join('')}
      </tbody></table></div>` : `<div class="vazio"><div class="glyph">${ic('cofre')}</div><h3>O cofre está vazio</h3>
        <p>Comece pelos sistemas do catálogo de acessos, abaixo: cada um que tem login ganha a sua conta.</p></div>`}
    <div class="tre-sec" style="margin-top:28px"><h2>Acessos do catálogo sem conta no cofre <span class="n">${sem.length}</span></h2>
      <p class="small muted" style="margin:4px 0 12px">Nem todo acesso tem conta — um local ou um termo, em geral, não tem.</p>
      ${sem.length ? semCats.map(k => `<div class="cof-sem"><span class="lb">${esc(CAT_ACESSO[k] || k)}</span>${sem.filter(i => (i.categoria || 'outros') === k)
        .map(i => `<a class="chip" href="#/servicos/cofre/nova/${esc(i.id)}">${ic('plus')} ${esc(i.nome)}</a>`).join('')}</div>`).join('')
        : '<p class="small muted">Todo acesso ativo do catálogo tem conta no cofre.</p>'}</div>`;
}

/* O registro de contas digitais — a NRO-DIR-003 do rol, no modelo da
   NRO: que conta existe, de qual acesso, quem usa, quem mantém, se tem
   2FA e quando a senha foi trocada. Segredo nenhum sai. */
async function cofExportar(){
  const t = setTimeout(() => toast('Preparando o PDF…'), 350);
  try{
    await precisaDocNRO();
    const [rol, em] = await Promise.all([
      sb.from('doc_rol').select('codigo,rev_vigente,prefixo').eq('codigo', 'NRO-DIR-003').maybeSingle(),
      sb.from('doc_emissores').select('nome').eq('prefixo', 'DIR').maybeSingle()
    ]);
    const contas = (cof.lista || []).map(c => ({ ...c, quem_usa: cofQuemUsa(c) }));
    const doc = DocNRO.registroContas(contas, { codigo: rol.data?.codigo || undefined, rev: rol.data?.rev_vigente || null,
      emissor: em.data?.nome || 'Diretoria', data: hojeISO(), autor: state.perfil?.nome || '' });
    DocNRO.baixar(doc);
  }catch(e){ falha(e, 'Não foi possível gerar o PDF'); }
  finally{ clearTimeout(t); }
}

/* ---------------- o registro de uso de todas ---------------- */
async function cofUsoTodos(){
  const { data, error } = await sb.rpc('cofre_log_ler', { p_id: null, p_limite: 500 });
  if (error){ $('#main').innerHTML = cofFaltaBanco(error); return; }
  const l = data || [];
  const contas = [...new Set(l.map(x => x.conta).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  $('#main').innerHTML = `${cofTopo('Registro de uso', 'Os quinhentos movimentos mais recentes do cofre: quem viu ou copiou um segredo, gerou um código, cadastrou, mudou ou excluiu uma conta.')}
    ${cofNav('uso')}
    <div class="cof-filtro">
      <select id="cu-conta" onchange="cofUsoFiltrar()" aria-label="Conta"><option value="">Todas as contas</option>${contas.map(c => `<option>${esc(c)}</option>`).join('')}</select>
      <select id="cu-acao" onchange="cofUsoFiltrar()" aria-label="O quê"><option value="">Tudo</option>
        <option value="segredo">Viu ou copiou um segredo</option><option value="codigo">Gerou um código</option><option value="gestao">Cadastrou, mudou, trocou, excluiu</option></select></div>
    ${l.length ? `<div class="tabela-rolar"><table class="tabela trabalho cof-tab"><thead><tr><th>Quando</th><th>Quem</th><th>O quê</th><th>Conta</th></tr></thead>
      <tbody>${l.map(x => `<tr data-conta="${esc(x.conta || '')}" data-tipo="${/^(viu|copiou)_/.test(x.acao) ? 'segredo' : x.acao === 'codigo' ? 'codigo' : 'gestao'}">
        <td class="small">${fmtDT(x.criado_em)}</td><td><span class="nome">${esc(x.nome || '—')}</span></td>
        <td>${esc(COF_ACAO[x.acao] || x.acao)}${x.detalhe ? `<span class="small dim" style="display:block">${esc(x.detalhe)}</span>` : ''}</td>
        <td class="small">${esc(x.conta || '—')}</td></tr>`).join('')}</tbody></table></div>`
      : '<div class="vazio"><div class="glyph">·</div><h3>Nada registrado ainda</h3><p>Quando alguém usar o cofre, aparece aqui.</p></div>'}`;
}
function cofUsoFiltrar(){
  const c = $('#cu-conta')?.value || '', t = $('#cu-acao')?.value || '';
  document.querySelectorAll('.cof-tab tbody tr').forEach(tr => { tr.hidden = (c && tr.dataset.conta !== c) || (t && tr.dataset.tipo !== t); });
}

/* ---------------- configurações ---------------- */
function cofConfig(){
  const c = cof.cfg || {}, admin = state.perfil?.papel === 'admin';
  const sel = new Set(c.grupos_gestores || []);
  const gs = (state.grupos || []).slice().sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  $('#main').innerHTML = `${cofTopo('Configurações do cofre', 'Quem gere o cofre e os prazos da troca das senhas.')}
    ${cofNav('config')}
    <div class="evx-cfg cof-cfg">
      <div class="card"><h3>Quem gere o cofre</h3>
        <p class="small muted" style="margin:4px 0 12px">Gere quem é admin e quem está num destes grupos (contando os subgrupos): cadastra e
          exclui contas, escolhe quem usa e quem mantém, lê o registro de uso de todas. ${admin ? '' : '<b>Só admin muda esta lista.</b>'}</p>
        <div class="multi" style="max-height:260px">${gs.map(g => `<label class="check"><input type="checkbox" class="cc-g" value="${g.id}"
          ${sel.has(g.id) ? 'checked' : ''} ${admin ? '' : 'disabled'}> ${esc(g.nome)}</label>`).join('')}</div></div>
      <div class="card"><h3>A troca das senhas</h3>
        <div class="fld" style="margin-top:10px"><label for="cc-rot">Prazo padrão, em dias</label>
          <input id="cc-rot" type="number" min="0" max="3650" value="${c.rotacao_padrao_dias ?? 180}">
          <p class="mini">Vale para as contas sem prazo próprio. Zero: o cofre não pede troca.</p></div>
        <div class="fld"><label for="cc-aviso">Avisar quantos dias antes</label>
          <input id="cc-aviso" type="number" min="1" max="90" value="${c.aviso_dias ?? 14}">
          <p class="mini">Quem mantém a conta recebe o aviso no sino e por e-mail, e de novo a cada semana enquanto não trocar.</p></div>
        <div class="fld"><label for="cc-ant">Guardar a senha anterior por quantos dias</label>
          <input id="cc-ant" type="number" min="0" max="365" value="${c.anterior_dias ?? 30}">
          <p class="mini">Para o caso de o serviço não ter aceitado a troca. Zero: a anterior é apagada na hora.</p></div>
        <button class="btn solid" onclick="cofConfigSalvar()">Salvar</button></div>
    </div>`;
}
async function cofConfigSalvar(){
  const n = (id, min, max) => { const x = Number($(id)?.value); return Number.isInteger(x) && x >= min && x <= max ? x : null; };
  const d = { rotacao_padrao_dias: n('#cc-rot', 0, 3650), aviso_dias: n('#cc-aviso', 1, 90), anterior_dias: n('#cc-ant', 0, 365) };
  if (Object.values(d).some(x => x == null)) return toast('Confira os números: prazo de 0 a 3650, aviso de 1 a 90 e anterior de 0 a 365 dias.', true);
  if (state.perfil?.papel === 'admin') d.grupos_gestores = [...document.querySelectorAll('input.cc-g:checked')].map(x => Number(x.value));
  const { error } = await sb.from('cofre_config').update(d).eq('id', true);
  if (error) return falha(error, /cofre_so_admin/.test(error.message || '') ? 'Só admin escolhe quem gere o cofre' : 'Não foi possível salvar');
  toast('Configurações do cofre salvas.');
  pageCofre('config');
}

/* ---------------- a busca ---------------- */
registrarBusca({
  fonte: 'cofre',
  rotulo: 'Cofre de senhas',
  buscar: termo => {
    const t = norm(termo);
    return (cof.lista || []).filter(c => norm(cofNome(c)).includes(t) || norm(c.usuario || '').includes(t) || norm(cofHost(c.url)).includes(t))
      .slice(0, 6).map(c => ({ titulo: cofNome(c), sub: [c.usuario, cofHost(c.url)].filter(Boolean).join(' · ') || 'Cofre de senhas',
        href: '#/servicos/cofre/' + c.id, peso: 3 }));
  }
});
