/* R4: a cobrança vem do servidor; o recadastro conserva a prioridade. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let falhas=0,checks=0;
function confere(nome,ok,detalhe){checks++;console.log(`${ok?'  ok ':'FALHA'}  ${nome}${ok||detalhe===undefined?'':' → '+JSON.stringify(detalhe)}`);if(!ok)falhas++;}
async function abrir(cobranca='nenhuma',hash='#/agenda',rec=null,papel='lideranca'){
 const ctx=await nav.newContext({viewport:{width:1440,height:960}});ctx.setDefaultTimeout(10000);
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>erros.push(e.message));
 // A data está antes do prazo: inclusive o bloqueio deve obedecer à RPC, não ao relógio local.
 await p.clock.setFixedTime(new Date('2026-10-09T15:00:00Z'));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub.replace("papel:'admin'",`papel:'${papel}'`)}));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/raw.githubusercontent.com/**',r=>r.abort());
 await p.addInitScript(({cobranca,rec})=>{
  window.__teste={reporteLider:{cobranca},rec};
  const intervalo=window.setInterval;
  window.setInterval=(fn,ms,...args)=>{if(ms===5*60e3)window.__consultarCobranca=fn;return intervalo(fn,ms,...args);};
 },{cobranca,rec});
 await p.goto('http://localhost:8765/index.html'+hash,{waitUntil:'domcontentloaded'});
 await p.waitForFunction(()=>!!state.reporteTimer);return {ctx,p,erros};
}
async function fechar({ctx,erros}){confere('sem erro de página',!erros.length,erros);await ctx.close();}
const ir=async(p,hash)=>{await p.evaluate(h=>location.hash=h,hash);await p.waitForTimeout(300);};
try{
 {
  const t=await abrir(),{p}=t;
  confere('sem cobrança abre a agenda sem aviso',await p.evaluate(()=>location.hash==='#/agenda'&&!document.querySelector('#modal.open')));
  await fechar(t);
 }
 {
  const t=await abrir('aviso'),{p}=t;await p.locator('#modal.open').waitFor();
  confere('aviso explica a reunião',await p.locator('#modal').innerText().then(s=>s.includes('Hoje às 16h é a reunião da gerência.')));
  await p.getByRole('button',{name:'Agora não',exact:true}).click();
  confere('adiar mantém a agenda e grava a dispensa da sessão',await p.evaluate(()=>location.hash==='#/agenda'&&sessionStorage.getItem('nd.reporte.aviso.cl1')==='1'&&!document.querySelector('#modal.open')));
  await ir(p,'#/atividades');await ir(p,'#/agenda');
  await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!state.reporteTimer);
  confere('nem trocar de rota nem reabrir o portal repete o aviso na sessão',await p.locator('#modal.open').count()===0);
  await fechar(t);
 }
 {
  const t=await abrir('aviso'),{p}=t;
  await p.getByRole('button',{name:'Abrir o reporte',exact:true}).click();await p.locator('#main .etapas').waitFor();
  confere('abrir pelo aviso leva ao reporte e fecha o modal',await p.evaluate(()=>location.hash==='#/servicos/reporte/1'&&!document.querySelector('#modal.open')));await fechar(t);
 }
 {
  const t=await abrir('obrigatoria'),{p}=t;
  confere('cobrança obrigatória desvia a agenda',await p.evaluate(()=>location.hash.startsWith('#/servicos/reporte')));
  confere('a faixa vem antes do cabeçalho',await p.locator('#main > :first-child').innerText().then(s=>s.includes('Passou das 16h de sexta')));
  await ir(p,'#/atividades');confere('também desvia atividades',await p.evaluate(()=>location.hash.startsWith('#/servicos/reporte')));
  await ir(p,'#/versoes');confere('libera as notas de versão',await p.evaluate(()=>location.hash==='#/versoes'));
  await ir(p,'#/servicos/reporte/2');confere('permite os passos do reporte',await p.evaluate(()=>location.hash==='#/servicos/reporte/2'));
  await p.getByRole('button',{name:'Estive ausente',exact:true}).click();
  confere('ausência exige a confirmação sem avaliações',await p.locator('#modal').innerText().then(s=>s.includes('O reporte fica dispensado, sem avaliar ninguém.')));
  await p.locator('#modal').getByRole('button',{name:'Estive ausente',exact:true}).click();
  await p.waitForFunction(()=>location.hash==='#/'&&state.obrigacao.reporte.status==='nenhuma');
  confere('ausência usa o ciclo e não envia avaliações',await p.evaluate(()=>window.__rpcs.some(x=>x.nome==='reporte_ausente'&&x.p.p_ciclo==='cl1')&&!window.__rpcs.some(x=>x.nome==='reporte_enviar')));
  await ir(p,'#/agenda');confere('ausência libera a agenda',await p.evaluate(()=>location.hash==='#/agenda'));await fechar(t);
 }
 {
  const t=await abrir('obrigatoria','#/servicos/reporte/4'),{p}=t;
  await p.click('#rep-enviar');await p.locator('#modal').getByRole('button',{name:'Enviar reporte',exact:true}).click();
  await p.waitForFunction(()=>state.obrigacao.reporte.status==='nenhuma'&&!reporte.mutando);
  await p.locator('#main [role="status"]').filter({hasText:'Reporte enviado em'}).waitFor();
  confere('enviar atualiza as obrigações e retira a faixa',await p.locator('#main [role="alert"]').count()===0);
  // Atividades completa a rota com o prefixo do quadro ao abrir.
  await ir(p,'#/atividades');confere('enviar libera atividades',await p.evaluate(()=>location.hash.startsWith('#/atividades')),await p.evaluate(()=>location.hash));await fechar(t);
 }
 {
  const t=await abrir('aviso','#/agenda',{}),{p}=t;
  confere('o painel de recadastro tem prioridade sobre o aviso',await p.locator('#rec-ov').count()===1&&await p.locator('#modal.open').count()===0);await fechar(t);
  const b=await abrir('obrigatoria','#/agenda',{dispensa:true});
  confere('o bloqueio do recadastro tem prioridade',await b.p.evaluate(()=>location.hash==='#/servicos/recadastro'));
  await ir(b.p,'#/servicos/dados');confere('Meus dados continua permitido no recadastro',await b.p.evaluate(()=>location.hash==='#/servicos/dados'));await fechar(b);
 }
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>{window.__teste.reporteLider.cobranca='obrigatoria';document.dispatchEvent(new Event('visibilitychange'));});
  await p.waitForFunction(()=>location.hash.startsWith('#/servicos/reporte'));
  confere('voltar à aba consulta o servidor e aplica o bloqueio',await p.evaluate(()=>state.obrigacao.reporte.status==='obrigatoria'));await fechar(t);
  const u=await abrir();
  await u.p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});window.__teste.reporteLider.cobranca='obrigatoria';});
  const antes=await u.p.evaluate(()=>window.__rpcs.filter(x=>x.nome==='reporte_cobranca_estado').length);
  await u.p.evaluate(()=>window.__consultarCobranca());
  confere('o intervalo de cinco minutos não consulta com aba oculta',await u.p.evaluate(()=>window.__rpcs.filter(x=>x.nome==='reporte_cobranca_estado').length)===antes);
  await u.p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});return window.__consultarCobranca();});
  confere('o intervalo aplica a cobrança com aba visível',await u.p.evaluate(()=>location.hash.startsWith('#/servicos/reporte')));
  await u.p.evaluate(()=>{const rpc=sb.rpc.bind(sb);sb.rpc=(nome,p)=>nome==='reporte_cobranca_estado'?Promise.reject(new Error('offline')):rpc(nome,p);return window.__consultarCobranca();});
  confere('falha de conexão não apaga a cobrança',await u.p.evaluate(()=>state.obrigacao.reporte.status==='obrigatoria'));await fechar(u);
 }
 {
  const t=await abrir('obrigatoria','#/agenda',null,'membro'),{p}=t;
  await p.evaluate(()=>window.__consultarCobranca());
  confere('perfil sem liderança não consulta a cobrança',await p.evaluate(()=>!window.__rpcs.some(x=>x.nome==='reporte_cobranca_estado')));await fechar(t);
 }
 if(process.env.REPORTE_CAPTURAS){
  mkdirSync(process.env.REPORTE_CAPTURAS,{recursive:true});
  for(const cobranca of ['aviso','obrigatoria'])for(const tema of ['escuro','claro'])for(const width of [1440,390]){
   const t=await abrir(cobranca),{p}=t;
   await p.route('https://brand.neurodynamics.dev/assets/**',r=>r.fulfill({path:'/workspace/brand/assets/'+new URL(r.request().url()).pathname.split('/').pop()}));
   await p.setViewportSize({width,height:960});await p.evaluate(t=>aplicarTema(t),tema);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
   confere(`${cobranca} ${tema} ${width}: sem rolagem horizontal`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:`${process.env.REPORTE_CAPTURAS}/cobranca-${cobranca}-${tema}-${width}.png`,fullPage:true});await fechar(t);
  }
 }
}finally{await nav.close();}
console.log(falhas?`\n${falhas} falha(s) em ${checks} verificações.`:`\nTudo certo. ${checks} verificações passaram.`);process.exitCode=falhas?1:0;
