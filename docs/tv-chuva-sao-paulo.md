# Chuva opcional em São Paulo — TV 1.0.25

O aplicativo pode mostrar um cartão meteorológico e, quando há chuva estimada agora, gotas discretas sobre o conteúdo. É uma função opcional para **um ponto de referência de São Paulo capital** (-23,550; -46,630), o mesmo usado no site. Não utiliza a localização do aparelho nem representa chuva uniforme em toda a cidade.

## Como usar

Atualizar por **Verificar atualização oficial**, sem desinstalar. O botão **Chuva em São Paulo** alterna entre **desligado**, **só cartão** e **cartão com gotas**. A configuração inicial desta versão é cartão com gotas. Requer o monitoramento ativo e a permissão de sobreposição já usada pelas tarjas. Não há nova permissão ou cadastro.

**Testar cartão e gotas de chuva (fictício, em 10 s)** dá tempo para abrir outro aplicativo. Os valores são demonstrativos e a identificação de teste fica no cartão. Não consulta a fonte para construir o exemplo, não altera o histórico dos avisos reais e não envia mensagens ao Telegram.

## Informações do cartão

- **Chuva prevista em ~X min**: calculada dos intervalos absolutos da previsão por minuto, quando existe início nos próximos 60 minutos. Não é uma contagem inventada nem medição de radar local.
- **Chuva fraca/moderada/forte/muito forte estimada agora** e **X mm/h estimados agora**: taxa do intervalo atual, não o máximo das próximas horas.
- **X mm previstos · próximos 60 min**: integração proporcional das taxas por minuto, incluindo somente a parte dos intervalos dentro da próxima hora. Não é chuva medida por pluviômetro.
- Término **em ~X min a partir de agora** somente quando a série contém dez minutos secos consecutivos após a chuva. Na ausência dessa indicação, informa que não há estimativa de término disponível.
- Fonte **Rainbow Weather**, horário da consulta em Brasília e texto de estimativa sujeita a mudanças.

O cartão dura cerca de 12 segundos, com entrada e saída suaves, limitado também à validade da fonte. Gotas somente para chuva estimada agora, sem som, flashes, áudio de trovão ou efeito contínuo. Respeita animações reduzidas do sistema. Neve não recebe animação de chuva.

Mostra mudanças de condição: aproximação, início, faixa de intensidade e retirada da previsão. Primeiro estado seco é silencioso. A mesma condição não reaparece a cada minuto; há proteção de repetição entre reinicializações, com mínimo de dois minutos entre estados diferentes e dez entre faixas de intensidade. Dados ausentes/vencidos nunca viram “sem chuva”. O estado aparece na tela de configuração mesmo quando um alerta prioritário impede o cartão.

## Prioridade e desempenho

Sismos, tsunami, cartões menores M5+, replay e resumos têm prioridade. Retiram imediatamente a chuva; ela não captura botões do controle. Uma mudança meteorológica aguardando exibição só pode aparecer depois com dados ainda válidos. Não há promessa de aviso enquanto o aparelho está desligado ou sem internet.

A rede meteorológica usa executor separado: não espera no fluxo sísmico de 30 segundos. Reaproveita o pulso local de minuto já existente. Efeito limitado a 20/32/48 gotas, desenho simples e aproximadamente 29 quadros por segundo por cerca de 12 segundos; sem imagens de tela cheia, blur ou bitmaps próprios. O modo só cartão usa uma janela pequena. A janela com gotas ocupa a tela e também consome buffers gráficos do Android: o custo real de memória e composição ainda precisa ser conferido na TCL e no Fire Stick. Não se declara desempenho físico medido a partir de testes no computador.

## Plano Free e publicação

`GET /tv-rain` usa a coleta protegida existente de `/rain-nowcast`, no ponto fixo já usado no site. Mantém os limites **4.500 chamadas/mês e 150/dia** do provedor; nenhum aumento de cota, nova chave, binding, serviço, cron ou gravação em KV. Reaproveita o mesmo Durable Object e o resultado protegido de dez minutos. Cache em memória/edge e deduplicação simultânea evitam consultar esse estado por cada TV. Não renova o horário original ao ler o cache.

Cada aparelho ligado e com a função ativa faz normalmente cerca de uma leitura por dez minutos, ajustada à expiração recebida; falha tenta novamente em cinco minutos. Tela desligada ou modo desligado não inicia novas consultas. Há consumo adicional de Worker e possíveis leituras Durable em faltas de cache; medir posteriormente. Não há promessa de custo zero. Limite de cota ou falha simplesmente deixa a função indisponível, preservando os sismos.

Publicar o pacote reconstruído pelo fluxo **Cloudflare Worker maintenance → deploy**, conferir `tvRainPolicy: sp-minute-rain-v1` em `/health`, depois **Android TV official release → publish**. O endpoint retorna `version: tv-rain-v1`. Não requer ação nova na Cloudflare nem Secrets novos.

Para desativar imediatamente, selecionar **desligado**. Correção de APK usa versão maior e a assinatura existente; reversão do Worker segue o guia de operação e preserva cron/bindings. Nenhum teste real de chuva ou mensagem de alerta deve ser disparado para validar o código: existe o teste fictício no aparelho.
