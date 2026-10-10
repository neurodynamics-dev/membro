/* A revisão do Studio (2.19.1), no criador:
     1. as setas da lista de lâminas apontam para cima e para baixo;
     2. a lista de leiautes não encolhe até o texto: o select tem pelo
        menos a largura da opção mais longa, e a lista aberta não corta;
     3. arrastar a lâmina pela alça (mouse e toque) muda a ordem da peça,
        e a lâmina em edição continua a mesma;
     4. os botões continuam mudando a ordem (alternativa ao arrastar).
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
for (const toque of [false, true]){
  const ctx = await nav.newContext({ viewport:{ width:1440, height:960 }, hasTouch: toque });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.goto('http://localhost:8765/index.html#/studio/criar/aniversario', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('.cr-lams', { timeout:15000 }); await p.waitForTimeout(800);
  console.log(toque ? '\nToque' : '\nMouse');
  for (const lay of ['lista', 'citacao']){ await p.selectOption('#cr-novo-lay', lay); await p.click('.cr-add button[onclick]'); await p.waitForTimeout(300); }
  const ordem = () => p.evaluate(() => criador.peca.laminas.map(l => l.layout));
  const antes = await ordem();
  confere('três lâminas para mexer', antes.length === 3, antes);
  if (!toque){
    const dir = await p.evaluate(() => {
      const rot = el => { const m = new DOMMatrix(getComputedStyle(el).transform); return Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI); };
      const li = document.querySelectorAll('.cr-lams li')[1];
      const cima = li.querySelector('.icon-btn.cima'), baixo = li.querySelector('.icon-btn.baixo');
      /* back é o chevron para a esquerda e chevron, para a direita: girando 90°, um aponta para cima e o outro para baixo */
      return { cima: cima && cima.innerHTML.includes('15 18') || cima?.outerHTML.slice(0, 0), rc: rot(cima.querySelector('.ic')), rb: rot(baixo.querySelector('.ic')),
        icCima: cima.getAttribute('onclick'), icBaixo: baixo.getAttribute('onclick') };
    });
    confere('as setas giram 90° (o chevron à esquerda vira para cima, o à direita, para baixo)', dir.rc === 90 && dir.rb === 90, dir);
    const sel = await p.evaluate(() => {
      const s = document.getElementById('cr-novo-lay'), w = s.closest('.nro-select');
      const c = document.createElement('canvas').getContext('2d'); const b = w.querySelector('.nro-select-button');
      c.font = getComputedStyle(b).font;
      const maior = Math.max(...[...s.options].map(o => c.measureText(o.text).width));
      return { w: Math.round(w.getBoundingClientRect().width), maior: Math.round(maior) };
    });
    confere('o select de leiaute tem a largura da opção mais longa', sel.w >= sel.maior + 30, sel);
    await p.click('#cr-novo-lay + .nro-select-button, .cr-add .nro-select-button'); await p.waitForTimeout(200);
    const lista = await p.evaluate(() => { const l = document.querySelector('.nro-select-list'); const r = l.getBoundingClientRect();
      return { cabe: [...l.querySelectorAll('button')].every(b => b.scrollWidth <= b.clientWidth + 1), dentro: r.left >= 0 && r.right <= innerWidth }; });
    confere('a lista aberta mostra as opções inteiras, dentro da tela', lista.cabe && lista.dentro, lista);
    await p.keyboard.press('Escape');
    await p.click('.cr-lams li:nth-child(1) .icon-btn.baixo'); await p.waitForTimeout(300);
    confere('o botão "para baixo" troca com a de baixo', JSON.stringify(await ordem()) === JSON.stringify([antes[1], antes[0], antes[2]]), await ordem());
    await p.click('.cr-lams li:nth-child(2) .icon-btn.cima'); await p.waitForTimeout(300);
    confere('e o "para cima" desfaz', JSON.stringify(await ordem()) === JSON.stringify(antes));
  }
  /* edita a 2ª lâmina e arrasta a 3ª para o topo */
  await p.evaluate(() => crIr(1)); await p.waitForTimeout(300);
  const editada = await p.evaluate(() => criador.peca.laminas[criador.atual]);
  const alca = await p.locator('.cr-lams li:nth-child(3) .cr-alca').boundingBox();
  const topo = await p.locator('.cr-lams li:nth-child(1)').boundingBox();
  const x = alca.x + alca.width / 2, y0 = alca.y + alca.height / 2, y1 = topo.y + 3;
  if (toque){
    const cdp = await ctx.newCDPSession(p);
    const ev = (type, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    await ev('touchStart', y0); for (let k = 1; k <= 8; k++) await ev('touchMove', y0 + (y1 - y0) * k / 8); await ev('touchEnd', y1);
  } else {
    await p.mouse.move(x, y0); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(x, y0 + (y1 - y0) * k / 8); await p.mouse.up();
  }
  await p.waitForTimeout(400);
  const depois = await ordem();
  confere('arrastar a terceira para o topo muda a ordem da peça', JSON.stringify(depois) === JSON.stringify([antes[2], antes[0], antes[1]]), depois);
  confere('a lâmina em edição continua a mesma (agora na 3ª posição)', await p.evaluate(e => criador.peca.laminas[criador.atual].layout === e.layout && criador.atual === 2, editada));
  confere('a lista desenhada segue a ordem nova', await p.evaluate(() => [...document.querySelectorAll('.cr-lams .nm')].map(x => x.textContent).join('|')
    === criador.peca.laminas.map(l => CR_LAYOUTS[l.layout]?.l || l.layout).join('|')));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
