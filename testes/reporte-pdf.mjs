/* R5: o painel da semana e o PDF do reporte unificado (modelo por liderança). Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(op, hash){
  const ctx = await nav.newContext({ viewport:{ width:1440, height:960 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-09T15:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub.replace("papel:'admin'", "papel:'lideranca'") }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(o => { window.__teste = { reporteLider:o }; }, op);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }

try{
  {
    const t = await abrir({ consolidado:true }, '#/servicos/reporte/painel'), { p } = t;
    await p.waitForSelector('#rep-painel-tabela');
    const m = await p.locator('.metricas .metrica').allInnerTexts();
    confere('as métricas: lideranças, enviados, atrasados, ausentes, pendentes', m.length === 5 && m[0].includes('2') && /Pendentes\s*1/i.test(m[4].replace(/\n/g, ' ')), m);
    confere('duas lideranças, com a situação', await p.locator('#rep-painel-tabela tbody tr').count() === 2
      && /ausente/i.test(await p.locator('#rep-painel-tabela').innerText()));

    const [dl] = await Promise.all([p.waitForEvent('download', { timeout:20000 }), p.getByRole('button', { name:'Baixar o reporte unificado' }).click()]);
    confere('o PDF é gerado com o nome da semana', dl.suggestedFilename().startsWith('Reporte semanal'), dl.suggestedFilename());
    const txt = await p.evaluate(() => window.__docnro && window.__docnro.textos.join(' ').replace(/\s+/g, ' '));
    confere('o PDF traz Bruno, Carla, o escalonamento e o card atrasado', !!txt && ['Bruno Tavares', 'Carla Mendonça', 'Falta verba para a bancada', 'ORT-2'].every(x => txt.includes(x)), txt?.slice(0, 200));
    confere('e nunca "Registro 11"', !!txt && !/Registro 11/.test(txt));
    confere('as seções em tabelas', ['Cobertura', 'Apontamentos', 'Escalonamentos', 'Atividades atrasadas', 'Divulgação'].every(x => txt.includes(x)));
    await fechar(t);
  }
  {
    const t = await abrir({}, '#/servicos/reporte/painel'), { p } = t;
    await p.waitForFunction(() => location.hash === '#/servicos/reporte' || location.hash.startsWith('#/servicos/reporte/1'));
    confere('sem permissão, volta para o reporte', !(await p.evaluate(() => location.hash)).includes('painel'));
    await fechar(t);
  }
  {
    const t = await abrir({ consolidado:true }, '#/servicos/reporte/1'), { p } = t;
    await p.waitForSelector('a[href="#/servicos/reporte/painel"]');
    confere('o líder com permissão vê "Painel da semana"', true);
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
