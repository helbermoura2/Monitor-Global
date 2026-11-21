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
  return write(context,png,".png");
 }

 static Uri fromVideo(Context context,byte[] data,String mime)throws IOException{
  if(data.length<32)throw new IOException("Vídeo inválido");
  if("video/mp4".equals(mime)&&data[4]=='f'&&data[5]=='t'&&data[6]=='y'&&data[7]=='p')
   return write(context,data,".mp4");
  if("video/webm".equals(mime)&&(data[0]&255)==0x1a&&(data[1]&255)==0x45&&(data[2]&255)==0xdf&&(data[3]&255)==0xa3)
   return write(context,data,".webm");
  throw new IOException("Vídeo inválido");
 }

 private static Uri write(Context context,byte[] data,String suffix)throws IOException{
  File directory=new File(context.getCacheDir(),"event-share");
  if(!directory.mkdirs()&&!directory.isDirectory())throw new IOException("Cache indisponível");
  File[] old=directory.listFiles();
  if(old!=null){
   long cutoff=System.currentTimeMillis()-TimeUnit.DAYS.toMillis(7);
   for(File file:old)if(file.lastModified()<cutoff)file.delete();
  }
  File file=File.createTempFile("argos-orbis-evento-",suffix,directory);
  try{
   try(FileOutputStream output=new FileOutputStream(file)){
    output.write(data);
   }
   return FileProvider.getUriForFile(context,context.getPackageName()+".event-share",file);
  }catch(IOException | IllegalArgumentException e){
   file.delete();
   throw e;
  }
 }
}
