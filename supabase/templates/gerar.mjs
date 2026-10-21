#!/usr/bin/env node
/* ============================================================
   gerar.mjs · os e-mails do Supabase Auth, no padrão do portal

   O Supabase manda seis e-mails por conta própria — confirmação de
   cadastro, convite, link de acesso, troca de e-mail, redefinição de
   senha e o código de reautenticação. Por padrão saem em inglês, com
   o layout dele. Estes modelos trocam isso pelo mesmo desenho dos
   avisos do portal: a moldura de functions/notificar-email/marca.ts
   (Comunicado do brand: cartão de 600px, cabeçalho Cortex com logo,
   Archivo e Instrument Sans, endereço e rodapé). Mudou lá, mude aqui.

   Os seis nascem de um layout só, para não divergirem entre si. O
   que vai para o painel do Supabase são os .html desta pasta — ver
   o LEIAME.md.

   Uso:  node gerar.mjs          (grava os .html)
         node gerar.mjs --check  (só confere; sai 1 se divergir)
   ============================================================ */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pasta = dirname(fileURLToPath(import.meta.url));
const soConfere = process.argv.includes('--check');

/* os mesmos endereços, cores e fontes do Comunicado do brand (Cortex),
   como em functions/notificar-email/marca.ts */
const PORTAL = 'https://membro.neurodynamics.dev';
const LOGO = 'https://brand.neurodynamics.dev/assets/logo-imagotipo-cortex-dark.png';
const SANS = "'Instrument Sans',Helvetica,Arial,sans-serif";
const SERIF = "Archivo,Arial,Helvetica,sans-serif";
const MONO = "'IBM Plex Mono','Courier New',monospace";
const COR = { fundo:'#E8EDEB', caixa:'#E3EFEC', tinta:'#2E3533', nota:'#616C68', acento:'#00594F', escuro:'#00352F' };

const esp = (h) => `<tr><td height="${h}" style="height:${h}px;font-size:0;line-height:0;mso-line-height-rule:exactly">&nbsp;</td></tr>`;
const fio = (cor) => `<tr><td height="1" style="height:1px;font-size:0;line-height:0;background:${cor};mso-line-height-rule:exactly">&nbsp;</td></tr>`;

/* O botão do Comunicado. Tabela, e não só <a>, para o Outlook respeitar o fundo. */
const botao = (rotulo) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${COR.escuro}" style="background:${COR.escuro};border-radius:8px"><a href="{{ .ConfirmationURL }}" target="_blank" style="display:block;padding:13px 24px;font-family:${SANS};font-weight:500;font-size:14px;line-height:18px;color:#FFFFFF;text-decoration:none">${rotulo}</a></td></tr></table>`;

/* Sob o botão: quanto o link vale e o endereço por extenso, para o
   cliente de e-mail que não abre botão. */
const reserva = (validade) => `<div style="font-family:${SANS};font-size:12px;line-height:18px;color:${COR.nota};margin-top:14px">${validade} Se o botão não abrir, copie este endereço no navegador:<br><a href="{{ .ConfirmationURL }}" style="color:${COR.acento};text-decoration:none;word-break:break-all">{{ .ConfirmationURL }}</a></div>`;

const codigo = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${COR.caixa}" style="background:${COR.caixa};border-radius:12px;padding:16px 22px;font-family:${MONO};font-size:26px;line-height:30px;letter-spacing:6px;color:${COR.escuro}">{{ .Token }}</td></tr></table>`;

const linkPortal = `<a href="${PORTAL}" style="color:${COR.nota}">Portal do Membro</a>`;

function layout(m){
  const t = (tam, cor, h) => `<tr><td style="font-family:${SANS};font-weight:400;font-size:${tam}px;line-height:${Math.round(tam*1.53)}px;mso-line-height-rule:exactly;color:${cor}">${h}</td></tr>`;
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${m.assunto}</title><link href="https://fonts.googleapis.com/css2?family=Archivo:wght@400&family=Instrument+Sans:wght@400;500&family=IBM+Plex+Mono&display=swap" rel="stylesheet"><!--[if mso]><style>td,a,span{font-family:Arial,sans-serif!important}</style><![endif]--><style>a{color:${COR.acento}}@media (max-width:620px){.wrap{width:100%!important}}</style></head>
<body style="margin:0;padding:0;background:${COR.fundo}"><span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all">${m.previa}</span>
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${COR.fundo}" style="background:${COR.fundo}"><tr><td align="center" style="padding:24px 0">
<table role="presentation" class="wrap" cellpadding="0" cellspacing="0" border="0" width="600" bgcolor="#FFFFFF" style="width:600px;max-width:600px;background:#FFFFFF"><tr><td style="padding:45px 28px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">
<tr><td bgcolor="${COR.caixa}" style="background:${COR.caixa};border-radius:16px;padding:30px"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:separate">
<tr><td><img src="${LOGO}" width="152" height="26" alt="NeuroDynamics" style="display:block;width:152px;height:26px;border:0"></td></tr>
${esp(32)}${fio(COR.escuro)}${esp(14)}
${t(19, COR.escuro, 'Conta')}
</table></td></tr>
${esp(30)}
<tr><td style="font-family:${SERIF};font-weight:400;letter-spacing:-.3px;font-size:26px;line-height:32px;mso-line-height-rule:exactly;color:${COR.tinta}">${m.titulo}</td></tr>${esp(14)}
${t(15, COR.tinta, 'Olá. ' + m.abertura)}${esp(14)}
${t(15, COR.tinta, m.texto)}${esp(24)}
<tr><td>${m.acao}${m.depois || ''}</td></tr>
${esp(46)}${fio(COR.tinta)}${esp(14)}
${t(13, COR.tinta, '<a href="https://neurodynamics.dev" style="color:#2E3533;text-decoration:none">neurodynamics.dev</a>')}${esp(14)}${fio(COR.tinta)}${esp(18)}
${t(13, COR.tinta, 'NeuroDynamics, Laboratório de Neuroengenharia<br>Av. Antônio Carlos, 6627, Pampulha, Belo Horizonte, MG, 31270-901<br><a href="mailto:contato@neurodynamics.dev" style="color:#2E3533">contato@neurodynamics.dev</a>')}${esp(18)}${fio(COR.tinta)}${esp(14)}
${t(11, COR.nota, m.rodape)}
</table></td></tr></table></td></tr></table></body></html>
`;
}

/* "1 hora" é o padrão do Supabase (Authentication → Sign In / Providers
   → Email → Email OTP Expiration = 3600). Mudou lá, mude aqui. */
const UMA_HORA = 'O link vale por 1 hora e só pode ser usado uma vez.';

const MODELOS = [
  { arquivo:'confirmar-cadastro.html', supabase:'Confirm signup',
    quando:'Criar conta, na tela de entrada',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Confirme o seu e-mail | Portal do Membro',
    previa:'Falta um clique para a sua conta no portal ficar pronta.',
    abertura:'Falta um passo para a sua conta no Portal do Membro ficar pronta.',
    titulo:'Confirme o seu e-mail',
    texto:'Clique no botão para confirmar que <b>{{ .Email }}</b> é seu. Depois, entre com esse e-mail e a senha escolhida.',
    acao:botao('Confirmar meu e-mail'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque alguém criou uma conta no ${linkPortal} com este endereço. Se não foi você, ignore: sem a confirmação, a conta não é ativada.` },

  { arquivo:'convite.html', supabase:'Invite user',
    quando:'Invite user, no painel do Supabase (o portal não convida)',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Você foi convidado para o Portal do Membro',
    previa:'Aceite o convite e entre no espaço da equipe.',
    abertura:'A NeuroDynamics convidou você para o Portal do Membro: avisos, agenda, atividades, documentos e os serviços do Depto. de Pessoal num lugar só.',
    titulo:'Aceite o convite',
    texto:'O convite é para <b>{{ .Email }}</b>. O link abre o portal com você já conectado. Para entrar depois por outro aparelho, crie uma senha em <b>Esqueci minha senha</b>, na tela de entrada.',
    acao:botao('Aceitar o convite'), depois:reserva('O link só pode ser usado uma vez.'),
    rodape:`Você recebe este e-mail porque a equipe da NeuroDynamics convidou este endereço para o ${linkPortal}. Se não esperava o convite, ignore: sem o clique, nenhuma conta é ativada.` },

  { arquivo:'link-de-acesso.html', supabase:'Magic Link',
    quando:'entrar sem senha — o portal não oferece hoje',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Seu link de acesso ao Portal do Membro',
    previa:'Um clique e você entra, sem senha.',
    abertura:'Você pediu para entrar no Portal do Membro sem digitar a senha.',
    titulo:'Seu link de acesso',
    texto:'Clique no botão para entrar como <b>{{ .Email }}</b>.',
    acao:botao('Entrar no portal'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque alguém pediu um link de acesso ao ${linkPortal} com este endereço. Se não foi você, ignore: sem o clique, ninguém entra.` },

  { arquivo:'trocar-email.html', supabase:'Change Email Address',
    quando:'troca do e-mail da conta — o portal não oferece hoje',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}', '{{ .NewEmail }}'],
    assunto:'Confirme a troca de e-mail | Portal do Membro',
    previa:'A troca só vale depois de confirmada.',
    abertura:'Recebemos um pedido para trocar o e-mail da sua conta no Portal do Membro.',
    titulo:'Confirme a troca de e-mail',
    texto:'De <b>{{ .Email }}</b> para <b>{{ .NewEmail }}</b>. Até a confirmação, nada muda: a conta continua entrando com o e-mail de antes.',
    acao:botao('Confirmar a troca'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque pediram a troca do e-mail da sua conta no ${linkPortal}. Se não foi você, não clique e avise o Depto. de Pessoal.` },

  { arquivo:'redefinir-senha.html', supabase:'Reset Password',
    quando:'Esqueci minha senha, e a chavinha de Administração › Contas',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Redefina a sua senha | Portal do Membro',
    previa:'O link abre o portal direto na tela de nova senha.',
    abertura:'Recebemos um pedido para redefinir a senha da sua conta no Portal do Membro.',
    titulo:'Defina uma nova senha',
    texto:'A conta é <b>{{ .Email }}</b>. O botão abre o portal direto na tela de nova senha. Mínimo de 8 caracteres.',
    acao:botao('Definir nova senha'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque alguém pediu para redefinir a senha desta conta no ${linkPortal}. Se não foi você, ignore: a sua senha continua a mesma.` },

  { arquivo:'reautenticacao.html', supabase:'Reauthentication',
    quando:'confirmação de alteração sensível — o portal não pede hoje',
    precisa:['{{ .Token }}'], proibido:['{{ .ConfirmationURL }}'],
    assunto:'Seu código de confirmação | Portal do Membro',
    previa:'Use o código para confirmar que é você.',
    abertura:'Para concluir uma alteração na sua conta do Portal do Membro, confirme que é você.',
    titulo:'Seu código de confirmação',
    texto:'Digite este código onde ele foi pedido:',
    acao:codigo,
    depois:`<div style="font-family:${SANS};font-size:12px;line-height:18px;color:${COR.nota};margin-top:14px">O código vale por 1 hora e só pode ser usado uma vez.</div>`,
    rodape:`Você recebe este e-mail porque alguém conectado à sua conta no ${linkPortal} pediu uma alteração que exige confirmação. Se não foi você, não passe o código a ninguém e troque a sua senha.` },
];

/* ============================================================
   grava (ou confere) e valida
   ============================================================ */
let divergentes = 0, erros = 0;
for (const m of MODELOS){
  const html = layout(m);
  const falta = m.precisa.filter(v => !html.includes(v));
  const sobra = (m.proibido || []).filter(v => html.includes(v));
  /* sobra de template JS ou chave de modelo que o Supabase não conhece */
  const lixo = html.match(/\$\{|undefined|\{\{(?!\s*\.(ConfirmationURL|Email|NewEmail|Token)\s*\}\})[^}]*\}\}/g) || [];
  if (falta.length || sobra.length || lixo.length){
    erros++;
    console.error(`✗ ${m.arquivo}: ${[...falta.map(v => 'falta ' + v), ...sobra.map(v => 'não devia ter ' + v), ...lixo.map(v => 'sobra ' + v)].join('; ')}`);
    continue;
  }
  const caminho = join(pasta, m.arquivo);
  const atual = existsSync(caminho) ? readFileSync(caminho, 'utf8') : '';
  if (atual !== html){
    divergentes++;
    if (soConfere) console.error(`✗ ${m.arquivo}: desatualizado.`);
    else writeFileSync(caminho, html);
  }
}
if (erros) process.exit(1);
if (soConfere && divergentes){
  console.error(`\n${divergentes} modelo(s) fora de sincronia. Rode: node gerar.mjs`);
  process.exit(1);
}
console.log(MODELOS.map(m => `  ${m.supabase.padEnd(21)} ${m.arquivo.padEnd(24)} ${m.assunto}`).join('\n'));
console.log(`\n✓ ${MODELOS.length} modelos` + (divergentes ? ` · ${divergentes} gravado(s)` : ' · tudo em sincronia'));
