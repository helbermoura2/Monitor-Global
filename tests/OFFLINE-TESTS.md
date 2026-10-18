# Testes sem serviços reais

O Smoke test roda diariamente às 06h de Brasília e também pode ser iniciado manualmente. Ele verifica uma cópia local do site. Não há mais uma etapa de navegação no site publicado ou de consulta à apuração real do TSE.

O Playwright usa um proxy local que rejeita HTTP, túneis HTTPS e WebSockets externos sem abrir conexão com o destino. Somente o servidor local é acessível diretamente. Respostas simuladas com `page.route`/`context.route` continuam funcionando. Não remova essa proteção para fazer um teste passar: acrescente uma fixture local.

As etapas de teste do workflow também carregam `tools/test-network-guard.cjs` no Node, bloqueando `fetch`, `http` e `https` para destinos externos. A instalação de dependências e do navegador ocorre antes, com acesso à rede; ela não executa o site.

Para repetir a proteção do Node localmente:

```sh
MONITOR_TEST_OFFLINE=1 NODE_OPTIONS='--require ./tools/test-network-guard.cjs' npm test
```

Os testes básicos usam um evento simulado, não exigem um registro real. O bloqueio de rede não transforma falhas antigas em sucesso: testes que precisavam de serviços reais precisam receber fixtures explícitas.

Essa configuração pertence aos testes. Ela não altera o site publicado, os alertas, nem os workflows separados de coleta de dados e auditoria de cotas.
