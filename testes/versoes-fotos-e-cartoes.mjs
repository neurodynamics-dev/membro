/* A 2.17.0: a versão nova, as notas de versão com os bugs e sugestões,
   a foto enviada pelo portal, os OKRs maiores com zoom na roda e os
   cartões de Atividades mais completos. Confere, com asserção (sai com
   código 1 se algo falhar):
     versão  — o rodapé diz a versão no ar e leva às notas; a versão nova
               não abre aviso sozinha, nem para quem já usava (2.17.1);
     notas   — a versão no ar em cima, o número antigo ao lado, a versão
               em foco pelo endereço, as antigas recolhidas, a busca;
     relatos — em aberto por votos, filtros, votar, a página do relato em
               Markdown, comentar, o andamento pela administração,
               relatar com a tela de onde se veio e os parecidos;
     foto    — o aviso no início para quem não tem foto, escolher,
               enquadrar e enviar (o arquivo no bucket, a ficha com o
               endereço), a câmera na ficha só para quem pode;
     OKRs    — o título inteiro no cartão, a mesma altura na linha, a roda
               dá zoom e o Shift com a roda move;
     cartões — etiquetas, pessoas e a conta da checklist no quadro, o
               filtro por etiqueta; no cartão, a descrição em Markdown (com
               a barra e o "Ver"), a checklist (marcar, somar, colar uma
               lista, lista nova), as outras pessoas e as etiquetas pelo
               seletor (criar uma), o @ que marca e avisa, corrigir o
               próprio comentário, a menção antiga, espelhar ou mover para outro
               quadro arquivando o original, os arquivados e restaurar,
               a atividade nova com pessoas e etiquetas;
     e o celular, sem rolagem lateral, e nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
/* a versão no ar é a da casca: o teste não quebra a cada versão nova */
const NO_AR = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/const VERSAO = '([^']+)'/)[1];
const NO_AR_RE = NO_AR.replace(/\./g, '\\.');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin, antes } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  if (antes) await p.addInitScript(antes);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(900);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 900) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const hash = p => p.evaluate(() => location.hash);
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(r => r.nome === n).map(r => r.p), nome);
const semRolagemLateral = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const texto = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent.replace(/\s+/g, ' ').trim() ?? null, sel);
const aceitar = async p => { await p.waitForSelector('#modal.open .btn.solid'); await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(500); };

/* ================= VERSÃO E NOTAS ================= */
console.log('\nA versão e as notas de versão');
{
  /* quem já usava o portal (tem recentes e viu uma versão antiga): nada
     abre sozinho; as notas ficam no rodapé, para quem procurar (2.17.1) */
  const { ctx, p, erros } = await abrir({ antes: () => { try {
    localStorage.setItem('nd.versao', '2.16.0');
    localStorage.setItem('nd.recentes.4', JSON.stringify([{ h:'#/agenda', t:'Agenda', s:'', i:'agenda', em:Date.now() }]));
  } catch(e){} } });
  await p.waitForTimeout(600);
  const toasts = await p.evaluate(() => [...document.querySelectorAll('#toast .toast')].map(t => t.textContent.replace(/\s+/g, ' ').trim()));
  confere('a versão nova não abre aviso sozinha, nem para quem já usava', !toasts.some(t => /SOMA|mudou/.test(t)), toasts);
  const ft = await p.evaluate(() => ({ txt: document.getElementById('ft-ver').textContent, href: document.getElementById('ft-ver').getAttribute('href'),
    links: [...document.querySelectorAll('#ft nav[aria-label="Ajuda"] a')].map(a => a.getAttribute('href')) }));
  confere('o rodapé diz a versão no ar e leva às notas', ft.txt === 'SOMA ' + NO_AR && ft.href === '#/versoes', ft);
  confere('a ajuda do rodapé tem as notas e os bugs e sugestões', ft.links.includes('#/versoes') && ft.links.includes('#/versoes/comentarios'), ft.links);

  await p.click('#ft-ver'); await p.waitForTimeout(900);
  const notas = await p.evaluate(() => ({
    h1: document.querySelector('#main h1')?.textContent,
    primeira: document.querySelector('.vs-item .vs-num')?.textContent,
    noAr: document.querySelector('.vs-item.atual .pill')?.textContent.trim(),
    antes: [...document.querySelectorAll('.vs-item')].find(x => x.querySelector('.vs-num')?.textContent === '2.16.0')?.querySelector('.vs-antes')?.textContent,
    /* os tipos e o Markdown, na 2.17.0, que tem de tudo */
    tipos: [...new Set([...([...document.querySelectorAll('.vs-item')].find(x => x.querySelector('.vs-num')?.textContent === '2.17.0')
      ?.querySelectorAll('.vs-tipo') || [])].map(x => x.textContent))],
    md: [...document.querySelectorAll('.vs-item')].find(x => x.querySelector('.vs-num')?.textContent === '2.17.0')
      ?.querySelectorAll('.md code, .md strong').length || 0,
    antigasFechadas: !document.querySelector('.vs-antigas')?.open,
    dica: !!document.querySelector('#main .dica')
  }));
  confere('as notas abrem pela versão no ar, marcada', notas.h1 === 'Notas de versão' && notas.primeira === NO_AR && notas.noAr === 'No ar', notas);
  confere('a 2.16.0 diz o número antigo (32.0)', notas.antes === 'antes 32.0', notas.antes);
  confere('os itens dizem o tipo e se leem em Markdown', notas.tipos.includes('Novo') && notas.tipos.includes('Melhoria') && notas.md > 5, notas);
  confere('as versões antigas ficam recolhidas, e a regra da numeração num ícone', notas.antigasFechadas && notas.dica, notas);
  await ir(p, '#/versoes/2.2.0', 1200);
  const foco = await p.evaluate(() => ({ aberta: document.querySelector('.vs-antigas')?.open,
    foco: document.querySelector('.vs-item.foco .vs-num')?.textContent }));
  confere('#/versoes/2.2.0 abre as antigas e põe a versão em foco', foco.aberta && foco.foco === '2.2.0', foco);
  await p.keyboard.press('Control+k'); await p.keyboard.type('notas de'); await p.waitForTimeout(300);
  const achou = await p.evaluate(() => [...document.querySelectorAll('#pl-res a, #pl-res .pl-item')].map(x => x.textContent.replace(/\s+/g, ' ').trim()).slice(0, 4));
  confere('a busca acha as notas de versão', achou.some(t => /Notas de versão/.test(t)), achou);
  await p.keyboard.press('Escape');
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

/* ================= BUGS E SUGESTÕES ================= */
console.log('\nBugs e sugestões');
{
  const { ctx, p, erros } = await abrir({ hash:'#/atividades/ORT' });
  await ir(p, '#/versoes/comentarios', 1300);
  const lista = () => p.evaluate(() => [...document.querySelectorAll('.fb-item')].map(x => ({
    cod: x.querySelector('.fb-cod')?.textContent, votos: +x.querySelector('.fb-voto b')?.textContent, on: x.querySelector('.fb-voto').classList.contains('on') })));
  let l = await lista();
  confere('em aberto, os mais votados primeiro (SUG-2 antes de BUG-1)', l.map(x => x.cod).join() === 'SUG-2,BUG-1', l);
  confere('a aba diz quantos estão em aberto', /\(2\)/.test(await texto(p, '.nav1 a[href="#/versoes/comentarios"]')), await texto(p, '.nav1'));
  await p.selectOption('#fb-st', 'todos'); await p.waitForTimeout(200);
  confere('"Todos" mostra o feito também', (await lista()).length === 3);
  await p.click('#fb-seg-tipo button:nth-child(2)'); await p.waitForTimeout(200);
  confere('o filtro de tipo deixa só os bugs', (await lista()).every(x => x.cod.startsWith('BUG')) && (await lista()).length === 2, await lista());
  await p.click('#fb-seg-tipo button:nth-child(1)'); await p.selectOption('#fb-st', 'abertos'); await p.waitForTimeout(200);
  await p.click('.fb-item:has(.fb-cod:text("BUG-1")) .fb-voto'); await p.waitForTimeout(400);
  l = await lista();
  confere('votar soma um e acende o botão', l.find(x => x.cod === 'BUG-1')?.votos === 3 && l.find(x => x.cod === 'BUG-1')?.on, l);
  confere('e o voto vai ao banco', JSON.stringify(await rpcs(p, 'feedback_votar')) === '[{"id":1,"voto":true}]', await rpcs(p, 'feedback_votar'));

  await p.click('.fb-item a.t:text("O quadro não abre no celular")'); await p.waitForTimeout(1000);
  const det = await p.evaluate(() => ({
    hash: location.hash, h1: document.querySelector('#main h1')?.textContent,
    lista: document.querySelectorAll('#rl-corpo-card .md ol li').length, negrito: document.querySelector('#rl-corpo-card .md strong')?.textContent,
    coms: document.querySelectorAll('.cd-coments .cm').length, tela: document.querySelector('.fb-det a[href="#/atividades/ORT"]')?.textContent,
    andamento: !!document.getElementById('rd-st'), votantes: document.querySelectorAll('.fb-det .kb-rostos .avx').length
  }));
  confere('o relato abre pelo número, com o texto em Markdown', det.hash === '#/versoes/comentarios/1' && det.lista === 2 && det.negrito === 'Atividades', det);
  confere('mostra a tela de onde veio, o comentário e quem votou', det.tela === '#/atividades/ORT' && det.coms === 1 && det.votantes === 3, det);
  confere('admin vê o andamento', det.andamento);
  await p.fill('#rl-com', 'Reproduzi no **Chrome** também.'); await p.click('#rl-com-btn'); await p.waitForTimeout(700);
  confere('comentar grava e aparece', (await rpcs(p, 'feedback_comentar'))[0]?.corpo === 'Reproduzi no **Chrome** também.'
    && await p.evaluate(() => document.querySelectorAll('.cd-coments .cm').length) === 2);
  await p.selectOption('#rd-st', 'feito'); await p.waitForTimeout(100);
  confere('"Feito" pede a versão', await p.isVisible('#rd-versao') && !(await p.isVisible('#rd-dup')));
  await p.fill('#rd-resp', 'Corrigido.'); await p.click('#rd-btn'); await p.waitForTimeout(800);
  const dec = (await rpcs(p, 'feedback_decidir'))[0];
  confere('registrar o andamento vai ao banco com a versão no ar', dec?.status === 'feito' && dec?.versao_feito === NO_AR && dec?.resposta === 'Corrigido.', dec);
  confere('e a página mostra a resposta', /Corrigido\./.test(await texto(p, '.fb-resposta')) && new RegExp('Feito na ' + NO_AR_RE).test(await texto(p, '.fb-resposta .quem')), await texto(p, '.fb-resposta'));

  /* relatar, vindo de uma tela */
  await ir(p, '#/agenda', 900);
  await ir(p, '#/versoes/comentarios/sugestao', 900);
  const form = await p.evaluate(() => ({ tela: document.getElementById('rl-tela')?.value,
    tipo: document.querySelector('#rl-tipo button.on')?.textContent.trim(), vai: document.querySelector('#main .card .small.muted')?.textContent }));
  confere('relatar leva a tela de onde se veio e o tipo do endereço', form.tela === '#/agenda' && form.tipo === 'Sugestão', form);
  confere('e diz o que vai junto (a versão e o aparelho)', new RegExp('SOMA ' + NO_AR_RE + ', Chrome').test(form.vai), form.vai);
  await p.fill('#rl-tit', 'Filtrar o quadro de atividades pela etiqueta'); await p.waitForTimeout(200);
  confere('um título parecido mostra o relato que já existe', /SUG-2/.test(await texto(p, '#rl-parecidos') || ''), await texto(p, '#rl-parecidos'));
  await p.click('#rl-tipo button:nth-child(1)');
  await p.fill('#rl-tit', 'O zoom dos OKRs pula'); await p.fill('#rl-corpo', 'Com o trackpad.');
  await p.click('#rl-btn'); await p.waitForTimeout(1000);
  const novo = (await rpcs(p, 'feedback_salvar')).at(-1);
  confere('enviar grava tipo, versão, tela e aparelho', novo?.tipo === 'bug' && novo?.versao === NO_AR && novo?.tela === '#/agenda' && /Chrome/.test(novo?.aparelho), novo);
  confere('e abre o relato novo', await hash(p) === '#/versoes/comentarios/4' && await texto(p, '#main h1') === 'O zoom dos OKRs pula', await hash(p));
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}
{
  /* quem não é admin não decide, e só edita o próprio relato aberto */
  const { ctx, p, erros } = await abrir({ stub: stubDe('leitura'), hash:'#/versoes/comentarios/2' });
  await p.waitForTimeout(600);
  const v = await p.evaluate(() => ({ andamento: !!document.getElementById('rd-st'), editar: [...document.querySelectorAll('.acoes .btn')].map(b => b.textContent.trim()) }));
  confere('leitura: sem o andamento e sem editar o relato dos outros', !v.andamento && !v.editar.some(t => /Editar|Excluir/.test(t)), v);
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

/* ================= A FOTO ================= */
console.log('\nA foto enviada pelo portal');
{
  const { ctx, p, erros } = await abrir();
  await p.waitForSelector('#pend-foto', { timeout:12000 }).catch(() => {});
  confere('o início avisa quem ainda não tem foto', /Você ainda não tem foto/.test(await texto(p, '#pend-foto') || ''), await texto(p, '#sec-pend'));
  await p.click('#pend-foto'); await p.waitForTimeout(300);
  confere('o aviso abre o envio', await texto(p, '#modal h3') === 'Sua foto' && !(await p.isEnabled('#fto-salvar')));
  const png = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 640; c.height = 420;
    const x = c.getContext('2d'); x.fillStyle = '#00594F'; x.fillRect(0, 0, 640, 420); x.fillStyle = '#CEDC00'; x.beginPath(); x.arc(420, 210, 120, 0, 7); x.fill();
    return c.toDataURL('image/png').split(',')[1]; }), 'base64');
  await p.setInputFiles('#fto-arq', { name:'eu.png', mimeType:'image/png', buffer:png }); await p.waitForTimeout(500);
  const ed = await p.evaluate(() => ({ cv: !document.getElementById('fto-cv').hidden, zoom: !document.getElementById('fto-zoom-fld').hidden,
    salvar: !document.getElementById('fto-salvar').disabled, x: fotoEd.x }));
  confere('a imagem entra no enquadramento, com zoom, centrada', ed.cv && ed.zoom && ed.salvar && ed.x < 0, ed);
  const box = await p.locator('#fto-cv').boundingBox();
  await p.mouse.move(box.x + 110, box.y + 110); await p.mouse.down(); await p.mouse.move(box.x + 40, box.y + 110, { steps:4 }); await p.mouse.up();
  const x2 = await p.evaluate(() => fotoEd.x);
  confere('arrastar move o enquadramento', x2 < ed.x, [ed.x, x2]);
  await p.fill('#fto-zoom', '2'); await p.dispatchEvent('#fto-zoom', 'input');
  confere('a barra dá zoom', await p.evaluate(() => fotoEd.k) === 2);
  await p.click('#fto-salvar'); await p.waitForTimeout(900);
  const up = await p.evaluate(() => (window.__uploads || []).filter(u => u.bucket === 'fotos'));
  confere('a foto sobe para o bucket, na pasta do registro, em JPEG', up.length === 1 && /^4\/\d+\.jpg$/.test(up[0].caminho) && up[0].op?.contentType === 'image/jpeg', up);
  const def = (await rpcs(p, 'membro_foto_definir'))[0];
  confere('e a ficha grava o caminho', def?.registro === 4 && def?.caminho === up[0]?.caminho, def);
  await p.waitForTimeout(800);
  const depois = await p.evaluate(() => ({ menu: !!document.querySelector('#lt-avatar img'), aviso: !!document.getElementById('pend-foto'),
    fechado: !document.getElementById('modal').classList.contains('open') }));
  confere('a foto aparece no menu, o modal fecha e o aviso some', depois.menu && !depois.aviso && depois.fechado, depois);

  await ir(p, '#/equipe/11', 1200);
  confere('na ficha de outra pessoa, admin tem a câmera', await p.locator('.ficha-foto .foto-bt').count() === 1);
  await p.click('.ficha-foto .foto-bt'); await p.waitForTimeout(300);
  confere('e ela abre o envio da foto dessa pessoa', /Bruno Tavares/.test(await texto(p, '#modal h3')), await texto(p, '#modal h3'));
  await p.click('#modal .btn.ghost:text("Cancelar")');
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ stub: stubDe('leitura'), hash:'#/equipe/11' });
  await p.waitForTimeout(700);
  confere('leitura: a ficha é da gestão, e o endereço volta ao organograma', await hash(p) === '#/equipe', await hash(p));
  confere('no organograma, a câmera no próprio cartão', await p.locator('.org-focus .ficha-foto .foto-bt').count() === 1);
  await p.evaluate(() => focarOrg(11)); await p.waitForTimeout(300);
  confere('e não no cartão de outra pessoa', await p.locator('.org-focus .ficha-foto .foto-bt').count() === 0);
  confere('e a foto está em Sua conta, no rodapé', await p.isVisible('#ft-foto'));
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

/* ================= OKRs ================= */
console.log('\nOKRs: cartões maiores e a roda que dá zoom');
{
  const { ctx, p, erros } = await abrir({ hash:'#/okrs' });
  await p.waitForTimeout(600);
  const longo = 'Consolidar a equipe de pesquisa com vinte membros ativos, dois laboratórios parceiros e um processo seletivo por semestre';
  const m = await p.evaluate(t => {
    OKR.itens.find(o => o.id === 'k2').titulo = t; okrDesenharTela();
    const nos = [...document.querySelectorAll('#okr-mundo .okr-no')];
    const nm = document.querySelector('.okr-no[data-id="k2"] .nm');
    return { cortado: nm.scrollHeight > nm.clientHeight + 1, largura: nos[0].offsetWidth,
      alturas: nos.map(n => n.offsetHeight), topos: nos.map(n => n.style.top), linhas: getComputedStyle(nm).webkitLineClamp };
  }, longo);
  confere('o título longo aparece inteiro', !m.cortado && m.linhas === 'none', m);
  confere('o cartão ficou mais largo e mais alto', m.largura === 320 && Math.max(...m.alturas) > 172, m);
  confere('os cartões da mesma linha têm a mesma altura', new Set(m.alturas).size === 1 && new Set(m.topos).size === 1, m);
  const pct = () => p.evaluate(() => parseInt(document.getElementById('okr-pct').textContent));
  const tela = await p.locator('#okr-tela').boundingBox();
  const z0 = await pct(), t0 = await p.evaluate(() => document.getElementById('okr-mundo').style.transform);
  await p.mouse.move(tela.x + tela.width / 2, tela.y + tela.height / 2);
  await p.mouse.wheel(0, -200); await p.waitForTimeout(200);
  const z1 = await pct();
  confere('a roda sozinha dá zoom (para mais perto)', z1 > z0, [z0, z1]);
  await p.mouse.wheel(0, 300); await p.waitForTimeout(200);
  confere('e para longe', await pct() < z1, [z1, await pct()]);
  const zAntes = await pct();
  await p.keyboard.down('Shift'); await p.mouse.wheel(0, 200); await p.keyboard.up('Shift'); await p.waitForTimeout(200);
  const t1 = await p.evaluate(() => document.getElementById('okr-mundo').style.transform);
  confere('Shift e a roda movem, sem mudar o zoom', await pct() === zAntes && t1 !== t0, [zAntes, await pct()]);
  const fios = await p.evaluate(() => { OKR.abertos.add('k1'); okrDesenharTela();
    const f = document.querySelector('.okr-fios path')?.getAttribute('d') || '';
    const pai = document.querySelector('.okr-no[data-id="k1"]');
    return { d: f, base: parseFloat(pai.style.top) + pai.offsetHeight }; });
  confere('o fio sai do pé do cartão pai, qualquer que seja a altura', fios.d.startsWith(`M${160},${fios.base} `) || fios.d.includes(`,${fios.base} `), fios);
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

/* ================= OS CARTÕES ================= */
console.log('\nAtividades: os cartões mais completos');
{
  const { ctx, p, erros } = await abrir({ hash:'#/atividades/ORT' });
  await p.waitForSelector('.kb-card');
  const c1 = await p.evaluate(() => { const c = [...document.querySelectorAll('.kb-card')].find(x => x.querySelector('.cod').textContent === 'ORT-1');
    return { ets: [...c.querySelectorAll('.kb-ets .et')].map(e => e.textContent), rostos: c.querySelectorAll('.kb-rostos .avx').length,
      ck: c.querySelector('.kb-meta .ck')?.textContent.trim(), cores: [...c.querySelectorAll('.kb-ets .et')].map(e => e.style.getPropertyValue('--et')) }; });
  confere('o cartão mostra as etiquetas, cada uma com cor', c1.ets.join() === 'Firmware,Bancada 2' && c1.cores.every(Boolean) && c1.cores[0] !== c1.cores[1], c1);
  confere('as duas pessoas (responsável e incluída) e a checklist 1/3', c1.rostos === 2 && c1.ck === '1/3', c1);
  confere('o quadro filtra por etiqueta', await p.locator('.kb-filtros .et-f select').count() === 1);
  await p.selectOption('.kb-filtros .et-f select', 'Bancada 2'); await p.waitForTimeout(200);
  confere('só o que tem a etiqueta', (await p.evaluate(() => [...document.querySelectorAll('.kb-card .cod')].map(x => x.textContent))).join() === 'ORT-1');
  await p.selectOption('.kb-filtros .et-f select', ''); await p.waitForTimeout(100);
  await p.fill('.kb-filtros input', 'firmware'); await p.waitForTimeout(200);
  confere('a busca acha pela etiqueta', (await p.evaluate(() => [...document.querySelectorAll('.kb-card .cod')].map(x => x.textContent))).sort().join() === 'ORT-1,ORT-2');
  await p.fill('.kb-filtros input', ''); await p.waitForTimeout(100);

  await ir(p, '#/atividades/card/ORT-1', 1200);
  const card = await p.evaluate(() => ({
    negrito: document.querySelector('#cd-desc strong')?.textContent,
    tarefas: [...document.querySelectorAll('#cd-desc li.tarefa')].map(l => l.className),
    pessoas: [...document.querySelectorAll('#cd-pessoas .pessoa-chip .nm')].map(x => x.textContent),
    ets: [...document.querySelectorAll('#cd-etiquetas .et')].map(x => x.dataset.et),
    itens: document.querySelectorAll('#ck-corpo .ck-item').length, conta: document.querySelector('.ck-topo .n')?.textContent,
    link: document.querySelector('#ck-corpo .ck-item a.md-cod')?.getAttribute('href'),
    marcou: document.querySelector('#cm-c1 .cm-marcou')?.textContent.replace(/\s+/g, ' ').trim()
  }));
  confere('a descrição se lê em Markdown, com as tarefas', card.negrito === 'multímetro' && card.tarefas.join() === 'tarefa feita,tarefa', card);
  confere('as outras pessoas e as etiquetas no cartão', card.pessoas.join() === 'Ana Figueiredo' && card.ets.join() === 'Firmware,Bancada 2', card);
  confere('a checklist com a conta, e o código no item vira link', card.itens === 3 && card.conta === '1/3' && card.link === '#/arquivos/NRO-PES-007', card);
  confere('a menção antiga (sem @ no texto) aparece como "Marcou"', card.marcou === 'Marcou: @Bruno Tavares', card.marcou);

  /* a checklist */
  await p.click('#ck-corpo .ck-item:nth-child(2) input[type=checkbox]'); await p.waitForTimeout(500);
  confere('marcar um item grava e soma', JSON.stringify((await rpcs(p, 'atividade_checklist')).at(-1)) === '{"acao":"item_marcar","item_id":"ci2","feito":true}'
    && await texto(p, '.ck-topo .n') === '2/3', await texto(p, '.ck-topo .n'));
  await p.fill('#ck-corpo textarea.ck-in', '- [x] Pedir o cabo\n- [ ] Trocar o conector');
  await p.press('#ck-corpo textarea.ck-in', 'Enter'); await p.waitForTimeout(700);
  confere('colar uma lista cria um item por linha, com o marcado', await texto(p, '.ck-topo .n') === '3/5'
    && await p.evaluate(() => document.querySelectorAll('#ck-corpo .ck-item').length) === 5, await texto(p, '.ck-topo .n'));
  await p.click('#cd-checks .head .btn'); await p.waitForTimeout(300);
  await p.fill('#ckn-tit', 'Depois de ligar'); await p.fill('#ckn-itens', 'Anotar a leitura'); await p.click('#ckn-btn'); await p.waitForTimeout(800);
  confere('uma checklist nova, com o título e o item', (await p.evaluate(() => [...document.querySelectorAll('.ck-topo h4')].map(h => h.textContent))).join() === 'Antes de ligar,Depois de ligar');

  /* as pessoas e as etiquetas, pelo seletor */
  await p.click('#cd-add-pessoa'); await p.waitForTimeout(200);
  await p.fill('#sel-q', 'carla'); await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  const pes = (await rpcs(p, 'atividade_editar')).at(-1);
  confere('o seletor inclui a Carla', JSON.stringify(pes?.pessoas) === '[4,17]', pes);
  await p.mouse.click(1300, 120); await p.waitForTimeout(1000);
  confere('ao fechar, o cartão volta com ela', (await p.evaluate(() => [...document.querySelectorAll('#cd-pessoas .pessoa-chip .nm')].map(x => x.textContent))).join() === 'Ana Figueiredo,Carla Mendonça');
  await p.click('#cd-add-etiqueta'); await p.waitForTimeout(200);
  const opcoes = await p.evaluate(() => [...document.querySelectorAll('.sel-op .nm')].map(x => x.textContent));
  confere('as etiquetas do quadro são as opções', opcoes.includes('Firmware') && opcoes.includes('Bancada 2'), opcoes);
  await p.fill('#sel-q', 'Urgente'); await p.waitForTimeout(150);
  confere('o que não existe se cria', await p.locator('.sel-op:has-text("Criar \\"Urgente\\"")').count() === 1);
  await p.keyboard.press('Enter'); await p.waitForTimeout(500);
  confere('e entra no cartão', JSON.stringify((await rpcs(p, 'atividade_editar')).at(-1)?.etiquetas) === '["Firmware","Bancada 2","Urgente"]');
  await p.keyboard.press('Escape'); await p.waitForTimeout(1000);

  /* a descrição */
  await p.click('#cd-desc p'); await p.waitForTimeout(200);
  confere('editar a descrição tem a barra de formatação', await p.locator('#cd-desc .md-barra .md-bt').count() >= 6);
  await p.fill('#cd-desc-in', 'Trocar o **conector** e ver ORT-2.');
  await p.click('#cd-desc-alt'); await p.waitForTimeout(100);
  confere('"Ver" mostra o texto desenhado, com o código como link', await p.evaluate(() => document.querySelector('#cd-desc-ver strong')?.textContent === 'conector'
    && document.querySelector('#cd-desc-ver a.md-cod')?.getAttribute('href') === '#/atividades/card/ORT-2'));
  await p.click('#cd-desc .btn.solid'); await p.waitForTimeout(900);
  confere('salvar grava o Markdown', (await rpcs(p, 'atividade_editar')).at(-1)?.descricao === 'Trocar o **conector** e ver ORT-2.');

  /* campos do cartão: salvam sem redesenhar, e o de texto espera ~1,5 s */
  await p.evaluate(() => { const i = document.querySelector('.cd-campos input[type=number]'); i.dataset.marca = '1'; i.focus(); });
  await p.keyboard.type('7');
  const nAntes = (await rpcs(p, 'atividade_editar')).length;
  await p.waitForTimeout(600);
  confere('o texto não salva a cada tecla', (await rpcs(p, 'atividade_editar')).length === nAntes);
  await p.waitForTimeout(1500);
  confere('salva ~1,5 s após a última tecla, sem trocar o campo nem tirar o foco', (await rpcs(p, 'atividade_editar')).at(-1)?.estimativa_h === '74'
    && await p.evaluate(() => document.activeElement?.dataset.marca === '1'));
  await p.selectOption('.cd-campos select >> nth=2', { index: 0 }); await p.waitForTimeout(500);
  confere('o campo de escolha salva na hora e continua o mesmo', await p.evaluate(() => document.querySelector('.cd-campos input[type=number]')?.dataset.marca === '1'));

  /* o @ */
  await p.click('#cd-coment'); await p.keyboard.type('Pode ver isso, @bru');
  await p.waitForSelector('.menc-pop', { timeout:3000 }).catch(() => {});
  const pop = await p.evaluate(() => ({ nomes: [...document.querySelectorAll('.menc-pop .menc-op .nm')].map(x => x.textContent),
    perto: (() => { const a = document.querySelector('.menc-pop')?.getBoundingClientRect(), t = document.getElementById('cd-coment').getBoundingClientRect();
      return a ? a.top >= t.top && a.top <= t.bottom + 30 : false; })() }));
  confere('digitar @ abre a lista, filtrada, perto do cursor', pop.nomes.join() === 'Bruno Tavares' && pop.perto, pop);
  await p.keyboard.press('Enter');
  confere('Enter põe o nome no texto', await p.inputValue('#cd-coment') === 'Pode ver isso, @Bruno Tavares ');
  await p.keyboard.type('e a @Carla Mendonça?'); await p.keyboard.press('Escape');
  await p.click('#cd-btn'); await p.waitForTimeout(900);
  const marcados = await p.evaluate(() => window.__comentario?.mencionados);
  confere('comentar manda quem foi marcado', JSON.stringify(marcados) === '[11,17]', marcados);
  const mencs = await p.evaluate(() => [...document.querySelectorAll('.cd-coments .cm:last-child .cm-cp a.mencao')].map(a => [a.textContent, a.getAttribute('href')]));
  confere('e o comentário mostra as menções destacadas, com link', JSON.stringify(mencs) === '[["@Bruno Tavares","#/equipe/11"],["@Carla Mendonça","#/equipe/17"]]', mencs);

  /* corrigir o próprio comentário */
  await p.click('.cd-coments .cm:last-child .cm-acs button:text("Editar")'); await p.waitForTimeout(200);
  await p.fill('.cd-coments textarea', 'Pode ver isso, @Carla Mendonça?');
  await p.click('.cd-coments .btn.solid'); await p.waitForTimeout(900);
  const ed = (await rpcs(p, 'atividade_comentario_editar'))[0];
  confere('corrigir o comentário grava o texto e as menções novas', ed?.corpo === 'Pode ver isso, @Carla Mendonça?' && JSON.stringify(ed?.mencionados) === '[17]', ed);
  confere('e ele fica marcado como editado', /editado/.test(await texto(p, '.cd-coments .cm:last-child .cm-tp')));

  /* espelhar em outro quadro (2.18.0): o mesmo cartão nos dois */
  await p.click('.acts .btn:has-text("Espelhar ou mover")'); await p.waitForTimeout(300);
  const destinos = await p.evaluate(() => [...document.querySelectorAll('#cp-grupo option')].map(o => o.textContent.trim()));
  confere('o destino é um quadro que você edita, fora os do cartão', destinos.join() === 'DEP Depto de Pessoal', destinos);
  await p.selectOption('#cp-grupo', '3');
  await p.click('#cp-btn'); await p.waitForTimeout(1500);
  const es = (await rpcs(p, 'atividade_espelhar'))[0];
  confere('espelhar é a opção padrão e manda o cartão e o quadro', es?.grupo_id === 3 && !!es?.id && !(await rpcs(p, 'atividade_mover')).length, es);
  const qds = await p.evaluate(() => [...document.querySelectorAll('#cd-quadros .cd-quadro')].map(x => x.textContent.replace(/\s+/g, ' ').trim()));
  confere('o cartão mostra os quadros, o dono primeiro', qds.length === 2 && /ORT Órtese, dono/.test(qds[0]) && /DEP Depto de Pessoal/.test(qds[1]), qds);
  await ir(p, '#/atividades/DEP', 1100);
  confere('e aparece no quadro do espelho, marcado', await p.locator('.kb-card:has(.cod:text("ORT-1")) .kb-esp').count() === 1);
  await ir(p, '#/atividades/card/ORT-1', 1100);
  await p.click('#cd-quadros .cd-quadro .x'); await p.waitForTimeout(300);
  await p.click('#modal .btn.solid'); await p.waitForTimeout(1200);
  const tira = (await rpcs(p, 'atividade_espelho_remover'))[0];
  confere('tirar o espelho manda o quadro', tira?.grupo_id === 3 && await p.locator('#cd-quadros').count() === 0, tira);

  /* mover: o cartão passa para o outro quadro e este fica arquivado */
  await p.click('.acts .btn:has-text("Espelhar ou mover")'); await p.waitForTimeout(300);
  await p.selectOption('#cp-grupo', '3'); await p.check('#cp-modo-mover');
  await p.click('#cp-btn'); await p.waitForTimeout(1500);
  const mv = (await rpcs(p, 'atividade_mover'))[0];
  confere('mover manda o destino', mv?.grupo_id === 3, mv);
  confere('e abre o cartão novo, que diz de onde veio', await hash(p) === '#/atividades/card/DEP-2' && /Cópia de ORT-1/.test(await texto(p, '.cd-copia') || ''), [await hash(p), await texto(p, '.cd-copia')]);

  /* os arquivados */
  await ir(p, '#/atividades/ORT/arquivadas', 1100);
  const arq = await p.evaluate(() => [...document.querySelectorAll('.arq-lista .arq .cod')].map(x => x.textContent));
  confere('o ORT-1 (movido, arquivado) e o ORT-4 estão nos arquivados', arq.sort().join() === 'ORT-1,ORT-4', arq);
  await p.click('.arq:has(.cod:text("ORT-4")) .btn'); await p.waitForTimeout(900);
  confere('restaurar devolve ao quadro', JSON.stringify((await rpcs(p, 'atividade_editar')).at(-1)) === '{"id":"t5","arquivada":false}'
    && !(await p.evaluate(() => [...document.querySelectorAll('.arq-lista .arq .cod')].map(x => x.textContent))).includes('ORT-4'));
  await ir(p, '#/atividades/card/ORT-1', 1100);
  confere('o cartão arquivado abre pelo código, com o aviso e o restaurar', /Arquivada/.test(await texto(p, '.aviso-box.warn') || '')
    && await p.locator('.aviso-box.warn .btn:text("Restaurar")').count() === 1);

  /* atividade nova com pessoas e etiquetas */
  await ir(p, '#/atividades/ORT', 1000);
  await p.click('.kb-acoes .btn.solid'); await p.waitForTimeout(300);
  await p.fill('#na-tit', 'Montar o suporte novo');
  await p.check('.na-pes[value="17"]');
  await p.click('#modal .et[data-et="Firmware"]');
  await p.fill('#na-ets-in', 'firmware'); await p.press('#na-ets-in', 'Enter');
  await p.fill('#na-ets-in', 'Mecânica'); await p.press('#na-ets-in', 'Enter');
  confere('as etiquetas entram como pills, sem repetir a do quadro', (await p.evaluate(() =>
    [...document.querySelectorAll('#na-ets-lista .pill-ed')].map(x => x.firstChild.textContent))).join() === 'Firmware,Mecânica');
  await p.click('#na-btn'); await p.waitForTimeout(900);
  const cr = (await rpcs(p, 'atividade_criar')).at(-1);
  confere('a atividade nova vai com as outras pessoas e as etiquetas', JSON.stringify(cr?.pessoas) === '[17]' && JSON.stringify(cr?.etiquetas) === '["Firmware","Mecânica"]', cr);
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}
{
  /* quem só lê o quadro vê tudo, sem os controles */
  const { ctx, p, erros } = await abrir({ hash:'#/atividades/card/SIN-1' });
  await p.waitForTimeout(700);
  const v = await p.evaluate(() => ({ addPessoa: !!document.getElementById('cd-add-pessoa'), addEt: !!document.getElementById('cd-add-etiqueta'),
    novaCk: !!document.querySelector('#cd-checks .head .btn'), arquivar: [...document.querySelectorAll('.acts .btn')].some(b => /Arquivar/.test(b.textContent)) }));
  confere('no quadro que só lê: sem pôr pessoa, etiqueta, checklist ou arquivar', !v.addPessoa && !v.addEt && !v.novaCk && !v.arquivar, v);
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

/* ================= NO CELULAR ================= */
console.log('\nNo celular');
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/atividades/card/ORT-1' });
  await p.waitForTimeout(900);
  confere('o cartão aberto sem rolagem lateral', await semRolagemLateral(p));
  await ir(p, '#/versoes', 900);
  confere('as notas de versão sem rolagem lateral', await semRolagemLateral(p));
  await ir(p, '#/versoes/comentarios/1', 1100);
  confere('o relato sem rolagem lateral', await semRolagemLateral(p));
  await ir(p, '#/versoes/comentarios/bug', 900);
  confere('o formulário do relato sem rolagem lateral', await semRolagemLateral(p));
  await ir(p, '#/', 900);
  await p.evaluate(() => modalFoto(4)); await p.waitForTimeout(300);
  confere('o envio da foto cabe na tela', await semRolagemLateral(p) && await p.evaluate(() => document.getElementById('modal').getBoundingClientRect().right <= innerWidth));
  confere('sem erro de página', !erros.length, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
