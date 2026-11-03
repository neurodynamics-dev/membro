/* O banco de fotos (2.24.0) no Supabase falso. Vem DEPOIS do
   stub-supabase.js (o teste concatena os dois): põe nos dados de sempre
   (window.__stubDados) os temas, as fotos e os votos, e responde às
   funções fotos_fila, foto_votar, foto_voto_desfazer, fotos_adicionar,
   foto_salvar, foto_imagem_definir e foto_status_definir com as regras
   do banco (aprovada é o voto que diz, com aprovacoes_minimas do
   studio_config). Cada chamada entra em window.__rpcs como { nome, p }.

   A pessoa logada é a Ana (4, admin): entra no Studio e gere. Na fila:
   duas da equipe e três sugestões, em dois temas. Na galeria: três
   aprovadas (com tags e o endereço da imagem) e uma descartada. */
(function(){
  const D = window.__stubDados;
  const agora = () => new Date().toISOString();
  const rpcs = (nome, p) => (window.__rpcs ||= []).push({ nome, p });
  const EU = 4;

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
    foto('ct10qdGv1hQ', 'Silhueta de pessoa ao microscópio', 'laboratorio', ['microscópio','pesquisa'], { origem:'equipe' }),
    foto('lQGJCMY5qcM', 'Três béqueres sobre a bancada', 'laboratorio', ['vidraria','laboratório'], { origem:'equipe' }),
    foto('J12RfFH-2ZE', 'Treinamento de UTI em simulação', 'hospital', ['UTI','hospital'], { busca:'hospital icu' }),
    foto('lgkareDEqKg', 'Pipeta enchendo microtubos', 'laboratorio', ['pipeta','amostras'], { busca:'pipette', autor:'Nathan Rimoux' }),
    foto('CjgwW0VR3d0', 'Quarto de hospital com leito e monitor', 'hospital', ['monitor','hospital'], { busca:'patient monitor' }),
    foto('Im_cQ6hQo10', 'Pessoas programando em monitores', 'equipe', ['equipe','código'],
      { status:'aprovada', votos_sim:1, imagem:'https://images.unsplash.com/photo-1', autor:'Compagnons', enquadramento:'feed', paleta:'impulso', decidida_em:'2026-11-02T12:00:00Z' }),
    foto('0lrJo37r6Nk', 'Monitor com sinais vitais em verde', 'hospital', ['monitor','sinais vitais','UTI'],
      { status:'aprovada', votos_sim:2, imagem:'https://images.unsplash.com/photo-2', autor:'Jair Lázaro', enquadramento:'banda', paleta:'glia', decidida_em:'2026-11-02T11:00:00Z' }),
    foto('cK0hjNSgnS4', 'Pesquisadora ao microscópio de dissecção', 'laboratorio', ['microscópio','laboratório'],
      { status:'aprovada', votos_sim:1, autor:'NIAID', enquadramento:'story', paleta:'nexo', decidida_em:'2026-11-02T10:00:00Z' }),
    foto('pfAnqlk3Oiw', 'Corredor vazio entre paredes brancas', 'hospital', ['corredor'], { status:'descartada', votos_nao:1 })
  ];
  D.foto_votos = [];

  const minimas = () => Math.max(1, D.studio_config?.[0]?.aprovacoes_minimas || 1);
  function recontar(f){
    const vs = D.foto_votos.filter(v => v.foto_id === f.id);
    const c = d => vs.filter(v => v.decisao === d).length;
    f.votos_sim = c('sim'); f.votos_nao = c('nao'); f.votos_talvez = c('talvez');
    const m = minimas(), antes = f.status;
    const st = f.manual ? f.status : f.votos_sim >= m && f.votos_sim > f.votos_nao ? 'aprovada'
      : f.votos_nao >= m && f.votos_nao >= f.votos_sim ? 'descartada' : 'fila';
    f.status = st;
    if (!f.manual){
      const ult = vs.filter(v => v.decisao === 'sim').sort((a, b) => b.criado_em.localeCompare(a.criado_em))[0];
      f.enquadramento = st === 'aprovada' ? ult?.enquadramento || null : null;
      f.paleta = st === 'aprovada' ? ult?.paleta || null : null;
    }
    if (st !== antes) f.decidida_em = st === 'fila' ? null : agora();
    return st;
  }
  const ordem = f => ['link','busca'].includes(f.origem) ? 0 : f.origem === 'equipe' ? 1 : 2;
  const r = d => ({ data:d, error:null });

  const base = window.supabase.createClient;
  window.supabase.createClient = (...a) => {
    const c = base(...a), rpc = c.rpc;
    c.rpc = async (nome, args) => {
      if (nome === 'fotos_fila'){
        rpcs(nome, args);
        const temas = args?.p_temas;
        let fila = D.fotos.filter(f => f.status === 'fila' && (!temas?.length || temas.includes(f.tema))
          && !D.foto_votos.some(v => v.foto_id === f.id && v.registro === EU));
        fila = fila.sort((x, y) => ordem(x) - ordem(y));
        return r({ status:'ok', fotos:fila.slice(0, args?.p_limite || 30).map(f => ({ ...f })), restantes:fila.length, minimas:minimas() });
      }
      if (nome === 'foto_votar'){
        rpcs(nome, args);
        const f = D.fotos.find(x => x.id === args.p_foto); if (!f) return r({ status:'nao_encontrada' });
        if (!['sim','nao','talvez'].includes(args.p_decisao)) return r({ status:'invalido', campo:'decisao' });
        D.foto_votos = D.foto_votos.filter(v => !(v.foto_id === f.id && v.registro === EU));
        D.foto_votos.push({ foto_id:f.id, registro:EU, decisao:args.p_decisao, enquadramento:args.p_enquadramento || null, paleta:args.p_paleta || null, criado_em:agora() });
        return r({ status:'ok', foto_status:recontar(f) });
      }
      if (nome === 'foto_voto_desfazer'){
        rpcs(nome, args);
        const f = D.fotos.find(x => x.id === args.p_foto), antes = D.foto_votos.length;
        D.foto_votos = D.foto_votos.filter(v => !(v.foto_id === args.p_foto && v.registro === EU));
        if (D.foto_votos.length === antes) return r({ status:'sem_voto' });
        return r({ status:'ok', foto_status:recontar(f) });
      }
      if (nome === 'fotos_adicionar'){
        rpcs(nome, args);
        let novas = 0, repetidas = 0;
        for (const e of args.p_fotos || []){
          if (D.fotos.some(f => f.banco === e.banco && f.banco_id === e.banco_id)){ repetidas++; continue; }
          D.fotos.push(foto(e.banco_id, e.descricao || 'Foto adicionada por link', e.tema || null, e.tags || [],
            { banco:e.banco, pagina:e.pagina || null, imagem:e.imagem || null, autor:e.autor || null, busca:e.busca || null,
              origem:e.origem === 'busca' ? 'busca' : 'link', criado_em:agora() }));
          novas++;
        }
        return r({ status:'ok', novas, repetidas });
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
      if (nome === 'foto_status_definir'){
        rpcs(nome, args);
        const f = D.fotos.find(x => x.id === args.p_foto); if (!f) return r({ status:'nao_encontrada' });
        if (args.p_status === 'fila'){ f.manual = false; return r({ status:'ok', foto_status:recontar(f) }); }
        f.manual = true; f.status = args.p_status; f.decidida_em = agora();
        return r({ status:'ok', foto_status:f.status });
      }
      return rpc(nome, args);
    };
    return c;
  };
})();
