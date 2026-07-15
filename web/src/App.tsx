import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  AtSign,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  ClipboardList,
  Command,
  Cpu,
  Database,
  Gauge,
  Home,
  Hash,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
  MessageSquare,
  Palette,
  Plus,
  Radio,
  RefreshCw,
  Rocket,
  Save,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
  UserRound
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

type AdminRuntime = {
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
  updatedAt: string;
  details: {
    bot?: { id?: string; name?: string; avatar?: string | null };
    guilds?: Array<{ id: string; name: string; memberCount: number; channelCount: number; roleCount: number }>;
  };
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

function safeClientReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/api/") || value.startsWith("/login")) {
    return "/panel";
  }
  return value;
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

function App() {
  const path = usePath();
  const cleanPath = path.split("?")[0];

  if (cleanPath === "/login" || cleanPath === "/") return <LoginPage />;
  if (cleanPath === "/dokumentation") return <DocumentationPage />;
  if (cleanPath === "/datenschutz") return <PrivacyPage />;
  if (cleanPath === "/admin") return <AdminPage />;
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
          <button className="secondary-action" onClick={() => guilds.reload()}>
            <RefreshCw size={16} />
            Aktualisieren
          </button>
        </div>

        {guilds.loading && <SkeletonGrid />}
        {guilds.error && <Notice tone="danger" text={guilds.error} />}
        {!guilds.loading && guilds.data?.guilds.length === 0 && (
          <EmptyState title="Keine verwaltbaren Server" text="Discord hat für diesen Account keine passende Guild geliefert." />
        )}

        <section className="guild-grid">
          {guilds.data?.guilds.map((guild, index) => (
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

function formatDateTime(value: string | null | undefined) {
  if (!value) return "unbekannt";
  return new Date(value).toLocaleString("de-DE");
}

function statusLabel(value: string | null | undefined) {
  switch (value) {
    case "online":
      return "Erreichbar";
    case "idle":
      return "Abwesend";
    case "dnd":
      return "Nicht stören";
    case "offline":
      return "Unsichtbar";
    default:
      return value || "unbekannt";
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
      await admin.reload();
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
          <button className="secondary-action inline" onClick={admin.reload}>
            <RefreshCw size={16} />
            Aktualisieren
          </button>
        </section>

        {admin.loading && <LoadingBlock />}
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
                    Sichtbarkeit
                    <select value={presence.status} onChange={(event) => setPresence({ ...presence, status: event.target.value })}>
                      <option value="online">Erreichbar</option>
                      <option value="idle">Abwesend</option>
                      <option value="dnd">Nicht stören</option>
                      <option value="offline">Unsichtbar</option>
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

function MetricCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone?: "ok" | "warn" }) {
  return (
    <div className={`metric-card ${tone ?? ""}`}>
      <span>{icon}</span>
      <strong>{value}</strong>
      <small>{label}</small>
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
          <SideLink icon={<Shield size={17} />} label="Audit-Log" section="audit-log" current={section} guildId={guildId} />
          <SideLink icon={<Sparkles size={17} />} label="Begrüßung" section="welcome" current={section} guildId={guildId} />
          <div className="sidebar-group-title">Geplant</div>
          {plannedSections.filter((item) => item.section !== "welcome").map((item) => (
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
              {section === "audit-log" && <AuditLogPage guildId={guildId} />}
              {section === "welcome" && <WelcomePage guildId={guildId} />}
              {plannedSection && section !== "welcome" && <PlannedPage section={plannedSection} />}
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
    () =>
      (channels.data?.channels ?? []).filter((channel) =>
        channel.canSend && ["text", "news", "forum", "public_thread", "private_thread"].includes(channel.type)
      ),
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

      {(welcome.loading || channels.loading || roles.loading) && <LoadingBlock />}
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
                    <option value="">Kanal auswählen</option>
                    {textChannels.map((channel) => (
                      <option value={channel.id} key={channel.id}>
                        #{channel.name}{channel.categoryName ? ` - ${channel.categoryName}` : ""}
                      </option>
                    ))}
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
              <button className="secondary-action inline" onClick={welcome.reload}>
                <RefreshCw size={16} />
                Neu laden
              </button>
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
        <button className="secondary-action inline" onClick={commands.reload}>
          <RefreshCw size={16} />
          Neu laden
        </button>
      </div>
      <ActionStatus status={status} />
      {commands.loading && <LoadingBlock />}
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
          <button className="secondary-action inline" onClick={commands.reload}>
            <RefreshCw size={16} />
            Neu laden
          </button>
        </div>
        {commands.loading && <LoadingBlock />}
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
        <button className="secondary-action inline" onClick={audit.reload}>
          <RefreshCw size={16} />
          Neu laden
        </button>
      </div>
      {audit.loading && <LoadingBlock />}
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

function LoadingBlock() {
  return (
    <div className="loading-block">
      <Loader2 className="spin" size={18} />
      Laden
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
