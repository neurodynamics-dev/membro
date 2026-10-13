/* ============================================================
   2.19.2: Relações institucionais › Financiamento — os editais e o
   acompanhamento de cada submissão. Só NRO_RELAC e NRO_COORD_OFFICE.
     #/ri/financiamento            os editais (cartões, por situação)
     #/ri/financiamento/importar   colar ou abrir um .md e ver o cartão antes de criar
     #/ri/financiamento/<id>       o cartão de um edital: prazo, cronograma,
                                   checklist, arranjo, descrição
   Cada edital nasce de um texto em Markdown, do jeito dos Treinamentos e do
   Studio: um agente (ou alguém) lê o edital e escreve no formato abaixo
   (FIN_README); o portal monta o cartão. "Editar texto" devolve o mesmo
   formato, com o que já foi marcado. O banco é db/2.19.2_ri.sql (ri_edital_*).
   ============================================================ */
const FIN_TIPOS = [['pesquisa', 'Pesquisa'], ['inovacao', 'Inovação'], ['subvencao', 'Subvenção econômica'], ['bolsa', 'Bolsas'],
  ['infraestrutura', 'Infraestrutura e equipamentos'], ['evento', 'Eventos'], ['premio', 'Prêmio'], ['aceleracao', 'Aceleração'], ['outro', 'Outro']];
const FIN_STATUS = [['radar', 'No radar'], ['avaliando', 'Avaliando'], ['preparando', 'Preparando a proposta'], ['submetido', 'Submetido'],
  ['aprovado', 'Aprovado'], ['nao_aprovado', 'Não aprovado'], ['execucao', 'Em execução'], ['prestacao', 'Prestação de contas'],
  ['encerrado', 'Encerrado'], ['descartado', 'Não vamos submeter']];
const FIN_PROPONENTES = [['coordenador', 'O coordenador'], ['fundacao', 'A fundação de apoio'], ['ufmg', 'A UFMG (pró-reitoria ou CTIT)'],
  ['outro_grupo', 'O coordenador de outro grupo'], ['empresa', 'A empresa parceira'], ['nro', 'A NeuroDynamics'], ['outro', 'Outro']];
const FIN_GRUPOS = [
  ['Em aberto', ['radar', 'avaliando', 'preparando']],
  ['Submetidos', ['submetido']],
  ['Aprovados e em execução', ['aprovado', 'execucao', 'prestacao']],
  ['Encerrados', ['encerrado', 'nao_aprovado', 'descartado']]];
const finRot = (l, k) => (l.find(x => x[0] === k) || [k, k])[1];
const finMoeda = v => v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style:'currency', currency:'BRL', maximumFractionDigits:0 });
const finDias = d => d ? Math.round((new Date(d + 'T12:00:00') - new Date(hojeISO() + 'T12:00:00')) / 864e5) : null;
const FIN = { lista:null, equipe:[], f:{ q:'', status:'', financiador:'' } };

/* ---------- o formato de texto (o que o agente escreve e o portal lê) ---------- */
const FIN_README = `# Editais no SOMA: o formato do texto

Guia para transformar um edital de financiamento num cartão de **Relações institucionais › Financiamento**. Vale para quem escreve à mão e, principalmente, para agentes de IA: entregue este arquivo junto com o edital (PDF ou link). O texto que voltar é colado em **Financiamento › Importar edital**; o portal mostra o cartão antes de criar.

## Quem somos

A NeuroDynamics é uma iniciativa sem fins lucrativos de pesquisa e desenvolvimento em tecnologia para a saúde (engenharia biomédica, reabilitação, dispositivos médicos, sinais biomédicos), formada por estudantes da Escola de Engenharia da UFMG e sediada no LABBIO. Muitas vezes não submetemos em nome próprio: quem submete pode ser o professor coordenador, a fundação de apoio da universidade, a própria UFMG ou o coordenador de outro grupo de pesquisa.

## A estrutura

\`\`\`
---
titulo: Programa Centelha 3 MG
financiador: FAPEMIG
chamada: Chamada 05/2026
link: https://...
tipo: inovacao
situacao: avaliando
valor_maximo: R$ 80.000
contrapartida: 5% em economia
abertura: 01/10/2026
prazo: 30/11/2026
resultado: 15/02/2027
duracao_meses: 12
proponente: fundacao
responsavel_submissao: FUNDEP, com o prof. coordenador como responsável técnico
pela_ufmg: sim
outro_grupo: não
empresa: não
temas: Saúde, Dispositivos médicos, Inovação
---

Um parágrafo de resumo: o que o edital financia e por que interessa à NRO.

## Cronograma
- 01/10/2026: Abertura das inscrições
- 30/11/2026: Submissão da proposta, até 17h
- 15/02/2027: Resultado final

## Checklist
- [ ] Carta de anuência da UFMG
- [ ] Plano de trabalho
- [ ] Orçamento detalhado
- [ ] Cadastro do coordenador na plataforma

## Arranjo
- Exige CNPJ: não
- TRL mínimo: 3
- Contrapartida obrigatória: sim, 5%
- Pode ter bolsista de graduação: sim

## Elegibilidade
...

## O que financia
...

## Critérios de avaliação
...
\`\`\`

## O cabeçalho

| Campo | O que pôr |
|---|---|
| titulo | o nome do programa ou da chamada (obrigatório) |
| financiador | quem paga: FAPEMIG, CNPq, FINEP, CAPES, EMBRAPII, BNDES, uma empresa, uma fundação privada... |
| chamada | o número ou o nome oficial da chamada |
| link | a página oficial do edital (https) |
| tipo | pesquisa, inovacao, subvencao, bolsa, infraestrutura, evento, premio, aceleracao ou outro |
| situacao | radar, avaliando, preparando, submetido, aprovado, nao_aprovado, execucao, prestacao, encerrado ou descartado (em dúvida, radar) |
| valor_maximo | o teto por proposta, em reais |
| contrapartida | se exige, quanto e de que tipo |
| abertura, prazo, resultado | datas (dd/mm/aaaa); prazo é o fim da submissão |
| duracao_meses | a duração do projeto financiado |
| proponente | quem submete: coordenador, fundacao, ufmg, outro_grupo, empresa, nro ou outro |
| responsavel_submissao | quem, de fato, envia (nome do órgão ou da pessoa) |
| pela_ufmg | sim ou não: a submissão passa pela universidade? |
| outro_grupo | o grupo de pesquisa parceiro, ou não |
| empresa | a empresa envolvida, ou não |
| temas | áreas e linhas temáticas, separadas por vírgula |

## As seções

- **Cronograma**: uma etapa por linha, \`- dd/mm/aaaa: etapa\`. Inclua as etapas internas que o edital pede (anuência, assinatura da fundação) com a data-limite que faz sentido.
- **Checklist**: tudo o que precisa ser providenciado, \`- [ ] item\`. Documentos, cadastros, cartas, assinaturas.
- **Arranjo**: as regras que mudam de edital para edital, \`- Regra: valor\`. Ex.: exige CNPJ, TRL mínimo, quantos coordenadores, se aceita bolsista, se a empresa precisa ser de MG.
- Qualquer outra seção (\`## Elegibilidade\`, \`## O que financia\`, \`## Critérios de avaliação\`, \`## Itens não financiáveis\`) vira a descrição do cartão.

## Regras

- Copie números, datas e nomes exatamente como estão no edital. Não invente: o que o edital não diz fica de fora.
- Datas em dd/mm/aaaa. Valores em reais.
- Português do Brasil, frases curtas, sem emoji.
- A resposta é **só o texto**, começando pelo \`---\` do cabeçalho.
`;
const FIN_PEDIDO = `Você vai transformar um edital de financiamento num cartão do portal da NeuroDynamics.
Siga à risca o README anexo (README-editais.md): o cabeçalho, as seções Cronograma, Checklist e Arranjo, e as regras.

Edital: [anexe o PDF ou cole o link]
O que já sabemos do nosso arranjo: [ex.: submissão pela FUNDEP, com o prof. X; parceria com o grupo Y]

Devolva só o texto, em Markdown, começando pelo cabeçalho entre --- e ---.`;

function finData(v){
  const t = String(v || '').trim();
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m){ const a = m[3].length === 2 ? '20' + m[3] : m[3]; return `${a}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`; }
  return null;
}
function finValor(v){
  let t = norm(v).replace(/r\$|\s/g, '');
  if (!t || /^(nao|sem|-|—)/.test(t)) return null;
  let mult = 1;
  if (/mil$/.test(t)){ mult = 1e3; t = t.replace(/mil$/, ''); }
  else if (/(mi|milhao|milhoes|mm)$/.test(t)){ mult = 1e6; t = t.replace(/(mi|milhao|milhoes|mm)$/, ''); }
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isFinite(n) ? Math.round(n * mult * 100) / 100 : undefined;
}
function finSimNao(v){
  const t = norm(v);
  if (/^(sim|s|yes|true|verdadeiro|obrigatori)/.test(t)) return true;
  if (/^(nao|n|no|false|falso|-)$/.test(t) || /^nao\b/.test(t)) return false;
  return undefined;
}
function finProponente(v){
  const t = norm(v);
  if (FIN_PROPONENTES.some(x => x[0] === t)) return t;
  if (/fund|fundep/.test(t)) return 'fundacao';
  if (/outro.*grupo|grupo/.test(t)) return 'outro_grupo';
  if (/ufmg|universidade|pro-?reitoria|prpq|ctit/.test(t)) return 'ufmg';
  if (/empresa/.test(t)) return 'empresa';
  if (/coorden|professor|prof/.test(t)) return 'coordenador';
  if (/nro|neurodynamics/.test(t)) return 'nro';
  return 'outro';
}
/* lê o texto e devolve { p, avisos }: nunca quebra, o que não entende vira aviso */
function finLerTexto(bruto){
  const avisos = [], p = { temas:[], arranjo:[], cronograma:[], checklist:[] };
  let txt = String(bruto || '').replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const cercado = txt.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i); if (cercado) txt = cercado[1].trim();
  const fm = txt.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  const nomes = { contatos:[], equipe:[] };
  if (fm){
    txt = txt.slice(fm[0].length);
    fm[1].split('\n').forEach(l => {
      const m = l.match(/^\s*([^:#]+?)\s*:\s*(.*?)\s*$/); if (!m) return;
      const k = norm(m[1]).replace(/[\s-]+/g, '_'), v = m[2].replace(/^["']|["']$/g, '').trim();
      if (!v) return;
      const data = campo => { const d = finData(v); if (d) p[campo] = d; else avisos.push(`Data "${v}" (${m[1]}) não reconhecida: use dd/mm/aaaa.`); };
      const valor = campo => { const n = finValor(v); if (n === undefined) avisos.push(`Valor "${v}" (${m[1]}) não reconhecido.`); else if (n != null) p[campo] = n; };
      if (['titulo', 'title', 'nome', 'programa'].includes(k)) p.titulo = v;
      else if (['financiador', 'agencia', 'financiadora', 'entidade', 'fomento'].includes(k)) p.financiador = v;
      else if (['chamada', 'numero', 'edital'].includes(k)) p.chamada = v;
      else if (['link', 'url', 'pagina', 'site'].includes(k)){ if (/^https?:\/\//i.test(v)) p.link = v; else avisos.push(`O link "${v}" precisa começar por https://.`); }
      else if (k === 'tipo'){ const t = FIN_TIPOS.find(x => x[0] === norm(v) || norm(x[1]) === norm(v)); if (t) p.tipo = t[0]; else { p.tipo = 'outro'; avisos.push(`Tipo "${v}" não reconhecido: ficou "Outro".`); } }
      else if (['situacao', 'status', 'estagio'].includes(k)){ const s = FIN_STATUS.find(x => x[0] === norm(v).replace(/\s+/g, '_') || norm(x[1]) === norm(v)); if (s) p.status = s[0]; else avisos.push(`Situação "${v}" não reconhecida: ficou "No radar".`); }
      else if (['valor_maximo', 'teto', 'valor', 'valor_max'].includes(k)) valor('valor_maximo');
      else if (k === 'valor_solicitado') valor('valor_solicitado');
      else if (k === 'valor_aprovado') valor('valor_aprovado');
      else if (k === 'contrapartida') p.contrapartida = v;
      else if (k === 'abertura') data('abertura');
      else if (['prazo', 'submissao', 'prazo_submissao', 'encerramento', 'data_limite'].includes(k)) data('prazo');
      else if (['resultado', 'resultado_previsto'].includes(k)) data('resultado');
      else if (['duracao_meses', 'duracao', 'vigencia'].includes(k)){ const n = parseInt(v, 10); if (n > 0 && n <= 240) p.duracao_meses = n; else avisos.push(`Duração "${v}" não reconhecida: use meses.`); }
      else if (['proponente', 'quem_submete', 'submissao_por'].includes(k)){ p.proponente = finProponente(v); if (p.proponente === 'outro') avisos.push(`Proponente "${v}" ficou como "Outro".`); }
      else if (['responsavel_submissao', 'quem_envia', 'submetido_por'].includes(k)) p.responsavel_submissao = v;
      else if (['pela_ufmg', 'submissao_pela_ufmg', 'ufmg'].includes(k)){ const b = finSimNao(v); if (b === undefined) avisos.push(`"pela_ufmg: ${v}": use sim ou não.`); else p.pela_ufmg = b; }
      else if (['outro_grupo', 'grupo_parceiro', 'grupo'].includes(k)){ if (finSimNao(v) !== false) p.outro_grupo = v; }
      else if (['empresa', 'empresa_parceira'].includes(k)){ if (finSimNao(v) !== false) p.empresa = v; }
      else if (['temas', 'areas', 'linhas', 'tags'].includes(k)) p.temas = v.split(/[,;]/).map(x => x.trim()).filter(Boolean);
      else if (['responsavel', 'responsavel_nro'].includes(k)) nomes.responsavel = v;
      else if (k === 'contatos') nomes.contatos = v.split(/[,;]/).map(x => x.trim()).filter(Boolean);
      else if (k === 'equipe') nomes.equipe = v.split(/[,;]/).map(x => x.trim()).filter(Boolean);
      else avisos.push(`Campo "${m[1]}" do cabeçalho não é conhecido; foi para o Arranjo.`), p.arranjo.push({ rotulo:m[1].trim(), valor:v });
    });
  } else avisos.push('Sem cabeçalho entre linhas ---: os campos (financiador, prazo...) ficaram vazios.');
  /* as seções */
  const L = txt.split('\n'), corpo = [], resumo = [];
  let secao = null;
  for (const l of L){
    const h = l.match(/^##\s+(.+?)\s*$/);
    if (h){
      const n = norm(h[1]);
      secao = /^cronograma|^prazos|^datas/.test(n) ? 'cronograma' : /^checklist|^documentos|^pendencias|^a fazer/.test(n) ? 'checklist'
        : /^arranjo|^condicoes|^regras|^configuracao/.test(n) ? 'arranjo' : /^resumo/.test(n) ? 'resumo' : 'corpo';
      if (secao === 'corpo') corpo.push(l);
      continue;
    }
    if (/^#\s+/.test(l) && !p.titulo){ p.titulo = l.replace(/^#\s+/, '').trim(); continue; }
    if (secao === null || secao === 'resumo'){ resumo.push(l); continue; }
    if (secao === 'corpo'){ corpo.push(l); continue; }
    const it = l.match(/^\s*[-*]\s+(?:\[( |x|X)\]\s*)?(.+)$/); if (!it) continue;
    const feito = /x/i.test(it[1] || ''), t = it[2].trim();
    if (secao === 'checklist') p.checklist.push({ item:t, feito });
    else if (secao === 'arranjo'){ const m = t.match(/^\**(.+?)\**\s*:\s*(.*)$/); p.arranjo.push(m ? { rotulo:m[1].trim(), valor:m[2].trim() } : { rotulo:t, valor:'' }); }
    else {
      const m = t.match(/^\**([\d/-]{6,10})\**\s*[:–—-]\s*(.+)$/) || t.match(/^(.+?)\s*\(([\d/-]{6,10})\)\s*$/);
      if (m){ const [d, e] = /^[\d/-]+$/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]]; const dd = finData(d);
        if (!dd) avisos.push(`Data "${d}" do cronograma não reconhecida.`); p.cronograma.push({ data:dd, etapa:e.trim(), feito }); }
      else p.cronograma.push({ data:null, etapa:t, feito });
    }
  }
  p.resumo = resumo.join('\n').trim().slice(0, 1200) || null;
  p.corpo = corpo.join('\n').trim() || null;
  p.cronograma.sort((a, b) => (a.data || '9999').localeCompare(b.data || '9999'));
  if (!p.titulo) avisos.unshift('Falta o título: ponha "titulo:" no cabeçalho.');
  if (!p.prazo) avisos.push('Sem prazo de submissão ("prazo:"): o cartão não vai contar os dias.');
  if (!p.checklist.length) avisos.push('Sem "## Checklist": nada para acompanhar ainda.');
  /* nomes que viram ligações: o responsável e a equipe (membros), os contatos (Conexões) */
  if (nomes.responsavel){ const m = (state.membros || []).find(x => norm(x.nome).includes(norm(nomes.responsavel))); if (m) p.responsavel = m.registro; else avisos.push(`Responsável "${nomes.responsavel}" não é um membro.`); }
  p.equipe = nomes.equipe.map(n => (state.membros || []).find(x => norm(x.nome).includes(norm(n)))?.registro).filter(Boolean);
  if (p.equipe.length < nomes.equipe.length) avisos.push('Alguém da equipe não foi achado entre os membros.');
  const contatos = typeof RI !== 'undefined' && RI.d ? RI.d.contatos : [];
  p.contatos = nomes.contatos.map(n => contatos.find(c => norm(c.nome) === norm(n))?.id).filter(Boolean);
  if (p.contatos.length < nomes.contatos.length) avisos.push('Algum contato não está em Conexões; cadastre-o e ligue depois.');
  if (p.financiador){ const o = contatos.find(c => c.natureza === 'organizacao' && norm(c.nome) === norm(p.financiador)); if (o) p.financiador_id = o.id; }
  return { p, avisos };
}
/* o caminho de volta: o cartão em texto, já com o que foi marcado */
function finParaTexto(e){
  const d = x => x ? x.split('-').reverse().join('/') : '';
  const s = (k, v) => v == null || v === '' ? '' : `${k}: ${v}\n`;
  const sn = v => v == null ? '' : v ? 'sim' : 'não';
  return `---\n${s('titulo', e.titulo)}${s('financiador', e.financiador)}${s('chamada', e.chamada)}${s('link', e.link)}${s('tipo', e.tipo)}${s('situacao', e.status)}`
    + `${s('valor_maximo', e.valor_maximo)}${s('valor_solicitado', e.valor_solicitado)}${s('valor_aprovado', e.valor_aprovado)}${s('contrapartida', e.contrapartida)}`
    + `${s('abertura', d(e.abertura))}${s('prazo', d(e.prazo))}${s('resultado', d(e.resultado))}${s('duracao_meses', e.duracao_meses)}`
    + `${s('proponente', e.proponente)}${s('responsavel_submissao', e.responsavel_submissao)}${s('pela_ufmg', sn(e.pela_ufmg))}`
    + `${s('outro_grupo', e.outro_grupo || 'não')}${s('empresa', e.empresa || 'não')}${s('temas', (e.temas || []).join(', '))}`
    + `${s('responsavel', e.responsavel_nome)}${s('equipe', (e.equipe_nomes || []).map(m => m.nome).join(', '))}${s('contatos', (e.contatos_lista || []).map(c => c.nome).join(', '))}---\n\n`
    + (e.resumo ? e.resumo + '\n\n' : '')
    + `## Cronograma\n${(e.cronograma || []).map(c => `- ${c.feito ? '[x] ' : ''}${c.data ? d(c.data) + ': ' : ''}${c.etapa}`).join('\n')}\n\n`
    + `## Checklist\n${(e.checklist || []).map(c => `- [${c.feito ? 'x' : ' '}] ${c.item}`).join('\n')}\n\n`
    + `## Arranjo\n${(e.arranjo || []).map(a => `- ${a.rotulo}: ${a.valor}`).join('\n')}\n\n`
    + (e.corpo ? e.corpo + '\n' : '');
}
function finBaixar(nome, texto){
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([texto], { type:'text/markdown;charset=utf-8' })); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/* ---------- a rota ---------- */
async function pageRIFin(sub){
  if (sub === 'importar') return finImportar();
  if (/^\d+$/.test(sub || '')) return finEdital(+sub);
  return finLista();
}
const finCab = (x = {}) => cabecalho({ espaco:'Relações institucionais', titulo:'Financiamento', voltar:['Relações institucionais', '#/ri'], ...x });

/* ---------- a lista: cartões por situação ---------- */
async function finLista(){
  $('#main').innerHTML = finCab() + estado.carregando();
  const { data, error } = await sb.rpc('ri_editais_listar');
  if (error || data?.status !== 'ok') return data?.status === 'sem_permissao' ? riSemPermissao() : riErro(error || { message:data?.status });
  FIN.lista = data.editais; FIN.equipe = data.equipe;
  const financiadores = [...new Set(FIN.lista.map(e => e.financiador).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt'));
  $('#main').innerHTML = finCab({ lead:'Editais de financiamento e o acompanhamento de cada submissão: prazos, cronograma, checklist e o arranjo de cada um.',
      acoes:`<a class="btn ghost" href="#/ri/financiamento/importar" id="fin-importar">${ic('doc')} Importar edital</a>` }) + `
    <div class="ri-barra">
      <div class="fld busca ri-q"><label for="fin-q" class="sr">Buscar</label><input id="fin-q" type="search" placeholder="Buscar por título, financiador ou tema" autocomplete="off" value="${esc(FIN.f.q)}"></div>
      <div class="fld"><label for="fin-fin" class="sr">Financiador</label><select id="fin-fin"><option value="">Todos os financiadores</option>${financiadores.map(f => `<option${FIN.f.financiador === f ? ' selected' : ''}>${esc(f)}</option>`).join('')}</select></div>
      <span class="ri-total" id="fin-total"></span>
    </div>
    <div id="fin-grupos"></div>`;
  $('#fin-q').addEventListener('input', e => { FIN.f.q = e.target.value; finDesenharLista(); });
  $('#fin-fin').addEventListener('change', e => { FIN.f.financiador = e.target.value; finDesenharLista(); });
  finDesenharLista();
}
function finDesenharLista(){
  const q = norm(FIN.f.q);
  const l = FIN.lista.filter(e => (!FIN.f.financiador || e.financiador === FIN.f.financiador)
    && (!q || [e.titulo, e.financiador, e.chamada, e.codigo, ...(e.temas || [])].some(x => norm(x).includes(q))));
  $('#fin-total').innerHTML = `<b>${l.length}</b> de ${FIN.lista.length}`;
  if (!FIN.lista.length){
    $('#fin-grupos').innerHTML = estado.vazio({ texto:'Nenhum edital ainda. Importe o primeiro a partir de um texto em Markdown.',
      acao:'<a class="btn ghost mini" href="#/ri/financiamento/importar">Importar edital</a>' }); return;
  }
  $('#fin-grupos').innerHTML = FIN_GRUPOS.map(([t, sts]) => {
    const g = l.filter(e => sts.includes(e.status)); if (!g.length) return '';
    return `<h2 class="srv-bloco">${t} <span class="n">${g.length}</span></h2><div class="fin-cards">${g.map(finCartao).join('')}</div>`;
  }).join('') || estado.vazio({ texto:'Nenhum edital passa nesse filtro.' });
}
function finPrazo(e){
  const n = finDias(e.prazo);
  if (n == null) return '<span class="dim">Sem prazo</span>';
  if (!['radar', 'avaliando', 'preparando'].includes(e.status)) return `<span class="dim">Prazo ${fmtD(e.prazo)}</span>`;
  if (n < 0) return `<span class="fin-prazo passou">Prazo passou (${fmtD(e.prazo)})</span>`;
  return `<span class="fin-prazo${n <= 7 ? ' urgente' : n <= 30 ? ' perto' : ''}">${n === 0 ? 'Prazo hoje' : n === 1 ? 'Falta 1 dia' : `Faltam ${n} dias`}</span> <span class="dim">${fmtD(e.prazo)}</span>`;
}
function finCartao(e){
  const pct = e.checklist_total ? Math.round(e.checklist_feitos / e.checklist_total * 100) : 0;
  return `<a class="fin-card" href="#/ri/financiamento/${e.id}">
    <span class="fin-card-cab"><span class="fin-cod">${esc(e.codigo || '')}</span><span class="pill fin-st ${e.status}">${esc(finRot(FIN_STATUS, e.status))}</span></span>
    <b class="fin-tit">${esc(e.titulo)}</b>
    <span class="sub">${esc([e.financiador, finRot(FIN_TIPOS, e.tipo)].filter(Boolean).join(', '))}</span>
    <span class="fin-linha">${finPrazo(e)}</span>
    ${e.valor_maximo ? `<span class="fin-linha"><span class="dim">Até</span> ${finMoeda(e.valor_maximo)}</span>` : ''}
    <span class="fin-linha"><span class="dim">Submete:</span> ${esc(e.responsavel_submissao || finRot(FIN_PROPONENTES, e.proponente))}</span>
    ${e.proxima_etapa ? `<span class="fin-linha"><span class="dim">Próxima etapa:</span> ${esc(e.proxima_etapa.etapa)}, ${fmtD(e.proxima_etapa.data)}</span>` : ''}
    ${e.checklist_total ? `<span class="fin-prog" role="img" aria-label="Checklist: ${e.checklist_feitos} de ${e.checklist_total}"><i style="width:${pct}%"></i></span>
      <span class="fin-linha dim">Checklist ${e.checklist_feitos} de ${e.checklist_total}</span>` : ''}
  </a>`;
}

/* ---------- importar: colar ou abrir o .md, ver o cartão, criar ---------- */
async function finImportar(){
  const voltar = ['Financiamento', '#/ri/financiamento'];
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Importar edital', voltar }) + estado.carregando();
  try { await riCarregar(); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Importar edital', voltar,
      lead:'Cole o texto do edital no formato do SOMA (ou abra um arquivo .md). O cartão aparece ao lado, com os avisos, antes de criar.' }) + `
    <div class="card fin-agente">
      <div><b>Peça a um agente de IA.</b> Entregue o README junto com o edital (PDF ou link) e o pedido abaixo; cole aqui o texto que voltar.</div>
      <div class="fin-agente-bts"><button type="button" class="btn ghost mini" id="fin-readme">${ic('doc')} Baixar o README</button>
        <button type="button" class="btn ghost mini" id="fin-pedido">${ic('copy')} Copiar o pedido</button></div>
    </div>
    <div class="fin-imp">
      <div class="fin-imp-txt">
        <div class="fld"><label for="fin-texto">Texto do edital</label>
          <label class="btn ghost mini fin-abrir">${ic('doc')} Abrir arquivo .md<input type="file" id="fin-arq" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden></label>
          <textarea id="fin-texto" rows="24" spellcheck="false" placeholder="---&#10;titulo: …&#10;financiador: …&#10;prazo: dd/mm/aaaa&#10;---&#10;&#10;## Cronograma&#10;- dd/mm/aaaa: …&#10;&#10;## Checklist&#10;- [ ] …"></textarea></div>
      </div>
      <div class="fin-imp-prev" id="fin-prev"><p class="dim">O cartão aparece aqui.</p></div>
    </div>
    <p class="aviso-box err" id="fin-erro" hidden></p>
    <div class="ri-form-pe"><span></span><button type="button" class="btn solid" id="fin-criar" disabled>Criar o edital</button></div>`;
  const ler = () => finPrevia($('#fin-texto').value);
  $('#fin-texto').addEventListener('input', ler);
  $('#fin-arq').addEventListener('change', async e => { const f = e.target.files?.[0]; if (!f) return; $('#fin-texto').value = await f.text(); ler(); });
  $('#fin-readme').addEventListener('click', () => finBaixar('README-editais.md', FIN_README));
  $('#fin-pedido').addEventListener('click', () => { navigator.clipboard?.writeText(FIN_PEDIDO); toast('Pedido copiado. Anexe o README e o edital.'); });
  $('#fin-criar').addEventListener('click', async () => {
    const texto = $('#fin-texto').value, { p } = finLerTexto(texto);
    if (!p.titulo) return;
    p.fonte_md = texto;
    $('#fin-criar').disabled = true;
    const { data, error } = await sb.rpc('ri_edital_salvar', { p });
    if (error || data?.status !== 'ok'){ $('#fin-criar').disabled = false; $('#fin-erro').textContent = 'Não foi possível criar' + (data?.campo ? ': confira "' + data.campo + '"' : '') + '.'; $('#fin-erro').hidden = false; return; }
    toast('Edital criado.'); location.replace('#/ri/financiamento/' + data.id);
  });
}
function finPrevia(texto){
  const prev = $('#fin-prev');
  if (!texto.trim()){ prev.innerHTML = '<p class="dim">O cartão aparece aqui.</p>'; $('#fin-criar').disabled = true; return; }
  const { p, avisos } = finLerTexto(texto);
  const e = { ...p, codigo:'novo', status:p.status || 'radar', proponente:p.proponente || 'coordenador', tipo:p.tipo || 'pesquisa',
    checklist_total:p.checklist.length, checklist_feitos:p.checklist.filter(c => c.feito).length,
    proxima_etapa:p.cronograma.find(c => !c.feito && c.data) || null };
  prev.innerHTML = `${avisos.length ? `<div class="aviso-box warn"><b>${avisos.length} ${avisos.length === 1 ? 'aviso' : 'avisos'}</b><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : '<div class="aviso-box ok">Texto lido sem avisos.</div>'}
    ${p.titulo ? `<div class="fin-cards um">${finCartao(e).replace('<a class="fin-card" href', '<div class="fin-card" data-href').replace(/<\/a>\s*$/, '</div>')}</div>
      <p class="small dim">${p.cronograma.length} etapas no cronograma, ${p.arranjo.length} regras no arranjo${p.corpo ? ', e a descrição' : ''}.</p>` : ''}`;
  $('#fin-criar').disabled = !p.titulo;
}

/* ---------- o cartão de um edital ---------- */
async function finEdital(id){
  const voltar = ['Financiamento', '#/ri/financiamento'];
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Edital', voltar }) + estado.carregando();
  try { await riCarregar(); } catch(e){ return e.message === 'sem_permissao' ? riSemPermissao() : riErro(e); }
  const { data, error } = await sb.rpc('ri_edital_ler', { p_id:id });
  if (error || data?.status !== 'ok'){ $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:'Edital', voltar }) + estado.vazio({ texto:'Este edital não existe (ou foi excluído).' }); return; }
  const e = data.edital, hoje = hojeISO();
  const feitos = e.checklist.filter(c => c.feito).length, pct = e.checklist.length ? Math.round(feitos / e.checklist.length * 100) : 0;
  const sn = v => v == null ? '' : v ? 'Sim' : 'Não';
  const principal = `
    <section class="card ri-sec fin-prazo-box"><div>${finPrazo(e)}</div>
      ${e.proxima_etapa ? `<p class="small">Próxima etapa: <b>${esc(e.proxima_etapa.etapa)}</b>, ${fmtD(e.proxima_etapa.data)}</p>` : ''}</section>
    ${e.resumo ? `<section class="card ri-sec"><h2>Em resumo</h2><p class="ri-texto">${esc(e.resumo)}</p></section>` : ''}
    <section class="card ri-sec"><h2>Cronograma <span class="n">${e.cronograma.length}</span></h2>
      ${e.cronograma.length ? `<ol class="fin-crono">${e.cronograma.map((c, i) => `<li class="${c.feito ? 'feito' : c.data && c.data < hoje ? 'atrasado' : ''}">
        <label><input type="checkbox" data-marca="cronograma" data-i="${i}"${c.feito ? ' checked' : ''}>
          <span class="d">${c.data ? fmtD(c.data) : 'Sem data'}</span><span class="t">${esc(c.etapa)}</span>
          ${!c.feito && c.data && c.data < hoje ? '<span class="ri-frio">atrasada</span>' : ''}</label></li>`).join('')}</ol>`
        : '<p class="dim">Sem cronograma. Edite o texto e acrescente "## Cronograma".</p>'}</section>
    <section class="card ri-sec"><div class="ri-sec-cab"><h2>Checklist <span class="n">${feitos} de ${e.checklist.length}</span></h2></div>
      ${e.checklist.length ? `<span class="fin-prog" aria-hidden="true"><i style="width:${pct}%"></i></span>
        <ul class="fin-check">${e.checklist.map((c, i) => `<li><label><input type="checkbox" data-marca="checklist" data-i="${i}"${c.feito ? ' checked' : ''}> <span>${esc(c.item)}</span></label></li>`).join('')}</ul>`
        : '<p class="dim">Sem checklist. Edite o texto e acrescente "## Checklist".</p>'}</section>
    ${e.arranjo.length ? `<section class="card ri-sec"><h2>Arranjo deste edital</h2>${spec(e.arranjo.map(a => [a.rotulo, esc(a.valor)]))}</section>` : ''}
    ${e.corpo ? `<section class="card ri-sec fin-corpo">${md(e.corpo)}</section>` : ''}
    ${e.notas ? `<section class="card ri-sec"><h2>Notas</h2><p class="ri-texto">${esc(e.notas)}</p></section>` : ''}`;
  const lateral = `
    <div class="fld"><label for="fin-status">Situação</label><select id="fin-status">${FIN_STATUS.map(([k, l]) => `<option value="${k}"${e.status === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    ${spec([['Financiador', e.financiador_id ? `<a href="#/ri/${e.financiador_id}">${esc(e.financiador)}</a>` : esc(e.financiador || '')],
      ['Chamada', esc(e.chamada || '')], ['Tipo', esc(finRot(FIN_TIPOS, e.tipo))],
      ['Valor máximo', finMoeda(e.valor_maximo)], ['Solicitado', finMoeda(e.valor_solicitado)], ['Aprovado', finMoeda(e.valor_aprovado)],
      ['Contrapartida', esc(e.contrapartida || '')], ['Abertura', e.abertura ? fmtD(e.abertura) : ''], ['Prazo', e.prazo ? fmtD(e.prazo) : ''],
      ['Resultado', e.resultado ? fmtD(e.resultado) : ''], ['Duração', e.duracao_meses ? e.duracao_meses + ' meses' : ''],
      ['Quem submete', esc(finRot(FIN_PROPONENTES, e.proponente))], ['Quem envia', esc(e.responsavel_submissao || '')],
      ['Pela UFMG', sn(e.pela_ufmg)], ['Outro grupo', esc(e.outro_grupo || 'Não')], ['Empresa', esc(e.empresa || 'Não')],
      ['Responsável na NRO', esc(e.responsavel_nome || '')], ['Equipe', esc((e.equipe_nomes || []).map(m => m.nome).join(', '))],
      ['Atualizado', `${fmtD(e.atualizado_em)}${e.atualizado_por_nome ? ', ' + esc(e.atualizado_por_nome) : ''}`]])}
    ${e.link ? `<a class="btn ghost fin-link" href="${esc(e.link)}" target="_blank" rel="noopener">Abrir o edital ↗</a>` : ''}
    ${(e.temas || []).length ? `<h3 class="ri-lat-tit">Temas</h3><div class="ri-tags">${e.temas.map(t => `<span class="ri-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    ${(e.contatos_lista || []).length ? `<h3 class="ri-lat-tit">Contatos ligados</h3><ul class="ri-rels">${e.contatos_lista.map(c => `<li><a href="#/ri/${c.id}">${esc(c.nome)}</a></li>`).join('')}</ul>` : ''}`;
  $('#main').innerHTML = cabecalho({ espaco:'Relações institucionais', titulo:e.titulo, voltar, codigo:e.codigo,
      meta:[e.financiador, finRot(FIN_TIPOS, e.tipo), e.chamada].filter(Boolean).map(x => `<span>${esc(x)}</span>`),
      acoes:`<button type="button" class="btn ghost" id="fin-editar">${ic('pencil')} Editar texto</button>` }) + layoutObjeto(principal, lateral);
  $('#fin-status').addEventListener('change', async ev => {
    const { data: d } = await sb.rpc('ri_edital_status', { p_id:id, p_status:ev.target.value });
    if (d?.status === 'ok'){ toast('Situação: ' + finRot(FIN_STATUS, ev.target.value) + '.'); finEdital(id); } else toast('Não foi possível mudar agora.');
  });
  $('#main').querySelectorAll('[data-marca]').forEach(cx => cx.addEventListener('change', async () => {
    const { data: d } = await sb.rpc('ri_edital_marcar', { p_id:id, p_lista:cx.dataset.marca, p_indice:+cx.dataset.i, p_feito:cx.checked });
    if (d?.status !== 'ok'){ cx.checked = !cx.checked; return toast('Não foi possível marcar agora.'); }
    finEdital(id);
  }));
  $('#fin-editar').addEventListener('click', () => finEditarTexto(e));
}
function finEditarTexto(e){
  const texto = finParaTexto(e);
  abreModal(`<h3>Editar o texto de ${esc(e.codigo)}</h3>
    <p class="small muted">O texto já traz o que foi marcado. Ao salvar, o cartão é refeito a partir dele.</p>
    <textarea id="fin-ed-txt" rows="22" spellcheck="false" class="fin-mono">${esc(texto)}</textarea>
    <div id="fin-ed-avisos"></div>
    <div class="acts" style="justify-content:space-between">
      <button type="button" class="btn ghost" id="fin-excluir">${ic('trash')} Excluir o edital</button>
      <span style="display:flex;gap:8px"><button type="button" class="btn ghost" onclick="fechaModal()">Cancelar</button>
        <button type="button" class="btn solid" id="fin-ed-salvar">Salvar</button></span></div>`, 'imenso', true);
  const avisar = () => { const { avisos } = finLerTexto($('#fin-ed-txt').value);
    $('#fin-ed-avisos').innerHTML = avisos.length ? `<div class="aviso-box warn"><ul>${avisos.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''; };
  $('#fin-ed-txt').addEventListener('input', avisar); avisar();
  $('#fin-ed-salvar').addEventListener('click', async () => {
    const t = $('#fin-ed-txt').value, { p } = finLerTexto(t);
    if (!p.titulo) return toast('Falta o título.');
    const { data } = await sb.rpc('ri_edital_salvar', { p:{ ...p, id:e.id, notas:e.notas, fonte_md:t } });
    if (data?.status !== 'ok') return toast('Não foi possível salvar' + (data?.campo ? ': confira "' + data.campo + '"' : '') + '.');
    fechaModal(); toast('Edital atualizado.'); finEdital(e.id);
  });
  $('#fin-excluir').addEventListener('click', async () => {
    if (!confirm(`Excluir ${e.codigo}, ${e.titulo}? O cartão, o cronograma e o checklist somem.`)) return;
    const { data } = await sb.rpc('ri_edital_excluir', { p_id:e.id });
    if (data?.status === 'ok'){ fechaModal(); toast('Edital excluído.'); location.replace('#/ri/financiamento'); }
  });
}
