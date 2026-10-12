-- ============================================================
-- SOMA 2.19.2: a semente do catálogo de Recursos
--
-- Popula o catálogo com 61 recursos: os padrões da equipe (VS Code e Git
-- Bash), softwares (Figma, Altium, Fusion, SOLIDWORKS, Affinity, KiCad,
-- GitHub Desktop), a gravação de microcontroladores pelo VS Code (ESP32,
-- STM32, ATSAM, Raspberry Pi, Arduino), os benefícios de estudante (GitHub
-- Student Developer Pack e parceiros), repositórios da NSA e as ferramentas
-- indicadas pela equipe (para o Claude Code e outras).
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
  "nome": "Benefícios do e-mail @ufmg.br",
  "url": "https://ufmg.br",
  "publicador": "UFMG",
  "tipo": "beneficio",
  "funcao": "Quem tem e-mail institucional @ufmg.br consegue verificar-se como estudante nos programas educacionais deste catálogo (GitHub Education, Figma, JetBrains, Notion, Autodesk, Azure) e pode ter serviços próprios da UFMG. A lista de serviços da universidade ainda precisa ser conferida: complete este item.",
  "instrucoes_baixar": "Não há o que baixar.",
  "instrucoes_usar": "O que já sabemos: use o e-mail @ufmg.br para criar as contas e pedir a verificação de estudante em cada programa. O que falta confirmar com o suporte de TI da UFMG: quais serviços a universidade oferece com o e-mail (e-mail e armazenamento em nuvem, pacote de escritório, VPN, acesso a periódicos, rede Wi-Fi), e como pedi-los. Quem descobrir, edite este item.",
  "tags": [
   "Estudante",
   "UFMG",
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
