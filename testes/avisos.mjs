/* O quadro de avisos e o editor, com os onze layouts (db/2.20.0_avisos.sql).
   Confere, com asserção de verdade (sai 1 se algo falhar):
     1. cada layout desenha a sua estrutura (hero, número, contagem, lista, citação, progresso...);
     2. o texto do aviso nunca vira HTML; *palavra* só vale no hero;
     3. rodízio por padrão e grade à escolha, lembrada ao recarregar;
     4. no tema claro, o hero continua escuro; nada cria rolagem lateral no celular;
     5. o editor oferece os onze layouts e as doze cores, esconde os campos que o layout não usa,
        e salva layout, família e valor.
   Fotos em testes/avisos-<tema>-<modo>.png (fora do git).
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
const em = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const AVISOS = [
  { id:'a01', titulo:'Bem-vindos ao *novo* portal', corpo:'Tudo no mesmo lugar.', layout:'hero', familia:null, ordem:1, publicado:true, link_url:'https://neurodynamics.dev', link_rotulo:'Conhecer' },
  { id:'a02', titulo:'Reunião geral', corpo:'Sala 2.', layout:'destaque', ordem:2, publicado:true },
  { id:'a03', titulo:'Rede fora do ar', corpo:'Volta às 14h.', layout:'urgente', ordem:3, publicado:true },
  { id:'a04', titulo:'Defesa da Ana', corpo:'Auditório.', layout:'evento', data_evento:em(9), ordem:4, publicado:true },
  { id:'a05', titulo:'dias para o Cybathlon', corpo:'Falta pouco.', layout:'contagem', data_evento:em(5), familia:'ion', ordem:5, publicado:true },
  { id:'a06', titulo:'membros ativos', corpo:'No LABBIO.', layout:'numero', valor:'42', familia:'lumen', ordem:6, publicado:true },
  { id:'a07', titulo:'Meta de check-ins', corpo:'Do mês.', layout:'progresso', valor:'72', ordem:7, publicado:true },
  { id:'a08', titulo:'Artigo aceito', corpo:'Na revista X.', layout:'conquista', ordem:8, publicado:true },
  { id:'a09', titulo:'Esta semana', corpo:'Limpar a bancada\nGuardar os kits\nAssinar a lista', layout:'lista', ordem:9, publicado:true },
  { id:'a10', titulo:'Prof. Marta', corpo:'Medir é o começo de cuidar.', layout:'citacao', familia:'dendrito', ordem:10, publicado:true },
  { id:'a11', titulo:'<img src=x onerror=window.__xss=1> *negrito*', corpo:'<b>corpo</b>', layout:'padrao', ordem:11, publicado:true }
];
async function abrir(vp, tema, hash){
  const ctx = await nav.newContext({ viewport: vp, reducedMotion:'reduce' });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.addInitScript(t => { try { localStorage.setItem('nd.tema', t); } catch(e){} }, tema);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])'); await p.waitForTimeout(600);
  return { ctx, p, erros };
}

/* ---------- o quadro na Início ---------- */
for (const tema of ['escuro', 'claro']){
  const { ctx, p, erros } = await abrir({ width:1280, height:900 }, tema, '#/');
  await p.evaluate(a => { window.__agenda.portal_avisos.splice(0, 99, ...a); return carregarBoard(); }, AVISOS);
  await p.waitForSelector('#board'); await p.waitForTimeout(300);
  console.log(`\nQuadro, tema ${tema}`);
  const html = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('#board .slide')].map(s => [s.querySelector('.sl-base').className.match(/sl-(?!base)(\w+)/)[1], s.innerHTML])));
  const n = await p.locator('#board .slide').count();
  confere('onze avisos, onze slides, rodízio por padrão', n === 11 && await p.locator('#board.grade').count() === 0 && await p.locator('[data-dot]').count() === 11);
  confere('hero: *palavra* vira Synapse, com as manchas da marca e o botão', /<em>novo<\/em>/.test(html.hero) && /class="blob b1"/.test(html.hero) && /btn solid/.test(html.hero));
  confere('contagem: cinco dias, na família Ion', /<div class="w-num">5<small>dias<\/small>/.test(html.contagem) && /f-ion/.test(html.contagem));
  confere('número: o valor grande e a família Lumen', /<div class="w-num">42<\/div>/.test(html.numero) && /f-lumen/.test(html.numero));
  confere('progresso: 72% na barra, com papel de progressbar', /aria-valuenow="72"/.test(html.progresso) && /width:72%/.test(html.progresso));
  confere('lista: um item por linha', (html.lista.match(/<li>/g) || []).length === 3);
  confere('citação: a frase em destaque e quem disse', /<blockquote>Medir é o começo de cuidar\.<\/blockquote><cite>Prof\. Marta/.test(html.citacao));
  confere('evento: bloco de data', /class="quando"/.test(html.evento));
  confere('o texto do aviso nunca vira HTML, e *negrito* fora do hero perde os asteriscos',
    (await p.evaluate(() => window.__xss)) === undefined && !/<img src=x/.test(html.padrao) && !/\*/.test(html.padrao) && !/<b>corpo/.test(html.padrao));
  if (tema === 'claro'){
    const fundo = await p.evaluate(() => { const e = document.querySelector('#board .sl-hero'); const c = getComputedStyle(e);
      const m = c.backgroundColor.match(/\d+/g).map(Number); return { m, cor: getComputedStyle(e).color }; });
    confere('no claro, o hero continua escuro', fundo.m[0] < 40 && fundo.m[1] < 40, fundo);
  }
  await p.screenshot({ path:`avisos-${tema}-rodizio.png`, clip:{ x:0, y:0, width:1280, height:700 } });
  await p.evaluate(() => mostrarSlide(4)); await p.waitForTimeout(700);
  await p.locator('#board').screenshot({ path:`avisos-${tema}-contagem.png` });
  await p.click('.board-modo button:has-text("Grade")'); await p.waitForTimeout(300);
  confere('grade: todos à vista, sem pontos nem setas', await p.locator('#board.grade').count() === 1
    && await p.locator('#board .slide:visible').count() === 11 && await p.locator('[data-dot]').count() === 0 && await p.locator('.board-arrows').count() === 0);
  confere('a grade fica lembrada ao recarregar', await (async () => { await p.reload({ waitUntil:'domcontentloaded' }); await p.waitForSelector('#hd:not([hidden])');
    await p.evaluate(a => { window.__agenda.portal_avisos.splice(0, 99, ...a); return carregarBoard(); }, AVISOS); await p.waitForSelector('#board.grade'); return true; })());
  await p.screenshot({ path:`avisos-${tema}-grade.png`, fullPage:true });
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ width:390, height:844 }, 'escuro', '#/');
  await p.evaluate(a => { window.__agenda.portal_avisos.splice(0, 99, ...a); return carregarBoard(); }, AVISOS);
  await p.waitForSelector('#board'); await p.waitForTimeout(300);
  console.log('\nCelular');
  for (const modo of ['rodizio', 'grade']){
    await p.evaluate(m => trocarModoBoard(m), modo); await p.waitForTimeout(300);
    for (let i = 0; i < (modo === 'rodizio' ? 11 : 1); i++){
      if (modo === 'rodizio') await p.evaluate(k => mostrarSlide(k), i);
      const lateral = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (lateral) confere(`${modo}, slide ${i}: sem rolagem lateral`, false);
    }
    confere(`${modo}: sem rolagem lateral`, !(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)));
  }
  await ctx.close();
}

/* ---------- o editor ---------- */
{
  const { ctx, p, erros } = await abrir({ width:1280, height:1000 }, 'escuro', '#/');
  await p.evaluate(a => { window.__agenda.portal_avisos.splice(0, 99, ...a); }, AVISOS);
  await p.evaluate(() => location.hash = '#/admin/avisos'); await p.waitForSelector('#av-form .lay-opcoes', { timeout:8000 });
  console.log('\nEditor');
  confere('onze layouts e doze cores (mais "Do layout")', await p.locator('.lay-opcoes .lay').count() === 11 && await p.locator('.fam-opcoes .fam-bt').count() === 13);
  await p.click('#av-lista .item:has-text("membros ativos")'); await p.waitForTimeout(300);
  confere('número: pede o Valor e esconde a data', await p.locator('#a-valor-wrap').isVisible() && !(await p.locator('#a-devento-wrap').isVisible()));
  await p.click('.lay[data-lay="evento"]');
  confere('evento: pede a data e esconde o Valor', !(await p.locator('#a-valor-wrap').isVisible()) && await p.locator('#a-devento-wrap').isVisible());
  await p.click('.lay[data-lay="progresso"]'); await p.fill('#a-valor', '88');
  await p.click('.fam-bt[data-fam="ion"]'); await p.waitForTimeout(200);
  confere('a prévia usa o mesmo desenho do quadro', await p.locator('#a-preview .sl-progresso.f-ion').count() === 1
    && /aria-valuenow="88"/.test(await p.locator('#a-preview').innerHTML()));
  await p.click('.lay[data-lay="citacao"]');
  confere('citação: os rótulos mudam (Quem disse, A frase)', await p.evaluate(() =>
    document.querySelector('#a-titulo').closest('.fld').querySelector('label').textContent === 'Quem disse'
    && document.querySelector('#a-corpo').closest('.fld').querySelector('label').textContent === 'A frase'));
  await p.click('.lay[data-lay="progresso"]');
  await p.click('#a-salvar'); await p.waitForTimeout(400);
  const w = await p.evaluate(() => (window.__escritas || []).filter(e => e.tabela === 'portal_avisos' && e.op === 'update').pop());
  confere('salvar grava layout, família e valor', w && w.dados.layout === 'progresso' && w.dados.familia === 'ion' && w.dados.valor === '88', w);
  await p.screenshot({ path:'avisos-editor.png', fullPage:true });
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
