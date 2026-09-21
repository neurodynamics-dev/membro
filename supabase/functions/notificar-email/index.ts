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

/* O cliente SMTP entra por import dinâmico, dentro do handler, e não
   no topo do arquivo: assim este módulo continua sendo importável
   fora do Deno — que é como os testes leem as funções puras daqui. */
const CDN_SMTP = "https://deno.land/x/denomailer@1.6.0/mod.ts";

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

/* A porta decide COMO a conversa começa criptografada, e trocar as duas
   é o erro clássico: a conexão pendura até dar tempo limite, sem dizer o
   motivo.

     465  fala TLS desde o primeiro byte (SMTPS)  -> tls: true
     587  começa em texto claro e sobe com STARTTLS -> tls: false,
          que é o que faz o denomailer negociar a subida sozinho
     25   idem, mas quase todo provedor bloqueia

   O padrão é 465 porque é o que a Cloudflare exige — e ela não aceita
   STARTTLS na 587. SMTP_TLS existe para o caso raro de um servidor que
   não segue a convenção da porta. */
export function tlsImplicito(porta: number, modo: string): boolean {
  if (modo === "implicito") return true;
  if (modo === "starttls" || modo === "nao") return false;
  return porta === 465;
}

const PORTA = Number(env("SMTP_PORT") || "465");
const SMTP = {
  host: env("SMTP_HOST"),
  port: PORTA,
  user: env("SMTP_USER"),
  senha: env("SMTP_SENHA"),
  de: env("SMTP_DE") || env("SMTP_USER"),
  tls: tlsImplicito(PORTA, env("SMTP_TLS")),
};

const LOTE = Number(env("NOTIF_LOTE") || "200");

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

async function servir(): Promise<Response> {
  const cabecalho = { "Content-Type": "application/json; charset=utf-8" };

  if (!URL_BASE || !CHAVE_SERVICO) {
    return new Response(JSON.stringify({
      status: "sem_configuracao",
      detalhe: "Faltam SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY.",
    }), { status: 500, headers: cabecalho });
  }

  /* Sem SMTP a função não é um erro: ela não tem o que fazer. Dizer
     isso em voz alta é melhor do que queimar tentativa de envio de
     notificação que nunca teve como sair. */
  if (!SMTP.host || !SMTP.user || !SMTP.senha) {
    return new Response(JSON.stringify({
      status: "smtp_nao_configurado",
      detalhe: "Defina SMTP_HOST, SMTP_USER e SMTP_SENHA com `supabase secrets set`.",
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

  const { SMTPClient } = await import(CDN_SMTP);
  const cliente = new SMTPClient({
    connection: {
      hostname: SMTP.host,
      port: SMTP.port,
      tls: SMTP.tls,
      auth: { username: SMTP.user, password: SMTP.senha },
    },
  });

  const enviadas: number[] = [];
  const falhas: number[] = [];
  let ultimoErro = "";

  for (const d of destinos) {
    const ids = d.itens.map((i) => i.id);
    try {
      await cliente.send({
        from: SMTP.de,
        to: d.email,
        subject: assuntoDe(d),
        content: corpoTexto(d),
        html: corpoHTML(d),
      });
      enviadas.push(...ids);
    } catch (e) {
      /* Falha de uma pessoa não derruba o lote: o resto sai, e a
         baixa conta a tentativa para não repetir para sempre. */
      falhas.push(...ids);
      ultimoErro = String(e);
    }
  }

  try { await cliente.close(); } catch { /* fechar é higiene, não resultado */ }

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
  }), { headers: cabecalho });
}

const servidor = (globalThis as { Deno?: { serve(h: () => Promise<Response>): unknown } }).Deno;
servidor?.serve(async () => {
  try {
    return await servir();
  } catch (e) {
    return new Response(JSON.stringify({ status: "erro", detalhe: String(e) }),
      { status: 500, headers: { "Content-Type": "application/json; charset=utf-8" } });
  }
});
