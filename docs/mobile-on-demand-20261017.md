# Parte 2 — recursos carregados sob demanda

A abertura pública deixa de baixar JSZip (97.630 bytes) e os cenários sísmicos de teste (11.351 bytes). JSZip passa a carregar quando uma trajetória/cone oficial em KMZ precisa ser lida, nos dois consumidores existentes. Os cenários carregam ao abrir a ferramenta de testes. Pedidos concorrentes compartilham a mesma promessa; falhas de download permitem nova tentativa.

Histórico administrativo, compartilhamento de imagens, apuração TSE, renderizadores específicos e demonstrações de efeitos já tinham carregamento sob demanda. Seus pontos de entrada foram preservados. O mapa, alertas reais e processamento de intensidade continuam disponíveis na abertura.

A redução líquida deve ser aferida pelo instrumento `tools/mobile-performance-audit.cjs`, considerando também o pequeno crescimento do carregador. Bytes são descompactados, não tráfego comprimido. Não se atribui ganho de velocidade a esta redução sem medição comparável de tempo. Quem abrir uma função adiada ainda baixará sua dependência naquele momento.

Testes locais bloqueiam todas as origens externas e service workers. Incluem ausência dos recursos na abertura, carga concorrente única, nova tentativa após falha, leitura de KMZ com linha/polígono e cenários sísmicos no menu. Nenhuma mudança no Worker e nenhuma operação KV são necessárias.

## Resultado medido

Três aberturas locais: **213 recursos JS/CSS, 3,207,585 bytes descompactados**, contra 215 recursos e 3.316.241 bytes antes. Redução líquida de **108,656 bytes (3.28%)** e dois pedidos iniciais. Arquivo bruto: `mobile-performance-data/20261017-on-demand-startup.json`. Onze testes distintos passaram; um bloqueio de aviso offline no teste móvel foi corrigido na preparação do teste e revalidado.
