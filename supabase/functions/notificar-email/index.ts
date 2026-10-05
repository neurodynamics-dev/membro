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

   Desde a 25.0 a função entrega também as DECLARAÇÕES DE PARTICIPAÇÃO
   (a fila doc_envios): um evento aprovado emite uma declaração por
   participante, e cada uma sai num e-mail só dela — inclusive para o
   externo, que não tem conta no portal. Ver enviarDocumentos().

   Desde a 28.0, também a fila da AGENDA (agenda_envios): convite,
   alteração, cancelamento e lembrete de cada evento, com os botões
   que respondem pelo e-mail. Ver enviarAgenda().

   Desde a 32.0, a função confere sozinha quem a chama (quemChama): a
   senha do agendamento do banco, a service role ou um JWT que o próprio
   PostgREST aceite. Por isso a verificação de JWT do painel fica
   DESLIGADA — é ela que barrava o agendamento, que não tem JWT, e
   deixava a fila parada até alguém apertar o teste do portal. A mesma
   passada empurra os avisos do sino para os aparelhos inscritos (Web
   Push) e é uma só por vez (fila_passada_inicio).

   Desde a 2.18.0, a preferência é por CATEGORIA de aviso (atividades,
   bugs e melhorias, documentos, Studio, reporte, agenda, pessoal,
   treinamentos, sistema): o push liga ou desliga, e o e-mail é nunca,
   instantâneo, resumo diário (8h) ou resumo semanal (segunda, 8h). O
   banco decide (notificacoes_email_lote e push_lote) e devolve cada
   pessoa em até três envelopes, um por modo; aqui o resumo sai agrupado
   por categoria. Convites de evento e pílulas não passam por aqui: as
   filas próprias (enviarAgenda, enviarProgramados) saem sempre na hora.
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
/* Para onde vai a resposta de quem apertar "Responder". O remetente
   mora no subdomínio de ENVIO, que normalmente não recebe nada — sem
   isto, responder um aviso do portal cai no vazio. */
const RESPONDER = env("EMAIL_RESPONDER_PARA");
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
      + `Defina o segredo EMAIL_DE com o endereço que você cadastrou no `
      + `Email Sending da Cloudflare — escrito igual, por extenso.`;
  }
  return "";
}

/** Monta o pedido HTTP do provedor. Pura, para dar para conferir sem rede. */
/** O nome de exibição no cabeçalho From. Com ponto, vírgula ou outro
    caractere especial (o "Depto. de Pessoal" da 30.0), vai entre aspas,
    como pede a RFC 5322; sem eles, como está. */
export function nomeExibicao(nome: string): string {
  const n = String(nome || "").replace(/["\\\r\n]/g, "").trim();
  return /[()<>\[\]:;@,.]/.test(n) ? `"${n}"` : n;
}

export function montarEnvio(
  provedor: string, de: string, deNome: string, para: string, paraNome: string,
  assunto: string, html: string, texto: string,
  conta = CF_CONTA, token = CF_TOKEN, chaveResend = RESEND, responder = RESPONDER,
): Envio {
  if (provedor === "resend") {
    return {
      url: "https://api.resend.com/emails",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${chaveResend}` },
      corpo: {
        from: `${nomeExibicao(deNome)} <${de}>`, to: [para], subject: assunto, html, text: texto,
        ...(responder ? { reply_to: responder } : {}),
      },
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
      ...(responder ? { reply_to: { address: responder } } : {}),
    },
  };
}

/** Lê a resposta do provedor. "" quando saiu; senão, o motivo em texto. */
/* O 10202 da Cloudflare diz "email.invalid" e nada mais — não diz QUAL
   endereço nem POR QUÊ. A causa quase sempre é uma só: o remetente não
   está num domínio habilitado para envio. E o domínio habilitado nem
   sempre é o que se imagina: a Cloudflare habilita por SUBDOMÍNIO, e o
   jeito de descobrir qual é olhar o registro `cf-bounce.<domínio>` que
   ela criou no DNS. Custou uma rodada descobrir isso; fica escrito. */
const DICA_10202 =
  " — quase sempre quer dizer que o remetente não está num domínio"
  + " habilitado no Email Sending. A Cloudflare habilita por SUBDOMÍNIO:"
  + " veja no DNS qual é o registro cf-bounce.<algo>, porque esse <algo>"
  + " é o único domínio de onde dá para enviar";

export function lerResposta(provedor: string, status: number, corpo: string): string {
  let j: Record<string, unknown> | null = null;
  try { j = JSON.parse(corpo); } catch { /* nem toda resposta é JSON */ }

  if (provedor === "cloudflare") {
    /* A Cloudflare responde 200 com success:false, então o código HTTP
       sozinho não diz se o e-mail saiu. */
    if (j && j.success === false) {
      const es = (j.errors as Array<{ message?: string; code?: number }> | undefined) || [];
      const texto = es.map((e) => `${e.code ?? ""} ${e.message ?? ""}`.trim())
        .filter(Boolean).join("; ") || `recusado pela Cloudflare (HTTP ${status})`;
      return texto + (/10202|email\.invalid/i.test(texto) ? DICA_10202 : "");
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
                        html: string, texto: string, deNome = DE_NOME): Promise<string> {
  if (!pareceEndereco(para)) {
    return `o endereço do destinatário não parece um e-mail: "${para}" `
      + `(confira a ficha dele no quadro)`;
  }
  const e = montarEnvio(PROVEDOR, DE, deNome || DE_NOME, para, paraNome, assunto, html, texto);
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
  /** a categoria da preferência (2.18.0): atividades, documentos… */
  categoria?: string;
  titulo: string;
  corpo: string | null;
  href: string | null;
  criado_em: string;
}
/* O modo do envelope (2.18.0): o lote devolve até três por pessoa, o
   instantâneo e os resumos devidos. "imediato" e "resumo" são os nomes
   da 16.0, que o banco antigo ainda manda. */
export interface Destinatario {
  registro: number;
  nome: string;
  email: string;
  modo: "instantaneo" | "diario" | "semanal" | "imediato" | "resumo";
  itens: ItemNotificacao[];
}

/* As categorias, na ordem da tela de preferências (notificacao_categorias(),
   no banco). O que vier sem categoria cai em Sistema. */
export const CATEGORIAS: Array<[string, string]> = [
  ["atividades", "Atividades"], ["bugs_melhorias", "Bugs e melhorias"], ["documentos", "Documentos"],
  ["studio", "Studio"], ["reporte", "Reporte"], ["agenda", "Agenda"], ["pessoal", "Pessoal"],
  ["treinamentos", "Treinamentos"], ["sistema", "Sistema"],
];

/** É um resumo (diário ou semanal), e não o envio na hora? */
export const ehResumo = (d: Destinatario): boolean => d.modo === "diario" || d.modo === "semanal";

/** Os itens agrupados por categoria, na ordem da tela; grupo vazio não aparece. */
export function porCategoria(itens: ItemNotificacao[]): Array<{ chave: string; nome: string; itens: ItemNotificacao[] }> {
  const conhecida = new Set(CATEGORIAS.map(([k]) => k));
  return CATEGORIAS
    .map(([chave, nome]) => ({
      chave, nome,
      itens: itens.filter((i) => (conhecida.has(i.categoria || "") ? i.categoria : "sistema") === chave),
    }))
    .filter((g) => g.itens.length > 0);
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

const contagem = (n: number): string => n === 1 ? "1 aviso" : `${n} avisos`;

/** O assunto: um aviso fala por si; vários viram contagem; o resumo diz qual é. */
export function assuntoDe(d: Destinatario): string {
  if (d.modo === "diario")  return `Resumo diário do SOMA (${contagem(d.itens.length)})`;
  if (d.modo === "semanal") return `Resumo semanal do SOMA (${contagem(d.itens.length)})`;
  if (d.itens.length === 1) return d.itens[0].titulo;
  return `${d.itens.length} avisos no portal`;
}

/** A frase de abertura, abaixo da saudação. */
export function aberturaDe(d: Destinatario): string {
  const n = d.itens.length;
  if (d.modo === "diario")  return n === 1 ? "O aviso do último dia no portal." : `Os ${n} avisos do último dia no portal.`;
  if (d.modo === "semanal") return n === 1 ? "O aviso da última semana no portal." : `Os ${n} avisos da última semana no portal.`;
  return n === 1 ? "Há um aviso esperando por você no portal." : `Há ${n} avisos esperando por você no portal.`;
}

const RODAPE_PREF = "Para escolher o que chega por e-mail, e com que frequência, abra o sino no topo do portal e clique em";

/* O e-mail é claro, e não escuro como a tela: ele vai ser lido no
   Gmail, impresso, encaminhado. A mesma regra do Full mailer.
   O resumo (diário ou semanal) agrupa os avisos por categoria, cada
   grupo com o seu título; o envio na hora vai sem grupo. */
export function corpoHTML(d: Destinatario): string {
  const cartao = (it: ItemNotificacao) => `
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
      </td></tr>`;
  const titulo = (nome: string, n: number) => `
      <tr><td style="padding:4px 0 10px;font:600 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.12em;
                     text-transform:uppercase;color:#00594F">${esc(nome)} (${n})</td></tr>`;
  const linhas = ehResumo(d)
    ? porCategoria(d.itens).map((g) => titulo(g.nome, g.itens.length) + g.itens.map(cartao).join("")).join("")
    : d.itens.map(cartao).join("");

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
            ${esc(aberturaDe(d))}
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
            ${RODAPE_PREF} <b>Preferências de avisos</b>.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** A versão em texto, para quem lê e-mail sem HTML. */
export function corpoTexto(d: Destinatario): string {
  const item = (it: ItemNotificacao) =>
    `- ${it.titulo}${it.corpo ? "\n  " + it.corpo : ""}\n  ${linkDe(it.href)}`;
  const linhas = ehResumo(d)
    ? porCategoria(d.itens).map((g) => `${g.nome.toUpperCase()} (${g.itens.length})\n\n` + g.itens.map(item).join("\n\n")).join("\n\n")
    : d.itens.map(item).join("\n\n");
  return `Olá, ${primeiroNome(d.nome)}.\n\n${aberturaDe(d)}\n\n` + linhas +
    `\n\n${RODAPE_PREF} Preferências de avisos.\n\nPortal do Membro, NeuroDynamics\n${PORTAL}\n`;
}

/* ============================================================
   AS DECLARAÇÕES (SOMA 25.0)
   Um e-mail por documento, não um resumo: é a entrega de uma
   declaração, e sai qualquer que seja a preferência de e-mail da
   pessoa. O endereço o banco já resolveu (o do externo vem do registro
   do evento; o do membro, da ficha). O link leva à validação pública,
   que mostra o documento e baixa a segunda via — o externo não tem
   conta no portal, e o membro tem, e ganha também o link de lá.
   ============================================================ */
export interface EnvioDocumento {
  id: number;
  tipo: string;
  para_nome: string;
  para_email: string;
  assunto: string;
  dados: {
    evento?: string; evento_codigo?: string; data_inicio?: string; data_fim?: string | null;
    local?: string | null; modalidade?: string; horas?: number | string; papel?: string | null;
    membro?: boolean; documento?: string; codigo?: string; url?: string; href?: string;
  };
}

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro"];
const partesData = (iso?: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ""));
  return m ? { a: +m[1], m: +m[2], d: +m[3] } : null;
};
/** "24 de setembro de 2026" */
export function dataExtensa(iso?: string | null): string {
  const p = partesData(iso);
  return p ? `${p.d} de ${MESES[p.m - 1]} de ${p.a}` : "";
}
/** "em 24 de setembro de 2026", "de 5 a 7 de setembro de 2026", "de 30 de setembro a 2 de outubro de 2026" */
export function periodoTexto(ini?: string | null, fim?: string | null): string {
  const a = partesData(ini), b = partesData(fim);
  if (!a) return "";
  if (!b || (a.a === b.a && a.m === b.m && a.d === b.d)) return `em ${dataExtensa(ini)}`;
  if (a.a === b.a && a.m === b.m) return `de ${a.d} a ${b.d} de ${MESES[a.m - 1]} de ${a.a}`;
  if (a.a === b.a) return `de ${a.d} de ${MESES[a.m - 1]} a ${b.d} de ${MESES[b.m - 1]} de ${a.a}`;
  return `de ${dataExtensa(ini)} a ${dataExtensa(fim)}`;
}
/** "8 horas", "1 hora", "2 horas e 30 minutos" */
export function horasTexto(n?: number | string | null): string {
  const t = Math.round(Number(n || 0) * 60), h = Math.floor(t / 60), m = t % 60;
  const hs = h ? `${h} ${h === 1 ? "hora" : "horas"}` : "";
  const ms = m ? `${m} ${m === 1 ? "minuto" : "minutos"}` : "";
  return [hs, ms].filter(Boolean).join(" e ") || "0 hora";
}
const ondeTexto = (d: EnvioDocumento["dados"]): string =>
  d.modalidade === "online" ? "online" : d.local ? `em ${d.local}${d.modalidade === "hibrido" ? " (híbrido)" : ""}` : "";
const hostDe = (url?: string) => String(url || "https://auth.neurodynamics.dev").replace(/^https?:\/\//i, "").replace(/[/?#].*$/, "");

export function declaracaoHTML(e: EnvioDocumento): string {
  const d = e.dados || {};
  const onde = ondeTexto(d);
  const linha = (rot: string, val: string) => val ? `<tr>
      <td style="padding:7px 12px;border-top:1px solid #d6d6da;font:700 11px/1.4 Helvetica,Arial,sans-serif;
                 letter-spacing:.05em;text-transform:uppercase;color:#5e5e63;width:40%">${rot}</td>
      <td style="padding:7px 12px;border-top:1px solid #d6d6da;font:400 14px/1.45 Helvetica,Arial,sans-serif;color:#1d1d1f">${val}</td></tr>` : "";
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>${esc(e.assunto)}</title></head>
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
          <div style="font:400 15px/1.6 Helvetica,Arial,sans-serif;color:#1d1d1f">Olá, ${esc(primeiroNome(e.para_nome))}.</div>
          <div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a;margin-top:6px">
            A NeuroDynamics PD&amp;I emitiu a sua <b style="color:#1d1d1f">declaração de participação</b> no evento
            <b style="color:#1d1d1f">${esc(d.evento || "")}</b>${d.data_inicio ? ", " + esc(periodoTexto(d.data_inicio, d.data_fim)) : ""}${onde ? ", " + esc(onde) : ""}.
          </div>
        </td></tr>
        <tr><td style="padding:20px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #b9b9be;border-top:0">
            <tr><td colspan="2" style="padding:8px 12px;background:#d9d9d9;border-top:1px solid #b9b9be;
                font:700 11px/1.4 Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#1d1d1f">
              Declaração de participação</td></tr>
            ${linha("Documento", esc(d.documento || ""))}
            ${linha("Código verificador", `<span style="font-family:'Courier New',monospace;font-weight:700;letter-spacing:.06em">${esc(d.codigo || "")}</span>`)}
            ${linha("Função", esc(d.papel || "Participante"))}
            ${linha("Horas dedicadas", esc(horasTexto(d.horas)))}
          </table>
        </td></tr>
        <tr><td style="padding:22px 28px 0">
          <a href="${esc(d.url || "")}" style="display:inline-block;background:#00594F;color:#ffffff;
             font:600 14px/1 Helvetica,Arial,sans-serif;text-decoration:none;padding:13px 20px;border-radius:9px">
            Ver e baixar a declaração</a>
          ${d.membro && d.href ? `<div style="font:400 13px/1.6 Helvetica,Arial,sans-serif;color:#4a514a;margin-top:12px">
            Ela também fica no portal, em <a href="${esc(linkDe(d.href))}" style="color:#00594F;text-decoration:none">Serviços ›
            Eventos e participações</a>.</div>` : ""}
        </td></tr>
        <tr><td style="padding:22px 28px 28px">
          <div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8a908a;border-top:1px solid #e3e6e3;padding-top:16px">
            A declaração dispensa assinatura. Quem a receber confere a autenticidade em
            <a href="${esc(d.url || "")}" style="color:#00594F;text-decoration:none">${esc(hostDe(d.url))}</a>,
            pelo código verificador — ou pela leitura do QR Code impresso no documento.
            Você recebe este e-mail porque participou do evento${d.membro ? "" : " junto à equipe"} da NeuroDynamics PD&amp;I.
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function declaracaoTexto(e: EnvioDocumento): string {
  const d = e.dados || {};
  const onde = ondeTexto(d);
  return `Olá, ${primeiroNome(e.para_nome)}.\n\n`
    + `A NeuroDynamics PD&I emitiu a sua declaração de participação no evento ${d.evento || ""}`
    + `${d.data_inicio ? ", " + periodoTexto(d.data_inicio, d.data_fim) : ""}${onde ? ", " + onde : ""}.\n\n`
    + `Documento: ${d.documento || ""}\nCódigo verificador: ${d.codigo || ""}\n`
    + `Função: ${d.papel || "Participante"}\nHoras dedicadas: ${horasTexto(d.horas)}\n\n`
    + `Ver e baixar a declaração: ${d.url || ""}\n`
    + (d.membro && d.href ? `No portal: ${linkDe(d.href)}\n` : "")
    + `\nA declaração dispensa assinatura: a autenticidade se confere em ${hostDe(d.url)}, pelo código verificador.\n`
    + `\n—\nNeuroDynamics PD&I\n`;
}

/* ============================================================
   A AGENDA (SOMA 28.0)
   Convite, alteração, cancelamento e lembrete de um evento — um
   e-mail por pessoa e por evento, qualquer que seja a preferência do
   sino (cada um desliga os e-mails da agenda em Agenda ›
   Configurações; o banco já tirou da fila quem desligou). Os botões
   Vou / Talvez / Não vou levam a rsvp.html com o token do convite de
   quem recebeu: responde sem login.
   ============================================================ */
export interface EnvioAgenda {
  id: number;
  tipo: "convite" | "alteracao" | "cancelamento" | "lembrete";
  para_nome: string | null;
  para_email: string;
  token: string | null;
  resposta: string | null;
  membro: boolean;
  assunto: string;
  dados: {
    evento_id?: string; numero?: number; titulo?: string; data?: string; data_fim?: string | null;
    hora_inicio?: string | null; hora_fim?: string | null; quando?: string; local?: string | null;
    meet_url?: string | null; descricao?: string | null; recorrencia?: string; organizador?: string | null;
    href?: string; mudou?: string | null; minutos?: number;
  };
}

const RESPOSTAS: Record<string, string> = { vou: "Vou", talvez: "Talvez", nao: "Não vou" };

/** O link que responde pelo e-mail. */
export function linkResposta(token: string | null | undefined, r: string): string {
  return `${PORTAL}/rsvp.html?t=${encodeURIComponent(String(token || ""))}&r=${r}`;
}

/** "30 minutos", "1 hora", "1 dia", "2 dias e 3 horas" */
export function antecedenciaTexto(min?: number | null): string {
  const t = Math.max(0, Math.round(Number(min || 0)));
  if (t === 0) return "agora";
  const d = Math.floor(t / 1440), h = Math.floor((t % 1440) / 60), m = t % 60;
  const p = (n: number, s: string, pl: string) => n ? `${n} ${n === 1 ? s : pl}` : "";
  return [p(d, "dia", "dias"), p(h, "hora", "horas"), p(m, "minuto", "minutos")].filter(Boolean).join(" e ");
}

/** O evento no Google Agenda, pelo formulário de criação dele. */
export function linkGoogle(d: EnvioAgenda["dados"]): string {
  const dia = (iso?: string | null) => String(iso || "").replace(/-/g, "");
  const p = new URLSearchParams({ action: "TEMPLATE", text: d.titulo || "Evento" });
  if (!d.hora_inicio) {
    const fim = new Date(`${d.data_fim || d.data}T12:00:00Z`); fim.setUTCDate(fim.getUTCDate() + 1);
    p.set("dates", `${dia(d.data)}/${fim.toISOString().slice(0, 10).replace(/-/g, "")}`);
  } else {
    const hm = (h?: string | null) => String(h || "").replace(":", "") + "00";
    p.set("dates", `${dia(d.data)}T${hm(d.hora_inicio)}/${dia(d.data_fim || d.data)}T${hm(d.hora_fim || d.hora_inicio)}`);
    p.set("ctz", "America/Sao_Paulo");
  }
  if (d.local) p.set("location", d.local);
  const det = [d.descricao, d.meet_url].filter(Boolean).join("\n\n");
  if (det) p.set("details", det);
  return "https://calendar.google.com/calendar/render?" + p.toString();
}

/** A frase de abertura, por tipo. */
export function agendaFrase(e: EnvioAgenda): string {
  const d = e.dados || {}, org = d.organizador ? `${d.organizador} ` : "";
  if (e.tipo === "convite") return `${org || "A equipe "}convidou você para este evento.`;
  if (e.tipo === "alteracao") return `Este evento mudou${d.mudou ? ` (${d.mudou})` : ""}.`;
  if (e.tipo === "cancelamento") return `Este evento foi cancelado${d.mudou ? ` (${d.mudou})` : ""}.`;
  return `Começa em ${antecedenciaTexto(d.minutos)}.`;
}

export function agendaHTML(e: EnvioAgenda): string {
  const d = e.dados || {};
  const cancelado = e.tipo === "cancelamento";
  const linha = (rot: string, val: string) => val ? `<tr>
      <td style="padding:6px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;color:#8a908a;width:92px;vertical-align:top">${rot}</td>
      <td style="padding:6px 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#1d1d1f">${val}</td></tr>` : "";
  const botao = (r: string) => {
    const on = e.resposta === r;
    return `<a href="${esc(linkResposta(e.token, r))}" style="display:inline-block;margin:0 6px 6px 0;
      padding:11px 18px;border-radius:9px;font:600 14px/1 Helvetica,Arial,sans-serif;text-decoration:none;
      ${on ? "background:#00594F;color:#ffffff;border:1px solid #00594F" : "background:#ffffff;color:#00594F;border:1px solid #b9c7c2"}">
      ${RESPOSTAS[r]}</a>`;
  };
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>${esc(e.assunto)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border:1px solid #e3e6e3;border-radius:14px">
        <tr><td style="padding:28px 28px 8px">
          <img src="${esc(IMG)}/logo-00594f.png" width="188" alt="NeuroDynamics" style="display:block;border:0;outline:none">
        </td></tr>
        <tr><td style="padding:14px 28px 0">
          <div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a">Olá, ${esc(primeiroNome(e.para_nome || ""))}. ${esc(agendaFrase(e))}</div>
          <div style="font:700 21px/1.3 Helvetica,Arial,sans-serif;color:#1d1d1f;margin-top:10px;
            ${cancelado ? "text-decoration:line-through;color:#8a908a" : ""}">${esc(d.titulo || "")}</div>
        </td></tr>
        <tr><td style="padding:12px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${linha("Quando", esc(d.quando || ""))}
            ${linha("Repete", d.recorrencia && d.recorrencia !== "Única" ? esc(d.recorrencia) : "")}
            ${linha("Onde", esc(d.local || ""))}
            ${linha("Chamada", d.meet_url ? `<a href="${esc(d.meet_url)}" style="color:#00594F">${esc(d.meet_url)}</a>` : "")}
            ${linha("Organiza", esc(d.organizador || ""))}
          </table>
          ${d.descricao && !cancelado ? `<div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a;
            margin-top:10px;white-space:pre-wrap;border-top:1px solid #e3e6e3;padding-top:12px">${esc(d.descricao)}</div>` : ""}
        </td></tr>
        ${cancelado || !e.token ? "" : `<tr><td style="padding:20px 28px 0">
          <div style="font:600 12px/1.5 Helvetica,Arial,sans-serif;color:#8a908a;margin-bottom:8px">Você vai?</div>
          ${botao("vou")}${botao("talvez")}${botao("nao")}
        </td></tr>`}
        <tr><td style="padding:14px 28px 0;font:400 13px/1.6 Helvetica,Arial,sans-serif">
          ${cancelado ? "" : `<a href="${esc(linkGoogle(d))}" style="color:#00594F;text-decoration:none">Adicionar ao Google Agenda</a>`}
          ${e.membro && d.href && !cancelado ? ` &nbsp;·&nbsp; <a href="${esc(linkDe(d.href))}" style="color:#00594F;text-decoration:none">Abrir no portal</a>` : ""}
        </td></tr>
        <tr><td style="padding:18px 28px 28px">
          <div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8a908a;border-top:1px solid #e3e6e3;padding-top:14px">
            Agenda da NeuroDynamics.${e.membro ? " Os e-mails da agenda se desligam em Agenda › Configurações." : ""}
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

export function agendaTexto(e: EnvioAgenda): string {
  const d = e.dados || {};
  const cancelado = e.tipo === "cancelamento";
  return `Olá, ${primeiroNome(e.para_nome || "")}. ${agendaFrase(e)}\n\n`
    + `${d.titulo || ""}\n`
    + `Quando: ${d.quando || ""}\n`
    + (d.recorrencia && d.recorrencia !== "Única" ? `Repete: ${d.recorrencia}\n` : "")
    + (d.local ? `Onde: ${d.local}\n` : "")
    + (d.meet_url ? `Chamada: ${d.meet_url}\n` : "")
    + (d.organizador ? `Organiza: ${d.organizador}\n` : "")
    + (d.descricao && !cancelado ? `\n${d.descricao}\n` : "")
    + (cancelado || !e.token ? "" : `\nVou: ${linkResposta(e.token, "vou")}\nTalvez: ${linkResposta(e.token, "talvez")}\nNão vou: ${linkResposta(e.token, "nao")}\n`)
    + (e.membro && d.href && !cancelado ? `\nNo portal: ${linkDe(d.href)}\n` : "")
    + `\n—\nAgenda da NeuroDynamics\n`;
}

/** Manda a fila da agenda e dá baixa. Sem a 28.0, diz isso e segue. */
async function enviarAgenda(): Promise<Record<string, unknown>> {
  let lote: EnvioAgenda[];
  try {
    lote = (await rpc("agenda_envios_lote", { p_limite: LOTE })) as EnvioAgenda[];
  } catch (e) {
    return /PGRST202|404|agenda_envios_lote/.test(String(e))
      ? { agenda: "sem_migracao_28" } : { agenda: "erro", agenda_detalhe: String(e) };
  }
  if (!lote?.length) return { agenda: 0 };
  const enviados: number[] = [], falhas: number[] = [];
  let erro = "";
  for (const e of lote) {
    try {
      const m = await enviarUm(e.para_email, e.para_nome || "", e.assunto, agendaHTML(e), agendaTexto(e));
      if (m) { falhas.push(e.id); erro = m; } else { enviados.push(e.id); }
    } catch (x) { falhas.push(e.id); erro = String(x); }
  }
  try {
    await rpc("agenda_envios_baixa", { p: { enviados, falhas, erro } });
  } catch (x) {
    return { agenda: enviados.length, agenda_falhas: falhas.length, agenda_detalhe: "enviou, mas não deu baixa: " + String(x) };
  }
  return { agenda: enviados.length, agenda_falhas: falhas.length, ...(erro ? { agenda_detalhe: erro } : {}) };
}

/** Manda as declarações da fila e dá baixa. Sem a 25.0, diz isso e segue. */
async function enviarDocumentos(): Promise<Record<string, unknown>> {
  let lote: EnvioDocumento[];
  try {
    lote = (await rpc("doc_envios_lote", { p_limite: LOTE })) as EnvioDocumento[];
  } catch (e) {
    return /PGRST202|404|doc_envios_lote/.test(String(e))
      ? { documentos: "sem_migracao_25" } : { documentos: "erro", documentos_detalhe: String(e) };
  }
  if (!lote?.length) return { documentos: 0 };
  const enviados: number[] = [], falhas: number[] = [];
  let erro = "";
  for (const e of lote) {
    try {
      const m = await enviarUm(e.para_email, e.para_nome, e.assunto, declaracaoHTML(e), declaracaoTexto(e));
      if (m) { falhas.push(e.id); erro = m; } else { enviados.push(e.id); }
    } catch (x) { falhas.push(e.id); erro = String(x); }
  }
  try {
    await rpc("doc_envios_baixa", { p: { enviados, falhas, erro } });
  } catch (x) {
    return { documentos: enviados.length, documentos_falhas: falhas.length,
             documentos_detalhe: "enviou, mas não deu baixa: " + String(x) };
  }
  return { documentos: enviados.length, documentos_falhas: falhas.length, ...(erro ? { documentos_detalhe: erro } : {}) };
}

/* ------------------------------------------------------------
   AS ENTREVISTAS DO PROCESSO SELETIVO (31.0)
   Ao candidato: a reserva (com o link da chamada), o reagendamento
   feito pela equipe, a troca do link e o cancelamento do horário. Ao
   responsável pelos horários: o resumo da véspera, com o perfil de
   cada candidato e os links. A fila é ps_envios.
   ------------------------------------------------------------ */
const SITE_PS = env("PS_SITE_URL") || "https://selecao.neurodynamics.dev";
const DE_PS = "Processo Seletivo | NeuroDynamics";

export interface HorarioPS {
  data?: string; hora_inicio?: string; hora_fim?: string; link?: string | null; local?: string | null;
}
export interface ItemResumoPS {
  hora_inicio: string; hora_fim: string; link?: string | null; href?: string;
  candidato: {
    id?: string; nome: string; protocolo?: string; email?: string; telefone?: string | null;
    curso?: string | null; instituicao?: string | null; periodo?: string | null; cidade?: string | null;
    areas?: string[] | null; motivacao?: string | null; background?: string | null; disponibilidade?: string | null;
    lattes?: string | null; github?: string | null; linkedin?: string | null; portfolio?: string | null;
  };
  dinamica?: { nota?: number | null; avaliacoes?: number; aprovar?: number; reprovar?: number; em_duvida?: number } | null;
}
export interface EnvioPS {
  id: number;
  tipo: "confirmacao" | "reagendamento" | "link" | "cancelamento" | "resumo";
  para_nome: string | null;
  para_email: string;
  assunto: string;
  dados: HorarioPS & {
    responsavel?: string | null; protocolo?: string; email?: string; motivo?: string | null; por?: string | null;
    antes?: HorarioPS | null; dia?: string; itens?: ItemResumoPS[]; atualizacao?: boolean;
  };
}

const DIAS_SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
/** "terça-feira, 14 de outubro" */
export function diaExtenso(iso?: string | null): string {
  const p = partesData(iso);
  if (!p) return "";
  return `${DIAS_SEMANA[new Date(Date.UTC(p.a, p.m - 1, p.d)).getUTCDay()]}, ${p.d} de ${MESES[p.m - 1]}`;
}
/** "terça-feira, 14 de outubro, das 14:00 às 14:30" */
export function quandoPS(h?: HorarioPS | null): string {
  if (!h?.data) return "";
  return `${diaExtenso(h.data)}, das ${h.hora_inicio || ""} às ${h.hora_fim || ""}`;
}
/** a página de acompanhamento, já com a inscrição preenchida */
export function linkAcompanhar(d: EnvioPS["dados"]): string {
  const q = new URLSearchParams();
  if (d.protocolo) q.set("protocolo", d.protocolo);
  if (d.email) q.set("email", d.email);
  return `${SITE_PS}/#/acompanhar${q.toString() ? "?" + q.toString() : ""}`;
}
/** a abertura, por tipo */
export function fraseCandidato(e: EnvioPS): string {
  const d = e.dados || {};
  if (e.tipo === "confirmacao") return "Sua entrevista individual no processo seletivo da NeuroDynamics está confirmada.";
  if (e.tipo === "reagendamento") return "A equipe precisou reagendar a sua entrevista. O novo horário está abaixo.";
  if (e.tipo === "link") return d.antes?.link ? "O link da chamada da sua entrevista mudou. O horário continua o mesmo."
    : "Sua entrevista será online. Este é o link da chamada; o horário continua o mesmo.";
  return "A equipe precisou cancelar o horário da sua entrevista. Escolha um novo horário na página de acompanhamento.";
}

const linhaPS = (rot: string, val: string) => val ? `<tr>
      <td style="padding:6px 0;font:600 12px/1.5 Helvetica,Arial,sans-serif;color:#8a908a;width:104px;vertical-align:top">${rot}</td>
      <td style="padding:6px 0;font:400 14px/1.5 Helvetica,Arial,sans-serif;color:#1d1d1f">${val}</td></tr>` : "";
const botaoPS = (href: string, rot: string) => `<a href="${esc(href)}" style="display:inline-block;margin:0 6px 6px 0;
      padding:12px 20px;border-radius:9px;font:600 14px/1 Helvetica,Arial,sans-serif;text-decoration:none;
      background:#00594F;color:#ffffff;border:1px solid #00594F">${esc(rot)}</a>`;
const molduraPS = (titulo: string, miolo: string, rodape: string) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width"><title>${esc(titulo)}</title></head>
<body style="margin:0;padding:0;background:#f4f6f4">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f4">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border:1px solid #e3e6e3;border-radius:14px">
        <tr><td style="padding:28px 28px 8px">
          <img src="${esc(IMG)}/logo-00594f.png" width="188" alt="NeuroDynamics" style="display:block;border:0;outline:none">
        </td></tr>
        ${miolo}
        <tr><td style="padding:18px 28px 28px">
          <div style="font:400 12px/1.6 Helvetica,Arial,sans-serif;color:#8a908a;border-top:1px solid #e3e6e3;padding-top:14px">${rodape}</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

/** o evento da entrevista no Google Agenda */
export function linkGooglePS(d: HorarioPS): string {
  return linkGoogle({ titulo: "Entrevista, Processo Seletivo NeuroDynamics", data: d.data, hora_inicio: d.hora_inicio,
    hora_fim: d.hora_fim, meet_url: d.link || null, local: d.link ? null : d.local || null,
    descricao: "Entrevista individual do processo seletivo da NeuroDynamics." });
}

export function candidatoHTML(e: EnvioPS): string {
  const d = e.dados || {};
  const cancelado = e.tipo === "cancelamento";
  const chamada = d.link ? `<a href="${esc(d.link)}" style="color:#00594F">${esc(d.link)}</a>` : "";
  const antes = d.antes && e.tipo === "reagendamento"
    ? `<span style="text-decoration:line-through;color:#8a908a">${esc(quandoPS(d.antes))}</span>` : "";
  const miolo = `
        <tr><td style="padding:14px 28px 0">
          <div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a">Olá, ${esc(primeiroNome(e.para_nome || ""))}. ${esc(fraseCandidato(e))}</div>
          <div style="font:700 21px/1.3 Helvetica,Arial,sans-serif;color:#1d1d1f;margin-top:10px;
            ${cancelado ? "text-decoration:line-through;color:#8a908a" : ""}">Entrevista individual</div>
        </td></tr>
        <tr><td style="padding:12px 28px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${linhaPS(cancelado ? "Era" : "Quando", esc(quandoPS(d)))}
            ${linhaPS("Antes", antes)}
            ${cancelado ? "" : linhaPS("Chamada", chamada)}
            ${cancelado || d.link ? "" : linhaPS("Onde", esc(d.local || ""))}
            ${cancelado ? "" : linhaPS("Entrevista com", esc(d.responsavel || ""))}
            ${linhaPS("Motivo", esc(d.motivo || ""))}
            ${linhaPS("Protocolo", esc(d.protocolo || ""))}
          </table>
        </td></tr>
        <tr><td style="padding:18px 28px 0">
          ${cancelado ? botaoPS(linkAcompanhar(d), "Escolher novo horário") : d.link ? botaoPS(d.link, "Entrar na chamada") : ""}
        </td></tr>
        ${cancelado ? "" : `<tr><td style="padding:8px 28px 0;font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a">
          ${d.link ? "A entrevista é online, pelo Google Meet. Entre alguns minutos antes, com câmera e microfone testados, de um lugar tranquilo."
            : "Chegue com alguns minutos de antecedência."}
          Se precisar de outro horário, reagende pela página de acompanhamento.
        </td></tr>`}
        <tr><td style="padding:14px 28px 0;font:400 13px/1.6 Helvetica,Arial,sans-serif">
          ${cancelado ? "" : `<a href="${esc(linkGooglePS(d))}" style="color:#00594F;text-decoration:none">Adicionar ao Google Agenda</a> &nbsp;|&nbsp; `}
          <a href="${esc(linkAcompanhar(d))}" style="color:#00594F;text-decoration:none">Página de acompanhamento</a>
        </td></tr>`;
  return molduraPS(e.assunto, miolo,
    "Processo Seletivo da NeuroDynamics. Você recebeu este e-mail porque se inscreveu no processo seletivo.");
}

export function candidatoTexto(e: EnvioPS): string {
  const d = e.dados || {};
  const cancelado = e.tipo === "cancelamento";
  return `Olá, ${primeiroNome(e.para_nome || "")}. ${fraseCandidato(e)}\n\n`
    + `Entrevista individual\n`
    + `${cancelado ? "Era" : "Quando"}: ${quandoPS(d)}\n`
    + (d.antes && e.tipo === "reagendamento" ? `Antes: ${quandoPS(d.antes)}\n` : "")
    + (!cancelado && d.link ? `Chamada: ${d.link}\n` : "")
    + (!cancelado && !d.link && d.local ? `Onde: ${d.local}\n` : "")
    + (!cancelado && d.responsavel ? `Entrevista com: ${d.responsavel}\n` : "")
    + (d.motivo ? `Motivo: ${d.motivo}\n` : "")
    + (d.protocolo ? `Protocolo: ${d.protocolo}\n` : "")
    + (cancelado ? "" : d.link ? `\nA entrevista é online, pelo Google Meet. Entre alguns minutos antes, com câmera e microfone testados.\n`
                                : `\nChegue com alguns minutos de antecedência.\n`)
    + `\nPágina de acompanhamento: ${linkAcompanhar(d)}\n`
    + `\nProcesso Seletivo da NeuroDynamics\n`;
}

/** "Nota média 4 em 2 avaliações: 1 aprovar, 1 em dúvida" */
export function dinamicaTexto(x?: ItemResumoPS["dinamica"]): string {
  if (!x || !x.avaliacoes) return "sem avaliação registrada";
  const r = [x.aprovar ? `${x.aprovar} aprovar` : "", x.em_duvida ? `${x.em_duvida} em dúvida` : "",
             x.reprovar ? `${x.reprovar} reprovar` : ""].filter(Boolean).join(", ");
  const nota = x.nota == null ? "" : `nota média ${String(x.nota).replace(".", ",")} `;
  return `${nota}em ${x.avaliacoes} ${x.avaliacoes === 1 ? "avaliação" : "avaliações"}${r ? `: ${r}` : ""}`;
}
const linksCandidato = (c: ItemResumoPS["candidato"]) =>
  ([["Lattes", c.lattes], ["GitHub", c.github], ["LinkedIn", c.linkedin], ["Portfólio", c.portfolio]] as [string, string | null | undefined][])
    .filter(([, u]) => u && /^https?:\/\//i.test(String(u)));

export function resumoHTML(e: EnvioPS): string {
  const d = e.dados || {}, itens = d.itens || [];
  const cartao = (it: ItemResumoPS) => {
    const c = it.candidato || { nome: "" };
    const formacao = [c.curso, c.instituicao, c.periodo ? `${c.periodo} período` : ""].filter(Boolean).join(", ");
    const links = linksCandidato(c).map(([r, u]) => `<a href="${esc(u)}" style="color:#00594F">${r}</a>`).join(" &nbsp;|&nbsp; ");
    return `<tr><td style="padding:14px 28px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e6e3;border-radius:12px">
        <tr><td style="padding:14px 16px 4px">
          <div style="font:700 13px/1.4 Helvetica,Arial,sans-serif;color:#00594F">${esc(it.hora_inicio)} às ${esc(it.hora_fim)}</div>
          <div style="font:700 18px/1.35 Helvetica,Arial,sans-serif;color:#1d1d1f;margin-top:2px">${esc(c.nome)}</div>
          ${formacao ? `<div style="font:400 13px/1.5 Helvetica,Arial,sans-serif;color:#4a514a">${esc(formacao)}</div>` : ""}
        </td></tr>
        <tr><td style="padding:4px 16px 0">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            ${linhaPS("Áreas", esc((c.areas || []).join(", ")))}
            ${linhaPS("Cidade", esc(c.cidade || ""))}
            ${linhaPS("Dinâmica", esc(dinamicaTexto(it.dinamica)))}
            ${linhaPS("Motivação", esc(c.motivacao || ""))}
            ${linhaPS("Trajetória", esc(c.background || ""))}
            ${linhaPS("Disponibilidade", esc(c.disponibilidade || ""))}
            ${linhaPS("Links", links)}
            ${linhaPS("Contato", esc([c.email, c.telefone].filter(Boolean).join(", ")))}
          </table>
        </td></tr>
        <tr><td style="padding:10px 16px 14px">
          ${it.link ? botaoPS(it.link, "Entrar na chamada") : ""}
          ${it.href ? `<a href="${esc(linkDe(it.href))}" style="font:600 13px/1 Helvetica,Arial,sans-serif;color:#00594F;text-decoration:none">Abrir a ficha no portal</a>` : ""}
        </td></tr>
      </table>
    </td></tr>`;
  };
  const miolo = `
        <tr><td style="padding:14px 28px 0">
          <div style="font:400 14px/1.6 Helvetica,Arial,sans-serif;color:#4a514a">Olá, ${esc(primeiroNome(e.para_nome || ""))}.
            ${d.atualizacao ? "A lista de amanhã mudou: este resumo substitui o anterior." : "Estas são as entrevistas que você conduz amanhã."}</div>
          <div style="font:700 21px/1.3 Helvetica,Arial,sans-serif;color:#1d1d1f;margin-top:10px">
            ${itens.length} ${itens.length === 1 ? "entrevista" : "entrevistas"}, ${esc(diaExtenso(d.dia))}</div>
        </td></tr>
        ${itens.map(cartao).join("")}
        <tr><td style="padding:16px 28px 0;font:400 13px/1.6 Helvetica,Arial,sans-serif">
          <a href="${esc(linkDe("#/selecao/agenda"))}" style="color:#00594F;text-decoration:none">Abrir a Agenda da Seleção</a>
        </td></tr>`;
  return molduraPS(e.assunto, miolo,
    "Processo Seletivo da NeuroDynamics. Você recebe este resumo porque abriu estes horários de entrevista em Seleção › Agenda. Os dados dos candidatos são sigilosos: não encaminhe este e-mail.");
}

export function resumoTexto(e: EnvioPS): string {
  const d = e.dados || {}, itens = d.itens || [];
  return `Olá, ${primeiroNome(e.para_nome || "")}. `
    + (d.atualizacao ? "A lista de amanhã mudou: este resumo substitui o anterior.\n\n" : "Estas são as entrevistas que você conduz amanhã.\n\n")
    + `${itens.length} ${itens.length === 1 ? "entrevista" : "entrevistas"}, ${diaExtenso(d.dia)}\n`
    + itens.map((it) => {
      const c = it.candidato || { nome: "" };
      return `\n${it.hora_inicio} às ${it.hora_fim}: ${c.nome}\n`
        + [[c.curso, c.instituicao, c.periodo ? `${c.periodo} período` : ""].filter(Boolean).join(", ")].filter(Boolean).map((x) => `${x}\n`).join("")
        + (c.areas?.length ? `Áreas: ${c.areas.join(", ")}\n` : "")
        + `Dinâmica: ${dinamicaTexto(it.dinamica)}\n`
        + (c.motivacao ? `Motivação: ${c.motivacao}\n` : "")
        + linksCandidato(c).map(([r, u]) => `${r}: ${u}\n`).join("")
        + (c.email || c.telefone ? `Contato: ${[c.email, c.telefone].filter(Boolean).join(", ")}\n` : "")
        + (it.link ? `Chamada: ${it.link}\n` : "")
        + (it.href ? `Ficha: ${linkDe(it.href)}\n` : "");
    }).join("")
    + `\nProcesso Seletivo da NeuroDynamics. Os dados dos candidatos são sigilosos: não encaminhe este e-mail.\n`;
}

/** Manda a fila das entrevistas e dá baixa. Sem a 31.0, diz isso e segue. */
async function enviarPS(): Promise<Record<string, unknown>> {
  let lote: EnvioPS[];
  try {
    lote = (await rpc("ps_envios_lote", { p_limite: LOTE })) as EnvioPS[];
  } catch (e) {
    return /PGRST202|404|ps_envios_lote/.test(String(e))
      ? { ps: "sem_migracao_31" } : { ps: "erro", ps_detalhe: String(e) };
  }
  if (!lote?.length) return { ps: 0 };
  const enviados: number[] = [], falhas: number[] = [];
  let erro = "";
  for (const e of lote) {
    try {
      const resumo = e.tipo === "resumo";
      const m = await enviarUm(e.para_email, e.para_nome || "", e.assunto,
        resumo ? resumoHTML(e) : candidatoHTML(e), resumo ? resumoTexto(e) : candidatoTexto(e), DE_PS);
      if (m) { falhas.push(e.id); erro = m; } else { enviados.push(e.id); }
    } catch (x) { falhas.push(e.id); erro = String(x); }
  }
  try {
    await rpc("ps_envios_baixa", { p: { enviados, falhas, erro } });
  } catch (x) {
    return { ps: enviados.length, ps_falhas: falhas.length, ps_detalhe: "enviou, mas não deu baixa: " + String(x) };
  }
  return { ps: enviados.length, ps_falhas: falhas.length, ...(erro ? { ps_detalhe: erro } : {}) };
}

/* ------------------------------------------------------------
   OS E-MAILS PROGRAMADOS (30.0)
   O Full mailer grava o HTML pronto; aqui só se troca o nome de cada
   destinatário e se envia, com o remetente da área no nome de exibição.
   ------------------------------------------------------------ */
export type Programado = {
  id: string; assunto: string; remetente_nome: string; html: string; texto: string;
  destinatarios: { registro: number; nome: string; email: string }[];
};

/** Troca {{primeiro_nome}} e {{nome}}. No HTML, escapado; no texto, cru. */
export function personalizar(modelo: string, nome: string, html: boolean): string {
  const completo = String(nome || "").trim();
  const primeiro = completo.split(/\s+/)[0] || "";
  const v = (x: string) => html ? esc(x) : x;
  return String(modelo || "")
    .replace(/\{\{\s*primeiro_nome\s*\}\}/g, v(primeiro))
    .replace(/\{\{\s*nome\s*\}\}/g, v(completo));
}

/** Manda os programados que venceram e dá baixa. Sem a 30.0, diz isso e segue. */
async function enviarProgramados(): Promise<Record<string, unknown>> {
  let lote: Programado[];
  try {
    lote = (await rpc("email_programados_lote", { p_limite: 10 })) as Programado[];
  } catch (e) {
    return /PGRST202|404|email_programados_lote/.test(String(e))
      ? { programados: "sem_migracao_30" } : { programados: "erro", programados_detalhe: String(e) };
  }
  if (!lote?.length) return { programados: 0 };
  let total = 0, totalFalhas = 0, erroGeral = "";
  for (const p of lote) {
    let enviados = 0, falhas = 0, erro = "";
    for (const d of p.destinatarios || []) {
      try {
        const m = await enviarUm(d.email, d.nome, personalizar(p.assunto, d.nome, false),
          personalizar(p.html, d.nome, true), personalizar(p.texto, d.nome, false), p.remetente_nome);
        if (m) { falhas++; erro = m; } else { enviados++; }
      } catch (x) { falhas++; erro = String(x); }
    }
    total += enviados; totalFalhas += falhas; if (erro) erroGeral = erro;
    try {
      await rpc("email_programados_baixa", { p: { id: p.id, enviados, falhas, erro } });
    } catch (x) {
      erroGeral = "enviou, mas não deu baixa: " + String(x);
    }
  }
  return { programados: total, programados_falhas: totalFalhas, ...(erroGeral ? { programados_detalhe: erroGeral } : {}) };
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

/* ============================================================
   QUEM ACORDA A FILA (32.0)
   Até a 31.0 esta função confiava na verificação de JWT do painel: quem
   passasse por ela entrava. Só que o agendamento do banco não tem JWT
   nenhum à mão — e a fila só andava quando alguém apertava o teste do
   portal, que chama com a sessão da pessoa. Agora a função confere
   sozinha, e a verificação do painel pode (e deve) ficar desligada:

     x-soma-fila        a senha que a 32.0 guardou no Vault: é o
                        agendamento do banco (fila_chamar);
     Bearer <service>   a service role, por extenso (o SQL do README);
     Bearer <JWT>       qualquer JWT que o próprio PostgREST aceite, e o
                        papel dele: a sessão de quem está no portal (o
                        teste e o empurrão), ou uma chave de serviço.
   ============================================================ */
const ORIGENS_DO_BANCO = ["agendamento", "evento", "manual"];

/** De onde veio o chamado, pelo papel que o banco reconheceu no token. */
export function origemDoPapel(papel: string, pedida: string): { origem: string } | { erro: string } {
  if (papel === "service_role") return { origem: ORIGENS_DO_BANCO.includes(pedida) ? pedida : "servico" };
  if (papel === "authenticated") return { origem: pedida === "teste" ? "teste" : "portal" };
  /* a chave anônima antiga, num agendamento feito pelo painel antes da
     32.0: entra, como entrava — a passada só manda o que já venceu */
  if (papel === "anon") return { origem: "anon" };
  return { erro: "papel_desconhecido" };
}
export const origemDoBanco = (pedida: string): string =>
  ORIGENS_DO_BANCO.includes(pedida) ? pedida : "agendamento";

const semMigracao32 = (e: unknown): boolean => /PGRST202|\b404\b|Could not find the function/i.test(String(e));

async function quemChama(req: Request, pedida: string): Promise<{ origem: string } | { erro: string }> {
  const senha = (req.headers.get("x-soma-fila") || "").trim();
  if (senha) {
    try {
      return (await rpc("fila_token_confere", { p_token: senha })) === true
        ? { origem: origemDoBanco(pedida) } : { erro: "senha_errada" };
    } catch (e) {
      return { erro: semMigracao32(e) ? "sem_migracao_32" : "senha_nao_conferida" };
    }
  }
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!bearer) return { erro: "sem_credencial" };
  if (bearer === CHAVE_SERVICO) return { origem: ORIGENS_DO_BANCO.includes(pedida) ? pedida : "servico" };
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/fila_quem_sou`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: CHAVE_SERVICO, Authorization: `Bearer ${bearer}` },
    body: "{}",
  });
  const texto = await r.text();
  /* sem a 32.0 a função de conferir não existe: vale o que o painel
     conferiu, como era antes */
  if (r.status === 404 && semMigracao32(texto)) return { origem: pedida === "teste" ? "teste" : "servico" };
  if (!r.ok) return { erro: "credencial_recusada" };
  let q: { papel?: string } = {};
  try { q = JSON.parse(texto); } catch { /* resposta estranha: recusa abaixo */ }
  return origemDoPapel(String(q?.papel || ""), pedida);
}

/* ============================================================
   UMA PASSADA DE CADA VEZ (32.0)
   As funções que leem as filas não reservam linhas: duas passadas ao
   mesmo tempo mandariam o mesmo e-mail duas vezes. A vez mora no banco
   (fila_passada_inicio). O teste do portal espera a vez um pouco; o
   resto, quando encontra outra passada rodando, desiste — ela já está
   fazendo o trabalho.
   ============================================================ */
async function pegarVez(origem: string): Promise<{ id: number | null; ocupada?: unknown }> {
  const tentativas = origem === "teste" ? 12 : 1;
  for (let i = 0; i < tentativas; i++) {
    let r: { status?: string; id?: number };
    try {
      r = (await rpc("fila_passada_inicio", { p_origem: origem })) as { status?: string; id?: number };
    } catch (e) {
      if (semMigracao32(e)) return { id: null };   // sem a 32.0: como antes, sem vez
      throw e;
    }
    if (r?.status === "ok") return { id: Number(r.id) };
    if (i + 1 >= tentativas) return { id: null, ocupada: r };
    await new Promise((ok) => setTimeout(ok, 1500));
  }
  return { id: null };
}
async function devolverVez(id: number | null, resultado: unknown): Promise<void> {
  if (!id) return;
  try { await rpc("fila_passada_fim", { p_id: id, p_resultado: resultado }); }
  catch (e) { console.error("fila_passada_fim", e); }
}

/* ============================================================
   AS NOTIFICAÇÕES NO APARELHO — Web Push (32.0)
   O aviso do sino também vai para os navegadores que a pessoa inscreveu
   (sino › Preferências). Sem biblioteca: a cifra da mensagem (RFC 8291,
   aes128gcm) e a assinatura do servidor (RFC 8292, VAPID com ES256) são
   feitas com o WebCrypto, que o Deno e o Node já têm. O par de chaves
   VAPID nasce aqui, na primeira passada, e mora no Vault.
   ============================================================ */
const utf8 = new TextEncoder();
/** base64url sem preenchimento, o formato de tudo no Web Push. */
export function b64u(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export function deb64u(texto: string): Uint8Array {
  let s = String(texto || "").replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function juntar(...partes: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) { out.set(p, i); i += p.length; }
  return out;
}
async function hkdf(sal: Uint8Array, ikm: Uint8Array, info: Uint8Array, bytes: number): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: sal, info }, k, bytes * 8));
}

/** Cifra a mensagem para um navegador (RFC 8291, aes128gcm): devolve o corpo do POST. */
export async function cifrarPush(texto: string, p256dh: string, auth: string,
                                 opc: { sal?: Uint8Array; par?: CryptoKeyPair } = {}): Promise<Uint8Array> {
  const uaPub = deb64u(p256dh);      // a chave pública do navegador, 65 bytes
  const segredo = deb64u(auth);      // o segredo de autenticação, 16 bytes
  const par = opc.par ?? (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const uaChave = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaChave }, par.privateKey, 256));
  const ikm = await hkdf(segredo, ecdh, juntar(utf8.encode("WebPush: info\0"), uaPub, asPub), 32);
  const sal = opc.sal ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, utf8.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(sal, ikm, utf8.encode("Content-Encoding: nonce\0"), 12);
  const chave = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  /* um registro só: o texto e o delimitador 0x02, que diz "é o último" */
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, chave,
    juntar(utf8.encode(texto), new Uint8Array([2]))));
  const cab = new Uint8Array(16 + 4 + 1 + asPub.length);
  cab.set(sal, 0);
  new DataView(cab.buffer).setUint32(16, 4096);
  cab[20] = asPub.length;
  cab.set(asPub, 21);
  return juntar(cab, cifrado);
}

/** O JWT do servidor (RFC 8292): quem manda, para qual serviço, até quando. */
export async function jwtVapid(aud: string, sub: string, privada: JsonWebKey,
                               agora = Math.floor(Date.now() / 1000)): Promise<string> {
  const cab = b64u(utf8.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const corpo = b64u(utf8.encode(JSON.stringify({ aud, exp: agora + 12 * 3600, sub })));
  const { d, x, y, crv, kty } = privada;
  const k = await crypto.subtle.importKey("jwk", { d, x, y, crv, kty }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const ass = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, k, utf8.encode(`${cab}.${corpo}`)));
  return `${cab}.${corpo}.${b64u(ass)}`;
}

/** Um par VAPID novo: a pública em base64url (o que o navegador pede) e a privada em JWK. */
export async function gerarChavesVapid(): Promise<{ publica: string; privada: string }> {
  const par = (await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return {
    publica: b64u(new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey))),
    privada: JSON.stringify(await crypto.subtle.exportKey("jwk", par.privateKey)),
  };
}

export interface InscricaoPush { id: string; endpoint: string; p256dh: string; auth: string; criado_em: string; }
export interface LotePush { registro: number; itens: ItemNotificacao[]; inscricoes: InscricaoPush[] | null; }

const cortar = (s: unknown, n: number): string => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};
/** O que o aparelho mostra: um aviso, ou o resumo de vários (mais de três de uma vez). */
export function mensagemPush(itens: ItemNotificacao[]): { t: string; c: string; h: string; tag: string } {
  const href = (h: string | null) => (/^#\/[\w\-\/.%]*$/.test(String(h || "")) ? String(h) : "#/");
  if (itens.length <= 1) {
    const i = itens[0];
    return { t: cortar(i?.titulo || "SOMA", 120), c: cortar(i?.corpo || "", 240), h: href(i?.href ?? null), tag: "n" + (i?.id ?? 0) };
  }
  return {
    t: `${itens.length} avisos novos no SOMA`,
    c: itens.slice(-4).reverse().map((i) => cortar(i.titulo, 70)).join("\n"),
    h: "#/",
    tag: "resumo",
  };
}
/** Os avisos de uma pessoa que vão para um aparelho: só os que nasceram depois da inscrição. */
export function paraOAparelho(itens: ItemNotificacao[], insc: InscricaoPush): ItemNotificacao[] {
  const desde = Date.parse(insc.criado_em || "") - 5000;
  return itens.filter((i) => !(desde > 0) || Date.parse(i.criado_em) >= desde);
}

async function chavesVapid(): Promise<{ publica: string; privada: JsonWebKey } | null> {
  let c = (await rpc("push_chaves", {})) as { publica?: string | null; privada?: string | null } | null;
  if (!c?.publica || !c?.privada) {
    const novo = await gerarChavesVapid();
    c = (await rpc("push_chaves_gravar", { p_publica: novo.publica, p_privada: novo.privada })) as typeof c;
  }
  if (!c?.publica || !c?.privada) return null;
  return { publica: c.publica, privada: JSON.parse(c.privada) as JsonWebKey };
}

async function enviarPush(): Promise<Record<string, unknown>> {
  let vapid: { publica: string; privada: JsonWebKey } | null;
  let lote: LotePush[];
  try {
    vapid = await chavesVapid();
    lote = (await rpc("push_lote", { p_limite: 300 })) as LotePush[];
  } catch (e) {
    return semMigracao32(e) ? { push: "sem_migracao_32" } : { push: "erro", push_detalhe: String(e) };
  }
  if (!vapid || !lote?.length) return { push: 0 };
  const sub = "mailto:" + (RESPONDER || DE || "soma@neurodynamics.dev");
  const jwts = new Map<string, string>();
  const itens: number[] = [], ok: string[] = [], mortas: string[] = [], falhas: string[] = [];
  let enviadas = 0, ultimoErro = "";
  const tarefas: Array<() => Promise<void>> = [];
  for (const p of lote) {
    p.itens.forEach((i) => itens.push(i.id));
    for (const insc of p.inscricoes || []) {
      const meus = paraOAparelho(p.itens, insc);
      if (!meus.length) continue;
      tarefas.push(async () => {
        try {
          const aud = new URL(insc.endpoint).origin;
          if (!jwts.has(aud)) jwts.set(aud, await jwtVapid(aud, sub, vapid!.privada));
          const corpo = await cifrarPush(JSON.stringify(mensagemPush(meus)), insc.p256dh, insc.auth);
          const r = await fetch(insc.endpoint, {
            method: "POST",
            headers: {
              "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream",
              TTL: "86400", Urgency: "normal",
              Authorization: `vapid t=${jwts.get(aud)}, k=${vapid!.publica}`,
            },
            body: corpo,
          });
          /* 404 e 410: o navegador revogou ou apagou a inscrição */
          if (r.status === 404 || r.status === 410) { mortas.push(insc.id); await r.body?.cancel(); return; }
          if (!r.ok) { falhas.push(insc.id); ultimoErro = `${r.status} ${(await r.text()).slice(0, 200)}`; return; }
          await r.body?.cancel();
          ok.push(insc.id); enviadas++;
        } catch (e) {
          falhas.push(insc.id); ultimoErro = String(e);
        }
      });
    }
  }
  /* de dez em dez: um serviço lento não segura o resto da passada */
  for (let i = 0; i < tarefas.length; i += 10) await Promise.all(tarefas.slice(i, i + 10).map((t) => t()));
  try {
    await rpc("push_baixa", { p: { itens, ok, mortas, falhas } });
  } catch (e) {
    ultimoErro = "enviou, mas não deu baixa: " + String(e);
  }
  return { push: enviadas, push_falhas: falhas.length, push_mortas: mortas.length,
           ...(ultimoErro ? { push_detalhe: ultimoErro } : {}) };
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

  let pedido: { origem?: string } = {};
  try { pedido = req.method === "POST" ? JSON.parse((await req.text()) || "{}") : {}; } catch { pedido = {}; }
  const quem = await quemChama(req, String(pedido?.origem || ""));
  if ("erro" in quem) {
    return new Response(JSON.stringify({ status: "nao_autorizado", detalhe: quem.erro }),
      { status: 401, headers: cabecalho });
  }

  const vez = await pegarVez(quem.origem);
  if (vez.ocupada) {
    /* outra passada está rodando e vai levar o que estiver na fila */
    return new Response(JSON.stringify({ status: "ocupada", origem: quem.origem, ...(vez.ocupada as object) }),
      { headers: cabecalho });
  }
  let resposta: Record<string, unknown> = { status: "erro" };
  let http = 200;
  try {
    [resposta, http] = await passada();
    return new Response(JSON.stringify(resposta), { status: http, headers: cabecalho });
  } catch (e) {
    resposta = { status: "erro", detalhe: String(e) };
    throw e;
  } finally {
    await devolverVez(vez.id, { ...resposta, origem: quem.origem });
  }
}

/** Uma passada inteira: o aparelho, as filas próprias e os avisos do sino. */
async function passada(): Promise<[Record<string, unknown>, number]> {
  /* o aparelho primeiro: é rápido, é o que tem pressa, e não depende do
     provedor de e-mail estar configurado */
  const push = await enviarPush();

  /* Sem provedor configurado a função não é um erro: ela não tem o que
     fazer. Dizer isso em voz alta, com o nome do segredo que falta, é
     melhor do que queimar a tentativa de um aviso que nunca teve como
     sair. O status continua sendo "smtp_nao_configurado" porque é o que
     o portal já sabe ler e explicar. */
  const falta = faltaParaEnviar();
  if (falta) return [{ status: "smtp_nao_configurado", detalhe: falta, ...push }, 200];

  /* as declarações e a agenda primeiro: saem mesmo que o sino não
     tenha aviso nenhum para ninguém, e o lembrete tem hora */
  const docs = { ...push, ...(await enviarDocumentos()), ...(await enviarAgenda()), ...(await enviarProgramados()),
                 ...(await enviarPS()) };

  let destinos: Destinatario[];
  try {
    destinos = (await rpc("notificacoes_email_lote", { p_limite: LOTE })) as Destinatario[];
  } catch (e) {
    return [{ status: "erro_no_lote", detalhe: String(e), ...docs }, 500];
  }

  if (!destinos?.length) return [{ status: "ok", pessoas: 0, enviadas: 0, ...docs }, 200];

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
    return [{
      status: "enviou_mas_nao_deu_baixa", enviadas: enviadas.length, detalhe: String(e), ...docs,
    }, 500];
  }

  return [{
    status: "ok", pessoas: destinos.length,
    enviadas: enviadas.length, falhas: falhas.length,
    /* o motivo da recusa vai junto: sem ele, "0 enviadas" não diz nada
       a quem está configurando, e o provedor já explicou o porquê */
    /* o remetente vai junto porque, quando TODAS falham, ele é o
       suspeito — é o único dado comum a todas as tentativas */
    ...(ultimoErro ? { detalhe: ultimoErro, provedor: PROVEDOR, de: DE } : {}),
    ...docs,
  }, 200];
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
