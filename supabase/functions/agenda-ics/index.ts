/* ============================================================
   agenda-ics — o feed da agenda da NeuroDynamics
   Portal do Membro · NeuroDynamics

   Serve um arquivo .ics por membro, no endereço

     /functions/v1/agenda-ics?t=<token>

   O membro assina esse endereço uma vez no Google Agenda
   ("Outras agendas -> Inscrever-se em agenda -> Do URL") e, daí
   em diante, tudo o que o portal mostra para ele aparece na
   agenda dele: reuniões gerais, os eventos dos seus grupos, as
   cerimônias do time, as próprias férias e os marcos da equipe.
   Nada que ele não possa ver entra no arquivo — quem decide é a
   mesma função do banco que desenha a agenda no portal
   (agenda_feed -> agenda_itens_para).

   IMPORTANTE ao publicar: DESLIGUE a verificação de JWT desta
   função. Quem busca o arquivo é o Google, que não tem sessão;
   a credencial é o token secreto da URL, e ele é rotacionável
   pelo próprio membro.
   ============================================================ */

/** Janela publicada: dois meses para trás, um ano para frente. */
const DIAS_ATRAS = 60;
const DIAS_ADIANTE = 365;
const FUSO = "America/Sao_Paulo";
const DOMINIO = "membro.neurodynamics.dev";

const env = (nome: string): string =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get(nome) ?? "";

const URL_BASE = env("SUPABASE_URL");
const CHAVE_SERVICO = env("SUPABASE_SERVICE_ROLE_KEY");

interface Item {
  id: string;
  origem: string;
  ref: string;
  categoria: string | null;
  tipo: string | null;
  titulo: string | null;
  data_inicio: string;
  data_fim: string | null;
  hora_inicio: string | null;
  hora_fim: string | null;
  dia_inteiro: boolean;
  local: string | null;
  meet_url: string | null;
  pauta: string | null;
  numero: number | null;
  recorrencia: string | null;
  registro: number | null;
  minha_resposta: string | null;
  convidados: number | null;
  confirmados: number | null;
}

/* ---------------- horário de parede -> UTC ---------------- */

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: FUSO, hour12: false,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
});

function deslocamento(ms: number): number {
  const p: Record<string, string> = {};
  for (const parte of fmt.formatToParts(new Date(ms))) p[parte.type] = parte.value;
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - ms;
}

/** "2026-09-01" + "14:30" no fuso da equipe -> instante UTC. */
export function paraUTC(data: string, hora: string): Date {
  const [a, m, d] = data.split("-").map(Number);
  const [h, mi] = hora.split(":").map(Number);
  const chute = Date.UTC(a, m - 1, d, h, mi, 0);
  let ms = chute - deslocamento(chute);
  ms = chute - deslocamento(ms);
  return new Date(ms);
}

/* ---------------- escrita do iCalendar ---------------- */

const zz = (n: number) => String(n).padStart(2, "0");
const carimbo = (d: Date) =>
  `${d.getUTCFullYear()}${zz(d.getUTCMonth() + 1)}${zz(d.getUTCDate())}T` +
  `${zz(d.getUTCHours())}${zz(d.getUTCMinutes())}${zz(d.getUTCSeconds())}Z`;
const soData = (iso: string) => iso.replaceAll("-", "");

function maisUmDia(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + 1));
  return `${dt.getUTCFullYear()}${zz(dt.getUTCMonth() + 1)}${zz(dt.getUTCDate())}`;
}

export function texto(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;")
          .replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545: nenhuma linha passa de 75 octetos. */
export function dobrar(linha: string): string {
  const bytes = new TextEncoder().encode(linha);
  if (bytes.length <= 75) return linha;
  const saida: string[] = [];
  let atual = "", tam = 0, limite = 75;
  for (const ch of linha) {
    const n = new TextEncoder().encode(ch).length;
    if (tam + n > limite) { saida.push(atual); atual = " "; tam = 1; limite = 75; }
    atual += ch; tam += n;
  }
  saida.push(atual);
  return saida.join("\r\n");
}

export function vevento(it: Item): string[] {
  const linhas: string[] = ["BEGIN:VEVENT"];
  const uid = `${it.origem}-${it.ref}@${DOMINIO}`;
  linhas.push(`UID:${uid}`);
  linhas.push(`DTSTAMP:${carimbo(new Date())}`);

  if (it.dia_inteiro || !it.hora_inicio) {
    linhas.push(`DTSTART;VALUE=DATE:${soData(it.data_inicio)}`);
    linhas.push(`DTEND;VALUE=DATE:${maisUmDia(it.data_fim ?? it.data_inicio)}`);
  } else {
    const ini = paraUTC(it.data_inicio, it.hora_inicio);
    const fimHora = it.hora_fim ?? null;
    const fim = fimHora && fimHora > it.hora_inicio
      ? paraUTC(it.data_inicio, fimHora)
      : new Date(ini.getTime() + 3600000);
    linhas.push(`DTSTART:${carimbo(ini)}`);
    linhas.push(`DTEND:${carimbo(fim)}`);
  }

  linhas.push(`SUMMARY:${texto(it.titulo ?? "Compromisso")}`);

  const desc: string[] = [];
  if (it.pauta) desc.push(it.pauta);
  if (it.meet_url) desc.push(`Chamada: ${it.meet_url}`);
  if (it.numero) desc.push(`Evento EVT-${String(it.numero).padStart(3, "0")} do SOMA.`);
  if (it.convidados) {
    desc.push(`${it.confirmados ?? 0} de ${it.convidados} confirmaram presença.`);
  }
  if (it.minha_resposta === "pendente") desc.push("Você ainda não respondeu ao convite.");
  desc.push(`Agenda da NeuroDynamics · https://${DOMINIO}/#/agenda`);
  linhas.push(`DESCRIPTION:${texto(desc.join("\n"))}`);

  if (it.local) linhas.push(`LOCATION:${texto(it.local)}`);
  if (it.meet_url) linhas.push(`URL:${it.meet_url}`);
  if (it.tipo) linhas.push(`CATEGORIES:${texto(it.tipo)}`);
  // Ausências e marcos não bloqueiam a agenda de quem só está vendo.
  linhas.push(it.origem === "evento" ? "TRANSP:OPAQUE" : "TRANSP:TRANSPARENT");
  if (it.minha_resposta === "talvez") linhas.push("STATUS:TENTATIVE");
  else linhas.push("STATUS:CONFIRMED");
  linhas.push(`X-NRO-ORIGEM:${it.origem}`);
  linhas.push("END:VEVENT");
  return linhas;
}

/* ---------------- entrada ---------------- */

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function textoSimples(corpo: string, status: number): Response {
  return new Response(corpo, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function servir(req: Request): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return textoSimples("Use GET.", 405);
  }
  if (!URL_BASE || !CHAVE_SERVICO) {
    return textoSimples("Função sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY.", 500);
  }

  const token = new URL(req.url).searchParams.get("t")?.trim() ?? "";
  if (!RE_UUID.test(token)) {
    return textoSimples("Endereço inválido. Copie o link de novo no portal.", 404);
  }

  const hoje = new Date();
  const de = new Date(hoje.getTime() - DIAS_ATRAS * 86400000).toISOString().slice(0, 10);
  const ate = new Date(hoje.getTime() + DIAS_ADIANTE * 86400000).toISOString().slice(0, 10);

  const r = await fetch(`${URL_BASE}/rest/v1/rpc/agenda_feed`, {
    method: "POST",
    headers: {
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ p_token: token, p_de: de, p_ate: ate }),
  });
  if (!r.ok) {
    return textoSimples(`Não foi possível montar a agenda (${r.status}).`, 502);
  }
  // Token revogado devolve um calendário vazio, igual a uma janela
  // sem compromissos: o Google simplesmente para de mostrar coisas,
  // e nada do que a pessoa não pode mais ver vaza no meio do caminho.
  const itens = await r.json() as Item[];

  const linhas: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//NeuroDynamics//Portal do Membro//PT-BR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:NeuroDynamics",
    `X-WR-TIMEZONE:${FUSO}`,
    "X-WR-CALDESC:Agenda da equipe: reuniões, cerimônias, eventos dos seus grupos e as suas ausências.",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const it of itens) linhas.push(...vevento(it));
  linhas.push("END:VCALENDAR");

  const corpo = linhas.map(dobrar).join("\r\n") + "\r\n";
  return new Response(req.method === "HEAD" ? null : corpo, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="neurodynamics.ics"',
      "Cache-Control": "public, max-age=900",
    },
  });
}

const servidor = (globalThis as { Deno?: { serve(h: (r: Request) => Promise<Response>): unknown } }).Deno;
servidor?.serve(async (req: Request) => {
  try {
    return await servir(req);
  } catch (e) {
    return textoSimples(e instanceof Error ? e.message : String(e), 500);
  }
});
