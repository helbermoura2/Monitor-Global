# Pintura oficial e câmera da sequência

O sismo selecionado consulta sob demanda a intensidade MMI publicada pelo USGS ShakeMap, para magnitudes M5,5 ou maiores. Uma grade geográfica CRS84 válida, associada à origem do evento, é suficiente: uma ruptura finita não é mais obrigatória para aproveitar a intensidade oficial. A associação exige até 80 km, cinco minutos e diferença de magnitude de até 1,5; sem identificador USGS, a busca precisa encontrar uma única correspondência.

Quando o produto inclui ruptura finita válida, a distribuição publicada já incorpora o modelo dessa ruptura. Quando há somente fonte pontual/grade, usa-se a intensidade oficial sem afirmar direção de falha. Produto incompatível, ausente ou inválido mantém a estimativa radial GlobalQuake, explicitamente identificada como modelo aproximado; não se deduz direção da magnitude, das réplicas ou do mecanismo focal.

Mapa ao vivo, Telegram, Story e gerador de vídeo aceitam essas duas classes de produto. Telegram e Story compartilham o pintor que interpola a MMI geográfica e mantém as bandas e cores oficiais (meio grau MMI). Ausência de dados ou pontos fora da grade não recebem preenchimento radial inventado. A intensidade no epicentro e a legenda identificam USGS ShakeMap quando utilizado. O limite de uma grade é o limite dos dados disponíveis, não necessariamente o fim do tremor sentido.

As cores são recortadas em terra Natural Earth. Intensidade é estimada, mesmo no ShakeMap; não confirma relatos ou danos. Grade: máximo de 60 mil células; geometria ao vivo: máximo de 100 mil vértices. A consulta tem cache de cinco minutos, memória limitada e associação validada. As imagens enquadram a distribuição oficial, mantendo o epicentro na posição compartilhada próxima do semicírculo. Nenhuma textura aleatória ou elipse estética é aplicada.

Cartões do Telegram publicados nas últimas 24 horas são verificados em lotes de no máximo três, com intervalo mínimo de cinco minutos por cartão para novos produtos. Um novo ShakeMap altera a imagem existente; dados iguais não geram edição repetida. Falha temporária do provedor preserva a imagem oficial já publicada e a população disponível. Grades completas não são persistidas no histórico Telegram, apenas sua versão e os dados básicos do evento. Não são enviados testes ao canal por essa rotina.

A câmera ao vivo enquadra os limites da área pintada (MMI II+), o epicentro e os eventos associados como possíveis réplicas. Respeita os cartões e o espaço útil da tela. Mantém vermelho, azul nos segundos finais e permanência final na área pintada. Atualizações de geometria não reiniciam o relógio físico nem trocam a seleção; interação manual interrompe o enquadramento automático. Dados atrasados de outra seleção não alteram o mapa atual.

## Projeção da ruptura publicada

Quando o produto oficial informa ruptura finita, o navegador busca o `rupture.json` do **mesmo evento e da mesma versão** do ShakeMap. O perímetro dos polígonos é projetado em longitude/latitude e desenhado como um traçado claro com borda escura sobre a pintura. Não há elipse sintética nem inferência de orientação por magnitude, nome do local, mecanismo focal ou réplicas. O traçado pode ser irregular e conter vários segmentos; sua forma depende dos dados daquele sismo. A pintura MMI permanece a grade oficial, não uma distribuição recalculada a partir do traçado.

A identificação “Projeção da ruptura USGS” distingue o modelo publicado. A falha pode estar em profundidade: o desenho **não significa necessariamente uma rachadura observada na superfície**, nem confirma extensão de danos. Sem geometria finita disponível/compatível, mostra-se somente a pintura existente. Há no máximo duas consultas extras por produto, seis segundos de limite total para a geometria e o mesmo cache de cinco minutos. Falhas preservam o mapa oficial; troca de seleção cancela consultas pendentes. Nenhum novo consumo de Workers KV ou mensagem ao Telegram é introduzido.

A geometria valida limites de tamanho, coordenadas, fechamento, continuidade no antimeridiano e proximidade à grade associada. O traçado entra nos limites usados pelo enquadramento, acompanha a visibilidade da camada e é removido na troca de evento.

O teste **Mapa oficial USGS** agora inclui a geometria real de Pazarcık (`us6000jllz`), versão `us6000jllz-1756921940993`, obtida de https://earthquake.usgs.gov/product/shakemap/us6000jllz/us/1756921940993/download/rupture.json . A amostra bruta está em `tests/fixtures/shaking/turkey-us6000jllz-rupture.json`. O cenário **Ruptura alongada fictícia** permanece separado para testar câmera e pintura simuladas; não é aplicado aos eventos reais.

## Fontes adicionais e alternativa sem grade de intensidade

O mapa do site consulta o USGS primeiro. Se não obtiver uma grade compatível, procura os produtos publicados por **INGV ShakeMap** e **ShakeMap-EU**. O segundo reúne dados e modelos de EMSC, ORFEUS, EFEHR e instituições participantes; não se apresenta como um mapa produzido exclusivamente pelo EMSC. Os produtos selecionados são instrumentais, não os diretórios `_ri` de relatos. Relatos do LastQuake não são convertidos em uma área contínua de intensidade por esta integração.

`tools/update-official-shaking.py` verifica os catálogos oficiais a cada 15 minutos por GitHub Actions (o agendamento pode atrasar). Converte as grades XML em até 16 mil amostras publicadas, com indicação de resolução reduzida. Não cria MMI em células sem dado. O limite de desenho continua sendo M5,5 no evento selecionado. São considerados até 24 eventos recentes por fonte, dos últimos sete dias; durante períodos sem eventos elegíveis, um exemplo histórico real por fonte mantém a integração verificável. Esses arquivos **não criam eventos no catálogo**, não disparam alertas e só aparecem se houver associação única por origem.

O catálogo estático está em `data/official-shaking/index.json`. O navegador valida a associação em até 30 segundos, 80 km e diferença de magnitude de 1,5, recusando correspondências ambíguas dentro de uma fonte. O produto deve corresponder ao identificador e à versão do índice e conter uma grade válida cobrindo a origem. As versões são identificadas pelo hash dos metadados oficiais. Erros de origem, cenários, coordenadas, duplicação de células ou dimensões incompatíveis são recusados. Uma falha temporária preserva a cópia anterior verificada. Grades extensas demais para os limites atuais não são substituídas por uma pintura oficial inventada.

Fontes e documentação:

- https://shakemapeu.ingv.it/ — `events.json`, `data/<id>/current/products/{info.json,grid.xml,rupture.json}`.
- https://shakemapeu.ingv.it/scientific-background-eu.md — instituições e metodologia do ShakeMap-EU.
- https://shakemapeu.ingv.it/disclaimer-eu.md — mapas automáticos, preliminares e sujeitos a revisão.
- https://shakemap.ingv.it/ — os mesmos caminhos para os produtos INGV.

Quando nenhuma grade oficial foi obtida, a consulta também procura a geometria publicada de ruptura no USGS, separadamente da grade: `download/rupture.json` no produto ShakeMap ou `FFM.geojson` no produto `finite-fault`. Ponto de origem e planos nodais não qualificam como geometria de ruptura. O evento é validado por identificador, horário, coordenadas e magnitude; o arquivo deve vir do domínio oficial e respeitar os limites de geometria.

A resposta `status: rupture-only` permite apresentar **somente a projeção da ruptura**, identificada como modelo publicado, tanto no aleatório quanto ao vivo. Não produz bandas MMI, não estima população a partir da falha e não afirma que seu contorno é a área onde pessoas sentiram o tremor. Se também não houver ruptura válida, permanece a estimativa pontual anterior. A geometria real não é ampliada em uma elipse estética.

A projeção participa do enquadramento e da passagem suave epicentro → extensão do modelo, respeitando gestos manuais e a prioridade de eventos novos. A consulta continua a cada minuto enquanto só houver ruptura, para substituí-la por um mapa de intensidade posterior. Mesma versão não reinicia a cena. O rastreador de atualizações aceita tanto a nova grade quanto uma nova ruptura, mantendo a visita curta subordinada a eventos novos. Camadas e pedidos pendentes são limpos na troca de seleção.

No menu, **Teste · ruptura real sem mapa de intensidade** usa a geometria histórica real da Turquia e oculta sua grade apenas para demonstrar a alternativa. O texto do teste informa que o mapa foi ocultado e não diz que o terremoto histórico nunca teve ShakeMap. O cenário **Ruptura alongada fictícia** permanece isolado.

A ampliação desta etapa atende o mapa do site. A rotina de Telegram no Worker conserva sua fonte USGS; nenhuma mensagem externa, segredo novo, chave paga ou gravação em Workers KV é necessária para esta publicação.
