package app.noir;

import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

import org.json.JSONObject;

/** Funções nativas chamadas pela interface: window.NoirNative.* */
public class Bridge {

    private final MainActivity act;
    private LanServer lan;

    Bridge(MainActivity act) {
        this.act = act;
    }

    /** "tv" ou "mobile" (vem do flavor do build). */
    @JavascriptInterface
    public String mode() {
        return BuildConfig.FLAVOR;
    }

    @JavascriptInterface
    public String version() {
        return BuildConfig.VERSION_NAME;
    }

    /**
     * Abre o player nativo. JSON:
     * {url, title, info, key, live, subUrl, subLang, audioLang, subSize, subsOff, queue:[{title,url,info,key}], index}
     */
    @JavascriptInterface
    public void play(String json) {
        Intent i = new Intent(act, PlayerActivity.class);
        i.putExtra("payload", json);
        act.runOnUiThread(() -> act.startActivity(i));
    }

    /** Abre o vídeo em outro player instalado (VLC, MX Player…). */
    @JavascriptInterface
    public void openExternal(String url, String title) {
        act.runOnUiThread(() -> {
            try {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(Uri.parse(url), "video/*");
                i.putExtra("title", title);
                act.startActivity(Intent.createChooser(i, "Abrir com"));
            } catch (ActivityNotFoundException e) {
                Toast.makeText(act, "Nenhum player externo instalado", Toast.LENGTH_LONG).show();
            }
        });
    }

    /** Progresso salvo pelo player: {"pos":ms,"dur":ms} ou "". */
    @JavascriptInterface
    public String progress(String key) {
        SharedPreferences sp = act.getSharedPreferences("progress", Context.MODE_PRIVATE);
        String v = sp.getString(key, null);
        return v == null ? "" : v;
    }

    /** "" = automático; senão a identificação (User-Agent) escolhida pelo usuário. */
    @JavascriptInterface
    public void setUserAgent(String ua) {
        Net.setForced(ua);
    }

    @JavascriptInterface
    public void toast(String msg) {
        act.runOnUiThread(() -> Toast.makeText(act, msg, Toast.LENGTH_SHORT).show());
    }

    /**
     * Liga o servidor local para adicionar listas pelo celular (mesmo Wi-Fi).
     * Devolve o endereço para o QR Code, ou "" se não houver rede.
     */
    @JavascriptInterface
    public synchronized String startLan() {
        if (lan == null) {
            lan = new LanServer(act, data -> act.js("window.NOIR && NOIR.onLanAdd(" + JSONObject.quote(data) + ")"));
            try {
                lan.start();
            } catch (Exception e) {
                lan = null;
                return "";
            }
        }
        return lan.address();
    }

    @JavascriptInterface
    public synchronized void stopLan() {
        if (lan != null) {
            lan.stop();
            lan = null;
        }
    }

    @JavascriptInterface
    public void exit() {
        act.runOnUiThread(act::finish);
    }
}
