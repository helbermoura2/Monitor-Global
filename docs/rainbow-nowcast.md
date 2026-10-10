# Previsão de chuva por minuto — Rainbow

O servidor consulta `GET https://api.rainbow.ai/nowcast/v1/precip-global/{longitude}/{latitude}` com o segredo `RAINBOW_API_KEY` no cabeçalho `Ocp-Apim-Subscription-Key`. A chave e respostas de erro da fonte nunca são enviadas ao navegador. Não são necessárias as APIs Weather nem Tiles para este recurso. Cadastro: https://developer.rainbow.ai/signup/ ; documentação: https://doc.rainbow.ai/api-ref/nowcast/ .

## Ativação

Cloudflare → Workers e Pages → `black-sky-9ba0` → Configurações → Variáveis e segredos → Adicionar → tipo Segredo → nome `RAINBOW_API_KEY` → valor da chave Nowcast → salvar/aplicar. O frontend não recebe esse segredo. `/health` informa apenas se a chave e o controle persistente estão presentes; isso não comprova que a chave seja válida ou que o local tenha cobertura.

## Consumo

O portal anuncia 5.000 consultas gratuitas mensais e dados atualizados a cada dez minutos. O teto do projeto é 4.500 chamadas mensais, com até 150 por dia UTC. São limites globais, compartilhados por todas as coordenadas e visitantes. Em 31 dias, um ponto continuamente solicitado a cada dez minutos utiliza 4.464 chamadas. Outras localidades, erros e testes também consomem a cota. O teto diário restringe consumo abrupto e mantém margem mesmo se o mês de faturamento do fornecedor usar outro fuso. Uso da mesma conta/chave fora do projeto não está abrangido pelo contador.

Uma instância dedicada `global-rainbow-nowcast-v1` do Durable Object `EARTHQUAKE_ALERTS` existente serializa as operações; não há nova migração nem chamadas ao Telegram. A reserva persistente ocorre antes de cada chamada, inclusive erros, timeouts e dados inválidos. Ausência de armazenamento, contador inválido ou falha ao reservar impedem a chamada. O mês/dia corrente substitui os anteriores, mantendo armazenamento limitado. Não há tentativas automáticas de outro endpoint que dupliquem consumo.

Cache compartilhado de dez minutos, com até 32 coordenadas e cache negativo. Coordenadas são arredondadas a três casas (~100 m), compatíveis com o produto anunciado de ~1 km; não usamos precisão de rua. Erros de autenticação, limite externo e falhas da fonte impõem pausa global de dez minutos. Ao atingir o teto diário/mensal, o servidor indica renovação; cache ainda válido continua disponível e o frontend passa aos modelos horários quando não houver nowcast válido. Nenhum cron consulta o Rainbow: chamadas ocorrem por demanda, com aba visível pelo scheduler existente.

## Exibição

O nowcast tem preferência na barra e no painel meteorológico; os modelos e a observação METAR continuam identificados separadamente. Tocar no chip de chuva abre o painel. O gráfico SVG mostra 60 minutos e mm/h, sem laço de animação, dependência de gráficos nem tiles de radar. “Agora” é estimativa do fornecedor, não medição local. A localização padrão da cidade e a localização GPS selecionada continuam distintas; para bairro é necessário selecionar seu ponto.

O cliente utiliza intervalos presentes/futuros, não `summary.intensity` (máximo de quatro horas). Faixas descritivas: chuva fraca <2,5; moderada <7,5; forte <50; muito forte >=50 mm/h. Limiar de precipitação: 0,1 mm/h; tipo `no_precipitation` não gera início. Término requer dez intervalos secos consecutivos para não interpretar uma breve pausa como fim da chuva. Acumulado integra taxa × duração real dos intervalos, incluindo intervalos parciais. Estas escolhas são regras de apresentação do projeto, não classificação de alerta oficial.

Dados ausentes, de outro ponto, vencidos, futuros, negativos, nulos, com intervalo irregular ou série descontínua não são usados. Sem cobertura não significa sem chuva. “Chuva: s/ previsão” foi substituído por “Previsão indisponível”. Fonte com link ao Rainbow é exibida junto ao gráfico, conforme termos de atribuição.

## Validação

`node tests/unit/rainbow-nowcast-check.mjs` verifica limites persistentes, concorrência real através do Worker/DO, reinício, reservas em falhas, isolamento de credenciais e interpretação da série. Playwright cobre gráfico/barra em computador e celular, abertura pelo chip, reserva por modelos, troca de ponto e resposta tardia. Testes utilizam dados simulados identificados como fixtures; validar disponibilidade real exige cadastrar a chave e consultar o endpoint.
