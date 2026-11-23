# Argos Orbis TV 1.0.140 — Mapas alinhados à tarja em todos os eventos

## Problema observado na TCL P7K
Na foto de replay, a borda direita do painel `LOCAL DO EPICENTRO` ultrapassa
a borda da tarja de notícias. O posicionamento anterior era `FRAME_X=649`
para largura de 310, produzindo direita em 959; a tarja termina em
`OledNewsChrome.RIGHT=925`. Desalinhamento: 34 unidades na tela virtual
de 960 unidades de largura.

## Correção comum
`MapInset.FRAME_X` agora é derivado de `OledNewsChrome.RIGHT-FRAME_WIDTH`,
produzindo 615..925. É um único referencial usado pelos renderizadores:

- `NewsBannerView`: M6+ global, sismos regionais, tsunami, replay e resumo.
- `BrazilNationalBannerView`: sismos Brasil e respectivos replays.
- `TvBroadcastInfoView`: previsão meteorológica, chuva e satélite infravermelho.

Os painéis mantêm largura 310, altura 176, mesmo raio e estrutura de título,
imagem e rodapé, independentemente de top/bottom, nível de zoom ou transição.

O mapa pequeno de estado **dentro** da tarja nacional continua sendo um
componente de conteúdo, não o painel de mapa de posição superior/inferior.
Não foram alterados a posição dos blocos de texto, a tarja, o logo oficial,
os efeitos de chuva, o radar da Defesa Civil, a coleta de dados ou os alertas.

## Testes atualizados
- `TvBroadcastInfoViewTest.satelliteAndSeismicMapShareOneStableVisualAnchor`:
  verifica início x615, final x925 e ausência de pixels além do limite.
- `test_tv_compact_motion.py`: verifica a constante compartilhada e os três
  consumidores (sismos, Brasil e meteorologia).
- `versionCode` incrementado para 10140 para atualização sobre 1.0.139.

## Reversão
Reverter somente a alteração `MapInset.FRAME_X` e os testes correspondentes
sem desfazer os ajustes anteriores de tarja. Em uma nova publicação, aumentar
novamente o `versionCode` (não instalar versões antigas por cima da atual).

## Publicação
O código no repositório não é equivalente a um APK assinado. Após os testes
Android e a assinatura oficiais, o canal `distribution/stable.json` deve
indicar 1.0.140 com SHA-256 verificável, antes de recomendar atualizar a TV.
