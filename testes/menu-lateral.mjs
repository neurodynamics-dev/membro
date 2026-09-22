/* O menu lateral: a navegação saiu da barra de cima e foi para uma barra
   vertical à esquerda, recolhível, com os subitens de cada espaço.
   Confere, com asserção de verdade (sai com código 1 se algo falhar):
     1. aberto por padrão em tela larga, recolhido em tela estreita;
     2. a árvore: ordem dos espaços, ícone em cada um, subitens por papel;
     3. o item atual acende — inclusive quando a tela firma o endereço
        (#/atividades vira #/atividades/<quadro>) e na ficha (#/equipe/4);
     4. a seta abre e fecha uma seção sem sair da página;
     5. recolher: vira trilho, o conteúdo acompanha, a escolha sobrevive
        ao recarregar; o voo abre ao lado pelo mouse e pelo Tab, e cabe
        na tela mesmo quando o espaço é o último da lista;
     6. celular: barra de topo, gaveta inerte quando fechada, Esc fecha,
        navegar fecha;
     7. nenhuma largura cria rolagem horizontal;
     8. Informações filtra por categoria (o subitem novo).
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}

async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin, menu } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  if (menu) await p.addInitScript(v => { try { localStorage.setItem('nd.menu', v); } catch(e){} }, menu);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(700);
  return { ctx, p, erros };
}
const ir = async (p, hash, espera = 700) => { await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(espera); };
const atual = p => p.evaluate(() =>
  [...document.querySelectorAll('#lt-nav [aria-current="page"]')]
    .map(a => (a.querySelector('.nm, .lt-rot') || a).textContent.trim()));
const secao = (p, r) => p.evaluate(r => {
  const s = document.querySelector(`#lt-nav .lt-sec[data-r="${r}"]`);
  return s && { ativa: s.classList.contains('ativa'), aberta: s.classList.contains('aberta'),
    seta: s.querySelector('.lt-seta')?.getAttribute('aria-expanded'),
    filhos: [...s.querySelectorAll('.lt-filho')].map(a => a.querySelector('.nm').textContent),
    rotulos: [...s.querySelectorAll('.lt-rotulo')].map(x => x.textContent),
    visiveis: [...s.querySelectorAll('.lt-filho')].filter(a => a.offsetParent).length };
}, r);
const semRolagemLateral = p => p.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth);
/* Espera as transições terminarem. No Chromium sem tela a animação às
   vezes demora a partir, e medir num tempo fixo mediria o meio dela.
   (As animações dos blobs do fundo são infinitas; não são transição.) */
const quieto = p => p.waitForFunction(() =>
  !document.getAnimations().some(a => a instanceof CSSTransition), null, { timeout:4000 }).catch(() => {});

/* ---------- 1–4: aberto, árvore, item atual, seta ---------- */
console.log('\nAberto (admin, 1440px)');
{
  const { ctx, p, erros } = await abrir({ hash:'#/agenda/mes' });
  confere('abre aberto em tela larga, sem escolha salva',
    !(await p.evaluate(() => document.body.classList.contains('lt-recolhida'))));
  confere('largura do menu aberto é 252px',
    (await p.evaluate(() => Math.round(document.getElementById('hd').getBoundingClientRect().width))) === 252);
  const arvore = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec')].map(s => ({
    r: s.dataset.r, rot: s.querySelector('.lt-rot').textContent,
    icone: s.querySelector('.lt-item svg.ic')?.innerHTML.length || 0 })));
  confere('os oito espaços, na ordem',
    arvore.map(s => s.rot).join('|') ===
      'Início|Agenda|Atividades|Equipe|Informações|Serviços|Meus pedidos|Administração',
    arvore.map(s => s.rot));
  confere('todo espaço tem ícone', arvore.every(s => s.icone > 20), arvore);
  confere('Administração vem depois do divisor "Gestão"',
    await p.evaluate(() => document.querySelector('.lt-divisor')?.nextElementSibling?.dataset.r === 'admin'));

  let ag = await secao(p, 'agenda');
  confere('Agenda: ativa e aberta', ag.ativa && ag.aberta && ag.seta === 'true', ag);
  confere('Agenda: subitens são as abas da tela',
    ag.filhos.join('|') === 'Próximos|Mês|Agendar|Presença|Minha agenda', ag.filhos);
  confere('só "Mês" está marcado', JSON.stringify(await atual(p)) === '["Mês"]', await atual(p));
  const outra = await secao(p, 'servicos');
  confere('as outras seções começam fechadas', !outra.aberta && outra.visiveis === 0, outra);

  await ir(p, '#/atividades', 1000);
  confere('#/atividades firma o endereço no quadro que abriu',
    await p.evaluate(() => location.hash) === '#/atividades/DEP', await p.evaluate(() => location.hash));
  const atv = await secao(p, 'atividades');
  confere('Atividades: os quadros dos grupos da pessoa, e a carga',
    atv.rotulos.join() === 'Meus quadros' && atv.filhos.join('|') === 'Órtese|Carga da equipe', atv);
  confere('a Agenda fechou ao sair dela', !(await secao(p, 'agenda')).aberta);
  await ir(p, '#/atividades/ORT', 900);
  confere('#/atividades/ORT marca "Órtese"', JSON.stringify(await atual(p)) === '["Órtese"]', await atual(p));
  await ir(p, '#/atividades/carga', 900);
  confere('a carga marca "Carga da equipe"',
    JSON.stringify(await atual(p)) === '["Carga da equipe"]', await atual(p));

  await ir(p, '#/equipe/4', 1200);
  confere('a ficha (#/equipe/4) acende "Quadro de pessoal"',
    JSON.stringify(await atual(p)) === '["Quadro de pessoal"]', await atual(p));

  await ir(p, '#/informacoes/guia', 900);
  confere('Informações › Guias: marca o subitem', JSON.stringify(await atual(p)) === '["Guias"]');
  const docs = await p.evaluate(() => ({ h1: document.querySelector('main h1').textContent,
    titulos: [...document.querySelectorAll('.doc .tt')].map(t => t.textContent) }));
  confere('e a página mostra só a categoria',
    docs.h1 === 'Guias' && docs.titulos.join() === 'Guia do primeiro mês', docs);
  await ir(p, '#/informacoes/politica', 900);
  confere('categoria sem documento diz isso, com volta para a biblioteca',
    await p.evaluate(() => /Nenhum documento em Políticas/.test(document.querySelector('#docs-area').textContent)
      && !!document.querySelector('#docs-area a[href="#/informacoes"]')));

  await ir(p, '#/admin/contas', 1200);
  const adm = await secao(p, 'admin');
  confere('Administração: todos os painéis, em quatro grupos',
    adm.filhos.length === 13 && adm.rotulos.join() === 'Portal,Pessoas,Registro,Conteúdo', adm);
  confere('#/admin/contas marca "Contas e perfis"',
    JSON.stringify(await atual(p)) === '["Contas e perfis"]', await atual(p));
  await ir(p, '#/admin/site', 1200);
  confere('o último painel é rolado para dentro da lista',
    await p.evaluate(() => {
      const a = document.querySelector('#lt-nav [aria-current="page"]').getBoundingClientRect();
      const n = document.getElementById('lt-nav').getBoundingClientRect();
      return a.top >= n.top && a.bottom <= n.bottom;
    }));

  await ir(p, '#/', 700);
  confere('Início sem subitens: o próprio item fica marcado',
    JSON.stringify(await atual(p)) === '["Início"]', await atual(p));
  await p.click('#lt-nav .lt-sec[data-r="servicos"] .lt-seta');
  await p.waitForTimeout(200);
  let srv = await secao(p, 'servicos');
  confere('a seta abre Serviços sem navegar',
    srv.aberta && srv.seta === 'true' && srv.visiveis === 7 && await p.evaluate(() => location.hash) === '#/', srv);
  await p.click('#lt-nav .lt-sec[data-r="servicos"] .lt-filho[data-sub="ouvidoria"]');
  await p.waitForTimeout(700);
  confere('o subitem leva à tela', await p.evaluate(() => location.hash) === '#/servicos/ouvidoria');
  await p.click('#lt-nav .lt-sec[data-r="servicos"] .lt-seta');
  await p.waitForTimeout(200);
  confere('a seta fecha até a seção atual', !(await secao(p, 'servicos')).aberta);
  await ir(p, '#/agenda', 700); await ir(p, '#/servicos', 700);
  confere('e ela reabre ao voltar para Serviços', (await secao(p, 'servicos')).aberta);

  confere('sem rolagem horizontal (aberto, 1440px)', await semRolagemLateral(p));
  const col = await p.evaluate(() => ({ main: Math.round(document.getElementById('main').getBoundingClientRect().left),
    ft: Math.round(document.getElementById('ft').getBoundingClientRect().left) }));
  confere('o conteúdo e o rodapé começam depois do menu', col.main >= 252 && col.ft === 252, col);

  await p.click('#sino'); await p.waitForTimeout(250);
  const sino = await p.evaluate(() => { const r = document.getElementById('sino-painel').getBoundingClientRect();
    return { left: Math.round(r.left), bottom: Math.round(r.bottom), alto: innerHeight }; });
  confere('as notificações abrem ao lado do menu, dentro da tela',
    sino.left >= 252 && sino.bottom <= sino.alto, sino);
  await p.keyboard.press('Escape');

  /* ---------- 5: recolher ---------- */
  console.log('\nRecolher');
  await p.click('#lt-recolher'); await quieto(p);
  const rec = await p.evaluate(() => ({
    classe: document.body.classList.contains('lt-recolhida'),
    largura: Math.round(document.getElementById('hd').getBoundingClientRect().width),
    main: Math.round(document.getElementById('main').getBoundingClientRect().left),
    salvo: localStorage.getItem('nd.menu'),
    aria: document.getElementById('lt-recolher').getAttribute('aria-expanded') }));
  confere('vira trilho de 68px e a escolha fica salva',
    rec.classe && rec.largura === 68 && rec.salvo === 'recolhido' && rec.aria === 'false', rec);
  confere('o conteúdo ocupa o espaço que sobrou', rec.main < 252, rec);
  const itens = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-item, #hd .lt-pe .lt-item:not([hidden])')]
    .map(a => { const r = a.getBoundingClientRect(),
      i = [...a.querySelectorAll('.ic, .avx')].map(e => e.getBoundingClientRect()).find(b => b.width > 0);
      return { l: Math.round(r.left), w: Math.round(r.width), ic: i ? Math.round(i.left + i.width / 2) : null }; }));
  confere('no trilho, todo item cabe nos 48px e o ícone fica no eixo (x=34)',
    itens.every(t => t.l === 10 && t.w <= 48 && t.ic === 34), itens);
  confere('sem rolagem horizontal (trilho)', await semRolagemLateral(p));

  await p.reload({ waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])'); await p.waitForTimeout(700);
  confere('continua recolhido depois de recarregar',
    await p.evaluate(() => document.body.classList.contains('lt-recolhida')));

  const vooVisivel = async (r) => { await quieto(p); return p.evaluate(r => {
    const s = document.querySelector(`#lt-nav .lt-sec[data-r="${r}"] > .lt-sub`);
    const cs = getComputedStyle(s), b = s.getBoundingClientRect(), v = s.firstElementChild.getBoundingClientRect();
    const i = document.querySelector(`#lt-nav .lt-sec[data-r="${r}"] .lt-item`).getBoundingClientRect();
    return { visivel: cs.visibility === 'visible' && +cs.opacity > .9,
             left: Math.round(b.left), top: Math.round(v.top), bottom: Math.round(v.bottom),
             topoDoIcone: Math.round(i.top), alto: innerHeight };
  }, r); };
  await p.hover('#lt-nav .lt-sec[data-r="agenda"] .lt-item');
  let v = await vooVisivel('agenda');
  confere('mouse no ícone da Agenda abre o voo ao lado do trilho, na altura dele',
    v.visivel && v.left >= 68 && Math.abs(v.top - v.topoDoIcone) <= 6, v);
  await p.hover('#lt-nav .lt-sec[data-r="agenda"] .lt-filho[data-sub="presenca"]');
  await p.click('#lt-nav .lt-sec[data-r="agenda"] .lt-filho[data-sub="presenca"]');
  await p.waitForTimeout(700);
  confere('o subitem do voo navega', await p.evaluate(() => location.hash) === '#/agenda/presenca');
  await p.mouse.move(900, 500);
  confere('tirar o mouse fecha o voo (o clique não o prende aberto)', !(await vooVisivel('agenda')).visivel);

  await p.hover('#lt-nav .lt-sec[data-r="admin"] .lt-item');
  v = await vooVisivel('admin');
  confere('o voo do último espaço sobe para caber na tela', v.visivel && v.bottom <= v.alto && v.top >= 0, v);
  await p.mouse.move(900, 500); await quieto(p);

  /* janela baixa: a lista do trilho rola, e o último espaço continua ao
     alcance — antes ele ficava escondido atrás do pé do menu */
  await p.setViewportSize({ width:1440, height:520 });
  await p.hover('#lt-nav .lt-sec[data-r="admin"] .lt-item', { timeout:5000 });
  v = await vooVisivel('admin');
  const baixa = await p.evaluate(() => {
    const voo = document.querySelector('#lt-nav .lt-sec[data-r="admin"] .lt-voo'), b = voo.getBoundingClientRect();
    return { top: Math.round(b.top), bottom: Math.round(b.bottom), alto: innerHeight,
             rola: voo.scrollHeight > voo.clientHeight };
  });
  confere('em janela baixa o último espaço é alcançável e o voo rola por dentro',
    v.visivel && baixa.top >= 0 && baixa.bottom <= baixa.alto && baixa.rola, { v, baixa });
  await p.mouse.move(900, 300);
  await p.setViewportSize({ width:1440, height:960 }); await quieto(p);

  /* pelo teclado: Tab a partir da busca chega ao Início e depois à Agenda */
  await p.focus('#busca-abre');
  await p.keyboard.press('Tab'); await p.keyboard.press('Tab');
  const foco = await p.evaluate(() => document.activeElement.closest('.lt-sec')?.dataset.r);
  v = await vooVisivel('agenda');
  confere('Tab no trilho abre o voo da seção focada', foco === 'agenda' && v.visivel, { foco, v });
  await p.keyboard.press('Tab');
  confere('e o Tab seguinte entra nos subitens',
    await p.evaluate(() => document.activeElement.classList.contains('lt-filho')));

  await p.click('#lt-recolher'); await quieto(p);
  confere('expandir de novo volta aos 252px',
    await p.evaluate(() => Math.round(document.getElementById('hd').getBoundingClientRect().width)) === 252);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- tela estreita sem escolha salva ---------- */
{
  console.log('\nTela estreita (1180px)');
  const { ctx, p } = await abrir({ vp:{ width:1180, height:800 } });
  confere('sem escolha salva, começa recolhido',
    await p.evaluate(() => document.body.classList.contains('lt-recolhida')));
  confere('sem rolagem horizontal (1180px)', await semRolagemLateral(p));
  await ir(p, '#/atividades', 1000);
  confere('o quadro cabe sem rolagem horizontal (1180px, trilho)', await semRolagemLateral(p));
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ vp:{ width:1180, height:800 }, menu:'aberto' });
  confere('mas respeita quem escolheu aberto',
    !(await p.evaluate(() => document.body.classList.contains('lt-recolhida'))));
  await ctx.close();
}

/* ---------- 6: celular ---------- */
console.log('\nCelular (390px)');
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/agenda' });
  const fechado = await p.evaluate(() => ({
    topo: getComputedStyle(document.getElementById('topo-m')).display,
    fora: document.getElementById('hd').getBoundingClientRect().right <= 0,
    inerte: document.getElementById('hd').inert,
    sino: !document.getElementById('sino-m').hidden }));
  confere('barra de topo à mostra, gaveta fora da tela e inerte, sino no topo',
    fechado.topo === 'flex' && fechado.fora && fechado.inerte && fechado.sino, fechado);
  confere('sem rolagem horizontal (celular)', await semRolagemLateral(p));
  await p.click('#burger'); await quieto(p);
  const aberta = await p.evaluate(() => ({
    classe: document.body.classList.contains('menu-open'),
    dentro: document.getElementById('hd').getBoundingClientRect().left >= 0,
    inerte: document.getElementById('hd').inert,
    aria: document.getElementById('burger').getAttribute('aria-expanded'),
    foco: document.activeElement.closest('#hd') !== null,
    recolher: getComputedStyle(document.getElementById('lt-recolher')).display }));
  confere('o botão abre a gaveta, com o foco dentro dela',
    aberta.classe && aberta.dentro && !aberta.inerte && aberta.aria === 'true' && aberta.foco, aberta);
  confere('na gaveta não existe "recolher"', aberta.recolher === 'none', aberta);
  await p.keyboard.press('Escape'); await quieto(p);
  confere('Esc fecha e devolve o foco ao botão',
    await p.evaluate(() => !document.body.classList.contains('menu-open')
      && document.getElementById('hd').inert && document.activeElement.id === 'burger'));
  await p.click('#burger'); await p.waitForTimeout(400);
  await p.click('#lt-nav .lt-sec[data-r="agenda"] .lt-filho[data-sub="minha"]');
  await p.waitForTimeout(700);
  confere('escolher um subitem navega e fecha a gaveta',
    await p.evaluate(() => location.hash === '#/agenda/minha' && !document.body.classList.contains('menu-open')));
  await p.click('#lt-veu', { force:true }).catch(() => {});
  await p.click('#burger'); await p.waitForTimeout(400);
  await p.mouse.click(370, 500); await p.waitForTimeout(350);
  confere('tocar fora da gaveta fecha', !(await p.evaluate(() => document.body.classList.contains('menu-open'))));
  await p.click('#sino-m'); await p.waitForTimeout(250);
  const sn = await p.evaluate(() => { const r = document.getElementById('sino-painel').getBoundingClientRect();
    return { visivel: !document.getElementById('sino-painel').hidden, dentro: r.left >= 0 && r.right <= innerWidth }; });
  confere('o sino do topo abre as notificações dentro da tela', sn.visivel && sn.dentro, sn);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 2: por papel ---------- */
console.log('\nPor papel');
for (const [papel, esperado] of [
  ['leitura', { admin:null, quadroPessoal:false }],
  ['selecao', { admin:'Todos os painéis|Relatórios', quadroPessoal:false }],
  ['pessoal', { admin:13, quadroPessoal:true }]
]){
  const { ctx, p } = await abrir({ stub: stubDe(papel) });
  const adm = await secao(p, 'admin'), eq = await secao(p, 'equipe');
  const okAdm = esperado.admin === null ? adm === null
    : typeof esperado.admin === 'number' ? adm?.filhos.length === esperado.admin
    : adm?.filhos.join('|') === esperado.admin;
  confere(`${papel}: Administração ${esperado.admin === null ? 'não aparece' : 'mostra só o que o papel abre'}`,
    okAdm, adm?.filhos ?? null);
  confere(`${papel}: "Quadro de pessoal" ${esperado.quadroPessoal ? 'aparece' : 'não aparece'} em Equipe`,
    eq.filhos.includes('Quadro de pessoal') === esperado.quadroPessoal, eq.filhos);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
