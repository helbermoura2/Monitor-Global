# Vídeo curto do resumo sísmico

Amostra vertical 720 × 1280, 25 fps, MP4 H.264 com `faststart`, sem áudio. Abertura de dois segundos com epicentros, quatro segundos para cada um dos cinco maiores sismos e encerramento de três segundos. O mapa acompanha as coordenadas com transições suaves; não representa propagação de ondas ou estimativa de área atingida.

Cormorant Garamond e Inter são carregadas dos arquivos locais. Magnitudes, horários BRT, países, bandeiras e cores reutilizam os dados e auxiliares do resumo do projeto. A marca AMOSTRA fica visível: este gerador serve à avaliação do formato, não publica no Telegram nem ativa um cron.

Uso em ambiente com Node, Playwright/Chromium, ffmpeg e ffprobe:

```sh
node tools/build-summary-video.mjs caminho/resumo.json /tmp/resumo.mp4
```

O JSON deve conter `{day,events}` como a consulta diária existente: eventos com id, mag, place, time (milissegundos), lat, lon e depth (km). Ranking por magnitude decrescente e horário crescente nos empates. Sem parâmetros, usa a fixture de 01/10/2026. Coordenadas ausentes não recebem epicentros inventados. Magnitude e profundidade mantêm unidades e arredondamento do projeto.

A renderização é offline e ocorre em processo separado do site. O Worker Cloudflare atual não executa Chromium/ffmpeg. Envio automático diário requer um executor externo, além do controle persistente de entrega; não está ativado nesta amostra. Não há alteração de consumo gráfico nos celulares que acessam o mapa.

A validação do gerador verifica codec, dimensões e duração com ffprobe. Prévia validada com cinco eventos da fixture, ~25 s e <1 MB, incluindo inspeção de enquadramento, textos e bandeiras. MP4 e arquivos intermediários ficam fora do repositório.

## Amostra com mapa de satélite

```sh
node tools/build-summary-video.mjs caminho/resumo.json /tmp/resumo-satelite.mp4 --satellite
```

Usa as mesmas fontes do mapa principal: Esri World Imagery e Reference/World Boundaries and Places. O mapa ocupa mais espaço, com título compacto, fundo levemente escurecido e créditos visíveis. A câmera aproxima cada epicentro e retorna ao panorama no encerramento. As camadas representam imagens de satélite, nomes e fronteiras. A modalidade de satélite inclui a pintura de intensidade estimada e os pontos dos epicentros, sem os anéis pulsantes.

`tools/summary-video-satellite.mjs` calcula todas as posições da câmera e baixa antecipadamente os tiles necessários. Cache local em `/tmp/monitor-global-satellite-tiles`, sem chaves ou consultas às APIs meteorológicas. A opção requer rede durante o preparo; depois, o vídeo é gravado com os mapas já carregados. Interrupções ou respostas inválidas impedem a geração em vez de produzir um mapa vazio. Não altera o site ou a programação de envio no Telegram.

## População e mecanismo focal

Acrescente `--impact` para exibir dois campos adicionais. Cada evento passa a durar cinco segundos (30 segundos para cinco sismos), dando tempo de leitura às legendas.

```sh
node tools/build-summary-video.mjs caminho/resumo.json /tmp/resumo-impacto.mp4 --satellite --impact
```

O preparo consulta os detalhes oficiais de cada identificador no USGS e confere origem, horário e magnitude. A exposição III+ vem do XML PAGER ou de um resultado PAGER/WorldPop válido já presente em `imageExposure`/`exposure` no JSON. São faixas cumulativas: não somar III+, V+ e VI+. O número representa população potencialmente exposta, não pessoas confirmadamente atingidas ou relatos de tremor.

Se não houver exposição disponível, o campo informa a ausência. Relatos DYFI aparecem separados e identificados como relatos no USGS, sem substituir população exposta nem converter ausência em zero. Não são iniciadas consultas novas ao WorldPop pelo gerador.

O tipo de falha usa exclusivamente o rake de uma solução publicada de moment tensor ou mecanismo focal: inversa, normal ou predominantemente transcorrente. Produtos retirados são ignorados e preferências oficiais respeitadas. Setas são um esquema do deslocamento na falha; não demonstram a direção de movimento de uma placa inteira. Quando não há mecanismo no USGS, o gerador consulta o catálogo EMSC e seu serviço separado de moment tensors. A associação exige uma única origem, até 30 segundos, 80 km e uma unidade de magnitude da origem selecionada; soluções de outro UNID são rejeitadas. Uma correspondência ambígua permanece sem mecanismo. A solução preferida do EMSC tem precedência entre as soluções válidas, e a instituição aparece como “GFZ via EMSC” ou “GCMT via EMSC”, por exemplo. Sem solução ou em caso de falha de consulta, aparece “Sem solução nas fontes consultadas”, sem inferência por localização ou profundidade. Essa integração é do gerador de vídeo; não altera os cartões do mapa ou o envio automático ao Telegram. Serviço oficial: https://www.seismicportal.eu/mtws/.

Validação: `node tests/unit/summary-video-impact-check.mjs`, com soluções válidas/ausentes, produtos removidos, preferência oficial, divergência de origem e distinção entre relatos e população. Amostra de 01/10/2026 consultada: 25 relatos no primeiro evento, sem PAGER ou mecanismo focal; ausência preservada.

Também foi gerada e inspecionada a amostra de 09/10/2026 a partir dos cinco maiores registros da consulta USGS (janela BRT), com PAGER disponível nos cinco e mecanismo focal nos três primeiros. MP4 H.264 vertical validado, 29,96 s, 25 fps, ~3,5 MB. Os dois eventos sem solução focal mantêm o estado ausente. Essa consulta é apenas a seleção de uma amostra e não cria agendamento de entrega.

## Pintura do mapa ao vivo e identidade do projeto

```sh
node tools/build-summary-video.mjs caminho/resumo.json /tmp/resumo-pintado.mp4 --satellite --impact --paint
```

A pintura é padrão com `--satellite`; `--paint` também permite aplicá-la ao mapa vetorial. Substitui os anéis pulsantes por um epicentro vermelho e branco e a pintura de intensidade estimada. Reutiliza `SeismicImpactModel` e as terras Natural Earth de 50 m do mapa ao vivo: as cores ficam nas terras, sem pintar o oceano. Nomes e fronteiras são desenhados sobre a pintura. A câmera aproxima a região de intensidade V+ e o epicentro, com margem, enquanto a legenda informa que intensidade estimada não confirma danos. O parâmetro numérico de profundidade original é preservado para os cálculos, apesar do arredondamento na apresentação.

Com satélite, o preparo também procura uma grade USGS ShakeMap com ruptura finita publicada e origem compatível, como o mapa ao vivo. Se o JSON incluir uma grade de ruptura `shaking.grid` validada pelo modelo compartilhado, ela é reutilizada. Essas grades têm precedência sobre a atenuação radial; o gerador não inventa direção de ruptura. Sem essa grade, utiliza a estimativa radial do mapa ao vivo. Não representa relatos confirmados de percepção ou extensão de tsunami.

O cabeçalho agora usa o SVG Radar Scope extraído diretamente de `index.html`, com a cunha azul e os três anéis do logo oficial, em todas as modalidades do vídeo. Previews são gerados fora do navegador do usuário; o mapa ao vivo e seu consumo gráfico não mudam.
