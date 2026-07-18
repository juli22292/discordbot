import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  AtSign,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Clock3,
  ClipboardList,
  Command,
  Copy,
  Cpu,
  Database,
  Download,
  ExternalLink,
  FileJson,
  Gauge,
  Gamepad2,
  HardDrive,
  Home,
  Hash,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  ListFilter,
  Loader2,
  LogOut,
  MessageSquare,
  Mic2,
  Music2,
  Palette,
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
  Trash2,
  Upload,
  UserPlus,
  UserRound,
  Wifi
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
    } | null;
    music?: {
      backend?: string;
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
    categoryId: string | null;
    categoryName: string | null;
    position: number;
    canView: boolean | null;
    canSend: boolean | null;
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
  }>;
  modules: {
    logging: boolean;
    welcome: boolean;
    tempVoice: boolean;
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
  username: string;
  displayName: string | null;
  avatar: string | null;
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
    section: "spotify-music",
    label: "Spotify Music",
    headline: "Spotify Music",
    description: "Musiksteuerung für Spotify/Lavalink mit Queue, DJ-Regeln und stabilen Player-Einstellungen.",
    items: [
      { kicker: "Player", title: "Queue & Playback", text: "Aktuelle Queue, Lautstärke, Loop, Skip und Autoplay über das Panel steuern." },
      { kicker: "Rechte", title: "DJ-Modus", text: "DJ-Rollen, Vote-Skip und erlaubte Musikkanäle sauber einstellen." },
      { kicker: "Quelle", title: "Spotify-Fokus", text: "Spotify-Suche, Playlists und Lavalink-Status zentral sichtbar machen." }
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
    case "spotify-music":
      return <Music2 size={size} />;
    case "games":
      return <Gamepad2 size={size} />;
    default:
      return <Settings size={size} />;
  }
}

function getPlannedSection(section: string) {
  return plannedSections.find((item) => item.section === section);
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
  { key: "spotifyMusic", label: "Spotify Music", text: "Musik, Lavalink und DJ-Regeln.", icon: Music2 },
  { key: "games", label: "Games", text: "Fun- und Mini-Game-Kommandos.", icon: Gamepad2 },
  { key: "moderation", label: "Moderation", text: "Warns, Timeouts und Schutzmodule.", icon: Shield }
] as const;

function usePath() {
  const [path, setPath] = useState(window.location.pathname + window.location.search);
  useEffect(() => {
    const listener = () => setPath(window.location.pathname + window.location.search);
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  return path;
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!(init.body instanceof FormData) && init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, {
    credentials: "include",
    ...init,
    headers
  });

  const contentType = response.headers.get("Content-Type") ?? "";
  const data = contentType.includes("application/json") ? ((await response.json()) as ApiError & T) : null;

  if (response.status === 401) {
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
  const returnTo = safeClientReturnTo(new URLSearchParams(window.location.search).get("returnTo"));
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
            <span className="signal-pill">
              <Radio size={14} />
              Webpanel bereit
            </span>
          </div>
          <div className="auth-copy">
            <p className="eyebrow">
              <Sparkles size={15} />
              EclipseBot Control
            </p>
            <h1>EclipseBot Webpanel</h1>
            <p>Server verwalten, Slash-Befehle steuern und das Bot-Profil pro Guild sauber synchronisieren.</p>
          </div>
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

function TopNav({ user }: { user?: User | null }) {
  return (
    <header className="top-nav">
      <button className="brand-link" onClick={() => navigate("/panel")}>
        <Bot size={22} />
        <span>EclipseBot</span>
      </button>
      <nav className="top-links">
        <button onClick={() => navigate("/panel")}>
          <Home size={17} />
          Panel
        </button>
        <button onClick={() => navigate("/admin")}>
          <Gauge size={17} />
          Admin
        </button>
        <button onClick={() => navigate("/dokumentation")}>
          <ClipboardList size={17} />
          Dokumentation
        </button>
        <button onClick={() => navigate("/datenschutz")}>
          <ShieldCheck size={17} />
          Datenschutz
        </button>
        <button onClick={() => navigate("/nutzungsbedingungen")}>
          <ClipboardList size={17} />
          Nutzungsbedingungen
        </button>
        <a href="https://discord.com/developers/docs/intro" target="_blank" rel="noreferrer">
          <LifeBuoy size={17} />
          Support
        </a>
      </nav>
      <span className="nav-status">
        <Activity size={14} />
        Live
      </span>
      {user && (
        <div className="user-chip">
          {user.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={18} />}
          <span>{user.displayName || user.username}</span>
          <a className="icon-button" href="/logout" title="Abmelden">
            <LogOut size={17} />
          </a>
        </div>
      )}
    </header>
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
              EclipseBot Hilfe
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
      text: "Das Panel speichert Server-ID, Servername, Icon und Bot-Status. So kann angezeigt werden, ob EclipseBot bereits installiert ist."
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
      text: "Beim Login fragt EclipseBot bei Discord deine Basisdaten ab: Discord-ID, Nutzername, Anzeigename und Avatar. Außerdem wird die Liste deiner Server geladen, damit das Panel nur Guilds zeigt, auf denen du Owner, Administrator oder eine passende Verwaltungsberechtigung bist."
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
      text: "Gespeichert werden Sprache, Zeitzone, Bot-Nickname, Avatar-Sync-Status, Command-Einstellungen, Cooldowns, Rollen- und Kanalbeschränkungen sowie Custom-Command-Texte. Diese Daten sind nötig, damit EclipseBot pro Server unterschiedlich konfiguriert werden kann."
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
              EclipseBot Datenschutz
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
      text: "Die Nutzungsbedingungen gelten für EclipseBot, das Webpanel und alle Funktionen, die darüber auf Discord-Servern gesteuert werden."
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
      text: "Diese Nutzungsbedingungen gelten für die Nutzung von EclipseBot, dem dazugehörigen Webpanel, den Discord-Bot-Funktionen, Slash-Commands, Owner-Funktionen, Server-Einstellungen, Musikfunktionen, Logging, Invites und allen weiteren Funktionen, die über den Bot oder das Panel bereitgestellt werden."
    },
    {
      eyebrow: "Discord",
      title: "Discord-Regeln bleiben verbindlich",
      text: "EclipseBot ist eine Anwendung für Discord. Deshalb gelten zusätzlich die Nutzungsbedingungen, Community Guidelines und Developer-Regeln von Discord. Du darfst EclipseBot nicht nutzen, um Discord-Regeln zu umgehen, Spam zu erzeugen, Nutzer zu belästigen, Rechte zu missbrauchen oder unzulässige Inhalte zu verbreiten."
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
      text: "EclipseBot und das Webpanel können durch Updates, Wartung, Discord-API-Änderungen, Hosting-Probleme, Lavalink-Probleme, Rate Limits, Netzwerkfehler oder Konfigurationsfehler zeitweise eingeschränkt sein. Eine dauerhafte, fehlerfreie oder unterbrechungsfreie Verfügbarkeit wird nicht garantiert."
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
      text: "Stand dieser Nutzungsbedingungen: 18. Juli 2026. Diese Seite beschreibt die Nutzung von EclipseBot und dem Webpanel verständlich für Nutzer und Serververwalter."
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
              EclipseBot Regeln
            </p>
            <h1>Nutzungsbedingungen</h1>
            <p>Klare Regeln für die Nutzung von EclipseBot, dem Webpanel, Discord-Serverfunktionen, Owner-Aktionen und technischen Sync-Funktionen.</p>
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
  const installedCount = guildList.filter((guild) => guild.botInstalled || guild.botInstallStatus === "installed").length;
  const missingCount = Math.max(guildList.length - installedCount, 0);

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
            <p>Nur Guilds mit Verwaltungsrechten werden angezeigt.</p>
          </div>
          <RefreshButton loading={guilds.loading} onClick={guilds.reload} />
        </div>

        {guilds.loading && !guilds.data && <LoadingBlock text="Server werden geladen" detail="Deine verwaltbaren Guilds werden neu abgefragt." />}
        {!guilds.loading && guilds.error && <Notice tone="danger" text={guilds.error} />}
        {!guilds.loading && guilds.data?.guilds.length === 0 && (
          <EmptyState title="Keine verwaltbaren Server" text="Discord hat für diesen Account keine passende Guild geliefert." />
        )}

        {!guilds.loading && guilds.data && guilds.data.guilds.length > 0 && (
          <section className="guild-grid">
            {guilds.data.guilds.map((guild, index) => (
              <article
              className={`guild-card ${guild.botInstalled || guild.botInstallStatus === "installed" ? "installed" : guild.botInstallStatus === "unknown" ? "unknown" : "missing"} reveal-card`}
              style={{ "--delay": `${index * 65}ms` } as React.CSSProperties}
              key={guild.id}
            >
              {!(guild.botInstalled || guild.botInstallStatus === "installed") && (
                <a
                  className="guild-card-quick-action"
                  href={`/api/bot/invite?guildId=${guild.id}&returnTo=${encodeURIComponent(`/dashboard/${guild.id}/overview`)}`}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Bot auf ${guild.name} einladen`}
                >
                  <Plus size={19} />
                </a>
              )}
              <div className="guild-card-top">
                <GuildIcon guild={guild} />
                <span
                  className={
                    guild.botInstallStatus === "unknown"
                      ? "status-light unknown"
                      : guild.botInstalled || guild.botInstallStatus === "installed"
                        ? "status-light ok"
                        : "status-light missing"
                  }
                />
              </div>
              <div className="guild-card-body">
                <h2>{guild.name}</h2>
                <p>{guild.id}</p>
                <div className="status-row">
                  <span className="pill">{guild.permission}</span>
                  <span
                    className={
                      guild.botInstalled || guild.botInstallStatus === "installed"
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
              {guild.botInstalled || guild.botInstallStatus === "installed" ? (
                <button className="primary-action" onClick={() => navigate(`/dashboard/${guild.id}/overview`)}>
                  Verwalten
                  <ChevronRight size={16} />
                </button>
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
            ))}
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
              EclipseBot Admin
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
  const recentBotLogs = ownerLogs.data?.logs ?? runtime?.details.logs ?? [];

  const [presence, setPresence] = useState({ status: "online", activityType: "none", text: "", url: "" });
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [guildSearch, setGuildSearch] = useState("");
  const [guildSort, setGuildSort] = useState<"name" | "members" | "channels" | "roles">("name");
  const [eventFilter, setEventFilter] = useState<"all" | "open" | "failed" | "completed">("all");
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
      window.setTimeout(() => void admin.reload(), 12000);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Status konnte nicht geändert werden.");
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
      window.setTimeout(() => {
        void admin.reload();
        void ownerLogs.reload();
      }, 5000);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Aktion konnte nicht gestartet werden.");
    } finally {
      setActionBusy(null);
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
      window.setTimeout(() => void admin.reload(), 8000);
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Pterodactyl-Aktion konnte nicht gestartet werden.");
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
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Export konnte nicht erstellt werden.");
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
                <div className="owner-music-stat-grid">
                  <div><dt>Player</dt><dd>{compactNumber(music?.activePlayers ?? lavalink?.activePlayers ?? 0)}</dd></div>
                  <div><dt>Queue</dt><dd>{compactNumber(queueItems)}</dd></div>
                  <div><dt>Backend</dt><dd>{music?.backend || lavalink?.backend || "-"}</dd></div>
                  <div><dt>Suche</dt><dd>{lavalink?.searchSource || "-"}</dd></div>
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
                        <button
                          type="button"
                          className="owner-guild-name-link"
                          onClick={() => navigate(adminGuildViewPath({ id: guild.id, name: guild.name }))}
                        >
                          {guild.name}
                        </button>
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
                <div className="owner-log-column">
                  <h3>Audit</h3>
                  {(ownerLogs.data?.auditLog ?? []).slice(0, 8).map((entry) => (
                    <article className="owner-log-row" key={entry.id}>
                      <span className="pill ok">Audit</span>
                      <div>
                        <strong>{entry.action}</strong>
                        <small>{entry.guildName || entry.guildId || entry.target}</small>
                      </div>
                      <time>{formatDateTime(entry.createdAt)}</time>
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
  const invites = useApi<{ invites: AdminGuildInvite[] }>(validGuildId ? `/api/admin/discordguilds/${guildId}/invites` : null, [guildId]);
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
  const [roleDraft, setRoleDraft] = useState({ name: "", color: "#5865F2", hoist: false, mentionable: false });
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleStatus, setRoleStatus] = useState<string | null>(null);
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
      mentionable: roleEditor.mentionable
    });
  }, [roleEditor?.id]);

  const roleNameById = useMemo(() => {
    return new Map((data?.roles ?? []).map((role) => [role.id, role.name]));
  }, [data?.roles]);

  const inviteChannels = useMemo(() => {
    return (data?.channels ?? []).filter((channel) => {
      return isInviteGuildChannel(channel);
    });
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
    setRoleSaving(true);
    setRoleStatus(null);
    try {
      await api(`/api/admin/discordguilds/${guildId}/roles/${roleEditor.id}`, {
        method: "PATCH",
        body: JSON.stringify(roleDraft)
      });
      setRoleStatus("Rolle wurde aktualisiert.");
      setRoleEditor(null);
      await detail.reload();
    } catch (error) {
      setRoleStatus(error instanceof Error ? error.message : "Rolle konnte nicht gespeichert werden.");
    } finally {
      setRoleSaving(false);
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
                  <span className="pill neutral">{Object.values(modules ?? data.modules).filter(Boolean).length}/6 aktiv</span>
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
                      <div className="panel-title">
                        <div>
                          <h3>Rolle bearbeiten</h3>
                          <p className="muted">{roleEditor.id}</p>
                        </div>
                        <span className={roleEditor.botCanManage ? "pill ok" : "pill warn"}>{roleEditor.botCanManage ? "verwaltbar" : "Hierarchie prüfen"}</span>
                      </div>
                      <div className="form-grid">
                        <label>
                          Name
                          <input value={roleDraft.name} maxLength={100} onChange={(event) => setRoleDraft({ ...roleDraft, name: event.target.value })} />
                        </label>
                        <label>
                          Farbe
                          <input type="color" value={roleDraft.color} onChange={(event) => setRoleDraft({ ...roleDraft, color: event.target.value })} />
                        </label>
                        <label className="toggle">
                          <input type="checkbox" checked={roleDraft.hoist} onChange={(event) => setRoleDraft({ ...roleDraft, hoist: event.target.checked })} />
                          Separat anzeigen
                        </label>
                        <label className="toggle">
                          <input type="checkbox" checked={roleDraft.mentionable} onChange={(event) => setRoleDraft({ ...roleDraft, mentionable: event.target.checked })} />
                          Erwähnbar
                        </label>
                      </div>
                      <ActionStatus status={roleStatus} />
                      <div className="form-actions">
                        <button className="primary-action inline" onClick={saveRole} disabled={roleSaving || roleEditor.managed}>
                          {roleSaving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
                          Rolle speichern
                        </button>
                        <button type="button" className="secondary-action inline" onClick={() => setRoleEditor(null)}>
                          Schließen
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
                          Bearbeiten
                        </button>
                      </div>
                    </article>
                  ))}
                  {visibleRoles.length === 0 && <p className="muted">Keine Rolle gefunden.</p>}
                </div>
              )}

              {activeTab === "members" && (
                <div className="owner-detail-list">
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
                        {member.joinedAt && <span>seit {formatDateTime(member.joinedAt)}</span>}
                      </div>
                    </article>
                  ))}
                  {data.limits.membersPartial && <p className="muted">Discord liefert hier aktuell die ersten {data.limits.membersShown} Mitglieder.</p>}
                  {visibleMembers.length === 0 && <p className="muted">Keine Mitglieder geladen oder keine Treffer.</p>}
                </div>
              )}

              {activeTab === "channels" && (
                <div className="owner-detail-list">
                  {visibleChannels.map((channel) => (
                    <article key={channel.id} className="owner-detail-row">
                      <span className="channel-symbol">#</span>
                      <div>
                        <strong>{channel.name}</strong>
                        <small>{channel.id}{channel.categoryName ? ` · ${channel.categoryName}` : ""}</small>
                      </div>
                      <div className="owner-detail-tags">
                        <span>{channel.type}</span>
                        <span>Position {channel.position}</span>
                        {channel.canSend !== null && <span>{channel.canSend ? "sendbar" : "nicht sendbar"}</span>}
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
  const section = parts[2] ?? "overview";
  const plannedSection = getPlannedSection(section);
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
      <TopNav user={me.data?.user} />
      <div className="dashboard-layout">
        <aside className="sidebar">
          <GuildSwitcher currentGuild={detail.data?.guild ?? null} currentGuildId={guildId} />
          <SideLink icon={<Server size={17} />} label="Übersicht" section="overview" current={section} guildId={guildId} />
          <SideLink icon={<Bot size={17} />} label="Bot-Profil" section="profile" current={section} guildId={guildId} />
          <SideLink icon={<Command size={17} />} label="Slash-Befehle" section="commands" current={section} guildId={guildId} />
          <SideLink icon={<ClipboardList size={17} />} label="Custom Commands" section="custom-commands" current={section} guildId={guildId} />
          <SideLink icon={<ListFilter size={17} />} label="Logging" section="logging" current={section} guildId={guildId} />
          <SideLink icon={<Shield size={17} />} label="Audit-Log" section="audit-log" current={section} guildId={guildId} />
          <SideLink icon={<Sparkles size={17} />} label="Begrüßung" section="welcome" current={section} guildId={guildId} />
          <div className="sidebar-group-title">Geplant</div>
          {plannedSections.filter((item) => item.section !== "welcome" && item.section !== "logging").map((item) => (
            <SideLink
              icon={plannedIcon(item.section)}
              label={item.label}
              section={item.section}
              current={section}
              guildId={guildId}
              badge="geplant"
              key={item.section}
            />
          ))}
        </aside>
        <main className="dashboard-main">
          {detail.loading && <LoadingBlock />}
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
                </div>
              </div>
              {section === "overview" && <OverviewPage guildId={guildId} initial={detail.data} />}
              {section === "profile" && <ProfilePage guildId={guildId} settings={detail.data.settings} onSaved={detail.reload} />}
              {section === "commands" && <CommandsPage guildId={guildId} />}
              {section === "custom-commands" && <CustomCommandsPage guildId={guildId} />}
              {section === "logging" && <LoggingPage guildId={guildId} />}
              {section === "audit-log" && <AuditLogPage guildId={guildId} />}
              {section === "welcome" && <WelcomePage guildId={guildId} />}
              {plannedSection && section !== "welcome" && section !== "logging" && <PlannedPage section={plannedSection} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function GuildSwitcher({ currentGuild, currentGuildId }: { currentGuild: GuildDetail | null; currentGuildId: string }) {
  return (
    <div className="guild-switcher">
      <span>Guild</span>
      <button className="guild-switcher-button" onClick={() => navigate("/panel")}>
        <span>{currentGuild?.name ?? currentGuildId}</span>
        <ChevronRight size={16} />
      </button>
    </div>
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

function ProfilePage({ guildId, settings, onSaved }: { guildId: string; settings: SettingsRow; onSaved: () => void }) {
  const [nickname, setNickname] = useState(settings.bot_nickname ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveNickname() {
    setSaving(true);
    setStatus(null);
    try {
      await api(`/api/guilds/${guildId}/profile`, {
        method: "PATCH",
        body: JSON.stringify({ nickname })
      });
      setStatus("Nickname-Änderung wurde für den Bot vorgemerkt.");
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAvatar() {
    if (!file) return;
    setSaving(true);
    setStatus(null);
    const formData = new FormData();
    formData.set("avatar", file);
    try {
      await api(`/api/guilds/${guildId}/profile/avatar`, {
        method: "POST",
        body: formData
      });
      setStatus("Avatar-Upload wurde gespeichert und zur Bot-Synchronisierung vorgemerkt.");
      setFile(null);
      onSaved();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload fehlgeschlagen.");
    } finally {
      setSaving(false);
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
        <ActionStatus status={status} />
        <div className="form-actions">
          <button className="primary-action inline" onClick={saveNickname} disabled={saving}>
            {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
            Nickname speichern
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title">
          <h2>Server-Avatar</h2>
          <span className={settings.bot_avatar_sync_status === "failed" ? "pill danger" : "pill"}>
            {settings.bot_avatar_sync_status}
          </span>
        </div>
        <label>
          Bilddatei
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        {file && <p className="muted">{file.name} - {Math.round(file.size / 1024)} KiB</p>}
        {settings.bot_avatar_sync_error && <Notice tone="danger" text={settings.bot_avatar_sync_error} />}
        <div className="form-actions">
          <button className="secondary-action inline" onClick={uploadAvatar} disabled={!file || saving}>
            <Upload size={16} />
            Avatar hochladen
          </button>
        </div>
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
    "{server}": "Eclipse Community",
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
              <div className="discord-avatar">E</div>
              <div className="discord-message-body">
                <strong>EclipseBot <small>gerade eben</small></strong>
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
