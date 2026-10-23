# Apresentação sísmica — continuidade e próximos ajustes

## Nesta etapa

O passeio usa três animações nativas consecutivas: abertura, deslocamento no globo e aproximação. Sai do centro óptico atual, desloca-se à localização real com padding nativo e aproxima sem offset geográfico nem jumpTo. O relógio visual avança no máximo 50ms por quadro e estende a etapa quando houver atraso, sem compensação por salto de ângulo. Cada etapa espera o término da anterior; o relógio de apresentação aguarda a chegada se o render atrasar. Mantém-se o orçamento nominal de 6 + 6 + 6 segundos, os efeitos sonoros na visão global e os efeitos do cartão após a chegada. Toque/roda/troca de evento cancelam o percurso. A redução de movimento omite as animações.

O cartão usa resposta visual contínua por magnitude até M5,9, com deslocamento máximo configurado de cerca de 1,5px e duração curta. M0–1,9 é quase imperceptível; M2–3,9 discreto; M4–4,9 moderado; M5–5,9 mais presente e com poucas partículas decorativas. Os campos originais deixam de receber queda, recorte ou desaparecimento por reação sísmica. O controlador sísmico existente usa a mesma progressão nos efeitos discretos; apresentações completas M6+ conservam seu controlador. Isso é uma ilustração por magnitude, não intensidade prevista no aparelho do visitante.

Remover a transformação individual de centenas de caracteres também reduz trabalho durante a apresentação. Testes locais não garantem FPS constante no Samsung/DeX: o próximo vídeo/diagnóstico deve confirmar o resultado no aparelho e com imagens reais em cache/rede.

## Histórico dos próximos itens

**Status em 23/10:** itens 2–6 concluídos em [visual-data-followups-20261023.md](visual-data-followups-20261023.md). Apenas o item 1 continua pendente. A progressão de efeitos foi posteriormente ampliada em [seismic-words-and-epicenter.md](seismic-words-and-epicenter.md). A lista abaixo registra o diagnóstico original.

1. **Enquadramento após mudanças dos painéis:** reposicionar suavemente o centro da área livre quando os registros aparecem/desaparecem, sem saltos e sem interromper o zoom.
2. **Legenda e identificação dos contornos:** corrigir MMI I para não sentido/imperceptível, identificar MMI e raio junto às linhas e esclarecer a ausência de contorno abaixo do limiar em sismos pequenos.
3. **Profundidade zero e hipóteses dos modelos:** distinguir valor informado, arredondado e desconhecido; alinhar ou explicitar o uso de zero nos contornos versus 10 km nas estimativas populacionais/por localidade.
4. **Verso populacional sem dados úteis:** manter a frente do evento e apresentar indisponibilidade de cobertura de forma compacta; nunca confundir ausência de localidades cadastradas com ausência de moradores.
5. **NOVO versus revisão de fontes:** separar chegada nova, revisão física e melhora de cobertura/qualidade B→A, sem banner de revisão física para mera fonte adicional.
6. **Cabeçalho meteorológico:** esclarecer a comparação em “Divergem” e não mostrar divergência sem diferença compreensível quando o valor arredonda para 0,0 mm/h.

Esta lista é histórica; use o status acima para planejar as próximas mudanças. Nesta alteração não se adicionam consultas, polling ou testes funcionais em produção/Telegram.
