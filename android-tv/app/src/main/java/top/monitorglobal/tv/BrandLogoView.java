package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Color;
import android.view.ViewGroup;
import android.webkit.WebView;
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
   logo.setWebViewClient(new WebViewClient());
   addView(logo, new LayoutParams(
    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
   logo.loadUrl("file:///android_asset/argos-orbis-vigilante.svg");
  } catch (RuntimeException noWebView) {
   // Some Fire OS/Android TV builds omit the WebView runtime.
   // The native fallback remains visible.
  }
 }
}
