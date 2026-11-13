# TV 1.0.79: estados independentes das cotações

A tarja mostra ABERTO, FECHADO, FECHADO · PAUSA ou STATUS N/D separadamente para Brent e USD/BRL. Consulta manual/Alexa também pode mostrar o mercado fechado sem inventar preço. Valores anteriormente validados são identificados como última cotação, com data e horário; ausência de valor usa travessão. A exibição automática continua dependendo de cotação recente e sessão aberta. Duração de 12 segundos e prioridade dos alertas permanecem.

BZ=F é o futuro Brent Last Day Financial da NYMEX/CME, e não o contrato ICE. A sessão regular segue America/New_York, domingo 18h até sexta 17h, com pausa diária das 17h às 18h. O estado informado pela fonte pode indicar fechamento especial. Preços de sessão anterior não são reutilizados após reabertura. Referência: https://finance.yahoo.com/quote/BZ%3DF/ e https://www.cmegroup.com/cn-s/markets/energy/crude-oil/brent-crude-oil-last-day.contractSpecs.html

BRL=X é a referência indicativa global USD/BRL do Yahoo, não o futuro de dólar da B3. Usa estado ou período de negociação válido publicado pelo provedor. Dados ausentes ou atrasados não significam mercado fechado. Fonte: https://finance.yahoo.com/quote/BRL%3DX/

Cotações indicativas, sujeitas a atraso; não constituem feed oficial em tempo real. Feriados dependem da confirmação da fonte, além da sessão semanal regular.
