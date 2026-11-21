# Auditoria de segurança da hospedagem estática — 07/11/2026

## Achado: fronteira de publicação demasiado ampla
O Worker estático `monitor` utiliza `[assets] directory = "."` em `wrangler-monitor.toml`. Antes desta alteração, `.assetsignore` impedia a publicação de alguns arquivos de configuração e do entrypoint do backend, mas não excluía todos os módulos internos `.mjs`, ferramentas, testes, documentação operacional, fontes Android nem o pacote ZIP de implantação.

**Classificação:** risco de exposição acidental durante o build, **não vazamento comprovado**. A análise se baseia na configuração versionada, não em leitura autenticada do ambiente de produção, e não demonstra que um arquivo privado ou uma credencial tenha sido servido publicamente.

## Correção proposta
1. Ampliar `.assetsignore` com exclusões específicas de fontes do Worker, configurações, ambientes/credenciais, diretórios de testes, docs, ferramentas, relatórios e ZIPs de implantação.
2. Preservar explicitamente **as rotas públicas necessárias para atualização da Android TV**: `/android-tv/distribution/stable.json`, `/downloads/*.apk` e `/downloads/*.apk.sha256`. Preservar também `/index.html`, `/sw-monitor.js`, `/manifest.webmanifest` e os assets de `js/`, `css/`, `data/`, `assets/`, `media/`, `img/`, `vendor/`, `mobile/` e `satellite/`.
3. Adicionar `_headers` com `nosniff`, política de referência consistente com o HTML, proteção contra enquadramento por outros sites e política CSP **somente** para `frame-ancestors`, `object-src` e `base-uri`. Nenhuma restrição de `script-src`, `connect-src`, `img-src` ou `font-src` é imposta sem inventário das fontes de mapas e alertas.
4. Incluir teste offline de semântica `.gitignore`/`.assetsignore` com `git check-ignore`, verificando tanto os caminhos recusados quanto os que precisam continuar públicos.

## Validação
- `node --test tests/unit/static-asset-boundaries.test.mjs`
- Após aprovação do CI e implantação do Worker estático, conferir a resposta HTTP real para `/`, `/sw-monitor.js`, `/android-tv/distribution/stable.json` e o APK anunciado no manifesto, e confirmar que caminhos como `/tools/cloudflare-worker-maintenance.py`, `/kv-operation-metrics.mjs` e `/downloads/monitor-global-worker-otimizado.zip` não são servidos. Fazer leituras apenas; não executar endpoints de envio de alertas.
- `_headers` atinge respostas dos assets estáticos, **não** respostas geradas pelo backend `black-sky-9ba0`, que já possui proteção própria.
- Não mudar plano Cloudflare, Secrets, fonte de sismos, regras Telegram ou publicação Android TV. Merge/deploy somente após revisão.

## Pendências separadas para a auditoria completa
- `kv-operation-metrics.mjs` aceita credencial de métricas somente leitura via `?token=`; avaliar remoção desse atalho em URL e migração do acesso manual para cabeçalho, sem publicar o segredo em histórico/referrer.
- Conferir escopos dos tokens Cloudflare/GitHub e permissões da conta com o dono. A consulta GitHub `main/protection` segue 403 pela integração; a ruleset pública **Proteção da main** tem aplicação ativa, mas as regras consultadas são apenas proibição de deleção e push não fast-forward. Antes de exigir PR ou checks em `main`, avaliar compatibilidade com as Actions automáticas que publicam fontes oficiais.
- Continuar revisão incremental de interpolação de HTML externo (XSS), limites de rotas públicas e dependências. Nenhuma dessas etapas é declarada concluída aqui.
