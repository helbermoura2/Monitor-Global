# Monitor Global TV 1.0.63 — comandos por voz (prévia)

## O que entra
- **Falar com o Monitor Global** na primeira tela de configurações; o visual dos avisos, meteorologia, Brent e satélite permanece o mesmo.
- Voz em português (pt-BR), primeiro pelo seletor oficial de reconhecimento do Android; se indisponível, tentativa pelo `SpeechRecognizer` do sistema com solicitação de permissão de microfone.
- Se o Android encaminhar `KEYCODE_SEARCH` ou `KEYCODE_VOICE_ASSIST` ao aplicativo, essas teclas também podem iniciar a escuta. **Não existe garantia de capturar o botão de microfone do controle**: muitos modelos o reservam ao Google Assistente/Gemini.
- Roteamento local, sem prompt de IA para números ou classificações: meteorologia da Liberdade, Brent, sismos no Brasil das últimas 24 h, últimos sismos, maiores do dia, resumo de ontem, satélite e tela da IA meteorológica já existente.
- Pedidos que exibem cards acionam os mesmos métodos já usados pelos botões da TV e devolvem a programação de fundo antes do card. Mantêm os atrasos dos botões, a permissão de sobreposição, a precedência dos alertas e a política de preços reais do Brent.
- Consulta **`/tv-alerts?policy=telegram-v1&view=brazil`**, compartilhando o catálogo brasileiro multifuente já usado no monitor; cache de um minuto, retorno de até cinco registros mais recentes com horário nas últimas 24 horas. Não transforma ausência de fontes em afirmação de ausência de sismos.
- Mensagem de disponibilidade/resultado vazio em overlay informativo não interativo, distinta de aviso sísmico.

## Limitações
- Esta prévia não ativa escuta contínua nem assume que o Google Assistente entrega áudio/transcrição a aplicativos de terceiros.
- Disponibilidade do serviço de reconhecimento de voz e uso do microfone do controle dependem da marca e versão da Android TV.
- O modo de voz não interpreta pedidos arbitrários sobre qualquer localidade; meteorologia permanece na região de Liberdade/SP e o Brent depende do pregão e da fonte de preço real.
- A tela da IA meteorológica existente é acessível pelo comando de voz, mas não há conversa generativa nova nesta etapa.
- Uma consulta solicitada por voz não é alerta automático nem previsão de terremoto. Cobertura parcial das fontes pode omitir eventos.

## Teste na TV
1. Instale uma build de testes **assinada** com a identidade apropriada (não substituir APK oficial por build debug com assinatura incompatível).
2. Abra **Monitor Global TV** e selecione **🎙 Falar com o Monitor Global**.
3. Diga “Como está a temperatura?”, “Mostre o Brent” ou “Teve terremoto no Brasil nas últimas 24 horas?”.
4. Confira reconhecimento de fala, permissão de microfone (se houver), sobreposição sobre o conteúdo anterior, dados reais e prioridade dos avisos.
5. Faça um teste adicional do botão físico do microfone **com o app aberto**. Se ele chamar o Assistente do sistema, isso é limitação do sistema e não falha de reconhecimento do comando dentro do aplicativo.
6. Para validar a consulta sísmica vazia, confira se o card informa explicitamente que nenhuma ocorrência foi encontrada nas fontes disponíveis, sem afirmar ausência absoluta.

A compilação e os testes automatizados não substituem o teste físico com o microfone do controle remoto.
