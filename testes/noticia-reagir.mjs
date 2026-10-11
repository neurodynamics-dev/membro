/* F3: noticia.html, a página para reagir fora do portal (ex-membros e
   egressos não abrem o SOMA). Sem banco: o stub do portal com
   window.__teste.feed. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const troca = (s, velho, novo) => { if (!s.includes(velho)) throw new Error('o stub mudou: ' + velho.slice(0, 60)); return s.replace(velho, novo); };
/* sem sessão até entrar (como em tour.mjs) */
let stubFora = troca(stubAdmin, "getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } })",
  "getSession: async () => ({ data:{ session: window.__entrou ? { user:{ id:'u1', email:'ex@exemplo.test' } } : null } })");
stubFora = troca(stubFora, "signInWithPassword: async () => ({ error:null })",
  `signInWithPassword: async (c) => { window.__login = c;
     if (c.password === 'errada') return { error:{ message:'Invalid login credentials', code:'invalid_credentials' } };
     window.__entrou = true; return { data:{}, error:null }; }`);
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(q, { logado = false, feed = {}, viewport = { width:1100, height:900 } } = {}){
  const ctx = await nav.newContext({ viewport }); ctx.setDefaultTimeout(8000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body: logado ? stubAdmin : stubFora }));
  await p.route('**/storage/v1/object/public/**', r => r.fulfill({ contentType:'image/png', body:PNG }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(f => { window.__teste = { feed:f }; }, feed);
  await p.goto('http://localhost:8765/noticia.html' + q, { waitUntil:'domcontentloaded' });
  await p.waitForFunction(() => !document.querySelector('#pg').innerText.includes('Carregando'));
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }

try{
  console.log('Sem sessão, entrar e reagir');
  {
    const t = await abrir('?n=ortese-passa-no-teste'), { p } = t;
    confere('título e imagem', (await p.locator('h1').innerText()) === 'Órtese passa no teste de bancada'
      && (await p.locator('img.capa').getAttribute('src')).endsWith('/storage/v1/object/public/noticias/f1/1.jpg'));
    const so = await p.locator('span.reacao').allInnerTexts();
    confere('contagens só para ler', so.some(x => x.includes('👏') && x.includes('3')) && so.some(x => x.includes('❤️') && x.includes('1'))
      && await p.locator('button.reacao').count() === 0, so);
    confere('formulário de entrada', await p.locator('#e-email').count() === 1 && await p.locator('#e-senha').getAttribute('autocomplete') === 'current-password');
    confere('volta para a matéria no site', await p.locator('a.voltar').getAttribute('href') === 'https://neurodynamics.dev/#/news/ortese-passa-no-teste');
    await p.fill('#e-email', 'ex@exemplo.test'); await p.fill('#e-senha', 'errada'); await p.click('#e-btn');
    await p.waitForFunction(() => document.querySelector('#msg').innerText.length > 0);
    confere('senha errada', (await p.locator('#msg').innerText()) === 'E-mail ou senha incorretos.');
    await p.fill('#e-senha', 'certa'); await p.click('#e-btn');
    await p.waitForSelector('button.reacao');
    confere('entrou: seis botões e "Entrou como"', await p.locator('button.reacao').count() === 6 && (await p.locator('.quem').innerText()).includes('Entrou como'));
    await p.locator('button.reacao', { hasText:'🎉' }).click();
    await p.waitForSelector('button.reacao[data-e="🎉"][aria-pressed="true"]');
    let ult = await p.evaluate(() => (window.__rpcs || []).filter(x => x.nome === 'feed_reagir').at(-1).p);
    confere('reage com 🎉', ult.p_ref === 'f1' && ult.p_emoji === '🎉', ult);
    confere('aviso de registrada', (await p.locator('#msg').innerText()) === 'Reação registrada.');
    await p.locator('button.reacao[data-e="🎉"]').click();
    await p.waitForSelector('button.reacao[data-e="🎉"][aria-pressed="false"]');
    ult = await p.evaluate(() => (window.__rpcs || []).filter(x => x.nome === 'feed_reagir').at(-1).p);
    confere('o mesmo emoji de novo tira', ult.p_emoji === null, ult);
    const ch = await p.evaluate(() => ({ c:[...new Set(window.__chamadas || [])], t:window.__tabelas || [] }));
    confere('só noticia_publica e feed_reagir, nenhuma tabela', ch.c.every(n => ['noticia_publica', 'feed_reagir'].includes(n)) && ch.t.length === 0, ch);
    await fechar(t);
  }

  console.log('Endereços');
  {
    const t = await abrir('?n=nome-antigo', { logado:true }), { p } = t;
    confere('slug antigo vira o novo', await p.evaluate(() => location.search) === '?n=ortese-passa-no-teste');
    await fechar(t);
  }
  {
    const t = await abrir('?n=nao-existe'), { p } = t;
    confere('não publicada', (await p.locator('#pg').innerText()).includes('Esta notícia não está mais publicada.'));
    await fechar(t);
  }
  {
    const t = await abrir('?n=../x'), { p } = t;
    confere('link inválido sem chamar o banco', (await p.locator('#pg').innerText()).includes('Link inválido.')
      && await p.evaluate(() => (window.__chamadas || []).length) === 0);
    await fechar(t);
  }

  console.log('Sem permissão e celular');
  {
    const t = await abrir('?n=ortese-passa-no-teste', { logado:true, feed:{ semPermissao:true } }), { p } = t;
    await p.locator('button.reacao', { hasText:'🚀' }).click();
    await p.waitForFunction(() => document.querySelector('#msg').innerText.length > 0);
    confere('conta sem permissão é avisada', (await p.locator('#msg').innerText()).startsWith('Sua conta não pode reagir'));
    await fechar(t);
  }
  {
    const t = await abrir('?n=ortese-passa-no-teste', { viewport:{ width:390, height:844 } }), { p } = t;
    const w = await p.evaluate(() => document.scrollingElement.scrollWidth);
    confere('celular sem rolagem horizontal', w <= 390, w);
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
