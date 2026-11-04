# Satélite infravermelho do Brasil

Produto GOES-East ABI, banda13 (janela limpa de10,3µm), distribuído pela NASA GIBS. A imagem colorida já é fornecida pelo produtor; o aplicativo não transforma chuva prevista em radar nem inventa cores a partir de pixels de nuvens. A legenda original é servida pela NASA.

Fontes: https://nasa-gibs.github.io/gibs-api-docs/access-basics/ e https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/GOES-East_ABI_Band13_Clean_Infrared.json .

A disponibilidade é consultada pelo DescribeDomains (intervalos subdiários). TIME preserva os delimitadores ISO sem escapá-los nessa operação; GetMap usa EPSG:3857 e a hora real confirmada. O serviço apresentou cerca de35minutos de defasagem na investigação inicial. A interface sempre exibe a hora do quadro e sua idade, sem selo ao vivo. Imagens com mais de90minutos são sinalizadas; fora de6horas não são exibidas.

GetMap entrega uma imagem regional de900×900pixels. O contorno IBGE já usado pelo projeto é aplicado em canvas nas mesmas coordenadas Mercator, inclusive ilhas e buracos. Cidades/referências e marcadores permanecem acima da camada. A camada não muda a câmera automaticamente nem se desliga por tipo de evento: continua habilitada no modo aleatório e só aparece geograficamente no Brasil. O botão Brasil é uma ação manual de enquadramento.

Uma canvas publicada e outra de trabalho mantêm a última imagem válida em caso de erro. O CanvasSource não mantém animação permanente: play/pause apenas atualiza a textura por quadro. Replay é opcional, limitado a seis horários e12MiB comprimidos; consultas são suspensas com a página/aplicativo em segundo plano, fora da área visível ou com a camada desativada. São chamadas diretas à fonte pública, sem novo Worker, Secret ou armazenamento GitHub de imagens.

A página /satellite/ oferece uma visualização dedicada. Site e aplicativo Android usam o mesmo modelo/controlador; o WebView libera apenas o produto e os caminhos NASA necessários. A TV não é alterada nesta entrega.

Validação: testes de horários/projeção, imagens reais do produtor no check de fonte e navegador com WebGL para recorte, animação/cache, falhas, recuperação de estilo e pausa. Fixtures de navegador não substituem disponibilidade da fonte no aparelho; a prova de fonte verifica uma imagem real separadamente.
