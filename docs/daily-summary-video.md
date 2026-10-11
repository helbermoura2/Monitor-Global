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
