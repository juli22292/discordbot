import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  Ban,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  ClipboardList,
  Command,
  Copy,
  Crown,
  Cpu,
  Database,
  Download,
  Eye,
  ExternalLink,
  FileJson,
  Folder,
  Gauge,
  Gamepad2,
  Globe2,
  HardDrive,
  Home,
  Hash,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListFilter,
  ListOrdered,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
  Mic2,
  Moon,
  Music2,
  Palette,
  Pencil,
  PhoneCall,
  PhoneOff,
  Plus,
  Power,
  Radio,
  RefreshCw,
  RotateCcw,
  Rocket,
  Save,
  Search,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Trophy,
  Upload,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
  Volume2,
  Wifi,
  X,
  Youtube
} from "lucide-react";
import "./styles.css";

type GuildListItem = {
  id: string;
  name: string;
  icon: string | null;
  owner: boolean;
  permission: string;
  botInstalled: boolean;
  botInstallStatus?: "installed" | "missing" | "unknown";
  botJoinedAt: string | null;
};

type GuildDetail = {
  id: string;
  name: string;
  icon: string | null;
  botInstalled: boolean;
  botInstallStatus?: "installed" | "missing" | "unknown";
  permission: string;
};

type SettingsRow = {
  locale: string;
  timezone: string | null;
  bot_nickname: string | null;
  bot_avatar_media_key: string | null;
  bot_avatar_sync_status: string;
  bot_avatar_sync_error: string | null;
};

type CommandConfig = {
  commandName: string;
  description: string;
  commandType: string;
  enabled: boolean;
  cooldownSeconds: number;
  ephemeral: boolean;
  administratorOnly: boolean;
  moderatorOnly: boolean;
  allowedChannelIds: string[];
  deniedChannelIds: string[];
  allowedRoleIds: string[];
  deniedRoleIds: string[];
};

type CustomCommand = {
  id: string;
  name: string;
  description: string;
  responseContent: string;
  enabled: boolean;
  ephemeral: boolean;
  cooldownSeconds: number;
  syncStatus: string;
  syncError: string | null;
};

type ChannelOption = {
  id: string;
  name: string;
  type: string;
  categoryName: string | null;
  canSend: boolean;
};

type SelectableGuildChannel = {
  id: string;
  name: string;
  type: string;
  categoryName: string | null;
  canSend?: boolean | null;
};

type RoleOption = {
  id: string;
  name: string;
  color: number;
  managed: boolean;
  botCanManage: boolean;
};

type FeatureModule =
  | "giveaways"
  | "reaction-roles"
  | "automations"
  | "moderation-center"
  | "suggestions"
  | "onboarding"
  | "auto-nickname"
  | "applications"
  | "starboard"
  | "server-stats"
  | "birthdays"
  | "minecraft"
  | "badges"
  | "community-tools"
  | "youtube-music"
  | "games";

type FeatureValue = string | number | boolean | string[] | null;
type FeatureFieldType = "text" | "textarea" | "number" | "toggle" | "select" | "channel" | "category" | "channels" | "role" | "roles";

type FeatureFieldDefinition = {
  key: string;
  label: string;
  description: string;
  type: FeatureFieldType;
  placeholder?: string;
  min?: number;
  max?: number;
  suffix?: string;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
};

type FeatureDefinition = {
  module: FeatureModule;
  section: string;
  label: string;
  kicker: string;
  description: string;
  icon: React.ReactNode;
  fields: FeatureFieldDefinition[];
};

type FeatureSettings = {
  enabled: boolean;
  fields: Record<string, FeatureValue>;
  syncStatus: string;
  syncError: string | null;
  updatedAt: string | null;
  configuredFields?: number;
  lastAppliedAt?: string | null;
};

type WelcomeSettings = {
  enabled: boolean;
  channelId: string | null;
  message: string;
  autoRoleId: string | null;
  embed: {
    useEmbed: boolean;
    title: string;
    description: string;
    color: string;
    imageMode: "banner" | "thumbnail" | "none";
    imageMediaKey: string | null;
    imageUrl: string | null;
    mentionMember: boolean;
    allowEveryone: boolean;
    allowedRoleIds: string[];
    showGeneratedCard: boolean;
  };
};

const LOG_CATEGORIES = [
  { key: "general", label: "Allgemein", text: "Fallback für alles ohne eigene Kategorie.", icon: Settings },
  { key: "messages", label: "Nachrichten", text: "Nachrichtenänderungen und gelöschte Inhalte.", icon: MessageSquare },
  { key: "moderation", label: "Moderation", text: "Warns, Kicks, Bans, Timeouts und Modcases.", icon: Shield },
  { key: "security", label: "Sicherheit", text: "Automod, Raidmode, Antinuke und kritische Schutzereignisse.", icon: ShieldCheck },
  { key: "tickets", label: "Tickets", text: "Ticket-Erstellung, Schließung und Support-Flows.", icon: LifeBuoy },
  { key: "voice", label: "Voice", text: "Voice-Bewegungen und Sprachkanal-Aktionen.", icon: Radio },
  { key: "members", label: "Mitglieder", text: "Joins, Leaves und mitgliederbezogene Ereignisse.", icon: UserRound },
  { key: "roles", label: "Rollen", text: "Rollenänderungen und Rollenverwaltung.", icon: BadgeCheck },
  { key: "channels", label: "Kanäle", text: "Kanaländerungen, Erstellungen und Löschungen.", icon: Hash },
  { key: "commands", label: "Befehle", text: "Slash- und Textbefehle aus dem Bot.", icon: Command },
  { key: "system", label: "System", text: "Setup, Bot-Updates, Backups und Systemaktionen.", icon: Cpu }
] as const;

type LogCategory = (typeof LOG_CATEGORIES)[number]["key"];

type LoggingSettings = {
  enabled: boolean;
  channelMappings: Record<LogCategory, string | null>;
  events: Record<LogCategory, boolean>;
};

type TempVoiceSettings = {
  enabled: boolean;
  creatorChannelIds: string[];
  categoryId: string | null;
  interfaceChannelId: string | null;
  nameTemplate: string;
  defaultUserLimit: number;
  defaultBitrateKbps: number;
  panelChannelId: string | null;
  panelMessageId: string | null;
  syncStatus: string;
  syncError: string | null;
};

type CountingSettings = {
  enabled: boolean;
  channelId: string | null;
  resetOnError: boolean;
  deleteWrongMessages: boolean;
  milestoneInterval: number;
  currentNumber: number;
  recordNumber: number;
  totalCounts: number;
  totalFailures: number;
  lastUserId: string | null;
  syncStatus: string;
  syncError: string | null;
};

type LevelRoleReward = {
  level: number;
  roleId: string;
};

type LevelSettings = {
  enabled: boolean;
  announcementChannelId: string | null;
  roleRewards: LevelRoleReward[];
  syncStatus: string;
  syncError: string | null;
};

type AutoroleSettings = {
  enabled: boolean;
  humanRoleIds: string[];
  botRoleIds: string[];
  delaySeconds: number;
  waitForScreening: boolean;
  syncStatus: string;
  syncError: string | null;
};

type SecuritySettings = {
  antispamEnabled: boolean;
  antispamMessageLimit: number;
  antispamWindowSeconds: number;
  antispamTimeoutSeconds: number;
  antilinkEnabled: boolean;
  antilinkTimeoutSeconds: number;
  antiinviteEnabled: boolean;
  antiinviteTimeoutSeconds: number;
  antimentionLimit: number;
  antimentionTimeoutSeconds: number;
  accountAgeMinDays: number;
  quarantineRoleId: string | null;
  verificationEnabled: boolean;
  verificationChannelId: string | null;
  verificationRoleId: string | null;
  verificationTitle: string;
  verificationText: string;
  auditLogWatchEnabled: boolean;
  antinukeEnabled: boolean;
  antinukeLimit: number;
  antinukeWindowSeconds: number;
  antinukePunishment: "log" | "timeout" | "kick" | "ban" | "quarantine";
  allowedDomains: string[];
  blockedDomains: string[];
  healthScore: number;
  activeProtections: number;
  totalProtections: number;
  botCanManageRoles: boolean;
  botCanViewAuditLog: boolean;
  verificationMessageId: string | null;
  syncStatus: string;
  syncError: string | null;
};

type RaidSettings = {
  profile: "off" | "light" | "strict";
  panicEnabled: boolean;
  panicSlowmodeSeconds: number;
  raidmodeEnabled: boolean;
  memberCount: number;
  textChannelCount: number;
  changedSlowmodeChannels?: number;
  syncStatus: string;
  syncError: string | null;
};

type TicketCategory = {
  label: string;
  description: string;
  emoji: string;
  value: string;
};

type TicketSettings = {
  enabled: boolean;
  ticketCategoryId: string | null;
  panelChannelId: string | null;
  logChannelId: string | null;
  supportRoleIds: string[];
  notifyRoleId: string | null;
  panelTitle: string;
  panelDescription: string;
  formTitle: string;
  formQuestions: string[];
  selectCategories: TicketCategory[];
  ratingEnabled: boolean;
  autoCloseHours: number;
  reminderHours: number;
  slaHours: number;
  blacklistRoleIds: string[];
  blacklistUserIds: string[];
  totalTickets: number;
  openTickets: number;
  closedTickets: number;
  deletedTickets: number;
  averageRating: number | null;
  panelMessageId: string | null;
  syncStatus: string;
  syncError: string | null;
};

type BackupItem = {
  scope: "roles" | "channels" | "full";
  savedAt: string | null;
  itemCount: number;
};

type BackupSettings = {
  items: BackupItem[];
  lastSavedAt: string | null;
  guildRoleCount: number;
  guildChannelCount: number;
  pendingAction?: string | null;
  pendingScope?: string | null;
  lastAction?: string | null;
  lastScope?: string | null;
  restoredItems?: number;
  syncStatus: string;
  syncError: string | null;
};

type AdminRuntime = {
  id: string;
  status: string | null;
  activityType: string | null;
  activityText: string | null;
  latencyMs: number | null;
  ramMb: number | null;
  cpuPercent: number | null;
  guildCount: number | null;
  userCount: number | null;
  commandCount: number | null;
  shardCount: number | null;
  pythonVersion: string | null;
  discordPyVersion: string | null;
  platform: string | null;
  botVersion: string | null;
  uptimeSeconds: number | null;
  processUptimeSeconds: number | null;
  updatedAt: string | null;
  details: {
    bot?: { id?: string; name?: string; avatar?: string | null };
    heartbeat?: boolean;
    source?: string;
    pterodactyl?: {
      state?: string;
      suspended?: boolean;
      ramMb?: number | null;
      cpuPercent?: number | null;
      diskMb?: number | null;
      uptimeSeconds?: number | null;
      checkedAt?: string | null;
    } | null;
    lavalink?: {
      backend?: string;
      uri?: string;
      identifier?: string;
      searchSource?: string;
      status?: string;
      connected?: boolean;
      players?: number;
      activePlayers?: number;
      queueItems?: number;
      playerSource?: "youtube" | "spotify";
    } | null;
    music?: {
      backend?: string;
      playerSource?: "youtube" | "spotify";
      searchSource?: string;
      availableSources?: Array<"youtube" | "spotify">;
      defaultVolume?: number;
      activePlayers?: number;
      savedPlayers?: number;
      queueItems?: number;
      players?: Array<{
        guildId: string;
        guildName?: string;
        channelName?: string | null;
        playing?: boolean;
        paused?: boolean;
        volume?: number | null;
        trackTitle?: string | null;
        queueLength?: number;
      }>;
    } | null;
    logs?: Array<{
      level?: string;
      source?: string;
      message?: string;
      createdAt?: string;
    }>;
    guilds?: Array<{
      id: string;
      name: string;
      icon?: string | null;
      memberCount: number | null;
      channelCount: number;
      roleCount: number;
      ownerId?: string | null;
      ownerName?: string | null;
      shardId?: number | null;
      createdAt?: string | null;
      joinedAt?: string | null;
    }>;
  };
};

type OwnerLogData = {
  logs: Array<{ level?: string; source?: string; message?: string; createdAt?: string }>;
  syncEvents: Array<{
    id: string;
    action: string;
    status: string;
    lastError: string | null;
    createdAt: string;
    completedAt: string | null;
    guildId: string | null;
    guildName: string | null;
  }>;
  auditLog: Array<{
    id: string;
    action: string;
    target: string;
    actorDiscordUserId: string;
    createdAt: string;
    guildId: string | null;
    guildName: string | null;
  }>;
};

type AdminData = {
  runtime: AdminRuntime | null;
  adminRestricted: boolean;
  stats: {
    knownGuilds: number;
    installedGuilds: number;
    knownCommands: number;
  };
  recentEvents: Array<{
    id: string;
    action: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError: string | null;
    createdAt: string;
    completedAt: string | null;
    guildId: string | null;
    guildName: string | null;
  }>;
};

type AdminGuildDetail = {
  guild: {
    id: string;
    name: string;
    icon: string | null;
    ownerId: string | null;
    ownerName: string | null;
    memberCount: number | null;
    presenceCount: number | null;
    channelCount: number;
    roleCount: number;
    shardId: number | null;
    createdAt: string | null;
    joinedAt: string | null;
    features: string[];
  };
  settings: {
    botNickname: string | null;
    effectiveBotNickname: string | null;
  };
  roles: Array<{
    id: string;
    name: string;
    color: string;
    position: number;
    managed: boolean;
    botCanManage: boolean;
    permissions: string | null;
    mentionable: boolean;
    hoist: boolean;
  }>;
  channels: Array<{
    id: string;
    name: string;
    type: string;
    typeCode: number;
    categoryId: string | null;
    categoryName: string | null;
    position: number;
    canView: boolean | null;
    canSend: boolean | null;
    topic: string | null;
    nsfw: boolean;
    slowmodeSeconds: number;
    bitrateKbps: number;
    userLimit: number;
    botCanManage: boolean;
    specialUse: string | null;
  }>;
  members: Array<{
    id: string;
    username: string;
    displayName: string;
    globalName: string | null;
    nick: string | null;
    avatar: string | null;
    bot: boolean;
    roles: string[];
    joinedAt: string | null;
    premiumSince: string | null;
    communicationDisabledUntil: string | null;
    manageable: boolean;
    manageBlockReason: string | null;
  }>;
  modules: {
    logging: boolean;
    welcome: boolean;
    tempVoice: boolean;
    counting: boolean;
    levelSystem: boolean;
    autorole: boolean;
    spotifyMusic: boolean;
    games: boolean;
    moderation: boolean;
  };
  permissionChecks: Array<{
    key: string;
    label: string;
    description: string;
    ok: boolean | null;
    group: string;
  }>;
  limits: {
    membersShown: number;
    membersPartial: boolean;
  };
  warnings: string[];
};

type AdminMemberAction = "timeout" | "timeout_remove" | "kick" | "ban";

const ADMIN_ROLE_PERMISSION_OPTIONS = [
  { bit: "1024", label: "Kanäle sehen", group: "Basis" },
  { bit: "2048", label: "Nachrichten senden", group: "Basis" },
  { bit: "16384", label: "Links einbetten", group: "Basis" },
  { bit: "32768", label: "Dateien anhängen", group: "Basis" },
  { bit: "65536", label: "Verlauf lesen", group: "Basis" },
  { bit: "8192", label: "Nachrichten verwalten", group: "Moderation" },
  { bit: "1099511627776", label: "Timeouts setzen", group: "Moderation" },
  { bit: "2", label: "Mitglieder kicken", group: "Moderation" },
  { bit: "4", label: "Mitglieder bannen", group: "Moderation" },
  { bit: "16", label: "Kanäle verwalten", group: "Verwaltung" },
  { bit: "268435456", label: "Rollen verwalten", group: "Verwaltung" },
  { bit: "8", label: "Administrator", group: "Verwaltung", danger: true }
] as const;

function permissionBitEnabled(value: string | null, bit: string): boolean {
  try {
    return (BigInt(value || "0") & BigInt(bit)) === BigInt(bit);
  } catch {
    return false;
  }
}

function togglePermissionBit(value: string, bit: string): string {
  try {
    return (BigInt(value || "0") ^ BigInt(bit)).toString();
  } catch {
    return value;
  }
}

type AdminGuildInvite = {
  code: string;
  url: string;
  channelId: string | null;
  channelName: string | null;
  inviterId: string | null;
  inviterName: string | null;
  uses: number | null;
  maxUses: number | null;
  maxAge: number | null;
  temporary: boolean;
  createdAt: string | null;
  expiresAt: string | null;
};

type User = {
  discordUserId?: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  ownerAdmin?: boolean;
};

type ThemeMode = "dark" | "light";
type ToastTone = "success" | "danger" | "warning" | "info";
type HomeGuildFilter = "all" | "installed" | "missing" | "favorites";
type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  path?: string;
  href?: string;
};

type ApiError = {
  error?: { code?: string; message?: string };
};

const plannedSections = [
  {
    section: "welcome",
    label: "Begrüßung",
    headline: "Begrüßung",
    description: "Willkommensnachrichten, Startrollen und erste Schritte für neue Mitglieder.",
    items: [
      { kicker: "Nachricht", title: "Willkommenskarte", text: "Eigener Text, Server-Icon und Platzhalter für neue Mitglieder." },
      { kicker: "Kanal", title: "Zielkanal", text: "Separater Kanal für Begrüßung, Regeln oder Onboarding." },
      { kicker: "Rollen", title: "Startrollen", text: "Optionale Rollen, die später automatisch vergeben werden können." }
    ]
  },
  {
    section: "logging",
    label: "Logging",
    headline: "Logging",
    description: "Saubere Ereignis-Logs für Nachrichten, Rollen, Channels und wichtige Bot-Aktionen.",
    items: [
      { kicker: "Events", title: "Log-Kategorien", text: "Nachrichten, Moderation, Rollen und Serveränderungen getrennt schalten." },
      { kicker: "Kanäle", title: "Log-Ziele", text: "Für jede Kategorie ein eigener Discord-Kanal." },
      { kicker: "Filter", title: "Ausnahmen", text: "Rollen, Kanäle und Aktionen vom Logging ausnehmen." }
    ]
  },
  {
    section: "moderation",
    label: "Moderation",
    headline: "Moderation",
    description: "Moderations-Werkzeuge mit klaren Regeln, Rollenrechten und nachvollziehbaren Aktionen.",
    items: [
      { kicker: "Aktionen", title: "Warns und Timeouts", text: "Moderationsaktionen zentral steuern und später im Audit-Log sehen." },
      { kicker: "Regeln", title: "Auto-Moderation", text: "Spam, Links und problematische Inhalte serverweit begrenzen." },
      { kicker: "Rollen", title: "Team-Rechte", text: "Moderator- und Admin-Rollen gezielt für Tools freigeben." }
    ]
  },
  {
    section: "danger-zone",
    label: "Gefahrenbereich",
    headline: "Gefahrenbereich",
    description: "Kritische Aktionen mit deutlicher Bestätigung und Schutz vor versehentlichem Löschen.",
    items: [
      { kicker: "Reset", title: "Guild-Daten zurücksetzen", text: "Serverdaten später kontrolliert und nachvollziehbar löschen." },
      { kicker: "Sync", title: "Bot neu synchronisieren", text: "Rollen, Kanäle und Commands frisch vom Discord-Server laden." },
      { kicker: "Schutz", title: "Bestätigungspflicht", text: "Gefährliche Aktionen erst nach klarer Bestätigung ausführen." }
    ],
    tone: "danger"
  },
  {
    section: "temp-voice",
    label: "Temp-Voice",
    headline: "Temp-Voice",
    description: "Temporäre Voice-Kanäle mit Join-to-create, Besitzerrechten und sauberem Auto-Cleanup.",
    items: [
      { kicker: "Setup", title: "Join-to-create", text: "Einen Voice-Kanal auswählen, über den Mitglieder eigene Räume erstellen." },
      { kicker: "Kontrolle", title: "Raumrechte", text: "Besitzer, Limits, Namen, Sperren und Einladungen direkt verwalten." },
      { kicker: "Cleanup", title: "Auto-Aufräumen", text: "Leere temporäre Kanäle automatisch entfernen und alte Räume sauber schließen." }
    ]
  },
  {
    section: "counting",
    label: "Counting",
    headline: "Counting",
    description: "Gemeinsam von 1 aufwärts zählen, Rekorde brechen und Fehler automatisch erkennen.",
    items: [
      { kicker: "Kanal", title: "Counting-Kanal", text: "Ein eigener Textkanal für die serverweite Zahlenkette." },
      { kicker: "Regeln", title: "Saubere Reihenfolge", text: "Nur die nächste Zahl zählt und niemand darf zweimal direkt hintereinander." },
      { kicker: "Rekord", title: "Statistik", text: "Aktueller Lauf, Bestwert und Spielerbeiträge bleiben erhalten." }
    ]
  },
  {
    section: "level-system",
    label: "Level-System",
    headline: "Level-System",
    description: "Nachrichten-XP, Levelaufstiege und automatische Rollenbelohnungen zentral verwalten.",
    items: [
      { kicker: "Aufstiege", title: "Level-up-Kanal", text: "Optionaler Zielkanal mit automatischem Fallback auf den Nachrichtenkanal." },
      { kicker: "Belohnungen", title: "Levelrollen", text: "Für frei wählbare Level automatisch passende Discord-Rollen vergeben." },
      { kicker: "Fortschritt", title: "Nachrichten-XP", text: "Aktivität mit Cooldown fair in XP und sichtbare Level umwandeln." }
    ]
  },
  {
    section: "autorole",
    label: "Autorole",
    headline: "Autorole",
    description: "Mehrere Startrollen für neue Mitglieder und Bots sicher und getrennt verwalten.",
    items: [
      { kicker: "Mitglieder", title: "Mehrfachrollen", text: "Beliebig kombinierbare Rollen für neue menschliche Mitglieder." },
      { kicker: "Bots", title: "Eigene Botrollen", text: "Automatische Rollen für neu hinzugefügte Discord-Bots getrennt festlegen." },
      { kicker: "Sicherheit", title: "Screening & Hierarchie", text: "Membership-Screening abwarten und nur verwaltbare Rollen zulassen." }
    ]
  },
  {
    section: "youtube-music",
    label: "YouTube Music",
    headline: "YouTube Music",
    description: "Musiksteuerung für YouTube mit Queue, DJ-Regeln und stabilen Lavalink-Player-Einstellungen.",
    items: [
      { kicker: "Player", title: "Queue & Playback", text: "Aktuelle Queue, Lautstärke, Loop, Skip und Autoplay über das Panel steuern." },
      { kicker: "Rechte", title: "DJ-Modus", text: "DJ-Rollen, Vote-Skip und erlaubte Musikkanäle sauber einstellen." },
      { kicker: "Quelle", title: "YouTube-Fokus", text: "YouTube-Suche, direkte Links und Lavalink-Status zentral sichtbar machen." }
    ]
  },
  {
    section: "games",
    label: "Games",
    headline: "Games",
    description: "Mini-Games, Economy-Aktionen und Spielrunden übersichtlich aktivieren und konfigurieren.",
    items: [
      { kicker: "Spiele", title: "Mini-Games", text: "8ball, Würfel, Ship und weitere Fun-Commands pro Server steuern." },
      { kicker: "Runden", title: "Sessions", text: "Spielkanäle, Cooldowns und Teilnahme-Regeln pro Guild vorbereiten." },
      { kicker: "Belohnungen", title: "Rewards", text: "XP, Coins oder Rollen später sauber mit Spielaktivität verbinden." }
    ]
  }
] as const;

type PlannedSection = (typeof plannedSections)[number];

function plannedIcon(section: string, size = 17) {
  switch (section) {
    case "welcome":
      return <Sparkles size={size} />;
    case "logging":
      return <Settings size={size} />;
    case "moderation":
      return <Shield size={size} />;
    case "danger-zone":
      return <AlertTriangle size={size} />;
    case "temp-voice":
      return <Mic2 size={size} />;
    case "counting":
      return <ListOrdered size={size} />;
    case "level-system":
      return <BarChart3 size={size} />;
    case "autorole":
      return <UserPlus size={size} />;
    case "youtube-music":
    case "spotify-music":
      return <Youtube size={size} />;
    case "games":
      return <Gamepad2 size={size} />;
    default:
      return <Settings size={size} />;
  }
}

function getPlannedSection(section: string) {
  const normalizedSection = section === "spotify-music" ? "youtube-music" : section;
  return plannedSections.find((item) => item.section === normalizedSection);
}

const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  {
    module: "giveaways",
    section: "giveaways",
    label: "Giveaways",
    kicker: "Community Rewards",
    description: "Standardwerte, Teamrechte und Zielkanal für neue Verlosungen zentral festlegen.",
    icon: <Trophy size={18} />,
    fields: [
      { key: "defaultChannelId", label: "Standardkanal", description: "Neue Giveaways verwenden diesen Kanal als vorausgewähltes Ziel.", type: "channel" },
      { key: "managerRoleIds", label: "Giveaway-Team", description: "Diese Rollen dürfen Verlosungen verwalten.", type: "roles", wide: true },
      { key: "defaultWinnerCount", label: "Gewinner", description: "Voreinstellung für die Anzahl der Gewinner.", type: "number", min: 1, max: 20, suffix: "Personen" },
      { key: "defaultDurationMinutes", label: "Laufzeit", description: "Standarddauer für neue Verlosungen.", type: "number", min: 1, max: 525600, suffix: "Minuten" },
      { key: "mentionRoleId", label: "Erwähnungsrolle", description: "Optionale Rolle, die beim Start erwähnt wird.", type: "role" },
      { key: "defaultDescription", label: "Standardbeschreibung", description: "Wird als Ausgangstext für neue Giveaways verwendet.", type: "textarea", placeholder: "Klicke auf Teilnehmen, um mitzumachen.", wide: true }
    ]
  },
  {
    module: "reaction-roles",
    section: "reaction-roles",
    label: "Reaction Roles",
    kicker: "Self Roles",
    description: "Rollenpanel, auswählbare Rollen und Mehrfachauswahl für Mitglieder vorbereiten.",
    icon: <BadgeCheck size={18} />,
    fields: [
      { key: "panelChannelId", label: "Panelkanal", description: "Kanal, in dem das Rollenpanel veröffentlicht wird.", type: "channel" },
      { key: "allowMultiple", label: "Mehrfachauswahl", description: "Mitglieder dürfen mehrere Rollen aus dem Panel wählen.", type: "toggle" },
      { key: "panelTitle", label: "Paneltitel", description: "Überschrift des Rollenpanels.", type: "text", placeholder: "Wähle deine Rollen" },
      { key: "panelDescription", label: "Panelbeschreibung", description: "Kurze Erklärung oberhalb der Rollenauswahl.", type: "textarea", wide: true },
      { key: "roleIds", label: "Auswählbare Rollen", description: "Rollen, die im Self-Role-Panel angeboten werden.", type: "roles", wide: true }
    ]
  },
  {
    module: "automations",
    section: "automations",
    label: "Automationen",
    kicker: "Scheduled Operations",
    description: "Sticky-, wiederkehrende und geplante Nachrichten an einem Ort konfigurieren.",
    icon: <Clock3 size={18} />,
    fields: [
      { key: "channelId", label: "Zielkanal", description: "Gemeinsames Ziel für die konfigurierten Nachrichten.", type: "channel" },
      { key: "intervalMinutes", label: "Intervall", description: "Abstand zwischen wiederkehrenden Nachrichten.", type: "number", min: 1, max: 525600, suffix: "Minuten" },
      { key: "stickyMessage", label: "Sticky-Nachricht", description: "Bleibt durch erneutes Senden am Ende des Kanals sichtbar.", type: "textarea", wide: true },
      { key: "recurringMessage", label: "Wiederkehrende Nachricht", description: "Text für die regelmäßige Veröffentlichung.", type: "textarea", wide: true },
      { key: "scheduledMessage", label: "Geplante Nachricht", description: "Einmalige Nachricht für den angegebenen Zeitpunkt.", type: "textarea", wide: true },
      { key: "scheduledAt", label: "Zeitpunkt", description: "ISO-Zeitpunkt, zum Beispiel 2026-08-01T18:00:00+02:00.", type: "text", placeholder: "2026-08-01T18:00:00+02:00" }
    ]
  },
  {
    module: "moderation-center",
    section: "moderation-center",
    label: "Moderation",
    kicker: "Moderation Center",
    description: "Teamrollen, Mod-Logs, Warnablauf und automatische Eskalationen verwalten.",
    icon: <Shield size={18} />,
    fields: [
      { key: "logChannelId", label: "Moderations-Log", description: "Warns, Timeouts, Kicks und Bans werden hier protokolliert.", type: "channel" },
      { key: "moderatorRoleIds", label: "Moderatorrollen", description: "Rollen mit Zugriff auf die Moderationswerkzeuge.", type: "roles", wide: true },
      { key: "warnExpireDays", label: "Warnablauf", description: "Nach dieser Zeit laufen Verwarnungen automatisch ab; 0 deaktiviert den Ablauf.", type: "number", min: 0, max: 3650, suffix: "Tage" },
      { key: "defaultTimeoutMinutes", label: "Standard-Timeout", description: "Vorausgewählte Timeout-Dauer.", type: "number", min: 1, max: 40320, suffix: "Minuten" },
      { key: "autoPunishmentThreshold", label: "Eskalationsgrenze", description: "Anzahl aktiver Warns bis zur automatischen Strafe; 0 deaktiviert sie.", type: "number", min: 0, max: 100, suffix: "Warns" },
      {
        key: "autoPunishmentAction",
        label: "Automatische Strafe",
        description: "Aktion beim Erreichen der Eskalationsgrenze.",
        type: "select",
        options: [
          { value: "timeout", label: "Timeout" },
          { value: "kick", label: "Kicken" },
          { value: "ban", label: "Bannen" },
          { value: "log", label: "Nur protokollieren" }
        ]
      }
    ]
  },
  {
    module: "suggestions",
    section: "suggestions",
    label: "Vorschläge",
    kicker: "Community Feedback",
    description: "Vorschlagskanal, internes Review und anonyme Einreichungen steuern.",
    icon: <MessageSquare size={18} />,
    fields: [
      { key: "channelId", label: "Vorschlagskanal", description: "Öffentlicher Kanal für neue Vorschläge.", type: "channel" },
      { key: "reviewChannelId", label: "Review-Kanal", description: "Optionales internes Ziel für neue Vorschläge.", type: "channel" },
      { key: "reviewerRoleIds", label: "Reviewerrollen", description: "Diese Rollen können Vorschläge annehmen oder ablehnen.", type: "roles", wide: true },
      { key: "anonymous", label: "Anonyme Vorschläge", description: "Der Verfasser wird in der öffentlichen Nachricht nicht angezeigt.", type: "toggle" },
      { key: "autoThread", label: "Diskussionsthread", description: "Für jeden Vorschlag automatisch einen Thread erstellen.", type: "toggle" }
    ]
  },
  {
    module: "onboarding",
    section: "onboarding",
    label: "Onboarding",
    kicker: "Member Journey",
    description: "Verifizierung, Mindestalter des Accounts und Einstiegstext sauber bündeln.",
    icon: <UserPlus size={18} />,
    fields: [
      { key: "verificationChannelId", label: "Verifizierungskanal", description: "Kanal für das Verifizierungs-Panel.", type: "channel" },
      { key: "verificationRoleId", label: "Verifizierte Rolle", description: "Wird nach erfolgreicher Verifizierung vergeben.", type: "role" },
      { key: "verificationTitle", label: "Titel", description: "Überschrift des Verifizierungs-Panels.", type: "text", placeholder: "Verifizierung" },
      { key: "accountAgeMinDays", label: "Mindestalter", description: "Minimales Discord-Accountalter; 0 deaktiviert die Prüfung.", type: "number", min: 0, max: 3650, suffix: "Tage" },
      { key: "verificationText", label: "Paneltext", description: "Erklärt Mitgliedern den Verifizierungsschritt.", type: "textarea", wide: true }
    ]
  },
  {
    module: "auto-nickname",
    section: "auto-nickname",
    label: "Auto-Nickname",
    kicker: "Identity Automation",
    description: "Neue Mitglieder automatisch nach einer einheitlichen Vorlage benennen.",
    icon: <AtSign size={18} />,
    fields: [
      { key: "template", label: "Nickname-Vorlage", description: "Verwende zum Beispiel {username}, {display_name} oder {id}.", type: "text", placeholder: "[Member] {username}", wide: true },
      { key: "includeBots", label: "Bots einschließen", description: "Die Vorlage wird auch auf neu beitretende Bots angewendet.", type: "toggle" }
    ]
  },
  {
    module: "applications",
    section: "applications",
    label: "Bewerbungen",
    kicker: "Application Center",
    description: "Bewerbungen, Reports und Entbannungsanträge mit Teamrechten organisieren.",
    icon: <ClipboardList size={18} />,
    fields: [
      { key: "applicationChannelId", label: "Bewerbungskanal", description: "Öffentlicher Einstieg für Bewerbungen.", type: "channel" },
      { key: "reviewChannelId", label: "Review-Kanal", description: "Interner Kanal für eingegangene Bewerbungen.", type: "channel" },
      { key: "reportChannelId", label: "Report-Kanal", description: "Interner Kanal für gemeldete Fälle.", type: "channel" },
      { key: "appealChannelId", label: "Entbannungsanträge", description: "Interner Kanal für Appeals.", type: "channel" },
      { key: "reviewerRoleIds", label: "Bearbeiterrollen", description: "Teamrollen, die Einreichungen verwalten dürfen.", type: "roles", wide: true },
      { key: "title", label: "Formulartitel", description: "Titel für das Bewerbungsformular.", type: "text", placeholder: "Team-Bewerbung" },
      { key: "questions", label: "Fragen", description: "Eine Frage pro Zeile. Die Reihenfolge wird übernommen.", type: "textarea", placeholder: "Wie alt bist du?\nWarum möchtest du ins Team?", wide: true }
    ]
  },
  {
    module: "starboard",
    section: "starboard",
    label: "Starboard",
    kicker: "Community Highlights",
    description: "Beliebte Nachrichten automatisch in einem Highlight-Kanal sammeln.",
    icon: <Star size={18} />,
    fields: [
      { key: "channelId", label: "Starboard-Kanal", description: "Ziel für Nachrichten, die den Schwellenwert erreichen.", type: "channel" },
      { key: "emoji", label: "Reaktions-Emoji", description: "Unicode- oder Server-Emoji, das gezählt wird.", type: "text", placeholder: "⭐" },
      { key: "threshold", label: "Schwellenwert", description: "Benötigte Reaktionen für einen Starboard-Eintrag.", type: "number", min: 1, max: 100, suffix: "Reaktionen" },
      { key: "allowSelfStar", label: "Eigene Reaktion", description: "Nachrichtenautoren dürfen ihre eigene Nachricht werten.", type: "toggle" },
      { key: "ignoredChannelIds", label: "Ignorierte Kanäle", description: "Nachrichten aus diesen Kanälen erscheinen nie im Starboard.", type: "channels", wide: true }
    ]
  },
  {
    module: "server-stats",
    section: "server-stats",
    label: "Server-Statistiken",
    kicker: "Live Counters",
    description: "Automatische Voice-Counter für Mitglieder, Bots und Online-Status konfigurieren.",
    icon: <BarChart3 size={18} />,
    fields: [
      { key: "categoryId", label: "Counter-Kategorie", description: "Kategorie, in der die Statistikkanäle liegen.", type: "category" },
      { key: "updateMinutes", label: "Aktualisierung", description: "Zeitabstand für regelmäßige Counter-Updates.", type: "number", min: 1, max: 1440, suffix: "Minuten" },
      { key: "memberChannelName", label: "Mitglieder-Counter", description: "Nutze {count} als Platzhalter.", type: "text", placeholder: "Mitglieder: {count}" },
      { key: "botChannelName", label: "Bot-Counter", description: "Nutze {count} als Platzhalter.", type: "text", placeholder: "Bots: {count}" },
      { key: "onlineChannelName", label: "Online-Counter", description: "Nutze {count} als Platzhalter.", type: "text", placeholder: "Online: {count}" }
    ]
  },
  {
    module: "birthdays",
    section: "birthdays",
    label: "Geburtstage",
    kicker: "Member Moments",
    description: "Geburtstagsnachrichten, Zeitzone und optionale Tagesrolle verwalten.",
    icon: <Sparkles size={18} />,
    fields: [
      { key: "channelId", label: "Geburtstagskanal", description: "Hier veröffentlicht der Bot Glückwünsche.", type: "channel" },
      { key: "roleId", label: "Geburtstagsrolle", description: "Optionale Rolle für das Geburtstagskind.", type: "role" },
      { key: "timezone", label: "Zeitzone", description: "IANA-Zeitzone für den Tageswechsel.", type: "text", placeholder: "Europe/Berlin" },
      { key: "message", label: "Glückwunschtext", description: "Verwende {user} als Erwähnung.", type: "textarea", placeholder: "Alles Gute zum Geburtstag, {user}!", wide: true }
    ]
  },
  {
    module: "minecraft",
    section: "minecraft",
    label: "Minecraft",
    kicker: "Game Integration",
    description: "Standardserver, Statusziel und Rollen für Whitelist-Aktionen festlegen.",
    icon: <Server size={18} />,
    fields: [
      { key: "serverAddress", label: "Serveradresse", description: "Standardadresse für Status- und Spielerabfragen.", type: "text", placeholder: "play.example.net" },
      { key: "statusChannelId", label: "Statuskanal", description: "Ziel für automatische Statusmeldungen.", type: "channel" },
      { key: "whitelistRoleIds", label: "Whitelist-Team", description: "Rollen, die Whitelist-Einträge verwalten dürfen.", type: "roles", wide: true },
      { key: "showPlayers", label: "Spielerliste anzeigen", description: "Online-Spieler dürfen in Statusmeldungen erscheinen.", type: "toggle" }
    ]
  },
  {
    module: "badges",
    section: "badges",
    label: "Badges",
    kicker: "Member Recognition",
    description: "Badge-Verwaltung, Ankündigungen und öffentliche Profile konfigurieren.",
    icon: <Crown size={18} />,
    fields: [
      { key: "announceChannelId", label: "Ankündigungskanal", description: "Neue Badge-Vergaben können hier gemeldet werden.", type: "channel" },
      { key: "managerRoleIds", label: "Badge-Team", description: "Rollen, die Badges erstellen und vergeben dürfen.", type: "roles", wide: true },
      { key: "allowSelfProfile", label: "Öffentliche Profile", description: "Mitglieder dürfen ihr eigenes Badge-Profil anzeigen.", type: "toggle" }
    ]
  },
  {
    module: "community-tools",
    section: "community-tools",
    label: "Community Tools",
    kicker: "Engagement Suite",
    description: "Beichten, Zitate und Umfragen auf feste Kanäle begrenzen.",
    icon: <UsersRound size={18} />,
    fields: [
      { key: "confessionChannelId", label: "Beichten", description: "Zielkanal für anonyme Beichten.", type: "channel" },
      { key: "quoteChannelId", label: "Zitate", description: "Zielkanal für gespeicherte Community-Zitate.", type: "channel" },
      { key: "pollChannelId", label: "Umfragen", description: "Bevorzugter Kanal für Community-Umfragen.", type: "channel" },
      { key: "anonymousConfessions", label: "Anonym veröffentlichen", description: "Der Absender einer Beichte bleibt öffentlich verborgen.", type: "toggle" }
    ]
  },
  {
    module: "youtube-music",
    section: "youtube-music",
    label: "YouTube Music",
    kicker: "Music Operations",
    description: "Request-Kanal, DJ-Rollen, Lautstärke und Queue-Regeln für Lavalink festlegen.",
    icon: <Youtube size={18} />,
    fields: [
      { key: "requestChannelId", label: "Musikkanal", description: "Bevorzugter Kanal für Musikwünsche und Playermeldungen.", type: "channel" },
      { key: "djRoleIds", label: "DJ-Rollen", description: "Rollen mit erweiterten Playerrechten.", type: "roles", wide: true },
      { key: "defaultVolume", label: "Standardlautstärke", description: "Startlautstärke für neue Player.", type: "number", min: 1, max: 100, suffix: "%" },
      { key: "maxQueueLength", label: "Queue-Limit", description: "Maximale Anzahl gespeicherter Titel pro Server.", type: "number", min: 1, max: 1000, suffix: "Titel" },
      { key: "autoplay", label: "Autoplay", description: "Nach dem Ende der Queue automatisch passende Titel suchen.", type: "toggle" }
    ]
  },
  {
    module: "games",
    section: "games",
    label: "Games",
    kicker: "Fun & Rewards",
    description: "Spielkanäle, Cooldown und Belohnungen für Fun-Commands steuern.",
    icon: <Gamepad2 size={18} />,
    fields: [
      { key: "allowedChannelIds", label: "Erlaubte Spielkanäle", description: "Ist die Liste leer, funktionieren Spiele in allen Textkanälen.", type: "channels", wide: true },
      { key: "cooldownSeconds", label: "Spiel-Cooldown", description: "Mindestabstand zwischen Spielaktionen eines Nutzers.", type: "number", min: 0, max: 86400, suffix: "Sekunden" },
      { key: "xpRewards", label: "XP-Belohnungen", description: "Erfolgreiche Spielrunden können Level-XP vergeben.", type: "toggle" },
      { key: "dailyReward", label: "Tägliche Belohnung", description: "Voreinstellung für die tägliche Economy-Belohnung.", type: "number", min: 0, max: 1000000, suffix: "Coins" }
    ]
  }
];

function getFeatureDefinition(section: string) {
  return FEATURE_DEFINITIONS.find((definition) => definition.section === section);
}

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function adminGuildViewPath(guild: { id: string; name: string }) {
  return `/admin/discordguilds/view/${encodeURIComponent(guild.id)}/${encodeURIComponent(guild.name || "guild")}`;
}

function safeClientReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/") || value.startsWith("/login")) {
    return "/panel";
  }
  return value;
}

async function downloadJson(path: string, filename: string) {
  const data = await api<unknown>(path);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const ownerActionLabels: Record<string, string> = {
  "snapshot.refresh": "Snapshot neu laden",
  "runtime.refresh": "Runtime melden",
  "commands.sync": "Slash Commands syncen",
  "music.reconnect": "Lavalink verbinden",
  "music.disconnect_all": "Musik trennen",
  "restart.request": "Bot-Restart anfragen"
};

const guildModuleLabels = [
  { key: "logging", label: "Logging", text: "Server- und Moderationsereignisse sammeln.", icon: ListFilter },
  { key: "welcome", label: "Begrüßung", text: "Welcome-Nachrichten und Startrollen aktiv halten.", icon: Sparkles },
  { key: "tempVoice", label: "Temp-Voice", text: "Join-to-create und temporäre Sprachräume.", icon: Mic2 },
  { key: "counting", label: "Counting", text: "Gemeinsame Zahlenkette mit Rekord und Rangliste.", icon: ListOrdered },
  { key: "levelSystem", label: "Level-System", text: "Nachrichten-XP, Aufstiege und automatische Levelrollen.", icon: BarChart3 },
  { key: "autorole", label: "Autorole", text: "Mehrere Startrollen für Mitglieder und Bots.", icon: UserPlus },
  { key: "spotifyMusic", label: "YouTube Music", text: "YouTube-Musik, Lavalink und DJ-Regeln.", icon: Youtube },
  { key: "games", label: "Games", text: "Fun- und Mini-Game-Kommandos.", icon: Gamepad2 },
  { key: "moderation", label: "Moderation", text: "Warns, Timeouts und Schutzmodule.", icon: Shield }
] as const;

const THEME_STORAGE_KEY = "modmail-manager-theme";
const FAVORITE_GUILDS_STORAGE_KEY = "modmail-manager-favorite-guilds";
const TOAST_EVENT_NAME = "modmail-manager-toast";
const LEGACY_THEME_STORAGE_KEY = "eclipsebot-theme";
const LEGACY_FAVORITE_GUILDS_STORAGE_KEY = "eclipsebot-favorite-guilds";

type ToastPayload = {
  tone?: ToastTone;
  title: string;
  text?: string;
};

type ToastItem = Required<Pick<ToastPayload, "tone" | "title">> & {
  id: string;
  text?: string;
};

function notify(toast: ToastPayload) {
  window.dispatchEvent(
    new CustomEvent<ToastPayload>(TOAST_EVENT_NAME, {
      detail: toast
    })
  );
}

function readFavoriteGuilds(): string[] {
  try {
    const stored = window.localStorage.getItem(FAVORITE_GUILDS_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_FAVORITE_GUILDS_STORAGE_KEY)
      ?? "[]";
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function saveFavoriteGuilds(ids: string[]) {
  try {
    window.localStorage.setItem(FAVORITE_GUILDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Favorites are a browser convenience; failing to persist should not block the panel.
  }
}

function readStoredTheme(): ThemeMode {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
      ?? window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    return stored === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // localStorage can be unavailable in strict browser privacy modes.
    }
  }, [theme]);

  return {
    theme,
    toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
  };
}

function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useThemeMode();
  const light = theme === "light";

  return (
    <button
      type="button"
      className={`theme-toggle ${light ? "light" : "dark"} ${compact ? "compact" : ""}`}
      onClick={toggleTheme}
      aria-label={light ? "Dark Mode aktivieren" : "Light Mode aktivieren"}
      title={light ? "Dark Mode aktivieren" : "Light Mode aktivieren"}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">{light ? <Sun size={14} /> : <Moon size={14} />}</span>
      </span>
      {!compact && <span>{light ? "Light" : "Dark"}</span>}
    </button>
  );
}

function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function onToast(event: Event) {
      const detail = (event as CustomEvent<ToastPayload>).detail;
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const item: ToastItem = {
        id,
        tone: detail.tone ?? "info",
        title: detail.title,
        text: detail.text
      };

      setToasts((current) => [...current.slice(-3), item]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((toast) => toast.id !== id));
      }, 4200);
    }

    window.addEventListener(TOAST_EVENT_NAME, onToast);
    return () => window.removeEventListener(TOAST_EVENT_NAME, onToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <article className={`toast ${toast.tone}`} key={toast.id}>
          <span>{toast.tone === "success" ? <Check size={16} /> : toast.tone === "danger" ? <AlertTriangle size={16} /> : <Activity size={16} />}</span>
          <div>
            <strong>{toast.title}</strong>
            {toast.text && <small>{toast.text}</small>}
          </div>
          <button type="button" onClick={() => setToasts((current) => current.filter((item) => item.id !== toast.id))} aria-label="Meldung schließen">
            <X size={15} />
          </button>
        </article>
      ))}
    </div>
  );
}

function usePath() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const listener = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  return path;
}

const DEMO_GUILD_ID = "demo";
const DEMO_GUILD_PATH = `/dashboard/${DEMO_GUILD_ID}/overview`;
const DEMO_TEXT_CHANNEL_ID = "100000000000000001";
const DEMO_LOG_CHANNEL_ID = "100000000000000002";
const DEMO_VOICE_CHANNEL_ID = "100000000000000003";
const DEMO_CATEGORY_ID = "100000000000000004";
const DEMO_MEMBER_ROLE_ID = "200000000000000001";
const DEMO_TEAM_ROLE_ID = "200000000000000002";
const DEMO_USER_ID = "300000000000000001";

const DEMO_USER: User = {
  discordUserId: DEMO_USER_ID,
  username: "demo",
  displayName: "Demo-Modus",
  avatar: null,
  ownerAdmin: false
};

const DEMO_GUILD: GuildDetail = {
  id: DEMO_GUILD_ID,
  name: "Modmail Manager Demo",
  icon: null,
  botInstalled: true,
  botInstallStatus: "installed",
  permission: "Demo-Zugriff"
};

const DEMO_SETTINGS: SettingsRow = {
  locale: "de",
  timezone: "Europe/Berlin",
  bot_nickname: "Modmail Manager",
  bot_avatar_media_key: null,
  bot_avatar_sync_status: "synced",
  bot_avatar_sync_error: null
};

const DEMO_CHANNELS: ChannelOption[] = [
  { id: DEMO_TEXT_CHANNEL_ID, name: "willkommen", type: "text", categoryName: "Community", canSend: true },
  { id: DEMO_LOG_CHANNEL_ID, name: "modmail-logs", type: "text", categoryName: "Team", canSend: true },
  { id: "100000000000000005", name: "bot-befehle", type: "text", categoryName: "Community", canSend: true },
  { id: "100000000000000006", name: "tickets", type: "text", categoryName: "Support", canSend: true },
  { id: DEMO_VOICE_CHANNEL_ID, name: "TEMPVOICE ERSTELLEN", type: "voice", categoryName: "Voice", canSend: false },
  { id: "100000000000000007", name: "Allgemein", type: "voice", categoryName: "Voice", canSend: false },
  { id: DEMO_CATEGORY_ID, name: "Community", type: "category", categoryName: null, canSend: false }
];

const DEMO_ROLES: RoleOption[] = [
  { id: DEMO_TEAM_ROLE_ID, name: "Support Team", color: 0x68a8ff, managed: false, botCanManage: true },
  { id: DEMO_MEMBER_ROLE_ID, name: "Mitglied", color: 0x2fbf7a, managed: false, botCanManage: true },
  { id: "200000000000000003", name: "Level 10", color: 0xf4bd63, managed: false, botCanManage: true },
  { id: "200000000000000004", name: "Modmail Manager", color: 0x9b8cff, managed: true, botCanManage: false }
];

const DEMO_COMMANDS: CommandConfig[] = [
  {
    commandName: "help",
    description: "Zeigt die verfügbaren Befehle.",
    commandType: "slash",
    enabled: true,
    cooldownSeconds: 3,
    ephemeral: true,
    administratorOnly: false,
    moderatorOnly: false,
    allowedChannelIds: [],
    deniedChannelIds: [],
    allowedRoleIds: [],
    deniedRoleIds: []
  },
  {
    commandName: "ticket",
    description: "Öffnet und verwaltet Support-Tickets.",
    commandType: "slash",
    enabled: true,
    cooldownSeconds: 10,
    ephemeral: true,
    administratorOnly: false,
    moderatorOnly: false,
    allowedChannelIds: [DEMO_TEXT_CHANNEL_ID],
    deniedChannelIds: [],
    allowedRoleIds: [],
    deniedRoleIds: []
  },
  {
    commandName: "moderation",
    description: "Werkzeuge für das Moderationsteam.",
    commandType: "slash",
    enabled: true,
    cooldownSeconds: 2,
    ephemeral: true,
    administratorOnly: false,
    moderatorOnly: true,
    allowedChannelIds: [],
    deniedChannelIds: [],
    allowedRoleIds: [DEMO_TEAM_ROLE_ID],
    deniedRoleIds: []
  }
];

function demoLoggingSettings(): LoggingSettings {
  return {
    enabled: true,
    channelMappings: Object.fromEntries(
      LOG_CATEGORIES.map((category) => [category.key, category.key === "general" ? DEMO_TEXT_CHANNEL_ID : DEMO_LOG_CHANNEL_ID])
    ) as Record<LogCategory, string | null>,
    events: Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, true])) as Record<LogCategory, boolean>
  };
}

function demoFeatureValue(field: FeatureFieldDefinition): FeatureValue {
  const textValues: Record<string, string> = {
    panelTitle: "Community-Verwaltung",
    panelDescription: "Wähle die passende Option aus.",
    defaultDescription: "Klicke auf Teilnehmen, um beim Giveaway mitzumachen.",
    template: "[Member] {username}",
    timezone: "Europe/Berlin",
    message: "Alles Gute zum Geburtstag, {user}!",
    serverAddress: "play.example.net",
    verificationTitle: "Verifizierung",
    verificationText: "Bestätige unten, dass du die Regeln gelesen hast.",
    stickyMessage: "Bitte beachte die angepinnten Hinweise.",
    recurringMessage: "Zeit für das tägliche Community-Update.",
    scheduledMessage: "Heute Abend startet unser Community-Event.",
    scheduledAt: "2026-08-01T18:00:00+02:00",
    questions: "Wie alt bist du?\nWarum möchtest du ins Team?",
    emoji: "⭐",
    memberChannelName: "Mitglieder: {count}",
    botChannelName: "Bots: {count}",
    onlineChannelName: "Online: {count}"
  };
  const numberValues: Record<string, number> = {
    defaultWinnerCount: 1,
    defaultDurationMinutes: 1440,
    intervalMinutes: 60,
    warnExpireDays: 30,
    defaultTimeoutMinutes: 60,
    autoPunishmentThreshold: 3,
    accountAgeMinDays: 7,
    threshold: 5,
    updateMinutes: 10,
    defaultVolume: 50,
    maxQueueLength: 100,
    cooldownSeconds: 5,
    dailyReward: 250
  };

  if (field.type === "channel") return DEMO_TEXT_CHANNEL_ID;
  if (field.type === "category") return DEMO_CATEGORY_ID;
  if (field.type === "channels") return [DEMO_TEXT_CHANNEL_ID, DEMO_LOG_CHANNEL_ID];
  if (field.type === "role") return DEMO_MEMBER_ROLE_ID;
  if (field.type === "roles") return [DEMO_TEAM_ROLE_ID];
  if (field.type === "toggle") return true;
  if (field.type === "select") return field.options?.[0]?.value ?? null;
  if (field.type === "number") {
    const value = numberValues[field.key] ?? Math.max(field.min ?? 0, 1);
    return Math.min(field.max ?? value, Math.max(field.min ?? value, value));
  }
  return textValues[field.key] ?? field.placeholder ?? "Beispielwert";
}

function demoFeatureSettings(module: FeatureModule): FeatureSettings {
  const definition = FEATURE_DEFINITIONS.find((item) => item.module === module);
  const fields = Object.fromEntries((definition?.fields ?? []).map((field) => [field.key, demoFeatureValue(field)]));
  return {
    enabled: true,
    fields,
    syncStatus: "synced",
    syncError: null,
    updatedAt: "2026-07-24T10:30:00.000Z",
    configuredFields: Object.keys(fields).length,
    lastAppliedAt: "2026-07-24T10:30:00.000Z"
  };
}

function cloneDemoData<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function demoApiResponse(path: string, init: RequestInit): { handled: boolean; data: unknown } {
  const cleanPath = path.split("?")[0];
  const isDemoRoute = window.location.pathname.startsWith(`/dashboard/${DEMO_GUILD_ID}/`);
  if (cleanPath === "/api/me" && isDemoRoute) {
    return { handled: true, data: { user: DEMO_USER } };
  }

  const guildPrefix = `/api/guilds/${DEMO_GUILD_ID}`;
  if (!cleanPath.startsWith(guildPrefix)) {
    return { handled: false, data: null };
  }

  const method = (init.method ?? "GET").toUpperCase();
  const suffix = cleanPath.slice(guildPrefix.length);
  if (method !== "GET") {
    return { handled: true, data: { ok: true, demo: true } };
  }

  if (suffix === "") return { handled: true, data: { guild: DEMO_GUILD, settings: DEMO_SETTINGS } };
  if (suffix === "/channels") return { handled: true, data: { channels: DEMO_CHANNELS } };
  if (suffix === "/roles") return { handled: true, data: { roles: DEMO_ROLES } };
  if (suffix === "/commands") return { handled: true, data: { commands: DEMO_COMMANDS } };
  if (suffix === "/custom-commands") {
    return {
      handled: true,
      data: {
        customCommands: [
          {
            id: "demo-status",
            name: "status",
            description: "Zeigt den aktuellen Serverstatus.",
            responseContent: "Alle Systeme laufen stabil.",
            enabled: true,
            ephemeral: false,
            cooldownSeconds: 5,
            syncStatus: "synced",
            syncError: null
          }
        ]
      }
    };
  }
  if (suffix === "/audit-log") {
    return {
      handled: true,
      data: {
        auditLog: [
          { id: "demo-audit-1", action: "welcome.updated", target: "#willkommen", actorDiscordUserId: DEMO_USER_ID, createdAt: "2026-07-24T10:30:00.000Z" },
          { id: "demo-audit-2", action: "autorole.updated", target: "Mitglied", actorDiscordUserId: DEMO_USER_ID, createdAt: "2026-07-24T09:45:00.000Z" }
        ]
      }
    };
  }
  if (suffix === "/autorole") {
    return {
      handled: true,
      data: {
        autorole: {
          ...DEFAULT_AUTOROLE_DRAFT,
          enabled: true,
          humanRoleIds: [DEMO_MEMBER_ROLE_ID],
          botRoleIds: [],
          delaySeconds: 5,
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/level-system") {
    return {
      handled: true,
      data: {
        levelSystem: {
          ...DEFAULT_LEVEL_DRAFT,
          enabled: true,
          announcementChannelId: DEMO_TEXT_CHANNEL_ID,
          roleRewards: [{ level: 10, roleId: "200000000000000003" }],
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/counting") {
    return {
      handled: true,
      data: {
        counting: {
          ...DEFAULT_COUNTING_DRAFT,
          enabled: true,
          channelId: DEMO_TEXT_CHANNEL_ID,
          currentNumber: 248,
          recordNumber: 391,
          totalCounts: 3810,
          totalFailures: 27,
          lastUserId: "300000000000000002",
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/temp-voice") {
    return {
      handled: true,
      data: {
        tempVoice: {
          ...DEFAULT_TEMP_VOICE_DRAFT,
          enabled: true,
          creatorChannelIds: [DEMO_VOICE_CHANNEL_ID],
          categoryId: DEMO_CATEGORY_ID,
          interfaceChannelId: DEMO_TEXT_CHANNEL_ID,
          panelChannelId: DEMO_TEXT_CHANNEL_ID,
          defaultUserLimit: 5,
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/logging") return { handled: true, data: { logging: demoLoggingSettings() } };
  if (suffix === "/welcome") {
    return {
      handled: true,
      data: {
        welcome: {
          ...DEFAULT_WELCOME_DRAFT,
          enabled: true,
          channelId: DEMO_TEXT_CHANNEL_ID,
          autoRoleId: DEMO_MEMBER_ROLE_ID,
          embed: { ...DEFAULT_WELCOME_DRAFT.embed, imageMode: "none" }
        }
      }
    };
  }
  if (suffix === "/security") {
    return {
      handled: true,
      data: {
        security: {
          ...DEFAULT_SECURITY_DRAFT,
          antispamEnabled: true,
          antilinkEnabled: true,
          antiinviteEnabled: true,
          accountAgeMinDays: 7,
          quarantineRoleId: DEMO_MEMBER_ROLE_ID,
          auditLogWatchEnabled: true,
          healthScore: 88,
          activeProtections: 5,
          botCanManageRoles: true,
          botCanViewAuditLog: true,
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/raidmode") {
    return {
      handled: true,
      data: {
        raidmode: {
          ...DEFAULT_RAID_DRAFT,
          profile: "light",
          memberCount: 128,
          textChannelCount: 18,
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/tickets") {
    return {
      handled: true,
      data: {
        tickets: {
          ...DEFAULT_TICKET_DRAFT,
          enabled: true,
          ticketCategoryId: DEMO_CATEGORY_ID,
          panelChannelId: DEMO_TEXT_CHANNEL_ID,
          logChannelId: DEMO_LOG_CHANNEL_ID,
          supportRoleIds: [DEMO_TEAM_ROLE_ID],
          totalTickets: 184,
          openTickets: 6,
          closedTickets: 171,
          deletedTickets: 7,
          averageRating: 4.8,
          syncStatus: "synced"
        }
      }
    };
  }
  if (suffix === "/backups") {
    return {
      handled: true,
      data: {
        backups: {
          ...DEFAULT_BACKUP_DRAFT,
          items: [
            { scope: "roles", savedAt: "2026-07-24T08:00:00.000Z", itemCount: 24 },
            { scope: "channels", savedAt: "2026-07-24T08:00:00.000Z", itemCount: 31 },
            { scope: "full", savedAt: "2026-07-24T08:00:00.000Z", itemCount: 55 }
          ],
          lastSavedAt: "2026-07-24T08:00:00.000Z",
          guildRoleCount: 24,
          guildChannelCount: 31,
          syncStatus: "synced"
        }
      }
    };
  }

  const featureMatch = suffix.match(/^\/features\/([^/]+)$/);
  if (featureMatch && FEATURE_DEFINITIONS.some((item) => item.module === featureMatch[1])) {
    return { handled: true, data: { feature: demoFeatureSettings(featureMatch[1] as FeatureModule) } };
  }

  return { handled: true, data: { ok: true, demo: true } };
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const demoResponse = demoApiResponse(path, init);
  if (demoResponse.handled) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return cloneDemoData(demoResponse.data) as T;
  }

  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const request = () => fetch(
    path,
    {
      credentials: "include",
      ...init,
      headers
    }
  );
  const readData = async (response: Response) => {
    const contentType = response.headers.get("Content-Type") ?? "";
    return contentType.includes("application/json")
      ? ((await response.json()) as ApiError & T)
      : null;
  };

  let response = await request();
  let data = await readData(response);
  if (response.status === 401 && data?.error?.code === "session_required") {
    await new Promise((resolve) => window.setTimeout(resolve, 150));
    response = await request();
    data = await readData(response);
  }

  if (response.status === 401 && data?.error?.code === "session_required") {
    const returnTo = safeClientReturnTo(window.location.pathname + window.location.search);
    navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    throw new Error("Bitte erneut anmelden.");
  }

  if (!response.ok) {
    throw new Error(data?.error?.message ?? "Die Anfrage ist fehlgeschlagen.");
  }

  return data as T;
}

function useApi<T>(path: string | null, deps: React.DependencyList = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  async function load() {
    if (!path) return;
    setLoading(true);
    setError(null);
    try {
      setData(await api<T>(path));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload: load };
}

function RefreshButton({
  loading,
  onClick,
  label = "Aktualisieren",
  loadingLabel = "Laden",
  className = ""
}: {
  loading: boolean;
  onClick: () => void | Promise<void>;
  label?: string;
  loadingLabel?: string;
  className?: string;
}) {
  return (
    <button
      className={`secondary-action inline refresh-button ${loading ? "is-loading" : ""} ${className}`.trim()}
      onClick={() => void onClick()}
      disabled={loading}
    >
      {loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}
      {loading ? loadingLabel : label}
    </button>
  );
}

function App() {
  const path = usePath();
  const cleanPath = path.split("?")[0];

  if (cleanPath === "/login" || cleanPath === "/") return <LoginPage />;
  if (cleanPath === "/dokumentation") return <DocumentationPage />;
  if (cleanPath === "/datenschutz") return <PrivacyPage />;
  if (cleanPath === "/nutzungsbedingungen") return <TermsPage />;
  if (cleanPath.startsWith("/admin/discordguilds/view/")) return <AdminGuildViewPage path={cleanPath} />;
  if (cleanPath === "/admin") return <AdminPageModern />;
  if (cleanPath === "/home" || cleanPath === "/panel") return <HomePage />;
  if (cleanPath.startsWith("/dashboard/")) return <Dashboard path={cleanPath} />;
  return <LoginPage />;
}

function LoginPage() {
  const searchParams = new URLSearchParams(window.location.search);
  const returnTo = safeClientReturnTo(searchParams.get("returnTo"));
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      try {
        const response = await fetch("/api/me", { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as { user: User };
        if (!cancelled) setSessionUser(data.user);
      } catch {
        if (!cancelled) setSessionUser(null);
      } finally {
        if (!cancelled) setCheckingSession(false);
      }
    }

    void checkSession();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="auth-page">
      <div className="grid-backdrop" aria-hidden="true" />
      <section className="auth-layout">
        <section className="auth-panel reveal-card">
          <div className="brand-row">
            <div className="brand-mark">
              <Bot size={28} />
            </div>
            <div className="brand-actions">
              <ThemeToggle compact />
              <span className="signal-pill">
                <Radio size={14} />
                Webpanel bereit
              </span>
            </div>
          </div>
          <div className="auth-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              Modmail Manager Control
            </p>
            <h1>Modmail Manager Webpanel</h1>
            <p>Server verwalten, Slash-Befehle steuern und das Bot-Profil pro Guild sauber synchronisieren.</p>
          </div>
          <div className="auth-action-stack">
            {checkingSession ? (
              <button className="primary-action full hero-action" disabled>
                <Loader2 className="spin" size={18} />
                Anmeldung prüfen
              </button>
            ) : sessionUser ? (
              <button className="primary-action full hero-action" onClick={() => navigate(returnTo)}>
                <LayoutDashboard size={18} />
                Zu deinem Dashboard
                <ArrowRight size={18} />
              </button>
            ) : (
              <a className="primary-action full hero-action" href={`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`}>
                <KeyRound size={18} />
                Mit Discord anmelden
                <ArrowRight size={18} />
              </a>
            )}
            <button className="secondary-action full hero-action demo-entry-action" type="button" onClick={() => navigate(DEMO_GUILD_PATH)}>
              <Eye size={18} />
              Guild-Panel als Demo ansehen
              <ArrowRight size={18} />
            </button>
          </div>
          <div className="auth-status-strip" aria-label="Systemstatus">
            <span>
              <BadgeCheck size={15} />
              OAuth aktiv
            </span>
            <span>
              <Shield size={15} />
              Guild isoliert
            </span>
          </div>
        </section>
        <AuthShowcase />
      </section>
    </main>
  );
}

function AuthShowcase() {
  const rows = [
    { icon: <Command size={16} />, label: "Slash Sync", value: "bereit" },
    { icon: <Database size={16} />, label: "Guild Settings", value: "gesichert" },
    { icon: <Cpu size={16} />, label: "Bot Worker", value: "online" }
  ];

  return (
    <section className="auth-showcase reveal-card delay-1" aria-label="Bot Status">
      <div className="showcase-top">
        <span className="window-dot" />
        <span className="window-dot amber" />
        <span className="window-dot green" />
        <strong>Live Console</strong>
      </div>
      <div className="bot-radar" aria-hidden="true">
        <Bot size={34} />
        <span />
        <span />
      </div>
      <div className="activity-stack">
        {rows.map((row, index) => (
          <div className="activity-row" style={{ "--delay": `${index * 120}ms` } as React.CSSProperties} key={row.label}>
            <span className="activity-icon">{row.icon}</span>
            <span>{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function TopNav({ user, demoMode = false }: { user?: User | null; demoMode?: boolean }) {
  const path = usePath();
  const cleanPath = path.split("?")[0];
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fallbackUser, setFallbackUser] = useState<User | null>(null);
  const navUser = user === undefined ? fallbackUser : user;

  useEffect(() => {
    setMobileOpen(false);
  }, [cleanPath]);

  useEffect(() => {
    if (user !== undefined) return;
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/me", { credentials: "include" });
        if (!response.ok) return;
        const data = (await response.json()) as { user: User };
        if (!cancelled) setFallbackUser(data.user);
      } catch {
        if (!cancelled) setFallbackUser(null);
      }
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const navItems: NavItem[] = [
    { key: "panel", label: demoMode ? "Demo" : "Panel", path: demoMode ? DEMO_GUILD_PATH : "/panel", icon: demoMode ? <Eye size={17} /> : <Home size={17} />, active: cleanPath === "/panel" || cleanPath === "/home" || cleanPath.startsWith("/dashboard/") },
    ...(navUser?.ownerAdmin ? [{ key: "admin", label: "Admin", path: "/admin", icon: <Gauge size={17} />, active: cleanPath === "/admin" || cleanPath.startsWith("/admin/") }] : []),
    { key: "docs", label: "Dokumentation", path: "/dokumentation", icon: <ClipboardList size={17} />, active: cleanPath === "/dokumentation" },
    { key: "privacy", label: "Datenschutz", path: "/datenschutz", icon: <ShieldCheck size={17} />, active: cleanPath === "/datenschutz" },
    { key: "terms", label: "Nutzungsbedingungen", path: "/nutzungsbedingungen", icon: <ClipboardList size={17} />, active: cleanPath === "/nutzungsbedingungen" },
    { key: "support", label: "Support", href: "https://discord.com/developers/docs/intro", icon: <LifeBuoy size={17} />, active: false }
  ];

  const renderNavItem = (item: NavItem, mobile = false) => {
    const className = `${mobile ? "mobile-nav-link" : "top-link"} ${item.active ? "active" : ""}`.trim();
    if (item.href) {
      return (
        <a key={item.key} className={className} href={item.href} target="_blank" rel="noreferrer">
          {item.icon}
          {item.label}
        </a>
      );
    }

    return (
      <button key={item.key} className={className} type="button" onClick={() => item.path && navigate(item.path)}>
        {item.icon}
        {item.label}
      </button>
    );
  };

  return (
    <>
      <header className="top-nav">
        <button className="brand-link" onClick={() => navigate(demoMode ? "/" : "/panel")}>
          <Bot size={22} />
          <span>Modmail Manager</span>
        </button>
        <nav className="top-links">{navItems.map((item) => renderNavItem(item))}</nav>
        <button className={`mobile-nav-toggle ${mobileOpen ? "active" : ""}`} type="button" onClick={() => setMobileOpen((value) => !value)} aria-label="Navigation öffnen">
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <span className="nav-status">
          {demoMode ? <Eye size={14} /> : <Activity size={14} />}
          {demoMode ? "Vorschau" : "Live"}
        </span>
        <ThemeToggle compact />
        {demoMode ? (
          <div className="user-chip demo-user-chip">
            <Eye size={18} />
            <span>Demo-Modus</span>
          </div>
        ) : navUser && (
          <div className="user-chip">
            {navUser.avatar ? <img src={navUser.avatar} alt="" /> : <UserRound size={18} />}
            <span>{navUser.displayName || navUser.username}</span>
            <a className="icon-button" href="/logout" title="Abmelden">
              <LogOut size={17} />
            </a>
          </div>
        )}
        <nav className={`mobile-nav-menu ${mobileOpen ? "open" : ""}`}>{navItems.map((item) => renderNavItem(item, true))}</nav>
      </header>
      <ToastHost />
    </>
  );
}

function DocumentationPage() {
  const docHighlights = [
    { icon: <Server size={18} />, title: "Server auswählen", text: "Alle verwaltbaren Discord-Server erscheinen gesammelt im Panel." },
    { icon: <Bot size={18} />, title: "Bot prüfen", text: "Du siehst sofort, ob der Bot installiert ist oder noch eingeladen werden muss." },
    { icon: <Command size={18} />, title: "Befehle steuern", text: "Slash-Befehle und Custom Commands lassen sich pro Server vorbereiten und verwalten." },
    { icon: <Shield size={18} />, title: "Sicher getrennt", text: "Jede Guild bleibt sauber isoliert, damit Einstellungen nicht auf andere Server rutschen." }
  ];
  const docSections = [
    {
      eyebrow: "Start",
      title: "Panel öffnen",
      text: "Melde dich mit Discord an und wähle danach den Server aus, den du verwalten möchtest. Server ohne Bot werden grau angezeigt und haben einen roten Einladen-Button."
    },
    {
      eyebrow: "Verwaltung",
      title: "Bot-Profil bearbeiten",
      text: "Im Bot-Profil kannst du den serverbezogenen Namen und später weitere sichtbare Bot-Details einstellen. Änderungen werden direkt der aktuellen Guild zugeordnet."
    },
    {
      eyebrow: "Commands",
      title: "Befehle organisieren",
      text: "Slash-Befehle und Custom Commands sind im Panel getrennt. So bleibt klar, welche Funktionen vom Bot kommen und welche Antworten du selbst anlegst."
    },
    {
      eyebrow: "Protokoll",
      title: "Audit-Log prüfen",
      text: "Wichtige Aktionen werden nachvollziehbar gesammelt, damit du später sehen kannst, was am Server-Panel geändert wurde."
    }
  ];

  return (
    <div className="app-shell">
      <TopNav />
      <main className="docs-page">
        <section className="docs-hero">
          <div className="docs-hero-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              Modmail Manager Hilfe
            </p>
            <h1>Dokumentation</h1>
            <p>Eine kurze, saubere Übersicht für das Webpanel: anmelden, Server wählen, Bot einladen und die wichtigsten Bereiche verstehen.</p>
            <div className="docs-actions">
              <button className="primary-action" onClick={() => navigate("/panel")}>
                <LayoutDashboard size={17} />
                Zum Panel
              </button>
              <button className="secondary-action" onClick={() => navigate("/login?returnTo=%2Fpanel")}>
                <KeyRound size={17} />
                Anmelden
              </button>
            </div>
          </div>
          <div className="docs-status-board" aria-label="Dokumentationsübersicht">
            <div className="docs-status-top">
              <span />
              <strong>Webpanel Guide</strong>
              <BadgeCheck size={18} />
            </div>
            <div className="docs-status-list">
              <div>
                <span>01</span>
                <strong>Discord Login</strong>
                <small>Account verbinden</small>
              </div>
              <div>
                <span>02</span>
                <strong>Guild wählen</strong>
                <small>Server öffnen</small>
              </div>
              <div>
                <span>03</span>
                <strong>Bot verwalten</strong>
                <small>Funktionen steuern</small>
              </div>
            </div>
          </div>
        </section>

        <section className="docs-highlight-grid">
          {docHighlights.map((item) => (
            <article className="docs-highlight" key={item.title}>
              <span>{item.icon}</span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="docs-manual">
          <div className="docs-manual-heading">
            <p className="eyebrow">
              <ClipboardList size={15} />
              Bedienung
            </p>
            <h2>So nutzt du das Panel</h2>
          </div>
          <div className="docs-steps">
            {docSections.map((item, index) => (
              <article className="docs-step" key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.eyebrow}</small>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function PrivacyPage() {
  const privacyHighlights = [
    {
      icon: <KeyRound size={18} />,
      title: "Discord Login",
      text: "Die Anmeldung läuft über Discord OAuth mit den Bereichen identify und guilds. Dadurch erkennt das Panel deinen Account und die Server, die du verwalten darfst."
    },
    {
      icon: <UserRound size={18} />,
      title: "Account-Daten",
      text: "Gespeichert werden Discord-ID, Nutzername, Anzeigename, Avatar und der letzte Login-Zeitpunkt, damit Sessions und Audit-Logs zugeordnet werden können."
    },
    {
      icon: <Server size={18} />,
      title: "Server-Daten",
      text: "Das Panel speichert Server-ID, Servername, Icon und Bot-Status. So kann angezeigt werden, ob Modmail Manager bereits installiert ist."
    },
    {
      icon: <Database size={18} />,
      title: "Panel-Einstellungen",
      text: "Gespeichert werden nur Einstellungen, die du im Panel nutzt: Sprache, Zeitzone, Bot-Profil, Commands, Custom Commands und technische Sync-Statuswerte."
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Geschützte Sitzungen",
      text: "Discord-Tokens und Session-Daten werden serverseitig gespeichert und verschlüsselt. Im Browser wird kein Klartext-Token angezeigt."
    },
    {
      icon: <ClipboardList size={18} />,
      title: "Audit-Log",
      text: "Änderungen im Panel werden protokolliert, damit nachvollziehbar bleibt, wer Einstellungen, Commands oder Bot-Profil-Daten verändert hat."
    },
    {
      icon: <Activity size={18} />,
      title: "Bot-Synchronisierung",
      text: "Der Bot kann Rollen, Kanäle, Command-Status und Sync-Aufgaben ans Panel melden, damit die Oberfläche aktuell bleibt."
    },
    {
      icon: <Shield size={18} />,
      title: "Keine Werbung",
      text: "Das Webpanel nutzt keine Werbefunktionen und erstellt keine Marketingprofile. Cookies werden für Login, OAuth-State und Session benötigt."
    }
  ];
  const privacySections = [
    {
      eyebrow: "Anmeldung",
      title: "Welche Discord-Daten genutzt werden",
      text: "Beim Login fragt Modmail Manager bei Discord deine Basisdaten ab: Discord-ID, Nutzername, Anzeigename und Avatar. Außerdem wird die Liste deiner Server geladen, damit das Panel nur Guilds zeigt, auf denen du Owner, Administrator oder eine passende Verwaltungsberechtigung bist."
    },
    {
      eyebrow: "Sessions",
      title: "Warum eine Sitzung gespeichert wird",
      text: "Nach dem Login wird eine Session erstellt, damit du nicht bei jedem Seitenaufruf neu zu Discord geschickt wirst. Die Session enthält eine interne Session-ID, ein Ablaufdatum und verschlüsselte Discord-Token-Daten. Abgelaufene Sessions werden automatisch bereinigt."
    },
    {
      eyebrow: "Server",
      title: "Was pro Discord-Server gespeichert wird",
      text: "Für jede verwaltbare Guild speichert das Panel die Discord-Server-ID, den Namen, das Icon und Zeitpunkte wie Bot installiert, Bot entfernt oder zuletzt gesehen. Diese Daten werden genutzt, um die Serverliste und den Installationsstatus korrekt anzuzeigen."
    },
    {
      eyebrow: "Einstellungen",
      title: "Welche Panel-Einstellungen gespeichert werden",
      text: "Gespeichert werden Sprache, Zeitzone, Bot-Nickname, Avatar-Sync-Status, Command-Einstellungen, Cooldowns, Rollen- und Kanalbeschränkungen sowie Custom-Command-Texte. Diese Daten sind nötig, damit Modmail Manager pro Server unterschiedlich konfiguriert werden kann."
    },
    {
      eyebrow: "Rollen & Kanäle",
      title: "Warum Rollen und Kanäle auftauchen können",
      text: "Der laufende Bot kann eine Momentaufnahme von Kanälen und Rollen an das Webpanel senden. Dadurch kann das Panel später Auswahlfelder, Berechtigungen und Command-Regeln passend zu deinem Server anzeigen."
    },
    {
      eyebrow: "Medien",
      title: "Was bei Avatar-Uploads gespeichert wird",
      text: "Wenn du einen serverbezogenen Bot-Avatar hochlädst, werden Dateityp, Dateigröße, Speicher-Key, Guild-Zuordnung und die Discord-ID des hochladenden Nutzers gespeichert. Die Datei selbst wird als geschütztes Guild-Medium abgelegt."
    },
    {
      eyebrow: "Audit-Log",
      title: "Welche Änderungen protokolliert werden",
      text: "Bei wichtigen Aktionen speichert das Panel Aktion, Ziel, Zeitpunkt, ausführende Discord-ID und alte beziehungsweise neue Werte. Das hilft, Änderungen im Team später nachvollziehen zu können."
    },
    {
      eyebrow: "Sync",
      title: "Welche technischen Sync-Daten entstehen",
      text: "Für Aufgaben zwischen Webpanel und Bot werden Sync-Events gespeichert. Dazu gehören Status, Anzahl der Versuche, Fehlermeldungen und technische Nutzdaten. Erfolgreich abgeschlossene Sync-Events werden nach einiger Zeit bereinigt."
    },
    {
      eyebrow: "Kontrolle",
      title: "Abmelden und Zugriff begrenzen",
      text: "Du kannst dich jederzeit abmelden. Dabei wird deine aktive Session gelöscht. Das Panel zeigt nur Server an, für die dein Discord-Account ausreichende Rechte besitzt, und trennt Einstellungen strikt pro Guild."
    },
    {
      eyebrow: "Nicht genutzt",
      title: "Was nicht für Werbung genutzt wird",
      text: "Das Panel ist ein Verwaltungswerkzeug. Es gibt keine Werbeanzeigen, keine Marketingprofile und keine Funktion, die deine Panel-Daten an Werbenetzwerke weitergibt. Notwendige Cookies dienen nur Login, OAuth-Sicherheit und Session-Verwaltung."
    }
  ];

  return (
    <div className="app-shell">
      <TopNav />
      <main className="docs-page">
        <section className="docs-hero">
          <div className="docs-hero-copy">
            <p className="eyebrow">
              <ShieldCheck size={15} />
              Modmail Manager Datenschutz
            </p>
            <h1>Datenschutz</h1>
            <p>Eine klare Übersicht, welche Daten das Webpanel braucht, warum sie verwendet werden und wie der Zugriff auf deine Discord-Server begrenzt wird.</p>
            <div className="docs-actions">
              <button className="primary-action" onClick={() => navigate("/panel")}>
                <LayoutDashboard size={17} />
                Zum Panel
              </button>
              <button className="secondary-action" onClick={() => navigate("/dokumentation")}>
                <ClipboardList size={17} />
                Dokumentation
              </button>
            </div>
          </div>
          <div className="docs-status-board" aria-label="Datenschutzübersicht">
            <div className="docs-status-top">
              <span />
              <strong>Privacy Check</strong>
              <ShieldCheck size={18} />
            </div>
            <div className="docs-status-list">
              <div>
                <span>01</span>
                <strong>OAuth Login</strong>
                <small>Discord bestätigt dich</small>
              </div>
              <div>
                <span>02</span>
                <strong>Guild Rechte</strong>
                <small>Nur verwaltbare Server</small>
              </div>
              <div>
                <span>03</span>
                <strong>Panel Daten</strong>
                <small>Nur für Bot-Verwaltung</small>
              </div>
            </div>
          </div>
        </section>

        <section className="docs-highlight-grid">
          {privacyHighlights.map((item) => (
            <article className="docs-highlight" key={item.title}>
              <span>{item.icon}</span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="docs-manual">
          <div className="docs-manual-heading">
            <p className="eyebrow">
              <ShieldCheck size={15} />
              Übersicht
            </p>
            <h2>Was im Panel passiert</h2>
          </div>
          <div className="docs-steps">
            {privacySections.map((item, index) => (
              <article className="docs-step" key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.eyebrow}</small>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function TermsPage() {
  const termsHighlights = [
    {
      icon: <BadgeCheck size={18} />,
      title: "Bot & Webpanel",
      text: "Die Nutzungsbedingungen gelten für Modmail Manager, das Webpanel und alle Funktionen, die darüber auf Discord-Servern gesteuert werden."
    },
    {
      icon: <ShieldCheck size={18} />,
      title: "Discord-Regeln",
      text: "Die Nutzung muss zusätzlich zu diesen Bedingungen den Discord-Nutzungsbedingungen, Community Guidelines und Developer Policies entsprechen."
    },
    {
      icon: <UserRound size={18} />,
      title: "Berechtigte Nutzung",
      text: "Du darfst nur Server verwalten, auf denen du dazu berechtigt bist. Aktionen im Panel werden deinem Discord-Account zugeordnet."
    },
    {
      icon: <Settings size={18} />,
      title: "Server-Konfiguration",
      text: "Änderungen an Rollen, Kanälen, Commands, Invites, Logging oder Bot-Status wirken auf den ausgewählten Discord-Server."
    },
    {
      icon: <AlertTriangle size={18} />,
      title: "Verbotene Nutzung",
      text: "Missbrauch, Spam, Umgehung von Discord-Regeln, Rechteausnutzung und störende Automatisierung sind nicht erlaubt."
    },
    {
      icon: <Database size={18} />,
      title: "Daten & Logs",
      text: "Technische Daten, Sync-Events und Audit-Logs werden verarbeitet, damit Bot-Funktionen nachvollziehbar und sicher bleiben."
    },
    {
      icon: <LifeBuoy size={18} />,
      title: "Support",
      text: "Support kann helfen, garantiert aber keine ununterbrochene Verfügbarkeit oder fehlerfreie Funktion aller Discord-Features."
    },
    {
      icon: <Clock3 size={18} />,
      title: "Änderungen",
      text: "Diese Bedingungen können angepasst werden, wenn neue Funktionen, rechtliche Vorgaben oder Discord-Änderungen es nötig machen."
    }
  ];

  const termsSections = [
    {
      eyebrow: "Geltungsbereich",
      title: "Wofür diese Nutzungsbedingungen gelten",
      text: "Diese Nutzungsbedingungen gelten für die Nutzung von Modmail Manager, dem dazugehörigen Webpanel, den Discord-Bot-Funktionen, Slash-Commands, Owner-Funktionen, Server-Einstellungen, Musikfunktionen, Logging, Invites und allen weiteren Funktionen, die über den Bot oder das Panel bereitgestellt werden."
    },
    {
      eyebrow: "Discord",
      title: "Discord-Regeln bleiben verbindlich",
      text: "Modmail Manager ist eine Anwendung für Discord. Deshalb gelten zusätzlich die Nutzungsbedingungen, Community Guidelines und Developer-Regeln von Discord. Du darfst Modmail Manager nicht nutzen, um Discord-Regeln zu umgehen, Spam zu erzeugen, Nutzer zu belästigen, Rechte zu missbrauchen oder unzulässige Inhalte zu verbreiten."
    },
    {
      eyebrow: "Zugriff",
      title: "Wer das Webpanel nutzen darf",
      text: "Das Webpanel darf nur von Personen genutzt werden, die über ihren Discord-Account ausreichende Rechte für den jeweiligen Server besitzen. Das Panel prüft Serverrechte und zeigt nur verwaltbare Guilds an. Du bist dafür verantwortlich, dass du Aktionen nur auf Servern ausführst, für die du berechtigt bist."
    },
    {
      eyebrow: "Account",
      title: "Deine Verantwortung beim Login",
      text: "Du musst deinen Discord-Account schützen und darfst keinen fremden Account verwenden. Aktionen im Panel können im Audit-Log mit deiner Discord-ID protokolliert werden. Wenn du den Verdacht hast, dass dein Account oder deine Session missbraucht wurde, solltest du dich abmelden und deine Discord-Sicherheit prüfen."
    },
    {
      eyebrow: "Konfiguration",
      title: "Auswirkungen von Panel-Aktionen",
      text: "Änderungen im Webpanel können echte Änderungen auf deinem Discord-Server auslösen, zum Beispiel Bot-Nickname, Rollen, Kanalauswahl, Invite-Links, Logging-Ziele, Module, Bot-Präsenz oder Sync-Aufgaben. Prüfe vor dem Speichern, ob du den richtigen Server und die richtige Funktion ausgewählt hast."
    },
    {
      eyebrow: "Owner",
      title: "Besondere Owner-Funktionen",
      text: "Owner-Funktionen wie Runtime-Aktionen, Pterodactyl-Steuerung, Lavalink-Reconnect, Musik-Trennung, Config-Export oder Restart-Anfragen sind besonders sensibel. Sie dürfen nur für Wartung, Verwaltung und Fehlerbehebung genutzt werden. Falsche Nutzung kann den Bot-Betrieb unterbrechen."
    },
    {
      eyebrow: "Inhalte",
      title: "Verantwortung für Serverinhalte",
      text: "Du bist für Inhalte verantwortlich, die du über Bot-Funktionen, Custom Commands, Welcome-Texte, Logging-Nachrichten, Embed-Texte, Musikabfragen oder andere Konfigurationen einträgst. Inhalte dürfen nicht rechtswidrig, beleidigend, belästigend, irreführend, schädlich oder gegen Discord-Regeln verstoßend sein."
    },
    {
      eyebrow: "Missbrauch",
      title: "Was nicht erlaubt ist",
      text: "Nicht erlaubt sind Spam, Raid-Unterstützung, Doxxing, Belästigung, Phishing, Malware, Token-Leaks, Umgehung von Berechtigungen, absichtliche Überlastung, Manipulation von Logs, unbefugter Zugriff, Missbrauch von Invite-Funktionen und jede Nutzung, die anderen Nutzern, Servern, Discord oder dem Bot-Betrieb schadet."
    },
    {
      eyebrow: "Verfügbarkeit",
      title: "Keine Garantie für durchgehenden Betrieb",
      text: "Modmail Manager und das Webpanel können durch Updates, Wartung, Discord-API-Änderungen, Hosting-Probleme, Lavalink-Probleme, Rate Limits, Netzwerkfehler oder Konfigurationsfehler zeitweise eingeschränkt sein. Eine dauerhafte, fehlerfreie oder unterbrechungsfreie Verfügbarkeit wird nicht garantiert."
    },
    {
      eyebrow: "Daten",
      title: "Zusammenhang mit dem Datenschutz",
      text: "Für Login, Sessions, Guild-Verwaltung, Audit-Logs, Sync-Events, Bot-Snapshots und Einstellungen werden technische Daten verarbeitet. Details dazu findest du in der Datenschutzerklärung. Die Nutzungsbedingungen und die Datenschutzerklärung gehören inhaltlich zusammen."
    },
    {
      eyebrow: "Sicherheit",
      title: "Sicherer Umgang mit Tokens und Secrets",
      text: "Bot-Tokens, API-Keys, Lavalink-Passwörter, Pterodactyl-Keys, Session-Secrets und interne API-Secrets dürfen nicht öffentlich geteilt werden. Wer solche Secrets einsehen oder verwalten kann, muss sie vertraulich behandeln und bei Verdacht auf Offenlegung sofort austauschen."
    },
    {
      eyebrow: "Folgen",
      title: "Was bei Regelverstößen passieren kann",
      text: "Bei Missbrauch oder Sicherheitsrisiken kann der Zugriff auf das Webpanel eingeschränkt, eine Session beendet, eine Funktion deaktiviert oder eine Konfiguration zurückgesetzt werden. Auf Discord können zusätzlich Maßnahmen nach den Regeln des jeweiligen Servers oder von Discord selbst greifen."
    },
    {
      eyebrow: "Änderungen",
      title: "Aktualisierung dieser Bedingungen",
      text: "Diese Nutzungsbedingungen können angepasst werden, wenn neue Bot-Funktionen hinzukommen, technische Abläufe geändert werden, Sicherheitsgründe bestehen oder Discord seine Regeln beziehungsweise Schnittstellen ändert. Maßgeblich ist die jeweils im Webpanel angezeigte Fassung."
    },
    {
      eyebrow: "Stand",
      title: "Aktuelle Fassung",
      text: "Stand dieser Nutzungsbedingungen: 18. Juli 2026. Diese Seite beschreibt die Nutzung von Modmail Manager und dem Webpanel verständlich für Nutzer und Serververwalter."
    }
  ];

  return (
    <div className="app-shell">
      <TopNav />
      <main className="docs-page">
        <section className="docs-hero">
          <div className="docs-hero-copy">
            <p className="eyebrow">
              <ClipboardList size={15} />
              Modmail Manager Regeln
            </p>
            <h1>Nutzungsbedingungen</h1>
            <p>Klare Regeln für die Nutzung von Modmail Manager, dem Webpanel, Discord-Serverfunktionen, Owner-Aktionen und technischen Sync-Funktionen.</p>
            <div className="docs-actions">
              <button className="primary-action" onClick={() => navigate("/panel")}>
                <LayoutDashboard size={17} />
                Zum Panel
              </button>
              <button className="secondary-action" onClick={() => navigate("/datenschutz")}>
                <ShieldCheck size={17} />
                Datenschutz
              </button>
            </div>
          </div>
          <div className="docs-status-board" aria-label="Nutzungsbedingungen Übersicht">
            <div className="docs-status-top">
              <span />
              <strong>Terms Check</strong>
              <BadgeCheck size={18} />
            </div>
            <div className="docs-status-list">
              <div>
                <span>01</span>
                <strong>Discord Regeln</strong>
                <small>Bleiben verbindlich</small>
              </div>
              <div>
                <span>02</span>
                <strong>Serverrechte</strong>
                <small>Nur berechtigte Nutzung</small>
              </div>
              <div>
                <span>03</span>
                <strong>Owner-Aktionen</strong>
                <small>Sorgfältig verwenden</small>
              </div>
            </div>
          </div>
        </section>

        <section className="docs-highlight-grid">
          {termsHighlights.map((item) => (
            <article className="docs-highlight" key={item.title}>
              <span>{item.icon}</span>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
            </article>
          ))}
        </section>

        <section className="docs-manual">
          <div className="docs-manual-heading">
            <p className="eyebrow">
              <ClipboardList size={15} />
              Vereinbarung
            </p>
            <h2>Regeln für die Nutzung</h2>
          </div>
          <div className="docs-steps">
            {termsSections.map((item, index) => (
              <article className="docs-step" key={item.title}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <small>{item.eyebrow}</small>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function HomePage() {
  const me = useApi<{ user: User }>("/api/me", []);
  const guilds = useApi<{ guilds: GuildListItem[] }>("/api/guilds", []);
  const guildList = guilds.data?.guilds ?? [];
  const [guildSearch, setGuildSearch] = useState("");
  const [guildFilter, setGuildFilter] = useState<HomeGuildFilter>("all");
  const [favoriteGuilds, setFavoriteGuilds] = useState<string[]>(() => readFavoriteGuilds());
  const favoriteGuildSet = useMemo(() => new Set(favoriteGuilds), [favoriteGuilds]);
  const installedCount = guildList.filter((guild) => guild.botInstalled || guild.botInstallStatus === "installed").length;
  const missingCount = Math.max(guildList.length - installedCount, 0);
  const filteredGuilds = useMemo(() => {
    const needle = guildSearch.trim().toLowerCase();
    return guildList
      .filter((guild) => {
        const installed = guild.botInstalled || guild.botInstallStatus === "installed";
        const favorite = favoriteGuildSet.has(guild.id);
        if (guildFilter === "installed" && !installed) return false;
        if (guildFilter === "missing" && installed) return false;
        if (guildFilter === "favorites" && !favorite) return false;
        if (!needle) return true;
        return guild.name.toLowerCase().includes(needle) || guild.id.includes(needle) || guild.permission.toLowerCase().includes(needle);
      })
      .sort((left, right) => {
        const leftFavorite = favoriteGuildSet.has(left.id) ? 1 : 0;
        const rightFavorite = favoriteGuildSet.has(right.id) ? 1 : 0;
        if (leftFavorite !== rightFavorite) return rightFavorite - leftFavorite;
        const leftInstalled = left.botInstalled || left.botInstallStatus === "installed" ? 1 : 0;
        const rightInstalled = right.botInstalled || right.botInstallStatus === "installed" ? 1 : 0;
        if (leftInstalled !== rightInstalled) return rightInstalled - leftInstalled;
        return left.name.localeCompare(right.name, "de");
      });
  }, [favoriteGuildSet, guildFilter, guildList, guildSearch]);

  function toggleFavoriteGuild(guild: GuildListItem) {
    setFavoriteGuilds((current) => {
      const exists = current.includes(guild.id);
      const next = exists ? current.filter((id) => id !== guild.id) : [...current, guild.id];
      saveFavoriteGuilds(next);
      notify({
        tone: exists ? "info" : "success",
        title: exists ? "Favorit entfernt" : "Favorit gespeichert",
        text: guild.name
      });
      return next;
    });
  }

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} />
      <main className="content narrow">
        <section className="home-hero reveal-card">
          <div>
            <p className="eyebrow">
              <LayoutDashboard size={15} />
              Dashboard
            </p>
            <h1>Wähle deinen Server</h1>
            <p>Alle verwaltbaren Discord-Server an einem Ort, mit direktem Zugriff auf Bot-Profil, Commands und Audit-Log.</p>
          </div>
          <div className="metric-strip">
            <MetricCard icon={<Server size={18} />} label="Server" value={guildList.length.toString()} />
            <MetricCard icon={<BadgeCheck size={18} />} label="Installiert" value={installedCount.toString()} tone="ok" />
            <MetricCard icon={<Rocket size={18} />} label="Einladen" value={missingCount.toString()} tone="warn" />
          </div>
        </section>

        <div className="page-heading compact-heading">
          <div>
            <h2>Serverliste</h2>
            <p>{filteredGuilds.length} von {guildList.length} Guilds sichtbar. Favoriten bleiben automatisch oben.</p>
          </div>
          <RefreshButton loading={guilds.loading} onClick={guilds.reload} />
        </div>

        <section className="home-tools" aria-label="Serverliste filtern">
          <label className="home-search">
            <Search size={16} />
            <input value={guildSearch} onChange={(event) => setGuildSearch(event.target.value)} placeholder="Servername, ID oder Recht suchen" aria-label="Server suchen" />
          </label>
          <div className="home-filter-tabs">
            {([
              ["all", "Alle", guildList.length],
              ["installed", "Installiert", installedCount],
              ["missing", "Einladen", missingCount],
              ["favorites", "Favoriten", favoriteGuilds.length]
            ] as const).map(([value, label, count]) => (
              <button key={value} type="button" className={guildFilter === value ? "active" : ""} onClick={() => setGuildFilter(value as HomeGuildFilter)}>
                {value === "favorites" ? <Star size={14} /> : <ListFilter size={14} />}
                {label}
                <span>{count}</span>
              </button>
            ))}
          </div>
        </section>

        {guilds.loading && !guilds.data && <LoadingBlock text="Server werden geladen" detail="Deine verwaltbaren Guilds werden neu abgefragt." />}
        {!guilds.loading && guilds.error && <Notice tone="danger" text={guilds.error} />}
        {!guilds.loading && guilds.data?.guilds.length === 0 && (
          <EmptyState title="Keine verwaltbaren Server" text="Discord hat für diesen Account keine passende Guild geliefert." />
        )}
        {!guilds.loading && guilds.data && guilds.data.guilds.length > 0 && filteredGuilds.length === 0 && (
          <EmptyState title="Keine Treffer" text="Passe Suche oder Filter an, dann erscheinen die passenden Server wieder." />
        )}

        {!guilds.loading && guilds.data && filteredGuilds.length > 0 && (
          <section className="guild-grid">
            {filteredGuilds.map((guild, index) => {
              const installed = guild.botInstalled || guild.botInstallStatus === "installed";
              const favorite = favoriteGuildSet.has(guild.id);
              return (
                <article
                  className={`guild-card ${installed ? "installed" : guild.botInstallStatus === "unknown" ? "unknown" : "missing"} ${favorite ? "favorite" : ""} reveal-card`}
                  style={{ "--delay": `${index * 65}ms` } as React.CSSProperties}
                  key={guild.id}
                >
                  <div className="guild-card-top">
                    <GuildIcon guild={guild} />
                    <span
                      className={
                        guild.botInstallStatus === "unknown"
                          ? "status-light unknown"
                          : installed
                            ? "status-light ok"
                            : "status-light missing"
                      }
                    />
                  </div>

                  <div className="guild-card-body">
                    <div className="guild-card-title-row">
                      <h2 title={guild.name}>{guild.name}</h2>
                      <div className="guild-card-actions" aria-label="Serveraktionen">
                        <button
                          type="button"
                          className={`guild-icon-action guild-favorite-button ${favorite ? "active" : ""}`}
                          onClick={() => toggleFavoriteGuild(guild)}
                          title={favorite ? "Favorit entfernen" : "Als Favorit markieren"}
                          aria-label={favorite ? `${guild.name} aus Favoriten entfernen` : `${guild.name} als Favorit markieren`}
                        >
                          <Star size={16} fill={favorite ? "currentColor" : "none"} />
                        </button>
                      </div>
                    </div>
                    <p>{guild.id}</p>
                    <div className="status-row">
                      <span className="pill">{guild.permission}</span>
                      <span
                        className={
                          installed
                            ? "pill ok"
                            : guild.botInstallStatus === "unknown"
                              ? "pill neutral"
                              : "pill missing"
                        }
                      >
                        {guild.botInstalled || guild.botInstallStatus === "installed" ? "Bot installiert" : guild.botInstallStatus === "unknown" ? "Status prüfen" : "Bot fehlt"}
                      </span>
                    </div>
                  </div>

                  {!installed && (
                    <div className="guild-invite-diagnose">
                      <span><ShieldCheck size={14} /> Administrator-Invite</span>
                      <small>permissions=8 · volle Rechte beim Einladen</small>
                    </div>
                  )}
                  {installed ? (
                    <a className="primary-action" href={`/dashboard/${guild.id}/overview`}>
                      Verwalten
                      <ChevronRight size={16} />
                    </a>
                  ) : (
                    <a
                      className="secondary-action invite-action"
                      href={`/api/bot/invite?guildId=${guild.id}&returnTo=${encodeURIComponent(`/dashboard/${guild.id}/overview`)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Plus size={16} />
                      Einladen
                    </a>
                  )}
                </article>
              );
            })}
          </section>
        )}
      </main>
    </div>
  );
}

function formatDuration(seconds: number | null | undefined) {
  if (!seconds || seconds < 0) return "unbekannt";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatInviteAge(seconds: number | null | undefined) {
  if (seconds === 0) return "unbegrenzt";
  return formatDuration(seconds);
}

function formatInviteUses(uses: number | null | undefined, maxUses: number | null | undefined) {
  if (!maxUses) return `${uses ?? 0} genutzt`;
  return `${uses ?? 0}/${maxUses} genutzt`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "unbekannt";
  return new Date(value).toLocaleString("de-DE");
}

function channelTypeLabel(type: string) {
  switch (type.toLowerCase()) {
    case "text":
      return "Textkanal";
    case "news":
      return "Ankündigungen";
    case "forum":
      return "Forum";
    case "public_thread":
    case "private_thread":
    case "thread":
      return "Thread";
    case "voice":
      return "Voice";
    case "stage_voice":
      return "Stage";
    case "category":
    case "kategorie":
      return "Kategorie";
    default:
      return type || "Kanal";
  }
}

function isTextGuildChannel(channel: SelectableGuildChannel) {
  const type = channel.type.toLowerCase();
  return (
    type === "text" ||
    type === "news" ||
    type === "forum" ||
    type === "public_thread" ||
    type === "private_thread" ||
    type === "thread" ||
    type === "news-thread" ||
    type === "privater thread"
  );
}

function isVoiceGuildChannel(channel: SelectableGuildChannel) {
  const type = channel.type.toLowerCase();
  return type === "voice" || type === "stage" || type === "stage_voice" || type === "stage voice";
}

function isInviteGuildChannel(channel: SelectableGuildChannel) {
  return isTextGuildChannel(channel) || isVoiceGuildChannel(channel);
}

function groupedChannels<T extends SelectableGuildChannel>(channels: T[]) {
  const groups = new Map<string, T[]>();

  for (const channel of channels) {
    const label = channel.categoryName?.trim() || "Ohne Kategorie";
    groups.set(label, [...(groups.get(label) ?? []), channel]);
  }

  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function ChannelSelectOptions({
  channels,
  noneLabel = "Nicht gesetzt",
  emptyLabel = "Keine passenden Kanäle sichtbar",
  includeNone = true
}: {
  channels: SelectableGuildChannel[];
  noneLabel?: string;
  emptyLabel?: string;
  includeNone?: boolean;
}) {
  if (!channels.length) return <option value="">{emptyLabel}</option>;

  return (
    <>
      {includeNone && <option value="">{noneLabel}</option>}
      {groupedChannels(channels).map((group) => (
        <optgroup label={group.label} key={group.label}>
          {group.items.map((channel) => (
            <option value={channel.id} key={channel.id}>
              #{channel.name} - {channelTypeLabel(channel.type)}{channel.canSend === false ? " - keine Schreibrechte" : ""}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

function statusLabel(value: string | null | undefined) {
  switch (value) {
    case "online":
      return "Online";
    case "idle":
      return "Abwesend";
    case "dnd":
      return "Bitte nicht stören";
    case "offline":
      return "Offline";
    default:
      return value || "unbekannt";
  }
}

function statusToneClass(value: string | null | undefined) {
  switch (value) {
    case "online":
      return "online";
    case "idle":
      return "idle";
    case "dnd":
      return "dnd";
    case "offline":
      return "offline";
    default:
      return "unknown";
  }
}

function activityLabel(value: string | null | undefined) {
  switch (value) {
    case "playing":
      return "Spielt";
    case "watching":
      return "Schaut";
    case "listening":
      return "Hört";
    case "streaming":
      return "Streamt";
    case "custom":
      return "Custom";
    case "none":
      return "Keine";
    default:
      return value || "Keine";
  }
}

function AdminPage() {
  const me = useApi<{ user: User }>("/api/me", []);
  const admin = useApi<AdminData>("/api/admin/bot", []);
  const runtime = admin.data?.runtime ?? null;
  const [presence, setPresence] = useState({ status: "online", activityType: "none", text: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!runtime) return;
    setPresence({
      status: runtime.status || "online",
      activityType: runtime.activityType || "none",
      text: runtime.activityText || "",
      url: ""
    });
  }, [runtime?.updatedAt]);

  const lastSeenAge = runtime?.updatedAt ? Math.max(0, Math.floor((Date.now() - new Date(runtime.updatedAt).getTime()) / 1000)) : null;
  const onlineTone = lastSeenAge !== null && lastSeenAge < 90 ? "ok" : "warn";

  async function savePresence() {
    setSaving(true);
    setStatus(null);
    try {
      await api("/api/admin/bot/presence", {
        method: "POST",
        body: JSON.stringify(presence)
      });
      setStatus("Statusänderung wurde an den Bot gesendet.");
      window.setTimeout(() => void admin.reload(), 12000);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} />
      <main className="content narrow admin-page">
        <section className="admin-hero">
          <div>
            <p className="eyebrow">
              <Gauge size={15} />
              Modmail Manager Admin
            </p>
            <h1>Bot Control Center</h1>
            <p>Status setzen, Laufzeitdaten sehen und prüfen, ob Sync, RAM, Latenz und Guild-Snapshot sauber laufen.</p>
          </div>
          <RefreshButton loading={admin.loading} onClick={admin.reload} />
        </section>

        {admin.loading && !admin.data && <LoadingBlock />}
        {admin.error && <Notice tone="danger" text={admin.error} />}

        {!admin.loading && !runtime && !admin.error && (
          <EmptyState title="Noch kein Bot-Heartbeat" text="Sobald die aktualisierte bot.py läuft, sendet der Bot seine Live-Daten automatisch ans Webpanel." />
        )}

        {admin.data && (
          <>
            <section className="overview-tiles wide">
              <StatusTile icon={<Activity size={19} />} label="Bot" value={lastSeenAge === null ? "wartet" : lastSeenAge < 90 ? "online" : "stale"} tone={onlineTone} />
              <StatusTile icon={<Gauge size={19} />} label="Latenz" value={runtime?.latencyMs !== null && runtime?.latencyMs !== undefined ? `${Math.round(runtime.latencyMs)} ms` : "-"} />
              <StatusTile icon={<Cpu size={19} />} label="RAM" value={runtime?.ramMb !== null && runtime?.ramMb !== undefined ? `${runtime.ramMb.toFixed(1)} MB` : "-"} />
              <StatusTile icon={<Server size={19} />} label="Guilds" value={String(runtime?.guildCount ?? admin.data.stats.installedGuilds ?? 0)} tone="ok" />
            </section>

            <section className="admin-grid">
              <div className="panel">
                <div className="panel-title">
                  <h2>Status ändern</h2>
                  <span className="pill neutral">wie /status</span>
                </div>
                <div className="form-grid">
                  <label>
                    Online-Status
                    <select value={presence.status} onChange={(event) => setPresence({ ...presence, status: event.target.value })}>
                      <option value="online">Online</option>
                      <option value="idle">Abwesend</option>
                      <option value="dnd">Bitte nicht stören</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                  <label>
                    Aktivität
                    <select value={presence.activityType} onChange={(event) => setPresence({ ...presence, activityType: event.target.value })}>
                      <option value="none">Keine Aktivität</option>
                      <option value="playing">Spielt</option>
                      <option value="watching">Schaut</option>
                      <option value="listening">Hört</option>
                      <option value="streaming">Streamt</option>
                      <option value="custom">Eigener Status</option>
                    </select>
                  </label>
                  <label className="wide">
                    Text
                    <input value={presence.text} maxLength={128} onChange={(event) => setPresence({ ...presence, text: event.target.value })} placeholder="Minecraft, /help, Wartung..." />
                  </label>
                  {presence.activityType === "streaming" && (
                    <label className="wide">
                      Streaming-URL
                      <input value={presence.url} onChange={(event) => setPresence({ ...presence, url: event.target.value })} placeholder="https://twitch.tv/discord" />
                    </label>
                  )}
                </div>
                <ActionStatus status={status} />
                <div className="form-actions">
                  <button className="primary-action inline" onClick={savePresence} disabled={saving}>
                    {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Status speichern
                  </button>
                </div>
              </div>

              <div className="panel admin-console">
                <div className="panel-title">
                  <h2>Live Runtime</h2>
                  <span className={lastSeenAge !== null && lastSeenAge < 90 ? "pill ok" : "pill warn"}>
                    {lastSeenAge === null ? "wartet" : `vor ${lastSeenAge}s`}
                  </span>
                </div>
                <dl className="facts">
                  <div><dt>Status</dt><dd>{statusLabel(runtime?.status)}</dd></div>
                  <div><dt>Aktivität</dt><dd>{activityLabel(runtime?.activityType)} {runtime?.activityText ? `- ${runtime.activityText}` : ""}</dd></div>
                  <div><dt>Bot-Version</dt><dd>{runtime?.botVersion || "-"}</dd></div>
                  <div><dt>Uptime</dt><dd>{formatDuration(runtime?.uptimeSeconds)}</dd></div>
                  <div><dt>Python</dt><dd>{runtime?.pythonVersion || "-"}</dd></div>
                  <div><dt>discord.py</dt><dd>{runtime?.discordPyVersion || "-"}</dd></div>
                  <div><dt>CPU</dt><dd>{runtime?.cpuPercent !== null && runtime?.cpuPercent !== undefined ? `${runtime.cpuPercent.toFixed(1)}%` : "-"}</dd></div>
                  <div><dt>Commands</dt><dd>{runtime?.commandCount ?? admin.data.stats.knownCommands}</dd></div>
                  <div><dt>Letzter Heartbeat</dt><dd>{formatDateTime(runtime?.updatedAt)}</dd></div>
                </dl>
              </div>
            </section>

            <section className="admin-grid">
              <div className="panel">
                <div className="panel-title">
                  <h2>Guilds</h2>
                  <span className="pill">{runtime?.userCount ?? 0} User</span>
                </div>
                <div className="admin-guild-list">
                  {(runtime?.details.guilds ?? []).slice(0, 12).map((guild) => (
                    <article key={guild.id}>
                      <strong>{guild.name}</strong>
                      <span>{guild.memberCount} Mitglieder</span>
                      <small>{guild.channelCount} Kanäle · {guild.roleCount} Rollen</small>
                    </article>
                  ))}
                  {(runtime?.details.guilds ?? []).length === 0 && <p className="muted">Noch keine Guild-Details im Heartbeat.</p>}
                </div>
              </div>

              <div className="panel">
                <div className="panel-title">
                  <h2>Sync-Events</h2>
                  <span className={admin.data.adminRestricted ? "pill ok" : "pill warn"}>
                    {admin.data.adminRestricted ? "ID-Lock" : "Login-Lock"}
                  </span>
                </div>
                <div className="event-list">
                  {admin.data.recentEvents.map((event) => (
                    <article key={event.id}>
                      <strong>{event.action}</strong>
                      <span className={`pill ${event.status === "completed" ? "ok" : event.status === "failed" ? "danger" : "neutral"}`}>{event.status}</span>
                      <small>{event.guildName || event.guildId || "global"} · {formatDateTime(event.createdAt)}</small>
                      {event.lastError && <p>{event.lastError}</p>}
                    </article>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

type OwnerTone = "ok" | "warn" | "danger" | "neutral";

function ownerEventStatusLabel(status: string) {
  switch (status) {
    case "completed":
      return "Erledigt";
    case "failed":
      return "Fehler";
    case "processing":
      return "Läuft";
    case "queued":
      return "Wartet";
    case "pending":
      return "Offen";
    default:
      return status || "Unbekannt";
  }
}

function ownerEventStatusTone(status: string): OwnerTone {
  if (status === "completed") return "ok";
  if (status === "failed") return "danger";
  if (status === "queued" || status === "pending" || status === "processing") return "warn";
  return "neutral";
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1, notation: value >= 10000 ? "compact" : "standard" }).format(value);
}

function pterodactylStateLabel(value: string | null | undefined) {
  switch (value) {
    case "running":
      return "läuft";
    case "starting":
      return "startet";
    case "stopping":
      return "stoppt";
    case "offline":
      return "offline";
    default:
      return value || "unbekannt";
  }
}

function AdminPageModern() {
  const me = useApi<{ user: User }>("/api/me", []);
  const admin = useApi<AdminData>("/api/admin/bot", []);
  const ownerLogs = useApi<OwnerLogData>("/api/admin/bot/logs", []);
  const runtime = admin.data?.runtime ?? null;
  const ownerHasData = Boolean(admin.data);
  const ownerInitialLoading = admin.loading && !ownerHasData;
  const ownerRefreshing = admin.loading && ownerHasData;
  const guilds = runtime?.details.guilds ?? [];
  const recentEvents = admin.data?.recentEvents ?? [];
  const lavalink = runtime?.details.lavalink ?? null;
  const music = runtime?.details.music ?? null;
  const reportedMusicSource: "youtube" | "spotify" =
    music?.playerSource === "youtube" || lavalink?.playerSource === "youtube" ||
    (!music?.playerSource && !lavalink?.playerSource && String(music?.searchSource ?? lavalink?.searchSource ?? "").startsWith("yt"))
      ? "youtube"
      : "spotify";
  const recentBotLogs = ownerLogs.data?.logs ?? runtime?.details.logs ?? [];

  const [presence, setPresence] = useState({ status: "online", activityType: "none", text: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [musicSourceStatus, setMusicSourceStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [guildSearch, setGuildSearch] = useState("");
  const [guildSort, setGuildSort] = useState<"name" | "members" | "channels" | "roles">("name");
  const [eventFilter, setEventFilter] = useState<"all" | "open" | "failed" | "completed">("all");
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    if (!runtime) return;
    setPresence({
      status: runtime.status || "online",
      activityType: runtime.activityType || "none",
      text: runtime.activityText || "",
      url: ""
    });
  }, [runtime?.updatedAt]);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = window.setInterval(() => {
      void admin.reload();
      void ownerLogs.reload();
    }, 30000);

    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh]);

  const lastSeenAge = runtime?.updatedAt ? Math.max(0, Math.floor((Date.now() - new Date(runtime.updatedAt).getTime()) / 1000)) : null;
  const fallbackRuntime = runtime?.id === "fallback" || runtime?.details.heartbeat === false;
  const pterodactyl = runtime?.details.pterodactyl ?? null;
  const pterodactylState = pterodactyl?.state ?? null;
  const pterodactylOnline = Boolean(pterodactylState && !pterodactyl?.suspended && ["running", "starting"].includes(pterodactylState));
  const heartbeatFresh = !fallbackRuntime && lastSeenAge !== null && lastSeenAge < 90;
  const signalLabel = fallbackRuntime ? (pterodactyl ? "Prozess" : "Sync") : "Gateway";
  const signalValue = fallbackRuntime
    ? pterodactyl ? pterodactylStateLabel(pterodactylState) : "fehlt"
    : lastSeenAge === null ? "wartet" : heartbeatFresh ? "online" : "stale";
  const signalTone: "ok" | "warn" = fallbackRuntime ? (pterodactylOnline ? "ok" : "warn") : heartbeatFresh ? "ok" : "warn";
  const latencyMs = runtime?.latencyMs;
  const ramMb = runtime?.ramMb;
  const cpuPercent = runtime?.cpuPercent;
  const failedEvents = recentEvents.filter((event) => event.status === "failed").length;
  const openEvents = recentEvents.filter((event) => !["completed", "failed"].includes(event.status)).length;
  const installedGuilds = admin.data?.stats.installedGuilds ?? 0;
  const knownGuilds = admin.data?.stats.knownGuilds ?? 0;
  const installRate = knownGuilds ? Math.round((installedGuilds / knownGuilds) * 100) : 0;
  const guildUserText = runtime?.userCount !== null && runtime?.userCount !== undefined ? `${compactNumber(runtime.userCount)} Nutzer` : "Nutzer offen";

  const filteredGuilds = useMemo(() => {
    const needle = guildSearch.trim().toLowerCase();
    return [...guilds]
      .filter((guild) => {
        if (!needle) return true;
        return (
          guild.name.toLowerCase().includes(needle) ||
          guild.id.includes(needle) ||
          (guild.ownerName ?? "").toLowerCase().includes(needle) ||
          (guild.ownerId ?? "").includes(needle)
        );
      })
      .sort((left, right) => {
        if (guildSort === "name") return left.name.localeCompare(right.name, "de");
        if (guildSort === "channels") return right.channelCount - left.channelCount;
        if (guildSort === "roles") return right.roleCount - left.roleCount;
        return (right.memberCount ?? 0) - (left.memberCount ?? 0);
      });
  }, [guildSearch, guildSort, guilds]);

  const visibleEvents = useMemo(() => {
    return recentEvents.filter((event) => {
      if (eventFilter === "all") return true;
      if (eventFilter === "open") return !["completed", "failed"].includes(event.status);
      return event.status === eventFilter;
    });
  }, [eventFilter, recentEvents]);

  const healthChecks = [
    {
      label: fallbackRuntime ? "Datenquelle" : "Heartbeat",
      value: fallbackRuntime ? (pterodactyl ? "Pterodactyl" : "Datenbank") : lastSeenAge === null ? "wartet" : heartbeatFresh ? `vor ${lastSeenAge}s` : `vor ${formatDuration(lastSeenAge)}`,
      detail: fallbackRuntime ? "Bot-Heartbeat fehlt" : "Live-Daten vom Bot",
      tone: fallbackRuntime ? "warn" : heartbeatFresh ? "ok" : "warn",
      icon: <Wifi size={16} />
    },
    {
      label: "Gateway",
      value: latencyMs !== null && latencyMs !== undefined ? `${Math.round(latencyMs)} ms` : "-",
      detail: "Discord-Latenz",
      tone: latencyMs === null || latencyMs === undefined || latencyMs < 250 ? "ok" : "warn",
      icon: <Gauge size={16} />
    },
    {
      label: "Ressourcen",
      value: cpuPercent !== null && cpuPercent !== undefined ? `${cpuPercent.toFixed(1)}% CPU` : "CPU offen",
      detail: ramMb !== null && ramMb !== undefined ? `${ramMb.toFixed(1)} MB RAM` : "RAM nicht gemeldet",
      tone: (cpuPercent !== null && cpuPercent !== undefined && cpuPercent > 80) || (ramMb !== null && ramMb !== undefined && ramMb > 1536) ? "warn" : "ok",
      icon: <Cpu size={16} />
    },
    {
      label: "Sync-Queue",
      value: openEvents ? `${openEvents} offen` : "sauber",
      detail: failedEvents ? `${failedEvents} Fehler in den letzten Events` : "keine aktuellen Fehler",
      tone: failedEvents ? "danger" : openEvents ? "warn" : "ok",
      icon: <Clock3 size={16} />
    }
  ] satisfies Array<{ label: string; value: string; detail: string; tone: OwnerTone; icon: React.ReactNode }>;

  const healthScore = Math.round((healthChecks.filter((check) => check.tone === "ok").length / healthChecks.length) * 100);
  const healthTone: OwnerTone = healthScore >= 75 ? "ok" : healthScore >= 50 ? "warn" : "danger";
  const lavalinkTone: "ok" | "warn" = lavalink?.connected ? "ok" : "warn";
  const queueItems = music?.queueItems ?? lavalink?.queueItems ?? 0;
  const lavalinkStatusText = lavalink?.connected ? "Verbunden" : lavalink?.status || "Unbekannt";
  const quickActions = [
    { action: "snapshot.refresh", title: "Snapshot", text: "Guilds & Commands neu einlesen", icon: <Database size={17} /> },
    { action: "runtime.refresh", title: "Runtime", text: "Live-Status sofort melden", icon: <Activity size={17} /> },
    { action: "commands.sync", title: "Commands", text: "Slash-Befehle synchronisieren", icon: <Command size={17} /> },
    { action: "music.reconnect", title: "Lavalink", text: "Node-Verbindung erneuern", icon: <Radio size={17} /> },
    { action: "music.disconnect_all", title: "Musik trennen", text: "Alle Voice-Player lösen", icon: <Power size={17} /> },
    { action: "restart.request", title: "Bot-Restart", text: "Restart über Bot anfragen", icon: <RotateCcw size={17} /> }
  ];

  const presencePresets = [
    { label: "Normal", status: "online", activityType: "none", text: "", url: "" },
    { label: "Support", status: "online", activityType: "listening", text: "/help", url: "" },
    { label: "Wartung", status: "dnd", activityType: "watching", text: "Wartung", url: "" },
    { label: "Idle", status: "idle", activityType: "playing", text: "mit Slash-Commands", url: "" }
  ];

  async function savePresence() {
    setSaving(true);
    setSaveStatus(null);
    try {
      await api("/api/admin/bot/presence", {
        method: "POST",
        body: JSON.stringify(presence)
      });
      setSaveStatus("Statusänderung wurde an den Bot gesendet.");
      notify({ tone: "success", title: "Status gesendet", text: "Die Präsenzänderung wurde an den Bot übergeben." });
      window.setTimeout(() => void admin.reload(), 12000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Status konnte nicht geändert werden.";
      setSaveStatus(message);
      notify({ tone: "danger", title: "Status fehlgeschlagen", text: message });
    } finally {
      setSaving(false);
    }
  }

  async function runOwnerAction(action: string) {
    setActionBusy(action);
    setActionStatus(null);
    try {
      await api("/api/admin/bot/actions", {
        method: "POST",
        body: JSON.stringify({ action })
      });
      setActionStatus(`${ownerActionLabels[action] ?? action} wurde an den Bot gesendet.`);
      notify({ tone: "success", title: "Aktion gesendet", text: ownerActionLabels[action] ?? action });
      window.setTimeout(() => {
        void admin.reload();
        void ownerLogs.reload();
      }, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aktion konnte nicht gestartet werden.";
      setActionStatus(message);
      notify({ tone: "danger", title: "Aktion fehlgeschlagen", text: message });
    } finally {
      setActionBusy(null);
    }
  }

  async function saveMusicSource() {
    setActionBusy("music.source");
    setMusicSourceStatus(null);
    try {
      await api("/api/admin/bot/music-source", {
        method: "POST",
        body: JSON.stringify({ source: "youtube" })
      });
      setMusicSourceStatus("YouTube wird vom Bot geprüft und als einzige Musikquelle aktiviert.");
      notify({ tone: "success", title: "YouTube-Prüfung gesendet", text: "Der YouTube-Player wird über Lavalink geprüft." });
      window.setTimeout(() => void admin.reload(), 12000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Der YouTube-Player konnte nicht geprüft werden.";
      setMusicSourceStatus(message);
      notify({ tone: "danger", title: "YouTube-Prüfung fehlgeschlagen", text: message });
    } finally {
      setActionBusy(null);
    }
  }

  async function retrySyncEvent(eventId: string) {
    setRetryingEventId(eventId);

    try {
      await api(`/api/admin/sync-events/${encodeURIComponent(eventId)}/retry`, { method: "POST" });
      notify({ tone: "success", title: "Erneut eingeplant", text: "Der Bot verarbeitet die Aktion beim nächsten Sync-Lauf erneut." });
      await Promise.all([admin.reload(), ownerLogs.reload()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Das Sync-Event konnte nicht erneut gestartet werden.";
      notify({ tone: "danger", title: "Retry fehlgeschlagen", text: message });
    } finally {
      setRetryingEventId(null);
    }
  }

  async function runPowerSignal(signal: "restart") {
    setActionBusy(`pterodactyl.${signal}`);
    setActionStatus(null);
    try {
      await api("/api/admin/pterodactyl/power", {
        method: "POST",
        body: JSON.stringify({ signal })
      });
      setActionStatus("Pterodactyl-Restart wurde gesendet.");
      notify({ tone: "success", title: "Pterodactyl-Restart gesendet", text: "Der Power-Befehl wurde an das Panel übergeben." });
      window.setTimeout(() => void admin.reload(), 8000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pterodactyl-Aktion konnte nicht gestartet werden.";
      setActionStatus(message);
      notify({ tone: "danger", title: "Pterodactyl fehlgeschlagen", text: message });
    } finally {
      setActionBusy(null);
    }
  }

  async function exportOwnerConfig() {
    setExporting(true);
    setActionStatus(null);
    try {
      await downloadJson("/api/admin/bot/export", `discordbot-owner-export-${new Date().toISOString().slice(0, 10)}.json`);
      setActionStatus("Owner-Export wurde erstellt.");
      notify({ tone: "success", title: "Export erstellt", text: "Die Owner-Konfiguration wurde als JSON vorbereitet." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Export konnte nicht erstellt werden.";
      setActionStatus(message);
      notify({ tone: "danger", title: "Export fehlgeschlagen", text: message });
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} />
      <main className="content narrow owner-admin-page">
        <section className="owner-hero">
          <div>
            <p className="eyebrow">
              <ShieldCheck size={15} />
              Owner Operations
            </p>
            <h1>Bot Control Center</h1>
            <p>Live-Status, Präsenz, Guilds und Sync-Jobs sauber gebündelt. Alles Wichtige ist sofort sichtbar und die Bedienung bleibt schnell.</p>
          </div>
          <div className="owner-hero-actions">
            <button className={`secondary-action inline ${autoRefresh ? "is-active" : ""}`} onClick={() => setAutoRefresh((value) => !value)}>
              <Activity size={16} />
              Auto {autoRefresh ? "an" : "aus"}
            </button>
            <RefreshButton loading={ownerRefreshing} onClick={admin.reload} />
          </div>
        </section>

        {me.data?.user?.ownerAdmin && (
          <section className="owner-security-banner">
            <span><ShieldCheck size={18} /></span>
            <div>
              <strong>Owner-Modus aktiv</strong>
              <small>Admin-Routen und Owner-API sind per Discord-ID gesperrt. Angemeldet als {me.data.user.displayName || me.data.user.username}{me.data.user.discordUserId ? ` · ${me.data.user.discordUserId}` : ""}.</small>
            </div>
            <em>ID-Lock</em>
          </section>
        )}

        {ownerInitialLoading && <LoadingBlock />}
        {admin.error && <Notice tone="danger" text={admin.error} />}

        {!ownerInitialLoading && !runtime && !admin.error && (
          <EmptyState title="Noch keine Bot-Daten" text="Sobald eine Datenquelle erreichbar ist, landen die Werte automatisch hier." />
        )}

        {admin.data && (
          <>
            <section className="owner-overview-grid">
              <StatusTile icon={<Wifi size={19} />} label={signalLabel} value={signalValue} tone={signalTone} />
              <StatusTile icon={<Gauge size={19} />} label="Latenz" value={latencyMs !== null && latencyMs !== undefined ? `${Math.round(latencyMs)} ms` : "-"} tone={latencyMs !== null && latencyMs !== undefined && latencyMs > 250 ? "warn" : "ok"} />
              <StatusTile icon={<HardDrive size={19} />} label="RAM" value={ramMb !== null && ramMb !== undefined ? `${ramMb.toFixed(1)} MB` : "-"} tone={ramMb !== null && ramMb !== undefined && ramMb > 1536 ? "warn" : "ok"} />
              <StatusTile icon={<Cpu size={19} />} label="CPU" value={cpuPercent !== null && cpuPercent !== undefined ? `${cpuPercent.toFixed(1)}%` : "-"} tone={cpuPercent !== null && cpuPercent !== undefined && cpuPercent > 80 ? "warn" : "ok"} />
              <StatusTile icon={<Server size={19} />} label="Guilds" value={compactNumber(runtime?.guildCount ?? installedGuilds)} tone="ok" />
              <StatusTile icon={<Command size={19} />} label="Commands" value={compactNumber(runtime?.commandCount ?? admin.data.stats.knownCommands)} />
            </section>

            <section className="owner-admin-grid owner-tools-grid">
              <div className="panel owner-quick-panel">
                <div className="panel-title">
                  <div>
                    <h2>Quick Actions</h2>
                    <p className="muted">Schnelle Bot-Aktionen über die sichere Sync-Queue.</p>
                  </div>
                  <span className="pill neutral">Owner</span>
                </div>
                <div className="owner-action-grid">
                  {quickActions.map((item) => (
                    <button key={item.action} className="owner-action-card" onClick={() => void runOwnerAction(item.action)} disabled={Boolean(actionBusy)}>
                      <span className="owner-action-icon">{actionBusy === item.action ? <Loader2 className="spin" size={17} /> : item.icon}</span>
                      <span>
                        <strong>{item.title}</strong>
                        <small>{item.text}</small>
                      </span>
                    </button>
                  ))}
                  <button className="owner-action-card" onClick={() => void runPowerSignal("restart")} disabled={Boolean(actionBusy)}>
                    <span className="owner-action-icon">{actionBusy === "pterodactyl.restart" ? <Loader2 className="spin" size={17} /> : <Power size={17} />}</span>
                    <span>
                      <strong>Pterodactyl</strong>
                      <small>Server-Restart auslösen</small>
                    </span>
                  </button>
                  <button className="owner-action-card" onClick={() => void exportOwnerConfig()} disabled={exporting}>
                    <span className="owner-action-icon">{exporting ? <Loader2 className="spin" size={17} /> : <Download size={17} />}</span>
                    <span>
                      <strong>Export</strong>
                      <small>Owner-Config als JSON</small>
                    </span>
                  </button>
                </div>
                <ActionStatus status={actionStatus} />
              </div>

              <div className="panel owner-music-panel">
                <div className="panel-title">
                  <div>
                    <h2>Musik & Lavalink</h2>
                    <p className="muted">Node, Queue und aktive Player auf einen Blick.</p>
                  </div>
                  <span className={`pill ${lavalinkTone}`}>{lavalink?.connected ? "verbunden" : "prüfen"}</span>
                </div>
                <div className={`owner-lavalink-card ${lavalinkTone}`}>
                  <span className="owner-lavalink-icon"><Radio size={19} /></span>
                  <div>
                    <small>Lavalink Node</small>
                    <strong>{lavalinkStatusText}</strong>
                    <em>{lavalink?.uri || "Keine Node gemeldet"}</em>
                  </div>
                  <span className={`pill ${lavalinkTone}`}>{lavalink?.identifier || "main"}</span>
                </div>
                <div className="owner-source-control">
                  <div className="owner-source-heading">
                    <div>
                      <small>Aktiver Musikmodus</small>
                      <strong>YouTube</strong>
                    </div>
                    <span className={`pill ${reportedMusicSource === "youtube" ? "ok" : "warn"}`}>
                      {reportedMusicSource === "youtube" ? "aktiv" : "Bot-Neustart ausstehend"}
                    </span>
                  </div>
                  <div className="owner-source-options single" aria-label="Aktive Musikquelle">
                    <div className="owner-source-status active youtube">
                      <span><Youtube size={19} /></span>
                      <span><strong>YouTube</strong><small>ytsearch + ytmsearch</small></span>
                      {reportedMusicSource === "youtube" && <Check size={16} />}
                    </div>
                  </div>
                  <div className="owner-source-actions">
                    <small>Spotify ist vorerst deaktiviert. Songnamen und YouTube-Links laufen ausschließlich über den YouTube-Player.</small>
                    <button
                      type="button"
                      className="primary-action inline"
                      onClick={() => void saveMusicSource()}
                      disabled={Boolean(actionBusy)}
                    >
                      {actionBusy === "music.source" ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                      {actionBusy === "music.source" ? "Prüfen" : "YouTube prüfen"}
                    </button>
                  </div>
                  <ActionStatus status={musicSourceStatus} />
                </div>
                <div className="owner-music-stat-grid">
                  <div><dt>Player</dt><dd>{compactNumber(music?.activePlayers ?? lavalink?.activePlayers ?? 0)}</dd></div>
                  <div><dt>Queue</dt><dd>{compactNumber(queueItems)}</dd></div>
                  <div><dt>Backend</dt><dd>{music?.backend || lavalink?.backend || "-"}</dd></div>
                  <div><dt>Suche</dt><dd>{music?.searchSource || lavalink?.searchSource || "-"}</dd></div>
                  <div><dt>Volume</dt><dd>{music?.defaultVolume ?? "-"}</dd></div>
                  <div><dt>Gespeichert</dt><dd>{compactNumber(music?.savedPlayers ?? 0)}</dd></div>
                </div>
                <div className="owner-detail-list owner-player-list">
                  {(music?.players ?? []).slice(0, 4).map((player) => (
                    <article className="owner-detail-row" key={player.guildId}>
                      <span className="channel-symbol"><Music2 size={15} /></span>
                      <div>
                        <strong>{player.guildName || player.guildId}</strong>
                        <small>{player.trackTitle || player.channelName || "kein Track gemeldet"}</small>
                      </div>
                      <div className="owner-detail-tags">
                        <span>{player.paused ? "pausiert" : player.playing ? "spielt" : "bereit"}</span>
                        <span>{player.queueLength ?? 0} Queue</span>
                      </div>
                    </article>
                  ))}
                  {!(music?.players ?? []).length && <p className="muted">Keine aktiven Musik-Player gemeldet.</p>}
                </div>
              </div>
            </section>

            <section className="owner-admin-grid">
              <div className="panel owner-presence-panel">
                <div className="panel-title">
                  <div>
                    <h2>Präsenz steuern</h2>
                    <p className="muted">Status und Aktivität ohne Umwege setzen.</p>
                  </div>
                  <span className={`pill ${runtime?.status === "online" ? "ok" : runtime?.status === "dnd" ? "danger" : runtime?.status === "idle" ? "warn" : "neutral"}`}>
                    {statusLabel(runtime?.status)}
                  </span>
                </div>

                <div className={`owner-current-status ${statusToneClass(runtime?.status)}`}>
                  <span className="owner-current-status-dot" aria-hidden="true" />
                  <div>
                    <small>Aktueller Bot-Status</small>
                    <strong>{statusLabel(runtime?.status)}</strong>
                  </div>
                  <em>{runtime?.updatedAt ? `gemeldet ${formatDateTime(runtime.updatedAt)}` : "wartet auf Bot-Daten"}</em>
                </div>

                <div className="owner-presets">
                  {presencePresets.map((preset) => {
                    const active = presence.status === preset.status && presence.activityType === preset.activityType && presence.text === preset.text;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        className={`owner-preset-button ${active ? "active" : ""}`}
                        onClick={() => setPresence({ status: preset.status, activityType: preset.activityType, text: preset.text, url: preset.url })}
                      >
                        <Sparkles size={15} />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="form-grid">
                  <label>
                    Online-Status
                    <select value={presence.status} onChange={(event) => setPresence({ ...presence, status: event.target.value })}>
                      <option value="online">Online</option>
                      <option value="idle">Abwesend</option>
                      <option value="dnd">Bitte nicht stören</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>
                  <label>
                    Aktivität
                    <select value={presence.activityType} onChange={(event) => setPresence({ ...presence, activityType: event.target.value })}>
                      <option value="none">Keine Aktivität</option>
                      <option value="playing">Spielt</option>
                      <option value="watching">Schaut</option>
                      <option value="listening">Hört</option>
                      <option value="streaming">Streamt</option>
                      <option value="custom">Eigener Status</option>
                    </select>
                  </label>
                  <label className="wide">
                    Text
                    <input value={presence.text} maxLength={128} onChange={(event) => setPresence({ ...presence, text: event.target.value })} placeholder="Minecraft, /help, Wartung..." />
                  </label>
                  {presence.activityType === "streaming" && (
                    <label className="wide">
                      Streaming-URL
                      <input value={presence.url} onChange={(event) => setPresence({ ...presence, url: event.target.value })} placeholder="https://twitch.tv/dein-kanal" />
                    </label>
                  )}
                </div>

                <ActionStatus status={saveStatus} />
                <div className="form-actions">
                  <button className="primary-action inline" onClick={savePresence} disabled={saving}>
                    {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Status speichern
                  </button>
                </div>
              </div>

              <div className="panel owner-health-panel">
                <div className="panel-title">
                  <div>
                    <h2>Systemzustand</h2>
                    <p className="muted">Kompakter Check für Laufzeit und Queue.</p>
                  </div>
                  <span className={`pill ${healthTone}`}>{healthScore}%</span>
                </div>

                <div className="owner-health-summary">
                  <div className={`owner-health-score ${healthTone}`}>
                    <strong>{healthScore}%</strong>
                    <span>Health</span>
                  </div>
                  <dl className="owner-runtime-mini">
                    <div><dt>Uptime</dt><dd>{formatDuration(runtime?.uptimeSeconds)}</dd></div>
                    <div><dt>Bot-Version</dt><dd>{runtime?.botVersion || "-"}</dd></div>
                    <div><dt>discord.py</dt><dd>{runtime?.discordPyVersion || "-"}</dd></div>
                    <div><dt>Python</dt><dd>{runtime?.pythonVersion || "-"}</dd></div>
                    <div><dt>Installiert</dt><dd>{installedGuilds}/{knownGuilds || installedGuilds} · {installRate}%</dd></div>
                    <div><dt>{fallbackRuntime ? "Letzter Check" : "Letzter Heartbeat"}</dt><dd>{formatDateTime(runtime?.updatedAt)}</dd></div>
                  </dl>
                </div>

                <div className="owner-health-list">
                  {healthChecks.map((check) => (
                    <article key={check.label} className={`owner-health-item ${check.tone}`}>
                      <span>{check.icon}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.detail}</small>
                      </div>
                      <em>{check.value}</em>
                    </article>
                  ))}
                </div>
              </div>
            </section>

            <section className="owner-admin-grid owner-admin-grid-wide">
              <div className="panel owner-guilds-panel">
                <div className="panel-title">
                  <div>
                    <h2>Guild-Übersicht</h2>
                    <p className="muted">{guildUserText} über {compactNumber(runtime?.guildCount ?? guilds.length)} Guilds.</p>
                  </div>
                  <span className="pill neutral">{filteredGuilds.length} Treffer</span>
                </div>

                <div className="owner-panel-toolbar">
                  <label className="owner-search">
                    <Search size={16} />
                    <input value={guildSearch} onChange={(event) => setGuildSearch(event.target.value)} placeholder="Name, ID oder Owner suchen" aria-label="Guild suchen" />
                  </label>
                  <label className="owner-select">
                    <SlidersHorizontal size={16} />
                    <select value={guildSort} onChange={(event) => setGuildSort(event.target.value as "name" | "members" | "channels" | "roles")} aria-label="Guilds sortieren">
                      <option value="name">Name</option>
                      <option value="members">Mitglieder</option>
                      <option value="channels">Kanäle</option>
                      <option value="roles">Rollen</option>
                    </select>
                  </label>
                </div>

                <div className="owner-guild-list">
                  {filteredGuilds.slice(0, 18).map((guild) => (
                    <article key={guild.id} className="owner-guild-row">
                      {guild.icon ? (
                        <img className="owner-guild-avatar" src={guild.icon} alt="" />
                      ) : (
                        <div className="owner-guild-initial">{(guild.name || "?").slice(0, 2).toUpperCase()}</div>
                      )}
                      <div className="owner-guild-main">
                        <a
                          className="owner-guild-name-link"
                          href={adminGuildViewPath({ id: guild.id, name: guild.name })}
                        >
                          {guild.name}
                        </a>
                        <small className="owner-guild-id">{guild.id}</small>
                        <div className="owner-guild-meta">
                          {guild.ownerName || guild.ownerId ? <span>Owner: {guild.ownerName || guild.ownerId}</span> : <span>Owner unbekannt</span>}
                          {guild.shardId !== null && guild.shardId !== undefined && <span>Shard {guild.shardId}</span>}
                          {guild.joinedAt && <span>seit {formatDateTime(guild.joinedAt)}</span>}
                        </div>
                      </div>
                      <div className="owner-guild-stats">
                        <span>{guild.memberCount === null ? "Mitglieder offen" : `${compactNumber(guild.memberCount)} Mitglieder`}</span>
                        <span>{guild.channelCount} Kanäle</span>
                        <span>{guild.roleCount} Rollen</span>
                      </div>
                    </article>
                  ))}
                  {filteredGuilds.length > 18 && <p className="muted">+ {filteredGuilds.length - 18} weitere Treffer</p>}
                  {guilds.length === 0 && <p className="muted">Noch keine Guild-Daten verfügbar.</p>}
                  {guilds.length > 0 && filteredGuilds.length === 0 && <p className="muted">Keine Guild passt zu deiner Suche.</p>}
                </div>
              </div>

              <div className="panel owner-events-panel">
                <div className="panel-title">
                  <div>
                    <h2>Sync-Events</h2>
                    <p className="muted">Letzte Aktionen aus der Bot-Queue.</p>
                  </div>
                  <span className={admin.data.adminRestricted ? "pill ok" : "pill warn"}>
                    {admin.data.adminRestricted ? "ID-Lock" : "Login-Lock"}
                  </span>
                </div>

                <div className="owner-segmented" aria-label="Events filtern">
                  {[
                    ["all", "Alle"],
                    ["open", "Offen"],
                    ["failed", "Fehler"],
                    ["completed", "Erledigt"]
                  ].map(([value, label]) => (
                    <button key={value} type="button" className={eventFilter === value ? "active" : ""} onClick={() => setEventFilter(value as "all" | "open" | "failed" | "completed")}>
                      <ListFilter size={14} />
                      {label}
                    </button>
                  ))}
                </div>

                <div className="owner-event-list">
                  {visibleEvents.map((event) => (
                    <article key={event.id} className="owner-event-row">
                      <div>
                        <strong>{event.action}</strong>
                        <small>{event.guildName || event.guildId || "global"} · {formatDateTime(event.createdAt)}</small>
                      </div>
                      <span className={`pill ${ownerEventStatusTone(event.status)}`}>{ownerEventStatusLabel(event.status)}</span>
                      <div className="owner-event-meta">
                        <span>{event.attempts}/{event.maxAttempts} Versuche</span>
                        {event.completedAt && <span>fertig {formatDateTime(event.completedAt)}</span>}
                        {event.status === "failed" && (
                          <button
                            type="button"
                            className="secondary-action inline owner-event-retry"
                            disabled={retryingEventId !== null}
                            onClick={() => void retrySyncEvent(event.id)}
                          >
                            {retryingEventId === event.id ? <Loader2 className="spin" size={14} /> : <RotateCcw size={14} />}
                            {retryingEventId === event.id ? "Wird eingeplant" : "Erneut versuchen"}
                          </button>
                        )}
                      </div>
                      {event.lastError && <p className="owner-event-error">{event.lastError}</p>}
                    </article>
                  ))}
                  {visibleEvents.length === 0 && <p className="muted">Keine Events in diesem Filter.</p>}
                </div>
              </div>
            </section>

            <section className="panel owner-live-log-panel">
              <div className="panel-title">
                <div>
                  <h2>Live-Logs & History</h2>
                  <p className="muted">Bot-Meldungen, Sync-Events und Owner-Änderungen zusammengeführt.</p>
                </div>
                <RefreshButton loading={ownerLogs.loading && Boolean(ownerLogs.data)} onClick={ownerLogs.reload} />
              </div>
              {ownerLogs.error && <Notice tone="danger" text={ownerLogs.error} />}
              <div className="owner-log-grid">
                <div className="owner-log-column">
                  <h3>Bot-Logs</h3>
                  {(recentBotLogs ?? []).slice(-8).reverse().map((log, index) => (
                    <article className="owner-log-row" key={`${log.createdAt ?? "log"}-${index}`}>
                      <span className={`pill ${String(log.level ?? "").toLowerCase().includes("error") ? "danger" : "neutral"}`}>{log.level || "INFO"}</span>
                      <div>
                        <strong>{log.source || "bot"}</strong>
                        <small>{log.message || "-"}</small>
                      </div>
                      <time>{formatDateTime(log.createdAt)}</time>
                    </article>
                  ))}
                  {!(recentBotLogs ?? []).length && <p className="muted">Noch keine Bot-Logs im Heartbeat.</p>}
                </div>
                <div className="owner-log-column owner-timeline-column">
                  <h3>Owner Timeline</h3>
                  {(ownerLogs.data?.auditLog ?? []).slice(0, 8).map((entry) => (
                    <article className="owner-timeline-item" key={entry.id}>
                      <span aria-hidden="true" />
                      <div>
                        <strong>{entry.action}</strong>
                        <small>{entry.guildName || entry.guildId || entry.target}</small>
                        <em>{entry.actorDiscordUserId || "Owner"} · {formatDateTime(entry.createdAt)}</em>
                      </div>
                    </article>
                  ))}
                  {!(ownerLogs.data?.auditLog ?? []).length && <p className="muted">Noch keine Owner-Änderungen gefunden.</p>}
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`metric-card ${tone ?? ""}`}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
    </div>
  );
}

function AdminGuildViewPage({ path }: { path: string }) {
  const me = useApi<{ user: User }>("/api/me", []);
  const segments = path.split("/");
  const guildId = decodeURIComponent(segments[4] ?? "");
  const routeGuildName = decodeURIComponent(segments[5] ?? "Guild");
  const validGuildId = /^\d{17,20}$/.test(guildId);
  const detail = useApi<AdminGuildDetail>(validGuildId ? `/api/admin/discordguilds/${guildId}` : null, [guildId]);
  const invites = useApi<{ invites: AdminGuildInvite[]; warning?: string }>(validGuildId ? `/api/admin/discordguilds/${guildId}/invites` : null, [guildId]);
  const data = detail.data;
  const guild = data?.guild;
  const [activeTab, setActiveTab] = useState<"roles" | "members" | "channels">("roles");
  const [search, setSearch] = useState("");
  const [nickname, setNickname] = useState("");
  const [savingNickname, setSavingNickname] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [inviteChannelId, setInviteChannelId] = useState("");
  const [inviteMaxAge, setInviteMaxAge] = useState("604800");
  const [inviteMaxUses, setInviteMaxUses] = useState("0");
  const [inviteTemporary, setInviteTemporary] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [deletingInviteCode, setDeletingInviteCode] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<string | null>(null);
  const [modules, setModules] = useState<AdminGuildDetail["modules"] | null>(null);
  const [modulesSaving, setModulesSaving] = useState(false);
  const [modulesStatus, setModulesStatus] = useState<string | null>(null);
  const [roleEditor, setRoleEditor] = useState<AdminGuildDetail["roles"][number] | null>(null);
  const [roleDraft, setRoleDraft] = useState({ name: "", color: "#5865F2", hoist: false, mentionable: false, permissions: "0" });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleStatus, setRoleStatus] = useState<string | null>(null);
  const [roleDeleteConfirmed, setRoleDeleteConfirmed] = useState(false);
  const [channelEditor, setChannelEditor] = useState<AdminGuildDetail["channels"][number] | null>(null);
  const [channelDraft, setChannelDraft] = useState({
    name: "",
    topic: "",
    categoryId: "",
    nsfw: false,
    slowmodeSeconds: "0",
    bitrateKbps: "64",
    userLimit: "0"
  });
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelStatus, setChannelStatus] = useState<string | null>(null);
  const [channelDeleteConfirmed, setChannelDeleteConfirmed] = useState(false);
  const [memberEditor, setMemberEditor] = useState<AdminGuildDetail["members"][number] | null>(null);
  const [memberAction, setMemberAction] = useState<AdminMemberAction>("timeout");
  const [memberReason, setMemberReason] = useState("");
  const [memberTimeoutSeconds, setMemberTimeoutSeconds] = useState("3600");
  const [memberDeleteMessageSeconds, setMemberDeleteMessageSeconds] = useState("0");
  const [memberConfirmed, setMemberConfirmed] = useState(false);
  const [memberActionBusy, setMemberActionBusy] = useState(false);
  const [memberActionStatus, setMemberActionStatus] = useState<string | null>(null);
  const [exportingGuild, setExportingGuild] = useState(false);

  useEffect(() => {
    if (!data) return;
    setNickname(data.settings.effectiveBotNickname || data.settings.botNickname || "");
    setModules(data.modules);
  }, [data?.settings.effectiveBotNickname, data?.settings.botNickname]);

  useEffect(() => {
    if (!roleEditor) return;
    setRoleDraft({
      name: roleEditor.name,
      color: roleEditor.color,
      hoist: roleEditor.hoist,
      mentionable: roleEditor.mentionable,
      permissions: roleEditor.permissions || "0"
    });
    setRoleDeleteConfirmed(false);
  }, [roleEditor?.id]);

  useEffect(() => {
    if (!channelEditor) return;
    setChannelDraft({
      name: channelEditor.name,
      topic: channelEditor.topic || "",
      categoryId: channelEditor.categoryId || "",
      nsfw: channelEditor.nsfw,
      slowmodeSeconds: String(channelEditor.slowmodeSeconds),
      bitrateKbps: String(channelEditor.bitrateKbps),
      userLimit: String(channelEditor.userLimit)
    });
    setChannelDeleteConfirmed(false);
    setChannelStatus(null);
  }, [channelEditor?.id]);

  useEffect(() => {
    if (!memberEditor) return;
    const timedOut = Boolean(
      memberEditor.communicationDisabledUntil
      && new Date(memberEditor.communicationDisabledUntil).getTime() > Date.now()
    );
    setMemberAction(timedOut ? "timeout_remove" : "timeout");
    setMemberReason("");
    setMemberTimeoutSeconds("3600");
    setMemberDeleteMessageSeconds("0");
    setMemberConfirmed(false);
    setMemberActionStatus(null);
  }, [memberEditor?.id]);

  const roleNameById = useMemo(() => {
    return new Map((data?.roles ?? []).map((role) => [role.id, role.name]));
  }, [data?.roles]);

  const memberActionPermission = (action: AdminMemberAction) => {
    const permissionKey = action === "kick" ? "kickMembers" : action === "ban" ? "banMembers" : "moderateMembers";
    return data?.permissionChecks.find((check) => check.key === permissionKey)?.ok ?? null;
  };

  const inviteChannels = useMemo(() => {
    return (data?.channels ?? []).filter((channel) => {
      return isInviteGuildChannel(channel);
    });
  }, [data?.channels]);

  const guildCategories = useMemo(() => {
    return (data?.channels ?? []).filter((channel) => channel.typeCode === 4);
  }, [data?.channels]);

  useEffect(() => {
    if (!inviteChannels.length) {
      setInviteChannelId("");
      return;
    }

    if (!inviteChannels.some((channel) => channel.id === inviteChannelId)) {
      setInviteChannelId(inviteChannels[0].id);
    }
  }, [inviteChannels, inviteChannelId]);

  const needle = search.trim().toLowerCase();
  const visibleRoles = (data?.roles ?? []).filter((role) => {
    if (!needle) return true;
    return role.name.toLowerCase().includes(needle) || role.id.includes(needle);
  });
  const visibleMembers = (data?.members ?? []).filter((member) => {
    if (!needle) return true;
    return [member.displayName, member.username, member.id, member.nick ?? "", ...member.roles.map((roleId) => roleNameById.get(roleId) ?? roleId)]
      .join(" ")
      .toLowerCase()
      .includes(needle);
  });
  const visibleChannels = (data?.channels ?? []).filter((channel) => {
    if (!needle) return true;
    return [channel.name, channel.type, channel.categoryName ?? "", channel.id].join(" ").toLowerCase().includes(needle);
  });

  async function saveNickname() {
    if (!validGuildId) return;
    setSavingNickname(true);
    setStatus(null);
    try {
      const response = await api<{ nickname: string | null }>(`/api/admin/discordguilds/${guildId}/bot-nickname`, {
        method: "PATCH",
        body: JSON.stringify({ nickname })
      });
      setNickname(response.nickname ?? "");
      setStatus("Botname wurde aktualisiert.");
      await detail.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Botname konnte nicht geändert werden.");
    } finally {
      setSavingNickname(false);
    }
  }

  async function createInvite() {
    if (!validGuildId || !inviteChannelId) return;
    setInviteBusy(true);
    setInviteStatus(null);

    try {
      const response = await api<{ invite: AdminGuildInvite }>(`/api/admin/discordguilds/${guildId}/invites`, {
        method: "POST",
        body: JSON.stringify({
          channelId: inviteChannelId,
          maxAge: Number(inviteMaxAge),
          maxUses: Math.max(0, Math.min(100, Number(inviteMaxUses) || 0)),
          temporary: inviteTemporary
        })
      });
      setInviteStatus(`Invite erstellt: ${response.invite.url}`);
      await invites.reload();
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Invite konnte nicht erstellt werden.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInvite(invite: AdminGuildInvite) {
    try {
      await navigator.clipboard.writeText(invite.url);
      setInviteStatus("Invite-Link wurde kopiert.");
    } catch {
      setInviteStatus(invite.url);
    }
  }

  async function deleteInvite(code: string) {
    if (!validGuildId) return;
    setDeletingInviteCode(code);
    setInviteStatus(null);

    try {
      await api(`/api/admin/discordguilds/${guildId}/invites/${encodeURIComponent(code)}`, { method: "DELETE" });
      setInviteStatus("Invite wurde gelöscht.");
      await invites.reload();
    } catch (error) {
      setInviteStatus(error instanceof Error ? error.message : "Invite konnte nicht gelöscht werden.");
    } finally {
      setDeletingInviteCode(null);
    }
  }

  async function saveModules() {
    if (!validGuildId || !modules) return;
    setModulesSaving(true);
    setModulesStatus(null);
    try {
      const response = await api<{ modules: AdminGuildDetail["modules"] }>(`/api/admin/discordguilds/${guildId}/modules`, {
        method: "PUT",
        body: JSON.stringify({ modules })
      });
      setModules(response.modules);
      setModulesStatus("Module wurden an den Bot gesendet.");
      window.setTimeout(() => void detail.reload(), 6000);
    } catch (error) {
      setModulesStatus(error instanceof Error ? error.message : "Module konnten nicht gespeichert werden.");
    } finally {
      setModulesSaving(false);
    }
  }

  async function saveRole() {
    if (!validGuildId || !roleEditor) return;
    if (!roleEditor.botCanManage) {
      setRoleStatus("Diese Rolle ist durch Discord oder die Rollen-Hierarchie geschützt.");
      return;
    }
    setRoleSaving(true);
    setRoleStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/roles/${roleEditor.id}`, {
        method: "PATCH",
        body: JSON.stringify(roleDraft)
      });
      setRoleStatus("Die Rollenänderungen wurden sicher an den Bot gesendet.");
      window.setTimeout(() => void detail.reload(), 5000);
    } catch (error) {
      setRoleStatus(error instanceof Error ? error.message : "Rolle konnte nicht gespeichert werden.");
    } finally {
      setRoleSaving(false);
    }
  }

  async function deleteRole() {
    if (!validGuildId || !roleEditor || !roleDeleteConfirmed || !roleEditor.botCanManage) return;
    setRoleSaving(true);
    setRoleStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/roles/${roleEditor.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true })
      });
      setRoleStatus("Das Löschen der Rolle wurde an den Bot gesendet.");
      setRoleDeleteConfirmed(false);
      window.setTimeout(() => {
        setRoleEditor(null);
        void detail.reload();
      }, 5000);
    } catch (error) {
      setRoleStatus(error instanceof Error ? error.message : "Rolle konnte nicht gelöscht werden.");
    } finally {
      setRoleSaving(false);
    }
  }

  async function saveChannel() {
    if (!validGuildId || !channelEditor) return;
    if (!channelEditor.botCanManage) {
      setChannelStatus("Dem Bot fehlt die Berechtigung, Kanäle zu verwalten.");
      return;
    }
    setChannelSaving(true);
    setChannelStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/channels/${channelEditor.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: channelDraft.name,
          topic: channelDraft.topic.trim() || null,
          categoryId: channelEditor.typeCode === 4 ? null : channelDraft.categoryId || null,
          nsfw: channelDraft.nsfw,
          slowmodeSeconds: Number(channelDraft.slowmodeSeconds),
          bitrateKbps: Number(channelDraft.bitrateKbps),
          userLimit: Number(channelDraft.userLimit)
        })
      });
      setChannelStatus(`${channelEditor.typeCode === 4 ? "Kategorie" : "Kanal"} wurde sicher an den Bot gesendet.`);
      window.setTimeout(() => void detail.reload(), 5000);
    } catch (error) {
      setChannelStatus(error instanceof Error ? error.message : "Kanal konnte nicht gespeichert werden.");
    } finally {
      setChannelSaving(false);
    }
  }

  async function deleteChannel() {
    if (!validGuildId || !channelEditor || !channelDeleteConfirmed || !channelEditor.botCanManage) return;
    setChannelSaving(true);
    setChannelStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/channels/${channelEditor.id}`, {
        method: "DELETE",
        body: JSON.stringify({ confirm: true })
      });
      setChannelStatus(`Das Löschen ${channelEditor.typeCode === 4 ? "der Kategorie" : "des Kanals"} wurde an den Bot gesendet.`);
      setChannelDeleteConfirmed(false);
      window.setTimeout(() => {
        setChannelEditor(null);
        void detail.reload();
      }, 5000);
    } catch (error) {
      setChannelStatus(error instanceof Error ? error.message : "Kanal konnte nicht gelöscht werden.");
    } finally {
      setChannelSaving(false);
    }
  }

  async function moderateMember() {
    if (!validGuildId || !memberEditor) return;
    const dangerousAction = memberAction === "kick" || memberAction === "ban";

    if (!memberEditor.manageable) {
      setMemberActionStatus(memberEditor.manageBlockReason || "Dieses Mitglied kann vom Bot nicht moderiert werden.");
      return;
    }
    if (memberActionPermission(memberAction) === false) {
      setMemberActionStatus("Dem Bot fehlt die für diese Aktion benötigte Discord-Berechtigung.");
      return;
    }
    if (dangerousAction && !memberConfirmed) {
      setMemberActionStatus("Bestätige die endgültige Aktion zuerst.");
      return;
    }

    setMemberActionBusy(true);
    setMemberActionStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/members/${memberEditor.id}/moderation`, {
        method: "POST",
        body: JSON.stringify({
          action: memberAction,
          reason: memberReason.trim() || "Kein Grund angegeben",
          durationSeconds: memberAction === "timeout" ? Number(memberTimeoutSeconds) : undefined,
          deleteMessageSeconds: memberAction === "ban" ? Number(memberDeleteMessageSeconds) : 0
        })
      });
      const labels: Record<AdminMemberAction, string> = {
        timeout: "Timeout",
        timeout_remove: "Timeout-Entfernung",
        kick: "Kick",
        ban: "Bann"
      };
      setMemberActionStatus(`${labels[memberAction]} wurde sicher an den Bot gesendet.`);
      setMemberConfirmed(false);
      window.setTimeout(() => void detail.reload(), 5000);
    } catch (error) {
      setMemberActionStatus(error instanceof Error ? error.message : "Die Moderationsaktion konnte nicht gesendet werden.");
    } finally {
      setMemberActionBusy(false);
    }
  }

  async function exportGuildConfig() {
    if (!validGuildId) return;
    setExportingGuild(true);
    setStatus(null);
    try {
      await downloadJson(`/api/admin/discordguilds/${guildId}/export`, `discordbot-${displayedGuildName.replace(/[^a-z0-9_-]+/gi, "-")}-${guildId}.json`);
      setStatus("Guild-Export wurde erstellt.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Guild-Export konnte nicht erstellt werden.");
    } finally {
      setExportingGuild(false);
    }
  }

  const displayedGuildName = guild?.name || routeGuildName;
  const currentRows = activeTab === "roles" ? visibleRoles.length : activeTab === "members" ? visibleMembers.length : visibleChannels.length;
  const inviteList = invites.data?.invites ?? [];
  const selectedMemberTimedOut = Boolean(
    memberEditor?.communicationDisabledUntil
    && new Date(memberEditor.communicationDisabledUntil).getTime() > Date.now()
  );
  const selectedMemberActionLabel: Record<AdminMemberAction, string> = {
    timeout: "Timeout setzen",
    timeout_remove: "Timeout entfernen",
    kick: "Mitglied kicken",
    ban: "Mitglied bannen"
  };
  const selectedChannelIsText = Boolean(channelEditor && [0, 5, 15, 16].includes(channelEditor.typeCode));
  const selectedChannelIsVoice = Boolean(channelEditor && [2, 13].includes(channelEditor.typeCode));
  const missingPermissions = data?.permissionChecks.filter((check) => check.ok === false).length ?? 0;

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} />
      <main className="content narrow owner-guild-detail-page">
        <section className="owner-guild-detail-hero">
          <button type="button" className="secondary-action inline" onClick={() => navigate("/admin")}>
            <ArrowLeft size={16} />
            Zurück
          </button>
          <div className="owner-guild-detail-title">
            {guild?.icon ? (
              <img className="owner-guild-detail-icon" src={guild.icon} alt="" />
            ) : (
              <div className="owner-guild-detail-icon fallback">{(displayedGuildName || "?").slice(0, 2).toUpperCase()}</div>
            )}
            <div>
              <p className="eyebrow">
                <Server size={15} />
                Owner Guild View
              </p>
              <h1>{displayedGuildName}</h1>
              <p>{guildId}</p>
            </div>
          </div>
          <div className="owner-hero-actions">
            <button className="secondary-action inline" onClick={() => void exportGuildConfig()} disabled={exportingGuild || !data}>
              {exportingGuild ? <Loader2 className="spin" size={16} /> : <FileJson size={16} />}
              Export
            </button>
            <RefreshButton loading={detail.loading && Boolean(data)} onClick={detail.reload} />
          </div>
        </section>

        {!validGuildId && <Notice tone="danger" text="Die Guild-ID in der URL ist ungültig." />}
        {detail.loading && !data && <LoadingBlock text="Guild wird geladen" detail="Rollen, Mitglieder und Serverdaten werden abgefragt." />}
        {detail.error && <Notice tone="danger" text={detail.error} />}

        {data && guild && (
          <>
            <section className="overview-tiles wide">
              <StatusTile icon={<UserRound size={19} />} label="Mitglieder" value={compactNumber(guild.memberCount)} tone="ok" />
              <StatusTile icon={<Shield size={19} />} label="Rollen" value={compactNumber(guild.roleCount)} />
              <StatusTile icon={<Hash size={19} />} label="Kanäle" value={compactNumber(guild.channelCount)} />
              <StatusTile icon={<Gauge size={19} />} label="Shard" value={guild.shardId === null ? "-" : String(guild.shardId)} />
              <StatusTile icon={<Activity size={19} />} label="Online" value={compactNumber(guild.presenceCount)} />
            </section>

            {data.warnings.length > 0 && (
              <div className="owner-warning-stack">
                {data.warnings.map((warning) => <Notice key={warning} tone="warning" text={warning} />)}
              </div>
            )}

            <section className="owner-guild-ops-grid">
              <div className="panel owner-permission-panel">
                <div className="panel-title">
                  <div>
                    <h2>Permission-Check</h2>
                    <p className="muted">Welche Bot-Rechte auf dieser Guild fehlen.</p>
                  </div>
                  <span className={`pill ${missingPermissions ? "warn" : "ok"}`}>{missingPermissions ? `${missingPermissions} fehlen` : "sauber"}</span>
                </div>
                <div className="owner-permission-grid">
                  {data.permissionChecks.map((check) => (
                    <article className={`owner-permission-card ${check.ok === true ? "ok" : check.ok === false ? "warn" : "neutral"}`} key={check.key}>
                      <span>{check.ok === true ? <Check size={15} /> : check.ok === false ? <AlertTriangle size={15} /> : <Gauge size={15} />}</span>
                      <div>
                        <strong>{check.label}</strong>
                        <small>{check.description}</small>
                      </div>
                      <em>{check.group}</em>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel owner-modules-panel">
                <div className="panel-title">
                  <div>
                    <h2>Module</h2>
                    <p className="muted">Wichtige Features pro Guild schnell aktivieren.</p>
                  </div>
                  <span className="pill neutral">{Object.values(modules ?? data.modules).filter(Boolean).length}/{guildModuleLabels.length} aktiv</span>
                </div>
                <div className="owner-module-grid">
                  {guildModuleLabels.map((module) => {
                    const Icon = module.icon;
                    const checked = Boolean((modules ?? data.modules)[module.key]);
                    return (
                      <label className={`owner-module-card ${checked ? "active" : ""}`} key={module.key}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) => setModules({ ...(modules ?? data.modules), [module.key]: event.target.checked })}
                        />
                        <span><Icon size={17} /></span>
                        <div>
                          <strong>{module.label}</strong>
                          <small>{module.text}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>
                <ActionStatus status={modulesStatus} />
                <div className="form-actions">
                  <button className="primary-action inline" onClick={saveModules} disabled={modulesSaving || !modules}>
                    {modulesSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Module speichern
                  </button>
                </div>
              </div>
            </section>

            <section className="owner-guild-detail-grid">
              <div className="panel owner-guild-profile-panel">
                <div className="panel-title">
                  <div>
                    <h2>Botname</h2>
                    <p className="muted">Nickname vom Bot auf dieser Guild ändern.</p>
                  </div>
                  <span className="pill neutral">{data.settings.effectiveBotNickname || "Standard"}</span>
                </div>
                <label>
                  Botname auf diesem Server
                  <input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} placeholder={displayedGuildName} />
                </label>
                <ActionStatus status={status} />
                <div className="form-actions">
                  <button className="primary-action inline" onClick={saveNickname} disabled={savingNickname}>
                    {savingNickname ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Botname speichern
                  </button>
                  <button type="button" className="secondary-action inline" onClick={() => setNickname("")}>
                    Zurücksetzen
                  </button>
                </div>
              </div>

              <div className="panel owner-guild-facts-panel">
                <div className="panel-title">
                  <div>
                    <h2>Serverdaten</h2>
                    <p className="muted">Live-Daten und letzter Bot-Join.</p>
                  </div>
                </div>
                <dl className="owner-guild-facts">
                  <div><dt>Owner</dt><dd>{guild.ownerName || guild.ownerId || "unbekannt"}</dd></div>
                  <div><dt>Bot beigetreten</dt><dd>{formatDateTime(guild.joinedAt)}</dd></div>
                  <div><dt>Erstellt</dt><dd>{formatDateTime(guild.createdAt)}</dd></div>
                  <div><dt>Features</dt><dd>{guild.features.length ? guild.features.slice(0, 4).join(", ") : "-"}</dd></div>
                </dl>
              </div>
            </section>

            <section className="panel owner-invites-panel">
              <div className="panel-title">
                <div>
                  <h2>Invite-Links</h2>
                  <p className="muted">Server-Einladungen direkt über den Bot erstellen, kopieren und wieder löschen.</p>
                </div>
                <RefreshButton loading={invites.loading && Boolean(invites.data)} onClick={invites.reload} />
              </div>

              {invites.error && <Notice tone="danger" text={invites.error} />}
              {invites.data?.warning && <Notice tone="warning" text={invites.data.warning} />}

              <div className="owner-invite-form">
                <label>
                  Kanal
                  <select value={inviteChannelId} onChange={(event) => setInviteChannelId(event.target.value)} disabled={!inviteChannels.length}>
                    <ChannelSelectOptions channels={inviteChannels} emptyLabel="Kein passender Kanal sichtbar" includeNone={false} />
                  </select>
                </label>
                <label>
                  Ablauf
                  <select value={inviteMaxAge} onChange={(event) => setInviteMaxAge(event.target.value)}>
                    <option value="3600">1 Stunde</option>
                    <option value="21600">6 Stunden</option>
                    <option value="86400">1 Tag</option>
                    <option value="604800">7 Tage</option>
                    <option value="0">Unbegrenzt</option>
                  </select>
                </label>
                <label>
                  Max. Nutzungen
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={inviteMaxUses}
                    onChange={(event) => setInviteMaxUses(event.target.value)}
                  />
                </label>
                <label className="toggle owner-invite-toggle">
                  <input type="checkbox" checked={inviteTemporary} onChange={(event) => setInviteTemporary(event.target.checked)} />
                  Temporär
                </label>
                <button className="primary-action inline" onClick={createInvite} disabled={inviteBusy || !inviteChannelId}>
                  {inviteBusy ? <Loader2 className="spin" size={16} /> : <Plus size={16} />}
                  Invite erstellen
                </button>
              </div>

              <ActionStatus status={inviteStatus} />

              {invites.loading && !invites.data && <LoadingBlock text="Invites werden geladen" detail="Aktive Einladungen werden von Discord abgefragt." />}
              {!invites.loading && !invites.error && inviteList.length === 0 && (
                <p className="muted">Noch keine aktiven Invite-Links gefunden.</p>
              )}

              {inviteList.length > 0 && (
                <div className="owner-invite-list">
                  {inviteList.map((invite) => (
                    <article className="owner-invite-row" key={invite.code}>
                      <div className="owner-invite-code">
                        <strong>{invite.code}</strong>
                        <small>{invite.channelName ? `#${invite.channelName}` : invite.channelId ?? "Kanal unbekannt"}</small>
                      </div>
                      <div className="owner-invite-meta">
                        <span>{formatInviteUses(invite.uses, invite.maxUses)}</span>
                        <span>{formatInviteAge(invite.maxAge)}</span>
                        <span>{invite.temporary ? "temporär" : "normal"}</span>
                        <span>{invite.inviterName || invite.inviterId || "Bot/API"}</span>
                        {invite.expiresAt && <span>bis {formatDateTime(invite.expiresAt)}</span>}
                      </div>
                      <div className="owner-invite-actions">
                        <a className="icon-button" href={invite.url} target="_blank" rel="noreferrer" title="Invite öffnen">
                          <ExternalLink size={16} />
                        </a>
                        <button className="icon-button" onClick={() => void copyInvite(invite)} title="Invite kopieren">
                          <Copy size={16} />
                        </button>
                        <button className="icon-button danger-soft" onClick={() => void deleteInvite(invite.code)} disabled={deletingInviteCode === invite.code} title="Invite löschen">
                          {deletingInviteCode === invite.code ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="panel owner-guild-browser-panel">
              <div className="panel-title">
                <div>
                  <h2>Guild Browser</h2>
                  <p className="muted">Rollen, Mitglieder und Kanäle dieser Guild durchsuchen.</p>
                </div>
                <span className="pill neutral">{currentRows} Treffer</span>
              </div>

              <div className="owner-panel-toolbar owner-guild-browser-toolbar">
                <label className="owner-search">
                  <Search size={16} />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Suchen nach Name, ID, Rolle oder Kanal" aria-label="Guild-Daten suchen" />
                </label>
                <div className="owner-segmented owner-browser-tabs" aria-label="Guild-Daten auswählen">
                  {[
                    ["roles", "Rollen", data.roles.length],
                    ["members", "Mitglieder", `${data.limits.membersShown}${data.limits.membersPartial ? "+" : ""}`],
                    ["channels", "Kanäle", data.channels.length]
                  ].map(([value, label, count]) => (
                    <button key={value} type="button" className={activeTab === value ? "active" : ""} onClick={() => setActiveTab(value as "roles" | "members" | "channels")}>
                      {value === "roles" ? <Shield size={14} /> : value === "members" ? <UserRound size={14} /> : <Hash size={14} />}
                      <span>{label}</span>
                      <strong>{count}</strong>
                    </button>
                  ))}
                </div>
              </div>

              {activeTab === "roles" && (
                <div className="owner-detail-list">
                  {roleEditor && (
                    <article className="owner-role-editor">
                      <div className="owner-resource-editor-head">
                        <div className="owner-resource-identity">
                          <span className="role-dot" style={{ backgroundColor: roleDraft.color }} />
                          <div>
                            <h3>{roleEditor.name}</h3>
                            <p className="muted">Rolle · {roleEditor.id} · Position {roleEditor.position}</p>
                          </div>
                        </div>
                        <span className={roleEditor.botCanManage ? "pill ok" : "pill danger"}>{roleEditor.botCanManage ? "Bot kann verwalten" : "Geschützt"}</span>
                      </div>

                      {!roleEditor.botCanManage && <Notice tone="warning" text={roleEditor.managed ? "Diese Rolle wird von Discord oder einer Integration verwaltet." : roleEditor.id === guildId ? "Die @everyone-Rolle ist in dieser Verwaltung geschützt." : "Die Rolle liegt gleich hoch oder höher als die höchste Bot-Rolle."} />}

                      <div className="form-grid owner-resource-basics">
                        <label>
                          Rollenname
                          <input value={roleDraft.name} maxLength={100} onChange={(event) => setRoleDraft({ ...roleDraft, name: event.target.value })} />
                        </label>
                        <label className="owner-color-field">
                          Farbe
                          <span><input type="color" value={roleDraft.color} onChange={(event) => setRoleDraft({ ...roleDraft, color: event.target.value })} /><code>{roleDraft.color.toUpperCase()}</code></span>
                        </label>
                        <label className="toggle">
                          <input type="checkbox" checked={roleDraft.hoist} onChange={(event) => setRoleDraft({ ...roleDraft, hoist: event.target.checked })} />
                          Rolle separat anzeigen
                        </label>
                        <label className="toggle">
                          <input type="checkbox" checked={roleDraft.mentionable} onChange={(event) => setRoleDraft({ ...roleDraft, mentionable: event.target.checked })} />
                          Rolle ist erwähnbar
                        </label>
                      </div>

                      <div className="owner-resource-section-head">
                        <div>
                          <h4>Berechtigungen</h4>
                          <p className="muted">Die wichtigsten Discord-Rechte dieser Rolle gezielt schalten.</p>
                        </div>
                        <span className="pill neutral">{ADMIN_ROLE_PERMISSION_OPTIONS.filter((option) => permissionBitEnabled(roleDraft.permissions, option.bit)).length} aktiv</span>
                      </div>
                      <div className="owner-role-permissions">
                        {ADMIN_ROLE_PERMISSION_OPTIONS.map((option) => {
                          const checked = permissionBitEnabled(roleDraft.permissions, option.bit);
                          const dangerous = "danger" in option && option.danger;
                          return (
                            <label key={option.bit} className={`${checked ? "active" : ""}${dangerous ? " danger" : ""}`}>
                              <input type="checkbox" checked={checked} onChange={() => setRoleDraft({ ...roleDraft, permissions: togglePermissionBit(roleDraft.permissions, option.bit) })} />
                              <span><strong>{option.label}</strong><small>{option.group}</small></span>
                            </label>
                          );
                        })}
                      </div>

                      {permissionBitEnabled(roleDraft.permissions, "8") && <Notice tone="warning" text="Administrator umgeht sämtliche Kanalberechtigungen. Vergib dieses Recht nur bewusst." />}

                      <label className="owner-member-confirm">
                        <input type="checkbox" checked={roleDeleteConfirmed} onChange={(event) => setRoleDeleteConfirmed(event.target.checked)} disabled={!roleEditor.botCanManage} />
                        <span>Ich bestätige, dass diese Rolle endgültig gelöscht werden darf.</span>
                      </label>
                      <ActionStatus status={roleStatus} />
                      <div className="form-actions">
                        <button className="primary-action inline" onClick={saveRole} disabled={roleSaving || !roleEditor.botCanManage}>
                          {roleSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                          Rolle speichern
                        </button>
                        <button type="button" className="danger-action inline" onClick={deleteRole} disabled={roleSaving || !roleEditor.botCanManage || !roleDeleteConfirmed}>
                          <Trash2 size={16} /> Rolle löschen
                        </button>
                        <button type="button" className="secondary-action inline" onClick={() => setRoleEditor(null)} disabled={roleSaving}>
                          <X size={16} /> Schließen
                        </button>
                      </div>
                    </article>
                  )}
                  {visibleRoles.map((role) => (
                    <article key={role.id} className="owner-detail-row">
                      <span className="role-dot" style={{ backgroundColor: role.color }} />
                      <div>
                        <strong>{role.name}</strong>
                        <small>{role.id}</small>
                      </div>
                      <div className="owner-detail-tags">
                        <span>Position {role.position}</span>
                        {role.managed && <span>managed</span>}
                        {role.botCanManage && <span>Bot kann verwalten</span>}
                        {role.mentionable && <span>mentionable</span>}
                        <button type="button" className="mini-text-button" onClick={() => {
                          setRoleStatus(null);
                          setRoleEditor(role);
                        }}>
                          <Pencil size={14} /> Verwalten
                        </button>
                      </div>
                    </article>
                  ))}
                  {visibleRoles.length === 0 && <p className="muted">Keine Rolle gefunden.</p>}
                </div>
              )}

              {activeTab === "members" && (
                <div className="owner-detail-list">
                  {memberEditor && (
                    <article className="owner-member-editor">
                      <div className="owner-member-editor-head">
                        <div className="owner-member-identity">
                          {memberEditor.avatar ? <img className="member-avatar" src={memberEditor.avatar} alt="" /> : <div className="member-avatar fallback">{memberEditor.displayName.slice(0, 2).toUpperCase()}</div>}
                          <div>
                            <h3>{memberEditor.displayName}</h3>
                            <p className="muted">{memberEditor.username} · {memberEditor.id}</p>
                          </div>
                        </div>
                        <div className="owner-member-state">
                          {selectedMemberTimedOut && <span className="pill warn">Timeout bis {formatDateTime(memberEditor.communicationDisabledUntil!)}</span>}
                          <span className={memberEditor.manageable ? "pill ok" : "pill danger"}>{memberEditor.manageable ? "Bot kann moderieren" : "Geschützt"}</span>
                        </div>
                      </div>

                      {!memberEditor.manageable && <Notice tone="warning" text={memberEditor.manageBlockReason || "Dieses Mitglied ist durch Discords Rollen-Hierarchie geschützt."} />}

                      <div className="owner-member-action-grid" role="group" aria-label="Moderationsaktion">
                        <button type="button" className={memberAction === "timeout" ? "active" : ""} onClick={() => { setMemberAction("timeout"); setMemberConfirmed(false); setMemberActionStatus(null); }} disabled={memberActionPermission("timeout") === false}>
                          <Clock3 size={17} /><span>Timeout</span>
                        </button>
                        <button type="button" className={memberAction === "timeout_remove" ? "active" : ""} onClick={() => { setMemberAction("timeout_remove"); setMemberConfirmed(false); setMemberActionStatus(null); }} disabled={memberActionPermission("timeout_remove") === false}>
                          <RotateCcw size={17} /><span>Freigeben</span>
                        </button>
                        <button type="button" className={memberAction === "kick" ? "active danger" : "danger"} onClick={() => { setMemberAction("kick"); setMemberConfirmed(false); setMemberActionStatus(null); }} disabled={memberActionPermission("kick") === false}>
                          <UserMinus size={17} /><span>Kicken</span>
                        </button>
                        <button type="button" className={memberAction === "ban" ? "active danger" : "danger"} onClick={() => { setMemberAction("ban"); setMemberConfirmed(false); setMemberActionStatus(null); }} disabled={memberActionPermission("ban") === false}>
                          <Ban size={17} /><span>Bannen</span>
                        </button>
                      </div>

                      <div className="form-grid owner-member-form">
                        <label className="owner-member-reason">
                          Moderationsgrund
                          <textarea value={memberReason} maxLength={500} rows={3} placeholder="Warum wird diese Aktion ausgeführt?" onChange={(event) => setMemberReason(event.target.value)} />
                          <small>{memberReason.length}/500 Zeichen</small>
                        </label>
                        {memberAction === "timeout" && (
                          <label>
                            Timeout-Dauer
                            <select value={memberTimeoutSeconds} onChange={(event) => setMemberTimeoutSeconds(event.target.value)}>
                              <option value="300">5 Minuten</option>
                              <option value="600">10 Minuten</option>
                              <option value="3600">1 Stunde</option>
                              <option value="21600">6 Stunden</option>
                              <option value="86400">1 Tag</option>
                              <option value="259200">3 Tage</option>
                              <option value="604800">7 Tage</option>
                              <option value="2419200">28 Tage</option>
                            </select>
                          </label>
                        )}
                        {memberAction === "ban" && (
                          <label>
                            Nachrichten löschen
                            <select value={memberDeleteMessageSeconds} onChange={(event) => setMemberDeleteMessageSeconds(event.target.value)}>
                              <option value="0">Keine</option>
                              <option value="3600">Letzte Stunde</option>
                              <option value="21600">Letzte 6 Stunden</option>
                              <option value="86400">Letzter Tag</option>
                              <option value="259200">Letzte 3 Tage</option>
                              <option value="604800">Letzte 7 Tage</option>
                            </select>
                          </label>
                        )}
                      </div>

                      <div className="owner-member-role-preview">
                        <span>Rollen</span>
                        <div>
                          {memberEditor.roles.slice(0, 8).map((roleId) => <span key={roleId}>{roleNameById.get(roleId) || roleId}</span>)}
                          {memberEditor.roles.length > 8 && <span>+{memberEditor.roles.length - 8}</span>}
                          {memberEditor.roles.length === 0 && <small>Keine zusätzlichen Rollen</small>}
                        </div>
                      </div>

                      {(memberAction === "kick" || memberAction === "ban") && (
                        <label className="owner-member-confirm">
                          <input type="checkbox" checked={memberConfirmed} onChange={(event) => setMemberConfirmed(event.target.checked)} />
                          <span>Ich bestätige, dass diese Aktion das Mitglied vom Server entfernt.</span>
                        </label>
                      )}

                      {memberActionPermission(memberAction) === false && <Notice tone="warning" text="Dem Bot fehlt für diese Aktion die benötigte Discord-Berechtigung." />}
                      <ActionStatus status={memberActionStatus} />
                      <div className="form-actions">
                        <button
                          type="button"
                          className={memberAction === "kick" || memberAction === "ban" ? "danger-action inline" : "primary-action inline"}
                          onClick={moderateMember}
                          disabled={memberActionBusy || !memberEditor.manageable || memberActionPermission(memberAction) === false || ((memberAction === "kick" || memberAction === "ban") && !memberConfirmed)}
                        >
                          {memberActionBusy ? <Loader2 className="spin" size={16} /> : memberAction === "ban" ? <Ban size={16} /> : memberAction === "kick" ? <UserMinus size={16} /> : memberAction === "timeout_remove" ? <RotateCcw size={16} /> : <Clock3 size={16} />}
                          {selectedMemberActionLabel[memberAction]}
                        </button>
                        <button type="button" className="secondary-action inline" onClick={() => setMemberEditor(null)} disabled={memberActionBusy}>
                          <X size={16} /> Schließen
                        </button>
                      </div>
                    </article>
                  )}
                  {visibleMembers.map((member) => (
                    <article key={member.id} className="owner-detail-row member">
                      {member.avatar ? <img className="member-avatar" src={member.avatar} alt="" /> : <div className="member-avatar fallback">{member.displayName.slice(0, 2).toUpperCase()}</div>}
                      <div>
                        <strong>{member.displayName}</strong>
                        <small>{member.username} · {member.id}</small>
                      </div>
                      <div className="owner-detail-tags">
                        {member.bot && <span>Bot</span>}
                        {member.nick && <span>Nickname</span>}
                        <span>{member.roles.length} Rollen</span>
                        {member.communicationDisabledUntil && new Date(member.communicationDisabledUntil).getTime() > Date.now() && <span className="member-timeout-tag">Timeout aktiv</span>}
                        {member.joinedAt && <span>seit {formatDateTime(member.joinedAt)}</span>}
                        <button type="button" className="mini-text-button" title={member.manageBlockReason || "Mitglied moderieren"} onClick={() => setMemberEditor(member)}>
                          <Shield size={14} /> Verwalten
                        </button>
                      </div>
                    </article>
                  ))}
                  {data.limits.membersPartial && <p className="muted">Discord liefert hier aktuell die ersten {data.limits.membersShown} Mitglieder.</p>}
                  {visibleMembers.length === 0 && <p className="muted">Keine Mitglieder geladen oder keine Treffer.</p>}
                </div>
              )}

              {activeTab === "channels" && (
                <div className="owner-detail-list">
                  {channelEditor && (
                    <article className="owner-channel-editor">
                      <div className="owner-resource-editor-head">
                        <div className="owner-resource-identity">
                          <span className={`channel-symbol ${channelEditor.typeCode === 4 ? "category" : selectedChannelIsVoice ? "voice" : ""}`}>
                            {channelEditor.typeCode === 4 ? <Folder size={17} /> : selectedChannelIsVoice ? <Volume2 size={17} /> : <Hash size={17} />}
                          </span>
                          <div>
                            <h3>{channelEditor.name}</h3>
                            <p className="muted">{channelEditor.type} · {channelEditor.id}</p>
                          </div>
                        </div>
                        <div className="owner-member-state">
                          {channelEditor.specialUse && <span className="pill warn">{channelEditor.specialUse}</span>}
                          <span className={channelEditor.botCanManage ? "pill ok" : "pill danger"}>{channelEditor.botCanManage ? "Bot kann verwalten" : "Rechte fehlen"}</span>
                        </div>
                      </div>

                      {!channelEditor.botCanManage && <Notice tone="warning" text="Dem Bot fehlt die Discord-Berechtigung „Kanäle verwalten“." />}

                      <div className="form-grid owner-resource-basics">
                        <label>
                          {channelEditor.typeCode === 4 ? "Kategoriename" : "Kanalname"}
                          <input value={channelDraft.name} maxLength={100} onChange={(event) => setChannelDraft({ ...channelDraft, name: event.target.value })} />
                        </label>
                        {channelEditor.typeCode !== 4 && (
                          <label>
                            Kategorie
                            <select value={channelDraft.categoryId} onChange={(event) => setChannelDraft({ ...channelDraft, categoryId: event.target.value })}>
                              <option value="">Keine Kategorie</option>
                              {guildCategories.filter((category) => category.id !== channelEditor.id).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                            </select>
                          </label>
                        )}
                        {selectedChannelIsText && (
                          <label className="owner-channel-topic">
                            Kanalthema
                            <textarea value={channelDraft.topic} maxLength={1024} rows={3} placeholder="Optionales Thema oder kurze Kanalbeschreibung" onChange={(event) => setChannelDraft({ ...channelDraft, topic: event.target.value })} />
                            <small>{channelDraft.topic.length}/1024 Zeichen</small>
                          </label>
                        )}
                        {selectedChannelIsText && (
                          <label>
                            Slowmode in Sekunden
                            <input type="number" min={0} max={21600} value={channelDraft.slowmodeSeconds} onChange={(event) => setChannelDraft({ ...channelDraft, slowmodeSeconds: event.target.value })} />
                          </label>
                        )}
                        {selectedChannelIsText && (
                          <label className="toggle">
                            <input type="checkbox" checked={channelDraft.nsfw} onChange={(event) => setChannelDraft({ ...channelDraft, nsfw: event.target.checked })} />
                            Altersbeschränkter Kanal (NSFW)
                          </label>
                        )}
                        {selectedChannelIsVoice && (
                          <label>
                            Bitrate in kbit/s
                            <input type="number" min={8} max={384} value={channelDraft.bitrateKbps} onChange={(event) => setChannelDraft({ ...channelDraft, bitrateKbps: event.target.value })} />
                          </label>
                        )}
                        {selectedChannelIsVoice && (
                          <label>
                            Nutzerlimit
                            <input type="number" min={0} max={99} value={channelDraft.userLimit} onChange={(event) => setChannelDraft({ ...channelDraft, userLimit: event.target.value })} />
                          </label>
                        )}
                      </div>

                      {channelEditor.typeCode === 4 && (
                        <Notice tone="warning" text={`${data.channels.filter((channel) => channel.categoryId === channelEditor.id).length} Kanal/Kanäle liegen in dieser Kategorie. Beim Löschen bleiben sie bestehen und werden nicht mehr kategorisiert.`} />
                      )}
                      {channelEditor.specialUse && <Notice tone="warning" text={`Dieser Kanal wird von Discord als ${channelEditor.specialUse} verwendet. Prüfe die Servereinstellungen vor dem Löschen.`} />}

                      <label className="owner-member-confirm">
                        <input type="checkbox" checked={channelDeleteConfirmed} onChange={(event) => setChannelDeleteConfirmed(event.target.checked)} disabled={!channelEditor.botCanManage} />
                        <span>Ich bestätige, dass {channelEditor.typeCode === 4 ? "diese Kategorie" : "dieser Kanal"} endgültig gelöscht werden darf.</span>
                      </label>
                      <ActionStatus status={channelStatus} />
                      <div className="form-actions">
                        <button type="button" className="primary-action inline" onClick={saveChannel} disabled={channelSaving || !channelEditor.botCanManage}>
                          {channelSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                          Speichern
                        </button>
                        <button type="button" className="danger-action inline" onClick={deleteChannel} disabled={channelSaving || !channelEditor.botCanManage || !channelDeleteConfirmed}>
                          <Trash2 size={16} /> {channelEditor.typeCode === 4 ? "Kategorie löschen" : "Kanal löschen"}
                        </button>
                        <button type="button" className="secondary-action inline" onClick={() => setChannelEditor(null)} disabled={channelSaving}>
                          <X size={16} /> Schließen
                        </button>
                      </div>
                    </article>
                  )}
                  {visibleChannels.map((channel) => (
                    <article key={channel.id} className="owner-detail-row">
                      <span className={`channel-symbol ${channel.typeCode === 4 ? "category" : [2, 13].includes(channel.typeCode) ? "voice" : ""}`}>
                        {channel.typeCode === 4 ? <Folder size={17} /> : [2, 13].includes(channel.typeCode) ? <Volume2 size={17} /> : <Hash size={17} />}
                      </span>
                      <div>
                        <strong>{channel.name}</strong>
                        <small>{channel.id}{channel.categoryName ? ` · ${channel.categoryName}` : ""}</small>
                      </div>
                      <div className="owner-detail-tags">
                        <span>{channel.type}</span>
                        <span>Position {channel.position}</span>
                        {channel.specialUse && <span>{channel.specialUse}</span>}
                        {channel.canSend !== null && <span>{channel.canSend ? "sendbar" : "nicht sendbar"}</span>}
                        <button type="button" className="mini-text-button" onClick={() => setChannelEditor(channel)} title="Kanal oder Kategorie verwalten">
                          <Pencil size={14} /> Verwalten
                        </button>
                      </div>
                    </article>
                  ))}
                  {visibleChannels.length === 0 && <p className="muted">Kein Kanal gefunden.</p>}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function GuildIcon({ guild }: { guild: { name: string; icon: string | null } }) {
  if (guild.icon) return <img className="guild-icon" src={guild.icon} alt="" />;
  return <div className="guild-icon fallback">{guild.name.slice(0, 2).toUpperCase()}</div>;
}

function Dashboard({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const guildId = parts[1];
  const demoMode = guildId === DEMO_GUILD_ID;
  const section = parts[2] ?? "overview";
  const plannedSection = getPlannedSection(section);
  const featureDefinition = getFeatureDefinition(section);
  const me = useApi<{ user: User }>("/api/me", []);
  const detail = useApi<{ guild: GuildDetail; settings: SettingsRow }>(`/api/guilds/${guildId}`, [guildId]);

  if (detail.error?.includes("noch nicht installiert")) {
    return (
      <div className="app-shell">
        <TopNav user={me.data?.user} />
        <main className="content narrow">
          <Notice tone="warning" text="Der Bot ist auf dieser Guild noch nicht bestätigt. Nach der Einladung aktualisiert der laufende Bot diesen Status." />
          <a
            className="primary-action inline"
            href={`/api/bot/invite?guildId=${guildId}&returnTo=${encodeURIComponent(`/dashboard/${guildId}/overview`)}`}
            target="_blank"
            rel="noreferrer"
          >
            <Plus size={16} />
            Bot einladen
          </a>
        </main>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} demoMode={demoMode} />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <div className="sidebar-head">
            <div className="sidebar-product"><SlidersHorizontal size={17} /><span>Serververwaltung</span></div>
            <GuildSwitcher currentGuild={detail.data?.guild ?? null} currentGuildId={guildId} demoMode={demoMode} />
          </div>
          <nav className="sidebar-navigation" aria-label="Guild-Kategorien">
            <SidebarGroup label="Start" tone="blue">
              <SideLink icon={<LayoutDashboard size={17} />} label="Übersicht" section="overview" current={section} guildId={guildId} />
              <SideLink icon={<Bot size={17} />} label="Bot-Profil" section="profile" current={section} guildId={guildId} />
            </SidebarGroup>
            <SidebarGroup label="Community" tone="green">
              <SideLink icon={<Sparkles size={17} />} label="Begrüßung" section="welcome" current={section} guildId={guildId} />
              <SideLink icon={<UserPlus size={17} />} label="Autorole" section="autorole" current={section} guildId={guildId} />
              <SideLink icon={<BarChart3 size={17} />} label="Level-System" section="level-system" current={section} guildId={guildId} />
              <SideLink icon={<ListOrdered size={17} />} label="Counting" section="counting" current={section} guildId={guildId} />
              <SideLink icon={<Trophy size={17} />} label="Giveaways" section="giveaways" current={section} guildId={guildId} />
              <SideLink icon={<BadgeCheck size={17} />} label="Reaction Roles" section="reaction-roles" current={section} guildId={guildId} />
              <SideLink icon={<MessageSquare size={17} />} label="Vorschläge" section="suggestions" current={section} guildId={guildId} />
              <SideLink icon={<Star size={17} />} label="Starboard" section="starboard" current={section} guildId={guildId} />
              <SideLink icon={<Sparkles size={17} />} label="Geburtstage" section="birthdays" current={section} guildId={guildId} />
              <SideLink icon={<Crown size={17} />} label="Badges" section="badges" current={section} guildId={guildId} />
              <SideLink icon={<UsersRound size={17} />} label="Community Tools" section="community-tools" current={section} guildId={guildId} />
              <SideLink icon={<LifeBuoy size={17} />} label="Ticket-System" section="tickets" current={section} guildId={guildId} />
            </SidebarGroup>
            <SidebarGroup label="Automatisierung" tone="violet">
              <SideLink icon={<Clock3 size={17} />} label="Automationen" section="automations" current={section} guildId={guildId} />
              <SideLink icon={<AtSign size={17} />} label="Auto-Nickname" section="auto-nickname" current={section} guildId={guildId} />
              <SideLink icon={<ClipboardList size={17} />} label="Bewerbungen" section="applications" current={section} guildId={guildId} />
              <SideLink icon={<BarChart3 size={17} />} label="Server-Statistiken" section="server-stats" current={section} guildId={guildId} />
              <SideLink icon={<Command size={17} />} label="Slash-Befehle" section="commands" current={section} guildId={guildId} />
              <SideLink icon={<ClipboardList size={17} />} label="Custom Commands" section="custom-commands" current={section} guildId={guildId} />
              <SideLink icon={<ListFilter size={17} />} label="Logging" section="logging" current={section} guildId={guildId} />
              <SideLink icon={<ShieldCheck size={17} />} label="Audit-Log" section="audit-log" current={section} guildId={guildId} />
            </SidebarGroup>
            <SidebarGroup label="Voice & Unterhaltung" tone="amber">
              <SideLink icon={<Mic2 size={17} />} label="Temp-Voice" section="temp-voice" current={section} guildId={guildId} />
              <SideLink icon={<Youtube size={17} />} label="YouTube Music" section="youtube-music" current={section} guildId={guildId} />
              <SideLink icon={<Gamepad2 size={17} />} label="Games" section="games" current={section} guildId={guildId} />
              <SideLink icon={<Server size={17} />} label="Minecraft" section="minecraft" current={section} guildId={guildId} />
            </SidebarGroup>
            <SidebarGroup label="Sicherheit" tone="red">
              <SideLink icon={<ShieldCheck size={17} />} label="Security Center" section="security" current={section} guildId={guildId} />
              <SideLink icon={<AlertTriangle size={17} />} label="Raidmode" section="raidmode" current={section} guildId={guildId} />
              <SideLink icon={<Shield size={17} />} label="Moderation" section="moderation-center" current={section} guildId={guildId} />
              <SideLink icon={<UserPlus size={17} />} label="Onboarding" section="onboarding" current={section} guildId={guildId} />
              <SideLink icon={<Database size={17} />} label="Backups" section="backups" current={section} guildId={guildId} />
              <SideLink icon={<AlertTriangle size={17} />} label="Gefahrenbereich" section="danger-zone" current={section} guildId={guildId} badge="geplant" />
            </SidebarGroup>
          </nav>
          <button className="sidebar-account" onClick={() => navigate(demoMode ? "/" : "/panel")} title={demoMode ? "Demo beenden" : "Zur Serverauswahl"}>
            <span className="sidebar-account-avatar">
              {me.data?.user.avatar ? <img src={me.data.user.avatar} alt="" /> : <UserRound size={17} />}
            </span>
            <span>
              <strong>{me.data?.user.displayName || me.data?.user.username || "Account"}</strong>
              <small>{demoMode ? "Demo beenden" : "Server wechseln"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </aside>
        <main className="dashboard-main">
          {detail.loading && !detail.data && <LoadingBlock />}
          {detail.error && <Notice tone="danger" text={detail.error} />}
          {detail.data && (
            <>
              <div className="guild-heading">
                <GuildIcon guild={detail.data.guild} />
                <div>
                  <h1>{detail.data.guild.name}</h1>
                  <p>{detail.data.guild.id}</p>
                </div>
                <div className="guild-heading-actions">
                  <span className="pill ok">{detail.data.guild.permission}</span>
                  <span className="pill live">
                    <Activity size={13} />
                    Verbunden
                  </span>
                  <RefreshButton loading={detail.loading} onClick={detail.reload} />
                </div>
              </div>
              {demoMode && (
                <section className="demo-mode-banner" role="status">
                  <span className="demo-mode-banner-icon"><Eye size={20} /></span>
                  <div>
                    <strong>Interaktive Guild-Demo</strong>
                    <p>Alle Kategorien enthalten Beispieldaten. Änderungen und Bot-Aktionen sind in dieser Vorschau gesperrt.</p>
                  </div>
                  <span className="pill neutral"><ShieldCheck size={13} /> Schreibgeschützt</span>
                </section>
              )}
              <fieldset className={`dashboard-page-frame ${demoMode ? "demo-readonly" : ""}`} disabled={demoMode}>
                {section === "overview" && <OverviewPage guildId={guildId} initial={detail.data} />}
                {section === "profile" && <ProfilePage guildId={guildId} settings={detail.data.settings} onSaved={detail.reload} />}
                {section === "commands" && <CommandsPage guildId={guildId} />}
                {section === "custom-commands" && <CustomCommandsPage guildId={guildId} />}
                {section === "logging" && <LoggingPage guildId={guildId} />}
                {section === "audit-log" && <AuditLogPage guildId={guildId} />}
                {section === "welcome" && <WelcomePage guildId={guildId} />}
                {section === "temp-voice" && <TempVoicePage guildId={guildId} />}
                {section === "counting" && <CountingPage guildId={guildId} />}
                {section === "level-system" && <LevelSystemPage guildId={guildId} />}
                {section === "autorole" && <AutorolePage guildId={guildId} />}
                {section === "security" && <SecurityPage guildId={guildId} />}
                {section === "raidmode" && <RaidmodePage guildId={guildId} />}
                {section === "tickets" && <TicketSystemPage guildId={guildId} />}
                {section === "backups" && <BackupsPage guildId={guildId} />}
                {featureDefinition && <FeatureModulePage guildId={guildId} definition={featureDefinition} />}
                {plannedSection && !featureDefinition && section !== "welcome" && section !== "logging" && section !== "temp-voice" && section !== "counting" && section !== "level-system" && section !== "autorole" && <PlannedPage section={plannedSection} />}
              </fieldset>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function GuildSwitcher({
  currentGuild,
  currentGuildId,
  demoMode = false
}: {
  currentGuild: GuildDetail | null;
  currentGuildId: string;
  demoMode?: boolean;
}) {
  return (
    <div className="guild-switcher">
      <span>Aktiver Server</span>
      <button className="guild-switcher-button" onClick={() => navigate(demoMode ? "/" : "/panel")}>
        <GuildIcon guild={{ name: currentGuild?.name ?? "Guild", icon: currentGuild?.icon ?? null }} />
        <span className="guild-switcher-copy">
          <strong>{currentGuild?.name ?? currentGuildId}</strong>
          <small>{demoMode ? "Schreibgeschützte Vorschau" : currentGuild ? currentGuildId : "Serverdaten werden geladen"}</small>
        </span>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

function SidebarGroup({
  label,
  tone,
  children
}: {
  label: string;
  tone: "blue" | "green" | "violet" | "amber" | "red";
  children: React.ReactNode;
}) {
  return (
    <section className={`sidebar-section ${tone}`}>
      <div className="sidebar-group-title"><span />{label}</div>
      <div className="sidebar-section-links">{children}</div>
    </section>
  );
}

function SideLink({
  icon,
  label,
  section,
  current,
  guildId,
  badge
}: {
  icon: React.ReactNode;
  label: string;
  section: string;
  current: string;
  guildId: string;
  badge?: string;
}) {
  return (
    <button className={`side-link ${current === section ? "active" : ""}`} onClick={() => navigate(`/dashboard/${guildId}/${section}`)}>
      {icon}
      <span className="side-link-label">{label}</span>
      {badge && <span className="side-badge">{badge}</span>}
    </button>
  );
}

function OverviewPage({ guildId, initial }: { guildId: string; initial: { guild: GuildDetail; settings: SettingsRow } }) {
  const [locale, setLocale] = useState(initial.settings.locale);
  const [timezone, setTimezone] = useState(initial.settings.timezone ?? "Europe/Berlin");
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/settings`, {
        method: "PATCH",
        body: JSON.stringify({ locale, timezone })
      });
      setStatus("Gespeichert.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section-grid">
      <div className="overview-tiles wide">
        <StatusTile icon={<Bot size={19} />} label="Bot" value={initial.guild.botInstalled ? "Installiert" : "Fehlt"} tone={initial.guild.botInstalled ? "ok" : "warn"} />
        <StatusTile icon={<Gauge size={19} />} label="Sprache" value={locale === "de" ? "Deutsch" : "English"} />
        <StatusTile icon={<Shield size={19} />} label="Isolation" value="Guild-only" tone="ok" />
        <StatusTile icon={<BarChart3 size={19} />} label="Sync" value={initial.settings.bot_avatar_sync_status} />
      </div>
      <div className="panel">
        <div className="panel-title">
          <h2>Status</h2>
          <span className="pill ok">Guild isoliert</span>
        </div>
        <dl className="facts">
          <div>
            <dt>Bot</dt>
            <dd>{initial.guild.botInstalled ? "Installiert" : "Nicht installiert"}</dd>
          </div>
          <div>
            <dt>Sprache</dt>
            <dd>{locale === "de" ? "Deutsch" : "English"}</dd>
          </div>
          <div>
            <dt>Zeitzone</dt>
            <dd>{timezone}</dd>
          </div>
        </dl>
      </div>
      <div className="panel">
        <div className="panel-title">
          <h2>Guild-Einstellungen</h2>
        </div>
        <div className="form-grid">
          <label>
            Sprache
            <select value={locale} onChange={(event) => setLocale(event.target.value)}>
              <option value="de">Deutsch</option>
              <option value="en">English</option>
            </select>
          </label>
          <label>
            Zeitzone
            <input value={timezone} onChange={(event) => setTimezone(event.target.value)} />
          </label>
        </div>
        <ActionStatus status={status} />
        <div className="form-actions">
          <button className="primary-action inline" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Speichern
          </button>
        </div>
      </div>
    </section>
  );
}

function StatusTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`status-tile ${tone ?? ""}`}>
      <span>{icon}</span>
      <small>{label}</small>
      <strong>{value}</strong>
    </div>
  );
}

function ProfilePage({ guildId, settings, onSaved }: { guildId: string; settings: SettingsRow; onSaved: () => void | Promise<void> }) {
  const [nickname, setNickname] = useState(settings.bot_nickname ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nicknameStatus, setNicknameStatus] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<string | null>(null);
  const [savingNickname, setSavingNickname] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const storedAvatarUrl = settings.bot_avatar_media_key
    ? `/api/guilds/${guildId}/media?key=${encodeURIComponent(settings.bot_avatar_media_key)}`
    : null;
  const displayedAvatarUrl = previewUrl ?? storedAvatarUrl;
  const syncLabel = settings.bot_avatar_sync_status === "synced"
    ? "Synchronisiert"
    : settings.bot_avatar_sync_status === "pending"
      ? "Wird synchronisiert"
      : settings.bot_avatar_sync_status === "failed"
        ? "Synchronisierung fehlgeschlagen"
        : "Standard-Avatar";

  useEffect(() => {
    setNickname(settings.bot_nickname ?? "");
  }, [settings.bot_nickname]);

  useEffect(() => {
    if (settings.bot_avatar_sync_status !== "pending") return;
    const timer = window.setInterval(() => void onSaved(), 2500);
    return () => window.clearInterval(timer);
    // onSaved is the current guild loader and does not change the requested resource.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId, settings.bot_avatar_sync_status]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  function selectAvatar(nextFile: File | null) {
    setAvatarStatus(null);

    if (!nextFile) {
      setFile(null);
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

    if (!allowedTypes.has(nextFile.type)) {
      setFile(null);
      setFileInputKey((value) => value + 1);
      setAvatarStatus("Erlaubt sind PNG, JPEG, GIF und WebP.");
      return;
    }

    if (nextFile.size > 512 * 1024) {
      setFile(null);
      setFileInputKey((value) => value + 1);
      setAvatarStatus("Das Profilbild darf maximal 512 KiB groß sein.");
      return;
    }

    setFile(nextFile);
  }

  async function saveNickname() {
    setSavingNickname(true);
    setNicknameStatus(null);
    try {
      await api(`/api/guilds/${guildId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({ nickname })
      });
      setNicknameStatus("Nickname-Änderung wurde an den Bot übergeben.");
      await onSaved();
    } catch (error) {
      setNicknameStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSavingNickname(false);
    }
  }

  async function uploadAvatar() {
    if (!file) return;
    setAvatarBusy(true);
    setAvatarStatus(null);
    const formData = new FormData();
    formData.set("avatar", file);
    try {
      await api(`/api/guilds/${guildId}/profile/avatar`, {
        method: "POST",
        body: formData
      });
      setAvatarStatus("Profilbild gespeichert. Der Bot übernimmt es jetzt auf dieser Guild.");
      setFile(null);
      setFileInputKey((value) => value + 1);
      await onSaved();
    } catch (error) {
      setAvatarStatus(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setAvatarBusy(false);
    }
  }

  async function resetAvatar() {
    setAvatarBusy(true);
    setAvatarStatus(null);
    try {
      await api(`/api/guilds/${guildId}/profile/avatar`, { method: "DELETE" });
      setFile(null);
      setFileInputKey((value) => value + 1);
      setAvatarStatus("Der Server-Avatar wird auf das normale Bot-Profilbild zurückgesetzt.");
      await onSaved();
    } catch (error) {
      setAvatarStatus(error instanceof Error ? error.message : "Zurücksetzen fehlgeschlagen.");
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <section className="section-grid">
      <div className="panel">
        <div className="panel-title">
          <h2>Bot-Nickname</h2>
          <span className="pill">max. 32 Zeichen</span>
        </div>
        <label>
          Nickname auf dieser Guild
          <input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} placeholder="Leer lassen zum Zurücksetzen" />
        </label>
        <ActionStatus status={nicknameStatus} />
        <div className="form-actions">
          <button className="primary-action inline" onClick={saveNickname} disabled={savingNickname}>
            {savingNickname ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Nickname speichern
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Server-Avatar</h2>
          <span className={settings.bot_avatar_sync_status === "failed" ? "pill danger" : settings.bot_avatar_sync_status === "synced" ? "pill ok" : "pill"}>
            {syncLabel}
          </span>
        </div>
        <div className="avatar-editor">
          <div className="avatar-preview" aria-label="Vorschau des Server-Avatars">
            {displayedAvatarUrl ? <img src={displayedAvatarUrl} alt="Server-Avatar Vorschau" /> : <Bot size={34} />}
            {file && <span>Vorschau</span>}
          </div>
          <div className="avatar-editor-copy">
            <strong>{file ? file.name : settings.bot_avatar_media_key ? "Aktuelles eigenes Profilbild" : "Normales Bot-Profilbild"}</strong>
            <p>PNG, JPEG, GIF oder WebP bis 512 KiB. Das Bild gilt nur für diese Guild.</p>
            {file && <small>{Math.round(file.size / 1024)} KiB ausgewählt</small>}
            <div className="form-actions avatar-actions">
              <label className="secondary-action inline avatar-file-button">
                <Upload size={16} />
                Bild auswählen
                <input
                  key={fileInputKey}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={(event) => selectAvatar(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="primary-action inline" onClick={uploadAvatar} disabled={!file || avatarBusy}>
                {avatarBusy && file ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                Übernehmen
              </button>
              <button className="secondary-action inline" onClick={resetAvatar} disabled={avatarBusy || (!storedAvatarUrl && !file)}>
                {avatarBusy && !file ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />}
                Zurücksetzen
              </button>
            </div>
          </div>
        </div>
        <ActionStatus status={avatarStatus} />
        {settings.bot_avatar_sync_error && <Notice tone="danger" text={settings.bot_avatar_sync_error} />}
      </div>
    </section>
  );
}

const DEFAULT_WELCOME_DRAFT: WelcomeSettings = {
  enabled: false,
  channelId: null,
  message: "Willkommen {member_mention}! Schön, dass du auf **{server}** bist.",
  autoRoleId: null,
  embed: {
    useEmbed: true,
    title: "Willkommen auf {server}",
    description: "{member_mention}, mach es dir gemütlich. Du bist unser **{member_count}. Mitglied**.",
    color: "#4DDB8F",
    imageMode: "banner",
    imageMediaKey: null,
    imageUrl: null,
    mentionMember: true,
    allowEveryone: false,
    allowedRoleIds: [],
    showGeneratedCard: true
  }
};

function replaceTemplateTokens(value: string) {
  const replacements: Record<string, string> = {
    "{member}": "Niteacfort74",
    "{member_name}": "Niteacfort74",
    "{member_mention}": "@Niteacfort74",
    "{server}": "Modmail Manager Community",
    "{member_count}": "128",
    "{account_created}": "vor 2 Jahren",
    "{joined_at}": "gerade eben"
  };

  return Object.entries(replacements).reduce((text, [token, replacement]) => text.split(token).join(replacement), value);
}

function roleColor(role: RoleOption) {
  return role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#7b8494";
}

function defaultLoggingSettings(): LoggingSettings {
  const channelMappings = Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, null])) as Record<LogCategory, string | null>;
  const events = Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, true])) as Record<LogCategory, boolean>;
  return { enabled: false, channelMappings, events };
}

const DEFAULT_TEMP_VOICE_DRAFT: TempVoiceSettings = {
  enabled: false,
  creatorChannelIds: [],
  categoryId: null,
  interfaceChannelId: null,
  nameTemplate: "{user}s Raum",
  defaultUserLimit: 0,
  defaultBitrateKbps: 64,
  panelChannelId: null,
  panelMessageId: null,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_COUNTING_DRAFT: CountingSettings = {
  enabled: false,
  channelId: null,
  resetOnError: true,
  deleteWrongMessages: false,
  milestoneInterval: 100,
  currentNumber: 0,
  recordNumber: 0,
  totalCounts: 0,
  totalFailures: 0,
  lastUserId: null,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_LEVEL_DRAFT: LevelSettings = {
  enabled: true,
  announcementChannelId: null,
  roleRewards: [],
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_AUTOROLE_DRAFT: AutoroleSettings = {
  enabled: false,
  humanRoleIds: [],
  botRoleIds: [],
  delaySeconds: 0,
  waitForScreening: true,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_SECURITY_DRAFT: SecuritySettings = {
  antispamEnabled: false,
  antispamMessageLimit: 5,
  antispamWindowSeconds: 8,
  antispamTimeoutSeconds: 60,
  antilinkEnabled: false,
  antilinkTimeoutSeconds: 0,
  antiinviteEnabled: false,
  antiinviteTimeoutSeconds: 60,
  antimentionLimit: 0,
  antimentionTimeoutSeconds: 60,
  accountAgeMinDays: 0,
  quarantineRoleId: null,
  verificationEnabled: false,
  verificationChannelId: null,
  verificationRoleId: null,
  verificationTitle: "Verifizierung",
  verificationText: "Klicke auf den Button, um dich zu verifizieren.",
  auditLogWatchEnabled: false,
  antinukeEnabled: false,
  antinukeLimit: 3,
  antinukeWindowSeconds: 60,
  antinukePunishment: "log",
  allowedDomains: [],
  blockedDomains: [],
  healthScore: 0,
  activeProtections: 0,
  totalProtections: 8,
  botCanManageRoles: false,
  botCanViewAuditLog: false,
  verificationMessageId: null,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_RAID_DRAFT: RaidSettings = {
  profile: "off",
  panicEnabled: false,
  panicSlowmodeSeconds: 10,
  raidmodeEnabled: false,
  memberCount: 0,
  textChannelCount: 0,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_TICKET_DRAFT: TicketSettings = {
  enabled: false,
  ticketCategoryId: null,
  panelChannelId: null,
  logChannelId: null,
  supportRoleIds: [],
  notifyRoleId: null,
  panelTitle: "Ticketsystem",
  panelDescription: "Wähle unten eine Kategorie aus, um ein Ticket zu erstellen.",
  formTitle: "Ticket-Fragen",
  formQuestions: [],
  selectCategories: [
    { label: "Support", description: "Allgemeine Hilfe und Fragen", emoji: "🎫", value: "support" },
    { label: "Technik", description: "Technische Probleme melden", emoji: "🛠️", value: "technik" },
    { label: "Sonstiges", description: "Andere Anliegen", emoji: "💬", value: "sonstiges" }
  ],
  ratingEnabled: false,
  autoCloseHours: 0,
  reminderHours: 0,
  slaHours: 0,
  blacklistRoleIds: [],
  blacklistUserIds: [],
  totalTickets: 0,
  openTickets: 0,
  closedTickets: 0,
  deletedTickets: 0,
  averageRating: null,
  panelMessageId: null,
  syncStatus: "idle",
  syncError: null
};

const DEFAULT_BACKUP_DRAFT: BackupSettings = {
  items: [],
  lastSavedAt: null,
  guildRoleCount: 0,
  guildChannelCount: 0,
  syncStatus: "idle",
  syncError: null
};

function AutorolePage({ guildId }: { guildId: string }) {
  const settings = useApi<{ autorole: AutoroleSettings }>(`/api/guilds/${guildId}/autorole`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState<AutoroleSettings>(DEFAULT_AUTOROLE_DRAFT);
  const [target, setTarget] = useState<"human" | "bot">("human");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.autorole) setDraft(settings.data.autorole);
  }, [settings.data]);

  const manageableRoles = useMemo(
    () => (roles.data?.roles ?? []).filter((role) => Boolean(role.botCanManage) && !Boolean(role.managed)),
    [roles.data]
  );
  const selectedIds = target === "human" ? draft.humanRoleIds : draft.botRoleIds;
  const filteredRoles = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("de-DE");
    if (!needle) return manageableRoles;
    return manageableRoles.filter((role) => role.name.toLocaleLowerCase("de-DE").includes(needle) || role.id.includes(needle));
  }, [manageableRoles, query]);
  const loading = (settings.loading && !settings.data) || (roles.loading && !roles.data);
  const loadError = settings.error || roles.error;
  const hasRoles = draft.humanRoleIds.length + draft.botRoleIds.length > 0;

  async function persist(nextDraft: AutoroleSettings = draft): Promise<boolean> {
    if (nextDraft.enabled && nextDraft.humanRoleIds.length === 0 && nextDraft.botRoleIds.length === 0) {
      setStatus("Wähle mindestens eine Mitglieder- oder Botrolle aus.");
      return false;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ autorole: AutoroleSettings }>(`/api/guilds/${guildId}/autorole`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: nextDraft.enabled,
          humanRoleIds: nextDraft.humanRoleIds,
          botRoleIds: nextDraft.botRoleIds,
          delaySeconds: nextDraft.delaySeconds,
          waitForScreening: nextDraft.waitForScreening
        })
      });
      setDraft(response.autorole);
      setStatus("Autorole gespeichert. Der Bot übernimmt die Regeln jetzt.");
      await settings.reload();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Autorole konnte nicht gespeichert werden.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateEnabled(enabled: boolean) {
    const previousDraft = draft;
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);

    if (enabled && !hasRoles) {
      setStatus("Autorole ist vorbereitet. Wähle jetzt mindestens eine Rolle und speichere die Einstellungen.");
      return;
    }

    const saved = await persist(nextDraft);
    if (!saved) setDraft(previousDraft);
  }

  function toggleRole(roleId: string) {
    const key = target === "human" ? "humanRoleIds" : "botRoleIds";
    const current = draft[key];
    if (!current.includes(roleId) && current.length >= 25) {
      setStatus(`Für ${target === "human" ? "Mitglieder" : "Bots"} können höchstens 25 Rollen ausgewählt werden.`);
      return;
    }
    setDraft({
      ...draft,
      [key]: current.includes(roleId) ? current.filter((id) => id !== roleId) : [...current, roleId]
    });
    setStatus("Auswahl geändert. Speichere die Einstellungen, um sie an den Bot zu senden.");
  }

  function selectedRoles(ids: string[]) {
    return ids.map((id) => manageableRoles.find((role) => role.id === id)).filter((role): role is RoleOption => Boolean(role));
  }

  const humanRoles = selectedRoles(draft.humanRoleIds);
  const botRoles = selectedRoles(draft.botRoleIds);

  return (
    <section className="autorole-page">
      <div className="autorole-hero">
        <div>
          <p className="eyebrow"><UserPlus size={15} /> Member Onboarding</p>
          <h2>Autorole</h2>
          <p>Vergib mehrere Rollen automatisch, mit eigenen Regeln für Mitglieder und neu hinzugefügte Bots.</p>
        </div>
        <div className="autorole-hero-actions">
          <span className={`pill ${draft.syncStatus === "failed" ? "danger" : draft.syncStatus === "synced" ? "ok" : "neutral"}`}>
            {draft.syncStatus === "failed" ? "Sync fehlgeschlagen" : draft.syncStatus === "pending" ? "Wird synchronisiert" : draft.syncStatus === "synced" ? "Synchronisiert" : "Bereit"}
          </span>
          <label className="welcome-switch">
            <input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => void updateEnabled(event.target.checked)} />
            <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
          </label>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />

      {!loading && !loadError && !draft.enabled && (
        <div className="autorole-inactive">
          <div className="autorole-inactive-icon"><ShieldCheck size={22} /></div>
          <div>
            <strong>Autorole ist ausgeschaltet</strong>
            <p>Aktiviere das Modul oben. Bestehende Rollenauswahlen bleiben beim Deaktivieren erhalten.</p>
          </div>
        </div>
      )}

      {!loading && !loadError && draft.enabled && (
        <>
          <section className="autorole-summary-grid">
            <StatusTile icon={<UsersRound size={19} />} label="Mitgliederrollen" value={String(draft.humanRoleIds.length)} tone={draft.humanRoleIds.length ? "ok" : undefined} />
            <StatusTile icon={<Bot size={19} />} label="Botrollen" value={String(draft.botRoleIds.length)} tone={draft.botRoleIds.length ? "ok" : undefined} />
            <StatusTile icon={<Clock3 size={19} />} label="Verzögerung" value={draft.delaySeconds ? `${draft.delaySeconds} Sek.` : "Sofort"} />
            <StatusTile icon={<ShieldCheck size={19} />} label="Screening" value={draft.waitForScreening ? "Abwarten" : "Direkt"} tone={draft.waitForScreening ? "ok" : undefined} />
          </section>

          <div className="autorole-layout">
            <div className="autorole-editor">
              <section className="panel autorole-role-panel">
                <div className="panel-title autorole-panel-title">
                  <div>
                    <h2>Automatische Rollen</h2>
                    <p className="muted">Nur Rollen unterhalb der höchsten Bot-Rolle stehen zur Auswahl.</p>
                  </div>
                  <RefreshButton
                    loading={(settings.loading && Boolean(settings.data)) || (roles.loading && Boolean(roles.data))}
                    onClick={async () => { await Promise.all([settings.reload(), roles.reload()]); }}
                    label="Neu laden"
                  />
                </div>

                <div className="autorole-target-tabs" aria-label="Autorole-Ziel auswählen">
                  <button className={target === "human" ? "active" : ""} onClick={() => setTarget("human")}>
                    <UsersRound size={16} /> Mitglieder <span>{draft.humanRoleIds.length}</span>
                  </button>
                  <button className={target === "bot" ? "active" : ""} onClick={() => setTarget("bot")}>
                    <Bot size={16} /> Bots <span>{draft.botRoleIds.length}</span>
                  </button>
                </div>

                {selectedIds.length > 0 && (
                  <div className="autorole-selected-list">
                    <span>Ausgewählt</span>
                    <div>
                      {selectedIds.map((roleId) => {
                        const role = manageableRoles.find((entry) => entry.id === roleId);
                        return (
                          <button type="button" onClick={() => toggleRole(roleId)} key={roleId} title="Rolle entfernen">
                            <i style={{ background: role ? roleColor(role) : "#7b8494" }} />
                            {role?.name ?? `Nicht verfügbare Rolle (${roleId})`}
                            <X size={14} />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <label className="autorole-search">
                  <Search size={17} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rolle suchen" />
                </label>

                <div className="autorole-role-list">
                  {filteredRoles.length === 0 && (
                    <div className="autorole-empty"><Search size={20} /><span>Keine verwaltbare Rolle gefunden.</span></div>
                  )}
                  {filteredRoles.map((role) => {
                    const selected = selectedIds.includes(role.id);
                    return (
                      <button type="button" className={selected ? "selected" : ""} onClick={() => toggleRole(role.id)} key={role.id}>
                        <i style={{ background: roleColor(role) }} />
                        <span><strong>{role.name}</strong><small>{role.id}</small></span>
                        <span className="autorole-check">{selected ? <Check size={16} /> : <Plus size={16} />}</span>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="panel autorole-rules-panel">
                <div className="panel-title compact">
                  <div><h2>Vergaberegeln</h2><p className="muted">Timing und Discord-Onboarding zentral festlegen.</p></div>
                </div>
                <label>
                  Verzögerung nach Beitritt
                  <div className="autorole-delay-input">
                    <input
                      type="number"
                      min={0}
                      max={3600}
                      value={draft.delaySeconds}
                      onChange={(event) => setDraft({ ...draft, delaySeconds: Math.max(0, Math.min(3600, Number(event.target.value) || 0)) })}
                    />
                    <span>Sekunden</span>
                  </div>
                  <small>0 vergibt die Rollen sofort. Möglich sind bis zu 60 Minuten.</small>
                </label>
                <label className="autorole-rule-toggle">
                  <span><strong>Membership-Screening abwarten</strong><small>Der Bot vergibt Rollen erst, nachdem das neue Mitglied die Serverregeln akzeptiert hat.</small></span>
                  <input type="checkbox" checked={draft.waitForScreening} onChange={(event) => setDraft({ ...draft, waitForScreening: event.target.checked })} />
                </label>
              </section>

              <section className="panel autorole-save-panel">
                <div><strong>{draft.humanRoleIds.length + draft.botRoleIds.length} Rollen ausgewählt</strong><small>Die sichere Sync-Queue überträgt alle Regeln an den laufenden Bot.</small></div>
                <button className="primary-action inline" onClick={() => void persist()} disabled={saving || !hasRoles}>
                  {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                  Einstellungen speichern
                </button>
              </section>
            </div>

            <aside className="autorole-preview">
              <div className="autorole-preview-heading">
                <div><span>Vergabe-Vorschau</span><h2>Neue Mitglieder</h2></div>
                <span className="pill ok">Automatisch</span>
              </div>
              <div className="autorole-preview-person">
                <div className="autorole-preview-avatar"><UserRound size={22} /></div>
                <div><strong>Neues Mitglied</strong><small>gerade beigetreten</small></div>
                <BadgeCheck size={18} />
              </div>
              <div className="autorole-preview-group">
                <span>Mitglieder erhalten</span>
                <div className="autorole-role-chips">
                  {humanRoles.length ? humanRoles.map((role) => <span key={role.id}><i style={{ background: roleColor(role) }} />{role.name}</span>) : <small>Keine Mitgliederrollen ausgewählt</small>}
                </div>
              </div>
              <div className="autorole-preview-group">
                <span>Bots erhalten</span>
                <div className="autorole-role-chips">
                  {botRoles.length ? botRoles.map((role) => <span key={role.id}><i style={{ background: roleColor(role) }} />{role.name}</span>) : <small>Keine Botrollen ausgewählt</small>}
                </div>
              </div>
              <div className="autorole-safety-list">
                <span><ShieldCheck size={15} /> Rollenhierarchie vorab geprüft</span>
                <span><Clock3 size={15} /> {draft.delaySeconds ? `${draft.delaySeconds} Sekunden Wartezeit` : "Sofortige Vergabe"}</span>
                <span><BadgeCheck size={15} /> {draft.waitForScreening ? "Screening wird abgewartet" : "Vergabe vor Screening möglich"}</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function LevelSystemPage({ guildId }: { guildId: string }) {
  const settings = useApi<{ levelSystem: LevelSettings }>(`/api/guilds/${guildId}/level-system`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState<LevelSettings>(DEFAULT_LEVEL_DRAFT);
  const [rewardLevel, setRewardLevel] = useState(5);
  const [rewardRoleId, setRewardRoleId] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.levelSystem) setDraft(settings.data.levelSystem);
  }, [settings.data]);

  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter((channel) => isTextGuildChannel(channel) && channel.canSend !== false),
    [channels.data]
  );
  const manageableRoles = useMemo(
    () => (roles.data?.roles ?? []).filter((role) => role.botCanManage && !role.managed),
    [roles.data]
  );
  const selectedChannel = textChannels.find((channel) => channel.id === draft.announcementChannelId);
  const previewReward = draft.roleRewards[0];
  const previewRole = previewReward ? manageableRoles.find((role) => role.id === previewReward.roleId) : null;
  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data) || (roles.loading && !roles.data);
  const loadError = settings.error || channels.error || roles.error;

  async function persist(nextDraft: LevelSettings = draft): Promise<boolean> {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ levelSystem: LevelSettings }>(`/api/guilds/${guildId}/level-system`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: nextDraft.enabled,
          announcementChannelId: nextDraft.announcementChannelId,
          roleRewards: nextDraft.roleRewards
        })
      });
      setDraft(response.levelSystem);
      setStatus("Level-System gespeichert. Der Bot übernimmt die Einstellungen jetzt.");
      await settings.reload();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Das Level-System konnte nicht gespeichert werden.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateEnabled(enabled: boolean) {
    const previousDraft = draft;
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);
    const saved = await persist(nextDraft);
    if (!saved) setDraft(previousDraft);
  }

  function addReward() {
    if (!rewardRoleId) {
      setStatus("Wähle zuerst eine Rolle aus.");
      return;
    }
    if (!Number.isInteger(rewardLevel) || rewardLevel < 1 || rewardLevel > 1000) {
      setStatus("Das Level muss zwischen 1 und 1000 liegen.");
      return;
    }
    if (draft.roleRewards.some((reward) => reward.level === rewardLevel)) {
      setStatus(`Für Level ${rewardLevel} ist bereits eine Rolle eingetragen.`);
      return;
    }
    if (draft.roleRewards.some((reward) => reward.roleId === rewardRoleId)) {
      setStatus("Diese Rolle wird bereits als Levelbelohnung verwendet.");
      return;
    }

    setDraft({
      ...draft,
      roleRewards: [...draft.roleRewards, { level: rewardLevel, roleId: rewardRoleId }].sort((a, b) => a.level - b.level)
    });
    setRewardRoleId("");
    setStatus("Rollenstufe hinzugefügt. Speichere die Einstellungen, um sie an den Bot zu senden.");
  }

  function removeReward(level: number) {
    setDraft({ ...draft, roleRewards: draft.roleRewards.filter((reward) => reward.level !== level) });
    setStatus("Rollenstufe entfernt. Die Änderung ist noch nicht gespeichert.");
  }

  return (
    <section className="level-page">
      <div className="level-hero">
        <div>
          <p className="eyebrow"><BarChart3 size={15} /> Community Progress</p>
          <h2>Level-System</h2>
          <p>Nachrichten werden zu Fortschritt. Aufstiege landen im richtigen Kanal und Rollen werden automatisch vergeben.</p>
        </div>
        <div className="level-hero-actions">
          <span className={`pill ${draft.syncStatus === "failed" ? "danger" : draft.syncStatus === "synced" ? "ok" : "neutral"}`}>
            {draft.syncStatus === "failed" ? "Sync fehlgeschlagen" : draft.syncStatus === "pending" ? "Wird synchronisiert" : draft.syncStatus === "synced" ? "Synchronisiert" : "Bereit"}
          </span>
          <label className="welcome-switch">
            <input type="checkbox" checked={draft.enabled} disabled={saving} onChange={(event) => void updateEnabled(event.target.checked)} />
            <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
          </label>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />

      {!loading && !loadError && draft.enabled && (
        <>
          <section className="level-summary-grid">
            <StatusTile icon={<MessageSquare size={19} />} label="Nachrichten-XP" value="8-15 XP" tone="ok" />
            <StatusTile icon={<Clock3 size={19} />} label="Cooldown" value="60 Sek." />
            <StatusTile icon={<Trophy size={19} />} label="Levelrollen" value={String(draft.roleRewards.length)} tone={draft.roleRewards.length ? "ok" : undefined} />
            <StatusTile icon={<Hash size={19} />} label="Aufstiegsziel" value={selectedChannel ? `#${selectedChannel.name}` : "Automatisch"} />
          </section>

          <div className="level-layout">
            <div className="level-editor">
              <section className="panel level-control-panel">
                <div className="panel-title">
                  <div>
                    <h2>Levelaufstiege</h2>
                    <p className="muted">Ein fester Kanal ist optional. Ohne Auswahl antwortet der Bot dort, wo das Level erreicht wurde.</p>
                  </div>
                  <RefreshButton
                    loading={(settings.loading && Boolean(settings.data)) || (channels.loading && Boolean(channels.data)) || (roles.loading && Boolean(roles.data))}
                    onClick={async () => { await Promise.all([settings.reload(), channels.reload(), roles.reload()]); }}
                    label="Neu laden"
                  />
                </div>
                <label>
                  Kanal für Levelaufstiege
                  <select
                    value={draft.announcementChannelId ?? ""}
                    onChange={(event) => setDraft({ ...draft, announcementChannelId: event.target.value || null })}
                  >
                    <ChannelSelectOptions channels={textChannels} noneLabel="Automatisch: aktueller Nachrichtenkanal" />
                  </select>
                  <small>{selectedChannel ? `Alle Aufstiege werden in #${selectedChannel.name} gesendet.` : "Fallback aktiv: Die Meldung erscheint direkt im Kanal der auslösenden Nachricht."}</small>
                </label>
              </section>

              <section className="panel level-control-panel">
                <div className="panel-title compact">
                  <div>
                    <h2>Rollenbelohnungen</h2>
                    <p className="muted">Mitglieder erhalten alle erreichten Rollen, die der Bot in der Hierarchie verwalten darf.</p>
                  </div>
                  <span className="pill neutral">{draft.roleRewards.length}/50</span>
                </div>

                <div className="level-reward-builder">
                  <label>
                    Ab Level
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={rewardLevel}
                      onChange={(event) => setRewardLevel(Math.max(1, Math.min(1000, Number(event.target.value) || 1)))}
                    />
                  </label>
                  <label>
                    Discord-Rolle
                    <select value={rewardRoleId} onChange={(event) => setRewardRoleId(event.target.value)}>
                      <option value="">Rolle auswählen</option>
                      {manageableRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
                    </select>
                  </label>
                  <button className="secondary-action icon-action" onClick={addReward} disabled={!rewardRoleId} title="Rollenstufe hinzufügen" aria-label="Rollenstufe hinzufügen">
                    <Plus size={18} />
                  </button>
                </div>

                <div className="level-reward-list">
                  {draft.roleRewards.length === 0 && (
                    <div className="level-reward-empty"><Trophy size={20} /><span>Noch keine Rollenbelohnungen eingerichtet.</span></div>
                  )}
                  {draft.roleRewards.map((reward) => {
                    const role = manageableRoles.find((entry) => entry.id === reward.roleId);
                    return (
                      <article key={reward.level}>
                        <strong>Level {reward.level}</strong>
                        <span className="level-role-name"><i style={{ background: role ? roleColor(role) : "#7b8494" }} />{role?.name ?? `Unbekannte Rolle (${reward.roleId})`}</span>
                        <button className="secondary-action icon-action" onClick={() => removeReward(reward.level)} title="Rollenstufe entfernen" aria-label={`Rollenstufe ${reward.level} entfernen`}>
                          <Trash2 size={17} />
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>

              <section className="panel level-save-panel">
                <div>
                  <strong>Konfiguration bereit</strong>
                  <small>Änderungen werden nach dem Speichern über die sichere Bot-Queue synchronisiert.</small>
                </div>
                <button className="primary-action inline" onClick={() => void persist()} disabled={saving}>
                  {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                  Einstellungen speichern
                </button>
              </section>
            </div>

            <aside className="level-preview">
              <div className="level-preview-heading">
                <div><span>Discord-Vorschau</span><h2>Levelaufstieg</h2></div>
                <span className="pill ok">Live</span>
              </div>
              <div className="level-discord-message">
                <div className="level-bot-avatar"><Bot size={20} /></div>
                <div>
                  <strong>Modmail Manager <small>APP</small></strong>
                  <div className="level-embed-preview">
                    <h3>🎉 Levelaufstieg</h3>
                    <p><b>@Mitglied</b> ist jetzt Level <strong>{previewReward?.level ?? 5}</strong>.</p>
                    {previewRole && <p><b>Neue Rolle:</b> <span style={{ color: roleColor(previewRole) }}>@{previewRole.name}</span></p>}
                  </div>
                </div>
              </div>
              <div className="level-facts">
                <span><ShieldCheck size={15} /> Rollenhierarchie geprüft</span>
                <span><Hash size={15} /> Kanal-Fallback aktiv</span>
                <span><Clock3 size={15} /> XP-Cooldown schützt vor Spam</span>
              </div>
              <div className="counting-command-list">
                <span>/level show</span>
                <span>/level rank</span>
                <span>/level channel</span>
                <span>/levelroles add</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function CountingPage({ guildId }: { guildId: string }) {
  const settings = useApi<{ counting: CountingSettings }>(`/api/guilds/${guildId}/counting`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const [draft, setDraft] = useState<CountingSettings>(DEFAULT_COUNTING_DRAFT);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.counting) setDraft(settings.data.counting);
  }, [settings.data]);

  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter(isTextGuildChannel),
    [channels.data]
  );
  const selectedChannel = textChannels.find((channel) => channel.id === draft.channelId);
  const nextNumber = draft.currentNumber + 1;
  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data);
  const loadError = settings.error || channels.error;

  async function persist(nextDraft: CountingSettings = draft): Promise<boolean> {
    if (nextDraft.enabled && !nextDraft.channelId) {
      setStatus("Wähle zuerst einen Textkanal für Counting aus.");
      return false;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ counting: CountingSettings }>(`/api/guilds/${guildId}/counting`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: nextDraft.enabled,
          channelId: nextDraft.channelId,
          resetOnError: nextDraft.resetOnError,
          deleteWrongMessages: nextDraft.deleteWrongMessages,
          milestoneInterval: nextDraft.milestoneInterval
        })
      });
      setDraft(response.counting);
      setStatus("Counting wurde gespeichert und wird jetzt mit dem Bot synchronisiert.");
      await settings.reload();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Counting konnte nicht gespeichert werden.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function updateEnabled(enabled: boolean) {
    const previousDraft = draft;
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);

    if (enabled && !nextDraft.channelId) {
      setStatus("Wähle jetzt den Counting-Kanal und speichere anschließend die Einstellungen.");
      return;
    }

    const saved = await persist(nextDraft);
    if (!saved) setDraft(previousDraft);
  }

  async function resetCounter() {
    if (!window.confirm("Den aktuellen Counting-Lauf wirklich auf 0 zurücksetzen? Der Rekord bleibt erhalten.")) return;
    setResetting(true);
    setStatus(null);
    try {
      const response = await api<{ counting: CountingSettings }>(`/api/guilds/${guildId}/counting/reset`, {
        method: "POST",
        body: JSON.stringify({ number: 0, clearRecord: false })
      });
      setDraft(response.counting);
      setStatus("Der aktuelle Lauf wird auf 0 zurückgesetzt. Der Rekord bleibt erhalten.");
      await settings.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Der Lauf konnte nicht zurückgesetzt werden.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className="counting-page">
      <div className="counting-hero">
        <div>
          <p className="eyebrow"><ListOrdered size={15} /> Community Game</p>
          <h2>Counting</h2>
          <p>Eine saubere Zahlenkette für deinen Server, mit Reihenfolgeschutz, Rekord und Spielerstatistiken.</p>
        </div>
        <div className="counting-hero-actions">
          <span className={`pill ${draft.syncStatus === "failed" ? "danger" : draft.syncStatus === "synced" ? "ok" : "neutral"}`}>
            {draft.syncStatus === "failed" ? "Sync fehlgeschlagen" : draft.syncStatus === "pending" ? "Wird synchronisiert" : draft.syncStatus === "synced" ? "Synchronisiert" : "Bereit"}
          </span>
          <label className="welcome-switch">
            <input type="checkbox" checked={draft.enabled} disabled={saving || resetting} onChange={(event) => void updateEnabled(event.target.checked)} />
            <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
          </label>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />

      {!loading && !loadError && draft.enabled && (
        <>
          <section className="counting-summary-grid">
            <StatusTile icon={<ListOrdered size={19} />} label="Aktueller Lauf" value={draft.currentNumber.toLocaleString("de-DE")} tone="ok" />
            <StatusTile icon={<Trophy size={19} />} label="Rekord" value={draft.recordNumber.toLocaleString("de-DE")} />
            <StatusTile icon={<Check size={19} />} label="Richtige Zahlen" value={draft.totalCounts.toLocaleString("de-DE")} tone="ok" />
            <StatusTile icon={<X size={19} />} label="Fehlversuche" value={draft.totalFailures.toLocaleString("de-DE")} tone={draft.totalFailures ? "warn" : undefined} />
          </section>

          <div className="counting-layout">
            <div className="counting-editor">
              <section className="panel counting-control-panel">
                <div className="panel-title">
                  <div>
                    <h2>Spielkanal</h2>
                    <p className="muted">In diesem Kanal überwacht der Bot jede Zahl und reagiert sofort.</p>
                  </div>
                  <RefreshButton
                    loading={(settings.loading && Boolean(settings.data)) || (channels.loading && Boolean(channels.data))}
                    onClick={async () => { await Promise.all([settings.reload(), channels.reload()]); }}
                    label="Neu laden"
                  />
                </div>
                <label>
                  Counting-Textkanal
                  <select value={draft.channelId ?? ""} onChange={(event) => setDraft({ ...draft, channelId: event.target.value || null })}>
                    <ChannelSelectOptions channels={textChannels} noneLabel="Textkanal auswählen" />
                  </select>
                  <small>{selectedChannel ? `Aktiv in #${selectedChannel.name}` : "Der Bot benötigt Schreiben, Reaktionen und Nachrichtenverlauf."}</small>
                </label>
              </section>

              <section className="panel counting-control-panel">
                <div className="panel-title compact">
                  <div>
                    <h2>Regeln</h2>
                    <p className="muted">Die Reihenfolge bleibt serverweit eindeutig und manipulationssicher.</p>
                  </div>
                  <ShieldCheck size={18} />
                </div>
                <div className="counting-rule-list">
                  <label className="counting-rule-row">
                    <span><strong>Bei Fehler zurücksetzen</strong><small>Eine falsche Zahl oder derselbe Nutzer zweimal startet wieder bei 1.</small></span>
                    <input type="checkbox" checked={draft.resetOnError} onChange={(event) => setDraft({ ...draft, resetOnError: event.target.checked })} />
                  </label>
                  <label className="counting-rule-row">
                    <span><strong>Falsche Nachricht löschen</strong><small>Der Bot setzt zuerst die rote Reaktion und räumt die Nachricht danach auf.</small></span>
                    <input type="checkbox" checked={draft.deleteWrongMessages} onChange={(event) => setDraft({ ...draft, deleteWrongMessages: event.target.checked })} />
                  </label>
                  <label>
                    Meilenstein-Abstand
                    <input
                      type="number"
                      min={0}
                      max={100000}
                      value={draft.milestoneInterval}
                      onChange={(event) => setDraft({ ...draft, milestoneInterval: Math.max(0, Math.min(100000, Number(event.target.value) || 0)) })}
                    />
                    <small>0 deaktiviert Meldungen. Standard: alle 100 Zahlen.</small>
                  </label>
                </div>
              </section>

              <section className="panel counting-control-panel">
                <div className="counting-save-row">
                  <div>
                    <strong>Nächste gültige Zahl: {nextNumber.toLocaleString("de-DE")}</strong>
                    <small>Der aktuelle Rekord von {draft.recordNumber.toLocaleString("de-DE")} bleibt bei einem normalen Reset erhalten.</small>
                  </div>
                  <div className="form-actions">
                    <button className="primary-action inline" onClick={() => void persist()} disabled={saving || resetting || !draft.channelId}>
                      {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                      Einstellungen speichern
                    </button>
                    <button className="secondary-action inline" onClick={() => void resetCounter()} disabled={saving || resetting}>
                      {resetting ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />}
                      Lauf zurücksetzen
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <aside className="counting-preview">
              <div className="counting-preview-heading">
                <div><span>Live-Vorschau</span><h2>#{selectedChannel?.name ?? "counting"}</h2></div>
                <span className="pill ok">Nächste: {nextNumber.toLocaleString("de-DE")}</span>
              </div>
              <div className="counting-chat-preview">
                {draft.currentNumber >= 2 && <article><div className="counting-avatar">L</div><div><strong>Lena</strong><p>{(draft.currentNumber - 1).toLocaleString("de-DE")}</p><small className="counting-reaction ok"><Check size={12} /> 1</small></div></article>}
                {draft.currentNumber >= 1 && <article><div className="counting-avatar blue">M</div><div><strong>Max</strong><p>{draft.currentNumber.toLocaleString("de-DE")}</p><small className="counting-reaction ok"><Check size={12} /> 1</small></div></article>}
                <article className="next"><div className="counting-avatar bot"><Bot size={16} /></div><div><strong>Modmail Manager <small>APP</small></strong><p>Wartet auf <b>{nextNumber.toLocaleString("de-DE")}</b></p></div></article>
              </div>
              <div className="counting-logic-list">
                <span><Check size={15} /> Exakt nächste Zahl</span>
                <span><UsersRound size={15} /> Kein Nutzer zweimal</span>
                <span><Trophy size={15} /> Rekord bleibt erhalten</span>
              </div>
              <div className="counting-command-list">
                <span>/counting status</span>
                <span>/counting leaderboard</span>
                <span>/counting stats</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

const TEMPVOICE_ACTIONS = [
  { label: "Umbenennen", icon: Pencil },
  { label: "Benutzerlimit", icon: UsersRound },
  { label: "Privatsphäre", icon: Shield },
  { label: "Wartezimmer", icon: Clock3 },
  { label: "Chat", icon: MessageSquare },
  { label: "Hinzufügen", icon: UserPlus },
  { label: "Entfernen", icon: UserMinus },
  { label: "Einladen", icon: PhoneCall },
  { label: "Verbindung trennen", icon: PhoneOff },
  { label: "Region", icon: Globe2 },
  { label: "Blockieren", icon: Ban },
  { label: "Entblockieren", icon: ShieldCheck },
  { label: "Übernehmen", icon: Crown },
  { label: "Übertragen", icon: ArrowRight },
  { label: "Löschen", icon: Trash2 }
] as const;

function TempVoicePage({ guildId }: { guildId: string }) {
  const settings = useApi<{ tempVoice: TempVoiceSettings }>(`/api/guilds/${guildId}/temp-voice`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const [draft, setDraft] = useState<TempVoiceSettings>(DEFAULT_TEMP_VOICE_DRAFT);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.tempVoice) setDraft(settings.data.tempVoice);
  }, [settings.data]);

  const voiceChannels = useMemo(
    () => (channels.data?.channels ?? []).filter((channel) => channel.type.toLowerCase() === "voice"),
    [channels.data]
  );
  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter(isTextGuildChannel),
    [channels.data]
  );
  const categories = useMemo(
    () => (channels.data?.channels ?? []).filter((channel) => channel.type.toLowerCase() === "category"),
    [channels.data]
  );
  const panelChannel = textChannels.find((channel) => channel.id === draft.interfaceChannelId);
  const namePreview = draft.nameTemplate
    .replaceAll("{user}", "Niteacfort74")
    .replaceAll("{name}", "niteacfort74");

  function toggleCreator(channelId: string) {
    setDraft((current) => ({
      ...current,
      creatorChannelIds: current.creatorChannelIds.includes(channelId)
        ? current.creatorChannelIds.filter((id) => id !== channelId)
        : [...current.creatorChannelIds, channelId]
    }));
  }

  async function persist(sendPanel: boolean, nextDraft: TempVoiceSettings = draft): Promise<boolean> {
    if (sendPanel) setSending(true);
    else setSaving(true);
    setStatus(null);

    try {
      const response = await api<{ tempVoice: TempVoiceSettings }>(`/api/guilds/${guildId}/temp-voice`, {
        method: "PUT",
        body: JSON.stringify({
          enabled: nextDraft.enabled,
          creatorChannelIds: nextDraft.creatorChannelIds,
          categoryId: nextDraft.categoryId,
          interfaceChannelId: nextDraft.interfaceChannelId,
          nameTemplate: nextDraft.nameTemplate,
          defaultUserLimit: nextDraft.defaultUserLimit,
          defaultBitrateKbps: nextDraft.defaultBitrateKbps
        })
      });
      setDraft(response.tempVoice);

      if (sendPanel) {
        await api(`/api/guilds/${guildId}/temp-voice/panel`, {
          method: "POST",
          body: JSON.stringify({ channelId: nextDraft.interfaceChannelId })
        });
        setStatus("Konfiguration gespeichert. Das TempVoice-Interface wird jetzt vom Bot gesendet oder aktualisiert.");
      } else {
        setStatus("TempVoice wurde gespeichert und zur Bot-Synchronisierung vorgemerkt.");
      }

      await settings.reload();
      return true;
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "TempVoice konnte nicht gespeichert werden.");
      return false;
    } finally {
      setSaving(false);
      setSending(false);
    }
  }

  async function updateEnabled(enabled: boolean) {
    const previousDraft = draft;
    const nextDraft = { ...draft, enabled };
    setDraft(nextDraft);

    if (enabled && nextDraft.creatorChannelIds.length === 0) {
      setStatus("Wähle jetzt mindestens einen Creator-Kanal und speichere anschließend die Einstellungen.");
      return;
    }

    const saved = await persist(false, nextDraft);
    if (!saved) setDraft(previousDraft);
  }

  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data);
  const loadError = settings.error || channels.error;

  return (
    <section className="tempvoice-page">
      <div className="tempvoice-hero">
        <div>
          <p className="eyebrow">
            <Mic2 size={15} />
            Voice Studio
          </p>
          <h2>TempVoice</h2>
          <p>Join-to-create, Besitzerrechte und das komplette Discord-Interface an einem Ort konfigurieren.</p>
        </div>
        <div className="tempvoice-hero-actions">
          <span className={`pill ${draft.syncStatus === "failed" ? "danger" : draft.syncStatus === "synced" ? "ok" : "neutral"}`}>
            {draft.syncStatus === "failed" ? "Sync fehlgeschlagen" : draft.syncStatus === "pending" ? "Wird synchronisiert" : draft.syncStatus === "synced" ? "Synchronisiert" : "Bereit"}
          </span>
          <label className="welcome-switch">
            <input
              type="checkbox"
              checked={draft.enabled}
              disabled={saving || sending}
              onChange={(event) => void updateEnabled(event.target.checked)}
            />
            <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
          </label>
        </div>
      </div>

      {loading && <LoadingBlock />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />

      {!loading && !loadError && draft.enabled && (
        <>
          <section className="tempvoice-summary-grid">
            <StatusTile icon={<Mic2 size={19} />} label="Status" value={draft.enabled ? "aktiv" : "inaktiv"} tone={draft.enabled ? "ok" : "warn"} />
            <StatusTile icon={<Radio size={19} />} label="Creator" value={String(draft.creatorChannelIds.length)} tone={draft.creatorChannelIds.length ? "ok" : "warn"} />
            <StatusTile icon={<UsersRound size={19} />} label="Standardlimit" value={draft.defaultUserLimit ? String(draft.defaultUserLimit) : "offen"} />
            <StatusTile icon={<MessageSquare size={19} />} label="Interface" value={panelChannel ? `#${panelChannel.name}` : "fehlt"} tone={panelChannel ? "ok" : "warn"} />
          </section>

          <div className="tempvoice-layout">
            <div className="tempvoice-editor">
              <section className="panel tempvoice-control-panel">
                <div className="panel-title">
                  <div>
                    <h2>Creator-Kanäle</h2>
                    <p className="muted">Mitglieder erhalten beim Beitritt automatisch ihren eigenen Sprachkanal.</p>
                  </div>
                  <RefreshButton
                    loading={(settings.loading && Boolean(settings.data)) || (channels.loading && Boolean(channels.data))}
                    onClick={async () => {
                      await Promise.all([settings.reload(), channels.reload()]);
                    }}
                    label="Neu laden"
                  />
                </div>

                {voiceChannels.length ? (
                  <div className="tempvoice-channel-groups">
                    {groupedChannels(voiceChannels).map((group) => (
                      <div className="tempvoice-channel-group" key={group.label}>
                        <div className="tempvoice-channel-group-title">
                          <Hash size={14} />
                          {group.label}
                        </div>
                        <div className="tempvoice-channel-list">
                          {group.items.map((channel) => {
                            const selected = draft.creatorChannelIds.includes(channel.id);
                            return (
                              <button
                                type="button"
                                className={`tempvoice-channel-option ${selected ? "selected" : ""}`}
                                aria-pressed={selected}
                                onClick={() => toggleCreator(channel.id)}
                                key={channel.id}
                              >
                                <span><Radio size={16} />{channel.name}</span>
                                <span className="tempvoice-check">{selected ? <Check size={15} /> : <Plus size={15} />}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="Keine Sprachkanäle" text="Der Bot-Snapshot enthält noch keine sichtbaren Sprachkanäle." />
                )}
              </section>

              <section className="panel tempvoice-control-panel">
                <div className="panel-title">
                  <div>
                    <h2>Raum-Standard</h2>
                    <p className="muted">Diese Werte gelten für jeden neu erstellten temporären Kanal.</p>
                  </div>
                  <SlidersHorizontal size={18} />
                </div>
                <div className="form-grid">
                  <label>
                    Zielkategorie
                    <select value={draft.categoryId ?? ""} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value || null })}>
                      <option value="">Kategorie des Creator-Kanals</option>
                      {categories.map((category) => (
                        <option value={category.id} key={category.id}>{category.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Namensformat
                    <input
                      value={draft.nameTemplate}
                      maxLength={90}
                      onChange={(event) => setDraft({ ...draft, nameTemplate: event.target.value })}
                      placeholder="{user}s Raum"
                    />
                    <small>Vorschau: {namePreview || "Niteacfort74s Raum"}</small>
                  </label>
                  <label>
                    Benutzerlimit
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.defaultUserLimit}
                      onChange={(event) => setDraft({ ...draft, defaultUserLimit: Number(event.target.value) })}
                    />
                    <small>0 bedeutet unbegrenzt.</small>
                  </label>
                  <label>
                    Audio-Bitrate
                    <select
                      value={draft.defaultBitrateKbps}
                      onChange={(event) => setDraft({ ...draft, defaultBitrateKbps: Number(event.target.value) })}
                    >
                      {[32, 48, 64, 80, 96, 128, 160, 192, 256, 320, 384].map((bitrate) => (
                        <option value={bitrate} key={bitrate}>{bitrate} kbit/s</option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="panel tempvoice-control-panel">
                <div className="panel-title compact">
                  <div>
                    <h2>Interface senden</h2>
                    <p className="muted">Der Bot aktualisiert ein bereits vorhandenes Panel, statt ein Duplikat zu senden.</p>
                  </div>
                  {draft.panelMessageId && <span className="pill ok">gesendet</span>}
                </div>
                <label>
                  Textkanal
                  <select value={draft.interfaceChannelId ?? ""} onChange={(event) => setDraft({ ...draft, interfaceChannelId: event.target.value || null })}>
                    <ChannelSelectOptions channels={textChannels} noneLabel="Textkanal auswählen" />
                  </select>
                </label>
                <div className="form-actions">
                  <button className="primary-action inline" onClick={() => persist(false)} disabled={saving || sending}>
                    {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                    Einstellungen speichern
                  </button>
                  <button className="secondary-action inline" onClick={() => persist(true)} disabled={saving || sending || !draft.interfaceChannelId}>
                    {sending ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />}
                    Panel senden
                  </button>
                  {draft.panelChannelId && draft.panelMessageId && (
                    <a
                      className="secondary-action inline"
                      href={`https://discord.com/channels/${guildId}/${draft.panelChannelId}/${draft.panelMessageId}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      In Discord öffnen
                    </a>
                  )}
                </div>
              </section>
            </div>

            <aside className="tempvoice-preview">
              <div className="tempvoice-preview-heading">
                <div>
                  <span>Live-Vorschau</span>
                  <h2>Discord Interface</h2>
                </div>
                <span className="pill neutral">15 Aktionen</span>
              </div>
              <div className="tempvoice-discord-message">
                <div className="tempvoice-bot-avatar"><Mic2 size={22} /></div>
                <div className="tempvoice-message-body">
                  <strong>TempVoice <small>APP</small></strong>
                  <div className="tempvoice-discord-embed">
                    <h3>TempVoice Interface</h3>
                    <p>Mit diesem Interface verwaltest du deinen temporären Sprachkanal. Weitere Optionen stehen mit den `/tempvoice`-Befehlen zur Verfügung.</p>
                    <img src="/tempvoice-interface.png" alt="Übersicht der TempVoice-Aktionen" />
                    <small>Dieses Interface kann mit den Buttons unter der Nachricht bedient werden.</small>
                  </div>
                  <div className="tempvoice-action-grid" aria-label="TempVoice Panel-Aktionen">
                    {TEMPVOICE_ACTIONS.map((action) => {
                      const Icon = action.icon;
                      return (
                        <button
                          type="button"
                          title={action.label}
                          aria-label={action.label}
                          key={action.label}
                        >
                          <Icon size={17} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="tempvoice-command-list">
                <span>/tempvoice rename</span>
                <span>/tempvoice privacy</span>
                <span>/tempvoice transfer</span>
                <span>/tempvoice region</span>
              </div>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}

function LoggingPage({ guildId }: { guildId: string }) {
  const logging = useApi<{ logging: LoggingSettings }>(`/api/guilds/${guildId}/logging`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const [draft, setDraft] = useState<LoggingSettings>(defaultLoggingSettings);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testCategory, setTestCategory] = useState<LogCategory>("general");

  useEffect(() => {
    if (logging.data?.logging) setDraft(logging.data.logging);
  }, [logging.data]);

  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter(isTextGuildChannel),
    [channels.data]
  );
  const activeEvents = LOG_CATEGORIES.filter((category) => draft.events[category.key]).length;
  const mappedChannels = LOG_CATEGORIES.filter((category) => draft.channelMappings[category.key]).length;
  const defaultChannelId = draft.channelMappings.general;

  function updateChannel(category: LogCategory, channelId: string) {
    setDraft((current) => ({
      ...current,
      channelMappings: {
        ...current.channelMappings,
        [category]: channelId || null
      }
    }));
  }

  function updateEvent(category: LogCategory, enabled: boolean) {
    setDraft((current) => ({
      ...current,
      events: {
        ...current.events,
        [category]: enabled
      }
    }));
  }

  function setAllEvents(enabled: boolean) {
    setDraft((current) => ({
      ...current,
      events: Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, enabled])) as Record<LogCategory, boolean>
    }));
  }

  function applyCoreProfile() {
    const core = new Set<LogCategory>(["general", "moderation", "security", "members", "system"]);
    setDraft((current) => ({
      ...current,
      enabled: true,
      events: Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, core.has(category.key)])) as Record<LogCategory, boolean>
    }));
  }

  function resetCategoryChannels() {
    setDraft((current) => ({
      ...current,
      channelMappings: {
        ...Object.fromEntries(LOG_CATEGORIES.map((category) => [category.key, null])),
        general: current.channelMappings.general
      } as Record<LogCategory, string | null>
    }));
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ logging: LoggingSettings }>(`/api/guilds/${guildId}/logging`, {
        method: "PUT",
        body: JSON.stringify(draft)
      });
      setDraft(response.logging);
      setStatus("Logging gespeichert und zur Bot-Synchronisierung vorgemerkt.");
      await logging.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Logging konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/logging/test`, {
        method: "POST",
        body: JSON.stringify({ category: testCategory })
      });
      setStatus("Log-Test wurde an den Bot gesendet.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Log-Test konnte nicht gesendet werden.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <section className="logging-page">
      <div className="logging-hero">
        <div>
          <p className="eyebrow">
            <ListFilter size={15} />
            Logging Center
          </p>
          <h2>Logging</h2>
          <p>Kategorien, Logkanäle und Testlauf zentral steuern. Die Änderungen werden als Sync-Job an den laufenden Bot geschickt.</p>
        </div>
        <label className="welcome-switch logging-switch">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
          <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
        </label>
      </div>

      {((logging.loading && !logging.data) || (channels.loading && !channels.data)) && <LoadingBlock />}
      {(logging.error || channels.error) && <Notice tone="danger" text={logging.error || channels.error || "Fehler beim Laden."} />}

      {!logging.loading && (
        <>
          <section className="logging-summary-grid">
            <StatusTile icon={<ListFilter size={19} />} label="Status" value={draft.enabled ? "aktiv" : "inaktiv"} tone={draft.enabled ? "ok" : "warn"} />
            <StatusTile icon={<Check size={19} />} label="Events" value={`${activeEvents}/${LOG_CATEGORIES.length}`} />
            <StatusTile icon={<Hash size={19} />} label="Ziele" value={String(mappedChannels)} />
            <StatusTile icon={<MessageSquare size={19} />} label="Kanäle" value={String(textChannels.length)} tone={textChannels.length ? "ok" : "warn"} />
          </section>

          <section className="panel logging-control-panel">
            <div className="panel-title">
              <div>
                <h2>Steuerung</h2>
                <p className="muted">Standardkanal setzen, Profile anwenden und einen echten Bot-Test auslösen.</p>
              </div>
              <RefreshButton loading={(logging.loading && Boolean(logging.data)) || (channels.loading && Boolean(channels.data))} onClick={async () => {
                await logging.reload();
                await channels.reload();
              }} label="Neu laden" />
            </div>

            <div className="logging-toolbar">
              <label>
                Standard-Logkanal
                <select value={defaultChannelId ?? ""} onChange={(event) => updateChannel("general", event.target.value)}>
                  <ChannelSelectOptions channels={textChannels} noneLabel="Nicht gesetzt" />
                </select>
              </label>
              <label>
                Test-Kategorie
                <select value={testCategory} onChange={(event) => setTestCategory(event.target.value as LogCategory)}>
                  {LOG_CATEGORIES.map((category) => (
                    <option value={category.key} key={category.key}>{category.label}</option>
                  ))}
                </select>
              </label>
              <div className="logging-action-stack">
                <button className="primary-action inline" onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                  Logging speichern
                </button>
                <button className="secondary-action inline" onClick={sendTest} disabled={testing || !draft.enabled}>
                  {testing ? <Loader2 className="spin" size={16} /> : <Radio size={16} />}
                  Test senden
                </button>
              </div>
            </div>

            <div className="token-bar logging-quick-actions">
              <button type="button" className="secondary-action inline" onClick={() => setAllEvents(true)}>
                <Check size={15} />
                Alle Events
              </button>
              <button type="button" className="secondary-action inline" onClick={applyCoreProfile}>
                <ShieldCheck size={15} />
                Kernlogs
              </button>
              <button type="button" className="secondary-action inline" onClick={resetCategoryChannels}>
                <Hash size={15} />
                Kategorien zurücksetzen
              </button>
            </div>

            <ActionStatus status={status} />
          </section>

          <section className="logging-category-grid">
            {LOG_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <article className={`logging-category-card ${draft.events[category.key] ? "active" : ""}`} key={category.key}>
                  <div className="logging-category-head">
                    <span>
                      <Icon size={17} />
                    </span>
                    <div>
                      <h3>{category.label}</h3>
                      <p>{category.text}</p>
                    </div>
                    <label className="toggle logging-category-toggle">
                      <input
                        type="checkbox"
                        checked={draft.events[category.key]}
                        onChange={(event) => updateEvent(category.key, event.target.checked)}
                      />
                      Aktiv
                    </label>
                  </div>
                  <label>
                    Zielkanal
                    <select value={draft.channelMappings[category.key] ?? ""} onChange={(event) => updateChannel(category.key, event.target.value)}>
                      <ChannelSelectOptions
                        channels={textChannels}
                        noneLabel={category.key === "general" ? "Nicht gesetzt" : "Fallback nutzen"}
                      />
                    </select>
                  </label>
                  <small className="logging-category-route">
                    {draft.channelMappings[category.key]
                      ? "eigener Kanal"
                      : category.key === "general"
                        ? "kein Standardkanal"
                        : "nutzt Fallback"}
                  </small>
                </article>
              );
            })}
          </section>
        </>
      )}
    </section>
  );
}

function WelcomePage({ guildId }: { guildId: string }) {
  const welcome = useApi<{ welcome: WelcomeSettings }>(`/api/guilds/${guildId}/welcome`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState<WelcomeSettings>(DEFAULT_WELCOME_DRAFT);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (welcome.data?.welcome) setDraft(welcome.data.welcome);
  }, [welcome.data]);

  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter(isTextGuildChannel),
    [channels.data]
  );
  const manageableRoles = useMemo(
    () => (roles.data?.roles ?? []).filter((role) => role.botCanManage && !role.managed),
    [roles.data]
  );
  const mentionRoles = useMemo(
    () => (roles.data?.roles ?? []).filter((role) => draft.embed.allowedRoleIds.includes(role.id)),
    [roles.data, draft.embed.allowedRoleIds]
  );
  const imageUrl = draft.embed.imageMediaKey ? `/api/guilds/${guildId}/media?key=${encodeURIComponent(draft.embed.imageMediaKey)}` : draft.embed.imageUrl;

  function updateEmbed(value: Partial<WelcomeSettings["embed"]>) {
    setDraft((current) => ({ ...current, embed: { ...current.embed, ...value } }));
  }

  function appendMessage(token: string) {
    setDraft((current) => ({
      ...current,
      message: `${current.message}${current.message && !current.message.endsWith(" ") ? " " : ""}${token}`
    }));
  }

  function toggleRole(roleId: string) {
    const selected = draft.embed.allowedRoleIds.includes(roleId);
    updateEmbed({
      allowedRoleIds: selected
        ? draft.embed.allowedRoleIds.filter((id) => id !== roleId)
        : [...draft.embed.allowedRoleIds, roleId]
    });
  }

  async function uploadImage() {
    if (!file) return;
    setUploading(true);
    setStatus(null);
    const formData = new FormData();
    formData.set("image", file);
    try {
      const response = await api<{ mediaKey: string; mediaUrl: string }>(`/api/guilds/${guildId}/welcome/image`, {
        method: "POST",
        body: formData
      });
      updateEmbed({ imageMediaKey: response.mediaKey, imageUrl: null, imageMode: draft.embed.imageMode === "none" ? "banner" : draft.embed.imageMode });
      setFile(null);
      setStatus("Begrüßungsbild hochgeladen. Danach bitte speichern.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ welcome: WelcomeSettings }>(`/api/guilds/${guildId}/welcome`, {
        method: "PUT",
        body: JSON.stringify(draft)
      });
      setDraft(response.welcome);
      setStatus("Begrüßung gespeichert und zur Bot-Synchronisierung vorgemerkt.");
      await welcome.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="welcome-page">
      <div className="welcome-hero">
        <div>
          <p className="eyebrow">
            <Sparkles size={15} />
            Welcome Studio
          </p>
          <h2>Begrüßung</h2>
          <p>Neue Mitglieder landen mit eigener Nachricht, optionalem Embed, Bild, Startrolle und kontrollierten Mentions direkt sauber im richtigen Kanal.</p>
        </div>
        <label className="welcome-switch">
          <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
          <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
        </label>
      </div>

      {((welcome.loading && !welcome.data) || (channels.loading && !channels.data) || (roles.loading && !roles.data)) && <LoadingBlock />}
      {(welcome.error || channels.error || roles.error) && <Notice tone="danger" text={welcome.error || channels.error || roles.error || "Fehler beim Laden."} />}

      {!welcome.loading && (
        <div className="welcome-grid">
          <div className="welcome-editor">
            <section className="panel">
              <div className="panel-title">
                <h2>Nachricht & Ziel</h2>
                <span className={draft.enabled ? "pill ok" : "pill"}>{draft.enabled ? "sendet" : "pausiert"}</span>
              </div>
              <div className="form-grid">
                <label>
                  Zielkanal
                  <select value={draft.channelId ?? ""} onChange={(event) => setDraft({ ...draft, channelId: event.target.value || null })}>
                    <ChannelSelectOptions channels={textChannels} noneLabel="Kanal auswählen" />
                  </select>
                </label>
                <label>
                  Startrolle
                  <select value={draft.autoRoleId ?? ""} onChange={(event) => setDraft({ ...draft, autoRoleId: event.target.value || null })}>
                    <option value="">Keine Startrolle</option>
                    {manageableRoles.map((role) => (
                      <option value={role.id} key={role.id}>
                        {role.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  Nachricht
                  <textarea
                    value={draft.message}
                    maxLength={2000}
                    onChange={(event) => setDraft({ ...draft, message: event.target.value })}
                    placeholder="Willkommen {member_mention}! Schön, dass du auf {server} bist."
                  />
                </label>
                <div className="token-bar wide" aria-label="Platzhalter und Mentions">
                  <button type="button" className="secondary-action inline" onClick={() => appendMessage("{member_mention}")}>
                    <AtSign size={15} />
                    Mitglied
                  </button>
                  <button type="button" className="secondary-action inline" onClick={() => appendMessage("{server}")}>
                    <Server size={15} />
                    Server
                  </button>
                  <button type="button" className="secondary-action inline" onClick={() => appendMessage("{member_count}")}>
                    <Hash size={15} />
                    Anzahl
                  </button>
                  <button type="button" className="secondary-action inline" onClick={() => appendMessage("@everyone")}>
                    <AtSign size={15} />
                    @everyone
                  </button>
                  <button type="button" className="secondary-action inline" onClick={() => appendMessage("@here")}>
                    <Radio size={15} />
                    @here
                  </button>
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>Embed & Bild</h2>
                <Palette size={18} />
              </div>
              <div className="form-grid">
                <label className="toggle">
                  <input type="checkbox" checked={draft.embed.useEmbed} onChange={(event) => updateEmbed({ useEmbed: event.target.checked })} />
                  Embed anzeigen
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={draft.embed.showGeneratedCard} onChange={(event) => updateEmbed({ showGeneratedCard: event.target.checked })} />
                  Fallback-Karte erzeugen
                </label>
                <label>
                  Titel
                  <input value={draft.embed.title} maxLength={256} onChange={(event) => updateEmbed({ title: event.target.value })} />
                </label>
                <label>
                  Farbe
                  <input type="color" value={draft.embed.color} onChange={(event) => updateEmbed({ color: event.target.value.toUpperCase() })} />
                </label>
                <label className="wide">
                  Beschreibung
                  <textarea value={draft.embed.description} maxLength={4000} onChange={(event) => updateEmbed({ description: event.target.value })} />
                </label>
                <label>
                  Bildmodus
                  <select value={draft.embed.imageMode} onChange={(event) => updateEmbed({ imageMode: event.target.value as WelcomeSettings["embed"]["imageMode"] })}>
                    <option value="banner">Großes Banner</option>
                    <option value="thumbnail">Kleines Thumbnail</option>
                    <option value="none">Kein Bild</option>
                  </select>
                </label>
                <label>
                  Bilddatei
                  <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
                </label>
                <div className="form-actions wide">
                  <button className="secondary-action inline" onClick={uploadImage} disabled={!file || uploading}>
                    {uploading ? <Loader2 className="spin" size={16} /> : <Upload size={16} />}
                    Bild hochladen
                  </button>
                  {draft.embed.imageMediaKey && (
                    <button className="secondary-action inline" onClick={() => updateEmbed({ imageMediaKey: null, imageUrl: null })}>
                      <Trash2 size={16} />
                      Bild entfernen
                    </button>
                  )}
                </div>
              </div>
            </section>

            <section className="panel">
              <div className="panel-title">
                <h2>Mentions</h2>
                <MessageSquare size={18} />
              </div>
              <div className="mention-grid">
                <label className="toggle">
                  <input type="checkbox" checked={draft.embed.mentionMember} onChange={(event) => updateEmbed({ mentionMember: event.target.checked })} />
                  Mitglied darf gepingt werden
                </label>
                <label className="toggle">
                  <input type="checkbox" checked={draft.embed.allowEveryone} onChange={(event) => updateEmbed({ allowEveryone: event.target.checked })} />
                  @everyone und @here erlauben
                </label>
              </div>
              <div className="role-picker">
                {manageableRoles.length === 0 ? (
                  <p className="muted">Keine vergebbaren Rollen im Snapshot gefunden.</p>
                ) : (
                  manageableRoles.map((role) => (
                    <button
                      type="button"
                      className={`role-chip ${draft.embed.allowedRoleIds.includes(role.id) ? "active" : ""}`}
                      onClick={() => toggleRole(role.id)}
                      key={role.id}
                    >
                      <span style={{ backgroundColor: roleColor(role) }} />
                      {role.name}
                    </button>
                  ))
                )}
              </div>
              {mentionRoles.length > 0 && (
                <div className="token-bar">
                  {mentionRoles.map((role) => (
                    <button type="button" className="secondary-action inline" onClick={() => appendMessage(`<@&${role.id}>`)} key={role.id}>
                      <UserPlus size={15} />
                      @{role.name}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <ActionStatus status={status} />
            <div className="form-actions">
              <button className="primary-action inline" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                Begrüßung speichern
              </button>
              <RefreshButton loading={welcome.loading && Boolean(welcome.data)} onClick={welcome.reload} label="Neu laden" />
            </div>
          </div>

          <aside className="welcome-preview">
            <div className="panel-title">
              <h2>Discord-Vorschau</h2>
              <span className="pill neutral">Preview</span>
            </div>
            <div className="discord-message">
              <div className="discord-avatar">M</div>
              <div className="discord-message-body">
                <strong>Modmail Manager <small>gerade eben</small></strong>
                <p>{replaceTemplateTokens(draft.message) || "Keine Nachricht gesetzt."}</p>
                {draft.embed.useEmbed && (
                  <div className="welcome-embed-preview" style={{ borderLeftColor: draft.embed.color }}>
                    <div>
                      <strong>{replaceTemplateTokens(draft.embed.title) || "Willkommen"}</strong>
                      <p>{replaceTemplateTokens(draft.embed.description) || "Embed-Beschreibung"}</p>
                    </div>
                    {imageUrl && draft.embed.imageMode !== "none" && (
                      <div className={`welcome-image-preview ${draft.embed.imageMode}`}>
                        <img src={imageUrl} alt="" />
                      </div>
                    )}
                  </div>
                )}
                <div className="welcome-mention-preview">
                  <span className={draft.embed.mentionMember ? "on" : ""}>Mitglied-Ping</span>
                  <span className={draft.embed.allowEveryone ? "on danger" : ""}>@everyone</span>
                  <span className={mentionRoles.length ? "on" : ""}>{mentionRoles.length} Rollen</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function CommandsPage({ guildId }: { guildId: string }) {
  const commands = useApi<{ commands: CommandConfig[] }>(`/api/guilds/${guildId}/commands`, [guildId]);
  const [status, setStatus] = useState<string | null>(null);

  async function save(command: CommandConfig) {
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/commands/${encodeURIComponent(command.commandName)}`, {
        method: "PATCH",
        body: JSON.stringify(command)
      });
      setStatus(`/${command.commandName} gespeichert.`);
      await commands.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Slash-Befehle</h2>
        <RefreshButton loading={commands.loading && Boolean(commands.data)} onClick={commands.reload} label="Neu laden" />
      </div>
      <ActionStatus status={status} />
      {commands.loading && !commands.data && <LoadingBlock />}
      {commands.error && <Notice tone="danger" text={commands.error} />}
      {!commands.loading && commands.data?.commands.length === 0 && (
        <EmptyState title="Noch kein Bot-Snapshot" text="Sobald der Python-Bot die interne Schnittstelle erreicht, erscheinen hier seine echten Slash-Befehle." />
      )}
      <div className="command-list">
        {commands.data?.commands.map((command) => (
          <CommandRow key={command.commandName} command={command} onSave={save} />
        ))}
      </div>
    </section>
  );
}

function CommandRow({ command, onSave }: { command: CommandConfig; onSave: (command: CommandConfig) => Promise<void> }) {
  const [draft, setDraft] = useState(command);
  const changed = JSON.stringify(draft) !== JSON.stringify(command);

  return (
    <article className="command-row">
      <div>
        <h3>/{command.commandName}</h3>
        <p>{command.description || "Keine Beschreibung gemeldet."}</p>
      </div>
      <label className="toggle">
        <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
        Aktiv
      </label>
      <label className="toggle">
        <input type="checkbox" checked={draft.ephemeral} onChange={(event) => setDraft({ ...draft, ephemeral: event.target.checked })} />
        Ephemeral
      </label>
      <label>
        Cooldown
        <input
          type="number"
          min={0}
          max={86400}
          value={draft.cooldownSeconds}
          onChange={(event) => setDraft({ ...draft, cooldownSeconds: Number(event.target.value) })}
        />
      </label>
      <label className="toggle">
        <input
          type="checkbox"
          checked={draft.administratorOnly}
          onChange={(event) => setDraft({ ...draft, administratorOnly: event.target.checked })}
        />
        Admin
      </label>
      <button className="icon-button save" title="Befehl speichern" disabled={!changed} onClick={() => onSave(draft)}>
        <Check size={17} />
      </button>
    </article>
  );
}

function CustomCommandsPage({ guildId }: { guildId: string }) {
  const commands = useApi<{ customCommands: CustomCommand[] }>(`/api/guilds/${guildId}/custom-commands`, [guildId]);
  const emptyDraft = useMemo(
    () => ({ name: "", description: "", responseContent: "", enabled: true, ephemeral: false, cooldownSeconds: 0 }),
    []
  );
  const [draft, setDraft] = useState(emptyDraft);
  const [status, setStatus] = useState<string | null>(null);

  async function create() {
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/custom-commands`, {
        method: "POST",
        body: JSON.stringify(draft)
      });
      setDraft(emptyDraft);
      setStatus("Custom Command erstellt.");
      await commands.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Erstellen fehlgeschlagen.");
    }
  }

  return (
    <section className="section-grid">
      <div className="panel">
        <div className="panel-title">
          <h2>Neuer Custom Command</h2>
        </div>
        <CommandEditor draft={draft} onChange={setDraft} />
        <ActionStatus status={status} />
        <div className="form-actions">
          <button className="primary-action inline" onClick={create}>
            <Plus size={16} />
            Erstellen
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Custom Commands</h2>
          <RefreshButton loading={commands.loading && Boolean(commands.data)} onClick={commands.reload} label="Neu laden" />
        </div>
        {commands.loading && !commands.data && <LoadingBlock />}
        {commands.error && <Notice tone="danger" text={commands.error} />}
        {commands.data?.customCommands.length === 0 && <EmptyState title="Keine Custom Commands" text="Erstelle den ersten Command für diese Guild." />}
        <div className="custom-list">
          {commands.data?.customCommands.map((command) => (
            <EditableCustomCommand key={command.id} guildId={guildId} command={command} onChanged={commands.reload} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CommandEditor({
  draft,
  onChange
}: {
  draft: { name: string; description: string; responseContent: string; enabled: boolean; ephemeral: boolean; cooldownSeconds: number };
  onChange: (value: { name: string; description: string; responseContent: string; enabled: boolean; ephemeral: boolean; cooldownSeconds: number }) => void;
}) {
  return (
    <div className="form-grid">
      <label>
        Name
        <input value={draft.name} onChange={(event) => onChange({ ...draft, name: event.target.value })} placeholder="status" />
      </label>
      <label>
        Beschreibung
        <input value={draft.description} onChange={(event) => onChange({ ...draft, description: event.target.value })} maxLength={100} />
      </label>
      <label className="wide">
        Antwort
        <textarea value={draft.responseContent} onChange={(event) => onChange({ ...draft, responseContent: event.target.value })} maxLength={2000} />
      </label>
      <label>
        Cooldown
        <input type="number" min={0} max={86400} value={draft.cooldownSeconds} onChange={(event) => onChange({ ...draft, cooldownSeconds: Number(event.target.value) })} />
      </label>
      <label className="toggle">
        <input type="checkbox" checked={draft.enabled} onChange={(event) => onChange({ ...draft, enabled: event.target.checked })} />
        Aktiv
      </label>
      <label className="toggle">
        <input type="checkbox" checked={draft.ephemeral} onChange={(event) => onChange({ ...draft, ephemeral: event.target.checked })} />
        Ephemeral
      </label>
      <div className="discord-preview wide">
        <strong>/utility customcommand run {draft.name || "command"}</strong>
        <p>{draft.responseContent || "Vorschau der Antwort"}</p>
      </div>
    </div>
  );
}

function EditableCustomCommand({ guildId, command, onChanged }: { guildId: string; command: CustomCommand; onChanged: () => Promise<void> }) {
  const [draft, setDraft] = useState({
    name: command.name,
    description: command.description,
    responseContent: command.responseContent,
    enabled: command.enabled,
    ephemeral: command.ephemeral,
    cooldownSeconds: command.cooldownSeconds
  });
  const [status, setStatus] = useState<string | null>(null);

  async function save() {
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/custom-commands/${command.id}`, {
        method: "PATCH",
        body: JSON.stringify(draft)
      });
      setStatus("Gespeichert.");
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    }
  }

  async function remove() {
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/custom-commands/${command.id}`, { method: "DELETE" });
      await onChanged();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Löschen fehlgeschlagen.");
    }
  }

  return (
    <article className="custom-item">
      <div className="panel-title compact">
        <h3>/{command.name}</h3>
        <span className={command.syncStatus === "failed" ? "pill danger" : "pill"}>{command.syncStatus}</span>
      </div>
      <CommandEditor draft={draft} onChange={setDraft} />
      {command.syncError && <Notice tone="danger" text={command.syncError} />}
      <ActionStatus status={status} />
      <div className="action-row">
        <button className="primary-action inline" onClick={save}>
          <Save size={16} />
          Speichern
        </button>
        <button className="danger-action inline" onClick={remove}>
          <Trash2 size={16} />
          Löschen
        </button>
      </div>
    </article>
  );
}

function AuditLogPage({ guildId }: { guildId: string }) {
  const audit = useApi<{ auditLog: Array<Record<string, string>> }>(`/api/guilds/${guildId}/audit-log`, [guildId]);
  return (
    <section className="panel">
      <div className="panel-title">
        <h2>Audit-Log</h2>
        <RefreshButton loading={audit.loading && Boolean(audit.data)} onClick={audit.reload} label="Neu laden" />
      </div>
      {audit.loading && !audit.data && <LoadingBlock />}
      {audit.error && <Notice tone="danger" text={audit.error} />}
      <div className="audit-table">
        {audit.data?.auditLog.map((entry) => (
          <article key={entry.id}>
            <strong>{entry.action}</strong>
            <span>{entry.target}</span>
            <span>{entry.actorDiscordUserId}</span>
            <time>{new Date(entry.createdAt).toLocaleString("de-DE")}</time>
          </article>
        ))}
      </div>
    </section>
  );
}

function SyncPill({ status }: { status: string }) {
  const tone = status === "failed" ? "danger" : status === "synced" ? "ok" : "neutral";
  const label = status === "failed" ? "Sync fehlgeschlagen" : status === "pending" ? "Wird synchronisiert" : status === "synced" ? "Synchronisiert" : "Bereit";
  return <span className={`pill ${tone}`}>{label}</span>;
}

function ControlToggle({
  icon,
  title,
  text,
  checked,
  onChange,
  children
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  return (
    <div className={`control-toggle-row ${checked ? "active" : ""}`}>
      <span className="control-toggle-icon">{icon}</span>
      <div className="control-toggle-copy"><strong>{title}</strong><small>{text}</small></div>
      <label className="compact-switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span />
      </label>
      {children && <div className="control-toggle-settings">{children}</div>}
    </div>
  );
}

function NumberSetting({ label, value, min, max, suffix, onChange }: { label: string; value: number; min: number; max: number; suffix: string; onChange: (value: number) => void }) {
  return (
    <label className="number-setting">
      <span>{label}</span>
      <div><input type="number" min={min} max={max} value={value} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || 0)))} /><small>{suffix}</small></div>
    </label>
  );
}

function RoleChecklist({
  roles,
  selected,
  onToggle,
  emptyText = "Keine verwaltbaren Rollen verfügbar."
}: {
  roles: RoleOption[];
  selected: string[];
  onToggle: (roleId: string) => void;
  emptyText?: string;
}) {
  if (!roles.length) return <p className="muted">{emptyText}</p>;
  return (
    <div className="control-role-list">
      {roles.map((role) => {
        const active = selected.includes(role.id);
        return (
          <button type="button" className={active ? "selected" : ""} onClick={() => onToggle(role.id)} key={role.id}>
            <i style={{ background: roleColor(role) }} />
            <span><strong>{role.name}</strong><small>{role.id}</small></span>
            {active ? <Check size={15} /> : <Plus size={15} />}
          </button>
        );
      })}
    </div>
  );
}

function FeatureChannelChecklist({
  channels,
  selected,
  onToggle
}: {
  channels: ChannelOption[];
  selected: string[];
  onToggle: (channelId: string) => void;
}) {
  if (!channels.length) return <p className="muted">Keine passenden Textkanäle verfügbar.</p>;

  return (
    <div className="feature-resource-list">
      {groupedChannels(channels).map((group) => (
        <section key={group.label}>
          <span>{group.label}</span>
          {group.items.map((channel) => {
            const active = selected.includes(channel.id);
            return (
              <button type="button" className={active ? "selected" : ""} onClick={() => onToggle(channel.id)} key={channel.id}>
                <Hash size={15} />
                <span><strong>{channel.name}</strong><small>{channelTypeLabel(channel.type)}</small></span>
                {active ? <Check size={15} /> : <Plus size={15} />}
              </button>
            );
          })}
        </section>
      ))}
    </div>
  );
}

function FeatureModulePage({ guildId, definition }: { guildId: string; definition: FeatureDefinition }) {
  const settings = useApi<{ feature: FeatureSettings }>(`/api/guilds/${guildId}/features/${definition.module}`, [guildId, definition.module]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState<FeatureSettings>({
    enabled: false,
    fields: {},
    syncStatus: "idle",
    syncError: null,
    updatedAt: null
  });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.feature) {
      setDraft({
        ...settings.data.feature,
        enabled: Boolean(settings.data.feature.enabled),
        fields: settings.data.feature.fields && typeof settings.data.feature.fields === "object"
          ? settings.data.feature.fields
          : {}
      });
    }
  }, [settings.data]);

  const textChannels = useMemo(
    () => (channels.data?.channels ?? []).filter((channel) => isTextGuildChannel(channel) && channel.canSend !== false),
    [channels.data]
  );
  const categoryChannels = useMemo(
    () => (channels.data?.channels ?? []).filter((channel) => ["category", "kategorie"].includes(channel.type.toLowerCase())),
    [channels.data]
  );
  const availableRoles = useMemo(
    () => (roles.data?.roles ?? []).filter((role) => !role.managed && role.name !== "@everyone"),
    [roles.data]
  );
  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data) || (roles.loading && !roles.data);
  const loadError = settings.error || channels.error || roles.error;

  function setField(key: string, value: FeatureValue) {
    setDraft((current) => ({ ...current, fields: { ...current.fields, [key]: value } }));
  }

  function toggleListField(key: string, value: string) {
    const current = Array.isArray(draft.fields[key]) ? draft.fields[key] as string[] : [];
    setField(key, current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]);
  }

  async function reload() {
    setStatus(null);
    await Promise.all([settings.reload(), channels.reload(), roles.reload()]);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ feature: FeatureSettings }>(`/api/guilds/${guildId}/features/${definition.module}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: draft.enabled, fields: draft.fields })
      });
      setDraft(response.feature);
      setStatus(`${definition.label} wurde gespeichert. Der Bot übernimmt die Konfiguration jetzt.`);
      await settings.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : `${definition.label} konnte nicht gespeichert werden.`);
    } finally {
      setSaving(false);
    }
  }

  function renderField(field: FeatureFieldDefinition) {
    const value = draft.fields[field.key];
    const className = `feature-field ${field.wide ? "wide" : ""}`;

    if (field.type === "toggle") {
      return (
        <div className={`${className} feature-toggle-field`} key={field.key}>
          <div><strong>{field.label}</strong><small>{field.description}</small></div>
          <label className="compact-switch">
            <input type="checkbox" checked={Boolean(value)} onChange={(event) => setField(field.key, event.target.checked)} />
            <span />
          </label>
        </div>
      );
    }

    if (field.type === "roles") {
      return (
        <div className={className} key={field.key}>
          <header><strong>{field.label}</strong><small>{field.description}</small></header>
          <RoleChecklist roles={availableRoles} selected={Array.isArray(value) ? value : []} onToggle={(roleId) => toggleListField(field.key, roleId)} />
        </div>
      );
    }

    if (field.type === "channels") {
      return (
        <div className={className} key={field.key}>
          <header><strong>{field.label}</strong><small>{field.description}</small></header>
          <FeatureChannelChecklist channels={textChannels} selected={Array.isArray(value) ? value : []} onToggle={(channelId) => toggleListField(field.key, channelId)} />
        </div>
      );
    }

    return (
      <label className={className} key={field.key}>
        <span><strong>{field.label}</strong><small>{field.description}</small></span>
        {field.type === "textarea" && (
          <textarea value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(event) => setField(field.key, event.target.value)} />
        )}
        {field.type === "text" && (
          <input type="text" value={typeof value === "string" ? value : ""} placeholder={field.placeholder} onChange={(event) => setField(field.key, event.target.value)} />
        )}
        {field.type === "number" && (
          <div className="feature-number-input">
            <input
              type="number"
              min={field.min}
              max={field.max}
              value={typeof value === "number" ? value : field.min ?? 0}
              onChange={(event) => setField(field.key, Math.max(field.min ?? -1000000, Math.min(field.max ?? 1000000, Number(event.target.value) || 0)))}
            />
            {field.suffix && <small>{field.suffix}</small>}
          </div>
        )}
        {field.type === "select" && (
          <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field.key, event.target.value)}>
            {(field.options ?? []).map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        )}
        {field.type === "channel" && (
          <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field.key, event.target.value)}>
            <ChannelSelectOptions channels={textChannels} noneLabel="Kein Kanal" />
          </select>
        )}
        {field.type === "category" && (
          <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field.key, event.target.value)}>
            <option value="">Keine Kategorie</option>
            {categoryChannels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}
          </select>
        )}
        {field.type === "role" && (
          <select value={typeof value === "string" ? value : ""} onChange={(event) => setField(field.key, event.target.value)}>
            <option value="">Keine Rolle</option>
            {availableRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}
          </select>
        )}
      </label>
    );
  }

  return (
    <section className="control-page feature-control">
      <header className="control-hero feature-hero">
        <div className="feature-hero-icon">{definition.icon}</div>
        <div>
          <p className="eyebrow">{definition.kicker}</p>
          <h2>{definition.label}</h2>
          <p>{definition.description}</p>
        </div>
        <div className="control-hero-actions">
          <SyncPill status={draft.syncStatus} />
          <label className="feature-master-toggle">
            <input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />
            <span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span>
          </label>
          <RefreshButton loading={settings.loading || channels.loading || roles.loading} onClick={() => void reload()} />
        </div>
      </header>

      {loading && <LoadingBlock text={`${definition.label} wird geladen`} />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />

      {!loading && !draft.enabled && (
        <section className="feature-inactive">
          <span>{definition.icon}</span>
          <div><h3>{definition.label} ist inaktiv</h3><p>Aktiviere das Modul oben. Danach werden alle Einstellungen eingeblendet und können gemeinsam gespeichert werden.</p></div>
          <button className="primary-action inline" type="button" onClick={() => setDraft({ ...draft, enabled: true })}><Power size={16} /> Aktivieren</button>
        </section>
      )}

      {!loading && draft.enabled && (
        <>
          <div className="feature-field-grid">
            {definition.fields.map(renderField)}
          </div>
          <footer className="control-savebar">
            <div>
              <strong>{definition.label} speichern</strong>
              <span>Kanal- und Rollenwerte werden vor der Übernahme serverseitig geprüft.</span>
            </div>
            <button className="primary-action inline" type="button" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
              {saving ? "Wird gespeichert" : "Änderungen speichern"}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

function SecurityPage({ guildId }: { guildId: string }) {
  const settings = useApi<{ security: SecuritySettings }>(`/api/guilds/${guildId}/security`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState(DEFAULT_SECURITY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data?.security) setDraft(settings.data.security);
  }, [settings.data]);

  const textChannels = useMemo(() => (channels.data?.channels ?? []).filter(isTextGuildChannel), [channels.data]);
  const manageableRoles = useMemo(() => (roles.data?.roles ?? []).filter((role) => role.botCanManage && !role.managed), [roles.data]);
  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data) || (roles.loading && !roles.data);
  const loadError = settings.error || channels.error || roles.error;

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await api<{ security: SecuritySettings }>(`/api/guilds/${guildId}/security`, {
        method: "PUT",
        body: JSON.stringify({
          antispamEnabled: draft.antispamEnabled,
          antispamMessageLimit: draft.antispamMessageLimit,
          antispamWindowSeconds: draft.antispamWindowSeconds,
          antispamTimeoutSeconds: draft.antispamTimeoutSeconds,
          antilinkEnabled: draft.antilinkEnabled,
          antilinkTimeoutSeconds: draft.antilinkTimeoutSeconds,
          antiinviteEnabled: draft.antiinviteEnabled,
          antiinviteTimeoutSeconds: draft.antiinviteTimeoutSeconds,
          antimentionLimit: draft.antimentionLimit,
          antimentionTimeoutSeconds: draft.antimentionTimeoutSeconds,
          accountAgeMinDays: draft.accountAgeMinDays,
          quarantineRoleId: draft.quarantineRoleId,
          verificationEnabled: draft.verificationEnabled,
          verificationChannelId: draft.verificationChannelId,
          verificationRoleId: draft.verificationRoleId,
          verificationTitle: draft.verificationTitle,
          verificationText: draft.verificationText,
          auditLogWatchEnabled: draft.auditLogWatchEnabled,
          antinukeEnabled: draft.antinukeEnabled,
          antinukeLimit: draft.antinukeLimit,
          antinukeWindowSeconds: draft.antinukeWindowSeconds,
          antinukePunishment: draft.antinukePunishment,
          allowedDomains: draft.allowedDomains,
          blockedDomains: draft.blockedDomains
        })
      });
      setDraft(response.security);
      setStatus("Security-Einstellungen gespeichert. Der Bot übernimmt sie jetzt.");
      await settings.reload();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Security-Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  function parseDomains(value: string) {
    return Array.from(new Set(value.split(/[\s,;]+/).map((entry) => entry.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]).filter(Boolean)));
  }

  return (
    <section className="control-page security-control">
      <header className="control-hero">
        <div><p className="eyebrow"><ShieldCheck size={15} /> Guild Protection</p><h2>Security Center</h2><p>Alle aktiven Schutzregeln, Prüfungen und Eskalationen in einer sauberen Sicherheitszentrale.</p></div>
        <div className="control-hero-actions"><SyncPill status={draft.syncStatus} /><RefreshButton loading={settings.loading} onClick={async () => { await Promise.all([settings.reload(), channels.reload(), roles.reload()]); }} /></div>
      </header>
      {loading && <LoadingBlock />}
      {loadError && <Notice tone="danger" text={loadError} />}
      {draft.syncError && <Notice tone="danger" text={draft.syncError} />}
      <ActionStatus status={status} />
      {!loading && !loadError && <>
        <div className="control-stat-grid">
          <StatusTile icon={<ShieldCheck size={19} />} label="Security Score" value={`${draft.healthScore}%`} tone={draft.healthScore >= 70 ? "ok" : "warn"} />
          <StatusTile icon={<Activity size={19} />} label="Aktive Schutzmodule" value={`${draft.activeProtections}/${draft.totalProtections}`} />
          <StatusTile icon={<BadgeCheck size={19} />} label="Rollenrechte" value={draft.botCanManageRoles ? "bereit" : "fehlen"} tone={draft.botCanManageRoles ? "ok" : "warn"} />
          <StatusTile icon={<ClipboardList size={19} />} label="Audit-Log" value={draft.botCanViewAuditLog ? "sichtbar" : "nicht sichtbar"} tone={draft.botCanViewAuditLog ? "ok" : "warn"} />
        </div>
        <div className="control-columns">
          <div className="control-stack">
            <section className="panel control-panel">
              <div className="panel-title compact"><div><h2>Nachrichten-Schutz</h2><p className="muted">Spam, Links, Einladungen und Mention-Fluten begrenzen.</p></div></div>
              <div className="control-toggle-list">
                <ControlToggle icon={<MessageSquare size={17} />} title="Antispam" text="Zu viele Nachrichten in einem Zeitfenster erkennen." checked={draft.antispamEnabled} onChange={(value) => setDraft({ ...draft, antispamEnabled: value })}>
                  <NumberSetting label="Nachrichten" value={draft.antispamMessageLimit} min={2} max={30} suffix="Anzahl" onChange={(value) => setDraft({ ...draft, antispamMessageLimit: value })} />
                  <NumberSetting label="Zeitfenster" value={draft.antispamWindowSeconds} min={2} max={120} suffix="Sek." onChange={(value) => setDraft({ ...draft, antispamWindowSeconds: value })} />
                  <NumberSetting label="Timeout" value={draft.antispamTimeoutSeconds} min={0} max={86400} suffix="Sek." onChange={(value) => setDraft({ ...draft, antispamTimeoutSeconds: value })} />
                </ControlToggle>
                <ControlToggle icon={<Globe2 size={17} />} title="Antilink" text="Weblinks anhand deiner Domainregeln filtern." checked={draft.antilinkEnabled} onChange={(value) => setDraft({ ...draft, antilinkEnabled: value })}>
                  <NumberSetting label="Timeout" value={draft.antilinkTimeoutSeconds} min={0} max={86400} suffix="Sek." onChange={(value) => setDraft({ ...draft, antilinkTimeoutSeconds: value })} />
                </ControlToggle>
                <ControlToggle icon={<ExternalLink size={17} />} title="Antiinvite" text="Discord-Einladungslinks blockieren." checked={draft.antiinviteEnabled} onChange={(value) => setDraft({ ...draft, antiinviteEnabled: value })}>
                  <NumberSetting label="Timeout" value={draft.antiinviteTimeoutSeconds} min={0} max={86400} suffix="Sek." onChange={(value) => setDraft({ ...draft, antiinviteTimeoutSeconds: value })} />
                </ControlToggle>
              </div>
              <div className="control-field-grid">
                <NumberSetting label="Mention-Limit (0 = aus)" value={draft.antimentionLimit} min={0} max={50} suffix="Mentions" onChange={(value) => setDraft({ ...draft, antimentionLimit: value })} />
                <NumberSetting label="Mention-Timeout" value={draft.antimentionTimeoutSeconds} min={0} max={86400} suffix="Sek." onChange={(value) => setDraft({ ...draft, antimentionTimeoutSeconds: value })} />
                <NumberSetting label="Account-Mindestalter" value={draft.accountAgeMinDays} min={0} max={3650} suffix="Tage" onChange={(value) => setDraft({ ...draft, accountAgeMinDays: value })} />
              </div>
            </section>
            <section className="panel control-panel">
              <div className="panel-title compact"><div><h2>Domainregeln</h2><p className="muted">Eine Domain pro Zeile oder durch Komma getrennt, ohne Protokoll.</p></div></div>
              <div className="control-field-grid two">
                <label>Erlaubte Domains<textarea rows={5} value={draft.allowedDomains.join("\n")} onChange={(event) => setDraft({ ...draft, allowedDomains: parseDomains(event.target.value) })} placeholder="example.com" /></label>
                <label>Blockierte Domains<textarea rows={5} value={draft.blockedDomains.join("\n")} onChange={(event) => setDraft({ ...draft, blockedDomains: parseDomains(event.target.value) })} placeholder="bad-example.com" /></label>
              </div>
            </section>
          </div>
          <div className="control-stack">
            <section className="panel control-panel">
              <div className="panel-title compact"><div><h2>Verifizierung</h2><p className="muted">Button-Panel und Rolle direkt vom Bot verwalten lassen.</p></div></div>
              <ControlToggle icon={<BadgeCheck size={17} />} title="Button-Verifizierung" text="Sendet oder aktualisiert das Verifizierungspanel." checked={draft.verificationEnabled} onChange={(value) => setDraft({ ...draft, verificationEnabled: value })} />
              <div className="control-field-grid two">
                <label>Textkanal<select value={draft.verificationChannelId ?? ""} onChange={(event) => setDraft({ ...draft, verificationChannelId: event.target.value || null })}><ChannelSelectOptions channels={textChannels} noneLabel="Kanal auswählen" /></select></label>
                <label>Verifizierungsrolle<select value={draft.verificationRoleId ?? ""} onChange={(event) => setDraft({ ...draft, verificationRoleId: event.target.value || null })}><option value="">Rolle auswählen</option>{manageableRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
                <label>Titel<input maxLength={100} value={draft.verificationTitle} onChange={(event) => setDraft({ ...draft, verificationTitle: event.target.value })} /></label>
                <label className="wide">Nachricht<textarea rows={4} maxLength={1500} value={draft.verificationText} onChange={(event) => setDraft({ ...draft, verificationText: event.target.value })} /></label>
              </div>
            </section>
            <section className="panel control-panel danger-panel">
              <div className="panel-title compact"><div><h2>Anti-Nuke & Quarantäne</h2><p className="muted">Massenaktionen erkennen und kontrolliert bestrafen.</p></div></div>
              <ControlToggle icon={<Shield size={17} />} title="Anti-Nuke" text="Audit-Aktionen innerhalb eines Zeitfensters zählen." checked={draft.antinukeEnabled} onChange={(value) => setDraft({ ...draft, antinukeEnabled: value })} />
              <div className="control-field-grid two">
                <NumberSetting label="Aktionslimit" value={draft.antinukeLimit} min={1} max={20} suffix="Aktionen" onChange={(value) => setDraft({ ...draft, antinukeLimit: value })} />
                <NumberSetting label="Zeitfenster" value={draft.antinukeWindowSeconds} min={10} max={600} suffix="Sek." onChange={(value) => setDraft({ ...draft, antinukeWindowSeconds: value })} />
                <label>Reaktion<select value={draft.antinukePunishment} onChange={(event) => setDraft({ ...draft, antinukePunishment: event.target.value as SecuritySettings["antinukePunishment"] })}><option value="log">Nur protokollieren</option><option value="timeout">Timeout</option><option value="kick">Kicken</option><option value="ban">Bannen</option><option value="quarantine">Quarantäne</option></select></label>
                <label>Quarantäne-Rolle<select value={draft.quarantineRoleId ?? ""} onChange={(event) => setDraft({ ...draft, quarantineRoleId: event.target.value || null })}><option value="">Keine Rolle</option>{manageableRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
              </div>
              <ControlToggle icon={<ClipboardList size={17} />} title="Audit-Watch" text="Kritische Audit-Log-Aktionen überwachen." checked={draft.auditLogWatchEnabled} onChange={(value) => setDraft({ ...draft, auditLogWatchEnabled: value })} />
            </section>
          </div>
        </div>
        <div className="control-savebar"><div><strong>{draft.activeProtections} Schutzmodule aktiv</strong><small>Änderungen werden über die sichere Bot-Queue synchronisiert.</small></div><button className="primary-action inline" onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Security speichern</button></div>
      </>}
    </section>
  );
}

function RaidmodePage({ guildId }: { guildId: string }) {
  const settings = useApi<{ raidmode: RaidSettings }>(`/api/guilds/${guildId}/raidmode`, [guildId]);
  const [draft, setDraft] = useState(DEFAULT_RAID_DRAFT);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (settings.data?.raidmode) setDraft(settings.data.raidmode); }, [settings.data]);

  async function save() {
    setSaving(true); setStatus(null);
    try {
      const response = await api<{ raidmode: RaidSettings }>(`/api/guilds/${guildId}/raidmode`, { method: "PUT", body: JSON.stringify({ profile: draft.profile, panicEnabled: draft.panicEnabled, panicSlowmodeSeconds: draft.panicSlowmodeSeconds }) });
      setDraft(response.raidmode); setStatus("Raid-Schutz gespeichert. Der Bot setzt das Profil jetzt um."); await settings.reload();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Raidmode konnte nicht gespeichert werden."); }
    finally { setSaving(false); }
  }

  const profiles = [
    { key: "off" as const, title: "Aus", text: "Kein Raid-Profil greift in die Schutzmodule ein.", icon: Power },
    { key: "light" as const, title: "Leicht", text: "Antispam, Antiinvite und Mention-Limit für normalen Schutz.", icon: ShieldCheck },
    { key: "strict" as const, title: "Streng", text: "Join-Sperre plus verschärfter Nachrichten- und Accountschutz.", icon: AlertTriangle }
  ];
  return (
    <section className="control-page raid-control">
      <header className="control-hero raid"><div><p className="eyebrow"><AlertTriangle size={15} /> Incident Response</p><h2>Raidmode</h2><p>Schutzprofile kontrolliert aktivieren und bei einem laufenden Angriff sofort den Panic-Modus auslösen.</p></div><div className="control-hero-actions"><SyncPill status={draft.syncStatus} /><RefreshButton loading={settings.loading} onClick={settings.reload} /></div></header>
      {settings.loading && !settings.data && <LoadingBlock />}{settings.error && <Notice tone="danger" text={settings.error} />}{draft.syncError && <Notice tone="danger" text={draft.syncError} />}<ActionStatus status={status} />
      {settings.data && <>
        <div className="control-stat-grid"><StatusTile icon={<Activity size={19} />} label="Raidmode" value={draft.raidmodeEnabled ? "aktiv" : "inaktiv"} tone={draft.raidmodeEnabled ? "warn" : "ok"} /><StatusTile icon={<AlertTriangle size={19} />} label="Panic" value={draft.panicEnabled ? "aktiv" : "bereit"} tone={draft.panicEnabled ? "warn" : "ok"} /><StatusTile icon={<UsersRound size={19} />} label="Mitglieder" value={String(draft.memberCount)} /><StatusTile icon={<Hash size={19} />} label="Textkanäle" value={String(draft.textChannelCount)} /></div>
        <section className="panel control-panel"><div className="panel-title compact"><div><h2>Schutzprofil</h2><p className="muted">Ein Profil setzt die zusammengehörigen Security-Regeln atomar.</p></div></div><div className="raid-profile-grid">{profiles.map((profile) => { const Icon = profile.icon; return <button type="button" className={draft.profile === profile.key ? "selected" : ""} onClick={() => setDraft({ ...draft, profile: profile.key })} key={profile.key}><span><Icon size={19} /></span><strong>{profile.title}</strong><small>{profile.text}</small>{draft.profile === profile.key && <Check size={17} />}</button>; })}</div></section>
        <section className={`panel panic-panel ${draft.panicEnabled ? "active" : ""}`}><div className="panic-copy"><span><AlertTriangle size={21} /></span><div><h2>Panic-Modus</h2><p>Aktiviert das strenge Profil und setzt den gewählten Slowmode auf alle Textkanäle. Beim Ausschalten stellt der Bot die vorherigen Werte wieder her.</p></div></div><label className="welcome-switch"><input type="checkbox" checked={draft.panicEnabled} onChange={(event) => setDraft({ ...draft, panicEnabled: event.target.checked })} /><span>{draft.panicEnabled ? "Aktiv" : "Bereit"}</span></label><NumberSetting label="Slowmode" value={draft.panicSlowmodeSeconds} min={0} max={21600} suffix="Sek." onChange={(value) => setDraft({ ...draft, panicSlowmodeSeconds: value })} /></section>
        <div className="control-savebar"><div><strong>Profil: {profiles.find((profile) => profile.key === draft.profile)?.title}</strong><small>{draft.panicEnabled ? "Panic wird beim Speichern sofort ausgelöst." : "Änderungen werden nach dem Speichern vom Bot angewendet."}</small></div><button className={draft.panicEnabled ? "danger-action inline" : "primary-action inline"} onClick={() => void save()} disabled={saving}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{draft.panicEnabled ? "Panic aktivieren" : "Raidmode speichern"}</button></div>
      </>}
    </section>
  );
}

function TicketSystemPage({ guildId }: { guildId: string }) {
  const settings = useApi<{ tickets: TicketSettings }>(`/api/guilds/${guildId}/tickets`, [guildId]);
  const channels = useApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [draft, setDraft] = useState(DEFAULT_TICKET_DRAFT);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (settings.data?.tickets) setDraft(settings.data.tickets); }, [settings.data]);
  const textChannels = useMemo(() => (channels.data?.channels ?? []).filter(isTextGuildChannel), [channels.data]);
  const categoryChannels = useMemo(() => (channels.data?.channels ?? []).filter((channel) => channel.type.toLowerCase() === "category"), [channels.data]);
  const manageableRoles = useMemo(() => (roles.data?.roles ?? []).filter((role) => role.botCanManage && !role.managed), [roles.data]);
  const loading = (settings.loading && !settings.data) || (channels.loading && !channels.data) || (roles.loading && !roles.data);
  const loadError = settings.error || channels.error || roles.error;

  function toggleList(key: "supportRoleIds" | "blacklistRoleIds", id: string) {
    setDraft((current) => ({ ...current, [key]: current[key].includes(id) ? current[key].filter((value) => value !== id) : [...current[key], id] }));
  }
  function updateCategory(index: number, patch: Partial<TicketCategory>) {
    setDraft((current) => ({ ...current, selectCategories: current.selectCategories.map((category, position) => position === index ? { ...category, ...patch } : category) }));
  }
  function ticketPayload(value: TicketSettings) {
    return {
      enabled: value.enabled, ticketCategoryId: value.ticketCategoryId, panelChannelId: value.panelChannelId, logChannelId: value.logChannelId,
      supportRoleIds: value.supportRoleIds, notifyRoleId: value.notifyRoleId, panelTitle: value.panelTitle, panelDescription: value.panelDescription,
      formTitle: value.formTitle, formQuestions: value.formQuestions, selectCategories: value.selectCategories, ratingEnabled: value.ratingEnabled,
      autoCloseHours: value.autoCloseHours, reminderHours: value.reminderHours, slaHours: value.slaHours,
      blacklistRoleIds: value.blacklistRoleIds, blacklistUserIds: value.blacklistUserIds
    };
  }
  async function persist(): Promise<boolean> {
    setSaving(true); setStatus(null);
    try {
      const response = await api<{ tickets: TicketSettings }>(`/api/guilds/${guildId}/tickets`, { method: "PUT", body: JSON.stringify(ticketPayload(draft)) });
      setDraft(response.tickets); setStatus("Ticketsystem gespeichert. Der Bot übernimmt die Konfiguration jetzt."); await settings.reload(); return true;
    } catch (error) { setStatus(error instanceof Error ? error.message : "Ticketsystem konnte nicht gespeichert werden."); return false; }
    finally { setSaving(false); }
  }
  async function sendPanel() {
    if (!draft.panelChannelId) { setStatus("Wähle zuerst einen Panel-Kanal aus."); return; }
    setSending(true); setStatus(null);
    try {
      if (!(await persist())) return;
      await api(`/api/guilds/${guildId}/tickets/panel`, { method: "POST", body: JSON.stringify({ channelId: draft.panelChannelId }) });
      setStatus("Das Ticket-Panel wird jetzt vom Bot in Discord gesendet."); await settings.reload();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Ticket-Panel konnte nicht gesendet werden."); }
    finally { setSending(false); }
  }

  return (
    <section className="control-page ticket-control">
      <header className="control-hero"><div><p className="eyebrow"><LifeBuoy size={15} /> Support Operations</p><h2>Ticket-System</h2><p>Panel, Teamrollen, Formular, Kategorien und Ticket-Automationen vollständig an einem Ort steuern.</p></div><div className="control-hero-actions"><SyncPill status={draft.syncStatus} /><label className="welcome-switch"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} /><span>{draft.enabled ? "Aktiv" : "Inaktiv"}</span></label></div></header>
      {loading && <LoadingBlock />}{loadError && <Notice tone="danger" text={loadError} />}{draft.syncError && <Notice tone="danger" text={draft.syncError} />}<ActionStatus status={status} />
      {!loading && !loadError && <>
        <div className="control-stat-grid"><StatusTile icon={<LifeBuoy size={19} />} label="Offen" value={String(draft.openTickets)} tone={draft.openTickets ? "warn" : "ok"} /><StatusTile icon={<Check size={19} />} label="Geschlossen" value={String(draft.closedTickets)} /><StatusTile icon={<ClipboardList size={19} />} label="Gesamt" value={String(draft.totalTickets)} /><StatusTile icon={<Star size={19} />} label="Bewertung" value={draft.averageRating === null ? "keine" : `${draft.averageRating}/5`} tone={draft.averageRating !== null && draft.averageRating >= 4 ? "ok" : undefined} /></div>
        <div className="control-columns ticket-columns">
          <div className="control-stack">
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Grundkonfiguration</h2><p className="muted">Discord-Ziele für neue Tickets, Panel und Protokolle.</p></div><RefreshButton loading={settings.loading || channels.loading || roles.loading} onClick={async () => { await Promise.all([settings.reload(), channels.reload(), roles.reload()]); }} /></div><div className="control-field-grid two"><label>Ticket-Kategorie<select value={draft.ticketCategoryId ?? ""} onChange={(event) => setDraft({ ...draft, ticketCategoryId: event.target.value || null })}><option value="">Kategorie auswählen</option>{categoryChannels.map((channel) => <option value={channel.id} key={channel.id}>{channel.name}</option>)}</select></label><label>Panel-Kanal<select value={draft.panelChannelId ?? ""} onChange={(event) => setDraft({ ...draft, panelChannelId: event.target.value || null })}><ChannelSelectOptions channels={textChannels} noneLabel="Kanal auswählen" /></select></label><label>Log-Kanal<select value={draft.logChannelId ?? ""} onChange={(event) => setDraft({ ...draft, logChannelId: event.target.value || null })}><ChannelSelectOptions channels={textChannels} noneLabel="Kein eigener Log-Kanal" /></select></label><label>Benachrichtigungsrolle<select value={draft.notifyRoleId ?? ""} onChange={(event) => setDraft({ ...draft, notifyRoleId: event.target.value || null })}><option value="">Keine Rolle</option>{manageableRoles.map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label></div></section>
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Supportrollen</h2><p className="muted">Alle ausgewählten Rollen erhalten Zugriff auf neu erstellte Tickets.</p></div><span className="pill neutral">{draft.supportRoleIds.length}/10</span></div><RoleChecklist roles={manageableRoles} selected={draft.supportRoleIds} onToggle={(id) => { if (!draft.supportRoleIds.includes(id) && draft.supportRoleIds.length >= 10) return setStatus("Maximal 10 Supportrollen sind möglich."); toggleList("supportRoleIds", id); }} /></section>
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Panel-Inhalt</h2><p className="muted">So erscheint der Einstieg in Discord.</p></div>{draft.panelMessageId && <span className="pill ok">Panel vorhanden</span>}</div><div className="control-field-grid"><label>Titel<input maxLength={100} value={draft.panelTitle} onChange={(event) => setDraft({ ...draft, panelTitle: event.target.value })} /></label><label>Beschreibung<textarea rows={4} maxLength={1000} value={draft.panelDescription} onChange={(event) => setDraft({ ...draft, panelDescription: event.target.value })} /></label></div></section>
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Ticket-Kategorien</h2><p className="muted">Bis zu 25 Auswahlpunkte für das Discord-Panel.</p></div><button type="button" className="secondary-action inline" disabled={draft.selectCategories.length >= 25} onClick={() => setDraft({ ...draft, selectCategories: [...draft.selectCategories, { label: "Neue Kategorie", description: "Beschreibe das Anliegen", emoji: "🎫", value: `kategorie-${draft.selectCategories.length + 1}` }] })}><Plus size={16} /> Kategorie</button></div><div className="ticket-builder-list">{draft.selectCategories.map((category, index) => <article key={`${category.value}-${index}`}><input aria-label="Emoji" className="ticket-emoji-input" maxLength={100} placeholder="🎫 oder <:name:id>" value={category.emoji} onChange={(event) => updateCategory(index, { emoji: event.target.value })} /><label>Name<input maxLength={80} value={category.label} onChange={(event) => updateCategory(index, { label: event.target.value })} /></label><label>Beschreibung<input maxLength={100} value={category.description} onChange={(event) => updateCategory(index, { description: event.target.value })} /></label><label>Wert<input maxLength={80} value={category.value} onChange={(event) => updateCategory(index, { value: event.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "-") })} /></label><button type="button" className="icon-button danger" title="Kategorie entfernen" onClick={() => setDraft({ ...draft, selectCategories: draft.selectCategories.filter((_, position) => position !== index) })}><Trash2 size={16} /></button></article>)}</div></section>
          </div>
          <div className="control-stack">
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Ticket-Formular</h2><p className="muted">Bis zu fünf Fragen werden im neuen Ticket angezeigt.</p></div><button type="button" className="secondary-action inline" disabled={draft.formQuestions.length >= 5} onClick={() => setDraft({ ...draft, formQuestions: [...draft.formQuestions, "Neue Frage"] })}><Plus size={16} /> Frage</button></div><label>Formular-Titel<input maxLength={100} value={draft.formTitle} onChange={(event) => setDraft({ ...draft, formTitle: event.target.value })} /></label><div className="ticket-question-list">{draft.formQuestions.map((question, index) => <div key={index}><span>{index + 1}</span><input maxLength={250} value={question} onChange={(event) => setDraft({ ...draft, formQuestions: draft.formQuestions.map((value, position) => position === index ? event.target.value : value) })} /><button type="button" className="icon-button" title="Frage entfernen" onClick={() => setDraft({ ...draft, formQuestions: draft.formQuestions.filter((_, position) => position !== index) })}><X size={16} /></button></div>)}{!draft.formQuestions.length && <p className="muted">Keine Zusatzfragen eingerichtet.</p>}</div></section>
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Automationen</h2><p className="muted">Zeiten in Stunden; 0 deaktiviert die jeweilige Funktion.</p></div></div><ControlToggle icon={<Star size={17} />} title="Bewertungen" text="Nach dem Schließen eine 1-5-Sterne-Bewertung anfragen." checked={draft.ratingEnabled} onChange={(value) => setDraft({ ...draft, ratingEnabled: value })} /><div className="control-field-grid"><NumberSetting label="Erinnerung" value={draft.reminderHours} min={0} max={720} suffix="Std." onChange={(value) => setDraft({ ...draft, reminderHours: value })} /><NumberSetting label="Auto-Close" value={draft.autoCloseHours} min={0} max={720} suffix="Std." onChange={(value) => setDraft({ ...draft, autoCloseHours: value })} /><NumberSetting label="SLA-Ziel" value={draft.slaHours} min={0} max={720} suffix="Std." onChange={(value) => setDraft({ ...draft, slaHours: value })} /></div></section>
            <section className="panel control-panel"><div className="panel-title compact"><div><h2>Zugriffssperren</h2><p className="muted">Rollen und einzelne Discord-Nutzer vom Erstellen ausschließen.</p></div></div><h3 className="control-subheading">Gesperrte Rollen</h3><RoleChecklist roles={manageableRoles} selected={draft.blacklistRoleIds} onToggle={(id) => toggleList("blacklistRoleIds", id)} /><label className="control-user-ids">Gesperrte Nutzer-IDs<textarea rows={4} value={draft.blacklistUserIds.join("\n")} onChange={(event) => setDraft({ ...draft, blacklistUserIds: Array.from(new Set(event.target.value.split(/[\s,;]+/).filter((value) => /^\d{17,20}$/.test(value)))) })} placeholder="Eine Discord-ID pro Zeile" /></label></section>
            <aside className="ticket-preview"><span>Discord Vorschau</span><div className="ticket-preview-embed"><h3>{draft.panelTitle || "Ticketsystem"}</h3><p>{draft.panelDescription || "Wähle eine Kategorie aus."}</p><small>Kategorien</small>{draft.selectCategories.slice(0, 5).map((category) => <div key={category.value}>{category.emoji} {category.label}</div>)}</div><select aria-label="Vorschau Kategorie"><option>Wähle eine Ticketkategorie...</option>{draft.selectCategories.map((category) => <option key={category.value}>{category.emoji} {category.label}</option>)}</select></aside>
          </div>
        </div>
        <div className="control-savebar"><div><strong>{draft.enabled ? "Ticketsystem aktiv" : "Ticketsystem inaktiv"}</strong><small>Speichern aktualisiert Regeln; Panel senden veröffentlicht eine neue Discord-Nachricht.</small></div><div className="form-actions"><button className="primary-action inline" onClick={() => void persist()} disabled={saving || sending}>{saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Einstellungen speichern</button><button className="secondary-action inline" onClick={() => void sendPanel()} disabled={saving || sending || !draft.enabled || !draft.panelChannelId}>{sending ? <Loader2 className="spin" size={16} /> : <Rocket size={16} />} Panel senden</button></div></div>
      </>}
    </section>
  );
}

function BackupsPage({ guildId }: { guildId: string }) {
  const backups = useApi<{ backups: BackupSettings }>(`/api/guilds/${guildId}/backups`, [guildId]);
  const [state, setState] = useState(DEFAULT_BACKUP_DRAFT);
  const [running, setRunning] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => { if (backups.data?.backups) setState(backups.data.backups); }, [backups.data]);
  const scopes = [
    { key: "roles" as const, title: "Rollen", text: "Namen, Farben, Rechte und Anzeigeeinstellungen.", icon: BadgeCheck, live: state.guildRoleCount },
    { key: "channels" as const, title: "Kanäle", text: "Kategorien, Text- und Sprachkanäle mit Basiswerten.", icon: Hash, live: state.guildChannelCount },
    { key: "full" as const, title: "Vollbackup", text: "Serverstruktur plus aktuelle Bot-Konfiguration.", icon: Database, live: state.guildRoleCount + state.guildChannelCount }
  ];
  async function action(kind: "create" | "restore" | "delete", scope: "roles" | "channels" | "full" | "all") {
    const destructive = kind !== "create";
    if (destructive && !window.confirm(kind === "restore" ? `Fehlende ${scope === "roles" ? "Rollen" : "Kanäle"} aus dem Backup wiederherstellen? Bestehende Einträge werden nicht gelöscht.` : scope === "all" ? "Wirklich alle Backups dieser Guild löschen?" : `Backup-Bereich ${scope} wirklich löschen?`)) return;
    const key = `${kind}:${scope}`; setRunning(key); setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/backups/actions`, { method: "POST", body: JSON.stringify({ action: kind, scope, confirm: destructive }) });
      setStatus(kind === "create" ? "Backup wird jetzt vom Bot erstellt." : kind === "restore" ? "Wiederherstellung wurde an den Bot gesendet." : "Backup wird jetzt gelöscht.");
      await backups.reload();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Backup-Aktion konnte nicht gestartet werden."); }
    finally { setRunning(null); }
  }
  return (
    <section className="control-page backup-control">
      <header className="control-hero"><div><p className="eyebrow"><Database size={15} /> Recovery Center</p><h2>Server-Backups</h2><p>Serverstruktur sichern, vorhandene Stände prüfen und fehlende Rollen oder Kanäle kontrolliert wiederherstellen.</p></div><div className="control-hero-actions"><SyncPill status={state.syncStatus} /><RefreshButton loading={backups.loading} onClick={backups.reload} /></div></header>
      {backups.loading && !backups.data && <LoadingBlock />}{backups.error && <Notice tone="danger" text={backups.error} />}{state.syncError && <Notice tone="danger" text={state.syncError} />}<ActionStatus status={status} />
      {backups.data && <>
        <div className="control-stat-grid"><StatusTile icon={<BadgeCheck size={19} />} label="Live-Rollen" value={String(state.guildRoleCount)} /><StatusTile icon={<Hash size={19} />} label="Live-Kanäle" value={String(state.guildChannelCount)} /><StatusTile icon={<Database size={19} />} label="Backup-Bereiche" value={String(state.items.length)} tone={state.items.length ? "ok" : "warn"} /><StatusTile icon={<Clock3 size={19} />} label="Letzte Sicherung" value={state.lastSavedAt ? formatDateTime(state.lastSavedAt) : "keine"} /></div>
        <div className="backup-grid">{scopes.map((scope) => { const Icon = scope.icon; const item = state.items.find((entry) => entry.scope === scope.key); return <article className="backup-card" key={scope.key}><header><span><Icon size={19} /></span><div><h2>{scope.title}</h2><p>{scope.text}</p></div><span className={`pill ${item ? "ok" : "neutral"}`}>{item ? "gesichert" : "leer"}</span></header><dl><div><dt>Live</dt><dd>{scope.live} Einträge</dd></div><div><dt>Backup</dt><dd>{item ? `${item.itemCount} Einträge` : "Noch keines"}</dd></div><div><dt>Stand</dt><dd>{item?.savedAt ? formatDateTime(item.savedAt) : "-"}</dd></div></dl><div className="backup-actions"><button className="primary-action inline" onClick={() => void action("create", scope.key)} disabled={Boolean(running)}>{running === `create:${scope.key}` ? <Loader2 className="spin" size={16} /> : <Save size={16} />}{item ? "Neu sichern" : "Backup erstellen"}</button>{scope.key !== "full" && <button className="secondary-action inline" onClick={() => void action("restore", scope.key)} disabled={!item || Boolean(running)}>{running === `restore:${scope.key}` ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />} Wiederherstellen</button>}<button className="icon-button danger" title={`${scope.title}-Backup löschen`} onClick={() => void action("delete", scope.key)} disabled={!item || Boolean(running)}><Trash2 size={16} /></button></div></article>; })}</div>
        <section className="backup-note"><ShieldCheck size={19} /><div><strong>Sichere Wiederherstellung</strong><p>Restore erstellt ausschließlich fehlende Rollen, Kategorien und Kanäle. Bestehende Discord-Strukturen werden dabei nicht gelöscht oder überschrieben.</p></div>{state.items.length > 0 && <button className="danger-action inline" onClick={() => void action("delete", "all")} disabled={Boolean(running)}>{running === "delete:all" ? <Loader2 className="spin" size={16} /> : <Trash2 size={16} />} Alle Backups löschen</button>}</section>
      </>}
    </section>
  );
}

function PlannedPage({ section }: { section: PlannedSection }) {
  const isDanger = "tone" in section && section.tone === "danger";

  return (
    <section className="planned-page">
      <div className={`planned-hero ${isDanger ? "danger" : ""}`}>
        <div className="planned-icon">{plannedIcon(section.section, 24)}</div>
        <div>
          <span className="pill neutral">Geplant</span>
          <h2>{section.headline}</h2>
          <p>{section.description}</p>
        </div>
      </div>
      <div className="planned-grid">
        {section.items.map((item) => (
          <article className="planned-card" key={item.title}>
            <span>{item.kicker}</span>
            <h3>{item.title}</h3>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function Notice({ tone, text }: { tone: "danger" | "warning"; text: string }) {
  return (
    <div className={`notice ${tone}`}>
      <AlertTriangle size={17} />
      {text}
    </div>
  );
}

function ActionStatus({ status }: { status: string | null }) {
  if (!status) return null;
  return <p className="action-status">{status}</p>;
}

function LoadingBlock({ text = "Laden", detail }: { text?: string; detail?: string }) {
  return (
    <div className="loading-block" role="status" aria-live="polite">
      <Loader2 className="spin" size={18} />
      <strong>{text}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="empty-state">
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="guild-grid">
      {[1, 2, 3].map((item) => (
        <div className="guild-card skeleton" key={item} />
      ))}
    </div>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
