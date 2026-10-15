# Cenários sísmicos no menu

Menu → Mais → Testar efeitos → Evento:

- **Teste · mapa oficial USGS (M7,8 histórico)**: 60 segundos; usa a grade oficial do sismo de Pazarcık, Turquia, de 06/02/2023. Mostra o epicentro e a área pintada, sem anéis P/S. A grade está arquivada em `assets/seismic/usgs-shakemap-turkey-20230206.json`, com identificação, versão e endereço do produto USGS; não é uma simulação nem um alerta atual.
- **Teste · ruptura alongada**: 45 segundos; começa no epicentro, enquadra a distribuição de intensidade fictícia alongada, faz uma passagem de seis segundos pelo azul e volta à pintura nos dez segundos finais.
- **Teste · novas réplicas**: 60 segundos; três eventos fictícios entram aos 12, 25 e 38 segundos, com identificação temporária NOVA. A câmera considera o epicentro, a pintura e todos os pontos da sequência.
- **Teste · sismo com tsunami**: reutiliza o passeio de 120 segundos, alternando tremor e regiões costeiras de Panamá, Costa Rica e Nicarágua. As cores são apenas uma demonstração dos níveis do boletim.

Os testes de ruptura alongada e novas réplicas usam grade de intensidade criada localmente, identificada como TESTE e intensidade fictícia. Nunca são apresentados como USGS. Nenhum cenário insere itens nos catálogos ou filas de prioridade, toca alarmes ou envia mensagens ao Telegram. Nos testes de ruptura e réplicas, o compartilhamento fica indisponível enquanto o cartão mostra dados fictícios.

Parar, Escape, troca de cenário, fim do tempo ou aba oculta limpam os marcadores, camadas e temporizadores de teste. A vista e o evento anteriores são restaurados. Pausar câmera ou mexer manualmente no mapa interrompe os movimentos, mantendo visíveis as chegadas simuladas; Retomar câmera volta a enquadrar a área. Seleção de um evento real interrompe o teste sem restaurar a câmera antiga por cima do novo evento.

No monitoramento real, a consulta oficial é habilitada para M5,5 ou mais. Enquanto a pintura estiver visível e o sismo selecionado, uma ausência de produto é consultada novamente após um minuto. Aba oculta, pintura oculta ou troca de evento interrompem essa verificação. Grades disponíveis ficam em cache por cinco minutos; a estimativa continua no mapa quando não existe grade oficial.
