# Monitor Global Android · Explorar Brasil (prévia, branch de teste)

## Escopo e interface existente
- A nova tela **Tempo → Explorar meteorologia do Brasil · prévia** usa o tema atual do aplicativo: Rajdhani, azul-marinho, ciano, cartões e barra de navegação originais.
- O mapa de eventos, a tela de chuva da Liberdade, o feed de sismos, os avisos de tsunami, o site, a Android TV e o Worker principal não são substituídos.
- São **16 localidades de referência** (não todas as cidades do Brasil). Quatro camadas: temperatura, vento a 10 m, chuva horária prevista e pressão. Linha do tempo 0 a +24h em passos de três horas.
- Os números são previsões **pontuais**, diretamente da Open-Meteo: NÃO há campo espacial contínuo, mapa radar, observação local, previsão de risco de inundação nem nowcasting. Setas animadas mostram a direção do vento **em cada ponto consultado**, sem extrapolar a velocidade entre cidades.
- A consulta é feita diretamente no celular, com múltiplas coordenadas numa requisição HTTP. Como a Open-Meteo **multiplica a contagem de chamadas equivalentes por localização**, esta prévia limita a 8 tentativas diárias por aparelho, intervalo mínimo de 10 minutos e cache local de até 3 horas, preservado entre aberturas. Não há cron de GitHub Actions, novo Worker, Supabase, chave API ou cobrança configurada.
- O backend dos serviços existentes continua no Cloudflare. Este recurso não altera as prioridades de alerta.
- O código WebView restringe rede a Open-Meteo e tiles Esri já usados pelo projeto; scripts, HTML e fontes carregam somente dos assets locais. Atribuição Open-Meteo CC BY 4.0 é exibida.
- Otimizações: MapLibre com pixelRatio limitado a 1,25, máximo de 96 tiles no cache, apenas 16 marcadores e animação CSS reduzida ao sair da tela; respeita `prefers-reduced-motion`.

## Notificações no celular
- FCM segue como a modalidade preferencial quando configurado com o projeto Firebase e com o segredo de envio somente no servidor. Assinatura voluntária e permissão Android 13+ são mantidas.
- **Sem configuração FCM**, o botão em **Avisos → Ativar avisos no celular** programa um trabalho periódico do próprio Android aproximadamente a cada 30 minutos, com um pedido curto ao feed **já existente** de sismos e tsunamis. Nenhum servidor adicional e nenhum Job do GitHub são necessários.
- O primeiro feed íntegro estabelece o estado inicial e não anuncia eventos anteriores. As consultas seguintes não mostram eventos vencidos, ignoram fontes quebradas, deduplicam revisões e limitam a três notificações por trabalho.
- É uma alternativa de melhor esforço: o Android pode atrasar/suspender as consultas, uma parada forçada pode impedir execução e **não há garantia de entrega em tempo real**. Custos de rede e bateria do telefone continuam existindo.
- **Notificações meteorológicas oficiais do Brasil não foram implementadas nesta etapa.** Não disparamos alertas de tempo severo com base em estimativas próprias da IA ou em previsões pontuais.
- Mesmo no modo FCM, o envio real precisa de configuração e teste de ponta a ponta. **Testar notificação neste aparelho** confirma apenas o canal local.

## Condições de custo zero
- Open-Meteo Free: permitido para uso não comercial, com atribuição; até 10 mil chamadas/dia, sujeitas a rate limit e sem SLA. Não se configurou cartão nem plano pago.
- Cloudflare: o modo de consulta periódica de sismos gera **até cerca de 48 consultas/dia por aparelho habilitado** ao Worker existente. O tráfego se acumula com o site e a TV; em quantidade alta de aparelhos pode exceder a cota gratuita. Antes de ampliar a distribuição, exigir monitoramento e um limite agregado, ou configurar FCM.
- O aplicativo mantém dados antigos apenas enquanto forem reconhecidamente válidos; sem previsões válidas informa indisponibilidade. Nunca apresenta uma previsão inventada.
- A tela não executa chamadas Open-Meteo enquanto fechada e não consulta por GPS.

## Checklist antes de liberar um APK
1. Rodar `node --test tests/unit/phone-brazil-model.test.mjs` e testes Android existentes, quando houver capacidade disponível de CI.
2. Verificar compilação, Lint, MapLibre e tela de chuva antiga, sem mudar o tema ou criar nova navegação inferior.
3. Testar no Nothing Phone (1) (e outro aparelho se possível): zoom, camadas, linha do tempo, memória, economia de bateria e modo de movimentos reduzidos.
4. Em **Avisos**, conceder permissão, ativar, verificar teste local, forçar segundo plano e verificar se as notificações de um evento **novo** são entregues; não publicar como aviso instantâneo.
5. Configurar Firebase de verdade e enviar mensagem FCM controlada, se a opção de push imediato for desejada.
6. Validar Open-Meteo/CSP e termos da Esri para o volume de uso. Sem aprovação desses testes, manter como prévia em branch, não publicar APK oficial.
