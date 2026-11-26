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
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
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

/** Player nativo (Media3/ExoPlayer): HLS, MPEG-TS, MP4, MKV, DASH, faixas de áudio e legendas. */
@OptIn(markerClass = UnstableApi.class)
public class PlayerActivity extends Activity {

    private ExoPlayer player;
    private PlayerView view;
    private TextView title, subtitle, error;
    private View infoBar;
    private JSONObject payload;
    private JSONArray queue;
    private int index;
    private String key;
    private boolean live;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable hideInfo = () -> {
        if (view != null && !view.isControllerFullyVisible()) infoBar.setVisibility(View.GONE);
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        setContentView(R.layout.activity_player);
        view = findViewById(R.id.player_view);
        title = findViewById(R.id.title);
        subtitle = findViewById(R.id.subtitle);
        error = findViewById(R.id.error);
        infoBar = findViewById(R.id.info_bar);
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

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(Net.UA)
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
                        + "Verifique a lista ou tente outro canal.\n(" + e.getErrorCodeName() + ")");
                error.setVisibility(View.VISIBLE);
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_READY) error.setVisibility(View.GONE);
                if (state == Player.STATE_ENDED && !live) finish();
            }
        });

        view.setPlayer(player);
        view.setShowSubtitleButton(true);
        view.setControllerShowTimeoutMs(4000);
        view.setControllerVisibilityListener((PlayerView.ControllerVisibilityListener) visibility -> {
            infoBar.setVisibility(visibility);
            handler.removeCallbacks(hideInfo);
        });
        styleSubtitles(payload.optString("subSize", "M"));

        if (queue != null && queue.length() > 0) {
            loadFromQueue(index);
        } else {
            load(payload);
        }
    }

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

    private void loadFromQueue(int i) {
        try {
            JSONObject item = queue.getJSONObject(i);
            index = i;
            load(item);
        } catch (Exception ignored) {
        }
    }

    private void load(JSONObject item) {
        saveProgress();
        String url = item.optString("url", payload.optString("url"));
        key = item.optString("key", url);
        title.setText(item.optString("title", payload.optString("title", "")));
        String info = item.optString("info", "");
        subtitle.setText(info);
        subtitle.setVisibility(info.isEmpty() ? View.GONE : View.VISIBLE);
        error.setVisibility(View.GONE);

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
            if (p[0] > 30_000 && (p[1] <= 0 || p[0] < p[1] - 60_000)) player.seekTo(p[0]);
        }
        player.prepare();
        player.setPlayWhenReady(true);
        showInfo();
    }

    private void showInfo() {
        infoBar.setVisibility(View.VISIBLE);
        handler.removeCallbacks(hideInfo);
        handler.postDelayed(hideInfo, 4000);
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        boolean canZap = live && queue != null && queue.length() > 1;
        if (canZap && e.getAction() == KeyEvent.ACTION_DOWN && !view.isControllerFullyVisible()) {
            int k = e.getKeyCode();
            if (k == KeyEvent.KEYCODE_CHANNEL_UP || k == KeyEvent.KEYCODE_DPAD_UP) {
                loadFromQueue((index - 1 + queue.length()) % queue.length());
                return true;
            }
            if (k == KeyEvent.KEYCODE_CHANNEL_DOWN || k == KeyEvent.KEYCODE_DPAD_DOWN) {
                loadFromQueue((index + 1) % queue.length());
                return true;
            }
        }
        return super.dispatchKeyEvent(e);
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
