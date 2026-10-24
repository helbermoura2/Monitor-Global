# Diagnósticos 6 — DeX e celular, analisados em 24/10/2026

Comparação de dois arquivos exportados pelo proprietário. Não foram publicados os arquivos originais. O primeiro identifica Samsung Internet/DeX; o segundo identifica Chrome Android, mas a identificação fornecida pelo navegador não comprova o modelo físico do telefone.

| Medida | DeX, 23/10 | Celular, 24/10 |
| --- | ---: | ---: |
| Tempo visível observado | 11h31 | 10h07 |
| Heap JS final reportado | 756,26 MiB | 712,39 MiB |
| Tarefas longas | 5.470 | 27.410 |
| Tempo em tarefas longas | 2,21% | 10,31% |
| Quadros/s na amostra de diagnóstico | 59,99 | 48,51 |
| Erros JavaScript | 0 | 2 |
| Erros HTTP observados | 1.188 | 1.138 |
| Perdas de contexto WebGL | 0 | 0 |

Amostras de fluidez são de aproximadamente um segundo por minuto, não FPS contínuo do mapa. O heap é aproximado, em degraus, e não inclui uma medição confiável da RAM/GPU total. Mesmo após os caches chegarem a seus limites de entradas, os valores reportados continuam subindo: não existe evidência de estabilização nessas duas sessões.

## Falhas corrigidas

1. Voz da nuvem: interrupções apenas pausavam o elemento anterior. URLs blob ficavam esperando ended/error que não acontecem com pause, e os nós de áudio não eram desconectados. A limpeza agora cobre interrupção, término, erro, falha ao tocar, saída/ocultação da página e respostas tardias. Osciladores, ruído e bipes sísmicos também desconectam seus nós ao terminar.
2. O contrato de voz aceita até 400 caracteres. O cliente agora usa a voz nativa integral para textos maiores, evitando um HTTP 400 garantido. Falhas 429/5xx recebem pausa curta; timeout genuíno continua permitindo voz nativa. Os relatórios antigos agrupam parte das rotas como other: não se pode atribuir todos os 400 históricos à voz. O coletor 7 distingue /tts.
3. AFAD registrou 700 e 603 falhas, apesar da pausa anunciada. O cliente agora respeita SourceHealth e consulta a rota própria já existente /afad-earthquakes, preservando a deduplicação e sem inventar horário para dados incompletos. Catálogos sem novidades não precisam reconstruir a lista inteira.
4. GDACS vulcões registrou 1.165/871 tentativas, muitas abortadas. A URL com horário e a tentativa duplicada foram removidas; SourceHealth passa a ser respeitado por produto. USGS e VAAC continuam independentes.
5. Overpass: 341 falhas no DeX e 304 respostas 406/502 no celular. Falhas do enriquecimento opcional agora compartilham uma pausa de cinco minutos entre coordenadas, sem pausar sismos. Não se transforma indisponibilidade em população zero.
6. Os dois TypeError do celular foram localizados em weather-warning-camera.js:70. A rotina acessava limites sem validar a estrutura. Dados inválidos e mapa removido agora retornam sem interromper outra transição. As coordenadas do aviso original não são guardadas pelo diagnóstico, portanto o registro exato não pode ser reconstruído. Enquadramentos válidos e o passeio da câmera conservam as fórmulas anteriores.
7. Produtos oficiais USGS: o limite de 40 entradas não limitava tamanho nem removia entradas vencidas de outros eventos. Adicionado orçamento de 8 MiB de texto UTF-16 estimado, expiração efetiva, recência e limpeza na saída. O orçamento não equivale ao tamanho real dos objetos no heap.
8. Atualizações de fontes em lote agora pintam a lista uma vez por quadro, mantendo o estado atualizado imediatamente.
9. Ações do cartão no celular podiam encolher no contêiner flex e ficar sem área útil de toque. flex-shrink:0 preserva a linha de botões. Reproduzido também na versão anterior; o teste de evolução/costas/relatos passou após a correção.

## Evidências e limites

- Teste de 100 falas interrompidas: uma URL e dois nós enquanto a fala atual existe; zero após término/limpeza. Resposta de voz ultrapassada não toca depois da atual. Timeout genuíno preserva fallback.
- Teste de 30 produtos oficiais grandes: orçamento estimado respeitado; após expiração, zero entradas/bytes estimados retidos.
- Em 100 chamadas simuladas por fonte em falha, AFAD e GDACS fazem três tentativas antes de suprimir as restantes pelo circuito. Esses números não prometem disponibilidade dos servidores externos.
- Ensaio com 120 trocas reais de cartão, raster nativo com PNG local de 256 pixels, viewport 411×806, DPR 2,625 e CPU 4×: 136,3 segundos medidos após aquecimento, heap principal após GC de 22,09 a 24,10 MiB, máximo 24,25 MiB; última metade entre 23,69 e 24,25 MiB. Dois canvases ao final de todas as amostras; ouvintes 450→452; zero erros de página. Não usa satélite real nem mede GPU, workers, rede real ou fluidez do voo. Ver [ensaio](audits/session-v7-raster-20261024.json).
- Ensaio separado de 5.000 requisições nativas e 5.000 pelo fetch wrapper não reproduziu crescimento contínuo após GC: wrapper aproximadamente 1,18→1,25 MiB. Não foi feita uma troca especulativa desse componente. Ver [ensaio de fetch](audits/fetch-retention-20261024.json).
- As provas locais não demonstram que todo o crescimento de 700+ MiB das sessões físicas foi eliminado. Só uma sessão nova com os scripts atualizados pode validar isso ao longo das horas; não se usou recarga automática nem ocultação dos erros para aparentar estabilidade.

## Diagnóstico 7 e conferência após publicar

Recarregar o site e iniciar uma medição nova. Cada amostra nova identifica long-session-v7 e acrescenta contadores de URLs/nós de áudio, tamanho estimado dos produtos oficiais e pinturas da lista de fontes. Mantém a coleta local, opt-in, limitada e sem envio automático. Relatório anterior preservado não deve ser confundido com sessão inteiramente feita com as correções.

O próximo relatório deve conferir a evolução do heap durante uso real, URLs de áudio em 0/1, nós transitórios que voltam a zero, orçamento de produtos respeitado e redução das tentativas das fontes em falha. Não exige repetir onze horas para obter uma primeira leitura, mas uma observação curta não comprova estabilidade de um dia inteiro.

Os testes antigos de som durante o passeio desligavam o renderizador, mas ainda esperavam movimento nativo e usavam cinzas para uma prioridade que hoje exige lava. Os fixtures foram alinhados aos contratos atuais, sem alterar a câmera ou a política vulcânica em produção.

## Atualizações posteriores desta investigação

O acúmulo no catálogo foi reproduzido e corrigido em [memória dos relatórios sísmicos](memoria-catalogo-sismico-20261024.md). As quatro prioridades seguintes, incluindo processamento, recuperação raster, consultas e cache de áreas meteorológicas, estão em [estabilidade DeX/celular](estabilidade-dex-celular-20261024.md). Os números antigos acima são históricos; não representam uma sessão carregada com `session-stability-v9`.
