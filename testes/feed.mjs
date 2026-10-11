/* F1: feed da equipe, mesa editorial, widget do início e newsletter. Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { papel = 'admin', feedOp = {}, teste = {} } = {}){
  const ctx = await nav.newContext({ viewport:{ width:1440, height:960 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stubAdmin.replace("papel:'admin'", `papel:'${papel}'`) }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(([f, t]) => { window.__teste = { feed:f, ...t }; }, [feedOp, teste]);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);
const alvo = (p, h) => p.evaluate(h => { location.hash = h; }, h);

try{
  console.log('Início e feed');
  {
    const t = await abrir('#/'), { p } = t;
    await p.waitForSelector('#card-feed .feed-ini-i');
    const txt = await p.locator('#card-feed').innerText();
    /* 2.19.2: sem a marca de tópico ou notícia, com o tempo relativo */
    confere('o card tem as duas publicações, sem a pronta', await p.locator('#card-feed .feed-ini-i').count() === 2
      && !/notícia|tópico/i.test(txt) && / atrás|ontem|agora/.test(txt) && !txt.includes('Prêmio no congresso'), txt);
    confere('o link vai para o feed', await p.locator('#card-feed a[href="#/servicos/feed"]').count() === 1);
    await alvo(p, '#/servicos/feed'); await p.waitForSelector('#feed-lista .artigo');
    confere('o feed: dois artigos', await p.locator('#feed-lista .artigo').count() === 2);
    const f1 = p.locator('#feed-f1');
    confere('f1 com legenda e etiqueta "No site"', (await f1.locator('figcaption').innerText()) === 'O protótipo na bancada' && /no site/i.test(await f1.innerText()));
    confere('tópico sem reações', await p.locator('#feed-f2 .reacoes').count() === 0 && await f1.locator('.reacoes').count() === 1);
    await p.getByRole('button', { name:'Tópicos' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#feed-lista .artigo').length === 1);
    confere('"Tópicos" chama feed_lista com p_tipo e deixa só o f2', (await rpcs(p, 'feed_lista')).at(-1).p.p_tipo === 'topico' && await p.locator('#feed-f2').count() === 1);
    await p.getByRole('button', { name:'Tudo' }).click(); await p.waitForSelector('#feed-f1');
    await f1.getByRole('button', { name:/Reagir com 🎉/ }).click();
    await p.waitForSelector('#feed-f1 button[aria-pressed="true"]');
    let u = (await rpcs(p, 'feed_reagir')).at(-1).p;
    confere('reagir 🎉', u.p_ref === 'f1' && u.p_emoji === '🎉' && /🎉\s*1/.test(await f1.locator('button[aria-pressed="true"]').innerText()), u);
    await f1.locator('button[aria-pressed="true"]').click();
    await p.waitForFunction(() => !document.querySelector('#feed-f1 button[aria-pressed="true"]'));
    u = (await rpcs(p, 'feed_reagir')).at(-1).p;
    confere('o mesmo emoji de novo tira', u.p_emoji === null, u);
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/feed/editorial', { papel:'leitura', feedOp:{ editor:false } }), { p } = t;
    await p.waitForSelector('#feed-lista .artigo');
    confere('sem ser editor, a mesa volta para o feed e não há link', (await p.evaluate(() => location.hash)) === '#/servicos/feed'
      && await p.locator('a[href="#/servicos/feed/editorial"]').count() === 0);
    confere('e sem a aba Newsletters', await p.locator('a[href="#/servicos/newsletter"]').count() === 0);
    await fechar(t);
  }

  console.log('Mesa editorial');
  {
    const t = await abrir('#/servicos/feed/editorial'), { p } = t;
    await p.waitForSelector('#feed-mesa-tabela');
    const f3 = p.locator('#feed-m-f3');
    confere('"Prontas": a contribuição do reporte', await p.locator('#feed-mesa-tabela tbody tr').count() === 1 && (await f3.innerText()).includes('Reporte'));
    await f3.getByRole('button', { name:'Publicar…' }).click();
    await p.locator('#modal').getByRole('button', { name:'Publicar', exact:true }).click();
    await p.waitForFunction(() => !document.querySelector('#modal.open'));
    const pub = (await rpcs(p, 'feed_publicar')).at(-1).p;
    confere('só para a equipe: feed_publicar com p_publico falso', pub.p_id === 'f3' && pub.p_publico === false, pub);
    await p.waitForFunction(() => !document.querySelector('#feed-m-f3'));
    confere('f3 sai de "Prontas"', true);

    console.log('Nova notícia, imagem e publicação no site');
    await p.getByRole('button', { name:'Nova publicação' }).click();
    await p.waitForSelector('#fe-titulo');
    await p.getByRole('button', { name:'Notícia completa' }).click();
    confere('sem id: "Salve o texto para anexar imagens"', (await p.locator('#modal').innerText()).includes('Salve o texto para anexar imagens.'));
    await p.fill('#fe-titulo', 'Bolsa nova'); await p.fill('#fe-sub', 'Resumo curto'); await p.fill('#fe-texto', 'x'.repeat(350));
    await p.click('#fe-salvar');
    await p.waitForSelector('#fe-arq');
    const s1 = (await rpcs(p, 'feed_item_salvar')).at(-1).p.p;
    confere('salva sem id e sem imagens; o modal continua com o campo de arquivo', !('id' in s1) && s1.imagens.length === 0 && s1.tipo === 'noticia', s1);
    await p.setInputFiles('#fe-arq', { name:'foto.png', mimeType:'image/png', buffer:PNG });
    await p.waitForSelector('#fe-leg-0');
    const up = await p.evaluate(() => (window.__uploads || []).find(u => u.bucket === 'feed'));
    confere('a imagem sobe para o bucket feed, na pasta do item', !!up && up.caminho.startsWith('f4/'), up);
    await p.fill('#fe-leg-0', 'Foto da equipe'); await p.click('#fe-salvar');
    await p.waitForFunction(() => !document.querySelector('#modal.open'));
    const s2 = (await rpcs(p, 'feed_item_salvar')).at(-1).p.p;
    confere('salvar manda a imagem com a legenda', s2.id === 'f4' && s2.imagens[0].legenda === 'Foto da equipe' && s2.imagens[0].path.startsWith('f4/'), s2);

    await p.getByRole('button', { name:'Todas' }).click();
    await p.waitForSelector('#feed-m-f4');
    await p.locator('#feed-m-f4').getByRole('button', { name:'Publicar…' }).click();
    await p.locator('#modal label', { hasText:'No site também' }).locator('input').check();
    await p.locator('#modal').getByRole('button', { name:'Publicar', exact:true }).click();
    await p.waitForFunction(() => !document.querySelector('#modal.open'));
    const copia = await p.evaluate(() => ({ dl:(window.__baixados || []).filter(b => b.op === 'download'), up:(window.__uploads || []).filter(u => u.bucket === 'noticias') }));
    confere('publicar no site copia a imagem (download do feed, upload no noticias)', copia.dl.length === 1 && copia.up.length === 1 && copia.up[0].caminho === 'f4/1.png', copia);
    await p.waitForFunction(() => /no site/i.test(document.querySelector('#feed-m-f4')?.innerText || ''));
    confere('f4 fica "No site"', true);
    await fechar(t);
  }
  {
    /* a cópia falha no meio: a publicação fica incompleta e dá para tentar de novo */
    const t = await abrir('#/servicos/feed/editorial', { teste:{ downloadFalha:'f5/a.jpg' } }), { p } = t;
    await p.waitForSelector('#feed-mesa-tabela');
    await p.evaluate(() => { (window.__fd ||= { itens:[], inscritos:[], envios:[] }); });
    const id = await p.evaluate(async () => {
      const r = await sb.rpc('feed_item_salvar', { p:{ tipo:'noticia', titulo:'Com falha', subtitulo:'r', texto:'y'.repeat(320) } });
      const i = r.data.id;
      await sb.rpc('feed_item_salvar', { p:{ id:i, tipo:'noticia', titulo:'Com falha', subtitulo:'r', texto:'y'.repeat(320), imagens:[{ path:i + '/a.jpg', legenda:'' }] } });
      return i;
    });
    await p.evaluate(i => { window.__teste.downloadFalha = i + '/a.jpg'; }, id);
    await p.getByRole('button', { name:'Todas' }).click(); await p.waitForSelector('#feed-m-' + id);
    await p.locator('#feed-m-' + id).getByRole('button', { name:'Publicar…' }).click();
    await p.locator('#modal label', { hasText:'No site também' }).locator('input').check();
    await p.locator('#modal').getByRole('button', { name:'Publicar', exact:true }).click();
    await p.waitForSelector('#fp-erro .aviso-box');
    confere('falha na cópia: "A publicação não terminou" e "Tentar de novo"', (await p.locator('#fp-erro').innerText()).includes('A publicação não terminou')
      && (await p.locator('#fp-ok').innerText()) === 'Tentar de novo');
    await p.evaluate(() => { window.__teste.downloadFalha = null; });
    await p.click('#fp-ok');
    await p.waitForFunction(() => !document.querySelector('#modal.open'));
    confere('sem a falha, tentar de novo publica', true);
    await fechar(t);
  }

  console.log('Retirar, tópico longo e newsletter');
  {
    const t = await abrir('#/servicos/feed/editorial'), { p } = t;
    await p.waitForSelector('#feed-mesa-tabela');
    await p.getByRole('button', { name:'Publicadas' }).click(); await p.waitForSelector('#feed-m-f1');
    await p.locator('#feed-m-f1').getByRole('button', { name:'Retirar' }).click();
    await p.locator('#modal').getByRole('button', { name:'Retirar publicação' }).click();
    await p.waitForFunction(() => (window.__removidosB || []).length > 0);
    confere('retirar apaga a cópia pública no bucket noticias', (await p.evaluate(() => window.__removidosB)).some(x => x.bucket === 'noticias' && x.caminho === 'f1/1.jpg'));

    await p.getByRole('button', { name:'Nova publicação' }).click();
    await p.fill('#fe-titulo', 'Longo'); await p.fill('#fe-sub', 'r'); await p.fill('#fe-texto', 'z'.repeat(1300));
    confere('o contador fica em alerta', (await p.locator('#fe-cont').innerText()).includes('1300 de 1.200') || (await p.locator('#fe-cont').innerText()).includes('1.200'));
    await p.click('#fe-salvar');
    await p.waitForSelector('#fe-e-texto:not([hidden])');
    confere('tópico com 1.300: o erro no campo e o modal fica', (await p.locator('#fe-e-texto').innerText()).includes('Tópico tem até 1.200 caracteres') && await p.locator('#fe-salvar').count() === 1);
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/newsletter'), { p } = t;
    await p.waitForSelector('#news-enviar-semanal');
    confere('próximas edições para o editor', /equipe, semanal/i.test(await p.locator('#news-corpo').innerText()) && (await p.locator('#news-corpo').innerText()).includes('42 inscritos'));
    await p.click('#news-enviar-semanal');
    await p.locator('#modal').getByRole('button', { name:'Enviar edição' }).click();
    await p.waitForSelector('#news-tabela');
    const u = (await rpcs(p, 'newsletter_enviar_agora')).at(-1).p;
    confere('"Enviar agora" chama o banco e a edição aparece com "Envio manual"', u.p_tipo === 'semanal' && (await p.locator('#news-tabela').innerText()).includes('Envio manual'), u);
    await p.waitForFunction(() => document.querySelector('#news-enviar-semanal')?.disabled);
    confere('sem item novo o botão fica desabilitado', true);
    const corpo = await p.locator('#news-corpo').innerText();
    confere('nada de votos, aprovações ou versões', !/aprov|versão|votar/i.test(corpo), corpo.slice(0, 200));
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/newsletter', { papel:'lideranca', feedOp:{ editor:false } }), { p } = t;
    await p.waitForSelector('#news-tabela, .vazio');
    const corpo = await p.locator('#news-corpo').innerText();
    confere('liderança que não edita vê as edições, não as próximas', !/equipe, semanal/i.test(corpo) && /edições/i.test(corpo) && await p.locator('#news-enviar-semanal').count() === 0);
    await fechar(t);
  }
  {
    const t = await abrir('#/servicos/reporte/1', { papel:'lideranca' }), { p } = t;
    await p.waitForTimeout(300);
    await p.evaluate(() => carregarModulo('reporte'));
    confere('o texto do reporte diz "mesa editorial"', await p.evaluate(() => typeof REP_ENVIO_LIDER === 'string' && REP_ENVIO_LIDER.includes('mesa editorial')));
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
