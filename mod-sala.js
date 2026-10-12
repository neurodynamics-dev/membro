/* ============================================================
   MÓDULO · A SALA NO CELULAR (2.19.2), #/sala/<id>
   O QR do tablet na porta abre esta tela, com o login do membro:
   - a sala escolhida, grande, na cor da situação (como o tablet), com
     quem reservou, até quando e as reservas de hoje;
   - usar agora (30 min, 1 h ou o resto do dia), reservar um horário (a
     agenda já com a sala) e liberar a sala ocupada (arrastar até o fim);
   - as outras salas do LABBIO, menores, para achar outra livre.
   Reservas do LABBIO ocupam a sala, mas não estão na agenda do SOMA.
   Depende de deslizar.js (carregado aqui) e da casca (sb, $, esc, toast).
   ============================================================ */
const salaM = { id:null, dados:null, timer:null, barra:null, ocupado:false };
const SALA_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const salaHora = v => new Date(v).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });
const salaDiaLocal = d => { const x = new Date(d); return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`; };
function salaQuando(v){
  const d = new Date(v), hoje = new Date(), amanha = new Date(); amanha.setDate(hoje.getDate() + 1);
  if (salaDiaLocal(d) === salaDiaLocal(hoje)) return 'hoje, ' + salaHora(d);
  if (salaDiaLocal(d) === salaDiaLocal(amanha)) return 'amanhã, ' + salaHora(d);
  return `${SALA_SEMANA[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}, ${salaHora(d)}`;
}
const SALA_ROT = { livre:'Livre', evento:'Em uso', ocupada:'Ocupada' };
function salaAte(s){
  if (s.estado === 'livre') return s.proximo ? 'até ' + salaQuando(s.proximo.inicio) : 'sem reservas nos próximos 7 dias';
  if (s.estado === 'evento') return 'até ' + salaQuando(s.evento.fim);
  return 'até ' + salaQuando(s.ocupada_ate);
}
const salaQuem = e => e.origem === 'labbio' ? 'Reserva do LABBIO' + (e.organizador && e.organizador !== 'LABBIO' ? ', para ' + e.organizador : '') : (e.organizador ? 'Reservado por ' + e.organizador : '');

async function pageSala(sub){
  clearInterval(salaM.timer);
  const id = Number(sub);
  if (!Number.isInteger(id) || id <= 0){ $('#main').innerHTML = cabecalho({ espaco:'LABBIO', titulo:'Sala' }) + estado.vazio({ texto:'Abra pelo QR do tablet na porta da sala.' }); return; }
  salaM.id = id; salaM.barra = null;
  if (!document.querySelector('link[href^="deslizar.css"]')) document.head.insertAdjacentHTML('beforeend', `<link rel="stylesheet" href="deslizar.css?v=${VERSAO}">`);
  if (!window.deslizar) await carregarScript(`deslizar.js?v=${VERSAO}`).catch(() => {});
  $('#main').innerHTML = `<div class="salam" id="salam">${estado.carregando()}</div>`;
  await salaCarregar();
  // enquanto a tela estiver aberta, a situação se atualiza a cada minuto
  salaM.timer = setInterval(() => { if (!document.getElementById('salam')) return salaSair(); if (!document.hidden) salaCarregar(true); }, 60000);
}

/* tempo real: um canal de broadcast por sala (sala-<id>), o mesmo do tablet da porta. Ouve a sala aberta e as
   outras da lista; quem muda uma sala avisa o canal dela e todos consultam de novo, sem esperar o minuto. */
salaM.canais = new Map();
function salaOuvir(ids){
  if (!sb.channel) return;
  const quero = new Set(ids.filter(Boolean).map(Number));
  for (const [id, c] of salaM.canais) if (!quero.has(id)){ sb.removeChannel(c); salaM.canais.delete(id); }
  for (const id of quero) if (!salaM.canais.has(id)){
    salaM.canais.set(id, sb.channel('sala-' + id).on('broadcast', { event:'mudou' }, () => {
      if (!document.getElementById('salam')) return salaSair();
      clearTimeout(salaM.rajada); salaM.rajada = setTimeout(() => salaCarregar(true), 300);
    }).subscribe());
  }
}
function salaAvisar(){ try { salaM.canais.get(salaM.id)?.send({ type:'broadcast', event:'mudou', payload:{} }); } catch(_){} }
/* fora da tela da sala, os canais e o relógio param */
function salaSair(){ clearInterval(salaM.timer); clearTimeout(salaM.virada); for (const c of salaM.canais.values()) sb.removeChannel(c); salaM.canais.clear(); }
window.addEventListener('hashchange', () => { if (!/^#\/sala\//.test(location.hash)) salaSair(); });
/* a virada: quando a reserva acaba, a próxima começa ou a ocupação vence, a tela muda na hora certa */
function salaAgendarVirada(){
  clearTimeout(salaM.virada);
  const s = salaM.dados?.sala; if (!s) return;
  const marcos = [s.evento?.fim, s.proximo?.inicio, s.ocupada_ate].filter(Boolean).map(v => new Date(v).getTime()).filter(t => t > Date.now());
  if (marcos.length && Math.min(...marcos) - Date.now() < 6 * 36e5) salaM.virada = setTimeout(() => salaCarregar(true), Math.min(...marcos) - Date.now() + 1500);
}

async function salaCarregar(silencioso){
  const { data, error } = await sb.rpc('sala_painel', { p_espaco: salaM.id });
  const el = document.getElementById('salam'); if (!el) return;
  if (error || data?.status !== 'ok'){
    if (silencioso) return;
    el.innerHTML = cabecalho({ espaco:'LABBIO', titulo:'Sala' }) + (data?.status === 'nao_encontrado'
      ? estado.vazio({ texto:'Esta sala não está no LABBIO. Confira o QR do tablet.' })
      : estado.erro({ texto:'Não foi possível consultar a sala agora.', acao:'<button class="btn ghost mini" type="button" onclick="salaCarregar()">Tentar de novo</button>' }));
    return;
  }
  salaM.dados = data; salaDesenhar(); salaAgendarVirada();
  salaOuvir([salaM.id, ...(data.outras || []).map(o => o.id)]);
}

function salaDesenhar(msg = ''){
  const el = document.getElementById('salam'), d = salaM.dados; if (!el || !d) return;
  const s = d.sala, ev = s.estado === 'evento' ? s.evento : null;
  const hoje = (s.hoje || []).filter(e => !ev || e.id !== ev.id);
  const agora = new Date(), ini = new Date(Math.ceil(agora.getTime() / (15 * 6e4)) * 15 * 6e4), fim = new Date(ini.getTime() + 36e5);
  const pad = n => String(n).padStart(2, '0'), dia = x => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`, hm = x => `${pad(x.getHours())}:${pad(x.getMinutes())}`;
  const reservar = `#/agenda/novo/${dia(ini)}T${hm(ini)}~${fim.getDate() === ini.getDate() ? hm(fim) : '23:59'}@${s.id}`;

  el.innerHTML = `<a class="cab-voltar" href="#/" data-voltar><span class="s" aria-hidden="true">←</span>Início</a>
    <section class="salam-cartao" data-estado="${esc(s.estado)}" aria-live="polite">
      <div class="salam-topo"><span class="salam-nome">${esc(s.nome)}</span><span class="salam-rot">Agora</span></div>
      <h1 class="salam-status">${esc(SALA_ROT[s.estado] || '')}</h1>
      <p class="salam-ate">${esc(salaAte(s))}</p>
      ${ev ? `<div class="salam-ev"><b>${esc(ev.titulo)}</b><span>${esc(salaQuem(ev))}, ${esc(ev.hora_inicio || '')}${ev.hora_fim ? '–' + esc(ev.hora_fim) : ''}</span></div>` : ''}
      ${s.estado === 'ocupada' ? `<p class="salam-quem">${s.ocupada_por ? `Ocupada por ${esc(s.ocupada_por)}, sem reserva` : 'Ocupada na porta, sem reserva'}</p>
        <div id="salam-deslizar" class="salam-deslizar"></div>` : ''}
      ${msg ? `<p class="salam-msg" role="status">${esc(msg)}</p>` : ''}
    </section>

    ${s.estado === 'livre' ? `<section class="salam-bloco" aria-labelledby="salam-usar-t"><h2 id="salam-usar-t">Usar agora</h2>
      <div class="salam-usar">${[[30, '30 min'], [60, '1 hora'], [1440, 'Resto do dia']].map(([m, r]) =>
        `<button class="btn ghost" type="button" onclick="salaOcupar(${m})" ${salaM.ocupado ? 'disabled' : ''}>${r}</button>`).join('')}</div>
      <p class="salam-nota">Termina antes da próxima reserva. Não entra na agenda.</p></section>` : ''}

    <section class="salam-bloco"><a class="btn solid salam-reservar" href="${reservar}">Reservar um horário</a>
      <p class="salam-nota">Abre a agenda com ${esc(s.nome)} escolhida. A reserva aparece no tablet da porta.</p></section>

    <section class="salam-bloco" aria-labelledby="salam-hoje-t"><h2 id="salam-hoje-t">Hoje nesta sala</h2>
      ${hoje.length ? `<ol class="salam-hoje">${hoje.map(e => `<li><span class="mono">${esc(e.hora_inicio || 'Dia todo')}${e.hora_fim ? '–' + esc(e.hora_fim) : ''}</span>
        <span class="salam-tx"><b>${esc(e.titulo)}</b><small>${esc(salaQuem(e))}</small></span></li>`).join('')}</ol>`
        : `<p class="salam-nota">Nenhuma ${ev ? 'outra ' : ''}reserva hoje.</p>`}</section>

    ${(d.outras || []).length ? `<section class="salam-bloco" aria-labelledby="salam-outras-t"><h2 id="salam-outras-t">Outras salas</h2>
      <ul class="salam-outras">${d.outras.map(o => `<li><a href="#/sala/${esc(o.id)}" data-estado="${esc(o.estado)}">
        <span class="salam-ponto" aria-hidden="true"></span><span class="salam-tx"><b>${esc(o.nome)}</b>
        <small>${esc(SALA_ROT[o.estado] || '')}, ${esc(salaAte(o))}</small></span><span class="salam-seta" aria-hidden="true">→</span></a></li>`).join('')}</ul></section>` : ''}`;

  if (s.estado === 'ocupada' && window.deslizar){
    salaM.barra = window.deslizar(document.getElementById('salam-deslizar'), { rotulo:'Arraste para liberar a sala', aoConfirmar: salaLiberar });
  }
}

const SALA_MOTIVO = { em_evento:'A sala já está em uso por uma reserva.', sem_tempo:'A próxima reserva está prestes a começar.',
  invalido:'Não foi possível ocupar por esse período.', sem_permissao:'Sua conta não pode usar a sala agora.', nao_encontrado:'Esta sala não está no LABBIO.' };
async function salaAcao(nome, args, ok){
  if (salaM.ocupado) return; salaM.ocupado = true;
  try {
    const { data, error } = await sb.rpc(nome, args);
    if (error || !data) throw error || new Error('sem resposta');
    if (['ok', 'em_evento', 'sem_tempo', 'invalido'].includes(data.status) && data.estado){
      salaM.dados.sala = { ...salaM.dados.sala, ...data, id:salaM.dados.sala.id, nome:salaM.dados.sala.nome };
    }
    salaM.ocupado = false;
    if (data.status === 'ok') salaAvisar();   // o tablet da porta muda na hora
    salaDesenhar(data.status === 'ok' ? ok : (SALA_MOTIVO[data.status] || 'Não foi possível agora.')); salaAgendarVirada();
  } catch(e){ salaM.ocupado = false; toast('Não foi possível falar com o servidor. Tente de novo.', true); salaDesenhar(); }
}
const salaOcupar = min => salaAcao('sala_ocupar_membro', { p_espaco:salaM.id, p_minutos:min }, 'Pronto: a sala está com você.');
const salaLiberar = () => salaAcao('sala_liberar_membro', { p_espaco:salaM.id }, 'Sala liberada.');
