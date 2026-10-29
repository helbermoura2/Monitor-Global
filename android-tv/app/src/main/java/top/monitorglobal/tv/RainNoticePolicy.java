package top.monitorglobal.tv;
final class RainNoticePolicy {
 static boolean shouldShow(RainForecast.Summary s,String previous,long last,long now){if(s==null||s.expiresAt<=now||s.key().equals(previous))return false;if(s.state.equals("dry")&&previous.isEmpty())return false;boolean stateChanged=!previous.startsWith(s.state+":");return last==0||now-last>=(stateChanged?2:10)*60000L;}
}
