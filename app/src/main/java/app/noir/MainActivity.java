package app.noir;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.webkit.WebViewAssetLoader;

/**
 * Tela principal: a interface inteira roda num WebView (assets/web),
 * servida pela origem https://appassets.androidplatform.net.
 * Rotas especiais interceptadas aqui:
 *   /proxy?u=URL  -> baixa a URL (listas M3U, APIs Xtream) sem bloqueio de CORS
 *   /epg?u=URL    -> baixa e converte um guia XMLTV em JSON compacto
 */
public class MainActivity extends Activity {

    static final String ORIGIN = "https://appassets.androidplatform.net";

    static final int REQ_FILE = 41;

    WebView web;
    Bridge bridge;
    ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        Net.init(this);

        web = new WebView(this);
        web.setBackgroundColor(0xFF100D14);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        setContentView(web);
        hideSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " GatoflixApp/" + BuildConfig.VERSION_NAME);

        final WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("appassets.androidplatform.net".equals(uri.getHost())) {
                    String path = uri.getPath() == null ? "" : uri.getPath();
                    if (path.equals("/proxy")) return Net.proxy(uri.getQueryParameter("u"));
                    if (path.equals("/epg")) return Net.epg(uri.getQueryParameter("u"));
                    return loader.shouldInterceptRequest(uri);
                }
                return null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                // Navegação só dentro do app.
                return !request.getUrl().toString().startsWith(ORIGIN);
            }
        });

        // Seletor de arquivo (importar lista .m3u do aparelho/pendrive).
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(Intent.createChooser(i, "Escolha a lista"), REQ_FILE);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    bridge.toast("Nenhum gerenciador de arquivos instalado");
                    return false;
                }
                return true;
            }
        });

        bridge = new Bridge(this);
        web.addJavascriptInterface(bridge, "NoirNative");
        web.loadUrl(ORIGIN + "/assets/web/index.html");
        web.requestFocus(View.FOCUS_DOWN);
    }

    void hideSystemBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    /** Executa JS na página (sempre na thread principal). */
    void js(final String code) {
        runOnUiThread(() -> { if (web != null) web.evaluateJavascript(code, null); });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_FILE && fileCallback != null) {
            Uri[] result = null;
            if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
            fileCallback.onReceiveValue(result);
            fileCallback = null;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        hideSystemBars();
        if (web != null) {
            web.onResume();
            js("window.NOIR && NOIR.onResume && NOIR.onResume()");
        }
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // A interface decide se o "voltar" fecha um painel ou sai do app.
        web.evaluateJavascript("window.NOIR ? String(NOIR.back()) : 'false'", value -> {
            if (value == null || !value.contains("true")) finish();
        });
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) bridge.stopLan();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
