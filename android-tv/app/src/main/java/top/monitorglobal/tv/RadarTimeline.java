package top.monitorglobal.tv;

import java.util.*;

/** Only published observations, in actual chronological order. */
final class RadarTimeline {
 private final List<Long> times=new ArrayList<>();
 private int index=-1;
 void set(List<Long> values,long now){
  TreeSet<Long> sorted=new TreeSet<>();
  for(Long t:values)if(t!=null&&t>0&&t<=now&&now-t<=180*60000L)sorted.add(t);
  times.clear();times.addAll(sorted);
  while(times.size()>6)times.remove(0);
  index=times.size()-1;
 }
 int size(){return times.size();}
 int index(){return index;}
 long current(){return index<0||index>=times.size()?0:times.get(index);}
 long oldest(){index=times.isEmpty()?-1:0;return current();}
 long newest(){index=times.size()-1;return current();}
 long previous(){if(index>0)index--;return current();}
 long next(){if(index+1<times.size())index++;return current();}
 boolean atEnd(){return index>=times.size()-1;}
 boolean select(long at){int i=times.indexOf(at);if(i<0)return false;index=i;return true;}
 void clear(){times.clear();index=-1;}
}
