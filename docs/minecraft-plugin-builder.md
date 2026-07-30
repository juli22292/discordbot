# Minecraft-Plugin-Compiler einrichten

Der Compiler besteht aus drei getrennten Teilen:

1. Die Groq-KI erzeugt Java- und Ressourcen-Dateien.
2. Der Cloudflare Worker prüft Dateipfade und überträgt sie mit einem geheimen
   API-Schlüssel an den Builder.
3. Ein eigener Java-25-Server in Pterodactyl kompiliert das Projekt und liefert
   die fertige JAR zurück.

Der Builder lädt die verfügbaren API-Versionen direkt aus den offiziellen
Maven-Repositories von Paper, Folia, Purpur und Spigot. Dadurch unterstützt er
klassische `1.x`-Versionen genauso wie das moderne `26.x`-Versionsschema, ohne
Versionsnummern blind zusammenzubauen.

Der Builder bekommt **keinen** Discord-Token, Groq-Key, Bot-Key oder
`INTERNAL_BOT_API_SECRET`.

## 1. Builder-Secret erzeugen

Erzeuge einmalig einen zufälligen Wert mit 64 Hex-Zeichen:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Das Ergebnis wird an zwei Stellen exakt gleich eingetragen:

- Pterodactyl-Variable `PLUGIN_BUILDER_API_SECRET`
- Cloudflare-Secret `PLUGIN_BUILDER_API_SECRET`

Den Wert nicht in Git, `wrangler.jsonc`, einen Screenshot oder eine öffentliche
Nachricht schreiben.

## 2. Egg in Pterodactyl importieren

1. Öffne das **Pterodactyl Admin Panel**.
2. Öffne **Nests**.
3. Wähle einen vorhandenen Nest oder erstelle `Tools`.
4. Klicke **Import Egg**.
5. Importiere:
   `plugin-builder/pterodactyl/egg-modmailbot-plugin-builder.json`
6. Kontrolliere als Docker-Image:
   `ghcr.io/pterodactyl/yolks:java_25`

Das Egg lädt beim Installieren automatisch nur den Ordner `plugin-builder` aus
dem öffentlichen GitHub-Repository. Der Startbefehl ist bereits fest auf
`bash start.sh` gesetzt.

## 3. Pterodactyl-Server erstellen

Empfohlene Werte:

| Einstellung | Wert |
| --- | --- |
| Arbeitsspeicher | 4096 MiB |
| Swap | 0 MiB |
| Festplatte | mindestens 5120 MiB |
| CPU | mindestens 200 % |
| Docker-Image | Java 25 |
| Allocation | ein freier TCP-Port |

Trage bei den Startup-Variablen ein:

| Variable | Wert |
| --- | --- |
| `PLUGIN_BUILDER_API_SECRET` | der erzeugte geheime Wert |
| `MAVEN_VERSION` | `3.9.16` |
| `PLUGIN_BUILDER_CONCURRENCY` | `2` |
| `PLUGIN_BUILDER_MAX_PENDING_BUILDS` | `8` |
| `PLUGIN_BUILDER_TIMEOUT_SECONDS` | `180` |
| `PLUGIN_BUILDER_ARTIFACT_TTL_HOURS` | `24` |
| `PLUGIN_BUILDER_VERSION_CACHE_MINUTES` | `15` |

Starte den Server. Erfolgreich ist der Start, sobald in der Konsole steht:

```text
[BUILDER] Bereit auf 0.0.0.0:<PORT>
```

Beim ersten Start lädt `start.sh` Apache Maven 3.9.16 herunter, prüft dessen
SHA-512-Prüfsumme, baut den Builder und startet ihn.

## 4. Sichere HTTPS-Adresse bereitstellen

Das Builder-Secret darf nicht unverschlüsselt über eine öffentliche
`http://IP:PORT`-Adresse übertragen werden. Verwende deshalb
`https://builder.carrothd.de`.

### Nginx und Let's Encrypt

Für den aktuellen Server läuft der Builder auf `77.90.30.197:25610`. Der
Nginx-VHost verwendet:

```nginx
server {
    server_name builder.carrothd.de;

    location / {
        proxy_pass http://77.90.30.197:25610;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 15s;
        proxy_read_timeout 300s;
        client_max_body_size 2m;
    }
}
```

Das Zertifikat wird mit Certbot verwaltet:

```bash
certbot --nginx -d builder.carrothd.de --redirect
```

Prüfe danach:

```bash
curl https://builder.carrothd.de/health
```

Erwartet wird JSON mit `"status":"ready"`, `"version":"2.0.0"`,
`"javaRuntime":25` und den vier Plattformen.

## 5. Cloudflare konfigurieren

In **Workers & Pages > discordbot > Settings > Variables and Secrets**:

| Typ | Name | Wert |
| --- | --- | --- |
| Text/Plaintext | `PLUGIN_BUILDER_URL` | `https://builder.carrothd.de` |
| Secret | `PLUGIN_BUILDER_API_SECRET` | exakt das Builder-Secret |

Alternativ mit Wrangler im Ordner `web`:

```bash
npx wrangler secret put PLUGIN_BUILDER_API_SECRET
npm run deploy
```

`PLUGIN_BUILDER_URL` ist im Repository bereits in `web/wrangler.jsonc`
vorbereitet.

## 6. Funktion testen

1. Öffne `https://bot.carrothd.de/ai`.
2. Melde dich über Discord an. KI-Chats können je nach Admin-Einstellung
   öffentlich sein, das Kompilieren verlangt aus Schutz vor Missbrauch immer
   eine Anmeldung.
3. Wähle **Minecraft**.
4. Schreibe zum Beispiel:

```text
Erstelle ein vollständiges Paper-Plugin für meine Minecraft-Version.
Der Befehl /heal soll den Spieler heilen. Ich möchte es danach kompilieren.
```

5. Nenne der KI Plattform und Minecraft-Version. Bereits genannte Angaben
   werden aus dem Chatverlauf übernommen.
6. Unter einer vollständigen Antwort erscheint **Plugin kompilieren**.
7. Prüfe Plugin-Name und Plattform. `latest` wählt die aktuellste offiziell
   veröffentlichte API; **Java automatisch** wählt passend zur Minecraft-Version
   Java 8, 11, 16, 17, 21 oder 25.
8. Klicke **JAR erstellen**.
9. Nach erfolgreichem Build erscheint der direkte `.jar`-Download.

Die JAR wird standardmäßig nach 24 Stunden vom Builder gelöscht.

## Unterstützter Umfang

- Paper, Folia, Purpur und Spigot
- alle Versionen, die das jeweilige offizielle Maven-Repository tatsächlich
  veröffentlicht
- klassische `1.x`- und moderne `26.x`-Versionen
- automatische Java-Zuordnung für Java 8, 11, 16, 17, 21 und 25
- exakte Versionen, vollständige API-Versionen, `latest` und Wildcards wie
  `1.21.x`
- `src/main/java/**/*.java`
- Ressourcen wie `plugin.yml`, YAML, JSON, Properties und Textdateien
- maximal 64 Dateien und insgesamt 512 KiB Quelltext

Der sichere Direkt-Compiler erlaubt absichtlich keine von der KI gelieferten
`pom.xml`, Gradle-Skripte, Wrapper, Annotation-Processor oder beliebige externe
Bibliotheken. Für Plugins mit zusätzlichen Abhängigkeiten muss die
Builder-Allowlist später gezielt erweitert werden. Das verhindert, dass ein
manipuliertes Build-Skript Befehle ausführt oder Zugangsdaten ausliest.

## Fehler finden

### Compiler-Schaltfläche fehlt

Die KI-Antwort muss mindestens diese vollständig benannten Dateien enthalten:

```text
src/main/java/.../Plugin.java
src/main/resources/plugin.yml
```

### `Cloudflare und der Plugin-Builder verwenden nicht dasselbe Secret`

`PLUGIN_BUILDER_API_SECRET` ist an beiden Stellen nicht exakt gleich. Beide
Werte neu setzen und Builder sowie Worker neu starten/deployen.

### `Der Minecraft-Plugin-Compiler ist gerade nicht erreichbar`

1. Pterodactyl-Konsole auf `[BUILDER] Bereit` prüfen.
2. `https://builder.carrothd.de/health` aufrufen.
3. Nginx mit `nginx -t` prüfen und neu laden.
4. Kontrollieren, ob `proxy_pass` auf `http://77.90.30.197:25610` zeigt.

### `Java 25 oder neuer wird benötigt`

Das alte Egg oder Docker-Image läuft noch mit Java 21. Das aktualisierte Egg
importieren und als Image `ghcr.io/pterodactyl/yolks:java_25` auswählen.

### Version wird nicht gefunden

Der Builder akzeptiert nur Versionen, die im offiziellen Repository der
gewählten Plattform vorhanden sind. Eine Version kann beispielsweise bei
Spigot verfügbar sein, bei Folia oder Purpur aber fehlen. Nutze in der
Oberfläche den Live-Katalog oder `latest`.

### Maven-Fehler

Im Compiler-Bereich **Compiler-Ausgabe anzeigen** öffnen. Typische Ursachen
sind eine falsche Minecraft-Version, fehlende Imports, eine nicht vorhandene
API-Methode oder eine zusätzliche Bibliothek, die der sichere Builder nicht
freigibt.
