/* ============================================================
   ics-feed.test.ts — conferência do gerador do feed
   Rode com Node 22+:  node --experimental-strip-types ics-feed.test.ts
   ============================================================ */
import { paraUTC, dobrar, vevento, texto } from "./index.ts";

let falhas = 0;
const ok = (n: string, c: boolean, extra = "") => {
  console.log((c ? "  ok  " : " FAIL ") + n + (c ? "" : "  << " + extra));
  if (!c) falhas++;
};
const base: Record<string, unknown> = {
  id: "ev:1", origem: "evento", ref: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  categoria: "reuniao", tipo: "Follow-up", titulo: "Follow-up Órion",
  data_inicio: "2026-09-01", data_fim: "2026-09-01",
  hora_inicio: "10:00:00", hora_fim: "10:30:00", dia_inteiro: false,
  local: "Sala 2", meet_url: null, pauta: null, numero: 4, recorrencia: "Única",
  registro: 1, minha_resposta: "vou", convidados: 3, confirmados: 2,
};
const linhas = (o: Record<string, unknown>) => vevento({ ...base, ...o } as never);
const acha = (ls: string[], p: string) => ls.find((l) => l.startsWith(p)) ?? "";

/* 1 — horário local vira UTC (São Paulo, UTC-3) */
ok("1 10:00 em São Paulo = 13:00Z", paraUTC("2026-09-01", "10:00").toISOString() === "2026-09-01T13:00:00.000Z",
   paraUTC("2026-09-01", "10:00").toISOString());

/* 2 — evento com hora */
let l = linhas({});
ok("2 DTSTART/DTEND em UTC", acha(l, "DTSTART:") === "DTSTART:20260901T130000Z" && acha(l, "DTEND:") === "DTEND:20260901T133000Z",
   acha(l, "DTSTART:") + " / " + acha(l, "DTEND:"));
ok("3 UID estável por item", acha(l, "UID:") === `UID:evento-${base.ref as string}@membro.neurodynamics.dev`, acha(l, "UID:"));
ok("4 evento ocupa a agenda", l.includes("TRANSP:OPAQUE"));
ok("5 local vira LOCATION", acha(l, "LOCATION:") === "LOCATION:Sala 2");

/* 3 — dia inteiro usa VALUE=DATE e fim exclusivo */
l = linhas({ dia_inteiro: true, hora_inicio: null, hora_fim: null,
             data_inicio: "2026-09-01", data_fim: "2026-09-05", origem: "ausencia", titulo: "Férias" });
ok("6 dia inteiro 01→05 termina em 06", acha(l, "DTSTART;VALUE=DATE:") === "DTSTART;VALUE=DATE:20260901"
   && acha(l, "DTEND;VALUE=DATE:") === "DTEND;VALUE=DATE:20260906",
   acha(l, "DTSTART;VALUE=DATE:") + " / " + acha(l, "DTEND;VALUE=DATE:"));
ok("7 ausência não bloqueia a agenda de quem vê", l.includes("TRANSP:TRANSPARENT"));

/* 4 — evento sem hora de fim ganha uma hora */
l = linhas({ hora_fim: null });
ok("8 sem fim = 1 hora", acha(l, "DTEND:") === "DTEND:20260901T140000Z", acha(l, "DTEND:"));

/* 5 — "talvez" vira TENTATIVE */
ok("9 RSVP talvez = TENTATIVE", linhas({ minha_resposta: "talvez" }).includes("STATUS:TENTATIVE"));

/* 6 — meet vira URL e entra na descrição */
l = linhas({ meet_url: "https://meet.google.com/abc-defg-hij" });
ok("10 link da chamada em URL", acha(l, "URL:") === "URL:https://meet.google.com/abc-defg-hij");
ok("11 link da chamada na descrição", acha(l, "DESCRIPTION:").includes("meet.google.com"));

/* 7 — escapes do RFC 5545 */
ok("12 escapa ; , \\ e quebra de linha",
   texto("a;b,c\\d\ne") === "a\\;b\\,c\\\\d\\ne", JSON.stringify(texto("a;b,c\\d\ne")));

/* 8 — dobra de linha em 75 octetos, contando acentos como 2 */
const longa = "DESCRIPTION:" + "ação ".repeat(30);
const dobrada = dobrar(longa).split("\r\n");
const enc = new TextEncoder();
ok("13 nenhuma linha passa de 75 octetos", dobrada.every((x) => enc.encode(x).length <= 75),
   JSON.stringify(dobrada.map((x) => enc.encode(x).length)));
ok("14 continuações começam com espaço", dobrada.slice(1).every((x) => x.startsWith(" ")));
ok("15 dobrar não perde conteúdo",
   dobrada.map((x, i) => (i ? x.slice(1) : x)).join("") === longa);

/* 9 — linha curta não é tocada */
ok("16 linha curta intacta", dobrar("SUMMARY:Daily") === "SUMMARY:Daily");

console.log(falhas ? `\n${falhas} FALHA(S)` : "\nTODOS OS TESTES DO FEED PASSARAM");
if (falhas) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
