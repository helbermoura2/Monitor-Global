# Identidade das imagens sísmicas e de tsunami — editorial-v17

Cabeçalho com radar azul do projeto e nome MONITOR GLOBAL em Rajdhani Bold. Dados e legendas em JetBrains Mono 600/800, usando os mesmos arquivos de fonte locais já presentes no aplicativo. O status AO VIVO/ATUALIZADO/TESTE passa a ser texto sem caixa de fundo. O rodapé mantém o endereço do site e acrescenta @monitor_global em azul.

O layout compartilhado atende ao Telegram e à exportação pelo site; o boletim dedicado de tsunami usa o mesmo cabeçalho/rodapé e tipografia. Resumo diário conserva suas fontes anteriores. Não há alteração de fórmulas, coordenadas, população ou classificação de tsunami por esta mudança visual.

O Worker incorpora atlas gerados offline por tools/build-quake-hd-fonts.py; não consulta serviços de fontes para gerar imagens. O navegador carrega os TTF locais somente ao exportar, com prazo de espera limitado e fonte de reserva. Licenças e origem em assets/summary-fonts/README.md.

O saneamento do novo atlas preserva literalmente @ e sublinhado do canal; as fontes antigas do resumo diário mantêm seu tratamento próprio. A referência de pixels do cartão sísmico foi atualizada após inspeção da prévia, preservando as referências do resumo diário.

A versão v17 invalida o cache da renderização anterior e entra na rotina existente de atualização dos registros elegíveis, com a mesma janela/limites, editando a mensagem já enviada em vez de criar novo alerta por identidade visual. Não força atualização de todo o histórico. Em falha de ShakeMap, mantém a proteção do mapa arquivado; imagens v16 ainda recebem a atualização do bloco de tsunami na posição moderna, e v15 preserva sua posição legada.

Validação: prévia marcada como teste com consultas externas bloqueadas; contratos de campos/limites, patch restrito à região do boletim, migração v16/v17 e exclusão de registros históricos; teste de compartilhamento confirma as duas fontes carregadas e o canal literal. Sem mensagem de teste real ao Telegram.
