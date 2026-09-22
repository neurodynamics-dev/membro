/* ============================================================
   notificar-email — o sininho que também chega por e-mail
   Portal do Membro · NeuroDynamics

   O sininho do portal só avisa quem está com a tela aberta. Quem
   entra uma vez por semana descobre a atividade atrasada na
   semana seguinte — e a culpa cai no quadro, não no canal.

   Esta função roda em intervalo, pergunta ao banco quem tem o que
   receber, manda UM e-mail por pessoa com tudo o que está
   pendente, e dá baixa. Agrupar é de propósito: cinco avisos na
   mesma hora viram um e-mail, não cinco.

   A regra de QUEM recebe O QUÊ não mora aqui — mora no banco, em
   notificacoes_email_lote(). Aqui só se monta e se envia.

   Chame com a service role (é ela que tem execute nas duas RPCs).
   Mantenha a verificação de JWT LIGADA: diferente do agenda-ics,
   aqui não há token na URL e ninguém de fora precisa chamar.
   ============================================================ */

const env = (nome: string): string =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get(nome) ?? "";

const URL_BASE      = env("SUPABASE_URL");
const CHAVE_SERVICO = env("SUPABASE_SERVICE_ROLE_KEY");

/* O endereço do portal nos links do e-mail. Sai daqui na
   renomeação para soma.neurodynamics.dev — e é só isto, porque o
   e-mail não tem nada de congelado como o UID do iCal. */
const PORTAL = env("PORTAL_URL") || "https://membro.neurodynamics.dev";
/* As imagens continuam sendo servidas por endereço absoluto: e-mail
   já enviado não se reescreve, então o caminho tem de seguir no ar. */
const IMG = env("MAILER_URL") || "https://membro.neurodynamics.dev/mailer";

/* POR QUE NÃO É MAIS SMTP.

   A versão anterior carregava um cliente SMTP de deno.land por import
   DINÂMICO, para o arquivo continuar importável fora do Deno (é assim
   que os testes leem as funções puras daqui). Só que o Supabase resolve
   as dependências na hora de PUBLICAR, lendo os imports estáticos — um
   import dinâmico com a URL numa variável não entra no pacote, e em
   produção vira "Module not found".

   Em vez de trocar por import estático e ficar refém de um registro de
   módulos, o envio passou a ser por HTTP puro: `fetch`, que já existe.
   Sem dependência nenhuma, o arquivo continua sendo um só — que é o que
   o editor do painel do Supabase pede — e continua testável fora do
   Deno. */

const PROVEDOR = (env("EMAIL_PROVEDOR") || "cloudflare").toLowerCase();

/* O token e o remetente são os MESMOS que já estavam configurados para
   o SMTP, de propósito: quem seguiu o README antes só precisa
   acrescentar o CF_ACCOUNT_ID. */
const CF_CONTA = env("CF_ACCOUNT_ID");
const CF_TOKEN = env("CF_API_TOKEN") || env("SMTP_SENHA");
const RESEND   = env("RESEND_API_KEY") || env("SMTP_SENHA");
/* SEM cair no SMTP_USER: no mundo do SMTP ele era o usuário da
   autenticação — na Cloudflare, a string literal "api_token" — e não um
   endereço. Usá-lo de último recurso fazia a função tentar enviar DE
   "api_token", e o provedor recusava tudo com "email.invalid": todas as
   mensagens falhavam de uma vez, porque o remetente é comum a todas. */
const DE       = env("EMAIL_DE") || env("SMTP_DE");
const DE_NOME  = env("EMAIL_DE_NOME") || "Portal do Membro";

export interface Envio {
  url: string;
  headers: Record<string, string>;
  corpo: unknown;
}

/* Não é validação de e-mail de verdade — é só para pegar o que
   claramente não é um endereço antes de gastar uma tentativa e receber
   de volta um código que não explica nada. */
export const pareceEndereco = (v: string): boolean =>
  /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$/.test((v || "").trim());

/** O que falta para conseguir enviar, em uma frase. Vazio = está pronto. */
export function faltaParaEnviar(
  provedor = PROVEDOR, conta = CF_CONTA, token = CF_TOKEN,
  resend = RESEND, de = DE,
): string {
  if (provedor === "cloudflare") {
    if (!conta) return "Falta o segredo CF_ACCOUNT_ID — o id da conta na Cloudflare.";
    if (!token) return "Falta o token da Cloudflare em CF_API_TOKEN (ou SMTP_SENHA).";
  } else if (provedor === "resend") {
    if (!resend) return "Falta o segredo RESEND_API_KEY.";
  } else {
    return `EMAIL_PROVEDOR="${provedor}" não é conhecido — use cloudflare ou resend.`;
  }
  if (!de) return "Falta o segredo EMAIL_DE com o endereço remetente.";
  if (!pareceEndereco(de)) {
    return `O remetente configurado não é um endereço de e-mail: "${de}". `
      + `Defina EMAIL_DE como portal@neurodynamics.dev (ou o endereço que `
      + `você cadastrou no Email Sending).`;
  }
  return "";
}

/** Monta o pedido HTTP do provedor. Pura, para dar para conferir sem rede. */
export function montarEnvio(
  provedor: string, de: string, deNome: string, para: string, paraNome: string,
  assunto: string, html: string, texto: string,
  conta = CF_CONTA, token = CF_TOKEN, chaveResend = RESEND,
): Envio {
  if (provedor === "resend") {
    return {
      url: "https://api.resend.com/emails",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveResend}` },
      corpo: { from: `${deNome} <${de}>`, to: [para], subject: assunto, html, text: texto },
    };
  }
  /* Cloudflare Email Sending. O REST usa "address" onde o binding dos
     Workers usa "email" — trocar os dois é o engano clássico aqui. */
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${conta}/email/sending/send`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    corpo: {
      from: { address: de, name: deNome },
      to: [paraNome ? { address: para, name: paraNome } : { address: para }],
      subject: assunto,
      html,
      text: texto,
    },
  };
}

/** Lê a resposta do provedor. "" quando saiu; senão, o motivo em texto. */
export function lerResposta(provedor: string, status: number, corpo: string): string {
  let j: Record<string, unknown> | null = null;
  try { j = JSON.parse(corpo); } catch { /* nem toda resposta é JSON */ }

  if (provedor === "cloudflare") {
    /* A Cloudflare responde 200 com success:false, então o código HTTP
       sozinho não diz se o e-mail saiu. */
    if (j && j.success === false) {
      const es = (j.errors as Array<{ message?: string; code?: number }> | undefined) || [];
      return es.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim()).filter(Boolean).join("; ")
        || `recusado pela Cloudflare (HTTP ${status})`;
    }
    if (status >= 200 && status < 300) return "";
    return `HTTP ${status}: ${corpo.slice(0, 300)}`;
  }

  if (status >= 200 && status < 300) return "";
  const m = (j as { message?: string } | null)?.message
    || (j as { error?: { message?: string } } | null)?.error?.message;
  return m ? `HTTP ${status}: ${m}` : `HTTP ${status}: ${corpo.slice(0, 300)}`;
}

/** Manda um e-mail. Devolve "" quando saiu, ou o motivo da recusa. */
async function enviarUm(para: string, paraNome: string, assunto: string,
                        html: string, texto: string): Promise<string> {
  if (!pareceEndereco(para)) {
    return `o endereço do destinatário não parece um e-mail: "${para}" `
      + `(confira a ficha dele no quadro)`;
  }
  const e = montarEnvio(PROVEDOR, DE, DE_NOME, para, paraNome, assunto, html, texto);
  const r = await fetch(e.url, {
    method: "POST",
    headers: e.headers,
    body: JSON.stringify(e.corpo),
  });
  /* o corpo é lido SEMPRE: é nele que vem o motivo da recusa, e sem ele
     o log fica com um número e nada mais */
  return lerResposta(PROVEDOR, r.status, await r.text());
}

const LOTE = Number(env("NOTIF_LOTE") || "200");

/* O botão de teste no portal chama esta função do NAVEGADOR, e aí o
   pedido é de outra origem: antes do POST o navegador manda um OPTIONS
   de sondagem, e só segue se a resposta autorizar.

   Faltando isso acontecem DUAS coisas, e a segunda é pior que a
   primeira: o navegador descarta a resposta (e o portal relata
   "função não publicada", olhando para o lugar errado), e o OPTIONS,
   por não ser tratado, executava a rotina inteira — mandava os
   e-mails de verdade para depois ter a resposta jogada fora.

   A agenda-sync já fazia isto certo; esta nasceu pensada só para o
   agendamento, onde não há navegador no meio. */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const CABECALHO = { ...CORS, "Content-Type": "application/json; charset=utf-8" };

export interface ItemNotificacao {
  id: number;
  tipo: string;
  titulo: string;
  corpo: string | null;
  href: string | null;
  criado_em: string;
}
export interface Destinatario {
  registro: number;
  nome: string;
  email: string;
  modo: "imediato" | "resumo";
  itens: ItemNotificacao[];
}

const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** O primeiro nome, que é como as pessoas se chamam por aqui. */
export const primeiroNome = (nome: string): string =>
  String(nome || "").trim().split(/\s+/)[0] || "você";

/** `#/atividades/card/ORT-14` -> endereço absoluto e clicável. */
export function linkDe(href: string | null): string {
  if (!href) return PORTAL;
  if (/^https?:\/\//i.test(href)) return href;
  return PORTAL + "/" + href.replace(/^\/+/, "");
}

/** O assunto: um aviso fala por si; vários viram contagem. */
export function assuntoDe(d: Destinatario): string {
  if (d.itens.length === 1) return d.itens[0].titulo;
  return `${d.itens.length} avisos no portal`;
}

/* O e-mail é claro, e não escuro como a tela: ele vai ser lido no
   Gmail, impresso, encaminhado. A mesma regra do Full mailer. */
export function corpoHTML(d: Destinatario): string {
  const linhas = d.itens.map((it) => `
      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e3e6e3;border-radius:10px">
          <tr><td style="padding:16px 18px">
            <div style="font:600 15px/1.45 Helvetica,Arial,sans-serif;color:#1d1d1f">
              ${esc(it.titulo)}</div>
            ${it.corpo ? `<div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;
              color:#4a514a;margin-top:6px">${esc(it.corpo)}</div>` : ""}
            <div style="margin-top:12px">
              <a href="${esc(linkDe(it.href))}"
                 style="font:600 13px/1 Helvetica,Arial,sans-serif;color:#00594F;
                        text-decoration:none">Abrir no portal &rarr;</a>
            </div>
          </td></tr>
        </table>
      </td></tr>`).join("");

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>${esc(assuntoDe(d))}</title></head>
<body style="margin:0;padding:0;background:#f4f6f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e3e6e3;border-radius:14px">
        <tr><td style="padding:28px 28px 8px">
          <img src="${esc(IMG)}/logo-00594f.png" width="188" alt="NeuroDynamics"
               style="display:block;border:0;outline:none">
        </td></tr>
        <tr><td style="padding:14px 28px 0">
          <div style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#1d1d1f">
            Olá, ${esc(primeiroNome(d.nome))}.</div>
          <div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a;margin-top:6px">
            ${d.itens.length === 1
              ? "Há um aviso esperando por você no portal."
              : `Há ${d.itens.length} avisos esperando por você no portal.`}
          </div>
        </td></tr>
        <tr><td style="padding:22px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>
        </td></tr>
        <tr><td style="padding:4px 28px 28px">
          <div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8a908a;
                      border-top:1px solid #e3e6e3;padding-top:16px">
            Você recebe este e-mail porque tem avisos no
            <a href="${esc(PORTAL)}" style="color:#00594F;text-decoration:none">portal</a>.
            Para receber um resumo por dia — ou não receber —, abra o sininho
            no topo do portal e clique em <b>Preferências de e-mail</b>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** A versão em texto, para quem lê e-mail sem HTML. */
export function corpoTexto(d: Destinatario): string {
  const linhas = d.itens.map((it) =>
    `- ${it.titulo}${it.corpo ? "\n  " + it.corpo : ""}\n  ${linkDe(it.href)}`).join("\n\n");
  return `Olá, ${primeiroNome(d.nome)}.\n\n` +
    (d.itens.length === 1
      ? "Há um aviso esperando por você no portal.\n\n"
      : `Há ${d.itens.length} avisos esperando por você no portal.\n\n`) +
    linhas + `\n\n—\nPortal do Membro · NeuroDynamics\n${PORTAL}\n`;
}

async function rpc(nome: string, corpo: unknown): Promise<unknown> {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`${nome}: ${r.status} ${await r.text()}`);
  return await r.json();
}

export async function servir(req: Request): Promise<Response> {
  /* a sondagem do navegador responde e para por aqui: ela não é o
     pedido de verdade, e executá-la mandaria e-mail à toa */
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ status: "metodo_nao_aceito" }),
      { status: 405, headers: CABECALHO });
  }

  const cabecalho = CABECALHO;

  if (!URL_BASE || !CHAVE_SERVICO) {
    return new Response(JSON.stringify({
      status: "sem_configuracao",
      detalhe: "Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.",
    }), { status: 500, headers: cabecalho });
  }

  /* Sem provedor configurado a função não é um erro: ela não tem o que
     fazer. Dizer isso em voz alta, com o nome do segredo que falta, é
     melhor do que queimar a tentativa de um aviso que nunca teve como
     sair. O status continua sendo "smtp_nao_configurado" porque é o que
     o portal já sabe ler e explicar. */
  const falta = faltaParaEnviar();
  if (falta) {
    return new Response(JSON.stringify({
      status: "smtp_nao_configurado", detalhe: falta,
    }), { status: 200, headers: cabecalho });
  }

  let destinos: Destinatario[];
  try {
    destinos = (await rpc("notificacoes_email_lote", { p_limite: LOTE })) as Destinatario[];
  } catch (e) {
    return new Response(JSON.stringify({ status: "erro_no_lote", detalhe: String(e) }),
      { status: 500, headers: cabecalho });
  }

  if (!destinos?.length) {
    return new Response(JSON.stringify({ status: "ok", pessoas: 0, enviadas: 0 }),
      { headers: cabecalho });
  }

  const enviadas: number[] = [];
  const falhas: number[] = [];
  let ultimoErro = "";

  for (const d of destinos) {
    const ids = d.itens.map((i) => i.id);
    try {
      const motivo = await enviarUm(
        d.email, d.nome, assuntoDe(d), corpoHTML(d), corpoTexto(d));
      if (motivo) { falhas.push(...ids); ultimoErro = motivo; }
      else        { enviadas.push(...ids); }
    } catch (e) {
      /* Falha de uma pessoa não derruba o lote: o resto sai, e a baixa
         conta a tentativa para não repetir para sempre. */
      falhas.push(...ids);
      ultimoErro = String(e);
    }
  }

  try {
    await rpc("notificacoes_email_baixa", { p: { enviadas, falhas, erro: ultimoErro } });
  } catch (e) {
    return new Response(JSON.stringify({
      status: "enviou_mas_nao_deu_baixa", enviadas: enviadas.length, detalhe: String(e),
    }), { status: 500, headers: cabecalho });
  }

  return new Response(JSON.stringify({
    status: "ok", pessoas: destinos.length,
    enviadas: enviadas.length, falhas: falhas.length,
    /* o motivo da recusa vai junto: sem ele, "0 enviadas" não diz nada
       a quem está configurando, e o provedor já explicou o porquê */
    /* o remetente vai junto porque, quando TODAS falham, ele é o
       suspeito — é o único dado comum a todas as tentativas */
    ...(ultimoErro ? { detalhe: ultimoErro, provedor: PROVEDOR, de: DE } : {}),
  }), { headers: cabecalho });
}

const servidor = (globalThis as {
  Deno?: { serve(h: (r: Request) => Promise<Response>): unknown };
}).Deno;
servidor?.serve(async (req: Request) => {
  try {
    return await servir(req);
  } catch (e) {
    /* o CORS entra até no erro: sem ele o navegador esconde a mensagem
       e quem está configurando fica sem saber o que aconteceu */
    return new Response(JSON.stringify({ status: "erro", detalhe: String(e) }),
      { status: 500, headers: CABECALHO });
  }
});
