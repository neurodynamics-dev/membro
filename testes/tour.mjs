/* O tour do SOMA (tour.html): o guia de quem chega.
   Confere, com asserção de verdade (sai com código 1 se algo falhar):
     1. sem conta: as 13 etapas, o passo a passo e o formulário de criar a
        conta (as recusas, o e-mail de confirmação, reenviar, entrar, a
        senha esquecida), até a conta aberta;
     2. com conta: o que é da pessoa de verdade (o menu dela, as tarefas
        nas colunas, a posição no placar, os treinamentos, o Studio), e os
        botões que abrem a tela certa do SOMA;
     3. quem não é do Studio vê por que e como pedir;
     4. no celular: nada vaza para os lados, a barra de baixo e a gaveta
        das etapas; no iPhone, a aba do iPhone vem escolhida;
     5. o link do e-mail que venceu, o de nova senha (vai para o portal),
        o tema claro e as setas do teclado.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const troca = (s, velho, novo) => { if (!s.includes(velho)) throw new Error('o stub mudou: ' + velho.slice(0, 60)); return s.replace(velho, novo); };
/* sem sessão até entrar; o cadastro, o reenvio e a senha anotados */
let stubFora = troca(stubAdmin, "getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } })",
  "getSession: async () => ({ data:{ session: window.__entrou ? { user:{ id:'u1' } } : null } })");
stubFora = troca(stubFora, "signInWithPassword: async () => ({ error:null })",
  `signInWithPassword: async (c) => { window.__login = c;
     if (c.password === 'errada') return { error:{ message:'Invalid login credentials', code:'invalid_credentials' } };
     if (c.password === 'naoconfirmado') return { error:{ message:'Email not confirmed', code:'email_not_confirmed' } };
     window.__entrou = true; return { data:{}, error:null }; }`);
stubFora = troca(stubFora, "signUp: async () => ({ data:{}, error:null })",
  `signUp: async (c) => { window.__cadastro = c; return { data:{ user:{ identities:[{}] } }, error:null }; },
   resend: async (c) => { window.__reenvio = c; return { error:null }; }`);
stubFora = troca(stubFora, "resetPasswordForEmail: async () => ({ error:null })",
  "resetPasswordForEmail: async (e, o) => { window.__senha = { e, o }; return { error:null }; }");
const stubLeitura = stubAdmin.replace("papel:'admin'", "papel:'leitura'");

const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ hash = '', stub = stubAdmin, vp = { width:1440, height:900 }, ua, antes } = {}){
  const ctx = await nav.newContext({ viewport: vp, ...(ua ? { userAgent: ua, isMobile: true, hasTouch: true } : {}) });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript',
    body: readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8') }));
  if (antes) await p.addInitScript(antes);
  await p.goto('http://localhost:8765/tour.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#et-h1');
  await p.waitForTimeout(700);
  return { ctx, p, erros };
}
const h1 = p => p.textContent('#et-h1');
const ir = async (p, hash, espera = 700) => { await p.evaluate(h => { location.hash = h; }, hash); await p.waitForTimeout(espera); };
const vivo = (p, id) => p.waitForFunction(i => { const c = document.querySelector(`#${i} .vivo-corpo`); return c && !c.querySelector('.carregando'); }, id, { timeout:8000 });
const ETAPAS = ['bem-vindo','conta','seu-soma','inicio','tarefas','placar','agenda','treinamentos','studio','servicos','equipe','celular','ajuda'];

/* ---------- 1. sem conta ---------- */
console.log('\nSem conta');
{
  const { ctx, p, erros } = await abrir({ stub: stubFora });
  confere('abre nas boas-vindas', (await h1(p)).includes('Bem-vindo ao SOMA'));
  confere('treze etapas no trilho', await p.locator('#trilho [data-trilho] li').count() === 13);
  confere('o endereço do SOMA, para copiar', (await p.textContent('.endereco')).includes('membro.neurodynamics.dev'));
  confere('o cabeçalho oferece entrar', (await p.textContent('#hd-conta')).includes('Entrar'));
  await p.locator('.et-nav .prox').click(); await p.waitForTimeout(500);
  confere('Continuar leva à conta', (await h1(p)).includes('Crie a sua conta') && (await p.evaluate(() => location.hash)) === '#conta');
  confere('o foco vai para o título da etapa', await p.evaluate(() => document.activeElement?.id === 'et-h1'));
  confere('explica qual e-mail usar', (await p.textContent('.nota.lima')).includes('quadro de pessoal'));
  confere('e mostra o e-mail de confirmação que vai chegar', (await p.textContent('.mk-email')).includes('Confirmar meu e-mail'));
  const erro = () => p.textContent('#c-erro');
  await p.click('#c-btn');
  confere('sem nada preenchido, pede e-mail e senha', (await erro()).includes('Preencha o e-mail e a senha'));
  await p.fill('#c-email', 'Bruno@NeuroDynamics.dev'); await p.fill('#c-senha', 'curta'); await p.fill('#c-senha2', 'curta');
  await p.click('#c-btn');
  confere('senha curta: pelo menos 8', (await erro()).includes('pelo menos 8'));
  await p.fill('#c-senha', 'segredo123'); await p.fill('#c-senha2', 'segredo124');
  await p.click('#c-btn');
  confere('as duas senhas diferentes: não conferem', (await erro()).includes('não conferem'));
  await p.click('[data-ver]');
  confere('o olho mostra a senha', await p.getAttribute('#c-senha', 'type') === 'text');
  await p.fill('#c-senha2', 'segredo123');
  await p.click('#c-btn'); await p.waitForTimeout(400);
  const cad = await p.evaluate(() => window.__cadastro);
  confere('cria a conta com o e-mail em minúsculas', cad?.email === 'bruno@neurodynamics.dev' && cad?.password === 'segredo123', cad);
  confere('e o link do e-mail volta para o tour', cad?.options?.emailRedirectTo === 'http://localhost:8765/tour.html', cad?.options);
  confere('a tela passa a "confira o seu e-mail", com o endereço', (await p.textContent('#auth')).includes('bruno@neurodynamics.dev')
    && (await p.textContent('#auth')).includes('Confira o seu e-mail'));
  confere('o passo 1 fica feito', await p.locator('.linha-passos div.feito').count() === 1);
  await p.click('#b-reenviar'); await p.waitForTimeout(300);
  confere('reenviar pede outro e-mail de confirmação', (await p.evaluate(() => window.__reenvio))?.type === 'signup'
    && (await p.textContent('#e-msg')).includes('reenviado'));
  await p.click('#b-reenviar'); await p.waitForTimeout(200);
  confere('e não deixa pedir de novo em seguida', (await p.textContent('#e-msg')).includes('Espere um minuto'));
  await p.locator('#auth [data-modo="entrar"]').last().click(); await p.waitForTimeout(200);
  confere('"Já confirmei" abre o entrar, com o e-mail preenchido', await p.inputValue('#l-email') === 'bruno@neurodynamics.dev');
  await p.fill('#l-senha', 'errada'); await p.click('#l-btn'); await p.waitForTimeout(300);
  confere('senha errada: diz o que conferir', (await p.textContent('#l-erro')).includes('E-mail ou senha incorretos'));
  await p.fill('#l-senha', 'naoconfirmado'); await p.click('#l-btn'); await p.waitForTimeout(300);
  confere('e-mail não confirmado: diz isso, em vez de "senha errada"', (await p.textContent('#l-erro')).includes('Falta confirmar o e-mail'));
  await p.fill('#l-senha', 'segredo123'); await p.click('#l-btn'); await p.waitForTimeout(1200);
  confere('entrou: a conta está pronta, com o primeiro nome', (await h1(p)).includes('Sua conta está pronta, Ana'), await h1(p));
  confere('o cabeçalho mostra quem entrou', (await p.textContent('#hd-conta')).includes('Ana'));
  confere('o cadastro em andamento sai do navegador', await p.evaluate(() => localStorage.getItem('nd.tour.cadastro')) === null);
  await p.waitForTimeout(600);
  const passos = await p.evaluate(() => [...document.querySelectorAll('#trilho .ms-l li.feito')].map(l => l.textContent.trim()));
  confere('os primeiros passos riscam a conta e o vínculo', passos.includes('Criar a sua conta') && passos.includes('Conta ligada ao quadro de pessoal'), passos);
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ stub: stubFora, hash: '#conta' });
  await p.locator('#auth [data-modo="senha"]').click();
  await p.fill('#s-email', 'Ana@Nro.dev'); await p.click('#s-btn'); await p.waitForTimeout(300);
  const s = await p.evaluate(() => window.__senha);
  confere('esqueci a senha: o link vai para o portal, que cria a senha nova', s?.e === 'ana@nro.dev' && s?.o?.redirectTo === 'http://localhost:8765/', s);
  confere('e a tela diz para abrir no mesmo navegador', (await p.textContent('#s-msg')).includes('neste navegador'));
  await ir(p, '#studio');
  await vivo(p, 'v-studio');
  confere('sem conta, o Studio aparece inteiro, e o painel pede para entrar', (await p.textContent('#etapa')).includes('Criar uma peça, em seis passos')
    && (await p.textContent('#v-studio')).includes('Entre na sua conta'));
  await ir(p, '#tarefas'); await vivo(p, 'v-tarefas');
  confere('as tarefas também: o painel convida a criar a conta', (await p.textContent('#v-tarefas')).includes('Criar a conta ou entrar'));
  await ctx.close();
}

/* ---------- 2. com conta ---------- */
console.log('\nCom conta');
{
  const { ctx, p, erros } = await abrir({ hash: '#seu-soma' });
  await vivo(p, 'v-seu');
  const menu = await p.evaluate(() => [...document.querySelectorAll('.mk-menu .mm-l li')].map(l => ({ t: l.textContent.trim(), c: l.className })));
  confere('o menu da pessoa: o admin vê Studio, Seleção e Administração',
    ['Studio', 'Seleção', 'Administração'].every(n => menu.some(m => m.t.startsWith(n) && m.c === 'seu')), menu);
  confere('o perfil de verdade', (await p.textContent('#v-seu')).includes('Ana Figueiredo') && (await p.textContent('#v-seu')).includes('Administração'));
  confere('com os grupos da ficha', (await p.textContent('#v-seu')).includes('Órtese'));
  const lk = await p.getAttribute('#espacos-l a.li', 'href');
  confere('cada espaço leva à tela dele no SOMA', lk === './#/agenda', lk);
  confere('no computador, numa aba do SOMA que se reaproveita', await p.getAttribute('#espacos-l a.li', 'target') === 'soma');

  await ir(p, '#tarefas'); await vivo(p, 'v-tarefas');
  const t = await p.textContent('#v-tarefas');
  confere('as tarefas que estão com a pessoa', t.includes('Calibrar o encoder da bancada 2') && t.includes('ORT-14'), t.slice(0, 200));
  confere('e o quadro de exemplo vira o dela, com os cartões nas colunas', (await p.textContent('#kb-mock')).includes('ORT-14')
    && (await p.textContent('#kb-mock')).includes('Os seus cartões'));
  confere('o cartão abre a tarefa no SOMA', await p.locator('#v-tarefas a.li[href="./#/atividades/card/ORT-14"]').count() === 1);
  confere('os quadros da pessoa', (await p.textContent('#v-tarefas')).includes('Órtese'));

  await p.keyboard.press('ArrowRight'); await p.waitForTimeout(700);
  confere('a seta do teclado vai à próxima etapa', (await p.evaluate(() => location.hash)) === '#placar');
  await vivo(p, 'v-placar');
  confere('o placar: a posição de verdade', (await p.textContent('#v-placar')).includes('2º'));
  confere('o ranking do mês, com a pessoa em destaque', await p.locator('#v-placar .rk li.eu').count() >= 1);
  confere('o check-in mostra o primeiro nome no celular de exemplo', (await p.textContent('.mk-fone')).includes('Bem-vindo, Ana!'));

  await ir(p, '#treinamentos'); await vivo(p, 'v-treinos');
  confere('os treinamentos obrigatórios que faltam', (await p.textContent('#v-treinos')).includes('obrigatórios por fazer'));
  await ir(p, '#studio'); await vivo(p, 'v-studio');
  confere('o Studio: o admin entra e aprova', (await p.textContent('#v-studio')).includes('Você entra no Studio e aprova publicações'));
  confere('com o passo a passo do criador', (await p.textContent('#etapa')).includes('Criar uma peça, em seis passos'));
  await ir(p, '#agenda'); await vivo(p, 'v-agenda');
  confere('a agenda: os próximos compromissos', await p.locator('#v-agenda a.li').count() >= 1 || (await p.textContent('#v-agenda')).includes('Nenhum evento'));
  await ir(p, '#equipe'); await vivo(p, 'v-equipe');
  confere('a equipe: os colegas dos grupos', (await p.textContent('#v-equipe')).includes('Colegas dos seus grupos'));
  await ir(p, '#celular');
  confere('o celular: ensina a ligar as notificações no aparelho', (await p.textContent('#etapa')).includes('Ativar neste aparelho'));
  await p.waitForFunction(() => document.querySelector('#qr-cel svg'), null, { timeout:8000 }).catch(() => {});
  confere('no computador, o QR para abrir o passo a passo no celular', await p.locator('#qr-cel svg').count() === 1);
  await ir(p, '#ajuda');
  confere('a ajuda: os primeiros passos, as dúvidas e o guia de bolso', await p.locator('.missao[data-missao="grande"] li').count() === 6
    && await p.locator('.faq details').count() >= 10 && await p.locator('.bolso .g').count() >= 15);
  confere('sem erro na página', erros.length === 0, erros);
  for (const e of ETAPAS){ await ir(p, '#' + e, 500); }
  confere('as treze etapas abrem sem erro', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 3. quem não é do Studio ---------- */
console.log('\nQuem não é do Studio');
{
  const { ctx, p, erros } = await abrir({ stub: stubLeitura, hash: '#studio' });
  await vivo(p, 'v-studio');
  confere('diz que o Studio não aparece para a pessoa', (await p.textContent('#v-studio')).includes('O Studio não aparece para você'));
  confere('e como pedir o acesso', await p.locator('a[href="./#/servicos/acesso"]').count() >= 1);
  confere('sem o passo a passo que ela não vai usar', !(await p.textContent('#etapa')).includes('Criar uma peça, em seis passos'));
  await ir(p, '#seu-soma');
  const menu = await p.evaluate(() => [...document.querySelectorAll('.mk-menu .mm-l li')].map(l => ({ t: l.textContent.trim(), c: l.className })));
  confere('no menu dela, o Studio aparece riscado', menu.some(m => m.t.startsWith('Studio') && m.c === 'fora'), menu);
  confere('e a Administração nem aparece', !menu.some(m => m.t.startsWith('Administração')));
  confere('sem erro na página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 4. no celular ---------- */
console.log('\nNo celular');
for (const [nome, stub] of [['sem conta', stubFora], ['com conta', stubAdmin]]){
  const { ctx, p, erros } = await abrir({ stub, vp:{ width:390, height:844 } });
  const vazou = [];
  for (const e of ETAPAS){
    await ir(p, '#' + e, 550);
    if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth)) vazou.push(e);
  }
  confere(`${nome}: nenhuma etapa vaza para os lados`, vazou.length === 0, vazou);
  await ir(p, '#tarefas');
  confere(`${nome}: a barra de baixo tem o Continuar`, await p.isVisible('#pe-m .prox') && (await p.textContent('#pe-m .prox')).includes('Placar'));
  confere(`${nome}: o trilho da esquerda some`, await p.isHidden('#trilho'));
  await p.click('#hd-etapas');
  confere(`${nome}: o botão Etapas abre a gaveta com as treze`, await p.isVisible('#gaveta') && await p.locator('#gaveta [data-trilho] li').count() === 13);
  await p.locator('#gaveta a[href="#agenda"]').click(); await p.waitForTimeout(500);
  confere(`${nome}: escolher uma etapa leva a ela e fecha a gaveta`, (await h1(p)).includes('agenda') && await p.isHidden('#gaveta'));
  confere(`${nome}: sem erro na página`, erros.length === 0, erros);
  await ctx.close();
}
{
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1';
  const { ctx, p } = await abrir({ hash:'#celular', ua, vp:{ width:390, height:844 } });
  confere('no iPhone, a aba do iPhone vem escolhida', await p.getAttribute('.abas-ap [data-ap="ios"]', 'aria-selected') === 'true');
  confere('com o Compartilhar e o Adicionar à Tela de Início', (await p.textContent('#ap-painel')).includes('Adicionar à Tela de Início'));
  confere('e no celular os botões do SOMA abrem na mesma aba', await p.locator('a.btn[href="./"][target="soma"]').count() === 0);
  await p.click('.abas-ap [data-ap="android"]'); await p.waitForTimeout(400);
  confere('a aba do Android ensina os três pontinhos', (await p.textContent('#ap-painel')).includes('Adicionar à tela inicial'));
  await ctx.close();
}

/* ---------- 5. os links do e-mail, o tema e o resto ---------- */
console.log('\nOs links do e-mail e o tema');
{
  const { ctx, p } = await abrir({ stub: stubFora, hash:'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired' });
  confere('o link de confirmação vencido cai na conta, com o recado', (await p.textContent('#auth')).includes('expirou ou já foi usado'));
  confere('e o endereço fica limpo', (await p.evaluate(() => location.hash)) === '#conta');
  await ctx.close();
}
{
  const ctx = await nav.newContext();
  const p = await ctx.newPage();
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stubFora }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.goto('http://localhost:8765/tour.html#access_token=abc&type=recovery', { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(800);
  const u = new URL(p.url());
  confere('o link de nova senha vai para o portal, que tem a tela de criar a senha',
    u.pathname === '/' && await p.locator('#lg-novasenha').isVisible(), p.url());
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ antes: () => { localStorage.setItem('nd.tema', 'claro'); } });
  confere('o tema claro escolhido no SOMA vale no tour', await p.evaluate(() => document.documentElement.dataset.tema) === 'claro');
  await p.click('#hd-tema');
  confere('e o botão volta ao escuro, e lembra', await p.evaluate(() => !document.documentElement.dataset.tema && localStorage.getItem('nd.tema') === 'escuro'));
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ hash:'#tarefas', antes: () => { localStorage.setItem('nd.tour.ultima', '"placar"'); } });
  await ir(p, '#bem-vindo');
  confere('quem volta ao começo pode continuar de onde parou', (await p.textContent('.retomar')).includes('Tarefas'));
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s)` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
