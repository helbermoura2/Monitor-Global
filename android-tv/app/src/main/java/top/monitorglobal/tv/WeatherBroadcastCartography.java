package top.monitorglobal.tv;
import android.content.Context;
import android.graphics.*;
/** Draw official project state geometry in the same projection, without recolouring scientific pixels. */
final class WeatherBroadcastCartography {
 static void states(Context context,Canvas canvas,InfraredPlan.Scope scope){
  BrazilGeoStates geo=BrazilGeoStates.load(context);if(geo==null)return;
  Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);p.setStyle(Paint.Style.STROKE);p.setStrokeWidth(4f);
  canvas.save();canvas.clipRect(0,0,InfraredPlan.WIDTH,scope.height);
  for(BrazilGeoStates.State state:geo.states){
   if(state.east<scope.west||state.west>scope.east||state.north<scope.south||state.south>scope.north)continue;
   Path path=new Path();
   for(java.util.List<float[][]> polygon:state.polygons)for(float[][] ring:polygon){
    for(int i=0;i<ring.length;i++){float x=scope.x(ring[i][0]),y=scope.y(ring[i][1]);if(i==0)path.moveTo(x,y);else path.lineTo(x,y);}path.close();
   }
   p.setColor(0xc0191a1c);p.setStrokeWidth(5f);canvas.drawPath(path,p);
   p.setColor(0xcce0e4e7);p.setStrokeWidth(2f);canvas.drawPath(path,p);
  }
  canvas.restore();
 }
}
