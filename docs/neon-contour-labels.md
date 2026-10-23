# Contornos MMI: apresentação e rótulos

Os contornos permanecem vazados, com a mesma geometria, cores e cálculo científicos. Uma camada de brilho discreto compartilha a fonte existente, sem alterar a câmera.

Cada rótulo mostra MMI e descrição, seguidos da distância em quilômetros. No modelo radial, a distância é o raio calculado. Nos contornos oficiais irregulares, é a distância geodésica do trecho identificado ao epicentro, nunca um raio único. Intensidade estimada não confirma danos.

Os rótulos usam vértices reais e evitam o epicentro, painéis, avisos e outros rótulos. A legenda conserva todas as faixas quando falta espaço. No celular ela permite rolagem com barra compatível com o tema. O layout executa no máximo uma vez a cada 150 ms durante mudanças; observadores, marcadores e listeners são removidos ao encerrar o evento. Não há consulta adicional ao backend.

Validação offline: testes unitários de distância e posicionamento; navegador em 360, 411, 1280 e 1920 pixels, incluindo avisos dinâmicos, ocultação e limpeza das camadas. Os testes usam Chromium local, sem envio ao Telegram.
