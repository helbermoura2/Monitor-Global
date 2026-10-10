# Resumo diário do Telegram — Observatório editorial

Composição do modelo 6 com a tipografia editorial do modelo 5: fundo escuro, mapa à esquerda e maior sismo à direita, com semicírculo, magnitude, bandeira, local, horário BRT e profundidade arredondada. Os demais quatro eventos aparecem em linhas numeradas e os totais encerram a imagem. Noto Serif Display nos títulos, localidades e números; Open Sans nos metadados.

O mapa mostra as coordenadas oficiais dos cinco maiores registros do USGS, preservadas pela consulta diária. Pinos e números correspondem ao ranking, que usa magnitude decrescente e horário crescente nos empates. O enquadramento se adapta às coordenadas, inclusive ao meridiano de 180°. Números próximos são afastados com linhas até os epicentros, sem mover os pontos. Coordenadas ausentes não recebem pontos inventados; essa ausência aparece na legenda.

O gerador nativo em `daily-summary-renderer.mjs` produz um PNG de 900 × 1600 px, aumentando a altura quando nomes longos exigirem mais linhas. Países que já aparecem no cabeçalho do evento não são repetidos na localidade. Regiões oceânicas sem país identificado não recebem uma bandeira inventada; Ilhas Balleny usam a identificação regional da Antártida. Um dia vazio apresenta a ausência de sismos e totais zerados.

As fontes e a malha de terra simplificada são embutidas em `summary-editorial-assets.mjs`, gerado por `tools/build-summary-editorial-assets.py`. Não há downloads de mapas ou fontes durante a renderização. Noto Serif Display: SIL Open Font License; esta versão do Open Sans: Apache-2.0; avisos completos em `Summary-Fonts-LICENSE.txt`. Terra: Natural Earth, domínio público. As 88 bandeiras permanecem no atlas `summary-flags.mjs`: Flagpedia/flagcdn.com; Antártida: Twemoji.

A atualização altera a imagem e preserva coordenadas na consulta: janela de envio BRT, persistência no Durable Object, bloqueio de envios duplicados e tratamento de timeout permanecem. Resumos anteriores já armazenados mantêm suas imagens. Não é necessário reenviar um resumo para testar. `/health` informa `dailySummaryDesign: observatorio-editorial-v1`.

Validação: `node tests/unit/daily-summary-design-check.mjs` e `node tests/unit/telegram-history-check.mjs`. A amostra do teste reproduz os cinco eventos da imagem aprovada, com coordenadas reais. Também cobre agrupamento visual, 180°, nomes longos, dados ausentes, dia vazio, coordenadas na consulta e ausência de downloads na renderização. Para gerar uma prévia local: `SUMMARY_PREVIEW_PATH=/tmp/resumo.png node tests/unit/daily-summary-design-check.mjs`.
