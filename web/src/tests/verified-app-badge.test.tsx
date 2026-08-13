import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BOT_PROFILE_IMAGE, BotProfileAvatar } from "../bot-profile-avatar";
import { VerifiedAppBadge } from "../verified-app-badge";

describe("verified Discord app badge", () => {
  it("renders a verification icon before the APP label", () => {
    const markup = renderToStaticMarkup(<VerifiedAppBadge />);

    expect(markup).toContain("Verifizierte Discord-App");
    expect(markup).toContain("lucide-check");
    expect(markup).not.toContain("lucide-badge-check");
    expect(markup.indexOf("<svg")).toBeLessThan(markup.indexOf("APP"));
  });

  it("uses the shared Modmail Manager profile image", () => {
    const markup = renderToStaticMarkup(<BotProfileAvatar alt="Modmail Manager" />);

    expect(BOT_PROFILE_IMAGE).toBe("/modmail-manager-avatar.webp");
    expect(markup).toContain('src="/modmail-manager-avatar.webp"');
    expect(markup).toContain('alt="Modmail Manager"');
  });
});
