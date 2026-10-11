/* ============================================================
   Reporte semanal (Serviços) e feed da equipe (Equipe).
   Endereços (toda tela tem endereço, PADROES §2):
     #/servicos/reporte                     o reporte do líder (Fluxo, 1 a 4)
     #/servicos/reporte/frente/<id>/<passo>    preencher ou consultar (Fluxo, 1 a 4)
     #/servicos/reporte/config              prazo e reunião (Ajustes, admin)
   O banco tem três etapas (apontamentos, escalonamentos, feed) e o envio
   exige etapa 3; o passo 4, a Revisão, é só da tela. A permissão e o
   encerramento são conferidos no banco.
   ============================================================ */
const reporte = { painel:null, aberto:null, lider:null, salvando:null, alteracoes:0, conflito:false, ocupado:false, uploads:0, feed:[], sujo:false, timer:null, passo:1 };
const REP_PASSOS = [['1','Apontamentos'], ['2','Escalonamentos'], ['3','Publicações no feed'], ['4','Revisão e envio']];
async function repRPC(nome,p={},aceita=[]){
 const {data,error}=await sb.rpc(nome,p); if(error) throw error;
 if(data?.status && data.status!=='ok'&&!aceita.includes(data.status)) throw new Error(({sem_permissao:MOTIVO_RPC.sem_permissao,
 conflito:'O reporte foi alterado em outra sessão. Recarregue o reporte para continuar.',encerrado:'O prazo de envio está encerrado.',
 invalido:'Confira os campos obrigatórios.',incompleto:'Falta concluir o apontamento de uma pessoa.',
 justificativa_obrigatoria:'Explique por que esta pessoa entra no seu reporte.',duplicado:'Esta pessoa já está no reporte.',
 modelo_anterior:'Esta semana ainda segue o reporte por frente.',nao_encontrado:'O reporte não foi encontrado.'})[data.status] || data.status);
 return data;
}
const repPill=(t,c)=>`<span class="pill ${c||''}"><span class="dt ${c==='p-ok'?'dt-ok':c==='p-warn'?'dt-warn':c==='p-bad'?'dt-bad':''}"></span>${esc(t)}</span>`;
/* Feed e Newsletters continuam em Equipe; o reporte fica em Serviços (2.19.1). */
const repTopo=(titulo,secao)=>cabecalho(secao
 ? {espaco:'Equipe',titulo,secoes:abasEquipe(secao)}
 : {espaco:'Serviços',titulo});
const repRota=()=>{const [,,,a,b,c]=location.hash.split('?')[0].split('/');return {a:a||'',b:b||'',c:c||''};};
const repLimite=ciclo=>(new Date(ciclo.prazo)-Date.now())/36e5;
const repPrazoPill=ciclo=>{const h=repLimite(ciclo);return h<=0?repPill('Prazo encerrado'):h<24?repPill('Prazo em '+(h<1?'menos de 1 hora':Math.ceil(h)+' h'),'p-warn'):'';};
const repEhLider=(d=reporte.aberto)=>d?.reporte?.modelo==='lider';
const repTravado=d=>!!d.reporte.enviado_em||d.ciclo.fechado||new Date(repEhLider(d)?d.ciclo.fecha_em:d.ciclo.prazo)<=new Date();

/* ---------------- a rota ---------------- */
async function pageReporte(){
 if(!tenhoPapel('lideranca')){location.hash='#/';return;}
 const {a,b,c}=repRota();
 if(reporte.salvando)await reporte.salvando;
 if(reporte.conflito)return;
 if(reporte.sujo&&reporte.aberto&&!await repSalvar(true))return;
 $('#main').innerHTML=repTopo('Reporte semanal')+estado.carregando();
 try{
  if(a==='config'){
   if(!souAdmin()){location.hash='#/servicos/reporte';return;}
   reporte.aberto=null;reporte.lider=null;
   reporte.painel=await repRPC('reporte_painel');return repTelaConfig();
  }
  if(a==='painel')return repTelaPainel();
  /* Favoritos do modelo por frente, anteriores à rota explícita. */
  if(a&&a!=='frente'&&!/^[1-4]$/.test(a)){
   history.replaceState(null,'',location.pathname+'#/servicos/reporte/frente/'+encodeURIComponent(a)+'/'+(b||'1'));
   return pageReporte();
  }
  if(a==='frente'){
   reporte.lider=null;
   if(repEhLider())reporte.aberto=null;
   reporte.painel=await repRPC('reporte_painel');
   return repTelaFluxo(b,Math.min(4,Math.max(1,Number(c)||1)));
  }
  const d=await repRPC('reporte_meu',{},['modelo_anterior']);
  if(d.status==='modelo_anterior'){
   reporte.lider=null;reporte.aberto=null;
   reporte.painel=await repRPC('reporte_painel');repTelaLista();
   $('#main .cab').insertAdjacentHTML('afterend','<div class="aviso-box info">Esta semana ainda segue o reporte por frente. O reporte por liderança começa na próxima sprint.</div>');return;
  }
  reporte.lider=d;reporte.aberto=d.reporte?d:null;reporte.sujo=false;
  reporte.consolidado=await repRPC('reporte_consolidado_pode').then(v=>v===true,()=>false);
  if(!d.reporte){
   $('#main').innerHTML=repTopo('Reporte semanal')+estado.vazio({texto:'A sprint desta semana já fechou e você não abriu o reporte.'});return;
  }
  reporte.passo=Number(a)||1;
  if(!a)history.replaceState(null,'',location.pathname+'#/servicos/reporte/1');
  repRender();
 }catch(e){$('#main').innerHTML=repTopo('Reporte semanal')+estado.erro({texto:'Não foi possível carregar o reporte: '+e.message+'.',acao:'<button class="btn ghost mini" onclick="pageReporte()">Tentar de novo</button>'});}
}

/* ---------------- L: o ciclo da semana ---------------- */
function repTelaLista(){
 const d=reporte.painel,c=d.ciclo,enviados=d.frentes.filter(f=>f.enviado_em).length;
 const m=(r,v,x)=>`<div class="metrica"><span class="rot">${r}</span><span class="val">${v}</span>${x||''}</div>`;
 const encerrado=c.fechado||new Date(c.prazo)<new Date();
 const linhas=d.frentes.map(f=>{
  const sit=f.enviado_em?repPill('Enviado','p-ok'):encerrado?repPill('Encerrado'):repPill('Pendente','p-warn');
  const acao=`<a class="btn ghost mini" href="#/servicos/reporte/frente/${esc(f.id)}/1">${f.enviado_em||encerrado?'Consultar':'Preencher'}</a>`;
  return `<tr><td class="nome">${esc(f.nome)}</td><td>${esc(f.responsavel_nome)}</td><td>${sit}</td><td class="mono">${f.enviado_em?fmtDT(f.enviado_em):"—"}</td><td style="text-align:right">${acao}</td></tr>`;}).join('');
 $('#main').innerHTML=cabecalho({espaco:'Serviços',titulo:'Reporte semanal',meta:[repPrazoPill(c)],
   acoes:souAdmin()?[`<button class="btn ghost" onclick="repPDF()">${ic('doc')}Baixar reporte unificado</button>`,`<a class="btn ghost" href="#/servicos/reporte/config">Configurar ciclo</a>`]:[]})
 +`<div class="metricas" style="margin-bottom:18px">${m('Semana de',fmtD(c.semana))}${m('Prazo',fmtDT(c.prazo))}${m('Reunião',fmtDT(c.reuniao_em))}${m('Enviados',`${enviados} de ${d.frentes.length}`)}</div>`
 +(d.frentes.length?`<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho"><thead><tr><th>Frente</th><th>Responsável</th><th>Situação</th><th>Enviado em</th><th></th></tr></thead><tbody>${linhas}</tbody></table></div></div>`
  :estado.vazio({texto:'Nenhuma frente atribuída. Cadastre o responsável em Administração, Grupos.',acao:souAdmin()?'<a class="btn ghost mini" href="#/admin/grupos">Abrir Grupos</a>':''}));
}

/* ---------------- F: preencher ---------------- */
async function repTelaFluxo(frente,n){
 if(!reporte.aberto||reporte.aberto.reporte.frente_id!==frente){
  reporte.aberto=await repRPC('reporte_abrir',{p_ciclo:reporte.painel.ciclo.id,p_frente:frente});reporte.sujo=false;
 }
 reporte.passo=n;repRender();
}
function repRender(){
 if(repEhLider())return repRenderLider();
 const d=reporte.aberto,r=d.reporte,travado=repTravado(d),n=reporte.passo;
 const aviso=r.enviado_em?`<div class="aviso-box info" role="status">Reporte enviado em ${fmtDT(r.enviado_em)}.</div>`
  :travado?'<div class="aviso-box warn" role="status">O prazo de envio está encerrado. O reporte está somente para leitura.</div>':'';
 const corpo=[repPassoApont,repPassoEscal,repPassoFeed,repPassoRevisao][n-1](d,travado);
 const rota=k=>`#/servicos/reporte/frente/${esc(r.frente_id)}/${k}`;
 const acoes=[n>1?`<a class="btn ghost" href="${rota(n-1)}">Etapa anterior</a>`:'',
  !travado?'<button class="btn ghost" id="rep-salvar" onclick="repSalvar()">Salvar rascunho</button>':'',
  n<4?`<a class="btn solid" href="${rota(n+1)}">Continuar</a>`:(!travado?'<button class="btn solid" id="rep-enviar" onclick="repEnviar()">Enviar reporte</button>':'')].join('');
 $('#main').innerHTML=cabecalho({espaco:'Serviços',titulo:d.grupo.nome,voltar:['Reporte semanal','#/servicos/reporte'],meta:['Semana de '+fmtD(d.ciclo.semana),repPrazoPill(d.ciclo)]})
  +aviso+'<div id="rep-aviso"></div>'
  +layoutFluxo({passos:etapas(REP_PASSOS,String(n),rota),corpo,salvo:travado?'<span class="salvo"></span>':'<span class="salvo ok" id="rep-salvo">Rascunho carregado</span>',acoes});
}
const repMembro=reg=>(state.membros||[]).find(m=>m.registro===reg)||{registro:reg,nome:'Registro '+reg};
const repSeg=(i,k,v,travado)=>`<div class="seg" role="group" aria-label="${k==='assiduidade'?'Assiduidade':'Entregas'}">${['SUFICIENTE','INSUFICIENTE'].map(o=>
 `<button type="button" id="rep-${i}-${k}-${o==='SUFICIENTE'?'s':'i'}" class="${v===o?'on':''}" aria-pressed="${v===o}" ${travado?'disabled':''} onclick="repApont(${i},'${k}','${o}')">${o==='SUFICIENTE'?'Suficiente':'Insuficiente'}</button>`).join('')}</div>`;
function repLinhaApont(a,i,travado){
 const m=repMembro(a.registro),pede=a.sinalizado||a.assiduidade==='INSUFICIENTE'||a.entregas==='INSUFICIENTE';
 return `<div class="ajuste" id="rep-linha-${i}"><div style="display:flex;align-items:center;gap:12px">${avatarFoto(m,36,12)}<div><h3>${esc(m.nome)}</h3><p class="mono">${String(m.registro).padStart(3,'0')}</p></div></div>
  <div class="controle"><div style="display:flex;gap:18px;flex-wrap:wrap"><div class="stack" style="gap:6px"><span class="rotulo">Assiduidade</span>${repSeg(i,'assiduidade',a.assiduidade,travado)}</div>
   <div class="stack" style="gap:6px"><span class="rotulo">Entregas</span>${repSeg(i,'entregas',a.entregas,travado)}</div></div>
   <button type="button" class="chip ${a.sinalizado?'on':''}" id="rep-${i}-sinal" aria-pressed="${!!a.sinalizado}" ${travado?'disabled':''} onclick="repApont(${i},'sinalizado',${!a.sinalizado})">${a.sinalizado?ic('check'):''}Sinalizar ao Pessoal</button>
   ${pede?`<div class="fld" style="width:100%"><label for="rep-just-${i}">Justificativa${a.sinalizado?' (obrigatória)':''}</label><textarea id="rep-just-${i}" rows="2" ${travado?'disabled':''} placeholder="O que aconteceu na semana." oninput="repApont(${i},'justificativa',this.value,true)">${esc(a.justificativa||'')}</textarea></div>`:''}</div></div>`;
}
function repPassoApont(d,travado){
 const lista=d.reporte.apontamentos;
 return lista.length?`<div class="ajustes">${lista.map((a,i)=>repLinhaApont(a,i,travado)).join('')}</div>`:estado.vazio({texto:'Nenhum membro nesta frente.'});
}
function repApont(i,k,v,quieto){
 reporte.aberto.reporte.apontamentos[i][k]=v;repMarcar();
 if(!quieto){const el=document.getElementById('rep-linha-'+i);if(el){el.outerHTML=repLinhaApont(reporte.aberto.reporte.apontamentos[i],i,false);}}
}
function repPassoEscal(d,travado){
 const lista=d.reporte.escalonamentos;
 const itens=lista.map((x,i)=>`<section class="rep-bloco"><div class="rep-bloco-cab"><h3>Tópico ${i+1}</h3>${travado?'':`<button type="button" class="icbtn" aria-label="Remover tópico ${i+1}" onclick="repRemover('escalonamentos',${i})">${ic('x')}</button>`}</div>
  <div class="fld"><label for="rep-topico-${i}">Texto</label>${travado?'':mdBarra('rep-topico-'+i)}<textarea id="rep-topico-${i}" rows="3" ${travado?'disabled':''} oninput="reporte.aberto.reporte.escalonamentos[${i}].texto=this.value;repMarcar()">${esc(x.texto||'')}</textarea></div>
  <div class="fld"><label for="rep-card-${i}">Atividade relacionada (opcional)</label><input id="rep-card-${i}" value="${esc(x.codigo||'')}" ${travado?'disabled':''} placeholder="ORT-14" onchange="repVincular(${i},this.value)"><p class="small" id="rep-vinc-${i}" style="margin-top:6px">${x.codigo?`<a href="#/atividades/card/${esc(x.codigo)}">${esc(x.codigo)}</a>`:''}</p></div></section>`).join('');
 return (itens||estado.vazio({texto:'Nenhum tópico. Escalone só o que precisa da atenção da gestão.'}))+(travado?'':'<button class="btn ghost" onclick="repAdicionar(\'escalonamentos\')">'+ic('plus')+'Adicionar tópico</button>');
}
const repArtigo=(f,autor,quando)=>`<article class="artigo"><div class="artigo-meta"><span>${esc(autor||'')}</span>${quando?`<time>${fmtDT(quando)}</time>`:''}</div>
 <h2>${esc(f.titulo||'(sem título)')}</h2>${f.subtitulo?`<p class="sub">${esc(f.subtitulo)}</p>`:''}<div class="md">${md(f.texto||'')}</div></article>`;
function repCampoFeed(x,i,k,travado){
 const id=`rep-feed-${i}-${k}`,rot={titulo:'Título',subtitulo:'Subtítulo',texto:'Texto completo'}[k],on=`oninput="reporte.aberto.feed[${i}].${k}=this.value;repMarcar()"`,dis=travado?'disabled':'';
 const campo=k==='titulo'?`<input id="${id}" value="${esc(x[k]||'')}" ${dis} ${on}>`:`<textarea id="${id}" rows="${k==='texto'?5:2}" ${dis} ${on}>${esc(x[k]||'')}</textarea>`;
 return `<div class="fld"><label for="${id}">${rot}</label>${k==='texto'&&!travado?mdBarra(id):''}${campo}</div>`;
}
function repPassoFeed(d,travado){
 const itens=d.feed.map((x,i)=>`<section class="rep-bloco"><div class="rep-bloco-cab"><h3>Publicação ${i+1}</h3>${travado?'':`<button type="button" class="icbtn" aria-label="Remover publicação ${i+1}" onclick="repRemover('feed',${i})">${ic('x')}</button>`}</div>
  ${['titulo','subtitulo','texto'].map(k=>repCampoFeed(x,i,k,travado)).join('')}
  ${travado?'':`<div class="fld"><label for="rep-img-${i}">Imagem (opcional, PNG, JPEG ou WebP de até 5 MB)</label><input type="file" id="rep-img-${i}" accept="image/png,image/jpeg,image/webp" onchange="repImagem(${i},this.files[0])"><p class="small muted" id="rep-img-status-${i}">${x.imagem_path?'Imagem anexada.':''}</p></div>`}</section>`).join('');
 return (itens||estado.vazio({texto:'Nenhuma publicação. O que entra aqui aparece no Feed da equipe depois do envio.'}))+(travado?'':'<button class="btn ghost" onclick="repAdicionar(\'feed\')">'+ic('plus')+'Adicionar publicação</button>');
}
function repPassoRevisao(d){
 const r=d.reporte,sin=r.apontamentos.filter(a=>a.sinalizado),sem=sin.filter(a=>!String(a.justificativa||'').trim()),ins=r.apontamentos.filter(a=>a.assiduidade==='INSUFICIENTE'||a.entregas==='INSUFICIENTE');
 const bloq=sem.length?`<div class="aviso-box err" role="alert">Informe a justificativa de ${sem.map(a=>esc(repMembro(a.registro).nome)).join(', ')} antes de enviar.</div>`:'';
 const sec=(t,corpo)=>`<section class="rep-bloco"><h3>${t}</h3>${corpo}</section>`;
 return bloq+sec('Apontamentos',spec([['Membros',String(r.apontamentos.length),true],['Com algum item insuficiente',String(ins.length),true],['Sinalizados ao Pessoal',sin.length?sin.map(a=>esc(repMembro(a.registro).nome)).join(', '):'Nenhum']]))
  +sec('Escalonamentos',r.escalonamentos.length?`<ol class="stack">${r.escalonamentos.map(x=>`<li>${esc(x.texto||'')}${x.codigo?` <a href="#/atividades/card/${esc(x.codigo)}" class="mono">${esc(x.codigo)}</a>`:''}</li>`).join('')}</ol>`:'<p class="small muted">Nenhum tópico.</p>')
  +sec('Publicações no feed',d.feed.length?d.feed.map(f=>repArtigo(f,d.grupo.nome)).join(''):'<p class="small muted">Nenhuma publicação.</p>');
}

/* ---------------- edição: lista, salvamento e envio ---------------- */
function repAdicionar(k){const d=reporte.aberto;(k==='feed'?d.feed:d.reporte.escalonamentos).push(k==='feed'?{titulo:'',subtitulo:'',texto:''}:{texto:''});repMarcar();repRender();}
function repRemover(k,i){
 const d=reporte.aberto,lista=k==='feed'?d.feed:d.reporte.escalonamentos,[item]=lista.splice(i,1);repMarcar();repRender();
 toast(k==='feed'?'Publicação removida.':'Tópico removido.',false,{rotulo:'Desfazer',fn:()=>{lista.splice(i,0,item);repMarcar();if(reporte.aberto===d)repRender();}});
}
/* qualquer edição agenda o salvamento automático (2 s depois da última) */
function repMarcar(){
 if(reporte.conflito)return;
 reporte.alteracoes++;reporte.sujo=true;repSalvo('Alterações não salvas','pendente');
 clearTimeout(reporte.timer);reporte.timer=setTimeout(()=>{if(reporte.ocupado)return repMarcar();repSalvar(true);},2000);
}
function repSalvo(txt,cls){const el=document.getElementById('rep-salvo');if(el){el.textContent=txt;el.className='salvo '+(cls||'');}}
async function repSalvar(silencioso=false){
 if(reporte.uploads){if(!silencioso)toast('Aguarde o envio da imagem.',true);return false;}
 if(reporte.salvando){await reporte.salvando;return reporte.sujo?repSalvar(silencioso):!reporte.conflito;}
 if(reporte.ocupado||reporte.conflito||!reporte.aberto||repTravado(reporte.aberto))return false;
 clearTimeout(reporte.timer);reporte.ocupado=true;repSalvo('Salvando…','pendente');
 const d=reporte.aberto,r=d.reporte,alteracoes=reporte.alteracoes;
 r.etapa=Math.max(r.etapa||1,Math.min(reporte.passo,3));
 const p=structuredClone(repEhLider(d)
  ? {id:r.id,versao:r.versao,etapa:r.etapa,apontamentos:r.apontamentos,escalonamentos:r.escalonamentos,feed:d.feed}
  : {...r,feed:d.feed});
 reporte.salvando=(async()=>{
  try{
   const res=await repRPC('reporte_salvar',{p});r.versao=res.versao;
   reporte.sujo=reporte.alteracoes!==alteracoes;
   repSalvo(reporte.sujo?'Alterações não salvas':'Salvo às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),reporte.sujo?'pendente':'ok');
   if(!silencioso)toast('Rascunho salvo.');return true;
  }catch(e){repSalvo('Não foi possível salvar','pendente');repErro(e);return false;}
  finally{reporte.ocupado=false;reporte.salvando=null;}
 })();
 return reporte.salvando;
}
function repRecarregar(){
 clearTimeout(reporte.timer);reporte.aberto=null;reporte.lider=null;reporte.sujo=false;reporte.conflito=false;pageReporte();
}

function repErro(e){
 const el=document.getElementById('rep-aviso');
 if(el&&/outra sessão/.test(e.message)){reporte.conflito=true;clearTimeout(reporte.timer);el.innerHTML=`<div class="aviso-box err estado-erro" role="alert"><span>${esc(e.message)}</span><button class="btn ghost mini" onclick="repRecarregar()">Recarregar o reporte</button></div>`;return;}
 falha(e,'Não foi possível salvar o reporte');
}
async function repEnviar(){
 if(repEhLider())return repEnviarLider();
 if(reporte.ocupado)return;
 const r=reporte.aberto.reporte;
 if(r.apontamentos.some(a=>a.sinalizado&&!String(a.justificativa||'').trim())){document.getElementById('rep-enviar')?.blur();return toast('Informe a justificativa dos membros sinalizados.',true);}
 if(!await confirma('Depois de enviado, o reporte não pode ser editado. As publicações vão para a mesa editorial, onde a gerência decide o que publicar, e as sinalizações vão para o Pessoal.','Enviar reporte'))return;
 r.etapa=3;if(!await repSalvar(true))return;
 reporte.ocupado=true;
 try{await repRPC('reporte_enviar',{p_id:r.id,p_versao:r.versao});toast('Reporte enviado.');reporte.aberto=null;location.hash='#/servicos/reporte';}
 catch(e){falha(e,'Não foi possível enviar o reporte');}finally{reporte.ocupado=false;}
}
async function repVincular(i,codigo){
 const item=reporte.aberto.reporte.escalonamentos[i],msg=document.getElementById('rep-vinc-'+i);delete item.atividade_id;delete item.codigo;repMarcar();
 if(!codigo.trim()){if(msg)msg.textContent='';return;}
 const {data,error}=await sb.from('atividades').select('id,codigo').eq('codigo',codigo.trim().toUpperCase()).maybeSingle();
 if(error||!data){if(msg){msg.textContent='Código não encontrado. Confira o código no quadro de atividades.';msg.style.color='var(--bad-tx)';}return;}
 item.atividade_id=data.id;item.codigo=data.codigo;repMarcar();if(msg){msg.style.color='';msg.innerHTML=`<a href="#/atividades/card/${esc(data.codigo)}">${esc(data.codigo)}</a>`;}
}
async function repImagem(i,file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Use PNG, JPEG ou WebP de até 5 MB.',true);return;}
 const ext=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[file.type];
 const aberto=reporte.aberto,item=aberto.feed[i],status=()=>reporte.aberto===aberto?document.getElementById('rep-img-status-'+i):null;
 reporte.uploads++;if(status())status().textContent='Enviando…';
 const path=`${aberto.reporte.id}/${crypto.randomUUID()}.${ext}`;
 try{const {error}=await sb.storage.from('feed').upload(path,file,{contentType:file.type});if(error)throw error;
 item.imagem_path=path;if(status())status().textContent='Imagem anexada.';repMarcar();
 }catch(e){if(status())status().textContent='';falha(e,'Não foi possível anexar a imagem');}finally{reporte.uploads--;}
}

/* ---------------- reporte por liderança direta (2.19.1) ---------------- */
const REP_ENVIO_LIDER='Ao enviar, as avaliações vão para a ficha de cada pessoa, as sinalizações abrem o acompanhamento no PMO (ou o desligamento, se for a segunda em 60 dias) e as publicações vão para a mesa editorial, onde a gerência decide o que publicar.';
const repPodeEditarLider=()=>repEhLider()&&!repTravado(reporte.aberto)&&!reporte.conflito&&!reporte.mutando;
function repAvisoLider(d){
 const r=d.reporte,c=d.ciclo;
 if(r.enviado_em)return `<div class="aviso-box info" role="status">Reporte enviado em ${fmtDT(r.enviado_em)}.${r.atrasado?' Fora do prazo.':''}</div>`;
 if(repTravado(d))return '<div class="aviso-box warn" role="status">A sprint seguinte já abriu. O reporte está somente para leitura.</div>';
 if(new Date(c.prazo)<=new Date())return '<div class="aviso-box warn" role="status">O prazo era sexta, 16h. Ainda dá para enviar até a sprint seguinte abrir; o envio fica marcado como atrasado.</div>';
 if(d.mudancas){
  const nomes=k=>(d.mudancas[k]||[]).map(p=>esc(p.nome)).join(', ')||'ninguém';
  return `<div class="aviso-box info" role="status">Sua equipe mudou desde que você abriu o reporte: entram ${nomes('entram')}; saem ${nomes('saem')}. <button class="btn ghost mini" onclick="repAtualizarEquipe()">Atualizar a lista</button></div>`;
 }
 return '';
}
function repRenderLider(){
 const d=reporte.lider,r=d.reporte,n=reporte.passo,travado=repTravado(d),rota=k=>'#/servicos/reporte/'+k;
 const prazo=new Date(d.ciclo.prazo)<=new Date()?repPill('Fora do prazo','p-warn'):repPrazoPill(d.ciclo);
 const corpo=[repPassoLider,repPassoEscal,repPassoFeed,repRevisaoLider][n-1](d,travado);
 const acoes=[n>1?`<a class="btn ghost" href="${rota(n-1)}">Etapa anterior</a>`:'',
  !travado?'<button class="btn ghost" id="rep-salvar" onclick="repSalvar()">Salvar rascunho</button>':'',
  n<4?`<a class="btn solid" href="${rota(n+1)}">Continuar</a>`:(!travado?'<button class="btn solid" id="rep-enviar" onclick="repEnviar()">Enviar reporte</button>':'')].join('');
 $('#main').innerHTML=cabecalho({espaco:'Serviços',titulo:'Reporte semanal',meta:['Semana de '+fmtD(d.ciclo.semana),prazo],
  acoes:[reporte.consolidado?'<a class="btn ghost" href="#/servicos/reporte/painel">Painel da semana</a>':'',souAdmin()?'<a class="btn ghost" href="#/servicos/reporte/config">Configurar ciclo</a>':'']})
  +repAvisoLider(d)+'<div id="rep-aviso"></div>'
  +layoutFluxo({passos:etapas(REP_PASSOS,String(n),rota),corpo,salvo:travado?'<span class="salvo"></span>':'<span class="salvo ok" id="rep-salvo">Rascunho carregado</span>',acoes});
}
function repChaveLider(p,a,i,k,travado){
 const rot=k==='entregas'?'Entregas':'Assiduidade';
 return `<div class="stack" style="gap:var(--s2)"><span class="rotulo">${rot}</span><div class="chave" role="radiogroup" aria-label="${rot} de ${esc(p.nome)}" onkeydown="repTeclaLider(event,${i},'${k}')">${['SUFICIENTE','INSUFICIENTE'].map((v,j)=>
  `<button type="button" role="radio" aria-checked="${a[k]===v}" tabindex="${a[k]===v?'0':'-1'}" class="${j?'st-caution':'st-nominal'}" ${travado?'disabled':''} onclick="repApontLider(${i},'${k}','${v}')">${j?'Insuficiente':'Suficiente'}</button>`).join('')}</div></div>`;
}
function repLinhaLider(p,i,travado){
 const a=reporte.lider.reporte.apontamentos.find(x=>x.registro===p.registro);
 return `<div class="ajuste" id="rep-pessoa-${i}"><div style="display:flex;align-items:center;gap:var(--s3)">${avatarFoto(repMembro(p.registro),36,12)}<div><h3>${esc(p.nome)}</h3>
  <p>${p.origem==='direto'?'Liderado direto':'Participante: '+esc(p.justificativa||'')}</p></div>
  ${p.origem==='excepcional'&&!travado?`<button class="icon-btn icbtn" aria-label="Remover participante ${esc(p.nome)}" onclick="repRetirarParticipante(${i})">${ic('x')}</button>`:''}</div>
  <div class="controle"><div style="display:flex;gap:var(--s4);flex-wrap:wrap">${['entregas','assiduidade'].map(k=>repChaveLider(p,a,i,k,travado)).join('')}</div>
  ${a.sinalizacao?`${repPill('Sinalizado','p-warn')}<button class="btn ghost mini" onclick="repSinalizarLider(${i})">${travado?'Ver sinalização':'Ver ou retirar'}</button>`
   :travado?'':`<button class="btn ghost mini" onclick="repSinalizarLider(${i})">Sinalizar</button>`}</div></div>`;
}
function repPassoLider(d,travado){
 return (d.reporte.pessoas.length?`<div class="ajustes">${d.reporte.pessoas.map((p,i)=>repLinhaLider(p,i,travado)).join('')}</div>`
  :estado.vazio({texto:'Você não tem liderados diretos no quadro. Siga para escalonar ou divulgar.'}))
  +(travado?'':'<button class="btn ghost" onclick="repAdicionarParticipante()">'+ic('plus')+'Adicionar participante</button>');
}
function repApontLider(i,k,v){
 if(!repPodeEditarLider())return;
 const p=reporte.lider.reporte.pessoas[i],a=reporte.lider.reporte.apontamentos.find(x=>x.registro===p.registro);
 a[k]=v;repMarcar();
 const grupo=document.querySelector(`#rep-pessoa-${i} .chave[aria-label="${k==='entregas'?'Entregas':'Assiduidade'} de ${CSS.escape(p.nome)}"]`);
 if(grupo)for(const [j,btn] of [...grupo.querySelectorAll('button')].entries()){
  const marcado=v===['SUFICIENTE','INSUFICIENTE'][j];btn.setAttribute('aria-checked',String(marcado));btn.tabIndex=marcado?0:-1;
 }
}
function repTeclaLider(ev,i,k){
 if(!repPodeEditarLider()||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(ev.key))return;
 ev.preventDefault();const botoes=[...ev.currentTarget.querySelectorAll('button')],atual=botoes.indexOf(ev.target);
 const proximo=ev.key==='Home'?0:ev.key==='End'?1:(atual+1)%2;
 repApontLider(i,k,['SUFICIENTE','INSUFICIENTE'][proximo]);botoes[proximo].focus();
}
function repSinalizarLider(i){
 if(!repEhLider())return;
 const p=reporte.lider.reporte.pessoas[i],a=reporte.lider.reporte.apontamentos.find(x=>x.registro===p.registro),travado=repTravado(reporte.lider);
 if(travado&&!a.sinalizacao)return;
 abreModal(`<h3>Sinalizar ${esc(p.nome)}</h3><p>A sinalização é para quando um acordo não foi cumprido depois de uma conversa. Na primeira, o PMO marca uma reunião com a pessoa; se houver outra em até 60 dias, abre-se o desligamento com o Pessoal e a Coordenação.</p>
  <div class="fld"><label for="rep-relato">O que foi combinado e não foi cumprido</label><textarea id="rep-relato" required rows="4" oninput="repValidarSinal()" ${travado?'readonly':''}>${esc(a.sinalizacao?.relato||'')}</textarea></div>
  <label class="check"><input type="checkbox" id="rep-conversa" required onchange="repValidarSinal()" ${a.sinalizacao?.conversa_confirmada?'checked':''} ${travado?'disabled':''}>Já conversei com ${esc(p.nome.split(' ')[0])} para corrigir isso</label>
  <div class="acts"><button class="btn ghost" onclick="fechaModal()">${travado?'Fechar':'Cancelar'}</button>
   ${travado?'':`${a.sinalizacao?`<button class="btn ghost" onclick="repConfirmarSinal(${i},true)">Retirar a sinalização</button>`:''}<button class="btn solid" id="rep-sinal-confirmar" onclick="repConfirmarSinal(${i})" disabled>Sinalizar</button>`}</div>`,false,true);
 repValidarSinal();$('#rep-relato').focus();
}
function repValidarSinal(){
 const btn=$('#rep-sinal-confirmar');if(btn)btn.disabled=!$('#rep-relato').value.trim()||!$('#rep-conversa').checked;
}
function repConfirmarSinal(i,retirar=false){
 if(!repPodeEditarLider())return;
 const relato=$('#rep-relato').value.trim();if(!retirar&&(!relato||!$('#rep-conversa').checked))return;
 const p=reporte.lider.reporte.pessoas[i],a=reporte.lider.reporte.apontamentos.find(x=>x.registro===p.registro);
 a.sinalizacao=retirar?null:{relato,conversa_confirmada:true};repMarcar();fechaModal();
 document.getElementById('rep-pessoa-'+i).outerHTML=repLinhaLider(p,i,false);
 document.querySelector('#rep-pessoa-'+i+' .controle .btn')?.focus();
}
function repAdicionarParticipante(){
 if(!repPodeEditarLider())return;
 abreModal(`<h3>Adicionar participante</h3><div class="fld"><label for="rep-part-busca">Buscar membro pelo nome</label><input id="rep-part-busca" type="search" oninput="repBuscarParticipante()"></div>
  <div id="rep-part-opcoes" class="stack" role="radiogroup" aria-label="Participante"></div>
  <div class="fld"><label for="rep-part-motivo">Por que esta pessoa entra no seu reporte</label><textarea id="rep-part-motivo" required oninput="repValidarParticipante()"></textarea></div>
  <div class="acts"><button class="btn ghost" onclick="fechaModal()">Cancelar</button><button class="btn solid" id="rep-part-confirmar" onclick="repConfirmarParticipante()" disabled>Adicionar participante</button></div>`,false,true);
 repBuscarParticipante();$('#rep-part-busca').focus();
}
function repCandidatos(){
 const pessoas=reporte.lider.reporte.pessoas;
 return orgAtivos().filter(m=>m.registro!==reporte.lider.reporte.autor&&!pessoas.some(p=>p.registro===m.registro));
}
function repBuscarParticipante(){
 const termo=$('#rep-part-busca').value.trim().toLocaleLowerCase('pt-BR');
 const escolhido=document.querySelector('input[name="rep-participante"]:checked')?.value;
 const lista=repCandidatos().filter(m=>m.nome.toLocaleLowerCase('pt-BR').includes(termo));
 $('#rep-part-opcoes').innerHTML=lista.length?lista.map(m=>`<label class="check"><input type="radio" name="rep-participante" value="${esc(m.registro)}" ${String(m.registro)===escolhido?'checked':''} onchange="repValidarParticipante()">${esc(m.nome)}</label>`).join(''):estado.vazio({texto:'Nenhum membro encontrado.'});
 repValidarParticipante();
}
function repValidarParticipante(){
 $('#rep-part-confirmar').disabled=!document.querySelector('input[name="rep-participante"]:checked')||!$('#rep-part-motivo').value.trim();
}
async function repConfirmarParticipante(){
 if(!repPodeEditarLider())return;
 const reg=Number(document.querySelector('input[name="rep-participante"]:checked')?.value),motivo=$('#rep-part-motivo').value.trim();
 if(!motivo||!repCandidatos().some(m=>m.registro===reg))return;
 await repAlterarEquipe('reporte_participante',{p_registro:reg,p_justificativa:motivo,p_incluir:true});
}
async function repRetirarParticipante(i){
 if(!repPodeEditarLider())return;
 const p=reporte.lider.reporte.pessoas[i];if(p.origem!=='excepcional')return;
 if(await confirma('Retirar '+p.nome+' do seu reporte?','Remover participante'))
  await repAlterarEquipe('reporte_participante',{p_registro:p.registro,p_justificativa:null,p_incluir:false});
}
async function repAtualizarEquipe(){await repAlterarEquipe('reporte_cadeia_atualizar',{});}
async function repAlterarEquipe(nome,args){
 if(!repPodeEditarLider())return;
 reporte.mutando=true;$('#main').inert=true;
 try{
  if(reporte.salvando&&!await reporte.salvando)return;
  if(reporte.sujo&&!await repSalvar(true))return;
  const r=reporte.lider.reporte;reporte.ocupado=true;
  const res=await repRPC(nome,{p_id:r.id,p_versao:r.versao,...args});r.versao=res.versao;
  fechaModal();reporte.aberto=null;reporte.lider=null;await pageReporte();
 }catch(e){repErro(e);}finally{reporte.ocupado=false;reporte.mutando=false;$('#main').inert=false;}
}
function repRevisaoLider(d){
 const r=d.reporte,nomes=lista=>lista.map(a=>esc(r.pessoas.find(p=>p.registro===a.registro)?.nome||repMembro(a.registro).nome)).join(', ')||'Nenhuma';
 const ins=r.apontamentos.filter(a=>a.entregas==='INSUFICIENTE'||a.assiduidade==='INSUFICIENTE'),sin=r.apontamentos.filter(a=>a.sinalizacao);
 const sec=(titulo,corpo)=>`<section class="rep-bloco"><h3>${titulo}</h3>${corpo}</section>`;
 return sec('Apontamentos',spec([['Pessoas avaliadas',String(r.pessoas.length),true],['Com algum item insuficiente',nomes(ins)],['Sinalizadas',nomes(sin)]]))
  +sec('Escalonamentos',r.escalonamentos.length?`<ol class="stack">${r.escalonamentos.map(x=>`<li>${esc(x.texto||'')}${x.codigo?` <a href="#/atividades/card/${esc(x.codigo)}">${esc(x.codigo)}</a>`:''}</li>`).join('')}</ol>`:'<p class="small muted">Nenhum tópico.</p>')
  +sec('Publicações no feed',d.feed.length?d.feed.map(f=>repArtigo(f,repMembro(r.autor).nome)).join(''):'<p class="small muted">Nenhuma publicação.</p>')
  +`<div class="aviso-box info">${REP_ENVIO_LIDER}</div>`;
}
async function repEnviarLider(){
 if(!repPodeEditarLider()||reporte.ocupado||reporte.uploads)return;
 const d=reporte.lider,r=d.reporte;
 if(r.apontamentos.some(a=>a.sinalizacao&&(!a.sinalizacao.relato.trim()||a.sinalizacao.conversa_confirmada!==true)))return toast('Confira o relato e a conversa das pessoas sinalizadas.',true);
 if(!await confirma(REP_ENVIO_LIDER,'Enviar reporte'))return;
 if(reporte.lider!==d||!repPodeEditarLider())return;
 reporte.mutando=true;$('#main').inert=true;
 try{
  r.etapa=3;if(!await repSalvar(true))return;
  reporte.ocupado=true;
  const res=await repRPC('reporte_enviar',{p_id:r.id,p_versao:r.versao});
  toast('Reporte enviado.'+(res.atrasado?' Ficou registrado como fora do prazo.':''));
  reporte.aberto=null;reporte.lider=null;await pageReporte();
 }catch(e){repErro(e);}finally{reporte.ocupado=false;reporte.mutando=false;$('#main').inert=false;}
}

/* ---------------- A: prazo e reunião (admin) ---------------- */
function repTelaConfig(){
 if(!souAdmin()){location.hash='#/servicos/reporte';return;}
 const c=reporte.painel.config,dias=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
 const linha=(k,t,dica)=>ajuste({titulo:t,dica,controle:`<div style="display:flex;gap:10px;flex-wrap:wrap"><div class="fld"><label for="rep-dia-${k}">Dia</label><select id="rep-dia-${k}">${dias.map((x,i)=>`<option value="${i}" ${c['dia_'+k]===i?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="fld"><label for="rep-hora-${k}">Horário</label><input type="time" id="rep-hora-${k}" value="${esc(String(c['hora_'+k]||'').slice(0,5))}"></div></div>`});
 $('#main').innerHTML=cabecalho({espaco:'Serviços',titulo:'Configurar ciclo',voltar:['Reporte semanal','#/servicos/reporte']})
  +`<div class="card"><div class="ajustes">${linha('prazo','Prazo (cobrança)','Vale para os próximos ciclos.')}${linha('reuniao','Reunião da gerência','Vale para os próximos ciclos.')}
   ${ajuste({titulo:'Reporte por liderança desde',dica:'Vale a partir da sprint desta data.',controle:`<div class="fld"><label for="rep-modelo-desde">Data</label><input type="date" id="rep-modelo-desde" value="${esc(c.modelo_lider_desde||'')}"></div>`})}</div>
   <div class="ajustes-pe"><a class="btn ghost" href="#/servicos/reporte">Cancelar</a><button class="btn solid" onclick="repConfigSalvar()">Salvar</button></div></div>`;
}
async function repConfigSalvar(){
 try{const p={};for(const k of ['prazo','reuniao']){p['dia_'+k]=Number($('#rep-dia-'+k).value);p['hora_'+k]=$('#rep-hora-'+k).value;}
 p.modelo_lider_desde=$('#rep-modelo-desde').value||null;
 await repRPC('reporte_configurar',{p});toast('Ciclo configurado.');location.hash='#/servicos/reporte';}catch(e){falha(e,'Não foi possível configurar o ciclo');}
}
/* ---------------- o painel da semana (modelo por liderança, 2.19.1) ---------------- */
const REP_SIT_LIDER={enviado:['Enviado','p-ok'],ausente:['Ausente',''],ferias:['Férias',''],pendente:['Pendente','p-warn']};
async function repTelaPainel(){
 reporte.consolidado=await repRPC('reporte_consolidado_pode').then(v=>v===true,()=>false);
 if(!reporte.consolidado){location.hash='#/servicos/reporte';return;}
 const d=await repRPC('reporte_lider_painel');
 reporte.liderPainel=d;
 const c=d.ciclo,ls=d.lideres||[];
 const conta=s=>ls.filter(x=>x.situacao===s).length,atras=ls.filter(x=>x.atrasado).length;
 const m=(r,v)=>`<div class="metrica"><span class="rot">${r}</span><span class="val">${v}</span></div>`;
 const linhas=ls.map(x=>{
  const [t,cl]=x.situacao==='enviado'&&x.atrasado?['Atrasado','p-warn']:(REP_SIT_LIDER[x.situacao]||[x.situacao,'']);
  return `<tr><td class="nome">${esc(x.nome)}</td><td>${repPill(t,cl)}</td><td class="mono">${x.enviado_em?fmtDT(x.enviado_em):'—'}</td></tr>`;}).join('');
 $('#main').innerHTML=cabecalho({espaco:'Serviços',titulo:'Reporte semanal',voltar:['Meu reporte','#/servicos/reporte'],meta:['Semana de '+fmtD(c.semana)],
   acoes:[`<button class="btn ghost" onclick="repPDF()">${ic('doc')}Baixar o reporte unificado</button>`,souAdmin()?'<a class="btn ghost" href="#/servicos/reporte/config">Configurar</a>':'']})
  +`<div class="metricas" style="margin-bottom:18px">${m('Lideranças',ls.length)}${m('Enviados',conta('enviado'))}${m('Atrasados',atras)}${m('Ausentes ou férias',conta('ausente')+conta('ferias'))}${m('Pendentes',conta('pendente'))}</div>`
  +(ls.length?`<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho" id="rep-painel-tabela"><thead><tr><th>Liderança</th><th>Situação</th><th>Enviado em</th></tr></thead><tbody>${linhas}</tbody></table></div></div>`
   :estado.vazio({texto:'Nenhuma liderança com reporte nesta semana.'}));
}
async function repPDF(){
 try{const d=await repRPC('reporte_unificado',{p_ciclo:(reporte.liderPainel||reporte.painel).ciclo.id});
 await precisaDocNRO();
 const doc=DocNRO.reporteUnificado(d);DocNRO.baixar(doc,'Reporte semanal '+(reporte.liderPainel||reporte.painel).ciclo.semana+'.pdf');
 }catch(e){falha(e,'Não foi possível gerar o reporte');}
}
