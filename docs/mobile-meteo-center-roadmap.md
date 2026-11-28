# Argos Orbis mobile — METEO CENTER: sequência 1–6
Regra: custo zero, sem assinatura Previsão Masters, Supabase, contratação de compute ou cartão. Usar fontes abertas/autorizadas, atribuição, limites de consulta e processamento sob demanda. Não emitir alertas oficiais derivados de estimativas. Preservar mapa atual e notificações CAP reais.

| Etapa | Entrega | Critério de liberação |
|---|---|---|
| 1 | INPE CAPPI, escolha de radar e produto, escala dBZ, horários, cobertura, histórico curto; REDEMET somente com credencial gratuita autorizada | Validar resposta STAC e PNG real, CRS/orientação/alinhamento e atualidade; somente então integrar MapLibre; multinível depende de NetCDF real |
| 2 | GOES-19: GeoColor, IR, vapor e LightningCast | Validar fontes, geometria, horário, probabilidade e atribuição; sem prometer cobertura |
| 3 | Storm Tracker | Testar deslocamento em quadros reais, incerteza, fusões/divisões; distinguir estimativa de observação |
| 4 | Estações e pluviômetros | Validar acesso, unidades, horários, qualidade, cobertura e acumulados |
| 5 | Modelos e ensemble | APIs gratuitas para uso permitido, limites e comparação; índices apenas quando variáveis necessárias existem |
| 6 | Mapas simultâneos, IA explicativa e histórico leve | Validar desempenho e orçamento; manter CAP real separado; sem infra paga |

## Etapa 1A — descoberta
Catálogo oficial: https://data.inpe.br/dados/radares-meteorologicos/
Coleção: https://data.inpe.br/bdc/stac/v1/collections/br-weather-radar-cappi-1
Licença CC BY 4.0. A documentação confirma CAPPI 3 km e 15 níveis 2–16 km, resolução 1 km, PNG e NetCDF conforme radar. O metadado da coleção respondeu. As consultas individuais não puderam ser validadas neste ambiente.
O módulo de descoberta limita área, janela, tamanho e resultados; não envia localização pessoal, chave ou credencial. A amostra de testes é sintética e não entra no mapa. A ferramenta de diagnóstico é manual.
Executar: node --test tests/unit/inpe-radar-catalog.test.mjs
Diagnóstico real: node tools/probe-inpe-radar.mjs
Próximo: confirmar acesso ao endpoint de busca, domínios e formato dos assets, transparência/legenda e georreferenciamento do PNG. Não aceitar imagens antigas como atuais nem ausência de retorno como tempo seco. A atual versão do mapa continua intocada.

## Pesquisa de projetos no GitHub (2026-11-28)
- Etapa 1: https://github.com/evmpython/curso_radar_UNIFEI_INPE_2024 (referência científica, confirmar licença antes de copiar código); https://github.com/ARM-DOE/pyart (BSD-3-Clause, referência de processamento); https://github.com/brazil-data-cube/stac.py (MIT, referência de consulta).
- Etapa 2: https://github.com/uba/DSAT-cli (MIT, originalmente GOES-16; verificar endpoints atuais GOES-19); https://github.com/VitorTenorio232/glm-brasil-dashboard (referência, conferir licença e custo de execução).
- Etapa 3: https://github.com/openradar/TINT (BSD-2-Clause, alpha); https://github.com/tobac-project/tobac e https://github.com/pySTEPS/pysteps (BSD-3-Clause, referência e validação científica; não instalar pilha Python inteira no Worker).
- Etapa 4: https://github.com/vbasilioo/crawler-dados-inmet (referência de coleta; conferir API/termos atuais); inmetpy descontinuado, não usar como integração.
- Etapa 5: https://github.com/Unidata/MetPy (BSD-3-Clause, referência para CAPE e sondagens); https://github.com/open-meteo/weather-map-layer (GPL-2.0, experimental, exige isolamento cross-origin e teste em WebView; verificar licença/termos dos OMfiles antes de integrar).
- Etapa 6: https://github.com/maplibre/maplibre-gl-compare (comparação sincronizada); https://github.com/SysAdminDoc/StormviewRadar (referência funcional, dados e produtos dos EUA não substituem os brasileiros).
- Nenhum código de terceiro incorporado nesta pesquisa. Preferir dados oficiais pré-processados, consulta sob demanda, processamento leve no celular e testes com referências científicas. Sem ativar serviços pagos; integração depende de licença, cobertura, disponibilidade, limites e teste físico.

## Cobertura nacional
São Paulo foi região piloto, não uma restrição do produto. O diagnóstico consulta amostras das cinco regiões, verifica PNG e procura separadamente os produtos CAPPI 3 km e multinível. A documentação do INPE confirma que cada item pode conter apenas parte dos produtos; não inferir altitude a partir de PNG. O catálogo e a disponibilidade por região determinam o que pode ser exibido. Não confundir cinco amostras com cobertura integral do território; no app, consulta regional por área visível, com cache e limites. Nenhum APK publicado até reunir as seis etapas.

## Resultado 2026-11-28 — diagnóstico 46133137449
Amostras retornaram radares nas cinco regiões. CAPPI 3 km e 15 níveis reais confirmados em Chapecó (níveis 2000 a 16000 m). O eixo lat é crescente no CAPPI 3 km e decrescente no CAPPI15L observado; o bbox STAC diverge ligeiramente da grade 3 km. Usar eixos reais NetCDF, não inferir alinhamento do PNG. Motor de grade Web Mercator criado com paleta dBZ e dados ausentes transparentes; testes verificam ambos os sentidos e as grades reais. Ainda não há decodificação NetCDF no Android nem ligação à interface. Radares que só disponibilizam PNG não terão níveis inventados; a integração visual desses PNG exige confirmação própria. Sem mudança de preço ou publicação.

## Interface de consulta INPE (prévia)
Menu Camadas → Radares oficiais INPE. Consulta manual de área regional centrada no mapa, limite de 30 consultas/dia no aparelho, cache de cinco minutos, cancelamento ao sair. Mostra antenas, horário, produtos disponíveis no quadro mais recente. Sem sobreposição nem leitor NetCDF no aparelho até validação. Acesso WebView restrito à busca oficial STAC com parâmetros limitados; verificar CORS e teste físico. Não publicar APK.

## Leitura no dispositivo — teste de viabilidade
Avaliar netcdfjs 4.0.0 (MIT; NetCDF clássico) e h5wasm 0.10.3 (licença no pacote; HDF5/NetCDF4), fixados exclusivamente no diagnóstico. Comparar todas as 250 mil células por plano, coordenadas e valores ausentes com Python netCDF4, renderizar grades reais. Não incorporados ao APK nem carregados via CDN. Após aprovação, validar empacotamento local, licença, memória, CORS e funcionamento WebView antes da integração. Não publicar atualização nesta fase.

## Gate de compatibilidade WebView
Diagnóstico 46134076492: os 750 mil valores coincidiram com a referência Python nas três grades. Próxima validação empacota leitor navegador (esbuild 0.25.12), testa Web Worker local com CSP restritiva e compara novamente todas as células reais. Não é ainda teste no Android físico. Leitor e worker de desenvolvimento isolados em tools; ainda não distribuídos no APK. Limite de bundle 12 MiB, de arquivo 32 MiB, timeout 30 s por leitura no navegador. Sem CDN em execução.

## Empacotamento local
Validação 46134923013: três planos reais coincidiram integralmente no navegador, bundle 5.609.889 bytes. O build Android agora prepara o worker local e verifica o conteúdo e avisos de licença dos APKs. O diagnóstico usa exatamente o mesmo gerador e inspeciona CORS e caminhos reais das fontes antes de autorizar downloads na WebView. O worker ainda não é chamado pelo mapa; essa ligação depende do resultado do acesso direto. As versões diretas dos três pacotes são fixadas, e a árvore transitiva deverá ser congelada antes da publicação. Não liberar APK ou alterar o site/TV.
