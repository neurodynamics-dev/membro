/* O banco de imagens (2.24.0; 2.26.0) no Supabase falso.
   Vem DEPOIS do stub-supabase.js (o teste concatena os dois): põe nos
   dados de sempre (window.__stubDados) os temas e as fotos, e responde
   às funções fotos_adicionar, foto_decidir, fotos_decidir, foto_salvar,
   foto_imagem_definir e foto_status_definir com as regras do banco: o
   admin põe fotos novas, que vão para a avaliação; quem gere o Studio
   aprova ou rejeita. Cada chamada entra em window.__rpcs como { nome, p }.

   A pessoa logada é a Ana (4, admin): gere o Studio. Na avaliação: uma
   posta por link e quatro sugestões, em dois temas. No banco: três
   (com tags; duas com o endereço da imagem) e uma rejeitada. */
(function(){
  const D = window.__stubDados;
  const agora = () => new Date().toISOString();
  const rpcs = (nome, p) => (window.__rpcs ||= []).push({ nome, p });

  D.foto_temas = [
    { chave:'laboratorio', nome:'Laboratório', familia:'nexo', titulo:'Da bancada à clínica.', sub:'Pesquisa traduzida em protótipos.', termos:['microscope','pipette'], ordem:10 },
    { chave:'hospital', nome:'Ambiente hospitalar', familia:'glia', titulo:'Tecnologia pensada para a beira do leito.', sub:'Da UTI à reabilitação.', termos:['hospital icu'], ordem:20 },
    { chave:'equipe', nome:'Equipe e desenvolvimento', familia:'impulso', titulo:'Projetos reais, prazos reais.', sub:'O ritmo de uma empresa.', termos:['coding'], ordem:30 }
  ];
  let n = 0;
  const foto = (banco_id, descricao, tema, tags, extra = {}) => ({ id:'ft' + (++n), banco:'unsplash', banco_id,
    pagina:'https://unsplash.com/photos/' + banco_id, imagem:null, descricao, tema, tags, autor:null, licenca:'Licença Unsplash',
    busca:null, origem:'sugestao', status:'fila', manual:false, votos_sim:0, votos_nao:0, votos_talvez:0, enquadramento:null,
    paleta:null, decidida_em:null, criado_em:'2026-11-01T10:00:00Z', ...extra });
  D.fotos = [
    foto('ct10qdGv1hQ', 'Silhueta de pessoa ao microscópio', 'laboratorio', ['microscópio','pesquisa'], { origem:'link', criado_em:'2026-11-02T09:00:00Z' }),
    foto('lQGJCMY5qcM', 'Três béqueres sobre a bancada', 'laboratorio', ['vidraria','laboratório']),
    foto('J12RfFH-2ZE', 'Treinamento de UTI em simulação', 'hospital', ['UTI','hospital'], { busca:'hospital icu' }),
    foto('lgkareDEqKg', 'Pipeta enchendo microtubos', 'laboratorio', ['pipeta','amostras'], { busca:'pipette', autor:'Nathan Rimoux' }),
    foto('CjgwW0VR3d0', 'Quarto de hospital com leito e monitor', 'hospital', ['monitor','hospital'], { busca:'patient monitor' }),
    foto('Im_cQ6hQo10', 'Pessoas programando em monitores', 'equipe', ['equipe','código'],
      { status:'aprovada', manual:true, imagem:'https://images.unsplash.com/photo-1', autor:'Compagnons', enquadramento:'feed', paleta:'impulso', decidida_em:'2026-11-02T12:00:00Z' }),
    foto('0lrJo37r6Nk', 'Monitor com sinais vitais em verde', 'hospital', ['monitor','sinais vitais','UTI'],
      { status:'aprovada', manual:true, imagem:'https://images.unsplash.com/photo-2', autor:'Jair Lázaro', decidida_em:'2026-11-02T11:00:00Z' }),
    foto('cK0hjNSgnS4', 'Pesquisadora ao microscópio de dissecção', 'laboratorio', ['microscópio','laboratório'],
      { status:'aprovada', manual:true, autor:'NIAID', decidida_em:'2026-11-02T10:00:00Z' }),
    foto('pfAnqlk3Oiw', 'Corredor vazio entre paredes brancas', 'hospital', ['corredor'], { status:'descartada', manual:true })
  ];

  /* as mesmas regras da casca: o teste troca os papéis em state.perfil */
  const admin = () => typeof souAdmin === 'function' ? souAdmin() : true;
  const gestor = () => typeof podeAprovarStudio === 'function' ? podeAprovarStudio() : true;
  const r = d => ({ data:d, error:null });
  const decidir = (ids, st, enq, pal) => {
    let k = 0;
    for (const f of D.fotos) if (ids.includes(f.id)){
      k++; f.status = st; f.manual = st !== 'fila'; f.decidida_em = st === 'fila' ? null : agora();
      if (st === 'fila'){ f.enquadramento = null; f.paleta = null; }
      else if (st === 'aprovada'){ f.enquadramento = enq || f.enquadramento; f.paleta = pal || f.paleta; }
    }
    return k;
  };

  const base = window.supabase.createClient;
  window.supabase.createClient = (...a) => {
    const c = base(...a), rpc = c.rpc;
    c.rpc = async (nome, args) => {
      if (nome === 'fotos_adicionar'){
        rpcs(nome, args);
        if (!admin()) return r({ status:'sem_permissao' });
        let novas = 0, reativadas = 0, repetidas = 0;
        for (const e of args.p_fotos || []){
          const ja = D.fotos.find(f => f.banco === e.banco && f.banco_id === e.banco_id);
          if (ja){ if (ja.status !== 'descartada') repetidas++; else { reativadas++; decidir([ja.id], 'fila'); ja.imagem ||= e.imagem || null; } continue; }
          D.fotos.push(foto(e.banco_id, e.descricao || 'Foto adicionada por link', e.tema || null, e.tags || [],
            { banco:e.banco, pagina:e.pagina || null, imagem:e.imagem || null, autor:e.autor || null, busca:e.busca || null,
              origem:e.origem === 'busca' ? 'busca' : 'link', criado_em:agora() }));
          novas++;
        }
        return r({ status:'ok', novas, reativadas, repetidas });
      }
      if (nome === 'foto_decidir'){
        rpcs(nome, args);
        if (!gestor()) return r({ status:'sem_permissao' });
        if (!['fila','aprovada','descartada'].includes(args.p_status)) return r({ status:'invalido', campo:'status' });
        if (!D.fotos.some(x => x.id === args.p_foto)) return r({ status:'nao_encontrada' });
        decidir([args.p_foto], args.p_status, args.p_enquadramento, args.p_paleta);
        return r({ status:'ok', foto_status:args.p_status });
      }
      if (nome === 'fotos_decidir'){
        rpcs(nome, args);
        if (!gestor()) return r({ status:'sem_permissao' });
        if (!['fila','aprovada','descartada'].includes(args.p_status)) return r({ status:'invalido', campo:'status' });
        if (!args.p_ids?.length) return r({ status:'invalido', campo:'ids' });
        return r({ status:'ok', fotos:decidir(args.p_ids, args.p_status) });
      }
      if (nome === 'foto_status_definir'){
        rpcs(nome, args);
        if (!D.fotos.some(x => x.id === args.p_foto)) return r({ status:'nao_encontrada' });
        decidir([args.p_foto], args.p_status);
        return r({ status:'ok', foto_status:args.p_status });
      }
      if (nome === 'foto_salvar'){
        rpcs(nome, args?.p);
        const p = args?.p || {}, f = D.fotos.find(x => x.id === p.id); if (!f) return r({ status:'nao_encontrada' });
        ['descricao','tema','tags','autor'].forEach(k => { if (k in p) f[k] = p[k]; });
        return r({ status:'ok' });
      }
      if (nome === 'foto_imagem_definir'){
        rpcs(nome, args);
        const f = D.fotos.find(x => x.id === args.p_foto); if (f){ f.imagem = args.p_imagem; f.autor = f.autor || args.p_autor || null; }
        return r({ status:'ok' });
      }
      return rpc(nome, args);
    };
    return c;
  };
})();
