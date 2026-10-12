/* O Supabase roda a API com a extensão safeupdate: UPDATE ou DELETE sem WHERE dentro de uma função
   (chamada pela API) volta "UPDATE requires a WHERE clause". O banco de teste não tem a extensão,
   então este teste lê as migrações da 2.18 em diante e procura o que ela recusaria.
   Blocos "do $$ ... $$" rodam uma vez só, na aplicação da migração, como administrador: não contam. */
import { readdirSync, readFileSync } from 'node:fs';
let falhas = 0, achados = 0;
const arquivos = readdirSync(new URL('../db/', import.meta.url)).filter(f => /^2\.(1[89]|[2-9]\d)\..*\.sql$/.test(f));
const semParenteses = t => { let ant; do { ant = t; t = t.replace(/\([^()]*\)/g, '()'); } while (t !== ant); return t; };
for (const f of arquivos){
  let s = readFileSync(new URL('../db/' + f, import.meta.url), 'utf8')
    .replace(/--[^\n]*/g, '')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\bdo\s+\$\$[\s\S]*?\$\$\s*;/gi, '');
  for (const m of s.matchAll(/(?<![\w])(update\s+(?:only\s+)?[\w."]+\s+(?:as\s+\w+\s+)?set\b[^;]*;|delete\s+from\s+(?:only\s+)?[\w."]+[^;]*;)/gi)){
    achados++;
    if (!/\bwhere\b/i.test(semParenteses(m[1]))){
      falhas++; console.log(`FALHA  ${f}: ${m[1].replace(/\s+/g, ' ').slice(0, 100)}`);
    }
  }
}
console.log(`${arquivos.length} migrações, ${achados} UPDATE/DELETE conferidos.`);
if (falhas){ console.log(`\n${falhas} sem WHERE.`); process.exit(1); }
console.log('\nTudo certo.');
