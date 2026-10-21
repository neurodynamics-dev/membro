/* 2.19.2: o ensaio do onboarding (tour.html?ensaio). A jornada de quem chega, com uma pessoa simulada:
   nenhuma chamada ao Supabase de verdade, o painel troca a pessoa e os fatos, e a trilha anda como na vida real. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){ checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`); if (!ok) falhas++; }
async function abrir(busca = '?ensaio', vp = { width:1280, height:900 }){
  const ctx = await nav.newContext({ viewport:vp }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = [], reais = [];
  p.on('pageerror', e => erros.push(e.message));
  // o Supabase de verdade nunca pode ser chamado no ensaio
  await p.route(/supabase\.co/, r => { reais.push(r.request().url()); r.abort(); });
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.goto('http://localhost:8765/tour.html' + busca, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#ensaio');
  await p.waitForTimeout(600);
  return { ctx, p, erros, reais };
}
const fim = async ({ ctx, erros, reais }) => { confere('sem chamada ao Supabase de verdade', !reais.length, reais); confere('sem erro de página', !erros.length, erros); await ctx.close(); };
const sit = p => p.locator('.ens-sit').innerText();
try {
  {
    const t = await abrir('?ensaio=visitante#conta'), { p } = t;
    confere('o painel do ensaio aparece, avisando que nada é gravado', (await p.locator('#ensaio').innerText()).includes('Nada é lido nem gravado'));
    confere('visitante: sem conta', await sit(p) === 'Sem conta.');
    await p.waitForSelector('#f-criar');
    await p.fill('#c-email', 'nova.pessoa@exemplo.com'); await p.fill('#c-senha', 'senha-forte-1'); await p.fill('#c-senha2', 'senha-forte-1');
    await p.click('#c-btn'); await p.waitForTimeout(400);
    confere('criar a conta leva a "confirme o e-mail"', await sit(p) === 'Conta criada, falta confirmar o e-mail.'
      && await p.locator('[data-acao="confirmar"]').count() === 1);
    await Promise.all([p.waitForEvent('load'), p.click('[data-acao="confirmar"]')]); await p.waitForSelector('#ensaio'); await p.waitForTimeout(500);
    confere('confirmar o e-mail abre a conta, ainda sem vínculo', await sit(p) === 'Conta aberta, sem vínculo com o quadro.');
    await Promise.all([p.waitForEvent('load'), p.click('[data-acao="vincular"]')]); await p.waitForSelector('#ensaio'); await p.waitForTimeout(800);
    confere('o Pessoal liga a conta: a trilha do servidor começa do zero', await sit(p) === 'Trilha: 0 de 7 etapas.'
      && (await p.locator('[data-missao]').first().innerText()).includes('0 de 7'));
    await fim(t);
  }
  {
    const t = await abrir('?ensaio=novo#bem-vindo'), { p } = t;
    await p.waitForSelector('[data-onb="contexto"]');
    await p.click('[data-onb="contexto"]'); await p.waitForTimeout(400);
    confere('marcar uma leitura anda a trilha (só no ensaio)', await sit(p) === 'Trilha: 1 de 7 etapas.'
      && (await p.locator('[data-missao]').first().innerText()).includes('1 de 7'));
    await Promise.all([p.waitForEvent('load'), p.check('[data-fato="dados"]')]); await p.waitForSelector('#ensaio'); await p.waitForTimeout(800);
    confere('ligar um fato (dados conferidos) conta na trilha', await sit(p) === 'Trilha: 2 de 7 etapas.');
    confere('as marcas do tour ficam à parte, com o prefixo do ensaio', await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('nd.tour')).length === 0));
    await Promise.all([p.waitForEvent('load'), p.selectOption('#ens-pessoa', 'concluido')]); await p.waitForSelector('#ensaio'); await p.waitForTimeout(800);
    confere('a pessoa "tudo feito" tem a trilha completa', await sit(p) === 'Trilha: 7 de 7 etapas.');
    await Promise.all([p.waitForEvent('load'), p.selectOption('#ens-pessoa', 'novo')]); await p.waitForSelector('#ensaio'); await p.waitForTimeout(800);
    confere('voltar para "membro novo" zera tudo', await sit(p) === 'Trilha: 0 de 7 etapas.');
    await fim(t);
  }
  {
    const t = await abrir('', { width:1280, height:900 }).catch(() => null);
    if (t) await t.ctx.close();
    const ctx = await nav.newContext(); const p = await ctx.newPage();
    await p.route(/fonts\.googleapis/, r => r.abort()); await p.route(/supabase\.co/, r => r.abort());
    await p.goto('http://localhost:8765/tour.html', { waitUntil:'domcontentloaded' }); await p.waitForTimeout(600);
    confere('sem ?ensaio, o tour é o de sempre (sem o painel)', await p.locator('#ensaio').count() === 0);
    await ctx.close();
  }
  if (process.env.ONB_CAPTURAS){
    mkdirSync(process.env.ONB_CAPTURAS, { recursive:true });
    for (const [n, b, vp] of [['meio', '?ensaio=meio#inicio', { width:1280, height:900 }], ['cel', '?ensaio=novo#bem-vindo', { width:390, height:844 }]]){
      const t = await abrir(b, vp); await t.p.screenshot({ path:`${process.env.ONB_CAPTURAS}/onb-${n}.png` }); await t.ctx.close();
    }
  }
} finally { await nav.close(); }
console.log(falhas ? `\n${falhas} falha(s) em ${checks} verificações.` : `\nTudo certo. ${checks} verificações passaram.`); process.exitCode = falhas ? 1 : 0;
