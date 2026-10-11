/* L2: o painel /labbio (entrada, convite, gestores, acento Retina) e o
   desvio da conta externa no portal. Sem banco: o stub com
   window.__teste.labbio. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const troca = (s, velho, novo) => { if (!s.includes(velho)) throw new Error('o stub mudou: ' + velho.slice(0, 60)); return s.replace(velho, novo); };
/* sem sessão até entrar (como em tour.mjs) */
let stubFora = troca(stubAdmin, "getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } })",
  "getSession: async () => ({ data:{ session: window.__entrou ? { user:{ id:'u1' } } : null } })");
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
async function abrir(caminho, { stub = stubAdmin, labbio, viewport = { width:1280, height:900 } } = {}){
  const ctx = await nav.newContext({ viewport }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(lb => { window.__teste = lb ? { labbio:lb } : {}; }, labbio || null);
  await p.goto('http://localhost:8765/' + caminho, { waitUntil:'domcontentloaded' });
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const HEX = 'ab'.repeat(24);

try{
  console.log('Entrada');
  {
    const t = await abrir('labbio/index.html', { stub:stubFora }), { p } = t;
    await p.waitForSelector('#f-entrar');
    confere('sem sessão: login "Painel do LABBIO", sem "Criar conta"', (await p.locator('h1').innerText()) === 'Painel do LABBIO'
      && !(await p.locator('#lb-main').innerText()).includes('Criar conta'));
    await p.fill('#l-email', 'gestora@labbio.test'); await p.fill('#l-senha', 'errada'); await p.click('#l-btn');
    await p.waitForFunction(() => document.querySelector('#l-msg').textContent.length > 0);
    confere('senha errada', (await p.locator('#l-msg').innerText()) === 'E-mail ou senha incorretos.');
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html', { labbio:{ conta:'ativo' } }), { p } = t;
    await p.waitForSelector('#lb-topo:not([hidden]) .lb-nav a');
    const ordem = await p.evaluate(() => [...document.querySelectorAll('#lb-topo .lb-marcas img')].map(i => i.getAttribute('src')));
    confere('as duas logos, LABBIO antes da NRO', ordem[0].endsWith('labbio.png') && ordem.slice(1).every(s => s.includes('nro-imagotipo')), ordem);
    confere('a navegação', (await p.locator('.lb-nav a').allInnerTexts()).join('|') === 'Início|Membros|Solicitações|Check-ins|Treinamentos|Agenda|Gestores');
    confere('o nome do gestor no canto', (await p.locator('#lb-eu-nome').innerText()) === 'Gestora Um');
    const cor = await p.evaluate(() => { const b = document.createElement('button'); b.className = 'btn solid'; document.body.appendChild(b);
      const bg = getComputedStyle(b).backgroundColor; const ref = document.createElement('i'); ref.style.color = 'var(--retina-primary)'; document.body.appendChild(ref);
      return [bg, getComputedStyle(ref).color]; });
    confere('o botão sólido usa a cor Retina', cor[0] === cor[1], cor);
    await p.evaluate(() => { location.hash = '#/agenda'; });   // a L8 preenche
    await p.waitForFunction(() => document.querySelector('#lb-main').innerText.includes('Em breve'));
    confere('as telas das próximas fichas dizem "Em breve."', true);

    console.log('Gestores');
    await p.evaluate(() => { location.hash = '#/gestores'; });
    await p.waitForSelector('#lb-gest-tabela');
    confere('dois gestores, a estrela no principal', await p.locator('#lb-gest-tabela tbody tr').count() === 2
      && await p.locator('#lb-gest-tabela tr[data-g="g1"] .ic-estrela').count() === 1 && await p.locator('#lb-gest-tabela tr[data-g="g2"] .ic-estrela').count() === 0
      && (await p.locator('#lb-gest-tabela tr[data-g="g1"] .sr').textContent()).includes('Responsável principal'));
    confere('último acesso nulo vira "—"', (await p.locator('#lb-gest-tabela tr[data-g="g2"] td').nth(5).innerText()) === '—');
    await p.fill('#cv-nome', 'Alguém'); await p.fill('#cv-email', 'x@nro.dev'); await p.click('#cv-btn');
    await p.waitForFunction(() => document.querySelector('#cv-msg').textContent.length > 0);
    confere('e-mail de membro: a mensagem', (await p.locator('#cv-msg').innerText()).startsWith('Este e-mail é de um membro'));
    await p.fill('#cv-email', 'tres@labbio.test'); await p.click('#cv-btn');
    await p.waitForFunction(() => document.querySelectorAll('#lb-gest-tabela tbody tr').length === 3);
    confere('convite válido entra na lista', (await p.locator('#lb-gest-tabela').innerText()).includes('tres@labbio.test'));
    /* revogar o principal havendo outro ativo: passa a estrela antes */
    await p.evaluate(() => { window.__lbG[1].situacao = 'ativo'; });
    await p.evaluate(() => pgGestores()); await p.waitForSelector('#lb-gest-tabela');
    await p.locator('#lb-gest-tabela tr[data-g="g1"]').getByRole('button', { name:'Revogar' }).click();
    await p.click('#rv-ok');
    await p.waitForFunction(() => document.querySelector('#rv-msg').textContent.length > 0);
    confere('principal com outro ativo: passar a estrela antes', (await p.locator('#rv-msg').innerText()) === 'Passe a estrela para outro gestor antes de sair.');
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html', { labbio:{ conta:'revogado' } }), { p } = t;
    await p.waitForSelector('#lb-acesso');
    confere('revogado: acesso encerrado', (await p.locator('#lb-acesso').innerText()) === 'Seu acesso ao painel do LABBIO foi encerrado.');
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html#/aceitar?c=' + HEX, { labbio:{ conta:'convidado' } }), { p } = t;
    await p.waitForSelector('#lb-topo:not([hidden])');
    confere('convite aceito abre o painel', await p.evaluate(() => location.hash) === '#/'
      && (await p.locator('.toast').first().innerText()) === 'Bem-vindo ao painel do LABBIO.');
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html#/aceitar?c=0' + HEX.slice(1), { labbio:{ conta:'convidado' } }), { p } = t;
    await p.waitForFunction(() => document.querySelector('#lb-main').innerText.includes('venceu'));
    confere('convite vencido', (await p.locator('.lb-entrada .lead').innerText()) === 'O convite venceu. Peça um novo a quem convidou.');
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html#/aceitar?c=' + HEX, { stub:stubFora, labbio:{ conta:'convidado' } }), { p } = t;
    await p.waitForSelector('#f-criar');
    confere('convite sem sessão: criar conta e "Já tenho conta"', await p.locator('#c-senha2').count() === 1 && await p.locator('#c-entrar').count() === 1);
    await fechar(t);
  }
  {
    const t = await abrir('labbio/index.html#/gestores', { labbio:{ conta:'ativo' }, viewport:{ width:390, height:844 } }), { p } = t;
    await p.waitForSelector('#lb-gest-tabela');
    confere('celular: a navegação fica no botão Menu', await p.locator('.lb-nav').isHidden() && await p.locator('#lb-menu-bt').isVisible());
    await p.click('#lb-menu-bt');
    confere('e abre', await p.locator('.lb-nav').isVisible());
    const w = await p.evaluate(() => document.scrollingElement.scrollWidth);
    confere('sem rolagem horizontal', w <= 390, w);
    await fechar(t);
  }

  console.log('No portal');
  {
    const t = await abrir('index.html', { labbio:{ conta:'ativo' } }), { p } = t;
    await p.waitForURL(/\/labbio\//);
    confere('conta externa termina em /labbio/', p.url().includes('/labbio/'));
    await p.waitForSelector('#lb-topo:not([hidden])');
    confere('o portal não chamou nada antes de desviar', await p.evaluate(() => (window.__barradas || []).length) === 0);
    await fechar(t);
  }
  {
    const t = await abrir('index.html#/admin/labbio'), { p } = t;
    await p.waitForSelector('#adm-lb-tabela');
    confere('admin: a tabela dos gestores', await p.locator('#adm-lb-tabela tbody tr').count() === 2);
    await p.fill('#adm-lb-nome', 'Nova'); await p.fill('#adm-lb-email', 'nova@labbio.test'); await p.click('#adm-lb-btn');
    await p.waitForFunction(() => document.querySelectorAll('#adm-lb-tabela tbody tr').length === 3);
    confere('admin convida', (await p.locator('#adm-lb-tabela').innerText()).includes('nova@labbio.test'));
    confere('o link para o painel', await p.locator('a[href="labbio/"]').count() >= 1);
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
