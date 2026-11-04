# Notificações Android por Firebase Cloud Messaging

O código usa Firebase Cloud Messaging (FCM), com inscrição opcional no tópico público `monitor_global_alerts_v1`. Não usa serviço permanente, sobreposição ou consulta contínua no celular. O Android pode atrasar ou impedir a entrega (sem internet, restrições ou parada forçada); não é um sistema de aviso de emergência com entrega garantida.

## O que falta para ativar

1. Criar um projeto no console Firebase e cadastrar um aplicativo Android de pacote `top.monitorglobal.mobile.dev`. Para o futuro APK oficial, cadastrar também `top.monitorglobal.mobile`.
2. Baixar o `google-services.json` do aplicativo Android. Esse arquivo é a configuração pública do cliente; salvar seu conteúdo como `android-mobile/app/firebase-client.json`. Não usar um JSON de conta de serviço nesse caminho. A build seleciona a configuração correspondente ao pacote; sem configuração, a tela Avisos informa a pendência e desabilita a ativação.
3. Ativar a API Firebase Cloud Messaging HTTP v1. Criar uma conta de serviço com a permissão mínima necessária para enviar mensagens FCM no mesmo projeto. Sua chave privada fica exclusivamente no Secret `FIREBASE_SERVICE_ACCOUNT` do Worker de envio. Nunca anexar a chave à conversa, ao repositório ou ao APK.
4. Publicar o Worker separado com `wrangler deploy --config wrangler-mobile-push.toml`, cadastrar o Secret por `wrangler secret put FIREBASE_SERVICE_ACCOUNT --config wrangler-mobile-push.toml` e confirmar o cron. Ele não modifica o Worker/Telegram existentes. Sem Secret, o cron não consulta nem envia nada.
5. Compilar o APK configurado, instalar, abrir Avisos e ativar notificações; no Android 13+, autorizar a permissão do sistema. Confirmar inscrição e enviar um aviso controlado antes de disponibilizar como funcional. Esta implementação ainda não foi validada com uma conta Firebase real.

## Regras

O remetente consulta uma vez por minuto o feed público existente; isso adiciona consultas e uso de um Durable Object. Reutiliza a elegibilidade do feed: M6+ globais, Brasil e boletins elegíveis de tsunami, incluindo encerramentos de um boletim acompanhado. Na primeira execução, registra uma linha de base para não disparar o histórico antigo. Deduplicação persiste no remetente e no aparelho; versões sem mudança material não alertam de novo. Cada rodada envia no máximo três mensagens e mensagens expiram após 180 segundos no FCM. Isso não transforma o prazo do cron em garantia de entrega.

Antes da ativação, verificar cotas do Cloudflare e a configuração de preços do Firebase. Não habilitar um plano pago para concluir o passo a passo automaticamente.

## Testes

`node --test tests/unit/mobile-push.test.mjs`

A CI Android compila o serviço e verifica o APK. A confirmação ponta a ponta depende do projeto Firebase, do Worker configurado e de um aparelho real.

## Publicação e confirmação

O workflow `Validate and deploy mobile push sender` valida o Secret GitHub `FIREBASE_SERVICE_ACCOUNT` no mesmo projeto da configuração Android com `validate_only=true` (nenhuma notificação real), publica o Worker isolado e transfere a credencial para o Secret do Worker. Usa os Secrets Cloudflare já existentes. Não registra a chave nos logs.

A versão 0.1.2 oferece um teste local identificado como fictício, que não confirma o recebimento pelo Firebase. Na prévia debug, é possível copiar o código do aparelho para um teste direcionado no console Firebase. Esse token identifica o destinatário: não publicar em issues, logs ou workflow inputs públicos. A confirmação final exige receber um teste no aparelho com o aplicativo fora de primeiro plano.
