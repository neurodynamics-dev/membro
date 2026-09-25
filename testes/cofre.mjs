/* O cofre (v27), na tela.
   Confere, com asserção (sai com código 1 se algo falhar):
     Início — a senha que eu mantenho e vence entra na faixa do que espera;
     Minhas contas — por categoria; o aviso das que pedem troca; filtrar;
       ver a senha (e ela some sozinha), copiar a senha e o usuário (a área
       de transferência recebe o valor), gerar o código de duas etapas — o
       mesmo que a RFC 6238 dá —, as notas secretas, a senha anterior;
     Trocar a senha — o gerador (tamanho, conjuntos, sem caracteres
       parecidos), registrar a nova;
     Nova conta — o acesso do catálogo, o endereço sem https ganha https,
       a senha gerada, o 2FA pela chave colada e pelo QR Code de uma imagem,
       com o código de agora para conferir; quem usa e quem mantém;
     Gestão — todas, os acessos sem conta, a exportação no modelo da NRO
       sem segredo nenhum, o registro de uso filtrado, desativar e excluir;
     Configurações — os prazos, e o que não vale não grava;
     Quem só usa — não vê a conta de outro grupo, não entra na gestão, e
       o responsável edita sem mexer em quem usa;
     e: a busca, o celular sem rolagem horizontal, nenhum erro de página.
   Rode com o portal servido da raiz: python3 -m http.server 8765 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const stubAdmin = readFileSync(new URL('./stub-supabase.js', import.meta.url), 'utf8');
const stubLeitura = stubAdmin.replace("papel:'admin'", "papel:'leitura'");
const JSPDF = readFileSync(new URL('./node_modules/jspdf/dist/jspdf.umd.min.js', import.meta.url), 'utf8');
const QR = readFileSync(new URL('./node_modules/qrcode-generator/qrcode.js', import.meta.url), 'utf8');
const JSQR = readFileSync(new URL('./node_modules/jsqr/dist/jsQR.js', import.meta.url), 'utf8');
const nav = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium', env:{ ...process.env, LANG:'C.UTF-8', LC_ALL:'C.UTF-8' } });

let falhas = 0;
function confere(nome, ok, detalhe){
  console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || detalhe === undefined ? '' : '  → ' + JSON.stringify(detalhe)}`);
  if (!ok) falhas++;
}
async function abrir({ vp = { width:1440, height:960 }, hash = '#/', stub = stubAdmin } = {}){
  const ctx = await nav.newContext({ viewport: vp, acceptDownloads: true });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin:'http://localhost:8765' });
  const p = await ctx.newPage();
  const erros = []; p.on('pageerror', e => erros.push(e.message));
  await p.route('**/*supabase*.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:stub }));
  await p.route('**/cdnjs.cloudflare.com/**/jspdf.umd.min.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSPDF }));
  await p.route('**/cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:QR }));
  await p.route('**/cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js', r => r.fulfill({ status:200, contentType:'application/javascript', body:JSQR }));
  await p.route(/fonts\.googleapis|raw\.githubusercontent|youtube\.com|ytimg/, r => r.abort());
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
const texto = async (p, sel) => { const l = p.locator(sel).first();
  return (await l.count()) ? ((await l.textContent()) || '').replace(/\s+/g, ' ').trim() : ''; };
const area = p => p.evaluate(() => navigator.clipboard.readText());

/* o código de duas etapas, calculado aqui, pela RFC 6238 */
const SEGREDO = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
function totp(b32, t){
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567', out = []; let bits = 0, buf = 0;
  for (const c of b32){ buf = (buf << 5) | A.indexOf(c); bits += 5; if (bits >= 8){ bits -= 8; out.push((buf >>> bits) & 255); buf &= (1 << bits) - 1; } }
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(Math.floor(t / 1000 / 30)));
  const h = createHmac('sha1', Buffer.from(out)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, '0');
}
const codigoValido = c => [-30000, 0, 30000].some(d => totp(SEGREDO, Date.now() + d) === String(c).replace(/\s/g, ''));

const C1 = 'c0f00000-0000-4000-8000-000000000001', C2 = 'c0f00000-0000-4000-8000-000000000002', C3 = 'c0f00000-0000-4000-8000-000000000003';
const OTP = `otpauth://totp/Google:equipe@neurodynamics.dev?secret=${SEGREDO}&issuer=Google&digits=6&period=30`;

/* ================= gestão (admin): usar ================= */
{
  console.log('\nMinhas contas');
  const { ctx, p, erros } = await abrir();
  confere('o início avisa a senha que eu mantenho e está vencendo',
    /Uma senha do cofre para trocar/.test(await texto(p, '#sec-pend')) && await p.locator('#sec-pend a.pend-i[href="#/servicos/cofre"]').count() === 1);
  await ir(p, '#/servicos/cofre', 1300);
  const secs = await p.evaluate(() => [...document.querySelectorAll('.cof-sec h2')].map(h => h.textContent));
  confere('as contas por categoria do catálogo, sistemas primeiro', secs.join('|') === 'Sistema / plataforma|Local', secs);
  confere('as três contas', await p.locator('.cof-card').count() === 3);
  confere('o aviso das que eu mantenho e pedem troca', /2 contas que você mantém pedem a troca/.test(await texto(p, '.aviso-box.warn')));
  confere('a situação de cada uma', /Troca vence logo/.test(await texto(p, `#cof-${C1} .pill`)) && /Troca vencida/.test(await texto(p, `#cof-${C2} .pill`))
    && /Em dia/.test(await texto(p, `#cof-${C3} .pill`)));
  confere('a lista não traz segredo nenhum', !/Gw!8vQ|Adm#5tR9|Fx4\$pL8|GEZDGNBV/.test(await p.content()));
  await p.fill('#cof-busca', 'fechadura'); await p.waitForTimeout(150);
  confere('filtrar deixa só a conta que casa', await p.locator('.cof-card:visible').count() === 1 && await p.locator(`#cof-${C3}`).isVisible());
  await p.fill('#cof-busca', ''); await p.dispatchEvent('#cof-busca', 'input');

  /* a senha */
  await p.click(`#cofv-${C1}`); await p.waitForTimeout(500);
  confere('ver mostra a senha', await texto(p, `#cofs-${C1}`) === 'Gw!8vQ#2mZr4Tn%6');
  confere('e ela some sozinha em 20 segundos', await p.evaluate(id => cof.esconde.has(id) && COF_MOSTRA_S === 20, C1));
  confere('ver fica registrado como ver', JSON.stringify((await rpcs(p, 'cofre_revelar')).pop()) === JSON.stringify({ p_id:C1, p_campo:'senha', p_acao:'ver' }));
  await p.click(`#cofv-${C1}`); await p.waitForTimeout(150);
  confere('o olho esconde de novo', /^•+$/.test(await texto(p, `#cofs-${C1}`)));
  await p.click(`#cof-${C1} button[title="Copiar a senha"]`); await p.waitForTimeout(500);
  confere('copiar põe a senha na área de transferência', await area(p) === 'Gw!8vQ#2mZr4Tn%6');
  confere('e fica registrado como copiar', (await rpcs(p, 'cofre_revelar')).pop()?.p_acao === 'copiar' && /limpa em 60 segundos/.test(await toasts(p)));
  const antes = (await rpcs(p, 'cofre_revelar')).length;
  await p.click(`#cof-${C1} button[title="Copiar o usuário"]`); await p.waitForTimeout(300);
  confere('o usuário não é segredo: copia sem ir ao cofre', await area(p) === 'equipe@neurodynamics.dev' && (await rpcs(p, 'cofre_revelar')).length === antes);

  /* o código de duas etapas */
  await p.click(`#cofc-${C1} button`); await p.waitForTimeout(800);
  const cod = await p.getAttribute(`#cofc-${C1} .cof-cod`, 'data-cod');
  confere('o código de duas etapas é o da RFC 6238', codigoValido(cod), cod);
  confere('com a contagem regressiva', /^\d+$/.test(await texto(p, `#cofc-${C1} .cof-anel b`)));
  await p.click(`#cofc-${C1} button[title="Copiar o código"]`); await p.waitForTimeout(300);
  confere('copiar o código leva só os dígitos', await area(p) === cod);
  confere('gerar ficou registrado', (await rpcs(p, 'cofre_codigo')).length === 1);

  /* as notas e a anterior */
  await p.click(`#cof-${C1} button:has-text("Notas secretas")`); await p.waitForTimeout(500);
  confere('as notas secretas abrem num modal', /1234 5678/.test(await texto(p, '#modal .cof-notas')));
  await p.evaluate(() => fechaModal());
  await p.click(`#cof-${C2} button:has-text("Senha anterior")`); await p.waitForTimeout(250);
  await p.click('#modal button[title="Mostrar"]'); await p.waitForTimeout(500);
  confere('a senha anterior, para quem mantém', await texto(p, '#cofant') === 'Velha-Senha-01'
    && (await rpcs(p, 'cofre_revelar')).pop()?.p_campo === 'anterior');
  await p.evaluate(() => fechaModal());

  /* trocar a senha, com o gerador */
  await p.click(`#cof-${C1} button:has-text("Trocar a senha")`); await p.waitForTimeout(300);
  const s1 = await p.inputValue('#cof-nova');
  confere('o gerador abre com 20 caracteres, dos quatro conjuntos', s1.length === 20 && /[A-Z]/.test(s1) && /[a-z]/.test(s1) && /\d/.test(s1) && /[^A-Za-z\d]/.test(s1), s1);
  confere('sem caracteres que se confundem', !/[0O1lI]/.test(s1), s1);
  confere('e diz a força', /muito forte · \d+ bits · 20 caracteres/.test(await texto(p, '#cof-nova-forca')));
  await p.uncheck('#modal .cof-ger-op label:has-text("!@#") input'); await p.waitForTimeout(100);
  confere('sem símbolos, a nova vem sem símbolos', /^[A-Za-z0-9]{20}$/.test(await p.inputValue('#cof-nova')));
  await p.locator('#modal .cof-tam input').fill('32'); await p.waitForTimeout(100);
  const s2 = await p.inputValue('#cof-nova');
  confere('o tamanho muda na hora', s2.length === 32, s2);
  await p.check('#modal .cof-ger-op label:has-text("!@#") input');
  const s3 = await p.inputValue('#cof-nova');
  await p.click('#cof-t-btn'); await p.waitForTimeout(1300);
  const tr = await rpcs(p, 'cofre_trocar_senha');
  confere('registrar manda a senha nova', tr.length === 1 && tr[0].p_id === C1 && tr[0].p_nova === s3, tr);
  confere('e a conta fica em dia, com a anterior guardada', /Senha registrada/.test(await toasts(p)) && /Em dia/.test(await texto(p, `#cof-${C1} .pill`))
    && await p.locator(`#cof-${C1} button:has-text("Senha anterior")`).count() === 1);

  /* a busca acha a conta */
  await p.keyboard.press('/'); await p.waitForTimeout(200);
  await p.keyboard.type('fechadura', { delay:20 }); await p.waitForTimeout(300);
  const achou = await p.evaluate(() => [...document.querySelectorAll('.pl-item')].map(b => b.textContent.replace(/\s+/g, ' ').trim()));
  confere('a busca acha a conta', achou.some(t => /Painel da fechadura/.test(t)), achou);
  await p.keyboard.press('Escape');
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= gestão (admin): cadastrar e manter ================= */
{
  console.log('\nGestão');
  const { ctx, p, erros } = await abrir({ hash:'#/servicos/cofre/gestao' });
  await p.waitForTimeout(500);
  confere('a gestão lista todas', await p.locator('.cof-tab tbody tr').count() === 3);
  confere('e o acesso do catálogo ainda sem conta', /Termo de confidencialidade/.test(await texto(p, '.cof-sem')));
  await p.click('button:has-text("Exportar o registro")');
  await p.waitForFunction(() => window.__docnro, null, { timeout:15000 });
  const reg = await p.evaluate(() => window.__docnro.textos.join(' ').replace(/\s+/g, ' '));
  confere('o registro de contas sai no modelo da NRO, com as contas', /Registro de contas digitais/.test(reg) && /Painel da fechadura/.test(reg)
    && /Administrador/.test(reg) && /propriedade confidencial/.test(reg), reg.slice(0, 300));
  confere('e sem segredo nenhum', !/Gw!8vQ|Adm#5tR9|Fx4\$pL8|Velha-Senha|GEZDGNBV|1234 5678/.test(reg));

  /* nova conta, pelo acesso sem conta */
  await p.click('.cof-sem a:has-text("Termo de confidencialidade")'); await p.waitForTimeout(1200);
  confere('o acesso do catálogo vem escolhido', await p.inputValue('#cf-item') === 'i3');
  const sen = await p.inputValue('#cf-senha');
  confere('a senha já vem gerada', sen.length === 20);
  await p.fill('#cf-rot', 'Portal de assinaturas'); await p.fill('#cf-url', 'assina.exemplo.org/login'); await p.fill('#cf-usu', 'nro-termos');
  await p.fill('#cf-totp', 'jbsw y3dp'); await p.waitForTimeout(300);
  confere('chave curta demais é recusada na hora', /não parece válido/.test(await texto(p, '#cf-totp-ok')));
  /* o QR Code de uma imagem: o print da tela do serviço */
  const qrcode = require('qrcode-generator');
  const q = qrcode(0, 'M'); q.addData(OTP); q.make();
  const gif = Buffer.from(q.createDataURL(6, 4).split(',')[1], 'base64');
  await p.setInputFiles('.cof-qr input[type=file]', { name:'qr.gif', mimeType:'image/gif', buffer:gif }); await p.waitForTimeout(1500);
  confere('ler o QR Code de uma imagem preenche o link', await p.inputValue('#cf-totp') === OTP, await p.inputValue('#cf-totp'));
  const ok2fa = await texto(p, '#cf-totp-ok');
  const agora = /Código agora: (\d{3} \d{3})/.exec(ok2fa)?.[1];
  confere('e mostra o código de agora, para terminar de ligar no serviço', /Chave válida/.test(ok2fa) && /Google/.test(ok2fa) && codigoValido(agora), ok2fa);
  await p.fill('#cf-notas', 'Códigos: 1111 2222');
  await p.fill('#cf-instr', 'Só para assinar os termos de confidencialidade.');
  await p.check('input.cf-g[value="1"]'); await p.check('input.cf-r[value="17"]');
  await p.selectOption('#cf-prazo', '90');
  await p.click('#cf-salvar'); await p.waitForTimeout(1500);
  const sv = (await rpcs(p, 'cofre_salvar')).pop();
  confere('guardar manda a conta inteira',
    sv?.item_id === 'i3' && sv.url === 'https://assina.exemplo.org/login' && sv.usuario === 'nro-termos' && sv.senha === sen
      && JSON.stringify(sv.totp) === JSON.stringify({ segredo:SEGREDO, digitos:6, periodo:30, algoritmo:'SHA1' })
      && sv.notas === 'Códigos: 1111 2222' && JSON.stringify(sv.grupos) === '[1]' && JSON.stringify(sv.responsaveis) === '[17]' && sv.rotacao_dias === 90, sv);
  const novo = await p.evaluate(() => location.hash.split('/').pop());
  confere('e volta para a lista, com a conta em destaque', /^[0-9a-f-]{36}$/.test(novo) && await p.locator(`#cof-${novo}.destaque`).count() === 1);

  /* editar: desativar, e o 2FA que se tira */
  await ir(p, `#/servicos/cofre/editar/${C3}`, 1200);
  confere('editar mostra o que não é segredo', await p.inputValue('#cf-usu') === 'labbio' && await p.inputValue('#cf-url') === 'http://192.168.0.10');
  confere('e não traz campo de senha: a troca é pelo botão', await p.locator('#cf-senha').count() === 0);
  await p.uncheck('#cf-ativo'); await p.click('#cf-salvar'); await p.waitForTimeout(1300);
  const ed = (await rpcs(p, 'cofre_salvar')).pop();
  confere('desativar vai junto', ed?.id === C3 && ed.ativo === false && !('senha' in ed), ed);
  confere('a desativada fica marcada para quem mantém', await p.locator(`#cof-${C3}.off`).count() === 1);
  await ir(p, `#/servicos/cofre/editar/${C1}`, 1200);
  await p.click('#cf-2fa button:has-text("Desligar")'); await p.waitForTimeout(150);
  await p.click('#cf-salvar'); await p.waitForTimeout(1200);
  confere('desligar o 2FA manda nulo', (await rpcs(p, 'cofre_salvar')).pop()?.totp === null);

  /* o registro de uso */
  await ir(p, '#/servicos/cofre/uso', 1200);
  confere('o registro de uso traz quem copiou', /Bruno Tavares.*copiou a senha/.test(await texto(p, '.cof-tab tbody')));
  await p.selectOption('#cu-acao', 'gestao'); await p.waitForTimeout(150);
  const vis = await p.evaluate(() => [...document.querySelectorAll('.cof-tab tbody tr')].filter(r => !r.hidden).map(r => r.dataset.tipo));
  confere('filtrar deixa só o que foi mudado na conta', vis.length > 0 && vis.every(t => t === 'gestao'), vis);

  /* excluir */
  await ir(p, `#/servicos/cofre/editar/${C3}`, 1200);
  await p.click('button:has-text("Excluir a conta")'); await p.waitForTimeout(250);
  await p.click('#modal .btn.solid'); await p.waitForTimeout(1500);
  confere('excluir apaga a conta', JSON.stringify(await rpcs(p, 'cofre_excluir')) === JSON.stringify([{ p_id:C3 }])
    && await p.evaluate(() => location.hash) === '#/servicos/cofre/gestao' && await p.locator('.cof-tab tbody tr').count() === 3);

  /* configurações */
  await ir(p, '#/servicos/cofre/config', 1100);
  await p.fill('#cc-aviso', '0'); await p.click('.cof-cfg button:has-text("Salvar")'); await p.waitForTimeout(400);
  confere('aviso de zero dias não vale e não grava', (await escritas(p, 'cofre_config')).length === 0 && /Confira os números/.test(await toasts(p)));
  await p.fill('#cc-aviso', '10'); await p.fill('#cc-rot', '120'); await p.click('.cof-cfg button:has-text("Salvar")'); await p.waitForTimeout(600);
  const cc = await escritas(p, 'cofre_config');
  confere('os prazos gravam, e admin grava quem gere', cc.length === 1
    && JSON.stringify(cc[0].dados) === '{"rotacao_padrao_dias":120,"aviso_dias":10,"anterior_dias":30,"grupos_gestores":[6]}', cc);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= quem só usa ================= */
{
  console.log('\nQuem só usa');
  const { ctx, p, erros } = await abrir({ stub: stubLeitura, hash:'#/servicos/cofre' });
  await p.waitForTimeout(500);
  const ids = await p.evaluate(() => [...document.querySelectorAll('.cof-card')].map(c => c.id.slice(4)));
  confere('vê a que mantém e a do acesso concedido — não a de outro grupo', ids.sort().join() === [C1, C3].sort().join(), ids);
  confere('sem a navegação da gestão e sem "Nova conta"', await p.locator('#main .arq-nav').count() === 0 && await p.locator('a:has-text("Nova conta")').count() === 0);
  confere('pelo acesso concedido, usa mas não troca', /pelo acesso concedido/.test(await texto(p, `#cof-${C3} .mt`))
    && await p.locator(`#cof-${C3} button:has-text("Trocar")`).count() === 0);
  confere('o responsável troca e edita', await p.locator(`#cof-${C1} button:has-text("Trocar a senha")`).count() === 1);
  await ir(p, '#/servicos/cofre/gestao', 1000);
  confere('a gestão pelo endereço devolve à lista', await p.evaluate(() => location.hash) === '#/servicos/cofre');
  await ir(p, `#/servicos/cofre/editar/${C1}`, 1200);
  confere('o responsável edita sem os campos da gestão', await p.locator('input.cf-g').count() === 0 && await p.locator('#cf-prazo').count() === 0
    && /são da gestão do cofre/.test(await texto(p, '.cof-form')));
  await p.fill('#cf-instr', 'Entre pelo navegador do laboratório, com a VPN.'); await p.click('#cf-salvar'); await p.waitForTimeout(1300);
  const sv = (await rpcs(p, 'cofre_salvar')).pop();
  confere('e salvar não manda quem usa, quem mantém, prazo nem acesso', sv?.id === C1 && !['grupos','responsaveis','rotacao_dias','item_id','ativo'].some(k => k in sv), sv);
  confere('nenhum erro de página', erros.length === 0, erros);
  await ctx.close();
}

/* ================= celular ================= */
{
  console.log('\nCelular');
  for (const h of ['#/servicos/cofre', '#/servicos/cofre/gestao', '#/servicos/cofre/nova', `#/servicos/cofre/editar/${C1}`]){
    const { ctx, p, erros } = await abrir({ vp:{ width:390, height:844 }, hash:h });
    await p.waitForTimeout(800);
    confere(`${h.replace(C1, '<id>')}: sem rolagem horizontal`, await semRolagem(p));
    confere(`${h.replace(C1, '<id>')}: nenhum erro de página`, erros.length === 0, erros);
    await ctx.close();
  }
}

await nav.close();
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
