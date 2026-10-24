# Mapa dos arquivos — Monitor Global

Para mexer com segurança pelo GitHub, comece pelo [Guia do dono](GUIA_DO_DONO.md). Os caminhos abaixo correspondem à organização atual; não renomeie arquivos sem atualizar quem os utiliza.

| Caminho | Para que serve |
| --- | --- |
| `index.html` | Monta a página e carrega os estilos e scripts. |
| `css/` | Define cores, fontes, tamanhos e aparência no celular e desktop. |
| `js/` | Faz mapa, cartões, eventos, efeitos e controles funcionarem no navegador. |
| `data/` | Guarda dados publicados por automações; não é o lugar para editar o visual. |
| `assets/`, `img/`, `media/` | Guardam bandeiras, imagens, fontes, geografia e mídias. |
| `monitor-global-worker-7_7_0.js` | Entrada do backend: rotas e coordenação de serviços na Cloudflare. |
| `worker/` e módulos `.mjs` na raiz | Separam coleta de dados, Telegram, imagens e cálculos do backend. |
| `wrangler.toml` | Configura o Worker de serviços, KV e Durable Objects. Não contém os valores dos Secrets. |
| `wrangler-monitor.toml` | Configura os recursos estáticos do site na Cloudflare. |
| `.github/workflows/` | Define tarefas automáticas, auditorias e testes no GitHub Actions. |
| `tools/` | Guarda ferramentas de manutenção, coleta e empacotamento. |
| `tests/` | Verifica comportamento usando cenários e dados de teste. |
| `docs/` | Explica recursos, decisões e limitações técnicas. |
| `downloads/` | Guarda pacotes preparados para distribuição; não deve ser editado manualmente. |

## Onde procurar cada mudança

| Quero mexer em… | Comece por… |
| --- | --- |
| Apresentação e instruções do repositório | `README.md`, `GUIA_DO_DONO.md` |
| Cartão principal e lista de eventos | `js/painel-e-lista.js`, `js/adaptive-panel.js`, estilos correspondentes em `css/` |
| Mapa e movimento da câmera | `js/mapa.js`, `js/event-camera.js`, `js/seismic-focus.js`, `js/seismic-paint-tour.js` |
| Anéis de intensidade e seus rótulos | `js/seismic-impact.js`, `js/seismic-contours-model.js`, `js/seismic-contour-labels.js` |
| Possíveis réplicas e linhas de ligação | `js/aftershock-sequence.js`, `js/aftershock-hub.js`, modelos `js/aftershock-*.js` |
| Efeitos sísmicos e do epicentro | `js/seismic-cinema.js`, `js/seismic-epicenter-detail.js` |
| Busca e união dos sismos | `js/sismo-fontes.js`, `js/orquestrador-feeds.js` |
| Fontes e natureza dos dados | `js/confianca-fontes.js`, `js/ux-panel.js`, `js/shared-source-delivery.js` |
| Alertas do Brasil | `js/brasil-hub.js`, `js/inmet-avisos.js`, `cge-bulletins-worker.mjs`, `tools/update-cemaden-alerts.py` |
| Clima das capitais | `js/capital-weather.js`, `assets/weather/` |
| Ciclones | `js/furacoes-gdacs.js`, `docs/cyclone-route-card.md` |
| Imagens e resumos diários | `daily-summary-hd.mjs`, `daily-summary-renderer.mjs`, `js/story-share.js` |
| Envio e histórico do Telegram | `worker/telegram-transport.mjs`, `worker/telegram-seismic-data.mjs`, `telegram-history-storage.mjs`, entrada do Worker |
| Diagnóstico de uso prolongado | `docs/local-performance-diagnostics.md`, `docs/mobile-endurance-v6.md`, `docs/diagnosticos-dex-celular-20261024.md` |
| Consumo de KV e Durable | `tools/cloudflare-kv-daily-report.py`, `tools/cloudflare-durable-audit.py`, workflows de auditoria |
| Alarme de indisponibilidade | `.github/workflows/uptime-monitor.yml`, `tools/uptime-monitor.py`, [configuração](docs/alarme-disponibilidade.md) |

## Cuidados com publicação

O frontend e o Worker de serviços têm processos próprios. Uma mudança no backend pode exigir empacotamento por `tools/build-worker-bundle.mjs` e o fluxo de manutenção documentado em `docs/cloudflare-worker-maintenance.md`; editar um `.mjs` não garante que o serviço publicado já mudou.

Não execute testes que enviem mensagens reais ao Telegram. Use os cenários isolados descritos em `tests/OFFLINE-TESTS.md`. Não altere dados científicos para obter uma aparência diferente.


## Índice e operação

O [índice da documentação](docs/README.md) separa guias vigentes, investigações e histórico. Consulte também [custos e cotas](docs/custos-e-cotas.md) e a [revisão inicial de segurança](docs/revisao-seguranca-20261024.md).
