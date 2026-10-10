# Referências costeiras dos boletins

Natural Earth 1:50m, domínio público. Fontes:
https://github.com/nvkelso/natural-earth-vector/tree/master/geojson

`ne-50m-coastal-regions.geojson` contém faixas cartográficas costeiras recortadas pela terra dos países e, para os boletins NTWC, Alasca, Havaí, Washington, Oregon, Califórnia e Colúmbia Britânica. Não inclui fronteiras interiores. A costa original é simplificada em 0,025 grau. As faixas ilustrativas são construídas em 0,10 e 0,22 grau, recortadas pela terra, simplificadas em 0,015 grau e arredondadas a cinco casas decimais. Essas larguras são escolhas gráficas, não distâncias ou limites físicos de inundação. Contornos são referências geográficas; não representam trechos oficialmente delimitados, zonas de inundação ou cálculo de propagação.

Reconstrução: instalar Shapely 2.x e executar `tools/build-tsunami-coasts.py` com o diretório dos três arquivos Natural Earth abaixo. SHA256 das fontes utilizadas:

- ne_50m_coastline.geojson: 271f1c4c1908312bac6b29d158ea1356544beafc129f260005300913aa5ea283
- ne_50m_admin_0_countries.geojson: 3e458fc036ad0a66411f2c1e6cac49c5d7bfb81cb1123bc513b22511a2b7fdeb
- ne_50m_admin_1_states_provinces.geojson: 69a0e06e640b2d505858ae1cb63034e4677f3000b35a98e16312932b98c426b9

O navegador carrega os 2,85 MB (aproximadamente 955 kB comprimidos) uma única vez, sob demanda, somente quando o boletim selecionado cita regiões nominalmente. As camadas são estáticas e removidas ao trocar de evento. Polígonos publicados pelo NWS são desenhados diretamente, sem esta consulta. Ilhas ausentes nesta escala ficam explicitamente contabilizadas como sem contorno.
