# TV 1.0.10 — resumo automático à meia-noite

A versão 1.0.9 tinha somente consulta manual e replay do resumo. Não existia agendamento automático. A partir desta versão, **Resumo automático à meia-noite · horário de Brasília** vem ativado; é possível desativá-lo nas configurações.

Com o monitoramento ativo, o aplicativo verifica a virada do dia em `America/Sao_Paulo`, independentemente do fuso configurado na TV. Consulta os cinco maiores sismos do **dia anterior**, entre 00h e 23h59min59s de Brasília. A tarja identifica a data e **DIA ENCERRADO**. São seis segundos por sismo, até 30 segundos no total, sem som e com a entrada/saída suave já instalada. A consulta manual continua mostrando o dia atual, parcial até a consulta.

## Recuperação e prioridade

Se a TV ou o monitoramento não estavam ativos à meia-noite, o último dia encerrado é recuperado ao retomar o monitoramento. O aplicativo verifica o estado interativo do Android e escuta os eventos de repouso/retomada: não considera entregue um resumo enquanto o aparelho está em repouso. Não existe exibição com a TV fisicamente desligada; um Fire Stick que permaneça ativo apesar de a televisão estar apagada depende de o Android receber essa mudança de estado. Quando vários dias foram perdidos, recupera somente o mais recente. Falhas de rede tentam novamente após cinco minutos; não viram ausência de sismos.

Alertas reais têm prioridade. Se interromperem o resumo, ele permanece pendente e recomeça após os avisos. A entrega é gravada por aparelho somente depois de concluir a apresentação, preservando a recuperação após encerrar o serviço ou reiniciar. O registro do dia entregue impede repetições durante novas consultas e reinícios; callbacks de uma apresentação interrompida não podem marcar a tentativa seguinte como concluída. Mudanças do relógio para um dia anterior não repetem resumos mais antigos.

O resumo mostrado continua disponível no replay, inclusive sem internet, com a data e o indicador de dia encerrado. Sem dados salvos daquele dia, a recuperação precisa de internet. Um catálogo válido sem registros M2,5+ apenas informa essa ausência no status do aplicativo, sem inventar cinco eventos.

## Consumo e validação

Uma verificação local, limitada a cada 30 segundos e alinhada à próxima meia-noite, não depende do término das consultas de alertas. O histórico é consultado uma vez para o resumo pendente, com recuo de cinco minutos em falhas; o endpoint `view=completed` usa cache compartilhado de cinco minutos e não consulta população, Telegram ou Durable Objects. Só há um resumo pendente em memória e um registro salvo, com os limites anteriores.

Testes verificam a virada de Brasília em TV configurada para outro fuso, limites inclusivo/exclusivo do dia, ranking, recuperação após perder vários dias, reinício, deduplicação, relógio voltando, interrupção por alerta, callback antigo e indicador preservado no replay. Compilação/lint/testes JVM Android e serviços completos do Worker. A ativação visual na TV física depende de instalar esta versão; não é necessário esperar outra meia-noite para recuperar o último dia encerrado.

O catálogo é o USGS, com mínimo M2,5; dados podem ser revisados posteriormente. “Dia encerrado” identifica a janela do calendário, não resultados sismológicos definitivos.
