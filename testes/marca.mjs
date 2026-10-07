import {chromium} from 'playwright';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});let n=0;
try{for(const papel of ['admin','leitura']){
 const p=await nav.newPage({viewport:{width:390,height:844}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub.replace("papel:'admin'",`papel:'${papel}'`)}));
 await p.route('https://brand.neurodynamics.dev/**',r=>r.abort());await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.goto('http://localhost:8765/#/marca');await p.getByRole('heading',{name:'Estáticos',exact:true}).waitFor();
 assert.equal(await p.locator('.marca-grid').count(),3);n++;
 assert.equal(await p.locator('.marca-grid button').filter({hasText:'desktop'}).count(),4);n++;
 await p.evaluate(()=>location.hash='#/marca/assinatura');await p.locator('#marca-sig-nome').waitFor();assert.equal(await p.locator('#marca-sig-nome').inputValue(),'Ana Figueiredo');n++;
 await p.locator('#marca-sig-pronomes').fill('ela/dela');assert.ok((await p.locator('#marca-sig-completa').getAttribute('srcdoc')).includes('ela/dela'));n++;
 await p.evaluate(()=>location.hash='#/marca/interfaces');await p.getByRole('heading',{name:'Prompts para LLMs'}).waitFor();assert.equal(await p.getByRole('button',{name:'Copiar prompt',exact:true}).count(),5);n++;
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));n++;
 await p.evaluate(()=>location.hash='#/marca/config');await p.waitForTimeout(400);
 if(papel==='admin'){assert.ok(await p.getByRole('button',{name:'Salvar vínculos'}).isVisible());n++;}else{assert.equal(await p.evaluate(()=>location.hash),'#/marca');n++;}
 assert.deepEqual(erros,[]);n++;await p.close();
}console.log(n+' verificações da Marca passaram.');}finally{await nav.close();}
