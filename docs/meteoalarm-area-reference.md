# Localização dos avisos europeus

Os avisos continuam vindo dos feeds Atom oficiais do Meteoalarm. Alguns trazem apenas o nome e código da região, sem polígono ou coordenadas.

`data/meteoalarm-areas.json` contém **limites geográficos de referência**, publicados pelo serviço oficial `https://visservice.meteoalarm.org/api/v1/`. Não contém uma lista de alertas ativos e não cria avisos. A correspondência exige o mesmo país e nome de área (apenas normalização de espaços, caixa e Unicode). Limites servem para enquadramento e marcador representativo da região; não são desenhados como polígono de perigo.

O catálogo inclui áreas presentes nas consultas do dia e dos dois dias seguintes. Regiões verificadas anteriormente permanecem disponíveis por até 90 dias. Se uma região não estiver no catálogo, mostra-se o país com a indicação explícita de que a área exata está indisponível. Nesse caso não se cria marcador regional. Um retorno tardio nunca deve mover a câmera de outra seleção.

Atualização: `python tools/update-meteoalarm-areas.py`. O workflow `meteoalarm-areas.yml` executa a cada seis horas e também permite execução manual. O arquivo fica no próprio site, evitando CORS e sem consumir Workers KV ou exigir chave. Falhas parciais preservam as referências anteriores; falha total não substitui o arquivo.

Fonte/crédito: Meteoalarm / serviços meteorológicos nacionais · CC BY 4.0. Dados de alerta e horários de validade continuam sendo os do feed ao vivo, independentemente da atualização deste catálogo geográfico.
