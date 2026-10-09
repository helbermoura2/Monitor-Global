# Qualidade adaptativa dos efeitos do cartão

`CardEffectQuality` cria um orçamento por cena. Sem informações de hardware, conserva os limites anteriores de desktop/celular. Até 2 GB de memória indicada pelo navegador ou até dois processadores lógicos inicia no nível equilibrado. Uma tela pequena, por si só, não ativa essa redução adicional.

| Nível | Resolução relativa | Partículas decorativas | Frequência do cartão |
| --- | --- | --- | --- |
| Completo | 100% | 100% | 30 desktop / 24 celular |
| Equilibrado | 80% em cada dimensão | 70% | Igual ao completo |
| Leve | 60% em cada dimensão | 45% | Até 20 quadros/s |

Após um segundo de aquecimento, mede custo síncrono de desenho e intervalo entre desenhos. Uma janela de pelo menos 1,5 segundo e 12 amostras precisa ter mais de 55% de quadros com custo acima de 65% do orçamento ou intervalo acima de 1,8 vezes o orçamento. O intervalo também captura atrasos que não aparecem no custo de envio ao WebGL. Não é um medidor direto de tempo de GPU.

A atmosfera em tela inteira dos sismos M6+ usa a mesma política, mantendo os elementos que caíram ocultos até o fim e os flashes de M7+. Seu limite original é 60 quadros/s nos níveis completo/equilibrado.

A redução acontece sem recriar a cena: redimensiona buffers e remove somente partículas decorativas. Os atores de texto, semicírculo, número e bandeira permanecem. A pintura usa as mesmas coordenadas CSS e o mesmo relógio. O tsunami repinta com seu último tempo, sem reiniciar a onda. O nível não oscila dentro do efeito; o próximo evento começa novamente com seu orçamento de hardware.

Pausas superiores a 250 ms e cartões/abas ocultos reiniciam a janela de medição. Movimento reduzido continua desativando o efeito. A duração máxima de 16 segundos, o carregamento sob demanda, a limpeza entre eventos e a prioridade dos sismos permanecem independentes da qualidade.

No nível equilibrado, a área de pixels dos buffers adaptados cai para cerca de 64%; no leve, para 36%. Isso não representa uma redução percentual do consumo total do site. Vídeos nativos mantêm sua resolução e decodificação; a adaptação atua nas camadas Canvas/WebGL e partículas.

Validação: política determinística para hardware desconhecido/limitado, carga persistente, picos e suspensão; integração desktop/celular com atraso de quadros, resize sem troca dos nós, limite de 16 segundos e movimento reduzido; renderizadores 2D e regressões dos efeitos reais/Menu.
