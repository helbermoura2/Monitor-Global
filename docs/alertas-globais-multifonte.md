# Alertas globais por USGS, EMSC e GEOFON

Atualização de 28/10/2026. TV/Fire Stick **1.0.23** e Telegram passam a admitir sismos globais M6+ informados por USGS, EMSC ou GEOFON. O Brasil continua sem magnitude mínima, usando USP/RSBR, USGS, EMSC e GEOFON. Tsunami continua dependendo dos boletins oficiais, nunca apenas da magnitude.

## Seleção e identificação

- Um registro pode entrar por uma agência acima de M6 mesmo que outra informe magnitude menor. Exemplo de validação: GEOFON 6,09 (apresentado como M6,1) e USGS 5,6.
- Entre soluções qualificadas, a preferência é estável: USGS sísmico, GEOFON e EMSC. Não se escolhe simplesmente a maior magnitude. Dentro do USGS, a solução sísmica continua tendo prioridade sobre a estimativa rápida de centro de tsunami, inclusive quando a revisão cai abaixo de M6.
- O corte usa o valor original publicado, antes do arredondamento visual. Os números originais são preservados; a apresentação usa uma casa decimal. Alterações dentro da mesma casa decimal não criam outro aviso de magnitude por arredondamento.
- Associação exige redes distintas, origem com diferença de até 30 segundos, distância até 50 km e diferença de magnitude até 1,0. No Brasil permanecem 20 km e 0,6. Correspondência ambígua não é unida por adivinhação; dois sismos próximos da mesma rede permanecem distintos.
- Uma nova solução da mesma agência é revisão. Uma troca de agência aparece como **nova estimativa de outra fonte**, sem apresentar as duas magnitudes como revisão da mesma agência. Quando a agência não publica o estado de revisão, o texto informa isso, sem inventar que foi revisado ou automático.

No Telegram o cartão original é editado, preservando histórico e reservas contra envios duplicados. O agrupamento de avisos de revisão por pelo menos 30 segundos continua igual. Na TV, o evento mantém identidade canônica entre catálogos e guarda a fonte escolhida, inclusive depois de reiniciar.

## Ativação, replay e resumos

A primeira inicialização das novas fontes não anuncia o catálogo antigo: Telegram prepara uma linha de base para registros com origem há mais de 30 minutos; a TV mantém sua primeira fotografia silenciosa por catálogo. Não há disparo manual de alertas históricos para testar a publicação.

Replay e resumos também consideram M6+ adicionais dessas agências. O resumo de ontem continua sendo o dia completo anterior de Brasília; o parcial de hoje continua separado. Nenhum corte mínimo foi introduzido para o Brasil. As regras de revisão dos eventos acompanhados seguem por até 72 horas; consultas individuais adicionais são limitadas e rotativas.

Na TV é necessário instalar a atualização oficial **1.0.23**, sem desinstalar. Versões anteriores não reconhecem os novos catálogos globais independentes. O Telegram recebe a mudança no serviço, sem novo Secret ou ação no canal.

## Consumo e falhas

O coletor adicional é compartilhado por TV e Telegram, com cache de 60 segundos no processo e no Cache API. O compartilhamento de edge é por ponto de rede, não uma promessa de coleta única mundial. Falhas têm backoff e não renovam o horário da última resposta válida. Não cria Durable Object, serviço pago, cron novo ou gravação KV por consulta. As duas marcas de inicialização do Telegram usam o armazenamento do coordenador Durable existente.

As consultas adicionais têm limite de 100 linhas por catálogo, 512 kB de resposta, prazo de 12 segundos e no máximo três consultas individuais por agência em uma rodada, com rotação quando necessário. A consulta individual tem prazo de oito segundos. Catálogo potencialmente truncado e resposta inválida são indisponibilidade, não catálogo vazio válido.

A watch list da TV continua limitada a 120 eventos, 240 kB para persistência e gravação apenas quando os dados mudam, com intervalo mínimo de um minuto. Os relatórios de cada agência usados na seleção também são limitados. Não se alteraram frequência dos avisos, câmera, dimensões da tarja ou equações científicas.

USGS, EMSC e GEOFON têm estados globais separados dos catálogos brasileiros. Fonte em falha não vira ausência de terremotos nem cancelamento de um aviso. Contexto opcional continua fora da resposta dos alertas oficiais. O efeito na cota deve ser medido no acompanhamento existente; não há percentual de economia prometido.

## Publicação, validação e reversão

Publicar o pacote do Worker com `npm run worker:bundle` e o workflow de manutenção; conferir `/health` com `globalSeismicPolicy: global-usgs-emsc-geofon-v1`. Publicar o APK pelo fluxo oficial assinado. Testes de Telegram usam transporte simulado, sem mensagens reais; a validação publicada usa endpoints de leitura, sem chamar `/telegram-m6-check`.

Cobertura de testes: conflito GEOFON M6,1/USGS M5,6, deduplicação entre agências, revisões próprias, rebaixamento abaixo do corte, fontes em falha, backoff após troca de instância, dados malformados/grandes, catálogo inicial silencioso, persistência Android e mudança de agência sem seta de revisão falsa. Os testes nacionais, de boletins e de revisão USGS anteriores continuam obrigatórios.

Para reverter: reverter o PR, reconstruir e publicar o pacote do Worker. Para Android, publicar o código desejado com versão superior, mantendo a mesma assinatura; não orientar desinstalação ou limpeza de dados.
