# Os treinamentos da equipe

Os primeiros seis treinamentos do SOMA, escritos no formato do README dos
treinamentos (o mesmo que o portal lê em *Começar de um texto* e que se baixa
em *Treinamentos › Configurações*). Foram escritos para uma equipe de
graduação em engenharia, administração e saúde: são introdutórios, e cada um
mostra por que o assunto importa, apontando onde o método que usamos é o
mesmo que a indústria usa.

| Código | Treinamento | Módulos | Carga | Vídeos |
|---|---|---|---|---|
| NRO-TRE-001 | [Introdução ao SOMA](NRO-TRE-001-introducao-ao-soma.md) | 4 | 30 min | 2 |
| NRO-TRE-002 | [Gestão de tempo e agenda](NRO-TRE-002-gestao-de-tempo-e-agenda.md) | 5 | 50 min | 4 |
| NRO-TRE-003 | [ISO 9001: documentação e o sistema de Arquivos](NRO-TRE-003-iso-9001-documentacao-e-arquivos.md) | 5 | 55 min | 3 |
| NRO-TRE-004 | [Gestão de redes sociais](NRO-TRE-004-gestao-de-redes-sociais.md) | 5 | 55 min | 3 |
| NRO-TRE-005 | [Confidencialidade da informação](NRO-TRE-005-confidencialidade-da-informacao.md) | 5 | 60 min | 2 |
| NRO-TRE-006 | [Gestão de projetos](NRO-TRE-006-gestao-de-projetos.md) | 6 | 75 min | 4 |

**A numeração.** O pedido listava a introdução como (0) e os demais de (1) a
(5). Como o código começa em `NRO-TRE-001`, a introdução é a 001 e os demais
seguem a ordem do pedido, um número acima: (1) tempo e agenda → 002, (2) ISO
9001 → 003, (3) redes sociais → 004, (4) confidencialidade → 005, (5) gestão
de projetos → 006.

## Como entram no portal

Pela migração **`db/v25_treinamentos_iniciais.sql`** (depois da 24.0): os seis
entram como **rascunho** — nada é publicado, atribuído ou avisado. Um número
que já existe no banco fica como está. A migração termina com uma tabela: uma
linha por treinamento, com os módulos, as questões, os vídeos a gravar e o
que falta confirmar.

A migração é **gerada** destes arquivos, pelo próprio leitor do portal:

```bash
node treinamentos/gerar-semente.mjs
```

Mudou um `.md`? Gere de novo. O teste `testes/treinamentos-conteudo.mjs`
falha enquanto a semente estiver atrás dos arquivos. Depois que a 25.0 roda,
porém, o que vale é o que está no portal: editar o `.md` e rodar a migração
de novo **não** muda um treinamento que já existe. Para levar a mudança,
abra o treinamento no editor e importe o texto (ou edite lá).

## Antes de publicar

1. **Os vídeos.** São 18, curtos, marcados no texto com
   `[VÍDEO A GRAVAR: NRO-TRE-00X/Vn — …]`. Os roteiros — cena, tela e narração
   — estão em [`roteiros/`](roteiros/LEIAME.md), com o passo a passo de subir
   no YouTube e trocar a marca pelo bloco de vídeo. O portal não publica
   enquanto houver marca.
2. **Um ponto a confirmar.** No NRO-TRE-002, módulo 5:
   `[CONFIRMAR: o serviço de apoio psicológico da UFMG para estudantes, e como
   se chega a ele]`. Troque pela informação certa (nome do serviço, contato,
   como agendar).
3. **Uma leitura de conferência.** Os fatos abaixo foram pesquisados, mas não
   foi possível abrir todas as páginas de origem na hora de escrever. Vale
   alguém conferir antes da primeira publicação:
   - NRO-TRE-005: a definição literal de *conhecimento sensível* e as cartilhas
     do PNPC citadas (links no próprio treinamento); o nome da CTIT como
     núcleo de inovação da UFMG;
   - NRO-TRE-003: o que o texto diz da ISO 9001:2026 (publicação, o que a
     edição reforça);
   - NRO-TRE-006: as datas e os nomes da história do Scrum e dos OKRs;
   - NRO-TRE-002: o CVV (188) e o SAMU (192) — confira se continuam assim.
4. **O revisor.** Como todo documento da equipe: quem publica não deveria ser
   quem escreveu. Peça a alguém da área de cada um que leia.

## A quem atribuir — sugestão

| Treinamento | Para quem | Como |
|---|---|---|
| NRO-TRE-001 Introdução ao SOMA | a equipe inteira | obrigatório — o primeiro de quem entra |
| NRO-TRE-002 Gestão de tempo e agenda | a equipe inteira | obrigatório |
| NRO-TRE-005 Confidencialidade da informação | a equipe inteira | obrigatório; vence em 12 meses, como a reciclagem anual de segurança das empresas |
| NRO-TRE-003 ISO 9001 e Arquivos | a equipe inteira | obrigatório — todo departamento emite arquivos |
| NRO-TRE-006 Gestão de projetos | `NRO_PROJECTS` | obrigatório; opcional para os demais |
| NRO-TRE-004 Gestão de redes sociais | os grupos de acesso e os aprovadores do Studio | obrigatório; opcional para os demais |

A ordem da tabela é a sugerida para quem entra: primeiro o portal e o tempo,
depois o sigilo, e então o jeito de documentar e de trabalhar em projeto.

## As fontes

Cada treinamento cita as suas fontes no texto ou em **Links
relacionados**. As principais:

- **Confidencialidade:** as páginas e cartilhas do Programa Nacional de
  Proteção do Conhecimento Sensível (PNPC), da ABIN — o programa, as fases,
  as boas práticas, as cartilhas de engenharia social, de segurança na
  internet e de redes sociais; a LGPD (Lei 13.709/2018); a Lei 9.279/1996
  (período de graça e concorrência desleal).
- **ISO 9001:** a ISO 9001:2026 e a ISO 13485, nas páginas da ISO.
- **Gestão de projetos:** o PMI (PMBOK), o Scrum Guide, John Doerr (OKRs),
  a ISO 13485 e a ISO 14971.
- **Tempo e agenda:** o Manifesto Ágil (ritmo sustentável), a OMS
  (burnout) e o CVV.
- **Redes sociais e Introdução:** as regras da equipe em Arquivos (NRO-MKT-001,
  NRO-MKT-002) e o próprio portal.
