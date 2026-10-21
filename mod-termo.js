/* ============================================================
   MÓDULO · TERMO DE SIGILO DO LABBIO (2.19.1)
   Carregado sob demanda em #/servicos/termo.

   Um serviço à parte da conferência dos dados: o termo sai preenchido
   com a última confirmação de Meus dados (mod-cadastro.js), que precisa
   ter até 180 dias. Sem ela, o serviço manda conferir primeiro.

     1. Baixar    o modelo original do LABBIO (termos/), conferido pelo
                  SHA-256, com os campos do próprio formulário preenchidos
                  e travados. Nada mais muda no arquivo.
     2. Assinar   no assinador do gov.br.
     3. Enviar    o PDF assinado sobe como veio (sem reescrever, para não
                  quebrar a assinatura), com o SHA-256 registrado.

   Depende da casca para: sb, $, esc, state, toast, cabecalho, etapas,
   layoutFluxo, layoutLeitura, carregarScript, ic, estado, fmtD, fmtDT.
   ============================================================ */

const TERMO_PASSOS = [['baixar', 'Baixar'], ['assinar', 'Assinar no gov.br'], ['enviar', 'Enviar o assinado']];
const PDFLIB_URL = 'vendor/pdf-lib-1.17.1.min.js';   /* local, como o jsPDF */
const ASSINADOR_URL = 'https://assinador.iti.br/';
/* 2.19.2: a pasta com os termos que alguns membros já preencheram e assinaram */
const TERMO_PASTA_URL = 'https://drive.google.com/drive/folders/1ZVVSVLobECM1G92qcdBjGSKzTYkAIbHq4ANVNKt5-FvcWJQcYf9gy4nRuThkOIq00HDUFwXG?usp=drive_link';
const TERMO_AVISO_TESTEMUNHAS = 'O campo de testemunhas não precisa ser preenchido.';
const termoM = { estado: null, arquivo: null, existente: false };
/* o aviso de quem já tem o termo, igual no recadastro e no fluxo do termo */
const termoAvisoExistente = () => `<div class="aviso-box info termo-ja">
  <b>Já tem o termo preenchido e assinado?</b> Alguns membros já têm: procure o seu na
  <a href="${TERMO_PASTA_URL}" target="_blank" rel="noopener">pasta dos termos ↗</a>. Se ele estiver conforme (os seus dados de hoje e a
  assinatura na linha do receptor da informação), envie esse mesmo arquivo em <a href="#/servicos/termo/enviar?ja=1">Enviar o assinado</a>; não precisa baixar um novo.
  ${TERMO_AVISO_TESTEMUNHAS}</div>`;

/* como cada campo sai no termo (os nomes são os do formulário do PDF) */
function termoCampos(d, data){
  const cpf = String(d.cpf || '').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  const cep = String(d.end_cep || '').replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2-$3');
  let end1 = `${d.end_logradouro}, nº ${d.end_numero}`, end2 = `bairro ${d.end_bairro}, CEP ${cep}`;
  if (d.end_complemento){ if ((end1 + ', ' + d.end_complemento).length <= 40) end1 += ', ' + d.end_complemento; else end2 = d.end_complemento + ', ' + end2; }
  return {
    nome: d.nome_civil, nacionalidade: d.nacionalidade, 'estado civil': d.estado_civil, RG: d.rg, expedidor: d.rg_orgao,
    CPF: cpf, end1, end2, 'cidade uf': `${d.end_cidade}, ${d.end_uf}`,
    text_10hsic: data ? String(data.dia) : '', text_11ahqw: data ? data.mes : '', text_12giky: data ? String(data.ano) : ''
  };
}

const TERMO_TIT = 'Termo de sigilo do LABBIO';
async function pageTermo(sub){
  $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: TERMO_TIT }) + estado.carregando();
  const { data, error } = await sb.rpc('termo_estado');
  if (error || !data){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: TERMO_TIT })
      + estado.erro({ texto: 'Não foi possível carregar o termo agora. Tente de novo em instantes.', acao: '<button class="btn ghost mini" onclick="pageTermo()">Tentar de novo</button>' });
    return;
  }
  termoM.estado = data;
  if (data.status === 'nenhum'){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: TERMO_TIT })
      + estado.vazio({ texto: 'Nenhum termo de sigilo pedido para você agora.' });
    return;
  }
  const passo = TERMO_PASSOS.some(([k]) => k === sub) ? sub
    : ['enviado', 'conferido'].includes(data.status) ? 'fim' : !data.emitido_em ? 'baixar' : 'enviar';
  termoDesenhar(passo);
}

function termoCab(){
  return cabecalho({ espaco: 'Serviços', titulo: TERMO_TIT,
    lead: 'Todos os membros regularizam o termo de sigilo do LABBIO: baixe, assine no gov.br e envie o arquivo assinado. Quem já tem o termo preenchido e assinado pode enviar esse mesmo arquivo, se estiver conforme.' });
}

function termoDesenhar(passo){
  const e = termoM.estado;
  const aviso = e.status === 'devolvido' ? `<div class="aviso-box err" role="alert"><b>O Pessoal devolveu o termo enviado.</b> ${esc(e.motivo || '')} Envie de novo.</div>` : '';
  if (passo === 'fim'){
    $('#main').innerHTML = termoCab() + layoutLeitura(`
      <div class="termo-fim">${ic('selo')}
        <h2>${e.status === 'conferido' ? 'Termo conferido' : 'Termo enviado'}</h2>
        <p>${e.status === 'conferido' ? 'O Pessoal conferiu o seu termo. Não há mais nada a fazer.'
          : `Recebido em ${fmtDT(e.enviado_em)}. O Pessoal confere o arquivo; se algo estiver errado, você recebe um aviso com o motivo.`}</p></div>`);
    return;
  }
  const rota = k => `#/servicos/termo/${k}`;
  const corpo = { baixar: termoPrevia, assinar: termoAssinar, enviar: termoEnviar }[passo]();
  $('#main').innerHTML = termoCab() + aviso + (passo !== 'enviar' ? termoAvisoExistente() : '') + layoutFluxo({ passos: etapas(TERMO_PASSOS, passo, rota), corpo: corpo.html,
    salvo: corpo.salvo || '', acoes: corpo.acoes || '' });
}

/* ---------- 1. baixar ---------- */
function termoPrevia(){
  const e = termoM.estado;
  if (!e.dados_recentes) return {
    html: `<p class="termo-lead">O termo sai preenchido com os seus dados do SOMA. ${e.dados_confirmados_em
        ? `Eles foram conferidos pela última vez em ${fmtD(e.dados_confirmados_em)}, há mais de seis meses: confira de novo antes de baixar.`
        : 'Antes de baixar, confira seus dados.'}</p>`,
    acoes: `<a class="btn solid" href="#/servicos/dados?de=termo">Conferir meus dados</a>` };
  return {
    html: `<p class="termo-lead">O termo é o modelo do LABBIO, sem nenhuma alteração além dos seus dados e da data de hoje.
        Ele sai com os dados que você conferiu em ${fmtD(e.dados_confirmados_em)}: depois de assinado, não pode ser corrigido.</p>
      <p class="small muted termo-antigo">Algo mudou? <a href="#/servicos/dados?de=termo">Atualize seus dados</a> antes de baixar.</p>`,
    salvo: e.emitido_em ? `<span class="salvo ok">Baixado em ${fmtDT(e.emitido_em)}</span>` : '',
    acoes: `<button class="btn solid" id="termo-baixar" onclick="termoBaixar()">${e.emitido_em ? 'Baixar de novo' : 'Baixar o termo'}</button>`
  };
}
async function sha256Hex(buf){
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
/* gera e baixa o termo; `depois` é a rota seguinte (o recadastro usa a dele) */
async function termoBaixar({ depois = '#/servicos/termo/assinar' } = {}){
  const b = $('#termo-baixar'); if (b) b.disabled = true;
  try {
    const { data, error } = await sb.rpc('termo_emitir');
    if (error) throw error;
    if (data.status === 'dados_pendentes'){ toast('Confira seus dados antes de baixar o termo.', true); location.hash = '#/servicos/dados?de=termo'; return; }
    if (data.status !== 'ok') throw new Error(data.status === 'nenhum' ? 'não há termo pedido para você' : data.status);
    await carregarScript(PDFLIB_URL);
    const r = await fetch(data.modelo, { cache: 'no-cache' });
    if (!r.ok) throw new Error('o modelo do termo não carregou');
    const modelo = await r.arrayBuffer();
    if (await sha256Hex(modelo) !== data.modelo_sha256) throw new Error('o modelo do termo no portal não confere com o original');
    const doc = await PDFLib.PDFDocument.load(modelo);
    const form = doc.getForm();
    for (const [k, v] of Object.entries(termoCampos(data.dados, data))){ const f = form.getTextField(k); f.setText(v); f.enableReadOnly(); }
    const bytes = await doc.save();
    const nome = `Termo de sigilo LABBIO - ${data.dados.nome_civil}.pdf`;
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: nome }); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60e3);
    termoM.estado = (await sb.rpc('termo_estado')).data || termoM.estado;
    if (typeof atualizarRecadastro === 'function') await atualizarRecadastro();
    toast('Termo baixado. Agora, assine no gov.br.');
    if (location.hash === depois) render(route()); else location.hash = depois;
  } catch (e){ toast('Não foi possível gerar o termo: ' + (e.message || e) + '. Tente de novo.', true); if (b) b.disabled = false; }
}

/* ---------- 3. assinar ---------- */
function termoAssinar(){
  return {
    html: `<ol class="termo-passos">
        <li><b>Abra o assinador do gov.br</b> e entre com a sua conta gov.br (nível prata ou ouro).
          <a href="${ASSINADOR_URL}" target="_blank" rel="noopener">assinador.iti.br ↗</a></li>
        <li><b>Escolha o arquivo</b> que você baixou: “Termo de sigilo LABBIO - seu nome.pdf”. Não abra nem salve o PDF em outro programa antes, para não alterar o arquivo.</li>
        <li><b>Posicione a assinatura</b> sobre a linha “RECEPTOR DA INFORMAÇÃO”, na última página, e confirme com o código que chega no seu celular. ${TERMO_AVISO_TESTEMUNHAS}</li>
        <li><b>Baixe o arquivo assinado</b>. É ele que você envia na próxima etapa.</li></ol>
      <p class="small muted termo-antigo">Perdeu o arquivo? <a href="#/servicos/termo/baixar">Baixe o termo de novo</a>.</p>`,
    acoes: `<a class="btn ghost" href="#/servicos/termo/baixar">Voltar</a><a class="btn solid" href="#/servicos/termo/enviar">Já assinei</a>`
  };
}

/* ---------- 4. enviar ---------- */
function termoEnviar(){
  const e = termoM.estado;
  /* quem chega de "Já tem o termo?" (ou não baixou um novo) envia o que já tinha */
  if (/[?&]ja=1/.test(location.hash) || !e.emitido_em) termoM.existente = true;
  const ex = termoM.existente;
  return {
    html: `<div class="seg termo-qual" role="radiogroup" aria-label="Qual termo você envia">
        <button type="button" role="radio" aria-checked="${!ex}" class="${ex ? '' : 'on'}" onclick="termoQual(false)"${e.emitido_em ? '' : ' disabled title="Baixe o termo primeiro"'}>O termo que baixei agora</button>
        <button type="button" role="radio" aria-checked="${ex}" class="${ex ? 'on' : ''}" onclick="termoQual(true)">O termo que eu já tinha</button></div>
      <p class="termo-lead">${ex
        ? `Envie o termo que você já tinha, preenchido e assinado (está na <a href="${TERMO_PASTA_URL}" target="_blank" rel="noopener">pasta dos termos ↗</a>).
           Ele precisa estar conforme: os seus dados de hoje e a assinatura na linha do receptor da informação. O Pessoal confere e, se algo não estiver certo, devolve com o motivo.`
        : 'Envie o PDF que o assinador do gov.br devolveu. O arquivo é guardado exatamente como chega.'} ${TERMO_AVISO_TESTEMUNHAS}</p>
      <label class="termo-drop" id="termo-drop"><input type="file" id="t-arquivo" accept="application/pdf,.pdf" onchange="termoEscolheu(this)">
        <span>${ic('subir')} <b>Escolher o PDF assinado</b><small>Até 10 MB</small></span></label>
      <p class="termo-arquivo" id="termo-arquivo" role="status"></p>`,
    acoes: `<a class="btn ghost" href="#/servicos/termo/${ex ? 'baixar' : 'assinar'}">Voltar</a>
      <button class="btn solid" id="termo-enviar" onclick="termoEnviarArquivo()" disabled>Enviar o termo assinado</button>`
  };
}
function termoQual(ex){ termoM.existente = ex; termoM.arquivo = null; termoDesenhar('enviar'); }
/* um PDF assinado traz /ByteRange e a assinatura (/Sig, PKCS#7 ou CAdES) */
function termoAssinado(bytes){
  const t = new TextDecoder('latin1').decode(bytes);
  return /\/ByteRange\s*\[/.test(t) && /\/Type\s*\/Sig\b|adbe\.pkcs7|ETSI\.CAdES/.test(t);
}
async function termoEscolheu(input){
  const f = input.files?.[0], out = $('#termo-arquivo'), b = $('#termo-enviar');
  termoM.arquivo = null; b.disabled = true; out.className = 'termo-arquivo';
  if (!f) { out.textContent = ''; return; }
  const bytes = new Uint8Array(await f.arrayBuffer());
  const falha = msg => { out.textContent = msg; out.classList.add('erro'); };
  if (f.size > 10 * 1024 * 1024) return falha('O arquivo passa de 10 MB.');
  if (String.fromCharCode(...bytes.slice(0, 5)) !== '%PDF-') return falha('Este arquivo não é um PDF.');
  const digital = termoAssinado(bytes);
  /* o termo novo vem do assinador do gov.br; o que já existia pode ter sido assinado de outro jeito, e o Pessoal confere */
  if (!digital && !termoM.existente) return falha('Este PDF não tem assinatura digital. Assine no gov.br e envie o arquivo que o assinador devolveu.');
  termoM.arquivo = { f, bytes };
  out.textContent = `${f.name}, ${(f.size / 1024).toFixed(0)} KB, ${digital ? 'assinado digitalmente' : 'sem assinatura digital: o Pessoal confere a assinatura'}.`; out.classList.add('ok');
  b.disabled = false;
}
async function termoEnviarArquivo(){
  const a = termoM.arquivo, b = $('#termo-enviar'); if (!a) return;
  b.disabled = true;
  try {
    const sha = await sha256Hex(a.bytes);
    const caminho = `${termoM.estado.campanha}/${state.perfil.registro}/${crypto.randomUUID()}.pdf`;
    const up = await sb.storage.from('termos').upload(caminho, a.f, { contentType: 'application/pdf', upsert: false });
    if (up.error) throw up.error;
    const { data, error } = await sb.rpc('termo_registrar_envio', { p_arquivo: caminho, p_sha256: sha, p_bytes: a.bytes.length, p_existente: !!termoM.existente });
    if (error) throw error;
    if (data.status !== 'ok') throw new Error({ nao_emitido: 'baixe o termo com os dados atuais antes de enviar',
      dados_pendentes: 'confirme seus dados primeiro', arquivo_ausente: 'o arquivo não chegou ao servidor' }[data.status] || data.status);
    termoM.estado = (await sb.rpc('termo_estado')).data || termoM.estado;
    if (typeof atualizarRecadastro === 'function') await atualizarRecadastro();
    toast('Termo enviado. Obrigado!');
    termoDesenhar('fim');
  } catch (e){ toast('Não foi possível enviar: ' + (e.message || e) + '. Tente de novo.', true); b.disabled = false; }
}

/* ============================================================
   O PAINEL DO PESSOAL (Administração › Termo de sigilo)
   ============================================================ */
const TERMO_SITUACAO = { pendente: ['Pendente', 'warn'], enviado: ['Enviado', 'info'],
  conferido: ['Conferido', 'ok'], devolvido: ['Devolvido', 'err'] };
async function painelTermo(el){
  el.innerHTML = estado.carregando('lista');
  const { data, error } = await sb.rpc('termo_painel');
  if (error || data?.status !== 'ok'){ el.innerHTML = estado.erro({ texto: 'Não foi possível carregar o painel do termo.' }); return; }
  const ps = data.pessoas || [];
  const conta = k => ps.filter(p => p.situacao === k).length;
  if (!data.campanha){ el.innerHTML = estado.vazio({ texto: 'Nenhum termo pedido. O termo entra num recadastro: Administração › Recadastro.' }); return; }
  el.innerHTML = `<div class="termo-painel-topo">
      <p>${conta('conferido')} conferidos, ${conta('enviado')} a conferir, ${conta('devolvido')} devolvidos, ${conta('pendente')} pendentes.
        O pedido do termo vai no recadastro (Administração › Recadastro).</p></div>
    <div class="wrap"><table class="tabela trabalho"><thead><tr><th>Membro</th><th>Situação</th><th>Enviado</th><th></th></tr></thead><tbody>
    ${ps.map(p => { const [l, c] = TERMO_SITUACAO[p.situacao] || [p.situacao, ''];
      return `<tr><td>${esc(p.nome)}${p.pausado ? ' <span class="pill">de férias</span>' : ''}</td>
        <td><span class="pill ${c}">${esc(l)}</span>${p.existente ? ' <span class="pill" title="O membro enviou um termo que já tinha">Termo que já tinha</span>' : ''}${p.motivo && p.situacao === 'devolvido' ? `<small class="muted"> ${esc(p.motivo)}</small>` : ''}</td>
        <td class="num">${p.enviado_em ? fmtDT(p.enviado_em) : ''}</td>
        <td class="acoes">${p.arquivo ? `<button class="btn ghost mini" onclick="termoAbrir('${esc(p.arquivo)}')">Abrir PDF</button>` : ''}
          ${p.situacao === 'enviado' ? `<button class="btn ghost mini" onclick="termoConferir(${p.registro},true)">Conferido</button>
            <button class="btn ghost mini" onclick="termoConferir(${p.registro},false)">Devolver</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
}
async function termoAbrir(caminho){
  const w = window.open('', '_blank');
  const { data, error } = await sb.storage.from('termos').createSignedUrl(caminho, 120);
  if (error || !data?.signedUrl){ w?.close(); toast('Não foi possível abrir o termo.', true); return; }
  if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
}
async function termoConferir(reg, ok){
  let motivo = null;
  if (!ok){ motivo = prompt('Motivo da devolução (a pessoa recebe este texto):'); if (!motivo || !motivo.trim()) return; }
  const { data, error } = await sb.rpc('termo_conferir', { p_registro: reg, p_ok: ok, p_motivo: motivo });
  if (error || data?.status !== 'ok'){ toast('Não foi possível registrar: ' + (error?.message || data?.status), true); return; }
  toast(ok ? 'Termo conferido.' : 'Termo devolvido; a pessoa foi avisada.');
  const el = document.getElementById('sec-termo'); if (el) painelTermo(el);
}
