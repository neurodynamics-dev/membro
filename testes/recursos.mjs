/* 2.19.2: Recursos, o catálogo colaborativo de ferramentas (#/recursos).
   Galeria com os filtros na lateral, a página do recurso (função, instruções, estrelas, comentários), adicionar e editar. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){ checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`); if (!ok) falhas++; }
async function abrir(hash, { celular = false, teste = null } = {}){
  const ctx = await nav.newContext(celular ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 } : { viewport:{ width:1280, height:900 } });
  ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|github\.com\/.*\.png|google\.com\/s2/, r => r.abort());
  await p.addInitScript(({ teste }) => { try { localStorage.setItem('nd.menu', 'recolhido'); } catch(e){} if (teste) window.__teste = teste; }, { teste });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
const fim = async ({ ctx, p, erros }) => {
  confere('sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  confere('sem erro de página', !erros.length, erros); await ctx.close();
};
const nomes = p => p.locator('.rcs-card .rcs-nome').allInnerTexts();
const total = async p => Number((await p.locator('#rcs-total b').innerText()).trim());
const marcar = async (p, sel) => { await p.locator(sel.startsWith('#') || sel.startsWith('[') ? sel : '#' + sel).check(); await p.waitForTimeout(80); };

try {
  console.log('A galeria');
  {
    const t = await abrir('#/recursos'), { p } = t;
    await p.waitForSelector('.rcs-card');
    confere('o menu tem Recursos, acesa nesta tela', await p.locator('#lt-nav .lt-sec[data-r="recursos"]').count() === 1);
    confere('só os ativos aparecem de início (7 de 8)', await total(p) === 7 && !(await nomes(p)).includes('Ferramenta antiga'));
    confere('o cartão mostra nome, publicador e logo', (await p.locator('.rcs-card').first().innerText()).includes('Microsoft') && await p.locator('.rcs-card .rcs-logo').count() === 7);
    confere('"em destaque" começa pelo padrão da NRO', (await nomes(p)).slice(0, 2).sort().join() === 'Git Bash (Git for Windows),Visual Studio Code'
      && (await p.locator('.rcs-card .rcs-padrao').count()) === 2);
    confere('com as estrelas e a contagem', (await p.locator('.rcs-card').first().innerText()).match(/\d,\d/) !== null);
    // busca
    await p.fill('#rcs-q', 'esp'); await p.waitForTimeout(100);
    confere('a busca acha por nome, tag e função (e sem acento)', (await nomes(p)).join() === 'esptool' || (await nomes(p)).includes('esptool'));
    await p.fill('#rcs-q', 'gravacao'); await p.waitForTimeout(100);
    confere('busca sem acento acha "Gravação"', await total(p) === 2, await nomes(p));
    await p.fill('#rcs-q', ''); await p.waitForTimeout(100);
    // filtros laterais
    await marcar(p, 'rcs-tipo-beneficio');
    confere('Tipo: benefício', (await nomes(p)).join() === 'GitHub Student Developer Pack');
    await p.locator('#rcs-tipo-beneficio').uncheck(); await p.waitForTimeout(80);
    await marcar(p, '[data-rcs-g="tags"][value="Gravação"]');
    confere('Tag: Gravação', await total(p) === 2);
    await marcar(p, '[data-rcs-g="tags"][value="ESP32"]');
    confere('duas tags afunilam (precisa ter as duas)', (await nomes(p)).join() === 'esptool' || await total(p) === 2, await nomes(p));
    await p.locator('.rcs-limpar').click(); await p.waitForTimeout(100);
    confere('Limpar os filtros volta ao começo', await total(p) === 7);
    await marcar(p, 'rcs-padrao');
    confere('Só o padrão da NRO', await total(p) === 2);
    await p.locator('#rcs-padrao').uncheck();
    await p.locator('#rcs-status-todos').check(); await p.waitForTimeout(80);
    confere('Situação "Todos" mostra também o inativo, marcado', await total(p) === 8 && (await p.locator('.rcs-card.inativo .rcs-inativo').count()) === 1);
    await p.locator('#rcs-status-inativo').check(); await p.waitForTimeout(80);
    confere('Situação "Inativos"', (await nomes(p)).join() === 'Ferramenta antiga');
    await p.locator('#rcs-status-ativo').check(); await p.waitForTimeout(80);
    await p.locator('#rcs-nota-4').check(); await p.waitForTimeout(80);
    confere('Avaliação mínima 4', (await nomes(p)).every(n => ['Visual Studio Code', 'PlatformIO IDE', 'Figma', 'GitHub Student Developer Pack'].includes(n)) && await total(p) === 4, await nomes(p));
    await p.locator('#rcs-nota-0').check(); await p.waitForTimeout(80);
    confere('as opções mostram a contagem de cada uma', (await p.locator('label.rcs-op:has(#rcs-tipo-software) .n').innerText()) !== '' && await p.locator('#rcs-fac .rcs-op .n').count() > 10);
    await p.selectOption('#rcs-ordem', 'nota'); await p.waitForTimeout(80);
    confere('Ordenar por melhor avaliados', (await nomes(p))[0] === 'GitHub Student Developer Pack', await nomes(p));
    await p.selectOption('#rcs-ordem', 'nome'); await p.waitForTimeout(80);
    confere('Ordenar por nome', JSON.stringify(await nomes(p)) === JSON.stringify((await nomes(p)).slice().sort((a, b) => a.localeCompare(b, 'pt', { sensitivity:'base' }))));
    await p.fill('#rcs-tag-q', 'est'); await p.waitForTimeout(100);
    confere('procurar entre as tags', (await p.locator('#rcs-fac [data-rcs-g="tags"]').count()) >= 1 && (await p.locator('#rcs-fac fieldset:last-of-type').innerText()).includes('Estudante'));
    await fim(t);
  }

  console.log('A página do recurso');
  {
    const t = await abrir('#/recursos/visual-studio-code'), { p } = t;
    await p.waitForSelector('#rcs-faz');
    confere('diz o que faz, logo no começo', (await p.locator('#rcs-faz').innerText()).includes('IDE padrão da equipe') && await p.locator('#main h1').innerText() === 'Visual Studio Code');
    confere('o padrão da NRO e o publicador à vista', (await p.locator('.cab-meta').innerText()).toLowerCase().includes('padrão da nro') && (await p.locator('.cab-meta').innerText()).includes('Microsoft'));
    confere('instruções com passos numerados', await p.locator('#rcs-baixar ol li').count() === 2);
    confere('um comando sozinho vira bloco com Copiar', await p.locator('#rcs-usar .rcs-cod code').first().innerText() === 'git --version' && await p.locator('#rcs-usar .rcs-cod button').count() === 1);
    confere('e listas com traço', await p.locator('#rcs-usar ul li').count() === 2);
    confere('a lateral: abrir o site, tags e quem editou', await p.locator('#rcs-abrir').getAttribute('href') === 'https://code.visualstudio.com' && await p.locator('.rcs-tags .rcs-tag').count() === 3
      && (await p.locator('.objeto-lateral').innerText()).includes('Ana Figueiredo'));
    confere('média das estrelas e a contagem', (await p.locator('.rcs-aval-media').innerText()).includes('4,5') && (await p.locator('.rcs-aval-media').innerText()).includes('(2)'));
    await p.locator('[data-rcs-nota="3"]').click(); await p.waitForTimeout(150);
    confere('dar uma nota atualiza a média sem recarregar', (await p.locator('.rcs-aval-media').innerText()).includes('(3)') && await p.locator('.rcs-estr.on').count() === 3
      && await p.evaluate(() => window.__rpcs.some(x => x.nome === 'recurso_avaliar' && x.p.p_estrelas === 3 && x.p.p_slug === 'visual-studio-code')));
    await p.locator('[data-rcs-nota="0"]').click(); await p.waitForTimeout(150);
    confere('tirar a nota', (await p.locator('.rcs-aval-media').innerText()).includes('(2)') && await p.locator('.rcs-estr.on').count() === 0);
    confere('comentários existentes', (await p.locator('#rcs-lista').innerText()).includes('Settings Sync'));
    await p.fill('#rcs-com-txt', 'Funcionou na bancada do LABBIO.'); await p.click('#rcs-com-bt'); await p.waitForTimeout(150);
    confere('comentar aparece na hora, com o contador', (await p.locator('#rcs-lista').innerText()).includes('bancada do LABBIO') && (await p.locator('#rcs-conta').innerText()) === '2');
    await p.locator('#rcs-lista [data-rcs-apagar]').last().click(); await p.waitForTimeout(150);
    confere('apagar o próprio comentário', (await p.locator('#rcs-conta').innerText()) === '1');
    await p.locator('.rcs-tags .rcs-tag').first().click(); await p.waitForTimeout(500);
    confere('clicar numa tag leva à galeria já filtrada', await p.evaluate(() => location.hash) === '#/recursos' && await p.locator('.rcs-card').count() >= 1
      && await p.locator('.fb-tag, #rcs-fac [data-rcs-g="tags"]:checked').count() === 1);
    await fim(t);
  }
  {
    const t = await abrir('#/recursos/git-bash-git-for-windows'), { p } = t;
    await p.waitForSelector('#rcs-faz');
    confere('sem instruções, convida a completar', (await p.locator('#rcs-baixar').innerText()).includes('Ainda sem instruções') && await p.locator('#rcs-baixar a[href$="/editar"]').count() === 1);
    await fim(t);
  }
  {
    const t = await abrir('#/recursos/nao-existe'), { p } = t;
    await p.waitForSelector('.vazio');
    confere('recurso que não existe', (await p.locator('.vazio').innerText()).includes('não existe')); await fim(t);
  }

  console.log('Adicionar e editar');
  {
    const t = await abrir('#/recursos/novo'), { p } = t;
    await p.waitForSelector('#rcs-form');
    await p.fill('#rcs-url', 'https://github.com/espressif/arduino-esp32');
    confere('colar o endereço sugere o nome e o publicador (GitHub)', await p.inputValue('#rcs-nome') === 'arduino-esp32' && await p.inputValue('#rcs-publicador') === 'espressif');
    confere('e mostra a logo no formulário', await p.locator('#rcs-prev .rcs-logo').count() === 1);
    await p.click('#rcs-salvar');
    confere('sem dizer o que faz, não salva e aponta o campo', await p.locator('#rcs-f-funcao.erro').count() === 1 && await p.evaluate(() => !(window.__rpcs || []).some(x => x.nome === 'recurso_salvar')));
    await p.fill('#rcs-nome', 'Arduino core para ESP32'); await p.fill('#rcs-publicador', 'Espressif');
    await p.fill('#rcs-funcao', 'Pacote de placas que permite programar ESP32 pelo Arduino IDE e pelo PlatformIO.');
    await p.selectOption('#rcs-tipo', 'repositorio');
    await p.check('input[name="rcs-acesso"][value="gratis"]'); await p.check('input[name="rcs-plat"][value="Windows"]');
    await p.fill('#rcs-tag-novo', 'esp32'); await p.press('#rcs-tag-novo', 'Enter');
    await p.fill('#rcs-tag-novo', 'Gravação'); await p.press('#rcs-tag-novo', 'Enter');
    await p.fill('#rcs-tag-novo', 'gravação'); await p.press('#rcs-tag-novo', 'Enter');
    confere('as tags: reaproveita a grafia que existe e não repete', (await p.locator('#rcs-tags-ed .rcs-tag').allInnerTexts()).map(x => x.replace('×', '').trim()).join() === 'ESP32,Gravação');
    confere('sem a gestão marcada por engano: o padrão da NRO existe só para a gestão (aqui há)', await p.locator('#rcs-padrao_nro').count() === 1);
    await p.fill('#rcs-instrucoes_usar', '1. Instale o pacote.\n`pio run`');
    await p.click('#rcs-salvar'); await p.waitForSelector('#rcs-faz');
    confere('salvou e abriu a página do recurso novo', await p.evaluate(() => location.hash) === '#/recursos/arduino-core-para-esp32' && await p.locator('#main h1').innerText() === 'Arduino core para ESP32'
      && await p.locator('.rcs-tags .rcs-tag').count() === 2 && await p.locator('#rcs-usar .rcs-cod').count() === 1);
    confere('o servidor recebeu tudo', await p.evaluate(() => { const x = window.__rpcs.filter(y => y.nome === 'recurso_salvar').at(-1)?.p.p; return x.tipo === 'repositorio' && x.tags.length === 2 && x.plataformas.join() === 'Windows' && x.acesso.join() === 'gratis'; }));
    // o novo aparece na galeria
    await p.evaluate(() => { location.hash = '#/recursos'; }); await p.waitForSelector('.rcs-card');
    confere('e já está na galeria', (await nomes(p)).includes('Arduino core para ESP32'));
    await fim(t);
  }
  {
    const t = await abrir('#/recursos/novo'), { p } = t;
    await p.waitForSelector('#rcs-form');
    await p.fill('#rcs-url', 'https://www.CODE.visualstudio.com/'); await p.fill('#rcs-nome', 'Outro VS Code'); await p.fill('#rcs-funcao', 'Repetido.');
    await p.click('#rcs-salvar'); await p.waitForSelector('#rcs-erro:not([hidden])');
    confere('o mesmo endereço já está no catálogo: leva ao existente', (await p.locator('#rcs-erro').innerText()).includes('já está no catálogo') && await p.locator('#rcs-erro a[href="#/recursos/visual-studio-code"]').count() === 1);
    await fim(t);
  }
  {
    const t = await abrir('#/recursos/figma/editar'), { p } = t;
    await p.waitForSelector('#rcs-form');
    confere('editar traz os valores', await p.inputValue('#rcs-nome') === 'Figma' && (await p.locator('#rcs-tags-ed .rcs-tag').count()) === 2 && await p.locator('input[name="rcs-acesso"][value="estudante"]').isChecked());
    await p.fill('#rcs-funcao', 'Design de interfaces e protótipos, colaborativo e no navegador.'); await p.selectOption('#rcs-status', 'inativo');
    await p.click('#rcs-salvar'); await p.waitForSelector('#rcs-faz');
    confere('salva e volta à página', await p.evaluate(() => location.hash) === '#/recursos/figma' && (await p.locator('#rcs-faz').innerText()).includes('colaborativo') && (await p.locator('.cab-meta').innerText()).toLowerCase().includes('inativo'));
    await fim(t);
  }
  {
    const t = await abrir('#/recursos/novo', { teste:{ recursos:{ gestao:false } } }), { p } = t;
    await p.waitForSelector('#rcs-form');
    confere('quem não é da gestão não vê "Padrão da NRO"', await p.locator('#rcs-padrao_nro').count() === 0);
    await fim(t);
  }

  console.log('No celular');
  {
    const t = await abrir('#/recursos', { celular:true }), { p } = t;
    await p.waitForSelector('.rcs-card');
    confere('a busca fica à mostra e os filtros atrás do botão', await p.locator('#rcs-q').isVisible() && await p.locator('#rcs-fac').isHidden() && await p.locator('#rcs-abre').isVisible());
    await p.click('#rcs-abre');
    confere('o botão abre os filtros', await p.locator('#rcs-fac').isVisible() && await p.locator('#rcs-abre').getAttribute('aria-expanded') === 'true');
    await p.locator('#rcs-tipo-software').check(); await p.waitForTimeout(100);
    confere('e filtra', (await p.locator('#rcs-nf').innerText()).includes('1'));
    await fim(t);
    const u = await abrir('#/recursos/visual-studio-code', { celular:true });
    await u.p.waitForSelector('#rcs-faz');
    confere('a página no celular: tudo numa coluna', await u.p.locator('.objeto-lateral').boundingBox().then(b => b.width <= 390));
    await fim(u);
  }
  if (process.env.RCS_CAPTURAS){
    mkdirSync(process.env.RCS_CAPTURAS, { recursive:true });
    for (const [n, h, c] of [['galeria', '#/recursos', false], ['item', '#/recursos/visual-studio-code', false], ['form', '#/recursos/novo', false], ['galeria-cel', '#/recursos', true]]){
      const t = await abrir(h, { celular:c }); await t.p.waitForTimeout(700); await t.p.screenshot({ path:`${process.env.RCS_CAPTURAS}/rcs-${n}.png`, fullPage:true }); await t.ctx.close();
    }
  }
} finally { await nav.close(); }
console.log(falhas ? `\n${falhas} falha(s) em ${checks} verificações.` : `\nTudo certo. ${checks} verificações passaram.`); process.exitCode = falhas ? 1 : 0;
