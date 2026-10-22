/* O modo restrito (2.22.0): a conta de Desligado e Egresso entra no
   portal. Confere, com asserção (sai com código 1 se algo falhar):
     1. a egressa: a casca abre com "Modo restrito", o menu só com o
        Aproveitamento de AACC e o feed; o início com o quadro de avisos,
        o calendário da equipe (só para ler, sem a Agenda), as publicações
        do site e os links úteis, e o vidro sobre o placar, as tarefas e os
        abertos por último; nenhuma tabela é lida; a busca, o sino e o
        rodapé vivo não aparecem; as outras telas voltam ao início;
     2. o Aproveitamento de AACC: a ficha sem a data de saída e o pedido
        de correção, que sai pela função do modo restrito, uma vez; e o
        feed só com o que está no site;
     3. no celular, sem rolagem horizontal;
     4. a conta Sob demanda (inicio_restrito diz nao_restrita) continua
        com "Acesso encerrado.";
     5. a conta ativa não vê vidro nenhum.
   Rode com o portal servido da raiz: python3 -m http.server 8765
   CAPTURAS=pasta grava as telas do início (escuro, claro e celular). */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const STUB = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8') + '\n' + readFileSync(new URL('./stub-aacc.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });
const CAPTURAS = process.env.CAPTURAS || '';

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
const AVISO = { id:'av1', titulo:'Inscrições abertas para o Cybathlon', corpo:'Até sexta.', layout:'padrao', publicado:true, ordem:1 };
const RESTRITA = { restrita:{ status:'Egresso', avisos:[AVISO] } };
async function abrir({ hash = '#/', teste = RESTRITA, casca = true, largura = 1440, altura = 960, tema } = {}){
  const ctx = await nav.newContext({ viewport:{ width:largura, height:altura } });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:STUB }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(([t, tm]) => { window.__teste = t || {};
    try { localStorage.setItem('nd.menu', 'aberto'); if (tm) localStorage.setItem('nd.tema', tm); } catch(e){} }, [teste, tema]);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  if (casca) await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1200);
  return { ctx, p, erros };
}
const ir = async (p, hash, espera = 900) => { await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const chamadas = p => p.evaluate(() => window.__chamadas || []);
const visivel = (p, s) => p.evaluate(s => { const e = document.querySelector(s); if (!e) return false;
  const c = getComputedStyle(e); return !e.hidden && c.display !== 'none' && c.visibility !== 'hidden' && e.getClientRects().length > 0; }, s);

/* ---------- 1: a egressa no início ---------- */
console.log('O início do modo restrito');
{
  const { ctx, p, erros } = await abrir();
  confere('a casca abre, com o nome e "Modo restrito"', (await p.textContent('#u-nome')).trim() === 'Kátia Dias'
    && (await p.textContent('#u-papel')).trim() === 'Modo restrito');
  confere('o corpo da página marca o modo', await p.evaluate(() => document.body.classList.contains('modo-restrito')));
  const menu = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec')].map(s => [s.dataset.r,
    [...s.querySelectorAll('.lt-filho .nm')].map(x => x.textContent.trim())]));
  confere('o menu é só Serviços, com o aproveitamento e o feed',
    JSON.stringify(menu) === JSON.stringify([['servicos', ['Aproveitamento de AACC', 'Feed da equipe']]]), menu);
  confere('a faixa do alto explica e leva ao aproveitamento', await visivel(p, '#pend-restrito')
    && (await p.getAttribute('#pend-restrito', 'href')) === '#/servicos/aproveitamento'
    && /modo restrito/.test(await p.textContent('#pend-restrito')));
  confere('o quadro de avisos aparece', /Inscrições abertas para o Cybathlon/.test(await p.textContent('#sec-board')));
  const vidros = await p.evaluate(() => [...document.querySelectorAll('.ini-vidro')].map(c => [c.id,
    c.querySelector('.head h3')?.textContent.trim(), c.querySelector('.vidro')?.textContent.trim()]));
  confere('o vidro está sobre o placar, as tarefas e os abertos por último', JSON.stringify(vidros) === JSON.stringify([
    ['card-placar', 'Placar do LABBIO', 'Só para quem está na equipe'], ['card-tarefas', 'Suas tarefas', 'Só para quem está na equipe'],
    ['card-recentes', 'Abertos por último', 'Só para quem está na equipe']]), vidros);
  const vidro = await p.evaluate(() => { const v = document.querySelector('#card-placar .vidro'), r = v.getBoundingClientRect(),
    c = v.closest('.card').getBoundingClientRect(), b = getComputedStyle(v);
    return { cobre: r.left <= c.left + 1 && r.right >= c.right - 1 && r.bottom >= c.bottom - 1, fosco: /blur/.test(b.backdropFilter || b.webkitBackdropFilter || ''),
      titulo: document.querySelector('#card-placar .head').getBoundingClientRect().top >= c.top }; });
  confere('o vidro cobre o card, fosco, e o título fica legível', vidro.cobre && vidro.fosco && vidro.titulo, vidro);
  confere('embaixo do vidro, só a forma do widget (nada do banco)', await p.evaluate(() =>
    [...document.querySelectorAll('.ini-vidro')].every(c => c.querySelector('.vidro-forma[aria-hidden="true"]') && !c.querySelector('a, .avx, li'))));
  const feed = await p.evaluate(() => [...document.querySelectorAll('#card-feed .feed-ini-i .tt')].map(x => x.textContent.trim()));
  confere('as publicações do site, e só elas', feed.length >= 1 && feed.includes('Órtese passa no teste de bancada') && !feed.includes('Seminário na sexta'), feed);
  const links = await p.evaluate(() => [...document.querySelectorAll('#card-links .ini-lk b')].map(x => x.textContent.trim()));
  confere('os links úteis, sem o endereço perigoso nem o atalho do portal que essa conta não abre',
    JSON.stringify(links) === JSON.stringify(['Drive da equipe', 'Site institucional']), links);
  confere('sem o lápis de editar os links', await p.locator('#card-links .ini-cfg').count() === 0);
  const sem = await p.evaluate(() => ({ titulos: inicio.itens.map(i => i.titulo), camadas: [...new Set(inicio.itens.map(i => i.camada))],
    links: document.querySelectorAll('#card-semana a').length, dias: document.querySelectorAll('#card-semana .ini-dh').length }));
  confere('o calendário da equipe: os eventos abertos e os marcos', sem.titulos.includes('Reunião geral') && sem.titulos.includes('Prazo UFMG: trancamento parcial')
    && !sem.titulos.includes('Revisão da órtese') && sem.camadas.every(c => ['eventos', 'marcos'].includes(c)), sem);
  confere('só para ler: nenhum link para a Agenda', sem.links === 0 && sem.dias === 7, sem);
  confere('o calendário ainda anda de semana', await p.locator('#card-semana button[aria-label="Próxima semana"]').count() === 1);
  confere('nenhuma tabela lida', JSON.stringify(await p.evaluate(() => window.__tabelas || [])) === '[]', await p.evaluate(() => window.__tabelas));
  const ch = await chamadas(p);
  confere('nem o que é de quem está na equipe', !['recadastro_estado', 'treinamentos_meus', 'labbio_placar', 'aacc_pendentes', 'feed_editor',
    'eventos_ext_pendentes', 'cofre_pendencias'].some(n => ch.includes(n)), ch);
  confere('a busca não aparece', !(await visivel(p, '#busca-abre')));
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  confere('nem abre pelo teclado', await p.evaluate(() => document.getElementById('paleta').hidden));
  confere('o sino não aparece', !(await visivel(p, '#sino')));
  confere('o rodapé sem a Ajuda, as preferências de avisos e o Google Agenda',
    await p.evaluate(() => [...document.querySelectorAll('#ft .so-equipe')].every(e => getComputedStyle(e).display === 'none'))
    && await p.locator('#ft .so-equipe').count() === 3 && await visivel(p, '#ft-tema'));
  confere('e a versão sem link para as notas', await p.evaluate(() => !document.getElementById('ft-ver').hasAttribute('href')));
  confere('a foto não se troca pelo menu', await p.evaluate(() => !document.getElementById('lt-avatar').classList.contains('lt-foto')));

  await ir(p, '#/equipe');
  confere('Equipe volta ao início', await p.evaluate(() => location.hash) === '#/' && await p.locator('#pend-restrito').count() === 1);
  await ir(p, '#/agenda/semana');
  confere('a Agenda também', await p.evaluate(() => location.hash) === '#/');
  await ir(p, '#/admin');
  confere('e a Administração', await p.evaluate(() => location.hash) === '#/');
  await ir(p, '#/servicos/declaracao');
  confere('e os outros serviços', await p.evaluate(() => location.hash) === '#/');
  await ir(p, '#/servicos');
  confere('Serviços leva ao aproveitamento', await p.evaluate(() => location.hash) === '#/servicos/aproveitamento');
  confere('o rodapé vivo não aparece fora do início', !(await visivel(p, '#ft-vivo')));
  if (CAPTURAS){ await ir(p, '#/', 1400); await p.screenshot({ path: join(CAPTURAS, 'restrito-escuro.png'), fullPage:true }); }
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 2: o aproveitamento e o feed ---------- */
console.log('\nO aproveitamento e o feed');
{
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/aproveitamento' });
  await p.waitForSelector('.aac-passos');
  confere('a página do aproveitamento abre', /Aproveitamento de AACC/.test(await p.textContent('#main h1')));
  confere('sem "Para aprovar" nem configurações', await p.locator('#main nav.nav1').count() === 0);
  confere('a ficha mostra a egressa sem a data de saída', /A data de saída da equipe não está na ficha/.test(await p.textContent('#main')));
  await p.click('button:has-text("Pedir a correção")');
  await p.waitForSelector('#aac-cor');
  confere('o pedido de correção abre aqui mesmo, sem sair da página', await p.evaluate(() => location.hash) === '#/servicos/aproveitamento'
    && /saída em branco/.test(await p.inputValue('#aac-cor')));
  await p.fill('#aac-cor', 'A minha saída foi em 20/12/2025.');
  await p.click('#modal button:has-text("Enviar o pedido")'); await p.waitForTimeout(400);
  const cor = await rpcs(p, 'aacc_pedir_correcao');
  confere('e sai pela função do modo restrito', cor.length === 1 && cor[0].p_texto === 'A minha saída foi em 20/12/2025.', cor);
  confere('com o protocolo no aviso', /SOL26-0042/.test(await p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))));
  await p.click('button:has-text("Pedir a correção")'); await p.waitForSelector('#aac-cor');
  await p.click('#modal button:has-text("Enviar o pedido")'); await p.waitForTimeout(400);
  confere('uma de cada vez', /Já há um pedido de correção aberto, o SOL26-0042/.test(await p.evaluate(() =>
    [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' '))));
  await p.evaluate(() => fechaModal());
  confere('a solicitação "outro" não foi chamada', (await rpcs(p, 'portal_abrir_solicitacao')).length === 0
    && !(await chamadas(p)).includes('portal_abrir_solicitacao'));

  await ir(p, '#/servicos/feed', 1400);
  const feed = await p.evaluate(() => [...document.querySelectorAll('#feed-lista article h2')].map(x => x.textContent.trim()));
  confere('o feed abre só com o que está no site', feed.length >= 1 && feed.every(t => t !== 'Seminário na sexta'), feed);
  confere('sem a mesa editorial nem o botão de ocultar', await p.locator('a:has-text("Mesa editorial")').count() === 0
    && await p.locator('#feed-lista button[aria-label="Ocultar publicação"], #feed-lista button[aria-label="Retirar publicação"]').count() === 0);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 3: no celular e no tema claro ---------- */
console.log('\nNo celular e no tema claro');
{
  const { ctx, p, erros } = await abrir({ largura:390, altura:844 });
  const larg = await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  confere('o início sem rolagem horizontal', larg[0] <= larg[1], larg);
  confere('os três vidros aparecem', await p.locator('.ini-vidro .vidro').count() === 3);
  confere('a busca do topo do celular não aparece', !(await visivel(p, '#busca-abre-m')));
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, 'restrito-celular.png'), fullPage:true });
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ tema:'claro' });
  const fundo = await p.evaluate(() => getComputedStyle(document.querySelector('#card-placar .vidro')).backgroundColor);
  confere('no tema claro, o vidro é claro', /255, 255, 255/.test(fundo), fundo);
  if (CAPTURAS) await p.screenshot({ path: join(CAPTURAS, 'restrito-claro.png'), fullPage:true });
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 4: Sob demanda ---------- */
console.log('\nSob demanda');
{
  const { ctx, p, erros } = await abrir({ teste:{ bloqueada:true }, casca:false });
  await p.waitForTimeout(600);
  confere('o portal não abre', await p.evaluate(() => document.getElementById('hd').hidden));
  confere('o login diz "Acesso encerrado."', (await p.textContent('#lgok-t')).trim() === 'Acesso encerrado.');
  confere('depois de perguntar pelo modo restrito', (await rpcs(p, 'inicio_restrito')).length === 1);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 5: a conta ativa ---------- */
console.log('\nA conta ativa');
{
  const { ctx, p, erros } = await abrir({ teste:{} });
  confere('não pergunta pelo modo restrito', (await rpcs(p, 'inicio_restrito')).length === 0);
  confere('nem vê vidro', await p.locator('.ini-vidro').count() === 0 && await p.locator('#pend-restrito').count() === 0);
  confere('e o início é o de sempre', await p.evaluate(() => !document.body.classList.contains('modo-restrito'))
    && await p.locator('#card-placar .head a[href="#/equipe/presenca"]').count() === 1);
  confere('com a Agenda no calendário', await p.locator('#card-semana a[href^="#/agenda"]').count() > 0);
  confere('o rodapé inteiro e a versão com link', await visivel(p, '#ft nav[aria-label="Ajuda"]')
    && await p.evaluate(() => document.getElementById('ft-ver').getAttribute('href') === '#/versoes'));
  confere('e os links do portal nos links úteis', (await p.evaluate(() => [...document.querySelectorAll('#card-links .ini-lk b')].map(x => x.textContent.trim()))).includes('Presença'));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
