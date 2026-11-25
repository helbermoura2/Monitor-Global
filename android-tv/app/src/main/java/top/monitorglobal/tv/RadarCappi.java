package top.monitorglobal.tv;

import java.io.IOException;
import java.nio.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Narrow reader for the observed INPE CAPPI CDF-2 layout; rejects unsupported files. */
final class RadarCappi {
 private static final int MAX_BYTES=12*1024*1024, SIZE=500;
 private static final int DIMENSION=10, VARIABLE=11, ATTRIBUTE=12;
 final double[] lat,lon;
 private final float[] dbz;
 private RadarCappi(double[] lat,double[] lon,float[] dbz){this.lat=lat;this.lon=lon;this.dbz=dbz;}
 static RadarCappi decode(byte[] input)throws IOException{
  if(input==null||input.length<32||input.length>MAX_BYTES)throw new IOException("CAPPI size");
  try{return new Reader(input).read();}catch(BufferUnderflowException|IndexOutOfBoundsException|ArithmeticException|IllegalArgumentException ex){throw new IOException("Invalid CAPPI header",ex);}
 }
 float at(int y,int x){return dbz[y*SIZE+x];}
 /** Nearest observed cell only; do not extrapolate outside the sampled grid. */
 float sample(double latitude,double longitude){
  int y=nearest(lat,latitude),x=nearest(lon,longitude);
  return x<0||y<0?Float.NaN:at(y,x);
 }
 private static int nearest(double[] a,double v){
  if(!Double.isFinite(v)||v<Math.min(a[0],a[a.length-1])||v>Math.max(a[0],a[a.length-1]))return -1;
  boolean ascending=a[0]<a[a.length-1];int lo=0,hi=a.length-1;
  while(hi-lo>1){int mid=(lo+hi)/2;if((a[mid]<v)==ascending)lo=mid;else hi=mid;}
  return Math.abs(a[lo]-v)<=Math.abs(a[hi]-v)?lo:hi;
 }
 private static final class Var {
  String name;int[] dims;int type;long size,offset;
  final Map<String,Double> attrs=new HashMap<>();
 }
 private static final class Reader {
  final ByteBuffer b;final List<String> names=new ArrayList<>();final List<Integer> lengths=new ArrayList<>();
  final Map<String,Var> vars=new HashMap<>();int records;
  Reader(byte[] bytes){b=ByteBuffer.wrap(bytes).order(ByteOrder.BIG_ENDIAN);}
  void require(boolean ok,String reason)throws IOException{if(!ok)throw new IOException(reason);}
  int count(int tag,int max)throws IOException{
   int t=b.getInt(),n=b.getInt();require((t==tag&&n>=0&&n<=max)||(t==0&&n==0),"Invalid CDF list");return n;
  }
  String name()throws IOException{
   int n=b.getInt();require(n>0&&n<=256&&n<=b.remaining(),"Invalid name");byte[] data=new byte[n];b.get(data);pad(n);
   return new String(data,StandardCharsets.UTF_8);
  }
  void pad(int n)throws IOException{skip((4-n%4)%4);}
  void skip(long n)throws IOException{require(n>=0&&n<=b.remaining(),"Truncated CDF");b.position(b.position()+(int)n);}
  int width(int t)throws IOException{switch(t){case 1:case 2:return 1;case 3:return 2;case 4:case 5:return 4;case 6:return 8;default:throw new IOException("Unsupported CDF type");}}
  double numeric(ByteBuffer r,int t)throws IOException{switch(t){case 1:return r.get();case 3:return r.getShort();case 4:return r.getInt();case 5:return r.getFloat();case 6:return r.getDouble();default:throw new IOException("Non-numeric variable");}}
  void attrs(Map<String,Double> dst)throws IOException{
   int n=count(ATTRIBUTE,128);for(int i=0;i<n;i++){
    String k=name();int type=b.getInt(),len=b.getInt();require(len>=0&&len<=65536,"Attribute length");
    int bytes=Math.multiplyExact(len,width(type));require(bytes<=b.remaining(),"Truncated attribute");
    if(dst!=null&&len==1&&type!=2){dst.put(k,numeric(b,type));}else skip(bytes);
    pad(bytes);
   }
  }
  RadarCappi read()throws IOException{
   require(b.getInt()==0x43444602,"Only verified CDF-2 supported");records=b.getInt();
   require(records>=0&&records<=1,"Unsupported record count");
   int nd=count(DIMENSION,16);for(int i=0;i<nd;i++){
    String name=name();int len=b.getInt();require(len>=0&&len<=100000&&!names.contains(name),"Invalid dimension");names.add(name);lengths.add(len);
   }
   attrs(null);int nv=count(VARIABLE,32);
   for(int i=0;i<nv;i++){
    Var v=new Var();v.name=name();int n=b.getInt();require(n>=0&&n<=4,"Variable rank");v.dims=new int[n];
    for(int j=0;j<n;j++){v.dims[j]=b.getInt();require(v.dims[j]>=0&&v.dims[j]<nd,"Invalid dimension index");}
    attrs(v.attrs);v.type=b.getInt();width(v.type);v.size=Integer.toUnsignedLong(b.getInt());v.offset=b.getLong();
    require(v.offset>=0&&v.offset<=b.limit()&&vars.put(v.name,v)==null,"Invalid variable offset or duplicate");
   }
   int header=b.position();
   Var y=required("lat","lat"),x=required("lon","lon"),z=required("dbz","time","lat","lon");
   require(length(y.dims[0])==SIZE&&length(x.dims[0])==SIZE&&length(z.dims[0])==1,"Unexpected grid");
   for(Var v:Arrays.asList(y,x,z)){
    require(v.type==5||v.type==6,"Expected float/double");require(v.offset>=header,"Header overlaps data");
    require(v.attrs.getOrDefault("scale_factor",1d)==1d&&v.attrs.getOrDefault("add_offset",0d)==0d,"Packed values unsupported");
   }
   double[] lat=axis(y,-90,90),lon=axis(x,-180,180);
   ByteBuffer data=values(z,SIZE*SIZE);float[] result=new float[SIZE*SIZE];
   for(int i=0;i<result.length;i++){
    double raw=numeric(data,z.type);float f=(float)raw;
    boolean special=raw==z.attrs.getOrDefault("_FillValue",Double.NaN)||raw==z.attrs.getOrDefault("missing_value",Double.NaN);
    result[i]=!special&&WeatherMapLayer.usableReflectivity(f)?f:Float.NaN;
   }
   return new RadarCappi(lat,lon,result);
  }
  int length(int i){int n=lengths.get(i);return n==0?records:n;}
  Var required(String key,String... axes)throws IOException{
   Var v=vars.get(key);require(v!=null&&v.dims.length==axes.length,"Missing or invalid "+key);
   for(int i=0;i<axes.length;i++)require(names.get(v.dims[i]).equals(axes[i]),"Invalid axis order");
   return v;
  }
  ByteBuffer values(Var v,int n)throws IOException{
   long bytes=(long)n*width(v.type);require(bytes<=v.size&&v.offset+bytes<=b.limit(),"Truncated values");
   ByteBuffer r=b.duplicate().order(ByteOrder.BIG_ENDIAN);r.position((int)v.offset);r.limit((int)(v.offset+bytes));return r;
  }
  double[] axis(Var v,double min,double max)throws IOException{
   ByteBuffer r=values(v,SIZE);double[] a=new double[SIZE];for(int i=0;i<SIZE;i++){
    a[i]=numeric(r,v.type);require(Double.isFinite(a[i])&&a[i]>=min&&a[i]<=max,"Invalid coordinates");
    if(i>0)require(a[i]!=a[i-1]&&(i==1||(a[i]>a[i-1])==(a[1]>a[0])),"Nonmonotonic coordinates");
   }return a;
  }
 }
}
