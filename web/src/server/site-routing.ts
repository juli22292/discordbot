export const ROOT_SITE_HOST = "modmailmanagerbot.de";
export const WEBPANEL_HOST = "bot.modmailmanagerbot.de";
export const ADS_TXT_CONTENT = "google.com, pub-6245185799932586, DIRECT, f08c47fec0942fa0\n";

export function rootSiteResponse(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname !== ROOT_SITE_HOST) return null;

  if (url.pathname === "/ads.txt") {
    return new Response(ADS_TXT_CONTENT, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }

  url.hostname = WEBPANEL_HOST;
  return Response.redirect(url.toString(), 308);
}
