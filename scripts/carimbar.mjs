#!/usr/bin/env node
/* Carimbo dos arquivos do portal: um hash do conteúdo de todo CSS e JS servido.
   O GitHub Pages deixa os arquivos em cache por alguns minutos (e o navegador às
   vezes por mais), então um deploy podia trazer o JS novo com o CSS antigo. Com o
   carimbo na query (?v=…), qualquer mudança em qualquer arquivo muda o endereço
   de todos, e o navegador baixa tudo de novo.

   node scripts/carimbar.mjs             atualiza os .html e o CARIMBO do index.html
   node scripts/carimbar.mjs --conferir  só confere (sai com erro se estiver velho)

   Rode antes de cada commit que mexe em CSS ou JS. testes/carimbo.mjs confere. */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const FORA = /^(testes|scripts|db|biblioteca|mailer|supabase|node_modules)\//;
const arquivos = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '*.css', '*.js', '*.html'], { cwd:RAIZ, encoding:'utf8' })
  .split('\n').filter(f => f && !FORA.test(f)).sort();

/* o hash ignora os próprios carimbos, senão nunca fica estável */
const neutro = t => t.replace(/(\.(?:css|js)\?v=)[0-9a-z.\-]+/g, '$1').replace(/(const CARIMBO = ')[^']*'/, '$1\'');
const h = createHash('sha1');
for (const f of arquivos) { h.update(f + '\0'); h.update(neutro(readFileSync(join(RAIZ, f), 'utf8'))); }
const carimbo = h.digest('hex').slice(0, 10);

const conferir = process.argv.includes('--conferir');
const velhos = [];
for (const f of arquivos.filter(f => f.endsWith('.html'))) {
  const antes = readFileSync(join(RAIZ, f), 'utf8');
  const depois = antes
    .replace(/(<(?:link|script)\b[^>]*\b(?:href|src)=")(?!https?:|\/\/|data:)([^"?#]+\.(?:css|js))(?:\?v=[^"]*)?"/g, `$1$2?v=${carimbo}"`)
    .replace(/(const CARIMBO = ')[^']*'/, `$1${carimbo}'`);
  if (depois !== antes) { velhos.push(f); if (!conferir) writeFileSync(join(RAIZ, f), depois); }
}
if (conferir && velhos.length) { console.error(`Carimbo velho em: ${velhos.join(', ')}. Rode: node scripts/carimbar.mjs`); process.exit(1); }
console.log(conferir ? `Carimbo em dia (${carimbo}).` : `Carimbo ${carimbo}${velhos.length ? ': ' + velhos.join(', ') : ' (nada mudou)'}.`);
