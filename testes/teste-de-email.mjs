/* O botão "Enviar um e-mail de teste": cada uma das seis coisas que
   podem falhar tem de virar um recado próprio, e não um silêncio.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage({ viewport:{width:1280,height:900} });
const erros=[]; p.on('pageerror', e => erros.push(e.message));
await p.route('**/*supabase*.js', r => r.fulfill({status:200,contentType:'application/javascript',body:stub}));
await p.route('**/fonts.googleapis.com/**', r=>r.abort());
await p.route('**/raw.githubusercontent.com/**', r=>r.abort());
await p.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
await p.waitForSelector('#hd:not([hidden])');

async function testar(cenario){
  await p.evaluate(c => { window.__teste = c; }, cenario);
  if (!(await p.locator('#pn-tbtn').count())){
    await p.click('#sino'); await p.waitForSelector('.sn-pe button');
    await p.click('.sn-pe button'); await p.waitForSelector('#pn-tbtn');
  }
  await p.click('#pn-tbtn');
  await p.waitForTimeout(400);
  const txt = (await p.locator('#pn-teste').innerText()).replace(/\s+/g,' ').trim();
  const erro = await p.locator('#pn-teste .aviso-box.err').count() > 0;
  const destravado = !(await p.locator('#pn-tbtn').isDisabled());
  return { erro, destravado, recado: txt.slice(0,260) };
}

const casos = {
  'tudo certo':                 {},
  'preferência é resumo':       { modo:'resumo' },
  'conta sem vínculo':          { rpc:'sem_registro' },
  'ficha sem e-mail':           { rpc:'sem_email' },
  'migração v18 não aplicada':  { rpc:'faltaMigracao' },
  'função não publicada (404)': { fn:'naoPublicada' },
  'CORS ou fora do ar':         { fn:'semResposta' },
  'sessão recusada (401)':      { fn:'semSessao' },
  'função estourou (500)':      { fn:'estourou' },
  'SMTP não configurado':       { fn:'semSmtp' },
  'migração v16 faltando':      { fn:'semLote' },
  'rodou mas não enviou nada':  { fn:'zero' }
};
const out = {};
for (const [nome, c] of Object.entries(casos)) out[nome] = await testar(c);
out.erros = erros;
console.log(JSON.stringify(out, null, 1));
await nav.close();
