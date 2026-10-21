/* Marca no SOMA: só o que exige login. Os arquivos públicos (logos, wallpapers,
   kit de interface, prompts) moram em brand.neurodynamics.dev.
     #/marca              os modelos controlados e templates, ligados a Arquivos (Lista)
     #/marca/assinatura   a assinatura de e-mail, com os dados da ficha (Fluxo simples)
     #/marca/config       o vínculo de cada modelo com uma série de Arquivos (Ajustes)
   Arquivos é o único dono do download controlado. */
const marca={vinculos:[],rol:[],pode:new Map(),assinatura:{},filtro:'todos',tipo:'completa',cliente:'gmail'};
const MARCA_BASE='https://brand.neurodynamics.dev/';
const MARCA_ITENS=[
 ['relatorio','Relatório formal','relatorio-capa'],['apresentacao-formal','Apresentação formal','deck-formal-capa'],
 ['apresentacao-marca','Apresentação da marca','deck-marca-capa'],['carta','Carta','timbre-executivo'],['memorando','Memorando','timbre-operacional'],
 ['documentos-e-registros','Documentos e registros','relatorio-texto'],['boletim','Boletim','email-boletim'],['comunicado','Comunicado','email-comunicado-retina'],
 ['certificado','Certificado','certificado',true],['certificado-marca','Certificado da marca','certificado-marca-ion',true],
 ['convite','Convite','convite-cortex',true],['selo','Selo','certificado',true],['cracha','Crachá','cracha-ficha',true],['cartao','Cartão de visita','cartao-frente',true]
];

const marcaPill=(t,c)=>`<span class="pill ${c||''}"><span class="dt ${c==='p-ok'?'dt-ok':c==='p-warn'?'dt-warn':''}"></span>${esc(t)}</span>`;
const marcaSecoes=atual=>navNivel1([['','Modelos','#/marca'],['assinatura','Assinatura de e-mail','#/marca/assinatura'],...(docGestor()?[['config','Configurações','#/marca/config']]:[])],atual,'Marca');
const marcaTopo=(titulo,atual,extra={})=>cabecalho({espaco:'Marca',titulo,secoes:marcaSecoes(atual),...extra});

async function pageMarca(sub){
 if(sub==='interfaces')return marcaInterfaces();
 if(sub==='assinatura')return marcaAssinatura();
 if(sub==='config'&&!docGestor()){location.hash='#/marca';return;}
 $('#main').innerHTML=marcaTopo(sub==='config'?'Configurações':'Modelos',sub||'')+estado.carregando('lista');
 try{const [v,r]=await Promise.all([sb.from('marca_vinculos').select('*'),sb.from('doc_rol').select('*').is('pn',null)]);
 if(v.error||r.error)throw v.error||r.error;marca.vinculos=v.data||[];marca.rol=r.data||[];
 await Promise.all(marca.rol.map(async a=>{const {data,error}=await sb.rpc('doc_pode_ler',{p_arquivo:a.id});marca.pode.set(a.id,!error&&data===true);}));
 if(sub==='config')return marcaConfig();marcaModelos();
 }catch(e){$('#main').innerHTML=marcaTopo(sub==='config'?'Configurações':'Modelos',sub||'')+estado.erro({texto:'Não foi possível carregar os vínculos: '+e.message+'.',acao:`<button class="btn ghost mini" onclick="pageMarca(${sub?`'${sub}'`:''})">Tentar de novo</button>`});}
}
const marcaArquivo=chave=>{const v=marca.vinculos.find(x=>x.chave===chave);return v&&marca.rol.find(x=>x.serie_id===v.serie_id)||null;};

/* L: os modelos, em tiles */
function marcaModelos(){
 const f=marca.filtro,lista=MARCA_ITENS.filter(i=>f==='todos'||(f==='controlados')===!!i[3]);
 const tile=([k,n,img,ctrl])=>{
  const a=marcaArquivo(k),pode=a&&marca.pode.get(a.id);
  const sit=!a?marcaPill('Sem arquivo'):a.rev_vigente?marcaPill('Em vigor','p-ok'):marcaPill('Sem versão em vigor','p-warn');
  const acao=a?`<a class="btn ghost mini" href="#/arquivos/${esc(a.codigo)}">${pode?'Abrir em Arquivos':ic('cadeado')+'Download restrito'}</a>`
   :docGestor()?'<a class="btn ghost mini" href="#/marca/config">Vincular</a>':'';
  return `<article class="card marca-tile"><img loading="lazy" src="${MARCA_BASE}assets/manual/${img}.jpg" alt="" onerror="this.remove()">
   <div class="marca-tile-corpo"><h3>${esc(n)}</h3><div class="marca-tile-meta">${a?`<span class="cab-cod">${esc(a.codigo)}</span>`:''}${sit}</div><div class="marca-tile-acoes">${acao}</div></div></article>`;};
 $('#main').innerHTML=marcaTopo('Modelos','')
  +ferramentas({filtros:`<div class="seg" role="group" aria-label="Tipo">${[['todos','Todos'],['templates','Templates'],['controlados','Controlados']].map(([k,l])=>`<button type="button" class="${f===k?'on':''}" aria-pressed="${f===k}" onclick="marca.filtro='${k}';marcaModelos()">${l}</button>`).join('')}</div>`,total:lista.length})
  +`<div class="marca-grid">${lista.map(tile).join('')}</div>`
  +`<section class="band" style="margin-top:var(--s9)"><div class="band-txt"><span class="eyebrow">Manual da marca</span><h2>Logos, cores, wallpapers e o kit de interface</h2>
   <p>Os arquivos públicos ficam no manual, sem login: imagotipo, paleta, tipografia, fundos e componentes.</p>
   <a class="btn solid" href="${MARCA_BASE}" target="_blank" rel="noopener">Abrir o manual ↗</a></div></section>`;
}

/* A: o vínculo de cada modelo com uma série de Arquivos */
async function marcaConfig(){
 const {data,error}=await sb.from('doc_series').select('*').order('prefixo');if(error)throw error;
 const sit=k=>marca.vinculos.find(v=>v.chave===k&&v.serie_id)?marcaPill('Vinculado','p-ok'):marcaPill('Sem vínculo');
 $('#main').innerHTML=marcaTopo('Configurações','config',{lead:'Cada modelo aponta para uma série de Arquivos, que decide a versão em vigor e quem baixa.'})
  +`<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho"><thead><tr><th>Modelo</th><th>Série em Arquivos</th><th>Situação</th></tr></thead><tbody>${MARCA_ITENS.map(([k,n])=>`<tr><td class="nome">${esc(n)}</td>
   <td style="min-width:260px"><div class="fld"><label class="sr" for="marca-${k}">Série de ${esc(n)}</label><select id="marca-${k}"><option value="">Sem vínculo</option>${(data||[]).map(s=>`<option value="${s.id}" ${marca.vinculos.find(v=>v.chave===k)?.serie_id===s.id?'selected':''}>NRO-${esc(s.prefixo)}-${String(s.sn).padStart(3,'0')} ${esc(s.titulo)}</option>`).join('')}</select></div></td><td>${sit(k)}</td></tr>`).join('')}</tbody></table></div></div>
   <div class="ajustes-pe"><button class="btn solid" onclick="marcaSalvar()">Salvar vínculos</button></div>`;
}
async function marcaSalvar(){if(!docGestor())return;const {error}=await sb.from('marca_vinculos').upsert(MARCA_ITENS.map(([chave])=>({chave,serie_id:$('#marca-'+chave).value||null})));if(error)return falha(error,'Não foi possível salvar os vínculos');toast('Vínculos salvos.');marca.vinculos=MARCA_ITENS.map(([chave])=>({chave,serie_id:$('#marca-'+chave).value||null}));}

/* a página antiga do kit de interface: o conteúdo mudou para o manual público */
function marcaInterfaces(){
 $('#main').innerHTML=marcaTopo('Interfaces','')+`<section class="band"><div class="band-txt"><span class="eyebrow">Mudou de lugar</span><h2>O kit de interface está no manual da marca</h2>
  <p>Tokens, componentes, página-base e prompts para modelos de linguagem agora são públicos, para equipe, parceiros e fornecedores.</p>
  <a class="btn solid" href="${MARCA_BASE}" target="_blank" rel="noopener">Abrir o manual ↗</a></div></section>`;
}

/* F: a assinatura de e-mail */
function marcaAssinatura(){
 const m=state.membros.find(m=>m.registro===state.perfil.registro)||state.perfil;
 marca.assinatura={nome:m.nome||'',cargo:m.cargo||'',departamento:m.departamento||'',email:m.email_nro||m.email||'',telefone:m.telefone||'',pronomes:''};
 const campos=Object.entries({nome:'Nome',cargo:'Cargo',departamento:'Departamento',email:'E-mail',telefone:'Telefone',pronomes:'Pronomes'});
 const clientes={gmail:'Gmail: Configurações, Ver todas as configurações, Geral, Assinatura. Cole a assinatura copiada no editor.',outlook:'Outlook: Configurações, Contas, Assinaturas. Cole a assinatura copiada no editor.',outros:'Outros clientes: cole a assinatura copiada no editor de assinatura do cliente de e-mail.'};
 $('#main').innerHTML=marcaTopo('Assinatura de e-mail','assinatura')
  +`<div class="objeto larga"><div class="objeto-principal card"><p class="small muted" style="margin:0 0 var(--s4)">Os dados vêm da sua ficha. Mudar aqui não altera a ficha.</p>
   ${campos.map(([k,n])=>`<div class="fld" style="margin-bottom:var(--s3)"><label for="marca-sig-${k}">${n}</label><input id="marca-sig-${k}" value="${esc(marca.assinatura[k])}" oninput="marca.assinatura.${k}=this.value;marcaSigRender()"></div>`).join('')}
   ${navNivel2(Object.keys(clientes).map(k=>[k,{gmail:'Gmail',outlook:'Outlook',outros:'Outros'}[k],`javascript:marcaCliente('${k}')`]),marca.cliente,'Cliente de e-mail').replace(/<a /g,'<a role="button" ')}
   <p class="small muted" id="marca-sig-ajuda">${esc(clientes[marca.cliente])}</p></div>
   <aside class="objeto-lateral"><div class="card"><div class="seg" role="group" aria-label="Tipo de assinatura" style="margin-bottom:var(--s3)">${[['completa','Nova mensagem'],['resposta','Resposta']].map(([k,l])=>`<button type="button" class="${marca.tipo===k?'on':''}" aria-pressed="${marca.tipo===k}" onclick="marca.tipo='${k}';marcaSigRender()">${l}</button>`).join('')}</div>
   <iframe id="marca-sig-previa" title="Prévia da assinatura" sandbox="" style="width:100%;height:420px;border:0;border-radius:var(--r-sm);background:#fff"></iframe>
   <div class="acts" style="margin-top:var(--s3)"><button class="btn solid" onclick="marcaCopiarHTML(marcaSigAtual())">Copiar assinatura</button><button type="button" class="icbtn" aria-label="Copiar o código HTML" title="Copiar o código HTML" onclick="copiar(marcaSigAtual())">${ic('copy')}</button></div></div></aside></div>`;
 marcaSigRender();
}
const marcaSigAtual=()=>{const p={...marca.assinatura,cargo:[marca.assinatura.cargo,marca.assinatura.departamento].filter(Boolean).join(', ')};return marca.tipo==='resposta'?sigReply(p):sigEmail(p);};
function marcaSigRender(){const f=$('#marca-sig-previa');if(f)f.srcdoc=marcaSigAtual();document.querySelectorAll('[aria-label="Tipo de assinatura"] button').forEach(b=>{const on=b.textContent.trim()===(marca.tipo==='resposta'?'Resposta':'Nova mensagem');b.classList.toggle('on',on);b.setAttribute('aria-pressed',on);});}
function marcaCliente(k){marca.cliente=k;marcaAssinatura();}
async function marcaCopiarHTML(html){
 try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([html.replace(/<[^>]*>/g,' ')],{type:'text/plain'})})]);toast('Assinatura copiada.');}
 catch(e){const d=document.createElement('div');d.innerHTML=html;document.body.append(d);const range=document.createRange();range.selectNodeContents(d);const sel=getSelection();sel.removeAllRanges();sel.addRange(range);const ok=document.execCommand('copy');sel.removeAllRanges();d.remove();toast(ok?'Assinatura copiada.':'Não foi possível copiar a assinatura.',!ok);}
}

const SIG_ORG = {
  saudacao: 'Atenciosamente / regards / saludos,',
  unidade: ['Laboratório de Bioengenharia, LABBIO','Escola de Engenharia',
            'Universidade Federal de Minas Gerais'],
  endereco: ['Av. Pres. Antônio Carlos, 6627 | 31270-901','Belo Horizonte - MG | Brasil'],
  site: { label:'neurodynamics.dev', url:'https://neurodynamics.dev/' },
  disclaimer: 'This communication may contain information that is proprietary, confidential, or exempt from disclosure. If you are not the intended recipient, please notify the sender immediately and delete this message.'
};

const SIG_FONT = 'Helvetica,Arial,sans-serif';
const SG = {
  p0:  `margin:0cm;line-height:normal;font-size:11pt;font-family:${SIG_FONT};`,
  pTop:`margin:12pt 0cm 0cm;line-height:normal;font-size:11pt;font-family:${SIG_FONT};`,
  gray:`font-size:9pt;font-family:${SIG_FONT};color:#595959;`,
  dark:`font-size:9pt;font-family:${SIG_FONT};color:#1D1D1F;`,
  name:`font-family:${SIG_FONT};color:#1D1D1F;`,
  bTop:   'border-top:1pt solid #1D1D1F;border-right:none;border-bottom:none;border-left:none;',
  bBottom:'border-bottom:1pt solid #1D1D1F;border-top:none;border-right:none;border-left:none;',
  bNone:  'border:none;'
};
function sigDdi(t){ t=String(t||'').trim(); if(!t) return ''; return t[0]==='+'?t:'+55 '+t; }
function sigUnidade(){ return SIG_ORG.unidade.map(l=>`<p style="${SG.p0}"><span style="${SG.gray}">${esc(l)}</span></p>`).join(''); }
function sigEndereco(){ return SIG_ORG.endereco.map(l=>`<p style="${SG.p0}"><span style="${SG.gray}">${esc(l)}</span></p>`).join(''); }
function sigTel(p){ return p.telefone ? esc(sigDdi(p.telefone)) : '&nbsp;'; }
function sigContato(p){
  const siteLink = `<a href="${esc(SIG_ORG.site.url)}" style="color:#467886;"><span style="color:#595959;text-decoration:none;">${esc(SIG_ORG.site.label)}</span></a>`;
  if (p.email){
    const mail = `<a href="mailto:${esc(p.email)}" style="color:#467886;"><span style="color:#595959;text-decoration:none;">${esc(p.email)}</span></a>`;
    return mail + ' | ' + siteLink;
  }
  return siteLink;
}
function sigEmail(p){
  return `<div style="font-family:${SIG_FONT};font-size:11pt;color:#222222;"><span style="font-size:11pt;">${esc(SIG_ORG.saudacao)}</span></div>
<table border="0" cellspacing="0" cellpadding="0" width="614" style="color:#222222;font-family:${SIG_FONT};width:460.7pt;border-collapse:collapse;border:none;"><tbody>
<tr style="height:14.15pt;">
<td width="231" rowspan="5" valign="top" style="width:172.9pt;${SG.bTop}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.pTop}"><img src="${esc(LOGO_URL)}" width="219" height="36" alt="NeuroDynamics" style="display:block;border:0;"></p></td>
<td width="384" style="width:287.8pt;${SG.bTop}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.pTop}"><b><span style="${SG.name}">${esc(p.nome)}</span></b>${p.pronomes?` <span style="${SG.gray}">(${esc(p.pronomes)})</span>`:''}</p></td>
</tr>
<tr style="height:14.15pt;"><td width="384" style="width:287.8pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.dark}">${esc(p.cargo)}</span></p><p style="${SG.p0}"><span style="${SG.dark}">&nbsp;</span></p></td></tr>
<tr style="height:14.15pt;"><td width="384" style="width:287.8pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;">${sigUnidade()}<p style="${SG.p0}"><span style="${SG.gray}">&nbsp;</span></p></td></tr>
<tr style="height:14.15pt;"><td width="384" style="width:287.8pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;">${sigEndereco()}<p style="${SG.p0}"><span style="${SG.gray}">&nbsp;</span></p></td></tr>
<tr style="height:14.15pt;"><td width="384" style="width:287.8pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.gray}">${sigTel(p)}</span></p></td></tr>
<tr style="height:14.15pt;">
<td width="231" valign="top" style="width:172.9pt;${SG.bBottom}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="font-family:${SIG_FONT};">&nbsp;</span></p></td>
<td width="384" style="width:287.8pt;${SG.bBottom}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.gray}">${sigContato(p)}</span></p></td>
</tr>
<tr style="height:14.15pt;"><td colspan="2" width="614" valign="top" style="width:460.7pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><i><span style="font-size:8pt;font-family:${SIG_FONT};">${esc(SIG_ORG.disclaimer)}</span></i></p></td></tr>
</tbody></table>`;
}
function sigReply(p){
  return `<div style="font-family:${SIG_FONT};font-size:11pt;color:#222222;"><span style="font-size:11pt;">${esc(SIG_ORG.saudacao)}</span></div>
<table border="0" cellspacing="0" cellpadding="0" width="374" style="color:#222222;font-family:${SIG_FONT};width:280.65pt;border-collapse:collapse;border:none;"><tbody>
<tr style="height:34pt;"><td width="374" valign="top" style="width:280.65pt;${SG.bTop}padding:0cm 5.4pt;height:34pt;"><p style="${SG.pTop}"><img src="${esc(LOGO_URL)}" width="219" height="36" alt="NeuroDynamics" style="display:block;border:0;"></p></td></tr>
<tr style="height:14.15pt;"><td width="374" style="width:280.65pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.pTop}"><b><span style="${SG.name}">${esc(p.nome)}</span></b>${p.pronomes?` <span style="${SG.gray}">(${esc(p.pronomes)})</span>`:''}</p></td></tr>
<tr style="height:14.15pt;"><td width="374" style="width:280.65pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.dark}">${esc(p.cargo)}</span></p><p style="${SG.p0}"><span style="${SG.dark}">&nbsp;</span></p></td></tr>
<tr style="height:14.15pt;"><td width="374" style="width:280.65pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;">${sigUnidade()}<p style="${SG.p0}"><span style="${SG.gray}">&nbsp;</span></p></td></tr>
<tr style="height:14.15pt;"><td width="374" style="width:280.65pt;${SG.bNone}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.gray}">${sigTel(p)}</span></p></td></tr>
<tr style="height:14.15pt;"><td width="374" style="width:280.65pt;${SG.bBottom}padding:0cm 5.4pt;height:14.15pt;"><p style="${SG.p0}"><span style="${SG.gray}">${sigContato(p)}</span></p></td></tr>
</tbody></table>
<p style="margin:0cm 0cm 8pt;color:#222222;line-height:15.6933px;font-size:11pt;font-family:${SIG_FONT};"><i><span style="font-size:8pt;line-height:11.4133px;font-family:${SIG_FONT};">${esc(SIG_ORG.disclaimer)}</span></i></p>`;
}

