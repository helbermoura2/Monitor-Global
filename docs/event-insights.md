# Evolução, costas e relatos

O cartão oferece Evolução para todos os tipos de registro, Relatos para sismos
e Costas e horários para boletins de tsunami e sismos com boletim relacionado.
As janelas abrem somente por ação do usuário. A rotação aleatória aguarda a
leitura; eventos novos mantêm sua prioridade e fecham a janela ao mudar a seleção.

## Evolução

Registro local de origem/publicação, primeiro recebimento neste dispositivo,
mudanças de magnitude/profundidade/revisão/fontes, boletins correlacionados e
produtos oficiais disponíveis. Horário da agência e observação do navegador
são rotulados separadamente. Não reconstrói revisões que nunca foram recebidas.
O histórico persiste neste navegador, com limite de 240 eventos, 36 entradas
por evento, sete dias sem observação e 500 kB serializados. A seleção atual é
preservada na ingestão limitada dos feeds. Não grava histórico no Workers KV.

A correlação de histórias com origem exige o horário e a posição compatíveis;
boletins com relação apenas provável não se tornam parte de uma história certa.
Produtos USGS podem ser consultados manualmente; consultas de intensidade e
mapas oficiais existentes também registram suas publicações.

## Costas e horários

Mantém níveis regionais recebidos, e consulta sob demanda o texto exato do
boletim publicado no tsunami.gov ou o produto UUID no api.weather.gov.
Reconhece tabelas NOAA de chegada (ETA UTC, mês/dia) e de observações de estação
com amplitude e unidade explícitas (m, cm ou ft). Converte datas para BRT;
trata virada de ano e observações anteriores à emissão. Não estima propagação,
altura em terra ou horários ausentes. Uma estação mede amplitude local, não
inundação. Ausência de tabela reconhecida não é ausência de risco.

O passeio costeiro informa a região em foco à janela. O acesso também está
na legenda das costas. Boletins encerrados mantêm rótulo histórico.

## Onde foi sentido

USGS/DYFI, via evento nativo USGS associado ao registro e validado por origem.
Usa somente a versão preferida não excluída e o GeoJSON agregado de 10 km.
Total de respostas vem dos metadados; não soma redes, não assume população e
não converte nulos em zero. A camada usa centros das células publicadas,
agrupamento no zoom afastado e consulta por toque ou mouse. Magenta identifica
percepção relatada; cinza inclui respostas sem tremor percebido (CDI < II).
Não expõe localização de pessoas. Preserva a pintura de intensidade separada.
O EMSC recebe link para seu evento quando há ID nativo; não inventamos
coordenadas de relatos onde não há produto geográfico integrado.

Mostrar a camada é manual, interrompe a câmera do passeio atual, e remove a
camada anterior ao mudar a seleção. Consultas atrasadas não pintam outro evento.
Sem resposta ou sem produto, o estado permanece indisponível/não publicado.

## Rede e verificação

Integração no frontend, sem chave nova ou implantação do Worker. USGS tem cache
compartilhado de cinco minutos e limite de 40 itens, deduplicação de consultas,
timeouts e validação da fonte/associação. Boletins têm cache por publicação e
limite de 24 itens. Não há novo polling, mapas históricos não são carregados
em lote. A intensidade reaproveita a mesma consulta de detalhes do USGS.

Testes unitários cobrem revisão/persistência/limites, ETA real do boletim
WEPA40, observações com unidades e datas, nulos, células agregadas e associação.
Playwright cobre celular/desktop, janelas, mapa, troca de evento e falhas.
