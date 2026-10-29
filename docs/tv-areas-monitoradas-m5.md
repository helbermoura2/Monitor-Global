# Aviso menor de M5+ em áreas monitoradas — TV 1.0.24

A tarja principal continua para M6+ globais, todos os sismos no Brasil e boletins oficiais de tsunami. O Telegram mantém essas regras. O novo cartão pequeno é exclusivo do aplicativo da TV.

## Regra inicial

- Magnitude **real selecionada de 5,0 até abaixo de 6,0**, profundidade conhecida de **0 a 70 km** e epicentro dentro de uma das áreas selecionadas. Um M4,99 arredondado para M5,0 não atende ao corte.
- 32 áreas povoadas em zonas sísmicas ativas, com raios operacionais de 160 a 230 km. A lista completa e as coordenadas estão em `worker/tv-target-areas.mjs`. Inclui centros urbanos na Turquia/Síria, Irã, Afeganistão, Nepal, Paquistão, Haiti, Indonésia, Filipinas, Japão, Taiwan, Chile, Vanuatu, México, Peru, Equador, Myanmar e Nova Zelândia.
- É uma seleção inicial de acompanhamento, **não um ranking científico das áreas mais perigosas**, mapa de danos, cobertura mundial completa ou previsão de destruição. Os raios incluem algumas falhas próximas no mar; não são uma fronteira de risco. Profundidade desconhecida ou maior que 70 km não dispara o cartão pequeno; isso não significa ausência de risco.
- A solução consolidada mantém a prioridade existente entre USGS, GEOFON e EMSC. Estimativas de outras agências não viram revisões da mesma fonte.

## Na televisão

O cartão aparece no canto inferior direito por oito segundos, com entrada/saída suaves, identidade do projeto, magnitude/local, profundidade, fonte, horário BRT, área monitorada e “Danos não confirmados”. Usa um som mais discreto e respeita o botão de som. Não abre mapa nem consulta população/cidades.

Em **Aviso menor**, pode-se desligar o recurso inteiro. **Escolher áreas monitoradas para M5+** permite marcar/desmarcar áreas com o controle. Todas começam marcadas. A primeira leitura é silenciosa, inclusive após mudar as escolhas; não envia um lote de eventos anteriores. Há botão de teste fictício, com dez segundos para voltar ao conteúdo da TV.

As regras existentes de deduplicação, fontes saudáveis e revisões relevantes continuam. M5+ fora das áreas não recebe o cartão pequeno. Um evento que alcança M6 passa para a tarja principal, sem repetir simultaneamente o cartão pequeno. Revisões de eventos já anunciados na tarja continuam na tarja mesmo se a magnitude cair. O aviso menor não substitui o replay do último sismo principal nem o resumo diário.

Alertas principais interrompem o cartão pequeno. Uma fila local de no máximo quatro avisos menores aguarda a exibição principal/resumo; eventos com emissão há mais de 30 minutos expiram. Em uma sequência excepcionalmente grande, os mais antigos da fila cedem lugar aos novos. Não há promessa de entrega enquanto o aparelho estiver desligado. A coleta e as atualizações do aparelho continuam dependendo de internet e das permissões já existentes.

## Fontes e plano Free

A coleta recente compartilhada baixa o piso de M5,5 para M5,0 nos mesmos pedidos USGS/EMSC/GEOFON, com os mesmos intervalos, limites de resposta, proteção de falhas e deduplicação. Não cria pedido por região, polling adicional, novo serviço, cron, Durable Object ou escrita em KV por clique. Há mais registros por resposta e o acompanhamento compartilhado pode mudar com os novos eventos; não se promete custo zero nem economia sem medir. O enriquecimento caro continua restrito aos eventos elegíveis para a tarja, sem população para esses cartões menores.

Os resumos e o corte do Telegram permanecem inalterados. Coleta de catálogo não é entrega de alerta. `targetPolicy: populated-areas-m5-v1` aparece no feed e `tvTargetPolicy` em `/health` para verificar a publicação.

## Publicar e reverter

1. Recriar o pacote com `node tools/build-worker-bundle.mjs`, publicar pelo fluxo **Cloudflare Worker maintenance → deploy** e verificar o marcador novo.
2. Publicar **Android TV official release → publish** após a integração em `main`. A instalação é pela opção **Verificar atualização oficial**, sem desinstalar ou apagar dados.
3. Para desativar imediatamente no aparelho, desligar **Aviso menor**. Uma correção de código deve usar uma versão maior e a mesma assinatura; nunca diminuir o número da versão. Para reverter apenas o Worker, usar o procedimento de reversão do guia de operação, preservando as configurações e os vínculos existentes.

## Verificação

Testes offline cobrem geografia, corte sem arredondamento, profundidade ausente/profunda, M6/Brasil preservados, baseline silenciosa, repetição, aliases, promoção para M6, fila limitada e expiração. O teste Android nativo desenha o cartão e verifica fechamento/liberação da sobreposição e do som. Isso não substitui verificar o novo visual na TCL e no Fire Stick. Não foram enviadas mensagens reais de teste ao Telegram.
