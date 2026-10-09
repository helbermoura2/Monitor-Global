# Alertas sísmicos no Telegram

O cron do Worker envia um cartão para cada novo registro de terremoto no Brasil, sem magnitude mínima. A regra global de M6+ continua funcionando. Não depende de uma aba aberta nem do filtro de magnitude da interface.

As fontes brasileiras consultadas são USP/RSBR, USGS, EMSC e GEOFON. A consulta cobre as últimas 72 horas, permitindo alertar publicações atrasadas. O epicentro é filtrado pela malha nacional do IBGE, para excluir países vizinhos presentes na mesma caixa de busca. O horário do cartão é o horário de origem do tremor, em BRT; pode ser anterior ao momento em que a fonte o publicou. Uma fonte indisponível não bloqueia as outras.

A primeira consulta bem-sucedida de **cada fonte** prepara uma linha de base silenciosa para os registros brasileiros menores que M6. Isso evita anunciar o catálogo antigo na ativação ou na recuperação de uma fonte que nunca foi inicializada. Os registros que aparecerem nas consultas seguintes passam a gerar alertas. Terremotos globais M6+ preservam o histórico anterior de envio.

O Durable Object `EARTHQUAKE_ALERTS` serializa o cron e as verificações manuais, mantém a linha de base e reserva cada ID antes do envio. Outra fonte pode registrar o mesmo tremor; a associação exige até 30 segundos, até 20 km e diferença de magnitude até 0,6 para eventos brasileiros. IDs diferentes da mesma fonte não são descartados por proximidade. Rejeições explícitas do Telegram podem ser tentadas novamente; entrega de resultado incerto fica registrada sem reenvio automático, para evitar mensagens duplicadas.

O histórico administrativo apresenta “Sismos M6+ e Brasil”. A rota administrativa `/telegram-m6-check` mantém o nome anterior por compatibilidade e informa a política brasileira e as fontes que falharam. Requer a mesma autorização administrativa de antes.

Dados geográficos: [IBGE, API de Malhas v3, país BR, qualidade intermediária](https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&qualidade=intermediaria), consultados em 9/10/2026. A geometria está incorporada ao Worker para dispensar consultas externas a cada alerta.

Validação: `node tests/unit/telegram-brazil-check.mjs` usa catálogos e Telegram simulados; não envia mensagens ao canal real.

## Atualizações do cartão sísmico

Cada alerta novo persiste o `message_id`, o chat e o formato confirmado pelo Telegram. Quando a magnitude, profundidade, epicentro ou estado de revisão muda, o Worker recalcula o cartão e usa `editMessageMedia` para substituir foto e legenda na mesma mensagem. O fallback de texto usa `editMessageText`. Não apaga o alerta: o valor antigo sai da imagem, enquanto a legenda conserva a magnitude inicial, a atual e as últimas revisões.

A mesma fonte produz “Revisão da fonte”; uma rede diferente produz “Nova estimativa”. O ID já conhecido é acompanhado mesmo se a magnitude cair abaixo de M6, consultando o evento USGS individualmente por 72 horas. Estimativas de redes diferentes só compartilham o cartão quando a origem difere até 30 segundos, o epicentro até 50 km (20 km no Brasil) e a magnitude até 1,0 (0,6 no Brasil). Eventos diferentes da mesma rede ficam separados. Estimativas repetidas não alternam o cartão de volta para a magnitude anterior.

Mudança acumulada de pelo menos 0,3 ou cruzamento de M6/M7 gera um aviso em resposta ao alerta original. Os avisos são agrupados por pelo menos 30 segundos e enviados na consulta seguinte do cron; a edição do cartão é imediata na consulta que detecta a mudança. Uma mudança que volte ao valor anterior durante esse intervalo não gera aviso. O primeiro alerta continua imediato e avisa que a magnitude está sujeita a revisão.

A edição pode ser repetida após falha, inclusive quando o Telegram já aplicou a alteração e responde “message is not modified”. O aviso tem reserva persistente antes do envio, evitando repetição após timeout ambíguo. O estado do Durable Object usa partes menores que o limite por valor e transação na escrita.

Alertas enviados antes desta versão não guardavam o ID do Telegram. Permanecem com atualização textual quando importante, sem tentar editar ou excluir uma mensagem por ID adivinhado. Os testes simulam todas as chamadas ao Telegram; não enviam mensagens fictícias ao canal real.
