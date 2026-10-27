# Monitor Global TV — versão 1.0.0 do projeto

Notificações de sismos M6+ globais, sismos no Brasil sem corte mínimo e boletins oficiais de tsunami para Google TV e Fire TV, sem Telegram ou serviços Google no aplicativo. A prévia já foi testada pelo proprietário com a faixa sobre outro aplicativo no Fire Stick.

APK assinado: `https://monitorglobal.top/downloads/monitor-global-tv-1.0.0.apk`. Atualize por cima da prévia, sem desinstalar, para validar a migração assinada no aparelho. Android 9/API28 ou superior.

O aplicativo inclui **Verificar atualização oficial** e ajustes visuais por configuração limitada no servidor. A primeira instalação desta versão é manual; as próximas podem ser baixadas e verificadas pelo aplicativo, com confirmação no instalador da TV. Não é uma publicação em loja de aplicativos.

Leia [OFFICIAL_RELEASE.md](OFFICIAL_RELEASE.md) para assinatura, autorizações, configuração única dos Secrets e manutenção por IAs autorizadas. A chave privada nunca deve ser enviada ao repositório público.

## Instalar e testar

O APK de teste está em [downloads/monitor-global-tv-1.0.0.apk](../downloads/monitor-global-tv-1.0.0.apk). Depois da publicação, o endereço é:

`https://monitorglobal.top/downloads/monitor-global-tv-1.0.0.apk`

1. Baixe e instale **no aparelho de TV**. No Fire TV, um instalador como Downloader pode abrir o endereço; autorize a instalação para o instalador usado nas configurações do aparelho.
2. Abra **Monitor Global TV** e selecione **Permitir exibição sobre outros aplicativos**. O aplicativo informa se a permissão foi concedida. Algumas versões do Fire OS não oferecem essa tela ou não autorizam a sobreposição; isso precisa ser conferido no aparelho.
3. Selecione **Testar faixa em 10 segundos**. Volte à tela inicial/abra outro aplicativo. O aviso identifica explicitamente que os dados são fictícios e fecha sozinho.
4. Depois, selecione **Ativar monitoramento**. Som e duração ficam na mesma tela. Para parar, use o botão do aplicativo ou a ação na notificação persistente do serviço.

A faixa não captura os botões do controle e não pretende interromper ou controlar Netflix/YouTube. A tela do aplicativo é apenas configuração. Sem permissão de sobreposição, há tentativa de notificação comum, cuja visibilidade também varia entre sistemas de TV. O teste da faixa não comprova a entrega de um sismo real.

Se for necessário instalar por ADB, faça isso a partir de um computador na mesma rede, após habilitar e autorizar a depuração no próprio Fire Stick. Comandos locais de referência:

```
adb connect IP_DO_FIRE_STICK:5555
adb install monitor-global-tv-1.0.0.apk
```

Se o Fire OS não oferecer a permissão na interface, a concessão pelo proprietário via ADB pode ser testada:

```
adb shell appops set top.monitorglobal.tv.preview SYSTEM_ALERT_WINDOW allow
```

O IP privado sozinho não dá acesso ao aparelho a partir do ambiente remoto de desenvolvimento; é necessária conectividade de rede autorizada. A versão não foi instalada remotamente ou testada no hardware durante a criação.

## Como recebe os avisos

- Consulta HTTPS ao Monitor Global a cada **30 segundos**, usando ETag/304 para reduzir transferências. O Worker compartilha a coleta por cache; não há novo cron ou Durable Object para o feed.
- Terremotos: USGS M6+ no mundo; USP/RSBR, USGS, EMSC e GEOFON sem corte mínimo no Brasil. Revisões de IDs já acompanhados continuam por até 72 horas, inclusive abaixo do corte. Veja [regras, fontes e limites da versão 1.0.13](PARIDADE_TELEGRAM_1_0_13.md).
- Tsunami: produtos oficiais identificados por autoridade e ocorrência. Revisões/encerramentos são explícitos e limitados às costas citadas. Um informativo ou produto sem ameaça novo não é um aviso inicial de perigo.
- A primeira consulta saudável estabelece a referência de cada fonte e **não anuncia os eventos que já estavam no feed**. Erros de fonte não viram encerramento, e não se reproduz uma sequência de avisos antigos ao reconectar.
- Duplicações são controladas no aparelho; até 256 versões são retidas, com expiração. A fila visual tem limite de oito itens. Não há dados de conta, analytics ou cadastro do aparelho.

Precisa de aparelho ligado e conectado. Não há garantia de entrega com o aparelho em repouso, desligado, aplicativo forçado a parar ou serviço encerrado pelo fabricante. A retomada após reinício é tentada se o usuário havia ativado o monitoramento. A finalidade desta prévia é justamente verificar o comportamento real em segundo plano.

O Telegram continua ativo durante essa validação. Não se desativa o canal ou o alarme existente por instalar esta versão.

## Desenvolvimento

Java 21, Android SDK 35, Gradle 8.9 e Android Gradle Plugin 8.7.3; mínimo Android 9/API 28. Sem bibliotecas externas no aplicativo. Compilação:

```
cd android-tv
./gradlew :app:assembleDebug :app:lintDebug
```

O wrapper verifica o SHA-256 da distribuição. `local.properties`, ferramentas e chaves não são versionadas. A assinatura permanente e a migração da prévia estão descritas em [OFFICIAL_RELEASE.md](OFFICIAL_RELEASE.md).

Os testes de estado executam sem Android:

```
javac -d /tmp/tv-tests app/src/main/java/top/monitorglobal/tv/Alert.java app/src/main/java/top/monitorglobal/tv/AlertTracker.java tests/AlertTrackerCheck.java
java -cp /tmp/tv-tests top.monitorglobal.tv.AlertTrackerCheck
```

A ação **Android TV preview** compila, roda essas verificações e publica um artefato de teste, sem instalar em aparelhos. O APK com nome de versão em `downloads/` é o pacote entregue nesta prévia, não uma atualização automática a cada compilação da ação.

A prévia 0.1.1 aguarda até 45 segundos pela resposta do feed na conexão inicial, cobrindo o fallback das fontes oficiais. Os 30 segundos entre consultas são contados após concluir a anterior; não há consultas paralelas sobrepostas.

Ajustes de espaçamento, brilho no Breaking News e ícone oficial: [identidade visual 1.0.5](IDENTIDADE_VISUAL_1_0_5.md).

Transição vertical e boletim sem ameaça: [TV 1.0.6](TSUNAMI_E_TRANSICAO_1_0_6.md).

Resumo do dia e replay de sismos ocorridos com a TV desligada: [TV 1.0.7](RESUMO_E_REPLAY_1_0_7.md).

Replay do último resumo, inclusive sem internet: [TV 1.0.8](REPLAY_RESUMO_1_0_8.md).

Entrada e saída suaves da tarja inteira: [TV 1.0.9](ENTRADA_SUAVE_1_0_9.md).

Resumo automático à meia-noite de Brasília, recuperação e prioridade dos avisos: [TV 1.0.10](RESUMO_AUTOMATICO_1_0_10.md).

Abertura com bloco vermelho revelando a tarja: [TV 1.0.11](ABERTURA_TELEJORNAL_1_0_11.md).

Seis segundos completos de leitura por sismo e saída com a mesma varredura: [TV 1.0.12](LEITURA_E_SAIDA_1_0_12.md).

- [Mapas de epicentro e costas na tarja e no resumo — versão 1.0.15](MAPAS_NA_TARJA_1_0_15.md).
- [Ciclo regional de tsunami validado na versão 1.0.14](CICLO_TSUNAMI_1_0_14.md).
