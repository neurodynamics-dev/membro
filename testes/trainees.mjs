/* T2: Seleção › Trainees (admitir com prévia, quadro, efetivar, dispensar)
   e o chip/filtro de trainee no quadro de pessoal. Sem banco. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const troca = (s, velho, novo) => { if (!s.includes(velho)) throw new Error('o stub mudou: ' + velho.slice(0, 60)); return s.replace(velho, novo); };
const comPapel = papel => troca(stubAdmin, "papel:'admin'", `papel:'${papel}'`);
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });
let falhas = 0, checks = 0;
function confere(nome, ok, detalhe){
  checks++; console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : ' → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir(hash, stub){
  const ctx = await nav.newContext({ viewport:{ width:1440, height:960 } }); ctx.setDefaultTimeout(10000);
  const p = await ctx.newPage(), erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.clock.setFixedTime(new Date('2026-10-11T12:00:00Z'));
  await p.route('**/*supabase*.js', r => r.fulfill({ contentType:'application/javascript', body:stub }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent/, r => r.abort());
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  await p.waitForSelector('#hd:not([hidden])');
  return { ctx, p, erros };
}
async function fechar({ ctx, erros }){ confere('sem erro de página', erros.length === 0, erros); await ctx.close(); }
const rpcs = (p, n) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n), n);

try{
  console.log('Admitir');
  {
    const t = await abrir('#/selecao/trainees', comPapel('pessoal')), { p } = t;
    await p.waitForSelector('#ps-tr-quadro, #sel-corpo .card');
    await p.waitForSelector('#ps-tr-admitir');
    confere('três pendentes', await p.locator('[id^="ps-tr-c-"]').count() === 3);
    const bruno = p.locator('#ps-tr-c-c3');
    confere('Bruno com a caixa desabilitada e o aviso', await bruno.locator('input[type=checkbox]').isDisabled()
      && (await bruno.innerText()).includes('Já existe um membro com este e-mail (registro 11): confira antes.'));
    confere('sem seleção, "Admitir" desabilitado', await p.locator('#ps-tr-admitir').isDisabled());
    await p.check('#ps-tr-c-c1 input'); await p.check('#ps-tr-c-c2 input');
    await p.click('#ps-tr-admitir');
    await p.waitForSelector('#ps-tr-confirmar');
    confere('a prévia tem uma linha por pessoa', await p.locator('[id^="ps-tr-p-"]').count() === 2);
    confere('NRO_TRAINEE fixo', await p.locator('#ps-tr-p-0 label', { hasText:'NRO_TRAINEE' }).locator('input').isDisabled()
      && await p.locator('#ps-tr-p-0 label', { hasText:'NRO_TRAINEE' }).locator('input').isChecked());
    confere('área pré-escolhida pela primeira de interesse', await p.locator('#ps-tr-area-0').inputValue() === 'Mecânica');
    await p.click('#ps-tr-confirmar');
    await p.waitForSelector('#ps-tr-erro-0:not([hidden])');
    confere('sem gestor: erro na linha', (await p.locator('#ps-tr-erro-0').innerText()) === 'Escolha um gestor ativo.');
    confere('e nada foi admitido', await p.evaluate(() => window.__trn.quadro.length) === 1);
    await p.selectOption('#ps-tr-gestor-0', '4'); await p.selectOption('#ps-tr-gestor-1', '4');
    await p.locator('#ps-tr-p-0 label', { hasText:'Sinais' }).locator('input').check();
    await p.click('#ps-tr-confirmar');
    await p.waitForFunction(() => !document.querySelector('#modal').classList.contains('open'));
    const ult = (await rpcs(p, 'ps_admitir_trainees')).at(-1).p.p_itens;
    confere('ps_admitir_trainees com os dois, área, gestor e grupos', ult.length === 2 && ult[0].area === 'Mecânica' && ult[0].gestor === 4
      && ult[0].grupos.join() === 'NRO_TRAINEE,Sinais' && ult[1].grupos.join() === 'NRO_TRAINEE' && !('registro' in ult[0]), ult);
    await p.waitForFunction(() => document.querySelectorAll('[id^="ps-tr-c-"]').length === 1);
    confere('"Para admitir" fica com o Bruno', await p.locator('#ps-tr-c-c3').count() === 1);

    console.log('No quadro');
    await p.locator('.seg button', { hasText:'Simulação' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#ps-tr-quadro tbody tr').length === 1);
    const linha = p.locator('#ps-tr-quadro tbody tr').first();
    confere('o filtro de interesse deixa só a Paula', (await linha.innerText()).includes('Paula Nunes'));
    confere('a alocação é a escolhida, não a de interesse', (await linha.locator('.ps-tr-aloc').innerText()) === 'Mecânica');
    await p.locator('.seg button', { hasText:'Todas' }).click();
    await p.waitForFunction(() => document.querySelectorAll('#ps-tr-quadro tbody tr').length === 3);

    console.log('Efetivar e dispensar');
    await p.locator('#ps-tr-quadro tr', { hasText:'Sara Lopes' }).getByRole('button', { name:'Efetivar' }).click();
    await p.fill('#ps-tr-cargo', 'Trainee'); await p.getByRole('button', { name:'Efetivar', exact:true }).last().click();
    confere('cargo Trainee não efetiva', (await p.locator('#ps-tr-ef-erro').innerText()).includes('não pode ser Trainee'));
    await p.fill('#ps-tr-cargo', 'Engenheira de projetos'); await p.getByRole('button', { name:'Efetivar', exact:true }).last().click();
    await p.waitForFunction(() => ![...document.querySelectorAll('#ps-tr-quadro tbody tr')].some(r => r.innerText.includes('Sara Lopes')));
    confere('efetivada some do quadro', true);
    const antes = (await rpcs(p, 'trainee_dispensar')).length;
    await p.locator('#ps-tr-quadro tr', { hasText:'Paula Nunes' }).getByRole('button', { name:'Dispensar' }).click();
    await p.locator('#modal').getByRole('button', { name:'Dispensar', exact:true }).click();
    confere('sem motivo não chama', (await rpcs(p, 'trainee_dispensar')).length === antes
      && (await p.locator('#ps-tr-di-erro').innerText()).includes('motivo'));
    await p.fill('#ps-tr-motivo', 'Não compareceu às atividades');
    await p.locator('#modal').getByRole('button', { name:'Dispensar', exact:true }).click();
    await p.waitForSelector('.toast', { hasText:'PES-31' });
    confere('com motivo: toast com o card', (await p.locator('.toast').last().innerText()).includes('PES-31'));
    await fechar(t);
  }

  console.log('Ficha do candidato, papel sem acesso, chip no quadro');
  {
    const t = await abrir('#/selecao/candidatos', comPapel('pessoal')), { p } = t;
    await p.waitForFunction(() => typeof psCand === 'function' && PS.pronto);
    const id = await p.evaluate(() => PS.candidatos.find(c => c.status === 'trainee')?.id);
    await p.evaluate(id => psAbrirFicha(id), id);
    await p.waitForSelector('#modal a[href="#/selecao/trainees"]', { state:'attached' });
    confere('ficha de trainee aponta para Seleção › Trainees', (await p.locator('#modal').textContent()).includes('Para trainees, use'));
    await fechar(t);
  }
  {
    const t = await abrir('#/selecao/trainees', comPapel('leitura')), { p } = t;
    await p.waitForTimeout(500);
    confere('papel leitura: sem a aba Trainees', await p.locator('a[href="#/selecao/trainees"]').count() === 0);
    confere('e a tela não abre', !(await p.locator('#main').innerText()).includes('Para admitir'));
    await fechar(t);
  }
  {
    const stub = troca(stubAdmin, "cargo:'Pesquisador'", "cargo:'Trainee'");
    const t = await abrir('#/equipe/quadro', stub), { p } = t;
    await p.waitForSelector('#tb-membros tbody tr');
    const bruno = p.locator('#tb-membros tr', { hasText:'Bruno Tavares' });
    confere('chip Trainee no quadro', await bruno.locator('.chip', { hasText:'Trainee' }).count() === 1);
    await p.click('#q-f-trainee');
    const nomes = await p.locator('#tb-membros tbody td.nome').allInnerTexts();
    confere('filtro Trainees deixa só o trainee', nomes.length === 1 && nomes[0].includes('Bruno Tavares'), nomes);
    await p.evaluate(() => { location.hash = '#/equipe/11'; });
    await p.waitForSelector('.cab-meta .chip');
    confere('chip Trainee na ficha', (await p.locator('.cab-meta').innerText()).includes('Trainee'));
    await fechar(t);
  }
}catch(e){ console.error(e); falhas++; }
await nav.close();
if (falhas){ console.log(`\n${falhas} falha(s) em ${checks} verificações.`); process.exit(1); }
console.log(`\nTudo certo. ${checks} verificações passaram.`);
