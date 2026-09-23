/* Supabase falso: só o suficiente para exercitar o módulo de gestão. */
(function(){
  const DADOS = {
    perfis: [{ id:'u1', nome:'Ana Figueiredo', email:'ana@neurodynamics.dev', papel:'admin', registro:4 }],
    membros: [
      { registro:4,  nome:'Ana Figueiredo', cargo:'Gerente de projeto', departamento:'Engenharia',
        status:'Ativo', grupos:['Órtese','Gestão'], gestor_registro:null, email_nro:'ana@neurodynamics.dev',
        data_ingresso:'2024-03-01', forma_ingresso:'Processo seletivo', bolsa:'FAPEMIG',
        atualizado_em:'2026-09-01T12:00:00Z' },
      { registro:11, nome:'Bruno Tavares', cargo:'Pesquisador', departamento:'Pesquisa',
        status:'Ativo', grupos:['Sinais','NRO_PROJECT_NEBULA'], gestor_registro:4, email_nro:'bruno@neurodynamics.dev' },
      { registro:17, nome:'Carla Mendonça', cargo:'Desenvolvedora', departamento:'Engenharia',
        status:'Em pausa / avaliação', grupos:['Firmware','NRO_MANAGERS'], gestor_registro:4 },
      { registro:23, nome:'Diego Prado', cargo:'Designer', departamento:'Comunicação',
        status:'Desligado', grupos:['Marca'], gestor_registro:4, data_desligamento:'2026-06-30' }
    ],
    tipos_ocorrencia: [{ nome:'Advertência', ativo:true }, { nome:'Elogio', ativo:true }],
    itens_de_acesso: [
      { id:'i1', nome:'LABBIO — porta principal', categoria:'local', ativo:true, ordem:1 },
      { id:'i2', nome:'Google Workspace', categoria:'sistema', ativo:true, ordem:2 },
      { id:'i3', nome:'Termo de confidencialidade', categoria:'documento', ativo:true, ordem:3 }
    ],
    ocorrencias: [
      { id:'o1', registro:4, tipo:'Mudança de cargo', data:'2026-05-02',
        descricao:'De "Desenvolvedora" para "Gerente de projeto".', responsavel:'Depto. de Pessoal',
        membro:{ nome:'Ana Figueiredo' } }
    ],
    acessos_concedidos: [{ id:'a1', registro:4, item_id:'i1', ativo:true, concedido_em:'2024-03-05', responsavel:'DP' }],
    avaliacoes: [{ id:'v1', registro:4, ciclo:'2026/1', data:'2026-07-01', assiduidade:5,
      comprometimento:4, apontamentos:'Conduziu a integração do grupo.', responsavel:'DP',
      encaminhar_pessoal:false, tratado:false }],
    apontamento_itens: [{ id:'p1', registro:4, data:'2026-09-05', assiduidade:'SUFICIENTE',
      entregas:'SUFICIENTE', sinalizado:false, apontamento_id:'ap1' }],
    apontamentos: [{ id:'ap1', grupo:'Órtese', responsavel:'Ana Figueiredo' }],
    dados_pessoais: [{ registro:4, cpf:'000.000.000-00', curso:'Engenharia de Controle', instituicao:'UFMG' }],
    auditoria: [
      { id:'x1', ocorrido_em:'2026-09-10T14:03:00Z', responsavel_email:'dp@neurodynamics.dev',
        tabela:'membros', registro_ref:'4', operacao:'UPDATE', campo:'cargo',
        valor_anterior:'Desenvolvedora', valor_novo:'Gerente de projeto' },
      { id:'x2', ocorrido_em:'2026-09-09T10:00:00Z', responsavel_email:'dp@neurodynamics.dev',
        tabela:'acessos_concedidos', registro_ref:'11', operacao:'INSERT', campo:'ativo',
        valor_anterior:null, valor_novo:'true' }
    ],
    /* a ordem é a mesma de grupos_visiveis, abaixo: o menu lateral lista
       os quadros da pessoa por ela, não pela ordem em que chegaram */
    /* v19: a árvore do pedido — NRO_LEADERSHIP contém MANAGERS (e a
       Gerência); NRO_PROJECTS contém NEBULA. Os dois guarda-chuvas não
       têm quadro. A Ana (a pessoa logada) não está em nenhum deles, de
       propósito: os quadros do menu dela não mudam. */
    grupos: [
      { id:1, nome:'Órtese', prefixo:'ORT', ativo:true, cor:null, chave:null, reservado:false, ordem:4,
        pai_id:null, quadro:true, responsaveis:[], descricao:null },
      { id:2, nome:'Sinais', prefixo:'SIN', ativo:true, cor:null, chave:null, reservado:false, ordem:3,
        pai_id:null, quadro:true, responsaveis:[], descricao:null },
      { id:3, nome:'Depto de Pessoal', prefixo:'DEP', ativo:true, cor:null,
        chave:'pessoal', reservado:true, ordem:2, pai_id:null, quadro:true, responsaveis:[], descricao:null },
      { id:4, nome:'Gerência', prefixo:'GER', ativo:true, cor:null, chave:null, reservado:true, ordem:1,
        pai_id:5, quadro:true, responsaveis:[], descricao:null },
      { id:5, nome:'NRO_LEADERSHIP', prefixo:'LEA', ativo:true, cor:null, chave:null, reservado:true, ordem:5,
        pai_id:null, quadro:false, responsaveis:[], descricao:'A liderança da equipe: gerência e supervisão.' },
      { id:6, nome:'NRO_MANAGERS', prefixo:'MAN', ativo:true, cor:null, chave:null, reservado:false, ordem:6,
        pai_id:5, quadro:true, responsaveis:[], descricao:null },
      { id:7, nome:'NRO_PROJECTS', prefixo:'PRJ', ativo:true, cor:null, chave:'projetos', reservado:false, ordem:7,
        pai_id:null, quadro:false, responsaveis:[], descricao:'Um subgrupo por projeto.' },
      { id:8, nome:'NRO_PROJECT_NEBULA', prefixo:'NEB', ativo:true, cor:null, chave:null, reservado:false, ordem:8,
        pai_id:7, quadro:true, responsaveis:[11], descricao:null }
    ],
    notificacao_preferencias: [{ registro:4, email_modo:'resumo' }],
    /* a v17 trocou a leitura de "grupos" por "grupos_visiveis", que traz o
       meu nível em cada quadro. O stub simula um admin: edição em tudo,
       menos na Gerência, que está como "nenhum" para exercitar a tela de
       quadro fechado. */
    /* ordem = a hierarquia configurada em Administração -> Grupos.
       Propositalmente NÃO alfabética, para o teste pegar se alguém
       reordenar a lista por conta própria. */
    grupos_visiveis: [
      { id:4, nome:'Gerência',        prefixo:'GER', cor:null, ordem:1, reservado:true,
        chave:null, meu_nivel:'nenhum',  pessoas:3 },
      { id:3, nome:'Depto de Pessoal', prefixo:'DEP', cor:null, ordem:2, reservado:true,
        chave:'pessoal', meu_nivel:'edicao', pessoas:1 },
      { id:2, nome:'Sinais',           prefixo:'SIN', cor:null, ordem:3, reservado:false,
        chave:null, meu_nivel:'leitura', pessoas:1 },
      { id:1, nome:'Órtese',           prefixo:'ORT', cor:null, ordem:4, reservado:false,
        chave:null, meu_nivel:'edicao',  pessoas:2 }
    ],
    grupo_acessos: [{ grupo_id:4, registro:11, nivel:'leitura', concedido_por:4 }],
    atividades_quadro: [
      { id:'t9', codigo:'DEP-1', grupo_id:3, grupo:'Depto de Pessoal', grupo_prefixo:'DEP', seq:1,
        titulo:'SOL26-0001 — Acesso ao LABBIO', descricao:'Carla Mendonça abriu uma solicitação de acesso.',
        status:'a_fazer', prioridade:'media', responsavel:null, responsavel_nome:null,
        criado_por:17, criado_por_nome:'Carla Mendonça', prazo:null, sinalizada:false,
        ordem:500, arquivada:false, comentarios:0, atrasada:false, criado_em:'2026-09-20T09:00:00Z',
        origem_tipo:'solicitacao', origem_id:'s1' },
      { id:'t1', codigo:'ORT-1', grupo_id:1, grupo:'Órtese', grupo_prefixo:'ORT', seq:1,
        titulo:'Calibrar o encoder', descricao:'Bancada 2.', status:'fazendo', prioridade:'alta',
        responsavel:11, responsavel_nome:'Bruno Tavares', criado_por:4, criado_por_nome:'Ana Figueiredo',
        prazo:'2026-09-10', estimativa_h:4, sinalizada:true, sinalizada_motivo:'Bloqueada pelo fornecedor',
        ordem:1000, arquivada:false, comentarios:2, atrasada:true, criado_em:'2026-09-01T10:00:00Z' },
      { id:'t2', codigo:'ORT-2', grupo_id:1, grupo:'Órtese', grupo_prefixo:'ORT', seq:2,
        titulo:'Revisar o firmware', status:'a_fazer', prioridade:'media', responsavel:17,
        responsavel_nome:'Carla Mendonça', criado_por:4, criado_por_nome:'Ana Figueiredo',
        prazo:null, sinalizada:false, ordem:2000, arquivada:false, comentarios:0, atrasada:false,
        criado_em:'2026-09-05T10:00:00Z' },
      { id:'t3', codigo:'ORT-3', grupo_id:1, grupo:'Órtese', grupo_prefixo:'ORT', seq:3,
        titulo:'Montar a bancada', status:'concluida', prioridade:'baixa', responsavel:4,
        responsavel_nome:'Ana Figueiredo', criado_por:4, criado_por_nome:'Ana Figueiredo',
        sinalizada:false, ordem:3000, arquivada:false, comentarios:0, atrasada:false,
        criado_em:'2026-08-20T10:00:00Z' },
      { id:'t4', codigo:'SIN-1', grupo_id:2, grupo:'Sinais', grupo_prefixo:'SIN', seq:1,
        titulo:'Filtro passa-faixa', status:'backlog', prioridade:'media', responsavel:null,
        responsavel_nome:null, criado_por:11, criado_por_nome:'Bruno Tavares',
        sinalizada:false, ordem:1000, arquivada:false, comentarios:0, atrasada:false,
        criado_em:'2026-09-08T10:00:00Z' }
    ],
    atividade_comentarios: [
      { id:'c1', atividade_id:'t1', registro:4, corpo:'Fornecedor respondeu?', mencionados:[11],
        criado_em:'2026-09-12T09:00:00Z' },
      { id:'c2', atividade_id:'t1', registro:11, corpo:'Ainda não. Vou cobrar hoje.',
        mencionados:[], criado_em:'2026-09-15T14:00:00Z' }
    ],
    atividade_log: [
      { id:1, atividade_id:'t1', registro:4, tipo:'criou', para:'ORT-1', criado_em:'2026-09-01T10:00:00Z' },
      { id:2, atividade_id:'t1', registro:4, tipo:'atribuiu', campo:'responsavel', para:'Bruno Tavares', criado_em:'2026-09-01T10:01:00Z' },
      { id:3, atividade_id:'t1', registro:11, tipo:'moveu', campo:'status', de:'a_fazer', para:'fazendo', criado_em:'2026-09-03T08:00:00Z' },
      { id:4, atividade_id:'t1', registro:4, tipo:'sinalizou', para:'Bloqueada pelo fornecedor', criado_em:'2026-09-16T11:00:00Z' }
    ],
    atividade_seguidores: [{ atividade_id:'t1', registro:4 }, { atividade_id:'t1', registro:11 }],
    atividades_carga: [
      { registro:11, nome:'Bruno Tavares', abertas:3, fazendo:1, atrasadas:1, sinalizadas:1, horas_abertas:12 },
      { registro:17, nome:'Carla Mendonça', abertas:1, fazendo:0, atrasadas:0, sinalizadas:0, horas_abertas:0 }
    ],
    notificacoes: [
      { id:1, registro:4, tipo:'atividade_sinalizada', titulo:'ORT-1 — Calibrar o encoder',
        corpo:'Bloqueada pelo fornecedor', href:'#/atividades/card/ORT-1', lida:false,
        criado_em:'2026-09-16T11:00:00Z' },
      { id:2, registro:4, tipo:'atividade_comentario', titulo:'ORT-1 — Calibrar o encoder',
        corpo:'Novo comentário.', href:'#/atividades/card/ORT-1', lida:true,
        criado_em:'2026-09-15T14:00:00Z' }
    ],
    site_projetos: [
      { id:'p1', nome:'Órtese ativa', slug:'ortese-ativa', status:'Prototype', ordem:10,
        tags:['FES'], publicado:true, tagline:'Walk again', resumo:'…', descricao:'…' }
    ],
    eventos: [{ id:'e1', numero:12, titulo:'Reunião geral', tipo:'Reunião geral',
      data:'2026-10-05', hora:'14:00 às 15:30', hora_inicio:'14:00:00', hora_fim:'15:30:00',
      local:'LABBIO', meet_url:'https://meet.google.com/abc', pauta:'Fechamento do semestre',
      deliberacoes:null, status:'Preparação', owner_registro:4, recorrencia:'Única',
      grupos:['Órtese'], visibilidade:'equipe' }],
    evento_participantes: [
      { id:'pp1', evento_id:'e1', registro:11, resposta:'vou', presente:null,
        membro:{ nome:'Bruno Tavares', cargo:'Pesquisador' } },
      { id:'pp2', evento_id:'e1', registro:17, resposta:'talvez', presente:null,
        membro:{ nome:'Carla Mendonça', cargo:'Desenvolvedora' } }
    ],
    evento_checklist: [
      { id:'ck1', evento_id:'e1', item:'Reservar o auditório pelo SisCAS', feito:true, ordem:10 },
      { id:'ck2', evento_id:'e1', item:'Enviar convite com RSVP', feito:true, ordem:20 },
      { id:'ck3', evento_id:'e1', item:'Imprimir a lista de presença', feito:false, ordem:30 }
    ],
    portal_avisos: [],
    portal_documentos: [
      { id:'d1', titulo:'Estatuto', categoria:'institucional', url:'https://drive.google.com/e',
        publicado:true, ordem:1 },
      { id:'d2', titulo:'Guia do primeiro mês', categoria:'guia', url:'https://drive.google.com/g',
        publicado:true, ordem:2 }
    ],
    portal_solicitacoes: [],
    /* OKRs: dois estratégicos, o OE1 desdobrado em dois táticos e um
       operacional — o bastante para a cadeia, os irmãos e o progresso */
    okr_objetivos: [
      { id:'k1', codigo:'OE1', titulo:'Consolidar a equipe de pesquisa', nivel:'estrategico', pai_id:null,
        eixo:'Gestão', ano:2026, prazo:'2026-12-31', status:'Em andamento', responsaveis:[4], ordem:10,
        descricao:'Critério: 20 membros ativos até dezembro.', atualizado_em:'2026-09-10T12:00:00Z' },
      { id:'k2', codigo:'OE2', titulo:'Publicar dois artigos em periódico', nivel:'estrategico', pai_id:null,
        eixo:'Científico', ano:2026, prazo:'2026-11-30', status:'Não iniciado', responsaveis:[11], ordem:20,
        atualizado_em:'2026-09-01T12:00:00Z' },
      { id:'k3', codigo:'OT1.1', titulo:'Fechar o processo seletivo 2026', nivel:'tatico', pai_id:'k1',
        eixo:'Gestão', ano:2026, prazo:'2026-10-15', status:'Concluído', responsaveis:[4,17], ordem:10,
        atualizado_em:'2026-09-12T12:00:00Z' },
      { id:'k4', codigo:'OT1.2', titulo:'Treinar os trainees na bancada', nivel:'tatico', pai_id:'k1',
        eixo:'Formação', ano:2026, prazo:'2026-12-10', status:'Em risco', responsaveis:[11], ordem:20,
        atualizado_em:'2026-09-14T12:00:00Z' },
      { id:'k5', codigo:'OP1.2.1', titulo:'Montar o roteiro de treinamento', nivel:'operacional', pai_id:'k4',
        eixo:'Formação', ano:2026, prazo:null, status:'Em andamento', responsaveis:[], ordem:10,
        atualizado_em:'2026-09-15T12:00:00Z' }
    ],
    okr_comentarios: [
      { id:'kc1', objetivo_id:'k1', autor:'Ana Figueiredo', registro:4, texto:'Faltam 3 vagas.', tipo:'comentario',
        criado_em:'2026-09-10T12:00:00Z' },
      { id:'kc2', objetivo_id:'k1', autor:'Ana Figueiredo', registro:4, texto:'Status alterado de "Não iniciado" para "Em andamento".',
        tipo:'sistema', criado_em:'2026-09-01T12:00:00Z' }
    ],
    /* Processo seletivo: uma edição com quatro candidatos em fases
       diferentes, horários de dinâmica e entrevista, uma avaliação */
    ps_edicoes: [
      { id:'ed1', nome:'Processo Seletivo 2026', slug:'ps-2026', descricao:'Edição do segundo semestre.',
        inscricoes_inicio:'2026-08-01', inscricoes_fim:'2026-08-31', status:'publicada', edital_url:null,
        areas:['Hardware','Software'], criado_em:'2026-07-20T12:00:00Z' }
    ],
    ps_candidatos: [
      { id:'c1', edicao_id:'ed1', numero:1, protocolo:'PS26-001', nome:'Joana Ribeiro', email:'joana@ufmg.br',
        telefone:'31 90000-0001', curso:'Eng. Elétrica', periodo:'5º', status:'inscrito',
        areas_interesse:['Hardware'], competencias:['Arduino'], competencias_desejadas:['PCB'],
        criado_em:'2026-08-03T10:00:00Z' },
      { id:'c2', edicao_id:'ed1', numero:2, protocolo:'PS26-002', nome:'Marcos Lima', email:'marcos@ufmg.br',
        curso:'Eng. de Controle', periodo:'3º', status:'deferido', areas_interesse:['Software'],
        criado_em:'2026-08-04T10:00:00Z' },
      { id:'c3', edicao_id:'ed1', numero:3, protocolo:'PS26-003', nome:'Paula Souza', email:'paula@ufmg.br',
        curso:'Eng. Biomédica', periodo:'7º', status:'aprovado_dinamica', criado_em:'2026-08-05T10:00:00Z' },
      { id:'c4', edicao_id:'ed1', numero:4, protocolo:'PS26-004', nome:'Rafael Dias', email:'rafael@ufmg.br',
        curso:'Física', periodo:'2º', status:'trainee', criado_em:'2026-08-06T10:00:00Z' }
    ],
    ps_etapas: [
      { id:'et1', edicao_id:'ed1', titulo:'Inscrições', data_inicio:'2026-08-01', data_fim:'2026-08-31', fase:'inscricao', ordem:10 },
      { id:'et2', edicao_id:'ed1', titulo:'Dinâmicas em grupo', data_inicio:'2026-10-05', data_fim:'2026-10-09', fase:'dinamica', ordem:20 }
    ],
    ps_slots: [
      { id:'s1', edicao_id:'ed1', fase:'dinamica', data:'2026-10-05', hora_inicio:'18:00:00', hora_fim:'19:30:00',
        capacidade:8, local:'LABBIO', ativo:true, codigo:'KXQT' },
      { id:'s2', edicao_id:'ed1', fase:'entrevista', data:'2026-10-20', hora_inicio:'14:00:00', hora_fim:'14:30:00',
        capacidade:1, local:'Sala 2', ativo:true, codigo:null }
    ],
    ps_agendamentos: [
      { id:'ag1', slot_id:'s1', candidato_id:'c2', fase:'dinamica', compareceu:null,
        slot:{ id:'s1', edicao_id:'ed1', data:'2026-10-05', hora_inicio:'18:00:00', hora_fim:'19:30:00', local:'LABBIO' } }
    ],
    ps_publicacoes: [
      { id:'pb1', edicao_id:'ed1', tipo:'edital', titulo:'Edital nº 01/2026', corpo:null, url_anexo:null,
        publicado:true, publicado_em:'2026-07-25T12:00:00Z', criado_em:'2026-07-24T12:00:00Z' },
      { id:'pb2', edicao_id:'ed1', tipo:'resultado_dinamica', titulo:'Resultado da 1ª fase', corpo:null,
        url_anexo:null, publicado:false, publicado_em:null, criado_em:'2026-09-20T12:00:00Z' }
    ],
    ps_avaliacoes: [
      { id:'av1', candidato_id:'c3', fase:'dinamica', criterios:{'Comunicação':4,'Proatividade':5}, nota:4.5,
        parecer:'Puxou o grupo.', recomendacao:'aprovar', avaliador_id:'u9', avaliador:'Bruno Tavares',
        ps_candidatos:{ edicao_id:'ed1' } }
    ],
    ps_faq: [
      { id:'fq1', pergunta:'Preciso ser aluno da UFMG?', resposta:'Não.', ordem:10, edicao_id:null, publicada:true }
    ],
    ps_competencias: [
      { id:'cp1', grupo:'Hardware', nome:'Arduino', ativa:true, ordem:10 },
      { id:'cp2', grupo:'Hardware', nome:'PCB', ativa:true, ordem:20 },
      { id:'cp3', grupo:'Software', nome:"Python d'água", ativa:true, ordem:30 }
    ],
    ps_din_config: [
      { edicao_id:'ed1', titulo:'Dinâmica em grupo', desafio_titulo:'Sprint da bancada', minutos_total:75,
        tam_grupo:5, tolerancia_antes:30, tolerancia_depois:30 }
    ],
    ps_din_itens: [
      { id:'di1', tipo:'bloco', ordem:10, edicao_id:'ed1', slot_id:null, ativo:true,
        dados:{ nome:'Abertura', minutos:10, fala:['Apresente a equipe'] } },
      { id:'di2', tipo:'bloco', ordem:20, edicao_id:'ed1', slot_id:null, ativo:true,
        dados:{ nome:'Desafio', minutos:50, fala:['Distribua os casos'] } },
      { id:'di3', tipo:'avaliador', ordem:10, edicao_id:'ed1', slot_id:'s1', ativo:true,
        dados:{ registro:11, nome:'Bruno Tavares', cargo:'Pesquisador', curso:'', foto_url:'', fala:'' } }
    ],
    portal_ouvidoria: [], portal_agendas: []
  };

  function builder(tabela){
    let linhas = (DADOS[tabela] || []).map(r => ({ ...r }));
    const filtros = [];
    const b = {
      select(){ return b; },
      /* "slot.edicao_id": o supabase-js filtra por coluna da tabela embutida */
      eq(c, v){ filtros.push(r => c.split('.').reduce((o, k) => o?.[k], r) === v); return b; },
      neq(c, v){ filtros.push(r => r[c] !== v); return b; },
      in(c, vs){ filtros.push(r => vs.includes(r[c])); return b; },
      gte(){ return b; }, lte(){ return b; },
      order(){ return b; }, limit(){ return b; },
      /* as escritas ficam em window.__escritas, para o teste conferir */
      insert(d){ (window.__escritas ||= []).push({ tabela, op:'insert', dados:d }); return b; },
      update(d){ (window.__escritas ||= []).push({ tabela, op:'update', dados:d }); return b; },
      upsert(d){ (window.__escritas ||= []).push({ tabela, op:'upsert', dados:d }); return b; },
      delete(){ (window.__escritas ||= []).push({ tabela, op:'delete' }); return b; },
      maybeSingle(){ b._um = true; return b; },
      single(){ b._um = true; return b; },
      then(ok){
        const res = linhas.filter(r => filtros.every(f => f(r)));
        return Promise.resolve(ok({ data: b._um ? (res[0] || null) : res, error: null }));
      }
    };
    return b;
  }

  window.supabase = {
    createClient(){
      return {
        from: builder,
        rpc: async (nome, args) => {
          if (nome === 'notificacoes_marcar_lidas') return { data: 1, error: null };
          if (nome === 'notificacao_teste'){
            const f = window.__teste || {};
            if (f.rpc === 'sem_registro') return { data:{ status:'sem_registro' }, error:null };
            if (f.rpc === 'sem_email')    return { data:{ status:'sem_email' }, error:null };
            if (f.rpc === 'faltaMigracao')
              return { data:null, error:{ message:'function public.notificacao_teste() does not exist' } };
            return { data:{ status:'ok', id:1, email:'ana@neurodynamics.dev',
                            modo: f.modo || 'imediato' }, error:null };
          }
          if (nome === 'atividade_comentar'){
            if (window.__comentarFalha === 'sem_registro')
              return { data: { status:'sem_registro' }, error: null };
            if (window.__comentarFalha === 'lanca') throw new Error('rede caiu');
            window.__comentario = args?.p;
            return { data: { status:'ok', id:'c9' }, error: null };
          }
          if (nome === 'grupo_salvar'){
            const p = args?.p || {};
            window.__grupoSalvo = p;
            /* grava de verdade, para a tela recarregada mostrar o grupo */
            if (!p.id){
              const id = Math.max(...DADOS.grupos.map(g => g.id)) + 1;
              DADOS.grupos.push({ id, nome:p.nome, prefixo:p.prefixo, ativo:true, cor:null, chave:null,
                reservado:!!p.reservado, ordem:p.ordem || 0, pai_id:null, quadro:true, responsaveis:[], descricao:null });
              return { data: { status:'ok', id, renomeados:0 }, error:null };
            }
            const g = DADOS.grupos.find(x => x.id === p.id);
            if (g) Object.assign(g, { nome:p.nome, prefixo:p.prefixo, reservado:!!p.reservado, ordem:p.ordem,
                                      ...(p.ativo != null ? { ativo:p.ativo } : {}) });
            return { data: { status:'ok', id:p.id, renomeados:2 }, error:null };
          }
          if (nome === 'grupo_estrutura_salvar'){
            const p = args?.p || {};
            (window.__estruturas ||= []).push(p);
            const g = DADOS.grupos.find(x => x.id === p.id);
            if (!g) return { data:{ status:'nao_encontrado' }, error:null };
            /* o mesmo teste de ciclo do banco: o pai não pode estar abaixo */
            const abaixo = new Set([g.id]);
            for (let novo = true; novo; ){ novo = false;
              DADOS.grupos.forEach(x => { if (abaixo.has(x.pai_id) && !abaixo.has(x.id)){ abaixo.add(x.id); novo = true; } }); }
            if ('pai_id' in p && p.pai_id != null && abaixo.has(p.pai_id)) return { data:{ status:'ciclo' }, error:null };
            ['pai_id','quadro','descricao','responsaveis'].forEach(k => { if (k in p) g[k] = p[k]; });
            return { data:{ status:'ok', id:g.id }, error:null };
          }
          if (nome === 'grupo_membros_salvar'){
            const p = args?.p || {};
            (window.__membrosSalvos ||= []).push(p);
            const g = DADOS.grupos.find(x => x.id === p.grupo_id);
            let adicionados = 0, removidos = 0;
            (p.adicionar || []).forEach(r => { const m = DADOS.membros.find(x => x.registro === r);
              if (m && !(m.grupos || []).includes(g.nome)){ m.grupos = [...(m.grupos || []), g.nome]; adicionados++; } });
            (p.remover || []).forEach(r => { const m = DADOS.membros.find(x => x.registro === r);
              if (m && (m.grupos || []).includes(g.nome)){ m.grupos = m.grupos.filter(n => n !== g.nome); removidos++; } });
            return { data:{ status:'ok', adicionados, removidos }, error:null };
          }
          if (nome === 'grupo_acesso_salvar'){
            window.__acessoSalvo = args?.p;
            return { data: { status:'ok', nivel:args?.p?.nivel }, error:null };
          }
          if (nome === 'grupo_fundir'){
            window.__fundido = args?.p;
            return { data: { status:'ok', atividades:3, pessoas:2, nome:'Sinais' }, error:null };
          }
          if (nome === 'atividade_origem_detalhe'){
            if (args?.p_codigo !== 'DEP-1') return { data: null, error: null };
            return { data: {
              tipo:'solicitacao', id:'s1', protocolo:'SOL26-0001',
              titulo:'Acesso ao LABBIO', especie:'acesso', status:'aberta',
              dados:{ item:'LABBIO — porta principal', item_id:'i1',
                      justificativa:'Montagem da bancada <b>nova</b>',
                      tempo_necessario:'Até dezembro' },
              resposta:null, respondido_por:null, respondido_em:null,
              criado_em:'2026-09-20T09:00:00Z', registro:17, membro:'Carla Mendonça',
              acessos:[{ item_id:'i2', ativo:true }]
            }, error: null };
          }
          if (nome === 'pessoal_solicitacao_decidir'){
            window.__decisao = args?.p;
            return { data: { status:'ok', decisao:args?.p?.decisao,
                             concedidos:(args?.p?.conceder||[]).length, codigo:'DEP-1' }, error:null };
          }
          if (nome === 'notificacao_preferencia_salvar'){
            window.__preferencia = args?.p;
            return { data: { status:'ok', email_modo:args?.p?.email_modo }, error:null };
          }
          if (nome === 'agenda_itens' || nome === 'agenda_manter_series') return { data: [], error: null };
          if (nome === 'portal_agenda_ocupacao') return { data: [], error: null };
          return { data: { status:'ok', codigo:'ORT-9', id:'novo' }, error: null };
        },
        functions: {
          invoke: async () => {
            const f = window.__teste || {};
            /* as formas de erro que o supabase-js v2 devolve de verdade:
               FunctionsFetchError não tem context; FunctionsHttpError tem
               context, que é a Response — é dali que sai o motivo real */
            if (f.fn === 'semResposta')
              return { data:null, error:{ message:'Failed to send a request to the Edge Function' } };
            if (f.fn === 'naoPublicada')
              return { data:null, error:{ message:'Edge Function returned a non-2xx status code',
                context: new Response('{"error":"not found"}', { status:404 }) } };
            if (f.fn === 'semSessao')
              return { data:null, error:{ message:'Edge Function returned a non-2xx status code',
                context: new Response('{"msg":"Invalid JWT"}', { status:401 }) } };
            if (f.fn === 'estourou')
              return { data:null, error:{ message:'Edge Function returned a non-2xx status code',
                context: new Response('{"status":"erro","detalhe":"connection refused"}', { status:500 }) } };
            if (f.fn === 'semSmtp')  return { data:{ status:'smtp_nao_configurado' }, error:null };
            if (f.fn === 'semLote')  return { data:{ status:'erro_no_lote' }, error:null };
            if (f.fn === 'zero')     return { data:{ status:'ok', pessoas:0, enviadas:0, falhas:0 }, error:null };
            return { data:{ status:'ok', pessoas:1, enviadas:1, falhas:0 }, error:null };
          }
        },
        auth: {
          getSession: async () => ({ data:{ session:{ user:{ id:'u1' } } } }),
          getUser:    async () => ({ data:{ user:{ id:'u1' } } }),
          onAuthStateChange(){ return { data:{ subscription:{ unsubscribe(){} } } }; },
          signInWithPassword: async () => ({ error:null }),
          signOut: async () => ({}),
          signUp: async () => ({ data:{}, error:null }),
          resetPasswordForEmail: async () => ({ error:null }),
          updateUser: async () => ({ error:null })
        }
      };
    }
  };
})();
