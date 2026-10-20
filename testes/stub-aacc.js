/* O aproveitamento de AACC (v33) no Supabase falso. Vem DEPOIS do
   stub-supabase.js (o teste concatena os dois): embrulha o createClient
   dele e responde às funções aacc_*, à doc_validar da folha, à tabela
   aacc_config e ao bucket "aproveitamento". O resto continua com o stub
   de sempre.

   A pessoa logada é a Ana (4, admin). Há dois pedidos do Bruno (11): o
   AAC-8, em análise na última etapa (a Ana decide e indica o
   professor), e o AAC-5, aprovado, com a folha emitida (o PDF final).
   O da Ana nasce no teste, AAC-9. O link do professor que abre é
   "a" × 64; "b" × 64 já venceu. */
(function(){
  const base = window.supabase.createClient;
  const agora = () => new Date().toISOString();
  const BAREMA = [
    { chave:'aderencia', peso:15, nome:'Aderência à formação', descritor:'As atividades são de engenharia do curso do estudante.' },
    { chave:'profundidade', peso:25, nome:'Profundidade técnica', descritor:'Método, cálculos e decisões justificadas.' },
    { chave:'contribuicao', peso:20, nome:'Contribuição individual', descritor:'O que o estudante fez, separado da equipe.' },
    { chave:'evidencias', peso:15, nome:'Evidências e rastreabilidade', descritor:'Códigos no SOMA, repositórios, documentos.' },
    { chave:'resultados', peso:15, nome:'Resultados e impacto', descritor:'Resultados medidos e comparados.' },
    { chave:'comunicacao', peso:10, nome:'Comunicação', descritor:'Texto claro, figuras com legenda.' }];
  const SEM = [{ rotulo:'2024/1', meses:5, situacao:'conta' }, { rotulo:'2024/2', meses:6, situacao:'conta' },
               { rotulo:'2025/1', meses:2, situacao:'parcial' }, { rotulo:'2025/2', meses:6, situacao:'conta' }];
  const A = window.__aacc = {
    cfg: { id:true, grupos:[3, 1, 2], rotulos:['PMO', 'Departamento de Pessoal', 'Coordenação'], dominio_professor:'ufmg.br',
           prazo_professor_dias:30, nota_minima:60, meses_por_semestre:4, barema:BAREMA,
           template_url:'https://brand.neurodynamics.dev/assets/template-relatorio-aacc.zip' },
    membro: { registro:4, nome:'Ana Figueiredo', email:'ana@neurodynamics.dev', email_nro:'ana@neurodynamics.dev', email_pessoal:'ana@exemplo.com',
      telefone:'31999990000', status:'Ativo', situacao:'ativo', cargo:'Gerente de projeto', departamento:'Engenharia',
      inicio:'2024-03-01', fim:null, ate:'2026-10-20', supervisor:{ nome:'Bruno Tavares', cargo:'Pesquisador' }, projetos:'NEBULA',
      perfil:{ cpf:'000.000.000-00', data_nascimento:'2001-04-02', endereco:'Rua A, 1', cidade_origem:'Belo Horizonte', instituicao:'UFMG',
               curso:'Engenharia de Controle e Automação', matricula:'2022012345', periodo_ingresso:null, genero:'Feminino', autodeclaracao_racial:null },
      curso:'Engenharia de Controle e Automação', matricula:'2022012345', instituicao:'UFMG', periodo_ingresso:null, ingresso:null,
      afastamentos:[{ inicio:'2025-03-01', fim:'2025-06-30', motivo:'Intercâmbio', protocolo:'SOL-0001' }],
      treinamentos:[{ codigo:'NRO-TRE-003', titulo:'Segurança elétrica em bancada', revisao:'A', carga_horaria_min:270, concluido_em:'2024-05-10', certificado:'CERT-AB12-CD34' }],
      faltam:['periodo_ingresso', 'autodeclaracao_racial'], opcionais:['lattes'] },
    pedidos: [], hist: {}, dec: {}
  };
  const doc = n => `NRO-PES-020-${n}`;
  const novoPedido = (o) => Object.assign({ id:'00000000-0000-4000-8000-00000000000' + o.numero, codigo:'AAC-' + o.numero, documento:doc(o.numero),
    etapa:0, versao:0, n_etapas:3, semestres:SEM, criado_em:agora(), atualizado_em:agora(), motivo:null, emitido:null, nota:null,
    prof_nome:null, prof_titulo:null, pedido:{ principal:'EQC', alternativas:['VPC'], siex:[], ic:[], colegiado:null } }, o);
  A.pedidos.push(novoPedido({ numero:8, registro:11, nome:'Bruno Tavares', status:'analise', etapa:3, etapa_rotulo:'Coordenação', versao:1,
    enviado_em:'2026-10-12T15:00:00Z', pdf_caminho:'11/00000000-0000-4000-8000-000000000008/v1-abababab.pdf', pdf_paginas:5, folha:2,
    pdf_meta:{ documento:doc(8), modo:'final', pendencias:'0', folha:'2', principal:'EQC', creditos:'10', principalcreditos:'9', itens:'1', semestres:'3' },
    dados:{ membro:{ nome:'Bruno Tavares', curso:'Engenharia Elétrica', matricula:'2021000111', ingresso:'2021/1', situacao:'egresso', inicio:'2023-03-01', fim:'2025-06-30' } } }));
  A.pedidos.push(novoPedido({ numero:5, registro:11, nome:'Bruno Tavares', status:'concluido', etapa:4, versao:2, nota:85,
    enviado_em:'2026-09-02T15:00:00Z', concluido_em:'2026-09-20T13:11:00Z', emitido:'FC6V-TZZ5-N9CV', prof_nome:'Joana Exemplo', prof_titulo:'Profa. Dra.',
    pdf_caminho:'11/00000000-0000-4000-8000-000000000005/v2-cdcdcdcd.pdf', pdf_paginas:5, folha:2,
    pdf_meta:{ documento:doc(5), creditos:'10', principalcreditos:'9', itens:'1' },
    barema:BAREMA.map(b => ({ ...b, nota:8.5, pontos:8.5 * b.peso / 10 })),
    dados:{ membro:{ nome:'Bruno Tavares', curso:'Engenharia Elétrica', matricula:'2021000111', ingresso:'2021/1', situacao:'egresso', inicio:'2023-03-01', fim:'2025-06-30' } } }));
  A.dec['AAC-8'] = [{ versao:1, etapa:1, rotulo:'PMO', nome:'Iara Souza', decisao:'aprovada', parecer:null, criado_em:'2026-10-13T17:03:00Z' },
                    { versao:1, etapa:2, rotulo:'Departamento de Pessoal', nome:'Gabi Rocha', decisao:'aprovada', parecer:'Conferido.', criado_em:'2026-10-14T12:40:00Z' }];
  const EMISSAO = { codigo:'FC6V-TZZ5-N9CV', controle:'8F2A91C0', tipo:'aproveitamento', documento:doc(5), revisao:'A', titulo:'Folha de aprovação',
    emissor:'Departamento de Pessoal', titular:'Bruno Tavares', registro:11, emitido_em:'2026-09-20T13:11:00Z', url_validacao:'https://auth.neurodynamics.dev',
    situacao:'autentico', revogado_em:null, segunda_via:false,
    dados:{ pedido:'AAC-5', serie_titulo:'RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC', norma:'Resolução nº 02/2019 da Congregação da Escola de Engenharia da UFMG',
      estudante:{ nome:'Bruno Tavares', matricula:'2021000111', curso:'Engenharia Elétrica', ingresso:'2021/1', colegiado:null },
      equipe:{ inicio:'2023-03-01', fim:'2025-06-30', situacao:'egresso', cargo:'Pesquisador' },
      enquadramento:{ principal:'EQC', alternativas:['VPC'], siex:[], ic:[] }, semestres:SEM,
      creditos:{ total:'10', principal:'EQC', principal_creditos:'9', semestres:'3', itens:'1' },
      relatorio:{ versao:2, paginas:5, sha256:'1a2b3c4d5e6f7a8b9c0d1e2f', enviado_em:'2026-09-02T15:00:00Z', folha:2 },
      aprovacoes:[{ etapa:1, rotulo:'PMO', nome:'Iara Souza', em:'2026-09-03T17:03:00Z' }, { etapa:2, rotulo:'Departamento de Pessoal', nome:'Gabi Rocha', em:'2026-09-04T12:40:00Z' },
                  { etapa:3, rotulo:'Coordenação', nome:'Diego Prado', em:'2026-09-05T19:22:00Z' }],
      professor:{ nome:'Joana Exemplo', titulo:'Profa. Dra.', email:'j•••@ufmg.br', em:'2026-09-20T13:11:00Z', nota:85, conceito:'B',
        barema:BAREMA.map(b => ({ chave:b.chave, nome:b.nome, peso:b.peso, nota:8.5, pontos:8.5 * b.peso / 10 })),
        parecer:'Relatório consistente, com evidências rastreáveis.', indicado_por:'Diego Prado' },
      cidade:'Belo Horizonte', data:'2026-09-20' } };

  const reg = () => 4;
  const camposObrig = ['email_pessoal','telefone','cpf','data_nascimento','endereco','cidade_origem','instituicao','curso','matricula','periodo_ingresso','genero','autodeclaracao_racial'];
  function recontar(){
    const m = A.membro, p = m.perfil;
    m.faltam = camposObrig.filter(k => !String((k === 'email_pessoal' || k === 'telefone' ? m[k] : p[k]) || '').trim());
    m.curso = p.curso; m.matricula = p.matricula; m.periodo_ingresso = p.periodo_ingresso;
    const g = /^(\d{4})\/([12])$/.exec(p.periodo_ingresso || ''); m.ingresso = g ? p.periodo_ingresso : null;
  }
  const bloqueios = () => { const b = []; if (A.membro.faltam.length) b.push('recadastro'); if (!A.membro.ingresso) b.push('ingresso'); return b; };
  const meu = () => A.pedidos.find(p => p.registro === reg() && ['preparacao','analise','devolvido','professor','concluido'].includes(p.status));
  const pend = p => p.status === 'analise' && p.registro !== reg() && !(A.dec[p.codigo] || []).some(d => d.versao === p.versao && d.nome === 'Ana Figueiredo');
  const hist = (p, acao, detalhe, nome) => (A.hist[p.codigo] ||= []).push({ nome: nome || 'Ana Figueiredo', acao, detalhe, criado_em:agora() });
  const r = data => ({ data, error:null });

  function aacc(nome, a){
    const p0 = a?.p || {};
    switch (nome){
      case 'aacc_meu': {
        const p = meu();
        return r({ status:'ok', membro:A.membro, semestres:SEM, bloqueios:bloqueios(), pedido:p || null,
          anteriores:[], aprovador:true, gere:true,
          serie:{ codigo:'NRO-PES-020', revisao:'A', emissor:'Departamento de Pessoal' },
          config:{ template_url:A.cfg.template_url, meses_por_semestre:4, rotulos:A.cfg.rotulos, n_etapas:3, nota_minima:60, dominio_professor:'ufmg.br', horas_por_credito:15 } });
      }
      case 'aacc_perfil_salvar': {
        let n = 0;
        for (const [k, v] of Object.entries(p0)){
          if (k === 'cpf' && v && v.replace(/\D/g, '').length !== 11) return r({ status:'invalido', campo:k });
          if (k === 'periodo_ingresso' && v && !/^\d{4}\/[12]$/.test(v)) return r({ status:'invalido', campo:k });
          if (k === 'email_pessoal' || k === 'telefone') A.membro[k] = v; else A.membro.perfil[k] = v || null;
          n++;
        }
        recontar();
        return r({ status:'ok', campos:n, membro:A.membro });
      }
      case 'aacc_preparar': {
        if (bloqueios().length) return r({ status:'incompleto', bloqueios:bloqueios() });
        if (!['EQC','EXT','IC','VPC'].includes(p0.principal)) return r({ status:'invalido', campo:'principal' });
        if ((p0.principal === 'EXT' || (p0.alternativas || []).includes('EXT')) && !(p0.siex || []).length) return r({ status:'invalido', campo:'siex' });
        let p = meu();
        const ped = { principal:p0.principal, alternativas:p0.alternativas || [], siex:p0.siex || [], ic:p0.ic || [], colegiado:p0.colegiado || null };
        if (p){ if (!['preparacao','devolvido'].includes(p.status)) return r({ status:'em_andamento' }); p.pedido = ped; hist(p, 'preparou', 'Enquadramento ' + ped.principal); }
        else { p = novoPedido({ numero:9, registro:4, nome:'Ana Figueiredo', status:'preparacao', pedido:ped,
                 dados:{ membro:{ ...A.membro }, semestres:SEM, pedido:ped } }); A.pedidos.push(p); hist(p, 'criou', 'Enquadramento ' + ped.principal); }
        return r({ status:'ok', pedido:p });
      }
      case 'aacc_enviar': {
        const p = A.pedidos.find(x => x.id === p0.id);
        if (!p || p.registro !== reg()) return r({ status:'nao_encontrado' });
        const kw = String(p0.keywords || '');
        if (!kw.includes('documento=' + p.documento)) return r({ status:'outro_pedido', documento:'?', esperado:p.documento });
        Object.assign(p, { status:'analise', etapa:1, etapa_rotulo:'PMO', versao:p.versao + 1, pdf_caminho:p0.caminho, pdf_paginas:p0.paginas,
          pdf_sha256:p0.sha256, folha:2, enviado_em:agora(), motivo:null, pdf_meta:Object.fromEntries(kw.split(';').filter(x => x.includes('=')).map(x => x.split('=').map(s => s.trim()))) });
        hist(p, 'enviou', `Versão ${p.versao}, ${p0.paginas} páginas`);
        return r({ status:'ok', situacao:'analise', etapa:1, avisados:2 });
      }
      case 'aacc_lista':
        return r(A.pedidos.map(p => ({ ...p, meu:p.registro === reg(), posso_decidir:pend(p) })));
      case 'aacc_pendentes':
        return r(A.pedidos.filter(pend).length);
      case 'aacc_ler': {
        const p = A.pedidos.find(x => x.codigo === String(a.p_codigo).toUpperCase());
        if (!p) return r({ status:'nao_encontrado' });
        const dec = pend(p);
        return r({ status:'ok', pedido:{ ...p, prof_email:p.prof_nome ? 'joana@ufmg.br' : null },
          etapas:[{ etapa:1, rotulo:'PMO', grupo:'NRO_PMO' }, { etapa:2, rotulo:'Departamento de Pessoal', grupo:'Depto de Pessoal' }, { etapa:3, rotulo:'Coordenação', grupo:'NRO_COORD_OFFICE' }],
          versoes:[], decisoes:A.dec[p.codigo] || [], historico:A.hist[p.codigo] || [],
          pode:{ decidir:dec, indicar:dec && p.etapa === 3, trocar_professor:p.status === 'professor' && p.registro !== reg(),
                 enviar:p.registro === reg() && ['preparacao','devolvido'].includes(p.status), preparar:p.registro === reg(),
                 reabrir:p.status === 'concluido', cancelar:!['concluido','cancelado'].includes(p.status), baixar_final:p.status === 'concluido' && !!p.emitido },
          config:{ dominio_professor:'ufmg.br', prazo_professor_dias:30, nota_minima:60 } });
      }
      case 'aacc_decidir': {
        const p = A.pedidos.find(x => x.id === p0.id);
        if (!p || !pend(p)) return r({ status:'fora_de_aprovacao' });
        if (p0.decisao === 'devolver'){
          if (!p0.parecer) return r({ status:'invalido', campo:'parecer' });
          Object.assign(p, { status:'devolvido', etapa:0, motivo:p0.parecer }); hist(p, 'devolveu', p0.parecer);
          return r({ status:'ok', situacao:'devolvido' });
        }
        if (p.etapa === 3){
          const pr = p0.professor || {};
          if (!pr.nome || pr.nome.length < 5) return r({ status:'invalido', campo:'professor_nome' });
          if (!/@([a-z0-9-]+\.)*ufmg\.br$/i.test(pr.email || '')) return r({ status:'dominio', dominio:'ufmg.br' });
          if (!String(p0.pdf_url || '').includes('/object/sign/aproveitamento/' + p.pdf_caminho)) return r({ status:'invalido', campo:'pdf_url' });
          (A.dec[p.codigo] ||= []).push({ versao:p.versao, etapa:3, rotulo:'Coordenação', nome:'Ana Figueiredo', decisao:'aprovada', parecer:p0.parecer || null, criado_em:agora() });
          Object.assign(p, { status:'professor', etapa:4, prof_nome:pr.nome, prof_titulo:pr.titulo, prof_expira:'2026-11-19T15:00:00Z',
            prof_indicado_nome:'Ana Figueiredo', prof_indicado_em:agora() });
          hist(p, 'indicou', `${pr.titulo} ${pr.nome} (${pr.email})`);
          return r({ status:'ok', situacao:'professor' });
        }
        (A.dec[p.codigo] ||= []).push({ versao:p.versao, etapa:p.etapa, rotulo:'?', nome:'Ana Figueiredo', decisao:'aprovada', criado_em:agora() });
        p.etapa++; return r({ status:'ok', situacao:'analise', etapa:p.etapa });
      }
      case 'aacc_professor_trocar': return r({ status:'ok' });
      case 'aacc_reabrir': case 'aacc_cancelar': {
        const p = A.pedidos.find(x => x.id === a.p_id);
        if (!p) return r({ status:'nao_encontrado' });
        if (!a.p_motivo) return r({ status:'invalido', campo:'motivo' });
        if (nome === 'aacc_reabrir'){ Object.assign(p, { status:'devolvido', etapa:0, motivo:'Reaberto: ' + a.p_motivo }); return r({ status:'ok', situacao:'devolvido' }); }
        p.status = 'cancelado'; p.motivo = a.p_motivo; return r({ status:'ok', situacao:'cancelado' });
      }
      case 'aacc_folha': {
        const p = A.pedidos.find(x => x.id === a.p_id);
        if (!p?.emitido) return r({ status:'nao_emitido' });
        return r({ status:'ok', pdf_caminho:p.pdf_caminho, folha:p.folha, paginas:p.pdf_paginas, emissao:EMISSAO });
      }
      case 'aacc_config_salvar': return r({ status:'ok' });
      case 'aacc_professor_ler': {
        const t = String(a.p_token || '');
        if (t === 'b'.repeat(64)) return r({ status:'expirado', codigo:'AAC-8' });
        if (t !== 'a'.repeat(64)) return r({ status:'nao_encontrado' });
        const p = A.pedidos.find(x => x.numero === 8);
        return r({ status:'ok', pedido:{ ...p, membro:p.dados.membro, pdf_url:'https://x.supabase.co/storage/v1/object/sign/aproveitamento/' + p.pdf_caminho + '?token=t',
          prof_expira:'2026-11-19T15:00:00Z' }, aprovacoes:(A.dec['AAC-8'] || []).filter(d => d.decisao === 'aprovada'),
          barema:BAREMA, nota_minima:60 });
      }
      case 'aacc_professor_decidir': {
        const p = a.p || {};
        if (p.decisao === 'devolver') return r(p.parecer ? { status:'ok', situacao:'devolvido' } : { status:'invalido', campo:'parecer' });
        let n = 0;
        for (const b of BAREMA){ const v = (p.notas || {})[b.chave]; if (typeof v !== 'number' || v < 0 || v > 10 || !Number.isInteger(v * 2)) return r({ status:'invalido', campo:'nota', criterio:b.chave }); n += v * b.peso / 10; }
        n = Math.round(n * 100) / 100;
        if (n < 60) return r({ status:'nota_minima', nota:n, minima:60 });
        if (p.confirmo !== true) return r({ status:'invalido', campo:'confirmo' });
        return r({ status:'ok', situacao:'concluido', codigo:'FC6V-TZZ5-N9CV', nota:n });
      }
      case 'doc_validar':
        return r(String(a.p_codigo) === EMISSAO.codigo ? { status:'ok', ...EMISSAO } : { status:'nao_encontrado' });
    }
    return r({ status:'ok' });
  }

  const PDF = () => { const b = atob(window.__aaccPdf || ''); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
  const bucket = {
    upload: async (caminho, arquivo, op) => { (window.__uploads ||= []).push({ bucket:'aproveitamento', caminho, nome:arquivo?.name, op }); return r({ path:caminho }); },
    createSignedUrl: async (caminho, exp) => { (window.__assinados ||= []).push({ caminho, exp });
      return r({ signedUrl:'https://x.supabase.co/storage/v1/object/sign/aproveitamento/' + caminho + '?token=t' }); },
    download: async (caminho) => { (window.__baixados ||= []).push({ bucket:'aproveitamento', caminho }); return r(new Blob([PDF()], { type:'application/pdf' })); }
  };
  function cfgBuilder(){
    const b = { select(){ return b; }, eq(){ return b; }, maybeSingle(){ return b; }, single(){ return b; },
      then(ok){ return Promise.resolve(ok(r({ ...A.cfg }))); } };
    return b;
  }

  window.supabase.createClient = function(){
    const c = base.apply(this, arguments);
    const rpc0 = c.rpc, from0 = c.from, st0 = c.storage;
    c.rpc = async (nome, args) => {
      if (!/^aacc_/.test(nome) && !(nome === 'doc_validar' && String(args?.p_codigo) === EMISSAO.codigo)) return rpc0(nome, args);
      (window.__rpcs ||= []).push({ nome, p:args });
      return aacc(nome, args || {});
    };
    c.from = t => t === 'aacc_config' ? cfgBuilder() : from0(t);
    c.storage = { from: b => b === 'aproveitamento' ? bucket : st0.from(b) };
    return c;
  };
})();
