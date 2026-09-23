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
              remove: async (caminhos) => { (window.__removidos ||= []).push(...caminhos); return { data:[], error:null }; }
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
