package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;

/**
 * Official, display-only TradingView widget for the continuous B3 DOL future.
 *
 * TradingView provides B3 quotes with approximately 15 minutes of delay.
 * Never read iframe HTML, intercept quotes, use JS bridges or redistribute
 * data to another view/API. The provider controls and renders its own values.
 * The widget loads afresh for each hourly market banner.
 */
final class MarketDOLWidget {
 static final String SYMBOL="BMFBOVESPA:DOL1!";
 static final String SCRIPT="https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js";
 private MarketDOLWidget(){}
 static boolean shouldShow(long now,boolean demo){
  return !demo&&MarketState.brazilDOLRegular(now).value==MarketState.OPEN;
 }
 static String html(){
  return "<!doctype html><html lang='pt-BR'><head>"+
   "<meta name='viewport' content='width=device-width,initial-scale=1.0,maximum-scale=1.0'>"+
   "<style>*{box-sizing:border-box}html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:#071724;color:#dceef8;font-family:Arial,sans-serif}"+
   ".tradingview-widget-container{width:100%;height:100%;overflow:hidden}"+
   ".tradingview-widget-container__widget{width:100%;height:50px}"+
   ".tradingview-widget-copyright{font-size:10px;line-height:13px;text-align:left;padding:1px 4px;white-space:nowrap;color:#b5cfdc}"+
   ".tradingview-widget-copyright a{color:#a9e7fa;text-decoration:none}</style></head><body>"+
   "<div class='tradingview-widget-container'><div class='tradingview-widget-container__widget'></div>"+
   "<div class='tradingview-widget-copyright'><a href='https://br.tradingview.com/symbols/BMFBOVESPA-DOL1!/' target='_blank' rel='noopener nofollow'>DOL1! · B3</a> · ~15 min · TradingView</div>"+
   "<script type='text/javascript' src='"+SCRIPT+"' async>"+
   "{\"symbol\":\""+SYMBOL+"\",\"width\":\"100%\",\"locale\":\"br\",\"colorTheme\":\"dark\",\"isTransparent\":false}"+
   "</script></div></body></html>";
 }
 static WebView create(Context context){
  WebView web=new WebView(context);
  web.setBackgroundColor(Color.rgb(7,23,36));
  web.setOverScrollMode(View.OVER_SCROLL_NEVER);
  web.setVerticalScrollBarEnabled(false);web.setHorizontalScrollBarEnabled(false);
  WebSettings config=web.getSettings();
  config.setJavaScriptEnabled(true);
  config.setDomStorageEnabled(true);
  config.setAllowFileAccess(false);
  config.setAllowContentAccess(false);
  config.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  web.setWebViewClient(new WebViewClient(){
   @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request){
    // Widget iframe may request its own resources; only prevent user navigation.
    return request.isForMainFrame();
   }
  });
  web.loadDataWithBaseURL("https://argosorbis.com.br/",html(),"text/html","UTF-8",null);
  return web;
 }
}
