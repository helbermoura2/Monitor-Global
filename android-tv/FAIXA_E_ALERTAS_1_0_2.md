# Faixa e demonstrações — 1.0.2

Mantém largura, altura (126 dp), duração e velocidade do rodapé da versão 1.0.1. O radar gira a cada 2,4 s, como no site. O bloco de magnitude fica vermelho e os números brancos têm um pulso discreto de opacidade (215–255, período de 2 s), sem apagar ou produzir flashes. Animações obedecem à opção do Android e param ao remover a faixa.

A bandeira vem depois da localização (depois de EXEMPLO nos testes). É a imagem do país/região explicitamente nomeado, incorporada a partir dos arquivos do site. Sem identificação inequívoca não há bandeira; não se atribui uma costa a um epicentro por proximidade e não se herda a bandeira do sismo em um boletim regional de tsunami. Horários agora são explicitamente BRT, independentemente do fuso configurado no Fire Stick.

## Sismo, revisão e tsunami

Apenas uma faixa fica visível por vez. Quando o mesmo lote contiver um sismo e um boletim associado, o sismo entra antes do respectivo boletim. O sismo informa a presença de aviso regional no cabeçalho e detalha a associação no rodapé. O boletim próprio mostra estado, regiões e autoridade, mesmo quando não há sismo associado. Boletins posteriores chegam como avisos próprios; não precisam esperar um novo sismo.

A associação exige um boletim oficial, origem temporal e geográfica compatível e resultado inequívoco nas regras compartilhadas de TsunamiLink. Relações apenas prováveis, polígonos de área de aviso e falha da fonte não acrescentam a indicação ao sismo. A indicação não participa da versão sísmica: uma mudança no boletim não é anunciada como revisão de magnitude.

A revisão conserva a magnitude anterior no estado local persistido e mostra, por exemplo, M7,2 → M6,9. Revisões que não alteram a magnitude são identificadas como dados revisados. Se um registro antigo não permitir recuperar o valor anterior, ele não é inventado. O horário fixo é o da origem sísmica; o rodapé distingue o da atualização. O serviço agrega somente a versão mais recente de um mesmo ID ainda aguardando na fila.

Aviso, vigilância, atenção, sem ameaça, encerramento e informativo têm rótulos próprios. Sem ameaça e encerramento sempre se limitam às costas citadas; um produto não encerra outro. O bloco TSUNAMI é vermelho para aviso, âmbar para vigilância/atenção e discreto para estados sem aviso ativo; não pulsa.

## Testes na TV

Use Verificar atualização oficial e confirme a instalação. Botões locais, sempre identificados como fictícios:

- 3: sismo com indicação de tsunami.
- 4: revisão M7,2 → M6,9.
- 5: aviso de tsunami.
- 6: encerramento regional de tsunami.
- 7: sequência completa em quatro faixas, começando após 10 s, com a duração escolhida e 1 s entre faixas.

Um novo teste cancela os testes pendentes. Um alerta real recebido cancela a sequência fictícia pendente e tem preferência. Nenhuma demonstração é escrita na base de eventos vistos nem enviada ao servidor ou Telegram.

Validação: build e lint debug/release; testes Java de revisão/restauração, confiança e identidade das demonstrações; testes do feed de associação inequívoca, ambiguidade, origem ausente, fonte indisponível e preservação de outro produto regional. Teste visual físico continua dependente do aparelho. A equivalência completa da seleção de sismos com Telegram/Brasil permanece fora desta versão.
