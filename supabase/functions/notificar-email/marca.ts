/* Moldura dos e-mails, conforme os templates de e-mail do brand
   (Boletim e Comunicado, família Cortex): tabelas, estilos inline, 600px,
   Archivo e Instrument Sans com fallback Helvetica/Arial. */
export const LOGO = "https://brand.neurodynamics.dev/assets/logo-imagotipo-cortex-dark.png";
const SANS = "'Instrument Sans',Helvetica,Arial,sans-serif";
const SERIF = "Archivo,Arial,Helvetica,sans-serif";
export const MONO = "'IBM Plex Mono','Courier New',monospace";

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
/** A data de hoje por extenso, no horário de Brasília. */
export function dataHoje(agora = Date.now()): string {
  const d = new Date(agora - 3 * 3600e3);
  return `${d.getUTCDate()} de ${MESES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
}

export const esp = (h: number) =>
  `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td></tr>`;
const fio = (cor: string) =>
  `<tr><td height="1" style="height:1px;font-size:0;line-height:0;background:${cor};mso-line-height-rule:exactly">&nbsp;</td></tr>`;
export const titulo = (t: string, tam = 26) =>
  `<tr><td style="font-family:${SERIF};font-weight:400;letter-spacing:-.3px;font-size:${tam}px;line-height:${tam + 6}px;mso-line-height-rule:exactly;color:#2E3533">${t}</td></tr>`;
export const texto = (t: string, cor = "#2E3533", tam = 15) =>
  `<tr><td style="font-family:${SANS};font-weight:400;font-size:${tam}px;line-height:${Math.round(tam * 1.53)}px;mso-line-height-rule:exactly;color:${cor}">${t}</td></tr>`;
export const botao = (href: string, rot: string) =>
  `<tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#00352F" style="background:#00352F;border-radius:8px"><a href="${esc(href)}" style="display:block;padding:13px 24px;font-family:${SANS};font-weight:500;font-size:14px;line-height:18px;color:#FFFFFF;text-decoration:none">${esc(rot)}</a></td></tr></table></td></tr>`;

export interface Moldura {
  assunto: string;
  /** o rótulo no cabeçalho, abaixo do fio */
  categoria: string;
  /** linhas (tr) do corpo, dentro da tabela de 510px */
  miolo: string;
  /** o parágrafo final, antes do endereço */
  rodape?: string;
  /** o link de descadastro, quando há */
  descadastro?: string;
  preheader?: string;
}

export function moldura(m: Moldura): string {
  const desc = m.descadastro
    ? ` <a href="${esc(m.descadastro)}" style="color:#616C68">Descadastrar da comunidade</a>.` : "";
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(m.assunto)}</title><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400&family=Instrument+Sans:wght@400;500&family=IBM+Plex+Mono&display=swap" rel="stylesheet"><!--[if mso]><style>td,a,span{font-family:Arial,sans-serif!important}</style><![endif]--><style>a{color:#00594F}@media (max-width:620px){.wrap{width:100%!important}.col{display:block!important;width:100%!important}}</style></head><body style="margin:0;padding:0;background:#E8EDEB">${m.preheader ? `<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${esc(m.preheader)}</span>` : ""}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="#E8EDEB" style="background:#E8EDEB"><tr><td align="center" style="padding:24px 0"><table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF"><tr><td style="padding:45px 28px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">
<tr><td bgcolor="#E3EFEC" style="background:#E3EFEC;border-radius:16px;padding:30px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate"><tr><td><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td width="50%" valign="middle"><img src="${LOGO}" width="152" height="26" alt="NeuroDynamics" style="display:block;width:152px;height:26px;border:0"></td><td width="50%" align="right" valign="middle" style="font-family:${SANS};font-size:13px;line-height:18px;color:#00352F">${esc(dataHoje())}</td></tr></table></td></tr>${esp(32)}${fio("#00352F")}${esp(14)}<tr><td style="font-family:${SANS};font-weight:400;font-size:19px;line-height:24px;mso-line-height-rule:exactly;color:#00352F">${esc(m.categoria)}</td></tr></table></td></tr>
${esp(30)}${m.miolo}${esp(46)}${fio("#2E3533")}${esp(14)}
<tr><td style="font-family:${SANS};font-size:13px;line-height:20px;color:#2E3533"><a href="https://neurodynamics.dev" style="color:#2E3533;text-decoration:none">neurodynamics.dev</a></td></tr>${esp(14)}${fio("#2E3533")}${esp(18)}
<tr><td style="font-family:${SANS};font-size:13px;line-height:20px;color:#2E3533">NeuroDynamics, Laboratório de Neuroengenharia<br>Av. Antônio Carlos, 6627, Pampulha, Belo Horizonte, MG, 31270-901<br><a href="mailto:contato@neurodynamics.dev" style="color:#2E3533">contato@neurodynamics.dev</a></td></tr>${esp(18)}${fio("#2E3533")}${esp(14)}
<tr><td style="font-family:${SANS};font-size:11px;line-height:16px;color:#616C68">${m.rodape ?? ""}${desc}</td></tr></table></td></tr></table></td></tr></table></body></html>`;
}
