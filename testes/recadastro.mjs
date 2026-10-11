/* Recadastro, Meus dados e termo de sigilo do LABBIO (2.19.1), na tela.
   Confere, com asserção:
     1. na primeira entrada, o painel grande de passos aparece por cima do
        portal (quatro widgets quando a campanha inclui o termo, com o link
        do assinador do gov.br; um só nas outras) e pode ser dispensado uma
        vez; depois, o SOMA leva direto ao recadastro, de qualquer tela;
     2. Meus dados é separado: valida campo a campo e volta ao recadastro;
     3. o PDF baixado é o modelo original, sem alteração: mesmas páginas,
        mesmo texto; só os campos do formulário preenchidos e travados;
     4. o envio recusa PDF sem assinatura digital, sobe o assinado como veio
        (bucket termos, pasta campanha/registro) e registra o SHA-256; com
        tudo feito, o recadastro conclui e o SOMA fica livre;
     5. o serviço do termo, sozinho, pede os dados conferidos antes;
     6. os painéis do Pessoal: recadastro e termo (abrir, devolver).
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { PDFDocument } from './node_modules/pdf-lib/dist/pdf-lib.esm.js';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const PDFLIB = readFileSync(new URL('./node_modules/pdf-lib/dist/pdf-lib.min.js', import.meta.url), 'utf8');
const MODELO = readFileSync(new URL('../termos/termo_sigilo_labbio_3.pdf', import.meta.url));
const SHA = createHash('sha256').update(MODELO).digest('hex');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(rec, hash = '#/'){
  const ctx = await nav.newContext({ viewport:{ width:1280, height:900 }, acceptDownloads:true });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/pdf-lib.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:PDFLIB }));
  await p.addInitScript(t => { window.__teste = { rec: t }; }, rec && { sha: SHA, ...rec });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])'); await p.waitForTimeout(900);
  return { ctx, p, erros };
}

console.log('Entrada');
{
  const { ctx, p, erros } = await abrir({ termo:true });
  await p.waitForSelector('#rec-ov', { timeout:5000 }).catch(() => {});
  confere('primeira entrada: o painel grande aparece por cima do portal', await p.locator('#rec-ov .rec-painel.modal').count() === 1);
  confere('com os quatro passos em widgets, na ordem', JSON.stringify(await p.locator('#rec-ov .rec-passo h3').allTextContents())
    === JSON.stringify(['Confirme seus dados', 'Baixe o termo', 'Assine via gov.br', 'Faça o upload']));
  confere('o progresso é uma barra segmentada, um segmento por passo', await p.locator('#rec-ov .rec-barra[role="progressbar"] span').count() === 4);
  confere('o passo do gov.br já traz o link do assinador', await p.locator('#rec-ov .rec-passo:has-text("gov.br") a[href="https://assinador.iti.br/"]').count() === 1);
  confere('o primeiro passo é o atual; os do termo esperam os dados', await p.locator('#rec-ov .rec-passo.atual h3').textContent() === 'Confirme seus dados'
    && await p.locator('#rec-ov .rec-passo button:has-text("Baixar o termo")').isDisabled());
  const larg = await p.locator('#rec-ov .rec-painel').evaluate(e => e.getBoundingClientRect().width);
  confere('bem maior que um modal comum', larg > 1000, larg);
  confere('o menu de Serviços mostra Meus dados, Recadastro e o termo', await p.locator('#lt-nav a[href="#/servicos/dados"]').count() === 1
    && await p.locator('#lt-nav a[href="#/servicos/recadastro"]').count() === 1 && await p.locator('#lt-nav a[href="#/servicos/termo"]').count() === 1);
  await p.click('#rec-ov button:has-text("Agora não")'); await p.waitForTimeout(400);
  confere('dispensar fecha o painel e registra no servidor', await p.locator('#rec-ov').count() === 0
    && await p.evaluate(() => window.__rpcs.some(r => r.nome === 'recadastro_dispensar')));
  await p.evaluate(() => location.hash = '#/agenda'); await p.waitForTimeout(700);
  confere('e, na mesma sessão, o SOMA continua livre', (await p.evaluate(() => location.hash)).startsWith('#/agenda'));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ termo:false });
  await p.waitForSelector('#rec-ov', { timeout:5000 }).catch(() => {});
  confere('nos outros semestres, só confirmar os dados: um passo', await p.locator('#rec-ov .rec-passo').count() === 1
    && await p.locator('#rec-ov a[href="https://assinador.iti.br/"]').count() === 0
    && /Confira seus dados/.test(await p.locator('#rec-ov h2').textContent()));
  confere('e o termo não entra no menu', await p.locator('#lt-nav a[href="#/servicos/termo"]').count() === 0);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ termo:true, dispensa:true }, '#/agenda');
  await p.waitForTimeout(500);
  confere('na entrada seguinte, qualquer tela leva ao recadastro', await p.evaluate(() => location.hash) === '#/servicos/recadastro'
    && await p.locator('#main .rec-painel').count() === 1);
  await p.evaluate(() => location.hash = '#/atividades'); await p.waitForTimeout(600);
  confere('e não dá para sair dele', await p.evaluate(() => location.hash) === '#/servicos/recadastro');
  await p.evaluate(() => location.hash = '#/servicos/dados?de=recadastro'); await p.waitForTimeout(600);
  confere('mas Meus dados abre', await p.locator('#termo-form').count() === 1);
  confere('sem o "Agora não"', await p.locator('button:has-text("Agora não")').count() === 0);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ termo:true, dispensa:true, pausado:true }, '#/agenda');
  confere('de férias, o pedido fica pausado e o SOMA livre', (await p.evaluate(() => location.hash)).startsWith('#/agenda'));
  await ctx.close();
}

console.log('\nDados, termo e envio, pelo recadastro');
{
  const { ctx, p, erros } = await abrir({ termo:true, dispensa:true }, '#/servicos/recadastro');
  await p.waitForSelector('#main .rec-painel');
  await p.click('#main a:has-text("Conferir meus dados")'); await p.waitForSelector('#termo-form');
  confere('Meus dados é uma tela própria, com o endereço antigo à vista', await p.evaluate(() => location.hash) === '#/servicos/dados?de=recadastro'
    && /Rua Antiga, 10/.test(await p.locator('#main').innerText()));
  await p.fill('#t-cpf', '111.111.111-11'); await p.click('#termo-ok'); await p.waitForTimeout(400);
  confere('dados incompletos voltam campo a campo, com o CPF marcado', await p.locator('.fld.erro #t-cpf').count() === 1
    && await p.locator('.fld.erro').count() >= 10);
  const v = { nome_civil:'Ana Paula Figueiredo', cpf:'529.982.247-25', data_nascimento:'2001-03-04', rg:'MG-12.345.678', rg_orgao:'pc-mg',
    telefone:'(31) 99876-5432', end_cep:'31270-901', end_numero:'123', end_logradouro:'Rua dos Inconfidentes', end_complemento:'apto 201',
    end_bairro:'Pampulha', end_cidade:'Belo Horizonte', instituicao:'UFMG', curso:'Engenharia Elétrica', matricula:'2021012345' };
  for (const [k, x] of Object.entries(v)) await p.fill('#t-' + k, x);
  await p.selectOption('#t-estado_civil', 'solteiro(a)'); await p.selectOption('#t-end_uf', 'MG');
  await p.click('#termo-ok'); await p.waitForTimeout(800);
  confere('dados válidos: volta ao recadastro com o passo 1 feito', await p.evaluate(() => location.hash) === '#/servicos/recadastro'
    && await p.locator('.rec-passo.feito h3').first().textContent() === 'Confirme seus dados'
    && await p.locator('.rec-barra span.feito').count() === 1);
  confere('e o passo atual passa a ser baixar o termo', await p.locator('.rec-passo.atual h3').textContent() === 'Baixe o termo');
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.rec-passo button:has-text("Baixar o termo")')]);
  const bytes = readFileSync(await dl.path());
  confere('o arquivo leva o nome da pessoa', dl.suggestedFilename() === 'Termo de sigilo LABBIO - Ana Paula Figueiredo.pdf', dl.suggestedFilename());
  const doc = await PDFDocument.load(bytes), orig = await PDFDocument.load(MODELO);
  const campos = Object.fromEntries(doc.getForm().getFields().map(f => [f.getName(), [f.getText(), f.isReadOnly()]]));
  confere('os campos do formulário saem preenchidos e travados', campos.nome[0] === 'Ana Paula Figueiredo' && campos.CPF[0] === '529.982.247-25'
    && campos.expedidor[0] === 'PC-MG' && campos.text_11ahqw[0] === 'outubro' && campos.text_12giky[0] === '2026'
    && Object.values(campos).every(c => c[1]), campos);
  /* o resto do arquivo é o original: as mesmas páginas, com os mesmos conteúdos */
  const conteudo = d => d.getPages().map(pg => { const c = pg.node.Contents(); return c ? (c.asArray?.() || [c]).length : 0; });
  const fluxos = async d => Promise.all(d.getPages().map(async pg => { const c = pg.node.Contents(); const arr = c.asArray ? c.asArray() : [c];
    return arr.map(r => { const s = d.context.lookup(r); return s.contents ? createHash('sha256').update(s.contents).digest('hex') : ''; }).join(','); }));
  confere('sem nenhuma modificação no resto: mesmas páginas e os mesmos fluxos de conteúdo', doc.getPageCount() === orig.getPageCount()
    && JSON.stringify(await fluxos(doc)) === JSON.stringify(await fluxos(orig)));
  confere('a emissão vem da fotografia confirmada no servidor', await p.evaluate(() => window.__rpcs.some(r => r.nome === 'termo_emitir')));
  await p.waitForTimeout(600);
  confere('depois de baixar, continua no recadastro, no passo de assinar', await p.evaluate(() => location.hash) === '#/servicos/recadastro'
    && await p.locator('.rec-passo.atual h3').textContent() === 'Assine via gov.br');
  await p.click('.rec-passo a:has-text("Enviar o assinado")'); await p.waitForSelector('#t-arquivo', { state:'attached' });
  await p.setInputFiles('#t-arquivo', { name:'termo.pdf', mimeType:'application/pdf', buffer: bytes });
  await p.waitForTimeout(300);
  confere('PDF sem assinatura digital é recusado, com o motivo', await p.locator('#termo-enviar').isDisabled()
    && /não tem assinatura digital/.test(await p.locator('#termo-arquivo').innerText()));
  const assinado = Buffer.concat([bytes, Buffer.from('\n% assinatura\n1 0 obj << /Type /Sig /Filter /Adobe.PPKLite /SubFilter /ETSI.CAdES.detached /ByteRange [0 100 200 300] >> endobj\n')]);
  await p.setInputFiles('#t-arquivo', { name:'termo-assinado.pdf', mimeType:'application/pdf', buffer: assinado });
  await p.waitForTimeout(300);
  confere('PDF assinado é aceito', !(await p.locator('#termo-enviar').isDisabled()) && /assinado digitalmente/.test(await p.locator('#termo-arquivo').innerText()));
  await p.click('#termo-enviar'); await p.waitForTimeout(700);
  const up = await p.evaluate(() => (window.__uploads || []).filter(u => u.bucket === 'termos'));
  const reg = await p.evaluate(() => window.__rpcs.filter(r => r.nome === 'termo_registrar_envio').pop()?.p);
  const sha = createHash('sha256').update(assinado).digest('hex');
  confere('sobe no bucket termos, na pasta campanha/registro, como PDF', up.length === 1 && /^labbio-2026\/4\/[0-9a-f-]{36}\.pdf$/.test(up[0].caminho)
    && up[0].op?.contentType === 'application/pdf' && up[0].op?.upsert === false, up);
  confere('e registra o SHA-256 do arquivo exatamente como foi escolhido', reg && reg.p_sha256 === sha && reg.p_bytes === assinado.length && reg.p_arquivo === up[0].caminho, reg);
  confere('termina na confirmação', /Termo enviado/.test(await p.locator('#main').innerText()));
  await p.evaluate(() => location.hash = '#/agenda'); await p.waitForTimeout(600);
  confere('com tudo feito, o recadastro conclui e as outras telas abrem', (await p.evaluate(() => location.hash)).startsWith('#/agenda'));
  await p.evaluate(() => location.hash = '#/servicos/recadastro'); await p.waitForTimeout(600);
  confere('e o recadastro mostra concluído', /Recadastro concluído/.test(await p.locator('#main').innerText()));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nO termo como serviço à parte');
{
  const { ctx, p, erros } = await abrir({ termo:true, dispensa:true }, '#/servicos/termo');
  await p.waitForTimeout(700);
  confere('sem os dados conferidos, o termo manda conferir primeiro', await p.locator('#main a[href="#/servicos/dados?de=termo"]:has-text("Conferir meus dados")').count() === 1
    && await p.locator('#termo-baixar').count() === 0);
  confere('as etapas do termo são só baixar, assinar e enviar', JSON.stringify((await p.locator('.etapas li').allTextContents()).map(t => t.replace(/^\d+\s*/, '').trim()))
    .includes('Baixar') && await p.locator('.etapas li').count() === 3);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir(null, '#/servicos/dados');
  await p.waitForSelector('#termo-form');
  confere('sem campanha, Meus dados abre a qualquer hora', await p.locator('#termo-ok').count() === 1 && await p.locator('#rec-ov').count() === 0);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nPainel do Pessoal: recadastro');
{
  const { ctx, p, erros } = await abrir({ termo:true, dispensa:false, confirmado:'2026-10-10', enviado:'2026-10-10' }, '#/admin/recadastro');
  await p.waitForSelector('#sec-recadastro table');
  confere('mostra a campanha, quem concluiu e quem falta', await p.locator('#sec-recadastro tbody tr').count() === 2
    && /1 de 2 concluíram/.test(await p.locator('#sec-recadastro').textContent()) && /termo de sigilo do LABBIO/.test(await p.locator('#sec-recadastro').textContent()));
  p.once('dialog', d => d.accept());
  await p.click('#sec-recadastro button:has-text("Encerrar")'); await p.waitForTimeout(400);
  const enc = await p.evaluate(() => window.__rpcs.filter(r => r.nome === 'recadastro_campanha_ativar').pop()?.p);
  confere('encerrar manda a campanha', enc && enc.p_id === '2026-2' && enc.p_ativa === false, enc);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nPainel do Pessoal: termo');
{
  const { ctx, p, erros } = await abrir({ termo:true, dispensa:false, confirmado:'2026-10-10', conferido:'2026-10-10' }, '#/admin/termo');
  await p.waitForSelector('#sec-termo table');
  confere('lista os membros com a situação', await p.locator('#sec-termo tbody tr').count() === 3
    && /Enviado/.test(await p.locator('#sec-termo').textContent()) && /Pendente/.test(await p.locator('#sec-termo').textContent()));
  const [popup] = await Promise.all([p.waitForEvent('popup'), p.click('#sec-termo tr:has-text("Bruno") button:has-text("Abrir PDF")')]);
  await p.waitForTimeout(300);
  confere('abrir o PDF pede um link assinado do bucket termos, em nova guia', await p.evaluate(() => (window.__baixados || []).some(b => b.bucket === 'termos'
    && b.caminho.startsWith('labbio-2026/11/'))) && !!popup);
  p.once('dialog', d => d.accept('A assinatura não aparece no PDF'));
  await p.click('#sec-termo tr:has-text("Bruno") button:has-text("Devolver")'); await p.waitForTimeout(400);
  const dev = await p.evaluate(() => window.__rpcs.filter(r => r.nome === 'termo_conferir').pop()?.p);
  confere('devolver manda o motivo', dev && dev.p_registro === 11 && dev.p_ok === false && /assinatura/.test(dev.p_motivo), dev);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
