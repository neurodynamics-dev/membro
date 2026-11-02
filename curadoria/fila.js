/* ============================================================
   Curadoria de fotos · a fila
   Temas e fotos que a página mostra, nesta ordem de prioridade:
   primeiro o que a equipe selecionou (o: 'voce'), depois as
   sugestões, intercaladas por tema.

   Cada foto:
     f   banco: 'u' Unsplash, 'p' Pexels
     id  o código da foto no banco (o fim do endereço da página)
     t   o que a foto mostra, em português
     tema  uma chave de TEMAS
     a   autor, quando conhecido
     q   o termo de busca que trouxe a sugestão
     o   'voce' quando veio da seleção da equipe

   As sugestões vieram de buscas por estes termos nos bancos, em
   2 de novembro de 2026. Só entraram fotos de licença livre
   (Licença Unsplash e Licença Pexels); Unsplash+ ficou de fora.
   Confira a licença na página de cada foto antes de publicar.
   ============================================================ */
window.CURADORIA = {
  campanha: 'Fotografia da marca 2026',

  temas: {
    dispositivos: { nome: 'Dispositivos', fam: 'ion',
      titulo: 'Dispositivos que ajudam o cuidado a chegar às pessoas.',
      sub: 'Firmware, eletrônica e inteligência embarcada para dispositivos de grau médico.',
      termos: ['electrotherapy', 'electrical stimulation', 'medical device', 'pulse oximeter'] },
    sinais: { nome: 'Sinais e dados', fam: 'neuron',
      titulo: 'Do sinal fisiológico à conclusão defensável.',
      sub: 'Aquisição, processamento e interpretação de EEG, EMG, ECG e IMU.',
      termos: ['ecg monitor', 'vital signs monitor', 'heartbeat line', 'eeg'] },
    hospital: { nome: 'Ambiente hospitalar', fam: 'glia',
      titulo: 'Tecnologia pensada para a beira do leito.',
      sub: 'Da UTI à reabilitação, ao lado de quem cuida do paciente.',
      termos: ['hospital icu', 'intensive care unit', 'hospital corridor', 'operating room'] },
    cuidado: { nome: 'Cuidado e consulta', fam: 'retina',
      titulo: 'O cuidado acompanhado entre as consultas.',
      sub: 'Saúde digital que chega ao médico como informação pronta para agir.',
      termos: ['doctor patient tablet', 'telemedicine', 'chemotherapy infusion', 'oncology nurse'] },
    reabilitacao: { nome: 'Reabilitação', fam: 'ritmo',
      titulo: 'Reabilitação com os próprios músculos.',
      sub: 'Eletroestimulação, pedalada assistida e tecnologia assistiva.',
      termos: ['physical rehabilitation', 'physiotherapy', 'wheelchair', 'prosthetic leg', 'stationary bike'] },
    laboratorio: { nome: 'Laboratório', fam: 'nexo',
      titulo: 'Da bancada à clínica.',
      sub: 'Pesquisa traduzida em protótipos que funcionam e resultados mensuráveis.',
      termos: ['research laboratory', 'microscope', 'pipette', 'lab automation'] },
    eletronica: { nome: 'Eletrônica e prototipagem', fam: 'lumen',
      titulo: 'Código que vive perto do metal.',
      sub: 'Placas, firmware de tempo real e prototipagem no LABBIO.',
      termos: ['circuit board', 'soldering', 'oscilloscope', 'microcontroller', '3d printer'] },
    equipe: { nome: 'Equipe e desenvolvimento', fam: 'impulso',
      titulo: 'Projetos reais, prazos reais.',
      sub: 'O ritmo de uma empresa, dentro da universidade.',
      termos: ['software developers', 'team whiteboard', 'students laptop', 'coding'] },
    neuro: { nome: 'Cérebro e neurociência', fam: 'dendrito',
      titulo: 'Do sinal à decisão.',
      sub: 'Interfaces cérebro-máquina, neuromodulação e neurociência aplicada.',
      termos: ['human brain', 'brain model', 'neuroscience', 'brain scan'] },
    digital: { nome: 'Saúde digital e wearables', fam: 'plexo',
      titulo: 'Dados do dia a dia, resumidos para a clínica.',
      sub: 'Relógios, sensores e apps que conversam com o prontuário.',
      termos: ['smartwatch heart rate', 'wearable health', 'health app'] },
    abstrato: { nome: 'Abstrato', fam: 'iris',
      titulo: 'Sistemas inteligentes para a saúde humana.',
      sub: 'Iniciativa sem fins lucrativos de P&D em saúde, na Escola de Engenharia da UFMG.',
      termos: ['abstract light', 'neural network', 'cells'] }
  },

  fotos: [
    /* ---- a seleção da equipe ---------------------------------- */
    { f: 'u', id: '9xHsWmh3m_4', t: 'Braço robótico de laboratório em luz azul', tema: 'laboratorio', a: 'Testalize.me', o: 'voce' },
    { f: 'u', id: 'lQGJCMY5qcM', t: 'Três béqueres sobre a bancada', tema: 'laboratorio', o: 'voce' },
    { f: 'u', id: 'L7en7Lb-Ovc', t: 'Células em roxo', tema: 'abstrato', o: 'voce' },
    { f: 'u', id: 'y5hQCIn1c6o', t: 'Equipe cirúrgica no centro cirúrgico', tema: 'hospital', o: 'voce' },
    { f: 'u', id: 'ct10qdGv1hQ', t: 'Silhueta de pessoa ao microscópio', tema: 'laboratorio', o: 'voce' },
    { f: 'u', id: 'G8EfpFaGBWM', t: 'Mão segurando um tablet branco', tema: 'digital', o: 'voce' },
    { f: 'u', id: 'SVmaaACzcJ8', t: 'Pia de cerâmica com torneira de inox', tema: 'hospital', o: 'voce' },
    { f: 'u', id: '2fyeLhUeYpg', t: 'Agulhas de laboratório dispensando em frascos', tema: 'laboratorio', o: 'voce' },
    { f: 'u', id: 'h2RT2cl7mxA', t: 'Cirurgião se preparando para a operação', tema: 'hospital', o: 'voce' },
    { f: 'u', id: 'ii6BOPjAtVY', t: 'Cérebro humano sobre fundo preto', tema: 'neuro', o: 'voce' },
    { f: 'u', id: 'Kile7-U74s0', t: 'Feixes de luz azul e roxa formando uma cabeça', tema: 'abstrato', o: 'voce' },

    /* ---- dispositivos ----------------------------------------- */
    { f: 'u', id: 'mvHuY-t4QII', t: 'Eletroterapia aplicada no joelho', tema: 'dispositivos', a: 'Terry Shultz P.T.', q: 'electrotherapy' },
    { f: 'u', id: '-msTEzGwKJs', t: 'Oxímetro de pulso no dedo, fundo branco', tema: 'dispositivos', a: 'Mockup Graphics', q: 'pulse oximeter' },
    { f: 'u', id: 'wSTCaQpiLtc', t: 'Braço robótico sobre placa de circuito', tema: 'dispositivos', q: 'robotic arm' },

    /* ---- sinais e dados --------------------------------------- */
    { f: 'u', id: '0lrJo37r6Nk', t: 'Monitor com sinais vitais em verde', tema: 'sinais', a: 'Jair Lázaro', q: 'vital signs monitor' },
    { f: 'u', id: 'beXUIzvxW-Q', t: 'Tela de monitor com batimento cardíaco', tema: 'sinais', a: 'Joshua Chehov', q: 'ecg monitor' },
    { f: 'u', id: 'ZSo4axN3ZXI', t: 'Traçado de ECG na tela', tema: 'sinais', q: 'ecg monitor' },
    { f: 'u', id: 'oCSol-lBtVA', t: 'Batimento verde sobre fundo preto', tema: 'sinais', q: 'heartbeat line' },
    { f: 'u', id: '-iaHr12PVQg', t: 'Traçado de ECG impresso em papel', tema: 'sinais', q: 'heartbeat line' },
    { f: 'u', id: 'r427ZzVVbwU', t: 'Tela azul de osciloscópio', tema: 'sinais', a: 'Julio Gutierrez', q: 'oscilloscope' },

    /* ---- ambiente hospitalar ---------------------------------- */
    { f: 'u', id: 'J12RfFH-2ZE', t: 'Treinamento de UTI em simulação', tema: 'hospital', q: 'hospital icu' },
    { f: 'u', id: 'CjgwW0VR3d0', t: 'Quarto de hospital com leito e monitor', tema: 'hospital', a: 'Frederic Köberl', q: 'patient monitor' },
    { f: 'u', id: 'BvS7q4yFQt4', t: 'Monitor de ECG e saturação em simulação clínica', tema: 'hospital', a: 'Tim Cooper', q: 'patient monitor' },
    { f: 'u', id: '0Fv4M2hSZJU', t: 'Médico de jaleco olhando o monitor', tema: 'hospital', q: 'patient monitor' },
    { f: 'u', id: 'pfAnqlk3Oiw', t: 'Corredor vazio entre paredes brancas', tema: 'hospital', a: 'Dominik Kuhn', q: 'hospital corridor' },
    { f: 'u', id: '_f7aNucnTuU', t: 'Corredor longo com luz do sol', tema: 'hospital', a: 'Chris Wang', q: 'hospital corridor' },
    { f: 'u', id: 'ShJUYkshceY', t: 'Leito hospitalar vazio', tema: 'hospital', q: 'hospital bed' },
    { f: 'u', id: 'w7Pby5bDKW4', t: 'Leito hospitalar junto à parede branca', tema: 'hospital', q: 'hospital bed' },
    { f: 'p', id: '20897577', t: 'Paciente em UTI depois de cirurgia cardíaca', tema: 'hospital', a: 'Engin Akyurt', q: 'intensive care unit' },

    /* ---- cuidado e consulta ----------------------------------- */
    { f: 'u', id: 'X_tBkG0U9yM', t: 'Médica mostra exames de ressonância no tablet', tema: 'cuidado', a: 'Vitaly Gariev', q: 'doctor patient tablet' },
    { f: 'u', id: 'Wl3hAbxMF80', t: 'Médico analisa ressonância no tablet', tema: 'cuidado', a: 'Vitaly Gariev', q: 'brain scan' },
    { f: 'u', id: 'sLddRFha0_Q', t: 'Consulta médica por vídeo', tema: 'cuidado', a: 'Vitaly Gariev', q: 'telemedicine' },
    { f: 'u', id: '2kopEHjST-g', t: 'Dois médicos olhando um tablet', tema: 'cuidado', a: 'Vitaly Gariev', q: 'doctor patient tablet' },
    { f: 'u', id: 'bM4MXYPY61U', t: 'Paciente recebe quimioterapia pelo cateter', tema: 'cuidado', a: 'National Cancer Institute', q: 'chemotherapy infusion' },
    { f: 'u', id: 'LTFAllQyAb0', t: 'Sala de infusão de um centro oncológico', tema: 'cuidado', q: 'chemotherapy infusion' },
    { f: 'u', id: 'KMvoHcB-w5g', t: 'Frascos de quimioterapia e soro', tema: 'cuidado', q: 'chemotherapy infusion' },
    { f: 'u', id: 'tC4GCHCCMZg', t: 'Enfermeira prepara bolsas de quimioterapia (foto de 1989)', tema: 'cuidado', q: 'oncology nurse' },

    /* ---- reabilitação ----------------------------------------- */
    { f: 'u', id: 'V1xh8Rktjq0', t: 'Terapeuta acompanha paciente na hidroterapia', tema: 'reabilitacao', q: 'physical rehabilitation' },
    { f: 'u', id: 'Nt5eeIKH-1s', t: 'Fisioterapia nas costas', tema: 'reabilitacao', q: 'physiotherapy' },
    { f: 'u', id: 'OSpFXuGfj4U', t: 'Especialista aponta o modelo digital de uma órtese', tema: 'reabilitacao', a: 'Tom Claes', q: 'prosthetic' },
    { f: 'u', id: 'aX3fjxKrgTI', t: 'Corredor com prótese de perna', tema: 'reabilitacao', a: 'Vladyslav Tobolenko', q: 'prosthetic leg' },
    { f: 'u', id: '37pimNVWK7g', t: 'Oficina de próteses, por volta de 1958', tema: 'reabilitacao', a: 'Navy Medicine', q: 'prosthetic leg' },
    { f: 'u', id: 'D2CxpwtgSgQ', t: 'Mulher em cadeira de rodas em banheiro acessível', tema: 'reabilitacao', a: 'Centre for Ageing Better', q: 'wheelchair' },
    { f: 'u', id: 'MR2AtoPStf4', t: 'Feirante em cadeira de rodas', tema: 'reabilitacao', q: 'wheelchair' },
    { f: 'u', id: 'UlG-z-Kz_AI', t: 'Mulher em cadeira de rodas no parque', tema: 'reabilitacao', q: 'wheelchair' },
    { f: 'u', id: 'Xlp338P79do', t: 'Mulher em bicicleta ergométrica com tablet', tema: 'reabilitacao', q: 'stationary bike' },
    { f: 'u', id: 'qMQ1gvgMrd0', t: 'Bicicleta ergométrica branca e preta', tema: 'reabilitacao', q: 'stationary bike' },

    /* ---- laboratório ------------------------------------------ */
    { f: 'u', id: 'lgkareDEqKg', t: 'Pipeta enchendo microtubos', tema: 'laboratorio', a: 'Nathan Rimoux', q: 'pipette' },
    { f: 'u', id: 'cK0hjNSgnS4', t: 'Pesquisadora ao microscópio de dissecção', tema: 'laboratorio', a: 'NIAID', q: 'microscope' },
    { f: 'u', id: '1fvqUP-xaYQ', t: 'Pesquisadora prepara amostras para PCR', tema: 'laboratorio', a: 'National Cancer Institute', q: 'research laboratory' },
    { f: 'u', id: 'JxoWb7wHqnA', t: 'Cientista ao microscópio no laboratório', tema: 'laboratorio', q: 'microscope' },
    { f: 'u', id: 'cyhgWD1i_fA', t: 'Pesquisador de jaleco ao microscópio', tema: 'laboratorio', q: 'microscope' },
    { f: 'u', id: 'HPjTJ_w9Bls', t: 'Pesquisadora ao microscópio invertido', tema: 'laboratorio', a: 'National Cancer Institute', q: 'microscope' },
    { f: 'u', id: 'ZAtM1enV0KY', t: 'Microscópio eletrônico de transmissão', tema: 'laboratorio', a: 'National Cancer Institute', q: 'microscope' },
    { f: 'u', id: 'JlVqUaGW2A0', t: 'Análise de uma peça de metal ao microscópio', tema: 'laboratorio', a: 'Bermix Studio', q: 'microscope' },

    /* ---- eletrônica e prototipagem ---------------------------- */
    { f: 'u', id: 'Ky0B3cBJGKo', t: 'Bancada com osciloscópio e placa', tema: 'eletronica', a: 'Axel Richter', q: 'oscilloscope' },
    { f: 'u', id: 'zs4gtT8thO0', t: 'Pinça posiciona um microcontrolador RP2040', tema: 'eletronica', a: 'Vishnu Mohanan', q: 'microcontroller' },
    { f: 'u', id: 'O68LT-zCYFg', t: 'Ferro de solda sobre a protoboard', tema: 'eletronica', q: 'soldering' },
    { f: 'u', id: 'zP7X_B86xOg', t: 'Protoboard com sensores vista de cima', tema: 'eletronica', a: 'Robin Glauser', q: 'circuit board' },
    { f: 'u', id: 'g5f0BJq-FRs', t: 'Placa de circuito na oficina de eletrônica', tema: 'eletronica', a: 'Blaz Erzetic', q: 'circuit board' },
    { f: 'u', id: 'Px1eDMRm9xY', t: 'Impressora 3D imprimindo um modelo', tema: 'eletronica', a: 'Jakub Żerdzicki', q: '3d printer' },
    { f: 'u', id: 'G5XX7B__FeQ', t: 'Tablet com o progresso da impressão 3D', tema: 'eletronica', a: 'Jakub Żerdzicki', q: '3d printer' },
    { f: 'u', id: 'FED1QYdR1qI', t: 'Close de uma impressora 3D', tema: 'eletronica', q: '3d printer' },
    { f: 'u', id: 'omrpeqLz6Po', t: 'Estudante opera máquina em oficina de engenharia', tema: 'eletronica', a: 'ThisisEngineering', q: 'engineering workshop' },
    { f: 'p', id: '3861949', t: 'Engenheiros testando um protótipo eletrônico', tema: 'eletronica', a: 'ThisIsEngineering', q: 'electronics laboratory' },

    /* ---- equipe e desenvolvimento ----------------------------- */
    { f: 'u', id: 'Im_cQ6hQo10', t: 'Pessoas programando em monitores', tema: 'equipe', a: 'Compagnons', q: 'software developers' },
    { f: 'u', id: 'VTZ4PVhLFFg', t: 'Reunião de desenvolvedores diante da tela', tema: 'equipe', a: 'Mushvig Niftaliyev', q: 'software developers' },
    { f: 'u', id: 'N3Bf0ArT5J0', t: 'Equipe colaborando em notebooks', tema: 'equipe', a: 'Fiqih Alfarish', q: 'software developers' },
    { f: 'u', id: 'UThaHAc8wh0', t: 'Grupo em volta da mesa com notebooks', tema: 'equipe', q: 'software developers' },
    { f: 'u', id: 'ak4hmkNSU8g', t: 'Duas pessoas trabalhando em notebooks', tema: 'equipe', q: 'software developers' },
    { f: 'u', id: 'GXEcTqlZHno', t: 'Duas mulheres discutindo diante do notebook', tema: 'equipe', q: 'software developers' },
    { f: 'u', id: 'CdTQI-Nh7J4', t: 'Equipe ao redor do quadro branco', tema: 'equipe', a: 'Vitaly Gariev', q: 'team whiteboard' },
    { f: 'u', id: 'euNzbqwIIUI', t: 'Brainstorm com post-its no vidro', tema: 'equipe', a: 'Vitaly Gariev', q: 'team whiteboard' },
    { f: 'u', id: 'BuD00MfwvFY', t: 'Quadro branco com post-its', tema: 'equipe', a: 'Walls.io', q: 'team whiteboard' },
    { f: 'u', id: 'kp7qkHTgSKc', t: 'Estudantes em volta de um notebook', tema: 'equipe', a: 'Vitaly Gariev', q: 'students laptop' },
    { f: 'u', id: 'oYzjGQ7LCVE', t: 'Notebook e celular com código aberto', tema: 'equipe', a: 'Bayu Syaits', q: 'coding' },
    { f: 'u', id: 'm_HRfLhgABo', t: 'Notebook com código numa mesa movimentada', tema: 'equipe', q: 'coding' },

    /* ---- cérebro e neurociência ------------------------------- */
    { f: 'u', id: 'ZnkHPagIOlM', t: 'Cérebro humano gerado por computador', tema: 'neuro', a: 'Shawn Day', q: 'human brain' },
    { f: 'u', id: 'iuuWGXEC50U', t: 'Ilustração de cérebro', tema: 'neuro', a: 'Robina Weermeijer', q: 'human brain' },
    { f: 'u', id: 'vLfzJSGCU9c', t: 'Modelo plástico de cérebro humano', tema: 'neuro', a: 'Maxim Berg', q: 'brain model' },
    { f: 'u', id: 'JkAxfH5ktpw', t: 'Close de um modelo de cérebro', tema: 'neuro', q: 'brain model' },
    { f: 'u', id: 'tBZXYspGH_M', t: 'Desenhos anatômicos do cérebro', tema: 'neuro', q: 'neuroscience' },
    { f: 'u', id: 'gM6EKcjU-NU', t: 'Cérebro luminoso numa estrutura geométrica', tema: 'neuro', q: 'neuroscience' },
    { f: 'u', id: '16IN3v0V12M', t: 'Cérebro colorido com relevo', tema: 'neuro', q: 'human brain' },

    /* ---- saúde digital e wearables ---------------------------- */
    { f: 'u', id: 'BR8MqYyOPiU', t: 'Smartwatch medindo a frequência cardíaca', tema: 'digital', a: 'Nik', q: 'smartwatch heart rate' },
    { f: 'u', id: 'zIkV81RVwYY', t: 'Smartwatch redondo preto', tema: 'digital', a: 'Artur Łuczka', q: 'smartwatch heart rate' },
    { f: 'u', id: 'OPeSKKUMva4', t: 'Pessoa usando smartwatch redondo', tema: 'digital', q: 'smartwatch heart rate' },
    { f: 'u', id: '3uvS3ce7sk0', t: 'Close de smartwatch no pulso', tema: 'digital', q: 'wearable health' },
    { f: 'u', id: '_GKmPqRLHxo', t: 'Smartwatch com pulseira amarela', tema: 'digital', a: 'Sam Grozyan', q: 'wearable health' },

    /* ---- abstrato --------------------------------------------- */
    { f: 'u', id: '_jg8xh2SsXQ', t: 'Placa de circuito com um cérebro', tema: 'abstrato', q: 'neural network' }
  ]
};
