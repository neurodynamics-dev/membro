/* Os templates de tela (PLANO-DESIGN-SYSTEM.md, seção 3), pelo catálogo
   #/dev/templates. Confere, com asserção de verdade (sai 1 se algo falhar):
     1. toda seção do catálogo desenha um cabeçalho único (.cab), com eyebrow;
     2. o h1 tem o mesmo tamanho em todas as seções e nos dois temas;
     3. no máximo um botão sólido Synapse por tela (as ações do "Mais" não contam);
     4. as etapas do fluxo não são SectionNav (.etapas, não .nav1);
     5. a lateral do objeto desce no celular; nenhuma largura cria rolagem lateral;
     6. o rodapé da casca está lá, com o SOMA marcado entre os endereços.
   Fotos em testes/templates-<tema>-<seção>.png (fora do git).
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
const SECOES = ['', 'objeto', 'fluxo', 'painel', 'leitura', 'ajustes', 'trabalho', 'estados'];
const tamanhos = new Set();
for (const tema of ['escuro', 'claro']) for (const vp of [{ width:1440, height:960 }, { width:390, height:844 }]){
  const ctx = await nav.newContext({ viewport: vp, reducedMotion:'reduce' });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.addInitScript(t => { try { localStorage.setItem('nd.tema', t); } catch(e){} }, tema);
  await p.goto('http://localhost:8765/index.html#/dev/templates', { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])'); await p.waitForTimeout(800);
  for (const s of SECOES){
    await p.evaluate(h => location.hash = h, '#/dev/templates' + (s ? '/' + s : '')); await p.waitForTimeout(500);
    const r = await p.evaluate(() => {
      const cab = document.querySelectorAll('#main .cab'), h1 = document.querySelector('#main .cab h1');
      return { cabs: cab.length, eyebrow: !!document.querySelector('#main .cab .eyebrow'),
        h1: h1 && getComputedStyle(h1).fontSize,
        solidos: [...document.querySelectorAll('#main .btn.solid')].filter(b => !b.closest('.cab-mais') && b.offsetParent).length,
        lateral: document.documentElement.scrollWidth > innerWidth + 1,
        etapasNav1: !!document.querySelector('#main .nav1 + .tpl-f .nav1, #main .tpl-f .nav1'),
        etapas: !!document.querySelector('#main .etapas'),
        ladoObjeto: (() => { const a = document.querySelector('.objeto-lateral'), m = document.querySelector('.objeto-principal');
          return a && m ? a.getBoundingClientRect().top < m.getBoundingClientRect().top : null; })() };
    });
    const nome = `${tema} ${vp.width} ${s || 'lista'}`;
    confere(`${nome}: um cabeçalho, com eyebrow`, r.cabs === 1 && r.eyebrow, r);
    if (vp.width === 1440) tamanhos.add(r.h1);
    confere(`${nome}: no máximo um Synapse sólido à vista`, r.solidos <= 1, r.solidos);
    confere(`${nome}: sem rolagem lateral`, !r.lateral);
    if (s === 'fluxo') confere(`${nome}: etapas não são SectionNav`, r.etapas && !r.etapasNav1, r);
    if (s === 'objeto' && vp.width === 390) confere(`${nome}: a lateral sobe no celular`, r.ladoObjeto === true, r.ladoObjeto);
    if (vp.width === 1440) await p.screenshot({ path:`testes/templates-${tema}-${s || 'lista'}.png`, fullPage:true });
  }
  const eco = await p.evaluate(() => [...document.querySelectorAll('#ft .nd-eco a[aria-current]')].map(a => a.textContent.trim()));
  confere(`${tema} ${vp.width}: o rodapé marca o SOMA`, eco.length === 1 && /SOMA/.test(eco[0]), eco);
  confere(`${tema} ${vp.width}: sem erro de JS`, !erros.length, erros.slice(0, 3));
  await ctx.close();
}
confere('o h1 tem um tamanho só em todos os templates', tamanhos.size === 1, [...tamanhos]);
await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
