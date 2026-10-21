/* O carimbo dos arquivos (scripts/carimbar.mjs) precisa estar em dia: senão um
   deploy pode servir o JS novo com o CSS velho em cache. */
import { execFileSync } from 'node:child_process';
try {
  console.log(execFileSync('node', [new URL('../scripts/carimbar.mjs', import.meta.url).pathname, '--conferir'], { encoding:'utf8' }).trim());
  console.log('Tudo certo.');
} catch (e) { console.error(e.stderr || e.message); console.log('1 falha(s).'); process.exit(2); }
