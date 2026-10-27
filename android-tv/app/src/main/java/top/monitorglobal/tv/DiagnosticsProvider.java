package top.monitorglobal.tv;
import android.content.*;import android.database.*;import android.net.Uri;import android.os.ParcelFileDescriptor;import android.provider.OpenableColumns;import java.io.*;
/** Fixed diagnostic export only; owner grants temporary read access via Android sharing UI. */
public final class DiagnosticsProvider extends ContentProvider {
 private File file(Uri uri) throws FileNotFoundException {if(getContext()==null||!(getContext().getPackageName()+".diagnostics").equals(uri.getAuthority())||!"/report".equals(uri.getPath())||uri.getQuery()!=null||uri.getFragment()!=null)throw new FileNotFoundException("URI inválida");return new File(getContext().getCacheDir(),"runtime-diagnostics-export.json");}
 public boolean onCreate(){return true;}public String getType(Uri uri){return "application/json";}
 public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{if(!"r".equals(mode))throw new FileNotFoundException("Somente leitura");return ParcelFileDescriptor.open(file(uri),ParcelFileDescriptor.MODE_READ_ONLY);}
 public Cursor query(Uri uri,String[] p,String s,String[] a,String sort){try{File f=file(uri);MatrixCursor c=new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE});c.addRow(new Object[]{"monitor-global-tv-diagnostico.json",f.length()});return c;}catch(FileNotFoundException e){return null;}}
 public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
}
