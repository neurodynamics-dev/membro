/* L10: o tablet usa somente as RPCs anônimas e não decide disponibilidade pelo relógio. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
// A ponte mantém o contrato do stub e permite simular perda de rede com page.route.
const rede=`;(()=>{const criar=supabase.createClient;supabase.createClient=(...a)=>{window.__clienteOpcoes=a[2];const c=criar(...a),rpc=c.rpc.bind(c);c.rpc=async(n,p)=>{await fetch('https://rxzmkyjttzzpwtodqkve.supabase.co/rest/v1/rpc/'+n,{method:'POST',body:JSON.stringify(p)});const r=await rpc(n,p);if(n!=='sala_estado'){delete r.data.sala;delete r.data.rotulo;}return r;};return c;};})();`;
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}),TOKEN='ab'.repeat(24);
let falhas=0,checks=0;
function confere(nome,ok,detalhe){checks++;console.log(`${ok?'  ok ':'FALHA'}  ${nome}${ok||detalhe===undefined?'':' → '+JSON.stringify(detalhe)}`);if(!ok)falhas++;}
async function abrir(estado='livre',viewport={width:600,height:960},token=TOKEN){
 const ctx=await nav.newContext({viewport,timezoneId:'America/Sao_Paulo'});ctx.setDefaultTimeout(10000);
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.clock.install({time:new Date('2026-10-11T12:00:00Z')});
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub+rede}));
 await p.route('**/rest/v1/rpc/sala_*',r=>r.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:'{}'}));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());
 await p.addInitScript(({estado,token})=>{window.__teste={sala:{token,estado,ate:'2026-10-11T20:30:00Z'}};},{estado,token:TOKEN});
 await p.goto('http://localhost:8765/sala.html'+(token?'?d='+token:''),{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>document.getElementById('sala-status').textContent!=='Consultando');
 return {ctx,p,erros};
}
async function fechar({ctx,p,erros}){
 confere('sem rolagem nas duas direções',await p.evaluate(()=>document.documentElement.scrollHeight<=innerHeight&&document.documentElement.scrollWidth<=innerWidth));
 confere('sem erro de página',!erros.length,erros);await ctx.close();
}
const atualiza=async p=>{await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));};
try{
 for(const viewport of [{width:600,height:960},{width:960,height:600}]){
  console.log(`Tablet ${viewport.width} × ${viewport.height}`);
  const t=await abrir('livre',viewport),{p}=t;
  confere('Livre com os dois períodos',await p.locator('#sala-status').innerText()==='Livre'&&await p.getByRole('button',{name:'Ocupar por 15 min'}).isVisible()&&await p.getByRole('button',{name:'Ocupar por 30 min'}).isVisible());
  confere('só a marca LABBIO, a 28 px, sem fundo',await p.locator('img').count()===0&&await p.getByRole('img',{name:'LABBIO'}).count()===1&&await p.locator('.lb-logo').evaluate(e=>e.getBoundingClientRect().height===28&&getComputedStyle(e.parentElement).backgroundColor==='rgba(0, 0, 0, 0)'));
  confere('a marca muda para só "lab·bio" em tela pequena',await p.locator('.lb-logo').evaluate(e=>getComputedStyle(e).maskImage).then(m=>m.includes(viewport.width<=700?'labbio-curto':'labbio-marca')));
  confere('não reutiliza sessão nem procura login',await p.evaluate(()=>window.__clienteOpcoes.auth.persistSession===false&&window.__clienteOpcoes.auth.detectSessionInUrl===false));
  confere('o QR não fica na tela principal',await p.locator('#sala-qr').isHidden()&&await p.locator('#sala-opcoes').isHidden());
  await p.getByRole('button',{name:'Opções'}).click();
  confere('Opções abre o painel com o QR',await p.locator('#sala-opcoes').isVisible()&&await p.locator('#sala-qr svg').isVisible());
  confere('QR aponta ao próximo evento, sem token',await p.locator('#sala-qr svg').count()===1&&await p.locator('#sala-qr').getAttribute('data-url')==='https://membro.neurodynamics.dev/#/agenda/evento/ev3'&&!(await p.locator('#sala-qr').innerHTML()).includes(TOKEN));
  await p.getByRole('button',{name:'Fechar'}).click();
  confere('Fechar volta à tela principal',await p.locator('#sala-opcoes').isHidden()&&await p.locator('#sala-veu').isHidden());
  await p.getByRole('button',{name:'Opções'}).click();await p.keyboard.press('Escape');
  confere('Esc também fecha',await p.locator('#sala-opcoes').isHidden());
  await p.getByRole('button',{name:'Ocupar por 15 min'}).click();await p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Ocupada agora');
  confere('ocupar envia 15 e o token ao servidor',await p.evaluate(token=>window.__rpcs.some(x=>x.nome==='sala_ocupar'&&x.p.p_minutos===15&&x.p.p_token===token),TOKEN));
  confere('ocupação preserva o nome da consulta inicial',await p.locator('#sala-nome').innerText()==='Auditório');
  confere('ocupada só permite Liberar',await p.getByRole('button',{name:'Liberar',exact:true}).isVisible()&&await p.getByRole('button',{name:'Ocupar por 15 min'}).count()===0);
  await p.getByRole('button',{name:'Liberar',exact:true}).click();await p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Livre');
  confere('liberar chama a RPC',await p.evaluate(()=>window.__rpcs.some(x=>x.nome==='sala_liberar')));
  await p.getByRole('button',{name:'Ocupar por 30 min'}).click();await p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Ocupada agora');
  confere('o outro botão pede 30 minutos',await p.evaluate(()=>window.__rpcs.filter(x=>x.nome==='sala_ocupar').at(-1).p.p_minutos===30));await fechar(t);
  const e=await abrir('evento',viewport);
  confere('evento mostra título e fim sem ações',await e.p.locator('#sala-status').innerText()==='Em uso'&&await e.p.locator('#sala-evento').innerText()==='Defesa de TCC'&&await e.p.locator('#sala-ate').innerText()==='até 12:00'&&await e.p.getByRole('button').count()===1&&await e.p.getByRole('button',{name:'Opções'}).isVisible());
  confere('QR prefere o evento atual',await e.p.locator('#sala-qr').getAttribute('data-url')==='https://membro.neurodynamics.dev/#/agenda/evento/ev9');await fechar(e);
  const f=await abrir('livre',viewport);
  await f.p.route('**/rest/v1/rpc/sala_*',r=>r.abort());await atualiza(f.p);
  await f.p.locator('#sala-offline').waitFor({state:'visible'});
  confere('sem conexão mantém a sala, mas não afirma Livre e esconde ações',await f.p.locator('#sala-offline').innerText().then(x=>x.startsWith('Sem atualização desde '))&&await f.p.locator('#sala-status').innerText()==='Sem informação atual'&&await f.p.locator('#sala-nome').innerText()==='Auditório'&&await f.p.getByRole('button').count()===1&&await f.p.getByRole('button',{name:'Opções'}).isVisible());
  await f.p.unroute('**/rest/v1/rpc/sala_*');
  await f.p.route('**/rest/v1/rpc/sala_*',r=>r.fulfill({headers:{'access-control-allow-origin':'*'},body:'{}'}));await atualiza(f.p);
  await f.p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Livre');
  confere('recupera ao voltar à aba com rede',await f.p.locator('#sala-offline').isHidden());await fechar(f);
 }
 {
  const t=await abrir('livre',undefined,'errado');confere('token inválido mostra só a orientação de cadastro',await t.p.locator('#sala-status').innerText()==='Este tablet não está cadastrado ou foi revogado. Peça um endereço novo ao LABBIO.'&&await t.p.getByRole('button').count()===0&&await t.p.locator('#sala-qr svg').count()===0);await fechar(t);
  const vazio=await abrir('livre',undefined,'');confere('sem token não chama RPC',await vazio.p.evaluate(()=>!(window.__rpcs||[]).length));await fechar(vazio);
 }
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>window.__teste.sala.estado='evento');await p.clock.fastForward(60000);
  await p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Em uso');
  confere('consulta de novo no intervalo de 60 segundos',await p.evaluate(()=>window.__rpcs.filter(x=>x.nome==='sala_estado').length>=2));await fechar(t);
 }
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>window.__teste.sala.estado='evento');await p.getByRole('button',{name:'Ocupar por 15 min'}).click();
  await p.waitForFunction(()=>document.getElementById('sala-status').textContent==='Em uso');
  confere('corrida com uma reserva usa em_evento do servidor',await p.locator('#sala-mensagem').innerText()==='A sala já está em uso por um evento.');await fechar(t);
 }
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>window.__teste.sala.token='revogado');await atualiza(p);
  await p.waitForFunction(()=>document.getElementById('sala-estado').dataset.estado==='invalido');
  confere('revogação durante o uso remove ações e QR',await p.getByRole('button').count()===0&&await p.locator('#sala-qr svg').count()===0);await fechar(t);
 }
 if(process.env.SALA_CAPTURAS){
  mkdirSync(process.env.SALA_CAPTURAS,{recursive:true});
  for(const tema of ['claro','escuro'])for(const viewport of [{width:600,height:960},{width:960,height:600},{width:1440,height:960},{width:390,height:960}]){
   const t=await abrir(viewport.width===960?'evento':'livre',viewport);await t.p.evaluate(t=>document.documentElement.dataset.tema=t,tema);await t.p.evaluate(()=>document.fonts.ready);
   await t.p.screenshot({path:`${process.env.SALA_CAPTURAS}/sala-${tema}-${viewport.width}.png`,fullPage:true});await fechar(t);
  }
 }
}finally{await nav.close();}
console.log(falhas?`\n${falhas} falha(s) em ${checks} verificações.`:`\nTudo certo. ${checks} verificações passaram.`);process.exitCode=falhas?1:0;
