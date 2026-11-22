package top.monitorglobal.tv;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.media.Image;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.net.Uri;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.file.Files;
import java.util.concurrent.TimeUnit;
import java.util.function.IntConsumer;

/** Offline, deterministic MP4 encoding of the same card used for PNG sharing. */
final class PhoneVolumeVideo {
 static final int WIDTH=720,HEIGHT=1280,FPS=20;
 private static final int FRAMES=180,TOUR_FRAMES=140;
 private static final long TIMEOUT=TimeUnit.SECONDS.toNanos(55);
 private PhoneVolumeVideo(){}

 static Uri record(Context context,PhoneVolumeShare frame,IntConsumer progress)throws IOException{
  File file=File.createTempFile("argos-tour-",".mp4",context.getCacheDir());
  try{
   encode(file,frame,progress);
   return EventShareCard.fromVideo(context,Files.readAllBytes(file.toPath()),"video/mp4");
  }finally{file.delete();}
 }

 private static void encode(File file,PhoneVolumeShare frame,IntConsumer progress)throws IOException{
  MediaFormat format=MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC,WIDTH,HEIGHT);
  format.setInteger(MediaFormat.KEY_COLOR_FORMAT,MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible);
  format.setInteger(MediaFormat.KEY_BIT_RATE,2_400_000);
  format.setInteger(MediaFormat.KEY_FRAME_RATE,FPS);
  format.setInteger(MediaFormat.KEY_I_FRAME_INTERVAL,1);
  MediaCodec codec=MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC);
  MediaMuxer muxer=null;
  Bitmap bitmap=null;
  boolean muxing=false;
  try{
   codec.configure(format,null,null,MediaCodec.CONFIGURE_FLAG_ENCODE);
   codec.start();
   muxer=new MediaMuxer(file.getAbsolutePath(),MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
   bitmap=Bitmap.createBitmap(WIDTH,HEIGHT,Bitmap.Config.ARGB_8888);
   Canvas canvas=new Canvas(bitmap);
   int[] rgb=new int[WIDTH*HEIGHT];
   byte[] luma=new byte[WIDTH*HEIGHT],u=new byte[WIDTH*HEIGHT/4],v=new byte[u.length];
   MediaCodec.BufferInfo info=new MediaCodec.BufferInfo();
   long deadline=System.nanoTime()+TIMEOUT;
   int count=0,track=-1;
   boolean inputDone=false,outputDone=false;
   while(!outputDone){
    if(Thread.currentThread().isInterrupted()||System.nanoTime()>deadline)throw new IOException("Tour interrompido");
    int output=codec.dequeueOutputBuffer(info,1000);
    if(output==MediaCodec.INFO_OUTPUT_FORMAT_CHANGED){
     track=muxer.addTrack(codec.getOutputFormat());muxer.start();muxing=true;
    }else if(output>=0){
     ByteBuffer bytes=codec.getOutputBuffer(output);
     if(info.size>0&&(info.flags&MediaCodec.BUFFER_FLAG_CODEC_CONFIG)==0){
      if(!muxing||bytes==null)throw new IOException("Faixa de vídeo indisponível");
      bytes.position(info.offset);bytes.limit(info.offset+info.size);
      muxer.writeSampleData(track,bytes,info);
     }
     outputDone=(info.flags&MediaCodec.BUFFER_FLAG_END_OF_STREAM)!=0;
     codec.releaseOutputBuffer(output,false);
    }
    if(inputDone)continue;
    int input=codec.dequeueInputBuffer(1000);
    if(input<0)continue;
    long pts=1_000_000L*count/FPS;
    if(count==FRAMES){
     codec.queueInputBuffer(input,0,0,pts,MediaCodec.BUFFER_FLAG_END_OF_STREAM);
     inputDone=true;continue;
    }
    frame.draw(canvas,Math.max(0,count-10)/(float)TOUR_FRAMES);
    bitmap.getPixels(rgb,0,WIDTH,0,0,WIDTH,HEIGHT);
    convert(rgb,luma,u,v);
    Image image=codec.getInputImage(input);
    if(image==null)throw new IOException("Codificador de imagem indisponível");
    Image.Plane[] planes=image.getPlanes();
    copy(planes[0],luma,WIDTH,HEIGHT);
    copy(planes[1],u,WIDTH/2,HEIGHT/2);
    copy(planes[2],v,WIDTH/2,HEIGHT/2);
    codec.queueInputBuffer(input,0,WIDTH*HEIGHT*3/2,pts,0);
    count++;
    if(count%10==0)progress.accept(count*100/FRAMES);
   }
   if(!muxing)throw new IOException("Vídeo vazio");
   muxer.stop();muxing=false;
  }finally{
   if(bitmap!=null)bitmap.recycle();
   try{codec.release();}finally{
    if(muxer!=null){
     try{if(muxing)muxer.stop();}catch(IllegalStateException ignored){}
     muxer.release();
    }
   }
  }
 }
 private static void copy(Image.Plane plane,byte[] source,int width,int height){
  ByteBuffer buffer=plane.getBuffer();
  int start=buffer.position(),rowStride=plane.getRowStride(),pixelStride=plane.getPixelStride();
  for(int row=0;row<height;row++){
   int offset=start+row*rowStride;
   if(pixelStride==1){
    buffer.position(offset);buffer.put(source,row*width,width);
   }else for(int col=0;col<width;col++)buffer.put(offset+col*pixelStride,source[row*width+col]);
  }
 }
 private static void convert(int[] rgb,byte[] luma,byte[] u,byte[] v){
  // BT.601 limited-range YUV420 with averaged 2×2 chroma.
  for(int row=0;row<HEIGHT;row+=2)for(int col=0;col<WIDTH;col+=2){
   int base=row*WIDTH+col,red=0,green=0,blue=0;
   for(int dy=0;dy<2;dy++)for(int dx=0;dx<2;dx++){
    int pos=base+dy*WIDTH+dx,c=rgb[pos];
    int r=(c>>16)&255,g=(c>>8)&255,b=c&255;
    luma[pos]=(byte)(16+((66*r+129*g+25*b+128)>>8));
    red+=r;green+=g;blue+=b;
   }
   int index=(row/2)*(WIDTH/2)+col/2;
   u[index]=(byte)(128+((-38*red-74*green+112*blue+512)>>10));
   v[index]=(byte)(128+((112*red-94*green-18*blue+512)>>10));
  }
 }
}
