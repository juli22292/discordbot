# Archive Bot Webpanel

Die vollstaendige Betriebsdokumentation liegt im Repository unter `docs/cloudflare-webpanel.md`.

Kurzstart:

```bash
cd web
npm install
npm run db:migrate:local
npm run dev
```

Produktiv:

```bash
cd web
npm run build
wrangler d1 migrations apply archive_bot_panel --remote
npm run deploy
```
