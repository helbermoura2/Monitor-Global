# Qualidade dos cartões sísmicos

Telegram e Story usam 1080 × 1920 pixels. O mapa e as legendas são solicitados na resolução final; a tipografia Inter é renderizada por atlas próprios de alta resolução no Worker e pela fonte original no navegador. A projeção, a posição real do epicentro e os dados científicos continuam compartilhados.

O Telegram comprime fotos. Cada foto enviada pelo Worker recebe também o botão **Baixar imagem original em Full HD**, que entrega o PNG original, sem a compressão do Telegram. Revisões substituem o arquivo no mesmo endereço e editam a mensagem existente.

O arquivo fica disponível por 72 horas após sua última atualização. O armazenamento limita-se a 64 imagens de até 6 MiB, em blocos de 64 KiB no Durable Object. A leitura é serializada com as atualizações. O endereço público permite apenas GET e HEAD; não permite renderizações, listagem ou escrita. Falhas no arquivamento não impedem o envio do alerta.

Validação: renderização real de uma amostra em 1080 × 1920, testes de conservação dos bytes, atualização do mesmo link, expiração e limites; integração com Telegram inteiramente simulada.

O resumo diário tem arquivo próprio em 1800 px de largura, com altura variável (mínimo 2688 px), entregue pelo botão “Baixar resumo original em alta resolução”. A expiração por alarme elimina os blocos após 72 h no Durable Object do dia e conserva o histórico de envio. Esse recurso exige o Worker atualizado.
