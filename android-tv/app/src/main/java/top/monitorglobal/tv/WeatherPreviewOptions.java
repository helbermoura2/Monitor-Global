package top.monitorglobal.tv;
import android.app.*;import android.content.*;import android.graphics.Color;import android.widget.*;
/** Visual demonstration settings, independent of the real forecast. */
final class WeatherPreviewOptions {
 static final String[] STYLES={"Chuva no vidro","Chuva na cena","Combinação suave"};
 static final String[] LEVELS={"Fraca","Moderada","Forte","Tempestade"};
 static int valid(int value,int count,int fallback){return value>=0&&value<count?value:fallback;}
 static int style(Context c){return valid(Prefs.get(c).getInt("previewRainStyle",2),3,2);}
 static int level(Context c){return valid(Prefs.get(c).getInt("previewRainLevel",1),4,1);}
 static boolean lightning(Context c){return Prefs.get(c).getBoolean("previewLightning",true);}
 static double rate(Context c){return new double[]{1,4,12,60}[level(c)];}
 static void show(Activity a,Runnable play){
  LinearLayout body=new LinearLayout(a);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(24,12,24,12);
  TextView text=new TextView(a);text.setText("Compare os três estilos e quatro intensidades visuais. Todos os dados são fictícios. Tempestade é um cenário de demonstração; não é uma classificação emitida pelo fornecedor.");text.setTextColor(Color.WHITE);text.setTextSize(17);body.addView(text);
  Button style=new Button(a);style.setAllCaps(false);style.setText("Estilo: "+STYLES[style(a)]);body.addView(style);
  style.setOnClickListener(v->new AlertDialog.Builder(a).setTitle("Estilo da prévia").setSingleChoiceItems(STYLES,style(a),(d,i)->{Prefs.get(a).edit().putInt("previewRainStyle",i).apply();style.setText("Estilo: "+STYLES[i]);d.dismiss();}).setNegativeButton("Cancelar",null).show());
  Button level=new Button(a);level.setAllCaps(false);level.setText("Intensidade visual: "+LEVELS[level(a)]);body.addView(level);
  level.setOnClickListener(v->new AlertDialog.Builder(a).setTitle("Intensidade visual fictícia").setSingleChoiceItems(LEVELS,level(a),(d,i)->{Prefs.get(a).edit().putInt("previewRainLevel",i).apply();level.setText("Intensidade visual: "+LEVELS[i]);d.dismiss();}).setNegativeButton("Cancelar",null).show());
  Switch bolts=new Switch(a);bolts.setText("Relâmpagos simulados");bolts.setTextColor(Color.WHITE);bolts.setChecked(lightning(a));bolts.setOnCheckedChangeListener((v,on)->Prefs.get(a).edit().putBoolean("previewLightning",on).apply());body.addView(bolts);
  ScrollView scroll=new ScrollView(a);scroll.addView(body);
  new AlertDialog.Builder(a).setTitle("Prévia da chuva e dos relâmpagos").setView(scroll).setPositiveButton("Ver em 10 segundos",(d,w)->play.run()).setNegativeButton("Fechar",null).show();
 }
}
