package app.noir;

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

    /** Muitos servidores IPTV só respondem a players conhecidos. */
    static final String UA = "VLC/3.0.20 LibVLC/3.0.20";

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

    static HttpURLConnection open(String url) throws IOException {
        String current = url;
        for (int i = 0; i < 6; i++) {
            HttpURLConnection c = (HttpURLConnection) new URL(current).openConnection();
            c.setInstanceFollowRedirects(false);
            c.setConnectTimeout(15000);
            c.setReadTimeout(60000);
            c.setRequestProperty("User-Agent", UA);
            c.setRequestProperty("Accept", "*/*");
            c.setRequestProperty("Accept-Encoding", "gzip");
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
