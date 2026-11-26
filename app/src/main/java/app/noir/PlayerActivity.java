package app.noir;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.BaseAdapter;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ListView;
import android.widget.TextView;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.exoplayer.trackselection.DefaultTrackSelector;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.PlayerView;
import androidx.media3.ui.SubtitleView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Collections;
import java.util.Locale;

/**
 * Player nativo (Media3/ExoPlayer): HLS, MPEG-TS, MP4, MKV, DASH, faixas de áudio e legendas.
 * Ao vivo: lista de canais no próprio player (◀ ou botão "Canais"), ▲/▼ e CH+/CH− trocam de canal.
 * Séries: lista de episódios, "Pular abertura", "Próximo episódio" e passagem automática.
 */
@OptIn(markerClass = UnstableApi.class)
public class PlayerActivity extends Activity {

    private ExoPlayer player;
    private PlayerView view;
    private TextView title, subtitle, hint, error, panelTitle;
    private View infoBar, panel;
    private Button listBtn, skipBtn, nextBtn;
    private ListView panelList;
    private JSONObject payload;
    private JSONArray queue;
    private int index;
    private String key;
    private boolean live, series, skipUsed;
    private int skipIntroSec;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable hideInfo = () -> {
        if (view != null && !view.isControllerFullyVisible() && !panelOpen()) infoBar.setVisibility(View.GONE);
    };
    private final Runnable tick = new Runnable() {
        @Override
        public void run() {
            updateOverlayButtons();
            handler.postDelayed(this, 1000);
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_player);
        view = findViewById(R.id.player_view);
        title = findViewById(R.id.title);
        subtitle = findViewById(R.id.subtitle);
        hint = findViewById(R.id.hint);
        error = findViewById(R.id.error);
        infoBar = findViewById(R.id.info_bar);
        panel = findViewById(R.id.panel);
        panelTitle = findViewById(R.id.panel_title);
        panelList = findViewById(R.id.panel_list);
        listBtn = findViewById(R.id.list_btn);
        skipBtn = findViewById(R.id.skip);
        nextBtn = findViewById(R.id.next);
        view.setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);

        try {
            payload = new JSONObject(getIntent().getStringExtra("payload"));
        } catch (Exception e) {
            finish();
            return;
        }
        queue = payload.optJSONArray("queue");
        index = payload.optInt("index", 0);
        live = payload.optBoolean("live", false);
        series = "series".equals(payload.optString("kind", ""));
        skipIntroSec = payload.optInt("skipIntro", 85);

        Net.init(this);
        String firstUrl = payload.optString("url", "");
        if (queue != null && queue.length() > 0) {
            JSONObject q = queue.optJSONObject(Math.max(0, Math.min(index, queue.length() - 1)));
            if (q != null) firstUrl = q.optString("url", firstUrl);
        }
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(Net.uaFor(firstUrl))
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(30000);
        DefaultMediaSourceFactory msf = new DefaultMediaSourceFactory(new DefaultDataSource.Factory(this, http));

        DefaultTrackSelector ts = new DefaultTrackSelector(this);
        DefaultTrackSelector.Parameters.Builder pb = ts.buildUponParameters();
        String audioLang = payload.optString("audioLang", "");
        String subLang = payload.optString("subLang", "pt");
        if (!audioLang.isEmpty()) pb.setPreferredAudioLanguage(audioLang);
        if (!subLang.isEmpty()) pb.setPreferredTextLanguage(subLang);
        pb.setSelectUndeterminedTextLanguage(true);
        pb.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, payload.optBoolean("subsOff", false));
        ts.setParameters(pb);

        player = new ExoPlayer.Builder(this)
                .setMediaSourceFactory(msf)
                .setTrackSelector(ts)
                .build();
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException e) {
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    player.seekToDefaultPosition();
                    player.prepare();
                    return;
                }
                error.setText("Não foi possível reproduzir este conteúdo.\n"
                        + (live ? "Tente outro canal (◀ abre a lista)." : "Verifique a lista ou tente de novo.")
                        + "\n(" + e.getErrorCodeName() + ")");
                error.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) error.setVisibility(View.GONE);
                if (state == Player.STATE_ENDED && !live) {
                    if (series && hasNext()) loadFromQueue(index + 1);
                    else finish();
                }
            }
        });

        view.setPlayer(player);
        view.setShowSubtitleButton(true);
        view.setControllerShowTimeoutMs(4000);
        view.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> {
            if (!panelOpen()) infoBar.setVisibility(visibility);
            handler.removeCallbacks(hideInfo);
        });
        styleSubtitles(payload.optString("subSize", "M"));

        boolean hasList = queue != null && queue.length() > 1;
        if (hasList) {
            listBtn.setText(live ? "☰  Canais" : "☰  Episódios");
            listBtn.setVisibility(View.VISIBLE);
            listBtn.setOnClickListener(v -> openPanel());
            panelTitle.setText(live ? "Canais" : "Episódios");
            panelList.setAdapter(new QueueAdapter());
            panelList.setOnItemClickListener((parent, v, pos, id) -> {
                closePanel();
                loadFromQueue(pos);
            });
            hint.setText(live ? "◀ lista de canais  ·  ▲▼ trocar canal" : "◀ lista de episódios");
        } else {
            hint.setVisibility(View.GONE);
        }
        skipBtn.setOnClickListener(v -> skipIntro());
        nextBtn.setOnClickListener(v -> { if (hasNext()) loadFromQueue(index + 1); });

        if (queue != null && queue.length() > 0) loadFromQueue(index);
        else load(payload);
        handler.post(tick);
    }

    // ---------- lista (canais / episódios) ----------

    private class QueueAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return queue == null ? 0 : queue.length();
        }

        @Override
        public Object getItem(int i) {
            return queue.optJSONObject(i);
        }

        @Override
        public long getItemId(int i) {
            return i;
        }

        @Override
        public View getView(int i, View convert, ViewGroup parent) {
            LinearLayout row;
            TextView t1, t2;
            if (convert instanceof LinearLayout) {
                row = (LinearLayout) convert;
                t1 = (TextView) row.getChildAt(0);
                t2 = (TextView) row.getChildAt(1);
            } else {
                row = new LinearLayout(PlayerActivity.this);
                row.setOrientation(LinearLayout.VERTICAL);
                int p = dp(12);
                row.setPadding(p, dp(10), p, dp(10));
                t1 = new TextView(PlayerActivity.this);
                t1.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
                t1.setTypeface(Typeface.DEFAULT_BOLD);
                t1.setSingleLine(true);
                t2 = new TextView(PlayerActivity.this);
                t2.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
                t2.setTextColor(0xFFADA3AE);
                t2.setSingleLine(true);
                row.addView(t1);
                row.addView(t2);
            }
            JSONObject o = queue.optJSONObject(i);
            boolean cur = i == index;
            t1.setText((cur ? "▶  " : "") + (o == null ? "" : o.optString("title", "")));
            t1.setTextColor(cur ? 0xFFFF8A3D : 0xFFFBF6EF);
            String info = o == null ? "" : o.optString("info", "");
            t2.setText(info);
            t2.setVisibility(info.isEmpty() ? View.GONE : View.VISIBLE);
            return row;
        }
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private boolean panelOpen() {
        return panel.getVisibility() == View.VISIBLE;
    }

    private void openPanel() {
        if (queue == null || queue.length() < 2) return;
        view.hideController();
        panel.setVisibility(View.VISIBLE);
        infoBar.setVisibility(View.GONE);
        ((BaseAdapter) panelList.getAdapter()).notifyDataSetChanged();
        panelList.setItemChecked(index, true);
        panelList.setSelection(Math.max(0, index - 3));
        panelList.requestFocus();
        panelList.post(() -> {
            panelList.setSelection(index);
            panelList.requestFocus();
        });
    }

    private void closePanel() {
        panel.setVisibility(View.GONE);
        view.requestFocus();
    }

    // ---------- reprodução ----------

    private void styleSubtitles(String size) {
        SubtitleView sv = view.getSubtitleView();
        if (sv == null) return;
        sv.setStyle(new CaptionStyleCompat(Color.WHITE, 0x99000000, Color.TRANSPARENT,
                CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, Typeface.DEFAULT_BOLD));
        float f = SubtitleView.DEFAULT_TEXT_SIZE_FRACTION;
        if ("P".equals(size)) f *= 0.8f;
        else if ("G".equals(size)) f *= 1.35f;
        sv.setFractionalTextSize(f);
    }

    private boolean hasNext() {
        return queue != null && index + 1 < queue.length();
    }

    private void loadFromQueue(int i) {
        if (queue == null || i < 0 || i >= queue.length()) return;
        JSONObject item = queue.optJSONObject(i);
        if (item == null) return;
        index = i;
        load(item);
    }

    private void load(JSONObject item) {
        saveProgress();
        String url = item.optString("url", payload.optString("url"));
        key = item.optString("key", url);
        skipUsed = false;
        title.setText(item.optString("title", payload.optString("title", "")));
        String info = item.optString("info", "");
        subtitle.setText(info);
        subtitle.setVisibility(info.isEmpty() ? View.GONE : View.VISIBLE);
        error.setVisibility(View.GONE);
        skipBtn.setVisibility(View.GONE);
        nextBtn.setVisibility(View.GONE);

        MediaItem.Builder mb = new MediaItem.Builder().setUri(Uri.parse(url));
        String lower = url.toLowerCase(Locale.US);
        if (lower.contains(".m3u8")) mb.setMimeType(MimeTypes.APPLICATION_M3U8);
        else if (lower.contains(".mpd")) mb.setMimeType(MimeTypes.APPLICATION_MPD);

        String subUrl = payload.optString("subUrl", "");
        if (!subUrl.isEmpty() && !live) {
            String mime = subUrl.toLowerCase(Locale.US).contains(".srt") ? MimeTypes.APPLICATION_SUBRIP : MimeTypes.TEXT_VTT;
            mb.setSubtitleConfigurations(Collections.singletonList(
                    new MediaItem.SubtitleConfiguration.Builder(Uri.parse(subUrl))
                            .setMimeType(mime)
                            .setLanguage(payload.optString("subLang", "pt"))
                            .setSelectionFlags(C.SELECTION_FLAG_DEFAULT)
                            .build()));
        }

        player.setMediaItem(mb.build());
        if (!live) {
            long[] p = readProgress(key);
            if (p[0] > 30_000 && (p[1] <= 0 || p[0] < p[1] - 60_000)) {
                player.seekTo(p[0]);
                skipUsed = true; // retomando: a abertura já passou
            }
        }
        player.prepare();
        player.setPlayWhenReady(true);
        recordHistory(item, url);
        showInfo();
    }

    /** Mostra "Pular abertura" no início e "Próximo episódio" no fim (séries). */
    private void updateOverlayButtons() {
        if (player == null || live || panelOpen()) {
            skipBtn.setVisibility(View.GONE);
            nextBtn.setVisibility(View.GONE);
            return;
        }
        long pos = player.getCurrentPosition();
        long dur = player.getDuration();
        boolean showSkip = series && skipIntroSec > 0 && !skipUsed && pos > 2_000 && pos < 240_000
                && (dur == C.TIME_UNSET || dur > 8 * 60_000);
        boolean showNext = series && hasNext() && dur != C.TIME_UNSET && dur > 0 && dur - pos < 60_000;
        if (showNext) showSkip = false;
        skipBtn.setVisibility(showSkip ? View.VISIBLE : View.GONE);
        nextBtn.setVisibility(showNext ? View.VISIBLE : View.GONE);
    }

    private void skipIntro() {
        if (player == null) return;
        long target = player.getCurrentPosition() + skipIntroSec * 1000L;
        long dur = player.getDuration();
        if (dur != C.TIME_UNSET && target > dur - 5_000) target = Math.max(0, dur - 5_000);
        player.seekTo(target);
        skipUsed = true;
        skipBtn.setVisibility(View.GONE);
    }

    private void showInfo() {
        if (panelOpen()) return;
        infoBar.setVisibility(View.VISIBLE);
        handler.removeCallbacks(hideInfo);
        handler.postDelayed(hideInfo, 4500);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        if (e.getAction() != KeyEvent.ACTION_DOWN) return super.dispatchKeyEvent(e);
        int k = e.getKeyCode();
        if (panelOpen()) {
            if (k == KeyEvent.KEYCODE_BACK || k == KeyEvent.KEYCODE_DPAD_RIGHT || k == KeyEvent.KEYCODE_MENU) {
                closePanel();
                return true;
            }
            return super.dispatchKeyEvent(e);
        }
        boolean controllerUp = view.isControllerFullyVisible();
        boolean hasList = queue != null && queue.length() > 1;
        if (!controllerUp) {
            // Botões "Pular abertura" / "Próximo episódio" respondem ao OK do controle.
            if (k == KeyEvent.KEYCODE_DPAD_CENTER || k == KeyEvent.KEYCODE_ENTER) {
                if (skipBtn.getVisibility() == View.VISIBLE) { skipIntro(); return true; }
                if (nextBtn.getVisibility() == View.VISIBLE && hasNext()) { loadFromQueue(index + 1); return true; }
            }
            if (hasList && (k == KeyEvent.KEYCODE_DPAD_LEFT || k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_GUIDE)) {
                openPanel();
                return true;
            }
            if (live && hasList) {
                if (k == KeyEvent.KEYCODE_CHANNEL_UP || k == KeyEvent.KEYCODE_DPAD_UP) {
                    loadFromQueue((index - 1 + queue.length()) % queue.length());
                    return true;
                }
                if (k == KeyEvent.KEYCODE_CHANNEL_DOWN || k == KeyEvent.KEYCODE_DPAD_DOWN) {
                    loadFromQueue((index + 1) % queue.length());
                    return true;
                }
            }
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (panelOpen()) {
            closePanel();
            return;
        }
        super.onBackPressed();
    }

    // ---------- histórico e progresso ----------

    /** Guarda o que foi aberto para "Continuar assistindo" / "Assistidos recentemente". */
    private void recordHistory(JSONObject item, String url) {
        JSONObject h = item.optJSONObject("hist");
        if (h == null) h = payload.optJSONObject("hist");
        if (h == null) return;
        try {
            JSONObject e = new JSONObject(h.toString());
            e.put("url", url);
            e.put("at", System.currentTimeMillis());
            SharedPreferences sp = getSharedPreferences("history", Context.MODE_PRIVATE);
            JSONArray old = new JSONArray(sp.getString("list", "[]"));
            JSONArray out = new JSONArray();
            out.put(e);
            String id = e.optString("id");
            for (int i = 0; i < old.length() && out.length() < 60; i++) {
                JSONObject o = old.optJSONObject(i);
                if (o != null && !id.equals(o.optString("id"))) out.put(o);
            }
            sp.edit().putString("list", out.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    private long[] readProgress(String k) {
        try {
            SharedPreferences sp = getSharedPreferences("progress", Context.MODE_PRIVATE);
            JSONObject o = new JSONObject(sp.getString(k, "{}"));
            return new long[]{o.optLong("pos", 0), o.optLong("dur", 0)};
        } catch (Exception e) {
            return new long[]{0, 0};
        }
    }

    private void saveProgress() {
        if (player == null || live || key == null) return;
        long pos = player.getCurrentPosition();
        long dur = player.getDuration();
        if (pos <= 0) return;
        try {
            JSONObject o = new JSONObject();
            o.put("pos", pos);
            o.put("dur", dur == C.TIME_UNSET ? 0 : dur);
            o.put("at", System.currentTimeMillis());
            getSharedPreferences("progress", Context.MODE_PRIVATE).edit().putString(key, o.toString()).apply();
        } catch (Exception ignored) {
        }
    }

    @Override
    protected void onPause() {
        saveProgress();
        if (player != null) player.pause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (player != null) player.play();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (player != null) {
            saveProgress();
            player.release();
            player = null;
        }
        super.onDestroy();
    }
}
