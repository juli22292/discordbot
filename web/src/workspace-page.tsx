import React, { useEffect, useMemo, useState } from "react";
import { VerifiedAppBadge } from "./verified-app-badge";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Copy,
  Database,
  Eye,
  FileJson,
  FolderKanban,
  History,
  Info,
  LayoutTemplate,
  Loader2,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCog,
  WandSparkles,
  X
} from "lucide-react";

export const OPEN_COMMAND_PALETTE_EVENT = "modmail:open-command-palette";

type RequestFn = <T>(path: string, init?: RequestInit) => Promise<T>;
type NoticeTone = "success" | "danger" | "info";

type WorkspaceModule = {
  key: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  syncStatus: string;
  syncError: string | null;
};

type WorkspaceItem = {
  id: string;
  type: "draft" | "template";
  module: string;
  name: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceTimelineItem = {
  id: string;
  type: "audit" | "sync";
  action: string;
  target: string;
  status: string;
  actorDiscordUserId: string | null;
  detail: string | null;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};

export type WorkspaceData = {
  guild: { id: string; name: string; icon: string | null };
  access: { level: string; capabilities: string[] };
  setupChecks: Array<{ id: string; label: string; ok: boolean; detail: string }>;
  setupProgress: number;
  tasks: Array<{ id: string; tone: string; title: string; detail: string; target: string }>;
  modules: WorkspaceModule[];
  resources: {
    channels: Array<{ id: string; name: string; type: string; canSend: boolean; canView: boolean }>;
    roles: Array<{ id: string; name: string; managed: boolean; botCanManage: boolean }>;
  };
  delegatedAccess: Array<{
    id: string;
    principalType: "user" | "role";
    principalId: string;
    displayName: string;
    accessLevel: string;
    capabilities: string[];
    enabled: boolean;
  }>;
  items: WorkspaceItem[];
  timeline: WorkspaceTimelineItem[];
  preferences: PanelPreferences;
  generatedAt: string;
};

type PanelPreferences = {
  density: "comfortable" | "compact";
  sidebarCompact: boolean;
  reduceMotion: boolean;
  defaultGuildId: string | null;
  defaultSection: string;
};

type WorkspaceTab = "setup" | "library" | "transfer" | "permissions" | "preview" | "history" | "preferences";

const TABS: Array<{ key: WorkspaceTab; label: string; icon: React.ReactNode }> = [
  { key: "setup", label: "Setup & Aufgaben", icon: <ClipboardCheck size={16} /> },
  { key: "library", label: "Entwürfe & Vorlagen", icon: <LayoutTemplate size={16} /> },
  { key: "transfer", label: "Übertragen", icon: <Copy size={16} /> },
  { key: "permissions", label: "Rechte prüfen", icon: <LockKeyhole size={16} /> },
  { key: "preview", label: "Live-Vorschau", icon: <Eye size={16} /> },
  { key: "history", label: "Verlauf", icon: <History size={16} /> },
  { key: "preferences", label: "Ansicht", icon: <Settings2 size={16} /> }
];

const BUILTIN_TEMPLATES: Array<{ name: string; module: string; description: string; payload: Record<string, unknown> }> = [
  {
    name: "Deutsche Serverbasis",
    module: "overview",
    description: "Deutsch und Europe/Berlin als verlässliche Grundlage.",
    payload: { locale: "de", timezone: "Europe/Berlin" }
  },
  {
    name: "Faires Counting",
    module: "counting",
    description: "Fehler setzen die Runde zurück, Meilensteine erscheinen alle 100 Zahlen.",
    payload: { enabled: false, channelId: null, resetOnError: true, deleteWrongMessages: false, milestoneInterval: 100 }
  },
  {
    name: "Raid-Schutz Light",
    module: "raidmode",
    description: "Moderater Schutz mit zehn Sekunden Slowmode, ohne Panikmodus.",
    payload: { profile: "light", panicEnabled: false, panicSlowmodeSeconds: 10 }
  },
  {
    name: "Autorole vorbereitet",
    module: "autorole",
    description: "Sichere Ausgangslage, bis Rollen ausgewählt wurden.",
    payload: { enabled: false, humanRoleIds: [], botRoleIds: [], delaySeconds: 0, waitForScreening: true }
  }
];

const MODULE_ROUTES: Record<string, { suffix: string; responseKey: string; method: "PUT" | "PATCH" }> = {
  overview: { suffix: "settings", responseKey: "settings", method: "PATCH" },
  welcome: { suffix: "welcome", responseKey: "welcome", method: "PUT" },
  logging: { suffix: "logging", responseKey: "logging", method: "PUT" },
  "temp-voice": { suffix: "temp-voice", responseKey: "tempVoice", method: "PUT" },
  counting: { suffix: "counting", responseKey: "counting", method: "PUT" },
  "level-system": { suffix: "level-system", responseKey: "levelSystem", method: "PUT" },
  autorole: { suffix: "autorole", responseKey: "autorole", method: "PUT" },
  security: { suffix: "security", responseKey: "security", method: "PUT" },
  raidmode: { suffix: "raidmode", responseKey: "raidmode", method: "PUT" },
  tickets: { suffix: "tickets", responseKey: "tickets", method: "PUT" }
};

function endpointFor(guildId: string, module: string) {
  const route = MODULE_ROUTES[module];
  if (route) return { path: `/api/guilds/${guildId}/${route.suffix}`, ...route };
  return { path: `/api/guilds/${guildId}/features/${module}`, responseKey: "feature", method: "PUT" as const };
}

function pretty(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function applyPreferences(preferences: PanelPreferences) {
  document.documentElement.dataset.density = preferences.density;
  document.documentElement.classList.toggle("panel-sidebar-compact", preferences.sidebarCompact);
  document.documentElement.classList.toggle("panel-reduce-motion", preferences.reduceMotion);
  localStorage.setItem("modmail-panel-preferences", JSON.stringify(preferences));
}

function HelpNote({ children }: { children: React.ReactNode }) {
  return <p className="workspace-help"><Info size={15} />{children}</p>;
}

function WorkspaceEmpty({ title, text }: { title: string; text: string }) {
  return <div className="workspace-empty"><FolderKanban size={22} /><strong>{title}</strong><span>{text}</span></div>;
}

function demoWorkspaceData(): WorkspaceData {
  const modules = ["overview", "welcome", "logging", "temp-voice", "counting", "level-system", "autorole", "security", "raidmode", "tickets", "giveaways", "applications", "youtube-music"].map((key, index) => ({
    key,
    label: ({ overview: "Allgemeines", welcome: "Begrüßung", logging: "Logging", "temp-voice": "Temp-Voice", counting: "Counting", "level-system": "Level-System", autorole: "Autorole", security: "Security Center", raidmode: "Raidmode", tickets: "Ticket-System", giveaways: "Giveaways", applications: "Bewerbungen", "youtube-music": "YouTube Musik" } as Record<string, string>)[key] || key,
    enabled: index < 8,
    configured: index < 7,
    syncStatus: "synced",
    syncError: null
  }));
  return {
    guild: { id: "demo", name: "Modmail Manager Demo", icon: null },
    access: { level: "owner", capabilities: ["view", "settings", "team", "moderation", "tickets", "music", "history"] },
    setupProgress: 83,
    setupChecks: [
      { id: "bot", label: "Bot verbunden", ok: true, detail: "Discord-Verbindung erkannt" },
      { id: "channels", label: "Kanäle synchronisiert", ok: true, detail: "18 Kanäle bekannt" },
      { id: "writable", label: "Nachrichten möglich", ok: true, detail: "14 beschreibbare Kanäle" },
      { id: "roles", label: "Rollen verwaltbar", ok: true, detail: "9 verwaltbare Rollen" },
      { id: "timezone", label: "Zeitzone gesetzt", ok: true, detail: "Europe/Berlin" },
      { id: "sync", label: "Synchronisierung sauber", ok: false, detail: "Eine Demo-Aufgabe offen" }
    ],
    tasks: [{ id: "demo-task", tone: "warning", title: "Counting fertig einrichten", detail: "Wähle noch einen Zahlenkanal aus.", target: "counting" }],
    modules,
    resources: { channels: [{ id: "100000000000000001", name: "willkommen", type: "text", canSend: true, canView: true }], roles: [{ id: "100000000000000010", name: "Mitglied", managed: false, botCanManage: true }] },
    delegatedAccess: [{ id: "demo-access", principalType: "role", principalId: "100000000000000010", displayName: "Moderator", accessLevel: "moderator", capabilities: ["view", "moderation", "tickets", "history"], enabled: true }],
    items: [{ id: "demo-draft", type: "draft", module: "welcome", name: "Neue Begrüßung", payload: { enabled: true, channelId: "100000000000000001", message: "Willkommen {member_mention}!" }, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
    timeline: [{ id: "demo-history", type: "audit", action: "welcome.update", target: "Begrüßung", status: "completed", actorDiscordUserId: "demo", detail: null, oldValue: { enabled: false }, newValue: { enabled: true }, createdAt: new Date().toISOString() }],
    preferences: { density: "comfortable", sidebarCompact: false, reduceMotion: false, defaultGuildId: null, defaultSection: "overview" },
    generatedAt: new Date().toISOString()
  };
}

export function WorkspaceCenterPage({
  guildId,
  demoMode,
  request,
  onNavigate,
  notify
}: {
  guildId: string;
  demoMode: boolean;
  request: RequestFn;
  onNavigate: (path: string) => void;
  notify: (tone: NoticeTone, title: string, text?: string) => void;
}) {
  const [data, setData] = useState<WorkspaceData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<WorkspaceTab>("setup");
  const [module, setModule] = useState("welcome");
  const [editor, setEditor] = useState("{}");
  const [baseline, setBaseline] = useState("{}");
  const [itemName, setItemName] = useState("");
  const [validation, setValidation] = useState<{ valid: boolean; errors: string[]; warnings: string[] } | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [targetGuildId, setTargetGuildId] = useState("");
  const [targetGuilds, setTargetGuilds] = useState<Array<{ id: string; name: string; botInstalled: boolean }>>([]);
  const [transferModules, setTransferModules] = useState<string[]>(["welcome"]);
  const [transferLog, setTransferLog] = useState<Array<{ module: string; ok: boolean; message: string }>>([]);
  const [simulatedAccessId, setSimulatedAccessId] = useState("self");
  const [timelineFilter, setTimelineFilter] = useState<"all" | "audit" | "sync">("all");
  const [preferences, setPreferences] = useState<PanelPreferences>({
    density: "comfortable",
    sidebarCompact: false,
    reduceMotion: false,
    defaultGuildId: null,
    defaultSection: "overview"
  });

  const canEdit = Boolean(data?.access.capabilities.includes("settings") || ["owner", "administrator"].includes(data?.access.level ?? ""));
  const moduleInfo = data?.modules.find((entry) => entry.key === module);
  const selectedItem = data?.items.find((item) => item.id === selectedItemId) ?? null;

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const result = demoMode ? demoWorkspaceData() : await request<WorkspaceData>(`/api/guilds/${guildId}/workspace`);
      setData(result);
      setPreferences(result.preferences);
      applyPreferences(result.preferences);
      if (!result.modules.some((entry) => entry.key === module)) setModule(result.modules[0]?.key ?? "overview");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Workspace konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void reload(); }, [guildId]);

  useEffect(() => {
    if (tab !== "transfer" || targetGuilds.length) return;
    void request<{ guilds: Array<{ id: string; name: string; botInstalled: boolean }> }>("/api/guilds")
      .then((result) => setTargetGuilds(result.guilds.filter((guild) => guild.id !== guildId && guild.botInstalled)))
      .catch(() => setTargetGuilds([]));
  }, [tab, guildId, targetGuilds.length]);

  async function loadLive(selectedModule = module) {
    setBusy(true);
    setValidation(null);
    try {
      const route = endpointFor(guildId, selectedModule);
      const response = await request<Record<string, unknown>>(route.path);
      const payload = response[route.responseKey] ?? {};
      const json = pretty(payload);
      setModule(selectedModule);
      setEditor(json);
      setBaseline(json);
      setSelectedItemId(null);
      notify("success", "Live-Konfiguration geladen", moduleInfo?.label ?? selectedModule);
    } catch (reason) {
      notify("danger", "Laden fehlgeschlagen", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  function parseEditor(): Record<string, unknown> | null {
    try {
      const parsed = JSON.parse(editor) as unknown;
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("Die Konfiguration muss ein JSON-Objekt sein.");
      return parsed as Record<string, unknown>;
    } catch (reason) {
      notify("danger", "JSON ist ungültig", reason instanceof Error ? reason.message : "Bitte Eingaben prüfen.");
      return null;
    }
  }

  async function validateEditor(targetId = guildId, payload = parseEditor()) {
    if (!payload) return null;
    try {
      const result = await request<{ valid: boolean; errors: string[]; warnings: string[] }>(`/api/guilds/${targetId}/workspace/validate`, {
        method: "POST",
        body: JSON.stringify({ module, payload })
      });
      setValidation(result);
      return result;
    } catch (reason) {
      const result = { valid: false, errors: [reason instanceof Error ? reason.message : "Prüfung fehlgeschlagen."], warnings: [] };
      setValidation(result);
      return result;
    }
  }

  async function publish() {
    const payload = parseEditor();
    if (!payload || !canEdit || demoMode) return;
    setBusy(true);
    try {
      const check = await validateEditor(guildId, payload);
      if (!check?.valid) throw new Error(check?.errors[0] || "Die Sicherheitsprüfung ist fehlgeschlagen.");
      const route = endpointFor(guildId, module);
      await request(route.path, { method: route.method, body: JSON.stringify(payload) });
      setBaseline(pretty(payload));
      await reload();
      notify("success", "Konfiguration veröffentlicht", "Die Änderung wurde an den Bot übergeben.");
    } catch (reason) {
      notify("danger", "Veröffentlichen fehlgeschlagen", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function saveItem(type: "draft" | "template") {
    const payload = parseEditor();
    if (!payload || !itemName.trim() || demoMode) return;
    setBusy(true);
    try {
      if (selectedItem) {
        await request(`/api/guilds/${guildId}/workspace/items/${selectedItem.id}`, {
          method: "PATCH",
          body: JSON.stringify({ type, module, name: itemName.trim(), payload })
        });
      } else {
        await request(`/api/guilds/${guildId}/workspace/items`, {
          method: "POST",
          body: JSON.stringify({ type, module, name: itemName.trim(), payload })
        });
      }
      await reload();
      notify("success", type === "draft" ? "Entwurf gespeichert" : "Vorlage gespeichert", itemName.trim());
    } catch (reason) {
      notify("danger", "Speichern fehlgeschlagen", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: WorkspaceItem) {
    if (demoMode || !window.confirm(`„${item.name}“ wirklich löschen?`)) return;
    try {
      await request(`/api/guilds/${guildId}/workspace/items/${item.id}`, { method: "DELETE" });
      if (selectedItemId === item.id) setSelectedItemId(null);
      await reload();
      notify("success", "Eintrag gelöscht", item.name);
    } catch (reason) {
      notify("danger", "Löschen fehlgeschlagen", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    }
  }

  function openItem(item: WorkspaceItem) {
    setSelectedItemId(item.id);
    setModule(item.module);
    setItemName(item.name);
    setEditor(pretty(item.payload));
    setValidation(null);
  }

  async function addBuiltin(template: typeof BUILTIN_TEMPLATES[number]) {
    if (demoMode) return;
    try {
      await request(`/api/guilds/${guildId}/workspace/items`, {
        method: "POST",
        body: JSON.stringify({ type: "template", module: template.module, name: template.name, payload: template.payload })
      });
      await reload();
      notify("success", "Vorlage hinzugefügt", template.name);
    } catch (reason) {
      notify("danger", "Vorlage konnte nicht gespeichert werden", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    }
  }

  async function transfer() {
    if (!targetGuildId || transferModules.length === 0 || demoMode) return;
    setBusy(true);
    setTransferLog([]);
    const log: Array<{ module: string; ok: boolean; message: string }> = [];
    for (const selectedModule of transferModules) {
      try {
        const sourceRoute = endpointFor(guildId, selectedModule);
        const source = await request<Record<string, unknown>>(sourceRoute.path);
        const payload = source[sourceRoute.responseKey] as Record<string, unknown>;
        const check = await request<{ valid: boolean; errors: string[]; warnings: string[] }>(`/api/guilds/${targetGuildId}/workspace/validate`, {
          method: "POST",
          body: JSON.stringify({ module: selectedModule, payload })
        });
        if (!check.valid) throw new Error(check.errors[0] || "Zielprüfung fehlgeschlagen.");
        const targetRoute = endpointFor(targetGuildId, selectedModule);
        await request(targetRoute.path, { method: targetRoute.method, body: JSON.stringify(payload) });
        log.push({ module: selectedModule, ok: true, message: check.warnings[0] || "Übertragen" });
      } catch (reason) {
        log.push({ module: selectedModule, ok: false, message: reason instanceof Error ? reason.message : "Fehlgeschlagen" });
      }
      setTransferLog([...log]);
    }
    setBusy(false);
    notify(log.every((entry) => entry.ok) ? "success" : "danger", "Übertragung abgeschlossen", `${log.filter((entry) => entry.ok).length} von ${log.length} Modulen übernommen.`);
  }

  async function savePreferences() {
    if (demoMode) return;
    setBusy(true);
    try {
      const response = await request<{ preferences: PanelPreferences }>("/api/user-center/panel-settings", {
        method: "PUT",
        body: JSON.stringify(preferences)
      });
      setPreferences(response.preferences);
      applyPreferences(response.preferences);
      notify("success", "Ansicht gespeichert", "Die Einstellungen gelten ab sofort.");
    } catch (reason) {
      notify("danger", "Ansicht konnte nicht gespeichert werden", reason instanceof Error ? reason.message : "Unbekannter Fehler");
    } finally {
      setBusy(false);
    }
  }

  const changedLines = useMemo(() => {
    const before = baseline.split("\n");
    const after = editor.split("\n");
    const result: Array<{ line: number; before: string; after: string }> = [];
    for (let index = 0; index < Math.max(before.length, after.length); index += 1) {
      if ((before[index] ?? "") !== (after[index] ?? "")) result.push({ line: index + 1, before: before[index] ?? "", after: after[index] ?? "" });
    }
    return result.slice(0, 80);
  }, [baseline, editor]);

  const simulatedAccess = simulatedAccessId === "self"
    ? { displayName: "Dein aktueller Zugriff", accessLevel: data?.access.level ?? "viewer", capabilities: data?.access.capabilities ?? [], enabled: true }
    : data?.delegatedAccess.find((entry) => entry.id === simulatedAccessId);

  const filteredTimeline = (data?.timeline ?? []).filter((entry) => timelineFilter === "all" || entry.type === timelineFilter);

  if (loading && !data) return <div className="workspace-loading"><Loader2 className="spin" size={20} />Workspace wird geladen</div>;
  if (error || !data) return <div className="workspace-error"><AlertTriangle size={20} /><strong>Workspace nicht verfügbar</strong><span>{error}</span><button className="secondary-action inline" onClick={() => void reload()}><RefreshCw size={15} />Erneut laden</button></div>;

  return (
    <section className="workspace-center">
      <header className="workspace-hero">
        <div>
          <p className="eyebrow"><FolderKanban size={15} />Guild Workspace</p>
          <h2>Alles vorbereiten, prüfen und sicher veröffentlichen</h2>
          <p>Ein zentraler Arbeitsbereich für Einrichtung, Konfigurationen, Rechte und Änderungen auf {data.guild.name}.</p>
        </div>
        <div className="workspace-hero-status">
          <span><strong>{data.setupProgress}%</strong> eingerichtet</span>
          <button className="secondary-action inline" type="button" onClick={() => void reload()} disabled={loading}><RefreshCw className={loading ? "spin" : ""} size={16} />Aktualisieren</button>
        </div>
      </header>

      <nav className="workspace-tabs" aria-label="Workspace-Bereiche">
        {TABS.map((entry) => <button key={entry.key} className={tab === entry.key ? "active" : ""} type="button" aria-label={entry.label} onClick={() => setTab(entry.key)}>{entry.icon}<span>{entry.label}</span>{entry.key === "setup" && data.tasks.length > 0 && <b>{data.tasks.length}</b>}</button>)}
      </nav>

      {tab === "setup" && (
        <div className="workspace-section-stack">
          <section className="workspace-panel">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><WandSparkles size={18} /></span><div><h3>Einrichtungsassistent</h3><p>Sechs echte Prüfungen zeigen, ob der Bot sauber arbeiten kann.</p></div></div><strong>{data.setupProgress}%</strong></div>
            <div className="workspace-progress"><span style={{ width: `${data.setupProgress}%` }} /></div>
            <div className="workspace-check-grid">
              {data.setupChecks.map((check) => <article className={check.ok ? "ok" : "warn"} key={check.id}><span>{check.ok ? <Check size={16} /> : <AlertTriangle size={16} />}</span><div><strong>{check.label}</strong><small>{check.detail}</small></div></article>)}
            </div>
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><ClipboardCheck size={18} /></span><div><h3>Zentrale Aufgaben</h3><p>Offene Einrichtung und Sync-Probleme, nach Wichtigkeit sortiert.</p></div></div><span className="workspace-count">{data.tasks.length}</span></div>
            {data.tasks.length ? <div className="workspace-task-list">{data.tasks.map((task) => <button key={task.id} type="button" onClick={() => onNavigate(`/dashboard/${guildId}/${task.target}`)}><span className={`workspace-task-tone ${task.tone}`} /> <div><strong>{task.title}</strong><small>{task.detail}</small></div><ChevronRight size={17} /></button>)}</div> : <WorkspaceEmpty title="Alles sauber" text="Aktuell gibt es keine offenen Workspace-Aufgaben." />}
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><Database size={18} /></span><div><h3>Modulstatus</h3><p>Aktivierung, Einrichtung und Bot-Synchronisierung auf einen Blick.</p></div></div></div>
            <div className="workspace-module-grid">{data.modules.map((entry) => <button type="button" key={entry.key} onClick={() => onNavigate(`/dashboard/${guildId}/${entry.key}`)}><span className={`workspace-module-dot ${entry.syncStatus === "failed" ? "failed" : entry.enabled ? "online" : "idle"}`} /><div><strong>{entry.label}</strong><small>{entry.syncError || (entry.configured ? "Eingerichtet" : entry.enabled ? "Einrichtung offen" : "Inaktiv")}</small></div><span>{entry.syncStatus}</span></button>)}</div>
          </section>
        </div>
      )}

      {tab === "library" && (
        <div className="workspace-library-layout">
          <section className="workspace-panel workspace-library-list">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><LayoutTemplate size={18} /></span><div><h3>Bibliothek</h3><p>Persönliche Entwürfe und wiederverwendbare Vorlagen.</p></div></div><button className="secondary-action icon-action" title="Neuer Entwurf" type="button" onClick={() => { setSelectedItemId(null); setItemName(""); setEditor("{}"); setBaseline("{}"); }}><Plus size={16} /></button></div>
            <HelpNote>Entwürfe verändern den Bot erst, wenn du sie nach der Sicherheitsprüfung veröffentlichst.</HelpNote>
            <div className="workspace-item-list">
              {data.items.map((item) => <article className={selectedItemId === item.id ? "active" : ""} key={item.id}><button type="button" onClick={() => openItem(item)}><span className={item.type}><FileJson size={16} /></span><div><strong>{item.name}</strong><small>{data.modules.find((entry) => entry.key === item.module)?.label || item.module} · {formatDate(item.updatedAt)}</small></div></button><button type="button" className="workspace-delete" title="Löschen" onClick={() => void removeItem(item)}><Trash2 size={15} /></button></article>)}
              {!data.items.length && <WorkspaceEmpty title="Noch keine eigenen Einträge" text="Lade eine Live-Konfiguration oder nutze eine Startvorlage." />}
            </div>
            <h4>Startvorlagen</h4>
            <div className="workspace-template-list">{BUILTIN_TEMPLATES.map((template) => <button type="button" key={template.name} onClick={() => void addBuiltin(template)} disabled={!canEdit}><Sparkles size={15} /><span><strong>{template.name}</strong><small>{template.description}</small></span><Plus size={14} /></button>)}</div>
          </section>
          <section className="workspace-panel workspace-editor">
            <div className="workspace-editor-toolbar">
              <label>Modul<select value={module} onChange={(event) => { setModule(event.target.value); setValidation(null); }}>{data.modules.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>
              <button className="secondary-action inline" type="button" onClick={() => void loadLive()} disabled={busy}><RefreshCw size={15} />Live laden</button>
              <span className={`workspace-sync-chip ${moduleInfo?.syncStatus === "failed" ? "failed" : ""}`}>{moduleInfo?.syncStatus || "bereit"}</span>
            </div>
            <label className="workspace-name-field">Name<input value={itemName} maxLength={100} onChange={(event) => setItemName(event.target.value)} placeholder="z. B. Begrüßung Sommer" /></label>
            <label className="workspace-json-field">Konfiguration<textarea spellCheck={false} value={editor} onChange={(event) => { setEditor(event.target.value); setValidation(null); }} /></label>
            <div className="workspace-editor-actions">
              <button className="secondary-action inline" type="button" onClick={() => void validateEditor()} disabled={busy}><ShieldCheck size={16} />Prüfen</button>
              <button className="secondary-action inline" type="button" onClick={() => void saveItem("draft")} disabled={busy || !itemName.trim() || !canEdit}><Save size={16} />Als Entwurf</button>
              <button className="secondary-action inline" type="button" onClick={() => void saveItem("template")} disabled={busy || !itemName.trim() || !canEdit}><LayoutTemplate size={16} />Als Vorlage</button>
              <button className="primary-action inline" type="button" onClick={() => void publish()} disabled={busy || !canEdit || changedLines.length === 0}><Send size={16} />Veröffentlichen</button>
            </div>
            {validation && <div className={`workspace-validation ${validation.valid ? "valid" : "invalid"}`}><strong>{validation.valid ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}{validation.valid ? "Sicherheitsprüfung bestanden" : "Änderung blockiert"}</strong>{validation.errors.map((entry) => <span key={entry}>{entry}</span>)}{validation.warnings.map((entry) => <span className="warning" key={entry}>{entry}</span>)}</div>}
            <details className="workspace-diff" open={changedLines.length > 0}><summary><History size={15} />Vergleich mit Live-Stand <span>{changedLines.length} Änderungen</span></summary>{changedLines.length ? <div>{changedLines.map((line) => <article key={line.line}><b>L{line.line}</b><del>{line.before || " "}</del><ins>{line.after || " "}</ins></article>)}</div> : <p>Keine Abweichungen.</p>}</details>
          </section>
        </div>
      )}

      {tab === "transfer" && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading"><div><span className="workspace-icon"><Copy size={18} /></span><div><h3>Konfiguration übertragen</h3><p>Ausgewählte Live-Module werden vor dem Kopieren auf der Ziel-Guild geprüft.</p></div></div></div>
          <HelpNote>Guild-spezifische Kanal- und Rollen-IDs werden am Ziel erkannt und blockieren eine unsichere Übernahme.</HelpNote>
          <div className="workspace-transfer-form">
            <label>Zielserver<select value={targetGuildId} onChange={(event) => setTargetGuildId(event.target.value)}><option value="">Server auswählen</option>{targetGuilds.map((guild) => <option key={guild.id} value={guild.id}>{guild.name}</option>)}</select></label>
            <div className="workspace-transfer-modules">{data.modules.map((entry) => <label key={entry.key}><input type="checkbox" checked={transferModules.includes(entry.key)} onChange={(event) => setTransferModules((current) => event.target.checked ? [...current, entry.key] : current.filter((value) => value !== entry.key))} />{entry.label}</label>)}</div>
            <button className="primary-action inline" type="button" onClick={() => void transfer()} disabled={busy || !targetGuildId || transferModules.length === 0 || !canEdit}>{busy ? <Loader2 className="spin" size={16} /> : <Copy size={16} />}Prüfen und übertragen</button>
          </div>
          {transferLog.length > 0 && <div className="workspace-transfer-log">{transferLog.map((entry) => <article key={entry.module} className={entry.ok ? "ok" : "failed"}>{entry.ok ? <Check size={15} /> : <X size={15} />}<strong>{data.modules.find((item) => item.key === entry.module)?.label || entry.module}</strong><span>{entry.message}</span></article>)}</div>}
        </section>
      )}

      {tab === "permissions" && (
        <div className="workspace-permission-layout">
          <section className="workspace-panel">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><UserCog size={18} /></span><div><h3>Berechtigungssimulator</h3><p>Zeigt, was ein Teamzugang im Panel tatsächlich sehen und ändern kann.</p></div></div></div>
            <label>Zugang simulieren<select value={simulatedAccessId} onChange={(event) => setSimulatedAccessId(event.target.value)}><option value="self">Mein aktueller Zugriff</option>{data.delegatedAccess.map((entry) => <option value={entry.id} key={entry.id}>{entry.displayName || entry.principalId} ({entry.accessLevel})</option>)}</select></label>
            <div className="workspace-access-summary"><span className={simulatedAccess?.enabled ? "ok" : "off"}><ShieldCheck size={20} /></span><div><strong>{simulatedAccess?.displayName}</strong><small>{simulatedAccess?.accessLevel} · {simulatedAccess?.enabled ? "aktiv" : "deaktiviert"}</small></div></div>
            <div className="workspace-capability-grid">{["view", "settings", "team", "moderation", "tickets", "music", "history"].map((capability) => <article className={simulatedAccess?.capabilities.includes(capability) ? "allowed" : "denied"} key={capability}>{simulatedAccess?.capabilities.includes(capability) ? <Check size={15} /> : <X size={15} />}<span>{capability}</span></article>)}</div>
          </section>
          <section className="workspace-panel">
            <div className="workspace-panel-heading"><div><span className="workspace-icon"><Eye size={18} /></span><div><h3>Sichtbare Bereiche</h3><p>Erwartete Navigation für diesen Zugriff.</p></div></div></div>
            <div className="workspace-visible-routes">{data.modules.map((entry) => { const capability = ["tickets"].includes(entry.key) ? "tickets" : ["youtube-music", "music-live"].includes(entry.key) ? "music" : "settings"; const allowed = simulatedAccess?.capabilities.includes("view") && (simulatedAccess?.capabilities.includes(capability) || capability === "settings" && simulatedAccess?.capabilities.includes("settings")); return <article key={entry.key} className={allowed ? "allowed" : "denied"}><span>{entry.label}</span><strong>{allowed ? "sichtbar" : "gesperrt"}</strong></article>; })}</div>
            <button className="secondary-action inline" type="button" onClick={() => onNavigate(`/dashboard/${guildId}/team-access`)}><UserCog size={16} />Team-Zugänge verwalten</button>
          </section>
        </div>
      )}

      {tab === "preview" && <WorkspacePreview data={data} module={module} editor={editor} setModule={setModule} loadLive={loadLive} />}

      {tab === "history" && (
        <section className="workspace-panel">
          <div className="workspace-panel-heading"><div><span className="workspace-icon"><History size={18} /></span><div><h3>Änderungs- und Ereignisverlauf</h3><p>Audit-Aktionen und Bot-Synchronisierungen in einer gemeinsamen Zeitleiste.</p></div></div><div className="workspace-filter"><button className={timelineFilter === "all" ? "active" : ""} onClick={() => setTimelineFilter("all")}>Alle</button><button className={timelineFilter === "audit" ? "active" : ""} onClick={() => setTimelineFilter("audit")}>Änderungen</button><button className={timelineFilter === "sync" ? "active" : ""} onClick={() => setTimelineFilter("sync")}>Sync</button></div></div>
          <div className="workspace-timeline">{filteredTimeline.map((entry) => <details key={entry.id}><summary><span className={`workspace-event-icon ${entry.status}`} >{entry.type === "audit" ? <FileJson size={15} /> : <RefreshCw size={15} />}</span><div><strong>{entry.action}</strong><small>{entry.target} · {formatDate(entry.createdAt)}</small></div><span>{entry.status}</span><ChevronRight size={15} /></summary><div className="workspace-event-detail">{entry.detail && <p>{entry.detail}</p>}<div><section><strong>Vorher</strong><pre>{pretty(entry.oldValue)}</pre></section><section><strong>Nachher</strong><pre>{pretty(entry.newValue)}</pre></section></div></div></details>)}{!filteredTimeline.length && <WorkspaceEmpty title="Noch kein Verlauf" text="Sobald etwas geändert oder synchronisiert wird, erscheint es hier." />}</div>
        </section>
      )}

      {tab === "preferences" && (
        <section className="workspace-panel workspace-preferences">
          <div className="workspace-panel-heading"><div><span className="workspace-icon"><Settings2 size={18} /></span><div><h3>Persönliche Panel-Ansicht</h3><p>Diese Einstellungen gelten nur für deinen Discord-Account.</p></div></div></div>
          <div className="workspace-preference-grid">
            <label><span><strong>Darstellungsdichte</strong><small>Mehr Inhalt oder mehr Abstand.</small></span><select value={preferences.density} onChange={(event) => setPreferences({ ...preferences, density: event.target.value as PanelPreferences["density"] })}><option value="comfortable">Komfortabel</option><option value="compact">Kompakt</option></select></label>
            <label><span><strong>Kompakte Seitenleiste</strong><small>Reduziert Abstände in der Guild-Navigation.</small></span><input type="checkbox" checked={preferences.sidebarCompact} onChange={(event) => setPreferences({ ...preferences, sidebarCompact: event.target.checked })} /></label>
            <label><span><strong>Bewegung reduzieren</strong><small>Schaltet nicht notwendige Animationen ab.</small></span><input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => setPreferences({ ...preferences, reduceMotion: event.target.checked })} /></label>
            <label><span><strong>Standardbereich</strong><small>Wird für zukünftige Schnellnavigation gespeichert.</small></span><select value={preferences.defaultSection} onChange={(event) => setPreferences({ ...preferences, defaultSection: event.target.value })}>{data.modules.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label>
          </div>
          <button className="primary-action inline" type="button" onClick={() => void savePreferences()} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />}Ansicht speichern</button>
        </section>
      )}
    </section>
  );
}

function WorkspacePreview({ data, module, editor, setModule, loadLive }: { data: WorkspaceData; module: string; editor: string; setModule: (value: string) => void; loadLive: (value?: string) => Promise<void> }) {
  let payload: Record<string, unknown> = {};
  try { payload = JSON.parse(editor) as Record<string, unknown>; } catch { payload = {}; }
  const embed = (payload.embed && typeof payload.embed === "object" ? payload.embed : {}) as Record<string, unknown>;
  const title = String(embed.title || payload.panelTitle || data.modules.find((entry) => entry.key === module)?.label || "Modmail Manager");
  const description = String(embed.description || payload.panelDescription || payload.message || "Konfiguriere dieses Modul und prüfe hier sofort den sichtbaren Zustand.");
  return <div className="workspace-preview-layout"><section className="workspace-panel"><div className="workspace-panel-heading"><div><span className="workspace-icon"><Eye size={18} /></span><div><h3>Live-Konfigurationsvorschau</h3><p>Eine kompakte Discord-nahe Vorschau ohne eine echte Nachricht zu senden.</p></div></div></div><label>Modul<select value={module} onChange={(event) => { setModule(event.target.value); void loadLive(event.target.value); }}>{data.modules.map((entry) => <option key={entry.key} value={entry.key}>{entry.label}</option>)}</select></label><HelpNote>Die Vorschau nutzt den geladenen Live-Stand oder deinen aktuell geöffneten Entwurf.</HelpNote><div className="workspace-preview-facts"><span><strong>Status</strong>{payload.enabled === false ? "Inaktiv" : "Aktiv / bereit"}</span><span><strong>Sync</strong>{data.modules.find((entry) => entry.key === module)?.syncStatus || "unbekannt"}</span><span><strong>Guild</strong>{data.guild.name}</span></div></section><section className="workspace-discord-preview"><header><span>MM</span><div><strong>Modmail Manager <VerifiedAppBadge /></strong><small>gerade eben</small></div></header><article style={{ borderColor: String(embed.color || "#4f8df7") }}><strong>{title}</strong><p>{description}</p><div><span>{data.modules.find((entry) => entry.key === module)?.label}</span><span>Vorschau</span></div></article><button type="button">Aktion ausführen</button></section></div>;
}

type PaletteEntry = { label: string; detail: string; path: string; keywords: string };

export function GlobalCommandPalette({ request }: { request: RequestFn }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [guilds, setGuilds] = useState<Array<{ id: string; name: string; botInstalled: boolean }>>([]);

  useEffect(() => {
    const openPalette = () => setOpen(true);
    const keydown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette);
    window.addEventListener("keydown", keydown);
    return () => { window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openPalette); window.removeEventListener("keydown", keydown); };
  }, []);

  useEffect(() => {
    if (!open || guilds.length) return;
    void request<{ guilds: Array<{ id: string; name: string; botInstalled: boolean }> }>("/api/guilds").then((result) => setGuilds(result.guilds)).catch(() => setGuilds([]));
  }, [open, guilds.length, request]);

  const routeMatch = window.location.pathname.match(/^\/dashboard\/([^/]+)/);
  const currentGuildId = routeMatch?.[1];
  const staticEntries: PaletteEntry[] = [
    { label: "Serverliste", detail: "Alle verwaltbaren Guilds", path: "/panel", keywords: "dashboard server guild" },
    { label: "Mein Bereich", detail: "Favoriten, Aktivität und Erinnerungen", path: "/mein-bereich", keywords: "account profil" },
    { label: "Dokumentation", detail: "Hilfe und Einrichtung", path: "/dokumentation", keywords: "hilfe docs" },
    ...(currentGuildId ? [
      { label: "Workspace Center", detail: "Setup, Entwürfe und Prüfungen", path: `/dashboard/${currentGuildId}/workspace`, keywords: "setup aufgaben vorlagen" },
      { label: "Ticket-System", detail: "Tickets konfigurieren", path: `/dashboard/${currentGuildId}/tickets`, keywords: "support panel" },
      { label: "Begrüßung", detail: "Willkommensnachricht", path: `/dashboard/${currentGuildId}/welcome`, keywords: "welcome onboarding" },
      { label: "Security Center", detail: "Schutz und Verifizierung", path: `/dashboard/${currentGuildId}/security`, keywords: "raid moderation" },
      { label: "Audit-Log", detail: "Änderungsverlauf", path: `/dashboard/${currentGuildId}/audit-log`, keywords: "history verlauf" }
    ] : [])
  ];
  const entries = [...staticEntries, ...guilds.map((guild) => ({ label: guild.name, detail: guild.botInstalled ? "Server verwalten" : "Bot nicht installiert", path: guild.botInstalled ? `/dashboard/${guild.id}/overview` : "/panel", keywords: `guild ${guild.id}` }))];
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  const filtered = entries.filter((entry) => !normalized || `${entry.label} ${entry.detail} ${entry.keywords}`.toLocaleLowerCase("de-DE").includes(normalized)).slice(0, 12);

  if (!open) return null;
  return <div className="command-palette-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Schnellnavigation"><header><Search size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Seite, Modul oder Server suchen" /><kbd>ESC</kbd></header><div>{filtered.map((entry) => <button type="button" key={`${entry.path}-${entry.label}`} onClick={() => { window.history.pushState({}, "", entry.path); window.dispatchEvent(new PopStateEvent("popstate")); setOpen(false); setQuery(""); }}><span><strong>{entry.label}</strong><small>{entry.detail}</small></span><ArrowRight size={16} /></button>)}{!filtered.length && <WorkspaceEmpty title="Kein Treffer" text="Versuche einen Servernamen oder Modulnamen." />}</div><footer><span><kbd>Ctrl</kbd> + <kbd>K</kbd> öffnen</span><span><BookOpen size={14} />Schnellnavigation</span></footer></section></div>;
}
