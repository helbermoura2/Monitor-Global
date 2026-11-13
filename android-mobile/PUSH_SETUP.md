# Notificações Android por Firebase Cloud Messaging

O aplicativo solicita permissão ao Android e inscreve apenas quem ativou os avisos. O Firebase recebe a mensagem com o aplicativo fora de primeiro plano; não é necessário manter a tela aberta. Internet, permissões, restrições de bateria e parada forçada ainda podem atrasar ou impedir o recebimento.

## Categorias

- Sismos e tsunami continuam no tópico compatível `monitor_global_alerts_v1`; o aparelho aplica a escolha individual de cada categoria.
- Chuva: `monitor_global_rain_v1`.
- Boletins horários: `monitor_global_weather_v1`.
- Resumo diário: `monitor_global_daily_v1`.

Quem já ativou notificações mantém essa escolha e recebe inscrição nas novas categorias ao abrir a versão atualizada. Cada uma pode ser desligada em Avisos. Quem nunca ativou permanece sem inscrição. Nenhum token individual de aparelho é publicado ou armazenado no repositório.

Chuva e tempo são previsões para o ponto fixo da Liberdade, São Paulo, conforme descrito na tela. Chuva usa as séries válidas por minuto para chegada, intensidade, volume, duração e término estimados; consulta no máximo a cada cinco minutos, mudanças com intervalo mínimo de dez minutos e lembrete após uma hora de previsão ativa. A mudança para previsão sem chuva não afirma que uma medição local ficou seca. Boletim horário é enviado nos primeiros quinze minutos de cada hora, exceto à meia-noite. Resumo do dia anterior é enviado após 00:05 e antes de 00:30 BRT, conforme disponibilidade dos catálogos.

O remetente separado reutiliza rotas protegidas, caches e cotas existentes. Nenhuma credencial Firebase vai para o APK, além da configuração pública do cliente em `firebase-client.json`. O Secret de conta de serviço fica no Worker e no GitHub Actions. O cron executa uma vez por minuto, com deduplicação persistente e mensagens com expiração; dados ausentes, inválidos ou vencidos não viram zeros ou condições inventadas. A linha de base inicial de sismos evita anunciar o histórico antigo.

## Configuração e publicação

1. Configuração pública Android de pacote `top.monitorglobal.mobile.dev` em `android-mobile/app/firebase-client.json`; cadastrar o pacote de produção separadamente quando necessário.
2. API Firebase Cloud Messaging HTTP v1 e Secret GitHub `FIREBASE_SERVICE_ACCOUNT` da conta de serviço do mesmo projeto, com permissão para enviar mensagens. Nunca anexar chave privada à conversa, repositório ou APK.
3. Workflow `Validate and deploy mobile push sender` valida OAuth e permissão com `validate_only=true`, sem enviar uma notificação real, publica o Worker isolado e transfere a credencial para o Secret do Worker. Usa os Secrets Cloudflare existentes e a configuração `wrangler-mobile-push.toml`.
4. Publicação Android pelo workflow de prévia, preservando identidade e assinatura.
5. Abrir Avisos, ativar notificações, permitir no Android e confirmar inscrição. Um teste local verifica somente a apresentação no aparelho; a confirmação de entrega por FCM exige um teste direcionado ou recebimento de um aviso real com o app em segundo plano. Não publicar o código/token de teste do aparelho em logs ou issues.

## Verificação

`node --test tests/unit/mobile-push.test.mjs tests/unit/mobile-notices.test.mjs`

Os testes Android cobrem protocolo das mensagens, navegação ao toque e escolhas independentes sem ativação automática para quem nunca consentiu. A CI verifica compilação, lint e assinatura; a validação do servidor não substitui a confirmação de recebimento em um aparelho real.
