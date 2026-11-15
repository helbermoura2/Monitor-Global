package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.view.ViewGroup;
import android.webkit.WebView;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

/** Uses the exact approved animated SVG shipped by the site; never fetches a remote logo.
 * The existing native radar remains underneath as a fallback on TVs without WebView. */
final class BrandLogoView extends FrameLayout {
 BrandLogoView(Context context) {
  super(context);
  setContentDescription("Argos Orbis · logotipo oficial, olho do vigilante");
  addView(new RadarLogoView(context), new LayoutParams(
   ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
  try {
   WebView logo = new WebView(context);
   logo.setBackgroundColor(Color.TRANSPARENT);
   logo.setVerticalScrollBarEnabled(false);
   logo.setHorizontalScrollBarEnabled(false);
   logo.setFocusable(false);
   logo.setClickable(false);
   logo.setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);
   logo.getSettings().setJavaScriptEnabled(false);
   logo.getSettings().setDomStorageEnabled(false);
   logo.getSettings().setAllowFileAccess(true);
   logo.getSettings().setAllowContentAccess(false);
   logo.getSettings().setBlockNetworkLoads(true);
   logo.setWebViewClient(new WebViewClient() {
    @Override public void onReceivedError(WebView view, WebResourceRequest request,
                                           WebResourceError error) {
     if(request.isForMainFrame())removeView(view); // reveal native fallback
    }
   });
   addView(logo, new LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
   // Wrap the SVG in a local transparent viewport so its 1328×859 source
   // scales to the 118×76 dp header instead of cropping on older WebViews.
   String html = "<!doctype html><html><head>"
     + "<meta name='viewport' content='width=device-width,initial-scale=1'>"
     + "<style>html,body{margin:0;width:100%;height:100%;background:transparent;"
     + "overflow:hidden}img{display:block;width:100%;height:100%;object-fit:contain}</style>"
     + "</head><body><img alt='' src='argos-orbis-vigilante.svg'></body></html>";
   logo.loadDataWithBaseURL("file:///android_asset/", html, "text/html", "UTF-8", null);
  } catch (RuntimeException noWebView) {
   // Some Fire OS/Android TV builds omit the WebView runtime.
   // The native fallback remains visible.
  }
 }
}
