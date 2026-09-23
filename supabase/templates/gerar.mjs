#!/usr/bin/env node
/* ============================================================
   gerar.mjs · os e-mails do Supabase Auth, no padrão do portal

   O Supabase manda seis e-mails por conta própria — confirmação de
   cadastro, convite, link de acesso, troca de e-mail, redefinição de
   senha e o código de reautenticação. Por padrão saem em inglês, com
   o layout dele. Estes modelos trocam isso pelo mesmo desenho dos
   avisos do portal: o corpoHTML de functions/notificar-email/index.ts
   (fundo cinza-claro, cartão branco de 560px, logo teal, "Olá", um
   bloco com borda e o rodapé cinza). Mudou lá, mude aqui.

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

/* os mesmos endereços e cores do corpoHTML */
const PORTAL = 'https://membro.neurodynamics.dev';
const LOGO = PORTAL + '/mailer/logo-00594f.png';
const F = 'Helvetica,Arial,sans-serif';
const COR = { fundo:'#f4f6f4', borda:'#e3e6e3', tinta:'#1d1d1f', apoio:'#4a514a', nota:'#8a908a', acento:'#00594F' };

/* O botão é o do Full mailer, na cor dos links dos avisos. Tabela,
   e não só <a>, para o Outlook respeitar o fundo. */
const botao = (rotulo) => `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
                    <td style="border-radius:10px;background:${COR.acento}">
                      <a href="{{ .ConfirmationURL }}" target="_blank"
                         style="display:inline-block;padding:12px 22px;font:600 14px/1 ${F};
                                color:#ffffff;text-decoration:none;border-radius:10px">${rotulo}</a>
                    </td></tr></table>`;

/* Sob o botão: quanto o link vale e o endereço por extenso, para o
   cliente de e-mail que não abre botão. */
const reserva = (validade) => `<div style="font:400 12px/1.6 ${F};color:${COR.nota};margin-top:14px">
                    ${validade} Se o botão não abrir, copie este endereço no navegador:<br>
                    <a href="{{ .ConfirmationURL }}" style="color:${COR.acento};text-decoration:none;word-break:break-all">{{ .ConfirmationURL }}</a>
                  </div>`;

const codigo = `<div style="margin-top:12px;display:inline-block;padding:12px 18px;border:1px solid ${COR.borda};
                              border-radius:10px;background:${COR.fundo};
                              font:600 26px/1 Menlo,Consolas,'Courier New',monospace;
                              letter-spacing:6px;color:#00352F">{{ .Token }}</div>`;

const linkPortal = `<a href="${PORTAL}" style="color:${COR.acento};text-decoration:none">Portal do Membro</a>`;

function layout(m){
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>${m.assunto}</title></head>
<body style="margin:0;padding:0;background:${COR.fundo}">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${m.previa}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo}">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid ${COR.borda};border-radius:14px">
        <tr><td style="padding:28px 28px 8px">
          <img src="${LOGO}" width="188" alt="NeuroDynamics"
               style="display:block;border:0;outline:none">
        </td></tr>
        <tr><td style="padding:14px 28px 0">
          <div style="font:400 15px/1.6 ${F};color:${COR.tinta}">Olá.</div>
          <div style="font:400 14px/1.6 ${F};color:${COR.apoio};margin-top:6px">
            ${m.abertura}</div>
        </td></tr>
        <tr><td style="padding:22px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:0 0 18px">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                     style="border:1px solid ${COR.borda};border-radius:10px">
                <tr><td style="padding:16px 18px">
                  <div style="font:600 15px/1.45 ${F};color:${COR.tinta}">${m.titulo}</div>
                  <div style="font:400 14px/1.6 ${F};color:${COR.apoio};margin-top:6px">
                    ${m.texto}</div>
                  <div style="margin-top:14px">
                  ${m.acao}
                  </div>
                  ${m.depois || ''}
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:4px 28px 28px">
          <div style="font:400 12px/1.6 ${F};color:${COR.nota};
                      border-top:1px solid ${COR.borda};padding-top:16px">
            ${m.rodape}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>
`;
}

/* "1 hora" é o padrão do Supabase (Authentication → Sign In / Providers
   → Email → Email OTP Expiration = 3600). Mudou lá, mude aqui. */
const UMA_HORA = 'O link vale por 1 hora e só pode ser usado uma vez.';

const MODELOS = [
  { arquivo:'confirmar-cadastro.html', supabase:'Confirm signup',
    quando:'Criar conta, na tela de entrada',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Confirme o seu e-mail · Portal do Membro',
    previa:'Falta um clique para a sua conta no portal ficar pronta.',
    abertura:'Falta um passo para a sua conta no Portal do Membro ficar pronta.',
    titulo:'Confirme o seu e-mail',
    texto:'Clique no botão para confirmar que <b>{{ .Email }}</b> é seu. Depois é só entrar com esse e-mail e a senha que você escolheu.',
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
    assunto:'Confirme a troca de e-mail · Portal do Membro',
    previa:'A troca só vale depois de confirmada.',
    abertura:'Recebemos um pedido para trocar o e-mail da sua conta no Portal do Membro.',
    titulo:'Confirme a troca de e-mail',
    texto:'De <b>{{ .Email }}</b> para <b>{{ .NewEmail }}</b>. Até a confirmação, nada muda: a conta continua entrando com o e-mail de antes.',
    acao:botao('Confirmar a troca'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque pediram a troca do e-mail da sua conta no ${linkPortal}. Se não foi você, não clique e avise o Depto. de Pessoal.` },

  { arquivo:'redefinir-senha.html', supabase:'Reset Password',
    quando:'Esqueci minha senha, e a chavinha de Administração › Contas',
    precisa:['{{ .ConfirmationURL }}', '{{ .Email }}'],
    assunto:'Redefina a sua senha · Portal do Membro',
    previa:'O link abre o portal direto na tela de nova senha.',
    abertura:'Recebemos um pedido para redefinir a senha da sua conta no Portal do Membro.',
    titulo:'Defina uma nova senha',
    texto:'A conta é <b>{{ .Email }}</b>. O botão abre o portal direto na tela de nova senha — escolha uma com pelo menos 8 caracteres.',
    acao:botao('Definir nova senha'), depois:reserva(UMA_HORA),
    rodape:`Você recebe este e-mail porque alguém pediu para redefinir a senha desta conta no ${linkPortal}. Se não foi você, ignore: a sua senha continua a mesma.` },

  { arquivo:'reautenticacao.html', supabase:'Reauthentication',
    quando:'confirmação de alteração sensível — o portal não pede hoje',
    precisa:['{{ .Token }}'], proibido:['{{ .ConfirmationURL }}'],
    assunto:'Seu código de confirmação · Portal do Membro',
    previa:'Use o código para confirmar que é você.',
    abertura:'Para concluir uma alteração na sua conta do Portal do Membro, confirme que é você.',
    titulo:'Seu código de confirmação',
    texto:'Digite este código onde ele foi pedido:',
    acao:codigo,
    depois:`<div style="font:400 12px/1.6 ${F};color:${COR.nota};margin-top:14px">O código vale por 1 hora e só pode ser usado uma vez.</div>`,
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
