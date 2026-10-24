package top.monitorglobal.tv;
import android.content.*;import android.database.*;import android.net.Uri;import android.os.ParcelFileDescriptor;import android.provider.OpenableColumns;import java.io.*;
/** Private fixed-file provider: installer receives a temporary read grant for this APK only. */
public final class OfficialApkProvider extends ContentProvider {
 static File apk(Context c){return new File(c.getCacheDir(),"official-update.apk");}
 private File file(Uri uri) throws FileNotFoundException {if(getContext()==null||!"/apk".equals(uri.getPath())||!(getContext().getPackageName()+".updates").equals(uri.getAuthority())||uri.getQuery()!=null)throw new FileNotFoundException("URI inválida");return apk(getContext());}
 @Override public boolean onCreate(){return true;}
 @Override public String getType(Uri uri){return "application/vnd.android.package-archive";}
 @Override public ParcelFileDescriptor openFile(Uri uri,String mode) throws FileNotFoundException {if(!"r".equals(mode))throw new FileNotFoundException("Somente leitura");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String sort){try{File f=file(uri);MatrixCursor out=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});out.addRow(new Object[]{"monitor-global-tv.apk",f.length()});return out;}catch(FileNotFoundException e){return null;}}
 @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
 @Override public int update(Uri u,ContentValues v,String w,String[] a){throw new UnsupportedOperationException();}
 @Override public int delete(Uri u,String w,String[] a){throw new UnsupportedOperationException();}
}
