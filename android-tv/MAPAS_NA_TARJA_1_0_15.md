# Mapas na faixa — TV 1.0.15

O mapa aparece acima da extremidade direita da tarja inferior: sobe por trás da faixa na entrada e desce na saída. Na preferência de tarja no topo, fica abaixo dela, para não sair da tela. A altura se adapta ao espaço livre; em telas sem espaço mínimo o texto da tarja permanece disponível. O tamanho da tarja, o rodapé e os tempos aprovados não mudam.

- Sismo: epicentro nas coordenadas do catálogo. Sem coordenada válida, não presume `(0,0)`.
- Sismo + tsunami: o mapa acompanha a página de 8 segundos da informação exibida, com a mesma transição suave.
- Tsunami: referências costeiras das regiões do grupo exibido, reaproveitando o modelo dos boletins e das imagens compartilhadas. Respeita o raio explícito do boletim; não desenha zonas de inundação ou ondas calculadas. Cancelamento e sem ameaça usam seus estados e cores, sem conservar a cor de ameaça anterior. Região não reconhecida fica indicada como referência parcial.
- Resumo: cada um dos cinco eventos tem seu próprio epicentro; mantém 6 segundos completos por evento, além das transições e entrada/saída (34 segundos com animação). Replay do resumo preserva as coordenadas originais.

## Custo e recursos

Base vetorial Natural Earth, domínio público, já incluída no APK (~448 kB antes da compressão). Não é imagem de satélite. Não baixa tiles, abre WebView/MapLibre, busca imagem no Telegram nem cria consultas adicionais ao Durable Object. O servidor acrescenta coordenadas e referências costeiras limitadas ao feed existente. O mapa não participa da identidade/versão semântica do alerta, portanto esta atualização não dispara notícias antigas.

Uma fila de preparação por tarja, no máximo os cinco mapas do resumo ou os dois mapas do aviso pareado. Geometria preparada fora da thread principal, caminhos reaproveitados no desenho. Ao fechar a tarja: cancela a preparação pendente, remove callbacks e libera os desenhos; apenas a base de terra compacta permanece compartilhada no processo. Sem bitmaps ou mapas GPU adicionais.

Os boletins usam o mesmo recorte e reconhecimento geográfico de `worker/tsunami-bulletin.mjs`. A referência para TV é simplificada e a resposta limita linhas e pontos para manter o tamanho do feed e dos replays. Não é uma delimitação física precisa. O aviso da fonte oficial prevalece.

Reconstrução determinística:

```
python tools/build-tv-map-assets.py
node tools/build-tv-map-demo.mjs
node tools/tsunami-lifecycle-fixtures.mjs
node tools/build-worker-bundle.mjs
```

Os dados de origem e créditos estão em `assets/tsunami/README.md` e `assets/seismic/ne-50m-land.geojson` (Natural Earth). A demonstração local de Vanuatu continua identificada como fictícia, incluindo a costa colorida. Nenhum aviso real ou mensagem Telegram é enviado pelos testes.

## Validação

Testes Worker: raio de 300 km, sem ameaça/cancelamento, preservação de outra região, ausência de região reconhecida, linha de data, coordenadas dos cinco sismos, ausência de coordenada inventada e resposta de 120 registros abaixo do limite de 256 KiB. Testes JVM: projeção, polos, codec/replay, resumo offline, rejeição de mapa opcional excessivo, mais os testes existentes do ciclo de tsunami e de duração. Compilação e lint de release obrigatórios.

A aparência e a fluidez na TCL/Fire Stick devem ser conferidas pelo proprietário após instalar a atualização; os testes locais não constituem observação desses aparelhos.
