# Argos Orbis TV — nowcasting probabilístico e efeitos de chuva

## Objetivo

Evoluir a meteorologia da TV sem substituir o boletim, a previsão por minuto, as imagens GOES ou as tarjas atuais. A mudança deve distinguir precipitação observada, estimativa de curtíssimo prazo e probabilidade dos modelos.

## Sequência de implementação

1. **Contrato probabilístico e ingestão**
   - Preservar a previsão por minuto Rainbow Weather como estimativa determinística de taxa/horário.
   - Acrescentar probabilidade de precipitação proveniente de ensemble meteorológico independente, com origem, horário de referência, geração e expiração explícitos.
   - Avaliar pelo menos duas famílias/modelos de ensemble disponíveis no Open-Meteo (por exemplo, ECMWF IFS ensemble e GEPS/GEM), sem somar ou fazer média cega de percentuais de fontes diferentes.
   - Exibir probabilidade individual e faixa de concordância entre modelos; se houver apenas uma fonte válida, identificá-la como probabilidade de um único modelo.
   - Não converter deslocamento GOES em trajetória da chuva, não inferir probabilidade a partir de taxa determinística e não usar dado vencido como condição seca.
   - Associar a probabilidade ao intervalo horário correto: a variável de precipitação pode representar o período anterior ao timestamp, conforme a documentação de cada modelo. Validar a semântica antes de apresentar janela de chegada.

2. **Fusão e leitura operacional**
   - Cruzar a estimativa por minuto com o ensemble horário sem esconder divergências.
   - Mostrar: chuva agora/prevista, janela provável de chegada, intensidade estimada, acumulado, probabilidade por modelo, concordância e idade/origem.
   - Quando as fontes divergirem, usar linguagem explícita de incerteza (ex.: “sinal de chuva, modelos divergentes”), nunca um número combinado sem método validado.
   - Sem dados válidos: “probabilidade indisponível”; nunca 0%.

3. **Efeitos visuais da chuva**
   - Manter os efeitos atuais de gotas no vidro e chuva na cena, mas calibrar a intensidade a partir da precipitação líquida prevista/observada válida.
   - Quatro faixas visuais: garoa/chuva fraca, moderada, forte e muito forte. A probabilidade de chuva, sozinha, não aumenta a intensidade visual.
   - Não transformar previsão de chuva futura em efeito de chuva atual. Antes da chegada, usar somente um sinal discreto de aproximação na tarja; iniciar partículas quando a chuva estiver ocorrendo segundo dado atual válido.
   - Trovoadas só podem receber tratamento visual especial quando houver condição explícita de fonte meteorológica; não inferir tempestade apenas por taxa alta.
   - Melhorar naturalidade com variação de tamanho/velocidade/direção, gotas no vidro com movimento suave, densidade progressiva e transições curtas. Evitar relâmpagos decorativos, flashes ou escurecimento abrupto sem dado de raios validado.
   - Respeitar FULL/SOFT/OFF, acessibilidade, economia de bateria, limite de memória e TVs 540p/720p/1080p. Não capturar nem amostrar o conteúdo da tela.
   - Encerrar e liberar animações/bitmaps ao fechar a tarja, trocar de tela, perder interatividade ou desabilitar efeitos.

## Regras científicas e de interface

- GOES ABI banda 13: temperatura de brilho dos topos de nuvens e movimento visual; não mede chuva.
- Rainbow minuto: estimativa por minuto de precipitação; não é pluviômetro nem radar observado.
- Ensemble: probabilidade derivada de membros/modelos; apresentar a fonte e o limiar de precipitação usado.
- Cemaden/pluviômetro: observação pontual, com estação, distância, horário e validade; não generalizar para todo o bairro.
- Radar observado e previsão de radar devem ter rótulos separados.
- Não chamar a funcionalidade de alerta oficial. Não emitir alerta sonoro novo nem alterar prioridade de alertas civis.
- Preservar o atualizador oficial e a versão estável 1.0.149 até validação e publicação explícitas.

## Critérios de aceite

- Testes de payload inválido, coordenada incorreta, lacunas temporais, unidades, timestamp futuro, dado vencido, expiração e falha de cada provedor.
- Testes de ensemble com membros secos/molhados, percentuais 0/100, divergência entre modelos, apenas uma fonte, nenhuma fonte e limiar documentado.
- Testes de fusão garantindo que a probabilidade não seja apresentada como intensidade nem como confirmação de chuva atual.
- Testes de efeitos para quatro níveis, previsão futura sem partículas, chuva atual, chuva fraca, tempestade somente com evidência de fonte, modo SOFT/OFF, animações desabilitadas e liberação de recursos.
- Renderizações Robolectric em telas compactas e 720p/1080p; validar legibilidade e que o efeito não cobre tarjas, mapas, números ou créditos.
- Validar limites de chamadas, cache, timeout e fallback no Worker. Falha de uma fonte não pode impedir o uso das demais.
- Executar apenas a validação Android TV Preview necessária; não disparar Smoke Test geral para mudanças exclusivas de `android-tv/**`.

## Referências técnicas

- Open-Meteo Ensemble API: https://open-meteo.com/en/docs/ensemble-api
- Open-Meteo GEM API (probabilidade baseada nos membros GEPS): https://open-meteo.com/en/docs/gem-api
- Open-Meteo ECMWF API: https://open-meteo.com/en/docs/ecmwf-api
- GOES/NASA GIBS e SSEC RealEarth permanecem restritos à leitura de imagens e movimento visual das nuvens, sem interpretação como radar de precipitação.
