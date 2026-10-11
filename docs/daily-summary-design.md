# Resumo diário — referência editorial

Composição do segundo modelo enviado em 11/10/2026: fundo azul escuro, título em duas linhas, mapa mundial sem moldura à esquerda, maior sismo dentro do destaque circular à direita, quatro eventos em tabela e totais em cinco colunas. O cabeçalho recebe o logo de radar do Monitor Global; o rodapé traz a fonte real (USGS), monitorglobal.top e a origem das distâncias.

Cormorant Garamond no título principal e Inter nos demais textos, números e legendas, conforme a indicação do usuário. A imagem de referência não identifica as fontes originais; estas são as famílias escolhidas para reproduzir o aspecto visual. Arquivos e licenças SIL OFL em `assets/summary-fonts/`. O gerador usa algarismos alinhados, vírgula decimal, quilômetros inteiros e horários BRT.

Os cinco epicentros usam as coordenadas oficiais preservadas pela consulta diária USGS. A numeração corresponde à magnitude decrescente e ao horário crescente nos empates: evento principal 1 e demais eventos 2–5. Rótulos próximos recebem linhas até os pontos sem alterar coordenadas. Ausências de coordenadas ou país não geram dados nem bandeiras inventados. A coluna distância mede a distância geodésica a São Paulo, identificada no rodapé.

O gerador nativo em `daily-summary-renderer.mjs` produz PNG de 900 × 1344 px e aumenta a altura para nomes longos. Fontes e terra simplificada Natural Earth (domínio público) ficam embutidas em `summary-editorial-assets.mjs`; não há downloads durante a renderização. Reconstrução: `python3 tools/build-summary-editorial-assets.py` (Pillow). Bandeiras mantêm o atlas existente Flagpedia/flagcdn.com e Twemoji para Antártida.

Janela de envio BRT, persistência no Durable Object, proteção contra duplicação e timeouts permanecem. Resumos anteriores armazenados mantêm suas imagens. `/health` informa `dailySummaryDesign: referencia-editorial-v3`.

Validação: `node tests/unit/daily-summary-design-check.mjs` e `node tests/unit/telegram-history-check.mjs`. Abrange coordenadas reais, agrupamentos, meridiano de 180°, nomes longos, dia vazio, dados ausentes e renderização sem rede. Prévia: `SUMMARY_PREVIEW_PATH=/tmp/resumo.png node tests/unit/daily-summary-design-check.mjs`.
