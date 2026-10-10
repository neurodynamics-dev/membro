/* ============================================================
   #/dev/templates: o catálogo vivo dos templates de tela
   (PLANO-DESIGN-SYSTEM.md, seção 3). Fora do menu, só admin. Cada
   seção monta uma tela de mentira com as funções da casca
   (cabecalho, ferramentas, layoutObjeto, spec, etapas, layoutFluxo,
   layoutLeitura, ajuste, estado). Ao refatorar uma tela: ache aqui
   o template dela, copie a forma, troque os dados.
   testes/templates.mjs fotografa cada seção nos dois temas.
   ============================================================ */
const TPL_SECOES = [
  ['', 'L, Lista'], ['objeto', 'O, Objeto'], ['fluxo', 'F, Fluxo'], ['painel', 'P, Painel'],
  ['leitura', 'E, Leitura'], ['ajustes', 'A, Ajustes'], ['trabalho', 'T, Área de trabalho'], ['estados', 'Estados']
];
const tplNav = atual => navNivel1(TPL_SECOES.map(([k, l]) => [k, l, '#/dev/templates' + (k ? '/' + k : '')]), atual, 'Templates');
const tplPill = (t, c) => `<span class="pill ${c || ''}"><span class="dt dt-${c === 'p-ok' ? 'ok' : c === 'p-warn' ? 'warn' : 'idle'}"></span>${esc(t)}</span>`;
const TPL_PESSOAS = [['004', 'Ana Figueiredo', 'Engenharia', 'Gerente de projeto', 'Ativo'],
  ['011', 'Bruno Tavares', 'Pesquisa', 'Pesquisador', 'Ativo'], ['017', 'Carla Mendonça', 'Engenharia', 'Desenvolvedora', 'Em pausa']];

/* #/dev/templates[/<seção>]: a rota é dev, o sub é "templates", o sub2 a seção */
function pageDevTemplates(sub, sub2){
  if (sub !== 'templates'){ location.hash = '#/dev/templates'; return; }
  const k = sub2 || '';
  const desenho = { '': tplLista, objeto: tplObjeto, fluxo: tplFluxo, painel: tplPainel, leitura: tplLeitura,
    ajustes: tplAjustes, trabalho: tplTrabalho, estados: tplEstados }[k] || tplLista;
  $('#main').innerHTML = desenho(k);
}

function tplLista(k){
  return cabecalho({ espaco: 'Equipe', titulo: 'Quadro de pessoal',
    acoes: [`<button class="btn ghost">Exportar planilha</button>`, `<button class="btn solid">${ic('plus')}Novo membro</button>`],
    secoes: tplNav(k) })
  + ferramentas({ busca: { id: 'tpl-busca', rotulo: 'Buscar', exemplo: 'Nome, e-mail ou registro' },
      filtros: `<div class="seg" role="group" aria-label="Situação"><button class="on">Ativos</button><button>Em pausa</button><button>Todos</button></div>`,
      total: 3 })
  + `<div class="card" style="padding:0"><div class="wrap"><table class="tabela trabalho"><thead><tr><th>Reg.</th><th>Nome</th><th>Departamento</th><th>Cargo</th><th>Situação</th></tr></thead><tbody>${
      TPL_PESSOAS.map(([r, n, d, c, st]) => `<tr><td class="num">${r}</td><td><a href="#/dev/templates/objeto">${esc(n)}</a></td><td>${esc(d)}</td><td>${esc(c)}</td><td>${tplPill(st, st === 'Ativo' ? 'p-ok' : 'p-warn')}</td></tr>`).join('')
    }</tbody></table></div></div>`;
}

function tplObjeto(k){
  return cabecalho({ espaco: 'Equipe', titulo: 'Ana Figueiredo', voltar: ['Quadro de pessoal', '#/dev/templates'],
    codigo: '004', meta: [tplPill('Ativo', 'p-ok'), 'Engenharia, gerente de projeto'],
    acoes: [`<button class="btn ghost">Declaração</button>`, `<button class="btn solid">Editar ficha</button>`],
    secoes: navNivel1([['dados', 'Dados', '#/dev/templates/objeto'], ['historico', 'Histórico', '#/dev/templates/objeto'], ['acessos', 'Acessos', '#/dev/templates/objeto']], 'dados', 'Ficha') })
  + layoutObjeto(
      `<section class="card"><h3>Sobre</h3><p class="small muted" style="margin-top:6px">O corpo do objeto: texto, listas, o que é dele. A lateral guarda os pares de chave e valor.</p></section>
       <section class="card" style="margin-top:16px"><h3>Ocorrências recentes</h3>${estado.vazio({ texto: 'Nenhuma ocorrência neste ano.', acao: '<button class="btn ghost mini">Registrar ocorrência</button>' })}</section>`,
      `<section class="card">${spec([['Registro', '004', true], ['Entrada', '03/02/2025', true], ['Departamento', 'Engenharia'], ['Gestor', '<a href="#/dev/templates/objeto">Bruno Tavares</a>'], ['E-mail', 'ana@neurodynamics.dev']])}</section>`);
}

function tplFluxo(k){
  const membros = TPL_PESSOAS.map(([r, n], i) => `<div class="ajuste"><div><h3>${esc(n)}</h3><p>Registro ${r}</p></div><div class="controle">
    <div class="seg" role="group" aria-label="Assiduidade"><button class="${i !== 1 ? 'on' : ''}">Suficiente</button><button class="${i === 1 ? 'on' : ''}">Insuficiente</button></div>
    ${i === 1 ? `<div class="fld" style="width:100%"><label for="tpl-j">Justificativa</label><textarea id="tpl-j" rows="2" placeholder="Duas faltas sem aviso na semana."></textarea></div>` : ''}</div></div>`).join('');
  return cabecalho({ espaco: 'Equipe', titulo: 'Frente de Órteses', voltar: ['Reporte semanal', '#/dev/templates'],
    meta: ['Semana de 06/10', tplPill('Prazo em 1 dia', 'p-warn')], secoes: tplNav(k) })
  + layoutFluxo({
      passos: etapas([['apontamentos', 'Apontamentos'], ['escalonamentos', 'Escalonamentos'], ['feed', 'Publicações no feed'], ['revisao', 'Revisão e envio']], 'apontamentos', e => '#/dev/templates/fluxo'),
      corpo: `<div class="ajustes">${membros}</div>`,
      salvo: '<span class="salvo ok">Salvo às 14:32</span>',
      acoes: '<button class="btn ghost">Salvar rascunho</button><button class="btn solid">Continuar</button>' });
}

function tplPainel(k){
  const m = (r, v, d) => `<div class="card"><div class="small muted" style="font-family:var(--fd);font-weight:600;font-size:10.5px;letter-spacing:var(--tr-label);text-transform:uppercase">${r}</div><div style="font-family:var(--fd);font-weight:300;font-size:40px;line-height:1.1;margin-top:10px">${v}</div><div class="small muted">${d}</div></div>`;
  return cabecalho({ espaco: 'Equipe', titulo: 'Presença', secoes: tplNav(k) })
  + `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px">${m('No LABBIO agora', '14', 'de 40 lugares')}${m('Chegada média', '09:12', 'nesta semana')}${m('Sequência mais longa', '12', 'dias úteis')}</div>`;
}

function tplLeitura(k){
  const art = (a, t, sub) => `<article class="artigo"><div class="artigo-meta"><span>${a}</span><time>10/10/2026, 09:40</time></div><h2>${t}</h2><p class="sub">${sub}</p>
    <div class="md"><p>O texto do post, em Markdown. A coluna tem a largura de leitura do design system: linhas curtas leem melhor.</p></div></article>`;
  return cabecalho({ espaco: 'Equipe', titulo: 'Feed da equipe', secoes: tplNav(k) })
  + layoutLeitura(art('Bruno Tavares', 'Bancada de testes da órtese montada', 'A primeira rodada de medições sai na sexta.')
    + art('Ana Figueiredo', 'Três pessoas chegaram ao time', 'Boas-vindas a Carla, Diego e Sofia.')
    + '<button class="btn ghost" style="margin-top:28px;width:100%;justify-content:center">Carregar mais</button>');
}

function tplAjustes(k){
  return cabecalho({ espaco: 'Agenda', titulo: 'Configurações', secoes: tplNav(k) })
  + navNivel2([['geral', 'Geral', '#/dev/templates/ajustes'], ['predefinidos', 'Predefinidos', '#/dev/templates/ajustes'], ['google', 'Google Agenda', '#/dev/templates/ajustes']], 'geral', 'Configurações')
  + `<div class="card"><div class="ajustes">
      ${ajuste({ titulo: 'Início da semana', dica: 'O primeiro dia na visão de semana e de mês.', controle: `<div class="seg"><button class="on">Segunda</button><button>Domingo</button></div>` })}
      ${ajuste({ titulo: 'Lembrete padrão', dica: 'Vale para eventos novos; cada evento pode mudar o seu.', controle: `<div class="fld"><label for="tpl-lem">Antecedência</label><select id="tpl-lem"><option>15 minutos</option><option>1 hora</option></select></div>` })}
    </div><div class="ajustes-pe"><button class="btn solid">Salvar</button></div></div>`;
}

function tplTrabalho(k){
  const col = (t, n) => `<div class="kb-col" style="min-width:230px"><div class="kb-top"><b>${t}</b> <span class="small muted">${n}</span></div></div>`;
  return cabecalho({ espaco: 'Atividades', titulo: 'Órteses', acoes: [`<button class="btn solid">${ic('plus')}Nova atividade</button>`], secoes: tplNav(k) })
  + `<div style="display:flex;gap:12px;overflow-x:auto">${col('A fazer', 4)}${col('Fazendo', 2)}${col('Revisão', 1)}${col('Concluída', 9)}</div>`;
}

function tplEstados(k){
  return cabecalho({ espaco: 'Arquivos', titulo: 'Estados de tela', lead: 'Os quatro, sempre os mesmos (PADROES, seção 6). Sem permissão volta ao início.', secoes: tplNav(k) })
  + `<h3 style="margin:22px 0 10px">Carregando, forma conhecida</h3>${estado.carregando('lista')}
     <h3 style="margin:22px 0 10px">Carregando, forma desconhecida</h3>${estado.carregando()}
     <h3 style="margin:22px 0 10px">Vazio</h3>${estado.vazio({ texto: 'Nenhuma atividade com esse filtro.', acao: '<button class="btn ghost mini">Limpar filtros</button>' })}
     <h3 style="margin:22px 0 10px">Erro</h3>${estado.erro({ texto: 'Os arquivos não carregaram. Confira a conexão.', acao: '<button class="btn ghost mini">Tentar de novo</button>' })}`;
}
