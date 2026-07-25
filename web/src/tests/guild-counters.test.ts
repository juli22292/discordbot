import { describe, expect, it } from "vitest";
import {
  berlinDateKey,
  buildGuildCounterSummary,
  type PublicGuildCounter
} from "../server/guild-counters";

function counter(overrides: Partial<PublicGuildCounter>): PublicGuildCounter {
  return {
    id: "1",
    name: "Guild",
    icon: null,
    totalClicks: 0,
    todayClicks: 0,
    bestDailyClicks: 0,
    bestDay: null,
    lastClickedAt: null,
    ...overrides
  };
}

describe("public guild counters", () => {
  it("uses the calendar day in Europe/Berlin", () => {
    expect(berlinDateKey(new Date("2026-07-25T21:59:59.000Z"))).toBe("2026-07-25");
    expect(berlinDateKey(new Date("2026-07-25T22:00:00.000Z"))).toBe("2026-07-26");
  });

  it("calculates totals, the leader and the daily record", () => {
    const guilds = [
      counter({ id: "1", name: "Alpha", totalClicks: 12, todayClicks: 4, bestDailyClicks: 7 }),
      counter({ id: "2", name: "Beta", totalClicks: 20, todayClicks: 2, bestDailyClicks: 5 }),
      counter({ id: "3", name: "Gamma", totalClicks: 8, todayClicks: 6, bestDailyClicks: 11 })
    ];

    const summary = buildGuildCounterSummary(guilds);

    expect(summary.guildCount).toBe(3);
    expect(summary.totalClicks).toBe(40);
    expect(summary.todayClicks).toBe(12);
    expect(summary.leader?.name).toBe("Beta");
    expect(summary.dailyRecord?.name).toBe("Gamma");
  });

  it("does not declare a winner before the first click", () => {
    const summary = buildGuildCounterSummary([
      counter({ id: "1", name: "Alpha" }),
      counter({ id: "2", name: "Beta" })
    ]);

    expect(summary.leader).toBeNull();
    expect(summary.dailyRecord).toBeNull();
  });
});
