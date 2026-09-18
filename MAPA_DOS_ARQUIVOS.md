# v28.2 — filtros mobile vertical restaurados (magnitude + chips)
# Mapa dos arquivos — Monitor Global

Guia em português para achar o que mexer. **Não renomeamos os arquivos** (quebraria o site). Use este mapa.

## ⭐ Resumo do dia (imagem Top 5 + Brasil)

| Arquivo | O que faz |
|---------|-----------|
| **js/story-share.js** | Gera a imagem "Resumo do dia" e o Story de cada evento |
| **js/feed-utils.js** | Filtro "é Brasil?" por coordenadas (`coordsInBrazil`) |

## Sismos (terremotos)

| Arquivo | O que faz |
|---------|-----------|
| js/sismo-fontes.js | Busca USGS, EMSC e outras fontes de sismo |
| js/sismo-metrics.js | Cálculos de magnitude / energia |
| js/orquestrador-feeds.js | Junta todas as fontes e atualiza a lista |
| js/nucleo-estado.js | Estado global (`globalEvents`, alertas, etc.) |

## Brasil / clima / alertas

| Arquivo | O que faz |
|---------|-----------|
| js/brasil-hub.js | Hub de dados do Brasil |
| js/inmet-avisos.js | Avisos do INMET (tempestade, umidade…) |
| js/tempestades.js | Tempestades |
| js/tsunami-enchente.js | Tsunami e enchente |
| js/cemaden-risco.js | Risco CEMADEN |
| js/alertas-locais-sp.js | Alertas locais SP |

## Vulcões, ciclones, fogo

| Arquivo | O que faz |
|---------|-----------|
| js/vulcao.js | Vulcões |
| js/furacoes-gdacs.js | Furacões / ciclones (GDACS) |
| js/incendios.js | Incêndios |
| js/geo-e-ciclone-utils.js | Bandeiras, países, nomes de ciclone |

## Mapa e interface

| Arquivo | O que faz |
|---------|-----------|
| js/mapa.js | Mapa |
| js/painel-e-lista.js | Lista lateral de eventos |
| index.html | Página principal (carrega todos os scripts) |
| css/… | Estilos visuais |

## Como atualizar sem se perder

1. Diga o que quer mudar (ex.: "resumo do dia", "vulcão no Brasil").
2. Mande o **zip inteiro** de novo — não precisa achar o arquivo.
3. Receba de volta só os arquivos alterados (ou o zip já corrigido).

### Arquivos que mudaram nesta correção (set/2026)

- `js/story-share.js` — Top 5 com horário de Brasília + filtro Brasil rigoroso
- `js/feed-utils.js` — bbox Brasil um pouco mais apertado
- `js/nucleo-estado.js` / `js/orquestrador-feeds.js` / `js/inmet-avisos.js` — lista de sismos visível para o resumo
