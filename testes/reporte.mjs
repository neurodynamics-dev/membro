import {chromium} from 'playwright';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8').replace('rpc: async (nome, args) => {',`rpc: async (nome, args) => {
 if(nome.startsWith('reporte_')||nome.startsWith('feed_'))return window.repStub(nome,args);`);
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let checks=0;
try{
 const p=await nav.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub}));
 await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.addInitScript(()=>{
  const ciclo={id:'c1',semana:'2026-10-05',prazo:'2099-01-01',reuniao_em:'2099-01-02'};
  const frente={id:'f1',nome:'Órtese',responsavel:4,responsavel_nome:'Ana',enviado_em:null};
  let report={id:'r1',frente_id:'f1',versao:1,etapa:1,apontamentos:[{registro:17,assiduidade:'SUFICIENTE',entregas:'SUFICIENTE'}],escalonamentos:[]};
  let feed=[];window.repStub=async(n,p)=>{
   const ok=data=>({data,error:null});
   if(n==='reporte_painel')return ok({status:'ok',ciclo,frentes:[frente],config:{dia_prazo:4,hora_prazo:'18:00',dia_reuniao:0,hora_reuniao:'09:00'}});
   if(n==='reporte_abrir')return ok({status:'ok',reporte:structuredClone(report),ciclo,grupo:{nome:'Órtese'},feed:structuredClone(feed)});
   if(n==='reporte_salvar'){
    if(window.failSave)return ok({status:'conflito'});
    assertPayload(p.p); report=structuredClone({...p.p,versao:report.versao+1});feed=structuredClone(p.p.feed);return ok({status:'ok',versao:report.versao});
   }
   if(n==='reporte_enviar'){frente.enviado_em=report.enviado_em=new Date().toISOString();window.sent=(window.sent||0)+1;return ok({status:'ok'});}
   if(n==='feed_lista')return ok(frente.enviado_em?feed.map((f,i)=>({...f,id:'feed'+i,autor:'Ana',publicado_em:frente.enviado_em})):[]);
   throw Error('RPC de teste não implementada: '+n);
  };
  function assertPayload(p){if(!Array.isArray(p.apontamentos)||!Array.isArray(p.escalonamentos)||!Array.isArray(p.feed))throw Error('Payload incompleto');window.saved=structuredClone(p);}
 });
 await p.goto('http://localhost:8765/#/equipe/reporte');await p.getByRole('button',{name:'Preencher',exact:true}).click();
 await p.locator('#rep-0-entregas').selectOption('INSUFICIENTE');
 await p.getByRole('link',{name:'Escalonamento',exact:true}).click();
 await p.getByRole('button',{name:'Adicionar tópico'}).click();await p.locator('#rep-topico-0').fill('Revisar cronograma');
 await p.getByRole('link',{name:'Feed da equipe',exact:true}).last().click();
 await p.getByRole('button',{name:'Adicionar publicação'}).click();
 await p.locator('#rep-feed-0-titulo').fill('Ensaio concluído');await p.locator('#rep-feed-0-subtitulo').fill('Primeira rodada');await p.locator('#rep-feed-0-texto').fill('Resultado **validado**.');
 await p.getByRole('button',{name:'Salvar rascunho'}).click();await p.waitForFunction(()=>window.saved);
 const saved=await p.evaluate(()=>window.saved);assert.equal(saved.apontamentos[0].entregas,'INSUFICIENTE');checks++;
 assert.equal(saved.escalonamentos[0].texto,'Revisar cronograma');checks++;
 assert.equal(saved.feed[0].subtitulo,'Primeira rodada');checks++;
 await p.evaluate(()=>window.failSave=true);await p.getByRole('button',{name:'Enviar reporte',exact:true}).click();await p.locator('#modal button.solid').click();
 await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>window.sent||0),0);checks++;
 await p.evaluate(()=>window.failSave=false);await p.getByRole('button',{name:'Enviar reporte',exact:true}).click();await p.locator('#modal button.solid').click();
 await p.waitForFunction(()=>window.sent===1);checks++;
 await p.evaluate(()=>location.hash='#/feed');await p.getByRole('heading',{name:'Ensaio concluído'}).waitFor();assert.equal(await p.locator('#feed-lista strong').innerText(),'validado');checks++;
 assert.deepEqual(errors,[]);checks++;
 console.log(`${checks} verificações passaram.`);
}finally{await nav.close();}
