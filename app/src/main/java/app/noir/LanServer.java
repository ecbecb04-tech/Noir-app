package app.noir;

import android.content.Context;

import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Collections;
import java.util.Locale;

/**
 * Mini servidor HTTP na rede local. O QR Code da TV aponta para cá;
 * o celular abre um formulário, envia o link da lista e a TV importa.
 * Um token aleatório no endereço impede que outros aparelhos da rede enviem dados.
 */
final class LanServer {

    interface Listener {
        void onData(String json);
    }

    private final Listener listener;
    private final String token;
    private ServerSocket server;
    private volatile boolean running;

    LanServer(Context ctx, Listener listener) {
        this.listener = listener;
        String abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        SecureRandom r = new SecureRandom();
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < 6; i++) sb.append(abc.charAt(r.nextInt(abc.length())));
        token = sb.toString();
    }

    void start() throws IOException {
        try {
            server = new ServerSocket(8686);
        } catch (IOException e) {
            server = new ServerSocket(0);
        }
        running = true;
        Thread t = new Thread(() -> {
            while (running) {
                try {
                    final Socket s = server.accept();
                    new Thread(() -> handle(s)).start();
                } catch (IOException ignored) {
                    if (!running) return;
                }
            }
        }, "noir-lan");
        t.setDaemon(true);
        t.start();
    }

    void stop() {
        running = false;
        try {
            if (server != null) server.close();
        } catch (IOException ignored) {
        }
    }

    String address() {
        String ip = localIp();
        if (ip == null || server == null) return "";
        return "http://" + ip + ":" + server.getLocalPort() + "/?t=" + token;
    }

    private static String localIp() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (a instanceof Inet4Address && a.isSiteLocalAddress()) return a.getHostAddress();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private void handle(Socket s) {
        try {
            s.setSoTimeout(15000);
            InputStream in = s.getInputStream();
            ByteArrayOutputStream head = new ByteArrayOutputStream();
            int prev3 = 0, c;
            while ((c = in.read()) != -1) {
                head.write(c);
                prev3 = (prev3 << 8 | c) & 0xFFFFFFFF;
                if (prev3 == 0x0D0A0D0A || head.size() > 16384) break;
            }
            String headers = head.toString("UTF-8");
            String[] first = headers.split("\r\n", 2)[0].split(" ");
            if (first.length < 2) {
                s.close();
                return;
            }
            String method = first[0];
            String path = first[1];
            int len = 0;
            for (String line : headers.split("\r\n")) {
                if (line.toLowerCase(Locale.US).startsWith("content-length:")) {
                    len = Integer.parseInt(line.substring(15).trim());
                }
            }
            if (!path.contains("t=" + token)) {
                respond(s, 403, page("Código inválido", "<p>Escaneie de novo o QR Code mostrado na TV.</p>"));
                return;
            }
            if ("POST".equals(method)) {
                len = Math.min(len, 65536);
                byte[] body = new byte[len];
                int read = 0;
                while (read < len) {
                    int n = in.read(body, read, len - read);
                    if (n < 0) break;
                    read += n;
                }
                JSONObject o = new JSONObject();
                for (String pair : new String(body, 0, read, StandardCharsets.UTF_8).split("&")) {
                    int eq = pair.indexOf('=');
                    if (eq <= 0) continue;
                    o.put(URLDecoder.decode(pair.substring(0, eq), "UTF-8"),
                            URLDecoder.decode(pair.substring(eq + 1), "UTF-8").trim());
                }
                listener.onData(o.toString());
                respond(s, 200, page("Enviado para a TV ✓",
                        "<p>A lista está sendo importada. Pode fechar esta página.</p>"));
            } else {
                respond(s, 200, form());
            }
        } catch (Exception e) {
            try {
                s.close();
            } catch (IOException ignored) {
            }
        }
    }

    private void respond(Socket s, int code, String html) throws IOException {
        byte[] b = html.getBytes(StandardCharsets.UTF_8);
        OutputStream out = s.getOutputStream();
        out.write(("HTTP/1.1 " + code + (code == 200 ? " OK" : " Forbidden") + "\r\n"
                + "Content-Type: text/html; charset=utf-8\r\nContent-Length: " + b.length
                + "\r\nConnection: close\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        out.write(b);
        out.flush();
        s.close();
    }

    private static final String CSS = "body{margin:0;background:#100D14;color:#FBF6EF;font-family:system-ui,sans-serif;padding:24px}"
            + "h1{font-size:26px;margin:0 0 6px}.b{color:#FF8A3D;font-weight:800;font-size:22px}"
            + "label{display:block;margin:16px 0 6px;color:#A1A1AA;font-size:14px}"
            + "input,select{width:100%;box-sizing:border-box;height:48px;border-radius:10px;border:1px solid #3F3F46;background:#1C1723;color:#FBF6EF;font-size:16px;padding:0 12px}"
            + "button{margin-top:24px;width:100%;height:52px;border:0;border-radius:10px;background:#FF8A3D;color:#fff;font-size:17px;font-weight:700}"
            + ".x{display:none}p{color:#A1A1AA;line-height:1.5}";

    private static String page(String title, String body) {
        return "<!doctype html><html lang=pt-BR><head><meta charset=utf-8><meta name=viewport content='width=device-width,initial-scale=1'>"
                + "<title>Gatoflix</title><style>" + CSS + "</style></head><body><div class=b>gatoflix</div><h1>" + title + "</h1>" + body + "</body></html>";
    }

    private String form() {
        return page("Adicionar lista na TV",
                "<p>Preencha e toque em Enviar. A TV recebe na hora.</p>"
                        + "<form method=post action='/add?t=" + token + "'>"
                        + "<label>Tipo de lista</label><select name=type onchange=\"var x=this.value=='xtream';document.getElementById('u').style.display=x?'none':'block';document.getElementById('x').style.display=x?'block':'none'\">"
                        + "<option value=m3u>Lista M3U · Canais de TV</option><option value=vod>Lista VOD · Filmes e séries</option>"
                        + "<option value=xtream>Servidor Xtream Codes</option><option value=epg>Guia de programação (EPG)</option></select>"
                        + "<label>Nome da lista</label><input name=name placeholder='Minha lista'>"
                        + "<div id=u><label>URL da lista</label><input name=url type=url placeholder='http://…/lista.m3u'>"
                        + "<label>URL do guia EPG (opcional)</label><input name=epg type=url placeholder='http://…/guia.xml'></div>"
                        + "<div id=x class=x><label>Servidor</label><input name=server type=url placeholder='http://servidor:porta'>"
                        + "<label>Usuário</label><input name=user autocomplete=off><label>Senha</label><input name=pass type=password autocomplete=off></div>"
                        + "<button type=submit>Enviar para a TV</button></form>");
    }
}
