# Argos Orbis TV 1.0.143 — diagnóstico e replay de alertas capturados no celular

## Por que a captura de 23/11/2026 não apareceu no replay
O S25 Ultra registrou novo evento do pacote do sistema
`com.google.android.cellbroadcastreceiver` às 14:57:32 (horário de Brasília).
O app informou que o Worker aceitou o envio. **Isso prova captura e aceitação
pelo Worker, não prova que a TCL P7K fez o polling e desenhou a tarja.**
Até a 1.0.142, os replays da TV consultavam exclusivamente
`CivilReplayStore`, que só guarda CAP oficial de emissor validado. O relay
do celular não era preservado para replay, por projeto.

## O que muda
- Novo `CivilPhoneHistory` separado de `CivilReplayStore`: último evento
  genuíno Sever o e Extremo de cada classe, por até sete dias, só na TV.
- O conteúdo é salvo quando a TV **recebe via polling autenticado do Worker**,
  mesmo quando outro card está momentaneamente em apresentação.
- Simulações nunca entram no histórico. Alertas expostos como capturados no
  celular não viram avisos CAP oficiais nem entram no histórico CAP.
- Dois botões de replay específicos no aplicativo:
  **Replay · último SEVERO recebido do celular** e
  **Replay · último EXTREMO recebido do celular**.
- Replay mostra **REPLAY • CELULAR**, **NÃO VERIFICADO VIA CAP** e
  o horário original. É silencioso e não corresponde a alerta atual.
- Botão **Diagnóstico · celular → Worker → TV** apresenta consulta ao Worker,
  falha de consulta (quando ocorrer), horário/nível do último aviso
  recebido e registro de exibição de tarja. Status não é uma confirmação
  remota do celular.
- Receptor fica restrito ao monitoramento ativo, tela disponível e permissão
  de sobreposição para exibir a tarja. O Worker continua retendo eventos por
  somente cinco minutos, sem armazenamento ilimitado.

## Limites importantes
- A atualização **não recupera** o aviso das 14:57 de 23/11/2026 se a TV não
  o guardou (o Worker já expira os eventos em cinco minutos).
- A confirmação do Worker no celular não implica entrega final à TV.
- Um próximo aviso genuíno é necessário para validar o replay do canal real.
  Simulação enviada pelo celular valida apenas conexão e exibição.
- Em alertas reais, siga as orientações do aviso no próprio celular.
- Este é um canal experimental, complementar, **não é CAP autenticado**.

## Reversão
Excluir `CivilPhoneHistory.java`, testes e chamadas correspondentes em
`MonitorService`, remover botões e diagnóstico em `MainActivity`,
remover `Banner.showCivilPhoneReplay` e
`TvBroadcastInfoView.civilPhoneReplay`. Não alterar o histórico CAP oficial,
o vínculo de autenticação, a coleta de alertas do celular ou outras tarjas.
Para publicar uma reversão, incrementar sempre o versionCode.

## Publicação
Requer passar pela suíte Android de testes, assinatura com a chave oficial e
publicação no canal `android-tv/distribution/stable.json`, com SHA-256
confirmado. Não aconselhar instalar até a publicação concluir.
