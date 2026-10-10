# Chips de tipos de evento no celular

A janela de registros tem seus próprios chips: Todos, Sismos, Tsunamis, Vulcões, Ciclones, Tempestades, Tornados, Incêndios, Enchentes, Vento e Outros alertas. Cada chip mostra a quantidade disponível nos registros elegíveis. A escolha filtra somente a lista da janela aberta e permanece ao fechar e reabrir durante a sessão. Não acrescenta busca, não muda os filtros do mapa e não interfere na seleção, no catálogo ou na prioridade de eventos novos.

Os chips ficam fora da área que rola os cartões. Em retrato se distribuem em linhas; em telas com pouca altura deslizam horizontalmente. Ao trocar de tipo, a lista volta ao início. Fechar a janela ou passar para desktop restaura a lista completa existente. A seleção de um cartão usa a navegação normal e fecha a janela. Não muda configurações de TV/DeX.

Atualizações das fontes mantêm a escolha e atualizam as contagens. Não há novas consultas, observadores de DOM, timers ou filtros persistentes no armazenamento. `tests/mobile-event-chips.spec.js` cobre retrato em duas larguras, paisagem, desktop, atualização dos dados, rolagem, filtro vazio, reabertura e escolha de um boletim de tsunami.
