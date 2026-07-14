import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Bot,
  Check,
  ChevronRight,
  ClipboardList,
  Command,
  Home,
  KeyRound,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Server,
  Settings,
  Shield,
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
  botJoinedAt: string | null;
};

type GuildDetail = {
  id: string;
  name: string;
  icon: string | null;
  botInstalled: boolean;
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

function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
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
    navigate("/login");
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
  if (cleanPath === "/home") return <HomePage />;
  if (cleanPath.startsWith("/dashboard/")) return <Dashboard path={cleanPath} />;
  return <LoginPage />;
}

function LoginPage() {
  return (
    <main className="auth-page">
      <section className="auth-panel">
        <div className="brand-mark">
          <Bot size={28} />
        </div>
        <h1>Archive Bot Webpanel</h1>
        <p>Discord-Login fuer servergebundene Bot-Verwaltung.</p>
        <a className="primary-action full" href="/api/auth/discord">
          <KeyRound size={18} />
          Mit Discord anmelden
        </a>
      </section>
    </main>
  );
}

function TopNav({ user }: { user?: User | null }) {
  return (
    <header className="top-nav">
      <button className="brand-link" onClick={() => navigate("/home")}>
        <Bot size={22} />
        <span>Archive Bot</span>
      </button>
      <nav className="top-links">
        <button onClick={() => navigate("/home")}>
          <Home size={17} />
          Home
        </button>
        <a href="/docs/cloudflare-webpanel.md" target="_blank" rel="noreferrer">
          Dokumentation
        </a>
        <a href="https://discord.com/developers/docs/intro" target="_blank" rel="noreferrer">
          Support
        </a>
      </nav>
      <div className="user-chip">
        {user?.avatar ? <img src={user.avatar} alt="" /> : <UserRound size={18} />}
        <span>{user?.displayName || user?.username || "Discord"}</span>
        <a className="icon-button" href="/logout" title="Abmelden">
          <LogOut size={17} />
        </a>
      </div>
    </header>
  );
}

function HomePage() {
  const me = useApi<{ user: User }>("/api/me", []);
  const guilds = useApi<{ guilds: GuildListItem[] }>("/api/guilds", []);

  return (
    <div className="app-shell">
      <TopNav user={me.data?.user} />
      <main className="content narrow">
        <div className="page-heading">
          <div>
            <h1>Server</h1>
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
          <EmptyState title="Keine verwaltbaren Server" text="Discord hat fuer diesen Account keine passende Guild geliefert." />
        )}

        <section className="guild-grid">
          {guilds.data?.guilds.map((guild) => (
            <article className="guild-card" key={guild.id}>
              <GuildIcon guild={guild} />
              <div className="guild-card-body">
                <h2>{guild.name}</h2>
                <p>{guild.id}</p>
                <div className="status-row">
                  <span className="pill">{guild.permission}</span>
                  <span className={guild.botInstalled ? "pill ok" : "pill warn"}>
                    {guild.botInstalled ? "Bot installiert" : "Bot fehlt"}
                  </span>
                </div>
              </div>
              {guild.botInstalled ? (
                <button className="primary-action" onClick={() => navigate(`/dashboard/${guild.id}/overview`)}>
                  Verwalten
                  <ChevronRight size={16} />
                </button>
              ) : (
                <a className="secondary-action" href={`/api/bot/invite?guildId=${guild.id}`}>
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

function GuildIcon({ guild }: { guild: { name: string; icon: string | null } }) {
  if (guild.icon) return <img className="guild-icon" src={guild.icon} alt="" />;
  return <div className="guild-icon fallback">{guild.name.slice(0, 2).toUpperCase()}</div>;
}

function Dashboard({ path }: { path: string }) {
  const parts = path.split("/").filter(Boolean);
  const guildId = parts[1];
  const section = parts[2] ?? "overview";
  const me = useApi<{ user: User }>("/api/me", []);
  const guilds = useApi<{ guilds: GuildListItem[] }>("/api/guilds", [guildId]);
  const detail = useApi<{ guild: GuildDetail; settings: SettingsRow }>(`/api/guilds/${guildId}`, [guildId]);

  if (detail.error?.includes("noch nicht installiert")) {
    return (
      <div className="app-shell">
        <TopNav user={me.data?.user} />
        <main className="content narrow">
          <Notice tone="warning" text="Der Bot ist auf dieser Guild noch nicht bestaetigt. Nach der Einladung aktualisiert der laufende Bot diesen Status." />
          <a className="primary-action inline" href={`/api/bot/invite?guildId=${guildId}`}>
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
          <GuildSwitcher guilds={guilds.data?.guilds ?? []} currentGuildId={guildId} />
          <SideLink icon={<Server size={17} />} label="Uebersicht" section="overview" current={section} guildId={guildId} />
          <SideLink icon={<Bot size={17} />} label="Bot-Profil" section="profile" current={section} guildId={guildId} />
          <SideLink icon={<Command size={17} />} label="Slash-Befehle" section="commands" current={section} guildId={guildId} />
          <SideLink icon={<ClipboardList size={17} />} label="Custom Commands" section="custom-commands" current={section} guildId={guildId} />
          <SideLink icon={<Shield size={17} />} label="Audit-Log" section="audit-log" current={section} guildId={guildId} />
          <div className="sidebar-group-title">Geplant</div>
          <DisabledSideItem label="Begruessung" />
          <DisabledSideItem label="Logging" />
          <DisabledSideItem label="Moderation" />
          <DisabledSideItem label="Gefahrenbereich" />
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
                <span className="pill ok">{detail.data.guild.permission}</span>
              </div>
              {section === "overview" && <OverviewPage guildId={guildId} initial={detail.data} />}
              {section === "profile" && <ProfilePage guildId={guildId} settings={detail.data.settings} onSaved={detail.reload} />}
              {section === "commands" && <CommandsPage guildId={guildId} />}
              {section === "custom-commands" && <CustomCommandsPage guildId={guildId} />}
              {section === "audit-log" && <AuditLogPage guildId={guildId} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function GuildSwitcher({ guilds, currentGuildId }: { guilds: GuildListItem[]; currentGuildId: string }) {
  return (
    <label className="guild-switcher">
      <span>Guild</span>
      <select value={currentGuildId} onChange={(event) => navigate(`/dashboard/${event.target.value}/overview`)}>
        {guilds
          .filter((guild) => guild.botInstalled)
          .map((guild) => (
            <option key={guild.id} value={guild.id}>
              {guild.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function SideLink({
  icon,
  label,
  section,
  current,
  guildId
}: {
  icon: React.ReactNode;
  label: string;
  section: string;
  current: string;
  guildId: string;
}) {
  return (
    <button className={`side-link ${current === section ? "active" : ""}`} onClick={() => navigate(`/dashboard/${guildId}/${section}`)}>
      {icon}
      {label}
    </button>
  );
}

function DisabledSideItem({ label }: { label: string }) {
  return (
    <div className="side-link disabled">
      <Settings size={17} />
      {label}
      <span>spaeter</span>
    </div>
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
        <button className="primary-action inline" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
          Speichern
        </button>
      </div>
    </section>
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
      setStatus("Nickname-Aenderung wurde fuer den Bot vorgemerkt.");
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
          <input value={nickname} maxLength={32} onChange={(event) => setNickname(event.target.value)} placeholder="Leer lassen zum Zuruecksetzen" />
        </label>
        <ActionStatus status={status} />
        <button className="primary-action inline" onClick={saveNickname} disabled={saving}>
          {saving ? <Loader2 className="spin" size={16} /> : <Save size={16} />}
          Nickname speichern
        </button>
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
        <button className="secondary-action inline" onClick={uploadAvatar} disabled={!file || saving}>
          <Upload size={16} />
          Avatar hochladen
        </button>
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
        <button className="primary-action inline" onClick={create}>
          <Plus size={16} />
          Erstellen
        </button>
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
        {commands.data?.customCommands.length === 0 && <EmptyState title="Keine Custom Commands" text="Erstelle den ersten Command fuer diese Guild." />}
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
      setStatus(error instanceof Error ? error.message : "Loeschen fehlgeschlagen.");
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
          Loeschen
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
