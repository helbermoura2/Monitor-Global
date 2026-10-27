# Verificação de mapas, replay e recursos · 1.0.18

Foi reproduzida uma corrida ao fechar a tarja exatamente entre a preparação geográfica e o agendamento do download de satélite. O executor já encerrado lançava `RejectedExecutionException`. O agendamento agora aceita o cancelamento durante o fechamento, sem esconder rejeições inesperadas quando o componente ainda está aberto. Não foi identificado ou alegado um vazamento global de memória neste ensaio.

A nova suíte opcional usa Robolectric 4.16.1 com Android API35 e o renderizador nativo Skia. Executa o código real de Canvas, Bitmap, MapInset, NewsBannerView e SharedPreferences no computador de teste. As respostas de imagens são fictícias e locais; nenhum alerta ou mensagem ao Telegram é enviado. As dependências de teste não entram no APK.

Verificações executadas:

- Consultar o parcial de hoje preserva o resumo completo de ontem. Migração de registros antigos só aceita um resumo completo.
- A imagem desenhada pela tarja corresponde ao mapa do sismo no primeiro painel e ao mapa de tsunami após a troca de oito segundos; a comparação verifica os pixels da área do mapa.
- Os dados reais da fixture compartilhada produzem contornos próprios para ameaça, sem ameaça e encerramento.
- Cancelamento regional de Vanuatu não remove a geometria de ameaça de Fiji. O mapa de maior prioridade segue a região ainda ativa.
- Falha ao obter a imagem mantém a geografia offline.
- Fechar durante uma leitura cancela a conexão e encerra o executor.
- Trinta resumos completos preparam 150 imagens; o máximo de bitmaps finais por resumo foi 1.860.000 bytes (cerca de 1,77 MiB), sem incluir outros recursos do processo.
- Cento e vinte resumos interrompidos, com cinco preparações cada, terminam sem executores ou conexões ativos. Os registros de desenhos ficam vazios após o fechamento, inclusive se uma nova preparação chegar depois dele.

Resultado: 49 testes Android/JVM aprovados, incluindo nove verificações nativas de recursos; cinco verificações de mapas no Worker aprovadas. A nova suíte integra a verificação de PRs do aplicativo.

Execução reproduzível, com Java21 e o SDK Android configurados:

```sh
cd android-tv
./gradlew --no-daemon -PnativeMapChecks -Pandroid.useAndroidX=true :app:testReleaseUnitTest
```

Evidência: [resultado e hashes](../docs/audits/tv-map-resources-20261027.json).

**Limites:** nenhum aparelho físico está conectado ao ADB deste ambiente. O ensaio não mede GPU, RAM total do processo Android ou estabilidade após horas na TCL/Fire Stick. Liberar as referências do componente e encerrar seus recursos não prova que toda memória do sistema foi devolvida naquele instante. A checagem visual e uma medição prolongada nos aparelhos continuam pendentes; não é solicitado outro teste cego de várias horas como condição para esta correção.
