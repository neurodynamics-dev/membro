/* 2.19.2: a verificação da foto do pedido de acesso ao LABBIO (mod-biometria-rosto.js) e o envio de arquivo.
   - as quatro conferências (rosto, enquadramento, luz, contraste) sobre cenas sintéticas, com as caixas dos rostos dadas;
   - o laço ao vivo na câmera (a de mentira do Chromium), com detector falso: o botão só abre depois de três conferências
     boas seguidas e fecha de novo se piorar;
   - o arquivo: sempre à vista, sem verificação, com os requisitos;
   - sem a biblioteca: a câmera segue sem a verificação, com aviso;
   - o modelo de verdade (MediaPipe, vendor/mediapipe) carrega e roda: uma imagem em branco não tem rosto. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const com = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', args:['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { init, bloqueia = false } = {}){
  const ctx = await com.newContext({ viewport:{ width:1280, height:900 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  if (bloqueia) await p.route('**/vendor/mediapipe/**', r => r.abort());
  await p.addInitScript(() => { window.__teste = { biometria:{ etapa:'rascunho' } }; });
  if (init) await p.addInitScript(init);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
const fim = async ({ ctx, erros }) => { confere('sem erro de página', erros.length === 0, erros); await ctx.close(); };

/* a cena: um quadrado com o fundo, o "rosto" numa caixa (fração do quadrado) e, se quiser, a metade esquerda de outra cor */
const CENA = ({ fundo, pele, caixa, esq }) => {
  const c = document.createElement('canvas'); c.width = c.height = 320; const x = c.getContext('2d', { willReadFrequently:true });
  const cor = a => `rgb(${a.join(',')})`; x.fillStyle = cor(fundo); x.fillRect(0, 0, 320, 320);
  if (caixa){ const [bx, by, bw, bh] = [caixa.x * 320, caixa.y * 320, caixa.w * 320, caixa.h * 320];
    x.fillStyle = cor(pele); x.fillRect(bx, by, bw, bh);
    if (esq){ x.fillStyle = cor(esq); x.fillRect(bx, by, bw / 2, bh); } }
  return c;
};
const BOM = { fundo:[225, 225, 225], pele:[205, 160, 135], caixa:{ x:0.3, y:0.24, w:0.4, h:0.5 } };

try{
  console.log('As quatro conferências');
  {
    const t = await abrir('#/servicos/biometria'), { p } = t;
    await p.waitForSelector('.etapas');
    await p.evaluate(() => carregarModulo('biometria-rosto'));
    const avalia = (cena, rostos) => p.evaluate(([f, c, r]) => { const cv = (0, eval)('(' + f + ')')(c);
      const res = bioAvaliar(cv, r === undefined ? [c.caixa] : r); return { ok:res.ok, it:Object.fromEntries(res.itens.map(i => [i.k, [i.ok, i.txt]])) };
    }, [CENA.toString(), cena, rostos]);
    const so = (r, k) => r.it[k][0], tx = (r, k) => r.it[k][1];

    let r = await avalia(BOM);
    confere('rosto bem posto, luz boa, fundo claro: tudo certo', r.ok && ['rosto', 'margem', 'luz', 'contraste'].every(k => so(r, k) === true), r);

    r = await avalia(BOM, []);
    confere('sem rosto: avisa, e o resto fica pendente', !r.ok && so(r, 'rosto') === false && /Não achamos um rosto/.test(tx(r, 'rosto'))
      && ['margem', 'luz', 'contraste'].every(k => so(r, k) === null), r);
    r = await avalia(BOM, [BOM.caixa, { x:0.05, y:0.5, w:0.2, h:0.2 }]);
    confere('dois rostos: pede só uma pessoa', so(r, 'rosto') === false && /mais de um rosto/.test(tx(r, 'rosto')), r);

    r = await avalia({ ...BOM, caixa:{ x:0.42, y:0.35, w:0.16, h:0.2 } });
    confere('rosto pequeno: "Aproxime-se"', so(r, 'margem') === false && /Aproxime-se/.test(tx(r, 'margem')), r);
    r = await avalia({ ...BOM, caixa:{ x:0.12, y:0.1, w:0.76, h:0.8 } });
    confere('rosto grande demais: "Afaste-se"', so(r, 'margem') === false && /Afaste-se/.test(tx(r, 'margem')), r);
    r = await avalia({ ...BOM, caixa:{ x:0.52, y:0.24, w:0.4, h:0.5 } });
    confere('rosto fora do centro: "Centralize"', so(r, 'margem') === false && /Centralize/.test(tx(r, 'margem')), r);

    r = await avalia({ fundo:[60, 60, 60], pele:[50, 38, 32], caixa:BOM.caixa });
    confere('escuro: "Pouca luz"', so(r, 'luz') === false && /Pouca luz/.test(tx(r, 'luz')), r);
    r = await avalia({ fundo:[120, 120, 120], pele:[253, 247, 243], caixa:BOM.caixa });
    confere('estourado: "Luz forte demais"', so(r, 'luz') === false && /forte demais/.test(tx(r, 'luz')), r);
    r = await avalia({ fundo:[240, 240, 240], pele:[75, 58, 52], caixa:BOM.caixa });
    confere('janela atrás: "Contraluz"', so(r, 'luz') === false && /Contraluz/.test(tx(r, 'luz')), r);
    r = await avalia({ ...BOM, esq:[200, 160, 135], pele:[85, 66, 58] });
    confere('luz de um lado só', so(r, 'luz') === false && /só de um lado/.test(tx(r, 'luz')), r);

    r = await avalia({ fundo:[205, 162, 138], pele:[205, 160, 135], caixa:BOM.caixa });
    confere('fundo da cor da pele: contraste ruim', so(r, 'contraste') === false && /parecido com você/.test(tx(r, 'contraste')), r);
    r = await avalia({ fundo:[40, 40, 44], pele:[205, 160, 135], caixa:BOM.caixa });
    confere('pele clara em fundo escuro: contraste bom (e a luz, boa)', so(r, 'contraste') === true && so(r, 'luz') === true, r);
    await fim(t);
  }

  console.log('Ao vivo, na câmera');
  {
    /* o detector de mentira devolve a caixa que o teste mandar, em pixels da imagem recebida */
    const t = await abrir('#/servicos/biometria/foto', { init: () => { window.__rostos = []; window.__bioDetector = { detect: img => ({ detections: window.__rostos.map(b => ({
      boundingBox:{ originX:b.x * img.width, originY:b.y * img.height, width:b.w * img.width, height:b.h * img.height } })) }) }; } }), { p } = t;
    await p.waitForSelector('#bio-checks');
    const botao = () => p.evaluate(() => !document.querySelector('#bio-tirar').disabled);
    const cena = c => p.evaluate(([f, c]) => { const fn = (0, eval)('(' + f + ')'); window.bioAmostra = () => fn(c); window.__rostos = c.caixa ? [c.caixa] : []; }, [CENA.toString(), c]);
    await p.waitForTimeout(700);
    confere('sem rosto: o botão fica fechado e a lista diz o que falta', !(await botao()) && /Não achamos um rosto/.test(await p.locator('#bio-checks').innerText()));
    await cena(BOM);
    await p.waitForFunction(() => !document.querySelector('#bio-tirar').disabled);
    confere('com tudo bom, o botão abre e o oval fica verde', await p.locator('#bio-cena.ok').count() === 1
      && /Tudo certo/.test(await p.locator('#bio-verif-nota').innerText()) && await p.locator('#bio-checks li.ok').count() === 4);
    await cena({ fundo:[60, 60, 60], pele:[50, 38, 32], caixa:BOM.caixa });
    await p.waitForFunction(() => document.querySelector('#bio-tirar').disabled);
    confere('a luz piora: o botão fecha de novo, com o motivo', /Pouca luz/.test(await p.locator('#bio-checks').innerText()) && await p.locator('#bio-cena.ok').count() === 0);
    await cena(BOM);
    await p.waitForFunction(() => !document.querySelector('#bio-tirar').disabled);
    await p.click('#bio-tirar'); await p.waitForSelector('#bio-usar');
    confere('tirar a foto: prévia, câmera parada, e a origem é a câmera', await p.evaluate(() => bio.stream === null && bio.origem === 'camera')
      && /pela câmera, depois da verificação/.test(await p.locator('#bio-origem-nota').innerText()));
    confere('o laço parou (nada mais é conferido)', await p.evaluate(() => new Promise(r => { const a = bio.vez; setTimeout(() => r(a === bio.vez), 600); })));
    await fim(t);
  }

  console.log('O arquivo, sem verificação');
  {
    const t = await abrir('#/servicos/biometria/foto'), { p } = t;
    await p.waitForSelector('#bio-upload');
    const req = await p.locator('.bio-req').innerText();
    confere('os requisitos ficam à vista, ao lado da câmera e do arquivo', /Rosto de frente/.test(req) && /Fundo claro e liso/.test(req)
      && /Luz de frente/.test(req) && /JPEG ou PNG, até 5 MB/.test(req) && await p.locator('#bio-upload').isVisible());
    confere('o arquivo avisa que não é verificado', /Sem verificação automática/.test(await p.locator('#bio-upload').innerText()));
    const png = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 400; c.height = 300; c.getContext('2d').fillRect(0, 0, 400, 300); return c.toDataURL('image/png').split(',')[1]; });
    await p.setInputFiles('#bio-arq', { name:'foto.png', mimeType:'image/png', buffer:Buffer.from(png, 'base64') });
    await p.waitForSelector('#bio-usar');
    confere('com o arquivo: prévia, câmera parada e a nota de que não houve verificação', await p.evaluate(() => bio.stream === null && bio.origem === 'arquivo')
      && /sem verificação automática/.test(await p.locator('#bio-origem-nota').innerText()) && await p.locator('#bio-usar:not([disabled])').count() === 1);
    confere('o arquivo qualquer vale (sem barrar pela imagem)', await p.locator('#bio-erro').innerText() === '');
    await fim(t);
  }
  {
    const t = await abrir('#/servicos/biometria/foto'), { p } = t;
    await p.waitForSelector('#bio-upload');
    await p.setInputFiles('#bio-arq', { name:'doc.pdf', mimeType:'application/pdf', buffer:Buffer.from('%PDF') });
    await p.waitForTimeout(300);
    confere('formato que não é JPEG nem PNG: recusa e diz o que vale', /JPEG ou PNG de até 5 MB/.test(await p.locator('#bio-erro').innerText()) && await p.locator('#bio-usar').count() === 0);
    await fim(t);
  }

  console.log('Sem a biblioteca');
  {
    const t = await abrir('#/servicos/biometria/foto', { bloqueia:true }), { p } = t;
    await p.waitForFunction(() => document.querySelector('#bio-tirar') && !document.querySelector('#bio-tirar').disabled);
    confere('a câmera segue, com o aviso de que não há verificação', /Não foi possível ligar a verificação automática/.test(await p.locator('#bio-verif-nota').innerText()));
    await fim(t);
  }

  console.log('O modelo de verdade');
  {
    const t = await abrir('#/servicos/biometria/foto'), { p } = t;
    await p.waitForSelector('#bio-upload');
    const r = await p.evaluate(async () => { await carregarModulo('biometria-rosto'); const det = await bioDetector();
      const c = document.createElement('canvas'); c.width = c.height = 320; c.getContext('2d').fillStyle = '#ddd'; c.getContext('2d').fillRect(0, 0, 320, 320);
      return (await bioRostos(det, c)).length; });
    confere('o modelo carrega do repositório e roda: imagem lisa não tem rosto', r === 0, r);
    await fim(t);
  }
}catch(e){ console.error(e); falhas++; }
await com.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
