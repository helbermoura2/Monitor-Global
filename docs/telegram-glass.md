# Telegram: vidro panorâmico

O layout `telegram-glass-v19` aplica vidro fosco sobre os pixels do mapa real, mantém as coordenadas do epicentro e remove a régua cartográfica. Bandeira nacional vem do atlas nacional existente; UF brasileira vem dos SVGs oficiais locais rasterizados com librsvg. A UF é obtida do município do epicentro, não de uma cidade próxima. Estados só aparecem para eventos brasileiros.

Tsunami aparece somente com warning/watch/advisory atual associado ao evento. Sem aviso, sem bloco vazio. O PNG original guarda a faixa cartográfica sob esse bloco em um chunk auxiliar comprimido: revisões restauram esses pixels antes de desenhar o novo aviso. Cancelamento remove o bloco, sem recarregar ou substituir o mapa oficial durante falhas do provedor. Versões antigas continuam com seus caminhos de edição anteriores.

Amostras de teste são locais, marcadas SIMULAÇÃO, sem envio ao Telegram. A atualização usa a rotina existente de envio/edição e seus limites, sem reenviar o histórico.
