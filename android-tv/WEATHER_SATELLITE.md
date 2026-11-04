# Satélite meteorológico na TV — 1.0.47

O boletim horário mantém o cartão de condições do tempo por 12 segundos. Com “Satélite do Sudeste após o boletim do tempo” ativado, uma imagem infravermelha estática aparece em seguida por 15 segundos no canto superior direito, sem capturar comandos ou ocupar a tela inteira. A consulta começa apenas quando o boletim pode ser exibido. Fontes lentas ou sem imagem válida são dispensadas nessa apresentação. Alertas reais, resumos sísmicos e tela desligada cancelam imediatamente a sequência e sua consulta.

“Ver satélite do Brasil · controle remoto” abre um visualizador manual com Brasil/Sudeste, Atualizar e animação explícita dos horários informados pela fonte. Voltar continua disponível durante o carregamento. Sair ou colocar o aplicativo em segundo plano cancela consultas e libera imagens. Não há reprodução contínua em segundo plano.

Produto: GOES-East ABI banda 13, NASA GIBS/NOAA. A fonte entrega o realce e a legenda originais. Datas e idade da imagem aparecem em Brasília. O infravermelho representa temperatura de brilho; não é radar de chuva, medição de milímetros, detecção de raios ou alerta automático de tempestade. Pode haver defasagem. Imagens com mais de 90 minutos são sinalizadas; fora de 6 horas não são aceitas.

O cliente nativo consulta os horários DescribeDomains e o WMS em EPSG:3857, com o mesmo recorte IBGE do site. A imagem tem largura de 512 pixels e altura proporcional à área Mercator. Quadros vazios ou com menos de 98% da cobertura nacional esperada são ignorados. O histórico contém no máximo seis horários e 4 MiB de PNGs comprimidos; apenas o quadro exibido fica decodificado. A apresentação automática usa um único quadro, sem WebView ou loop gráfico permanente. As chamadas vão diretamente à NASA, sem novo consumo de processamento no Worker do projeto.

Testes: horários e projeção, falhas e cobertura parcial, recorte, cache, cancelamento de resposta tardia, prioridade e fechamento da janela. A CI também consulta uma imagem regional real e exporta a renderização nativa no log. Isso não substitui confirmação física no Fire Stick.
