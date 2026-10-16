# Referências costeiras dos boletins

Natural Earth 1:50m, domínio público. Fontes:
https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

`ne-50m-coastal-regions.geojson` contém faixas cartográficas costeiras recortadas pela terra dos países e, para os boletins NTWC, Alasca, Havaí, Washington, Oregon, Califórnia e Colúmbia Britânica. Não inclui fronteiras interiores. A costa original é simplificada em 0,025 grau. As faixas ilustrativas são construídas em 0,10 e 0,22 grau, recortadas pela terra, simplificadas em 0,015 grau e arredondadas a cinco casas decimais. Essas larguras são escolhas gráficas, não distâncias ou limites físicos de inundação. Contornos são referências geográficas; não representam trechos oficialmente delimitados, zonas de inundação ou cálculo de propagação.

Reconstrução: instalar Shapely 2.x e executar `tools/build-tsunami-coasts.py` com o diretório dos três arquivos Natural Earth abaixo. SHA256 das fontes utilizadas:

- ne_50m_coastline.geojson: 271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283
- ne_50m_admin_0_countries.geojson: 3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb
- ne_50m_admin_1_states_provinces.geojson: 69a0e06e640b2d505858ae1cb63034e4677f3000b35a98e16312932b98c426b9

O navegador carrega o catálogo uma única vez, sob demanda, somente quando o boletim selecionado cita regiões nominalmente. O tamanho da versão atual está informado abaixo. As camadas são estáticas e removidas ao trocar de evento. Polígonos publicados pelo NWS são desenhados diretamente, sem esta consulta. Ilhas ausentes nesta escala ficam explicitamente contabilizadas como sem contorno.

## Modelo 1 — costas pintadas

A versão 3 acrescenta a linha costeira original (sem fronteiras interiores) e sete setores cartográficos: Kamchatka, Curilas, Nordeste do Japão, Hokkaido, Aleutas, Sul do Alasca e costa pacífica da Rússia. Os setores são recortes geográficos das faixas de referência, não divisões de alerta oficiais. Só entram no mapa se o boletim nomear a região correspondente. As Aleutas a oeste da linha de data, ausentes na linha administrativa estadual do Natural Earth, são recuperadas da geometria nacional dos EUA.

`tools/build-tsunami-paint.py /path/to/ne_50m_coastline.geojson` acrescenta os setores e a linha costeira ao catálogo base. O gerador original chama esta etapa automaticamente. A costa é simplificada em 0,012 grau e usa o mesmo arquivo e SHA256 já documentados acima. O catálogo completo tem cerca de 4,17 MB (1,34 MB gzip) e permanece sob demanda, com uma única transferência compartilhada e cache em memória.

O preenchimento principal usa as faixas costeiras recortadas em terra. A linha real da costa reforça a leitura em escala de globo com uma largura gráfica mínima, que diminui ao aproximar. Essa largura é cartográfica, não mede inundação nem alcance em terra.
