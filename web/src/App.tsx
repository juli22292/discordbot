import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
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
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Loader2,
  LogOut,
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
    { icon: <KeyRound size={18} />, title: "Discord Login", text: "Die Anmeldung läuft über Discord OAuth. Das Panel nutzt die Anmeldung nur, um deinen Account und deine verwaltbaren Server zu erkennen." },
    { icon: <Database size={18} />, title: "Guild-Daten", text: "Gespeichert werden nur Daten, die für Serververwaltung, Einstellungen, Commands und Audit-Log gebraucht werden." },
    { icon: <ShieldCheck size={18} />, title: "Geschützte Sitzungen", text: "Sessions und sensible Tokens werden serverseitig geschützt und nicht offen im Browser angezeigt." },
    { icon: <Activity size={18} />, title: "Keine Werbung", text: "Das Webpanel ist ein Verwaltungsbereich und enthält keine Werbe- oder Marketingfunktionen." }
  ];
  const privacySections = [
    {
      eyebrow: "Anmeldung",
      title: "Welche Discord-Daten genutzt werden",
      text: "Beim Login werden deine Discord-ID, dein Nutzername, dein Anzeigename und dein Avatar genutzt. Dazu kommen die Server, auf denen du passende Verwaltungsrechte hast."
    },
    {
      eyebrow: "Server",
      title: "Was pro Guild gespeichert wird",
      text: "Das Panel speichert serverbezogene Einstellungen wie Sprache, Zeitzone, Bot-Profil, Command-Konfigurationen und technische Sync-Statuswerte."
    },
    {
      eyebrow: "Sicherheit",
      title: "Wie sensible Daten behandelt werden",
      text: "Discord-Tokens, Session-Daten und interne Bot-Schlüssel werden als Secrets oder verschlüsselte Daten behandelt. Sie werden nicht öffentlich auf der Webseite ausgegeben."
    },
    {
      eyebrow: "Kontrolle",
      title: "Abmelden und Zugriff begrenzen",
      text: "Du kannst dich jederzeit abmelden. Das Panel zeigt nur Server an, für die dein Discord-Account ausreichende Rechte besitzt."
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
          <div className="sidebar-group-title">Geplant</div>
          {plannedSections.map((item) => (
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
              {plannedSection && <PlannedPage section={plannedSection} />}
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
