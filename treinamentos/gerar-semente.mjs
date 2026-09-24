/* ============================================================
   Gera db/v25_treinamentos_iniciais.sql a partir dos .md desta
   pasta — os treinamentos no formato do README dos treinamentos.

   Quem lê o texto é o mesmo leitor do portal (treLerTexto, de
   mod-treinamentos.js): o que o banco recebe é exatamente o que a
   tela receberia se alguém colasse o arquivo em "Começar de um
   texto". Mudou um .md? Rode de novo:

     node treinamentos/gerar-semente.mjs

   O teste testes/treinamentos-conteudo.mjs confere que a semente
   gravada é a que este script gera hoje.
   ============================================================ */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');
export const SEMENTE = join(RAIZ, 'db', 'v25_treinamentos_iniciais.sql');

/* O leitor do portal, rodado fora do navegador: o módulo é um
   script clássico, e o que ele pede da casca para ler um texto é
   pouco — norm, esc, ic e um state. */
export function leitor(){
  const ctx = {
    state: {},
    norm: s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
    esc: v => v == null ? '' : String(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
    ic: () => ''
  };
  vm.createContext(ctx);
  const src = readFileSync(join(RAIZ, 'mod-treinamentos.js'), 'utf8');
  return vm.runInContext(src + '\n;({ treLerTexto, treProblemas });', ctx, { filename: 'mod-treinamentos.js' });
}

/* Os treinamentos desta pasta, em ordem de código. */
export function lerTreinamentos(){
  const { treLerTexto, treProblemas } = leitor();
  return readdirSync(AQUI).filter(f => /^NRO-TRE-\d{3}-.+\.md$/.test(f)).sort().map(arquivo => {
    const texto = readFileSync(join(AQUI, arquivo), 'utf8');
    const r = treLerTexto(texto);
    return { arquivo, texto, meta: r.meta, conteudo: r.conteudo, avisos: r.avisos, problemas: treProblemas(r.conteudo) };
  });
}

const PENDENCIA = /\[(?:V[ÍI]DEO A GRAVAR|PENDENTE|CONFIRMAR[^\]]*)[^\]]*\]/gi;
export const pendencias = t => t.conteudo.modulos.flatMap(m => String(m.corpo || '').match(PENDENCIA) || []);

const lit = s => s == null || s === '' ? 'null' : `'${String(s).replace(/'/g, "''")}'`;
const num = n => n == null || n === '' ? 'null' : String(+n);
function cifrao(tag, corpo){
  if (corpo.includes(`$${tag}$`)) throw new Error(`o conteúdo tem a marca $${tag}$`);
  return `$${tag}$${corpo}$${tag}$`;
}

export function gerarSql(ts = lerTreinamentos()){
  const ruins = ts.filter(t => t.avisos.length || !/^NRO-TRE-\d{3}$/.test(t.meta.codigo || ''));
  if (ruins.length) throw new Error('Arquivos com aviso do leitor ou sem código: ' + ruins.map(t => t.arquivo).join(', '));
  const linhas = ts.map(t => {
    const n = +t.meta.codigo.slice(-3);
    const vid = pendencias(t).filter(p => /GRAVAR/i.test(p)).length;
    const conf = pendencias(t).length - vid;
    return `-- ${t.meta.codigo} · ${t.meta.titulo} — ${t.conteudo.modulos.length} módulos` +
        `${vid ? `, ${vid} vídeo${vid > 1 ? 's' : ''} a gravar` : ''}${conf ? `, ${conf} ponto${conf > 1 ? 's' : ''} a confirmar` : ''}\n` +
      `select pg_temp.tre_semear(${n}, ${lit(t.meta.titulo)}, ${lit(t.meta.resumo)}, ${lit(t.meta.categoria)},\n` +
      `  ${num(t.meta.carga_horaria_min)}, ${num(t.meta.nota_minima)}, ${num(t.meta.validade_meses)}, ${cifrao('tre' + String(n).padStart(3, '0'),
        JSON.stringify(t.conteudo, null, 1))}::jsonb);`;
  });
  const codigos = ts.map(t => `'${t.meta.codigo}'`).join(', ');
  return `-- ============================================================
-- SOMA 25.0 — MIGRAÇÃO · NeuroDynamics
-- OS PRIMEIROS TREINAMENTOS: ${ts.length} treinamentos escritos para a equipe,
-- que entram como RASCUNHO — nada é publicado nem atribuído.
--
${ts.map(t => `--   ${t.meta.codigo}  ${t.meta.titulo}`).join('\n')}
--
-- GERADO por treinamentos/gerar-semente.mjs a partir dos .md de
-- treinamentos/ — não edite à mão: mude o .md e gere de novo.
--
-- Cada um nasce com o conteúdo inteiro no rascunho. Os vídeos ainda
-- não gravados estão marcados no texto ([VÍDEO A GRAVAR: …]), com o
-- roteiro de cada um em treinamentos/roteiros/, e o portal não
-- publica enquanto houver marca: grave, suba no YouTube, troque a
-- marca pelo bloco de vídeo no editor e publique.
--
-- Um número que já existe fica como está: se alguém já criou o
-- NRO-TRE-003, ele não é tocado, e a tabela do fim diz isso.
--
-- Pré-requisito: SOMA 24.0 aplicada.
-- Segura para rodar mais de uma vez.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run.
-- ============================================================

do $$
begin
  if to_regclass('public.treinamentos') is null or to_regclass('public.treinamento_revisoes') is null then
    raise exception using message = 'Falta aplicar a v24 antes desta migração.',
      detail = 'Os treinamentos moram nas tabelas treinamentos e treinamento_revisoes, que nascem na 24.0.';
  end if;
end $$;

create temp table if not exists tre_semente (codigo text primary key, titulo text, resultado text);

create or replace function pg_temp.tre_semear(p_numero integer, p_titulo text, p_resumo text, p_categoria text,
  p_carga integer, p_nota integer, p_validade integer, p_conteudo jsonb)
returns void language plpgsql as $f$
declare
  v_cod text := 'NRO-TRE-' || lpad(p_numero::text, 3, '0');
  t     public.treinamentos;
begin
  select * into t from public.treinamentos where numero = p_numero;
  if t.id is not null then
    insert into tre_semente values (v_cod, p_titulo,
      case when t.titulo = p_titulo then 'já existia — ficou como está'
           else 'o número já é de "' || t.titulo || '" — ficou como está' end)
    on conflict (codigo) do update set resultado = excluded.resultado;
    return;
  end if;
  insert into public.treinamentos (numero, titulo, resumo, categoria, carga_horaria_min, nota_minima, validade_meses)
  values (p_numero, p_titulo, p_resumo, p_categoria, p_carga, p_nota, p_validade)
  returning * into t;
  insert into public.treinamento_revisoes (treinamento_id, conteudo, notas)
  values (t.id, p_conteudo, 'Versão inicial, da semente 25.0.');
  insert into tre_semente values (v_cod, p_titulo, 'criado em rascunho')
  on conflict (codigo) do update set resultado = excluded.resultado;
end $f$;

${linhas.join('\n\n')}

insert into public.migracoes (id, descricao) values
  ('v25_treinamentos_iniciais', 'Os primeiros treinamentos, em rascunho: ${ts.map(t => t.meta.titulo.replace(/'/g, "''")).join(', ')}')
on conflict (id) do nothing;

-- ============================================================
-- O QUE A 25.0 DEIXOU — uma linha por treinamento
-- ------------------------------------------------------------
select s.codigo, coalesce(t.titulo, s.titulo) as titulo, s.resultado,
       t.status, jsonb_array_length(r.conteudo->'modulos') as modulos,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               jsonb_array_elements(coalesce(m->'verificacao'->'questoes', '[]'::jsonb)) q) as questoes,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               regexp_matches(m->>'corpo', '\\[V[ÍI]DEO A GRAVAR[^]]*\\]', 'g')) as videos_a_gravar,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               regexp_matches(m->>'corpo', '\\[CONFIRMAR[^]]*\\]', 'g')) as a_confirmar,
       coalesce(array_length(public.treinamento_problemas(r.conteudo), 1), 0) as problemas_de_estrutura
  from tre_semente s
  left join public.treinamentos t on t.codigo = s.codigo
  left join public.treinamento_revisoes r on r.treinamento_id = t.id and r.status = 'rascunho'
 where s.codigo in (${codigos})
 order by s.codigo;

-- ============================================================
-- FIM — SOMA 25.0
--
-- Depois de rodar:
--   1) em Treinamentos › Gestão, os ${ts.length} aparecem em rascunho;
--   2) grave os vídeos pelos roteiros (treinamentos/roteiros/) e troque
--      cada marca [VÍDEO A GRAVAR: …] pelo bloco de vídeo no editor;
--   3) resolva os [CONFIRMAR: …] — a tabela acima diz onde há;
--   4) publique e atribua — a sugestão de a quem atribuir cada um
--      está em treinamentos/LEIAME.md.
-- ============================================================
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const ts = lerTreinamentos();
  writeFileSync(SEMENTE, gerarSql(ts));
  ts.forEach(t => console.log(`${t.meta.codigo}  ${t.conteudo.modulos.length} módulos  ${pendencias(t).length} pendência(s)  ${t.meta.titulo}`));
  console.log(`\n→ ${SEMENTE.slice(RAIZ.length + 1)}`);
}
