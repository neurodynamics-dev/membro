/* O aproveitamento de AACC (v33), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Serviços — o cartão e o item do menu; o início avisa o pedido que
       espera a decisão de quem está logado;
     O meu pedido — o contador dos passos (o do Arquivos), a ficha que
       falta (o ingresso que não é semestre volta, os pronomes, o curso
       da lista), os semestres, o painel do enquadramento (a estimativa,
       o OUT com a norma do Colegiado, a extensão que pede os semestres
       do SIEX), o pedido que nasce, o ZIP
       com o soma.tex do pedido (o template dentro, os afastamentos e os
       treinamentos do SOMA), só o soma.tex, o PDF em rascunho que não
       passa e o final que sobe para a pasta da pessoa e é enviado;
     Quem aprova — a lista "para aprovar", a última etapa (a Diretoria)
       indica o professor, com o departamento e a unidade (e-mail de fora
       do domínio volta), e o link assinado do PDF da versão em análise;
     O PDF final — o relatório com a folha de aprovação no lugar da
       página 2, sem mudar o número de páginas, com o link da validação e
       a marca nos metadados; na capa, a data da aprovação no lugar do
       "Pendente"; só a folha, em uma página;
     O professor — sem o link, o portal; o link vencido e o inválido; o
       barema que soma, a nota mínima, a declaração que destrava o botão,
       a aprovação; devolver pede o parecer;
     A validação — auth.neurodynamics.dev mostra as aprovações, o barema
       e baixa a folha;
     As configurações — as etapas; e: a busca, o celular sem rolagem
       horizontal, nenhum ponto médio na tela, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument, StandardFonts, PDFName } from 'pdf-lib';
import JSZip from 'jszip';

const nm = p => new URL('./node_modules/' + p, import.meta.url);
const STUB = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('./stub-aacc.js', import.meta.url), 'utf8');
const JSPDF = readFileSync(nm('jspdf/dist/jspdf.umd.min.js'), 'utf8');
const QR = readFileSync(nm('qrcode-generator/qrcode.js'), 'utf8');
const PDFLIB = readFileSync(nm('pdf-lib/dist/pdf-lib.min.js'), 'utf8');
const JSZIPJS = readFileSync(nm('jszip/dist/jszip.min.js'), 'utf8');
const DOCNRO = readFileSync(new URL('../doc-nro.js', import.meta.url), 'utf8');
const SELO = readFileSync(new URL('../selo-solene.png', import.meta.url));
const LOGO = readFileSync(new URL('../logo-nro.png', import.meta.url));
const DIR = mkdtempSync(join(tmpdir(), 'aacc-'));

/* o PDF que o template gera: as palavras-chave da classe e a folha
   reservada na página 2 */
async function fazPdf(kw, paginas = 5){
  const d = await PDFDocument.create();
  const f = await d.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= paginas; i++){
    const p = d.addPage([595.28, 841.89]);
    p.drawText(i === 2 ? 'Folha reservada ao SOMA' : `Pagina ${i} do relatorio`, { x:60, y:760, size:16, font:f });
    /* a capa: o "Pendente" da avaliação da equipe onde a palavra-chave diz */
    if (i === 1) p.drawText('Pendente', { x:138 * 72 / 25.4, y:41.8 * 72 / 25.4, size:9, font:f });
  }
  d.setKeywords([kw]);
  return d.save();
}
const kw = (doc, extra = {}) => Object.entries({ documento:doc, modo:'final', pendencias:'0', folha:'2', principal:'EQC',
  creditos:'10', principalcreditos:'9', avaliacao:'138,41.8', itens:'1', semestres:'3', exemplo:'nao', ...extra }).reduce((s, [k, v]) => s + `; ${k}=${v}`, 'nro-aacc');
const PDF_FINAL = await fazPdf(kw('NRO-PES-020-9'));
const PDF_RASC = await fazPdf(kw('NRO-PES-020-9', { modo:'rascunho', pendencias:'4' }));
const PDF_AAC5 = await fazPdf(kw('NRO-PES-020-5'));
writeFileSync(join(DIR, 'relatorio-final.pdf'), PDF_FINAL);
writeFileSync(join(DIR, 'relatorio-rascunho.pdf'), PDF_RASC);
const zipT = new JSZip();
zipT.file('relatorio-aacc.tex', '\\documentclass[rascunho]{nro-aacc}\n'); zipT.file('nro-aacc.cls', '%% classe\n'); zipT.file('nro/equipe.tex', '%% equipe\n');
const TEMPLATE = await zipT.generateAsync({ type:'nodebuffer' });

const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });
let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function rotas(p){
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:STUB }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route('**/cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:PDFLIB }));
  await p.route('**/cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSZIPJS }));
  await p.route('https://brand.neurodynamics.dev/assets/template-relatorio-aacc.zip', r => r.fulfill({ status:200, contentType:'application/zip', body:TEMPLATE,
    headers:{ 'access-control-allow-origin':'*' } }));
  await p.route('https://membro.neurodynamics.dev/doc-nro.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:DOCNRO }));
  await p.route('https://membro.neurodynamics.dev/selo-solene.png', r => r.fulfill({ status:200, contentType:'image/png', body:SELO,
    headers:{ 'access-control-allow-origin':'*' } }));
  await p.route('https://membro.neurodynamics.dev/logo-nro.png', r => r.fulfill({ status:200, contentType:'image/png', body:LOGO,
    headers:{ 'access-control-allow-origin':'*' } }));
  await p.route(/fonts\.googleapis|fonts\.gstatic|raw\.githubusercontent|youtube\.com|ytimg/, r => r.abort());
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/' } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await rotas(p);
  await p.addInitScript(b64 => { window.__aaccPdf = b64; try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} }, Buffer.from(PDF_AAC5).toString('base64'));
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const texto = async (p, sel) => { const l = p.locator(sel).first(); return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
async function baixa(p, acao){
  const [d] = await Promise.all([p.waitForEvent('download', { timeout:20000 }), acao()]);
  const caminho = join(DIR, d.suggestedFilename().replace(/[\\/]/g, '_'));
  await d.saveAs(caminho);
  return { nome:d.suggestedFilename(), caminho };
}
const pdfTexto = (arq, pg) => execFileSync('pdftotext', ['-f', String(pg), '-l', String(pg), '-layout', arq, '-'], { encoding:'utf8' });

/* ================= Serviços, o início e o meu pedido ================= */
{
  console.log('\nServiços, o início e o meu pedido');
  const { ctx, p, erros } = await abrir();
  confere('o início avisa o pedido de aproveitamento que espera a decisão',
    await p.locator('#sec-pend a.pend-i[href="#/servicos/aproveitamento/aprovar"]').count() === 1 && /Um pedido de aproveitamento aguarda/.test(await texto(p, '#sec-pend')));
  await ir(p, '#/servicos');
  confere('Serviços tem o cartão do aproveitamento', await p.locator('#main a.srv[href="#/servicos/aproveitamento"]').count() === 1);
  confere('e o menu, o item', await p.locator('#lt-nav a[href="#/servicos/aproveitamento"]').count() === 1);
  confere('a busca conhece os pedidos', await p.evaluate(() => typeof FONTES_BUSCA !== 'undefined'));

  await ir(p, '#/servicos/aproveitamento', 1500);
  confere('o passo 1 está aberto, e os outros travados', await p.locator('#aac-p1.atual').count() === 1 && await p.locator('#aac-p2.trava').count() === 1);
  confere('o contador dos passos, o mesmo do Arquivos: cinco, na ficha', await p.locator('.arq-etapas.aac-trilha .arq-etapa').count() === 5
    && /^Ficha/.test(await texto(p, '.aac-trilha .arq-etapa[aria-current="step"]')) && /faltam 3 campos/.test(await texto(p, '.aac-trilha')),
    await texto(p, '.aac-trilha'));
  confere('a ficha mostra só os três campos que faltam', await p.locator('.aac-campos [data-k]').count() === 3
    && await p.locator('#aac-f-periodo_ingresso').count() === 1 && await p.locator('select#aac-f-pronomes').count() === 1
    && await p.locator('#aac-f-autodeclaracao_racial').count() === 1);
  confere('o menu acende o item', await p.locator('#lt-nav a[href="#/servicos/aproveitamento"][aria-current="page"]').count() === 1);
  confere('as abas de quem também aprova', (await texto(p, 'nav.nav1')).includes('Para aprovar') && (await texto(p, 'nav.nav1')).includes('Configurações'));
  await p.fill('#aac-f-periodo_ingresso', 'segundo de 2022');
  await p.selectOption('#aac-f-pronomes', 'ela');
  await p.fill('#aac-f-autodeclaracao_racial', 'Parda');
  await p.click('#aac-ficha-btn'); await p.waitForTimeout(500);
  confere('o ingresso que não é semestre volta, com o nome do campo', /Semestre de ingresso no curso/.test(await toasts(p)), await toasts(p));
  await p.fill('#aac-f-periodo_ingresso', '2022/2');
  await p.click('#aac-ficha-btn'); await p.waitForTimeout(1200);
  const salvo = (await rpcs(p, 'aacc_perfil_salvar')).pop();
  confere('a ficha salva os três campos', salvo?.p?.periodo_ingresso === '2022/2' && salvo?.p?.autodeclaracao_racial === 'Parda'
    && salvo?.p?.pronomes === 'ela', salvo);
  confere('o passo 1 fica feito e o 2 abre', await p.locator('#aac-p1.feito').count() === 1 && await p.locator('#aac-p2.atual').count() === 1
    && /^Enquadramento/.test(await texto(p, '.aac-trilha .arq-etapa[aria-current="step"]')));
  /* o curso vem da lista: as engenharias e as cinco unidades */
  await p.click('button:has-text("Editar a ficha")'); await p.waitForTimeout(300);
  confere('o curso é uma lista, por unidade', await p.locator('#aac-f-curso-sel optgroup').count() === 7
    && await p.locator('#aac-f-curso-sel optgroup[label="EEFFTO"] option').count() === 3
    && await p.inputValue('#aac-f-curso-sel') === 'Engenharia de Controle e Automação' && await p.locator('#aac-f-curso[hidden]').count() === 1);
  await p.selectOption('#aac-f-curso-sel', '__outro'); await p.waitForTimeout(100);
  confere('"Outro curso" abre o campo para escrever', await p.locator('#aac-f-curso:not([hidden])').count() === 1);
  await p.selectOption('#aac-f-curso-sel', 'Engenharia Elétrica'); await p.waitForTimeout(100);
  confere('e a lista o fecha de novo', await p.locator('#aac-f-curso[hidden]').count() === 1 && await p.inputValue('#aac-f-curso') === 'Engenharia Elétrica');
  await p.click('#aac-ficha-btn'); await p.waitForTimeout(1200);
  confere('a ficha salva o curso da lista', (await rpcs(p, 'aacc_perfil_salvar')).pop()?.p?.curso === 'Engenharia Elétrica');
  confere('os semestres: três contam, um é parcial', await p.locator('.aac-sems .aac-sem.conta').count() === 3 && await p.locator('.aac-sems .aac-sem.parcial').count() === 1);
  confere('a sugestão já vem: EQC principal, VPC alternativa', await p.locator('.aac-op.pri .cod').textContent() === 'EQC' && await p.locator('.aac-op.alt .cod').textContent() === 'VPC');
  confere('a estimativa da equipe de competição: 9 créditos', (await texto(p, '.aac-op.pri .est')) === '9 créditos', await texto(p, '.aac-op.pri .est'));
  confere('sem iniciação científica no painel', await p.locator('.aac-op .cod:text-is("IC")').count() === 0);
  /* o OUT: o curso que segue outra norma */
  await p.locator('.aac-op:has(.cod:text-is("OUT")) input[type=radio]').check(); await p.waitForTimeout(200);
  confere('o OUT não tem alternativas e pede o enquadramento e a norma', await p.locator('.aac-op.alt').count() === 0
    && await p.locator('.aac-op input[type=checkbox]:not([disabled])').count() === 0 && await p.locator('#aac-outro').count() === 1
    && await p.locator('#aac-norma').count() === 1 && (await texto(p, '.aac-op.pri .est')) === 'a definir pelo Colegiado');
  await p.click('#aac-enq-btn'); await p.waitForTimeout(400);
  confere('sem o nome do enquadramento, não guarda', /Informe o nome do enquadramento/.test(await toasts(p)), await toasts(p));
  await p.fill('#aac-outro', 'Atividade complementar de extensão');
  await p.fill('#aac-norma', 'Resolução nº 05/2020, do Colegiado do Curso de Fisioterapia');
  await p.fill('#aac-ncurta', 'Resolução nº 05/2020');
  await p.click('#aac-enq-btn'); await p.waitForTimeout(1300);
  const prepOut = (await rpcs(p, 'aacc_preparar')).pop();
  confere('o OUT vai ao banco com o nome e a norma', prepOut?.p?.principal === 'OUT' && prepOut.p.alternativas.length === 0
    && prepOut.p.outro === 'Atividade complementar de extensão' && prepOut.p.normacurta === 'Resolução nº 05/2020', prepOut);
  const sOut = await baixa(p, () => p.click('button:has-text("Só o soma.tex")'));
  const somaOut = readFileSync(sOut.caminho, 'utf8');
  confere('o soma.tex do OUT troca a norma da equipe', /principal\s+= OUT,/.test(somaOut) && /outro\s+= \{Atividade complementar de extensão\},/.test(somaOut)
    && /\\equipe\{\s*norma\s+= \{Resolução nº 05\/2020, do Colegiado do Curso de Fisioterapia\},\s*normacurta = \{Resolução nº 05\/2020\},/.test(somaOut), somaOut.slice(-400));
  /* de volta à equipe de competição, com a vivência de alternativa */
  await p.locator('.aac-op:has(.cod:text-is("EQC")) input[type=radio]').check(); await p.waitForTimeout(200);
  confere('voltar ao EQC some com os campos do OUT', await p.locator('#aac-outro').count() === 0);
  await p.locator('.aac-op:has(.cod:text-is("VPC")) .esc input[type=checkbox]').check(); await p.waitForTimeout(200);
  /* a extensão como alternativa pede os semestres do SIEX */
  await p.locator('.aac-op:has(.cod:text-is("EXT")) .esc input[type=checkbox]').check(); await p.waitForTimeout(200);
  confere('marcar a extensão mostra os semestres que contam', await p.locator('.aac-op:has(.cod:text-is("EXT")) .aac-chip').count() === 3);
  confere('e a estimativa dela começa em zero', (await texto(p, '.aac-op:has(.cod:text-is("EXT")) .est')) === '0 créditos');
  await p.click('#aac-enq-btn'); await p.waitForTimeout(500);
  confere('sem semestre do SIEX, não guarda', /Marque os semestres com registro no SIEX/.test(await toasts(p)), await toasts(p));
  await p.locator('.aac-op:has(.cod:text-is("EXT")) .aac-chip input').first().check(); await p.waitForTimeout(200);
  confere('um semestre marcado: 3 créditos', (await texto(p, '.aac-op:has(.cod:text-is("EXT")) .est')) === '3 créditos');
  await p.fill('#aac-col', 'Colegiado do Curso de Graduação em Engenharia de Controle e Automação');
  await p.click('#aac-enq-btn'); await p.waitForTimeout(1300);
  const prep = (await rpcs(p, 'aacc_preparar')).pop();
  confere('o enquadramento vai ao banco', prep?.p?.principal === 'EQC' && JSON.stringify(prep.p.alternativas) === '["EXT","VPC"]'
    && JSON.stringify(prep.p.siex) === '["2024/1"]' && /Controle e Automação/.test(prep.p.colegiado), prep);
  confere('o pedido nasce: AAC-9', /AAC-9/.test(await texto(p, '.aac-faixa')) && /Em preparação/.test(await texto(p, '.aac-faixa')));
  confere('o contador passa ao relatório', /^Relatório/.test(await texto(p, '.aac-trilha .arq-etapa[aria-current="step"]'))
    && await p.locator('.aac-trilha .arq-etapa.feita').count() === 2);

  /* o ZIP e o soma.tex */
  const z = await baixa(p, () => p.click('#aac-zip-btn'));
  const zip = await JSZip.loadAsync(readFileSync(z.caminho));
  const soma = await zip.file('soma.tex')?.async('string') || '';
  confere('o ZIP leva o nome do pedido', z.nome === 'AAC-9 relatorio-aacc.zip', z.nome);
  confere('o template continua dentro, com o soma.tex na raiz', !!zip.file('relatorio-aacc.tex') && !!zip.file('nro/equipe.tex') && !!soma);
  confere('o soma.tex leva o PN e o pedido', /pn\s+= 9,/.test(soma) && /soma = AAC-9,/.test(soma), soma.slice(0, 400));
  confere('o estudante, com o ingresso e o colegiado', /ingresso\s+= \{2022\/2\}/.test(soma) && /colegiado\s+= \{Colegiado do Curso de Graduação em Engenharia de Controle e Automação\}/.test(soma));
  confere('os pronomes e o curso da lista', /pronomes\s+= \{ela\},/.test(soma) && /curso\s+= \{Engenharia Elétrica\},/.test(soma));
  confere('sem IC, com o outro vazio e sem trocar a norma', !/\bic\s+=/.test(soma) && /outro\s+= \{\},/.test(soma) && !/\\equipe\{/.test(soma));
  confere('a entrada na equipe em AAAA-MM e o supervisor', /inicio\s+= \{2024-03\}/.test(soma) && /supervisor\s+= \{Bruno Tavares, Pesquisador\}/.test(soma));
  confere('o pedido, com as alternativas e o SIEX', /principal\s+= EQC,/.test(soma) && /alternativas = \{EXT, VPC\}/.test(soma) && /siex\s+= \{2024\/1\}/.test(soma));
  confere('o afastamento do SOMA', soma.includes('\\afastamento{2025-03}{2025-06}{Intercâmbio, aprovado no SOMA (SOL-0001).}'), soma.match(/\\afastamento.*$/m)?.[0]);
  confere('e o treinamento, em horas', soma.includes('\\treinamento{NRO-TRE-003}{Segurança elétrica em bancada}{4,5}{2024-05-10}{CERT-AB12-CD34}'));
  const s = await baixa(p, () => p.click('button:has-text("Só o soma.tex")'));
  confere('só o soma.tex', s.nome === 'soma.tex' && readFileSync(s.caminho, 'utf8') === soma);

  /* o envio */
  await p.setInputFiles('#aac-pdf', join(DIR, 'relatorio-rascunho.pdf')); await p.waitForTimeout(1200);
  confere('o rascunho não passa: modo e pendências', await p.locator('.aac-checks li.bad').count() === 2 && await p.locator('#aac-env-btn[disabled]').count() === 1,
    await texto(p, '.aac-checks'));
  confere('e a tela diz quantas pendências', /Com 4 pendências/.test(await texto(p, '.aac-checks')));
  await p.setInputFiles('#aac-pdf', join(DIR, 'relatorio-final.pdf')); await p.waitForTimeout(1200);
  confere('o final passa em tudo', await p.locator('.aac-checks li.bad').count() === 0 && /Folha reservada ao SOMA na página 2 de 5/.test(await texto(p, '.aac-checks')));
  await p.click('#aac-env-btn'); await p.waitForTimeout(1500);
  const up = await p.evaluate(() => (window.__uploads || []).filter(u => u.bucket === 'aproveitamento').pop());
  const env = (await rpcs(p, 'aacc_enviar')).pop();
  confere('o PDF sobe para a pasta da pessoa, pelo SHA-256', /^4\/00000000-0000-4000-8000-000000000009\/v1-[0-9a-f]{8}\.pdf$/.test(up?.caminho || '') && up?.op?.contentType === 'application/pdf', up);
  confere('e o envio leva o SHA-256, as páginas e as palavras-chave', /^[0-9a-f]{64}$/.test(env?.p?.sha256 || '') && env?.p?.paginas === 5
    && env?.p?.caminho === up?.caminho && /documento=NRO-PES-020-9/.test(env?.p?.keywords || ''), env);
  confere('a tela vai para o pedido, em análise', /#\/servicos\/aproveitamento\/AAC-9$/.test(p.url()) && /Em análise/.test(await texto(p, '.evx-selos')));
  confere('a etapa atual é a do PMO', /aguardando/.test(await texto(p, '.aac-etapas li.atual')) && /PMO/.test(await texto(p, '.aac-etapas li.atual')));
  confere('nenhum ponto médio na tela', !/·/.test(await p.evaluate(() => document.querySelector('#main').innerText)));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= quem aprova ================= */
{
  console.log('\nQuem aprova: a lista e a última etapa');
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/aproveitamento/aprovar' });
  await p.waitForTimeout(800);
  confere('a lista para aprovar traz o AAC-8, que espera a Ana', await p.locator('#main a.evx-card[href="#/servicos/aproveitamento/AAC-8"] .evx-sua').count() === 1);
  confere('a aba conta um', (await texto(p, 'nav.nav1 .n.sua')) === '1');
  await ir(p, '#/servicos/aproveitamento/AAC-8', 1300);
  confere('a página do pedido: as duas etapas aprovadas e a terceira, a Diretoria, aguardando', await p.locator('.aac-etapas li.ok').count() === 2 && /Diretoria/.test(await texto(p, '.aac-etapas li.atual')));
  await p.click('.topo-gestao .acoes button:has-text("Aprovar")'); await p.waitForTimeout(400);
  confere('a última etapa pede o professor orientador', await p.locator('#aac-pn').count() === 1 && /link pessoal, válido por 30 dias/.test(await texto(p, '#modal')));
  confere('os títulos com a abreviatura certa', JSON.stringify(await p.$$eval('#aac-pt option', os => os.map(o => o.value)))
    === JSON.stringify(['Prof. Dr.', 'Prof.ª Dr.ª', 'Prof. Me.', 'Prof.ª Ma.', 'Prof.', 'Prof.ª']));
  await p.selectOption('#aac-pt', 'Prof.ª Dr.ª');
  await p.fill('#aac-pn', 'Joana Exemplo'); await p.fill('#aac-pe', 'joana@gmail.com');
  await p.click('#aac-dbtn'); await p.waitForTimeout(500);
  confere('sem o departamento, não segue', /Informe o departamento/.test(await toasts(p)), await toasts(p));
  await p.fill('#aac-pd', 'Departamento de Engenharia Elétrica'); await p.fill('#aac-pu', 'Escola de Engenharia');
  await p.click('#aac-dbtn'); await p.waitForTimeout(700);
  confere('e-mail de fora da UFMG volta', /@ufmg\.br/.test(await toasts(p)), await toasts(p));
  await p.fill('#aac-pe', 'joana@dee.ufmg.br');
  await p.click('#aac-dbtn'); await p.waitForTimeout(1300);
  const d = (await rpcs(p, 'aacc_decidir')).pop();
  const ass = await p.evaluate(() => (window.__assinados || []).pop());
  confere('a decisão leva o professor e o link assinado do PDF desta versão', d?.p?.professor?.nome === 'Joana Exemplo' && d?.p?.professor?.titulo === 'Prof.ª Dr.ª'
    && d?.p?.professor?.departamento === 'Departamento de Engenharia Elétrica' && d?.p?.professor?.unidade === 'Escola de Engenharia'
    && d?.p?.pdf_url?.includes('/object/sign/aproveitamento/11/00000000-0000-4000-8000-000000000008/v1-abababab.pdf'), d);
  confere('o link vale o prazo do professor e mais uma semana', ass?.exp === 37 * 86400, ass);
  confere('o pedido vai para a professora', /Com o professor/.test(await texto(p, '.evx-selos')) && /Professora orientadora/.test(await texto(p, '.aac-prof h3'))
    && /Joana Exemplo/.test(await texto(p, '.aac-prof')) && /Departamento de Engenharia Elétrica, Escola de Engenharia/.test(await texto(p, '.aac-prof')));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= o PDF final ================= */
{
  console.log('\nO PDF final e a folha');
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/aproveitamento/AAC-5' });
  await p.waitForTimeout(900);
  confere('aprovado: a nota e a folha', /nota 85 de 100/.test(await texto(p, '.evx-minha')) && /FC6V-TZZ5-N9CV/.test(await texto(p, '.evx-minha')));
  confere('o barema do professor na página', await p.locator('.aac-barema tbody tr').count() === 7);
  const f = await baixa(p, () => p.click('.topo-gestao .acoes button:has-text("PDF final")'));
  const fin = await PDFDocument.load(readFileSync(f.caminho));
  if (process.env.AACC_GUARDAR) writeFileSync(process.env.AACC_GUARDAR, readFileSync(f.caminho));
  confere('o nome do PDF final', f.nome === 'NRO-PES-020-5 RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC - Bruno Tavares.pdf', f.nome);
  confere('as páginas são as mesmas cinco', fin.getPageCount() === 5);
  const t2 = pdfTexto(f.caminho, 2), t1 = pdfTexto(f.caminho, 1);
  confere('a página 2 é a folha de aprovação', /Aprovação do relatório de atividades/.test(t2) && /FC6V-TZZ5-N9CV/.test(t2) && !/Folha reservada ao SOMA/.test(t2), t2.slice(0, 300));
  confere('com as três etapas, a nota e a página certa', /Iara Souza/.test(t2) && /Diego Prado/.test(t2) && /Nota final\s+100\s+85\b/.test(t2) && /21,25/.test(t2) && /Página 2 de 5/.test(t2));
  confere('a terceira etapa é a Diretoria', /3\. Diretoria/.test(t2) && !/Coordenação/.test(t2));
  confere('a professora: a abreviatura, o departamento, a unidade e o e-mail inteiro', /Prof\.ª Dr\.ª Joana Exemplo/.test(t2) && /Professora orientadora/.test(t2)
    && /Departamento de Engenharia Elétrica, Escola de\s+Engenharia/.test(t2) && /joana\.exemplo@ufmg\.br/.test(t2), t2.slice(-1600));
  confere('sem a nota de rodapé e sem a frase sobre a folha', !/Registro destinado/.test(t2) && !/ocupa o lugar/.test(t2));
  confere('sem ponto médio na folha', !/·/.test(t2));
  confere('as outras páginas ficam como estavam', /Pagina 1 do relatorio/.test(t1) && /Pagina 3 do relatorio/.test(pdfTexto(f.caminho, 3)));
  confere('na capa, a avaliação da equipe com a data', /Aprovada em 20\/09\/2026/.test(t1), t1);
  const an = fin.getPage(1).node.lookup(PDFName.of('Annots'));
  const uri = an ? fin.context.lookup(an.get(0)).lookup(PDFName.of('A')).lookup(PDFName.of('URI'))?.decodeText?.() : null;
  confere('o link da validação sobre a legenda de autenticação', uri === 'https://auth.neurodynamics.dev/?c=FC6V-TZZ5-N9CV', uri);
  confere('a marca nos metadados', /aprovacao=FC6V-TZZ5-N9CV/.test(fin.getKeywords() || '') && /documento=NRO-PES-020-5/.test(fin.getKeywords() || ''), fin.getKeywords());
  const so = await baixa(p, () => p.click('button:has-text("Só a folha")'));
  confere('só a folha: uma página', so.nome === 'NRO-PES-020-5 FOLHA DE APROVAÇÃO - Bruno Tavares.pdf' && (await PDFDocument.load(readFileSync(so.caminho))).getPageCount() === 1, so.nome);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= o professor ================= */
{
  console.log('\nO professor orientador, pelo link');
  const ctx = await nav.newContext({ viewport:{ width:1280, height:900 } });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await rotas(p);
  await p.goto('http://localhost:8765/aproveitamento/', { waitUntil:'domcontentloaded' }); await p.waitForTimeout(600);
  confere('sem o link, leva ao portal', /\/#\/servicos\/aproveitamento$/.test(p.url()), p.url());
  await p.goto('http://localhost:8765/aproveitamento/?p=' + 'b'.repeat(64)); await p.waitForTimeout(900);
  confere('o link vencido', /Link vencido/.test(await texto(p, 'h1')));
  await p.goto('http://localhost:8765/aproveitamento/?p=xyz'); await p.waitForTimeout(700);
  confere('o link torto', /Link inválido/.test(await texto(p, 'h1')));
  await p.goto('http://localhost:8765/aproveitamento/?p=' + 'a'.repeat(64)); await p.waitForTimeout(1000);
  confere('a página do pedido: o estudante, o selo e o relatório', /Bruno Tavares/.test(await texto(p, '.lead')) && await p.locator('img[src="../selo-solene.png"]').count() === 1
    && /object\/sign\/aproveitamento/.test(await p.getAttribute('a.btn.sec2', 'href')));
  confere('as aprovações da equipe', await p.locator('table.aprov tbody tr').count() === 2);
  confere('o barema, seis critérios', await p.locator('input[data-k]').count() === 6);
  for (const i of await p.locator('input[data-k]').all()) await i.fill('5');
  confere('abaixo de 60, a nota avisa e o botão não abre', /abaixo da mínima de 60/.test(await texto(p, '#nota-c')) && await p.locator('#bt-aprovar[disabled]').count() === 1);
  for (const i of await p.locator('input[data-k]').all()) await i.fill('9');
  confere('a soma: 90, conceito A', (await texto(p, '#nota-n')) === '90' && /conceito A/.test(await texto(p, '#nota-c')));
  confere('sem a declaração, o botão continua fechado', await p.locator('#bt-aprovar[disabled]').count() === 1);
  await p.click('#bt-devolver'); await p.waitForTimeout(300);
  confere('devolver pede o parecer', /Informe no parecer/.test(await texto(p, '#msg')));
  await p.check('#confirmo');
  await p.fill('input[data-k="comunicacao"]', '8,3'); await p.waitForTimeout(100);
  confere('nota fora do meio em meio ponto marca o campo e fecha o botão', await p.locator('input[data-k="comunicacao"].erro').count() === 1
    && await p.locator('#bt-aprovar[disabled]').count() === 1);
  await p.fill('input[data-k="comunicacao"]', '8,5'); await p.waitForTimeout(100);
  confere('a vírgula vale como decimal', (await texto(p, '#nota-n')) === '89,5');
  await p.click('#bt-aprovar'); await p.waitForTimeout(1200);
  const dec = (await rpcs(p, 'aacc_professor_decidir')).pop();
  confere('a decisão leva as notas, a declaração e o link', dec?.p_token === 'a'.repeat(64) && dec?.p?.confirmo === true && dec?.p?.notas?.comunicacao === 8.5
    && dec?.p?.notas?.aderencia === 9, dec);
  confere('aprovado: a folha emitida', /Relatório aprovado/.test(await texto(p, 'h1')) && /FC6V-TZZ5-N9CV/.test(await texto(p, '.aviso.ok')));
  confere('nenhum ponto médio', !/·/.test(await p.evaluate(() => document.body.innerText)));
  confere('nenhum erro de página', erros.length === 0, erros);
  await p.setViewportSize({ width:390, height:844 });
  await p.goto('http://localhost:8765/aproveitamento/?p=' + 'a'.repeat(64)); await p.waitForTimeout(900);
  confere('no celular, sem rolagem de lado', await semRolagem(p));
  await ctx.close();
}

/* ================= a validação ================= */
{
  console.log('\nA validação da folha');
  const ctx = await nav.newContext({ viewport:{ width:1280, height:900 }, acceptDownloads:true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await rotas(p);
  await p.goto('http://localhost:8765/auth/index.html?c=FC6V-TZZ5-N9CV'); await p.waitForTimeout(1800);
  const t = await texto(p, '#res');
  confere('autêntica, com o estudante, a professora e a nota', /Documento autêntico/.test(t) && /BRUNO TAVARES/.test(t) && /Professora orientadora\s*Prof\.ª Dr\.ª Joana Exemplo/.test(t)
    && /Departamento de Engenharia Elétrica, Escola de Engenharia/.test(t) && /joana\.exemplo@ufmg\.br/.test(t) && /85 de 100, conceito B/.test(t), t.slice(0, 600));
  confere('a declaração do professor, do mesmo modelo da folha', /Declaro que BRUNO TAVARES/.test(await texto(p, '#declarado blockquote')));
  confere('as aprovações e o barema', /Aprovações da equipe \(3\)/.test(await texto(p, '#declarado')) && /Barema da professora orientadora/.test(await texto(p, '#declarado'))
    && /Nota final/.test(await texto(p, '#declarado')));
  const d = await baixa(p, () => p.click('#via'));
  confere('baixa a folha, em uma página', /FOLHA DE APROVAÇÃO/.test(d.nome) && (await PDFDocument.load(readFileSync(d.caminho))).getPageCount() === 1, d.nome);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= as configurações e o celular ================= */
{
  console.log('\nAs configurações e o celular');
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/aproveitamento/config' });
  await p.waitForTimeout(900);
  confere('as três etapas, cada uma com o grupo', await p.locator('.aac-etapa-l').count() === 3);
  await p.locator('.aac-etapa-l').nth(2).locator('button').click(); await p.waitForTimeout(200);
  await p.click('#aac-cfg-btn'); await p.waitForTimeout(700);
  const c = (await rpcs(p, 'aacc_config_salvar')).pop();
  confere('salvar leva as duas etapas que ficaram', c?.p?.etapas?.length === 2 && c.p.etapas[0].grupo_id === 3 && c.p.prazo_professor_dias === 30, c);
  await p.setViewportSize({ width:390, height:844 });
  await ir(p, '#/servicos/aproveitamento', 1500);
  confere('o meu pedido no celular, sem rolagem de lado', await semRolagem(p));
  await ir(p, '#/servicos/aproveitamento/AAC-8', 1200);
  confere('a página de um pedido no celular, sem rolagem de lado', await semRolagem(p));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo verde.');
process.exit(falhas ? 1 : 0);
