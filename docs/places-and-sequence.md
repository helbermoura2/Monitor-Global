# Meus lugares e sequência sísmica

Menu → Meus lugares permite buscar cidades pelo geocodificador Open-Meteo,
salvar o local do topo ou informar nome e coordenadas. Até oito entradas ficam
somente neste navegador. A busca de cidades brasileiras resolve código IBGE
somente com nome oficial único e coordenadas compatíveis do catálogo municipal.
Não usa o ponto de um município como polígono de aviso.

A ficha de cada lugar separa avisos com geometria contendo o ponto de eventos
apenas próximos em raio escolhido (50–500 km). Proximidade não confirma impacto.
A previsão horária Open-Meteo é carregada sob demanda, com cache de dez minutos
por lugar. Não é o nowcast Rainbow e não consome sua cota. Dados indisponíveis
não viram zero nem ausência de risco.

Cartão → Sequência (ou Ver sequência) abre o gráfico magnitude × horário, a
lista de eventos e o enquadramento do conjunto no mapa. Reaproveita o modelo
existente de possíveis réplicas em 72 horas, com incerteza declarada. Clicar em
um ponto abre o registro real; enquadrar o conjunto não altera a seleção. Não
cria previsão de réplicas. A rotação aleatória aguarda a leitura, enquanto
chegadas prioritárias continuam funcionando.

O texto de ajuda na Evolução explica que ShakeMap combina medições e modelos:
a grade publicada e as cores exibidas não delimitam toda percepção do sismo.
