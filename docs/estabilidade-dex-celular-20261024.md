# Quatro prioridades dos diagnósticos — 24/10/2026

Esta etapa trata do trabalho restante após a correção do acúmulo de relatórios sísmicos ([investigação anterior](memoria-catalogo-sismico-20261024.md)). As trajetórias, fórmulas, prioridades e durações da câmera não foram alteradas.

## 1. Processamento e fluidez

A fusão de catálogos calculava distância até todos os grupos formados, mesmo quando a diferença de horário já tornava a associação impossível. Um índice temporário por horário agora limita as comparações à janela de origem configurada. A distância, a precedência das fontes, a escolha por melhor pontuação e o desempate pela ordem original continuam iguais. Quando um grupo muda de horário, o índice também é atualizado.

Na emulação Chromium com CPU 4×, 1.200 relatórios de um catálogo de 30 horas produziram o mesmo resultado, conferido por hash:

| Medida | Antes | Corrigido |
| --- | ---: | ---: |
| Cálculos de distância | 360.000 | 2.996 |
| Mediana de quatro execuções aquecidas | 161,8 ms | 20,75 ms |

São 99,17% menos verificações nessa carga. Isso mede a rotina de fusão; não equivale ao FPS do mapa nem promete o mesmo ganho percentual em um aparelho físico. Casos aleatórios, fronteiras de janelas de dois/cinco minutos e mudanças do horário do grupo também foram comparados à busca completa.

[Resultado reproduzível](audits/session-v9-merge-runtime-20261024.json), ferramenta `tools/quake-merge-runtime-audit.cjs`.

## 2. Falhas e recuperação do mapa

Foram corrigidos dois mecanismos distintos:

- O sucesso de uma imagem diferente não apaga uma falha ainda pendente. As falhas são acompanhadas por identificadores de tiles, com conjunto limitado a 128, sem exportar esses identificadores pelo diagnóstico. O orçamento de tentativas não reinicia a cada imagem bem-sucedida durante uma oscilação. Falhas de uma região anterior podem ser retiradas quando uma nova visão termina de carregar com sucesso.
- No MapLibre 5.13.0, tentar recarregar um tile sem dados podia colocá-lo no estado `reloading` antes de existir uma textura. O renderizador então lançava `Cannot read properties of undefined (reading 'bind')`. A correção local mantém tiles sem dados em `loading`; tiles que já têm dados conservam o comportamento anterior. A regressão nativa falhou com a biblioteca original e passou com a corrigida, inclusive durante movimento do mapa.

O diagnóstico também separa falhas de scripts, JSONP do EMSC, imagens, estilos e recursos do mapa. As 27 falhas de recursos do relatório antigo **não podem ser atribuídas retroativamente todas ao mapa**, pois essa classificação ainda não era guardada.

A perda/restauração nativa de contexto WebGL foi testada mantendo o mesmo mapa e suas camadas. O ensaio inicial de dez minutos foi usado para descobrir o erro de textura e não é apresentado como um teste aprovado: [evidência da investigação](audits/session-v9-raster-investigation-20261024.json).

O ajuste da biblioteca é uma expressão em `_reloadTile`, com aplicação idempotente e verificação de versão em `tools/patch-maplibre-raster-retry.cjs`. A licença original foi preservada; não houve troca de versão nem alteração do percurso da câmera.

## 3. Consultas e fontes

- O prazo de espera de `fetchWithCorsFallback` agora cobre o corpo da resposta, não somente os cabeçalhos. Respostas rejeitadas têm seu corpo cancelado. Uma resposta que entrega cabeçalhos e fica parada não prende indefinidamente o chamador.
- Uma rodada não repete imediatamente as mesmas alternativas após falha total. A alternativa direta continua disponível se o coletor falha; a próxima tentativa pertence ao agendamento e ao circuito da fonte.
- USGS vulcões, VAAC e GDACS enchentes usam URLs estáveis e respeitam os circuitos abertos. Os testes simulam 100 chamadas durante indisponibilidade: VAAC/enchentes fazem três tentativas e suprimem 97, sem apagar os alertas de enchente existentes.
- A consulta online encontrou HTTP 200 em USGS vulcões, VAAC, GDACS enchentes, GDACS vulcões e status sísmico, mas HTTP 503 na rota AFAD antiga. O problema foi rastreado ao espelho comunitário. O catálogo oficial AFAD respondeu com JSON válido e passa a ser a primeira opção; o espelho permanece como alternativa. A janela é de 36 horas, com limite até 200 e horário da Turquia (`+03:00`) explícito para datas oficiais sem fuso.
- O coletor AFAD oficial recebe identidade própria de circuito/cache, para não herdar o bloqueio do espelho substituído. O status sísmico consulta a fonte oficial também.
- A resposta VAAC com um centro indisponível mantém os relatórios dos centros que funcionaram e informa `partial: true`, aproveitando a sinalização de cobertura parcial já existente no sistema.

Uma fonte externa pode voltar a falhar. O sistema não deve tratá-la como saudável, apagar dados válidos indiscriminadamente ou multiplicar as chamadas por causa disso. Nenhum aviso real foi enviado ao Telegram durante a validação.

## 4. Retenção e estabilidade de recursos

Foi encontrado outro cache que limitava entradas, mas podia guardar muitos objetos: cada zona meteorológica retinha até 50 mil pares de coordenadas. Agora o cálculo conserva somente longitudes exatas em `Float64Array` e extremos de latitude, com limite total de 8 MiB de coordenadas. Não há arredondamento de precisão ou mudança da regra do maior intervalo de longitude, inclusive em áreas que cruzam a linha de data.

O teste de 40 zonas × 50 mil pontos conferiu enquadramentos idênticos por hash. O acréscimo retido após coleta de lixo, **somando heap e backing storage dos buffers**, caiu de 84,23 para 7,81 MiB. Não é apenas uma transferência de memória para fora do heap. Entradas vencidas são removidas, a saída da página limpa o cache e respostas tardias não o repovoam.

[Resultado do cache](audits/session-v9-weather-area-memory-20261024.json), ferramenta `tools/weather-area-memory-audit.cjs`.

O ensaio final em tempo real mantém câmera nativa, renderizadores, camadas raster, falhas de imagem simuladas, renovação de 200 eventos e nós de áudio reais. Todo o tráfego externo é bloqueado ou substituído por imagens locais. O resultado e seus limites constam em [ensaio final](audits/session-v9-soak-final-20261024.json).

No ensaio final de 602,5 segundos houve 16 trocas, 258 requisições raster locais e duas falhas HTTP 503 injetadas. Não houve erro JavaScript. Após o aquecimento, a última metade ficou entre 26,75 e 27,91 MiB de heap principal; depois da limpeza, 26,69 MiB. Restaram dois canvases do mapa, zero nós de áudio transitórios, zero consultas compartilhadas em andamento e nenhuma fonte raster marcada como falha. O backing storage final foi de 18,09 MiB, informado separadamente do heap.

Os contadores locais novos incluem tamanho do cache de zonas, estado da recuperação e categorias de falhas, sem URLs, conteúdo de eventos ou coordenadas. As amostras identificam `session-stability-v9`.

## Validação e limites

- Suíte focada: 81 testes Node (incluindo parser vulcânico e contratos AFAD); serviços Worker: 123 testes e verificações adicionais de resumo, proxy e correlação. As suítes compartilham alguns contratos. Tudo com rede externa bloqueada/mocks.
- 45 testes de navegador passaram para recuperação raster/WebGL, celular/desktop, sequência, diagnóstico, consultas compartilhadas, cartão e sincronização de som com a câmera.
- Imagens dos testes são artificiais. CPU 4× e viewport 411×806 não reproduzem exatamente um Nothing Phone ou DeX.
- Os ensaios medem heap principal e buffers quando indicado; não medem toda a RAM do aparelho, GPU ou memória de workers. Dez minutos locais e atualizações aceleradas não equivalem às sessões físicas de dez/onze horas dos relatórios originais.

Para repetir, sirva o projeto em `127.0.0.1:4173`, exporte os arquivos da versão anterior com `git show 01ad2f8:CAMINHO > /tmp/arquivo-before.js` e execute as ferramentas mencionadas. O ensaio temporal usa `node tools/session-stability-soak.cjs`; `SOAK_SECONDS` permite ajustar a duração (padrão: 600 segundos).
