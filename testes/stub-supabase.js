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
    portal_ouvidoria: [], portal_agendas: [],

    /* v20: projetos e controle de arquivos. O NEBULA é a equipe do grupo
       NRO_PROJECT_NEBULA (Bruno, supervisor). O rol tem o que a tela
       precisa mostrar: templates (PUB-002, PUB-003, PRO-001, PRO-003),
       um procedimento com a Rev. C pendente e um checklist filho dele,
       um registro que usa uma revisão antiga do template, e um PN do
       projeto ainda em rascunho. */
    projetos: [
      { id:'pj1', codigo:'NEBULA', nome:'Nebula', descricao:'Órtese para membro superior, com estimulação elétrica.',
        grupo_id:8, supervisor:11, logo_semente:'nebula', status:'ativo', criado_em:'2026-08-01T12:00:00Z' }
    ],
    doc_emissores: [
      { prefixo:'PUB', nome:'Geral', grupo_id:null, ordem:0 },
      { prefixo:'PES', nome:'Departamento de Pessoal', grupo_id:3, ordem:1 },
      { prefixo:'PRO', nome:'Departamento de Pesquisa e Desenvolvimento', grupo_id:null, ordem:2 }
    ],
    doc_series: [
      { id:'s-pub2', prefixo:'PUB', sn:2, titulo:'TEMPLATE DE DOCUMENTOS E REGISTROS', tipo:'documento', subtipo:'template', classe:'publico', multiplo:false, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pub3', prefixo:'PUB', sn:3, titulo:'ATA DE REUNIÃO', tipo:'registro', subtipo:'ata', classe:'publico', multiplo:true, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pes4', prefixo:'PES', sn:4, titulo:'MANUAL DO MEMBRO', tipo:'documento', subtipo:'manual', classe:'publico', multiplo:false, grupo_revisor:null, grupos_leitura:[],
        descricao:'Na NRO-PUB-001 estava como INEXISTENTE: previsto, ainda sem arquivo.' },
      { id:'s-pes5', prefixo:'PES', sn:5, titulo:'QUADRO DE PESSOAL', tipo:'documento', subtipo:'planilha', classe:'confidencial', multiplo:false, grupo_revisor:6, grupos_leitura:[3] },
      { id:'s-pes7', prefixo:'PES', sn:7, titulo:'PROCEDIMENTO DE DESLIGAMENTO', tipo:'documento', subtipo:'procedimento', classe:'publico', multiplo:false, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pes14', prefixo:'PES', sn:14, titulo:'CHECKLIST DE OFFBOARDING', tipo:'documento', subtipo:'checklist', classe:'publico', multiplo:false, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pro1', prefixo:'PRO', sn:1, titulo:'TERMO DE ABERTURA DE PROJETO', tipo:'documento', subtipo:'relatorio', classe:'controlado', multiplo:true, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pro3', prefixo:'PRO', sn:3, titulo:'RELATÓRIO DE EXECUÇÃO DE TESTES', tipo:'registro', subtipo:'relatorio', classe:'controlado', multiplo:true, grupo_revisor:null, grupos_leitura:[] },
      { id:'s-pro4', prefixo:'PRO', sn:4, titulo:'(USRS) USER AND SYSTEM REQUIREMENTS SPECIFICATION', tipo:'documento', subtipo:'planilha', classe:'controlado', multiplo:true, grupo_revisor:null, grupos_leitura:[] }
    ],
    doc_rol: [
      { id:'a-pub2', codigo:'NRO-PUB-002', pn:null, serie_id:'s-pub2', prefixo:'PUB', sn:2, titulo:'TEMPLATE DE DOCUMENTOS E REGISTROS', serie_titulo:'TEMPLATE DE DOCUMENTOS E REGISTROS', complemento:null,
        tipo:'documento', subtipo:'template', classe:'publico', multiplo:false, natureza:'template', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:null, template_codigo:null, template_rev:null, template_rev_atual:null, projeto_id:null, projeto_codigo:null, projeto_nome:null,
        autor:null, autor_nome:'MMARCONDES', criado_em:'2026-04-07T00:00:00Z', alterado_em:'2026-04-07T00:00:00Z', alterado_nome:'MMARCONDES',
        grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pub3', codigo:'NRO-PUB-003', pn:null, serie_id:'s-pub3', prefixo:'PUB', sn:3, titulo:'ATA DE REUNIÃO', serie_titulo:'ATA DE REUNIÃO', complemento:null,
        tipo:'registro', subtipo:'ata', classe:'publico', multiplo:true, natureza:'template', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:'a-pub2', template_codigo:'NRO-PUB-002', template_rev:'A', template_rev_atual:'A', projeto_id:null,
        autor:null, autor_nome:'MMARCONDES', criado_em:'2026-04-13T00:00:00Z', alterado_em:'2026-04-13T00:00:00Z', alterado_nome:'MMARCONDES',
        grupo_revisor:null, grupos_leitura:[], n_pns:1 },
      { id:'a-pub3-1', codigo:'NRO-PUB-003-1', pn:1, serie_id:'s-pub3', prefixo:'PUB', sn:3, titulo:'ATA DE REUNIÃO — reunião geral de setembro', serie_titulo:'ATA DE REUNIÃO', complemento:'reunião geral de setembro',
        tipo:'registro', subtipo:'ata', classe:'publico', multiplo:true, natureza:'registro', status:'ativo', rev_vigente:null, rev_pendente:null,
        template_id:'a-pub3', template_codigo:'NRO-PUB-003', template_rev:'A', template_rev_atual:'A', projeto_id:null,
        autor:17, autor_nome:'Carla Mendonça', criado_em:'2026-09-08T12:00:00Z', alterado_em:'2026-09-09T12:00:00Z', alterado_nome:'Ana Figueiredo',
        grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pes4', codigo:'NRO-PES-004', pn:null, serie_id:'s-pes4', prefixo:'PES', sn:4, titulo:'MANUAL DO MEMBRO', serie_titulo:'MANUAL DO MEMBRO', complemento:null,
        tipo:'documento', subtipo:'manual', classe:'publico', multiplo:false, natureza:'documento', status:'rascunho', rev_vigente:null, rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:null, autor_nome:null, criado_em:'2026-03-01T00:00:00Z',
        alterado_em:'2026-03-01T00:00:00Z', alterado_nome:'NRO-PUB-001', grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pes5', codigo:'NRO-PES-005', pn:null, serie_id:'s-pes5', prefixo:'PES', sn:5, titulo:'QUADRO DE PESSOAL', serie_titulo:'QUADRO DE PESSOAL', complemento:null,
        tipo:'documento', subtipo:'planilha', classe:'confidencial', multiplo:false, natureza:'documento', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:null, autor_nome:'MMARCONDES', criado_em:'2026-03-07T00:00:00Z',
        alterado_em:'2026-03-28T00:00:00Z', alterado_nome:'ANA ALICE GOMES', grupo_revisor:6, grupos_leitura:[3], n_pns:0 },
      { id:'a-pes7', codigo:'NRO-PES-007', pn:null, serie_id:'s-pes7', prefixo:'PES', sn:7, titulo:'PROCEDIMENTO DE DESLIGAMENTO', serie_titulo:'PROCEDIMENTO DE DESLIGAMENTO', complemento:null,
        tipo:'documento', subtipo:'procedimento', classe:'publico', multiplo:false, natureza:'documento', status:'ativo', rev_vigente:'B', rev_pendente:'C',
        template_id:'a-pub2', template_codigo:'NRO-PUB-002', template_rev:'A', template_rev_atual:'A', projeto_id:null,
        autor:4, autor_nome:'Ana Figueiredo', criado_em:'2026-03-08T00:00:00Z', alterado_em:'2026-09-20T10:00:00Z', alterado_nome:'Bruno Tavares',
        grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pes14', codigo:'NRO-PES-014', pn:null, serie_id:'s-pes14', prefixo:'PES', sn:14, titulo:'CHECKLIST DE OFFBOARDING', serie_titulo:'CHECKLIST DE OFFBOARDING', complemento:null,
        tipo:'documento', subtipo:'checklist', classe:'publico', multiplo:false, natureza:'documento', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:4, autor_nome:'Ana Figueiredo', criado_em:'2026-04-06T00:00:00Z',
        alterado_em:'2026-04-06T00:00:00Z', alterado_nome:'Ana Figueiredo', grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pro1', codigo:'NRO-PRO-001', pn:null, serie_id:'s-pro1', prefixo:'PRO', sn:1, titulo:'TERMO DE ABERTURA DE PROJETO', serie_titulo:'TERMO DE ABERTURA DE PROJETO', complemento:null,
        tipo:'documento', subtipo:'relatorio', classe:'controlado', multiplo:true, natureza:'template', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:null, autor_nome:'MMARCONDES', criado_em:'2026-04-01T00:00:00Z',
        alterado_em:'2026-04-01T00:00:00Z', alterado_nome:'MMARCONDES', grupo_revisor:null, grupos_leitura:[], n_pns:1 },
      { id:'a-pro1-1', codigo:'NRO-PRO-001-1', pn:1, serie_id:'s-pro1', prefixo:'PRO', sn:1, titulo:'TERMO DE ABERTURA DE PROJETO', serie_titulo:'TERMO DE ABERTURA DE PROJETO', complemento:null,
        tipo:'documento', subtipo:'relatorio', classe:'controlado', multiplo:true, natureza:'documento', status:'rascunho', rev_vigente:null, rev_pendente:null,
        template_id:'a-pro1', template_codigo:'NRO-PRO-001', template_rev:'A', template_rev_atual:'A', projeto_id:'pj1', projeto_codigo:'NEBULA', projeto_nome:'Nebula',
        autor:11, autor_nome:'Bruno Tavares', criado_em:'2026-09-02T12:00:00Z', alterado_em:'2026-09-02T12:00:00Z', alterado_nome:'Bruno Tavares',
        grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pro3', codigo:'NRO-PRO-003', pn:null, serie_id:'s-pro3', prefixo:'PRO', sn:3, titulo:'RELATÓRIO DE EXECUÇÃO DE TESTES', serie_titulo:'RELATÓRIO DE EXECUÇÃO DE TESTES', complemento:null,
        tipo:'registro', subtipo:'relatorio', classe:'controlado', multiplo:true, natureza:'template', status:'ativo', rev_vigente:'B', rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:null, autor_nome:'MMARCONDES', criado_em:'2026-04-13T00:00:00Z',
        alterado_em:'2026-09-01T00:00:00Z', alterado_nome:'Ana Figueiredo', grupo_revisor:null, grupos_leitura:[], n_pns:1 },
      { id:'a-pro3-1', codigo:'NRO-PRO-003-1', pn:1, serie_id:'s-pro3', prefixo:'PRO', sn:3, titulo:'RELATÓRIO DE EXECUÇÃO DE TESTES — bancada 2', serie_titulo:'RELATÓRIO DE EXECUÇÃO DE TESTES', complemento:'bancada 2',
        tipo:'registro', subtipo:'relatorio', classe:'controlado', multiplo:true, natureza:'registro', status:'ativo', rev_vigente:null, rev_pendente:null,
        template_id:'a-pro3', template_codigo:'NRO-PRO-003', template_rev:'A', template_rev_atual:'B', projeto_id:'pj1', projeto_codigo:'NEBULA', projeto_nome:'Nebula',
        autor:11, autor_nome:'Bruno Tavares', criado_em:'2026-08-20T12:00:00Z', alterado_em:'2026-08-22T12:00:00Z', alterado_nome:'Ana Figueiredo',
        grupo_revisor:null, grupos_leitura:[], n_pns:0 },
      { id:'a-pro4', codigo:'NRO-PRO-004', pn:null, serie_id:'s-pro4', prefixo:'PRO', sn:4, titulo:'(USRS) USER AND SYSTEM REQUIREMENTS SPECIFICATION', serie_titulo:'(USRS) USER AND SYSTEM REQUIREMENTS SPECIFICATION', complemento:null,
        tipo:'documento', subtipo:'planilha', classe:'controlado', multiplo:true, natureza:'template', status:'ativo', rev_vigente:'A', rev_pendente:null,
        template_id:null, template_rev:null, projeto_id:null, autor:null, autor_nome:'MMARCONDES', criado_em:'2026-06-04T00:00:00Z',
        alterado_em:'2026-06-04T00:00:00Z', alterado_nome:'MMARCONDES', grupo_revisor:null, grupos_leitura:[], n_pns:0 }
    ],
    doc_padrao_projeto: [
      { serie_id:'s-pro1', ordem:1, quantidade:'um' },
      { serie_id:'s-pro4', ordem:2, quantidade:'um' },
      { serie_id:'s-pro3', ordem:3, quantidade:'varios' }
    ],
    doc_revisoes: [
      { id:'r-pub2-a', arquivo_id:'a-pub2', rev:'A', estado:'aprovada', caminho:null, enviado_nome:'MMARCONDES', enviado_em:'2026-04-07T00:00:00Z',
        revisor_nome:null, revisado_em:'2026-04-07T00:00:00Z', mudancas:'Versão inicial, registrada na NRO-PUB-001.', relacionados:[], importada:true },
      { id:'r-pub3-a', arquivo_id:'a-pub3', rev:'A', estado:'aprovada', caminho:'a-pub3/u1/ata.docx', nome_original:'ata.docx', enviado_nome:'MMARCONDES',
        enviado_em:'2026-04-13T00:00:00Z', revisor_nome:'Ana Figueiredo', revisado_em:'2026-04-14T00:00:00Z', relacionados:[], importada:false },
      { id:'r-pub31', arquivo_id:'a-pub3-1', rev:null, estado:'aprovada', caminho:'a-pub3-1/u2/ata-setembro.pdf', nome_original:'ata-setembro.pdf',
        enviado_por:17, enviado_nome:'Carla Mendonça', enviado_em:'2026-09-08T13:00:00Z', revisor_nome:'Ana Figueiredo', revisado_em:'2026-09-09T12:00:00Z',
        template_rev:'A', relacionados:[] },
      { id:'r-pes7-a', arquivo_id:'a-pes7', rev:'A', estado:'substituida', caminho:'a-pes7/u3/desligamento.docx', nome_original:'desligamento.docx',
        enviado_por:4, enviado_nome:'Ana Figueiredo', enviado_em:'2026-03-08T00:00:00Z', revisor_nome:'ANA ALICE GOMES', revisado_em:'2026-03-28T00:00:00Z',
        mudancas:'Versão inicial.', relacionados:[], template_rev:'A' },
      { id:'r-pes7-b', arquivo_id:'a-pes7', rev:'B', estado:'aprovada', caminho:'a-pes7/u4/desligamento-b.docx', nome_original:'desligamento-b.docx',
        enviado_por:4, enviado_nome:'Ana Figueiredo', enviado_em:'2026-06-10T00:00:00Z', revisor_nome:'Carla Mendonça', revisado_em:'2026-06-12T00:00:00Z',
        mudancas:'Inclui a devolução de crachá.', relacionados:[{ arquivo_id:'a-pes14', codigo:'NRO-PES-014', decisao:'revisado' }], template_rev:'A' },
      { id:'r-pes7-c', arquivo_id:'a-pes7', rev:'C', estado:'pendente', caminho:'a-pes7/u5/desligamento-c.docx', nome_original:'desligamento-c.docx',
        enviado_por:11, enviado_nome:'Bruno Tavares', enviado_em:'2026-09-20T10:00:00Z', mudancas:'Prazos da etapa 3 em dias úteis.',
        relacionados:[{ arquivo_id:'a-pes14', codigo:'NRO-PES-014', decisao:'sem_mudanca' }], template_rev:'A' },
      { id:'r-pes14-a', arquivo_id:'a-pes14', rev:'A', estado:'aprovada', caminho:'a-pes14/u6/checklist.xlsx', nome_original:'checklist.xlsx',
        enviado_por:4, enviado_nome:'Ana Figueiredo', enviado_em:'2026-04-06T00:00:00Z', revisor_nome:'Carla Mendonça', revisado_em:'2026-04-06T00:00:00Z', relacionados:[] },
      { id:'r-pro1-a', arquivo_id:'a-pro1', rev:'A', estado:'aprovada', caminho:'a-pro1/u7/tap.docx', nome_original:'tap.docx', enviado_nome:'MMARCONDES',
        enviado_em:'2026-04-01T00:00:00Z', revisor_nome:'Ana Figueiredo', revisado_em:'2026-04-02T00:00:00Z', relacionados:[] },
      { id:'r-pro3-a', arquivo_id:'a-pro3', rev:'A', estado:'substituida', caminho:'a-pro3/u8/rel.docx', nome_original:'rel.docx', enviado_nome:'MMARCONDES',
        enviado_em:'2026-04-13T00:00:00Z', revisor_nome:'Ana Figueiredo', revisado_em:'2026-04-14T00:00:00Z', relacionados:[] },
      { id:'r-pro3-b', arquivo_id:'a-pro3', rev:'B', estado:'aprovada', caminho:'a-pro3/u9/rel-b.docx', nome_original:'rel-b.docx', enviado_nome:'Ana Figueiredo',
        enviado_em:'2026-08-30T00:00:00Z', revisor_nome:'Carla Mendonça', revisado_em:'2026-09-01T00:00:00Z', mudancas:'Campo de umidade da sala.', relacionados:[] },
      { id:'r-pro31', arquivo_id:'a-pro3-1', rev:null, estado:'aprovada', caminho:'a-pro3-1/u10/bancada2.pdf', nome_original:'bancada2.pdf',
        enviado_por:11, enviado_nome:'Bruno Tavares', enviado_em:'2026-08-20T13:00:00Z', revisor_nome:'Ana Figueiredo', revisado_em:'2026-08-22T12:00:00Z',
        template_rev:'A', relacionados:[] }
    ],
    doc_eventos: [
      { id:1, arquivo_id:'a-pub2', tipo:'importou', detalhe:'NRO-PUB-001', nome:'NRO-PUB-001', criado_em:'2026-04-07T00:00:00Z' },
      { id:2, arquivo_id:'a-pes7', tipo:'relacionou', detalhe:'filho NRO-PES-014', nome:'Ana Figueiredo', criado_em:'2026-06-09T00:00:00Z' }
    ],
    doc_relacoes: [{ pai_id:'a-pes7', filho_id:'a-pes14' }]
  };
  /* ---- v23: o Studio ----
     As datas andam com o relógio do teste: amanhã, daqui a 3 dias, ontem.
     A Ana (admin) aprova; o grupo de acesso é Sinais (id 2), onde está o
     Bruno; o aprovador é NRO_MANAGERS (id 6), da Carla. */
  const stDia = (d, h) => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(h || 18, 0, 0, 0); return x.toISOString(); };
  DADOS.studio_config = [{ id:true, grupos_acesso:[2], grupos_aprovadores:[6], aprovacoes_minimas:1, lembrete_email:true,
    contas:{ instagram:'@neurodynamics.dev', linkedin:'NeuroDynamics' }, unsplash_chave:null }];
  DADOS.studio_publicacoes = [
    { id:'p1', numero:1, codigo:'POST-1', titulo:'Mostrar a bancada de testes da órtese num reels', status:'ideia', categoria:'bastidores', modelo:'bastidores',
      pilar:'conectar', redes:['instagram'], formato:'reels', data_publicacao:null, responsavel:11, criado_por:11, imagens:[], versao:1,
      criado_em:stDia(-6), atualizado_em:stDia(-6) },
    { id:'p2', numero:2, codigo:'POST-2', titulo:'Aniversário da Carla', status:'producao', categoria:'aniversario', modelo:'aniversario',
      pilar:'conectar', redes:['instagram'], formato:'imagem', data_publicacao:stDia(1, 10), responsavel:4, criado_por:4, versao:2,
      imagens:[{ caminho:'p2/arte-a-01.jpg', largura:1440, altura:1800, tipo:'image/jpeg' }],
      legenda:'Hoje é dia de celebrar a Carla! 🎉', colaboradores:'@labbio.ufmg', notas:'Marcar a Carla na foto.',
      peca:null, criado_em:stDia(-3), atualizado_em:stDia(-1) },
    { id:'p3', numero:3, codigo:'POST-3', titulo:'Na mídia: Jornal Nacional', status:'aprovacao', categoria:'na_midia', modelo:'na_midia',
      pilar:'institucional', redes:['instagram','linkedin'], formato:'carrossel', data_publicacao:stDia(3, 12), responsavel:11, criado_por:11,
      enviado_por:11, enviado_em:stDia(-1), versao:1, imagens:[{ caminho:'p3/arte-b-01.jpg', largura:1440, altura:1800, tipo:'image/jpeg' },
      { caminho:'p3/arte-b-02.png', largura:1440, altura:1800, tipo:'image/png' }], legenda:'Saímos no Jornal Nacional!', criado_em:stDia(-2), atualizado_em:stDia(-1) },
    { id:'p4', numero:4, codigo:'POST-4', titulo:'Demo Day NeuroDynamics', status:'pronta', categoria:'evento', modelo:'evento',
      pilar:'convidar', redes:['instagram'], formato:'stories', data_publicacao:stDia(5, 9), responsavel:4, criado_por:17, versao:1,
      imagens:[{ caminho:'p4/arte-c-01.png', largura:1440, altura:2560, tipo:'image/png' }], aprovado_em:stDia(-1), criado_em:stDia(-8), atualizado_em:stDia(-1) },
    { id:'p5', numero:5, codigo:'POST-5', titulo:'Artigo publicado na JNER', status:'publicada', categoria:'artigo', modelo:'artigo',
      pilar:'institucional', redes:['linkedin'], formato:'imagem', data_publicacao:stDia(-2, 11), responsavel:17, criado_por:17, versao:1,
      imagens:[], link:'https://www.linkedin.com/posts/x', publicado_em:stDia(-2, 11), criado_em:stDia(-10), atualizado_em:stDia(-2) },
    { id:'p6', numero:6, codigo:'POST-6', titulo:'Parabéns à equipe Bem-te-vi', status:'producao', categoria:'parabens', modelo:'parabens',
      pilar:'conectar', redes:['instagram'], formato:'imagem', data_publicacao:stDia(-1, 17), responsavel:4, criado_por:4, versao:1,
      imagens:[], criado_em:stDia(-4), atualizado_em:stDia(-4) }
  ];
  DADOS.studio_aprovacoes = [{ publicacao_id:'p4', versao:1, registro:6, nome:'Ana Figueiredo', decisao:'aprovada', parecer:'Pode sair.', criado_em:stDia(-1) }];
  DADOS.studio_historico = [
    { id:1, publicacao_id:'p3', registro:11, nome:'Bruno Tavares', acao:'criou', detalhe:'Em produção', criado_em:stDia(-2) },
    { id:2, publicacao_id:'p3', registro:11, nome:'Bruno Tavares', acao:'moveu', detalhe:'Em produção → Em aprovação', criado_em:stDia(-1) }];
  DADOS.site_imprensa = [
    { id:'i1', tipo:'video', titulo:null, veiculo:'Jornal Nacional', ano:'2026', youtube:'AdOeBTOeMu0', url:null, ordem:10, publicado:true, criado_em:stDia(-30) },
    { id:'i2', tipo:'video', titulo:'Cybathlon highlights', veiculo:'Cybathlon', ano:'2024', youtube:'WbhvEbVW1-I', url:null, ordem:20, publicado:true, criado_em:stDia(-30) },
    { id:'i3', tipo:'materia', titulo:'Triciclo feito por alunos da UFMG faz jovem tetraplégico pedalar', veiculo:'Record', ano:'2024',
      youtube:null, url:'https://noticias.r7.com/x', ordem:10, publicado:true, criado_em:stDia(-30) }];
  DADOS.studio_recursos = [
    { id:'r1', titulo:'Fotos do Cybathlon 2024', tipo:'album', url:'https://photos.app.goo.gl/abc', descricao:'Zurique, a equipe e a bicicleta.', ordem:100, criado_por:4 },
    { id:'r2', titulo:'Drive · Fotos dos projetos', tipo:'pasta', url:'https://drive.google.com/drive/folders/xyz', descricao:null, ordem:100, criado_por:11 }];

  /* ---- v24: os treinamentos ----
     Três: NRO-TRE-001 (Rev. B publicada, obrigatório para Órtese — o
     grupo da Ana —, com vídeo, links e uma verificação de cada tipo),
     NRO-TRE-002 (opcional para a equipe inteira, que a Ana já concluiu)
     e NRO-TRE-003 (rascunho, com problemas). Quem gere, além de admin e
     pessoal, é NRO_MANAGERS (id 6). */
  const trDia = d => { const x = new Date(); x.setDate(x.getDate() + d); return x.toISOString(); };
  const TR_C1 = { modulos:[
    { id:'m-agenda', titulo:'O que é a agenda', corpo:
      'Ao fim deste módulo, você sabe onde mora a agenda da equipe.\n\n## Uma agenda só\n\nA agenda junta **compromissos**, marcos e ausências.\n\n'
      + '1. Abra a [Agenda](#/agenda).\n2. Escolha **Novo compromisso**.\n   - o tipo sugere a visibilidade\n\n> **Dica:** a busca abre com a tecla `/`.\n\n'
      + '```video\nhttps://youtu.be/AdOeBTOeMu0\nComo marcar um compromisso\n```\n\n'
      + 'Quem vai ao laboratório segue a [política de acesso ao LABBIO](arquivo:NRO-PES-015).\n\n| Aba | Para quê |\n|---|---|\n| Mês | a grade |\n| Agendar | o livre e o ocupado |',
      links:[{ titulo:'Política de acesso ao LABBIO', url:'arquivo:NRO-PES-015', descricao:'as regras completas' },
             { titulo:'Agenda do mês', url:'#/agenda/mes', descricao:'' }] },
    { id:'m-abas', titulo:'As cinco abas', corpo:'Próximos, Mês, Agendar, Presença e Minha agenda.', verificacao:{ questoes:[
      { id:'q1', tipo:'unica', enunciado:'Qual aba mostra a grade do mês?', explicacao:'É a aba Mês.',
        opcoes:[{ id:'a', texto:'Próximos', correta:false }, { id:'b', texto:'Mês', correta:true }, { id:'c', texto:'Agendar', correta:false }] },
      { id:'q2', tipo:'multipla', enunciado:'O que aparece na agenda?', explicacao:'Compromissos e marcos; e-mail não entra.',
        opcoes:[{ id:'a', texto:'Compromissos', correta:true }, { id:'b', texto:'Marcos do semestre', correta:true }, { id:'c', texto:'E-mails', correta:false }] },
      { id:'q3', tipo:'vf', enunciado:'Verdadeiro ou falso:', explicacao:'O padrão é não repetir.',
        opcoes:[{ id:'a', texto:'O portal lê o seu Google Agenda.', correta:true }, { id:'b', texto:'Todo compromisso se repete.', correta:false }] }] } },
    { id:'m-presenca', titulo:'Presença', corpo:'O check-in é pelo QR da entrada do LABBIO.' }] };
  const TR_C2 = { modulos:[{ id:'m-lab', titulo:'O LABBIO', corpo:'O Laboratório de Bioengenharia da Escola de Engenharia.' }] };
  const TR_C3 = { modulos:[{ id:'m-x', titulo:'', corpo:'Óculos, sempre.', verificacao:{ questoes:[
    { id:'q1', tipo:'unica', enunciado:'O que se usa?', opcoes:[{ id:'a', texto:'Óculos', correta:true }, { id:'b', texto:'Luvas', correta:true }] }] } }] };
  DADOS.treinamento_config = [{ id:true, grupos_gestores:[6], nota_minima:70, readme:null, readme_atualizado_em:null, readme_atualizado_por:null,
    assinatura_nome:'Elis Ramalho', assinatura_cargo:'Depto. de Pessoal' }];
  DADOS.treinamentos = [
    { id:'tr1', numero:1, codigo:'NRO-TRE-001', titulo:'Agenda no SOMA', resumo:'Marcar, responder e acompanhar os compromissos da equipe.',
      categoria:'Sistemas', carga_horaria_min:30, nota_minima:null, validade_meses:null, status:'publicado', revisao_atual:'B', revisao_minima:'A',
      responsavel:4, criado_por:4, criado_em:trDia(-40), atualizado_em:trDia(-3) },
    { id:'tr2', numero:2, codigo:'NRO-TRE-002', titulo:'Apresentação do LABBIO', resumo:'Onde fica, quem é quem e como se chega.',
      categoria:'Integração', carga_horaria_min:15, nota_minima:null, validade_meses:null, status:'publicado', revisao_atual:'A', revisao_minima:'A',
      responsavel:4, criado_por:4, criado_em:trDia(-30), atualizado_em:trDia(-30) },
    { id:'tr3', numero:3, codigo:'NRO-TRE-003', titulo:'Segurança na bancada', resumo:null, categoria:'Segurança', carga_horaria_min:null,
      nota_minima:null, validade_meses:12, status:'rascunho', revisao_atual:null, revisao_minima:null, responsavel:4, criado_por:4, criado_em:trDia(-2), atualizado_em:trDia(-2) }];
  DADOS.treinamento_revisoes = [
    { id:'rv1a', treinamento_id:'tr1', revisao:'A', status:'substituida', conteudo:TR_C1, notas:'Versão inicial.', exige_refazer:true,
      publicado_nome:'Ana Figueiredo', publicado_em:trDia(-40), criado_em:trDia(-41), atualizado_em:trDia(-40) },
    { id:'rv1b', treinamento_id:'tr1', revisao:'B', status:'publicada', conteudo:TR_C1, notas:'O vídeo novo do módulo 1.', exige_refazer:false,
      publicado_nome:'Ana Figueiredo', publicado_em:trDia(-3), criado_em:trDia(-4), atualizado_em:trDia(-3) },
    { id:'rv2a', treinamento_id:'tr2', revisao:'A', status:'publicada', conteudo:TR_C2, notas:'Versão inicial.', exige_refazer:true,
      publicado_nome:'Ana Figueiredo', publicado_em:trDia(-30), criado_em:trDia(-30), atualizado_em:trDia(-30) },
    { id:'rv3', treinamento_id:'tr3', revisao:null, status:'rascunho', conteudo:TR_C3, notas:null, exige_refazer:false,
      criado_em:trDia(-2), atualizado_em:trDia(-2) }];
  DADOS.treinamento_atribuicoes = [{ id:1, treinamento_id:'tr1', grupo_id:1, obrigatorio:true }, { id:2, treinamento_id:'tr2', grupo_id:null, obrigatorio:false }];
  DADOS.treinamento_conclusoes = [{ id:'c2', certificado:'CERT-2A4B-9C1D', registro:4, treinamento_id:'tr2', nome:'Ana Figueiredo', codigo:'NRO-TRE-002',
    titulo:'Apresentação do LABBIO', revisao:'A', carga_horaria_min:15, nota:null, modulos:['O LABBIO'], concluido_em:trDia(-20) }];

  /* ---- v25: as declarações e os eventos ----
     A Ana tem a ficha completa (CPF, cargo, ingresso) e uma declaração
     de vínculo emitida, já conferida duas vezes. O EXT-1 está aprovado:
     foram a Ana e uma externa, e as duas declarações saíram (o e-mail
     da externa falhou). O EXT-2, do Bruno, tem uma das duas aprovações
     que precisa — da Carla, de NRO_MANAGERS (id 6), o grupo que
     aprova; a Ana, admin, aprova também. O EXT-3 é um rascunho da Ana;
     o EXT-4, um do Bruno, que só admin e o Depto. de Pessoal veem.
     Com window.__teste.dir (posto antes de a página carregar), o rol
     ganha a Diretoria e as duas séries cujo PN não mora nele. */
  const dvDia = d => { const x = new Date(); x.setDate(x.getDate() + d); x.setHours(12, 0, 0, 0); return x.toISOString(); };
  const dvData = d => { const x = new Date(); x.setDate(x.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const DV_TEXTO = 'A NeuroDynamics PD&I é uma Instituição de Ciência e Tecnologia, vinculada ao Laboratório de Engenharia '
    + 'Biomédica e ao Laboratório de Bioengenharia da Escola de Engenharia da Universidade Federal de Minas Gerais (UFMG).';
  DADOS.doc_emissao_config = [{ id:true, cidade:'Belo Horizonte', texto_instituicao:DV_TEXTO,
    url_validacao:'https://auth.neurodynamics.dev', serie_vinculo:'s-dir4', serie_participacao:'s-dir6' }];
  DADOS.eventos_ext_config = [{ id:true, grupos_aprovadores:[6], aprovacoes_minimas:2 }];
  DADOS.eventos_ext = [
    { id:'ev1', numero:1, codigo:'EXT-1', nome:'CBEB 2026 — Congresso Brasileiro de Engenharia Biomédica',
      descricao:'Apresentação do pôster do projeto Nebula.', modalidade:'presencial', local:'Centro de Convenções de Vitória (ES)',
      data_inicio:dvData(-20), data_fim:dvData(-18), hora_inicio:null, hora_fim:null, horas:24, status:'aprovado', versao:1,
      criado_por:4, criado_nome:'Ana Figueiredo', criado_em:dvDia(-17), enviado_por:4, enviado_em:dvDia(-17), aprovado_em:dvDia(-15), motivo:null },
    { id:'ev2', numero:2, codigo:'EXT-2', nome:'Semana da Engenharia UFMG', descricao:null, modalidade:'hibrido',
      local:'Escola de Engenharia da UFMG', data_inicio:dvData(-3), data_fim:null, hora_inicio:'14:00', hora_fim:'17:30', horas:3.5,
      status:'aprovacao', versao:1, criado_por:11, criado_nome:'Bruno Tavares', criado_em:dvDia(-2), enviado_por:11, enviado_em:dvDia(-2),
      aprovado_em:null, motivo:null },
    { id:'ev3', numero:3, codigo:'EXT-3', nome:'Feira de Tecnologia Assistiva', descricao:'Estande com a órtese.', modalidade:'presencial',
      local:'Expominas', data_inicio:dvData(-1), data_fim:null, hora_inicio:'09:00', hora_fim:'17:00', horas:8,
      status:'rascunho', versao:1, criado_por:4, criado_nome:'Ana Figueiredo', criado_em:dvDia(-1), enviado_por:null, enviado_em:null,
      aprovado_em:null, motivo:null },
    { id:'ev4', numero:4, codigo:'EXT-4', nome:'Webinar de sinais biomédicos', descricao:null, modalidade:'online', local:null,
      data_inicio:dvData(-5), data_fim:null, hora_inicio:'19:00', hora_fim:'20:30', horas:1.5,
      status:'rascunho', versao:1, criado_por:11, criado_nome:'Bruno Tavares', criado_em:dvDia(-4), enviado_por:null, enviado_em:null,
      aprovado_em:null, motivo:null }
  ];
  DADOS.eventos_ext_participantes = [
    { id:'pt1', evento_id:'ev1', registro:4, nome:'Ana Figueiredo', email:null, papel:'Apresentador(a) de trabalho', horas:null, ordem:1, declaracao:'K7QD-2M9X-P4TR' },
    { id:'pt2', evento_id:'ev1', registro:null, nome:'Helena Prado', email:'helena.prado@exemplo.org', papel:'Coautor(a)', horas:16, ordem:2, declaracao:'3HVN-8Z2C-QW6E' },
    { id:'pt3', evento_id:'ev2', registro:11, nome:'Bruno Tavares', email:null, papel:'Palestrante', horas:null, ordem:1, declaracao:null },
    { id:'pt4', evento_id:'ev2', registro:17, nome:'Carla Mendonça', email:null, papel:null, horas:2, ordem:2, declaracao:null },
    { id:'pt5', evento_id:'ev3', registro:4, nome:'Ana Figueiredo', email:null, papel:'Expositor(a)', horas:null, ordem:1, declaracao:null },
    { id:'pt6', evento_id:'ev4', registro:11, nome:'Bruno Tavares', email:null, papel:null, horas:null, ordem:1, declaracao:null }
  ];
  DADOS.eventos_ext_aprovacoes = [
    { evento_id:'ev1', versao:1, registro:17, nome:'Carla Mendonça', decisao:'aprovada', parecer:null, criado_em:dvDia(-16) },
    { evento_id:'ev1', versao:1, registro:11, nome:'Bruno Tavares', decisao:'aprovada', parecer:'Confere com a programação.', criado_em:dvDia(-15) },
    { evento_id:'ev2', versao:1, registro:17, nome:'Carla Mendonça', decisao:'aprovada', parecer:null, criado_em:dvDia(-1) }
  ];
  DADOS.eventos_ext_historico = [
    { evento_id:'ev1', nome:'Ana Figueiredo', acao:'criou', detalhe:null, criado_em:dvDia(-17) },
    { evento_id:'ev1', nome:'Ana Figueiredo', acao:'enviou', detalhe:'Versão 1', criado_em:dvDia(-17) },
    { evento_id:'ev1', nome:'Carla Mendonça', acao:'aprovou', detalhe:'Versão 1 · 1 de 2', criado_em:dvDia(-16) },
    { evento_id:'ev1', nome:'Bruno Tavares', acao:'aprovou', detalhe:'Versão 1 · 2 de 2 — Confere com a programação.', criado_em:dvDia(-15) },
    { evento_id:'ev1', nome:'Bruno Tavares', acao:'emitiu', detalhe:'2 declarações de participação', criado_em:dvDia(-15) },
    { evento_id:'ev2', nome:'Bruno Tavares', acao:'criou', detalhe:null, criado_em:dvDia(-2) },
    { evento_id:'ev2', nome:'Bruno Tavares', acao:'enviou', detalhe:'Versão 1', criado_em:dvDia(-2) },
    { evento_id:'ev2', nome:'Carla Mendonça', acao:'aprovou', detalhe:'Versão 1 · 1 de 2', criado_em:dvDia(-1) },
    { evento_id:'ev3', nome:'Ana Figueiredo', acao:'criou', detalhe:null, criado_em:dvDia(-1) },
    { evento_id:'ev4', nome:'Bruno Tavares', acao:'criou', detalhe:null, criado_em:dvDia(-4) }
  ];
  const DV_EV1 = { codigo:'EXT-1', nome:DADOS.eventos_ext[0].nome, descricao:DADOS.eventos_ext[0].descricao, modalidade:'presencial',
    local:DADOS.eventos_ext[0].local, data_inicio:dvData(-20), data_fim:dvData(-18), hora_inicio:null, hora_fim:null };
  DADOS.doc_emitidos = [
    { codigo:'Q8RT-5WZN-2KDH', tipo:'vinculo', documento:'NRO-DIR-004-4', revisao:'B', titulo:'Declaração de vínculo', emissor:'Diretoria',
      registro:4, titular:'Ana Figueiredo', evento_id:null, participante_id:null, controle:'4F1A9C2E', emitido_em:dvDia(-30),
      emitido_por:4, emitido_nome:'Ana Figueiredo', revogado_em:null, revogado_nome:null, revogado_motivo:null, consultas:2, consultado_em:dvDia(-28),
      dados:{ nome:'Ana Figueiredo', cpf:'000.000.000-00', cargo:'Gerente de projeto', departamento:'Engenharia', status:'Ativo', vigente:true,
        desde:'2024-03-01', ate:null, cidade:'Belo Horizonte', data:dvData(-30), texto_instituicao:DV_TEXTO, treinamentos:[], eventos:[] } },
    { codigo:'K7QD-2M9X-P4TR', tipo:'participacao', documento:'NRO-DIR-006-1', revisao:'A', titulo:'Declaração de participação', emissor:'Diretoria',
      registro:4, titular:'Ana Figueiredo', evento_id:'ev1', participante_id:'pt1', controle:'B03D77A1', emitido_em:dvDia(-15),
      emitido_por:11, emitido_nome:'Bruno Tavares', revogado_em:null, revogado_nome:null, revogado_motivo:null, consultas:0, consultado_em:null,
      dados:{ nome:'Ana Figueiredo', membro:true, papel:'Apresentador(a) de trabalho', horas:24, evento:DV_EV1, cidade:'Belo Horizonte',
        data:dvData(-15), texto_instituicao:DV_TEXTO } },
    { codigo:'3HVN-8Z2C-QW6E', tipo:'participacao', documento:'NRO-DIR-006-1', revisao:'A', titulo:'Declaração de participação', emissor:'Diretoria',
      registro:null, titular:'Helena Prado', evento_id:'ev1', participante_id:'pt2', controle:'77C0E5D9', emitido_em:dvDia(-15),
      emitido_por:11, emitido_nome:'Bruno Tavares', revogado_em:null, revogado_nome:null, revogado_motivo:null, consultas:1, consultado_em:dvDia(-10),
      dados:{ nome:'Helena Prado', membro:false, papel:'Coautor(a)', horas:16, evento:DV_EV1, cidade:'Belo Horizonte',
        data:dvData(-15), texto_instituicao:DV_TEXTO } }
  ];
  /* uma revogada, para a validação pública dizer isso */
  DADOS.doc_emitidos.push({ codigo:'M4TX-7RPD-9KCE', tipo:'vinculo', documento:'NRO-DIR-004-4', revisao:'B', titulo:'Declaração de vínculo',
    emissor:'Diretoria', registro:4, titular:'Ana Figueiredo', evento_id:null, participante_id:null, controle:'0B9E44D1', emitido_em:dvDia(-60),
    emitido_por:4, emitido_nome:'Ana Figueiredo', revogado_em:dvDia(-59), revogado_nome:'Ana Figueiredo',
    revogado_motivo:'Emitida antes de a ficha ser atualizada.', consultas:0, consultado_em:null,
    dados:{ ...DADOS.doc_emitidos[0].dados, data:dvData(-60), cargo:'Desenvolvedora' } });
  DADOS.doc_envios = [
    { id:1, codigo:'K7QD-2M9X-P4TR', enviado_em:dvDia(-15), tentativas:0, erro:null },
    { id:2, codigo:'3HVN-8Z2C-QW6E', enviado_em:null, tentativas:5, erro:'550 5.1.1 mailbox unavailable' }
  ];
  if ((window.__teste || {}).dir){
    DADOS.doc_emissores.push({ prefixo:'DIR', nome:'Diretoria', grupo_id:null, ordem:3 });
    DADOS.doc_series.push(
      { id:'s-dir4', prefixo:'DIR', sn:4, titulo:'DECLARAÇÃO DE VÍNCULO', tipo:'registro', subtipo:'declaracao', classe:'controlado', multiplo:true,
        grupo_revisor:null, grupos_leitura:[], pn_origem:'Os PNs desta série não são registrados no rol: cada declaração é gerada sob demanda em Serviços › Declaração de vínculo, e o PN é o número de registro do membro (a do registro 17 é NRO-DIR-004-17). O arquivo não fica guardado; cada emissão ganha um código verificador, conferido em auth.neurodynamics.dev.' },
      { id:'s-dir6', prefixo:'DIR', sn:6, titulo:'DECLARAÇÃO DE PARTICIPAÇÃO EM EVENTO', tipo:'registro', subtipo:'declaracao', classe:'controlado', multiplo:true,
        grupo_revisor:null, grupos_leitura:[], pn_origem:'Os PNs desta série não são registrados no rol: cada declaração é gerada quando um evento registrado em Serviços › Eventos é aprovado, e o PN é o número do evento (o EXT-14 dá a NRO-DIR-006-14). O arquivo não fica guardado; cada participante ganha um código verificador, conferido em auth.neurodynamics.dev.' });
    const cab = (id, serie, sn, titulo, rev) => ({ id, codigo:`NRO-DIR-00${sn}`, pn:null, serie_id:serie, prefixo:'DIR', sn, titulo, serie_titulo:titulo,
      complemento:null, tipo:'registro', subtipo:'declaracao', classe:'controlado', multiplo:true, natureza:'template', status:'ativo', rev_vigente:rev,
      rev_pendente:null, template_id:'a-pub2', template_codigo:'NRO-PUB-002', template_rev:'A', template_rev_atual:'A', projeto_id:null,
      autor:null, autor_nome:'MMARCONDES', criado_em:'2026-04-10T00:00:00Z', alterado_em:dvDia(-40), alterado_nome:'SOMA 25.0',
      grupo_revisor:null, grupos_leitura:[], n_pns:0 });
    DADOS.doc_rol.push(cab('a-dir4', 's-dir4', 4, 'DECLARAÇÃO DE VÍNCULO', 'B'), cab('a-dir6', 's-dir6', 6, 'DECLARAÇÃO DE PARTICIPAÇÃO EM EVENTO', 'A'));
    DADOS.doc_revisoes.push(
      { id:'r-dir4-b', arquivo_id:'a-dir4', rev:'B', estado:'aprovada', caminho:'a-dir4/u1/declaracao-b.docx', nome_original:'declaracao-b.docx',
        enviado_nome:'Ana Figueiredo', enviado_em:dvDia(-40), revisor_nome:'Carla Mendonça', revisado_em:dvDia(-39), relacionados:[] },
      { id:'r-dir6-a', arquivo_id:'a-dir6', rev:'A', estado:'aprovada', caminho:'a-dir6/u1/participacao-a.docx', nome_original:'participacao-a.docx',
        enviado_nome:'Ana Figueiredo', enviado_em:dvDia(-40), revisor_nome:'Carla Mendonça', revisado_em:dvDia(-39), relacionados:[] });
    DADOS.doc_eventos.push({ id:9, arquivo_id:'a-dir4', tipo:'pn_origem', detalhe:'os PNs não moram no rol: o PN é o registro do membro', nome:'SOMA 25.0', criado_em:dvDia(-40) });
  }

  /* ---- v27: o cofre ----
     Três contas. Duas do Google Workspace (i2): a da equipe, que o
     grupo Órtese usa e a Ana mantém — com 2FA e notas, e a troca
     vencendo —, e a de administrador, de NRO_MANAGERS, que a Carla
     mantém, com a troca vencida. A terceira é o painel da fechadura do
     LABBIO (i1), sem grupo nem responsável: usa quem tem o acesso
     concedido na ficha, como a Ana. O termo (i3) não tem conta. A
     gestão é NRO_MANAGERS (id 6), e admin — a Ana — gere também. O
     segredo do 2FA é o da RFC 6238: o código é o que o banco daria. */
  DADOS.cofre_config = [{ id:true, grupos_gestores:[6], rotacao_padrao_dias:180, aviso_dias:14, anterior_dias:30 }];
  DADOS.cofre_credenciais = [
    { id:'c0f00000-0000-4000-8000-000000000001', item_id:'i2', rotulo:'Conta da equipe', url:'https://accounts.google.com',
      usuario:'equipe@neurodynamics.dev', senha:'Gw!8vQ#2mZr4Tn%6', anterior:null, anterior_ate:null,
      totp:'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', totp_digitos:6, totp_periodo:30, totp_algoritmo:'SHA1',
      notas:'Códigos de recuperação:\n1234 5678\n8765 4321', instrucoes:'Entre pelo navegador do laboratório.',
      grupos:[1], responsaveis:[4], rotacao_dias:null, trocada_em:dvDia(-170), trocada_nome:'Ana Figueiredo', ativo:true, criado_em:dvDia(-200) },
    { id:'c0f00000-0000-4000-8000-000000000002', item_id:'i2', rotulo:'Administrador', url:'https://admin.google.com',
      usuario:'admin@neurodynamics.dev', senha:'Adm#5tR9!kW2qZ7v', anterior:'Velha-Senha-01', anterior_ate:dvDia(12),
      totp:null, totp_digitos:6, totp_periodo:30, totp_algoritmo:'SHA1', notas:null, instrucoes:null,
      grupos:[6], responsaveis:[17], rotacao_dias:90, trocada_em:dvDia(-120), trocada_nome:'Carla Mendonça', ativo:true, criado_em:dvDia(-300) },
    { id:'c0f00000-0000-4000-8000-000000000003', item_id:'i1', rotulo:'Painel da fechadura', url:'http://192.168.0.10',
      usuario:'labbio', senha:'Fx4$pL8!', anterior:null, anterior_ate:null, totp:null, totp_digitos:6, totp_periodo:30, totp_algoritmo:'SHA1',
      notas:null, instrucoes:'Só funciona na rede do laboratório.', grupos:[], responsaveis:[], rotacao_dias:null,
      trocada_em:dvDia(-10), trocada_nome:'Ana Figueiredo', ativo:true, criado_em:dvDia(-10) }
  ];
  DADOS.cofre_log = [
    { id:1, credencial_id:'c0f00000-0000-4000-8000-000000000001', conta:'Google Workspace — Conta da equipe', registro:4, nome:'Ana Figueiredo', acao:'criou', detalhe:null, criado_em:dvDia(-200) },
    { id:2, credencial_id:'c0f00000-0000-4000-8000-000000000001', conta:'Google Workspace — Conta da equipe', registro:11, nome:'Bruno Tavares', acao:'copiou_senha', detalhe:null, criado_em:dvDia(-3) },
    { id:3, credencial_id:'c0f00000-0000-4000-8000-000000000002', conta:'Google Workspace — Administrador', registro:17, nome:'Carla Mendonça', acao:'trocou', detalhe:null, criado_em:dvDia(-120) }
  ];

  /* ---- v26: os formulários ----
     A ata (PUB-003) e o relatório de teste (PRO-003) se escrevem no
     portal: as definições são as que a 26.0 traz, copiadas de lá. O
     rascunho de cada PN fica em doc_formulario_rascunhos. */
  DADOS.doc_series.find(s => s.id === 's-pub3').formulario = {"versao": 1, "rev": "A", "titulo": "Ata de reunião", "cabecalho": "{orgao}", "complemento": "{assunto}", "numerar_linhas": true, "campos": [{"id": "orgao", "rotulo": "Quem se reuniu", "tipo": "escolha", "obrigatorio": true, "secao": "A reunião", "opcoes": ["Gerência", "Diretoria", "Reunião geral", "Supervisão", "Conselho"], "livre": true, "ajuda": "Vai no cabeçalho do documento, no lugar do departamento."}, {"id": "assunto", "rotulo": "Qual reunião", "tipo": "texto", "obrigatorio": true, "secao": "A reunião", "exemplo": "Reunião de Gerência de abril", "ajuda": "Vai no título do registro, depois do nome da série."}, {"id": "data", "rotulo": "Data", "tipo": "data", "obrigatorio": true, "secao": "A reunião"}, {"id": "hora", "rotulo": "Horário de início", "tipo": "hora", "obrigatorio": true, "secao": "A reunião"}, {"id": "local", "rotulo": "Onde — como entra na frase", "tipo": "texto", "obrigatorio": true, "secao": "A reunião", "exemplo": "na Sala de Reuniões do LABBIO, na Escola de Engenharia da UFMG", "ajuda": "A ata começa: “Às 16 horas do dia 24 de abril de 2026, reuniram-se [aqui]:”."}, {"id": "presentes", "rotulo": "Quem esteve", "tipo": "pessoas", "obrigatorio": true, "secao": "Quem esteve", "nota": "observação", "exemplo_nota": "online · a partir das 17h"}, {"id": "pauta", "rotulo": "Pauta", "tipo": "lista", "obrigatorio": true, "secao": "Pauta", "exemplo": "Definir horário recorrente para as reuniões da Gerência"}, {"id": "discussao", "rotulo": "O que se discutiu e decidiu", "tipo": "paragrafo", "obrigatorio": true, "secao": "Discussão", "linhas": 14, "ajuda": "Um parágrafo por assunto, na ordem da pauta (deixe uma linha em branco entre eles). Os encaminhamentos vão no texto: quem ficou responsável pelo quê, e até quando."}, {"id": "redacao", "rotulo": "Quem redigiu", "tipo": "redacao", "obrigatorio": true, "secao": "Redação", "ajuda": "Se a ata foi escrita com apoio de IA, diga qual: ela sai “pelo LLM Gemini, aos cuidados de Fulano”."}, {"id": "data_redacao", "rotulo": "Redigida no dia", "tipo": "data", "obrigatorio": true, "secao": "Redação", "padrao": "hoje"}, {"id": "hora_redacao", "rotulo": "Às", "tipo": "hora", "obrigatorio": true, "secao": "Redação", "padrao": "agora"}], "impressao": [{"tipo": "texto", "texto": "Às {hora} do dia {data}, reuniram-se {local}:"}, {"tipo": "campo", "campo": "presentes", "marcador": "1.", "pontuacao": ";", "final": ","}, {"tipo": "texto", "texto": "com o objetivo de discutir sobre a seguinte pauta:"}, {"tipo": "campo", "campo": "pauta", "marcador": "A.", "pontuacao": ";", "final": "."}, {"tipo": "campo", "campo": "discussao"}, {"tipo": "texto", "texto": "Esta ata foi redigida {redacao}, às {hora_redacao} do dia {data_redacao}.", "estilo": "italico"}]};
  DADOS.doc_series.find(s => s.id === 's-pro3').formulario = {"versao": 1, "rev": "A", "titulo": "Relatório de Execução de Teste", "complemento": "{nome}", "campos": [{"id": "nome", "rotulo": "Nome do teste", "tipo": "texto", "obrigatorio": true, "secao": "O teste"}, {"id": "numero", "rotulo": "#", "tipo": "texto", "secao": "O teste", "ajuda": "O número ou o identificador do teste no plano, se houver."}, {"id": "data", "rotulo": "Data", "tipo": "data", "obrigatorio": true, "secao": "O teste"}, {"id": "hora", "rotulo": "Hora", "tipo": "hora", "secao": "O teste"}, {"id": "local", "rotulo": "Local", "tipo": "texto", "secao": "O teste", "exemplo": "Bancada 2, LABBIO"}, {"id": "projeto", "rotulo": "Projeto", "tipo": "projeto", "secao": "O teste"}, {"id": "resultado", "rotulo": "Resultado", "tipo": "escolha", "obrigatorio": true, "secao": "O teste", "opcoes": ["Aprovado", "Aprovado com ressalvas", "Reprovado", "Inconclusivo"]}, {"id": "responsavel", "rotulo": "Responsável", "tipo": "membro", "obrigatorio": true, "secao": "O teste", "padrao": "eu"}, {"id": "objetivo", "rotulo": "Objetivo do teste", "tipo": "paragrafo", "obrigatorio": true, "secao": "Objetivo do teste", "ajuda": "Descreva o(s) propósito(s) do teste; o que está sendo verificado, qual comportamento ou requisito está em foco e por que este teste é necessário."}, {"id": "envolvidos", "rotulo": "Envolvidos", "tipo": "pessoas", "secao": "Envolvidos", "nota": "função no teste", "exemplo_nota": "operador da bancada"}, {"id": "equipamentos", "rotulo": "Equipamentos e ferramentas", "tipo": "paragrafo", "secao": "Preparação", "linhas": 3}, {"id": "precondicoes", "rotulo": "Pré-condições", "tipo": "paragrafo", "secao": "Preparação", "linhas": 3}, {"id": "versoes", "rotulo": "Versões de software e firmware", "tipo": "paragrafo", "secao": "Preparação", "linhas": 2}, {"id": "configuracoes", "rotulo": "Configurações especiais", "tipo": "paragrafo", "secao": "Preparação", "linhas": 2}, {"id": "roteiro", "rotulo": "Roteiro", "tipo": "tabela", "obrigatorio": true, "secao": "Roteiro", "numerada": true, "colunas": [{"id": "passo", "rotulo": "Passo / ação", "tipo": "paragrafo", "largura": 3}, {"id": "esperado", "rotulo": "Resultado esperado", "tipo": "paragrafo", "largura": 2}, {"id": "obtido", "rotulo": "Resultado obtido", "tipo": "paragrafo", "largura": 2}, {"id": "status", "rotulo": "Status", "tipo": "escolha", "largura": 1, "opcoes": [{"valor": "ok", "rotulo": "Ok", "simbolo": "ok"}, {"valor": "falhou", "rotulo": "Falhou", "simbolo": "x"}, {"valor": "parcial", "rotulo": "Parcial", "simbolo": "~"}, {"valor": "na", "rotulo": "N/A", "simbolo": "-"}]}, {"id": "comentarios", "rotulo": "Comentários", "tipo": "paragrafo", "largura": 2}]}, {"id": "conclusao", "rotulo": "Conclusão", "tipo": "paragrafo", "obrigatorio": true, "secao": "Conclusão"}], "impressao": [{"tipo": "ficha", "linhas": [[{"rotulo": "Nome do teste", "valor": "{nome}"}, {"rotulo": "#", "valor": "{numero}", "estreito": true}], [{"rotulo": "Data e hora", "valor": "{data}{hora?, às }{hora}"}, {"rotulo": "Local", "valor": "{local}"}], [{"rotulo": "Projeto", "valor": "{projeto}"}, {"rotulo": "Resultado", "valor": "{resultado}"}], [{"rotulo": "Responsável", "valor": "{responsavel}"}]]}, {"tipo": "secao", "titulo": "Objetivo do teste", "instrucao": "Descreva o(s) propósito(s) do teste; o que está sendo verificado, qual comportamento ou requisito está em foco e por que este teste é necessário.", "campos": ["objetivo"], "moldura": true}, {"tipo": "secao", "titulo": "Envolvidos", "campos": ["envolvidos"], "colunas": ["Nome", "Função no teste"]}, {"tipo": "secao", "titulo": "Preparação", "campos": ["equipamentos", "precondicoes", "versoes", "configuracoes"], "layout": "chave-valor"}, {"tipo": "secao", "titulo": "Roteiro", "campos": ["roteiro"], "legenda": "status"}, {"tipo": "secao", "titulo": "Conclusão", "campos": ["conclusao"], "moldura": true}]};
  DADOS.doc_formulario_rascunhos = [];

  /* doc_arquivos é o que a lista de projetos lê para o progresso: sai do rol */
  DADOS.doc_arquivos = DADOS.doc_rol.map(r => ({ id:r.id, projeto_id:r.projeto_id || null, serie_id:r.serie_id,
    status:r.status, rev_pendente:r.rev_pendente }));

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
      update(d){ (window.__escritas ||= []).push({ tabela, op:'update', dados:d });
        if (tabela === 'treinamento_config') Object.assign(DADOS.treinamento_config[0], d, d.readme !== undefined ? { readme_atualizado_em:new Date().toISOString(), readme_atualizado_por:'Ana Figueiredo' } : {});
        return b; },
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
          /* ---- v20: arquivos e projetos ---- */
          const rol = id => DADOS.doc_rol.find(r => r.id === id);
          const eAdmin = () => DADOS.perfis[0].papel === 'admin';
          if (nome === 'doc_pode_ler'){ const r = rol(args?.p_arquivo); return { data: eAdmin() || r?.classe === 'publico', error:null }; }
          if (nome === 'doc_pode_editar') return { data: eAdmin(), error:null };
          if (nome === 'doc_pode_revisar'){
            const v = DADOS.doc_revisoes.find(x => x.id === args?.p_revisao);
            return { data: eAdmin() && v?.estado === 'pendente' && v?.enviado_por !== 4, error:null };
          }
          const grava = (k, p) => { (window.__rpcs ||= []).push({ nome:k, p }); };
          if (nome === 'doc_revisao_enviar'){
            const p = args?.p || {}; grava(nome, p);
            if (window.__teste?.envio) return { data:{ status: window.__teste.envio, faltam:['NRO-PES-014'] }, error:null };
            const r = rol(p.arquivo_id);
            const rev = r.natureza === 'registro' ? null : (r.rev_vigente ? String.fromCharCode(r.rev_vigente.charCodeAt(0) + 1) : 'A');
            DADOS.doc_revisoes.push({ id:'r-novo-' + DADOS.doc_revisoes.length, arquivo_id:r.id, rev, estado:'pendente', caminho:p.caminho,
              nome_original:p.nome_original, enviado_por:4, enviado_nome:'Ana Figueiredo', enviado_em:new Date().toISOString(),
              mudancas:p.mudancas, relacionados:(p.relacionados || []).map(x => ({ ...x, codigo: rol(x.arquivo_id)?.codigo })) });
            r.rev_pendente = rev || '—'; if (r.status === 'rascunho') r.status = 'em_revisao';
            return { data:{ status:'ok', id:'r-novo', rev }, error:null };
          }
          if (nome === 'doc_revisao_decidir'){
            const p = args?.p || {}; grava(nome, p);
            const v = DADOS.doc_revisoes.find(x => x.id === p.revisao_id), r = rol(v.arquivo_id);
            if (p.decisao === 'aprovar'){
              DADOS.doc_revisoes.filter(x => x.arquivo_id === r.id && x.estado === 'aprovada').forEach(x => x.estado = 'substituida');
              Object.assign(v, { estado:'aprovada', revisor_nome:'Ana Figueiredo', revisado_em:new Date().toISOString(), parecer:p.parecer });
              Object.assign(r, { status:'ativo', rev_vigente: v.rev || r.rev_vigente, rev_pendente:null });
            } else {
              Object.assign(v, { estado:'devolvida', revisor_nome:'Ana Figueiredo', revisado_em:new Date().toISOString(), parecer:p.parecer });
              Object.assign(r, { rev_pendente:null, status: r.rev_vigente ? 'ativo' : 'rascunho' });
            }
            return { data:{ status:'ok', decisao:p.decisao }, error:null };
          }
          if (nome === 'doc_arquivo_criar'){
            const p = args?.p || {}; grava(nome, p);
            const cab = DADOS.doc_rol.find(r => r.serie_id === p.serie_id && r.pn == null);
            const pn = Math.max(0, ...DADOS.doc_rol.filter(r => r.serie_id === p.serie_id && r.pn).map(r => r.pn)) + 1;
            const pj = DADOS.projetos.find(x => x.id === p.projeto_id);
            const codigo = cab.codigo + '-' + pn;
            DADOS.doc_rol.push({ ...cab, id:'a-novo-' + pn, codigo, pn, natureza: cab.tipo, status:'rascunho', rev_vigente:null, rev_pendente:null,
              template_id:cab.id, template_codigo:cab.codigo, template_rev:cab.rev_vigente, template_rev_atual:cab.rev_vigente,
              projeto_id:p.projeto_id || null, projeto_codigo:pj?.codigo || null, projeto_nome:pj?.nome || null,
              autor:4, autor_nome:'Ana Figueiredo', criado_em:new Date().toISOString(), alterado_em:new Date().toISOString(),
              alterado_nome:'Ana Figueiredo', n_pns:0, titulo: cab.titulo + (p.titulo ? ' — ' + p.titulo : ''), complemento:p.titulo || null });
            cab.n_pns = (cab.n_pns || 0) + 1;
            return { data:{ status:'ok', id:'a-novo-' + pn, codigo }, error:null };
          }
          /* ---- v26: os formulários ---- */
          if (nome.startsWith('doc_formulario')){
            (window.__rpcs ||= []).push({ nome, p: args?.p ?? args });
            const ok = o => ({ data:{ status:'ok', ...(o || {}) }, error:null });
            const st = (s, o) => ({ data:{ status:s, ...(o || {}) }, error:null });
            const serie = r => DADOS.doc_series.find(s => s.id === r.serie_id) || {};
            const vazio = v => v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)
              || (typeof v === 'object' && !Array.isArray(v) && !String(v.nome || '').trim());
            if (nome === 'doc_formulario_abrir'){
              const r = rol(args.p_arquivo); if (!r) return st('nao_encontrado');
              if (r.pn == null) return st('sem_pn');
              const def = serie(r).formulario; if (!def) return st('sem_formulario');
              if (!eAdmin()) return st('sem_permissao');
              const cab = DADOS.doc_rol.find(x => x.serie_id === r.serie_id && x.pn == null);
              const ras = DADOS.doc_formulario_rascunhos.find(x => x.arquivo_id === r.id);
              const u = DADOS.doc_revisoes.filter(v => v.arquivo_id === r.id && v.formulario).slice(-1)[0];
              const revs = DADOS.doc_revisoes.filter(v => v.arquivo_id === r.id);
              return ok({ def, dados: ras?.dados || null, atualizado_em: ras?.atualizado_em || null, atualizado_nome: ras?.atualizado_nome || null,
                ultima: u ? { dados:u.formulario.dados, estado:u.estado, rev:u.rev, enviado_em:u.enviado_em, enviado_nome:u.enviado_nome,
                  revisor_nome:u.revisor_nome || null, parecer:u.parecer || null } : null,
                template_codigo: cab?.codigo, template_rev: cab?.rev_vigente, emissor: DADOS.doc_emissores.find(e => e.prefixo === r.prefixo)?.nome,
                classe:r.classe, tipo:r.tipo, codigo:r.codigo, titulo:r.titulo, status_arquivo:r.status, rev_vigente:r.rev_vigente,
                pendente: revs.some(v => v.estado === 'pendente'), fechado: r.tipo === 'registro' && revs.some(v => v.estado === 'aprovada') });
            }
            if (nome === 'doc_formulario_salvar'){
              const r = rol(args.p_arquivo); if (!r) return st('nao_encontrado');
              if (!serie(r).formulario || r.pn == null) return st('sem_formulario');
              if (!eAdmin()) return st('sem_permissao');
              if (r.tipo === 'registro' && DADOS.doc_revisoes.some(v => v.arquivo_id === r.id && v.estado === 'aprovada')) return st('registro_fechado');
              const em = new Date().toISOString();
              DADOS.doc_formulario_rascunhos = DADOS.doc_formulario_rascunhos.filter(x => x.arquivo_id !== r.id)
                .concat([{ arquivo_id:r.id, dados:args.p_dados, atualizado_em:em, atualizado_por:4, atualizado_nome:'Ana Figueiredo' }]);
              return ok({ atualizado_em:em });
            }
            if (nome === 'doc_formulario_enviar'){
              const p = args?.p || {}, r = rol(p.arquivo_id); if (!r) return st('nao_encontrado');
              const def = serie(r).formulario; if (!def || r.pn == null) return st('sem_formulario');
              const faltam = (def.campos || []).filter(c => c.obrigatorio && vazio((p.dados || {})[c.id])).map(c => c.rotulo);
              if (faltam.length) return st('faltam', { faltam });
              if (window.__teste?.envio) return st(window.__teste.envio);
              if (DADOS.doc_revisoes.some(v => v.arquivo_id === r.id && v.estado === 'pendente')) return st('ja_pendente');
              const cab = DADOS.doc_rol.find(x => x.serie_id === r.serie_id && x.pn == null);
              const rev = r.natureza === 'registro' ? null : (r.rev_vigente ? String.fromCharCode(r.rev_vigente.charCodeAt(0) + 1) : 'A');
              const id = 'r-frm-' + DADOS.doc_revisoes.length;
              DADOS.doc_revisoes.push({ id, arquivo_id:r.id, rev, estado:'pendente', caminho:p.caminho, nome_original:p.nome_original,
                enviado_por:4, enviado_nome:'Ana Figueiredo', enviado_em:new Date().toISOString(), mudancas:p.mudancas || null,
                template_rev:cab?.rev_vigente || null, relacionados:(p.relacionados || []).map(x => ({ ...x, codigo: rol(x.arquivo_id)?.codigo })),
                formulario:{ def, dados:p.dados } });
              r.rev_pendente = rev || '—'; if (r.status === 'rascunho') r.status = 'em_revisao';
              DADOS.doc_formulario_rascunhos = DADOS.doc_formulario_rascunhos.filter(x => x.arquivo_id !== r.id);
              return ok({ id, rev, formulario:true });
            }
            if (nome === 'doc_formulario_definir'){
              const p = args?.p || {};
              if (!eAdmin()) return st('sem_permissao');
              const s = DADOS.doc_series.find(x => x.id === p.serie_id); if (!s) return st('nao_encontrado');
              if (!s.multiplo) return st('sem_pn');
              if (s.pn_origem) return st('pn_fora_do_rol');
              if (p.formulario && !(p.formulario.campos || []).length) return st('invalido', { problemas:['O formulário não tem nenhum campo.'] });
              s.formulario = p.formulario || null;
              return ok();
            }
            return ok();
          }
          if (['doc_revisao_cancelar','doc_arquivo_obsoletar','doc_relacao_salvar','doc_arquivo_editar',
               'doc_revisao_anexar','grupo_chave_definir'].includes(nome)){
            grava(nome, args?.p); return { data:{ status:'ok' }, error:null };
          }
          if (nome === 'doc_serie_salvar'){
            const p = args?.p || {}; grava(nome, p);
            return { data:{ status:'ok', id:p.id || 's-nova', codigo: p.id ? 'NRO-PES-007' : `NRO-${p.prefixo}-${String(p.sn || 20).padStart(3,'0')}` }, error:null };
          }
          if (nome === 'projeto_salvar'){
            const p = args?.p || {}; grava(nome, p);
            if (!p.id){
              const gid = Math.max(...DADOS.grupos.map(g => g.id)) + 1;
              DADOS.grupos.push({ id:gid, nome:'NRO_PROJECT_' + p.codigo, prefixo:p.codigo.slice(0,3), ativo:true, cor:null, chave:null,
                reservado:false, ordem:0, pai_id:7, quadro:true, responsaveis: p.supervisor ? [p.supervisor] : [], descricao:null });
              [...new Set([...(p.equipe || []), p.supervisor].filter(Boolean))].forEach(r => {
                const m = DADOS.membros.find(x => x.registro === r); if (m) m.grupos = [...(m.grupos || []), 'NRO_PROJECT_' + p.codigo]; });
              DADOS.projetos.push({ id:'pj-' + p.codigo, codigo:p.codigo, nome:p.nome, descricao:p.descricao, grupo_id:gid,
                supervisor:p.supervisor, logo_semente:p.logo_semente || p.codigo.toLowerCase(), status:'ativo', criado_em:new Date().toISOString() });
              return { data:{ status:'ok', id:'pj-' + p.codigo, codigo:p.codigo, grupo_id:gid }, error:null };
            }
            const pj = DADOS.projetos.find(x => x.id === p.id);
            ['nome','descricao','status','logo_semente','supervisor'].forEach(k => { if (k in p) pj[k] = p[k]; });
            return { data:{ status:'ok', id:pj.id, codigo:pj.codigo, grupo_id:pj.grupo_id }, error:null };
          }
          /* ---- v23: o Studio ---- */
          if (nome.startsWith('studio_')) (window.__rpcs ||= []).push({ nome, p: args?.p ?? args });
          if (nome === 'studio_lembretes') return { data:0, error:null };
          if (nome === 'studio_publicacao_salvar'){
            const p = args?.p || {};
            if (!p.id){
              if (!String(p.titulo || '').trim()) return { data:{ status:'invalido', campo:'titulo' }, error:null };
              const numero = Math.max(0, ...DADOS.studio_publicacoes.map(x => x.numero)) + 1;
              const nova = { id:'pn' + numero, numero, codigo:'POST-' + numero, status: p.status === 'producao' ? 'producao' : 'ideia', versao:1,
                imagens:[], redes:[], criado_por:4, responsavel: p.responsavel ?? 4, criado_em:new Date().toISOString(), atualizado_em:new Date().toISOString() };
              Object.entries(p).forEach(([k, v]) => { if (!['status','id'].includes(k)) nova[k] = v === '' ? null : v; });
              DADOS.studio_publicacoes.push(nova);
              return { data:{ status:'ok', id:nova.id, codigo:nova.codigo, versao:1, situacao:nova.status }, error:null };
            }
            const x = DADOS.studio_publicacoes.find(y => y.id === p.id);
            if (!x) return { data:{ status:'nao_encontrada' }, error:null };
            const conteudo = ['peca','imagens','legenda'].some(k => k in p && JSON.stringify(p[k]) !== JSON.stringify(x[k]));
            Object.entries(p).forEach(([k, v]) => { if (k !== 'id') x[k] = v === '' ? null : v; });
            if (conteudo){ x.versao++; if (x.status === 'pronta'){ x.status = 'aprovacao'; x.enviado_por = 4; } }
            if (x.status === 'ideia' && p.peca) x.status = 'producao';
            return { data:{ status:'ok', id:x.id, codigo:x.codigo, versao:x.versao, situacao:x.status }, error:null };
          }
          if (nome === 'studio_mover'){
            const x = DADOS.studio_publicacoes.find(y => y.id === args.p_id);
            if (!x) return { data:{ status:'nao_encontrada' }, error:null };
            const ok = DADOS.studio_aprovacoes.filter(a => a.publicacao_id === x.id && a.versao === x.versao && a.decisao === 'aprovada').length >= 1;
            if (args.p_status === 'pronta' && !ok) return { data:{ status:'precisa_aprovacao' }, error:null };
            if (args.p_status === 'publicada' && !['pronta','publicada'].includes(x.status)) return { data:{ status:'precisa_aprovacao' }, error:null };
            x.status = args.p_status;
            if (x.status === 'aprovacao'){ x.enviado_por = 4; x.enviado_em = new Date().toISOString(); }
            if (x.status === 'publicada'){ x.publicado_em = new Date().toISOString(); if (args.p_link) x.link = args.p_link; }
            return { data:{ status:'ok', situacao:x.status }, error:null };
          }
          if (nome === 'studio_decidir'){
            const p = args?.p || {}, x = DADOS.studio_publicacoes.find(y => y.id === p.id);
            if (x.enviado_por === 4) return { data:{ status:'propria' }, error:null };
            DADOS.studio_aprovacoes.push({ publicacao_id:x.id, versao:x.versao, registro:4, nome:'Ana Figueiredo',
              decisao: p.decisao === 'aprovar' ? 'aprovada' : 'devolvida', parecer:p.parecer, criado_em:new Date().toISOString() });
            x.status = p.decisao === 'aprovar' ? 'pronta' : 'producao';
            return { data:{ status:'ok', situacao:x.status, aprovacoes:1 }, error:null };
          }
          if (nome === 'studio_excluir'){
            const i = DADOS.studio_publicacoes.findIndex(y => y.id === args.p_id);
            const [x] = DADOS.studio_publicacoes.splice(i, 1);
            return { data:{ status:'ok', codigo:x.codigo, imagens:x.imagens }, error:null };
          }
          /* ---- v24: os treinamentos ---- */
          if (nome.startsWith('treinamento')) (window.__rpcs ||= []).push({ nome, p: args?.p ?? args });
          if (nome.startsWith('treinamento')){
            const T = DADOS.treinamentos, R = DADOS.treinamento_revisoes, C = DADOS.treinamento_conclusoes;
            const ok = d => ({ data:{ status:'ok', ...d }, error:null });
            const pub = t => R.find(r => r.treinamento_id === t.id && r.revisao === t.revisao_atual);
            const ord = r => !r ? 0 : [...r].reduce((s, c) => s * 26 + c.charCodeAt(0) - 64, 0);
            const letra = n => { let s = ''; while (n > 0){ n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; };
            const P = (window.__treProg ||= {});                         /* o progresso da Ana, por treinamento */
            const prog = t => (P[t.id + '@' + t.revisao_atual] ||= { feitos:[], respostas:{} });
            const meusGrupos = () => { const eu = DADOS.membros.find(m => m.registro === 4); const ids = new Set();
              (eu?.grupos || []).forEach(n => { let g = DADOS.grupos.find(x => x.nome === n); while (g && !ids.has(g.id)){ ids.add(g.id); g = DADOS.grupos.find(x => x.id === g.pai_id); } });
              return ids; };
            const obrig = t => { const as = DADOS.treinamento_atribuicoes.filter(a => a.treinamento_id === t.id && (a.grupo_id == null || meusGrupos().has(a.grupo_id)));
              return as.length ? as.some(a => a.obrigatorio) : null; };
            const concl = t => C.filter(c => c.treinamento_id === t.id && c.registro === 4).sort((a, b) => b.concluido_em.localeCompare(a.concluido_em))[0];
            const situ = t => { const c = concl(t), f = prog(t).feitos.length;
              if (c && ord(c.revisao) >= ord(t.revisao_minima)) return 'concluido';
              if (f) return 'andamento'; return c ? 'nova_revisao' : 'pendente'; };
            const linha = t => { const c = concl(t); return { id:t.id, codigo:t.codigo, titulo:t.titulo, resumo:t.resumo, categoria:t.categoria,
              carga_horaria_min:t.carga_horaria_min, revisao:t.revisao_atual, n_modulos:(pub(t)?.conteudo.modulos || []).length, obrigatorio:obrig(t),
              situacao:situ(t), feitos:prog(t).feitos.length, concluido_em:c?.concluido_em || null, certificado:c?.certificado || null,
              vence_em:null, publicado_em:pub(t)?.publicado_em }; };
            const fechar = t => { const mods = pub(t).conteudo.modulos, pr = prog(t);
              if (!mods.every(m => pr.feitos.includes(m.id))) return null;
              const c = concl(t); if (c && c.revisao === t.revisao_atual && pr.fechou) return c.certificado;
              const notas = mods.filter(m => m.verificacao).map(m => pr.respostas[m.id]?.melhor_nota || 0);
              const cert = 'CERT-' + Math.random().toString(16).slice(2, 6).toUpperCase() + '-' + Math.random().toString(16).slice(2, 6).toUpperCase();
              C.push({ id:'c' + (C.length + 9), certificado:cert, registro:4, treinamento_id:t.id, nome:'Ana Figueiredo', codigo:t.codigo, titulo:t.titulo,
                revisao:t.revisao_atual, carga_horaria_min:t.carga_horaria_min, nota: notas.length ? Math.round(notas.reduce((a, b) => a + b, 0) / notas.length) : null,
                modulos:mods.map(m => m.titulo), concluido_em:new Date().toISOString() });
              pr.fechou = true; return cert; };
            const porId = id => T.find(t => t.id === id);
            if (nome === 'treinamentos_meus' || nome === 'treinamentos_de') return { data: T.filter(t => t.status === 'publicado').map(linha), error:null };
            if (nome === 'treinamento_conteudo'){
              const t = T.find(x => x.codigo === String(args.p_codigo).toUpperCase());
              if (!t || !t.revisao_atual || t.status === 'arquivado') return { data:{ status:'nao_encontrado' }, error:null };
              const rv = pub(t), c = concl(t), pr = prog(t);
              const sem = JSON.parse(JSON.stringify(rv.conteudo.modulos)).map(m => { if (m.verificacao) m.verificacao.questoes.forEach(q => { delete q.explicacao; q.opcoes.forEach(o => delete o.correta); }); return m; });
              return ok({ treinamento:{ id:t.id, codigo:t.codigo, titulo:t.titulo, resumo:t.resumo, categoria:t.categoria, carga_horaria_min:t.carga_horaria_min,
                  nota_minima:t.nota_minima ?? 70, validade_meses:t.validade_meses, revisao:t.revisao_atual, revisao_minima:t.revisao_minima, situacao_treinamento:t.status,
                  responsavel:t.responsavel, responsavel_nome:'Ana Figueiredo', publicado_em:rv.publicado_em, notas_revisao:rv.notas },
                modulos:sem, feitos:[...pr.feitos], respostas:JSON.parse(JSON.stringify(pr.respostas)), situacao:situ(t), obrigatorio:obrig(t),
                conclusao: c ? { certificado:c.certificado, revisao:c.revisao, nota:c.nota, concluido_em:c.concluido_em, vence_em:null } : null });
            }
            if (nome === 'treinamento_concluir_modulo'){
              const t = porId(args.p_id), m = pub(t).conteudo.modulos.find(x => x.id === args.p_modulo);
              if (m.verificacao) return { data:{ status:'tem_verificacao' }, error:null };
              const pr = prog(t); if (!pr.feitos.includes(m.id)) pr.feitos.push(m.id);
              const cert = fechar(t);
              return ok({ feitos:[...pr.feitos], total:pub(t).conteudo.modulos.length, certificado:cert, situacao:situ(t) });
            }
            if (nome === 'treinamento_responder'){
              const t = porId(args.p_id), m = pub(t).conteudo.modulos.find(x => x.id === args.p_modulo), R2 = args.p_respostas || {};
              const erradas = [], gab = {};
              m.verificacao.questoes.forEach(q => {
                let certa;
                if (q.tipo === 'vf'){ const s = R2[q.id] || {}; certa = q.opcoes.every(o => s[o.id] === !!o.correta);
                  gab[q.id] = { vf:Object.fromEntries(q.opcoes.map(o => [o.id, !!o.correta])), explicacao:q.explicacao }; }
                else { const c = q.opcoes.filter(o => o.correta).map(o => o.id).sort(), s = [...new Set(R2[q.id] || [])].sort();
                  certa = c.length > 0 && c.join() === s.join(); gab[q.id] = { corretas:c, explicacao:q.explicacao }; }
                if (!certa) erradas.push(q.id);
              });
              const total = m.verificacao.questoes.length, acertos = total - erradas.length, nota = Math.round(100 * acertos / total), aprovado = nota >= 70;
              const pr = prog(t), ant = pr.respostas[m.id] || {};
              pr.respostas[m.id] = { tentativas:(ant.tentativas || 0) + 1, ultima_nota:nota, melhor_nota:Math.max(ant.melhor_nota || 0, nota), aprovado:ant.aprovado || aprovado };
              if (aprovado && !pr.feitos.includes(m.id)) pr.feitos.push(m.id);
              const cert = aprovado ? fechar(t) : null;
              return ok({ nota, acertos, total, nota_minima:70, aprovado, erradas, gabarito: aprovado ? gab : null, feitos:[...pr.feitos],
                total_modulos:pub(t).conteudo.modulos.length, certificado:cert, situacao:situ(t) });
            }
            if (nome === 'treinamento_recomecar'){ const t = porId(args.p_id); P[t.id + '@' + t.revisao_atual] = { feitos:[], respostas:{} }; return ok({ situacao:situ(t) }); }
            if (nome === 'treinamento_salvar'){
              const p = args.p || {};
              if (!p.id){
                if (!String(p.titulo || '').trim()) return { data:{ status:'invalido', campo:'titulo' }, error:null };
                const numero = p.numero ? +p.numero : Math.max(0, ...T.map(t => t.numero)) + 1;
                if (T.some(t => t.numero === numero)) return { data:{ status:'duplicado', campo:'numero' }, error:null };
                const t = { id:'tr' + numero, numero, codigo:'NRO-TRE-' + String(numero).padStart(3, '0'), titulo:p.titulo, resumo:p.resumo || null,
                  categoria:p.categoria || null, carga_horaria_min:p.carga_horaria_min ? +p.carga_horaria_min : null, nota_minima:null, validade_meses:null,
                  status:'rascunho', revisao_atual:null, revisao_minima:null, responsavel:4, criado_por:4, criado_em:new Date().toISOString(), atualizado_em:new Date().toISOString() };
                T.push(t);
                R.push({ id:'rv-' + t.id, treinamento_id:t.id, revisao:null, status:'rascunho', conteudo:p.conteudo || { modulos:[] }, notas:null, criado_em:t.criado_em, atualizado_em:t.criado_em });
                return ok({ id:t.id, codigo:t.codigo });
              }
              const t = porId(p.id);
              ['titulo','resumo','categoria','carga_horaria_min','nota_minima','validade_meses','responsavel'].forEach(k => { if (k in p) t[k] = p[k] === '' ? null : p[k]; });
              return ok({ id:t.id, codigo:t.codigo });
            }
            if (nome === 'treinamento_rascunho_salvar'){
              const t = porId(args.p_id); let r = R.find(x => x.treinamento_id === t.id && x.status === 'rascunho');
              if (!r){ r = { id:'rv-' + t.id + '-' + R.length, treinamento_id:t.id, revisao:null, status:'rascunho', conteudo:JSON.parse(JSON.stringify(pub(t)?.conteudo || { modulos:[] })),
                notas:null, criado_em:new Date().toISOString() }; R.push(r); }
              if (args.p_conteudo) r.conteudo = JSON.parse(JSON.stringify(args.p_conteudo));
              if (args.p_notas != null) r.notas = args.p_notas || null;
              r.atualizado_em = new Date().toISOString();
              return ok({ revisao_id:r.id, problemas:[] });
            }
            if (nome === 'treinamento_rascunho_descartar'){ const t = porId(args.p_id); const i = R.findIndex(x => x.treinamento_id === t.id && x.status === 'rascunho'); if (i >= 0) R.splice(i, 1); return ok({}); }
            if (nome === 'treinamento_publicar'){
              const t = porId(args.p_id), r = R.find(x => x.treinamento_id === t.id && x.status === 'rascunho');
              if (!r) return { data:{ status:'sem_rascunho' }, error:null };
              const l = letra(Math.max(ord(t.revisao_atual), ...R.filter(x => x.treinamento_id === t.id).map(x => ord(x.revisao))) + 1);
              const exige = !t.revisao_atual || !!args.p_exige_refazer;
              R.filter(x => x.treinamento_id === t.id && x.status === 'publicada').forEach(x => { x.status = 'substituida'; });
              Object.assign(r, { status:'publicada', revisao:l, exige_refazer:exige, notas:args.p_notas || r.notas, publicado_nome:'Ana Figueiredo', publicado_em:new Date().toISOString() });
              t.revisao_atual = l; t.status = 'publicado'; if (exige) t.revisao_minima = l;
              return ok({ revisao:l, exige_refazer:exige, avisados: exige ? 2 : 0 });
            }
            if (nome === 'treinamento_atribuir'){
              DADOS.treinamento_atribuicoes = DADOS.treinamento_atribuicoes.filter(a => a.treinamento_id !== args.p_id)
                .concat((args.p_lista || []).map((a, i) => ({ id:100 + i, treinamento_id:args.p_id, grupo_id:a.grupo_id, obrigatorio:a.obrigatorio })));
              return ok({ avisados:1, atribuicoes:(args.p_lista || []).length });
            }
            if (nome === 'treinamento_arquivar'){ const t = porId(args.p_id); t.status = args.p_arquivar ? 'arquivado' : 'publicado'; return ok({ situacao:t.status }); }
            if (nome === 'treinamento_excluir'){ const i = T.findIndex(t => t.id === args.p_id); const [t] = T.splice(i, 1); return ok({ codigo:t.codigo }); }
            if (nome === 'treinamento_acompanhamento'){
              const t = porId(args.p_id), a = linha(t), c = concl(t);
              return { data:[
                { registro:4, nome:'Ana Figueiredo', obrigatorio:a.obrigatorio, situacao:a.situacao, feitos:a.feitos, total:a.n_modulos,
                  concluido_em:c?.concluido_em || null, revisao:c?.revisao || null, nota:c?.nota ?? null, certificado:c?.certificado || null },
                { registro:11, nome:'Bruno Tavares', obrigatorio:false, situacao:'pendente', feitos:0, total:a.n_modulos, concluido_em:null, revisao:null, nota:null, certificado:null },
                { registro:17, nome:'Carla Mendonça', obrigatorio:true, situacao:'andamento', feitos:1, total:a.n_modulos, concluido_em:null, revisao:null, nota:null, certificado:null }], error:null };
            }
            if (nome === 'treinamento_certificado'){
              const c = C.find(x => x.certificado === String(args.p_codigo).toUpperCase());
              return c ? ok({ ...c, modulos:c.modulos, em_dia:true, vence_em:null, revisao_atual:porId(c.treinamento_id)?.revisao_atual }) : { data:{ status:'nao_encontrado' }, error:null };
            }
            return ok({});
          }
          /* ---- v25: as declarações e os eventos ----
             As mesmas regras do banco, no tamanho do teste: quem vê, quem
             mexe, quem aprova (nunca quem mandou, uma vez por versão), e a
             aprovação que basta emite uma declaração por participante. */
          if (/^(doc_vinculo|doc_emitid|doc_validar|evento_ext|eventos_ext)/.test(nome)){
            (window.__rpcs ||= []).push({ nome, p: args?.p ?? args });
            const ok = o => ({ data:{ status:'ok', ...(o || {}) }, error:null });
            const st = (s, o) => ({ data:{ status:s, ...(o || {}) }, error:null });
            const eu = DADOS.perfis[0].registro, papel = DADOS.perfis[0].papel;
            const gestao = ['admin','pessoal'].includes(papel);
            const cfgE = DADOS.eventos_ext_config[0], cfgD = DADOS.doc_emissao_config[0];
            const gruposDe = reg => { const m = DADOS.membros.find(x => x.registro === reg), ids = new Set();
              (m?.grupos || []).forEach(n => { let g = DADOS.grupos.find(x => x.nome === n);
                while (g && !ids.has(g.id)){ ids.add(g.id); g = DADOS.grupos.find(x => x.id === g.pai_id); } });
              return ids; };
            const aprova = () => papel === 'admin' || (cfgE.grupos_aprovadores || []).some(id => gruposDe(eu).has(id));
            const aprovadores = () => DADOS.membros.filter(m => ['Ativo','Em pausa / avaliação','Sob demanda'].includes(m.status)
              && (cfgE.grupos_aprovadores || []).some(id => gruposDe(m.registro).has(id))).map(m => m.registro);
            const gere = e => e.criado_por === eu || gestao;
            const parts = e => DADOS.eventos_ext_participantes.filter(p => p.evento_id === e.id).sort((a, b) => a.ordem - b.ordem);
            const vale = e => new Set(DADOS.eventos_ext_aprovacoes.filter(a => a.evento_id === e.id && a.versao === e.versao
              && a.decisao === 'aprovada').map(a => a.registro)).size;
            const jaAprovei = e => DADOS.eventos_ext_aprovacoes.some(a => a.evento_id === e.id && a.versao === e.versao
              && a.registro === eu && a.decisao === 'aprovada');
            const ve = e => (e.status === 'aprovado' && eu != null) || gestao || e.criado_por === eu
              || parts(e).some(p => p.registro === eu) || (['aprovacao','aprovado'].includes(e.status) && aprova());
            const veEmails = e => gestao || aprova() || e.criado_por === eu;
            const hist = (e, acao, detalhe) => DADOS.eventos_ext_historico.push({ evento_id:e.id, nome:'Ana Figueiredo', acao,
              detalhe: detalhe ?? null, criado_em:new Date().toISOString() });
            const porCod = c => DADOS.doc_emitidos.find(d => d.codigo === String(c || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
              .replace(/O/g, '0').replace(/[IL]/g, '1').replace(/^(.{4})(.{4})(.{4})$/, '$1-$2-$3'));
            const json = (d, pub) => ({ codigo:d.codigo, tipo:d.tipo, documento:d.documento, revisao:d.revisao, titulo:d.titulo,
              emissor:d.emissor, titular:d.titular, registro: pub ? null : d.registro, emitido_em:d.emitido_em,
              emitido_nome: pub ? null : d.emitido_nome, controle:d.controle, situacao: d.revogado_em ? 'revogado' : 'autentico',
              revogado_em:d.revogado_em, revogado_motivo:d.revogado_motivo, consultas: pub ? null : d.consultas,
              consultado_em: pub ? null : d.consultado_em, url_validacao:cfgD.url_validacao, segunda_via: d.tipo === 'participacao',
              dados: pub && d.tipo === 'vinculo' ? { ...d.dados, cpf: d.dados.cpf ? '***.' + d.dados.cpf.replace(/\D/g, '').slice(3, 6) + '.'
                + d.dados.cpf.replace(/\D/g, '').slice(6, 9) + '-**' : null } : d.dados });
            const ALFA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
            const novoCod = () => { let s = ''; for (let i = 0; i < 12; i++) s += ALFA[Math.floor(Math.random() * 32)];
              return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`; };
            const emitir = (tipo, documento, revisao, titulo, registro, titular, dados, e, pt) => {
              const d = { codigo:novoCod(), tipo, documento, revisao, titulo, emissor:'Diretoria', registro, titular,
                evento_id:e?.id || null, participante_id:pt?.id || null, dados,
                controle: Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0'),
                emitido_em:new Date().toISOString(), emitido_por:eu, emitido_nome:'Ana Figueiredo',
                revogado_em:null, revogado_nome:null, revogado_motivo:null, consultas:0, consultado_em:null };
              DADOS.doc_emitidos.push(d); return d; };
            const vinculo = reg => { const m = DADOS.membros.find(x => x.registro === reg); if (!m) return null;
              const cpf = (DADOS.dados_pessoais.find(x => x.registro === reg) || {}).cpf || null;
              const vig = !['Desligado','Egresso'].includes(m.status || 'Ativo');
              return { nome:m.nome, cpf, cargo:m.cargo || null, departamento:m.departamento || null, status:m.status, vigente:vig,
                desde:m.data_ingresso || null, ate: vig ? null : (m.data_desligamento || null), cidade:cfgD.cidade, data:dvData(0),
                texto_instituicao:cfgD.texto_instituicao,
                treinamentos: DADOS.treinamento_conclusoes.filter(c => c.registro === reg).map(c => ({ codigo:c.codigo, titulo:c.titulo,
                  revisao:c.revisao, carga_horaria_min:c.carga_horaria_min, concluido_em:String(c.concluido_em).slice(0, 10), certificado:c.certificado })),
                eventos: DADOS.eventos_ext_participantes.filter(p => p.registro === reg)
                  .map(p => [p, DADOS.eventos_ext.find(e => e.id === p.evento_id)]).filter(([, e]) => e?.status === 'aprovado')
                  .map(([p, e]) => ({ codigo:e.codigo, nome:e.nome, data_inicio:e.data_inicio, data_fim:e.data_fim, local:e.local,
                    modalidade:e.modalidade, papel:p.papel, horas:p.horas ?? e.horas })) }; };
            const podeVinculo = reg => reg != null && (reg === eu || gestao);

            if (nome === 'doc_validar'){
              const d = porCod(args.p_codigo);
              if (!/^[0-9A-Z]{12}$/.test(String(args.p_codigo || '').toUpperCase().replace(/[^0-9A-Z]/g, ''))) return st('invalido');
              if (!d) return st('nao_encontrado', { codigo:args.p_codigo });
              d.consultas++; d.consultado_em = new Date().toISOString();
              return ok(json(d, true));
            }
            if (nome === 'doc_vinculo_previa'){
              const reg = args?.p_registro ?? eu;
              if (reg == null) return st('sem_registro');
              if (!podeVinculo(reg)) return st('sem_permissao');
              const d = vinculo(reg); if (!d) return st('nao_encontrado');
              return ok({ registro:reg, dados:d, faltam:['cpf','cargo','desde'].filter(k => !d[k]), documento:'NRO-DIR-004-' + reg,
                revisao:'B', emissor:'Diretoria', titulo:'Declaração de vínculo', url_validacao:cfgD.url_validacao });
            }
            if (nome === 'doc_vinculo_emitir'){
              const reg = args?.p_registro ?? eu;
              if (reg == null) return st('sem_registro');
              if (!podeVinculo(reg)) return st('sem_permissao');
              const dd = vinculo(reg); if (!dd) return st('nao_encontrado');
              return ok(json(emitir('vinculo', 'NRO-DIR-004-' + reg, 'B', 'Declaração de vínculo', reg, dd.nome, dd), false));
            }
            if (nome === 'doc_emitidos_de'){
              const reg = args?.p_registro ?? eu;
              if (!podeVinculo(reg)) return { data:[], error:null };
              return { data: DADOS.doc_emitidos.filter(d => d.registro === reg).sort((a, b) => String(b.emitido_em).localeCompare(a.emitido_em))
                .map(d => ({ codigo:d.codigo, tipo:d.tipo, documento:d.documento, revisao:d.revisao, titulo:d.titulo, titular:d.titular,
                  emitido_em:d.emitido_em, emitido_nome:d.emitido_nome, revogado_em:d.revogado_em, revogado_motivo:d.revogado_motivo,
                  consultas:d.consultas, consultado_em:d.consultado_em,
                  evento_codigo: DADOS.eventos_ext.find(e => e.id === d.evento_id)?.codigo || null })), error:null };
            }
            if (nome === 'doc_emitido_ler'){
              const d = porCod(args.p_codigo), e = d && DADOS.eventos_ext.find(x => x.id === d.evento_id);
              if (!d || !(d.registro === eu || d.emitido_por === eu || gestao || (d.tipo === 'participacao' && e && veEmails(e))))
                return st('nao_encontrado');
              return ok(json(d, false));
            }
            if (nome === 'doc_emitido_revogar'){
              const d = porCod(args.p_codigo);
              if (!d) return st('nao_encontrado');
              if (!(gestao || (d.tipo === 'vinculo' && d.registro === eu))) return st('sem_permissao');
              if (d.revogado_em) return st('ja_revogado');
              if (!String(args.p_motivo || '').trim()) return st('invalido', { campo:'motivo' });
              Object.assign(d, { revogado_em:new Date().toISOString(), revogado_nome:'Ana Figueiredo', revogado_motivo:args.p_motivo.trim() });
              return ok();
            }
            if (nome === 'eventos_ext_pendentes')
              return { data: aprova() && eu != null ? DADOS.eventos_ext.filter(e => e.status === 'aprovacao' && e.enviado_por !== eu && !jaAprovei(e)).length : 0, error:null };
            if (nome === 'eventos_ext_lista'){
              if (eu == null && !gestao) return { data:[], error:null };
              return { data: DADOS.eventos_ext.filter(ve).sort((a, b) => String(b.data_fim || b.data_inicio).localeCompare(a.data_fim || a.data_inicio) || b.numero - a.numero)
                .map(e => ({ id:e.id, codigo:e.codigo, numero:e.numero, nome:e.nome, modalidade:e.modalidade, local:e.local, data_inicio:e.data_inicio,
                  data_fim:e.data_fim, horas:e.horas, status:e.status, versao:e.versao, criado_por:e.criado_por, criado_nome:e.criado_nome,
                  enviado_em:e.enviado_em, aprovado_em:e.aprovado_em, motivo:e.motivo, participantes:parts(e).length,
                  nomes:parts(e).slice(0, 6).map(p => p.nome), aprovacoes:vale(e), aprovacoes_minimas:cfgE.aprovacoes_minimas,
                  eu_participo:parts(e).some(p => p.registro === eu), minha_declaracao:parts(e).find(p => p.registro === eu)?.declaracao || null,
                  posso_aprovar: aprova() && e.status === 'aprovacao' && e.enviado_por !== eu && !jaAprovei(e), ja_aprovei:jaAprovei(e) })), error:null };
            }
            if (nome === 'evento_ext_ler'){
              const c = String(args.p_codigo || '').trim().toUpperCase();
              const e = DADOS.eventos_ext.find(x => x.codigo === c || x.id === args.p_codigo);
              if (!e || !ve(e)) return st('nao_encontrado');
              const vm = veEmails(e), g = gere(e);
              return ok({ evento:{ ...e },
                participantes: parts(e).map(p => { const env = DADOS.doc_envios.filter(v => v.codigo === p.declaracao).slice(-1)[0];
                  return { id:p.id, registro:p.registro, nome:p.nome, email: vm || p.registro === eu ? p.email : null, papel:p.papel, horas:p.horas,
                    declaracao: vm || p.registro === eu ? p.declaracao : null, enviado_em: vm ? env?.enviado_em || null : null,
                    envio_erro: vm ? env?.erro || null : null }; }),
                aprovacoes: DADOS.eventos_ext_aprovacoes.filter(a => a.evento_id === e.id),
                historico: DADOS.eventos_ext_historico.filter(h => h.evento_id === e.id),
                aprovacoes_validas:vale(e), aprovacoes_minimas:cfgE.aprovacoes_minimas,
                pode:{ editar: g && ['rascunho','aprovacao'].includes(e.status), enviar: g && e.status === 'rascunho' && eu != null,
                  cancelar: g && ['rascunho','aprovacao'].includes(e.status),
                  aprovar: aprova() && e.status === 'aprovacao' && e.enviado_por !== eu && eu != null && !jaAprovei(e),
                  reabrir: (aprova() || gestao) && e.status === 'aprovado', emails:vm, declaracoes:vm } });
            }
            if (nome === 'evento_ext_salvar'){
              const p = args?.p || {};
              let e = p.id ? DADOS.eventos_ext.find(x => x.id === p.id) : null;
              if (p.id && !e) return st('nao_encontrado');
              if (e && !gere(e)) return st('sem_permissao');
              if (e && !['rascunho','aprovacao'].includes(e.status)) return st('fechado');
              const inv = o => st('invalido', o);
              const nm = String(p.nome || '').trim();
              if (nm.length < 3 || nm.length > 200) return inv({ campo:'nome' });
              if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data_inicio || '')) return inv({ campo:'data_inicio' });
              if (p.data_fim && p.data_fim < p.data_inicio) return inv({ campo:'data_fim' });
              const fim = p.data_fim && p.data_fim !== p.data_inicio ? p.data_fim : null;
              if (p.hora_inicio && p.hora_fim && !fim && p.hora_fim <= p.hora_inicio) return inv({ campo:'hora_fim' });
              const h = Number(p.horas); if (!(h > 0 && h <= 9999)) return inv({ campo:'horas' });
              const mod = p.modalidade || 'presencial';
              if (mod !== 'online' && !String(p.local || '').trim()) return inv({ campo:'local' });
              const ps = p.participantes || []; if (!ps.length) return inv({ campo:'participantes' });
              const vistos = new Set();
              for (let i = 0; i < ps.length; i++){ const x = ps[i], linha = i + 1;
                let chave;
                if (x.registro != null){ if (!DADOS.membros.some(m => m.registro === x.registro)) return inv({ campo:'participantes', linha, motivo:'membro' }); chave = 'r' + x.registro; }
                else { if (String(x.nome || '').trim().length < 2) return inv({ campo:'participantes', linha, motivo:'nome' });
                  if (!/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]{2,}$/.test(String(x.email || '').trim().toLowerCase())) return inv({ campo:'participantes', linha, motivo:'email' });
                  chave = 'e' + String(x.email).trim().toLowerCase(); }
                if (vistos.has(chave)) return inv({ campo:'participantes', linha, motivo:'repetido' }); vistos.add(chave);
                if (x.horas !== '' && x.horas != null && !(Number(x.horas) > 0)) return inv({ campo:'participantes', linha, motivo:'horas' }); }
              let nova = false;
              if (!e){ const numero = Math.max(0, ...DADOS.eventos_ext.map(x => x.numero)) + 1;
                e = { id:'evn' + numero, numero, codigo:'EXT-' + numero, status:'rascunho', versao:1, criado_por:eu, criado_nome:'Ana Figueiredo',
                  criado_em:new Date().toISOString(), enviado_por:null, enviado_em:null, aprovado_em:null, motivo:null };
                DADOS.eventos_ext.push(e); hist(e, 'criou'); }
              else { nova = e.status === 'aprovacao'; if (nova) e.versao++; hist(e, 'editou', nova ? `Versão ${e.versao} — as aprovações recomeçam` : null); }
              Object.assign(e, { nome:nm, descricao:String(p.descricao || '').trim() || null, modalidade:mod, local:String(p.local || '').trim() || null,
                data_inicio:p.data_inicio, data_fim:fim, hora_inicio:p.hora_inicio || null, hora_fim:p.hora_fim || null, horas:Math.round(h * 100) / 100 });
              DADOS.eventos_ext_participantes = DADOS.eventos_ext_participantes.filter(x => x.evento_id !== e.id).concat(ps.map((x, i) => ({
                id:`${e.id}-p${i + 1}-${Date.now()}`, evento_id:e.id, registro:x.registro ?? null,
                nome: x.registro != null ? DADOS.membros.find(m => m.registro === x.registro).nome : String(x.nome).trim(),
                email: x.registro != null ? null : String(x.email).trim().toLowerCase(), papel:String(x.papel || '').trim() || null,
                horas: x.horas === '' || x.horas == null ? null : Number(x.horas), ordem:i + 1, declaracao:null })));
              return ok({ id:e.id, codigo:e.codigo, versao:e.versao, situacao:e.status });
            }
            if (nome === 'evento_ext_enviar'){
              const e = DADOS.eventos_ext.find(x => x.id === args.p_id);
              if (eu == null) return st('sem_registro');
              if (!e) return st('nao_encontrado');
              if (!gere(e)) return st('sem_permissao');
              if (e.status === 'aprovacao') return st('ja_enviado');
              if (e.status !== 'rascunho') return st('fechado');
              if ((e.data_fim || e.data_inicio) > dvData(0)) return st('futuro');
              Object.assign(e, { status:'aprovacao', enviado_por:eu, enviado_em:new Date().toISOString(), motivo:null });
              hist(e, 'enviou', 'Versão ' + e.versao);
              return ok({ situacao:'aprovacao', aprovadores: aprovadores().filter(r => r !== eu).length });
            }
            if (nome === 'evento_ext_decidir'){
              const p = args?.p || {}, e = DADOS.eventos_ext.find(x => x.id === p.id);
              if (eu == null) return st('sem_registro');
              if (!aprova()) return st('sem_permissao');
              if (p.decisao === 'devolver' && !String(p.parecer || '').trim()) return st('invalido', { campo:'parecer' });
              if (!e) return st('nao_encontrado');
              if (e.status !== 'aprovacao') return st('fora_de_aprovacao');
              if (e.enviado_por === eu) return st('propria');
              if (jaAprovei(e)) return st('ja_aprovou');
              DADOS.eventos_ext_aprovacoes.push({ evento_id:e.id, versao:e.versao, registro:eu, nome:'Ana Figueiredo',
                decisao: p.decisao === 'aprovar' ? 'aprovada' : 'devolvida', parecer: String(p.parecer || '').trim() || null, criado_em:new Date().toISOString() });
              if (p.decisao === 'devolver'){ Object.assign(e, { status:'rascunho', motivo:p.parecer.trim() }); hist(e, 'devolveu', p.parecer.trim());
                return ok({ situacao:'rascunho' }); }
              const n = vale(e), min = cfgE.aprovacoes_minimas;
              hist(e, 'aprovou', `Versão ${e.versao} · ${n} de ${min}`);
              if (n < min) return ok({ situacao:'aprovacao', aprovacoes:n, faltam:min - n });
              Object.assign(e, { status:'aprovado', aprovado_em:new Date().toISOString() });
              const ev = { codigo:e.codigo, nome:e.nome, descricao:e.descricao, modalidade:e.modalidade, local:e.local, data_inicio:e.data_inicio,
                data_fim:e.data_fim, hora_inicio:e.hora_inicio, hora_fim:e.hora_fim };
              const ps = parts(e);
              ps.forEach(pt => { const d = emitir('participacao', 'NRO-DIR-006-' + e.numero, 'A', 'Declaração de participação', pt.registro, pt.nome,
                  { nome:pt.nome, membro:pt.registro != null, papel:pt.papel, horas:pt.horas ?? e.horas, evento:ev, cidade:cfgD.cidade, data:dvData(0),
                    texto_instituicao:cfgD.texto_instituicao }, e, pt);
                pt.declaracao = d.codigo;
                DADOS.doc_envios.push({ id:DADOS.doc_envios.length + 1, codigo:d.codigo, enviado_em:null, tentativas:0, erro:null }); });
              hist(e, 'emitiu', `${ps.length} ${ps.length === 1 ? 'declaração' : 'declarações'} de participação`);
              return ok({ situacao:'aprovado', aprovacoes:n, declaracoes:ps.length });
            }
            if (nome === 'evento_ext_cancelar'){
              const e = DADOS.eventos_ext.find(x => x.id === args.p_id);
              if (!e) return st('nao_encontrado');
              if (!gere(e)) return st('sem_permissao');
              if (!['rascunho','aprovacao'].includes(e.status)) return st('fechado');
              if (!String(args.p_motivo || '').trim()) return st('invalido', { campo:'motivo' });
              Object.assign(e, { status:'cancelado', motivo:args.p_motivo.trim() }); hist(e, 'cancelou', e.motivo);
              return ok({ situacao:'cancelado' });
            }
            if (nome === 'evento_ext_reabrir'){
              if (!(gestao || aprova())) return st('sem_permissao');
              const e = DADOS.eventos_ext.find(x => x.id === args.p_id);
              if (!e) return st('nao_encontrado');
              if (e.status !== 'aprovado') return st('nao_aprovado');
              if (!String(args.p_motivo || '').trim()) return st('invalido', { campo:'motivo' });
              let n = 0;
              DADOS.doc_emitidos.filter(d => d.evento_id === e.id && !d.revogado_em).forEach(d => { n++;
                Object.assign(d, { revogado_em:new Date().toISOString(), revogado_nome:'Ana Figueiredo', revogado_motivo:`${e.codigo} reaberto para correção: ${args.p_motivo.trim()}` }); });
              parts(e).forEach(pt => { pt.declaracao = null; });
              Object.assign(e, { status:'rascunho', versao:e.versao + 1, aprovado_em:null, motivo:args.p_motivo.trim() });
              hist(e, 'reabriu', `${args.p_motivo.trim()} · ${n} ${n === 1 ? 'declaração revogada' : 'declarações revogadas'}`);
              return ok({ situacao:'rascunho', revogadas:n });
            }
            if (nome === 'evento_ext_reenviar'){
              const pt = DADOS.eventos_ext_participantes.find(x => x.id === args.p_participante);
              const e = pt && DADOS.eventos_ext.find(x => x.id === pt.evento_id);
              if (!pt) return st('nao_encontrado');
              if (!veEmails(e)) return st('sem_permissao');
              if (e.status !== 'aprovado' || !pt.declaracao) return st('nao_aprovado');
              const env = DADOS.doc_envios.filter(v => v.codigo === pt.declaracao).slice(-1)[0];
              if (env && !env.enviado_em && env.tentativas < 5) return st('na_fila');
              DADOS.doc_envios.push({ id:DADOS.doc_envios.length + 1, codigo:pt.declaracao, enviado_em:null, tentativas:0, erro:null });
              hist(e, 'reenviou', 'E-mail da declaração de ' + pt.nome);
              return ok();
            }
            return ok();
          }
          /* ---- v27: o cofre ----
             A regra de quem usa e quem mantém é a do banco; o código de
             duas etapas é calculado de verdade (RFC 6238), com o crypto
             do navegador. Cada segredo que sai entra em DADOS.cofre_log. */
          if (nome.startsWith('cofre_')){
            (window.__rpcs ||= []).push({ nome, p: args?.p ?? args });
            const ok = o => ({ data:{ status:'ok', ...(o || {}) }, error:null });
            const st = (s, o) => ({ data:{ status:s, ...(o || {}) }, error:null });
            const eu = DADOS.perfis[0].registro, papel = DADOS.perfis[0].papel;
            const cfg = DADOS.cofre_config[0], C = DADOS.cofre_credenciais;
            const gruposDe = reg => { const m = DADOS.membros.find(x => x.registro === reg), ids = new Set();
              (m?.grupos || []).forEach(n => { let g = DADOS.grupos.find(x => x.nome === n);
                while (g && !ids.has(g.id)){ ids.add(g.id); g = DADOS.grupos.find(x => x.id === g.pai_id); } });
              return ids; };
            const gestor = papel === 'admin' || (cfg.grupos_gestores || []).some(id => gruposDe(eu).has(id));
            const via = c => gestor ? 'gestao' : !c.ativo || eu == null ? null : c.responsaveis.includes(eu) ? 'responsavel'
              : c.grupos.some(id => gruposDe(eu).has(id)) ? 'grupo'
              : DADOS.acessos_concedidos.some(a => a.registro === eu && a.item_id === c.item_id && a.ativo) ? 'acesso' : null;
            const mantem = c => gestor || (c.ativo && c.responsaveis.includes(eu));
            const dia = 86400000;
            const vence = c => { const d = c.rotacao_dias ?? cfg.rotacao_padrao_dias;
              return !c.senha || !d ? null : new Date(new Date(c.trocada_em || c.criado_em).getTime() + d * dia).toISOString(); };
            const sit = c => !c.ativo ? 'desativada' : !c.senha ? 'sem_senha' : c.exposta ? 'exposta' : !vence(c) ? 'sem_troca'
              : new Date(vence(c)) < new Date() ? 'vencida' : new Date(vence(c)) < new Date(Date.now() + cfg.aviso_dias * dia) ? 'vence_logo' : 'em_dia';
            const item = c => DADOS.itens_de_acesso.find(i => i.id === c.item_id) || {};
            const nomeC = c => (item(c).nome || 'Conta') + (c.rotulo ? ' — ' + c.rotulo : '');
            const log = (c, acao, detalhe) => DADOS.cofre_log.push({ id:DADOS.cofre_log.length + 1, credencial_id:c.id, conta:nomeC(c),
              registro:eu, nome:'Ana Figueiredo', acao, detalhe: detalhe ?? null, criado_em:new Date().toISOString() });
            const porId = id => C.find(c => c.id === id);
            if (nome === 'cofre_gestor') return { data:gestor, error:null };
            if (nome === 'cofre_lembretes') return { data:0, error:null };
            if (nome === 'cofre_pendencias')
              return { data: C.filter(c => c.ativo && ['vencida','vence_logo','exposta'].includes(sit(c))
                && (c.responsaveis.includes(eu) || (!c.responsaveis.length && gestor))).length, error:null };
            if (nome === 'cofre_lista')
              return { data: C.filter(via).map(c => ({ id:c.id, item_id:c.item_id, item_nome:item(c).nome, item_categoria:item(c).categoria,
                rotulo:c.rotulo, url:c.url, usuario:c.usuario, tem_senha:!!c.senha,
                tem_anterior: !!c.anterior && new Date(c.anterior_ate) > new Date(), anterior_ate:c.anterior_ate,
                tem_totp:!!c.totp, totp_digitos:c.totp_digitos, totp_periodo:c.totp_periodo, tem_notas:!!c.notas, instrucoes:c.instrucoes,
                grupos:c.grupos, responsaveis:c.responsaveis,
                responsaveis_nomes: DADOS.membros.filter(m => c.responsaveis.includes(m.registro)).map(m => m.nome).sort(),
                rotacao_dias: c.rotacao_dias ?? cfg.rotacao_padrao_dias, rotacao_padrao: c.rotacao_dias == null,
                trocada_em:c.trocada_em, trocada_nome:c.trocada_nome, vence_em:vence(c), situacao:sit(c), via:via(c), mantem:mantem(c),
                ativo:c.ativo, criado_em:c.criado_em,
                ultimo_uso: DADOS.cofre_log.filter(l => l.credencial_id === c.id && /^(viu_senha|copiou_senha|codigo)$/.test(l.acao))
                  .map(l => l.criado_em).sort().slice(-1)[0] || null })), error:null };
            if (nome === 'cofre_revelar'){
              if (!['senha','anterior','notas'].includes(args.p_campo) || !['ver','copiar'].includes(args.p_acao)) return st('invalido');
              const c = porId(args.p_id); if (!c || !via(c)) return st('nao_encontrado');
              if (args.p_campo === 'anterior'){ if (!mantem(c)) return st('sem_permissao');
                if (!c.anterior || new Date(c.anterior_ate) <= new Date()) return st('vazio'); }
              const v = args.p_campo === 'senha' ? c.senha : args.p_campo === 'anterior' ? c.anterior : c.notas;
              if (!v) return st('vazio');
              log(c, (args.p_acao === 'ver' ? 'viu_' : 'copiou_') + args.p_campo);
              return ok({ valor:v });
            }
            if (nome === 'cofre_codigo'){
              const c = porId(args.p_id); if (!c || !via(c)) return st('nao_encontrado');
              if (!c.totp) return st('sem_totp');
              const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', b = []; let buf = 0, bits = 0;
              for (const ch of c.totp.toUpperCase()){ buf = (buf << 5) | A.indexOf(ch); bits += 5;
                if (bits >= 8){ bits -= 8; b.push((buf >>> bits) & 255); buf &= (1 << bits) - 1; } }
              const agora = Math.floor(Date.now() / 1000), t = Math.floor(agora / c.totp_periodo);
              const msg = new ArrayBuffer(8), dv = new DataView(msg); dv.setUint32(0, Math.floor(t / 0x100000000)); dv.setUint32(4, t >>> 0);
              const k = await crypto.subtle.importKey('raw', new Uint8Array(b), { name:'HMAC', hash:'SHA-1' }, false, ['sign']);
              const h = new Uint8Array(await crypto.subtle.sign('HMAC', k, msg)), o = h[h.length - 1] & 15;
              const bin = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
              log(c, 'codigo');
              return ok({ codigo:String(bin % 10 ** c.totp_digitos).padStart(c.totp_digitos, '0'),
                restante: c.totp_periodo - agora % c.totp_periodo, periodo:c.totp_periodo, digitos:c.totp_digitos });
            }
            if (nome === 'cofre_salvar'){
              const p = args?.p || {}; let c = p.id ? porId(p.id) : null;
              const inv = campo => st('invalido', { campo });
              if (!p.id){ if (!gestor) return st('sem_permissao'); if (!DADOS.itens_de_acesso.some(i => i.id === p.item_id)) return inv('item_id'); }
              else { if (!c) return st('nao_encontrado'); if (!mantem(c)) return st('sem_permissao');
                if (!gestor && ['grupos','responsaveis','rotacao_dias','item_id','ativo'].some(k => k in p)) return st('sem_permissao', { campo:'gestao' }); }
              if (p.url && !/^https?:\/\/\S+$/i.test(p.url)) return inv('url');
              if ('senha' in p && (!p.senha || p.senha.length > 500)) return inv('senha');
              if ('senha' in p && p.id) return st('invalido', { campo:'senha', motivo:'use cofre_trocar_senha' });
              if (p.totp && (!/^[A-Z2-7]{16,}$/.test(String(p.totp.segredo || '')) || ![6, 7, 8].includes(p.totp.digitos))) return inv('totp');
              const mud = [];
              if (!c){ c = { id:`c0f00000-0000-4000-8000-${String(C.length + 1).padStart(12, '0')}`, item_id:p.item_id, senha:null, anterior:null,
                anterior_ate:null, totp:null, totp_digitos:6, totp_periodo:30, totp_algoritmo:'SHA1', notas:null, grupos:[], responsaveis:[],
                rotacao_dias:null, trocada_em:null, trocada_nome:null, ativo:true, criado_em:new Date().toISOString() };
                C.push(c); }
              else {
                if ('usuario' in p && (p.usuario || null) !== c.usuario) mud.push('usuário');
                if ('rotacao_dias' in p && p.rotacao_dias !== c.rotacao_dias) mud.push('prazo de troca');
                if ('ativo' in p && p.ativo !== c.ativo) mud.push(p.ativo ? 'reativada' : 'desativada');
              }
              ['rotulo','url','usuario','instrucoes'].forEach(k => { if (k in p) c[k] = String(p[k] || '').trim() || null; });
              ['grupos','responsaveis','rotacao_dias','ativo','item_id'].forEach(k => { if (k in p) c[k] = p[k]; });
              if (p.senha){ c.senha = p.senha; c.trocada_em = new Date().toISOString(); c.trocada_nome = 'Ana Figueiredo'; }
              if (p.totp){ c.totp = p.totp.segredo; c.totp_digitos = p.totp.digitos; c.totp_periodo = p.totp.periodo; c.totp_algoritmo = p.totp.algoritmo;
                if (p.id) mud.push('código de duas etapas'); }
              else if ('totp' in p && p.totp === null && c.totp){ c.totp = null; mud.push('código de duas etapas retirado'); }
              if ('notas' in p){ if (!String(p.notas).trim()){ if (c.notas){ c.notas = null; mud.push('notas retiradas'); } }
                else { c.notas = p.notas; if (p.id) mud.push('notas'); } }
              log(c, p.id ? 'editou' : 'criou', p.id ? mud.join(', ') || null : null);
              return ok({ id:c.id });
            }
            if (nome === 'cofre_trocar_senha'){
              const c = porId(args.p_id); if (!c) return st('nao_encontrado');
              if (!mantem(c)) return st('sem_permissao');
              if (!args.p_nova) return st('invalido', { campo:'senha' });
              if (c.senha === args.p_nova) return st('invalido', { campo:'senha', motivo:'igual' });
              if (c.senha && cfg.anterior_dias){ c.anterior = c.senha; c.anterior_ate = new Date(Date.now() + cfg.anterior_dias * dia).toISOString(); }
              Object.assign(c, { senha:args.p_nova, trocada_em:new Date().toISOString(), trocada_nome:'Ana Figueiredo', exposta:false });
              log(c, 'trocou');
              return ok({ vence_em:vence(c) });
            }
            if (nome === 'cofre_excluir'){
              if (!gestor) return st('sem_permissao');
              const i = C.findIndex(c => c.id === args.p_id); if (i < 0) return st('nao_encontrado');
              log(C[i], 'excluiu'); C.splice(i, 1);
              return ok();
            }
            if (nome === 'cofre_log_ler'){
              const c = args.p_id ? porId(args.p_id) : null;
              if (args.p_id ? !c || !mantem(c) : !gestor) return { data:[], error:null };
              return { data: DADOS.cofre_log.filter(l => !args.p_id || l.credencial_id === args.p_id).slice().reverse()
                .slice(0, args.p_limite || 200), error:null };
            }
            return ok();
          }
          if (nome === 'agenda_itens' || nome === 'agenda_manter_series') return { data: [], error: null };
          if (nome === 'portal_agenda_ocupacao') return { data: [], error: null };
          return { data: { status:'ok', codigo:'ORT-9', id:'novo' }, error: null };
        },
        /* o Storage: sobe, assina link, apaga — e anota tudo */
        storage: {
          from(bucket){
            return {
              upload: async (caminho, arquivo, op) => { (window.__uploads ||= []).push({ bucket, caminho, nome: arquivo?.name, op });
                return { data:{ path: caminho }, error:null }; },
              createSignedUrl: async (caminho, exp, op) => { (window.__baixados ||= []).push({ bucket, caminho, op });
                return { data:{ signedUrl:'javascript:void(0)' }, error:null }; },
              remove: async (caminhos) => { (window.__removidos ||= []).push(...caminhos); return { data:[], error:null }; },
              /* a prévia de uma arte: um retângulo da cor da marca */
              createSignedUrls: async (caminhos) => ({ data: caminhos.map(c => ({ path:c, signedUrl:
                'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="100"><rect width="80" height="100" fill="#00594F"/><circle cx="60" cy="20" r="12" fill="#CEDC00"/></svg>') })), error:null }),
              list: async () => ({ data:[], error:null })
            };
          }
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
