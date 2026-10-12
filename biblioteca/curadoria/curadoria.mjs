#!/usr/bin/env node
/* Curadoria da Biblioteca: monta o pedido para uma LLM, valida o que ela devolve e gera o SQL.
   Sem dependências e sem credenciais. Nada é gravado no banco por aqui: o SQL sai para uma pessoa revisar.

   Uso:
     node curadoria.mjs prompt   [--catalogo catalogo.json] [--foco "tema"] [--n 12]
     node curadoria.mjs validar  respostas.json [--catalogo catalogo.json]
     node curadoria.mjs sql      respostas.aprovados.json > novos.sql
     node curadoria.mjs catalogo-sql      (imprime o SQL que exporta o catálogo atual)
*/
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
export const TIPOS = ['software', 'extensao', 'repositorio', 'servico', 'base', 'beneficio', 'referencia'];
export const ACESSOS = ['gratis', 'freemium', 'pago', 'estudante', 'labbio'];
export const PLATAFORMAS = ['Windows', 'macOS', 'Linux', 'Web', 'VS Code', 'Chrome', 'Firefox', 'Edge', 'Safari', 'Android', 'iOS'];
export const MARCAS = ['Ainda não testada', 'Curadoria'];
const BLOQUEADOS = ['sci-hub', 'scihub', 'libgen', 'z-lib', 'zlibrary', 'annas-archive', 'crack', 'keygen', 'warez', '1337x', 'thepiratebay'];
const FOCOS = [
  'extensões do VS Code para firmware, depuração e visualização do Git',
  'extensões de navegador para citações, referências e leitura de artigos',
  'bases e ferramentas clínicas: evidência, escalas, calculadoras, diretrizes de relato',
  'análise de sinais biomédicos (EEG, EMG, ECG, IMU): bibliotecas e dados abertos',
  'gravação, depuração e simulação de microcontroladores (ESP32, STM32, ATSAM, RP2040, Arduino)',
  'benefícios e testes gratuitos para estudantes e para a UFMG',
  'imagens médicas, estatística e visualização de dados',
  'repositórios e guias de IA, agentes e segurança úteis a engenharia e saúde',
];

/* a mesma regra de recurso_url_chave do banco */
export const chave = u => String(u || '').toLowerCase().trim().replace(/^https?:\/\/(www\.)?/, '').replace(/[\/#?]+$/, '');

function args(av){
  const o = { _: [] };
  for (let i = 0; i < av.length; i++){
    if (av[i].startsWith('--')) o[av[i].slice(2)] = av[++i]; else o._.push(av[i]);
  }
  return o;
}
function semana(d = new Date()){ return Math.floor((d - new Date(d.getFullYear(), 0, 1)) / 604800000); }

/* o catálogo atual: um JSON exportado do banco, ou a própria semente */
export function lerCatalogo(arq){
  if (arq) return JSON.parse(readFileSync(arq, 'utf8'));
  const sem = join(AQUI, '..', '..', 'db', '2.19.2_recursos_semente.sql');
  if (!existsSync(sem)) return [];
  const m = readFileSync(sem, 'utf8').match(/\$semente\$([\s\S]*?)\$semente\$/);
  return m ? JSON.parse(m[1]) : [];
}

export function montarPrompt({ catalogo, foco, n = 12, data = new Date() }){
  const contexto = readFileSync(join(AQUI, 'contexto.md'), 'utf8');
  const f = foco || FOCOS[semana(data) % FOCOS.length];
  const ja = catalogo.map(x => `- ${x.nome} | ${x.url}`).join('\n');
  return `Você é curador(a) da Biblioteca de uma equipe de pesquisa. Procure na web, hoje (${data.toISOString().slice(0, 10)}), até ${n} itens NOVOS e úteis, seguindo o contexto abaixo.

FOCO DESTA RODADA: ${f}.
(Se o foco não render itens bons, complete com outros assuntos do contexto.)

${contexto}

## Já está na Biblioteca (não repita, nem com outro endereço do mesmo item)

${ja || '(vazia)'}

## Regras de saída

Responda SOMENTE com um array JSON, sem texto antes ou depois, sem cercas de código. Cada item:

{
  "nome": "nome curto, como o produto se chama",
  "url": "https://… endereço oficial e estável",
  "publicador": "quem publica (empresa, universidade, autor)",
  "tipo": "um de: ${TIPOS.join(', ')}",
  "funcao": "o que faz, em 1 ou 2 frases (até 400 caracteres)",
  "instrucoes_baixar": "passos numerados para instalar ou acessar, ou vazio",
  "instrucoes_usar": "passos numerados do primeiro uso, ou vazio",
  "tags": ["até 6 etiquetas curtas em português"],
  "plataformas": ["de: ${PLATAFORMAS.join(', ')}"],
  "acesso": ["de: ${ACESSOS.filter(a => a !== 'labbio').join(', ')}"],
  "por_que": "uma frase: por que serve à NeuroDynamics",
  "fonte": "a página onde você confirmou que o item existe"
}

Em dúvida, deixe o campo vazio. Endereço que você não abriu não entra.`;
}

export function validar(itens, catalogo){
  const vistos = new Set(catalogo.map(x => chave(x.url)));
  const aprovados = [], rejeitados = [];
  if (!Array.isArray(itens)) return { aprovados, rejeitados: [{ item: itens, motivos: ['a resposta não é um array JSON'] }] };
  for (const it of itens){
    const m = [];
    const nome = String(it?.nome || '').trim(), url = String(it?.url || '').trim(), funcao = String(it?.funcao || '').trim();
    if (!nome || nome.length > 80) m.push('nome vazio ou com mais de 80 caracteres');
    if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test(url)) m.push('o endereço precisa ser https completo');
    if (!funcao) m.push('falta dizer o que faz'); else if (funcao.length > 600) m.push('"funcao" passa de 600 caracteres');
    if (!TIPOS.includes(it?.tipo)) m.push(`tipo inválido: ${it?.tipo}`);
    if (!it?.fonte) m.push('sem "fonte": o item não foi confirmado');
    const baixo = (url + ' ' + nome).toLowerCase();
    const bloq = BLOQUEADOS.find(b => baixo.includes(b));
    if (bloq) m.push(`fonte não permitida (${bloq})`);
    const k = chave(url);
    if (k && vistos.has(k)) m.push('já está na Biblioteca (ou repetido nesta resposta)');
    const acesso = (Array.isArray(it?.acesso) ? it.acesso : []).filter(a => ACESSOS.includes(a) && a !== 'labbio');
    const plataformas = (Array.isArray(it?.plataformas) ? it.plataformas : []).filter(p => PLATAFORMAS.includes(p));
    const tags = [...new Set([...(Array.isArray(it?.tags) ? it.tags : []).map(t => String(t).trim()).filter(t => t && t.length <= 30).slice(0, 6), ...MARCAS])];
    if (m.length) { rejeitados.push({ item: it, motivos: m }); continue; }
    vistos.add(k);
    aprovados.push({
      nome, url, publicador: String(it.publicador || '').trim().slice(0, 80), tipo: it.tipo, funcao,
      instrucoes_baixar: String(it.instrucoes_baixar || '').trim().slice(0, 8000),
      instrucoes_usar: String(it.instrucoes_usar || '').trim().slice(0, 8000),
      tags, plataformas, acesso, padrao_nro: false,
      por_que: String(it.por_que || '').trim(), fonte: String(it.fonte).trim(),
    });
  }
  return { aprovados, rejeitados };
}

/* mesmo corpo da semente: idempotente por endereço, e nunca marca "NRO Standard" */
export function gerarSQL(aprovados){
  const limpos = aprovados.map(({ por_que, fonte, ...r }) => ({ ...r, padrao_nro: false }));
  return `-- Itens propostos pela curadoria. REVISE antes de rodar: cada um é "Ainda não testada".
-- Fontes:
${aprovados.map(a => `--   ${a.nome}: ${a.fonte}`).join('\n')}
do $$
declare x jsonb; v_slug text; n int; v_total int := 0;
begin
  for x in select * from jsonb_array_elements($curadoria$${JSON.stringify(limpos, null, 1)}$curadoria$::jsonb) loop
    if exists (select 1 from recursos where url_chave = public.recurso_url_chave(x->>'url')) then continue; end if;
    v_slug := public.recurso_slug(x->>'nome'); n := 1;
    while exists (select 1 from recursos where slug = v_slug) loop n := n + 1; v_slug := public.recurso_slug(x->>'nome') || '-' || n; end loop;
    insert into recursos (slug, nome, url, url_chave, publicador, tipo, funcao, instrucoes_baixar, instrucoes_usar, tags, plataformas, acesso, padrao_nro)
    values (v_slug, x->>'nome', x->>'url', public.recurso_url_chave(x->>'url'), x->>'publicador', x->>'tipo', x->>'funcao',
            x->>'instrucoes_baixar', x->>'instrucoes_usar', public.recurso_lista_limpar(x->'tags'), public.recurso_lista_limpar(x->'plataformas'),
            public.recurso_lista_limpar(x->'acesso'), false);
    v_total := v_total + 1;
  end loop;
  raise notice 'Recursos novos: %', v_total;
end $$;
`;
}

const CATALOGO_SQL = `-- Rode no SQL Editor do Supabase e salve o resultado como catalogo.json
select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'url', url) order by nome), '[]'::jsonb) from public.recursos;`;

/* a LLM às vezes cerca a resposta com texto ou \`\`\`json */
export function extrairJSON(txt){
  const t = String(txt).trim();
  try { return JSON.parse(t); } catch {}
  const i = t.indexOf('['), j = t.lastIndexOf(']');
  if (i >= 0 && j > i) return JSON.parse(t.slice(i, j + 1));
  throw new Error('não achei um array JSON na resposta');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]){
  const a = args(process.argv.slice(2)), cmd = a._[0];
  if (cmd === 'prompt'){
    console.log(montarPrompt({ catalogo: lerCatalogo(a.catalogo), foco: a.foco, n: +a.n || 12 }));
  } else if (cmd === 'validar' && a._[1]){
    const { aprovados, rejeitados } = validar(extrairJSON(readFileSync(a._[1], 'utf8')), lerCatalogo(a.catalogo));
    const base = a._[1].replace(/\.json$/, '');
    writeFileSync(base + '.aprovados.json', JSON.stringify(aprovados, null, 1));
    writeFileSync(base + '.rejeitados.json', JSON.stringify(rejeitados, null, 1));
    console.log(`${aprovados.length} aprovados, ${rejeitados.length} rejeitados.`);
    rejeitados.forEach(r => console.log(`  - ${r.item?.nome || '(sem nome)'}: ${r.motivos.join('; ')}`));
  } else if (cmd === 'sql' && a._[1]){
    process.stdout.write(gerarSQL(JSON.parse(readFileSync(a._[1], 'utf8'))));
  } else if (cmd === 'catalogo-sql'){
    console.log(CATALOGO_SQL);
  } else {
    console.error('Uso: curadoria.mjs prompt | validar <respostas.json> | sql <aprovados.json> | catalogo-sql');
    process.exit(2);
  }
}
