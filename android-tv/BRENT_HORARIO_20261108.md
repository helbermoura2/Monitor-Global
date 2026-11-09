# Monitor Global TV — Brent a cada hora (versão 1.0.60)

## Comportamento
- Card financeiro **sobre o vídeo em reprodução**, não na interface interna do aplicativo.
- Duração de **12 segundos**, às **HH:15 de Brasília**, uma exibição por hora, sem áudio e sem capturar botões do controle.
- Acima dos demais conteúdos, **sismos M6+, Brasil, M5 regionais, avisos oficiais de tsunami, replay, resumo diário, chuva e satélite têm prioridade**. Um evento prioritário remove o Brent imediatamente e não é interrompido pelo card.
- Paleta original do Monitor Global: azul-escuro, azul-ciano, valor em destaque e variação verde/vermelha. Exibe **US$/barril**, variação percentual vs. fechamento anterior, carimbo de horário de Brasília e fonte Yahoo Finance.
- O **logo original Radar Scope animado permanece intacto**. Os sons, os thresholds de alertas e o polling sísmico de 30 segundos não mudam.
- Atalho em configuração: **MERCADO FINANCEIRO · BRENT**, interruptor padrão ligado. Teste visual fictício por botão, sempre com selo **TESTE FICTÍCIO** e sem consulta à bolsa.

## Semana e fusos
A regra é baseada nos horários regulares do contrato Brent Futures da **ICE Futures Europe**, conforme https://www.ice.com/products/219/Brent-Crude-Oil-Futures :
- **Sexta após 23:00 Londres até domingo antes de 23:00 Londres: não exibir, não consultar**. Reabre às **23:00 locais de domingo**.
- De segunda a sexta-feira, janela regular de 01:00–23:00 Londres. Não mostrar durante a pausa diária.
- Usa `Europe/London` para mudanças automáticas GMT/BST. Na cidade de São Paulo, o retorno de domingo ocorre às **20:00 BRT (GMT)** ou **19:00 BRT (BST)**.
- A oferta é indicativa: a ICE pode ter feriados, suspensão ou horários excepcionais. Se a fonte sinalizar indisponibilidade ou fechamento, o card não aparece.

## Fonte de mercado e validação
O Worker disponibiliza `GET /tv-brent`, consultando o contrato de futuros de Brent `BZ=F` no Yahoo Finance.
Só publica cotação indicativa com símbolo e moeda exatos, preço na faixa de plausibilidade, carimbo temporal publicado pela fonte e idade máxima de **75 minutos**; não usa o horário da consulta para fingir uma negociação recente.
A variação é calculada do valor real e do fechamento anterior; os números e a identificação da fonte são validados novamente na TV.
Se a informação for antiga, estiver inválida ou a consulta falhar, **não exibir** (nem repetir dados antigos, simular cotação ou apresentar o fechamento como atualização nova).
Os resultados são cacheáveis por 2 minutos e consultas do aparelho ficam limitadas a uma tentativa por janela de 5 minutos em falha; no fim de semana, nenhuma consulta a Yahoo é feita.
O site usa o mesmo símbolo Yahoo e um fallback diário da Stooq; o card TV intencionalmente **não usa fechamento diário da Stooq** como atualização intradiária.

## Infraestrutura
O serviço do Worker é uma rota de leitura pública e sem credenciais. Todos os serviços sísmicos e as credenciais existentes são preservados por deploy seguro.
A distribuição oficial 1.0.60 usa o mesmo mecanismo assinado de atualização **Verificar atualização oficial** já presente no aparelho. Não requer ZIP.
Testes: `tests/unit/tv-brent.test.mjs`, `BrentQuoteTest.java`, renderização nativa `BrentCardViewTest.java` gerando captura PNG como evidência.

## Diagnóstico e recuperação — correção após teste na TV

- O card fictício só testa a apresentação visual. Não confirma a rede, a rota no Cloudflare nem o estado real das negociações.
- **Conferir cotação REAL do Brent agora**: botão na seção Brent, com monitoramento ativo. A consulta começa 10 segundos após o comando, permitindo voltar à programação. Se retornar preço real recente, o mesmo card é exibido sem selo fictício; em caso de erro, nenhum valor é inventado.
- A área **FONTES** passa a apresentar o resultado: mercado fechado/pausa diária, Yahoo indisponível, atualização antiga, falta de sobreposição ou preço real com carimbo de horário.
- O Worker tenta primeiro Yahoo `query1` e, somente em caso de falha ou preço inválido/antigo, o segundo endereço Yahoo `query2`; ambos são o mesmo fornecedor e as verificações de idade, símbolo e moeda são mantidas.
- Se a consulta de HH:15 falhar, a TV continua tentando (no máximo a cada cinco minutos) até HH:59, uma exibição por hora. Não usa fechamentos antigos nem valores simulados.
- Essas mudanças exigem novo deploy seguro do Worker e novo APK oficial assinado da TV; estar na branch de teste não modifica o aparelho instalado.
