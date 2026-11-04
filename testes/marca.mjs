/* A Marca no SOMA: só o que exige login (Modelos, Assinatura, Configurações).
   Logos, wallpapers e o kit de interface moram no manual público do brand.
   As capas do LinkedIn (2.27.0) também moram no manual: a tela lê o manifesto
   de lá, filtra por idioma e estilo e baixa com o nome certo. */
import {chromium} from 'playwright';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});let n=0;
try{for(const papel of ['admin','leitura']){
 const p=await nav.newPage({viewport:{width:390,height:844}});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub.replace("papel:'admin'",`papel:'${papel}'`)}));
 await p.route('https://brand.neurodynamics.dev/**',r=>r.abort());await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 await p.goto('http://localhost:8765/#/marca');await p.getByRole('heading',{name:'Modelos',exact:true}).waitFor();
 assert.equal(await p.locator('#main .cab .eyebrow').textContent(),'Marca');n++;
 assert.equal(await p.locator('.marca-tile').count(),14);n++;
 /* o que era público saiu daqui */
 assert.equal(await p.locator('.marca-tile').getByText(/Wallpaper|desktop|Imagotipo/).count(),0);n++;
 assert.equal(await p.locator('.marca-tile button').count(),0);n++;
 await p.getByRole('button',{name:'Controlados'}).click();assert.equal(await p.locator('.marca-tile').count(),6);n++;
 await p.getByRole('button',{name:'Templates'}).click();assert.equal(await p.locator('.marca-tile').count(),8);n++;
 assert.ok(await p.getByRole('link',{name:/Abrir o manual/}).isVisible());n++;
 assert.equal(await p.locator('#main .btn.solid').count(),1);n++;
 await p.evaluate(()=>location.hash='#/marca/assinatura');await p.locator('#marca-sig-nome').waitFor();assert.equal(await p.locator('#marca-sig-nome').inputValue(),'Ana Figueiredo');n++;
 await p.locator('#marca-sig-pronomes').fill('ela/dela');assert.ok((await p.locator('#marca-sig-previa').getAttribute('srcdoc')).includes('ela/dela'));n++;
 await p.getByRole('button',{name:'Resposta',exact:true}).click();assert.ok(!(await p.locator('#marca-sig-previa').getAttribute('srcdoc')).includes('Nova mensagem'));n++;
 assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));n++;
 await p.evaluate(()=>location.hash='#/marca/interfaces');await p.getByRole('heading',{name:'Interfaces'}).waitFor();assert.ok(await p.getByRole('link',{name:/Abrir o manual/}).isVisible());n++;
 await p.evaluate(()=>location.hash='#/marca/config');await p.waitForTimeout(500);
 if(papel==='admin'){assert.ok(await p.getByRole('button',{name:'Salvar vínculos'}).isVisible());n++;}else{assert.equal(await p.evaluate(()=>location.hash),'#/marca');n++;}
 assert.deepEqual(erros,[]);n++;await p.close();
}
/* as capas do LinkedIn (2.27.0): o manifesto e as imagens vêm do manual; aqui, um manifesto de teste */
const JPG=Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAAQABABAREA/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAA/AKp//9k=','base64');
const capa=(id,idioma,estilo,frase)=>({id,idioma,estilo,frase,familia:'cortex',previa:`assets/manual/linkedin/${id}.jpg`,
 perfil:{arquivo:`downloads/linkedin/perfil/${id}.jpg`,largura:3168,altura:792},empresa:{arquivo:`downloads/linkedin/empresa/${id}.jpg`,largura:2256,altura:382},
 foto:{descricao:'Foto',autor:'Fulana',banco:'Unsplash',licenca:'Licença Unsplash',pagina:'https://unsplash.com/photos/x'}});
const MANIFESTO={capas:[capa('en-tools-for-health','en','foto','Tools for health.'),capa('en-health-engineered','en','faixa','Health, engineered.'),capa('pt-da-bancada-a-clinica','pt','faixa','Da bancada à clínica.')]};
const SO_EN={capas:MANIFESTO.capas.filter(c=>c.idioma==='en')};
for(const modo of ['ok','falha','so-en']){const falha=modo==='falha';
 const p=await nav.newPage({viewport:{width:390,height:844},acceptDownloads:true});const erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub}));
 await p.route('https://brand.neurodynamics.dev/**',r=>r.abort());await p.route('https://fonts.googleapis.com/**',r=>r.abort());
 const pedidos=[];
 await p.route('https://brand.neurodynamics.dev/downloads/linkedin/index.json',r=>falha?r.fulfill({status:404,body:''}):r.fulfill({contentType:'application/json',body:JSON.stringify(modo==='so-en'?SO_EN:MANIFESTO),headers:{'Access-Control-Allow-Origin':'*'}}));
 await p.route(/brand\.neurodynamics\.dev\/(assets\/manual|downloads)\/linkedin\/.*\.jpg$/,r=>{pedidos.push(new URL(r.request().url()).pathname);r.fulfill({contentType:'image/jpeg',body:JPG,headers:{'Access-Control-Allow-Origin':'*'}});});
 await p.goto('http://localhost:8765/#/marca/linkedin');await p.getByRole('heading',{name:'Capas do LinkedIn',exact:true}).waitFor();
 if(modo==='so-en'){
  /* 2.27.1: com as capas todas em inglês, o filtro de idioma não aparece; o de estilo, sim */
  await p.locator('.li-tile').first().waitFor();assert.equal(await p.locator('.li-tile').count(),2);n++;
  assert.equal(await p.getByRole('group',{name:'Idioma'}).count(),0);n++;
  assert.ok(await p.getByRole('group',{name:'Estilo'}).isVisible());n++;
  await p.getByRole('group',{name:'Estilo'}).getByRole('button',{name:'Foto e faixa'}).click();
  assert.deepEqual(await p.locator('.li-tile h3').allTextContents(),['Health, engineered.']);n++;
 }else if(falha){
  await p.locator('.estado-erro').waitFor();assert.ok((await p.locator('.estado-erro').textContent()).includes('As capas não abriram'));n++;
  assert.ok(await p.getByRole('button',{name:'Tentar de novo'}).isVisible());n++;
 }else{
  await p.locator('.li-tile').first().waitFor();
  assert.equal(await p.locator('.nav1 a.on, .secoes a.on, [aria-current="page"]').filter({hasText:'Capas do LinkedIn'}).count()>0,true);n++;
  assert.equal(await p.locator('.li-tile').count(),3);n++;
  await p.locator('.li-tile img').first().scrollIntoViewIfNeeded();
  await p.waitForFunction(()=>{const i=document.querySelector('.li-tile img');return i&&i.complete&&i.naturalWidth>0;});
  assert.ok(pedidos.some(x=>x==='/assets/manual/linkedin/en-tools-for-health.jpg'));n++;
  await p.getByRole('group',{name:'Idioma'}).getByRole('button',{name:'Português'}).click();assert.equal(await p.locator('.li-tile').count(),1);n++;
  await p.getByRole('group',{name:'Idioma'}).getByRole('button',{name:'Inglês'}).click();
  await p.getByRole('group',{name:'Estilo'}).getByRole('button',{name:'Foto inteira'}).click();
  assert.deepEqual(await p.locator('.li-tile h3').allTextContents(),['Tools for health.']);n++;
  const [d]=await Promise.all([p.waitForEvent('download'),p.locator('.li-tile').first().getByRole('button',{name:'Perfil'}).click()]);
  assert.equal(d.suggestedFilename(),'neurodynamics-linkedin-perfil-en-tools-for-health.jpg');n++;
  const [d2]=await Promise.all([p.waitForEvent('download'),p.locator('.li-tile').first().getByRole('button',{name:'Página da empresa'}).click()]);
  assert.equal(d2.suggestedFilename(),'neurodynamics-linkedin-empresa-en-tools-for-health.jpg');n++;
  assert.ok(pedidos.includes('/downloads/linkedin/empresa/en-tools-for-health.jpg'));n++;
  assert.equal(await p.locator('#main .btn.solid').count(),0);n++;
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));n++;
  assert.ok(await p.evaluate(()=>arvoreDoMenu().some(e=>(e.filhos||[]).some(f=>f.r==='marca'&&f.sub==='linkedin'&&f.rot==='Capas do LinkedIn'))));n++;
 }
 assert.deepEqual(erros,[]);n++;await p.close();
}
console.log(n+' verificações da Marca passaram.');}finally{await nav.close();}
