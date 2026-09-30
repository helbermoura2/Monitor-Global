# População em área de tremor

O cartão mantém a população por localidades como reserva. A integração em grade é uma consulta do Worker ao serviço de estatísticas WorldPop, e o produto USGS PAGER tem preferência quando o registro consolidado contém um identificador USGS compatível.

## Fontes e método

- WorldPop: dataset `wpgppop`, ano **2020**, API `https://api.worldpop.org/v1/services/stats`. Soma de população em grade nos polígonos, incluindo moradores rurais. CC BY 4.0; atribuição no cartão.
- Protocolo validado no cliente oficial `wpgp/wpCPR`: POST JSON com `dataset`, `year`, `geojson` e `runasync`; consulta posterior a `/v1/tasks/{taskid}`; resultado `data.total_population`. Chave opcional `WORLDPOP_API_KEY`, somente no Worker.
- Intensidade do app: equação hipocentral publicada por Allen, Wald e Worden (2012), *Intensity attenuation in active crustal regions*, Journal of Seismology 16, 409–433, DOI 10.1007/s10950-012-9294-9. Implementação independente da equação matemática; coeficientes conferidos na representação científica em `gem/oq-engine/openquake/hazardlib/gsim/allen_2012_ipe.py`.
- I = 2.085 + 1.428 M − 1.402 ln(sqrt(Rhypo² + rM²)) + 0.078 ln(Rhypo/50) quando Rhypo > 50 km; rM = −0.209 + 2.042 exp(M−5). Distância hipocentral sqrt(distância horizontal² + profundidade²), com piso de profundidade de 1 km para valores positivos. Quando a fonte informa zero, adotam-se **10 km**, com essa suposição indicada no cartão; zero pode representar profundidade desconhecida.
- Faixas cumulativas: **MMI III+**, **V+** e **VI+** (limites contínuos 2,5 / 4,5 / 5,5). Valores se sobrepõem e não devem ser somados.
- O modelo radial é utilizado somente para M3–8,5, profundidade até 70 km e latitude até ±85°. Não modela direção de ruptura, amplificação do solo ou diferenças tectônicas/regionais e não produz intervalo estatístico de confiança. As fontes podem informar escalas diferentes de magnitude. Essas limitações impedem tratar os números como uma avaliação de impacto comprovado.
- Limite de consulta de 500 km; quando a faixa ultrapassa esse limite, a cobertura é indicada como parcial. Os círculos são divididos no antimeridiano.
- USGS PAGER: consulta ao catálogo USGS e ao `contents['pager.xml']` do produto `losspager`, escolhido por prioridade/atualização. Formato conferido no código e testes oficiais de `usgs/earthquake-eventpages`, `src/app/pager/pagerxml.service.*`. A população de exposição já deriva do ShakeMap e do modelo populacional do USGS; não é somada ao WorldPop ou às cidades.

## Operação

Endpoint GET `/population-exposure?lat=…&lng=…&mag=…&depth=…&time=…&eventId=…` (eventId opcional). Somente esse endpoint pode fazer o POST para WorldPop; nenhum proxy de destino arbitrário é acrescentado.

O KV `TTS_USAGE` existente guarda tarefas/resultados com prefixo `exposure-v1:`. Cache local e consultas em andamento evitam repetir consultas no mesmo Worker; o KV é eventualmente consistente, portanto consultas simultâneas de regiões diferentes ainda podem criar tarefas duplicadas. Resultados WorldPop duram 24 horas; resultados PAGER 5 minutos para receber revisões; erros 3 minutos. Sem o binding, há reserva em memória. Nenhum secret é enviado ao navegador.

Tarefas pendentes são consultadas a cada 10 segundos, por tempo limitado. Troca de evento, revisão de magnitude ou profundidade e página oculta cancelam a atualização do cartão anterior. O serviço público WorldPop pode aplicar cotas ou indisponibilidade. Erros nunca são convertidos em população zero; a reserva por localidades permanece visível.

Os contratos foram testados com respostas simuladas e fixtures do formato oficial USGS. **Não houve validação de conectividade real com WorldPop/USGS nesta sessão**, devido ao acesso de rede indisponível no ambiente. Conferir `/population-exposure` após o deploy: `available` com `method=worldpop`/`pager` confirma a consulta; `unavailable` não comprova ausência de população.

Teste: `node tests/unit/population-exposure-check.mjs`. Compatibilidade da reserva: `node tests/unit/population-check.cjs`.
