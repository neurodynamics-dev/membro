/* 2.23.0: os trabalhos em Projetos (a lista, a ficha, o quadro, os
   documentos, a importação da ficha .docx), a alocação por arrasto, os
   convidados, as habilidades na ficha do membro, Arquivos em pastas e a
   Auditoria com um título só. Sem banco: stub-supabase.js mais o
   complemento stub-trabalhos.js. */
import { chromium } from 'playwright';
import { readFileSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import JSZip from 'jszip';
const STUB = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('./stub-trabalhos.js', import.meta.url), 'utf8');
const JSZIPJS = readFileSync(new URL('./node_modules/jszip/dist/jszip.min.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, { largura = 1440, tema, visao } = {}){
  const ctx = await nav.newContext({ viewport:{ width:largura, height:960 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.addInitScript(([t, v]) => { try { localStorage.setItem('nd.menu', 'aberto'); if (t) localStorage.setItem('nd.tema', t);
    if (v) localStorage.setItem('nd.arq.visao', v); } catch(e){} }, [tema, visao]);
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:STUB }));
  await p.route('**/vendor/jszip-3.10.1.min.js*', r => r.fulfill({ contentType:'application/javascript', body:JSZIPJS }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|pokeapi|brand\.neurodynamics/, r => r.abort());
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const ir = async (p, h) => { await p.evaluate(h => { location.hash = h; }, h); await p.waitForTimeout(500); };
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);
const toastTxt = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));

/* uma ficha de trabalho .docx, com a forma das fichas da equipe: a tabela do
   alto, as seções em parágrafos e listas, e o cenário em quadrantes */
async function fichaDocx(){
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
  const p = (t, li) => `<w:p>${li ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : ''}<w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`;
  const tc = (...ps) => `<w:tc>${ps.join('') || '<w:p/>'}</w:tc>`;
  const tr = (...cs) => `<w:tr>${cs.join('')}</w:tr>`;
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${W}><w:body>
    <w:tbl>${tr(tc(p('Ref.')), tc(p('Projeto Équio (clínica)')))}
      ${tr(tc(p('Num. série')), tc(p('2')), tc(p('PS original')), tc(p('2026/2')))}
      ${tr(tc(p('Data início')), tc(), tc(p('Data fim')), tc(p('30/11/2026')))}
      ${tr(tc(p('Responsável')), tc(p('Bruno Tavares (suporte: Nádia)')), tc(p('Status')), tc(p('A iniciar')))}
      ${tr(tc(p('Alocação')), tc(p('1 trainee Clínica')), tc(p('Complexidade / Esforço')), tc(p('5 / 4')))}</w:tbl>
    ${p('Escopo do trabalho')}${p('Escrever o Projeto de Pesquisa e submeter ao CEP.')}
    ${p('Justificativa')}${p('Sem aprovação do CEP não há testes.', 1)}${p('Forma talentos na área clínica.', 1)}
    ${p('Entregáveis')}${p('Projeto de Pesquisa completo.', 1)}
    ${p('Necessidades e dependências')}${p('Parâmetros técnicos vêm do trabalho 1 (software e firmware).', 1)}
    ${p('Critérios de sucesso')}${p('Projeto submetido sem pendências.', 1)}
    ${p('Cenário')}
    <w:tbl>${tr(tc(p('FORÇAS')), tc(p('FRAQUEZAS')))}${tr(tc(p('Projetos semelhantes aprovados.', 1), p('Apoio da Nádia.', 1)), tc(p('Conhecimento muito específico.', 1)))}
      ${tr(tc(p('OPORTUNIDADES')), tc(p('AMEAÇAS')))}${tr(tc(p('Formação de talentos.', 1)), tc(p('Capacidade insuficiente.', 1)))}</w:tbl>
  </w:body></w:document>`;
  const z = new JSZip();
  z.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  z.file('word/document.xml', xml);
  const dir = mkdtempSync(join(tmpdir(), 'trb-')), f = join(dir, 'ficha-trabalho-2.docx');
  writeFileSync(f, await z.generateAsync({ type:'nodebuffer' }));
  return f;
}

try{
  console.log('Projetos › Trabalhos: a lista');
  {
    const t = await abrir('#/projetos/trabalhos'), { p } = t;
    await p.waitForSelector('.trb-card');
    confere('as seções de Projetos, com Trabalhos aceso', (await p.locator('.cab + .nav1 a').allInnerTexts()).join() === 'Projetos,Trabalhos,Pessoas e trabalhos'
      && (await p.locator('.nav1 a.on').innerText()) === 'Trabalhos');
    const cards = await p.locator('.trb-card').evaluateAll(cs => cs.map(c => [c.querySelector('.trb-num').textContent, c.querySelector('.ref').textContent]));
    confere('um cartão por trabalho aberto, o número em destaque', JSON.stringify(cards) === JSON.stringify([['3', 'Estande NRO'], ['5', 'Projeto Calima (firmware)']]), cards);
    confere('o TRB-5 com a equipe, a convidada e o responsável', await p.locator('.trb-card:has-text("Calima") .pj-rostos .avx').count() === 3
      && /Bruno Tavares/.test(await p.locator('.trb-card:has-text("Calima") .rodape').innerText()));
    await p.fill('#trb-q', 'estande'); await p.waitForTimeout(400);
    confere('a busca filtra', await p.locator('.trb-card').count() === 1);
    confere('o menu lista Trabalhos e Pessoas e trabalhos em Projetos',
      await p.locator('#lt-nav .lt-sec[data-r="projetos"] .lt-filho[data-sub="trabalhos"]').count() === 1
      && await p.locator('#lt-nav .lt-sec[data-r="projetos"] .lt-filho[data-sub="alocacao"]').count() === 1);
    await fechar(t);
  }

  console.log('Um trabalho: a ficha, o quadro e os documentos');
  {
    const t = await abrir('#/projetos/TRB-5'), { p } = t;
    await p.waitForSelector('.trb-sec');
    confere('o título é o número; a referência vem embaixo', (await p.locator('.cab h1').innerText()) === 'Trabalho 5'
      && /Projeto Calima \(firmware\)/.test(await p.locator('.cab-lead').innerText()) && (await p.locator('.cab-cod').innerText()) === 'TRB-5');
    confere('as seções da ficha e o cenário em quadrantes',
      (await p.locator('.trb-sec h3').allInnerTexts()).join('|') === 'Escopo do trabalho|Justificativa|Entregáveis|Necessidades e dependências|Critérios de sucesso|Cenário'
      && await p.locator('.trb-swot .q').count() === 4);
    confere('TRB-3 no texto vira link para o trabalho', await p.locator('.trb-sec a.md-cod[href="#/projetos/TRB-3"]').count() === 1);
    confere('a equipe: o responsável, o trainee e a convidada', /responsável/i.test(await p.locator('.pj-membro:has(.nm:text-is("Bruno Tavares"))').innerText())
      && await p.locator('.pj-membro:has-text("Pedro Lima")').count() === 1 && /Convidado/.test(await p.locator('.pj-membro:has-text("Lucía")').innerText()));
    confere('o projeto aparece na ficha', await p.locator('.cab-meta a[href="#/projetos/NEBULA"]').count() === 1);

    await p.click('.nav1 a:has-text("Quadro")');
    await p.waitForSelector('#kanban .kb-col');
    confere('o quadro é o do grupo T5, com as colunas de Atividades', await p.locator('#kanban .kb-col').count() === 5
      && await p.locator('#kanban .kb-card .cod').allInnerTexts().then(x => x.sort().join()) === 'T5-1,T5-2');
    confere('e leva a Atividades', await p.locator('a[href="#/atividades/T5"]').count() === 1);
    await p.locator('#kanban .kb-col[data-st="a_fazer"] .kb-add').click();
    await p.waitForSelector('#na-tit');
    confere('criar atividade no quadro do trabalho já sabe o grupo', /NRO_TRABALHO_5/.test(await p.locator('#modal').innerText()));
    await p.keyboard.press('Escape'); await p.evaluate(() => fechaModal());

    await p.click('.nav1 a:has-text("Documentos")');
    await p.waitForSelector('.arq-grade .arq-item');
    confere('o arquivo do rol com o ícone do formato, e o link de fora',
      await p.locator('.arq-item[href="#/arquivos/NRO-PRO-003"] .arqv.vidro .ext').innerText() === 'DOCX'
      && await p.locator('.arq-item[href^="https://drive.google.com"]').count() === 1);
    await p.click('button:has-text("Pôr arquivo do rol")');
    await p.waitForSelector('.trd-op');
    await p.fill('#trd-q', 'PES-005'); await p.waitForTimeout(200);
    await p.locator('.trd-op').first().click();
    await p.waitForSelector('.arq-item[href="#/arquivos/NRO-PES-005"]');
    const doc = (await rpcs(p, 'trabalho_documento_salvar')).at(-1)?.p;
    confere('pôr um arquivo chama a função com o arquivo', doc?.arquivo_id === 'a-pes5' && doc?.trabalho_id === 'tb5', doc);
    confere('a planilha ganha o ícone de XLSX', await p.locator('.arq-item[href="#/arquivos/NRO-PES-005"] .ext').innerText() === 'XLSX');
    await p.click('button:has-text("Pôr link")');
    await p.fill('#trl-tit', 'Vídeos'); await p.fill('#trl-url', 'javascript:alert(1)');
    await p.click('#modal button:has-text("Pôr")');
    confere('link que não é http não entra', /https/.test(await toastTxt(p)) && (await rpcs(p, 'trabalho_documento_salvar')).length === 1);
    await p.evaluate(() => fechaModal());
    await p.locator('.arq-item[href="#/arquivos/NRO-PES-005"]').hover();
    await p.locator('.arq-item[href="#/arquivos/NRO-PES-005"] .trb-doc-x').click();
    await p.waitForFunction(() => !document.querySelector('.arq-item[href="#/arquivos/NRO-PES-005"]'));
    confere('e tirar', (await rpcs(p, 'trabalho_documento_tirar')).length === 1);
    await fechar(t);
  }

  console.log('Novo trabalho, da ficha .docx');
  {
    const t = await abrir('#/projetos/trabalhos/novo'), { p } = t;
    await p.waitForSelector('#te-ref');
    confere('o número sugere o próximo', await p.getAttribute('#te-numero', 'placeholder') === '6');
    await p.setInputFiles('.trb-importar input', await fichaDocx());
    await p.waitForFunction(() => document.getElementById('te-ref').value);
    const v = await p.evaluate(() => Object.fromEntries(['numero', 'ref', 'ciclo', 'fim', 'status', 'aloc', 'complexidade', 'esforco', 'justificativa', 'dependencias', 'c-forcas', 'c-ameacas']
      .map(k => [k, document.getElementById('te-' + k).value])));
    confere('a tabela do alto preenche os campos', v.numero === '2' && v.ref === 'Projeto Équio (clínica)' && v.ciclo === '2026/2' && v.fim === '2026-11-30'
      && v.status === 'a_iniciar' && v.aloc === '1 trainee Clínica' && v.complexidade === '5' && v.esforco === '4', v);
    confere('as seções viram listas, e "trabalho 1" vira TRB-1', v.justificativa === '- Sem aprovação do CEP não há testes.\n- Forma talentos na área clínica.'
      && v.dependencias === '- Parâmetros técnicos vêm do trabalho TRB-1 (software e firmware).', v);
    confere('o cenário, um item por linha', v['c-forcas'] === 'Projetos semelhantes aprovados.\nApoio da Nádia.' && v['c-ameacas'] === 'Capacidade insuficiente.', v);
    confere('o responsável e o suporte viram membros', (await p.locator('#te-resp .pill-ed').allInnerTexts()).map(x => x.replace(/[×\s]+$/, '')).join('|')
      === 'Bruno Tavares (principal)|Nádia Rocha');
    await p.click('#te-btn');
    await p.waitForFunction(() => location.hash === '#/projetos/TRB-2');
    const s = (await rpcs(p, 'trabalho_salvar')).at(-1)?.p;
    confere('salvar manda a ficha inteira', s?.numero === 2 && s?.referencia === 'Projeto Équio (clínica)' && JSON.stringify(s?.responsaveis) === '[11,62]'
      && s?.cenario?.fraquezas?.[0] === 'Conhecimento muito específico.' && s?.complexidade === '5', s);
    await p.waitForSelector('.cab h1:has-text("Trabalho 2")');
    confere('e abre o trabalho novo', /Projeto Équio/.test(await p.locator('.cab-lead').innerText()));
    await fechar(t);
  }

  console.log('Pessoas e trabalhos: arrastar os rostos');
  {
    const t = await abrir('#/projetos/alocacao'), { p } = t;
    await p.waitForSelector('.aloc-linha');
    confere('uma linha por trabalho aberto', (await p.locator('.aloc-linha .num').allInnerTexts()).join() === '3,5');
    confere('a galeria começa pelos trainees', (await p.locator('.aloc-pessoa .nm').allInnerTexts()).join() === 'Pedro Lima,Sarah Costa');
    await p.locator('.aloc-pessoa[data-k="m:61"]').hover();
    await p.waitForSelector('#aloc-pop:not([hidden])');
    const pop = await p.locator('#aloc-pop').innerText();
    confere('passar o mouse mostra o que a pessoa sabe e quer desenvolver', /Já sabe[\s\S]*Python[\s\S]*Quer desenvolver[\s\S]*PCB[\s\S]*Arduino/i.test(pop), pop);
    await p.locator('.aloc-pessoa[data-k="m:61"]').dragTo(p.locator('.aloc-linha[data-t="tb3"]'));
    await p.waitForSelector('.aloc-linha[data-t="tb3"] .aloc-rosto');
    const r1 = (await rpcs(p, 'trabalho_pessoas')).at(-1)?.p;
    confere('arrastar a Sarah para o 3 a põe no trabalho', r1?.trabalho_id === 'tb3' && JSON.stringify(r1?.adicionar) === '[61]', r1);
    confere('e o toast oferece desfazer', /Sarah Costa no trabalho 3/.test(await toastTxt(p)) && await p.locator('.toast .toast-acao').count() >= 1);
    confere('o contador da Sarah sobe', (await p.locator('.aloc-pessoa[data-k="m:61"] .foto .n').innerText()) === '1');
    /* sem mouse: escolher o rosto e "Pôr aqui" */
    await p.locator('.aloc-pessoa[data-k="m:60"]').click();
    await p.waitForSelector('.aloc-linha[data-t="tb3"] .aloc-por');
    confere('escolhido o Pedro, só a linha em que ele não está oferece "Pôr aqui"', await p.locator('.aloc-linha[data-t="tb5"] .aloc-por').count() === 0
      && /Pôr Pedro Lima aqui/.test(await p.locator('.aloc-linha[data-t="tb3"] .aloc-por').innerText()));
    await p.locator('.aloc-linha[data-t="tb3"] .aloc-por').click();
    await p.waitForFunction(() => document.querySelectorAll('.aloc-linha[data-t="tb3"] .aloc-rosto').length === 2);
    confere('e o Pedro entra no 3', JSON.stringify((await rpcs(p, 'trabalho_pessoas')).at(-1)?.p?.adicionar) === '[60]');
    await p.locator('.aloc-linha[data-t="tb3"] .aloc-rosto:has-text("Sarah") .x').click();
    await p.waitForFunction(() => document.querySelectorAll('.aloc-linha[data-t="tb3"] .aloc-rosto').length === 1);
    confere('o × tira', JSON.stringify((await rpcs(p, 'trabalho_pessoas')).at(-1)?.p?.remover) === '[61]');

    await p.click('.seg button:has-text("Convidados")');
    confere('os convidados na galeria, com anel tracejado', (await p.locator('.aloc-pessoa.conv .nm').allInnerTexts()).join() === 'Lucía Gómez');
    await p.click('button:has-text("Convidado de fora")');
    await p.waitForSelector('#cv-nome');
    confere('o responsável por um convidado só pode ser membro efetivo', !(await p.locator('#cv-resp option').allInnerTexts()).some(x => /Pedro|Sarah/.test(x))
      && (await p.locator('#cv-resp option').allInnerTexts()).includes('Bruno Tavares'));
    await p.fill('#cv-nome', 'Jean Dupont'); await p.fill('#cv-inst', 'INSA Lyon'); await p.selectOption('#cv-motivo', 'intercambio');
    await p.selectOption('#cv-resp', '11'); await p.fill('#cv-tem', 'Matlab, Simulink');
    await p.click('#cv-btn');
    await p.waitForSelector('.aloc-pessoa.conv:has-text("Jean")');
    const cv = (await rpcs(p, 'convidado_salvar')).at(-1)?.p;
    confere('convidar manda o responsável e as habilidades', cv?.responsavel === 11 && JSON.stringify(cv?.habilidades) === '["Matlab","Simulink"]', cv);

    await p.click('.seg button:has-text("Toda a equipe")');
    await p.click('.seg button:has-text("Por pessoa")');
    await p.waitForSelector('.aloc-tab');
    const pedro = await p.locator('.aloc-tab tr:has(.aloc-quem .nm:text-is("Pedro Lima"))').innerText();
    confere('a outra visão: cada pessoa com os trabalhos', /TRB-5/.test(pedro) && /TRB-3/.test(pedro), pedro);
    confere('e o Bruno com os projetos e a responsabilidade', /TRB-5[\s\S]*Responsável/i.test(await p.locator('.aloc-tab tr:has(.aloc-quem .nm:text-is("Bruno Tavares"))').innerText())
      && /Nebula/.test(await p.locator('.aloc-tab tr:has(.aloc-quem .nm:text-is("Bruno Tavares"))').innerText()));

    await p.click('button:has-text("Minhas habilidades")');
    await p.waitForSelector('#hab-tem');
    confere('o catálogo do processo seletivo aparece para escolher', await p.locator('.hab-cat button:has-text("Arduino")').count() === 2);
    await p.locator('.hab-cat').first().locator('button:has-text("Arduino")').click();
    await p.fill('#hab-quer', 'Gestão de projetos'); await p.keyboard.press('Enter');
    await p.click('#hab-btn');
    await p.waitForFunction(() => (window.__rpcs || []).some(x => x.nome === 'habilidades_salvar'));
    const h = (await rpcs(p, 'habilidades_salvar')).at(-1).p;
    confere('as minhas habilidades', h.registro === 4 && JSON.stringify(h.tem) === '["Arduino"]' && JSON.stringify(h.quer) === '["Gestão de projetos"]', h);
    await fechar(t);
  }

  console.log('A ficha e o organograma');
  {
    const t = await abrir('#/equipe/60'), { p } = t;
    await p.waitForSelector('.nav1 button:has-text("Projetos e trabalhos")');
    await p.click('.nav1 button:has-text("Projetos e trabalhos")');
    await p.waitForSelector('.ficha-trb');
    confere('a ficha mostra os trabalhos da pessoa', /Projeto Calima/.test(await p.locator('.ficha-trb').innerText()));
    confere('e as habilidades', /Firmware[\s\S]*Processamento de sinais/.test(await p.locator('.trb-hab').innerText()));
    await ir(p, '#/equipe');
    await p.waitForSelector('#org-q');
    await p.evaluate(() => focarOrg(11));
    await p.waitForSelector('.org-focus .pt-chips');
    confere('o organograma mostra os projetos e trabalhos da pessoa em foco',
      await p.locator('.org-focus .pt-chips a[href="#/projetos/NEBULA"]').count() === 1 && await p.locator('.org-focus .pt-chips a[href="#/projetos/TRB-5"]').count() === 1);
    await ir(p, '#/projetos/NEBULA');
    await p.waitForSelector('.pj-cols');
    confere('o projeto lista os trabalhos ligados a ele', await p.locator('a.pj-membro[href="#/projetos/TRB-5"]').count() === 1);
    await fechar(t);
  }

  console.log('Arquivos em pastas');
  {
    const t = await abrir('#/arquivos'), { p } = t;
    await p.waitForSelector('#arq-pastas .pasta-it');
    confere('a primeira tela são as pastas dos emissores', (await p.locator('.pasta-it .tt').allInnerTexts()).join() === 'Geral,Pessoal,Pesquisa e Desenvolvimento');
    confere('cada emissor na sua cor: a escolhida ou a da ordem', /--ion-primary/.test(await p.getAttribute('.pasta-it[href="#/arquivos/PES"] .pasta', 'style'))
      && /--retina-primary/.test(await p.getAttribute('.pasta-it[href="#/arquivos/PUB"] .pasta', 'style')));
    confere('a pasta com revisão pendente diz quantas', (await p.locator('.pasta-it[href="#/arquivos/PES"] .pend').innerText()) === '1');
    const cols = await p.evaluate(() => getComputedStyle(document.querySelector('.arq-grade')).gridTemplateColumns.split(' ').length);
    confere('cinco a sete colunas na tela larga', cols >= 5 && cols <= 7, cols);
    await p.click('.pasta-it[href="#/arquivos/PUB"]');
    await p.waitForSelector('.arq-item');
    confere('dentro do emissor: o template avulso é vidro, a série com PN é pasta',
      await p.locator('.arq-item[href="#/arquivos/NRO-PUB-002"] .arqv.vidro').count() === 1 && await p.locator('.pasta-it[href="#/arquivos/PUB/003"]').count() === 1);
    confere('em caixa de frase', (await p.locator('.pasta-it[href="#/arquivos/PUB/003"] .tt').innerText()) === 'Ata de reunião');
    await p.click('.pasta-it[href="#/arquivos/PUB/003"]');
    await p.waitForSelector('.arq-item[href="#/arquivos/NRO-PUB-003-1"]');
    confere('na pasta da série, o template primeiro e os PNs', (await p.locator('.arq-item .cd').allInnerTexts()).join() === 'NRO-PUB-003,NRO-PUB-003-1'
      && await p.locator('.arq-item').first().locator('.arqv.vidro').count() === 1);
    confere('o PDF do registro escrito no portal', (await p.locator('.arq-item[href="#/arquivos/NRO-PUB-003-1"] .ext').innerText()) === 'PDF');
    confere('a trilha volta', (await p.locator('.arq-migalha a').allInnerTexts()).join('|') === 'Arquivos|NRO-PUB Geral');
    await ir(p, '#/arquivos');
    await p.fill('#arq-pq', 'quadro'); await p.waitForTimeout(400);
    confere('a busca fica plana e acha em qualquer pasta', (await p.locator('.arq-item .cd').allInnerTexts()).join() === 'NRO-PES-005');
    await p.click('.arq-barra .seg button:has-text("Lista")');
    await p.waitForSelector('.arq-tab');
    confere('a lista continua a um clique, e a escolha fica', await p.evaluate(() => localStorage.getItem('nd.arq.visao')) === 'lista');
    await ir(p, '#/arquivos/config/emissores');
    await p.waitForSelector('#em-f-PRO');
    await p.selectOption('#em-f-PRO', 'ritmo');
    await p.click('.acc-row:has(#em-f-PRO) button:has-text("Salvar")');
    await p.waitForFunction(() => (window.__escritas || []).some(x => x.tabela === 'doc_emissores'));
    const e = await p.evaluate(() => (window.__escritas || []).filter(x => x.tabela === 'doc_emissores').at(-1).dados);
    confere('a cor do emissor se escolhe nas configurações', e.familia === 'ritmo', e);
    await fechar(t);
  }

  console.log('Auditoria');
  {
    const t = await abrir('#/admin/auditoria'), { p } = t;
    await p.waitForSelector('#tb-aud table');
    confere('um título só', await p.locator('#main h1').count() === 1 && (await p.locator('#main h1').innerText()) === 'Auditoria');
    await fechar(t);
  }

  console.log('Celular e tema claro');
  for (const h of ['#/projetos/alocacao', '#/arquivos', '#/projetos/TRB-5']){
    const t = await abrir(h, { largura:390, tema:'claro' }), { p } = t;
    await p.waitForSelector('.aloc-linha, .pasta-it, .trb-sec');
    const vaza = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    confere(`${h}: nada vaza para o lado no celular`, vaza <= 1, vaza);
    await fechar(t);
  }
}catch(e){ falhas++; console.error('FALHA  exceção:', e.message); }
await nav.close();
console.log(falhas ? `${falhas} de ${checks} verificações falharam.` : `Tudo certo. ${checks} verificações passaram.`);
process.exit(falhas ? 1 : 0);
