-- ============================================================
-- SOMA 25.0 — MIGRAÇÃO · NeuroDynamics
-- OS PRIMEIROS TREINAMENTOS: 6 treinamentos escritos para a equipe,
-- que entram como RASCUNHO — nada é publicado nem atribuído.
--
--   NRO-TRE-001  Introdução ao SOMA
--   NRO-TRE-002  Gestão de tempo e agenda
--   NRO-TRE-003  ISO 9001: documentação e o sistema de Arquivos
--   NRO-TRE-004  Gestão de redes sociais
--   NRO-TRE-005  Confidencialidade da informação
--   NRO-TRE-006  Gestão de projetos
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

-- NRO-TRE-001 · Introdução ao SOMA — 4 módulos, 2 vídeos a gravar
select pg_temp.tre_semear(1, 'Introdução ao SOMA', 'O que é o SOMA, como o portal do membro se organiza e onde fica cada coisa — para você achar o que precisa, pedir o que falta e ser avisado do que importa.', 'Integração',
  30, null, null, $tre001${
 "modulos": [
  {
   "id": "m-o-soma-e-o-portal-do-membro",
   "titulo": "O SOMA e o portal do membro",
   "corpo": "Ao fim deste módulo, você sabe o que é o SOMA, entra no portal com a sua conta e confere se ela está pronta para o dia a dia.\n\nO **SOMA** é o sistema interno da NeuroDynamics. Ele guarda o que a equipe precisa para trabalhar: quem faz parte de qual grupo, a agenda, as atividades, os projetos, os documentos, os treinamentos. O **portal do membro** (membro.neurodynamics.dev) é onde você usa tudo isso.\n\nAté pouco tempo, eram cinco aplicativos separados, cada um com a sua tela de entrada. Agora é um só, com uma conta só. O motivo é simples: quando a mesma informação mora em dois lugares, um dos dois fica desatualizado — e ninguém sabe qual.\n\n## Entrar pela primeira vez\n\n1. Abra membro.neurodynamics.dev e escolha **Criar conta**, com o seu e-mail.\n2. Confirme o cadastro pelo link que chega no e-mail (confira o spam).\n3. Entre com o e-mail e a senha. Esqueceu a senha? Use **Esqueci minha senha** na mesma tela.\n\n[VÍDEO A GRAVAR: NRO-TRE-001/V1 — o primeiro acesso ao portal e um passeio pelo menu, do início ao sino]\n\n## A conta e o registro\n\nCriar a conta não basta: ela precisa estar **ligada ao seu registro** no quadro da equipe — o número que o Depto. de Pessoal dá a cada membro. É esse vínculo que diz ao sistema quem você é, de quais grupos faz parte e o que é seu.\n\nEnquanto o vínculo não existe, o portal mostra um aviso no alto da tela. Dá para navegar, mas não para comentar numa atividade, abrir uma solicitação ou receber uma tarefa. Quem faz o vínculo é o Depto. de Pessoal; se o aviso aparecer para você, fale com eles.\n\n> **Nota:** organizações grandes chamam este tipo de sistema de portal do colaborador ou intranet. O princípio que usamos aqui é o mesmo que elas perseguem: cada informação mora num lugar só, e todo mundo consulta a mesma fonte.",
   "links": [
    {
     "titulo": "Estatuto",
     "url": "arquivo:NRO-DIR-001",
     "descricao": "o documento fundador da NeuroDynamics."
    },
    {
     "titulo": "Equipe",
     "url": "#/equipe",
     "descricao": "o organograma, para você se situar."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você criou a sua conta, mas aparece um aviso de que ela não está ligada a um registro. O que isso impede?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Entrar no portal",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Comentar em atividades e abrir solicitações",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Ver a agenda da equipe",
        "correta": false
       }
      ],
      "explicacao": "Sem o vínculo com o registro, você navega e lê, mas o sistema não sabe quem você é no quadro — por isso não deixa comentar, pedir nem receber atividade."
     },
     {
      "id": "q2",
      "tipo": "vf",
      "enunciado": "Por que os cinco aplicativos antigos viraram um portal só?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Porque a mesma informação em dois lugares acaba desatualizada em um deles.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Porque cada setor precisa de uma conta diferente para entrar.",
        "correta": false
       }
      ],
      "explicacao": "Um sistema só, com uma conta só, faz cada informação morar num lugar — e todo mundo consultar a mesma fonte."
     }
    ]
   }
  },
  {
   "id": "m-os-espacos-do-portal",
   "titulo": "Os espaços do portal",
   "corpo": "Ao fim deste módulo, você sabe para que serve cada item do menu e vai direto ao lugar certo.\n\nO menu, à esquerda, não é organizado por departamento. É organizado pelo **que você está fazendo**: você não pensa \"preciso abrir o sistema de gestão\"; pensa \"preciso achar a ficha de alguém\" ou \"preciso marcar uma reunião\".\n\n| Espaço | Para quê |\n|---|---|\n| **Agenda** | tempo: compromissos, marcos do semestre, ausências e o check-in do LABBIO |\n| **Atividades** | trabalho: o quadro do seu grupo, com as tarefas de cada um |\n| **OKRs** | planejamento: os objetivos da equipe e o desdobramento de cada um |\n| **Projetos** | cada projeto, com a equipe, o supervisor e os arquivos que ele deve ter |\n| **Arquivos** | os documentos e registros controlados da equipe, com código e revisão |\n| **Studio** | a comunicação: criar e aprovar as publicações (para os grupos que cuidam disso) |\n| **Equipe** | as pessoas: organograma e fichas |\n| **Treinamentos** | o que os seus grupos pedem que você faça, e os seus certificados |\n| **Informações** | documentos e políticas publicados pelo Depto. de Pessoal |\n| **Serviços** | pedidos ao Depto. de Pessoal, e o andamento deles em **Meus pedidos** |\n\nQuem tem papel de gestão vê ainda **Seleção** (o processo seletivo) e **Administração** (os painéis do portal).\n\n## O início\n\nA logo, no alto do menu, leva ao **início**: o seu dia. Lá ficam o quadro de avisos, os próximos compromissos, quem está no LABBIO agora e os treinamentos obrigatórios que esperam por você. Comece o dia por ali.\n\n## Toda tela tem endereço\n\nCada tela do portal tem um endereço próprio: a ficha de uma pessoa, uma atividade, um arquivo, um módulo deste treinamento. Isso quer dizer que você pode **mandar o link** por mensagem, e quem abrir cai exatamente no mesmo lugar. Em vez de \"entra lá em Arquivos, procura o procedimento de desligamento\", mande o endereço.\n\nSe o seu papel não dá acesso a uma tela, o link leva ao início — nunca a uma tela vazia.",
   "links": [
    {
     "titulo": "Agenda",
     "url": "#/agenda",
     "descricao": "o seu tempo e o da equipe."
    },
    {
     "titulo": "Atividades",
     "url": "#/atividades",
     "descricao": "o quadro do seu grupo."
    },
    {
     "titulo": "Informações",
     "url": "#/informacoes",
     "descricao": "a biblioteca de documentos e políticas."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você quer conferir quem é o gestor de uma colega. Onde procura?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Em Informações",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Em Atividades",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Em Equipe",
        "correta": true
       }
      ],
      "explicacao": "Equipe é o espaço das pessoas: o organograma mostra a cadeia de gestão, e a ficha de cada um fica lá."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Quais destes estão no início do portal?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O quadro de avisos",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Os treinamentos obrigatórios que esperam por você",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A lista completa de arquivos da equipe",
        "correta": false
       },
       {
        "id": "d",
        "texto": "Quem está no LABBIO agora",
        "correta": true
       }
      ],
      "explicacao": "O início é o seu dia: avisos, próximos compromissos, check-in e pendências. A lista de arquivos mora em Arquivos."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Por que vale mandar o link de uma tela em vez de explicar o caminho até ela?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Porque o link dá acesso mesmo a quem não tem permissão",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Porque quem abre cai exatamente na mesma tela, sem precisar procurar",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Porque o caminho pelo menu muda de pessoa para pessoa",
        "correta": false
       }
      ],
      "explicacao": "Toda tela tem endereço. O link não fura permissão nenhuma — quem não tem acesso vai para o início —, mas poupa a procura de quem tem."
     }
    ]
   }
  },
  {
   "id": "m-achar-e-ser-avisado",
   "titulo": "Achar e ser avisado",
   "corpo": "Ao fim deste módulo, você acha qualquer coisa pela busca e escolhe como quer ser avisado.\n\n## A busca\n\nA caixa **Buscar**, no alto do menu, acha telas e ações, pessoas, atividades, compromissos e treinamentos. Para abrir sem tirar a mão do teclado, aperte `/` ou `Ctrl K` (no Mac, `⌘ K`).\n\n- digite o que quer **fazer**: \"novo compromisso\", \"solicitar acesso\", \"afastamento\";\n- digite um **nome** para achar uma pessoa, com o cargo e os grupos dela;\n- digite um **código** para ir direto ao objeto.\n\nAs ações vêm sempre primeiro: quem digita \"novo\" quer criar, não ler.\n\n## Os códigos\n\nTudo o que a equipe cita em voz alta tem um código curto. É por ele que você acha, e é ele que você manda para alguém:\n\n| Código | O que é |\n|---|---|\n| `ORT-14` | uma atividade — o prefixo é o do grupo, o número é a sequência |\n| `EVT-012` | um compromisso da agenda |\n| `NRO-PES-007` | um arquivo — o emissor, a série e, quando há, o exemplar |\n| `NRO-TRE-003` | um treinamento |\n| `POST-14` | uma publicação do Studio |\n\n\"A ORT-14 está atrasada\" é uma frase que não deixa dúvida. \"Aquela tarefa do encoder\" deixa.\n\n[VÍDEO A GRAVAR: NRO-TRE-001/V2 — a busca pelo teclado, os códigos, o sino e as preferências de e-mail]\n\n## O sino\n\nO **sino**, no pé do menu, junta os seus avisos: uma atividade sua que andou, venceu ou foi sinalizada, um arquivo esperando a sua revisão, um treinamento obrigatório que chegou. Clicar no aviso leva ao que ele fala.\n\nO sino só avisa quem está com o portal aberto. Por isso existe o e-mail — e você escolhe o ritmo em **sino › Preferências de e-mail**:\n\n- **a cada aviso** — um e-mail com o que apareceu (avisos da mesma hora chegam juntos);\n- **um resumo por dia** — no máximo um e-mail diário;\n- **só no portal** — nenhum e-mail.\n\n> **Dica:** quem entra no portal todo dia fica bem com o resumo. Quem entra uma vez por semana precisa do aviso a cada vez — senão perde prazo.\n\n## Do seu jeito\n\nO botão ao lado de **sair**, na linha da sua conta, troca o tema entre escuro e claro. **Recolher o menu**, no pé dele, deixa só os ícones e dá mais espaço para a tela. No celular, o menu vira uma gaveta, aberta pelo botão da barra de cima.",
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você quer abrir a busca sem usar o mouse. O que aperta?",
      "opcoes": [
       {
        "id": "a",
        "texto": "`/` ou `Ctrl K`",
        "correta": true
       },
       {
        "id": "b",
        "texto": "`Esc`",
        "correta": false
       },
       {
        "id": "c",
        "texto": "`Ctrl F`",
        "correta": false
       }
      ],
      "explicacao": "A barra `/` ou `Ctrl K` (`⌘ K` no Mac) abrem a busca do portal de qualquer tela. `Ctrl F` é a busca do navegador, que só procura na página aberta."
     },
     {
      "id": "q2",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Um código como `ORT-14` diz de qual grupo é a atividade.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Escolher \"só no portal\" nas preferências apaga os avisos do sino.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "O sino só avisa quem está com o portal aberto; o e-mail cobre o resto.",
        "correta": true
       }
      ],
      "explicacao": "O prefixo do código é o do grupo. \"Só no portal\" desliga o e-mail, não os avisos — eles continuam no sino."
     }
    ]
   }
  },
  {
   "id": "m-pedir-e-acompanhar",
   "titulo": "Pedir e acompanhar",
   "corpo": "Ao fim deste módulo, você sabe pedir algo ao Depto. de Pessoal, acompanhar o pedido e achar os documentos da equipe.\n\n## Serviços\n\nEm **Serviços**, cada tipo de pedido tem o seu formulário, e cada pedido ganha um **protocolo**:\n\n- **Solicitação de acesso** — a um documento, sistema ou local. Diga o porquê e por quanto tempo: é com isso que o Depto. de Pessoal decide;\n- **Afastamento temporário** — provas, intercâmbio, saúde ou outro motivo, com o período;\n- **Reunião 1:1** — uma conversa individual com o seu gestor imediato;\n- **Pedido de desligamento** — para formalizar a saída, com calma;\n- **Ouvidoria** — uma mensagem à Gestão de Pessoas **sem identificação**. O anonimato não é promessa: o envio não guarda nenhuma ligação com a sua conta;\n- **Outra solicitação** — o que não couber nas anteriores.\n\nCada pedido vira um cartão no quadro do Depto. de Pessoal, com responsável e histórico. Nada se perde num e-mail esquecido.\n\n## Meus pedidos\n\nEm **Serviços › Meus pedidos** você acompanha o que pediu: o status, a resposta e quem respondeu. Enquanto o pedido está aberto ou em análise, dá para cancelar. A ouvidoria não aparece ali — justamente por ser anônima.\n\n## Informações e Equipe\n\n**Informações** é a biblioteca: estatuto, políticas, guias e formulários, por categoria. Os arquivos abrem no Google Drive. Se o Drive negar o acesso a algum, abra uma **Solicitação de acesso** dizendo qual.\n\n**Equipe** mostra o organograma: a cadeia de gestão de cada pessoa, os colegas de equipe e quem responde a quem.\n\n> **Atenção:** pedido feito por mensagem solta no celular não tem protocolo, nem responsável, nem histórico. Pelo portal, tem os três.",
   "links": [
    {
     "titulo": "Serviços",
     "url": "#/servicos",
     "descricao": "todos os pedidos ao Depto. de Pessoal."
    },
    {
     "titulo": "Meus pedidos",
     "url": "#/servicos/pedidos",
     "descricao": "o andamento do que você pediu."
    },
    {
     "titulo": "Procedimento de admissão",
     "url": "arquivo:NRO-PES-006",
     "descricao": "como a entrada na equipe acontece."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você precisa de acesso ao Drive de um projeto. Qual é o caminho?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Mandar mensagem para alguém do projeto pedindo o link",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Abrir uma Solicitação de acesso em Serviços, com a justificativa e o tempo necessário",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Pedir pela ouvidoria",
        "correta": false
       }
      ],
      "explicacao": "A Solicitação de acesso ganha protocolo e vai para o quadro do Depto. de Pessoal, que decide e concede. A justificativa e o tempo necessário são o que permite decidir."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que você encontra em Meus pedidos?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O status e a resposta de cada solicitação",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A opção de cancelar um pedido ainda em análise",
        "correta": true
       },
       {
        "id": "c",
        "texto": "As mensagens que você mandou à ouvidoria",
        "correta": false
       }
      ],
      "explicacao": "A ouvidoria é anônima: nada do envio fica ligado à sua conta, então ela não aparece na sua lista."
     }
    ]
   }
  }
 ]
}$tre001$::jsonb);

-- NRO-TRE-002 · Gestão de tempo e agenda — 5 módulos, 4 vídeos a gravar, 1 ponto a confirmar
select pg_temp.tre_semear(2, 'Gestão de tempo e agenda', 'Como usar a agenda da equipe, marcar reuniões que valem o tempo, planejar a semana e conciliar a NeuroDynamics com a faculdade sem deixar a saúde mental para depois.', 'Sistemas',
  50, null, null, $tre002${
 "modulos": [
  {
   "id": "m-uma-agenda-so-para-a-equipe",
   "titulo": "Uma agenda só para a equipe",
   "corpo": "Ao fim deste módulo, você sabe o que aparece na agenda da equipe, marca um compromisso e responde a um convite.\n\nA **Agenda** do portal junta, numa tela só, três coisas que antes moravam em lugares diferentes: os **compromissos** (reuniões, testes, cerimônias do grupo), os **marcos** do semestre (feriados, calendário da UFMG, prazos) e as **ausências** (férias, afastamentos e os seus intervalos do dia). Quando tudo está no mesmo lugar, dá para ver um conflito antes de ele acontecer.\n\n## As cinco abas\n\n| Aba | Para quê |\n|---|---|\n| **Próximos** | o que vem pela frente para você, com os convites para responder |\n| **Mês** | a mesma agenda em grade, com a cor de cada tipo |\n| **Agendar** | o assistente que acha um horário livre para várias pessoas |\n| **Presença** | o check-in do LABBIO, quem está lá agora e o seu status do dia |\n| **Minha agenda** | a ligação com o seu Google Agenda, nos dois sentidos |\n\n## Marcar e responder\n\nPara marcar, use **Novo compromisso**: escolha o tipo, a data, o horário e quem vai. O tipo sugere uma **visibilidade**, que você pode trocar:\n\n- **equipe** — todo mundo vê (é o padrão da reunião geral);\n- **convidados** — só você, os convidados e o Depto. de Pessoal;\n- **privado** — só você e o Depto. de Pessoal.\n\nRecebeu um convite? Responda **Vou**, **Talvez** ou **Não vou** — ali mesmo, em Próximos, ou no resumo da agenda do início. Quem organiza conta com essa resposta para decidir sala, pauta e se a reunião ainda faz sentido.\n\n[VÍDEO A GRAVAR: NRO-TRE-002/V1 — marcar um compromisso, convidar pessoas e responder a um convite]\n\nNada se repete sem você pedir: o padrão é não repetir. Marcar como semanal, quinzenal ou mensal cria os encontros de verdade, cada um com os seus convidados — e dá para mudar **só um encontro** ou **a série daqui para a frente**. Quem criou um compromisso é quem o edita.",
   "links": [
    {
     "titulo": "Agenda",
     "url": "#/agenda",
     "descricao": "os seus próximos compromissos."
    },
    {
     "titulo": "Agenda do mês",
     "url": "#/agenda/mes",
     "descricao": "a grade, com os marcos do semestre."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você marca uma reunião de projeto que só interessa a quem foi convidado. Qual visibilidade escolhe?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Equipe",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Convidados",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Privado",
        "correta": false
       }
      ],
      "explicacao": "\"Convidados\" mostra o compromisso a você, a quem foi convidado e ao Depto. de Pessoal. \"Equipe\" mostraria a todos; \"privado\" esconderia até dos convidados."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que aparece na agenda da equipe?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Reuniões e cerimônias dos grupos",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Marcos do semestre, como feriados e prazos da UFMG",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Férias e afastamentos, sem o motivo",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Os e-mails que você recebeu",
        "correta": false
       }
      ],
      "explicacao": "A agenda junta compromissos, marcos e ausências. Das ausências, a equipe vê só que a pessoa está fora — nunca o motivo."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Um compromisso novo se repete toda semana, a não ser que você desmarque.",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Numa série, dá para mudar só um encontro sem mexer nos outros.",
        "correta": true
       }
      ],
      "explicacao": "O padrão é não repetir. Quando há repetição, cada encontro existe de verdade, e dá para mudar um só ou a série dali em diante."
     }
    ]
   }
  },
  {
   "id": "m-reunioes-que-valem-o-tempo",
   "titulo": "Reuniões que valem o tempo",
   "corpo": "Ao fim deste módulo, você acha um horário para várias pessoas sem trocar vinte mensagens e sai de cada reunião com uma decisão registrada.\n\nUma reunião de uma hora com seis pessoas custa seis horas da equipe. Vale a pena quando ela decide algo que não se decidiria por mensagem — e só quando todo mundo sabe o que vai decidir antes de entrar.\n\n## Achar o horário: o assistente Agendar\n\nEm **Agenda › Agendar**, escolha as pessoas (ou um grupo inteiro) e a duração. O assistente mostra, lado a lado, o livre e o ocupado de cada um e sugere os horários em que todos podem. Ele considera a agenda da equipe, as ausências, o expediente de cada pessoa e — para quem conectou — o Google Agenda.\n\n[VÍDEO A GRAVAR: NRO-TRE-002/V2 — o assistente Agendar: escolher pessoas, ler o livre e o ocupado e marcar pela sugestão]\n\n## Antes, durante e depois\n\n1. **Antes:** diga o objetivo no convite, em uma frase. \"Decidir o fornecedor do encoder\" é objetivo; \"alinhar o projeto\" não é.\n2. **Antes:** mande a pauta e o material. Quem chega sabendo o assunto decide mais rápido.\n3. **Durante:** comece e termine na hora. Guarde o fim da reunião como guarda o começo.\n4. **Depois:** registre o que se decidiu, quem faz e até quando. É para isso que existe a [ata de reunião](arquivo:NRO-PUB-003).\n\nUm compromisso marcado no portal pode ter um **dossiê**: o checklist de preparação, as presenças, a pauta, as deliberações e a ata em PDF, tudo no próprio compromisso. A reunião geral tem o seu próprio [checklist de organização](arquivo:NRO-PES-014).\n\n> **Nota:** na Amazon, as reuniões de decisão começam com a leitura, em silêncio, de um memorando escrito por quem propõe — e só depois vem a conversa. A ideia é a mesma: preparar por escrito economiza o tempo de todos na sala.",
   "links": [
    {
     "titulo": "Assistente de agendamento",
     "url": "#/agenda/agendar",
     "descricao": "ache o horário de várias pessoas de uma vez."
    },
    {
     "titulo": "Ata de reunião",
     "url": "arquivo:NRO-PUB-003",
     "descricao": "o template do registro de cada reunião."
    },
    {
     "titulo": "Checklist de organização de reunião geral",
     "url": "arquivo:NRO-PES-014",
     "descricao": "o passo a passo da reunião de toda a equipe."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você precisa reunir cinco pessoas de dois projetos esta semana. O que faz primeiro?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Pergunta no grupo da equipe qual horário é melhor para cada um",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Abre o assistente Agendar com as cinco pessoas e escolhe uma das sugestões",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Marca no horário que é bom para você e espera as respostas",
        "correta": false
       }
      ],
      "explicacao": "O assistente mostra o livre e o ocupado de todos lado a lado e sugere os horários possíveis — sem a rodada de mensagens."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Qual destes é um bom objetivo para o convite de uma reunião?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Alinhar o projeto",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Conversar sobre o protótipo",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Decidir se o teste de bancada vai para a próxima semana",
        "correta": true
       }
      ],
      "explicacao": "Um objetivo bom diz o que sai da reunião. \"Alinhar\" e \"conversar\" não dizem quando a reunião terminou."
     },
     {
      "id": "q3",
      "tipo": "multipla",
      "enunciado": "O que uma ata precisa registrar?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O que foi decidido",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Quem faz cada encaminhamento",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O prazo de cada encaminhamento",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Tudo o que cada pessoa falou, palavra por palavra",
        "correta": false
       }
      ],
      "explicacao": "A ata registra decisões, responsáveis e prazos. Transcrever a conversa inteira esconde justamente o que importa."
     }
    ]
   }
  },
  {
   "id": "m-a-sua-agenda-e-a-sua-presenca",
   "titulo": "A sua agenda e a sua presença",
   "corpo": "Ao fim deste módulo, você liga o seu Google Agenda ao portal, faz o check-in do LABBIO e avisa à equipe onde está.\n\n## O Google Agenda, nos dois sentidos\n\nEm **Agenda › Minha agenda**, a ligação funciona para os dois lados:\n\n- **do Google para o portal:** você cola o endereço secreto (`.ics`) da sua agenda pessoal, e o portal passa a saber **quando** você está ocupado — é isso que o assistente Agendar usa. O título dos seus compromissos só vem se você marcar **mostrar também o título**;\n- **do portal para o Google:** você assina o feed da NeuroDynamics e recebe a agenda da equipe no seu Google Agenda, no celular.\n\nO endereço `.ics` é uma credencial: quem o tem lê a sua agenda inteira. Por isso ele só aparece para você — nem a gestão o vê. O passo a passo está no [guia de compartilhamento de calendário](arquivo:NRO-PES-018).\n\n[VÍDEO A GRAVAR: NRO-TRE-002/V3 — conectar o Google Agenda ao portal e assinar o feed da NeuroDynamics]\n\n## Presença no LABBIO\n\nAo chegar ao LABBIO, faça o **check-in** pelo QR code da tela da entrada. Em **Agenda › Presença**, você vê quem está no laboratório agora e define o seu status do dia:\n\n- **Find me at…** — onde te encontrar (\"bancada 2\", \"sala de reuniões\");\n- **Não perturbe** — para os momentos de concentração;\n- os **intervalos**: \"estou no laboratório até as 18h\", \"saí para almoçar\".\n\nNinguém precisa perguntar no grupo se você vem hoje. E quem precisa de você sabe se é hora de chamar ou de esperar.\n\n[VÍDEO A GRAVAR: NRO-TRE-002/V4 — o check-in pelo QR da entrada e o status do dia em Presença]\n\n## Ausências\n\nFérias e afastamentos entram na agenda como ausência. Para a equipe, aparece só que você está fora — nunca o motivo. Um afastamento temporário (provas, intercâmbio, saúde) se pede em **Serviços › Afastamento temporário**.",
   "links": [
    {
     "titulo": "Minha agenda",
     "url": "#/agenda/minha",
     "descricao": "o Google Agenda nos dois sentidos."
    },
    {
     "titulo": "Presença",
     "url": "#/agenda/presenca",
     "descricao": "o check-in e o seu status do dia."
    },
    {
     "titulo": "Guia de compartilhamento de calendário",
     "url": "arquivo:NRO-PES-018",
     "descricao": "o passo a passo da ligação com o Google."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Por que o endereço `.ics` da sua agenda só aparece para você?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Porque o Google não deixa outras pessoas verem",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Porque é uma credencial: quem tem o endereço lê a agenda inteira",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Porque o portal só guarda o endereço por um dia",
        "correta": false
       }
      ],
      "explicacao": "O `.ics` é uma chave de leitura da sua agenda. Por isso o portal o guarda de um jeito que nem a gestão o vê."
     },
     {
      "id": "q2",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Ligar o Google Agenda faz o assistente Agendar saber quando você está ocupado.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "O título dos seus compromissos pessoais sempre aparece para a equipe.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Assinar o feed da NeuroDynamics leva a agenda da equipe para o seu celular.",
        "correta": true
       }
      ],
      "explicacao": "O portal só guarda o início e o fim dos seus compromissos — o título, só se você marcar a opção. O feed leva a agenda da equipe para o seu Google Agenda."
     }
    ]
   }
  },
  {
   "id": "m-planejar-a-semana",
   "titulo": "Planejar a semana",
   "corpo": "Ao fim deste módulo, você escolhe o que fazer primeiro, reserva tempo para o que importa e estima o próprio trabalho sem se enganar.\n\nTempo não se \"acha\": se reserva. Quem só reage ao que chega passa a semana apagando incêndio e chega à sexta sem ter avançado no que era importante.\n\n## Urgente não é o mesmo que importante\n\nA **matriz de Eisenhower**, popularizada por Stephen Covey em *Os 7 hábitos das pessoas altamente eficazes*, separa as tarefas em quatro quadrantes:\n\n| | Urgente | Não urgente |\n|---|---|---|\n| **Importante** | faça agora (o prazo de amanhã) | **planeje** (estudar, projetar, escrever o relatório) |\n| **Não importante** | delegue ou resolva rápido | corte |\n\nO quadrante que decide a sua semana é o **importante e não urgente**: é onde mora o trabalho que evita as urgências de amanhã. Se ele não entra na agenda, nunca acontece.\n\n## Blocos de tempo\n\nPegue as tarefas importantes e **reserve um horário na agenda para cada uma**, como se fosse uma reunião com você mesmo. É o *time blocking*, usado por quem precisa de concentração — engenheiros, pesquisadores, escritores. Durante o bloco, use o **Não perturbe** e feche o que distrai.\n\nPara blocos longos, a **técnica Pomodoro**, criada por Francesco Cirillo, ajuda: 25 minutos de foco total, 5 de pausa; depois de quatro ciclos, uma pausa maior. O cronômetro tira a decisão de \"quando parar\" da sua cabeça.\n\n> **Dica:** trocar de tarefa custa caro. Cada interrupção leva um tempo de volta ao raciocínio. Junte as mensagens e os e-mails num horário, em vez de responder a cada um na hora.\n\n## Estimar com honestidade\n\nQuase todo mundo erra a estimativa para menos — o viés tem nome, **falácia do planejamento**, descrito por Daniel Kahneman e Amos Tversky. Duas defesas:\n\n1. estime com base no que tarefas parecidas **levaram de verdade**, não no que você acha que levaria;\n2. deixe folga. Uma semana planejada a 100% quebra no primeiro imprevisto.\n\nNo quadro de **Atividades**, cada cartão tem prazo e estimativa, e a **Carga da equipe** mostra quanto cada pessoa está carregando. Use as duas coisas antes de aceitar mais uma tarefa.",
   "links": [
    {
     "titulo": "Atividades",
     "url": "#/atividades",
     "descricao": "o quadro do seu grupo, com prazo e estimativa em cada cartão."
    },
    {
     "titulo": "Carga da equipe",
     "url": "#/atividades/carga",
     "descricao": "quanto cada pessoa está carregando."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Estudar para a prova do mês que vem e escrever a especificação do projeto caem em qual quadrante?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Urgente e importante",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Importante e não urgente",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Urgente e não importante",
        "correta": false
       }
      ],
      "explicacao": "São importantes e ainda não têm prazo em cima. É o quadrante que precisa entrar na agenda, senão vira urgência depois."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "O que é o *time blocking*?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Bloquear a agenda inteira para ninguém marcar reunião",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Reservar na agenda um horário para cada tarefa importante",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Trabalhar sem pausa até terminar a tarefa",
        "correta": false
       }
      ],
      "explicacao": "É tratar o trabalho importante como compromisso: com dia e hora marcados na agenda."
     },
     {
      "id": "q3",
      "tipo": "multipla",
      "enunciado": "Quais atitudes protegem a sua estimativa da falácia do planejamento?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Estimar pelo tempo que tarefas parecidas levaram de verdade",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Deixar folga na semana para imprevistos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Planejar a semana com todas as horas ocupadas",
        "correta": false
       }
      ],
      "explicacao": "O viés puxa a estimativa para baixo. A história real das tarefas corrige o número, e a folga absorve o que ninguém previu."
     }
    ]
   }
  },
  {
   "id": "m-tempo-atividades-e-bem-estar",
   "titulo": "Tempo, atividades e bem-estar",
   "corpo": "Ao fim deste módulo, você reconhece os sinais de sobrecarga, sabe quais ferramentas do portal ajudam a proteger o seu tempo e a quem recorrer quando a conta não fecha.\n\nVocê é estudante antes de tudo. A NeuroDynamics disputa as mesmas 24 horas com as aulas, as provas, o estágio, a família e o descanso. Um projeto bom não se faz com uma equipe esgotada — e quem está esgotado erra mais, aprende menos e desiste antes.\n\n## Ritmo sustentável\n\nO Manifesto Ágil, que orienta o jeito de trabalhar de equipes de software no mundo inteiro, tem um princípio que vale para qualquer área: o ritmo deve ser **sustentável** — um ritmo que dê para manter indefinidamente, não só até a próxima entrega.\n\nNa prática:\n\n- **dormir faz parte do plano.** Noite mal dormida vira dia de trabalho ruim, e isso não se compensa com café;\n- **as pausas contam como trabalho.** A pausa do Pomodoro e o almoço fora da bancada são o que mantém a cabeça funcionando à tarde;\n- **o semestre tem picos.** Semana de prova não é semana de assumir tarefa nova. Olhe o calendário da UFMG na agenda e planeje com ele;\n- **negocie cedo.** Um prazo que não vai caber se renegocia quando você percebe — não na véspera.\n\n## Os sinais de sobrecarga\n\nA Organização Mundial da Saúde descreve o **burnout** como um fenômeno ligado ao trabalho, resultado do estresse crônico que não foi bem administrado, com três marcas: **exaustão**, **distanciamento** do trabalho (ou negativismo com ele) e **queda na eficácia**. Não é preciso chegar lá para parar e ajustar a rota. Fique atento se:\n\n- o cansaço não passa com o fim de semana;\n- tarefas que você gostava viraram peso;\n- você adia tudo e se culpa por adiar;\n- o sono, a alimentação ou as notas começaram a cair.\n\n## O que o portal oferece\n\n| Situação | Ferramenta |\n|---|---|\n| preciso de concentração | o status **Não perturbe**, em Presença |\n| os e-mails de aviso me interrompem | **Preferências de e-mail**, no sino: um resumo por dia |\n| vem semana de provas, intercâmbio ou um problema de saúde | **Serviços › Afastamento temporário** |\n| preciso conversar sobre a minha carga | **Serviços › Reunião 1:1** com o seu gestor |\n| algo no ambiente da equipe está me fazendo mal | **Serviços › Ouvidoria**, anônima |\n\nPedir um afastamento ou uma conversa não é sinal de fraqueza: é informação que a equipe precisa para planejar. A equipe também tem uma [política de coparticipação em atividades da vida acadêmica](arquivo:NRO-PES-012) — vale conhecer.\n\n> **Importante:** se você estiver em sofrimento, não espere. O CVV (Centro de Valorização da Vida) atende de graça, 24 horas, pelo telefone 188 e pelo site cvv.org.br. Em emergência, ligue 192 (SAMU).\n\n[CONFIRMAR: o serviço de apoio psicológico da UFMG para estudantes, e como se chega a ele]",
   "links": [
    {
     "titulo": "Afastamento temporário",
     "url": "#/servicos/afastamento",
     "descricao": "para provas, intercâmbio, saúde ou outro motivo."
    },
    {
     "titulo": "Reunião 1:1",
     "url": "#/servicos/reuniao_1_1",
     "descricao": "uma conversa individual com o seu gestor."
    },
    {
     "titulo": "Ouvidoria",
     "url": "#/servicos/ouvidoria",
     "descricao": "a mensagem anônima à Gestão de Pessoas."
    },
    {
     "titulo": "CVV — Centro de Valorização da Vida",
     "url": "https://cvv.org.br",
     "descricao": "apoio emocional gratuito, 24 horas, pelo 188."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você percebe que a entrega da semana que vem não cabe junto com as provas. Quando e como age?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Na véspera, avisando que não deu",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Agora: fala com quem espera a entrega para renegociar o prazo e, se preciso, pede afastamento temporário para as provas",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Não diz nada e vira as noites para dar conta das duas coisas",
        "correta": false
       }
      ],
      "explicacao": "Prazo se renegocia quando o problema aparece — dá tempo de replanejar. Virar noites troca o problema de hoje por um maior amanhã."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Quais são as três marcas do burnout segundo a OMS?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Exaustão",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Distanciamento ou negativismo em relação ao trabalho",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Queda na eficácia",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Excesso de reuniões",
        "correta": false
       }
      ],
      "explicacao": "A OMS descreve o burnout por exaustão, distanciamento do trabalho e queda na eficácia, como resultado do estresse crônico não administrado."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Pausas atrasam o trabalho e devem ser cortadas em semana cheia.",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Pedir uma reunião 1:1 para falar da própria carga é informação útil para a equipe planejar.",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A mensagem pela ouvidoria não fica ligada à sua conta.",
        "correta": true
       }
      ],
      "explicacao": "As pausas sustentam a concentração. Falar da carga ajuda a equipe a redistribuir o trabalho, e a ouvidoria é anônima por construção."
     }
    ]
   }
  }
 ]
}$tre002$::jsonb);

-- NRO-TRE-003 · ISO 9001: documentação e o sistema de Arquivos — 5 módulos, 3 vídeos a gravar
select pg_temp.tre_semear(3, 'ISO 9001: documentação e o sistema de Arquivos', 'Por que a indústria documenta do jeito que documenta, a diferença entre documento e registro, e como achar, criar e revisar os arquivos da equipe no SOMA.', 'Projetos',
  55, null, null, $tre003${
 "modulos": [
  {
   "id": "m-por-que-documentar",
   "titulo": "Por que documentar",
   "corpo": "Ao fim deste módulo, você sabe o que é a ISO 9001, por que ela importa para uma equipe que desenvolve tecnologia para a saúde e o que o sistema de Arquivos tem a ver com ela.\n\nQualidade, para a indústria, não é \"fazer bem feito uma vez\". É **conseguir repetir** o que deu certo — e provar que repetiu. Uma bancada de testes montada do mesmo jeito todas as vezes, um procedimento que qualquer membro novo consegue seguir, um teste que qualquer pessoa consegue refazer e chegar ao mesmo resultado. Nada disso acontece se o jeito de fazer mora só na cabeça de quem fez.\n\n## A ISO 9001\n\nA **ISO 9001** é a norma internacional de sistemas de gestão da qualidade, publicada pela ISO (a Organização Internacional de Normalização). É a norma de gestão mais usada do mundo: mais de um milhão de organizações seguem os requisitos dela — de montadoras e fabricantes de aviões a hospitais, universidades e empresas de software. A edição mais recente, a **ISO 9001:2026**, saiu em setembro de 2026.\n\nUm dos requisitos centrais é o controle da **informação documentada** (a cláusula 7.5): todo documento que o trabalho usa precisa ser identificado, revisado e aprovado antes de valer, estar disponível para quem precisa, protegido contra alteração indevida e ter as suas versões controladas.\n\nA edição de 2026 reforça dois pontos que valem para nós: a **cultura da qualidade** — as pessoas, em todos os níveis, vivendo esses cuidados no dia a dia — e **reter e compartilhar o conhecimento** da organização.\n\n## Por que isso importa aqui\n\nA NeuroDynamics é formada por estudantes, e estudante se forma. Todo semestre, alguém sai levando o que sabia e alguém chega sem saber nada. O documento é o que fica: é como o conhecimento de uma geração da equipe chega à seguinte.\n\nE há um segundo motivo. Quem desenvolve dispositivos médicos segue a **ISO 13485**, a norma de qualidade do setor, construída sobre a mesma base da ISO 9001 — e ainda mais exigente com a documentação. As boas práticas de fabricação que a ANVISA cobra dos fabricantes vão na mesma direção, e desde fevereiro de 2026 a FDA, nos Estados Unidos, adota a ISO 13485 como base da sua própria regra de qualidade para dispositivos.\n\n> **Nota:** o que você aprende aqui não é burocracia de laboratório. É o mesmo controle de documentos que uma Medtronic, uma Siemens Healthineers ou uma Embraer praticam — só que numa escala que cabe na equipe.",
   "links": [
    {
     "titulo": "ISO 9001:2026",
     "url": "https://www.iso.org/standard/88464.html",
     "descricao": "a página da norma, na ISO."
    },
    {
     "titulo": "ISO 13485:2016",
     "url": "https://www.iso.org/standard/59752.html",
     "descricao": "a norma de qualidade para dispositivos médicos."
    },
    {
     "titulo": "Controle de documentos e registros",
     "url": "arquivo:NRO-PUB-001",
     "descricao": "a lista de todos os arquivos da equipe."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Para a indústria, o que é qualidade?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Fazer um trabalho excelente uma vez",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Conseguir repetir o que deu certo e provar que repetiu",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Ter o maior número possível de documentos",
        "correta": false
       }
      ],
      "explicacao": "Qualidade é repetibilidade com evidência. Documento em excesso não é qualidade; o documento certo, controlado, é."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Por que a documentação importa ainda mais numa equipe de estudantes?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Porque as pessoas se formam e saem, e o documento é o que fica",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Porque dispositivos médicos seguem normas ainda mais exigentes com documentação, como a ISO 13485",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Porque estudantes erram mais que profissionais",
        "correta": false
       }
      ],
      "explicacao": "A rotatividade faz o conhecimento se perder se não estiver escrito, e o setor de saúde exige que o desenvolvimento seja documentado e rastreável."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "A ISO 9001 pede que um documento seja revisado e aprovado antes de valer.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A ISO 9001 vale só para fábricas.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "A ISO 13485, de dispositivos médicos, é construída sobre a mesma base da ISO 9001.",
        "correta": true
       }
      ],
      "explicacao": "A ISO 9001 é usada por organizações de todo tipo — da indústria a hospitais e universidades. A ISO 13485 parte da mesma estrutura e acrescenta o que o setor de saúde exige."
     }
    ]
   }
  },
  {
   "id": "m-documento-e-registro",
   "titulo": "Documento e registro",
   "corpo": "Ao fim deste módulo, você distingue um documento de um registro e sabe o que cada um pode e não pode mudar.\n\nA ISO 9001 separa a informação documentada em duas espécies, e o sistema de Arquivos segue a mesma separação.\n\n| | Documento | Registro |\n|---|---|---|\n| **O que é** | diz **como fazer** | prova **o que foi feito** |\n| **Exemplos** | política, procedimento, manual, template | ata, relatório de teste, formulário preenchido |\n| **Muda?** | sim, por revisão: Rev. A, B, C… | não, depois de aprovado |\n| **Na norma** | informação documentada que deve estar disponível | informação documentada disponível como evidência |\n\nUm procedimento melhora com o tempo — por isso revisa. Uma ata de reunião de março registra o que se decidiu em março, e mudar isso seria reescrever a história. Por isso **registro não muda**: um erro num registro se corrige com **outro registro**, que diz o que estava errado.\n\n## As três estruturas de uma série\n\nNo SOMA, cada espécie de arquivo é uma **série**, e toda série tem uma de três estruturas:\n\n| Estrutura | O que é | Exemplo |\n|---|---|---|\n| **Documento único** | um documento para toda a equipe, sem template e sem exemplares | a [política de acesso ao LABBIO](arquivo:NRO-PES-015) |\n| **Template → documentos** | um template, e cada exemplar é um documento que revisa por conta própria | o [termo de abertura de projeto](arquivo:NRO-PRO-001): um por projeto |\n| **Template → registros** | um template, e cada exemplar é um registro que não muda depois de aprovado | a [ata de reunião](arquivo:NRO-PUB-003): uma por reunião |\n\nO **template** é o modelo de onde os exemplares nascem, e ele também revisa. Quando o template da ata muda, as atas antigas continuam como foram feitas — cada uma diz qual revisão do template usou.\n\n> **Dica:** na dúvida entre documento e registro, pergunte: \"isto descreve como fazer, ou prova que foi feito?\". A resposta decide.",
   "links": [
    {
     "titulo": "Template de documentos e registros",
     "url": "arquivo:NRO-PUB-002",
     "descricao": "o modelo de base de todos os arquivos da equipe."
    },
    {
     "titulo": "Relatório de execução de testes",
     "url": "arquivo:NRO-PRO-003",
     "descricao": "um exemplo de template de registros."
    },
    {
     "titulo": "Templates",
     "url": "#/arquivos/templates",
     "descricao": "todos os templates, e onde cada um é usado."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "O relatório de um teste de bancada feito ontem é documento ou registro?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Documento, porque foi escrito num arquivo de texto",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Registro, porque prova o que foi feito",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Depende de quem escreveu",
        "correta": false
       }
      ],
      "explicacao": "Registro é evidência do que aconteceu. O formato do arquivo não muda o que ele é."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Você achou um erro de digitação numa ata aprovada no mês passado. O que faz?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Envia uma revisão B da ata com a correção",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Apaga a ata e cria outra do zero",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Registra a correção num novo registro, que diz o que estava errado",
        "correta": true
       }
      ],
      "explicacao": "Registro aprovado não recebe revisão. A correção vira outro registro, e a ata original continua mostrando o que foi aprovado na época."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "O template de uma série também tem revisões.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Quando o template muda, os exemplares antigos são atualizados sozinhos.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Cada exemplar diz qual revisão do template usou.",
        "correta": true
       }
      ],
      "explicacao": "O template revisa, mas o que já nasceu dele fica como foi feito — e registra de qual revisão do template veio."
     }
    ]
   }
  },
  {
   "id": "m-o-codigo-e-a-revisao",
   "titulo": "O código e a revisão",
   "corpo": "Ao fim deste módulo, você lê o código de um arquivo, sabe em que situação ele está e acha o que precisa em Arquivos.\n\n## O código\n\nTodo arquivo da equipe tem um código no formato `NRO-XXX-YYY-Z`:\n\n| Parte | O que é | Exemplo |\n|---|---|---|\n| `XXX` | o **emissor**: o departamento que emite | `PES` (Pessoal), `PRO` (Pesquisa e Desenvolvimento), `CLI` (Clínico), `REL` (Relações Institucionais), `DIR` (Diretoria), `MKT` (Marketing), `PUB` (o que é de todos) |\n| `YYY` | o **número de série**: a espécie de arquivo | `007`, o procedimento de desligamento |\n| `Z` | o **exemplar**, quando a série tem mais de um | `3`, o termo de abertura de um projeto |\n\nA **revisão** não entra no código — ela aparece ao lado: `NRO-PES-007 Rev. B`. É de propósito: o procedimento de desligamento continua sendo `NRO-PES-007` na Rev. A e na Rev. F, e é esse endereço que os outros arquivos, os links e os treinamentos citam.\n\n## A situação de um arquivo\n\n- **rascunho** — ainda não tem revisão aprovada;\n- **em revisão** — há uma versão nova esperando aprovação (a anterior continua valendo);\n- **ativo** — em vigor;\n- **obsoleto** — substituído ou fora de uso. Não se usa.\n\n## A lista mestra\n\nA norma pede que se saiba, a qualquer momento, quais documentos existem e qual revisão de cada um está em vigor. É a **lista mestra**. Na equipe, ela era a planilha [NRO-PUB-001](arquivo:NRO-PUB-001) — e virou a primeira tela de **Arquivos**: todos os arquivos, com código, título, revisão, status e quem mexeu por último, com filtro por emissor.\n\nA tela de cada arquivo responde, no alto, **o que é este arquivo**: template ou arquivo real, se tem exemplares, se pode ser alterado. Mais abaixo, de qual template e revisão ele nasceu, as **relações** com outros arquivos e o **registro de alterações** — quem criou, quem enviou e quem aprovou cada revisão.\n\n[VÍDEO A GRAVAR: NRO-TRE-003/V1 — achar um arquivo em Arquivos e ler a tela dele: código, revisão, status e o registro de alterações]",
   "links": [
    {
     "titulo": "Arquivos",
     "url": "#/arquivos",
     "descricao": "a lista de todos os arquivos da equipe."
    },
    {
     "titulo": "Visão geral",
     "url": "#/arquivos/visao",
     "descricao": "os números de cada emissor."
    },
    {
     "titulo": "Procedimento de desligamento",
     "url": "arquivo:NRO-PES-007",
     "descricao": "um arquivo para abrir e explorar."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "No código `NRO-PRO-001-3`, o que significa o `3`?",
      "opcoes": [
       {
        "id": "a",
        "texto": "A terceira revisão do arquivo",
        "correta": false
       },
       {
        "id": "b",
        "texto": "O terceiro exemplar da série, como o termo de abertura de um projeto",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O terceiro departamento da equipe",
        "correta": false
       }
      ],
      "explicacao": "O último número é o exemplar. A revisão fica fora do código, ao lado dele: `Rev. C`."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Por que a revisão não faz parte do código?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Porque o sistema não aceita letras no código",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Para que o arquivo continue com o mesmo endereço em qualquer revisão, e as citações não quebrem",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Porque a revisão só importa para o PMO",
        "correta": false
       }
      ],
      "explicacao": "O código identifica o arquivo; a revisão identifica a versão. Separar os dois mantém os links e as referências valendo."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Um arquivo está \"em revisão\". Qual versão vale enquanto isso?",
      "opcoes": [
       {
        "id": "a",
        "texto": "A última revisão aprovada",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A versão nova, que está esperando aprovação",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Nenhuma, até a aprovação sair",
        "correta": false
       }
      ],
      "explicacao": "Nenhuma versão vale antes de ser aprovada. Enquanto a nova espera, a equipe continua usando a anterior."
     }
    ]
   }
  },
  {
   "id": "m-criar-e-revisar",
   "titulo": "Criar e revisar",
   "corpo": "Ao fim deste módulo, você cria um arquivo a partir de um template, envia uma revisão e sabe como a aprovação funciona.\n\n## Criar\n\nEm **Arquivos**, **Adicionar** pergunta o que você quer antes de criar:\n\n- **um exemplar de uma série que já existe** — por exemplo, a ata da reunião de hoje. Ele nasce do template, e a tela diz antes se vai ser documento ou registro;\n- **uma série nova** — uma espécie de arquivo que a equipe ainda não tem. Isso é com o PMO, que escolhe a estrutura, a classe e o grupo que revisa.\n\nRevisão nova de um arquivo que já existe **não é adicionar**: é **Submeter nova revisão**, na tela dele. Mesmo código, letra seguinte.\n\n## Enviar uma revisão\n\n1. Abra o arquivo e escolha **Submeter nova revisão** (na primeira vez, **Enviar a primeira versão**).\n2. Suba o arquivo novo.\n3. Diga **o que mudou**, em uma ou duas frases. \"Os prazos da etapa 3 passaram a contar em dias úteis\" ajuda quem revisa; \"atualização\" não.\n4. Confira os **pais e os filhos** do arquivo: se o procedimento muda, o checklist que depende dele precisa mudar também? Para cada um, diga se **revisou junto** ou se **não precisa mudar**. O envio não sai sem essa conferência.\n\n[VÍDEO A GRAVAR: NRO-TRE-003/V2 — criar um exemplar a partir do template e enviar uma revisão, com o que mudou e a conferência das relações]\n\n## A aprovação: quatro olhos\n\nA revisão enviada fica **pendente**, e o grupo revisor da série é avisado no sino e por e-mail. Ela só passa a valer quando **alguém do grupo revisor que não a enviou** aprova. É o **princípio dos quatro olhos**, usado em bancos, na aviação e na indústria de saúde: quem faz não é quem confere, porque o autor lê o que quis escrever, não o que escreveu.\n\n- quem revisa **aprova** ou **devolve**, com o parecer;\n- revisão devolvida **não gasta letra**: a próxima tentativa continua sendo a mesma revisão;\n- o que você tem para revisar aparece em **Arquivos › Para revisar**.\n\n[VÍDEO A GRAVAR: NRO-TRE-003/V3 — revisar uma versão: ler o que mudou, comparar e aprovar ou devolver com parecer]\n\n> **Atenção:** registro aprovado não recebe revisão. Se algo num registro está errado, a correção é outro registro.",
   "links": [
    {
     "titulo": "Para revisar",
     "url": "#/arquivos/revisoes",
     "descricao": "as versões que esperam a sua revisão."
    },
    {
     "titulo": "Checklist de organização de reunião geral",
     "url": "arquivo:NRO-PES-014",
     "descricao": "um documento para ver as relações de perto."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "O procedimento de admissão mudou. O que você faz no sistema?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Adicionar, criando um arquivo novo com o texto atualizado",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Submeter nova revisão, na tela do próprio procedimento",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Substituir o arquivo no Drive e avisar no grupo",
        "correta": false
       }
      ],
      "explicacao": "Mudança num documento que existe é revisão: mesmo código, letra seguinte, e a versão só vale depois de aprovada."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Quem pode aprovar a revisão que você enviou?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Você mesmo, se estiver no grupo revisor",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Outra pessoa do grupo revisor da série",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Qualquer membro da equipe",
        "correta": false
       }
      ],
      "explicacao": "O princípio dos quatro olhos: quem enviou não aprova. A aprovação é de alguém do grupo revisor (ou do PMO, quando a série não tem grupo revisor)."
     },
     {
      "id": "q3",
      "tipo": "multipla",
      "enunciado": "O que acompanha uma revisão enviada?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O que mudou, dito por quem enviou",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A conferência dos pais e dos filhos do arquivo",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A aprovação automática depois de sete dias",
        "correta": false
       }
      ],
      "explicacao": "Quem envia explica a mudança e confere o impacto nos arquivos relacionados. A aprovação nunca é automática."
     }
    ]
   }
  },
  {
   "id": "m-boas-praticas-de-documentacao",
   "titulo": "Boas práticas de documentação",
   "corpo": "Ao fim deste módulo, você escreve e guarda documentos e registros do jeito que uma auditoria esperaria encontrar.\n\n## Registro que se sustenta: ALCOA\n\nA indústria farmacêutica e a de dispositivos médicos resumem o que um bom registro precisa ter em cinco letras. A FDA usa a sigla **ALCOA** para definir integridade de dados:\n\n| Letra | Quer dizer | Na prática |\n|---|---|---|\n| **A** — atribuível | dá para saber quem fez | o registro diz o autor, e o sistema guarda quem enviou e quem aprovou |\n| **L** — legível | qualquer pessoa consegue ler | sem abreviação que só você entende |\n| **C** — contemporâneo | registrado quando aconteceu | o relatório do teste se escreve no dia do teste, não uma semana depois |\n| **O** — original | é o registro de verdade, ou uma cópia fiel | o que vale é o que está no sistema |\n| **A** — exato | está correto e completo | o dado que falhou também entra |\n\n## Hábitos que evitam problema\n\n- **Um arquivo, um lugar.** O arquivo que vale é o que está em Arquivos. `relatorio_final_v3_agora_vai.docx` no grupo de mensagens não é versão de nada.\n- **Baixou, consultou.** Uma cópia baixada ou impressa não é controlada: amanhã pode estar desatualizada. Antes de seguir um procedimento, confira a revisão em vigor.\n- **Obsoleto não se usa.** Se o arquivo está obsoleto, procure o que o substituiu.\n- **Use o template.** Ele garante o cabeçalho, o código e os campos que todo arquivo da equipe precisa ter.\n- **Registre o que deu errado.** Um teste que falhou é informação valiosa. Esconder a falha é o erro mais caro que um registro pode ter.\n- **Respeite a classe.** Cada série é pública, controlada ou confidencial, e isso decide quem lê o conteúdo. O treinamento de confidencialidade trata disso em detalhe.\n\n> **Nota:** auditorias de qualidade costumam começar pedindo um registro qualquer e seguindo o fio: quem fez, com qual procedimento, em qual revisão, quem aprovou. Com o sistema de Arquivos, esse fio está na tela de cada arquivo.",
   "links": [
    {
     "titulo": "Template de documentos e registros",
     "url": "arquivo:NRO-PUB-002",
     "descricao": "o ponto de partida de todo arquivo."
    },
    {
     "titulo": "Confidencialidade da informação",
     "url": "treinamento:NRO-TRE-005",
     "descricao": "as classes e o cuidado com o que é sigiloso."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você terminou um teste de bancada numa terça. Quando escreve o relatório?",
      "opcoes": [
       {
        "id": "a",
        "texto": "No mesmo dia, com os dados ainda à mão",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Na semana seguinte, junto com os outros testes",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Só se o teste tiver dado certo",
        "correta": false
       }
      ],
      "explicacao": "Registro contemporâneo: escrito quando aconteceu, com tudo o que aconteceu — inclusive a falha."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Quais destes hábitos seguem as boas práticas?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Conferir a revisão em vigor antes de seguir um procedimento baixado há meses",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Registrar o resultado de um teste que falhou",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Guardar a versão mais recente no grupo de mensagens do projeto",
        "correta": false
       },
       {
        "id": "d",
        "texto": "Criar o arquivo a partir do template da série",
        "correta": true
       }
      ],
      "explicacao": "O arquivo que vale é o do sistema, e a falha registrada é informação. Mensagem solta não é controle de versão."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "\"Atribuível\" quer dizer que dá para saber quem fez o registro.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Uma cópia impressa de um procedimento continua valendo mesmo depois de uma nova revisão.",
        "correta": false
       }
      ],
      "explicacao": "A cópia impressa não acompanha as revisões. O que vale é a revisão em vigor, no sistema."
     }
    ]
   }
  }
 ]
}$tre003$::jsonb);

-- NRO-TRE-004 · Gestão de redes sociais — 5 módulos, 3 vídeos a gravar
select pg_temp.tre_semear(4, 'Gestão de redes sociais', 'Como a equipe planeja, cria, aprova e publica o que vai para as redes no Studio, e as boas práticas de conteúdo, acessibilidade e engajamento que sustentam uma presença digital séria.', 'Comunicação',
  55, null, null, $tre004${
 "modulos": [
  {
   "id": "m-comunicacao-e-trabalho-da-equipe",
   "titulo": "Comunicação é trabalho da equipe",
   "corpo": "Ao fim deste módulo, você sabe por que a NeuroDynamics publica, o que pode e o que não pode ir para as redes e onde estão as regras.\n\nPara uma iniciativa sem fins lucrativos de pesquisa e desenvolvimento, as redes sociais não são vitrine: são **ferramenta de trabalho**. É por elas que:\n\n- os estudantes da UFMG descobrem a equipe e se inscrevem no processo seletivo;\n- parceiros, apoiadores e a imprensa acompanham o que fazemos;\n- prestamos contas do que o apoio recebido virou;\n- a pesquisa chega a quem ela pode ajudar — pacientes, profissionais de saúde, outras equipes.\n\nPor isso, publicar não é decisão de uma pessoa só. Cada publicação passa por um fluxo: alguém tem a ideia, alguém produz, alguém que não produziu aprova, e só então ela sai. É o mesmo fluxo editorial de uma redação de jornal ou do time de conteúdo de uma grande marca — planejar, produzir, revisar, publicar, medir.\n\n## As regras\n\n- A [política de redes sociais](arquivo:NRO-MKT-001) diz como a equipe se apresenta nas redes.\n- As [informações públicas de projetos](arquivo:NRO-MKT-002) dizem o que de cada projeto já pode ser divulgado. O que não está lá **não se publica** sem consultar a liderança do projeto.\n- O visual segue a marca: as cores, as fontes e as logos estão no [brand da NeuroDynamics](https://brand.neurodynamics.dev).\n\n> **Atenção:** o que um projeto ainda não tornou público pode ser segredo de desenvolvimento, pode depender de patente ou envolver dados de pacientes. Na dúvida, não publique — pergunte.",
   "links": [
    {
     "titulo": "Política de redes sociais",
     "url": "arquivo:NRO-MKT-001",
     "descricao": "como a equipe se apresenta nas redes."
    },
    {
     "titulo": "Informações públicas de projetos",
     "url": "arquivo:NRO-MKT-002",
     "descricao": "o que de cada projeto pode ser divulgado."
    },
    {
     "titulo": "Brand guidelines",
     "url": "https://brand.neurodynamics.dev",
     "descricao": "a identidade visual da NeuroDynamics."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você quer publicar uma foto do protótipo novo de um projeto. O que confere antes?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Se a foto está bonita o bastante",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Se aquela informação do projeto já é pública, nas informações públicas de projetos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Se o post vai sair no horário de maior alcance",
        "correta": false
       }
      ],
      "explicacao": "O que um projeto ainda não tornou público não se publica sem consultar a liderança dele — pode ser segredo de desenvolvimento ou depender de patente."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Para que servem as redes sociais da equipe?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Atrair estudantes para o processo seletivo",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Prestar contas a parceiros e apoiadores",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Levar a pesquisa a quem ela pode ajudar",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Mostrar a opinião pessoal de cada membro",
        "correta": false
       }
      ],
      "explicacao": "As redes da equipe falam pela NeuroDynamics. Opinião pessoal vai para o perfil pessoal."
     }
    ]
   }
  },
  {
   "id": "m-o-studio-da-ideia-a-publicacao",
   "titulo": "O Studio: da ideia à publicação",
   "corpo": "Ao fim deste módulo, você acompanha uma publicação pelo quadro do Studio, do rascunho até o ar.\n\nO **Studio** é o espaço da comunicação no portal. Entra quem está num dos grupos de acesso ou dos grupos aprovadores, escolhidos em *Studio › Configurações*.\n\n## O quadro\n\nCada publicação tem um código (`POST-14`) e anda por cinco colunas:\n\n| Coluna | O que é |\n|---|---|\n| **Ideias** | um esboço sem data — às vezes só uma frase e o tipo de publicação |\n| **Em produção** | a arte e a legenda sendo feitas |\n| **Em aprovação** | esperando o grupo aprovador |\n| **Pronta para publicar** | aprovada: é só publicar na data |\n| **Publicada** | no ar, com o link |\n\nArrastar o cartão muda a coluna — menos para **Pronta para publicar**. Lá só se chega pela **aprovação de alguém do grupo aprovador que não mandou a publicação para aprovação**. É o mesmo princípio dos quatro olhos do controle de arquivos: quem fez não é quem confere.\n\nE a aprovação vale para uma **versão**: se alguém mexe na arte ou na legenda de uma publicação aprovada, ela volta para aprovação. O que foi aprovado era a versão anterior.\n\n## O calendário e as ideias\n\n- Em **Calendário**, o mês inteiro, com a cor do status de cada publicação. Arrastar muda a data; o que ainda não tem data fica ao lado.\n- Em **Ideias**, a captura rápida: guarde a ideia na hora, nem que seja uma frase. Ideia não guardada é ideia perdida.\n- Na **véspera** da data, quem responde pela publicação recebe um lembrete no sino e por e-mail.\n\nA página de cada publicação reúne a arte para baixar, o plano, a aprovação, o histórico e o passo a passo de cada rede — como convidar um colaborador no Instagram, onde vai o link no LinkedIn.\n\n[VÍDEO A GRAVAR: NRO-TRE-004/V1 — o quadro do Studio, o calendário e as ideias: uma publicação da ideia ao ar]",
   "links": [
    {
     "titulo": "Studio",
     "url": "#/studio",
     "descricao": "o quadro das publicações."
    },
    {
     "titulo": "Calendário de publicações",
     "url": "#/studio/calendario",
     "descricao": "o que sai em cada dia."
    },
    {
     "titulo": "Ideias",
     "url": "#/studio/ideias",
     "descricao": "guarde uma ideia em segundos."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você terminou a arte de um post e quer que ele saia na quinta. Qual é o próximo passo?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Arrastar o cartão para Pronta para publicar",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Mandar para aprovação",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Publicar e depois pedir aprovação",
        "correta": false
       }
      ],
      "explicacao": "Pronta para publicar só se alcança pela aprovação de outra pessoa do grupo aprovador. Arrastar para lá é recusado."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Uma publicação aprovada teve a legenda corrigida. O que acontece?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Nada: a aprovação continua valendo",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Ela volta para aprovação, porque a versão aprovada era a anterior",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Ela vai direto para publicada",
        "correta": false
       }
      ],
      "explicacao": "A aprovação vale para uma versão. Mudar a arte ou a legenda cria outra versão, que precisa ser aprovada de novo."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Quem mandou a publicação para aprovação não pode aprová-la.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Uma ideia só pode entrar no quadro se já tiver data.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Na véspera da data, quem responde pela publicação recebe um lembrete.",
        "correta": true
       }
      ],
      "explicacao": "Ideias entram sem data. A aprovação é sempre de outra pessoa, e o lembrete da véspera sai no sino e por e-mail."
     }
    ]
   }
  },
  {
   "id": "m-criar-uma-peca-no-criador",
   "titulo": "Criar uma peça no criador",
   "corpo": "Ao fim deste módulo, você cria uma peça no tamanho certo para cada rede, a partir de um modelo, e a salva no quadro com o plano completo.\n\n## Modelos e tamanhos\n\nEm **Studio › Criar publicação**, comece por um dos **modelos** — na mídia, projeto em foco, aniversário, boas-vindas, conquista, evento, aviso, carrossel educativo, vaga, artigo publicado, enquete, thumbnail de vídeo e outros. O modelo já vem com a estrutura, o estilo e uma sugestão de legenda.\n\nCada rede tem o seu formato, e a arte é desenhada no **tamanho exato** de cada um:\n\n| Tamanho | Onde |\n|---|---|\n| Feed 4:5 (1080 × 1350) | Instagram, LinkedIn e Facebook |\n| Stories e Reels 9:16 (1080 × 1920) | Stories, capa de Reels, Shorts e TikTok |\n| Documento 4:5, em PDF | o carrossel do LinkedIn |\n| Paisagem 1,91:1 (1200 × 628) | LinkedIn e X, imagem larga |\n| Thumbnail 16:9 (1280 × 720) | YouTube |\n\nNos stories e reels, o criador marca a faixa que a interface da rede cobre: o texto fica fora dela.\n\n## A peça\n\n- Uma peça tem uma ou mais **lâminas** — o carrossel. Dá para acrescentar, duplicar e reordenar sem perder o texto.\n- O **estilo** é da peça inteira: o tema da paleta da marca, a cor de acento, a decoração, a logo (e a do LABBIO, ao lado da nossa).\n- Para destacar uma palavra, escreva-a entre asteriscos: `*palavra*`.\n- **Fotos:** envie a sua, busque no Unsplash (o crédito entra sozinho), use a foto de alguém da equipe ou cole um link.\n\n[VÍDEO A GRAVAR: NRO-TRE-004/V2 — criar uma peça no criador: escolher o modelo e o tamanho, escrever, trocar o estilo, pôr a foto e baixar]\n\n## Salvar no quadro\n\n**Salvar no quadro** pede o **plano** da publicação: quando, onde, formato, pilar, quem responde, a legenda, o primeiro comentário, o **texto alternativo** da imagem, as contas para convidar como colaboração e as notas para quem vai publicar. As artes sobem em alta resolução, e a peça inteira vai junto — para reabrir e editar depois.\n\n[VÍDEO A GRAVAR: NRO-TRE-004/V3 — salvar a peça no quadro com o plano, mandar para aprovação e aprovar pelo grupo aprovador]\n\n> **Dica:** baixe na resolução **Alta** (1440 px de largura) para o Instagram. É o máximo que ele guarda, e publicar no tamanho certo evita a segunda compressão, que é a que borra o texto.",
   "links": [
    {
     "titulo": "Criar publicação",
     "url": "#/studio/criar",
     "descricao": "o criador de peças."
    },
    {
     "titulo": "Modelos",
     "url": "#/studio/modelos",
     "descricao": "a galeria dos modelos, com prévia."
    },
    {
     "titulo": "Briefing de campanha",
     "url": "arquivo:NRO-MKT-004",
     "descricao": "o template para planejar uma campanha."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Você vai fazer um carrossel para o LinkedIn. Qual tamanho escolhe?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Stories 9:16",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Documento 4:5, que sai em PDF",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Thumbnail 16:9",
        "correta": false
       }
      ],
      "explicacao": "O carrossel do LinkedIn é publicado como documento em PDF. O criador tem o tamanho próprio para isso."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que entra no plano ao salvar a peça no quadro?",
      "opcoes": [
       {
        "id": "a",
        "texto": "A legenda e o primeiro comentário",
        "correta": true
       },
       {
        "id": "b",
        "texto": "O texto alternativo da imagem",
        "correta": true
       },
       {
        "id": "c",
        "texto": "As notas para quem vai publicar",
        "correta": true
       },
       {
        "id": "d",
        "texto": "A senha da conta da rede",
        "correta": false
       }
      ],
      "explicacao": "O plano diz tudo o que quem publica precisa saber. Senha de conta não entra em lugar nenhum do portal."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Como você destaca uma palavra no texto de uma lâmina?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Escrevendo a palavra entre asteriscos",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Escrevendo a palavra em caixa alta",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Trocando a fonte só daquela palavra",
        "correta": false
       }
      ],
      "explicacao": "`*palavra*` pinta a palavra com a cor de acento do estilo, ou a marca, ou a sublinha — conforme o destaque escolhido."
     }
    ]
   }
  },
  {
   "id": "m-conteudo-que-vale-a-pena",
   "titulo": "Conteúdo que vale a pena",
   "corpo": "Ao fim deste módulo, você planeja um conteúdo com propósito, escreve para ser lido e publica de um jeito que todo mundo consegue acessar.\n\n## Os pilares\n\nToda publicação responde a uma pergunta: **por que publicar isto?** O Studio classifica cada uma num **pilar**:\n\n| Pilar | Para quê | Exemplos |\n|---|---|---|\n| **Educar** | ensinar algo | como funciona uma órtese, o que a pesquisa descobriu |\n| **Inspirar** | mover | histórias, depoimentos, datas que importam |\n| **Conectar** | aproximar as pessoas | aniversários, boas-vindas, bastidores, parceiros |\n| **Entreter** | o lado leve | enquetes, perguntas, desafios |\n| **Institucional** | mostrar quem somos | na mídia, conquistas, artigos, avisos |\n| **Convidar** | pedir uma ação | eventos, vagas, inscrições |\n\nUm perfil que só faz institucional vira mural de avisos; um que só entretém não diz a que veio. O calendário equilibra os pilares ao longo do mês. Marcas grandes trabalham assim — com pilares definidos e calendário editorial — porque **constância vale mais que volume**: três publicações boas por semana, toda semana, rendem mais que dez numa semana e nenhuma no mês seguinte.\n\n## Escrever para as redes\n\n- **A primeira linha decide.** Nas redes, a pessoa decide em um segundo se para. A primeira linha da legenda — e os primeiros segundos de um vídeo — precisam dizer por que vale a pena continuar.\n- **Uma mensagem por publicação.** Se precisa de \"e também\", talvez sejam duas publicações.\n- **Termine com a ação.** \"Inscreva-se pelo link na bio\", \"salve para consultar depois\", \"conta pra gente nos comentários\".\n- **Traduza a ciência.** Quem lê não é da área. Explique o que o dispositivo faz pela pessoa antes de dizer como ele funciona. Engenharia, administração e saúde falam línguas diferentes — a legenda precisa falar a de quem lê.\n\n## Acessibilidade\n\n- **Texto alternativo em toda imagem.** Quem usa leitor de tela depende dele. Descreva o que a imagem mostra, em uma ou duas frases.\n- **Legenda em todo vídeo.** Muita gente assiste sem som.\n- **Texto importante na legenda, não só na arte.** Texto dentro da imagem não é lido por leitores de tela.\n- **Contraste.** Os temas do criador já vêm dentro da paleta da marca, com contraste para ler.",
   "links": [
    {
     "titulo": "Modelos",
     "url": "#/studio/modelos",
     "descricao": "os pontos de partida para cada pilar."
    },
    {
     "titulo": "Ideias",
     "url": "#/studio/ideias",
     "descricao": "o banco de ideias, com sugestões por pilar."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Um post sobre como funciona o encoder de uma órtese cai em qual pilar?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Educar",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Conectar",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Convidar",
        "correta": false
       }
      ],
      "explicacao": "Ensinar como algo funciona é o pilar educar. Conectar é sobre pessoas; convidar pede uma ação."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que torna uma publicação acessível?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Texto alternativo que descreve a imagem",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Legenda nos vídeos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A informação importante escrita também na legenda, não só na arte",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Usar o maior número possível de hashtags",
        "correta": false
       }
      ],
      "explicacao": "Leitores de tela leem o texto alternativo e a legenda, não o que está desenhado na imagem. Hashtag não tem nada a ver com acessibilidade."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Publicar com constância rende mais que publicar muito de uma vez e depois sumir.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A primeira linha da legenda serve para as hashtags.",
        "correta": false
       }
      ],
      "explicacao": "A constância constrói o hábito de quem acompanha. A primeira linha é o gancho: ela decide se a pessoa continua lendo."
     }
    ]
   }
  },
  {
   "id": "m-engajamento-e-cuidados",
   "titulo": "Engajamento e cuidados",
   "corpo": "Ao fim deste módulo, você lê os números de uma publicação, responde a quem interage e sabe o que nunca publicar.\n\n## Os números\n\n| Métrica | O que mede |\n|---|---|\n| **Alcance** | quantas contas diferentes viram a publicação |\n| **Impressões** | quantas vezes ela apareceu, contando repetições |\n| **Engajamento** | curtidas, comentários, compartilhamentos e salvamentos |\n| **Salvamentos e compartilhamentos** | quem guardou para depois ou mandou para alguém |\n\nCurtida é barata. **Salvar** e **compartilhar** mostram que o conteúdo teve valor de verdade — são os sinais que mais contam. Compare cada publicação com as do mesmo pilar, não com a média de tudo.\n\n## Interagir\n\n- **Responda os comentários**, e no primeiro dia. Conversa gera conversa.\n- **Convide para colaboração** (collab) o parceiro, o laboratório, a pessoa homenageada: a publicação aparece para o público dos dois perfis.\n- **Nunca compre seguidores nem curtidas.** Número falso não se inscreve no processo seletivo, não vira parceiro e ainda derruba o alcance do que é real.\n- **Errou, corrija com transparência.** Um erro corrigido às claras gera confiança; um post apagado sem explicação gera desconfiança.\n\n## O que nunca publicar\n\n- **Pessoas sem autorização.** O uso da imagem de alguém depende de consentimento. Para foto em que a pessoa aparece em destaque, tenha a autorização por escrito.\n- **Pacientes e dados de saúde.** Dado de saúde é **dado pessoal sensível** pela Lei Geral de Proteção de Dados. Rosto, nome, prontuário, exame, o monitor com o sinal de alguém: nada disso sai sem consentimento expresso e sem passar pela liderança do projeto.\n- **O que o projeto não tornou público.** A tela do computador ao fundo, o quadro branco com o esquema, a placa de circuito de perto. Olhe o fundo da foto antes de postar.\n- **Localização em tempo real** do laboratório ou de viagens da equipe.\n\n> **Importante:** estudantes de saúde conhecem o sigilo profissional; engenheiros e administradores, nem sempre. Nas redes, a regra vale para todos: se envolve paciente, não se publica sem consentimento.",
   "links": [
    {
     "titulo": "Política de redes sociais",
     "url": "arquivo:NRO-MKT-001",
     "descricao": "as regras da equipe."
    },
    {
     "titulo": "Confidencialidade da informação",
     "url": "treinamento:NRO-TRE-005",
     "descricao": "o que é sensível e por quê."
    },
    {
     "titulo": "Lei Geral de Proteção de Dados",
     "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
     "descricao": "a Lei nº 13.709/2018, no Planalto."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual destes sinais mostra melhor que um carrossel educativo teve valor?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O número de curtidas",
        "correta": false
       },
       {
        "id": "b",
        "texto": "O número de salvamentos e de compartilhamentos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O número de hashtags usadas",
        "correta": false
       }
      ],
      "explicacao": "Salvar e compartilhar exigem mais de quem interage: mostram que o conteúdo foi útil a ponto de ser guardado ou passado adiante."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que não se publica sem consentimento?",
      "opcoes": [
       {
        "id": "a",
        "texto": "A foto de um voluntário durante um teste",
        "correta": true
       },
       {
        "id": "b",
        "texto": "O monitor com o sinal de um paciente",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A logo da UFMG num evento da universidade",
        "correta": false
       },
       {
        "id": "d",
        "texto": "A imagem de uma pessoa em destaque que não autorizou",
        "correta": true
       }
      ],
      "explicacao": "Imagem de pessoas depende de autorização, e dado de saúde é dado pessoal sensível pela LGPD — com cuidado redobrado."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Comprar seguidores ajuda a equipe a atrair candidatos para o processo seletivo.",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Convidar um parceiro como colaboração leva a publicação ao público dos dois perfis.",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Antes de postar, vale olhar o fundo da foto.",
        "correta": true
       }
      ],
      "explicacao": "Seguidor comprado não é gente interessada e derruba o alcance real. A colaboração soma públicos, e o fundo da foto pode mostrar o que não é público."
     }
    ]
   }
  }
 ]
}$tre004$::jsonb);

-- NRO-TRE-005 · Confidencialidade da informação — 5 módulos, 2 vídeos a gravar
select pg_temp.tre_semear(5, 'Confidencialidade da informação', 'O que é conhecimento sensível, por que uma equipe de estudantes tem o que proteger, como o SOMA classifica a informação e como se defender de engenharia social, de descuidos nas redes e de vazamento de dados pessoais. Com base no Programa Nacional de Proteção do Conhecimento Sensível, da ABIN.', 'Segurança',
  60, 80, 12, $tre005${
 "modulos": [
  {
   "id": "m-o-que-nos-temos-a-proteger",
   "titulo": "O que nós temos a proteger",
   "corpo": "Ao fim deste módulo, você reconhece o conhecimento sensível da NeuroDynamics e entende por que protegê-lo é parte do trabalho.\n\nA Agência Brasileira de Inteligência (ABIN) mantém, desde 1997, o **Programa Nacional de Proteção do Conhecimento Sensível (PNPC)**. É uma consultoria que a agência leva a instituições que detêm conhecimento estratégico — centros de pesquisa, universidades, empresas de tecnologia — para protegê-lo contra espionagem, sabotagem e vazamento. Boa parte deste treinamento vem das cartilhas do PNPC.\n\nO PNPC trabalha com um conceito: **conhecimento sensível** é *\"todo conhecimento, sigiloso ou estratégico, cujo acesso não autorizado pode comprometer a consecução dos objetivos nacionais e resultar em prejuízos ao País, necessitando de medidas especiais de proteção\"*.\n\nTroque \"País\" por \"equipe\" e a definição serve para nós. Uma equipe de estudantes tem, sim, o que proteger:\n\n- **o que os projetos ainda não tornaram público** — o projeto de um dispositivo, um algoritmo, um resultado de teste;\n- **o que pode virar patente** — e deixa de poder se for divulgado antes da hora;\n- **o que os parceiros nos confiaram** — o LABBIO, a Visuri e outros abrem as portas sob termo de sigilo;\n- **os dados de pessoas** — voluntários de testes, pacientes, os próprios membros.\n\n## Confidencialidade, integridade, disponibilidade\n\nA segurança da informação protege três coisas, a tríade que a ISO/IEC 27001 — a norma internacional de segurança da informação, adotada por bancos, hospitais e empresas de tecnologia no mundo todo — usa como base:\n\n| | Quer dizer | Quando falha |\n|---|---|---|\n| **Confidencialidade** | só lê quem pode | o projeto aparece num post antes da hora |\n| **Integridade** | a informação é a certa, sem alteração indevida | alguém edita a planilha de resultados sem registro |\n| **Disponibilidade** | quem pode, consegue ler quando precisa | o único arquivo estava no computador de quem saiu |\n\nEste treinamento trata sobretudo da primeira. O [treinamento de documentação](treinamento:NRO-TRE-003) cuida das outras duas.\n\n> **Importante:** na maior parte das vezes, o vazamento não vem de um espião. Vem de um descuido: um link aberto para qualquer pessoa, uma foto com a tela ao fundo, uma conversa no ônibus. Por isso a proteção é trabalho de cada um — e o PNPC começa sempre pela sensibilização das pessoas.",
   "links": [
    {
     "titulo": "O que é o PNPC",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/o-que-e-1",
     "descricao": "o programa da ABIN, com os objetivos."
    },
    {
     "titulo": "As fases do PNPC",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/fases-do-pnpc",
     "descricao": "sensibilização, avaliação de riscos e acompanhamento."
    },
    {
     "titulo": "Boas práticas do PNPC",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boas-praticas-1",
     "descricao": "as cartilhas de proteção, para ler inteiras."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "O que é conhecimento sensível, na definição do PNPC?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Qualquer informação pessoal de um membro",
        "correta": false
       },
       {
        "id": "b",
        "texto": "O conhecimento, sigiloso ou estratégico, cujo acesso não autorizado pode causar prejuízo e que precisa de medidas especiais de proteção",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Só os documentos que o governo classifica como secretos",
        "correta": false
       }
      ],
      "explicacao": "A definição não se limita a documentos do governo: o que conta é o prejuízo que o acesso indevido pode causar."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "O que a NeuroDynamics tem a proteger?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O que os projetos ainda não tornaram público",
        "correta": true
       },
       {
        "id": "b",
        "texto": "O que os parceiros nos confiaram sob termo de sigilo",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Os dados de voluntários, pacientes e membros",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Nada: somos uma equipe de estudantes",
        "correta": false
       }
      ],
      "explicacao": "Projeto não divulgado, informação de parceiro e dado pessoal são conhecimento sensível — numa equipe de estudantes ou numa multinacional."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "A maior parte dos vazamentos vem de descuidos, não de espionagem.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Segurança da informação é assunto só de quem cuida da TI.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Integridade quer dizer que a informação é a certa, sem alteração indevida.",
        "correta": true
       }
      ],
      "explicacao": "Por isso o PNPC começa pela sensibilização das pessoas: cada membro é parte da proteção."
     }
    ]
   }
  },
  {
   "id": "m-quem-le-o-que",
   "titulo": "Quem lê o quê",
   "corpo": "Ao fim deste módulo, você sabe como o SOMA classifica a informação, como pedir um acesso e e por que o seu termo de sigilo continua valendo depois.\n\n## A necessidade de conhecer\n\nÓrgãos de inteligência, bancos e hospitais trabalham com um princípio: **cada pessoa tem acesso ao que precisa para o seu trabalho — e só a isso**. É a *necessidade de conhecer*. Não é desconfiança: é que cada acesso a mais é uma porta a mais para vazar, e ninguém consegue proteger o que nem sabe que tem.\n\nA ISO/IEC 27001 pede que a informação seja **classificada**, para que todo mundo saiba o cuidado que cada uma exige. No SOMA, cada série de arquivos tem uma classe:\n\n| Classe | Quem lê o conteúdo |\n|---|---|\n| **Público** | toda a equipe |\n| **Controlado** | quem está no grupo do emissor, na equipe do projeto, no grupo revisor ou num grupo de leitura |\n| **Confidencial** | só os grupos de leitura e o grupo revisor |\n\nOs **metadados** — o código, o título, a revisão, o status — ficam à vista de toda a equipe, mesmo num arquivo confidencial. Abra o [quadro de pessoal](arquivo:NRO-PES-005): você vê que ele existe e qual é a revisão vigente, mas não o conteúdo. Saber que um documento existe é o que permite pedir acesso a ele quando for preciso.\n\n> **Atenção:** \"público\" no SOMA quer dizer **público para a equipe**, não para a internet. O que pode sair da equipe está nas [informações públicas de projetos](arquivo:NRO-MKT-002).\n\n## Pedir um acesso\n\nPrecisa ler um arquivo, entrar numa pasta do Drive ou num repositório? Abra uma **Solicitação de acesso** em *Serviços*. Diga **por que** e **por quanto tempo**: é com isso que o Depto. de Pessoal decide. Cada acesso concedido fica registrado na sua ficha. E quando alguém sai da equipe, o portal aponta os acessos que continuam ativos, para que sejam revogados — acesso esquecido é porta aberta.\n\n[VÍDEO A GRAVAR: NRO-TRE-005/V1 — ver a classe de um arquivo em Arquivos, entender por que o conteúdo não abre e pedir o acesso por uma Solicitação de acesso]\n\n## O termo de sigilo\n\nO termo de sigilo da NeuroDynamics — e o de cada parceiro com quem você trabalha, como o LABBIO e a Visuri — fica registrado na sua ficha, junto com os acessos. Para trabalhar no LABBIO, o termo é enviado pelo [formulário do termo de sigilo](arquivo:NRO-PES-016). Se você ainda não assinou o da NeuroDynamics, fale com o Depto. de Pessoal.\n\nO dever de sigilo **não acaba quando você sai**. A própria Lei de Propriedade Industrial (Lei 9.279/1996, art. 195, XI) trata como concorrência desleal divulgar a informação confidencial a que se teve acesso por contrato, mesmo depois do fim dele.",
   "links": [
    {
     "titulo": "Solicitação de acesso",
     "url": "#/servicos/acesso",
     "descricao": "para pedir acesso a um documento, sistema ou local."
    },
    {
     "titulo": "Formulário do termo de sigilo do LABBIO",
     "url": "arquivo:NRO-PES-016",
     "descricao": "o envio do termo para trabalhar no laboratório."
    },
    {
     "titulo": "Política de acesso ao LABBIO",
     "url": "arquivo:NRO-PES-015",
     "descricao": "as regras do laboratório."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Um arquivo é da classe confidencial. Quem lê o conteúdo?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Toda a equipe",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Quem está no grupo do emissor",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Só os grupos de leitura e o grupo revisor",
        "correta": true
       }
      ],
      "explicacao": "Na classe confidencial, nem o grupo do emissor lê por padrão: só os grupos de leitura escolhidos e o grupo revisor."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Você precisa de um documento que não abre para você. O que faz?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Pede para um colega que tem acesso baixar e mandar pelo WhatsApp",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Abre uma Solicitação de acesso dizendo por que e por quanto tempo precisa",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Espera alguém perceber e liberar",
        "correta": false
       }
      ],
      "explicacao": "O colega que repassa o arquivo fura a necessidade de conhecer e deixa uma cópia fora de controle. A Solicitação de acesso é registrada e decidida por quem responde por aquilo."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "\"Público\" no SOMA quer dizer que o arquivo pode ir para a internet.",
        "correta": false
       },
       {
        "id": "b",
        "texto": "O código e o título de um arquivo confidencial ficam à vista da equipe.",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O dever de sigilo acaba quando você sai da equipe.",
        "correta": false
       }
      ],
      "explicacao": "\"Público\" é público para a equipe. Os metadados ficam à vista para que se saiba o que pedir. E o sigilo continua depois da saída."
     }
    ]
   }
  },
  {
   "id": "m-engenharia-social",
   "titulo": "Engenharia social",
   "corpo": "Ao fim deste módulo, você reconhece uma tentativa de engenharia social e sabe o que fazer diante de uma.\n\nNão é preciso invadir um sistema quando basta **pedir**. A cartilha de engenharia social do PNPC define: é o uso de **dissimulação, manipulação ou exploração da confiança**, sem violência, para que a própria pessoa entregue a informação — por vontade própria, sem perceber o que está fazendo.\n\nFunciona porque explora o que temos de melhor: a vontade de ajudar, o respeito à hierarquia, a curiosidade. É por isso que grandes empresas fazem simulações de phishing com os próprios funcionários: o elo mais visado é o humano.\n\n## Rede e arpão\n\n- **Phishing** é a **rede**: a mesma mensagem para milhares de pessoas, esperando que alguém morda — \"sua conta será bloqueada\", \"você ganhou um prêmio\".\n- **Spearphishing** é o **arpão**: uma mensagem feita para você, com o seu nome, o nome do seu projeto, o nome da sua coordenadora. Quem manda pesquisou antes — muitas vezes nas nossas próprias redes.\n\nUm exemplo de arpão: *\"Oi, aqui é da equipe da Visuri. A Profa. pediu para você me mandar a última versão do relatório de testes do projeto, a reunião é daqui a meia hora.\"* Tem nome certo, tem urgência, tem autoridade. E pode ser falso.\n\n## Os sinais\n\n| Sinal | Como aparece |\n|---|---|\n| **Urgência** | \"é para agora\", \"senão o acesso é bloqueado\" |\n| **Autoridade** | \"a coordenação pediu\", \"é da diretoria\" |\n| **Canal estranho** | um pedido de trabalho pelo número pessoal, por um e-mail que não é o institucional |\n| **Pedido fora do normal** | senha, código de verificação, um arquivo que a pessoa teria como pedir pelo portal |\n| **Curiosidade ou prêmio** | \"veja quem comentou sobre você\", \"clique para receber\" |\n\n[VÍDEO A GRAVAR: NRO-TRE-005/V2 — dissecar na tela um e-mail de phishing e uma mensagem de spearphishing de exemplo, apontando cada sinal]\n\n## O que fazer\n\n- **Confirme por outro canal.** Recebeu um pedido estranho \"da coordenação\"? Pergunte à coordenação — pelo contato que você já tem, não pelo que veio na mensagem.\n- **Não clique, não baixe, não responda** até ter certeza.\n- **Ninguém da equipe vai pedir a sua senha** nem o código de verificação da sua conta. Quem pede, não é da equipe.\n- **Ative a verificação em duas etapas** na conta Google da NeuroDynamics e nas contas das redes da equipe.\n- **Avise.** Conte ao seu gestor imediato e à liderança do projeto. A tentativa que você recebeu provavelmente chegou a outras pessoas.",
   "links": [
    {
     "titulo": "Cartilha de engenharia social",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/cartilha-engenharia-social-guia-para-protecao-de-conhecimentos-sensiveis",
     "descricao": "o guia do PNPC sobre o tema."
    },
    {
     "titulo": "Segurança na internet",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/seguranca-na-internet-guia-para-protecao-de-conhecimentos-sensiveis.pdf",
     "descricao": "o guia do PNPC para e-mail, senhas e navegação."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual é a diferença entre phishing e spearphishing?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O phishing é por e-mail e o spearphishing, por telefone",
        "correta": false
       },
       {
        "id": "b",
        "texto": "O phishing é a mesma mensagem para muita gente; o spearphishing é feito para uma pessoa, com informações sobre ela",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O spearphishing é inofensivo",
        "correta": false
       }
      ],
      "explicacao": "Rede e arpão: o spearphishing usa o que o atacante descobriu sobre você e a instituição, e por isso é muito mais convincente."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Uma mensagem pelo seu número pessoal diz ser da coordenação e pede, com urgência, o relatório de testes de um projeto. Quais sinais de engenharia social ela tem?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Urgência",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Autoridade",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Canal estranho",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Nenhum: a coordenação pode pedir o que quiser",
        "correta": false
       }
      ],
      "explicacao": "Urgência, autoridade e um canal fora do normal juntos são o retrato da engenharia social. Confirme com a coordenação pelo contato que você já tem."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Alguém diz ser do suporte e pede o código de verificação que chegou no seu celular. O que você faz?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Passa o código, porque é do suporte",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Não passa o código e avisa o seu gestor imediato",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Passa o código só se a pessoa souber o seu nome completo",
        "correta": false
       }
      ],
      "explicacao": "Ninguém da equipe pede senha nem código de verificação. Saber o seu nome não prova nada: o spearphishing se baseia justamente no que dá para descobrir sobre você."
     }
    ]
   }
  },
  {
   "id": "m-redes-conversas-e-eventos",
   "titulo": "Redes, conversas e eventos",
   "corpo": "Ao fim deste módulo, você publica e conversa sobre o seu trabalho sem entregar o que não deve.\n\n## O que as redes contam\n\nA cartilha de redes sociais do PNPC lembra que cada publicação, somada às outras, conta uma história — e que quem pesquisa antes de um spearphishing começa por aí. Antes de publicar:\n\n- **A localização em tempo real.** Pense bem antes de dizer onde você está *agora*. Poste depois.\n- **O fundo da foto.** Uma tela aberta, um quadro branco, uma bancada com o protótipo, um crachá. Olhe o fundo antes do rosto.\n- **O detalhe demais.** \"Estou no projeto X\" é ótimo. \"Estou no projeto X, que usa o sensor Y com o parceiro Z para resolver W\" pode ser o que o projeto ainda não tornou público.\n- **O perfil que chega do nada.** Serviços de inteligência como o MI5 britânico já alertaram publicamente para perfis falsos de recrutadores no LinkedIn usados para se aproximar de pesquisadores. Uma proposta boa demais, de alguém que você não conhece, pedindo detalhes do seu trabalho, merece desconfiança.\n\nO [treinamento de redes sociais](treinamento:NRO-TRE-004) mostra como a equipe publica pelo Studio, com aprovação.\n\n## Conversas\n\nO bandejão, o ônibus, a fila do evento. Uma conversa sobre o projeto em lugar público é ouvida por quem está perto — e você não sabe quem é. Fale do assunto, não dos detalhes. Numa ligação de trabalho, procure um lugar reservado.\n\n## Eventos e publicações\n\nUm pôster, uma apresentação, um artigo, um vídeo no YouTube: tudo isso é **divulgação pública**. E divulgação conta contra uma patente.\n\n- No Brasil, a Lei de Propriedade Industrial (Lei 9.279/1996, art. 12) dá um **período de graça** de 12 meses: a divulgação feita pelo próprio inventor até 12 meses antes do pedido não destrói a novidade.\n- Em boa parte do mundo, **não há** esse período — na Europa, por exemplo. Publicar antes de depositar pode custar a patente lá fora.\n\nPor isso, antes de apresentar um resultado de projeto fora da equipe, **confira com a liderança do projeto** se ele pode sair e se há pedido de patente a fazer antes — na UFMG, com a CTIT, o núcleo de inovação tecnológica. Na indústria, nenhum engenheiro apresenta um resultado em congresso sem a liberação do jurídico de propriedade intelectual.",
   "links": [
    {
     "titulo": "Redes sociais — guia do PNPC",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/redessociais_27062022.pdf",
     "descricao": "os cuidados da ABIN com redes sociais."
    },
    {
     "titulo": "Informações públicas de projetos",
     "url": "arquivo:NRO-MKT-002",
     "descricao": "o que de cada projeto já pode sair."
    },
    {
     "titulo": "Política de redes sociais",
     "url": "arquivo:NRO-MKT-001",
     "descricao": "como a equipe se apresenta nas redes."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "multipla",
      "enunciado": "Você quer postar uma foto sua na bancada do laboratório. O que confere antes?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O que aparece nas telas e no quadro ao fundo",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Se o protótipo que aparece já é público",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Se vale postar a localização só depois",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Nada, se o post for no seu perfil pessoal",
        "correta": false
       }
      ],
      "explicacao": "O perfil pessoal também é lido por quem pesquisa a equipe. O fundo da foto e a localização em tempo real contam mais do que parece."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Um projeto quer apresentar um resultado num congresso internacional. O que vem antes?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Nada: congresso é ambiente acadêmico e não conta como divulgação",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Conferir com a liderança do projeto se o resultado pode sair e se há patente a pedir antes",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Pedir a patente depois do congresso, porque o Brasil dá 12 meses de graça",
        "correta": false
       }
      ],
      "explicacao": "Apresentar em congresso é divulgação pública. O período de graça brasileiro não vale em boa parte do mundo, e a patente no exterior pode se perder."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Um pôster num congresso é divulgação pública.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Conversar sobre os detalhes do projeto no ônibus não tem risco, porque ninguém entende.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Perfis falsos de recrutadores já foram usados para se aproximar de pesquisadores.",
        "correta": true
       }
      ],
      "explicacao": "Você não sabe quem está ouvindo, nem o que a pessoa entende. Fale do assunto, não dos detalhes."
     }
    ]
   }
  },
  {
   "id": "m-dados-pessoais-e-a-lgpd",
   "titulo": "Dados pessoais e a LGPD",
   "corpo": "Ao fim deste módulo, você trata os dados de voluntários, pacientes e colegas como a lei pede e sabe o que fazer quando algo vaza.\n\n## O que a lei diz\n\nA **Lei Geral de Proteção de Dados** (LGPD, Lei 13.709/2018) vale para qualquer organização que trata dados de pessoas — a NeuroDynamics incluída. Ela separa dois tipos:\n\n- **Dado pessoal** — o que identifica uma pessoa ou permite identificá-la: nome, CPF, e-mail, matrícula, foto.\n- **Dado pessoal sensível** (art. 5º, II) — entre outros, o dado **referente à saúde**, o **genético** e o **biométrico**. Exige cuidado redobrado.\n\nNuma equipe de engenharia biomédica, dado sensível é rotina: o sinal de EMG de um voluntário, a ficha de um paciente, a biometria de acesso ao laboratório. É por isso que os relatórios do portal com dados pessoais saem marcados como **confidencial — LGPD**.\n\n> **Nota:** quando um teste envolve pessoas, pergunte à liderança do projeto se ele tem a aprovação de um Comitê de Ética em Pesquisa. A pesquisa com seres humanos no Brasil segue a Resolução CNS 466/2012.\n\n## Boas práticas\n\n- **Colete só o necessário.** Se o teste precisa da idade, não peça o CPF.\n- **Separe o nome do dado.** Identifique o voluntário por um código (`V-07`) e guarde a tabela que liga o código ao nome à parte, com acesso restrito.\n- **Não leve para fora.** Dado de voluntário não vai para o computador pessoal, o pen drive, o WhatsApp ou o e-mail pessoal. Fica no Drive da equipe, na pasta com acesso controlado.\n- **Apague o que não precisa mais**, quando o projeto disser que pode.\n- **Colegas também são titulares.** O telefone, o endereço e o desempenho de um membro não se repassam.\n\n## Quando algo vaza\n\nMandou a planilha para a pessoa errada? Perdeu o notebook com dados de um teste? Deixou o link da pasta aberto para qualquer pessoa?\n\n**Avise na hora** o seu gestor imediato e a liderança do projeto. A LGPD (art. 48) obriga a organização a comunicar à Autoridade Nacional de Proteção de Dados e às pessoas afetadas o incidente que possa trazer risco ou dano relevante — e isso só é possível se quem viu o problema contar. Esconder um vazamento não o desfaz: só tira de quem pode agir o tempo de agir.\n\n> **Importante:** quem avisa de um erro próprio está fazendo a coisa certa. Toda organização séria de saúde trata o relato de incidente como contribuição, não como culpa — é assim que se aprende a não repetir.",
   "links": [
    {
     "titulo": "Lei Geral de Proteção de Dados",
     "url": "https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm",
     "descricao": "o texto da LGPD no Planalto."
    },
    {
     "titulo": "Segurança na internet",
     "url": "https://www.gov.br/abin/pt-br/institucional/acoes-e-programas/PNPC/boaspraticas/seguranca-na-internet-guia-para-protecao-de-conhecimentos-sensiveis.pdf",
     "descricao": "o guia do PNPC para cuidar de arquivos e contas."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "multipla",
      "enunciado": "Quais destes são dados pessoais sensíveis, na LGPD?",
      "opcoes": [
       {
        "id": "a",
        "texto": "O sinal de EMG de um voluntário",
        "correta": true
       },
       {
        "id": "b",
        "texto": "A biometria de acesso ao laboratório",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O diagnóstico de um paciente",
        "correta": true
       },
       {
        "id": "d",
        "texto": "O nome do projeto em que um membro trabalha",
        "correta": false
       }
      ],
      "explicacao": "Dado de saúde, genético e biométrico é sensível. O nome do projeto não é dado pessoal sensível."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Como guardar os dados de voluntários de um teste?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Numa planilha com nome, CPF e resultados, no computador de quem aplicou o teste",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Com um código no lugar do nome, e a tabela que liga código e nome à parte, com acesso restrito",
        "correta": true
       },
       {
        "id": "c",
        "texto": "No grupo de WhatsApp do projeto, para todo mundo achar fácil",
        "correta": false
       }
      ],
      "explicacao": "Separar o nome do dado reduz o estrago de um vazamento, e o Drive da equipe controla quem acessa."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Você percebe que o link de uma pasta com dados de voluntários ficou aberto para qualquer pessoa. O que faz?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Fecha o link e não comenta, para não se complicar",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Fecha o link e avisa na hora o gestor imediato e a liderança do projeto",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Espera a reunião geral para contar",
        "correta": false
       }
      ],
      "explicacao": "A organização pode ter de comunicar o incidente à ANPD e às pessoas afetadas. Só dá para agir se quem viu contar — e logo."
     }
    ]
   }
  }
 ]
}$tre005$::jsonb);

-- NRO-TRE-006 · Gestão de projetos — 6 módulos, 4 vídeos a gravar
select pg_temp.tre_semear(6, 'Gestão de projetos', 'O que é um projeto, como ele vive no SOMA e os métodos com que a equipe trabalha — Kanban, Scrum, OKRs e o ciclo de requisitos, riscos e verificação —, os mesmos que a indústria usa para levar um produto da ideia ao usuário.', 'Projetos',
  75, null, null, $tre006${
 "modulos": [
  {
   "id": "m-o-que-e-um-projeto",
   "titulo": "O que é um projeto",
   "corpo": "Ao fim deste módulo, você sabe o que distingue um projeto de uma rotina e por que a NeuroDynamics o gerencia com método.\n\nO Project Management Institute (PMI), cujo guia PMBOK é a referência mundial em gerenciamento de projetos, define: **projeto é um esforço temporário, empreendido para criar um produto, serviço ou resultado único**.\n\nAs duas palavras importam:\n\n- **Temporário** — tem começo e fim. Uma órtese que precisa ser projetada é um projeto; a limpeza semanal do laboratório é uma rotina.\n- **Único** — ninguém fez aquilo exatamente daquele jeito antes. Por isso há incerteza, e por isso é preciso método.\n\n## O que se equilibra\n\nTodo projeto negocia o tempo todo entre **escopo** (o que se entrega), **prazo** e **recursos** (pessoas, horas, dinheiro), sem abrir mão da **qualidade**. Aumentar um puxa os outros: mais escopo no mesmo prazo pede mais gente; menos gente no mesmo escopo pede mais prazo. Gerenciar um projeto é fazer essas trocas **de propósito**, e não descobri-las no fim.\n\n## Planejar ou adaptar\n\n| Abordagem | Como funciona | Quando serve |\n|---|---|---|\n| **Preditiva** (cascata) | planeja tudo no começo e executa em fases | quando o que se quer está claro e muda pouco |\n| **Ágil** | entrega em ciclos curtos e reajusta a cada um | quando se aprende fazendo |\n| **Híbrida** | fases e marcos definidos, ciclos ágeis dentro delas | o normal em dispositivos médicos |\n\nNa NeuroDynamics o normal é o híbrido. A ISO 13485 — a norma de qualidade de dispositivos médicos — pede um projeto com etapas documentadas: requisitos, riscos, verificação, validação. Dentro delas, os grupos trabalham em ciclos curtos, com quadro e sprints. Não é contradição: a AAMI TIR45, usada pela indústria de dispositivos médicos, descreve justamente como usar métodos ágeis sob essas exigências.\n\n> **Nota:** o PMI certifica gerentes de projeto no mundo inteiro, e o PMBOK é leitura de base em cursos de engenharia e de administração. O que você aprende aqui é o começo desse caminho.",
   "links": [
    {
     "titulo": "Project Management Institute",
     "url": "https://www.pmi.org/",
     "descricao": "o instituto que mantém o PMBOK."
    },
    {
     "titulo": "Termo de abertura de projeto",
     "url": "arquivo:NRO-PRO-001",
     "descricao": "o documento que abre cada projeto da equipe."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual destes é um projeto?",
      "opcoes": [
       {
        "id": "a",
        "texto": "A limpeza semanal do laboratório",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Desenvolver o primeiro protótipo de uma órtese",
        "correta": true
       },
       {
        "id": "c",
        "texto": "A reunião geral de todo mês",
        "correta": false
       }
      ],
      "explicacao": "Projeto é temporário e cria algo único. A limpeza e a reunião se repetem: são rotinas."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "O escopo de um projeto cresceu, e a equipe e o prazo continuam os mesmos. O que tende a acontecer?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Nada, se todo mundo se esforçar",
        "correta": false
       },
       {
        "id": "b",
        "texto": "A qualidade cai ou o prazo estoura, a não ser que se renegocie escopo, prazo ou recursos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O projeto fica mais barato",
        "correta": false
       }
      ],
      "explicacao": "Escopo, prazo e recursos se puxam. Gerenciar é renegociar de propósito, antes que a conta chegue."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Um projeto pode ter fases documentadas e, dentro delas, trabalhar em ciclos ágeis.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Métodos ágeis não podem ser usados em dispositivos médicos.",
        "correta": false
       }
      ],
      "explicacao": "A abordagem híbrida é a regra em dispositivos médicos, e a AAMI TIR45 orienta o uso de métodos ágeis nesse contexto."
     }
    ]
   }
  },
  {
   "id": "m-o-projeto-no-soma",
   "titulo": "O projeto no SOMA",
   "corpo": "Ao fim deste módulo, você acha o seu projeto no portal, sabe quem responde por ele e o que precisa estar documentado.\n\n## A equipe e o supervisor\n\nEm **Projetos**, cada projeto tem um código (`NEBULA`), uma descrição, um status — **ativo**, **pausado** ou **encerrado** — e uma equipe. A equipe é um grupo, `NRO_PROJECT_NEBULA`, dentro de `NRO_PROJECTS`: entrar na equipe põe você no quadro de atividades do grupo, nos compromissos do grupo e nos arquivos controlados do projeto.\n\nUm membro da equipe é o **supervisor**. Ele responde pelo projeto no dia a dia, põe e tira gente da equipe e edita a descrição e o status. Quem cria projetos é o **PMO**, o escritório de projetos — como nas grandes empresas, é quem cuida para que todos os projetos sigam o mesmo padrão.\n\n## O rol de arquivos\n\nO **padrão de projeto** é a lista das séries que todo projeto precisa ter, definida pelo PMO. Na aba **Arquivos** do projeto, cada série do padrão aparece numa linha: o exemplar do projeto, ou **a criar**. A barra mostra quanto do padrão já está **em vigor**, **em revisão** e **em rascunho**.\n\nO primeiro documento é o **termo de abertura** — o *project charter*, no PMBOK. É ele que diz para que o projeto existe, o que entra e o que fica de fora do escopo, quem participa e quais são os marcos. Projeto sem termo de abertura é projeto que cada um entende de um jeito.\n\n[VÍDEO A GRAVAR: NRO-TRE-006/V1 — a página de um projeto: a equipe, o supervisor, o quadro e o rol de arquivos, com a criação de um exemplar que está \"a criar\"]\n\n> **Dica:** abra a sua lista em **Projetos › Meus**. Se você trabalha num projeto e ele não aparece ali, fale com o supervisor: você ainda não está no grupo da equipe e, por isso, não lê os arquivos dela.\n\nO [treinamento de documentação](treinamento:NRO-TRE-003) mostra como criar, enviar e revisar cada um desses arquivos.",
   "links": [
    {
     "titulo": "Projetos",
     "url": "#/projetos",
     "descricao": "todos os projetos da equipe."
    },
    {
     "titulo": "Termo de abertura de projeto",
     "url": "arquivo:NRO-PRO-001",
     "descricao": "o template do documento que abre cada projeto."
    },
    {
     "titulo": "Portfólio",
     "url": "arquivo:NRO-PRO-007",
     "descricao": "o registro do conjunto de projetos da equipe."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "multipla",
      "enunciado": "O que o supervisor de um projeto pode fazer?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Pôr e tirar gente da equipe",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Editar a descrição e o status do projeto",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Aprovar sozinho os documentos que ele mesmo enviou",
        "correta": false
       }
      ],
      "explicacao": "O supervisor cuida do projeto e da equipe. Revisar um documento é sempre de outra pessoa, nunca de quem enviou."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Para que serve o termo de abertura?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Para registrar as horas de cada membro",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Para dizer para que o projeto existe, o que entra e o que fica de fora do escopo, quem participa e os marcos",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Para substituir o quadro de atividades",
        "correta": false
       }
      ],
      "explicacao": "É o *project charter* do PMBOK: o documento que autoriza o projeto e o torna igual para todos que trabalham nele."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Você trabalha num projeto, mas não consegue ler os arquivos controlados dele. Qual é o motivo mais provável?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Você ainda não está no grupo da equipe do projeto",
        "correta": true
       },
       {
        "id": "b",
        "texto": "O portal esconde os arquivos de quem é novo",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Os arquivos controlados só abrem para o supervisor",
        "correta": false
       }
      ],
      "explicacao": "Os arquivos controlados do projeto são da equipe, e a equipe é o grupo `NRO_PROJECT_<CÓDIGO>`. Peça ao supervisor para incluir você."
     }
    ]
   }
  },
  {
   "id": "m-o-quadro-kanban",
   "titulo": "O quadro: Kanban",
   "corpo": "Ao fim deste módulo, você usa o quadro de atividades do seu grupo como a indústria usa um quadro Kanban.\n\n**Kanban** é \"cartão\" ou \"sinal visual\" em japonês. O método nasceu na Toyota, com Taiichi Ohno, como parte do Sistema Toyota de Produção — a origem do que hoje se chama *lean*. Nos anos 2000 foi levado ao trabalho de conhecimento, em software e em projetos. Três ideias o sustentam:\n\n- **Tornar o trabalho visível.** O que não está no quadro não existe para a equipe.\n- **Limitar o trabalho em andamento.** Começar muitas coisas ao mesmo tempo é o jeito mais rápido de não terminar nenhuma. O lema é *pare de começar, comece a terminar*.\n- **Puxar, não empurrar.** Quem termina puxa a próxima tarefa, em vez de receber uma pilha.\n\n## As colunas\n\nEm **Atividades**, cada grupo tem o seu quadro, e cada atividade, um código (`ORT-14`):\n\n| Coluna | O que é |\n|---|---|\n| **Backlog** | o que precisa ser feito um dia, ainda sem prioridade para agora |\n| **A fazer** | o que a equipe se comprometeu a fazer neste ciclo |\n| **Em andamento** | o que alguém está fazendo agora |\n| **Em revisão** | pronto, esperando outra pessoa conferir |\n| **Concluída** | feito e conferido |\n\nSó quem está no grupo move as atividades dele.\n\n## Uma boa atividade\n\n- **O título é uma ação:** \"Calibrar o encoder do protótipo\", não \"Encoder\".\n- **A descrição diz quando está pronta** — o *critério de pronto*. \"Calibrado, com o relatório de teste enviado\" não deixa dúvida.\n- **Tem responsável, prazo e prioridade** — baixa, média, alta ou urgente — e, se der, a **estimativa** em horas.\n- **Cabe em poucos dias.** Se não cabe, quebre em várias.\n\n## Quando trava\n\n- **Comente** e marque quem precisa saber: a pessoa é notificada.\n- **Siga** uma atividade para ser avisado do que acontece com ela.\n- **Sinalize** quando ela precisa de atenção: quem a segue é avisado e, se houver responsável, o gestor dele também. É assim que se escala um problema — cedo, com o motivo escrito.\n\nEm **Atividades › Carga da equipe**, cada pessoa aparece com as atividades abertas, as atrasadas, as sinalizadas e as horas estimadas. É ali que se vê quem está sobrecarregado antes que isso vire atraso.\n\n[VÍDEO A GRAVAR: NRO-TRE-006/V2 — criar uma atividade com critério de pronto, movê-la pelo quadro, comentar marcando alguém, sinalizar e ver a carga da equipe]",
   "links": [
    {
     "titulo": "Atividades",
     "url": "#/atividades",
     "descricao": "o quadro do seu grupo."
    },
    {
     "titulo": "Carga da equipe",
     "url": "#/atividades/carga",
     "descricao": "quanto cada pessoa está carregando."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual destes títulos de atividade está melhor escrito?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Encoder",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Ver aquela coisa do encoder",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Calibrar o encoder do protótipo",
        "correta": true
       }
      ],
      "explicacao": "Um título é uma ação: diz o que fazer e em quê. O critério de pronto vai na descrição."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Quais são ideias centrais do Kanban?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Tornar o trabalho visível",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Limitar o trabalho em andamento",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Puxar a próxima tarefa quando termina a atual",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Começar o máximo de tarefas ao mesmo tempo",
        "correta": false
       }
      ],
      "explicacao": "Muitas tarefas abertas ao mesmo tempo é o jeito mais rápido de não terminar nenhuma."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "A sua atividade está parada há uma semana esperando um fornecedor. O que faz?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Espera: uma hora o fornecedor responde",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Sinaliza a atividade, escrevendo o motivo",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Move a atividade de volta para o Backlog sem avisar",
        "correta": false
       }
      ],
      "explicacao": "Sinalizar avisa quem segue a atividade e o gestor do responsável. Escalar cedo é o que dá tempo de resolver."
     }
    ]
   }
  },
  {
   "id": "m-scrum-e-as-cerimonias",
   "titulo": "Scrum e as cerimônias",
   "corpo": "Ao fim deste módulo, você sabe para que serve cada cerimônia do Scrum e como o seu grupo as coloca na agenda.\n\nO nome vem do rúgbi — a formação em que o time avança junto. Foi usado pela primeira vez para desenvolvimento de produtos por Hirotaka Takeuchi e Ikujiro Nonaka, num artigo de 1986 na Harvard Business Review que estudava como Honda, Canon e Fuji-Xerox desenvolviam produtos. Em 1995, Ken Schwaber e Jeff Sutherland apresentaram o Scrum como método, e hoje ele é o framework ágil mais usado do mundo. As regras estão no **Scrum Guide**, curto e gratuito.\n\n## O ciclo\n\nO trabalho acontece em **sprints**: ciclos de duração fixa, de no máximo um mês — em times de estudantes, costuma ser de duas semanas. Cada sprint tem uma **meta** e termina com algo que funciona e pode ser mostrado.\n\n| Cerimônia | Para quê | No portal |\n|---|---|---|\n| **Planejamento da sprint** | escolher o que entra na sprint e a meta dela | *Abertura de sprint* |\n| **Daily** | 15 minutos para o time se alinhar: o que avançou, o que vem, o que trava | *Daily* |\n| **Review** | mostrar o que foi feito a quem interessa e colher retorno | *Review* |\n| **Retrospectiva** | olhar para o próprio jeito de trabalhar e escolher o que melhorar | *Retrospectiva* |\n\nO portal tem também o **fechamento de sprint**, para o time fechar a sprint junto.\n\nA retrospectiva é a mais esquecida e a mais importante: é nela que o time melhora. Uma pergunta basta para começar — *o que faremos diferente na próxima sprint?*\n\n## Os papéis\n\n- **Product Owner** — decide a ordem do backlog: o que tem mais valor vem primeiro.\n- **Scrum Master** — cuida para que o Scrum funcione e remove o que atrapalha o time.\n- **Desenvolvedores** — quem faz o trabalho da sprint. Em Scrum, não é só quem programa: é o engenheiro, o designer, quem faz o teste.\n\nNo quadro de Atividades, o **Backlog** é o backlog do produto, e **A fazer** é o que a sprint escolheu.\n\n## As cerimônias na agenda\n\nEm **Agenda › Cerimônias do grupo**, o próprio time escolhe, para cada cerimônia, os dias, o horário, a duração, a repetição — semanal, quinzenal ou mensal — e o link do Meet. O portal cria os encontros e convida quem está no grupo. Mudou o horário? Reconfigure, e os encontros futuros são refeitos.\n\n[VÍDEO A GRAVAR: NRO-TRE-006/V3 — configurar a daily e a retrospectiva de um grupo em Cerimônias do grupo e ver os encontros aparecerem na agenda]\n\n> **Dica:** o Scrum Guide pede uma daily todos os dias úteis. Um time de estudantes, com aulas no meio, pode escolher dias fixos da semana — o portal deixa. Adaptar é normal; perder a inspeção e a adaptação, não.",
   "links": [
    {
     "titulo": "Scrum Guide",
     "url": "https://scrumguides.org/",
     "descricao": "as regras do Scrum, pelos autores."
    },
    {
     "titulo": "Agenda",
     "url": "#/agenda",
     "descricao": "as cerimônias do seu grupo, com os demais compromissos."
    },
    {
     "titulo": "Gestão de tempo e agenda",
     "url": "treinamento:NRO-TRE-002",
     "descricao": "como marcar reuniões que valem o tempo."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Para que serve a retrospectiva?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Para mostrar o produto aos parceiros",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Para o time olhar o próprio jeito de trabalhar e escolher o que melhorar",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Para distribuir as tarefas da próxima sprint",
        "correta": false
       }
      ],
      "explicacao": "Mostrar o produto é a review; escolher o trabalho é o planejamento. A retrospectiva é sobre o processo."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Quem configura as cerimônias de um grupo no portal?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Só o Depto. de Pessoal",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Quem está no grupo",
        "correta": true
       },
       {
        "id": "c",
        "texto": "O PMO",
        "correta": false
       }
      ],
      "explicacao": "O time escolhe o próprio horário. O Depto. de Pessoal também pode ajudar, mas a decisão é do time."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Uma sprint dura no máximo um mês.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Em Scrum, desenvolvedor é só quem programa.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "O Backlog do quadro de Atividades faz o papel do backlog do produto.",
        "correta": true
       }
      ],
      "explicacao": "Desenvolvedor, no Scrum, é todo mundo que faz o trabalho da sprint — engenharia, design, testes."
     }
    ]
   }
  },
  {
   "id": "m-okrs-do-objetivo-a-tarefa",
   "titulo": "OKRs: do objetivo à tarefa",
   "corpo": "Ao fim deste módulo, você entende como os objetivos da equipe se desdobram até o seu trabalho e escreve um objetivo que dá para medir.\n\nOs **OKRs** — *Objectives and Key Results*, objetivos e resultados-chave — foram criados por Andy Grove na Intel, nos anos 1970. John Doerr, que os aprendeu lá, levou-os ao Google em 1999, quando a empresa tinha cerca de quarenta pessoas, e o Google os usa até hoje. O livro dele, *Measure What Matters* (*Avalie o que importa*), espalhou o método por empresas de todos os tamanhos.\n\nA ideia cabe numa frase: **vou [objetivo], medido por [resultados-chave]**.\n\n- O **objetivo** é qualitativo e diz aonde se quer chegar.\n- Os **resultados-chave** são mensuráveis e dizem como saber que se chegou. Se não dá para medir, não é resultado-chave.\n\n## O desdobramento no portal\n\nEm **OKRs**, os objetivos formam uma árvore:\n\n| Nível | Código | Exemplo |\n|---|---|---|\n| **Estratégico** | `OE1` | Consolidar a NeuroDynamics como referência em reabilitação assistida |\n| **Tático** | `OT1.2` | Validar o protótipo da órtese com usuários até o terceiro trimestre |\n| **Operacional** | `OP1.2.1` | Concluir dez sessões de teste com voluntários até 30 de agosto |\n\nCada objetivo tem **eixo**, **responsáveis**, **prazo**, **status** — não iniciado, em andamento, em risco, concluído ou cancelado — e comentários, que são o registro do acompanhamento. O progresso de um objetivo é a parte dos objetivos da ponta, abaixo dele, que já está concluída.\n\nO campo **Descrição / critério de sucesso** é onde mora o resultado-chave: escreva ali o número que prova que o objetivo foi alcançado.\n\n## Do objetivo ao quadro\n\nOs objetivos operacionais viram atividades nos quadros dos grupos. O caminho vale nos dois sentidos: toda atividade importante deveria responder a um objetivo. Se uma atividade não responde a nenhum, vale perguntar por que ela está sendo feita.\n\n[VÍDEO A GRAVAR: NRO-TRE-006/V4 — navegar pela árvore de OKRs, do estratégico ao operacional, e registrar um comentário de acompanhamento com a mudança de status]\n\n> **Atenção:** um objetivo em risco não é um fracasso: é uma informação. Mudar o status para **em risco** a tempo é o que permite à equipe ajudar.",
   "links": [
    {
     "titulo": "OKRs",
     "url": "#/okrs",
     "descricao": "os objetivos da equipe e o desdobramento de cada um."
    },
    {
     "titulo": "What Matters",
     "url": "https://www.whatmatters.com/",
     "descricao": "o site de John Doerr sobre OKRs, com exemplos."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual destes é um bom resultado-chave?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Melhorar o protótipo",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Trabalhar mais no projeto",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Concluir dez sessões de teste com voluntários até 30 de agosto",
        "correta": true
       }
      ],
      "explicacao": "Resultado-chave se mede: tem número e prazo. \"Melhorar\" e \"trabalhar mais\" não dizem quando se chegou."
     },
     {
      "id": "q2",
      "tipo": "unica",
      "enunciado": "Onde se registra, no portal, o que prova que um objetivo foi alcançado?",
      "opcoes": [
       {
        "id": "a",
        "texto": "No campo Descrição / critério de sucesso do objetivo",
        "correta": true
       },
       {
        "id": "b",
        "texto": "No título do projeto",
        "correta": false
       },
       {
        "id": "c",
        "texto": "Numa mensagem ao supervisor",
        "correta": false
       }
      ],
      "explicacao": "O critério de sucesso é o resultado-chave do objetivo: fica junto dele, à vista de todos."
     },
     {
      "id": "q3",
      "tipo": "vf",
      "enunciado": "Verdadeiro ou falso:",
      "opcoes": [
       {
        "id": "a",
        "texto": "Os OKRs nasceram na Intel e foram levados ao Google em 1999.",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Mudar um objetivo para \"em risco\" é admitir fracasso e deve ser evitado.",
        "correta": false
       },
       {
        "id": "c",
        "texto": "O progresso de um objetivo vem dos objetivos da ponta concluídos abaixo dele.",
        "correta": true
       }
      ],
      "explicacao": "Em risco é informação, e dada a tempo é o que permite ajudar."
     }
    ]
   }
  },
  {
   "id": "m-requisitos-riscos-e-verificacao",
   "titulo": "Requisitos, riscos e verificação",
   "corpo": "Ao fim deste módulo, você conhece o ciclo de documentos que leva um dispositivo da ideia ao teste e por que cada um existe.\n\nUm dispositivo médico não pode só funcionar: é preciso **provar** que ele faz o que deve, para quem deve, sem riscos inaceitáveis. É isso que a ISO 13485 pede no projeto e desenvolvimento, e que reguladores como a ANVISA e a FDA cobram. A NeuroDynamics segue o mesmo caminho, com os documentos da série `PRO`.\n\n## O caminho\n\n| Etapa | A pergunta | O documento |\n|---|---|---|\n| **Requisitos** | o que o usuário e o sistema precisam? | a [USRS](arquivo:NRO-PRO-004) |\n| **Riscos** | o que pode dar errado, e com que gravidade? | a [matriz de riscos](arquivo:NRO-PRO-006) |\n| **Projeto** | que decisões tomamos, e por quê? | o [design record](arquivo:NRO-PRO-014) e o [ADR](arquivo:NRO-PRO-013) |\n| **Verificação** | o que construímos atende aos requisitos? | o [relatório de testes](arquivo:NRO-PRO-003) |\n| **Validação** | atende ao usuário, no uso real? | o [plano de validação](arquivo:NRO-PRO-005) |\n| **Rastreabilidade** | cada requisito foi testado? | a [matriz de rastreabilidade](arquivo:NRO-PRO-011) |\n\n## Verificar e validar\n\nBarry Boehm, pioneiro da engenharia de software, resumiu a diferença em duas perguntas:\n\n- **Verificação:** *estamos construindo o produto do jeito certo?* — ele atende aos requisitos escritos?\n- **Validação:** *estamos construindo o produto certo?* — ele resolve o problema de quem vai usá-lo?\n\nUm dispositivo pode passar em todos os testes de bancada e, ainda assim, não servir ao paciente. Por isso as duas existem.\n\n## Riscos\n\nA gestão de riscos de dispositivos médicos segue a **ISO 14971**: identificar o que pode causar dano, estimar a probabilidade e a gravidade, reduzir o risco e verificar que a redução funcionou. Um risco anotado cedo custa uma linha na matriz. Descoberto num teste com voluntário, pode custar muito mais.\n\n## Rastrear\n\nA matriz de rastreabilidade liga cada requisito ao risco que ele trata, à decisão de projeto que o atende e ao teste que o prova. Quando um requisito muda, ela mostra tudo o que precisa ser revisto. Quando um auditor pergunta \"como vocês sabem que isso funciona?\", ela é a resposta.\n\n> **Importante:** documentar não é burocracia depois do trabalho: é o trabalho deixando rastro. Um teste sem relatório, para qualquer auditor, não aconteceu.",
   "links": [
    {
     "titulo": "USRS",
     "url": "arquivo:NRO-PRO-004",
     "descricao": "os requisitos de usuário e de sistema."
    },
    {
     "titulo": "Relatório de execução de testes",
     "url": "arquivo:NRO-PRO-003",
     "descricao": "o registro de cada teste."
    },
    {
     "titulo": "ISO 13485",
     "url": "https://www.iso.org/standard/59752.html",
     "descricao": "a norma de gestão da qualidade de dispositivos médicos."
    }
   ],
   "verificacao": {
    "questoes": [
     {
      "id": "q1",
      "tipo": "unica",
      "enunciado": "Qual é a diferença entre verificação e validação?",
      "opcoes": [
       {
        "id": "a",
        "texto": "São a mesma coisa com nomes diferentes",
        "correta": false
       },
       {
        "id": "b",
        "texto": "Verificação confere se o produto atende aos requisitos; validação confere se ele resolve o problema do usuário",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Verificação é feita pelo usuário, e validação, pela equipe",
        "correta": false
       }
      ],
      "explicacao": "Construir o produto do jeito certo e construir o produto certo: um dispositivo pode passar na bancada e não servir ao paciente."
     },
     {
      "id": "q2",
      "tipo": "multipla",
      "enunciado": "Para que serve a matriz de rastreabilidade?",
      "opcoes": [
       {
        "id": "a",
        "texto": "Ligar cada requisito ao teste que o prova",
        "correta": true
       },
       {
        "id": "b",
        "texto": "Mostrar o que precisa ser revisto quando um requisito muda",
        "correta": true
       },
       {
        "id": "c",
        "texto": "Responder a um auditor como se sabe que algo funciona",
        "correta": true
       },
       {
        "id": "d",
        "texto": "Registrar as horas trabalhadas no projeto",
        "correta": false
       }
      ],
      "explicacao": "A rastreabilidade liga requisito, risco, projeto e teste. Horas ficam no quadro, como estimativa."
     },
     {
      "id": "q3",
      "tipo": "unica",
      "enunciado": "Qual norma trata da gestão de riscos de dispositivos médicos?",
      "opcoes": [
       {
        "id": "a",
        "texto": "ISO 9001",
        "correta": false
       },
       {
        "id": "b",
        "texto": "ISO 14971",
        "correta": true
       },
       {
        "id": "c",
        "texto": "ISO/IEC 27001",
        "correta": false
       }
      ],
      "explicacao": "A ISO 9001 é de qualidade em geral, e a ISO/IEC 27001, de segurança da informação. A de riscos de dispositivos médicos é a ISO 14971."
     }
    ]
   }
  }
 ]
}$tre006$::jsonb);

insert into public.migracoes (id, descricao) values
  ('v25_treinamentos_iniciais', 'Os primeiros treinamentos, em rascunho: Introdução ao SOMA, Gestão de tempo e agenda, ISO 9001: documentação e o sistema de Arquivos, Gestão de redes sociais, Confidencialidade da informação, Gestão de projetos')
on conflict (id) do nothing;

-- ============================================================
-- O QUE A 25.0 DEIXOU — uma linha por treinamento
-- ------------------------------------------------------------
select s.codigo, coalesce(t.titulo, s.titulo) as titulo, s.resultado,
       t.status, jsonb_array_length(r.conteudo->'modulos') as modulos,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               jsonb_array_elements(coalesce(m->'verificacao'->'questoes', '[]'::jsonb)) q) as questoes,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               regexp_matches(m->>'corpo', '\[V[ÍI]DEO A GRAVAR[^]]*\]', 'g')) as videos_a_gravar,
       (select count(*) from jsonb_array_elements(r.conteudo->'modulos') m,
               regexp_matches(m->>'corpo', '\[CONFIRMAR[^]]*\]', 'g')) as a_confirmar,
       coalesce(array_length(public.treinamento_problemas(r.conteudo), 1), 0) as problemas_de_estrutura
  from tre_semente s
  left join public.treinamentos t on t.codigo = s.codigo
  left join public.treinamento_revisoes r on r.treinamento_id = t.id and r.status = 'rascunho'
 where s.codigo in ('NRO-TRE-001', 'NRO-TRE-002', 'NRO-TRE-003', 'NRO-TRE-004', 'NRO-TRE-005', 'NRO-TRE-006')
 order by s.codigo;

-- ============================================================
-- FIM — SOMA 25.0
--
-- Depois de rodar:
--   1) em Treinamentos › Gestão, os 6 aparecem em rascunho;
--   2) grave os vídeos pelos roteiros (treinamentos/roteiros/) e troque
--      cada marca [VÍDEO A GRAVAR: …] pelo bloco de vídeo no editor;
--   3) resolva os [CONFIRMAR: …] — a tabela acima diz onde há;
--   4) publique e atribua — a sugestão de a quem atribuir cada um
--      está em treinamentos/LEIAME.md.
-- ============================================================
