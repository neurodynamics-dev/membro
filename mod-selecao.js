/* ============================================================
   MÓDULO · SELEÇÃO — o processo seletivo, por dentro
   Veio do SOMA · Gestão (soma-legado.html, SOMA 7.0 a 12.0), com a
   lógica, os textos e as regras intactos e a marcação refeita para o
   portal. O site público (selecao.neurodynamics.dev) é o outro lado:
   inscrição, acompanhamento, agendamento e as três páginas da dinâmica
   leem daqui o que foi publicado.

   Rotas:
     #/selecao                        visão geral
     #/selecao/<aba>                  candidatos, avaliacao, agenda,
                                      dinamica, publicacoes, faq, config
     #/selecao/candidatos/<id>        a lista, com a ficha aberta
     #/selecao/dinamica/<sub>         painel, roteiro, desafio,
                                      criterios, janelas

   Papéis: admin, pessoal e selecao (Comitê de Seleção). A barreira de
   verdade é a RLS das tabelas ps_* (migrações soma_v06, v07, v11, v12).

   Depende da casca para: sb, $, esc, norm, state, can, podeSelecao,
   toast, falha, abreModal, fechaModal, confirma, copiar, abrirEmail,
   gmailCompose, fmtD, fmtDT, hojeISO, ic, ibtn, avatarFoto, nomeDe,
   quemSouEu, FOTOS_BASE, FOTO_EXTS, ABAS_SELECAO, route,
   registrarBusca, filtrarSimples.
   ============================================================ */

const SITE_PS = 'https://selecao.neurodynamics.dev';
const PS_ST = {
  inscrito:['Inscrito — em análise','dt-info'], indeferido:['Indeferido','dt-bad'],
  deferido:['Deferido','dt-ok'],
  reprovado_dinamica:['Reprovado · dinâmica','dt-bad'], aprovado_dinamica:['Aprovado · dinâmica','dt-ok'],
  reprovado_entrevista:['Reprovado · entrevista','dt-bad'], aprovado_entrevista:['Aprovado · entrevista','dt-ok'],
  trainee:['Trainee','dt-warn'], reprovado_final:['Reprovado · final','dt-bad'],
  aprovado_final:['Aprovado · final','dt-ok'], integrado:['Integrado','dt-ok'],
  desistente:['Desistente','dt-gray']
};
const PS_MOVS = [
  ['deferido','Deferir inscrição'], ['indeferido','Indeferir inscrição'],
  ['aprovado_dinamica','Aprovar na 1ª fase (dinâmica)'], ['reprovado_dinamica','Reprovar na 1ª fase (dinâmica)'],
  ['aprovado_entrevista','Aprovar na 2ª fase (entrevista)'], ['reprovado_entrevista','Reprovar na 2ª fase (entrevista)'],
  ['trainee','Iniciar período trainee'],
  ['aprovado_final','Aprovar no resultado final'], ['reprovado_final','Reprovar no resultado final'],
  ['desistente','Marcar como desistente']
];
const PS_FASES_AVAL = {
  dinamica:{lbl:'Dinâmica em grupo', el:['deferido','aprovado_dinamica','reprovado_dinamica'],
    crit:['Comunicação','Trabalho em equipe','Proatividade','Resolução de problemas','Alinhamento com a equipe']},
  entrevista:{lbl:'Entrevista individual', el:['aprovado_dinamica','aprovado_entrevista','reprovado_entrevista'],
    crit:['Motivação','Disponibilidade e comprometimento','Background técnico','Fit cultural','Clareza e comunicação']},
  desafio:{lbl:'Desafio trainee', el:['trainee','aprovado_final','reprovado_final','integrado'],
    crit:['Qualidade técnica','Cumprimento de prazos','Autonomia','Trabalho em grupo','Documentação']},
  parcial_1:{lbl:'1ª avaliação parcial', el:['trainee','aprovado_final','reprovado_final','integrado'],
    crit:['Assiduidade','Comprometimento','Evolução técnica','Trabalho em equipe']},
  parcial_2:{lbl:'2ª avaliação parcial', el:['trainee','aprovado_final','reprovado_final','integrado'],
    crit:['Assiduidade','Comprometimento','Evolução técnica','Trabalho em equipe']},
  apresentacao_final:{lbl:'Apresentação final', el:['trainee','aprovado_final','reprovado_final','integrado'],
    crit:['Domínio técnico','Clareza da apresentação','Resultados entregues','Postura profissional']}
};
const PS_REC = {aprovar:'Aprovar', em_duvida:'Em dúvida', reprovar:'Reprovar'};
const PS_TIPO_PUB = {edital:'Edital', aviso:'Aviso', deferimento:'Inscrições deferidas',
  resultado_dinamica:'Resultado — 1ª fase', resultado_entrevista:'Resultado — 2ª fase',
  resultado_final:'Resultado final'};
const PS_SETS = {
  deferimento:['deferido','reprovado_dinamica','aprovado_dinamica','reprovado_entrevista','aprovado_entrevista','trainee','reprovado_final','aprovado_final','integrado'],
  resultado_dinamica:['aprovado_dinamica','reprovado_entrevista','aprovado_entrevista','trainee','reprovado_final','aprovado_final','integrado'],
  resultado_entrevista:['aprovado_entrevista','trainee','reprovado_final','aprovado_final','integrado'],
  resultado_final:['aprovado_final','integrado']
};
const PS_FASES_ETAPA = ['divulgacao','inscricao','dinamica','entrevista','trainee','resultado','outro'];

const PS = { pronto:false, erro:null, tab:'geral', edicoes:[], ed:null,
  candidatos:[], etapas:[], slots:[], agends:[], pubs:[], avals:[], perfis:[],
  faq:[], competencias:[], v11:false,
  dinCfg:null, dinItens:[], v12:false, dinSub:'painel', dinJanela:null,
  mesaSel:new Set(), mesaBusca:'',
  filtros:{q:'',status:''}, selecionados:new Set(), faseAval:'dinamica', faseAgenda:'dinamica' };

const psPill = st=>{ const [l,d]=PS_ST[st]||[st,'dt-gray']; return `<span class="pill"><span class="dt ${d}"></span>${esc(l)}</span>`; };
const psHm = t=> t ? String(t).slice(0,5) : '';
const psCand = id=> PS.candidatos.find(c=>c.id===id);
const psAvalsDe = (id,fase)=> PS.avals.filter(a=>a.candidato_id===id && (!fase||a.fase===fase));
const psAgendDe = (id,fase)=> PS.agends.find(a=>a.candidato_id===id && a.fase===fase);
function psMedia(l){ const ns=l.map(a=>Number(a.nota)).filter(n=>!isNaN(n)&&n>0);
  return ns.length ? (ns.reduce((s,n)=>s+n,0)/ns.length) : null; }
const psFmtDT = d=> d ? fmtDT(d) : '—';
const psHr = '<hr style="border:none;border-top:1px solid var(--line);margin:18px 0">';
const psRot = (t)=> `<span class="ps-rot">${t}</span>`;

async function psCarregar(){
  const {data:eds, error:e0} = await sb.from('ps_edicoes').select('*').order('criado_em',{ascending:false});
  if(e0) throw e0;
  PS.edicoes = eds||[];
  if(!PS.ed || !PS.edicoes.some(x=>x.id===PS.ed.id)) PS.ed = PS.edicoes[0]||null;
  if(!PS.ed){ PS.pronto=true; return; }
  const id = PS.ed.id;
  const consultas = [
    sb.from('ps_candidatos').select('*').eq('edicao_id', id).order('numero'),
    sb.from('ps_etapas').select('*').eq('edicao_id', id).order('ordem'),
    sb.from('ps_slots').select('*').eq('edicao_id', id).order('data').order('hora_inicio'),
    sb.from('ps_agendamentos').select('*, slot:ps_slots!inner(*)').eq('slot.edicao_id', id),
    sb.from('ps_publicacoes').select('*').eq('edicao_id', id).order('criado_em',{ascending:false}),
    sb.from('ps_avaliacoes').select('*, ps_candidatos!inner(edicao_id)').eq('ps_candidatos.edicao_id', id)
  ];
  if(can()) consultas.push(sb.from('perfis').select('id,email,nome,papel').order('email'));
  const rs = await Promise.all(consultas);
  for(const r of rs) if(r.error) throw r.error;
  PS.candidatos = rs[0].data||[]; PS.etapas = rs[1].data||[]; PS.slots = rs[2].data||[];
  PS.agends = rs[3].data||[]; PS.pubs = rs[4].data||[];
  PS.avals = (rs[5].data||[]).map(x=>{ delete x.ps_candidatos; return x; });
  PS.perfis = rs[6]?.data||[];
  /* FAQ e catálogo de competências dependem da soma_v11. Sem ela, o
     resto do módulo continua funcionando. */
  try{
    const [f, cp] = await Promise.all([
      sb.from('ps_faq').select('*').order('ordem'),
      sb.from('ps_competencias').select('*').order('ordem')
    ]);
    if(f.error || cp.error) throw f.error || cp.error;
    PS.faq = f.data||[]; PS.competencias = cp.data||[]; PS.v11 = true;
  }catch(e){ PS.faq = []; PS.competencias = []; PS.v11 = false; }
  /* conteúdo da dinâmica em grupo: depende da soma_v12. Sem ela, a aba
     avisa e o resto continua igual. */
  try{
    const [cfg, itens] = await Promise.all([
      sb.from('ps_din_config').select('*').eq('edicao_id', id).maybeSingle(),
      sb.from('ps_din_itens').select('*').order('tipo').order('ordem')
    ]);
    if(itens.error) throw itens.error;
    PS.dinCfg = cfg.data || null;
    PS.dinItens = itens.data || [];
    PS.v12 = true;
  }catch(e){ PS.dinCfg = null; PS.dinItens = []; PS.v12 = false; }
  PS.selecionados = new Set();
  PS.pronto = true;
}
async function psRecarregar(){ PS.pronto=false; PS.erro=null; await desenhaSelecao(); }
function psTrocarEdicao(id){ PS.ed = PS.edicoes.find(x=>x.id===id)||PS.ed; PS.pronto=false; desenhaSelecao(); }
/* Trocar de aba é navegar: cada aba tem endereço, e o menu lateral acende. */
function psTab(t){ location.hash = '#/selecao' + (t && t!=='geral' ? '/'+t : ''); }

/* ============================================================
   ROTA
   ============================================================ */
const PS_DIN_SUB = [['painel','Painel'],['roteiro','Roteiro'],['desafio','Desafio'],
                    ['criterios','Critérios'],['janelas','Janelas']];
const PS_ABAS = ABAS_SELECAO.map(([s,l]) => [s || 'geral', l]);

async function pageSelecao(sub, sub2){
  PS.tab = PS_ABAS.some(([k]) => k === sub) ? sub : 'geral';
  if(PS.tab === 'dinamica'){
    if(PS_DIN_SUB.some(([k]) => k === sub2)) PS.dinSub = sub2;
    if(PS.dinSub !== 'janelas') PS.dinJanela = null;
  }
  await desenhaSelecao();
  /* #/selecao/candidatos/<id> abre a ficha por cima da lista */
  if(PS.tab === 'candidatos' && sub2 && psCand(sub2)) psAbrirFicha(sub2);
}

async function desenhaSelecao(){
  const m = $('#main');
  const topo = (acoes) => `<div class="topo-gestao"><div class="tx"><span class="eyebrow">Comitê de Seleção</span>
      <h1>Processo seletivo</h1><p class="lead">Os bastidores do processo: candidatos, avaliação, agenda,
      a dinâmica em grupo e o que vai para o site.</p></div>
    ${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
  if(!podeSelecao()){
    m.innerHTML = topo() + `<div class="aviso-box warn"><b>Acesso restrito.</b> Esta página é do Comitê de
      Seleção. Peça a um administrador para atribuir o papel <b>selecao</b> ao seu perfil.</div>`;
    return;
  }
  if(!PS.pronto && !PS.erro){
    m.innerHTML = topo() + '<div class="carregando"><span class="spin"></span> Carregando o processo seletivo…</div>';
    try{ await psCarregar(); }catch(e){ console.error(e); PS.erro = e; }
  }
  if(PS.erro){
    m.innerHTML = topo() + `<div class="aviso-box err"><b>Módulo não disponível.</b> Não foi possível carregar os
      dados do processo seletivo (${esc(PS.erro.message||'erro')}). Confira se as migrações
      <b>soma_v06_selecao.sql</b> e <b>soma_v07_selecao_slots.sql</b> foram aplicadas no Supabase.</div>
      <button class="btn ghost" onclick="psRecarregar()">Tentar de novo</button>`;
    return;
  }
  if(!PS.ed){
    m.innerHTML = topo() + `<div class="vazio"><div class="glyph">—</div><h3>Nenhuma edição encontrada</h3>
      <p>A migração soma_v06 cria o Processo Seletivo 2026 automaticamente. Você também pode criar uma edição agora.</p>
      <button class="btn solid" onclick="psNovaEdicao()">${ic('plus')} Criar edição</button></div>`;
    return;
  }
  const seletor = PS.edicoes.length>1
    ? `<select class="ps-ed" onchange="psTrocarEdicao(this.value)" aria-label="Edição do processo seletivo">
        ${PS.edicoes.map(e=>`<option value="${e.id}" ${e.id===PS.ed.id?'selected':''}>${esc(e.nome)}</option>`).join('')}</select>`
    : `<span class="pill">${esc(PS.ed.nome)}</span>`;
  m.innerHTML = topo(seletor) + `
    <nav class="abas">${PS_ABAS.map(([t,l])=>
      `<a href="#/selecao${t==='geral'?'':'/'+t}" class="${PS.tab===t?'on':''}">${l}</a>`).join('')}</nav>
    <div id="sel-corpo"></div>`;
  ({geral:psGeral, candidatos:psCandidatos, avaliacao:psAvaliacao, agenda:psAgenda,
    dinamica:psDinamica, publicacoes:psPublicacoes, faq:psFaq, config:psConfig}[PS.tab]||psGeral)();
}

/* ============================================================
   VISÃO GERAL
   ============================================================ */
function psGeral(){
  const cs = PS.candidatos;
  const n = st=> cs.filter(c=>c.status===st).length;
  const nIn = sts=> cs.filter(c=>sts.includes(c.status)).length;
  const total = cs.length, max = Math.max(1, total);
  const funil = [
    ['Inscritos', total],
    ['Deferidos', nIn(PS_SETS.deferimento)],
    ['Aprovados na dinâmica', nIn(PS_SETS.resultado_dinamica)],
    ['Aprovados na entrevista', nIn(PS_SETS.resultado_entrevista)],
    ['Aprovados no final', nIn(PS_SETS.resultado_final)],
    ['Integrados', n('integrado')]
  ];
  const h = hojeISO();
  const etapaAgora = PS.etapas.find(e=> h>=e.data_inicio && h<=(e.data_fim||e.data_inicio));
  const proxEtapa = PS.etapas.find(e=> e.data_inicio > h);
  const semDin = cs.filter(c=>c.status==='deferido' && !psAgendDe(c.id,'dinamica')).length;
  const semEnt = cs.filter(c=>c.status==='aprovado_dinamica' && !psAgendDe(c.id,'entrevista')).length;
  const rascunhos = PS.pubs.filter(p=>!p.publicado).length;
  const proxSlots = PS.slots.filter(s=>s.ativo && s.data>=h).slice(0,6);
  const ocup = s=> PS.agends.filter(a=>a.slot_id===s.id).length;
  const metrica = (vl, rot)=> `<div class="metrica"><span class="rot">${rot}</span><span class="val">${vl}</span></div>`;
  $('#sel-corpo').innerHTML = `
  ${etapaAgora ? `<div class="aviso-box lima"><b>Agora no cronograma:</b> ${esc(etapaAgora.titulo)}
      (${fmtD(etapaAgora.data_inicio)}${etapaAgora.data_fim&&etapaAgora.data_fim!==etapaAgora.data_inicio?' a '+fmtD(etapaAgora.data_fim):''}).</div>`
    : proxEtapa ? `<div class="aviso-box info"><b>Próximo marco:</b> ${esc(proxEtapa.titulo)} em ${fmtD(proxEtapa.data_inicio)}.</div>` : ''}
  <div class="metricas ps-metricas">
    ${metrica(total,'Inscrições recebidas')}${metrica(n('inscrito'),'Aguardando análise')}
    ${metrica(n('deferido'),'Na fase de dinâmicas')}${metrica(n('aprovado_dinamica'),'Na fase de entrevistas')}
    ${metrica(n('trainee')+n('aprovado_entrevista'),'Trainees')}${metrica(n('aprovado_final')+n('integrado'),'Aprovados no final')}
  </div>
  <div class="ps-grade">
    <div class="card"><h3 style="margin-bottom:14px">Funil do processo</h3>
      <div class="barras">${funil.map(([l,vl])=>`<div class="barra"><span class="k">${l}</span>
        <span class="trilho"><span class="fill" style="width:${Math.round(vl/max*100)}%"></span></span>
        <span class="n">${vl}</span></div>`).join('')}</div>
    </div>
    <div class="card"><h3 style="margin-bottom:8px">Pendências</h3>
      ${[[n('inscrito'),'inscrições aguardando deferimento','candidatos'],
         [semDin,'deferidos sem dinâmica agendada','agenda'],
         [semEnt,'aprovados sem entrevista agendada','agenda'],
         [rascunhos,'publicações em rascunho','publicacoes']]
        .filter(([q])=>q>0)
        .map(([q,t,tb])=>`<div class="ps-linha"><span style="flex:1">${q} ${t}</span>
          <a class="btn ghost mini" href="#/selecao/${tb}">Ver</a></div>`).join('')
        || '<div class="empty">Nenhuma pendência. Tudo em dia.</div>'}
    </div>
    <div class="card"><h3 style="margin-bottom:8px">Próximos horários</h3>
      ${proxSlots.length ? proxSlots.map(s=>`<div class="ps-linha">
          <span style="flex:1"><b>${fmtD(s.data)}</b> ${psHm(s.hora_inicio)}–${psHm(s.hora_fim)}
            <span class="muted">(${s.fase==='dinamica'?'dinâmica':'entrevista'}${s.local?', '+esc(s.local):''})</span></span>
          <span class="mono small muted">${ocup(s)}/${s.capacidade}</span></div>`).join('')
        : '<div class="empty">Nenhum horário futuro aberto.<br>Abra janelas na aba Agenda.</div>'}
    </div>
  </div>
  <div class="card"><h3>Site público</h3>
    <p class="small muted" style="line-height:1.7;margin-top:6px">Inscrições, acompanhamento e agendamento dos candidatos acontecem em
    <a href="${SITE_PS}" target="_blank" rel="noopener" style="text-decoration:underline">${SITE_PS.replace('https://','')}</a>.
    Os candidatos só enxergam cada resultado depois que a publicação correspondente for <b>publicada</b> na aba Publicações.</p></div>`;
}

/* ============================================================
   CANDIDATOS
   ============================================================ */
function psFiltrados(){
  const f = PS.filtros; let lista = PS.candidatos;
  if(f.status) lista = lista.filter(c=>c.status===f.status);
  if(f.q){ const q=norm(f.q);
    lista = lista.filter(c=>norm(c.nome+' '+c.email+' '+(c.protocolo||'')+' '+(c.curso||'')).includes(q)); }
  return lista;
}
function psCandidatos(){
  const f = PS.filtros, lista = psFiltrados();
  $('#sel-corpo').innerHTML = `
  <div class="filtros">
    <div class="fld cresce"><label>Buscar</label>
      <input id="ps-busca" value="${esc(f.q)}" placeholder="Nome, e-mail, protocolo ou curso…"
        oninput="PS.filtros.q=this.value; psFiltra()"></div>
    <div class="fld"><label>Status</label>
      <select onchange="PS.filtros.status=this.value; psCandidatos()">
        <option value="">Todos</option>
        ${Object.keys(PS_ST).map(s=>`<option value="${s}" ${f.status===s?'selected':''}>${PS_ST[s][0]}</option>`).join('')}
      </select></div>
    <button class="btn ghost" onclick="psExportCSV()">${ic('down')} Exportar CSV</button>
  </div>
  <div class="wrap"><table class="tabela trabalho"><thead><tr>
      <th style="width:34px"><input type="checkbox" aria-label="Selecionar todos" onchange="psSelTodos(this.checked)" ${lista.length&&lista.every(c=>PS.selecionados.has(c.id))?'checked':''}></th>
      <th>Protocolo</th><th>Nome</th><th>Curso / período</th><th>Status</th><th>Dinâmica</th><th>Entrevista</th><th>Média</th><th style="width:70px;white-space:nowrap">E-mail</th>
    </tr></thead>
    <tbody>${lista.map(psLinhaCand).join('') ||
      `<tr><td colspan="9"><div class="empty">Nenhum candidato ${PS.candidatos.length?'com esses filtros':'inscrito ainda'}.</div></td></tr>`}</tbody>
  </table></div>
  <div id="ps-selbar"></div>`;
  psSelBar();
}
function psLinhaCand(c){
  const ad = psAgendDe(c.id,'dinamica'), ae = psAgendDe(c.id,'entrevista');
  const md = psMedia(psAvalsDe(c.id));
  const agTxt = a=> a&&a.slot ? `${fmtD(a.slot.data)} ${psHm(a.slot.hora_inicio)}` : '<span class="dim">—</span>';
  return `<tr class="click" tabindex="0" onclick="psAbrirFicha('${c.id}')" onkeydown="if(event.key==='Enter')psAbrirFicha('${c.id}')">
    <td onclick="event.stopPropagation()"><input type="checkbox" aria-label="Selecionar ${esc(c.nome)}" ${PS.selecionados.has(c.id)?'checked':''} onchange="psSelUm('${c.id}',this.checked)"></td>
    <td class="reg">${esc(c.protocolo||'—')}</td>
    <td><span class="nome">${esc(c.nome)}</span><br><span class="small dim">${esc(c.email)}</span></td>
    <td class="small">${esc(c.curso||'—')}${c.periodo?`, ${esc(c.periodo)}`:''}</td>
    <td>${psPill(c.status)}</td>
    <td class="small">${agTxt(ad)}</td>
    <td class="small">${agTxt(ae)}</td>
    <td>${md!=null?`<span class="nota-badge">★ ${md.toFixed(1)}</span>`:'<span class="dim small">—</span>'}</td>
    <td onclick="event.stopPropagation()">${ibtn('mail','E-mail de confirmação da inscrição',`psEmailConfirmacao('${c.id}')`,'sm')}</td>
  </tr>`;
}
/* a busca redesenha só a tabela depois de uma pausa, e devolve o foco ao campo */
const psFiltra = (function(){ let t; return function(){ clearTimeout(t); t=setTimeout(()=>{
  const el = document.activeElement, pos = el?.id==='ps-busca' ? el.selectionStart : null;
  psCandidatos();
  if(pos!=null){ const i=$('#ps-busca'); if(i){ i.focus(); i.setSelectionRange(pos,pos); } }
}, 200); }; })();
function psSelTodos(on){ psFiltrados().forEach(c=> on?PS.selecionados.add(c.id):PS.selecionados.delete(c.id)); psCandidatos(); }
function psSelUm(id,on){ on?PS.selecionados.add(id):PS.selecionados.delete(id); psSelBar(); }
function psSelBar(){
  const slot = $('#ps-selbar'); if(!slot) return;
  if(!PS.selecionados.size){ slot.innerHTML=''; return; }
  slot.innerHTML = `<div class="sel-bar">
    <span class="qt">${PS.selecionados.size} selecionado${PS.selecionados.size>1?'s':''}</span>
    <select id="ps-mov" aria-label="Movimentação">${PS_MOVS.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>
    <button class="btn solid mini" onclick="psMoverLote()">Aplicar</button>
    <button class="limpa" onclick="PS.selecionados.clear(); psCandidatos()">limpar seleção</button>
  </div>`;
}
async function psMoverLote(){
  const alvo = $('#ps-mov').value;
  const [,lbl] = PS_MOVS.find(m=>m[0]===alvo);
  const ids = [...PS.selecionados];
  if(!await confirma(`Aplicar "<b>${lbl}</b>" a <b>${ids.length}</b> candidato(s)?<br>
    <span class="small muted">O candidato só vê o novo resultado quando a publicação da fase for publicada.</span>`)) return;
  try{
    const {error} = await sb.from('ps_candidatos').update({status:alvo}).in('id', ids);
    if(error) throw error;
    toast('Movimentação aplicada.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha na movimentação'); }
}
function psExportCSV(){
  const cols = ['protocolo','status','nome','email','telefone','curso','instituicao','periodo',
    'areas_interesse','disponibilidade','como_soube','criado_em'];
  const linhas = [cols.join(';')].concat(PS.candidatos.map(c=>
    cols.map(k=>{ let vl=c[k]; if(Array.isArray(vl)) vl=vl.join(', ');
      return '"'+String(vl??'').replace(/"/g,'""')+'"'; }).join(';')));
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob(['﻿'+linhas.join('\n')],{type:'text/csv;charset=utf-8'}));
  a.download='candidatos-'+(PS.ed.slug||'ps')+'.csv'; a.click(); URL.revokeObjectURL(a.href);
}

/* ---------- e-mail de confirmação da inscrição ----------
   Abre a tela de e-mail já com o texto de deferimento e o número do
   protocolo. O texto fica editável antes de seguir para o app de e-mail
   ou para o Gmail. */
function psTextoConfirmacao(c){
  const ed = PS.ed, prim = String(c.nome||'').trim().split(/\s+/)[0] || '';
  const prot = c.protocolo || '(protocolo não gerado)';
  const din = PS.etapas.find(e=>e.fase==='dinamica');
  const assunto = `NeuroDynamics — Inscrição deferida sob o protocolo #${prot}`;
  const corpo = [
    `Olá, ${prim}!`,
    `Confirmamos o recebimento e a análise da sua inscrição no ${ed?ed.nome:'processo seletivo'} da NeuroDynamics.`,
    `A sua inscrição foi DEFERIDA: você segue para a primeira fase do processo seletivo.`,
    `Protocolo: ${prot}\nSituação: inscrição deferida\nInscrição recebida em: ${c.criado_em?fmtDT(c.criado_em):'—'}`,
    `Guarde o número do protocolo. É com ele e com o e-mail cadastrado (${c.email}) que você acompanha todas as fases em ${SITE_PS}/#/acompanhar.`,
    `Ao final do período de inscrições acesse a página "Acompanhar", informe o protocolo e o e-mail e escolha o horário da sua dinâmica em grupo${din?`, prevista para ${fmtD(din.data_inicio)}`:''}.`,
    `Este é um e-mail automático, não é necessário respondê-lo.`,
    `Comitê de Seleção\nNeuroDynamics\nEscola de Engenharia da UFMG`
  ].join('\n\n');
  return {assunto, corpo};
}
function psEmailConfirmacao(id, voltaFicha){
  const c = psCand(id); if(!c) return;
  const t = psTextoConfirmacao(c);
  const jaDeferido = PS_SETS.deferimento.includes(c.status);
  const fechar = voltaFicha ? `psAbrirFicha('${c.id}')` : 'fechaModal()';
  abreModal(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div><h3 style="margin:0">Confirmação da inscrição</h3>
        <div class="small muted" style="margin-top:4px"><b>${esc(c.nome)}</b> ·
          <span class="mono">${esc(c.protocolo||'sem protocolo')}</span></div></div>
      <div style="display:flex;gap:8px;align-items:center">${psPill(c.status)}${ibtn('x','Fechar',fechar,'sm')}</div>
    </div>
    ${!c.protocolo?`<div class="aviso-box err">Este candidato ainda não tem número de protocolo gravado.
      Ajuste o texto antes de enviar.</div>`:''}
    ${!jaDeferido?`<div class="aviso-box warn">O candidato está como <b>${esc((PS_ST[c.status]||[c.status])[0])}</b> e o
      texto abaixo comunica o <b>deferimento</b> da inscrição. Confira a movimentação na aba Ações da ficha antes de enviar.</div>`:''}
    <div class="fld"><label>Para</label><input id="pse-para" value="${esc(c.email)}"></div>
    <div class="fld"><label>Assunto</label><input id="pse-assunto" value="${esc(t.assunto)}"></div>
    <div class="fld"><label>Mensagem</label>
      <textarea id="pse-corpo" style="min-height:250px;font-size:13px;line-height:1.6">${esc(t.corpo)}</textarea></div>
    <p class="small dim" style="margin:-4px 0 0">Edite o que precisar: o texto vai para o e-mail exatamente como estiver aqui.
    Se o “App de e-mail” não abrir nada, não há um configurado no computador — use o Gmail.</p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="${fechar}">${voltaFicha?'Voltar à ficha':'Fechar'}</button>
      <button class="btn ghost" onclick="psEmailCopiar()">${ic('copy')} Copiar texto</button>
      <button class="btn ghost" onclick="psEmailAbrir('mailto')">${ic('mail')} App de e-mail</button>
      <button class="btn solid" onclick="psEmailAbrir('gmail')">${ic('mail')} Abrir no Gmail</button>
    </div>`, 'largo');
}
function psEmailCopiar(){ copiar($('#pse-assunto').value + '\n\n' + $('#pse-corpo').value); }
function psEmailAbrir(via){
  const para = $('#pse-para').value.trim(), su = $('#pse-assunto').value, corpo = $('#pse-corpo').value;
  if(!para){ toast('Informe o destinatário.', true); return; }
  if(via==='gmail'){ window.open(gmailCompose({to:para, su, body:corpo}), '_blank', 'noopener'); return; }
  abrirEmail(`mailto:${encodeURIComponent(para)}?subject=${encodeURIComponent(su)}&body=${encodeURIComponent(corpo)}`);
}

/* ---------- a ficha do candidato ---------- */
function psAbrirFicha(id){
  const c = psCand(id); if(!c) return;
  const grupos = {};
  psAvalsDe(id).forEach(a=>{ (grupos[a.fase]=grupos[a.fase]||[]).push(a); });
  const linksRow = [['Lattes',c.lattes],['GitHub',c.github],['LinkedIn',c.linkedin],['Instagram',c.instagram],['Portfólio',c.portfolio]]
    .filter(x=>x[1]).map(([l,u])=>{ const url=/^https?:/.test(u)?u:'https://'+u;
      return `<a class="chip mini" href="${esc(url)}" target="_blank" rel="noopener">${l} ↗</a>`; }).join(' ') || '<span class="dim">—</span>';
  const ags = PS.agends.filter(a=>a.candidato_id===id);
  const podeIntegrar = ['trainee','aprovado_final'].includes(c.status);
  const proxReg = Math.max(0,...state.membros.map(m=>m.registro))+1;
  const deptos = [...new Set(state.membros.map(m=>m.departamento).filter(Boolean))].sort();
  abreModal(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px">
      <div style="display:flex;gap:12px;align-items:center">
        ${avatarFoto({nome:c.nome}, 44, 14)}
        <div><div style="font-family:var(--fd);font-size:17px;font-weight:600">${esc(c.nome)}</div>
        <div class="small muted"><span class="mono">${esc(c.protocolo||'—')}</span> · inscrição em ${psFmtDT(c.criado_em)}</div></div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">${psPill(c.status)}
        ${ibtn('x','Fechar','fechaModal()','sm')}</div>
    </div>
    <div class="abas" style="margin-bottom:16px">
      <button class="aba on" onclick="psFichaTab(this,'dados')">Dados</button>
      <button class="aba" onclick="psFichaTab(this,'avals')">Avaliações (${psAvalsDe(id).length})</button>
      <button class="aba" onclick="psFichaTab(this,'acoes')">Ações</button>
    </div>
    <div id="pstab-dados">
      <dl class="dl">
        ${[['E-mail',c.email],['Telefone',c.telefone],['Nascimento',c.data_nascimento?fmtD(c.data_nascimento):null],
           ['Cidade de origem',c.cidade_origem],['Gênero',c.genero],['Autodeclaração racial',c.autodeclaracao_racial],
           ['Acessibilidade',c.acessibilidade],['Instituição',c.instituicao],['Curso',c.curso],
           ['Matrícula',c.matricula],['Período',c.periodo],['Disponibilidade',c.disponibilidade],
           ['Como soube',c.como_soube],['Autorização de imagem',c.autorizacao_imagem?'Sim':'Não']]
          .map(([l,vl])=>`<div class="it"><dt>${l}</dt><dd>${esc(vl||'—')}</dd></div>`).join('')}
        <div class="it full"><dt>Áreas de interesse</dt>
          <dd>${(c.areas_interesse||[]).map(a=>`<span class="chip mini">${esc(a)}</span>`).join(' ')||'—'}</dd></div>
        <div class="it full"><dt>Links</dt><dd>${linksRow}</dd></div>
      </dl>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:18px 0 8px">
        <span class="ps-rot" style="margin:0">Competências</span>
        <button class="btn ghost mini" onclick="psEditarComps('${c.id}')">${ic('pencil')} Editar</button>
      </div>
      <dl class="dl">${psCompsChips(c)}</dl>
      ${c.background?`${psRot('Experiências')}<p class="small muted" style="white-space:pre-wrap;line-height:1.6">${esc(c.background)}</p>`:''}
      ${c.motivacao?`${psRot('Motivação')}<p class="small muted" style="white-space:pre-wrap;line-height:1.6">${esc(c.motivacao)}</p>`:''}
      ${ags.length?`${psRot('Agendamentos')}
        ${ags.map(a=>`<div class="small" style="margin-top:5px"><b>${a.fase==='dinamica'?'Dinâmica':'Entrevista'}</b>:
          ${a.slot?`${fmtD(a.slot.data)} ${psHm(a.slot.hora_inicio)}–${psHm(a.slot.hora_fim)}${a.slot.local?', '+esc(a.slot.local):''}`:'—'}
          ${a.compareceu===true?'<span class="pill" style="margin-left:6px"><span class="dt dt-ok"></span>compareceu</span>'
            :a.compareceu===false?'<span class="pill" style="margin-left:6px"><span class="dt dt-bad"></span>faltou</span>':''}</div>`).join('')}`:''}
    </div>
    <div id="pstab-avals" hidden>
      ${Object.keys(PS_FASES_AVAL).map(f=>{
        const l = grupos[f]||[]; if(!l.length) return '';
        const md = psMedia(l);
        return `<div class="aval-card">
          <div class="hd"><b>${PS_FASES_AVAL[f].lbl}</b>${md!=null?`<span class="nota-badge">★ ${md.toFixed(1)} · ${l.length} avaliação${l.length>1?'ões':''}</span>`:''}</div>
          ${l.map(a=>`<div class="small" style="border-top:1px solid var(--line);padding:8px 0">
            <b>${esc(a.avaliador||'—')}</b>: nota ${a.nota??'—'}
            ${a.recomendacao?` <span class="chip mini">${PS_REC[a.recomendacao]||a.recomendacao}</span>`:''}
            ${a.parecer?`<div class="muted" style="margin-top:3px;white-space:pre-wrap">${esc(a.parecer)}</div>`:''}
          </div>`).join('')}
        </div>`; }).join('') || '<div class="empty">Nenhuma avaliação registrada ainda.<br>Use a aba "Avaliação".</div>'}
    </div>
    <div id="pstab-acoes" hidden>
      <div class="fld"><label>Mover para</label>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <select id="ps-mov-um" style="flex:1;min-width:220px">
            ${PS_MOVS.map(([vl,l])=>`<option value="${vl}">${l}</option>`).join('')}</select>
          <button class="btn solid" onclick="psMoverUm('${c.id}')">Aplicar</button>
        </div>
        <p class="small dim" style="margin-top:7px">O candidato só vê o novo resultado no site depois que a publicação da fase for publicada.</p>
      </div>
      ${psHr}
      <h3 style="font-size:14px;margin-bottom:6px">Confirmação da inscrição</h3>
      <p class="small muted" style="margin-bottom:12px">Abre a tela de e-mail com o texto de deferimento da inscrição e o número do protocolo.</p>
      <button class="btn ghost" onclick="psEmailConfirmacao('${c.id}', true)">${ic('mail')} Escrever e-mail de confirmação</button>
      ${psHr}
      <h3 style="font-size:14px;margin-bottom:6px">Integrar como membro</h3>
      ${podeIntegrar ? `
        <p class="small muted" style="margin-bottom:12px">Cria o registro no quadro com todos os dados da ficha, grava a ocorrência de ingresso e marca o candidato como integrado.</p>
        <div class="form-grid">
          <div class="fld"><label>Nº de registro</label><input id="ps-int-reg" type="number" value="${proxReg}"></div>
          <div class="fld"><label>Departamento</label>
            <select id="ps-int-dep"><option value="">—</option>${deptos.map(d=>`<option>${esc(d)}</option>`).join('')}</select></div>
          <div class="fld"><label>Cargo</label><input id="ps-int-cargo" value="Membro"></div>
        </div>
        <button class="btn solid" onclick="psIntegrarCand('${c.id}')">${ic('check')} Integrar ao quadro</button>`
      : c.status==='integrado'
        ? `<p class="small">Integrado como membro, registro <b>${c.registro_membro??'—'}</b>.</p>`
        : `<p class="small muted">Disponível quando o candidato estiver como <b>Trainee</b> ou <b>Aprovado · final</b>.</p>`}
    </div>
  `, 'largo');
}
function psFichaTab(btn, tab){
  btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===btn));
  ['dados','avals','acoes'].forEach(t=> document.getElementById('pstab-'+t).hidden = t!==tab);
}
async function psMoverUm(id){
  const alvo = $('#ps-mov-um').value;
  try{
    const {error} = await sb.from('ps_candidatos').update({status:alvo}).eq('id', id);
    if(error) throw error;
    toast('Status atualizado.'); fechaModal();
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao mover'); }
}
async function psIntegrarCand(id){
  const reg = parseInt($('#ps-int-reg').value,10);
  if(!reg){ toast('Informe o nº de registro.', true); return; }
  const c = psCand(id);
  const dep = $('#ps-int-dep').value||null, cargo = $('#ps-int-cargo').value||null;
  if(!await confirma(`Integrar <b>${esc(c.nome)}</b> como membro com o registro <b>${reg}</b>?`)) return;
  try{
    const {data, error} = await sb.rpc('ps_integrar', {p_candidato:id, p_registro:reg,
      p_departamento: dep, p_cargo: cargo});
    if(error) throw error;
    if(data?.status==='ok'){
      toast(`Membro criado com o registro ${reg}.`);
      /* o quadro da casca ganha a pessoa nova sem precisar sair e entrar */
      const {data:m} = await sb.from('membros')
        .select('registro,nome,cargo,departamento,status,grupos,gestor_registro,foto_url,email_nro,email_pessoal,telefone')
        .order('nome');
      if(m) state.membros = m;
      PS.pronto=false; desenhaSelecao();
    }
    else if(data?.status==='registro_em_uso') toast('Este registro já está em uso.', true);
    else if(data?.status==='status_invalido') toast('O candidato precisa estar como trainee ou aprovado no final.', true);
    else toast('Não foi possível integrar: '+(data?.status||''), true);
  }catch(e){ falha(e,'Falha na integração'); }
}

/* ============================================================
   AVALIAÇÃO GUIADA
   Cada membro do comitê registra a própria avaliação, por critério;
   a nota do candidato na fase é a média de todas.
   ============================================================ */
function psAvaliacao(){
  const fase = PS.faseAval, cf = PS_FASES_AVAL[fase];
  const uid = state.perfil.id;
  const eleg = PS.candidatos.filter(c=>cf.el.includes(c.status));
  const rank = eleg.map(c=>({c, avs:psAvalsDe(c.id,fase)}))
    .map(x=>({...x, media:psMedia(x.avs)}))
    .sort((a,b)=> (b.media??-1)-(a.media??-1));
  $('#sel-corpo').innerHTML = `
  <div class="aviso-box info">Selecione a fase, avalie cada candidato pelos critérios padronizados e acompanhe o consolidado. Cada membro do comitê registra a própria avaliação; a nota final é a média.</div>
  <div class="chips" style="margin-bottom:16px">${Object.keys(PS_FASES_AVAL).map(f=>
    `<button class="chip ${f===fase?'on':''}" onclick="PS.faseAval='${f}';psAvaliacao()">${PS_FASES_AVAL[f].lbl}</button>`).join('')}</div>
  <div class="card">
    <h3 style="margin-bottom:14px">${cf.lbl}: ${eleg.length} candidato${eleg.length===1?'':'s'} nesta fase</h3>
    ${eleg.length ? rank.map(({c,avs,media})=>{
      const minha = avs.find(a=>a.avaliador_id===uid);
      const ag = (fase==='dinamica'||fase==='entrevista') ? psAgendDe(c.id,fase) : null;
      const recs = avs.reduce((m,a)=>{ if(a.recomendacao) m[a.recomendacao]=(m[a.recomendacao]||0)+1; return m; },{});
      return `<div class="aval-cand">
        <div style="min-width:0;flex:1">
          <div class="nm">${esc(c.nome)} <span class="mono small dim">${esc(c.protocolo||'')}</span></div>
          <div class="mt">${psPill(c.status)}
            ${ag&&ag.slot?` · ${fmtD(ag.slot.data)} ${psHm(ag.slot.hora_inicio)}`:''}
            ${avs.length?` · ${avs.length} avaliação${avs.length>1?'ões':''}`:' · sem avaliações'}
            ${Object.keys(recs).length?' · '+Object.entries(recs).map(([r,q])=>`${q}× ${PS_REC[r]}`).join(', '):''}
          </div>
        </div>
        ${media!=null?`<span class="nota-badge">★ ${media.toFixed(1)}</span>`:''}
        <button class="btn ${minha?'ghost':'solid'} mini" onclick="psAbrirAval('${c.id}','${fase}')">
          ${ic('pencil')} ${minha?'Editar minha avaliação':'Avaliar'}</button>
      </div>`; }).join('')
    : `<div class="empty">Nenhum candidato nesta fase no momento.<br>
       <span class="small">Os candidatos entram aqui conforme as movimentações na aba Candidatos.</span></div>`}
  </div>`;
}
function psAbrirAval(candId, fase){
  const c = psCand(candId), cf = PS_FASES_AVAL[fase];
  const minha = psAvalsDe(candId,fase).find(a=>a.avaliador_id===state.perfil.id);
  const crit = minha?.criterios || {};
  window.__psAval = {candId, fase, criterios:{...crit}, recomendacao:minha?.recomendacao||null};
  abreModal(`
    <h3>${cf.lbl}: ${esc(c.nome)}</h3>
    <p class="small muted" style="margin:0 0 12px">Dê uma nota de 1 a 5 em cada critério. A nota geral é a média dos critérios preenchidos.</p>
    ${cf.crit.map((cr,i)=>`<div class="crit-row"><span class="lb">${cr}</span>
      <span class="seg notas">${[1,2,3,4,5].map(nn=>
        `<button class="${crit[cr]===nn?'on':''}" onclick="psNotaCr(this,${i},${nn})">${nn}</button>`).join('')}</span></div>`).join('')}
    <div class="fld" style="margin-top:14px"><label>Parecer</label>
      <textarea id="ps-av-parecer" rows="3" placeholder="Observações, destaques, pontos de atenção…">${esc(minha?.parecer||'')}</textarea></div>
    <div class="fld"><label>Recomendação</label>
      <div class="rec-seg">
        <button id="ps-rec-aprovar" class="${window.__psAval.recomendacao==='aprovar'?'on-ap':''}" onclick="psRecSel('aprovar')">✓ Aprovar</button>
        <button id="ps-rec-em_duvida" class="${window.__psAval.recomendacao==='em_duvida'?'on-du':''}" onclick="psRecSel('em_duvida')">? Em dúvida</button>
        <button id="ps-rec-reprovar" class="${window.__psAval.recomendacao==='reprovar'?'on-re':''}" onclick="psRecSel('reprovar')">✕ Reprovar</button>
      </div></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psSalvarAval()">${ic('check')} Salvar avaliação</button>
    </div>`);
}
/* O critério vai pelo índice, não pelo nome: nome com aspas quebraria o onclick. */
function psNotaCr(btn, i, nn){
  const cr = PS_FASES_AVAL[window.__psAval.fase].crit[i];
  window.__psAval.criterios[cr] = nn;
  btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.toggle('on', b===btn));
}
function psRecSel(r){
  window.__psAval.recomendacao = r;
  const map = {aprovar:'on-ap', em_duvida:'on-du', reprovar:'on-re'};
  Object.keys(map).forEach(k=>{ document.getElementById('ps-rec-'+k).className = k===r ? map[k] : ''; });
}
async function psSalvarAval(){
  const {candId, fase, criterios, recomendacao} = window.__psAval;
  const notas = Object.values(criterios).filter(nn=>nn>0);
  if(!notas.length){ toast('Preencha ao menos um critério.', true); return; }
  const nota = Math.round(notas.reduce((s,nn)=>s+nn,0)/notas.length*100)/100;
  try{
    const {error} = await sb.from('ps_avaliacoes').upsert({
      candidato_id:candId, fase, criterios, nota,
      parecer: $('#ps-av-parecer').value.trim()||null,
      recomendacao, avaliador_id: state.perfil.id, avaliador: quemSouEu()
    }, {onConflict:'candidato_id,fase,avaliador_id'});
    if(error) throw error;
    toast('Avaliação salva.'); fechaModal();
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar avaliação'); }
}

/* ============================================================
   AGENDA — as janelas de horário que o candidato escolhe no site
   ============================================================ */
function psAgenda(){
  const fase = PS.faseAgenda;
  const slots = PS.slots.filter(s=>s.fase===fase);
  const porDia = {};
  slots.forEach(s=>{ (porDia[s.data]=porDia[s.data]||[]).push(s); });
  const ocup = s=> PS.agends.filter(a=>a.slot_id===s.id).length;
  $('#sel-corpo').innerHTML = `
  <div class="chips" style="margin-bottom:16px">
    <button class="chip ${fase==='dinamica'?'on':''}" onclick="PS.faseAgenda='dinamica';psAgenda()">Dinâmicas em grupo</button>
    <button class="chip ${fase==='entrevista'?'on':''}" onclick="PS.faseAgenda='entrevista';psAgenda()">Entrevistas individuais</button>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3>Abrir janela de horários</h3>
    <p class="small muted" style="margin:4px 0 14px">Gera vários horários de uma vez. O candidato escolhe um deles no site.</p>
    <div class="form-grid">
      <div class="fld"><label>Data</label><input id="ps-sl-data" type="date"></div>
      <div class="fld"><label>Local</label><input id="ps-sl-local" placeholder="Ex.: LABBIO, Sala de reunião"></div>
      <div class="fld"><label>Início</label><input id="ps-sl-ini" type="time" value="${fase==='dinamica'?'18:00':'14:00'}"></div>
      <div class="fld"><label>Fim</label><input id="ps-sl-fim" type="time" value="${fase==='dinamica'?'21:00':'18:00'}"></div>
      <div class="fld"><label>Duração (min)</label><input id="ps-sl-dur" type="number" value="${fase==='dinamica'?'90':'30'}"></div>
      <div class="fld"><label>Vagas por horário</label><input id="ps-sl-cap" type="number" value="${fase==='dinamica'?'8':'1'}"></div>
    </div>
    <button class="btn solid" onclick="psCriarSlots('${fase}')">${ic('plus')} Criar horários</button>
  </div>
  <div class="card">
    <h3 style="margin-bottom:14px">Horários abertos${slots.length?`: ${slots.length}`:''}</h3>
    ${Object.keys(porDia).sort().map(d=>`
      <div class="slot-dia"><h4>${new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'2-digit'})}</h4>
      <div class="slot-chips">${porDia[d].map(s=>{
        const o = ocup(s);
        return `<button class="slot-chip ${o>=s.capacidade?'cheio':''} ${s.ativo?'':'inativo'}" onclick="psAbrirSlot('${s.id}')">
          <div class="h">${psHm(s.hora_inicio)}–${psHm(s.hora_fim)}</div>
          <div class="o">${o}/${s.capacidade} vaga${s.capacidade>1?'s':''}${s.local?', '+esc(s.local):''}${s.ativo?'':', inativo'}</div>
        </button>`; }).join('')}</div></div>`).join('')
      || `<div class="empty">Nenhum horário de ${fase==='dinamica'?'dinâmica':'entrevista'} aberto ainda.</div>`}
  </div>`;
}
async function psCriarSlots(fase){
  const data=$('#ps-sl-data').value, ini=$('#ps-sl-ini').value, fim=$('#ps-sl-fim').value;
  const dur=parseInt($('#ps-sl-dur').value,10), cap=parseInt($('#ps-sl-cap').value,10), local=$('#ps-sl-local').value.trim();
  if(!data||!ini||!fim||!dur||!cap){ toast('Preencha data, horários, duração e vagas.', true); return; }
  const linhas=[]; let t = new Date(`${data}T${ini}:00`); const tf = new Date(`${data}T${fim}:00`);
  while(t < tf){
    const prox = new Date(t.getTime()+dur*60000);
    if(prox > tf) break;
    const h = x=> x.toTimeString().slice(0,5);
    linhas.push({edicao_id:PS.ed.id, fase, data, hora_inicio:h(t), hora_fim:h(prox), capacidade:cap, local:local||null});
    t = prox;
  }
  if(!linhas.length){ toast('Nenhum horário cabe nessa janela.', true); return; }
  try{
    const {error} = await sb.from('ps_slots').insert(linhas);
    if(error) throw error;
    toast(`${linhas.length} horário(s) criado(s).`);
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao criar horários'); }
}
function psAbrirSlot(id){
  const s = PS.slots.find(x=>x.id===id); if(!s) return;
  const ags = PS.agends.filter(a=>a.slot_id===id);
  abreModal(`
    <h3>${s.fase==='dinamica'?'Dinâmica':'Entrevista'}: ${fmtD(s.data)}, ${psHm(s.hora_inicio)}–${psHm(s.hora_fim)}</h3>
    <p class="small muted" style="margin:0 0 14px">${s.local?esc(s.local)+' · ':''}${ags.length}/${s.capacidade} vaga${s.capacidade>1?'s':''} ocupada${ags.length===1?'':'s'}</p>
    ${ags.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Candidato</th><th>Contato</th><th>Presença</th></tr></thead><tbody>
      ${ags.map(a=>{ const c=psCand(a.candidato_id);
        return `<tr><td><span class="nome">${esc(c?.nome||'—')}</span><br><span class="reg">${esc(c?.protocolo||'')}</span></td>
          <td class="small">${esc(c?.telefone||'')}<br>${esc(c?.email||'')}</td>
          <td><span class="seg">
            <button class="${a.compareceu===true?'on-ok':''}" onclick="psPresenca('${a.id}',true)">Sim</button>
            <button class="${a.compareceu===false?'on-bad':''}" onclick="psPresenca('${a.id}',false)">Não</button>
          </span></td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="empty">Nenhum candidato agendado neste horário.</div>'}
    <div class="acts" style="justify-content:space-between">
      <span style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn ${s.ativo?'ghost':'solid'}" onclick="psToggleSlot('${s.id}',${!s.ativo})">${s.ativo?'Desativar horário':'Reativar horário'}</button>
        <button class="btn perigo" onclick="psExcluirSlot('${s.id}',${ags.length})">${ic('trash')} Excluir</button>
      </span>
      <button class="btn ghost" onclick="fechaModal()">Fechar</button>
    </div>`, 'largo');
}
async function psPresenca(agId, vl){
  try{
    const {error} = await sb.from('ps_agendamentos').update({compareceu:vl}).eq('id', agId);
    if(error) throw error;
    const a = PS.agends.find(x=>x.id===agId); if(a){ a.compareceu=vl; psAbrirSlot(a.slot_id); }
    toast('Presença registrada.');
  }catch(e){ falha(e,'Falha ao registrar presença'); }
}
async function psToggleSlot(id, ativo){
  try{
    const {error} = await sb.from('ps_slots').update({ativo}).eq('id', id);
    if(error) throw error;
    toast(ativo?'Horário reativado.':'Horário desativado. Ele some do site.');
    fechaModal(); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao atualizar horário'); }
}
async function psExcluirSlot(id, qtd){
  if(!await confirma(qtd?`Este horário tem <b>${qtd}</b> agendamento(s), que serão <b>removidos</b> junto. Excluir mesmo assim?`
    :'Excluir este horário?','Excluir')) return;
  try{
    const {error} = await sb.from('ps_slots').delete().eq('id', id);
    if(error) throw error;
    toast('Horário excluído.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao excluir'); }
}

/* ============================================================
   DINÂMICA EM GRUPO
   O que a sala vê no dia — painel projetado, roteiro, casos do
   desafio, campos do registro, critérios e a mesa de cada janela — é
   editado aqui, e só aqui. As três páginas do site (dinamica.html,
   dinamica-painel.html, dinamica-avaliador.html) leem tudo do banco;
   nenhuma delas tem texto no código.

   Prepare-se por esta aba, não pela mesa do avaliador: aquela só abre
   durante o horário da janela, de propósito. Requer a soma_v12.
   ============================================================ */

/* campos de cada tipo de item: [chave, rótulo, formato, ajuda]
   formatos: txt (linha), area (parágrafo), num, lista (uma por linha) */
const PS_DIN_CAMPOS = {
  cartao:   [['titulo','Título','txt'],['texto','Texto','area','Duas ou três linhas. Vai grande no projetor.']],
  regra:    [['texto','A regra','area','Uma frase que se lê de longe.']],
  bloco:    [['nome','Nome do bloco','txt'],['minutos','Minutos','num'],
             ['fala','O que o avaliador faz','lista','Uma ação por linha. É o que ele lê no celular durante o bloco.'],
             ['projetor','O que vai no projetor','txt'],
             ['corte','Se atrasar','txt','O que cortar primeiro neste bloco — ou "Nunca".']],
  caso:     [['titulo','Título do caso','txt'],
             ['contexto','Quem é a pessoa e o que acontece hoje','area','Três ou quatro linhas: nome, idade, o que ela já faz por conta e o que trava.'],
             ['decisao','A decisão','area','Uma frase dizendo o que o grupo precisa escolher, com o prazo e o tamanho da equipe.'],
             ['opcoes','As três opções','lista','Uma por linha, começando pela letra. Cada uma diz o que é, quanto tempo leva e o que perde. As três precisam ser defensáveis: opção que ninguém escolheria não é opção, é enfeite.'],
             ['fala','A frase da pessoa','area','A fala que fecha o caso. É ela que pesa as opções de um jeito que a lista sozinha não pesa.'],
             ['pista','Pista de destravamento','area','A pergunta que o avaliador faz se o grupo travar.']],
  campo:    [['chave','Chave','txt','Sem espaço nem acento: é o nome interno do campo.'],
             ['rotulo','Rótulo','txt'],['ajuda','Texto de ajuda','area'],
             ['limite','Limite de caracteres','num'],['linhas','Altura em linhas','num']],
  criterio: [['nome','Critério','txt','Use o mesmo nome dos critérios da fase dinâmica, para a nota casar com a ficha.'],
             ['a1','Âncora — nota 1','area'],['a3','Âncora — nota 3','area'],['a5','Âncora — nota 5','area']],
  avaliador:[['nome','Nome','txt'],['cargo','Cargo na equipe','txt'],['curso','Curso','txt'],
             ['foto_url','Endereço da foto','txt','Opcional. Sem foto, o painel desenha as iniciais.'],
             ['fala','Uma linha sobre a pessoa','area','O que ela faz aqui, na voz de quem apresenta.']]
};
const PS_DIN_ROTULO = {cartao:'cartão', regra:'regra', bloco:'bloco', caso:'caso',
                       campo:'campo', criterio:'critério', avaliador:'avaliador'};

const psDinFaltaV12 = ()=> `<div class="aviso-box err"><b>Falta aplicar a migração.</b> A dinâmica em grupo
  depende da <b>db/aplicadas/soma_v12_ps_dinamica.sql</b>. Enquanto ela não rodar no Supabase, as três páginas
  do site (<b>dinamica.html</b>, <b>dinamica-painel.html</b> e <b>dinamica-avaliador.html</b>) não têm de onde
  ler o conteúdo.</div>
  <button class="btn ghost" onclick="psRecarregar()">Tentar de novo</button>`;

const psDinItens = (tipo, slot)=> PS.dinItens.filter(i=> i.tipo===tipo
  && (i.edicao_id===null || i.edicao_id===PS.ed.id)
  && (slot ? i.slot_id===slot : i.slot_id===null));
const psDinTitulo = (i)=> {
  const c = PS_DIN_CAMPOS[i.tipo]?.[0]?.[0];
  const v = i.dados?.[c];
  return v ? String(v).slice(0,90) : '(sem título)';
};

function psDinamica(){
  if(!PS.v12){ $('#sel-corpo').innerHTML = psDinFaltaV12(); return; }
  $('#sel-corpo').innerHTML = `
    <div class="chips" style="margin-bottom:16px">${PS_DIN_SUB.map(([k,l])=>
      `<a class="chip ${PS.dinSub===k?'on':''}" href="#/selecao/dinamica/${k}">${l}</a>`).join('')}</div>
    <div id="din-corpo"></div>`;
  ({painel:psDinPainel, roteiro:psDinRoteiro, desafio:psDinDesafio,
    criterios:psDinCriterios, janelas:psDinJanelas}[PS.dinSub]||psDinPainel)();
}

/* ---------- listas genéricas de item ---------- */
function psDinLista(tipo, slot, titulo, ajuda, extra){
  const itens = psDinItens(tipo, slot);
  const rot = PS_DIN_ROTULO[tipo] || tipo;
  return `<div class="card" style="margin-bottom:16px">
    <h3>${titulo}</h3>
    ${ajuda ? `<p class="small muted" style="margin:4px 0 14px;line-height:1.6">${ajuda}</p>`:''}
    <div style="margin-bottom:14px;display:flex;gap:8px;flex-wrap:wrap">
      ${extra||''}
      <button class="btn ${extra?'ghost':'solid'} mini" onclick="psDinEditar('${tipo}',null,${slot?`'${slot}'`:'null'})">
        ${ic('plus')} Novo ${rot}</button></div>
    ${itens.map(i=>`<div class="pub-row">
      <div style="min-width:0;flex:1">
        <div class="tt">${esc(psDinTitulo(i))}</div>
        <div class="mt">ordem ${i.ordem}${i.tipo==='bloco'&&i.dados?.minutos?` · ${i.dados.minutos} min`:''}${
          i.tipo==='avaliador'&&i.dados?.registro!=null?` · ficha ${i.dados.registro}`:''}${
          i.edicao_id===null?' · todas as edições':''}</div>
      </div>
      <span class="badge-pub ${i.ativo?'sim':''}">${i.ativo?'No ar':'Oculto'}</span>
      ${ibtn('pencil','Editar',`psDinEditar('${i.tipo}','${i.id}',${slot?`'${slot}'`:'null'})`,'sm')}
      <button class="btn ${i.ativo?'ghost':'solid'} mini" onclick="psDinAtivo('${i.id}',${!i.ativo})">
        ${i.ativo?'Ocultar':'Publicar'}</button>
      ${ibtn('trash','Excluir',`psDinExcluir('${i.id}')`,'sm perigo')}
    </div>`).join('') || `<div class="empty">Nenhum ${rot} cadastrado.</div>`}
  </div>`;
}

function psDinEditar(tipo, id, slot){
  const it = id ? PS.dinItens.find(x=>x.id===id) : null;
  const campos = PS_DIN_CAMPOS[tipo] || [];
  const d = it?.dados || {};
  const prox = Math.max(0, ...psDinItens(tipo, slot).map(x=>x.ordem)) + 10;
  const entrada = ([k,l,f,aj])=>{
    const v = d[k];
    const corpo = f==='area'  ? `<textarea id="din-${k}" style="min-height:90px">${esc(v||'')}</textarea>`
                : f==='lista' ? `<textarea id="din-${k}" style="min-height:110px">${esc((v||[]).join('\n'))}</textarea>`
                : f==='num'   ? `<input id="din-${k}" type="number" value="${esc(v ?? '')}">`
                :               `<input id="din-${k}" value="${esc(v||'')}">`;
    return `<div class="fld"><label>${l}</label>${corpo}
      ${aj?`<div class="mini">${aj}</div>`:''}</div>`;
  };
  const daFicha = tipo==='avaliador' && d.registro!=null;
  abreModal(`
    <h3>${it?'Editar':'Novo'} ${PS_DIN_ROTULO[tipo]||tipo}</h3>
    ${daFicha ? `<div class="aviso-box info" style="margin-top:10px">Veio da ficha de
      <b>${esc(nomeDe(d.registro))}</b>. Editar aqui não mexe no quadro.
      <button class="btn ghost mini" style="margin-left:8px" onclick="psDinMesaAtualizar('${it.id}')">
        Atualizar pela ficha</button></div>` : ''}
    <div style="margin-top:12px">${campos.map(entrada).join('')}</div>
    <div class="fld"><label>Ordem</label>
      <input id="din-ordem" type="number" step="10" value="${it?.ordem ?? prox}"></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psDinSalvar('${tipo}',${it?`'${it.id}'`:'null'},${slot?`'${slot}'`:'null'})">
        ${ic('check')} Salvar</button>
    </div>`, 'largo');
}

async function psDinSalvar(tipo, id, slot){
  const dados = {};
  for(const [k,l,f] of (PS_DIN_CAMPOS[tipo]||[])){
    const el = $('#din-'+k); if(!el) continue;
    const v = el.value;
    if(f==='lista') dados[k] = v.split('\n').map(x=>x.trim()).filter(Boolean);
    else if(f==='num') dados[k] = v === '' ? null : Number(v);
    else dados[k] = v.trim();
  }
  /* o avaliador que veio da ficha guarda o registro, para "Atualizar pela ficha" */
  const it = id ? PS.dinItens.find(x=>x.id===id) : null;
  if(it?.dados?.registro!=null) dados.registro = it.dados.registro;
  const primeiro = PS_DIN_CAMPOS[tipo]?.[0]?.[0];
  if(primeiro && !dados[primeiro]){ toast('Preencha pelo menos o primeiro campo.', true); return; }
  const linha = {tipo, ordem: Number($('#din-ordem').value)||100, dados,
                 edicao_id: PS.ed.id, slot_id: slot || null};
  try{
    const q = id ? sb.from('ps_din_itens').update({ordem:linha.ordem, dados}).eq('id', id)
                 : sb.from('ps_din_itens').insert(linha);
    const {error} = await q;
    if(error) throw error;
    toast('Salvo.'); fechaModal(); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e, 'Falha ao salvar'); }
}

async function psDinAtivo(id, ativo){
  try{
    const {error} = await sb.from('ps_din_itens').update({ativo}).eq('id', id);
    if(error) throw error;
    toast(ativo?'No ar na próxima janela.':'Oculto.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao atualizar'); }
}

async function psDinExcluir(id){
  const i = PS.dinItens.find(x=>x.id===id);
  if(!await confirma(`Excluir "<b>${esc(psDinTitulo(i||{}))}</b>"?`,'Excluir')) return;
  try{
    const {error} = await sb.from('ps_din_itens').delete().eq('id', id);
    if(error) throw error;
    toast('Excluído.'); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao excluir'); }
}

/* ---------- configuração da edição ---------- */
const psDinCfg = ()=> PS.dinCfg || {titulo:'Dinâmica em grupo', desafio_titulo:'Sprint da bancada',
  minutos_total:75, tam_grupo:5, tolerancia_antes:30, tolerancia_depois:30};

async function psDinSalvarCfg(campos){
  const linha = {edicao_id: PS.ed.id, atualizado_por: quemSouEu(), atualizado_em: new Date().toISOString()};
  for(const k of campos){
    const el = $('#dcfg-'+k); if(!el) continue;
    linha[k] = el.type === 'number' ? (Number(el.value) || null) : (el.value.trim() || null);
  }
  /* colunas not null não aceitam vazio: devolve o padrão */
  if('titulo' in linha && !linha.titulo) linha.titulo = 'Dinâmica em grupo';
  if('desafio_titulo' in linha && !linha.desafio_titulo) linha.desafio_titulo = 'Sprint da bancada';
  for(const [k,v] of [['minutos_total',75],['tam_grupo',5],['tolerancia_antes',30],['tolerancia_depois',30]])
    if(k in linha && !linha[k]) linha[k] = v;
  try{
    const {error} = await sb.from('ps_din_config').upsert(linha, {onConflict:'edicao_id'});
    if(error) throw error;
    toast('Configuração salva.'); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar'); }
}

/* ---------- sub-aba: painel ---------- */
function psDinPainel(){
  const c = psDinCfg();
  $('#din-corpo').innerHTML = `
  <div class="aviso-box info">O que está aqui é o que aparece no projetor durante a dinâmica.
    O painel abre em <b>selecao.neurodynamics.dev/dinamica-painel.html</b>, com o código da janela.</div>

  <div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:14px">Abertura</h3>
    <div class="form-grid">
      <div class="fld"><label>Título</label><input id="dcfg-titulo" value="${esc(c.titulo||'')}"></div>
      <div class="fld"><label>Subtítulo</label><input id="dcfg-subtitulo" value="${esc(c.subtitulo||'')}"></div>
    </div>
    <div class="fld"><label>Resumo da equipe</label>
      <textarea id="dcfg-resumo_equipe" style="min-height:90px">${esc(c.resumo_equipe||'')}</textarea>
      <div class="mini">Duas ou três linhas, na tela "A NeuroDynamics".</div></div>
    <div class="fld"><label>Aviso de imagem e registro</label>
      <textarea id="dcfg-aviso_lgpd" style="min-height:70px">${esc(c.aviso_lgpd||'')}</textarea></div>
    <div class="form-grid">
      <div class="fld"><label>Wi-Fi da sala</label><input id="dcfg-wifi_rede" value="${esc(c.wifi_rede||'')}"
        placeholder="Nome da rede"></div>
      <div class="fld"><label>Senha do Wi-Fi</label><input id="dcfg-wifi_senha" value="${esc(c.wifi_senha||'')}"></div>
    </div>
    <button class="btn solid" onclick="psDinSalvarCfg(['titulo','subtitulo','resumo_equipe','aviso_lgpd','wifi_rede','wifi_senha'])">
      ${ic('check')} Salvar abertura</button>
  </div>

  ${psDinLista('cartao', null, 'Cartões da equipe',
    'Os blocos da tela "A NeuroDynamics". Três ou quatro funcionam melhor que seis: quem está na sala lê de longe.')}

  ${psDinLista('regra', null, 'Regras da sala',
    'O combinado que o avaliador lê em voz alta na abertura. Uma frase cada.')}`;
}

/* ---------- sub-aba: roteiro ---------- */
function psDinRoteiro(){
  const c = psDinCfg();
  const blocos = psDinItens('bloco', null);
  const soma = blocos.filter(b=>b.ativo).reduce((s,b)=>s + (Number(b.dados?.minutos)||0), 0);
  const cabe = soma <= (c.minutos_total||75);
  $('#din-corpo').innerHTML = `
  <div class="aviso-box ${cabe?'info':'warn'}">
    Os blocos somam <b>${soma} min</b> de <b>${c.minutos_total||75} min</b> de janela.
    ${cabe ? `Sobram ${(c.minutos_total||75)-soma} min de folga — é a margem para a sala que atrasa.`
           : 'Não cabe. Corte blocos ou aumente a duração da janela abaixo.'}
  </div>

  <div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:14px">A janela</h3>
    <div class="form-grid">
      <div class="fld"><label>Duração total (min)</label>
        <input id="dcfg-minutos_total" type="number" value="${c.minutos_total||75}"></div>
      <div class="fld"><label>Pessoas por grupo</label>
        <input id="dcfg-tam_grupo" type="number" value="${c.tam_grupo||5}"></div>
      <div class="fld"><label>Abre quantos min antes</label>
        <input id="dcfg-tolerancia_antes" type="number" value="${c.tolerancia_antes ?? 30}"></div>
      <div class="fld"><label>Fecha quantos min depois</label>
        <input id="dcfg-tolerancia_depois" type="number" value="${c.tolerancia_depois ?? 30}"></div>
    </div>
    <p class="small muted" style="margin:-2px 0 14px;line-height:1.7">
      As duas tolerâncias definem quando as páginas da dinâmica existem. Antes e depois desse
      intervalo, a mesa do avaliador, o painel e a página do candidato não devolvem nada —
      nem para quem tem login. Trinta minutos dão folga para montar a sala sem deixar a página
      aberta o dia inteiro.</p>
    <button class="btn solid" onclick="psDinSalvarCfg(['minutos_total','tam_grupo','tolerancia_antes','tolerancia_depois'])">
      ${ic('check')} Salvar</button>
  </div>

  ${psDinLista('bloco', null, 'Blocos do roteiro',
    'A ordem aqui é a ordem da dinâmica. O que estiver em "o que o avaliador faz" aparece na mesa dele, no celular, quando o bloco chega.')}`;
}

/* ---------- sub-aba: desafio ---------- */
function psDinDesafio(){
  const c = psDinCfg();
  $('#din-corpo').innerHTML = `
  <div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:14px">O briefing</h3>
    <div class="fld"><label>Título do desafio</label>
      <input id="dcfg-desafio_titulo" value="${esc(c.desafio_titulo||'')}"></div>
    <div class="fld"><label>Contexto lido em voz alta</label>
      <textarea id="dcfg-desafio_contexto" style="min-height:110px">${esc(c.desafio_contexto||'')}</textarea>
      <div class="mini">Aparece no projetor e no celular do candidato.
        Diga o que se espera e o que não se cobra — quem nunca viu uma bancada precisa ouvir isso.</div></div>
    <button class="btn solid" onclick="psDinSalvarCfg(['desafio_titulo','desafio_contexto'])">
      ${ic('check')} Salvar briefing</button>
  </div>

  ${psDinLista('caso', null, 'Casos',
    'Um caso por grupo, distribuídos na hora pela mesa. Tenha pelo menos tantos casos quanto o maior número de grupos que uma janela pode ter — com 15 candidatos e grupos de 5, três casos.')}

  ${psDinLista('campo', null, 'Campos do registro',
    'O que cada grupo preenche no celular. Cinco campos curtos rendem mais que dois longos: obrigam a decidir. Mudar a <b>chave</b> de um campo depois da dinâmica desliga o texto já gravado — crie um campo novo em vez disso.')}`;
}

/* ---------- sub-aba: critérios ---------- */
function psDinCriterios(){
  const crits = psDinItens('criterio', null).filter(c=>c.ativo).map(c=>c.dados?.nome);
  const oficiais = PS_FASES_AVAL.dinamica.crit;
  const fora = crits.filter(c=>c && !oficiais.includes(c));
  $('#din-corpo').innerHTML = `
  <div class="aviso-box ${fora.length?'warn':'info'}">
    A nota lançada na mesa cai na ficha do candidato, fase <b>dinâmica</b>, com o nome de quem avaliou.
    ${fora.length ? `Estes critérios não batem com os da aba Avaliação e vão aparecer separados na ficha:
      <b>${fora.map(esc).join(', ')}</b>.`
    : 'Os critérios daqui batem com os da aba Avaliação — as duas telas mostram a mesma coisa.'}
  </div>
  ${psDinLista('criterio', null, 'Critérios e âncoras',
    'A âncora é o que separa uma nota 3 de uma nota 5 na cabeça de dois avaliadores diferentes. Escreva comportamento observável, não qualidade abstrata — é o que faz duas mesas darem notas comparáveis.')}`;
}

/* ---------- sub-aba: janelas ---------- */
function psDinJanelas(){
  const slots = PS.slots.filter(s=>s.fase==='dinamica');
  const ocup = s=> PS.agends.filter(a=>a.slot_id===s.id).length;
  const site = SITE_PS;
  if(PS.dinJanela){
    const s = slots.find(x=>x.id===PS.dinJanela);
    if(s) return psDinJanela(s);
    PS.dinJanela = null;
  }
  $('#din-corpo').innerHTML = `
  <div class="aviso-box info">Cada janela tem um <b>código de quatro letras</b>: é ele que o candidato
    digita, que vira o QR do painel e que abre a mesa do avaliador. A janela em si é criada na aba
    <a href="#/selecao/agenda" style="text-decoration:underline">Agenda</a>.</div>
  ${slots.map(s=>`<div class="pub-row">
    <div style="min-width:0;flex:1">
      <div class="tt">${fmtD(s.data)} · ${psHm(s.hora_inicio)}–${psHm(s.hora_fim)}</div>
      <div class="mt">${esc(s.local||'sem local')} · ${ocup(s)}/${s.capacidade} agendados${s.ativo?'':' · inativa'}</div>
    </div>
    <span class="pill mono" style="letter-spacing:.16em">${s.codigo ? esc(s.codigo) : '— sem código —'}</span>
    <button class="btn ghost mini" onclick="PS.dinJanela='${s.id}';psDinamica()">Preparar</button>
  </div>`).join('') || '<div class="empty">Nenhuma janela de dinâmica na agenda. Crie em Seleção › Agenda.</div>'}
  <p class="small muted" style="margin-top:12px;line-height:1.7">
    Endereços do dia: painel em <b>${esc(site)}/dinamica-painel.html</b>,
    mesa do avaliador em <b>${esc(site)}/dinamica-avaliador.html</b>,
    registro do candidato em <b>${esc(site)}/dinamica.html</b>.</p>`;
}

function psDinJanela(s){
  const site = SITE_PS;
  const ags = PS.agends.filter(a=>a.slot_id===s.id);
  const cod = s.codigo || '';
  $('#din-corpo').innerHTML = `
  <button class="btn ghost mini" style="margin-bottom:14px" onclick="PS.dinJanela=null;psDinamica()">${ic('back')} Todas as janelas</button>

  <div class="card" style="margin-bottom:16px">
    <h3>${fmtD(s.data)}, ${psHm(s.hora_inicio)}–${psHm(s.hora_fim)}</h3>
    <p class="small muted" style="margin:4px 0 16px">${esc(s.local||'sem local definido')} ·
      ${ags.length} de ${s.capacidade} lugares ocupados</p>

    ${cod ? `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:16px">
      <div><div class="ps-rot" style="margin:0 0 4px">Código da sala</div>
        <div class="ps-codigo">${esc(cod)}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn ghost mini" href="${esc(site)}/dinamica-painel.html#${esc(cod)}" target="_blank" rel="noopener">Abrir painel ↗</a>
        <a class="btn ghost mini" href="${esc(site)}/dinamica-avaliador.html" target="_blank" rel="noopener">Abrir a mesa ↗</a>
        <button class="btn ghost mini" onclick="copiar('${esc(site)}/dinamica.html#${esc(cod)}')">${ic('copy')} Link do candidato</button>
      </div></div>`
    : `<div class="aviso-box warn">Esta janela ainda não tem código (foi criada antes da migração).
        <button class="btn ghost mini" style="margin-left:8px" onclick="psDinGerarCodigo('${s.id}')">Gerar código</button></div>`}

    <p class="small muted" style="line-height:1.7">A mesa e o painel só respondem entre
      <b>${psHm(s.hora_inicio)} menos ${psDinCfg().tolerancia_antes ?? 30} min</b> e
      <b>${psHm(s.hora_fim)} mais ${psDinCfg().tolerancia_depois ?? 30} min</b> do dia
      ${fmtD(s.data)}. Fora disso não sai candidato, grupo nem roteiro — nem com login.</p>
  </div>

  ${psDinLista('avaliador', s.id, 'A mesa desta janela',
    'Quem aparece na tela "Quem avalia" do projetor. Escolha pelo quadro: nome, cargo, curso e foto vêm da ficha da pessoa. Cadastre só quem vai estar na sala neste horário, porque cada janela tem a sua lista.',
    `<button class="btn solid mini" onclick="psDinMesaEscolher('${s.id}')">${ic('users')} Escolher do quadro</button>`)}

  <div class="card">
    <h3 style="margin-bottom:12px">Quem vem</h3>
    ${ags.length ? `<div class="wrap"><table class="tabela trabalho"><thead><tr><th>Candidato</th><th>Curso</th><th>Acessibilidade</th></tr></thead>
      <tbody>${ags.map(a=>{ const c = psCand(a.candidato_id); return `<tr>
        <td><span class="nome">${esc(c?.nome||'—')}</span><br><span class="reg">${esc(c?.protocolo||'')}</span></td>
        <td class="small">${esc(c?.curso||'—')}</td>
        <td class="small">${c?.acessibilidade ? esc(c.acessibilidade) : '—'}</td></tr>`; }).join('')}
      </tbody></table></div>`
    : '<div class="empty">Ninguém agendado ainda.</div>'}
  </div>`;
}

/* ---------- a mesa da janela, a partir do quadro ----------
   Quem avalia já está no quadro: nome, cargo, foto e, nos dados
   pessoais, o curso. Aqui a pessoa é escolhida na lista e os campos vêm
   dela. O que fica gravado em ps_din_itens é uma cópia, não uma junção:
   o painel é público e nunca toca em membros nem em dados_pessoais. O
   registro fica junto para dar o botão de atualizar depois. */

/* A cascata de extensões de fotos/<registro>.<ext> é do portal; o
   painel é outra página e não a tem. Resolvemos aqui e gravamos a URL
   que carrega de verdade, para não sobrar foto quebrada no projetor. */
function psDinFoto(m){
  if(m.foto_url) return Promise.resolve(m.foto_url);
  if(m.registro == null) return Promise.resolve('');
  return new Promise(res=>{
    let i = 0, pronto = false;
    const fim = (v)=>{ if(!pronto){ pronto = true; res(v); } };
    setTimeout(()=>fim(''), 6000);          /* rede lenta não trava o salvamento */
    const tenta = ()=>{
      if(pronto) return;
      if(i >= FOTO_EXTS.length) return fim('');
      const url = FOTOS_BASE + m.registro + '.' + FOTO_EXTS[i++];
      const img = new Image();
      img.onload = ()=> fim(url);
      img.onerror = tenta;
      img.src = url;
    };
    tenta();
  });
}

/* O curso mora em dados_pessoais, que só admin/pessoal lê. Quem prepara
   a mesa com papel "selecao" recebe o campo vazio e preenche à mão. */
async function psDinCursos(regs){
  if(!can() || !regs.length) return {};
  try{
    const {data, error} = await sb.from('dados_pessoais').select('registro,curso').in('registro', regs);
    if(error) throw error;
    return Object.fromEntries((data||[]).map(d=>[d.registro, d.curso||'']));
  }catch(e){ return {}; }
}

const psDinMesaDe = (slot)=> psDinItens('avaliador', slot);
const psDinRegDe  = (i)=> i?.dados?.registro ?? null;

function psDinMesaEscolher(slot){
  const jaTem = new Set(psDinMesaDe(slot).map(psDinRegDe).filter(r=>r!=null));
  PS.mesaSel = new Set(jaTem);
  PS.mesaBusca = '';
  abreModal(`
    <h3>Montar a mesa pelo quadro</h3>
    <p class="small muted" style="margin:4px 0 12px;line-height:1.7">Marque quem vai estar na sala
      neste horário. Nome, cargo, curso e foto vêm da ficha da pessoa; depois dá para ajustar cada
      um e escrever a linha de apresentação.</p>
    <div class="fld"><input id="mesa-q" placeholder="Buscar por nome, cargo ou departamento"
      oninput="PS.mesaBusca=this.value;psDinMesaCorpo()"></div>
    <div id="mesa-lista" style="max-height:46vh;overflow:auto;margin-bottom:6px"></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="mesa-salvar" onclick="psDinMesaSalvar('${slot}')">${ic('check')} Salvar mesa</button>
    </div>`, 'largo');
  psDinMesaCorpo();
  setTimeout(()=>$('#mesa-q')?.focus(), 60);
}

function psDinMesaCorpo(){
  const q = norm(PS.mesaBusca||'');
  const lista = state.membros
    .filter(m=> m.status === 'Ativo')
    .filter(m=> !q || [m.nome, m.cargo, m.departamento].some(v=>norm(v).includes(q)))
    .sort((a,b)=> String(a.nome||'').localeCompare(String(b.nome||''), 'pt-BR'));
  const el = $('#mesa-lista'); if(!el) return;
  el.innerHTML = lista.map(m=>{
    const on = PS.mesaSel.has(m.registro);
    return `<button class="pub-row ${on?'on':''}" aria-pressed="${on}" onclick="psDinMesaMarca(${m.registro})">
      ${avatarFoto(m, 32, 11)}
      <div style="min-width:0;flex:1">
        <div class="tt">${esc(m.nome||'')}</div>
        <div class="mt">${esc(m.cargo||'sem cargo')}${m.departamento?' · '+esc(m.departamento):''}</div>
      </div>
      <span class="badge-pub ${on?'sim':''}">${on?'na mesa':'incluir'}</span>
    </button>`;
  }).join('') || '<div class="empty">Nenhum membro ativo bate com a busca.</div>';
}

function psDinMesaMarca(reg){
  PS.mesaSel.has(reg) ? PS.mesaSel.delete(reg) : PS.mesaSel.add(reg);
  psDinMesaCorpo();
}

async function psDinMesaSalvar(slot){
  const atuais = psDinMesaDe(slot);
  const porReg = new Map(atuais.filter(i=>psDinRegDe(i)!=null).map(i=>[psDinRegDe(i), i]));
  const novos  = [...PS.mesaSel].filter(r=>!porReg.has(r));
  const saem   = [...porReg.entries()].filter(([r])=>!PS.mesaSel.has(r)).map(([,i])=>i.id);

  if(!novos.length && !saem.length){ toast('Nada mudou na mesa.'); fechaModal(); return; }
  const bt = $('#mesa-salvar'); if(bt) bt.disabled = true;
  try{
    if(saem.length){
      const {error} = await sb.from('ps_din_itens').delete().in('id', saem);
      if(error) throw error;
    }
    if(novos.length){
      const cursos = await psDinCursos(novos);
      let ordem = Math.max(0, ...atuais.map(i=>i.ordem));
      const linhas = [];
      for(const reg of novos){
        const m = state.membros.find(x=>x.registro===reg); if(!m) continue;
        ordem += 10;
        linhas.push({tipo:'avaliador', edicao_id:PS.ed.id, slot_id:slot, ordem,
          dados:{registro:reg, nome:m.nome||'', cargo:m.cargo||'',
                 curso:cursos[reg]||'', foto_url: await psDinFoto(m), fala:''}});
      }
      if(linhas.length){
        const {error} = await sb.from('ps_din_itens').insert(linhas);
        if(error) throw error;
      }
    }
    toast(`Mesa salva: ${novos.length} incluído(s), ${saem.length} retirado(s).`);
    fechaModal(); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar a mesa'); }
  finally{ if(bt) bt.disabled = false; }
}

/* Cargo mudou no quadro depois que a mesa foi montada? Um botão relê a
   ficha e regrava nome, cargo, curso e foto, preservando a linha de fala. */
async function psDinMesaAtualizar(id){
  const it = PS.dinItens.find(x=>x.id===id);
  const reg = psDinRegDe(it);
  const m = reg!=null && state.membros.find(x=>x.registro===reg);
  if(!m){ toast('Este avaliador não veio do quadro.', true); return; }
  try{
    const cursos = await psDinCursos([reg]);
    const dados = {...it.dados, nome:m.nome||'', cargo:m.cargo||'',
                   curso: cursos[reg] ?? it.dados.curso ?? '',
                   foto_url: await psDinFoto(m)};
    const {error} = await sb.from('ps_din_itens').update({dados}).eq('id', id);
    if(error) throw error;
    toast('Atualizado pela ficha de '+(m.nome||'').split(' ')[0]+'.');
    fechaModal(); PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao atualizar'); }
}

async function psDinGerarCodigo(slotId){
  try{
    const {data, error} = await sb.rpc('ps_din_codigo_gerar', {p_slot:slotId});
    if(error) throw error;
    if(data?.status !== 'ok') throw new Error(data?.status || 'erro');
    toast('Código '+data.codigo+' gerado.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao gerar o código'); }
}

/* ============================================================
   FAQ DO SITE
   ============================================================ */
const psFaltaV11 = (oque)=> `<div class="aviso-box err"><b>Falta aplicar a migração.</b> Para editar ${oque}
  por aqui, rode a <b>db/aplicadas/soma_v11_ps_faq.sql</b> no Supabase. Enquanto isso o site continua
  no ar, usando a lista de reserva que está no código dele.</div>`;

function psFaq(){
  if(!PS.v11){ $('#sel-corpo').innerHTML = psFaltaV11('as perguntas frequentes'); return; }
  $('#sel-corpo').innerHTML = `
  <div class="aviso-box info">Estas são as perguntas frequentes da página inicial do site.
    Só as <b>publicadas</b> aparecem, na ordem definida em cada uma. Deixe "vale para" em
    <b>todas as edições</b> para a pergunta continuar valendo nos próximos processos.</div>
  <div style="margin-bottom:14px"><button class="btn solid" onclick="psEditarFaq()">${ic('plus')} Nova pergunta</button></div>
  ${PS.faq.map(f=>`<div class="pub-row">
    <div style="min-width:0;flex:1">
      <div class="tt">${esc(f.pergunta)}</div>
      <div class="mt">ordem ${f.ordem} · ${f.edicao_id ? esc(PS.edicoes.find(e=>e.id===f.edicao_id)?.nome||'edição específica') : 'todas as edições'}</div>
    </div>
    <span class="badge-pub ${f.publicada?'sim':''}">${f.publicada?'No ar':'Oculta'}</span>
    ${ibtn('pencil','Editar',`psEditarFaq('${f.id}')`,'sm')}
    <button class="btn ${f.publicada?'ghost':'solid'} mini" onclick="psPublicarFaq('${f.id}',${!f.publicada})">
      ${f.publicada?'Ocultar':'Publicar'}</button>
    ${ibtn('trash','Excluir',`psExcluirFaq('${f.id}')`,'sm perigo')}
  </div>`).join('') || '<div class="empty">Nenhuma pergunta cadastrada.</div>'}`;
}

function psEditarFaq(id){
  const f = id ? PS.faq.find(x=>x.id===id) : null;
  const prox = Math.max(0, ...PS.faq.map(x=>x.ordem)) + 10;
  abreModal(`
    <h3>${f?'Editar pergunta':'Nova pergunta'}</h3>
    <div class="fld" style="margin-top:12px"><label>Pergunta</label>
      <input id="ps-fq-perg" value="${esc(f?.pergunta||'')}" placeholder="Ex.: Preciso ser aluno da UFMG para participar?"></div>
    <div class="fld"><label>Resposta</label>
      <textarea id="ps-fq-resp" style="min-height:150px" placeholder="A resposta como o candidato vai ler.">${esc(f?.resposta||'')}</textarea>
      <div class="mini">Formatação que o site entende: <b>*negrito*</b>, <b>[texto](https://link)</b> e linha em
        branco para separar parágrafos. HTML digitado aqui aparece como texto — não é interpretado.</div></div>
    <div class="form-grid">
      <div class="fld"><label>Ordem no site</label>
        <input id="ps-fq-ordem" type="number" value="${f?.ordem ?? prox}" step="10"></div>
      <div class="fld"><label>Vale para</label>
        <select id="ps-fq-edicao">
          <option value="">Todas as edições</option>
          ${PS.edicoes.map(e=>`<option value="${e.id}" ${f?.edicao_id===e.id?'selected':''}>${esc(e.nome)}</option>`).join('')}
        </select></div>
    </div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psSalvarFaq(${f?`'${f.id}'`:'null'})">${ic('check')} Salvar</button>
    </div>`, 'largo');
}

async function psSalvarFaq(id){
  const linha = { pergunta:$('#ps-fq-perg').value.trim(), resposta:$('#ps-fq-resp').value.trim(),
    ordem: Number($('#ps-fq-ordem').value) || 100, edicao_id: $('#ps-fq-edicao').value || null };
  if(!linha.pergunta || !linha.resposta){ toast('Preencha pergunta e resposta.', true); return; }
  try{
    const q = id ? sb.from('ps_faq').update(linha).eq('id', id)
                 : sb.from('ps_faq').insert(linha);
    const {error} = await q;
    if(error) throw error;
    toast('Pergunta salva.'); fechaModal();
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar a pergunta'); }
}

async function psPublicarFaq(id, publicar){
  try{
    const {error} = await sb.from('ps_faq').update({publicada:publicar}).eq('id', id);
    if(error) throw error;
    toast(publicar?'No ar.':'Oculta no site.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao atualizar'); }
}

async function psExcluirFaq(id){
  const f = PS.faq.find(x=>x.id===id);
  if(!await confirma(`Excluir "<b>${esc(f?.pergunta||'')}</b>"?`,'Excluir')) return;
  try{
    const {error} = await sb.from('ps_faq').delete().eq('id', id);
    if(error) throw error;
    toast('Pergunta excluída.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao excluir'); }
}

/* ============================================================
   COMPETÊNCIAS DO CANDIDATO
   Um clique marca o que a pessoa já tem, outro passa para o que quer
   desenvolver, o terceiro solta.
   ============================================================ */
function psCompsChips(c){
  const linha = (lista, cls)=> lista?.length
    ? lista.map(t=>`<span class="chip mini ${cls}">${esc(t)}</span>`).join(' ') : '<span class="dim">—</span>';
  return `<div class="it"><dt>Já tem experiência</dt><dd>${linha(c.competencias,'tem')}</dd></div>
    <div class="it"><dt>Quer desenvolver</dt><dd>${linha(c.competencias_desejadas,'quer')}</dd></div>`;
}

/* rascunho da edição; só vai ao banco quando a pessoa salva */
let psCompEdit = null;
function psEditarComps(id){
  const c = psCand(id); if(!c) return;
  if(!PS.v11 && !PS.competencias.length){ abreModal(psFaltaV11('as competências')+
    `<div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="psAbrirFicha('${c.id}')">Voltar à ficha</button></div>`); return; }
  psCompEdit = { id, tem:[...(c.competencias||[])], quer:[...(c.competencias_desejadas||[])] };
  abreModal(`
    <h3>Competências de ${esc(c.nome.split(' ')[0])}</h3>
    <p class="small muted" style="margin:4px 0 14px">Um clique marca o que a pessoa <b>já tem</b>,
      outro passa para o que <b>quer desenvolver</b>, o terceiro solta. Vale ajustar ao longo das
      fases — a dinâmica e a entrevista costumam revelar o que a inscrição não mostrou.</p>
    <div id="comp-corpo">${psCompsCorpo()}</div>
    <div class="fld" style="margin-top:14px"><label>Acrescentar uma etiqueta fora do catálogo</label>
      <div style="display:flex;gap:8px">
        <input id="comp-nova" placeholder="Ex.: Libras" onkeydown="if(event.key==='Enter'){event.preventDefault();psCompNova()}">
        <button class="btn ghost" onclick="psCompNova()">Incluir</button>
      </div></div>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="psAbrirFicha('${c.id}')">Cancelar</button>
      <button class="btn solid" onclick="psSalvarComps()">${ic('check')} Salvar</button>
    </div>`, 'largo');
}

function psCompsCorpo(){
  const cat = PS.competencias.filter(c=>c.ativa);
  const grupos = [];
  for(const c of cat){
    const g = grupos.find(x=>x[0]===c.grupo);
    (g ? g[1] : (grupos.push([c.grupo,[]]), grupos[grupos.length-1][1])).push(c.nome);
  }
  /* etiqueta que a pessoa tem mas que saiu do catálogo continua à vista */
  const fora = [...psCompEdit.tem, ...psCompEdit.quer].filter(t=>!cat.some(c=>c.nome===t));
  if(fora.length) grupos.push(['Fora do catálogo', [...new Set(fora)]]);
  const todos = grupos.flatMap(([,itens])=>itens);
  psCompEdit.nomes = todos;
  const chip = n=>{
    const cls = psCompEdit.tem.includes(n) ? 'tem' : psCompEdit.quer.includes(n) ? 'quer' : '';
    /* pelo índice, não pelo nome: aspas no nome quebrariam o onclick */
    return `<button type="button" class="cch ${cls}" onclick="psCompCicla(this,${todos.indexOf(n)})">${esc(n)}</button>`;
  };
  return grupos.map(([g,itens])=>`<div class="comp-bloco"><h5>${esc(g)}</h5>
    <div class="comp-sel">${itens.map(chip).join('')}</div></div>`).join('')
    || '<p class="small muted">Catálogo vazio — use o campo abaixo para incluir etiquetas.</p>';
}

function psCompCicla(btn, i){
  const nome = psCompEdit.nomes[i];
  const t = psCompEdit.tem.indexOf(nome), q = psCompEdit.quer.indexOf(nome);
  if(t<0 && q<0){ psCompEdit.tem.push(nome); btn.className='cch tem'; }
  else if(t>=0){ psCompEdit.tem.splice(t,1); psCompEdit.quer.push(nome); btn.className='cch quer'; }
  else { psCompEdit.quer.splice(q,1); btn.className='cch'; }
}

function psCompNova(){
  const el = $('#comp-nova'), nome = el.value.trim();
  if(!nome) return;
  if(psCompEdit.tem.includes(nome) || psCompEdit.quer.includes(nome)){ toast('Essa etiqueta já está na ficha.', true); return; }
  psCompEdit.tem.push(nome);
  el.value = '';
  $('#comp-corpo').innerHTML = psCompsCorpo();
}

async function psSalvarComps(){
  try{
    const {error} = await sb.from('ps_candidatos')
      .update({competencias: psCompEdit.tem, competencias_desejadas: psCompEdit.quer})
      .eq('id', psCompEdit.id);
    if(error) throw error;
    toast('Competências atualizadas.');
    const c = psCand(psCompEdit.id);
    if(c){ c.competencias = [...psCompEdit.tem]; c.competencias_desejadas = [...psCompEdit.quer]; psAbrirFicha(c.id); }
    else fechaModal();
  }catch(e){ falha(e,'Falha ao salvar as competências'); }
}

/* ============================================================
   PUBLICAÇÕES — o que o site mostra
   ============================================================ */
function psPublicacoes(){
  $('#sel-corpo').innerHTML = `
  <div class="aviso-box info">O site público só mostra o que estiver <b>publicado</b>, e é a publicação de cada resultado que libera a situação correspondente para os candidatos. As listas de aprovados são geradas na hora, a partir do status atual.</div>
  <div style="margin-bottom:14px"><button class="btn solid" onclick="psEditarPub()">${ic('plus')} Nova publicação</button></div>
  ${PS.pubs.map(p=>{
    const setPub = PS_SETS[p.tipo];
    const qtd = setPub ? PS.candidatos.filter(c=>setPub.includes(c.status)).length : null;
    return `<div class="pub-row">
      <div style="min-width:0;flex:1">
        <div class="tt">${esc(p.titulo)} <span class="chip mini">${PS_TIPO_PUB[p.tipo]||p.tipo}</span></div>
        <div class="mt">${p.publicado?`Publicado em ${psFmtDT(p.publicado_em)}`:`Rascunho, criado em ${psFmtDT(p.criado_em)}`}
          ${qtd!=null?` · lista atual: <b>${qtd}</b> nome${qtd===1?'':'s'}`:''}</div>
      </div>
      <span class="badge-pub ${p.publicado?'sim':''}">${p.publicado?'No ar':'Rascunho'}</span>
      ${ibtn('pencil','Editar',`psEditarPub('${p.id}')`,'sm')}
      <button class="btn ${p.publicado?'ghost':'solid'} mini" onclick="psPublicar('${p.id}',${!p.publicado})">
        ${p.publicado?'Despublicar':'Publicar'}</button>
      ${ibtn('trash','Excluir',`psExcluirPub('${p.id}')`,'sm perigo')}
    </div>`; }).join('') || '<div class="empty">Nenhuma publicação criada.<br>Comece pelo <b>edital</b>.</div>'}`;
}
function psEditarPub(id){
  const p = id ? PS.pubs.find(x=>x.id===id) : null;
  abreModal(`
    <h3>${p?'Editar publicação':'Nova publicação'}</h3>
    <div class="fld" style="margin-top:12px"><label>Tipo</label>
      <select id="ps-pb-tipo">${Object.entries(PS_TIPO_PUB).map(([vl,l])=>
        `<option value="${vl}" ${p?.tipo===vl?'selected':''}>${l}</option>`).join('')}</select></div>
    <div class="fld"><label>Título</label><input id="ps-pb-titulo" value="${esc(p?.titulo||'')}" placeholder="Ex.: Edital nº 01/2026, Processo Seletivo"></div>
    <div class="fld"><label>Texto</label><textarea id="ps-pb-corpo" style="min-height:130px" placeholder="Texto exibido no site (opcional para resultados: a lista é automática).">${esc(p?.corpo||'')}</textarea></div>
    <div class="fld"><label>Link do documento (PDF do edital etc.)</label><input id="ps-pb-anexo" value="${esc(p?.url_anexo||'')}" placeholder="https://…"></div>
    <p class="small dim">Para tipos de resultado, a lista de nomes é montada a partir do status dos candidatos. Faça as movimentações antes de publicar.</p>
    <div class="acts" style="justify-content:flex-end">
      <button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psSalvarPub(${p?`'${p.id}'`:'null'})">${ic('check')} Salvar</button>
    </div>`, 'largo');
}
async function psSalvarPub(id){
  const linha = { tipo:$('#ps-pb-tipo').value, titulo:$('#ps-pb-titulo').value.trim(),
    corpo:$('#ps-pb-corpo').value.trim()||null, url_anexo:$('#ps-pb-anexo').value.trim()||null };
  if(!linha.titulo){ toast('Dê um título à publicação.', true); return; }
  try{
    const q = id ? sb.from('ps_publicacoes').update(linha).eq('id', id)
                 : sb.from('ps_publicacoes').insert({...linha, edicao_id:PS.ed.id, criado_por:quemSouEu()});
    const {error} = await q;
    if(error) throw error;
    toast('Publicação salva.'); fechaModal();
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar publicação'); }
}
async function psPublicar(id, publicar){
  const p = PS.pubs.find(x=>x.id===id);
  const setPub = PS_SETS[p.tipo];
  const qtd = setPub ? PS.candidatos.filter(c=>setPub.includes(c.status)).length : null;
  if(publicar && !await confirma(`Publicar "<b>${esc(p.titulo)}</b>"?<br><span class="small muted">
    Ela aparece imediatamente no site${qtd!=null?` com <b>${qtd}</b> nome(s) na lista, e libera essa fase do resultado para os candidatos`:''}.</span>`,'Publicar')) return;
  try{
    const {error} = await sb.from('ps_publicacoes')
      .update({publicado:publicar, publicado_em: publicar?new Date().toISOString():null}).eq('id', id);
    if(error) throw error;
    toast(publicar?'Publicado no site.':'Removido do site.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao publicar'); }
}
async function psExcluirPub(id){
  if(!await confirma('Excluir esta publicação?','Excluir')) return;
  try{
    const {error} = await sb.from('ps_publicacoes').delete().eq('id', id);
    if(error) throw error;
    toast('Publicação excluída.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao excluir'); }
}

/* ============================================================
   CONFIGURAÇÕES — a edição, o cronograma e o comitê
   ============================================================ */
function psConfig(){
  const e = PS.ed;
  const souAdmin = state.perfil.papel==='admin';
  const comite = PS.perfis.filter(p=>p.papel==='selecao');
  const promoviveis = PS.perfis.filter(p=>p.papel==='leitura');
  $('#sel-corpo').innerHTML = `
  <div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:14px">Edição</h3>
    <div class="form-grid">
      <div class="fld full"><label>Nome</label><input id="ps-ed-nome" value="${esc(e.nome)}"></div>
      <div class="fld full"><label>Descrição (aparece no site)</label><textarea id="ps-ed-desc" rows="3">${esc(e.descricao||'')}</textarea></div>
      <div class="fld"><label>Início das inscrições</label><input id="ps-ed-ini" type="date" value="${e.inscricoes_inicio||''}"></div>
      <div class="fld"><label>Fim das inscrições</label><input id="ps-ed-fim" type="date" value="${e.inscricoes_fim||''}"></div>
      <div class="fld"><label>Status</label><select id="ps-ed-status">
        ${['rascunho','publicada','encerrada'].map(s=>`<option ${e.status===s?'selected':''}>${s}</option>`).join('')}</select></div>
      <div class="fld"><label>URL do edital (PDF)</label><input id="ps-ed-edital" value="${esc(e.edital_url||'')}" placeholder="https://…"></div>
      <div class="fld full"><label>Áreas do formulário (separadas por vírgula)</label>
        <input id="ps-ed-areas" value="${esc((e.areas||[]).join(', '))}"></div>
    </div>
    <p class="small dim" style="margin-bottom:14px">O site mostra a edição <b>publicada</b> mais recente. "Rascunho" fica invisível ao público; "encerrada" tira a edição do ar.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn solid" onclick="psSalvarEdicao()">${ic('check')} Salvar edição</button>
      <button class="btn ghost" onclick="psNovaEdicao()">${ic('plus')} Nova edição</button>
    </div>
  </div>
  <div class="card" style="margin-bottom:16px">
    <h3 style="margin-bottom:12px">Cronograma público</h3>
    <div class="wrap"><table class="tabela trabalho"><thead><tr><th>Ordem</th><th>Marco</th><th>Período</th><th>Fase</th><th></th></tr></thead><tbody>
      ${PS.etapas.map(t=>`<tr>
        <td class="reg">${t.ordem}</td><td><span class="nome">${esc(t.titulo)}</span></td>
        <td class="small">${fmtD(t.data_inicio)}${t.data_fim&&t.data_fim!==t.data_inicio?' a '+fmtD(t.data_fim):''}</td>
        <td><span class="chip mini">${esc(t.fase)}</span></td>
        <td style="text-align:right;white-space:nowrap">
          ${ibtn('pencil','Editar',`psEditarEtapa('${t.id}')`,'sm')}
          ${ibtn('trash','Excluir',`psExcluirEtapa('${t.id}')`,'sm perigo')}</td>
      </tr>`).join('') || '<tr><td colspan="5"><div class="empty">Nenhum marco cadastrado.</div></td></tr>'}
    </tbody></table></div>
    <div style="margin-top:12px"><button class="btn ghost" onclick="psEditarEtapa()">${ic('plus')} Adicionar marco</button></div>
  </div>
  <div class="card">
    <h3>Acesso ao módulo (Comitê de Seleção)</h3>
    <p class="small muted" style="margin:4px 0 14px">Quem tiver o papel <b>selecao</b> acessa esta página por completo,
      mantendo apenas consulta no restante do portal. Administração e Depto. de Pessoal sempre têm acesso.${souAdmin?'':' <b>Somente administradores alteram papéis.</b>'}</p>
    ${can() ? (comite.map(p=>`<div class="ps-linha">
        ${avatarFoto({nome:p.nome||p.email}, 28, 10)}
        <span style="flex:1"><b>${esc(p.nome||p.email)}</b> <span class="dim small">${esc(p.email)}</span></span>
        ${souAdmin?ibtn('x','Remover do comitê',`psTirarAcesso('${p.id}')`,'sm'):''}</div>`).join('')
      || '<div class="empty">Ninguém com o papel selecao ainda. Apenas admin/pessoal acessam por enquanto.</div>')
    : '<div class="empty">A lista de perfis é visível apenas para admin/pessoal.</div>'}
    ${souAdmin?`<div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <select id="ps-com-add" style="flex:1;min-width:240px">
        <option value="">Escolher perfil…</option>
        ${promoviveis.map(p=>`<option value="${p.id}">${esc(p.nome||p.email)} (${esc(p.email)})</option>`).join('')}
      </select>
      <button class="btn solid" onclick="psDarAcesso()">${ic('plus')} Incluir no comitê</button></div>
      <p class="small dim" style="margin-top:8px">A pessoa precisa ter uma conta no portal (criada por ela mesma na tela de entrada,
        em "Criar conta"). Contas admin/pessoal não aparecem aqui porque já têm acesso. A gestão completa de papéis fica em
        <a href="#/admin/contas" style="text-decoration:underline">Administração › Contas e perfis</a>.</p>`:''}
  </div>`;
}
async function psSalvarEdicao(){
  const linha = { nome:$('#ps-ed-nome').value.trim(), descricao:$('#ps-ed-desc').value.trim()||null,
    inscricoes_inicio:$('#ps-ed-ini').value, inscricoes_fim:$('#ps-ed-fim').value,
    status:$('#ps-ed-status').value, edital_url:$('#ps-ed-edital').value.trim()||null,
    areas: $('#ps-ed-areas').value.split(',').map(s=>s.trim()).filter(Boolean) };
  if(!linha.nome||!linha.inscricoes_inicio||!linha.inscricoes_fim){ toast('Preencha nome e período de inscrições.', true); return; }
  try{
    const {error} = await sb.from('ps_edicoes').update(linha).eq('id', PS.ed.id);
    if(error) throw error;
    toast('Edição salva.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar edição'); }
}
function psNovaEdicao(){
  abreModal(`<h3>Nova edição</h3>
    <div class="fld" style="margin-top:12px"><label>Nome</label><input id="ps-ne-nome" placeholder="Processo Seletivo 2027"></div>
    <div class="fld"><label>Identificador (slug)</label><input id="ps-ne-slug" placeholder="ps-2027"></div>
    <div class="form-grid">
      <div class="fld"><label>Início das inscrições</label><input id="ps-ne-ini" type="date"></div>
      <div class="fld"><label>Fim das inscrições</label><input id="ps-ne-fim" type="date"></div>
    </div>
    <p class="small dim">A edição nasce como <b>rascunho</b>. Publique-a nas configurações quando estiver pronta.</p>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psCriarEdicao()">${ic('check')} Criar</button></div>`, 'largo');
}
async function psCriarEdicao(){
  const nome=$('#ps-ne-nome').value.trim(), slug=$('#ps-ne-slug').value.trim().toLowerCase();
  const ini=$('#ps-ne-ini').value, fim=$('#ps-ne-fim').value;
  if(!nome||!slug||!ini||!fim){ toast('Preencha todos os campos.', true); return; }
  try{
    const {data, error} = await sb.from('ps_edicoes')
      .insert({nome, slug, inscricoes_inicio:ini, inscricoes_fim:fim, areas:PS.ed?.areas||[]})
      .select().single();
    if(error) throw error;
    toast('Edição criada.'); fechaModal();
    PS.ed = data; PS.pronto=false;
    if(route().sub === 'config') desenhaSelecao(); else psTab('config');
  }catch(e){ falha(e,'Falha ao criar edição'); }
}
function psEditarEtapa(id){
  const t = id ? PS.etapas.find(x=>x.id===id) : null;
  abreModal(`<h3>${t?'Editar marco':'Novo marco do cronograma'}</h3>
    <div class="fld" style="margin-top:12px"><label>Título</label><input id="ps-et-titulo" value="${esc(t?.titulo||'')}"></div>
    <div class="form-grid">
      <div class="fld"><label>Data de início</label><input id="ps-et-ini" type="date" value="${t?.data_inicio||''}"></div>
      <div class="fld"><label>Data de fim (opcional)</label><input id="ps-et-fim" type="date" value="${t?.data_fim||''}"></div>
      <div class="fld"><label>Fase</label><select id="ps-et-fase">
        ${PS_FASES_ETAPA.map(f=>`<option ${t?.fase===f?'selected':''}>${f}</option>`).join('')}</select></div>
      <div class="fld"><label>Ordem</label><input id="ps-et-ordem" type="number" value="${t?.ordem??(Math.max(0,...PS.etapas.map(x=>x.ordem))+10)}"></div>
    </div>
    <div class="fld"><label>Descrição (opcional, aparece no site)</label><textarea id="ps-et-desc" rows="3">${esc(t?.descricao||'')}</textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="psSalvarEtapa(${t?`'${t.id}'`:'null'})">${ic('check')} Salvar</button></div>`, 'largo');
}
async function psSalvarEtapa(id){
  const linha = { titulo:$('#ps-et-titulo').value.trim(), data_inicio:$('#ps-et-ini').value,
    data_fim:$('#ps-et-fim').value||null, fase:$('#ps-et-fase').value,
    ordem:parseInt($('#ps-et-ordem').value,10)||100, descricao:$('#ps-et-desc').value.trim()||null };
  if(!linha.titulo||!linha.data_inicio){ toast('Preencha título e data.', true); return; }
  try{
    const q = id ? sb.from('ps_etapas').update(linha).eq('id', id)
                 : sb.from('ps_etapas').insert({...linha, edicao_id:PS.ed.id});
    const {error} = await q;
    if(error) throw error;
    toast('Cronograma atualizado.'); fechaModal();
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao salvar marco'); }
}
async function psExcluirEtapa(id){
  if(!await confirma('Excluir este marco do cronograma?','Excluir')) return;
  try{
    const {error} = await sb.from('ps_etapas').delete().eq('id', id);
    if(error) throw error;
    toast('Marco excluído.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao excluir'); }
}
async function psDarAcesso(){
  const uid = $('#ps-com-add').value;
  if(!uid){ toast('Escolha um perfil.', true); return; }
  try{
    const {error} = await sb.from('perfis').update({papel:'selecao'}).eq('id', uid);
    if(error) throw error;
    toast('Acesso concedido ao comitê.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao conceder acesso'); }
}
async function psTirarAcesso(uid){
  if(!await confirma('Remover esta pessoa do comitê? O perfil volta ao papel de consulta.','Remover')) return;
  try{
    const {error} = await sb.from('perfis').update({papel:'leitura'}).eq('id', uid);
    if(error) throw error;
    toast('Removido do comitê.');
    PS.pronto=false; desenhaSelecao();
  }catch(e){ falha(e,'Falha ao remover'); }
}

/* A busca global acha candidato por nome, protocolo ou curso — depois
   que a Seleção foi aberta uma vez. */
registrarBusca({
  fonte:'selecao', rotulo:'Candidatos',
  buscar: (t) => filtrarSimples(PS.candidatos.map(c => ({
    titulo: c.nome,
    sub: `${(PS_ST[c.status]||[c.status])[0]}${c.curso ? ' · ' + c.curso : ''}`,
    codigo: c.protocolo || '',
    href: '#/selecao/candidatos/' + c.id
  })), t, 6)
});
