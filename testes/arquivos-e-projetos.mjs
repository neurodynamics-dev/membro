/* Controle de arquivos e projetos (v20), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Arquivos — a visão geral conta e mostra o que aguarda você; o rol de
       um emissor é lista de cabeças, com os PNs a um clique, filtro e
       ordenação; a tela de um arquivo tem a barra de status, o template
       de origem, as relações, o registro de alterações em ordem, e à
       direita baixar (com o nome do NRO-PUB-002), aprovar e devolver;
       enviar uma revisão sobe o arquivo e exige o que mudou e a
       conferência dos relacionados — e, se o banco recusa, apaga o que
       subiu; template tem fundo de planta e diz onde é usado; registro
       não oferece revisão; configurações mudam o grupo revisor e o padrão;
       a exportação sai no formato da planilha NRO-PUB-001;
     Projetos — a lista, a logo (a mesma semente, a mesma logo), a página
       com a equipe e o supervisor, o rol pelo padrão com "a criar", criar
       um projeto (código e logo sugeridos) e mexer na equipe;
     e: quem não é gestor não vê configurações nem aprova; celular sem
       rolagem horizontal; nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
/* uma planilha de mentira: o teste confere o formato, não a biblioteca */
const XLSX_FALSO = () => { window.XLSX = {
  utils: { book_new: () => ({ abas:[] }), aoa_to_sheet: a => ({ a }),
           book_append_sheet: (wb, ws, n) => wb.abas.push({ n, a: ws.a, merges: ws['!merges'] }) },
  writeFile: (wb, nome) => { window.__planilha = { nome, abas: wb.abas }; } }; };
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.addInitScript(XLSX_FALSO);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1000);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 900) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const linhas = p => p.evaluate(() => [...document.querySelectorAll('.arq-tab tbody tr')].map(tr => ({
  cod: tr.querySelector('.cod')?.textContent.trim(), rev: tr.querySelector('.arq-rev')?.textContent.replace(/\s+/g, ' ').trim(),
  pn: tr.classList.contains('pn'), previsto: tr.classList.contains('previsto'),
  status: tr.querySelector('.pill')?.textContent.trim() })));
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const atual = p => p.evaluate(() => [...document.querySelectorAll('#lt-nav [aria-current="page"]')]
  .map(a => (a.querySelector('.nm, .lt-rot') || a).textContent.trim()));

/* ================= ARQUIVOS ================= */
console.log('\nArquivos — visão geral e rol');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos' });
  await p.waitForSelector('.metricas');
  const met = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.metrica')]
    .map(m => [m.querySelector('.rot').textContent.trim(), m.querySelector('.val').textContent.trim()])));
  confere('métricas: 10 ativos, 1 em revisão, 2 em rascunho, 1 para você', met['Ativos'] === '10' && met['Em revisão'] === '1'
    && met['Rascunho'] === '2' && met['Para você'] === '1', met);
  confere('"Para você revisar" traz o procedimento, com quem enviou',
    (await p.textContent('.card:has(h3:text-is("Para você revisar"))')).includes('NRO-PES-007')
    && (await p.textContent('.card:has(h3:text-is("Para você revisar"))')).includes('Bruno Tavares'));
  confere('os três emissores aparecem, com o que está em revisão', await p.locator('.arq-emi').count() === 3
    && (await p.textContent('.arq-emi:has-text("NRO-PES")')).includes('1 em revisão'));
  const menu = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="arquivos"] .lt-filho .nm')].map(x => x.textContent.trim()));
  confere('no menu: visão geral, para revisar, cada emissor (sem "Departamento de"), templates, configurações',
    menu.join('|') === 'Visão geral|Para revisar|Geral|Pessoal|Pesquisa e Desenvolvimento|Templates|Configurações', menu);

  await ir(p, '#/arquivos/PES');
  let ls = await linhas(p);
  confere('o rol do Pessoal lista as cabeças, em ordem de código',
    ls.map(l => l.cod).join() === 'NRO-PES-004,NRO-PES-005,NRO-PES-007,NRO-PES-014', ls.map(l => l.cod));
  const pes7 = ls.find(l => l.cod === 'NRO-PES-007');
  confere('o procedimento mostra a Rev. B em vigor e a C em revisão, e segue ativo',
    pes7.rev === 'Rev. BC em revisão' && pes7.status === 'Ativo', pes7);
  confere('e o menu acende o emissor', (await atual(p)).includes('Pessoal'), await atual(p));
  await p.click('th:has-text("Status")'); await p.waitForTimeout(150);
  confere('ordenar por status põe o rascunho primeiro', (await linhas(p))[0].cod === 'NRO-PES-004'
    && await p.getAttribute('th:has-text("Status")', 'aria-sort') === 'ascending');
  await p.check('.arq-filtros input[type=checkbox]'); await p.waitForTimeout(150);
  ls = await linhas(p);
  confere('"só com versão em revisão" deixa só o procedimento', ls.length === 1 && ls[0].cod === 'NRO-PES-007', ls);
  await p.uncheck('.arq-filtros input[type=checkbox]');
  await p.fill('#arq-q', 'offboard'); await p.waitForTimeout(350);
  ls = await linhas(p);
  confere('a busca acha pelo título', ls.length === 1 && ls[0].cod === 'NRO-PES-014', ls);
  await p.fill('#arq-q', ''); await p.waitForTimeout(350);

  await ir(p, '#/arquivos/PUB');
  ls = await linhas(p);
  confere('no rol, a série com PN aparece fechada: só a cabeça', !ls.some(l => l.cod === 'NRO-PUB-003-1'), ls.map(l => l.cod));
  await p.click('button[aria-label="Mostrar os PNs de NRO-PUB-003"]'); await p.waitForTimeout(200);
  ls = await linhas(p);
  const ata = ls.find(l => l.cod === 'NRO-PUB-003-1');
  confere('um clique abre os PNs, debaixo do template, com a revisão do template', ata?.pn && /Rev\. A · tpl/.test(ata.rev), ata);
  await p.click('.arq-tab tr:has-text("NRO-PUB-003-1")'); await p.waitForTimeout(900);
  confere('clicar na linha abre o arquivo', await p.evaluate(() => location.hash) === '#/arquivos/NRO-PUB-003-1');
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nA tela de um arquivo');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PES-007' });
  await p.waitForSelector('.arq-etapas');
  const etapas = await p.evaluate(() => [...document.querySelectorAll('.arq-etapa')].map(e => ({
    t: e.firstChild.textContent.trim(), agora: e.getAttribute('aria-current') === 'step', feita: e.classList.contains('feita'),
    sub: e.querySelector('.sub').textContent.trim() })));
  confere('a barra está em "Em revisão", com a Rev. C com o PMO', etapas[1].agora && etapas[1].sub === 'Rev. C com PMO', etapas);
  confere('e "Ativo" aceso ao mesmo tempo: a Rev. B segue em vigor', etapas[2].feita && etapas[2].sub === 'Rev. B segue em vigor', etapas[2]);
  confere('diz de qual template nasceu, e em qual revisão', /Feito sobre o template NRO-PUB-002 — Rev\. A/.test(await p.textContent('.arq-nasce')));
  const rel = await p.evaluate(() => ({ foco: document.querySelector('.arq-no.foco .cd').textContent,
    outros: [...document.querySelectorAll('.arq-rel a.arq-no .cd')].map(x => x.textContent) }));
  confere('as relações mostram o procedimento no meio e o checklist como filho',
    rel.foco.startsWith('NRO-PES-007') && rel.outros.length === 1 && rel.outros[0].startsWith('NRO-PES-014'), rel);
  const log = await p.evaluate(() => [...document.querySelectorAll('.arq-ev .tx')].map(x => x.textContent.trim()));
  confere('o registro de alterações começa na criação e termina no que está pendente',
    log[0] === 'NRO-PES-007 criado por Ana Figueiredo' && log.at(-1) === 'Rev. C aguarda a revisão de PMO', log);
  confere('e traz o template usado, quem enviou e quem aprovou cada revisão',
    log.includes('Template NRO-PUB-002 Rev. A — redigido por MMARCONDES') && log.includes('Rev. C enviada por Bruno Tavares')
    && log.includes('Rev. B aprovada por Carla Mendonça'), log);
  confere('a conferência de cada envio fica à vista', (await p.textContent('.arq-log')).includes('NRO-PES-014 · sem mudança'));
  confere('o menu acende o emissor do arquivo', (await atual(p)).includes('Pessoal'), await atual(p));

  await p.evaluate(() => { window.__baixados = []; });
  await p.click('.arq-lado button:has-text("Baixar a Rev. B")'); await p.waitForTimeout(300);
  const b = await p.evaluate(() => window.__baixados);
  confere('baixar pede um link assinado da Rev. B, com o nome do padrão NRO-PUB-002',
    b.length === 1 && b[0].caminho === 'a-pes7/u4/desligamento-b.docx'
    && b[0].op.download === 'NRO-PES-007 PROCEDIMENTO DE DESLIGAMENTO REV. B.docx', b);

  await p.click('.arq-pendente button:has-text("Devolver com parecer")'); await p.waitForSelector('#ad-par');
  await p.click('#ad-btn'); await p.waitForTimeout(200);
  confere('devolver sem parecer não chama o banco', (await rpcs(p, 'doc_revisao_decidir')).length === 0
    && /parecer/.test(await toasts(p)));
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('.arq-pendente button:has-text("Aprovar")'); await p.waitForSelector('#ad-par');
  await p.fill('#ad-par', 'Conferido com a política.'); await p.click('#ad-btn'); await p.waitForTimeout(1200);
  const dec = await rpcs(p, 'doc_revisao_decidir');
  confere('aprovar manda a revisão pendente, com o parecer', dec.length === 1 && dec[0].revisao_id === 'r-pes7-c'
    && dec[0].decisao === 'aprovar' && dec[0].parecer === 'Conferido com a política.', dec);
  confere('e a tela volta com a Rev. C em vigor, sem pendência',
    await p.locator('.arq-pendente').count() === 0 && /Rev\. C em vigor/.test(await p.textContent('.arq-etapas')));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nEnviar uma revisão');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PES-014' });
  await p.waitForSelector('.arq-lado');
  await p.click('button:has-text("Submeter nova revisão")'); await p.waitForSelector('#ae-btn');
  confere('o modal diz que a Rev. B fica pendente até o PMO aprovar',
    /A Rev\. B fica pendente até alguém de PMO/.test((await p.textContent('#modal')).replace(/\s+/g, ' ')));
  confere('e lista o pai para conferir', (await p.textContent('#ae-conf')).includes('NRO-PES-007'));
  await p.click('#ae-btn'); await p.waitForTimeout(150);
  confere('sem arquivo, não envia', /Escolha o arquivo/.test(await toasts(p)));
  await p.setInputFiles('#ae-arq', { name:'checklist-B.xlsx', mimeType:'application/vnd.ms-excel', buffer: Buffer.from('planilha') });
  await p.click('#ae-btn'); await p.waitForTimeout(150);
  confere('revisão sem dizer o que mudou, não envia', /Diga o que mudou/.test(await toasts(p)));
  await p.fill('#ae-mud', 'Inclui a devolução do crachá.');
  await p.click('#ae-btn'); await p.waitForTimeout(150);
  confere('sem a conferência do pai, não envia — e o pai fica marcado',
    /Falta dizer o que fez com NRO-PES-007/.test(await toasts(p)) && await p.locator('.arq-conf-l.falta').count() === 1);
  confere('nada subiu até aqui', (await p.evaluate(() => (window.__uploads || []).length)) === 0);
  await p.click('.arq-conf-l button:has-text("Não precisa mudar")');
  await p.click('#ae-btn'); await p.waitForTimeout(1200);
  const up = await p.evaluate(() => window.__uploads || []);
  confere('o arquivo sobe para a pasta do arquivo no bucket "arquivos"',
    up.length === 1 && up[0].bucket === 'arquivos' && /^a-pes14\/[0-9a-f-]{36}\/checklist-B\.xlsx$/.test(up[0].caminho), up);
  const env = await rpcs(p, 'doc_revisao_enviar');
  confere('e vira revisão com o que mudou e a conferência',
    env.length === 1 && env[0].arquivo_id === 'a-pes14' && env[0].caminho === up[0].caminho
    && env[0].mudancas === 'Inclui a devolução do crachá.'
    && JSON.stringify(env[0].relacionados) === JSON.stringify([{ arquivo_id:'a-pes7', decisao:'sem_mudanca' }]), env);
  confere('depois de enviar, a tela mostra a Rev. B aguardando', /Rev\. B aguarda revisão/.test(await p.textContent('.arq-pendente')));

  /* o banco recusa: o que subiu é apagado */
  await ir(p, '#/arquivos/NRO-PES-004');
  await p.evaluate(() => { window.__teste = { envio:'ja_pendente' }; window.__uploads = []; window.__removidos = []; });
  await p.click('button:has-text("Enviar a primeira versão")'); await p.waitForSelector('#ae-btn');
  await p.setInputFiles('#ae-arq', { name:'manual.docx', mimeType:'application/msword', buffer: Buffer.from('x') });
  await p.click('#ae-btn'); await p.waitForTimeout(800);
  const sobra = await p.evaluate(() => ({ up: window.__uploads.map(u => u.caminho), rm: window.__removidos }));
  confere('se o banco recusa o envio, o arquivo que subiu é apagado do Storage',
    sobra.up.length === 1 && sobra.rm.includes(sobra.up[0]), sobra);
  confere('e a pessoa lê por quê', /Já há uma versão aguardando revisão/.test(await toasts(p)));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nTemplate, registro, fila e templates');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PUB-002' });
  await p.waitForSelector('.arq-folha');
  confere('template tem fundo de planta e a faixa que diz o que ele é',
    await p.locator('.arq-folha.tpl').count() === 1 && /Template de documento — molde, não documento/.test(await p.textContent('.arq-fita')));
  const usos = await p.evaluate(() => [...document.querySelectorAll('.arq-sec:has(h3) .arq-tab tbody tr .cod')].map(x => x.textContent));
  confere('e diz onde é usado', usos.join() === 'NRO-PES-007,NRO-PUB-003', usos);
  confere('a tabela de dentro da tela é compacta (sem a coluna de última alteração)',
    await p.locator('.arq-sec .arq-tab th').count() === 4);
  confere('revisão aprovada na planilha, sem arquivo: o gestor pode anexar',
    await p.locator('button:has-text("Anexar o arquivo desta revisão")').count() === 1);

  await ir(p, '#/arquivos/NRO-PRO-003-1');
  confere('registro aprovado não oferece revisão', await p.locator('button:has-text("Submeter nova revisão")').count() === 0
    && /Registro aprovado não se revisa/.test(await p.textContent('.arq-lado')));
  confere('e avisa que o template mudou — sem pedir revisão do registro',
    /Este registro foi feito na A e fica assim/.test(await p.textContent('.arq-nasce')));
  confere('o registro de alterações concorda no masculino', (await p.textContent('.arq-log')).includes('Registro enviado por Bruno Tavares'));

  await ir(p, '#/arquivos/revisoes');
  confere('a fila mostra o que está com você', /Com você · 1/.test(await p.textContent('#main')));
  await ir(p, '#/arquivos/templates');
  const tpls = (await linhas(p)).map(l => l.cod);
  confere('a lista de templates tem os seis', tpls.join() === 'NRO-PES-005,NRO-PRO-001,NRO-PRO-003,NRO-PRO-004,NRO-PUB-002,NRO-PUB-003', tpls);
  confere('e diz quem usa uma revisão velha', /1 numa revisão anterior/.test(await p.textContent('.arq-tab tr:has-text("NRO-PRO-003") .sub')));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nConfigurações e exportação');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/config' });
  await p.waitForSelector('#cfg-corpo table');
  confere('as séries estão todas na tabela', await p.locator('#cfg-corpo tbody tr').count() === 9);
  await p.click('#cfg-corpo tr:has-text("NRO-PES-007") .icon-btn'); await p.waitForSelector('#as-rev');
  await p.selectOption('#as-rev', { label:'NRO_MANAGERS' });
  await p.click('#as-btn'); await p.waitForTimeout(800);
  const ser = await rpcs(p, 'doc_serie_salvar');
  confere('configurar a série grava o grupo revisor', ser.length === 1 && ser[0].id === 's-pes7' && ser[0].grupo_revisor === 6, ser);

  await ir(p, '#/arquivos/config/padrao');
  confere('o padrão de projeto lista as três séries', await p.locator('#cfg-corpo .acc-row:has(select[aria-label="Quantos por projeto"])').count() === 3);
  const opc = await p.evaluate(() => [...document.querySelectorAll('#pd-add option')].map(o => o.value).filter(Boolean));
  confere('e oferece só série com PN que ainda não está nele', opc.sort().join() === 's-pes5,s-pub3', opc);
  await p.evaluate(() => { window.__escritas = []; });
  await p.selectOption('#pd-add', 's-pub3'); await p.click('button:has-text("Pôr")'); await p.waitForTimeout(600);
  const esc = await p.evaluate(() => window.__escritas.filter(e => e.tabela === 'doc_padrao_projeto'));
  confere('pôr no padrão grava direto na tabela (a RLS é que confere o gestor)',
    esc.length === 1 && esc[0].op === 'insert' && esc[0].dados.serie_id === 's-pub3', esc);

  await ir(p, '#/arquivos');
  await p.click('button:has-text("Exportar planilha")'); await p.waitForTimeout(900);
  const pl = await p.evaluate(() => window.__planilha);
  confere('a exportação sai no nome e nas abas da NRO-PUB-001',
    /^NRO-PUB-001 CONTROLE DE DOCUMENTOS E REGISTROS/.test(pl?.nome) && pl.abas.map(a => a.n).join() === 'NRO-PUB,NRO-PES,NRO-PRO', pl && { nome: pl.nome, abas: pl.abas.map(a => a.n) });
  const pes = pl.abas.find(a => a.n === 'NRO-PES');
  confere('com o mesmo cabeçalho de duas linhas', pes.a[0].slice(0, 7).join('|') === 'CÓDIGO|NOME DO ARQUIVO|STATUS|TIPO|SUBTIPO|CLASSE|REDIGIDO POR'
    && pes.a[1][6] === 'AUTOR' && pes.a[0][12] === 'Rev. B', pes.a[0].slice(0, 13));
  const l7 = pes.a.find(r => r[0] === 'NRO-PES-007');
  confere('e cada revisão na coluna dela, com responsável, data e change log',
    l7[2] === 'EM VIGÊNCIA' && l7[4] === 'PROCEDIMENTO' && l7[12] === 'Ana Figueiredo' && l7[13] === '12/06/2026'
    && l7[14] === 'Inclui a devolução de crachá.', l7.slice(0, 15));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nQuem não é gestor');
{
  const { ctx, p, erros } = await abrir({ hash:'#/arquivos/NRO-PES-007', stub: stubDe('leitura') });
  await p.waitForSelector('.arq-lado');
  const menu = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="arquivos"] .lt-filho .nm')].map(x => x.textContent.trim()));
  confere('o menu não oferece Configurações', !menu.includes('Configurações'), menu);
  confere('a versão pendente aparece, mas sem aprovar nem baixar',
    await p.locator('.arq-pendente').count() === 1 && await p.locator('.arq-pendente button:has-text("Aprovar")').count() === 0
    && await p.locator('.arq-pendente button:has-text("Baixar para revisar")').count() === 0);
  await ir(p, '#/arquivos/NRO-PRO-003-1');
  confere('arquivo controlado: os metadados aparecem, o histórico não',
    await p.locator('.arq-meta').count() === 1 && await p.locator('.arq-log').count() === 0
    && /classe controlado/.test(await p.textContent('.arq-main')));
  await ir(p, '#/arquivos/config');
  confere('#/arquivos/config devolve para a visão geral', await p.evaluate(() => location.hash) === '#/arquivos');
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= PROJETOS ================= */
console.log('\nProjetos');
{
  const { ctx, p, erros } = await abrir({ hash:'#/projetos' });
  await p.waitForSelector('.topo-gestao');
  confere('"Meus" começa vazio para quem não está em equipe nenhuma, e aponta para todos',
    /Você não está na equipe de nenhum projeto/.test(await p.textContent('.vazio')));
  await p.click('.vazio button:has-text("Ver todos")'); await p.waitForTimeout(300);
  confere('em "Todos", o NEBULA, com a logo gerada e o progresso do padrão',
    await p.locator('.pj-card').count() === 1 && await p.locator('.pj-card svg.logo-pj').count() === 1
    && /1 de 3/.test(await p.textContent('.pj-card .pj-prog')));
  const logos = await p.evaluate(() => {
    const limpa = s => s.replace(/lgp\d+/g, 'X');
    return { igual: limpa(logoProjeto('nebula', 40)) === limpa(logoProjeto('nebula', 40)),
             difere: limpa(logoProjeto('nebula', 40)) !== limpa(logoProjeto('orion', 40)) };
  });
  confere('a logo: a mesma semente dá a mesma logo; outra semente, outra', logos.igual && logos.difere, logos);

  await ir(p, '#/projetos/NEBULA');
  confere('a página do projeto: nome, código, supervisor marcado na equipe',
    (await p.textContent('.pj-topo h1')).trim() === 'Nebula' && /Projeto · NEBULA/.test(await p.textContent('.pj-topo'))
    && /Bruno Tavares/.test(await p.textContent('.pj-membro:has(.pj-sup)')));
  confere('diz que a equipe é o grupo NRO_PROJECT_NEBULA, dentro de NRO_PROJECTS',
    /NRO_PROJECT_NEBULA.*NRO_PROJECTS/.test((await p.textContent('#pj-corpo')).replace(/\s+/g, ' ')));
  confere('e leva ao quadro de atividades do projeto', await p.getAttribute('.pj-topo a:has-text("Quadro")', 'href') === '#/atividades/NEB');

  await ir(p, '#/projetos/NEBULA/arquivos', 1300);
  const rol = await linhas(p);
  confere('o rol segue o padrão: o termo (rascunho), o USRS a criar, o relatório e mais um a criar',
    rol.map(l => (l.previsto ? '·' : '') + (l.cod || '')).join() === 'NRO-PRO-001-1,·NRO-PRO-004-·,NRO-PRO-003-1,·NRO-PRO-003-·', rol);
  await p.click('.arq-tab tr.previsto:has-text("USRS") button:has-text("Criar")'); await p.waitForTimeout(1100);
  const cri = await rpcs(p, 'doc_arquivo_criar');
  confere('"Criar" cria o PN para o projeto e abre o arquivo novo',
    cri.length === 1 && cri[0].serie_id === 's-pro4' && cri[0].projeto_id === 'pj1'
    && await p.evaluate(() => location.hash) === '#/arquivos/NRO-PRO-004-1', cri);

  /* a equipe: a administração põe a Ana, e o menu passa a listar o projeto */
  await ir(p, '#/projetos/NEBULA');
  await p.click('button:has-text("Gerenciar")'); await p.waitForSelector('#pq-busca');
  await p.check('.gr-cand:has-text("Ana Figueiredo") input');
  await p.click('#pq-btn'); await p.waitForTimeout(900);
  const eq = await p.evaluate(() => (window.__membrosSalvos || []));
  confere('pôr na equipe é pôr no grupo do projeto', eq.length === 1 && eq[0].grupo_id === 8 && eq[0].adicionar[0] === 4, eq);
  const menuPj = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="projetos"] .lt-filho .nm')].map(x => x.textContent.trim()));
  confere('e o projeto aparece no menu de quem entrou', menuPj.includes('Nebula'), menuPj);
  await p.keyboard.press('Escape');

  /* projeto novo */
  await ir(p, '#/projetos/novo');
  await p.waitForSelector('#pn-nome');
  await p.fill('#pn-nome', 'Órion II');
  confere('o código sai do nome, sem acento nem espaço', await p.inputValue('#pn-cod') === 'ORIONII');
  const antes = await p.innerHTML('#pn-logo');
  await p.click('#modal button:has-text("Outra")'); await p.waitForTimeout(100);
  confere('"Outra" sorteia outra logo', (await p.innerHTML('#pn-logo')).replace(/lgp\d+/g, '') !== antes.replace(/lgp\d+/g, ''));
  await p.selectOption('#pn-sup', '17');
  await p.check('#pn-lista .gr-cand:has-text("Ana Figueiredo") input');
  await p.click('#pn-btn'); await p.waitForTimeout(1500);
  const pj = await rpcs(p, 'projeto_salvar');
  confere('criar manda código, supervisor, equipe e a semente sorteada',
    pj.length === 1 && pj[0].codigo === 'ORIONII' && pj[0].supervisor === 17 && pj[0].equipe.includes(4) && !!pj[0].logo_semente, pj);
  confere('e abre o projeto novo, com a supervisora na equipe',
    await p.evaluate(() => location.hash) === '#/projetos/ORIONII' && /Carla Mendonça/.test(await p.textContent('.pj-membro:has(.pj-sup)')));
  const menuPj2 = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="projetos"] .lt-filho .nm')].map(x => x.textContent.trim()));
  confere('o menu ganha o projeto novo', menuPj2.includes('Órion II'), menuPj2);

  await p.click('.pj-topo button:has-text("Editar")'); await p.waitForSelector('#pe-st');
  await p.selectOption('#pe-st', 'pausado'); await p.click('#pe-btn'); await p.waitForTimeout(900);
  const ed = (await rpcs(p, 'projeto_salvar')).at(-1);
  confere('editar manda o status', ed.status === 'pausado' && ed.id === 'pj-ORIONII', ed);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

console.log('\nCelular');
{
  for (const h of ['#/arquivos/PES', '#/arquivos/NRO-PES-007', '#/projetos/NEBULA', '#/projetos/NEBULA/arquivos']){
    const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:h });
    await p.waitForTimeout(500);
    confere(`${h}: sem rolagem horizontal da página`, await semRolagem(p));
    confere(`${h}: nenhum erro de página`, erros.length === 0, erros);
    await ctx.close();
  }
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
