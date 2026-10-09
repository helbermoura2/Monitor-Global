# Alertas sísmicos no Telegram

O cron do Worker envia um cartão para cada novo registro de terremoto no Brasil, sem magnitude mínima. A regra global de M6+ continua funcionando. Não depende de uma aba aberta nem do filtro de magnitude da interface.

As fontes brasileiras consultadas são USP/RSBR, USGS, EMSC e GEOFON. A consulta cobre as últimas 72 horas, permitindo alertar publicações atrasadas. O epicentro é filtrado pela malha nacional do IBGE, para excluir países vizinhos presentes na mesma caixa de busca. O horário do cartão é o horário de origem do tremor, em BRT; pode ser anterior ao momento em que a fonte o publicou. Uma fonte indisponível não bloqueia as outras.

A primeira consulta bem-sucedida de **cada fonte** prepara uma linha de base silenciosa para os registros brasileiros menores que M6. Isso evita anunciar o catálogo antigo na ativação ou na recuperação de uma fonte que nunca foi inicializada. Os registros que aparecerem nas consultas seguintes passam a gerar alertas. Terremotos globais M6+ preservam o histórico anterior de envio.

O Durable Object `EARTHQUAKE_ALERTS` serializa o cron e as verificações manuais, mantém a linha de base e reserva cada ID antes do envio. Outra fonte pode registrar o mesmo tremor; a associação exige até 30 segundos, até 20 km e diferença de magnitude até 0,6 para eventos brasileiros. IDs diferentes da mesma fonte não são descartados por proximidade. Rejeições explícitas do Telegram podem ser tentadas novamente; entrega de resultado incerto fica registrada sem reenvio automático, para evitar mensagens duplicadas.

O histórico administrativo apresenta “Sismos M6+ e Brasil”. A rota administrativa `/telegram-m6-check` mantém o nome anterior por compatibilidade e informa a política brasileira e as fontes que falharam. Requer a mesma autorização administrativa de antes.

Dados geográficos: [IBGE, API de Malhas v3, país BR, qualidade intermediária](https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria), consultados em 9/10/2026. A geometria está incorporada ao Worker para dispensar consultas externas a cada alerta.

Validação: `node tests/unit/telegram-brazil-check.mjs` usa catálogos e Telegram simulados; não envia mensagens ao canal real.
