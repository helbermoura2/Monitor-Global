package top.monitorglobal.tv;
import java.nio.file.*;
import java.io.IOException;
final class RadarCappiCheck {
 public static void main(String[] args)throws Exception{
  byte[] bytes=Files.readAllBytes(Path.of(args[0]));
  RadarCappi grid=RadarCappi.decode(bytes);
  int valid=0;float max=Float.NEGATIVE_INFINITY;
  for(int y=0;y<500;y++)for(int x=0;x<500;x++){
   float v=grid.at(y,x);if(Float.isFinite(v)){valid++;max=Math.max(max,v);}
  }
  if(valid!=Integer.parseInt(args[1])||Math.abs(max-Float.parseFloat(args[2]))>.0001f)throw new AssertionError("Independent decoder mismatch "+valid+" "+max);
  if(Math.abs(grid.lat[0]-Double.parseDouble(args[3]))>.00001||Math.abs(grid.lon[0]-Double.parseDouble(args[4]))>.00001)throw new AssertionError("Coordinate mismatch");
  if(!Float.isNaN(grid.sample(90,180)))throw new AssertionError("Outside grid must be unavailable");
  for(int n:new int[]{0,16,100,bytes.length-1})try{RadarCappi.decode(java.util.Arrays.copyOf(bytes,n));throw new AssertionError("Truncated file accepted "+n);}catch(IOException expected){}
  System.out.println("CAPPI_JAVA_OK real values="+valid+" maximum="+max);
 }
}
