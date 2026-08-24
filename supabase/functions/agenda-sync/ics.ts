/* ============================================================
   ics.ts — leitura de calendários iCalendar (RFC 5545)
   Portal do Membro · NeuroDynamics

   Só o suficiente para responder "quando essa pessoa está
   ocupada": desdobra as recorrências dentro de uma janela e
   devolve blocos de início/fim em UTC. Não guarda convidados,
   descrição, local nem anexo — nada disso chega ao banco.
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
