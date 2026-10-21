# Investigação de sessão prolongada em DeX — 2026-10-21

Um diagnóstico recebido de uma sessão em Samsung Internet/DeX mostrou cerca de 194 minutos visíveis, heap reportado em degraus até 273 MiB e alto número de entradas Resource Timing. O formato anterior não separava as origens desses recursos. Não permite atribuir as entradas a imagens, mídia, APIs, cache ou consumo Durable/KV, nem comprovar vazamento pelo heap aproximado.

## Inspeção e reprodução controlada

Os caches de população (80 entradas), produtos oficiais (4), intensidade real (200), geometria de tremor (4 / 100 mil vértices), correlação (128), países (12 mil) e previsão de lugares (8) possuem limites explícitos. Isso não comprova que todos os caminhos liberam memória nem mede o cache/GPU do MapLibre.

A ferramenta `tools/mobile-session-audit.cjs` aceita agora viewport, DPR e limitação de CPU por ambiente. Ensaio local: 1442×644, DPR 1,33125, CPU sem redução artificial, 90 trocas entre sismo/vulcão/tempestade/incêndio/enchente/vento após aquecimento das categorias; 95,4 segundos medidos. Arquivo de resultados: `audits/dex-session-20261021.json`.

Heap principal após GC forçado: 22,04 → 23,71 MiB, pico observado 24,04 MiB. Elementos conectados: 1357 → 1386; ouvintes JS: 428 → 430; canvas: 2 em todas as amostras finais; zero erros de página capturados. Não reproduziu o crescimento reportado. Não é teste no S25 Ultra/Samsung Internet nem teste de longa duração; usa Chromium de laboratório, rede externa bloqueada, camadas raster removidas e câmera instantânea. Exclui GPU, workers, imagens externas e custo de voo. Não extrapolar esses números para RAM total do telefone ou conclusão de ausência de vazamento.

Reprodução:

```sh
# Servidor estático local em 4173; todas as tentativas externas do navegador são abortadas.
AUDIT_WIDTH=1442 AUDIT_HEIGHT=644 AUDIT_DPR=1.33125 AUDIT_CPU=1 \
AUDIT_CYCLES=90 AUDIT_DWELL_MS=500 node tools/mobile-session-audit.cjs
```

## Próxima evidência no aparelho

Coletor 2: contadores por categorias fixas, duração e bytes quando expostos, erros por categoria, indicação de cache somente quando os tamanhos estão disponíveis; contagens de fontes/camadas/imagens do mapa, animações e marcadores a cada cinco minutos, DPR e modo de economia. Continua opt-in/local, sem envio, novas consultas ou testes de alerta. Não retém URLs, coordenadas, conteúdo dos eventos, geometrias ou mensagens de erro.

Após atualizar a página, iniciar nova medição no aparelho e usar normalmente por 2–4 horas. A leitura das categorias e estados por amostra permitirá separar carga de imagens/mídia/consultas e crescimento de objetos do mapa. Ainda não foi identificada a causa do volume de recursos da sessão recebida; nenhum limite de cache do mapa, efeito visual ou política de alertas foi alterado sem evidência.

Validação do coletor: três testes offline de exportação, ausência de consultas extras, persistência/parada/limites, memória indisponível, retomada de relatório antigo e classificação de 1013 entradas simuladas em categorias limitadas, sem retenção de URLs ou parâmetros privados.
