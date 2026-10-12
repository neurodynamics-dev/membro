-- ============================================================
-- SOMA 2.19.2: a semente do catálogo de Recursos
--
-- Popula a Biblioteca com 283 itens: os padrões da equipe (VS Code e Git
-- Bash, o selo NRO Standard), softwares (Figma, Altium, Fusion, SOLIDWORKS, Affinity, KiCad,
-- GitHub Desktop), a gravação de microcontroladores pelo VS Code (ESP32,
-- STM32, ATSAM, Raspberry Pi, Arduino), extensões do VS Code e do navegador, as
-- bases e ferramentas de pesquisa em saúde (PubMed, PEDro, CAPES, Zotero), os
-- licenças e descontos de estudante (GitHub Student Developer Pack, Autodesk,
-- Microsoft, Adobe e outras), ferramentas online (Miro, PlantUML, Overleaf),
-- cursos, livros e normas, repositórios da NSA e as ferramentas indicadas
-- pela equipe (para o Claude Code e outras).
--
-- Cada recurso traz o que faz e, nos softwares, como baixar e como começar.
-- Os itens marcados "Ainda não testada" ou "A confirmar" esperam alguém
-- que os conheça para completar.
--
-- Não repete: um recurso cujo endereço já existe fica como está (quem editou
-- no SOMA não perde nada). Depois da 2.19.2_recursos. Pode rodar de novo.
-- ============================================================
do $$
declare x jsonb; v_slug text; n integer; v_total integer := 0;
begin
  if to_regclass('public.recursos') is null then raise exception 'Aplique antes a 2.19.2_recursos.sql.'; end if;
  for x in select * from jsonb_array_elements($semente$
[
 {
  "nome": "Visual Studio Code",
  "url": "https://code.visualstudio.com",
  "publicador": "Microsoft",
  "tipo": "software",
  "funcao": "Editor de código e IDE padrão da equipe. Escrevemos firmware, scripts e documentação nele e gravamos placas por extensões (PlatformIO, ESP-IDF, STM32, Raspberry Pi Pico).",
  "instrucoes_baixar": "1. Abra code.visualstudio.com e baixe o instalador do seu sistema (no Windows, o \"User Installer\" não pede administrador).\n2. Instale. No Windows, deixe marcadas as opções \"Adicionar ao PATH\" e \"Abrir com Code\" no menu do botão direito.\n3. Abra o VS Code e entre com a conta do GitHub (ícone de pessoa, canto inferior esquerdo, \"Turn on Settings Sync\"): suas extensões e configurações vão com você.",
  "instrucoes_usar": "Extensões que a equipe usa (aba Extensions, Ctrl+Shift+X):\n- C/C++ (Microsoft), para firmware em C e C++\n- PlatformIO IDE, para compilar e gravar ESP32, STM32, SAM e outras placas\n- Cortex-Debug, para depurar ARM Cortex-M\n- Serial Monitor (Microsoft), para ler a porta serial\n- Python e Pylance, para scripts\n- GitHub Pull Requests, para revisar e abrir PRs sem sair do editor\n\nUse o Git Bash como terminal (Windows): abra as configurações (Ctrl+,), procure por \"default profile windows\" e escolha \"Git Bash\". Ou, em settings.json:\n`\"terminal.integrated.defaultProfile.windows\": \"Git Bash\"`\n\nAbra uma pasta de projeto com File > Open Folder, ou, no terminal, `code .` dentro da pasta. Ctrl+` abre o terminal; Ctrl+Shift+P abre a paleta de comandos, por onde passam quase todas as extensões.",
  "tags": [
   "IDE",
   "Editor",
   "Desenvolvimento",
   "VS Code"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": true
 },
 {
  "nome": "Git Bash (Git for Windows)",
  "url": "https://gitforwindows.org",
  "publicador": "Git for Windows",
  "tipo": "software",
  "funcao": "Controle de versão e o terminal Git Bash no Windows: é como a equipe usa git, ssh e comandos de Linux (ls, cat, grep) no Windows. No macOS e no Linux, o git já vem ou se instala pelo gerenciador de pacotes.",
  "instrucoes_baixar": "1. Abra gitforwindows.org e baixe o instalador (\"Download\").\n2. Execute o instalador. Nas telas, o que importa:\n- Editor padrão: escolha \"Visual Studio Code\".\n- Ajuste do PATH: \"Git from the command line and also from 3rd-party software\" (a opção recomendada).\n- Fim de linha: \"Checkout Windows-style, commit Unix-style\" (a opção padrão).\n- O resto pode ficar no padrão.\n3. Abra \"Git Bash\" pelo menu Iniciar para conferir: `git --version`.\nNo macOS: `xcode-select --install` ou `brew install git`. No Linux: `sudo apt install git`.",
  "instrucoes_usar": "Configure a sua identidade uma vez (use o e-mail do GitHub):\n`git config --global user.name \"Seu Nome\"`\n`git config --global user.email \"voce@ufmg.br\"`\n`git config --global init.defaultBranch main`\n`git config --global core.autocrlf true`\n\nCrie uma chave SSH e cadastre no GitHub (Settings > SSH and GPG keys > New SSH key):\n`ssh-keygen -t ed25519 -C \"voce@ufmg.br\"`\n`cat ~/.ssh/id_ed25519.pub`\n\nBaixe um repositório da equipe:\n`git clone git@github.com:neurodynamics-dev/NOME-DO-REPOSITORIO.git`\n\nO dia a dia, sempre numa branch própria:\n`git switch -c minha-mudanca`\n`git add .`\n`git commit -m \"Explique o que mudou\"`\n`git push -u origin minha-mudanca`\nDepois abra o Pull Request no GitHub. Para trazer o que os outros fizeram: `git pull`.\n\nDica: o VS Code usa o Git Bash como terminal (veja o item do VS Code).",
  "tags": [
   "Controle de versão",
   "Terminal",
   "Git",
   "Desenvolvimento"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": true
 },
 {
  "nome": "GitHub Desktop",
  "url": "https://desktop.github.com",
  "publicador": "GitHub",
  "tipo": "software",
  "funcao": "Aplicativo gráfico do GitHub para clonar repositórios, fazer commit e abrir pull request sem usar a linha de comando. Boa porta de entrada para quem ainda não conhece o Git.",
  "instrucoes_baixar": "1. Abra desktop.github.com e baixe o instalador.\n2. Instale e entre com a sua conta do GitHub (File > Options > Accounts, no Windows).\n3. Em \"Git\" nas opções, confira o nome e o e-mail que vão nos seus commits.",
  "instrucoes_usar": "- Clonar: File > Clone repository, escolha o repositório da lista (por exemplo, os da organização neurodynamics-dev).\n- Trabalhar: crie uma branch (Current branch > New branch), edite os arquivos no VS Code e volte ao GitHub Desktop: ele lista o que mudou.\n- Commit: escreva um resumo no campo \"Summary\" e clique em \"Commit to ...\".\n- Publicar: \"Push origin\". Depois, \"Create Pull Request\" abre a página do GitHub.\n- Para trazer o trabalho dos outros: \"Fetch origin\" e \"Pull origin\".",
  "tags": [
   "Controle de versão",
   "Git",
   "Desenvolvimento"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Figma",
  "url": "https://www.figma.com",
  "publicador": "Figma",
  "tipo": "software",
  "funcao": "Design de interfaces, protótipos e material gráfico, colaborativo e no navegador. Estudantes verificados têm o plano Education gratuito.",
  "instrucoes_baixar": "1. Use direto no navegador em figma.com, ou baixe o aplicativo em figma.com/downloads.\n2. Crie a conta com o e-mail @ufmg.br.",
  "instrucoes_usar": "Plano Education (gratuito): em figma.com/education, peça a verificação com o e-mail institucional e a comprovação de estudante. Depois de aprovado, o plano da sua conta passa a ser o Education.\nPara o trabalho da equipe, peça a um(a) responsável pelo time no Figma que adicione você ao projeto, e use sempre os componentes e as cores do manual da marca (brand.neurodynamics.dev).",
  "tags": [
   "Design",
   "Prototipagem",
   "Colaboração",
   "Estudante"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS"
  ],
  "acesso": [
   "freemium",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Altium Designer",
  "url": "https://www.altium.com/altium-designer",
  "publicador": "Altium",
  "tipo": "software",
  "funcao": "Projeto profissional de esquemáticos e placas de circuito impresso (PCB), com biblioteca de componentes e verificação de regras. Há licença para estudantes: confira as condições atuais na página da Altium.",
  "instrucoes_baixar": "1. Entre em altium.com e crie uma conta com o e-mail @ufmg.br.\n2. Procure a oferta para estudantes (\"Student\") e peça a licença educacional.\n3. Baixe o instalador pela sua conta e instale (Windows).",
  "instrucoes_usar": "O fluxo básico: criar o projeto (.PrjPcb), desenhar o esquemático (.SchDoc), importar para o layout (.PcbDoc), definir as regras de projeto, rotear e gerar os arquivos de fabricação (Gerber e furação). Para algo mais simples e gratuito, veja o KiCad.",
  "tags": [
   "PCB",
   "Eletrônica",
   "CAD",
   "Estudante"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "KiCad",
  "url": "https://www.kicad.org",
  "publicador": "KiCad",
  "tipo": "software",
  "funcao": "Projeto de esquemáticos e placas de circuito impresso (PCB), gratuito e de código aberto. Alternativa livre ao Altium para a maioria dos projetos da equipe.",
  "instrucoes_baixar": "1. Abra kicad.org/download e baixe o instalador do seu sistema.\n2. Instale com as opções padrão (inclui bibliotecas de símbolos, pegadas e modelos 3D).",
  "instrucoes_usar": "1. Crie um projeto: File > New Project.\n2. Desenhe o esquemático (Schematic Editor), anote e rode o ERC.\n3. Associe as pegadas e abra o editor de PCB (PCB Editor), defina o contorno, posicione e roteie.\n4. Rode o DRC e gere os arquivos de fabricação (File > Fabrication Outputs > Gerbers e Drill Files).",
  "tags": [
   "PCB",
   "Eletrônica",
   "CAD",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Autodesk Fusion",
  "url": "https://www.autodesk.com/products/fusion-360/overview",
  "publicador": "Autodesk",
  "tipo": "software",
  "funcao": "CAD, CAM e simulação em um só programa, para modelar peças mecânicas e gabinetes em 3D. Estudantes e docentes podem pedir licença educacional gratuita.",
  "instrucoes_baixar": "1. Crie a conta Autodesk com o e-mail @ufmg.br.\n2. Em autodesk.com/education, peça o acesso educacional ao Fusion e confirme que é estudante.\n3. Baixe o instalador pela sua conta e instale.",
  "instrucoes_usar": "Comece por um esboço (Sketch) com cotas, extrude (Extrude), e use a linha do tempo no rodapé para voltar e ajustar. Para impressão 3D, exporte em STL (botão direito no corpo > Save as Mesh). A licença educacional é renovada todo ano.",
  "tags": [
   "CAD",
   "Modelagem 3D",
   "Mecânica",
   "Estudante"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SOLIDWORKS",
  "url": "https://www.solidworks.com",
  "publicador": "Dassault Systèmes",
  "tipo": "software",
  "funcao": "CAD mecânico 3D para modelar peças, montagens e desenhos técnicos. Pago: confirme se a UFMG ou o LABBIO oferece licença acadêmica antes de qualquer compra.",
  "instrucoes_baixar": "Funciona somente no Windows. A instalação depende de licença: consulte quem administra as licenças acadêmicas (laboratório ou universidade) antes de baixar.",
  "instrucoes_usar": "O fluxo usual: esboço (Sketch) > recurso (Extrude, Revolve) > peça (.sldprt) > montagem (.sldasm) > desenho técnico (.slddrw). Exporte para impressão 3D em STL ou para troca com outros programas em STEP.",
  "tags": [
   "CAD",
   "Modelagem 3D",
   "Mecânica"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Affinity",
  "url": "https://affinity.serif.com",
  "publicador": "Canva (Serif)",
  "tipo": "software",
  "funcao": "Editor de imagens, vetores e diagramação: alternativa ao Photoshop, Illustrator e InDesign. Desde o fim de 2025 o aplicativo é oferecido gratuitamente com uma conta Canva (recursos de IA são pagos). Confira as condições atuais.",
  "instrucoes_baixar": "1. Abra affinity.serif.com e baixe o aplicativo para o seu sistema.\n2. Entre com uma conta Canva.",
  "instrucoes_usar": "Para peças da marca, siga o manual (brand.neurodynamics.dev): cores, tipografia e logos. Exporte em PNG para telas e em PDF para impressão.",
  "tags": [
   "Design",
   "Imagens",
   "Vetor",
   "Diagramação"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "HeyPCB",
  "url": "https://heypcb.com",
  "publicador": "HeyPCB",
  "tipo": "software",
  "funcao": "Ferramenta de projeto de placas de circuito impresso (PCB) citada pela equipe. Ainda não foi testada: quem a conhece pode completar esta descrição, as instruções e o link.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "PCB",
   "Eletrônica",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [],
  "padrao_nro": false
 },
 {
  "nome": "PlatformIO IDE",
  "url": "https://platformio.org",
  "publicador": "PlatformIO Labs",
  "tipo": "software",
  "funcao": "Extensão do VS Code que compila e grava microcontroladores (ESP32, STM32, SAM, Arduino e outros) com um arquivo de configuração só, o platformio.ini. É o caminho mais direto para gravar placas sem sair do VS Code.",
  "instrucoes_baixar": "1. No VS Code, abra Extensions (Ctrl+Shift+X), procure \"PlatformIO IDE\" e instale.\n2. Espere a instalação do núcleo terminar (alguns minutos na primeira vez) e recarregue o VS Code quando ele pedir.\n3. Um ícone de formiga aparece na barra lateral: é o PlatformIO.",
  "instrucoes_usar": "1. PlatformIO Home > New Project: dê um nome, escolha a placa (por exemplo, \"Espressif ESP32 Dev Module\" ou \"ST Nucleo F411RE\") e o framework (Arduino, ESP-IDF, STM32Cube...).\n2. A configuração fica em platformio.ini. Exemplo para ESP32:\n`[env:esp32dev]`\n`platform = espressif32`\n`board = esp32dev`\n`framework = arduino`\n`monitor_speed = 115200`\n3. Barra azul no rodapé do VS Code: o visto compila (Build), a seta grava (Upload), a tomada abre o monitor serial (Serial Monitor).\n4. Conecte a placa por USB antes de gravar. Se a porta não aparecer, instale o driver da ponte USB-serial (veja CP210x e CH340 neste catálogo).\n5. Para uma porta específica: `upload_port = COM5` (Windows) ou `/dev/ttyUSB0` (Linux) no platformio.ini.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "VS Code",
   "ESP32",
   "STM32",
   "ATSAM",
   "Arduino"
  ],
  "plataformas": [
   "VS Code",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Extensão Espressif IDF para VS Code",
  "url": "https://github.com/espressif/vscode-esp-idf-extension",
  "publicador": "Espressif",
  "tipo": "software",
  "funcao": "Extensão oficial da Espressif para programar, gravar e depurar ESP32 (e família) com o ESP-IDF dentro do VS Code.",
  "instrucoes_baixar": "1. No VS Code, instale a extensão \"Espressif IDF\" (Extensions, Ctrl+Shift+X).\n2. Rode o comando \"ESP-IDF: Configure ESP-IDF Extension\" (Ctrl+Shift+P) e escolha o modo \"Express\": ele baixa e configura o ESP-IDF, o Python e as ferramentas.\n3. Espere terminar. Na primeira vez demora.",
  "instrucoes_usar": "1. Abra a pasta do projeto (ou crie um com \"ESP-IDF: Show Examples Projects\").\n2. Escolha o chip: \"ESP-IDF: Set Espressif Device Target\" (esp32, esp32s3, esp32c3...).\n3. Escolha a porta: \"ESP-IDF: Select Port to Use (COM, tty, usbserial)\".\n4. Compile, grave e abra o monitor em um passo: \"ESP-IDF: Build, Flash and Monitor\" (ícone de chama na barra inferior).\n5. Para a configuração do projeto (Wi-Fi, partições, log): \"ESP-IDF: SDK Configuration Editor (menuconfig)\".\nSe a gravação falhar com \"Failed to connect\", segure o botão BOOT enquanto aperta e solta EN (reset) e tente de novo.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "VS Code",
   "ESP32",
   "ESP-IDF"
  ],
  "plataformas": [
   "VS Code",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "esptool",
  "url": "https://github.com/espressif/esptool",
  "publicador": "Espressif",
  "tipo": "software",
  "funcao": "Ferramenta de linha de comando da Espressif para gravar, apagar e inspecionar a flash de ESP32 e ESP8266. É o que as outras ferramentas usam por baixo.",
  "instrucoes_baixar": "Precisa do Python. No Git Bash ou no terminal:\n`pip install esptool`\nConfira: `esptool version` (nas versões mais antigas, `esptool.py version`).",
  "instrucoes_usar": "Descobrir o chip e a porta:\n`esptool chip_id`\nApagar tudo:\n`esptool --chip esp32 --port COM5 erase_flash`\nGravar um binário a partir do endereço 0x10000:\n`esptool --chip esp32 --port COM5 --baud 460800 write_flash 0x10000 firmware.bin`\nNo Linux a porta costuma ser `/dev/ttyUSB0` (e o seu usuário precisa estar no grupo dialout).\nSe não conectar: segure BOOT, aperte e solte EN, solte BOOT.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ESP32",
   "Linha de comando",
   "Python"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Arduino IDE 2",
  "url": "https://www.arduino.cc/en/software",
  "publicador": "Arduino",
  "tipo": "software",
  "funcao": "Ambiente oficial do Arduino para escrever e gravar sketches em placas Arduino e compatíveis (incluindo ESP32 e RP2040 com o pacote de placas certo). Bom para começar e para testes rápidos; para projetos maiores, usamos o VS Code.",
  "instrucoes_baixar": "1. Abra arduino.cc/en/software e baixe o Arduino IDE 2 para o seu sistema.\n2. Instale com as opções padrão (aceite os drivers).",
  "instrucoes_usar": "1. Conecte a placa por USB. Em Tools > Board, escolha a placa; em Tools > Port, a porta.\n2. Para ESP32: File > Preferences > \"Additional boards manager URLs\" e adicione a URL do pacote da Espressif; depois, em Boards Manager, instale \"esp32 by Espressif Systems\".\n3. O visto compila (Verify), a seta grava (Upload). O Serial Monitor está em Tools.\n4. Bibliotecas: Sketch > Include Library > Manage Libraries.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "Arduino",
   "ESP32",
   "Raspberry Pi"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "arduino-cli",
  "url": "https://github.com/arduino/arduino-cli",
  "publicador": "Arduino",
  "tipo": "software",
  "funcao": "O Arduino na linha de comando: instala pacotes de placas e bibliotecas, compila e grava sketches, bom para scripts e para a integração contínua.",
  "instrucoes_baixar": "Baixe o binário na página de releases do GitHub (arduino-cli_*_Windows_64bit.zip, por exemplo), descompacte e ponha a pasta no PATH. No macOS: `brew install arduino-cli`.",
  "instrucoes_usar": "`arduino-cli core update-index`\n`arduino-cli core install esp32:esp32`\n`arduino-cli board list` (mostra as placas e as portas)\n`arduino-cli compile --fqbn esp32:esp32:esp32 MeuSketch`\n`arduino-cli upload -p COM5 --fqbn esp32:esp32:esp32 MeuSketch`",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "Arduino",
   "Linha de comando",
   "ESP32"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "STM32CubeProgrammer",
  "url": "https://www.st.com/en/development-tools/stm32cubeprog.html",
  "publicador": "STMicroelectronics",
  "tipo": "software",
  "funcao": "Programa oficial da ST para gravar e apagar a flash dos STM32 por ST-LINK (SWD/JTAG), bootloader serial (UART) ou USB DFU. A forma mais segura de gravar um .bin, .hex ou .elf direto na placa.",
  "instrucoes_baixar": "1. Abra a página acima e baixe o instalador (a ST pede um cadastro gratuito para liberar o download).\n2. Instale. O instalador inclui os drivers do ST-LINK.",
  "instrucoes_usar": "1. Conecte a placa (Nucleo ou Discovery trazem o ST-LINK embutido; em placas próprias, use um ST-LINK externo em SWD).\n2. Escolha \"ST-LINK\" no canto superior direito e clique em \"Connect\".\n3. Aba \"Erasing & Programming\": escolha o arquivo (.hex, .bin ou .elf), marque \"Verify programming\" e \"Run after programming\" e clique em \"Start Programming\".\n4. Sem ST-LINK: ponha o chip em modo bootloader (pino BOOT0 em nível alto no reset) e conecte por USB (DFU) ou UART.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "STM32",
   "ST-LINK"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "STM32CubeIDE",
  "url": "https://www.st.com/en/development-tools/stm32cubeide.html",
  "publicador": "STMicroelectronics",
  "tipo": "software",
  "funcao": "IDE oficial da ST para STM32, com o configurador de pinos e clocks (CubeMX) embutido, compilador e depurador. Útil para gerar o projeto inicial.",
  "instrucoes_baixar": "Baixe na página da ST (cadastro gratuito) e instale com as opções padrão.",
  "instrucoes_usar": "File > New > STM32 Project > escolha a placa ou o chip > configure pinos e clocks na aba .ioc > Project > Generate Code. Para gravar e depurar, use o botão Run/Debug com o ST-LINK conectado. Quem prefere o VS Code usa a extensão da ST (item abaixo) ou o PlatformIO.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "STM32",
   "IDE"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "STM32Cube para Visual Studio Code",
  "url": "https://marketplace.visualstudio.com/items?itemName=STMicroelectronics.stm32-vscode-extension",
  "publicador": "STMicroelectronics",
  "tipo": "software",
  "funcao": "Conjunto de extensões da ST que leva o fluxo de projeto, compilação, gravação e depuração de STM32 para o VS Code, sem precisar do STM32CubeIDE.",
  "instrucoes_baixar": "1. No VS Code, instale a extensão \"STM32Cube for Visual Studio Code\" (ela instala as extensões auxiliares).\n2. Siga o assistente de instalação dos pacotes de ferramentas (CMake, compilador ARM e STM32CubeProgrammer).",
  "instrucoes_usar": "Abra ou importe um projeto STM32 (CMake), escolha o alvo de compilação (Build) e use as ações de Run e Debug da extensão com o ST-LINK conectado. Se algo não funcionar, o PlatformIO é a alternativa mais simples.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "VS Code",
   "STM32"
  ],
  "plataformas": [
   "VS Code",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenOCD",
  "url": "https://openocd.org",
  "publicador": "OpenOCD",
  "tipo": "software",
  "funcao": "Servidor de depuração e gravação por JTAG/SWD de código aberto: grava e depura STM32, SAM, RP2040 e muitos outros ARM com ST-LINK, CMSIS-DAP, J-Link e afins. É o que o Cortex-Debug e o PlatformIO usam por baixo.",
  "instrucoes_baixar": "Windows: baixe um pacote pronto (por exemplo, o do xPack OpenOCD ou o que vem com o PlatformIO). macOS: `brew install open-ocd`. Linux: `sudo apt install openocd`.",
  "instrucoes_usar": "Gravar um ELF em um STM32F4 com ST-LINK e sair:\n`openocd -f interface/stlink.cfg -f target/stm32f4x.cfg -c \"program build/firmware.elf verify reset exit\"`\nPara depurar, deixe o openocd rodando e conecte o GDB (ou o Cortex-Debug no VS Code) na porta 3333. Troque o arquivo do alvo conforme o chip (por exemplo, target/atsame5x.cfg, target/rp2040.cfg).",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "STM32",
   "ATSAM",
   "Raspberry Pi",
   "Depuração",
   "Linha de comando"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Cortex-Debug",
  "url": "https://github.com/Marus/cortex-debug",
  "publicador": "Marcel Ball",
  "tipo": "software",
  "funcao": "Extensão do VS Code para depurar microcontroladores ARM Cortex-M (STM32, SAM, RP2040...) com OpenOCD, J-Link, pyOCD ou ST-LINK: breakpoints, registradores, memória e SWO.",
  "instrucoes_baixar": "No VS Code, instale a extensão \"Cortex-Debug\". Tenha o arm-none-eabi-gdb e o OpenOCD (ou o servidor do seu depurador) instalados.",
  "instrucoes_usar": "Crie o arquivo .vscode/launch.json com uma configuração do tipo \"cortex-debug\", informando o executável (.elf), o servidor (\"openocd\") e o arquivo do alvo (por exemplo, \"configFiles\": [\"interface/stlink.cfg\", \"target/stm32f4x.cfg\"]). Aperte F5 para depurar.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "VS Code",
   "STM32",
   "ATSAM",
   "Depuração"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Microchip Studio",
  "url": "https://www.microchip.com/en-us/tools-resources/develop/microchip-studio",
  "publicador": "Microchip",
  "tipo": "software",
  "funcao": "IDE da Microchip (antigo Atmel Studio) para a família SAM e AVR: compila, grava e depura com o Atmel-ICE e outros programadores. Somente Windows.",
  "instrucoes_baixar": "Baixe na página da Microchip e instale (Windows). Instale também os drivers do programador que for usar.",
  "instrucoes_usar": "File > New > Project, escolha o chip (por exemplo, ATSAMD21G18A), compile (F7) e grave com Debug > Start Without Debugging, escolhendo a ferramenta (Atmel-ICE, EDBG da placa Xplained) em Project > Properties > Tool. Para quem prefere o VS Code, veja o MPLAB X e as extensões da Microchip.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ATSAM",
   "AVR",
   "IDE"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MPLAB X IDE",
  "url": "https://www.microchip.com/en-us/tools-resources/develop/mplab-x-ide",
  "publicador": "Microchip",
  "tipo": "software",
  "funcao": "IDE da Microchip para PIC, AVR e SAM, com o MPLAB Harmony e os programadores MPLAB ICD e PICkit. A Microchip também publica extensões do MPLAB para o VS Code.",
  "instrucoes_baixar": "Baixe o instalador na página da Microchip e instale junto com o compilador (XC32 para SAM; a versão gratuita atende estudos).",
  "instrucoes_usar": "File > New Project > escolha o chip e o programador > crie o projeto > compile e grave com Make and Program Device (ícone com seta para baixo). Para SAM, o MPLAB Code Configurator gera o código dos periféricos.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ATSAM",
   "PIC",
   "IDE"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "BOSSA (bossac)",
  "url": "https://github.com/shumatech/BOSSA",
  "publicador": "ShumaTech",
  "tipo": "software",
  "funcao": "Ferramenta de linha de comando e gráfica para gravar microcontroladores Atmel SAM pelo bootloader SAM-BA, sem programador externo: Arduino Due, Zero, MKR e placas SAMD21 compatíveis.",
  "instrucoes_baixar": "Use o bossac que vem com o pacote de placas do Arduino/PlatformIO, ou baixe um binário na página de releases do GitHub.",
  "instrucoes_usar": "Ponha a placa no bootloader (nas placas Arduino Zero/MKR, toque duas vezes no botão de reset) e rode:\n`bossac -p COM5 -e -w -v -b firmware.bin -R`\n(-e apaga, -w grava, -v verifica, -b inicia pela flash, -R reinicia).",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ATSAM",
   "Linha de comando"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Extensão Raspberry Pi Pico para VS Code",
  "url": "https://github.com/raspberrypi/pico-vscode",
  "publicador": "Raspberry Pi",
  "tipo": "software",
  "funcao": "Extensão oficial da Raspberry Pi para criar, compilar, gravar e depurar projetos do Pico, Pico W e Pico 2 (RP2040 e RP2350) em C/C++ dentro do VS Code.",
  "instrucoes_baixar": "1. No VS Code, instale a extensão \"Raspberry Pi Pico\".\n2. Ela baixa o SDK, o compilador e o picotool sozinha na primeira vez que você cria um projeto.",
  "instrucoes_usar": "1. Ctrl+Shift+P > \"Raspberry Pi Pico: New Pico Project\": escolha a placa, os recursos (I2C, SPI...) e a pasta.\n2. Compile com \"Compile Project\" (barra inferior).\n3. Para gravar: segure o botão BOOTSEL ao conectar o USB (a placa aparece como uma unidade de disco) e use \"Run Project (USB)\", ou arraste o arquivo .uf2 para a unidade.\n4. Para depurar, use uma segunda placa como sonda (Picoprobe) e a opção de depuração da extensão.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "VS Code",
   "Raspberry Pi",
   "RP2040"
  ],
  "plataformas": [
   "VS Code",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "picotool",
  "url": "https://github.com/raspberrypi/picotool",
  "publicador": "Raspberry Pi",
  "tipo": "software",
  "funcao": "Ferramenta de linha de comando da Raspberry Pi para inspecionar, carregar e reiniciar o Pico (RP2040 e RP2350) por USB.",
  "instrucoes_baixar": "Vem junto da extensão do Pico no VS Code. Para uso avulso, baixe o binário na página de releases do GitHub, ou `brew install picotool` no macOS.",
  "instrucoes_usar": "`picotool info` (informações do que está na placa)\n`picotool load -f aplicativo.uf2` (grava e força o reinício)\n`picotool reboot -f` (reinicia)\nCom a placa em BOOTSEL ou com o USB de aplicativo ativado.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "Raspberry Pi",
   "RP2040",
   "Linha de comando"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Raspberry Pi Imager",
  "url": "https://www.raspberrypi.com/software/",
  "publicador": "Raspberry Pi",
  "tipo": "software",
  "funcao": "Grava o sistema operacional (Raspberry Pi OS e outros) no cartão SD de uma Raspberry Pi 3, 4, 5 ou Zero, já com Wi-Fi, usuário e SSH configurados.",
  "instrucoes_baixar": "Baixe em raspberrypi.com/software e instale.",
  "instrucoes_usar": "1. Escolha o modelo da placa, o sistema (Raspberry Pi OS é o padrão) e o cartão SD.\n2. Em \"Editar configurações\", defina o nome do aparelho, o usuário e a senha, o Wi-Fi e ative o SSH.\n3. Grave, ponha o cartão na placa e ligue. Depois conecte por `ssh usuario@nome.local`.",
  "tags": [
   "Raspberry Pi",
   "Sistema operacional"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "probe-rs",
  "url": "https://probe.rs",
  "publicador": "probe-rs",
  "tipo": "software",
  "funcao": "Ferramenta em Rust para gravar, depurar e conversar com microcontroladores ARM e RISC-V por sondas ST-LINK, J-Link, CMSIS-DAP e outras. Aparece muito em projetos de firmware em Rust.",
  "instrucoes_baixar": "Siga as instruções de instalação em probe.rs (há um instalador de uma linha para cada sistema).",
  "instrucoes_usar": "`probe-rs list` (sondas conectadas)\n`probe-rs run --chip STM32F411RETx caminho/do/firmware.elf` (grava e mostra os logs)\n`probe-rs chip list` (chips aceitos)",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "STM32",
   "Raspberry Pi",
   "Depuração",
   "Linha de comando"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Driver CP210x (Silicon Labs)",
  "url": "https://www.silabs.com/developer-tools/usb-to-uart-bridge-vcp-drivers",
  "publicador": "Silicon Labs",
  "tipo": "software",
  "funcao": "Driver da ponte USB-serial CP210x, presente em muitas placas ESP32 e de desenvolvimento. Sem ele, a placa não aparece como porta COM no Windows.",
  "instrucoes_baixar": "Baixe o driver \"CP210x Universal Windows Driver\" na página da Silicon Labs, descompacte e instale (botão direito no .inf > Instalar).",
  "instrucoes_usar": "Conecte a placa e abra o Gerenciador de Dispositivos: em \"Portas (COM e LPT)\" deve aparecer \"Silicon Labs CP210x USB to UART Bridge (COMx)\". Use essa porta na gravação.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ESP32",
   "Driver"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Driver CH340 (WCH)",
  "url": "https://www.wch-ic.com/downloads/CH341SER_EXE.html",
  "publicador": "WCH",
  "tipo": "software",
  "funcao": "Driver da ponte USB-serial CH340, comum em placas ESP32, ESP8266 e Arduino compatíveis mais baratas. Sem ele, a placa não aparece como porta COM.",
  "instrucoes_baixar": "Baixe o instalador na página do fabricante e execute (clique em INSTALL).",
  "instrucoes_usar": "Conecte a placa: no Gerenciador de Dispositivos, \"Portas (COM e LPT)\" mostra \"USB-SERIAL CH340 (COMx)\". Use essa porta na gravação.",
  "tags": [
   "Gravação",
   "Microcontroladores",
   "ESP32",
   "Arduino",
   "Driver"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GitHub Student Developer Pack",
  "url": "https://education.github.com/pack",
  "publicador": "GitHub",
  "tipo": "beneficio",
  "funcao": "Pacote de ofertas gratuitas do GitHub para estudantes verificados: GitHub Copilot, créditos de nuvem, domínio, ferramentas de desenvolvimento e mais. É a porta de entrada para a maioria dos benefícios deste catálogo. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar: é um pedido de verificação.",
  "instrucoes_usar": "1. Entre em education.github.com/pack e clique em \"Get student benefits\" (ou vá direto a education.github.com/discount_requests/application).\n2. Entre com a sua conta do GitHub e adicione o e-mail @ufmg.br em Settings > Emails, confirmando pelo link que chega.\n3. Preencha o pedido: escolha a UFMG, confirme a localização e, se pedirem, anexe a comprovação de matrícula (declaração ou carteirinha).\n4. A resposta costuma chegar em alguns dias. A verificação vale por um período e precisa ser renovada.\n5. Depois de aprovado, cada oferta do pacote é resgatada na própria página do pacote.",
  "tags": [
   "Estudante",
   "GitHub",
   "Hospedagem",
   "Domínio",
   "Nuvem"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GitHub Copilot (para estudantes)",
  "url": "https://github.com/features/copilot",
  "publicador": "GitHub",
  "tipo": "beneficio",
  "funcao": "Assistente de programação com IA no VS Code e em outros editores. Estudantes verificados no GitHub Education recebem o plano Pro sem custo. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Instale a extensão \"GitHub Copilot\" no VS Code.",
  "instrucoes_usar": "1. Tenha o GitHub Student Developer Pack aprovado (item acima).\n2. Em github.com/settings/copilot, confira que o plano de estudante está ativo.\n3. No VS Code, entre com a mesma conta do GitHub. As sugestões aparecem enquanto você digita (Tab aceita) e o chat abre pelo ícone do Copilot.\nRevise sempre o que a IA escrever, principalmente em firmware e no que vai para produção.",
  "tags": [
   "Estudante",
   "IA",
   "GitHub",
   "VS Code"
  ],
  "plataformas": [
   "VS Code",
   "Web"
  ],
  "acesso": [
   "estudante",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GitHub Codespaces",
  "url": "https://github.com/features/codespaces",
  "publicador": "GitHub",
  "tipo": "servico",
  "funcao": "Ambiente de desenvolvimento na nuvem: o VS Code roda no navegador, com o repositório e as ferramentas já prontos. Contas Pro (como as de estudante) têm uma cota mensal maior que as gratuitas. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não precisa instalar: roda no navegador.",
  "instrucoes_usar": "No repositório, botão verde \"Code\" > aba \"Codespaces\" > \"Create codespace on main\". Pare o codespace quando terminar (ele consome a cota enquanto roda) e apague os que não usa mais.",
  "tags": [
   "Estudante",
   "GitHub",
   "Nuvem",
   "VS Code"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Microsoft Azure para Estudantes",
  "url": "https://azure.microsoft.com/free/students/",
  "publicador": "Microsoft",
  "tipo": "beneficio",
  "funcao": "Crédito em dólares para usar a nuvem da Microsoft, sem cartão de crédito, com o e-mail institucional. Serve para hospedar aplicações, bancos de dados e máquinas virtuais em projetos. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Abra a página, entre com o e-mail @ufmg.br e siga a verificação de estudante. O crédito dura um período e acaba: acompanhe o consumo no portal do Azure.",
  "tags": [
   "Estudante",
   "Nuvem",
   "Hospedagem"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DigitalOcean (crédito de estudante)",
  "url": "https://www.digitalocean.com/github-students",
  "publicador": "DigitalOcean",
  "tipo": "beneficio",
  "funcao": "Crédito para criar servidores virtuais (Droplets), bancos de dados e armazenamento, oferecido a quem tem o GitHub Student Developer Pack. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Resgate a oferta pela página do Student Developer Pack, ligando a conta do GitHub à da DigitalOcean. Defina um limite de gastos e desligue os servidores que não usar.",
  "tags": [
   "Estudante",
   "Hospedagem",
   "Nuvem"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Namecheap (domínio para estudantes)",
  "url": "https://nc.me",
  "publicador": "Namecheap",
  "tipo": "beneficio",
  "funcao": "Domínio .me gratuito por um ano e certificado SSL para estudantes com o GitHub Student Developer Pack. Dá para ter o próprio endereço do seu portfólio ou projeto. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Resgate pela página do Student Developer Pack, escolha o nome e aponte o domínio para o GitHub Pages (Settings > Pages > Custom domain) ou para o seu servidor. Anote a data de vencimento: depois do primeiro ano o domínio é pago.",
  "tags": [
   "Estudante",
   "Domínio",
   "Hospedagem"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Name.com (domínio para estudantes)",
  "url": "https://www.name.com/partner/github-students",
  "publicador": "Name.com",
  "tipo": "beneficio",
  "funcao": "Outra oferta de domínio do GitHub Student Developer Pack, com um ano gratuito de um domínio de uma lista de terminações. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Resgate pela página do Student Developer Pack e escolha o domínio entre as terminações elegíveis.",
  "tags": [
   "Estudante",
   "Domínio"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "JetBrains para estudantes",
  "url": "https://www.jetbrains.com/community/education/",
  "publicador": "JetBrains",
  "tipo": "beneficio",
  "funcao": "Licença educacional gratuita para as IDEs da JetBrains (CLion para C e C++ embarcado, PyCharm, IntelliJ e outras), para estudantes e docentes. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Instale o JetBrains Toolbox (jetbrains.com/toolbox-app) e, por ele, a IDE que quiser.",
  "instrucoes_usar": "Peça a licença em jetbrains.com/shop/eform/students com o e-mail @ufmg.br (ou pelo GitHub Student Developer Pack) e ative a conta na IDE. Para firmware, o CLion tem suporte a PlatformIO, ESP-IDF e STM32.",
  "tags": [
   "Estudante",
   "IDE",
   "Desenvolvimento"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MongoDB Atlas (crédito de estudante)",
  "url": "https://www.mongodb.com/students",
  "publicador": "MongoDB",
  "tipo": "beneficio",
  "funcao": "Crédito para usar bancos de dados MongoDB na nuvem e materiais de aprendizado, para estudantes. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Resgate pela página do Student Developer Pack ou em mongodb.com/students e crie o cluster pelo Atlas.",
  "tags": [
   "Estudante",
   "Banco de dados",
   "Nuvem"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Notion para Educação",
  "url": "https://www.notion.com/product/notion-for-education",
  "publicador": "Notion",
  "tipo": "beneficio",
  "funcao": "Plano pago do Notion (anotações, bases de dados e documentos) liberado gratuitamente para estudantes e docentes com e-mail educacional. As ofertas e as condições mudam: confira a página oficial antes de contar com elas.",
  "instrucoes_baixar": "Use no navegador ou baixe o aplicativo em notion.com/desktop.",
  "instrucoes_usar": "Crie a conta com o e-mail @ufmg.br e peça o plano de educação nas configurações do espaço de trabalho (Settings > Plans).",
  "tags": [
   "Estudante",
   "Documentos",
   "Colaboração"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS",
   "iOS",
   "Android"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Ghidra",
  "url": "https://github.com/NationalSecurityAgency/ghidra",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Framework de engenharia reversa de software da NSA, gratuito e de código aberto: desmonta e decompila binários (inclusive firmware de microcontroladores), com análise, scripts e depuração.",
  "instrucoes_baixar": "1. Instale o JDK exigido pela versão (a página do repositório informa; as versões recentes pedem o JDK 21).\n2. Baixe o .zip da última versão em \"Releases\" no GitHub e descompacte.\n3. Execute `ghidraRun` (Linux e macOS) ou `ghidraRun.bat` (Windows).",
  "instrucoes_usar": "1. File > New Project > Non-Shared Project.\n2. Importe o binário (File > Import File). Para firmware de microcontrolador, escolha o formato \"Raw Binary\" e a arquitetura (por exemplo, ARM Cortex, 32 bits, little endian), e informe o endereço base da flash.\n3. Abra no CodeBrowser e aceite a análise automática.\n4. Navegue pelo painel de funções, pelo desmontador e pelo decompilador (janela da direita).",
  "tags": [
   "NSA",
   "Código aberto",
   "Engenharia reversa",
   "Segurança",
   "Firmware",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Portal de código aberto da NSA",
  "url": "https://nationalsecurityagency.github.io",
  "publicador": "NSA (National Security Agency)",
  "tipo": "referencia",
  "funcao": "Vitrine dos projetos de código aberto publicados pela NSA no GitHub. Ponto de partida para achar outras ferramentas além das listadas aqui.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Código aberto",
   "Referência"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Emissary",
  "url": "https://github.com/NationalSecurityAgency/emissary",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Framework distribuído e ponto a ponto de fluxos de trabalho orientados a dados: encadeia etapas que processam grandes volumes de arquivos e mensagens.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Dados",
   "Java",
   "Ainda não testada"
  ],
  "plataformas": [
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DataWave",
  "url": "https://github.com/NationalSecurityAgency/datawave",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Framework de ingestão e consulta de dados sobre o Apache Accumulo, para indexar e buscar grandes bases de dados.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Dados",
   "Java",
   "Ainda não testada"
  ],
  "plataformas": [
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Timely",
  "url": "https://github.com/NationalSecurityAgency/timely",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Banco de dados de séries temporais sobre o Apache Accumulo, com coleta de métricas e consulta compatível com ferramentas de visualização.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Dados",
   "Séries temporais",
   "Java",
   "Ainda não testada"
  ],
  "plataformas": [
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "LemonGraph",
  "url": "https://github.com/NationalSecurityAgency/lemongraph",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Banco de dados de grafos transacional, baseado em log, com a biblioteca em Python, para guardar e consultar relações entre dados.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Dados",
   "Grafos",
   "Python",
   "Ainda não testada"
  ],
  "plataformas": [
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Skills Service (gamificação de microtreinamento)",
  "url": "https://github.com/NationalSecurityAgency/skills-service",
  "publicador": "NSA (National Security Agency)",
  "tipo": "repositorio",
  "funcao": "Plataforma de gamificação de microtreinamentos: define habilidades, pontos e níveis e acompanha o progresso de cada pessoa em um aplicativo. Poderia inspirar o acompanhamento de treinamentos da equipe.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "NSA",
   "Código aberto",
   "Treinamento",
   "Gamificação",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "VoiceStudio",
  "url": "https://github.com/debpalash/VoiceStudio",
  "publicador": "debpalash",
  "tipo": "repositorio",
  "funcao": "Alternativa de código aberto e totalmente local ao ElevenLabs: clona e cria vozes, dubla vídeos, faz ditado, transcreve e produz audiolivros em 646 idiomas, sem enviar nada para fora do computador.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Código aberto",
   "Ainda não testada",
   "Áudio",
   "Voz"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ppt-master",
  "url": "https://github.com/hugohe3/ppt-master",
  "publicador": "hugohe3",
  "tipo": "repositorio",
  "funcao": "Transforma documentos (PDF, Word) ou um tema em apresentações nativas do PowerPoint, editáveis, com formas, transições e animações nativas, gráficos e tabelas, e narração em áudio a partir das notas do apresentador.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Código aberto",
   "Ainda não testada",
   "Apresentações",
   "Documentos"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "gods-eye-view",
  "url": "https://github.com/bilawalsidhu/gods-eye-view",
  "publicador": "Bilawal Sidhu",
  "tipo": "repositorio",
  "funcao": "Simulador de satélite espião no navegador, que usa dados reais e abertos (aviões, barcos e câmeras) sobre um globo 3D fotorrealista.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "Código aberto",
   "Visualização",
   "Mapas",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "REA",
  "url": "https://github.com/morluto/rea",
  "publicador": "morluto",
  "tipo": "repositorio",
  "funcao": "Você ensina à sua IA uma função de outro aplicativo e ela explica como ela foi feita, sem precisar do código-fonte: engenharia reversa assistida por IA.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Código aberto",
   "Ainda não testada",
   "Engenharia reversa"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "diagram-design",
  "url": "https://github.com/cathrynlavery/diagram-design",
  "publicador": "Cathryn Lavery",
  "tipo": "repositorio",
  "funcao": "Você pede um diagrama com palavras e o assistente de código desenha com a sua marca: 44 tipos de diagrama, gerados como HTML e SVG autocontidos. Funciona com Claude Code, Codex, Copilot e Cursor.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Código aberto",
   "Ainda não testada",
   "Diagramas",
   "Design"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Paperclip",
  "url": "https://github.com/paperclipai/paperclip",
  "publicador": "Paperclip AI",
  "tipo": "repositorio",
  "funcao": "Aplicativo de código aberto para gerenciar agentes de IA como se fossem uma equipe: uma empresa de agentes autônomos trabalhando por você, com servidor, CLI e interface.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Código aberto",
   "Ainda não testada",
   "Agentes"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "skills, de Matt Pocock",
  "url": "https://github.com/mattpocock/skills",
  "publicador": "Matt Pocock",
  "tipo": "repositorio",
  "funcao": "Habilidades (skills) pequenas e fáceis de adaptar, do diretório .agents do autor, as que um engenheiro de verdade usa todo dia, para fazer o Claude Code trabalhar melhor.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Código aberto",
   "Ainda não testada",
   "Skills"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ECC (Everything Claude Code)",
  "url": "https://github.com/affaan-m/ECC",
  "publicador": "Affaan Mustafa",
  "tipo": "repositorio",
  "funcao": "Pacote de skills, memória e segurança para Claude Code, Codex, Cursor e OpenCode, para fazer o assistente de código trabalhar melhor.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Código aberto",
   "Ainda não testada",
   "Skills",
   "Segurança"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "andrej-karpathy-skills",
  "url": "https://github.com/multica-ai/andrej-karpathy-skills",
  "publicador": "Multica",
  "tipo": "repositorio",
  "funcao": "Um único arquivo CLAUDE.md com 4 regras tiradas do que Andrej Karpathy diz que os modelos fazem errado na programação, para melhorar o comportamento do Claude Code.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Código aberto",
   "Ainda não testada",
   "Skills"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "claude-mem",
  "url": "https://github.com/thedotmack/claude-mem",
  "publicador": "thedotmack",
  "tipo": "repositorio",
  "funcao": "Memória persistente entre sessões: guarda o que o agente fez, resume e passa para a próxima sessão, para o Claude Code não começar do zero.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Código aberto",
   "Ainda não testada",
   "Memória"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Arc Library",
  "url": "https://github.com/kuratlielia/arc-library",
  "publicador": "Elia Kuratli",
  "tipo": "repositorio",
  "funcao": "110 componentes e 22 blocos de interface em React, para Next.js e Vite, com animações suaves e de comportamento físico. Licença MIT; instala com a CLI do shadcn (`npx shadcn@latest add @uiarc/button`) ou copiando os arquivos.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "Interface",
   "React",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Anatomia de uma skill (wheresryan.sh)",
  "url": "https://skills.wheresryan.sh/anatomy",
  "publicador": "wheresryan",
  "tipo": "referencia",
  "funcao": "Página indicada pela equipe no site de skills de wheresryan. Foi salva sem leitura do conteúdo: quem a abrir, complete esta descrição.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "IA",
   "Claude Code",
   "Skills",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [],
  "padrao_nro": false
 },
 {
  "nome": "Post de @0xmovez no X",
  "url": "https://x.com/0xmovez/status/2104216919033192746",
  "publicador": "@0xmovez",
  "tipo": "referencia",
  "funcao": "Post no X indicado pela equipe. Foi salvo sem leitura do conteúdo: quem o abrir, resuma aqui o que ele traz e as ferramentas que cita.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "Referência",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [],
  "padrao_nro": false
 },
 {
  "nome": "Post de @brenzhills no X",
  "url": "https://x.com/brenzhills/status/2108983461230845978",
  "publicador": "@brenzhills",
  "tipo": "referencia",
  "funcao": "Post no X com uma lista de repositórios de ferramentas (VoiceStudio, ppt-master, gods-eye-view, REA, diagram-design, Paperclip, skills, ECC, andrej-karpathy-skills e claude-mem). Cada uma tem o seu item neste catálogo.",
  "instrucoes_baixar": null,
  "instrucoes_usar": null,
  "tags": [
   "Referência",
   "IA"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [],
  "padrao_nro": false
 },
 {
  "nome": "GitLens",
  "url": "https://marketplace.visualstudio.com/items?itemName=eamodio.gitlens",
  "publicador": "GitKraken",
  "tipo": "extensao",
  "funcao": "Mostra o Git dentro do editor: quem mudou cada linha e quando (blame), o histórico de cada arquivo e de cada linha, e permite explorar e comparar commits e branches. Os recursos básicos são gratuitos; alguns avançados dependem de plano.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"GitLens\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install eamodio.gitlens`",
  "instrucoes_usar": "- Em cada linha, uma nota discreta mostra quem escreveu, quando e o commit. Passe o mouse para ver o detalhe e abrir a mudança.\n- A barra lateral do GitLens tem as visões de Commits, Branches, Remotes, Stashes e Tags.\n- Clique com o botão direito num arquivo > \"Open File History\" para ver as versões, ou compare duas branches na visão de Branches.\nPara ver o grafo de branches de forma visual, use junto o Git Graph.",
  "tags": [
   "Extensão",
   "VS Code",
   "Git",
   "Controle de versão",
   "Visualização"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Git Graph",
  "url": "https://marketplace.visualstudio.com/items?itemName=mhutchie.git-graph",
  "publicador": "mhutchie",
  "tipo": "extensao",
  "funcao": "Mostra o repositório como um grafo: os commits, as branches e os merges desenhados, para entender de relance o que aconteceu e onde cada branch está. Dá para fazer checkout, merge, cherry-pick e criar branches com o clique do botão direito.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Git Graph\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install mhutchie.git-graph`",
  "instrucoes_usar": "1. Clique em \"Git Graph\" na barra de status (rodapé do VS Code), ou use o comando \"Git Graph: View Git Graph\".\n2. Cada linha é um commit; as cores e as linhas mostram as branches. Clique num commit para ver os arquivos que mudou.\n3. Botão direito num commit ou numa branch: Checkout, Merge, Cherry Pick, Create Branch...\nCombine com o GitLens: o Git Graph dá a visão geral, o GitLens dá o detalhe linha a linha.",
  "tags": [
   "Extensão",
   "VS Code",
   "Git",
   "Controle de versão",
   "Visualização"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Wokwi Simulator",
  "url": "https://marketplace.visualstudio.com/items?itemName=wokwi.wokwi-vscode",
  "publicador": "Wokwi",
  "tipo": "extensao",
  "funcao": "Simula ESP32, Arduino, Raspberry Pi Pico e STM32 dentro do VS Code, com LEDs, botões, displays e sensores virtuais, sem a placa na mão. Bom para testar o firmware antes de gravar. Pede uma licença gratuita de uso.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Wokwi Simulator\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install wokwi.wokwi-vscode`",
  "instrucoes_usar": "1. Crie, na pasta do projeto, o arquivo `wokwi.toml` apontando para o firmware compilado, e o `diagram.json` com os componentes e as ligações (dá para montar o diagrama no site wokwi.com e copiar).\n2. Compile o projeto (por exemplo, com o PlatformIO).\n3. Comando \"Wokwi: Start Simulator\" (Ctrl+Shift+P). Na primeira vez, peça a licença gratuita com \"Wokwi: Request a New License\".\n4. A simulação abre ao lado do código; o monitor serial aparece no terminal.",
  "tags": [
   "Extensão",
   "VS Code",
   "Microcontroladores",
   "Simulação",
   "ESP32",
   "Arduino",
   "Raspberry Pi"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Teleplot",
  "url": "https://marketplace.visualstudio.com/items?itemName=alexnesnes.teleplot",
  "publicador": "Alexandre Nesnas",
  "tipo": "extensao",
  "funcao": "Desenha gráficos em tempo real a partir do que a placa escreve na porta serial. Ideal para ver sinais (sensores, filtros, biossinais) enquanto o firmware roda, sem programa extra.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Teleplot\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install alexnesnes.teleplot`",
  "instrucoes_usar": "No firmware, escreva na serial uma linha por valor, no formato `>nome:valor` (uma linha por amostra). Exemplo em C: `printf(\">temperatura:%.2f\\n\", t);`\nAbra o Teleplot pela barra lateral, escolha a porta serial e a velocidade (baud) e conecte: cada nome vira uma curva. Para vários sinais, mande uma linha por sinal.",
  "tags": [
   "Extensão",
   "VS Code",
   "Microcontroladores",
   "Visualização",
   "Sinais biomédicos",
   "Depuração"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Draw.io Integration",
  "url": "https://marketplace.visualstudio.com/items?itemName=hediet.vscode-drawio",
  "publicador": "Henning Dieterichs",
  "tipo": "extensao",
  "funcao": "Edita diagramas do draw.io (.drawio) dentro do VS Code: fluxogramas, diagramas de blocos e de arquitetura, que ficam versionados junto do código.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Draw.io Integration\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install hediet.vscode-drawio`",
  "instrucoes_usar": "Crie um arquivo com a extensão `.drawio` (ou `.drawio.svg` / `.drawio.png`, que também aparecem como imagem nos READMEs) e abra: o editor do draw.io aparece. Salve como qualquer arquivo e faça commit no Git.",
  "tags": [
   "Extensão",
   "VS Code",
   "Diagramas",
   "Documentação"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Live Share",
  "url": "https://marketplace.visualstudio.com/items?itemName=ms-vsliveshare.vsliveshare",
  "publicador": "Microsoft",
  "tipo": "extensao",
  "funcao": "Edição e depuração colaborativas: você compartilha a sessão do seu VS Code e outra pessoa abre o mesmo projeto, vendo e editando junto, em tempo real.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Live Share\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install ms-vsliveshare.vsliveshare`",
  "instrucoes_usar": "1. Entre com a conta do GitHub ou da Microsoft quando o VS Code pedir.\n2. Clique em \"Live Share\" na barra de status e envie o link a quem vai participar.\n3. Quem recebe abre o link no VS Code. Você controla o que é compartilhado (somente leitura ou edição).",
  "tags": [
   "Extensão",
   "VS Code",
   "Colaboração"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Error Lens",
  "url": "https://marketplace.visualstudio.com/items?itemName=usernamehw.errorlens",
  "publicador": "Alexander",
  "tipo": "extensao",
  "funcao": "Mostra os erros e avisos do compilador e do linter na própria linha do código, em vez de só no painel de problemas.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Error Lens\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install usernamehw.errorlens`",
  "instrucoes_usar": "Instale e abra um arquivo com erro: a mensagem aparece à direita da linha. Dá para ajustar o que aparece em Settings > \"errorLens\".",
  "tags": [
   "Extensão",
   "VS Code",
   "Editor",
   "Depuração"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Todo Tree",
  "url": "https://marketplace.visualstudio.com/items?itemName=Gruntfuggly.todo-tree",
  "publicador": "Gruntfuggly",
  "tipo": "extensao",
  "funcao": "Reúne numa árvore todos os TODO, FIXME e outras marcações deixadas nos comentários do código, para a equipe não esquecer o que ficou pendente.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Todo Tree\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install Gruntfuggly.todo-tree`",
  "instrucoes_usar": "Escreva comentários como `// TODO: calibrar o ganho` ou `# FIXME: trata erro de leitura`. O ícone do Todo Tree na barra lateral lista tudo, por arquivo.",
  "tags": [
   "Extensão",
   "VS Code",
   "Editor",
   "Organização"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Remote - SSH",
  "url": "https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-ssh",
  "publicador": "Microsoft",
  "tipo": "extensao",
  "funcao": "Abre uma pasta de outro computador (como uma Raspberry Pi ou um servidor do laboratório) no VS Code, por SSH: você edita, compila e roda lá, como se fosse local.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Remote - SSH\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install ms-vscode-remote.remote-ssh`",
  "instrucoes_usar": "1. Tenha o SSH funcionando para a máquina (veja o item do Git Bash para criar a chave).\n2. Comando \"Remote-SSH: Connect to Host...\" e informe `usuario@endereco`.\n3. Abra a pasta pelo File > Open Folder. As extensões que você instalar rodam do lado remoto.",
  "tags": [
   "Extensão",
   "VS Code",
   "Raspberry Pi",
   "Linha de comando",
   "Servidores"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Markdown All in One",
  "url": "https://marketplace.visualstudio.com/items?itemName=yzhang.markdown-all-in-one",
  "publicador": "Yu Zhang",
  "tipo": "extensao",
  "funcao": "Ajuda a escrever Markdown (README, documentação): atalhos, pré-visualização, índice automático e listas.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Markdown All in One\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install yzhang.markdown-all-in-one`",
  "instrucoes_usar": "Abra um arquivo `.md` e use Ctrl+Shift+V para a pré-visualização. O comando \"Markdown All in One: Create Table of Contents\" gera o índice do documento.",
  "tags": [
   "Extensão",
   "VS Code",
   "Documentação",
   "Editor"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Serial Monitor",
  "url": "https://marketplace.visualstudio.com/items?itemName=ms-vscode.vscode-serial-monitor",
  "publicador": "Microsoft",
  "tipo": "extensao",
  "funcao": "Monitor da porta serial dentro do VS Code: ler o que a placa escreve e enviar comandos, sem outro programa.",
  "instrucoes_baixar": "No VS Code, abra Extensions (Ctrl+Shift+X), procure \"Serial Monitor\" e clique em Install. Ou abra a busca rápida (Ctrl+P) e rode:\n`ext install ms-vscode.vscode-serial-monitor`",
  "instrucoes_usar": "Abra o painel \"Serial Monitor\" (aba ao lado do Terminal), escolha a porta e a velocidade (baud rate) e clique em \"Start Monitoring\". Feche o monitor antes de gravar a placa, porque a porta é uma só.",
  "tags": [
   "Extensão",
   "VS Code",
   "Microcontroladores",
   "Depuração",
   "Gravação"
  ],
  "plataformas": [
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Zotero Connector",
  "url": "https://www.zotero.org/download/connectors",
  "publicador": "Zotero",
  "tipo": "extensao",
  "funcao": "Extensão de navegador que salva com um clique a referência (e o PDF, quando acessível) do artigo, livro ou página que você está vendo direto no Zotero, com os dados já preenchidos.",
  "instrucoes_baixar": "1. Instale o Zotero (veja o item Zotero).\n2. Abra zotero.org/download/connectors e instale a extensão do seu navegador (Chrome, Firefox, Edge ou Safari).\n3. Deixe o Zotero aberto no computador.",
  "instrucoes_usar": "Numa página de artigo (PubMed, SciELO, periódicos, Google Scholar), o ícone do Zotero muda conforme o tipo de item. Clique nele para salvar a referência na coleção que estiver aberta. Em páginas comuns, ele salva o endereço como \"página da web\".",
  "tags": [
   "Extensão",
   "Navegador",
   "Referências",
   "Pesquisa",
   "Citações"
  ],
  "plataformas": [
   "Chrome",
   "Firefox",
   "Edge",
   "Safari"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Unpaywall",
  "url": "https://unpaywall.org/products/extension",
  "publicador": "OurResearch",
  "tipo": "extensao",
  "funcao": "Extensão de navegador que avisa quando existe uma versão legal e gratuita do artigo que você está lendo (repositórios institucionais, preprints, acesso aberto) e leva direto ao texto.",
  "instrucoes_baixar": "Instale pela loja de extensões do Chrome ou do Firefox (a página acima tem os links).",
  "instrucoes_usar": "Ao abrir um artigo que tem DOI, uma abinha verde (cadeado aberto) aparece na lateral quando há versão gratuita legal: clique para abrir o PDF. Se for cinza, não há versão aberta conhecida; tente o Portal de Periódicos CAPES.",
  "tags": [
   "Extensão",
   "Navegador",
   "Pesquisa",
   "Acesso aberto",
   "Periódicos"
  ],
  "plataformas": [
   "Chrome",
   "Firefox"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Open Access Button",
  "url": "https://openaccessbutton.org",
  "publicador": "Open Access Button",
  "tipo": "extensao",
  "funcao": "Procura versões de acesso aberto de um artigo pelo DOI ou pelo título e, se não houver, ajuda a pedir o texto aos autores.",
  "instrucoes_baixar": "Use no site openaccessbutton.org ou instale a extensão pela loja do navegador.",
  "instrucoes_usar": "Cole o DOI, o título ou o endereço do artigo na busca. Se houver cópia aberta, ela aparece; se não, o serviço oferece pedir ao autor.",
  "tags": [
   "Extensão",
   "Navegador",
   "Pesquisa",
   "Acesso aberto",
   "Periódicos"
  ],
  "plataformas": [
   "Web",
   "Chrome",
   "Firefox"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Better BibTeX para Zotero",
  "url": "https://retorque.re/zotero-better-bibtex/",
  "publicador": "Emiliano Heyns",
  "tipo": "extensao",
  "funcao": "Complemento do Zotero para quem escreve em LaTeX: gera chaves de citação estáveis e mantém um arquivo .bib sempre atualizado com a sua biblioteca.",
  "instrucoes_baixar": "1. Baixe o arquivo .xpi na página do projeto.\n2. No Zotero: Tools > Plugins (ou Add-ons), clique na engrenagem > \"Install Plugin From File\" e escolha o arquivo.",
  "instrucoes_usar": "Clique com o botão direito numa coleção > \"Export Collection\" > \"Better BibTeX\" e marque \"Keep updated\": o .bib é atualizado quando a biblioteca muda. No LaTeX, cite com `\\cite{chave}`.",
  "tags": [
   "Extensão",
   "Referências",
   "LaTeX",
   "Citações"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PubMed",
  "url": "https://pubmed.ncbi.nlm.nih.gov",
  "publicador": "NIH / NLM",
  "tipo": "base",
  "funcao": "Base gratuita de literatura biomédica da Biblioteca Nacional de Medicina dos EUA, com mais de 35 milhões de referências (MEDLINE e outras). Ponto de partida para achar artigos em saúde, engenharia biomédica e reabilitação.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador. Para o texto completo de revistas pagas, entre pelo Portal de Periódicos CAPES (veja o item).",
  "instrucoes_usar": "1. Busque por termos; use o vocabulário controlado MeSH para resultados mais precisos, por exemplo: `(\"Stroke\"[MeSH Terms]) AND rehabilitation`\n2. Refine pelos filtros à esquerda (tipo de artigo: ensaio clínico, revisão sistemática; ano; texto completo gratuito).\n3. Salve referências com \"Save\" ou \"Send to\" (Clipboard, Citation manager). Com uma conta My NCBI dá para criar alertas de novas publicações para uma busca.\n4. Com o Zotero Connector, a referência vai direto para o Zotero.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Evidência clínica",
   "Periódicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PEDro",
  "url": "https://pedro.org.au",
  "publicador": "PEDro (Universidade de Sydney)",
  "tipo": "base",
  "funcao": "Base gratuita de evidências em fisioterapia: ensaios clínicos, revisões sistemáticas e diretrizes, cada ensaio com uma nota de qualidade metodológica (escala PEDro, de 0 a 10). Útil para projetos de reabilitação e dispositivos de apoio.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador (há interface em português).",
  "instrucoes_usar": "1. Use a \"Busca avançada\" para combinar o problema, a parte do corpo, o tipo de terapia e o método (ensaio clínico, revisão, diretriz).\n2. Ordene ou filtre pela nota PEDro: ensaios com nota alta têm melhor qualidade metodológica.\n3. Cada registro traz o resumo e, quando existir, o link para o texto completo.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Evidência clínica",
   "Reabilitação"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Portal de Periódicos CAPES",
  "url": "https://www.periodicos.capes.gov.br",
  "publicador": "CAPES",
  "tipo": "base",
  "funcao": "Acesso a texto completo de milhares de revistas científicas e bases de dados pagas (como Web of Science, Scopus, IEEE, ScienceDirect e outras), liberado a quem tem vínculo com instituições participantes, inclusive a UFMG.",
  "instrucoes_baixar": "Não há o que baixar. O acesso é pelo portal, com o login da universidade, de dentro ou de fora da rede da UFMG.",
  "instrucoes_usar": "1. Abra o portal e use \"Acesso CAFe\" (ou \"Meu espaço\").\n2. Escolha a instituição (UFMG) e entre com o login institucional.\n3. Busque no \"Acervo\" por título, assunto ou base. Os resultados trazem o link de acesso ao texto completo.\n4. Se um artigo pedir pagamento fora do portal, volte ao portal e busque o título por lá.\nConfira no site da biblioteca da UFMG as orientações atuais de acesso remoto.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "UFMG"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SciELO",
  "url": "https://www.scielo.org",
  "publicador": "SciELO",
  "tipo": "base",
  "funcao": "Biblioteca eletrônica de periódicos científicos de acesso aberto da América Latina, Portugal e Espanha. A melhor fonte para literatura científica em português, inclusive em saúde.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque em \"Pesquisa\" por assunto, autor ou revista; filtre por área (Ciências da Saúde, Engenharias) e idioma. Todos os textos são gratuitos, com PDF e HTML.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "Acesso aberto"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "BVS Saúde e LILACS",
  "url": "https://bvsalud.org",
  "publicador": "BIREME / OPAS",
  "tipo": "base",
  "funcao": "Portal da Biblioteca Virtual em Saúde, que reúne a LILACS (literatura científica da América Latina e Caribe em saúde), a MEDLINE e outras fontes, com interface em português.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque no campo principal; use os filtros à esquerda (base de dados, assunto principal, tipo de estudo, idioma). Os descritores DeCS (equivalentes ao MeSH, em português) melhoram a busca.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Evidência clínica",
   "Periódicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Europe PMC",
  "url": "https://europepmc.org",
  "publicador": "EMBL-EBI",
  "tipo": "base",
  "funcao": "Repositório e buscador gratuito de literatura em ciências da vida, com texto completo de acesso aberto, preprints e anotações de dados e de genes.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque como no PubMed e use o filtro \"Free full text\" para ver só o que dá para ler de graça. A busca também inclui preprints (bioRxiv, medRxiv).",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Acesso aberto",
   "Periódicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ClinicalTrials.gov",
  "url": "https://clinicaltrials.gov",
  "publicador": "NIH / NLM",
  "tipo": "base",
  "funcao": "Registro de ensaios clínicos feito no mundo todo, mantido pelos EUA: mostra o que está sendo testado, em que fase, com quem e com quais resultados. Serve para saber o que já foi feito antes de planejar um estudo.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque por condição, intervenção ou dispositivo e filtre por situação (recrutando, concluído) e país. Cada registro traz o protocolo e, quando houver, os resultados.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Evidência clínica",
   "Ensaios clínicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ReBEC (Registro Brasileiro de Ensaios Clínicos)",
  "url": "https://ensaiosclinicos.gov.br",
  "publicador": "Fiocruz / Ministério da Saúde",
  "tipo": "base",
  "funcao": "Plataforma brasileira de registro e consulta de ensaios clínicos. Pesquisas clínicas feitas no Brasil são registradas aqui, o que também é exigido por muitas revistas para publicar.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Para consultar, busque por condição ou intervenção. Para registrar um estudo, crie uma conta de pesquisador e siga o formulário (confira os prazos e as regras com o seu orientador e com o comitê de ética).",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Ensaios clínicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DOAJ (Directory of Open Access Journals)",
  "url": "https://doaj.org",
  "publicador": "DOAJ",
  "tipo": "base",
  "funcao": "Diretório de revistas científicas de acesso aberto avaliadas por critérios de qualidade. Ajuda a escolher onde publicar e a identificar revistas confiáveis.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque por revistas ou por artigos; filtre por assunto, país e idioma. Antes de enviar um trabalho a uma revista nova, confira se ela está no DOAJ.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "Acesso aberto"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Google Acadêmico",
  "url": "https://scholar.google.com",
  "publicador": "Google",
  "tipo": "base",
  "funcao": "Buscador de artigos, teses, livros e patentes de qualquer área, com contagem de citações e o botão para citar nos principais formatos.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque entre aspas para frases exatas. \"Citado por\" mostra quem usou o trabalho depois; \"Artigos relacionados\" amplia a busca. O botão de aspas (\") gera a citação (inclusive em BibTeX). Configure \"Links da biblioteca\" para a UFMG, se disponível, para ver o acesso institucional.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "Citações"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Semantic Scholar",
  "url": "https://www.semanticscholar.org",
  "publicador": "Allen Institute for AI",
  "tipo": "base",
  "funcao": "Buscador acadêmico gratuito com recursos de IA: resumos curtos de cada artigo, as citações mais influentes e artigos relacionados.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque por tema; use os filtros de área, ano e \"Has PDF\". O resumo curto (TLDR) ajuda a triar rápido. Crie uma conta para salvar bibliotecas e alertas.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "IA"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Lens.org",
  "url": "https://www.lens.org",
  "publicador": "Cambia",
  "tipo": "base",
  "funcao": "Busca unificada de artigos científicos e de patentes, ligando uma pesquisa à tecnologia patenteada. Útil para avaliar o estado da arte e a liberdade de operar em PD&I.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Escolha \"Scholarly Works\" ou \"Patents\"; combine termos e classificações; salve coleções e exporte os resultados (a conta gratuita permite várias exportações).",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Patentes",
   "Inovação"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Google Patents",
  "url": "https://patents.google.com",
  "publicador": "Google",
  "tipo": "base",
  "funcao": "Busca gratuita de patentes de vários países, com o texto, os desenhos, as citações e o estado jurídico. Ponto de partida para o estado da arte em dispositivos.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Busque por palavras-chave e refine por país, data e classificação (CPC). Abra uma patente para ver as reivindicações (claims), que definem o que é protegido.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Patentes",
   "Inovação"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "INPI: busca de patentes (Brasil)",
  "url": "https://busca.inpi.gov.br/pePI/",
  "publicador": "INPI",
  "tipo": "base",
  "funcao": "Base oficial do Instituto Nacional da Propriedade Industrial: consulta de patentes, marcas e programas de computador registrados no Brasil.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Entre como visitante, escolha \"Patente\", busque por palavras do título ou do resumo, ou pelo número do pedido. Para dúvidas de proteção da propriedade intelectual, consulte o núcleo de inovação da UFMG.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Patentes",
   "Inovação"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PhysioNet",
  "url": "https://physionet.org",
  "publicador": "MIT Laboratory for Computational Physiology",
  "tipo": "base",
  "funcao": "Repositório de bancos de dados abertos de sinais fisiológicos (ECG, EEG, sinais de UTI) e de softwares para analisá-los. Fonte de dados para testar algoritmos de biossinais sem coletar do zero.",
  "instrucoes_baixar": "Os dados e as ferramentas são baixados pelo site de cada projeto. Alguns conjuntos exigem cadastro e treinamento em ética de pesquisa antes de liberar o acesso.",
  "instrucoes_usar": "Procure em \"Data\" por tipo de sinal. Cada banco traz a descrição, a licença e o modo de acesso. A biblioteca WFDB (Python e C) lê os formatos usados.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Base de dados",
   "Sinais biomédicos",
   "Dados abertos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Plataforma Brasil",
  "url": "https://plataformabrasil.saude.gov.br",
  "publicador": "Ministério da Saúde (CEP/CONEP)",
  "tipo": "servico",
  "funcao": "Sistema nacional onde se registra e se submete à análise ética toda pesquisa com seres humanos feita no Brasil, pelos comitês de ética em pesquisa (CEP) e pela CONEP.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador, com cadastro.",
  "instrucoes_usar": "Pesquisas com participantes humanos (inclusive testes de dispositivos) precisam de aprovação do CEP antes de começar. Fale com o seu orientador e com o CEP da UFMG para saber a documentação (projeto, TCLE e outros) e os prazos.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Ética em pesquisa"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "EQUATOR Network",
  "url": "https://www.equator-network.org",
  "publicador": "EQUATOR Network",
  "tipo": "referencia",
  "funcao": "Biblioteca de diretrizes para relatar pesquisas em saúde (CONSORT para ensaios, STROBE para observacionais, PRISMA para revisões, STARD para testes diagnósticos e outras), com listas de verificação.",
  "instrucoes_baixar": "Não há o que baixar: acesse pelo navegador.",
  "instrucoes_usar": "Use \"Library for health research reporting\" para achar a diretriz do seu tipo de estudo e baixe a lista de verificação. Revistas pedem a diretriz seguida na submissão.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Evidência clínica",
   "Escrita científica"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PRISMA",
  "url": "https://www.prisma-statement.org",
  "publicador": "PRISMA",
  "tipo": "referencia",
  "funcao": "Diretriz e fluxograma para relatar revisões sistemáticas e meta-análises. Referência obrigatória para quem faz revisão sistemática.",
  "instrucoes_baixar": "Não há o que baixar: o site traz a lista de verificação e o diagrama de fluxo para uso.",
  "instrucoes_usar": "Use a lista de verificação (27 itens, na versão 2020) para escrever e conferir a revisão, e o diagrama de fluxo para mostrar quantos estudos foram encontrados, triados e incluídos.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Revisão sistemática",
   "Escrita científica"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Web of Science",
  "url": "https://www.webofscience.com",
  "publicador": "Clarivate",
  "tipo": "base",
  "funcao": "Base de dados de citações de artigos científicos, com métricas de periódicos. Acesso pago, liberado pelo Portal de Periódicos CAPES para a UFMG.",
  "instrucoes_baixar": "Acesse pelo Portal de Periódicos CAPES (login institucional), na lista de bases.",
  "instrucoes_usar": "Busque por tema, autor ou revista; ordene por citações para achar os trabalhos mais influentes e use \"Citation Report\" para ver o impacto.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "Citações"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Scopus",
  "url": "https://www.scopus.com",
  "publicador": "Elsevier",
  "tipo": "base",
  "funcao": "Base de dados de resumos e citações da Elsevier, com perfis de autores e métricas. Acesso pago, liberado pelo Portal de Periódicos CAPES para a UFMG.",
  "instrucoes_baixar": "Acesse pelo Portal de Periódicos CAPES (login institucional), na lista de bases.",
  "instrucoes_usar": "Busque por tema e refine por área, tipo de documento e ano; use as ferramentas de análise para ver tendências e autores.",
  "tags": [
   "Pesquisa",
   "Base de dados",
   "Periódicos",
   "Citações"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Zotero",
  "url": "https://www.zotero.org",
  "publicador": "Corporation for Digital Scholarship",
  "tipo": "software",
  "funcao": "Gerenciador de referências gratuito e de código aberto: guarda os artigos e os PDFs, organiza em coleções e insere citações e a lista de referências no Word, no LibreOffice e no Google Docs, em estilos como ABNT e Vancouver.",
  "instrucoes_baixar": "1. Baixe em zotero.org/download e instale.\n2. Instale também o Zotero Connector no navegador (veja o item).\n3. Crie uma conta gratuita no Zotero para sincronizar a biblioteca entre computadores (o armazenamento de arquivos é limitado no plano gratuito; as referências, não).",
  "instrucoes_usar": "- Salve referências com o Connector, ou arraste um PDF para o Zotero (ele lê os dados).\n- Estilos: Edit > Settings > Cite. Para ABNT, baixe o estilo em zotero.org/styles.\n- No Word ou no LibreOffice, a aba Zotero tem \"Add/Edit Citation\" e \"Add/Edit Bibliography\". No Google Docs, instale o conector pelo Zotero.\n- Trabalhos em grupo: crie uma \"Group Library\" para dividir referências com a equipe.",
  "tags": [
   "Pesquisa",
   "Referências",
   "Citações",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Mendeley Reference Manager",
  "url": "https://www.mendeley.com/reference-manager",
  "publicador": "Elsevier",
  "tipo": "software",
  "funcao": "Gerenciador de referências e leitor de PDF com anotações, da Elsevier. Alternativa ao Zotero para quem já usa o Mendeley.",
  "instrucoes_baixar": "Baixe em mendeley.com/reference-manager e entre com uma conta Mendeley ou Elsevier.",
  "instrucoes_usar": "Importe PDFs, anote, organize em pastas e use o Mendeley Cite no Word para inserir citações. O armazenamento gratuito é limitado.",
  "tags": [
   "Pesquisa",
   "Referências",
   "Citações"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux",
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Rayyan",
  "url": "https://www.rayyan.ai",
  "publicador": "Rayyan",
  "tipo": "servico",
  "funcao": "Ferramenta para triagem de artigos em revisões sistemáticas: duas pessoas decidem, de forma independente, o que incluir ou excluir, com sugestões por IA e controle de conflitos.",
  "instrucoes_baixar": "Não há o que baixar: use no navegador, com conta gratuita.",
  "instrucoes_usar": "Crie uma revisão, importe as referências (exportadas do PubMed, do Zotero ou de outras bases), convide quem vai triar, e cada pessoa marca \"Include\", \"Exclude\" ou \"Maybe\". No fim, resolva os conflitos e exporte.",
  "tags": [
   "Pesquisa",
   "Revisão sistemática",
   "Colaboração",
   "Evidência clínica"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Connected Papers",
  "url": "https://www.connectedpapers.com",
  "publicador": "Connected Papers",
  "tipo": "servico",
  "funcao": "Mostra um mapa visual de artigos relacionados a um trabalho de partida, para descobrir a literatura ao redor sem depender só de palavras-chave.",
  "instrucoes_baixar": "Não há o que baixar: use no navegador. O plano gratuito limita o número de grafos por mês.",
  "instrucoes_usar": "Cole o título, o DOI ou o endereço de um artigo-chave: o grafo agrupa trabalhos parecidos e mostra os mais citados e os mais recentes.",
  "tags": [
   "Pesquisa",
   "Visualização",
   "Periódicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ResearchRabbit",
  "url": "https://www.researchrabbit.ai",
  "publicador": "ResearchRabbit",
  "tipo": "servico",
  "funcao": "Descoberta de literatura por coleções: você monta uma coleção de artigos e a ferramenta sugere trabalhos parecidos, autores e redes de citação, com alertas.",
  "instrucoes_baixar": "Não há o que baixar: use no navegador, com conta.",
  "instrucoes_usar": "Importe artigos (do Zotero, por exemplo) numa coleção e explore \"Similar Work\", \"Earlier Work\" e \"Later Work\".",
  "tags": [
   "Pesquisa",
   "Visualização",
   "Periódicos"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "REDCap",
  "url": "https://projectredcap.org",
  "publicador": "REDCap Consortium (Vanderbilt)",
  "tipo": "software",
  "funcao": "Sistema web para coleta e gestão de dados de pesquisa: formulários, bancos de dados, questionários e acompanhamento de participantes, com controle de acesso e trilha de auditoria. Instalado e oferecido por instituições do consórcio.",
  "instrucoes_baixar": "O REDCap não é de uso direto: cada instituição o instala. Verifique se a UFMG, a Faculdade de Medicina ou o hospital universitário oferece uma instalação e como pedir acesso.",
  "instrucoes_usar": "Com acesso, crie um projeto, desenhe os formulários (instrumentos) e defina os eventos. Cuide dos dados pessoais conforme a LGPD e o que o comitê de ética aprovou.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Coleta de dados",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "3D Slicer",
  "url": "https://www.slicer.org",
  "publicador": "Slicer Community",
  "tipo": "software",
  "funcao": "Plataforma gratuita e de código aberto para visualizar, segmentar e analisar imagens médicas (tomografia, ressonância, ultrassom), inclusive para gerar modelos 3D de órgãos.",
  "instrucoes_baixar": "Baixe a versão estável em slicer.org e instale. Para recursos extras, use o \"Extension Manager\" dentro do programa.",
  "instrucoes_usar": "Carregue um exame (DICOM) pelo botão \"DICOM\" ou \"Add Data\", use o módulo \"Segment Editor\" para marcar as estruturas e exporte o modelo em STL para impressão 3D. Imagens reais de pacientes exigem autorização e anonimização.",
  "tags": [
   "Saúde",
   "Imagens médicas",
   "Código aberto",
   "Modelagem 3D"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Fiji (ImageJ)",
  "url": "https://imagej.net/software/fiji/",
  "publicador": "ImageJ / Fiji",
  "tipo": "software",
  "funcao": "Programa gratuito de análise de imagens científicas (microscopia, histologia, radiografias), com milhares de plugins e macros para medir, contar e processar.",
  "instrucoes_baixar": "Baixe o pacote em imagej.net/software/fiji, descompacte e execute (não precisa instalar).",
  "instrucoes_usar": "Abra uma imagem (File > Open), calibre a escala (Analyze > Set Scale), meça (Analyze > Measure) e use Process para filtros. Grave sequências de ações como macros para repetir em várias imagens.",
  "tags": [
   "Saúde",
   "Imagens médicas",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "NeuroKit2",
  "url": "https://github.com/neuropsychology/NeuroKit",
  "publicador": "neuropsychology",
  "tipo": "repositorio",
  "funcao": "Biblioteca em Python para processar biossinais (ECG, EEG, EMG, EDA, respiração, PPG): limpa, detecta picos e calcula medidas como a variabilidade da frequência cardíaca.",
  "instrucoes_baixar": "`pip install neurokit2`",
  "instrucoes_usar": "Simule um sinal e processe:\n`import neurokit2 as nk`\n`ecg = nk.ecg_simulate(duration=10, sampling_rate=250)`\n`sinais, info = nk.ecg_process(ecg, sampling_rate=250)`\n`nk.ecg_plot(sinais, info)`\nO repositório tem tutoriais para cada tipo de sinal.",
  "tags": [
   "Saúde",
   "Sinais biomédicos",
   "Python",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MNE-Python",
  "url": "https://github.com/mne-tools/mne-python",
  "publicador": "MNE",
  "tipo": "repositorio",
  "funcao": "Biblioteca em Python para analisar EEG e MEG: filtragem, remoção de artefatos, épocas, espectros e mapas topográficos.",
  "instrucoes_baixar": "`pip install mne`",
  "instrucoes_usar": "`import mne`\n`raw = mne.io.read_raw_edf(\"registro.edf\", preload=True)`\n`raw.filter(1, 40)`\n`raw.plot()`\nO site mne.tools tem tutoriais passo a passo e conjuntos de dados de exemplo.",
  "tags": [
   "Saúde",
   "Sinais biomédicos",
   "Python",
   "EEG",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "EEGLAB",
  "url": "https://sccn.ucsd.edu/eeglab/",
  "publicador": "Swartz Center for Computational Neuroscience",
  "tipo": "software",
  "funcao": "Caixa de ferramentas gratuita para MATLAB (e Octave) de análise de EEG: ICA para remover artefatos, análise tempo-frequência e visualização.",
  "instrucoes_baixar": "Baixe em sccn.ucsd.edu/eeglab, descompacte, adicione a pasta ao caminho do MATLAB e rode `eeglab`.",
  "instrucoes_usar": "File > Import data para carregar o registro; use Tools > Filter, Run ICA e Plot para limpar e inspecionar os sinais. Há tutoriais no site.",
  "tags": [
   "Saúde",
   "Sinais biomédicos",
   "EEG",
   "MATLAB"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "JASP",
  "url": "https://jasp-stats.org",
  "publicador": "JASP Team (Universidade de Amsterdã)",
  "tipo": "software",
  "funcao": "Programa de estatística gratuito e de código aberto, com interface gráfica parecida com o SPSS: testes t, ANOVA, regressão, correlações e estatística bayesiana, com a saída pronta para artigo.",
  "instrucoes_baixar": "Baixe o instalador em jasp-stats.org e instale.",
  "instrucoes_usar": "Abra um arquivo (CSV, planilha), escolha a análise na barra superior, arraste as variáveis e marque as opções. As tabelas e os gráficos podem ser copiados para o texto.",
  "tags": [
   "Pesquisa",
   "Estatística",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "jamovi",
  "url": "https://www.jamovi.org",
  "publicador": "jamovi",
  "tipo": "software",
  "funcao": "Programa de estatística gratuito e de código aberto, com planilha e análises em janelas, construído sobre o R. Alternativa ao SPSS.",
  "instrucoes_baixar": "Baixe o instalador em jamovi.org e instale.",
  "instrucoes_usar": "Abra os dados, use a aba Analyses (Exploration, T-Tests, ANOVA, Regression...) e arraste as variáveis. O resultado se atualiza ao mudar as opções.",
  "tags": [
   "Pesquisa",
   "Estatística",
   "Código aberto"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Microsoft 365 Education",
  "url": "https://www.microsoft.com/pt-br/education/products/office",
  "publicador": "Microsoft",
  "tipo": "beneficio",
  "funcao": "Word, Excel, PowerPoint, OneNote e Teams (web, e em alguns casos os aplicativos) liberados a estudantes de instituições elegíveis, só com o e-mail institucional. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "Não há o que baixar para a versão web. Se a sua conta tiver os aplicativos, o botão aparece em office.com.",
  "instrucoes_usar": "1. Abra office.com.\n2. Entre com o e-mail @ufmg.br. Se a conta for reconhecida, os aplicativos abrem.\n3. Se não for, procure o suporte de TI da UFMG.",
  "tags": [
   "Estudante",
   "Documentos",
   "Colaboração",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS",
   "iOS",
   "Android"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Google Gemini para estudantes",
  "url": "https://gemini.google/students/",
  "publicador": "Google",
  "tipo": "beneficio",
  "funcao": "Plano do assistente de IA do Google (modelos mais capazes, NotebookLM ampliado e armazenamento) oferecido por tempo limitado a estudantes verificados. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Abra a página e entre com a conta Google.\n2. Verifique-se como estudante com o e-mail @ufmg.br.",
  "tags": [
   "Estudante",
   "IA",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Cursor para estudantes",
  "url": "https://cursor.com/students",
  "publicador": "Anysphere",
  "tipo": "beneficio",
  "funcao": "Editor de código com IA (baseado no VS Code) com plano Pro gratuito por tempo limitado para estudantes verificados. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "Baixe em cursor.com e instale. Ele importa as extensões e configurações do VS Code.",
  "instrucoes_usar": "1. Abra cursor.com/students.\n2. Verifique-se como estudante com o e-mail @ufmg.br.\n3. Entre no editor com a mesma conta.",
  "tags": [
   "Estudante",
   "IA",
   "Editor",
   "Desenvolvimento",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Claude para Educação",
  "url": "https://www.anthropic.com/education",
  "publicador": "Anthropic",
  "tipo": "beneficio",
  "funcao": "Acesso ao Claude em programas educacionais, que dependem de acordo da universidade. Vale perguntar à UFMG se existe.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Pergunte à TI ou à biblioteca da UFMG se há acordo.\n2. Se houver, entre com o e-mail @ufmg.br.",
  "tags": [
   "Estudante",
   "IA",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Adobe Creative Cloud para estudantes",
  "url": "https://www.adobe.com/br/creativecloud/buy/students.html",
  "publicador": "Adobe",
  "tipo": "beneficio",
  "funcao": "Photoshop, Illustrator, Premiere, Acrobat e o resto do pacote da Adobe com desconto para estudantes. Pago, mas bem mais barato que o plano comum.",
  "instrucoes_baixar": "Instale o aplicativo Creative Cloud depois de assinar.",
  "instrucoes_usar": "1. Abra a página e escolha o plano para estudantes.\n2. Comprove o vínculo (e-mail @ufmg.br ou documento).\n3. Assine e instale.",
  "tags": [
   "Estudante",
   "Design",
   "Imagens",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Web"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Autodesk Education",
  "url": "https://www.autodesk.com/education/edu-software/overview",
  "publicador": "Autodesk",
  "tipo": "beneficio",
  "funcao": "Licenças educacionais gratuitas de AutoCAD, Inventor, Fusion, Revit, Maya, 3ds Max e outros softwares da Autodesk, para uso não comercial.",
  "instrucoes_baixar": "1. Crie a conta Autodesk e verifique-se como estudante.\n2. Em Produtos, baixe o programa.",
  "instrucoes_usar": "Entre com a conta Autodesk ao abrir. A licença educacional renova todo ano, enquanto você continuar estudante.",
  "tags": [
   "Estudante",
   "CAD",
   "Mecânica",
   "Modelagem 3D",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "gratis",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Onshape Education",
  "url": "https://www.onshape.com/en/education",
  "publicador": "PTC",
  "tipo": "beneficio",
  "funcao": "CAD 3D que roda no navegador, gratuito para estudantes e educadores. Bom para trabalhar em dupla: o projeto fica na nuvem, sem arquivos para trocar.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Crie a conta com o e-mail @ufmg.br e escolha o plano Education.\n2. Crie um documento e comece por um esboço (Sketch) em um plano.",
  "tags": [
   "Estudante",
   "CAD",
   "Mecânica",
   "Modelagem 3D",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Ansys Student",
  "url": "https://www.ansys.com/academic/students",
  "publicador": "Ansys",
  "tipo": "beneficio",
  "funcao": "Simulação por elementos finitos e dinâmica de fluidos, gratuita para estudantes, com limite no tamanho do modelo. Serve para estruturas, térmica e eletromagnetismo.",
  "instrucoes_baixar": "Baixe a versão Student na página, com a conta Ansys.",
  "instrucoes_usar": "Abra o Ansys Mechanical ou Discovery e use os tutoriais da página.",
  "tags": [
   "Estudante",
   "Simulação",
   "Mecânica",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MATLAB e Simulink",
  "url": "https://www.mathworks.com/academia/",
  "publicador": "MathWorks",
  "tipo": "software",
  "funcao": "Cálculo numérico, processamento de sinais, controle e Simulink. É a base de muito do que se faz com biossinais. Muitas universidades têm licença para todos; a versão Online dá algumas horas por mês de graça.",
  "instrucoes_baixar": "1. Crie a conta MathWorks com o e-mail @ufmg.br.\n2. Se a UFMG tiver licença, baixe pelo portal da conta. Senão, use o MATLAB Online (mathworks.com/products/matlab-online.html).",
  "instrucoes_usar": "Comece pelo MATLAB Onramp, o curso gratuito em matlabacademy.mathworks.com.",
  "tags": [
   "Estudante",
   "MATLAB",
   "Sinais biomédicos",
   "Simulação",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux",
   "Web"
  ],
  "acesso": [
   "pago",
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "LabVIEW Community Edition",
  "url": "https://www.ni.com/en/shop/labview/labview-community-edition.html",
  "publicador": "NI",
  "tipo": "software",
  "funcao": "Programação gráfica para instrumentação e aquisição de dados. A edição Community é gratuita para uso não comercial.",
  "instrucoes_baixar": "Baixe o instalador na página, com a conta NI.",
  "instrucoes_usar": "Abra o LabVIEW, crie um VI e ligue blocos no diagrama.",
  "tags": [
   "Instrumentação",
   "Coleta de dados",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Overleaf",
  "url": "https://www.overleaf.com",
  "publicador": "Overleaf",
  "tipo": "servico",
  "funcao": "Editor de LaTeX no navegador, com colaboração em tempo real e modelos de revistas e congressos. O plano gratuito basta para começar; algumas instituições dão o plano completo.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Crie a conta (use o e-mail @ufmg.br: pode liberar recursos extras).\n2. New Project > Templates e escolha o modelo da revista ou do congresso.\n3. Compartilhe pelo botão Share.",
  "tags": [
   "LaTeX",
   "Escrita científica",
   "Colaboração",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Miro",
  "url": "https://miro.com/education/",
  "publicador": "Miro",
  "tipo": "servico",
  "funcao": "Quadro branco colaborativo para mapas mentais, fluxos e brainstorms. O plano Education é gratuito para estudantes e educadores.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Peça o plano Education na página, com o e-mail @ufmg.br.\n2. Crie um quadro e convide a equipe pelo botão Share.",
  "tags": [
   "Estudante",
   "Colaboração",
   "Diagramas",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Excalidraw",
  "url": "https://excalidraw.com",
  "publicador": "Excalidraw",
  "tipo": "servico",
  "funcao": "Quadro de desenhos à mão livre, no navegador, sem conta. Bom para esboçar arquitetura e fluxos rapidamente e compartilhar por link.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Desenhe, e em Menu > Live collaboration gere um link para trabalhar junto.",
  "tags": [
   "Diagramas",
   "Colaboração",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "diagrams.net (draw.io)",
  "url": "https://www.drawio.com",
  "publicador": "JGraph",
  "tipo": "servico",
  "funcao": "Diagramas de fluxo, circuitos em blocos, UML e arquitetura, grátis, no navegador ou como aplicativo, salvando no Drive, GitHub ou no computador.",
  "instrucoes_baixar": "Use no navegador ou baixe o aplicativo em drawio.com.",
  "instrucoes_usar": "File > Save as e escolha onde guardar. No VS Code, a extensão Draw.io Integration abre arquivos .drawio.",
  "tags": [
   "Diagramas",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PlantUML",
  "url": "https://plantuml.com",
  "publicador": "PlantUML",
  "tipo": "software",
  "funcao": "Diagramas (sequência, classes, estados, atividades, componentes) escritos em texto e gerados por um comando. O texto vai no git, junto do código.",
  "instrucoes_baixar": "Online, sem instalar: plantuml.com/plantuml. Para usar offline, instale o Java e a extensão PlantUML do VS Code.",
  "instrucoes_usar": "Escreva por exemplo:\n`@startuml`\n`Alice -> Bob: Olá`\n`@enduml`\nE use Alt+D no VS Code para ver o diagrama.",
  "tags": [
   "Diagramas",
   "Documentação",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Mermaid",
  "url": "https://mermaid.js.org",
  "publicador": "Mermaid",
  "tipo": "software",
  "funcao": "Diagramas em texto (fluxogramas, sequência, Gantt) que o GitHub, o GitLab, o Notion e o Obsidian desenham sozinhos dentro de arquivos Markdown. Editor ao vivo em mermaid.live.",
  "instrucoes_baixar": "Não há o que instalar para usar no GitHub.",
  "instrucoes_usar": "Em um arquivo .md, escreva um bloco com ```mermaid e, dentro, por exemplo `graph LR; A-->B`.",
  "tags": [
   "Diagramas",
   "Documentação",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "D2",
  "url": "https://d2lang.com",
  "publicador": "Terrastruct",
  "tipo": "software",
  "funcao": "Linguagem de diagramas em texto, de aparência limpa, para arquitetura de sistemas.",
  "instrucoes_baixar": "Veja o comando de instalação em d2lang.com/tour/install.",
  "instrucoes_usar": "Escreva `a -> b` em um arquivo .d2 e rode `d2 arquivo.d2 saida.svg`.",
  "tags": [
   "Diagramas",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Graphviz",
  "url": "https://graphviz.org",
  "publicador": "Graphviz",
  "tipo": "software",
  "funcao": "Desenha grafos e fluxos a partir de texto na linguagem DOT. Clássico, serve também de motor para outras ferramentas.",
  "instrucoes_baixar": "Baixe em graphviz.org/download.",
  "instrucoes_usar": "Escreva `digraph { a -> b }` em um arquivo e rode `dot -Tpng arquivo.dot -o saida.png`.",
  "tags": [
   "Diagramas",
   "Grafos",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Obsidian",
  "url": "https://obsidian.md",
  "publicador": "Obsidian",
  "tipo": "software",
  "funcao": "Notas em Markdown guardadas como arquivos locais, ligadas entre si por links. Boa para o caderno de laboratório e para estudar. Gratuito para uso pessoal.",
  "instrucoes_baixar": "Baixe em obsidian.md.",
  "instrucoes_usar": "Crie um cofre (vault) numa pasta e escreva `[[nome da nota]]` para ligar notas.",
  "tags": [
   "Organização",
   "Documentação",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux",
   "iOS",
   "Android"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Typst",
  "url": "https://typst.app",
  "publicador": "Typst",
  "tipo": "software",
  "funcao": "Sistema de composição de documentos científicos, alternativa moderna ao LaTeX, com compilação instantânea e uma sintaxe bem mais simples.",
  "instrucoes_baixar": "Use no navegador em typst.app ou instale o programa de linha de comando.",
  "instrucoes_usar": "Crie um projeto, escreva `= Título` e o texto em seguida; o PDF atualiza enquanto você digita.",
  "tags": [
   "Escrita científica",
   "Documentos",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Pandoc",
  "url": "https://pandoc.org",
  "publicador": "John MacFarlane",
  "tipo": "software",
  "funcao": "Converte documentos entre formatos (Markdown, Word, PDF, HTML, LaTeX) por linha de comando. Útil para gerar o relatório em Word a partir do Markdown.",
  "instrucoes_baixar": "Baixe o instalador em pandoc.org/installing.html.",
  "instrucoes_usar": "Rode `pandoc relatorio.md -o relatorio.docx`.",
  "tags": [
   "Documentos",
   "Linha de comando",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Quarto",
  "url": "https://quarto.org",
  "publicador": "Posit",
  "tipo": "software",
  "funcao": "Documentos, artigos e apresentações que misturam texto, código (Python, R, Julia) e resultados. Bom para relatórios reproduzíveis.",
  "instrucoes_baixar": "Baixe em quarto.org/docs/get-started.",
  "instrucoes_usar": "Crie um arquivo .qmd e rode `quarto render arquivo.qmd`.",
  "tags": [
   "Documentos",
   "Escrita científica",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Jupyter",
  "url": "https://jupyter.org",
  "publicador": "Projeto Jupyter",
  "tipo": "software",
  "funcao": "Cadernos que juntam código, gráficos e texto. O ambiente padrão para analisar dados e sinais em Python. Roda também dentro do VS Code.",
  "instrucoes_baixar": "No terminal: `pip install jupyterlab`. No VS Code, instale a extensão Jupyter.",
  "instrucoes_usar": "Rode `jupyter lab`, ou abra um arquivo .ipynb no VS Code.",
  "tags": [
   "Python",
   "Dados",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Google Colab",
  "url": "https://colab.research.google.com",
  "publicador": "Google",
  "tipo": "servico",
  "funcao": "Cadernos Jupyter na nuvem, com GPU gratuita (com limites). Bom para treinar um modelo sem montar nada.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Entre com a conta Google, abra um caderno novo e, em Ambiente de execução, escolha uma GPU.",
  "tags": [
   "Python",
   "IA",
   "Dados",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Kaggle",
  "url": "https://www.kaggle.com",
  "publicador": "Kaggle",
  "tipo": "servico",
  "funcao": "Conjuntos de dados abertos, cadernos com GPU gratuita e cursos curtos de Python, pandas e aprendizado de máquina.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta, abra a aba Learn para os cursos e Datasets para procurar dados.",
  "tags": [
   "Dados",
   "IA",
   "Python",
   "Treinamento",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Hugging Face",
  "url": "https://huggingface.co",
  "publicador": "Hugging Face",
  "tipo": "servico",
  "funcao": "Repositório de modelos de IA, conjuntos de dados e demonstrações, com bibliotecas para usá-los em Python.",
  "instrucoes_baixar": "No terminal: `pip install transformers`.",
  "instrucoes_usar": "Procure o modelo na aba Models e copie o exemplo de código da página dele.",
  "tags": [
   "IA",
   "Python",
   "Dados",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "NotebookLM",
  "url": "https://notebooklm.google.com",
  "publicador": "Google",
  "tipo": "servico",
  "funcao": "Assistente que responde só com base nos documentos que você envia (artigos, relatórios), citando de onde tirou. Também gera resumos e áudios.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie um caderno, envie os PDFs e pergunte. Confira sempre a citação no texto original.",
  "tags": [
   "IA",
   "Pesquisa",
   "Documentos",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Elicit",
  "url": "https://elicit.com",
  "publicador": "Elicit",
  "tipo": "servico",
  "funcao": "Busca de artigos por pergunta e extração de dados de estudos em tabela. Ajuda a começar uma revisão, mas não a substitui.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Escreva a pergunta de pesquisa, escolha as colunas (população, intervenção, resultado) e confira cada linha no artigo.",
  "tags": [
   "IA",
   "Pesquisa",
   "Revisão sistemática",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Consensus",
  "url": "https://consensus.app",
  "publicador": "Consensus",
  "tipo": "servico",
  "funcao": "Mecanismo de busca que responde perguntas com o que os artigos científicos dizem, mostrando a quantidade de estudos a favor e contra.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Faça uma pergunta de sim ou não e leia os artigos citados antes de usar a resposta.",
  "tags": [
   "IA",
   "Pesquisa",
   "Evidência clínica",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Litmaps",
  "url": "https://www.litmaps.com",
  "publicador": "Litmaps",
  "tipo": "servico",
  "funcao": "Mapa de artigos e suas citações, com alertas de novos artigos sobre o tema. Bom para manter a literatura atualizada.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie um mapa a partir de um artigo (DOI ou título) e ative o alerta de novidades.",
  "tags": [
   "Pesquisa",
   "Visualização",
   "Referências",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "LanguageTool",
  "url": "https://languagetool.org",
  "publicador": "LanguageTool",
  "tipo": "extensao",
  "funcao": "Corretor de gramática e estilo em português do Brasil e em inglês, como extensão do navegador, do Word e do VS Code. Funciona sem enviar o texto a conta nenhuma no plano gratuito.",
  "instrucoes_baixar": "Instale a extensão pela loja do seu navegador, procurando por LanguageTool.",
  "instrucoes_usar": "Escreva em qualquer caixa de texto: os erros ficam sublinhados e a correção aparece ao clicar.",
  "tags": [
   "Escrita científica",
   "Navegador",
   "VS Code",
   "Ainda não testada"
  ],
  "plataformas": [
   "Chrome",
   "Firefox",
   "Edge",
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DeepL",
  "url": "https://www.deepl.com",
  "publicador": "DeepL",
  "tipo": "servico",
  "funcao": "Tradutor de textos e documentos, de qualidade alta, com plano gratuito. Bom para ler artigos fora do inglês e revisar o abstract.",
  "instrucoes_baixar": "Use no navegador ou instale o aplicativo.",
  "instrucoes_usar": "Cole o texto ou envie o arquivo. Revise a terminologia técnica.",
  "tags": [
   "Escrita científica",
   "Idiomas",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenAlex",
  "url": "https://openalex.org",
  "publicador": "OurResearch",
  "tipo": "base",
  "funcao": "Catálogo aberto e gratuito de artigos, autores, instituições e periódicos, com API. Alternativa aberta ao Scopus e ao Web of Science para estudos de literatura.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque em openalex.org ou use a API: `https://api.openalex.org/works?search=emg`.",
  "tags": [
   "Pesquisa",
   "Dados abertos",
   "Periódicos",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Crossref",
  "url": "https://www.crossref.org",
  "publicador": "Crossref",
  "tipo": "base",
  "funcao": "Registro de DOIs de artigos. Serve para achar o DOI de uma referência e conferir os metadados dela.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Cole a referência em search.crossref.org/references e copie o DOI.",
  "tags": [
   "Referências",
   "Pesquisa",
   "Dados abertos",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ORCID",
  "url": "https://orcid.org",
  "publicador": "ORCID",
  "tipo": "servico",
  "funcao": "Identificador único e permanente de pesquisador. Pede-se em quase toda submissão de artigo. Grátis, leva um minuto.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Crie o registro em orcid.org/register.\n2. Ligue-o ao seu currículo Lattes e aos artigos.",
  "tags": [
   "Pesquisa",
   "Referências",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Currículo Lattes",
  "url": "https://lattes.cnpq.br",
  "publicador": "CNPq",
  "tipo": "servico",
  "funcao": "O currículo acadêmico padrão do Brasil, exigido por bolsas, editais e programas de pós-graduação. Mantenha-o atualizado.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Entre na Plataforma Lattes com o CPF, preencha as seções e use o botão de atualizar a cada semestre.",
  "tags": [
   "Pesquisa",
   "Currículo",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "arXiv",
  "url": "https://arxiv.org",
  "publicador": "Cornell University",
  "tipo": "base",
  "funcao": "Repositório aberto de pré-publicações em física, matemática, computação e engenharia. Os artigos saem aqui antes de sair nas revistas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque por palavra-chave. Use as listas por categoria (eess.SP para processamento de sinais).",
  "tags": [
   "Pesquisa",
   "Acesso aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "bioRxiv",
  "url": "https://www.biorxiv.org",
  "publicador": "Cold Spring Harbor Laboratory",
  "tipo": "base",
  "funcao": "Pré-publicações em biologia e neurociência, gratuitas. Os artigos ainda não passaram por revisão, então leia com esse cuidado.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque por palavra-chave ou veja a seção de Neuroscience.",
  "tags": [
   "Pesquisa",
   "Acesso aberto",
   "Saúde",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "medRxiv",
  "url": "https://www.medrxiv.org",
  "publicador": "Cold Spring Harbor Laboratory, BMJ e Yale",
  "tipo": "base",
  "funcao": "Pré-publicações em ciências da saúde, gratuitas. Os textos ainda não foram revisados por pares e não devem guiar condutas clínicas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque por palavra-chave e confira se já saiu em revista (o site avisa).",
  "tags": [
   "Pesquisa",
   "Acesso aberto",
   "Saúde",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Zenodo",
  "url": "https://zenodo.org",
  "publicador": "CERN",
  "tipo": "servico",
  "funcao": "Repositório aberto para dados, códigos e relatórios, com DOI. Boa casa para os dados de um artigo e para versões do software.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Entre com o GitHub ou o ORCID.\n2. Envie os arquivos, preencha os metadados e publique para receber o DOI.",
  "tags": [
   "Dados abertos",
   "Pesquisa",
   "Acesso aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OSF (Open Science Framework)",
  "url": "https://osf.io",
  "publicador": "Center for Open Science",
  "tipo": "servico",
  "funcao": "Plataforma gratuita para pré-registrar o estudo, guardar materiais e dados e trabalhar em equipe com ciência aberta.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie o projeto, adicione colaboradores e, antes de coletar, use Registrations para pré-registrar a hipótese.",
  "tags": [
   "Pesquisa",
   "Dados abertos",
   "Colaboração",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "protocols.io",
  "url": "https://www.protocols.io",
  "publicador": "protocols.io",
  "tipo": "servico",
  "funcao": "Repositório de protocolos de laboratório, com versões, passos executáveis e DOI.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Procure o protocolo ou crie o seu e compartilhe com o grupo.",
  "tags": [
   "Pesquisa",
   "Documentação",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "BDTD: teses e dissertações",
  "url": "https://bdtd.ibict.br",
  "publicador": "IBICT",
  "tipo": "base",
  "funcao": "Biblioteca Digital Brasileira de Teses e Dissertações: busca nas teses das universidades brasileiras, inclusive da UFMG.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque por assunto e use o filtro por instituição e ano.",
  "tags": [
   "Pesquisa",
   "Periódicos",
   "Acesso aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Catálogo de Teses e Dissertações da CAPES",
  "url": "https://catalogodeteses.capes.gov.br",
  "publicador": "CAPES",
  "tipo": "base",
  "funcao": "Busca de teses e dissertações defendidas no Brasil, com resumo e link para o texto.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque por palavra-chave e filtre por área e instituição.",
  "tags": [
   "Pesquisa",
   "Periódicos",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "IEEE Xplore",
  "url": "https://ieeexplore.ieee.org",
  "publicador": "IEEE",
  "tipo": "base",
  "funcao": "Artigos, normas e congressos de engenharia elétrica, computação e engenharia biomédica (IEEE TBME, TNSRE e outros). O texto completo costuma ser liberado pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ScienceDirect",
  "url": "https://www.sciencedirect.com",
  "publicador": "Elsevier",
  "tipo": "base",
  "funcao": "Revistas e livros da Elsevier em engenharia, saúde e neurociência. Texto completo liberado pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SpringerLink",
  "url": "https://link.springer.com",
  "publicador": "Springer Nature",
  "tipo": "base",
  "funcao": "Artigos e livros da Springer, inclusive muitos e-books de engenharia e saúde. Texto completo pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ACM Digital Library",
  "url": "https://dl.acm.org",
  "publicador": "ACM",
  "tipo": "base",
  "funcao": "Artigos de computação, interação humano-computador e sistemas embarcados. Texto completo pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Wiley Online Library",
  "url": "https://onlinelibrary.wiley.com",
  "publicador": "Wiley",
  "tipo": "base",
  "funcao": "Revistas e livros em engenharia, saúde e ciências. Texto completo pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Nature",
  "url": "https://www.nature.com",
  "publicador": "Springer Nature",
  "tipo": "base",
  "funcao": "Nature e as revistas da família (Scientific Reports, Nature Neuroscience, Nature Biomedical Engineering). Parte aberta, parte pelo Portal CAPES.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "1. Abra o Portal de Periódicos da CAPES (periodicos.capes.gov.br) e entre pelo acesso CAFe, escolhendo a UFMG.\n2. Busque o artigo pelo Portal. Dentro da rede da UFMG o acesso também é automático.",
  "tags": [
   "Periódicos",
   "Pesquisa",
   "UFMG",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Cochrane Library",
  "url": "https://www.cochranelibrary.com",
  "publicador": "Cochrane",
  "tipo": "base",
  "funcao": "Revisões sistemáticas da Cochrane, o padrão de evidência em saúde. No Brasil o acesso costuma ser gratuito.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque pelo tema e abra o resumo em linguagem simples (Plain language summary).",
  "tags": [
   "Saúde",
   "Revisão sistemática",
   "Evidência clínica",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Physiopedia",
  "url": "https://www.physio-pedia.com",
  "publicador": "Physiopedia",
  "tipo": "referencia",
  "funcao": "Enciclopédia colaborativa de fisioterapia, com anatomia, avaliações, condições clínicas e testes. Texto de apoio, não substitui a literatura.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque a condição ou o teste (ex.: Timed Up and Go) e confira as referências do fim da página.",
  "tags": [
   "Saúde",
   "Reabilitação",
   "Referência",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Radiopaedia",
  "url": "https://radiopaedia.org",
  "publicador": "Radiopaedia",
  "tipo": "referencia",
  "funcao": "Casos e artigos de radiologia, com imagens de exames. Ajuda a entender imagens médicas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque pela região do corpo ou pela doença; os casos têm imagens para navegar.",
  "tags": [
   "Saúde",
   "Imagens médicas",
   "Referência",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Complete Anatomy",
  "url": "https://3d4medical.com",
  "publicador": "3D4Medical (Elsevier)",
  "tipo": "software",
  "funcao": "Atlas de anatomia humana em 3D, com camadas de músculos, ossos, nervos e vasos. Há desconto para estudantes.",
  "instrucoes_baixar": "Baixe o aplicativo pela loja do seu sistema.",
  "instrucoes_usar": "Gire o modelo, remova camadas e use as ferramentas de medição. Confira o preço de estudante no aplicativo.",
  "tags": [
   "Saúde",
   "Modelagem 3D",
   "Estudante",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "iOS",
   "Android"
  ],
  "acesso": [
   "pago",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Horos",
  "url": "https://horosproject.org",
  "publicador": "Horos Project",
  "tipo": "software",
  "funcao": "Visualizador gratuito de imagens médicas (DICOM) para macOS, de código aberto. No Windows e no Linux, veja o 3D Slicer.",
  "instrucoes_baixar": "Baixe em horosproject.org.",
  "instrucoes_usar": "Abra uma pasta de exame DICOM e use as ferramentas de janela e medida.",
  "tags": [
   "Imagens médicas",
   "Saúde",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "macOS"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MeSH (Medical Subject Headings)",
  "url": "https://www.ncbi.nlm.nih.gov/mesh",
  "publicador": "NLM",
  "tipo": "referencia",
  "funcao": "Vocabulário controlado da PubMed. Usar os termos MeSH torna a busca bem mais precisa. Em português, veja o DeCS.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque o termo, copie o nome oficial e use na PubMed como `\"termo\"[MeSH Terms]`.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Referência",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DeCS (Descritores em Ciências da Saúde)",
  "url": "https://decs.bvsalud.org",
  "publicador": "BIREME/OPAS",
  "tipo": "referencia",
  "funcao": "Vocabulário em português, inglês e espanhol para buscar na BVS e no LILACS. É o equivalente latino-americano do MeSH.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque o termo em português e copie o equivalente em inglês para a PubMed.",
  "tags": [
   "Saúde",
   "Pesquisa",
   "Referência",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "CIF (Classificação Internacional de Funcionalidade)",
  "url": "https://www.who.int/standards/classifications/international-classification-of-functioning-disability-and-health",
  "publicador": "OMS",
  "tipo": "referencia",
  "funcao": "Classificação da OMS para descrever funcionalidade, incapacidade e saúde. Base de linguagem comum em reabilitação e de muitos desfechos de estudos.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Use o navegador da CIF para achar o código do domínio (ex.: b730 força muscular) e citá-lo no protocolo.",
  "tags": [
   "Saúde",
   "Reabilitação",
   "Referência",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Anvisa: dispositivos médicos",
  "url": "https://www.gov.br/anvisa/pt-br",
  "publicador": "Anvisa",
  "tipo": "referencia",
  "funcao": "Regras brasileiras para registro, classificação e boas práticas de produtos médicos (RDCs). Quem desenvolve dispositivo para uso em saúde precisa conhecê-las antes de projetar.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque \"produtos para saúde\" no site e leia a norma de classificação de risco. Fale com o orientador antes de testar em pessoas.",
  "tags": [
   "Saúde",
   "Ética em pesquisa",
   "Referência",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ISO 13485 (qualidade de dispositivos médicos)",
  "url": "https://www.iso.org/standard/59752.html",
  "publicador": "ISO/IEC",
  "tipo": "referencia",
  "funcao": "Requisitos de sistema de gestão da qualidade para dispositivos médicos. Norma paga: a biblioteca da UFMG ou a ABNT podem ter acesso.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Leia a página para o escopo e peça o texto completo à biblioteca ou à ABNT.",
  "tags": [
   "Saúde",
   "Engenharia",
   "Normas",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "IEC 62304 (software de dispositivo médico)",
  "url": "https://www.iso.org/standard/38421.html",
  "publicador": "ISO/IEC",
  "tipo": "referencia",
  "funcao": "Ciclo de vida do software de dispositivos médicos: planejamento, requisitos, testes e manutenção, por classe de segurança. Norma paga: a biblioteca da UFMG ou a ABNT podem ter acesso.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Leia a página para o escopo e peça o texto completo à biblioteca ou à ABNT.",
  "tags": [
   "Saúde",
   "Engenharia",
   "Normas",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "ISO 14971 (gestão de risco)",
  "url": "https://www.iso.org/standard/72704.html",
  "publicador": "ISO/IEC",
  "tipo": "referencia",
  "funcao": "Gestão de risco de dispositivos médicos: identificar perigos, estimar risco e controlá-lo. Norma paga: a biblioteca da UFMG ou a ABNT podem ter acesso.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Leia a página para o escopo e peça o texto completo à biblioteca ou à ABNT.",
  "tags": [
   "Saúde",
   "Engenharia",
   "Normas",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Keil MDK (Community)",
  "url": "https://www.keil.arm.com",
  "publicador": "Arm",
  "tipo": "software",
  "funcao": "Ambiente de desenvolvimento e depuração para microcontroladores ARM Cortex-M (STM32, entre outros). A edição Community é gratuita para uso não comercial. Há extensão para o VS Code.",
  "instrucoes_baixar": "Baixe em keil.arm.com ou instale a extensão Keil Studio Pack no VS Code.",
  "instrucoes_usar": "Abra um projeto de um exemplo da sua placa e use o botão Build e Debug.",
  "tags": [
   "Firmware",
   "STM32",
   "Depuração",
   "IDE",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "VS Code"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "IAR Embedded Workbench",
  "url": "https://www.iar.com",
  "publicador": "IAR",
  "tipo": "software",
  "funcao": "Compilador e depurador profissionais para ARM e outros. Há edição Kickstart gratuita com limite de tamanho de código.",
  "instrucoes_baixar": "Baixe o instalador em iar.com e peça a licença Kickstart.",
  "instrucoes_usar": "Crie um projeto escolhendo o microcontrolador e use Download and Debug.",
  "tags": [
   "Firmware",
   "Depuração",
   "IDE",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "freemium",
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SEGGER Ozone e J-Link",
  "url": "https://www.segger.com/products/development-tools/ozone-j-link-debugger/",
  "publicador": "SEGGER",
  "tipo": "software",
  "funcao": "Depurador e analisador de desempenho para ARM, com a sonda J-Link. Uso gratuito para fins educacionais.",
  "instrucoes_baixar": "Baixe o pacote do J-Link e o Ozone em segger.com.",
  "instrucoes_usar": "Conecte a sonda, abra o Ozone, escolha o chip e o arquivo .elf, e use Download & Reset Program.",
  "tags": [
   "Firmware",
   "Depuração",
   "ARM",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Saleae Logic 2",
  "url": "https://www.saleae.com/downloads/",
  "publicador": "Saleae",
  "tipo": "software",
  "funcao": "Software de analisador lógico: mostra e decodifica I2C, SPI, UART e CAN. O programa abre sem o equipamento para ver capturas.",
  "instrucoes_baixar": "Baixe em saleae.com/downloads.",
  "instrucoes_usar": "Conecte as pontas, escolha os canais, clique em Start e adicione o analisador do protocolo.",
  "tags": [
   "Eletrônica",
   "Depuração",
   "Firmware",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PulseView e sigrok",
  "url": "https://sigrok.org",
  "publicador": "Projeto sigrok",
  "tipo": "software",
  "funcao": "Analisador lógico de código aberto, com mais de uma centena de decodificadores de protocolos. Funciona com analisadores baratos compatíveis com o Saleae.",
  "instrucoes_baixar": "Baixe o PulseView em sigrok.org/wiki/Downloads.",
  "instrucoes_usar": "Selecione o dispositivo, ligue os canais e adicione o decodificador (UART, I2C, SPI).",
  "tags": [
   "Eletrônica",
   "Depuração",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Wireshark",
  "url": "https://www.wireshark.org",
  "publicador": "Wireshark Foundation",
  "tipo": "software",
  "funcao": "Captura e analisa o tráfego de rede. Serve para depurar MQTT, HTTP e BLE.",
  "instrucoes_baixar": "Baixe em wireshark.org/download.",
  "instrucoes_usar": "Escolha a interface, clique em capturar e filtre por protocolo (ex.: `mqtt`).",
  "tags": [
   "Depuração",
   "Segurança",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Tera Term",
  "url": "https://teratermproject.github.io",
  "publicador": "Projeto Tera Term",
  "tipo": "software",
  "funcao": "Terminal serial para o Windows, para ver o que a placa imprime pela porta serial.",
  "instrucoes_baixar": "Baixe pela página do projeto.",
  "instrucoes_usar": "File > New connection > Serial, escolha a porta e Setup > Serial port para ajustar a velocidade (115200 é comum).",
  "tags": [
   "Firmware",
   "Terminal",
   "Depuração",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Wokwi",
  "url": "https://wokwi.com",
  "publicador": "Wokwi",
  "tipo": "servico",
  "funcao": "Simulador online de ESP32, Arduino, Raspberry Pi Pico e STM32 com componentes (displays, sensores, LEDs). Testa o firmware sem a placa, e há extensão para o VS Code.",
  "instrucoes_baixar": "Não há o que baixar para o site.",
  "instrucoes_usar": "Abra um exemplo em wokwi.com/projects, edite o código e clique em Play.",
  "tags": [
   "Simulação",
   "Prototipagem",
   "Firmware",
   "ESP32",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Tinkercad",
  "url": "https://www.tinkercad.com",
  "publicador": "Autodesk",
  "tipo": "servico",
  "funcao": "Circuitos com Arduino simulados no navegador, modelagem 3D simples e blocos de código. Ótimo para ensinar a quem está começando.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta (pode ser com a Autodesk) e abra Circuits para montar o circuito.",
  "tags": [
   "Simulação",
   "Prototipagem",
   "Modelagem 3D",
   "Estudante",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "LTspice",
  "url": "https://www.analog.com/ltspice",
  "publicador": "Analog Devices",
  "tipo": "software",
  "funcao": "Simulador de circuitos analógicos (SPICE), gratuito e sem limite de tamanho. O mais usado para estudar amplificadores, filtros e fontes.",
  "instrucoes_baixar": "Baixe em analog.com/ltspice.",
  "instrucoes_usar": "Desenhe o circuito, adicione uma análise (.tran ou .ac) em Simulate e execute.",
  "tags": [
   "Eletrônica",
   "Simulação",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Falstad: simulador de circuitos",
  "url": "https://www.falstad.com/circuit/",
  "publicador": "Paul Falstad",
  "tipo": "servico",
  "funcao": "Simulador de circuitos no navegador, com correntes e tensões animadas. Ótimo para enxergar o que acontece num filtro ou num transistor.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Escolha um exemplo no menu Circuits e mude os valores com o botão direito.",
  "tags": [
   "Eletrônica",
   "Simulação",
   "Estudante",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "EasyEDA",
  "url": "https://easyeda.com",
  "publicador": "JLC",
  "tipo": "servico",
  "funcao": "Projeto de esquemas e placas no navegador, ligado à biblioteca de componentes da LCSC e à fabricação da JLCPCB. Gratuito.",
  "instrucoes_baixar": "Use no navegador ou baixe a versão para o computador.",
  "instrucoes_usar": "Crie um projeto, desenhe o esquema, converta em PCB e peça a fabricação pelo botão da JLCPCB.",
  "tags": [
   "PCB",
   "Eletrônica",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "JLCPCB",
  "url": "https://jlcpcb.com",
  "publicador": "JLCPCB",
  "tipo": "servico",
  "funcao": "Fabricação de placas de circuito impresso e montagem de componentes, com preço baixo e prazo curto. A primeira compra costuma ter desconto.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Envie os arquivos Gerber (exportados do KiCad ou do Altium) e escolha camadas, espessura e acabamento.",
  "tags": [
   "PCB",
   "Prototipagem",
   "Eletrônica",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PCBWay",
  "url": "https://www.pcbway.com",
  "publicador": "PCBWay",
  "tipo": "servico",
  "funcao": "Fabricação e montagem de placas, usinagem CNC e impressão 3D, com cotação on-line.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Envie os Gerber, escolha as opções e compare o preço com o da JLCPCB.",
  "tags": [
   "PCB",
   "Prototipagem",
   "Mecânica",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Octopart",
  "url": "https://octopart.com",
  "publicador": "Altium",
  "tipo": "servico",
  "funcao": "Busca de componentes eletrônicos em vários distribuidores, com estoque, preço e datasheet em um só lugar.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque pelo código da peça e filtre por estoque no Brasil ou por preço.",
  "tags": [
   "Eletrônica",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SnapMagic (SnapEDA)",
  "url": "https://www.snapeda.com",
  "publicador": "SnapMagic",
  "tipo": "servico",
  "funcao": "Símbolos, footprints e modelos 3D de componentes para KiCad, Altium e Eagle. Poupa o trabalho de desenhar a peça.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque a peça, escolha o formato da sua ferramenta e baixe o pacote. Confira o footprint com o datasheet.",
  "tags": [
   "PCB",
   "Eletrônica",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Digi-Key Brasil",
  "url": "https://www.digikey.com.br",
  "publicador": "Digi-Key",
  "tipo": "servico",
  "funcao": "Distribuidor de componentes eletrônicos com entrega ao Brasil, datasheets e ferramentas de seleção.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque a peça e use os filtros de parâmetros. Considere o frete e o imposto de importação.",
  "tags": [
   "Eletrônica",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Mouser Brasil",
  "url": "https://www.mouser.com",
  "publicador": "Mouser",
  "tipo": "servico",
  "funcao": "Distribuidor de componentes eletrônicos com grande estoque e envio ao Brasil.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque o código da peça e compare com o Digi-Key.",
  "tags": [
   "Eletrônica",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "FreeCAD",
  "url": "https://www.freecad.org",
  "publicador": "Projeto FreeCAD",
  "tipo": "software",
  "funcao": "CAD 3D paramétrico de código aberto, gratuito. Alternativa livre ao SOLIDWORKS e ao Fusion para peças e montagens.",
  "instrucoes_baixar": "Baixe em freecad.org/downloads.",
  "instrucoes_usar": "Escolha o ambiente Part Design, crie um esboço, extrude e exporte em STEP ou STL.",
  "tags": [
   "CAD",
   "Mecânica",
   "Modelagem 3D",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenSCAD",
  "url": "https://openscad.org",
  "publicador": "Projeto OpenSCAD",
  "tipo": "software",
  "funcao": "CAD por código: o modelo 3D é descrito em texto. Bom para peças paramétricas, caixas e suportes.",
  "instrucoes_baixar": "Baixe em openscad.org/downloads.html.",
  "instrucoes_usar": "Escreva por exemplo `cube([10,20,5]);` e aperte F5 para ver e F6 para renderizar.",
  "tags": [
   "CAD",
   "Modelagem 3D",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Blender",
  "url": "https://www.blender.org",
  "publicador": "Blender Foundation",
  "tipo": "software",
  "funcao": "Modelagem, animação e renderização 3D, gratuito e de código aberto. Útil para animar movimentos, ver malhas e fazer figuras.",
  "instrucoes_baixar": "Baixe em blender.org/download.",
  "instrucoes_usar": "Abra, remova o cubo inicial (X) e importe seu modelo em File > Import.",
  "tags": [
   "Modelagem 3D",
   "Visualização",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PrusaSlicer",
  "url": "https://github.com/prusa3d/PrusaSlicer",
  "publicador": "Prusa Research",
  "tipo": "software",
  "funcao": "Fatiador de impressão 3D de código aberto, que prepara o modelo para a impressora.",
  "instrucoes_baixar": "Baixe na página de releases do GitHub.",
  "instrucoes_usar": "Importe o STL, escolha o perfil da impressora e do filamento, clique em Slice e exporte o G-code.",
  "tags": [
   "Modelagem 3D",
   "Prototipagem",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "UltiMaker Cura",
  "url": "https://ultimaker.com/software/ultimaker-cura/",
  "publicador": "UltiMaker",
  "tipo": "software",
  "funcao": "Fatiador de impressão 3D gratuito, com perfis prontos para muitas impressoras.",
  "instrucoes_baixar": "Baixe em ultimaker.com.",
  "instrucoes_usar": "Adicione a impressora, abra o STL e exporte o G-code.",
  "tags": [
   "Modelagem 3D",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Printables",
  "url": "https://www.printables.com",
  "publicador": "Prusa Research",
  "tipo": "servico",
  "funcao": "Repositório de modelos 3D para imprimir, de suportes a carcaças, com avaliações de quem imprimiu.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque o modelo, confira a licença e baixe o STL.",
  "tags": [
   "Modelagem 3D",
   "Prototipagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GrabCAD",
  "url": "https://grabcad.com",
  "publicador": "Stratasys",
  "tipo": "servico",
  "funcao": "Biblioteca de modelos CAD de peças e máquinas, enviados por engenheiros. Útil para achar o modelo 3D de um componente.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta, busque a peça e baixe no formato que a sua ferramenta abre (STEP é o mais compatível).",
  "tags": [
   "CAD",
   "Mecânica",
   "Modelagem 3D",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Zephyr RTOS",
  "url": "https://www.zephyrproject.org",
  "publicador": "Linux Foundation",
  "tipo": "software",
  "funcao": "Sistema operacional de tempo real de código aberto, com suporte a centenas de placas (nRF, STM32, ESP32). Alternativa estruturada ao FreeRTOS.",
  "instrucoes_baixar": "Siga o Getting Started em docs.zephyrproject.org.",
  "instrucoes_usar": "Crie o aplicativo a partir de um exemplo e use `west build -b sua_placa` e `west flash`.",
  "tags": [
   "Firmware",
   "Código aberto",
   "ARM",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "FreeRTOS",
  "url": "https://www.freertos.org",
  "publicador": "Amazon Web Services",
  "tipo": "software",
  "funcao": "Sistema operacional de tempo real mais usado em microcontroladores. Já vem no ESP-IDF. O livro oficial, Mastering the FreeRTOS Real Time Kernel, é gratuito no site.",
  "instrucoes_baixar": "No ESP-IDF ele já vem. Em outras placas, adicione o código fonte ao projeto.",
  "instrucoes_usar": "Leia o livro (Documentation > Books and manual) e aprenda tarefas, filas e semáforos.",
  "tags": [
   "Firmware",
   "Código aberto",
   "ESP32",
   "STM32",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Interrupt (blog da Memfault)",
  "url": "https://interrupt.memfault.com",
  "publicador": "Memfault",
  "tipo": "referencia",
  "funcao": "Blog técnico sobre firmware: depuração de falhas, bootloaders, RTOS, ARM Cortex-M, testes e boas práticas.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Comece por \"Practical Guide to ARM Cortex-M Fault Debugging\" e pelo guia de build e makefiles.",
  "tags": [
   "Firmware",
   "Depuração",
   "Treinamento",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Embedded Rust Book",
  "url": "https://docs.rust-embedded.org/book/",
  "publicador": "Rust Embedded",
  "tipo": "referencia",
  "funcao": "Guia de Rust para microcontroladores, para quem quer firmware seguro em memória.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Siga a introdução e a configuração do ambiente para ARM Cortex-M.",
  "tags": [
   "Firmware",
   "Treinamento",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Docker Desktop",
  "url": "https://www.docker.com/products/docker-desktop/",
  "publicador": "Docker",
  "tipo": "software",
  "funcao": "Roda aplicativos em contêineres, para ter o mesmo ambiente em todas as máquinas. Gratuito para estudo, pesquisa e pequenas empresas.",
  "instrucoes_baixar": "Baixe em docker.com (no Windows pede o WSL 2).",
  "instrucoes_usar": "Teste com `docker run hello-world`.",
  "tags": [
   "Desenvolvimento",
   "Servidores",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "WSL (Windows Subsystem for Linux)",
  "url": "https://learn.microsoft.com/windows/wsl/",
  "publicador": "Microsoft",
  "tipo": "software",
  "funcao": "Um Linux completo dentro do Windows, com terminal, sem máquina virtual pesada. O VS Code conecta nele com a extensão WSL.",
  "instrucoes_baixar": "No PowerShell como administrador: `wsl --install`. Reinicie o computador.",
  "instrucoes_usar": "Abra o app Ubuntu, crie usuário e senha, e no VS Code use a extensão WSL (Ctrl+Shift+P > WSL: Connect).",
  "tags": [
   "Terminal",
   "Desenvolvimento",
   "Linha de comando",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Windows PowerToys",
  "url": "https://learn.microsoft.com/windows/powertoys/",
  "publicador": "Microsoft",
  "tipo": "software",
  "funcao": "Utilitários da Microsoft para o Windows: janelas organizadas, seletor de cores, régua de tela, renomear em lote, atalhos.",
  "instrucoes_baixar": "Instale pela Microsoft Store ou por `winget install Microsoft.PowerToys`.",
  "instrucoes_usar": "Abra o PowerToys e ative as ferramentas que quiser. FancyZones organiza janelas.",
  "tags": [
   "Produtividade",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Notepad++",
  "url": "https://notepad-plus-plus.org",
  "publicador": "Don Ho",
  "tipo": "software",
  "funcao": "Editor de texto leve para o Windows, bom para abrir logs, CSVs e arquivos grandes.",
  "instrucoes_baixar": "Baixe em notepad-plus-plus.org.",
  "instrucoes_usar": "Abra o arquivo e use Ctrl+F para buscar com expressões regulares.",
  "tags": [
   "Editor",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "7-Zip",
  "url": "https://www.7-zip.org",
  "publicador": "Igor Pavlov",
  "tipo": "software",
  "funcao": "Compacta e extrai arquivos (zip, 7z, rar, tar), gratuito e de código aberto.",
  "instrucoes_baixar": "Baixe em 7-zip.org.",
  "instrucoes_usar": "Clique com o botão direito no arquivo e use o menu 7-Zip.",
  "tags": [
   "Produtividade",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Bitwarden",
  "url": "https://bitwarden.com",
  "publicador": "Bitwarden",
  "tipo": "servico",
  "funcao": "Gerenciador de senhas de código aberto, com extensão de navegador e aplicativo. O plano gratuito basta. Ajuda a ter senhas únicas e fortes em cada serviço.",
  "instrucoes_baixar": "Crie a conta e instale a extensão do navegador e o aplicativo.",
  "instrucoes_usar": "Crie a senha mestra (longa, única) e ative a verificação em duas etapas.",
  "tags": [
   "Segurança",
   "Código aberto",
   "Navegador",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web",
   "Windows",
   "macOS",
   "Linux",
   "Chrome",
   "Firefox",
   "Edge",
   "Android",
   "iOS"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Tailscale",
  "url": "https://tailscale.com",
  "publicador": "Tailscale",
  "tipo": "servico",
  "funcao": "Rede privada (VPN em malha) simples, para acessar remotamente o computador do laboratório ou um Raspberry Pi sem abrir portas. Gratuito para uso pessoal.",
  "instrucoes_baixar": "Baixe em tailscale.com/download.",
  "instrucoes_usar": "Entre com a mesma conta nos dois aparelhos e use o endereço que o Tailscale mostra.",
  "tags": [
   "Segurança",
   "Servidores",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux",
   "Android",
   "iOS"
  ],
  "acesso": [
   "gratis",
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Postman",
  "url": "https://www.postman.com",
  "publicador": "Postman",
  "tipo": "software",
  "funcao": "Testa APIs (como as do Supabase) com requisições salvas e compartilhadas.",
  "instrucoes_baixar": "Baixe em postman.com.",
  "instrucoes_usar": "Crie uma requisição, ponha a URL e o cabeçalho de autorização, e clique em Send.",
  "tags": [
   "Desenvolvimento",
   "Depuração",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux",
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Supabase",
  "url": "https://supabase.com",
  "publicador": "Supabase",
  "tipo": "servico",
  "funcao": "Banco de dados (Postgres), autenticação e armazenamento na nuvem, com plano gratuito. É a base do SOMA.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie o projeto, abra o SQL Editor e rode as migrações. O plano gratuito pausa projetos parados.",
  "tags": [
   "Banco de dados",
   "Nuvem",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Vercel",
  "url": "https://vercel.com",
  "publicador": "Vercel",
  "tipo": "servico",
  "funcao": "Hospedagem de sites e aplicações web ligada ao GitHub, com plano gratuito para projetos pessoais.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Entre com o GitHub, importe o repositório e cada push gera uma nova versão publicada.",
  "tags": [
   "Hospedagem",
   "Nuvem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Cloudflare",
  "url": "https://www.cloudflare.com",
  "publicador": "Cloudflare",
  "tipo": "servico",
  "funcao": "DNS, proteção e hospedagem (Pages e Workers) com plano gratuito generoso. Usado para domínios e para funções leves.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Adicione o domínio, aponte os nameservers e crie os registros DNS.",
  "tags": [
   "Hospedagem",
   "Domínio",
   "Nuvem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Firebase",
  "url": "https://firebase.google.com",
  "publicador": "Google",
  "tipo": "servico",
  "funcao": "Banco de dados, autenticação, hospedagem e funções do Google, com plano gratuito.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie o projeto no console, adicione o aplicativo web e copie a configuração.",
  "tags": [
   "Banco de dados",
   "Nuvem",
   "Hospedagem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenBCI",
  "url": "https://openbci.com",
  "publicador": "OpenBCI",
  "tipo": "software",
  "funcao": "Placas abertas de EEG, EMG e ECG e o software para ver e gravar os sinais. Muito usado em interfaces cérebro-computador de baixo custo.",
  "instrucoes_baixar": "Baixe o OpenBCI GUI em openbci.com.",
  "instrucoes_usar": "Conecte a placa, escolha o tipo de transmissão (serial ou Wi-Fi) e inicie a transmissão de dados.",
  "tags": [
   "EEG",
   "Sinais biomédicos",
   "Código aberto",
   "Coleta de dados",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "BrainFlow",
  "url": "https://brainflow.org",
  "publicador": "BrainFlow",
  "tipo": "repositorio",
  "funcao": "Biblioteca de código aberto para ler dados de dezenas de placas de EEG, EMG e ECG (OpenBCI, Muse, entre outras) em Python, C++, Java e outras linguagens.",
  "instrucoes_baixar": "No terminal: `pip install brainflow`.",
  "instrucoes_usar": "Siga os exemplos em brainflow.readthedocs.io para ligar à placa e obter amostras.",
  "tags": [
   "EEG",
   "Sinais biomédicos",
   "Python",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Lab Streaming Layer (LSL)",
  "url": "https://labstreaminglayer.org",
  "publicador": "SCCN/UCSD",
  "tipo": "repositorio",
  "funcao": "Protocolo aberto para sincronizar fluxos de dados de vários aparelhos (EEG, EMG, câmera, eventos) com tempo comum.",
  "instrucoes_baixar": "`pip install pylsl` para Python.",
  "instrucoes_usar": "Publique cada fonte como um outlet e grave tudo com o LabRecorder.",
  "tags": [
   "Sinais biomédicos",
   "Coleta de dados",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Open Ephys",
  "url": "https://open-ephys.org",
  "publicador": "Open Ephys",
  "tipo": "software",
  "funcao": "Plataforma aberta de aquisição de sinais eletrofisiológicos, com interface gráfica e hardware.",
  "instrucoes_baixar": "Baixe o GUI pela página.",
  "instrucoes_usar": "Monte a cadeia de processadores na interface, escolha a fonte e grave.",
  "tags": [
   "Sinais biomédicos",
   "Coleta de dados",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PsychoPy",
  "url": "https://www.psychopy.org",
  "publicador": "Open Science Tools",
  "tipo": "software",
  "funcao": "Cria experimentos de psicologia e neurociência (estímulos, tempos, respostas) por blocos ou em Python, com precisão de tempo.",
  "instrucoes_baixar": "Baixe em psychopy.org/download.html.",
  "instrucoes_usar": "Use o Builder para montar rotinas e laços e exporte o experimento para rodar no navegador (Pavlovia).",
  "tags": [
   "Pesquisa",
   "Coleta de dados",
   "Python",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenSim",
  "url": "https://opensim.stanford.edu",
  "publicador": "Stanford University",
  "tipo": "software",
  "funcao": "Simulação musculoesquelética: cinemática, forças musculares e torques articulares da marcha e de outros movimentos. Referência em biomecânica.",
  "instrucoes_baixar": "Baixe em simtk.org/projects/opensim (conta gratuita).",
  "instrucoes_usar": "Abra um modelo (ex.: Gait2392), escalone-o aos dados do voluntário e rode a cinemática inversa.",
  "tags": [
   "Reabilitação",
   "Simulação",
   "Saúde",
   "Código aberto",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Kinovea",
  "url": "https://www.kinovea.org",
  "publicador": "Kinovea",
  "tipo": "software",
  "funcao": "Análise de movimento em vídeo: marca ângulos, trajetórias e tempos a partir de uma gravação. Muito usada em fisioterapia e esporte.",
  "instrucoes_baixar": "Baixe em kinovea.org.",
  "instrucoes_usar": "Abra o vídeo, calibre uma distância conhecida e use as ferramentas de ângulo e trajetória.",
  "tags": [
   "Reabilitação",
   "Imagens",
   "Saúde",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Tracker (análise de vídeo)",
  "url": "https://physlets.org/tracker/",
  "publicador": "Open Source Physics",
  "tipo": "software",
  "funcao": "Rastreia pontos em vídeos e gera gráficos de posição, velocidade e aceleração. Bom para estudar movimento com uma câmera comum.",
  "instrucoes_baixar": "Baixe em physlets.org/tracker.",
  "instrucoes_usar": "Abra o vídeo, defina a escala e a origem, e marque o ponto a cada quadro (ou rastreie automaticamente).",
  "tags": [
   "Imagens",
   "Reabilitação",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DeepLabCut",
  "url": "https://www.mackenziemathislab.org/deeplabcut",
  "publicador": "Mathis Lab",
  "tipo": "repositorio",
  "funcao": "Estima a pose de humanos e animais em vídeos com aprendizado profundo, sem marcadores. Usa poucos quadros marcados para treinar.",
  "instrucoes_baixar": "No terminal: `pip install deeplabcut` (de preferência num ambiente conda).",
  "instrucoes_usar": "Crie um projeto, marque pontos em alguns quadros, treine e analise os vídeos.",
  "tags": [
   "IA",
   "Imagens",
   "Reabilitação",
   "Código aberto",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MediaPipe",
  "url": "https://ai.google.dev/edge/mediapipe",
  "publicador": "Google",
  "tipo": "repositorio",
  "funcao": "Biblioteca de visão computacional pronta para uso (pose do corpo, mãos, face) que roda no navegador, no celular e em Python.",
  "instrucoes_baixar": "`pip install mediapipe`.",
  "instrucoes_usar": "Rode o exemplo de Pose Landmarker e ligue a saída aos seus gráficos.",
  "tags": [
   "IA",
   "Imagens",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "SciPy",
  "url": "https://scipy.org",
  "publicador": "Projeto SciPy",
  "tipo": "repositorio",
  "funcao": "A biblioteca científica do Python: filtros digitais, FFT, espectros, estatística e otimização. A base de quase todo processamento de biossinais em Python.",
  "instrucoes_baixar": "`pip install numpy scipy matplotlib pandas`.",
  "instrucoes_usar": "Use `scipy.signal` (butter, filtfilt, welch) para filtrar e calcular espectros.",
  "tags": [
   "Python",
   "Sinais biomédicos",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GNU Octave",
  "url": "https://octave.org",
  "publicador": "Projeto GNU",
  "tipo": "software",
  "funcao": "Alternativa gratuita ao MATLAB, que roda a maioria dos scripts dele.",
  "instrucoes_baixar": "Baixe em octave.org/download.",
  "instrucoes_usar": "Abra a interface e rode scripts .m.",
  "tags": [
   "MATLAB",
   "Estatística",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "R e RStudio (Posit)",
  "url": "https://posit.co/download/rstudio-desktop/",
  "publicador": "Posit",
  "tipo": "software",
  "funcao": "Linguagem R e o ambiente RStudio para estatística e gráficos. Muito usada em pesquisa em saúde.",
  "instrucoes_baixar": "1. Instale o R em cran.r-project.org.\n2. Instale o RStudio Desktop em posit.co.",
  "instrucoes_usar": "Abra o RStudio e instale pacotes com `install.packages(\"tidyverse\")`.",
  "tags": [
   "Estatística",
   "Pesquisa",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Orange Data Mining",
  "url": "https://orangedatamining.com",
  "publicador": "Universidade de Ljubljana",
  "tipo": "software",
  "funcao": "Mineração de dados e aprendizado de máquina por blocos visuais, sem programar. Ótimo para ensinar e explorar dados.",
  "instrucoes_baixar": "Baixe em orangedatamining.com/download.",
  "instrucoes_usar": "Ligue os blocos File > Data Table > Test and Score e escolha o modelo.",
  "tags": [
   "Dados",
   "IA",
   "Estatística",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "scikit-learn",
  "url": "https://scikit-learn.org",
  "publicador": "Projeto scikit-learn",
  "tipo": "repositorio",
  "funcao": "Biblioteca de aprendizado de máquina clássico em Python (classificação, regressão, validação cruzada). Boa para os primeiros modelos com características de sinais.",
  "instrucoes_baixar": "`pip install scikit-learn`.",
  "instrucoes_usar": "Siga o guia \"Getting Started\" e use sempre validação cruzada separada por voluntário.",
  "tags": [
   "Python",
   "IA",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "PyTorch",
  "url": "https://pytorch.org",
  "publicador": "Linux Foundation",
  "tipo": "repositorio",
  "funcao": "Biblioteca de aprendizado profundo, usada em pesquisa. Tem tutoriais bons e roda em GPU.",
  "instrucoes_baixar": "Escolha seu sistema na página \"Get Started\" e rode o comando que ela mostra.",
  "instrucoes_usar": "Siga os tutoriais oficiais (Learn the Basics).",
  "tags": [
   "Python",
   "IA",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "G*Power",
  "url": "https://www.psychologie.hhu.de/arbeitsgruppen/allgemeine-psychologie-und-arbeitspsychologie/gpower",
  "publicador": "Universidade de Düsseldorf",
  "tipo": "software",
  "funcao": "Calcula o tamanho de amostra e o poder estatístico de testes comuns (t, ANOVA, correlação). Pede-se nos projetos que vão ao comitê de ética.",
  "instrucoes_baixar": "Baixe pela página da universidade.",
  "instrucoes_usar": "Escolha o teste, o tamanho do efeito esperado, o alfa e o poder, e clique em Calculate.",
  "tags": [
   "Estatística",
   "Pesquisa",
   "Ética em pesquisa",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Windows",
   "macOS"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "DaVinci Resolve",
  "url": "https://www.blackmagicdesign.com/products/davinciresolve",
  "publicador": "Blackmagic Design",
  "tipo": "software",
  "funcao": "Editor de vídeo profissional, com versão gratuita completa. Bom para tutoriais, apresentações e vídeos de projeto.",
  "instrucoes_baixar": "Baixe em blackmagicdesign.com.",
  "instrucoes_usar": "Crie um projeto, importe as mídias, edite na aba Cut ou Edit e exporte na aba Deliver.",
  "tags": [
   "Imagens",
   "Design",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OBS Studio",
  "url": "https://obsproject.com",
  "publicador": "Projeto OBS",
  "tipo": "software",
  "funcao": "Grava a tela e faz transmissões ao vivo, grátis. Serve para gravar tutoriais, defesas e demonstrações.",
  "instrucoes_baixar": "Baixe em obsproject.com.",
  "instrucoes_usar": "Adicione a fonte \"Captura de tela\" e clique em Iniciar gravação.",
  "tags": [
   "Imagens",
   "Treinamento",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Inkscape",
  "url": "https://inkscape.org",
  "publicador": "Projeto Inkscape",
  "tipo": "software",
  "funcao": "Editor de gráficos vetoriais gratuito. Bom para figuras de artigos, logotipos e esquemas que precisam de qualidade em qualquer tamanho.",
  "instrucoes_baixar": "Baixe em inkscape.org.",
  "instrucoes_usar": "Desenhe as formas, exporte em SVG ou PDF para o artigo.",
  "tags": [
   "Design",
   "Vetor",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "GIMP",
  "url": "https://www.gimp.org",
  "publicador": "Projeto GIMP",
  "tipo": "software",
  "funcao": "Editor de imagens gratuito (fotos, recortes, correção de cor). Alternativa livre ao Photoshop.",
  "instrucoes_baixar": "Baixe em gimp.org.",
  "instrucoes_usar": "Abra a imagem, use Image > Scale Image para redimensionar e File > Export As para salvar.",
  "tags": [
   "Design",
   "Imagens",
   "Código aberto",
   "Ainda não testada"
  ],
  "plataformas": [
   "Windows",
   "macOS",
   "Linux"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "MIT OpenCourseWare",
  "url": "https://ocw.mit.edu",
  "publicador": "MIT",
  "tipo": "servico",
  "funcao": "Material de centenas de disciplinas do MIT, de graça: vídeos, listas e provas. Inclui sinais e sistemas, circuitos, neurociência e bioengenharia.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Busque a disciplina (ex.: 6.003 Signals and Systems) e siga o calendário.",
  "tags": [
   "Treinamento",
   "Engenharia",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Coursera",
  "url": "https://www.coursera.org",
  "publicador": "Coursera",
  "tipo": "servico",
  "funcao": "Cursos de universidades e empresas. Dá para assistir de graça (modo ouvinte) e pedir auxílio financeiro para o certificado. Algumas universidades têm acesso total aos alunos.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Matricule-se como ouvinte; para o certificado, use \"Auxílio financeiro\" na página do curso.",
  "tags": [
   "Treinamento",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium",
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "edX",
  "url": "https://www.edx.org",
  "publicador": "2U",
  "tipo": "servico",
  "funcao": "Cursos de universidades (MIT, Harvard e outras). Dá para fazer sem pagar (audit); o certificado é pago.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Escolha \"Audit this course\" para ver sem pagar.",
  "tags": [
   "Treinamento",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Khan Academy",
  "url": "https://pt.khanacademy.org",
  "publicador": "Khan Academy",
  "tipo": "servico",
  "funcao": "Aulas e exercícios gratuitos em português de matemática, estatística, cálculo e física. Bom para reforçar a base.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Escolha a disciplina e faça os exercícios para ver o que falta aprender.",
  "tags": [
   "Treinamento",
   "Estudante",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "freeCodeCamp",
  "url": "https://www.freecodecamp.org",
  "publicador": "freeCodeCamp",
  "tipo": "servico",
  "funcao": "Cursos gratuitos de programação, Python, análise de dados e aprendizado de máquina, com projetos.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Siga o currículo de Python científico e faça os projetos.",
  "tags": [
   "Treinamento",
   "Desenvolvimento",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "CS50 (Harvard)",
  "url": "https://cs50.harvard.edu",
  "publicador": "Harvard",
  "tipo": "servico",
  "funcao": "Introdução à ciência da computação, com aulas em vídeo gratuitas e legendas em português. Passa por C, Python, SQL e web.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Assista às aulas em cs50.harvard.edu/x e faça os problem sets.",
  "tags": [
   "Treinamento",
   "Desenvolvimento",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "fast.ai",
  "url": "https://www.fast.ai",
  "publicador": "fast.ai",
  "tipo": "servico",
  "funcao": "Curso prático e gratuito de aprendizado profundo, que começa pelo uso e só depois vai à teoria.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Siga \"Practical Deep Learning for Coders\" com cadernos no Colab.",
  "tags": [
   "Treinamento",
   "IA",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "AWS Educate",
  "url": "https://aws.amazon.com/education/awseducate/",
  "publicador": "Amazon Web Services",
  "tipo": "beneficio",
  "funcao": "Cursos gratuitos de nuvem e distintivos digitais da AWS para estudantes, com créditos em alguns programas. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Crie a conta com o e-mail @ufmg.br.\n2. Comece pelos cursos de \"Cloud 101\".",
  "tags": [
   "Estudante",
   "Nuvem",
   "Treinamento",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante",
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Microsoft Learn",
  "url": "https://learn.microsoft.com/training/",
  "publicador": "Microsoft",
  "tipo": "servico",
  "funcao": "Trilhas de estudo gratuitas de Azure, Python, IA, Power BI e dados, com ambientes de laboratório.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Escolha uma trilha, faça os módulos e ganhe os distintivos.",
  "tags": [
   "Treinamento",
   "Nuvem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Google Cloud Skills Boost",
  "url": "https://www.cloudskillsboost.google",
  "publicador": "Google",
  "tipo": "servico",
  "funcao": "Laboratórios práticos e cursos do Google Cloud; parte é gratuita, e há programas para estudantes.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta e faça os laboratórios de nível iniciante.",
  "tags": [
   "Treinamento",
   "Nuvem",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "NVIDIA Deep Learning Institute",
  "url": "https://www.nvidia.com/en-us/training/",
  "publicador": "NVIDIA",
  "tipo": "servico",
  "funcao": "Cursos de aprendizado profundo e computação acelerada, com GPU na nuvem. Parte é gratuita.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Filtre por \"Free\" e escolha um curso de fundamentos.",
  "tags": [
   "Treinamento",
   "IA",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "freemium"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Arm Education",
  "url": "https://www.arm.com/resources/education",
  "publicador": "Arm",
  "tipo": "servico",
  "funcao": "Material gratuito para ensinar e aprender arquitetura ARM e sistemas embarcados, com slides, livros e laboratórios.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Procure \"Education Kits\" e \"Books\" na página.",
  "tags": [
   "Treinamento",
   "Firmware",
   "ARM",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Cisco Networking Academy",
  "url": "https://www.netacad.com",
  "publicador": "Cisco",
  "tipo": "servico",
  "funcao": "Cursos gratuitos de redes, segurança, Linux e Python, com laboratório e certificado de conclusão.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta e escolha o curso de autoestudo \"Introduction to Cybersecurity\" ou \"Python Essentials\".",
  "tags": [
   "Treinamento",
   "Segurança",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "IBM SkillsBuild",
  "url": "https://skillsbuild.org",
  "publicador": "IBM",
  "tipo": "servico",
  "funcao": "Cursos gratuitos de IA, dados, nuvem e segurança, com certificado digital.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "Crie a conta e escolha uma trilha.",
  "tags": [
   "Treinamento",
   "IA",
   "Ainda não testada"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Spotify Premium para estudantes",
  "url": "https://www.spotify.com/br/student/",
  "publicador": "Spotify",
  "tipo": "beneficio",
  "funcao": "Desconto no Spotify Premium para estudantes de instituições reconhecidas, verificado por um serviço de terceiros. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Abra a página e inicie a verificação.\n2. Confirme o vínculo com a UFMG.",
  "tags": [
   "Estudante",
   "Desconto",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "YouTube Premium para estudantes",
  "url": "https://www.youtube.com/premium/student",
  "publicador": "Google",
  "tipo": "beneficio",
  "funcao": "Plano mais barato do YouTube Premium (sem anúncios, com downloads) para estudantes. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Abra a página, escolha a conta Google.\n2. Faça a verificação com a UFMG.",
  "tags": [
   "Estudante",
   "Desconto",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Apple Education Store",
  "url": "https://www.apple.com/br-edu/shop",
  "publicador": "Apple",
  "tipo": "beneficio",
  "funcao": "Preços de estudante em Mac, iPad e acessórios, e descontos em AppleCare+. Confira no site se a UFMG e o seu curso são aceitos e se a oferta vale no Brasil.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "1. Abra a loja da educação.\n2. Compre com a verificação de estudante.",
  "tags": [
   "Estudante",
   "Desconto",
   "Ainda não testada",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "estudante"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Clean Code",
  "url": "https://openlibrary.org/search?q=clean+code+martin",
  "publicador": "Robert C. Martin",
  "tipo": "referencia",
  "funcao": "Princípios para escrever código legível: nomes, funções pequenas, comentários e testes. Leitura obrigatória para quem escreve firmware que outros vão manter.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Pragmatic Programmer",
  "url": "https://openlibrary.org/search?q=pragmatic+programmer+thomas+hunt",
  "publicador": "David Thomas e Andrew Hunt",
  "tipo": "referencia",
  "funcao": "Hábitos e técnicas de quem programa bem: automatizar, depurar, escrever código fácil de mudar.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Code Complete",
  "url": "https://openlibrary.org/search?q=code+complete+mcconnell",
  "publicador": "Steve McConnell",
  "tipo": "referencia",
  "funcao": "Guia extenso de construção de software: projeto, variáveis, estruturas de controle, depuração e testes.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Clean Architecture",
  "url": "https://openlibrary.org/search?q=clean+architecture+martin",
  "publicador": "Robert C. Martin",
  "tipo": "referencia",
  "funcao": "Como organizar um sistema em camadas que dependem do que é estável. Útil para firmware que precisa trocar de hardware.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Refactoring",
  "url": "https://openlibrary.org/search?q=refactoring+fowler",
  "publicador": "Martin Fowler",
  "tipo": "referencia",
  "funcao": "Catálogo de pequenas mudanças que melhoram o código sem mudar o comportamento.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Designing Data-Intensive Applications",
  "url": "https://openlibrary.org/search?q=designing+data-intensive+applications+kleppmann",
  "publicador": "Martin Kleppmann",
  "tipo": "referencia",
  "funcao": "Como funcionam bancos de dados, filas e sistemas distribuídos por dentro. Ajuda a pensar em coleta e armazenamento de dados.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Banco de dados",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Making Embedded Systems",
  "url": "https://openlibrary.org/search?q=making+embedded+systems+white",
  "publicador": "Elecia White",
  "tipo": "referencia",
  "funcao": "Introdução prática a projetar sistemas embarcados: arquitetura de software, máquinas de estado, interrupções, memória e bibliotecas de hardware.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Firmware",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Test Driven Development for Embedded C",
  "url": "https://openlibrary.org/search?q=test+driven+development+embedded+c+grenning",
  "publicador": "James W. Grenning",
  "tipo": "referencia",
  "funcao": "Como testar firmware em C no computador antes de gravar na placa.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Firmware",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Definitive Guide to ARM Cortex-M3 and Cortex-M4 Processors",
  "url": "https://openlibrary.org/search?q=definitive+guide+arm+cortex-m3+cortex-m4+yiu",
  "publicador": "Joseph Yiu",
  "tipo": "referencia",
  "funcao": "Referência sobre a arquitetura dos Cortex-M: registradores, interrupções, exceções e depuração. Base para STM32 e SAM.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Firmware",
   "ARM",
   "STM32",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Art of Electronics",
  "url": "https://openlibrary.org/search?q=art+of+electronics+horowitz+hill",
  "publicador": "Paul Horowitz e Winfield Hill",
  "tipo": "referencia",
  "funcao": "O clássico da eletrônica prática: transistores, amplificadores operacionais, filtros, fontes e ruído.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Eletrônica",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Medical Instrumentation: Application and Design",
  "url": "https://openlibrary.org/search?q=medical+instrumentation+application+design+webster",
  "publicador": "John G. Webster",
  "tipo": "referencia",
  "funcao": "Instrumentação médica: biopotenciais, eletrodos, amplificadores, sensores, segurança elétrica.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Saúde",
   "Sinais biomédicos",
   "Eletrônica",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Biomedical Signal Analysis",
  "url": "https://openlibrary.org/search?q=biomedical+signal+analysis+rangayyan",
  "publicador": "Rangaraj M. Rangayyan",
  "tipo": "referencia",
  "funcao": "Análise de sinais biomédicos (ECG, EEG, EMG): filtragem, detecção de eventos, análise espectral e classificação.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Saúde",
   "Sinais biomédicos",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Principles of Neural Science",
  "url": "https://openlibrary.org/search?q=principles+of+neural+science+kandel",
  "publicador": "Eric Kandel e outros",
  "tipo": "referencia",
  "funcao": "O livro de referência em neurociência, do neurônio ao comportamento.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Saúde",
   "Pesquisa",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Kinesiologia do Sistema Musculoesquelético",
  "url": "https://openlibrary.org/search?q=kinesiology+of+the+musculoskeletal+system+neumann",
  "publicador": "Donald A. Neumann",
  "tipo": "referencia",
  "funcao": "Referência de cinesiologia e biomecânica das articulações, muito usada em fisioterapia.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Saúde",
   "Reabilitação",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Scientist and Engineer's Guide to Digital Signal Processing",
  "url": "https://www.dspguide.com",
  "publicador": "Steven W. Smith",
  "tipo": "referencia",
  "funcao": "Processamento digital de sinais explicado sem excesso de matemática: filtros, FFT, convolução. Gratuito no site do autor.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Sinais biomédicos",
   "Engenharia",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Pro Git",
  "url": "https://git-scm.com/book/pt-br/v2",
  "publicador": "Scott Chacon e Ben Straub",
  "tipo": "referencia",
  "funcao": "O livro oficial de Git, gratuito e em português. Do básico (commit, branch) ao avançado (rebase, hooks).",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Git",
   "Controle de versão",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Missing Semester of Your CS Education",
  "url": "https://missing.csail.mit.edu",
  "publicador": "MIT",
  "tipo": "referencia",
  "funcao": "Curso do MIT sobre o que se aprende por conta própria: terminal, shell, Git, editor, depuração e automação.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Terminal",
   "Git",
   "Treinamento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Automate the Boring Stuff with Python",
  "url": "https://automatetheboringstuff.com",
  "publicador": "Al Sweigart",
  "tipo": "referencia",
  "funcao": "Python para automatizar tarefas do dia a dia (planilhas, arquivos, e-mails). Gratuito online.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Python",
   "Treinamento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Think Python",
  "url": "https://greenteapress.com/wp/think-python-2e/",
  "publicador": "Allen B. Downey",
  "tipo": "referencia",
  "funcao": "Introdução a Python como linguagem de programação, para quem nunca programou. Gratuito.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Python",
   "Treinamento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Python Data Science Handbook",
  "url": "https://jakevdp.github.io/PythonDataScienceHandbook/",
  "publicador": "Jake VanderPlas",
  "tipo": "referencia",
  "funcao": "NumPy, pandas, Matplotlib e scikit-learn, em cadernos Jupyter. Gratuito online.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Python",
   "Dados",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "An Introduction to Statistical Learning",
  "url": "https://www.statlearning.com",
  "publicador": "James, Witten, Hastie e Tibshirani",
  "tipo": "referencia",
  "funcao": "Introdução ao aprendizado estatístico, com versões em R e em Python. Gratuito.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Estatística",
   "IA",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "OpenIntro Statistics",
  "url": "https://www.openintro.org/book/os/",
  "publicador": "Diez, Çetinkaya-Rundel e Barr",
  "tipo": "referencia",
  "funcao": "Livro de estatística introdutória, claro e gratuito. Bom para o primeiro curso de bioestatística.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Estatística",
   "Pesquisa",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "R for Data Science",
  "url": "https://r4ds.hadley.nz",
  "publicador": "Hadley Wickham e outros",
  "tipo": "referencia",
  "funcao": "Importar, limpar, visualizar e modelar dados em R. Gratuito online.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Estatística",
   "Dados",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Deep Learning",
  "url": "https://www.deeplearningbook.org",
  "publicador": "Goodfellow, Bengio e Courville",
  "tipo": "referencia",
  "funcao": "O livro-texto clássico de aprendizado profundo. Gratuito no site.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "IA",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Dive into Deep Learning",
  "url": "https://d2l.ai",
  "publicador": "Zhang, Lipton, Li e Smola",
  "tipo": "referencia",
  "funcao": "Aprendizado profundo com texto, código e matemática juntos, em cadernos. Gratuito.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "IA",
   "Python",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Mathematics for Machine Learning",
  "url": "https://mml-book.github.io",
  "publicador": "Deisenroth, Faisal e Ong",
  "tipo": "referencia",
  "funcao": "Álgebra linear, cálculo e probabilidade para entender aprendizado de máquina. Gratuito.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "IA",
   "Estatística",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Beej's Guide to C Programming",
  "url": "https://beej.us/guide/bgc/",
  "publicador": "Brian Hall",
  "tipo": "referencia",
  "funcao": "Guia gratuito e direto da linguagem C: ponteiros, memória, estruturas. Boa base para firmware.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Firmware",
   "Treinamento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Rust Programming Language",
  "url": "https://doc.rust-lang.org/book/",
  "publicador": "Steve Klabnik e Carol Nichols",
  "tipo": "referencia",
  "funcao": "O livro oficial de Rust, gratuito. Ponto de partida para o Rust embarcado.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Desenvolvimento",
   "Firmware",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Mastering the FreeRTOS Real Time Kernel",
  "url": "https://www.freertos.org/Documentation/02-Kernel/07-Books-and-manual/01-RTOS_book",
  "publicador": "Richard Barry",
  "tipo": "referencia",
  "funcao": "O livro oficial do FreeRTOS: tarefas, filas, semáforos, temporizadores e gerência de memória. Gratuito no site do FreeRTOS.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Firmware",
   "Treinamento",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Think Stats",
  "url": "https://greenteapress.com/wp/think-stats-2e/",
  "publicador": "Allen B. Downey",
  "tipo": "referencia",
  "funcao": "Estatística para quem programa: usa Python em vez de fórmulas. Gratuito.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Estatística",
   "Python",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Statistics Done Wrong",
  "url": "https://www.statisticsdonewrong.com",
  "publicador": "Alex Reinhart",
  "tipo": "referencia",
  "funcao": "Guia curto dos erros estatísticos mais comuns em artigos científicos, e como evitá-los. Gratuito online.",
  "instrucoes_baixar": "",
  "instrucoes_usar": "Leia gratuitamente no site.",
  "tags": [
   "Livro",
   "Estatística",
   "Pesquisa",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "gratis"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Don't Make Me Think",
  "url": "https://openlibrary.org/search?q=don't+make+me+think+krug",
  "publicador": "Steve Krug",
  "tipo": "referencia",
  "funcao": "Princípios de usabilidade para sites e aplicativos, curto e direto.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Design",
   "Interface",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "The Design of Everyday Things",
  "url": "https://openlibrary.org/search?q=design+of+everyday+things+norman",
  "publicador": "Don Norman",
  "tipo": "referencia",
  "funcao": "Por que objetos são difíceis de usar e como projetar bem. Base para projetar dispositivos que o paciente consiga usar.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Design",
   "Interface",
   "Saúde",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 },
 {
  "nome": "Metodologia do Trabalho Científico",
  "url": "https://openlibrary.org/search?q=metodologia+do+trabalho+científico+severino",
  "publicador": "Antônio Joaquim Severino",
  "tipo": "referencia",
  "funcao": "Manual de métodos para a vida acadêmica: leitura, fichamento, resumo, projeto e trabalho final. Clássico em português.",
  "instrucoes_baixar": "Procure o livro na Biblioteca Universitária da UFMG (catálogo Pergamum) ou na Minha Biblioteca, antes de comprar.",
  "instrucoes_usar": "Na Open Library dá para pedir o empréstimo digital. Também vale ver sebos e a Biblioteca Universitária da UFMG.",
  "tags": [
   "Livro",
   "Pesquisa",
   "Escrita científica",
   "A confirmar"
  ],
  "plataformas": [
   "Web"
  ],
  "acesso": [
   "pago"
  ],
  "padrao_nro": false
 }
]
$semente$::jsonb) loop
    if exists (select 1 from recursos where url_chave = public.recurso_url_chave(x->>'url')) then continue; end if;
    v_slug := public.recurso_slug(x->>'nome'); n := 1;
    while exists (select 1 from recursos where slug = v_slug) loop n := n + 1; v_slug := public.recurso_slug(x->>'nome') || '-' || n; end loop;
    insert into recursos (slug, nome, url, url_chave, publicador, tipo, funcao, instrucoes_baixar, instrucoes_usar, tags, plataformas, acesso, padrao_nro)
    values (v_slug, x->>'nome', x->>'url', public.recurso_url_chave(x->>'url'), x->>'publicador', x->>'tipo', x->>'funcao',
            x->>'instrucoes_baixar', x->>'instrucoes_usar', public.recurso_lista_limpar(x->'tags'), public.recurso_lista_limpar(x->'plataformas'),
            public.recurso_lista_limpar(x->'acesso'), coalesce((x->>'padrao_nro')::boolean, false));
    v_total := v_total + 1;
  end loop;
  raise notice 'Recursos novos: %', v_total;
end $$;

insert into public.migracoes(id, descricao) values('2.19.2_recursos_semente',
 'SOMA 2.19.2: semente do catálogo de Recursos (padrões da equipe, softwares, gravação de microcontroladores, benefícios de estudante, repositórios da NSA e indicações da equipe)')
on conflict(id) do nothing;
