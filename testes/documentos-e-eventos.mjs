/* A declaração de vínculo e os eventos (v25), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Serviços — o bloco "Documentos e acessos", antes dos pedidos; o
       início avisa o evento que espera a aprovação;
     Declaração — a prévia com a ficha (CPF mascarado, cargo, desde
       quando), o que falta na ficha de outra pessoa, emitir: o PDF no
       modelo da NRO, com a frase, as duas folhas e a legenda de
       autenticação; a segunda via igual; revogar pede o motivo; o
       Depto. de Pessoal emite para qualquer um, e quem saiu "atuou";
     Eventos — meus, para aprovar e todos; a página do aprovado (a minha
       declaração, os e-mails dos externos, mandar de novo); aprovar o
       que falta e as declarações saem; registrar um com membro e externo
       (e-mail que não é e-mail volta com a linha), o evento no futuro
       não vai para aprovação; editar; reabrir revoga; cancelar;
       configurações de quem aprova e do que as declarações repetem;
     Permissão — quem só lê não vê o rascunho dos outros, nem as
       configurações, nem aprova;
     e: a busca, o celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubLeitura = stubAdmin.replace("papel:'admin'", "papel:'leitura'");
/* e o EXT-1 registrado pelo Bruno: a Ana só participou */
const stubLeituraParticipante = stubLeitura.replace(
  "criado_por:4, criado_nome:'Ana Figueiredo', criado_em:dvDia(-17), enviado_por:4",
  "criado_por:11, criado_nome:'Bruno Tavares', criado_em:dvDia(-17), enviado_por:11");
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
const QR = readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8');
/* o nome do PDF tem acento: sem um locale UTF-8, o Chromium troca por "download" */
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|youtube\.com|ytimg/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
/* pelo locator do Playwright: aceita :has-text() */
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const pdf = p => p.evaluate(() => window.__docnro && { nome: window.__docnro.nome, paginas: window.__docnro.paginas,
  textos: window.__docnro.textos.map(t => t.replace(/\s+/g, ' ').replace(/ ([,.;:])/g, '$1')) });
async function baixa(p, acao){
  const [d] = await Promise.all([p.waitForEvent('download', { timeout:15000 }), acao()]);
  return d.suggestedFilename();
}
const dia = d => { const x = new Date(); x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/* ================= Serviços e a declaração ================= */
{
  console.log('\nServiços e a declaração de vínculo');
  const { ctx, p, erros } = await abrir();
  confere('o início avisa o evento que espera a aprovação',
    /Um evento espera a sua aprovação/.test(await texto(p, '#sec-pend')) && await p.locator('#sec-pend a.pend-i[href="#/servicos/eventos/aprovar"]').count() === 1);

  await ir(p, '#/servicos');
  const blocos = await p.evaluate(() => [...document.querySelectorAll('#main h2.srv-bloco')].map(h => h.textContent));
  confere('Serviços: o que o SOMA faz sozinho vem antes dos pedidos', blocos.join('|') === 'Documentos e acessos|Pedidos ao Depto. de Pessoal', blocos);
  const tiles = await p.evaluate(() => [...document.querySelectorAll('#main a.srv.agora')].map(a => a.getAttribute('href')));
  confere('os três: declaração, registrar evento e cofre',
    tiles.join('|') === '#/servicos/declaracao|#/servicos/eventos/novo|#/servicos/cofre', tiles);

  await ir(p, '#/servicos/declaracao', 1400);
  const previa = await texto(p, '.dcl-folha p');
  confere('a prévia diz o que a declaração vai dizer, com o CPF mascarado na tela',
    /que ANA FIGUEIREDO, CPF nº •••\.000\.000-••, atua como GERENTE DE PROJETO da NeuroDynamics PD&I desde março de 2024\./.test(previa), previa);
  confere('e a segunda folha: um treinamento e um evento', /1 treinamento · 1 evento/.test(await texto(p, '.dcl-dados')));
  confere('a ficha completa não tem aviso de falta', await p.locator('.dcl-previa .aviso-box').count() === 0);
  const tabs = await p.evaluate(() => [...document.querySelectorAll('.dcl-tab')].map(t => [...t.querySelectorAll('tbody tr')].map(r => r.textContent.replace(/\s+/g, ' '))));
  confere('as emitidas: a válida e a revogada', tabs[0]?.length === 2 && tabs[0].some(r => /Q8RT-5WZN-2KDH.*Válida/.test(r))
    && tabs[0].some(r => /M4TX-7RPD-9KCE.*Revogada/.test(r)), tabs[0]);
  confere('e a de participação, com o evento', tabs[1]?.length === 1 && /K7QD-2M9X-P4TR.*EXT-1/.test(tabs[1][0]), tabs[1]);
  confere('conferida duas vezes aparece', /2×/.test(tabs[0].find(r => /Q8RT/.test(r)) || ''));

  const nome = await baixa(p, () => p.click('#dcl-btn'));
  await p.waitForTimeout(600);
  const d = await pdf(p);
  confere('emitir baixa o PDF com o nome do NRO-PUB-002', nome === 'NRO-DIR-004-4 DECLARAÇÃO DE VÍNCULO - Ana Figueiredo.pdf', nome);
  confere('duas folhas', d?.paginas === 2, d?.paginas);
  confere('o cabeçalho do modelo: Diretoria, o título, o código e a revisão',
    /^NeuroDynamics Diretoria Declaração de vínculo NRO-DIR-004-4 Rev\. B/.test(d.textos[0]), d.textos[0].slice(0, 120));
  confere('a frase, com o CPF inteiro no papel',
    d.textos[0].includes('Declaramos, para os devidos fins, que ANA FIGUEIREDO, CPF nº 000.000.000-00, atua como GERENTE DE PROJETO da NeuroDynamics PD&I desde março de 2024.'),
    d.textos[0].slice(0, 400));
  confere('sem assinatura e sem a razão da declaração', !/assinatura:|Assinatura\b|finalidade de/i.test(d.textos[0].replace('Dispensa assinatura', '')));
  const [cod] = /CÓDIGO VERIFICADOR ([0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4})/.exec(d.textos[0])?.slice(1) || [];
  confere('a legenda de autenticação em cada folha: o código, o controle e o endereço',
    !!cod && d.textos.every(t => t.includes('CÓDIGO VERIFICADOR ' + cod) && /CONTROLE [0-9A-F]{8}/.test(t) && t.includes('auth.neurodynamics.dev')
      && t.includes('DOCUMENTO EMITIDO ELETRONICAMENTE')), d.textos.map(t => t.slice(-420)));
  confere('a segunda folha: os treinamentos e os eventos',
    /Registro de formação e de participação em eventos/.test(d.textos[1]) && /NRO-TRE-002/.test(d.textos[1]) && /EXT-1/.test(d.textos[1]), d.textos[1].slice(0, 500));
  confere('o banco emitiu para o registro 4', JSON.stringify(await rpcs(p, 'doc_vinculo_emitir')) === '[{"p_registro":4}]');
  confere('e a emitida entra na lista', await p.locator('.dcl-tab >> nth=0').locator('tbody tr').count() === 3);

  const via = await baixa(p, () => p.click(`.dcl-tab tr:has-text("${cod}") button:has-text("Segunda via")`));
  confere('a segunda via sai com o mesmo nome e o mesmo código', via === nome && (await pdf(p)).textos[0].includes('CÓDIGO VERIFICADOR ' + cod));

  await p.click(`.dcl-tab tr:has-text("${cod}") button:has-text("Revogar")`); await p.waitForTimeout(250);
  await p.click('#modal .btn.perigo'); await p.waitForTimeout(250);
  confere('revogar sem motivo não chama o banco', (await rpcs(p, 'doc_emitido_revogar')).length === 0 && /motivo/.test(await toasts(p)));
  await p.fill('#dcl-mot', 'Emitida para teste.'); await p.click('#modal .btn.perigo'); await p.waitForTimeout(1200);
  const rev = await rpcs(p, 'doc_emitido_revogar');
  confere('com o motivo, revoga — e a validação passa a dizer isso',
    rev.length === 1 && rev[0].p_codigo === cod && rev[0].p_motivo === 'Emitida para teste.'
      && /Revogada/.test(await texto(p, `.dcl-tab tr:has-text("${cod}")`)), rev);

  /* o Depto. de Pessoal emite para qualquer um */
  await p.selectOption('#dcl-quem', '11'); await p.waitForTimeout(1300);
  confere('escolher outra pessoa troca o endereço', await p.evaluate(() => location.hash) === '#/servicos/declaracao/11');
  const falta = await texto(p, '.dcl-previa .aviso-box');
  confere('e avisa o que falta na ficha dela', /não tem CPF/.test(falta) && /data de ingresso/.test(falta) && !/não tem cargo/.test(falta), falta);
  confere('a prévia é a dela', /BRUNO TAVARES/.test(await texto(p, '.dcl-folha p')));
  await ir(p, '#/servicos/declaracao/23', 1300);
  confere('quem saiu "atuou"', /atuou como DESIGNER/.test(await texto(p, '.dcl-folha p')) && /até junho de 2026/.test(await texto(p, '.dcl-folha p')),
    await texto(p, '.dcl-folha p'));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= os eventos ================= */
{
  console.log('\nEventos e participações');
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/eventos' });
  await p.waitForTimeout(400);
  const meus = await p.evaluate(() => [...document.querySelectorAll('a.evx-card')].map(a => a.getAttribute('href').split('/').pop()));
  confere('Meus: o que registrei e de que participo', meus.join('|') === 'EXT-3|EXT-1', meus);
  confere('a aba de aprovar conta o que me espera', /Para aprovar 1/.test(await texto(p, '.arq-nav')));
  confere('o cartão do aprovado traz o código da minha declaração', /K7QD-2M9X-P4TR/.test(await texto(p, 'a.evx-card[href$="EXT-1"]')));
  await ir(p, '#/servicos/eventos/aprovar');
  confere('Para aprovar: o do Bruno, que espera por mim',
    await p.locator('a.evx-card').count() === 1 && /espera você/.test(await texto(p, 'a.evx-card[href$="EXT-2"]')) && /1 de 2 aprovações/.test(await texto(p, 'a.evx-card')));
  await ir(p, '#/servicos/eventos/todos');
  confere('Todos da equipe: só os aprovados', (await p.evaluate(() => [...document.querySelectorAll('a.evx-card')].map(a => a.getAttribute('href')))).join() === '#/servicos/eventos/EXT-1');

  /* a busca acha o evento */
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  await p.keyboard.type('cbeb', { delay:20 }); await p.waitForTimeout(300);
  const achou = await p.evaluate(() => [...document.querySelectorAll('.pl-item')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  confere('a busca acha o evento pelo nome', achou.some(t => /EXT-1 · CBEB 2026/.test(t)), achou);
  await p.keyboard.press('Escape');

  /* o aprovado */
  await ir(p, '#/servicos/eventos/EXT-1', 1200);
  confere('a minha declaração, com o código', /K7QD-2M9X-P4TR/.test(await texto(p, '.evx-minha')));
  const nome = await baixa(p, () => p.click('.evx-minha button'));
  const d = await pdf(p);
  confere('baixa a declaração de participação no modelo', nome === 'NRO-DIR-006-1 DECLARAÇÃO DE PARTICIPAÇÃO - Ana Figueiredo.pdf', nome);
  confere('a frase de quem é da equipe, com a função e as horas por extenso',
    d.textos[0].includes('que ANA FIGUEIREDO participou, como integrante da NeuroDynamics PD&I, na condição de apresentador(a) de trabalho, do evento CBEB 2026')
      && /com dedicação de 24 horas\./.test(d.textos[0]) && d.textos[0].includes('CÓDIGO VERIFICADOR K7QD-2M9X-P4TR'), d.textos[0].slice(0, 700));
  const linhas = await p.evaluate(() => [...document.querySelectorAll('.evx-tab tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()));
  confere('a externa aparece como externa, com o e-mail (quem gere vê)', /Helena Prado externo.*helena\.prado@exemplo\.org/.test(linhas[1] || ''), linhas);
  confere('o e-mail que falhou diz que falhou', /falhou/.test(linhas[1]) && /enviado/.test(linhas[0]), linhas);
  confere('as duas aprovações, com o parecer', /Carla Mendonça/.test(await texto(p, '.evx-quem')) && /Confere com a programação/.test(await texto(p, '.evx-quem')));
  await p.click('.evx-tab tr:has-text("Helena") button[title="Mandar o e-mail de novo"]'); await p.waitForTimeout(700);
  confere('mandar o e-mail de novo', (await rpcs(p, 'evento_ext_reenviar')).map(x => x.p_participante).join() === 'pt2' && /entra na fila/.test(await toasts(p)));

  /* aprovar o que falta */
  await ir(p, '#/servicos/eventos/EXT-2', 1200);
  confere('quem aprova vê a barra e os botões', /1 de 2 aprovações/.test(await texto(p, '.evx-aprov')) && await p.locator('.evx-aprov button:has-text("Aprovar")').count() === 1);
  await p.click('.evx-aprov button:has-text("Aprovar")'); await p.waitForTimeout(250);
  confere('o modal avisa que é a última', /última aprovação que falta/.test(await texto(p, '#modal')) && /2 participantes/.test(await texto(p, '#modal')));
  await p.fill('#evx-par', 'Confere com a lista de presença.'); await p.click('#evx-dbtn'); await p.waitForTimeout(1500);
  const dec = await rpcs(p, 'evento_ext_decidir');
  confere('aprovar manda a decisão com o parecer', dec.length === 1 && dec[0].id === 'ev2' && dec[0].decisao === 'aprovar' && dec[0].parecer === 'Confere com a lista de presença.', dec);
  confere('e as declarações saem', /Saíram 2 declarações/.test(await toasts(p)) && /Aprovado/.test(await texto(p, '.evx-selos'))
    && await p.locator('.evx-tab tbody tr button[title^="Baixar a declaração"]').count() === 2);

  /* registrar */
  await ir(p, '#/servicos/eventos/novo', 900);
  confere('o formulário já traz quem registra entre os participantes', await p.locator('#ef-parts .evx-part').count() === 1 && /Ana Figueiredo/.test(await texto(p, '#ef-parts')));
  await p.click('#ef-mod button:has-text("Online")'); await p.waitForTimeout(100);
  confere('online esconde o local', await p.locator('#ef-local-w').isHidden());
  await p.click('#ef-mod button:has-text("Presencial")');
  await p.fill('#ef-nome', 'Feira de Inovação do BH-TEC');
  await p.fill('#ef-desc', 'Estande com a órtese e o triciclo.');
  await p.fill('#ef-local', 'BH-TEC, Belo Horizonte');
  await p.fill('#ef-ini', dia(-2)); await p.fill('#ef-horas', '6');
  await p.fill('#ef-membro', 'Carla Mendonça'); await p.click('.evx-add button:has-text("Membro")'); await p.waitForTimeout(150);
  await p.click('.evx-add button:has-text("Externo")'); await p.waitForTimeout(150);
  await p.fill('#ef-parts .evx-part >> nth=2 >> .ep-nome', 'Rafael Dias');
  await p.fill('#ef-parts .evx-part >> nth=2 >> .ep-email', 'rafael-sem-arroba');
  await p.fill('#ef-parts .evx-part >> nth=1 >> .ep-horas', '3');
  await p.click('#ef-enviar'); await p.waitForTimeout(700);
  confere('e-mail que não é e-mail volta com a linha e o nome', /Participante 3 \(Rafael Dias\): o e-mail não parece um e-mail\./.test(await texto(p, '#ef-erro')), await texto(p, '#ef-erro'));
  await p.fill('#ef-parts .evx-part >> nth=2 >> .ep-email', 'rafael@ufmg.br');
  await p.fill('#ef-ini', dia(3));
  await p.click('#ef-enviar'); await p.waitForTimeout(500);
  confere('evento no futuro não vai para aprovação', /ainda não aconteceu/.test(await texto(p, '#ef-erro')));
  await p.fill('#ef-ini', dia(-2));
  await p.click('#ef-enviar'); await p.waitForTimeout(1600);
  const sal = await rpcs(p, 'evento_ext_salvar'), env = await rpcs(p, 'evento_ext_enviar');
  const ult = sal[sal.length - 1];
  confere('salvar manda o evento e os três participantes',
    ult?.nome === 'Feira de Inovação do BH-TEC' && ult.local === 'BH-TEC, Belo Horizonte' && ult.horas === '6'
      && JSON.stringify(ult.participantes) === JSON.stringify([{ registro:4, papel:'', horas:'' }, { registro:17, papel:'', horas:'3' },
        { nome:'Rafael Dias', email:'rafael@ufmg.br', papel:'', horas:'' }]), ult);
  confere('e já manda para aprovação, e abre o evento', env.length === 1 && await p.evaluate(() => location.hash) === '#/servicos/eventos/EXT-5'
    && /Em aprovação/.test(await texto(p, '.evx-selos')), env);

  /* editar, reabrir, cancelar */
  await ir(p, '#/servicos/eventos/EXT-3/editar', 1100);
  confere('editar traz o que está gravado', await p.inputValue('#ef-nome') === 'Feira de Tecnologia Assistiva' && await p.inputValue('#ef-horas') === '8');
  await p.fill('#ef-horas', '7.5'); await p.click('#ef-salvar'); await p.waitForTimeout(1300);
  confere('e salva no mesmo registro', (await rpcs(p, 'evento_ext_salvar')).pop()?.id === 'ev3' && /7h30/.test(await texto(p, '.evx-dados')));
  await ir(p, '#/servicos/eventos/EXT-1', 1100);
  await p.click('button:has-text("Reabrir para correção")'); await p.waitForTimeout(200);
  await p.fill('#evx-mot', 'A Helena ficou só um dia.'); await p.click('#modal .btn.perigo'); await p.waitForTimeout(1300);
  confere('reabrir revoga as declarações e volta a rascunho', /2 declarações revogadas/.test(await toasts(p)) && /Rascunho/.test(await texto(p, '.evx-selos'))
    && /Reaberto por/.test(await texto(p, '.aviso-box.warn')));
  await ir(p, '#/servicos/eventos/EXT-3', 1000);
  await p.click('button:has-text("Cancelar o registro")'); await p.waitForTimeout(200);
  await p.fill('#evx-mot', 'Registrado em duplicidade.'); await p.click('#modal .btn.perigo'); await p.waitForTimeout(1200);
  confere('cancelar pede o motivo e fecha o registro', /Cancelado/.test(await texto(p, '.evx-selos')) && /Registrado em duplicidade/.test(await texto(p, '.aviso-box.err')));

  /* configurações */
  await ir(p, '#/servicos/eventos/config', 1100);
  confere('quem aprova: NRO_MANAGERS, como está', await p.evaluate(() => [...document.querySelectorAll('input.evc-g:checked')].map(x => +x.value).join()) === '6');
  await p.check('input.evc-g[value="3"]'); await p.selectOption('#evc-min', '1');
  await p.click('.evx-cfg .card:has-text("Quem aprova") button:has-text("Salvar")'); await p.waitForTimeout(500);
  const ec = await escritas(p, 'eventos_ext_config');
  confere('salvar grava os grupos e as aprovações', ec.length === 1 && JSON.stringify(ec[0].dados) === '{"grupos_aprovadores":[3,6],"aprovacoes_minimas":1}', ec);
  await p.fill('#dcc-url', 'auth.neurodynamics.dev'); await p.click('.evx-cfg .card:has-text("repetem") button:has-text("Salvar")'); await p.waitForTimeout(400);
  confere('o endereço da validação precisa ser https', (await escritas(p, 'doc_emissao_config')).length === 0 && /https:\/\//.test(await toasts(p)));
  await p.fill('#dcc-url', 'https://auth.neurodynamics.dev'); await p.fill('#dcc-cidade', 'Belo Horizonte, MG');
  await p.click('.evx-cfg .card:has-text("repetem") button:has-text("Salvar")'); await p.waitForTimeout(400);
  const dc = await escritas(p, 'doc_emissao_config');
  confere('e o que as declarações repetem', dc.length === 1 && dc[0].dados.cidade === 'Belo Horizonte, MG' && dc[0].dados.url_validacao === 'https://auth.neurodynamics.dev', dc);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= quem só lê ================= */
{
  console.log('\nQuem só lê');
  const { ctx, p, erros } = await abrir({ stub: stubLeitura, hash:'#/servicos/eventos' });
  await p.waitForTimeout(400);
  confere('sem configurações na navegação', !/Configurações/.test(await texto(p, '.arq-nav')));
  await ir(p, '#/servicos/eventos/EXT-4', 1000);
  confere('o rascunho de outra pessoa não abre', /Nenhum evento EXT-4 para você/.test(await texto(p, '#main')));
  await ir(p, '#/servicos/eventos/EXT-1', 1000);
  confere('quem registrou vê os e-mails dos externos, mas não reabre sem aprovar',
    /@exemplo\.org/.test(await texto(p, '.evx-tab')) && await p.locator('button:has-text("Reabrir")').count() === 0);
  await ir(p, '#/servicos/eventos/aprovar', 1000);
  confere('e não tem nada para aprovar', await p.locator('a.evx-card').count() === 0);
  await ir(p, '#/servicos/eventos/config', 900);
  confere('o endereço das configurações devolve à lista', await p.evaluate(() => location.hash) === '#/servicos/eventos');
  await ir(p, '#/servicos/declaracao/11', 1100);
  confere('a declaração de outra pessoa não: a sua, sim', /ANA FIGUEIREDO/.test(await texto(p, '.dcl-folha p')) && await p.locator('#dcl-quem').count() === 0);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

{
  const { ctx, p, erros } = await abrir({ stub: stubLeituraParticipante, hash:'#/servicos/eventos/EXT-1' });
  await p.waitForTimeout(500);
  confere('quem só participou vê a própria declaração', /K7QD-2M9X-P4TR/.test(await texto(p, '.evx-minha')));
  confere('mas não os e-mails dos externos, nem as declarações dos outros',
    !/@exemplo\.org/.test(await texto(p, '.evx-tab')) && await p.locator('.evx-tab th:has-text("Declaração")').count() === 0);
  confere('nem edita, nem reabre', await p.locator('#main a:has-text("Editar"), #main button:has-text("Reabrir")').count() === 0);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  console.log('\nCelular');
  for (const h of ['#/servicos', '#/servicos/declaracao', '#/servicos/eventos', '#/servicos/eventos/EXT-1', '#/servicos/eventos/novo']){
    const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:h });
    await p.waitForTimeout(700);
    confere(`${h}: sem rolagem horizontal`, await semRolagem(p));
    confere(`${h}: nenhum erro de página`, erros.length === 0, erros);
    await ctx.close();
  }
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
