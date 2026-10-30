/* 2.19.2: tabelas no celular, ordenar por coluna e sem zoom por gesto.
   - o Quadro de pessoal e a Auditoria rolam na horizontal no celular, com o nome visível (antes a coluna de nome sumia);
   - clicar no cabeçalho ordena: crescente, decrescente e volta à ordem de origem; números e datas por valor; a escolha
     fica ao filtrar; o Arquivo (com ordem própria) segue com a dele;
   - nada de zoom: viewport sem escala, gestos do iOS barrados, campos de 16 px no toque. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { celular = false } = {}){
  const ctx = await nav.newContext(celular ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:3 } : { viewport:{ width:1280, height:900 } });
  ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'recolhido'); } catch(e){} });
  /* 2.23.0: as pastas são o padrão de Arquivos; este teste confere a lista (trabalhos.mjs confere as pastas) */
  await p.addInitScript(() => { try { localStorage.setItem('nd.arq.visao', 'lista'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
const fim = async ({ ctx, erros }) => { confere('sem erro de página', erros.length === 0, erros); await ctx.close(); };
const col = (p, sel, i) => p.evaluate(([s, i]) => [...document.querySelectorAll(s + ' tbody tr')].map(r => r.cells[i].textContent.replace(/\s+/g, ' ').trim()), [sel, i]);
const COL = new Intl.Collator('pt', { numeric:true, sensitivity:'base' });

try{
  console.log('Quadro de pessoal no celular');
  {
    const t = await abrir('#/equipe/quadro', { celular:true }), { p } = t;
    await p.waitForSelector('#tb-membros tbody tr');
    const m = await p.evaluate(() => { const w = document.querySelector('#tb-membros .wrap'), tb = w.querySelector('table'), th = [...tb.tHead.rows[0].cells];
      const nome = th.find(c => /Nome/.test(c.textContent)).getBoundingClientRect(), r = w.getBoundingClientRect();
      return { rola:w.scrollWidth > w.clientWidth + 1, tabela:Math.round(tb.getBoundingClientRect().width), nome:Math.round(nome.width), tela:Math.round(r.width),
        pagina:document.documentElement.scrollWidth <= innerWidth + 1 }; });
    confere('a tabela é mais larga que a tela e rola na horizontal, só ela', m.rola && m.tabela >= 880 && m.pagina, m);
    confere('o nome tem largura para aparecer (não é mais espremido)', m.nome >= 110, m);
    const nomes = await col(p, '#tb-membros', 1);
    confere('e mostra os nomes', nomes.length > 0 && nomes.every(n => n.length > 3), nomes);
    await fim(t);
  }
  console.log('Auditoria no celular');
  {
    const t = await abrir('#/admin/auditoria', { celular:true }), { p } = t;
    await p.waitForSelector('#tb-aud tbody tr');
    const m = await p.evaluate(() => { const w = document.querySelector('#tb-aud .wrap'); return { rola:w.scrollWidth > w.clientWidth + 1, tabela:Math.round(w.querySelector('table').getBoundingClientRect().width) }; });
    confere('a auditoria também rola na horizontal, com as oito colunas largas', m.rola && m.tabela >= 1100, m);
    await fim(t);
  }

  console.log('Ordenar por coluna');
  {
    const t = await abrir('#/equipe/quadro'), { p } = t;
    await p.waitForSelector('#tb-membros tbody tr');
    const regs0 = await col(p, '#tb-membros', 0), nomes0 = await col(p, '#tb-membros', 1);
    await p.waitForSelector('#tb-membros th.ord-auto');
    confere('os cabeçalhos viram botões de ordenar', await p.locator('#tb-membros th.ord-auto').count() >= 5 && await p.locator('#tb-membros th.ord-auto[tabindex="0"]').count() >= 5);
    const thNome = p.locator('#tb-membros th', { hasText:'Nome' });
    await thNome.click();
    const asc = await col(p, '#tb-membros', 1);
    confere('um clique em Nome: de A a Z', JSON.stringify(asc) === JSON.stringify([...nomes0].sort((a, b) => COL.compare(a, b))) && await thNome.getAttribute('aria-sort') === 'ascending', asc);
    await thNome.click();
    confere('dois cliques: de Z a A', JSON.stringify(await col(p, '#tb-membros', 1)) === JSON.stringify([...nomes0].sort((a, b) => COL.compare(b, a))) && await thNome.getAttribute('aria-sort') === 'descending');
    await thNome.click();
    confere('três cliques: volta à ordem de origem', JSON.stringify(await col(p, '#tb-membros', 0)) === JSON.stringify(regs0) && await thNome.getAttribute('aria-sort') === 'none');
    await p.locator('#tb-membros th', { hasText:'Reg.' }).click(); await p.locator('#tb-membros th', { hasText:'Reg.' }).click();
    const regs = (await col(p, '#tb-membros', 0)).map(Number);
    confere('número ordena por valor (Reg., decrescente)', regs.every((v, i) => i === 0 || regs[i - 1] >= v), regs);
    await thNome.click();
    await p.fill('#q-busca', 'a'); await p.waitForTimeout(400);
    const dep = await col(p, '#tb-membros', 1);
    confere('filtrar redesenha a tabela e a ordem escolhida continua', JSON.stringify(dep) === JSON.stringify([...dep].sort((a, b) => COL.compare(a, b))) && await p.locator('#tb-membros th[aria-sort="ascending"]').count() === 1, dep);
    await p.locator('#tb-membros tbody tr').first().focus();
    await p.keyboard.press('Shift+Tab');
    await fim(t);
  }
  {
    const t = await abrir('#/admin/auditoria'), { p } = t;
    await p.waitForSelector('#tb-aud tbody tr');
    const q0 = await col(p, '#tb-aud', 0);
    await p.locator('#tb-aud th', { hasText:'Quando' }).click();
    const q1 = await col(p, '#tb-aud', 0), ms = q => q.map(x => { const m = x.match(/(\d{2})\/(\d{2})\/(\d{4})\D+(\d{2}):(\d{2})/); return m ? Date.UTC(+m[3], +m[2] - 1, +m[1], +m[4], +m[5]) : 0; });
    confere('datas ordenam pelo tempo (e não pelo texto)', ms(q1).every((v, i, a) => i === 0 || a[i - 1] <= v) && q1.length === q0.length, q1.slice(0, 4));
    await p.locator('#tb-aud th', { hasText:'Quando' }).focus(); await p.keyboard.press('Enter');
    confere('o teclado também ordena (Enter no cabeçalho)', ms(await col(p, '#tb-aud', 0)).every((v, i, a) => i === 0 || a[i - 1] >= v));
    await fim(t);
  }
  {
    const t = await abrir('#/arquivos'), { p } = t;
    await p.waitForSelector('.arq-tab tbody tr');
    confere('o Arquivo segue com a ordem própria (sem o ordenador genérico)', await p.locator('.arq-tab th.ord').count() > 0 && await p.locator('.arq-tab th.ord-auto').count() === 0);
    await fim(t);
  }

  console.log('Barra de topo do celular');
  {
    const t = await abrir('#/equipe/quadro', { celular:true }), { p } = t;
    await p.waitForSelector('#tb-membros tbody tr');
    const topo = () => p.evaluate(() => Math.round(document.getElementById('topo-m').getBoundingClientRect().bottom));
    confere('aparece no topo', await topo() > 40);
    await p.evaluate(() => { document.body.style.minHeight = '3000px'; });
    const espera = f => p.waitForFunction(f, null, { timeout:3000 }).catch(() => {});
    for (let y = 100; y <= 700; y += 100){ await p.evaluate(v => window.scrollTo({ top:v, behavior:'instant' }), y); await p.waitForTimeout(30); }
    await espera(() => document.body.classList.contains('topo-oculto') && document.getElementById('topo-m').getBoundingClientRect().bottom <= 0);
    confere('rolando para baixo, ela some', await topo() <= 0 && await p.evaluate(() => document.body.classList.contains('topo-oculto')));
    for (let y = 650; y >= 550; y -= 25){ await p.evaluate(v => window.scrollTo({ top:v, behavior:'instant' }), y); await p.waitForTimeout(30); }
    await espera(() => document.getElementById('topo-m').getBoundingClientRect().bottom > 40);
    confere('rolando para cima, ela volta', await topo() > 40, await p.evaluate(() => [scrollY, document.body.className, document.activeElement?.id, location.hash]));
    await p.click('#burger'); await p.waitForTimeout(400);
    const marca = await p.evaluate(() => [...document.querySelectorAll('#lt-marca img')].filter(i => getComputedStyle(i).display !== 'none').map(i => i.className));
    confere('na gaveta, só a logo inteira (sem o símbolo ao lado)', JSON.stringify(marca) === '["lt-imagotipo"]', marca);
    await fim(t);
  }

  console.log('Sem zoom');
  {
    const t = await abrir('#/', { celular:true }), { p } = t;
    const v = await p.evaluate(() => document.querySelector('meta[name=viewport]').content);
    confere('o viewport trava a escala', /maximum-scale=1/.test(v) && /user-scalable=no/.test(v), v);
    const barrado = await p.evaluate(() => ['gesturestart', 'gesturechange', 'gestureend'].map(n => { const e = new Event(n, { cancelable:true, bubbles:true }); document.body.dispatchEvent(e); return e.defaultPrevented; }));
    confere('os gestos de pinça do iOS são barrados', barrado.every(Boolean), barrado);
    const tm = await p.evaluate(() => { const e = new Event('touchmove', { cancelable:true, bubbles:true }); e.touches = [{}, {}]; document.body.dispatchEvent(e); return e.defaultPrevented; });
    confere('e o movimento com dois dedos também', tm);
    confere('toque duplo sem zoom (touch-action: manipulation)', await p.evaluate(() => getComputedStyle(document.documentElement).touchAction) === 'manipulation');
    await p.evaluate(() => { location.hash = '#/servicos/dados'; }); await p.waitForSelector('#t-nome_civil');
    const fs = await p.evaluate(() => [...document.querySelectorAll('#main input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=file]), textarea')].filter(e => e.offsetParent).map(e => parseFloat(getComputedStyle(e).fontSize)));
    confere('no toque, os campos têm 16 px (o iOS não dá zoom ao focar)', fs.length > 3 && fs.every(x => x >= 16), fs);
    await fim(t);
  }
  {
    const t = await abrir('#/servicos/dados'), { p } = t;
    await p.waitForSelector('#t-nome_civil');
    const fs = await p.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#t-nome_civil')).fontSize));
    confere('no computador os campos seguem com o tamanho de sempre', fs < 16, fs);
    await fim(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
