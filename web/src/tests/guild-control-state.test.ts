import { describe, expect, it } from "vitest";
import { mergeGuildControlState } from "../server/guild-control-state";

describe("guild control state", () => {
  it("keeps saved configuration authoritative over runtime defaults", () => {
    expect(mergeGuildControlState(
      { enabled: false, fields: { channelId: "" } },
      { enabled: true, fields: { channelId: "123" } },
      { enabled: false, configuredFields: 0 },
      { enabled: false, configuredFields: 1 }
    )).toEqual({
      enabled: true,
      configuredFields: 1,
      fields: { channelId: "123" }
    });
  });

  it("retains runtime-only metrics alongside the saved settings", () => {
    expect(mergeGuildControlState(
      { enabled: false },
      { enabled: true },
      { activePlayers: 0 },
      { activePlayers: 4, lastAppliedAt: "2026-07-26T00:00:00.000Z" }
    )).toEqual({
      activePlayers: 4,
      lastAppliedAt: "2026-07-26T00:00:00.000Z",
      enabled: true
    });
  });
});
