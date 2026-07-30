# Modmail Manager Webpanel

## Cloudflare

Das Webpanel verwendet D1 fuer Einstellungen, Sync-Jobs, Guild-Avatare und
Welcome-Bilder. Mediendateien werden in 256-KiB-Bloecke geteilt und bleiben
damit unter dem D1-Limit fuer einzelne BLOB-Werte. Ein R2-Abonnement oder ein
zusaetzlicher Cloudflare-Speicherdienst ist nicht erforderlich.

Danach kann die Worker-Anwendung normal gebaut und deployed werden:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run deploy
```

Die Secrets `DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `SESSION_SECRET`, `ENCRYPTION_KEY` und
`INTERNAL_BOT_API_SECRET` werden in Cloudflare gepflegt und gehoeren nicht ins
Repository. `INTERNAL_BOT_API_SECRET` muss exakt mit dem Wert in der Bot-`.env`
uebereinstimmen.

Der KI-Helfer verwendet Groq ausschliesslich serverseitig. Der API-Key darf
nicht in `wrangler.jsonc`, JavaScript oder Git stehen, sondern wird als
Cloudflare-Secret gesetzt:

```bash
wrangler secret put GROQ_API_KEY
```

Die optionale Worker-Variable `GROQ_MODEL` waehlt das Modell fuer allgemeine
Fragen aus (Standard: `llama-3.3-70b-versatile`). Code- und
Minecraft-Anfragen werden automatisch erkannt und standardmaessig mit
`openai/gpt-oss-120b` verarbeitet. Dieses Coding-Modell kann optional mit
`GROQ_CODING_MODEL` ueberschrieben werden. Ist es im Groq-Projekt nicht
verfuegbar, faellt die Anfrage kontrolliert auf `GROQ_MODEL` zurueck. Das
Webpanel setzt weder ein Nachrichtenlimit noch eine eigene Begrenzung fuer die
Antwortlaenge. Fuer den eigentlichen Groq-Aufruf wird nur das aktuelle
Kontextfenster uebertragen; der vollstaendige sichtbare Chat bleibt im Browser.
Ein fest reserviertes Maximalbudget wird bewusst nicht gesendet, da dieses im
Groq-Free-Tier bereits vor der Verarbeitung das TPM-Limit ueberschreiten kann.
Beendet das Modell eine Antwort wegen seiner Laengenbegrenzung, bietet die
Oberflaeche einen kontrollierten Fortsetzen-Button an.

## Minecraft-Plugin-Compiler

Vollstaendige Paper-, Folia-, Purpur- und Spigot-Projekte aus dem Minecraft-Modus
koennen direkt unter der KI-Antwort zu einer JAR kompiliert werden. Der
Compiler laeuft bewusst nicht im Cloudflare Worker, sondern als isolierter
Java-25-Dienst auf einem eigenen Pterodactyl-Server. Der Builder liest
verfuegbare Minecraft- und API-Versionen live aus den offiziellen
Maven-Repositories und ordnet Java 8, 11, 16, 17, 21 oder 25 automatisch zu.
Build-Skripte aus
KI-Antworten werden ignoriert; der Dienst erzeugt eine feste
Maven-Konfiguration und akzeptiert nur Java- und Ressourcen-Dateien.

Die komplette Einrichtung steht in
[`docs/minecraft-plugin-builder.md`](../docs/minecraft-plugin-builder.md).

In Cloudflare werden benoetigt:

```text
PLUGIN_BUILDER_URL=https://builder.carrothd.de
PLUGIN_BUILDER_API_SECRET=<derselbe zufaellige Wert wie im Pterodactyl-Builder>
```

`PLUGIN_BUILDER_API_SECRET` ist ein Secret und darf nicht in `wrangler.jsonc`
oder Git eingetragen werden. Die URL ist bereits als normale Worker-Variable in
`wrangler.jsonc` vorbereitet.

## Bot-Server

Der Bot ruft Sync-Jobs signiert vom Worker ab. Hochgeladene Dateien werden nach
erfolgreicher Validierung standardmaessig dauerhaft neben `bot.py` gespeichert:

```env
WEBPANEL_INTERNAL_API_URL=https://bot.carrothd.de
WEBPANEL_ASSET_DIR=/home/container/webpanel_assets
```

`WEBPANEL_ASSET_DIR` ist optional; ohne Angabe verwendet der Bot automatisch
den Ordner `webpanel_assets` neben `bot.py`.
