# MediaPipe: detecção de rosto no aparelho

Usado no passo da foto do pedido de acesso ao LABBIO (`mod-biometria-rosto.js`)
para conferir, antes de enviar, se há um rosto, se ele está no oval e se a luz e o
contraste servem. Tudo roda no navegador de quem tira a foto: a imagem não vai a
nenhum servidor de terceiros.

| Arquivo | Origem | Licença |
|---|---|---|
| `vision_bundle.mjs` | npm `@mediapipe/tasks-vision@0.10.34` | Apache-2.0 |
| `wasm/vision_wasm_internal.js` e `.wasm` | o mesmo pacote (versão com SIMD) | Apache-2.0 |
| `blaze_face_short_range.tflite` | https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite (modelo BlazeFace, faces curtas) | Apache-2.0 |

Só a variante com SIMD vai no repositório (11 MB); navegadores sem SIMD caem na
mensagem "não foi possível verificar" e o envio de arquivo continua valendo.
Para atualizar: troque a versão no `npm pack`, copie os mesmos arquivos e rode
`testes/biometria-rosto.mjs`.

Apache License 2.0: https://www.apache.org/licenses/LICENSE-2.0
