# Imagem sísmica: intensidade local e situação de tsunami

Layout `editorial-v16`, compartilhado entre Telegram (1080 × 1920) e exportação pelo site. Não altera a câmera, os cálculos, as cores científicas ou as geometrias dos contornos.

## Intensidade

O rótulo tem “Intensidade nesta faixa” e “MMI IV · Leve”, por exemplo. O quadro inferior diz “MMI NO EPICENTRO”, com descrição e origem (USGS ou estimativa). Magnitude e intensidade local são grandezas diferentes: um M6,9 pode apresentar faixa IV em terra e intensidade mais alta no epicentro marítimo. Não se inventa faixa vermelha apenas pela magnitude. Pontos de ligação agora são convertidos da resolução física do PNG para a coordenada lógica do layout; isso evita apontar para o local errado.

## Boletim oficial

Um bloco próprio mostra aviso, vigilância, atenção, encerramento, ausência de ameaça explicitamente informada, boletim informativo ou situação não confirmada. Traz fonte, data/hora de emissão em Brasília e regiões citadas quando fornecidas. Os textos longos são limitados à largura da imagem. A imagem orienta consultar os boletins oficiais e as autoridades locais; não é uma ordem de evacuação.

A relação exige origem temporal e geográfica compatível pelas regras existentes de `TsunamiLink`, e não apenas proximidade de uma região costeira ou magnitude alta. Identificador oficial do evento permite reconhecer um encerramento posterior que omita coordenadas. Produtos distintos e autoridades diferentes podem continuar com avisos próprios: um encerramento não apaga o aviso ainda ativo em outro produto.

Boletim informativo, ausência de boletim, falha de consulta e ameaça encerrada são estados diferentes. Uma falha mantém a última informação identificada como tal, com “Atualização indisponível”; não gera um “sem ameaça” artificial. Texto sobre ausência de ameaça em outras regiões não anula um produto ainda classificado como aviso.

## Atualizações no Telegram

O estado entra na versão da imagem e aciona edição da mesma mensagem, com o mesmo ID. O original Full HD é substituído sob o mesmo link (resposta `no-store`). Não se envia uma nova notícia sísmica apenas por mudança no boletim.

Reutiliza o coletor oficial existente e sua memória cacheada. Não cria cron nem Durable Object adicionais. A fila já existente verifica até três imagens por rodada: primeiro intervalo de um minuto para M5,5+ na primeira hora, depois cinco minutos, sujeito à execução do cron, fila, rede e Telegram. Imagens recentes são acompanhadas por 24 horas; avisos ativos de tsunami mantêm elegibilidade até 72 horas após o sismo.

Se a grade oficial estiver indisponível, o bloco de tsunami pode ser atualizado diretamente nos pixels do original arquivado, preservando mapa e estatísticas. Não persiste a grade grande no histórico. Se o original também estiver indisponível, a edição fica pendente. O arquivo de originais tem limites próprios de retenção/capacidade.

Downloads, capturas e cópias encaminhadas já salvas não são alterados retroativamente. Uma nova exportação pelo site usa os boletins carregados naquela sessão; resultados antigos são identificados como desatualizados. Nenhum mecanismo garante atualização instantânea ou substitui as autoridades locais.

## Validação isolada

- Testes de associação, produto mais recente, encerramento, ausência de ameaça explícita, fonte indisponível, permanência de outro aviso e estabilidade da versão.
- Fluxo real do Worker com Telegram simulado verifica edição do mesmo ID, ausência de duplicatas e atualização durante falha do ShakeMap.
- Comparação dos pixels comprova que a atualização isolada do bloco não modifica mapa ou estatísticas.
- Layout e exportação no navegador com rede externa bloqueada; referências visuais aprovadas do renderer atualizadas para a mudança intencional.

## Visão regional integrada

O modelo comum `js/tsunami-regional-model.js` distingue aviso, vigilância, atenção, ausência de ameaça, encerramento e informação para cada região citada. O painel reúne os boletins relacionados ao mesmo sismo. O mapa desenha referências cartográficas costeiras por estado; não extrapola ausência de ameaça para costas não citadas, nem transforma um raio textual em inundação. A rotina de passeio visita somente regiões com ameaça. Selecionar um boletim sem ameaça não ativa o material ilustrativo de água, mesmo se outro boletim do mesmo sismo tiver aviso em outra região.

As imagens mostram até dois grupos regionais com autoridade e horário, indicando a consulta aos demais boletins quando houver mais grupos. Avisos distintos da mesma ocorrência não se suprimem na fila por terem severidades diferentes. Um encerramento não apaga outros produtos ativos. Um aviso que desapareça da consulta é retido como última informação, com atualização indisponível, até ser substituído ou sair da janela de boletins; desaparecimento não significa encerramento.

A apresentação distingue a origem sísmica das regiões avaliadas. Registros agregados sem boletim oficial não ativam o material de água nem ganham países “potencialmente afetados” por um raio automático de 2.000 km ou ETA por velocidade constante. Demonstrações visuais continuam explicitamente fictícias. Boletins com trechos até 300 km preservam esse limite textual; o mapa cartográfico não inventa um polígono de inundação a partir dele.


## Composição editorial aprovada

O cabeçalho concentra localização e magnitude. O mapa tem epicentro no centro geométrico da área cartográfica, sem mudar a câmera do site. As legendas ficam junto ao contorno real, com espaço reservado para o minimapa, o epicentro e a escala. A legenda explicativa lista somente os níveis que aparecem no enquadramento; não cria anéis ausentes da grade. As coordenadas dos pontos de legenda são convertidas de pixels nativos para a composição uma única vez.

Horário, fonte, coordenadas e revisão são preservados em linhas próprias. Profundidade, intensidade no epicentro (amostra da grade quando disponível) e energia ficam separados. A imagem explica magnitude versus intensidade, o equivalente energético e MMI III+ para a exposição populacional. Exposição ausente continua indisponível, sem inventar zero; o fallback GeoNames permanece preliminar e parcial.

O bloco regional de tsunami continua no cartão do sismo; a imagem exclusiva de tsunami está fora desta mudança. Atualizações isoladas de boletins usam a posição correspondente à versão arquivada: uma imagem antiga não recebe o bloco na posição do novo layout. Durante uma falha da grade, mantém-se o mapa anterior e adia-se a recomposição completa até recuperar os dados publicados. Downloads e encaminhamentos salvos não se alteram.
