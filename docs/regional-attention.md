# Atenção regional

Cartão contextual separado abaixo do painel no desktop e após os detalhes no
mesmo painel rolável no celular. Só acompanha o sismo selecionado; revisões
reavaliam os critérios, e mudar de evento remove o aviso. Não cria registro,
som, prioridade, tsunami, publicação ou consulta de rede. Sem profundidade
positiva numérica, abstém-se (zero pode representar profundidade desconhecida).

## Política editorial inicial, versão 20261020

Estes **não são limiares oficiais**, mapas de risco, previsões, fronteiras de
falha, nem um catálogo completo de áreas perigosas. São critérios de triagem
editorial acordados para destacar grandes sismos nas regiões discutidas.
As geometrias são aproximações explícitas em `js/regional-attention.js`.
Não derivar intensidade, danos, população atingida ou tsunami deste resultado.
Ausência de cartão não significa segurança. Os critérios podem perder eventos
fora das áreas ou abaixo dos valores, e incluir eventos de impacto limitado.

| Área de referência | Magnitude mínima | Profundidade máxima km | Localização |
|---|---:|---:|---|
| Mármara / Istambul | 7 | 30 | 180 km de 29E, 40,8N |
| Manila / Vale Oeste | 7 | 30 | 160 km de 121,05E, 14,6N |
| Teerã | 7 | 30 | 150 km de 51,4E, 35,7N |
| Himalaia, incluindo Nepal | 8 | 40 | Polígono regional aproximado |
| Bangladesh / margem indo-birmanesa | 8 | 50 | Polígono regional aproximado |
| Japão / Nankai | 8 | 50 | Polígono regional aproximado |
| Cascadia | 8,7 | 50 | Polígono regional aproximado |
| Sumatra / margem de Sunda, incluindo Padang | 8,5 | 50 | Polígono regional aproximado |
| Peru / Chile, incluindo Lima e Callao | 8,5 | 60 | Polígono regional aproximado |
| Alasca / Aleutas | 8,5 | 50 | Polígono contínuo através da linha de data |

O texto informa a magnitude e a profundidade recebidas e explica o critério.
Não usa o nome do local para determinar a região. Não há magnitude máxima de
cenário: um evento acima do mínimo continua elegível até M10 (limite dos dados).
Se houver sobreposição, há um único cartão com todas as regiões correspondentes.
O cartão não afirma tremor forte em uma cidade específica sem mapa de intensidade.

Referências para contexto científico (não fontes destes limiares editoriais):
- USGS, magnitude e intensidade: https://www.usgs.gov/programs/earthquake-hazards/earthquake-magnitude-energy-release-and-shaking-intensity
- JMA, informação sobre a Fossa de Nankai: https://www.jma.go.jp/jma/en/Activities/earthquake.html
- USGS, subducção de Cascadia: https://www.usgs.gov/programs/earthquake-hazards/science/cascadia-subduction-zone

## Tsunami

A integração existente de `TsunamiMap` / `TsunamiPresentation` continua ativa:
cores por categoria oficial ou amplitude publicada, costas identificadas no
boletim e passeio por regiões disponíveis. Não inferir ameaça a partir deste
cartão ou da magnitude. Os contornos cartográficos não preveem inundação.
`FullScreenEffects` permite automaticamente apenas lava, chuva e M8+.
Tsunami de tela inteira continua demonstrativo; nenhum modelo JULES foi ativado.

Validação isolada: `tests/unit/regional-attention.test.cjs` e
`tests/regional-attention.spec.js` (desktop/celular, revisão, seleção e geometria).
