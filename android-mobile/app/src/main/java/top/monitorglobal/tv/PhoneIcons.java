package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.view.View;

/** Small local vector glyphs; no remote artwork or animation loop. */
final class PhoneIcons extends View {
 static final int RADAR=0,HOME=1,MAP=2,CLOUD=3,BELL=4,RAIN=5,DROP=6,WIND=7,CLOCK=8,DEPTH=9,REFRESH=10,SUN=11,SNOW=12,UNKNOWN=13;
 private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final Path path=new Path();
 PhoneIcons(Context c,int kind,int color){
  super(c);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);paint.setColor(color);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.6f);paint.setStrokeJoin(Paint.Join.ROUND);paint.setStrokeCap(Paint.Cap.ROUND);
  if(kind==RADAR){path.addCircle(12,12,10,Path.Direction.CW);path.addCircle(12,12,6.5f,Path.Direction.CW);path.addCircle(12,12,3,Path.Direction.CW);line(12,12,19,5);}
  else if(kind==HOME){path.moveTo(2,11);path.lineTo(12,3);path.lineTo(22,11);path.moveTo(5,9);path.lineTo(5,22);path.lineTo(10,22);path.lineTo(10,15);path.lineTo(14,15);path.lineTo(14,22);path.lineTo(19,22);path.lineTo(19,9);}
  else if(kind==MAP){path.moveTo(2,5);path.lineTo(8,2);path.lineTo(16,5);path.lineTo(22,2);path.lineTo(22,19);path.lineTo(16,22);path.lineTo(8,19);path.lineTo(2,22);path.close();line(8,2,8,19);line(16,5,16,22);}
  else if(kind==CLOUD||kind==RAIN||kind==SNOW){path.moveTo(6,16);path.cubicTo(0,16,1,8,6,8);path.cubicTo(8,1,17,2,18,8);path.cubicTo(24,8,24,16,18,16);path.lineTo(6,16);if(kind==RAIN){line(7,19,5,22);line(13,19,11,22);line(19,19,17,22);}if(kind==SNOW){line(7,19,7,23);line(5,21,9,21);line(17,19,17,23);line(15,21,19,21);}}
  else if(kind==BELL){path.moveTo(4,17);path.lineTo(6,14);path.lineTo(6,9);path.cubicTo(6,1,18,1,18,9);path.lineTo(18,14);path.lineTo(20,17);path.close();path.moveTo(9,21);path.quadTo(12,24,15,21);}
  else if(kind==DROP){path.moveTo(12,2);path.cubicTo(9,7,3,13,5,18);path.cubicTo(8,26,20,22,19,16);path.cubicTo(19,12,14,5,12,2);path.close();}
  else if(kind==WIND){line(2,7,15,7);path.moveTo(15,7);path.cubicTo(22,7,21,0,16,3);line(2,12,20,12);line(4,18,13,18);path.moveTo(13,18);path.cubicTo(20,18,19,25,14,22);}
  else if(kind==CLOCK){path.addCircle(12,12,9,Path.Direction.CW);line(12,6,12,12);line(12,12,17,15);}
  else if(kind==DEPTH){line(12,2,12,15);line(7,10,12,15);line(12,15,17,10);line(4,20,20,20);}
  else if(kind==REFRESH){path.moveTo(20,9);path.cubicTo(17,0,3,3,4,13);path.moveTo(4,15);path.cubicTo(7,24,21,21,20,11);line(20,3,20,9);line(20,9,14,9);line(4,21,4,15);line(4,15,10,15);}
  else if(kind==SUN){path.addCircle(12,12,5,Path.Direction.CW);line(12,1,12,4);line(12,20,12,23);line(1,12,4,12);line(20,12,23,12);line(4,4,6,6);line(18,18,20,20);line(4,20,6,18);line(18,6,20,4);}
  else{path.addCircle(12,12,9,Path.Direction.CW);path.moveTo(9,9);path.cubicTo(9,5,17,6,15,10);path.lineTo(12,13);line(12,13,12,15);line(12,18,12,18.1f);}
 }
 private void line(float x,float y,float xx,float yy){path.moveTo(x,y);path.lineTo(xx,yy);}
 @Override protected void onDraw(Canvas c){super.onDraw(c);int save=c.save();c.scale(getWidth()/24f,getHeight()/24f);c.drawPath(path,paint);c.restoreToCount(save);}
 static int condition(String key){switch(key){case "Clear":case "MostlyClear":return SUN;case "PartlyCloudy":case "MostlyCloudy":case "Cloudy":return CLOUD;case "Rain":case "Drizzle":case "HeavyRain":case "Thunderstorms":case "StrongStorms":case "ScatteredThunderstorms":case "IsolatedThunderstorms":return RAIN;case "Snow":case "HeavySnow":return SNOW;default:return UNKNOWN;}}
}
