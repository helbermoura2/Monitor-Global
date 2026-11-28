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

## Primeira camada visual CAPPI
Diagnóstico 46135195448 confirmou CORS direto para STAC e ambos os formatos NetCDF em data.inpe.br. A interface passa a selecionar quadro e altitude, baixar arquivo de origem limitada, processar em worker local e desenhar imagem georreferenciada MapLibre. Limites: 12 downloads por sessão, 32 MiB por arquivo, cache de um arquivo, cancelamento, expiração em 90 minutos. Sem sobreposição PNG para antenas sem NetCDF. RainViewer, satélite e modo severo permanecem independentes. Falta comprovar comportamento integrado da UI e no aparelho; não publicar APK.

## Validação integrada da camada
Build 46135331296 e diagnóstico 46135326791 aprovados. Acrescentado teste Chromium de interação com os bytes NetCDF reais do diagnóstico e catálogo controlado: seleção de 15 níveis, alternância 3/16 km, cache do arquivo, remoção da camada e retorno ao RainViewer. Base cartográfica e demais serviços isolados para não confundir falhas externas com a integração. Corrigido cancelamento do worker e descarte de cache ao pausar. Aguardando resultado; não substitui teste físico nem comprova cobertura integral.

## Etapa 1 — aprovação do núcleo CAPPI
Diagnóstico 46136300592 e Android 46136304755 aprovados; teste visual com dados NetCDF reais confirma 15 níveis, troca de 3/16 km, cache, remoção e retorno ao RainViewer. A validação física, PNG sem NetCDF e REDEMET autorizado seguem pendentes. Não publicar versão intermediária.

## Etapa 2A — fontes e produtos satelitais
- NASA GIBS / NOAA GOES-East: https://nasa-gibs.github.io/gibs-api-docs/access-basics/ ; https://www.star.nesdis.noaa.gov/GOES/fulldisk_band.php?band=GEOCOLOR&length=12&sat=G19&src=nav
- INPE SOS Chuva: https://satelite.cptec.inpe.br/soschuvaapp/ ; índice público candidato https://granizo1.cptec.inpe.br/nowcasting/LightningCast/
- LightningCast representa probabilidade de raios nos próximos 60 minutos, não observação GLM nem alerta oficial. Acesso ao índice pode falhar; não supor licença de redistribuição, geometria ou dados nacionais sem verificar. Não copiar produtos CIMSS cuja redistribuição depende de consentimento.
- Diagnóstico separado: ler catálogo WMTS, descobrir identificadores e matriz de GeoColor, bandas 8–10 (vapor), 13 (IR) e possíveis RGB; consultar horários reais e obter WMS em EPSG:3857 para toda a extensão brasileira, verificar PNG, transparência e CORS. Distinguir dados indisponíveis de aprovação. Nenhuma mudança no site/TV ou no APK nesta fase.

## Etapa 2 — avanço de fontes
Diagnóstico 46137087752: amostras PNG GeoColor, Band13 e Air Mass disponíveis via NASA GIBS, com CORS. Air Mass cobre apenas 76,07% da caixa amostrada (não inferir cobertura brasileira integral). INPE GOES19-L2-CMI-1, Public Domain, lista B08/B09/B10 e demais canais. O teste agora baixa cada canal recente com limite de 64 MiB por arquivo exclusivamente no CI, inspeciona projeção e temperatura de brilho, confirma cinco pontos brasileiros via pyproj e exige os três canais válidos. Não é ainda integração móvel, nem decisão de tamanho aceitável no aparelho. LightningCast continua pendente.

## Etapa 2B — integração móvel de imagens GIBS
Diagnóstico 46137378660 confirmou GeoColor, IR, Air Mass e B08/B09/B10, com DQF=0 nos cinco pontos de amostra dos três canais. Nova implementação exclusivamente móvel oferece GeoColor, IR e Air Mass usando o controle de satélite já existente, com seleção de produto, cache isolado, horário e aviso de cobertura parcial. Air Mass não é escala quantitativa. Os arquivos NetCDF de vapor mediram 17–20 MB; ainda não integrados. Próximo diagnóstico inspeciona os subdiretórios LightningCast e verifica formato, mas não presume georreferenciamento ou direitos de redistribuição. Testes de UI serão executados no APK; nenhuma publicação e nenhum site/TV alterado.

## Correções após integração GOES
Execução 46137956297 aprovou as fontes GOES. LightningCast retornou PNG RGBA 1600×1400 no diretório nacional, com nomes de início/fim separados por uma hora; o exemplo o20261128-103000_f20261128-113000.png foi observado em 28/11/2026. Georreferenciamento, interpretação de horário e autorização de reutilização permanecem não confirmados. Diretório png_sp excedeu 2 MiB. Execução 46137960452 compilou o Android, mas falhou na asserção visual da legenda ao alternar produtos: corrigida visibilidade explícita, inclusive em falha de carregamento. Execução 46137956309 falhou exclusivamente pela consulta recente paulista vazia, apesar de amostras recentes em outras regiões e validações científicas/UI aprovadas. Diagnóstico recente agora procura amostras em até seis caixas regionais, sem ampliar janela de 90 minutos e sem substituir dados recentes por históricos. Se nenhuma amostra recente estiver disponível, permanece falha. Não publicar APK intermediário.

## Etapa 2C — recorte eficiente de vapor d'água
Android 46150604298 e INPE 46150599351 aprovados. Novo diagnóstico compara 90 mil posições por banda (270 mil ao todo) entre Python/PROJ/netCDF4 e JavaScript/HDF5, incluindo coordenadas, máscara DQF e temperatura. O leitor usa janela geostacionária limitada ao Brasil, com até 9 milhões de células, em vez de descompactar o disco integral de 29,4 milhões. Limite de download 32 MiB, apenas diagnóstico por enquanto; arquivo bruto ainda é transferido integralmente. Sem nova infraestrutura ou liberação do APK. Validar resultado e memória antes de integrar na UI.

## Correção de precisão geostacionária
Android 46151006648 passou; GOES 46151001449 aprovou as seis fontes, porém a comparação JS/Python falhou no índice 1326 (coluna 3773 vs 3772). Teste local com parâmetros nominais GOES-R reproduziu exatamente essa diferença: PROJ e fórmula JS concordam em aproximadamente 2×10⁻¹⁷ rad; o desvio é reproduzido pelo arredondamento float32 do desempacotamento de coordenadas. A referência científica passa a desempacotar eixos brutos em float64 antes de multiplicar/ somar, com desempate de vizinho consistente na ordem original. Nenhuma tolerância de posição foi ampliada: ainda é exigida igualdade de linha e coluna para todos os 270 mil pontos, temperatura e qualidade. A validação com os arquivos reais continua pendente. 

## Separação de atualidade e validação científica
Execução 46151743418 não chegou à comparação de 270 mil pontos: último quadro INPE 12:20Z, consulta 13:52Z, acima do limite de 90 min. Agora a comparação científica pode usar uma observação real dentro da janela de busca de 3h, explicitamente marcada scientific_reference_only quando defasada. O workflow exige separadamente as três bandas e idade <=90 min para aprovação operacional; uma fonte atrasada continua deixando a verificação vermelha mesmo com leitor aprovado. Não alterar a regra de atualidade do aplicativo. Nenhum APK publicado.
