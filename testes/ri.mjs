/* 2.19.2: Relações institucionais (#/ri) e a indicação pelos Serviços (#/servicos/indicar).
   Mapa (pontos, relações desenhadas arrastando, pop-up, filtros), tabela, kanban, ficha,
   formulário, eventos de RI, indicações e o acesso só para NRO_RELAC e NRO_COORD_OFFICE. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){ checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`); if (!ok) falhas++; }
async function abrir(hash, { celular = false, teste = { ri:true } } = {}){
  const ctx = await nav.newContext(celular ? { viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true, deviceScaleFactor:2 } : { viewport:{ width:1280, height:900 } });
  ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|github\.com\/.*\.png|google\.com\/s2/, r => r.abort());
  await p.addInitScript(({ teste }) => { try { localStorage.setItem('nd.menu', 'recolhido'); localStorage.removeItem('ri.pos'); } catch(e){} if (teste) window.__teste = teste; }, { teste });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
const fim = async ({ ctx, p, erros }) => {
  confere('sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  confere('sem erro de página', !erros.length, erros); await ctx.close();
};
const db = p => p.evaluate(() => window.__riDB);
const centro = async (p, sel) => { const b = await p.locator(sel).boundingBox(); return { x:b.x + b.width / 2, y:b.y + b.height / 2 }; };

try {
  console.log('Acesso');
  {
    const t = await abrir('#/ri', { teste:null }), { p } = t;
    await p.waitForTimeout(400);
    confere('quem não é de RI não tem o espaço no menu', await p.locator('#lt-nav .lt-sec[data-r="ri"]').count() === 0);
    confere('e o endereço volta ao início', !(await p.evaluate(() => location.hash)).startsWith('#/ri'));
    await p.evaluate(() => { location.hash = '#/servicos'; }); await p.waitForSelector('a.srv[href="#/servicos/indicar"]');
    confere('em Serviços, qualquer membro vê "Indicar contato ou evento"', await p.locator('a.srv[href="#/servicos/indicar"]').count() === 1);
    await p.click('a.srv[href="#/servicos/indicar"]'); await p.waitForSelector('#ind-form');
    await p.click('#ind-enviar'); await p.waitForSelector('#ind-erro:not([hidden])');
    confere('pede o nome', (await p.locator('#ind-erro').innerText()).includes('nome'));
    await p.fill('#ind-nome', 'Tio Joaquim'); await p.click('#ind-enviar'); await p.waitForTimeout(100);
    confere('pede o porquê', (await p.locator('#ind-erro').innerText()).includes('por que'));
    await p.fill('#ind-pq', 'Investidor-anjo em saúde.'); await p.selectOption('#ind-funcao', 'investidor'); await p.check('#ind-sabe');
    await p.click('#ind-enviar'); await p.waitForSelector('.ind-lista li');
    const ult = (await db(p)).indicacoes[0];
    confere('a indicação vai com os dados', ult.dados.nome === 'Tio Joaquim' && ult.dados.funcao === 'investidor' && ult.dados.sabe === true);
    confere('e aparece em "Minhas indicações"', (await p.locator('.ind-lista').innerText()).includes('Tio Joaquim'));
    await p.click('#ind-tipo [data-v="evento"]'); await p.waitForSelector('#ind-data');
    await p.fill('#ind-nome', 'Demo Day'); await p.fill('#ind-pq', 'Investidores.'); await p.fill('#ind-link', 'javascript:x'); await p.click('#ind-enviar');
    confere('evento: a página precisa ser https', (await p.locator('#ind-erro').innerText()).includes('https'));
    await fim(t);
  }

  console.log('A galeria');
  {
    const t = await abrir('#/ri'), { p } = t;
    await p.waitForSelector('.ri-area');
    confere('a entrada é uma galeria com Conexões, Missões e Financiamento', (await p.locator('.ri-area h2').allInnerTexts()).join() === 'Conexões,Missões,Financiamento');
    confere('com os números de cada área', (await p.locator('#ri-a-conexoes').innerText()).includes('4 contatos ativos') && (await p.locator('#ri-a-financiamento').innerText()).includes('1 edital em aberto'));
    confere('e o atalho para as indicações', await p.locator('.cab-acoes a[href="#/ri/indicacoes"] .ri-n').innerText() === '1');
    await p.click('#ri-a-conexoes'); await p.waitForSelector('.ri-no');
    confere('Conexões abre o mapa', (await p.evaluate(() => location.hash)) === '#/ri/conexoes');
    await p.click('#main a[data-voltar]'); await p.waitForSelector('.ri-area');
    confere('e volta à galeria', (await p.evaluate(() => location.hash)) === '#/ri');
    await fim(t);
  }

  console.log('O mapa');
  {
    const t = await abrir('#/ri/conexoes'), { p } = t;
    await p.waitForSelector('.ri-no');
    confere('o menu tem Relações institucionais', await p.locator('#lt-nav .lt-sec[data-r="ri"]').count() === 1);
    confere('um ponto por contato', await p.locator('.ri-no').count() === 5);
    confere('organização é quadrado, pessoa é círculo', await p.locator('.ri-no[data-id="1"] rect').count() === 1 && await p.locator('.ri-no[data-id="2"] circle').count() === 1);
    const op = await p.evaluate(() => [2, 4].map(i => +document.querySelector(`.ri-no[data-id="${i}"] circle, .ri-no[data-id="${i}"] rect`).style.fillOpacity));
    confere('a opacidade segue a proximidade', op[0] > op[1], op);
    confere('a cor segue a função', (await p.locator('.ri-no[data-id="3"] circle').getAttribute('style')).includes('--lumen-primary'));
    confere('a relação e o vínculo com a organização são linhas', await p.locator('.ri-a').count() === 1 && await p.locator('.ri-a-org').count() === 1);
    confere('o inativo fica esmaecido', await p.locator('.ri-no[data-id="5"].fora').count() === 1);
    // o pop-up
    const c2 = await centro(p, '.ri-no[data-id="2"] circle');
    await p.mouse.click(c2.x, c2.y); await p.waitForSelector('#ri-pop:not([hidden])');
    const pop = await p.locator('#ri-pop').innerText();
    confere('clicar abre o pop-up com o básico', pop.includes('Ana Souza') && pop.includes('Parceiro') && pop.includes('Colaborando'));
    confere('e o caminho para a ficha', await p.locator('#ri-pop a[href="#/ri/2"]').count() === 1);
    await p.click('.ri-pop-x');
    // arrastar um ponto o move e guarda o lugar
    const antes = await p.evaluate(() => JSON.parse(localStorage.getItem('ri.pos'))['3']);
    const c3 = await centro(p, '.ri-no[data-id="3"] circle');
    await p.mouse.move(c3.x, c3.y); await p.mouse.down(); await p.mouse.move(c3.x + 60, c3.y + 40, { steps:6 }); await p.mouse.up();
    const depois = await p.evaluate(() => JSON.parse(localStorage.getItem('ri.pos'))['3']);
    confere('arrastar move o ponto e guarda o lugar', depois.x !== antes.x || depois.y !== antes.y, [antes, depois]);
    // ligar dois pontos
    await p.click('#ri-ligar');
    confere('"Ligar pontos" fica ligado', await p.locator('#ri-ligar[aria-pressed="true"]').count() === 1);
    const a = await centro(p, '.ri-no[data-id="3"] circle'), b = await centro(p, '.ri-no[data-id="4"] rect');
    await p.mouse.move(a.x, a.y); await p.mouse.down(); await p.mouse.move(b.x, b.y, { steps:8 }); await p.mouse.up();
    await p.waitForSelector('#ri-rel-salvar');
    confere('arrastar de um ponto a outro abre a relação', (await p.locator('#modal').innerText()).includes('Bruno Lima') && (await p.locator('#modal').innerText()).includes('Fundação Apoio'));
    await p.click('#modal .ri-sug [data-t="Investimento"]'); await p.fill('#ri-rel-tag', 'Edital 2027'); await p.press('#ri-rel-tag', 'Enter');
    await p.click('#ri-rel-sinal [data-v="negativa"]'); await p.selectOption('#ri-rel-forca', '2');
    await p.click('#ri-rel-salvar'); await p.waitForTimeout(250);
    const rel = (await db(p)).relacoes.find(r => r.a === 3 && r.b === 4);
    confere('a relação é salva com tags, sinal e força', rel && rel.tags.join() === 'Investimento,Edital 2027' && rel.sinal === 'negativa' && rel.forca === 2, rel);
    confere('e aparece no mapa, tracejada', await p.locator('.ri-a.negativa').count() === 1);
    // filtros
    await p.click('#ri-abre-f'); await p.check('[data-ri-fn][value="investidor"]'); await p.waitForTimeout(100);
    confere('filtrar por função esmaece os outros', await p.locator('.ri-no:not(.fora)').count() === 1 && await p.locator('#ri-total b').innerText() === '1');
    await p.click('#ri-limpar'); await p.selectOption('#ri-f-sinal', 'negativa'); await p.waitForTimeout(100);
    confere('filtrar pelo sinal da relação', (await p.locator('.ri-no:not(.fora)').evaluateAll(l => l.map(g => +g.dataset.id).sort())).join() === '3,4');
    await p.click('#ri-limpar'); await p.selectOption('#ri-f-org', '1'); await p.waitForTimeout(100);
    confere('filtrar pela organização (ela e as pessoas dela)', (await p.locator('.ri-no:not(.fora)').evaluateAll(l => l.map(g => +g.dataset.id).sort())).join() === '1,2');
    await p.click('#ri-limpar');
    await p.fill('#ri-q', 'reabilit'); await p.waitForTimeout(100);
    confere('a busca acha por tag', await p.locator('.ri-no:not(.fora)').count() === 1);
    await fim(t);
  }

  console.log('Tabela e kanban');
  {
    const t = await abrir('#/ri/tabela'), { p } = t;
    await p.waitForSelector('.ri-tab');
    confere('a tabela lista os ativos', await p.locator('.ri-tab tbody tr').count() === 4);
    await p.click('.ri-tab [data-ord="proximidade"]'); await p.click('.ri-tab [data-ord="proximidade"]');
    confere('ordena por proximidade (maior primeiro)', (await p.locator('.ri-tab tbody tr:first-child .ri-nome').innerText()).includes('Ana Souza'));
    await p.click('#ri-abre-f'); await p.check('#ri-f-inativos'); await p.waitForTimeout(100);
    confere('"Mostrar inativos" traz o inativo', await p.locator('.ri-tab tbody tr').count() === 5);
    await p.click('.seg a[href="#/ri/kanban"]'); await p.waitForSelector('.ri-kanban');
    confere('o kanban tem uma coluna por estágio', await p.locator('.ri-col').count() === 7);
    confere('cada cartão na coluna do seu estágio', await p.locator('.ri-col[data-estagio="primeiro_contato"] .ri-card[data-id="3"]').count() === 1);
    await p.selectOption('#ri-mv-3', 'interesses_definidos'); await p.waitForTimeout(200);
    confere('mover pelo seletor muda o estágio', (await db(p)).contatos.find(c => c.id === 3).estagio === 'interesses_definidos'
      && await p.locator('.ri-col[data-estagio="interesses_definidos"] .ri-card[data-id="3"]').count() === 1);
    { const dt = await p.evaluateHandle(() => new DataTransfer());   // sem o dragAndDrop, que rola a página para o alvo
      await p.dispatchEvent('.ri-card[data-id="3"]', 'dragstart', { dataTransfer:dt });
      await p.dispatchEvent('.ri-col[data-estagio="conhecendo"]', 'drop', { dataTransfer:dt }); await p.waitForTimeout(200); }
    confere('e arrastando também', (await db(p)).contatos.find(c => c.id === 3).estagio === 'conhecendo');
    await fim(t);
  }

  console.log('A ficha');
  {
    const t = await abrir('#/ri/2'), { p } = t;
    await p.waitForSelector('#ri-editar');
    confere('a ficha mostra nome, histórico e relações', (await p.locator('#main h1').innerText()).includes('Ana Souza')
      && await p.locator('.ri-linha li').count() === 1 && await p.locator('.ri-rels li').count() >= 1);
    confere('os canais têm copiar', await p.locator('.ri-canais [data-copiar="ana@hc.br"]').count() === 1 && await p.locator('.ri-canais a[href="mailto:ana@hc.br"]').count() === 1);
    await p.click('#ri-f-inter'); await p.waitForSelector('#ri-i-salvar');
    await p.fill('#ri-i-resumo', 'Almoço; topou apresentar o diretor.'); await p.fill('#ri-i-passo', 'Marcar com o diretor'); await p.fill('#ri-i-em', '2026-11-01');
    await p.click('#ri-i-salvar'); await p.waitForTimeout(300);
    confere('registrar interação entra no histórico e traz o próximo passo', await p.locator('.ri-linha li').count() === 2 && (await p.locator('.ri-passo').innerText()).includes('Marcar com o diretor'));
    await p.click('#ri-editar'); await p.waitForSelector('#ri-form');
    await p.fill('#ri-cidade', 'Belo Horizonte'); await p.click('#ri-salvar'); await p.waitForSelector('#ri-editar');
    confere('editar salva e volta à ficha', (await p.evaluate(() => location.hash)) === '#/ri/2' && (await db(p)).contatos.find(c => c.id === 2).cidade === 'Belo Horizonte');
    await p.click('#main a[data-voltar]'); await p.waitForSelector('.ri-no');
    confere('o voltar da ficha vai ao mapa, sem passar pelo formulário', (await p.evaluate(() => location.hash)) === '#/ri/conexoes');
    await fim(t);
  }
  {
    const t = await abrir('#/ri/novo'), { p } = t;
    await p.waitForSelector('#ri-form');
    await p.click('#ri-salvar'); await p.waitForSelector('#ri-erro:not([hidden])');
    confere('novo contato pede o nome', (await p.locator('#ri-erro').innerText()).includes('nome'));
    await p.click('#ri-nat [data-v="organizacao"]');
    confere('organização não tem "Organização"', await p.locator('#ri-org-fld[hidden]').count() === 1);
    await p.fill('#ri-nome', 'UFMG'); await p.selectOption('#ri-funcao', 'academia'); await p.fill('#ri-tag', 'Pesquisa'); await p.press('#ri-tag', 'Enter');
    await p.click('#ri-canal-mais'); await p.fill('#ri-canais input', 'https://ufmg.br');
    await p.click('#ri-salvar'); await p.waitForSelector('#ri-editar');
    const novo = (await db(p)).contatos.find(c => c.nome === 'UFMG');
    confere('cria a organização com função, tags e canal', novo && novo.natureza === 'organizacao' && novo.funcao === 'academia' && novo.tags.join() === 'Pesquisa' && novo.canais.length === 1, novo);
    await fim(t);
  }

  {
    const t = await abrir('#/ri/novo'), { p } = t;
    await p.waitForSelector('#ri-eq');
    await p.fill('#ri-eq', 'Bruno Tavares (011)'); await p.waitForTimeout(80);
    confere('buscar um membro preenche nome, cargo, função, proximidade e e-mail', await p.inputValue('#ri-nome') === 'Bruno Tavares' && await p.inputValue('#ri-cargo') === 'Pesquisador'
      && await p.inputValue('#ri-funcao') === 'membro' && await p.inputValue('#ri-prox') === '5' && await p.inputValue('#ri-estagio') === 'parceria'
      && await p.inputValue('#ri-canais input') === 'bruno@neurodynamics.dev' && (await p.inputValue('#ri-origem')).includes('registro 011'));
    await p.fill('#ri-eq', ''); await p.fill('#ri-eq', '23'); await p.waitForTimeout(80);
    confere('pelo registro também; quem saiu vira ex-membro', await p.inputValue('#ri-nome') === 'Diego Prado' && await p.inputValue('#ri-funcao') === 'ex_membro'
      && (await p.locator('#ri-eq-msg').innerText()).includes('saiu da equipe'));
    await p.click('#ri-nat [data-v="organizacao"]');
    confere('organização não tem a busca de membro', await p.locator('#ri-eq-fld[hidden]').count() === 1);
    await p.click('#ri-nat [data-v="pessoa"]'); await p.click('#ri-salvar'); await p.waitForSelector('#ri-editar');
    confere('e o contato é salvo com os dados da ficha', (await db(p)).contatos.some(c => c.nome === 'Diego Prado' && c.funcao === 'ex_membro'));
    await fim(t);
  }
  {
    const t = await abrir('#/ri/2/editar'), { p } = t;
    await p.waitForSelector('#ri-form');
    confere('editar não mostra a busca de membro', await p.locator('#ri-eq').count() === 0);
    await fim(t);
  }

  console.log('Eventos e indicações');
  {
    const t = await abrir('#/ri/missoes'), { p } = t;
    await p.waitForSelector('.ri-ev');
    confere('o evento confirmado aparece em "Próximos"', (await p.locator('#main').innerText()).toLowerCase().includes('próximos') && (await p.locator('.ri-ev').first().innerText()).includes('Feira Hospitalar'));
    await p.click('a[href="#/ri/missoes/novo"]'); await p.waitForSelector('#ri-ev-form');
    await p.fill('#ri-ev-nome', 'Rodada de investimento'); await p.selectOption('#ri-ev-tipo', 'rodada');
    await p.fill('#ri-ev-ini', '2099-05-10'); await p.fill('#ri-ev-fim', '2099-05-01'); await p.click('#ri-ev-salvar');
    confere('evento: o fim não vem antes do início', (await p.locator('#ri-ev-erro').innerText()).includes('fim'));
    await p.fill('#ri-ev-fim', '2099-05-11'); await p.check('[data-obj][value="Captar recursos"]');
    await p.fill('#ri-ev-c', 'Bruno Lima'); await p.dispatchEvent('#ri-ev-c', 'change');
    await p.click('#ri-ev-salvar'); await p.waitForSelector('.ri-ev');
    const ev = (await db(p)).missoes.find(e => e.nome === 'Rodada de investimento');
    confere('cria o evento com objetivo e contato', ev && ev.objetivos.includes('Captar recursos') && ev.contatos.join() === '3', ev);
    await p.evaluate(() => { location.hash = '#/ri/indicacoes'; }); await p.waitForSelector('.ri-ind');
    confere('as indicações abertas aparecem', (await p.locator('.ri-ind').first().innerText()).includes('Tio Carlos'));
    await p.click('.ri-ind [data-acao="recusar"]');
    confere('recusar pede resposta', !(await p.locator('.ri-ind .aviso-box').first().isHidden()));
    await p.click('.ri-ind [data-acao="aceitar"]'); await p.waitForSelector('#ri-form');
    confere('aceitar cria o contato e abre a edição dele', (await p.locator('#ri-nome').inputValue()) === 'Tio Carlos');
    await fim(t);
  }

  console.log('Financiamento');
  {
    const t = await abrir('#/ri/financiamento'), { p } = t;
    await p.waitForSelector('.fin-card');
    const card = await p.locator('.fin-card').first().innerText();
    confere('o edital aparece em "Em aberto" com prazo, valor, quem submete e checklist', (await p.locator('#main').innerText()).toLowerCase().includes('em aberto')
      && card.includes('Centelha MG') && card.includes('Faltam') && card.includes('80.000') && card.includes('FUNDEP') && card.includes('Checklist 1 de 2'));
    await p.click('.fin-card'); await p.waitForSelector('#fin-status');
    confere('o cartão mostra cronograma, checklist, arranjo e descrição', await p.locator('.fin-crono li').count() === 2 && await p.locator('.fin-check li').count() === 2
      && (await p.locator('#main').innerText()).toLowerCase().includes('trl mínimo') && (await p.locator('.fin-corpo').innerText()).includes('Startups'));
    await p.check('[data-marca="checklist"][data-i="0"]'); await p.waitForSelector('.fin-check li:first-child input:checked');
    confere('marcar um item do checklist salva', (await db(p)).editais[0].checklist[0].feito === true);
    await p.selectOption('#fin-status', 'submetido'); await p.waitForTimeout(250);
    confere('mudar a situação salva', (await db(p)).editais[0].status === 'submetido');
    await p.click('#fin-editar'); await p.waitForSelector('#fin-ed-txt');
    const txt = await p.locator('#fin-ed-txt').inputValue();
    confere('"Editar texto" devolve o formato, com o que foi marcado', txt.startsWith('---') && txt.includes('- [x] Carta de anuência') && txt.includes('situacao: submetido') && txt.includes('prazo: 30/11/2099'));
    await p.fill('#fin-ed-txt', txt.replace('- [x] Carta de anuência', '- [x] Carta de anuência\n- [ ] Orçamento'));
    await p.click('#fin-ed-salvar'); await p.waitForTimeout(300);
    confere('e salvar refaz o cartão', (await db(p)).editais[0].checklist.length === 3 && await p.locator('.fin-check li').count() === 3);
    await fim(t);
  }
  {
    const t = await abrir('#/ri/financiamento/importar'), { p } = t;
    await p.waitForSelector('#fin-texto');
    const md = ['---', 'titulo: Programa Startups Saúde', 'financiador: Fundação X', 'chamada: 02/2027', 'link: https://x.org/edital', 'tipo: subvencao',
      'valor_maximo: R$ 150.000,00', 'contrapartida: 10%', 'prazo: 15/03/2099', 'proponente: Fundação de apoio (FUNDEP)', 'responsavel_submissao: FUNDEP',
      'pela_ufmg: sim', 'outro_grupo: não', 'empresa: Bioengenharia S.A.', 'temas: Saúde; Dispositivos', 'cnpj: obrigatório', '---', '', 'Financia dispositivos médicos.', '',
      '## Cronograma', '- 15/03/2099: Submissão', '- 01/02/2099: Anuência da UFMG', '- Resultado (30/06/2099)', '', '## Checklist', '- [ ] Carta de anuência', '- [x] Cadastro',
      '', '## Arranjo', '- TRL mínimo: 4', '', '## Elegibilidade', 'Grupos da UFMG.'].join('\n');
    await p.fill('#fin-texto', md); await p.waitForTimeout(100);
    const prev = await p.locator('#fin-prev').innerText();
    confere('a prévia mostra o cartão e o aviso do campo desconhecido', prev.includes('Programa Startups Saúde') && prev.includes('cnpj') && prev.includes('150.000'));
    await p.click('#fin-criar'); await p.waitForSelector('#fin-status');
    const e = (await db(p)).editais.find(x => x.titulo === 'Programa Startups Saúde');
    confere('cria com os campos lidos (valor, data, proponente, sim/não, empresa)', e && e.valor_maximo === 150000 && e.prazo === '2099-03-15' && e.proponente === 'fundacao'
      && e.pela_ufmg === true && !e.outro_grupo && e.empresa === 'Bioengenharia S.A.' && e.temas.join() === 'Saúde,Dispositivos', e);
    confere('cronograma em ordem de data, checklist, arranjo e o campo extra no arranjo', e.cronograma.map(c => c.etapa).join('|') === 'Anuência da UFMG|Submissão|Resultado'
      && e.checklist.length === 2 && e.checklist[1].feito && e.arranjo.some(a => a.rotulo === 'TRL mínimo') && e.arranjo.some(a => a.rotulo === 'cnpj'));
    confere('o resumo e a descrição', e.resumo === 'Financia dispositivos médicos.' && e.corpo.startsWith('## Elegibilidade'));
    confere('o README para agentes está à mão', await p.evaluate(() => typeof FIN_README === 'string' && FIN_README.includes('## Cronograma')));
    await fim(t);
  }

  console.log('No celular');
  {
    const t = await abrir('#/ri/conexoes', { celular:true }), { p } = t;
    await p.waitForSelector('.ri-no');
    confere('o mapa cabe na tela', await p.locator('#ri-tela').boundingBox().then(b => b.width <= 390));
    await p.evaluate(() => { location.hash = '#/ri/2'; }); await p.waitForSelector('#ri-editar');
    confere('a ficha numa coluna', await p.locator('.objeto-lateral').boundingBox().then(b => b.width <= 390));
    await fim(t);
  }
  if (process.env.RI_CAPTURAS){
    mkdirSync(process.env.RI_CAPTURAS, { recursive:true });
    for (const [n, h, c] of [['galeria', '#/ri', false], ['mapa', '#/ri/conexoes', false], ['financiamento', '#/ri/financiamento', false], ['edital', '#/ri/financiamento/1', false], ['importar', '#/ri/financiamento/importar', false], ['tabela', '#/ri/tabela', false], ['kanban', '#/ri/kanban', false], ['ficha', '#/ri/2', false],
                             ['missoes', '#/ri/missoes', false], ['indicacoes', '#/ri/indicacoes', false], ['indicar', '#/servicos/indicar', false], ['mapa-cel', '#/ri/conexoes', true]]){
      const t = await abrir(h, { celular:c }); await t.p.waitForTimeout(800);
      if (n === 'mapa'){ const c2 = await centro(t.p, '.ri-no[data-id="2"] circle'); await t.p.mouse.click(c2.x, c2.y); await t.p.waitForTimeout(200); }
      await t.p.screenshot({ path:`${process.env.RI_CAPTURAS}/ri-${n}.png`, fullPage:n !== 'mapa' && n !== 'mapa-cel' }); await t.ctx.close();
    }
  }
} finally { await nav.close(); }
console.log(falhas ? `\n${falhas} falha(s) em ${checks} verificações.` : `\nTudo certo. ${checks} verificações passaram.`); process.exitCode = falhas ? 1 : 0;
