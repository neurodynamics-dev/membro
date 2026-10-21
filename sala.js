/* O tablet na porta da sala (2.19.2). O relógio é local; disponibilidade, limites e ocupação vêm do servidor.
   A tela inteira ganha a cor da situação (livre, em uso, ocupada), com a barra de luz embaixo.
   Toque duas vezes em qualquer lugar vazio para entrar e sair da tela inteira.
   As ações de exceção (ocupar por 30 min, 1 h ou o resto do dia, o QR do celular) ficam no botão do canto;
   liberar a sala ocupada é arrastar até o fim. */
(() => {
 const CONFIG = { SUPABASE_URL:'https://rxzmkyjttzzpwtodqkve.supabase.co', SUPABASE_ANON_KEY:'sb_publishable_MJFR-aaQqTS1BthxYJG2kg_5XGhs9wg', APP_URL:'https://membro.neurodynamics.dev/' };
 const token = new URLSearchParams(location.search).get('d') || '';
 const sb = window.supabase?.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { auth:{ persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } });
 const $ = id => document.getElementById(id);
 const st = { dados:null, ultima:null, inicio:new Date(), ocupado:false, online:false, invalido:false };
 const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
 const hora = v => new Date(v).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
 const texto = (id, v) => { const el = $(id); el.textContent = v || ''; el.hidden = !v; };
 const diaLocal = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
 const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
 /* "14:00", "amanhã, 09:00" ou "qui, 15/10, 09:00": o horário sempre com o dia, quando não é hoje */
 function quando(v){
  const d = new Date(v), hoje = new Date(), amanha = new Date(); amanha.setDate(hoje.getDate() + 1);
  if (diaLocal(d) === diaLocal(hoje)) return 'hoje, ' + hora(d);
  if (diaLocal(d) === diaLocal(amanha)) return 'amanhã, ' + hora(d);
  return `${SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${hora(d)}`;
 }
 const fimDoDia = () => { const d = new Date(); d.setHours(24, 0, 0, 0); return d; };
 /* até quando vai uma ocupação de n minutos começando agora (o servidor confirma) */
 function limite(min){
  let ate = Math.min(Date.now() + min * 6e4, fimDoDia().getTime());
  const prox = st.dados?.proximo?.inicio ? new Date(st.dados.proximo.inicio).getTime() : Infinity;
  const corta = prox < ate; if (corta) ate = prox;
  return { ate:new Date(ate), corta };
 }

 /* ---------------- a tela ---------------- */
 let barra = null;
 function desenhar(mensagem = ''){
  const d = st.dados, on = st.online && d;
  const estado = st.invalido ? 'invalido' : on ? d.estado : (d ? 'offline' : 'carregando');
  document.body.dataset.estado = estado;
  $('sala-rot').textContent = on ? 'Agora' : 'Sala';
  $('sala-status').textContent = st.invalido ? 'Tablet não cadastrado'
    : on ? ({ livre:'Livre', evento:'Em uso', ocupada:'Ocupada' }[d.estado]) : d ? 'Sem conexão' : 'Consultando';

  // até quando: sempre com o dia, quando não é hoje
  let ate = '';
  if (st.invalido) ate = 'Este tablet não está cadastrado ou foi revogado. Peça um endereço novo ao LABBIO.';
  else if (on && d.estado === 'livre') ate = d.proximo ? 'até ' + quando(d.proximo.inicio) : 'Sem reservas nos próximos 7 dias';
  else if (on && d.estado === 'evento') ate = 'até ' + quando(d.evento.fim);
  else if (on && d.estado === 'ocupada') ate = 'até ' + quando(d.ocupada_ate);
  texto('sala-ate', ate);

  // a reserva em andamento: título, quem reservou e o quanto já passou
  const ev = on && d.estado === 'evento' ? d.evento : null;
  $('sala-evento').hidden = !ev;
  if (ev){
   texto('sala-evento-titulo', ev.titulo);
   texto('sala-evento-quem', (ev.origem === 'labbio' ? 'Reserva do LABBIO' + (ev.organizador && ev.organizador !== 'LABBIO' ? ', para ' + ev.organizador : '') : ev.organizador ? 'Reservado por ' + ev.organizador : ''));
   const i = new Date(ev.inicio).getTime(), f = new Date(ev.fim).getTime(), pct = Math.max(0, Math.min(100, Math.round((Date.now() - i) / Math.max(1, f - i) * 100)));
   $('sala-andamento').setAttribute('aria-valuenow', String(pct)); $('sala-andamento').firstElementChild.style.width = pct + '%';
  }
  texto('sala-ocupada-quem', on && d.estado === 'ocupada' ? (d.ocupada_por ? `Ocupada por ${d.ocupada_por}, pelo celular` : 'Ocupada aqui na porta, sem reserva') : '');
  texto('sala-offline', !st.online && d && !st.invalido ? 'Sem atualização desde ' + hora(st.ultima || st.inicio) + '. Tentando de novo.' : '');
  texto('sala-mensagem', mensagem);

  // liberar: só a ocupação avulsa (a reserva da agenda se muda na agenda)
  const podeLiberar = on && d.estado === 'ocupada';
  $('sala-deslizar').hidden = !podeLiberar;
  if (podeLiberar && !barra && window.deslizar) barra = window.deslizar($('sala-deslizar'), { rotulo:'Arraste para liberar a sala', aoConfirmar:() => consultar('sala_liberar') });

  // a sala e o dia
  if (d){
   $('sala-nome').textContent = d.sala || 'Sala'; $('sala-nome').hidden = false;
   texto('sala-rotulo', d.rotulo && d.rotulo !== d.sala ? d.rotulo : '');
   const hoje = (d.hoje || []).filter(e => !d.evento || e.id !== d.evento.id);
   $('sala-hoje').hidden = false;
   $('sala-hoje-lista').innerHTML = hoje.length ? hoje.map(e => `<li><span class="sala-h-hora">${esc(e.hora_inicio || 'Dia todo')}${e.hora_fim ? '–' + esc(e.hora_fim) : ''}</span>
     <span class="sala-h-tx"><b>${esc(e.titulo)}</b>${e.organizador || e.origem === 'labbio' ? `<small>${esc([e.origem === 'labbio' ? 'Reserva do LABBIO' : '', e.organizador].filter(Boolean).join(', '))}</small>` : ''}</span></li>`).join('')
     : `<li class="sala-h-vazio">${d.evento ? 'Nenhuma outra reserva hoje.' : 'Nenhuma reserva hoje.'}</li>`;
  } else { $('sala-hoje').hidden = true; }
  if (st.invalido){ $('sala-nome').hidden = true; texto('sala-rotulo', ''); $('sala-hoje').hidden = true; $('sala-evento').hidden = true; }

  $('sala-menu-bt').hidden = st.invalido || !d;
  $('sala-celular-bt').hidden = st.invalido || !d || !d.espaco_id;
  if ($('sala-menu-bt').hidden) fecharOpcoes();
  opcoes();
 }

 /* as opções: ocupar (só com a sala livre), o QR do celular, tela inteira e atualizar */
 function opcoes(){
  const d = st.dados, livre = st.online && d?.estado === 'livre';
  $('sala-usar').hidden = !livre;
  if (livre){
   const rot = min => { const l = limite(min); return (l.corta ? 'até ' + hora(l.ate) + ', antes da reserva' : 'até ' + (min === 1440 ? 'o fim do dia' : hora(l.ate))); };
   $('sala-ate-30').textContent = rot(30); $('sala-ate-60').textContent = rot(60); $('sala-ate-dia').textContent = rot(1440);
  }
  for (const b of document.querySelectorAll('.sala-opcao')) b.disabled = st.ocupado;
  if (d?.espaco_id){
   const url = CONFIG.APP_URL + '#/sala/' + encodeURIComponent(d.espaco_id);
   if ($('sala-qr').dataset.url !== url && window.qrcode){
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    $('sala-qr').innerHTML = qr.createSvgTag({ cellSize:3, margin:3, scalable:true }); $('sala-qr').dataset.url = url;
   }
  } else { $('sala-qr').replaceChildren(); delete $('sala-qr').dataset.url; }
 }
 function invalido(){ st.invalido = true; st.online = false; st.dados = null; barra = null; $('sala-deslizar').replaceChildren(); desenhar(); }

 let fechaOpcoes;
 function abrirOpcoes(){
  if (st.invalido || !st.dados) return;
  opcoes();
  $('sala-opcoes').hidden = false; $('sala-veu').hidden = false;
  requestAnimationFrame(() => { $('sala-opcoes').classList.add('open'); $('sala-veu').classList.add('open'); });
  $('sala-menu-bt').setAttribute('aria-expanded', 'true');
  $('sala-opcoes-fechar').focus(); clearTimeout(fechaOpcoes); fechaOpcoes = setTimeout(fecharOpcoes, 60000);
 }
 function fecharOpcoes(){
  clearTimeout(fechaOpcoes); if ($('sala-opcoes').hidden) return;
  $('sala-opcoes').classList.remove('open'); $('sala-veu').classList.remove('open');
  $('sala-opcoes').hidden = true; $('sala-veu').hidden = true; $('sala-menu-bt').setAttribute('aria-expanded', 'false');
 }

 /* ---------------- o servidor ---------------- */
 async function consultar(nome = 'sala_estado', args = {}){
  if (st.invalido) return;
  if (st.ocupado){ if (nome === 'sala_estado') st.denovo = true; return; }   // chegou um aviso no meio: consulta de novo ao terminar
  if (!token) return invalido();
  st.ocupado = true; opcoes(); let timer;
  try {
   const resposta = sb?.rpc(nome, { p_token:token, ...args });
   if (!resposta) throw new Error('indisponivel');
   const { data, error } = await Promise.race([resposta, new Promise((_, rejeitar) => { timer = setTimeout(() => rejeitar(new Error('sem_resposta')), 12000); })]);
   if (error || !data) throw new Error('indisponivel');
   if (data.status === 'dispositivo_invalido') return invalido();
   if (!['ok', 'em_evento', 'sem_tempo', 'invalido'].includes(data.status) || !['livre', 'evento', 'ocupada'].includes(data.estado)) throw new Error('indisponivel');
   // ocupar e liberar devolvem a situação; sala e rótulo vêm da consulta inicial
   st.dados = { ...st.dados, ...data }; st.online = true; st.ultima = new Date();
   ouvir(data.espaco_id); agendarVirada();
   if (nome !== 'sala_estado' && data.status === 'ok') avisar();   // o celular e o painel abertos nesta sala atualizam na hora
   if (data.estado !== 'ocupada'){ barra = null; $('sala-deslizar').replaceChildren(); }
   desenhar(({ em_evento:'A sala já está em uso por uma reserva.', sem_tempo:'A próxima reserva está prestes a começar.', invalido:'Não foi possível ocupar por esse período.' })[data.status]
     || (nome === 'sala_liberar' ? 'Sala liberada.' : ''));
  } catch(_){ st.online = false; desenhar(); }
  finally { clearTimeout(timer); st.ocupado = false; opcoes(); if (st.denovo){ st.denovo = false; consultar(); } }
 }

 /* ---------------- tempo real ----------------
    Cada sala tem um canal de broadcast do Supabase (sala-<id>): sem ler tabela nenhuma, ele só diz "mudou".
    Quem muda a sala (este tablet, o celular, o banco quando muda um evento, uma reserva do LABBIO ou uma
    ocupação) avisa; quem está ouvindo consulta de novo. O minuto a minuto continua como rede de segurança. */
 let canal = null, canalId = null, rajada = null;
 function ouvir(id){
  if (!id || !sb?.channel || canalId === id) return;
  if (canal) sb.removeChannel(canal);
  canalId = id;
  canal = sb.channel('sala-' + id).on('broadcast', { event:'mudou' }, () => {
   clearTimeout(rajada); rajada = setTimeout(() => consultar(), 300);   // avisos em rajada viram uma consulta só
  }).subscribe(s => { if (s === 'SUBSCRIBED') consultar(); });   // ao (re)conectar, confere o que pode ter perdido
 }
 function avisar(){ try { canal?.send({ type:'broadcast', event:'mudou', payload:{} }); } catch(_){} }
 /* a virada: quando a reserva acaba, a próxima começa ou a ocupação vence, a tela muda na hora certa */
 let virada = null;
 function agendarVirada(){
  clearTimeout(virada);
  const d = st.dados; if (!d) return;
  const marcos = [d.evento?.fim, d.proximo?.inicio, d.ocupada_ate].filter(Boolean).map(v => new Date(v).getTime()).filter(t => t > Date.now());
  if (!marcos.length) return;
  const espera = Math.min(...marcos) - Date.now() + 1500;
  if (espera < 6 * 36e5) virada = setTimeout(() => consultar(), espera);
 }

 /* ---------------- gestos e botões ---------------- */
 function telaCheia(){
  const doc = document, el = doc.documentElement;
  if (doc.fullscreenElement || doc.webkitFullscreenElement) (doc.exitFullscreen || doc.webkitExitFullscreen)?.call(doc);
  else (el.requestFullscreen || el.webkitRequestFullscreen)?.call(el)?.catch?.(() => {});
 }
 // dois toques num lugar vazio (fora de botões e do controle de liberar)
 let ultimoToque = { t:0, x:0, y:0 };
 document.addEventListener('pointerup', e => {
  if (e.target.closest('button, a, [role="dialog"], .deslizar')) return;
  const t = Date.now(), perto = Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 40;
  if (t - ultimoToque.t < 350 && perto){ ultimoToque.t = 0; telaCheia(); }
  else ultimoToque = { t, x:e.clientX, y:e.clientY };
 });
 document.addEventListener('dblclick', e => e.preventDefault());

 $('sala-menu-bt').onclick = abrirOpcoes; $('sala-celular-bt').onclick = abrirOpcoes;
 $('sala-opcoes-fechar').onclick = fecharOpcoes; $('sala-veu').onclick = fecharOpcoes;
 $('sala-atualizar').onclick = () => { fecharOpcoes(); consultar(); };
 $('sala-tela-cheia').onclick = () => { fecharOpcoes(); telaCheia(); };
 document.addEventListener('keydown', e => { if (e.key === 'Escape') fecharOpcoes(); });
 for (const b of document.querySelectorAll('.sala-opcao')) b.onclick = () => {
  if (!(st.online && st.dados?.estado === 'livre')) return;
  fecharOpcoes(); consultar('sala_ocupar', { p_minutos:Number(b.dataset.min) });
 };

 const relogio = () => { $('sala-relogio').textContent = hora(new Date()); };
 relogio(); setInterval(relogio, 1000);
 setInterval(() => consultar(), 60000);
 setInterval(() => { if (st.dados?.estado === 'evento' && st.online) desenhar(); }, 30000);   // o andamento da reserva
 document.addEventListener('visibilitychange', () => { if (!document.hidden) consultar(); });
 consultar();
})();
