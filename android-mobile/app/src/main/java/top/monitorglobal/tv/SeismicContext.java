package top.monitorglobal.tv;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

final class SeismicContext {
 private SeismicContext(){}

 static List<String[]> sections(Alert event){
  List<String[]> sections=new ArrayList<>();
  String shaking;
  if(!Double.isFinite(event.magnitude)){
   shaking="O catálogo ainda não traz uma magnitude utilizável. Relatos de moradores e medições locais ainda podem ajudar a descrever onde houve tremor.";
  }else if(event.magnitude<3){
   shaking="Sismos dessa faixa costumam ser detectados por instrumentos. Algumas pessoas podem senti-los perto do epicentro, especialmente quando a origem é rasa. Para confirmar a percepção em uma cidade, procure relatos locais ou medições de intensidade.";
  }else if(event.magnitude<5){
   shaking="O tremor pode ser perceptível perto do epicentro. A distância, o tipo de solo e as características das construções ajudam a explicar por que dois bairros podem ter experiências diferentes.";
  }else{
   shaking="A área onde o tremor foi sentido pode se estender além do epicentro. Consulte mapas de intensidade e medições locais para entender onde o movimento foi mais forte. A avaliação de danos depende de observações em campo.";
  }
  sections.add(new String[]{"Onde o tremor pode ter sido sentido?",shaking});

  String depth;
  if(!Double.isFinite(event.depth)||event.depth<0){
   depth="A profundidade está indisponível. Sem ela, é mais difícil interpretar como o movimento se distribuiu perto do epicentro.";
  }else if(event.depth==0){
   depth="O catálogo informou 0 km. Esse valor pode refletir arredondamento ou uma profundidade fixada na solução do sismo. Consulte o boletim original ou uma revisão para saber como a fonte obteve esse valor.";
  }else if(event.depth<70){
   depth="Uma origem rasa pode produzir movimento mais intenso perto do epicentro do que um sismo mais profundo de magnitude semelhante. O solo local também pode amplificar partes desse movimento.";
  }else{
   depth="As ondas percorrem um caminho maior até alcançar a superfície. O tremor pode ser percebido em uma área ampla, e a intensidade varia conforme o trajeto das ondas e o solo de cada local.";
  }
  sections.add(new String[]{"Como a profundidade muda a interpretação?",depth});

  if(Double.isFinite(event.previousMagnitude)&&Double.isFinite(event.magnitude)
    &&Math.abs(event.magnitude-event.previousMagnitude)>=0.1){
   double ratio=Math.pow(10,1.5*Math.abs(event.magnitude-event.previousMagnitude));
   if(Double.isFinite(ratio)){
    sections.add(new String[]{"O que significa a revisão da magnitude?",
     String.format(Locale.forLanguageTag("pt-BR"),
      "Se as duas magnitudes forem comparáveis, o valor maior corresponde a cerca de %.1f vezes a energia estimada do valor menor. A revisão atualiza a estimativa para o mesmo sismo.",ratio)});
   }
  }

  sections.add(new String[]{"Como verificar os efeitos na sua cidade?",
   "Procure um mapa de intensidade, estações próximas e relatos verificados. Para confirmar danos, consulte comunicados da Defesa Civil ou da autoridade local."});
  sections.add(new String[]{"Como interpretar o risco de tsunami?",
   event.tsunamiSummary.isEmpty()
    ?"Este registro não traz um boletim de tsunami associado. A avaliação depende, entre outros fatores, do local e do mecanismo do sismo e de medições no oceano. Para decisões na costa, acompanhe a autoridade local."
    :"Confira no boletim quais áreas costeiras são citadas, o horário de emissão e se houve atualização. As orientações se aplicam às áreas identificadas pela autoridade responsável."});
  return sections;
 }
}
