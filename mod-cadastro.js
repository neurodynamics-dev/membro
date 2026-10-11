/* ============================================================
   MÓDULO · MEUS DADOS E RECADASTRO (2.19.1)
   Carregado sob demanda em #/servicos/dados e #/servicos/recadastro, e
   pela casca para o pedido de recadastro na entrada.

     #/servicos/dados          conferir e atualizar os próprios dados (a
                               qualquer hora; o recadastro e o onboarding
                               mandam para cá)
     #/servicos/recadastro     a campanha do semestre: o que ela pede e o
                               que já foi feito, passo a passo

   O recadastro é semestral. Quando a campanha inclui o termo de sigilo do
   LABBIO (a de 2026/2), são quatro passos: conferir os dados, baixar o
   termo, assinar no gov.br e enviar. Nas outras, só os dados.

   Depende da casca para: sb, $, esc, state, toast, cabecalho, estado, ic,
   fmtD, fmtDT, carregarModulo, abreModal, fechaModal, souAdmin.
   ============================================================ */

const ESTADOS_CIVIS = ['solteiro(a)', 'casado(a)', 'divorciado(a)', 'viúvo(a)', 'separado(a) judicialmente', 'em união estável'];
const UFS = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const ASSINADOR_GOVBR = 'https://assinador.iti.br/';
const cadM = { dados: null, erros: {}, volta: null };

/* ============================================================
   MEUS DADOS
   ============================================================ */
async function pageDados(){
  cadM.volta = new URLSearchParams(location.hash.split('?')[1] || '').get('de');
  $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Meus dados' }) + estado.carregando();
  const { data, error } = await sb.rpc('cadastro_meus_dados');
  if (error || data?.status !== 'ok'){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Meus dados' }) + (data?.status === 'sem_registro'
      ? estado.vazio({ texto: 'Sua conta ainda não está ligada a um registro do quadro. Fale com o Depto. de Pessoal.' })
      : estado.erro({ texto: 'Não foi possível carregar seus dados agora.', acao: '<button class="btn ghost mini" onclick="pageDados()">Tentar de novo</button>' }));
    return;
  }
  cadM.dados = data; cadM.erros = {};
  cadDesenhar();
}
function cadDesenhar(){
  const d = cadM.dados, er = cadM.erros;
  const lead = d.confirmado_em ? `Conferidos pela última vez em ${fmtD(d.confirmado_em)}. Confira de novo sempre que algo mudar.`
    : 'Confira cada campo como está no seu documento. Estes dados vão para a sua ficha, para o termo de sigilo e para o cadastro de acesso ao LABBIO.';
  const campo = (k, rot, attrs = '', ajuda = '') => `<div class="fld${er[k] ? ' erro' : ''}"><label for="t-${k}">${esc(rot)}</label>
    <input id="t-${k}" value="${esc(d[k] ?? '')}" ${attrs} aria-invalid="${!!er[k]}"${er[k] ? ` aria-describedby="t-${k}-e"` : ''}>
    ${er[k] ? `<span class="msg" id="t-${k}-e">${esc(er[k])}</span>` : ajuda ? `<span class="hint">${ajuda}</span>` : ''}</div>`;
  const sel = (k, rot, opcoes, vazio) => `<div class="fld${er[k] ? ' erro' : ''}"><label for="t-${k}">${esc(rot)}</label>
    <select id="t-${k}">${vazio ? `<option value="">${esc(vazio)}</option>` : ''}${opcoes.map(o => `<option${o === d[k] ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>
    ${er[k] ? `<span class="msg">${esc(er[k])}</span>` : ''}</div>`;
  const foto = d.foto ? '' : `<div class="aviso-box info termo-foto"><b>Sugestão: coloque uma foto de perfil.</b>
    Rosto de frente, fundo neutro e claro, sem óculos escuros. Ela aparece no menu, nos cartões e no placar.
    <a href="#" onclick="modalFoto(state.perfil?.registro);return false">Enviar foto</a></div>`;
  const volta = cadM.volta === 'recadastro' ? ['Recadastro', '#/servicos/recadastro'] : cadM.volta === 'termo' ? ['Termo de sigilo', '#/servicos/termo'] : null;
  $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Meus dados', lead, voltar: volta || undefined }) + `
    <form id="termo-form" class="termo-form" onsubmit="cadConfirmar(event)" novalidate>
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
      <p class="small muted termo-antigo">Os dados de bolsa ficam com o Depto. de Pessoal e não aparecem aqui.</p>
      <div class="barra-acoes"><span class="salvo"></span><div class="dir">
        <button class="btn solid" type="submit" id="termo-ok">Confirmar meus dados</button></div></div>
    </form>${foto}`;
  const p = Object.keys(er)[0]; if (p) $('#t-' + p)?.focus();
}
async function cadConfirmar(ev){
  ev.preventDefault();
  const v = id => ($('#t-' + id)?.value ?? '').trim();
  const p = {};
  ['nome_civil','cpf','data_nascimento','rg','rg_orgao','nacionalidade','estado_civil','telefone','end_cep','end_numero','end_logradouro',
   'end_complemento','end_bairro','end_cidade','end_uf','instituicao','curso','matricula'].forEach(k => p[k] = v(k));
  p.sem_matricula = $('#t-sem_matricula').checked;
  Object.assign(cadM.dados, p);
  const b = $('#termo-ok'); b.disabled = true;
  try {
    const { data, error } = await sb.rpc('cadastro_confirmar', { p });
    if (error) throw error;
    if (data.status === 'invalido'){ cadM.erros = data.campos || {}; cadDesenhar();
      toast(`Confira ${Object.keys(cadM.erros).length === 1 ? 'o campo marcado' : 'os campos marcados'}.`, true); return; }
    if (data.status !== 'ok') throw new Error(data.status);
    cadM.erros = {};
    Object.assign(cadM.dados, data.dados, { confirmado_em: new Date().toISOString() });
    await atualizarRecadastro();
    toast('Dados confirmados. Obrigado!');
    if (cadM.volta === 'recadastro') location.hash = '#/servicos/recadastro';
    else if (cadM.volta === 'termo') location.hash = '#/servicos/termo/baixar';
    else cadDesenhar();
  } catch (e){ toast('Não foi possível salvar os dados: ' + (e.message || e), true); }
  finally { const bb = $('#termo-ok'); if (bb) bb.disabled = false; }
}

/* ============================================================
   RECADASTRO: os passos da campanha, num painel de widgets
   ============================================================ */
async function atualizarRecadastro(){
  try { const { data } = await sb.rpc('recadastro_estado'); if (data) state.obrigacao = { ...(state.obrigacao || {}), recadastro: data }; }
  catch (e){ /* segue com o que tinha */ }
  return state.obrigacao?.recadastro;
}
/* os passos e em que pé cada um está */
function recPassos(r){
  const dadosOk = !!r.dados_confirmados_em, t = r.termo;
  const passos = [{ k: 'dados', n: 1, t: 'Confirme seus dados', feito: dadosOk,
    p: 'Documento, endereço e vínculo acadêmico, como estão nos seus documentos.',
    acao: `<a class="btn ${dadosOk ? 'ghost' : 'solid'}" href="#/servicos/dados?de=recadastro">${dadosOk ? 'Rever meus dados' : 'Conferir meus dados'}</a>`,
    quando: dadosOk ? 'Conferidos em ' + fmtD(r.dados_confirmados_em) : '' }];
  if (r.termo_campanha && t){
    const baixado = !!t.emitido_em, enviado = ['enviado', 'conferido'].includes(t.status);
    passos.push(
      { k: 'baixar', n: 2, t: 'Baixe o termo', feito: baixado || enviado, bloq: !dadosOk,
        p: 'O termo de sigilo do LABBIO, já preenchido com os dados que você conferiu.',
        acao: `<button class="btn ${baixado ? 'ghost' : 'solid'}" onclick="recBaixar()" ${dadosOk ? '' : 'disabled'}>${baixado ? 'Baixar de novo' : 'Baixar o termo'}</button>`,
        quando: baixado ? 'Baixado em ' + fmtD(t.emitido_em) : '' },
      { k: 'assinar', n: 3, t: 'Assine via gov.br', feito: enviado, bloq: !baixado && !enviado,
        p: 'No assinador do gov.br, com a sua conta gov.br. Posicione a assinatura na linha do RECEPTOR DA INFORMAÇÃO, na última página.',
        acao: `<a class="btn ${baixado && !enviado ? 'solid' : 'ghost'}" href="${ASSINADOR_GOVBR}" target="_blank" rel="noopener">Abrir o assinador ↗</a>`,
        quando: '<span class="rec-link">assinador.iti.br</span>' },
      { k: 'enviar', n: 4, t: 'Faça o upload', feito: enviado, bloq: !baixado && !enviado,
        p: t.status === 'devolvido' ? `O Pessoal devolveu o termo: ${esc(t.motivo || '')}` : 'Envie o PDF que o assinador devolveu, sem abrir nem salvar em outro programa.',
        acao: `<a class="btn ${baixado && !enviado ? 'solid' : 'ghost'}" href="#/servicos/termo/enviar">${enviado ? 'Ver o envio' : 'Enviar o assinado'}</a>`,
        quando: enviado ? (t.status === 'conferido' ? 'Conferido pelo Pessoal' : 'Enviado em ' + fmtD(t.enviado_em)) : '' });
  }
  const atual = passos.findIndex(x => !x.feito);
  passos.forEach((x, i) => { x.atual = i === atual; });
  return passos;
}
function recPainelHTML(r, { modal } = {}){
  const passos = recPassos(r), feitos = passos.filter(x => x.feito).length, termo = passos.length > 1;
  const titulo = termo ? 'Confira seus dados e regularize o termo de sigilo do LABBIO' : 'Confira seus dados';
  const lead = termo ? 'Todo semestre, cada membro confere os próprios dados no SOMA. Desta vez, aproveitamos para refazer o termo de sigilo do LABBIO de todos, mesmo de quem já tinha um. São quatro passos, uns dez minutos.'
    : 'Todo semestre, cada membro confere os próprios dados no SOMA. Leva uns cinco minutos.';
  const aviso = r.bloqueia ? '<p class="rec-aviso">Para continuar usando o SOMA, conclua os passos abaixo.</p>' : '';
  return `<div class="rec-painel${modal ? ' modal' : ''}" role="${modal ? 'dialog' : 'region'}" aria-labelledby="rec-tit"${modal ? ' aria-modal="true"' : ''}>
    <div class="rec-topo">
      <div><span class="eyebrow">${esc(r.titulo || 'Recadastro')}</span>
        <h2 id="rec-tit">${titulo}</h2><p class="rec-lead">${lead}</p>${aviso}</div>
      ${modal && r.dispensa_disponivel ? '<button class="icbtn rec-fechar" onclick="recDepois()" aria-label="Fazer depois">' + ic('x') + '</button>' : ''}
    </div>
    <div class="rec-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${passos.length}" aria-valuenow="${feitos}"
      aria-label="${feitos} de ${passos.length} passos feitos">${passos.map(x => `<span class="${x.feito ? 'feito' : x.atual ? 'atual' : ''}"></span>`).join('')}</div>
    <div class="rec-passos n${passos.length}">${passos.map(x => `
      <section class="widget rec-passo${x.feito ? ' feito' : ''}${x.atual ? ' atual' : ''}${x.bloq && !x.feito ? ' bloq' : ''}" aria-current="${x.atual ? 'step' : 'false'}">
        <header><span class="w-rot">Passo ${x.n}</span>${x.feito ? `<span class="rec-ok">${ic('check')} Feito</span>` : ''}</header>
        <div class="w-num">${String(x.n).padStart(2, '0')}</div>
        <h3>${x.t}</h3><p>${x.p}</p>
        <div class="rec-acao">${x.acao}</div>
        ${x.quando ? `<p class="rec-quando">${x.quando}</p>` : ''}
      </section>`).join('')}</div>
    ${modal ? `<div class="rec-pe">${r.dispensa_disponivel ? '<button class="btn ghost" onclick="recDepois()">Agora não</button>' : ''}
      <span class="rec-pe-txt">${r.dispensa_disponivel ? 'Dá para deixar para depois só desta vez: na próxima entrada, o SOMA pede o recadastro antes de continuar.' : ''}</span></div>` : ''}
  </div>`;
}
async function pageRecadastro(){
  $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Recadastro' }) + estado.carregando();
  const r = await atualizarRecadastro();
  if (!r || r.status === 'nenhum'){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: 'Recadastro' })
      + estado.vazio({ texto: 'Nenhum recadastro em andamento. Seus dados podem ser conferidos a qualquer hora em Meus dados.', acao: '<a class="btn ghost" href="#/servicos/dados">Meus dados</a>' });
    return;
  }
  if (r.status === 'concluido'){
    $('#main').innerHTML = cabecalho({ espaco: 'Serviços', titulo: r.titulo || 'Recadastro' }) + `<div class="termo-fim">${ic('selo')}
      <h2>Recadastro concluído</h2><p>Obrigado! Seus dados estão em dia${r.termo_campanha ? ' e o termo de sigilo foi enviado' : ''}.</p>
      <p><a class="btn ghost" href="#/servicos/dados">Rever meus dados</a></p></div>`;
    return;
  }
  $('#main').innerHTML = recPainelHTML(r);
}
/* o pedido na entrada: o painel grande, por cima do portal */
function recadastroPedir(){
  const r = state.obrigacao?.recadastro;
  if (!r || r.status !== 'pendente' || r.pausado || r.bloqueia) return;
  if (location.hash.startsWith('#/servicos/recadastro') || location.hash.startsWith('#/servicos/dados') || location.hash.startsWith('#/servicos/termo')) return;
  try { if (sessionStorage.getItem('nd.recadastro.depois.' + r.campanha)) return; } catch (e){}
  recFecharPainel();
  const ov = document.createElement('div');
  ov.className = 'rec-ov'; ov.id = 'rec-ov';
  ov.innerHTML = recPainelHTML(r, { modal: true });
  ov.addEventListener('click', e => { if (e.target.closest('a[href^="#/"]')) recFecharPainel(); });
  document.body.append(ov);
  (ov.querySelector('.rec-passo.atual .btn:not([disabled])') || ov.querySelector('.rec-passo .btn'))?.focus();
}
function recFecharPainel(){ document.getElementById('rec-ov')?.remove(); }
async function recDepois(){
  const r = state.obrigacao?.recadastro;
  recFecharPainel();
  try { sessionStorage.setItem('nd.recadastro.depois.' + r?.campanha, '1'); } catch (e){}
  const { data } = await sb.rpc('recadastro_dispensar');
  if (r) r.dispensa_disponivel = false;
  if (data?.status === 'ok') toast('Tudo bem. Na próxima entrada, o SOMA pede o recadastro antes de continuar.');
}
async function recBaixar(){
  recFecharPainel();
  try { await carregarModulo('termo'); await termoBaixar({ depois: '#/servicos/recadastro' }); }
  catch (e){ toast('Não foi possível gerar o termo: ' + (e.message || e), true); }
}

/* ============================================================
   O PAINEL DO PESSOAL (Administração › Recadastro)
   ============================================================ */
async function painelRecadastro(el){
  el.innerHTML = estado.carregando('lista');
  const { data, error } = await sb.rpc('recadastro_painel');
  if (error || data?.status !== 'ok'){ el.innerHTML = estado.erro({ texto: 'Não foi possível carregar o painel do recadastro.' }); return; }
  const c = data.campanha, ps = data.pessoas || [];
  const feitos = ps.filter(p => p.concluido_em).length;
  const ano = new Date().getFullYear(), sem = new Date().getMonth() < 6 ? 1 : 2;
  el.innerHTML = `<div class="termo-painel-topo">
      <p>${c ? `<b>${esc(c.titulo)}</b>, ${c.ativa ? 'em andamento' : 'encerrado'}${c.termo ? ', com o termo de sigilo do LABBIO' : ''}.
        ${feitos} de ${ps.length} concluíram.` : 'Nenhum recadastro ainda.'}</p>
      ${souAdmin() ? (c?.ativa ? `<button class="btn ghost mini" onclick="recAtivar('${esc(c.id)}', '${esc(c.titulo)}', '${esc(c.termo || '')}', false)">Encerrar</button>`
        : `<form class="rec-nova" onsubmit="event.preventDefault();recAtivar($('#rec-id').value,$('#rec-tit-in').value,$('#rec-termo').checked?'labbio-2026':'',true)">
          <div class="fld"><label for="rec-id">Código</label><input id="rec-id" value="${ano}-${sem}" required></div>
          <div class="fld"><label for="rec-tit-in">Título</label><input id="rec-tit-in" value="Recadastro ${ano}/${sem}" required></div>
          <label class="check"><input type="checkbox" id="rec-termo"> Incluir o termo de sigilo do LABBIO</label>
          <button class="btn solid mini" type="submit">Começar o recadastro</button></form>`) : ''}</div>
    <div class="wrap"><table class="tabela trabalho"><thead><tr><th>Membro</th><th>Dados conferidos</th><th>Recadastro</th></tr></thead><tbody>
    ${ps.map(p => `<tr><td>${esc(p.nome)}${p.pausado ? ' <span class="pill">de férias</span>' : ''}</td>
      <td class="num">${p.confirmado_em ? fmtD(p.confirmado_em) : '<span class="muted">nunca</span>'}</td>
      <td>${p.concluido_em ? '<span class="pill ok">Concluído</span>' : c?.ativa ? '<span class="pill warn">Pendente</span>' : ''}</td></tr>`).join('')}
    </tbody></table></div>`;
}
async function recAtivar(id, titulo, termo, ativa){
  if (ativa && !confirm(`Começar "${titulo}"? Todos os membros ativos recebem o aviso e o SOMA passa a pedir o recadastro na entrada.`)) return;
  const { data, error } = await sb.rpc('recadastro_campanha_ativar', { p_id: id, p_titulo: titulo, p_termo: termo || null, p_ativa: ativa });
  if (error || data?.status !== 'ok'){ toast('Não foi possível: ' + (error?.message || data?.status), true); return; }
  toast(ativa ? `Recadastro começou. ${data.avisados} membros avisados.` : 'Recadastro encerrado.');
  const el = document.getElementById('sec-recadastro'); if (el) painelRecadastro(el);
}
