# Alerta M6+ — ARTE APROVADA, arquivo exato (16/11/2026)

## ATENÇÃO: não substituir a imagem por uma imitação

O proprietário recusou explicitamente a reprodução procedural `telegram-imperial-bronze-v1`, porque o resultado enviado ao Telegram ficou visualmente diferente do PNG aprovado. A partir desta decisão, **o arquivo raster aprovado é a fonte de verdade**, não os comandos de desenho para bordas, relevos ou fontes.

O PNG aprovado foi gerado nesta conversa e chama-se `alerta_sísmico_em_bronze_imperial.png` (1024 × 1536, 2.781.657 bytes, SHA-256 `f6ab82aeee7c405d0d9ce0858040d45d926d000c9b0b4d0c4fb383cbf8bad62f`).

**Arquivo de produção a instalar:** `assets/telegram/m6/imperial-bronze-master.png`. Após instalação, comparar seu SHA-256 com `assets/telegram/m6/imperial-bronze-master.json`.

### O que fica rigorosamente igual
- Moldura grega de meandros brilhantes, bordas e sombras;
- Bronze imperial com textura profunda e cores exatamente como no PNG aprovado;
- Logo completo oficial (olho-radar, `ΠΑΝΟΠΤΗΣ` e `CUSTOS ORBIS`) com o mesmo tamanho e localização;
- Fonte serifada romana, tamanho, sombra, volume e espaçamento de `ARGOS ORBIS`;
- Caixa da localidade com bandeira na extremidade direita do país;
- Caixa única de magnitude à esquerda, **sem duplicação** no mapa;
- Relevo da geografia, círculos concêntricos, rosa dos ventos;
- Ornamentação em bronze do painel inferior, divisórias e rodapé `argosorbis.com.br` / ícone Telegram / `@argosorbis`.

### O que obrigatoriamente precisa ser dinâmico em cada terremoto
O exemplo contém `Tanimbar – região das ilhas, Indonésia`, `M6,7`, `16/11/2026 18:11 BRT`, `10 km`, `GEOFON` e `Intensidade estimada IX`. **Esses campos são exemplos e não podem ser reenviados como se fossem eventos novos.** Para eventos reais M6+ precisam ser substituídos por localidade/país/bandeira, magnitude, epicentro/área no mapa, data/hora BRT, profundidade, fonte, revisão e intensidade de dados verificáveis. O relevo geográfico também deve corresponder às coordenadas do evento, com o tratamento artístico da referência.

A composição pode ser exatamente igual onde o desenho é fixo; a região variável inevitavelmente precisa ser recomposta. Uma imagem congelada da Indonésia não pode ser reaproveitada em um evento do Japão, Chile ou Brasil.

### Estado real e critérios de liberação
**Não confundir com implementação concluída.** Em 16/11/2026 o gerador em produção ainda possui o antigo `js/quake-telegram-bronze.js`, uma aproximação programática que já foi rejeitada. O PNG mestre ainda não existe no GitHub. Antes de mudar produção:
1. Transferir o PNG original **sem redimensionar/regerar** para o caminho acima;
2. Validar SHA-256 e resolução;
3. Implementar composição sobre a arte original, substituindo apenas dados e geografia variáveis, preservando máscara de ornamentos e molduras;
4. Gerar exemplos automáticos de terremotos em países distintos com dados de teste explicitamente identificados;
5. Conferir visualmente lado a lado com o PNG aprovado, inclusive tipografia, luminância/bronze, relevo e alinhamento;
6. Testar cancelamentos/revisões/tsunami, duplicidade, arquivo em alta resolução e envio ao canal;
7. Só então fazer merge/deploy e confirmar mensagem efetivamente recebida no Telegram.

Não publicar o exemplo como alerta sísmico real; para apresentação do design, usar legenda explícita **“MODELO VISUAL – DADOS ILUSTRATIVOS”**.

**Canal de destino:** https://t.me/argosorbis. **Fonte:** `alerta_sísmico_em_bronze_imperial.png`, referência aprovada pelo proprietário nesta conversa.
