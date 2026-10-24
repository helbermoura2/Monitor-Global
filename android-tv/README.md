# Monitor Global TV — prévia 0.1.1

Aplicativo de notificações de **sismos M6+ e boletins oficiais de tsunami**, para validar na TCL P7K (Google TV) e no Fire TV Stick 4K Max. Não é uma versão homologada nesses aparelhos. Não reproduz o site, não usa Telegram nem Firebase/Google Play Services e não contém tokens.

## Instalar e testar

O APK de teste está em [downloads/monitor-global-tv-0.1.1-preview.apk](../downloads/monitor-global-tv-0.1.1-preview.apk). Depois da publicação, o endereço é:

`https://monitorglobal.top/downloads/monitor-global-tv-0.1.1-preview.apk`

1. Baixe e instale **no aparelho de TV**. No Fire TV, um instalador como Downloader pode abrir o endereço; autorize a instalação para o instalador usado nas configurações do aparelho.
2. Abra **Monitor Global TV · Prévia** e selecione **Permitir exibição sobre outros aplicativos**. O aplicativo informa se a permissão foi concedida. Algumas versões do Fire OS não oferecem essa tela ou não autorizam a sobreposição; isso precisa ser conferido no aparelho.
3. Selecione **Testar faixa em 10 segundos**. Volte à tela inicial/abra outro aplicativo. O aviso identifica explicitamente que os dados são fictícios e fecha sozinho.
4. Depois, selecione **Ativar monitoramento**. Som e duração ficam na mesma tela. Para parar, use o botão do aplicativo ou a ação na notificação persistente do serviço.

A faixa não captura os botões do controle e não pretende interromper ou controlar Netflix/YouTube. A tela do aplicativo é apenas configuração. Sem permissão de sobreposição, há tentativa de notificação comum, cuja visibilidade também varia entre sistemas de TV. O teste da faixa não comprova a entrega de um sismo real.

Se for necessário instalar por ADB, faça isso a partir de um computador na mesma rede, após habilitar e autorizar a depuração no próprio Fire Stick. Comandos locais de referência:

```
adb connect IP_DO_FIRE_STICK:5555
adb install monitor-global-tv-0.1.1-preview.apk
```

Se o Fire OS não oferecer a permissão na interface, a concessão pelo proprietário via ADB pode ser testada:

```
adb shell appops set top.monitorglobal.tv.preview SYSTEM_ALERT_WINDOW allow
```

O IP privado sozinho não dá acesso ao aparelho a partir do ambiente remoto de desenvolvimento; é necessária conectividade de rede autorizada. A versão não foi instalada remotamente ou testada no hardware durante a criação.

## Como recebe os avisos

- Consulta HTTPS ao Monitor Global a cada **30 segundos**, usando ETag/304 para reduzir transferências. O Worker compartilha a coleta por cache; não há novo cron ou Durable Object para o feed.
- Terremotos: USGS, aviso inicial apenas a partir de M6. A faixa de M5,5+ permite acompanhar revisões de um evento já conhecido que caia abaixo de seis, sem anunciar novos eventos menores.
- Tsunami: produtos oficiais identificados por autoridade e ocorrência. Revisões/encerramentos são explícitos e limitados às costas citadas. Um informativo ou produto sem ameaça novo não é um aviso inicial de perigo.
- A primeira consulta saudável estabelece a referência de cada fonte e **não anuncia os eventos que já estavam no feed**. Erros de fonte não viram encerramento, e não se reproduz uma sequência de avisos antigos ao reconectar.
- Duplicações são controladas no aparelho; até 256 versões são retidas, com expiração. A fila visual tem limite de oito itens. Não há dados de conta, analytics ou cadastro do aparelho.

Precisa de aparelho ligado e conectado. Não há garantia de entrega com o aparelho em repouso, desligado, aplicativo forçado a parar ou serviço encerrado pelo fabricante. A retomada após reinício é tentada se o usuário havia ativado o monitoramento. A finalidade desta prévia é justamente verificar o comportamento real em segundo plano.

O Telegram continua ativo durante essa validação. Não se desativa o canal ou o alarme existente por instalar esta versão.

## Desenvolvimento

Java 21, Android SDK 35, Gradle 8.9 e Android Gradle Plugin 8.7.3; mínimo Android 8/API 26. Sem bibliotecas externas no aplicativo. Compilação:

```
cd android-tv
./gradlew :app:assembleDebug :app:lintDebug
```

O wrapper verifica o SHA-256 da distribuição. `local.properties`, ferramentas e chaves não são versionadas. Este APK é assinado com chave de desenvolvimento: uma futura compilação com outra chave pode exigir desinstalar a prévia. Uma versão de distribuição permanente precisa de assinatura estável antes de prometer atualizações por cima da instalação existente.

Os testes de estado executam sem Android:

```
javac -d /tmp/tv-tests app/src/main/java/top/monitorglobal/tv/Alert.java app/src/main/java/top/monitorglobal/tv/AlertTracker.java tests/AlertTrackerCheck.java
java -cp /tmp/tv-tests top.monitorglobal.tv.AlertTrackerCheck
```

A ação **Android TV preview** compila, roda essas verificações e publica um artefato de teste, sem instalar em aparelhos. O APK com nome de versão em `downloads/` é o pacote entregue nesta prévia, não uma atualização automática a cada compilação da ação.

A prévia 0.1.1 aguarda até 45 segundos pela resposta do feed na conexão inicial, cobrindo o fallback das fontes oficiais. Os 30 segundos entre consultas são contados após concluir a anterior; não há consultas paralelas sobrepostas.
