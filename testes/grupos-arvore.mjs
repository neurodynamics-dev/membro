/* Grupos dentro de grupos (v19), na tela e no resto do portal.
   Confere, com asserção (sai com código 1 se algo falhar):
     - Administração › Grupos mostra a árvore: raízes na ordem configurada,
       filhos debaixo do pai, grupo sem quadro e quadro fechado marcados;
     - cada grupo tem endereço (#/admin/grupos/<prefixo>), com o caminho
       até a raiz, e separa quem está pela ficha de quem veio de baixo;
     - pôr várias pessoas de uma vez manda uma chamada só, e a pessoa
       passa a contar no grupo de cima; "marcar todos de um grupo" marca;
     - tirar pede confirmação e tira também do grupo de cima;
     - o pai oferecido ao editar nunca fecha um círculo; o subgrupo novo
       nasce com o pai escolhido e o prefixo sugerido do fim do nome;
     - o resto do portal herda: menu de Atividades (grupo sem quadro não
       entra), filtro do quadro de pessoal, convite de grupo da Agenda;
     - celular sem rolagem horizontal; nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/' } = {}){
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
const ir = async (p, h, espera = 700) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const arvore = p => p.evaluate(() => {
  const no = el => ({ nome: el.querySelector(':scope > .gr-no .nm').textContent.trim(),
    filhos: [...el.querySelectorAll(':scope > .gr-filhos > .gr-ramo')].map(no) });
  return [...document.querySelectorAll('#gr-arvore > .gr-ramo')].map(no);
});
const linhaDe = (p, nome) => p.evaluate(n => {
  const a = [...document.querySelectorAll('#gr-arvore .gr-link')].find(x => x.querySelector('.nm').textContent.trim() === n);
  return a ? { n: a.querySelector('.n').textContent.trim(), semQuadro: !!a.querySelector('.gr-semq'),
               fechado: !!a.querySelector('[title="Quadro fechado"]'), on: a.classList.contains('on') } : null;
}, nome);
const pessoas = p => p.evaluate(() => [...document.querySelectorAll('.gr-pessoa')].map(r => ({
  nome: r.querySelector('.nm').textContent.trim(), via: r.querySelector('.gr-via').textContent.trim(),
  tirar: !!r.querySelector('.icon-btn.perigo') })));
const metricas = p => p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.gr-met .metrica')]
  .map(m => [m.querySelector('.rot').textContent.trim(), Number(m.querySelector('.val').textContent)])));

console.log('\nA árvore');
const { ctx, p, erros } = await abrir({ hash:'#/admin/grupos' });
await p.waitForSelector('#gr-arvore .gr-link');
const arv = await arvore(p);
confere('as raízes vêm na ordem configurada, não na alfabética',
  arv.map(x => x.nome).join('|') === 'Depto de Pessoal|Sinais|Órtese|NRO_LEADERSHIP|NRO_PROJECTS', arv.map(x => x.nome));
confere('NRO_LEADERSHIP contém a Gerência e NRO_MANAGERS',
  arv.find(x => x.nome === 'NRO_LEADERSHIP')?.filhos.map(x => x.nome).join('|') === 'Gerência|NRO_MANAGERS', arv);
confere('NRO_PROJECTS contém NRO_PROJECT_NEBULA',
  arv.find(x => x.nome === 'NRO_PROJECTS')?.filhos.map(x => x.nome).join('|') === 'NRO_PROJECT_NEBULA');
const prj = await linhaDe(p, 'NRO_PROJECTS'), lea = await linhaDe(p, 'NRO_LEADERSHIP');
confere('NRO_PROJECTS: sem quadro, e conta o Bruno, que está em NEBULA', prj?.semQuadro && prj?.n === '1', prj);
confere('NRO_LEADERSHIP: fechado, sem quadro, e conta a Carla (em MANAGERS, em pausa)',
  lea?.fechado && lea?.semQuadro && lea?.n === '1', lea);
confere('sem prefixo no endereço, abre o primeiro grupo da árvore', (await linhaDe(p, 'Depto de Pessoal'))?.on);

await p.fill('#gr-filtro', 'nebula'); await p.waitForTimeout(150);
const filtrada = await arvore(p);
confere('filtrar a árvore deixa só o que casa, com o caminho até lá',
  JSON.stringify(filtrada) === JSON.stringify([{ nome:'NRO_PROJECTS', filhos:[{ nome:'NRO_PROJECT_NEBULA', filhos:[] }] }]), filtrada);
await p.fill('#gr-filtro', ''); await p.waitForTimeout(150);

console.log('\nUm grupo');
await ir(p, '#/admin/grupos/PRJ');
confere('#/admin/grupos/PRJ abre NRO_PROJECTS', (await p.textContent('.gr-cab h2')).trim() === 'NRO_PROJECTS');
confere('e acende o grupo na árvore', (await linhaDe(p, 'NRO_PROJECTS'))?.on);
confere('o grupo com a chave de projetos se apresenta como tal',
  await p.locator('.gr-cab .pill:has-text("Pai dos projetos")').count() === 1);
let m = await metricas(p);
confere('métricas: 1 pessoa, 0 pela ficha, 1 por subgrupo, 1 subgrupo',
  m['Pessoas'] === 1 && m['Pela ficha'] === 0 && m['Por subgrupo'] === 1 && m['Subgrupos'] === 1, m);
let ps = await pessoas(p);
confere('o Bruno aparece "por NRO_PROJECT_NEBULA", sem botão de tirar',
  ps.length === 1 && ps[0].nome === 'Bruno Tavares' && ps[0].via === 'por NRO_PROJECT_NEBULA' && !ps[0].tirar, ps);
confere('sem quadro, não há botão "Quem enxerga o quadro"',
  await p.locator('#gr-detalhe button:has-text("Quem enxerga")').count() === 0);

await ir(p, '#/admin/grupos/NEB');
const caminho = await p.evaluate(() => [...document.querySelectorAll('.gr-caminho a, .gr-caminho b')].map(x => x.textContent.trim()));
confere('o caminho mostra de onde o grupo vem', caminho.join(' › ') === 'NRO_PROJECTS › NRO_PROJECT_NEBULA', caminho);
ps = await pessoas(p);
confere('em NEBULA o Bruno está "pela ficha", e pode ser tirado',
  ps.length === 1 && ps[0].via === 'pela ficha' && ps[0].tirar, ps);
confere('o responsável do grupo aparece',
  (await p.locator('.gr-sub .chip:has-text("Bruno Tavares")').count()) === 1);

console.log('\nPôr várias pessoas');
const cands = await p.evaluate(() => [...document.querySelectorAll('.gr-cand .nm')].map(x => x.textContent.trim()));
confere('a lista oferece quem está ativo ou em pausa e ainda não está no grupo (sem o desligado)',
  cands.join('|') === 'Ana Figueiredo|Carla Mendonça', cands);
await p.selectOption('.gr-add-topo select', { label:'NRO_MANAGERS' }); await p.waitForTimeout(250);
const marcadas = await p.evaluate(() => [...document.querySelectorAll('.gr-cand')].filter(l => l.querySelector('input').checked)
  .map(l => l.querySelector('.nm').textContent.trim()));
confere('"marcar todos de um grupo" marca quem está em MANAGERS', marcadas.join() === 'Carla Mendonça', marcadas);
await p.fill('#gr-busca', 'ana'); await p.waitForTimeout(300);
confere('a busca filtra sem perder o foco', await p.evaluate(() => document.activeElement?.id === 'gr-busca'));
await p.check('.gr-cand:has-text("Ana Figueiredo") input');
await p.waitForTimeout(100);
confere('o botão conta as marcadas, inclusive as que a busca escondeu',
  (await p.textContent('#gr-add-btn')).includes('Pôr 2 pessoas'), await p.textContent('#gr-add-btn'));
await p.evaluate(() => { window.__membrosSalvos = []; });
await p.click('#gr-add-btn'); await p.waitForTimeout(700);
const chamadas = await p.evaluate(() => window.__membrosSalvos);
confere('uma chamada só, com as duas pessoas',
  chamadas.length === 1 && chamadas[0].grupo_id === 8 && [...chamadas[0].adicionar].sort((a, b) => a - b).join() === '4,17', chamadas);
const toastTxt = await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
confere('o aviso diz que entraram também no grupo de cima', /e, por ele, em NRO_PROJECTS/.test(toastTxt), toastTxt);
ps = await pessoas(p);
confere('as duas aparecem pela ficha', ps.filter(x => x.via === 'pela ficha').length === 3, ps);
const menuAtv = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="atividades"] .lt-sub a')]
  .map(a => a.textContent.trim()));
confere('a Ana, agora em NEBULA, ganha o quadro dele no menu — e não o de PROJECTS, que não tem quadro',
  menuAtv.some(t => t.includes('NRO_PROJECT_NEBULA')) && !menuAtv.some(t => t.includes('NRO_PROJECTS')), menuAtv);

await ir(p, '#/admin/grupos/PRJ');
m = await metricas(p);
confere('e NRO_PROJECTS passa a contar 3 pessoas, todas por NEBULA', m['Pessoas'] === 3 && m['Por subgrupo'] === 3, m);

console.log('\nTirar');
await ir(p, '#/admin/grupos/NEB');
await p.evaluate(() => { window.__membrosSalvos = []; });
await p.click('.gr-pessoa:has-text("Bruno Tavares") .icon-btn.perigo');
await p.waitForSelector('#modal.open');
const aviso = await p.textContent('#modal');
confere('tirar pede confirmação e avisa que sai também de cima', /Sai também de NRO_PROJECTS/.test(aviso), aviso);
await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(600);
const tirada = await p.evaluate(() => window.__membrosSalvos);
confere('tira pelo registro', tirada.length === 1 && tirada[0].remover?.[0] === 11, tirada);
ps = await pessoas(p);
confere('o Bruno some de NEBULA', !ps.some(x => x.nome === 'Bruno Tavares'), ps);
await ir(p, '#/admin/grupos/PRJ');
confere('e de NRO_PROJECTS', !(await pessoas(p)).some(x => x.nome === 'Bruno Tavares'));

console.log('\nEditar e criar');
await ir(p, '#/admin/grupos/LEA');
await p.click('#gr-detalhe button:has-text("Editar")'); await p.waitForSelector('#gr-pai');
const opcoesPai = await p.evaluate(() => [...document.querySelectorAll('#gr-pai option')].map(o => o.textContent.trim()));
confere('o pai oferecido para LEADERSHIP não inclui ele mesmo nem o que está abaixo dele',
  !opcoesPai.some(t => /NRO_LEADERSHIP|Gerência|NRO_MANAGERS/.test(t)) && opcoesPai.includes('NRO_PROJECTS'), opcoesPai);
await p.keyboard.press('Escape'); await p.waitForTimeout(200);

await ir(p, '#/admin/grupos/PRJ');
await p.click('#gr-detalhe button:has-text("Subgrupo")'); await p.waitForSelector('#gr-nome');
confere('o subgrupo novo já vem com o pai escolhido', await p.inputValue('#gr-pai') === '7');
await p.fill('#gr-nome', 'NRO_PROJECT_ORION');
confere('o prefixo é sugerido do fim do nome, sem o NRO', await p.inputValue('#gr-pref') === 'ORI', await p.inputValue('#gr-pref'));
await p.evaluate(() => { window.__estruturas = []; });
await p.click('#gr-btn'); await p.waitForTimeout(900);
const est = await p.evaluate(() => window.__estruturas);
confere('salvar grava o pai e o quadro na mesma ida', est.length === 1 && est[0].pai_id === 7 && est[0].quadro === true, est);
confere('e o endereço vai para o grupo novo', await p.evaluate(() => location.hash) === '#/admin/grupos/ORI');
const arv2 = await arvore(p);
confere('ORION aparece debaixo de NRO_PROJECTS',
  arv2.find(x => x.nome === 'NRO_PROJECTS')?.filhos.map(x => x.nome).includes('NRO_PROJECT_ORION'), arv2);

console.log('\nO resto do portal herda');
const herda = await p.evaluate(() => ({
  carla: [...gruposEfetivos(state.membros.find(m => m.registro === 17))].sort(),
  convite: membrosDoGrupo('NRO_LEADERSHIP').map(m => m.nome),
  lista: gruposDaEquipe().includes('NRO_LEADERSHIP')
}));
/* a Carla entrou em NEBULA acima (marcada por estar em MANAGERS) */
confere('os grupos da Carla incluem os de cima dos dois lados da árvore',
  herda.carla.join() === 'Firmware,NRO_LEADERSHIP,NRO_MANAGERS,NRO_PROJECTS,NRO_PROJECT_NEBULA', herda.carla);
confere('convidar NRO_LEADERSHIP na Agenda convida quem está em MANAGERS', herda.convite.join() === 'Carla Mendonça', herda.convite);
confere('e o grupo guarda-chuva aparece na lista de grupos, mesmo sem ninguém direto', herda.lista);
await ir(p, '#/equipe/quadro', 1100);
const opcoesGrupo = await p.evaluate(() => [...document.querySelectorAll('.filtros select')].at(-1)
  ? [...[...document.querySelectorAll('.filtros select')].at(-1).options].map(o => o.textContent) : []);
confere('o filtro de grupo do quadro de pessoal oferece o grupo guarda-chuva', opcoesGrupo.includes('NRO_LEADERSHIP'), opcoesGrupo);
await p.evaluate(() => { const s = [...document.querySelectorAll('.filtros select')];
  s[0].value = ''; s[0].dispatchEvent(new Event('change'));
  s.at(-1).value = 'NRO_LEADERSHIP'; s.at(-1).dispatchEvent(new Event('change')); });
await p.waitForTimeout(300);
const noQuadro = await p.evaluate(() => [...document.querySelectorAll('.tabela tbody tr')].map(r => r.textContent));
confere('filtrar por NRO_LEADERSHIP acha a Carla, que está lá por MANAGERS',
  noQuadro.length === 1 && /Carla/.test(noQuadro[0]), noQuadro);
confere('nenhum erro de página', erros.length === 0, erros);
await ctx.close();

console.log('\nCelular');
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/admin/grupos/NEB' });
  await p.waitForSelector('.gr-det');
  confere('sem rolagem horizontal', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  confere('a árvore vem antes do grupo', await p.evaluate(() =>
    document.querySelector('.gr-arv').getBoundingClientRect().top < document.querySelector('.gr-det').getBoundingClientRect().top));
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
