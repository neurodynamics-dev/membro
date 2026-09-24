/* Os treinamentos (v24), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Menu — Treinamentos entre Equipe e Informações, com os subitens; Meus
       pedidos virou subitem de Serviços, e #/pedidos ainda abre;
     Início — a faixa dos obrigatórios por fazer;
     Para você — obrigatórios e concluídos, cada um no seu lugar;
     Fazer — o programa, o módulo em Markdown (subtítulo, lista, caixa,
       tabela, link para o arquivo), o vídeo no player do site (e, sem a
       API do YouTube, o iframe simples), os links relacionados; o
       gabarito não está na tela; concluir o módulo sem verificação; a
       verificação reprovada marca as erradas e não mostra a explicação;
       aprovada, mostra; o último módulo fecha e dá o certificado, em PDF;
     Certificados — a lista, o PDF, conferir pelo código;
     Gestão — a lista com o filtro; o rascunho com problemas não publica;
       o editor grava sozinho; importar o texto do README (e o de um
       agente que embrulha tudo em ```markdown e usa "## Módulo 1"); a
       prévia com o gabarito; exportar e ler de volta; publicar; atribuir;
       novo treinamento, do zero e de um texto; acompanhamento e CSV;
     Configurações — quem gere, a prévia do certificado, o README (ver,
       editar, salvar, baixar com as referências);
     Ficha — a aba Treinamentos e o certificado baixado dali;
     Permissão — quem não gere não vê Gestão nem entra pelo endereço;
       quem gere por grupo não muda quem gere;
     e: busca, celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
/* Ana sem papel de gestão; e Ana em NRO_MANAGERS, o grupo que gere */
const stubLeitura = stubAdmin.replace("papel:'admin'", "papel:'leitura'");
const stubGrupo = stubLeitura.replace("grupos:['Órtese','Gestão'], gestor_registro:null", "grupos:['Órtese','NRO_MANAGERS'], gestor_registro:null");
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|youtube\.com|youtube-nocookie|ytimg/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const texto = (p, sel) => p.evaluate(s => document.querySelector(s)?.textContent || '', sel);
async function baixa(p, acao){
  const [d] = await Promise.all([p.waitForEvent('download', { timeout:15000 }), acao()]);
  const cam = await d.path();
  return { nome: d.suggestedFilename(), conteudo: readFileSync(cam) };
}
/* o jeito que um agente às vezes devolve: tudo em ```markdown, o título em
   nível 1 e os módulos como "## Módulo 1:" */
const DO_AGENTE = '```markdown\n# Apresentação do Studio\n\n## Módulo 1: O que é o Studio\n\nO espaço da comunicação.\n\n'
  + '### Verificação de conhecimento\n\n1. Onde se cria uma peça?\n   - [x] No criador\n   - [ ] Na agenda\n   > O criador desenha as peças.\n\n'
  + '## Módulo 2 — O quadro\n\nIdeia, produção, aprovação.\n```';

/* ================= admin: menu, início e fazer ================= */
{
  const { ctx, p, erros } = await abrir();
  const espacos = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec > .lt-linha .lt-rot')].map(e => e.textContent));
  confere('Treinamentos entre Equipe e Informações, e Meus pedidos saiu do primeiro nível',
    espacos.join('|') === 'Agenda|Atividades|OKRs|Projetos|Arquivos|Studio|Equipe|Treinamentos|Informações|Serviços|Seleção|Administração', espacos);
  const filhos = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="treinamentos"] .lt-filho .nm')].map(e => e.textContent));
  confere('os subitens de Treinamentos, com Gestão e Configurações para quem gere',
    filhos.join('|') === 'Para você|Todos os treinamentos|Meus certificados|Gestão|Configurações', filhos);
  const srv = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="servicos"] .lt-filho .nm')].map(e => e.textContent));
  confere('Meus pedidos é subitem de Serviços', srv[1] === 'Meus pedidos', srv);
  await ir(p, '#/pedidos');
  confere('o endereço antigo #/pedidos ainda abre Meus pedidos', /Meus pedidos/.test(await texto(p, '#main h1')));
  confere('e acende Serviços › Meus pedidos no menu', await p.evaluate(() =>
    document.querySelector('#lt-nav .lt-sec[data-r="servicos"] .lt-filho[aria-current="page"] .nm')?.textContent) === 'Meus pedidos');

  await ir(p, '#/');
  confere('o início mostra o obrigatório por fazer', await p.evaluate(() =>
    !!document.querySelector('#sec-treinos .tre-inicio-i[href="#/treinamentos/NRO-TRE-001"]')));
  confere('e não o que já está concluído', await p.evaluate(() => !document.querySelector('#sec-treinos [href="#/treinamentos/NRO-TRE-002"]')));
  confere('o trilho de ferramentas leva aos treinamentos', await p.evaluate(() => !!document.querySelector('.rail a.fer[href="#/treinamentos"]')));

  /* a busca acha o treinamento, antes de o módulo descer */
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  await p.keyboard.type('agenda no', { delay:20 }); await p.waitForTimeout(300);
  const achou = await p.evaluate(() => [...document.querySelectorAll('.pl-item')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  confere('a busca acha "Agenda no SOMA" pelo nome', achou.some(t => /NRO-TRE-001/.test(t) && /Agenda no SOMA/.test(t)), achou);
  await p.keyboard.press('Escape');

  await ir(p, '#/treinamentos', 1300);
  confere('Para você: o obrigatório na seção dele', await p.evaluate(() =>
    [...document.querySelectorAll('.tre-sec')].find(s => /Obrigatórios/.test(s.querySelector('h2').textContent))?.querySelector('[data-cod="NRO-TRE-001"]') != null));
  confere('e o concluído em Concluídos', await p.evaluate(() =>
    [...document.querySelectorAll('.tre-sec')].find(s => /Concluídos/.test(s.querySelector('h2').textContent))?.querySelector('[data-cod="NRO-TRE-002"]') != null));
  confere('a contagem do topo e da barra', /1\s*obrigatório por fazer/.test(await texto(p, '.st-resumo')) && /1/.test(await texto(p, '.tre-nav .n')));

  await ir(p, '#/treinamentos/NRO-TRE-001', 1300);
  confere('o programa com os três módulos', await p.evaluate(() => document.querySelectorAll('.tre-programa .tre-mods li').length) === 3);
  confere('as marcas do módulo: vídeo e verificação', /vídeo/.test(await texto(p, '.tre-mods li:nth-child(1)')) && /verificação · 3/.test(await texto(p, '.tre-mods li:nth-child(2)')));
  confere('quem gere vê Editar e Acompanhamento', await p.evaluate(() => !!document.querySelector('.tre-gere a[href$="/editar"]')));
  confere('o gabarito não desce: nada de "correta" nem de explicação no que a tela tem', await p.evaluate(() =>
    !/"correta"|"explicacao"/.test(JSON.stringify(treino.atual))));
  await p.click('.tre-programa .acts a.btn.solid'); await p.waitForTimeout(900);
  confere('Começar leva ao módulo 1', await p.evaluate(() => location.hash) === '#/treinamentos/NRO-TRE-001/1');
  const md = await p.evaluate(() => { const m = document.querySelector('.tre-md');
    return { h2: m.querySelector('h2')?.textContent, ol: m.querySelectorAll('ol > li').length, sub: m.querySelectorAll('ol li ul li').length,
      caixa: m.querySelector('.tre-caixa.dica')?.textContent.replace(/\s+/g, ' ').trim(), tabela: m.querySelectorAll('.tre-tabela tbody tr').length,
      arquivo: m.querySelector('a.tre-a[href="#/arquivos/NRO-PES-015"]')?.textContent, codigo: m.querySelector('code')?.textContent }; });
  confere('o Markdown: subtítulo, passo a passo com subitem, caixa de dica, tabela e código',
    md.h2 === 'Uma agenda só' && md.ol === 2 && md.sub === 1 && /^Dica\s*a busca abre/.test(md.caixa) && md.tabela === 2 && md.codigo === '/', md);
  confere('arquivo:NRO-PES-015 vira o link para o arquivo', md.arquivo === 'política de acesso ao LABBIO', md);
  const video = await p.evaluate(() => { const f = document.querySelector('.tre-video');
    return f && { yt: f.dataset.yt, no: f.querySelector('.no').textContent, ttl: f.querySelector('.ttl').textContent,
      src: f.querySelector('.src').textContent, gate: !!f.querySelector('.tre-vgate'), bar: !!f.querySelector('.tre-vbar i'),
      link: f.querySelector('.tre-vbtn')?.href }; });
  confere('o vídeo no player do site: palco, botão, barra e a linha V01 · título · YouTube',
    video?.yt === 'AdOeBTOeMu0' && video.no === 'V01' && video.ttl === 'Como marcar um compromisso' && video.src === 'YouTube' && video.gate && video.bar
    && video.link === 'https://youtu.be/AdOeBTOeMu0', video);
  await p.click('.tre-vgate'); await p.waitForTimeout(1500);
  const tocando = await p.evaluate(() => ({ cls: document.querySelector('.tre-video').classList.contains('tocando'),
    src: document.querySelector('.tre-vframe iframe')?.src || '' }));
  confere('sem a API do YouTube, o play cai no iframe simples (youtube-nocookie)', tocando.cls && /youtube-nocookie\.com\/embed\/AdOeBTOeMu0/.test(tocando.src), tocando);
  const links = await p.evaluate(() => [...document.querySelectorAll('.tre-links a.doc')].map(a => [a.getAttribute('href'), a.querySelector('.go').textContent]));
  confere('os links relacionados, com o código do arquivo', links.length === 2 && links[0][0] === '#/arquivos/NRO-PES-015' && /NRO-PES-015/.test(links[0][1])
    && links[1][0] === '#/agenda/mes', links);
  await p.click('.tre-concluir .btn.solid'); await p.waitForTimeout(1000);
  confere('concluir o módulo chama o banco e segue para o 2', (await rpcs(p, 'treinamento_concluir_modulo')).some(x => x.p_modulo === 'm-agenda')
    && await p.evaluate(() => location.hash) === '#/treinamentos/NRO-TRE-001/2');
  confere('e a coluna do programa marca o 1 como feito', await p.evaluate(() => document.querySelector('.tre-lado .tre-mods li:nth-child(1)').classList.contains('feito')));

  /* a verificação: primeiro errando */
  const tipos = await p.evaluate(() => [...document.querySelectorAll('.tre-q')].map(q =>
    q.querySelector('.tre-vf') ? 'vf' : q.querySelector('input')?.type));
  confere('uma questão de cada tipo: radio, checkbox, V ou F', tipos.join() === 'radio,checkbox,vf', tipos);
  await p.check('.tre-q[data-q="q1"] input[value="b"]');
  await p.check('.tre-q[data-q="q2"] input[value="a"]');
  await p.click('.tre-q[data-q="q3"] .tre-vf[data-o="a"] button[data-v="1"]');
  await p.click('.tre-q[data-q="q3"] .tre-vf[data-o="b"] button[data-v="1"]');
  await p.click('#tre-enviar'); await p.waitForTimeout(700);
  const r1 = await p.evaluate(() => ({ res: document.querySelector('#tre-res').textContent, cls: document.querySelector('#tre-res').className,
    erradas: [...document.querySelectorAll('.tre-q.errada')].map(q => q.dataset.q), exp: [...document.querySelectorAll('.tre-q-exp')].some(e => !e.hidden) }));
  confere('reprovado: 1 de 3, e a mínima dita', /1 de 3 \(33%\)/.test(r1.res) && /70%/.test(r1.res) && /bad/.test(r1.cls), r1);
  confere('as erradas marcadas (várias corretas pela metade, V ou F errado)', r1.erradas.join() === 'q2,q3', r1);
  confere('e nenhuma explicação aparece antes de passar', !r1.exp, r1);
  const envio = (await rpcs(p, 'treinamento_responder')).at(-1);
  confere('as respostas vão no formato do banco', JSON.stringify(envio?.p_respostas) === '{"q1":["b"],"q2":["a"],"q3":{"a":true,"b":true}}', envio);
  /* agora acertando */
  await p.check('.tre-q[data-q="q2"] input[value="b"]');
  await p.click('.tre-q[data-q="q3"] .tre-vf[data-o="b"] button[data-v="0"]');
  await p.click('#tre-enviar'); await p.waitForTimeout(800);
  const r2 = await p.evaluate(() => ({ res: document.querySelector('#tre-res').textContent, erradas: document.querySelectorAll('.tre-q.errada').length,
    exp: [...document.querySelectorAll('.tre-q-exp')].filter(e => !e.hidden).map(e => e.textContent),
    certa: document.querySelector('.tre-q[data-q="q1"] .tre-op[data-o="b"]').classList.contains('e-certa'),
    prox: !!document.querySelector('.tre-prox') }));
  confere('aprovado com 100%, sem erradas', /Aprovado com 100%/.test(r2.res) && r2.erradas === 0, r2);
  confere('aprovado, as explicações aparecem e a certa fica marcada', r2.exp.length === 3 && /É a aba Mês/.test(r2.exp[0]) && r2.certa, r2);
  confere('e o botão do próximo módulo aparece', r2.prox);
  await p.click('.tre-prox'); await p.waitForTimeout(900);
  await p.click('.tre-concluir .btn.solid'); await p.waitForTimeout(900);
  confere('o último módulo fecha: a janela do certificado', /Treinamento concluído/.test(await texto(p, '#modal.open')));
  const pdf = await baixa(p, () => p.click('#modal .btn.solid'));
  confere('o certificado desce em PDF, com o nome do treinamento e da pessoa', /^certificado-nro-tre-001-rev-b-ana-figueiredo\.pdf$/.test(pdf.nome)
    && pdf.conteudo.slice(0, 5).toString() === '%PDF-' && pdf.conteudo.length > 60000, { nome: pdf.nome, bytes: pdf.conteudo.length });
  const pdfTxt = pdf.conteudo.toString('latin1');
  confere('o PDF tem título, autor e a camada de texto (o código do certificado)', /NeuroDynamics/.test(pdfTxt) && /CERT-[0-9A-F]{4}-[0-9A-F]{4}/.test(pdfTxt));
  await p.evaluate(() => fechaModal());

  await ir(p, '#/treinamentos/certificados', 1200);
  const certs = await p.evaluate(() => [...document.querySelectorAll('.tre-cert-tile')].map(t => ({ t: t.querySelector('.tt').textContent,
    em: /Em dia/.test(t.textContent), cod: t.querySelector('.pe .mono').textContent })));
  confere('Meus certificados: os dois, em dia', certs.length === 2 && certs.every(c => c.em) && certs.some(c => c.t === 'Agenda no SOMA'), certs);
  const pdf2 = await baixa(p, () => p.click('.tre-cert-tile:has-text("Apresentação do LABBIO") .btn.solid'));
  confere('e cada um baixa o PDF', /^certificado-nro-tre-002-rev-a-/.test(pdf2.nome), pdf2.nome);
  await ir(p, '#/treinamentos/certificado/' + certs.find(c => c.t === 'Agenda no SOMA').cod.toLowerCase(), 900);
  confere('conferir pelo código (em minúsculas também) diz que é válido', /Certificado válido/.test(await texto(p, '.tre-verif-cert')) && /Ana Figueiredo/.test(await texto(p, '.tre-verif-cert h2')));
  await ir(p, '#/treinamentos/certificado/CERT-0000-0000', 900);
  confere('código inventado não confere', /Nenhum certificado/.test(await texto(p, '.aviso-box.err')));
  await ir(p, '#/treinamentos/NRO-TRE-001', 1200);
  confere('a página do treinamento diz concluído, com o certificado à mão', /Concluído em/.test(await texto(p, '.tre-faixa.ok')));
  confere('nenhum erro de página (fazer)', erros.length === 0, erros);
  await ctx.close();
}

/* ================= admin: gerir ================= */
{
  const { ctx, p, erros } = await abrir({ hash:'#/treinamentos/gestao' });
  await p.waitForTimeout(600);
  confere('Gestão: os três, com o rascunho e a revisão', await p.evaluate(() => document.querySelectorAll('.tabela.trabalho tbody tr').length) === 3
    && /Rascunho/.test(await texto(p, 'tbody tr:nth-child(3)')) && /Rev\. B/.test(await texto(p, 'tbody tr:nth-child(1)')));
  confere('com a atribuição de cada um', /Órtese/.test(await texto(p, 'tbody tr:nth-child(1)')) && /Toda a equipe/.test(await texto(p, 'tbody tr:nth-child(2)')));
  await p.click('.seg button:nth-child(4)'); await p.waitForTimeout(200);
  confere('o filtro de arquivados, vazio, diz por quê', /Nenhum treinamento com esse filtro/.test(await texto(p, '.vazio')));

  /* o exemplo que o próprio README traz, lido da página */
  const EXEMPLO = await p.evaluate(() => TRE_README_PADRAO.split('## 10. Um exemplo inteiro')[1].match(/````\n([\s\S]*?)\n````/)[1]);
  /* o rascunho com problemas */
  await ir(p, '#/treinamentos/NRO-TRE-003/editar', 1300);
  const prob = await p.evaluate(() => [...document.querySelectorAll('#tre-ed-prob li')].map(l => l.textContent));
  confere('o editor lista o que impede publicar', prob.includes('Módulo 1: sem título.') && prob.some(x => /uma correta só — há 2 marcadas/.test(x)), prob);
  await p.click('.topo-gestao .btn.solid'); await p.waitForTimeout(300);
  confere('e publicar mostra os problemas, sem botão de publicar', /Antes de publicar, resolva/.test(await texto(p, '#modal')) && !(await p.$('#tre-pub-ok')));
  await p.evaluate(() => fechaModal());
  confere('nunca publicado: excluir, não arquivar', /Excluir o treinamento/.test(await texto(p, '.tre-ed-zona')) && !/Arquivar/.test(await texto(p, '.tre-ed-zona')));

  /* o editor do publicado: grava sozinho */
  await ir(p, '#/treinamentos/NRO-TRE-001/editar', 1300);
  confere('o topo diz qual revisão está publicada e qual será a próxima', /Rev\. B publicada/.test(await texto(p, '.topo-gestao .lead'))
    && /Publicar a Rev\. C/.test(await texto(p, '.topo-gestao .btn.solid')));
  await p.fill('.tre-ed-mod[data-i="0"] .tre-ed-tit', 'O que é a agenda da equipe');
  confere('mudar avisa que há o que salvar', /por salvar/.test(await texto(p, '#tre-ed-st')));
  await p.waitForTimeout(3200);
  const salvo = (await rpcs(p, 'treinamento_rascunho_salvar')).at(-1);
  confere('dois segundos e meio depois, o rascunho grava sozinho', salvo?.p_conteudo?.modulos?.[0]?.titulo === 'O que é a agenda da equipe', salvo);
  confere('e o topo passa a falar do rascunho da Rev. C', /Rascunho da Rev\. C/.test(await texto(p, '.topo-gestao .lead')) && /salvo às/.test(await texto(p, '#tre-ed-st')));
  /* uma questão nova no módulo 3 */
  await p.click('.tre-ed-mod[data-i="2"] .tre-ed-abre'); await p.waitForTimeout(200);
  await p.click('.tre-ed-mod[data-i="2"] .tre-ed-addq .kb-add:nth-child(3)'); await p.waitForTimeout(200);
  confere('V ou F novo nasce com duas afirmações', await p.evaluate(() => document.querySelectorAll('.tre-ed-mod[data-i="2"] .tre-ed-vf').length) === 2);
  await p.waitForTimeout(500);
  confere('e o painel acusa a questão vazia', (await p.evaluate(() => [...document.querySelectorAll('#tre-ed-prob li')].map(l => l.textContent)))
    .some(x => /Módulo 3 · questão 1: sem enunciado/.test(x)));
  await p.fill('.tre-ed-mod[data-i="2"] .tre-ed-q textarea', 'Verdadeiro ou falso:');
  const afs = await p.$$('.tre-ed-mod[data-i="2"] .tre-ed-op input');
  await afs[0].fill('O check-in é pelo QR da entrada.'); await afs[1].fill('O check-in é pela portaria.');
  await p.waitForTimeout(500);
  confere('preenchida, nada impede publicar', /Nada impede/.test(await texto(p, '#tre-ed-prob')));
  /* a prévia mostra o gabarito */
  await p.click('.topo-gestao button:has-text("Pré-visualizar")'); await p.waitForTimeout(300);
  await p.click('.tre-previa-abas button:nth-child(2)'); await p.waitForTimeout(300);
  confere('a pré-visualização mostra a verificação com a certa marcada', await p.evaluate(() =>
    document.querySelectorAll('#modal .tre-op.e-certa').length === 3 && /É a aba Mês/.test(document.querySelector('#modal .tre-q-exp')?.textContent || '')));
  await p.evaluate(() => fechaModal());
  /* exportar e ler de volta */
  const md = await baixa(p, () => p.click('.topo-gestao button:has-text("Exportar")'));
  const txt = md.conteudo.toString('utf8');
  confere('exportar desce o Markdown do formato do README', md.nome === 'NRO-TRE-001-rascunho-rev-C.md' && /^---\ntitulo: Agenda no SOMA\ncodigo: NRO-TRE-001/.test(txt)
    && /\n# O que é a agenda da equipe\n/.test(txt) && /## Verificação de conhecimento/.test(txt) && /- \[V\] O check-in é pelo QR/.test(txt), txt.slice(0, 200));
  const volta = await p.evaluate(t => {
    const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
    const r = treLerTexto(t, treino.ed.conteudo.modulos);
    return JSON.stringify(canon(r.conteudo)) === JSON.stringify(canon(treino.ed.conteudo)); }, txt);
  confere('e o que se exporta se lê de volta igual (os ids inclusive)', volta);
  /* importar o exemplo do README */
  await p.click('.topo-gestao button:has-text("Importar texto")'); await p.waitForTimeout(200);
  await p.fill('#tre-imp-txt', EXEMPLO); await p.waitForTimeout(200);
  const prev = await p.evaluate(() => ({ cab: document.querySelector('.tre-imp-cab')?.textContent.replace(/\s+/g, ' '),
    avisos: [...document.querySelectorAll('.tre-imp-res .aviso-box li')].map(l => l.textContent), ok: !document.querySelector('#tre-imp-ok').disabled }));
  confere('a prévia do exemplo do README: 1 módulo, 1 vídeo, 1 questão', /Acesso ao LABBIO/.test(prev.cab) && /1 módulo · 1 vídeo · 1 questão · 20 min/.test(prev.cab) && prev.ok, prev);
  confere('e só acusa o vídeo com o link de exemplo', prev.avisos.length === 1 && /link de exemplo/.test(prev.avisos[0]), prev.avisos);
  await p.click('#tre-imp-modo button[data-m="acrescentar"]');
  await p.click('#tre-imp-ok'); await p.waitForTimeout(400);
  confere('importar no fim acrescenta o módulo e usa o título do texto', await p.evaluate(() => treino.ed.conteudo.modulos.length === 4
    && treino.ed.conteudo.modulos[3].titulo === 'Antes de ir ao laboratório' && treino.ed.meta.titulo === 'Acesso ao LABBIO'));
  await p.waitForTimeout(3000);
  confere('e grava o rascunho e os dados', (await rpcs(p, 'treinamento_rascunho_salvar')).at(-1)?.p_conteudo?.modulos?.length === 4
    && (await rpcs(p, 'treinamento_salvar')).some(x => x?.titulo === 'Acesso ao LABBIO' && x?.carga_horaria_min === '20'));
  /* publicar: a marca do exemplo impede; tirando o módulo, publica */
  await p.click('.topo-gestao .btn.solid'); await p.waitForTimeout(300);
  confere('publicar recusa o vídeo com o link de exemplo', /link de exemplo/.test(await texto(p, '#modal')));
  await p.evaluate(() => fechaModal());
  p.once('dialog', d => d.accept());
  await p.click('.tre-ed-mod[data-i="3"] .icon-btn.perigo'); await p.waitForTimeout(300);
  await p.click('#modal .btn.solid'); await p.waitForTimeout(400);
  await p.click('.topo-gestao .btn.solid'); await p.waitForTimeout(300);
  confere('publicar oferece pedir que todos refaçam', !!(await p.$('#tre-pub-refazer')));
  await p.fill('#tre-pub-notas', 'Questão nova no módulo de presença.');
  await p.click('#tre-pub-ok'); await p.waitForTimeout(1500);
  const pub = (await rpcs(p, 'treinamento_publicar')).at(-1);
  confere('publica a Rev. C sem pedir que refaçam, com as notas', pub?.p_exige_refazer === false && pub?.p_notas === 'Questão nova no módulo de presença.', pub);
  confere('e diz que publicou', /Rev\. C publicada/.test(await toasts(p)));
  confere('o editor volta com a Rev. C em vigor e a D como a próxima', /Rev\. C publicada/.test(await texto(p, '.topo-gestao .lead'))
    && /Publicar a Rev\. D/.test(await texto(p, '.topo-gestao .btn.solid')));
  /* atribuir */
  await p.check('.tre-atr-l:has-text("Sinais") input'); await p.waitForTimeout(100);
  await p.click('.tre-atr-l:has-text("Sinais") .seg button:nth-child(2)'); await p.waitForTimeout(100);
  await p.click('#tre-ed-atr .btn.solid'); await p.waitForTimeout(600);
  const atr = (await rpcs(p, 'treinamento_atribuir')).at(-1);
  confere('atribuir grava a lista inteira: Órtese obrigatório e Sinais opcional', JSON.stringify(atr?.p_lista) === '[{"grupo_id":1,"obrigatorio":true},{"grupo_id":2,"obrigatorio":false}]', atr);

  /* acompanhamento */
  await ir(p, '#/treinamentos/NRO-TRE-001/acompanhamento', 1200);
  confere('acompanhamento: as métricas e a tabela', /Obrigatório para/.test(await texto(p, '.metricas')) && await p.evaluate(() => document.querySelectorAll('tbody tr').length) === 3);
  await p.click('.seg button:nth-child(2)'); await p.waitForTimeout(200);
  confere('o recorte "Devem" mostra só quem deve (Ana e Carla, de Órtese; o Bruno tem o opcional)', await p.evaluate(() => document.querySelectorAll('tbody tr').length) === 2
    && /Carla/.test(await texto(p, 'tbody')) && !/Bruno/.test(await texto(p, 'tbody')));
  const csv = await baixa(p, () => p.click('.topo-gestao button:has-text("CSV")'));
  confere('a planilha do acompanhamento', csv.nome === 'NRO-TRE-001-acompanhamento.csv' && /Registro;.*Nome/.test(csv.conteudo.toString('utf8').replace(/"/g, '')));

  /* novo, do zero e de um texto */
  await ir(p, '#/treinamentos/novo', 900);
  await p.fill('#tn-titulo', 'Uso do Studio');
  await p.click('.tre-novo .card:first-child .btn.solid'); await p.waitForTimeout(1300);
  confere('novo do zero: cria e abre o editor', (await rpcs(p, 'treinamento_salvar')).some(x => x?.titulo === 'Uso do Studio' && !x.id)
    && await p.evaluate(() => location.hash) === '#/treinamentos/NRO-TRE-004/editar');
  await ir(p, '#/treinamentos/novo', 900);
  await p.fill('#tre-imp-txt', DO_AGENTE); await p.waitForTimeout(200);
  confere('o texto do agente, embrulhado e com "## Módulo": dois módulos e o título do nível 1',
    /Apresentação do Studio/.test(await texto(p, '.tre-imp-cab')) && /2 módulos · 0 vídeos · 1 questão/.test(await texto(p, '.tre-imp-cab')));
  await p.click('#tre-imp-ok'); await p.waitForTimeout(1300);
  const criado = (await rpcs(p, 'treinamento_salvar')).at(-1);
  confere('e cria com o conteúdo', criado?.titulo === 'Apresentação do Studio' && criado?.conteudo?.modulos?.map(m => m.titulo).join('|') === 'O que é o Studio|O quadro'
    && criado.conteudo.modulos[0].verificacao.questoes[0].opcoes[0].correta === true, criado);

  /* configurações */
  await ir(p, '#/treinamentos/config', 1500);
  confere('quem gere: NRO_MANAGERS marcado', await p.evaluate(() => [...document.querySelectorAll('#tc-gestores .chip-b.on')].map(b => b.textContent).join()) === 'NRO_MANAGERS');
  const tinta = await p.evaluate(() => { const c = document.querySelector('#tc-previa canvas'); if (!c) return 0;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 400) if (d[i] < 200) n++; return n; });
  confere('a prévia do certificado desenha (a faixa, o nome, o título)', tinta > 100, tinta);
  await p.click('#tc-gestores .chip-b:has-text("Sinais")');
  await p.fill('#tc-nota', '80');
  await p.click('.tre-cfg ~ .acts .btn.solid'); await p.waitForTimeout(500);
  const cfg = (await escritas(p, 'treinamento_config')).at(-1)?.dados;
  confere('salvar grava os grupos, a nota e a assinatura', JSON.stringify(cfg?.grupos_gestores) === '[6,2]' && cfg?.nota_minima === 80 && cfg?.assinatura_nome === 'Elis Ramalho', cfg);
  const ex = await baixa(p, () => p.click('.tre-cfg-cert .btn.ghost'));
  confere('o certificado de exemplo baixa', /^certificado-nro-tre-001-rev-a-/.test(ex.nome), ex.nome);
  await ir(p, '#/treinamentos/config/readme', 900);
  confere('o README padrão, no editor', /^# README · Treinamentos da NeuroDynamics/.test(await p.inputValue('#tr-readme')) && /padrão do portal/.test(await texto(p, '.tre-readme-topo')));
  await p.click('.tre-readme-ed .seg button[data-m="ver"]'); await p.waitForTimeout(300);
  const ver = await p.evaluate(() => ({ h2: document.querySelectorAll('#tr-readme-ver h2').length, code: document.querySelectorAll('#tr-readme-ver .tre-code').length,
    video: document.querySelectorAll('#tr-readme-ver .tre-video').length, tab: document.querySelectorAll('#tr-readme-ver .tre-tabela').length }));
  confere('o README desenhado pelo mesmo leitor: os blocos de exemplo ficam como código, não viram player', ver.h2 >= 10 && ver.code >= 5 && ver.video === 0 && ver.tab >= 3, ver);
  const rd = await baixa(p, () => p.click('.tre-readme-topo button:has-text("com as referências")'));
  const rdt = rd.conteudo.toString('utf8');
  confere('o README com as referências: os arquivos e os treinamentos que existem', rd.nome === 'README-treinamentos-com-referencias.md'
    && /## Anexo · As referências que existem/.test(rdt) && /- NRO-PES-007 — PROCEDIMENTO DE DESLIGAMENTO/.test(rdt) && /- NRO-TRE-001 — /.test(rdt)
    && !/NRO-PES-004/.test(rdt), rdt.slice(-400));
  await p.click('.tre-readme-ed .seg button[data-m="ed"]');
  await p.fill('#tr-readme', '# README da equipe\n\nTom: direto.');
  await p.click('#tr-salvar'); await p.waitForTimeout(900);
  confere('salvar o README grava o da equipe', (await escritas(p, 'treinamento_config')).at(-1)?.dados?.readme === '# README da equipe\n\nTom: direto.'
    && /README da equipe/.test(await texto(p, '.tre-readme-topo')));
  const rd2 = await baixa(p, () => p.click('.tre-readme-topo button:has-text("Baixar (.md)")'));
  confere('e é ele que desce', rd2.conteudo.toString('utf8').startsWith('# README da equipe'));
  p.once('dialog', d => d.accept());
  await p.click('.tre-readme-ed .btn.ghost'); await p.waitForTimeout(300);
  await p.click('#modal .btn.solid'); await p.waitForTimeout(900);
  confere('voltar ao padrão apaga o da equipe', (await escritas(p, 'treinamento_config')).at(-1)?.dados?.readme === null && /padrão do portal/.test(await texto(p, '.tre-readme-topo')));

  /* a ficha */
  await ir(p, '#/equipe/4', 1500);
  const abas = await p.evaluate(() => [...document.querySelectorAll('.abas .aba')].map(a => a.textContent));
  confere('a ficha tem a aba Treinamentos, com o número de certificados', abas.includes('Treinamentos (1)'), abas);
  await p.click('.abas .aba:has-text("Treinamentos")'); await p.waitForTimeout(400);
  confere('a aba mostra o obrigatório e o certificado', /0 de 1 obrigatório em dia/.test(await texto(p, '#ficha-body')) && /CERT-2A4B-9C1D/.test(await texto(p, '#ficha-body')));
  const pf = await baixa(p, () => p.click('#ficha-body .acc-row .icon-btn'));
  confere('e o certificado baixa dali (o módulo de treinamentos desce antes)', /^certificado-nro-tre-002-/.test(pf.nome), pf.nome);
  confere('nenhum erro de página (gerir)', erros.length === 0, erros);
  await ctx.close();
}

/* ================= quem não gere ================= */
{
  const { ctx, p, erros } = await abrir({ stub: stubLeitura, hash:'#/treinamentos' });
  const filhos = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="treinamentos"] .lt-filho .nm')].map(e => e.textContent));
  confere('quem não gere: sem Gestão nem Configurações no menu', filhos.join('|') === 'Para você|Todos os treinamentos|Meus certificados', filhos);
  confere('nem na barra da tela, nem o botão de novo', !/Gestão/.test(await texto(p, '.tre-nav')) && !(await p.$('.topo-gestao a[href="#/treinamentos/novo"]')));
  await ir(p, '#/treinamentos/gestao', 1000);
  confere('o endereço da gestão devolve para "Para você"', await p.evaluate(() => location.hash) === '#/treinamentos' && /Para você/.test(await texto(p, '#main h1')));
  await ir(p, '#/treinamentos/NRO-TRE-001/editar', 1000);
  confere('e o do editor também', await p.evaluate(() => location.hash) === '#/treinamentos');
  await ir(p, '#/treinamentos/NRO-TRE-001', 1000);
  confere('no treinamento, sem Editar', !(await p.$('.tre-gere')));
  confere('a busca não oferece "Novo treinamento"', await p.evaluate(() => !acoesDaCasca().some(a => a.titulo === 'Novo treinamento')));
  confere('nenhum erro de página (quem não gere)', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ stub: stubGrupo, hash:'#/treinamentos/config' });
  await p.waitForTimeout(600);
  confere('quem gere por grupo entra nas configurações', await p.evaluate(() => location.hash) === '#/treinamentos/config');
  confere('mas não muda quem gere (só admin e o Depto. de Pessoal)', await p.evaluate(() => [...document.querySelectorAll('#tc-gestores .chip-b')].every(b => b.disabled))
    && /Só admin e o Depto\. de Pessoal/.test(await texto(p, '.tre-cfg')));
  await p.click('.tre-cfg ~ .acts .btn.solid'); await p.waitForTimeout(400);
  confere('e salvar não manda a lista de grupos', !('grupos_gestores' in ((await escritas(p, 'treinamento_config')).at(-1)?.dados || { grupos_gestores:1 })));
  confere('nenhum erro de página (gestor por grupo)', erros.length === 0, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/treinamentos' });
  confere('celular: Para você sem rolagem horizontal', await semRolagem(p));
  for (const h of ['#/treinamentos/NRO-TRE-001', '#/treinamentos/NRO-TRE-001/1', '#/treinamentos/NRO-TRE-001/2', '#/treinamentos/NRO-TRE-001/editar',
    '#/treinamentos/gestao', '#/treinamentos/config', '#/treinamentos/config/readme', '#/treinamentos/certificados']){
    await ir(p, h, 1100);
    confere(`celular: ${h.replace('#/treinamentos', '…')} sem rolagem horizontal`, await semRolagem(p),
      await p.evaluate(() => [...document.querySelectorAll('#main *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).slice(0, 3).map(e => e.className)));
  }
  confere('nenhum erro de página (celular)', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
