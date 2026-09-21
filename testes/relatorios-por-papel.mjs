/* Quais relatórios cada papel alcança — na galeria E na busca. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(process.argv[2] || new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage({ viewport:{width:1340,height:1000} });
const erros = []; p.on('pageerror', e => erros.push(e.message));
await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
await p.route('**/fonts.googleapis.com/**', r => r.abort());
await p.route('**/raw.githubusercontent.com/**', r => r.abort());
await p.goto('http://localhost:8765/index.html', { waitUntil:'domcontentloaded' });
await p.waitForSelector('#hd:not([hidden])');
const out = { papel: await p.evaluate(() => state.perfil.papel) };
await p.evaluate(() => location.hash = '#/admin/relatorios');
await p.waitForTimeout(1200);
out.galeria = await p.locator('#sec-relatorios .tile .tt').allTextContents();
out.buscaQuadro = await p.evaluate(() =>
  (typeof buscarNaPaleta === 'function' ? null : null, FONTES_BUSCA.flatMap(f => f.buscar('quadro completo')).map(i=>i.titulo)));
out.buscaAutorizados = await p.evaluate(() =>
  FONTES_BUSCA.flatMap(f => f.buscar('autorizados')).map(i=>i.titulo));
/* e se alguém chamar a função direto, pelo console? */
out.chamadaDireta = await p.evaluate(() => {
  try { modalQuadro(); } catch(e){ return 'erro: '+e.message; }
  return document.querySelector('#modal.open h3')?.textContent || '(nenhum modal abriu)';
});
out.erros = erros;
console.log(JSON.stringify(out));
await nav.close();
