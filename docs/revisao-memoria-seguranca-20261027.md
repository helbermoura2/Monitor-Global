# Memória e segurança — revisão de 27/10/2026

Escopo: site, Worker público, cadeia de atualização e ciclo de recursos do aplicativo TV 1.0.15. Testes locais com fornecedores e Telegram simulados/bloqueados. Não foram enviados avisos, consultados valores de Secrets, mudadas permissões ou planos. Não é certificação de segurança nem medição de RAM total dos aparelhos.

## Memória: reservatório de texturas fora do contador anterior

O MapLibre 5.13 mantinha `painter._tileTextures`, separado dos tiles ativos e do cache de tiles. `saveTileTexture` somente acrescentava texturas para reutilização, sem limite próprio de quantidade/bytes. O pico de texturas devolvidas podia ficar retido depois da passagem do globo. Os contadores anteriores não incluíam esse reservatório.

`MapRenderBudget.attach` agora limita **apenas as texturas sobressalentes** a uma estimativa RGBA+mipmaps de 8 MiB no perfil móvel/economia ou 16 MiB no desktop, e no máximo 32 texturas. Não remove texturas em uso nem tiles mantidos pelo cache nativo. O limite é aplicado ao devolver uma textura, sem trabalho periódico em cada frame. Ao ocultar/sair da página o reservatório é esvaziado; a reutilização continua funcionando ao retornar. A forma interna do renderizador é verificada antes de instalar o adaptador. Uma atualização futura do MapLibre deve repetir o teste nativo.

Também são liberados na saída os caches opcionais de geometria sísmica e grades oficiais; cancelamentos tardios não podem repovoar o cache de grades. O diagnóstico `session-stability-v11` inclui quantidade de texturas ociosas, estimativa de bytes, limite e descartes. Não exporta nomes/locais/URLs.

### Evidência isolada com WebGL real

O ensaio cria 40 texturas RGBA reais de 512×512 no renderizador instalado. Compara a função original do protótipo com o adaptador limitado na mesma instância. Não representa a quantidade de tiles observada no celular do dono.

| Situação | Texturas ociosas | Estimativa RGBA+mipmaps |
| --- | ---: | ---: |
| Função original | 40 | 53,33 MiB |
| Com limite móvel | 5 | 6,67 MiB |
| Após saída | 0 | 0 |

A textura ativa permaneceu válida no WebGL e a posição/zoom da câmera permaneceu idêntica. [Resultado com hashes](audits/native-spare-textures-20261027.json). Estimativas não equivalem à RAM do processo nem a uma leitura da memória física da GPU. Esta correção não atribui retrospectivamente todos os 700+ MiB dos relatórios antigos a esse reservatório.

### Ensaio contínuo local

[Ensaio de 304 segundos](audits/session-v11-soak-20261027.json), 22 trocas entre sismos, tempestade, vulcão, vento e enchente; CPU 4×, viewport 411×806/DPR 2,625, câmera nativa e imagens de tiles locais, com duas falhas HTTP 503 injetadas. Terminou sem erros JavaScript; após encerrar efeitos, heap principal de 27,61 MiB e dois canvases. O máximo amostrado do reservatório ocioso ficou em 2,00 MiB estimados. As URLs/nós de áudio transitórios foram liberados.

É uma verificação de cinco minutos com tráfego externo bloqueado, não uma sessão de horas nem medição de GPU/workers/RAM total de um DeX ou celular. Os hashes registram os scripts exercitados. O teste separado de WebGL força o reservatório até além do teto, enquanto este ensaio verifica alternância real de cenas e recursos na aplicação.

## Segurança: correções confirmadas

- **Proxy e redirecionamentos:** cada salto exige HTTPS, hostname da lista, ausência de usuário/senha e porta não padrão. Limite de três saltos. Redirecionamentos para loopback, metadados, domínios externos ou HTTP são recusados antes da segunda requisição. Retirada da lista a ponte pública `api.allorigins.win`, que permitiria contornar a lista com outro proxy. O fallback direto preexistente do frontend não foi reconfigurado.
- **Corpo das respostas:** leitura do proxy limitada a 3 MiB de bytes efetivamente recebidos, mesmo sem Content-Length ou com tamanho declarado falso. O prazo de 15 segundos cobre a cadeia e a leitura do corpo. Fluxos excessivos ou parados são cancelados.
- **Conteúdo remoto inerte:** HTML de catálogos oficiais continua disponível para leitura e parsing, servido como texto simples. Respostas do proxy recebem CSP com sandbox/default-src none, nosniff, no-referrer e bloqueio de enquadramento. Isso não impede o frontend de consultar os catálogos.
- **Entradas de tradução:** limite de 40 kB durante a leitura, prazo de 10 segundos e validação anterior de até seis textos/20 mil caracteres preservada. Corpos chunked grandes não são carregados por inteiro antes da recusa.
- **XSS no cartão:** bandeira textual, intensidade do vento e aviso de enchente deixam de interpolar HTML externo. O histórico de voz também escapa os textos recebidos; a probabilidade diária da previsão exige número válido. A direção do ciclone usa texto DOM e reutiliza uma única linha nas atualizações (100 atualizações no teste mantiveram uma linha). Os textos legítimos e as bandeiras estaduais geradas pelo código mantêm o formato. Testados valores com imagem/onerror sem execução.
- **HTML do site:** política básica `object-src 'none'; base-uri 'self'` e política explícita de referência. Não foi imposto bloqueio de scripts/tiles/fontes sem inventário que preservasse o mapa.
- **Ferramentas npm:** auditoria inicial apontou três entradas (duas altas e uma moderada) em dependências de desenvolvimento: `compression`/`serve` e `fast-uri`. Atualização para `compression 1.8.2` e `fast-uri 3.1.9`; nova auditoria com zero ocorrências no catálogo consultado. São ferramentas de servidor local/testes, não o JavaScript de produção nem o MapLibre vendorizado.

## Aplicativo e permissões verificadas no código

O app mantém serviço/provider/receiver não exportados; só a atividade inicial é exportada. O provider concede leitura temporária de um único arquivo, sem escrita ou caminho arbitrário. A atualização recusa redirecionamentos, arquivos acima de 8 MiB, hash divergente, pacote/versão indevidos, build de depuração e certificado diferente do publicador. O instalador continua exigindo confirmação do dono.

A publicação oficial permanece manual em `main`, restrita ao repositório e ao ator proprietário, com ambiente de assinatura separado. Builds de PR não recebem os Secrets de assinatura. Cinco testes Python de proteção/distribuição e a verificação do APK/certificado nos SDKs 28/30/34/35 passaram nesta revisão. Nenhuma mudança do aplicativo foi necessária; o APK permanece 1.0.15.

Memória do app: fila de avisos limitada a oito, histórico de deduplicação a 256 registros/72 h, resumo a cinco registros/64 kB, feed a 256 KiB. O mapa prepara no máximo os mapas da tarja atual, usa base compacta compartilhada e encerra executor/callbacks/desenhos na remoção da faixa. Isto é revisão de limites e ciclo de vida, não medição prolongada de heap/GPU da TCL/Fire Stick.

## Limites da revisão e próximos passos concretos

1. **Contas/branch:** a consulta da proteção de `main` retornou HTTP 403 (`Resource not accessible by integration`). Não foi possível confirmar proteções efetivas, todos os colaboradores ou escopos dos tokens privados. As regras presentes nos workflows foram verificadas; isso não substitui a revisão no painel.
2. **Hospedagem:** a resposta HTML pública estava sem CSP/nosniff/frame/referrer/HSTS em cabeçalhos HTTP na leitura desta revisão. A política meta adicionada cobre objeto/base e referência, mas não substitui os cabeçalhos da hospedagem, especialmente frame-ancestors/HSTS. A escolha do ponto de configuração depende de confirmar o caminho ativo entre Cloudflare `monitor`, Pages e o domínio; não foram alterados DNS nem configurações de conta.
3. **Credenciais:** busca de padrões comuns em 1.244 arquivos de texto rastreados até 3 MB não encontrou token Telegram/GitHub, access key AWS ou chave privada. Foram excluídos 305 binários/arquivos grandes. Não examina todo o histórico Git, credenciais ofuscadas, outros formatos ou conteúdo dos provedores de Secrets. Não é garantia de ausência de segredos.
4. **Abuso/custos:** voz, tradução, Rainbow e população possuem proteções próprias já documentadas; não foi instalada uma limitação global por usuário/IP. CORS não é autenticação. Auditoria de billing e alertas de orçamento permanece separada.
5. **Memória física:** os limites e mecanismos corrigidos têm provas reproduzíveis. O diagnóstico antigo não mede GPU nem tem os novos contadores. Ainda não há evidência de horas do runtime v11 nos aparelhos; não se declara ausência universal de vazamentos nem se pede outra maratona cega para comprovar esta correção.

### Verificação reproduzível

```
node --test tests/unit/map-spare-textures.test.cjs tests/unit/proxy-security.test.mjs tests/unit/admin-security.test.mjs tests/unit/rupture-shaking-client.test.cjs tests/unit/event-products-budget.test.cjs tests/unit/aftershock-sequence-memory.test.cjs
CHROMIUM_PATH=/usr/bin/chromium npx playwright test tests/memory-security.spec.js tests/local-performance-diagnostics.spec.js tests/event-insights.spec.js tests/sequence-warning-regression.spec.js --workers=2
npm run worker:test
npm audit
```

O teste legado isolado `seismic-impact-cadence.test.cjs` já falha no commit base `f2ff15d`: seu ambiente não fornece `SeismicContourLabels.create` e a expectativa de contagem não é satisfeita. Foi reproduzido separadamente com a fonte do commit base. As regras de câmera/contornos não foram alteradas para contornar esse teste. As regressões nativas de apresentação/contornos e as novas verificações são executadas pelo workflow existente.

O teste legado `rain-header.spec.js` também falha no código base: espera `Prev.`/`3,0mm` no indicador hoje destinado à estimativa Rainbow por minuto. Foi repetido com o HTML e todos os scripts alterados substituídos pelas versões de `f2ff15d`; o mesmo resultado foi observado. A política aprovada de chuva não foi revertida nem sua asserção removida. As regressões vigentes de Rainbow continuam no workflow de meteorologia.
