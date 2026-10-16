# Manutenção manual do Worker existente

Workflow `Cloudflare Worker maintenance` (`cloudflare-worker-maintenance.yml`),
somente `workflow_dispatch` em main. `inspect` consulta configurações, cron e
métricas do KV, sem mutações. `deploy` implanta exclusivamente o pacote revisado
`downloads/monitor-global-worker-sem-pesquisas.zip`, validado por SHA-256.

Segredos do repositório: `CLOUDFLARE_API_TOKEN` e `CLOUDFLARE_ACCOUNT_ID`.
O token usa Workers Scripts Edit, Account Settings Read e Account Analytics Read,
escopado à conta. Não há listagem/leitura de valores KV, exclusões ou envios de
mensagens para testes. O token só existe no ambiente do passo de manutenção.
O GitHub concede apenas leitura de conteúdo ao workflow.

Antes do upload, exige bindings de armazenamento compatíveis e uma única versão
ativa a 100%. Mantém a data/flags de compatibilidade e opções existentes de
limites, observabilidade, placement e tail consumers. `keep_bindings` preserva
todos os tipos de bindings já existentes, incluindo segredos e variáveis.
Não envia migrações nem muda cron, rotas, domínios, preços ou recursos.
Após o upload, compara bindings e cron e consulta `/health` até encontrar
`electionPolls: removed-no-kv-v1`. Histórico de versões Cloudflare permanece
para reversão. Falhas de confirmação são reportadas como implantação não
verificada, sem reenvios cegos.

O relatório omite token, ID de conta, valores de variáveis e configurações brutas.
Exibe nomes/tipos de bindings, cron e consumo agregado por data UTC, operação e
namespace. Analytics pode ter atraso/amostragem e não é fatura nem contador
instantâneo. Falha ou falta de conta não é convertida em consumo zero.

Referências: https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
e https://developers.cloudflare.com/kv/observability/metrics-analytics/.
