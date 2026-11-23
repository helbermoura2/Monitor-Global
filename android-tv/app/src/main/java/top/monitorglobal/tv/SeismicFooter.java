package top.monitorglobal.tv;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Short, complementary TV ticker. Facts already shown in the main banner
 * (magnitude, place, depth, provider and event clock) are deliberately omitted.
 * The complete bulletin still stays in the accessibility description.
 *
 * Never infer tsunami safety from missing data: no-threat applies ONLY to the
 * areas explicitly covered by a real official bulletin.
 */
final class SeismicFooter {
 private static final Locale PT=Locale.forLanguageTag("pt-BR");
 private SeismicFooter(){}

 private static void add(StringBuilder out,String fact){
  if(fact==null||fact.trim().isEmpty())return;
  if(out.length()>0)out.append("     •     ");
  out.append(fact.trim());
 }
 private static boolean coordinates(Alert a){
  return Double.isFinite(a.originLatitude)&&Double.isFinite(a.originLongitude)
   &&Math.abs(a.originLatitude)<=90&&Math.abs(a.originLongitude)<=180;
 }
 static String coordinateText(Alert a){
  if(!coordinates(a))return "";
  return String.format(PT,"COORDENADAS · %.2f° %s / %.2f° %s",
   Math.abs(a.originLatitude),a.originLatitude<0?"S":"N",
   Math.abs(a.originLongitude),a.originLongitude<0?"O":"L");
 }
 private static String reference(Alert a){
  if(a.id==null||a.id.isEmpty()||a.id.startsWith("demo-")
    ||a.id.startsWith("EFFECTS-")||a.id.length()>48
    ||!a.id.matches("[A-Za-z0-9_:.\\-]+"))return "";
  return "REGISTRO · "+a.id;
 }
 private static String bulletinDay(long time){
  if(time<=0)return "";
  SimpleDateFormat fmt=new SimpleDateFormat("dd/MM/yyyy",PT);
  fmt.setTimeZone(TimeZone.getTimeZone("America/Sao_Paulo"));
  return fmt.format(new Date(time));
 }
 static String forEvent(Alert a,boolean demo,boolean replay,boolean summary,
                        String summaryDay,boolean complete){
  StringBuilder out=new StringBuilder();
  if(demo)add(out,"SIMULAÇÃO FICTÍCIA · NÃO É ALERTA REAL");
  if(summary){
   add(out,"RESUMO DO DIA · "+summaryDay);
   add(out,complete?"DIA ENCERRADO":"DADOS PARCIAIS");
  }
  if(replay){
   add(out,"REPLAY · REGISTRO HISTÓRICO · NÃO É NOVO ALERTA");
  }
  if("tsunami".equals(a.kind)){
   // The sole visible state classification is on the MAIN banner.
   // In the footer, explain scope and provenance instead of repeating it.
   if("noThreat".equals(a.state))
    add(out,"SITUAÇÃO LIMITADA ÀS COSTAS CITADAS NO BOLETIM");
   else if("ended".equals(a.state))
    add(out,"ENCERRAMENTO APENAS PARA AS REGIÕES CITADAS");
   else if("warning".equals(a.state)||"watch".equals(a.state)||"advisory".equals(a.state))
    add(out,"CONSULTE AS ORIENTAÇÕES DA AUTORIDADE EMISSORA");
   else add(out,"CONFIRA O BOLETIM OFICIAL E SUAS REGIÕES");
   if(!replay&&!summary&&!bulletinDay(a.issuedAt).isEmpty())
    add(out,"DATA DO BOLETIM · "+bulletinDay(a.issuedAt));
   add(out,reference(a));
   add(out,"OUTRAS COSTAS PODEM TER SITUAÇÕES DIFERENTES");
  }else{
   add(out,coordinateText(a));
   if(!a.populationSummary.isEmpty())add(out,a.populationSummary);
   if(!a.nearbySummary.isEmpty())add(out,a.nearbySummary);
   // Tsunami text is shown only when the source explicitly supplies a
   // linked bulletin. Never synthesize "sem ameaça" on an absent bulletin.
   if(!a.tsunamiSummary.isEmpty())add(out,"BOLETIM ASSOCIADO · "+a.tsunamiSummary);
   add(out,reference(a));
   add(out,"DADOS SÍSMICOS SUJEITOS A REVISÃO");
  }
  if(summary||replay)add(out,"HISTÓRICO · Não informa a situação atual de tsunami");
  return out.toString();
 }
}
