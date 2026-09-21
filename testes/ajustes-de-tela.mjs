/* Cinco correções pedidas depois do primeiro uso real:
     1. a ordem dos grupos no seletor é a configurada, não a alfabética;
     2. o quadro que abre por padrão é o mais importante que eu EDITO;
     3. o fundo do dropdown é opaco (usava um token que não existe na casca);
     4. o Full mailer abre grande e não fecha com um clique torto fora;
     5. o comentário que falha diz por quê, guarda o texto e destrava o botão.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage({ viewport:{width:1440,height:960} });
const erros=[]; p.on('pageerror', e => erros.push(e.message));
await p.route('**/*supabase*.js', r => r.fulfill({status:200,contentType:'application/javascript',body:stub}));
await p.route('**/fonts.googleapis.com/**', r=>r.abort());
await p.route('**/raw.githubusercontent.com/**', r=>r.abort());
await p.goto('http://localhost:8765/index.html',{waitUntil:'domcontentloaded'});
await p.waitForSelector('#hd:not([hidden])');
const out={};

/* (1) ordem configurada no seletor */
await p.evaluate(() => location.hash = '#/atividades');
await p.waitForTimeout(700);
await p.click('.grp-btn');
await p.waitForSelector('#grp-pop:not([hidden])');
out.ordemNoSeletor = await p.locator('.grp-item .nm').allTextContents();
/* (3) o fundo do dropdown é opaco? */
out.fundoDropdown = await p.evaluate(() => getComputedStyle(document.getElementById('grp-pop')).backgroundColor);
await p.mouse.click(1250,120);

/* (2) qual quadro abriu por padrão */
out.quadroPadrao = (await p.locator('.grp-btn .nm').textContent()).trim();

/* (5) comentário: sucesso, recusa legível e rede caindo */
await p.evaluate(() => location.hash = '#/atividades/card/DEP-1');
await p.waitForSelector('#cd-btn');
await p.fill('#cd-coment','comentário que deve entrar');
await p.click('#cd-btn'); await p.waitForTimeout(500);
out.comentarioOk = await p.evaluate(() => window.__comentario ?? null);

await p.evaluate(() => location.hash = '#/atividades/card/DEP-1');
await p.waitForSelector('#cd-btn');
await p.evaluate(() => document.querySelectorAll('.toast').forEach(t=>t.remove()));
await p.evaluate(() => window.__comentarFalha = 'sem_registro');
await p.fill('#cd-coment','comentário que não entra');
await p.click('#cd-btn'); await p.waitForTimeout(500);
out.semRegistro = {
  aviso: await p.locator('.toast').last().textContent().catch(()=>null),
  textoPreservado: await p.inputValue('#cd-coment'),
  botaoDestravado: !(await p.locator('#cd-btn').isDisabled())
};

await p.evaluate(() => document.querySelectorAll('.toast').forEach(t=>t.remove()));
await p.evaluate(() => window.__comentarFalha = 'lanca');
await p.fill('#cd-coment','com a rede caindo');
await p.click('#cd-btn'); await p.waitForTimeout(500);
out.redeCaindo = {
  aviso: await p.locator('.toast').last().textContent().catch(()=>null),
  textoPreservado: await p.inputValue('#cd-coment'),
  botaoDestravado: !(await p.locator('#cd-btn').isDisabled())
};
await p.evaluate(() => window.__comentarFalha = null);

/* (4) Full mailer: tamanho e clique fora */
await p.evaluate(() => location.hash = '#/admin/relatorios');
await p.waitForSelector('.tile', { timeout:9000 });
await p.click('button:has-text("Full mailer")');
await p.waitForSelector('#modal.open .mailer-wrap', { timeout:9000 });
out.mailer = await p.evaluate(() => {
  const m = document.getElementById('modal');
  return { largura: Math.round(m.getBoundingClientRect().width),
           classes: m.className, persistente: m.dataset.persistente === '1' };
});
await p.evaluate(() => document.querySelectorAll('.toast').forEach(t=>t.remove()));
await p.fill('#ml-titulo','Comunicado importante');
await p.mouse.click(60, 500);                        // clique torto fora
await p.waitForTimeout(400);
out.mailerDepoisDoCliqueFora = {
  continuaAberto: await p.locator('#modal.open').count() === 1,
  textoPreservado: await p.inputValue('#ml-titulo').catch(()=>'(sumiu)'),
  avisou: await p.locator('.toast').last().textContent().catch(()=>null)
};
await p.screenshot({ path:new URL('./mailer.png', import.meta.url).pathname });

out.erros = erros;
console.log(JSON.stringify(out,null,1));
await nav.close();
