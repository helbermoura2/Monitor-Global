# TV 1.0.79: estados independentes das cotações

A tarja mostra ABERTO, FECHADO, FECHADO · PAUSA ou STATUS N/D separadamente para Brent e USD/BRL. Consulta manual/Alexa também pode mostrar o mercado fechado sem inventar preço. Valores anteriormente validados são identificados como última cotação, com data e horário; ausência de valor usa travessão. A exibição automática continua dependendo de cotação recente e sessão aberta. Duração de 12 segundos e prioridade dos alertas permanecem.

BZ=F é o futuro Brent Last Day Financial da NYMEX/CME, e não o contrato ICE. A sessão regular segue America/New_York, domingo 18h até sexta 17h, com pausa diária das 17h às 18h. O estado informado pela fonte pode indicar fechamento especial. Preços de sessão anterior não são reutilizados após reabertura. Referência: https://finance.yahoo.com/quote/BZ%3DF/ e https://www.cmegroup.com/cn-s/markets/energy/crude-oil/brent-crude-oil-last-day.contractSpecs.html

BRL=X é a referência indicativa global USD/BRL do Yahoo, não o futuro de dólar da B3. Usa estado ou período de negociação válido publicado pelo provedor. Dados ausentes ou atrasados não significam mercado fechado. Fonte: https://finance.yahoo.com/quote/BRL%3DX/

Cotações indicativas, sujeitas a atraso; não constituem feed oficial em tempo real. Feriados dependem da confirmação da fonte, além da sessão semanal regular.

## TV 1.0.100: identificação global e selos compactos

- A referência `BRL=X` aparece como **DÓLAR · GLOBAL**, separada do dólar futuro da B3. Aos sábados e domingos brasileiros a tarja indica **BRASIL SEM PREGÃO**, mesmo que a fonte global indique **ABERTO**.
- Uma string `REGULAR` antiga da fonte, sem período atual nem negociação recente, não comprova mercado aberto: aparece `STATUS N/D` até validação.
- Brent e dólar têm estados independentes **acima** da variação porcentual; as referências da última cotação permanecem identificadas.
- BREAKING NEWS tem largura compacta em eventos sísmicos pertinentes. Chuva, tempo, satélite e mercado usam selos informativos, sem confundir previsão normal com emergência. O logo oficial e o rodapé, inclusive os cinco totais do resumo diário, permanecem preservados.
- A confirmação e a validação visual precisam ocorrer no APK 1.0.100; nenhuma cotação fictícia é publicada.


## TV 1.0.101: restaurar as cores aprovadas nas tarjas

- **BREAKING NEWS** volta ao vermelho oficial `#BF1827` em todas as tarjas (sismos, chuva, tempo, Brent, dólar, satélite, replay e resumo); o formato mais **estreito** é preservado.
- **AO VIVO**, **REPLAY** e demais selos de estado voltam ao mesmo vermelho oficial nas tarjas normais. A versão demonstrativa mantém a identificação especial de simulação.
- Removidos inteiramente os rótulos pequenos da linha superior após **BREAKING NEWS**. A localização legível fica no corpo da tarja, e os detalhes continuam disponíveis no rodapé e na acessibilidade.
- Mantidos os ajustes de dados da 1.0.100: Brent com estado sobre a porcentagem, dólar identificado como referência global, contexto do pregão brasileiro separado, totais do resumo diário e marca oficial.
- A alteração é restrita a **cores, etiqueta e distribuição do cabeçalho**, sem mudar horários, fontes, Worker, alertas ou dados meteorológicos.
