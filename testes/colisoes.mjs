/* ============================================================
   colisoes.mjs — nomes globais repetidos entre a casca e os módulos
   Rode da raiz do repositório:  node testes/colisoes.mjs

   Os módulos são script CLÁSSICO, não módulo ES: isso é de
   propósito, porque os handlers são onclick="…" e precisam de
   escopo global. O preço é que todos dividem o mesmo escopo — e um
   `const` repetido entre a casca e um módulo derruba o módulo
   INTEIRO no carregamento ("Identifier X has already been
   declared"), sem nada aparecer na tela além de uma rota vazia.

   Já aconteceu: mod-atividades declarou STATUS_SOL, que a casca já
   tinha, e o quadro simplesmente não desenhava.

   Regra: a casca é dona dos nomes compartilhados; módulo não
   redeclara o que ela nomeia, e módulo não depende de módulo.
   ============================================================ */
import { readFileSync } from 'node:fs';

/* os arquivos do portal moram na raiz, um nível acima deste diretório */
const raiz = (nome) => new URL('../' + nome, import.meta.url);

/** Nomes declarados na coluna zero — o que de fato vira global. */
function globais(src){
  const nomes = new Set();
  let prof = 0;
  for (const linha of src.split('\n')){
    if (prof === 0){
      const m = linha.match(/^(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/);
      if (m) nomes.add(m[1]);
    }
    for (const c of linha){ if (c === '{') prof++; else if (c === '}') prof--; }
    if (prof < 0) prof = 0;
  }
  return nomes;
}

/** O <script> embutido da casca, sem os que têm src. */
function scriptDaCasca(caminho){
  const html = readFileSync(raiz(caminho), 'utf8');
  return [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
    .map(m => m[1]).join('\n;\n');
}

const MODULOS = ['mod-gestao.js','mod-atividades.js','mod-admin.js',
                 'mod-relatorios.js','mod-evento.js'];

const tabela = { 'casca (index.html)': globais(scriptDaCasca('index.html')) };
for (const m of MODULOS) tabela[m] = globais(readFileSync(raiz(m), 'utf8'));

const dono = new Map();
const choques = [];
for (const [arq, nomes] of Object.entries(tabela))
  for (const n of nomes){
    if (dono.has(n)) choques.push(`${n}  —  ${dono.get(n)}  vs  ${arq}`);
    else dono.set(n, arq);
  }

for (const [arq, nomes] of Object.entries(tabela))
  console.log(`  ${String(nomes.size).padStart(4)} nomes globais em ${arq}`);

if (choques.length){
  console.log(`\n${choques.length} COLISÃO(ÕES) — o segundo arquivo não carrega:\n`
    + choques.map(c => '  ' + c).join('\n'));
  process.exitCode = 1;
} else {
  console.log('\nNenhuma colisão de nome global.');
}
