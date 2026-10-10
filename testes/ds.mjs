/* A cópia do design system em ds/ (gerada no brand por scripts/distribuir.mjs).
   Confere que cada arquivo está lá, com o cabeçalho de origem, e, se o
   repositório brand estiver ao lado (../../brand), que a cópia bate com ele.
   Sai 1 se algo falhar. Não precisa de servidor. */
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const raiz = new URL('../', import.meta.url);
let falhas = 0;
const confere = (nome, ok, d) => { console.log(`${ok ? '  ok ' : 'FALHA'}  ${nome}${ok || d === undefined ? '' : '  → ' + d}`); if (!ok) falhas++; };
for (const f of ['tokens.css', 'neuro.css', 'casca.css', 'casca.js', 'select.css', 'select.js', 'marca/imagotipo-branco.webp', 'VERSAO']){
  const u = new URL('ds/' + f, raiz);
  confere(`ds/${f} existe`, existsSync(u));
  if (/\.(css|js)$/.test(f) && existsSync(u)) confere(`ds/${f} veio do brand`, readFileSync(u, 'utf8').startsWith('/* NRO DS '));
}
const index = readFileSync(new URL('index.html', raiz), 'utf8');
const ordem = ['ds/tokens.css', 'ds/neuro.css', 'ds/casca.css', 'soma.css'].map(f => index.indexOf(`href="${f}"`));
confere('index.html carrega tokens, neuro, casca e só depois o soma.css', ordem.every(i => i > 0) && ordem.every((v, i) => !i || v > ordem[i - 1]), ordem.join(','));
confere('index.html não tem mais <style> de componentes', !/<style>[\s\S]{2000,}<\/style>/.test(index));
const brand = new URL('../../brand/scripts/distribuir.mjs', import.meta.url);
if (existsSync(brand)){
  try { execFileSync('node', [brand.pathname, '../membro', '--check'], { cwd: new URL('../../brand/', import.meta.url).pathname, stdio: 'pipe' });
    confere('ds/ em sincronia com o brand', true); }
  catch (e){ confere('ds/ em sincronia com o brand', false, String(e.stdout || e.stderr).trim().split('\n').slice(-1)[0]); }
} else console.log('  --   brand não está ao lado: a sincronia não foi conferida');
console.log(falhas ? `\n${falhas} falha(s).` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
