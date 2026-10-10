/* ============================================================
   MÓDULO · TERMO DE SIGILO DO LABBIO (2.19.1)
   Carregado sob demanda em #/servicos/termo.

   O caminho, em quatro etapas:
     1. Seus dados    a pessoa confere e completa o cadastro. O banco
                      valida (CPF com dígito, CEP, UF...) e guarda uma
                      fotografia: é ela que vai no termo.
     2. Conferir e    a prévia mostra cada campo exatamente como sai no
        baixar        termo; só depois de marcar "conferi" o PDF é gerado:
                      o modelo original do LABBIO (termos/), conferido
                      pelo SHA-256, com os campos do próprio formulário
                      preenchidos e travados. Nada mais muda no arquivo.
     3. Assinar       instruções do assinador do gov.br.
     4. Enviar        o PDF assinado sobe como veio (sem reescrever, para
                      não quebrar a assinatura), com o SHA-256 registrado.

   Depende da casca para: sb, $, esc, state, toast, cabecalho, etapas,
   layoutFluxo, carregarScript, ic, estado.
   ============================================================ */

const TERMO_PASSOS = [['dados', 'Seus dados'], ['baixar', 'Conferir e baixar'], ['assinar', 'Assinar no gov.br'], ['enviar', 'Enviar o assinado']];
const PDFLIB_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';
const ASSINADOR_URL = 'https://assinador.iti.br/';
const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a) judicialmente', 'em união estável'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const termoM = { dados: null, estado: null, erros: {}, conferi: false };

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
const TERMO_ROTULOS = { nome: 'Nome', nacionalidade: 'Nacionalidade', 'estado civil': 'Estado civil', RG: 'Carteira de identidade',
  expedidor: 'Expedida por', CPF: 'CPF', end1: 'Endereço', end2: 'Endereço (continuação)', 'cidade uf': 'Cidade e UF' };

async function pageTermo(sub){
  $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Termo de sigilo do LABBIO' }) + estado.carregando();
  const [e, d] = await Promise.all([sb.rpc('termo_estado'), sb.rpc('termo_meus_dados')]);
  if (e.error || d.error){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Termo de sigilo do LABBIO' })
      + estado.erro({ texto: 'Não foi possível carregar o termo agora. Tente de novo em instantes.', acao: '<button class="btn ghost mini" onclick="pageTermo()">Tentar de novo</button>' });
    return;
  }
  termoM.estado = e.data; termoM.dados = d.data; state.obrigacao = { ...(state.obrigacao || {}), termo: e.data };
  if (e.data.status === 'nenhum'){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Termo de sigilo do LABBIO' })
      + estado.vazio({ texto: 'Nenhum termo pendente para você.' });
    return;
  }
  const passo = TERMO_PASSOS.some(([k]) => k === sub) ? sub
    : ['enviado', 'conferido'].includes(e.data.status) ? 'fim'
    : !e.data.dados_confirmados_em ? 'dados' : !e.data.emitido_em ? 'baixar' : 'enviar';
  termoDesenhar(passo);
}

function termoCab(){
  const e = termoM.estado;
  const lead = e.bloqueia ? 'Para continuar usando o SOMA, confira seus dados, assine o termo no gov.br e envie o arquivo assinado.'
    : 'Todos os membros refazem o termo de sigilo do LABBIO, mesmo quem já tinha um. Leva uns dez minutos.';
  return cabecalho({ espaco: 'Serviços', titulo: 'Termo de sigilo do LABBIO', lead });
}

function termoDesenhar(passo){
  const e = termoM.estado;
  const aviso = e.status === 'devolvido' ? `<div class="aviso-box err" role="alert"><b>O Pessoal devolveu o termo enviado.</b> ${esc(e.motivo || '')} Envie de novo.</div>` : '';
  if (passo === 'fim'){
    $('#main').innerHTML = termoCab() + layoutLeitura(`
      <div class="termo-fim">${ic('selo')}
        <h2>${e.status === 'conferido' ? 'Termo conferido' : 'Termo enviado'}</h2>
        <p>${e.status === 'conferido' ? 'O Pessoal conferiu o seu termo. Não há mais nada a fazer.'
          : `Recebido em ${fmtDT(e.enviado_em)}. O Pessoal confere o arquivo; se algo estiver errado, você recebe um aviso com o motivo.`}</p>
        <p><a class="btn ghost" href="#/servicos/termo/dados">Rever meus dados</a></p></div>`);
    return;
  }
  const rota = k => `#/servicos/termo/${k}`;
  const corpo = { dados: termoFormDados, baixar: termoPrevia, assinar: termoAssinar, enviar: termoEnviar }[passo]();
  $('#main').innerHTML = termoCab() + aviso + layoutFluxo({ passos: etapas(TERMO_PASSOS, passo, rota), corpo: corpo.html,
    salvo: corpo.salvo || '', acoes: corpo.acoes || '' });
  corpo.depois?.();
}

/* ---------- 1. os dados ---------- */
function termoFormDados(){
  const d = termoM.dados, er = termoM.erros;
  const campo = (k, rot, attrs = '', ajuda = '') => `<div class="fld${er[k] ? ' erro' : ''}"><label for="t-${k}">${esc(rot)}</label>
    <input id="t-${k}" value="${esc(d[k] ?? '')}" ${attrs} aria-invalid="${!!er[k]}"${er[k] ? ` aria-describedby="t-${k}-e"` : ''}>
    ${er[k] ? `<span class="msg" id="t-${k}-e">${esc(er[k])}</span>` : ajuda ? `<span class="hint">${ajuda}</span>` : ''}</div>`;
  const sel = (k, rot, opcoes, vazio) => `<div class="fld${er[k] ? ' erro' : ''}"><label for="t-${k}">${esc(rot)}</label>
    <select id="t-${k}">${vazio ? `<option value="">${esc(vazio)}</option>` : ''}${opcoes.map(o => `<option${o === d[k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>
    ${er[k] ? `<span class="msg">${esc(er[k])}</span>` : ''}</div>`;
  const foto = d.foto ? '' : `<div class="aviso-box info termo-foto"><b>Sugestão: coloque uma foto de perfil.</b>
    Rosto de frente, fundo neutro e claro, sem óculos escuros. Ela aparece no menu, nos cartões e no placar.
    <a href="#" onclick="abrirFotoPerfil?.();return false">Enviar foto</a></div>`;
  return {
    html: `<p class="termo-lead">Confira cada campo como está no seu documento. É com estes dados que o termo é preenchido, e o LABBIO os usa no cadastro de acesso.</p>
      <form id="termo-form" class="termo-form" onsubmit="termoConfirmar(event)" novalidate>
        <h3 class="termo-sec">Identificação</h3>
        <div class="fgrid">
          <div class="full">${campo('nome_civil', 'Nome completo', 'autocomplete="name"', 'Como no documento de identidade, sem abreviar.')}</div>
          ${campo('cpf', 'CPF', 'inputmode="numeric" autocomplete="off" placeholder="000.000.000-00"')}
          ${campo('data_nascimento', 'Data de nascimento', 'type="date"')}
          ${campo('rg', 'Carteira de identidade (número)', 'placeholder="MG-12.345.678"')}
          ${campo('rg_orgao', 'Órgão expedidor', 'placeholder="PC-MG"')}
          ${campo('nacionalidade', 'Nacionalidade', 'placeholder="brasileira"')}
          ${sel('estado_civil', 'Estado civil', ESTADOS_CIVIS, 'Escolha')}
          ${campo('telefone', 'Telefone com DDD', 'inputmode="tel" autocomplete="tel" placeholder="(31) 90000-0000"')}
        </div>
        <h3 class="termo-sec">Endereço</h3>
        <div class="fgrid">
          ${campo('end_cep', 'CEP', 'inputmode="numeric" autocomplete="postal-code" placeholder="00000-000"')}
          ${campo('end_numero', 'Número', 'placeholder="123 ou s/n"')}
          <div class="full">${campo('end_logradouro', 'Rua, avenida ou praça', 'autocomplete="address-line1"')}</div>
          ${campo('end_complemento', 'Complemento (opcional)', 'placeholder="apto 201"')}
          ${campo('end_bairro', 'Bairro')}
          ${campo('end_cidade', 'Cidade', 'autocomplete="address-level2"')}
          ${sel('end_uf', 'UF', UFS, 'UF')}
        </div>
        ${d.endereco_antigo ? `<p class="small muted termo-antigo">Endereço que estava no cadastro: ${esc(d.endereco_antigo)}</p>` : ''}
        <h3 class="termo-sec">Vínculo acadêmico</h3>
        <div class="fgrid">
          ${campo('instituicao', 'Instituição de ensino', 'placeholder="UFMG"')}
          ${campo('curso', 'Curso')}
          ${campo('matricula', 'Matrícula', d.sem_matricula ? 'disabled' : '')}
          <label class="check" style="align-self:end"><input type="checkbox" id="t-sem_matricula" ${d.sem_matricula ? 'checked' : ''}
            onchange="$('#t-matricula').disabled=this.checked"> Não tenho matrícula</label>
        </div>
      </form>${foto}`,
    acoes: `<button class="btn solid" form="termo-form" type="submit" id="termo-ok">Confirmar meus dados</button>`,
    depois: () => { const p = Object.keys(termoM.erros)[0]; if (p) $('#t-' + p)?.focus(); }
  };
}
async function termoConfirmar(ev){
  ev.preventDefault();
  const v = id => ($('#t-' + id)?.value ?? '').trim();
  const p = {};
  ['nome_civil','cpf','data_nascimento','rg','rg_orgao','nacionalidade','estado_civil','telefone','end_cep','end_numero','end_logradouro',
   'end_complemento','end_bairro','end_cidade','end_uf','instituicao','curso','matricula'].forEach(k => p[k] = v(k));
  p.sem_matricula = $('#t-sem_matricula').checked;
  Object.assign(termoM.dados, p);
  const b = $('#termo-ok'); b.disabled = true;
  try {
    const { data, error } = await sb.rpc('termo_confirmar_dados', { p });
    if (error) throw error;
    if (data.status === 'invalido'){ termoM.erros = data.campos || {}; termoDesenhar('dados');
      toast(`Confira ${Object.keys(termoM.erros).length === 1 ? 'o campo marcado' : 'os campos marcados'}.`, true); return; }
    if (data.status !== 'ok') throw new Error(data.status);
    termoM.erros = {}; termoM.conferi = false;
    Object.assign(termoM.dados, data.dados);
    termoM.estado = (await sb.rpc('termo_estado')).data || termoM.estado;
    location.hash = '#/servicos/termo/baixar';
  } catch (e){ toast('Não foi possível salvar os dados: ' + (e.message || e), true); }
  finally { if (b) b.disabled = false; }
}

/* ---------- 2. conferir e baixar ---------- */
function termoPrevia(){
  const e = termoM.estado;
  if (!e.dados_confirmados_em) return { html: `<p>Primeiro, confira seus dados.</p>`, acoes: `<a class="btn solid" href="#/servicos/termo/dados">Ir para os dados</a>` };
  const c = termoCampos(termoM.dados);
  return {
    html: `<p class="termo-lead">É assim que seus dados vão aparecer no termo. Confira linha por linha: depois de assinado, o termo não pode ser corrigido.</p>
      <dl class="spec termo-previa">${Object.entries(TERMO_ROTULOS).map(([k, l]) => `<div><dt>${esc(l)}</dt><dd>${esc(c[k] || '')}</dd></div>`).join('')}
        <div><dt>Data</dt><dd>a de hoje, ao baixar</dd></div></dl>
      <p class="small muted termo-antigo">Algo errado? <a href="#/servicos/termo/dados">Volte e corrija</a>. O termo é o modelo do LABBIO, sem nenhuma alteração além destes campos.</p>
      <label class="check termo-conferi"><input type="checkbox" id="t-conferi" ${termoM.conferi ? 'checked' : ''}
        onchange="termoM.conferi=this.checked;$('#termo-baixar').disabled=!this.checked"> Conferi, e os dados estão corretos</label>`,
    salvo: e.emitido_em ? `<span class="salvo ok">Baixado em ${fmtDT(e.emitido_em)}</span>` : '',
    acoes: `<a class="btn ghost" href="#/servicos/termo/dados">Voltar</a>
      <button class="btn solid" id="termo-baixar" onclick="termoBaixar()" ${termoM.conferi ? '' : 'disabled'}>Baixar o termo</button>`
  };
}
async function sha256Hex(buf){
  const h = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function termoBaixar(){
  const b = $('#termo-baixar'); if (b) b.disabled = true;
  try {
    const { data, error } = await sb.rpc('termo_emitir');
    if (error) throw error;
    if (data.status !== 'ok') throw new Error(data.status === 'dados_pendentes' ? 'confirme seus dados primeiro' : data.status);
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
    toast('Termo baixado. Agora, assine no gov.br.');
    location.hash = '#/servicos/termo/assinar';
  } catch (e){ toast('Não foi possível gerar o termo: ' + (e.message || e) + '. Tente de novo.', true); if (b) b.disabled = false; }
}

/* ---------- 3. assinar ---------- */
function termoAssinar(){
  return {
    html: `<ol class="termo-passos">
        <li><b>Abra o assinador do gov.br</b> e entre com a sua conta gov.br (nível prata ou ouro).
          <a href="${ASSINADOR_URL}" target="_blank" rel="noopener">assinador.iti.br ↗</a></li>
        <li><b>Escolha o arquivo</b> que você baixou: “Termo de sigilo LABBIO - seu nome.pdf”. Não abra nem salve o PDF em outro programa antes, para não alterar o arquivo.</li>
        <li><b>Posicione a assinatura</b> sobre a linha “RECEPTOR DA INFORMAÇÃO”, na última página, e confirme com o código que chega no seu celular.</li>
        <li><b>Baixe o arquivo assinado</b>. É ele que você envia na próxima etapa.</li></ol>
      <p class="small muted termo-antigo">Perdeu o arquivo? <a href="#/servicos/termo/baixar">Baixe o termo de novo</a>.</p>`,
    acoes: `<a class="btn ghost" href="#/servicos/termo/baixar">Voltar</a><a class="btn solid" href="#/servicos/termo/enviar">Já assinei</a>`
  };
}

/* ---------- 4. enviar ---------- */
function termoEnviar(){
  const e = termoM.estado;
  if (!e.emitido_em) return { html: `<p>Primeiro, baixe o termo com os seus dados.</p>`, acoes: `<a class="btn solid" href="#/servicos/termo/baixar">Baixar o termo</a>` };
  return {
    html: `<p class="termo-lead">Envie o PDF que o assinador do gov.br devolveu. O arquivo é guardado exatamente como chega.</p>
      <label class="termo-drop" id="termo-drop"><input type="file" id="t-arquivo" accept="application/pdf,.pdf" onchange="termoEscolheu(this)">
        <span>${ic('subir')} <b>Escolher o PDF assinado</b><small>Até 10 MB</small></span></label>
      <p class="termo-arquivo" id="termo-arquivo" role="status"></p>`,
    acoes: `<a class="btn ghost" href="#/servicos/termo/assinar">Voltar</a>
      <button class="btn solid" id="termo-enviar" onclick="termoEnviarArquivo()" disabled>Enviar o termo assinado</button>`
  };
}
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
  if (!termoAssinado(bytes)) return falha('Este PDF não tem assinatura digital. Assine no gov.br e envie o arquivo que o assinador devolveu.');
  termoM.arquivo = { f, bytes };
  out.textContent = `${f.name}, ${(f.size / 1024).toFixed(0)} KB, assinado digitalmente.`; out.classList.add('ok');
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
    const { data, error } = await sb.rpc('termo_registrar_envio', { p_arquivo: caminho, p_sha256: sha, p_bytes: a.bytes.length });
    if (error) throw error;
    if (data.status !== 'ok') throw new Error({ nao_emitido: 'baixe o termo com os dados atuais antes de enviar',
      dados_pendentes: 'confirme seus dados primeiro', arquivo_ausente: 'o arquivo não chegou ao servidor' }[data.status] || data.status);
    termoM.estado = (await sb.rpc('termo_estado')).data || termoM.estado;
    state.obrigacao = { ...(state.obrigacao || {}), termo: termoM.estado };
    toast('Termo enviado. Obrigado!');
    termoDesenhar('fim');
  } catch (e){ toast('Não foi possível enviar: ' + (e.message || e) + '. Tente de novo.', true); b.disabled = false; }
}

/* ============================================================
   O PEDIDO NA ENTRADA (chamado pela casca depois do login)
   Primeira vez: dá para deixar para depois, uma vez só (o banco
   registra, vale em qualquer aparelho, até o fim desta sessão). Nas
   entradas seguintes, o SOMA leva direto ao termo até o envio.
   ============================================================ */
function termoPedirNaEntrada(){
  const t = state.obrigacao?.termo;
  if (!t || !['pendente', 'devolvido'].includes(t.status) || t.pausado) return;
  if (t.bloqueia || location.hash.startsWith('#/servicos/termo')) return;
  abreModal(`<h3>Termo de sigilo do LABBIO</h3>
    <p>Todos os membros vão refazer o termo de sigilo do LABBIO, mesmo quem já tinha um. Você confere seus dados, baixa o termo,
      assina no gov.br e envia por aqui. Leva uns dez minutos.</p>
    ${t.dispensa_disponivel ? '<p class="small muted">Dá para deixar para depois só desta vez: na próxima entrada, o SOMA pede o termo antes de continuar.</p>' : ''}
    <div class="acts">${t.dispensa_disponivel ? '<button class="btn ghost" onclick="termoDepois()">Agora não</button>' : ''}
      <button class="btn solid" onclick="fechaModal();location.hash='#/servicos/termo'">Fazer agora</button></div>`, false, !t.dispensa_disponivel);
}
async function termoDepois(){
  fechaModal();
  const c = state.obrigacao?.termo?.campanha;
  try { sessionStorage.setItem('nd.termo.depois.' + c, '1'); } catch (e) {}
  const { data } = await sb.rpc('termo_dispensar');
  if (state.obrigacao?.termo){ state.obrigacao.termo.dispensa_disponivel = false; }
  if (data?.status === 'ok') toast('Tudo bem. Na próxima entrada, o SOMA pede o termo antes de continuar.');
}

/* ============================================================
   O PAINEL DO PESSOAL (Administração › Termo de sigilo)
   ============================================================ */
const TERMO_SITUACAO = { pendente: ['Pendente', 'warn'], dados_confirmados: ['Dados confirmados', 'info'], enviado: ['Enviado', 'info'],
  conferido: ['Conferido', 'ok'], devolvido: ['Devolvido', 'err'] };
async function painelTermo(el){
  el.innerHTML = estado.carregando('lista');
  const { data, error } = await sb.rpc('termo_painel');
  if (error || data?.status !== 'ok'){ el.innerHTML = estado.erro({ texto: 'Não foi possível carregar o painel do termo.' }); return; }
  const ps = data.pessoas || [];
  const conta = k => ps.filter(p => p.situacao === k).length;
  el.innerHTML = `<div class="termo-painel-topo">
      <p>${data.ativa ? '<b>Campanha ativa.</b> Os membros veem o pedido ao entrar.' : '<b>Campanha desligada.</b> Ninguém vê o pedido ainda.'}
        ${conta('conferido')} conferidos, ${conta('enviado')} a conferir, ${conta('devolvido')} devolvidos, ${conta('pendente') + conta('dados_confirmados')} pendentes.</p>
      ${souAdmin() ? `<button class="btn ${data.ativa ? 'ghost' : 'solid'} mini" onclick="termoAtivar(${!data.ativa})">${data.ativa ? 'Desligar a campanha' : 'Ligar a campanha'}</button>` : ''}</div>
    <div class="wrap"><table class="tabela trabalho"><thead><tr><th>Membro</th><th>Situação</th><th>Enviado</th><th></th></tr></thead><tbody>
    ${ps.map(p => { const [l, c] = TERMO_SITUACAO[p.situacao] || [p.situacao, ''];
      return `<tr><td>${esc(p.nome)}${p.pausado ? ' <span class="pill">de férias</span>' : ''}</td>
        <td><span class="pill ${c}">${esc(l)}</span>${p.motivo && p.situacao === 'devolvido' ? `<small class="muted"> ${esc(p.motivo)}</small>` : ''}</td>
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
async function termoAtivar(ativa){
  if (ativa && !confirm('Ligar a campanha avisa todos os membros ativos e passa a pedir o termo na entrada. Continuar?')) return;
  const { data, error } = await sb.rpc('termo_campanha_ativar', { p_ativa: ativa });
  if (error || data?.status !== 'ok'){ toast('Não foi possível mudar a campanha: ' + (error?.message || data?.status), true); return; }
  toast(ativa ? `Campanha ligada. ${data.avisados} membros avisados.` : 'Campanha desligada.');
  const el = document.getElementById('sec-termo'); if (el) painelTermo(el);
}
