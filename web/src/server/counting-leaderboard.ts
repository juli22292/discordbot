export interface PublicCountingContribution {
  guildId: string;
  userId: string;
  displayName: string;
  avatar: string | null;
  correctCounts: number;
  failures: number;
  updatedAt: string | null;
}

export interface PublicCountingPlayer {
  userId: string;
  displayName: string;
  avatar: string | null;
  correctCounts: number;
  failures: number;
  guildCount: number;
}

export interface PublicCountingGuild {
  id: string;
  name: string;
  icon: string | null;
  enabled: boolean;
  currentNumber: number;
  recordNumber: number;
  totalCounts: number;
  totalFailures: number;
  playerCount: number;
  leader: PublicCountingPlayer | null;
}

export interface PublicCountingSummary {
  guildCount: number;
  activeGuildCount: number;
  playerCount: number;
  totalCounts: number;
  totalFailures: number;
  topPlayer: PublicCountingPlayer | null;
  recordGuild: PublicCountingGuild | null;
}

export interface PublicCountingLeaderboard {
  players: PublicCountingPlayer[];
  guilds: PublicCountingGuild[];
  summary: PublicCountingSummary;
}

export interface PublicCountingGuildInput {
  id: string;
  name: string;
  icon: string | null;
  enabled: boolean;
  currentNumber: number;
  recordNumber: number;
  totalCounts: number;
  totalFailures: number;
}

function playerSort(left: PublicCountingPlayer, right: PublicCountingPlayer): number {
  return right.correctCounts - left.correctCounts
    || left.failures - right.failures
    || left.displayName.localeCompare(right.displayName, "de");
}

export function buildPublicCountingLeaderboard(
  guildInputs: PublicCountingGuildInput[],
  contributions: PublicCountingContribution[]
): PublicCountingLeaderboard {
  const globalPlayers = new Map<string, PublicCountingPlayer>();
  const playerUpdatedAt = new Map<string, string>();
  const guildContributions = new Map<string, PublicCountingContribution[]>();

  for (const contribution of contributions) {
    if (contribution.correctCounts <= 0) continue;
    const current = globalPlayers.get(contribution.userId);
    if (current) {
      current.correctCounts += contribution.correctCounts;
      current.failures += contribution.failures;
      current.guildCount += 1;
      if ((contribution.updatedAt ?? "") >= (playerUpdatedAt.get(contribution.userId) ?? "")) {
        current.displayName = contribution.displayName;
        current.avatar = contribution.avatar ?? current.avatar;
        playerUpdatedAt.set(contribution.userId, contribution.updatedAt ?? "");
      }
    } else {
      globalPlayers.set(contribution.userId, {
        userId: contribution.userId,
        displayName: contribution.displayName,
        avatar: contribution.avatar,
        correctCounts: contribution.correctCounts,
        failures: contribution.failures,
        guildCount: 1
      });
      playerUpdatedAt.set(contribution.userId, contribution.updatedAt ?? "");
    }

    const guildRows = guildContributions.get(contribution.guildId) ?? [];
    guildRows.push(contribution);
    guildContributions.set(contribution.guildId, guildRows);
  }

  const players = [...globalPlayers.values()].sort(playerSort);
  const guilds = guildInputs.map((guild): PublicCountingGuild => {
    const guildPlayers = (guildContributions.get(guild.id) ?? [])
      .map((contribution): PublicCountingPlayer => ({
        userId: contribution.userId,
        displayName: contribution.displayName,
        avatar: contribution.avatar,
        correctCounts: contribution.correctCounts,
        failures: contribution.failures,
        guildCount: 1
      }))
      .sort(playerSort);
    return {
      ...guild,
      playerCount: guildPlayers.length,
      leader: guildPlayers[0] && guildPlayers[0].correctCounts > 0 ? guildPlayers[0] : null
    };
  }).sort((left, right) =>
    right.totalCounts - left.totalCounts
    || right.recordNumber - left.recordNumber
    || left.name.localeCompare(right.name, "de")
  );
  const recordGuildCandidate = [...guilds].sort((left, right) =>
    right.recordNumber - left.recordNumber
    || right.totalCounts - left.totalCounts
    || left.name.localeCompare(right.name, "de")
  )[0] ?? null;

  return {
    players,
    guilds,
    summary: {
      guildCount: guilds.length,
      activeGuildCount: guilds.filter((guild) => guild.enabled).length,
      playerCount: players.length,
      totalCounts: guilds.reduce((sum, guild) => sum + guild.totalCounts, 0),
      totalFailures: guilds.reduce((sum, guild) => sum + guild.totalFailures, 0),
      topPlayer: players[0] && players[0].correctCounts > 0 ? players[0] : null,
      recordGuild: recordGuildCandidate && recordGuildCandidate.recordNumber > 0 ? recordGuildCandidate : null
    }
  };
}
