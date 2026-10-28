# Operação e recuperação — consulta rápida

Site: https://monitorglobal.top · [Actions do projeto](https://github.com/helbermoura2/Monitor-Global/actions)

## Conferir em dois minutos

1. Abra o site e confira o horário dos sismos. Toque em **Situação das fontes**: uma fonte indisponível não significa que todas falharam.
2. Em **Actions → Monitor Cloudflare Free quotas → última execução → Summary**, leia **Saúde do Monitor Global — leitura rápida**. O resumo mostra a data medida, percentuais Free, maior consumidor Durable e últimas automações observadas. Não confunda o dia parcial com o completo. “Não medido” não é zero.
3. Na TV, confira a versão e o estado de conexão. Um teste/replay confirma a exibição, não a chegada de um alerta real. Para memória, exporte **Diagnóstico local → Baixar diagnóstico pelo celular**, mantendo a janela aberta e o celular na mesma rede. Atualize sem desinstalar para preservar dados.

## Publicar a parte correta

| Mudança | O que acompanhar |
| --- | --- |
| Texto, CSS e JS do site | Depois do merge, aguarde **pages build and deployment** e a publicação do hosting. Recarregue a página. |
| Módulo `.mjs` ou código do Worker | Refaça o pacote com `npm run worker:bundle`, incluindo o ZIP e o checksum gerados no commit. Na publicação integrada, confirme que o build usa esse empacotamento; no caminho manual use **Actions → Cloudflare Worker maintenance → Run workflow → main → deploy**. Depois confirme a versão publicada. Alterar só o `.mjs` não basta. |
| Código Android | Incremente a versão, valide e publique por **Android TV official release → Run workflow → main → publish**. Na TV use **Verificar atualização oficial**. Não troque a chave de assinatura. |

Os testes precisam passar antes da publicação. Publicar um Worker não exige enviar mensagens de teste no Telegram. Detalhes: [manutenção do Worker](cloudflare-worker-maintenance.md) e [Guia do dono](../GUIA_DO_DONO.md).

## Se algo quebrar

- **Depois de uma alteração:** GitHub → **Pull requests → Closed → PR responsável → Revert**. Confira e integre a reversão, aguarde a publicação. Para Worker, gere/publique o pacote revertido; para Android, publique o código corrigido com uma versão superior. Não desinstale o app nem limpe seus dados para tentar reverter.
- **Só população, mapa de contexto ou clima falhou:** confira a fonte e o erro; preserve sismos e boletins. “Indisponível” nunca vira população zero nem “sem ameaça”. Não reduza alertas oficiais para economizar consultas.
- **Action vermelha:** abra a etapa com erro e guarde o link da execução. Pode ser falha na coleta ou publicação; não conclua que o site caiu só pela cor.
- **Cota em atenção:** confira o dia, o recurso e o maior consumidor. Continue no Free; priorize cache/reuso do dado repetido. Não ative serviço pago, não aumente frequência e não use KV para registrar cada clique.

## Não mexer para resolver uma emergência

Não apague o repositório, não faça force push, não troque Secrets/assinatura sem diagnóstico e nunca cole tokens em código, conversas ou prints. Reverter código não desfaz mensagens enviadas, migrações ou configurações externas.

Para cada mudança de IA: registrar **o que mudou, impacto nas cotas, validação e como reverter**. Restrições permanentes: câmera aprovada preservada; estimativas identificadas; aviso oficial independente de população e efeitos; ausência de informação não significa segurança.
