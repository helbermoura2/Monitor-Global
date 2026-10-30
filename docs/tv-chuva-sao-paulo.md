# Chuva opcional na Liberdade, São Paulo — TV 1.0.28

O aplicativo pode mostrar um cartão meteorológico e, quando há chuva estimada agora, gotas discretas sobre o conteúdo. A partir da versão 1.0.28, é uma função opcional para **um ponto de referência na Praça da Liberdade-Japão** (-23,555; -46,635), em São Paulo. O site mantém seu ponto de referência do centro (-23,550; -46,630). Não utiliza a localização do aparelho nem representa chuva uniforme em toda a cidade.

## Como usar

Atualizar por **Verificar atualização oficial**, sem desinstalar. O botão **Chuva na Liberdade** alterna entre **desligado**, **só cartão** e **cartão com gotas**. A configuração inicial desta versão é cartão com gotas. Requer o monitoramento ativo e a permissão de sobreposição já usada pelas tarjas. Não há nova permissão ou cadastro.

**Testar cartão e gotas de chuva (fictício, em 10 s)** dá tempo para abrir outro aplicativo. Os valores são demonstrativos e a identificação de teste fica no cartão. Não consulta a fonte para construir o exemplo, não altera o histórico dos avisos reais e não envia mensagens ao Telegram.

## Informações do cartão

- **Chuva prevista em ~X min**: calculada dos intervalos absolutos da previsão por minuto, quando existe início nos próximos 60 minutos. Não é uma contagem inventada nem medição de radar local.
- **Chuva fraca/moderada/forte/muito forte estimada agora** e **X mm/h estimados agora**: taxa do intervalo atual, não o máximo das próximas horas.
- **X mm previstos · próximos 60 min**: integração proporcional das taxas por minuto, incluindo somente a parte dos intervalos dentro da próxima hora. Não é chuva medida por pluviômetro.
- Término **em ~X min a partir de agora** somente quando a série contém dez minutos secos consecutivos após a chuva. Na ausência dessa indicação, informa que não há estimativa de término disponível.
- Fonte **Rainbow Weather**, horário da consulta em Brasília e texto de estimativa sujeita a mudanças.

O cartão dura cerca de 12 segundos, com entrada e saída suaves, limitado também à validade da fonte. Gotas somente para chuva estimada agora, sem som, flashes, áudio de trovão ou efeito contínuo. Respeita animações reduzidas do sistema. Neve não recebe animação de chuva.

Mostra mudanças de condição: aproximação, início, faixa de intensidade e retirada da previsão. Primeiro estado seco é silencioso. A mesma condição não reaparece a cada minuto; há proteção de repetição entre reinicializações, com mínimo de dois minutos entre estados diferentes e dez entre faixas de intensidade. Depois de mais de 20 minutos sem uma estimativa válida observada, a próxima leitura válida inicia uma nova referência: chuva atual pode ser informada novamente, enquanto seco inicial continua silencioso. Dados ausentes/vencidos nunca viram “sem chuva”. O estado aparece na tela de configuração mesmo quando um alerta prioritário impede o cartão.

## Prioridade e desempenho

Sismos, tsunami, cartões menores M5+, replay e resumos têm prioridade. Retiram imediatamente a chuva; ela não captura botões do controle. Uma mudança meteorológica aguardando exibição só pode aparecer depois com dados ainda válidos. Não há promessa de aviso enquanto o aparelho está desligado ou sem internet.

A rede meteorológica usa executor separado: não espera no fluxo sísmico de 30 segundos. Reaproveita o pulso local de minuto já existente. Efeito limitado a 20/32/48 gotas, desenho simples e aproximadamente 29 quadros por segundo por cerca de 12 segundos; sem imagens de tela cheia, blur ou bitmaps próprios. O modo só cartão usa uma janela pequena. A janela com gotas ocupa a tela e também consome buffers gráficos do Android: o custo real de memória e composição ainda precisa ser conferido na TCL e no Fire Stick. Não se declara desempenho físico medido a partir de testes no computador.

## Plano Free e publicação

`GET /tv-rain?area=liberdade` usa a coleta protegida existente de `/rain-nowcast`, com o ponto fixo da Liberdade. O endereço sem parâmetro continua servindo o ponto anterior do centro para APKs antigos; a nova versão não aceita esse resultado como previsão da Liberdade. Mantém os limites **4.500 chamadas/mês e 150/dia** do provedor; nenhum aumento de cota, nova chave, binding, serviço, cron ou gravação em KV. Reaproveita o mesmo Durable Object e o armazenamento protegido de dez minutos, com chaves separadas por ponto. A consulta de um ponto novo pode consumir mais chamadas do provedor: centro e Liberdade compartilham o teto diário/mensal existente. Se atingido, o recurso fica indisponível, sem aumentar cota nem contratar serviço. Cache em memória/edge e deduplicação simultânea evitam consultar esse estado por cada TV. Não renova o horário original ao ler o cache.

Cada aparelho ligado e com a função ativa faz normalmente cerca de uma leitura por dez minutos, ajustada à expiração recebida; falha tenta novamente em cinco minutos. Tela desligada ou modo desligado não inicia novas consultas. Há consumo adicional de Worker e possíveis leituras Durable em faltas de cache; medir posteriormente. Não há promessa de custo zero. Limite de cota ou falha simplesmente deixa a função indisponível, preservando os sismos.

Publicar o pacote reconstruído pelo fluxo **Cloudflare Worker maintenance → deploy**, conferir `tvRainPolicy: liberdade-minute-rain-v2` em `/health`, depois **Android TV official release → publish**. O endpoint retorna `version: tv-rain-v1`. Não requer ação nova na Cloudflare nem Secrets novos.

Para desativar imediatamente, selecionar **desligado**. Correção de APK usa versão maior e a assinatura existente; reversão do Worker segue o guia de operação e preserva cron/bindings. Nenhum teste real de chuva ou mensagem de alerta deve ser disparado para validar o código: existe o teste fictício no aparelho.

## Publicação verificada

Versão 1.0.25 publicada e conferida no endereço público do site: pacote, número da versão, hash SHA-256 e assinatura oficial do APK válidos. Worker publicado, marcador público verificado e `/tv-rain` respondeu com uma previsão válida de 240 intervalos de minuto para o ponto de São Paulo. Passaram 87 testes Android/JVM/Skia, lint/compilação, 195 testes modulares Worker, verificações isoladas de entrega, 11 guardas de manutenção, 5 de distribuição e regressões de navegador. Nenhuma mensagem real de teste foi enviada. A aparência e o desempenho físicos na TCL/Fire Stick continuam dependendo do botão de teste no aparelho. Evidências: [auditoria de publicação](audits/tv-rain-release-20261030.json).

## Ajuste visual 1.0.26

Após a foto na TCL, o cartão passa de no máximo 580 para 420 dp de largura (cerca de 28% menor), preservando fonte e informações. Gotas ficam mais claras, com maior opacidade, traço de 2 dp, pontas arredondadas e comprimento um pouco maior. Permanecem a quantidade máxima de 48 gotas, a duração, o intervalo de desenho e as prioridades. Não há alteração de consulta ou do Worker; basta atualizar o APK. Desempenho físico da nova espessura ainda deve ser conferido no aparelho.

Atualização oficial 1.0.26 publicada: arquivo público, hash, pacote, versão e assinatura conferidos; passaram os 87 testes Android/JVM/Skia existentes, compilação e lint, também no CI. [Evidências](audits/tv-rain-visibility-20261030.json). Conferência visual da nova espessura nos aparelhos do proprietário ainda pendente.

## Mudança de ponto na versão 1.0.28

A localização de referência da TV passa a ser a Praça da Liberdade-Japão, conferida no OpenStreetMap/Nominatim e arredondada à precisão de três casas do coletor (-23,555; -46,635). O cartão identifica **Liberdade, SP** e informa que a estimativa é para um ponto do bairro. Não representa todas as ruas ou uma medição local. Dados antigos do centro são rejeitados na nova versão; o histórico de deduplicação meteorológica recebe uma referência nova somente na primeira migração. Preferências, sismos e outros replays permanecem preservados. O site não muda de localização.
