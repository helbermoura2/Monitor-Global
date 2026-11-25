package top.monitorglobal.tv;

import static org.junit.Assert.*;
import org.junit.Test;

public class CivilSourceContextTest {
 @Test public void officialCapShowsIssuerAgeAndExpiry(){
  long now=1800000000000L;
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice("cap-1","Defesa Civil Estadual de São Paulo",
   "Chuva forte", "Severe",now-5*60000,now+25*60000);
  String text=CivilSourceContext.describe(notice,now,false,false,false);
  assertTrue(text.contains("CAP OFICIAL"));
  assertTrue(text.contains(notice.issuer));
  assertTrue(text.contains("EMITIDO HÁ 5 MIN"));
  assertTrue(text.contains("VALIDADE INFORMADA ATÉ"));
 }
 @Test public void phoneRelayIsNeverDescribedAsCapVerified(){
  long now=1800000000000L;
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice("phone-1","Celular",
   "Alerta recebido", "Extreme",now-2*60000,now+8*60000);
  String text=CivilSourceContext.describe(notice,now,true,false,false);
  assertTrue(text.contains("CAPTURADO NO CELULAR"));
  assertTrue(text.contains("NÃO VERIFICADO VIA CAP"));
  assertFalse(text.contains("CAP OFICIAL"));
  String replay=CivilSourceContext.describe(notice,now,true,true,false);
  assertTrue(replay.contains("REPLAY HISTÓRICO"));
  assertTrue(replay.contains("ORIGEM CELULAR"));
  assertTrue(replay.contains("NÃO VERIFICADO VIA CAP"));
 }
 @Test public void replayAndExpiredValidityRemainExplicit(){
  long now=1800000000000L;
  DefesaCivilSp.Notice notice=new DefesaCivilSp.Notice("cap-old","Defesa Civil Estadual de São Paulo",
   "Aviso antigo", "Severe",now-60*60000,now-5*60000);
  String text=CivilSourceContext.describe(notice,now,false,true,false);
  assertTrue(text.contains("REGISTRO HISTÓRICO"));
  assertTrue(text.contains("NÃO É ALERTA ATUAL"));
  assertTrue(text.contains("VALIDADE ENCERRADA EM"));
 }
}
