package top.monitorglobal.tv;
import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Read-only installer grant for the single APK previously verified by PhoneUpdater. */
public final class PhoneUpdateProvider extends ContentProvider {
 static File apk(Context c){return new File(c.getCacheDir(),"phone-update.apk");}
 private File resolve(Uri uri)throws FileNotFoundException{
  Context c=getContext();
  if(c==null||uri==null||!("/apk".equals(uri.getPath()))||!(c.getPackageName()+".updates").equals(uri.getAuthority())||uri.getQuery()!=null||uri.getFragment()!=null)throw new FileNotFoundException("URI inválida");
  return apk(c);
 }
 @Override public boolean onCreate(){return true;}
 @Override public String getType(Uri u){return "application/vnd.android.package-archive";}
 @Override public ParcelFileDescriptor openFile(Uri u,String mode)throws FileNotFoundException{
  if(!"r".equals(mode))throw new FileNotFoundException("Somente leitura");
  return ParcelFileDescriptor.open(resolve(u),ParcelFileDescriptor.MODE_READ_ONLY);
 }
 @Override public Cursor query(Uri u,String[] p,String selection,String[] args,String order){
  try{File f=resolve(u);MatrixCursor rows=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});rows.addRow(new Object[]{"monitor-global-mobile.apk",f.length()});return rows;}catch(FileNotFoundException e){return null;}
 }
 @Override public Uri insert(Uri u,ContentValues values){throw new UnsupportedOperationException();}
 @Override public int update(Uri u,ContentValues values,String s,String[] a){throw new UnsupportedOperationException();}
 @Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
}
