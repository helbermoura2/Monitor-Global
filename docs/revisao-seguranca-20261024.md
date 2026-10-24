# Revisão inicial de segurança — 24/10/2026

Escopo: leitura do código, configurações/workflows e testes offline. Não é pentest completo nem certificação. Não foram enviados alertas, extraídos Secrets, exercitados endpoints administrativos reais ou alteradas permissões/planos da conta.

## Proteções verificadas e correções

- **Rotas administrativas:** `/telegram-test`, `/telegram-daily-summary`, `/telegram-m6-check`, `/telegram-card-preview` e histórico exigem `ADMIN_TOKEN`. Sem Secret, acesso negado. Correção desta revisão: as rotas deixam de aceitar `?token=` e passam a exigir exclusivamente `X-Admin-Token`. Atualizar scripts privados antigos que ainda usem URL. Cron interno permanece funcionando sem HTTP administrativo.
- **Saúde interna e métricas:** `/source-health` exige cabeçalho administrativo; `/kv-usage` usa credencial de leitura separada. Histórico não deve conter valores de credenciais.
- **Proxy público:** exige HTTPS e hostname na lista explícita. Rejeições de destinos privados e domínios fora da lista são testadas sem rede. Não é proxy arbitrário. A auditoria de redirecionamentos e de todas as rotas de fetch continua aberta: validar só o destino inicial não comprova toda a cadeia.
- **Cabeçalhos do backend:** adicionados `X-Content-Type-Options: nosniff` e `Referrer-Policy: no-referrer` às respostas do helper HTTP. Isso cobre apenas respostas que usam esse helper, não todos os módulos ou o HTML estático.
- **Busca limitada de credenciais:** padrões de token Telegram/GitHub, access key AWS e blocos de chave privada não retornaram ocorrências nos arquivos de texto rastreados até 2 MB. Não cobre outros formatos, arquivos maiores, valores ofuscados, artifacts ou histórico.
- **Secrets:** arquivos Wrangler contêm bindings/IDs, não valores de token nos trechos revisados. IDs de namespace não são credenciais. A API GitHub Secrets devolveu 403: não foi possível listar ou escrever Secrets pela integração. A verificação em workflow informa apenas presença/ausência.
- **GitHub Actions:** os workflows de disponibilidade e auditorias usam `contents: read`; disponibilidade usa também `actions: read` para recuperar estado. Publicação do Android mantém seu ambiente próprio. Não foram ampliadas permissões.
- **Saídas HTML:** há uso de `textContent` em detalhes de eventos e escape no painel de logs; isso não comprova todos os `innerHTML` da aplicação. Revisão de sinks continua pendente, especialmente nomes de localidades, mensagens de fornecedores e links externos.

## Investigação pendente, em ordem

1. **Abuso de recursos públicos:** inventariar limites por rota (imagem, voz, tradução e população), concorrência e rate limiting. Quotas internas reduzem consumo, mas não substituem proteção contra abuso nem orçamento financeiro. Não bloquear origens apenas por CORS: não é autenticação.
2. **SSRF/redirecionamentos:** cobrir saltos, portas, userinfo, limites de corpo e timeout em todos os coletores/proxy. Usar testes de destinos simulados; não atacar hosts reais.
3. **XSS:** rastrear cada entrada externa até HTML/URLs, substituir interpolação por DOM seguro ou escape apropriado. Testar payloads em nomes, descrições e parâmetros, preservando formatação legítima.
4. **Hospedagem:** verificar cabeçalhos do HTML estático e exposição dos diretórios de tooling. Implantar CSP primeiro em modo de relatório em hospedagem que o suporte; mapear tiles, fontes, workers/blob e scripts antes de bloquear para não quebrar o mapa. Não foi imposta CSP global sem inventário.
5. **Permissões da conta:** revisar escopo dos tokens Cloudflare/GitHub e proteções de branch/ambientes com acesso do dono. Valores de credenciais não devem ser enviados na conversa ou versionados. Se houver evidência de exposição, revogar/rotacionar no provedor; remover do commit sozinho não resolve.
6. **Dependências e histórico:** atualizar inventário de bibliotecas vendorizadas (inclusive MapLibre) e examinar histórico Git com scanner dedicado. Esta revisão não afirma ausência de segredos no histórico ou de vulnerabilidades em dependências.

## Verificação reproduzível

`MONITOR_TEST_OFFLINE=1 NODE_OPTIONS="--require ./tools/test-network-guard.cjs" node --test tests/unit/admin-security.test.mjs`

`npm run worker:test` e `python3 -m unittest discover -s tests/unit -p test_uptime_monitor.py` validam também as proteções de entrega existentes. Todos os envios dos testes são simulados.
