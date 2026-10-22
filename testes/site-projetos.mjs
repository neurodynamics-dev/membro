/* 2.21.0: as páginas dos projetos do site, editadas no SOMA. Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
/* supervisor: a Ana passa a supervisionar a Nebula; com papel leitura, ela não é gestão */
async function abrir(hash, { papel = 'admin', supervisora = false, largura = 1440 } = {}){
  const ctx = await nav.newContext({ viewport:{ width:largura, height:960 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  let stub = stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
  if (supervisora) stub = stub.replace("grupo_id:8, supervisor:11,", "grupo_id:8, supervisor:4,");
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|pokeapi/, r => r.abort());
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const escritas = (p, t) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), t);
const alvo = (p, h) => p.evaluate(h => { location.hash = h; }, h);
const toastTxt = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));

try{
  console.log('Administração › Site institucional: a página');
  {
    const t = await abrir('#/admin/site'), { p } = t;
    await p.waitForSelector('#site-painel #sp-nome');
    confere('a lista na ordem, a Nebula selecionada', (await p.locator('#site-lista .adm-item .nm').allInnerTexts()).join() === 'Nebula,Órtese ativa'
      && await p.inputValue('#sp-nome') === 'Nebula');
    confere('o rascunho do Bruno aparece como pendência na lista', /1/.test(await p.locator('#site-lista .adm-item.on .pill').innerText()));
    confere('família, animação e projeto do SOMA vêm preenchidos',
      await p.inputValue('#sp-familia') === 'dendrito' && await p.inputValue('#sp-anim') === 'nebula' && await p.inputValue('#sp-projeto') === 'pj1');
    confere('o português abre primeiro', await p.locator('[data-idioma="pt"]').isVisible() && !(await p.locator('[data-idioma="en"]').isVisible())
      && await p.inputValue('#sp-tagline_pt') === 'Pensar no movimento, e o músculo responde.');
    confere('o link para a página pública', await p.locator('#site-painel a[href="https://neurodynamics.dev/#/projects/nebula"]').count() === 1);
    await p.selectOption('#sp-familia', 'retina');
    await p.selectOption('#sp-status', 'Completed');
    await p.locator('[data-idioma-bt="en"]').click();
    await p.fill('#sp-tagline', 'A new line.');
    await p.fill('#sp-slug', 'Nebula Nova');
    await p.getByRole('button', { name:'Salvar alterações' }).click();
    confere('endereço inválido não vai ao banco', /minúsculas, números e hífen/.test(await toastTxt(p)) && (await escritas(p, 'site_projetos')).length === 0);
    await p.fill('#sp-slug', 'nebula');
    await p.getByRole('button', { name:'Salvar alterações' }).click();
    await p.waitForFunction(() => (window.__escritas || []).some(x => x.tabela === 'site_projetos' && x.op === 'update'));
    const u = (await escritas(p, 'site_projetos')).at(-1).dados;
    confere('salvar manda família, fase, frase em inglês e o projeto do SOMA',
      u.familia === 'retina' && u.status === 'Completed' && u.tagline === 'A new line.' && u.projeto_id === 'pj1'
      && u.tagline_pt === 'Pensar no movimento, e o músculo responde.' && u.animacao === 'nebula', u);
    await p.waitForSelector('#sp-familia');
    confere('a tela volta com o que foi salvo', await p.inputValue('#sp-familia') === 'retina');

    console.log('Números');
    await alvo(p, '#/admin/site/numeros'); await p.waitForSelector('#site-aba .site-tab, #site-aba .empty');
    const n0 = (await p.locator('#site-aba .site-n').first().innerText()).trim();
    confere('o número no ar, escrito como no site', n0 === 'mais de 15 milhões'
      && /No site/i.test(await p.locator('#site-aba tbody tr').first().innerText()), n0);
    await p.getByRole('button', { name:'Novo número' }).click();
    await p.fill('#sn-valor', '1,78'); await p.selectOption('#sn-casas', '2'); await p.selectOption('#sn-pre', 'menos');
    await p.selectOption('#sn-uni', 'dias'); await p.fill('#sn-rotulo_pt', 'de internação, em média');
    confere('a prévia mostra o número como no site', (await p.locator('#sn-previa b').innerText()) === '−1,78 dia');
    await p.getByRole('button', { name:'Acrescentar número' }).click();
    confere('número da literatura sem fonte não entra', /precisa da fonte/.test(await toastTxt(p)) && (await escritas(p, 'site_projeto_numeros')).length === 0);
    await p.fill('#sn-fonte', 'Pazo-Palacios et al., 2025'); await p.fill('#sn-url', 'ftp://x');
    await p.getByRole('button', { name:'Acrescentar número' }).click();
    confere('link da fonte sem https não entra', /https/.test(await toastTxt(p)) && (await escritas(p, 'site_projeto_numeros')).length === 0);
    await p.fill('#sn-url', 'https://doi.org/10.1/x'); await p.check('#sn-pub');
    await p.getByRole('button', { name:'Acrescentar número' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#site-aba tbody tr').length === 2);
    const n = (await escritas(p, 'site_projeto_numeros')).at(-1).dados;
    confere('o número vai com valor, casas, prefixo, unidade, fonte e publicado',
      n.valor === 1.78 && n.casas === 2 && n.prefixo === 'menos' && n.unidade === 'dias' && n.fonte === 'Pazo-Palacios et al., 2025'
      && n.publicado === true && n.site_projeto_id === 'p1' && n.origem === 'literatura', n);
    await p.getByRole('button', { name:'Novo número' }).click();
    await p.locator('[data-origem="projeto"]').click();
    confere('do projeto, a fonte some', !(await p.locator('#sn-fonte').isVisible()));
    await p.fill('#sn-valor', '13'); await p.fill('#sn-ate', '10'); await p.fill('#sn-rotulo_pt', 'faixa');
    await p.getByRole('button', { name:'Acrescentar número' }).click();
    confere('faixa ao contrário não entra', /maior que o valor/.test(await toastTxt(p)));
    await p.fill('#sn-ate', '30'); await p.selectOption('#sn-uni', 'Hz');
    confere('a faixa na prévia', (await p.locator('#sn-previa b').innerText()) === '13 a 30 Hz');
    await p.getByRole('button', { name:'Acrescentar número' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#site-aba tbody tr').length === 3);
    confere('sem marcar, o número fica fora do site', /rascunho/i.test(await p.locator('#site-aba tbody tr').nth(2).innerText()));
    await p.locator('#site-aba tbody tr').nth(2).getByRole('button', { name:'Publicar no site' }).click();
    await p.waitForFunction(() => /no site/i.test(document.querySelectorAll('#site-aba tbody tr')[2]?.innerText || ''));
    confere('publicar pela linha', true);

    console.log('Produção');
    await alvo(p, '#/admin/site/producao'); await p.waitForSelector('#site-aba .site-tab');
    confere('a apresentação do Bruno espera, com o nome dele', /rascunho/i.test(await p.locator('#site-aba tbody tr').first().innerText())
      && /de Bruno Tavares/.test(await p.locator('#site-aba tbody tr').first().innerText()));
    await p.locator('#site-aba tbody tr').first().getByRole('button', { name:'Publicar no site' }).click();
    await p.waitForFunction(() => /no site/i.test(document.querySelector('#site-aba tbody tr')?.innerText || ''));
    confere('a gestão publica o rascunho', ((await escritas(p, 'site_projeto_saidas')).at(-1).dados.publicado) === true);
    await p.getByRole('button', { name:'Novo item' }).click();
    await p.selectOption('#ss-tipo', 'parceria');
    confere('parceria pede a instituição e o logo, não o veículo',
      (await p.locator('#ss-titulo-lb').textContent()) === 'Instituição parceira' && await p.locator('#ss-img').isVisible() && !(await p.locator('#ss-veiculo').isVisible()));
    await p.fill('#ss-titulo', 'InCor, Instituto do Coração do HC FMUSP');
    await p.fill('#ss-img', 'javascript:alert(1)');
    await p.getByRole('button', { name:'Acrescentar item' }).click();
    confere('logo que não é https nem de assets/ não entra', /assets\//.test(await toastTxt(p)));
    await p.fill('#ss-img', 'assets/incor.png'); await p.fill('#ss-nota_pt', 'Estrutura e execução dos testes clínicos');
    await p.check('#ss-pub');
    await p.getByRole('button', { name:'Acrescentar item' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#site-aba tbody tr').length === 2);
    const s = (await escritas(p, 'site_projeto_saidas')).at(-1).dados;
    confere('a parceria vai com o logo, a nota e sem veículo', s.tipo === 'parceria' && s.imagem_url === 'assets/incor.png'
      && s.veiculo === null && s.nota_pt === 'Estrutura e execução dos testes clínicos' && s.publicado === true, s);
    await p.locator('#site-aba tbody tr').filter({ hasText:'InCor' }).getByRole('button', { name:'Excluir' }).click();
    await p.getByRole('button', { name:'Excluir' }).last().click();
    await p.waitForFunction(() => document.querySelectorAll('#site-aba tbody tr').length === 1);
    confere('excluir pergunta e tira a linha', (await escritas(p, 'site_projeto_saidas')).some(x => x.op === 'delete'));

    console.log('Projeto novo');
    await alvo(p, '#/admin/site'); await p.waitForSelector('#sp-nome');
    await p.getByRole('button', { name:'Novo projeto' }).click();
    await p.fill('#snp-nome', 'Órion Duo');
    await p.getByRole('button', { name:'Criar projeto' }).click();
    await p.waitForFunction(() => document.querySelector('#sp-nome')?.value === 'Órion Duo');
    const c = (await escritas(p, 'site_projetos')).find(x => x.op === 'insert').dados;
    confere('nasce oculto, com o endereço sem acento', c.slug === 'orion-duo' && c.publicado === false, c);
    await fechar(t);
  }

  console.log('A página do projeto no portal: a supervisora');
  {
    const t = await abrir('#/projetos/NEBULA', { papel:'leitura', supervisora:true }), { p } = t;
    await p.waitForSelector('#pj-site .site-no-pj');
    const txt = await p.locator('#pj-site').innerText();
    confere('o cartão No site com os números e a produção', /no site/i.test(txt) && /mais de 15 milhões/.test(txt) && /BCI-FES/.test(txt), txt);
    confere('avisa que o que ela mandar chega como rascunho', /chega como rascunho/.test(txt) && /1 item espera publicação/.test(txt));
    confere('no que está no ar ela não mexe', await p.locator('#site-pj-num tbody tr').first().locator('button').count() === 0);
    confere('nem publica o rascunho, mas edita', await p.locator('#site-pj-saidas [aria-label="Publicar no site"]').count() === 0
      && await p.locator('#site-pj-saidas [aria-label="Editar"]').count() === 1);
    await p.getByRole('button', { name:'Novo item' }).click();
    confere('o formulário dela não tem "Publicado"', await p.locator('#ss-pub').count() === 0
      && /rascunho até a gestão/.test(await p.locator('#modal').innerText()));
    await p.fill('#ss-titulo', 'Beta-band ERD for early movement intention'); await p.fill('#ss-veiculo', 'J Neural Eng');
    await p.selectOption('#ss-sit', 'submetido');
    await p.getByRole('button', { name:'Acrescentar item' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#site-pj-saidas tbody tr').length === 2);
    confere('o artigo entra como rascunho, sem publicado no pedido', /Salvo como rascunho/i.test(await toastTxt(p))
      && !('publicado' in (await escritas(p, 'site_projeto_saidas')).at(-1).dados)
      && /rascunho/i.test(await p.locator('#site-pj-saidas tbody tr').filter({ hasText:'Beta-band' }).innerText()));
    await fechar(t);
  }
  {
    const t = await abrir('#/projetos/NEBULA', { papel:'leitura' }), { p } = t;
    await p.waitForSelector('#pj-site .site-no-pj');
    confere('quem não supervisiona só lê', await p.locator('#pj-site button').count() === 0
      && /mais de 15 milhões/.test(await p.locator('#pj-site').innerText()));
    await fechar(t);
  }

  console.log('Celular');
  {
    const t = await abrir('#/admin/site/numeros', { largura:390 }), { p } = t;
    await p.waitForSelector('#site-aba .site-tab');
    const vaza = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    confere('nada vaza para o lado no celular', vaza <= 1, vaza);
    await fechar(t);
  }
}catch(e){ falhas++; console.error('FALHA  exceção:', e.message); }
await nav.close();
console.log(falhas ? `${falhas} de ${checks} verificações falharam.` : `Tudo certo. ${checks} verificações passaram.`);
process.exit(falhas ? 1 : 0);
