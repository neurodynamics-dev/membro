/* ============================================================
   NeuroQuiz · a importação do docx
   Lê o document.xml do .docx (o JSZip abre o arquivo, no editor) e
   devolve as perguntas no formato de quiz_importar, com a revisão:
   o que foi trocado (os membros pelo nome), o que impede a pergunta
   de jogar (problemas) e o que só merece um olhar (avisos).

   O formato que o arquivo segue:
     "30. Pergunta?"               parágrafo numerado, fora de lista
     "A) Alternativa ✅"           itens de lista logo abaixo; ✅ marca a certa
     "👥" no texto                 quem é quem: as alternativas são membros
     "[membro 30]: \"Mensagem...\"" mensagem de WhatsApp, cortada no "..."
     "[membro 30]", "membro 30"    o registro do membro no SOMA
     " ok" no fim                  marca de revisão: sai
     "(…)" no fim da pergunta      observação para quem conduz: vira nota
   Nada aqui adivinha: o que não se resolve fica marcado e a pergunta
   entra desativada, para alguém corrigir no editor.
   ============================================================ */
(function (raiz) {
  'use strict';

  const desxml = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&amp;/g, '&');
  const semAcento = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  /* ---------- 1. os parágrafos ---------------------------- */
  function paragrafos(xml) {
    const out = [];
    for (const m of xml.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)) {
      const p = m[0];
      const estilo = (p.match(/<w:pStyle w:val="([^"]+)"/) || [])[1] || '';
      let t = '';
      for (const r of p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br\/>/g)) t += r[1] !== undefined ? r[1] : ' ';
      out.push({ estilo, lista: /<w:numPr>/.test(p), titulo: /^(T[ií]?tulo|Ttulo|Heading|Title)/i.test(estilo), texto: desxml(t).trim() });
    }
    return out;
  }

  /* ---------- 2. as perguntas, cruas ---------------------- */
  function perguntasCruas(pars) {
    const qs = [];
    for (const p of pars) {
      if (!p.texto || p.titulo) continue;
      const m = !p.lista && p.texto.match(/^(\d+)\.\s+([\s\S]+)$/);
      if (m) { qs.push({ n: +m[1], texto: m[2].trim(), alts: [] }); continue; }
      if (p.lista && qs.length) qs[qs.length - 1].alts.push(p.texto);
    }
    return qs;
  }

  /* ---------- 3. resolver os membros ---------------------- */
  // membros: [{ registro, nome, curto, ativo }]
  function indice(membros) {
    const porReg = new Map(membros.map(m => [m.registro, m]));
    const porPrimeiro = new Map();
    for (const m of membros.filter(x => x.ativo)) {
      const k = semAcento(String(m.nome).split(/\s+/)[0]);
      porPrimeiro.set(k, [...(porPrimeiro.get(k) || []), m]);
    }
    return { porReg, porPrimeiro };
  }
  // um nome solto ("Matheus", "Ana Clara"): só resolve se for um membro ativo só
  function porNome(ix, nome) {
    const partes = semAcento(nome).split(/\s+/).filter(Boolean);
    if (!partes.length) return { erro: 'nome_vazio' };
    let cands = ix.porPrimeiro.get(partes[0]) || [];
    if (partes.length > 1) cands = cands.filter(m => semAcento(m.nome).startsWith(partes.join(' ')) ||
      partes.slice(1).every(p => semAcento(m.nome).split(/\s+/).includes(p)));
    if (cands.length === 1) return { membro: cands[0] };
    return { erro: cands.length ? 'nome_ambiguo' : 'nome_desconhecido' };
  }
  const REF = /\[\s*membro\s*(\d+)\s*(?:,\s*([^\]]*))?\]|\bmembro\s+(\d+)\b|\[([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ]+)?)\]/gi;
  const ARTIGO = /\b(o|a|os|as|do|da|dos|das|no|na|nos|nas|pelo|pela|ao|à|àquele|àquela|um|uma)\s+$/i;

  // troca as referências de um texto pelo nome curto; devolve o texto, as trocas e os problemas
  function trocar(texto, ix, q) {
    const trocas = [];
    const novo = texto.replace(REF, (bruto, reg1, extra, reg2, nome, pos, tudo) => {
      let m = null, motivo = null;
      if (reg1 || reg2) {
        const r = +(reg1 || reg2);
        m = ix.porReg.get(r) || null;
        if (!m) motivo = 'membro_inexistente:' + r;
      } else if (nome) {
        const ch = semAcento(nome);
        if (['primeiro nome', 'apelido', 'nome completo', 'emissor', 'serial number', 'part number'].includes(ch)) return bruto;
        if (/^[A-Z\s]+$/.test(nome) && nome.length > 3) return bruto;   // [EMISSOR], [SERIAL NUMBER]
        const r = porNome(ix, nome);
        if (r.membro) m = r.membro; else motivo = r.erro + ':' + nome;
      }
      if (!m) { q.problemas.add(motivo); return bruto; }
      if (!m.ativo) q.avisos.add('membro_inativo:' + m.registro);
      if (extra) q.avisos.add('colchete_com_comentario:' + extra.trim());
      const antes = tudo.slice(Math.max(0, pos - 12), pos);
      const art = antes.match(ARTIGO);
      if (art) q.avisos.add(`genero:${art[1]} ${m.curto}`);
      trocas.push({ de: bruto, para: m.curto, registro: m.registro });
      return m.curto;
    });
    return { texto: novo, trocas };
  }

  /* ---------- 4. uma pergunta pronta para o banco ---------- */
  function montar(cru, ix) {
    const q = { origem: 'docx:' + cru.n, numero: cru.n, problemas: new Set(), avisos: new Set(), trocas: [] };
    let texto = cru.texto;
    if (/\s+ok\s*$/i.test(texto)) { texto = texto.replace(/\s+ok\s*$/i, ''); q.okRemovido = true; }
    let tipo = 'classica';
    if (texto.includes('👥')) { tipo = 'quem'; texto = texto.replace(/👥\s*/g, ''); }
    const zap = texto.match(/^\[([^\]]+)\](?:\s+no grupo)?\s*:\s*["“]([\s\S]*?)["”]?\s*$/);
    if (tipo === 'classica' && zap) tipo = 'whatsapp';
    const nota = tipo !== 'whatsapp' && texto.match(/^([\s\S]*?[?:!.])\s*\(([^()]+)\)\s*$/);
    if (nota) { texto = nota[1].trim(); q.nota = nota[2].trim(); }
    if (/kahoot/i.test(texto) || cru.alts.some(a => /kahoot/i.test(a))) q.avisos.add('kahoot_trocado');
    const kahoot = s => s.replace(/kahoot/gi, 'NeuroQuiz');

    q.tipo = tipo;
    q.tempo_s = 8; q.pontos = 1000; q.extra = {};
    if (tipo === 'whatsapp') {
      const quem = zap[1].trim();
      const r = /^membro\s*(\d+)$/i.test(quem) ? { membro: ix.porReg.get(+quem.match(/\d+/)[0]) } : porNome(ix, quem);
      if (r.membro) { q.autor_registro = r.membro.registro; q.autor = r.membro;
        if (!r.membro.ativo) q.avisos.add('membro_inativo:' + r.membro.registro); }
      else q.problemas.add((r.erro || 'membro_inexistente') + ':' + quem);
      const msg = trocar(kahoot(zap[2].replace(/\.\.\.|…/g, '…').trim()), ix, q);
      q.mensagem = msg.texto.endsWith('…') ? msg.texto : msg.texto + '…';
      q.trocas.push(...msg.trocas);
      q.texto = 'Complete a mensagem';
    } else {
      const t = trocar(kahoot(texto), ix, q);
      q.texto = t.texto; q.trocas.push(...t.trocas);
    }

    q.alternativas = cru.alts.slice(0, 4).map(bruta => {
      let a = bruta.replace(/\s+ok\s*$/i, '');
      const correta = /✅|✔/.test(a);
      a = a.replace(/[✅✔]️?/g, '').replace(/^[A-D]\)\s*/, '').trim();
      if (tipo === 'quem') {
        const m1 = a.match(/^\[?\s*membro\s*(\d+)\s*\]?$/i);
        const r = m1 ? (ix.porReg.get(+m1[1]) ? { membro: ix.porReg.get(+m1[1]) } : { erro: 'membro_inexistente', alvo: m1[1] })
                     : porNome(ix, a.replace(/[[\]]/g, ''));
        if (r.membro) { if (!r.membro.ativo) q.avisos.add('membro_inativo:' + r.membro.registro);
          q.trocas.push({ de: a, para: r.membro.curto, registro: r.membro.registro });
          return { registro: r.membro.registro, texto: null, correta, membro: r.membro }; }
        q.problemas.add((r.erro || 'membro_inexistente') + ':' + (r.alvo || a));
        return { registro: null, texto: null, correta, original: a };
      }
      // os marcadores de nome da mensagem: o primeiro nome e o nome completo saem do autor
      if (tipo === 'whatsapp' && q.autor) {
        a = a.replace(/\[primeiro nome\]/i, String(q.autor.nome).split(/\s+/)[0]).replace(/\[nome completo\]/i, q.autor.nome);
      }
      const t = trocar(kahoot(a), ix, q);
      q.trocas.push(...t.trocas);
      if (/\[(apelido|primeiro nome|nome completo)\]/i.test(t.texto)) q.problemas.add('marcador:' + t.texto);
      return { texto: t.texto, registro: null, correta };
    });
    if (cru.alts.length > 4) q.problemas.add('mais_de_4_alternativas');
    if (q.alternativas.length < 2) q.problemas.add('sem_alternativas');
    const nCertas = q.alternativas.filter(a => a.correta).length;
    if (q.alternativas.length >= 2 && !nCertas) q.problemas.add('sem_correta');
    if (nCertas > 1) q.avisos.add('corretas:' + nCertas);
    const chaves = q.alternativas.map(a => a.registro != null ? 'r' + a.registro : String(a.texto || '').trim());   // maiúscula conta: NeuroDynamics ≠ Neurodynamics
    if (new Set(chaves).size < chaves.length) q.avisos.add('alternativas_iguais');
    q.problemas = [...q.problemas]; q.avisos = [...q.avisos];
    return q;
  }

  // o que vai para quiz_importar
  const paraBanco = q => ({
    tipo: q.tipo, texto: q.texto, autor_registro: q.autor_registro ?? null, mensagem: q.mensagem ?? null,
    extra: q.extra || {}, tempo_s: q.tempo_s, pontos: q.pontos, nota: q.nota ?? null, origem: q.origem,
    ativa: !q.problemas.length,
    alternativas: q.alternativas.map(a => ({ texto: a.texto, registro: a.registro, correta: a.correta }))
  });

  /* ---------- 5. as mensagens da revisão ------------------ */
  function explicar(cod) {
    const [k, ...r] = String(cod).split(':'); const v = r.join(':');
    return ({
      membro_inexistente: `O registro ${v} não existe no SOMA.`,
      nome_desconhecido: `"${v}" não corresponde a nenhum membro ativo.`,
      nome_ambiguo: `"${v}" corresponde a mais de um membro: escolha no editor.`,
      membro_inativo: `O membro ${v} não está ativo no SOMA (desligado ou egresso).`,
      colchete_com_comentario: `O comentário entre colchetes saiu do texto: "${v}".`,
      genero: `Confira o gênero: "${v}".`,
      kahoot_trocado: 'Troquei "Kahoot" por "NeuroQuiz".',
      corretas: `${v} alternativas certas: todas valem.`,
      alternativas_iguais: 'Há alternativas iguais.',
      sem_correta: 'Nenhuma alternativa marcada como certa.',
      sem_alternativas: 'Menos de duas alternativas.',
      mais_de_4_alternativas: 'Mais de quatro alternativas: só as quatro primeiras entram.',
      marcador: `Falta preencher: "${v}".`,
      nome_vazio: 'Nome vazio.'
    })[k] || cod;
  }

  async function lerDocx(arquivo, JSZip) {
    const zip = await JSZip.loadAsync(arquivo);
    const doc = zip.file('word/document.xml');
    if (!doc) throw new Error('Este arquivo não parece um .docx do Word.');
    return perguntasCruas(paragrafos(await doc.async('string')));
  }
  function revisar(cruas, membros) {
    const ix = indice(membros);
    return cruas.map(c => montar(c, ix));
  }

  const api = { paragrafos, perguntasCruas, revisar, paraBanco, explicar, lerDocx };
  if (typeof module === 'object' && module.exports) module.exports = api; else raiz.NQImport = api;
})(typeof window !== 'undefined' ? window : globalThis);
