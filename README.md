# Gatoflix — app de TV e streaming (Android TV + celular)

Um código, dois APKs:

| APK | Para | Pacote |
|---|---|---|
| `Gatoflix-AndroidTV.apk` | Android TV, Google TV, TV Box, Fire TV | `app.gatoflix.tv` |
| `Gatoflix-Celular.apk` | Celulares e tablets Android 6+ | `app.gatoflix.mobile` |

## O que o app faz

- **Listas**: M3U/M3U8 (canais, filmes e séries), Xtream Codes (servidor + usuário + senha) e guia EPG (XMLTV, também `.xml.gz`).
- **Adicionar lista na TV**: pelo QR Code (o celular abre um formulário na rede Wi‑Fi local e envia o link para a TV), digitando com o controle ou por arquivo do aparelho/pendrive. Depois de testar a lista, você escolhe quais grupos importar (grupos adultos já vêm desmarcados).
- **Telas**: Início, Novidades nos streamings, TV ao vivo (guia de programação com "agora/a seguir"), Filmes, Séries (temporadas e episódios), Buscar (teclado na tela no Android TV) e Configurações.
- **Player nativo (ExoPlayer/Media3)**: HLS, MPEG‑TS, MP4, MKV e DASH, faixas de áudio e legendas, tamanho de legenda, continua de onde parou. Na TV ao vivo, as setas ↑/↓ (ou CH+/CH−) trocam de canal.
- **Notas IMDb**: via OMDb (chave gratuita em <https://www.omdbapi.com/apikey.aspx>).
- **Novidades nos streamings** (Netflix, Prime Video, Disney+, Max, Globoplay, Apple TV+): via TMDB (chave gratuita em <https://www.themoviedb.org/settings/api>).

As chaves são informadas em **Configurações › Chaves de API** e ficam salvas só no aparelho. Sem chaves, o app funciona normalmente, só sem notas e sem a tela de novidades.

## Como gerar os APKs

### Opção 1 — GitHub (sem instalar nada)
1. Crie um repositório no GitHub e envie esta pasta.
2. Abra a aba **Actions** → **Gerar APKs** (roda sozinho a cada envio, ou clique em *Run workflow*).
3. Ao terminar, baixe o artefato **Gatoflix-apks** (contém os dois `.apk`).
4. Para publicar uma versão: crie uma tag `v1.0.0`. Os APKs aparecem em **Releases**.

### Opção 2 — Android Studio
Abra a pasta no Android Studio, escolha a variante `tvRelease` ou `mobileRelease` em *Build Variants* e use **Build › Build APK(s)**.
Pela linha de comando: `./gradlew assembleTvRelease assembleMobileRelease`.

### Assinatura (recomendado para atualizar sem desinstalar)
Sem configuração, os APKs saem assinados com a chave de depuração do computador/servidor que compilou. Como essa chave muda entre compilações no GitHub, uma nova versão pode exigir desinstalar a anterior. Para uma chave fixa:

```bash
keytool -genkeypair -v -keystore gatoflix.jks -alias gatoflix -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 gatoflix.jks   # copie a saída
```

No GitHub: *Settings › Secrets and variables › Actions* → crie `GATOFLIX_KEYSTORE_BASE64`, `GATOFLIX_KEYSTORE_PASSWORD`, `GATOFLIX_KEY_ALIAS` (`gatoflix`) e `GATOFLIX_KEY_PASSWORD`. Guarde o `gatoflix.jks` em local seguro e nunca o envie ao repositório.

## Instalar

- **Android TV / TV Box**: instale o app *Downloader* (ou use um pendrive), abra o link do APK e permita "instalar apps desconhecidos" para ele. Alternativa: `adb install Gatoflix-AndroidTV.apk`.
- **Celular**: abra o `.apk` no gerenciador de arquivos e autorize a instalação.

## Estrutura

```
app/src/main/java/app/noir/
  MainActivity.java   WebView com a interface + rotas /proxy e /epg
  Net.java            downloads sem bloqueio de CORS, gzip e conversão XMLTV → JSON
  PlayerActivity.java player Media3 (zapping, legendas, retomada)
  LanServer.java      servidor local do QR Code (com código de acesso aleatório)
  Bridge.java         funções nativas chamadas pela interface
app/src/main/assets/web/
  index.html, styles.css, app.js (telas e navegação por controle remoto)
  data.js             leitura de M3U, Xtream, EPG, OMDb e TMDB
app/src/tv/           manifesto do Android TV (Leanback, banner)
app/src/mobile/       manifesto do celular
```

## Observações

- O app não traz nenhum conteúdo: ele só reproduz as listas que você adicionar. Use apenas listas e serviços que você tem direito de acessar.
- Listas muito grandes (dezenas de milhares de itens) podem levar alguns segundos para carregar na primeira vez; depois ficam salvas no aparelho.
- "Novidades nos streamings" mostra o que está disponível em cada serviço segundo o TMDB/JustWatch. Quando o título também existe na sua lista, aparece o botão **Assistir da sua lista**.
