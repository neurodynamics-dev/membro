/* Escrever o registro no portal (v26) — e as séries cujos PNs não
   moram no rol (v25), em Arquivos.
   Confere, com asserção (sai com código 1 se algo falhar):
     O template — a série que se escreve no portal diz isso; criar o PN
       leva direto a escrever;
     Escrever a ata — as seções do template, o que já vem preenchido (quem
       redige, hoje, agora), o que falta, mandar sem o obrigatório não
       manda; o rascunho grava sozinho e volta ao abrir de novo; a prévia
       em PDF, no modelo da NRO, com a frase da ata e as linhas numeradas;
       mandar: o PDF sobe, a revisão fica pendente com os dados, o título
       do PN ganha o complemento, e o registro de alterações diz "escrito
       no portal";
     O relatório de teste — a ficha, a tabela do roteiro (linhas, status,
       subir, tirar) e a legenda do status no PDF;
     Registro aprovado — enviado como arquivo, não abre para escrever;
     Configurações › Formulários — as séries com e sem formulário, a
       definição conferida na hora (JSON quebrado, tipo que não existe),
       começar de outro, salvar;
     As declarações — DIR-004 e DIR-006 dizem de onde vêm os PNs, sem
       "Novo PN", e ficam de fora do "Adicionar";
     Quem não edita — não escreve;
     e: o celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubLeitura = stubAdmin.replace("papel:'admin'", "papel:'leitura'");
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
const QR = readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin, dir = false } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|youtube\.com|ytimg/, r => r.abort());
  await p.addInitScript(d => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} if (d) window.__teste = { dir:true }; }, dir);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const pdfTexto = p => p.evaluate(() => window.__docnro && window.__docnro.textos.map(t => t.replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1')).join(' | '));
async function previa(p, ctx){
  await p.evaluate(() => { window.__docnro = null; });
  await Promise.all([ctx.waitForEvent('page', { timeout:8000 }).catch(() => null), p.click('button:has-text("Ver o PDF")')]);
  await p.waitForFunction(() => window.__docnro, null, { timeout:15000 });
  return pdfTexto(p);
}

/* ================= a ata ================= */
{
  console.log('\nA ata de reunião, escrita no portal');
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PUB-003' });
  await p.waitForTimeout(600);
  confere('o template diz que os PNs se escrevem no portal', /se escrevem no portal/.test(await texto(p, '.arq-frm-nota')));
  await p.click('button:has-text("Novo PN")'); await p.waitForTimeout(300);
  await p.fill('#apn-tit', 'rascunho'); await p.click('#apn-btn'); await p.waitForTimeout(2000);
  confere('criar o PN leva direto a escrever', await p.evaluate(() => location.hash) === '#/arquivos/NRO-PUB-003-2/escrever' && /Agora escreva/.test(await toasts(p)));
  const secoes = await p.evaluate(() => [...document.querySelectorAll('.frm-sec h2')].map(h => h.textContent));
  confere('as seções do template', secoes.join('|') === 'A reunião|Quem esteve|Pauta|Discussão|Redação', secoes);
  const hoje = await p.evaluate(() => hojeISO());
  confere('já vem preenchido: quem redige, hoje e agora', await p.inputValue('#frm-f-redacao') === 'Ana Figueiredo'
    && await p.inputValue('#frm-f-data_redacao') === hoje && /^\d{2}:\d{2}$/.test(await p.inputValue('#frm-f-hora_redacao')));
  confere('e diz o que falta', /Faltam 8/.test(await texto(p, '#frm-faltam')) && /Quem se reuniu/.test(await texto(p, '#frm-faltam')));
  await p.click('#frm-enviar'); await p.waitForTimeout(700);
  confere('mandar sem o obrigatório não manda, e marca os campos', (await rpcs(p, 'doc_formulario_enviar')).length === 0
    && /Falta preencher/.test(await toasts(p)) && await p.locator('.frm-fld.erro').count() === 8);

  await p.fill('#frm-f-orgao', 'Gerência');
  await p.fill('#frm-f-assunto', 'Reunião de Gerência de setembro');
  await p.fill('#frm-f-data', '2026-09-24'); await p.fill('#frm-f-hora', '16:00');
  await p.fill('#frm-f-local', 'na Sala de Reuniões do LABBIO, na Escola de Engenharia da UFMG');
  await p.click('[data-campo="presentes"] button:has-text("Eu")'); await p.waitForTimeout(150);
  await p.click('[data-campo="presentes"] button:has-text("Pessoa")'); await p.waitForTimeout(150);
  await p.locator('[data-campo="presentes"] .frm-pessoa').nth(1).locator('input').nth(0).fill('Bruno Tavares');
  await p.locator('[data-campo="presentes"] .frm-pessoa').nth(1).locator('input').nth(1).fill('online');
  await p.click('[data-campo="presentes"] button:has-text("Pessoa")'); await p.waitForTimeout(150);
  await p.click('[data-campo="pauta"] button:has-text("Item")'); await p.waitForTimeout(150);
  await p.locator('[data-campo="pauta"] .frm-item input').nth(0).fill('Definir o horário recorrente');
  await p.locator('[data-campo="pauta"] .frm-item input').nth(0).press('Enter'); await p.waitForTimeout(150);
  confere('Enter na pauta abre o item seguinte, com o foco nele', await p.evaluate(() => document.activeElement === document.querySelectorAll('[data-campo="pauta"] .frm-item input')[1]));
  await p.keyboard.type('Revisar o cronograma do Nebula');
  await p.fill('#frm-f-discussao', 'Ficou decidido que a Gerência se reúne às quintas, às 16h.\n\nO cronograma do Nebula foi revisto: a entrega passa para novembro.');
  await p.fill('#frm-f-redacao + input', 'LLM Gemini');
  confere('a frase da redação mostra como vai sair', /redigida pelo LLM Gemini, aos cuidados de Ana Figueiredo/.test(await texto(p, '#frm-f-redacao-frase')));
  await p.waitForTimeout(1800);
  const sal = await rpcs(p, 'doc_formulario_salvar');
  confere('o rascunho grava sozinho', sal.length >= 1 && sal[sal.length - 1].p_arquivo === 'a-novo-2' && sal[sal.length - 1].p_dados.assunto === 'Reunião de Gerência de setembro', sal.length);
  confere('e diz que gravou', /Rascunho gravado/.test(await texto(p, '#frm-status')));
  confere('o que é obrigatório está preenchido', /Tudo o que é obrigatório/.test(await texto(p, '#frm-faltam')));

  await ir(p, '#/arquivos/NRO-PUB-003-2', 1300);
  confere('a tela do PN oferece continuar escrevendo', await p.locator('a:has-text("Continuar escrevendo")').count() === 1
    && /Rascunho gravado/.test(await texto(p, '.arq-lado')));
  await p.click('a:has-text("Continuar escrevendo")'); await p.waitForTimeout(1500);
  confere('e o rascunho volta como estava', await p.inputValue('#frm-f-assunto') === 'Reunião de Gerência de setembro'
    && await p.locator('[data-campo="pauta"] .frm-item input').count() === 2);

  const t = await previa(p, ctx);
  confere('a prévia no modelo da NRO: quem se reuniu no cabeçalho, o título, o código e a revisão do template',
    /NeuroDynamics Gerência Ata de reunião NRO-PUB-003-2 Rev\. A/.test(t), t.slice(0, 160));
  confere('a frase da ata, com a data e a hora por extenso', /Às 16 horas do dia 24 de setembro de 2026, reuniram-se na Sala de Reuniões do LABBIO/.test(t), t.slice(0, 400));
  confere('os presentes numerados e a pauta com letras, com a pontuação do template',
    /1\. \d* ?Ana Figueiredo; 2\. \d* ?Bruno Tavares \(online\),/.test(t) && /A\. \d* ?Definir o horário recorrente; B\. \d* ?Revisar o cronograma do Nebula\./.test(t), t.slice(0, 700));
  confere('as linhas numeradas, como no template', /reuniram-se.* 2 /.test(t));
  confere('a redação com o apoio de IA', /Esta ata foi redigida pelo LLM Gemini, aos cuidados de Ana Figueiredo/.test(t));
  confere('a pessoa sem nome não entra', !/3\. ?[,;]/.test(t));

  await p.click('#frm-enviar'); await p.waitForTimeout(400);
  confere('o modal diz o que vai acontecer', /fica pendente até alguém de PMO/.test(await texto(p, '#modal')));
  await p.click('#fe-btn'); await p.waitForTimeout(2500);
  const up = await p.evaluate(() => window.__uploads || []);
  confere('o PDF sobe para o bucket, no caminho do arquivo', up.length === 1 && up[0].bucket === 'arquivos' && up[0].op?.contentType === 'application/pdf'
    && /^a-novo-2\/[0-9a-f-]{36}\/NRO-PUB-003-2 ATA DE REUNIAO _ REUNIAO DE GERENCIA DE SETEMBRO\.pdf$/.test(up[0].caminho), up);
  const env = await rpcs(p, 'doc_formulario_enviar');
  confere('a versão vai para revisão com os dados, limpos', env.length === 1 && env[0].arquivo_id === 'a-novo-2' && env[0].caminho === up[0].caminho
    && env[0].dados.presentes.length === 2 && env[0].dados.presentes[0].registro === 4 && env[0].dados.pauta.length === 2
    && JSON.stringify(env[0].relacionados) === '[]', env[0]);
  confere('o PN ganha o complemento do título', JSON.stringify((await rpcs(p, 'doc_arquivo_editar')).pop()) === '{"id":"a-novo-2","titulo":"Reunião de Gerência de setembro"}');
  confere('e volta para a tela do PN, com a versão pendente', await p.evaluate(() => location.hash) === '#/arquivos/NRO-PUB-003-2'
    && await p.locator('.arq-pendente').count() === 1 && /escrito no portal e enviado por Ana Figueiredo/.test(await texto(p, '.arq-log')));
  confere('com a revisão pendente, não se escreve outra', await p.locator('a:has-text("Escrever no portal"), a:has-text("Continuar escrevendo")').count() === 0);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= o relatório de teste ================= */
{
  console.log('\nO relatório de execução de teste');
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PRO-003' });
  await p.waitForTimeout(500);
  await p.click('button:has-text("Novo PN")'); await p.waitForTimeout(300);
  await p.selectOption('#apn-pj', 'pj1'); await p.click('#apn-btn'); await p.waitForTimeout(2000);
  confere('o responsável é quem escreve, e o projeto é o do PN', await p.inputValue('#frm-f-responsavel') === 'Ana Figueiredo'
    && await p.inputValue('#frm-f-projeto') === 'pj1');
  await p.fill('#frm-f-nome', 'Teste de torque do motor');
  await p.fill('#frm-f-data', '2026-09-23');
  await p.selectOption('#frm-f-resultado', 'Aprovado com ressalvas');
  await p.fill('#frm-f-objetivo', 'Verificar se o motor sustenta 2 N·m por 10 minutos.');
  await p.fill('#frm-f-conclusao', 'Sustenta, com aquecimento acima do previsto.');
  for (let i = 0; i < 3; i++){ await p.click('[data-campo="roteiro"] button:has-text("Linha")'); await p.waitForTimeout(120); }
  const cel = (l, c) => p.locator('[data-campo="roteiro"] tbody tr').nth(l).locator('td').nth(c);
  await cel(0, 1).locator('textarea').fill('Ligar a bancada');
  await cel(0, 4).locator('select').selectOption('ok');
  await cel(1, 1).locator('textarea').fill('Aplicar 2 N·m');
  await cel(1, 4).locator('select').selectOption('falhou');
  await cel(2, 1).locator('textarea').fill('linha que sai');
  await p.locator('[data-campo="roteiro"] tbody tr').nth(2).locator('button[title="Tirar"]').click(); await p.waitForTimeout(150);
  await p.locator('[data-campo="roteiro"] tbody tr').nth(1).locator('button[title="Subir"]').click(); await p.waitForTimeout(150);
  const linhas = await p.evaluate(() => [...document.querySelectorAll('[data-campo="roteiro"] tbody tr')].map(r => r.querySelector('textarea').value));
  confere('a tabela do roteiro: pôr, tirar e subir linhas', linhas.join('|') === 'Aplicar 2 N·m|Ligar a bancada', linhas);
  const t = await previa(p, ctx);
  confere('a ficha do alto, com o projeto e o resultado', /NOME DO TESTE Teste de torque do motor/.test(t) && /PROJETO Nebula \(NEBULA\)/.test(t)
    && /RESULTADO Aprovado com ressalvas/.test(t) && /RESPONSÁVEL Ana Figueiredo/.test(t), t.slice(0, 500));
  confere('a data por extenso na ficha, e a hora só se houver', /DATA E HORA 23 de setembro de 2026 LOCAL/.test(t), t.slice(0, 400));
  confere('o roteiro e a legenda do status', /Roteiro/.test(t) && /Aplicar 2 N·m/.test(t) && /Legenda do status:/.test(t), t);
  confere('a nota da classe do documento', /propriedade confidencial da NeuroDynamics PD&I/.test(t));
  await p.fill('[data-campo="roteiro"] tbody tr >> nth=0 >> td >> nth=1 >> textarea', '');
  await p.fill('[data-campo="roteiro"] tbody tr >> nth=1 >> td >> nth=1 >> textarea', '');
  await p.locator('[data-campo="roteiro"] tbody tr').nth(0).locator('select').selectOption('');
  await p.locator('[data-campo="roteiro"] tbody tr').nth(1).locator('select').selectOption('');
  await p.waitForTimeout(200);
  confere('um roteiro de linhas em branco conta como vazio', /Roteiro/.test(await texto(p, '#frm-faltam')));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= aprovado, das configurações e das declarações ================= */
{
  console.log('\nRegistro aprovado, configurações e declarações');
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PUB-003-1', dir:true });
  await p.waitForTimeout(600);
  confere('o registro aprovado não oferece escrever', await p.locator('a:has-text("Escrever no portal")').count() === 0);
  await ir(p, '#/arquivos/NRO-PUB-003-1/escrever', 1300);
  confere('e, pelo endereço, diz que foi enviado como arquivo', /enviado como arquivo, não escrito no portal/.test(await texto(p, '#main')));

  await ir(p, '#/arquivos/config/formularios', 1400);
  const tab = await p.evaluate(() => [...document.querySelectorAll('.frm-cfg-tab tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  confere('as duas com formulário, depois as sem', /^NRO-PUB-003/.test(tab[0]) && /^NRO-PRO-003/.test(tab[1]) && /Sem formulário/.test(tab[2])
    && tab.some(x => /^NRO-PRO-001/.test(x)) && tab.some(x => /^NRO-PRO-004/.test(x)), tab);
  confere('o relatório, feito para a Rev. A, com o template na B', /template na B/.test(tab[1]), tab[1]);
  confere('as declarações ficam de fora, porque os PNs não moram no rol', /Fora daqui.*NRO-DIR-004.*NRO-DIR-006/.test(await texto(p, '#cfg-corpo')));
  await p.click('.frm-cfg-tab tr:has-text("NRO-PRO-001") button:has-text("Criar o formulário")'); await p.waitForTimeout(400);
  confere('criar começa de um esqueleto que já vale', /3 campos, sem problema/.test(await texto(p, '#fc-probs')));
  await p.fill('#fc-json', '{ "titulo": "x", '); await p.dispatchEvent('#fc-json', 'input');
  confere('JSON quebrado é dito na hora', /O JSON não se lê/.test(await texto(p, '#fc-probs')));
  await p.fill('#fc-json', JSON.stringify({ titulo:'Termo', campos:[{ id:'x', rotulo:'X', tipo:'desenho' }, { id:'x', rotulo:'', tipo:'texto' }],
    impressao:[{ tipo:'texto', texto:'{y}' }] })); await p.dispatchEvent('#fc-json', 'input');
  const probs = await texto(p, '#fc-probs');
  confere('o que não vale, campo por campo', /Campo 1: tipo desconhecido \(desenho\)/.test(probs) && /Campo 2: identificador repetido/.test(probs)
    && /Campo 2: falta o rótulo/.test(probs) && /\{y\} não é um campo/.test(probs), probs);
  await p.click('#modal button:has-text("Salvar")'); await p.waitForTimeout(300);
  confere('com problema, não salva', (await rpcs(p, 'doc_formulario_definir')).length === 0);
  await p.click('#modal .frm-modelo button:has-text("NRO-PUB-003")'); await p.waitForTimeout(150);
  confere('começar de outro copia a definição, com a revisão deste template', /11 campos, sem problema/.test(await texto(p, '#fc-probs'))
    && JSON.parse(await p.inputValue('#fc-json')).rev === 'A');
  await p.click('#modal button:has-text("Salvar")'); await p.waitForTimeout(1500);
  const def = await rpcs(p, 'doc_formulario_definir');
  confere('salvar manda a série e a definição', def.length === 1 && def[0].serie_id === 's-pro1' && def[0].formulario.campos.length === 11, def);
  confere('e a série passa para as que têm formulário', /11 campos/.test(await texto(p, '.frm-cfg-tab tr:has-text("NRO-PRO-001")'))
    && await p.locator('.frm-cfg-tab tr:has-text("NRO-PRO-001") button:has-text("Editar")').count() === 1);

  await ir(p, '#/arquivos/NRO-DIR-004', 1300);
  confere('a declaração de vínculo diz de onde vêm os PNs', /não são registrados no rol/.test(await texto(p, '.arq-pn-origem'))
    && await p.locator('.arq-pn-origem a[href="#/servicos/declaracao"]').count() === 1);
  confere('sem "Novo PN" e sem a lista de PNs', await p.locator('button:has-text("Novo PN")').count() === 0 && /não mora no rol/.test(await texto(p, '.arq-oque')));
  await ir(p, '#/arquivos/NRO-DIR-006', 1300);
  confere('a de participação leva aos eventos', await p.locator('.arq-pn-origem a[href="#/servicos/eventos"]').count() === 1);
  confere('o "Adicionar" não oferece criar PN nas duas', await p.evaluate(() => arqTemplatesDe('DIR').length === 0 && arqTemplatesDe('').length > 0));
  confere('o registro de alterações diz a mudança da série', /Mudança na série: os PNs não moram no rol/.test(await (async () => { await ir(p, '#/arquivos/NRO-DIR-004', 1200); return texto(p, '.arq-log'); })()));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= quem não edita ================= */
{
  console.log('\nQuem não edita');
  const { ctx, p, erros } = await abrir({ stub: stubLeitura, hash:'#/arquivos/NRO-PRO-003-1' });
  await p.waitForTimeout(600);
  confere('não vê "Escrever no portal"', await p.locator('a:has-text("Escrever")').count() === 0);
  await ir(p, '#/arquivos/NRO-PUB-003-1/escrever', 1300);
  confere('e, pelo endereço, o banco diz que não', /Quem escreve os PNs desta série/.test(await texto(p, '#main')));
  await ir(p, '#/arquivos/config/formularios', 1000);
  confere('nem entra nas configurações', await p.evaluate(() => location.hash) === '#/arquivos');
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  console.log('\nCelular');
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/arquivos/NRO-PRO-003' });
  await p.waitForTimeout(500);
  await p.click('button:has-text("Novo PN")'); await p.waitForTimeout(300);
  await p.click('#apn-btn'); await p.waitForTimeout(2000);
  await p.click('[data-campo="roteiro"] button:has-text("Linha")'); await p.waitForTimeout(200);
  confere('escrever no celular: sem rolagem horizontal (a tabela rola por dentro)', await semRolagem(p));
  await ir(p, '#/arquivos/config/formularios', 1300);
  confere('as configurações também', await semRolagem(p));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
