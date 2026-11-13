package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.*;
import android.view.View;

/** Original static vector illustration; no decorative weather is presented as live observation. */
final class PhoneWeatherArt extends View {
 private final Paint p=new Paint(Paint.ANTI_ALIAS_FLAG);private final String condition;
 PhoneWeatherArt(Context c,String key){super(c);condition=key==null?"":key;setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
 @Override protected void onDraw(Canvas c){super.onDraw(c);int save=c.save();float scale=Math.min(getWidth()/150f,getHeight()/126f);c.translate((getWidth()-150*scale)/2,(getHeight()-126*scale)/2);c.scale(scale,scale);boolean clear=condition.equals("Clear")||condition.equals("MostlyClear"),sun=clear||condition.equals("PartlyCloudy"),rain=condition.contains("Rain")||condition.contains("Storm")||condition.equals("Drizzle"),snow=condition.contains("Snow");
  p.setShader(new RadialGradient(75,62,70,new int[]{0x4624d9ed,0x0024d9ed},null,Shader.TileMode.CLAMP));c.drawCircle(75,62,70,p);p.setShader(null);
  if(sun){p.setShader(new RadialGradient(92,39,29,new int[]{0xffffeb9a,0xffffc659},null,Shader.TileMode.CLAMP));c.drawCircle(92,39,24,p);p.setShader(null);p.setColor(0xffffd570);p.setStrokeWidth(3);p.setStrokeCap(Paint.Cap.ROUND);for(int i=0;i<8;i++){double a=i*Math.PI/4;c.drawLine(92+(float)Math.cos(a)*30,39+(float)Math.sin(a)*30,92+(float)Math.cos(a)*36,39+(float)Math.sin(a)*36,p);}}
  if(!clear){p.setShader(new LinearGradient(0,38,0,88,0xffeffaff,0xff81a9c2,Shader.TileMode.CLAMP));Path cloud=new Path();cloud.moveTo(35,85);cloud.cubicTo(8,84,13,51,37,52);cloud.cubicTo(43,24,82,26,91,48);cloud.cubicTo(124,40,141,85,110,87);cloud.close();c.drawPath(cloud,p);p.setShader(null);}
  if(rain){p.setColor(0xff3bdcf0);p.setStrokeWidth(4);p.setStrokeCap(Paint.Cap.ROUND);for(int i=0;i<4;i++)c.drawLine(43+i*18,96,38+i*18,106,p);}
  if(snow){p.setColor(0xffdffaff);for(int i=0;i<3;i++)c.drawCircle(46+i*25,101,3,p);}
  if(condition.isEmpty()){p.setColor(0xffa6c3d3);p.setTextSize(45);p.setTypeface(Typeface.DEFAULT_BOLD);c.drawText("?",62,78,p);}
  c.restoreToCount(save);
 }
}
