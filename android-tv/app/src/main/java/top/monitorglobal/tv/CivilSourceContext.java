package top.monitorglobal.tv;

/**
 * Provenance and age for Civil Defense notices.
 * Never turns a phone relay into an official CAP confirmation.
 */
final class CivilSourceContext {
 private CivilSourceContext(){}

 static String describe(DefesaCivilSp.Notice notice,long now,boolean phone,boolean replay,boolean demo){
  if(notice==null)return "ORIGEM DO AVISO INDISPONÍVEL";
  StringBuilder out=new StringBuilder();
  if(demo)out.append("SIMULAÇÃO · NÃO É FONTE REAL");
  else if(replay)out.append("REGISTRO HISTÓRICO · NÃO É ALERTA ATUAL");
  else if(phone)out.append("CAPTURADO NO CELULAR · NÃO VERIFICADO VIA CAP");
  else out.append("CAP OFICIAL · EMISSOR: ").append(notice.issuer);
  if(notice.sent>0&&notice.sent<=now){
   long age=(now-notice.sent)/60000;
   append(out,age<1?"EMITIDO HÁ MENOS DE 1 MIN":"EMITIDO HÁ "+age+" MIN");
  }else append(out,"HORÁRIO DE EMISSÃO INDISPONÍVEL");
  if(notice.expires>0){
   append(out,(notice.expires>now?"VALIDADE INFORMADA ATÉ ":"VALIDADE ENCERRADA EM ")+BrDates.dateTime(notice.expires));
  }else append(out,"VALIDADE NÃO INFORMADA");
  return out.toString();
 }
 private static void append(StringBuilder out,String value){
  if(out.length()>0)out.append(" · ");
  out.append(value);
 }
}
