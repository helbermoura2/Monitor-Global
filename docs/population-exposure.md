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

O estado fica no **Durable Object**, com reutilização no Worker e no cache da borda. Não há gravação de população no KV nem no feed público. A chave continua incluindo coordenadas, magnitude, profundidade, identificador USGS e horário: mudar esses parâmetros separa o resultado anterior.

| Resultado | Durable | Navegador / validade compartilhada |
|---|---|---|
| WorldPop, sismo com menos de 12 horas | 24 horas | até 24 horas |
| WorldPop, sismo com 12 horas ou mais | 7 dias | até 7 dias |
| PAGER, recente ou antigo | 5 minutos | até 5 minutos |
| WorldPop com identificador USGS, aguardando eventual PAGER | conserva o cálculo WorldPop | verifica possibilidade de PAGER a cada 5 minutos |
| `unsupported` / `unavailable` terminal | 15 minutos | 5 minutos no cache da página; a borda pode reutilizar o negativo até 15 minutos |
| `pending` | tarefas existentes, prazo limitado | consulta a cada 10 segundos |

**Exceção deliberada à proposta de cache longo para todo sismo antigo:** idade não comprova que o PAGER deixou de receber revisões. Seus resultados continuam revalidados em cinco minutos. Um WorldPop já calculado permanece guardado enquanto se procura o PAGER; não se refazem as três consultas de grade por causa dessa procura. Prazo longo vale para o reaproveitamento do modelo WorldPop com os mesmos parâmetros, não é uma declaração de que o sismo está oficialmente encerrado.

Resultados carregados antes desta alteração mantêm seu vencimento original; a leitura não renova o prazo. O servidor informa o vencimento absoluto em `X-Monitor-Population-Cache-Until`. As abas usam BroadcastChannel para compartilhar resultados e, quando disponíveis, Web Locks e Cache Storage para juntar consultas simultâneas. O cache em disco de população é separado do das outras fontes e limitado a oito respostas de até 512 KiB; os caches da página têm no máximo 80 positivos e 80 negativos. Navegadores sem essas APIs mantêm a consulta comum e a coordenação do servidor.

Somente o evento selecionado consulta pelo cartão. Exportar uma imagem também pode pedir o resultado daquele evento. Troca de evento, revisão de magnitude/profundidade e página oculta cancelam o trabalho anterior; ocultar a página fecha o canal entre abas. Falha nunca vira população zero e a reserva de localidades continua visível. Nenhuma frequência de sismo, tsunami, Telegram ou movimento de câmera é alterada.

### Publicação

**A — arquivos do site:** no GitHub, abrir o pull request, conferir os testes e usar **Merge pull request**. `index.html` já aponta para novas versões dos dois arquivos JavaScript. A hospedagem publica esses arquivos; quem estiver com uma aba antiga aberta precisa recarregar a página.

**B — Worker:** o arquivo `.mjs` sozinho não publica o servidor. O ZIP revisado deve ser reconstruído com `npm run worker:bundle` (já incluído neste diff, com seu checksum atualizado). Depois do merge: **GitHub → Actions → Cloudflare Worker maintenance → Run workflow → branch main → mode deploy → Run workflow**. Esperar o resultado verde. A rotina usa os Secrets existentes e preserva vínculos e agendamentos. Não é preciso editar código no painel Cloudflare. Ver [guia de manutenção](cloudflare-worker-maintenance.md) para publicação manual de reserva.

### Checklist de teste

- [ ] Sismo antigo com WorldPop disponível: refocar e abrir a imagem reutilizam o resultado, sem novo POST WorldPop.
- [ ] Segunda aba reutiliza a mesma resposta; duas consultas simultâneas são reunidas quando Web Locks/Cache Storage estão disponíveis.
- [ ] Mudar magnitude ou profundidade usa outra chave e permite novo cálculo.
- [ ] PAGER continua podendo atualizar em cinco minutos, inclusive em sismos antigos; WorldPop com identificador USGS ainda pode ser substituído por PAGER.
- [ ] Resultado indisponível não mostra zero e mantém localidades como reserva.
- [ ] Ocultar a aba ou trocar de evento cancela o polling anterior.

Testes sem chamadas reais: `node --test tests/unit/population-reuse.test.mjs tests/unit/browser-request-budget.test.cjs tests/unit/cross-tab-public-requests.test.cjs`; `node tests/unit/population-exposure-check.mjs`; `npx playwright test tests/population-reuse.spec.js tests/browser-request-budget.spec.js`. A economia será conferida nos dias completos do monitor de cotas Free, sem promessa percentual antecipada.
