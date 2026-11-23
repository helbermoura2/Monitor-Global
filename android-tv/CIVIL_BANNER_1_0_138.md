# Argos Orbis TV 1.0.138 — Tarja Defesa Civil refinada

## Objetivo
Aplicar à tarja nativa da TCL P7K o alinhamento aprovado na foto do teste de 22/11/2026.
A imagem gerada era apenas uma referência visual: a implementação é em Canvas/Java nativo
e usa o texto real recebido do CAP ou da ponte autenticada dos dois celulares.

## Alterações
- Placa esquerda de **DEFESA CIVIL** centralizada vertical e horizontalmente, com
  legenda abaixo de linha vermelha, sem reutilizar a coluna estreita de magnitude.
- Mensagem de alerta até duas linhas, título alinhado e divisórias discretas antes do
  texto e do logo oficial.
- Rodapé de um aviso da Defesa Civil começa parado por 3,5 segundos para que a
  origem e a data possam ser lidas; depois mantém o ticker já existente.
- Nova categoria visual CIVIL: entrada nativa curta (0,52 segundo no modo Completo),
  com suave varredura única das duas bordas vermelhas (0,82 segundo).
  O modo Suave limita o tempo e a intensidade. O modo Sem efeitos permanece estático.
  Sem luz estroboscópica, som novo, efeito de piscar texto ou sobreposição de tela cheia.
- Mantém separados os rótulos de **SIMULAÇÃO**, **TESTE FICTÍCIO**, **CELULAR**
  e as fontes oficiais. Simulações locais são **TESTE • TV** e simulações recebidas
  do telefone são **TESTE • CELULAR**.
- Não modifica detector Cell Broadcast, rota Cloudflare, fila de avisos, deduplicação,
  critérios de severidade, tempo de expiração ou o logo oficial.

## Arquivos editados
- `android-tv/app/src/main/java/top/monitorglobal/tv/TvBroadcastInfoView.java`
- `android-tv/app/src/main/java/top/monitorglobal/tv/TvEffectsController.java`
- `android-tv/app/src/main/java/top/monitorglobal/tv/BannerOpening.java`
- `android-tv/app/build.gradle` (versão 1.0.138, código 10138)

## Testes de validação no aparelho
1. Atualizar um APK 1.0.138 oficial assinado pela mesma chave da 1.0.137; não
   desinstalar a versão anterior.
2. Simular pela TV aviso Severo e Extremo: a legenda deve mostrar TESTE • TV,
   com fonte centralizada e mensagem legível.
3. Testar o encaminhamento do Nothing Phone 1 e do Galaxy S25 Ultra, separadamente;
   SIMULAÇÃO e TESTE • CELULAR devem permanecer explícitos.
4. Após um Cell Broadcast novo e real (sem abrir o histórico), conferir que a tarja
   usa CELULAR • NÃO É CAP e informa a origem na linha rolante.
5. Comparar modo Completo, Suave e Sem efeitos. O conteúdo deve permanecer
   imediatamente legível e sem piscar. Confirmar que sismos, meteo e Brent
   não tiveram a diagramação alterada.

## Reversão
Reverter somente este conjunto de alterações nos três arquivos Java, preservando a
ponte de alertas que está em teste. Em eventual nova publicação, incrementar sempre
o versionCode (não voltar ao 10137). A revisão da ponte completa continua em
`android-mobile/docs/CIVIL_PHONE_TV_BRIDGE_ROLLBACK.md`.

## Publicação
O commit do código **não publica automaticamente um APK** e não implica atualização
no aparelho. O APK 1.0.138 só poderá ser instalado depois de compilado, assinado
e publicado no canal oficial com a mesma chave da versão já instalada.
