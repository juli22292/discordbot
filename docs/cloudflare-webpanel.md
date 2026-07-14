# Archive Bot Webpanel auf Cloudflare Workers

## Architektur

Der Discord-Gateway-Bot bleibt ein separater Python-Prozess. Ein normaler Cloudflare Worker hält keine dauerhafte Gateway-Verbindung zu Discord.

Die neue Web-Schicht liegt in `web/`:

- Cloudflare Worker: OAuth2, Sessions, Dashboard-API, Guild-Autorisierung
- React/Vite: Dashboard-Oberfläche
- D1: Nutzer, Sessions, Guild-Einstellungen, Commands, Audit-Logs, Sync-Events
- KV: OAuth-State und HMAC-Nonces
- R2: validierte Guild-Medien wie Server-Avatar-Dateien
- Python-Bot: Discord Gateway, Events, Slash Commands, Anwendung der Sync-Events

## Wichtige Sicherheitsentscheidungen

- Discord OAuth2 nutzt `identify` und `guilds`.
- Access- und Refresh-Tokens werden nur serverseitig verschlüsselt in D1 gespeichert.
- Browser-Cookies sind `HttpOnly`, `SameSite=Lax` und in Produktion `Secure`.
- Jede Dashboard-API prüft die aktuelle Discord-Guild-Mitgliedschaft und Admin-/Manage-Guild-Rechte.
- Jede Guild-Einstellung verwendet die konkrete Guild-ID aus der Route.
- Interne Bot-Endpunkte sind HMAC-signiert mit Zeitstempel und Nonce.
- Dashboard-Änderungen schreiben Audit-Logs und Sync-Events.
- Das Webpanel funktioniert weiterhin mit Python-Bot-Snapshots. Für eine direkte Live-Prüfung, ob der Bot schon auf einer Guild ist, kann der Worker zusätzlich `DISCORD_BOT_TOKEN` als Secret bekommen.

Cloudflare Queues können später für Push-basierte Bot-Jobs aktiviert werden. In dieser Version ist bewusst kein Queue-Consumer konfiguriert, weil der bestehende Python-Bot keinen dauerhaft erreichbaren HTTP-Consumer bereitstellt. Stattdessen pollt der Bot signiert und idempotent die D1-Sync-Events.

## Discord Avatar

Discords aktuelle Guild-Member-API unterstützt beim Endpoint `Modify Current Member` ein guild-spezifisches `avatar`-Feld. Der Worker validiert Uploads, speichert sie in R2 und der Python-Bot wendet den Avatar per Bot-Token auf `/guilds/{guild.id}/members/@me` an.

## Cloudflare-Ressourcen

Erstellen:

```bash
wrangler d1 create archive_bot_panel
wrangler kv namespace create OAUTH_STATE
wrangler kv namespace create BOT_EVENT_NONCES
wrangler r2 bucket create archive-bot-guild-media
```

Die erzeugten IDs in `web/wrangler.jsonc` eintragen.

## Secrets

Im Worker setzen:

```bash
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_BOT_TOKEN
wrangler secret put SESSION_SECRET
wrangler secret put ENCRYPTION_KEY
wrangler secret put INTERNAL_BOT_API_SECRET
```

`DISCORD_BOT_TOKEN` ist optional, aber empfohlen. Damit erkennt die Serverliste sofort live über Discord, ob der Bot bereits auf einem Server ist. Ohne dieses Secret nutzt das Webpanel weiter den Snapshot, den der laufende Python-Bot an den Worker sendet.

Im Python-Bot setzen:

```bash
WEBPANEL_INTERNAL_API_URL=https://deine-domain.example
INTERNAL_BOT_API_SECRET=<gleiches internes Secret>
WEBPANEL_SYNC_INTERVAL_SECONDS=30
WEBPANEL_SNAPSHOT_INTERVAL_SECONDS=300
```

Das Discord-Bot-Token bleibt beim Python-Bot und kann zusätzlich als Cloudflare-Worker-Secret `DISCORD_BOT_TOKEN` gesetzt werden, damit der Worker den Installationsstatus direkt prüfen kann.

## Lokale Entwicklung

```bash
cd web
npm install
npm run db:migrate:local
npm run dev
```

Discord Redirect URL lokal:

```text
http://localhost:8787/api/auth/discord/callback
```

## Tests und Checks

```bash
cd web
npm run typecheck
npm run lint
npm run test
```

Python:

```bash
python -m py_compile bot.py
```

## Deployment

```bash
cd web
npm install
npm run build
wrangler d1 migrations apply archive_bot_panel --remote
npm run deploy
```

Danach:

1. Cloudflare Custom Domain verbinden.
2. `APP_URL` und `DISCORD_REDIRECT_URI` in `wrangler.jsonc` für Produktion setzen.
3. Im Discord Developer Portal beide Redirect URLs eintragen:

```text
https://discordbot.niteaccfort74.workers.dev/api/auth/discord/callback
https://discordbot.niteaccfort74.workers.dev/api/bot/invite/callback
```

4. Python-Bot mit `WEBPANEL_INTERNAL_API_URL` und `INTERNAL_BOT_API_SECRET` starten.
5. In `/panel` pruefen, ob Bot-Snapshots eintreffen und installierte Guilds verwaltbar sind.

## Noch bewusst nicht als fertiges Modul markiert

Das Dashboard implementiert aktuell die produktiven Grundbereiche:

- Login
- Panel unter `/panel` mit Home/Guild-Auswahl
- Bot-Einladung
- Guild-Übersicht
- Bot-Nickname
- Guild-Member-Avatar
- Slash-Command-Konfiguration
- Custom Commands über `/utility customcommand run <name>` und Prefix-Fallback
- Audit-Log

Begrüßung, Logging, Moderation und Gefahrenbereich sind in der Navigation deaktiviert, bis ihre Backend-Endpunkte vollständig umgesetzt sind.
