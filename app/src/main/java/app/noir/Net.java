package app.noir;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.Xml;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;
import org.xmlpull.v1.XmlPullParser;

import java.io.BufferedInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.TimeZone;
import java.util.zip.GZIPInputStream;

/** Rede: download de listas/APIs para a interface e conversão do guia XMLTV. */
final class Net {

    /**
     * Muitos servidores IPTV só respondem a players conhecidos. O app tenta estas
     * identificações em ordem e lembra, por servidor, a primeira que funcionou.
     */
    static final String[] UAS = {
            "VLC/3.0.20 LibVLC/3.0.20",
            "IPTVSmartersPlayer",
            "TiviMate/5.1.6 (Android 11)",
            "okhttp/4.12.0",
            "Dalvik/2.1.0 (Linux; U; Android 11; Android TV Build/RP1A)",
            "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36",
    };
    static final String UA = UAS[0];

    /** Identificação escolhida em Configurações ("" = automático). */
    static volatile String forcedUa = "";
    private static SharedPreferences prefs;

    static synchronized void init(Context c) {
        if (prefs == null) prefs = c.getApplicationContext().getSharedPreferences("ua", Context.MODE_PRIVATE);
        if (forcedUa.isEmpty()) forcedUa = prefs.getString("__forced", "");
    }

    static void setForced(String ua) {
        forcedUa = ua == null ? "" : ua.trim();
        if (prefs != null) prefs.edit().putString("__forced", forcedUa).apply();
    }

    private static String host(String url) {
        try {
            Uri u = Uri.parse(url);
            return u.getHost() + ":" + u.getPort();
        } catch (Exception e) {
            return url;
        }
    }

    /** Identificação a usar para esta URL (a escolhida, a que funcionou antes, ou VLC). */
    static String uaFor(String url) {
        if (!forcedUa.isEmpty()) return forcedUa;
        String v = prefs == null ? null : prefs.getString(host(url), null);
        return v == null ? UAS[0] : v;
    }

    private static void remember(String url, String ua) {
        if (prefs != null) prefs.edit().putString(host(url), ua).apply();
    }

    /** Códigos que costumam significar "player não autorizado". */
    private static boolean refused(int code) {
        return code == 401 || code == 403 || code == 404 || code == 405 || code == 406 || code == 429
                || code == 451 || code == 456 || code == 458 || code == 502 || code == 503 || code == 512 || code == 884;
    }

    private Net() {}

    static WebResourceResponse proxy(String url) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return error(400, "URL inválida");
        }
        try {
            HttpURLConnection c = open(url);
            int code = c.getResponseCode();
            InputStream in = code >= 400 ? c.getErrorStream() : c.getInputStream();
            if (in == null) in = new ByteArrayInputStream(new byte[0]);
            in = maybeGunzip(in, url, c.getContentEncoding());
            String type = c.getContentType();
            String mime = "text/plain";
            if (type != null && type.contains("json")) mime = "application/json";
            Map<String, String> h = cors();
            return new WebResourceResponse(mime, "utf-8", code, reason(code), h, in);
        } catch (Exception e) {
            return error(502, "Falha ao baixar: " + e.getMessage());
        }
    }

    /** Baixa um XMLTV e devolve JSON: {"channels":{id:{n,i}},"progs":{id:[[ini,fim,titulo,desc],...]}} */
    static WebResourceResponse epg(String url) {
        if (url == null || !(url.startsWith("http://") || url.startsWith("https://"))) {
            return error(400, "URL inválida");
        }
        try {
            HttpURLConnection c = open(url);
            int code = c.getResponseCode();
            if (code >= 400) return error(code, "Guia indisponível (" + code + ")");
            InputStream in = maybeGunzip(c.getInputStream(), url, c.getContentEncoding());
            byte[] json = parseXmltv(in).getBytes(StandardCharsets.UTF_8);
            in.close();
            return new WebResourceResponse("application/json", "utf-8", 200, "OK", cors(),
                    new ByteArrayInputStream(json));
        } catch (Exception e) {
            return error(502, "Falha no guia: " + e.getMessage());
        }
    }

    /** Abre a URL tentando outras identificações se o servidor recusar. */
    static HttpURLConnection open(String url) throws IOException {
        if (!forcedUa.isEmpty()) return openWith(url, forcedUa);
        String first = uaFor(url);
        java.util.List<String> order = new ArrayList<>();
        order.add(first);
        for (String u : UAS) if (!u.equals(first)) order.add(u);
        HttpURLConnection lastRefused = null;
        IOException lastError = null;
        for (String ua : order) {
            try {
                HttpURLConnection c = openWith(url, ua);
                int code = c.getResponseCode();
                if (code < 400) {
                    remember(url, ua);
                    if (lastRefused != null) lastRefused.disconnect();
                    return c;
                }
                if (!refused(code)) return c;
                if (lastRefused != null) lastRefused.disconnect();
                lastRefused = c;
            } catch (IOException e) {
                lastError = e;
            }
        }
        if (lastRefused != null) return lastRefused;
        throw lastError != null ? lastError : new IOException("sem resposta");
    }

    static HttpURLConnection openWith(String url, String ua) throws IOException {
        String current = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setRequestProperty("User-Agent", ua);
            c.setRequestProperty("Accept", "*/*");
            c.setRequestProperty("Accept-Encoding", "gzip");
            c.setRequestProperty("Connection", "close");
            int code = c.getResponseCode();
            if (code >= 300 && code < 400 && c.getHeaderField("Location") != null) {
                current = new URL(new URL(current), c.getHeaderField("Location")).toString();
                c.disconnect();
                continue;
            }
            return c;
        }
        throw new IOException("redirecionamentos demais");
    }

    static InputStream maybeGunzip(InputStream in, String url, String encoding) throws IOException {
        BufferedInputStream b = new BufferedInputStream(in, 65536);
        b.mark(2);
        int b1 = b.read();
        int b2 = b.read();
        b.reset();
        boolean gz = (b1 == 0x1f && b2 == 0x8b) || "gzip".equalsIgnoreCase(encoding);
        if (gz && b1 == 0x1f && b2 == 0x8b) return new GZIPInputStream(b, 65536);
        return b;
    }

    static Map<String, String> cors() {
        Map<String, String> h = new HashMap<>();
        h.put("Access-Control-Allow-Origin", "*");
        h.put("Cache-Control", "no-store");
        return h;
    }

    static WebResourceResponse error(int code, String msg) {
        return new WebResourceResponse("text/plain", "utf-8", code, reason(code), cors(),
                new ByteArrayInputStream(msg.getBytes(StandardCharsets.UTF_8)));
    }

    static String reason(int code) {
        if (code == 200) return "OK";
        if (code < 400) return "Redirect";
        if (code == 404) return "Not Found";
        if (code < 500) return "Client Error";
        return "Server Error";
    }

    // ---------- XMLTV ----------

    static String parseXmltv(InputStream in) throws Exception {
        long now = System.currentTimeMillis();
        long from = now - 3L * 3600_000L;
        long to = now + 24L * 3600_000L;

        Map<String, String[]> channels = new LinkedHashMap<>();
        Map<String, List<String>> progs = new HashMap<>();

        XmlPullParser p = Xml.newPullParser();
        p.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, false);
        p.setInput(in, null);

        String chId = null, chName = null, chIcon = null;
        String pCh = null, pTitle = null, pDesc = null;
        long pStart = 0, pStop = 0;
        boolean inProg = false;

        int ev = p.getEventType();
        while (ev != XmlPullParser.END_DOCUMENT) {
            if (ev == XmlPullParser.START_TAG) {
                String tag = p.getName();
                if ("channel".equals(tag)) {
                    chId = p.getAttributeValue(null, "id");
                    chName = null;
                    chIcon = null;
                } else if ("display-name".equals(tag) && chId != null && chName == null) {
                    chName = p.nextText();
                } else if ("icon".equals(tag) && chId != null && !inProg) {
                    chIcon = p.getAttributeValue(null, "src");
                } else if ("programme".equals(tag)) {
                    pCh = p.getAttributeValue(null, "channel");
                    pStart = xmltvTime(p.getAttributeValue(null, "start"));
                    pStop = xmltvTime(p.getAttributeValue(null, "stop"));
                    pTitle = null;
                    pDesc = null;
                    inProg = pStop > from && pStart < to;
                    if (!inProg) {
                        skip(p);
                    }
                } else if (inProg && "title".equals(tag) && pTitle == null) {
                    pTitle = p.nextText();
                } else if (inProg && "desc".equals(tag) && pDesc == null) {
                    pDesc = p.nextText();
                }
            } else if (ev == XmlPullParser.END_TAG) {
                String tag = p.getName();
                if ("channel".equals(tag) && chId != null) {
                    channels.put(chId, new String[]{chName == null ? chId : chName, chIcon});
                    chId = null;
                } else if ("programme".equals(tag) && inProg && pCh != null) {
                    List<String> list = progs.get(pCh);
                    if (list == null) {
                        list = new ArrayList<>();
                        progs.put(pCh, list);
                    }
                    String d = pDesc == null ? "" : pDesc;
                    if (d.length() > 280) d = d.substring(0, 277) + "…";
                    list.add("[" + pStart + "," + pStop + "," + JSONObject.quote(pTitle == null ? "" : pTitle)
                            + "," + JSONObject.quote(d) + "]");
                    inProg = false;
                }
            }
            ev = p.next();
        }

        StringBuilder sb = new StringBuilder(1 << 20);
        sb.append("{\"channels\":{");
        boolean first = true;
        for (Map.Entry<String, String[]> e : channels.entrySet()) {
            if (!first) sb.append(',');
            first = false;
            sb.append(JSONObject.quote(e.getKey())).append(":{\"n\":").append(JSONObject.quote(e.getValue()[0]))
                    .append(",\"i\":").append(JSONObject.quote(e.getValue()[1] == null ? "" : e.getValue()[1])).append('}');
        }
        sb.append("},\"progs\":{");
        first = true;
        for (Map.Entry<String, List<String>> e : progs.entrySet()) {
            if (!first) sb.append(',');
            first = false;
            sb.append(JSONObject.quote(e.getKey())).append(":[");
            List<String> l = e.getValue();
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) sb.append(',');
                sb.append(l.get(i));
            }
            sb.append(']');
        }
        sb.append("}}");
        return sb.toString();
    }

    private static void skip(XmlPullParser p) throws Exception {
        int depth = 1;
        while (depth > 0) {
            int ev = p.next();
            if (ev == XmlPullParser.START_TAG) depth++;
            else if (ev == XmlPullParser.END_TAG) depth--;
            else if (ev == XmlPullParser.END_DOCUMENT) return;
        }
    }

    /** "20251125213000 -0300" -> epoch ms. */
    static long xmltvTime(String s) {
        if (s == null) return 0;
        s = s.trim();
        if (s.length() < 12) return 0;
        try {
            Calendar c = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
            c.clear();
            c.set(Integer.parseInt(s.substring(0, 4)), Integer.parseInt(s.substring(4, 6)) - 1,
                    Integer.parseInt(s.substring(6, 8)), Integer.parseInt(s.substring(8, 10)),
                    Integer.parseInt(s.substring(10, 12)), s.length() >= 14 ? Integer.parseInt(s.substring(12, 14)) : 0);
            long t = c.getTimeInMillis();
            String zone = s.length() > 14 ? s.substring(14).trim() : "";
            if (zone.length() >= 5 && (zone.charAt(0) == '+' || zone.charAt(0) == '-')) {
                int hh = Integer.parseInt(zone.substring(1, 3));
                int mm = Integer.parseInt(zone.substring(3, 5));
                long off = (hh * 60L + mm) * 60_000L;
                t = zone.charAt(0) == '+' ? t - off : t + off;
            } else {
                t -= TimeZone.getDefault().getOffset(t);
            }
            return t;
        } catch (Exception e) {
            return 0;
        }
    }
}
