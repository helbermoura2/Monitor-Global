package top.monitorglobal.tv;

import android.app.*;import android.content.*;import android.graphics.*;import android.media.*;import android.os.*;import android.provider.Settings;import android.text.TextUtils;import android.view.*;import android.widget.*;
/** Fifteen-second regional notice: solid broadcast card, local flag and decorative vector icons. */
final class CompactNotice {
 static final long DURATION_MS=15000;
 private final Context context;private final Handler main=new Handler(Looper.getMainLooper());private View current;private ToneGenerator tone;
 private Bitmap countryFlag;private ImageView flagView;
 private final Runnable dismiss=()->exit();
 CompactNotice(Context c){context=c;}
 private int dp(int value){return Math.round(value*context.getResources().getDisplayMetrics().density);}
 void show(Alert alert,boolean demo){show(alert,demo,false);}
 void show(Alert alert,boolean demo,boolean replay){show(alert,demo,replay,false);}
 void showVoiceBrazil(Alert alert){show(alert,false,true,true);}
 private void show(Alert alert,boolean demo,boolean replay,boolean voiceQuery){
  hide();boolean shown=false;
  if(Settings.canDrawOverlays(context))try{
   Typeface brand=TvCardStyle.brand(context);
   LinearLayout card=new Panel(context);card.setOrientation(LinearLayout.VERTICAL);card.setBackgroundColor(TvCardStyle.BODY);
   TextView header=text(voiceQuery?"MONITOR GLOBAL · CONSULTA POR VOZ":demo?"AVISO SÍSMICO REGIONAL · FICTÍCIO":replay?"REPLAY · SISMO REGIONAL":"AVISO SÍSMICO REGIONAL",15,TvCardStyle.BODY,brand,1);header.setBackgroundColor(TvCardStyle.CYAN);header.setPadding(dp(16),dp(9),dp(16),dp(9));card.addView(header,new LinearLayout.LayoutParams(-1,-2));
   LinearLayout body=new LinearLayout(context);body.setOrientation(LinearLayout.VERTICAL);body.setPadding(dp(18),dp(13),dp(18),dp(13));card.addView(body,new LinearLayout.LayoutParams(-1,-2));
   LinearLayout headline=new LinearLayout(context);headline.setGravity(Gravity.CENTER_VERTICAL);body.addView(headline,new LinearLayout.LayoutParams(-1,-2));
   TextView magnitude=text(magnitude(alert),44,voiceQuery?TvCardStyle.WHITE:0xffffc04d,brand,1);magnitude.setGravity(Gravity.CENTER_VERTICAL);headline.addView(magnitude,new LinearLayout.LayoutParams(dp(96),dp(66)));
   countryFlag=CountryFlag.load(context,alert);
   if(countryFlag!=null){flagView=new ImageView(context);flagView.setImageBitmap(countryFlag);flagView.setScaleType(ImageView.ScaleType.FIT_CENTER);flagView.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);LinearLayout.LayoutParams flagParams=new LinearLayout.LayoutParams(dp(40),dp(44));flagParams.setMarginEnd(dp(10));headline.addView(flagView,flagParams);}
   TextView place=text(location(alert),24,TvCardStyle.WHITE,brand,2);headline.addView(place,new LinearLayout.LayoutParams(0,-2,1));
   LinearLayout details=new LinearLayout(context);details.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams detailParams=new LinearLayout.LayoutParams(-1,-2);detailParams.topMargin=dp(11);body.addView(details,detailParams);
   metric(details,0,Double.isFinite(alert.depth)&&alert.depth>=0?String.format(java.util.Locale.forLanguageTag("pt-BR"),"Profundidade: %.0f km",alert.depth):"Profundidade não informada",brand);
   metric(details,1,replay?timeWithDate(alert.eventTime):time(alert.eventTime),brand);
   if(!alert.targetArea.isEmpty()&&!samePlace(location(alert),alert.targetArea)){TextView area=text("Área monitorada: "+alert.targetArea,13,TvCardStyle.MUTED,Typeface.DEFAULT,2);LinearLayout.LayoutParams areaParams=new LinearLayout.LayoutParams(-1,-2);areaParams.topMargin=dp(8);body.addView(area,areaParams);}
   LinearLayout footer=new LinearLayout(context);footer.setOrientation(LinearLayout.VERTICAL);footer.setBackgroundColor(TvCardStyle.FOOT);footer.setPadding(dp(16),dp(8),dp(16),dp(8));card.addView(footer,new LinearLayout.LayoutParams(-1,-2));
   footer.addView(text(alert.source.isEmpty()?"Fonte não informada":"Fonte: "+alert.source,14,TvCardStyle.MUTED,brand,2),new LinearLayout.LayoutParams(-1,-2));
   footer.addView(text(voiceQuery?"CONSULTA HISTÓRICA · NÃO É NOVO ALERTA":"Danos: sem informação",13,TvCardStyle.MUTED,Typeface.DEFAULT,2),new LinearLayout.LayoutParams(-1,-2));
   card.setContentDescription((voiceQuery?"Consulta por voz de sismo no Brasil, não é novo alerta. ":demo?"Teste fictício, não é alerta real. ":replay?"Replay histórico, não é novo alerta. ":"Aviso sísmico regional. ")+alert.title+". "+(Double.isFinite(alert.depth)?"Profundidade: "+alert.depth+" km. ":"Profundidade não informada. ")+(replay?timeWithDate(alert.eventTime):time(alert.eventTime))+". "+alert.targetArea+". "+(alert.source.isEmpty()?"Fonte não informada. ":"Fonte: "+alert.source+". ")+(voiceQuery?"Consulta histórica, não é novo alerta.":"Danos: sem informação."));
   WindowManager.LayoutParams p=new WindowManager.LayoutParams(Math.min(dp(420),context.getResources().getDisplayMetrics().widthPixels*46/100),WindowManager.LayoutParams.WRAP_CONTENT,WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE|WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,PixelFormat.TRANSLUCENT);p.gravity=Gravity.BOTTOM|Gravity.RIGHT;p.x=dp(32);p.y=dp(32);
   ((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).addView(card,p);current=card;shown=true;
   CardMotion.enter(card,context);
   main.postDelayed(dismiss,DURATION_MS);
  }catch(RuntimeException e){hide();}
  if(!shown)try{PendingIntent open=PendingIntent.getActivity(context,1,new Intent(context,MainActivity.class),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);context.getSystemService(NotificationManager.class).notify(2,new Notification.Builder(context,"alerts").setSmallIcon(R.drawable.ic_monitor).setContentTitle((voiceQuery?"CONSULTA POR VOZ · ":demo?"TESTE FICTÍCIO · ":replay?"REPLAY HISTÓRICO · ":"ÁREA MONITORADA · ")+alert.title).setContentText(alert.targetArea+" · Danos: sem informação").setContentIntent(open).setAutoCancel(true).build());}catch(RuntimeException ignored){}
  if(!replay&&Prefs.get(context).getBoolean("sound",true))try{tone=new ToneGenerator(AudioManager.STREAM_NOTIFICATION,45);tone.startTone(ToneGenerator.TONE_PROP_BEEP,160);main.postDelayed(()->{if(tone!=null){tone.release();tone=null;}},300);}catch(RuntimeException ignored){}
 }
 static String magnitude(Alert alert){if(Double.isFinite(alert.magnitude)&&alert.magnitude>=0)return String.format(java.util.Locale.forLanguageTag("pt-BR"),"M%.1f",alert.magnitude);java.util.regex.Matcher m=java.util.regex.Pattern.compile("^(M[0-9]+[,.][0-9]+)\\s*·").matcher(alert.title);return m.find()?m.group(1):"M—";}
 static String location(Alert alert){return alert.title.replaceFirst("^M[0-9]+[,.][0-9]+\\s*·\\s*","").replaceFirst(" · EXEMPLO$","");}
 private static boolean samePlace(String a,String b){return a.replace(" · ",", ").equalsIgnoreCase(b.replace(" · ",", "));}
 private static String time(long at){if(at<=0)return "Horário não informado";java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("HH:mm 'BRT'",java.util.Locale.ROOT);format.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return format.format(new java.util.Date(at));}
 private static String timeWithDate(long at){if(at<=0)return "Horário não informado";java.text.SimpleDateFormat format=new java.text.SimpleDateFormat("dd/MM/yyyy HH:mm 'BRT'",java.util.Locale.ROOT);format.setTimeZone(java.util.TimeZone.getTimeZone("America/Sao_Paulo"));return format.format(new java.util.Date(at));}
 private TextView text(String value,int size,int color,Typeface face,int lines){TextView text=new TextView(context);text.setText(value);text.setTextSize(size);text.setTextColor(color);text.setTypeface(face);text.setMaxLines(lines);text.setEllipsize(TextUtils.TruncateAt.END);text.setIncludeFontPadding(false);return text;}
 private void metric(LinearLayout row,int kind,String value,Typeface font){LinearLayout group=new LinearLayout(context);group.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams item=new LinearLayout.LayoutParams(0,-2,1);if(kind==1)item.setMarginStart(dp(12));row.addView(group,item);Icon icon=new Icon(context,kind);LinearLayout.LayoutParams iconParams=new LinearLayout.LayoutParams(dp(21),dp(23));iconParams.setMarginEnd(dp(7));group.addView(icon,iconParams);TextView label=text(value,15,0xffd6e4ee,font,2);group.addView(label,new LinearLayout.LayoutParams(0,-2,1));}
 private void exit(){if(current==null)return;View card=current;CardMotion.exit(card,context,()->{if(current==card)hide();});}
 void hide(){main.removeCallbacksAndMessages(null);try{context.getSystemService(NotificationManager.class).cancel(2);}catch(RuntimeException ignored){}if(current!=null){current.animate().cancel();try{((WindowManager)context.getSystemService(Context.WINDOW_SERVICE)).removeView(current);}catch(RuntimeException ignored){}current=null;}if(flagView!=null){flagView.setImageDrawable(null);flagView=null;}if(countryFlag!=null){countryFlag.recycle();countryFlag=null;}if(tone!=null){tone.release();tone=null;}}
 private static final class Panel extends LinearLayout {
  private final Path clip=new Path();private final float radius;
  Panel(Context c){super(c);radius=8*c.getResources().getDisplayMetrics().density;}
  @Override protected void onSizeChanged(int w,int h,int oldw,int oldh){super.onSizeChanged(w,h,oldw,oldh);clip.reset();clip.addRoundRect(0,0,w,h,new float[]{0,0,0,0,radius,radius,radius,radius},Path.Direction.CW);}
  @Override public void draw(Canvas canvas){int save=canvas.save();canvas.clipPath(clip);super.draw(canvas);canvas.restoreToCount(save);}
 }
 private static final class Icon extends View {
  private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);private final int kind;
  Icon(Context c,int type){super(c);kind=type;paint.setColor(0xffd6e4ee);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND);setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO);}
  @Override protected void onDraw(Canvas canvas){super.onDraw(canvas);int save=canvas.save();canvas.translate((getWidth()-Math.min(getWidth(),getHeight()))/2f,(getHeight()-Math.min(getWidth(),getHeight()))/2f);float unit=Math.min(getWidth(),getHeight())/24f;canvas.scale(unit,unit);if(kind==0){canvas.drawLine(12,2,12,14,paint);canvas.drawLine(7,9,12,14,paint);canvas.drawLine(12,14,17,9,paint);canvas.drawLine(4,19,20,19,paint);canvas.drawLine(4,23,20,23,paint);}else{canvas.drawCircle(12,12,9,paint);canvas.drawLine(12,6,12,12,paint);canvas.drawLine(12,12,17,15,paint);}canvas.restoreToCount(save);}
 }
}
