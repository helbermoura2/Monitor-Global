# Replay e alternância — 1.0.3

Mantém 126 dp de altura, largura configurada e velocidade de 32 pixels lógicos por segundo do rodapé. Logo e rodapé permanecem estáveis durante a troca do conteúdo principal. A varredura do radar continua animada.

## Sismo e tsunami na mesma faixa

Quando o serviço identifica um boletim associado ao sismo por ID preciso, a apresentação alterna os dados a cada 8 segundos, com uma dissolução e deslocamento de 3 pixels durante 360 ms. Começa com o alerta recebido: sismo nos casos combinados iniciais; boletim nas atualizações próprias de tsunami. Não deduz associações de textos nem de proximidade.

Uma apresentação combinada dura pelo menos 32 segundos (dois ciclos completos de 8 + 8), mesmo se a duração individual configurada for menor. Alertas sem par continuam respeitando a duração individual. O rodapé não reinicia a rolagem a cada troca. As transições respeitam a opção de animações do Android; com animações desligadas, os dados ainda alternam a cada 8 segundos, sem movimento.

O mesmo lote não repete como nova apresentação um boletim já incorporado ao sismo, mas outros produtos oficiais continuam independentes. Um encerramento ou atualização do episódio que esteja visível substitui a apresentação anterior imediatamente após a consulta que o detecta: não se deixa uma ameaça cancelada alternando até terminar o temporizador.

## Revisão em destaque

A manchete principal mostra M7,2 → M6,9, seguida da localização. O número grande começa identificado como ANTERIOR e passa a ATUAL após 2,4 segundos com a mesma dissolução de 360 ms. Depois permanece atual; não fica voltando para o valor antigo a cada ciclo. Sem animações, já mostra ATUAL. Se não existe valor anterior confirmado, informa dados revisados, sem inventar números.

## Replay

O botão Replay — Rever último alerta real exibe a última apresentação real recebida e apresentada neste aparelho, com seu boletim associado quando disponível. O registro único persiste entre reinícios e atualizações. A gravação é limitada a 24.000 caracteres, com no máximo um acompanhante, sem histórico recursivo.

Demonstrações e replays não sobrescrevem esse registro, não alteram a deduplicação nem enviam mensagens ao servidor ou Telegram. Replay não toca o som de novo. A palavra REPLAY permanece no cabeçalho da marca e no rodapé; o cabeçalho do conteúdo informa a data e hora originais, identificando informação histórica, sem afirmar que a ameaça permanece ativa.

A versão anterior não guardava esse registro: o botão informa que ainda não há alerta real salvo até chegar um novo. Não busca um terremoto antigo para apresentá-lo como aviso recebido. O replay começa após 10 segundos; se já há um alerta real em exibição, aguarda sua conclusão. Um novo alerta real cancela o replay/teste pendente e tem preferência sobre uma demonstração/replay em exibição.

## Conferência na TV

Atualize pelo botão Verificar atualização oficial. Use 3 para a alternância sismo/tsunami; 4 para revisão; 5 e 6 para boletins isolados; 7 para a sequência combinada, revisão e encerramento. Toda demonstração permanece explicitamente fictícia. Para testar o replay com dados reais é necessário receber primeiro um alerta real nesta versão.

Validação: build e lint debug/release, testes de linha do tempo, associação, agregação e substituição de encerramento; cinco testes de serialização/restauração, revisão, registros antigos, dados inválidos e proteção contra recursão; testes existentes de estado dos alertas, confiança e distribuição. Conferência visual física depende do aparelho do proprietário. Não modifica seleção de fontes, Telegram, câmera ou site.
