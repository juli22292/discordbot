import { afterEach, describe, expect, it, vi } from "vitest";
import { discordBotInviteUrl, fetchDiscordBotGuild, fetchDiscordGuilds } from "../server/discord";
import type { Env } from "../server/types";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Discord bot helpers", () => {
  it("builds callback-enabled bot invite URLs", () => {
    const url = new URL(
      discordBotInviteUrl(
        {
          DISCORD_CLIENT_ID: "123456789012345678",
          APP_URL: "https://panel.example",
          DISCORD_REDIRECT_URI: "https://panel.example/api/auth/discord/callback",
          BOT_INVITE_PERMISSIONS: "8"
        } as Env,
        "987654321098765432",
        "secure-state"
      )
    );

    expect(url.origin).toBe("https://discord.com");
    expect(url.pathname).toBe("/oauth2/authorize");
    expect(url.searchParams.get("client_id")).toBe("123456789012345678");
    expect(url.searchParams.get("scope")).toBe("bot applications.commands");
    expect(url.searchParams.get("guild_id")).toBe("987654321098765432");
    expect(url.searchParams.get("disable_guild_select")).toBe("true");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("redirect_uri")).toBe("https://panel.example/api/auth/discord/callback");
    expect(url.searchParams.get("state")).toBe("secure-state");
  });

  it("keeps invite URLs callback-less when no state is provided", () => {
    const url = new URL(
      discordBotInviteUrl(
        {
          DISCORD_CLIENT_ID: "123456789012345678",
          APP_URL: "https://panel.example"
        } as Env,
        "987654321098765432"
      )
    );

    expect(url.searchParams.has("response_type")).toBe(false);
    expect(url.searchParams.has("redirect_uri")).toBe(false);
    expect(url.searchParams.has("state")).toBe(false);
  });

  it("checks bot guild presence with the bot token", async () => {
    globalThis.fetch = vi.fn(async (input, init) => {
      expect(String(input)).toBe("https://discord.com/api/v10/guilds/987654321098765432");
      expect(new Headers(init?.headers).get("Authorization")).toBe("Bot test-token");
      return new Response(JSON.stringify({ id: "987654321098765432", name: "Test", icon: null }), {
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    const guild = await fetchDiscordBotGuild(
      {
        DISCORD_BOT_TOKEN: "test-token"
      } as Env,
      "987654321098765432"
    );

    expect(guild?.id).toBe("987654321098765432");
  });

  it("retries Discord 429 responses before failing the request", async () => {
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(JSON.stringify({ message: "rate limited", retry_after: 0, global: false }), {
          status: 429,
          headers: { "Content-Type": "application/json", "Retry-After": "0" }
        });
      }

      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json" }
      });
    }) as typeof fetch;

    await expect(fetchDiscordGuilds({ accessToken: "token", tokenType: "Bearer", scope: "guilds", expiresAt: Date.now() + 1000 })).resolves.toEqual([]);
    expect(calls).toBe(2);
  });

  it("treats missing bot guild access as not installed", async () => {
    globalThis.fetch = vi.fn(async () => new Response("Missing Access", { status: 403 })) as typeof fetch;

    await expect(
      fetchDiscordBotGuild(
        {
          DISCORD_BOT_TOKEN: "test-token"
        } as Env,
        "987654321098765432"
      )
    ).resolves.toBeNull();
  });
});
