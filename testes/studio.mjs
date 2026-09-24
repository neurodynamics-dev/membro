/* O Studio (v23), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Quadro — o espaço no menu, com os subitens; as cinco colunas; o
       cartão que espera a sua aprovação; arrastar para "pronta" sem
       aprovação é recusado na tela, sem chamar o banco; arrastar para
       "em aprovação" chama studio_mover;
     Calendário — a publicação de amanhã no dia dela; arrastar uma sem
       data para um dia grava a data;
     Ideias — a captura rápida: o tipo sugere o pilar e o formato, e a
       ideia entra sem data;
     Criador — a galeria com a prévia de cada modelo; a peça desenha, o
       texto muda a arte, *destaque*, a logo do LABBIO, o tema, lâmina
       nova, baixar a lâmina; salvar no quadro sobe as artes para o
       bucket "studio" e grava a peça e o plano;
     Publicação — aprovar; o plano salva; mandar para aprovação;
     Configurações — grupos de acesso e aprovadores, a imprensa do site
       (o link do YouTube vira o id) e os recursos;
     Permissão — quem não está em grupo nenhum não vê o Studio nem
       entra pelo endereço; quem está no grupo de acesso entra, mas não
       aprova nem configura;
     e: busca, celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
/* Ana, sem papel e sem grupo do Studio; e Ana no grupo de acesso (Sinais) */
const stubFora = stubAdmin.replace("papel:'admin'", "papel:'leitura'");
const stubMembro = stubFora.replace("grupos:['Órtese','Gestão'], gestor_registro:null", "grupos:['Sinais'], gestor_registro:null");
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
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.route('**/img.youtube.com/**', r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); localStorage.removeItem('nd.studio.rascunho'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1000);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1100) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const toasts = p => p.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.textContent).join(' | '));
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
/* quantos pixels diferentes entre duas leituras do canvas da prévia */
const pixels = p => p.evaluate(() => { const c = document.getElementById('cr-cv'); const x = c.getContext('2d');
  return Array.from(x.getImageData(0, 0, c.width, c.height).data.filter((v, i) => i % 97 === 0)); });
const difere = (a, b) => a.length !== b.length || a.some((v, i) => v !== b[i]);

/* ================= admin: o quadro ================= */
{
  const { ctx, p, erros } = await abrir({ hash:'#/studio' });
  const menu = await p.evaluate(() => [...document.querySelectorAll('#lt-nav .lt-sec[data-r="studio"] .lt-filho .nm')].map(e => e.textContent));
  confere('o Studio está no menu, com os subitens', ['Quadro','Calendário','Ideias','Criar publicação','Modelos','Configurações'].every(x => menu.includes(x)), menu);
  const cols = await p.evaluate(() => [...document.querySelectorAll('.st-col header span:first-child')].map(e => e.textContent.trim()));
  confere('cinco colunas, na ordem do fluxo', cols.join('|') === 'Ideias|Em produção|Em aprovação|Pronta para publicar|Publicada', cols);
  confere('POST-3 espera a aprovação da Ana (quem mandou foi o Bruno)',
    await p.evaluate(() => !!document.querySelector('.st-card.vez[data-id="p3"]')));
  confere('a contagem no topo diz quantas esperam por ela',
    /1\s*esperando a sua aprovação/.test(await p.evaluate(() => document.querySelector('.st-resumo').textContent)));
  await p.evaluate(() => { studioM.arrastando = 'p2'; stSoltar({ preventDefault(){} }, 'pronta'); });
  await p.waitForTimeout(300);
  confere('arrastar para "pronta" sem aprovação é recusado na tela', /aprovação/.test(await toasts(p)) && !(await rpcs(p, 'studio_mover')).length);
  await p.evaluate(() => { studioM.arrastando = 'p2'; stSoltar({ preventDefault(){} }, 'aprovacao'); });
  await p.waitForTimeout(900);
  const mv = await rpcs(p, 'studio_mover');
  confere('arrastar para "em aprovação" chama studio_mover', mv.some(x => x?.p_id === 'p2' && x?.p_status === 'aprovacao'), mv);
  confere('e o cartão muda de coluna', await p.evaluate(() => !!document.querySelector('.st-col[data-st="aprovacao"] .st-card[data-id="p2"]')));
  await p.fill('#st-q', 'bem-te-vi'); await p.waitForTimeout(600);
  confere('a busca do quadro filtra', await p.evaluate(() => document.querySelectorAll('.st-card').length === 1 && !!document.querySelector('.st-card[data-id="p6"]')));
  await p.evaluate(() => { studioM.filtro.q = ''; });

  /* calendário */
  await ir(p, '#/studio/calendario');
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1);
  if (amanha.getMonth() !== new Date().getMonth()) await p.evaluate(() => stMes(1));
  confere('POST-2 aparece amanhã no calendário', await p.evaluate(d => !!document.querySelector(`.st-dia[data-dia="${d}"] a[href="#/studio/POST-2"]`), amanha.getDate()));
  confere('a ideia sem data fica ao lado', await p.evaluate(() => !!document.querySelector('.st-semdata a[href="#/studio/POST-1"]')));
  await p.evaluate(() => { studioM.arrastando = 'p1'; stSoltarDia({ preventDefault(){} }, 15); });
  await p.waitForTimeout(700);
  const dt = (await rpcs(p, 'studio_publicacao_salvar')).find(x => x.id === 'p1');
  confere('arrastar a ideia para o dia 15 grava a data (às 18h, por padrão)', dt && new Date(dt.data_publicacao).getDate() === 15 && new Date(dt.data_publicacao).getHours() === 18, dt);

  /* ideias */
  await ir(p, '#/studio/ideias');
  await p.fill('#id-txt', 'Vídeo curto da equipe montando a bicicleta');
  await p.selectOption('#id-tipo', 'bastidores');
  confere('o tipo sugere o pilar e o formato', await p.evaluate(() => $('#id-pilar').value === 'conectar' && $('#id-formato').value === 'imagem'));
  await p.click('#id-redes .st-rchip[data-rede="instagram"]');
  await p.click('button:has-text("Guardar ideia")'); await p.waitForTimeout(800);
  const ideia = (await rpcs(p, 'studio_publicacao_salvar')).find(x => x.titulo?.startsWith('Vídeo curto'));
  confere('a ideia entra como ideia, sem data, com a rede', ideia?.status === 'ideia' && !ideia.data_publicacao && ideia.redes?.[0] === 'instagram' && ideia.categoria === 'bastidores', ideia);
  confere('e aparece na lista', /Vídeo curto da equipe/.test(await p.evaluate(() => document.querySelector('.st-ideias')?.textContent || '')));

  /* a galeria */
  await ir(p, '#/studio/modelos', 4500);
  const cards = await p.evaluate(() => [...document.querySelectorAll('.cr-card')].map(c => !!c.querySelector('canvas')));
  confere('a galeria tem os 23 modelos, cada um com a prévia', cards.length === 23 && cards.every(Boolean), cards.length);

  /* o criador */
  await ir(p, '#/studio/criar/aniversario', 2500);
  const a0 = await pixels(p);
  confere('a peça desenha', a0.some(v => v > 0));
  await p.fill('#crc-titulo', 'Bruno *Tavares*'); await p.waitForTimeout(400);
  const a1 = await pixels(p);
  confere('mudar o nome muda a arte', difere(a0, a1));
  await p.click('.cr-chave:has-text("LABBIO") input'); await p.waitForTimeout(400);
  confere('a logo do LABBIO entra (e as marcas carregaram)', difere(a1, await pixels(p)) && await p.evaluate(() => !!crMarca.labbio && !!crMarca.nro));
  await p.click('.cr-tema[title="Synapse"]'); await p.waitForTimeout(300);
  confere('o tema troca', await p.evaluate(() => criador.peca.estilo.tema === 'synapse'));
  await p.selectOption('#cr-novo-lay', 'lista');
  await p.click('.cr-add button'); await p.waitForTimeout(500);
  confere('lâmina nova: duas lâminas, duas na fita', await p.evaluate(() => criador.peca.laminas.length === 2 && document.querySelectorAll('.cr-mini:not(.cr-mais)').length === 2));
  confere('e a lâmina nova é a atual', await p.evaluate(() => criador.atual === 1 && $('#cr-lay').value === 'lista'));
  await p.click('button:has-text("Baixar")'); await p.waitForTimeout(200);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#modal button:has-text("Só a lâmina")')]);
  confere('baixar a lâmina gera o arquivo no tamanho Alta', /-02-1440x1800\.png$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await p.click('button:has-text("Salvar no quadro")'); await p.waitForTimeout(400);
  confere('salvar pede o plano, com a legenda sugerida pelo modelo', await p.evaluate(() => /celebrar/.test($('#sp-legenda').value) && !!$('#sp-titulo').value));
  await p.fill('#sp-titulo', 'Aniversário do Bruno');
  await p.fill('#sp-dia', '2026-10-02'); await p.fill('#sp-hora', '10:30');
  await p.fill('#sp-colab', '@labbio.ufmg');
  await p.fill('#sp-notas', 'Convidar o LABBIO como collab.');
  await p.click('#modal .acts .btn.solid');
  /* gerar o PNG em alta leva alguns segundos no Chromium sem GPU do teste */
  await p.waitForFunction(() => /^#\/studio\/POST-\d+$/.test(location.hash), null, { timeout:40000 }).catch(() => {});
  await p.waitForTimeout(1200);
  const sv = await rpcs(p, 'studio_publicacao_salvar');
  const cria = sv.find(x => x.titulo === 'Aniversário do Bruno' && !x.id), peca = sv.find(x => x.peca);
  confere('salvar cria a publicação em produção, com o plano', cria?.status === 'producao' && cria.colaboradores === '@labbio.ufmg'
    && new Date(cria.data_publicacao).getHours() === 10 && cria.redes?.[0] === 'instagram' && cria.modelo === 'aniversario', cria);
  const ups = await p.evaluate(() => (window.__uploads || []).filter(u => u.bucket === 'studio').map(u => u.caminho));
  confere('as duas artes sobem para o bucket studio', ups.filter(c => /\/arte-.+-0[12]\.(png|jpg)$/.test(c)).length === 2, ups);
  confere('e a peça vai junto, para a arte reabrir', peca?.peca?.laminas?.length === 2 && peca.imagens?.length === 2 && peca.imagens[0].largura === 1440, peca && { l: peca.peca?.laminas?.length, i: peca.imagens });
  confere('e a tela vai para a publicação nova', /^#\/studio\/POST-8$/.test(await p.evaluate(() => location.hash)), await p.evaluate(() => location.hash));
  await p.waitForSelector('#st-car figure', { timeout:5000 }).catch(() => {});
  const tela = await p.evaluate(() => [document.querySelector('#main h1')?.textContent, $('#sp-colab')?.value, document.querySelectorAll('#st-car figure').length]);
  confere('que mostra a arte e o plano', tela[0] === 'Aniversário do Bruno' && tela[1] === '@labbio.ufmg' && tela[2] === 2, tela);

  /* aprovar */
  await ir(p, '#/studio/POST-3', 1500);
  await p.click('.st-aprov button:has-text("Aprovar")'); await p.waitForTimeout(200);
  await p.click('#modal .btn.solid'); await p.waitForTimeout(1200);
  const dc = await rpcs(p, 'studio_decidir');
  confere('aprovar chama studio_decidir', dc.some(x => x.id === 'p3' && x.decisao === 'aprovar'), dc);
  confere('e a publicação fica pronta para publicar', await p.evaluate(() => /Marcar como publicada/.test(document.querySelector('.st-aprov').textContent)
    && document.querySelector('.st-passos li.agora')?.textContent.includes('Pronta')));
  /* o plano */
  await ir(p, '#/studio/POST-6', 1500);
  await p.fill('#sp-notas', 'Marcar a equipe Bem-te-vi.');
  await p.click('button:has-text("Salvar o plano")'); await p.waitForTimeout(900);
  confere('salvar o plano grava as notas', (await rpcs(p, 'studio_publicacao_salvar')).some(x => x.id === 'p6' && x.notas === 'Marcar a equipe Bem-te-vi.'));
  await p.click('.st-aprov button:has-text("Mandar para aprovação")'); await p.waitForTimeout(900);
  confere('mandar para aprovação, da página', (await rpcs(p, 'studio_mover')).some(x => x.p_id === 'p6' && x.p_status === 'aprovacao'));

  /* configurações */
  await ir(p, '#/studio/config/acesso', 1200);
  await p.click('#st-gp-acesso .st-gp-i:has-text("Órtese") input');
  await p.click('#main .btn.solid:has-text("Salvar")'); await p.waitForTimeout(900);
  const cfg = (await escritas(p, 'studio_config')).pop();
  confere('acesso: os grupos marcados vão para studio_config', cfg?.op === 'update' && cfg.dados.grupos_acesso.includes(1) && cfg.dados.grupos_aprovadores.includes(6), cfg);
  await ir(p, '#/studio/config/imprensa', 1200);
  confere('imprensa: os vídeos e as matérias do site', await p.evaluate(() => document.querySelectorAll('.st-imp').length === 3));
  await p.click('#main button:has-text("Vídeo")'); await p.waitForTimeout(200);
  await p.fill('#im-yt', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s');
  await p.fill('#im-vei', 'TV UFMG'); await p.fill('#im-ano', '2026');
  await p.click('#modal .btn.solid'); await p.waitForTimeout(700);
  const imp = (await escritas(p, 'site_imprensa')).pop();
  confere('o link do YouTube vira o id, e o vídeo entra', imp?.op === 'insert' && imp.dados.youtube === 'dQw4w9WgXcQ' && imp.dados.veiculo === 'TV UFMG', imp);
  await ir(p, '#/studio/config/recursos', 1200);
  confere('recursos: os cadastrados, por tipo', await p.evaluate(() => document.querySelectorAll('.st-rec').length === 2));
  await p.click('#main button:has-text("Recurso")'); await p.waitForTimeout(200);
  await p.fill('#rc-tit', 'Repositório de fotos'); await p.selectOption('#rc-tipo', 'repositorio');
  await p.fill('#rc-url', 'https://github.com/neurodynamics-dev/fotos');
  await p.click('#modal .btn.solid'); await p.waitForTimeout(700);
  const rec = (await escritas(p, 'studio_recursos')).pop();
  confere('um recurso novo entra em nome de quem cadastrou', rec?.op === 'insert' && rec.dados.criado_por === 4 && rec.dados.tipo === 'repositorio', rec);

  /* busca */
  await p.evaluate(() => abrirPaleta()); await p.fill('#pl-q', 'POST-3'); await p.waitForTimeout(300);
  confere('a busca acha a publicação pelo código', /POST-3/.test(await p.evaluate(() => document.querySelector('#pl-res')?.textContent || '')));
  await p.fill('#pl-q', 'aniversário'); await p.waitForTimeout(300);
  confere('e acha o modelo, para criar', /Criar: Aniversário/.test(await p.evaluate(() => document.querySelector('#pl-res')?.textContent || '')));
  await p.keyboard.press('Escape');
  confere('nenhum erro de página (admin)', !erros.length, erros);
  await ctx.close();
}

/* ================= quem não tem Studio ================= */
{
  const { ctx, p, erros } = await abrir({ stub: stubFora });
  confere('sem grupo do Studio, o espaço não aparece no menu', await p.evaluate(() => !document.querySelector('#lt-nav .lt-sec[data-r="studio"]')));
  await ir(p, '#/studio/POST-3');
  confere('e o endereço devolve para o início', await p.evaluate(() => location.hash === '#/'));
  confere('nenhum erro de página (fora)', !erros.length, erros);
  await ctx.close();
}
{
  /* direto no endereço, antes de os grupos chegarem: a rota espera */
  const { ctx, p, erros } = await abrir({ stub: stubMembro, hash:'#/studio/POST-3' });
  confere('quem está no grupo de acesso entra pelo endereço direto', await p.evaluate(() => location.hash === '#/studio/POST-3' && /Jornal Nacional/.test(document.querySelector('#main h1')?.textContent || '')));
  confere('mas não aprova', await p.evaluate(() => !document.querySelector('.st-aprov button') && /grupo aprovador/.test(document.querySelector('.st-aprov').textContent)));
  await ir(p, '#/studio/config/acesso');
  confere('e vê as configurações sem poder mudar', await p.evaluate(() => [...document.querySelectorAll('#st-gp-acesso input')].every(i => i.disabled)
    && !document.querySelector('#st-cfg .btn.solid')));
  confere('nenhum erro de página (membro)', !erros.length, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/studio' });
  confere('celular: o quadro sem rolagem horizontal', await semRolagem(p));
  await ir(p, '#/studio/criar/projeto', 2500);
  confere('celular: o criador sem rolagem horizontal', await semRolagem(p));
  confere('celular: a prévia cabe na tela', await p.evaluate(() => document.getElementById('cr-cv').getBoundingClientRect().right <= innerWidth));
  await ir(p, '#/studio/calendario');
  confere('celular: o calendário sem rolagem horizontal', await semRolagem(p));
  await ir(p, '#/studio/POST-2', 1500);
  confere('celular: a publicação sem rolagem horizontal', await semRolagem(p));
  confere('nenhum erro de página (celular)', !erros.length, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
