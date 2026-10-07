/* ============================================================
   MÓDULO, E-MAILS — #/admin/emails[/programados|/pilulas]
   O Full mailer em tela inteira: escrever o comunicado no padrão
   visual da NeuroDynamics, copiar ou programar o envio (v30), e as
   pílulas de conhecimento: os roteiros prontos que apresentam e
   relembram o que o SOMA faz, programados em série.

   SUPERFÍCIE CLARA DE PROPÓSITO: o que sai daqui é e-mail. A prévia
   continua branca, com as cores da área que assina.

   Quem escreve e copia: quem abre Relatórios (a gestão e o Comitê de
   Seleção). Quem programa e mexe nos roteiros: admin e pessoal, a
   mesma regra das funções do banco (email_programar).

   Depende da casca para: sb, $, esc, state, can, toast, abreModal,
   fechaModal, confirma, motivoRPC, fmtDT, ic, ibtn, copiar, dica,
   navNivel1, linkDaConta, grupoPorId, grupoPorNome, primeiroNome,
   isoDia, hojeISO.
   ============================================================ */

const ML = { rascunho:null, timer:null, html:'', celular:false, roteiros:null, programados:null };

/* ---------------- os remetentes e as cores ----------------
   Cada área assina com o próprio nome ("P&D | NeuroDynamics") e as
   próprias cores. Os departamentos ficam em tons claros e distintos
   entre si; o escuro (Deep + Lima) é da Leadership, que fala pela
   equipe inteira. */
const REMETENTES_MAILER = [
  {k:'pd',         t:'Pesquisa & Desenvolvimento',          de:'P&D',                     tema:'cortex'},
  {k:'clinica',    t:'Clínica',                             de:'Clínica',                 tema:'ion'},
  {k:'pessoal',    t:'Departamento de Pessoal',             de:'Depto. de Pessoal',       tema:'lumen'},
  {k:'ri',         t:'Relações Institucionais e Parcerias', de:'Relações Institucionais', tema:'retina'},
  {k:'marketing',  t:'Marketing e Comunicação',             de:'Marketing',               tema:'neuron'},
  {k:'leadership', t:'Leadership',                          de:'Leadership',              tema:'cortex-escuro'},
];
const remetenteMl = (k) => REMETENTES_MAILER.find(r => r.k === k) || null;
const nomeDeEnvio = (de) => `${de || 'NeuroDynamics'} | NeuroDynamics`.replace(/^NeuroDynamics \| /, '');

/* Combinações de cores, na paleta NeuroDynamics (teal #00594F, deep
   #00352F, sinapse/lima #CEDC00) com auxiliares harmônicas. Campos:
   band=fundo do cabeçalho, onBand=título sobre o fundo, logo=cor da logo
   recolorida, bandRule=régua sobre o fundo, bodyAccent=cor legível para
   chamada/links/réguas no corpo (fundo branco), btnBg/btnInk=botão. */
const THEMES_MAILER = {
  "cortex": {
    "nome": "Cortex",
    "band": "#E3EFEC",
    "onBand": "#00352F",
    "logo": "#00352F",
    "bandRule": "#00594F",
    "bodyAccent": "#00352F",
    "btnBg": "#00352F",
    "btnInk": "#FFFFFF"
  },
  "ion": {
    "nome": "Ion",
    "band": "#D9F7F2",
    "onBand": "#0B4F48",
    "logo": "#0B4F48",
    "bandRule": "#5BBFB0",
    "bodyAccent": "#0B4F48",
    "btnBg": "#0B4F48",
    "btnInk": "#FFFFFF"
  },
  "neuron": {
    "nome": "Neuron",
    "band": "#E4F2E3",
    "onBand": "#1F4A22",
    "logo": "#1F4A22",
    "bandRule": "#5AA65E",
    "bodyAccent": "#1F4A22",
    "btnBg": "#1F4A22",
    "btnInk": "#FFFFFF"
  },
  "glia": {
    "nome": "Glia",
    "band": "#E9EFEA",
    "onBand": "#2E4636",
    "logo": "#2E4636",
    "bandRule": "#8AA894",
    "bodyAccent": "#2E4636",
    "btnBg": "#2E4636",
    "btnInk": "#FFFFFF"
  },
  "retina": {
    "nome": "Retina",
    "band": "#E0E6FC",
    "onBand": "#142A75",
    "logo": "#142A75",
    "bandRule": "#3456E3",
    "bodyAccent": "#142A75",
    "btnBg": "#142A75",
    "btnInk": "#FFFFFF"
  },
  "nexo": {
    "nome": "Nexo",
    "band": "#E7E5FA",
    "onBand": "#251C66",
    "logo": "#251C66",
    "bandRule": "#5A4ED4",
    "bodyAccent": "#251C66",
    "btnBg": "#251C66",
    "btnInk": "#FFFFFF"
  },
  "dendrito": {
    "nome": "Dendrito",
    "band": "#EEE8FE",
    "onBand": "#3B2378",
    "logo": "#3B2378",
    "bandRule": "#A78BFA",
    "bodyAccent": "#3B2378",
    "btnBg": "#3B2378",
    "btnInk": "#FFFFFF"
  },
  "lumen": {
    "nome": "Lúmen",
    "band": "#FFF9D6",
    "onBand": "#594A00",
    "logo": "#594A00",
    "bandRule": "#FFD91A",
    "bodyAccent": "#594A00",
    "btnBg": "#594A00",
    "btnInk": "#FFFFFF"
  },
  "ritmo": {
    "nome": "Ritmo",
    "band": "#FFEDE0",
    "onBand": "#6B2E08",
    "logo": "#6B2E08",
    "bandRule": "#FF9B5E",
    "bodyAccent": "#6B2E08",
    "btnBg": "#6B2E08",
    "btnInk": "#FFFFFF"
  },
  "impulso": {
    "nome": "Impulso",
    "band": "#FFE4E6",
    "onBand": "#6E0A1A",
    "logo": "#6E0A1A",
    "bandRule": "#FF4F61",
    "bodyAccent": "#6E0A1A",
    "btnBg": "#6E0A1A",
    "btnInk": "#FFFFFF"
  },
  "plexo": {
    "nome": "Plexo",
    "band": "#FFE6F0",
    "onBand": "#6B0F38",
    "logo": "#6B0F38",
    "bandRule": "#FF70A6",
    "bodyAccent": "#6B0F38",
    "btnBg": "#6B0F38",
    "btnInk": "#FFFFFF"
  },
  "iris": {
    "nome": "Íris",
    "band": "#F8E7FC",
    "onBand": "#4E0F5E",
    "logo": "#4E0F5E",
    "bandRule": "#D676EB",
    "bodyAccent": "#4E0F5E",
    "btnBg": "#4E0F5E",
    "btnInk": "#FFFFFF"
  }
};
for (const [k,v] of Object.entries(THEMES_MAILER)) v.familia = k;
THEMES_MAILER['cortex-escuro']={...THEMES_MAILER.cortex,nome:'Cortex escuro',band:'#00352F',onBand:'#E8EDEB',logo:'#FFFFFF',bandRule:'#CEDC00',dark:true};
/* Apelidos preservam mensagens e configurações anteriores. */
for (const [antigo,novo] of Object.entries({teal:"cortex",clinica:"ion",pessoal:"lumen",ri:"retina",marketing:"neuron",leadership:"cortex-escuro",sinapse:"cortex",deep:"cortex-escuro",grafite:"glia"})) Object.defineProperty(THEMES_MAILER,antigo,{value:THEMES_MAILER[novo],enumerable:false});

/* As redes com ícone no rodapé. O link vem de Studio › Configurações ›
   Contas (linkDaConta, na casca); o TikTok não tem ícone no e-mail. */
const SOCIAIS_MAILER = [
  {k:'site', l:'Site'}, {k:'instagram', l:'Instagram'}, {k:'linkedin', l:'LinkedIn'},
  {k:'youtube', l:'YouTube'}, {k:'x', l:'X'}, {k:'facebook', l:'Facebook'},
];
/* Imagens do mailer POR LINK, nunca embutidas: clientes de e-mail tratam
   imagens em data-URI como anexo do documento, ou as descartam (Gmail).
   As variantes da logo (uma por cor de tema) e os ícones sociais (uma por
   cor de acento) são PNGs na pasta /mailer deste repositório, servidos
   pelo GitHub Pages no domínio do SOMA. Ao criar um TEMA NOVO em
   THEMES_MAILER, gere os PNGs da nova cor (ver mailer/README.md). */
const MAILER_IMG_BASE = 'https://membro.neurodynamics.dev/mailer/';
/* o botão de uma pílula aponta para uma tela do portal (#/…): no e-mail,
   o endereço precisa ser completo */
const PORTAL_MAILER = 'https://membro.neurodynamics.dev/';
const mlLink = (u) => { const t = String(u || '').trim(); return t.startsWith('#/') ? PORTAL_MAILER + t : t; };

const _hexArq = (hex) => String(hex).replace('#', '').toLowerCase();
/* o logo da família, hospedado no brand: -dark sobre fundo claro, -light sobre o escuro */
const BRAND_ASSETS = 'https://brand.neurodynamics.dev/assets/';
const mailerLogoURL = (th) => `${BRAND_ASSETS}logo-imagotipo-${th.familia || 'cortex'}-${th.dark ? 'light' : 'dark'}.png`;
const _MESES_ML = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const mlDataHoje = () => { const d = new Date(Date.now() - 3*3600e3); return `${d.getUTCDate()} de ${_MESES_ML[d.getUTCMonth()]} de ${d.getUTCFullYear()}`; };
function _socialImg(k){
  const alt = (SOCIAIS_MAILER.find(s => s.k === k) || {}).l || k;
  return `<img src="${MAILER_IMG_BASE}ico-${k}-1d1d1f.png" width="21" height="21" alt="${alt}"
    style="display:block;border:0;outline:none;width:21px;height:21px">`;
}
const _escBr = (s) => esc(s).replace(/\n/g, '<br>');
const _ML_SANS = "'Instrument Sans',Helvetica,Arial,sans-serif", _ML_SERIF = "Archivo,Arial,Helvetica,sans-serif";
const _mlEsp = (h) => `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td></tr>`;
const _mlFio = (cor) => `<tr><td height="1" style="height:1px;font-size:0;line-height:0;background:${cor};mso-line-height-rule:exactly">&nbsp;</td></tr>`;
function _mailerParas(txt){
  return String(txt || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean)
    .map(p => `<tr><td style="font-family:${_ML_SANS};font-weight:400;font-size:15px;line-height:23px;mso-line-height-rule:exactly;color:#2E3533">${_escBr(p)}</td></tr>${_mlEsp(14)}`).join('');
}
function _mailerSocial(social){
  const items = SOCIAIS_MAILER.filter(s => social[s.k]).map(s =>
    `<td style="padding-right:14px"><a href="${esc(social[s.k])}" target="_blank" style="text-decoration:none">${_socialImg(s.k)}</a></td>`).join('');
  if (!items) return '';
  return `${_mlEsp(14)}<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>${items}</tr></table></td></tr>`;
}
/* "Portal do membro https://…": o último pedaço, se for endereço, vira o
   link do rótulo; item sem endereço sai como texto, não como link morto */
function _mailerLinksRodape(txt){
  return String(txt || '').split('|').map(s => s.trim()).filter(Boolean).map(item => {
    const m = item.match(/^(.*?)\s+((?:https?:\/\/|mailto:|#\/)\S+)$/);
    return m ? { t: m[1], href: mlLink(m[2]) } : { t: item, href: '' };
  });
}
function construirMailerHTML(cfg){
  const th = cfg.tema, logo = cfg.logoUrl || mailerLogoURL(th);
  const paras = _mailerParas(cfg.corpo);
  const cta = (cfg.ctaLabel && cfg.ctaUrl)
    ? `${_mlEsp(10)}<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${th.btnBg}" style="background:${th.btnBg};border-radius:8px"><a href="${esc(cfg.ctaUrl)}" target="_blank" style="display:block;padding:13px 24px;font-family:${_ML_SANS};font-weight:500;font-size:14px;line-height:18px;color:${th.btnInk};text-decoration:none">${esc(cfg.ctaLabel)}</a></td></tr></table></td></tr>`
    : '';
  const social = _mailerSocial(cfg.social || {});
  const links = _mailerLinksRodape(cfg.footLinks).map(l => l.href
      ? `<a href="${esc(l.href)}" target="_blank" style="color:#2E3533;text-decoration:none">${esc(l.t)}</a>`
      : esc(l.t))
    .join('<br>');
  const fine = String(cfg.fine || '').split(/\n/).map(s => s.trim()).filter(Boolean).map(esc).join('<br>');
  const f = (tam, cor, t) => `<tr><td style="font-family:${_ML_SANS};font-weight:400;font-size:${tam}px;line-height:${tam + 7}px;mso-line-height-rule:exactly;color:${cor}">${t}</td></tr>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><meta name="x-apple-disable-message-reformatting">
<title>${esc(cfg.assunto || cfg.titulo || 'NeuroDynamics')}</title><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400&family=Instrument+Sans:wght@400;500&family=IBM+Plex+Mono&display=swap" rel="stylesheet"><!--[if mso]><style>td,a,span{font-family:Arial,sans-serif!important}</style><![endif]--><style>a{color:${th.bodyAccent}}@media (max-width:620px){.wrap{width:100%!important}}</style></head>
<body style="margin:0;padding:0;background:#E8EDEB;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${esc(cfg.preheader || '')}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#E8EDEB" style="background:#E8EDEB"><tr><td align="center" style="padding:24px 0">
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF"><tr><td style="padding:45px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">
<tr><td bgcolor="${th.band}" style="background:${th.band};border-radius:16px;padding:30px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">
  <tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="50%" valign="middle"><img src="${logo}" width="152" height="26" alt="NeuroDynamics" style="display:block;width:152px;height:26px;border:0"></td><td width="50%" align="right" valign="middle" style="font-family:${_ML_SANS};font-size:13px;line-height:18px;color:${th.onBand}">${esc(cfg.data || mlDataHoje())}</td></tr></table></td></tr>
  ${_mlEsp(32)}${_mlFio(th.bandRule)}${_mlEsp(14)}
  <tr><td style="font-family:${_ML_SANS};font-weight:400;font-size:19px;line-height:24px;mso-line-height-rule:exactly;color:${th.onBand}">${esc(cfg.titulo || '')}</td></tr>
</table></td></tr>
${_mlEsp(30)}
${cfg.chamada ? `<tr><td style="font-family:${_ML_SERIF};font-weight:400;letter-spacing:-.3px;font-size:26px;line-height:32px;mso-line-height-rule:exactly;color:#2E3533">${esc(cfg.chamada)}</td></tr>${_mlEsp(14)}` : ''}
${paras}${cta}${social}
${_mlEsp(46)}${_mlFio('#2E3533')}${_mlEsp(14)}
${links ? f(13, '#2E3533', links) + _mlEsp(14) + _mlFio('#2E3533') + _mlEsp(18) : ''}
${cfg.footText ? f(13, '#2E3533', _escBr(cfg.footText)) + _mlEsp(18) + _mlFio('#2E3533') + _mlEsp(14) : ''}
${fine ? f(11, '#616C68', fine) : ''}
</table></td></tr></table></td></tr></table></body></html>`;
}
/* a versão em texto, para quem lê sem HTML */
function mlTexto(cfg){
  const links = _mailerLinksRodape(cfg.footLinks).filter(l => l.href).map(l => `${l.t}: ${l.href}`).join('\n');
  return [cfg.chamada, cfg.corpo, cfg.ctaLabel && cfg.ctaUrl ? `${cfg.ctaLabel}: ${cfg.ctaUrl}` : '',
          cfg.footText, links, cfg.fine].map(s => String(s || '').trim()).filter(Boolean).join('\n\n');
}
/* {{primeiro_nome}} e {{nome}}: a Edge Function troca no envio programado.
   Na prévia, entra o nome de quem está escrevendo; no que se copia ou
   baixa, a marca sai ("Olá, {{primeiro_nome}}." vira "Olá."). */
const ML_MARCA = /\{\{\s*(primeiro_nome|nome)\s*\}\}/g;
function mlPersonalizar(html, nome){
  const completo = String(nome || '').trim(), primeiro = completo.split(/\s+/)[0] || '';
  return String(html).replace(ML_MARCA, (_, k) => esc(k === 'nome' ? completo : primeiro));
}
const mlSemMarcas = (html) => String(html).replace(/,?\s*\{\{\s*(primeiro_nome|nome)\s*\}\}/g, '');
const mlMeuNome = () => state.perfil?.nome || (state.membros || []).find(m => m.registro === state.perfil?.registro)?.nome || '';

/* ---------------- o rascunho ---------------- */
function mlPadrao(){
  const r = REMETENTES_MAILER[0];
  return {
    remetente:r.k, titulo:r.t, tema:r.tema, assunto:'',
    preheader:'Confira as novidades desta edição.',
    chamada:'Um novo marco para a NeuroDynamics',
    corpo:'Olá, {{primeiro_nome}}.\n\nCompartilhamos as principais novidades e os próximos passos da equipe. Nas últimas semanas, avançamos em frentes importantes, e todos precisam estar alinhados sobre o que vem a seguir.\n\nDúvidas podem ser encaminhadas à liderança da sua área.',
    ctaLabel:'', ctaUrl:'',
    footText:'NeuroDynamics, Escola de Engenharia da UFMG, Belo Horizonte/MG',
    footLinks:'Portal do membro https://membro.neurodynamics.dev',
    fine:`Você recebeu este e-mail porque faz parte da equipe da NeuroDynamics.\n© ${new Date().getFullYear()} NeuroDynamics. Todos os direitos reservados.`,
    redesFora:[], roteiro_id:null,
  };
}
/* os links das redes, de Studio › Configurações › Contas */
const mlRedes = () => SOCIAIS_MAILER.map(s => ({ ...s, url: linkDaConta(s.k) })).filter(s => s.url);
const mlSocial = (fora = []) => Object.fromEntries(mlRedes().filter(s => !fora.includes(s.k)).map(s => [s.k, s.url]));
/* o que construirMailerHTML recebe, a partir de um rascunho */
function mlCfg(r){
  return { titulo:r.titulo, tema:THEMES_MAILER[r.tema] || THEMES_MAILER.teal, assunto:r.assunto,
    preheader:r.preheader, chamada:r.chamada, corpo:r.corpo, ctaLabel:String(r.ctaLabel || '').trim(),
    ctaUrl:mlLink(r.ctaUrl), footText:r.footText, footLinks:r.footLinks, fine:r.fine, social:mlSocial(r.redesFora) };
}
/* um roteiro vira rascunho: a área assina, a chamada é o título dele */
function mlDoRoteiro(rt){
  const p = mlPadrao(), r = remetenteMl(rt.remetente) || REMETENTES_MAILER[0];
  return { ...p, remetente:r.k, titulo:r.t, tema:r.tema, assunto:rt.assunto, preheader:rt.preheader || '',
    chamada:rt.titulo, corpo:rt.corpo, ctaLabel:rt.cta_rotulo || '', ctaUrl:rt.cta_link || '', roteiro_id:rt.id };
}

/* ============================================================
   A TELA
   ============================================================ */
async function pageMailer(sub){
  const el = $('#sec-emails'); if (!el) return;
  const gestao = podeGerir();
  if (sub==='comunidade' && souAdmin()){await carregarModulo('reporte');return repComunidadePagina();}
  const aba = gestao && ['programados', 'pilulas'].includes(sub) ? sub : 'escrever';
  const fila = (ML.programados || []).filter(p => p.status === 'programado').length;
  el.innerHTML = (gestao ? navNivel1([
      ['escrever', 'Escrever', '#/admin/emails'],
      ...(souAdmin()?[['comunidade','Comunidade','#/admin/emails/comunidade']]:[]),
      ['programados', 'Programados', '#/admin/emails/programados', fila ? ` <span class="n">${fila}</span>` : ''],
      ['pilulas', 'Pílulas de conhecimento', '#/admin/emails/pilulas']], aba, 'E-mails') : '')
    + '<div id="ml-corpo-tela"></div>';
  if (aba === 'programados') return mlProgramados();
  if (aba === 'pilulas') return mlPilulas();
  mlEscrever();
  /* a contagem da fila, no seletor, sem segurar a tela */
  if (gestao && !ML.programados) mlCarregarProgramados().then(() => mlContarFila(), () => {});
}

/* ---------------- escrever ---------------- */
function mlEscrever(){
  const r = ML.rascunho || (ML.rascunho = mlPadrao());
  const redes = mlRedes();
  const temaOpts = Object.entries(THEMES_MAILER).map(([k, v]) => `<option value="${k}" ${k === r.tema ? 'selected' : ''}>${esc(v.nome)}</option>`).join('');
  const campo = (id, rot, v, extra = '') => `<div class="fld"><label for="${id}">${rot}</label><input id="${id}" value="${esc(v || '')}" oninput="mlUpd()" ${extra}></div>`;
  $('#ml-corpo-tela').innerHTML = `
    <div class="ml-tela">
      <div class="ml-form card">
        <div class="fld"><label for="ml-rem">Remetente ${dica('A área que assina o e-mail. Ela define o nome de quem envia, o título do cabeçalho e as cores. Os departamentos usam tons claros; a Leadership, que fala pela equipe inteira, usa o verde profundo.')}</label>
          <select id="ml-rem" onchange="mlRemetente()">
            ${REMETENTES_MAILER.map(x => `<option value="${x.k}" ${x.k === r.remetente ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}
            <option value="outro" ${r.remetente === 'outro' ? 'selected' : ''}>Outro (título e cores livres)</option>
          </select></div>
        ${campo('ml-assunto', 'Assunto', r.assunto, `placeholder="${esc(r.chamada || 'O assunto na caixa de entrada')}"`)}
        ${campo('ml-pre', 'Pré-cabeçalho <span class="muted">(resumo na caixa de entrada)</span>', r.preheader)}
        <div class="dupla">
          ${campo('ml-titulo', 'Título do cabeçalho', r.titulo)}
          <div class="fld"><label for="ml-tema">Cores</label><select id="ml-tema" onchange="mlUpd()">${temaOpts}</select></div>
        </div>
        ${campo('ml-chamada', 'Chamada <span class="muted">(título do corpo)</span>', r.chamada)}
        <div class="fld"><label for="ml-corpo">Corpo do e-mail ${dica('Separe os parágrafos com uma linha em branco. {{primeiro_nome}} vira o primeiro nome de quem recebe no envio programado; ao copiar ou baixar, a marca é retirada.')}</label>
          <textarea id="ml-corpo" oninput="mlUpd()" style="min-height:190px">${esc(r.corpo)}</textarea></div>
        <div class="dupla">
          ${campo('ml-cta', 'Botão <span class="muted">(rótulo)</span>', r.ctaLabel, 'placeholder="Saiba mais"')}
          ${campo('ml-ctaurl', 'Link do botão', r.ctaUrl, 'placeholder="https://… ou #/tela"')}
        </div>
        <details class="ml-mais"><summary>Rodapé</summary>
          <div class="fld"><label for="ml-foot">Texto do rodapé</label>
            <textarea id="ml-foot" oninput="mlUpd()" style="min-height:56px">${esc(r.footText)}</textarea></div>
          ${campo('ml-links', `Links do rodapé ${dica('Itens separados por |. Termine o item com o endereço (https://… ou #/tela) para ele virar link.')}`, r.footLinks)}
          <div class="fld"><label for="ml-fine">Letra miúda <span class="muted">(uma linha por parágrafo)</span></label>
            <textarea id="ml-fine" oninput="mlUpd()" style="min-height:56px">${esc(r.fine)}</textarea></div>
        </details>
        <div class="fld"><label>Redes no rodapé ${dica('Os links vêm de Studio › Configurações › Contas. Para trocar um endereço, edite lá: todos os e-mails passam a usar o novo.')}</label>
          ${redes.length ? `<div class="ml-redes ml-lista">${redes.map(s => `<label class="check"><input type="checkbox" class="ml-rede" data-k="${s.k}"
              ${r.redesFora.includes(s.k) ? '' : 'checked'} onchange="mlUpd()"><span><b>${esc(s.l)}</b> <span class="mono">${esc(s.url.replace(/^https?:\/\/(www\.)?/, ''))}</span></span></label>`).join('')}</div>`
            : `<div class="aviso-box warn" style="margin:0">Nenhuma conta com link em Studio › Configurações › Contas: o rodapé sai sem os ícones.</div>`}
          <a class="mini ml-studio" href="#/studio/config/contas">${ic('externo')} Editar as contas no Studio</a></div>
      </div>
      <div class="ml-prev">
        <div class="ml-barra">
          <div class="seg" role="group" aria-label="Prévia">
            <button class="${ML.celular ? '' : 'on'}" onclick="mlDispositivo(false)">Computador</button>
            <button class="${ML.celular ? 'on' : ''}" onclick="mlDispositivo(true)">Celular</button></div>
          <span class="ml-bts">
            ${ibtn('externo', 'Abrir em nova aba', 'mlAbrir()')}${ibtn('down', 'Baixar .html', 'mlBaixar()')}${ibtn('copy', 'Copiar código', 'mlCopiarCodigo()')}
            <button class="btn ghost mini" onclick="mlCopiar()">${ic('mail')} Copiar e-mail</button>
            ${podeGerir() ? `<button class="btn solid mini" onclick="mlProgramarRascunho()">${ic('relogio')} Programar envio</button>` : ''}
          </span></div>
        <iframe id="ml-prev" class="${ML.celular ? 'cel' : ''}" title="Prévia do e-mail"></iframe>
      </div>
    </div>`;
  ML.html = ''; mlUpd(true);
}
function mlLer(){
  const r = ML.rascunho || mlPadrao();
  const v = (id) => $('#' + id)?.value ?? '';
  Object.assign(r, { remetente:v('ml-rem'), titulo:v('ml-titulo'), tema:v('ml-tema'), assunto:v('ml-assunto'),
    preheader:v('ml-pre'), chamada:v('ml-chamada'), corpo:v('ml-corpo'), ctaLabel:v('ml-cta'), ctaUrl:v('ml-ctaurl'),
    footText:v('ml-foot'), footLinks:v('ml-links'), fine:v('ml-fine'),
    redesFora:[...document.querySelectorAll('.ml-rede')].filter(i => !i.checked).map(i => i.dataset.k) });
  return (ML.rascunho = r);
}
function mlUpd(agora){
  clearTimeout(ML.timer);
  const run = () => {
    if (!$('#ml-prev')) return;
    const r = mlLer();
    ML.html = construirMailerHTML(mlCfg(r));
    const a = $('#ml-assunto'); if (a) a.placeholder = r.chamada || 'O assunto na caixa de entrada';
    $('#ml-prev').srcdoc = mlPersonalizar(ML.html, mlMeuNome());
  };
  if (agora) run(); else ML.timer = setTimeout(run, 150);
}
function mlRemetente(){
  const v = $('#ml-rem').value, r = remetenteMl(v);
  if (!r){ $('#ml-titulo').value = ''; $('#ml-titulo').focus(); }
  else { $('#ml-titulo').value = r.t; $('#ml-tema').value = r.tema; }
  mlUpd(true);
}
function mlDispositivo(cel){
  ML.celular = cel;
  $('#ml-prev')?.classList.toggle('cel', cel);
  document.querySelectorAll('.ml-barra .seg button').forEach((b, i) => b.classList.toggle('on', i === (cel ? 1 : 0)));
}
/* copia HTML como conteúdo formatado (rich text): ao colar no editor de
   e-mail, o resultado sai renderizado, não como código */
async function copiarHTML(html){
  let corpo = html;   // só o <body>, para <title>/<head> não vazarem no editor
  try { const d = new DOMParser().parseFromString(html, 'text/html'); if (d.body) corpo = d.body.innerHTML; } catch(e){}
  try {
    if (navigator.clipboard && window.ClipboardItem){
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([corpo], {type:'text/html'}),
        'text/plain': new Blob([html], {type:'text/plain'}),
      })]);
      toast('E-mail copiado.');
      return;
    }
    throw new Error('ClipboardItem indisponível');
  } catch(e){
    try {   // reserva: seleciona um nó renderizado e copia via execCommand (colagem rica)
      const div = document.createElement('div');
      div.setAttribute('contenteditable', 'true');
      div.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      div.innerHTML = corpo; document.body.appendChild(div);
      const range = document.createRange(); range.selectNodeContents(div);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      const ok = document.execCommand('copy'); sel.removeAllRanges(); div.remove();
      if (ok){ toast('E-mail copiado.'); return; }
      throw new Error('execCommand falhou');
    } catch(e2){ copiar(html); }
  }
}
function mlCopiar(){ if (ML.html) copiarHTML(mlSemMarcas(ML.html)); }
function mlCopiarCodigo(){ if (ML.html) copiar(mlSemMarcas(ML.html)); }
function mlBaixar(){
  if (!ML.html) return;
  const blob = new Blob([mlSemMarcas(ML.html)], {type:'text/html;charset=utf-8'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `NRO_full_mailer_${hojeISO()}.html`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('HTML baixado.');
}
function mlAbrir(){
  if (!ML.html) return;
  const blob = new Blob([mlPersonalizar(ML.html, mlMeuNome())], {type:'text/html;charset=utf-8'});
  const url = URL.createObjectURL(blob); window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 8000);
}

/* ============================================================
   PROGRAMAR
   Um e-mail (do rascunho ou de uma pílula) para a equipe toda, para
   grupos (contando os de baixo) ou só para quem programa, agora ou numa
   data. A Edge Function passa a cada cinco minutos e envia o que venceu.
   ============================================================ */
/* amanhã às 9h, no fuso de quem programa */
function mlAmanha9(){
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${isoDia(d)}T09:00`;
}
const mlEuRegistro = () => state.perfil?.registro || null;
function mlNomesGrupos(ids){ return (ids || []).map(id => grupoPorId(id)?.nome || `grupo ${id}`); }
function mlDestinoTexto(p){
  if (p.todos) return 'Equipe toda';
  const partes = mlNomesGrupos(p.grupos);
  const pessoas = (p.registros || []).map(r => (state.membros || []).find(m => m.registro === r)?.nome || `registro ${r}`);
  return [...partes, ...pessoas].join(', ') || 'Ninguém';
}

function mlProgramarRascunho(){
  const r = mlLer(), cfg = mlCfg(r), rem = remetenteMl(r.remetente);
  if (!String(r.corpo || '').trim()) return toast('Escreva o corpo do e-mail antes de programar.', true);
  mlModalProgramar({
    assunto: r.assunto || r.chamada, html: construirMailerHTML(cfg), texto: mlTexto(cfg),
    remetente: rem ? rem.k : 'outro', remetente_nome: nomeDeEnvio(rem ? rem.de : r.titulo),
    roteiro_id: r.roteiro_id || null, todos: true, grupos: [],
  });
}

/* o modal de programar: `p` traz o e-mail pronto e o destino sugerido;
   com p.id, reagenda um que ainda está na fila */
function mlModalProgramar(p){
  const soEu = !p.todos && !(p.grupos || []).length && (p.registros || []).length === 1 && p.registros[0] === mlEuRegistro();
  ML.prog = { ...p, modo: p.todos ? 'todos' : soEu ? 'eu' : 'grupos' };
  const gs = [...(state.grupos || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const valor = p.enviar_em ? mlLocalISO(new Date(p.enviar_em)) : mlAmanha9();
  abreModal(`<h3>${ic('relogio')} ${p.id ? 'Reagendar envio' : 'Programar envio'}</h3>
    <p class="small muted" style="line-height:1.6;margin:-2px 0 14px">Remetente: <b>${esc(p.remetente_nome)}</b>
      ${dica('O envio sai do endereço de e-mail do SOMA, com o nome da área que assina. {{primeiro_nome}} vira o primeiro nome de cada pessoa.')}</p>
    <div class="fld"><label for="mp-assunto">Assunto</label><input id="mp-assunto" value="${esc(p.assunto || '')}"></div>
    <div class="fld"><label>Para</label>
      <div class="seg" role="group" aria-label="Destino" id="mp-modo">${[['todos', 'Equipe toda'], ['grupos', 'Grupos'], ['eu', 'Só para mim (teste)']].map(([k, l]) =>
        `<button type="button" data-k="${k}" class="${ML.prog.modo === k ? 'on' : ''}" onclick="mlProgModo('${k}')">${l}</button>`).join('')}</div>
      <div class="multi ml-lista" id="mp-grupos" style="margin-top:10px" ${ML.prog.modo === 'grupos' ? '' : 'hidden'}>${gs.map(g =>
        `<label class="check"><input type="checkbox" class="mp-gp" value="${g.id}" ${(p.grupos || []).includes(g.id) ? 'checked' : ''} onchange="mlProgContar()"> ${esc(g.nome)}</label>`).join('')
        || '<span class="small muted">Nenhum grupo cadastrado.</span>'}</div>
      <p class="mini" id="mp-n" aria-live="polite"></p></div>
    <div class="fld"><label for="mp-quando">Quando ${dica('A fila de envio é conferida a cada cinco minutos. "Agora" envia na próxima conferência.')}</label>
      <div class="ml-quando"><input id="mp-quando" type="datetime-local" value="${valor}">
        <button type="button" class="btn ghost mini" onclick="mlProgAgora()">Agora</button></div></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="mp-ok" onclick="mlProgSalvar()">${ic('relogio')} ${p.id ? 'Reagendar' : 'Programar'}</button></div>`, 'largo', true);
  mlProgContar();
}
const mlLocalISO = (d) => `${isoDia(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
function mlProgAgora(){ const el = $('#mp-quando'); if (el) el.value = mlLocalISO(new Date()); }
function mlProgModo(k){
  ML.prog.modo = k;
  document.querySelectorAll('#mp-modo button').forEach(b => b.classList.toggle('on', b.dataset.k === k));
  $('#mp-grupos').hidden = k !== 'grupos';
  mlProgContar();
}
function mlProgDestino(){
  const m = ML.prog.modo;
  if (m === 'todos') return { todos:true, grupos:[], registros:[] };
  if (m === 'eu') return { todos:false, grupos:[], registros: mlEuRegistro() ? [mlEuRegistro()] : [] };
  return { todos:false, registros:[], grupos:[...document.querySelectorAll('.mp-gp:checked')].map(i => +i.value) };
}
/* o banco diz qual campo recusou; a tela diz o que fazer */
const ML_CAMPO = { assunto:'Informe o assunto.', html:'O e-mail está vazio.', remetente:'Falta o remetente.',
                   enviar_em:'A data já passou.', destino:'Escolha para quem vai.', itens:'Nada para programar.' };
const mlMotivo = (data, error, padrao) => data?.status === 'invalido' && ML_CAMPO[data.campo]
  ? ML_CAMPO[data.campo] : motivoRPC(data, error, padrao);
let _mpConta = 0;
async function mlProgContar(){
  const el = $('#mp-n'); if (!el) return;
  const d = mlProgDestino(), eu = ++_mpConta;
  if (ML.prog.modo === 'eu' && !mlEuRegistro()){ el.textContent = 'A sua conta não tem registro no quadro: o teste não tem para quem ir.'; return; }
  if (!d.todos && !d.grupos.length && !d.registros.length){ el.textContent = 'Escolha pelo menos um grupo.'; return; }
  el.textContent = 'Contando…';
  const { data, error } = await sb.rpc('email_destinatarios', { p: d });
  if (eu !== _mpConta || !$('#mp-n')) return;
  if (error || data?.status !== 'ok'){ el.textContent = 'Não foi possível contar os destinatários' + (error ? ': ' + error.message : '.'); return; }
  el.innerHTML = `<b>${data.total}</b> ${data.total === 1 ? 'pessoa recebe' : 'pessoas recebem'}.`
    + (data.sem_email ? ` Sem e-mail na ficha: ${esc((data.sem_email_nomes || []).join(', '))}.` : '');
}
async function mlProgSalvar(){
  const p = ML.prog, d = mlProgDestino(), quando = $('#mp-quando').value;
  const assunto = $('#mp-assunto').value.trim();
  if (!assunto) return toast('Informe o assunto.', true);
  if (!quando) return toast('Informe a data e a hora.', true);
  if (!d.todos && !d.grupos.length && !d.registros.length) return toast('Escolha para quem vai.', true);
  const enviar_em = new Date(quando);
  if (enviar_em < new Date(Date.now() - 5 * 60000)) return toast('A data já passou.', true);
  const item = { assunto, html:p.html, texto:p.texto || '', remetente:p.remetente, remetente_nome:p.remetente_nome,
    enviar_em: enviar_em.toISOString(), roteiro_id:p.roteiro_id || null, ...d, ...(p.id ? { id:p.id } : {}) };
  $('#mp-ok').disabled = true;
  const { data, error } = await sb.rpc('email_programar', { p: item });
  if (error || data?.status !== 'ok'){
    $('#mp-ok').disabled = false;
    return toast(mlMotivo(data, error, 'Não foi possível programar'), true);
  }
  fechaModal();
  toast(p.id ? 'Envio reagendado.' : `Envio programado para ${fmtDT(enviar_em)}.`);
  ML.programados = null;
  if (location.hash === '#/admin/emails/programados') mlProgramados(); else location.hash = '#/admin/emails/programados';
}

/* ---------------- programados ---------------- */
const ML_STATUS = { programado:['Na fila', 'info'], enviando:['Enviando', 'warn'], enviado:['Enviado', 'ok'],
                    cancelado:['Cancelado', ''], erro:['Falhou', 'bad'] };
async function mlCarregarProgramados(){
  const { data, error } = await sb.from('email_programados')
    .select('id,assunto,remetente,remetente_nome,todos,grupos,registros,enviar_em,status,criado_por,criado_em,enviado_em,enviados,falhas,erro,roteiro_id')
    .order('enviar_em', { ascending:false }).limit(300);
  if (error) throw error;
  return (ML.programados = data || []);
}
function mlSemMigracao(el, e){
  el.innerHTML = `<div class="aviso-box err">Os envios programados não carregaram: ${esc(e.message || '')}. Falta aplicar a migração v30 (db/v30_emails.sql)?</div>`;
}
function mlContarFila(){
  const n = document.querySelector('.nav1 a[href="#/admin/emails/programados"]'); if (!n) return;
  const q = (ML.programados || []).filter(p => p.status === 'programado').length;
  n.innerHTML = `Programados${q ? ` <span class="n">${q}</span>` : ''}`;
}
async function mlProgramados(){
  const el = $('#ml-corpo-tela'); if (!el) return;
  el.innerHTML = '<div class="carregando"><span class="spin"></span> Carregando…</div>';
  try { await mlCarregarProgramados(); } catch(e){ return mlSemMigracao(el, e); }
  const lista = ML.programados;
  const fila = lista.filter(p => ['programado', 'enviando'].includes(p.status)).sort((a, b) => a.enviar_em.localeCompare(b.enviar_em));
  const hist = lista.filter(p => !['programado', 'enviando'].includes(p.status));
  mlContarFila();
  const linha = (p) => {
    const [st, tom] = ML_STATUS[p.status] || [p.status, ''];
    return `<tr>
      <td class="mono">${esc(fmtDT(p.status === 'enviado' ? p.enviado_em || p.enviar_em : p.enviar_em))}</td>
      <td><b>${esc(p.assunto)}</b><div class="small muted">${esc(p.remetente_nome)}${p.criado_por ? `, programado por ${esc(p.criado_por)}` : ''}</div></td>
      <td>${esc(mlDestinoTexto(p))}</td>
      <td><span class="ml-st ${tom}">${st}</span>${p.status === 'enviado' || p.status === 'erro'
        ? `<div class="small muted">${p.enviados} enviado(s)${p.falhas ? `, ${p.falhas} falha(s)` : ''}</div>` : ''}
        ${p.erro ? `<div class="small" style="color:var(--bad-tx)">${esc(p.erro)}</div>` : ''}</td>
      <td class="ml-acoes">${ibtn('eye', 'Ver o e-mail', `mlVerProgramado('${p.id}')`)}${p.status === 'programado'
        ? ibtn('cal', 'Reagendar', `mlReagendar('${p.id}')`) + ibtn('x', 'Cancelar o envio', `mlCancelar('${p.id}')`) : ''}</td></tr>`;
  };
  const tabela = (itens, vazio) => itens.length ? `<div class="wrap"><table class="tabela ml-tab"><thead><tr><th>Quando</th><th>E-mail</th><th>Para</th><th>Situação</th><th></th></tr></thead>
    <tbody>${itens.map(linha).join('')}</tbody></table></div>` : `<div class="empty">${vazio}</div>`;
  el.innerHTML = `
    <section class="card" style="margin-bottom:16px"><div class="head"><h3>A fila de envio ${dica('Uma passada da fila manda tudo o que venceu: os avisos do sino por e-mail e no aparelho, a agenda, as declarações, estes e-mails e os do processo seletivo. O agendamento do banco passa a cada minuto; sem ele, o portal aberto aciona a fila a cada dois minutos.')}</h3></div>
      <div id="ml-fila"><div class="carregando"><span class="spin"></span></div></div></section>
    <section class="card" style="margin-bottom:16px"><div class="head"><h3>Na fila <span class="n">${fila.length}</span></h3>
        <a href="#/admin/emails">Escrever um e-mail</a></div>
      ${tabela(fila, 'Nada programado. Escreva um e-mail ou programe a série das pílulas de conhecimento.')}</section>
    <section class="card" id="ml-historico"><div class="head"><h3>Histórico</h3></div>
      ${tabela(hist, 'Nenhum envio ainda.')}</section>`;
  mlFilaSituacao();
}
/* ---------------- a fila de envio (32.0) ----------------
   O que fila_situacao() conta: se o agendamento do banco existe e se as
   passadas dele chegam à função, o que espera em cada fila e o último
   erro. Até a 32.0, a fila só andava quando alguém apertava o teste de
   e-mail; o recado aqui diz qual das duas coisas falta, quando falta. */
async function mlFilaSituacao(){
  const el = $('#ml-fila'); if (!el) return;
  const r = await sb.rpc('fila_situacao').then(x => x, e => ({ error: e }));
  if (r.error){
    el.innerHTML = /fila_situacao/.test(r.error.message || '')
      ? `<div class="aviso-box warn" style="margin:0">Falta aplicar a migração <code>db/v32_fila_e_notificacoes.sql</code>.
         Sem ela, a fila só anda quando alguém aperta o teste de e-mail.</div>`
      : `<p class="small muted">${esc(r.error.message)}</p>`;
    return;
  }
  const d = r.data || {};
  if (d.status !== 'ok'){ el.innerHTML = ''; return; }
  const banco = [d.por_origem?.agendamento, d.por_origem?.evento].filter(Boolean).sort().pop();
  const emDia = banco && Date.now() - new Date(banco).getTime() < 10 * 60e3;
  const aviso = emDia
    ? `<div class="aviso-box ok">A fila anda sozinha: a última passada do agendamento foi ${esc(fmtQuando(banco))}.</div>`
    : !d.agendada
    ? `<div class="aviso-box warn"><b>O agendamento automático não está ligado.</b> A fila anda quando alguém abre o portal (um
        empurrão a cada dois minutos) ou pelo botão abaixo. Para ligar: no Supabase, ligue o Cron (Integrations) e o pg_net
        (Database › Extensions) e rode de novo a migração 32.0.</div>`
    : `<div class="aviso-box warn"><b>O agendamento está ligado, mas as passadas não chegam à função</b>${banco ? ` (a última chegou ${esc(fmtQuando(banco))})` : ''}.
        Quase sempre é a verificação de JWT da função, que precisa ficar desligada: Edge Functions › notificar-email ›
        Details › Enforce JWT verification. Enquanto isso, o portal aberto dá o empurrão.</div>`;
  const pend = d.pendentes || {};
  const nomes = [['avisos', 'avisos do sino'], ['agenda', 'da agenda'], ['declaracoes', 'declarações'],
                 ['programados', 'programados vencidos'], ['selecao', 'do processo seletivo']];
  const erro = d.ultimo_erro?.resultado;
  el.innerHTML = `${aviso}
    <div class="ml-fila-n">${nomes.filter(([k]) => k in pend).map(([k, l]) => `<span><b>${Number(pend[k]) || 0}</b>${l}</span>`).join('')}</div>
    <p class="small muted">Última passada: ${d.ultima_inicio ? esc(fmtQuando(d.ultima_inicio)) : 'nenhuma'}${d.em_curso_desde ? ', rodando agora' : ''}.
      ${erro ? `Último erro, ${esc(fmtQuando(d.ultimo_erro.quando))}: ${esc(erro.detalhe || erro.push_detalhe || erro.status || '')}.` : ''}</p>
    <div class="acts" style="justify-content:flex-start"><button class="btn ghost mini" id="ml-rodar" onclick="mlRodarFila(this)">${ic('enviar')} Rodar a fila agora</button></div>`;
}
async function mlRodarFila(bt){
  if (bt){ bt.disabled = true; bt.lastChild.textContent = ' Rodando…'; }
  const { data, error } = await sb.functions.invoke('notificar-email', { body: { origem: 'teste' } });
  if (error) toast('A função de envio não respondeu: ' + (error.message || 'erro'), true);
  else if (data?.status === 'ocupada') toast('Já havia uma passada rodando: ela leva o que estiver na fila.');
  else if (data?.status === 'ok' || data?.status === 'smtp_nao_configurado'){
    const partes = [['enviadas', 'aviso(s) por e-mail'], ['push', 'no aparelho'], ['agenda', 'da agenda'], ['documentos', 'declaração(ões)'],
                    ['programados', 'programado(s)'], ['ps', 'do processo seletivo']]
      .filter(([k]) => typeof data[k] === 'number' && data[k] > 0).map(([k, l]) => `${data[k]} ${l}`);
    toast(data.status === 'smtp_nao_configurado' ? 'A função rodou, mas falta configurar o e-mail: ' + (data.detalhe || '')
      : partes.length ? 'Passada feita: ' + partes.join(', ') + '.' : 'Passada feita: nada esperava envio.');
  }
  else toast('A função respondeu ' + (data?.status || 'sem status') + (data?.detalhe ? ': ' + data.detalhe : '.'), true);
  if (bt) bt.disabled = false;
  mlProgramados();
}

async function mlLinhaCompleta(id){
  const { data, error } = await sb.from('email_programados').select('*').eq('id', id).maybeSingle();
  if (error || !data){ toast('Não foi possível abrir o e-mail' + (error ? ': ' + error.message : '.'), true); return null; }
  return data;
}
async function mlVerProgramado(id){
  const p = await mlLinhaCompleta(id); if (!p) return;
  abreModal(`<h3>${esc(p.assunto)}</h3>
    <p class="small muted" style="margin:-2px 0 12px">${esc(p.remetente_nome)}, para ${esc(mlDestinoTexto(p))}, ${esc(fmtDT(p.enviar_em))}.
      A prévia usa o seu nome no lugar do de cada pessoa.</p>
    <iframe class="ml-ver" title="O e-mail programado"></iframe>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button></div>`, 'imenso');
  document.querySelector('#modal .ml-ver').srcdoc = mlPersonalizar(p.html, mlMeuNome());
}
async function mlReagendar(id){
  const p = await mlLinhaCompleta(id); if (!p) return;
  mlModalProgramar({ id:p.id, assunto:p.assunto, html:p.html, texto:p.texto, remetente:p.remetente, remetente_nome:p.remetente_nome,
    roteiro_id:p.roteiro_id, todos:p.todos, grupos:p.grupos || [], registros:p.registros || [], enviar_em:p.enviar_em });
}
async function mlCancelar(id){
  const p = (ML.programados || []).find(x => x.id === id);
  if (!await confirma(`Cancelar o envio de <b>${esc(p?.assunto || 'este e-mail')}</b>? Ele sai da fila e não é enviado.`, 'Cancelar o envio')) return;
  const { data, error } = await sb.rpc('email_programado_cancelar', { p_id: id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível cancelar'), true);
  toast('Envio cancelado.'); mlProgramados();
}

/* ============================================================
   PÍLULAS DE CONHECIMENTO
   Os roteiros prontos (email_roteiros): o texto, a área que assina e os
   grupos a quem interessa. "Programar série" põe os escolhidos na fila,
   um a cada quatro dias, sem cair em fim de semana.
   ============================================================ */
async function mlCarregarRoteiros(){
  const { data, error } = await sb.from('email_roteiros').select('*').order('ordem').order('codigo');
  if (error) throw error;
  return (ML.roteiros = data || []);
}
/* os grupos do roteiro são nomes; o envio precisa dos ids. Nome que não
   existe mais no catálogo vira aviso, não envio para a equipe toda. */
function mlGruposRoteiro(rt){
  const nomes = rt.grupos || [];
  const ids = nomes.map(n => grupoPorNome(n)?.id).filter(Boolean);
  const faltam = nomes.filter(n => !grupoPorNome(n));
  return { todos: !nomes.length, ids, faltam };
}
function mlParaRoteiro(rt){
  const g = mlGruposRoteiro(rt);
  if (g.todos) return 'Equipe toda';
  return (rt.grupos || []).map(n => grupoPorNome(n) ? esc(n) : `<s title="Grupo inexistente">${esc(n)}</s>`).join(', ');
}
function mlChipRemetente(k){
  const r = remetenteMl(k), th = THEMES_MAILER[r?.tema] || THEMES_MAILER.grafite;
  return `<span class="ml-rem" style="background:${th.band};color:${th.onBand};border-color:${th.bandRule}">${esc(r ? r.de : k)}</span>`;
}
/* o último envio e o próximo de cada roteiro, pelos programados */
function mlHistoricoRoteiro(id){
  const ps = (ML.programados || []).filter(p => p.roteiro_id === id);
  const prox = ps.filter(p => p.status === 'programado').sort((a, b) => a.enviar_em.localeCompare(b.enviar_em))[0];
  const ult = ps.filter(p => p.status === 'enviado').sort((a, b) => b.enviar_em.localeCompare(a.enviar_em))[0];
  return { prox, ult };
}
async function mlPilulas(){
  const el = $('#ml-corpo-tela'); if (!el) return;
  el.innerHTML = '<div class="carregando"><span class="spin"></span> Carregando…</div>';
  try { await Promise.all([mlCarregarRoteiros(), mlCarregarProgramados()]); } catch(e){ return mlSemMigracao(el, e); }
  const rts = ML.roteiros, ativos = rts.filter(r => r.ativo);
  el.innerHTML = `
    <div class="ml-pil-topo">
      <p class="small muted">E-mails curtos que apresentam e relembram o que o SOMA faz, cada um assinado pela área a que interessa.
        ${dica('Sugestão: um a cada quatro dias. Cada pílula vai para os grupos indicados nela (sem grupo, para a equipe toda). A série pula fins de semana e não repete o que já está na fila.')}</p>
      <span class="ml-bts"><button class="btn ghost mini" onclick="mlEditarRoteiro()">${ic('plus')} Nova pílula</button>
        <button class="btn solid mini" onclick="mlModalSerie()" ${ativos.length ? '' : 'disabled'}>${ic('repetir')} Programar série</button></span>
    </div>
    <div class="ml-rots">${rts.map(rt => {
      const { prox, ult } = mlHistoricoRoteiro(rt.id), g = mlGruposRoteiro(rt);
      return `<article class="ml-rot${rt.ativo ? '' : ' off'}">
        <div class="ml-rot-cab">${mlChipRemetente(rt.remetente)}<span class="mono small muted">${esc(rt.codigo)}</span>
          ${rt.ativo ? '' : '<span class="pill">Fora da série</span>'}</div>
        <h4>${esc(rt.titulo)}</h4>
        <p class="small muted">${esc(rt.assunto)}</p>
        <p class="small">Para: ${mlParaRoteiro(rt)}${g.faltam.length ? ` <span style="color:var(--warn-tx)">(grupo inexistente: ${esc(g.faltam.join(', '))})</span>` : ''}</p>
        <p class="small muted">${prox ? `Na fila: ${esc(fmtDT(prox.enviar_em))}` : ult ? `Último envio: ${esc(fmtDT(ult.enviado_em || ult.enviar_em))}` : 'Ainda não enviada'}</p>
        <div class="ml-rot-bts">${ibtn('eye', 'Ver', `mlVerRoteiro('${rt.id}')`)}${ibtn('escrever', 'Abrir no mailer', `mlUsarRoteiro('${rt.id}')`)}
          ${ibtn('relogio', 'Programar esta', `mlProgramarRoteiro('${rt.id}')`)}${ibtn('pencil', 'Editar', `mlEditarRoteiro('${rt.id}')`)}
          ${ibtn(rt.ativo ? 'olho_fechado' : 'check', rt.ativo ? 'Tirar da série' : 'Pôr na série', `mlAtivarRoteiro('${rt.id}',${!rt.ativo})`)}</div>
      </article>`; }).join('') || '<div class="empty">Nenhuma pílula. Crie a primeira.</div>'}</div>`;
}
const mlRoteiro = (id) => (ML.roteiros || []).find(r => r.id === id);
/* o e-mail pronto de um roteiro: HTML, texto e remetente */
function mlMontarRoteiro(rt){
  const r = mlDoRoteiro(rt), cfg = mlCfg(r), rem = remetenteMl(rt.remetente);
  return { assunto: rt.assunto, html: construirMailerHTML(cfg), texto: mlTexto(cfg),
           remetente: rt.remetente, remetente_nome: nomeDeEnvio(rem ? rem.de : 'NeuroDynamics'), roteiro_id: rt.id };
}
function mlVerRoteiro(id){
  const rt = mlRoteiro(id); if (!rt) return;
  const m = mlMontarRoteiro(rt);
  abreModal(`<h3>${esc(rt.assunto)}</h3>
    <p class="small muted" style="margin:-2px 0 12px">${esc(m.remetente_nome)}, para ${mlParaRoteiro(rt)}.</p>
    <iframe class="ml-ver" title="A pílula"></iframe>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Fechar</button>
      <button class="btn ghost" onclick="fechaModal();mlUsarRoteiro('${rt.id}')">${ic('escrever')} Abrir no mailer</button>
      <button class="btn solid" onclick="mlProgramarRoteiro('${rt.id}')">${ic('relogio')} Programar</button></div>`, 'imenso');
  document.querySelector('#modal .ml-ver').srcdoc = mlPersonalizar(m.html, mlMeuNome());
}
function mlUsarRoteiro(id){
  const rt = mlRoteiro(id); if (!rt) return;
  ML.rascunho = mlDoRoteiro(rt);
  location.hash = '#/admin/emails';
}
function mlProgramarRoteiro(id){
  const rt = mlRoteiro(id); if (!rt) return;
  const g = mlGruposRoteiro(rt);
  if (!g.todos && !g.ids.length) return toast(`Os grupos desta pílula não existem mais (${g.faltam.join(', ')}). Edite a pílula.`, true);
  mlModalProgramar({ ...mlMontarRoteiro(rt), todos: g.todos, grupos: g.ids });
}
async function mlAtivarRoteiro(id, ativo){
  const { data, error } = await sb.from('email_roteiros').update({ ativo, atualizado_em: new Date().toISOString(), atualizado_por: mlMeuNome() || null })
    .eq('id', id).select();
  if (error || (Array.isArray(data) && !data.length)) return toast('Não foi possível salvar' + (error ? ': ' + error.message : '.'), true);
  toast(ativo ? 'A pílula voltou para a série.' : 'A pílula saiu da série.'); mlPilulas();
}

/* ---------------- editar uma pílula ---------------- */
function mlEditarRoteiro(id){
  const rt = id ? mlRoteiro(id) : null;
  const prox = 'PIL-' + String((ML.roteiros || []).reduce((m, r) => Math.max(m, +(String(r.codigo).match(/\d+/)?.[0] || 0)), 0) + 1).padStart(2, '0');
  const v = rt || { codigo:prox, remetente:'pessoal', grupos:[], assunto:'', preheader:'', titulo:'',
    corpo:'Olá, {{primeiro_nome}}.\n\n', cta_rotulo:'', cta_link:'', ordem:((ML.roteiros || []).at(-1)?.ordem || 0) + 10, ativo:true };
  const gs = [...(state.grupos || [])].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const soltos = (v.grupos || []).filter(n => !grupoPorNome(n));
  abreModal(`<h3>${ic('lampada')} ${rt ? 'Editar a pílula' : 'Nova pílula'}</h3>
    <div class="dupla"><div class="fld"><label for="rt-cod">Código</label><input id="rt-cod" value="${esc(v.codigo)}"></div>
      <div class="fld"><label for="rt-rem">Quem assina</label><select id="rt-rem">${REMETENTES_MAILER.map(x =>
        `<option value="${x.k}" ${x.k === v.remetente ? 'selected' : ''}>${esc(x.t)}</option>`).join('')}</select></div></div>
    <div class="fld"><label for="rt-assunto">Assunto</label><input id="rt-assunto" value="${esc(v.assunto)}"></div>
    <div class="fld"><label for="rt-pre">Pré-cabeçalho</label><input id="rt-pre" value="${esc(v.preheader || '')}"></div>
    <div class="fld"><label for="rt-tit">Chamada</label><input id="rt-tit" value="${esc(v.titulo)}"></div>
    <div class="fld"><label for="rt-corpo">Texto ${dica('Comece por "Olá, {{primeiro_nome}}." e separe os parágrafos com uma linha em branco. Frases curtas e diretas, sem travessão.')}</label>
      <textarea id="rt-corpo" style="min-height:200px">${esc(v.corpo)}</textarea></div>
    <div class="dupla"><div class="fld"><label for="rt-cta">Botão</label><input id="rt-cta" value="${esc(v.cta_rotulo || '')}" placeholder="Abrir a agenda"></div>
      <div class="fld"><label for="rt-link">Link do botão</label><input id="rt-link" value="${esc(v.cta_link || '')}" placeholder="#/agenda ou https://…"></div></div>
    <div class="fld"><label>Para ${dica('Sem grupo marcado, a pílula vai para a equipe toda. Marcar um grupo inclui os grupos abaixo dele.')}</label>
      <div class="multi ml-lista">${gs.map(g => `<label class="check"><input type="checkbox" class="rt-gp" value="${esc(g.nome)}" ${(v.grupos || []).includes(g.nome) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('')}
        ${soltos.map(n => `<label class="check"><input type="checkbox" class="rt-gp" value="${esc(n)}" checked> <s>${esc(n)}</s> <span class="small muted">(não existe no catálogo)</span></label>`).join('')}</div></div>
    <div class="dupla"><div class="fld"><label for="rt-ordem">Ordem na série</label><input id="rt-ordem" type="number" step="10" value="${v.ordem}"></div>
      <div class="fld"><label>&nbsp;</label><label class="check ml-chk"><input type="checkbox" id="rt-ativo" ${v.ativo ? 'checked' : ''}> Na série</label></div></div>
    <div class="acts" style="justify-content:flex-end">
      ${rt ? `<button class="btn perigo" style="margin-right:auto" onclick="mlApagarRoteiro('${rt.id}')">${ic('trash')} Apagar</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="mlSalvarRoteiro('${rt ? rt.id : ''}')">Salvar</button></div>`, 'largo', true);
}
async function mlSalvarRoteiro(id){
  const v = (s) => $(s).value.trim();
  const dados = { codigo:v('#rt-cod'), remetente:$('#rt-rem').value, assunto:v('#rt-assunto'), preheader:v('#rt-pre') || null,
    titulo:v('#rt-tit'), corpo:$('#rt-corpo').value.trim(), cta_rotulo:v('#rt-cta') || null, cta_link:v('#rt-link') || null,
    grupos:[...document.querySelectorAll('.rt-gp:checked')].map(i => i.value), ordem:+$('#rt-ordem').value || 100,
    ativo:$('#rt-ativo').checked, atualizado_em:new Date().toISOString(), atualizado_por:mlMeuNome() || null };
  if (!dados.codigo || !dados.assunto || !dados.titulo || !dados.corpo) return toast('Preencha código, assunto, chamada e texto.', true);
  if (dados.cta_link && !/^(https?:\/\/|#\/)/i.test(dados.cta_link)) return toast('O link do botão começa com https:// ou #/.', true);
  if (dados.cta_link && !dados.cta_rotulo) return toast('Dê um rótulo ao botão.', true);
  const q = id ? sb.from('email_roteiros').update(dados).eq('id', id) : sb.from('email_roteiros').insert(dados);
  const { data, error } = await q.select();
  if (error || (Array.isArray(data) && !data.length))
    return toast('Não foi possível salvar' + (error ? (/duplicate|unique/i.test(error.message) ? ': já existe uma pílula com esse código.' : ': ' + error.message) : '.'), true);
  fechaModal(); toast('Pílula salva.'); mlPilulas();
}
async function mlApagarRoteiro(id){
  const rt = mlRoteiro(id);
  if (!await confirma(`Apagar a pílula <b>${esc(rt?.codigo || '')}</b>? Os envios já feitos continuam no histórico.`, 'Apagar')) return;
  const { error } = await sb.from('email_roteiros').delete().eq('id', id);
  if (error) return toast('Não foi possível apagar: ' + error.message, true);
  toast('Pílula apagada.'); mlPilulas();
}

/* ---------------- a série ----------------
   Os roteiros escolhidos, na ordem, a partir de uma data, com o
   intervalo pedido. Sábado e domingo passam para segunda; o seguinte
   conta a partir do dia em que o anterior saiu. */
function mlDatasSerie(inicioISO, hora, intervalo, n, pularFds){
  const [h, mi] = String(hora || '09:00').split(':').map(Number);
  const [a, m, d] = inicioISO.split('-').map(Number);
  let dia = new Date(a, m - 1, d, h || 0, mi || 0, 0, 0);
  const out = [];
  for (let i = 0; i < n; i++){
    if (pularFds) while (dia.getDay() === 0 || dia.getDay() === 6) dia.setDate(dia.getDate() + 1);
    out.push(new Date(dia));
    dia.setDate(dia.getDate() + intervalo);
  }
  return out;
}
function mlModalSerie(){
  const rts = (ML.roteiros || []).filter(r => r.ativo);
  const naFila = new Set((ML.programados || []).filter(p => p.status === 'programado').map(p => p.roteiro_id));
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  abreModal(`<h3>${ic('repetir')} Programar série</h3>
    <p class="small muted" style="line-height:1.6;margin:-2px 0 14px">As pílulas marcadas entram na fila, na ordem, uma a cada intervalo.
      Cada uma vai para os grupos indicados nela e sai com o remetente da área.</p>
    <div class="ml-serie-cfg">
      <div class="fld"><label for="se-ini">Primeira</label><input id="se-ini" type="date" value="${isoDia(amanha)}" onchange="mlSeriePrevia()"></div>
      <div class="fld"><label for="se-hora">Hora</label><input id="se-hora" type="time" value="09:00" onchange="mlSeriePrevia()"></div>
      <div class="fld"><label for="se-int">A cada (dias)</label><input id="se-int" type="number" min="1" max="30" value="4" oninput="mlSeriePrevia()"></div>
      <div class="fld"><label>&nbsp;</label><label class="check ml-chk"><input type="checkbox" id="se-fds" checked onchange="mlSeriePrevia()"> Pular fim de semana</label></div>
    </div>
    <div class="fld"><label>Pílulas</label>
      <div class="multi ml-lista" style="max-height:170px">${rts.map(rt => `<label class="check"><input type="checkbox" class="se-rt" value="${rt.id}"
        ${naFila.has(rt.id) ? '' : 'checked'} onchange="mlSeriePrevia()"> <span><span class="mono small">${esc(rt.codigo)}</span> ${esc(rt.titulo)}${naFila.has(rt.id) ? ' <span class="small muted">(já na fila)</span>' : ''}</span></label>`).join('')}</div></div>
    <div id="se-prev"></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="se-ok" onclick="mlSerieSalvar()">Programar</button></div>`, 'largo', true);
  mlSeriePrevia();
}
function mlSerieItens(){
  const ids = [...document.querySelectorAll('.se-rt:checked')].map(i => i.value);
  const rts = (ML.roteiros || []).filter(r => ids.includes(r.id));
  const intervalo = Math.max(1, Math.min(30, +$('#se-int').value || 4));
  const datas = mlDatasSerie($('#se-ini').value || hojeISO(), $('#se-hora').value, intervalo, rts.length, $('#se-fds').checked);
  return rts.map((rt, i) => ({ rt, quando: datas[i], g: mlGruposRoteiro(rt) }));
}
function mlSeriePrevia(){
  const el = $('#se-prev'); if (!el) return;
  const itens = mlSerieItens(), fora = itens.filter(x => !x.g.todos && !x.g.ids.length);
  const ok = $('#se-ok');
  if (ok){ ok.disabled = !(itens.length - fora.length); ok.innerHTML = `${ic('relogio')} Programar ${itens.length - fora.length} e-mail(s)`; }
  el.innerHTML = itens.length ? `<div class="wrap" style="max-height:240px"><table class="tabela ml-serie-tab"><thead><tr><th>Quando</th><th>Pílula</th><th>Assina</th><th>Para</th></tr></thead><tbody>
    ${itens.map(({ rt, quando, g }) => `<tr${!g.todos && !g.ids.length ? ' class="ml-fora"' : ''}>
      <td class="mono">${esc(quando.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'2-digit' }))}</td>
      <td>${esc(rt.titulo)}</td><td>${mlChipRemetente(rt.remetente)}</td>
      <td>${!g.todos && !g.ids.length ? '<span style="color:var(--warn-tx)">Grupo inexistente: fica de fora</span>' : mlParaRoteiro(rt)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="small muted">Marque ao menos uma pílula.</p>';
}
async function mlSerieSalvar(){
  const itens = mlSerieItens().filter(x => x.g.todos || x.g.ids.length);
  if (!itens.length) return toast('Nenhuma pílula para programar.', true);
  if (itens[0].quando < new Date(Date.now() - 5 * 60000)) return toast('A primeira data já passou.', true);
  const p = { itens: itens.map(({ rt, quando, g }) => ({ ...mlMontarRoteiro(rt), enviar_em: quando.toISOString(),
    todos: g.todos, grupos: g.ids, registros: [] })) };
  $('#se-ok').disabled = true;
  const { data, error } = await sb.rpc('email_programar', { p });
  if (error || data?.status !== 'ok'){ $('#se-ok').disabled = false; return toast(mlMotivo(data, error, 'Não foi possível programar a série'), true); }
  fechaModal();
  toast(`${itens.length} pílula(s) na fila, de ${fmtDT(itens[0].quando)} a ${fmtDT(itens.at(-1).quando)}.`);
  ML.programados = null; location.hash = '#/admin/emails/programados';
}
