/* O quadro depois da v17: espaço, seletor de grupo, nível de acesso
   e o cartão com brilho no topo em vez de barra lateral. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const p = await nav.newPage({ viewport:{ width:1440, height:900 } });
const erros = [];
p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message));
p.on('console', m => { if (m.type()==='error' && !/net::|Failed to load resource/.test(m.text())) erros.push('CONSOLE: '+m.text()); });
await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
await p.route('**/fonts.googleapis.com/**', r => r.abort());
await p.route('**/raw.githubusercontent.com/**', r => r.abort());
await p.goto('http://localhost:8765/index.html', { waitUntil:'domcontentloaded' });
await p.waitForSelector('#hd:not([hidden])', { timeout:9000 });
const out = {};

/* ---------- 1. sem abas; um seletor só ---------- */
await p.evaluate(() => location.hash = '#/atividades/ORT');
await p.waitForSelector('.kb-card', { timeout:9000 });
out.abasDeGrupo   = await p.locator('nav.abas').count();          // deve ser 0
out.grupoNoBotao  = (await p.locator('.grp-btn .nm').textContent()).trim();
out.prefixoNoBotao= (await p.locator('.grp-btn .pf').textContent()).trim();

await p.click('.grp-btn');
await p.waitForSelector('#grp-pop:not([hidden])');
out.grupoNaLista  = await p.locator('.grp-item .nm').allTextContents();
out.travadosNaLista = await p.locator('.grp-item.travado .nm').allTextContents();
out.marcadoLeitura  = await p.locator('.grp-item .tag').allTextContents();
/* fecha clicando fora — que é o comportamento que interessa testar */
await p.mouse.click(1200, 120);
await p.waitForTimeout(150);
out.popoverFechaClicandoFora = await p.evaluate(() => document.getElementById('grp-pop').hidden);

/* ---------- 2. sem rolagem horizontal, colunas ocupando a janela ---------- */
const m = await p.evaluate(() => {
  const k = document.getElementById('kanban');
  const cols = [...document.querySelectorAll('.kb-col')];
  return {
    colunas: cols.length,
    rolagemHorizontalDoQuadro: k.scrollWidth - k.clientWidth,
    rolagemHorizontalDaPagina: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    alturaQuadro: Math.round(k.getBoundingClientRect().height),
    sobraAbaixo: Math.round(window.innerHeight - k.getBoundingClientRect().bottom),
    larguras: cols.map(c => Math.round(c.getBoundingClientRect().width)),
    colunaRolaPorDentro: getComputedStyle(document.querySelector('.kb-itens')).overflowY
  };
});
Object.assign(out, m);

/* ---------- 3. o cartão ---------- */
const c = await p.evaluate(() => {
  const el = document.querySelector('.kb-card');
  const cs = getComputedStyle(el), antes = getComputedStyle(el, '::before');
  const sin = document.querySelector('.kb-card.sinalizada');
  return {
    temSombra: cs.boxShadow !== 'none',
    bordaEsquerda: cs.borderLeftWidth,
    brilhoNoTopo: { top: antes.top, altura: antes.height, sombra: antes.boxShadow.slice(0, 40) },
    corDoBrilho: el.style.getPropertyValue('--pri'),
    corDoBrilhoSinalizado: sin ? sin.style.getPropertyValue('--pri') : null,
    arrastavel: el.getAttribute('draggable'),
    cursor: cs.cursor
  };
});
out.cartao = c;

// como fica na mão
await p.evaluate(() => document.querySelector('.kb-card').classList.add('mov'));
out.cartaoNaMao = await p.evaluate(() => {
  const cs = getComputedStyle(document.querySelector('.kb-card.mov'));
  return { transform: cs.transform !== 'none', sombra: cs.boxShadow.split('rgba').length - 1 + ' camadas' };
});
await p.evaluate(() => document.querySelector('.kb-card').classList.remove('mov'));
await p.screenshot({ path:new URL('./quadro.png', import.meta.url).pathname });

/* ---------- 4. quadro fechado ---------- */
await p.evaluate(() => location.hash = '#/atividades/GER');
await p.waitForSelector('.kb-fechado', { timeout:9000 });
out.fechado = {
  titulo: (await p.locator('.kb-fechado h3').textContent()).trim(),
  cartoesVazando: await p.locator('.kb-card').count(),          // 0
  temBotaoNova: await p.locator('button:has-text("Nova atividade")').count(),
  aindaAparaceNoSeletor: (await p.locator('.grp-btn .nm').textContent()).trim()
};
await p.screenshot({ path:new URL('./quadro-fechado.png', import.meta.url).pathname });

/* ---------- 5. quadro de leitura: vê, mas não mexe ---------- */
await p.evaluate(() => location.hash = '#/atividades/SIN');
await p.waitForTimeout(600);
out.leitura = {
  selo: await p.locator('.kb-selo').count(),
  botaoNova: await p.locator('button:has-text("Nova atividade")').count(),
  botaoMaisAtividade: await p.locator('.kb-add').count(),
  cartaoArrastavel: await p.locator('.kb-card[draggable="true"]').count()
};

/* ---------- 6. painel de grupos ---------- */
await p.evaluate(() => location.hash = '#/admin/grupos');
await p.waitForSelector('#sec-grupos table', { timeout:9000 });
out.painel = {
  linhas: await p.locator('#sec-grupos tbody tr').count(),
  prefixos: await p.locator('#sec-grupos .cod-pf').allTextContents(),
  fechados: await p.locator('#sec-grupos .pill.p-warn').count()
};
await p.click('#sec-grupos tbody tr:nth-child(4) button[title="Quem enxerga"]');
await p.waitForSelector('#ac-quem', { timeout:5000 });
out.concessao = { pessoasDisponiveis: await p.locator('#ac-quem option').count() };
await p.selectOption('#ac-quem', { index: 1 });
await p.selectOption('#ac-nivel', 'leitura');
await p.click('#ac-btn');
await p.waitForTimeout(500);
out.concessao.enviado = await p.evaluate(() => window.__acessoSalvo ?? null);
await p.screenshot({ path:new URL('./grupos.png', import.meta.url).pathname });

/* ---------- 7. estreito: empilha, sem rolagem horizontal ---------- */
await p.setViewportSize({ width: 430, height: 880 });
await p.evaluate(() => location.hash = '#/atividades/ORT');
await p.waitForSelector('.kb-card', { timeout:9000 });
await p.waitForTimeout(300);
out.celular = await p.evaluate(() => ({
  colunasPorLinha: getComputedStyle(document.getElementById('kanban')).gridTemplateColumns.split(' ').length,
  rolagemHorizontal: document.documentElement.scrollWidth - document.documentElement.clientWidth
}));

out.erros = erros;
console.log(JSON.stringify(out, null, 1));
await nav.close();
