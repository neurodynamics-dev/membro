/* ============================================================
   agenda-sync — Edge Function do Portal do Membro
   NeuroDynamics

   Lê o link .ics do Google Agenda de cada membro e grava os
   BLOCOS DE OCUPAÇÃO em portal_agenda_blocos, que é o que o
   Assistente de agendamento mostra. O link nunca sai daqui e
   o conteúdo do calendário não é guardado: só início, fim e —
   se a pessoa autorizar — o título.

   Chamadas aceitas (POST, corpo JSON):
     {}                      sincroniza a agenda de quem chamou
     { "registro": 12 }      idem, e admin/pessoal podem pedir
                             a de outra pessoa
     { "todos": true }       todas as agendas conectadas
                             (admin/pessoal ou service role/cron)

   Variáveis de ambiente (o Supabase já injeta as três):
     SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

   ARQUIVO ÚNICO: para publicar, basta colar este arquivo no
   editor do painel. A leitura de iCalendar vem primeiro; a
   função em si, na PARTE 2.
   ============================================================ */

/* ============================================================
   PARTE 1 — LEITURA DE iCALENDAR (RFC 5545)

   Só o suficiente para responder "quando essa pessoa está
   ocupada": desdobra as recorrências dentro de uma janela e
   devolve blocos de início/fim em UTC. Não guarda convidados,
   descrição, local nem anexo — nada disso chega ao banco.

   Fica no mesmo arquivo de propósito: a Edge Function é
   publicada colando UM arquivo no painel do Supabase, e um
   import relativo não sobreviveria a isso. O ics.test.ts lê as
   funções daqui.
   ============================================================ */

export interface Bloco {
  inicio: Date;
  fim: Date;
  diaInteiro: boolean;
  titulo: string | null;
  uid: string | null;
}

export interface OpcoesLeitura {
  /** Fuso do dono da agenda: usado em datas "flutuantes" e em eventos de dia inteiro. */
  fuso: string;
  /** Janela de interesse. Ocorrências fora dela são descartadas. */
  de: Date;
  ate: Date;
  /** Teto de blocos devolvidos (proteção contra feeds enormes). */
  maxBlocos?: number;
}

/* ---------------- linhas e propriedades ---------------- */

interface Prop {
  nome: string;
  params: Record<string, string>;
  valor: string;
}

/** Desdobra as continuações (CRLF + espaço) e devolve as linhas lógicas. */
function linhasLogicas(texto: string): string[] {
  return texto
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n");
}

/** Acha o ":" que separa nome/parâmetros do valor, ignorando o que está entre aspas. */
function posDoisPontos(linha: string): number {
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i];
    if (c === '"') aspas = !aspas;
    else if (c === ":" && !aspas) return i;
  }
  return -1;
}

function lerProp(linha: string): Prop | null {
  const i = posDoisPontos(linha);
  if (i < 0) return null;
  const esquerda = linha.slice(0, i);
  const valor = linha.slice(i + 1);
  const pedacos = esquerda.split(";");
  const params: Record<string, string> = {};
  for (let k = 1; k < pedacos.length; k++) {
    const eq = pedacos[k].indexOf("=");
    if (eq > 0) {
      params[pedacos[k].slice(0, eq).toUpperCase()] =
        pedacos[k].slice(eq + 1).replace(/^"(.*)"$/, "$1");
    }
  }
  return { nome: pedacos[0].toUpperCase(), params, valor };
}

/** Desfaz os escapes de TEXT do RFC 5545 (\n, \, ; e ,). */
function destextar(v: string): string {
  return v.replace(/\\([nN;,\\])/g, (_, c) => (c === "n" || c === "N" ? "\n" : c));
}

/* ---------------- fusos ---------------- */

const formatadores = new Map<string, Intl.DateTimeFormat>();
function formatador(fuso: string): Intl.DateTimeFormat {
  let f = formatadores.get(fuso);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: fuso, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatadores.set(fuso, f);
  }
  return f;
}

export function fusoValido(fuso: string): boolean {
  try { formatador(fuso); return true; } catch { return false; }
}

/** Diferença, em ms, entre o relógio de parede do fuso e o UTC naquele instante. */
function deslocamento(ms: number, fuso: string): number {
  const p: Record<string, string> = {};
  for (const parte of formatador(fuso).formatToParts(new Date(ms))) p[parte.type] = parte.value;
  const comoUTC = Date.UTC(
    +p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return comoUTC - ms;
}

/** Converte um horário de parede (no fuso dado) para o instante UTC correspondente. */
function paredeParaUTC(
  a: number, m: number, d: number, h: number, mi: number, s: number, fuso: string,
): number {
  const chute = Date.UTC(a, m - 1, d, h, mi, s);
  let ms = chute - deslocamento(chute, fuso);
  // Segunda passada: resolve as viradas de horário de verão.
  ms = chute - deslocamento(ms, fuso);
  return ms;
}

/** Componentes do relógio de parede de um instante, no fuso dado. */
function paredeDe(ms: number, fuso: string) {
  const p: Record<string, string> = {};
  for (const parte of formatador(fuso).formatToParts(new Date(ms))) p[parte.type] = parte.value;
  return {
    a: +p.year, m: +p.month, d: +p.day,
    h: +p.hour % 24, mi: +p.minute, s: +p.second,
  };
}

/* ---------------- datas do iCalendar ---------------- */

interface Momento { ms: number; soData: boolean; }

const RE_DT = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/;

function lerMomento(p: Prop, fusoPadrao: string): Momento | null {
  const v = p.valor.trim();
  const m = RE_DT.exec(v);
  if (!m) return null;
  const [, a, mes, d, h, mi, s, z] = m;
  const soData = p.params.VALUE === "DATE" || h === undefined;
  if (soData) {
    return { ms: paredeParaUTC(+a, +mes, +d, 0, 0, 0, fusoPadrao), soData: true };
  }
  if (z) return { ms: Date.UTC(+a, +mes - 1, +d, +h, +mi, +s), soData: false };
  const tz = p.params.TZID && fusoValido(p.params.TZID) ? p.params.TZID : fusoPadrao;
  return { ms: paredeParaUTC(+a, +mes, +d, +h, +mi, +s, tz), soData: false };
}

/** PT15M, P1D, P1DT2H30M… em milissegundos. */
function lerDuracao(v: string): number | null {
  const m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v.trim());
  if (!m) return null;
  const [, sinal, sem, dia, hor, min, seg] = m;
  const ms = (+(sem ?? 0) * 604800 + +(dia ?? 0) * 86400 +
              +(hor ?? 0) * 3600 + +(min ?? 0) * 60 + +(seg ?? 0)) * 1000;
  return sinal === "-" ? -ms : ms;
}

/* ---------------- recorrência ---------------- */

const DIAS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const TETO_ITERACOES = 8000;

interface Regra {
  freq: string;
  intervalo: number;
  count: number | null;
  ate: number | null;
  porDia: { ord: number; dia: number }[];
  porDiaDoMes: number[];
  porMes: number[];
}

function lerRegra(valor: string, fusoPadrao: string): Regra | null {
  const partes: Record<string, string> = {};
  for (const p of valor.split(";")) {
    const eq = p.indexOf("=");
    if (eq > 0) partes[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1);
  }
  const freq = (partes.FREQ || "").toUpperCase();
  if (!["DAILY", "WEEKLY", "MONTHLY", "YEARLY"].includes(freq)) return null;

  let ate: number | null = null;
  if (partes.UNTIL) {
    const mo = lerMomento({ nome: "UNTIL", params: {}, valor: partes.UNTIL }, fusoPadrao);
    ate = mo ? mo.ms : null;
  }
  const porDia: { ord: number; dia: number }[] = [];
  for (const t of (partes.BYDAY || "").split(",")) {
    const m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/i.exec(t.trim());
    if (m) porDia.push({ ord: m[1] ? +m[1] : 0, dia: DIAS.indexOf(m[2].toUpperCase()) });
  }
  const numeros = (chave: string) =>
    (partes[chave] || "").split(",").map((x) => parseInt(x, 10)).filter((x) => !isNaN(x));

  return {
    freq,
    intervalo: Math.max(1, parseInt(partes.INTERVAL || "1", 10) || 1),
    count: partes.COUNT ? parseInt(partes.COUNT, 10) : null,
    ate,
    porDia,
    porDiaDoMes: numeros("BYMONTHDAY"),
    porMes: numeros("BYMONTH"),
  };
}

/** Dias do mês (1..31) que caem num dia da semana; ord>0 conta do início, ord<0 do fim, 0 = todos. */
function diasDoMes(a: number, m: number, dia: number, ord: number): number[] {
  const noMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const primeiro = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  const todos: number[] = [];
  for (let d = 1 + ((dia - primeiro + 7) % 7); d <= noMes; d += 7) todos.push(d);
  if (ord === 0) return todos;
  const alvo = ord > 0 ? todos[ord - 1] : todos[todos.length + ord];
  return alvo === undefined ? [] : [alvo];
}

/**
 * Datas de início (em ms UTC) das ocorrências da série que interessam à
 * janela [janelaDe, janelaAte]. A recorrência é calculada no relógio de
 * parede do calendário: um evento das 14h continua às 14h depois da virada
 * do horário de verão.
 *
 * COUNT é contado desde o começo da série (como manda o RFC), mas só as
 * ocorrências dentro da janela são devolvidas — uma reunião semanal de
 * três anos atrás não enche a lista antes de chegar ao mês pedido.
 */
function ocorrencias(
  inicioMs: number, regra: Regra, fuso: string,
  janelaDe: number, janelaAte: number, teto: number,
): number[] {
  const base = paredeDe(inicioMs, fuso);
  const saida: number[] = [];
  let contador = 0;
  let acabou = false;

  /** Devolve false quando a série terminou (e o laço deve parar). */
  const emite = (a: number, m: number, d: number): boolean => {
    if (regra.porMes.length && !regra.porMes.includes(m)) return true;
    if (d < 1 || d > new Date(Date.UTC(a, m, 0)).getUTCDate()) return true;
    const ms = paredeParaUTC(a, m, d, base.h, base.mi, base.s, fuso);
    if (ms < inicioMs) return true;                          // antes do DTSTART
    if (regra.ate !== null && ms > regra.ate) return false;  // passou do UNTIL
    contador++;
    if (regra.count !== null && contador > regra.count) return false;
    if (ms > janelaAte) return false;                        // passou da janela
    if (ms >= janelaDe) saida.push(ms);
    return saida.length < teto;
  };
  const passo = (a: number, m: number, d: number) => { if (!emite(a, m, d)) acabou = true; };

  let voltas = 0;
  if (regra.freq === "DAILY") {
    for (let n = 0; !acabou && voltas++ < TETO_ITERACOES; n += regra.intervalo) {
      const d = new Date(Date.UTC(base.a, base.m - 1, base.d + n));
      passo(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  } else if (regra.freq === "WEEKLY") {
    const dias = (regra.porDia.length
      ? regra.porDia.map((x) => x.dia)
      : [new Date(Date.UTC(base.a, base.m - 1, base.d)).getUTCDay()]
    ).sort((x, y) => x - y);
    // Domingo da semana do DTSTART, para andar de semana em semana.
    const dom = new Date(Date.UTC(base.a, base.m - 1, base.d));
    dom.setUTCDate(dom.getUTCDate() - dom.getUTCDay());
    for (let n = 0; !acabou && voltas++ < TETO_ITERACOES; n += regra.intervalo) {
      for (const dia of dias) {
        const d = new Date(dom.getTime());
        d.setUTCDate(d.getUTCDate() + n * 7 + dia);
        passo(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        if (acabou) break;
      }
    }
  } else if (regra.freq === "MONTHLY") {
    for (let n = 0; !acabou && voltas++ < TETO_ITERACOES; n += regra.intervalo) {
      const ref = new Date(Date.UTC(base.a, base.m - 1 + n, 1));
      const a = ref.getUTCFullYear(), m = ref.getUTCMonth() + 1;
      const noMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
      let dias: number[];
      if (regra.porDia.length) {
        dias = regra.porDia.flatMap((x) => diasDoMes(a, m, x.dia, x.ord));
      } else if (regra.porDiaDoMes.length) {
        dias = regra.porDiaDoMes.map((x) => (x > 0 ? x : noMes + 1 + x));
      } else {
        dias = [base.d];
      }
      for (const d of [...new Set(dias)].sort((x, y) => x - y)) {
        passo(a, m, d);
        if (acabou) break;
      }
    }
  } else { // YEARLY
    for (let n = 0; !acabou && voltas++ < TETO_ITERACOES; n += regra.intervalo) {
      const a = base.a + n;
      for (const m of (regra.porMes.length ? regra.porMes : [base.m])) {
        const noMes = new Date(Date.UTC(a, m, 0)).getUTCDate();
        const dias = regra.porDiaDoMes.length
          ? regra.porDiaDoMes.map((x) => (x > 0 ? x : noMes + 1 + x))
          : regra.porDia.length
            ? regra.porDia.flatMap((x) => diasDoMes(a, m, x.dia, x.ord))
            : [base.d];
        for (const d of [...new Set(dias)].sort((x, y) => x - y)) {
          passo(a, m, d);
          if (acabou) break;
        }
        if (acabou) break;
      }
    }
  }
  return saida;
}

/* ---------------- leitura do arquivo ---------------- */

interface Evento {
  uid: string | null;
  inicio: Momento | null;
  fim: Momento | null;
  duracao: number | null;
  titulo: string | null;
  rrule: string | null;
  exdatas: number[];
  recorrenciaId: number | null;
  cancelado: boolean;
  livre: boolean;
}

function lerEventos(texto: string, fusoPadrao: string): Evento[] {
  const eventos: Evento[] = [];
  let atual: Evento | null = null;
  let dentroDeFuso = false;

  for (const linha of linhasLogicas(texto)) {
    if (!linha) continue;
    const p = lerProp(linha);
    if (!p) continue;

    // Os blocos VTIMEZONE também têm DTSTART e RRULE: ignore-os.
    if (p.nome === "BEGIN" && p.valor === "VTIMEZONE") { dentroDeFuso = true; continue; }
    if (p.nome === "END" && p.valor === "VTIMEZONE") { dentroDeFuso = false; continue; }
    if (dentroDeFuso) continue;

    if (p.nome === "BEGIN" && p.valor === "VEVENT") {
      atual = { uid: null, inicio: null, fim: null, duracao: null, titulo: null,
                rrule: null, exdatas: [], recorrenciaId: null, cancelado: false, livre: false };
      continue;
    }
    if (p.nome === "END" && p.valor === "VEVENT") {
      if (atual && atual.inicio) eventos.push(atual);
      atual = null;
      continue;
    }
    if (!atual) continue;

    switch (p.nome) {
      case "UID":      atual.uid = p.valor.slice(0, 300); break;
      case "SUMMARY":  atual.titulo = destextar(p.valor).slice(0, 200); break;
      case "DTSTART":  atual.inicio = lerMomento(p, fusoPadrao); break;
      case "DTEND":    atual.fim = lerMomento(p, fusoPadrao); break;
      case "DURATION": atual.duracao = lerDuracao(p.valor); break;
      case "RRULE":    atual.rrule = p.valor; break;
      case "STATUS":   if (p.valor.toUpperCase() === "CANCELLED") atual.cancelado = true; break;
      case "TRANSP":   if (p.valor.toUpperCase() === "TRANSPARENT") atual.livre = true; break;
      case "RECURRENCE-ID": {
        const mo = lerMomento(p, fusoPadrao);
        if (mo) atual.recorrenciaId = mo.ms;
        break;
      }
      case "EXDATE": {
        for (const parte of p.valor.split(",")) {
          const mo = lerMomento({ nome: "EXDATE", params: p.params, valor: parte }, fusoPadrao);
          if (mo) atual.exdatas.push(mo.ms);
        }
        break;
      }
    }
  }
  return eventos;
}

/**
 * Lê um arquivo .ics e devolve os blocos de OCUPAÇÃO dentro da janela.
 * Ficam de fora: eventos cancelados, os marcados como "livre"
 * (TRANSP:TRANSPARENT — é o padrão dos eventos de dia inteiro do Google)
 * e as ocorrências excluídas pela pessoa (EXDATE).
 */
export function blocosDoIcs(texto: string, op: OpcoesLeitura): Bloco[] {
  const fuso = fusoValido(op.fuso) ? op.fuso : "UTC";
  const de = op.de.getTime(), ate = op.ate.getTime();
  const maxBlocos = op.maxBlocos ?? 3000;
  const eventos = lerEventos(texto, fuso);

  // Ocorrências reescritas individualmente ("mover só esta reunião").
  const remarcadas = new Map<string, Set<number>>();
  for (const e of eventos) {
    if (e.uid && e.recorrenciaId !== null) {
      if (!remarcadas.has(e.uid)) remarcadas.set(e.uid, new Set());
      remarcadas.get(e.uid)!.add(e.recorrenciaId);
    }
  }

  const blocos: Bloco[] = [];
  for (const e of eventos) {
    if (e.cancelado || e.livre || !e.inicio) continue;

    let dur: number;
    if (e.fim) dur = e.fim.ms - e.inicio.ms;
    else if (e.duracao !== null) dur = e.duracao;
    else dur = e.inicio.soData ? 86400000 : 3600000;
    if (dur <= 0) dur = e.inicio.soData ? 86400000 : 3600000;

    const regra = e.rrule && e.recorrenciaId === null ? lerRegra(e.rrule, fuso) : null;
    let inicios: number[];
    if (regra) {
      const pulos = remarcadas.get(e.uid ?? "") ?? new Set<number>();
      const exdatas = new Set(e.exdatas);
      inicios = ocorrencias(e.inicio.ms, regra, fuso, de - dur, ate, maxBlocos)
        .filter((ms) => !exdatas.has(ms) && !pulos.has(ms));
    } else {
      inicios = [e.inicio.ms];
    }

    for (const ms of inicios) {
      if (ms + dur <= de || ms >= ate) continue;
      blocos.push({
        inicio: new Date(ms),
        fim: new Date(ms + dur),
        diaInteiro: e.inicio.soData,
        titulo: e.titulo,
        uid: e.uid,
      });
      if (blocos.length >= maxBlocos) return ordenar(blocos);
    }
  }
  return ordenar(blocos);
}

function ordenar(b: Bloco[]): Bloco[] {
  return b.sort((x, y) => x.inicio.getTime() - y.inicio.getTime());
}

/* ============================================================
   PARTE 2 — A EDGE FUNCTION
   ============================================================ */

/** Janela sincronizada: uma semana para trás, dois meses para frente. */
const DIAS_ATRAS = 7;
const DIAS_ADIANTE = 60;
/** Só links destes hosts são buscados. Ampliar aqui e na regex do soma_v12.sql. */
const HOSTS = ["calendar.google.com", "www.google.com"];
const TIMEOUT_MS = 20_000;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_BLOCOS = 3000;
const LOTE = 500;
const PARALELAS = 5;

const env = (nome: string): string =>
  (globalThis as { Deno?: { env: { get(k: string): string | undefined } } })
    .Deno?.env.get(nome) ?? "";

const URL_BASE = env("SUPABASE_URL");
const CHAVE_SERVICO = env("SUPABASE_SERVICE_ROLE_KEY");
const CHAVE_ANON = env("SUPABASE_ANON_KEY");

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function resposta(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

/* ---------------- acesso ao banco (PostgREST, service role) ---------------- */

async function rest(caminho: string, init: RequestInit = {}): Promise<Response> {
  return await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: {
      apikey: CHAVE_SERVICO,
      Authorization: `Bearer ${CHAVE_SERVICO}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function consultar<T>(caminho: string): Promise<T[]> {
  const r = await rest(caminho);
  if (!r.ok) throw new Error(`banco (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return await r.json() as T[];
}

/* ---------------- quem está chamando ---------------- */

interface Chamador { registro: number | null; papel: string; servico: boolean; }

async function identificar(req: Request): Promise<Chamador | null> {
  const cabecalho = req.headers.get("Authorization") ?? "";
  const token = cabecalho.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  if (CHAVE_SERVICO && token === CHAVE_SERVICO) {
    return { registro: null, papel: "servico", servico: true };
  }
  const r = await fetch(`${URL_BASE}/auth/v1/user`, {
    headers: { apikey: CHAVE_ANON || CHAVE_SERVICO, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return null;
  const usuario = await r.json() as { id?: string };
  if (!usuario.id) return null;
  const perfis = await consultar<{ registro: number | null; papel: string | null }>(
    `perfis?id=eq.${encodeURIComponent(usuario.id)}&select=registro,papel&limit=1`);
  if (!perfis.length) return null;
  return {
    registro: perfis[0].registro ?? null,
    papel: perfis[0].papel ?? "leitura",
    servico: false,
  };
}

/* ---------------- sincronização de uma agenda ---------------- */

interface Agenda { registro: number; fuso: string; compartilha_titulos: boolean; }

async function baixarIcs(url: string): Promise<string> {
  let alvo: URL;
  try { alvo = new URL(url); } catch { throw new Error("Link inválido."); }
  if (alvo.protocol !== "https:" || !HOSTS.includes(alvo.hostname)) {
    throw new Error("Link fora do Google Agenda. Use o endereço secreto em formato iCal.");
  }
  const corta = AbortSignal.timeout ? AbortSignal.timeout(TIMEOUT_MS) : undefined;
  const r = await fetch(alvo.toString(), {
    redirect: "follow",
    headers: { Accept: "text/calendar, text/plain" },
    signal: corta,
  });
  if (r.status === 404 || r.status === 401 || r.status === 403) {
    throw new Error("O Google recusou o link (" + r.status +
      "). Ele pode ter sido redefinido — copie o endereço secreto de novo.");
  }
  if (!r.ok) throw new Error(`O Google respondeu ${r.status}.`);
  const tamanho = Number(r.headers.get("content-length") ?? 0);
  if (tamanho > MAX_BYTES) throw new Error("Calendário grande demais para sincronizar.");
  const texto = (await r.text()).slice(0, MAX_BYTES);
  if (!texto.includes("BEGIN:VCALENDAR")) {
    throw new Error("O link não devolveu um calendário iCal.");
  }
  return texto;
}

async function sincronizar(agenda: Agenda, url: string, de: Date, ate: Date) {
  const texto = await baixarIcs(url);
  const fuso = fusoValido(agenda.fuso) ? agenda.fuso : "America/Sao_Paulo";
  const blocos = blocosDoIcs(texto, { fuso, de, ate, maxBlocos: MAX_BLOCOS });

  const apagar = await rest(`portal_agenda_blocos?registro=eq.${agenda.registro}`, { method: "DELETE" });
  if (!apagar.ok) throw new Error(`ao limpar os blocos: ${(await apagar.text()).slice(0, 200)}`);

  const linhas = blocos.map((b) => ({
    registro: agenda.registro,
    inicio: b.inicio.toISOString(),
    fim: b.fim.toISOString(),
    dia_inteiro: b.diaInteiro,
    titulo: agenda.compartilha_titulos ? b.titulo : null,
    uid: b.uid,
  }));
  for (let i = 0; i < linhas.length; i += LOTE) {
    const gravar = await rest("portal_agenda_blocos", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(linhas.slice(i, i + LOTE)),
    });
    if (!gravar.ok) throw new Error(`ao gravar os blocos: ${(await gravar.text()).slice(0, 200)}`);
  }
  return linhas.length;
}

async function anotar(registro: number, blocos: number | null, erro: string | null) {
  await rest(`portal_agendas?registro=eq.${registro}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      ultima_sync: new Date().toISOString(),
      ultimo_erro: erro ? erro.slice(0, 400) : null,
      blocos_sync: blocos,
    }),
  });
}

/* ---------------- entrada ---------------- */

async function servir(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return resposta({ erro: "Use POST." }, 405);
  if (!URL_BASE || !CHAVE_SERVICO) {
    return resposta({ erro: "Função sem SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY." }, 500);
  }

  const quem = await identificar(req);
  if (!quem) return resposta({ erro: "Sessão inválida." }, 401);

  let pedido: { registro?: number; todos?: boolean } = {};
  try { pedido = await req.json(); } catch { /* corpo vazio = sincroniza a própria */ }

  const gestor = quem.servico || ["admin", "pessoal"].includes(quem.papel);
  let filtro: string;
  if (pedido.todos) {
    if (!gestor) return resposta({ erro: "Só o Depto. de Pessoal sincroniza todas as agendas." }, 403);
    filtro = "";
  } else {
    const alvo = pedido.registro ?? quem.registro;
    if (alvo == null) {
      return resposta({ erro: "Sua conta ainda não está vinculada a um registro de membro." }, 400);
    }
    if (alvo !== quem.registro && !gestor) {
      return resposta({ erro: "Você só pode sincronizar a sua própria agenda." }, 403);
    }
    filtro = `&registro=eq.${alvo}`;
  }

  const agendas = await consultar<Agenda>(
    `portal_agendas?select=registro,fuso,compartilha_titulos&conectado=is.true&ativo=is.true${filtro}`);
  if (!agendas.length) {
    return resposta({ ok: true, sincronizadas: 0, resultados: [],
      aviso: "Nenhuma agenda conectada e ativa para sincronizar." });
  }

  const agora = Date.now();
  const de = new Date(agora - DIAS_ATRAS * 86400000);
  const ate = new Date(agora + DIAS_ADIANTE * 86400000);

  const registros = agendas.map((a) => a.registro);
  const segredos = await consultar<{ registro: number; ics_url: string }>(
    `portal_agenda_segredo?select=registro,ics_url&registro=in.(${registros.join(",")})`);
  const links = new Map(segredos.map((s) => [s.registro, s.ics_url]));

  const resultados: { registro: number; blocos: number | null; erro: string | null }[] = [];
  for (let i = 0; i < agendas.length; i += PARALELAS) {
    await Promise.all(agendas.slice(i, i + PARALELAS).map(async (agenda) => {
      const url = links.get(agenda.registro);
      if (!url) {
        await anotar(agenda.registro, null, "Nenhum link .ics guardado.");
        resultados.push({ registro: agenda.registro, blocos: null, erro: "sem link" });
        return;
      }
      try {
        const n = await sincronizar(agenda, url, de, ate);
        await anotar(agenda.registro, n, null);
        resultados.push({ registro: agenda.registro, blocos: n, erro: null });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await anotar(agenda.registro, null, msg);
        resultados.push({ registro: agenda.registro, blocos: null, erro: msg });
      }
    }));
  }

  resultados.sort((a, b) => a.registro - b.registro);
  return resposta({
    ok: true,
    janela: { de: de.toISOString(), ate: ate.toISOString() },
    sincronizadas: resultados.filter((r) => !r.erro).length,
    falhas: resultados.filter((r) => r.erro).length,
    resultados,
  });
}

const servidor = (globalThis as { Deno?: { serve(h: (r: Request) => Promise<Response>): unknown } }).Deno;
servidor?.serve(async (req: Request) => {
  try {
    return await servir(req);
  } catch (e) {
    return resposta({ erro: e instanceof Error ? e.message : String(e) }, 500);
  }
});
