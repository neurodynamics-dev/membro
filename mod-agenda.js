/* ============================================================
   MÓDULO · AGENDA
   A agenda da equipe no modelo do Google Agenda (revisão 28): dia,
   semana e mês numa tela só, a página de cada evento e as
   configurações. Ficou de fora, de propósito, o que o Google Agenda
   não faz: checklist de preparação, dossiê, presença por evento.

   Rotas:
     #/agenda                          a semana (o dia, no celular)
     #/agenda/dia|semana/AAAA-MM-DD
     #/agenda/mes/AAAA-MM
     #/agenda/evento/<id>              um evento: ver, responder, editar
     #/agenda/novo[/AAAA-MM-DD[THH:MM[~HH:MM]]]
     #/agenda/config[/predefinidos|google]

   Camadas, como as agendas da coluna do Google: os eventos, o
   calendário da equipe (marcos, UFMG, feriados, prazos), as ausências
   e três que têm data sem serem da agenda: as suas tarefas com prazo
   (Atividades), as suas publicações (Studio) e os seus treinamentos
   que vencem.

   Escreve pelas funções da 28.0: agenda_evento_salvar,
   agenda_evento_excluir e agenda_responder. Marcos e ausências pelas
   da 15.0 (agenda_marco_salvar, agenda_ausencia_salvar).

   Depende da casca para: sb, $, esc, norm, state, toast, abreModal,
   fechaModal, ic, ibtn, confirma, falha, motivoRPC, avatarFoto, nomeDe,
   primeiroNome, hojeISO, isoDia, isoDow, dataHora, hhmmMin, minHHMM,
   fmtD, gruposEfetivos, membrosDoGrupo, gruposDaEquipe, grupoPorNome,
   podeStudio, can, navNivel1, dica, registrarBusca, filtrarSimples,
   carregarItens, carregarAgendaPessoal, CAMADAS_AGENDA, AUSENCIAS_AGENDA,
   corDoItem, horaDoItem, calMesHTML, calMesLigar,
   inicioDaSemana, maiuscula, DIAS_SEMANA, MESES_LONGOS, EXPEDIENTE, DIAS_LB,
   CONFIG, carregarTreinamentosMeus, copiar.
   ============================================================ */

const agenda = {
  visao:null, ref:null, itens:[], erro:null, janela:null,
  camadas:null, predef:null, espacos:null, pref:null, agendas:null,
  ev:null, rascunho:null, arr:null, rolagem:null
};
const AG_CAMADAS = CAMADAS_AGENDA;
const AG_CORES = ['#2DD4BF', '#CEDC00', '#4ADE97', '#7FA7F2', '#A78BFA', '#F5C36A', '#F1806F', '#8E8E93'];
const AG_REPETE = [['Única', 'Não repete'], ['Diária', 'Todos os dias'], ['Dias úteis', 'Dias úteis (seg. a sex.)'],
  ['Semanal', 'Semanal'], ['Quinzenal', 'Quinzenal'], ['Mensal', 'Mensal'], ['Anual', 'Anual']];
const AG_LEMBRETES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080];
const AG_VIS = { equipe:'Toda a equipe vê', convidados:'Só os convidados veem', privado:'Privado' };
const AG_RESP = { vou:['Vou', 'ok', '✓'], talvez:['Talvez', 'warn', '?'], nao:['Não vou', 'bad', '✕'], pendente:['Aguardando', 'dim', '…'] };
const AG_AUSENCIAS = AUSENCIAS_AGENDA;
const AG_MARCOS = { equipe:'Marco da equipe', ufmg:'Calendário da UFMG', prazo:'Prazo', feriado:'Feriado', evento:'Evento externo' };
const AG_HH = 48;                     /* altura de uma hora na grade, em px */
const FEED_BASE = CONFIG.SUPABASE_URL + '/functions/v1/agenda-ics?t=';

const agEu = () => state.perfil?.registro ?? null;
const agLer = (k, d) => { try { const v = localStorage.getItem('nd.agenda.' + k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } };
const agGuardar = (k, v) => { try { localStorage.setItem('nd.agenda.' + k, JSON.stringify(v)); } catch(e){} };
const agMovel = () => window.matchMedia('(max-width:700px)').matches;
const agCamada = k => agenda.camadas[k] !== false;
function agRotuloLembrete(m){
  if (!m) return 'no horário do evento';
  if (m % 10080 === 0) return (m / 10080) + (m === 10080 ? ' semana' : ' semanas') + ' antes';
  if (m % 1440 === 0) return (m / 1440) + (m === 1440 ? ' dia' : ' dias') + ' antes';
  if (m % 60 === 0) return (m / 60) + (m === 60 ? ' hora' : ' horas') + ' antes';
  return m + ' minutos antes';
}
const agDataLonga = (iso, comAno) => dataHora(iso, 12*60).toLocaleDateString('pt-BR',
  { weekday:'long', day:'numeric', month:'long', ...(comAno ? { year:'numeric' } : {}) });
const agCap = maiuscula;

/* ============================================================
   ROTA
   ============================================================ */
async function pageAgenda(sub, sub2){
  agenda.camadas ||= agLer('camadas', {});
  if (sub === 'evento' && sub2) return agEventoPagina(sub2);
  if (/^[0-9a-f-]{36}$/i.test(sub || '')) return agEventoPagina(sub);   /* #/agenda/<id>, o endereço antigo */
  if (sub === 'novo') return agEventoNovo(sub2);
  if (sub === 'config') return agConfig(sub2);
  const visao = ['dia', 'semana', 'mes'].includes(sub) ? sub : (agMovel() ? 'dia' : agLer('visao', 'semana'));
  return agCalendario(visao, agLerData(sub2, visao) || new Date());
}
function agLerData(s, visao){
  if (!s) return null;
  if (visao === 'mes' && /^\d{4}-\d{2}$/.test(s)){
    /* o mês guarda o dia em que se estava (ou hoje, se for o mês de hoje):
       voltar para o dia ou a semana cai nele, não no dia 1 */
    const d = dataHora(s + '-01', 12*60), mesmo = x => x && x.getFullYear() === d.getFullYear() && x.getMonth() === d.getMonth();
    return mesmo(agenda.ref) ? new Date(agenda.ref) : mesmo(new Date()) ? dataHora(hojeISO(), 12*60) : d;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return dataHora(s, 12*60);
  return null;
}
const agHref = (visao, d) => `#/agenda/${visao}/${visao === 'mes' ? isoDia(d).slice(0, 7) : isoDia(d)}`;

async function agPreparar(){
  const tarefas = [];
  if (!agenda.predef) tarefas.push(sb.from('agenda_predefinidos').select('*').eq('ativo', true).order('ordem')
    .then(r => { agenda.predef = r.error ? [] : (r.data || []); }, () => { agenda.predef = []; }));
  if (!agenda.espacos) tarefas.push(sb.from('espacos').select('id,nome').eq('ativo', true).order('ordem')
    .then(r => { agenda.espacos = r.error ? [] : (r.data || []); }, () => { agenda.espacos = []; }));
  if (!agenda.pref && agEu()) tarefas.push(sb.from('agenda_preferencias').select('*').eq('registro', agEu()).maybeSingle()
    .then(r => { agenda.pref = r.data || { emails:true, lembretes:[30] }; }, () => { agenda.pref = { emails:true, lembretes:[30] }; }));
  if (!state.treMeus) tarefas.push(carregarTreinamentosMeus());
  await Promise.all(tarefas);
  agenda.pref ||= { emails:true, lembretes:[30] };
}

/* ============================================================
   OS ITENS — a agenda e as outras camadas, num formato só
   (carregarAgendaPessoal, na casca: o início lê os mesmos)
   ============================================================ */
async function agCarregar(de, ate){
  const { itens, erro } = await carregarAgendaPessoal(de, ate);
  agenda.itens = itens; agenda.erro = erro;
  agenda.janela = { de, ate };
  return itens;
}
const agVisiveis = () => agenda.itens.filter(i => agCamada(i.camada) && (i.camada !== 'publicacoes' || podeStudio()));

/* ============================================================
   A TELA — a coluna, a barra e o corpo
   ============================================================ */
function agPeriodo(visao, ref){
  if (visao === 'dia') return { de: isoDia(ref), ate: isoDia(ref), dias: [new Date(ref)] };
  if (visao === 'semana'){
    const ini = inicioDaSemana(ref), dias = [];
    for (let i = 0; i < 7; i++){ const d = new Date(ini); d.setDate(ini.getDate() + i); dias.push(d); }
    return { de: isoDia(dias[0]), ate: isoDia(dias[6]), dias };
  }
  const ini = inicioDaSemana(new Date(ref.getFullYear(), ref.getMonth(), 1, 12));
  const fim = new Date(ini); fim.setDate(ini.getDate() + 41);
  return { de: isoDia(ini), ate: isoDia(fim), dias: [] };
}
function agTitulo(visao, ref, per){
  if (visao === 'dia') return agCap(agDataLonga(isoDia(ref), true));
  if (visao === 'mes') return agCap(MESES_LONGOS[ref.getMonth()]) + ' de ' + ref.getFullYear();
  const a = per.dias[0], b = per.dias[6];
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} a ${b.getDate()} de ${MESES_LONGOS[b.getMonth()]} de ${b.getFullYear()}`;
  if (a.getFullYear() === b.getFullYear()) return `${a.getDate()} de ${MESES_LONGOS[a.getMonth()]} a ${b.getDate()} de ${MESES_LONGOS[b.getMonth()]} de ${b.getFullYear()}`;
  return `${fmtD(isoDia(a))} a ${fmtD(isoDia(b))}`;
}
function agPasso(n){
  const { visao, ref } = agenda, d = new Date(ref);
  if (visao === 'dia') d.setDate(d.getDate() + n);
  else if (visao === 'semana') d.setDate(d.getDate() + 7 * n);
  else { d.setDate(1); d.setMonth(d.getMonth() + n); }
  location.hash = agHref(visao, d);
}
function agVisao(v){ if (!agMovel()) agGuardar('visao', v); location.hash = agHref(v, agenda.ref); }
/* os atalhos do Google Agenda, na grade: T hoje, D/S/M a visão, J/K ou
   as setas para andar, C criar. Fora dela, ou digitando, nada. */
document.addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || !$('#agx-corpo') || !/^#\/agenda(\/(dia|semana|mes)(\/|$)|$)/.test(location.hash)) return;
  if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return;
  if ($('#modal')?.classList.contains('open') || !$('#paleta')?.hidden) return;
  const k = e.key.toLowerCase();
  const acao = { t: () => location.hash = agHref(agenda.visao, new Date()), d: () => agVisao('dia'), s: () => agVisao('semana'),
    w: () => agVisao('semana'), m: () => agVisao('mes'), j: () => agPasso(1), n: () => agPasso(1), arrowright: () => agPasso(1),
    k: () => agPasso(-1), p: () => agPasso(-1), arrowleft: () => agPasso(-1), c: () => agEu() && agNovoEvento() }[k];
  if (acao){ e.preventDefault(); acao(); }
});

async function agCalendario(visao, ref){
  agenda.visao = visao; agenda.ref = ref;
  const per = agPeriodo(visao, ref);
  const noMesmoLugar = $('#agx-corpo') && agenda.janela;
  if (!noMesmoLugar) $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando a agenda…</div>`;
  await agPreparar();
  await agCarregar(per.de, per.ate);
  $('#main').innerHTML = `<div class="agx">
    <aside class="agx-lado" aria-label="Agenda">
      ${agBotaoCriar()}
      <div class="agx-mini" id="agx-mini">${agMiniHTML(agenda.mini || ref)}</div>
      <div class="agx-camadas"><h5>Agendas</h5>${AG_CAMADAS.filter(([k]) => k !== 'publicacoes' || podeStudio()).map(([k, l, c]) =>
        `<label class="agx-camada" style="--cc:${c}"><input type="checkbox" ${agCamada(k) ? 'checked' : ''}
          onchange="agAlternarCamada('${k}', this.checked)"><span class="cx" aria-hidden="true"></span>${l}</label>`).join('')}</div>
    </aside>
    <section class="agx-main">
      <div class="cal-barra">
        <button class="btn ghost mini" onclick="location.hash=agHref(agenda.visao,new Date())">Hoje</button>
        <span class="cal-nav">${ibtn('back', 'Anterior', 'agPasso(-1)', 'sm')}${ibtn('chevron', 'Próximo', 'agPasso(1)', 'sm')}</span>
        <h1 class="cal-tit">${esc(agTitulo(visao, ref, per))}</h1>
        <span class="cal-dir">
          <span class="seg" role="group" aria-label="Visão">${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, l]) =>
            `<button class="${visao === k ? 'on' : ''}" aria-pressed="${visao === k}" onclick="agVisao('${k}')">${l}</button>`).join('')}</span>
          <a class="icon-btn" href="#/agenda/config" title="Configurações da agenda" aria-label="Configurações da agenda">${ic('engrenagem')}</a>
        </span>
      </div>
      ${agenda.erro ? `<div class="aviso-box err">A agenda não carregou: ${esc(agenda.erro.message || agenda.erro)}.
        ${/agenda_itens/.test(agenda.erro.message || '') ? 'Falta aplicar a migração db/v28_agenda.sql.' : ''}</div>` : ''}
      ${!agEu() ? `<div class="aviso-box info">Conta sem vínculo com um registro de membro: leitura apenas.</div>` : ''}
      <div id="agx-corpo"></div>
    </section></div>
    ${agEu() ? `<button class="agx-fab" onclick="agNovoEvento()" aria-label="Criar evento">${ic('plus')}</button>` : ''}`;
  agDesenharCorpo(per);
}
function agDesenharCorpo(per){
  per ||= agPeriodo(agenda.visao, agenda.ref);
  const el = $('#agx-corpo'); if (!el) return;
  if (agenda.visao === 'mes') return agMes(el);
  agGrade(el, per.dias);
}
function agAlternarCamada(k, on){ agenda.camadas[k] = on; agGuardar('camadas', agenda.camadas); agDesenharCorpo(); }

/* ---------- criar: o botão e o menu ---------- */
function agBotaoCriar(){
  if (!agEu()) return '';
  return `<div class="agx-criar"><button class="btn solid" onclick="agNovoEvento()">${ic('plus')} Criar</button>
    <button class="btn solid agx-criar-mais" aria-label="Outros tipos" aria-haspopup="true" onclick="agMenuCriar(event)">${ic('chevron')}</button>
    <div class="agx-criar-pop" id="agx-criar-pop" hidden>
      <button onclick="agNovoEvento()">Evento</button>
      <button onclick="agModalAusencia()">Ausência</button>
      ${can() ? '<button onclick="agModalMarco()">Marco da equipe</button>' : ''}</div></div>`;
}
function agMenuCriar(e){
  e.stopPropagation();
  const p = $('#agx-criar-pop'); p.hidden = !p.hidden;
  if (!p.hidden) setTimeout(() => document.addEventListener('click', () => { const x = $('#agx-criar-pop'); if (x) x.hidden = true; }, { once:true }));
}
function agNovoEvento(iso, ini, fim){
  const d = iso || (agenda.ref && agenda.visao !== 'mes' ? isoDia(agenda.ref) : hojeISO());
  if (ini == null){ const a = new Date(); ini = Math.min(Math.ceil((a.getHours() * 60 + a.getMinutes()) / 30) * 30, 22*60); }
  location.hash = `#/agenda/novo/${d}T${minHHMM(ini)}~${minHHMM(Math.min(fim ?? ini + 60, 24*60 - 1))}`;
}

/* ---------- o calendário pequeno da coluna ---------- */
function agMiniHTML(ref){
  const ano = ref.getFullYear(), mes = ref.getMonth();
  const ini = inicioDaSemana(new Date(ano, mes, 1, 12)), hoje = hojeISO();
  const per = agPeriodo(agenda.visao, agenda.ref);
  let dias = '';
  for (let i = 0; i < 42; i++){
    const d = new Date(ini); d.setDate(ini.getDate() + i);
    const k = isoDia(d), fora = d.getMonth() !== mes, sel = agenda.visao !== 'mes' && k >= per.de && k <= per.ate;
    dias += `<button class="${fora ? 'fora ' : ''}${k === hoje ? 'hoje ' : ''}${sel ? 'sel' : ''}" onclick="location.hash=agHref(agenda.visao==='mes'?'dia':agenda.visao,dataHora('${k}',720))"
      aria-label="${d.getDate()} de ${MESES_LONGOS[d.getMonth()]}">${d.getDate()}</button>`;
  }
  return `<div class="agx-mini-topo"><b>${agCap(MESES_LONGOS[mes])} ${ano}</b>
      <span>${ibtn('back', 'Mês anterior', 'agMiniPasso(-1)', 'sm')}${ibtn('chevron', 'Próximo mês', 'agMiniPasso(1)', 'sm')}</span></div>
    <div class="agx-mini-grade">${DIAS_SEMANA.map(x => `<span>${x[0]}</span>`).join('')}${dias}</div>`;
}
function agMiniPasso(n){ const d = new Date(agenda.mini || agenda.ref); d.setDate(1); d.setMonth(d.getMonth() + n); agenda.mini = d; $('#agx-mini').innerHTML = agMiniHTML(d); }

/* ============================================================
   DIA E SEMANA — a grade de horas
   ============================================================ */
function agGrade(el, dias){
  const vis = agVisiveis(), hoje = hojeISO();
  const isos = dias.map(isoDia);
  /* o que é de dia inteiro, ou de mais de um dia, vai para a faixa de cima */
  const topo = vis.filter(i => i.dia || i.de !== i.ate).filter(i => i.de <= isos[isos.length - 1] && i.ate >= isos[0])
    .sort((a, b) => a.de.localeCompare(b.de) || (b.ate.localeCompare(a.ate)));
  const faixas = [];
  const pos = topo.map(i => {
    const c0 = Math.max(0, isos.indexOf(i.de < isos[0] ? isos[0] : i.de));
    const c1 = i.ate > isos[isos.length - 1] ? isos.length - 1 : isos.indexOf(i.ate);
    let f = faixas.findIndex(ocup => !ocup.some(([a, b]) => c0 <= b && c1 >= a));
    if (f < 0){ faixas.push([]); f = faixas.length - 1; }
    faixas[f].push([c0, c1]);
    return { i, c0, c1, f };
  });
  const agora = new Date(), minAgora = agora.getHours() * 60 + agora.getMinutes();
  el.innerHTML = `<div class="agw" style="--hh:${AG_HH}px;--n:${dias.length}">
    <div class="agw-cab"><div class="agw-fuso">GMT−3</div>${dias.map(d => { const k = isoDia(d);
      return `<a class="agw-dcab${k === hoje ? ' hoje' : ''}${isoDow(d) > 5 ? ' fds' : ''}" href="${agHref('dia', d)}">
        <span class="dw">${DIAS_SEMANA[isoDow(d) - 1]}</span><span class="dn">${d.getDate()}</span></a>`; }).join('')}</div>
    <div class="agw-todo"><div class="agw-rot"></div>
      <div class="agw-todo-g" style="grid-template-rows:repeat(${Math.max(1, faixas.length)},24px)" data-todo="1">${pos.map(({ i, c0, c1, f }) =>
        `<button class="agw-chip${i.editavel ? ' ed' : ''}" style="grid-column:${c0 + 1}/${c1 + 2};grid-row:${f + 1};--cc:${esc(i.cor)}"
          data-k="${esc(i.k)}" title="${esc(i.titulo)}">${esc(i.titulo)}</button>`).join('')}</div></div>
    <div class="agw-corpo" id="agw-corpo">
      <div class="agw-horas">${Array.from({ length:24 }, (_, h) => `<span style="top:${h * AG_HH}px">${h ? String(h).padStart(2, '0') + ':00' : ''}</span>`).join('')}</div>
      <div class="agw-cols">${dias.map(d => { const k = isoDia(d);
        return `<div class="agw-col${k === hoje ? ' hoje' : ''}${isoDow(d) > 5 ? ' fds' : ''}" data-dia="${k}">
          ${agBlocosDoDia(vis.filter(i => !i.dia && i.de === k && i.de === i.ate))}
          ${k === hoje ? `<div class="agw-agora" style="top:${minAgora / 60 * AG_HH}px"></div>` : ''}</div>`; }).join('')}</div>
    </div></div>`;
  const corpo = $('#agw-corpo');
  corpo.scrollTop = agenda.rolagem ?? (7 * AG_HH - 8);
  corpo.addEventListener('scroll', () => { agenda.rolagem = corpo.scrollTop; }, { passive:true });
  agLigarGrade(el);
}
/* Os eventos com hora de um dia, lado a lado quando se sobrepõem. */
function agBlocosDoDia(lista){
  lista.sort((a, b) => a.hi - b.hi || (b.hf - b.hi) - (a.hf - a.hi));
  const colocados = [];
  let grupo = [], fimGrupo = -1;
  const fechar = () => { const n = Math.max(...grupo.map(x => x.col)) + 1; grupo.forEach(x => x.n = n); grupo = []; };
  for (const i of lista){
    if (i.hi >= fimGrupo && grupo.length) fechar();
    const usadas = grupo.filter(x => x.i.hf > i.hi).map(x => x.col);
    let col = 0; while (usadas.includes(col)) col++;
    const x = { i, col, n:1 }; grupo.push(x); colocados.push(x);
    fimGrupo = Math.max(fimGrupo, i.hf);
  }
  if (grupo.length) fechar();
  return colocados.map(({ i, col, n }) => {
    const top = i.hi / 60 * AG_HH, alt = Math.max(20, (Math.max(i.hf, i.hi + 15) - i.hi) / 60 * AG_HH - 2);
    const curto = alt < 36;
    return `<button class="agw-ev${i.editavel && i.origem === 'evento' ? ' ed' : ''}${i.resposta === 'nao' ? ' recusado' : ''}${i.resposta === 'pendente' ? ' pendente' : ''}${curto ? ' curto' : ''}"
      style="top:${top}px;height:${alt}px;left:calc(${col} * 100% / ${n});width:calc(100% / ${n} - 3px);--cc:${esc(i.cor)}"
      data-k="${esc(i.k)}" title="${esc(i.titulo)}, ${minHHMM(i.hi)}–${minHHMM(i.hf)}">
      <span class="t">${esc(i.titulo)}</span>${curto ? `<span class="h">${minHHMM(i.hi)}</span>` : `<span class="h">${minHHMM(i.hi)} – ${minHHMM(i.hf)}${i.bruto?.local ? ', ' + esc(i.bruto.local) : ''}</span>`}
      ${i.editavel && i.origem === 'evento' ? '<span class="agw-puxa" data-puxa="1"></span>' : ''}</button>`;
  }).join('');
}

/* ---------- mexer na grade: clicar, arrastar, esticar ----------
   Clicar num espaço vazio cria (uma hora); arrastar num espaço vazio
   escolhe o intervalo. Arrastar um evento que você edita o leva para
   outro horário ou outro dia; puxar a borda de baixo muda o fim.
   Tudo de 15 em 15 minutos. No toque, só o clique. */
const agSnap = m => Math.max(0, Math.min(24 * 60, Math.round(m / 15) * 15));
function agMinutoEm(col, y){ const r = col.getBoundingClientRect(); return (y - r.top) / AG_HH * 60; }
function agColunaEm(x, y){ return document.elementsFromPoint(x, y).find(e => e.classList?.contains('agw-col')) || null; }
function agLigarGrade(el){
  el.querySelectorAll('.agw-chip').forEach(b => b.addEventListener('click', () => agAbrirItem(b.dataset.k, b)));
  const cols = el.querySelector('.agw-cols'); if (!cols) return;
  cols.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    const ev = e.target.closest('.agw-ev'), col = e.target.closest('.agw-col');
    if (!col) return;
    const toque = e.pointerType === 'touch';
    if (ev){
      const it = agenda.itens.find(x => x.k === ev.dataset.k);
      const mexe = !toque && it && it.editavel && it.origem === 'evento';
      agenda.arr = { tipo: e.target.dataset.puxa ? 'fim' : 'mover', it, el: ev, x0:e.clientX, y0:e.clientY, mexe, moveu:false,
        m0: agMinutoEm(col, e.clientY), dia0: col.dataset.dia };
    } else {
      if (toque || !agEu()){ agenda.arr = { tipo:'toque', col, y0:e.clientY, x0:e.clientX, moveu:false }; return; }
      const m = Math.floor(agMinutoEm(col, e.clientY) / 15) * 15;
      agenda.arr = { tipo:'novo', col, m0:m, m1:m + 60, x0:e.clientX, y0:e.clientY, moveu:false };
    }
    if (!toque) cols.setPointerCapture(e.pointerId);
  });
  cols.addEventListener('pointermove', e => {
    const a = agenda.arr; if (!a) return;
    if (!a.moveu && Math.hypot(e.clientX - a.x0, e.clientY - a.y0) < 5) return;
    a.moveu = true;
    if (a.tipo === 'novo'){
      const m = agSnap(agMinutoEm(a.col, e.clientY));
      a.m1 = Math.max(m, a.m0 + 15);
      agSombra(a.col, a.m0, a.m1, '');
    } else if (a.tipo === 'mover' && a.mexe){
      const col = agColunaEm(e.clientX, e.clientY) || a.el.parentElement;
      const dur = a.it.hf - a.it.hi, ini = agSnap(a.it.hi + (agMinutoEm(col, e.clientY) - a.m0));
      a.novo = { dia: col.dataset.dia, hi: Math.min(ini, 24 * 60 - dur), hf: Math.min(ini, 24 * 60 - dur) + dur };
      a.el.classList.add('mov'); agSombra(col, a.novo.hi, a.novo.hf, a.it.titulo, a.it.cor);
    } else if (a.tipo === 'fim' && a.mexe){
      const col = a.el.parentElement, fim = Math.max(a.it.hi + 15, agSnap(agMinutoEm(col, e.clientY)));
      a.novo = { dia: a.it.de, hi: a.it.hi, hf: fim };
      agSombra(col, a.it.hi, fim, a.it.titulo, a.it.cor);
    }
  });
  const fim = e => {
    const a = agenda.arr; agenda.arr = null; if (!a) return;
    document.querySelectorAll('.agw-sombra').forEach(x => x.remove());
    a.el?.classList.remove('mov');
    if (a.tipo === 'toque'){ if (!a.moveu && agEu()){ const m = Math.floor(agMinutoEm(a.col, a.y0) / 30) * 30; agRapido(a.col.dataset.dia, m, m + 60, a.x0, a.y0); } return; }
    if (a.tipo === 'novo'){ agRapido(a.col.dataset.dia, a.m0, a.moveu ? a.m1 : a.m0 + 60, e.clientX, e.clientY); return; }
    if (!a.moveu || !a.novo){ agAbrirItem(a.it?.k, a.el); return; }
    if (a.novo.dia === a.it.de && a.novo.hi === a.it.hi && a.novo.hf === a.it.hf) return;
    agReagendar(a.it, a.novo.dia, a.novo.hi, a.novo.hf);
  };
  cols.addEventListener('pointerup', fim);
  cols.addEventListener('pointercancel', () => { agenda.arr = null; document.querySelectorAll('.agw-sombra').forEach(x => x.remove()); });
}
function agSombra(col, m0, m1, titulo, cor){
  document.querySelectorAll('.agw-sombra').forEach(x => x.remove());
  const s = document.createElement('div');
  s.className = 'agw-sombra'; s.style.top = (m0 / 60 * AG_HH) + 'px'; s.style.height = Math.max(18, (m1 - m0) / 60 * AG_HH - 2) + 'px';
  if (cor) s.style.setProperty('--cc', cor);
  s.innerHTML = `<b>${esc(titulo || '(sem título)')}</b><span>${minHHMM(m0)} – ${minHHMM(m1)}</span>`;
  col.appendChild(s);
}

/* Abrir um item: o evento tem página; o resto abre onde mora. */
function agAbrirItem(k, alvo){
  const it = agenda.itens.find(x => x.k === k); if (!it) return;
  if (it.href){ location.hash = it.href; return; }
  if (it.origem === 'marco') return agModalMarco(it);
  if (it.origem === 'ausencia') return agModalAusencia(it);
}

/* ---------- reagendar arrastando ---------- */
async function agReagendar(it, dia, hi, hf){
  const conv = (it.bruto?.convidados || 0) > 1;
  const escolha = await agPerguntarSalvar({ serie: it.serie, convidados: conv, verbo:'Mover' });
  if (!escolha) return agDesenharCorpo();
  const p = { id: it.ref, data: dia, hora_inicio: minHHMM(hi), hora_fim: minHHMM(Math.min(hf, 24*60 - 1)),
    aplicar: escolha.aplicar, notificar: escolha.notificar };
  const { data, error } = await sb.rpc('agenda_evento_salvar', { p });
  if (error || data?.status !== 'ok'){ toast(motivoRPC(data, error, 'Não foi possível mover o evento'), true); return agDesenharCorpo(); }
  toast(`Movido para ${fmtD(dia)}, ${minHHMM(hi)}.`);
  agCalendario(agenda.visao, agenda.ref);
}
/* A pergunta do Google: este ou os seguintes, e avisar os convidados. */
function agPerguntarSalvar({ serie, convidados, verbo }){
  if (!serie && !convidados) return Promise.resolve({ aplicar:'este', notificar:true });
  return new Promise(ok => {
    agenda._resolver = v => { agenda._resolver = null; fechaModal(); ok(v); };
    abreModal(`<h3>${esc(verbo || 'Salvar')} o evento</h3>
      ${serie ? `<div class="fld"><label>Evento que se repete</label>
        <label class="check"><input type="radio" name="ag-apl" value="este" checked> <span>Este evento</span></label>
        <label class="check"><input type="radio" name="ag-apl" value="seguintes"> <span>Este e os seguintes</span></label></div>` : ''}
      ${convidados ? `<label class="check"><input type="checkbox" id="ag-notif" checked> <span>Enviar e-mail aos convidados</span></label>` : ''}
      <div class="acts"><button class="btn ghost" onclick="agenda._resolver(null)">Cancelar</button>
        <button class="btn solid" onclick="agenda._resolver({ aplicar: document.querySelector('input[name=ag-apl]:checked')?.value || 'este',
          notificar: document.getElementById('ag-notif') ? document.getElementById('ag-notif').checked : true })">${esc(verbo || 'Salvar')}</button></div>`);
  });
}

/* ---------- criar rápido ---------- */
function agRapido(dia, m0, m1, x, y){
  agFecharRapido();
  const pd = agenda.predef || [];
  const div = document.createElement('div');
  div.id = 'agx-rapido'; div.className = 'agx-rapido'; div.setAttribute('role', 'dialog'); div.setAttribute('aria-label', 'Novo evento');
  div.innerHTML = `<input id="agr-tit" placeholder="Adicionar título" maxlength="160" aria-label="Título">
    <div class="agr-quando">${ic('relogio')} ${esc(agCap(agDataLonga(dia)))}, ${minHHMM(m0)} – ${minHHMM(Math.min(m1, 24*60 - 1))}</div>
    ${pd.length ? `<select id="agr-pd" aria-label="Evento predefinido"><option value="">Evento</option>${pd.map(p =>
      `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select>` : ''}
    <div class="acts"><button class="btn ghost mini" onclick="agRapidoMais('${dia}',${m0},${m1})">Mais opções</button>
      <button class="btn solid mini" id="agr-ok" onclick="agRapidoSalvar('${dia}',${m0},${m1})">Salvar</button></div>`;
  document.body.appendChild(div);
  const w = div.offsetWidth, h = div.offsetHeight;
  div.style.left = Math.max(16, Math.min(x + 12, innerWidth - w - 16)) + 'px';
  div.style.top = Math.max(16, Math.min(y - 20, innerHeight - h - 16)) + 'px';
  agSombraFixa(dia, m0, m1);
  const t = $('#agr-tit'); t.focus();
  t.addEventListener('keydown', e => { if (e.key === 'Enter') agRapidoSalvar(dia, m0, m1); if (e.key === 'Escape') agFecharRapido(); });
  setTimeout(() => document.addEventListener('pointerdown', agFecharFora, true));
}
function agSombraFixa(dia, m0, m1){
  const col = document.querySelector(`.agw-col[data-dia="${dia}"]`); if (!col) return;
  agSombra(col, m0, m1, '(sem título)');
  document.querySelector('.agw-sombra')?.classList.add('fixa');
}
function agFecharFora(e){ if (!e.target.closest('#agx-rapido')) agFecharRapido(); }
function agFecharRapido(){
  document.removeEventListener('pointerdown', agFecharFora, true);
  $('#agx-rapido')?.remove(); document.querySelectorAll('.agw-sombra').forEach(x => x.remove());
}
function agRapidoMais(dia, m0, m1){
  agenda.rascunho = { titulo: $('#agr-tit')?.value.trim() || '', predefinido_id: $('#agr-pd')?.value || '' };
  agFecharRapido();
  location.hash = `#/agenda/novo/${dia}T${minHHMM(m0)}~${minHHMM(Math.min(m1, 24*60 - 1))}`;
}
async function agRapidoSalvar(dia, m0, m1){
  const b = $('#agr-ok'); if (b) b.disabled = true;
  const pd = (agenda.predef || []).find(p => p.id === $('#agr-pd')?.value);
  const p = { titulo: $('#agr-tit').value.trim() || pd?.titulo || pd?.nome || '', data: dia,
    hora_inicio: minHHMM(m0), hora_fim: minHHMM(Math.min(m1, 24*60 - 1)),
    lembretes: pd?.lembretes || agenda.pref?.lembretes || [30], visibilidade: pd?.visibilidade || 'convidados' };
  if (pd){ p.predefinido_id = pd.id; Object.assign(p, agConvidadosDoPredefinido(pd)); }
  const { data, error } = await sb.rpc('agenda_evento_salvar', { p });
  if (error || data?.status !== 'ok'){ if (b) b.disabled = false; return toast(motivoRPC(data, error, 'Não foi possível criar o evento'), true); }
  agFecharRapido();
  toast(data.convidados > 1 ? `Evento criado. Convite enviado a ${data.convidados - 1} pessoa${data.convidados > 2 ? 's' : ''}.` : 'Evento criado.');
  agCalendario(agenda.visao, agenda.ref);
}
/* Os convidados de um evento predefinido: a equipe toda, os grupos
   (com quem está abaixo deles) e as pessoas escolhidas. */
function agConvidadosDoPredefinido(pd){
  const regs = new Set(pd.convidados || []);
  const ativos = (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status));
  if (pd.todos) ativos.forEach(m => regs.add(m.registro));
  (pd.grupos || []).forEach(id => { const g = grupoPorId(id); if (g) membrosDoGrupo(g.nome).forEach(m => regs.add(m.registro)); });
  return { obrigatorios: [...regs] };
}

/* ============================================================
   MÊS — o calendário do mês, o mesmo componente do Studio
   ============================================================ */
function agMes(el){
  const vis = agVisiveis();
  el.innerHTML = calMesHTML({ chave:'agenda', ano: agenda.ref.getFullYear(), mes: agenda.ref.getMonth(), max: agMovel() ? 2 : 4,
    itens: vis.map(i => ({ id:i.k, titulo:i.titulo, cor:i.cor, de:i.de, ate:i.ate, hora: i.dia ? null : minHHMM(i.hi),
      arrasta: i.editavel && i.origem === 'evento' && i.de === i.ate, classe: i.resposta === 'nao' ? 'recusado' : '' })) });
  calMesLigar('agenda', {
    item: k => agAbrirItem(k),
    dia: (iso, e, numero) => { if (numero || !agEu()) location.hash = agHref('dia', dataHora(iso, 720)); else agRapido(iso, 9*60, 10*60, e.clientX, e.clientY); },
    soltar: (k, iso) => { const it = agenda.itens.find(x => x.k === k); if (it && it.de !== iso) agReagendar(it, iso, it.dia ? null : it.hi, it.dia ? null : it.hf); }
  });
}

/* ============================================================
   AUSÊNCIA E MARCO — o que não é evento
   ============================================================ */
function agModalAusencia(it){
  const b = it?.bruto, d0 = b ? b.data_inicio : (agenda.ref && agenda.visao !== 'mes' ? isoDia(agenda.ref) : hojeISO());
  const pode = !it || it.editavel;
  abreModal(`<h3>${it ? esc(it.titulo) : 'Ausência'}</h3>
    <div class="fld"><label for="au-tipo">Tipo</label><select id="au-tipo" ${pode ? '' : 'disabled'}>${Object.entries(AG_AUSENCIAS).map(([k, l]) =>
      `<option value="${k}" ${b?.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <label class="check"><input type="checkbox" id="au-dia" ${!b || b.dia_inteiro ? 'checked' : ''} ${pode ? '' : 'disabled'}
      onchange="document.getElementById('au-horas').hidden=this.checked"> <span>Dia inteiro</span></label>
    <div class="dupla"><div class="fld"><label for="au-d1">De</label><input id="au-d1" type="date" value="${esc(d0)}" ${pode ? '' : 'disabled'}></div>
      <div class="fld"><label for="au-d2">Até</label><input id="au-d2" type="date" value="${esc(b?.data_fim || d0)}" ${pode ? '' : 'disabled'}></div></div>
    <div class="dupla" id="au-horas" ${!b || b.dia_inteiro ? 'hidden' : ''}>
      <div class="fld"><label for="au-h1">Das</label><input id="au-h1" type="time" step="900" value="${esc((b?.hora_inicio || '09:00').slice(0, 5))}" ${pode ? '' : 'disabled'}></div>
      <div class="fld"><label for="au-h2">Às</label><input id="au-h2" type="time" step="900" value="${esc((b?.hora_fim || '18:00').slice(0, 5))}" ${pode ? '' : 'disabled'}></div></div>
    <div class="fld"><label for="au-obs">Observação</label><input id="au-obs" maxlength="120" value="${esc(b?.pauta || '')}" ${pode ? '' : 'disabled'}></div>
    <p class="small muted">Férias e afastamento: visíveis para você e para o Depto. de Pessoal. Para a equipe, o horário aparece ocupado.</p>
    <p class="err-msg" id="au-erro"></p>
    <div class="acts">${it && pode ? `<button class="btn perigo" style="margin-right:auto" onclick="agRemoverAusencia('${esc(it.ref)}')">Excluir</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">${pode ? 'Cancelar' : 'Fechar'}</button>
      ${pode ? `<button class="btn solid" onclick="agSalvarAusencia(${it ? `'${esc(it.ref)}'` : 'null'})">Salvar</button>` : ''}</div>`);
}
async function agSalvarAusencia(id){
  const dia = $('#au-dia').checked, d1 = $('#au-d1').value, d2 = $('#au-d2').value || d1;
  const erro = t => { $('#au-erro').textContent = t; };
  if (!d1 || d2 < d1) return erro('Confira o período.');
  let ini, fim;
  if (dia){ ini = dataHora(d1, 0); fim = dataHora(d2, 0); fim.setDate(fim.getDate() + 1); }
  else { const h1 = $('#au-h1').value, h2 = $('#au-h2').value; if (!h1 || !h2 || (d1 === d2 && h2 <= h1)) return erro('O fim precisa ser depois do início.');
    ini = dataHora(d1, hhmmMin(h1)); fim = dataHora(d2, hhmmMin(h2)); }
  const { data, error } = await sb.rpc('agenda_ausencia_salvar', { p: { id, tipo: $('#au-tipo').value, inicio: ini.toISOString(),
    fim: fim.toISOString(), dia_inteiro: dia, observacao: $('#au-obs').value.trim() } });
  if (error || data?.status !== 'ok') return erro(motivoRPC(data, error, 'Não foi possível salvar.'));
  fechaModal(); toast('Ausência salva.'); agCalendario(agenda.visao || 'semana', agenda.ref || new Date());
}
async function agRemoverAusencia(id){
  if (!await confirma('Excluir esta ausência?', 'Excluir')) return;
  const { error } = await sb.from('agenda_ausencias').delete().eq('id', id);
  if (error) return toast('Não foi possível excluir: ' + error.message, true);
  toast('Ausência excluída.'); agCalendario(agenda.visao, agenda.ref);
}
function agModalMarco(it){
  const b = it?.bruto, pode = !it || it.editavel, d0 = b?.data_inicio || (agenda.ref ? isoDia(agenda.ref) : hojeISO());
  abreModal(`<h3>${it ? esc(it.titulo) : 'Marco da equipe'}</h3>
    <div class="fld"><label for="mk-tit">Título</label><input id="mk-tit" maxlength="160" value="${esc(b?.titulo || '')}" ${pode ? '' : 'disabled'}></div>
    <div class="fld"><label for="mk-tipo">Tipo</label><select id="mk-tipo" ${pode ? '' : 'disabled'}>${Object.entries(AG_MARCOS).map(([k, l]) =>
      `<option value="${k}" ${b?.tipo === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="dupla"><div class="fld"><label for="mk-d1">De</label><input id="mk-d1" type="date" value="${esc(d0)}" ${pode ? '' : 'disabled'}></div>
      <div class="fld"><label for="mk-d2">Até</label><input id="mk-d2" type="date" value="${esc(b?.data_fim || d0)}" ${pode ? '' : 'disabled'}></div></div>
    <div class="fld"><label for="mk-obs">Observação</label><textarea id="mk-obs" rows="2" ${pode ? '' : 'disabled'}>${esc(b?.pauta || '')}</textarea></div>
    <p class="err-msg" id="mk-erro"></p>
    <div class="acts">${it && pode ? `<button class="btn perigo" style="margin-right:auto" onclick="agRemoverMarco('${esc(it.ref)}')">Excluir</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">${pode ? 'Cancelar' : 'Fechar'}</button>
      ${pode ? `<button class="btn solid" onclick="agSalvarMarco(${it ? `'${esc(it.ref)}'` : 'null'})">Salvar</button>` : ''}</div>`);
}
async function agSalvarMarco(id){
  const p = { id, titulo: $('#mk-tit').value.trim(), tipo: $('#mk-tipo').value, data_inicio: $('#mk-d1').value,
    data_fim: $('#mk-d2').value || $('#mk-d1').value, observacao: $('#mk-obs').value.trim() };
  if (!p.titulo) return $('#mk-erro').textContent = 'O título é obrigatório.';
  const { data, error } = await sb.rpc('agenda_marco_salvar', { p });
  if (error || data?.status !== 'ok') return $('#mk-erro').textContent = motivoRPC(data, error, 'Não foi possível salvar.');
  fechaModal(); toast('Marco salvo.'); agCalendario(agenda.visao || 'mes', agenda.ref || new Date());
}
async function agRemoverMarco(id){
  if (!await confirma('Excluir este marco?', 'Excluir')) return;
  const { data, error } = await sb.rpc('agenda_marco_remover', { p: { id } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível excluir'), true);
  toast('Marco excluído.'); agCalendario(agenda.visao, agenda.ref);
}

/* ============================================================
   UM EVENTO — #/agenda/evento/<id> e #/agenda/novo
   Quem organiza (e a gestão) edita; quem foi convidado lê e responde.
   ============================================================ */
function agModeloVazio(){
  return { titulo:'', data:hojeISO(), data_fim:'', dia_inteiro:false, hi:'09:00', hf:'10:00', recorrencia:'Única', repetir_ate:'',
    local:'', espaco_id:'', meet_url:'', descricao:'', visibilidade:'convidados', cor:'', predefinido_id:'',
    lembretes: [...(agenda.pref?.lembretes || [30])] };
}
async function agEventoNovo(s){
  if (!agEu()){ location.hash = '#/agenda'; return; }
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span></div>`;
  await agPreparar();
  const f = agModeloVazio();
  const m = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2})(?:~(\d{2}:\d{2}))?)?$/.exec(s || '');
  if (m){ f.data = m[1]; if (m[2]){ f.hi = m[2]; f.hf = m[3] || minHHMM(Math.min(hhmmMin(m[2]) + 60, 24*60 - 1)); } else f.dia_inteiro = true; }
  else { const a = new Date(); const ini = Math.min(Math.ceil((a.getHours() * 60 + a.getMinutes()) / 30) * 30, 22*60); f.hi = minHHMM(ini); f.hf = minHHMM(ini + 60); }
  const eu = (state.membros || []).find(x => x.registro === agEu());
  agenda.ev = { novo:true, pode:true, f, orig:null, conv:new Map([[agEu(), { nome: eu?.nome || 'Você', opcional:false, resposta:'vou' }]]),
    ext:[], dono: agEu(), organizador: eu?.nome, ocup:null, busca:'' };
  const r = agenda.rascunho; agenda.rascunho = null;
  if (r?.titulo) f.titulo = r.titulo;
  if (r?.predefinido_id) agAplicarPredefinido(r.predefinido_id, true);
  agEventoDesenhar();
  setTimeout(() => $('#ev-tit')?.focus(), 30);
}
async function agEventoPagina(id){
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span> Carregando o evento…</div>`;
  await agPreparar();
  const { data, error } = await sb.rpc('agenda_evento', { p_id: id });
  if (error || data?.status !== 'ok'){
    $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div><h3>Evento não encontrado</h3>
      <p>${error ? esc(error.message) : 'Ele pode ter sido cancelado, ou não foi compartilhado com você.'}</p>
      <a class="btn ghost" href="#/agenda">Voltar à agenda</a></div>`;
    return;
  }
  const e = data.evento;
  const f = { titulo:e.titulo || '', data:e.data, data_fim:e.data_fim || '', dia_inteiro:!e.hora_inicio,
    hi:e.hora_inicio || '09:00', hf:e.hora_fim || (e.hora_inicio ? minHHMM(Math.min(hhmmMin(e.hora_inicio) + 60, 24*60 - 1)) : '10:00'),
    recorrencia:e.recorrencia || 'Única', repetir_ate:e.serie_ate || '', local:e.local || '', espaco_id:e.espaco_id ? String(e.espaco_id) : '',
    meet_url:e.meet_url || '', descricao:e.descricao || '', visibilidade:e.visibilidade, cor:e.cor_propria || '', predefinido_id:e.predefinido_id || '',
    lembretes:[...(e.lembretes || [])] };
  agenda.ev = { id, novo:false, pode:!!data.pode_editar && !e.cancelado, cancelado:e.cancelado, numero:e.numero, serie:!!e.serie_id && e.recorrencia !== 'Única',
    f, orig: JSON.parse(JSON.stringify(f)), minha:data.minha_resposta, dono:e.owner_registro, organizador:e.organizador,
    conv: new Map(data.participantes.map(p => [p.registro, { nome:p.nome, opcional:p.papel === 'opcional', resposta:p.resposta }])),
    ext: (data.externos || []).map(x => ({ ...x })), ocup:null, busca:'', corEvento: e.cor };
  agenda.ev.convOrig = JSON.stringify([...agenda.ev.conv].map(([r, v]) => [r, v.opcional]).sort());
  agenda.ev.extOrig = JSON.stringify(agenda.ev.ext.map(x => x.email).sort());
  agEventoDesenhar();
}

function agEventoDesenhar(){
  const ev = agenda.ev, f = ev.f;
  const volta = agenda.visao ? agHref(agenda.visao, agenda.ref || new Date()) : '#/agenda';
  if (!ev.pode) return agEventoLeitura(volta);
  const pd = agenda.predef || [];
  $('#main').innerHTML = `<div class="evp">
    <div class="evp-topo">
      <a class="icon-btn" href="${volta}" title="Voltar à agenda" aria-label="Voltar à agenda">${ic('x')}</a>
      <input id="ev-tit" class="evp-tit" placeholder="Adicionar título" maxlength="160" value="${esc(f.titulo)}" oninput="agenda.ev.f.titulo=this.value" aria-label="Título">
      <span class="evp-acoes">
        ${ev.novo ? '' : `<button class="btn ghost mini" onclick="agEventoExcluir()">Excluir</button>`}
        <button class="btn solid" id="ev-salvar" onclick="agEventoSalvar()">Salvar</button></span>
    </div>
    <div class="evp-quando">
      <input type="date" id="ev-data" value="${esc(f.data)}" onchange="agEvData(this.value)" aria-label="Data">
      <span id="ev-horas" ${f.dia_inteiro ? 'hidden' : ''}><input type="time" id="ev-hi" step="900" value="${esc(f.hi)}" onchange="agEvHora('hi',this.value)" aria-label="Início">
        <span class="ate">até</span><input type="time" id="ev-hf" step="900" value="${esc(f.hf)}" onchange="agEvHora('hf',this.value)" aria-label="Fim"></span>
      <span class="ate" id="ev-ate-d" ${f.data_fim || f.dia_inteiro ? '' : 'hidden'}>até</span>
      <input type="date" id="ev-data-fim" value="${esc(f.data_fim || f.data)}" ${f.data_fim || f.dia_inteiro ? '' : 'hidden'} onchange="agenda.ev.f.data_fim=this.value" aria-label="Último dia">
      <label class="check"><input type="checkbox" id="ev-dia" ${f.dia_inteiro ? 'checked' : ''} onchange="agEvDiaInteiro(this.checked)"> <span>Dia inteiro</span></label>
      <select id="ev-rep" onchange="agenda.ev.f.recorrencia=this.value;document.getElementById('ev-rep-ate').hidden=this.value==='Única'" aria-label="Repetição">
        ${AG_REPETE.map(([k, l]) => `<option value="${k}" ${f.recorrencia === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <span id="ev-rep-ate" ${f.recorrencia === 'Única' ? 'hidden' : ''}><span class="ate">até</span><input type="date" value="${esc(f.repetir_ate)}"
        onchange="agenda.ev.f.repetir_ate=this.value" aria-label="Repetir até"></span>
    </div>
    <div class="evp-cols">
      <div class="evp-det">
        ${pd.length ? `<div class="evp-lin">${ic('agenda')}<select id="ev-pd" onchange="agAplicarPredefinido(this.value)" aria-label="Evento predefinido">
          <option value="">Sem evento predefinido</option>${pd.map(p => `<option value="${esc(p.id)}" ${f.predefinido_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select>
          ${dica('Um evento predefinido preenche duração, local, convidados e notificações. A lista fica em Agenda › Configurações.')}</div>` : ''}
        <div class="evp-lin">${ic('local')}<div class="evp-local">
          ${(agenda.espacos || []).length ? `<select id="ev-esp" onchange="agenda.ev.f.espaco_id=this.value;document.getElementById('ev-local').hidden=!!this.value" aria-label="Sala">
            <option value="">Outro local</option>${agenda.espacos.map(e => `<option value="${e.id}" ${String(f.espaco_id) === String(e.id) ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select>` : ''}
          <input id="ev-local" placeholder="Local" value="${esc(f.local)}" ${f.espaco_id ? 'hidden' : ''} oninput="agenda.ev.f.local=this.value" aria-label="Local"></div></div>
        <div class="evp-lin">${ic('video')}<input id="ev-meet" type="url" placeholder="Link da chamada (Meet)" value="${esc(f.meet_url)}" oninput="agenda.ev.f.meet_url=this.value" aria-label="Link da chamada">
          <a class="btn ghost mini" href="https://meet.google.com/new" target="_blank" rel="noopener">Criar no Meet</a></div>
        <div class="evp-lin top">${ic('sino')}<div class="evp-lemb" id="ev-lemb">${agLembretesHTML()}</div></div>
        <div class="evp-lin">${ic('eye')}<select id="ev-vis" onchange="agenda.ev.f.visibilidade=this.value" aria-label="Visibilidade">
          ${Object.entries(AG_VIS).map(([k, l]) => `<option value="${k}" ${f.visibilidade === k ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <span class="evp-cores" role="group" aria-label="Cor">${['', ...AG_CORES].map(c => `<button type="button" class="${(f.cor || '') === c ? 'on' : ''}"
            style="--cc:${c || 'transparent'}" title="${c ? 'Cor ' + c : 'A cor do tipo'}" aria-label="${c ? 'Cor ' + c : 'A cor do tipo'}" onclick="agEvCor('${c}', this)">${c ? '' : 'A'}</button>`).join('')}</span></div>
        <div class="evp-lin top">${ic('texto')}<textarea id="ev-desc" rows="6" placeholder="Descrição" oninput="agenda.ev.f.descricao=this.value" aria-label="Descrição">${esc(f.descricao)}</textarea></div>
        ${ev.novo ? '' : `<p class="evp-rodape">${ev.numero ? `EVT-${String(ev.numero).padStart(3, '0')}. ` : ''}Organização: ${esc(ev.organizador || 'não informada')}.
          <a href="${esc(agLinkGoogle())}" target="_blank" rel="noopener">Adicionar ao Google Agenda</a></p>`}
        ${agRsvpHTML()}
      </div>
      <aside class="evp-conv">
        <h3>Convidados <span class="n" id="ev-conv-n"></span></h3>
        <div class="evp-add"><input id="ev-busca" placeholder="Pessoa, grupo ou e-mail" autocomplete="off" oninput="agBuscaConv(this.value)"
          onkeydown="if(event.key==='Enter'){event.preventDefault();agAddPrimeiro()}" aria-label="Adicionar convidados">
          <div class="evp-res" id="ev-res" hidden></div></div>
        <div id="ev-conv-lista"></div>
        <div class="evp-disp"><div class="evp-disp-topo"><h4>Disponibilidade</h4>
          <button class="btn ghost mini" onclick="agProximoLivre()">Próximo horário livre</button></div>
          <div id="ev-disp"><div class="carregando" style="padding:12px 0"><span class="spin"></span></div></div></div>
      </aside>
    </div></div>`;
  agConvDesenhar();
  agDispCarregar();
}

/* ---------- a leitura, para quem foi convidado ---------- */
function agEventoLeitura(volta){
  const ev = agenda.ev, f = ev.f;
  const quando = (f.data_fim && f.data_fim !== f.data ? `${agCap(agDataLonga(f.data))} a ${agDataLonga(f.data_fim)}` : agCap(agDataLonga(f.data, true)))
    + (f.dia_inteiro ? '' : `, ${f.hi} – ${f.hf}`);
  const esp = (agenda.espacos || []).find(e => String(e.id) === String(f.espaco_id))?.nome;
  const conv = [...ev.conv];
  const conta = k => conv.filter(([, v]) => v.resposta === k).length + ev.ext.filter(x => x.resposta === k).length;
  $('#main').innerHTML = `<div class="evp leitura">
    <div class="evp-topo"><a class="icon-btn" href="${volta}" title="Voltar à agenda" aria-label="Voltar à agenda">${ic('x')}</a>
      <span class="evp-cor" style="--cc:${esc(ev.corEvento || '#2DD4BF')}"></span>
      <h1 class="evp-tit ${ev.cancelado ? 'riscado' : ''}">${esc(f.titulo || '(sem título)')}</h1></div>
    ${ev.cancelado ? '<div class="aviso-box err">Evento cancelado.</div>' : ''}
    <div class="evp-cols"><div class="evp-det">
      <div class="evp-lin">${ic('relogio')}<span>${esc(quando)}${f.recorrencia !== 'Única' ? `<span class="evp-sub">${esc(AG_REPETE.find(r => r[0] === f.recorrencia)?.[1] || f.recorrencia)}</span>` : ''}</span></div>
      ${esp || f.local ? `<div class="evp-lin">${ic('local')}<span>${esc(esp || f.local)}</span></div>` : ''}
      ${f.meet_url ? `<div class="evp-lin">${ic('video')}<a class="btn solid mini" href="${esc(f.meet_url)}" target="_blank" rel="noopener">Entrar na chamada</a>
        <span class="evp-sub">${esc(f.meet_url.replace(/^https?:\/\//, ''))}</span></div>` : ''}
      ${f.lembretes.length ? `<div class="evp-lin">${ic('sino')}<span>${f.lembretes.map(agRotuloLembrete).join(', ')}</span></div>` : ''}
      <div class="evp-lin">${ic('eye')}<span>${AG_VIS[f.visibilidade]}</span></div>
      ${f.descricao ? `<div class="evp-lin top">${ic('texto')}<div class="evp-desc">${esc(f.descricao)}</div></div>` : ''}
      <p class="evp-rodape">${ev.numero ? `EVT-${String(ev.numero).padStart(3, '0')}. ` : ''}Organização: ${esc(ev.organizador || 'não informada')}.
        <a href="${esc(agLinkGoogle())}" target="_blank" rel="noopener">Adicionar ao Google Agenda</a></p>
      ${agRsvpHTML()}
    </div>
    <aside class="evp-conv"><h3>Convidados <span class="n">${conv.length + ev.ext.length}</span></h3>
      <p class="evp-sub">${[['vou', 'sim'], ['talvez', 'talvez'], ['nao', 'não'], ['pendente', 'aguardando']].map(([k, l]) => conta(k) ? `${conta(k)} ${l}` : '').filter(Boolean).join(', ')}</p>
      ${conv.map(([r, v]) => agConvLinha(r, v, false)).join('')}
      ${ev.ext.map(x => agExtLinha(x, false)).join('')}</aside></div></div>`;
}
/* A resposta de quem foi convidado — organizador não responde. */
function agRsvpHTML(){
  const ev = agenda.ev;
  if (ev.novo || !ev.minha || ev.cancelado || ev.dono === agEu()) return '';
  return `<div class="evp-rsvp"><span>Você vai?</span><div class="seg" role="group" aria-label="Resposta">${['vou', 'talvez', 'nao'].map(r =>
    `<button class="${ev.minha === r ? 'on' : ''}" aria-pressed="${ev.minha === r}" onclick="agResponder('${r}')">${AG_RESP[r][0]}</button>`).join('')}</div></div>`;
}
async function agResponder(r){
  const { data, error } = await sb.rpc('agenda_responder', { p_id: agenda.ev.id, p_resposta: r });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível responder'), true);
  agenda.ev.minha = r; const eu = agenda.ev.conv.get(agEu()); if (eu) eu.resposta = r;
  toast(`Resposta registrada: ${AG_RESP[r][0]}.`); agEventoDesenhar();
}
function agLinkGoogle(){
  const f = agenda.ev.f, dia = s => String(s || '').replace(/-/g, '');
  const p = new URLSearchParams({ action:'TEMPLATE', text: f.titulo || 'Evento' });
  if (f.dia_inteiro){ const fim = dataHora(f.data_fim || f.data, 12*60); fim.setDate(fim.getDate() + 1); p.set('dates', `${dia(f.data)}/${dia(isoDia(fim))}`); }
  else { p.set('dates', `${dia(f.data)}T${f.hi.replace(':', '')}00/${dia(f.data_fim || f.data)}T${f.hf.replace(':', '')}00`); p.set('ctz', 'America/Sao_Paulo'); }
  const esp = (agenda.espacos || []).find(e => String(e.id) === String(f.espaco_id))?.nome;
  if (esp || f.local) p.set('location', esp || f.local);
  const det = [f.descricao, f.meet_url].filter(Boolean).join('\n\n'); if (det) p.set('details', det);
  return 'https://calendar.google.com/calendar/render?' + p.toString();
}

/* ---------- os campos ---------- */
function agEvData(v){
  const f = agenda.ev.f, dur = f.data_fim ? (dataHora(f.data_fim, 0) - dataHora(f.data, 0)) / 864e5 : 0;
  f.data = v;
  if (dur > 0){ const d = dataHora(v, 720); d.setDate(d.getDate() + dur); f.data_fim = isoDia(d); const x = $('#ev-data-fim'); if (x) x.value = f.data_fim; }
  agDispCarregar();
}
function agEvHora(k, v){
  const f = agenda.ev.f;
  if (k === 'hi'){ const dur = hhmmMin(f.hf) - hhmmMin(f.hi); f.hi = v; f.hf = minHHMM(Math.min(hhmmMin(v) + Math.max(dur, 15), 24*60 - 1)); $('#ev-hf').value = f.hf; }
  else f.hf = v;
  agDispDesenhar();
}
function agEvDiaInteiro(on){
  const f = agenda.ev.f; f.dia_inteiro = on;
  $('#ev-horas').hidden = on; $('#ev-data-fim').hidden = !on && !f.data_fim; $('#ev-ate-d').hidden = !on && !f.data_fim;
  if (on && !f.data_fim) f.data_fim = '';
  agDispDesenhar();
}
function agEvCor(c, bt){ agenda.ev.f.cor = c; bt.parentElement.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === bt)); }
function agLembretesHTML(){
  const l = agenda.ev.f.lembretes;
  return l.map((m, i) => `<span class="evp-lemb-l">E-mail e notificação: <select onchange="agenda.ev.f.lembretes[${i}]=+this.value" aria-label="Notificação">
      ${[...new Set([...AG_LEMBRETES, m])].sort((a, b) => a - b).map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${agRotuloLembrete(x)}</option>`).join('')}</select>
      ${ibtn('x', 'Tirar a notificação', `agenda.ev.f.lembretes.splice(${i},1);document.getElementById('ev-lemb').innerHTML=agLembretesHTML()`, 'sm')}</span>`).join('')
    + (l.length < 5 ? `<button type="button" class="evp-link" onclick="agenda.ev.f.lembretes.push(${l.length ? 1440 : 30});document.getElementById('ev-lemb').innerHTML=agLembretesHTML()">Adicionar notificação</button>` : '');
}
function agAplicarPredefinido(id, silencioso){
  const ev = agenda.ev, f = ev.f, pd = (agenda.predef || []).find(p => p.id === id);
  f.predefinido_id = id || '';
  if (!pd){ if (!silencioso) agEventoDesenhar(); return; }
  if (!f.titulo || (agenda.predef || []).some(p => f.titulo === (p.titulo || p.nome))) f.titulo = pd.titulo || pd.nome;
  f.dia_inteiro = !!pd.dia_inteiro;
  if (pd.hora_inicio) f.hi = pd.hora_inicio.slice(0, 5);
  if (!f.dia_inteiro) f.hf = minHHMM(Math.min(hhmmMin(f.hi) + (pd.duracao_min || 60), 24*60 - 1));
  if (pd.local) f.local = pd.local;
  if (pd.espaco_id) f.espaco_id = String(pd.espaco_id);
  if (pd.meet_url) f.meet_url = pd.meet_url;
  if (pd.descricao && !f.descricao) f.descricao = pd.descricao;
  f.visibilidade = pd.visibilidade || f.visibilidade;
  f.lembretes = [...(pd.lembretes || [])];
  if (pd.recorrencia && pd.recorrencia !== 'Única') f.recorrencia = pd.recorrencia;
  agConvidadosDoPredefinido(pd).obrigatorios.forEach(r => { if (!ev.conv.has(r)) ev.conv.set(r, { nome: nomeDe(r), opcional:false, resposta:'pendente' }); });
  if (!silencioso) agEventoDesenhar();
}

/* ---------- convidados ---------- */
function agConvLinha(r, v, pode){
  const m = (state.membros || []).find(x => x.registro === r) || { registro:r, nome:v.nome };
  const [rot, cls, sim] = AG_RESP[v.resposta || 'pendente'] || AG_RESP.pendente;
  return `<div class="evp-p">${avatarFoto(m, 30, 11)}<span class="rs ${cls}" title="${rot}">${sim}</span>
    <span class="tx"><span class="nm">${esc(m.nome)}</span><span class="sb">${r === agenda.ev.dono ? 'Organiza' : v.opcional ? 'Opcional' : rot}</span></span>
    ${pode && r !== agenda.ev.dono ? `<button type="button" class="evp-op" onclick="agConvOpcional(${r})" title="${v.opcional ? 'Tornar obrigatório' : 'Tornar opcional'}">${v.opcional ? 'opcional' : 'obrigatório'}</button>
      ${ibtn('x', 'Tirar ' + esc(m.nome), `agConvTirar(${r})`, 'sm')}` : ''}</div>`;
}
function agExtLinha(x, pode, i){
  const [rot, cls, sim] = AG_RESP[x.resposta || 'pendente'] || AG_RESP.pendente;
  return `<div class="evp-p"><span class="avx" style="width:30px;height:30px;font-size:11px">${esc((x.nome || x.email || '?').slice(0, 2).toUpperCase())}</span>
    <span class="rs ${cls}" title="${rot}">${sim}</span>
    <span class="tx"><span class="nm">${esc(x.nome || x.email)}</span><span class="sb">${x.nome && x.email ? esc(x.email) + ', ' : ''}externo</span></span>
    ${pode ? ibtn('x', 'Tirar ' + esc(x.email), `agenda.ev.ext.splice(${i},1);agConvDesenhar()`, 'sm') : ''}</div>`;
}
function agConvDesenhar(){
  const ev = agenda.ev, conv = [...ev.conv].sort(([a], [b]) => (b === ev.dono) - (a === ev.dono) || nomeDe(a).localeCompare(nomeDe(b), 'pt-BR'));
  const n = $('#ev-conv-n'); if (n) n.textContent = conv.length + ev.ext.length;
  const el = $('#ev-conv-lista'); if (!el) return;
  el.innerHTML = conv.map(([r, v]) => agConvLinha(r, v, true)).join('') + ev.ext.map((x, i) => agExtLinha(x, true, i)).join('');
  agDispDesenhar();
}
function agConvOpcional(r){ const v = agenda.ev.conv.get(r); v.opcional = !v.opcional; agConvDesenhar(); }
function agConvTirar(r){ agenda.ev.conv.delete(r); agConvDesenhar(); agDispCarregar(); }
function agOpcoesConv(q){
  const t = norm(q).trim(); if (!t) return [];
  const ev = agenda.ev, out = [];
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(q.trim()) && !ev.ext.some(x => x.email === q.trim().toLowerCase()))
    out.push({ tipo:'email', id:q.trim().toLowerCase(), rot:q.trim(), sub:'Convidar por e-mail (de fora da equipe)' });
  gruposDaEquipe().filter(g => norm(g).includes(t)).slice(0, 4).forEach(g => {
    const n = membrosDoGrupo(g).filter(m => !ev.conv.has(m.registro)).length;
    if (n) out.push({ tipo:'grupo', id:g, rot:g, sub:`Grupo, ${n} pessoa${n === 1 ? '' : 's'}` });
  });
  (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação', 'Sob demanda'].includes(m.status) && !ev.conv.has(m.registro)
    && (norm(m.nome).includes(t) || norm(m.email_nro || '').includes(t))).slice(0, 7)
    .forEach(m => out.push({ tipo:'pessoa', id:m.registro, rot:m.nome, sub:m.cargo || m.departamento || '', m }));
  return out;
}
function agBuscaConv(q){
  const el = $('#ev-res'), op = agOpcoesConv(q);
  agenda.ev.busca = q; agenda.ev.opcoes = op;
  el.hidden = !q.trim();
  el.innerHTML = op.map((o, i) => `<button type="button" onmousedown="event.preventDefault()" onclick="agAddConv(${i})">
      ${o.m ? avatarFoto(o.m, 24, 9) : `<span class="ic-o">${ic(o.tipo === 'grupo' ? 'users' : 'email')}</span>`}
      <span class="tx"><span class="nm">${esc(o.rot)}</span><span class="sb">${esc(o.sub)}</span></span></button>`).join('')
    || '<p class="evp-sub" style="padding:8px 10px">Nenhuma pessoa ou grupo. Para alguém de fora, digite o e-mail.</p>';
}
function agAddPrimeiro(){ if ((agenda.ev.opcoes || []).length) agAddConv(0); }
function agAddConv(i){
  const ev = agenda.ev, o = ev.opcoes[i]; if (!o) return;
  if (o.tipo === 'pessoa') ev.conv.set(o.id, { nome:o.rot, opcional:false, resposta:'pendente' });
  if (o.tipo === 'grupo') membrosDoGrupo(o.id).forEach(m => { if (!ev.conv.has(m.registro)) ev.conv.set(m.registro, { nome:m.nome, opcional:false, resposta:'pendente' }); });
  if (o.tipo === 'email') ev.ext.push({ email:o.id, nome:'', resposta:'pendente' });
  const b = $('#ev-busca'); b.value = ''; $('#ev-res').hidden = true; b.focus();
  agConvDesenhar(); agDispCarregar();
}

/* ---------- disponibilidade: a ocupação de cada convidado no dia ---------- */
const AG_D0 = 7, AG_D1 = 21;
async function agDispCarregar(){
  const ev = agenda.ev, el = $('#ev-disp'); if (!el) return;
  const regs = [...ev.conv.keys()];
  const de = dataHora(ev.f.data, 0), ate = new Date(de.getTime() + 864e5);
  if (!agenda.agendas) await sb.from('portal_agendas').select('registro,conectado,ativo,expediente_inicio,expediente_fim,dias_uteis')
    .then(r => { agenda.agendas = {}; (r.data || []).forEach(a => agenda.agendas[a.registro] = a); }, () => { agenda.agendas = {}; });
  const { data, error } = await sb.rpc('portal_agenda_ocupacao', { p_registros: regs, p_de: de.toISOString(), p_ate: ate.toISOString() });
  ev.ocup = {}; regs.forEach(r => ev.ocup[r] = []);
  if (!error) (data || []).forEach(b => (ev.ocup[b.registro] ||= []).push({ i:new Date(b.inicio).getTime(), f:new Date(b.fim).getTime(), t:b.titulo, o:b.origem }));
  ev.ocupDia = ev.f.data; ev.ocupErro = error?.message || null;
  agDispDesenhar();
}
function agDispDesenhar(){
  const ev = agenda.ev, el = $('#ev-disp'); if (!el || !ev.ocup) return;
  const pct = m => ((m - AG_D0 * 60) / ((AG_D1 - AG_D0) * 60)) * 100;
  const d0 = dataHora(ev.f.data, 0).getTime();
  const selI = ev.f.dia_inteiro ? AG_D0 * 60 : hhmmMin(ev.f.hi), selF = ev.f.dia_inteiro ? AG_D1 * 60 : hhmmMin(ev.f.hf);
  const linha = r => {
    const blocos = (ev.ocup[r] || []).filter(b => !(agenda.ev.id && b.o === 'soma' && b.t === ev.orig?.titulo && ev.ocupDia === ev.orig?.data));
    const conflito = blocos.some(b => b.i < d0 + selF * 6e4 && b.f > d0 + selI * 6e4);
    return `<div class="evd-l"><span class="evd-n" title="${esc(nomeDe(r))}">${esc(primeiroNome(nomeDe(r)))}${conflito ? ' <span class="evd-x" title="Ocupado neste horário">●</span>' : ''}</span>
      <span class="evd-t">${blocos.map(b => { const a = Math.max(AG_D0 * 60, (b.i - d0) / 6e4), z = Math.min(AG_D1 * 60, (b.f - d0) / 6e4);
        return z > a ? `<i class="${b.o || ''}" style="left:${pct(a)}%;width:${pct(z) - pct(a)}%" title="${esc(b.t || 'Ocupado')}"></i>` : ''; }).join('')}</span></div>`;
  };
  const regs = [...ev.conv.keys()];
  el.innerHTML = `<div class="evd" onclick="agDispClique(event)">
    <div class="evd-regua">${Array.from({ length: AG_D1 - AG_D0 + 1 }, (_, i) => i % 2 === 0 ? `<span style="left:${pct((AG_D0 + i) * 60)}%">${AG_D0 + i}h</span>` : '').join('')}</div>
    <div class="evd-corpo">${regs.map(linha).join('')}
      <div class="evd-sel" style="left:calc(78px + (100% - 78px) * ${pct(selI) / 100});width:calc((100% - 78px) * ${(pct(selF) - pct(selI)) / 100})"></div></div></div>
    <p class="evp-sub">${esc(agCap(agDataLonga(ev.f.data)))}. ${ev.ocupErro ? 'Sem dados de ocupação.' : 'Clique na faixa para mudar o início.'}</p>`;
}
function agDispClique(e){
  const corpo = e.currentTarget.querySelector('.evd-corpo'), r = corpo.getBoundingClientRect();
  const nomes = corpo.querySelector('.evd-t'); if (!nomes) return;
  const t = nomes.getBoundingClientRect();
  if (e.clientX < t.left) return;
  const m = Math.round(((e.clientX - t.left) / t.width * (AG_D1 - AG_D0) * 60 + AG_D0 * 60) / 15) * 15;
  const f = agenda.ev.f; if (f.dia_inteiro) return;
  const dur = hhmmMin(f.hf) - hhmmMin(f.hi);
  f.hi = minHHMM(m); f.hf = minHHMM(Math.min(m + dur, 24*60 - 1));
  $('#ev-hi').value = f.hi; $('#ev-hf').value = f.hf; agDispDesenhar();
}
/* O primeiro horário, a partir de agora, em que todos os obrigatórios
   estão livres, dentro do expediente e nos próximos dez dias. */
async function agProximoLivre(){
  const ev = agenda.ev, f = ev.f;
  const dur = f.dia_inteiro ? 60 : Math.max(15, hhmmMin(f.hf) - hhmmMin(f.hi));
  const regs = [...ev.conv].filter(([, v]) => !v.opcional).map(([r]) => r);
  const de = new Date(); const ate = new Date(de.getTime() + 10 * 864e5);
  const { data, error } = await sb.rpc('portal_agenda_ocupacao', { p_registros: regs, p_de: de.toISOString(), p_ate: ate.toISOString() });
  if (error) return toast('Não foi possível consultar a disponibilidade.', true);
  const blocos = (data || []).map(b => [new Date(b.inicio).getTime(), new Date(b.fim).getTime()]);
  const ini = hhmmMin(EXPEDIENTE.inicio), fim = hhmmMin(EXPEDIENTE.fim);
  for (let d = 0; d < 10; d++){
    const dia = new Date(); dia.setDate(dia.getDate() + d);
    if (!EXPEDIENTE.dias.includes(isoDow(dia))) continue;
    const iso = isoDia(dia), base = dataHora(iso, 0).getTime();
    for (let m = ini; m + dur <= fim; m += 15){
      const a = base + m * 6e4, z = a + dur * 6e4;
      if (a < Date.now()) continue;
      if (!blocos.some(([i, fb]) => i < z && fb > a)){
        f.data = iso; f.dia_inteiro = false; f.hi = minHHMM(m); f.hf = minHHMM(m + dur);
        agEventoDesenhar(); toast(`Todos livres: ${fmtD(iso)}, ${f.hi}.`); return;
      }
    }
  }
  toast('Nenhum horário comum nos próximos dez dias úteis.', true);
}

/* ---------- salvar e excluir ---------- */
function agPayload(){
  const ev = agenda.ev, f = ev.f, o = ev.orig || {};
  const p = {};
  const muda = k => ev.novo || JSON.stringify(f[k]) !== JSON.stringify(o[k]);
  if (muda('titulo')) p.titulo = f.titulo.trim();
  if (muda('data')) p.data = f.data;
  if (muda('dia_inteiro') || muda('hi') || muda('hf')){
    if (f.dia_inteiro){ p.dia_inteiro = true; p.hora_inicio = ''; p.hora_fim = ''; }
    else { p.hora_inicio = f.hi; p.hora_fim = f.hf; }
  }
  if (muda('data_fim') || muda('dia_inteiro')) p.data_fim = f.data_fim && f.data_fim > f.data ? f.data_fim : '';
  if (muda('recorrencia')) p.recorrencia = f.recorrencia;
  if (muda('repetir_ate') || muda('recorrencia')) p.repetir_ate = f.recorrencia === 'Única' ? '' : f.repetir_ate;
  if (muda('local') || muda('espaco_id')){ p.local = f.espaco_id ? '' : f.local; p.espaco_id = f.espaco_id || ''; }
  if (muda('meet_url')) p.meet_url = f.meet_url.trim();
  if (muda('descricao')) p.descricao = f.descricao;
  if (muda('visibilidade')) p.visibilidade = f.visibilidade;
  if (muda('cor')) p.cor = f.cor;
  if (muda('predefinido_id')) p.predefinido_id = f.predefinido_id;
  if (muda('lembretes')) p.lembretes = [...new Set(f.lembretes)];
  const convAgora = JSON.stringify([...ev.conv].map(([r, v]) => [r, v.opcional]).sort());
  if (ev.novo || convAgora !== ev.convOrig){
    p.obrigatorios = [...ev.conv].filter(([, v]) => !v.opcional).map(([r]) => r);
    p.opcionais = [...ev.conv].filter(([, v]) => v.opcional).map(([r]) => r);
  }
  if (ev.novo || JSON.stringify(ev.ext.map(x => x.email).sort()) !== ev.extOrig) p.externos = ev.ext.map(x => ({ email:x.email, nome:x.nome }));
  return p;
}
async function agEventoSalvar(){
  const ev = agenda.ev, f = ev.f;
  if (!f.data) return toast('Escolha a data.', true);
  if (!f.dia_inteiro && hhmmMin(f.hf) <= hhmmMin(f.hi) && !(f.data_fim > f.data)) return toast('O fim precisa ser depois do início.', true);
  const p = agPayload();
  if (!ev.novo && !Object.keys(p).length){ toast('Nada mudou.'); return; }
  const outros = ev.conv.size + ev.ext.length > 1;
  let escolha = { aplicar:'este', notificar:true };
  if (!ev.novo){ escolha = await agPerguntarSalvar({ serie: ev.serie && !('recorrencia' in p), convidados: outros, verbo:'Salvar' }); if (!escolha) return; }
  Object.assign(p, { notificar: escolha.notificar, aplicar: escolha.aplicar });
  if (!ev.novo) p.id = ev.id;
  const b = $('#ev-salvar'); if (b){ b.disabled = true; b.textContent = 'Salvando…'; }
  const { data, error } = await sb.rpc('agenda_evento_salvar', { p });
  if (b){ b.disabled = false; b.textContent = 'Salvar'; }
  const msg = { data:'Escolha a data.', horario:'O fim precisa ser depois do início.', recorrencia:'Repetição inválida.', cor:'Cor inválida.' };
  if (error || data?.status !== 'ok') return toast(msg[data?.campo] || motivoRPC(data, error, 'Não foi possível salvar'), true);
  const convidou = ev.novo ? (data.convidados || 1) - 1 + ev.ext.length : (data.entraram || 0);
  toast(ev.novo ? (convidou && escolha.notificar ? `Evento criado. Convite enviado a ${convidou} pessoa${convidou === 1 ? '' : 's'}.` : 'Evento criado.')
    : data.mudou?.length && escolha.notificar && outros ? 'Evento salvo. Os convidados foram avisados.' : 'Evento salvo.');
  agenda.janela = null;
  location.hash = agHref(agenda.visao || (agMovel() ? 'dia' : 'semana'), dataHora(f.data, 720));
}
async function agEventoExcluir(){
  const ev = agenda.ev;
  const outros = ev.conv.size + ev.ext.length > 1;
  const escolha = ev.serie || outros ? await agPerguntarSalvar({ serie: ev.serie, convidados: outros, verbo:'Excluir' })
    : (await confirma('Excluir este evento?', 'Excluir')) && { aplicar:'este', notificar:true };
  if (!escolha) return;
  const { data, error } = await sb.rpc('agenda_evento_excluir', { p: { id: ev.id, aplicar: escolha.aplicar, notificar: escolha.notificar } });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível excluir'), true);
  toast(data.eventos > 1 ? `${data.eventos} eventos excluídos.` : 'Evento excluído.');
  location.hash = agHref(agenda.visao || 'semana', agenda.ref || dataHora(ev.f.data, 720));
}

/* ============================================================
   CONFIGURAÇÕES — #/agenda/config[/predefinidos|google]
   ============================================================ */
async function agConfig(aba){
  aba = ['predefinidos', 'google'].includes(aba) ? aba : '';
  $('#main').innerHTML = `<div class="carregando"><span class="spin"></span></div>`;
  agenda.predef = null; await agPreparar();
  const topo = `<div class="topo-gestao"><div style="padding-top:34px"><a class="icon-btn" href="#/agenda" title="Voltar à agenda" aria-label="Voltar à agenda">${ic('back')}</a></div>
      <div class="tx"><span class="eyebrow">Agenda</span><h1>Configurações</h1></div></div>
    ${navNivel1([['', 'Geral', '#/agenda/config'], ['predefinidos', 'Eventos predefinidos', '#/agenda/config/predefinidos'],
      ['google', 'Google Agenda', '#/agenda/config/google']], aba, 'Configurações da agenda')}
    <div id="agc-corpo"></div>`;
  $('#main').innerHTML = topo;
  if (aba === 'predefinidos') return agCfgPredefinidos();
  if (aba === 'google') return agCfgGoogle();
  agCfgGeral();
}
function agCfgGeral(){
  const p = agenda.pref, l = [...(p.lembretes || [])];
  agenda._lembPadrao = l;
  $('#agc-corpo').innerHTML = !agEu() ? '<div class="aviso-box info">Conta sem vínculo com um registro de membro.</div>' : `<div class="agc-grid">
    <div class="card"><h3>E-mails da agenda</h3>
      <label class="check" style="margin-top:12px"><input type="checkbox" id="agc-emails" ${p.emails !== false ? 'checked' : ''}>
        <span>Receber por e-mail convites, alterações, cancelamentos e lembretes</span></label>
      <p class="small muted" style="margin-top:8px">Sem e-mail, tudo continua no sino.</p></div>
    <div class="card"><h3>Notificação padrão ${dica('Vale para os eventos que você criar. Cada evento pode ter as suas.')}</h3>
      <div class="evp-lemb" id="agc-lemb" style="margin-top:12px">${agLembPadraoHTML()}</div></div>
    <div class="card"><h3>Visão inicial</h3>
      <div class="seg" role="group" aria-label="Visão inicial" style="margin-top:12px">${[['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês']].map(([k, lb]) =>
        `<button class="${agLer('visao', 'semana') === k ? 'on' : ''}" onclick="agGuardar('visao','${k}');this.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===this))">${lb}</button>`).join('')}</div>
      <p class="small muted" style="margin-top:8px">No celular a agenda abre no dia.</p></div>
  </div>
  <div class="acts"><button class="btn solid" onclick="agCfgSalvarGeral()">${ic('check')} Salvar</button></div>`;
}
function agLembPadraoHTML(){
  const l = agenda._lembPadrao;
  return l.map((m, i) => `<span class="evp-lemb-l"><select onchange="agenda._lembPadrao[${i}]=+this.value" aria-label="Notificação">
      ${AG_LEMBRETES.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${agRotuloLembrete(x)}</option>`).join('')}</select>
      ${ibtn('x', 'Tirar', `agenda._lembPadrao.splice(${i},1);document.getElementById('agc-lemb').innerHTML=agLembPadraoHTML()`, 'sm')}</span>`).join('')
    + (l.length < 5 ? `<button type="button" class="evp-link" onclick="agenda._lembPadrao.push(30);document.getElementById('agc-lemb').innerHTML=agLembPadraoHTML()">Adicionar notificação</button>` : '');
}
async function agCfgSalvarGeral(){
  const d = { registro: agEu(), emails: $('#agc-emails').checked, lembretes: [...new Set(agenda._lembPadrao)], atualizado_em: new Date().toISOString() };
  const { error } = await sb.from('agenda_preferencias').upsert(d, { onConflict:'registro' });
  if (error) return toast('Não foi possível salvar: ' + error.message, true);
  agenda.pref = d; toast('Configurações salvas.');
}

/* ---------- eventos predefinidos ---------- */
function agCfgPredefinidos(){
  const lista = agenda.predef || [];
  const grupos = ids => (ids || []).map(id => grupoPorId(id)?.nome).filter(Boolean);
  $('#agc-corpo').innerHTML = `<div class="filtros" style="justify-content:space-between;align-items:center">
      <p class="small muted" style="margin:0">Usados ao criar um evento: preenchem duração, local, convidados e notificações.</p>
      ${can() ? `<button class="btn solid mini" onclick="agPdEditar()">${ic('plus')} Novo</button>` : ''}</div>
    ${lista.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Nome</th><th>Duração</th><th>Convidados</th><th>Notificações</th><th>Local</th><th></th></tr></thead>
      <tbody>${lista.map(p => `<tr class="${can() ? 'click' : ''}" ${can() ? `tabindex="0" onclick="agPdEditar('${p.id}')" onkeydown="if(event.key==='Enter')this.click()"` : ''}>
        <td class="nome"><span class="agc-pt" style="--cc:${esc(p.cor)}"></span>${esc(p.nome)}</td>
        <td>${p.dia_inteiro ? 'Dia inteiro' : (p.duracao_min >= 60 && p.duracao_min % 60 === 0 ? p.duracao_min / 60 + ' h' : p.duracao_min + ' min')}${p.hora_inicio ? ', ' + p.hora_inicio.slice(0, 5) : ''}</td>
        <td style="white-space:normal">${p.todos ? 'Toda a equipe' : [...grupos(p.grupos), ...(p.convidados || []).map(r => primeiroNome(nomeDe(r)))].map(esc).join(', ') || '<span class="dim">—</span>'}</td>
        <td>${(p.lembretes || []).map(agRotuloLembrete).join(', ') || '<span class="dim">nenhuma</span>'}</td>
        <td>${esc((agenda.espacos || []).find(e => e.id === p.espaco_id)?.nome || p.local || '—')}</td>
        <td>${can() ? ic('chevron') : ''}</td></tr>`).join('')}</tbody></table></div>`
      : `<div class="vazio"><h3>Nenhum evento predefinido</h3>${can() ? `<button class="btn solid" onclick="agPdEditar()">Criar o primeiro</button>` : ''}</div>`}`;
}
function agPdEditar(id){
  if (!can()) return;
  const p = (agenda.predef || []).find(x => x.id === id) || { nome:'', titulo:'', duracao_min:60, dia_inteiro:false, hora_inicio:null, local:'',
    espaco_id:null, meet_url:'', descricao:'', visibilidade:'convidados', cor:'#2DD4BF', todos:false, grupos:[], convidados:[], lembretes:[30], recorrencia:'Única', ordem:100 };
  agenda.pd = { id: p.id || null, grupos:new Set(p.grupos || []), pessoas:new Set(p.convidados || []), lembretes:[...(p.lembretes || [])], cor:p.cor };
  const ativos = (state.membros || []).filter(m => ['Ativo', 'Em pausa / avaliação'].includes(m.status)).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  abreModal(`<h3>${p.id ? esc(p.nome) : 'Novo evento predefinido'}</h3>
    <div class="form-grid">
      <div class="fld"><label for="pd-nome">Nome</label><input id="pd-nome" maxlength="80" value="${esc(p.nome)}" placeholder="Reunião de gerência"></div>
      <div class="fld"><label for="pd-tit">Título padrão</label><input id="pd-tit" maxlength="160" value="${esc(p.titulo || '')}" placeholder="o nome"></div>
      <div class="fld"><label for="pd-dur">Duração (min)</label><input id="pd-dur" type="number" min="5" max="1440" step="5" value="${p.duracao_min}"></div>
      <div class="fld"><label for="pd-hora">Início sugerido</label><input id="pd-hora" type="time" step="900" value="${esc((p.hora_inicio || '').slice(0, 5))}"></div>
      <div class="fld full"><label class="check"><input type="checkbox" id="pd-dia" ${p.dia_inteiro ? 'checked' : ''}> <span>Dia inteiro</span></label></div>
      <div class="fld"><label for="pd-esp">Sala</label><select id="pd-esp"><option value="">Nenhuma</option>${(agenda.espacos || []).map(e =>
        `<option value="${e.id}" ${p.espaco_id === e.id ? 'selected' : ''}>${esc(e.nome)}</option>`).join('')}</select></div>
      <div class="fld"><label for="pd-local">Outro local</label><input id="pd-local" value="${esc(p.local || '')}"></div>
      <div class="fld full"><label for="pd-meet">Link da chamada</label><input id="pd-meet" type="url" value="${esc(p.meet_url || '')}"></div>
      <div class="fld"><label for="pd-vis">Visibilidade</label><select id="pd-vis">${Object.entries(AG_VIS).map(([k, l]) =>
        `<option value="${k}" ${p.visibilidade === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld"><label for="pd-rep">Repetição</label><select id="pd-rep">${AG_REPETE.map(([k, l]) =>
        `<option value="${k}" ${p.recorrencia === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      <div class="fld full"><label>Cor</label><span class="evp-cores" id="pd-cores">${AG_CORES.map(c => `<button type="button" class="${p.cor === c ? 'on' : ''}"
        style="--cc:${c}" aria-label="Cor ${c}" onclick="agenda.pd.cor='${c}';this.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===this))"></button>`).join('')}</span></div>
      <div class="fld full"><label>Notificações</label><div class="evp-lemb" id="pd-lemb">${agPdLembHTML()}</div></div>
      <div class="fld full"><label>Convidados</label>
        <label class="check"><input type="checkbox" id="pd-todos" ${p.todos ? 'checked' : ''}> <span>Toda a equipe ativa</span></label>
        <div class="chips" style="margin-top:8px">${(state.grupos || []).map(g => `<button type="button" class="chip-b${agenda.pd.grupos.has(g.id) ? ' on' : ''}"
          onclick="agenda.pd.grupos.has(${g.id})?agenda.pd.grupos.delete(${g.id}):agenda.pd.grupos.add(${g.id});this.classList.toggle('on')">${esc(g.nome)}</button>`).join('')}</div>
        <select id="pd-pessoas" multiple size="5" style="margin-top:8px;width:100%" aria-label="Pessoas">${ativos.map(m =>
          `<option value="${m.registro}" ${agenda.pd.pessoas.has(m.registro) ? 'selected' : ''}>${esc(m.nome)}</option>`).join('')}</select>
        <p class="mini">Grupos incluem quem está nos grupos abaixo deles. Ctrl/⌘ para marcar várias pessoas.</p></div>
      <div class="fld full"><label for="pd-desc">Descrição</label><textarea id="pd-desc" rows="3">${esc(p.descricao || '')}</textarea></div>
      <div class="fld"><label for="pd-ordem">Ordem na lista</label><input id="pd-ordem" type="number" value="${p.ordem ?? 100}"></div>
    </div>
    <p class="err-msg" id="pd-erro"></p>
    <div class="acts">${p.id ? `<button class="btn perigo" style="margin-right:auto" onclick="agPdDesativar('${p.id}')">Excluir</button>` : ''}
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button><button class="btn solid" onclick="agPdSalvar()">Salvar</button></div>`, 'largo');
}
function agPdLembHTML(){
  const l = agenda.pd.lembretes;
  return l.map((m, i) => `<span class="evp-lemb-l"><select onchange="agenda.pd.lembretes[${i}]=+this.value" aria-label="Notificação">
      ${AG_LEMBRETES.map(x => `<option value="${x}" ${x === m ? 'selected' : ''}>${agRotuloLembrete(x)}</option>`).join('')}</select>
      ${ibtn('x', 'Tirar', `agenda.pd.lembretes.splice(${i},1);document.getElementById('pd-lemb').innerHTML=agPdLembHTML()`, 'sm')}</span>`).join('')
    + (l.length < 5 ? `<button type="button" class="evp-link" onclick="agenda.pd.lembretes.push(${l.length ? 1440 : 30});document.getElementById('pd-lemb').innerHTML=agPdLembHTML()">Adicionar notificação</button>` : '');
}
async function agPdSalvar(){
  const x = agenda.pd, nome = $('#pd-nome').value.trim();
  if (!nome) return $('#pd-erro').textContent = 'O nome é obrigatório.';
  const d = { nome, titulo: $('#pd-tit').value.trim() || null, duracao_min: Math.max(5, Math.min(1440, +$('#pd-dur').value || 60)),
    hora_inicio: $('#pd-hora').value || null, dia_inteiro: $('#pd-dia').checked, espaco_id: $('#pd-esp').value ? +$('#pd-esp').value : null,
    local: $('#pd-local').value.trim() || null, meet_url: $('#pd-meet').value.trim() || null, visibilidade: $('#pd-vis').value,
    recorrencia: $('#pd-rep').value, cor: x.cor, lembretes: [...new Set(x.lembretes)], todos: $('#pd-todos').checked,
    grupos: [...x.grupos], convidados: [...$('#pd-pessoas').selectedOptions].map(o => +o.value),
    descricao: $('#pd-desc').value.trim() || null, ordem: +$('#pd-ordem').value || 100,
    atualizado_por: state.perfil?.nome || state.perfil?.email, atualizado_em: new Date().toISOString() };
  const q = x.id ? sb.from('agenda_predefinidos').update(d).eq('id', x.id) : sb.from('agenda_predefinidos').insert(d);
  const { error } = await q;
  if (error) return $('#pd-erro').textContent = /duplicate|unique/i.test(error.message) ? 'Já existe um com esse nome.' : 'Não foi possível salvar: ' + error.message;
  fechaModal(); toast('Evento predefinido salvo.'); agConfig('predefinidos');
}
async function agPdDesativar(id){
  if (!await confirma('Excluir este evento predefinido? Os eventos já criados com ele continuam.', 'Excluir')) return;
  const { error } = await sb.from('agenda_predefinidos').update({ ativo:false }).eq('id', id);
  if (error) return toast('Não foi possível excluir: ' + error.message, true);
  fechaModal(); toast('Excluído.'); agConfig('predefinidos');
}

/* ---------- o Google Agenda, nos dois sentidos ----------
   Sai: o feed da agenda da equipe, para assinar no Google.
   Entra: o endereço secreto do Google de cada um, para os colegas
   verem quando a pessoa está ocupada (sem ver do quê). */
async function agCarregarAgendas(){
  const { data } = await sb.from('portal_agendas')
    .select('registro,conectado,ativo,fuso,expediente_inicio,expediente_fim,dias_uteis,ultima_sync,ultimo_erro,blocos_sync,feed_token,compartilha_titulos');
  agenda.agendas = {}; (data || []).forEach(a => agenda.agendas[a.registro] = a);
}
async function agCfgGoogle(){
  const el = $('#agc-corpo');
  if (!agEu()){ el.innerHTML = '<div class="aviso-box info">Conta sem vínculo com um registro de membro.</div>'; return; }
  await agCarregarAgendas();
  const meu = agenda.agendas[agEu()] || null;
  const seg = await sb.from('portal_agenda_segredo').select('ics_url').eq('registro', agEu()).maybeSingle();
  const url = seg.data?.ics_url || '', conectado = !!meu?.conectado;
  const ex = { ini: meu?.expediente_inicio || EXPEDIENTE.inicio, fim: meu?.expediente_fim || EXPEDIENTE.fim,
    dias: meu?.dias_uteis?.length ? meu.dias_uteis : EXPEDIENTE.dias };
  const feed = meu?.feed_token ? FEED_BASE + meu.feed_token : null;
  const fusos = ['America/Sao_Paulo', 'America/Manaus', 'America/Belem', 'America/Fortaleza', 'America/Cuiaba', 'America/Rio_Branco', 'Europe/Lisbon', 'UTC'];
  let st = ['espera', 'Não conectado.'];
  if (conectado && meu.ultimo_erro) st = ['erro', 'Erro na última sincronização: ' + meu.ultimo_erro];
  else if (conectado && meu.ultima_sync) st = ['ok', `Sincronizado em ${fmtD(meu.ultima_sync.slice(0, 10))}, ${new Date(meu.ultima_sync).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}. ${meu.blocos_sync ?? 0} compromissos nos próximos 60 dias.`];
  else if (conectado) st = ['espera', 'Aguardando a primeira sincronização.'];
  el.innerHTML = `<div class="agc-grid dois">
    <div class="card"><h3>Assinar a agenda da equipe ${dica('No Google Agenda: Outras agendas › + › Inscrever-se no URL. O Google atualiza a assinatura a cada poucas horas.')}</h3>
      ${feed ? `<div class="feed-url"><input id="fd-url" readonly value="${esc(feed)}" onclick="this.select()" aria-label="Endereço da agenda">
          <button class="btn ghost" onclick="copiar(document.getElementById('fd-url').value)">Copiar</button></div>
        <button class="btn ghost mini" onclick="agGerarFeed(true)">Gerar outro endereço</button>
        <p class="mini" style="margin-top:6px">O endereço anterior deixa de funcionar.</p>`
      : `<div class="acts" style="justify-content:flex-start"><button class="btn solid" onclick="agGerarFeed(false)">Gerar o endereço</button></div>`}</div>
    <div class="card"><h3>Mostrar a sua ocupação ${dica('Google Agenda › Configurações › a sua agenda › Integrar agenda › Endereço secreto no formato iCal. Só você vê o endereço aqui.')}</h3>
      <div class="mag-status"><span class="dot ${st[0]}"></span><span>${esc(st[1])}</span>
        ${conectado ? `<button class="btn ghost mini" style="margin-left:auto" onclick="agSincronizar()">Sincronizar</button>` : ''}</div>
      <div class="fld"><label for="mag-url">Endereço secreto (iCal)</label><input id="mag-url" type="url" spellcheck="false" value="${esc(url)}"
        placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"></div>
      <label class="check"><input type="checkbox" id="mag-tit" ${meu?.compartilha_titulos ? 'checked' : ''}> <span>Mostrar o título dos compromissos aos colegas</span></label>
      <div class="dupla" style="margin-top:12px"><div class="fld"><label for="mag-ini">Expediente: início</label><input type="time" id="mag-ini" step="900" value="${esc(ex.ini.slice(0, 5))}"></div>
        <div class="fld"><label for="mag-fim">Fim</label><input type="time" id="mag-fim" step="900" value="${esc(ex.fim.slice(0, 5))}"></div></div>
      <div class="fld"><label>Dias</label><div class="mag-dias" id="mag-dias">${DIAS_LB.map((l, i) =>
        `<button type="button" class="${ex.dias.includes(i + 1) ? 'on' : ''}" data-d="${i + 1}" onclick="this.classList.toggle('on')">${l}</button>`).join('')}</div></div>
      <div class="fld"><label for="mag-fuso">Fuso horário</label><select id="mag-fuso">${fusos.map(f =>
        `<option ${f === (meu?.fuso || 'America/Sao_Paulo') ? 'selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
      <p class="err-msg" id="mag-erro"></p>
      <div class="acts">${conectado ? `<button class="btn perigo" style="margin-right:auto" onclick="agDesconectar()">Desconectar</button>` : ''}
        <button class="btn solid" id="mag-btn" onclick="agSalvarGoogle()">Salvar</button></div></div></div>`;
}
async function agGerarFeed(rotacionar){
  if (rotacionar && !await confirma('Gerar outro endereço? O atual para de funcionar, e quem assinou precisa assinar de novo.', 'Gerar')) return;
  const { data, error } = await sb.rpc('agenda_feed_token', { p_rotacionar: !!rotacionar });
  if (error || !data) return toast('Não foi possível gerar o endereço.', true);
  toast(rotacionar ? 'Endereço novo gerado.' : 'Endereço gerado.'); agCfgGoogle();
}
async function agSalvarGoogle(){
  const erro = $('#mag-erro'); erro.textContent = '';
  const dias = [...document.querySelectorAll('#mag-dias button.on')].map(b => +b.dataset.d);
  if (!dias.length) return erro.textContent = 'Escolha ao menos um dia.';
  const url = $('#mag-url').value.trim();
  $('#mag-btn').disabled = true;
  const { data, error } = await sb.rpc('portal_agenda_salvar', { p: { ics_url:url, compartilha_titulos: $('#mag-tit').checked, fuso: $('#mag-fuso').value,
    expediente_inicio: $('#mag-ini').value, expediente_fim: $('#mag-fim').value, dias_uteis: dias, ativo:true } });
  $('#mag-btn').disabled = false;
  const msgs = { sem_vinculo:'Conta sem vínculo com um registro de membro.', ics_url:'Endereço inválido: use o endereço secreto em formato iCal do Google Agenda (termina em .ics).',
    expediente:'O fim do expediente precisa ser depois do início.', dias_uteis:'Escolha ao menos um dia.' };
  if (error) return erro.textContent = 'Não foi possível salvar: ' + error.message;
  if (data?.status !== 'ok') return erro.textContent = msgs[data?.campo] || msgs[data?.status] || 'Não foi possível salvar.';
  toast('Salvo.'); if (url) await agSincronizar(); else agCfgGoogle();
}
async function agSincronizar(){
  toast('Sincronizando…');
  try{
    const { data, error } = await sb.functions.invoke('agenda-sync', { body:{} });
    if (error) throw error;
    const meu = (data?.resultados || []).find(r => r.erro && r.registro === agEu());
    toast(meu ? 'O Google recusou: ' + meu.erro : 'Sincronizado.', !!meu);
  }catch(e){ toast(/404|not found|Failed to send/i.test(String(e?.message || e)) ? 'A sincronização (agenda-sync) não está publicada.' : 'Falha ao sincronizar.', true); }
  agCfgGoogle();
}
async function agDesconectar(){
  if (!await confirma('Desconectar o Google Agenda? O endereço e os horários importados são apagados.', 'Desconectar')) return;
  const { error } = await sb.rpc('portal_agenda_desconectar');
  if (error) return toast('Não foi possível desconectar: ' + error.message, true);
  toast('Desconectado.'); agCfgGoogle();
}

/* ============================================================
   O QUE ESTE MÓDULO SABE ACHAR
   Os eventos do período aberto. O início e a busca da casca acham os
   da semana sem precisar deste módulo.
   ============================================================ */
registrarBusca({
  fonte:'agenda', rotulo:'Agenda',
  buscar: (t) => filtrarSimples(agenda.itens.filter(i => i.origem === 'evento').map(i => ({
    titulo: i.titulo, sub: `${fmtD(i.de)}${i.dia ? '' : ', ' + minHHMM(i.hi)}`, href: i.href })), t, 6)
});
