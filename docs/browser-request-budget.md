# Consultas no navegador: pausa e compartilhamento

O agendamento principal já suspendia ciclos com a aba oculta. A proteção agora também alcança as leituras públicas em andamento, novas tentativas de fallback e o JSONP do EMSC. Ao voltar ou recuperar conexão, os feeds críticos são atualizados; foco e pageshow repetidos não disparam rodadas sobrepostas. Uma breve troca de aba não obriga a esperar os 45 segundos do ciclo seguinte.

`BrowserRequestBudget` agrupa GETs públicos idênticos apenas enquanto estão em andamento. URL, parâmetros, cabeçalhos, cache, modo e credenciais fazem parte da identidade. Cada consumidor mantém seu próprio cancelamento e timeout: cancelar a consulta do cartão não cancela a leitura da imagem enquanto ela ainda estiver esperando. Quando não sobra consumidor, a consulta é abortada. Não existe novo cache de resultados ou renovação do prazo de dados nesta camada.

Até oito identidades têm corpo compartilhado, com limite de 4 MiB por resposta. Acima desse número, consultas adicionais usam streaming direto, sem acumular cópias inteiras. Pedidos autenticados, operações de escrita, TSE, voz paga e administração não são agrupados nem pausados por essa camada. O TSE continua sob sua própria regra de atualização de 30 segundos. Telegram e coletas do servidor não são alterados.

HTTP 503 com o estado compartilhado `unavailable` continua disponível ao tratamento de cooldown, evitando um fallback direto que contornaria a espera do coletor. Respostas de erro não são convertidas em sucesso.

O cartão não cancela e reinicia a população ao renderizar novamente o mesmo evento. Cartão e imagem compartilham a leitura em andamento; magnitude, coordenadas, profundidade, tempo e vínculo USGS isolam revisões. Reutilização de resultado não prolonga seu vencimento.

## Validação

- 100 leituras simultâneas do mesmo dado: uma chamada de rede e corpos independentes; nova leitura após conclusão faz nova chamada.
- Vinte renderizações do cartão e uma leitura para imagem: uma consulta populacional.
- Aba oculta: consultas públicas em andamento canceladas; vinte novas tentativas não iniciam rede; ao voltar a leitura funciona.
- Cancelamentos e timeouts independentes; variantes geográficas isoladas; TSE, voz, autenticação e POST fora do agrupamento.
- Navegador real em desktop e celular: compartilhamento de população, pausa/retomada, seleção preservada e exportação HD com faixas populacionais.

Essas medições descrevem os cenários de teste. A economia diária depende do tempo que as abas ficam ocultas e de quantas consultas antes se repetiam; não deve ser somada diretamente aos percentuais medidos no Worker.
