# Resumo e replay do dia anterior · 1.0.17

O vídeo de 27/10 às 02h mostrou o replay do parcial de 27/10. O botão repetia a última lista exibida; consultar o parcial substituía o único resumo salvo. Isso não correspondia ao resumo diário completo que o proprietário esperava recuperar.

Agora há três opções explícitas:

- **Resumo de ontem · dia completo**: consulta até cinco maiores eventos do último dia encerrado, segundo o horário de Brasília.
- **Maiores de hoje · parcial até agora**: consulta o dia atual, sem substituir o replay completo.
- **Replay · Resumo de ontem completo**: usa a cópia local completa do dia anterior. Se ela não existir, busca o catálogo `view=completed`. Nunca usa o parcial de hoje nem um resumo de outro dia como substituto. Sem internet e sem cópia correspondente, informa indisponibilidade.

O resumo completo passa a ter um registro local separado, limitado aos mesmos cinco eventos e 64 kB. Na migração, o registro antigo só é reutilizado se for completo e corresponder ao dia anterior. Às 02h de 27/10, o resumo e o replay completo mostram 26/10 (00h a 23h59 de Brasília), independentemente do fuso configurado na TV.

O resumo automático à meia-noite mantém a regra anterior: dia encerrado, prioridade dos alertas reais e confirmação de entrega após a apresentação completa. Mapas de satélite, duração e animações permanecem iguais. Nenhum aviso real ou mensagem ao Telegram é enviado pela validação.

Validação: compilação release, lint e testes JVM, incluindo o caso do vídeo (27/10 às 02h), rejeição de parcial, rejeição de outro dia, fuso do aparelho e virada exata à meia-noite de Brasília. A aparência na TV física ainda será conferida após atualizar.
