# Rainbow no Monitor Global

A mesma chave `RAINBOW_API_KEY` cadastrada como segredo no Worker autentica Nowcast, Weather e Tiles, desde que a assinatura Rainbow permita o produto. A chave nunca vai ao navegador. Nenhuma nova variável ou migração de Durable Object é necessária.

| Produto | Uso no site | Cache compartilhado | Limite do projeto/mês | Limite/dia UTC |
|---|---|---|---|---|
| Nowcast | Chuva minuto a minuto | 10 min por localização | 4.500 | 150 |
| Weather | Temperatura, sensação, umidade, vento, UV, pressão; previsão horária e cinco dias | 1 h por localização | 4.500 | 150 |
| Tiles | Camada atual de precipitação estimada | Metadados 10 min; até 48 imagens de quadros das últimas 2 h | 27.000 | 800 |

Limites globais para todos os visitantes, armazenados persistentemente. Cada chamada ao fornecedor é reservada antes do envio, inclusive falhas. Cada produto usa uma instância separada da classe `EarthquakeAlertDelivery`, com fila serial. Os metadados contam na cota de Tiles por precaução. Respostas já armazenadas não fazem nova chamada. Falha de armazenamento bloqueia chamadas ao fornecedor. Os limites não contabilizam uso da mesma chave fora deste projeto.

Rotas públicas: `/rain-weather?lat=...&lng=...`, `/rainbow-snapshot`, `/rainbow-tile/{snapshot}/{z}/{x}/{y}`. A prévia do celular também usa `/rainbow-tile/{snapshot}/{offset}/{z}/{x}/{y}`, com deslocamento previsto em segundos, de 0 a 7200 em passos de 600. Offset zero compartilha o cache da rota anterior; previsões têm chaves separadas. Todas usam o mesmo orçamento protegido de Tiles. Não aceitam URLs arbitrárias. Weather valida coordenadas, unidades, idade e continuidade horária. Tiles aceita zoom até 7 e snapshots reais das últimas duas horas, com PNG validado e tamanho limitado. Autenticação não é encaminhada em redirecionamentos.

A tela experimental do celular tem nove quadros sob comando (−60, −30, 0, +20, +40, +60, +80, +100 e +120 minutos em relação ao snapshot), sem pré-carregar quadros ocultos. A reprodução termina ao chegar ao último quadro e pausa em segundo plano. Não modifica a câmera do site nem as telas da TV. O gráfico usa a previsão por minuto já protegida para a Liberdade; não extrapola imagens de satélite e não chama modelos de linguagem. Dados indisponíveis ou vencidos nunca são apresentados como tempo seco.

A camada fica desligada ao abrir o site. Só carrega tiles visíveis ao ser ativada e consulta novo quadro a cada dez minutos enquanto a página estiver visível. Não há animação de quadros. Rainbow usa a paleta TWC (`color=9`); a reserva RainViewer mantém sua paleta existente. O mapa identifica a fonte e distingue estimativa Rainbow de radar observado RainViewer. Erro da fonte Rainbow ou limite gratuito aciona a reserva; desligar cancela a instalação de respostas pendentes. Falhas de outras fontes do mapa não acionam essa troca.

Weather prefere Rainbow, mantendo Open-Meteo/wttr como reserva. Uma previsão horária não substitui o Nowcast de chuva por minuto nem a observação METAR. As consultas simultâneas do cabeçalho e do painel compartilham a mesma promessa e o mesmo cache.

## Vulcões

O catálogo continua sendo consultado a cada hora, com verificação de atividade urgente a cada minuto. Nova explosão, lava, erupção, elevação oficial ou mudança relevante em novo boletim de cinzas ganha `NOVO` por três minutos, câmera e explicação na frente do cartão, mesmo em um vulcão conhecido. Reconfirmações e boletins anteriores não criam nova atividade. Metadados de aviso e altura de cinzas são mantidos no merge. Um horário desconhecido do boletim não é substituído pelo horário de cada consulta.

A fila permanece subordinada aos sismos M5+. Lava tem apresentação de até 45 s; outras atividades, 40 s. A detecção depende da publicação das fontes monitoradas (USGS/VONA, VAAC, GDACS/GVP); não detecta uma explosão antes do boletim da fonte.

Referências: [Weather](https://doc.rainbow.ai/api-ref/weather/), [Tiles](https://doc.rainbow.ai/api-ref/tiles/), [Paletas](https://doc.rainbow.ai/tile_colors/).
