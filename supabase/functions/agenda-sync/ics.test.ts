/* ============================================================
   ics.test.ts — conferência do leitor de .ics
   Rode com Node 22+ (sem instalar nada):
     node --experimental-strip-types ics.test.ts
   ou com Deno:
     deno run ics.test.ts
   ============================================================ */
import { blocosDoIcs } from './ics.ts';

const TZ = 'America/Sao_Paulo';
const local = (d: Date) => d.toLocaleString('sv-SE', { timeZone: TZ });
let falhas = 0;
function ok(nome: string, cond: boolean, extra = '') {
  console.log((cond ? '  ok  ' : ' FAIL ') + nome + (cond ? '' : '  << ' + extra));
  if (!cond) falhas++;
}
const env = (corpo: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Google Inc//Google Calendar 70.9054//EN\r\n${corpo}\r\nEND:VCALENDAR\r\n`;
const ler = (corpo: string, de = '2026-08-24T00:00:00-03:00', ate = '2026-08-31T00:00:00-03:00') =>
  blocosDoIcs(env(corpo), { fuso: TZ, de: new Date(de), ate: new Date(ate) });

/* 1 — evento simples com TZID */
let b = ler(`BEGIN:VEVENT\r\nUID:a1\r\nSUMMARY:Aula de Sinais\r\nDTSTART;TZID=America/Sao_Paulo:20260824T140000\r\nDTEND;TZID=America/Sao_Paulo:20260824T160000\r\nEND:VEVENT`);
ok('1 evento com TZID', b.length === 1 && local(b[0].inicio) === '2026-08-24 14:00:00' && local(b[0].fim) === '2026-08-24 16:00:00', JSON.stringify(b));

/* 2 — evento em UTC (Z) */
b = ler(`BEGIN:VEVENT\r\nUID:a2\r\nSUMMARY:Call\r\nDTSTART:20260824T170000Z\r\nDTEND:20260824T173000Z\r\nEND:VEVENT`);
ok('2 evento em UTC vira 14:00 local', b.length === 1 && local(b[0].inicio) === '2026-08-24 14:00:00', local(b[0]?.inicio));

/* 3 — dia inteiro TRANSPARENT (padrão do Google) fica de fora */
b = ler(`BEGIN:VEVENT\r\nUID:a3\r\nSUMMARY:Feriado\r\nDTSTART;VALUE=DATE:20260825\r\nDTEND;VALUE=DATE:20260826\r\nTRANSP:TRANSPARENT\r\nEND:VEVENT`);
ok('3 dia inteiro "livre" e ignorado', b.length === 0, JSON.stringify(b));

/* 4 — dia inteiro OPAQUE ocupa o dia todo no fuso do dono */
b = ler(`BEGIN:VEVENT\r\nUID:a4\r\nSUMMARY:Viagem\r\nDTSTART;VALUE=DATE:20260825\r\nDTEND;VALUE=DATE:20260827\r\nTRANSP:OPAQUE\r\nEND:VEVENT`);
ok('4 dia inteiro ocupado 25→27', b.length === 1 && b[0].diaInteiro && local(b[0].inicio) === '2026-08-25 00:00:00' && local(b[0].fim) === '2026-08-27 00:00:00', JSON.stringify(b.map(x => [local(x.inicio), local(x.fim)])));

/* 5 — semanal BYDAY=MO,WE */
b = ler(`BEGIN:VEVENT\r\nUID:a5\r\nSUMMARY:Daily\r\nDTSTART;TZID=America/Sao_Paulo:20260601T090000\r\nDTEND;TZID=America/Sao_Paulo:20260601T093000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nEND:VEVENT`);
ok('5 semanal seg+qua = 2 na semana', b.length === 2 && local(b[0].inicio) === '2026-08-24 09:00:00' && local(b[1].inicio) === '2026-08-26 09:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 6 — EXDATE remove a ocorrência */
b = ler(`BEGIN:VEVENT\r\nUID:a6\r\nSUMMARY:Daily\r\nDTSTART;TZID=America/Sao_Paulo:20260601T090000\r\nDTEND;TZID=America/Sao_Paulo:20260601T093000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO,WE\r\nEXDATE;TZID=America/Sao_Paulo:20260826T090000\r\nEND:VEVENT`);
ok('6 EXDATE tira a quarta', b.length === 1 && local(b[0].inicio) === '2026-08-24 09:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 7 — RECURRENCE-ID: a ocorrência remarcada substitui a original */
b = ler(`BEGIN:VEVENT\r\nUID:a7\r\nSUMMARY:1:1\r\nDTSTART;TZID=America/Sao_Paulo:20260601T090000\r\nDTEND;TZID=America/Sao_Paulo:20260601T093000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:a7\r\nRECURRENCE-ID;TZID=America/Sao_Paulo:20260824T090000\r\nSUMMARY:1:1 (remarcada)\r\nDTSTART;TZID=America/Sao_Paulo:20260824T150000\r\nDTEND;TZID=America/Sao_Paulo:20260824T153000\r\nEND:VEVENT`);
ok('7 ocorrência remarcada', b.length === 1 && local(b[0].inicio) === '2026-08-24 15:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 8 — cancelado sai */
b = ler(`BEGIN:VEVENT\r\nUID:a8\r\nSUMMARY:X\r\nSTATUS:CANCELLED\r\nDTSTART;TZID=America/Sao_Paulo:20260824T100000\r\nDTEND;TZID=America/Sao_Paulo:20260824T110000\r\nEND:VEVENT`);
ok('8 cancelado ignorado', b.length === 0);

/* 9 — série diária antiga: só a janela, sem estourar o teto */
b = ler(`BEGIN:VEVENT\r\nUID:a9\r\nSUMMARY:Standup\r\nDTSTART;TZID=America/Sao_Paulo:20200106T093000\r\nDTEND;TZID=America/Sao_Paulo:20200106T094500\r\nRRULE:FREQ=DAILY\r\nEND:VEVENT`);
ok('9 diária desde 2020 = 7 na semana', b.length === 7 && local(b[0].inicio) === '2026-08-24 09:30:00', String(b.length));

/* 10 — mensal 2ª terça */
b = ler(`BEGIN:VEVENT\r\nUID:a10\r\nSUMMARY:Conselho\r\nDTSTART;TZID=America/Sao_Paulo:20260113T190000\r\nDTEND;TZID=America/Sao_Paulo:20260113T200000\r\nRRULE:FREQ=MONTHLY;BYDAY=2TU\r\nEND:VEVENT`, '2026-09-01T00:00:00-03:00', '2026-09-30T00:00:00-03:00');
ok('10 mensal 2ª terça = 08/09', b.length === 1 && local(b[0].inicio) === '2026-09-08 19:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 11 — linha dobrada + escapes */
b = ler(`BEGIN:VEVENT\r\nUID:a11\r\nSUMMARY:Reunião muito long\r\n a de planejamento\\, com vírgula\r\nDTSTART;TZID=America/Sao_Paulo:20260824T110000\r\nDTEND;TZID=America/Sao_Paulo:20260824T120000\r\nEND:VEVENT`);
ok('11 dobra de linha e escape', b.length === 1 && b[0].titulo === 'Reunião muito longa de planejamento, com vírgula', JSON.stringify(b[0]?.titulo));

/* 12 — DURATION no lugar de DTEND */
b = ler(`BEGIN:VEVENT\r\nUID:a12\r\nSUMMARY:Curto\r\nDTSTART;TZID=America/Sao_Paulo:20260824T110000\r\nDURATION:PT45M\r\nEND:VEVENT`);
ok('12 DURATION PT45M', b.length === 1 && (b[0].fim.getTime() - b[0].inicio.getTime()) === 45 * 60000);

/* 13 — VTIMEZONE não vira evento */
b = ler(`BEGIN:VTIMEZONE\r\nTZID:America/Sao_Paulo\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nRRULE:FREQ=YEARLY;BYMONTH=2;BYDAY=3SU\r\nTZOFFSETFROM:-0200\r\nTZOFFSETTO:-0300\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:a13\r\nSUMMARY:Ok\r\nDTSTART;TZID=America/Sao_Paulo:20260824T080000\r\nDTEND;TZID=America/Sao_Paulo:20260824T083000\r\nEND:VEVENT`);
ok('13 VTIMEZONE ignorado', b.length === 1 && b[0].titulo === 'Ok', JSON.stringify(b.map(x => x.titulo)));

/* 14 — horário de verão: 9h locais em Lisboa antes e depois da virada */
const bl = blocosDoIcs(env(`BEGIN:VEVENT\r\nUID:a14\r\nSUMMARY:Standup\r\nDTSTART;TZID=Europe/Lisbon:20261019T090000\r\nDTEND;TZID=Europe/Lisbon:20261019T093000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO\r\nEND:VEVENT`),
  { fuso: 'Europe/Lisbon', de: new Date('2026-10-19T00:00:00Z'), ate: new Date('2026-11-09T00:00:00Z') });
const lisboa = bl.map(x => x.inicio.toLocaleString('sv-SE', { timeZone: 'Europe/Lisbon' }));
const utc = bl.map(x => x.inicio.toISOString().slice(11, 16));
ok('14 DST: 9h locais nas 3 semanas', lisboa.every(x => x.endsWith('09:00:00')) && utc[0] === '08:00' && utc[2] === '09:00', JSON.stringify([lisboa, utc]));

/* 15 — evento que começa antes da janela e termina dentro dela */
b = ler(`BEGIN:VEVENT\r\nUID:a15\r\nSUMMARY:Congresso\r\nDTSTART;TZID=America/Sao_Paulo:20260820T080000\r\nDTEND;TZID=America/Sao_Paulo:20260825T180000\r\nEND:VEVENT`);
ok('15 evento atravessa a janela', b.length === 1, JSON.stringify(b.length));

/* 16 — COUNT encerra a série */
b = ler(`BEGIN:VEVENT\r\nUID:a16\r\nSUMMARY:Curso\r\nDTSTART;TZID=America/Sao_Paulo:20260810T190000\r\nDTEND;TZID=America/Sao_Paulo:20260810T210000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO;COUNT=2\r\nEND:VEVENT`);
ok('16 COUNT=2 já esgotado em 24/08', b.length === 0, JSON.stringify(b.map(x => local(x.inicio))));

/* 17 — UNTIL encerra a série */
b = ler(`BEGIN:VEVENT\r\nUID:a17\r\nSUMMARY:Curso\r\nDTSTART;TZID=America/Sao_Paulo:20260601T190000\r\nDTEND;TZID=America/Sao_Paulo:20260601T210000\r\nRRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20260825T000000Z\r\nEND:VEVENT`);
ok('17 UNTIL 25/08 deixa só 24/08', b.length === 1 && local(b[0].inicio) === '2026-08-24 19:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 18 — quinzenal (INTERVAL=2) */
b = ler(`BEGIN:VEVENT\r\nUID:a18\r\nSUMMARY:Quinzenal\r\nDTSTART;TZID=America/Sao_Paulo:20260810T140000\r\nDTEND;TZID=America/Sao_Paulo:20260810T150000\r\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO\r\nEND:VEVENT`);
ok('18 quinzenal cai em 24/08', b.length === 1 && local(b[0].inicio) === '2026-08-24 14:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 19 — data flutuante usa o fuso do dono */
b = ler(`BEGIN:VEVENT\r\nUID:a19\r\nSUMMARY:Flutuante\r\nDTSTART:20260824T100000\r\nDTEND:20260824T110000\r\nEND:VEVENT`);
ok('19 data flutuante no fuso do dono', b.length === 1 && local(b[0].inicio) === '2026-08-24 10:00:00', JSON.stringify(b.map(x => local(x.inicio))));

/* 20 — mensal último dia útil-ish (BYMONTHDAY=-1) */
b = ler(`BEGIN:VEVENT\r\nUID:a20\r\nSUMMARY:Fechamento\r\nDTSTART;TZID=America/Sao_Paulo:20260131T170000\r\nDTEND;TZID=America/Sao_Paulo:20260131T180000\r\nRRULE:FREQ=MONTHLY;BYMONTHDAY=-1\r\nEND:VEVENT`, '2026-09-01T00:00:00-03:00', '2026-10-01T00:00:00-03:00');
ok('20 BYMONTHDAY=-1 = 30/09', b.length === 1 && local(b[0].inicio) === '2026-09-30 17:00:00', JSON.stringify(b.map(x => local(x.inicio))));

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
if (falhas) (globalThis as { process?: { exitCode?: number } }).process!.exitCode = 1;
