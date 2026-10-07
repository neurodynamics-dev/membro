/* Os e-mails da equipe (v30): o Full mailer em tela inteira, o envio
   programado e as pílulas de conhecimento.
   Confere, com asserção (sai com código 1 se algo falhar):
     Escrever    — o tile de Relatórios leva à tela (não a uma janela); a
                   prévia usa o nome de quem escreve; as redes vêm de Studio
                   › Configurações › Contas (link salvo, ou montado pelo
                   usuário) e saem ao desmarcar; o botão para uma tela do
                   portal vira endereço completo; as cores dos remetentes:
                   departamentos claros e distintos, a Leadership escura;
                   o rascunho sobrevive a trocar de seção; o que se copia
                   perde a marca {{primeiro_nome}};
     Programar   — conta quem recebe (e quem está sem e-mail), pelos grupos
                   e para si mesmo; o que vai ao banco (remetente com o nome
                   da área, a marca preservada para o envio, o destino);
     Programados — a fila e o histórico; reagendar; cancelar;
     Pílulas     — os roteiros com quem assina e para quem vão; grupo que
                   não existe mais vira aviso; a série de quatro em quatro
                   dias, sem fim de semana e sem repetir o que já está na
                   fila, com os grupos de cada pílula; tirar e pôr na série;
                   editar; abrir no mailer;
     Studio      — o link de cada rede, ao lado do usuário;
     Papéis      — o Comitê de Seleção escreve e copia, mas não programa;
                   quem só lê não entra;
     e: sem erro de página, sem rolagem horizontal no celular.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  /* as imagens do e-mail moram no domínio do SOMA: servidas daqui */
  await p.route('https://membro.neurodynamics.dev/mailer/**', r =>
    r.fulfill({ path: new URL('../mailer/' + r.request().url().split('/').pop(), import.meta.url).pathname }));
  await p.addInitScript(() => { try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1100);
  return { ctx, p, erros };
}
const ir = async (p, h, espera = 1000) => { await p.evaluate(x => location.hash = x, h); await p.waitForTimeout(espera); };
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const aviso = async p => ((await p.locator('.toast').last().textContent().catch(() => '')) || '').trim();
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
/* o documento da prévia: o srcdoc do iframe */
const previa = p => p.evaluate(() => document.getElementById('ml-prev')?.srcdoc || '');
const dia = d => { const x = new Date(); x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };

/* ================= Escrever ================= */
{
  console.log('\nEscrever');
  const { ctx, p, erros } = await abrir({ hash:'#/admin/relatorios' });
  await p.waitForSelector('#sec-relatorios .tile');
  await p.click('button:has-text("Full mailer")'); await p.waitForTimeout(1200);
  confere('o tile de Relatórios leva à tela inteira, não a uma janela',
    await p.evaluate(() => location.hash) === '#/admin/emails' && await p.locator('.ml-tela').count() === 1
    && await p.locator('#modal.open').count() === 0);
  confere('as seções: Escrever, Comunidade, Programados e Pílulas',
    (await p.locator('#sec-emails .nav1 a').allTextContents()).map(t => t.replace(/\s+/g, ' ').trim()).join('|') === 'Escrever|Comunidade|Programados 1|Pílulas de conhecimento',
    await p.locator('#sec-emails .nav1 a').allTextContents());
  confere('a prévia ocupa a altura da janela', await p.evaluate(() => document.getElementById('ml-prev').getBoundingClientRect().height) >= 800);

  let h = await previa(p);
  confere('a prévia usa o nome de quem escreve', h.includes('Olá, Ana.') && !h.includes('{{primeiro_nome}}'));
  confere('as redes vêm do Studio: o LinkedIn pelo link salvo, o Instagram pelo usuário',
    h.includes('href="https://www.linkedin.com/company/neurodynamics"') && h.includes('href="https://www.instagram.com/neurodynamics.dev"')
    && !h.includes('ico-site-') && !h.includes('ico-facebook-'));
  confere('o formulário mostra as contas e leva ao Studio para editar',
    await p.locator('.ml-rede').count() === 2 && await p.locator('a.ml-studio[href="#/studio/config/contas"]').count() === 1);
  await p.uncheck('.ml-rede[data-k="instagram"]'); await p.waitForTimeout(250);
  h = await previa(p);
  confere('desmarcar uma rede tira o ícone do e-mail', !h.includes('ico-instagram-') && h.includes('ico-linkedin-'));

  await p.fill('#ml-cta', 'Abrir a agenda'); await p.fill('#ml-ctaurl', '#/agenda'); await p.waitForTimeout(300);
  h = await previa(p);
  confere('o botão para uma tela do portal vira endereço completo',
    h.includes('href="https://membro.neurodynamics.dev/#/agenda"') && h.includes('Abrir a agenda'));
  await p.click('.ml-mais summary');
  await p.fill('#ml-links', 'Portal do membro https://membro.neurodynamics.dev | Sem link'); await p.waitForTimeout(300);
  h = await previa(p);
  confere('o rodapé: item com endereço vira link; sem endereço, texto (nada de href="#")',
    h.includes('href="https://membro.neurodynamics.dev" target="_blank"') && h.includes('<br>Sem link') && !h.includes('href="#"'));

  const cores = await p.evaluate(() => {
    const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map(c => c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
    return REMETENTES_MAILER.map(r => ({ k:r.k, band:THEMES_MAILER[r.tema].band, lum:lum(THEMES_MAILER[r.tema].band) }));
  });
  const deptos = cores.filter(c => c.k !== 'leadership');
  confere('seis remetentes, com a Leadership', cores.map(c => c.k).join() === 'pd,clinica,pessoal,ri,marketing,leadership', cores.map(c => c.k));
  confere('os departamentos em tons claros (o de RI não é mais o escuro)', deptos.every(c => c.lum > .75), deptos);
  confere('e distintos entre si', new Set(deptos.map(c => c.band)).size === deptos.length);
  confere('a Leadership usa o escuro institucional', cores.find(c => c.k === 'leadership').lum < .1);

  await p.selectOption('#ml-rem', 'ri'); await p.waitForTimeout(300);
  h = await previa(p);
  confere('Relações Institucionais: fundo claro, marca e ícones neutros sobre Retina claro',
    h.includes('background:#E0E6FC') && h.includes('logo-imagotipo-retina-dark.png') && h.includes('ico-linkedin-1d1d1f.png')
    && (await p.inputValue('#ml-titulo')) === 'Relações Institucionais e Parcerias');
  const imgs = await p.evaluate(async () => {
    const d = document.getElementById('ml-prev').contentDocument;
    await new Promise(r => setTimeout(r, 300));
    return [...d.images].filter(i => !i.src.includes('brand.neurodynamics.dev')).map(i => ({ src:i.src.split('/').pop(), ok:i.complete && i.naturalWidth > 0 }));
  });
  confere('as imagens da cor nova existem na pasta /mailer', imgs.length >= 1 && imgs.every(i => i.ok), imgs);
  await p.selectOption('#ml-rem', 'leadership'); await p.waitForTimeout(300);
  h = await previa(p);
  confere('Leadership: o título e o verde profundo com a logo branca',
    h.includes('background:#00352F') && h.includes('logo-imagotipo-cortex-light.png') && (await p.inputValue('#ml-titulo')) === 'Leadership');

  await p.fill('#ml-assunto', 'Rascunho que não pode sumir'); await p.waitForTimeout(250);
  await ir(p, '#/admin/emails/pilulas', 900); await ir(p, '#/admin/emails', 900);
  confere('o rascunho sobrevive a trocar de seção',
    (await p.inputValue('#ml-assunto')) === 'Rascunho que não pode sumir' && (await p.inputValue('#ml-rem')) === 'leadership'
    && !(await previa(p)).includes('ico-instagram-'));
  confere('o que se copia ou baixa perde a marca do nome',
    await p.evaluate(() => mlSemMarcas('<p>Olá, {{primeiro_nome}}.</p><p>{{nome}}, veja.</p>')) === '<p>Olá.</p><p>, veja.</p>'
    && await p.evaluate(() => !mlSemMarcas(ML.html).includes('{{')));

  /* ---------- programar ---------- */
  console.log('\nProgramar');
  await p.click('button:has-text("Programar envio")'); await p.waitForTimeout(700);
  confere('a janela de programar mostra quem assina', (await texto(p, '#modal.open')).includes('Leadership | NeuroDynamics'));
  confere('a equipe toda: dois recebem, e a Carla está sem e-mail',
    (await texto(p, '#mp-n')) === '2 pessoas recebem. Sem e-mail na ficha: Carla Mendonça.', await texto(p, '#mp-n'));
  await p.click('#mp-modo button:has-text("Grupos")'); await p.waitForTimeout(300);
  confere('por grupo, sem grupo marcado, pede um', (await texto(p, '#mp-n')) === 'Escolha pelo menos um grupo.');
  await p.check('.mp-gp[value="7"]'); await p.waitForTimeout(400);
  confere('NRO_PROJECTS conta quem está no grupo de baixo (o Bruno, pelo Nebula)', (await texto(p, '#mp-n')) === '1 pessoa recebe.', await texto(p, '#mp-n'));
  const conta = (await rpcs(p, 'email_destinatarios')).at(-1);
  confere('e pergunta ao banco pelo id do grupo', JSON.stringify(conta) === '{"todos":false,"registros":[],"grupos":[7]}', conta);
  await p.click('#mp-modo button:has-text("Só para mim")'); await p.waitForTimeout(400);
  await p.fill('#mp-quando', dia(1) + 'T10:30');
  await p.click('#mp-ok'); await p.waitForTimeout(1300);
  const prog = (await rpcs(p, 'email_programar')).at(-1);
  confere('o que vai ao banco: assunto, remetente com o nome da área, só para mim, na hora pedida',
    prog?.assunto === 'Rascunho que não pode sumir' && prog?.remetente === 'leadership' && prog?.remetente_nome === 'Leadership | NeuroDynamics'
    && prog?.todos === false && JSON.stringify(prog?.registros) === '[4]' && new Date(prog?.enviar_em).getHours() === 10, prog);
  confere('a marca do nome vai preservada, para cada pessoa receber o seu',
    prog?.html.includes('Olá, {{primeiro_nome}}.') && prog?.texto.includes('Olá, {{primeiro_nome}}.'));
  confere('depois de programar, a tela vai para a fila', await p.evaluate(() => location.hash) === '#/admin/emails/programados'
    && (await texto(p, '.ml-tab')).includes('Rascunho que não pode sumir'));

  /* ---------- programados ---------- */
  console.log('\nProgramados');
  confere('na fila, em ordem, com a contagem no seletor',
    (await p.locator('.ml-tab').first().locator('tbody tr').count()) === 2 && (await texto(p, '.nav1 a[href="#/admin/emails/programados"] .n')) === '2');
  confere('o histórico mostra o enviado, com quantos', (await texto(p, '#ml-historico .ml-tab')).includes('2 enviado(s)'));
  await p.locator('.ml-tab tbody tr', { hasText:'Assunto PIL-02' }).locator('button[title="Reagendar"]').click(); await p.waitForTimeout(700);
  confere('reagendar abre com a data e o destino que estavam', (await texto(p, '#modal.open h3')) === 'Reagendar envio'
    && await p.evaluate(() => document.querySelector('#mp-modo button.on').textContent) === 'Equipe toda');
  await p.fill('#mp-quando', dia(5) + 'T09:00'); await p.click('#mp-ok'); await p.waitForTimeout(1000);
  const re = (await rpcs(p, 'email_programar')).at(-1);
  confere('reagendar edita o mesmo programado', re?.id === 'e1' && re?.todos === true && new Date(re.enviar_em).getDate() === new Date(dia(5) + 'T09:00').getDate(), re);
  await p.locator('.ml-tab tbody tr', { hasText:'Assunto PIL-02' }).locator('button[title="Ver o e-mail"]').click(); await p.waitForTimeout(600);
  confere('ver mostra o e-mail com o nome de quem olha', await p.evaluate(() => document.querySelector('#modal .ml-ver').srcdoc.includes('Olá, Ana.')));
  await p.click('#modal button:has-text("Fechar")');
  await p.locator('.ml-tab tbody tr', { hasText:'Assunto PIL-02' }).locator('button[title="Cancelar o envio"]').click(); await p.waitForTimeout(400);
  await p.click('#modal button:has-text("Cancelar o envio")'); await p.waitForTimeout(1000);
  confere('cancelar tira da fila e passa ao histórico',
    JSON.stringify(await rpcs(p, 'email_programado_cancelar')) === '[{"p_id":"e1"}]'
    && (await texto(p, '#ml-historico .ml-tab')).includes('Cancelado'));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= Pílulas ================= */
{
  console.log('\nPílulas');
  const { ctx, p, erros } = await abrir({ hash:'#/admin/emails/pilulas' });
  await p.waitForSelector('.ml-rot');
  confere('as pílulas, cada uma com quem assina', (await p.locator('.ml-rot').count()) === 7
    && (await texto(p, '.ml-rot:nth-child(2) .ml-rem')) === 'Leadership' && (await texto(p, '.ml-rot:nth-child(4) .ml-rem')) === 'Relações Institucionais');
  confere('para quem vai: os grupos da pílula, ou a equipe toda',
    (await texto(p, '.ml-rot:nth-child(3)')).includes('Para: NRO_PROJECTS') && (await texto(p, '.ml-rot:nth-child(1)')).includes('Para: Equipe toda'));
  confere('o último envio e o que está na fila',
    (await texto(p, '.ml-rot:nth-child(1)')).includes('Último envio') && (await texto(p, '.ml-rot:nth-child(2)')).includes('Na fila'));
  confere('grupo que não existe mais vira aviso', (await texto(p, '.ml-rot:nth-child(7)')).includes('grupo inexistente: Grupo Antigo'));
  confere('fora da série fica apagada', await p.locator('.ml-rot.off').count() === 1);

  await p.click('button:has-text("Programar série")'); await p.waitForTimeout(700);
  confere('a série já vem de quatro em quatro dias, pulando fim de semana',
    (await p.inputValue('#se-int')) === '4' && await p.isChecked('#se-fds'));
  confere('o que já está na fila vem desmarcado; a fora da série nem aparece',
    !(await p.isChecked('.se-rt[value="r-PIL-02"]')) && await p.locator('.se-rt[value="r-PIL-07"]').count() === 0);
  confere('a pílula de grupo extinto fica de fora, com aviso', (await texto(p, '#se-prev tr.ml-fora')).includes('fica de fora')
    && (await texto(p, '#se-ok')) === 'Programar 4 e-mail(s)', await texto(p, '#se-ok'));
  await p.fill('#se-ini', dia(1)); await p.fill('#se-hora', '08:30'); await p.waitForTimeout(300);
  await p.click('#se-ok'); await p.waitForTimeout(1200);
  const serie = (await rpcs(p, 'email_programar')).at(-1)?.itens || [];
  const datas = serie.map(i => new Date(i.enviar_em));
  confere('quatro e-mails, um por pílula, na ordem', serie.map(i => i.roteiro_id).join() === 'r-PIL-01,r-PIL-04,r-PIL-05,r-PIL-06', serie.map(i => i.roteiro_id));
  confere('nenhum no fim de semana, todos às 8h30', datas.every(d => d.getDay() !== 0 && d.getDay() !== 6 && d.getHours() === 8 && d.getMinutes() === 30), datas);
  confere('com pelo menos quatro dias entre um e outro', datas.slice(1).every((d, i) => (d - datas[i]) / 864e5 >= 3.95));
  confere('cada um com o remetente e os grupos da pílula',
    serie[0].remetente_nome === 'Depto. de Pessoal | NeuroDynamics' && serie[0].todos === true
    && JSON.stringify(serie[1].grupos) === '[7]' && serie[1].remetente_nome === 'P&D | NeuroDynamics'
    && JSON.stringify(serie[3].grupos) === '[5,6]' && serie[3].remetente === 'leadership', serie.map(i => [i.remetente_nome, i.todos, i.grupos]));
  confere('e o e-mail pronto, com as cores da área e o botão para o portal',
    serie[2].html.includes('background:#E0E6FC') && serie[2].html.includes('https://membro.neurodynamics.dev/#/agenda') && serie[2].texto.includes('Texto da pílula PIL-05'));
  confere('depois, a fila', await p.evaluate(() => location.hash) === '#/admin/emails/programados'
    && (await p.locator('.ml-tab').first().locator('tbody tr').count()) === 5);

  await ir(p, '#/admin/emails/pilulas', 1100);
  await p.locator('.ml-rot', { hasText:'PIL-07' }).locator('button[title="Pôr na série"]').click(); await p.waitForTimeout(800);
  const at = (await escritas(p, 'email_roteiros')).at(-1);
  confere('pôr na série grava o ativo', at?.op === 'update' && at.dados.ativo === true, at);
  confere('e a tela volta com ela na série', await p.locator('.ml-rot.off').count() === 0);

  await p.locator('.ml-rot', { hasText:'PIL-05' }).locator('button[title="Editar"]').click(); await p.waitForTimeout(600);
  confere('editar traz o texto e os grupos', (await p.inputValue('#rt-cod')) === 'PIL-05' && (await p.inputValue('#rt-rem')) === 'ri');
  await p.fill('#rt-link', 'javascript:alert(1)'); await p.click('#modal button:has-text("Salvar")'); await p.waitForTimeout(400);
  confere('link de botão que não é https:// nem #/ é recusado', (await aviso(p)).includes('começa com https:// ou #/')
    && await p.locator('#modal.open').count() === 1);
  await p.fill('#rt-link', '#/servicos/eventos/novo'); await p.check('.rt-gp[value="NRO_MANAGERS"]');
  await p.click('#modal button:has-text("Salvar")'); await p.waitForTimeout(800);
  const ed = (await escritas(p, 'email_roteiros')).at(-1);
  confere('salvar grava o roteiro com os grupos pelo nome', ed?.op === 'update' && ed.dados.cta_link === '#/servicos/eventos/novo'
    && JSON.stringify(ed.dados.grupos) === '["NRO_MANAGERS"]' && ed.dados.remetente === 'ri', ed?.dados);

  await p.click('button:has-text("Nova pílula")'); await p.waitForTimeout(500);
  confere('pílula nova vem com o próximo código e o começo pelo nome',
    (await p.inputValue('#rt-cod')) === 'PIL-100' && (await p.inputValue('#rt-corpo')).startsWith('Olá, {{primeiro_nome}}.'));
  await p.click('#modal button:has-text("Cancelar")');

  await p.locator('.ml-rot', { hasText:'PIL-06' }).locator('button[title="Abrir no mailer"]').click(); await p.waitForTimeout(1200);
  confere('abrir no mailer leva a pílula para o formulário', await p.evaluate(() => location.hash) === '#/admin/emails'
    && (await p.inputValue('#ml-rem')) === 'leadership' && (await p.inputValue('#ml-chamada')) === 'Os OKRs agora se leem como um mapa'
    && (await p.inputValue('#ml-ctaurl')) === '#/agenda');
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= Studio ================= */
{
  console.log('\nStudio');
  const { ctx, p, erros } = await abrir({ hash:'#/studio/config/contas' });
  await p.waitForSelector('#lk-linkedin');
  confere('ao lado do usuário, o link de cada rede', (await p.inputValue('#lk-linkedin')) === 'https://www.linkedin.com/company/neurodynamics'
    && (await p.getAttribute('#lk-instagram', 'placeholder')) === 'https://www.instagram.com/neurodynamics.dev');
  await p.fill('#ct-youtube', '@nrotv'); await p.waitForTimeout(150);
  confere('o placeholder mostra o link que sai do usuário', (await p.getAttribute('#lk-youtube', 'placeholder')) === 'https://www.youtube.com/@nrotv');
  await p.fill('#lk-site', 'neurodynamics.dev'); await p.click('#st-cfg button:has-text("Salvar")'); await p.waitForTimeout(400);
  confere('link sem https:// é recusado', (await aviso(p)).includes('O link de Site precisa começar com https://'));
  await p.fill('#lk-site', 'https://neurodynamics.dev'); await p.click('#st-cfg button:has-text("Salvar")'); await p.waitForTimeout(800);
  const sv = (await escritas(p, 'studio_config')).at(-1);
  confere('salvar grava usuários e links', sv?.op === 'update' && sv.dados.contas.youtube === '@nrotv'
    && sv.dados.links.site === 'https://neurodynamics.dev' && sv.dados.links.linkedin === 'https://www.linkedin.com/company/neurodynamics', sv?.dados);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= Papéis ================= */
{
  console.log('\nPapéis');
  let { ctx, p, erros } = await abrir({ hash:'#/admin/emails', stub: stubDe('selecao') });
  confere('o Comitê de Seleção escreve e copia', await p.locator('.ml-tela').count() === 1 && await p.locator('button:has-text("Copiar e-mail")').count() === 1);
  confere('mas não programa nem vê as pílulas', await p.locator('#sec-emails .nav1').count() === 0
    && await p.locator('button:has-text("Programar envio")').count() === 0);
  await ir(p, '#/admin/emails/pilulas', 900);
  confere('nem pelo endereço', await p.locator('.ml-rot').count() === 0 && await p.locator('.ml-tela').count() === 1);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
  ({ ctx, p, erros } = await abrir({ hash:'#/admin/emails', stub: stubDe('leitura') }));
  confere('quem só lê não entra', await p.evaluate(() => location.hash) === '#/' && await p.locator('.ml-tela').count() === 0);
  await ctx.close();
  ({ ctx, p, erros } = await abrir({ hash:'#/admin/emails', vp:{ width:390, height:844 } }));
  confere('no celular, sem rolagem horizontal', await semRolagem(p));
  await ir(p, '#/admin/emails/pilulas', 1100);
  confere('nem nas pílulas', await semRolagem(p));
  await ir(p, '#/admin/emails/programados', 1100);
  confere('nem nos programados', await semRolagem(p));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
