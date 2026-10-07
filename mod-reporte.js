/* Reporte semanal e feed. A permissão e o encerramento são conferidos no banco. */
const reporte = { painel:null, aberto:null, ocupado:false, uploads:0, feed:[] };
async function repRPC(nome,p={}){
 const {data,error}=await sb.rpc(nome,p); if(error) throw error;
 if(data?.status && data.status!=='ok') throw new Error(({sem_permissao:MOTIVO_RPC.sem_permissao,
 conflito:'O reporte foi alterado em outra sessão. Reabra antes de continuar.',encerrado:'O prazo de envio está encerrado.',
 invalido:'Confira os campos obrigatórios.'})[data.status] || data.status);
 return data;
}
function repTopo(titulo){return `<div class="pg-head"><span class="eyebrow">Equipe</span><h1>${esc(titulo)}</h1></div>${abasEquipe('reporte')}`;}
async function pageReporte(){
 if(!tenhoPapel('lideranca')){location.hash='#/';return;}
 $('#main').innerHTML=repTopo('Reporte semanal')+'<div class="carregando">Carregando…</div>';
 try{
  reporte.painel=await repRPC('reporte_painel'); const d=reporte.painel;
  $('#main').innerHTML=repTopo('Reporte semanal')+`<div class="card"><h3>Semana de ${fmtD(d.ciclo.semana)}</h3>
   <p class="small muted">Prazo: ${fmtDT(d.ciclo.prazo)}. Reunião: ${fmtDT(d.ciclo.reuniao_em)}.</p>
   <div class="acts"><button class="btn" onclick="repConfig()">Configurar ciclo</button>
   ${souAdmin()?'<button class="btn" onclick="repPDF()">Baixar reporte unificado</button>':''}</div></div>
   ${d.frentes.length?d.frentes.map(f=>`<div class="card"><h3>${esc(f.nome)}</h3><p>${esc(f.responsavel_nome)}</p>
   <p class="small muted">${f.enviado_em?'Enviado em '+fmtDT(f.enviado_em):'Pendente'}</p>
   <button class="btn" onclick="repAbrir('${f.id}')">${f.enviado_em?'Consultar':'Preencher'}</button></div>`).join(''):
   '<div class="vazio">Nenhuma frente atribuída. Cadastre o responsável em Administração, Grupos.</div>'}`;
 }catch(e){$('#main').innerHTML=repTopo('Reporte semanal')+`<div class="aviso-box err">Não foi possível carregar o reporte: ${esc(e.message)}.</div>`;}
}
async function repAbrir(frente){
 try{reporte.aberto=await repRPC('reporte_abrir',{p_ciclo:reporte.painel.ciclo.id,p_frente:frente});repRender();}
 catch(e){falha(e,'Não foi possível abrir o reporte');}
}
function repCampo(i,k,v){reporte.aberto.reporte.apontamentos[i][k]=v;}
function repRender(){
 const d=reporte.aberto,r=d.reporte,travado=!!r.enviado_em || d.ciclo.fechado || new Date(d.ciclo.prazo)<new Date();
 $('#main').innerHTML=repTopo('Reporte semanal')+`<div class="card"><h3>${esc(d.grupo.nome)}</h3>
 ${navNivel1([[1,'Apontamento'],[2,'Escalonamento'],[3,'Feed da equipe']].map(([n,t])=>[n,t,`javascript:repEtapa(${n})`]),r.etapa,'Etapas')}
 <fieldset ${travado?'disabled':''} style="border:0;padding:0;min-width:0">
 ${r.etapa===1?r.apontamentos.map((a,i)=>`<div class="card"><h3>${esc(nomeDe(a.registro))}</h3>
 ${['assiduidade','entregas'].map(k=>`<div class="fld"><label for="rep-${i}-${k}">${k==='assiduidade'?'Assiduidade':'Entregas'}</label>
 <select id="rep-${i}-${k}" onchange="repCampo(${i},'${k}',this.value)">${['SUFICIENTE','INSUFICIENTE'].map(v=>`<option ${a[k]===v?'selected':''}>${v}</option>`).join('')}</select></div>`).join('')}
 <label class="check"><input type="checkbox" ${a.sinalizado?'checked':''} onchange="repCampo(${i},'sinalizado',this.checked)"> Sinalizar ao Pessoal</label>
 <div class="fld"><label for="rep-just-${i}">Justificativa</label><textarea id="rep-just-${i}" oninput="repCampo(${i},'justificativa',this.value)">${esc(a.justificativa||'')}</textarea></div></div>`).join('')||'<div class="vazio">Nenhum membro nesta frente.</div>':''}
 ${r.etapa===2?`<div id="rep-topicos">${r.escalonamentos.map((x,i)=>`<div class="card"><div class="fld"><label for="rep-topico-${i}">Tópico ${i+1}</label><textarea id="rep-topico-${i}" oninput="reporte.aberto.reporte.escalonamentos[${i}].texto=this.value">${esc(x.texto)}</textarea></div>
 <div class="fld"><label for="rep-card-${i}">Código da atividade (opcional)</label><input id="rep-card-${i}" value="${esc(x.codigo||'')}" onchange="repVincular(${i},this.value)"></div>
 <button class="btn" onclick="reporte.aberto.reporte.escalonamentos.splice(${i},1);repRender()">Remover tópico</button></div>`).join('')}</div>
 <button class="btn" onclick="reporte.aberto.reporte.escalonamentos.push({texto:''});repRender()">Adicionar tópico</button>`:''}
 ${r.etapa===3?`${d.feed.map((x,i)=>`<div class="card">${['titulo','subtitulo','texto'].map(k=>`<div class="fld"><label for="rep-feed-${i}-${k}">${({titulo:'Título',subtitulo:'Subtítulo',texto:'Texto completo'})[k]}</label><textarea id="rep-feed-${i}-${k}" oninput="reporte.aberto.feed[${i}].${k}=this.value">${esc(x[k]||'')}</textarea></div>`).join('')}
 <div class="fld"><label for="rep-img-${i}">Imagem (opcional, até 5 MB)</label><input type="file" id="rep-img-${i}" accept="image/png,image/jpeg,image/webp" onchange="repImagem(${i},this.files[0])"></div>
 <p class="small muted" id="rep-img-status-${i}">${x.imagem_path?'Imagem anexada.':''}</p>
 <button class="btn" onclick="reporte.aberto.feed.splice(${i},1);repRender()">Remover publicação</button></div>`).join('')}
 <button class="btn" onclick="reporte.aberto.feed.push({titulo:'',subtitulo:'',texto:''});repRender()">Adicionar publicação</button>`:''}
 </fieldset><div class="acts"><button class="btn" onclick="pageReporte()">Voltar</button>
 ${travado?'<span class="small muted">Reporte encerrado.</span>':`<button class="btn" id="rep-salvar" onclick="repSalvar()">Salvar rascunho</button>
 ${r.etapa===3?'<button class="btn solid" id="rep-enviar" onclick="repEnviar()">Enviar reporte</button>':''}`}</div></div>`;
}
function repEtapa(n){reporte.aberto.reporte.etapa=n;repRender();}
async function repSalvar(silencioso=false){
 if(reporte.uploads){toast('Aguarde o envio da imagem.',true);return false;}
 if(reporte.ocupado)return false; reporte.ocupado=true;
 try{const d=reporte.aberto,r=d.reporte;const res=await repRPC('reporte_salvar',{p:{...r,feed:d.feed}});
 r.versao=res.versao;if(!silencioso)toast('Rascunho salvo.');return true;
 }catch(e){falha(e,'Não foi possível salvar o reporte');return false;}finally{reporte.ocupado=false;}
}
async function repEnviar(){
 if(reporte.ocupado)return;
 if(!await confirma('As publicações entram no feed da equipe e as sinalizações são encaminhadas ao Pessoal.','Enviar reporte'))return;
 if(!await repSalvar(true))return;
 reporte.ocupado=true;
 try{await repRPC('reporte_enviar',{p_id:reporte.aberto.reporte.id,p_versao:reporte.aberto.reporte.versao});toast('Reporte enviado.');await pageReporte();}
 catch(e){falha(e,'Não foi possível enviar o reporte');}finally{reporte.ocupado=false;}
}
async function repVincular(i,codigo){
 const item=reporte.aberto.reporte.escalonamentos[i]; delete item.atividade_id;delete item.codigo;
 if(!codigo.trim())return;
 const {data,error}=await sb.from('atividades').select('id,codigo').eq('codigo',codigo.trim().toUpperCase()).maybeSingle();
 if(error||!data){toast('Atividade não encontrada.',true);return;}
 item.atividade_id=data.id;item.codigo=data.codigo;
}
async function repImagem(i,file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>5*1024*1024){toast('Use PNG, JPEG ou WebP de até 5 MB.',true);return;}
 const ext=({ 'image/png':'png','image/jpeg':'jpg','image/webp':'webp'})[file.type];
 const aberto=reporte.aberto,item=aberto.feed[i];reporte.uploads++;
 const path=`${aberto.reporte.id}/${crypto.randomUUID()}.${ext}`;
 try{const {error}=await sb.storage.from('feed').upload(path,file,{contentType:file.type});if(error)throw error;
 item.imagem_path=path;const status=reporte.aberto===aberto?$('#rep-img-status-'+i):null;if(status)status.textContent='Imagem anexada.';
 }catch(e){falha(e,'Não foi possível anexar a imagem');}finally{reporte.uploads--;}
}
function repConfig(){
 const c=reporte.painel.config,dias=['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo'];
 abreModal(`<h3>Próximos ciclos</h3>${['prazo','reuniao'].map(k=>`<div class="fld"><label>${k==='prazo'?'Prazo':'Reunião'}</label><select id="rep-dia-${k}">${dias.map((d,i)=>`<option value="${i}" ${c['dia_'+k]===i?'selected':''}>${d}</option>`).join('')}</select><input aria-label="Horário de ${k}" type="time" id="rep-hora-${k}" value="${esc(c['hora_'+k].slice(0,5))}"></div>`).join('')}<button class="btn solid" onclick="repConfigSalvar()">Salvar</button>`);
}
async function repConfigSalvar(){
 try{const p={};for(const k of ['prazo','reuniao']){p['dia_'+k]=Number($('#rep-dia-'+k).value);p['hora_'+k]=$('#rep-hora-'+k).value;}
 await repRPC('reporte_configurar',{p});fechaModal();await pageReporte();}catch(e){falha(e,'Não foi possível configurar o ciclo');}
}
async function repPDF(){
 try{const d=await repRPC('reporte_unificado',{p_ciclo:reporte.painel.ciclo.id});
 await precisaDocNRO();
 const doc=DocNRO.reporteUnificado(d);DocNRO.baixar(doc,'Reporte semanal '+reporte.painel.ciclo.semana+'.pdf');
 }catch(e){falha(e,'Não foi possível gerar o reporte');}
}
async function pageFeed(){
 reporte.feed=[];
 $('#main').innerHTML='<div class="pg-head"><h1>Feed da equipe</h1></div><div id="feed-lista"></div><button id="feed-mais" class="btn" onclick="repFeedMais()">Carregar mais</button>';
 await repFeedMais();
}
async function repFeedMais(){
 const el=$('#feed-lista'),button=$('#feed-mais');button.disabled=true;
 try{const ultimo=reporte.feed.at(-1);const itens=await repRPC('feed_lista',ultimo?{p_antes:ultimo.publicado_em,p_id:ultimo.id}:{});
 reporte.feed.push(...itens);button.hidden=itens.length<20;
 if(!reporte.feed.length)el.innerHTML='<div class="vazio">Nenhuma publicação.</div>';
 el.insertAdjacentHTML('beforeend',itens.map(f=>`<article class="card"><p class="eyebrow">${esc(f.autor)} <time>${fmtDT(f.publicado_em)}</time></p><h2>${esc(f.titulo)}</h2><p class="lead">${esc(f.subtitulo)}</p>${f.imagem_path?`<img id="feed-img-${f.id}" alt="" style="max-width:100%;border-radius:14px" loading="lazy">`:''}<div class="md">${md(f.texto)}</div>${can()?`<button class="btn" onclick="repOcultar('${f.id}')">Ocultar publicação</button>`:''}</article>`).join(''));
 for(const f of itens.filter(x=>x.imagem_path)){const {data,error}=await sb.storage.from('feed').createSignedUrl(f.imagem_path,300);if(!error&&data?.signedUrl){const img=document.getElementById('feed-img-'+f.id);if(img)img.src=data.signedUrl;}}
 }catch(e){toast('Não foi possível carregar o feed: '+e.message,true);}finally{button.disabled=false;}
}
async function repOcultar(id){if(!await confirma('A publicação deixará de aparecer no feed.','Ocultar publicação'))return;try{await repRPC('feed_ocultar',{p_id:id});await pageFeed();}catch(e){falha(e,'Não foi possível ocultar a publicação');}}
registrarBusca({fonte:'reporte',rotulo:'Equipe',buscar:termo=>[
 {titulo:'Feed da equipe',href:'#/feed'},...(tenhoPapel('lideranca')?[{titulo:'Reporte semanal',href:'#/equipe/reporte'}]:[])
].filter(x=>norm(x.titulo).includes(norm(termo)))});
async function pageNewsletter(){
 if(!tenhoPapel('lideranca')){location.hash='#/';return;}
 $('#main').innerHTML=repTopo('Newsletters')+'<div id="news-lista">Carregando…</div>';
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
