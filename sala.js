/* L10: o relógio é local; disponibilidade, limite e ocupação vêm do servidor. */
(() => {
 const CONFIG={SUPABASE_URL:'https://rxzmkyjttzzpwtodqkve.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg',APP_URL:'https://membro.neurodynamics.dev/'};
 const token=new URLSearchParams(location.search).get('d')||'';
 const sb=window.supabase?.createClient(CONFIG.SUPABASE_URL,CONFIG.SUPABASE_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
 const $=id=>document.getElementById(id);
 const st={dados:null,ultima:null,inicio:new Date(),ocupado:false,online:false,invalido:false};
 const hora=v=>new Date(v).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
 const texto=(id,v)=>{const el=$(id);el.textContent=v||'';el.hidden=!v;};
 const icones={livre:'<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
  uso:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  erro:'<path d="m3 3 18 18M8.5 8.5a9 9 0 0 1 11 2M4.5 10.5l1-.8M8 14a6 6 0 0 1 5-1M12 18h.01"/>'};
 function botoes(){
  const estado=st.dados?.estado;
  $('sala-acoes').hidden=!st.online||st.invalido||!['livre','ocupada'].includes(estado);
  $('sala-opcoes-bt').hidden=st.invalido||!st.dados;if($('sala-opcoes-bt').hidden)fecharOpcoes();
  $('sala-15').hidden=$('sala-30').hidden=estado!=='livre';$('sala-liberar').hidden=estado!=='ocupada';
  for(const bt of $('sala-acoes').querySelectorAll('button'))bt.disabled=st.ocupado;
 }
 function desenhar(mensagem=''){
  const d=st.dados;
  $('sala-estado').dataset.estado=st.online?d.estado:'offline';
  $('sala-status').textContent=st.online?({livre:'Livre',evento:'Em uso',ocupada:'Ocupada agora'}[d.estado]):'Sem informação atual';
  $('sala-icone').innerHTML=icones[st.online?(d.estado==='livre'?'livre':'uso'):'erro'];
  texto('sala-evento',d?.evento?.titulo);
  texto('sala-ate',!st.online?'':d.estado==='evento'?'até '+d.evento.hora_fim:d.estado==='ocupada'?'até '+hora(d.ocupada_ate):d.proximo?'até '+d.proximo.hora_inicio:'pelo resto do dia');
  texto('sala-offline',st.online?'':'Sem atualização desde '+hora(st.ultima||st.inicio));
  texto('sala-mensagem',mensagem);
  if(d){
   $('sala-nome').textContent=d.sala||'Sala';
   $('sala-proxima').hidden=false;
   $('sala-proximo-titulo').textContent=d.proximo?.titulo||'Nenhuma reserva prevista';
   texto('sala-proximo-horario',d.proximo?d.proximo.hora_inicio+' às '+d.proximo.hora_fim:'');
   const evento=d.evento||d.proximo;
   $('sala-detalhes').hidden=!evento;
   if(evento){
    const url=CONFIG.APP_URL+'#/agenda/evento/'+encodeURIComponent(evento.id);
    if($('sala-qr').dataset.url!==url){
     const qr=qrcode(0,'M');qr.addData(url);qr.make();
     $('sala-qr').innerHTML=qr.createSvgTag({cellSize:3,margin:4,scalable:true});$('sala-qr').dataset.url=url;
    }
   }else{$('sala-qr').replaceChildren();delete $('sala-qr').dataset.url;}
  }
  botoes();
 }
 function invalido(){
  st.invalido=true;st.online=false;st.dados=null;
  $('sala-estado').dataset.estado='invalido';$('sala-status').textContent='Este tablet não está cadastrado ou foi revogado. Peça um endereço novo ao LABBIO.';
  $('sala-nome').hidden=true;$('sala-icone').hidden=true;$('sala-proxima').hidden=true;
  for(const id of ['sala-evento','sala-ate','sala-mensagem','sala-offline'])texto(id,'');
  $('sala-qr').replaceChildren();delete $('sala-qr').dataset.url;botoes();
 }
 /* as opções (o QR da reserva e atualizar) ficam atrás de um botão; fecham sozinhas em 60 s */
 let fechaOpcoes;
 function abrirOpcoes(){
  if(st.invalido||!st.dados)return;
  $('sala-opcoes').hidden=false;$('sala-veu').hidden=false;
  requestAnimationFrame(()=>{$('sala-opcoes').classList.add('open');$('sala-veu').classList.add('open');});$('sala-opcoes-bt').setAttribute('aria-expanded','true');
  $('sala-opcoes-fechar').focus();clearTimeout(fechaOpcoes);fechaOpcoes=setTimeout(fecharOpcoes,60000);
 }
 function fecharOpcoes(){
  clearTimeout(fechaOpcoes);if($('sala-opcoes').hidden)return;
  $('sala-opcoes').classList.remove('open');$('sala-veu').classList.remove('open');
  $('sala-opcoes').hidden=true;$('sala-veu').hidden=true;$('sala-opcoes-bt').setAttribute('aria-expanded','false');
 }
 async function consultar(nome='sala_estado',args={}){
  if(st.ocupado||st.invalido)return;
  if(!token)return invalido();
  st.ocupado=true;botoes();let timer;
  try{
   const resposta=sb?.rpc(nome,{p_token:token,...args});
   if(!resposta)throw new Error('indisponivel');
   const {data,error}=await Promise.race([resposta,new Promise((_,rejeitar)=>{timer=setTimeout(()=>rejeitar(new Error('sem_resposta')),12000);})]);
   if(error||!data)throw new Error('indisponivel');
   if(data.status==='dispositivo_invalido')return invalido();
   if(!['ok','em_evento','sem_tempo','invalido'].includes(data.status)||!['livre','evento','ocupada'].includes(data.estado))throw new Error('indisponivel');
   // Ocupar e liberar devolvem a situação; sala e rótulo vêm da consulta inicial.
   st.dados={...st.dados,...data};st.online=true;st.ultima=new Date();
   desenhar(({em_evento:'A sala já está em uso por um evento.',sem_tempo:'A próxima reserva está prestes a começar.',invalido:'Não foi possível ocupar por esse período.'})[data.status]||'');
  }catch(_){st.online=false;desenhar();}
  finally{clearTimeout(timer);st.ocupado=false;botoes();}
 }
 $('sala-opcoes-bt').onclick=abrirOpcoes;$('sala-opcoes-fechar').onclick=fecharOpcoes;$('sala-veu').onclick=fecharOpcoes;
 $('sala-atualizar').onclick=()=>{fecharOpcoes();consultar();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')fecharOpcoes();});
 const ocupar=minutos=>{if(st.online&&st.dados.estado==='livre')consultar('sala_ocupar',{p_minutos:minutos});};
 $('sala-15').onclick=()=>ocupar(15);$('sala-30').onclick=()=>ocupar(30);
 $('sala-liberar').onclick=()=>{if(st.online&&st.dados.estado==='ocupada')consultar('sala_liberar');};
 const relogio=()=>{$('sala-relogio').textContent=hora(new Date());};
 relogio();setInterval(relogio,1000);setInterval(()=>consultar(),60000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)consultar();});
 consultar();
})();
