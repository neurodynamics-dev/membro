/* ============================================================
   ENSAIO DO ONBOARDING (2.19.2): tour.html?ensaio
   A jornada de quem chega, sem conta de verdade e sem tocar no banco.
   Este arquivo troca o cliente do Supabase por um de mentira antes de o
   tour começar: a sessão, o perfil, a trilha (onboarding_meu e
   onboarding_marcar) e os painéis "Para você" vêm da pessoa simulada.
   Nada é lido nem gravado na produção; o estado do ensaio fica nesta aba
   (sessionStorage) e as marcas locais do tour ganham o prefixo "ensaio:".

   O painel no canto escolhe a pessoa (visitante, conta sem vínculo, membro
   novo, no meio do caminho, tudo feito), liga e desliga cada fato que o
   SOMA confere sozinho e simula os passos que dependem de outra pessoa
   (confirmar o e-mail, o Pessoal ligar a conta ao quadro).
   Os botões que levam ao SOMA abrem o SOMA de verdade, com a sua conta.
   ============================================================ */
(function(){
  const CHAVE = 'nd.ensaio';
  const UID = '00000000-0000-4000-8000-00000000e5a1', REG = 990;
  const TRILHA = [
    { id:'contexto',     titulo:'A NeuroDynamics, o LABBIO e os objetivos da equipe', tipo:'leitura', ancora:'bem-vindo' },
    { id:'organizacao',  titulo:'Áreas, grupos, liderança e a cadeia de reporte',     tipo:'leitura', ancora:'equipe' },
    { id:'dados',        titulo:'Conferir os seus dados',                              tipo:'fato', fato:'dados', ancora:'conta' },
    { id:'termo',        titulo:'Assinar o termo de sigilo do LABBIO',                 tipo:'fato', fato:'termo', ancora:'servicos' },
    { id:'soma',         titulo:'Usar o SOMA: tarefas, agenda, presença e Serviços',   tipo:'leitura', ancora:'inicio' },
    { id:'treinamentos', titulo:'Treinamentos obrigatórios e segurança no laboratório', tipo:'fato', fato:'treinamentos', ancora:'treinamentos' },
    { id:'proximos',     titulo:'Próximos passos com a sua liderança',                 tipo:'leitura', ancora:'ajuda' }
  ];
  const LEITURAS = TRILHA.filter(e => e.tipo === 'leitura').map(e => e.id);
  /* as pessoas: em que ponto da jornada cada uma está */
  const PESSOAS = {
    visitante:   { rot:'Visitante, sem conta', sessao:false, vinculo:false, fatos:{}, lidas:[] },
    sem_vinculo: { rot:'Conta criada, sem vínculo com o quadro', sessao:true, vinculo:false, fatos:{}, lidas:[] },
    novo:        { rot:'Membro novo (trainee), primeiro dia', sessao:true, vinculo:true, fatos:{}, lidas:[] },
    meio:        { rot:'No meio do caminho', sessao:true, vinculo:true, fatos:{ dados:true, checkin:true }, lidas:['contexto', 'organizacao'] },
    concluido:   { rot:'Tudo feito', sessao:true, vinculo:true, fatos:{ dados:true, termo:true, treinamentos:true, checkin:true, avisos:true }, lidas:LEITURAS }
  };
  const FATOS = [['dados', 'Dados conferidos'], ['termo', 'Termo de sigilo enviado'], ['treinamentos', 'Treinamentos obrigatórios em dia'],
                 ['checkin', 'Já fez check-in'], ['avisos', 'Escolheu como receber os avisos']];
  const novoEstado = p => { const b = PESSOAS[p] || PESSOAS.novo; return { pessoa:PESSOAS[p] ? p : 'novo', sessao:b.sessao, vinculo:b.vinculo,
    fatos:{ ...b.fatos }, lidas:[...b.lidas] }; };
  const ler = () => { try { return JSON.parse(sessionStorage.getItem(CHAVE)) || null; } catch(e){ return null; } };
  let st = ler() || novoEstado(new URLSearchParams(location.search).get('ensaio') || 'novo');
  const salvar = () => { try { sessionStorage.setItem(CHAVE, JSON.stringify(st)); } catch(e){} };
  salvar();
  window.__ensaio = { estado: () => st };

  /* ---------------- os dados da pessoa simulada ---------------- */
  const dia = n => { const d = new Date(Date.now() + n * 864e5); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const EU = { registro:REG, nome:'Nova Pessoa (ensaio)', cargo:'Trainee', departamento:'Sinais', status:'Ativo', grupos:['Sinais'], gestor_registro:901, foto_url:null };
  const EQUIPE = [EU,
    { registro:901, nome:'Liderança de Sinais (exemplo)', cargo:'Liderança', departamento:'Sinais', status:'Ativo', grupos:['Sinais'], gestor_registro:null, foto_url:null },
    { registro:902, nome:'Colega de Sinais (exemplo)', cargo:'Membro', departamento:'Sinais', status:'Ativo', grupos:['Sinais'], gestor_registro:901, foto_url:null },
    { registro:903, nome:'Colega de Firmware (exemplo)', cargo:'Membro', departamento:'Firmware', status:'Ativo', grupos:['Firmware'], gestor_registro:null, foto_url:null }];
  const GRUPOS = [{ id:1, nome:'NeuroDynamics', prefixo:null, ativo:true, ordem:0, pai_id:null, quadro:false },
    { id:2, nome:'Sinais', prefixo:'SIN', ativo:true, ordem:1, pai_id:1, quadro:true },
    { id:3, nome:'Firmware', prefixo:'FW', ativo:true, ordem:2, pai_id:1, quadro:true }];
  const trilha = () => {
    const etapas = TRILHA.map(e => ({ ...e, feita: e.tipo === 'fato' ? !!st.fatos[e.fato] : st.lidas.includes(e.id),
      feita_em: null }));
    return { status:'ok', versao:1, etapas, feitas: etapas.filter(e => e.feita).length, total: etapas.length };
  };
  const tabelas = {
    perfis: () => ({ id:UID, nome:EU.nome, email:'nova.pessoa@exemplo.com', papel:'leitura', registro: st.vinculo ? REG : null }),
    membros: () => EQUIPE,
    grupos: () => GRUPOS,
    studio_config: () => null,
    treinamento_config: () => null,
    atividades: () => [{ id:'a1', codigo:'SIN-21', titulo:'Ler o guia de boas-vindas do grupo', prazo:dia(3), status:'a_fazer', prioridade:'media' },
                       { id:'a2', codigo:'SIN-22', titulo:'Acompanhar a reunião de sexta', prazo:dia(5), status:'a_fazer', prioridade:'baixa' }],
    presencas: () => st.fatos.checkin ? [{ registro:REG, registrado_em:new Date(Date.now() - 864e5).toISOString() }] : [],
    notificacao_preferencias: () => st.fatos.avisos ? { email_modo:'resumo' } : null,
    portal_agendas: () => null,
    projetos: () => [{ id:1, codigo:'SIN-P1', nome:'Plataforma de sinais (exemplo)', grupo_id:2, supervisor:'Liderança de Sinais (exemplo)', status:'ativo', logo_semente:1 }],
    studio_publicacoes: () => []
  };
  const funcoes = {
    onboarding_meu: () => st.sessao && st.vinculo ? trilha() : { status:'sem_registro' },
    onboarding_marcar: a => {
      if (!LEITURAS.includes(a.p_etapa)) return { status:'invalido' };
      st.lidas = st.lidas.filter(x => x !== a.p_etapa); if (a.p_feita) st.lidas.push(a.p_etapa);
      salvar(); setTimeout(desenharPainel, 0); return trilha();
    },
    cadastro_meus_dados: () => ({ status:'ok', registro:REG, nome:EU.nome, confirmado_em: st.fatos.dados ? new Date(Date.now() - 2 * 864e5).toISOString() : null }),
    treinamentos_meus: () => [
      { codigo:'TRE-001', titulo:'Segurança no laboratório', obrigatorio:true, situacao: st.fatos.treinamentos ? 'concluido' : 'pendente', n_modulos:3, feitos: st.fatos.treinamentos ? 3 : 0 },
      { codigo:'TRE-004', titulo:'Documentação e sigilo', obrigatorio:true, situacao: st.fatos.treinamentos ? 'concluido' : 'andamento', n_modulos:4, feitos: st.fatos.treinamentos ? 4 : 1 }],
    agenda_itens: () => [{ origem:'evento', id:'e1', titulo:'Boas-vindas aos novos membros (exemplo)', data_inicio:dia(2), hora_inicio:'14:00', hora_fim:'15:00',
      local:'LABBIO', sou_convidado:true, sou_dono:false, minha_resposta:'pendente' }],
    labbio_placar: () => ({ dias_uteis_mes:8, eu: st.fatos.checkin ? { posicao:4, dias:3, atual:2, recorde:3 } : null,
      ranking:[{ registro:902, dias:7 }, { registro:901, dias:6 }, { registro:903, dias:5 }, ...(st.fatos.checkin ? [{ registro:REG, dias:3 }] : [])],
      sequencias:[{ registro:902, atual:5 }, { registro:901, atual:3 }] })
  };

  /* ---------------- o cliente de mentira ---------------- */
  const resp = data => ({ data, error:null });
  function construtor(tabela){
    let unico = false;
    const b = {
      then(ok, falha){ const f = tabelas[tabela]; let d = f ? f() : [];
        if (unico && Array.isArray(d)) d = d[0] || null;
        return Promise.resolve(resp(d)).then(ok, falha); }
    };
    ['select', 'eq', 'neq', 'gte', 'lte', 'lt', 'gt', 'in', 'or', 'order', 'limit', 'range', 'is', 'not', 'ilike'].forEach(m => { b[m] = () => b; });
    b.single = b.maybeSingle = () => { unico = true; return b; };
    return b;
  }
  const ouvintes = [];
  const avisar = ev => ouvintes.forEach(cb => setTimeout(() => cb(ev, null), 0));
  const sessao = () => st.sessao ? { user:{ id:UID, email:'nova.pessoa@exemplo.com' }, access_token:'ensaio' } : null;
  const cliente = {
    from: t => construtor(t),
    rpc: async (nome, args) => { const f = funcoes[nome]; return resp(f ? f(args || {}) : null); },
    auth: {
      getSession: async () => resp({ session: sessao() }),
      onAuthStateChange: cb => { ouvintes.push(cb); return { data:{ subscription:{ unsubscribe(){} } } }; },
      /* criar a conta: como na vida real, falta confirmar o e-mail (o painel simula a confirmação) */
      signUp: async () => { st.criada = true; salvar(); setTimeout(desenharPainel, 0); return resp({ user:{ identities:[{}] }, session:null }); },
      signInWithPassword: async () => {
        if (!st.criada && st.pessoa === 'visitante') return { data:null, error:{ message:'Invalid login credentials', code:'invalid_credentials' } };
        st.sessao = true; salvar(); setTimeout(desenharPainel, 0); return resp({ session: sessao() });
      },
      resetPasswordForEmail: async () => resp({}),
      resend: async () => resp({}),
      signOut: async () => { st.sessao = false; salvar(); avisar('SIGNED_OUT'); setTimeout(desenharPainel, 0); return resp({}); }
    }
  };
  window.supabase = { createClient: () => cliente };

  /* ---------------- o painel do ensaio ---------------- */
  function mudar(fn){ fn(); salvar(); location.reload(); }
  function desenharPainel(){
    let p = document.getElementById('ensaio');
    if (!p){
      if (!document.body) return;
      p = document.createElement('aside'); p.id = 'ensaio'; p.setAttribute('aria-label', 'Ensaio do onboarding');
      // no celular o painel cobre o tour: começa recolhido, e a escolha fica nesta aba
      if (st.recolhido ?? matchMedia('(max-width: 700px)').matches) p.className = 'ensaio recolhido'; else p.className = 'ensaio';
      document.body.appendChild(p);
      p.addEventListener('change', e => {
        const el = e.target;
        if (el.id === 'ens-pessoa') mudar(() => { st = novoEstado(el.value); });
        else if (el.dataset.fato) mudar(() => { st.fatos[el.dataset.fato] = el.checked; });
      });
      p.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.acao === 'confirmar') mudar(() => { st.sessao = true; st.criada = true; st.pessoa = 'sem_vinculo'; });
        else if (b.dataset.acao === 'vincular') mudar(() => { st.vinculo = true; st.pessoa = 'novo'; });
        else if (b.dataset.acao === 'recomecar') mudar(() => { st = novoEstado(st.pessoa);
          try { Object.keys(localStorage).filter(k => k.startsWith('ensaio:')).forEach(k => localStorage.removeItem(k)); } catch(_){}
          location.hash = ''; });
        else if (b.dataset.acao === 'recolher'){ st.recolhido = p.classList.toggle('recolhido'); salvar(); desenharPainel(); }
      });
    }
    const t = trilha();
    p.innerHTML = `<div class="ens-cab"><b>Ensaio do onboarding</b>
        <button type="button" class="ens-rec" data-acao="recolher" aria-expanded="${!p.classList.contains('recolhido')}" aria-label="Mostrar ou recolher o painel do ensaio">${p.classList.contains('recolhido') ? '+' : '–'}</button></div>
      <div class="ens-corpo">
      <p class="ens-nota">Nada é lido nem gravado no SOMA. Os botões que levam ao SOMA abrem o SOMA de verdade, com a sua conta.</p>
      <label class="ens-l" for="ens-pessoa">Quem está chegando</label>
      <select id="ens-pessoa">${Object.entries(PESSOAS).map(([k, v]) => `<option value="${k}"${k === st.pessoa ? ' selected' : ''}>${v.rot}</option>`).join('')}</select>
      <p class="ens-sit">${!st.sessao ? (st.criada ? 'Conta criada, falta confirmar o e-mail.' : 'Sem conta.') : !st.vinculo ? 'Conta aberta, sem vínculo com o quadro.'
        : `Trilha: ${t.feitas} de ${t.total} etapas.`}</p>
      ${!st.sessao && st.criada ? '<button type="button" class="ens-bt" data-acao="confirmar">Simular: confirmar o e-mail</button>' : ''}
      ${st.sessao && !st.vinculo ? '<button type="button" class="ens-bt" data-acao="vincular">Simular: o Pessoal liga a conta ao quadro</button>' : ''}
      ${st.sessao && st.vinculo ? `<fieldset class="ens-fatos"><legend>O que o SOMA confere sozinho</legend>${FATOS.map(([k, r]) =>
        `<label><input type="checkbox" data-fato="${k}"${st.fatos[k] ? ' checked' : ''}> ${r}</label>`).join('')}</fieldset>` : ''}
      <div class="ens-pe"><button type="button" class="ens-bt" data-acao="recomecar">Recomeçar</button><a class="ens-bt" href="tour.html">Sair do ensaio</a></div>
      </div>`;
  }
  const css = document.createElement('style');
  css.textContent = `
  .ensaio{position:fixed;left:16px;bottom:16px;z-index:90;width:min(300px,calc(100vw - 32px));max-height:calc(100dvh - 32px);overflow:auto;box-sizing:border-box;
    padding:14px 16px;border-radius:var(--r);border:1px solid var(--warn);background:var(--panel);color:var(--ink);
    font:14px/1.45 var(--f)}
  .ensaio.recolhido .ens-corpo{display:none}
  .ens-cab{display:flex;align-items:center;justify-content:space-between;gap:10px}
  .ens-cab b{font-family:var(--fd);font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--warn-tx)}
  .ens-rec{width:32px;height:32px;border-radius:var(--r-sm);border:1px solid var(--line2);background:transparent;color:inherit;cursor:pointer}
  .ens-nota{margin:10px 0;font-size:12.5px;color:var(--muted)}
  .ens-l{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
  .ensaio select{width:100%;min-height:40px;border-radius:var(--r-sm);border:1px solid var(--line2);background:var(--campo);color:inherit;padding:0 10px;font:inherit}
  .ens-sit{margin:10px 0 6px;font-size:13px}
  .ens-fatos{border:0;margin:8px 0 0;padding:0;display:flex;flex-direction:column;gap:6px}
  .ens-fatos legend{font-size:12px;color:var(--muted);margin-bottom:6px;padding:0}
  .ens-fatos label{display:flex;gap:8px;align-items:center;font-size:13px}
  .ens-bt{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:6px 12px;margin-top:8px;border-radius:var(--r-sm);
    border:1px solid var(--line2);background:transparent;color:inherit;font:500 13px var(--f);cursor:pointer;text-decoration:none}
  .ens-pe{display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;border-top:1px solid var(--line);padding-top:6px}
  @media print{.ensaio{display:none}}`;
  document.head.appendChild(css);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', desenharPainel); else desenharPainel();
})();
