/* L6: as solicitações de biometria no /labbio. Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash){
  const ctx = await nav.newContext({ viewport:{ width:1280, height:900 }, permissions:['clipboard-read', 'clipboard-write'] }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(() => { window.__teste = { labbio:{ conta:'ativo' } }; });
  await p.goto('http://localhost:8765/labbio/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#lb-topo:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);
try{
  {
    const t = await abrir('#/solicitacoes'), { p } = t;
    await p.waitForSelector('#sol-tabela');
    confere('abertos: um pedido, o do Bruno', await p.locator('#sol-tabela tbody tr').count() === 1 && (await p.locator('#sol-tabela').innerText()).includes('Bruno Tavares'));
    await p.getByRole('button', { name:'Encerrados' }).click();
    await p.waitForSelector('.vazio');
    confere('encerrados: nenhum', (await p.locator('.vazio').innerText()).includes('Nenhum pedido'));
    await p.getByRole('button', { name:'Abertos' }).click(); await p.waitForSelector('#sol-tabela a');
    await p.click('#sol-tabela a');
    await p.waitForSelector('.lb-dado');
    const txt = await p.locator('#ped-corpo').innerText();
    confere('o detalhe mostra CPF e matrícula, cada um com "Copiar"', txt.includes('52998224725') && txt.includes('2021012345') && await p.locator('.lb-dado button', { hasText:'Copiar' }).count() >= 3);
    await p.locator('.lb-dado', { hasText:'CPF' }).getByRole('button', { name:'Copiar' }).click();
    confere('copiar põe o valor na área de transferência', await p.evaluate(() => navigator.clipboard.readText()) === '52998224725');
    await p.waitForSelector('#ped-foto img');
    confere('a foto, com "Baixar a foto"', await p.locator('#ped-foto a[download]').count() === 1);
    const bx = await p.evaluate(() => (window.__baixados || []).find(b => b.bucket === 'biometria'));
    confere('a foto vem do bucket biometria por link assinado', bx?.caminho === '11/p1/1.jpg', bx);
    confere('a trilha: "Encaminhado ao LABBIO" em destaque', (await p.locator('.lb-trilha li.atual').innerText()).includes('Encaminhado ao LABBIO'));
    await p.getByRole('button', { name:'Devolver para correção' }).click();
    await p.click('#pm-ok');
    confere('devolver sem motivo não chama o banco', (await rpcs(p, 'labbio_pedido_decidir')).length === 0 && (await p.locator('#pm-msg').innerText()).includes('motivo'));
    await p.fill('#pm-motivo', 'A foto está escura'); await p.click('#pm-ok');
    await p.waitForFunction(() => document.querySelector('.cab-lead')?.textContent.includes('Devolvido ao membro'));
    const u = (await rpcs(p, 'labbio_pedido_decidir')).at(-1).p;
    confere('com motivo, a etapa vira devolvido', u.p_acao === 'devolver' && u.p_motivo === 'A foto está escura' && u.p_versao === 1, u);
    confere('e some a decisão', await p.locator('#ped-ok').count() === 0);
    await fechar(t);
  }
  {
    const t = await abrir('#/solicitacoes/p1'), { p } = t;
    await p.waitForSelector('#ped-ok');
    await p.click('#ped-ok'); await p.locator('#lb-modal').getByRole('button', { name:'Confirmar o cadastro' }).click();
    await p.waitForFunction(() => document.querySelector('.cab-lead')?.textContent.includes('Acesso cadastrado'));
    const u = (await rpcs(p, 'labbio_pedido_decidir')).at(-1).p;
    confere('confirmar o cadastro chama "implantado" e a etapa vira concedido', u.p_acao === 'implantado', u);
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
