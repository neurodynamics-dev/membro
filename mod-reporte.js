/* ============================================================
   Reporte semanal e feed da equipe (Equipe).
   Endereços (toda tela tem endereço, PADROES §2):
     #/equipe/reporte                     o ciclo da semana (Lista)
     #/equipe/reporte/<frente>/<passo>    preencher ou consultar (Fluxo, 1 a 4)
     #/equipe/reporte/config              prazo e reunião (Ajustes, admin)
   O banco tem três etapas (apontamentos, escalonamentos, feed) e o envio
   exige etapa 3; o passo 4, a Revisão, é só da tela. A permissão e o
   encerramento são conferidos no banco.
   ============================================================ */
const reporte = { painel:null, aberto:null, ocupado:false, uploads:0, feed:[], sujo:false, timer:null, passo:1 };
const REP_PASSOS = [['1','Apontamentos'], ['2','Escalonamentos'], ['3','Publicações no feed'], ['4','Revisão e envio']];
async function repRPC(nome,p={}){
 const {data,error}=await sb.rpc(nome,p); if(error) throw error;
 if(data?.status && data.status!=='ok') throw new Error(({sem_permissao:MOTIVO_RPC.sem_permissao,
 conflito:'O reporte foi alterado em outra sessão. Recarregue o reporte para continuar.',encerrado:'O prazo de envio está encerrado.',
 invalido:'Confira os campos obrigatórios.',incompleto:'Falta o apontamento de um membro da frente.'})[data.status] || data.status);
 return data;
}
const repPill=(t,c)=>`<span class="pill ${c||''}"><span class="dt ${c==='p-ok'?'dt-ok':c==='p-warn'?'dt-warn':c==='p-bad'?'dt-bad':''}"></span>${esc(t)}</span>`;
const repTopo=(titulo,secao)=>cabecalho({espaco:'Equipe',titulo,secoes:abasEquipe(secao||'reporte')});
const repRota=()=>{const [,,,a,b]=location.hash.split('/');return {a:a||'',b:b||''};};
const repLimite=ciclo=>(new Date(ciclo.prazo)-Date.now())/36e5;
const repPrazoPill=ciclo=>{const h=repLimite(ciclo);return h<=0?repPill('Prazo encerrado'):h<24?repPill('Prazo em '+(h<1?'menos de 1 hora':Math.ceil(h)+' h'),'p-warn'):'';};
const repTravado=d=>!!d.reporte.enviado_em||d.ciclo.fechado||new Date(d.ciclo.prazo)<new Date();

/* ---------------- a rota ---------------- */
async function pageReporte(){
 if(!tenhoPapel('lideranca')){location.hash='#/';return;}
 const {a,b}=repRota();
 if(reporte.sujo&&reporte.aberto)await repSalvar(true);
 $('#main').innerHTML=(a&&a!=='config'?cabecalho({espaco:'Equipe',titulo:'Reporte semanal',voltar:['Reporte semanal','#/equipe/reporte']}):repTopo('Reporte semanal'))+estado.carregando(a&&a!=='config'?null:'lista');
 try{
  reporte.painel=await repRPC('reporte_painel');
  if(a==='config')return repTelaConfig();
  if(a)return await repTelaFluxo(a,Math.min(4,Math.max(1,Number(b)||1)));
  reporte.aberto=null;repTelaLista();
 }catch(e){$('#main').innerHTML=repTopo('Reporte semanal')+estado.erro({texto:'Não foi possível carregar o reporte: '+e.message+'.',acao:'<button class="btn ghost mini" onclick="pageReporte()">Tentar de novo</button>'});}
}

/* ---------------- L: o ciclo da semana ---------------- */
function repTelaLista(){
 const d=reporte.painel,c=d.ciclo,enviados=d.frentes.filter(f=>f.enviado_em).length;
 const m=(r,v,x)=>`<div class="metrica"><span class="rot">${r}</span><span class="val">${v}</span>${x||''}</div>`;
 const encerrado=c.fechado||new Date(c.prazo)<new Date();
 const linhas=d.frentes.map(f=>{
  const sit=f.enviado_em?repPill('Enviado','p-ok'):encerrado?repPill('Encerrado'):repPill('Pendente','p-warn');
  const acao=`<a class="btn ghost mini" href="#/equipe/reporte/${esc(f.id)}/1">${f.enviado_em||encerrado?'Consultar':'Preencher'}</a>`;
  return `<tr><td class="nome">${esc(f.nome)}</td><td>${esc(f.responsavel_nome)}</td><td>${sit}</td><td class="mono">${f.enviado_em?fmtDT(f.enviado_em):"—"}</td><td style="text-align:right">${acao}</td></tr>`;}).join('');
 $('#main').innerHTML=cabecalho({espaco:'Equipe',titulo:'Reporte semanal',meta:[repPrazoPill(c)],secoes:abasEquipe('reporte'),
   acoes:souAdmin()?[`<button class="btn ghost" onclick="repPDF()">${ic('doc')}Baixar reporte unificado</button>`,`<a class="btn ghost" href="#/equipe/reporte/config">Configurar ciclo</a>`]:[]})
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
 const d=reporte.aberto,r=d.reporte,travado=repTravado(d),n=reporte.passo;
 const aviso=r.enviado_em?`<div class="aviso-box info" role="status">Reporte enviado em ${fmtDT(r.enviado_em)}.</div>`
  :travado?'<div class="aviso-box warn" role="status">O prazo de envio está encerrado. O reporte está somente para leitura.</div>':'';
 const corpo=[repPassoApont,repPassoEscal,repPassoFeed,repPassoRevisao][n-1](d,travado);
 const rota=k=>`#/equipe/reporte/${esc(r.frente_id)}/${k}`;
 const acoes=[n>1?`<a class="btn ghost" href="${rota(n-1)}">Etapa anterior</a>`:'',
  !travado?'<button class="btn ghost" id="rep-salvar" onclick="repSalvar()">Salvar rascunho</button>':'',
  n<4?`<a class="btn solid" href="${rota(n+1)}">Continuar</a>`:(!travado?'<button class="btn solid" id="rep-enviar" onclick="repEnviar()">Enviar reporte</button>':'')].join('');
 $('#main').innerHTML=cabecalho({espaco:'Equipe',titulo:d.grupo.nome,voltar:['Reporte semanal','#/equipe/reporte'],meta:['Semana de '+fmtD(d.ciclo.semana),repPrazoPill(d.ciclo)]})
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
 reporte.sujo=true;repSalvo('Alterações não salvas','pendente');
 clearTimeout(reporte.timer);reporte.timer=setTimeout(()=>{if(reporte.ocupado)return repMarcar();repSalvar(true);},2000);
}
function repSalvo(txt,cls){const el=document.getElementById('rep-salvo');if(el){el.textContent=txt;el.className='salvo '+(cls||'');}}
async function repSalvar(silencioso=false){
 if(reporte.uploads){if(!silencioso)toast('Aguarde o envio da imagem.',true);return false;}
 if(reporte.ocupado)return false;
 clearTimeout(reporte.timer);reporte.ocupado=true;repSalvo('Salvando…','pendente');
 try{const d=reporte.aberto,r=d.reporte;r.etapa=Math.max(r.etapa||1,Math.min(reporte.passo,3));
  const res=await repRPC('reporte_salvar',{p:{...r,feed:d.feed}});
  r.versao=res.versao;reporte.sujo=false;repSalvo('Salvo às '+new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}),'ok');
  if(!silencioso)toast('Rascunho salvo.');return true;
 }catch(e){repSalvo('Não foi possível salvar','pendente');repErro(e);return false;}finally{reporte.ocupado=false;}
}
function repErro(e){
 const el=document.getElementById('rep-aviso');
 if(el&&/outra sessão/.test(e.message)){el.innerHTML=`<div class="aviso-box err estado-erro" role="alert"><span>${esc(e.message)}</span><button class="btn ghost mini" onclick="reporte.aberto=null;reporte.sujo=false;pageReporte()">Recarregar o reporte</button></div>`;return;}
 falha(e,'Não foi possível salvar o reporte');
}
async function repEnviar(){
 if(reporte.ocupado)return;
 const r=reporte.aberto.reporte;
 if(r.apontamentos.some(a=>a.sinalizado&&!String(a.justificativa||'').trim())){document.getElementById('rep-enviar')?.blur();return toast('Informe a justificativa dos membros sinalizados.',true);}
 if(!await confirma('Depois de enviado, o reporte não pode ser editado. As publicações entram no feed da equipe e as sinalizações vão para o Pessoal.','Enviar reporte'))return;
 r.etapa=3;if(!await repSalvar(true))return;
 reporte.ocupado=true;
 try{await repRPC('reporte_enviar',{p_id:r.id,p_versao:r.versao});toast('Reporte enviado.');reporte.aberto=null;location.hash='#/equipe/reporte';}
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

/* ---------------- A: prazo e reunião (admin) ---------------- */
function repTelaConfig(){
 if(!souAdmin()){location.hash='#/equipe/reporte';return;}
 const c=reporte.painel.config,dias=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
 const linha=(k,t,dica)=>ajuste({titulo:t,dica,controle:`<div style="display:flex;gap:10px;flex-wrap:wrap"><div class="fld"><label for="rep-dia-${k}">Dia</label><select id="rep-dia-${k}">${dias.map((x,i)=>`<option value="${i}" ${c['dia_'+k]===i?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="fld"><label for="rep-hora-${k}">Horário</label><input type="time" id="rep-hora-${k}" value="${esc(String(c['hora_'+k]||'').slice(0,5))}"></div></div>`});
 $('#main').innerHTML=cabecalho({espaco:'Equipe',titulo:'Configurar ciclo',voltar:['Reporte semanal','#/equipe/reporte']})
  +`<div class="card"><div class="ajustes">${linha('prazo','Prazo de envio','Vale para os próximos ciclos.')}${linha('reuniao','Reunião','Vale para os próximos ciclos.')}
   ${ajuste({titulo:'Frentes e responsáveis',dica:'Quem preenche cada frente.',controle:'<a class="btn ghost mini" href="#/admin/grupos">Abrir Grupos</a>'})}</div>
   <div class="ajustes-pe"><a class="btn ghost" href="#/equipe/reporte">Cancelar</a><button class="btn solid" onclick="repConfigSalvar()">Salvar</button></div></div>`;
}
async function repConfigSalvar(){
 try{const p={};for(const k of ['prazo','reuniao']){p['dia_'+k]=Number($('#rep-dia-'+k).value);p['hora_'+k]=$('#rep-hora-'+k).value;}
 await repRPC('reporte_configurar',{p});toast('Ciclo configurado.');location.hash='#/equipe/reporte';}catch(e){falha(e,'Não foi possível configurar o ciclo');}
}
async function repPDF(){
 try{const d=await repRPC('reporte_unificado',{p_ciclo:reporte.painel.ciclo.id});
 await precisaDocNRO();
 const doc=DocNRO.reporteUnificado(d);DocNRO.baixar(doc,'Reporte semanal '+reporte.painel.ciclo.semana+'.pdf');
 }catch(e){falha(e,'Não foi possível gerar o reporte');}
}

/* ---------------- E: o feed da equipe ---------------- */
async function pageFeed(){
 reporte.feed=[];
 $('#main').innerHTML=repTopo('Feed da equipe','feed')+layoutLeitura('<div id="feed-lista"></div><button id="feed-mais" class="btn ghost" style="margin-top:28px;width:100%;justify-content:center" onclick="repFeedMais()" hidden>Carregar mais</button>');
 $('#feed-lista').innerHTML=estado.carregando('lista');
 await repFeedMais(true);
}
async function repFeedMais(primeira){
 const el=$('#feed-lista'),bt=$('#feed-mais');bt.disabled=true;
 try{const ultimo=reporte.feed.at(-1);const itens=await repRPC('feed_lista',ultimo?{p_antes:ultimo.publicado_em,p_id:ultimo.id}:{});
 if(primeira)el.innerHTML='';
 reporte.feed.push(...itens);bt.hidden=itens.length<20;
 if(!reporte.feed.length)el.innerHTML=estado.vazio({texto:'Nenhuma publicação ainda. O que a liderança envia no reporte semanal aparece aqui.'});
 el.insertAdjacentHTML('beforeend',itens.map(f=>`<article class="artigo"><div class="artigo-meta"><span>${esc(f.autor)}</span><time>${fmtDT(f.publicado_em)}</time>${can()?`<button type="button" class="icbtn sm" style="margin-left:auto" aria-label="Ocultar publicação" onclick="repOcultar('${f.id}')">${ic('x')}</button>`:''}</div>
  <h2>${esc(f.titulo)}</h2>${f.subtitulo?`<p class="sub">${esc(f.subtitulo)}</p>`:''}${f.imagem_path?`<img id="feed-img-${f.id}" alt="" loading="lazy">`:''}<div class="md">${md(f.texto)}</div></article>`).join(''));
 for(const f of itens.filter(x=>x.imagem_path)){const {data,error}=await sb.storage.from('feed').createSignedUrl(f.imagem_path,300);if(!error&&data?.signedUrl){const img=document.getElementById('feed-img-'+f.id);if(img)img.src=data.signedUrl;}}
 }catch(e){el.innerHTML=estado.erro({texto:'Não foi possível carregar o feed: '+e.message+'.',acao:'<button class="btn ghost mini" onclick="pageFeed()">Tentar de novo</button>'});}finally{bt.disabled=false;}
}
async function repOcultar(id){if(!await confirma('A publicação deixará de aparecer no feed.','Ocultar publicação'))return;try{await repRPC('feed_ocultar',{p_id:id});await pageFeed();}catch(e){falha(e,'Não foi possível ocultar a publicação');}}

/* ---------------- newsletters ---------------- */
async function pageNewsletter(){
 if(!tenhoPapel('lideranca')){location.hash='#/';return;}
 $('#main').innerHTML=repTopo('Newsletters','newsletter')+'<div id="news-lista">Carregando…</div>';
 try{
  const lista=await repRPC('newsletter_lista');reporte.newsletters=lista;
  $('#news-lista').innerHTML=`<div class="acts"><button class="btn" onclick="repNewsGerar('semanal')">Gerar boletim semanal</button><button class="btn" onclick="repNewsGerar('mensal')">Gerar boletim mensal</button>
  ${souAdmin()?'<button class="btn" onclick="repComunidade()">Importar comunidade</button>':''}</div>`+
  (lista.map(n=>`<article class="card" id="news-${esc(n.id)}"><h2>${esc(n.assunto)}</h2><p class="small muted">${esc(n.status)}. Aprovações: ${n.aprovacoes}/3. Versão ${n.versao}.</p>
  ${n.itens.map(i=>`<h3>${esc(i.titulo)}</h3><p>${esc(i.subtitulo)}</p><div class="md">${md(i.texto)}</div>`).join('')}
  ${n.status==='em_aprovacao'?`<div class="acts"><button class="btn" onclick="repNewsEditar('${n.id}')">Revisar conteúdo</button><button class="btn" onclick="repNewsVotar('${n.id}',false)">Recusar</button><button class="btn solid" onclick="repNewsVotar('${n.id}',true)">Aprovar versão ${n.versao}</button></div>`:''}</article>`).join('')||'<div class="vazio">Nenhuma newsletter. O período anterior precisa ter publicações no feed.</div>');
  const id=location.hash.split('/')[3];if(id)document.getElementById('news-'+id)?.scrollIntoView();
 }catch(e){$('#news-lista').textContent='Não foi possível carregar newsletters: '+e.message+'.';}
}
async function repNewsGerar(tipo){try{const d=await repRPC('newsletter_gerar',{p_tipo:tipo});if(!d.id)toast('Nenhuma publicação no período.',true);await pageNewsletter();}catch(e){falha(e,'Não foi possível gerar o boletim');}}
async function repNewsVotar(id,aprova){
 const n=reporte.newsletters.find(x=>x.id===id);if(!n)return;
 if(!await confirma(aprova?'Aprovar esta versão para envio após três aprovações da liderança?':'Recusar esta versão?',aprova?'Aprovar':'Recusar'))return;
 try{await repRPC('newsletter_decidir',{p_id:id,p_versao:n.versao,p_aprova:aprova});await pageNewsletter();}catch(e){falha(e,'Não foi possível registrar a decisão');}
}
function repNewsEditar(id){const n=reporte.newsletters.find(x=>x.id===id);reporte.newsEdit=structuredClone(n);
 abreModal(`<h3>Revisar newsletter</h3><p class="small muted">Salvar remove as aprovações desta versão.</p><div class="fld"><label for="news-assunto">Assunto</label><input id="news-assunto" value="${esc(n.assunto)}"></div>
 ${n.itens.map((x,i)=>['titulo','subtitulo','texto'].map(k=>`<div class="fld"><label for="news-${i}-${k}">${esc(k)}</label><textarea id="news-${i}-${k}" oninput="reporte.newsEdit.itens[${i}].${k}=this.value">${esc(x[k])}</textarea></div>`).join('')).join('')}
 <button class="btn solid" onclick="repNewsSalvar()">Salvar nova versão</button>`);}
async function repNewsSalvar(){try{await repRPC('newsletter_revisar',{p_id:reporte.newsEdit.id,p_assunto:$('#news-assunto').value,p_itens:reporte.newsEdit.itens});fechaModal();await pageNewsletter();}catch(e){falha(e,'Não foi possível revisar o boletim');}}
function repComunidade(){if(!souAdmin())return;abreModal(`<h3>Importar comunidade</h3><p class="small muted">Colunas: nome, email, origem. Descadastros anteriores são preservados.</p><input aria-label="Planilha da comunidade" type="file" accept=".xlsx,.xls,.csv" onchange="repComunidadeLer(this.files[0])"><div id="news-importar"></div>`);}
async function repComunidadeLer(file){try{
 if(!file)return;if(!window.XLSX)await carregarLib('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
 const wb=XLSX.read(await file.arrayBuffer(),{type:'array'});reporte.importar=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});
 $('#news-importar').innerHTML=`<p>${reporte.importar.length} registros.</p><button class="btn solid" onclick="repComunidadeSalvar()">Importar</button>`;
 }catch(e){falha(e,'Não foi possível ler a planilha');}}
async function repComunidadeSalvar(){try{const d=await repRPC('comunidade_importar',{p_itens:reporte.importar});fechaModal();toast(`${d.processados} registros processados.`);}catch(e){falha(e,'Não foi possível importar a comunidade');}}

function repComunidadePagina(){
 $('#sec-emails').innerHTML=`<div class="card"><h2>Comunidade</h2><p>Familiares, professores associados e parceiros que recebem o boletim mensal.</p><div class="acts"><button class="btn solid" onclick="repComunidade()">Importar planilha</button><a class="btn" href="#/equipe/newsletter">Newsletters</a></div>${dica('A planilha deve ter nome e e-mail. A importação não reativa quem se descadastrou. A comunidade recebe somente boletins aprovados por três integrantes da liderança.')}</div>`;
}
