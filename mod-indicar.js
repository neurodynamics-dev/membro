/* ============================================================
   2.19.2: Indicar contato ou evento (#/servicos/indicar) — qualquer membro.
   Abre uma espécie de chamado para a equipe de Relações institucionais
   (NRO_RELAC e NRO_COORD_OFFICE), que analisa; quem indicou é avisado a cada
   passo e acompanha aqui. Quem indica não vê nada além das próprias
   indicações. O banco é db/2.19.2_ri.sql (ri_indicar, ri_minhas_indicacoes).
   ============================================================ */
const IND = { tipo:'contato' };
async function pageIndicar(){
  const cab = cabecalho({ espaco:'Serviços', titulo:'Indicar contato ou evento', voltar:['Serviços', '#/servicos'],
    lead:'Conhece alguém que pode abrir portas para a NRO (um potencial investidor, parceiro, mentor) ou um evento em que valha a equipe estar? Indique aqui. A equipe de Relações institucionais analisa e você é avisado.' });
  $('#main').innerHTML = cab + `
    <form class="ri-form" id="ind-form" novalidate>
      <div class="seg" role="radiogroup" aria-label="O que você indica" id="ind-tipo">${[['contato', 'Um contato'], ['evento', 'Um evento']].map(([k, l]) =>
        `<button type="button" role="radio" data-v="${k}" class="${IND.tipo === k ? 'on' : ''}" aria-checked="${IND.tipo === k}">${l}</button>`).join('')}</div>
      <div id="ind-campos"></div>
      <p class="aviso-box err" id="ind-erro" hidden></p>
      <div class="ri-form-pe"><span class="small dim">Só a equipe de Relações institucionais vê a indicação.</span>
        <button type="submit" class="btn solid" id="ind-enviar">Enviar indicação</button></div>
    </form>
    <h2 class="srv-bloco">Minhas indicações</h2>
    <div id="ind-minhas">${estado.carregando('lista')}</div>`;
  indCampos();
  $('#ind-tipo').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return;
    IND.tipo = b.dataset.v; $('#ind-tipo').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); indCampos(); });
  $('#ind-form').addEventListener('submit', indEnviar);
  indMinhas();
}
function indCampos(){
  const c = IND.tipo === 'contato';
  $('#ind-campos').innerHTML = c ? `
    <div class="ri-dupla">
      <div class="fld"><label for="ind-nome">Nome da pessoa ou organização</label><input id="ind-nome" maxlength="200"></div>
      <div class="fld"><label for="ind-nat">É</label><select id="ind-nat"><option value="pessoa">Uma pessoa</option><option value="organizacao">Uma organização</option></select></div>
    </div>
    <div class="ri-dupla">
      <div class="fld"><label for="ind-cargo">Cargo ou função <span class="opc">(opcional)</span></label><input id="ind-cargo" maxlength="160"></div>
      <div class="fld"><label for="ind-org">Organização <span class="opc">(opcional)</span></label><input id="ind-org" maxlength="160"></div>
    </div>
    <div class="ri-dupla">
      <div class="fld"><label for="ind-funcao">Pode ser, para a NRO</label><select id="ind-funcao">
        <option value="stakeholder">Não sei dizer</option><option value="investidor">Investidor</option><option value="parceiro">Parceiro</option>
        <option value="mentor">Mentor</option><option value="saude">Da saúde ou da clínica</option><option value="academia">Da academia</option>
        <option value="governo">Do governo</option><option value="empresa">De uma empresa</option><option value="fomento">De fomento e editais</option>
        <option value="imprensa">Da imprensa</option><option value="apoiador">Apoiador</option></select></div>
      <div class="fld"><label for="ind-rel">De onde você conhece</label><input id="ind-rel" maxlength="200" placeholder="Ex.: meu tio, ex-professor, conheci num evento"></div>
    </div>
    <div class="fld"><label for="ind-pq">Por que pode interessar à NRO</label><textarea id="ind-pq" rows="3" maxlength="2000"></textarea></div>
    <div class="fld"><label for="ind-contato">Como falar com a pessoa <span class="opc">(opcional)</span></label><input id="ind-contato" maxlength="300" placeholder="E-mail, telefone ou LinkedIn, se ela concordar"></div>
    <label class="ri-fn"><input type="checkbox" id="ind-sabe"> A pessoa sabe que estou indicando e topa ser procurada</label>`
  : `
    <div class="fld"><label for="ind-nome">Nome do evento</label><input id="ind-nome" maxlength="200"></div>
    <div class="ri-dupla">
      <div class="fld"><label for="ind-data">Data</label><input type="date" id="ind-data"></div>
      <div class="fld"><label for="ind-local">Local <span class="opc">(ou online)</span></label><input id="ind-local" maxlength="200"></div>
    </div>
    <div class="ri-dupla">
      <div class="fld"><label for="ind-orgz">Organizador <span class="opc">(opcional)</span></label><input id="ind-orgz" maxlength="200"></div>
      <div class="fld"><label for="ind-link">Página do evento <span class="opc">(opcional)</span></label><input id="ind-link" type="url" placeholder="https://" maxlength="500"></div>
    </div>
    <div class="fld"><label for="ind-pq">Por que a equipe deveria ir</label><textarea id="ind-pq" rows="3" maxlength="2000" placeholder="Quem estará lá, o que dá para apresentar ou alinhar."></textarea></div>`;
}
async function indEnviar(e){
  e.preventDefault();
  const v = s => ($(s)?.value || '').trim(), erro = t => { $('#ind-erro').textContent = t; $('#ind-erro').hidden = false; };
  const dados = IND.tipo === 'contato'
    ? { nome:v('#ind-nome'), natureza:v('#ind-nat'), cargo:v('#ind-cargo'), organizacao:v('#ind-org'), funcao:v('#ind-funcao'), relacao:v('#ind-rel'),
        por_que:v('#ind-pq'), contato:v('#ind-contato'), sabe:$('#ind-sabe').checked }
    : { nome:v('#ind-nome'), data:v('#ind-data') || null, local:v('#ind-local'), organizador:v('#ind-orgz'), link:v('#ind-link'), por_que:v('#ind-pq') };
  if (!dados.nome) return erro(IND.tipo === 'contato' ? 'Escreva o nome.' : 'Escreva o nome do evento.');
  if (!dados.por_que) return erro('Conte por que vale a pena.');
  if (dados.link && !/^https?:\/\//i.test(dados.link)) return erro('A página do evento precisa começar por https://');
  $('#ind-enviar').disabled = true;
  const { data, error } = await sb.rpc('ri_indicar', { p:{ tipo:IND.tipo, dados } });
  $('#ind-enviar').disabled = false;
  if (error || data?.status !== 'ok') return erro(data?.status === 'limite' ? 'Você já tem 10 indicações esperando análise. Aguarde a equipe responder.' : 'Não foi possível enviar agora. Tente de novo.');
  toast('Indicação enviada. Você será avisado quando a equipe analisar.');
  $('#ind-erro').hidden = true; indCampos(); indMinhas();
}
async function indMinhas(){
  const { data, error } = await sb.rpc('ri_minhas_indicacoes');
  const el = $('#ind-minhas'); if (!el) return;
  if (error || data?.status !== 'ok'){ el.innerHTML = estado.erro({ texto:'Não foi possível carregar as suas indicações.' }); return; }
  const ST = { nova:'Enviada', em_analise:'Em análise', aceita:'Aceita', recusada:'Analisada' };
  el.innerHTML = data.indicacoes.length ? `<ul class="ind-lista">${data.indicacoes.map(i => `<li>
      <span class="pill">${i.tipo === 'contato' ? 'Contato' : 'Evento'}</span> <b>${esc(i.dados?.nome || '—')}</b>
      <span class="pill ${i.status}">${ST[i.status]}</span> <span class="dim small">${fmtD(i.criado_em)}</span>
      ${i.resposta ? `<p class="small">${esc(i.resposta)}</p>` : ''}</li>`).join('')}</ul>`
    : '<p class="dim">Você ainda não indicou ninguém.</p>';
}
