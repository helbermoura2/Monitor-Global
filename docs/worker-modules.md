# Organização do Worker

O ponto de entrada continua sendo `monitor-global-worker-7_7_0.js`. Ele mantém
as rotas, a coordenação de envios e as classes `EarthquakeAlertDelivery` e
`DailySummaryDelivery`. Nomes, bindings, chaves de armazenamento e cron existentes
são preservados. Não há criação ou migração de recursos nesta reorganização.

| Responsabilidade | Arquivo |
| --- | --- |
| Respostas HTTP, CORS, leitura e timeout | `worker/http.mjs` |
| Pisos e limites por servidor FDSN | `worker/fdsn-policy.mjs` |
| Leitura simples de tags XML | `worker/xml.mjs` |
| Adaptadores AFAD, INGV, JMA, FUNVISIS e status | `worker/seismic-providers.mjs` |
| Fronteira brasileira por coordenadas | `worker/brazil-boundary.mjs` |
| Consulta e normalização dos catálogos para alertas/resumos | `worker/telegram-seismic-data.mjs` |
| Fontes, bandeiras e dados gráficos embutidos | `worker/image-assets.mjs` |
| PNG, desenho do cartão e resumo diário | `worker/image-rendering.mjs` |
| Transporte Telegram: envio, edição e classificação de falhas | `worker/telegram-transport.mjs` |

O transporte recebe renderização, exposição e formatação por parâmetros da
fábrica `createTelegramTransport`. Assim os testes podem substituir essas
operações sem consultar fontes reais ou enviar mensagens. A renderização do
resumo recebe os dados prontos; a consulta padrão continua no coordenador. Os
módulos não importam o ponto de entrada nem formam ciclos de importação.

A divisão reduz o arquivo principal de 5.600 para cerca de 2.000 linhas. Os dados
embutidos continuam no pacote publicado: esta mudança melhora manutenção e
isolamento de testes, sem prometer redução no download ou na RAM do celular.

## Verificar e empacotar

Requer Node 20+ e Python 3. Instale as dependências com `npm ci`.

```sh
npm run worker:test
npm run worker:bundle
python3 -m unittest discover -s tests/unit -p test_cloudflare_maintenance.py
```

`worker:test` executa contratos dos módulos, imagens e testes existentes de
Telegram, resumos, fontes e armazenamento com rede/Telegram simulados.
`worker:bundle` usa a versão fixada de esbuild, cria um único módulo ESM no ZIP
`downloads/monitor-global-worker-otimizado.zip` e atualiza o SHA-256 revisado em
`tools/cloudflare-worker-maintenance.py`. O ZIP é determinístico para as mesmas
fontes e documentos. Nunca publique apenas o arquivo de entrada sem os módulos:
para upload manual use o arquivo já compilado que está dentro do ZIP.

A publicação segue o workflow existente `Cloudflare Worker maintenance` na
branch `main`. Ele preserva configurações, bindings, segredos e cron e verifica
os marcadores de saúde. O marcador desta organização é
`workerModules: maintenance-modules-v1`. Em falha de propagação, use `verify`
para verificar de novo; não repita o deploy apenas para consultar a saúde.

## Regressão visual e funcional

Os snapshots de resumo normal, resumo vazio e cartão individual foram gerados
antes e depois da extração com entradas fixas e rede simulada. Pixels e PNGs
foram comparados. Os hashes de pixels são verificados nos testes para permitir
variações de compressão entre versões de Node sem aceitar mudanças no desenho.

Alterações futuras de desenho exigem revisar os snapshots e atualizar os hashes
conscientemente. Mudanças de regras de entrega ficam separadas de mudanças no
transporte ou na imagem; preserve os testes de concorrência, reenvio incerto,
revisões, janela BRT, histórico e permissões administrativas.

As cinco rotas sísmicas extraídas também foram comparadas com o Worker anterior
em dez cenários (resposta normal e falha de cada rota): status, cabeçalhos, JSON e
consultas ao provedor foram idênticos. Evidências: `tests/fixtures/worker-modules/`.
