/* As notificações (32.0): o sino que não empilha, o aviso no aparelho,
   o empurrão da fila e o painel da fila em Administração › E-mails.
   Confere, com asserção de verdade (sai com código 1 se algo falhar):
     1. o sino: cada aviso tem o seu ×, "limpar as lidas" limpa, e a
        conta volta certa;
     2. o aparelho: ativar (a permissão, a inscrição com as chaves e o nome
        do aparelho), testar, desativar; o bloqueado, o iPhone fora do app
        e o convite no alto do sino;
     3. sair da conta desliga o aparelho antes de sair;
     4. o empurrão: o portal pergunta à fila e, com o "sim", chama a
        função como portal; com o "não", não chama;
     5. o teste de e-mail entra na fila como teste, e a fila ocupada não é erro;
     6. o painel da fila diz se o agendamento chega, o que espera, e roda;
     7. o manifesto, os ícones e o service worker (o carteiro) respondem.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}

/* um navegador com o serviço de push de mentira: a permissão que se quiser
   e uma inscrição que o teste enxerga (o Chromium sem tela não tem o
   serviço de push de verdade) */
async function abrir({ hash = '#/', vp = { width:1366, height:900 }, teste = {}, permissao = 'default', ua, semPush } = {}){
  const ctx = await nav.newContext({ viewport: vp, ...(ua ? { userAgent: ua } : {}) });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stubAdmin }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(({ teste, permissao, semPush }) => {
    window.__teste = teste;
    if (semPush){ delete window.PushManager; return; }
    window.__perm = permissao;
    Object.defineProperty(Notification, 'permission', { get: () => window.__perm, configurable: true });
    Notification.requestPermission = async () => { window.__pediu = true; if (window.__perm === 'default') window.__perm = 'granted'; return window.__perm; };
    const falsa = (opts) => ({
      endpoint: 'https://fcm.googleapis.com/fcm/send/aparelho-de-teste-123456',
      options: { applicationServerKey: opts?.applicationServerKey?.buffer || null },
      toJSON(){ return { endpoint: this.endpoint, keys: { p256dh: 'B' + 'x'.repeat(86), auth: 'a'.repeat(22) } }; },
      unsubscribe: async () => { window.__desinscreveu = true; try { localStorage.removeItem('teste.sub'); } catch(e){} window.__sub = null; return true; }
    });
    PushManager.prototype.subscribe = async function(opts){ window.__subOpts = { chave: opts.applicationServerKey?.length, visivel: opts.userVisibleOnly };
      window.__sub = falsa(opts); localStorage.setItem('teste.sub', '1'); return window.__sub; };
    PushManager.prototype.getSubscription = async function(){
      if (!window.__sub && localStorage.getItem('teste.sub')) window.__sub = falsa(null);
      return window.__sub || null; };
  }, { teste, permissao, semPush });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(800);
  return { ctx, p, erros };
}
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(r => r.nome === n), nome);
const invocacoes = p => p.evaluate(() => window.__invocacoes || []);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('#toast .toast')].map(t => t.textContent));

/* ---------- 1. o sino ---------- */
console.log('\nO sino');
{
  const { ctx, p, erros } = await abrir();
  await p.click('#sino');
  await p.waitForSelector('#sino-painel:not([hidden])');
  confere('cada aviso tem o seu ×', await p.locator('#sn-lista .sn-linha .sn-x').count() === 2);
  confere('com o nome para quem não enxerga', await p.locator('#sn-lista .sn-x').first().getAttribute('aria-label') === 'Apagar este aviso');
  confere('"limpar as lidas" aparece, porque há uma lida', await p.locator('#sn-limpar').isVisible());
  confere('e a regra dos 30 dias está no pé', (await p.textContent('#sino-painel .sn-regra')).includes('30 dias'));
  await p.locator('#sn-lista .sn-linha').first().locator('.sn-x').click();
  await p.waitForTimeout(400);
  const r = await rpcs(p, 'notificacoes_limpar');
  confere('o × apaga pelo id, só aquele', r.length === 1 && JSON.stringify(r[0].p.p_ids) === '[1]', r);
  confere('e o painel continua aberto, sem o aviso', await p.isVisible('#sino-painel') && await p.locator('#sn-lista .sn-linha').count() === 1);
  confere('a bolinha do sino acompanha (o não lido saiu)', await p.isHidden('#sino-n'));
  await p.click('#sn-limpar');
  await p.waitForTimeout(400);
  const r2 = await rpcs(p, 'notificacoes_limpar');
  confere('"limpar as lidas" chama sem ids (o banco apaga as lidas da pessoa)', r2.length === 2 && !r2[1].p?.p_ids && !r2[1].p?.p_todas);
  confere('e o sino fica vazio, com o recado de sempre', await p.locator('#sn-lista .sn-vazio').count() === 1);
  confere('diz quantos saíram', (await toasts(p)).some(t => /1 aviso lido saiu do sino/.test(t)), await toasts(p));
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}
/* o portal publicado antes da migração: não oferece o que ainda não funciona */
{
  const { ctx, p, erros } = await abrir({ teste: { v32: 'falta' } });
  await p.click('#sino');
  await p.waitForSelector('#sino-painel:not([hidden])');
  await p.waitForTimeout(400);
  confere('sem a 32.0, o sino não mostra o ×', await p.locator('#sn-lista .sn-linha').count() === 2 && await p.locator('#sn-lista .sn-x').count() === 0);
  confere('nem "limpar as lidas", nem a regra dos 30 dias', await p.isHidden('#sn-limpar') && await p.isHidden('#sino-painel .sn-regra'));
  confere('nem o convite do aparelho', (await p.textContent('#sn-aparelho')).trim() === '');
  await p.evaluate(() => modalPreferenciaNotif());
  await p.waitForFunction(() => /ainda não estão disponíveis/.test(document.querySelector('#pn-push')?.textContent || ''), null, { timeout:5000 });
  confere('as preferências dizem qual migração falta, sem o botão de ativar',
    (await p.textContent('#pn-push')).includes('v32_fila_e_notificacoes') && await p.locator('#pn-ativar').count() === 0);
  await p.evaluate(() => empurrarFila());
  confere('e o portal não pergunta pela fila', (await rpcs(p, 'fila_empurrar')).length === 0);
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}
/* a 32.0 aplicada, mas a função ainda não gerou a chave do aparelho */
{
  const { ctx, p } = await abrir({ teste: { semChave: true } });
  await p.click('#sino');
  await p.waitForSelector('#sino-painel:not([hidden])');
  await p.waitForTimeout(400);
  confere('com a 32.0, o × e o "limpar" aparecem', await p.locator('#sn-lista .sn-x').count() === 2 && await p.isVisible('#sn-limpar'));
  confere('e o convite do aparelho espera a chave do servidor', (await p.textContent('#sn-aparelho')).trim() === '');
  await ctx.close();
}

/* ---------- 2. o aparelho ---------- */
console.log('\nO aparelho');
{
  const { ctx, p, erros } = await abrir();
  confere('o carteiro (sw.js) se registra ao abrir', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())));
  await p.click('#sino');
  confere('o sino convida a receber no aparelho', (await p.textContent('#sn-aparelho')).includes('mesmo com o SOMA fechado'));
  await p.locator('#sn-aparelho .btn').click();
  await p.waitForSelector('#modal.open #pn-ativar');
  confere('as preferências abrem com o aparelho e o e-mail', (await p.textContent('#modal')).includes('Neste aparelho')
    && (await p.textContent('#modal')).includes('Por e-mail'));
  await p.click('#pn-ativar');
  await p.waitForFunction(() => document.querySelector('#pn-push')?.textContent.includes('Ativadas neste aparelho'), null, { timeout:8000 });
  confere('ativar pede a permissão do navegador', await p.evaluate(() => window.__pediu === true));
  const opts = await p.evaluate(() => window.__subOpts);
  confere('e se inscreve com a chave do servidor (65 bytes) e visível ao usuário', opts?.chave === 65 && opts?.visivel === true, opts);
  const ins = await rpcs(p, 'push_inscrever');
  confere('a inscrição vai ao banco, com as chaves e o nome do aparelho', ins.length === 1 && ins[0].p.p.endpoint.includes('fcm.googleapis.com')
    && ins[0].p.p.p256dh.length === 87 && ins[0].p.p.auth.length === 22 && /Chrome no Linux|Chrome/.test(ins[0].p.p.aparelho), ins);
  confere('e a tela diz que está ativo', (await p.textContent('#pn-push')).includes('Ao sair da conta, este aparelho deixa de receber'));
  await p.locator('#pn-push button', { hasText:'Enviar uma notificação de teste' }).click();
  await p.waitForTimeout(500);
  confere('o teste cria o aviso do aparelho', (await rpcs(p, 'push_teste')).length === 1);
  const inv = await invocacoes(p);
  confere('e acorda a fila como teste', inv.some(i => i.nome === 'notificar-email' && i.corpo?.origem === 'teste'), inv);
  await p.locator('#pn-push button', { hasText:'Desativar' }).click();
  await p.waitForFunction(() => document.querySelector('#pn-push')?.textContent.includes('mesmo com o SOMA fechado'), null, { timeout:5000 });
  const can = await rpcs(p, 'push_cancelar');
  confere('desativar tira a inscrição do banco, pelo endereço', can.length === 1 && can[0].p.p_endpoint.includes('aparelho-de-teste'), can);
  confere('e do navegador', await p.evaluate(() => window.__desinscreveu === true));
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ permissao:'denied' });
  await p.evaluate(() => modalPreferenciaNotif());
  await p.waitForFunction(() => /bloqueadas/.test(document.querySelector('#pn-push')?.textContent || ''), null, { timeout:5000 });
  confere('permissão negada: a tela explica onde liberar', (await p.textContent('#pn-push')).includes('cadeado'));
  confere('e não oferece um botão que não vai funcionar', await p.locator('#pn-ativar').count() === 0);
  await ctx.close();
}
{
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const { ctx, p } = await abrir({ ua, semPush:true, vp:{ width:390, height:844 } });
  await p.evaluate(() => modalPreferenciaNotif());
  await p.waitForFunction(() => /tela de início/.test(document.querySelector('#pn-push')?.textContent || ''), null, { timeout:5000 });
  confere('no Safari do iPhone, a tela manda instalar o SOMA primeiro', (await p.textContent('#pn-push')).includes('Adicionar à Tela de Início'));
  confere('com o passo a passo do tour', await p.locator('#pn-push a[href="tour#celular"]').count() === 1);
  await ctx.close();
}
{
  const { ctx, p } = await abrir();
  await p.click('#sino');
  await p.locator('#sn-aparelho [aria-label="Agora não"]').click();
  await p.click('#sino'); await p.click('#sino');
  confere('"agora não" guarda a escolha e o convite sai do sino', (await p.textContent('#sn-aparelho')).trim() === '');
  await ctx.close();
}

/* os outros aparelhos da mesma conta: aparecem e saem pelo Remover */
{
  const { ctx, p, erros } = await abrir({ teste:{ outroAparelho:true } });
  await p.click('#sino');
  await p.locator('#sn-aparelho .btn').click();
  await p.waitForSelector('#modal.open #pn-ativar');
  await p.click('#pn-ativar');
  await p.waitForFunction(() => document.querySelector('#pn-aps')?.textContent.includes('Safari no iPhone'), null, { timeout:8000 });
  const t = await p.textContent('#pn-aps');
  confere('os outros aparelhos da conta aparecem, sem o deste', t.includes('Outros aparelhos que recebem') && t.includes('Safari no iPhone')
    && await p.locator('#pn-aps .pn-ap').count() === 1, t);
  await p.locator('#pn-aps .pn-ap button', { hasText:'Remover' }).click();
  await p.waitForTimeout(700);
  const can = await rpcs(p, 'push_cancelar');
  confere('remover cancela aquele aparelho, pelo id', can.length === 1 && can[0].p.p_id === 'ap-velho' && can[0].p.p_endpoint === null, can);
  confere('e ele sai da lista', await p.locator('#pn-aps .pn-ap').count() === 0);
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 3. sair desliga o aparelho ---------- */
console.log('\nSair');
{
  const { ctx, p } = await abrir();
  /* sair recarrega a página: o que aconteceu antes fica anotado no localStorage */
  await p.evaluate(() => {
    localStorage.setItem('teste.sub', '1');
    const rpc = sb.rpc;
    sb.rpc = async (n, a) => { if (n === 'push_cancelar') localStorage.setItem('teste.cancelou', JSON.stringify(a)); return rpc(n, a); };
    sb.auth.signOut = async () => { localStorage.setItem('teste.saiu', localStorage.getItem('teste.sub') ? 'antes' : 'depois'); };
  });
  await p.evaluate(() => { setTimeout(() => sair(), 0); });
  await p.waitForTimeout(1500);
  await p.waitForLoadState('domcontentloaded');
  const r = await p.evaluate(() => ({ cancelou: JSON.parse(localStorage.getItem('teste.cancelou') || 'null'),
    sub: localStorage.getItem('teste.sub'), saiu: localStorage.getItem('teste.saiu') }));
  confere('sair tira a inscrição deste aparelho do banco', r.cancelou?.p_endpoint?.includes('aparelho-de-teste'), r);
  confere('desinscreve o navegador', r.sub === null);
  confere('e só então sai da conta', r.saiu === 'depois', r);
  await ctx.close();
}

/* ---------- 4. o empurrão da fila ---------- */
console.log('\nO empurrão');
{
  const { ctx, p, erros } = await abrir();
  await p.waitForTimeout(6800);
  confere('o portal aberto pergunta à fila se ela está parada', (await rpcs(p, 'fila_empurrar')).length >= 1);
  const inv = await invocacoes(p);
  confere('com o "sim", chama a função como portal', inv.some(i => i.nome === 'notificar-email' && i.corpo?.origem === 'portal'), inv);
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ teste: { empurrar:false } });
  await p.waitForTimeout(6800);
  confere('com o "não" (o agendamento em dia), ninguém chama a função',
    (await rpcs(p, 'fila_empurrar')).length >= 1 && !(await invocacoes(p)).some(i => i.corpo?.origem === 'portal'));
  await ctx.close();
}

/* ---------- 5. o teste de e-mail ---------- */
console.log('\nO teste de e-mail');
{
  const { ctx, p } = await abrir({ teste: { fn:'ocupada' } });
  await p.evaluate(() => modalPreferenciaNotif());
  await p.waitForSelector('#pn-tbtn');
  await p.click('#pn-tbtn');
  await p.waitForFunction(() => /passando agora/.test(document.querySelector('#pn-teste')?.textContent || ''), null, { timeout:5000 });
  confere('com outra passada rodando, o teste avisa que entra nela (não é erro)',
    !(await p.locator('#pn-teste .aviso-box.err').count()), await p.textContent('#pn-teste'));
  const inv = await invocacoes(p);
  confere('e a função é chamada como teste', inv.some(i => i.corpo?.origem === 'teste'), inv);
  await ctx.close();
}

/* ---------- 6. o painel da fila ---------- */
console.log('\nO painel da fila');
for (const [fila, espera, nome] of [
  [undefined, 'A fila anda sozinha', 'com o agendamento em dia, diz que a fila anda sozinha'],
  ['parada', 'as passadas não chegam à função', 'agendado mas sem chegar: aponta a verificação de JWT'],
  ['sem_cron', 'não está ligado', 'sem o Cron: diz como ligar']]){
  const { ctx, p, erros } = await abrir({ hash:'#/admin/emails/programados', teste: fila ? { fila } : {} });
  await p.waitForFunction(() => !document.querySelector('#ml-fila .carregando'), null, { timeout:8000 });
  const t = await p.textContent('#ml-fila');
  confere(nome, t.includes(espera), t.slice(0, 200));
  if (!fila){
    confere('conta o que espera em cada fila', /3\s*avisos do sino/.test(t) && /2\s*programados vencidos/.test(t), t);
    await p.click('#ml-rodar');
    await p.waitForTimeout(600);
    confere('"Rodar a fila agora" chama a função e diz o que saiu', (await invocacoes(p)).some(i => i.corpo?.origem === 'teste')
      && (await toasts(p)).some(x => /Passada feita/.test(x)), await toasts(p));
  }
  if (fila === 'parada') confere('com o último erro', t.includes('401 Invalid JWT'));
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}


/* ---------- 7. o app instalável ---------- */
console.log('\nO app');
{
  const { ctx, p } = await abrir();
  const m = await p.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]')?.getAttribute('href');
    const j = await (await fetch(href)).json();
    const icones = await Promise.all(j.icons.map(async i => [i.src, (await fetch(i.src)).status]));
    return { href, j, icones, titulo: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.content,
      toque: document.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href'),
      toqueOk: (await fetch(document.querySelector('link[rel="apple-touch-icon"]').getAttribute('href'))).status,
      selo: (await fetch('icone-badge.png')).status, sw: (await fetch('sw.js')).status };
  });
  confere('o portal aponta o manifesto', m.href === 'manifest.webmanifest');
  confere('o app se chama SOMA e abre em tela cheia, no início', m.j.short_name === 'SOMA' && m.j.display === 'standalone' && m.j.start_url === './');
  confere('os ícones de 192 e 512 (e o de máscara) existem', m.icones.length === 3 && m.icones.every(([, s]) => s === 200)
    && m.j.icons.some(i => i.purpose === 'maskable'), m.icones);
  confere('no iPhone, o nome e o ícone da tela de início', m.titulo === 'SOMA' && m.toque === 'icone-180.png' && m.toqueOk === 200);
  confere('o selo das notificações e o carteiro respondem', m.selo === 200 && m.sw === 200);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
