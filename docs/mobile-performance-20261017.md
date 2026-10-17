# Auditoria de abertura móvel — 17/10/2026

Método: `npx serve -l 4173 .` e `node tools/mobile-performance-audit.cjs`.
Chromium local, viewport 390×844, DPR 3, CPU limitada em 4×, três contextos novos.
Fontes e tiles externos bloqueados para repetir o cenário; não mede rede real,
qualidade de GPU de um telefone, catálogo cheio nem estabilidade durante horas.
Bytes são corpos descomprimidos de scripts e estilos, não tráfego faturado.

| Medida | Antes | Depois |
| --- | ---: | ---: |
| Recursos JS/CSS em cada rodada | 219 | 216 |
| Bytes JS/CSS em cada rodada | 3.463.509 | 3.441.911 |
| DOMContentLoaded, mediana | 2.147 ms | 2.319 ms |
| Bloqueio acima de 50 ms, mediana | 1.335 ms | 1.349 ms |

A redução verificável é de três requisições e 21.598 bytes líquidos. As durações
não demonstram melhora de velocidade; a maior parte do custo continua no restante
da inicialização. Não atribuir variações de heap a correção de vazamento.

O histórico administrativo (código e CSS) e o explorador heliocêntrico agora
carregam ao abrir. O atalho `?admin=1` continua abrindo o login. Cliques simultâneos
compartilham o carregamento, falhas permitem nova tentativa, e a chave permanece
apenas na memória do módulo administrativo. Alertas reais não dependem desses
painéis. Compartilhamento de imagens e efeitos específicos já eram sob demanda.

Próxima medição útil: catálogo representativo e tiles reais em aparelho físico,
com gravação de frames e memória durante navegação. Os números acima não sustentam
promessas sobre fluidez do mapa ou economia de KV.

## Validação

Os quatro testes do carregamento opcional e os dois da administração passaram,
assim como os dois testes unitários do modelo heliocêntrico. Os testes de economia
DeX e preferência móvel passaram. Três casos antigos de `mobile-energy-budget`
falharam também no código-base `19cff4d`, com as mesmas asserções: camada de cinema
não encontrada e fila de eventos ao ocultar a aba. Esses casos continuam pendentes;
não são evidência de validação bem-sucedida da animação/retomada.

O percurso integrado do globo também passou em 390 e 1280 px: abrir o Sistema
Solar pelo menu, calcular os dez astros, fechar, arrastar o globo e persistir a
projeção na recarga. O preparo desse teste agora aguarda a base de países e aplica
as bandeiras aos registros de teste antes de comparar o estado do catálogo, evitando
uma disputa entre identificação geográfica assíncrona e a asserção de preservação.
