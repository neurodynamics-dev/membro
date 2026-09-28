/* As entrevistas do processo seletivo online (v31), em Seleção › Agenda.
   Confere, com asserção (sai com código 1 se algo falhar):
     Abrir janela — a entrevista pede o link da chamada no lugar do local,
                    com o atalho "Criar no Meet"; sem link ou sem https://
                    não cria; cria os horários com o link e sem local; quem
                    abre aparece como responsável; a dinâmica continua com
                    local;
     Os horários  — o chip diz online e o primeiro nome de quem abriu; o
                    horário antigo, sem link, aparece tracejado;
     O horário    — o link, quem abriu, o último e-mail do candidato;
                    reagendar o candidato (o que vai ao banco, com o motivo);
                    mudar hora e link avisando; link inválido recusado;
                    assumir o horário antigo; excluir avisando;
     A ficha      — a entrevista com a chamada e quem conduz;
     e: sem erro de página, sem rolagem horizontal no celular.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stub = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/selecao/agenda' } = {}){
  const ctx = await nav.newContext({ viewport: vp });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.addInitScript(() => { window.__teste = { ps31:true }; try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} });
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(1300);
  return { ctx, p, erros };
}
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);
const escritas = (p, tabela) => p.evaluate(t => (window.__escritas || []).filter(x => x.tabela === t), tabela);
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const aviso = async p => ((await p.locator('.toast').last().textContent().catch(() => '')) || '').trim();
const semRolagem = p => p.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
const dia = d => { const x = new Date(); x.setDate(x.getDate() + d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
const entrevistas = async p => { await p.click('#sel-corpo .chip:has-text("Entrevistas individuais")'); await p.waitForTimeout(300); };

{
  console.log('\nAbrir janela');
  const { ctx, p, erros } = await abrir();
  confere('a dinâmica continua com local e vagas por horário', await p.locator('#ps-sl-local').count() === 1
    && await p.locator('#ps-sl-link').count() === 0 && await p.inputValue('#ps-sl-cap') === '8');
  await entrevistas(p);
  confere('a entrevista pede o link da chamada no lugar do local',
    await p.locator('#ps-sl-link').count() === 1 && await p.locator('#ps-sl-local').count() === 0);
  confere('entrevista é individual: sem o campo de vagas', await p.locator('#ps-sl-cap').count() === 0);
  confere('com o atalho para criar a sala no Meet',
    await p.getAttribute('#sel-corpo a:has-text("Criar no Meet")', 'href') === 'https://meet.google.com/new');
  confere('e quem abre fica como responsável', (await texto(p, '#sel-corpo .card')).includes('Responsável: Ana Figueiredo'));
  await p.fill('#ps-sl-data', dia(3));
  await p.click('button:has-text("Criar horários")'); await p.waitForTimeout(300);
  confere('sem link, não cria', (await aviso(p)).includes('Cole o link da chamada') && (await escritas(p, 'ps_slots')).length === 0);
  await p.fill('#ps-sl-link', 'meet.google.com/abc-defg-hij');
  await p.click('button:has-text("Criar horários")'); await p.waitForTimeout(300);
  confere('sem https://, também não', (await escritas(p, 'ps_slots')).length === 0);
  await p.fill('#ps-sl-link', 'https://meet.google.com/nov-sala-xyz');
  await p.click('button:has-text("Criar horários")'); await p.waitForTimeout(800);
  const ins = (await escritas(p, 'ps_slots')).find(x => x.op === 'insert')?.dados || [];
  confere('cria os oito horários das 14h às 18h, com o link e sem local',
    ins.length === 8 && ins.every(x => x.link_reuniao === 'https://meet.google.com/nov-sala-xyz' && x.local === null && x.fase === 'entrevista'
      && x.capacidade === 1),
    ins.slice(0, 2));

  console.log('\nOs horários');
  await entrevistas(p);
  const chips = await p.locator('.slot-chip').allTextContents();
  confere('o chip diz reservado ou livre, online, e o primeiro nome de quem abriu',
    chips.some(c => /14:00–14:30 reservado, online Ana/.test(c.replace(/\s+/g, ' ')))
    && chips.some(c => /14:30–15:00 livre, online Ana/.test(c.replace(/\s+/g, ' '))), chips.map(c => c.replace(/\s+/g, ' ').trim()));
  confere('o horário antigo, sem link, aparece tracejado', await p.locator('.slot-chip.sem-link').count() === 1);

  console.log('\nO horário');
  await p.locator(`.slot-chip[onclick*="'s3'"]`).click(); await p.waitForTimeout(300);
  const m = await texto(p, '#modal');
  confere('mostra o link e quem abriu', m.includes('meet.google.com/abc-defg-hij') && m.includes('Aberta por Ana Figueiredo'), m);
  confere('e o último e-mail do candidato', m.includes('Lia Moreira') && m.includes('Confirmação enviada'), m);
  await p.click('#modal button[title="Reagendar este candidato"]'); await p.waitForTimeout(300);
  confere('reagendar lista os horários livres da fase', await p.locator('#modal input[name="pr-slot"]').count() === 2);
  await p.click('#modal button:has-text("Reagendar e avisar")'); await p.waitForTimeout(200);
  confere('sem escolher, não reagenda', (await aviso(p)).includes('Escolha o novo horário') && (await rpcs(p, 'ps_reagendar')).length === 0);
  await p.check('#modal input[name="pr-slot"][value="s4"]');
  await p.fill('#pr-motivo', 'Conflito na agenda da entrevistadora');
  await p.click('#modal button:has-text("Reagendar e avisar")'); await p.waitForTimeout(900);
  const re = (await rpcs(p, 'ps_reagendar')).at(-1);
  confere('reagendar manda o agendamento, o novo horário e o motivo',
    re?.p_agendamento === 'ag2' && re?.p_slot === 's4' && re?.p_motivo === 'Conflito na agenda da entrevistadora', re);
  confere('e avisa que o candidato recebe por e-mail', (await aviso(p)).includes('recebe o novo horário por e-mail'));

  await entrevistas(p);
  await p.locator(`.slot-chip[onclick*="'s4'"]`).click(); await p.waitForTimeout(300);
  confere('a Lia está no horário novo', (await texto(p, '#modal')).includes('Lia Moreira'));
  await p.click('#modal button:has-text("Mudar horário ou link")'); await p.waitForTimeout(300);
  confere('mudar diz quem será avisado', (await texto(p, '#modal')).includes('1 candidato está neste horário'));
  await p.fill('#pe-link', 'http://zoom.us/x'); await p.click('#pe-ok'); await p.waitForTimeout(200);
  confere('link sem https:// é recusado', (await aviso(p)).includes('informe um link https://') && (await rpcs(p, 'ps_slot_editar')).length === 0);
  await p.fill('#pe-link', 'https://meet.google.com/out-ra-sala');
  await p.fill('#pe-ini', '15:00'); await p.fill('#pe-fim', '15:30'); await p.fill('#pe-motivo', 'Sala remarcada');
  await p.click('#pe-ok'); await p.waitForTimeout(900);
  const ed = (await rpcs(p, 'ps_slot_editar')).at(-1);
  confere('mudar manda hora, link, motivo e o aviso ligado',
    ed?.p_slot === 's4' && ed.p.hora_inicio === '15:00' && ed.p.hora_fim === '15:30' && ed.p.link_reuniao === 'https://meet.google.com/out-ra-sala'
    && ed.p.motivo === 'Sala remarcada' && ed.p.avisar === true, ed);
  confere('e diz que o candidato recebe o aviso', (await aviso(p)).includes('1 candidato recebe o aviso por e-mail'));

  await entrevistas(p);
  await p.locator('.slot-chip.sem-link').click(); await p.waitForTimeout(300);
  confere('o horário antigo avisa que está sem link e sem responsável',
    /Sem link de chamada/.test(await texto(p, '#modal')) && /Responsável não registrado/.test(await texto(p, '#modal')));
  await p.click('#modal button:has-text("Assumir")'); await p.waitForTimeout(800);
  const as = (await rpcs(p, 'ps_slot_editar')).at(-1);
  confere('assumir põe você como responsável, sem mandar e-mail', as?.p_slot === 's2' && as.p.assumir === true && as.p.avisar === false, as);

  await entrevistas(p);
  await p.locator(`.slot-chip[onclick*="'s4'"]`).click(); await p.waitForTimeout(300);
  await p.click('#modal button:has-text("Excluir")'); await p.waitForTimeout(300);
  confere('excluir avisa que o candidato recebe o e-mail', (await texto(p, '#modal')).includes('recebe um e-mail para escolher outro horário'));
  await p.click('#modal button:has-text("Excluir")'); await p.waitForTimeout(900);
  confere('excluir usa a função que avisa', JSON.stringify(await rpcs(p, 'ps_slot_excluir')) === '[{"p_slot":"s4","p_motivo":null}]'
    && (await aviso(p)).includes('1 candidato recebe o aviso por e-mail'));

  console.log('\nA ficha');
  await p.evaluate(() => location.hash = '#/selecao/candidatos/c5'); await p.waitForTimeout(1000);
  confere('a ficha da candidata abre', (await texto(p, '#modal')).includes('Lia Moreira'));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 } });
  await entrevistas(p);
  confere('no celular, sem rolagem horizontal', await semRolagem(p));
  await p.locator(`.slot-chip[onclick*="'s3'"]`).click(); await p.waitForTimeout(300);
  confere('nem com o horário aberto', await semRolagem(p));
  confere('sem erro de página no celular', erros.length === 0, erros);
  await ctx.close();
}
{
  /* a ficha: com a chamada e quem conduz */
  const { ctx, p } = await abrir({ hash:'#/selecao/candidatos/c5' });
  const f = await texto(p, '#modal');
  confere('a ficha traz a entrevista com a chamada e quem conduz', /Entrevista.*chamada.*com Ana Figueiredo/.test(f), f.slice(0, 400));
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
