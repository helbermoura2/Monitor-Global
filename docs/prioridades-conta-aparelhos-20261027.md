# Memória dos aparelhos, acesso e consumo · 27/10/2026

## Memória e fluidez: coleta real preparada

A versão TV 1.0.19 acrescenta **Diagnóstico local · memória e desenho da tarja**. Com o serviço ativo, mede o próprio processo em segundo plano uma vez por minuto: PSS, memória Java em uso/comprometida/limite, alocações nativas e a rubrica gráfica quando disponível. Registra intervalos entre desenhos da tarja e duração da gravação de desenho; isso não equivale a FPS ou à medição completa da GPU.

Guarda até 360 leituras (aproximadamente seis horas recentes), além de contagem, memória inicial e pico do processo. O arquivo tem limite de 256 KiB. Outra execução do processo inicia uma série separada, preservando apenas um resumo da execução anterior. Os dados ficam no aparelho, sem sismos, coordenadas, IP, credenciais ou identificadores persistentes. Nenhum dado é enviado automaticamente. Há opções de salvar JSON e compartilhar pelo seletor do Android, conforme os aplicativos disponíveis na TV.

Para obter dados reais sem um ensaio artificial de várias horas, atualizar o aplicativo, ativar o monitoramento e usar normalmente. Depois, abrir o diagnóstico e exportar o relatório. Não foi medida a RAM da TCL/Fire Stick desta sessão: `adb devices` não tem aparelhos conectados e não há VPN configurada. Os testes em computador não substituem essa medição.

## GitHub: estado confirmado pela API

- Repositório público; único colaborador retornado: `helbermoura2`, administrador. Isso não enumera aplicativos instalados nem tokens pessoais da conta.
- Ruleset ativo **Proteção da main**, ID 25626127, aplicado à branch padrão. Bloqueia exclusão e reescrita forçada. Não tem exceções de bypass. **Não exige PR nem aprovação obrigatória**, conforme as regras retornadas.
- Ambiente `android-tv-release` permite apenas a branch `main`. A API retornou somente a regra de branch, sem revisores obrigatórios; `can_admins_bypass=true` é uma configuração do ambiente, distinta do ruleset.
- O fluxo de publicação oficial é manual, exige repositório correto, `main` e ator `helbermoura2`; usa o ambiente de assinatura, confere identidade e se `main` continua no commit revisado. O APK mantém o instalador com confirmação do dono e o certificado fixado. Uma IA opera pela autorização da conta conectada, não por uma permissão autônoma chamada “IA”.
- `CODEOWNERS` direciona revisão ao dono. Sozinho, não impede alterações; sua imposição depende das regras do GitHub.
- A consulta da proteção legada da branch e das permissões padrão do GitHub Actions retornou **403 Resource not accessible by integration**. Não foi afirmado que essas configurações estão desligadas.

Não foi acrescentada aprovação obrigatória à `main`: os fluxos de dados e o publicador assinado fazem commits diretos. Alterar essa regra sem adaptar esses fluxos interromperia operações. As proteções existentes foram verificadas e preservadas; a configuração administrativa indisponível ainda precisa de acesso apropriado. Não foram modificados colaboradores, tokens, planos ou destinatários.

## Consumo confirmado até esta revisão

Auditorias somente de leitura: Durable [40460823583](https://github.com/helbermoura2/Monitor-Global/actions/runs/40460823583) e KV [40460826526](https://github.com/helbermoura2/Monitor-Global/actions/runs/40460826526), consultadas às 06:23 UTC. Os artifacts não puderam ser baixados (403); os relatórios foram recuperados dos logs estruturados, sem publicar objetos ou credenciais.

| Dia UTC | Durable solicitações | População | KV leituras | KV escritas |
| --- | ---: | ---: | ---: | ---: |
| 26/10 completo | 2.295 | 1.338 | 47 | 2 |
| 27/10 parcial, até ~06:23 UTC | 747 | 409 | 69 | Não informadas nos grupos retornados |

As métricas são adaptativas e podem atrasar ou ter amostragem. Grupos ausentes não comprovam consumo zero. População representa cerca de 58,3% das solicitações Durable de 26/10. O número está abaixo da meta interna de 35 mil/dia; isso não confirma a franquia contratada nem uma cobrança.

O novo fluxo **Audit Cloudflare account consumption and alert options** consulta agregados de Workers, Durable, KV e Workers AI quando expostos pela conta, assinaturas, tipos de notificação, elegibilidade dos destinos e políticas existentes. O transporte recusa mutações; os relatórios excluem emails, URLs de webhooks e identidade de faturamento. Consultas negadas aparecem como indisponíveis, nunca como zero. Não altera planos ou políticas e não dispara mensagens.

O inventário [custos e cotas](custos-e-cotas.md) continua sendo a referência operacional. A [consulta consolidada 40462939462](https://github.com/helbermoura2/Monitor-Global/actions/runs/40462939462) foi executada: os agregados de Workers, Durable/SQLite, KV e Workers AI estão no inventário atualizado e no [JSON sanitizado](audits/cloudflare-account-20261027.json). A API lista alertas de orçamento/uso e email elegível, mas retornou zero políticas. A leitura de assinaturas retornou 403. Não há confirmação de plano/fatura nem alerta financeiro ativado. Faltam limite em USD e destinatário para uma eventual criação no painel, confirmada a elegibilidade. O [estado de acesso ao GitHub](audits/github-access-20261027.json) também foi registrado.
