import {chromium} from 'playwright';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});let n=0;
try{const p=await browser.newPage();await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8')}));await p.route('https://fonts.googleapis.com/**',r=>r.abort());
await p.goto('http://localhost:8765/#/studio/criar/livre');await p.locator('#cr-cv').waitFor();
const result=await p.evaluate(()=>{
 const sample=JSON.parse(crREADME().match(/Formato: (\{[^\n]+\})\./)[1]);const valid=crLerIA(JSON.stringify(sample));
 const rejected=[];for(const patch of [{versao:2},{tema:'synapse'},{modelo:'__proto__'},{laminas:[]},{laminas:[{layout:'capa',campos:{script:'alert(1)'}}]}]){try{crLerIA(JSON.stringify({...sample,...patch}));rejected.push(false);}catch{rejected.push(true);}}
 return {valid:valid.peca.laminas.length===1&&valid.peca.estilo.tema==='cortex',rejected,markdown:crLerIA('```json\n'+JSON.stringify(sample)+'\n```').titulo===sample.titulo};});
assert.ok(result.valid);n++;assert.ok(result.markdown);n++;assert.deepEqual(result.rejected,[true,true,true,true,true]);n+=5;
await p.evaluate(()=>{const fieldset=document.createElement('fieldset');fieldset.id='select-fixture';fieldset.style.cssText='position:fixed;top:160px;left:400px;width:300px;z-index:9000;background:var(--panel)';fieldset.innerHTML='<label for="s-test">Teste</label><select id="s-test"><option value="a">Alfa</option><option value="b">Beta</option><option disabled value="c">Gama</option></select>';document.body.append(fieldset);});
const button=p.locator('#select-fixture .nro-select-button');await button.waitFor();await button.click();await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');assert.equal(await p.locator('#s-test').inputValue(),'b');n++;
await p.selectOption('#s-test','a');assert.equal(await button.textContent(),'Alfa');n++;
await p.evaluate(()=>document.querySelector('#select-fixture').disabled=true);await p.waitForTimeout(30);assert.ok(await button.isDisabled());n++;
await p.evaluate(()=>document.querySelector('#select-fixture').disabled=false);await button.click();await p.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');n++;
console.log(n+' verificações de select e importação por IA passaram.');}finally{await browser.close();}
