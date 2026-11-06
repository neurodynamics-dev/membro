# As 15 propostas de publicação (SOMA 2.28.0), a partir do Anexo do Plano
# de Publicações (abas Calendário, Instagram e LinkedIn). Gera propostas.json,
# que alimenta a prévia (render) e a migração.
import json, sys
banco = {f['banco_id']: f for f in json.load(open(sys.argv[1], encoding='utf8'))['fotos']}

def foto(bid):
    f = banco[bid]
    url = f['imagem'] + '&w=2160&fm=jpg&q=85&fit=max'
    return {'url': url, 'credito': f"{f['autor']} / Unsplash", 'familia': f['familia'], 'alt': f['descricao']}

HASH = '#NeuroDynamics #UFMG #LABBIO #Bioengenharia'

def capa(olho, titulo, sub):
    return {'layout': 'faixa', 'campos': {'olho': olho, 'titulo': titulo, 'sub': sub},
            'fotos': {'foto': {'ref': 'f1', 'modo': 'topo', 'x': 50, 'y': 50, 'zoom': 1}}}
def texto(n, titulo, corpo):
    return {'layout': 'texto', 'campos': {'olho': n, 'titulo': titulo, 'corpo': corpo}, 'fotos': {'foto': {'modo': 'nenhuma'}}}
def cta(titulo, sub, site='neurodynamics.dev'):
    return {'layout': 'cta', 'campos': {'titulo': titulo, 'sub': sub, 'site': site}, 'fotos': {'foto': {'modo': 'nenhuma'}}}
def take(n, titulo, sub):
    return {'layout': 'cartela', 'campos': {'olho': f'Take {n}', 'titulo': titulo, 'sub': sub}, 'fotos': {'foto': {'modo': 'nenhuma'}}}

P = []
def pub(id_, titulo, rede, formato, data, categoria, pilar, bid, laminas, legenda, notas, tamanho):
    f = foto(bid)
    peca = {'v': 1, 'modelo': 'publicacao', 'tamanho': tamanho,
            'estilo': {'tema': f['familia'], 'decoracao': 'nenhuma', 'grade': False, 'rodape': 'neurodynamics.dev'},
            'laminas': laminas, 'fotos': {'f1': {'origem': 'galeria', 'url': f['url'], 'caminho': None, 'credito': f['credito']}}}
    P.append({'id': id_, 'titulo': titulo, 'redes': [rede], 'formato': formato, 'data': data, 'categoria': categoria,
              'pilar': pilar, 'legenda': legenda.strip(), 'texto_alt': f['alt'], 'notas': notas.strip(), 'peca': peca, 'foto': bid})

# ---------------- Instagram: Reels (4) ----------------
pub('IG-005', 'NRO Explica: implante coclear', 'instagram', 'reels', 'ter 10/11/2026, 18h', 'publicacao', 'educar', 'Kile7-U74s0', [
    capa('NRO Explica', 'Como um implante transforma som em eletricidade?', 'Em 30 segundos, do microfone ao nervo auditivo.'),
    take(1, 'Um microfone capta o som', 'O processador, atrás da orelha, transforma o som em sinal digital.'),
    take(2, 'O sinal atravessa a pele', 'Uma bobina envia o sinal, sem fios, para o implante sob a pele.'),
    take(3, 'Eletrodos estimulam o nervo', 'Na cóclea, cada eletrodo cuida de uma faixa de frequências.'),
    take(4, 'O cérebro aprende a ouvir', 'A adaptação leva tempo, com acompanhamento da fonoaudiologia.'),
], """
Como um implante transforma som em eletricidade?

Um microfone capta o som, uma bobina leva o sinal através da pele e eletrodos na cóclea estimulam o nervo auditivo. O resto é o cérebro aprendendo a ouvir de novo.

O implante coclear é uma escolha, não a única forma de viver a surdez. Respeitamos a Libras e a comunidade surda.

Salve e mande para quem tem curiosidade sobre o assunto.

#NROExplica #ImplanteCoclear #Surdez """ + HASH, """
Ideia IG-005 do Plano de Publicações (prioridade A). Data sugerida: ter 10/11/2026, 18h (gancho: 10/11, Dia Nacional de Prevenção e Combate à Surdez).
Dependências: respeitar a comunidade surda; revisão da Clínica.
Reel de 30 a 40 s. Roteiro: 0 a 3 s, a capa (lâmina 1) com o gancho em voz; depois os takes 1 a 4 (lâminas 2 a 5), cada um com 5 a 8 s, sobre imagens do processador, da bobina e de uma animação simples da cóclea; fecho com a logo. Legendar a fala (acessibilidade).
A capa é a thumbnail do Reel (9:16; o recorte de 3:4 do perfil pega a faixa inteira). Os takes são as cartelas que aparecem no meio do vídeo.
""", 'reels')

pub('IG-033', 'NRO Explica: como a eletroestimulação faz pedalar', 'instagram', 'reels', 'ter 24/11/2026, 18h', 'publicacao', 'educar', 'Xlp338P79do', [
    capa('NRO Explica', 'Como um estímulo faz a perna pedalar?', 'A eletroestimulação funcional (FES), passo a passo.'),
    take(1, 'Eletrodos sobre os músculos', 'Pequenos pulsos elétricos na pele fazem o músculo contrair.'),
    take(2, 'Cada músculo na hora certa', 'Coxa da frente, de trás e glúteos são ativados em sequência.'),
    take(3, 'Sensores sabem onde está o pedal', 'A cada instante, o sistema decide qual músculo estimular.'),
    take(4, 'A pedalada vira exercício', 'Na lesão medular, ajuda a manter os músculos ativos.'),
], """
Como um estímulo faz a perna pedalar sem a força habitual?

Na eletroestimulação funcional (FES), eletrodos na pele levam pequenos pulsos aos músculos da perna. Sensores acompanham a posição do pedal, e cada músculo é ativado no momento certo da volta.

Na NeuroDynamics, o projeto Calima trabalha justamente nessa sincronia entre estímulo e pedalada.

Salve para entender de vez o FES.

#NROExplica #FES #Eletroestimulação #Reabilitação """ + HASH, """
Ideia IG-033 do Plano de Publicações (prioridade A), projeto Calima; também é a ideia 003 da NRO-MKT-005. Data sugerida: ter 24/11/2026, 18h, no mesmo dia do documento do Calima no LinkedIn (LI-002).
Dependências: sem participantes em cena; conferir com o NRO-MKT-002 o que pode ser dito do Calima.
Reel de 30 a 40 s. Roteiro: capa (lâmina 1) com o gancho; takes 1 a 4 (lâminas 2 a 5) sobre imagens da bicicleta e dos eletrodos sem pessoas identificáveis, ou uma animação da perna com os músculos acendendo em sequência; fecho com a logo e o nome do Calima.
A capa é a thumbnail do Reel; os takes são as cartelas do meio do vídeo.
""", 'reels')

pub('IG-002', 'NRO Explica: por que a ressonância é tão barulhenta', 'instagram', 'reels', 'ter 08/12/2026, 18h', 'publicacao', 'educar', 'ii6BOPjAtVY', [
    capa('NRO Explica', 'Esse barulho não é defeito. É a máquina funcionando.', 'Por que a ressonância magnética faz tanto barulho.'),
    take(1, 'Um ímã muito forte', 'Dezenas de milhares de vezes mais forte que o campo da Terra.'),
    take(2, 'Bobinas que ligam e desligam', 'Para formar a imagem, o campo muda muitas vezes por segundo.'),
    take(3, 'Elas vibram como um alto-falante', 'A corrente dentro do campo magnético faz as bobinas vibrarem.'),
    take(4, 'Cada sequência, um som', 'Por isso o barulho muda ao longo do exame.'),
], """
Esse barulho não é defeito. É a máquina funcionando.

A ressonância usa um ímã muito forte e bobinas que ligam e desligam muito rápido para formar a imagem. Dentro do campo magnético, essas bobinas vibram, como um alto-falante. Cada etapa do exame tem o seu som.

É por isso que você recebe um protetor de ouvido.

Marque alguém que já fez ressonância.

#NROExplica #Ressonância #EngenhariaBiomédica """ + HASH, """
Ideia IG-002 do Plano de Publicações (prioridade A). Data sugerida: ter 08/12/2026, 18h.
Dependências: revisão técnica.
Reel de 25 a 35 s, com áudio real (ou bem reproduzido) do aparelho nos primeiros 3 s, que é o gancho. Roteiro: capa (lâmina 1); takes 1 a 4 (lâminas 2 a 5); fecho com a logo.
A capa é a thumbnail do Reel; os takes são as cartelas do meio do vídeo.
""", 'reels')

pub('IG-032', 'NRO Explica: o músculo que enfraquece no ventilador', 'instagram', 'reels', 'ter 22/12/2026, 18h', 'publicacao', 'educar', 'oCSol-lBtVA', [
    capa('NRO Explica', 'O que acontece com o diafragma quando a máquina respira por você?', 'Ventilação mecânica e o músculo da respiração.'),
    take(1, 'O diafragma é o músculo da respiração', 'Ele contrai a cada inspiração, sem a gente perceber.'),
    take(2, 'No ventilador, ele trabalha pouco', 'Quando a máquina faz quase tudo, ele pode perder força em poucos dias.'),
    take(3, 'Sair do ventilador fica mais difícil', 'Um diafragma fraco pode atrasar o desmame.'),
    take(4, 'Estímulo no ritmo da máquina', 'Estimular o músculo junto com o ventilador é uma das ideias em estudo.'),
], """
O que acontece com o diafragma quando a máquina respira por você?

Na ventilação mecânica, o diafragma, principal músculo da respiração, pode trabalhar tão pouco que perde força em poucos dias. Isso torna mais difícil sair do ventilador.

Estimular o músculo no ritmo da máquina é uma das ideias em estudo, e é o tema do projeto Opalina, na NeuroDynamics.

Quem já teve alguém na UTI vai entender. Compartilhe.

#NROExplica #UTI #VentilaçãoMecânica """ + HASH, """
Ideia IG-032 do Plano de Publicações (prioridade A), projeto Opalina. Data sugerida: ter 22/12/2026, 18h.
Dependências: revisão da Clínica; conferir com o NRO-MKT-002 o que pode ser dito do Opalina.
Reel de 30 a 40 s, com tom cuidadoso (sem imagens de pacientes). Roteiro: capa (lâmina 1); takes 1 a 4 (lâminas 2 a 5) sobre uma animação do diafragma e do ritmo do ventilador; fecho com a logo e o nome do Opalina.
A capa é a thumbnail do Reel; os takes são as cartelas do meio do vídeo.
""", 'reels')

# ---------------- Instagram: carrosséis (8) ----------------
pub('IG-006', 'Como funciona: o sensor contínuo de glicose', 'instagram', 'carrossel', 'qui 12/11/2026, 12h', 'dicas', 'educar', '3uvS3ce7sk0', [
    capa('Como funciona', 'Como um sensor no braço acompanha a glicose o dia todo?', '14 de novembro é o Dia Mundial do Diabetes.'),
    texto('01', 'Um filamento fino sob a pele', 'O sensor mede a glicose no líquido entre as células, e não direto no sangue.'),
    texto('02', 'Uma leitura a cada poucos minutos', 'O transmissor envia os dados para o celular ou para um leitor, dia e noite.'),
    texto('03', 'A curva diz mais que o número', 'Ver se a glicose sobe ou desce ajuda a prevenir picos e quedas.'),
    texto('04', 'O acompanhamento continua', 'O sensor ajuda, mas não substitui a orientação da equipe de saúde.'),
    cta('Mande para quem convive com diabetes', 'E siga para mais Como funciona:'),
], """
Como um sensor no braço acompanha a glicose o dia todo?

Um filamento fino sob a pele mede a glicose no líquido entre as células e manda uma leitura a cada poucos minutos para o celular. A curva ao longo do dia ajuda a prevenir picos e quedas.

Arraste para ver como funciona, e mande para quem convive com diabetes.

#ComoFunciona #Diabetes #DiaMundialDoDiabetes #SaúdeDigital """ + HASH, """
Ideia IG-006 do Plano de Publicações (prioridade A). Data sugerida: qui 12/11/2026, 12h (gancho: 14/11, Dia Mundial do Diabetes).
Dependências: revisão da Clínica. Não citar marcas de sensor.
Carrossel de 6 lâminas, até 25 palavras em cada.
""", 'feed')

pub('IG-001', 'Como funciona: o aparelho de tomografia', 'instagram', 'carrossel', 'ter 17/11/2026, 18h', 'dicas', 'educar', '_f7aNucnTuU', [
    capa('Como funciona', 'Como uma máquina vê dentro de você sem abrir nada?', 'A tomografia computadorizada, em quatro passos.'),
    texto('01', 'Raios X girando em volta do corpo', 'O tubo e os detectores giram juntos e medem quanto cada tecido absorve.'),
    texto('02', 'Muitos ângulos, uma fatia', 'O computador combina as medidas de vários ângulos e monta a imagem de uma fatia.'),
    texto('03', 'As fatias viram 3D', 'Empilhadas, as fatias formam uma imagem em três dimensões do corpo.'),
    texto('04', 'Osso claro, ar escuro', 'Quanto mais o tecido absorve os raios X, mais claro ele aparece.'),
    cta('Salve para lembrar no próximo exame', 'E siga para mais Como funciona:'),
], """
Como uma máquina vê dentro de você sem abrir nada?

Na tomografia, raios X giram em volta do corpo, os detectores medem quanto cada tecido absorve e o computador monta fatias, que empilhadas viram uma imagem em 3D.

Arraste para ver passo a passo, e salve para lembrar no próximo exame.

#ComoFunciona #Tomografia #EngenhariaBiomédica """ + HASH, """
Ideia IG-001 do Plano de Publicações (prioridade A). Data sugerida: ter 17/11/2026, 18h.
Dependências: revisão técnica.
Carrossel de 6 lâminas. Combina com o IG-003 (TC ou ressonância?), em 15/12.
""", 'feed')

pub('IG-009', 'Oxímetro e tom de pele', 'instagram', 'carrossel', 'qui 19/11/2026, 12h', 'dicas', 'educar', 'beXUIzvxW-Q', [
    capa('Mitos e dúvidas', 'O aparelho do seu dedo mede igual para todo mundo?', 'Oxímetros, tom de pele e viés em tecnologia.'),
    texto('01', 'Luz vermelha e infravermelha', 'O oxímetro mede quanto de cada luz atravessa o dedo para estimar o oxigênio do sangue.'),
    texto('02', 'A melanina também absorve luz', 'Estudos mostraram que alguns aparelhos superestimam o oxigênio em pessoas de pele escura.'),
    texto('03', 'Um número alto demais', 'Uma leitura superestimada pode atrasar o cuidado de quem precisa de oxigênio.'),
    texto('04', 'Testar com todo mundo', 'Validar dispositivos em pessoas de todos os tons de pele é parte de projetar bem.'),
    cta('Tecnologia justa se testa com todo mundo', 'Compartilhe com quem trabalha com saúde:'),
], """
O aparelho do seu dedo mede igual para todo mundo?

O oxímetro estima o oxigênio do sangue pela luz que atravessa o dedo. Como a melanina também absorve luz, estudos mostraram que alguns aparelhos superestimam o oxigênio em pessoas de pele escura, e isso pode atrasar o cuidado.

No mês da Consciência Negra, um lembrete para quem faz tecnologia: dispositivo bom é testado com todo mundo.

#ConsciênciaNegra #Oxímetro #ViésEmTecnologia """ + HASH, """
Ideia IG-009 do Plano de Publicações (prioridade A). Data sugerida: qui 19/11/2026, 12h (gancho: 20/11, Dia da Consciência Negra).
Dependências: revisão da Clínica; checar os estudos e citar a fonte na legenda ou no primeiro comentário (por exemplo, Sjoding et al., NEJM, 2020).
Carrossel de 6 lâminas.
""", 'feed')

pub('IG-011', 'Telepatia: o quão perto estamos?', 'instagram', 'carrossel', 'qui 26/11/2026, 12h', 'dicas', 'educar', 'ZnkHPagIOlM', [
    capa('Fronteira da ciência', 'O quão perto a humanidade já chegou da telepatia?', 'O que as interfaces cérebro-computador já fazem, e o que ainda é filme.'),
    texto('01', 'Ler sinais, não pensamentos', 'Interfaces cérebro-computador captam a atividade elétrica do cérebro, não ideias prontas.'),
    texto('02', 'Do sinal ao comando', 'Algoritmos aprendem a ligar padrões dessa atividade a intenções, como mover um cursor.'),
    texto('03', 'Já acontece em estudos', 'Pessoas com paralisia já escreveram textos e moveram braços robóticos em pesquisas clínicas.'),
    texto('04', 'Telepatia, ainda não', 'Mandar pensamentos de um cérebro a outro continua longe do que os filmes mostram.'),
    cta('E você, usaria uma?', 'Conte nos comentários e siga a NRO:'),
], """
O quão perto a humanidade já chegou da telepatia?

Interfaces cérebro-computador não leem pensamentos: elas captam sinais elétricos do cérebro e aprendem a ligar esses padrões a intenções. Em estudos clínicos, pessoas com paralisia já escreveram textos e moveram braços robóticos assim.

Telepatia de verdade? Ainda não. Arraste para entender a diferença.

E você, usaria uma? Conte nos comentários.

#FronteiraDaCiência #BCI #Neurotecnologia """ + HASH, """
Ideia IG-011 do Plano de Publicações (prioridade A), projeto Nebula; liga com a ideia 002 da NRO-MKT-005 (como funcionam as interfaces cérebro-máquina). Data sugerida: qui 26/11/2026, 12h.
Dependências: checar os estudos citados (fonte no primeiro comentário).
Carrossel de 6 lâminas, pensado para gerar comentários.
""", 'feed')

pub('IG-004', 'Como funciona: as próteses', 'instagram', 'carrossel', 'ter 01/12/2026, 18h', 'dicas', 'educar', 'sbVu5zitZt0', [
    capa('Como funciona', 'Como uma prótese entende o que você quer fazer?', 'As próteses mioelétricas, do músculo ao motor.'),
    texto('01', 'O músculo ainda fala', 'Mesmo após a amputação, os músculos do coto contraem quando a pessoa pensa no movimento.'),
    texto('02', 'Sensores escutam a contração', 'Eletrodos na pele captam esse sinal elétrico, a eletromiografia (EMG).'),
    texto('03', 'O motor responde', 'O controlador traduz o sinal em comandos: abrir, fechar, girar o punho.'),
    texto('04', 'Treino faz parte', 'Controlar bem a prótese leva tempo, com apoio de fisioterapia e terapia ocupacional.'),
    cta('Salve e compartilhe', 'Para mais engenharia que devolve autonomia:'),
], """
Como uma prótese entende o que você quer fazer?

Nas próteses mioelétricas, sensores na pele captam o sinal elétrico dos músculos do coto (a eletromiografia) e o controlador transforma esse sinal em movimento: abrir, fechar, girar.

Arraste para ver do músculo ao motor.

#ComoFunciona #Próteses #EMG #TecnologiaAssistiva """ + HASH, """
Ideia IG-004 do Plano de Publicações (prioridade A). Data sugerida: ter 01/12/2026, 18h.
Dependências: revisão técnica. A foto é a mão protética nova do banco de imagens.
Carrossel de 6 lâminas. Antecede o IG-029 (Stephen Hawking), em 03/12, Dia Internacional da Pessoa com Deficiência.
""", 'feed')

pub('IG-029', 'Como Stephen Hawking escrevia', 'instagram', 'carrossel', 'qui 03/12/2026, 12h', 'dicas', 'inspirar', 'G8EfpFaGBWM', [
    capa('Tecnologia assistiva', 'Como ele escrevia quase sem mover o corpo?', '3 de dezembro, Dia Internacional da Pessoa com Deficiência.'),
    texto('01', 'Um músculo da bochecha', 'Nos últimos anos, um sensor nos óculos detectava o movimento de um músculo do rosto.'),
    texto('02', 'Um cursor que percorre as letras', 'O programa varria letras e palavras na tela, e o gesto escolhia a certa.'),
    texto('03', 'Previsão de palavras', 'Um sistema de previsão sugeria as próximas palavras e acelerava a escrita.'),
    texto('04', 'Uma voz sintetizada', 'O texto pronto virava fala, na voz que ficou conhecida no mundo todo.'),
    cta('Engenharia para a autonomia', 'É o que move a NeuroDynamics:'),
], """
Como Stephen Hawking escrevia quase sem mover o corpo?

Nos últimos anos, um sensor nos óculos detectava o movimento de um músculo da bochecha. Com ele, Hawking escolhia letras e palavras numa tela, com ajuda de um sistema de previsão, e o texto virava a voz sintetizada que ficou famosa.

No Dia Internacional da Pessoa com Deficiência, um exemplo de engenharia a serviço da autonomia.

#DiaDaPessoaComDeficiência #TecnologiaAssistiva #Acessibilidade """ + HASH, """
Ideia IG-029 do Plano de Publicações (prioridade A), projeto Zéfiro. Data sugerida: qui 03/12/2026, 12h (gancho: 3/12, Dia Internacional da Pessoa com Deficiência).
Dependências: checar a fonte primária (o sistema ACAT da Intel e a descrição do sensor).
Carrossel de 6 lâminas. Combina com o LI-043 (projetar com pessoas com deficiência), no mesmo dia.
""", 'feed')

pub('IG-003', 'TC ou ressonância?', 'instagram', 'carrossel', 'ter 15/12/2026, 18h', 'dicas', 'educar', 'JkAxfH5ktpw', [
    capa('Mitos e dúvidas', 'Por que pediram um exame e não o outro?', 'Tomografia e ressonância, lado a lado.'),
    texto('01', 'A tomografia usa raios X', 'É rápida e ótima para ossos, sangramentos e emergências.'),
    texto('02', 'A ressonância usa ímã e ondas de rádio', 'Não usa radiação e mostra muito bem tecidos moles, como cérebro e ligamentos.'),
    texto('03', 'Tempo e conforto', 'A tomografia leva minutos; a ressonância costuma demorar mais e faz barulho.'),
    texto('04', 'Quem decide é a equipe', 'A escolha depende da pergunta clínica. Na dúvida, pergunte a quem pediu o exame.'),
    cta('Mande para quem vai fazer exame', 'E siga para mais Mitos e dúvidas:'),
], """
TC ou ressonância? Por que pediram um exame e não o outro?

A tomografia usa raios X: é rápida e ótima para ossos e emergências. A ressonância usa ímã e ondas de rádio, sem radiação, e mostra muito bem os tecidos moles. Quem escolhe é a equipe, pela pergunta que o exame precisa responder.

Arraste para comparar, e mande para quem vai fazer exame.

#MitosEDúvidas #Tomografia #Ressonância """ + HASH, """
Ideia IG-003 do Plano de Publicações (prioridade A). Data sugerida: ter 15/12/2026, 18h.
Dependências: revisão da Clínica. Sem orientação médica individual.
Carrossel de 6 lâminas. Fecha a sequência do IG-001 (TC, 17/11) e do IG-002 (Reel da ressonância, 08/12).
""", 'feed')

pub('IG-022', 'Copenhague, 1952', 'instagram', 'carrossel', 'qui 17/12/2026, 12h', 'dicas', 'inspirar', 'y5hQCIn1c6o', [
    capa('História surpreendente', 'Quando estudantes viraram ventiladores humanos', 'Copenhague, 1952: a epidemia que criou a terapia intensiva.'),
    texto('01', 'Uma epidemia de pólio', 'Em 1952, Copenhague recebeu centenas de pacientes com paralisia dos músculos da respiração.'),
    texto('02', 'Faltavam máquinas', 'Não havia pulmões de aço suficientes. A saída foi ventilar à mão, por uma traqueostomia.'),
    texto('03', 'Turnos de estudantes', 'Mais de mil estudantes de medicina e odontologia se revezaram apertando bolsas de ar.'),
    texto('04', 'Nasce a terapia intensiva', 'A experiência abriu caminho para as UTIs e a ventilação mecânica moderna.'),
    cta('Hoje, o desafio é outro', 'O projeto Opalina estuda como proteger o diafragma de quem está no ventilador:'),
], """
Quando estudantes viraram ventiladores humanos.

Na epidemia de pólio de 1952, em Copenhague, faltavam máquinas para tantos pacientes sem conseguir respirar. A solução foi ventilar à mão: estudantes de medicina e odontologia se revezaram, dia e noite, apertando bolsas de ar. Dali nasceu a terapia intensiva.

Marque um colega de saúde que precisa conhecer essa história.

#HistóriaDaMedicina #UTI #VentilaçãoMecânica """ + HASH, """
Ideia IG-022 do Plano de Publicações (prioridade A), projeto Opalina. Data sugerida: qui 17/12/2026, 12h.
Dependências: checar a fonte primária, sobretudo o número de estudantes e de pacientes (a lâmina 03 diz "mais de mil"; ajuste se a fonte disser outro número).
Carrossel de 6 lâminas. Prepara o Reel IG-032 (o diafragma no ventilador), em 22/12.
""", 'feed')

# ---------------- LinkedIn: documentos (3) ----------------
pub('LI-013', 'Qualidade em uma equipe universitária', 'linkedin', 'documento', 'ter 10/11/2026, 8h30', 'dicas', 'institucional', 'BuD00MfwvFY', [
    capa('Engenharia e qualidade', 'Qualidade não começa na certificação', 'Por que uma equipe universitária adota a disciplina de dispositivos médicos desde a graduação.'),
    texto('01', 'Requisitos antes do código', 'Cada função nasce de uma necessidade escrita e revisada, que depois vira teste.'),
    texto('02', 'Risco desde o primeiro esboço', 'Perguntamos o que pode dar errado antes de escolher a solução, como pede a ISO 14971.'),
    texto('03', 'Tudo rastreável', 'Decisões, versões e testes ficam registrados, para quem chegar depois entender o porquê.'),
    texto('04', 'Formação, não só entrega', 'Quem passa pela equipe aprende a trabalhar como a indústria de saúde trabalha.'),
    cta('Como sua equipe trata qualidade?', 'Conte nos comentários. Saiba mais em'),
], """
Qualidade não começa na certificação.

Na NeuroDynamics, uma equipe de P&D da Escola de Engenharia da UFMG, adotamos a disciplina de dispositivos médicos desde o primeiro protótipo: requisitos escritos e revisados, análise de risco antes da solução e rastreabilidade do requisito ao teste.

Não é burocracia. É o que permite que um projeto de graduação converse com hospitais e com a indústria, e que quem passa pela equipe saia sabendo trabalhar como a saúde exige.

Como a sua equipe trata qualidade nos projetos?

#DispositivosMédicos #Qualidade #ISO14971 #EngenhariaBiomédica #UFMG
""", """
Ideia LI-013 do Plano de Publicações (prioridade A), NRO geral. Data sugerida: ter 10/11/2026, 8h30.
Porta-voz sugerido: Matheus Marcondes.
Dependências: não afirmar certificação (a equipe segue as práticas, não é certificada).
Documento (PDF) de 6 páginas, 4:5.
""", 'documento')

pub('LI-002', 'Calima: sincronizar estímulo e pedalada', 'linkedin', 'documento', 'ter 24/11/2026, 8h30', 'projeto', 'institucional', 'zP7X_B86xOg', [
    capa('Calima, projeto em andamento', 'Sincronizar estímulo e pedalada', 'O problema de engenharia por trás do FES cycling, e a nossa aposta em sensores inerciais.'),
    texto('O problema', 'Cada músculo tem o seu momento', 'Estimular fora do ângulo certo do pedal desperdiça força e cansa o músculo mais rápido.'),
    texto('A abordagem', 'Sensores inerciais no lugar certo', 'Unidades inerciais (IMU) estimam a posição do pedal e o movimento em tempo real.'),
    texto('O desafio', 'Cada milissegundo conta', 'Entre medir, decidir e estimular, a latência define se o músculo contrai na hora certa.'),
    texto('Próximos passos', 'Da bancada aos testes', 'Validar a sincronia em bancada e, depois, com a equipe clínica parceira.'),
    cta('Quer conversar sobre FES?', 'Fale com a equipe:'),
], """
Sincronizar estímulo e pedalada: o problema de engenharia do projeto Calima.

No FES cycling, a eletroestimulação faz os músculos da perna pedalarem. Mas cada músculo tem o seu momento na volta do pedal: estimular fora dele desperdiça força e antecipa a fadiga.

No Calima, apostamos em sensores inerciais (IMU) para estimar a posição do pedal em tempo real, com a menor latência possível entre medir, decidir e estimular.

No documento, o problema, a abordagem e os próximos passos.

#FES #Reabilitação #EngenhariaBiomédica #SistemasEmbarcados #UFMG
""", """
Ideia LI-002 do Plano de Publicações (prioridade A), projeto Calima. Data sugerida: ter 24/11/2026, 8h30, no mesmo dia do Reel IG-033.
Porta-voz sugerido: Pedro Caversan.
Dependências: NRO-MKT-002; confirmar dados e o status do projeto antes de publicar (a página "Próximos passos" é uma proposta de texto).
Documento (PDF) de 6 páginas, 4:5.
""", 'documento')

pub('LI-015', 'Software também é dispositivo', 'linkedin', 'documento', 'ter 08/12/2026, 8h30', 'dicas', 'educar', 'oYzjGQ7LCVE', [
    capa('Engenharia e qualidade', 'Software também é dispositivo médico', 'O que a IEC 62304 pede de quem desenvolve software para a saúde.'),
    texto('01', 'Classe de segurança', 'O rigor depende do dano que uma falha pode causar: classes A, B e C.'),
    texto('02', 'Um ciclo de vida definido', 'Planejamento, requisitos, arquitetura, implementação, verificação e liberação, tudo documentado.'),
    texto('03', 'Problemas também têm processo', 'Defeitos achados depois da liberação são registrados, analisados e corrigidos com o mesmo cuidado.'),
    texto('04', 'Software de terceiros', 'Bibliotecas prontas (SOUP) entram na análise de risco, com versão e motivo de uso.'),
    cta('Desenvolve software para a saúde?', 'Vamos trocar experiências:'),
], """
Software também é dispositivo médico.

Quando o software participa do diagnóstico, do tratamento ou do monitoramento de alguém, ele precisa do mesmo rigor de um equipamento. A IEC 62304 organiza esse rigor: classes de segurança, um ciclo de vida definido, processo para problemas e atenção ao software de terceiros (SOUP).

No documento, os pontos que guiam o time de desenvolvimento da NeuroDynamics.

#IEC62304 #SoftwareMédico #DispositivosMédicos #Qualidade #UFMG
""", """
Ideia LI-015 do Plano de Publicações (prioridade A), NRO geral. Data sugerida: ter 08/12/2026, 8h30.
Porta-voz sugerido: time de desenvolvimento.
Dependências: revisão técnica.
Documento (PDF) de 6 páginas, 4:5.
""", 'documento')

json.dump(P, open(sys.argv[2], 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(len(P), 'propostas;', sum(1 for p in P if p['redes'] == ['instagram']), 'Instagram,', sum(1 for p in P if p['redes'] == ['linkedin']), 'LinkedIn,', sum(1 for p in P if p['formato'] == 'reels'), 'Reels')
