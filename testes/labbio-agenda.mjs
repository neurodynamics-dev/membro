/* L8: agenda consultiva, endereço único dos tablets e aviso no evento do portal. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
// O catálogo antigo da agenda usa e1; a fixture das consultas usa ev1. Só o teste liga as duas fixtures.
const ponte=`;(()=>{const criar=supabase.createClient;supabase.createClient=(...a)=>{const c=criar(...a),rpc=c.rpc.bind(c);c.rpc=async(n,p)=>{if(n==='agenda_evento'&&p.p_id==='ev1'){const r=await rpc(n,{p_id:'e1'});r.data.evento.id='ev1';if(window.__leitura)r.data.pode_editar=false;return r;}return rpc(n,p);};return c;};})();`;
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let falhas=0,checks=0;
function confere(nome,ok,detalhe){checks++;console.log(`${ok?'  ok ':'FALHA'}  ${nome}${ok||detalhe===undefined?'':' → '+JSON.stringify(detalhe)}`);if(!ok)falhas++;}
async function abrir(portal=false,leitura=false){
 const ctx=await nav.newContext({viewport:{width:1440,height:960}});ctx.setDefaultTimeout(10000);
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.clock.setFixedTime(new Date('2026-10-07T12:00:00Z'));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub+(portal?ponte:'')}));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());await p.route('**/raw.githubusercontent.com/**',r=>r.abort());
 await p.addInitScript(({portal,leitura})=>{window.__teste=portal?{}:{labbio:{conta:'ativo'}};window.__leitura=leitura;
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async s=>{window.__copiado=s;}}});},{portal,leitura});
 await p.goto('http://localhost:8765/'+(portal?'index.html#/agenda/evento/ev1':'labbio/index.html#/agenda'),{waitUntil:'domcontentloaded'});
 await p.waitForSelector(portal?'#ag-labbio-consulta p':'#lb-ag-eventos [data-evento]');
 return {ctx,p,erros};
}
async function fechar({ctx,erros}){confere('sem erro de página',!erros.length,erros);await ctx.close();}
const evento=(p,id)=>p.locator(`[data-evento="${id}"]`);
const rpcs=(p,nome)=>p.evaluate(n=>window.__rpcs.filter(x=>x.nome===n),nome);
try{
 {
  const t=await abrir(),{p}=t;
  confere('mostra três eventos e a sobreposição consultiva',await p.locator('[data-evento]').count()===3&&await evento(p,'ev1').textContent().then(s=>s.includes('Sem resposta')&&s.includes('Cruza com Banca')));
  confere('nunca afirma Confirmado',!await p.locator('#lb-main').innerText().then(s=>/confirmado/i.test(s)));
  const inicial=(await rpcs(p,'labbio_agenda'))[0].p;
  confere('semana atual de segunda a domingo',inicial.p_de==='2026-10-05'&&inicial.p_ate==='2026-10-11',inicial);
  await p.getByRole('button',{name:'Próxima semana',exact:true}).click();await p.waitForFunction(()=>lab.agenda.dados&&document.querySelector('[data-evento]'));
  confere('próxima semana consulta o período correto',(await rpcs(p,'labbio_agenda')).at(-1).p.p_de==='2026-10-12');
  await p.getByRole('button',{name:'Semana anterior',exact:true}).click();await p.locator('[data-evento="ev1"]').waitFor();
  await p.fill('#lb-ag-dia','2026-10-21');await p.locator('[data-evento="ev1"]').waitFor();
  confere('data escolhida alinha a semana à segunda',(await rpcs(p,'labbio_agenda')).at(-1).p.p_de==='2026-10-19');
  await p.getByRole('button',{name:'Auditório',exact:true}).click();
  confere('filtro por sala',await p.locator('[data-evento]').count()===1&&await evento(p,'ev3').count()===1);
  await p.getByRole('button',{name:'Todos',exact:true}).click();
  await evento(p,'ev1').getByRole('button',{name:'Conflito',exact:true}).click();
  const antes=(await rpcs(p,'labbio_consulta_decidir')).length;
  await p.getByRole('button',{name:'Apontar conflito',exact:true}).click();
  confere('sem motivo não chama a RPC',await p.locator('#lb-ag-motivo-erro').innerText()==='Informe o motivo do conflito.'&&(await rpcs(p,'labbio_consulta_decidir')).length===antes);
  await p.fill('#lb-ag-motivo','A sala estará em manutenção');await p.getByRole('button',{name:'Apontar conflito',exact:true}).click();
  await evento(p,'ev1').getByText('A sala estará em manutenção',{exact:true}).waitFor();
  confere('conflito envia o motivo e atualiza a pill',(await rpcs(p,'labbio_consulta_decidir')).at(-1).p.p_disponivel===false&&await evento(p,'ev1').locator('.pill').textContent()==='Conflito');
  await evento(p,'ev3').getByRole('button',{name:'Disponível',exact:true}).click();
  await evento(p,'ev3').locator('.pill.p-ok').waitFor();
  confere('Disponível envia a decisão positiva',(await rpcs(p,'labbio_consulta_decidir')).at(-1).p.p_disponivel===true);
  await p.getByRole('button',{name:'Cadastrar tablet',exact:true}).click();
  await p.locator('#lb-modal').getByRole('button',{name:'Cadastrar tablet',exact:true}).click();
  confere('cadastro exige rótulo',!(await rpcs(p,'labbio_dispositivo_criar')).length&&await p.locator('#lb-ag-tablet-erro').innerText().then(s=>s.includes('rótulo')));
  await p.selectOption('#lb-ag-sala','1');await p.fill('#lb-ag-rotulo','Porta da sala de reuniões');
  await p.locator('#lb-modal').getByRole('button',{name:'Cadastrar tablet',exact:true}).click();await p.locator('#lb-ag-endereco').waitFor();
  const endereco=await p.inputValue('#lb-ag-endereco');
  confere('endereço completo e aviso de uso único',endereco==='http://localhost:8765/sala.html?d='+'ab'.repeat(24)&&await p.locator('#lb-modal').innerText().then(s=>s.includes('Este endereço só aparece agora.')));
  await p.keyboard.press('Escape');confere('modal persistente não fecha por Escape',await p.locator('#lb-ag-endereco').isVisible());
  await p.getByRole('button',{name:'Copiar',exact:true}).click();confere('Copiar usa o endereço exibido',await p.evaluate(()=>window.__copiado)===endereco);
  await p.getByRole('button',{name:'Fechar',exact:true}).click();
  confere('fechar apaga o token do DOM',!await p.content().then(s=>s.includes('sala.html?d=')));
  await p.evaluate(()=>{location.hash='#/';});await p.locator('#lb-h1').filter({hasText:'Início'}).waitFor();
  await p.evaluate(()=>{location.hash='#/agenda';});await p.locator('[data-tablet="d2"]').waitFor();
  confere('reabrir lista o tablet sem repetir o endereço',!await p.content().then(s=>s.includes('sala.html?d='))&&await p.locator('[data-tablet="d2"]').innerText().then(s=>s.includes('Porta da sala de reuniões')&&s.includes('—')));
  await p.getByRole('button',{name:'Revogar Porta da sala de reuniões',exact:true}).click();await p.locator('#lb-modal').getByRole('button',{name:'Revogar',exact:true}).click();
  await p.locator('[data-tablet="d2"]').getByText('Revogado',{exact:true}).waitFor();
  confere('revogar usa o id correto',(await rpcs(p,'labbio_dispositivo_revogar')).at(-1).p.p_id==='d2');await fechar(t);
 }
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>{const rpc=sb.rpc.bind(sb);sb.rpc=async(n,a)=>{if(n==='labbio_consulta_decidir')return {data:{status:'invalidada'},error:null};return rpc(n,a);};});
  const antes=(await rpcs(p,'labbio_agenda')).length;
  await evento(p,'ev1').getByRole('button',{name:'Disponível',exact:true}).click();await p.getByText('O evento mudou; recarregue.',{exact:true}).waitFor();
  confere('consulta invalidada avisa e recarrega',(await rpcs(p,'labbio_agenda')).length===antes+1);await fechar(t);
 }
 for(const leitura of [false,true]){
  const t=await abrir(true,leitura),{p}=t;
  const texto=await p.locator('#ag-labbio-consulta').innerText();
  confere(`${leitura?'leitura':'organizador'}: informa consulta sem resposta e só o horário sobreposto`,texto.includes('sem resposta')&&texto.includes('das 10:30 às 11:30')&&!texto.includes('Banca'));
  confere('o portal usa o evento correto',(await rpcs(p,'labbio_consulta_do_evento')).at(-1).p.p_evento==='ev1');
  await p.evaluate(()=>{window.__lbEv[0].consulta={situacao:'conflito',motivo:'Bancada indisponível'};return agConsultaLabbioCarregar(agenda.ev);});
  confere('conflito preserva o evento marcado',await p.locator('#ag-labbio-consulta').innerText().then(s=>s.includes('O LABBIO apontou conflito: Bancada indisponível.')&&s.includes('O evento continua marcado; ajuste se precisar.')));
  await p.evaluate(()=>{window.__lbEv[0].consulta={situacao:'disponivel'};return agConsultaLabbioCarregar(agenda.ev);});
  confere('disponível aparece como resposta consultiva',await p.locator('#ag-labbio-consulta').innerText().then(s=>s.includes('LABBIO: disponível.')));await fechar(t);
 }
 if(process.env.LABBIO_CAPTURAS){
  mkdirSync(process.env.LABBIO_CAPTURAS,{recursive:true});
  for(const tema of ['claro','escuro'])for(const width of [1440,390]){
   const t=await abrir(),{p}=t;await p.setViewportSize({width,height:960});await p.evaluate(t=>document.documentElement.dataset.tema=t,tema);await p.evaluate(()=>document.fonts.ready);
   confere(`${tema} ${width}: sem rolagem horizontal da página`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:`${process.env.LABBIO_CAPTURAS}/agenda-${tema}-${width}.png`,fullPage:true});await fechar(t);
  }
 }
}finally{await nav.close();}
console.log(falhas?`\n${falhas} falha(s) em ${checks} verificações.`:`\nTudo certo. ${checks} verificações passaram.`);process.exitCode=falhas?1:0;
