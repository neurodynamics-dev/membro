import json, sys
P = json.load(open('propostas.json', encoding='utf8'))
def q(s):
    s = '' if s is None else str(s)
    assert '$q$' not in s
    return '$q$' + s + '$q$'
FORM = {'reels': 'Reels', 'carrossel': 'Carrossel', 'documento': 'Documento (PDF)'}
linhas = []
for x in P:
    peca = json.dumps(x['peca'], ensure_ascii=False, separators=(',', ':'))
    rede = x['redes'][0]
    linhas.append(f"""  ({q(x['titulo'])}, {q(x['categoria'])}, {q(x['pilar'])}, array[{q(rede)}]::text[], {q(x['formato'])},
   {q(x['legenda'])},
   {q(x['texto_alt'])},
   {q(x['notas'])},
   {q(peca)}::jsonb)""")
lista = '\n'.join(f"--   {x['id']:7} {('Instagram' if x['redes']==['instagram'] else 'LinkedIn'):9} {FORM[x['formato']]:16} {x['titulo']}" for x in P)
sql = f"""-- ============================================================
-- SOMA 2.28.0, MIGRAÇÃO, NeuroDynamics
-- AS PROPOSTAS DE PUBLICAÇÃO, NO QUADRO DO STUDIO, COM A ARTE PRONTA.
--
-- Registra 15 ideias de publicação (12 para o Instagram, 4 delas
-- Reels, e 3 documentos para o LinkedIn), escolhidas entre as de
-- prioridade A do Anexo do Plano de Publicações (Trabalho Trainee #10),
-- na ordem do calendário da Fase 1 (de 10/11/2026 a 22/12/2026):
--
{lista}
--
-- Cada uma entra como IDEIA (sem data: a data sugerida do calendário
-- está nas notas, para quem pegar a publicação marcar), com o tipo, o
-- pilar, a rede, o formato, a legenda, o texto alternativo e as notas
-- (o ID do plano, as dependências e, nos Reels, o roteiro). A arte vai
-- em "peca": abre no criador (Studio, a publicação, Arte) no modelo
-- principal, foto e faixa, com a foto do banco de imagens na capa. Nos
-- Reels, a lâmina 1 é a capa (a thumbnail) e as outras são os takes,
-- as cartelas do meio do vídeo.
--
-- Os fatos seguem o plano: antes de publicar, confira cada um na fonte
-- primária e passe pela revisão indicada nas notas.
--
-- Pré-requisito: v23 (o Studio). Idempotente: uma ideia com o mesmo
-- título que já está no quadro não entra de novo.
-- COMO USAR: cole o arquivo INTEIRO no SQL Editor e Run. Depois
-- publique o portal (o modelo principal e as cartelas novas moram no
-- criador da 2.28.0).
-- ============================================================

do $$
begin
  if to_regclass('public.studio_publicacoes') is null then
    raise exception using message = 'Falta aplicar a v23 (o Studio) antes desta migração.';
  end if;
end $$;

insert into public.studio_publicacoes
  (titulo, status, modelo, categoria, pilar, redes, formato, legenda, texto_alt, notas, peca)
select v.titulo, 'ideia', 'publicacao', v.categoria, v.pilar, v.redes, v.formato, v.legenda, v.texto_alt, v.notas, v.peca
  from (values
{(','+chr(10)).join(linhas)}
  ) as v(titulo, categoria, pilar, redes, formato, legenda, texto_alt, notas, peca)
 where not exists (select 1 from public.studio_publicacoes p where p.titulo = v.titulo);

insert into public.migracoes (id, descricao) values
  ('2.28.0_studio_ideias', '15 ideias de publicação do Plano de Publicações (12 Instagram, 4 delas Reels, e 3 LinkedIn), com a arte no modelo principal, foto e faixa, e as fotos do banco de imagens')
on conflict (id) do nothing;

-- ============================================================
-- CONFERÊNCIA
-- ------------------------------------------------------------
select codigo, titulo, formato, redes, status, jsonb_array_length(peca->'laminas') as "lâminas"
  from public.studio_publicacoes
 where notas like 'Ideia %Plano de Publicações%'
 order by numero;

-- ============================================================
-- FIM, SOMA 2.28.0
--
-- Depois de rodar, publique o portal. As 15 ideias aparecem em Studio,
-- Ideias; abra cada uma e use Arte para ver e ajustar as lâminas.
-- ============================================================
"""
open(sys.argv[1], 'w', encoding='utf8').write(sql)
print('ok', len(P))
