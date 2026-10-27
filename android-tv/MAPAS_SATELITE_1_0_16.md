# Mapas de satélite na TV · 1.0.16

Os avisos reais de sismo, replay e cada item do resumo usam a imagem World Imagery da Esri, a mesma fonte do mapa do site. A camada World Boundaries and Places acrescenta referências de localização quando disponível. O epicentro continua na coordenada do evento. A tarja, a alternância de informações e as animações permanecem iguais.

No tsunami, a mesma imagem recebe os contornos das costas citadas pelo boletim. As cores vêm do modelo regional existente; não são calculados novos níveis de risco. O contorno é uma referência geográfica regional, não previsão de inundação ou delimitação exata da costa atingida. Ausência de geometria continua indicada como referência parcial.

O aviso não aguarda a rede: exibe primeiro a referência offline e troca o fundo quando a imagem estiver pronta. Cada mapa usa no máximo seis tiles por camada (satélite e nomes), cada resposta limitada a 512 KiB, sem redirecionamentos, prazo conjunto de seis segundos. O resultado é uma imagem de 620×300 em RGB565, cerca de 0,36 MiB por página; até cinco páginas, cerca de 1,8 MiB de imagens finais. Downloads e reprojeção ocorrem no único executor da tarja. A saída cancela a conexão e as tarefas. Não há WebView, mapa interativo, polling ou novas consultas a Durable Objects. Não há cache persistente ou novas permissões.

Projeção por faixas converte os tiles Mercator para o mesmo enquadramento geográfico dos contornos. Longitudes cruzando a linha de data preservam a posição; áreas polares fora da cobertura ficam com o mapa offline.

Validação: compilação release, lint e testes JVM, incluindo cobertura e limite de tiles, linha de data, conversão Mercator e fallback polar. Fonte de imagens acessada sem disparar alertas reais. Aparência e fluidez no aparelho físico ainda devem ser conferidas após a atualização.
