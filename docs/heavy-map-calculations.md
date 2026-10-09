# Reaproveitamento de cálculos do mapa

## Área sentida dos sismos

A pintura estimada conserva o modelo GlobalQuake Gen2, 48 faixas, os anéis geodésicos de 160 segmentos, a costa Natural Earth e o tratamento de polos e linha de data. As funções físicas ficam em `js/seismic-impact-model.js`, compartilhadas pela tela e por `js/seismic-impact-worker.js`.

O Worker só é criado quando uma área precisa ser calculada. Recebe longitude, latitude, magnitude e profundidade; baixa e guarda as costas dentro do próprio Worker. Não envia o catálogo inteiro pela comunicação com a página. A câmera, os relógios e a progressão da onda continuam independentes. Quando o resultado chega, revela a fração correspondente ao estado atual, sem recomeçar a propagação.

Cálculos simultâneos com os mesmos parâmetros compartilham uma promessa. Um evento/revisão com parâmetros diferentes cancela o trabalho anterior e começa outro Worker se ele estava ocupado. Mensagens e erros de Workers antigos são descartados. Depois de concluído, o Worker pode ser reutilizado com as costas já carregadas.

Um cache na página guarda até quatro áreas e, no total, 100 mil vértices. Um resultado acima desse limite é exibido, mas não guardado. Longitude, latitude, magnitude ou profundidade diferentes invalidam o reaproveitamento; o identificador do evento não interfere na geometria. O cache dispensa os recortes; a atualização do GeoJSON no motor do mapa ainda é necessária.

Se Workers não estiverem disponíveis ou falharem ao iniciar, o cálculo usa as mesmas funções em grupos de até quatro faixas e devolve a execução ao navegador entre os grupos. A primeira intersecção da costa com a região continua sendo uma operação síncrona nesse caminho alternativo. Falhas ao obter as costas mantêm o aviso de camada indisponível, sem inventar uma área.

## Avisos INMET

- Polígonos oficiais repetidos reutilizam a análise do texto JSON: até 32 entradas e 2 milhões de caracteres. Polígonos maiores que 1 milhão de caracteres continuam válidos, mas não entram no cache.
- O recorte de cada geometria com o Brasil é reutilizado por referência, usando WeakMap. A sobreposição e o recorte por distância são refeitos quando seus inputs mudam.
- A resolução de nomes/UF de municípios tem até 16 entradas e 12 mil municípios no conjunto. O parser preserva os pontos anteriores quando a lista resolvida continua a mesma.
- Coleções de pontos e áreas usam descritores pequenos. Não serializam todos os vértices nem recriam milhares de Features em cada sincronização. Revisões substituem os snapshots de geometria/cidades; seus valores não devem ser alterados internamente. Severidade, cor, tipo, posição do usuário, filtro geográfico e validade temporal são reavaliados.
- O foco usa um índice por aviso. Trocar a seleção altera o ícone e a borda sem refazer a coleção de todos os municípios. Os dados são reenviados quando uma fonte é recriada após mudança de estilo.

Validação: resultados exatos do modelo anterior em regiões comuns, linha de data e polos; cancelamento e mensagens tardias; limites do cache; Worker real e dois caminhos de falha; desktop/celular; revisões, filtros, expiração e reconstrução de fontes. Em uma coleção com 5.571 municípios, 50 sincronizações sem mudanças não fizeram novos recortes, verificações por cidade nem envios de dados das três fontes INMET. Esses números medem esse cenário específico; não são uma porcentagem de redução total de CPU do site.
