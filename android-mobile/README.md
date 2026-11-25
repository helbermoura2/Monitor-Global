# Argos Orbis para Android — prévia 0.1.24

> **Nome público:** Argos Orbis. Identificadores Android (`top.monitorglobal.*`), nomes de APK de teste e certificados continuam os mesmos para não impedir atualizações. O rótulo real depende da versão instalada.

> **Em branch de teste:** [Explorar meteorologia do Brasil, cache e avisos opcionais no próprio Android](BRASIL_METEO_PREVIEW.md). Não é APK publicado. A aparência e os serviços existentes permanecem preservados; o teste no aparelho real é obrigatório.

Primeiro aplicativo de celular, independente da instalação da TV. O APK de teste usa o pacote `top.monitorglobal.mobile.dev`; a aplicação principal é `top.monitorglobal.mobile`. O código de apresentação Java mantém o pacote legado dos modelos compartilhados, enquanto namespace, manifesto, recursos e canal de distribuição são próprios do celular.

## Primeira versão

- Início com eventos reais e meteorologia.
- Mapa interativo MapLibre, base Esri com atribuição e seleção de eventos.
- Tempo e chuva da Liberdade, São Paulo, com estimativas explícitas.
- Detalhes dos eventos, bandeira quando identificada, fonte, profundidade, horário brasileiro e compartilhamento.
- Central de Alertas com filtros por sismos e avisos de tsunami, separação de boletins informativos e resumo diário em Histórico; configurações de notificação e diagnóstico em telas próprias. O feed compartilha a cobertura de M6+ globais, Brasil e áreas monitoradas; não corresponde a todos os eventos de todos os catálogos.

Atualizações funcionam enquanto a aplicação está aberta, a cada minuto e por atualização manual. Notificações FCM são opcionais, ativadas na tela Avisos e sujeitas à permissão do Android e disponibilidade da rede. A parada forçada pode impedir mensagens até a aplicação ser reaberta. O teste local confirma apenas a postagem no aparelho; a entrega real por FCM precisa ser conferida no dispositivo. O canal oficial do Telegram permanece acessível. Não há sobreposição, serviço contínuo, início no boot ou rastreamento de localização. O APK contém somente a configuração pública Firebase; a credencial de envio fica no servidor.

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

A CI confere o APK, suas permissões e a inicialização dos assets do mapa com a API real do MapLibre. O mapa empacotado também é aberto no Chrome com WebGL por software e imagens controladas, verificando carregamento e seleção de eventos. Testes de layout usam Robolectric/Skia. Essas verificações não substituem teste físico nem entrega de rede em um aparelho.

## Distribuição Android

O workflow gera a prévia de testes e o APK estável em PRs, sem publicar nenhum deles a partir da PR. O canal `mobile-preview` continua separado e identificado como teste. O canal `mobile-stable` usa o mesmo pacote Android `.dev` e a mesma identidade de assinatura de desenvolvimento preservada no cache da CI, para permitir a atualização por cima da instalação de testes já existente. A versão estável remove o sufixo `-teste` da versão exibida, sem trocar o identificador interno nem apagar dados.

A publicação estável é uma etapa manual e protegida: depois de integrar as alterações na `main`, alguém precisa executar o workflow Android mobile preview com a opção `publish_stable` marcada. O workflow recompila e valida os APKs, compara o certificado estável com o certificado da prévia instalada e só então publica a release estável. A PR, por si só, não publica o canal estável. Nenhuma chave é gravada no repositório.

Não se deve distribuir o APK release sem assinatura produzido apenas para verificação de build. O instalável de teste é o APK debug, identificado no lançador e nas notificações como **Argos Orbis**. A prévia continua diferenciada pela versão com sufixo `-teste` em **Sobre e diagnóstico**, pelo pacote `top.monitorglobal.mobile.dev` e pelo canal de pré-release. Avisos reais permanecem normais; o teste local mantém o aviso explícito de simulação no título e no corpo.

## Limites

Meteorologia permanece na cobertura real da Liberdade. Horas futuras não são inventadas a partir de uma única observação horária. Dados de danos ausentes são apresentados como sem informação; magnitude não é uma estimativa oficial de danos. Mapas e alertas preservam as atribuições e limitações das fontes.

O mapa inclui satélite GOES-East infravermelho via NASA GIBS. O recorte é o território brasileiro (contorno IBGE local), com projeção Mercator preservada. O botão Brasil enquadra o país somente por ação do usuário. O horário publicado pela fonte aparece em BRT e imagens antigas são identificadas; não há promessa de tempo real. Animação usa no máximo seis quadros e 12 MiB de imagens comprimidas, com pausa fora da área e em segundo plano. Isso não é radar observado nem estimativa de milímetros de chuva.

Os recursos locais do mapa usam um caminho por versionCode (/assets/vN/), inclusive scripts e estilos relativos. Uma atualização usa endereços novos sem limpar o cache de imagens remotas ou os dados do usuário. A versão instalada aparece em Sobre e diagnóstico.

## Atualização pelo próprio aplicativo

Em **Avisos → Configurar notificações → Informações técnicas e atualização do aplicativo → Verificar atualização do aplicativo**, o cliente instalado `top.monitorglobal.mobile.dev` consulta o arquivo público `mobile-update.json` anexado à release estável `mobile-stable` no GitHub. O arquivo é gerado **somente após a compilação e testes**, no processo de publicação já existente; inclui versionCode, versão, SHA-256 do APK e o SHA-256 do certificado do publicador. O app compara com o certificado realmente instalado, rejeita URL arbitrária, downloads HTTP, downgrade e pacote diferente antes de solicitar instalação ao Android.

O download e a conferência acontecem no próprio aplicativo; na primeira vez o Android pode pedir permissão para instalar aplicativos desta fonte. A **instalação exige confirmação do usuário**, e preserva os dados quando o identificador e o certificado de assinatura coincidem. Não existe instalação silenciosa, serviço contínuo, Worker adicional nem consulta por GitHub Actions. O aplicativo não é iniciado no boot; o job de avisos de reserva só é novamente programado quando a aplicação for aberta após reiniciar o telefone.

**Limite:** este canal estável atualiza a instalação móvel existente `top.monitorglobal.mobile.dev`. O pacote oficial `top.monitorglobal.mobile` e a versão da TV continuam separados. Se o cache da chave de assinatura for perdido e o certificado mudar, a atualização segura será bloqueada até recuperar a continuidade da assinatura. A instalação continua exigindo confirmação do Android; não há instalação silenciosa.
