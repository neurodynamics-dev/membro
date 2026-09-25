/* auth.neurodynamics.dev — a validação pública dos documentos (v25).
   Confere, com asserção (sai com código 1 se algo falhar):
     o código se escreve em grupos de quatro, com O lido como 0; código
     curto não vai ao banco; autêntico, com e sem o código de controle;
     controle que não confere; revogado, com o motivo; código que não
     existe; o QR Code (?c=) abre já consultado; a frase declarada vem do
     mesmo modelo do portal (doc-nro.js, de membro.neurodynamics.dev); o
     CPF mascarado; a segunda via só da declaração de participação, no
     modelo da NRO; nova consulta limpa; o celular sem rolagem
     horizontal; nenhum erro de página.
   A página mora em auth/index.html e é servida daqui, como o portal:
   python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
const QR = readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8');
const DOCNRO = readFileSync(new URL('../doc-nro.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
const pedidos = [];
async function abrir(q = '', vp = { width:1280, height:900 }){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  p.on('request', r => pedidos.push(r.url()));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('https://membro.neurodynamics.dev/doc-nro.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:DOCNRO }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route(/raw\.githubusercontent/, r => r.abort());
  await p.goto('http://localhost:8765/auth/index.html' + q, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(900);
  return { ctx, p, erros };
}
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const ficha = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.ficha tr')].map(tr =>
  [tr.querySelector('th').textContent.trim(), tr.querySelector('td').textContent.replace(/\s+/g, ' ').trim()])));
async function consultar(p, c, k = ''){
  await p.fill('#c', ''); await p.type('#c', c, { delay:5 });
  await p.fill('#k', k);
  await p.click('#b'); await p.waitForTimeout(900);
}

{
  const { ctx, p, erros } = await abrir();
  confere('a página é a da validação, sem resultado ainda', /Validação de documentos/.test(await texto(p, 'h1')) && await p.locator('#res-bloco').isHidden());
  await p.type('#c', 'q8rt5wzn2kdh', { delay:5 });
  confere('o código se escreve em grupos de quatro, em maiúsculas', await p.inputValue('#c') === 'Q8RT-5WZN-2KDH');
  await p.fill('#c', 'Q8RT-5W'); await p.click('#b'); await p.waitForTimeout(300);
  confere('código curto não vai ao banco', (await rpcs(p, 'doc_validar')).length === 0 && /12 caracteres/.test(await texto(p, '#c-erro')));

  await consultar(p, 'Q8RT-5WZN-2KDH', '4f1a9c2e');
  const f = await ficha(p);
  confere('autêntico, com o controle conferido', /Documento autêntico/i.test(await texto(p, '.selo.ok')) && /controle conferido/.test(await texto(p, '.selo')));
  confere('a ficha do que foi impresso', f['Documento'] === 'NRO-DIR-004-4 · Rev. B' && f['Espécie'] === 'Declaração de vínculo'
    && f['Titular'] === 'ANA FIGUEIREDO' && f['Emitente'] === 'NeuroDynamics PD&I — Diretoria', f);
  confere('o CPF mascarado', f['CPF'] === '***.000.000-**', f['CPF']);
  confere('a data da emissão no horário de Brasília', /^\d{2}\/\d{2}\/\d{4}, às \d{2}h\d{2} \(horário de Brasília\)$/.test(f['Emitido em']), f['Emitido em']);
  confere('o controle diz que confere', /^4F1A9C2E\s*✓ confere/.test(f['Código de controle']), f['Código de controle']);
  await p.waitForTimeout(500);
  confere('a frase declarada, do mesmo modelo do portal, com o CPF mascarado',
    /Declaramos, para os devidos fins, que ANA FIGUEIREDO, CPF nº \*\*\*\.000\.000-\*\*, atua como GERENTE DE PROJETO da NeuroDynamics PD&I desde março de 2024\./
      .test(await texto(p, '#declarado blockquote')), await texto(p, '#declarado blockquote'));
  confere('o modelo veio do portal, não de uma cópia', pedidos.some(u => u === 'https://membro.neurodynamics.dev/doc-nro.js'));
  confere('a de vínculo não tem segunda via aqui', await p.locator('#via').count() === 0);
  confere('o endereço guarda o código, e não o controle', new URL(p.url()).search === '?c=Q8RT-5WZN-2KDH', p.url());
  confere('a consulta foi ao banco com o código normalizado', (await rpcs(p, 'doc_validar')).map(x => x.p_codigo).join() === 'Q8RT-5WZN-2KDH');

  await consultar(p, 'Q8RT-5WZN-2KDH', '00000000');
  confere('controle que não confere acusa alteração', /não confere/.test(await texto(p, '.selo.bad')) && /✕ não confere com o informado/.test((await ficha(p))['Código de controle']));

  await consultar(p, 'M4TX-7RPD-9KCE');
  confere('revogado, com a data e o motivo', /Documento revogado/i.test(await texto(p, '.selo.bad')) && /Emitida antes de a ficha ser atualizada/.test(await texto(p, '.selo'))
    && /Revogado/.test((await ficha(p))['Situação']));

  await consultar(p, 'ZZZZ-ZZZZ-ZZZZ');
  confere('código que não existe', /Nenhum documento com este código/i.test(await texto(p, '.selo.bad')) && await p.locator('.ficha').count() === 0);

  confere('O se lê 0, e I e L se leem 1, como no banco', await p.evaluate(() => normaliza('oOiL-abcd-efgh')) === '0011-ABCD-EFGH'
    && await p.evaluate(() => normaliza('UUUU-UUUU-UUUU')) === null);
  await consultar(p, 'K7QD-2M9X-P4TR');
  await p.click('button:has-text("Nova consulta")'); await p.waitForTimeout(200);
  confere('nova consulta limpa a tela e o endereço', await p.locator('#res-bloco').isHidden() && await p.inputValue('#c') === '' && new URL(p.url()).search === '');
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

{
  const { ctx, p, erros } = await abrir('?c=3hvn-8z2c-qw6e');
  await p.waitForTimeout(600);
  confere('o QR Code abre a página já consultada', /Documento autêntico/i.test(await texto(p, '.selo')) && await p.inputValue('#c') === '3HVN-8Z2C-QW6E');
  const f = await ficha(p);
  confere('a de participação: o evento, o período e as horas', /CBEB 2026/.test(f['Evento']) && /EXT-1/.test(f['Evento']) && /^\d{2}\/\d{2}\/\d{4} a \d{2}\/\d{2}\/\d{4}$/.test(f['Período'])
    && f['Horas'] === '16h' && f['Participante'] === 'HELENA PRADO', f);
  confere('a frase de quem foi de fora', /HELENA PRADO participou, junto à equipe da NeuroDynamics PD&I, na condição de coautor\(a\), do evento/.test(await texto(p, '#declarado blockquote')));
  const [d] = await Promise.all([p.waitForEvent('download', { timeout:15000 }), p.click('#via')]);
  const doc = await p.evaluate(() => window.__docnro && window.__docnro.textos.join(' ').replace(/\s+/g, ' '));
  confere('a segunda via, no modelo da NRO, com o mesmo código', d.suggestedFilename() === 'NRO-DIR-006-1 DECLARAÇÃO DE PARTICIPAÇÃO - Helena Prado.pdf'
    && /CÓDIGO VERIFICADOR 3HVN-8Z2C-QW6E/.test(doc) && /auth\.neurodynamics\.dev/.test(doc), d.suggestedFilename());
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

{
  const { ctx, p, erros } = await abrir('?c=Q8RT-5WZN-2KDH', { width:390, height:844 });
  await p.waitForTimeout(600);
  confere('no celular, sem rolagem horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
