# 🌍 Monitor Global

Monitoramento de sismos, vulcões, tsunamis, condições meteorológicas e alertas oficiais, com mapa interativo, visualização de eventos e notificações via Telegram.

**Acesse: [monitorglobal.top](https://monitorglobal.top)**

O projeto reúne dados de diferentes instituições para facilitar o acompanhamento de riscos naturais no Brasil e no mundo. A interface oferece globo/mapa, cartões de eventos, sequências de possíveis réplicas, trajetórias de ciclones e informações meteorológicas de capitais brasileiras e internacionais.

## Funcionalidades

- **Sismos:** consulta a redes como USGS, EMSC e GEOFON, com identificação das fontes, revisões de magnitude e profundidade e informações de intensidade.
- **Possíveis réplicas:** associação estimada de eventos, conexões no mapa e linha do tempo consultável.
- **Tsunamis e vulcões:** apresentação de boletins e atividades reportadas pelas fontes, distinguindo informação de ameaça confirmada.
- **Meteorologia e Brasil:** condições nas capitais, avisos meteorológicos e informações de fontes como INMET, Cemaden e CGE, conforme disponibilidade e cobertura.
- **Ciclones:** posição e trajetória com os dados disponíveis, sem inventar posições previstas ou valores ausentes.
- **Telegram e compartilhamento:** alertas automatizados, resumos e imagens para compartilhar.
- **Celular e desktop:** interface responsiva, orçamento de renderização para aparelhos móveis e diagnóstico de desempenho local e opcional.

A disponibilidade de cada recurso depende das fontes e da configuração dos serviços. O monitoramento é contínuo, mas não garante atualização instantânea ou ausência de interrupções.

## Como interpretar os dados

**O Monitor Global é informativo e não substitui os canais oficiais de emergência.** Para orientações de proteção, acompanhe as autoridades responsáveis pela sua região.

- Dados podem apresentar atrasos, divergências entre redes e revisões posteriores.
- Um boletim informativo de tsunami não significa, por si só, que exista ameaça de tsunami.
- Intensidade estimada, alcance e exposição populacional não equivalem a uma avaliação oficial de danos ou contagem de feridos.
- “Possíveis réplicas” indica uma associação estimada; não é previsão nem classificação oficial.
- Ausência de dados não significa ausência de risco. A interface identifica fontes e limitações para ajudar na interpretação.

## Arquitetura e tecnologias

- **Interface:** HTML, CSS e JavaScript, com mapa/globo em MapLibre GL JS.
- **Cloudflare:** hospedagem de recursos estáticos e Workers para serviços, coleta compartilhada e integrações; KV e Durable Objects conforme a configuração do backend.
- **GitHub Actions:** atualizações agendadas de dados, auditorias e testes.
- **Validação:** Playwright e testes unitários locais, com isolamento de serviços externos nas verificações offline.

O site também depende de fontes externas de dados. Custos e limites variam conforme o plano, o tráfego e as operações utilizadas; a arquitetura não garante custo zero nem disponibilidade ininterrupta.

## Organização do repositório

| Caminho | Conteúdo |
| --- | --- |
| `index.html`, `css/`, `js/` | Interface, mapa, cartões e lógica do navegador |
| `assets/`, `media/` | Recursos visuais, geográficos e mídias |
| `data/` | Arquivos de dados publicados por automações |
| `monitor-global-worker-7_7_0.js` e módulos `.mjs` | Backend e serviços compartilhados |
| `wrangler.toml` | Configuração do Worker de serviços |
| `wrangler-monitor.toml` | Configuração de hospedagem dos recursos estáticos |
| `.github/workflows/` | Automações do GitHub Actions |
| `tests/`, `tools/`, `docs/` | Testes, ferramentas e documentação técnica |

Consulte o [índice da documentação](docs/README.md), com orientações vigentes, investigações abertas e histórico.

Consulte o [Guia do dono](GUIA_DO_DONO.md), com edição e recuperação pelo GitHub, e o [mapa dos arquivos](MAPA_DOS_ARQUIVOS.md).

O [alarme de disponibilidade](docs/alarme-disponibilidade.md) verifica a página inicial pelo GitHub Actions. Os avisos ao Telegram exigem os Secrets próprios descritos no guia; a checagem não atesta a saúde de todas as fontes.

## Executar a interface localmente

Com Node.js e npm instalados:

```sh
npm ci
npx serve . -l 4173
```

Abra `http://localhost:4173`. Servir a interface localmente não cria os serviços da Cloudflare e pode continuar acessando fontes externas. Para validar mudanças sem atingir serviços reais, use os testes e o isolamento de rede existentes no projeto.

## Propor e publicar alterações

1. Crie uma branch e altere os arquivos necessários. Isso também pode ser feito pelo editor do GitHub.
2. Abra um pull request explicando o comportamento esperado.
3. Confira a alteração e execute as verificações apropriadas, sem disparar alertas ou mensagens reais de teste.
4. Após a revisão e integração, acompanhe as builds e confirme o resultado no site. Uma build aprovada, sozinha, não comprova que a versão já está disponível no domínio principal.

Tokens e credenciais devem ficar nos mecanismos de secrets do GitHub/Cloudflare, nunca em arquivos públicos, issues ou exemplos do README.

## Manutenção e licenças

Mantido por [helbermoura2](https://github.com/helbermoura2), com contribuições e assistência de ferramentas de IA.

Este repositório não declara atualmente uma licença geral MIT. Recursos, bibliotecas e dados de terceiros mantêm suas próprias licenças e atribuições, documentadas nos arquivos correspondentes. A publicação do código não substitui essas condições de uso.
