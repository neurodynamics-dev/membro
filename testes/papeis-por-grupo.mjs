/* Os papéis por grupo (2.18.0), na tela. Confere, com asserção de verdade
   (sai com código 1 se algo falhar):
     1. liderança: Administração só com os painéis da lista de escrita,
        o quadro de pessoal, a Seleção, e a ficha com dados pessoais e
        avaliações, sem ocorrências e sem editar;
     2. conta bloqueada (Desligado, Egresso, Sob demanda): o portal não
        abre, o login diz "Acesso encerrado." e a sessão termina;
     3. sem a 2.18.0 no banco, vale o papel da conta, como antes;
     4. Administração › Grupos: o papel do grupo, que só admin muda;
     5. Administração › Contas: o papel efetivo com a origem, e o
        papel na conta só admin ou consulta.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubDe = papel => stubAdmin.replace("papel:'admin'", `papel:'${papel}'`);
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ hash = '#/', stub = stubAdmin, teste, casca = true } = {}){
  const ctx = await nav.newContext({ viewport:{ width:1440, height:960 } });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/fonts.googleapis.com/**', r => r.abort());
  await p.route('**/raw.githubusercontent.com/**', r => r.abort());
  await p.addInitScript(t => { window.__teste = t || {}; try { localStorage.setItem('nd.menu', 'aberto'); } catch(e){} }, teste);
  await p.goto('http://localhost:8765/index.html' + hash, { waitUntil:'domcontentloaded' });
  if (casca) await p.waitForSelector('#hd:not([hidden])');
  await p.waitForTimeout(900);
  return { ctx, p, erros };
}
const ir = async (p, hash, espera = 900) => { await p.evaluate(h => location.hash = h, hash); await p.waitForTimeout(espera); };
const filhos = (p, r) => p.evaluate(r => [...document.querySelectorAll(`#lt-nav .lt-sec[data-r="${r}"] .lt-filho .nm`)]
  .map(x => x.textContent.trim()), r);
const rpcs = (p, nome) => p.evaluate(n => (window.__rpcs || []).filter(x => x.nome === n).map(x => x.p), nome);

/* ---------- 1: liderança ---------- */
console.log('Liderança');
{
  const { ctx, p, erros } = await abrir({ stub: stubDe('lideranca') });
  confere('o papel aparece no menu', (await p.textContent('#u-papel')).trim() === 'Liderança');
  const adm = await filhos(p, 'admin');
  confere('Administração: avisos, links, e-mails, relatórios e site',
    ['Quadro de avisos', 'Links úteis', 'E-mails', 'Relatórios', 'Site institucional'].every(x => adm.includes(x)), adm);
  confere('e não contas, grupos, solicitações, ouvidoria, catálogo de acessos',
    !['Contas e perfis', 'Grupos e quadros', 'Solicitações', 'Ouvidoria', 'Catálogo de acessos'].some(x => adm.includes(x)), adm);
  confere('Equipe tem o quadro de pessoal', (await filhos(p, 'equipe')).includes('Quadro de pessoal'));
  confere('e a Seleção aparece', (await filhos(p, 'selecao')).length > 0);
  await ir(p, '#/equipe/11', 1500);
  const abas = await p.evaluate(() => [...document.querySelectorAll('#main nav.nav1[aria-label="Ficha"] button')].map(a => a.textContent.trim()));
  confere('a ficha abre, com dados pessoais e avaliações', abas.some(a => /Dados pessoais/.test(a)) && abas.some(a => /Avaliações/.test(a)), abas);
  confere('sem a aba de ocorrências', !abas.some(a => /Ocorrências/.test(a)), abas);
  confere('e sem editar a ficha', await p.locator('#main button:has-text("Editar dados")').count() === 0);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 2: conta bloqueada ---------- */
console.log('\nConta bloqueada');
{
  const { ctx, p, erros } = await abrir({ teste:{ bloqueada:true }, casca:false });
  await p.waitForTimeout(800);
  confere('o portal não abre', await p.evaluate(() => document.getElementById('hd').hidden));
  confere('o login diz "Acesso encerrado."', await p.isVisible('#lg-ok') && (await p.textContent('#lgok-t')).trim() === 'Acesso encerrado.',
    await p.textContent('#lgok-t'));
  confere('e nada do portal foi pedido', (await rpcs(p, 'contas_papeis')).length === 0 && await p.evaluate(() => !state.perfil));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 3: sem a 2.18.0 no banco ---------- */
console.log('\nSem a 2.18.0');
{
  const { ctx, p, erros } = await abrir({ stub: stubDe('pessoal'), teste:{ v218:'falta' } });
  confere('vale o papel da conta', JSON.stringify(await p.evaluate(() => state.perfil.papeis)) === '["pessoal","leitura"]',
    await p.evaluate(() => state.perfil.papeis));
  confere('e o menu é o de sempre', (await filhos(p, 'admin')).includes('Contas e perfis'));
  await ir(p, '#/admin/grupos', 1500);
  confere('Grupos sem a seção do papel', await p.locator('#gr-papel').count() === 0 && !/Papel/.test(await p.textContent('#gr-detalhe .adm-grupo:nth-of-type(1)').catch(() => '')));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ---------- 4: Administração › Grupos ---------- */
console.log('\nGrupos');
{
  const { ctx, p, erros } = await abrir({ hash:'#/admin/grupos/DEP' });
  await p.waitForSelector('#gr-papel', { timeout:9000 }).catch(() => {});
  confere('o grupo mostra o papel (Depto de Pessoal: pessoal)', await p.inputValue('#gr-papel').catch(() => null) === 'pessoal'
    && /Depto\. de Pessoal/.test(await p.textContent('.gr-cab')));
  await ir(p, '#/admin/grupos/ORT', 1200);
  await p.selectOption('#gr-papel', 'lideranca'); await p.waitForTimeout(800);
  const def = (await rpcs(p, 'grupo_papel_definir')).at(-1);
  confere('admin define o papel', def?.grupo_id === 1 && def?.papel === 'lideranca', def);
  confere('e o cabeçalho mostra', /Liderança/.test(await p.textContent('.gr-cab')));
  await p.selectOption('#gr-papel', ''); await p.waitForTimeout(800);
  confere('e tira', (await rpcs(p, 'grupo_papel_definir')).at(-1)?.papel === null);
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}
{
  const { ctx, p } = await abrir({ hash:'#/admin/grupos/DEP', stub: stubDe('pessoal') });
  confere('pessoal vê o papel, sem mudar', await p.locator('#gr-papel').count() === 0
    && /Depto\. de Pessoal/.test(await p.textContent('#gr-detalhe')));
  await ctx.close();
}

/* ---------- 5: Administração › Contas ---------- */
console.log('\nContas');
{
  const { ctx, p, erros } = await abrir({ hash:'#/admin/contas' });
  await p.waitForTimeout(800);
  const cab = await p.evaluate(() => [...document.querySelectorAll('#modal th, #sec-contas th, table th')].map(t => t.textContent.trim()));
  confere('a tabela tem o papel efetivo', cab.some(t => /Papel efetivo/.test(t)), cab);
  const ops = await p.evaluate(() => [...(document.querySelector('select[onchange^="ctPapel"]')?.options || [])].map(o => o.value));
  confere('o papel na conta é só admin ou consulta', JSON.stringify(ops) === '["admin","leitura"]', ops);
  confere('a origem aparece ("na conta")', /na conta/.test(await p.evaluate(() => document.body.innerText)));
  confere('sem erro de página', erros.length === 0, erros);
  await ctx.close();
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exitCode = falhas ? 1 : 0;
