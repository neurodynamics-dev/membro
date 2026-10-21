/* L4: as consultas do /labbio (início com revogação, membros e perfil,
   check-ins e treinamentos). Sem banco: window.__teste.labbio. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, viewport = { width:1280, height:900 }){
  const ctx = await nav.newContext({ viewport }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(() => { window.__teste = { labbio:{ conta:'ativo' } }; });
  await p.goto('http://localhost:8765/labbio/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#lb-topo:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);

try{
  console.log('Início');
  {
    const t = await abrir('#/'), { p } = t;
    await p.waitForSelector('.lb-rev');
    confere('a faixa da Lia Moura', (await p.locator('.lb-rev').innerText()).includes('Lia Moura saiu da equipe (Desligado'));
    const nums = (await p.locator('.lb-kpi .w-num').allInnerTexts()).join();
    confere('os quatro números do dia (pedidos, consultas, presença, biometria)', /^\d+,2,3,7$/.test(nums), nums);
    confere('com biometria diz de quantos', (await p.locator('.lb-kpi').nth(3).innerText()).includes('de 12 membros ativos'));
    confere('consultas sem resposta pedem atenção', await p.locator('.lb-kpi').nth(1).evaluate(e => e.classList.contains('atencao')));
    const fila = await p.locator('section:has(#lb-b-fila)').innerText();
    confere('para responder: as consultas, com sala e dia', fila.includes('Banca de TCC') && fila.includes('Auditório, Amanhã, 14:00–16:00'), fila);
    const dia = await p.locator('section:has(#lb-b-dia)').innerText();
    confere('hoje no LABBIO: o evento e os check-ins', dia.includes('Seminário interno') && dia.includes('Disponível') && dia.includes('Ana Figueiredo'), dia);
    confere('a presença de 14 dias', await p.locator('.lb-serie li').count() === 14 && await p.locator('.lb-serie table tr').count() === 14);
    confere('biometria e termo em barras', await p.locator('#lb-emp-bio .lb-emp-barra span').count() === 3 && await p.locator('#lb-emp-termo .lb-emp-barra span').count() === 4);
    const trein = await p.locator('.lb-trein').innerText();
    confere('treinamentos em aberto levam aos treinamentos', /2\s+pessoas/.test(trein) && await p.locator('.lb-trein').getAttribute('href') === '#/treinamentos', trein);
    await p.click('.lb-rev button'); await p.fill('#rvc-obs', 'Retirada na quinta'); await p.click('#rvc-ok');
    await p.waitForFunction(() => !document.querySelector('.lb-rev'));
    const ult = (await rpcs(p, 'labbio_revogacao_confirmar')).at(-1)?.p;
    confere('confirmar a retirada chama o banco e a faixa some', ult?.p_id === 'rv1' && ult?.p_observacao === 'Retirada na quinta', ult);
    await fechar(t);
  }

  console.log('Membros');
  {
    const t = await abrir('#/membros'), { p } = t;
    await p.waitForSelector('#lb-m-tabela');
    confere('quatro linhas, com a Lia', await p.locator('#lb-m-tabela tbody tr').count() === 4
      && (await p.locator('#lb-m-tabela').innerText()).includes('Lia Moura'));
    confere('a coluna de status no lugar da liderança', (await p.locator('#lb-m-tabela thead th').allTextContents()).map(x => x.trim()).filter(Boolean).slice(-5).join('|') === 'Membro|Área|Status|Termo|Acesso'
      && (await p.locator('#lb-m-tabela tr[data-reg="46"] .c-status').innerText()).includes('Desligado')
      && (await p.locator('#lb-m-tabela tr[data-reg="4"] .c-status').innerText()).includes('Ativo'));
    // selecionar e gerar a lista de e-mails dos selecionados
    await p.evaluate(() => { window.__copiado = null; navigator.clipboard.writeText = v => { window.__copiado = v; return Promise.resolve(); }; });
    confere('sem seleção, sem barra', await p.locator('.lb-selbar').count() === 0);
    await p.check('#lb-m-tabela [data-sel="4"]'); await p.check('#lb-m-tabela [data-sel="11"]');
    confere('marcar mostra quantos e a lista', (await p.locator('.lb-selbar-n').innerText()).includes('2 selecionados')
      && await p.locator('.lb-selbar-lista').inputValue() === 'ana@neurodynamics.dev, bruno@neurodynamics.dev');
    await p.locator('[data-sel-acao="copiar"]').click();
    confere('copiar leva a lista dos selecionados', await p.evaluate(() => window.__copiado) === 'ana@neurodynamics.dev, bruno@neurodynamics.dev');
    confere('escrever para eles abre o e-mail em cópia oculta', (await p.locator('.lb-selbar a[href^="mailto:"]').getAttribute('href')).startsWith('mailto:?bcc=ana%40neurodynamics.dev'));
    await p.selectOption('#lb-m-tipo', 'pessoal');
    confere('o e-mail pessoal: quem não tem aparece à parte', (await p.locator('.lb-selbar-sem').innerText()).includes('Ana Figueiredo')
      && await p.locator('[data-sel-acao="copiar"]').isDisabled());
    await p.selectOption('#lb-m-tipo', 'nro');
    const todos = p.locator('#lb-m-todos');
    confere('o "todos" fica indeterminado com parte marcada', await todos.evaluate(e => e.indeterminate));
    await todos.check();
    confere('marcar todos marca a lista inteira', (await p.locator('.lb-selbar-n').innerText()).includes('4 selecionados'));
    await p.fill('#lb-m-busca', 'Bruno'); await p.waitForTimeout(700);
    confere('a seleção continua ao buscar', (await p.locator('.lb-selbar-n').innerText()).includes('4 selecionados'));
    await p.locator('[data-sel-acao="limpar"]').click();
    confere('limpar desmarca tudo', await p.locator('.lb-selbar').count() === 0 && await p.locator('#lb-m-tabela [data-sel]:checked').count() === 0);
    await p.fill('#lb-m-busca', ''); await p.waitForTimeout(700);
    const textos = await p.evaluate(() => [...document.querySelectorAll('.c-termo, .c-acesso')].map(c => c.innerText.trim()));
    confere('termo e acesso sempre com texto', textos.every(Boolean), textos);
    confere('Lia com "Revogação pendente" e Bruno "Solicitado, no LABBIO"',
      (await p.locator('tr[data-reg="46"] .c-acesso').innerText()).includes('Revogação pendente')
      && (await p.locator('tr[data-reg="11"] .c-acesso').innerText()).includes('Solicitado, no LABBIO'));
    confere('Carla com o chip Trainee', /trainee/i.test(await p.locator('tr[data-reg="17"]').innerText()));
    await p.getByRole('button', { name:'Com biometria' }).click();
    confere('"Com biometria" deixa a Ana', (await p.locator('#lb-m-tabela tbody tr').count()) === 1
      && (await p.locator('#lb-m-tabela').innerText()).includes('Ana Figueiredo'));
    await p.getByRole('button', { name:'Todos' }).click();
    await p.fill('#lb-m-busca', 'bru');
    await p.waitForFunction(() => document.querySelectorAll('#lb-m-tabela tbody tr').length === 1);
    confere('a busca "bru" deixa o Bruno (no banco, depois da pausa)', (await p.locator('#lb-m-tabela').innerText()).includes('Bruno Tavares')
      && (await rpcs(p, 'labbio_membros')).at(-1).p.p_busca === 'bru');
    await fechar(t);
  }
  {
    /* 2.19.2: as fotos do repositório (nro-pessoal/fotos), como no portal: o Bruno (11) só tem .png lá; a Lia (46), nenhuma */
    const t = await abrir('#/membros'), { p } = t;
    const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    await p.unroute(/fonts\.googleapis|raw\.githubusercontent/);
    await p.route(/fonts\.googleapis/, r => r.abort());
    await p.route('**/raw.githubusercontent.com/**', r => /\/fotos\/11\.png$/.test(r.request().url())
      ? r.fulfill({ contentType:'image/png', body:PNG }) : r.fulfill({ status:404, body:'' }));
    await p.reload({ waitUntil:'domcontentloaded' });
    await p.waitForSelector('tr[data-reg="11"] .lb-av img[src$="/fotos/11.png"]');
    confere('sem foto na ficha, o painel busca no repositório de fotos e acha a .png', await p.locator('tr[data-reg="11"] .lb-av img').evaluate(i => i.complete && i.naturalWidth > 0));
    await p.waitForFunction(() => !document.querySelector('tr[data-reg="46"] .lb-av img'));
    confere('sem foto nenhuma, ficam as iniciais', /^[A-Z]{1,2}$/.test((await p.locator('tr[data-reg="46"] .lb-av').innerText()).trim()));
    await fechar(t);
  }
  {
    const t = await abrir('#/membros/4'), { p } = t;
    await p.waitForSelector('#lb-termo-abrir');
    confere('perfil: liderados com link', await p.locator('.lb-spec a[href="#/membros/11"]').count() === 1);
    await p.evaluate(() => { window.__copiado = null; navigator.clipboard.writeText = v => { window.__copiado = v; return Promise.resolve(); }; });
    confere('perfil: nome, registro, e-mails e telefone, cada um com copiar', await p.locator('.lb-dado .lb-copiar').count() >= 4);
    await p.locator('.lb-dado', { hasText:'E-mail da NRO' }).getByRole('button').click();
    confere('copiar leva o valor inteiro', /@/.test(await p.evaluate(() => window.__copiado) || ''), await p.evaluate(() => window.__copiado));
    confere('perfil: os valores não quebram linha', await p.locator('.lb-dado dd').evaluateAll(ds => ds.every(d => d.getClientRects().length === 1 && d.offsetHeight < 30)));
    const [aba] = await Promise.all([p.context().waitForEvent('page'), p.click('#lb-termo-abrir')]);
    await p.waitForFunction(() => (window.__baixados || []).some(b => b.bucket === 'termos'));
    const b = await p.evaluate(() => window.__baixados.find(x => x.bucket === 'termos'));
    confere('o termo abre em nova guia, por link assinado do bucket termos', !!aba && b.caminho.startsWith('labbio-2026/4/'), b);
    confere('o caminho do arquivo não aparece', !(await p.locator('body').innerText()).includes('labbio-2026/'));
    confere('o acesso em destaque na lateral', (await p.locator('.lb-acesso-dest').innerText()).includes('Possui'));
    await fechar(t);
  }

  console.log('Check-ins');
  {
    const t = await abrir('#/checkins'), { p } = t;
    await p.waitForSelector('#ck-tabela');
    confere('73 itens, "Página 1 de 2"', (await p.locator('.lb-total').innerText()).includes('73') && (await p.locator('#ck-pag').innerText()) === 'Página 1 de 2');
    const a = (await rpcs(p, 'labbio_checkins'))[0].p;
    confere('padrão: os últimos 7 dias', a.p_de === '2026-10-04' && a.p_ate === '2026-10-11', a);
    confere('a explicação do check-in', (await p.locator('.lb-nota').innerText()).includes('Não é registro da catraca'));
    await p.click('#ck-prox');
    await p.waitForFunction(() => document.querySelector('#ck-pag')?.textContent === 'Página 2 de 2');
    confere('a próxima página mostra o resto', await p.locator('#ck-tabela tbody tr').count() === 23);
    await p.locator('[data-o="folha"]').click();
    await p.waitForFunction(() => document.querySelector('.lb-total')?.textContent.includes('15'));
    confere('"Folha" reduz e volta à página 1', (await p.locator('#ck-pag').innerText()) === 'Página 1 de 1');
    await fechar(t);
  }

  console.log('Treinamentos');
  {
    const t = await abrir('#/treinamentos'), { p } = t;
    await p.waitForSelector('#tr-tabela');
    const bruno = p.locator('#tr-tabela tr[data-reg="11"] td').first();
    confere('Bruno em NRO-TRE-001: "Vencido", obrigatório', (await bruno.innerText()).includes('Vencido')
      && (await bruno.locator('.lb-est').getAttribute('aria-label')).includes('obrigatório'));
    confere('a validade no detalhe da Ana', (await p.locator('#tr-tabela tr[data-reg="4"] td .lb-est').first().getAttribute('title')).includes('vale até 01/03/2027'));
    confere('o aviso de que leitura não é certificação', (await p.locator('.lb-nota-curta').innerText()).includes('não é certificação'));
    await p.click('#tr-pend');
    confere('"Só pendências" esconde a Ana', await p.locator('#tr-tabela tr[data-reg="4"]').count() === 0 && await p.locator('#tr-tabela tr[data-reg="11"]').count() === 1);
    await fechar(t);
  }

  console.log('Celular');
  for (const h of ['#/membros', '#/membros/4', '#/checkins', '#/treinamentos']){
    const t = await abrir(h, { width:390, height:844 }), { p } = t;
    await p.waitForSelector('#lb-m-tabela, #lb-termo-abrir, #ck-tabela, #tr-tabela');
    const w = await p.evaluate(() => document.documentElement.scrollWidth);
    confere(`390 px sem rolagem da página em ${h}`, w <= 390, w);
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
