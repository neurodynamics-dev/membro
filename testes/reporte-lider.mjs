/* R3: reporte por liderança direta, sem banco de produção.
   O relógio fica dentro da sprint do contrato para o teste não depender do dia da execução. */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
const stub=readFileSync(new URL('./stub-supabase.js',import.meta.url),'utf8');
const nav=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
let falhas=0,checks=0;
function confere(nome,ok,detalhe){
 checks++;console.log(`${ok?'  ok ':'FALHA'}  ${nome}${ok||detalhe===undefined?'':' → '+JSON.stringify(detalhe)}`);
 if(!ok)falhas++;
}
async function abrir(op={},hash='#/servicos/reporte/1',papel='lideranca',quando='2026-10-09T15:00:00Z'){
 const ctx=await nav.newContext({viewport:{width:1440,height:960}});ctx.setDefaultTimeout(10000);
 const p=await ctx.newPage(),erros=[];p.on('pageerror',e=>erros.push(e.message));
 await p.clock.setFixedTime(new Date(quando));
 await p.route('**/*supabase*.js',r=>r.fulfill({contentType:'application/javascript',body:stub.replace("papel:'admin'",`papel:'${papel}'`).replace("status:'Desligado', grupos:['Marca']",op.participanteAtivo?"status:'Ativo', grupos:['Marca']":"status:'Desligado', grupos:['Marca']")}));
 await p.route('**/fonts.googleapis.com/**',r=>r.abort());
 await p.route('**/raw.githubusercontent.com/**',r=>r.abort());
 await p.addInitScript(op=>{window.__teste={reporteLider:op};},op);
 await p.goto('http://localhost:8765/index.html'+hash,{waitUntil:'domcontentloaded'});
 await p.waitForSelector('#hd:not([hidden])');
 await p.waitForSelector('#main .etapas, #main .estado-vazio, #main .vazio');
 return {ctx,p,erros};
}
async function fechar({ctx,erros}){confere('sem erro de página',erros.length===0,erros);await ctx.close();}
const ir=async(p,n)=>{await p.evaluate(n=>location.hash='#/servicos/reporte/'+n,n);await p.waitForFunction(n=>reporte.passo===n,n);};
const salvar=async p=>{const anterior=await p.evaluate(()=>window.__repL.versao);await p.click('#rep-salvar');await p.waitForFunction(v=>window.__repL.versao>v,anterior);};
try{
 console.log('Apontamentos, teclado, sinalização e participantes');
 {
  const t=await abrir({participanteAtivo:true}),{p}=t;
  confere('a grade: Pessoa, Assiduidade, Entregas (2.19.2)',await p.locator('.rep-g-cab [role=columnheader]').allInnerTexts().then(v=>v.slice(0,3).map(x=>x.trim().toLowerCase()).join('|')==='pessoa|assiduidade|entregas')
    &&await p.locator('#rep-pessoa-0 [role=cell]').count()===4&&(await p.locator('#rep-pessoa-0 .chave').first().getAttribute('aria-label')).startsWith('Assiduidade'));
  confere('abre com duas pessoas e quatro chaves',await p.locator('[id^="rep-pessoa-"]').count()===2&&await p.locator('#main .chave').count()===4);
  confere('todas começam suficientes e com uma opção acessível pelo Tab',await p.locator('.chave [aria-checked="true"]').allTextContents().then(v=>v.every(t=>t==='Suficiente'))&&await p.locator('.chave [tabindex="0"]').count()===4);
  confere('cabeçalho fica em Serviços',await p.locator('#main .cab .eyebrow').textContent()==='Serviços');
  const entregas=p.getByRole('radiogroup',{name:'Entregas de Bruno Tavares',exact:true});
  await entregas.getByRole('radio',{name:'Suficiente',exact:true}).focus();await p.keyboard.press('ArrowRight');
  confere('seta muda o valor e leva o foco para Insuficiente',await entregas.getByRole('radio',{name:'Insuficiente'}).getAttribute('aria-checked')==='true'&&await entregas.getByRole('radio',{name:'Insuficiente'}).evaluate(e=>e===document.activeElement));
  await salvar(p);
  const payload=await p.evaluate(()=>window.__repSalvo);
  confere('salva só os campos do contrato',Object.keys(payload).sort().join()===['id','versao','etapa','apontamentos','escalonamentos','feed'].sort().join(),Object.keys(payload));
  confere('insuficiência não sinaliza por conta própria',payload.apontamentos[0].entregas==='INSUFICIENTE'&&payload.apontamentos[0].sinalizacao===null);
  await p.locator('#rep-pessoa-0').getByRole('button',{name:'Sinalizar',exact:true}).click();
  await p.fill('#rep-relato','Combinamos a entrega na terça e não veio');
  confere('sem confirmar a conversa não permite sinalizar',await p.locator('#rep-sinal-confirmar').isDisabled());
  await p.check('#rep-conversa');await p.click('#rep-sinal-confirmar');await salvar(p);
  confere('sinalização salva relato e conversa confirmada',await p.evaluate(()=>window.__repSalvo.apontamentos[0].sinalizacao.conversa_confirmada===true&&window.__repSalvo.apontamentos[0].sinalizacao.relato.includes('terça')));
  confere('sinalização aparece com texto',await p.locator('#rep-pessoa-0').getByText('Sinalizado',{exact:true}).count()===1);
  await p.locator('#rep-pessoa-0').getByRole('button',{name:'Ver ou retirar'}).click();await p.getByRole('button',{name:'Retirar a sinalização'}).click();await salvar(p);
  confere('retirar salva sinalização nula e preserva a insuficiência',await p.evaluate(()=>window.__repSalvo.apontamentos[0].sinalizacao===null&&window.__repSalvo.apontamentos[0].entregas==='INSUFICIENTE'));
  await p.getByRole('button',{name:'Adicionar participante',exact:true}).click();
  await p.fill('#rep-part-busca','Diego');await p.getByRole('radio',{name:'Diego Prado'}).check();
  const antes=await p.evaluate(()=>window.__rpcs.filter(r=>r.nome==='reporte_participante').length);
  await p.evaluate(()=>repConfirmarParticipante());
  confere('sem justificativa não chama a RPC nem habilita o botão',await p.locator('#rep-part-confirmar').isDisabled()&&await p.evaluate(()=>window.__rpcs.filter(r=>r.nome==='reporte_participante').length)===antes);
  await p.fill('#rep-part-motivo','Apoia o projeto de sinais neste mês');await p.click('#rep-part-confirmar');
  await p.getByText('Participante: Apoia o projeto de sinais neste mês',{exact:true}).waitFor();
  confere('inclui o participante com versão atual e justificativa',await p.evaluate(()=>{const r=window.__rpcs.filter(x=>x.nome==='reporte_participante').at(-1);return r.p.p_incluir===true&&r.p.p_registro===23&&r.p.p_justificativa==='Apoia o projeto de sinais neste mês'&&reporte.lider.reporte.versao===window.__repL.versao;}));
  await p.getByRole('button',{name:'Remover participante Diego Prado'}).click();await p.locator('#modal').getByRole('button',{name:'Remover participante',exact:true}).click();
  await p.waitForFunction(()=>reporte.lider.reporte.pessoas.length===2);
  confere('remove somente o participante excepcional',await p.evaluate(()=>window.__rpcs.filter(r=>r.nome==='reporte_participante').at(-1).p.p_incluir===false));
  await fechar(t);
 }
 console.log('Mudanças na equipe, rascunho e envio');
 {
  const t=await abrir({mudancas:true}),{p}=t;
  confere('mostra mudança da cadeia',await p.getByText(/Sua equipe mudou desde/).count()===1);
  await p.getByRole('radiogroup',{name:'Entregas de Bruno Tavares',exact:true}).getByRole('radio',{name:'Insuficiente'}).click();
  await p.getByRole('button',{name:'Atualizar a lista'}).click();await p.locator('#rep-pessoa-2').waitFor();
  confere('atualizar inclui Diego e preserva a edição pendente',await p.locator('#rep-pessoa-2').innerText().then(s=>s.includes('Diego Prado'))&&await p.evaluate(()=>window.__repL.apontamentos[0].entregas==='INSUFICIENTE'));
  confere('a faixa some após aceitar a mudança',await p.getByText(/Sua equipe mudou desde/).count()===0);
  await ir(p,2);await p.getByRole('button',{name:'Adicionar tópico'}).click();await p.fill('#rep-topico-0','Falta verba para a bancada');
  await p.waitForFunction(()=>window.__repSalvo?.escalonamentos[0]?.texto==='Falta verba para a bancada');
  confere('salva automaticamente em dois segundos',await p.evaluate(()=>window.__repSalvo.etapa===2));
  await ir(p,3);await p.getByRole('button',{name:'Adicionar publicação'}).click();
  await p.fill('#rep-feed-0-titulo','Ensaio concluído');await p.fill('#rep-feed-0-subtitulo','Primeira rodada');await p.fill('#rep-feed-0-texto','Resultado validado.');
  await ir(p,4);
  confere('revisão mostra nomes insuficientes e efeito do envio',await p.locator('#main .spec').innerText().then(s=>s.includes('Bruno Tavares')&&s.includes('3'))&&await p.getByText(/Ao enviar, as avaliações vão/).count()===1);
  await p.click('#rep-enviar');await p.locator('#modal').getByRole('button',{name:'Enviar reporte',exact:true}).click();
  await p.locator('#main .aviso-box').filter({hasText:'Reporte enviado em'}).waitFor();
  confere('envia com etapa três e versão do último salvamento',await p.evaluate(()=>{const r=window.__rpcs.filter(x=>x.nome==='reporte_enviar').at(-1);return window.__repSalvo.etapa===3&&r.p.p_versao===window.__repL.versao-1;}));
  confere('mantém publicação e escalonamento',await p.evaluate(()=>window.__repSalvo.feed[0].titulo==='Ensaio concluído'&&window.__repSalvo.escalonamentos[0].texto==='Falta verba para a bancada'));
  confere('depois de enviar não há salvar nem enviar',await p.locator('#rep-salvar,#rep-enviar').count()===0);
  await ir(p,1);
  confere('apontamentos ficam somente para leitura',await p.locator('.chave button:not([disabled])').count()===0&&await p.getByRole('button',{name:'Adicionar participante',exact:true}).count()===0);
  await fechar(t);
 }
 console.log('Sem liderados e sprint fechada');
 {
  const t=await abrir({semLiderados:true},'#/servicos/reporte'),{p}=t;
  confere('entrada sem passo abre o primeiro',await p.evaluate(()=>location.hash)==='#/servicos/reporte/1');
  confere('sem liderados explica o próximo passo e permite adicionar',await p.getByText('Você não tem liderados diretos no quadro. Siga para escalonar ou divulgar.').count()===1&&await p.getByRole('button',{name:'Adicionar participante',exact:true}).count()===1);
  await p.getByRole('link',{name:'Continuar',exact:true}).click();await p.getByRole('button',{name:'Adicionar tópico'}).waitFor();
  confere('sem liderados segue para escalonamentos',await p.evaluate(()=>reporte.passo)===2);await fechar(t);
 }
 {
  const t=await abrir({fechado:true});confere('reporte não aberto na sprint encerrada tem vazio próprio',await t.p.getByText('A sprint desta semana já fechou e você não abriu o reporte.').count()===1);await fechar(t);
 }
 console.log('Prazo, fechamento e envio atrasado');
 {
  const t=await abrir({cobranca:'obrigatoria'},'#/servicos/reporte/4','lideranca','2026-10-09T20:00:00Z'),{p}=t;
  confere('após sexta 16h informa atraso e ainda permite enviar',await p.getByText(/Ainda dá para enviar até a sprint seguinte/).count()===1&&await p.locator('#rep-enviar').isEnabled());
  await p.click('#rep-enviar');await p.locator('#modal').getByRole('button',{name:'Enviar reporte',exact:true}).click();
  await p.locator('#main .aviso-box').filter({hasText:'Reporte enviado em'}).waitFor();
  confere('envio atrasado fica identificado na consulta',await p.locator('#main .aviso-box[role="status"]').innerText().then(s=>s.includes('Fora do prazo.')));await fechar(t);
 }
 {
  const t=await abrir({},'#/servicos/reporte/1','lideranca','2026-10-12T03:00:01Z');
  confere('depois do fechamento o reporte existente fica somente para leitura',await t.p.getByText(/A sprint seguinte já abriu/).count()===1&&await t.p.locator('.chave button:not([disabled])').count()===0&&await t.p.locator('#rep-salvar').count()===0);await fechar(t);
 }
 console.log('Conflito e correção sem perda silenciosa');
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>window.__repL.versao++);
  await p.getByRole('radiogroup',{name:'Entregas de Bruno Tavares',exact:true}).getByRole('radio',{name:'Insuficiente'}).click();await p.click('#rep-salvar');
  await p.getByRole('button',{name:'Recarregar o reporte'}).waitFor();
  confere('conflito mantém edição local e oferece recarregar',await p.evaluate(()=>reporte.sujo&&reporte.lider.reporte.apontamentos[0].entregas==='INSUFICIENTE'));
  await p.getByRole('button',{name:'Recarregar o reporte'}).click();await p.waitForFunction(()=>!reporte.conflito&&reporte.lider?.reporte.versao===window.__repL.versao);
  confere('recarregar usa a versão do servidor',await p.evaluate(()=>reporte.lider.reporte.apontamentos[0].entregas==='SUFICIENTE'));await fechar(t);
 }
 console.log('Salvamento em andamento e configuração');
 {
  const t=await abrir(),{p}=t;
  await p.evaluate(()=>{const rpc=sb.rpc.bind(sb);let primeira=true;sb.rpc=async(nome,args)=>{if(nome==='reporte_salvar'&&primeira){primeira=false;await new Promise(resolve=>window.__liberarSalvar=resolve);}return rpc(nome,args);};});
  await p.getByRole('radiogroup',{name:'Entregas de Bruno Tavares',exact:true}).getByRole('radio',{name:'Insuficiente'}).click();
  await p.click('#rep-salvar');await p.waitForFunction(()=>!!window.__liberarSalvar);
  await p.getByRole('radiogroup',{name:'Assiduidade de Carla Mendonça',exact:true}).getByRole('radio',{name:'Insuficiente'}).click();
  await p.evaluate(()=>window.__liberarSalvar());
  await p.waitForFunction(()=>window.__repSalvo?.apontamentos[1].assiduidade==='INSUFICIENTE');
  confere('edição durante salvamento não se perde e usa a nova versão',await p.evaluate(()=>window.__repSalvo.apontamentos[0].entregas==='INSUFICIENTE'&&window.__repSalvo.versao===2));
  await p.getByRole('button',{name:'Adicionar participante',exact:true}).click();
  confere('busca não oferece o autor, desligados nem pessoas já no reporte',await p.locator('input[name="rep-participante"]').count()===0);
  await p.locator('#modal').getByRole('button',{name:'Cancelar',exact:true}).click();await fechar(t);
 }
 {
  const t=await abrir({},'#/servicos/reporte/1','admin'),{p}=t;
  await p.evaluate(()=>{const rpc=sb.rpc.bind(sb);sb.rpc=async(nome,args)=>{
   if(nome==='reporte_painel')return {data:{status:'ok',config:{dia_prazo:4,hora_prazo:'16:00',dia_reuniao:4,hora_reuniao:'16:00',modelo_lider_desde:'2026-10-05'}},error:null};
   if(nome==='reporte_configurar'){window.__configSalva=args.p;return {data:{status:'ok'},error:null};}
   return rpc(nome,args);
  };});
  await p.getByRole('link',{name:'Configurar ciclo',exact:true}).click();await p.locator('#rep-modelo-desde').waitFor();
  confere('configuração mostra cobrança, gerência e data de ativação',await p.getByText('Prazo (cobrança)',{exact:true}).count()===1&&await p.getByText('Reunião da gerência',{exact:true}).count()===1&&await p.getByText('Frentes e responsáveis',{exact:true}).count()===0);
  await p.fill('#rep-modelo-desde','2026-10-12');await p.getByRole('button',{name:'Salvar',exact:true}).click();await p.waitForFunction(()=>!!window.__configSalva);
  confere('salva data e dias de segunda a domingo no contrato',await p.evaluate(()=>window.__configSalva.modelo_lider_desde==='2026-10-12'&&window.__configSalva.dia_prazo===4&&window.__configSalva.dia_reuniao===4));await fechar(t);
 }
 if(process.env.REPORTE_CAPTURAS){
  mkdirSync(process.env.REPORTE_CAPTURAS,{recursive:true});
  for(const tema of ['escuro','claro'])for(const width of [1440,390]){
   const t=await abrir(),{p}=t;
   await p.route('https://brand.neurodynamics.dev/assets/**',r=>r.fulfill({path:'/workspace/brand/assets/'+new URL(r.request().url()).pathname.split('/').pop()}));
   await p.setViewportSize({width,height:960});await p.evaluate(t=>aplicarTema(t),tema);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(600);
   confere(`${tema} ${width}: sem rolagem horizontal`,await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await p.screenshot({path:`${process.env.REPORTE_CAPTURAS}/reporte-lider-${tema}-${width}.png`,fullPage:true});await fechar(t);
  }
 }
}finally{await nav.close();}
console.log(falhas?`\n${falhas} falha(s) em ${checks} verificações.`:`\nTudo certo. ${checks} verificações passaram.`);
process.exitCode=falhas?1:0;
