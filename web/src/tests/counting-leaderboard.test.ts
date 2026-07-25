import { describe, expect, it } from "vitest";
import {
  buildPublicCountingLeaderboard,
  type PublicCountingContribution,
  type PublicCountingGuildInput
} from "../server/counting-leaderboard";

const guilds: PublicCountingGuildInput[] = [
  {
    id: "1",
    name: "Alpha",
    icon: null,
    enabled: true,
    currentNumber: 18,
    recordNumber: 120,
    totalCounts: 180,
    totalFailures: 12
  },
  {
    id: "2",
    name: "Beta",
    icon: null,
    enabled: false,
    currentNumber: 0,
    recordNumber: 90,
    totalCounts: 130,
    totalFailures: 8
  }
];

function contribution(overrides: Partial<PublicCountingContribution>): PublicCountingContribution {
  return {
    guildId: "1",
    userId: "10",
    displayName: "Lena",
    avatar: null,
    correctCounts: 0,
    failures: 0,
    updatedAt: "2026-07-26T10:00:00.000Z",
    ...overrides
  };
}

describe("public counting leaderboard", () => {
  it("aggregates a user across multiple guilds", () => {
    const result = buildPublicCountingLeaderboard(guilds, [
      contribution({ guildId: "1", userId: "10", correctCounts: 90, failures: 2 }),
      contribution({ guildId: "2", userId: "10", correctCounts: 60, failures: 1 }),
      contribution({ guildId: "1", userId: "20", displayName: "Max", correctCounts: 110, failures: 4 })
    ]);

    expect(result.players[0]).toMatchObject({
      userId: "10",
      correctCounts: 150,
      failures: 3,
      guildCount: 2
    });
    expect(result.summary.totalCounts).toBe(310);
    expect(result.summary.playerCount).toBe(2);
  });

  it("builds per-guild leaders and the record guild", () => {
    const result = buildPublicCountingLeaderboard(guilds, [
      contribution({ guildId: "1", userId: "10", correctCounts: 40 }),
      contribution({ guildId: "1", userId: "20", displayName: "Max", correctCounts: 70 }),
      contribution({ guildId: "2", userId: "10", correctCounts: 55 })
    ]);

    expect(result.guilds.find((guild) => guild.id === "1")?.leader?.displayName).toBe("Max");
    expect(result.summary.recordGuild?.name).toBe("Alpha");
    expect(result.summary.activeGuildCount).toBe(1);
  });

  it("does not invent winners without counting activity", () => {
    const result = buildPublicCountingLeaderboard(
      guilds.map((guild) => ({ ...guild, recordNumber: 0, totalCounts: 0 })),
      []
    );

    expect(result.summary.topPlayer).toBeNull();
    expect(result.summary.recordGuild).toBeNull();
  });
});
