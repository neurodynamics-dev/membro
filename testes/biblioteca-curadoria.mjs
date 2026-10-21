/* Testa o script de curadoria da Biblioteca (sem rede e sem banco). */
import { montarPrompt, validar, gerarSQL, extrairJSON, lerCatalogo, chave } from '../biblioteca/curadoria/curadoria.mjs';
let falhas = 0, n = 0;
const confere = (t, c) => { n++; if (!c) falhas++; console.log((c ? '  ok   ' : 'FALHA  ') + t); };

const cat = lerCatalogo();
confere('lê a semente como catálogo', cat.length >= 100);
const p = montarPrompt({ catalogo: cat, data: new Date('2026-03-02') });
confere('o pedido traz contexto, catálogo e esquema', p.includes('NeuroDynamics') && p.includes('PEDro') && p.includes('"por_que"') && p.includes('Sci-Hub'));
confere('o foco gira por semana', montarPrompt({ catalogo: [], data: new Date('2026-03-02') }) !== montarPrompt({ catalogo: [], data: new Date('2026-03-12') }));
confere('--foco fixa o assunto', montarPrompt({ catalogo: [], foco: 'eletromiografia' }).includes('FOCO DESTA RODADA: eletromiografia'));
confere('chave ignora www, https e barra final', chave('HTTPS://www.Exemplo.com/a/') === 'exemplo.com/a');

const bom = { nome: 'GitLens', url: 'https://gitlens.amod.io', publicador: 'GitKraken', tipo: 'extensao', funcao: 'Mostra o histórico do Git no editor.', tags: ['Git', 'VS Code'], plataformas: ['VS Code', 'Marte'], acesso: ['freemium', 'labbio'], fonte: 'https://marketplace.visualstudio.com' };
const r = validar([
  bom,
  { ...bom, nome: 'Repetido', url: 'https://gitlens.amod.io/' },
  { ...bom, nome: 'Velho', url: 'http://velho.example.com' },
  { ...bom, nome: 'Sci-Hub', url: 'https://sci-hub.example.org' },
  { ...bom, nome: 'Sem fonte', url: 'https://semfonte.example.com', fonte: '' },
  { ...bom, nome: 'Tipo ruim', url: 'https://tipo.example.com', tipo: 'magia' },
  { ...bom, nome: 'Já temos', url: cat[0].url },
], cat);
confere('aprova só o bom', r.aprovados.length === 1 && r.aprovados[0].nome === 'GitLens');
confere('rejeita com motivo: repetido, http, bloqueado, sem fonte, tipo, já existente', r.rejeitados.length === 6 && r.rejeitados.every(x => x.motivos.length >= 1));
const a = r.aprovados[0];
confere('filtra plataforma e acesso inválidos, sem "labbio"', a.plataformas.join() === 'VS Code' && a.acesso.join() === 'freemium');
confere('marca "Ainda não testada" e "Curadoria"; nunca padrão', a.tags.includes('Ainda não testada') && a.tags.includes('Curadoria') && a.padrao_nro === false);
confere('resposta que não é array vira rejeição', validar({}, cat).rejeitados.length === 1);

const sql = gerarSQL(r.aprovados);
confere('o SQL é idempotente e cita a fonte', sql.includes('url_chave') && sql.includes('gitlens.amod.io') && sql.includes('-- Fontes:') && !sql.includes('"por_que"'));
confere('o SQL nunca marca padrão', sql.includes('public.recurso_lista_limpar(x->\'acesso\'), false)'));
confere('extrai o array de uma resposta cercada', extrairJSON('Claro!\n```json\n[{"a":1}]\n```').length === 1);
console.log(falhas ? `\n${falhas} falha(s) em ${n} verificações.` : `\nTudo certo. ${n} verificações passaram.`);
process.exit(falhas ? 2 : 0);
