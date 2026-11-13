package top.monitorglobal.tv;
import android.content.Context;
import android.view.View;

/** Full-width newsroom lower-third, silent and touch-through, shared with weather.
 * Brent market hours and 12-second display are still controlled by BrentMonitor.
 */
final class BrentOverlay {
 private final Banner banner;private View current;private int generation;
 BrentOverlay(Context c){banner=new Banner(c);}
 boolean showing(){return current!=null;}
 boolean show(BrentQuote quote,boolean demo){return show(quote,null,demo);}
 boolean show(BrentQuote quote,DollarQuote dollar,boolean demo){
  if(quote==null)return false;
  hide();final int token=++generation;
  if(!banner.showBrent(quote,dollar,demo,BrentQuote.DISPLAY,()->{if(token==generation)current=null;}))return false;
  current=banner.activeView();return true;
 }
 boolean showMarket(BrentQuote quote,DollarQuote dollar,MarketState bs,MarketState ds,boolean demo){if(quote==null&&(bs==null||!bs.closed()))return false;hide();final int token=++generation;if(!banner.showMarket(quote,dollar,bs,ds,demo,BrentQuote.DISPLAY,()->{if(token==generation)current=null;}))return false;current=banner.activeView();return true;}
 /** On-demand voice/manual consultation must always return a real newsroom strip.
  * Unknown market/source may show dashes and "sem cotação confirmada", never a
  * fabricated price. Automatic hourly display still requires a valid quote. */
 boolean showUnavailable(DollarQuote dollar,MarketState brentState,MarketState dollarState){
  hide();final int token=++generation;
  if(!banner.showMarket(null,dollar,brentState==null?MarketState.unknown():brentState,
      dollarState==null?MarketState.unknown():dollarState,false,BrentQuote.DISPLAY,
      ()->{if(token==generation)current=null;}))return false;
  current=banner.activeView();return true;
 }
 void hide(){generation++;banner.hide();current=null;}
}

