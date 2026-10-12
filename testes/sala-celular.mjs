/* 2.19.2: a sala do LABBIO no celular (#/sala/<id>), aberta pelo QR do tablet.
   A sala na cor da situação, quem reservou, usar agora, reservar um horário (a agenda já com a sala),
   arrastar para liberar e as outras salas, menores. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){ checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`); if (!ok) falhas++; }
async function abrir(hash, estado = 'livre'){
  const ctx = await nav.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, timezoneId:'America/Sao_Paulo' }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.install({ time:new Date('2026-10-11T13:30:00Z') });
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(e => { window.__teste = { salaM:{ estado:e } }; }, estado);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
const fim = async ({ ctx, p, erros }) => {
  confere('sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  confere('sem erro de página', !erros.length, erros); await ctx.close();
};
async function arrastar(p){
  const b = await p.locator('.deslizar-bt').boundingBox(), c = await p.locator('.deslizar').boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(b.x + b.width / 2 + (c.width - b.width) * i / 8, b.y + b.height / 2);
  await p.mouse.up();
}
try {
  {
    const t = await abrir('#/sala/2'), { p } = t;
    await p.waitForSelector('.salam-cartao');
    confere('a sala, livre, com o dia no "até"', await p.locator('.salam-nome').innerText() === 'Auditório' && await p.locator('.salam-status').innerText() === 'Livre'
      && await p.locator('.salam-ate').innerText() === 'até hoje, 14:00' && await p.locator('.salam-cartao').getAttribute('data-estado') === 'livre');
    confere('hoje nesta sala, com a reserva do LABBIO marcada', (await p.locator('.salam-hoje').innerText()).includes('Reserva do LABBIO, para Prof. Helena')
      && (await p.locator('.salam-hoje').innerText()).includes('LABBIO') && (await p.locator('.salam-hoje').innerText()).includes('Ana Figueiredo'));
    confere('as outras salas, menores', (await p.locator('.salam-outras li').count()) === 2 && (await p.locator('.salam-outras').innerText()).includes('Em uso, até hoje, 13:00'));
    confere('reservar abre a agenda já com a sala', /^#\/agenda\/novo\/2026-10-11T10:(30|45)~11:(30|45)@2$/.test(await p.locator('.salam-reservar').getAttribute('href')),
      await p.locator('.salam-reservar').getAttribute('href'));
    await p.getByRole('button', { name:'1 hora' }).click();
    await p.waitForFunction(() => document.querySelector('.salam-status')?.textContent === 'Ocupada');
    confere('usar agora por 1 hora', await p.evaluate(() => window.__rpcs.some(x => x.nome === 'sala_ocupar_membro' && x.p.p_minutos === 60 && x.p.p_espaco === 2))
      && (await p.locator('.salam-quem').innerText()).includes('Ana Figueiredo') && await p.locator('.salam-msg').innerText() === 'Pronto: a sala está com você.');
    await arrastar(p);
    await p.waitForFunction(() => document.querySelector('.salam-status')?.textContent === 'Livre');
    confere('arrastar até o fim libera pelo celular', await p.evaluate(() => window.__rpcs.some(x => x.nome === 'sala_liberar_membro')));
    await p.locator('.salam-outras a').first().click();
    await p.waitForFunction(() => document.querySelector('.salam-status'));
    confere('tocar noutra sala abre a dela', await p.evaluate(() => location.hash) === '#/sala/1');
    await fim(t);
  }
  {
    const t = await abrir('#/sala/2', 'evento'), { p } = t;
    await p.waitForSelector('.salam-cartao');
    confere('em uso: o título e quem reservou, sem usar agora', (await p.locator('.salam-ev').innerText()).includes('Reservado por Bruno Tavares')
      && await p.getByRole('button', { name:'1 hora' }).count() === 0 && await p.locator('.deslizar').count() === 0);
    await fim(t);
  }
  {
    const t = await abrir('#/sala/99'), { p } = t;
    await p.waitForSelector('.vazio');
    confere('sala fora do LABBIO', (await p.locator('.vazio').innerText()).includes('não está no LABBIO')); await fim(t);
  }
  {
    const t = await abrir('#/agenda/novo/2026-10-11T10:30~11:30@2'), { p } = t;
    await p.waitForSelector('#ev-esp');
    confere('a agenda abre com a sala escolhida', await p.locator('#ev-esp').inputValue() === '2' && await p.locator('#ev-hi').inputValue() === '10:30', await p.locator('#ev-esp').inputValue());
    await fim(t);
  }
  if (process.env.SALA_CAPTURAS){
    mkdirSync(process.env.SALA_CAPTURAS, { recursive:true });
    for (const e of ['livre', 'evento']){ const t = await abrir('#/sala/2', e); await t.p.waitForSelector('.salam-cartao'); await t.p.screenshot({ path:`${process.env.SALA_CAPTURAS}/celular-${e}.png`, fullPage:true }); await t.ctx.close(); }
  }
} finally { await nav.close(); }
console.log(falhas ? `\n${falhas} falha(s) em ${checks} verificações.` : `\nTudo certo. ${checks} verificações passaram.`); process.exitCode = falhas ? 1 : 0;
