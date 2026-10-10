# Recursos sob demanda

O mapa, os feeds, a prioridade dos eventos e os motores compartilhados continuam carregando na abertura. Recursos opcionais usam `optional-features.js`, com uma promessa compartilhada por URL e nova tentativa após erro de rede:

- Story e resumo diário: `story-share.js` no primeiro uso. O botão mantém o registro escolhido e a imagem consulta sua revisão mais recente. Um único listener atende os cliques.
- Eleição: somente o chip leve carrega inicialmente. O primeiro clique no desktop carrega o CSS, a interface e seu cliente TSE. O módulo reutiliza o chip, mantém votos/porcentagens e consulta a cada 30 segundos enquanto aberto. Um sismo novo acima de M6 recebido durante o carregamento cancela a abertura pendente. A data de retirada e o limite desktop continuam valendo.
- Vento, tornado, enchente, tsunami e vulcão: renderizador específico ao selecionar o tipo. Os quatro primeiros também carregam seu CSS específico. Tipos não usados não baixam esses módulos.

Na abertura, o HTML passa de 103 scripts e 60 folhas CSS para 97 e 56. Cerca de 143 KiB de código e CSS sem compressão deixam essa etapa inicial; não é uma medida de tráfego comprimido ou do consumo total do site.

Uma cena aguardando recursos guarda a geração do evento e o prazo original de até 16 segundos. Troca de evento, parada ou movimento reduzido invalida essa geração; concluir o download depois não inicia o efeito antigo no novo cartão. Uma falha permite o renderer básico durante o prazo restante e a próxima seleção tenta novamente.

As requisições do cliente TSE usam o fetch original capturado antes do wrapper global que transforma respostas HTTP em exceções, para preservar a interpretação de 404 como apuração ainda não publicada. A verificação criptográfica continua no cliente TSE.

Os testes de recursos opcionais contam downloads na abertura, verificam novas tentativas do Story, reutilização, carregamento por tipo e isolamento de um renderer atrasado. Os testes de Story, eleição e paridade dos efeitos mantêm a verificação funcional. Os testes que examinam renderizadores diretamente carregam explicitamente a dependência da sua fixture.
