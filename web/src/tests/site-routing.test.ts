import { describe, expect, it } from "vitest";
import { ADS_TXT_CONTENT, rootSiteResponse } from "../server/site-routing";

describe("root site routing", () => {
  it("serves the AdSense seller declaration on the root domain", async () => {
    const response = rootSiteResponse(new Request("https://modmailmanagerbot.de/ads.txt"));

    expect(response?.status).toBe(200);
    expect(response?.headers.get("content-type")).toContain("text/plain");
    expect(await response?.text()).toBe(ADS_TXT_CONTENT);
  });

  it("redirects root-domain pages to the canonical webpanel host", () => {
    const response = rootSiteResponse(new Request("https://modmailmanagerbot.de/panel?source=adsense"));

    expect(response?.status).toBe(308);
    expect(response?.headers.get("location")).toBe("https://bot.modmailmanagerbot.de/panel?source=adsense");
  });

  it("does not intercept requests already using the webpanel host", () => {
    expect(rootSiteResponse(new Request("https://bot.modmailmanagerbot.de/panel"))).toBeNull();
  });
});
