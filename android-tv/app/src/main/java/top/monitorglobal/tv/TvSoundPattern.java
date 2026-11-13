package top.monitorglobal.tv;

/** Local, bounded PCM cues; no network, speech, or dependence on device beep packs. */
enum TvSoundPattern {
 EARTHQUAKE("Sismo",80,new int[][]{{620,220},{0,110},{830,220},{0,110},{620,340}}),
 TSUNAMI("Tsunami · aviso ativo",100,new int[][]{{660,190},{990,190},{0,100},{660,190},{990,190},{0,100},{660,190},{990,300}}),
 TSUNAMI_END("Tsunami · informação / encerramento",65,new int[][]{{880,240},{0,70},{660,260},{0,70},{440,400}}),
 REGIONAL("Sismo regional M5+",60,new int[][]{{740,180},{0,170},{740,300}}),
 RAIN("Aviso de chuva",50,new int[][]{{1200,150},{0,90},{950,180},{0,90},{700,290}}),
 WEATHER("Boletim do tempo",20,new int[][]{{520,230},{0,80},{780,380}}),
 MARKET("Brent e dólar",20,new int[][]{{880,100},{0,90},{1100,180},{0,90},{880,100}}),
 SUMMARY("Resumo sísmico diário",30,new int[][]{{440,180},{0,80},{550,180},{0,80},{660,380}});
 static final int RATE=24000;
 final String label;final int priority;private final int[][] notes;
 TvSoundPattern(String label,int priority,int[][] notes){this.label=label;this.priority=priority;this.notes=notes;}
 String preference(){return "soundCue_"+name();}
 int duration(){int ms=100;for(int[] note:notes)ms+=note[1];return ms;}
 short[] pcm(int level){
  short[] out=new short[duration()*RATE/1000];int offset=0;double gain=Math.max(0,Math.min(100,level))/100.0*.62*Short.MAX_VALUE;
  for(int[] note:notes){int count=note[1]*RATE/1000;
   if(note[0]>0)for(int n=0;n<count;n++){double fade=Math.min(1,Math.min(n/(RATE*.012),(count-1-n)/(RATE*.040)));double phase=2*Math.PI*note[0]*n/RATE;out[offset+n]=(short)Math.round(gain*fade*(.82*Math.sin(phase)+.18*Math.sin(2*phase)));}
   offset+=count;
  }return out;
 }
 static TvSoundPattern alert(Alert a,boolean replay){
  if(a==null||replay||a.quietInformation())return null;
  if("tsunami".equals(a.kind))return "ended".equals(a.state)||"information".equals(a.state)||"unknown".equals(a.state)?TSUNAMI_END:TSUNAMI;
  if(!"earthquake".equals(a.kind))return null;
  if(a.companion!=null&&"tsunami".equals(a.companion.kind)&&!a.companion.quietInformation()&&java.util.Arrays.asList("warning","watch","advisory").contains(a.companion.state))return TSUNAMI;
  return a.compact?REGIONAL:EARTHQUAKE;
 }
}
