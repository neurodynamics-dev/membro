/* L6: o pedido de acesso biométrico no portal (membro e Pessoal). Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const sem = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
const com = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { nav = sem, bio, papel = 'admin' } = {}){
  const ctx = await nav.newContext({ viewport:{ width:1280, height:900 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub.replace("papel:'admin'", `papel:'${papel}'`) }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(b => { window.__teste = b ? { biometria:b } : {}; }, bio || null);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);

try{
  console.log('Pedido e dados');
  {
    const t = await abrir('#/servicos/biometria'), { p } = t;
    await p.waitForSelector('.etapas');
    confere('as três etapas', (await p.locator('.etapas li').allInnerTexts()).length === 3);
    await p.fill('#bio-just', 'curta'); await p.locator('#bio-tempo .chip').first().click(); await p.click('#bio-continuar');
    confere('justificativa curta bloqueia', (await p.locator('#bio-erro').innerText()).includes('pelo menos 10')
      && (await rpcs(p, 'labbio_pedido_criar')).length === 0);
    await p.fill('#bio-just', 'Projeto da órtese na bancada'); await p.click('#bio-continuar');
    await p.waitForFunction(() => location.hash === '#/servicos/biometria/dados');
    const c = (await rpcs(p, 'labbio_pedido_criar')).at(-1).p;
    confere('abre o pedido com justificativa e tempo', c.p_justificativa === 'Projeto da órtese na bancada' && c.p_tempo === '1 semana', c);
    confere('a etapa Dados mostra os campos', (await p.locator('.spec').innerText()).includes('52998224725'));
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/biometria/dados', { bio:{ semDados:true } }), { p } = t;
    await p.waitForSelector('a[href="#/servicos/dados?de=biometria"]');
    confere('sem dados conferidos, leva a Meus dados com o retorno', true);
    await fechar(t);
  }

  console.log('Foto');
  {
    const t = await abrir('#/servicos/biometria', { nav:com, bio:{ etapa:'rascunho' } }), { p } = t;
    /* a verificação do rosto (2.19.2) tem teste próprio, em biometria-rosto.mjs; aqui ela não carrega, e a câmera segue sem ela */
    await p.route('**/vendor/mediapipe/**', r => r.abort());
    await p.waitForSelector('#bio-just'); await p.locator('#bio-tempo .chip').first().click();
    await p.evaluate(() => { location.hash = '#/servicos/biometria/foto'; });
    await p.waitForFunction(() => { const b = document.querySelector('#bio-tirar'); return b && !b.disabled; });
    await p.waitForFunction(() => document.querySelector('#bio-video')?.videoWidth > 0);
    await p.click('#bio-tirar');
    await p.waitForSelector('#bio-usar');
    confere('tirar a foto mostra a prévia, com Refazer e Usar', await p.locator('#bio-canvas').isVisible() && await p.getByRole('button', { name:'Refazer' }).count() === 1);
    confere('a câmera parou', await p.evaluate(() => bio.stream === null));
    await p.click('#bio-usar');
    await p.waitForFunction(() => (window.__rpcs || []).some(x => x.nome === 'labbio_pedido_enviar'));
    const up = await p.evaluate(() => (window.__uploads || []).find(u => u.bucket === 'biometria'));
    const e = (await rpcs(p, 'labbio_pedido_enviar')).at(-1).p;
    confere('sobe em biometria/4/p1/1.jpg e envia o pedido', up?.caminho === '4/p1/1.jpg' && e.p_id === 'p1' && e.p_versao === 1 && e.p_foto_path === '4/p1/1.jpg', { up, e });
    await p.waitForSelector('.bio-trilha');
    confere('depois de enviar, só a trilha', await p.locator('#bio-usar').count() === 0);
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/biometria/foto', { bio:{ etapa:'rascunho' } }), { p } = t;
    await p.waitForSelector('#bio-sem-camera:not([hidden])');
    confere('sem câmera: a mensagem e o campo de arquivo', (await p.locator('#bio-sem-camera').innerText()).includes('Não conseguimos usar a câmera')
      && await p.locator('#bio-arq').count() === 1 && await p.locator('#bio-arq[capture]').count() === 0);
    await fechar(t);
  }

  console.log('Acompanhar, quem já tem, formulário comum');
  {
    const t = await abrir('#/servicos/biometria', { bio:{ etapa:'labbio' } }), { p } = t;
    await p.waitForSelector('.bio-trilha');
    confere('a trilha com "Encaminhado ao LABBIO" em destaque', (await p.locator('.bio-trilha li.atual').innerText()).includes('Encaminhado ao LABBIO')
      && await p.getByRole('button', { name:'Cancelar o pedido' }).count() === 1);
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/biometria', { bio:{ temAcesso:true } }), { p } = t;
    await p.waitForSelector('.tpl-e');
    confere('quem já tem acesso', (await p.locator('.tpl-e').innerText()).includes('Você já tem acesso biométrico ao LABBIO.'));
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/acesso'), { p } = t;
    await p.waitForSelector('#f-item');
    const id = await p.evaluate(() => state.itensAcesso.find(i => i.chave === 'labbio_biometria').id);
    await p.selectOption('#f-item', id);
    confere('o item da biometria aponta para o pedido próprio', await p.locator('#f-bio-aviso a[href="#/servicos/biometria"]').isVisible() && await p.locator('#f-enviar').isHidden());
    await fechar(t);
  }

  console.log('O Pessoal');
  {
    const t = await abrir('#/atividades/card/DEP-1', { papel:'pessoal', bio:{ etapa:'pessoal' } }), { p } = t;
    await p.waitForSelector('#bio-pessoal h3');
    confere('o bloco substitui a decisão comum', await p.locator('#dec-form').count() === 0 && (await p.locator('#bio-pessoal').innerText()).includes('52998224725'));
    await p.waitForSelector('#bio-pessoal-foto img');
    confere('a foto por link assinado', (await p.evaluate(() => (window.__baixados || []).some(b => b.bucket === 'biometria'))));
    await p.getByRole('button', { name:'Devolver para correção' }).click();
    await p.locator('#modal').getByRole('button', { name:'Devolver para correção' }).click();
    confere('devolver sem motivo não chama', (await rpcs(p, 'labbio_pedido_pessoal')).length === 0);
    await p.fill('#bio-motivo', 'Foto escura'); await p.locator('#modal').getByRole('button', { name:'Devolver para correção' }).click();
    await p.waitForFunction(() => (window.__rpcs || []).some(x => x.nome === 'labbio_pedido_pessoal'));
    const u = (await rpcs(p, 'labbio_pedido_pessoal')).at(-1).p;
    confere('devolver com motivo', u.p_acao === 'devolver' && u.p_motivo === 'Foto escura', u);
    await fechar(t);
  }
  {
    const t = await abrir('#/atividades/card/DEP-1', { papel:'pessoal', bio:{ etapa:'pessoal' } }), { p } = t;
    await p.waitForSelector('#bio-pessoal h3');
    confere('o aviso de que encaminhar não concede', (await p.locator('#bio-pessoal').innerText()).includes('Encaminhar não concede o acesso'));
    await p.getByRole('button', { name:'Encaminhar ao LABBIO' }).click();
    await p.waitForFunction(() => (window.__rpcs || []).some(x => x.nome === 'labbio_pedido_pessoal'));
    confere('encaminhar', (await rpcs(p, 'labbio_pedido_pessoal')).at(-1).p.p_acao === 'encaminhar');
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await sem.close(); await com.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
