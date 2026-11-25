# Argos Orbis — auditoria interna e plano de migração de identificadores

**Data:** 25/11/2026  
**Objetivo:** identificar referências técnicas remanescentes a “Monitor Global” nos repositórios acessíveis e deixar uma migração futura executável, sem quebrar instalações, notificações, canais de atualização, serviços ou dados persistentes.

## 1. Escopo e limites da auditoria

Foram identificados sete repositórios na instalação GitHub disponível para a conta:

- `helbermoura2/Monitor-Global` — público, branch `main`, índice de código disponível.
- `helbermoura2/monitor-global-uy` — privado; árvore Git acessível, mas índice de código indisponível.
- `helbermoura2/cena-downloads` — público; árvore Git acessível, sem caminhos com o nome antigo.
- `helbermoura2/cobalt-script` — público, índice de código indisponível.
- `helbermoura2/cobalt-voltar` — privado, índice de código indisponível.
- `helbermoura2/teclado-br` — público, índice de código indisponível.
- `helbermoura2/teclado-br-publico` — público, índice de código indisponível.

No repositório principal, a árvore recursiva retornou **2.451 entradas (2.329 arquivos)**. Foram encontrados **497 arquivos com “monitor-global”/“monitorglobal” no caminho**, incluindo **214 arquivos Java** em caminhos do pacote antigo `top/monitorglobal` (47 no aplicativo móvel e 167 no aplicativo TV). Também há **137 APKs históricos e 137 arquivos SHA-256** com nomes antigos, além de outros artefatos legados.

O repositório `monitor-global-uy` tem 107 caminhos e mantém seis arquivos com nomes antigos: três scripts JavaScript, dois CSS e o Worker legado. O próprio `index.html` ainda apresenta título, descrição e metadados sociais “Monitor Global”.

**Limite importante:** o índice de código só está disponível para o repositório principal. Para os demais repositórios, buscas de código sem resultados não comprovam ausência de referências. `cena-downloads` não tem caminhos antigos na árvore examinada; os outros repositórios sem índice ainda precisam de inspeção de conteúdo antes de qualquer declaração de limpeza completa. Esta auditoria não altera nenhum desses repositórios.

## 2. Inventário do repositório principal

### 2.1 Android TV

Referências técnicas identificadas:

- Namespace Android: `top.monitorglobal.tv`.
- Caminho dos fontes e testes: `android-tv/app/src/**/java/top/monitorglobal/tv/`.
- Nome do projeto Gradle: `MonitorGlobalTV`.
- Ações internas do serviço usam strings como `top.monitorglobal.tv.START`, `STOP`, `WEATHER_NOW`, `REPLAY` e outras.
- User-Agent em clientes de rede usa `MonitorGlobalTV`.
- Configuração do canal oficial aponta para o repositório `helbermoura2/Monitor-Global` e para `https://monitorglobal.top/android-tv/distribution/stable.json`.
- `android-tv/distribution/stable.json` e `android-tv/signing/identity.json` guardam a identidade do canal e o pacote antigo.
- Workflows, scripts de validação, testes, documentação e artefatos de distribuição ainda usam nomes `monitor-global-tv` ou `Monitor Global`.

Identidade instalada que deve ser preservada durante uma migração interna:

- `applicationId`: `top.monitorglobal.tv.preview`.
- Versão estável registrada: `1.0.149`, `versionCode 10149`.
- SHA-256 do certificado: `1e11295641c7701f909a73683eda7b9fefc62504a20730c5785bdfe22e0d5b82`.
- APK registrado: `https://monitorglobal.top/downloads/monitor-global-tv-1.0.149.apk`.
- SHA-256 do APK: `07efda0ea804cae25d1c0787f716c6c35c8cb698446a74f393a49943b7ad476c`.

O namespace Java/Android pode mudar sem mudar o `applicationId`. Essa é a rota indicada para que o APK novo continue atualizando a instalação atual por cima, com a mesma assinatura.

### 2.2 Android móvel

Referências técnicas identificadas:

- Namespace Android: `top.monitorglobal.mobile`.
- Fontes principais, testes e classes de modelo compartilhadas usam `top.monitorglobal.tv`.
- O Gradle ainda chama o projeto de `MonitorGlobalMobile`.
- O atualizador móvel valida explicitamente o pacote `top.monitorglobal.mobile.dev`.
- O arquivo público de configuração Firebase contém um cliente Android registrado para `top.monitorglobal.mobile.dev`.
- O Manifest declara classes completas sob `top.monitorglobal.tv`.
- Workflows, scripts, testes e documentação citam os pacotes antigos.

**Ponto que precisa de confirmação antes da migração:** `android-mobile/app/build.gradle` tem um build type `stable` que herda de `debug` e acrescenta o sufixo `.dev`, enquanto o build type `release` usa o applicationId sem sufixo. O atualizador e a configuração Firebase apontam para `.dev`. Antes de qualquer alteração, deve-se extrair o applicationId do APK estável realmente instalado/publicado e conferir a variante usada no workflow de publicação. Não presumir que o nome da variante é o pacote efetivo.

### 2.3 Notificações móveis — compatibilidade obrigatória

O Worker e o aplicativo usam tópicos FCM históricos:

- `monitor_global_alerts_v1`
- `monitor_global_rain_v1`
- `monitor_global_weather_v1`
- `monitor_global_daily_v1`

Esses nomes não são apenas textos: aparelhos já instalados podem estar inscritos neles. Uma migração não pode simplesmente trocar os nomes no app e no Worker. Estratégia segura:

1. O aplicativo atualizado passa a se inscrever nos tópicos novos e antigos.
2. O Worker envia para os dois conjuntos durante uma janela de transição, com deduplicação para não duplicar avisos no mesmo aparelho.
3. Medir a adoção e manter os tópicos antigos ativos até haver evidência suficiente de migração.
4. Só então retirar os tópicos antigos em uma alteração separada.

### 2.4 Código compartilhado entre celular e TV

O build móvel copia modelos Java da pasta do aplicativo TV, e os dois projetos usam o pacote `top.monitorglobal.tv`. Isso é uma dívida de arquitetura além do nome antigo.

Migração recomendada em três namespaces:

- `br.com.argosorbis.core` — modelos e protocolos realmente compartilhados.
- `br.com.argosorbis.tv` — implementação exclusiva da TV.
- `br.com.argosorbis.mobile` — implementação exclusiva do celular.

A lista de arquivos compartilhados deve ser explicitada e testada antes de mover classes. Não fazer uma substituição global de texto em diretórios: isso pode mover uma classe para o módulo errado e quebrar Manifest, testes, recursos gerados, imports e builds.

### 2.5 Worker, Cloudflare e backend

Identificadores encontrados:

- Arquivo principal legado: `monitor-global-worker-7_7_0.js`.
- `package.json`: nome `monitor-global` e descrição antiga.
- `wrangler-mobile-push.toml`: nome do Worker `monitor-global-mobile-push`.
- O Worker principal configurado em `wrangler.toml` chama-se `black-sky-9ba0` — nome sem a marca antiga, que não precisa ser alterado por estética.
- O arquivo `worker/civil-phone-relay.mjs` já usa prefixo `argos-phone-civil-v1:`, demonstrando que parte dos identificadores internos já foi modernizada.
- Existem referências de repositório, URLs e User-Agents antigos nos clientes Android, testes, scripts, documentação e workflows.

**Não renomear diretamente** nomes de Durable Object, bindings, namespaces KV, classes persistidas, crons, IDs ou recursos Cloudflare. Eles podem representar estado persistente e infraestrutura em produção. Uma eventual mudança precisa de migração formal, com leitura e escrita compatíveis, estratégia de rollback e validação de dados. O nome do Worker e o nome do arquivo-fonte são coisas diferentes: o arquivo pode ser renomeado e o Worker publicado com o mesmo nome operacional.

### 2.6 Site, PWA, automações e identidade

A marca Argos Orbis já aparece em `manifest.webmanifest`, nos recursos de identidade e em partes dos aplicativos. Ainda foram localizados:

- `js/monitor-global-6.js`, `js/monitor-global-70.js`, `js/monitor-global-71.js` e os CSS correspondentes.
- Referências antigas no Worker, `tools/uptime-monitor.py`, testes e scripts.
- Identificadores históricos nos nomes de artefatos e em documentação.
- Referências de domínio e repositório antigos nos canais de atualização e na infraestrutura.

Os scripts/CSS com nomes antigos só devem ser renomeados depois de verificar todos os pontos de carregamento dinâmico, `<script>`, `<link>`, cache service worker, importadores e testes. Um arquivo não usado pode ser arquivado; um arquivo ainda carregado precisa de renomeação coordenada.

### 2.7 Histórico de APKs e checksums

Os 137 APKs históricos e seus 137 checksums não devem ser renomeados ou apagados em lote. São evidência de releases anteriores e podem ter links públicos ou referências em documentação. Manter os nomes antigos como arquivo histórico é aceitável; novas publicações podem adotar nomes `argos-orbis-tv-<versão>.apk` e `argos-orbis-mobile-<versão>.apk`, desde que os manifests, atualizadores e URLs sejam migrados juntos e os links antigos continuem funcionando.

## 3. Repositório adicional: monitor-global-uy

O repositório privado `helbermoura2/monitor-global-uy` é uma segunda base de site/monitoramento e não deve ser ignorado. A árvore contém:

- `index.html` com título, descrição e metadados OG/Twitter ainda como “Monitor Global”.
- `js/monitor-global-6.js`, `js/monitor-global-70.js`, `js/monitor-global-71.js`.
- `css/monitor-global-6.css`, `css/monitor-global-70.css`.
- `monitor-global-worker-7_7_0.js`.
- `wrangler.toml` e `wrangler-monitor.toml`.

O README indica um projeto Next.js/v0, mas a árvore também contém uma aplicação estática e arquivos de Worker. Antes de renomear ou publicar, verificar qual diretório e qual configuração de deploy estão ativos, qual domínio atende o site e se esse repositório é uma edição uruguaia, espelho ou ambiente independente. A marca visível e os nomes dos arquivos podem ser migrados; bindings e infraestrutura não devem ser substituídos sem inventário.

## 4. Repositórios restantes

- `cena-downloads`: a árvore examinada não apresenta caminhos com “Monitor Global” ou “monitorglobal”. Ainda falta busca de conteúdo textual porque o índice de código não está disponível.
- `cobalt-script`, `cobalt-voltar`, `teclado-br`, `teclado-br-publico`: os repositórios aparecem na instalação GitHub, mas o índice de código não está disponível. As buscas sem resultados são inconclusivas. Fazer auditoria por árvore/arquivos ou habilitar indexação antes de afirmar que não há referências.

## 5. O que pode ser renomeado

| Elemento | Recomendação | Condição |
|---|---|---|
| Nome do projeto Gradle `MonitorGlobalTV/Mobile` | Mudar para `ArgosOrbisTV/Mobile` | Baixo risco; conferir scripts e workflows |
| Pacotes/namespace Java `top.monitorglobal.*` | Migrar para `br.com.argosorbis.*` | PR própria, movimentos de arquivos, imports, Manifest, testes e builds |
| Classes compartilhadas em pacote `tv` | Extrair para `br.com.argosorbis.core` | Fazer junto da migração estrutural, com testes de paridade |
| Ações internas Android `top.monitorglobal.tv.*` | Adotar novas ações e aliases compatíveis temporários | Conferir PendingIntents, alarmes, intents e receivers |
| User-Agents `MonitorGlobalTV` | `ArgosOrbisTV` | Baixo risco, manter diagnóstico de versão |
| Nome/descrição do `package.json` | `argos-orbis` / descrição atual | Atualizar scripts de empacotamento e testes |
| Arquivo Worker principal | `argos-orbis-worker.js` | Atualizar wrangler, bundle, workflows e filtros de build; manter o Worker operacional |
| Worker mobile push | `argos-orbis-mobile-push` | Só depois de inventariar deploy, rotas e estado persistente |
| Arquivos JS/CSS do site | Prefixo `argos-orbis-` ou nomes por função | Conferir todos os carregadores e caches antes |
| Nome dos repositórios GitHub | `Argos-Orbis` e eventual `Argos-Orbis-UY` | Última etapa, após atualizar URLs, workflows, atualizadores, releases e links |
| APKs/checksums antigos | Manter como arquivo | Não renomear nem apagar releases históricas |

## 6. O que deve permanecer até existir migração comprovada

1. **applicationId da TV:** `top.monitorglobal.tv.preview`, enquanto for a identidade instalada. O usuário quer atualização por cima do app atual; mudar esse campo cria outro aplicativo Android e não atualiza a instalação existente.
2. **applicationId efetivo do celular:** confirmar o APK publicado/instalado antes de fixar o valor. O canal e Firebase atualmente esperam `top.monitorglobal.mobile.dev`; preservar o pacote efetivo para atualização in-place.
3. **Certificados de assinatura:** manter o certificado atual de cada canal; um APK com outra assinatura não atualiza o instalado.
4. **Tópicos FCM antigos:** manter durante a transição conforme seção 2.3.
5. **Domínio e URLs antigos:** manter `monitorglobal.top` e rotas antigas enquanto atualizadores, downloads, DNS e HTTPS não estiverem comprovadamente migrados. Não apontar o aplicativo para um domínio novo só porque o domínio foi registrado.
6. **Estado Cloudflare:** preservar Worker operacional, Durable Objects, migrations, KV, bindings, crons, secrets e IDs.
7. **Histórico e arquivos antigos:** manter os APKs, checksums, ZIPs, tags e documentos históricos, salvo prova de que são duplicados descartáveis e sem consumidores.

O `applicationId` não é exibido ao público. Preservá-lo não impede que o código, os pacotes Java, o namespace, os nomes de projeto, as telas e os novos APKs sejam Argos Orbis.

## 7. Sequência proposta de execução

### Fase 0 — inventário e segurança
- Conservar o backup estável da TV já criado em `backup/android-tv-stable-1.0.149-2026-11-25`.
- Fazer backup equivalente do canal móvel e registrar versão, package efetivo, certificado, URL e SHA-256.
- Capturar os metadados e os manifests dos APKs efetivamente publicados.
- Completar a auditoria de conteúdo nos seis repositórios sem índice e verificar deploy/domínio do `monitor-global-uy`.

### Fase 1 — migração Android interna, sem mudar identidade instalada
- Criar uma PR exclusiva para namespace/pacotes, separada da PR #776 de meteorologia/satélite.
- Definir os pacotes novos: `br.com.argosorbis.core`, `br.com.argosorbis.tv`, `br.com.argosorbis.mobile`.
- Mover fontes e testes; ajustar imports, Manifest, BuildConfig, providers, receivers, serviços, scripts e workflows.
- Preservar os applicationIds efetivos, certificados, versionamento monotônico, preferências, dados e canais de atualização.
- Manter aliases para ações Android antigas se houver consumidores externos ou PendingIntents persistentes.
- Rodar compilação, lint, testes unitários, Robolectric/nativeMap, validação de assinatura e inspeção de manifest. Smoke integrado apenas na validação final, sem repetições redundantes.
- Produzir APKs oficiais TV e celular com os mesmos IDs e certificados, para atualização in-place pelo mecanismo existente.

### Fase 2 — notificações e backend
- Introduzir tópicos FCM novos com dupla inscrição/envio, deduplicação e período de convivência.
- Renomear arquivos e metadados de Worker sem mudar o Worker operacional nem recursos persistentes.
- Atualizar filtros de CI, ferramentas de bundle, workflows, monitoramento e documentação.
- Testar em fixtures/offline e depois confirmar recebimento real com um aparelho autorizado.

### Fase 3 — sites, domínio e repositórios
- Migrar o `monitor-global-uy` após identificar seu ambiente ativo e função.
- Renomear scripts/CSS somente com dependências verificadas.
- Verificar DNS, HTTPS, redirecionamento, manifesto PWA, links OG, service worker e cache.
- Renomear o repositório principal por último, se ainda for desejado, após atualizar todos os consumidores GitHub e os canais de APK.

### Fase 4 — encerramento
- Manter tabela de aliases antigos e novos, data de desativação e evidência de adoção.
- Atualizar documentação de manutenção e instruções de release.
- Só retirar compatibilidade antiga quando métricas e testes demonstrarem que não há instalações/serviços dependentes.

## 8. Critérios de aceite

- A TV instalada recebe a nova versão pelo botão de atualização do próprio aplicativo, sem desinstalação, sem aplicativo duplicado e sem perda de preferências.
- O celular instalado recebe a nova versão pelo canal atual, sem perda de dados ou de inscrições de notificações.
- Package efetivo e certificado conferidos nos APKs publicados.
- Manifestos, URLs, hashes, versão e assinatura conferidos.
- Nenhum tópico FCM antigo é desativado antes da migração comprovada.
- Nenhum Worker, Durable Object, KV, binding, cron ou Secret é apagado ou recriado por renomeação estética.
- PRs pequenas e separadas; builds e testes registrados; rollback documentado antes de cada release.

## 9. Estado desta auditoria

- Auditoria da árvore do repositório principal: concluída para os caminhos e arquivos identificados.
- Inspeção de arquivos Android, Gradle, Manifest, canal de atualização, configuração Firebase, Workers e wrangler: realizada nos arquivos citados acima.
- Repositório `monitor-global-uy`: árvore e arquivos principais inspecionados; deploy ainda precisa ser confirmado.
- Outros repositórios sem índice: auditoria de conteúdo pendente.
- Nenhum código de produção, APK, manifesto estável, assinatura, Worker, Secret, tópico FCM ou configuração de domínio foi alterado por esta auditoria.
- A PR #776 de movimento visual de nuvens permanece independente; esta documentação não a modifica nem a aprova.
