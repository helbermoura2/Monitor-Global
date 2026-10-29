package top.monitorglobal.tv;
final class RainNoticePolicy {
 static String previousAfterGap(String key,long observed,long now){return observed<=0||observed>now+60000||now-observed>20*60000L?"":key;}
 static boolean shouldShow(RainForecast.Summary s,String previous,long last,long now){if(s==null||s.expiresAt<=now||s.key().equals(previous))return false;if(s.state.equals("dry")&&previous.isEmpty())return false;boolean stateChanged=!previous.startsWith(s.state+":");return last==0||now-last>=(stateChanged?2:10)*60000L;}
}
