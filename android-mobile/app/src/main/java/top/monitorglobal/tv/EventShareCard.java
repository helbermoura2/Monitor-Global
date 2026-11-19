package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.net.Uri;
import android.text.Layout;
import android.text.StaticLayout;
import android.text.TextPaint;
import android.text.TextUtils;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

final class EventShareCard {
 private static final int WIDTH=960, PADDING=62, TEXT_WIDTH=WIDTH-2*PADDING;
 private EventShareCard(){}

 static Uri create(Context context,String category,String title,String magnitude,String[] facts,
   Typeface brand)throws IOException{
  StaticLayout headline=layout(title,58,PhoneActivity.TEXT,Typeface.DEFAULT_BOLD,4);
  StaticLayout label=layout(category,27,PhoneActivity.CYAN,Typeface.DEFAULT_BOLD,2);
  StaticLayout details=layout(String.join("\n",facts),34,PhoneActivity.TEXT,Typeface.DEFAULT,8);
  int headingY=168;
  int titleY=headingY+label.getHeight()+18;
  int detailsY=titleY+headline.getHeight()+(magnitude.isEmpty()?34:148);
  int footerY=detailsY+details.getHeight()+65;
  Bitmap image=Bitmap.createBitmap(WIDTH,footerY+60,Bitmap.Config.ARGB_8888);
  try{
   Canvas canvas=new Canvas(image);
   Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
   paint.setShader(new LinearGradient(0,0,WIDTH,image.getHeight(),
    PhoneActivity.BACK,PhoneActivity.BODY,Shader.TileMode.CLAMP));
   canvas.drawPaint(paint);
   paint.setShader(null);
   paint.setColor(0xffc4a16a);
   canvas.drawRect(0,0,WIDTH,8,paint);
   paint.setTypeface(brand);
   paint.setTextSize(48);
   canvas.drawText("ARGOS ORBIS",PADDING,92,paint);
   paint.setColor(0xff244958);
   canvas.drawRect(PADDING,122,WIDTH-PADDING,124,paint);

   draw(canvas,label,PADDING,headingY);
   draw(canvas,headline,PADDING,titleY);
   if(!magnitude.isEmpty()){
    paint.setTypeface(Typeface.DEFAULT_BOLD);
    paint.setColor(PhoneActivity.AMBER);
    paint.setTextSize(90);
    canvas.drawText(magnitude,PADDING,titleY+headline.getHeight()+100,paint);
   }

   paint.setColor(0xff102e40);
   canvas.drawRoundRect(PADDING-20,detailsY-16,WIDTH-PADDING+20,footerY-40,18,18,paint);
   draw(canvas,details,PADDING,detailsY);
   paint.setTypeface(Typeface.DEFAULT);
   paint.setTextSize(30);
   paint.setColor(PhoneActivity.CYAN);
   canvas.drawText("argosorbis.com.br",PADDING,footerY+10,paint);
   return write(context,image);
  }finally{
   image.recycle();
  }
 }

 private static StaticLayout layout(String value,int size,int color,Typeface font,int maxLines){
  TextPaint paint=new TextPaint(Paint.ANTI_ALIAS_FLAG);
  paint.setTextSize(size);
  paint.setColor(color);
  paint.setTypeface(font);
  return StaticLayout.Builder.obtain(value,0,value.length(),paint,TEXT_WIDTH)
   .setMaxLines(maxLines).setEllipsize(TextUtils.TruncateAt.END).build();
 }

 private static void draw(Canvas canvas,StaticLayout layout,int x,int y){
  canvas.save();
  canvas.translate(x,y);
  layout.draw(canvas);
  canvas.restore();
 }

 private static Uri write(Context context,Bitmap image)throws IOException{
  File directory=new File(context.getCacheDir(),"event-share");
  if(!directory.mkdirs()&&!directory.isDirectory())throw new IOException("Cache indisponível");
  File[] old=directory.listFiles();
  if(old!=null){
   long cutoff=System.currentTimeMillis()-TimeUnit.DAYS.toMillis(7);
   for(File file:old)if(file.lastModified()<cutoff)file.delete();
  }
  File file=File.createTempFile("argos-orbis-evento-",".png",directory);
  try{
   try(FileOutputStream output=new FileOutputStream(file)){
    if(!image.compress(Bitmap.CompressFormat.PNG,100,output))throw new IOException("Falha ao gerar PNG");
   }
   return FileProvider.getUriForFile(context,context.getPackageName()+".event-share",file);
  }catch(IOException | IllegalArgumentException e){
   file.delete();
   throw e;
  }
 }
}
