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


## TV 1.0.102: legibilidade e alinhamento vertical na sala

- Alinhamento óptico **compartilhado** no corpo da tarja (`BroadcastVisuals.BODY_VISUAL_CENTER_Y`): títulos **TEMPO/CHUVA/BRENT/SATÉLITE/CONSULTA**, temperatura, cotação, métricas e ícones da família informativa não podem ficar em alturas discordantes. O layout sísmico, tarja de alertas e mapa mantêm a estrutura já aprovada.
- **BRENT** volta a ter fonte de categoria grande (31 unidades) e centrada ao lado do preço, em vez de aparecer pequeno e colado à borda superior.
- **19 °C** é centralizado verticalmente ao lado de TEMPO e do subtítulo LIBERDADE · SP; um teste Robolectric compara as caixas de tinta real na imagem renderizada.
- A referência **DÓLAR · GLOBAL (Yahoo `BRL=X`)** pode abrir domingo à noite enquanto a B3 está fechada. Em fins de semana a TV mostra na faixa principal **B3 FECHADA · SEG 09H (REGULAR)** com fonte maior e cor de atenção; o ticker esclarece que 09:00 BRT é o horário regular e pode sofrer exceções de calendário. O fechamento da B3 não substitui o estado independente da cotação internacional.
- Preservados os selos **vermelhos** compactos BREAKING NEWS / AO VIVO, a identidade oficial Argos, dados meteorológicos e sísmicos reais, cinco contadores do resumo, as colunas, a assinatura, o package ID e a atualização automática.


## TV 1.0.104: somente dólar futuro negociado na B3

- **Retirado completamente o BRL=X (dólar global do Yahoo) do fluxo operacional da TV**. Nenhuma cotação global pode aparecer com a etiqueta B3, nem como substituição de emergência.
- O painel à direita passa a ser **DÓLAR · B3**, identificado como **DOL (dólar futuro)**.
- A fonte pública disponível para consulta sem chave é o histórico de **último fechamento** divulgado pela Notícias Agrícolas, com a indicação explícita **Fonte: B3**. É preço do fechamento, **não cotação em tempo real**. A TV mostra preço em BRL/US$1 (pontos B3 divididos por 1.000), contrato e dia/hora de referência; a variação vem da própria publicação.
- O parser rejeita dados sem identificação da B3, datas de feriado sem confirmação, fechamento de sábado/domingo, preço anterior a sete dias, valores inválidos e fechamentos do futuro.
- **Se a fonte não responder ou não houver fechamento validado**, mostra **R$ — / FECHAMENTO N/D**, sem usar Yahoo nem interpolar.
- Para o cabeçalho ABERTO/FECHADO usa exclusivamente a grade **regular** de DOL da B3: dias úteis 09:00–18:30 BRT; feriados, suspensões e exceções podem alterar a sessão. O status indica apenas o horário regular, não que exista um último negócio verificado hoje.
- Mantém Brent (NYMEX) e o restante das tarjas sem alteração; não adiciona custo, token, fonte paga ou computador local.
- A B3 comercializa dados intradiários via distribuidores licenciados. Se no futuro for conectado um feed intradiário autorizado, ele poderá substituir a referência histórica sem violar a separação de mercados.


## TV 1.0.105: dólar futuro DOL intradiário com atualização horária

- **Motivo:** o último fechamento B3 exibido na versão 1.0.104 não varia durante o pregão; esta versão adiciona cotação intradiária real sem substituir o ativo pelo USD/BRL internacional.
- **Fonte:** widget público OFICIAL **TradingView Single Quote**, configurado para `BMFBOVESPA:DOL1!`. O próprio TradingView licencia a exibição nos widgets dos ativos da B3 com atraso de aproximadamente **15 minutos** (https://www.tradingview.com/blog/pb/b3-data-available-in-tradingview-widgets-41743/).
- **Respeito à fonte:** o preço/percentual são renderizados **diretamente pelo widget do fornecedor**, sem baixar, inspecionar iframe, coletar valores com JavaScript, copiar, revender ou expor cotações por API. A atribuição e o atraso são visíveis na tarja.
- **Agenda:** a cada hora na janela `:15–:59` do pregão regular de dólar futuro da B3 (dias úteis 09:00–18:30, sujeito a feriados), a tarja carrega **uma nova instância do widget**. O ciclo do DOL tem a chave de agendamento `b3DolLastSlot`, separada do Brent; caso o Brent não tenha valor confirmado, o DOL não é suprimido.
- **Fora do pregão:** usa o último fechamento B3 verificado, com vencimento e data; não simula cotação intradiária.
- **Sem WebView ou internet:** exibirá um estado nativo claro sem preço intradiário. Não apresenta fechamento velho como se fosse preço atual e não recorre ao BRL=X do Yahoo.
- **Visual:** a tarja informativa conserva o design vermelho e o alinhamento das categorias pela magnitude, com widget incorporado apenas na coluna do dólar. Não interfere no radar, no resumo diário, no Telegram ou no app celular.
- **Limitação técnica:** a validação final de disponibilidade do WebView/TradingView precisa ocorrer em uma TV/Fire TV real. Os testes automatizados aprovam o build e o ciclo da tarja, não certificam conectividade com o serviço externo no aparelho do usuário.

## TV 1.0.106: Yahoo USD/BRL sem widget e com atualização horária independente

- **A pedido do usuário, revertida a interface externa do TradingView da 1.0.105**: o widget WebView ocupava o conteúdo da tarja, com tipografia e posição incompatíveis com a identidade aprovada. O elemento WebView e seu teste foram removidos integralmente.
- A cotação volta ao **Yahoo Finance `BRL=X`**, identificada na tela como **DÓLAR USD/BRL**; não será rotulada como DOL B3, nem chamada de B3. O rodapé indica **YAHOO · REF. HH:mm BRT** e o valor em R$ com **quatro casas decimais**.
- **Mercados distintos:** `BRL=X` é o par de câmbio USD/BRL do mercado internacional (normalmente de domingo à noite até sexta-feira), com horário próprio e independente da B3; o futuro DOL da B3 negocia em dias úteis 09:00–18:30 BRT. A interface não mostrará mais o texto ostensivo “NÃO É B3”.
- **Hora em hora:** o ciclo `:15` é mantido e o USD/BRL tem marcador independente `yahooFxLastSlot`. A consulta à fonte do dólar acontece mesmo quando o Brent não retorna; uma cotação Yahoo validada pode exibir sozinha na tarja nativa. O Brent mantém seu próprio preço, status e política de validade, sem preço inventado.
- **Transparência:** o preço só aparece com timestamp Yahoo válido de no máximo **75 minutos**; sem preço confirmado, exibe **R$ —**, com estado de mercado coerente e sem inventar dados.
- Fonte de horários e distinção: B3 horário oficial DOL (https://www.b3.com.br/pt_br/solucoes/plataformas/puma-trading-system/para-participantes-e-traders/horario-de-negociacao/), OANDA sobre mercado FX global (https://www.oanda.com/us-en/trading/hours-of-operation/).
- Preservado o logo oficial, as tarjas vermelhas compactas, a centralização pelas magnitudes, a previsão meteorológica, replays, voz, e a assinatura/atualização oficial de TV.
