# TV 1.0.8 — replay do resumo

O botão **Replay · Repetir último resumo salvo** reapresenta o último resumo iniciado na faixa, sem consultar a internet. Preserva a lista, ordem, data e horário de consulta originais; mantém seis segundos por sismo, até 30 segundos, independentemente da duração dos avisos. A faixa identifica **REPLAY DO RESUMO** e a data original, inclusive quando o registro é de outro dia.

Somente o resumo normal grava esse registro, após conseguir abrir a sobreposição. O replay não altera a lista salva, não toca som, não substitui o último alerta real e cede prioridade a alertas novos. Se a apresentação anterior foi interrompida por um alerta, o replay permite revê-la desde o início. Sem resumo salvo, o aplicativo orienta a exibir primeiro **Resumo do dia**. Resumos vistos antes de instalar esta versão não foram gravados.

Armazenamento limitado a um resumo com até cinco sismos e 64 mil caracteres. O registro não contém histórico recursivo de boletins. Não acrescenta consultas ao servidor ou Durable Objects.

Validação: compilação e lint release Android, testes JVM de persistência e ordem, preservação da data/consulta, duração e rejeição de registros inválidos ou acima do limite. Publicação pelo canal oficial assinado; a apresentação na TV física depende da instalação pelo proprietário.
