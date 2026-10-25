# Foco de avisos de vento e enchente — 25/10/2026

Os avisos de enchente sem ponto único não entravam no caminho que resolve polígonos e zonas oficiais. Os avisos RSS do BOM australiano também chegavam sem coordenadas: foram confirmados em produção resumos de vento em NSW, Victoria, Queensland, Austrália Ocidental e Tasmania, além de avisos de enchente em Queensland e Tasmania.

Enchentes agora usam a mesma resolução de área de tempestade/vento em seleção manual, prioridade e rotação. Cada seleção solicita o foco meteorológico uma vez; a falha de uma tentativa descartada não dispara uma câmera para [0,0] nem redefine a visão global.

O parser BOM preserva a região do feed. Na ausência de uma geometria mais precisa, a câmera enquadra o estado/território indicado pelo feed, com a indicação **Referência regional · área exata do aviso indisponível no mapa** e link para o boletim. Os limites de enquadramento são referências aproximadas do estado, não polígonos de risco, localidades atingidas ou epicentros. Nenhum ponto de ocorrência ou contorno de alerta é criado a partir deles. A identificação BOM continua funcionando após a tradução do nome da fonte no cartão.

As consultas de zonas continuam compartilhadas pelo cache existente de até 64 áreas e 8 MiB de coordenadas compactadas. Não foram adicionados serviços de geocodificação, consultas periódicas ou Durable Objects.

Validação: integração do parser RSS com seleção e destino da câmera em 390/1280 px; nove combinações por tela de tempestade/vento/enchente, modos automático/prioridade/manual e geometria com/sem ponto representativo; viagem real para região remota em globo e mapa plano; cancelamento de resposta tardia; datas, revisão e cancelamento das fontes oficiais.

Limitação anterior confirmada separadamente no código de produção a16d7d0: o teste `regional-warning-cards.spec.js` de 390 px falha na posição vertical do resumo textual (topo 778,375 px, limite 774 px). O mesmo resultado ocorreu antes e depois deste ajuste; a asserção não foi afrouxada. Essa disposição do texto não bloqueia a correção de localização do globo.
