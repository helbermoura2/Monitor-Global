# Celular: comparação antes e depois dos seis itens — 17/10/2026

Base: `6cfd790`. Três contextos novos por etapa, Chromium local, viewport 390×844,
DPR 3 e CPU limitada a 4×. Catálogo sintético fixo de 800 registros: 600 sismos M6+
em seis regiões e 200 avisos de vento. Câmera em zoom 2. Os dados completos ficam
na memória; o agrupamento representa regiões próximas, não descarta eventos.

Fontes e tiles externos são bloqueados para repetir o cenário. Isto não mede
rede de celular, carregamento de imagens de satélite, GPU de um aparelho real ou
uso durante horas. Tempos abaixo são medianas; não extrapolar para todo celular.

| Medida | Antes | Após 1–3 | Após 1–6 |
| --- | ---: | ---: | ---: |
| Cartões iniciais | 120 | 30 | 30 |
| Marcadores/grupos criados no DOM | 800 | 12 | 12 |
| Elementos no documento | 4241 | 1702 | 1703 |
| Primeira montagem de lista + marcadores | 745.6 ms | 236.8 ms | 221.7 ms |
| DOMContentLoaded | 2195.5 ms | 2326.8 ms | 2047.9 ms |
| Heap V8 principal após coleta | 22.02 MiB | 21.05 MiB | 20.97 MiB |
| Atualizações repetidas (15 amostras por etapa) | 39.9 ms | 10.3 ms | 8.1 ms |
| Bytes JS/CSS descomprimidos | 3322296 | 3314946 | 3316241 |
| Limite de partículas de um efeito de 300 em aparelho fraco | 210 | 210 | 135 |
| Verificações da cena escondida em 5 s simulados | 53 | 53 | 1 |

## O que os números permitem concluir

- Montagem: aproximadamente 70% menos tempo; atualizações repetidas: 80% menos.
- Marcadores/grupos: 800 → 12 neste catálogo concentrado; cartões: 120 → 30.
- Elementos HTML: aproximadamente 60% menos. Heap principal: cerca de 3% menos;
  a medida não inclui workers, buffers gráficos, vídeo ou toda a RAM do navegador.
- JS/CSS iniciais: apenas 6.055 bytes líquidos a menos (0.18%). O carregamento frio
  permaneceu perto de 2,2 s, sem ganho conclusivo. O maior ganho desta rodada está
  na renderização. Não afirmar que o site inteiro abre 67% ou 79% mais rápido.
- Cache: em teste real de service worker, duas solicitações do mesmo arquivo
  resultaram em duas chamadas de fetch à rede antes e uma depois. Isso não prova
  redução de 50% em todo o tráfego; dados ao vivo e arquivos novos continuam na rede.

## Implementação

1. Código/CSS do menu de testes de efeitos só carrega ao abrir; clique repetido
   compartilha o carregamento, e cancelamento impede iniciar uma demonstração tardia.
   Compartilhamento de imagens e administração já carregavam sob demanda.
2. Grupos por tipo e célula espacial no celular em zoom inferior a 5. Evento
   selecionado e avisos de tsunami permanecem individuais. Ao aproximar, os pontos
   reaparecem. A contagem do grupo permite aproximar; um deslocamento visual evita
   que o pin selecionado cubra o botão do grupo. Desktop conserva sua política.
3. Lotes de 30 cartões no celular, carregados ao rolar ou pelo botão acessível;
   todos os registros permanecem disponíveis. Mudanças nos filtros reiniciam o lote.
4. Aparelhos que informam até 2 GB ou 2 núcleos começam na qualidade leve;
   celulares restantes conservam o nível equilibrado e o ajuste adaptativo existente.
5. Cache local para JS/CSS com versão, limitado a 240 arquivos. HTML do aplicativo
   usa rede primeiro e mantém a cópia canônica para fallback. Nenhum cache de dados
   ao vivo é adicionado. Não altera KV ou o Worker do servidor.
6. Cenas fora da vista aguardam observadores, pausam o vídeo e preservam o término
   por relógio. Expansão retoma a cena; aba oculta cancela frames e o timer das estrelas.

## Verificação e reprodução

69 testes unitários passaram. Os percursos do globo passaram em 390 e 1280 px;
testes adicionais cobrem seleção e expansão de grupos, todos os lotes da lista,
mudança de filtros, cancelamento de carga, pausa/retomada/expiração, cache no navegador
e preservação das cenas de lava, chuva e M8+ pelo menu móvel.

Com um servidor local na porta 4173:

```sh
node tools/mobile-catalog-audit.cjs
node tools/mobile-hidden-scene-audit.cjs
```

O segundo roteiro usa relógio simulado e desliga o render do mapa para isolar as
verificações do cartão escondido. Não mede consumo físico de bateria. Os JSON das
três etapas e das verificações estão em [mobile-performance-data](mobile-performance-data/).
