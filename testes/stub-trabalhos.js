/* Os trabalhos (2.23.0) no Supabase falso. Vem DEPOIS do stub-supabase.js
   (o teste concatena os dois): põe nos dados de sempre (window.__stubDados)
   os grupos dos trabalhos, os trainees, os cartões do quadro T5 e as
   tabelas novas, e responde às funções trabalho_*, convidado_*,
   convidados_lista, habilidades_salvar e doc_serie_formato com as regras
   do banco. Cada chamada entra em window.__rpcs como { nome, p }.

   A pessoa logada é a Ana (4, admin): gere os trabalhos. O TRB-5
   (Calima firmware, responsável o Bruno, 11) tem o Bruno e o Pedro (60,
   trainee) e a convidada Lucía; o TRB-3 (Estande NRO) está sem ninguém.
   A Sarah (61) é trainee e está livre. Em Arquivos, o PES tem a cor Ion
   e os outros emissores, a da ordem. */
(function(){
  const D = window.__stubDados;
  const agora = () => new Date().toISOString();
  const rpcs = (nome, p) => (window.__rpcs ||= []).push({ nome, p });

  D.grupos.push(
    { id:20, nome:'NRO_TRABALHOS', prefixo:'TRAB', ativo:true, cor:null, chave:'trabalhos', reservado:false, ordem:20,
      pai_id:null, quadro:false, responsaveis:[], descricao:'Um subgrupo por trabalho.' },
    { id:21, nome:'NRO_TRABALHO_5', prefixo:'T5', ativo:true, cor:null, chave:null, reservado:false, ordem:21,
      pai_id:20, quadro:true, responsaveis:[11], descricao:null },
    { id:22, nome:'NRO_TRABALHO_3', prefixo:'T3', ativo:true, cor:null, chave:null, reservado:false, ordem:22,
      pai_id:20, quadro:true, responsaveis:[], descricao:null });
  D.grupos_visiveis.push(
    { id:21, nome:'NRO_TRABALHO_5', prefixo:'T5', cor:null, ordem:21, reservado:false, chave:null, meu_nivel:'edicao', pessoas:2 },
    { id:22, nome:'NRO_TRABALHO_3', prefixo:'T3', cor:null, ordem:22, reservado:false, chave:null, meu_nivel:'edicao', pessoas:0 });
  const cartao = (id, codigo, seq, titulo, status, resp) => ({ id, codigo, grupo_id:21, grupo:'NRO_TRABALHO_5', grupo_prefixo:'T5', seq, titulo,
    status, prioridade:'media', responsavel:resp, responsavel_nome:resp === 60 ? 'Pedro Lima' : null, criado_por:11, criado_por_nome:'Bruno Tavares',
    prazo:null, sinalizada:false, ordem:seq * 1000, arquivada:false, comentarios:0, atrasada:false, criado_em:'2026-10-01T10:00:00Z',
    pessoas:[], etiquetas:[], check_total:0, check_feitos:0 });
  D.atividades_quadro.push(cartao('t51', 'T5-1', 1, 'Ler o firmware do Connect Cycling', 'fazendo', 60),
                           cartao('t52', 'T5-2', 2, 'Modelar a compensação angular', 'a_fazer', null));

  D.membros.find(m => m.registro === 11).grupos.push('NRO_TRABALHO_5');
  D.membros.push(
    { registro:60, nome:'Pedro Lima', cargo:'Trainee', departamento:'Desenvolvimento', status:'Ativo', grupos:['NRO_TRABALHO_5'], gestor_registro:11 },
    { registro:61, nome:'Sarah Costa', cargo:'Trainee', departamento:'Desenvolvimento', status:'Ativo', grupos:[], gestor_registro:11 },
    { registro:62, nome:'Nádia Rocha', cargo:'Pesquisadora clínica', departamento:'Pesquisa', status:'Ativo', grupos:[], gestor_registro:4 });

  D.trabalhos = [
    { id:'tb5', numero:5, codigo:'TRB-5', referencia:'Projeto Calima (firmware)', tipo:'etapa', status:'em_andamento', ciclo:'2026/2',
      inicio:'2026-09-01', fim:null, alocacao:'2 trainees Dev', complexidade:4, esforco:5,
      escopo:'Realizar as implementações finais de compensação angular no firmware do Connect Cycling.',
      justificativa:'- A compensação angular é a última etapa pendente.\n- Desenvolve estrutura de firmware na equipe.',
      entregaveis:'- Firmware com a compensação angular.\n- Relatório de testes de bancada.',
      dependencias:'- Uso do hardware Connect, compartilhado com os trabalhos TRB-3 e TRB-6.',
      criterios:'- Compensação angular funcionando em bancada.',
      cenario:{ forcas:['Acompanhamento de perto do Pedro.'], fraquezas:['É necessária bastante dedicação.'],
                oportunidades:['Finalizar o Connect Cycling.'], ameacas:['Disputa do Connect com os demais trabalhos.'] },
      projeto_id:'pj1', grupo_id:21, responsaveis:[11], criado_por:4, criado_em:'2026-09-01T12:00:00Z', atualizado_em:'2026-09-01T12:00:00Z' },
    { id:'tb3', numero:3, codigo:'TRB-3', referencia:'Estande NRO', tipo:'campanha', status:'a_iniciar', ciclo:'2026/2',
      inicio:null, fim:null, alocacao:'2 trainees Mecânica, 1 trainee RI', complexidade:2, esforco:5, escopo:null, justificativa:null,
      entregaveis:null, dependencias:null, criterios:null, cenario:{}, projeto_id:null, grupo_id:22, responsaveis:[], criado_por:4,
      criado_em:'2026-09-02T12:00:00Z', atualizado_em:'2026-09-02T12:00:00Z' }];
  D.trabalho_convidados = [{ trabalho_id:'tb5', convidado_id:'cv1', incluido_por:11, incluido_em:'2026-09-05T12:00:00Z' }];
  D.trabalho_documentos = [
    { id:'td1', trabalho_id:'tb5', arquivo_id:'a-pro3', titulo:null, url:null, nota:null, ordem:0 },
    { id:'td2', trabalho_id:'tb5', arquivo_id:null, titulo:'Banco de fotos', url:'https://drive.google.com/drive/folders/abc', nota:null, ordem:1 }];
  D.membro_habilidades = [
    { registro:60, tem:['Firmware', 'C'], quer:['Processamento de sinais'] },
    { registro:61, tem:['Python'], quer:['PCB', 'Arduino'] }];
  const CONV = [{ id:'cv1', nome:'Lucía Gómez', email:'lucia@uchile.cl', instituicao:'Universidad de Chile', motivo:'intercambio',
    responsavel:11, foto_url:null, habilidades:['Python'], quer_desenvolver:['Firmware'], observacao:null, ativo:true, criado_em:'2026-09-05T12:00:00Z' }];

  /* Arquivos: a cor de cada emissor e o formato dos arquivos */
  D.doc_emissores.forEach(e => { e.familia = e.prefixo === 'PES' ? 'ion' : null; });
  D.doc_series.forEach(s => { s.formato = s.id === 's-pro4' ? 'xlsx' : null; });
  const FMT = { 'a-pes5':'xlsx', 'a-pes7':'docx', 'a-pub3-1':'pdf', 'a-pub2':'docx', 'a-pub3':'docx', 'a-pro3':'docx' };
  D.doc_rol.forEach(r => { r.formato = FMT[r.id] || null; r.serie_formato = D.doc_series.find(s => s.id === r.serie_id)?.formato || null; });

  const membro = r => D.membros.find(m => m.registro === r);
  const efetivo = r => { const m = membro(r); return !!m && m.status === 'Ativo' && !/^trainee$/i.test(m.cargo || ''); };
  const base = window.supabase.createClient;
  window.supabase.createClient = (...a) => {
    const c = base(...a), rpc = c.rpc;
    c.rpc = async (nome, args) => {
      const p = args?.p || {};
      if (nome === 'convidados_lista'){ rpcs(nome, {}); return { data: CONV.map(x => ({ ...x, gere:true,
        trabalhos: D.trabalho_convidados.filter(t => t.convidado_id === x.id).map(t => t.trabalho_id) })), error:null }; }
      if (nome === 'trabalho_salvar'){
        rpcs(nome, p);
        if (!p.id){
          if (!String(p.referencia || '').trim()) return { data:{ status:'invalido', campo:'referencia' }, error:null };
          const numero = p.numero || Math.max(0, ...D.trabalhos.map(t => t.numero)) + 1;
          if (D.trabalhos.some(t => t.numero === numero)) return { data:{ status:'duplicado', campo:'numero' }, error:null };
          const gid = Math.max(...D.grupos.map(g => g.id)) + 1, nomeG = 'NRO_TRABALHO_' + numero;
          D.grupos.push({ id:gid, nome:nomeG, prefixo:'T' + numero, ativo:true, cor:null, chave:null, reservado:false, ordem:gid,
            pai_id:20, quadro:true, responsaveis:[...(p.responsaveis || [])], descricao:null });
          D.grupos_visiveis.push({ id:gid, nome:nomeG, prefixo:'T' + numero, cor:null, ordem:gid, reservado:false, chave:null, meu_nivel:'edicao', pessoas:0 });
          (p.responsaveis || []).forEach(r => { const m = membro(r); if (m) m.grupos = [...(m.grupos || []), nomeG]; });
          const t = { id:'tb' + numero, numero, codigo:'TRB-' + numero, grupo_id:gid, criado_por:4, criado_em:agora(), atualizado_em:agora(),
            status:'a_iniciar', tipo:'outro', cenario:{}, responsaveis:[], ...p };
          delete t.equipe; D.trabalhos.push(t);
          return { data:{ status:'ok', id:t.id, numero, codigo:t.codigo, grupo_id:gid, prefixo:'T' + numero }, error:null };
        }
        const t = D.trabalhos.find(x => x.id === p.id);
        if (!t) return { data:{ status:'nao_encontrado' }, error:null };
        Object.entries(p).forEach(([k, v]) => { if (k !== 'id') t[k] = v === '' ? null : v; });
        return { data:{ status:'ok', id:t.id, numero:t.numero, codigo:t.codigo, grupo_id:t.grupo_id }, error:null };
      }
      if (nome === 'trabalho_pessoas'){
        rpcs(nome, p);
        const t = D.trabalhos.find(x => x.id === p.trabalho_id); if (!t) return { data:{ status:'nao_encontrado' }, error:null };
        const g = D.grupos.find(x => x.id === t.grupo_id);
        let adicionados = 0, removidos = 0, convidados_adicionados = 0, convidados_removidos = 0;
        (p.adicionar || []).forEach(r => { const m = membro(r);
          if (m && !(m.grupos || []).includes(g.nome)){ m.grupos = [...(m.grupos || []), g.nome]; adicionados++; } });
        (p.remover || []).forEach(r => { const m = membro(r);
          if (m && (m.grupos || []).includes(g.nome)){ m.grupos = m.grupos.filter(n => n !== g.nome); removidos++; } });
        (p.convidados_adicionar || []).forEach(id => { if (!D.trabalho_convidados.some(x => x.trabalho_id === t.id && x.convidado_id === id)){
          D.trabalho_convidados.push({ trabalho_id:t.id, convidado_id:id, incluido_por:4, incluido_em:agora() }); convidados_adicionados++; } });
        (p.convidados_remover || []).forEach(id => { const n = D.trabalho_convidados.length;
          D.trabalho_convidados = D.trabalho_convidados.filter(x => !(x.trabalho_id === t.id && x.convidado_id === id));
          convidados_removidos += n - D.trabalho_convidados.length; });
        return { data:{ status:'ok', adicionados, removidos, convidados_adicionados, convidados_removidos }, error:null };
      }
      if (nome === 'convidado_salvar'){
        rpcs(nome, p);
        if (!p.id){
          if (!efetivo(p.responsavel)) return { data:{ status:'invalido', campo:'responsavel' }, error:null };
          const novo = { id:'cv' + (CONV.length + 1), ativo:true, habilidades:[], quer_desenvolver:[], criado_em:agora(), ...p };
          CONV.push(novo);
          return { data:{ status:'ok', id:novo.id }, error:null };
        }
        const x = CONV.find(y => y.id === p.id); if (!x) return { data:{ status:'nao_encontrado' }, error:null };
        if ('responsavel' in p && !efetivo(p.responsavel)) return { data:{ status:'invalido', campo:'responsavel' }, error:null };
        Object.assign(x, p);
        if (p.ativo === false) D.trabalho_convidados = D.trabalho_convidados.filter(y => y.convidado_id !== x.id);
        return { data:{ status:'ok', id:x.id }, error:null };
      }
      if (nome === 'trabalho_documento_salvar'){
        rpcs(nome, p);
        if (p.arquivo_id && D.trabalho_documentos.some(d => d.trabalho_id === p.trabalho_id && d.arquivo_id === p.arquivo_id))
          return { data:{ status:'duplicado' }, error:null };
        const d = { id:'td' + (D.trabalho_documentos.length + 10), ordem:D.trabalho_documentos.length, nota:null, titulo:null, url:null, arquivo_id:null, ...p };
        D.trabalho_documentos.push(d);
        return { data:{ status:'ok', id:d.id }, error:null };
      }
      if (nome === 'trabalho_documento_tirar'){
        rpcs(nome, args);
        D.trabalho_documentos = D.trabalho_documentos.filter(d => d.id !== args?.p_id);
        return { data:{ status:'ok' }, error:null };
      }
      if (nome === 'habilidades_salvar'){
        rpcs(nome, p);
        const r = p.registro ?? 4, h = D.membro_habilidades.find(x => x.registro === r);
        if (h) Object.assign(h, { tem:p.tem, quer:p.quer }); else D.membro_habilidades.push({ registro:r, tem:p.tem, quer:p.quer });
        return { data:{ status:'ok', registro:r }, error:null };
      }
      if (nome === 'doc_serie_formato'){
        rpcs(nome, args);
        const s = D.doc_series.find(x => x.id === args?.p_serie); if (s) s.formato = args.p_formato;
        D.doc_rol.filter(r => r.serie_id === args?.p_serie).forEach(r => { r.serie_formato = args.p_formato; });
        return { data:{ status:'ok' }, error:null };
      }
      return rpc(nome, args);
    };
    return c;
  };
})();
