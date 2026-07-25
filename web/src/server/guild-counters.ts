export interface PublicGuildCounter {
  id: string;
  name: string;
  icon: string | null;
  totalClicks: number;
  todayClicks: number;
  bestDailyClicks: number;
  bestDay: string | null;
  lastClickedAt: string | null;
}

export interface PublicGuildCounterSummary {
  guildCount: number;
  totalClicks: number;
  todayClicks: number;
  leader: PublicGuildCounter | null;
  dailyRecord: PublicGuildCounter | null;
}

export function berlinDateKey(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function buildGuildCounterSummary(guilds: PublicGuildCounter[]): PublicGuildCounterSummary {
  const leaderCandidate = [...guilds].sort((left, right) =>
    right.totalClicks - left.totalClicks
    || right.todayClicks - left.todayClicks
    || left.name.localeCompare(right.name, "de")
  )[0] ?? null;
  const dailyRecordCandidate = [...guilds].sort((left, right) =>
    right.bestDailyClicks - left.bestDailyClicks
    || right.totalClicks - left.totalClicks
    || left.name.localeCompare(right.name, "de")
  )[0] ?? null;
  const leader = leaderCandidate && leaderCandidate.totalClicks > 0 ? leaderCandidate : null;
  const dailyRecord = dailyRecordCandidate && dailyRecordCandidate.bestDailyClicks > 0 ? dailyRecordCandidate : null;

  return {
    guildCount: guilds.length,
    totalClicks: guilds.reduce((sum, guild) => sum + guild.totalClicks, 0),
    todayClicks: guilds.reduce((sum, guild) => sum + guild.todayClicks, 0),
    leader,
    dailyRecord
  };
}
