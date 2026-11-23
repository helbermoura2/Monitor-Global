# Argos Orbis — ponte experimental celular → TV (reversao completa)

## O que faz
O Argos Orbis de teste no Nothing Phone 1 e no Samsung S25 Ultra tenta ler alertas Severo/Extremo do Cell Broadcast pela interface do Android, com permissao Acessibilidade ou Acesso a notificacoes. Se e somente se detectar mensagem do sistema, o aplicativo faz POST autenticado ao Cloudflare Worker. A TV consultara o Worker a cada 20 segundos enquanto o monitoramento da TV estiver ligado. O alerta na tarja sera identificado como 'CAPTURADO NO CELULAR', NAO como CAP independente. O teste manual aparece como SIMULACAO, nunca como alerta real.

## Requisitos
- TV: monitoramento e permissao para desenhar sobre outros aplicativos ativados.
- Na TV, tocar 'Gerar codigo de 8 digitos para o Argos Orbis do celular'.
- Em cada aparelho, em Mais → Informacoes tecnicas → Teste de alertas Severos/Extremos, tocar Vincular a TV, informar o codigo e ativar 'Envio automatico para TV'. Gerar outro codigo na TV para o segundo telefone.
- Testar 'Enviar TESTE para a TV pelo Worker' e voltar ao video na TV. A tarja de simulacao deve surgir em ate 5 minutos, habitualmente em poucos segundos se a TV estiver ligada e com internet.
- Para comprovar a captura REAL, aguardar novo alerta Cell Broadcast. Simulacao confirma apenas o transporte.

## Privacidade e seguranca
- Sem SMS 40199, root ou permissao privilegiada. A deteccao depende de o Android expor o texto em Acessibilidade/Notificacoes.
- Sem segredo fixo no APK. Codigo temporario de 8 digitos, valido por 10 minutos e de uso unico. TV e telefones recebem tokens privados aleatorios de 256 bits.
- Worker guarda ultimos avisos por no maximo 5 minutos. As rotas exigem token. A TV filtra novamente nivel/origem e impede apresentacao duplicada.
- Mensagem que vem do celular e detectada pelo aplicativo nao tem autenticidade criptografica da Defesa Civil. A tarja informa 'CELULAR' e 'nao confirmado via CAP'.
- Historico de emergencia aberto manualmente nas Configuracoes do Android NUNCA e encaminhado como evento novo. A opcao de envio vem desativada por padrao.
- Nenhum aviso e injetado nos feeds CAP oficiais. O relay nao altera a assinatura dos apps nem o fluxo de sismos, Brent, meteorologia, Alexa ou Telegram.

## Arquivos a reverter (isolados do restante)
Backend:
- worker/civil-phone-relay.mjs (deletar)
- monitor-global-worker-7_7_0.js (remover import handleCivilPhoneRelay e as duas rotas /civil-relay/v1/)
- tests/unit/civil-phone-relay.test.mjs (deletar)
- tools/test-worker-services.mjs (retirar apenas o nome do novo teste)
- .github/workflows/android-mobile-preview.yml (retirar apenas o novo teste do comando node --test)
Celular (apenas variante debug):
- android-mobile/app/src/debug/java/top/monitorglobal/tv/PhoneCivilRelay.java (deletar)
- android-mobile/app/src/debug/java/top/monitorglobal/tv/AlertProbeDiagnostics.java (remover envio automatico na funcao found(), a secao CONEXAO COM A TV, botoes de vinculo, teste e desvinculo; se quiser remover TAMBEM o detector, consultar CELL_BROADCAST_PROBE_ROLLBACK.md)
- android-mobile/PREVIEW_RELEASE.md (retirar nota da ponte experimental)
TV:
- android-tv/app/src/main/java/top/monitorglobal/tv/TvCivilPhoneRelay.java (deletar)
- android-tv/app/src/main/java/top/monitorglobal/tv/MonitorService.java (remover civilPhoneExecutor, pollPhoneCivil, showPhoneCivilEvents, agendamento e shutdown do novo executor)
- android-tv/app/src/main/java/top/monitorglobal/tv/MainActivity.java (remover secao DEFESA CIVIL · VINCULAR CELULARES)
- android-tv/app/src/main/java/top/monitorglobal/tv/Banner.java (remover showCivilPhone)
- android-tv/app/src/main/java/top/monitorglobal/tv/TvBroadcastInfoView.java (remover campo civilFromPhone, factory civilPhone e recuperar textos originais das abas)

## Desativar sem atualizar nenhum APK
1. No celular, abrir tela do detector e tocar 'Desativar envio automatico para TV'. Se quiser, 'Desvincular esta TV e apagar credencial'.
2. Na TV, tocar 'Desvincular o receptor desta TV'. A TV deixa de consultar os avisos encaminhados.
3. Se necessario, revogar Acessibilidade e Acesso as notificacoes do Argos Orbis no Android. Os boletins oficiais CAP e os demais recursos permanecem.

## Versionamento
TV 1.0.137, codigo 10137; celular TESTE 0.1.58, codigo 59. Ao reverter, NUNCA diminuir versionCode. Lancar uma nova versao maior para manter a atualizacao sobre a instalada.

## Critérios de aceite
- Teste manual do celular aparece na TV rotulado SIMULACAO · CELULAR e sem som/alarme de emergencia.
- Evento capturado de pacote de Cell Broadcast do sistema aparece na TV rotulado DEFESA CIVIL · CELULAR, sem constar como CAP confirmado.
- Duas mensagens com textos diferentes aparecem separadamente; uma mesma mensagem em dois celulares nao gera tarjas repetidas.
- Nao existe afirmacao de 5 minutos garantidos antes da validacao em um alerta Cell Broadcast REAL.
