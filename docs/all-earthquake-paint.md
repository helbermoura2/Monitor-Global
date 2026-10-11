# Pintura de intensidade em todos os sismos

As imagens do Telegram e do Story deixam de restringir a pintura a M5+. Sismos menores usam o mesmo modelo de atenuação e a mesma máscara de terras; o enquadramento aproxima a área estimada de percepção para que a pintura seja legível. A intensidade não é aumentada para produzir cor. Se o modelo não alcançar o limiar mínimo, não é inventada uma área pintada.

No mapa, os eventos selecionados no aleatório deixam de restringir a pintura a M5,5+. Os eventos novos e os replays também iniciam e revelam a pintura independentemente da magnitude. O radar de varredura dos eventos revisitados é substituído pela área estática. As frentes de onda vermelha e azul e sua cronometragem são preservadas.

Somente o evento selecionado recebe a camada, com o mesmo cache limitado, cálculo em Worker e cancelamento ao trocar de evento. Não são calculadas centenas de áreas em paralelo.

A versão cartográfica v8 permite que a rotina existente atualize imagens recentes já enviadas (janela de 24 horas e lote limitado a três); não provoca republicação do alerta inteiro ou envio de uma prévia de teste. Estimativas de exposição continuam separadas de relatos confirmados.
