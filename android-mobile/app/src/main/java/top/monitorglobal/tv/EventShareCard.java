package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.BitmapFactory;
import android.net.Uri;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.concurrent.TimeUnit;

final class EventShareCard {
 private EventShareCard(){}

 static Uri fromSite(Context context,byte[] png)throws IOException{
  BitmapFactory.Options options=new BitmapFactory.Options();
  options.inJustDecodeBounds=true;
  BitmapFactory.decodeByteArray(png,0,png.length,options);
  if(!"image/png".equals(options.outMimeType)||options.outWidth!=1080||options.outHeight!=1920)
   throw new IOException("Cartão inválido");
  return write(context,png);
 }

 private static Uri write(Context context,byte[] png)throws IOException{
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
    output.write(png);
   }
   return FileProvider.getUriForFile(context,context.getPackageName()+".event-share",file);
  }catch(IOException | IllegalArgumentException e){
   file.delete();
   throw e;
  }
 }
}
