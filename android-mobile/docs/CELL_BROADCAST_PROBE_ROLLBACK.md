# Atualização do experimento (versão celular 0.1.58)

A etapa opcional de transmissão para a TCL P7K está descrita em CIVIL_PHONE_TV_BRIDGE_ROLLBACK.md. O envio depende de vínculo por código, fica desativado por padrão e não comprova recepção de um Cell Broadcast real.

# Argos Orbis — detector experimental Cell Broadcast (PLANO DE REVERSAO)

## Objetivo
Testar se o Nothing Phone 1 e o Galaxy S25 Ultra permitem ler automaticamente o aviso Severo/Extremo da Defesa Civil por Acessibilidade ou pelas notificacoes de sistema. Nao usa SMS 40199. A meta futura e replicar na TV em ate 5 minutos, mas esta etapa nao envia avisos ao Worker nem a TV.

## Escopo da versao de teste
- Exclusivo da variante Android debug (pacote top.monitorglobal.mobile.dev).
- Desativado por padrao. Usuario ativa na propria tela e autoriza Acessibilidade e/ou Acesso as notificacoes em Configuracoes do Android.
- So examina mensagens de pacotes identificados como Settings, SystemUI e CellBroadcastReceiver; nao usa captura de tela nem pede root.
- Exige simultaneamente as palavras 'Defesa Civil' e 'Alerta severo' ou 'Alerta extremo'. A simulacao so conta durante uma janela explicitamente autorizada.
- Guarda apenas a ultima mensagem compativel no armazenamento privado do aplicativo; nada e transmitido para a rede.
- Simulacao e leitura do historico NAO comprovam que o app consegue capturar avisos novos em tempo real.

## Arquivos para remover se nao funcionar
1. android-mobile/app/src/debug/java/top/monitorglobal/tv/AlertProbeDiagnostics.java
2. android-mobile/app/src/debug/AndroidManifest.xml
3. android-mobile/app/src/debug/res/xml/argos_probe_accessibility.xml
4. android-mobile/app/src/debug/res/values/strings.xml
5. Apagar o botao 'Teste de alertas Severos/Extremos no Android' da advancedPage em android-mobile/app/src/main/java/top/monitorglobal/tv/PhoneActivity.java.
6. Retirar a nota experimental de android-mobile/PREVIEW_RELEASE.md e deste documento.
7. NAO reduzir versionCode em android-mobile/app/build.gradle: atualizacoes Android exigem codigo crescente.

## Como testar
1. Atualizar a PREVIA do Argos Orbis nos dois celulares (nao substituir um APK de outra assinatura).
2. Abrir Mais -> Informacoes tecnicas e atualizacao -> Teste de alertas Severos/Extremos.
3. Ativar o diagnostico e autorizar Acessibilidade e/ou Acesso as notificacoes do Android.
4. Tocar SIMULAR: a tela deve registrar origem SIMULACAO, mas isto nao prova recebimento do Cell Broadcast.
5. Abrir Configuracoes -> Seguranca e emergencia -> Historico de alertas de emergencia; conferir se o texto do alerta de 22/11/2026 apareceu como HISTORICO.
6. No proximo alerta Cell Broadcast REAL, confirmar que o aparelho registrou sozinho o texto e o horario enquanto a janela estava aberta, sem abrir o historico. Confirmar individualmente no Samsung e Nothing.
7. So depois validar o envio autenticado ao Cloudflare Worker e a reproducao na TV ate 5 minutos com deduplicacao e origem indicada.

## Desativacao imediata no aparelho
Desligar o diagnostico na tela, revogar acesso em Configuracoes -> Acessibilidade -> Aplicativos instalados e Configuracoes -> Notificacoes -> Acesso as notificacoes. Os nomes dos menus podem variar.

## Status
Prova de captura Cell Broadcast real: pendente de teste nos aparelhos.
Prova de encaminhamento a TV: nao implementada neste experimento.
Rollback: excluir exatamente os arquivos e a linha de botao listados acima; preservar os demais recursos do Argos Orbis.
