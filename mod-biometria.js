/* ============================================================
   MÓDULO · ACESSO BIOMÉTRICO AO LABBIO (2.19.1, ficha L6)
   O pedido do membro (#/servicos/biometria): pedido, dados e foto.
   Também serve o bloco do Pessoal no card da solicitação.
   Contrato: fichas/CONTRATO-LABBIO.md ("Pedido de biometria").

   Depende da casca para: sb, $, esc, state, toast, falha, confirma,
   fmtDT, ic, cabecalho, estado, etapas, layoutFluxo, layoutLeitura,
   spec, TEMPOS, motivoRPC.
   ============================================================ */
const bio = { d:null, passo:'pedido', just:'', tempo:'', stream:null, blob:null, enviando:false,
  vez:0, timer:null, origem:null, semVerificacao:false };   // 2.19.2: a verificação ao vivo (mod-biometria-rosto.js)
const BIO_PASSOS = [['pedido', 'Pedido'], ['dados', 'Dados'], ['foto', 'Foto']];
const BIO_EVENTO = { pessoal:'Enviado ao Pessoal', labbio:'Encaminhado ao LABBIO', devolvido:'Devolvido para correção', negado_pessoal:'Negado',
  negado_labbio:'Negado', concedido:'Acesso cadastrado', cancelado:'Cancelado', rascunho:'Em rascunho' };
const BIO_CAMPOS = { nome_civil:'Nome civil', cpf:'CPF', matricula:'Matrícula', nome:'Nome', confirmado_em:'Dados conferidos em' };
const BIO_ABERTO = ['rascunho', 'pessoal', 'labbio', 'devolvido'];
const BIO_ERRO = { foto_pendente:'A foto não chegou. Tente de novo.', dados_pendentes:'Confira seus dados antes de enviar.',
  conflito:'O pedido mudou em outra tela. Recarregue.', encerrado:'Este pedido já foi encerrado.' };

/* a trilha: uma linha por movimento, o último em destaque (também no card do Pessoal) */
function bioTrilha(p){
  const ev = (p?.eventos || []);
  if (!ev.length) return '<p class="small muted">Nenhum movimento ainda.</p>';
  return `<ol class="bio-trilha">${ev.map((e, i) => `<li${i === ev.length - 1 ? ' class="atual" aria-current="step"' : ''}>
    <b>${esc(BIO_EVENTO[e.para] || e.para)}</b> <span class="small muted">${esc(e.ator_nome || '')}, ${fmtDT(e.quando)}</span>
    ${e.motivo ? `<div class="small muted">${esc(e.motivo)}</div>` : ''}</li>`).join('')}</ol>`;
}
function bioParar(){
  try { bio.stream?.getTracks().forEach(t => t.stop()); } catch(_){}
  bio.stream = null;
  clearTimeout(bio.timer); bio.vez++;   // para a verificação ao vivo
}
window.addEventListener('hashchange', bioParar);

async function pageBiometria(sub2){
  bioParar();
  const topo = cabecalho({ espaco:'Serviços', titulo:'Acesso biométrico ao LABBIO', voltar:['Todos os serviços', '#/servicos'] });
  $('#main').innerHTML = topo + estado.carregando();
  try{
    const { data, error } = await sb.rpc('labbio_pedido_meu');
    if (error) throw error;
    if (data?.status !== 'ok'){ $('#main').innerHTML = topo + estado.vazio({ texto: data?.status === 'sem_registro'
      ? 'Sua conta ainda não está ligada a um registro do quadro. Fale com o Depto. de Pessoal.' : 'Não foi possível abrir o pedido agora.' }); return; }
    bio.d = data;
    if (data.tem_acesso){ $('#main').innerHTML = topo + layoutLeitura(`<p class="lead">${ic('selo')} Você já tem acesso biométrico ao LABBIO.</p>`); return; }
    const p = data.pedido, aberto = p && BIO_ABERTO.includes(p.etapa);
    /* pedido que já está com o Pessoal ou com o LABBIO: só a trilha */
    if (aberto && ['pessoal', 'labbio'].includes(p.etapa)) return bioAcompanhar(topo, p);
    if (!bio.just && p?.justificativa) bio.just = p.justificativa;
    if (!bio.tempo && p?.tempo) bio.tempo = p.tempo;
    bio.passo = BIO_PASSOS.some(([k]) => k === sub2) ? sub2 : 'pedido';
    bioFluxo(topo, aberto ? p : null);
  }catch(e){
    $('#main').innerHTML = topo + estado.erro({ texto:'Não foi possível carregar o pedido: ' + e.message + '.', acao:'<button class="btn ghost mini" onclick="pageBiometria()">Tentar de novo</button>' });
  }
}

/* a barra de progresso da análise (2.19.2): enviado, Pessoal, LABBIO, acesso cadastrado */
const BIO_PROGRESSO = [['enviado', 'Enviado'], ['pessoal', 'Depto. de Pessoal'], ['labbio', 'LABBIO'], ['concedido', 'Acesso cadastrado']];
function bioProgresso(p){
  const atual = { pessoal:'pessoal', labbio:'labbio', concedido:'concedido', negado_pessoal:'pessoal', negado_labbio:'labbio',
    devolvido: p.devolvido_por === 'labbio' ? 'labbio' : 'pessoal' }[p.etapa] || 'enviado';
  const i = BIO_PROGRESSO.findIndex(([k]) => k === atual), parado = /^negado|devolvido/.test(p.etapa);
  const pct = Math.round((p.etapa === 'concedido' ? 1 : i / (BIO_PROGRESSO.length - 1)) * 100);
  const msg = { pessoal:'O Depto. de Pessoal está analisando o pedido.', labbio:'Aprovado pelo Pessoal. O LABBIO vai cadastrar a sua biometria.',
    concedido:'O LABBIO cadastrou a sua biometria.', negado_pessoal:'Negado pelo Depto. de Pessoal.', negado_labbio:'Negado pelo LABBIO.',
    devolvido:'Devolvido para correção.' }[p.etapa] || '';
  return `<div class="bio-prog${parado ? ' parado' : ''}" role="group" aria-label="Andamento do pedido">
    <div class="bio-prog-barra" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-valuetext="${esc(msg)}"><span style="width:${pct}%"></span></div>
    <ol>${BIO_PROGRESSO.map(([k, rot], j) => `<li class="${j < i || p.etapa === 'concedido' ? 'feita' : j === i ? 'atual' : ''}"${j === i ? ' aria-current="step"' : ''}>${esc(rot)}</li>`).join('')}</ol>
    <p class="small">${esc(msg)}</p></div>`;
}
function bioAcompanhar(topo, p){
  $('#main').innerHTML = topo + layoutLeitura(`
    <p class="lead">Pedido ${esc(p.protocolo || '')}: ${esc(BIO_EVENTO[p.etapa] || p.etapa)}.</p>${bioProgresso(p)}${bioTrilha(p)}
    <div class="acts"><button class="btn ghost" type="button" onclick="bioCancelar('${esc(p.id)}')">Cancelar o pedido</button></div>`);
}
async function bioCancelar(id){
  if (!await confirma('O pedido deixa de andar. Você pode abrir outro depois.', 'Cancelar o pedido')) return;
  try{
    const { data, error } = await sb.rpc('labbio_pedido_cancelar', { p_id:id });
    if (error) throw error;
    if (data?.status !== 'ok') throw new Error(data?.status || 'falhou');
    bio.just = ''; bio.tempo = ''; toast('Pedido cancelado.'); pageBiometria();
  }catch(e){ falha(e, 'Não foi possível cancelar'); }
}

function bioFluxo(topo, p){
  const rota = k => '#/servicos/biometria/' + k;
  const dev = p?.etapa === 'devolvido'
    ? `<div class="aviso-box warn" role="status"><b>Devolvido para correção${p.devolvido_por === 'labbio' ? ' pelo LABBIO' : ' pelo Pessoal'}.</b> ${esc((p.eventos || []).filter(e => e.para === 'devolvido').at(-1)?.motivo || '')}</div>` : '';
  const i = BIO_PASSOS.findIndex(([k]) => k === bio.passo);
  const corpo = { pedido:bioPassoPedido, dados:bioPassoDados, foto:bioPassoFoto }[bio.passo](p);
  const acoes = [i > 0 ? `<a class="btn ghost" href="${rota(BIO_PASSOS[i - 1][0])}">Etapa anterior</a>` : '',
    bio.passo === 'pedido' ? '<button class="btn solid" type="button" id="bio-continuar" onclick="bioContinuarPedido()">Continuar</button>'
    : bio.passo === 'dados' ? (bio.d.dados ? `<a class="btn solid" href="${rota('foto')}">Continuar</a>` : '') : ''].join('');
  $('#main').innerHTML = topo + dev + (p ? `<details class="small" style="margin-bottom:14px"><summary>Movimentos do pedido</summary>${bioTrilha(p)}</details>` : '')
    + layoutFluxo({ passos:etapas(BIO_PASSOS, bio.passo, rota), corpo, acoes });
  if (bio.passo === 'foto') bioCamera();
  if (bio.passo === 'pedido') document.querySelectorAll('#bio-tempo .chip').forEach(c => c.classList.toggle('on', c.dataset.t === bio.tempo));
}
function bioPassoPedido(){
  return `<div class="fld"><label for="bio-just">Justificativa</label>
      <textarea id="bio-just" rows="3" placeholder="Atividade ou projeto que exige acesso ao laboratório" oninput="bio.just=this.value">${esc(bio.just)}</textarea>
      <p class="mini">Mínimo de 10 caracteres.</p></div>
    <div class="fld"><label>Tempo de acesso</label><div class="chips" id="bio-tempo">${TEMPOS.filter(t => t !== 'Outro').map(t =>
      `<button type="button" class="chip" data-t="${esc(t)}" onclick="bio.tempo=this.dataset.t;document.querySelectorAll('#bio-tempo .chip').forEach(c=>c.classList.toggle('on',c===this))">${esc(t)}</button>`).join('')}</div></div>
    <p class="err-msg" id="bio-erro"></p>`;
}
async function bioContinuarPedido(){
  const er = $('#bio-erro'), bt = $('#bio-continuar'); er.textContent = '';
  if ((bio.just || '').trim().length < 10){ er.textContent = 'Escreva uma justificativa de pelo menos 10 caracteres.'; return; }
  if (!bio.tempo){ er.textContent = 'Escolha por quanto tempo precisa do acesso.'; return; }
  const p = bio.d.pedido;
  if (p && BIO_ABERTO.includes(p.etapa)){ location.hash = '#/servicos/biometria/dados'; return; }
  bt.disabled = true;
  try{
    const { data, error } = await sb.rpc('labbio_pedido_criar', { p_justificativa:bio.just.trim(), p_tempo:bio.tempo });
    if (error) throw error;
    if (data?.status === 'invalido'){ er.textContent = data.campo === 'tempo' ? 'Escolha por quanto tempo precisa do acesso.' : 'Escreva uma justificativa de pelo menos 10 caracteres.'; return; }
    if (data?.status === 'ja_tem_acesso'){ pageBiometria(); return; }
    if (!['ok', 'ja_existe'].includes(data?.status)) throw new Error(data?.status || 'falhou');
    bio.d.pedido = data.pedido; location.hash = '#/servicos/biometria/dados';
  }catch(e){ falha(e, 'Não foi possível abrir o pedido'); }
  finally{ bt.disabled = false; }
}
function bioPassoDados(){
  const d = bio.d.dados;
  if (!d) return `<div class="aviso-box warn"><b>Confira seus dados primeiro.</b> O cadastro na biometria usa o nome civil, o CPF e a matrícula.
    <a href="#/servicos/dados?de=biometria">Conferir meus dados</a></div>`;
  return `<p class="small muted" style="margin-bottom:10px">Estes dados vão para o LABBIO, que os usa só para cadastrar o seu acesso.</p>
    ${spec((bio.d.campos || Object.keys(BIO_CAMPOS)).filter(k => k in d).map(k => [BIO_CAMPOS[k] || k, esc(k === 'confirmado_em' ? fmtDT(d[k]) : d[k])]))}
    <p class="small muted">Conferidos em ${fmtDT(d.confirmado_em)}. <a href="#/servicos/dados?de=biometria">Corrigir</a></p>`;
}

/* a foto: câmera com verificação ao vivo, ou um arquivo sem verificação; prévia, refazer ou usar */
const BIO_REQUISITOS = ['Rosto de frente, inteiro, sem óculos escuros, boné ou máscara.',
  'Fundo claro e liso, de cor diferente da pele e do cabelo.',
  'Luz de frente, sem sombra de um lado só e sem contraluz.',
  'Só uma pessoa, sem filtros nem edição.',
  'JPEG ou PNG, até 5 MB. O centro da foto é recortado em um quadrado.'];
function bioPassoFoto(){
  return `<div class="bio-foto"><div class="bio-cena" id="bio-cena">
      <video id="bio-video" autoplay playsinline muted aria-label="Câmera"></video><span class="bio-guia" aria-hidden="true"></span>
      <canvas id="bio-canvas" width="720" height="720" hidden></canvas></div>
    <div class="bio-lado">
      <div class="bio-req"><p><b>Requisitos da foto</b></p><ul>${BIO_REQUISITOS.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
      <div id="bio-pela-camera"><p><b>Pela câmera</b></p>
        <div id="bio-sem-camera" hidden><div class="aviso-box warn">Não conseguimos usar a câmera. Libere o acesso no navegador, ou envie uma foto abaixo (o pedido fica salvo).</div></div>
        <div id="bio-verif"><p class="small muted">A câmera confere o rosto, o enquadramento, a luz e o contraste, no seu aparelho: a imagem não sai dele.</p>
          <div id="bio-checklist"></div><p class="small" id="bio-verif-nota" role="status"></p></div>
        <div class="acts" id="bio-acoes"><button class="btn solid" type="button" id="bio-tirar" onclick="bioTirar()" disabled>Tirar a foto</button></div></div>
      <div class="bio-upload" id="bio-upload"><p><b>Ou envie uma foto</b></p>
        <p class="small muted">Sem verificação automática: o Pessoal e o LABBIO conferem os requisitos acima e podem devolver o pedido se a foto não servir.</p>
        <div class="fld"><label for="bio-arq">Escolher um arquivo</label><input id="bio-arq" type="file" accept="image/jpeg,image/png" onchange="bioArquivo(this.files[0])"></div></div>
      <p class="err-msg" id="bio-erro" role="alert"></p></div></div>`;
}
async function bioCamera(){
  bio.blob = null; bio.origem = null; bio.semVerificacao = false;
  try{
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('sem câmera');
    const s = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:'user' } });
    const v = $('#bio-video');
    if (!v || bio.passo !== 'foto'){ s.getTracks().forEach(t => t.stop()); return; }
    bio.stream = s; v.srcObject = s; await v.play().catch(() => {});
  }catch(_){
    $('#bio-sem-camera')?.removeAttribute('hidden');
    $('#bio-verif')?.setAttribute('hidden', ''); $('#bio-acoes')?.setAttribute('hidden', '');
    return;
  }
  /* a verificação ao vivo vem num módulo à parte; se ele não carregar, a câmera segue sem ela */
  try{
    await carregarModulo('biometria-rosto');
    $('#bio-checklist').innerHTML = bioChecklistHTML();
    bioVerificar();
  }catch(_){
    bio.semVerificacao = true;
    const n = $('#bio-verif-nota'); if (n) n.textContent = 'Não foi possível ligar a verificação automática. Confira os requisitos ao lado e tire a foto: o Pessoal e o LABBIO analisam o pedido.';
    const b = $('#bio-tirar'); if (b) b.disabled = false;
  }
}
function bioQuadro(origem, w, h){
  const c = $('#bio-canvas'), l = Math.min(w, h), ctx = c.getContext('2d');
  ctx.drawImage(origem, (w - l) / 2, (h - l) / 2, l, l, 0, 0, 720, 720);
}
function bioPrevia(){
  const c = $('#bio-canvas'), v = $('#bio-video'); if (!c) return;
  v.hidden = true; c.hidden = false; $('#bio-cena')?.classList.add('previa');
  ['#bio-verif', '#bio-upload', '#bio-sem-camera'].forEach(s => { const e = $(s); if (e) e.hidden = true; });
  const nota = bio.origem === 'arquivo' ? 'Foto enviada por arquivo, sem verificação automática. Confira os requisitos: o Pessoal e o LABBIO podem devolver o pedido se ela não servir.'
    : bio.semVerificacao ? 'Foto tirada sem a verificação automática. Confira os requisitos antes de usar.' : 'Foto tirada pela câmera, depois da verificação.';
  const a = $('#bio-acoes'); a.hidden = false;
  a.innerHTML = `<p class="small muted" id="bio-origem-nota" style="flex-basis:100%;margin:0 0 6px">${esc(nota)}</p>
    <button class="btn ghost" type="button" onclick="bioRefazer()">Refazer</button>
    <button class="btn solid" type="button" id="bio-usar" onclick="bioUsar()">Usar esta foto</button>`;
}
function bioTirar(){
  const v = $('#bio-video'); if (!v?.videoWidth) { $('#bio-erro').textContent = 'A câmera ainda não está pronta. Espere um instante.'; return; }
  bio.origem = 'camera'; bioQuadro(v, v.videoWidth, v.videoHeight); bioParar(); bioPrevia();
}
function bioArquivo(f){
  if (!f) return;
  if (!['image/jpeg', 'image/png'].includes(f.type) || f.size > 5 * 1024 * 1024){ $('#bio-erro').textContent = 'Use JPEG ou PNG de até 5 MB.'; return; }
  bioParar();   // o arquivo não passa pela verificação: a câmera e o laço ao vivo param
  const img = new Image(); img.onload = () => { bio.origem = 'arquivo'; bioQuadro(img, img.naturalWidth, img.naturalHeight); URL.revokeObjectURL(img.src); bioPrevia(); };
  img.onerror = () => { $('#bio-erro').textContent = 'Não foi possível ler a imagem.'; };
  img.src = URL.createObjectURL(f);
}
function bioRefazer(){ pageBiometria('foto'); }
async function bioUsar(){
  if (bio.enviando) return;
  const er = $('#bio-erro'), bt = $('#bio-usar'); er.textContent = ''; bio.enviando = true; bt.disabled = true;
  try{
    const p = bio.d.pedido, reg = state.perfil.registro;
    const blob = await new Promise(r => $('#bio-canvas').toBlob(r, 'image/jpeg', 0.9));
    if (!blob) throw new Error('não foi possível gerar a foto');
    const caminho = `${reg}/${p.id}/${p.versao}.jpg`;
    const up = await sb.storage.from('biometria').upload(caminho, blob, { contentType:'image/jpeg', upsert:true });
    if (up.error) throw up.error;
    const { data, error } = await sb.rpc('labbio_pedido_enviar', { p_id:p.id, p_versao:p.versao, p_foto_path:caminho,
      p_justificativa:(bio.just || '').trim() || null, p_tempo:bio.tempo || null });
    if (error) throw error;
    if (data?.status !== 'ok'){ er.textContent = BIO_ERRO[data?.status] || motivoRPC(data, null, 'Não foi possível enviar o pedido'); return; }
    bio.just = ''; bio.tempo = ''; toast('Pedido enviado ao Pessoal.'); pageBiometria();
  }catch(e){ er.textContent = 'Não foi possível enviar agora: ' + (e.message || e) + '.'; }
  finally{ bio.enviando = false; const b = $('#bio-usar'); if (b) b.disabled = false; }
}

/* ---------------- o Pessoal: o bloco no card da solicitação ---------------- */
async function bioPessoalBloco(id){
  const el = document.getElementById('bio-pessoal'); if (!el) return;
  try{
    const { data, error } = await sb.rpc('labbio_pedido_ler', { p_id:id });
    if (error || data?.status !== 'ok') throw error || new Error(data?.status);
    const p = data.pedido, env = p.enviada || {}, dados = env.dados || {};
    bio.pedidoPessoal = p;
    const meu = p.registro === state.perfil?.registro && state.perfil?.papel !== 'admin';
    const acoes = p.etapa === 'pessoal' && meu ? `<p class="small muted">Este pedido é seu: outra pessoa do Depto. de Pessoal decide.</p>`
      : p.etapa === 'pessoal' ? `<p class="small muted">Encaminhar não concede o acesso: o LABBIO cadastra a biometria e confirma no painel dele.</p>
      <div class="acts"><button class="btn solid" type="button" onclick="bioPessoalAcao('encaminhar')">Encaminhar ao LABBIO</button>
        <button class="btn ghost" type="button" onclick="bioPessoalAcao('devolver')">Devolver para correção</button>
        <button class="btn ghost" type="button" onclick="bioPessoalAcao('negar')">Negar</button></div>`
      : `<p class="small muted">Este pedido está em: ${esc(BIO_EVENTO[p.etapa] || p.etapa)}.</p>`;
    el.innerHTML = `<h3 style="margin-bottom:8px">Pedido de acesso biométrico</h3>
      ${spec(Object.entries(dados).filter(([k, v]) => v != null && v !== '').map(([k, v]) => [BIO_CAMPOS[k] || k, esc(k === 'confirmado_em' ? fmtDT(v) : v)]))}
      <div id="bio-pessoal-foto" class="small muted" style="margin:10px 0">Carregando a foto…</div>
      <h4 style="margin:12px 0 6px">Movimentos</h4>${bioTrilha(p)}${acoes}`;
    if (env.foto_path){
      const u = await sb.storage.from('biometria').createSignedUrl(env.foto_path, 120);
      const f = document.getElementById('bio-pessoal-foto');
      if (f) f.innerHTML = u.data?.signedUrl ? `<img src="${esc(u.data.signedUrl)}" alt="Foto enviada" style="width:160px;border-radius:12px">` : 'Não foi possível abrir a foto agora.';
    } else document.getElementById('bio-pessoal-foto').textContent = 'Sem foto.';
  }catch(e){ el.innerHTML = `<div class="aviso-box err">Não foi possível carregar o pedido de biometria${e?.message ? ': ' + esc(e.message) : ''}.</div>`; }
}
function bioPessoalAcao(acao){
  if (acao === 'encaminhar') return bioPessoalEnviar(acao, null);
  const rot = acao === 'negar' ? 'Negar o pedido' : 'Devolver para correção';
  abreModal(`<h3>${rot}</h3><div class="fld"><label for="bio-motivo">Motivo (obrigatório)</label><textarea id="bio-motivo" rows="3"></textarea></div>
    <p class="small" id="bio-motivo-erro" style="color:var(--bad-tx)"></p>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="bioPessoalEnviar('${acao}', $('#bio-motivo').value.trim())">${rot}</button></div>`);
}
async function bioPessoalEnviar(acao, motivo){
  const p = bio.pedidoPessoal;
  if (acao !== 'encaminhar' && !motivo){ const e = $('#bio-motivo-erro'); if (e) e.textContent = 'Escreva o motivo.'; return; }
  try{
    const { data, error } = await sb.rpc('labbio_pedido_pessoal', { p_id:p.id, p_versao:p.versao, p_acao:acao, p_motivo:motivo || null });
    if (error) throw error;
    if (data?.status !== 'ok'){ const m = BIO_ERRO[data?.status] || motivoRPC(data, null, 'Não foi possível registrar'); const e = $('#bio-motivo-erro'); if (e) e.textContent = m; else toast(m, true); return; }
    fechaModal(); toast(acao === 'encaminhar' ? 'Encaminhado ao LABBIO.' : acao === 'negar' ? 'Pedido negado.' : 'Pedido devolvido ao membro.');
    bioPessoalBloco(p.id);
  }catch(e){ falha(e, 'Não foi possível registrar'); }
}
