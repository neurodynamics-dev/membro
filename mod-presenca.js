/* ============================================================
   MÓDULO · PRESENÇA — #/equipe/presenca
   O LABBIO: quem está lá agora (os check-ins das últimas 4 horas), o
   placar do mês e as sequências em dias úteis, o status do dia de cada
   um (não perturbe, find me at), os intervalos (no LABBIO, remoto,
   fora) e, para a gestão, as folhas de check-in: o QR Code fixo em A4
   para quando o quiosque não está ligado (v29).

   Era a aba Presença da Agenda até a revisão 28: a agenda ficou só com
   o que uma agenda faz.

   Depende da casca para: sb, $, esc, state, toast, abreModal, fechaModal,
   ic, ibtn, confirma, falha, motivoRPC, avatarFoto, nomeDe, primeiroNome,
   hojeISO, isoDia, dataHora, hhmmMin, minHHMM, fmtD, can, abasEquipe,
   dica, precisaDocNRO, placarLABBIO, placarHTML.
   ============================================================ */

const presenca = { folhas:null };
const LOCAIS_STATUS = ['LABBIO', 'Lanchonete de dentro', 'Lanchonete de fora', 'Diretoria'];
const TIPOS_INTERVALO = {
  no_lab:  { l:'No LABBIO', cor:'var(--ok)' },
  remoto:  { l:'Trabalho remoto', cor:'var(--info)' },
  ausente: { l:'Fora do escritório', cor:'var(--warn)' }
};
const presHora = x => new Date(x).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' });

async function pagePresenca(){
  const eu = state.perfil?.registro;
  $('#main').innerHTML = `${cabecalho({ espaco:'Equipe', titulo:'Presença', secoes:abasEquipe('presenca') })}
    <div id="pres-corpo"><div class="carregando"><span class="spin"></span></div></div>`;
  const [rec, sts, aus, placar] = await Promise.all([
    sb.from('presencas').select('registro,registrado_em').gte('registrado_em', new Date(Date.now() - 14 * 864e5).toISOString())
      .order('registrado_em', { ascending:false }).limit(300),
    sb.from('status_membro').select('*'),
    sb.from('agenda_ausencias').select('*').in('tipo', Object.keys(TIPOS_INTERVALO)).gte('fim', new Date().toISOString()).order('inicio').limit(80),
    placarLABBIO()
  ]);
  const el = $('#pres-corpo'); if (!el) return;
  if (rec.error){ el.innerHTML = `<div class="aviso-box err">A presença não carregou: ${esc(rec.error.message)}</div>`; return; }
  const hoje = new Date().toDateString();
  const st = {}; (sts.data || []).forEach(s => { if (new Date(s.definido_em).toDateString() === hoje) st[s.registro] = s; });
  const h4 = Date.now() - 4 * 36e5, vistos = new Set(), agora = [];
  for (const r of (rec.data || [])){
    if (new Date(r.registrado_em).getTime() < h4) break;
    if (!vistos.has(r.registro)){ vistos.add(r.registro); agora.push(r); }
  }
  const ints = (aus.data || []).filter(a => new Date(a.inicio) <= new Date(Date.now() + 7 * 864e5));
  const meus = ints.filter(a => a.registro === eu);
  const daEquipe = ints.filter(a => a.registro !== eu && new Date(a.inicio) <= new Date() && new Date(a.fim) >= new Date());
  const meuSt = eu ? st[eu] : null;
  const linha = r => {
    const m = (state.membros || []).find(x => x.registro === r.registro) || { registro:r.registro, nome:'Registro ' + r.registro };
    const s = st[r.registro];
    return `<div class="pline">${avatarFoto(m, 30, 11)}<div class="pinfo"><div class="pn">${esc(m.nome)}</div>
      ${s ? `<div class="ps">${s.tipo === 'nao_perturbe' ? '<span class="ndp">Não perturbe</span>' : `<span class="fma">Em: ${esc(s.local || 'local não informado')}</span>`}</div>` : ''}</div>
      <span class="h">desde ${presHora(r.registrado_em)}</span></div>`;
  };
  const linhaInt = (a, nome) => {
    const t = TIPOS_INTERVALO[a.tipo] || { l:a.tipo, cor:'var(--dim)' };
    const i = new Date(a.inicio), f = new Date(a.fim), um = i.toDateString() === f.toDateString();
    const q = a.dia_inteiro ? `${fmtD(isoDia(i))}${um ? '' : ' a ' + fmtD(isoDia(new Date(f - 1000)))}` : `${um ? fmtD(isoDia(i)) + ', ' : ''}${presHora(i)}–${presHora(f)}`;
    return `<div class="int-row"><span class="pt" style="--cc:${t.cor}"></span>
      <span>${nome ? esc(primeiroNome(nomeDe(a.registro))) + ': ' : ''}${esc(t.l)}${a.observacao ? ' (' + esc(a.observacao) + ')' : ''}</span>
      <span class="qd">${q}</span>${a.registro === eu ? `<button class="rm" title="Remover" aria-label="Remover" onclick="presRemover('${a.id}')">×</button>` : ''}</div>`;
  };
  el.innerHTML = `<div class="pres-grid">
    <div class="card"><div class="head"><h3>No LABBIO agora</h3><span class="sub">últimas 4 horas</span></div>
      <div class="pres-hero"><span class="n">${agora.length}</span><span class="l">${agora.length === 1 ? 'pessoa' : 'pessoas'} com check-in</span></div>
      ${agora.length ? agora.slice(0, 12).map(linha).join('') : '<div class="empty" style="padding:14px">Nenhum check-in nas últimas 4 horas.</div>'}
      ${daEquipe.length ? `<div class="sub" style="margin:16px 0 6px">PELA AGENDA</div>${daEquipe.map(a => linhaInt(a, true)).join('')}` : ''}</div>
    <div class="card"><div class="head"><h3>Placar do LABBIO ${dica('Ranking: dias com check-in no mês. Sequência: dias úteis seguidos com check-in. Fim de semana e feriado não contam nem quebram; o dia de hoje sem check-in ainda não quebra.')}</h3></div>
      ${placarHTML(placar, 5)}</div>
    <div class="card"><h3>Seu status de hoje ${dica('Vale até o fim do dia. Aparece nesta tela e na tela da entrada do LABBIO.')}</h3>
      ${!eu ? '<div class="aviso-box info" style="margin-top:10px">Conta sem vínculo com um registro de membro.</div>' : `
      <div class="st-chips" style="margin-top:12px">
        <button class="chip ${meuSt?.tipo === 'nao_perturbe' ? 'on' : ''}" onclick="presStatus('nao_perturbe')">Não perturbe</button>
        <button class="chip ${meuSt?.tipo === 'find_me_at' ? 'on' : ''}" onclick="document.getElementById('fma-row').hidden=false">Onde estou</button>
        ${meuSt ? '<button class="chip" onclick="presLimpar()">Limpar</button>' : ''}</div>
      <div id="fma-row" class="pres-fma" hidden><select id="fma-local" aria-label="Local">${LOCAIS_STATUS.map(l =>
        `<option ${meuSt?.local === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>
        <button class="btn ghost mini" onclick="presStatus('find_me_at')">Definir</button></div>
      <h3 style="margin-top:20px">Intervalos</h3>
      <div class="chips" style="margin:12px 0">${Object.entries(TIPOS_INTERVALO).map(([k, t]) =>
        `<button class="chip" onclick="presIntervalo('${k}')">${esc(t.l)}</button>`).join('')}</div>
      ${meus.length ? meus.map(a => linhaInt(a, false)).join('') : '<p class="small muted">Nenhum intervalo marcado.</p>'}
      <p class="small muted" style="margin-top:10px">Férias e afastamento: <a href="#/agenda" style="text-decoration:underline">Agenda</a> › Criar › Ausência.</p>`}</div>
    ${can() ? `<div class="card"><div class="head"><h3>Folhas de check-in ${dica('O QR Code fixo, impresso em A4, vale como o do quiosque quando ele está desligado. Só existe uma folha ativa: gerar outra invalida a anterior, e o PDF só pode ser baixado na hora de gerar.')}</h3>
      ${state.perfil?.papel === 'admin' ? `<button class="btn solid mini" onclick="presNovaFolha()">${ic('qr')} Gerar nova folha</button>` : ''}</div><div id="pres-folhas"></div></div>` : ''}
    ${state.perfil?.papel === 'admin' ? `<div class="card" id="pres-local"><div class="head"><h3>Local do check-in ${dica('O check-in pela folha só vale perto do centro configurado. O celular manda a posição, o banco confere a distância (descontando a imprecisão do GPS, até 100 m) e não guarda as coordenadas.')}</h3></div><div id="pres-local-corpo"></div></div>` : ''}
  </div>`;
  if (can()) presFolhas();
  if (state.perfil?.papel === 'admin') presLocal();
}

/* ---------- status e intervalos ---------- */
async function presStatus(tipo){
  const local = tipo === 'find_me_at' ? ($('#fma-local')?.value || LOCAIS_STATUS[0]) : null;
  const { error } = await sb.from('status_membro').upsert({ registro: state.perfil.registro, tipo, local, definido_em: new Date().toISOString() },
    { onConflict:'registro' });
  if (error) return toast('Não foi possível definir o status: ' + error.message, true);
  pagePresenca();
}
async function presLimpar(){
  const { error } = await sb.from('status_membro').delete().eq('registro', state.perfil.registro);
  if (error) return toast('Não foi possível limpar: ' + error.message, true);
  pagePresenca();
}
function presIntervalo(tipo){
  const t = TIPOS_INTERVALO[tipo], a = new Date(), ini = Math.floor((a.getHours() * 60 + a.getMinutes()) / 15) * 15;
  abreModal(`<h3>${esc(t.l)}</h3>
    <div class="fld"><label for="iv-dia">Dia</label><input id="iv-dia" type="date" value="${hojeISO()}"></div>
    <div class="dupla"><div class="fld"><label for="iv-h1">Das</label><input id="iv-h1" type="time" step="900" value="${minHHMM(ini)}"></div>
      <div class="fld"><label for="iv-h2">Às</label><input id="iv-h2" type="time" step="900" value="${minHHMM(Math.min(ini + 120, 23*60 + 45))}"></div></div>
    <div class="fld"><label for="iv-obs">Observação</label><input id="iv-obs" maxlength="120"></div>
    ${tipo === 'ausente' ? '<p class="small muted">Fora do escritório ocupa o horário na disponibilidade da agenda.</p>' : ''}
    <p class="err-msg" id="iv-erro"></p>
    <div class="acts"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" onclick="presSalvarIntervalo('${tipo}')">Salvar</button></div>`);
}
async function presSalvarIntervalo(tipo){
  const d = $('#iv-dia').value, h1 = $('#iv-h1').value, h2 = $('#iv-h2').value;
  if (!d || !h1 || !h2 || h2 <= h1) return $('#iv-erro').textContent = 'O fim precisa ser depois do início.';
  const { data, error } = await sb.rpc('agenda_ausencia_salvar', { p: { tipo, inicio: dataHora(d, hhmmMin(h1)).toISOString(),
    fim: dataHora(d, hhmmMin(h2)).toISOString(), dia_inteiro:false, observacao: $('#iv-obs').value.trim() } });
  if (error || data?.status !== 'ok') return $('#iv-erro').textContent = motivoRPC(data, error, 'Não foi possível salvar.');
  fechaModal(); toast('Intervalo salvo.'); pagePresenca();
}
async function presRemover(id){
  const { error } = await sb.from('agenda_ausencias').delete().eq('id', id);
  if (error) return toast('Não foi possível remover: ' + error.message, true);
  toast('Removido.'); pagePresenca();
}

/* ---------- o local do check-in pela folha (admin, 2.19.2) ---------- */
async function presLocal(){
  const el = $('#pres-local-corpo'); if (!el) return;
  const { data, error } = await sb.rpc('checkin_local_ler');
  if (error || data?.status !== 'ok'){
    el.innerHTML = `<p class="small muted">${error && /checkin_local_ler/.test(error.message) ? 'Falta aplicar a migração db/2.19.2_checkin_local.sql.' : esc(motivoRPC(data, error, 'Não foi possível ler o local.'))}</p>`;
    return;
  }
  presenca.local = data;
  if (!data.configurado){ el.innerHTML = `<p class="small muted">Sem local configurado: a folha vale de qualquer lugar.</p>
    <button class="btn ghost mini" onclick="presEditarLocal()">Configurar</button>`; return; }
  el.innerHTML = `<div class="pres-local">
    <span class="tx"><b>${data.ativo ? 'Conferência ligada' : 'Conferência desligada'}</b>
      <span>${data.ativo ? `Vale até ${data.raio_m} m do ponto ${Number(data.latitude).toFixed(5)}, ${Number(data.longitude).toFixed(5)}; recusa se o GPS tiver erro maior que ${data.precisao_max_m} m.` : 'A folha vale de qualquer lugar.'}
      Última mudança${data.atualizado_por ? ' por ' + esc(data.atualizado_por) : ''} em ${fmtD(String(data.atualizado_em).slice(0, 10))}.</span></span>
    <button class="btn ghost mini" onclick="presEditarLocal()">Ajustar</button></div>`;
}
function presEditarLocal(){
  const d = presenca.local || {};
  abreModal(`<h3>Local do check-in</h3>
    <label class="check"><input type="checkbox" id="lc-ativo" ${d.ativo !== false ? 'checked' : ''}> Conferir a posição no check-in pela folha</label>
    <div class="dupla"><div class="fld"><label for="lc-lat">Latitude</label><input id="lc-lat" inputmode="decimal" value="${d.latitude ?? ''}"></div>
      <div class="fld"><label for="lc-lon">Longitude</label><input id="lc-lon" inputmode="decimal" value="${d.longitude ?? ''}"></div></div>
    <button class="btn ghost mini" type="button" id="lc-aqui" onclick="presLocalAqui()">${ic('pino')} Usar a minha posição agora</button>
    <div class="dupla" style="margin-top:12px"><div class="fld"><label for="lc-raio">Raio (m)</label><input id="lc-raio" type="number" min="20" max="5000" value="${d.raio_m ?? 150}"></div>
      <div class="fld"><label for="lc-prec">Erro máximo do GPS (m)</label><input id="lc-prec" type="number" min="20" max="2000" value="${d.precisao_max_m ?? 200}"></div></div>
    <p class="small muted">Dica: no Google Maps, toque e segure no ponto e copie os dois números.</p>
    <p class="err-msg" id="lc-erro"></p>
    <div class="acts"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="lc-ok" onclick="presSalvarLocal()">Salvar</button></div>`);
}
async function presLocalAqui(){
  const b = $('#lc-aqui'), er = $('#lc-erro'); er.textContent = ''; b.disabled = true;
  try{
    const p = await posicaoAtual();
    $('#lc-lat').value = p.coords.latitude.toFixed(6); $('#lc-lon').value = p.coords.longitude.toFixed(6);
    if (p.coords.accuracy > 50) er.textContent = `Erro de ${Math.round(p.coords.accuracy)} m nesta medida: confira o ponto antes de salvar.`;
  }catch(_){ er.textContent = 'Não foi possível pegar a posição. Libere a localização no navegador ou digite os números.'; }
  b.disabled = false;
}
async function presSalvarLocal(){
  const num = id => Number(String($(id).value).replace(',', '.').trim());
  const lat = num('#lc-lat'), lon = num('#lc-lon'), raio = Math.round(num('#lc-raio')), prec = Math.round(num('#lc-prec')), er = $('#lc-erro');
  if (!$('#lc-lat').value.trim() || !$('#lc-lon').value.trim() || !isFinite(lat) || !isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180)
    return er.textContent = 'Informe a latitude e a longitude em graus (por exemplo, -19,8705).';
  if (!(raio >= 20 && raio <= 5000)) return er.textContent = 'O raio vai de 20 a 5000 m.';
  if (!(prec >= 20 && prec <= 2000)) return er.textContent = 'O erro máximo do GPS vai de 20 a 2000 m.';
  $('#lc-ok').disabled = true;
  const { data, error } = await sb.rpc('checkin_local_salvar', { p_ativo: $('#lc-ativo').checked, p_lat: lat, p_lon: lon, p_raio: raio, p_precisao_max: prec });
  if (error || data?.status !== 'ok'){ $('#lc-ok').disabled = false; return er.textContent = motivoRPC(data, error, 'Não foi possível salvar.'); }
  fechaModal(); toast('Local do check-in salvo.'); presLocal();
}

/* ---------- as folhas de check-in (gestão) ---------- */
async function presFolhas(){
  const el = $('#pres-folhas'); if (!el) return;
  const { data, error } = await sb.from('checkin_folhas').select('id,numero,rotulo,criada_em,criada_por,revogada_em,revogada_por,usos,ultimo_uso').order('criada_em', { ascending:false });
  if (error){ el.innerHTML = `<p class="small muted">${/checkin_folhas/.test(error.message) ? 'Falta aplicar a migração db/v29_presenca_e_inicio.sql.' : esc(error.message)}</p>`; return; }
  presenca.folhas = data || [];
  el.innerHTML = presenca.folhas.length ? `<div class="pres-folhas">${presenca.folhas.map(f => `<div class="pres-folha${f.revogada_em ? ' off' : ''}">
      <span class="cod">CHK-${String(f.numero).padStart(3, '0')}</span>
      <span class="tx"><b>${esc(f.rotulo || 'Folha de check-in')}</b>
        <span>Gerada em ${fmtD(f.criada_em.slice(0, 10))}${f.criada_por ? ' por ' + esc(f.criada_por) : ''}. ${f.usos} ${f.usos === 1 ? 'uso' : 'usos'}${f.ultimo_uso ? ', o último em ' + fmtD(f.ultimo_uso.slice(0, 10)) : ''}.</span></span>
      ${f.revogada_em ? `<span class="pill"><span class="dt dt-gray"></span>Revogada em ${fmtD(f.revogada_em.slice(0, 10))}</span>`
        : (state.perfil?.papel === 'admin' ? `<button class="btn ghost mini perigo" onclick="presRevogar('${f.id}')">Revogar</button>` : '<span class="pill"><span class="dt dt-ok"></span>Ativa</span>')}</div>`).join('')}</div>`
    : '<p class="small muted">Nenhuma folha gerada.</p>';
}
async function presNovaFolha(){
  const ativa = (presenca.folhas || []).find(f => !f.revogada_em);
  if (ativa && !await confirma(`A folha CHK-${String(ativa.numero).padStart(3, '0')} deixa de valer: o QR dela passa a ser recusado no check-in. Gerar uma nova?`, 'Gerar nova')) return;
  abreModal(`<h3>Gerar folha de check-in</h3>
    <div class="fld"><label for="fl-rot">Local</label><input id="fl-rot" maxlength="80" placeholder="Porta do LABBIO"></div>
    <p class="err-msg" id="fl-erro"></p>
    <div class="acts"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="fl-ok" onclick="presCriarFolha()">Gerar e baixar</button></div>`);
  setTimeout(() => $('#fl-rot')?.focus(), 30);
}
async function presCriarFolha(){
  const b = $('#fl-ok'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('checkin_folha_criar', { p_rotulo: $('#fl-rot').value.trim() });
  if (error || data?.status !== 'ok'){ if (b) b.disabled = false; return $('#fl-erro').textContent = motivoRPC(data, error, 'Não foi possível gerar a folha.'); }
  fechaModal();
  await presPdf({ ...data, rotulo: $('#fl-rot')?.value.trim() || data.rotulo });
  presFolhas();
}
async function presPdf(f){
  try{
    await precisaDocNRO();
    const doc = DocNRO.folhaCheckin({ ...f, url: location.origin + location.pathname });
    DocNRO.baixar(doc);
    toast(`Folha CHK-${String(f.numero).padStart(3, '0')} baixada.`);
  }catch(e){ falha(e, 'Não foi possível gerar o PDF da folha (gere outra folha)'); }
}
async function presRevogar(id){
  const f = (presenca.folhas || []).find(x => x.id === id);
  if (!await confirma(`Revogar a folha CHK-${String(f?.numero || 0).padStart(3, '0')}? O QR dela deixa de registrar presença.`, 'Revogar')) return;
  const { data, error } = await sb.rpc('checkin_folha_revogar', { p_id: id });
  if (error || data?.status !== 'ok') return toast(motivoRPC(data, error, 'Não foi possível revogar'), true);
  toast('Folha revogada.'); presFolhas();
}
