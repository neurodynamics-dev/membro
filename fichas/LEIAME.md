# Fichas da 2.19.1

Ordem de execução. Uma ficha por vez; cada uma parte da anterior.
Antes da primeira, leia `../GUIA-EXECUCAO.md`.

| Ficha | Quem | Situação | Contrato |
|---|---|---|---|
| R1 migração do reporte | [O] | feita (`db/2.19.1_reporte.sql`) | `CONTRATO-REPORTE.md` |
| [R2](R2.md) reporte em Serviços | [S] | feita (Astra, `7702f3c`, revisada e incorporada) | `CONTRATO-REPORTE.md` |
| [R3](R3.md) tela do reporte do líder | [S] | feita (Astra, `112db25`, revisada e incorporada) | `CONTRATO-REPORTE.md` |
| [R4](R4.md) cobrança de sexta | [S] | a fazer | `CONTRATO-REPORTE.md` |
| [R5](R5.md) painel e PDF unificado | [S] | a fazer | `CONTRATO-REPORTE.md` |
| L1 identidade dos gestores | [O] | feita (`db/2.19.1_labbio_base.sql`) | `CONTRATO-LABBIO.md` |
| [L2](L2.md) casca `/labbio`, entrada, gestores e painel no SOMA | [S] | feita ([O]; o executor pula) | `CONTRATO-LABBIO.md` |
| L5 pedido de biometria | [O] | feita (`db/2.19.1_labbio_acesso.sql`) | `CONTRATO-LABBIO.md` |
| T1 trainees | [O] | feita (`db/2.19.1_trainees.sql`) | `CONTRATO-TRAINEES.md` |
| L3 consultas e revogação pendente | [O] | feita (`db/2.19.1_labbio_dados.sql`) | `CONTRATO-LABBIO.md` |
| [L4](L4.md) telas de consulta do /labbio | [S] | a fazer (depois da L2) | `CONTRATO-LABBIO.md` |
| [L6](L6.md) pedido de biometria: membro, Pessoal e LABBIO | [S] | a fazer (depois da L4) | `CONTRATO-LABBIO.md` |
| L7 salas e L9 tablets | [O] | feitas (`db/2.19.1_labbio_salas.sql`, `db/2.19.1_labbio_tablets.sql`) | `CONTRATO-LABBIO.md` |
| [L8](L8.md) agenda do /labbio, aviso ao organizador, cadastro de tablets | [S] | a fazer (depois da L6) | `CONTRATO-LABBIO.md` |
| [L10](L10.md) tela do tablet (`sala.html`) | [S] | a fazer (depois da L8) | `CONTRATO-LABBIO.md` |
| T3 onboarding (banco) | [O] | feita (`db/2.19.1_onboarding.sql`) | `CONTRATO-TRAINEES.md` |
| [T2](T2.md) telas dos trainees | [S] | feita ([O]; o executor pula) | `CONTRATO-TRAINEES.md` |
| [T3](T3.md) tour com progresso no servidor e painel | [S] | feita ([O]; o executor pula) | `CONTRATO-TRAINEES.md` |
| F0 feed, notícias, reações e newsletter (banco) | [O] | feita (`db/2.19.1_feed.sql`) | `CONTRATO-FEED.md` |
| [F1](F1.md) portal: feed, mesa editorial, widget e newsletter | [S] | a fazer (depois da R5: mexe em `mod-reporte.js`) | `CONTRATO-FEED.md` |
| [F2](F2.md) site: notícias, matéria, inscrição (repositório **website**) | [S] | feita ([O], website `5654a9a`; o executor pula) | `CONTRATO-FEED.md` |
| [F3](F3.md) `noticia.html`: reagir fora do portal | [S] | feita ([O]; o executor pula) | `CONTRATO-FEED.md` |

Ordem sugerida para o executor: R2 → R3 → R4 → R5 → F1 → L4 → L6 → L8 → L10.
F2 e F3 já foram feitas na branch [O]; traga-as com o merge de `slp/ecstatic-noether-evq50w` antes da próxima ficha.
