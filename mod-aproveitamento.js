/* ============================================================
   MÓDULO · APROVEITAMENTO DE AACC
   O pedido de aproveitamento da participação na equipe como Atividade
   Acadêmica Curricular Complementar, nos termos da Resolução nº 02/2019
   da Congregação da Escola de Engenharia da UFMG. O relatório é escrito
   no template LaTeX do brand (templates/aacc); o portal conduz o resto:

   1. A FICHA. Os campos do recadastro (com os pronomes, com que o
      relatório concorda) e os dados acadêmicos: o curso, de uma lista
      (AAC_CURSOS, a mesma de nro/competencias.tex, que escolhe as
      competências do relatório), a matrícula e o semestre de ingresso.
      A entrada e a saída da equipe são do Depto. de Pessoal: é por elas
      que se contam os semestres.
   2. O ENQUADRAMENTO. O painel com o que a resolução permite (CATALOGO,
      o mesmo de nro/aproveitamento.tex e do DocNRO.AACC) e os semestres
      letivos que contam, pela mesma regra da classe LaTeX. O OUT é para
      o curso que segue a norma de outro Colegiado. Guardar cria o
      pedido, AAC-7, cujo relatório é o NRO-PES-020-7.
   3. O RELATÓRIO. O ZIP do template com o soma.tex do pedido (o que o
      SOMA sabe da pessoa), para abrir no Overleaf.
   4. O ENVIO. O PDF compilado em modo final: a tela lê os metadados que
      o template escreve (pdf-lib), confere o que o banco vai conferir,
      calcula o SHA-256, sobe para o bucket "aproveitamento" e envia.
   Depois, as etapas (uma pessoa de cada grupo, na ordem da
   configuração), o professor orientador indicado na última, pelo link
   pessoal (aproveitamento/index.html), e a folha de aprovação, que a
   tela põe no lugar da folha reservada do relatório na hora de baixar.

   Rotas (Serviços é da casca; ela desce este módulo e chama):
     #/servicos/aproveitamento             o meu pedido
     #/servicos/aproveitamento/aprovar     os que esperam a minha decisão
     #/servicos/aproveitamento/todos       os que posso ver
     #/servicos/aproveitamento/config      as etapas e o professor (admin e Depto. de Pessoal)
     #/servicos/aproveitamento/AAC-7       um pedido
   membro.neurodynamics.dev/aproveitamento leva para a primeira.

   Precisa da migração db/2.20.0_aproveitamento.sql.

   Depende da casca para: sb, $, esc, norm, state, can, toast, abreModal,
   fechaModal, fmtD, fmtDT, ic, confirma, falha, motivoRPC, carregarLib,
   registrarBusca, precisaDocNRO, grupoPorId, dica, navNivel1.
   ============================================================ */

const aac = { meu:null, lista:null, atual:null, cfg:null, pdf:null, sel:null, ficha:false };

/* local, como o jsPDF e o pdf-lib do termo (2.19.1): nada de CDN de terceiros */
const AAC_CDN_PDFLIB = 'vendor/pdf-lib-1.17.1.min.js';
const AAC_CDN_JSZIP  = 'vendor/jszip-3.10.1.min.js';
const AAC_EXEMPLO    = 'https://brand.neurodynamics.dev/assets/exemplo-relatorio-aacc.pdf';

const AAC_STATUS = {
  preparacao: { l:'Em preparação',   dt:'dt-gray', p:'' },
  analise:    { l:'Em análise',      dt:'dt-warn', p:'p-warn' },
  devolvido:  { l:'Devolvido',       dt:'dt-bad',  p:'p-bad' },
  professor:  { l:'Com o professor', dt:'dt-info', p:'' },
  concluido:  { l:'Aprovado',        dt:'dt-ok',   p:'p-ok' },
  cancelado:  { l:'Cancelado',       dt:'dt-gray', p:'' }
};
const aacPill = st => { const s = AAC_STATUS[st] || { l:st, dt:'dt-gray', p:'' };
  return `<span class="pill ${s.p}"><span class="dt ${s.dt}"></span>${s.l}</span>`; };

/* O que a resolução permite pela participação na equipe, e o OUT, para
   quem é de curso fora da Escola de Engenharia. É o catálogo do template
   (nro/aproveitamento.tex): mudou lá, muda aqui e no DocNRO.AACC. As
   atividades que contam à parte se indicam no próprio relatório,
   atividade por atividade. */
const AAC_CATALOGO = {
  EQC: { nome:'Participação em equipe de competição estudantil', disp:'art. 1º, II, c; art. 11', base:'semestre', cred:3,
         regra:'3 créditos por semestre letivo', quando:'A equipe compete no Cybathlon com a tecnologia que concebe, projeta e monta, e a participação está registrada no SIEX (Competição Cybathlon 2024, nº 205234).' },
  EXT: { nome:'Projeto de extensão com vínculo formal', disp:'art. 1º, I, c; arts. 3º e 8º', base:'semestre', cred:3, sem:'siex',
         regra:'3 créditos por semestre com registro na ação do SIEX', quando:'Só nos semestres com registro na equipe da ação de extensão Competição Cybathlon 2024 (SIEX nº 205234).' },
  VPC: { nome:'Vivência profissional complementar', disp:'art. 1º, IV, a; art. 17', base:'horas', cred:1, unidade:300,
         regra:'1 crédito a cada 300 horas', quando:'A alternativa para o Colegiado que não acolher as anteriores; rende menos créditos.' },
  OUT: { nome:'Outro enquadramento', disp:'a norma do Colegiado', base:'colegiado', fora:true,
         regra:'Créditos definidos pelo Colegiado', quando:'Para curso que não segue a Resolução 02/2019 da Escola de Engenharia: o relatório cita a norma do seu Colegiado, e ele define os créditos. Sem alternativas.' }
};
/* Os cursos: as engenharias da UFMG e os cursos da EEFFTO, da Faculdade
   de Medicina, da Escola de Enfermagem, do ICEx e da FACE. É a lista de
   nro/competencias.tex: o nome escolhe as competências da Parte IV do
   relatório. Curso fora dela usa as competências gerais. */
const AAC_CURSOS = [
  ['Escola de Engenharia', ['Engenharia Aeroespacial', 'Engenharia Ambiental', 'Engenharia Civil', 'Engenharia de Computação',
    'Engenharia de Controle e Automação', 'Engenharia de Materiais', 'Engenharia de Minas', 'Engenharia de Produção', 'Engenharia de Sistemas',
    'Engenharia Elétrica', 'Engenharia Mecânica', 'Engenharia Metalúrgica', 'Engenharia Química']],
  ['Instituto de Ciências Agrárias', ['Engenharia Agrícola e Ambiental', 'Engenharia de Alimentos', 'Engenharia Florestal']],
  ['EEFFTO', ['Educação Física', 'Fisioterapia', 'Terapia Ocupacional']],
  ['Faculdade de Medicina', ['Fonoaudiologia', 'Medicina', 'Tecnologia em Radiologia']],
  ['Escola de Enfermagem', ['Enfermagem', 'Gestão de Serviços de Saúde', 'Nutrição']],
  ['ICEx', ['Ciência da Computação', 'Ciência de Dados', 'Estatística', 'Física', 'Matemática', 'Matemática Computacional', 'Química',
    'Química Tecnológica', 'Sistemas de Informação']],
  ['FACE', ['Administração', 'Ciências Atuariais', 'Ciências Contábeis', 'Ciências Econômicas', 'Controladoria e Finanças',
    'Relações Econômicas Internacionais']]
];
const AAC_CURSO_LISTA = AAC_CURSOS.flatMap(([, l]) => l);
const AAC_UNIDADES = ['Escola de Engenharia', 'Instituto de Ciências Exatas (ICEx)', 'Escola de Educação Física, Fisioterapia e Terapia Ocupacional (EEFFTO)',
  'Faculdade de Medicina', 'Escola de Enfermagem', 'Faculdade de Ciências Econômicas (FACE)', 'Instituto de Ciências Biológicas (ICB)',
  'Instituto de Ciências Agrárias (ICA)'];
/* os pronomes: a forma masculina, a feminina e a neutra */
const aacPron = (p, m, f, n) => { const x = String(p || '').toLowerCase(); return x === 'ela' ? f : x === 'elu' ? n : m; };
const AAC_ITENS = 'Contam à parte, indicadas atividade por atividade no relatório (art. 7º): publicação (1 a 3 créditos, art. 9º), '
  + 'organização de evento técnico-científico (1 crédito a cada 7,5 h de evento, art. 14), participação em evento (1 a cada 15 h, art. 14), '
  + 'curso presencial ou a distância (1 a cada 15 h, art. 15) e voluntariado (1 a cada 15 h, art. 12).';

/* os campos da ficha que a página confere: os obrigatórios travam o
   download do template */
const AAC_CAMPOS = [
  { k:'email_pessoal', l:'E-mail pessoal', t:'email' },
  { k:'telefone', l:'Telefone', ph:'(31) 99999-0000' },
  { k:'cpf', l:'CPF', ph:'000.000.000-00' },
  { k:'data_nascimento', l:'Data de nascimento', t:'date' },
  { k:'endereco', l:'Endereço', full:true },
  { k:'cidade_origem', l:'Cidade de origem' },
  { k:'instituicao', l:'Instituição de ensino', ph:'UFMG' },
  { k:'curso', l:'Curso', curso:true },
  { k:'matricula', l:'Matrícula' },
  { k:'periodo_ingresso', l:'Semestre de ingresso no curso', ph:'2022/2' },
  { k:'genero', l:'Gênero' },
  { k:'pronomes', l:'Pronomes', opcoes:[['ela', 'ela/dela'], ['ele', 'ele/dele'], ['elu', 'elu/delu']] },
  { k:'autodeclaracao_racial', l:'Autodeclaração racial', lista:['Branca','Preta','Parda','Amarela','Indígena','Prefiro não declarar'] }
];
const AAC_ROT_CAMPO = Object.fromEntries(AAC_CAMPOS.map(c => [c.k, c.l]));

const AAC_MOTIVO = {
  incompleto: 'A ficha está incompleta: complete o passo 1.',
  em_andamento: 'O pedido está em análise: o enquadramento não muda agora.',
  fora_de_envio: 'O pedido não está esperando o envio do relatório.',
  sem_grupo: 'Uma etapa da aprovação está sem grupo. Avise o Depto. de Pessoal.',
  sem_arquivo: 'O PDF não chegou ao armazenamento. Envie de novo.',
  nao_template: 'Este PDF não foi gerado pelo template do relatório de AACC.',
  exemplo: 'Este é o PDF do exemplo, não o seu relatório.',
  outro_pedido: 'O PDF é de outro pedido: baixe o soma.tex deste pedido e compile de novo.',
  rascunho: 'O PDF está em rascunho: troque "rascunho" por "final" na linha do \\documentclass e compile de novo.',
  pendencias: 'O PDF ainda tem pendências: a lista está logo depois dos quadros do pedido.',
  outro_enquadramento: 'O enquadramento do PDF é outro: baixe o soma.tex de novo e compile.',
  sem_folha: 'O PDF não tem a folha reservada ao SOMA: compile de novo com o template.',
  fora_de_aprovacao: 'O pedido não está nesta etapa.',
  propria: 'Quem pediu não decide o próprio pedido.',
  ja_aprovou: 'Você já aprovou esta versão em outra etapa: outra pessoa do grupo decide esta.',
  dominio: 'O e-mail do professor precisa ser institucional.',
  fora_do_professor: 'O pedido não está com o professor.',
  nao_concluido: 'Só se reabre um pedido aprovado.',
  outro_aberto: 'Há outro pedido em aberto desta pessoa.',
  fechado: 'O pedido já está fechado.',
  em_uso: 'Há pedido em análise numa etapa que deixaria de existir.',
  nao_emitido: 'A folha de aprovação ainda não foi emitida.'
};
const AAC_CAMPO_MSG = {
  principal: 'Escolha o enquadramento principal.', alternativas: 'Alternativa inválida.',
  siex: 'Marque os semestres com registro no SIEX (só os que contam).',
  outro: 'Informe o nome do enquadramento na norma do seu Colegiado.', norma: 'Informe a norma do seu Colegiado.',
  normacurta: 'A forma curta da norma tem até 80 caracteres.',
  pronomes: 'Escolha os pronomes: ela, ele ou elu.',
  professor_nome: 'Informe o nome completo do professor.', professor_titulo: 'Informe o título do professor.',
  professor_departamento: 'Informe o departamento do professor.', professor_unidade: 'Informe a unidade acadêmica do professor.',
  professor_email: 'Informe um e-mail válido.', pdf_url: 'Não foi possível gerar o link do PDF.',
  parecer: 'Informe o motivo (até 1.200 caracteres).', motivo: 'Informe o motivo.', etapas: 'Confira as etapas.'
};
const aacMotivo = (data, error, padrao) => {
  if (error) return motivoRPC(null, error, padrao);
  if (data?.status === 'invalido' && data.campo)
    return AAC_CAMPO_MSG[data.campo] || (AAC_ROT_CAMPO[data.campo] ? `Confira o campo ${AAC_ROT_CAMPO[data.campo]}.` : motivoRPC(data, null, padrao));
  if (data?.status === 'dominio') return `O e-mail do professor precisa ser @${data.dominio}.`;
  if (data?.status === 'pendencias' && data.pendencias && data.pendencias !== '?') return `O PDF ainda tem ${data.pendencias} ${data.pendencias === '1' ? 'pendência' : 'pendências'}.`;
  return AAC_MOTIVO[data?.status] || motivoRPC(data, null, padrao);
};

const aacTopo = (titulo, lead, acoes, olho) => `<div class="topo-gestao"><div class="tx">
  <span class="eyebrow">${esc(olho || 'Serviços › Aproveitamento de AACC')}</span><h1>${titulo}</h1>
  ${lead ? `<p class="lead">${lead}</p>` : ''}</div>${acoes ? `<div class="acoes">${acoes}</div>` : ''}</div>`;
const aacCarregando = t => `<div class="carregando"><span class="spin"></span> ${t || 'Carregando…'}</div>`;
const aacFaltaBanco = erro => `${aacTopo('Aproveitamento de AACC', '')}<div class="aviso-box err"><b>Isto ainda não está no banco.</b>
  ${esc(erro?.message || '')}<br><span class="small">Falta aplicar a migração <code>db/2.20.0_aproveitamento.sql</code>.</span></div>`;
const aacMesAno = iso => { if (!/^\d{4}-\d{2}/.test(String(iso || ''))) return '—';
  const [a, m] = String(iso).split('-'); return `${['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+m - 1]}/${a}`; };
const aacGere = () => ['admin', 'pessoal'].includes(state.perfil?.papel);
const aacVirgula = n => String(n == null ? '' : n).replace('.', ',');

/* ---------------- a rota ---------------- */
async function pageAproveitamento(sub2){
  const s = String(sub2 || '');
  if (/^aac-\d+$/i.test(s)) return aacPagina(s.toUpperCase());
  if (s === 'config') return aacGere() ? aacConfig() : (location.hash = '#/servicos/aproveitamento');
  if (s === 'aprovar' || s === 'todos') return aacLista(s);
  return aacMeu();
}
function aacNav(atual){
  const m = aac.meu || {};
  const pend = (aac.lista || []).filter(p => p.posso_decidir).length;
  const it = [['meu', 'Meu pedido', '#/servicos/aproveitamento']];
  if (m.aprovador || m.gere || aacGere()){
    it.push(['aprovar', 'Para aprovar', '#/servicos/aproveitamento/aprovar', pend ? ` <span class="n sua">${pend}</span>` : '']);
    it.push(['todos', 'Todos', '#/servicos/aproveitamento/todos']);
  }
  if (aacGere()) it.push(['config', `${ic('engrenagem')} Configurações`, '#/servicos/aproveitamento/config']);
  return it.length > 1 ? navNivel1(it, atual, 'Aproveitamento de AACC') : '';
}
async function aacCarregarLista(){
  const { data, error } = await sb.rpc('aacc_lista');
  aac.lista = !error && Array.isArray(data) ? data : [];
  return !error;
}

/* ============================================================
   O MEU PEDIDO: os quatro passos
   ============================================================ */
async function aacMeu(){
  $('#main').innerHTML = aacCarregando('Lendo a sua ficha…');
  const [m] = await Promise.all([sb.rpc('aacc_meu'), aacCarregarLista()]);
  if (m.error){ $('#main').innerHTML = aacFaltaBanco(m.error); return; }
  aac.meu = m.data || {};
  if (aac.meu.status === 'sem_registro'){
    $('#main').innerHTML = `${aacTopo('Aproveitamento de AACC', '')}${aacNav('meu')}
      <div class="aviso-box warn">${esc(MOTIVO_RPC.sem_registro)}</div>`;
    return;
  }
  if (aac.meu.status !== 'ok'){
    $('#main').innerHTML = `${aacTopo('Aproveitamento de AACC', '')}<div class="aviso-box err">${esc(aacMotivo(aac.meu, null, 'Não foi possível ler a ficha'))}</div>`;
    return;
  }
  /* o cancelado vai para os anteriores: a pessoa pode abrir outro */
  if (aac.meu.pedido?.status === 'cancelado'){
    const x = aac.meu.pedido;
    aac.meu.anteriores = [{ id:x.id, codigo:x.codigo, status:x.status, concluido_em:null, emitido:null }, ...(aac.meu.anteriores || [])];
    aac.meu.pedido = null;
  }
  const p = aac.meu.pedido;
  aac.sel = aacSelecaoDe(p);
  aac.pdf = null;
  aacMeuDesenhar();
}
/* o enquadramento na tela: o do pedido, ou a sugestão (EQC, com VPC de alternativa) */
function aacSelecaoDe(p){
  const ped = p?.pedido || {};
  return { principal: ped.principal || 'EQC', alternativas: ped.alternativas || (p ? [] : ['VPC']),
           siex: ped.siex || [], colegiado: ped.colegiado || '',
           outro: ped.outro || '', norma: ped.norma || '', normacurta: ped.normacurta && ped.normacurta !== ped.norma ? ped.normacurta : '' };
}
const aacConta = () => (aac.meu.semestres || []).filter(s => s.situacao === 'conta');

function aacMeuDesenhar(){
  const m = aac.meu, d = m.membro || {}, p = m.pedido, bl = m.bloqueios || [];
  const st = p?.status;
  const andando = ['analise', 'professor', 'concluido'].includes(st);
  const pode = !p || ['preparacao', 'devolvido'].includes(st);
  const passo1 = bl.length === 0, passo2 = !!p && !!p.pedido?.principal;
  const lead = `Resolução nº 02/2019 da Congregação da Escola de Engenharia. ${dica('Confira a ficha, escolha o enquadramento, baixe o template e escreva o relatório no Overleaf. O PDF final passa pela aprovação de uma pessoa de cada etapa da equipe e do professor orientador; aprovado, sai com a folha de aprovação, autenticável em auth.neurodynamics.dev, para entregar ao Colegiado do curso.')}`;
  $('#main').innerHTML = `${aacTopo('Aproveitamento de AACC', lead, p ? `<a class="btn ghost" href="#/servicos/aproveitamento/${esc(p.codigo)}">${esc(p.codigo)}</a>` : '')}
    ${aacNav('meu')}
    ${p ? aacFaixaPedido(p) : ''}
    ${aacTrilha(d, p, bl)}
    <div class="aac-passos">
      ${aacPasso(1, 'A ficha e os dados acadêmicos', passo1 ? 'feito' : 'atual', aacPassoFicha(d, bl, pode))}
      ${aacPasso(2, 'O enquadramento', !passo1 ? 'trava' : passo2 && !aac.editandoEnq ? 'feito' : 'atual', aacPassoEnquadramento(pode && passo1))}
      ${aacPasso(3, 'O relatório', !passo2 ? 'trava' : andando ? 'feito' : 'atual', aacPassoRelatorio(p, passo2))}
      ${aacPasso(4, 'O envio do PDF', !passo2 ? 'trava' : andando ? 'feito' : 'atual', aacPassoEnvio(p, passo2 && pode))}
    </div>
    ${(m.anteriores || []).length ? `<div class="tre-sec" style="margin-top:26px"><h2>Pedidos anteriores <span class="n">${m.anteriores.length}</span></h2>
      <div class="evx-lista">${m.anteriores.map(x => `<a class="evx-card" href="#/servicos/aproveitamento/${esc(x.codigo)}">
        <span class="evx-tx"><span class="tt">${esc(x.codigo)}</span>
          <span class="mt">${x.concluido_em ? 'Aprovado em ' + fmtD(x.concluido_em) : ''}${x.emitido ? `, folha ${esc(x.emitido)}` : ''}</span></span>
        <span class="evx-lado">${aacPill(x.status)}</span></a>`).join('')}</div></div>` : ''}`;
  aacLigarEnvio();
}
function aacPasso(n, titulo, estado, corpo){
  return `<section class="card aac-passo ${estado}" id="aac-p${n}"><header><h2>${titulo}</h2>
    ${estado === 'feito' ? `<span class="small aac-ok">${ic('check')} feito</span>` : ''}</header>
    <div class="aac-corpo">${corpo}</div></section>`;
}
/* O contador dos passos: o mesmo do Arquivos (arq-etapas), com o que
   falta ou o que foi feito embaixo de cada um. */
function aacTrilha(d, p, bl){
  const st = p?.status, ped = p?.pedido || {};
  const falta = (d.faltam || []).length;
  const agora = bl.length ? 0 : !p || aac.editandoEnq ? 1 : ['preparacao'].includes(st) ? (aac.pdf ? 3 : 2)
    : st === 'devolvido' ? 3 : 4;
  const cor = st === 'concluido' ? 'ok' : st === 'devolvido' || st === 'cancelado' ? 'bad' : agora === 4 ? 'warn' : '';
  const sub = [
    bl.length ? (falta ? `${falta === 1 ? 'falta um campo' : `faltam ${falta} campos`}` : 'falta um dado da equipe') : 'completa',
    p && ped.principal ? esc(ped.principal === 'OUT' ? (ped.outro || 'outro enquadramento') : ped.principal) : 'a escolher',
    p ? `template do ${esc(p.codigo)}` : 'depois do enquadramento',
    p?.versao ? `versão ${p.versao}${p.enviado_em ? ', ' + fmtD(p.enviado_em) : ''}` : 'PDF final, sem pendência',
    st === 'analise' ? `etapa ${p.etapa} de ${p.n_etapas}` : st === 'professor' ? 'com o professor orientador'
      : st === 'concluido' ? `aprovado${p.concluido_em ? ' em ' + fmtD(p.concluido_em) : ''}` : st === 'devolvido' ? 'devolvido para ajuste'
      : st === 'cancelado' ? 'cancelado' : 'equipe e professor orientador'
  ];
  return `<div class="arq-etapas aac-trilha" role="list" aria-label="Passos do pedido">${['Ficha', 'Enquadramento', 'Relatório', 'Envio', 'Aprovação']
    .map((nome, i) => `<div role="listitem" class="arq-etapa${i < agora || (st === 'concluido' && i === 4) ? ' feita' : ''}${i === agora ? ' agora ' + cor : ''}"
      ${i === agora ? 'aria-current="step"' : ''}>${nome}<span class="sub">${sub[i]}</span></div>`).join('')}</div>`;
}
/* a faixa do alto: onde o pedido está */
function aacFaixaPedido(p){
  const etapa = p.status === 'analise' ? `, na etapa ${esc(p.etapa_rotulo || p.etapa)} (${p.etapa} de ${p.n_etapas})`
    : p.status === 'professor' ? `, com ${esc(p.prof_titulo || '')} ${esc(p.prof_nome || '')}` : '';
  const conc = p.status === 'concluido';
  return `<div class="aac-faixa ${p.status}">
    <div class="tx"><b>${esc(p.codigo)}</b> ${aacPill(p.status)} <span class="small">${esc(p.documento || '')}${p.versao ? `, versão ${p.versao}` : ''}${etapa}</span>
      ${p.status === 'devolvido' && p.motivo ? `<span class="aac-motivo">${esc(p.motivo)}</span>` : ''}
      ${conc ? `<span class="small">Nota ${esc(aacVirgula(p.nota))} de 100. Folha de aprovação <b>${esc(p.emitido || '')}</b>. Entregue o PDF final ao Colegiado do curso.</span>` : ''}</div>
    <div class="acts">${conc ? `<button class="btn solid" onclick="aacBaixarFinal('${esc(p.id)}')">${ic('down')} PDF final</button>
      <button class="btn ghost" onclick="aacModalMotivo('reabrir','${esc(p.id)}')">Reabrir ${dica('Se o Colegiado apontar algo no relatório: a folha atual é revogada, e o relatório corrigido passa pelas aprovações outra vez.')}</button>`
      : ['preparacao', 'devolvido', 'analise', 'professor'].includes(p.status) ? `<button class="btn ghost" onclick="aacModalMotivo('cancelar','${esc(p.id)}')">Cancelar o pedido</button>` : ''}</div></div>`;
}

/* ---------------- 1. a ficha ---------------- */
function aacPassoFicha(d, bl, pode){
  const falta = d.faltam || [];
  const valor = k => k === 'email_pessoal' || k === 'telefone' ? d[k] : (d.perfil || {})[k];
  const mostrar = aac.ficha ? AAC_CAMPOS : AAC_CAMPOS.filter(c => falta.includes(c.k));
  const eg = d.situacao === 'egresso';
  const avisos = [];
  if (bl.includes('entrada')) avisos.push('A data de entrada na equipe não está na ficha.');
  if (bl.includes('saida')) avisos.push('A data de saída da equipe não está na ficha.');
  return `<dl class="dcl-dados aac-dados">
      <div><dt>Curso</dt><dd>${esc(d.curso || '—')}</dd></div>
      <div><dt>Matrícula</dt><dd>${esc(d.matricula || '—')}</dd></div>
      <div><dt>Ingresso no curso</dt><dd>${esc(d.ingresso || d.periodo_ingresso || '—')}</dd></div>
      <div><dt>Situação</dt><dd>${eg ? aacPron(d.pronomes, 'Egresso', 'Egressa', 'Egresse') : 'Membro ativo'}</dd></div>
      <div><dt>Entrada na equipe</dt><dd>${d.inicio ? fmtD(d.inicio) : '—'}</dd></div>
      <div><dt>${eg ? 'Saída da equipe' : 'Cargo'}</dt><dd>${eg ? (d.fim ? fmtD(d.fim) : '—') : esc(d.cargo || '—')}</dd></div>
    </dl>
    ${avisos.length ? `<div class="aviso-box warn" style="margin-top:12px">${avisos.map(esc).join(' ')} A entrada e a saída são registradas pelo Depto. de Pessoal.
      <button class="btn ghost mini" style="margin-left:6px" onclick="aacPedirCorrecao()">Pedir a correção</button></div>` : ''}
    ${mostrar.length ? `<div class="aac-ficha">${falta.length && !aac.ficha ? `<p class="small" style="color:var(--warn-tx);margin-bottom:8px">
        ${falta.length === 1 ? 'Falta um campo' : `Faltam ${falta.length} campos`} do recadastro.</p>` : ''}
      <div class="aac-campos">${mostrar.map(c => aacCampo(c, valor(c.k) || '')).join('')}</div>
      <div class="acts"><button class="btn solid" id="aac-ficha-btn" onclick="aacSalvarFicha()">Salvar a ficha</button></div></div>`
    : `<div class="acts" style="margin-top:10px"><span class="small aac-ok">${ic('check')} Recadastro completo.</span>
        ${pode ? `<button class="btn ghost mini" onclick="aac.ficha=true;aacMeuDesenhar()">Editar a ficha</button>` : ''}</div>`}`;
}
/* um campo da ficha: o curso vem da lista (ou "Outro curso", escrito);
   os pronomes, de um seletor */
function aacCampo(c, v){
  const rot = `<label for="aac-f-${c.k}">${esc(c.l)}</label>`;
  if (c.curso){
    const outro = !!v && !AAC_CURSO_LISTA.includes(v);
    return `<div class="fld"><label for="aac-f-curso-sel">${esc(c.l)} ${dica('O curso escolhe as competências das Diretrizes Curriculares Nacionais que o relatório mostra. Curso fora da lista usa as competências gerais.')}</label>
      <select id="aac-f-curso-sel" onchange="const o=this.value==='__outro';$('#aac-f-curso').hidden=!o;if(!o)$('#aac-f-curso').value=this.value">
        <option value="">Escolha o curso</option>
        ${AAC_CURSOS.map(([u, l]) => `<optgroup label="${esc(u)}">${l.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</optgroup>`).join('')}
        <option value="__outro" ${outro ? 'selected' : ''}>Outro curso</option></select>
      <input id="aac-f-curso" data-k="curso" value="${esc(v)}" placeholder="O nome do curso, como no registro acadêmico" ${outro ? '' : 'hidden'} style="margin-top:6px"></div>`;
  }
  if (c.opcoes) return `<div class="fld">${rot}<select id="aac-f-${c.k}" data-k="${c.k}"><option value="">Escolha</option>
      ${c.opcoes.map(([k, l]) => `<option value="${k}" ${k === String(v).toLowerCase() ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
  return `<div class="fld${c.full ? ' full' : ''}">${rot}
    <input id="aac-f-${c.k}" data-k="${c.k}" type="${c.t || 'text'}" value="${esc(v)}"${c.ph ? ` placeholder="${esc(c.ph)}"` : ''}${c.lista ? ` list="aac-l-${c.k}"` : ''}>
    ${c.lista ? `<datalist id="aac-l-${c.k}">${c.lista.map(o => `<option value="${esc(o)}">`).join('')}</datalist>` : ''}</div>`;
}
async function aacSalvarFicha(){
  const o = {};
  document.querySelectorAll('.aac-campos [data-k]').forEach(i => { o[i.dataset.k] = i.value.trim(); });
  const b = $('#aac-ficha-btn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('aacc_perfil_salvar', { p: o });
  if (b) b.disabled = false;
  if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível salvar a ficha'), true);
  toast('Ficha salva.');
  aac.ficha = false;
  aacMeu();
}
function aacPedirCorrecao(){
  const d = aac.meu?.membro || {};
  location.hash = '#/servicos/outro';
  setTimeout(() => {
    const t = $('#f-titulo'), x = $('#f-desc');
    if (t) t.value = 'Correção da entrada ou da saída na ficha';
    if (x) x.value = `Para o pedido de aproveitamento de AACC: a minha ficha está com entrada ${d.inicio ? fmtD(d.inicio) : 'em branco'}`
      + `${d.situacao === 'egresso' ? ` e saída ${d.fim ? fmtD(d.fim) : 'em branco'}` : ''}. O certo é: `;
  }, 400);
}

/* ---------------- 2. o enquadramento ---------------- */
function aacEstimativa(k){
  const c = AAC_CATALOGO[k], s = aac.sel;
  if (c.base === 'horas') return 'conforme as horas declaradas';
  if (c.base === 'colegiado') return 'a definir pelo Colegiado';
  const n = c.sem === 'siex' ? s.siex.length : aacConta().length;
  return `${n * c.cred} ${n * c.cred === 1 ? 'crédito' : 'créditos'}`;
}
function aacPassoEnquadramento(pode){
  const sem = aac.meu.semestres || [], s = aac.sel, conta = aacConta();
  const usa = k => s.principal === k || s.alternativas.includes(k);
  const sit = { conta:'conta', parcial:'menos de 4 meses', antes:'antes do ingresso' };
  const chipsSem = (campo) => `<div class="aac-chips">${conta.map(x => `<label class="aac-chip">
      <input type="checkbox" ${s[campo].includes(x.rotulo) ? 'checked' : ''} ${pode ? '' : 'disabled'}
        onchange="aacMarcarSem('${campo}','${esc(x.rotulo)}',this.checked)"><span>${esc(x.rotulo)}</span></label>`).join('')}</div>`;
  return `<div class="aac-sems">${sem.length ? sem.map(x => `<span class="aac-sem ${x.situacao}" title="${x.meses} ${x.meses === 1 ? 'mês' : 'meses'} de participação">
        <b>${esc(x.rotulo)}</b><i>${x.meses} ${x.meses === 1 ? 'mês' : 'meses'}, ${sit[x.situacao] || x.situacao}</i></span>`).join('')
      : '<span class="small muted">Nenhum semestre: falta a entrada na equipe.</span>'}
      ${dica('Conta o semestre com ao menos quatro meses de participação, sem os afastamentos, e posterior ao ingresso no curso (art. 5º).')}</div>
    <p class="small muted" style="margin:8px 0 14px">${conta.length} ${conta.length === 1 ? 'semestre letivo conta' : 'semestres letivos contam'}.</p>
    <div class="aac-cat">${Object.entries(AAC_CATALOGO).map(([k, c]) => `<div class="aac-op${s.principal === k ? ' pri' : usa(k) ? ' alt' : ''}${c.fora ? ' fora' : ''}">
        <div class="aac-cab"><span class="cod">${k}</span><b>${esc(c.nome)}</b></div>
        <span class="small">${c.fora ? 'Curso fora da Escola de Engenharia' : esc(c.disp)}. ${esc(c.regra)}. ${dica(c.quando)}</span>
        <span class="est">${aacEstimativa(k)}</span>
        <div class="esc">
          <label><input type="radio" name="aac-pri" value="${k}" ${s.principal === k ? 'checked' : ''} ${pode ? '' : 'disabled'} onchange="aacPrincipal('${k}')"> Principal</label>
          ${c.fora ? '' : `<label><input type="checkbox" ${s.alternativas.includes(k) ? 'checked' : ''} ${pode && s.principal !== k && s.principal !== 'OUT' ? '' : 'disabled'} onchange="aacAlternativa('${k}',this.checked)"> Alternativa</label>`}
        </div>
        ${c.sem && usa(k) ? `<div class="aac-semop"><span class="small">Semestres com registro no SIEX</span>${chipsSem(c.sem)}</div>` : ''}
      </div>`).join('')}</div>
    ${s.principal === 'OUT' ? `<div class="aac-out">
      <div class="fld full"><label for="aac-outro">Enquadramento, como a norma do Colegiado o nomeia</label>
        <input id="aac-outro" value="${esc(s.outro)}" maxlength="200" ${pode ? '' : 'disabled'} placeholder="Atividade complementar de extensão" oninput="aac.sel.outro=this.value"></div>
      <div class="fld full"><label for="aac-norma">Norma do Colegiado</label>
        <input id="aac-norma" value="${esc(s.norma)}" maxlength="200" ${pode ? '' : 'disabled'} placeholder="Resolução nº 05/2020, do Colegiado do Curso de Fisioterapia" oninput="aac.sel.norma=this.value"></div>
      <div class="fld"><label for="aac-ncurta">Forma curta <span class="opc">(opcional)</span></label>
        <input id="aac-ncurta" value="${esc(s.normacurta)}" maxlength="80" ${pode ? '' : 'disabled'} placeholder="Resolução nº 05/2020" oninput="aac.sel.normacurta=this.value"></div></div>` : ''}
    <p class="small muted" style="margin-top:10px">${aacSugestao()} ${dica(AAC_ITENS, 'As atividades que contam à parte')}</p>
    <div class="fld" style="max-width:560px;margin-top:12px"><label for="aac-col">Colegiado do curso <span class="opc">(opcional)</span></label>
      <input id="aac-col" value="${esc(s.colegiado)}" ${pode ? '' : 'disabled'} placeholder="Colegiado do Curso de Graduação em Engenharia Elétrica"
        oninput="aac.sel.colegiado=this.value"></div>
    ${pode ? `<div class="acts"><button class="btn solid" id="aac-enq-btn" onclick="aacSalvarEnquadramento()">${aac.meu.pedido ? 'Atualizar o enquadramento' : 'Guardar e criar o pedido'}</button></div>` : ''}`;
}
function aacSugestao(){
  const s = aac.sel, n = aacConta().length;
  if (s.principal === 'OUT') return 'O relatório pede o aproveitamento nos termos da norma do seu Colegiado, que define os créditos.';
  if (!n) return 'Sem semestre que conta, o enquadramento por semestre não rende créditos: considere a vivência profissional.';
  if (s.principal === 'EQC') return `Com a equipe de competição, ${n * 3} créditos pelos ${n} semestres${s.alternativas.length ? `, e ${s.alternativas.join(' e ')} para o Colegiado que não a acolher` : ''}.`;
  return `O principal escolhido é ${s.principal}. A participação em equipe de competição (EQC) costuma ser o enquadramento direto da equipe.`;
}
function aacPrincipal(k){
  aac.sel.principal = k; aac.sel.alternativas = k === 'OUT' ? [] : aac.sel.alternativas.filter(x => x !== k);
  aac.editandoEnq = true; aacRedesenharEnquadramento();
}
function aacAlternativa(k, on){
  const a = aac.sel.alternativas.filter(x => x !== k); if (on && !AAC_CATALOGO[k].fora) a.push(k);
  aac.sel.alternativas = Object.keys(AAC_CATALOGO).filter(x => a.includes(x));
  aac.editandoEnq = true; aacRedesenharEnquadramento();
}
function aacMarcarSem(campo, rot, on){
  const l = aac.sel[campo].filter(x => x !== rot); if (on) l.push(rot);
  aac.sel[campo] = aacConta().map(x => x.rotulo).filter(x => l.includes(x));
  aac.editandoEnq = true; aacRedesenharEnquadramento();
}
function aacRedesenharEnquadramento(){
  const el = $('#aac-p2 .aac-corpo'); if (!el) return;
  const p = aac.meu.pedido, pode = (!p || ['preparacao', 'devolvido'].includes(p.status)) && !(aac.meu.bloqueios || []).length;
  el.innerHTML = aacPassoEnquadramento(pode);
}
async function aacSalvarEnquadramento(){
  const s = aac.sel;
  const usa = k => s.principal === k || s.alternativas.includes(k);
  const out = s.principal === 'OUT';
  if (out && !s.outro.trim()) return toast(AAC_CAMPO_MSG.outro, true);
  if (out && !s.norma.trim()) return toast(AAC_CAMPO_MSG.norma, true);
  const p = { principal:s.principal, alternativas: out ? [] : s.alternativas, colegiado:s.colegiado || '',
              siex: usa('EXT') ? s.siex : [],
              ...(out ? { outro:s.outro.trim(), norma:s.norma.trim(), normacurta:s.normacurta.trim() } : {}) };
  const b = $('#aac-enq-btn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('aacc_preparar', { p });
  if (b) b.disabled = false;
  if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível guardar o enquadramento'), true);
  toast(aac.meu.pedido ? 'Enquadramento atualizado. Baixe o soma.tex de novo.' : `Pedido ${data.pedido?.codigo || ''} criado.`);
  aac.editandoEnq = false;
  aacMeu();
}

/* ---------------- 3. o relatório ---------------- */
function aacPassoRelatorio(p, pronto){
  if (!pronto) return '<p class="small muted">Guarde o enquadramento para baixar o template do seu pedido.</p>';
  return `<p class="small" style="margin-bottom:12px">O ZIP traz o template e o <b>soma.tex</b> do ${esc(p.codigo)}, com o que o SOMA sabe de você.
      ${dica('No Overleaf: Novo projeto, Carregar projeto, o ZIP. Escreva uma atividade por arquivo, a partir dos modelos do tipo certo, e troque "rascunho" por "final" quando terminar. O soma.tex não se edita: corrija no SOMA e baixe só ele de novo.')}</p>
    <div class="acts aac-baixar">
      <button class="btn solid" id="aac-zip-btn" onclick="aacBaixarZip()">${ic('down')} Baixar o template (ZIP)</button>
      <button class="btn ghost" onclick="aacBaixarSoma()">${ic('down')} Só o soma.tex</button>
      <a class="btn ghost" href="${AAC_EXEMPLO}" target="_blank" rel="noopener">${ic('externo')} O exemplo</a>
      <a class="btn ghost" href="https://www.overleaf.com/project" target="_blank" rel="noopener">${ic('externo')} Overleaf</a>
    </div>`;
}
/* o texto que o LaTeX aceita sem surpresa */
const aacTex = v => String(v == null ? '' : v).replace(/[\\{}$&#^_%~]/g, c => ({ '\\':'\\textbackslash{}', '{':'\\{', '}':'\\}', '$':'\\$',
  '&':'\\&', '#':'\\#', '^':'\\^{}', '_':'\\_', '%':'\\%', '~':'\\~{}' }[c])).replace(/\s+/g, ' ').trim();
function aacSomaTex(){
  const m = aac.meu, d = m.membro || {}, p = m.pedido, ped = p.pedido || {}, s = m.serie || {};
  const mes = iso => /^\d{4}-\d{2}/.test(String(iso || '')) ? String(iso).slice(0, 7) : '';
  const horas = min => { const h = Math.round((Number(min) || 0) / 6) / 10; return String(h).replace('.', ','); };
  const sup = d.supervisor && d.supervisor.nome ? `${d.supervisor.nome}${d.supervisor.cargo ? ', ' + d.supervisor.cargo : ''}` : '';
  const kv = o => Object.entries(o).map(([k, v]) => `  ${k.padEnd(12)} = {${aacTex(v)}},`).join('\n');
  const lista = l => (l || []).map(aacTex).join(', ');
  const af = (d.afastamentos || []).map(a => `  \\afastamento{${mes(a.inicio)}}{${mes(a.fim)}}{${aacTex((a.motivo || 'Afastamento') + ', aprovado no SOMA' + (a.protocolo ? ' (' + a.protocolo + ')' : ''))}.}%`);
  const tr = (d.treinamentos || []).map(t => `  \\treinamento{${aacTex(t.codigo)}}{${aacTex(t.titulo)}}{${horas(t.carga_horaria_min)}}{${aacTex(t.concluido_em)}}{${aacTex(t.certificado)}}%`);
  return `%% ============================================================
%% soma.tex: o que o SOMA sabe de você, para o pedido ${p.codigo}
%% Gerado em ${fmtD(hojeISO())}. Não edite: corrija no SOMA (Serviços,
%% Aproveitamento de AACC) e baixe de novo. Um campo vazio aqui o
%% relatório completa no preâmbulo.
%% ============================================================
\\documento{
  pn   = ${p.numero},
  soma = ${p.codigo},
}
\\serie{
${kv({ codigo: s.codigo || 'NRO-PES-020', revisao: s.revisao || 'A' })}
}
\\estudante{
${kv({ nome: d.nome, pronomes: d.pronomes || '', matricula: d.matricula, curso: d.curso, colegiado: ped.colegiado || '', email: d.email_pessoal || d.email, ingresso: d.ingresso })}
}
\\membro{
${kv({ registro: d.registro, situacao: d.situacao, inicio: mes(d.inicio), fim: d.situacao === 'egresso' ? mes(d.fim) : '',
       cargo: d.cargo, departamento: d.departamento, projetos: d.projetos, supervisor: sup })}
}
\\pedido{
  principal    = ${aacTex(ped.principal)},
  alternativas = {${lista(ped.alternativas)}},
  siex         = {${lista(ped.siex)}},
  outro        = {${aacTex(ped.outro || '')}},
}${ped.principal === 'OUT' && ped.norma ? `
%% a norma do seu Colegiado, no lugar da Resolução nº 02/2019
\\equipe{
  norma      = {${aacTex(ped.norma)}},
  normacurta = {${aacTex(ped.normacurta || ped.norma)}},
}` : ''}
\\afastamentosdosoma{%
${af.join('\n')}
}
\\treinamentosdosoma{%
${tr.join('\n')}
}
`;
}
function aacBaixarBlob(blob, nome){
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nome;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function aacBaixarSoma(){
  if (!aac.meu?.pedido) return;
  aacBaixarBlob(new Blob([aacSomaTex()], { type:'application/x-tex' }), 'soma.tex');
}
async function aacBaixarZip(){
  const b = $('#aac-zip-btn'); if (b){ b.disabled = true; b.innerHTML = `<span class="spin"></span> Montando o ZIP…`; }
  try{
    if (!window.JSZip) await carregarLib(AAC_CDN_JSZIP);
    const url = aac.meu.config?.template_url;
    const r = await fetch(url); if (!r.ok) throw new Error(`o template não veio (${r.status})`);
    const zip = await JSZip.loadAsync(await r.arrayBuffer());
    zip.file('soma.tex', aacSomaTex());
    const blob = await zip.generateAsync({ type:'blob', compression:'DEFLATE' });
    aacBaixarBlob(blob, `${aac.meu.pedido.codigo} relatorio-aacc.zip`);
    window.__aacZip = Object.keys(zip.files);
  }catch(e){ falha(e, 'Não foi possível montar o ZIP'); }
  finally{ const x = $('#aac-zip-btn'); if (x){ x.disabled = false; x.innerHTML = `${ic('down')} Baixar o template (ZIP)`; } }
}

/* ---------------- 4. o envio ---------------- */
function aacPassoEnvio(p, pode){
  if (!p) return '<p class="small muted">O envio abre depois do enquadramento.</p>';
  if (!pode) return `<p class="small muted">${p.status === 'concluido' ? 'Relatório aprovado.' : p.status === 'cancelado' ? 'Pedido cancelado.'
    : `Versão ${p.versao} enviada em ${fmtD(p.enviado_em)}.`} <a href="#/servicos/aproveitamento/${esc(p.codigo)}">Acompanhar</a></p>`;
  const v = aac.pdf;
  return `<p class="small" style="margin-bottom:10px">O PDF compilado em modo final, sem pendência.
      ${dica('A tela confere os metadados que o template grava no PDF: que é o relatório deste pedido, em modo final, sem pendência, com o enquadramento guardado e com a folha reservada ao SOMA. A folha de aprovação entra no lugar dela depois das aprovações.')}</p>
    <label class="aac-arq" for="aac-pdf">${ic('subir')}<span>${v ? esc(v.nome) : 'Escolher o PDF'}</span>
      <input type="file" id="aac-pdf" accept="application/pdf,.pdf"></label>
    ${v ? `<ul class="aac-checks">${v.checks.map(c => `<li class="${c.ok ? 'ok' : 'bad'}">${ic(c.ok ? 'check' : 'info')} ${esc(c.t)}</li>`).join('')}</ul>
      <div class="acts"><button class="btn solid" id="aac-env-btn" ${v.ok ? '' : 'disabled'} onclick="aacEnviar()">${ic('enviar')} Enviar para aprovação</button></div>` : ''}`;
}
function aacLigarEnvio(){
  const i = $('#aac-pdf'); if (!i) return;
  i.addEventListener('change', () => { const f = i.files && i.files[0]; if (f) aacLerPdf(f); });
}
/* "nro-aacc; documento=NRO-PES-020-7; modo=final; …" */
function aacLerMeta(kw){
  const s = String(kw || ''), o = { _template: s.split(';')[0].trim() === 'nro-aacc' };
  s.split(';').forEach(x => { const i = x.indexOf('='); if (i > 0) o[x.slice(0, i).trim()] = x.slice(i + 1).trim(); });
  return o;
}
async function aacLerPdf(f){
  const p = aac.meu.pedido;
  try{
    if (!window.PDFLib) await carregarLib(AAC_CDN_PDFLIB);
    const bytes = new Uint8Array(await f.arrayBuffer());
    if (bytes.length > 50 * 1024 * 1024) throw new Error('o PDF passa de 50 MB');
    const pdf = await PDFLib.PDFDocument.load(bytes, { updateMetadata:false });
    const meta = aacLerMeta(pdf.getKeywords());
    const pags = pdf.getPageCount(), folha = parseInt(meta.folha, 10);
    const sha = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
    const checks = [
      { ok: meta._template, t: meta._template ? 'Gerado pelo template do relatório de AACC.' : AAC_MOTIVO.nao_template },
      { ok: meta.exemplo !== 'sim', t: meta.exemplo === 'sim' ? AAC_MOTIVO.exemplo : 'Não é o exemplo.' },
      { ok: meta.documento === p.documento, t: meta.documento === p.documento ? `Relatório ${p.documento}.` : `O PDF é ${meta.documento || 'sem código'}; este pedido é ${p.documento}. Baixe o soma.tex deste pedido.` },
      { ok: meta.modo === 'final', t: meta.modo === 'final' ? 'Em modo final.' : AAC_MOTIVO.rascunho },
      { ok: meta.pendencias === '0', t: meta.pendencias === '0' ? 'Sem pendência.' : meta.pendencias && meta.pendencias !== '?'
          ? `Com ${meta.pendencias} ${meta.pendencias === '1' ? 'pendência' : 'pendências'}: a lista está logo depois dos quadros do pedido.` : 'Compile de novo: as pendências não foram contadas.' },
      { ok: meta.principal === p.pedido?.principal, t: meta.principal === p.pedido?.principal ? `Enquadramento ${meta.principal}.` : AAC_MOTIVO.outro_enquadramento },
      { ok: folha >= 2 && folha <= pags, t: folha >= 2 && folha <= pags ? `Folha reservada ao SOMA na página ${folha} de ${pags}.` : AAC_MOTIVO.sem_folha }
    ];
    if (meta.creditos) checks.push({ ok:true, t:`${meta.creditos} ${meta.creditos === '1' ? 'crédito declarado' : 'créditos declarados'}.` });
    aac.pdf = { arquivo:f, nome:f.name, bytes, sha, paginas:pags, keywords:pdf.getKeywords() || '', meta, checks, ok: checks.every(c => c.ok) };
  }catch(e){
    aac.pdf = { nome:f.name, checks:[{ ok:false, t:`Não foi possível ler o PDF (${e.message || e}).` }], ok:false };
  }
  const el = $('#aac-p4 .aac-corpo'); if (el){ el.innerHTML = aacPassoEnvio(p, true); aacLigarEnvio(); }
}
async function aacEnviar(){
  const p = aac.meu.pedido, v = aac.pdf; if (!v?.ok) return;
  const b = $('#aac-env-btn'); if (b){ b.disabled = true; b.innerHTML = '<span class="spin"></span> Enviando…'; }
  try{
    const caminho = `${p.registro}/${p.id}/v${(p.versao || 0) + 1}-${v.sha.slice(0, 8)}.pdf`;
    const up = await sb.storage.from('aproveitamento').upload(caminho, v.arquivo, { contentType:'application/pdf', upsert:false });
    if (up.error && !/exist/i.test(up.error.message || '')) throw up.error;
    const { data, error } = await sb.rpc('aacc_enviar', { p: { id:p.id, caminho, sha256:v.sha, paginas:v.paginas, bytes:v.bytes.length, keywords:v.keywords } });
    if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível enviar'), true);
    toast(data.avisados ? `Enviado. ${data.avisados === 1 ? 'Uma pessoa da primeira etapa foi avisada' : `${data.avisados} pessoas da primeira etapa foram avisadas`}.`
      : 'Enviado, mas a primeira etapa não tem ninguém para avisar. Informe o Depto. de Pessoal.', !data.avisados);
    aac.pdf = null;
    location.hash = `#/servicos/aproveitamento/${p.codigo}`;
  }catch(e){ falha(e, 'Não foi possível enviar'); }
  finally{ const x = $('#aac-env-btn'); if (x){ x.disabled = false; x.innerHTML = `${ic('enviar')} Enviar para aprovação`; } }
}

/* ============================================================
   AS LISTAS: para aprovar e todos
   ============================================================ */
async function aacLista(filtro){
  $('#main').innerHTML = aacCarregando();
  const [ok, m] = await Promise.all([aacCarregarLista(), aac.meu ? Promise.resolve({ data:aac.meu }) : sb.rpc('aacc_meu')]);
  if (!ok){ const { error } = await sb.rpc('aacc_lista'); $('#main').innerHTML = aacFaltaBanco(error); return; }
  aac.meu = m.data || aac.meu || {};
  const l = filtro === 'aprovar' ? aac.lista.filter(p => p.posso_decidir) : aac.lista.filter(p => p.versao > 0 || !p.meu);
  $('#main').innerHTML = `${aacTopo('Aproveitamento de AACC', '')}${aacNav(filtro)}
    ${l.length ? `<div class="evx-lista">${l.map(aacCartao).join('')}</div>`
      : `<div class="vazio"><div class="glyph">${filtro === 'aprovar' ? '✓' : '·'}</div>
          <h3>${filtro === 'aprovar' ? 'Nenhum pedido aguardando a sua decisão.' : 'Nenhum pedido enviado.'}</h3></div>`}`;
}
function aacCartao(p){
  const onde = p.status === 'analise' ? `etapa ${p.etapa} de ${p.n_etapas}, ${p.etapa_rotulo || ''}`
    : p.status === 'professor' ? `com ${p.prof_titulo || ''} ${p.prof_nome || ''}` : p.status === 'concluido' ? `nota ${aacVirgula(p.nota)}` : '';
  return `<a class="evx-card" href="#/servicos/aproveitamento/${esc(p.codigo)}">
    <span class="evx-tx"><span class="cod">${esc(p.codigo)} ${esc(p.documento || '')}</span>
      <span class="tt">${esc(p.nome)}</span>
      <span class="mt">${esc(AAC_CATALOGO[p.pedido?.principal]?.nome || p.pedido?.principal || '')}${p.versao ? `, versão ${p.versao}` : ''}${p.enviado_em ? `, enviado em ${fmtD(p.enviado_em)}` : ''}</span></span>
    <span class="evx-lado">${aacPill(p.status)}${onde ? `<span class="small">${esc(onde)}</span>` : ''}
      ${p.posso_decidir ? '<span class="tag-mini evx-sua">espera você</span>' : ''}</span></a>`;
}

/* ============================================================
   UM PEDIDO
   ============================================================ */
const AAC_ACAO = { criou:'criou o pedido', preparou:'mudou o enquadramento', enviou:'enviou o relatório', aprovou:'aprovou',
  devolveu:'devolveu', indicou:'indicou o professor orientador', reenviou:'mandou o link ao professor de novo', abriu:'abriu o link',
  concluiu:'aprovou como professor orientador', reabriu:'reabriu', cancelou:'cancelou' };
async function aacPagina(codigo){
  $('#main').innerHTML = aacCarregando('Abrindo o pedido…');
  const { data, error } = await sb.rpc('aacc_ler', { p_codigo: codigo });
  if (error){ $('#main').innerHTML = aacFaltaBanco(error); return; }
  if (data?.status !== 'ok'){
    $('#main').innerHTML = `<div class="vazio" style="margin-top:40px"><div class="glyph">?</div><h3>Nenhum pedido ${esc(codigo)} para você.</h3>
      <a class="btn ghost" href="#/servicos/aproveitamento">Aproveitamento de AACC</a></div>`;
    return;
  }
  aac.atual = data;
  aacDesenharPagina();
}
function aacDesenharPagina(){
  const r = aac.atual, p = r.pedido, pode = r.pode || {}, dd = p.dados || {}, d = dd.membro || {}, ped = p.pedido || {};
  const meta = p.pdf_meta || {};
  const decVersao = (r.decisoes || []).filter(x => x.versao === p.versao);
  const etapas = (r.etapas || []).map(e => {
    const a = decVersao.find(x => x.etapa === e.etapa && x.decisao === 'aprovada');
    const atual = p.status === 'analise' && p.etapa === e.etapa;
    return `<li class="${a ? 'ok' : atual ? 'atual' : ''}"><span class="n">${e.etapa}</span><div><b>${esc(e.rotulo)}</b>
      <span class="small dim">${esc(e.grupo || 'sem grupo')}</span>
      ${a ? `<span class="small">${ic('check')} ${esc(a.nome)}, ${fmtDT(a.criado_em)}${a.parecer ? `<i>${esc(a.parecer)}</i>` : ''}</span>`
        : atual ? '<span class="small" style="color:var(--warn-tx)">aguardando</span>' : ''}</div></li>`;
  }).join('');
  const nE = (r.etapas || []).length;
  const prof = ['professor', 'concluido'].includes(p.status) || p.prof_nome;
  const acoes = [
    pode.decidir ? `<button class="btn solid" onclick="aacModalDecidir('aprovar')">${ic('check')} Aprovar</button>
      <button class="btn ghost" onclick="aacModalDecidir('devolver')">Devolver</button>` : '',
    pode.baixar_final ? `<button class="btn solid" onclick="aacBaixarFinal('${esc(p.id)}')">${ic('down')} PDF final</button>` : ''
  ].join('');
  $('#main').innerHTML = `
    <a class="tre-voltar" href="#/servicos/aproveitamento${pode.enviar || p.registro === state.perfil?.registro ? '' : '/todos'}" style="margin-top:22px">${ic('back')} Aproveitamento de AACC</a>
    ${aacTopo(`${esc(p.codigo)} ${esc(p.nome)}`, '', acoes, p.documento ? `Relatório ${p.documento}` : 'Aproveitamento de AACC')}
    <div class="evx-selos">${aacPill(p.status)}${p.versao > 1 ? `<span class="pill"><span class="dt dt-gray"></span>versão ${p.versao}</span>` : ''}
      ${p.status === 'analise' ? `<span class="pill"><span class="dt dt-warn"></span>etapa ${p.etapa} de ${nE}</span>` : ''}</div>
    ${p.status === 'devolvido' && p.motivo ? `<div class="aviso-box warn"><b>Devolvido.</b> ${esc(p.motivo)}${pode.enviar ? ` <a href="#/servicos/aproveitamento">Enviar de novo</a>` : ''}</div>` : ''}
    ${p.status === 'cancelado' ? `<div class="aviso-box err">Cancelado: ${esc(p.motivo || '')}</div>` : ''}
    ${p.status === 'concluido' ? `<div class="evx-minha"><span>${ic('selo')}</span><div><b>Aprovado pelo professor orientador, nota ${esc(aacVirgula(p.nota))} de 100</b>
      <span class="small">Folha de aprovação <b>${esc(p.emitido || '')}</b>, conferível em auth.neurodynamics.dev. O PDF final é o relatório com a folha no lugar da página ${p.folha}.</span></div>
      <button class="btn ghost" onclick="aacBaixarFolha('${esc(p.id)}')">Só a folha</button></div>` : ''}
    <div class="evx-cols">
      <div class="evx-main">
        <div class="card"><dl class="dcl-dados evx-dados aac-dados">
          <div><dt>Nome</dt><dd>${esc(p.nome)}</dd></div>
          <div><dt>Curso</dt><dd>${esc(d.curso || '—')}${d.ingresso ? `, ingresso em ${esc(d.ingresso)}` : ''}</dd></div>
          <div><dt>Matrícula</dt><dd>${esc(d.matricula || '—')}</dd></div>
          <div><dt>Na equipe</dt><dd>${d.inicio ? `${aacMesAno(d.inicio)} a ${d.situacao === 'egresso' ? aacMesAno(d.fim) : 'hoje'}` : '—'}${d.situacao === 'egresso' ? ` (${aacPron(d.pronomes, 'egresso', 'egressa', 'egresse')})` : ''}</dd></div>
          <div class="full"><dt>Enquadramento</dt><dd>${esc(ped.principal || '')} ${esc(ped.principal === 'OUT' ? (ped.outro || '') : AAC_CATALOGO[ped.principal]?.nome || '')}${ped.principal === 'OUT' && ped.norma
            ? `, nos termos da ${esc(ped.norma)}` : ''}${(ped.alternativas || []).length
            ? `; alternativas: ${(ped.alternativas || []).map(esc).join(', ')}` : ''}${(ped.siex || []).length ? `; SIEX em ${ped.siex.map(esc).join(', ')}` : ''}</dd></div>
          ${ped.colegiado ? `<div class="full"><dt>Colegiado</dt><dd>${esc(ped.colegiado)}</dd></div>` : ''}
          <div class="full"><dt>Semestres letivos</dt><dd>${(p.semestres || []).map(s => `<span class="aac-sem mini ${s.situacao}"><b>${esc(s.rotulo)}</b><i>${s.meses} m</i></span>`).join(' ') || '—'}</dd></div>
          ${p.versao ? `<div><dt>Créditos declarados</dt><dd>${esc(meta.creditos || '—')}${meta.itens && meta.itens !== '0' ? ` (${esc(meta.itens)} à parte)` : ''}</dd></div>
          <div><dt>Relatório</dt><dd>versão ${p.versao}, ${p.pdf_paginas} páginas, ${fmtD(p.enviado_em)}
            <button class="btn ghost mini" style="margin-left:6px" onclick="aacAbrirPdf()">${ic('eye')} Abrir</button></dd></div>` : ''}
        </dl></div>
        ${prof ? `<div class="card aac-prof" style="margin-top:16px"><h3>${ic('capelo')} ${aacProfessora(p.prof_titulo) ? 'Professora orientadora' : 'Professor orientador'}</h3>
          <p><b>${esc(p.prof_titulo || '')} ${esc(p.prof_nome || '')}</b> <span class="small dim">${esc(p.prof_email || '')}</span></p>
          ${p.prof_departamento || p.prof_unidade ? `<p class="small">${esc([p.prof_departamento, p.prof_unidade].filter(Boolean).join(', '))}</p>` : ''}
          <p class="small muted">${p.prof_indicado_nome ? `Indicado por ${esc(p.prof_indicado_nome)} em ${fmtDT(p.prof_indicado_em)}. ` : ''}${p.status === 'professor'
            ? `Link válido até ${fmtD(p.prof_expira)}. ${p.prof_visto_em ? `Aberto em ${fmtDT(p.prof_visto_em)}.` : 'Ainda não aberto.'}` : ''}</p>
          ${p.status === 'concluido' && Array.isArray(p.barema) ? `<table class="tabela aac-barema"><thead><tr><th>Critério</th><th>Peso</th><th>Nota</th><th>Pontos</th></tr></thead>
            <tbody>${p.barema.map(b => `<tr><td>${esc(b.nome)}</td><td>${b.peso}</td><td>${aacVirgula(b.nota)}</td><td>${aacVirgula(b.pontos)}</td></tr>`).join('')}
            <tr class="tot"><td>Nota final</td><td>100</td><td></td><td>${aacVirgula(p.nota)}</td></tr></tbody></table>
            ${p.parecer_prof ? `<p class="small" style="margin-top:8px"><i>${esc(p.parecer_prof)}</i></p>` : ''}` : ''}
          ${pode.trocar_professor ? `<div class="acts"><button class="btn ghost mini" onclick="aacModalProfessor()">${ic('mail')} Trocar o professor ou mandar o link de novo</button></div>` : ''}
        </div>` : ''}
      </div>
      <aside class="evx-lado-col">
        <div class="card evx-aprov aac-etapas"><h3>${ic('shield')} Aprovação</h3>
          <p class="small muted">Uma pessoa de cada etapa, nunca a mesma em duas, e depois o professor orientador. ${dica('Qualquer etapa pode devolver o pedido, com o motivo. O envio seguinte recomeça da primeira etapa.')}</p>
          <ol>${etapas}<li class="${p.status === 'concluido' ? 'ok' : p.status === 'professor' ? 'atual' : ''}"><span class="n">${nE + 1}</span><div><b>Professor orientador</b>
            ${p.status === 'concluido' ? `<span class="small">${ic('check')} ${esc(p.prof_titulo || '')} ${esc(p.prof_nome || '')}</span>`
              : p.status === 'professor' ? '<span class="small" style="color:var(--warn-tx)">aguardando</span>' : '<span class="small dim">indicado na última etapa</span>'}</div></li></ol>
          ${pode.decidir ? `<div class="acts" style="margin-top:12px"><button class="btn solid mini" onclick="aacModalDecidir('aprovar')">${ic('check')} Aprovar</button>
            <button class="btn ghost mini" onclick="aacModalDecidir('devolver')">Devolver</button></div>` : ''}
          ${pode.reabrir || pode.cancelar ? `<div class="acts" style="margin-top:12px">
            ${pode.reabrir ? `<button class="btn ghost mini" onclick="aacModalMotivo('reabrir','${esc(p.id)}')">Reabrir</button>` : ''}
            ${pode.cancelar ? `<button class="btn ghost mini" onclick="aacModalMotivo('cancelar','${esc(p.id)}')">Cancelar o pedido</button>` : ''}</div>` : ''}
        </div>
        <div class="card evx-hist"><h3>${ic('relogio')} Histórico</h3>
          <ol>${(r.historico || []).slice().reverse().map(h => `<li><span class="qd">${fmtDT(h.criado_em)}</span>
            <b>${esc(h.nome || '')}</b> ${esc(AAC_ACAO[h.acao] || h.acao)}${h.detalhe ? `<span class="small" style="display:block">${esc(h.detalhe)}</span>` : ''}</li>`).join('')}</ol></div>
      </aside>
    </div>`;
}
async function aacAbrirPdf(){
  const p = aac.atual?.pedido; if (!p?.pdf_caminho) return;
  const janela = window.open('', '_blank');
  const { data, error } = await sb.storage.from('aproveitamento').createSignedUrl(p.pdf_caminho, 600);
  if (error || !data?.signedUrl){ if (janela) janela.close(); return toast('Não foi possível abrir o PDF.', true); }
  if (janela) janela.location.href = data.signedUrl; else location.href = data.signedUrl;
}

/* ---------------- decidir ---------------- */
/* Prof.ª, Dr.ª, Ma. (mestra) e Me. (mestre): as abreviaturas com o
   ordinal feminino, como a norma culta as escreve */
const AAC_TITULOS = ['Prof. Dr.', 'Prof.ª Dr.ª', 'Prof. Me.', 'Prof.ª Ma.', 'Prof.', 'Prof.ª'];
const aacProfessora = t => /^prof(a\b|\.?ª|essora)/i.test(String(t || '').trim());
const aacCamposProfessor = (pr = {}) => {
  const dom = aac.atual?.config?.dominio_professor || 'ufmg.br';
  return `<div class="aac-prof-f">
    <div class="fld"><label for="aac-pt">Título</label><select id="aac-pt">${AAC_TITULOS.map(t => `<option ${t === pr.titulo ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
    <div class="fld"><label for="aac-pn">Nome completo</label><input id="aac-pn" value="${esc(pr.nome || '')}" placeholder="Henrique Resende Martins"></div>
    <div class="fld full"><label for="aac-pe">E-mail institucional</label><input id="aac-pe" type="email" value="${esc(pr.email || '')}" placeholder="nome@${esc(dom)}"></div>
    <div class="fld full"><label for="aac-pd">Departamento</label><input id="aac-pd" value="${esc(pr.departamento || '')}" maxlength="160" placeholder="Departamento de Engenharia Elétrica"></div>
    <div class="fld full"><label for="aac-pu">Unidade acadêmica</label><input id="aac-pu" value="${esc(pr.unidade || '')}" maxlength="160" list="aac-l-unidades" placeholder="Escola de Engenharia">
      <datalist id="aac-l-unidades">${AAC_UNIDADES.map(u => `<option value="${esc(u)}">`).join('')}</datalist></div></div>`;
};
function aacModalDecidir(dec){
  const r = aac.atual, p = r.pedido, indicar = dec === 'aprovar' && r.pode?.indicar;
  abreModal(`<h3>${dec === 'aprovar' ? 'Aprovar' : 'Devolver'} ${esc(p.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">${dec === 'devolver' ? 'O pedido volta para quem pediu, com o motivo; o envio seguinte recomeça da primeira etapa.'
      : indicar ? `Última etapa da equipe. Indique o professor orientador: ele recebe por e-mail um link pessoal, válido por ${r.config?.prazo_professor_dias || 30} dias, para avaliar pelo barema e aprovar.`
      : `Etapa ${esc(p.etapa_rotulo || p.etapa)}. Aprovado, o pedido segue para a próxima.`}</p>
    ${indicar ? aacCamposProfessor() : ''}
    <div class="fld"><label for="aac-par">${dec === 'aprovar' ? 'Parecer <span class="opc">(opcional)</span>' : 'Motivo'}</label>
      <textarea id="aac-par" rows="3" maxlength="1200" placeholder="${dec === 'aprovar' ? 'Conferido com os registros do SOMA.' : 'A memória de cálculo das horas não fecha com os apontamentos.'}"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="aac-dbtn" onclick="aacDecidir('${dec}')">${dec === 'aprovar' ? (indicar ? 'Aprovar e mandar ao professor' : 'Aprovar') : 'Devolver'}</button></div>`);
}
const aacProfessorLido = () => ({ titulo: $('#aac-pt')?.value || '', nome: ($('#aac-pn')?.value || '').trim(), email: ($('#aac-pe')?.value || '').trim(),
  departamento: ($('#aac-pd')?.value || '').trim(), unidade: ($('#aac-pu')?.value || '').trim() });
/* o link do PDF para o professor: assinado aqui, com validade de um
   pouco mais que o prazo dele (o banco confere que é o desta versão) */
async function aacLinkPdf(p){
  const dias = Number(aac.atual?.config?.prazo_professor_dias || 30) + 7;
  const { data, error } = await sb.storage.from('aproveitamento').createSignedUrl(p.pdf_caminho, dias * 86400);
  if (error || !data?.signedUrl) throw new Error(error?.message || 'sem link');
  return data.signedUrl;
}
async function aacDecidir(dec){
  const r = aac.atual, p = r.pedido, par = $('#aac-par')?.value.trim() || '';
  if (dec === 'devolver' && !par) return toast('Informe o motivo.', true);
  const corpo = { id:p.id, decisao:dec, parecer:par };
  const b = $('#aac-dbtn'); if (b) b.disabled = true;
  try{
    if (dec === 'aprovar' && r.pode?.indicar){
      corpo.professor = aacProfessorLido();
      if (corpo.professor.nome.length < 5) return toast(AAC_CAMPO_MSG.professor_nome, true);
      if (corpo.professor.departamento.length < 3) return toast(AAC_CAMPO_MSG.professor_departamento, true);
      if (corpo.professor.unidade.length < 3) return toast(AAC_CAMPO_MSG.professor_unidade, true);
      corpo.pdf_url = await aacLinkPdf(p);
    }
    const { data, error } = await sb.rpc('aacc_decidir', { p: corpo });
    if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível registrar a decisão'), true);
    fechaModal();
    toast(data.situacao === 'professor' ? 'Aprovado. O professor orientador recebe o link por e-mail.'
      : data.situacao === 'analise' ? `Aprovado. O pedido seguiu para a etapa ${data.etapa}.` : 'Devolvido.');
    aacPagina(p.codigo);
  }catch(e){ falha(e, 'Não foi possível registrar a decisão'); }
  finally{ if (b) b.disabled = false; }
}
function aacModalProfessor(){
  const p = aac.atual.pedido;
  abreModal(`<h3>Professor orientador do ${esc(p.codigo)}</h3>
    <p class="sub" style="margin-bottom:14px">Um link novo segue por e-mail; o anterior deixa de valer.</p>
    ${aacCamposProfessor({ titulo:p.prof_titulo, nome:p.prof_nome, email:p.prof_email, departamento:p.prof_departamento, unidade:p.prof_unidade })}
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Cancelar</button>
      <button class="btn solid" id="aac-pbtn" onclick="aacTrocarProfessor()">Mandar o link</button></div>`);
}
async function aacTrocarProfessor(){
  const p = aac.atual.pedido, b = $('#aac-pbtn'); if (b) b.disabled = true;
  try{
    const { data, error } = await sb.rpc('aacc_professor_trocar', { p: { id:p.id, professor:aacProfessorLido(), pdf_url: await aacLinkPdf(p) } });
    if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível mandar o link'), true);
    fechaModal(); toast('Link enviado ao professor.'); aacPagina(p.codigo);
  }catch(e){ falha(e, 'Não foi possível mandar o link'); }
  finally{ if (b) b.disabled = false; }
}
function aacModalMotivo(acao, id){
  abreModal(`<h3>${acao === 'reabrir' ? 'Reabrir o pedido' : 'Cancelar o pedido'}</h3>
    <p class="sub" style="margin-bottom:14px">${acao === 'reabrir'
      ? 'A folha de aprovação atual é revogada (a validação passa a mostrar a revogação), e o relatório corrigido passa pelas aprovações outra vez.'
      : 'O pedido é encerrado sem aprovação. Um pedido novo pode ser aberto depois.'}</p>
    <div class="fld"><label for="aac-mot">Motivo</label><textarea id="aac-mot" rows="3" placeholder="${acao === 'reabrir'
      ? 'O Colegiado pediu a declaração de vínculo no anexo.' : 'Vou pedir no próximo semestre.'}"></textarea></div>
    <div class="acts" style="justify-content:flex-end"><button class="btn ghost" onclick="fechaModal()">Voltar</button>
      <button class="btn ${acao === 'cancelar' ? 'perigo' : 'solid'}" onclick="aacMotivoConfirma('${acao}','${esc(id)}')">${acao === 'reabrir' ? 'Reabrir' : 'Cancelar o pedido'}</button></div>`);
}
async function aacMotivoConfirma(acao, id){
  const mot = $('#aac-mot')?.value.trim();
  if (!mot) return toast('Informe o motivo.', true);
  const { data, error } = await sb.rpc(acao === 'reabrir' ? 'aacc_reabrir' : 'aacc_cancelar', { p_id:id, p_motivo:mot });
  if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, acao === 'reabrir' ? 'Não foi possível reabrir' : 'Não foi possível cancelar'), true);
  fechaModal();
  toast(acao === 'reabrir' ? 'Pedido reaberto. Corrija o relatório e envie de novo.' : 'Pedido cancelado.');
  if (aac.atual?.pedido?.id === id && location.hash.includes('/AAC-')) aacPagina(aac.atual.pedido.codigo); else aacMeu();
}

/* ============================================================
   O PDF FINAL: o relatório com a folha de aprovação no lugar da
   folha reservada. A folha é desenhada por cima da página (a página
   continua a mesma, e os marcadores e links do relatório que apontam
   para ela continuam valendo); o link de validação vai sobre a
   legenda de autenticação. Na capa, o "Pendente" da avaliação da
   equipe vira a data da aprovação: o template grava onde ele está
   (avaliacao=x,y, em mm a partir do canto de baixo, à esquerda).
   ============================================================ */
async function aacFolhaDoc(id){
  const { data, error } = await sb.rpc('aacc_folha', { p_id:id });
  if (error || data?.status !== 'ok') throw new Error(aacMotivo(data, error, 'Não foi possível ler a folha'));
  await precisaDocNRO(); await DocNRO.precisa({ selo:true });
  return { f:data, doc: DocNRO.folhaAprovacaoAacc(data.emissao, { pagina:data.folha, paginas:data.paginas }) };
}
async function aacBaixarFolha(id){
  const t = setTimeout(() => toast('Preparando a folha…'), 350);
  try{ const { doc } = await aacFolhaDoc(id); DocNRO.baixar(doc); }
  catch(e){ falha(e, 'Não foi possível gerar a folha'); }
  finally{ clearTimeout(t); }
}
async function aacBaixarFinal(id){
  const t = setTimeout(() => toast('Montando o PDF final…'), 350);
  try{
    const [{ f, doc }] = await Promise.all([aacFolhaDoc(id), window.PDFLib ? null : carregarLib(AAC_CDN_PDFLIB)]);
    const { data:blob, error } = await sb.storage.from('aproveitamento').download(f.pdf_caminho);
    if (error || !blob) throw new Error(error?.message || 'o relatório não veio do armazenamento');
    const bytes = await aacMontarFinal(new Uint8Array(await blob.arrayBuffer()), new Uint8Array(doc.output('arraybuffer')), f, doc.__link);
    const e = f.emissao, nome = `${e.documento} RELATÓRIO DE ATIVIDADES PARA APROVEITAMENTO DE AACC - ${String(e.titular || '').replace(/[\\/:*?"<>|]+/g, '-')}.pdf`;
    window.__aacFinal = { nome, bytes:bytes.length, folha:f.folha, paginas:f.paginas, textos:doc.__textos.map(x => x.join(' ')) };
    aacBaixarBlob(new Blob([bytes], { type:'application/pdf' }), nome);
  }catch(e){ falha(e, 'Não foi possível montar o PDF final'); }
  finally{ clearTimeout(t); }
}
async function aacMontarFinal(relBytes, folhaBytes, f, link){
  const { PDFDocument, PDFName, PDFString, StandardFonts, rgb } = PDFLib;
  const rel = await PDFDocument.load(relBytes, { updateMetadata:false });
  const n = rel.getPageCount();
  if (f.folha < 1 || f.folha > n) throw new Error('a folha reservada não está no relatório');
  const pos = String(aacLerMeta(rel.getKeywords()).avaliacao || '').split(',').map(Number);
  if (pos.length === 2 && pos.every(v => Number.isFinite(v) && v > 0)){
    const capa = rel.getPage(0), mm = 72 / 25.4, x = pos[0] * mm, y = pos[1] * mm;
    const fonte = await rel.embedFont(StandardFonts.HelveticaBold);
    capa.drawRectangle({ x: x - 1, y: y - 3, width: 45 * mm, height: 12.5, color: rgb(1, 1, 1) });
    capa.drawText(`Aprovada em ${fmtD(f.emissao.dados?.data || f.emissao.emitido_em)}`, { x, y, size: 9, font: fonte, color: rgb(29 / 255, 29 / 255, 31 / 255) });
  }
  const [emb] = await rel.embedPdf(folhaBytes, [0]);
  const pg = rel.getPage(f.folha - 1);
  const { width, height } = pg.getSize();
  /* o que a folha reservada desenhava sai; a folha de aprovação entra no lugar */
  pg.node.set(PDFName.of('Contents'), rel.context.obj([]));
  pg.node.delete(PDFName.of('Annots'));
  pg.drawPage(emb, { x:0, y:0, width, height });
  if (link){
    const k = 72 / 25.4 * (width / 595.28);
    const annot = rel.context.obj({ Type:'Annot', Subtype:'Link', Border:[0, 0, 0],
      Rect:[link.x * k, height - (link.y + link.h) * k, (link.x + link.w) * k, height - link.y * k],
      A:{ Type:'Action', S:'URI', URI: PDFString.of(link.url) } });
    pg.node.set(PDFName.of('Annots'), rel.context.obj([rel.context.register(annot)]));
  }
  rel.setSubject(`${f.emissao.documento}, aprovado. Folha de aprovação ${f.emissao.codigo}, conferível em ${String(f.emissao.url_validacao || 'https://auth.neurodynamics.dev').replace(/^https?:\/\//, '')}`);
  rel.setKeywords([[String(rel.getKeywords() || '').trim(), `aprovacao=${f.emissao.codigo}`].filter(Boolean).join('; ')]);
  rel.setModificationDate(new Date());
  return rel.save();
}

/* ============================================================
   AS CONFIGURAÇÕES: as etapas e o professor
   ============================================================ */
async function aacConfig(){
  $('#main').innerHTML = aacCarregando();
  const [c] = await Promise.all([sb.from('aacc_config').select('*').maybeSingle(), aac.meu ? null : sb.rpc('aacc_meu').then(r => { aac.meu = r.data || {}; })]);
  if (c.error){ $('#main').innerHTML = aacFaltaBanco(c.error); return; }
  aac.cfg = c.data || {};
  aac.cfgEtapas = (aac.cfg.grupos || []).map((g, i) => ({ grupo_id:g, rotulo:(aac.cfg.rotulos || [])[i] || '' }));
  aacConfigDesenhar();
}
function aacConfigDesenhar(){
  const c = aac.cfg, gs = [...(state.grupos || [])].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
  $('#main').innerHTML = `${aacTopo('Aproveitamento de AACC', '')}${aacNav('config')}
    <div class="evx-cfg">
      <div class="card"><h3>Etapas da aprovação</h3>
        <p class="small muted" style="margin-bottom:12px">Uma pessoa de cada grupo, nesta ordem. A última indica o professor orientador.
          ${dica('O nome de cada etapa é o que a folha de aprovação imprime. Quem está num grupo abaixo do escolhido também decide. Etapa sem grupo trava o pedido nela.')}</p>
        <div id="aac-etapas">${aac.cfgEtapas.map((e, i) => `<div class="aac-etapa-l">
          <span class="n">${i + 1}</span>
          <select data-i="${i}" onchange="aac.cfgEtapas[${i}].grupo_id=Number(this.value)||null"><option value="">Escolha o grupo</option>${gs.map(g =>
            `<option value="${g.id}" ${g.id === e.grupo_id ? 'selected' : ''}>${esc(g.nome)}</option>`).join('')}</select>
          <input value="${esc(e.rotulo)}" placeholder="Nome na folha" oninput="aac.cfgEtapas[${i}].rotulo=this.value">
          <button class="icon-btn sm" title="Tirar a etapa" aria-label="Tirar a etapa ${i + 1}" onclick="aac.cfgEtapas.splice(${i},1);aacConfigDesenhar()">${ic('trash')}</button></div>`).join('')}</div>
        ${aac.cfgEtapas.length < 5 ? `<button class="btn ghost mini" style="margin-top:10px" onclick="aac.cfgEtapas.push({grupo_id:null,rotulo:''});aacConfigDesenhar()">${ic('plus')} Etapa</button>` : ''}
      </div>
      <div class="card"><h3>Professor orientador</h3>
        <div class="fld"><label for="aac-dom">Domínio do e-mail</label><input id="aac-dom" value="${esc(c.dominio_professor || '')}" placeholder="ufmg.br"></div>
        <div class="fld"><label for="aac-prazo">Validade do link (dias)</label><input id="aac-prazo" type="number" min="3" max="120" value="${esc(c.prazo_professor_dias || 30)}"></div>
        <div class="fld"><label for="aac-tpl">Template (ZIP)</label><input id="aac-tpl" value="${esc(c.template_url || '')}"></div>
        <p class="small muted">Nota mínima ${esc(c.nota_minima || 60)} (art. 3º, II). Barema: ${(c.barema || []).map(b => `${esc(b.nome)} (${b.peso})`).join(', ')}.
          ${dica('O barema é o mesmo do template (nro/avaliacao.tex). Mudar um exige mudar o outro.')}</p>
      </div>
    </div>
    <div class="acts" style="margin-top:16px"><button class="btn solid" id="aac-cfg-btn" onclick="aacConfigSalvar()">Salvar</button></div>`;
}
async function aacConfigSalvar(){
  const et = aac.cfgEtapas;
  if (!et.length || et.some(e => !e.grupo_id)) return toast('Escolha o grupo de cada etapa.', true);
  const b = $('#aac-cfg-btn'); if (b) b.disabled = true;
  const { data, error } = await sb.rpc('aacc_config_salvar', { p: { etapas:et.map(e => ({ grupo_id:e.grupo_id, rotulo:e.rotulo.trim() })),
    dominio_professor: $('#aac-dom').value.trim(), prazo_professor_dias: Number($('#aac-prazo').value) || 30, template_url: $('#aac-tpl').value.trim() } });
  if (b) b.disabled = false;
  if (error || data?.status !== 'ok') return toast(aacMotivo(data, error, 'Não foi possível salvar'), true);
  toast('Configurações salvas.');
  aacConfig();
}

/* a busca: os pedidos que a pessoa vê */
registrarBusca({
  fonte: 'aproveitamento',
  rotulo: 'Aproveitamento de AACC',
  buscar: termo => {
    const t = norm(termo);
    return (aac.lista || []).filter(p => norm(p.codigo).includes(t) || norm(p.nome).includes(t)).slice(0, 8)
      .map(p => ({ titulo: `${p.codigo} ${p.nome}`, sub: (AAC_STATUS[p.status] || {}).l || p.status,
                   href: '#/servicos/aproveitamento/' + p.codigo, peso: norm(p.codigo) === t ? 10 : 4 }));
  }
});
