/* Curadoria de fotos (/curadoria): a página só abre com a sessão do SOMA.
   Sem sessão pede o login; conta bloqueada e conta externa do LABBIO
   não entram; o membro ativo cai direto na campanha. E a página não
   aparece em nenhum menu nem link do portal. Sem banco: o stub.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const stubMembro = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const troca = (s, velho, novo) => { if (!s.includes(velho)) throw new Error('o stub mudou: ' + velho.slice(0, 60)); return s.replace(velho, novo); };
/* sem sessão até entrar (como em labbio-casca.mjs) */
let stubFora = troca(stubMembro, "getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } })",
  "getSession: async () => ({ data:{ session: window.__entrou ? { user:{ id:'u1', email:'ana@neurodynamics.dev' } } : null } })");
stubFora = troca(stubFora, "signInWithPassword: async () => ({ error:null })",
  `signInWithPassword: async (c) => { window.__login = c;
     if (c.password === 'errada') return { error:{ message:'Invalid login credentials', code:'invalid_credentials' } };
     window.__entrou = true; return { data:{}, error:null }; }`);

const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ stub = stubMembro, teste = {}, viewport = { width:390, height:844 } } = {}){
  const ctx = await nav.newContext({ viewport }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|fonts\.gstatic|unsplash\.com|images\.pexels\.com/, r => r.abort());
  await p.addInitScript(t => { window.__teste = t; }, teste);
  await p.goto('http://localhost:8765/curadoria/', { waitUntil:'domcontentloaded' });
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const visivel = (p, s) => p.locator(s).isVisible();

try{
  console.log('Sem sessão');
  {
    const t = await abrir({ stub:stubFora }), { p } = t;
    await p.waitForSelector('#f-entrar');
    confere('pede o login do SOMA', (await p.locator('#entrada h1').innerText()) === 'Entre com a sua conta do SOMA');
    confere('a campanha fica escondida', !(await visivel(p, '#app')));
    await p.fill('#l-email', 'ana@neurodynamics.dev'); await p.fill('#l-senha', 'errada'); await p.click('#l-btn');
    await p.waitForFunction(() => document.querySelector('#l-msg').textContent.length > 0);
    confere('senha errada', (await p.locator('#l-msg').innerText()) === 'E-mail ou senha incorretos.');
    await p.fill('#l-senha', 'certa'); await p.click('#l-btn');
    await p.waitForSelector('#app:not([hidden]) .cartao');
    confere('depois de entrar, abre a campanha', !(await visivel(p, '#entrada')));
    confere('o login foi com o e-mail digitado', (await p.evaluate(() => window.__login.email)) === 'ana@neurodynamics.dev');
    await fechar(t);
  }

  console.log('Membro ativo, já logado no SOMA');
  {
    const t = await abrir(), { p } = t;
    await p.waitForSelector('#app:not([hidden]) .cartao');
    confere('entra direto, sem pedir senha', !(await p.locator('#f-entrar').count()));
    await p.click('#btn-sim');
    const chaves = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('nro-curadoria')));
    confere('as decisões ficam guardadas por conta', chaves.length === 1 && chaves[0] === 'nro-curadoria-v1:u1', chaves);
    await p.click('#abrir-ajustes');
    confere('Ajustes mostra quem está conectado', (await p.locator('#conta-quem').innerText()).includes('Ana Figueiredo'));
    await p.click('#btn-sair');
    await p.waitForSelector('#f-entrar');
    confere('Sair volta para o login', !(await visivel(p, '#app')));
    await fechar(t);
  }

  console.log('Contas sem acesso');
  {
    const t = await abrir({ teste:{ bloqueada:true } }), { p } = t;
    await p.waitForSelector('#l-sair');
    confere('conta de membro bloqueada não entra', (await p.locator('#entrada h1').innerText()) === 'Esta conta não tem acesso'
      && !(await visivel(p, '#app')));
    await fechar(t);
  }
  {
    const t = await abrir({ teste:{ labbio:{ conta:'ativo' } } }), { p } = t;
    await p.waitForSelector('#l-sair');
    confere('conta externa do LABBIO não entra', !(await visivel(p, '#app')));
    await fechar(t);
  }

  console.log('Fora dos menus');
  {
    const raiz = new URL('..', import.meta.url).pathname;
    const FORA = new Set(['curadoria', 'testes', 'node_modules', '.git', 'db', 'fichas']);
    const achados = [];
    const varrer = d => { for (const n of readdirSync(d)) {
      const c = join(d, n); if (FORA.has(n)) continue;
      if (statSync(c).isDirectory()) varrer(c);
      /* um endereço que começa em curadoria/ (não biblioteca/curadoria/, que é outra coisa) */
      else if (/\.(html|js)$/.test(n) && /(["'(`=]|neurodynamics\.dev)(\.\.?\/|\/)?curadoria\//.test(readFileSync(c, 'utf8'))) achados.push(c.slice(raiz.length));
    } };
    varrer(raiz);
    confere('nenhuma página ou módulo do portal aponta para /curadoria', achados.length === 0, achados);
  }
} finally {
  await nav.close();
}
console.log(`\n${checks - falhas}/${checks} ok`);
process.exitCode = falhas ? 1 : 0;
