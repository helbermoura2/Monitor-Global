# Android TV 1.0.58 — diagnóstico da IA e continuidade do modelo

## Relato de uso real
Em 08/11/2026, após instalar 1.0.57, o usuário exibiu a tela de consulta manual da IA meteorológica com:
- `TEMPO HORÁRIO`
- `A análise de IA está indisponível neste momento.`
- `Sem destaque recente válido no armazenamento local.`

A tela exibiu uma resposta estruturada do Worker com status `unavailable`. Isso não demonstra, por si só, problema de Internet no aparelho: o próprio backend pode estar sem dados válidos, sem vinculação do modelo, com timeout, erro do modelo, cache/armazenamento indisponível ou serviço interno indisponível. Não existe acesso aos logs internos de produção para atribuir uma causa exata ao caso da foto.

## Correção

1. `worker/weather-briefing.mjs`: retorna **somente códigos de causa controlados** para `unavailable`, sem erros arbitrários do provedor, dados internos ou chaves: `source-unavailable`, `source-stale-or-invalid`, `model-unconfigured`, `service-unavailable`, `invalid-prompt` e `storage-unavailable`. Os códigos já existentes `model-error`, `model-timeout` e `invalid-selection` permanecem.
2. `WeatherAiStatus`: converte esses códigos em instruções compreensíveis na TV. O código técnico do provedor aparece apenas se for numérico e tiver 4–5 dígitos; textos arbitrários nunca são expostos.
3. `WeatherAiInfoActivity`: acompanha **uma mesma solicitação** com até seis consultas `pending`, espaçadas em 2,4 segundos, dando tempo para a IA concluir sem iniciar inferência paralela. Não adiciona consulta automática permanente. Após uma resposta `ready` válida pelo mesmo `WeatherBriefing.parse` já usado no cartão, **salva o resultado no cache local**, atualizando a seção `Último destaque guardado nesta TV`.
4. Modelo antigo `@cf/meta/llama-3.1-8b-instruct-fp8` estava listado pela Cloudflare para depreciação em **20/11/2026**. O Worker passa a usar a variante `@cf/meta/llama-3.1-8b-instruct-fp8-fast`; o leitor Android aceita temporariamente respostas dos dois modelos conhecidos durante a propagação da atualização, mas não aceita modelos desconhecidos. Cache do Durable Object é separado pelo identificador do modelo.
5. `android-tv/app/build.gradle` incrementado para **1.0.58 (versionCode 10058)**, permitindo atualização pelo botão oficial já disponível na TV, após compilação e publicação assinada.

## Garantias
- Sem alterar as sobreposições, logo Radar Scope ou sua animação, replay regional, prioridades de tsunami/sismos, cadência de consulta sísmica, som ou regras dos alertas.
- Modelo de IA continua **apenas selecionando interpretações previstas e verificadas no Worker**: nenhuma geração livre de alertas, datas, números ou previsões sísmicas.
- Nenhuma coordenada nova, entrada de texto, conta de usuário ou localização pessoal é enviada. Região meteorológica fixa: Liberdade/SP.
- A indisponibilidade da IA não afeta a previsão meteorológica comum nem os alertas.
- Os testes com fixtures verificam as causas diferentes; testes de compilação/CI não simulam uma implantação real do modelo em Cloudflare. A causa original da foto precisa ser conferida no aparelho depois da publicação, lendo a mensagem específica.

## Como validar
- Rodar unidade Node de `tests/unit/weather-briefing.test.mjs`.
- Rodar compilação, lint, `WeatherBriefingTest`, Robolectric `WeatherAiInfoTest`, testes sísmicos e Smoke Test.
- Publicar oficialmente somente após revisão, assinatura do projeto e testes concluídos.
- No aparelho: abrir IA meteorológica, consultar Tempo, depois Chuva. Confirmar se a tela distingue `sem destaque relevante` de `fonte indisponível` e `falha do modelo`, e se uma resposta `ready` passa a aparecer no cache.
