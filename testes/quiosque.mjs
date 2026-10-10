/* O quiosque do LABBIO (quiosque.html). Confere, com asserção de verdade:
     1. sem sessão, pede a conta do quiosque; o código não tem segredo;
     2. entrando, chama quiosque_estado_conta e desenha a tela (layout A);
     3. ?layout=b troca a grade e esconde o widget que só existe no A;
     4. widgets: slides giram com progresso segmentado, no máximo 4, e o slide
        sem conteúdo é pulado (sem avisos, o Aviso não aparece);
     5. a chegada (check-in novo) mostra "Chegada registrada" e some;
     6. sessão perdida volta a pedir a conta; offline não pede conta;
     7. com movimento reduzido nada gira.
   Fotos em testes/quiosque-*.png (fora do git). Servir a raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const html = readFileSync(new URL('../quiosque.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0;
const confere = (nome, ok, d) => { console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || d === undefined ? '' : '  → ' + JSON.stringify(d)}`); if (!ok) falhas++; };
confere('quiosque.js não carrega segredo (SEGREDO_QUIOSQUE, p_segredo)', !/SEGREDO_QUIOSQUE|p_segredo|Zurich/.test(html) && !/SEGREDO_QUIOSQUE|p_segredo|Zurich/.test(readFileSync(new URL('../quiosque.html', import.meta.url), 'utf8')));

const STUB = `window.supabase={createClient(){const st={sessao:localStorage.getItem('sessao')==='1',chamadas:[]};window.__q=st;
 return {auth:{getSession:async()=>({data:{session:st.sessao?{}:null}}),signInWithPassword:async({email,password})=>{if(password!=='certa')return{error:{message:'invalid'}};st.sessao=true;localStorage.setItem('sessao','1');return{error:null};}},
 rpc:async(n)=>{st.chamadas.push(n);
  if(n==='quiosque_estado_conta'){if(st.perdida)return{data:null,error:{status:401,message:'JWT expired'}};if(st.offline)return{data:null,error:{message:'Failed to fetch'}};
   return{data:{status:'ok',token:'TOK'+(st.tok||1),expira_em:30,
    eventos_hoje:[{inicio:'09:00',fim:'09:30',titulo:'Daily de P&D',espaco:'Sala 2',confirmados:8},{inicio:'10:00',fim:'23:00',titulo:'Reunião geral',espaco:'Auditório',confirmados:12,em_andamento:true},{inicio:'23:30',fim:'23:59',titulo:'Seminário',espaco:'Auditório',confirmados:28}],
    presentes:[{registro:4,departamento:'P&D'},{registro:5,departamento:'Pesquisa'},{registro:6,departamento:'Clínica'}],
    ultimos_checkins:[{registro:4,nome:'Ana Clara Silva',departamento:'Clínica',hora:'09:41'},{registro:5,nome:'Isadora Pimentel',departamento:'P&D',hora:'09:12'}],
    ultimo_evento:st.ev||null}};}
  if(n==='labbio_placar')return{data:{ranking:[{registro:4,nome:'Nicolas Xavier',dias:14},{registro:5,nome:'Sarah Cunha',dias:13}],sequencias:[{registro:4,nome:'Nicolas Xavier',atual:5,recorde:9}]},error:null};
  if(n==='quiosque_painel')return st.semPainel?{data:null,error:{message:'inexistente'}}:{data:{avisos:[],novos:[{registro:9,nome:'Carla Mendonça'}]},error:null};
  return{data:null,error:null};}};}};
window.QRCode=function(el,o){el.textContent='QR';this.clear=()=>{};this.makeCode=()=>{};};window.QRCode.CorrectLevel={M:0};`;
async function abrir({ q = '', sessao = true, reduzido = false, vp = { width:1440, height:900 } } = {}){
  const ctx = await nav.newContext({ viewport: vp, reducedMotion: reduzido ? 'reduce' : 'no-preference' });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/cdn.jsdelivr.net/**', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  await p.route('**/cdnjs.cloudflare.com/**', r => r.fulfill({ contentType:'application/javascript', body:'' }));
  await p.route('**/api.open-meteo.com/**', r => r.abort());
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(s => { localStorage.setItem('sessao', s); }, sessao ? '1' : '0');
  await p.addInitScript(STUB);
  await p.goto('http://localhost:8765/quiosque.html' + q, { waitUntil:'domcontentloaded' });
  await p.waitForTimeout(900);
  return { ctx, p, erros };
}
/* 1. sem sessão */
{ const { ctx, p, erros } = await abrir({ sessao:false });
  confere('sem sessão: pede a conta do quiosque', await p.locator('#entrar.on').count() === 1);
  await p.fill('#q-email', 'quiosque@x.dev'); await p.fill('#q-senha', 'errada'); await p.click('#q-ok'); await p.waitForTimeout(300);
  confere('senha errada: o erro diz como corrigir', /Confira os dados/.test(await p.locator('#q-erro').textContent()));
  await p.fill('#q-senha', 'certa'); await p.click('#q-ok'); await p.waitForTimeout(900);
  confere('entrando: a tela abre e chama quiosque_estado_conta', await p.locator('#entrar.on').count() === 0 && (await p.evaluate(() => window.__q.chamadas)).includes('quiosque_estado_conta'));
  confere('sem erro de JS (entrada)', !erros.length, erros);
  await ctx.close(); }
/* 2. layout A */
{ const { ctx, p, erros } = await abrir();
  const a = await p.evaluate(() => ({ cols: getComputedStyle(document.getElementById('palco')).gridTemplateColumns.split(' ').length,
    r1: !document.getElementById('r1').hidden, titulos: [...document.querySelectorAll('.widget .w-rot')].map(x => x.textContent),
    passos: document.querySelectorAll('#r2 .w-passos span').length, lateral: document.documentElement.scrollWidth > innerWidth, presn: document.getElementById('presn').textContent }));
  confere('layout A: três colunas e o widget da esquerda', a.cols === 3 && a.r1, a);
  confere('layout A: a agenda gira com no máximo 4 passos, e o Aviso sem conteúdo é pulado', a.titulos.includes('Agenda do LABBIO') && !a.titulos.includes('Aviso') && a.passos <= 4 && a.passos >= 3, a);
  confere('layout A: 3 presentes e sem rolagem lateral', a.presn === '3' && !a.lateral, a);
  await p.screenshot({ path:'testes/quiosque-a.png' });
  for (const f of ['madrugada', 'entardecer', 'noite']){ await p.goto(`http://localhost:8765/quiosque.html?fase=${f}`); await p.waitForTimeout(700); await p.screenshot({ path:`testes/quiosque-a-${f}.png` });
    confere(`fase ${f}: o fundo troca de classe`, await p.evaluate(x => document.body.classList.contains('fase-' + x), f)); }
  confere('sem erro de JS (layout A)', !erros.length, erros);
  await ctx.close(); }
/* 3. layout B */
{ const { ctx, p, erros } = await abrir({ q:'?layout=b' });
  const b = await p.evaluate(() => ({ cols: getComputedStyle(document.getElementById('palco')).gridTemplateColumns.split(' ').length, r1: getComputedStyle(document.getElementById('r1')).display, lateral: document.documentElement.scrollWidth > innerWidth }));
  confere('layout B: duas colunas, sem o widget só do A', b.cols === 2 && b.r1 === 'none' && !b.lateral, b);
  await p.screenshot({ path:'testes/quiosque-b.png' });
  await ctx.close(); }
/* 4. 1080p */
{ const { ctx, p } = await abrir({ vp:{ width:1920, height:1080 } }); await p.screenshot({ path:'testes/quiosque-1080.png' });
  confere('1080p: sem rolagem lateral', await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth)); await ctx.close(); }
/* 5. a chegada, a sessão perdida e o offline */
{ const { ctx, p } = await abrir();
  await p.evaluate(() => { window.__q.ev = { presenca_id:77, registro:4, nome:'Ana Clara Silva', departamento:'Clínica', visitas_mes:6, anterior:'ontem, 09:10' }; });
  await p.waitForSelector('#chegada.on', { timeout:9000 });
  confere('chegada: aparece com o nome e "Chegada registrada"', /Chegada registrada/.test(await p.locator('#chegada').textContent()) && /Ana/.test(await p.locator('#chegada h2').textContent()));
  await p.screenshot({ path:'testes/quiosque-chegada.png' });
  await p.waitForSelector('#chegada:not(.on)', { timeout:12000, state:'attached' }); confere('chegada: some sozinha', true);
  await p.evaluate(() => { window.__q.offline = true; }); await p.waitForTimeout(7000);
  confere('offline: avisa e não pede a conta', await p.locator('#qroff').isVisible() && await p.locator('#entrar.on').count() === 0);
  await p.evaluate(() => { window.__q.offline = false; window.__q.perdida = true; }); await p.waitForTimeout(7000);
  confere('sessão perdida: volta a pedir a conta', await p.locator('#entrar.on').count() === 1);
  await ctx.close(); }
/* 6. movimento reduzido */
{ const { ctx, p } = await abrir({ reduzido:true }); const t1 = await p.locator('#r2 .w-rot').textContent(); await p.waitForTimeout(16000);
  confere('movimento reduzido: o widget fica no primeiro slide', (await p.locator('#r2 .w-rot').textContent()) === t1); await ctx.close(); }
/* 7. os widgets giram */
{ const { ctx, p } = await abrir(); const t1 = await p.locator('#r2 .w-rot').textContent(); await p.waitForTimeout(15000);
  confere('os widgets giram de slide', (await p.locator('#r2 .w-rot').textContent()) !== t1); await ctx.close(); }
await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
