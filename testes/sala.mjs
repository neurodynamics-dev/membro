/* 2.19.2: o tablet na porta da sala, redesenhado. Só as RPCs anônimas; a disponibilidade vem do servidor.
   - a tela inteira com a cor da situação (tons das famílias, não a paleta funcional) e a barra de luz;
   - "até" sempre com o dia; quem reservou; as reservas de hoje;
   - ocupar por 30 min, 1 h ou o resto do dia no botão do canto, com o QR que abre a sala no celular;
   - liberar a sala ocupada é arrastar até o fim; dois toques entram na tela inteira. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
// a ponte mantém o contrato do stub e permite simular perda de rede com page.route
const rede = `;(()=>{const criar=supabase.createClient;supabase.createClient=(...a)=>{window.__clienteOpcoes=a[2];const c=criar(...a),rpc=c.rpc.bind(c);c.rpc=async(n,p)=>{await fetch('https://rxzmkyjttzzpwtodqkve.supabase.co/rest/v1/rpc/'+n,{method:'POST',body:JSON.stringify(p)});const r=await rpc(n,p);if(n!=='sala_estado'){delete r.data.sala;delete r.data.rotulo;}return r;};return c;};})();`;
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' }), TOKEN = 'ab'.repeat(24);
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){ checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`); if (!ok) falhas++; }
async function abrir(estado = 'livre', viewport = { width:1280, height:800 }, token = TOKEN, extra = {}){
  const ctx = await nav.newContext({ viewport, timezoneId:'America/Sao_Paulo', hasTouch:true }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.install({ time:new Date('2026-10-11T13:30:00Z') });   // 10:30 em Belo Horizonte
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub + rede }));
  await p.route('**/rest/v1/rpc/sala_*', r => r.fulfill({ contentType:'application/json', headers:{ 'access-control-allow-origin':'*' }, body:'{}' }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.addInitScript(({ estado, token, extra }) => { window.__teste = { sala:{ token, estado, ate:'2026-10-11T15:00:00Z', ...extra } }; }, { estado, token:TOKEN, extra });
  await p.goto('http://localhost:8765/sala.html' + (token ? '?d=' + token : ''), { waitUntil:'domcontentloaded' });
  await p.waitForFunction(() => document.getElementById('sala-status').textContent !== 'Consultando');
  return { ctx, p, erros };
}
async function fechar({ ctx, p, erros }){
  confere('sem rolagem nas duas direções', await p.evaluate(() => document.documentElement.scrollHeight <= innerHeight && document.documentElement.scrollWidth <= innerWidth));
  confere('sem erro de página', !erros.length, erros); await ctx.close();
}
const atualiza = async p => { await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); };
const status = p => p.locator('#sala-status').innerText();
const estado = p => p.evaluate(() => document.body.dataset.estado);
async function arrastar(p, ate = 1){
  const bt = p.locator('.deslizar-bt'), caixa = p.locator('.deslizar');
  const b = await bt.boundingBox(), c = await caixa.boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
  for (let i = 1; i <= 8; i++) await p.mouse.move(b.x + b.width / 2 + (c.width - b.width) * ate * i / 8, b.y + b.height / 2);
  await p.mouse.up();
}

try {
  for (const viewport of [{ width:1280, height:800 }, { width:800, height:1280 }]){
    console.log(`Tablet ${viewport.width} × ${viewport.height}`);
    const t = await abrir('livre', viewport), { p } = t;
    confere('livre, com a cor da situação na tela inteira', await status(p) === 'Livre' && await estado(p) === 'livre'
      && await p.locator('.sala-fundo').evaluate(e => { const r = e.getBoundingClientRect(); return r.width >= innerWidth && r.height >= innerHeight; }));
    confere('"até" com o dia', await p.locator('#sala-ate').innerText() === 'até hoje, 14:00');
    confere('a barra de luz embaixo', await p.locator('.sala-luz').evaluate(e => e.getBoundingClientRect().bottom > innerHeight - 30 && getComputedStyle(e).position === 'fixed'));
    confere('as reservas de hoje, com quem reservou (inclusive a do LABBIO)', (await p.locator('#sala-hoje-lista').innerText()).includes('Ana Figueiredo')
      && (await p.locator('#sala-hoje-lista').innerText()).includes('Reserva do LABBIO, Prof. Helena'));
    confere('ocupar não fica na tela principal', await p.locator('.sala-opcao').first().isHidden() && await p.getByRole('button', { name:/Ocupar/ }).count() === 0);
    confere('não reutiliza sessão nem procura login', await p.evaluate(() => window.__clienteOpcoes.auth.persistSession === false && window.__clienteOpcoes.auth.detectSessionInUrl === false));
    confere('a marca LABBIO, sem fundo', await p.locator('img').count() === 0 && await p.getByRole('img', { name:'LABBIO' }).count() === 1);
    await p.getByRole('button', { name:'Opções da sala' }).click();
    confere('o canto abre as opções: 30 min, 1 hora e o resto do dia', await p.locator('#sala-opcoes').isVisible()
      && (await p.locator('.sala-opcao').allInnerTexts()).map(x => x.split('\n')[0]).join('|') === '30 min|1 hora|Resto do dia');
    confere('cada opção diz até quando (e que para antes da reserva)', (await p.locator('.sala-opcao').nth(2).innerText()).includes('até 14:00, antes da reserva'));
    confere('o QR abre a sala no celular, sem o token', await p.locator('#sala-qr').getAttribute('data-url') === 'https://membro.neurodynamics.dev/#/sala/2'
      && !(await p.locator('#sala-qr').innerHTML()).includes(TOKEN));
    await p.keyboard.press('Escape');
    confere('Esc fecha', await p.locator('#sala-opcoes').isHidden() && await p.locator('#sala-veu').isHidden());
    await p.getByRole('button', { name:'Reservar ou liberar pelo celular' }).click();
    confere('o atalho do celular também abre as opções', await p.locator('#sala-qr svg').isVisible());
    await p.getByRole('button', { name:'Fechar' }).click();

    await p.getByRole('button', { name:'Opções da sala' }).click(); await p.locator('.sala-opcao[data-min="60"]').click();
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Ocupada');
    confere('ocupar por 1 hora envia 60 e o token', await p.evaluate(t => window.__rpcs.some(x => x.nome === 'sala_ocupar' && x.p.p_minutos === 60 && x.p.p_token === t), TOKEN));
    confere('ocupada: até quando, na porta, e a cor muda', await p.locator('#sala-ate').innerText() === 'até hoje, 11:30'
      && await p.locator('#sala-ocupada-quem').innerText() === 'Ocupada aqui na porta, sem reserva' && await estado(p) === 'ocupada');
    confere('o nome da sala continua', await p.locator('#sala-nome').innerText() === 'Auditório');
    await arrastar(p, .4);
    await p.waitForTimeout(400);
    confere('arrastar só um pedaço não libera', await status(p) === 'Ocupada' && !(await p.evaluate(() => window.__rpcs.some(x => x.nome === 'sala_liberar'))));
    await arrastar(p, 1);
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Livre');
    confere('arrastar até o fim libera', await p.evaluate(() => window.__rpcs.some(x => x.nome === 'sala_liberar')) && await p.locator('#sala-mensagem').innerText() === 'Sala liberada.');
    await p.getByRole('button', { name:'Opções da sala' }).click(); await p.locator('.sala-opcao[data-min="1440"]').click();
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Ocupada');
    confere('o resto do dia para antes da próxima reserva', await p.evaluate(() => window.__rpcs.filter(x => x.nome === 'sala_ocupar').at(-1).p.p_minutos === 1440)
      && await p.locator('#sala-ate').innerText() === 'até hoje, 14:00');
    await p.locator('.deslizar-bt').focus(); for (let i = 0; i < 4; i++) await p.keyboard.press('ArrowRight');
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Livre');
    confere('pelo teclado, as setas levam o controle até o fim e liberam', true);
    await fechar(t);

    const e = await abrir('evento', viewport);
    confere('em uso: título, quem reservou, até quando e o andamento', await status(e.p) === 'Em uso' && await estado(e.p) === 'evento'
      && await e.p.locator('#sala-evento-titulo').innerText() === 'Defesa de TCC' && await e.p.locator('#sala-evento-quem').innerText() === 'Reservado por Bruno Tavares'
      && await e.p.locator('#sala-ate').innerText() === 'até hoje, 12:00' && Number(await e.p.locator('#sala-andamento').getAttribute('aria-valuenow')) === 50);
    confere('em uso: sem liberar nem ocupar', await e.p.locator('.deslizar').count() === 0);
    await e.p.getByRole('button', { name:'Opções da sala' }).click();
    confere('em uso: as opções só têm o celular', await e.p.locator('#sala-usar').isHidden() && await e.p.locator('#sala-qr svg').isVisible());
    await e.p.keyboard.press('Escape'); await fechar(e);

    const c = await abrir('ocupada', viewport, TOKEN, { por:'Carla Mendonça' });
    confere('ocupada pelo celular mostra quem ocupou', await c.p.locator('#sala-ocupada-quem').innerText() === 'Ocupada por Carla Mendonça, pelo celular');
    await fechar(c);

    const f = await abrir('livre', viewport);
    await f.p.route('**/rest/v1/rpc/sala_*', r => r.abort()); await atualiza(f.p);
    await f.p.locator('#sala-offline').waitFor({ state:'visible' });
    confere('sem conexão: não afirma Livre e não oferece ocupar', (await f.p.locator('#sala-offline').innerText()).startsWith('Sem atualização desde ')
      && await status(f.p) === 'Sem conexão' && await estado(f.p) === 'offline' && await f.p.locator('#sala-nome').innerText() === 'Auditório');
    await f.p.getByRole('button', { name:'Opções da sala' }).click();
    confere('sem conexão: as opções escondem ocupar', await f.p.locator('#sala-usar').isHidden()); await f.p.keyboard.press('Escape');
    await f.p.unroute('**/rest/v1/rpc/sala_*');
    await f.p.route('**/rest/v1/rpc/sala_*', r => r.fulfill({ headers:{ 'access-control-allow-origin':'*' }, body:'{}' })); await atualiza(f.p);
    await f.p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Livre');
    confere('recupera ao voltar à aba com rede', await f.p.locator('#sala-offline').isHidden()); await fechar(f);
  }

  console.log('Tempo real');
  {
    const t = await abrir('livre'), { p } = t;
    await p.clock.runFor(50);
    confere('o tablet ouve o canal da sala', await p.evaluate(() => (window.__canais?.['sala-2'] || []).length === 1));
    const n0 = await p.evaluate(() => window.__rpcs.filter(x => x.nome === 'sala_estado').length);
    // alguém ocupa pelo celular: o celular (ou o banco) avisa o canal, e o tablet muda sem recarregar
    await p.evaluate(() => { Object.assign(window.__teste.sala, { estado:'ocupada', por:'Carla Mendonça' }); window.__canalDispara('sala-2'); window.__canalDispara('sala-2'); });
    await p.clock.runFor(400);
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Ocupada');
    confere('o aviso muda a tela na hora, sem esperar o minuto', await p.locator('#sala-ocupada-quem').innerText() === 'Ocupada por Carla Mendonça, pelo celular');
    confere('dois avisos seguidos viram uma consulta só', await p.evaluate(n => window.__rpcs.filter(x => x.nome === 'sala_estado').length, n0) === n0 + 1);
    await p.evaluate(() => { window.__teste.sala.estado = 'livre'; window.__teste.sala.por = null; window.__canalDispara('sala-2'); });
    await p.clock.runFor(400);
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Livre');
    confere('e volta quando liberam pelo celular', true);
    await p.getByRole('button', { name:'Opções da sala' }).click(); await p.locator('.sala-opcao[data-min="30"]').click();
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Ocupada');
    confere('ocupar no tablet avisa o canal (o celular aberto muda junto)', await p.evaluate(() => (window.__enviados || []).some(e => e.topico === 'sala-2' && e.event === 'mudou')));
    await fechar(t);
  }

  console.log('Dia e tela inteira');
  {
    const t = await abrir('livre', undefined, TOKEN, { semProximo:true }), { p } = t;
    confere('sem reserva à frente', await p.locator('#sala-ate').innerText() === 'Sem reservas nos próximos 7 dias');
    await p.evaluate(() => { window.__telaCheia = 0; document.documentElement.requestFullscreen = () => { window.__telaCheia++; return Promise.resolve(); }; });
    await p.mouse.click(300, 400); await p.mouse.click(300, 400);
    confere('dois toques num lugar vazio pedem a tela inteira', await p.evaluate(() => window.__telaCheia) === 1);
    await p.mouse.click(300, 400); await p.clock.runFor(600); await p.mouse.click(300, 400);
    confere('toques espaçados não', await p.evaluate(() => window.__telaCheia) === 1);
    await fechar(t);
  }
  {
    const t = await abrir('livre', undefined, 'errado');
    confere('token inválido mostra só a orientação de cadastro', await status(t.p) === 'Tablet não cadastrado'
      && (await t.p.locator('#sala-ate').innerText()).includes('Peça um endereço novo ao LABBIO') && await t.p.getByRole('button').count() === 0);
    await fechar(t);
    const vazio = await abrir('livre', undefined, ''); confere('sem token não chama RPC', await vazio.p.evaluate(() => !(window.__rpcs || []).length)); await fechar(vazio);
  }
  {
    const t = await abrir(), { p } = t;
    await p.evaluate(() => window.__teste.sala.estado = 'evento'); await p.clock.fastForward(60000);
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Em uso');
    confere('consulta de novo a cada 60 segundos', await p.evaluate(() => window.__rpcs.filter(x => x.nome === 'sala_estado').length >= 2)); await fechar(t);
  }
  {
    const t = await abrir(), { p } = t;
    await p.getByRole('button', { name:'Opções da sala' }).click();
    await p.evaluate(() => window.__teste.sala.estado = 'evento'); await p.locator('.sala-opcao[data-min="30"]').click();
    await p.waitForFunction(() => document.getElementById('sala-status').textContent === 'Em uso');
    confere('corrida com uma reserva usa em_evento do servidor', await p.locator('#sala-mensagem').innerText() === 'A sala já está em uso por uma reserva.'); await fechar(t);
  }
  {
    const t = await abrir(), { p } = t;
    await p.evaluate(() => window.__teste.sala.token = 'revogado'); await atualiza(p);
    await p.waitForFunction(() => document.body.dataset.estado === 'invalido');
    confere('revogação durante o uso remove ações e QR', await p.getByRole('button').count() === 0 && await p.locator('#sala-qr svg').count() === 0); await fechar(t);
  }
  if (process.env.SALA_CAPTURAS){
    mkdirSync(process.env.SALA_CAPTURAS, { recursive:true });
    for (const est of ['livre', 'evento', 'ocupada']) for (const viewport of [{ width:1280, height:800 }, { width:800, height:1280 }]){
      const t = await abrir(est, viewport); await t.p.evaluate(() => document.fonts.ready);
      await t.p.screenshot({ path:`${process.env.SALA_CAPTURAS}/sala-${est}-${viewport.width}.png` }); await fechar(t);
    }
  }
} finally { await nav.close(); }
console.log(falhas ? `\n${falhas} falha(s) em ${checks} verificações.` : `\nTudo certo. ${checks} verificações passaram.`); process.exitCode = falhas ? 1 : 0;
