# Percursos e cartão dedicado de ciclones

O cartão de furacões/tufões conserva Imagem/Detalhes no cabeçalho, local/nome e fonte existentes; troca o medidor genérico por vento máximo reportado, movimento, pressão, navegação do percurso e posições publicadas. Valores ausentes permanecem ausentes. O resumo móvel mostra vento; a expansão mostra a linha do tempo. Ao selecionar uma posição no celular, recolhe o cartão para liberar o mapa. Outros tipos mantêm seu cartão e virada existentes.

## Fontes e natureza das linhas

- Histórico recebido: posições existentes do coletor GDACS/NHC, até 24 registros, com cores pelos ventos quando disponíveis; datas são de recebimento, não horários oficiais reconstruídos. Clique no ponto consulta hora/vento.
- NHC: preserva a consulta KMZ sob demanda. Atributos de pontos são lidos de ExtendedData ou tabela textual na descrição. Sem executar HTML. Somente campos reconhecidos fornecem horas/ventos/datas; o nome original é preservado quando não há metadados reconhecidos. Vento MAXWIND do produto NHC é em nós e é convertido para km/h. A linha publicada mantém os vértices; sem suavização de previsão.
- JMA: consulta sob demanda apenas para eventos no Pacífico Oeste norte, sem produto NHC. `targetTc.json`, depois `data/TC…/forecast.json`. Associação exige nome exato normalizado, centro de análise a até 600 km do ponto recebido e emissão há no máximo 12h, sem aceitar emissão futura além de 10min. Não usa o ciclone mais próximo como substituto. Coordenadas JMA são latitude/longitude e são invertidas para GeoJSON. Prazos reais (incluindo +45/+69/+93/+117h) e UTC publicado são preservados; exibição de horário é em Brasília. Esse produto não fornece vento futuro: não é estimado nem repetido a partir do atual.
- Histórico JMA usa a linha publicada da análise, sem cores de intensidade por ponto. Previsão JMA usa centros publicados, círculos geodésicos dos raios oficiais de probabilidade em metros e tangentes fornecidas pela fonte. Não utiliza os campos de raio de vento para representar incerteza. Legenda distingue incerteza da posição e área de ventos.
- O antigo cone próprio, calculado somente com direção recente, deixa de ser desenhado. Sem previsão oficial, ficam histórico e estado explícito de indisponibilidade, sem rota futura inventada. Não há integração JTWC/BOM nesta versão.

Posições futuras usam linha tracejada e rótulos discretos. Há no máximo 12 rótulos no mapa, com distância mínima de 65px entre rótulos; até 24 pontos continuam acessíveis na lista. O marcador atual mantém a última posição do catálogo: não é movido para a posição da análise de outra fonte. Fontes/horários permitem distinguir as duas. Linhas cruzando 180° são divididas no antimeridiano. O enquadramento considera histórico/previsão, respeita a câmera de entrada existente e não interrompe gestos reais do usuário ao chegar o produto assíncrono. Ver percurso permite enquadrar novamente.

## Custo e limites

Não adiciona cron, polling, envios de Telegram, persistência KV ou backend novo. A JMA acrescenta consultas quando um ciclone elegível é selecionado: lista em cache local por 20 minutos, até quatro candidatos oficiais por busca, dois trabalhos simultâneos, deduplicação por evento, cache de quatro resultados por 20min e resultado negativo por 10min. As consultas reutilizam fetchWithCorsFallback/compartilhamento existentes e podem passar pelo Worker; não representam consumo extra zero. Os produtos da apresentação também são limitados a quatro. Não há animação contínua adicional.

Testes com rede externa bloqueada: cartão/navegação/limpeza em desktop e celular, fonte JMA simulada a partir de amostra pública, cache/reutilização; regressão NHC de boletins e parser KMZ. Modelo puro testa limites de metadados, posições inválidas, antimeridiano, associação nome/posição/data, conversão lat/lon, prazos não arredondados e ausência de vento inventado. Verificação direta de leitura na JMA durante o desenvolvimento confirmou o formato dos dados; testes não invocam Worker/DO/Telegram reais.

## Apresentação clássica (modelo 1)

O cartão usa vidro escuro no tema transparente, símbolo do ciclone e vento reportado em destaque. As posições oficiais ficam em uma linha horizontal com rolagem e botões acessíveis; horários e ventos só aparecem quando publicados. Movimento, pressão e classificação ficam abaixo. O modo resumido do celular preserva a leitura do vento. A alteração visual reutiliza os produtos e caches existentes, sem adicionar consultas, alarmes ou operações no Durable Objects/KV.
