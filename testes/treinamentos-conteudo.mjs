/* ============================================================
   treinamentos-conteudo.mjs — os treinamentos de treinamentos/
   Rode da raiz do repositório:  node testes/treinamentos-conteudo.mjs
   (não precisa de servidor nem de npm install)

   Confere o que o leitor do portal não confere sozinho:
   - cada .md é lido sem aviso, e o código do cabeçalho é o do nome;
   - o que impede publicar é só pendência marcada (vídeo a gravar,
     ponto a confirmar) — nada de estrutura quebrada;
   - todo link arquivo: aponta para um arquivo do rol (a 21.0) e todo
     treinamento: aponta para um destes;
   - todo módulo abre com "Ao fim deste módulo, você…" (o README);
   - cada vídeo marcado tem o seu roteiro em treinamentos/roteiros/,
     e cada roteiro, o seu vídeo marcado;
   - a semente db/v25_treinamentos_iniciais.sql é a que o gerador
     produz hoje: mudou o .md, gere de novo.
   ============================================================ */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { lerTreinamentos, gerarSql, pendencias, SEMENTE } from '../treinamentos/gerar-semente.mjs';

const raiz = nome => new URL('../' + nome, import.meta.url);
let falhas = 0, oks = 0;
const confere = (txt, cond, extra = '') => {
  if (cond) oks++; else { falhas++; console.log(`  FALHOU  ${txt}${extra ? ' — ' + extra : ''}`); }
};

const ts = lerTreinamentos();
confere('há seis treinamentos', ts.length === 6, ts.map(t => t.arquivo).join(', '));

/* os códigos de Arquivos que existem: o rol que a 21.0 semeia */
const rol = new Set([...readFileSync(raiz('db/v21_rol_nro_pub_001.sql'), 'utf8')
  .matchAll(/pg_temp\.semear\('([A-Z]{3})',\s*(\d+),/g)].map(m => `NRO-${m[1]}-${m[2].padStart(3, '0')}`));
confere('o rol da 21.0 foi lido', rol.size > 40, String(rol.size));
const codigos = new Set(ts.map(t => t.meta.codigo));

for (const t of ts){
  const c = t.meta.codigo || '?';
  confere(`${t.arquivo}: o leitor não reclama`, t.avisos.length === 0, t.avisos.join(' | '));
  confere(`${t.arquivo}: o código do cabeçalho é o do nome`, t.arquivo.startsWith(c + '-'), c);
  confere(`${c}: tem título, resumo, categoria e carga horária`,
    !!(t.meta.titulo && t.meta.resumo && t.meta.categoria && t.meta.carga_horaria_min));
  const estrutura = t.problemas.filter(p => !/pendência/.test(p));
  confere(`${c}: só pendência marcada impede publicar`, estrutura.length === 0, estrutura.join(' | '));

  t.conteudo.modulos.forEach((m, i) => {
    confere(`${c} · módulo ${i + 1}: abre com "Ao fim deste módulo, você"`, /^Ao fim deste módulo, você /.test(m.corpo.trim()));
    const qs = m.verificacao?.questoes || [];
    confere(`${c} · módulo ${i + 1}: tem verificação`, qs.length >= 2, String(qs.length));
    qs.forEach(q => confere(`${c} · módulo ${i + 1} · ${q.id}: tem explicação`, !!String(q.explicacao || '').trim()));
  });

  /* links do corpo e dos relacionados */
  const alvos = [...t.texto.matchAll(/\]\(\s*(arquivo|treinamento):([^)\s]+)\s*\)/g)];
  for (const [, tipo, cod] of alvos){
    if (tipo === 'arquivo') confere(`${c}: arquivo:${cod} existe no rol`, rol.has(cod));
    else confere(`${c}: treinamento:${cod} é um destes`, codigos.has(cod) && cod !== c, cod);
  }
  confere(`${c}: nenhum emoji`, !/\p{Extended_Pictographic}/u.test(t.texto));

  /* vídeos marcados ↔ roteiros */
  const marcados = pendencias(t).map(p => (p.match(/(NRO-TRE-\d{3})\/(V\d+)/) || [])).filter(x => x.length);
  marcados.forEach(([, doc]) => confere(`${c}: a marca de vídeo cita o próprio treinamento`, doc === c, doc));
  const vids = marcados.map(x => x[2]);
  confere(`${c}: nenhum vídeo marcado duas vezes`, new Set(vids).size === vids.length, vids.join(', '));
  const rot = `treinamentos/roteiros/${c}-roteiros.md`;
  if (vids.length){
    confere(`${c}: tem arquivo de roteiros`, existsSync(raiz(rot)), rot);
    if (existsSync(raiz(rot))){
      const r = readFileSync(raiz(rot), 'utf8');
      const secoes = [...r.matchAll(/^## (V\d+) — /gm)].map(x => x[1]);
      confere(`${c}: um roteiro para cada vídeo marcado, e nada a mais`,
        secoes.join() === vids.join(), `roteiros ${secoes.join(', ')} · marcas ${vids.join(', ')}`);
      vids.forEach(v => confere(`${c}/${v}: o roteiro diz qual marca substituir`,
        r.includes(`[VÍDEO A GRAVAR: ${c}/${v} — …]`)));
    }
  }
}

const indice = readFileSync(raiz('treinamentos/roteiros/LEIAME.md'), 'utf8');
readdirSync(raiz('treinamentos/roteiros')).filter(f => f !== 'LEIAME.md').forEach(f =>
  confere(`o índice dos roteiros cita ${f}`, indice.includes(`(${f})`)));

confere('a semente v25 está em dia com os .md', readFileSync(SEMENTE, 'utf8') === gerarSql(ts),
  'rode: node treinamentos/gerar-semente.mjs');

console.log(`treinamentos-conteudo: ${oks} ok, ${falhas} falha${falhas === 1 ? '' : 's'}`);
process.exit(falhas ? 1 : 0);
