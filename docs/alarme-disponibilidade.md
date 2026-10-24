# Alarme de disponibilidade da página inicial

O workflow **Homepage availability** tenta acessar `https://monitorglobal.top/` a cada 15 minutos (minutos 7, 22, 37 e 52 de cada hora UTC). O GitHub pode atrasar ou suspender agendamentos; não é um serviço de emergência nem uma garantia de aviso em 15 minutos. Em repositórios públicos inativos, workflows agendados podem ser desabilitados após 60 dias sem atividade.

## O que verifica

Exige HTTP 200, conteúdo HTML e marcas da página do Monitor Global. Uma falha precisa persistir em três tentativas, separadas por cinco segundos, com timeout de 15 segundos por tentativa. Não abre navegador, consulta feeds de eventos, gera imagens ou invoca Durable Objects. Isso verifica disponibilidade da página inicial, não integridade de todos os arquivos, atualização dos dados ou funcionamento de cada provedor.

O estado de notificação fica em um artifact do próprio workflow, por 30 dias. Um aviso é enviado na queda confirmada e outro na recuperação após uma queda notificada. Enquanto continuar fora do ar, não se envia novo aviso em toda execução. Se o Telegram falhar, a entrega é tentada novamente na execução seguinte. Como em qualquer envio externo, uma resposta perdida após o Telegram aceitar a mensagem pode causar repetição; não há garantia de entrega exatamente uma vez. Se nenhum histórico for retornado pelo GitHub (por exemplo, após apagá-lo), o monitor inicia uma nova janela e poderá repetir o aviso de uma queda ainda em andamento. Artifacts retornados mas expirados ou inválidos não são usados.

Uma falha ao recuperar o estado interrompe a checagem para não redefinir silenciosamente a deduplicação. A queda e erros de entrega deixam a execução vermelha e preservam o estado quando possível.

## Configurar um destino privado no Telegram

O código não reaproveita nem revela os Secrets do Worker. Sem os dois Secrets abaixo, a checagem roda e registra o resultado, mas **não envia Telegram**.

1. Use um bot seu e um chat privado seu para os avisos. Pode usar o mesmo bot que você já administra, mas escolha um destino privado para não publicar problemas operacionais no canal de eventos. Inicie a conversa com o bot; ele precisa ter permissão para enviar ao destino.
2. No repositório, abra **Settings → Secrets and variables → Actions → New repository secret**.
3. Crie `UPTIME_TELEGRAM_BOT_TOKEN` com o token do bot.
4. Crie `UPTIME_TELEGRAM_CHAT_ID` com o identificador numérico do chat privado. Ele não é o nome de usuário. Se você ainda não sabe o identificador, peça orientação para obtê-lo; não envie seu token na conversa nem use sites desconhecidos para descobri-lo.
5. Abra **Actions → Homepage availability**. As execuções mostram se o Telegram está configurado. **Run workflow** oferece `configuration_only`, marcado por padrão: verifica somente se os dois Secrets existem, sem consultar o site nem enviar mensagens. Presença não comprova validade do token, destino ou entrega. Desmarcar essa opção faz a checagem real e pode enviar aviso se detectar uma queda.

Não é necessário criar um novo Secret da Cloudflare ou dar permissão de escrita ao repositório. O `GITHUB_TOKEN` automático recebe apenas leitura de conteúdo e Actions; o upload de artifacts usa o mecanismo normal do Actions.

## Custo e limitações

São aproximadamente 96 execuções por dia: normalmente uma consulta à página por execução, além de operações do GitHub para recuperar/preservar o estado. Em falha, até três consultas. Cada job instala o ambiente e usa tempo do Actions; disponibilidade e cobrança dependem do plano e da visibilidade do repositório. Não é custo zero garantido. Não altera o consumo do Durable por consultar suas rotas.

O monitor depende do GitHub e do Telegram. Se um deles também falhar, o aviso pode atrasar ou não chegar. Não coloque `/status` como “tudo normal” com base apenas nesta checagem.

## Testes

`python -m unittest discover -s tests/unit -p test_uptime_monitor.py`

Os testes substituem HTTP e envio ao Telegram por simulações: não provocam queda nem enviam mensagens reais.

## Situação da revisão de 24/10/2026

O agendamento segue ativo; a execução [40134786739](https://github.com/helbermoura2/Monitor-Global/actions/runs/40134786739) terminou com sucesso. Isso não confirma entrega ao Telegram. A integração recebeu HTTP 403 ao listar Secrets; o novo modo de configuração permite verificar a presença pelo próprio Actions sem revelar valores ou enviar mensagens. Se ausentes, o dono deve cadastrá-los em **repository secrets**, conforme acima; Secrets do ambiente Android não são herdados por este job.
