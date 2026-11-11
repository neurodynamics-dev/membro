/* Studio: subir artes prontas (2.31.0), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Do topo — o botão ao lado de "Criar publicação"; a janela pede o
       plano e as imagens; as imagens entram em ordem de nome (01, 02,
       10); o que não é PNG nem JPG fica de fora, com o porquê; tamanhos
       diferentes avisam; mudar a ordem e tirar; o formato acompanha a
       quantidade; sem nome, não salva; salvar e mandar cria a
       publicação em produção, sobe as imagens como estão (o mesmo
       arquivo, na ordem) para o bucket "studio", grava as imagens sem
       peça e manda para aprovação; a tela vai para a publicação nova;
     Da publicação — sem arte, o botão no cartão vazio; com a arte do
       criador, "Trocar por artes prontas" avisa que a peça sai, troca
       as imagens, apaga as antigas e não muda a coluna; em aprovação,
       não oferece mandar de novo; aprovada, avisa que volta para
       aprovação; uma ideia com arte vai para produção;
     e: celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
/* a POST-3 com a peça do criador, para o caso de trocar a arte feita lá */
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8')
  .replace("legenda:'Saímos no Jornal Nacional!', criado_em", "legenda:'Saímos no Jornal Nacional!', peca:{ modelo:'na_midia', laminas:[{ layout:'midia', campos:{} }] }, criado_em");
if (!/peca:\{ modelo:'na_midia'/.test(stub)) { console.log('FALHA  o stub mudou: a POST-3 não ganhou a peça'); process.exit(1); }
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/' } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1000);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1300) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const ordem = p => p.evaluate(() => [...document.querySelectorAll('#sa-lista img')].map(i => i.alt.replace(/^Imagem \d+: /, '')));
/* um PNG de verdade, desenhado no navegador: largura × altura, numa cor */
async function png(p, w, h, cor, tipo = 'image/png'){
  const b64 = await p.evaluate(([w, h, cor, tipo]) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = cor; x.fillRect(0, 0, w, h); return c.toDataURL(tipo).split(',')[1]; }, [w, h, cor, tipo]);
  return Buffer.from(b64, 'base64');
}
const arq = (name, buffer, mimeType = 'image/png') => ({ name, mimeType, buffer });

/* ================= do topo: uma publicação nova, com as artes ================= */
{
  const { ctx, p, erros } = await abrir({ hash:'#/studio' });
  const topo = await p.evaluate(() => [...document.querySelectorAll('#main .btn')].map(b => b.textContent.trim()));
  const iSobe = topo.indexOf('Subir artes prontas'), iCria = topo.indexOf('Criar publicação');
  confere('o quadro tem "Subir artes prontas", ao lado de "Criar publicação"', iSobe >= 0 && iCria === iSobe + 1, topo);
  await p.click('#main .btn:has-text("Subir artes prontas")'); await p.waitForTimeout(300);
  confere('a janela pede o plano e as imagens', await p.evaluate(() => !!$('#modal.open #sp-titulo') && !!$('#modal #sa-arq')
    && /como estão/.test($('#modal').textContent) && $('#sp-resp').value === '4' && $('#sp-formato').value === 'carrossel'));

  const a = await png(p, 1440, 1800, '#00352F'), b = await png(p, 1440, 1800, '#CEDC00'), c = await png(p, 1440, 1800, '#E3EFEC');
  await p.setInputFiles('#sa-arq', [arq('mit-10.png', c), arq('mit-02.png', b), arq('mit-01.png', a), arq('notas.txt', Buffer.from('oi'), 'text/plain')]);
  await p.waitForTimeout(500);
  confere('as imagens entram em ordem de nome: 01, 02, 10', (await ordem(p)).join() === 'mit-01.png,mit-02.png,mit-10.png', await ordem(p));
  confere('o que não é PNG nem JPG fica de fora, com o porquê', /notas\.txt: não é PNG nem JPG/.test(await p.evaluate(() => $('#sa-aviso').textContent)));
  const legs = await p.evaluate(() => [...document.querySelectorAll('#sa-lista figcaption')].map(f => f.textContent.replace(/\s+/g, ' ')).join('|'));
  confere('cada imagem mostra o número e o tamanho', legs === '011440 × 1800|021440 × 1800|031440 × 1800', legs);
  confere('e a área vira "Pôr mais imagens"', /Pôr mais imagens/.test(await p.evaluate(() => $('#sa-solta').textContent)));

  const d = await png(p, 1080, 1080, '#00594F', 'image/jpeg');
  await p.setInputFiles('#sa-arq', [arq('quadrada.jpg', d, 'image/jpeg')]); await p.waitForTimeout(400);
  confere('mais imagens entram depois das que já estavam', (await ordem(p)).join() === 'mit-01.png,mit-02.png,mit-10.png,quadrada.jpg', await ordem(p));
  confere('tamanhos diferentes avisam', /tamanhos diferentes \(1440 × 1800, 1080 × 1080\)/.test(await p.evaluate(() => $('#sa-aviso').textContent)));
  await p.click('#sa-lista figure:nth-child(4) button[title="Tirar"]'); await p.waitForTimeout(200);
  confere('tirar uma imagem, e o aviso de tamanho sai', (await ordem(p)).length === 3 && !/tamanhos diferentes/.test(await p.evaluate(() => $('#sa-aviso').textContent)));
  await p.click('#sa-lista figure:nth-child(1) button[title="Para depois"]'); await p.waitForTimeout(200);
  confere('mudar a ordem', (await ordem(p)).join() === 'mit-02.png,mit-01.png,mit-10.png', await ordem(p));
  await p.click('#sa-lista figure:nth-child(2) button[title="Para antes"]'); await p.waitForTimeout(200);
  confere('e voltar', (await ordem(p)).join() === 'mit-01.png,mit-02.png,mit-10.png', await ordem(p));

  await p.click('#modal .btn:has-text("Salvar e mandar para aprovação")'); await p.waitForTimeout(400);
  confere('sem nome, não salva', /Dê um nome/.test(await toasts(p)) && !(await rpcs(p, 'studio_publicacao_salvar')).length);
  await p.fill('#sp-titulo', 'MIT Hacking Medicine');
  await p.fill('#sp-legenda', 'Membros da NeuroDynamics participaram do MIT Hacking Medicine.');
  await p.click('#modal .btn:has-text("Salvar e mandar para aprovação")');
  await p.waitForFunction(() => /^#\/studio\/POST-\d+$/.test(location.hash), null, { timeout:10000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const sv = await rpcs(p, 'studio_publicacao_salvar');
  const cria = sv.find(x => !x.id), grava = sv.find(x => x.id && x.imagens);
  const id = grava?.id, cod = await p.evaluate(() => location.hash.replace('#/studio/', ''));
  confere('cria a publicação em produção, com o plano', cria?.status === 'producao' && cria.titulo === 'MIT Hacking Medicine'
    && cria.formato === 'carrossel' && cria.redes?.[0] === 'instagram' && /participaram/.test(cria.legenda), cria);
  const ups = await p.evaluate(() => (window.__uploads || []).filter(u => u.bucket === 'studio'));
  confere('as três imagens sobem como estão, na ordem, para o bucket studio',
    ups.length === 3 && ups.every((u, i) => u.caminho.startsWith(id + '/arte-') && u.caminho.endsWith(`-0${i + 1}.png`) && u.op?.contentType === 'image/png')
    && ups.map(u => u.nome).join() === 'mit-01.png,mit-02.png,mit-10.png', ups);
  confere('e ficam gravadas na publicação, sem peça do criador', !!id && grava.peca === null && grava.imagens.length === 3
    && grava.imagens.every((x, i) => x.caminho === ups[i].caminho && x.largura === 1440 && x.altura === 1800 && x.tipo === 'image/png'), grava);
  const mv = await rpcs(p, 'studio_mover');
  confere('e vai para aprovação', mv.some(x => x.p_id === id && x.p_status === 'aprovacao'), mv);
  confere('o aviso diz o que aconteceu', (await toasts(p)).includes(cod + ': 3 imagens salvas e mandadas para aprovação'), await toasts(p));
  await p.waitForSelector('#st-car figure', { timeout:5000 }).catch(() => {});
  const tela = await p.evaluate(() => [location.hash, document.querySelector('#main h1')?.textContent, document.querySelectorAll('#st-car figure').length,
    document.querySelector('.st-passos li.agora')?.textContent, [...document.querySelectorAll('#main .btn')].map(b => b.textContent.trim())]);
  confere('a tela vai para a publicação nova, em aprovação, com as três imagens', /^#\/studio\/POST-\d+$/.test(tela[0]) && tela[1] === 'MIT Hacking Medicine'
    && tela[2] === 3 && /aprovação/i.test(tela[3]), tela.slice(0, 4));
  confere('e oferece trocar as artes ou fazer no criador', tela[4].includes('Trocar as artes') && tela[4].includes('Fazer no criador'), tela[4]);
  confere('nenhum erro de página (do topo)', !erros.length, erros);
  await ctx.close();
}

/* ================= da publicação ================= */
{
  const { ctx, p, erros } = await abrir({ hash:'#/studio' });
  const um = await png(p, 1440, 1800, '#00352F'), dois = await png(p, 1440, 1800, '#CEDC00');

  /* sem arte: o botão no cartão vazio; "Salvar" não muda a coluna */
  await ir(p, '#/studio/POST-6');
  confere('sem arte: "Subir artes prontas" no cartão vazio, ao lado de "Criar a arte"',
    await p.evaluate(() => /Criar a arte/.test($('.st-arte .vazio').textContent) && /Subir artes prontas/.test($('.st-arte .vazio').textContent)));
  await p.click('.st-arte .vazio .btn:has-text("Subir artes prontas")'); await p.waitForTimeout(300);
  confere('a janela não pede o plano de novo', await p.evaluate(() => !$('#modal #sp-titulo') && /para POST-6/.test($('#modal h3').textContent)
    && /versão 2/.test($('#modal').textContent)));
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(300);
  confere('sem imagens, não salva', /Escolha as imagens/.test(await toasts(p)) && !(await rpcs(p, 'studio_publicacao_salvar')).length);
  await p.setInputFiles('#sa-arq', [arq('capa.png', um)]); await p.waitForTimeout(400);
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(1800);
  let sv = (await rpcs(p, 'studio_publicacao_salvar')).filter(x => x.id === 'p6');
  confere('a imagem fica na publicação', sv.at(-1)?.imagens?.length === 1 && sv.at(-1).peca === null && /^p6\/arte-.+-01\.png$/.test(sv.at(-1).imagens[0].caminho), sv);
  confere('"Salvar" não manda para aprovação', !(await rpcs(p, 'studio_mover')).some(x => x.p_id === 'p6'));
  confere('e a página mostra a arte', await p.evaluate(() => document.querySelectorAll('#st-car figure').length === 1 && /1 imagem/.test($('.st-arte h3').textContent)));

  /* com a arte do criador, em aprovação */
  await ir(p, '#/studio/POST-3');
  confere('com a arte do criador: "Editar a arte" e "Trocar por artes prontas"',
    await p.evaluate(() => { const t = [...document.querySelectorAll('#main .btn')].map(b => b.textContent.trim()); return t.includes('Editar a arte') && t.includes('Trocar por artes prontas'); }));
  await p.click('#main .btn:has-text("Trocar por artes prontas")'); await p.waitForTimeout(300);
  const txt = await p.evaluate(() => $('#modal').textContent);
  confere('avisa que as imagens de agora e a peça do criador saem', /versão 2 da arte; as de agora saem/.test(txt) && /peça feita no criador sai junto/.test(txt), txt);
  confere('e que as aprovações eram da versão anterior; não oferece mandar de novo', /aprovações que já houve eram da versão anterior/.test(txt)
    && !/Salvar e mandar/.test(await p.evaluate(() => $('#modal .acts').textContent)));
  await p.setInputFiles('#sa-arq', [arq('b.png', dois), arq('a.png', um)]); await p.waitForTimeout(400);
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(1800);
  sv = (await rpcs(p, 'studio_publicacao_salvar')).filter(x => x.id === 'p3');
  confere('troca as imagens e tira a peça', sv.at(-1)?.imagens?.length === 2 && sv.at(-1).peca === null, sv);
  const rem = await p.evaluate(() => (window.__removidosB || []).filter(x => x.bucket === 'studio').map(x => x.caminho));
  confere('as imagens antigas saem do bucket', rem.includes('p3/arte-b-01.jpg') && rem.includes('p3/arte-b-02.png'), rem);
  confere('e continua em aprovação, sem chamar studio_mover', !(await rpcs(p, 'studio_mover')).some(x => x.p_id === 'p3')
    && await p.evaluate(() => /aprovação/i.test(document.querySelector('.st-passos li.agora')?.textContent || '')));
  confere('o botão agora é "Trocar as artes"', await p.evaluate(() => [...document.querySelectorAll('#main .btn')].some(b => b.textContent.trim() === 'Trocar as artes')));

  /* aprovada: avisa que volta */
  await ir(p, '#/studio/POST-4');
  await p.click('#main .btn:has-text("Trocar")'); await p.waitForTimeout(300);
  confere('aprovada: avisa que volta para aprovação', /estava aprovada.+volta para aprovação/.test(await p.evaluate(() => $('#modal').textContent)));
  await p.click('#modal .btn:has-text("Cancelar")'); await p.waitForTimeout(200);

  /* uma ideia que ganha arte vai para produção */
  await ir(p, '#/studio/POST-1');
  await p.click('.st-arte .vazio .btn:has-text("Subir artes prontas")'); await p.waitForTimeout(300);
  await p.setInputFiles('#sa-arq', [arq('reels-capa.png', um)]); await p.waitForTimeout(400);
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(1800);
  confere('uma ideia com arte vai para produção', (await rpcs(p, 'studio_mover')).some(x => x.p_id === 'p1' && x.p_status === 'producao'));
  confere('nenhum erro de página (da publicação)', !erros.length, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/studio' });
  confere('celular: o quadro, com o botão novo, sem rolagem horizontal', await semRolagem(p));
  await p.click('#main .btn:has-text("Subir artes prontas")'); await p.waitForTimeout(300);
  const a = await png(p, 1440, 1800, '#00352F');
  await p.setInputFiles('#sa-arq', [arq('01.png', a), arq('02.png', a), arq('03.png', a)]); await p.waitForTimeout(500);
  confere('celular: a janela, com as imagens, sem rolagem horizontal', await semRolagem(p)
    && await p.evaluate(() => [...document.querySelectorAll('#sa-lista figure')].every(f => f.getBoundingClientRect().right <= innerWidth)));
  confere('nenhum erro de página (celular)', !erros.length, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
