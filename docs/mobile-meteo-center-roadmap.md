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
