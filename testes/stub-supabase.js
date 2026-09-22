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
        status:'Ativo', grupos:['Sinais'], gestor_registro:4, email_nro:'bruno@neurodynamics.dev' },
      { registro:17, nome:'Carla Mendonça', cargo:'Desenvolvedora', departamento:'Engenharia',
        status:'Em pausa / avaliação', grupos:['Firmware'], gestor_registro:4 },
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
    grupos: [
      { id:1, nome:'Órtese', prefixo:'ORT', ativo:true, cor:null, chave:null, reservado:false },
      { id:2, nome:'Sinais', prefixo:'SIN', ativo:true, cor:null, chave:null, reservado:false },
      { id:3, nome:'Depto de Pessoal', prefixo:'DEP', ativo:true, cor:null,
        chave:'pessoal', reservado:true },
      { id:4, nome:'Gerência', prefixo:'GER', ativo:true, cor:null, chave:null, reservado:true }
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
    portal_avisos: [], portal_documentos: [], portal_solicitacoes: [],
    portal_ouvidoria: [], portal_agendas: []
  };

  function builder(tabela){
    let linhas = (DADOS[tabela] || []).map(r => ({ ...r }));
    const filtros = [];
    const b = {
      select(){ return b; },
      eq(c, v){ filtros.push(r => r[c] === v); return b; },
      neq(c, v){ filtros.push(r => r[c] !== v); return b; },
      in(c, vs){ filtros.push(r => vs.includes(r[c])); return b; },
      gte(){ return b; }, lte(){ return b; },
      order(){ return b; }, limit(){ return b; },
      insert(){ return b; }, update(){ return b; },
      upsert(){ return b; }, delete(){ return b; },
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
          if (nome === 'atividade_comentar'){
            if (window.__comentarFalha === 'sem_registro')
              return { data: { status:'sem_registro' }, error: null };
            if (window.__comentarFalha === 'lanca') throw new Error('rede caiu');
            window.__comentario = args?.p;
            return { data: { status:'ok', id:'c9' }, error: null };
          }
          if (nome === 'grupo_salvar'){
            window.__grupoSalvo = args?.p;
            return { data: { status:'ok', id:args?.p?.id || 9, renomeados:2 }, error:null };
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
