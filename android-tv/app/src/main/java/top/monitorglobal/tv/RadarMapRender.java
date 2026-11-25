package top.monitorglobal.tv;

import android.graphics.*;
import android.content.Context;

/** Rasterizes only actual CAPPI cells using the existing satellite map projection. */
final class RadarMapRender {
 static int color(float v,int x,int y){return RadarIntensity.pixel(v,x,y);}
 static Bitmap render(Context context,WeatherSatelliteClient geography,InfraredPlan.Scope scope,RadarMapClient.Frame frame)throws Exception{
  int w=InfraredPlan.WIDTH,h=scope.height;int[] pixels=new int[w*h];
  double top=InfraredPlan.merc(scope.north),bottom=InfraredPlan.merc(scope.south);
  for(int y=0;y<h;y++){
   if(Thread.currentThread().isInterrupted())throw new java.io.IOException("Cancelado");
   double merc=top-(y+.5)/h*(top-bottom),lat=Math.toDegrees(2*Math.atan(Math.exp(merc))-Math.PI/2);
   for(int x=0;x<w;x++){
    double lon=scope.west+(x+.5)/w*(scope.east-scope.west);
    pixels[y*w+x]=color(frame.sample(lat,lon),x,y);
   }
  }
  Bitmap out=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888);
  try{
   Canvas canvas=new Canvas(out);canvas.drawColor(0xff101d22);
   Path outline=geography.outline(scope);Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);
   p.setColor(0xff162a31);canvas.drawPath(outline,p);
   Bitmap overlay=Bitmap.createBitmap(pixels,w,h,Bitmap.Config.ARGB_8888);
   try{canvas.drawBitmap(overlay,0,0,null);}finally{overlay.recycle();}
   p.setStyle(Paint.Style.STROKE);p.setColor(0xffb6c4c8);p.setStrokeWidth(2);canvas.drawPath(outline,p);
   p.setStyle(Paint.Style.FILL);p.setTextSize(scope==InfraredPlan.SOUTHEAST?28:24);p.setTypeface(Typeface.DEFAULT_BOLD);p.setShadowLayer(3,0,1,Color.BLACK);
   geography.city(canvas,p,scope,-46.63,-23.55,"São Paulo");
   if(scope==InfraredPlan.SOUTHEAST){geography.city(canvas,p,scope,-43.20,-22.90,"Rio de Janeiro");geography.city(canvas,p,scope,-43.94,-19.92,"Belo Horizonte");}
   return out;
  }catch(Exception|OutOfMemoryError e){out.recycle();throw e;}
 }
}
