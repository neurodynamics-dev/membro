import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(process.argv[2] || new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage();
const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
await p.route('**/fonts.googleapis.com/**', r => r.abort());
await p.route('**/raw.githubusercontent.com/**', r => r.abort());
await p.goto('http://localhost:8765/index.html', { waitUntil:'domcontentloaded' });
await p.waitForSelector('#hd:not([hidden])');
const out = { papel: await p.evaluate(() => state.perfil.papel) };
/* o que o menu lateral oferece a este papel — a porta que nem aparece */
out.adminNoMenu         = await p.isVisible('#lt-nav .lt-sec[data-r="admin"]');
out.quadroPessoalNoMenu = await p.evaluate(() => !!document.querySelector('#lt-nav .lt-filho[href="#/equipe/quadro"]'));
out.abrirFichaNoOrg   = await p.evaluate(async () => {
  location.hash = '#/organizacao'; await new Promise(r=>setTimeout(r,400));
  return document.querySelectorAll('.org-focus a[href^="#/equipe/"]').length;
});
// tenta entrar na rota de gestão na marra
out.aposTentarQuadro = await p.evaluate(async () => {
  location.hash = '#/quadro'; await new Promise(r=>setTimeout(r,700));
  return { hash: location.hash, moduloBaixado: document.querySelectorAll('script[src*="mod-gestao"]').length };
});
out.aposTentarAuditoria = await p.evaluate(async () => {
  location.hash = '#/auditoria'; await new Promise(r=>setTimeout(r,700));
  return location.hash;
});
console.log(JSON.stringify(out, null, 2));
console.log('erros:', erros.length ? erros : 'nenhum');
await nav.close();
