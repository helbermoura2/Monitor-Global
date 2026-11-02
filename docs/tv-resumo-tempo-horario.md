# Resumo do tempo na Liberdade — TV 1.0.33

O aplicativo mostra **um cartão de 12 segundos a cada hora**, para o mesmo ponto de referência da Praça da Liberdade-Japão usado pela chuva. A opção começa ativada, conforme a configuração pedida pelo proprietário. A exibição automática requer monitoramento ativo, aparelho ligado e acesso à internet.

## Exibição

- Programação fixa no horário de Brasília: 01h00, 02h00, …, 23h00. O informativo da meia-noite fica para **00h05**, preservando o resumo sísmico de 00h00. O pulso existente também se alinha à próxima virada programada; dados válidos, rede e alertas prioritários podem atrasar a apresentação, mas não deslocam os horários seguintes.
- O horário da última exibição fica salvo no aparelho. Ao ligar novamente, pode mostrar apenas o informativo atual ainda não apresentado, sem fila dos horários perdidos. Se ligar às 09h35, por exemplo, o próximo horário continua sendo 10h00. Um informativo apresentado às 00h05 não adia o próximo para 01h05. Antes de 00h05 não há apresentação horária automática, mesmo depois de reiniciar.
- Sismos, tsunami, avisos menores M5+, replay e resumos sísmicos têm prioridade. Uma apresentação interrompida pela prioridade não bloqueia alertas.
- **Resumo do tempo na Liberdade · horas cheias; 00h05 à meia-noite** permite ligar/desligar a exibição automática.
- **Ver tempo · Liberdade · em 10 segundos** prepara o resumo atual, usando cache válido quando disponível, e espera pelo menos dez segundos após o clique para exibi-lo. É possível voltar ao conteúdo da TV durante essa espera. Um novo clique reinicia a contagem; consultas em andamento/cache válido continuam sendo reaproveitados. Alertas prioritários ou dados ainda indisponíveis podem adiar a apresentação. Fechar/parar o serviço cancela a apresentação pendente. Funciona também com monitoramento sísmico desligado: inicia somente a consulta meteorológica e encerra o serviço temporário após o cartão/erro. Consultar manualmente não adia a programação automática já existente; se a consulta coincidir com um horário automático devido, conta como essa exibição.

Os avisos de chuva continuam sendo uma opção separada. Com ambos ativos, o mesmo cartão reúne as informações meteorológicas; não há duas sobreposições meteorológicas simultâneas. A opção de gotas continua obedecendo o ajuste dos avisos de chuva e a preferência de animações do sistema. Para pausar todas as consultas meteorológicas automáticas, desligar **resumo horário** e **avisos de chuva**.

## Conteúdo e confiança

O cartão pode reunir temperatura, sensação térmica, condição informada no intervalo horário, umidade, vento e rajadas, mais a chuva por minuto já existente. Usa os mesmos significados de unidades do site: vento em km/h, temperatura em °C, umidade em %, intensidade de chuva em mm/h e acumulado previsto em mm na próxima hora.

Temperatura, vento e demais condições são **estimativas do modelo horário**, com hora de referência e geração. Não são medidas de uma estação na praça. Condição diária ou probabilidade de chuva não são convertidas em condição atual: se a condição horária não vier da fonte, isso fica explícito. Campos ausentes aparecem como “—”; falha não vira zero. Dados de outro ponto, de uma hora anterior, vencidos ou excessivamente antigos são rejeitados.

Chuva por minuto conserva sua consulta, previsão de início e demais regras. Se essa série estiver indisponível, o resumo horário pode continuar com os outros dados válidos e informa a ausência da chuva por minuto. Se a previsão horária estiver indisponível, não apresenta um cartão vazio; o estado fica na configuração e há nova tentativa com intervalo protegido. A validade dos dados também limita a apresentação; não inicia um resumo com dados prestes a vencer.

## Rede e Free

`GET /tv-weather` serve somente o ponto da Liberdade (-23,555; -46,635), com a linha da hora atual. Reaproveita `/rain-weather`, o coletor/Durable de produtos Rainbow Weather já existente e seus limites de **150 chamadas/dia e 4.500/mês**, sem aumentar cotas, adicionar chave, binding, serviço ou cron. O cache compartilhado conserva os horários originais e expira também na virada da hora de referência. Falhas usam cache curto; consultas simultâneas são deduplicadas.

Normalmente é uma coleta de produto horário por hora/ponto, compartilhada entre aparelhos. A chuva por minuto usa seu orçamento protegido próprio já existente; quando os avisos de chuva estiverem desligados, o resumo horário pode pedir essa série apenas para completar o cartão devido/manual. Isso pode consumir mais Worker/leituras Durable e chamadas do orçamento já existente; não é custo zero nem um novo plano. Se não houver dados/cota, preserva os alertas sísmicos.

A rede meteorológica permanece em executor separado do fluxo sísmico. Só há desenho durante a apresentação, sem um widget contínuo ou nova animação permanente.

## Publicar, conferir e reverter

Reconstruir o pacote Worker e publicar por **Cloudflare Worker maintenance → deploy**. Conferir `/health` com `tvWeatherPolicy: liberdade-hourly-weather-v1`, mais resposta pública `/tv-weather`. Publicar **Android TV official release → publish** e instalar pelo atualizador oficial, sem desinstalar ou apagar dados.

Para desativar imediatamente, desligar a opção de resumo horário. Correções de APK usam versão maior e a mesma assinatura; reversão do Worker segue o guia existente, preservando configuração/bindings/cron.

Testes cobrem dados ausentes, unidade de vento, validade, ponto, intervalo de uma hora, retomada após sono, prioridade, deduplicação de rede, manual com automáticos desligados, fechamento e desenho real no host Android/Skia. Não substituem conferir aparência e composição gráfica na TCL/Fire Stick. Não há envio de alertas reais de teste ao Telegram.

## Histórico da publicação 1.0.29

Versão 1.0.29 e Worker publicados. A resposta pública do ponto da Liberdade trouxe temperatura, sensação, umidade, vento e rajadas válidos; a condição horária não veio no resultado em cache e permanece explicitamente desconhecida. APK público com pacote, versão, hash e assinatura oficial conferidos. Passaram 94 testes Android/JVM/Skia, compilação/lint, 204 testes modulares Worker, verificações isoladas de entrega, guardas e regressões do navegador. [Evidências](audits/tv-hourly-weather-20261030.json). O visual físico nos aparelhos ainda deve ser conferido pelo proprietário.

## Atualização 1.0.30

Altera somente a programação no aplicativo; não exige mudança no Worker ou nas cotas. Os testes de horário cobrem fronteiras de hora, atraso por prioridade, retomada/reinício, migração do horário salvo da versão anterior, 00h00/00h05/01h00 e fuso do aparelho diferente de Brasília. A compilação, lint e testes Android verificam a atualização antes da publicação assinada pelo canal oficial.

## Atualização 1.0.33

O atraso de dez segundos vale somente para a solicitação manual de meteorologia. As horas cheias e 00h05 continuam usando a programação fixa existente. O estado pendente mantém o serviço temporário ativo durante a espera quando o monitoramento está desligado; ele termina após o cartão ou falha. Não exige atualização do Worker.
