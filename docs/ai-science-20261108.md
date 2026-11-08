# Monitor Global — IA compartilhada e projeção meteorológica (08/11/2026)

## Estado do código (PR #610)
Esta alteração reúne três interfaces (site, Android TV e Android celular) e dois provedores de IA:
- Primário: Google Gemini 3.8 Flash (`GEMINI_API_KEY` definido exclusivamente como **Secret** Cloudflare).
- Reserva: Cloudflare Workers AI (Llama 3.1 8B FP8-fast).
- Sem credencial Gemini ou falha de provedor: o relatório por regras científicas pode continuar disponível; alertas e previsões comuns nunca dependem de inferência.
- Não houve leitura do valor da chave: testes com Gemini usam simulação, e ativação verdadeira precisa de confirmação do Worker em produção.

## API meteorológica: GET /weather-outlook?area=liberdade
O endpoint exige o ponto fixo Liberdade, SP, e valida a resposta de `tv-rain?area=liberdade`:
origem Rainbow Weather, 60–300 minutos válidos de previsão contínua, longitude/latitude corretas, tempo de geração, vencimento, intensidades finitas e classes de precipitação.
Projeta uma janela de 30 minutos como **três intervalos de dez minutos**, intensidade máxima, acumulado estimado em mm e tendência baseada somente na própria série futura. Não inventa dados ausentes, não confunde previsão com medição e não envolve LLM na geração de números.
A TV apresenta a informação como linha adicional na sobreposição do card horário, sem alterar os horários, alertas ou interrupções prioritárias. O celular a apresenta na aba Tempo. O site oferece consulta manual no painel de detalhes.

## API sísmica: GET /seismic-insight e GET /seismic-insight?id=...
Seleciona somente eventos sísmicos identificados no feed atualizado `tv-alerts?policy=telegram-v1`, respeitando cobertura e horário de origem dentro de 72 h.
A resposta contém seis seções fundamentadas e rotuladas: magnitude, profundidade, intensidade e impactos, tsunami, revisões das fontes, limites científicos. Essas seções são **pré-geradas por regras científicas** a partir de fatos verificados. Gemini, com Cloudflare de reserva, só indica no máximo dois tópicos a destacar; **não escreve alegações de vítimas, novas magnitudes, falhas tectônicas específicas ou novas previsões**.
O backend usa Durable Object com cache por evento e revisão, janela de 15 minutos e limite separado de 24 trabalhos/dia e 400/mês. Falha ou cota cheia gera conteúdo científico por regras, não texto livre de IA.
A TV oferece análise do último evento em sua tela de diagnóstico; o celular oferece botão no detalhe de um evento; o site oferece consulta selecionada ou do último evento. A seleção no site exige identidade exata no feed e **não reaproveita análise de um evento diferente**.

## Segurança, custo e publicação
- Não há previsão de terremotos ou tsunamis por IA. Avisos oficiais, barulho, filtros de magnitudes, prioridades, replays sobre o vídeo e logo Radar Scope animado não são modificados.
- O nível gratuito da Gemini API depende das cotas da conta; não cadastrar meios de pagamento nem habilitar faturamento.
- O segredo deve ser instalado somente em **Cloudflare > Workers & Pages > black-sky-9ba0 > Variables and Secrets** como `GEMINI_API_KEY`. Não colocar no APK, JavaScript do site, repositório ou prints.
- Implantação protegida: PR revisado e testes concluídos; após merge autorizado, `Cloudflare Worker maintenance` executa modo `deploy` **uma única vez** pela presença de `android-tv/AI_DEPLOY_REQUEST_20261108.txt`. Ele preserva bindings e agendas, testa o bundle e valida a saúde pública. Se as credenciais do GitHub para Cloudflare não estiverem configuradas, a implantação **falha sem publicar**.
- TV: versionCode 10058 / 1.0.58, com APK assinado e atualizador oficial após merge. Android celular: prévia 0.1.8; **não há canal oficial de atualização por dentro do celular equivalente à TV**.
- Testes automatizados usam fixtures offline, incluindo previsão com 30 minutos, continuidade temporal, localização, arredondamento, eventos desconhecidos, texto validado, proibição de novos alertas e prioridades preservadas. Eles não substituem testes com a TV e o celular reais ou a confirmação de inferência Gemini em produção.
