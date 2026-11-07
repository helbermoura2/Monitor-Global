# IA meteorológica na Android TV — destaques úteis sem repetição

## Motivação (07/11/2026)
O cartão horário já apresenta temperatura, céu, sensação, umidade, vento e rajadas. O resumo anterior da IA apenas escolhia e repetia esses valores: a pessoa assistindo não recebia informação adicional.

## Solução proposta
- Preservar **Rainbow Weather**, fonte, local fixo Liberdade/SP, horários, validade, quotas e modelo Cloudflare Llama 3.1 8B já existentes.
- Manter a geração **restrita à seleção de IDs de interpretações pré-validadas**; a IA nunca escreve valores ou previsões livres. Continua no máximo duas observações curtas.
- O servidor somente oferece observações que possam ser justificadas pelos campos válidos: combinação de umidade muito alta e vento fraco, ar seco, diferença acentuada de sensação térmica, rajadas/vento fortes, trovoadas/nevoeiro previstos; no nowcast, início em breve, possível pausa, intensificação sustentada e chuva persistente. O tom distingue **previsão do modelo** de medição observada e nunca conclui que há (ou não há) chuva apenas pela umidade.
- Remover frases que repetem temperatura em °C, vento em km/h e intensidade/acumulado de chuva, já visíveis no cartão.
- Em tempo comum, sem nenhuma interpretação verificável, `status:not_applicable`: o cartão meteorológico continua normalmente **sem bloco de IA**. A chamada não consome inferência Workers AI nem orçamento de neurônios.
- Prioridade editorial: **trovoadas e rajadas fortes** não podem ser ocultadas por seleção de umidade fraca; na chuva, **intensificação e chuva forte sustentada** ficam à frente de observações opcionais. A saída permanece com até duas frases verificadas.
- Início da chuva já exibido no cartão é **omitido da IA**, mesmo quando for dentro de 30 minutos. Uma pancada isolada de apenas um minuto acima do limiar de chuva forte **não vira** destaque de chuva intensa sustentada. A possível pausa só é informada na janela da próxima hora e quando já chove.
- O cenário fotografado de chuva em aproximadamente 60 minutos, com previsão de 0,0 mm no intervalo, não produz afirmação artificial de incerteza; sem evolução relevante, o bloco de IA fica oculto.
- Novo namespace de cache `validated-insights-v4` e `engine:validated-insight-selection-v4` separam a seleção antiga da atual. Resposta mantém `version:weather-briefing-v1`, campos de validade e associação exata com a previsão, compatível com os clientes Android TV e Android Mobile atuais.
- Manter limites diários/mensais `64 / 1500` e cache compartilhado, sem aumentar timers, criar cron, chave, binding ou endpoint.
- O texto da interface continua "RESUMO COM IA" para compatibilidade: quem dá a ordem de prioridade é a IA; o texto publicado é **derivado de dados validados pelo código**. Não há alegação de que o modelo faça previsão própria.

## Exemplo dos dados exibidos na foto
Previsão 21 °C, céu nublado, umidade 92%, vento 1 km/h e rajadas 3 km/h.

Antes: "Na Liberdade, a previsão horária é de 21°C. O vento previsto é de 1 km/h, com rajadas de 3 km/h. O modelo horário indica céu nublado."

Depois: "O modelo prevê ar muito úmido e vento praticamente parado. Umidade alta, sozinha, não indica chuva."

O exemplo é uma reformulação condicional: não confunde umidade com chuva confirmada.

## Verificação
- `node --test tests/unit/weather-briefing.test.mjs`; a suíte completa `npm run worker:test` e checks do GitHub devem ser avaliados.
- Testar casos sem sinal, umidade/vento do exemplo, tempestades, sensação térmica e chuva por minuto; garantir rejeição de palpites da IA, orçamento e cache.
- Conferir no aplicativo real, após aprovação e integração, que o cartão original continue funcionando mesmo quando Workers AI falha e que o bloco só apareça quando adicionar valor.
- **Não há alteração do APK**, do agendamento horário, do serviço de alertas, do Telegram nem dos dados científicos. O efeito só aparece quando o Worker atualizado estiver publicado; PR aberto e build de prévia não são produção.
