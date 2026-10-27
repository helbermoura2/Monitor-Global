# Prioridades pendentes

Atualização: 27/10/2026. Pedido do dono: trabalhar primeiro nas três pendências abaixo e guardar os quatro próximos itens para depois. Esta fila registra o trabalho; não declara problemas resolvidos sem evidência.

## Agora: cotas, CPU e filtros de build

| Pendência | Situação verificada | O que falta para concluir |
|---|---|---|
| Medir a economia após a atualização de população | Publicada em 27/10 às 10h59 UTC. Monitor Free já executa quatro vezes ao dia. Nova leitura em 27/10 às 11h06 UTC: último dia completo ainda é 26/10. | Comparar dias completos após publicação com o baseline, considerando usuários/eventos. Primeiro dia integral: **28/10 UTC**, disponível no relatório agendado de **29/10 às 00h45 UTC (28/10 às 21h45 de Brasília)**. Depende da execução e da disponibilidade dos dados da Cloudflare. |
| Investigar os quatro excessos de recursos | Agregado de 27/10 continua com os mesmos quatro registros. Nova captura de 121 segundos teve dez chamadas, todas `ok`, sem tráfego sintético; sessão removida. | Identificar uma rota com excesso e sua causa antes de corrigir código. A captura não reproduziu a falha; não comprova que a CPU foi corrigida. |
| Evitar builds desnecessários do backend | Nova tentativa real retornou **HTTP 403** ao ler o trigger. `applied: false`; filtro preparado, não aplicado. O site/APKs continuam publicando normalmente. | Autorizar a API de Builds no token e executar a política já revisada. Nenhuma mudança de plano é necessária. |

Baseline de 26/10 UTC: **38.524 chamadas Worker**, **2.295 Durable**, das quais **1.338 de população**. Parcial de 27/10 às 11h06 UTC: **15.016 Worker**, **941 Durable**, **410 de população**. Estes parciais misturam versões e não demonstram economia causada pela última publicação.

Para concluir o filtro, o dono pode cadastrar em **GitHub → repositório → Settings → Secrets and variables → Actions → New repository secret** o nome `CLOUDFLARE_BUILDS_API_TOKEN`, com token desta conta autorizado a **Workers CI Read/Write** e leitura dos metadados do Worker. Manter o token existente de implantação. Não colocar valores de tokens em chat ou no código. Depois: **Actions → Cloudflare quota reduction operations → Run workflow → main → apply_build_filters=true**. O procedimento lê a configuração antes e altera só os filtros de arquivos do backend, preservando a hospedagem estática.

Evidência desta verificação: [relatório sanitizado](audits/prioridades-acompanhamento-20261027.json). Execuções: [cotas](https://github.com/helbermoura2/Monitor-Global/actions/runs/40493552678) e [CPU/filtros](https://github.com/helbermoura2/Monitor-Global/actions/runs/40493556603). A segunda execução termina com falha por causa do 403 dos filtros; a captura de CPU em si terminou e removeu sua sessão.

## Depois: os quatro itens reservados

Ainda não iniciados nesta etapa. Antes de implementar cada item, conferir o que o projeto já oferece e corrigir somente as lacunas.

1. [ ] **Clareza das informações** — revisar site, imagens do Telegram e TV para distinguir dado oficial, magnitude, intensidade local e estimativas, preservando o visual aprovado.
2. [ ] **Guia curto de operação e recuperação** — aproveitar Guia do dono, instruções de publicação e reversão existentes para uma referência curta, sem refazer a documentação inteira.
3. [ ] **Isolamento de falhas** — conferir que população, clima e outros serviços opcionais possam falhar sem impedir a apresentação dos dados e avisos oficiais.
4. [ ] **Resumo legível da saúde do sistema** — aproveitar os relatórios existentes para apresentar a saúde e as cotas em português simples. Destino e frequência serão definidos nessa etapa; não instalar um novo serviço nem enviar mensagens agora.

Continuar no plano Free. Não mudar câmera, frequência de alertas ou regras do Telegram para economizar consultas. A implementação desses quatro itens fica para depois das pendências atuais, conforme solicitado pelo dono.
