# EclipseBot Webpanel

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

## Bot-Server

Der Bot ruft Sync-Jobs signiert vom Worker ab. Hochgeladene Dateien werden nach
erfolgreicher Validierung standardmaessig dauerhaft neben `bot.py` gespeichert:

```env
WEBPANEL_INTERNAL_API_URL=https://bot.carrothd.de
WEBPANEL_ASSET_DIR=/home/container/webpanel_assets
```

`WEBPANEL_ASSET_DIR` ist optional; ohne Angabe verwendet der Bot automatisch
den Ordner `webpanel_assets` neben `bot.py`.
