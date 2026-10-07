/* A agenda no modelo do Google, a presença no LABBIO e o início (v28/v29).
   Confere, com asserção (sai com código 1 se algo falhar):
     Agenda   — a semana com as camadas (eventos, tarefas, publicações);
                os atalhos do teclado (M, D, T); criar rápido; a página de
                um evento novo com o predefinido e um convidado; reagendar
                sem apagar, perguntando se avisa os convidados; responder
                ao convite; os eventos predefinidos nas configurações;
     Presença — quem está no LABBIO, o placar, gerar a folha de check-in:
                o PDF sai com o QR, e o QR desenhado na folha, lido de
                volta, é o endereço com o token fixo (F-…); abrir esse
                endereço registra a presença; folha revogada não vale;
                quem só lê não vê as folhas;
     Início   — a semana (sete dias, o convite sem resposta respondido
                ali), o placar, as tarefas, os links úteis (sem
                javascript:), os abertos por último; o rodapé com o
                próximo compromisso fora do início; os atalhos; o painel
                de links na Administração;
     e: sem erro de página, sem rolagem horizontal no celular.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
const QR = readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8');
const JSQR = readFileSync(new URL('./node_modules/jsqr/dist/jsQR.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin, busca = '' } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + busca + hash, { waitUntil:'domcontentloaded' });
  if (!busca) await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const dia = d => { const x = new Date(); x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/* ================= Agenda ================= */
{
  console.log('\nAgenda');
  const { ctx, p, erros } = await abrir({ hash:'#/agenda/semana/' + dia(0) });
  confere('a semana: a grade de horas com os eventos', await p.locator('.agw-ev').count() >= 2);
  confere('a barra do calendário: Hoje, as setas, o título e a visão', await p.locator('.cal-barra .cal-tit').count() === 1
    && await texto(p, '.cal-barra .seg button.on') === 'Semana');
  await ir(p, '#/agenda/semana/' + dia(1), 1200);
  const corpo = await texto(p, '#agx-corpo');
  confere('as outras camadas: a tarefa com prazo (ORT-14)', /ORT-14/.test(corpo), corpo.slice(0, 200));
  await ir(p, '#/agenda/semana/' + dia(0), 1200);

  await p.keyboard.press('m'); await p.waitForTimeout(900);
  confere('M: a visão do mês', /^#\/agenda\/mes\//.test(await p.evaluate(() => location.hash)) && await p.locator('.calm').count() === 1);
  await p.keyboard.press('d'); await p.waitForTimeout(900);
  confere('D: a visão do dia', /^#\/agenda\/dia\//.test(await p.evaluate(() => location.hash)));
  confere('do mês para o dia, fica no dia em que estava (hoje)', await p.evaluate(() => location.hash) === '#/agenda/dia/' + dia(0), await p.evaluate(() => location.hash));
  await p.keyboard.press('j'); await p.waitForTimeout(900);
  confere('J: o dia seguinte', await p.evaluate(() => location.hash) === '#/agenda/dia/' + dia(1), await p.evaluate(() => location.hash));
  await p.keyboard.press('t'); await p.waitForTimeout(900);
  confere('T: volta a hoje', await p.evaluate(() => location.hash) === '#/agenda/dia/' + dia(0));
  await p.keyboard.press('s'); await p.waitForTimeout(900);

  /* criar rápido, como o clique numa hora vazia */
  await p.evaluate(d => agRapido(d, 600, 660, 500, 400), dia(1)); await p.waitForTimeout(200);
  await p.fill('#agr-tit', 'Café com a equipe'); await p.keyboard.press('Enter'); await p.waitForTimeout(700);
  const rap = (await rpcs(p, 'agenda_evento_salvar')).pop();
  confere('criar rápido grava título, dia e horário', rap?.titulo === 'Café com a equipe' && rap.data === dia(1)
    && rap.hora_inicio === '10:00' && rap.hora_fim === '11:00', rap);

  /* a página de um evento novo */
  await ir(p, `#/agenda/novo/${dia(3)}T14:00~15:00`, 1200);
  await p.fill('#ev-tit', 'Revisão do protótipo');
  await p.selectOption('#ev-pd', 'pd2'); await p.waitForTimeout(300);
  await p.fill('#ev-busca', 'Carla'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  await p.click('#ev-salvar'); await p.waitForTimeout(900);
  const novo = (await rpcs(p, 'agenda_evento_salvar')).pop();
  confere('o evento novo: título, horário, o predefinido e a Carla convidada', novo?.titulo === 'Revisão do protótipo'
    && novo.data === dia(3) && novo.hora_inicio === '14:00' && novo.predefinido_id === 'pd2'
    && [...(novo.obrigatorios || []), ...(novo.opcionais || [])].includes(17), novo);
  confere('o predefinido traz o Meet e o lembrete', novo?.meet_url === 'https://meet.google.com/ger-enc-ia' && JSON.stringify(novo.lembretes) === '[30]', novo);

  /* próximo horário livre varre a agenda, a qualquer hora do dia */
  await ir(p, `#/agenda/novo/${dia(3)}T14:00~15:00`, 1200);
  await p.fill('#ev-busca', 'Bruno'); await p.waitForTimeout(300); await p.keyboard.press('Enter'); await p.waitForTimeout(300);
  const lido = () => p.evaluate(() => document.querySelector('#ev-data').value + 'T' + document.querySelector('#ev-hi').value);
  await p.click('.evp-disp-topo button'); await p.waitForTimeout(700);
  const l1 = await lido();
  await p.click('.evp-disp-topo button'); await p.waitForTimeout(700);
  const l2 = await lido();
  await p.click('.evp-disp-topo button'); await p.waitForTimeout(700);
  const l3 = await lido();
  confere('cada clique em "Próximo horário livre" traz um horário depois do anterior', l1 < l2 && l2 < l3, [l1, l2, l3]);
  confere('a régua de disponibilidade cobre as 24 h', await p.evaluate(() => /^0h/.test(document.querySelector('.evd-regua span')?.textContent || '')
    && /22h/.test(document.querySelector('.evd-regua')?.textContent || '')));

  /* reagendar sem apagar */
  await ir(p, '#/agenda/evento/e1', 1200);
  await p.fill('#ev-data', dia(4)); await p.dispatchEvent('#ev-data', 'change'); await p.waitForTimeout(200);
  await p.click('#ev-salvar'); await p.waitForTimeout(400);
  confere('com convidados, pergunta se avisa por e-mail', await p.locator('#modal.open #ag-notif').count() === 1);
  await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(900);
  const re = (await rpcs(p, 'agenda_evento_salvar')).pop();
  confere('reagendar grava só a data nova, no mesmo evento, e avisa', re?.id === 'e1' && re.data === dia(4) && re.notificar === true
    && !('titulo' in re), re);
  confere('nenhuma exclusão para reagendar', (await rpcs(p, 'agenda_evento_excluir')).length === 0);

  /* os eventos predefinidos */
  await ir(p, '#/agenda/config/predefinidos', 1200);
  const pds = await p.evaluate(() => [...document.querySelectorAll('#agc-corpo tbody tr')].map(t => t.textContent.replace(/\s+/g, ' ').trim()));
  confere('as configurações listam os predefinidos', pds.length === 2 && /Reunião geral/.test(pds[0]) && /Reunião de gerência/.test(pds[1]), pds);
  await p.click('#agc-corpo tbody tr:nth-child(2)'); await p.waitForTimeout(300);
  await p.fill('#pd-dur', '90'); await p.click('#modal.open button:has-text("Salvar")'); await p.waitForTimeout(700);
  const pdw = (await escritas(p, 'agenda_predefinidos')).pop();
  confere('editar o predefinido grava na tabela (a definição fica fora do código)', pdw?.op === 'update' && pdw.dados.duracao_min === 90, pdw);
  confere('nenhum erro de página (agenda)', !erros.length, erros);
  await ctx.close();
}
{
  console.log('\nAgenda (convidada, só leitura)');
  const { ctx, p, erros } = await abrir({ hash:'#/agenda/evento/e2', stub: stubDe('leitura') });
  confere('quem é convidado e não organiza vê a página de leitura', await p.locator('#ev-salvar').count() === 0
    && /Revisão da órtese/.test(await texto(p, 'main h1')));
  await p.click('.evp-rsvp button:has-text("Vou")'); await p.waitForTimeout(600);
  const r = (await rpcs(p, 'agenda_responder')).pop();
  confere('responder ao convite', r?.p_id === 'e2' && r.p_resposta === 'vou', r);
  confere('nenhum erro de página (convidada)', !erros.length, erros);
  await ctx.close();
}

/* ================= Presença e a folha de check-in ================= */
{
  console.log('\nPresença');
  const { ctx, p, erros } = await abrir({ hash:'#/equipe/presenca' });
  confere('quem está no LABBIO agora', await texto(p, '.pres-hero .n') === '3');
  confere('o placar: o Bruno na frente, a Ana em 2º', /Bruno Tavares/.test(await texto(p, '.plc-l li:first-child')) && /2º/.test(await texto(p, '.plc-eu')));
  confere('as folhas geradas', /CHK-001/.test(await texto(p, '#pres-folhas')));

  /* o QR da folha, lido de volta do que foi desenhado no PDF */
  await p.evaluate(() => precisaDocNRO());
  /* cada documento novo anota os retângulos cheios que desenha */
  await p.evaluate(() => { const J = window.jspdf.jsPDF; window.__rects = [];
    const Espiao = function(...a){ const d = new J(...a), rect = d.rect.bind(d);
      d.rect = (x, y, w, h, st) => { if (st === 'F') window.__rects.push([x, y, w, h]); return rect(x, y, w, h, st); }; return d; };
    Object.assign(Espiao, J); Espiao.API = J.API; window.jspdf.jsPDF = Espiao; });
  confere('a folha ativa não tem botão de baixar o PDF de novo', await p.locator('#pres-folhas button:has-text("PDF")').count() === 0);
  await p.click('button:has-text("Gerar nova folha")'); await p.waitForTimeout(300);
  confere('antes de gerar, avisa que a folha anterior deixa de valer', /CHK-001 deixa de valer/.test(await texto(p, '#modal.open')));
  await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(300);
  await p.fill('#fl-rot', 'Recepção');
  const [d] = await Promise.all([p.waitForEvent('download', { timeout:15000 }), p.click('#fl-ok')]);
  confere('gerar a folha grava quem e onde', JSON.stringify((await rpcs(p, 'checkin_folha_criar')).pop()) === '{"p_rotulo":"Recepção"}');
  confere('o PDF: CHK-002 FOLHA DE CHECK-IN DO LABBIO.pdf', d.suggestedFilename() === 'CHK-002 FOLHA DE CHECK-IN DO LABBIO.pdf', d.suggestedFilename());
  const doc = await p.evaluate(() => window.__docnro);
  confere('a folha diz o que é e de onde vem', /Check-in no LABBIO/.test(doc.textos.join(' ')) && /Folha CHK-002/.test(doc.textos.join(' '))
    && /Recepção, gerada em .* por Ana Figueiredo/.test(doc.textos.join(' ')), doc.textos);
  await p.addScriptTag({ content: JSQR });
  const lido = await p.evaluate(() => {
    /* o quadrado do QR: 128 mm centrados, a partir de y = 80 mm */
    const q = window.__rects.filter(([x, y, w, h]) => x >= 40 && x <= 170 && y >= 79 && y <= 210 && h < 6);
    const esc = 6, pad = 120, c = document.createElement('canvas');
    c.width = c.height = 128 * esc + pad * 2;
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.fillStyle = '#000';
    /* alinhado ao pixel: borda fracionária vira fresta cinza e confunde a leitura */
    const px = v => Math.round(pad + v * esc);
    q.forEach(([x, y, w, h]) => { const x0 = px(x - 41), y0 = px(y - 80); g.fillRect(x0, y0, px(x - 41 + w) - x0, px(y - 80 + h) - y0); });
    const img = g.getImageData(0, 0, c.width, c.height);
    return { n: q.length, texto: window.jsQR(img.data, img.width, img.height)?.data || null };
  });
  confere('o QR desenhado na folha lê o endereço com o token fixo', lido.texto === doc.url
    && /^http:\/\/localhost:8765\/(index\.html)?\?t=F-0c9d8e7f-6a5b-4c3d-8e2f-1a0b9c8d7e6f$/.test(lido.texto), { lido, url: doc.url });

  confere('gerar invalida a anterior: só a nova fica ativa, sem botão de PDF', await p.evaluate(() => {
    const fs = [...document.querySelectorAll('#pres-folhas .pres-folha')];
    return fs.length === 2 && fs.filter(f => !f.classList.contains('off')).length === 1 && !document.querySelector('#pres-folhas button:not(.perigo)'); }));
  await p.click('#pres-folhas .pres-folha:has-text("CHK-002") button:has-text("Revogar")'); await p.waitForTimeout(300);
  await p.click('#modal.open .acts .btn.solid'); await p.waitForTimeout(500);
  confere('revogar a folha', JSON.stringify((await rpcs(p, 'checkin_folha_revogar')).pop()) === '{"p_id":"f2"}');
  confere('nenhum erro de página (presença)', !erros.length, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ busca:'?t=F-7b1f3c1e-2a4d-4c55-9d7e-0a1b2c3d4e5f', hash:'' });
  await p.waitForTimeout(800);
  const r = (await rpcs(p, 'registrar_checkin_folha')).pop();
  confere('abrir o QR da folha registra pela folha, com o token sem o F-', r?.p_token === '7b1f3c1e-2a4d-4c55-9d7e-0a1b2c3d4e5f', r);
  confere('e confirma a presença na tela', /Ana/.test(await texto(p, '.ck-nome')), await texto(p, '#v-checkin'));
  confere('nenhum erro de página (check-in pela folha)', !erros.length, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ busca:'?t=F-00000000-0000-4000-8000-000000000000', hash:'' });
  await p.waitForTimeout(800);
  confere('folha que não existe ou foi revogada não vale', (await rpcs(p, 'registrar_checkin_folha')).length === 1
    && /folha/i.test(await texto(p, '#v-checkin')) && !/Ana/.test(await texto(p, '.ck-nome')), await texto(p, '#v-checkin'));
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ hash:'#/equipe/presenca', stub: stubDe('leitura') });
  confere('quem só lê não vê as folhas de check-in', await p.locator('#pres-folhas').count() === 0 && await p.locator('.pres-hero').count() === 1);
  await ctx.close();
}

/* ================= Início, rodapé e links ================= */
{
  console.log('\nInício');
  const { ctx, p, erros } = await abrir({ hash:'#/' });
  confere('sem aviso, o quadro de avisos não ocupa espaço', (await p.evaluate(() => document.getElementById('sec-board').innerHTML.trim())) === '');
  confere('a semana: sete dias, com hoje marcado', await p.locator('#card-semana .ini-dia').count() === 7
    && await p.locator('#card-semana .ini-dia.hoje').count() === 1);
  confere('a carga de cada dia', await p.locator('#card-semana .ini-carga').count() === 7);
  confere('a carga inclui madrugada e noite sem duplicar sobreposição', await p.evaluate(() => minutosOcupados([{hi:60,hf:120},{hi:90,hf:150},{hi:1260,hf:1380}])) === 210);
  confere('um dia cheio tem 1440 minutos', await p.evaluate(() => minutosOcupados([{hi:0,hf:1440}])) === 1440);
  confere('o convite sem resposta aparece tracejado na semana', await p.locator('#card-semana .ini-ev.pend:has-text("Revisão da órtese")').count() === 1);
  await p.click('#card-semana .ini-conv:has-text("Revisão da órtese") button:has-text("Sim")'); await p.waitForTimeout(500);
  const r = (await rpcs(p, 'agenda_responder')).pop();
  confere('e responde ali mesmo', r?.p_id === 'e2' && r.p_resposta === 'vou'
    && await p.locator('#card-semana .ini-conv:has-text("Revisão da órtese")').count() === 0, r);
  const t0 = await texto(p, '#card-semana h3');
  await p.click('#card-semana button[title="Próxima semana"]'); await p.waitForTimeout(700);
  confere('a próxima semana', /\d+ (a|de) /.test(await texto(p, '#card-semana h3')) && await texto(p, '#card-semana h3') !== t0, await texto(p, '#card-semana h3'));

  confere('o placar no lugar do check-in: o ranking com cinco no máximo e as sequências',
    await p.locator('#card-placar .plc-l').count() === 2 && await p.locator('#card-placar .plc-cols > div:first-child .plc-l li').count() <= 5
    && /3 no LABBIO agora/.test(await texto(p, '#card-placar .plc-agora')));
  const tf = await p.evaluate(() => [...document.querySelectorAll('#card-tarefas a.ini-tf')].map(a => a.getAttribute('href')));
  confere('as suas tarefas, as de prazo mais perto primeiro', tf.join() === '#/atividades/card/ORT-14,#/atividades/card/ORT-15', tf);
  const links = await p.evaluate(() => [...document.querySelectorAll('#card-links a.ini-lk')].map(a => a.getAttribute('href')));
  confere('os links úteis da Administração, sem o javascript:', links.join() === 'https://drive.google.com,https://neurodynamics.dev,#/equipe/presenca', links);
  confere('abertos por último: vazio no começo', /Nenhuma tela recente/.test(await texto(p, '#card-recentes')));
  confere('no início, o rodapé não repete o que a tela já mostra', await p.evaluate(() => document.getElementById('ft-vivo').hidden));

  await ir(p, '#/okrs', 1200); await ir(p, '#/equipe/presenca', 1200);
  const vivo = await p.evaluate(() => [...document.querySelectorAll('#ft-vivo .ft-t')].map(a => a.textContent.replace(/\s+/g, ' ').trim()));
  confere('fora do início, o rodapé traz o próximo compromisso, o LABBIO e a sequência',
    vivo.length === 3 && /Próximo compromisso/.test(vivo[0]) && /3 pessoas/.test(vivo[1]) && /3 dias úteis/.test(vivo[2]), vivo);
  await ir(p, '#/', 1200);
  const rec = await p.evaluate(() => [...document.querySelectorAll('#card-recentes a.ini-rc')].map(a => [a.getAttribute('href'), a.querySelector('b').textContent]));
  confere('abertos por último: o mais recente primeiro, com o nome da tela', JSON.stringify(rec) === JSON.stringify([['#/equipe/presenca', 'Presença'], ['#/okrs/OE1', 'OKRs']]), rec);

  await p.click('#ft button:has-text("Atalhos do teclado")'); await p.waitForTimeout(300);
  confere('os atalhos do teclado', await p.locator('#modal.open kbd').count() >= 8);
  await p.keyboard.press('Escape');

  await ir(p, '#/admin/links', 1200);
  confere('Administração › Links úteis', await p.locator('#sec-links tbody tr').count() === 4);
  await p.click('#sec-links button:has-text("Novo link")'); await p.waitForTimeout(200);
  await p.fill('#lk-tit', 'Planilha de horas'); await p.fill('#lk-url', 'ftp://exemplo');
  await p.click('#modal.open button:has-text("Salvar")'); await p.waitForTimeout(300);
  confere('endereço que não é http nem do portal é recusado', /https:\/\/ ou #\//.test(await texto(p, '#lk-erro')));
  await p.fill('#lk-url', 'https://docs.google.com/spreadsheets'); await p.fill('#lk-grp', 'Ferramentas');
  await p.click('#modal.open button:has-text("Salvar")'); await p.waitForTimeout(500);
  const lw = (await escritas(p, 'portal_links')).pop();
  confere('o link novo entra no fim, no grupo', lw?.op === 'insert' && lw.dados.url === 'https://docs.google.com/spreadsheets'
    && lw.dados.grupo === 'Ferramentas' && lw.dados.ordem === 50, lw);
  confere('nenhum erro de página (início)', !erros.length, erros);
  await ctx.close();
}
{
  console.log('\nCelular');
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:'#/' });
  confere('celular: o início sem rolagem horizontal', await semRolagem(p));
  confere('celular: a semana vira lista', await p.evaluate(() => getComputedStyle(document.querySelector('.ini-semana')).gridTemplateColumns.split(' ').length === 1));
  await ir(p, '#/equipe/presenca', 1200);
  confere('celular: a presença sem rolagem horizontal', await semRolagem(p));
  await ir(p, '#/agenda', 1200);
  confere('celular: a agenda abre no dia, sem rolagem horizontal', /^#\/agenda/.test(await p.evaluate(() => location.hash)) && await semRolagem(p));
  confere('nenhum erro de página (celular)', !erros.length, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
