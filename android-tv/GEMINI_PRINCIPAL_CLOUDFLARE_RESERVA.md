# Monitor Global — Gemini principal e Cloudflare reserva

## Alcance desta etapa

O backend `worker/weather-briefing.mjs` agora seleciona **Gemini 3.8 Flash** como provedor primário para a **interpretação meteorológica já existente**, e mantém **Cloudflare Workers AI** como reserva.

- Na ausência do segredo `GEMINI_API_KEY`, mantém o comportamento antigo e usa Workers AI, se disponível.
- Com o segredo ativo, uma única solicitação vai primeiro ao Gemini. Se houver timeout, 429, 5xx, falha de formato ou seleção inválida, tenta **uma vez** o Workers AI.
- Ambos só podem selecionar **IDs de interpretações pré-verificadas** extraídos da previsão da Liberdade/SP. Não geram novos números, magnitude, alertas, tsunami, vítimas ou previsão meteorológica independente. O texto final é montado pelo servidor a partir da previsão autorizada.
- O cache no Durable Object persiste as escolhas do modelo escolhido; uma mesma previsão compartilhada entre **TV e Android celular** não gera novas inferências. O servidor também pode ser consumido pelo site em integração futura, mas esta etapa **não acrescenta botão ao site nem análise sísmica nova**.
- Limites rígidos já existentes, 64 novas análises/dia e 1.500/mês, se aplicam ao trabalho lógico compartilhado; apenas um modelo é tentado por vez. O Cloudflare backup também respeita sua própria cota de neurônios.
- A TV e o celular aceitam somente IDs de modelos explicitamente permitidos e previsões válidas, com horário, área e tipo da fonte reconhecidos. Diagnóstico manual na TV identifica **Gemini Flash** ou **Cloudflare Workers AI (reserva)**.

## Ativação pelo telefone, sem PC

**Não envie a chave pelo chat, GitHub, issue, commit ou APK.**

1. Pelo S25 Ultra, abra [Google AI Studio — API Keys](https://aistudio.google.com/api-keys) e crie uma chave para um **projeto gratuito**, sem ativar faturamento. Confira no painel a disponibilidade e os limites ativos do modelo `gemini-3.8-flash`. O Google gerencia cotas por projeto. A conta Google utilizada para AI Studio não implica que o Gemini API esteja automaticamente integrado.
2. Abra o [painel Cloudflare](https://dash.cloudflare.com/), vá a **Workers & Pages → black-sky-9ba0 → Settings → Variables and Secrets → Add**.
3. Escolha **Type: Secret**, nome exato **`GEMINI_API_KEY`**, e cole a chave somente no campo secreto. Clique em **Deploy**, seguindo o painel. Não use `vars` em `wrangler.toml` nem arquivos versionados.
4. Só após a integração e implantação da nova versão do Worker, valide o serviço com uma solicitação normal de meteorologia; confirme no resultado `model:gemini-3.8-flash`. Se retornar `@cf/meta/llama-3.1-8b-instruct-fp8-fast`, a **reserva Cloudflare** foi utilizada.
5. Publique o APK assinado da Android TV **1.0.58** somente após o CI de TV/celular passar; a TV atualiza pelo botão oficial. O site não requer troca de chave em navegador.

A chave pode ser configurada antes do novo código sem alterar o comportamento antigo. O provedor **Gemini não estará efetivamente ativo até o segredo estar disponível no Worker de produção e o código novo ter sido publicado**. Não foi possível fazer uma chamada real à Gemini usando credencial de usuário neste PR; os testes usam um simulador.

## Segurança, custos e fontes

- Para o nível gratuito da API Gemini, consulte as tarifas/limites em [Gemini API pricing](https://ai.google.dev/gemini-api/docs/pricing) e [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits). A quantidade gratuita disponível varia por projeto; limites e elegibilidade podem mudar. O Google informa que dados do nível gratuito podem ser utilizados para aprimorar produtos; enviar somente fatos meteorológicos públicos da região fixa.
- [Cloudflare Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/) apresenta 10.000 neurônios diários gratuitos em Workers Free. Não contratar Workers Paid nem ativar Gemini API com faturamento sem aprovação expressa.
- O programa nunca embute o segredo no código-fonte, nos APKs, na TV, no celular, em logs ou nas respostas JSON.
- O prompt é fixo, gerado por regras e limitado em bytes; saída é JSON de IDs permitidos. A Gemini usa `thinkingConfig.thinkingLevel: LOW` apenas para esse selecionador curto, com 11 s de timeout; o modelo mais lento de fallback possui no máximo 12 s. Não existem solicitações paralelas.
- A IA **não calcula nowcasting** nem prevê sismos neste PR. Projeções de chuva para 30 minutos só devem ser geradas a partir de séries minuto-a-minuto válidas, com rótulo de previsão, validade e fonte. Análise sísmica profunda é uma etapa separada, fundamentada em dados e sem mudar gatilhos de alertas.

## Testes

- `node --test tests/unit/weather-briefing.test.mjs`: Gemini como principal, Cloudflare por ausência de chave, falha de rede, 429, 503, saída inválida, um orçamento lógico, cache, dados públicos fixos e limite rígido;
- Robolectric/JVM: modelo Gemini reconhecido por TV e celular, modelos arbitrários rejeitados e fonte da análise indicada na interface;
- CI Android TV / mobile, Smoke Test e revisão manual na TV;
- Em produção, verificar com o modelo real antes de afirmar que Gemini está ativa.
