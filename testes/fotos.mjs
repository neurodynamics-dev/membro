/* 2.24.0 a 2.26.0: o banco de imagens. A avaliação no Studio (uma foto
   de cada vez nas peças da NRO, aprovar e rejeitar sem votação, a peça
   e a paleta, desfazer, pular, arrastar, o filtro de tema, pôr por link
   só para admin e para a avaliação, nenhuma tela de rejeitadas, quem gere sem ser
   admin, quem só entra no Studio, o celular e os endereços antigos), a
   galeria na Marca (busca por texto e por tag, o detalhe, editar,
   tirar, copiar a lista), o criador (a fonte Galeria, as fotos do banco
   que entram sozinhas e o botão Do banco), os menus e o endereço antigo
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
const metaT = p => p.locator('#ft-meta .ft-meta-t').innerText();
const stub = (p, id) => p.evaluate(id => __stubDados.fotos.find(f => f.banco_id === id)?.status, id);

try {
  console.log('Banco de imagens, no Studio: a avaliação');
  {
    const t = await abrir('#/studio/banco'), { p } = t;
    await p.waitForSelector('.ft-cartao:not(.atras) .ft-arte');
    confere('a tela é do Studio: o título, a seção Banco de imagens e as abas', (await p.locator('.cab h1').innerText()) === 'Banco de imagens'
      && (await p.locator('.nav1 a.on').innerText()).startsWith('Banco de imagens') && (await p.locator('.abas').count()) === 0);
    confere('nada de rejeitadas na tela', (await p.locator('#main').innerText()).match(/Rejeitadas/) === null && (await p.locator('a[href*="rejeitadas"]').count()) === 0);
    confere('um só botão sólido na tela: Aprovar', (await p.locator('#main .btn.solid').count()) === 1 && (await p.locator('#main .btn.solid').innerText()).includes('Aprovar'));
    confere('aprovar, rejeitar, pular e desfazer', (await p.locator('#ft-nao').innerText()).includes('Rejeitar') && (await p.locator('#ft-pular').count()) === 1
      && (await p.locator('#ft-desfazer').count()) === 1);
    confere('sem votação: nada de talvez nem de votos', (await p.locator('#main').innerText()).match(/Talvez|votos|Meus votos/) === null);
    confere('a posta por link vem primeiro', (await metaT(p)) === 'Silhueta de pessoa ao microscópio');
    confere('com as tags e a origem', (await p.locator('#ft-meta').innerText()).includes('microscópio') && (await p.locator('#ft-meta').innerText()).includes('Posta por link'));
    confere('a peça começa no Feed, em Cortex', await p.evaluate(() => !!document.querySelector('.ft-cartao:not(.atras) .ft-arte.ft-feed.f-cortex')));
    const semDegrade = await p.evaluate(() => [...document.querySelectorAll('.ft-arte, .ft-arte *')].every(el =>
      !/radial-gradient/.test(getComputedStyle(el).backgroundImage) && !/blur/.test(getComputedStyle(el).filter + getComputedStyle(el).backdropFilter)));
    confere('a peça é chapada: sem brilho nem desfoque', semDegrade);

    await p.click('.ft-seg button:has-text("Story")'); await p.waitForTimeout(150);
    await p.click('.ft-pal[title="Retina"]'); await p.waitForTimeout(150);
    confere('troca a peça e a paleta', await p.evaluate(() => !!document.querySelector('.ft-cartao:not(.atras) .ft-arte.ft-story.f-retina')));
    const prop = await p.evaluate(() => { const r = document.querySelector('.ft-cartao:not(.atras)').getBoundingClientRect(); return r.width / r.height; });
    confere('o cartão do Story tem 9:16', Math.abs(prop - 9 / 16) < .02, prop);
    for (const enq of ['Banda', 'Site', 'Feed']){
      await p.click(`.ft-seg button:has-text("${enq}")`); await p.waitForTimeout(120);
      confere(`a peça ${enq} da NRO, com a logo e o tema`, await p.evaluate(k => { const a = document.querySelector(`.ft-cartao:not(.atras) .ft-arte.ft-${k}`);
        return !!a && !!a.querySelector('.ft-logo') && /Laboratório/i.test(a.textContent); }, enq.toLowerCase()));
    }
    await p.click('.ft-seg button:has-text("Story")'); await p.waitForTimeout(150);

    await p.click('#ft-sim'); await p.waitForTimeout(500);
    const v1 = (await rpcs(p, 'foto_decidir')).at(-1)?.p;
    confere('aprovar decide na hora, com a peça e a paleta', v1?.p_status === 'aprovada' && v1.p_enquadramento === 'story' && v1.p_paleta === 'retina', v1);
    confere('a foto entra no banco, e a tela diz', (await stub(p, 'ct10qdGv1hQ')) === 'aprovada' && (await toastTxt(p)).includes('entrou no banco'));
    confere('a próxima entra', (await metaT(p)) === 'Três béqueres sobre a bancada');
    await p.click('#ft-desfazer'); await p.waitForTimeout(500);
    confere('desfazer devolve a foto à avaliação, em primeiro', (await rpcs(p, 'foto_decidir')).at(-1)?.p?.p_status === 'fila'
      && (await stub(p, 'ct10qdGv1hQ')) === 'fila' && (await metaT(p)) === 'Silhueta de pessoa ao microscópio');

    await p.click('.ft-auto'); await p.waitForTimeout(150);
    confere('Auto usa a família do tema', await p.evaluate(() => !!document.querySelector('.ft-cartao:not(.atras) .ft-arte.f-nexo')));
    await p.keyboard.press('ArrowLeft'); await p.waitForTimeout(500);
    const v2 = (await rpcs(p, 'foto_decidir')).at(-1)?.p;
    confere('a seta para a esquerda rejeita, sem guardar peça', v2?.p_status === 'descartada' && v2.p_enquadramento === null && (await stub(p, 'ct10qdGv1hQ')) === 'descartada', v2);
    const box = await p.locator('.ft-cartao:not(.atras)').boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
    await p.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2, { steps:4 });
    confere('arrastar mostra o carimbo', Number(await p.locator('.ft-cartao:not(.atras) .ft-carimbo.sim').evaluate(e => e.style.opacity)) > .5);
    await p.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2, { steps:4 }); await p.mouse.up(); await p.waitForTimeout(500);
    confere('e soltar à direita aprova', (await rpcs(p, 'foto_decidir')).at(-1)?.p?.p_status === 'aprovada' && (await stub(p, 'lQGJCMY5qcM')) === 'aprovada');
    const antes = await p.evaluate(() => fotosM.enq);
    const b2 = await p.locator('.ft-cartao:not(.atras)').boundingBox();
    await p.mouse.click(b2.x + b2.width / 2, b2.y + b2.height / 2); await p.waitForTimeout(200);
    confere('tocar na foto troca a peça', (await p.evaluate(() => fotosM.enq)) !== antes);
    const n0 = (await rpcs(p, 'foto_decidir')).length, primeira = await metaT(p);
    await p.keyboard.press('ArrowUp'); await p.waitForTimeout(450);
    confere('pular deixa para depois, sem decidir', (await rpcs(p, 'foto_decidir')).length === n0 && (await metaT(p)) !== primeira
      && (await p.evaluate(() => fotosM.fila.at(-1).descricao)) === primeira);

    await p.click('.ft-temas .chip:has-text("Ambiente hospitalar")'); await p.waitForTimeout(300);
    confere('o filtro de tema', (await p.evaluate(() => fotosM.fila.length > 0 && fotosM.fila.every(f => f.tema === 'hospital'))));
    await p.click('button:has-text("Todos os temas")'); await p.waitForTimeout(300);

    await p.click('.cab button:has-text("Pôr por link")'); await p.waitForTimeout(200);
    await p.fill('#ft-lk', 'https://unsplash.com/pt-br/fotografias/um-leito-de-uti-AbCdEfGhIjKhttps://www.pexels.com/pt-br/foto/medico-ao-lado-1234567/');
    await p.selectOption('#ft-lk-tema', 'hospital'); await p.fill('#ft-lk-tags', 'UTI, leito');
    await p.click('#modal button:has-text("Pôr para avaliar")'); await p.waitForTimeout(600);
    const ad = (await rpcs(p, 'fotos_adicionar')).at(-1)?.p?.p_fotos || [];
    confere('pôr por link lê os dois endereços colados juntos', ad.length === 2 && ad[0].banco_id === 'AbCdEfGhIjK' && ad[0].banco === 'unsplash'
      && ad[1].banco === 'pexels' && ad[1].banco_id === '1234567', ad);
    confere('com o tema e as tags', ad.every(f => f.tema === 'hospital' && f.tags.join() === 'UTI,leito' && f.origem === 'link'));
    confere('as fotos novas vão para a avaliação, não direto para o banco', (await toastTxt(p)).includes('2 fotos foram para a avaliação')
      && (await stub(p, 'AbCdEfGhIjK')) === 'fila' && (await stub(p, '1234567')) === 'fila');
    confere('e vêm primeiro na avaliação', ['AbCdEfGhIjK', '1234567'].includes(await p.evaluate(() => fotosM.fila[0].banco_id)));
    await p.click('.cab button:has-text("Buscar nos bancos")'); await p.waitForTimeout(200);
    confere('sem chave, a busca manda para as configurações', (await p.locator('#modal .aviso-box').innerText()).includes('Configurações'));
    await p.click('#modal button:has-text("Fechar")');

    await ir(p, '#/studio/curadoria', 800);
    confere('o endereço antigo da curadoria leva ao banco de imagens', /#\/studio\/banco$/.test(p.url()) && (await p.locator('.cab h1').innerText()) === 'Banco de imagens', p.url());
    await ir(p, '#/studio/curadoria/descartadas', 800);
    confere('o das descartadas também, sem tela de rejeitadas', /#\/studio\/banco$/.test(p.url()) && (await p.locator('.ft-cartao:not(.atras) .ft-arte').count()) === 1, p.url());
    await ir(p, '#/studio/banco/rejeitadas', 800);
    confere('e o das rejeitadas, de antes, leva à avaliação', /#\/studio\/banco$/.test(p.url()) && (await p.locator('.ft-cartao:not(.atras) .ft-arte').count()) === 1, p.url());

    await ir(p, '#/studio/banco', 800);
    await p.evaluate(() => { state.perfil.papeis = ['lideranca']; state.perfil.papel = 'lideranca'; ftCurDesenha(); });
    confere('quem gere o Studio sem ser admin avalia, mas não põe fotos novas', (await p.locator('#ft-sim').count()) === 1
      && (await p.locator('.cab button:has-text("Pôr por link"), .cab button:has-text("Buscar nos bancos")').count()) === 0);
    await p.evaluate(() => { state.perfil.papeis = ['leitura']; state.perfil.papel = 'leitura'; state.studioCfg.grupos_aprovadores = []; ftCurDesenha(); });
    confere('quem só entra no Studio vê as peças, sem aprovar nem rejeitar', (await p.locator('.ft-cartao:not(.atras) .ft-arte').count()) === 1
      && (await p.locator('#ft-sim, #ft-nao, #ft-desfazer').count()) === 0 && (await p.locator('#ft-pular').innerText()).includes('Próxima')
      && (await p.locator('#main .aviso-box.info').innerText()).includes('Galeria de fotos'));
    const n1 = (await rpcs(p, 'foto_decidir')).length;
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450);
    confere('e a seta só passa para a próxima', (await rpcs(p, 'foto_decidir')).length === n1);
    await fechar(t);
  }

  console.log('A avaliação no celular');
  {
    const t = await abrir('#/studio/banco', { largura:390, altura:844 }), { p } = t;
    await p.waitForSelector('.ft-cartao:not(.atras) .ft-arte');
    const lado = await p.evaluate(() => { const a = $('#ft-palco').getBoundingClientRect(), b = document.querySelector('.ft-lado').getBoundingClientRect(),
      c = document.querySelector('.ft-acoes').getBoundingClientRect(), m = document.querySelector('#ft-meta').getBoundingClientRect();
      return { empilha: b.top >= a.bottom - 1, acoesAntes: c.top < m.top, larg: document.documentElement.scrollWidth <= innerWidth + 1 }; });
    confere('a peça em cima, as decisões logo depois, sem rolar para o lado', lado.empilha && lado.acoesAntes && lado.larg, lado);
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
    confere('e diz de onde vieram', (await toastTxt(p)).includes('banco de imagens'));
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
    confere('o Studio tem o Banco de imagens no menu', filho('studio', 'banco', 'Banco de imagens'));
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
    confere('/curadoria/ leva ao banco de imagens no Studio', /#\/studio\/banco$/.test(p2.url()), p2.url());
    await ctx.close();
  }
} finally {
  await nav.close();
}
console.log(`\n${checks - falhas}/${checks} ok`);
process.exitCode = falhas ? 1 : 0;
