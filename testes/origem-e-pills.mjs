/* Fase 4: cartão de origem + decisão, pills de grupo, preferência de e-mail */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage({ viewport:{ width:1340, height:1100 } });
const erros = [];
p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/net::|Failed to load resource/.test(m.text())) erros.push('CONSOLE: '+m.text()); });
await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
await p.route('**/fonts.googleapis.com/**', r => r.abort());
await p.route('**/raw.githubusercontent.com/**', r => r.abort());
await p.goto('http://localhost:8765/index.html', { waitUntil:'domcontentloaded' });
await p.waitForSelector('#hd:not([hidden])', { timeout:9000 });
const out = {};

/* ---------- 1. o selo de origem no quadro ---------- */
await p.evaluate(() => location.hash = '#/atividades/DEP');
await p.waitForSelector('.kb-card', { timeout:9000 });
out.cartoesDEP   = await p.locator('.kb-card .cod').allTextContents();
out.seloOrigem   = await p.locator('.kb-card .org').allTextContents();
await p.evaluate(() => location.hash = '#/atividades/ORT');
await p.waitForSelector('.kb-card', { timeout:9000 });
out.seloEmOrtese = await p.locator('.kb-card .org').count();   // deve ser 0

/* ---------- 2. o bloco de origem e o formulário de decisão ---------- */
await p.evaluate(() => location.hash = '#/atividades/card/DEP-1');
await p.waitForSelector('#dec-form', { timeout:9000 });
out.origemTitulo   = await p.locator('.cd-grade .card h3').first().textContent();
out.origemProtocolo= (await p.locator('.cd-grade .card .sub').first().textContent()).trim().replace(/\s+/g,' ');
out.origemCampos   = await p.locator('.cd-grade .card .dl .it dt').allTextContents();
out.itensConceder  = await p.locator('.dec-item').count();
out.marcadoPorPadrao = await p.locator('.dec-item:checked').getAttribute('value');
out.jaConcedido    = await p.locator('.dec-item[disabled]').getAttribute('value');
/* o texto da justificativa veio com <b> dentro: tem de aparecer literal */
out.htmlEscapado   = await p.locator('.cd-grade .card .dl').first().innerHTML().then(h => h.includes('&lt;b&gt;'));

/* ---------- 3. recusar sem resposta é barrado no cliente ---------- */
await p.selectOption('#dec-status', 'recusada');
await p.click('#dec-btn');
await p.waitForTimeout(250);
out.avisoRecusa = await p.locator('.toast').first().textContent().catch(()=>null);
out.decisaoVazou = await p.evaluate(() => window.__decisao ?? null);   // deve ser null

/* ---------- 4. aprovar concedendo o item pedido ---------- */
await p.selectOption('#dec-status', 'aprovada');
await p.fill('#dec-resposta', 'Liberado até dezembro.');
await p.click('#dec-btn');
await p.waitForTimeout(500);
out.decisaoEnviada = await p.evaluate(() => window.__decisao ?? null);

/* ---------- 5. pills de grupo na ficha ---------- */
await p.evaluate(() => location.hash = '#/equipe/4');
await p.waitForSelector('#ficha-body', { timeout:9000 });
await p.evaluate(() => { gestao.ficha.editando = true; renderFicha(); });
await p.waitForSelector('.pills-ed', { timeout:9000 });
out.pillsIniciais = await p.locator('.pill-ed').allTextContents();
out.hiddenInicial = await p.inputValue('#f-grupos');
out.sugestoes     = await p.locator('#dl-grupos-ed option').count();

// adiciona escrevendo com grafia diferente: tem de casar com o catálogo
await p.fill('#pe-in', 'sinais');
await p.press('#pe-in', 'Enter');
out.aposAdicionar = await p.inputValue('#f-grupos');

// repetir não duplica
await p.fill('#pe-in', 'ÓRTESE');
await p.press('#pe-in', 'Enter');
out.aposRepetir = await p.inputValue('#f-grupos');

// colar uma lista com vírgulas vira várias pills
await p.fill('#pe-in', 'Firmware, Marca');
await p.press('#pe-in', 'Enter');
out.aposColar = await p.inputValue('#f-grupos');
out.pillsFinais = await p.locator('.pill-ed').count();

// o × tira
await p.locator('.pill-ed button').first().click();
out.aposRemover = await p.inputValue('#f-grupos');

// Backspace no campo vazio tira a última
await p.press('#pe-in', 'Backspace');
out.aposBackspace = await p.inputValue('#f-grupos');
await p.screenshot({ path:new URL('./f4-pills.png', import.meta.url).pathname, fullPage:false });

/* ---------- 6. preferência de e-mail ---------- */
await p.evaluate(() => location.hash = '#/inicio');
await p.waitForTimeout(300);
await p.click('#sino');
await p.waitForSelector('.sn-pe button', { timeout:5000 });
await p.click('.sn-pe button');
await p.waitForSelector('input[name="pn-modo"]', { timeout:5000 });
out.modos = await p.locator('input[name="pn-modo"]').count();
out.modoAtual = await p.locator('input[name="pn-modo"]:checked').getAttribute('value');
await p.click('input[name="pn-modo"][value="nunca"]');
await p.click('#pn-btn');
await p.waitForTimeout(400);
out.preferenciaSalva = await p.evaluate(() => window.__preferencia ?? null);
await p.screenshot({ path:new URL('./f4-preferencia.png', import.meta.url).pathname, fullPage:false });

out.erros = erros;
console.log(JSON.stringify(out, null, 1));
await nav.close();
