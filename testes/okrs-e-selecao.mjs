/* OKRs e Processo Seletivo, trazidos do SOMA · Gestão para o portal.
   Confere, com asserção (sai com código 1 se algo falhar):
     OKRs    — o endereço firma no objetivo em foco; os estratégicos são
               subitens no menu e o desdobramento acende o pai; a cadeia,
               o progresso, o detalhe com comentários, o comentar grava;
               quem é só leitura não cria nem desdobra;
     Seleção — as oito abas têm endereço e acendem no menu; visão geral,
               candidatos (filtro, seleção em lote, ficha por endereço),
               competências (nome com aspas não quebra), avaliação (grava
               a nota), agenda, dinâmica (sub-abas e a janela com código),
               publicações, FAQ, configurações; papel "selecao" entra,
               "leitura" não;
     e nos dois: ícone de botão visível, sem rolagem horizontal, sem erro.
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
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(900);
  return { ctx, p, erros };
}
const ir = async (p, hash, espera = 900) => { await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(espera); };
const hash = p => p.evaluate(() => location.hash);
const atual = p => p.evaluate(() => [...document.querySelectorAll('#lt-nav [aria-current="page"]')]
  .map(a => (a.querySelector('.nm, .lt-rot') || a).textContent.trim()));
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(e => e.tabela === t), tabela);
const limpaEscritas = p => p.evaluate(() => { window.__escritas = []; });
const semRolagemLateral = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const modalAberto = p => p.evaluate(() => document.getElementById('modal').classList.contains('open'));
/* o confirma() da casca abre um modal com "Confirmar"/rótulo: aceita */
const aceitar = async p => { await p.waitForSelector('#modal.open .btn.solid'); await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(500); };

/* ================= OKRs ================= */
console.log('\nOKRs (admin)');
{
  const { ctx, p, erros } = await abrir({ hash:'#/okrs' });
  confere('#/okrs firma o endereço no primeiro objetivo estratégico', await hash(p) === '#/okrs/OE1', await hash(p));
  const oes = await p.evaluate(() => [...document.querySelectorAll('.okr-oe')].map(b => ({
    cd: b.querySelector('.cd').textContent, on: b.classList.contains('on') })));
  confere('a faixa mostra os dois estratégicos, com o OE1 aceso',
    oes.map(o => o.cd).join() === 'OE1,OE2' && oes[0].on && !oes[1].on, oes);
  const menu = await p.evaluate(() => {
    const s = document.querySelector('#lt-nav .lt-sec[data-r="okrs"]');
    return { filhos: [...s.querySelectorAll('.lt-filho .pf')].map(x => x.textContent),
             icone: s.querySelector('.lt-item svg.ic').innerHTML.length };
  });
  confere('no menu, OKRs tem ícone e os estratégicos como subitens', menu.filhos.join() === 'OE1,OE2' && menu.icone > 20, menu);
  confere('e o OE1 está marcado', JSON.stringify(await atual(p)) === '["Consolidar a equipe de pesquisa"]', await atual(p));
  const foco = await p.evaluate(() => ({ cod: document.querySelector('.okr-focus .okr-cod').textContent,
    prog: document.querySelector('.okr-focus .okr-prog .pc')?.textContent }));
  confere('o foco é o OE1, com o progresso das folhas (1 de 2)', foco.cod === 'OE1' && /1\/2.*50%/.test(foco.prog), foco);
  const icones = await p.evaluate(() => [...document.querySelectorAll('main .btn .ic')].map(s => Math.round(s.getBoundingClientRect().width)));
  confere('ícone dentro de botão aparece (tinha largura zero)', icones.length > 0 && icones.every(w => w >= 14), icones);

  await p.click('.org-sec .okr-card:has-text("OT1.2")'); await p.waitForTimeout(800);
  confere('clicar num desdobramento navega para ele', await hash(p) === '#/okrs/OT1.2', await hash(p));
  confere('no menu continua aceso o OE1, de quem ele desdobra',
    JSON.stringify(await atual(p)) === '["Consolidar a equipe de pesquisa"]', await atual(p));
  const cadeia = await p.evaluate(() => ({
    acima: [...document.querySelectorAll('.org-chain > .okr-card:not(.okr-focus) .okr-cod')].map(x => x.textContent),
    foco: document.querySelector('.okr-focus .okr-cod').textContent,
    filhos: [...document.querySelectorAll('.org-sec:first-child .okr-card .okr-cod')].map(x => x.textContent) }));
  confere('a cadeia mostra o OE1 acima, o OT1.2 em foco e o OP1.2.1 abaixo',
    cadeia.acima.join() === 'OE1' && cadeia.foco === 'OT1.2' && cadeia.filhos.join() === 'OP1.2.1', cadeia);
  await p.goBack(); await p.waitForTimeout(800);
  confere('o voltar do navegador volta ao objetivo anterior', await hash(p) === '#/okrs/OE1', await hash(p));

  await p.click('.okr-focus button:has-text("Detalhes")'); await p.waitForTimeout(600);
  const det = await p.evaluate(() => ({
    coms: document.querySelectorAll('#okr-coms .okr-com').length,
    sistema: document.querySelectorAll('#okr-coms .okr-com.sistema').length,
    status: [...document.querySelectorAll('#modal .chips .chip')].map(b => b.textContent) }));
  confere('o detalhe traz os comentários, o automático marcado à parte', det.coms === 2 && det.sistema === 1, det);
  confere('e o admin pode mover o status', det.status.length === 5, det);
  await limpaEscritas(p);
  await p.fill('#okr-novo-com', 'Duas vagas preenchidas.'); await p.click('#okr-com-btn'); await p.waitForTimeout(500);
  const com = await escritas(p, 'okr_comentarios');
  confere('comentar grava em okr_comentarios, com o autor',
    com.length === 1 && com[0].dados.texto === 'Duas vagas preenchidas.' && com[0].dados.autor === 'Ana Figueiredo', com);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await p.click('.topo-gestao .btn.solid'); await p.waitForTimeout(400);
  confere('"Novo objetivo estratégico" sugere o próximo código (OE3)',
    await p.inputValue('#okr-f-codigo') === 'OE3');
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await p.keyboard.press('/'); await p.waitForTimeout(200);
  await p.fill('#pl-q', 'trainees'); await p.waitForTimeout(300);
  const achou = await p.evaluate(() => [...document.querySelectorAll('#pl-res .pl-item')].map(x => x.textContent.replace(/\s+/g,' ').trim()));
  confere('a busca global acha o objetivo pelo título', achou.some(t => /Treinar os trainees/.test(t) && /OT1\.2/.test(t)), achou);
  await p.keyboard.press('Escape');
  confere('sem rolagem horizontal', await semRolagemLateral(p));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
console.log('\nOKRs (leitura)');
{
  const { ctx, p, erros } = await abrir({ hash:'#/okrs/OE2', stub: stubDe('leitura') });
  const t = await p.evaluate(() => ({
    novo: !!document.querySelector('.topo-gestao .btn.solid'),
    desdobrar: !!document.querySelector('.okr-focus button:not([onclick*="Detalhe"])') }));
  confere('quem é só leitura não cria nem desdobra', !t.novo && !t.desdobrar, t);
  await p.click('.okr-focus button:has-text("Detalhes")'); await p.waitForTimeout(500);
  confere('e não move o status de objetivo que não é seu',
    await p.evaluate(() => document.querySelectorAll('#modal .chips .chip').length) === 0);
  await p.keyboard.press('Escape');
  await ir(p, '#/okrs/OE1');
  await p.click('.okr-focus button:has-text("Detalhes")'); await p.waitForTimeout(500);
  confere('mas move o de que é responsável (a Ana responde pelo OE1)',
    await p.evaluate(() => document.querySelectorAll('#modal .chips .chip').length) === 5);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= Seleção ================= */
console.log('\nSeleção (admin)');
{
  const { ctx, p, erros } = await abrir({ hash:'#/selecao' });
  const geral = await p.evaluate(() => ({
    metricas: [...document.querySelectorAll('.ps-metricas .metrica .val')].map(v => v.textContent),
    funil: [...document.querySelectorAll('.barras .barra .n')].map(v => v.textContent),
    pend: [...document.querySelectorAll('.ps-grade .card:nth-child(2) .ps-linha span:first-child')].map(x => x.textContent.trim()) }));
  confere('visão geral: as seis métricas', geral.metricas.join() === '4,1,1,1,1,0', geral.metricas);
  confere('o funil', geral.funil.join() === '4,3,2,1,0,0', geral.funil);
  confere('e as pendências que existem',
    geral.pend.join('|') === '1 inscrições aguardando deferimento|1 aprovados sem entrevista agendada|1 publicações em rascunho', geral.pend);
  const menu = await p.evaluate(() => {
    const s = document.querySelector('#lt-nav .lt-sec[data-r="selecao"]');
    return { aberta: s.classList.contains('aberta'), filhos: [...s.querySelectorAll('.lt-filho .nm')].map(x => x.textContent) };
  });
  confere('no menu, Seleção aberta com as oito abas',
    menu.aberta && menu.filhos.join('|') === 'Visão geral|Candidatos|Avaliação|Agenda|Dinâmica|Publicações|FAQ|Configurações', menu);
  confere('e "Visão geral" marcada', JSON.stringify(await atual(p)) === '["Visão geral"]', await atual(p));

  await p.click('.abas a:has-text("Candidatos")'); await p.waitForTimeout(800);
  confere('a aba é endereço: #/selecao/candidatos, e o menu acompanha',
    await hash(p) === '#/selecao/candidatos' && JSON.stringify(await atual(p)) === '["Candidatos"]', [await hash(p), await atual(p)]);
  confere('a lista traz os quatro candidatos', await p.locator('.tabela tbody tr.click').count() === 4);
  await p.selectOption('.filtros select', 'trainee'); await p.waitForTimeout(300);
  confere('o filtro de status recorta', await p.locator('.tabela tbody tr.click').count() === 1);
  await p.selectOption('.filtros select', ''); await p.waitForTimeout(300);
  await p.fill('#ps-busca', 'paula'); await p.waitForTimeout(450);
  confere('a busca recorta sem tirar o foco do campo',
    await p.locator('.tabela tbody tr.click').count() === 1 && await p.evaluate(() => document.activeElement?.id) === 'ps-busca');
  await p.fill('#ps-busca', ''); await p.waitForTimeout(450);
  const exp = await p.evaluate(() => Math.round(document.querySelector('.filtros .btn .ic').getBoundingClientRect().width));
  confere('"Exportar CSV" mostra o ícone', exp >= 14, exp);

  const caixas = p.locator('.tabela tbody tr.click input[type=checkbox]');
  await caixas.nth(0).check(); await caixas.nth(1).check(); await p.waitForTimeout(200);
  confere('marcar dois candidatos abre a barra de lote',
    /2 selecionados/.test(await p.locator('.sel-bar .qt').textContent().catch(() => '')));
  await limpaEscritas(p);
  await p.selectOption('#ps-mov', 'deferido'); await p.click('.sel-bar .btn.solid');
  await aceitar(p);
  const mov = await escritas(p, 'ps_candidatos');
  confere('aplicar grava o status novo em ps_candidatos', mov.length === 1 && mov[0].dados.status === 'deferido', mov);

  await ir(p, '#/selecao/candidatos/c1');
  const ficha = await p.evaluate(() => ({ aberto: document.getElementById('modal').classList.contains('open'),
    nome: document.querySelector('#modal [style*="font-size:17px"]')?.textContent }));
  confere('#/selecao/candidatos/c1 abre a ficha por cima da lista', ficha.aberto && ficha.nome === 'Joana Ribeiro', ficha);
  await p.click('#modal .abas button.aba:text-is("Ações")'); await p.waitForTimeout(200);
  confere('as abas da ficha trocam de conteúdo',
    await p.evaluate(() => !document.getElementById('pstab-acoes').hidden && document.getElementById('pstab-dados').hidden));
  await p.click('#modal .abas button.aba:text-is("Dados")');
  await p.click('#modal button:has-text("Editar")'); await p.waitForTimeout(300);
  await p.click('#modal .cch:has-text("Python")'); await p.waitForTimeout(150);
  confere('competência com aspas no nome marca sem quebrar o clique',
    await p.evaluate(() => [...document.querySelectorAll('#modal .cch')].find(b => /Python/.test(b.textContent))?.className) === 'cch tem');
  await limpaEscritas(p);
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(500);
  const comp = await escritas(p, 'ps_candidatos');
  confere('salvar grava as competências e volta à ficha',
    comp.length === 1 && comp[0].dados.competencias.includes("Python d'água") && await modalAberto(p), comp);
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await ir(p, '#/selecao/avaliacao');
  const aval = await p.evaluate(() => [...document.querySelectorAll('.aval-cand')].map(a => ({
    nome: a.querySelector('.nm').textContent, nota: a.querySelector('.nota-badge')?.textContent?.trim() })));
  confere('avaliação da dinâmica: os dois candidatos da fase, a média de quem já foi avaliado primeiro',
    aval.length === 2 && /Paula/.test(aval[0].nome) && aval[0].nota === '★ 4.5', aval);
  await p.click('.aval-cand:has-text("Marcos") .btn'); await p.waitForTimeout(300);
  await p.click('#modal .crit-row:nth-of-type(1) .seg button:has-text("4")');
  await p.click('#modal .crit-row:nth-of-type(2) .seg button:has-text("5")');
  await p.click('#ps-rec-aprovar');
  await limpaEscritas(p);
  await p.click('#modal .acts .btn.solid'); await p.waitForTimeout(500);
  const av = await escritas(p, 'ps_avaliacoes');
  confere('salvar grava a nota média (4,5) e a recomendação',
    av.length === 1 && av[0].op === 'upsert' && av[0].dados.nota === 4.5 && av[0].dados.recomendacao === 'aprovar', av);

  await ir(p, '#/selecao/agenda');
  confere('agenda: o horário da dinâmica aparece', await p.locator('.slot-chip').count() === 1);
  await p.click('.slot-chip'); await p.waitForTimeout(300);
  confere('e abre com quem está agendado', /Marcos Lima/.test(await p.locator('#modal').textContent()));
  await p.keyboard.press('Escape'); await p.waitForTimeout(300);

  await ir(p, '#/selecao/dinamica/roteiro');
  const rot = await p.evaluate(() => ({ aviso: document.querySelector('#din-corpo .aviso-box')?.textContent || '',
    sub: [...document.querySelectorAll('#sel-corpo .chips .chip.on')].map(c => c.textContent) }));
  confere('dinâmica › roteiro: soma os blocos contra a janela', /60 min.*75 min/.test(rot.aviso) && rot.sub.join() === 'Roteiro', rot);
  confere('e o menu marca "Dinâmica"', JSON.stringify(await atual(p)) === '["Dinâmica"]', await atual(p));
  await ir(p, '#/selecao/dinamica/janelas');
  await p.click('#din-corpo .pub-row .btn'); await p.waitForTimeout(300);
  confere('a janela mostra o código da sala', await p.locator('.ps-codigo').textContent().catch(() => '') === 'KXQT');
  confere('e a mesa montada pelo quadro', /Bruno Tavares/.test(await p.locator('#din-corpo').textContent()));

  await ir(p, '#/selecao/publicacoes');
  confere('publicações: no ar e rascunho, cada um com o seu selo',
    (await p.locator('.pub-row .badge-pub').allTextContents()).join() === 'No ar,Rascunho');
  await ir(p, '#/selecao/faq');
  confere('FAQ: a pergunta publicada', /Preciso ser aluno/.test(await p.locator('#sel-corpo').textContent()));
  confere('nenhum modal ficou aberto pelo caminho', !(await modalAberto(p)),
    await p.evaluate(() => document.querySelector('#modal h3')?.textContent));
  await ir(p, '#/selecao/config');
  const cfg = await p.evaluate(() => ({ nome: document.getElementById('ps-ed-nome')?.value,
    marcos: document.querySelectorAll('#sel-corpo .tabela tbody tr').length }));
  confere('configurações: a edição e o cronograma', cfg.nome === 'Processo Seletivo 2026' && cfg.marcos === 2, cfg);
  confere('sem rolagem horizontal', await semRolagemLateral(p));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
console.log('\nSeleção por papel e no celular');
{
  const { ctx, p, erros } = await abrir({ hash:'#/selecao/config', stub: stubDe('selecao') });
  confere('o Comitê (papel selecao) entra', await hash(p) === '#/selecao/config' && await p.locator('#ps-ed-nome').count() === 1);
  confere('e não vê a lista de perfis, que é de admin/pessoal',
    /visível apenas para admin\/pessoal/.test(await p.locator('#sel-corpo').textContent()));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ hash:'#/selecao', stub: stubDe('leitura') });
  confere('papel leitura em #/selecao volta para o início', await hash(p) === '#/', await hash(p));
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/selecao/candidatos' });
  confere('celular: candidatos sem rolagem horizontal da página', await semRolagemLateral(p));
  await ir(p, '#/okrs/OE1');
  confere('celular: OKRs sem rolagem horizontal da página', await semRolagemLateral(p));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
