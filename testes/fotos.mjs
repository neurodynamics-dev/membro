/* 2.24.0 e 2.25.0: o banco de fotos, sem votação. A curadoria no Studio
   (as sugestões, escolher e pôr no banco, descartar, o filtro, a busca,
   as descartadas, pôr por link, quem não é da gestão), a galeria na
   Marca (busca por texto e por tag, o detalhe, editar, tirar, copiar a
   lista), o criador (a fonte Galeria, as fotos do banco que entram
   sozinhas e o botão Do banco), os menus e o endereço antigo
   /curadoria/. Sem banco: stub-supabase.js mais o complemento
   stub-fotos.js.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const STUB = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('./stub-fotos.js', import.meta.url), 'utf8');
/* uma imagem de verdade, com CORS, no lugar das fotos dos bancos */
const JPG = Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKp//9k=', 'base64');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { largura = 1440, altura = 960, caminho = 'index.html' } = {}){
  const ctx = await nav.newContext({ viewport:{ width:largura, height:altura } }); ctx.setDefaultTimeout(10000);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin:'http://localhost:8765' });
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
  await p.route(/images\.unsplash\.com|unsplash\.com\/photos\/.*\/download|images\.pexels\.com/, r =>
    r.fulfill({ contentType:'image/jpeg', body:JPG, headers:{ 'Access-Control-Allow-Origin':'*' } }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|pokeapi|brand\.neurodynamics|api\.unsplash|api\.pexels/, r => r.abort());
  await p.goto('http://localhost:8765/' + caminho + hash, { waitUntil:'domcontentloaded' });
  if (caminho === 'index.html') await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const ir = async (p, h, ms = 600) => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(ms); };
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);
const toastTxt = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const titulos = p => p.locator('.ft-escolha .ft-tile h3').allInnerTexts();
const stub = (p, id) => p.evaluate(id => __stubDados.fotos.find(f => f.banco_id === id)?.status, id);

try {
  console.log('Curadoria, no Studio');
  {
    const t = await abrir('#/studio/curadoria'), { p } = t;
    await p.waitForSelector('.ft-escolha .ft-tile');
    confere('a tela é do Studio: o título, a seção Curadoria e as abas', (await p.locator('.cab h1').innerText()) === 'Curadoria de fotos'
      && (await p.locator('.nav1 a.on').innerText()).startsWith('Curadoria') && (await p.locator('.abas a').allInnerTexts()).join('|').replace(/\s*\d+/g, '') === 'Sugestões|Descartadas');
    confere('as sugestões, sem votação: nada de cartão para arrastar', (await p.locator('.ft-escolha .ft-tile').count()) === 5
      && (await p.locator('.ft-cartao, #ft-sim, #ft-desfazer').count()) === 0);
    confere('a que veio por link vem primeiro', (await titulos(p))[0] === 'Silhueta de pessoa ao microscópio');
    confere('sem nada escolhido, a barra não aparece', await p.locator('#ft-barra').isHidden());
    await p.click('.ft-marcar[aria-label="Escolher: Três béqueres sobre a bancada"]');
    await p.click('.ft-marcar[aria-label="Escolher: Pipeta enchendo microtubos"]');
    confere('escolher marca o cartão e conta na barra', (await p.locator('.ft-tile.on').count()) === 2
      && (await p.locator('#ft-barra-n').innerText()) === '2 escolhidas' && await p.locator('#ft-barra').isVisible());
    confere('um só botão sólido na tela: Pôr no banco', (await p.locator('#main .btn.solid').count()) === 1 && (await p.locator('#main .btn.solid').innerText()).includes('Pôr 2 no banco'));
    await p.click('#ft-por'); await p.waitForTimeout(500);
    const d1 = (await rpcs(p, 'fotos_decidir')).at(-1)?.p;
    confere('pôr no banco decide as duas de uma vez', d1?.p_status === 'aprovada' && d1.p_ids.length === 2, d1);
    confere('e diz quantas entraram', (await toastTxt(p)).includes('2 fotos entraram no banco'));
    confere('as duas saem das sugestões e entram no banco', (await p.locator('.ft-escolha .ft-tile').count()) === 3 && (await stub(p, 'lQGJCMY5qcM')) === 'aprovada');
    await p.click('.ft-marcar[aria-label="Escolher: Quarto de hospital com leito e monitor"]');
    await p.click('#ft-barra button:has-text("Descartar")'); await p.waitForTimeout(500);
    confere('descartar tira das sugestões', (await rpcs(p, 'fotos_decidir')).at(-1)?.p?.p_status === 'descartada' && (await p.locator('.ft-escolha .ft-tile').count()) === 2);
    await p.selectOption('#ft-ctema', 'hospital'); await p.waitForTimeout(200);
    confere('o filtro de tema', (await titulos(p)).join('|') === 'Treinamento de UTI em simulação');
    await p.selectOption('#ft-ctema', ''); await p.waitForTimeout(200);
    await p.fill('#ft-cq', 'microscopio'); await p.waitForTimeout(450);
    confere('a busca acha pela tag, sem acento', (await titulos(p)).join('|') === 'Silhueta de pessoa ao microscópio');
    await p.fill('#ft-cq', ''); await p.waitForTimeout(450);

    await ir(p, '#/studio/curadoria/descartadas', 700);
    confere('as descartadas: a de agora e a de antes', (await p.locator('.ft-escolha .ft-tile').count()) === 2 && (await p.locator('.abas a.on').innerText()) === 'Descartadas');
    await p.click('.ft-marcar[aria-label="Escolher: Corredor vazio entre paredes brancas"]');
    await p.click('#ft-barra button:has-text("Devolver às sugestões")'); await p.waitForTimeout(500);
    confere('e devolver às sugestões', (await rpcs(p, 'fotos_decidir')).at(-1)?.p?.p_status === 'fila' && (await stub(p, 'pfAnqlk3Oiw')) === 'fila');

    await ir(p, '#/studio/curadoria', 700);
    await p.click('button:has-text("Pôr por link")'); await p.waitForTimeout(200);
    await p.fill('#ft-lk', 'https://unsplash.com/pt-br/fotografias/um-leito-de-uti-AbCdEfGhIjKhttps://www.pexels.com/pt-br/foto/medico-ao-lado-1234567/');
    await p.selectOption('#ft-lk-tema', 'hospital'); await p.fill('#ft-lk-tags', 'UTI, leito');
    await p.click('#modal button:has-text("Pôr no banco")'); await p.waitForTimeout(500);
    const ad = (await rpcs(p, 'fotos_adicionar')).at(-1)?.p?.p_fotos || [];
    confere('pôr por link lê os dois endereços colados juntos', ad.length === 2 && ad[0].banco_id === 'AbCdEfGhIjK' && ad[0].banco === 'unsplash'
      && ad[1].banco === 'pexels' && ad[1].banco_id === '1234567', ad);
    confere('com o tema e as tags', ad.every(f => f.tema === 'hospital' && f.tags.join() === 'UTI,leito' && f.origem === 'link'));
    confere('e as fotos entram direto no banco', (await toastTxt(p)).includes('2 fotos entraram no banco') && (await stub(p, 'AbCdEfGhIjK')) === 'aprovada');
    await p.click('button:has-text("Buscar nos bancos")'); await p.waitForTimeout(200);
    confere('sem chave, a busca manda para as configurações', (await p.locator('#modal .aviso-box').innerText()).includes('Configurações'));
    await p.click('#modal button:has-text("Fechar")');

    await ir(p, '#/studio/curadoria/votos', 700);
    confere('o endereço antigo dos votos abre as sugestões', (await p.locator('.abas a.on').innerText()).startsWith('Sugestões'));
    await p.evaluate(() => { state.perfil.papeis = ['leitura']; state.perfil.papel = 'leitura'; state.studioCfg.grupos_aprovadores = []; ftCurDesenha(); });
    confere('quem não é da gestão vê as sugestões, sem escolher nem pôr', (await p.locator('.ft-marcar, #ft-barra').count()) === 0
      && (await p.locator('.cab button:has-text("Pôr por link")').count()) === 0 && (await p.locator('#main .aviso-box.info').innerText()).includes('Galeria de fotos'));
    await fechar(t);
  }

  console.log('Curadoria no celular');
  {
    const t = await abrir('#/studio/curadoria', { largura:390, altura:844 }), { p } = t;
    await p.waitForSelector('.ft-escolha .ft-tile');
    await p.click('.ft-marcar >> nth=0'); await p.waitForTimeout(150);
    const m = await p.evaluate(() => { const b = $('#ft-barra').getBoundingClientRect();
      return { larg: document.documentElement.scrollWidth <= innerWidth + 1, barra: b.bottom <= innerHeight + 1 && b.top >= 0 }; });
    confere('a grade cabe na tela e a barra das escolhidas fica à vista', m.larg && m.barra, m);
    await fechar(t);
  }

  console.log('Galeria, na Marca');
  {
    const t = await abrir('#/marca/fotos'), { p } = t;
    await p.waitForSelector('.ft-galeria .ft-tile');
    confere('a galeria é da Marca, com a seção acesa', (await p.locator('.cab h1').innerText()) === 'Galeria de fotos' && (await p.locator('.nav1 a.on').innerText()) === 'Galeria de fotos');
    confere('só as aprovadas', (await p.locator('.ft-tile').count()) === 3);
    await p.fill('#ft-gq', 'uti'); await p.waitForTimeout(450);
    confere('busca por texto acha pela tag, sem acento nem maiúscula', (await p.locator('.ft-tile').count()) === 1
      && (await p.locator('.ft-tile h3').innerText()) === 'Monitor com sinais vitais em verde');
    await p.fill('#ft-gq', ''); await p.waitForTimeout(450);
    await p.click('.ft-tags .chip[data-t="microscópio"]'); await p.waitForTimeout(200);
    confere('a tag filtra', (await p.locator('.ft-tile').count()) === 1 && (await p.locator('.ft-tile h3').innerText()).includes('microscópio'));
    await p.selectOption('#ft-gtema', 'equipe'); await p.waitForTimeout(200);
    confere('tag e tema juntos: nada, e o vazio oferece limpar', (await p.locator('.ft-tile').count()) === 0 && (await p.locator('.vazio button:has-text("Limpar filtros")').count()) === 1);
    await p.click('.vazio button:has-text("Limpar filtros")'); await p.waitForTimeout(200);
    confere('limpar volta às três', (await p.locator('.ft-tile').count()) === 3);

    await p.click('.ft-tile-foto[aria-label="Pessoas programando em monitores"]'); await p.waitForTimeout(200);
    const det = await p.locator('#modal').innerText();
    confere('o detalhe: tema, tags, autor, licença e a peça da aprovação', /Equipe e desenvolvimento/.test(det) && /Compagnons/.test(det)
      && /Licença Unsplash/.test(det) && /Feed 4:5, Impulso/.test(det), det.slice(0, 200));
    await p.click('#modal button:has-text("Editar")'); await p.waitForTimeout(150);
    await p.fill('#ft-e-tags', 'equipe, código, monitores'); await p.click('#modal button:has-text("Salvar")'); await p.waitForTimeout(400);
    confere('editar salva as tags', JSON.stringify((await rpcs(p, 'foto_salvar')).at(-1)?.p?.tags) === '["equipe","código","monitores"]');
    await p.click('button:has-text("Copiar a lista")'); await p.waitForTimeout(300);
    const lista = JSON.parse(await p.evaluate(() => navigator.clipboard.readText()));
    confere('copiar a lista leva as fotos em JSON, com os links', lista.fotos.length === 3 && lista.fotos.every(f => f.pagina && f.tags)
      && lista.fotos.some(f => /images\.unsplash\.com\/photo-1/.test(f.imagem || '')), lista.fotos[0]);
    await p.click('.ft-tile-foto[aria-label="Corredor vazio entre paredes brancas"]').catch(() => {});
    confere('a descartada não aparece', (await p.locator('.ft-tile-foto[aria-label="Corredor vazio entre paredes brancas"]').count()) === 0);
    await p.click('.ft-tile-foto[aria-label="Monitor com sinais vitais em verde"]'); await p.waitForTimeout(150);
    await p.click('#modal button:has-text("Tirar da galeria")'); await p.waitForTimeout(150);
    await p.click('#modal button.solid:has-text("Tirar da galeria")'); await p.waitForTimeout(400);
    confere('a gestão tira da galeria', (await rpcs(p, 'foto_status_definir')).at(-1)?.p?.p_status === 'descartada' && (await p.locator('.ft-tile').count()) === 2);
    await fechar(t);
  }

  console.log('A galeria no criador');
  {
    const t = await abrir('#/studio/criar/aniversario'), { p } = t;
    await p.waitForSelector('.cr-foto button:has-text("Galeria")');
    await p.click('.cr-foto button:has-text("Galeria")'); await p.waitForTimeout(600);
    confere('o seletor mostra a galeria', (await p.locator('#ft-esc .cr-us-f').count()) === 3);
    await p.fill('#ft-esc-q', 'microscópio'); await p.waitForTimeout(150);
    await p.click('#ft-esc .cr-us-f'); await p.waitForTimeout(400);
    confere('foto sem endereço e sem chave: o aviso diz o que fazer', (await toastTxt(p)).includes('chave do Unsplash'));
    await p.fill('#ft-esc-q', 'programando'); await p.waitForTimeout(150);
    await p.click('#ft-esc .cr-us-f'); await p.waitForTimeout(800);
    const im = await p.evaluate(() => Object.values(criador.imgs).find(i => i.origem === 'galeria'));
    confere('a foto entra na peça, com o crédito', !!im && im.credito === 'Compagnons / Unsplash' && /images\.unsplash\.com\/photo-1/.test(im.url), im && { c:im.credito, u:im.url });
    confere('e o modal fecha', !(await p.evaluate(() => $('#modal').classList.contains('open'))));
    await fechar(t);
  }

  console.log('As fotos do banco, sozinhas, no criador');
  {
    const t = await abrir('#/studio/criar/projeto'), { p } = t;
    await p.waitForFunction(() => Object.values(criador.imgs || {}).some(i => i.origem === 'galeria'), null, { timeout:8000 }).catch(() => {});
    const im = await p.evaluate(() => Object.values(criador.imgs).filter(i => i.origem === 'galeria').map(i => ({ c:i.credito, u:i.url, id:i.fotoId })));
    confere('a peça nova já vem com fotos do banco, com o crédito', im.length >= 1 && im.every(i => /images\.unsplash\.com\/photo-[12]/.test(i.u) && / \/ Unsplash$/.test(i.c)), im);
    confere('sem repetir foto na peça', new Set(im.map(i => i.id)).size === im.length);
    confere('e diz de onde vieram', (await toastTxt(p)).includes('banco de fotos'));
    const antes = await p.evaluate(() => criador.imgs[crLamina().fotos.foto.ref]?.fotoId);
    await p.click('.cr-foto button:has-text("Do banco")'); await p.waitForTimeout(800);
    const depois = await p.evaluate(() => criador.imgs[crLamina().fotos.foto.ref]?.fotoId);
    confere('Do banco troca por outra foto do banco', !!depois && depois !== antes, { antes, depois });
    await fechar(t);
    const t2 = await abrir('#/studio/criar/aniversario'), { p:p2 } = t2;
    await p2.waitForSelector('.cr-foto'); await p2.waitForTimeout(1200);
    confere('a lâmina de pessoa espera a foto da equipe', (await p2.evaluate(() => Object.values(criador.imgs).length)) === 0);
    await fechar(t2);
  }

  console.log('Menus e o endereço antigo');
  {
    const t = await abrir('#/studio'), { p } = t;
    const menu = await p.evaluate(() => arvoreDoMenu().map(e => ({ r:e.r, filhos:(e.filhos || []).map(f => [f.r || e.r, f.sub, f.rot]) })));
    const filho = (r, sub, rot) => menu.some(e => e.filhos.some(([fr, fs, fl]) => fr === r && fs === sub && fl === rot));
    confere('o Studio tem a Curadoria de fotos no menu', filho('studio', 'curadoria', 'Curadoria de fotos'));
    confere('e Serviços, Marca, a Galeria de fotos', filho('marca', 'fotos', 'Galeria de fotos'));
    await ir(p, '#/marca/fotos', 900);
    confere('na galeria, o subitem dela acende (e não o de Modelos)', await p.evaluate(() =>
      [...document.querySelectorAll('[aria-current="page"], .on')].some(a => /Galeria de fotos/.test(a.textContent))
      && ![...document.querySelectorAll('.menu-lat a.on, #menu a.on, nav a.on')].some(a => a.textContent.trim() === 'Modelos')));
    await fechar(t);
    const ctx = await nav.newContext(); const p2 = await ctx.newPage();
    await p2.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
    await p2.route(/fonts\.googleapis|raw\.githubusercontent|pokeapi|brand\.neurodynamics/, r => r.abort());
    await p2.goto('http://localhost:8765/curadoria/'); await p2.waitForTimeout(1500);
    confere('/curadoria/ leva à curadoria no Studio', /#\/studio\/curadoria$/.test(p2.url()), p2.url());
    await ctx.close();
  }
} finally {
  await nav.close();
}
console.log(`\n${checks - falhas}/${checks} ok`);
process.exitCode = falhas ? 1 : 0;
