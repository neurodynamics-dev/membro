/* T3: o painel Onboarding da Administração (onboarding_painel). Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
const ctx = await nav.newContext({ viewport:{ width:1440, height:960 } }); ctx.setDefaultTimeout(10000);
const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stubAdmin.replace("papel:'admin'", "papel:'pessoal'") }));
await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
try{
  await p.goto('http://localhost:8765/index.html#/admin', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('a.tile[href="#/admin/onboarding"]');
  confere('o painel está na galeria, em Pessoas', true);
  await p.click('a.tile[href="#/admin/onboarding"]');
  await p.waitForSelector('#onb-tabela');
  const sara = p.locator('#onb-tabela tr', { hasText:'Sara Lopes' });
  confere('Sara Lopes com o chip Trainee e "3 de 7"', await sara.locator('.chip', { hasText:'Trainee' }).count() === 1
    && (await sara.innerText()).includes('3 de 7'));
  confere('barra segmentada com 3 de 7 feitos', await sara.locator('.rec-barra span').count() === 7 && await sara.locator('.rec-barra span.feito').count() === 3);
  confere('pendências curtas, com "e mais"', (await sara.innerText()).includes('e mais 1'));
  await p.click('#onb-so-trainees');
  confere('"Só trainees" deixa só a Sara', await p.locator('#onb-tabela tbody tr').count() === 1);
}catch(e){ console.error(e); falhas++; }
confere('sem erro de página', erros.length === 0, erros);
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
