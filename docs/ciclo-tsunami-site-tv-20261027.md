# Ciclo regional de tsunami — site e TV, 27/10/2026

A validação usa um cenário fictício comum com 15 etapas. Ver [ciclo e regras do aplicativo 1.0.14](../android-tv/CICLO_TSUNAMI_1_0_14.md) e [gerador do cenário](../tools/tsunami-lifecycle-fixtures.mjs).

Além das correções da TV, o site não repete som/notificação nem renova o destaque “novo” quando um boletim apenas muda de ID, corrige a origem ou é republicado sem alterar a situação regional. Mudanças na costa, estado ou categoria prevista continuam reconhecidas. A referência inicial mantém silêncio. O cálculo de assinatura regional é compartilhado com o feed da televisão.

Nos testes, encerrar Vanuatu conserva o aviso de Fiji; “sem ameaça” no Alasca não é segurança global; após “sem ameaça” em Fiji, uma nova escalada oficial é avisada. Uma falha de fonte conserva os últimos registros com indicação de atualização indisponível, sem inventar cancelamento. Recuperação idêntica fica silenciosa; encerramento final continua sendo uma mudança explícita.

A câmera, os anéis de intensidade, as faixas costeiras e a apresentação nativa mantêm seus modelos. Os testes do painel/mapa isolam a seleção do sismo; a suíte de apresentação verifica a alternância nativa separadamente. Há testes de regressão de boletins, navegação, substituição por encerramento, correlação tardia e descarte de efeitos informativos. Nada foi enviado ao Telegram real e isso não simula ondas de tsunami nem substitui boletins oficiais.

O feed informa `tsunamiPolicy: regional-lifecycle-v2` para conferir a publicação. `version` anterior é mantido para APKs já instalados; `semanticVersion` fornece o significado regional independente da associação sísmica ao APK novo. Não há mudança de permissões, nova coleta de telemetria ou novas consultas periódicas.
