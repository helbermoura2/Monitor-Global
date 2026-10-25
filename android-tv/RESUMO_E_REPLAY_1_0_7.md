# TV 1.0.7 — resumo do dia e recuperação de sismos

## Uso

No aplicativo, escolha **Resumo do dia**. Dez segundos depois da consulta, a faixa apresenta até cinco sismos por ordem decrescente de magnitude, durante seis segundos cada (até 30 segundos). Esse tempo independe da duração configurada para os alertas. A apresentação usa a transição vertical já aprovada, o mesmo tamanho, identidade e velocidade do rodapé. Mostra posição no ranking, magnitude, local, profundidade, fonte e hora de origem em Brasília. O resumo não emite som nem substitui o registro de replay. Um alerta real interrompe sua apresentação e tem prioridade.

O catálogo é o USGS, desde 00h do dia em Brasília, com filtro mínimo M2,5. Não é uma combinação de todas as fontes do Telegram. A lista é parcial até a consulta; eventos ainda não publicados ou magnitudes posteriormente revisadas podem mudar a ordem. Se não houver cinco registros disponíveis, não são inventados outros. Não existe agendamento automático nesta versão: o botão permite consultar quando quiser.

**Replay** consulta o último sismo M6+ das últimas 72 horas, inclusive se ocorreu com a TV desligada. Compara a origem com o registro local e preserva uma revisão local mais recente daquela origem. Guarda somente um registro recuperado adicional, limitado a 24 mil caracteres. Sem servidor, tenta esse registro ou o último alerta real local; sem nenhum deles, informa indisponibilidade. Uma resposta válida sem sismos na janela informa essa ausência. Não toca som nem injeta eventos históricos na fila de alertas novos.

O catálogo recuperado contém os dados atuais publicados pelo USGS, não uma reprodução exata de uma versão antiga de uma mensagem. Não reconstrói magnitude anterior, população ou boletim de tsunami não disponível. A faixa identifica **REPLAY** e data/hora; seu conteúdo histórico não confirma a situação atual de tsunami. Um boletim salvo localmente continua identificado como histórico.

## Consumo e limites

As consultas adicionais ocorrem apenas ao usar os botões. `/tv-alerts?view=daily` usa cache compartilhado de cinco minutos; `view=replay`, um minuto. Cada janela de consulta simultânea compartilha uma chamada por modo no mesmo processo. A chave diária muda à meia-noite de Brasília. O provedor tem timeout de 12 segundos; falhas retornam 503 e não são transformadas em listas vazias. Esses dois modos não chamam Durable Objects, serviço de população nem Telegram. O polling normal e as regras de deduplicação de avisos permanecem independentes.

O aplicativo consulta histórico em uma tarefa separada do monitoramento, permitindo no máximo uma consulta manual em andamento. Listas e armazenamento têm limites fixos; a faixa encerra e remove suas animações ao terminar.

## Verificação

Testes de ranking, limite de cinco, meia-noite de Brasília, janela de 72 horas, precedência de origem/revisão, cache, consultas simultâneas, indisponibilidade e duração de seis segundos. Compilação, lint e testes JVM do APK, além das verificações dos serviços do Worker. A atualização oficial passa pelo canal assinado e requer confirmação do instalador na TV. A apresentação real nesta versão ainda precisa ser vista no aparelho pelo proprietário.
