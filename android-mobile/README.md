# Monitor Global para Android — prévia 0.1.1

Primeiro aplicativo de celular, independente da instalação da TV. O APK de teste usa o pacote `top.monitorglobal.mobile.dev`; a aplicação principal é `top.monitorglobal.mobile`. O código de apresentação Java mantém o pacote legado dos modelos compartilhados, enquanto namespace, manifesto, recursos e canal de distribuição são próprios do celular.

## Primeira versão

- Início com eventos reais e meteorologia.
- Mapa interativo MapLibre, base Esri com atribuição e seleção de eventos.
- Tempo e chuva da Liberdade, São Paulo, com estimativas explícitas.
- Detalhes dos eventos, bandeira quando identificada, fonte, profundidade, horário brasileiro e compartilhamento.
- Avisos e situação das fontes. O feed compartilha a cobertura de M6+ globais, Brasil e áreas monitoradas; não corresponde a todos os eventos de todos os catálogos.

Atualizações funcionam enquanto a aplicação está aberta, a cada minuto e por atualização manual. Notificações push com a tela apagada ainda não estão implementadas. O canal oficial do Telegram permanece acessível. Não há sobreposição, serviço contínuo, início no boot, rastreamento de localização ou credenciais no APK.

O cache local contém somente dados públicos. Previsões são revalidadas pelos horários originais; uma falha não vira tempo seco ou zero. A tela identifica eventos salvos, consulta não confirmada e dados indisponíveis. O cache pode abrir sem rede, mas imagens do mapa e dados novos dependem de conexão.

## Compartilhamento de código

O projeto compila somente oito modelos existentes do diretório Android TV (Alert, AlertCodec, AlertPairing, MapFrame, BrDates, CountryFlag, RainForecast, WeatherForecast). Não compila atividades, serviços, permissões de TV ou seu atualizador. Fontes e bandeiras existentes, assim como MapLibre, são copiados para os assets em build. Nenhum arquivo de implementação da TV precisa ser alterado.

## Build e verificação

Requer JDK21 e AndroidSDK35. O script reutiliza o Gradle Wrapper8.9 que já existe no repositório:

```sh
cd android-mobile
./gradlew :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
./gradlew -PphoneUiChecks :app:testDebugUnitTest
```

A CI confere o APK e suas permissões. Testes de layout usam Robolectric/Skia e dados controlados, sem consultar serviços reais; não substituem teste físico, renderização WebGL ou entrega de rede em um aparelho.

## Distribuição de testes

O workflow Android mobile preview gera o APK em PRs. Após integrar na main e passar os testes, publica a pré-release `mobile-preview`, com o arquivo `monitor-global-mobile-preview.apk`. A prévia usa assinatura de desenvolvimento, mantida no cache da CI para continuidade dos testes; não é o canal oficial assinado nem publicação na Play Store. Uma futura versão oficial terá sua configuração própria de assinatura e atualização. Nenhuma chave é gravada no repositório.

Não se deve distribuir o APK release sem assinatura produzido apenas para verificação de build. O instalável de teste é o APK debug identificado como Monitor Global · Teste.

## Limites

Meteorologia permanece na cobertura real da Liberdade. Horas futuras não são inventadas a partir de uma única observação horária. Dados de danos ausentes são apresentados como sem informação; magnitude não é uma estimativa oficial de danos. Mapas e alertas preservam as atribuições e limitações das fontes.
