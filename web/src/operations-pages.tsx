import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Ban,
  BadgeCheck,
  Check,
  ChevronDown,
  ClipboardList,
  Headphones,
  History,
  KeyRound,
  Loader2,
  Music2,
  Pause,
  PhoneOff,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Shield,
  ShieldCheck,
  SkipForward,
  SlidersHorizontal,
  Square,
  Trash2,
  UserMinus,
  UserPlus,
  UserRound,
  UsersRound,
  UserCog,
  Volume2
} from "lucide-react";

type ApiErrorBody = { error?: { message?: string } };
type AccessLevel = "administrator" | "moderator" | "supporter" | "viewer";

type TeamEntry = {
  id: string;
  principalType: "user" | "role";
  principalId: string;
  displayName: string;
  accessLevel: AccessLevel;
  capabilities: string[];
  enabled: boolean;
  createdByDiscordUserId: string;
  createdAt: string;
  updatedAt: string;
};

type RoleOption = {
  id: string;
  name: string;
  managed: boolean;
};

type ChannelOption = {
  id: string;
  name: string;
  type: string;
  canSend?: boolean | null;
};

type ModerationMember = {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bot: boolean;
  roles: string[];
  joinedAt: string | null;
};

type ModerationCase = {
  id: string;
  caseNumber: number;
  targetDiscordUserId: string;
  targetDisplayName: string;
  actorDiscordUserId: string;
  actorDisplayName: string;
  action: string;
  reason: string;
  durationSeconds: number | null;
  status: string;
  error: string | null;
  createdAt: string;
};

type FeatureSettings = {
  enabled: boolean;
  fields: Record<string, string | number | boolean | string[] | null>;
};

type MusicPlayer = {
  guildId: string;
  channelName?: string | null;
  playing: boolean;
  paused: boolean;
  volume: number | null;
  trackTitle?: string | null;
  trackAuthor?: string | null;
  trackUri?: string | null;
  artworkUrl?: string | null;
  durationMs?: number;
  positionMs?: number;
  loopEnabled?: boolean;
  status?: string | null;
  queueLength: number;
  queue?: Array<{ query: string; requesterId: string; volume: number }>;
};

type AuditEntry = {
  id: string;
  actorDiscordUserId: string;
  action: string;
  target: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
  revertId?: string | null;
  revertStatus?: string | null;
  revertError?: string | null;
  reversible: boolean;
};

const DEMO_GUILD_ID = "demo";
const DEMO_ROLE_ID = "200000000000000002";
const DEMO_USER_ID = "300000000000000001";

function demoResponse(path: string): unknown {
  if (path.endsWith("/roles")) {
    return { roles: [{ id: DEMO_ROLE_ID, name: "Support Team", managed: false }] };
  }
  if (path.endsWith("/channels")) {
    return { channels: [{ id: "100000000000000001", name: "mod-log", type: "text", canSend: true }] };
  }
  if (path.endsWith("/team-access")) {
    return {
      access: { native: true, level: "owner", capabilities: ["view", "settings", "team", "moderation", "tickets", "music", "history"] },
      entries: [{
        id: "demo-team",
        principalType: "role",
        principalId: DEMO_ROLE_ID,
        displayName: "Support Team",
        accessLevel: "supporter",
        capabilities: ["view", "tickets", "history"],
        enabled: true,
        createdByDiscordUserId: DEMO_USER_ID,
        createdAt: "2026-07-24T08:00:00.000Z",
        updatedAt: "2026-07-24T08:00:00.000Z"
      }]
    };
  }
  if (path.endsWith("/moderation/members")) {
    return {
      members: [
        { id: "300000000000000002", username: "alex", displayName: "Alex", avatar: null, bot: false, roles: [], joinedAt: "2026-06-14T12:00:00.000Z" },
        { id: "300000000000000003", username: "sam", displayName: "Sam", avatar: null, bot: false, roles: [], joinedAt: "2026-06-20T12:00:00.000Z" }
      ]
    };
  }
  if (path.endsWith("/moderation/cases")) {
    return {
      cases: [{
        id: "demo-case",
        caseNumber: 42,
        targetDiscordUserId: "300000000000000002",
        targetDisplayName: "Alex",
        actorDiscordUserId: DEMO_USER_ID,
        actorDisplayName: "Modmail Manager",
        action: "timeout",
        reason: "Wiederholter Spam",
        durationSeconds: 3600,
        status: "completed",
        error: null,
        createdAt: "2026-07-24T10:10:00.000Z"
      }]
    };
  }
  if (path.endsWith("/features/moderation-center")) {
    return {
      feature: {
        enabled: true,
        fields: {
          logChannelId: "100000000000000001",
          moderatorRoleIds: [DEMO_ROLE_ID],
          warnExpireDays: 30,
          defaultTimeoutMinutes: 60,
          autoPunishmentThreshold: 3,
          autoPunishmentAction: "timeout"
        }
      }
    };
  }
  if (path.endsWith("/music/live")) {
    return {
      music: {
        backend: "lavalink",
        playerSource: "youtube",
        updatedAt: new Date().toISOString(),
        player: {
          guildId: DEMO_GUILD_ID,
          channelName: "Musik",
          playing: true,
          paused: false,
          volume: 100,
          trackTitle: "Midnight Drive",
          trackAuthor: "Modmail Sessions",
          artworkUrl: null,
          durationMs: 224000,
          positionMs: 76000,
          loopEnabled: false,
          status: "Wird abgespielt",
          queueLength: 2,
          queue: [
            { query: "Neon Skyline", requesterId: DEMO_USER_ID, volume: 100 },
            { query: "After Hours", requesterId: "300000000000000002", volume: 100 }
          ]
        }
      }
    };
  }
  if (path.endsWith("/audit-log")) {
    return {
      auditLog: [
        {
          id: "demo-audit-1",
          action: "feature.youtube-music.update",
          target: "youtube-music",
          actorDiscordUserId: DEMO_USER_ID,
          oldValue: { enabled: false },
          newValue: { enabled: true },
          reversible: true,
          createdAt: "2026-07-24T10:30:00.000Z"
        },
        {
          id: "demo-audit-2",
          action: "moderation.timeout",
          target: "300000000000000002",
          actorDiscordUserId: DEMO_USER_ID,
          oldValue: null,
          newValue: { reason: "Spam", durationSeconds: 3600 },
          reversible: false,
          createdAt: "2026-07-24T09:45:00.000Z"
        }
      ]
    };
  }
  return { ok: true, demo: true };
}

async function operationApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (path.includes(`/api/guilds/${DEMO_GUILD_ID}/`)) {
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    return demoResponse(path) as T;
  }
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { credentials: "include", ...init, headers });
  const data = await response.json().catch(() => ({})) as ApiErrorBody;
  if (!response.ok) throw new Error(data.error?.message || "Die Anfrage ist fehlgeschlagen.");
  return data as T;
}

function useOperationApi<T>(path: string, dependencies: React.DependencyList) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      setData(await operationApi<T>(path));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Fehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // The caller defines the resource identity explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return { data, error, loading, reload: load };
}

async function waitForSync(guildId: string, eventId: string, timeoutMs = 20_000) {
  if (guildId === DEMO_GUILD_ID) return { status: "completed", lastError: null };
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((resolve) => window.setTimeout(resolve, 800));
    const response = await operationApi<{ event: { status: string; lastError: string | null } }>(
      `/api/guilds/${guildId}/sync-events/${eventId}`
    );
    if (response.event.status === "completed" || response.event.status === "failed") return response.event;
  }
  return null;
}

function dateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("de-DE");
}

function Loading({ text }: { text: string }) {
  return <div className="operation-loading"><Loader2 className="spin" size={20} /><strong>{text}</strong></div>;
}

function Notice({ text, danger = false }: { text: string | null; danger?: boolean }) {
  if (!text) return null;
  return <div className={`operation-notice ${danger ? "danger" : ""}`}>{danger ? <AlertTriangle size={17} /> : <Check size={17} />}<span>{text}</span></div>;
}

function ReloadButton({ loading, onClick }: { loading: boolean; onClick: () => void | Promise<void> }) {
  return <button className="secondary-action inline refresh-button" type="button" onClick={() => void onClick()} disabled={loading}>{loading ? <Loader2 className="spin" size={16} /> : <RefreshCw size={16} />}{loading ? "Laden" : "Aktualisieren"}</button>;
}

function Metric({ icon, label, value, tone = "" }: { icon: React.ReactNode; label: string; value: string; tone?: string }) {
  return <div className={`operation-metric ${tone}`}><span>{icon}</span><small>{label}</small><strong>{value}</strong></div>;
}

function PageTabs({ active, onChange, tabs }: { active: string; onChange: (key: string) => void; tabs: Array<{ key: string; label: string; icon: React.ReactNode }> }) {
  return <nav className="operation-tabs">{tabs.map((tab) => <button type="button" className={active === tab.key ? "active" : ""} onClick={() => onChange(tab.key)} key={tab.key}>{tab.icon}{tab.label}</button>)}</nav>;
}

const CAPABILITIES = [
  { key: "view", label: "Dashboard", text: "Guild-Status und Ressourcen ansehen" },
  { key: "settings", label: "Einstellungen", text: "Module und Konfiguration bearbeiten" },
  { key: "team", label: "Team", text: "Panel-Zugänge verwalten" },
  { key: "moderation", label: "Moderation", text: "Mitglieder moderieren und Fälle sehen" },
  { key: "tickets", label: "Tickets", text: "Ticketsystem verwalten" },
  { key: "music", label: "Musik", text: "Live-Player bedienen" },
  { key: "history", label: "Verlauf", text: "Änderungen und Rücknahmen sehen" }
] as const;

const LEVEL_DEFAULTS: Record<AccessLevel, string[]> = {
  administrator: CAPABILITIES.map((capability) => capability.key),
  moderator: ["view", "moderation", "history"],
  supporter: ["view", "tickets", "history"],
  viewer: ["view"]
};

export function TeamAccessPage({ guildId }: { guildId: string }) {
  const team = useOperationApi<{ access: { level: string }; entries: TeamEntry[] }>(`/api/guilds/${guildId}/team-access`, [guildId]);
  const roles = useOperationApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [principalType, setPrincipalType] = useState<"user" | "role">("role");
  const [principalId, setPrincipalId] = useState("");
  const [level, setLevel] = useState<AccessLevel>("supporter");
  const [capabilities, setCapabilities] = useState<string[]>(LEVEL_DEFAULTS.supporter);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const entries = team.data?.entries ?? [];

  async function save() {
    if (!principalId) {
      setStatus(principalType === "role" ? "Wähle zuerst eine Discord-Rolle." : "Gib eine Discord-Nutzer-ID ein.");
      return;
    }
    setBusy("create");
    setStatus(null);
    try {
      await operationApi(`/api/guilds/${guildId}/team-access`, {
        method: "POST",
        body: JSON.stringify({ principalType, principalId, accessLevel: level, capabilities, enabled: true })
      });
      setPrincipalId("");
      setStatus("Team-Zugang wurde gespeichert.");
      await team.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Speichern fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function update(entry: TeamEntry, patch: Record<string, unknown>) {
    setBusy(entry.id);
    setStatus(null);
    try {
      await operationApi(`/api/guilds/${guildId}/team-access/${entry.id}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      await team.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Änderung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(entry: TeamEntry) {
    setBusy(entry.id);
    setStatus(null);
    try {
      await operationApi(`/api/guilds/${guildId}/team-access/${entry.id}`, { method: "DELETE" });
      setStatus(`${entry.displayName || entry.principalId} wurde entfernt.`);
      await team.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Entfernen fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  function changeLevel(nextLevel: AccessLevel) {
    setLevel(nextLevel);
    setCapabilities(LEVEL_DEFAULTS[nextLevel]);
  }

  return (
    <section className="control-page operations-page">
      <header className="control-hero">
        <div><p className="eyebrow"><UserCog size={15} /> Access Control</p><h2>Team-Zugänge</h2><p>Vergib getrennte Webpanel-Rechte an Discord-Nutzer oder komplette Teamrollen.</p></div>
        <div className="control-hero-actions"><span className="pill ok">{entries.filter((entry) => entry.enabled).length} aktiv</span><ReloadButton loading={team.loading || roles.loading} onClick={async () => { await Promise.all([team.reload(), roles.reload()]); }} /></div>
      </header>
      {(team.loading || roles.loading) && !team.data && <Loading text="Team-Zugänge werden geladen" />}
      <Notice text={team.error || roles.error} danger />
      {team.data && (
        <>
          <div className="operation-metrics">
            <Metric icon={<UsersRound size={19} />} label="Zugänge" value={String(entries.length)} />
            <Metric icon={<BadgeCheck size={19} />} label="Aktiv" value={String(entries.filter((entry) => entry.enabled).length)} tone="ok" />
            <Metric icon={<ShieldCheck size={19} />} label="Dein Zugriff" value={team.data.access.level} />
            <Metric icon={<KeyRound size={19} />} label="Rechtegruppen" value="7" />
          </div>
          <Notice text={status} />
          <div className="operation-columns">
            <section className="panel operation-panel">
              <div className="operation-panel-heading"><div><h3>Zugang hinzufügen</h3><p>Quelle und Rechte sauber festlegen.</p></div><Plus size={18} /></div>
              <div className="segmented-control">
                <button type="button" className={principalType === "role" ? "active" : ""} onClick={() => { setPrincipalType("role"); setPrincipalId(""); }}><UsersRound size={15} /> Discord-Rolle</button>
                <button type="button" className={principalType === "user" ? "active" : ""} onClick={() => { setPrincipalType("user"); setPrincipalId(""); }}><UserRound size={15} /> Nutzer</button>
              </div>
              <div className="operation-form">
                <label><span>{principalType === "role" ? "Discord-Rolle" : "Discord-Nutzer-ID"}</span>{principalType === "role" ? <select value={principalId} onChange={(event) => setPrincipalId(event.target.value)}><option value="">Rolle auswählen</option>{(roles.data?.roles ?? []).filter((role) => !role.managed && role.name !== "@everyone").map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select> : <input value={principalId} onChange={(event) => setPrincipalId(event.target.value.replace(/\D/g, ""))} placeholder="1267171819362717828" />}</label>
                <label><span>Zugriffsstufe</span><select value={level} onChange={(event) => changeLevel(event.target.value as AccessLevel)}><option value="administrator">Administrator</option><option value="moderator">Moderator</option><option value="supporter">Supporter</option><option value="viewer">Nur ansehen</option></select></label>
              </div>
              <div className="capability-grid">
                {CAPABILITIES.map((capability) => <label className={capabilities.includes(capability.key) ? "selected" : ""} key={capability.key}><input type="checkbox" checked={capabilities.includes(capability.key)} disabled={capability.key === "view"} onChange={() => setCapabilities((current) => current.includes(capability.key) ? current.filter((item) => item !== capability.key) : [...current, capability.key])} /><span><strong>{capability.label}</strong><small>{capability.text}</small></span></label>)}
              </div>
              <button className="primary-action inline" type="button" onClick={() => void save()} disabled={busy === "create"}>{busy === "create" ? <Loader2 className="spin" size={16} /> : <UserPlus size={16} />} Zugang speichern</button>
            </section>
            <section className="panel operation-panel">
              <div className="operation-panel-heading"><div><h3>Aktuelles Team</h3><p>Änderungen gelten beim nächsten Aufruf sofort.</p></div><span className="pill neutral">{entries.length}</span></div>
              <div className="team-access-list">
                {entries.map((entry) => <article className={!entry.enabled ? "disabled" : ""} key={entry.id}><span className="team-access-avatar">{entry.principalType === "role" ? <UsersRound size={18} /> : <UserRound size={18} />}</span><div className="team-access-copy"><strong>{entry.displayName || entry.principalId}</strong><small>{entry.principalType === "role" ? "Rolle" : "Nutzer"} · {entry.principalId}</small><div>{entry.capabilities.map((capability) => <span key={capability}>{CAPABILITIES.find((item) => item.key === capability)?.label || capability}</span>)}</div></div><select value={entry.accessLevel} onChange={(event) => { const nextLevel = event.target.value as AccessLevel; void update(entry, { accessLevel: nextLevel, capabilities: LEVEL_DEFAULTS[nextLevel] }); }} disabled={busy === entry.id}><option value="administrator">Administrator</option><option value="moderator">Moderator</option><option value="supporter">Supporter</option><option value="viewer">Nur ansehen</option></select><label className="compact-switch" title="Zugang aktivieren oder deaktivieren"><input type="checkbox" checked={entry.enabled} onChange={(event) => void update(entry, { enabled: event.target.checked })} disabled={busy === entry.id} /><span /></label><button className="icon-button danger" type="button" title="Zugang entfernen" onClick={() => void remove(entry)} disabled={busy === entry.id}><Trash2 size={16} /></button></article>)}
                {!entries.length && <p className="operation-empty">Noch keine zusätzlichen Team-Zugänge.</p>}
              </div>
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export function ModerationCenterPage({ guildId }: { guildId: string }) {
  const members = useOperationApi<{ members: ModerationMember[] }>(`/api/guilds/${guildId}/moderation/members`, [guildId]);
  const cases = useOperationApi<{ cases: ModerationCase[] }>(`/api/guilds/${guildId}/moderation/cases`, [guildId]);
  const settings = useOperationApi<{ feature: FeatureSettings }>(`/api/guilds/${guildId}/features/moderation-center`, [guildId]);
  const channels = useOperationApi<{ channels: ChannelOption[] }>(`/api/guilds/${guildId}/channels`, [guildId]);
  const roles = useOperationApi<{ roles: RoleOption[] }>(`/api/guilds/${guildId}/roles`, [guildId]);
  const [tab, setTab] = useState("cases");
  const [memberId, setMemberId] = useState("");
  const [action, setAction] = useState("timeout");
  const [reason, setReason] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [search, setSearch] = useState("");
  const [caseSearch, setCaseSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [ruleDraft, setRuleDraft] = useState<FeatureSettings["fields"]>({});

  useEffect(() => {
    if (settings.data?.feature.fields) setRuleDraft(settings.data.feature.fields);
  }, [settings.data]);

  const selectedMember = members.data?.members.find((member) => member.id === memberId);
  const filteredMembers = (members.data?.members ?? []).filter((member) => !search.trim() || `${member.displayName} ${member.username} ${member.id}`.toLowerCase().includes(search.toLowerCase()));
  const filteredCases = (cases.data?.cases ?? []).filter((entry) => !caseSearch.trim() || `${entry.caseNumber} ${entry.targetDisplayName} ${entry.action} ${entry.reason}`.toLowerCase().includes(caseSearch.toLowerCase()));
  const completed = cases.data?.cases.filter((entry) => entry.status === "completed").length ?? 0;
  const pending = cases.data?.cases.filter((entry) => entry.status === "pending" || entry.status === "processing").length ?? 0;
  const failed = cases.data?.cases.filter((entry) => entry.status === "failed").length ?? 0;

  async function submitAction() {
    if (!memberId) return setStatus("Wähle zuerst ein Mitglied.");
    if (!reason.trim()) return setStatus("Gib einen nachvollziehbaren Moderationsgrund an.");
    setBusy(true);
    setStatus(null);
    try {
      const response = await operationApi<{ eventId: string; caseNumber: number }>(`/api/guilds/${guildId}/moderation/actions`, {
        method: "POST",
        body: JSON.stringify({
          memberId,
          targetDisplayName: selectedMember?.displayName || "",
          action,
          reason,
          durationSeconds: action === "timeout" ? durationMinutes * 60 : undefined,
          deleteMessageSeconds: action === "ban" ? 86400 : 0
        })
      });
      setStatus(`Fall #${response.caseNumber} wurde an den Bot übergeben.`);
      setReason("");
      setTab("cases");
      await cases.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Moderationsaktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  async function saveRules() {
    setBusy(true);
    setStatus(null);
    try {
      await operationApi(`/api/guilds/${guildId}/features/moderation-center`, {
        method: "PUT",
        body: JSON.stringify({ enabled: settings.data?.feature.enabled ?? true, fields: ruleDraft })
      });
      setStatus("Moderationsregeln wurden gespeichert.");
      await settings.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Regeln konnten nicht gespeichert werden.");
    } finally {
      setBusy(false);
    }
  }

  const moderatorRoleIds = Array.isArray(ruleDraft.moderatorRoleIds) ? ruleDraft.moderatorRoleIds as string[] : [];
  return (
    <section className="control-page operations-page">
      <header className="control-hero">
        <div><p className="eyebrow"><Shield size={15} /> Trust & Safety</p><h2>Moderationszentrale</h2><p>Mitgliederaktionen, Fallstatus und Eskalationsregeln in einer Arbeitsansicht.</p></div>
        <div className="control-hero-actions"><span className={`pill ${failed ? "danger" : "ok"}`}>{failed ? `${failed} Fehler` : "Bereit"}</span><ReloadButton loading={members.loading || cases.loading} onClick={async () => { await Promise.all([members.reload(), cases.reload(), settings.reload()]); }} /></div>
      </header>
      <div className="operation-metrics">
        <Metric icon={<ClipboardList size={19} />} label="Fälle" value={String(cases.data?.cases.length ?? 0)} />
        <Metric icon={<Check size={19} />} label="Erledigt" value={String(completed)} tone="ok" />
        <Metric icon={<Activity size={19} />} label="Ausstehend" value={String(pending)} tone={pending ? "warn" : "ok"} />
        <Metric icon={<UsersRound size={19} />} label="Mitglieder" value={String(members.data?.members.length ?? 0)} />
      </div>
      <PageTabs active={tab} onChange={setTab} tabs={[{ key: "cases", label: "Fälle", icon: <History size={16} /> }, { key: "action", label: "Neue Aktion", icon: <UserMinus size={16} /> }, { key: "rules", label: "Regeln", icon: <SlidersHorizontal size={16} /> }]} />
      <Notice text={members.error || cases.error || settings.error} danger />
      <Notice text={status} />
      {tab === "cases" && <section className="panel operation-panel"><div className="operation-toolbar"><label><Search size={16} /><input value={caseSearch} onChange={(event) => setCaseSearch(event.target.value)} placeholder="Fall, Mitglied oder Grund suchen" /></label><span className="pill neutral">{filteredCases.length} Treffer</span></div>{cases.loading && !cases.data ? <Loading text="Moderationsfälle werden geladen" /> : <div className="moderation-case-list">{filteredCases.map((entry) => <article key={entry.id}><span className={`case-number ${entry.status}`}>#{entry.caseNumber}</span><div className="case-person"><strong>{entry.targetDisplayName || entry.targetDiscordUserId}</strong><small>{entry.targetDiscordUserId} · von {entry.actorDisplayName || entry.actorDiscordUserId}</small></div><span className="case-action">{entry.action.replace("_", " ")}</span><p>{entry.reason}</p><div className="case-meta"><span className={`pill ${entry.status === "failed" ? "danger" : entry.status === "completed" ? "ok" : "neutral"}`}>{entry.status}</span><time>{dateTime(entry.createdAt)}</time></div>{entry.error && <small className="case-error">{entry.error}</small>}</article>)}{!filteredCases.length && <p className="operation-empty">Noch keine Moderationsfälle vorhanden.</p>}</div>}</section>}
      {tab === "action" && <div className="operation-columns moderation-action-layout"><section className="panel operation-panel"><div className="operation-panel-heading"><div><h3>Mitglied auswählen</h3><p>Suche nach Name oder Discord-ID.</p></div><UsersRound size={18} /></div><div className="operation-toolbar"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Mitglied suchen" /></label></div><div className="moderation-member-list">{filteredMembers.slice(0, 100).map((member) => <button type="button" className={memberId === member.id ? "selected" : ""} onClick={() => setMemberId(member.id)} key={member.id}><span className="member-avatar">{member.avatar ? <img src={member.avatar} alt="" /> : member.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{member.displayName}</strong><small>@{member.username} · {member.id}</small></span>{member.bot && <span className="pill neutral">Bot</span>}{memberId === member.id && <Check size={16} />}</button>)}</div></section><section className="panel operation-panel"><div className="operation-panel-heading"><div><h3>Aktion vorbereiten</h3><p>Discord prüft zusätzlich Rechte und Rollenhierarchie.</p></div><ShieldCheck size={18} /></div><div className="operation-form"><label><span>Aktion</span><select value={action} onChange={(event) => setAction(event.target.value)}><option value="timeout">Timeout setzen</option><option value="timeout_remove">Timeout entfernen</option><option value="kick">Kicken</option><option value="ban">Bannen</option></select></label>{action === "timeout" && <label><span>Dauer</span><select value={durationMinutes} onChange={(event) => setDurationMinutes(Number(event.target.value))}><option value={10}>10 Minuten</option><option value={60}>1 Stunde</option><option value={360}>6 Stunden</option><option value={1440}>1 Tag</option><option value={10080}>7 Tage</option><option value={40320}>28 Tage</option></select></label>}<label><span>Grund</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Sachlicher Grund für Audit-Log und Discord..." /></label></div><div className="moderation-confirm"><AlertTriangle size={18} /><div><strong>{selectedMember?.displayName || "Kein Mitglied gewählt"}</strong><small>Aktion: {action.replace("_", " ")}</small></div></div><button className={`inline ${action === "ban" || action === "kick" ? "danger-action" : "primary-action"}`} type="button" onClick={() => void submitAction()} disabled={busy || !selectedMember}>{busy ? <Loader2 className="spin" size={16} /> : action === "ban" ? <Ban size={16} /> : <Shield size={16} />} Aktion ausführen</button></section></div>}
      {tab === "rules" && <section className="panel operation-panel"><div className="operation-panel-heading"><div><h3>Moderationsregeln</h3><p>Werte für Team, Standardaktionen und Eskalationen.</p></div><SlidersHorizontal size={18} /></div><div className="operation-form operation-form-grid"><label><span>Moderations-Log</span><select value={String(ruleDraft.logChannelId ?? "")} onChange={(event) => setRuleDraft({ ...ruleDraft, logChannelId: event.target.value || null })}><option value="">Kein Kanal</option>{(channels.data?.channels ?? []).filter((channel) => channel.canSend !== false && ["text", "news", "announcement"].includes(channel.type.toLowerCase())).map((channel) => <option value={channel.id} key={channel.id}>#{channel.name}</option>)}</select></label><label><span>Warnablauf in Tagen</span><input type="number" min={0} max={3650} value={Number(ruleDraft.warnExpireDays ?? 0)} onChange={(event) => setRuleDraft({ ...ruleDraft, warnExpireDays: Number(event.target.value) })} /></label><label><span>Standard-Timeout in Minuten</span><input type="number" min={1} max={40320} value={Number(ruleDraft.defaultTimeoutMinutes ?? 60)} onChange={(event) => setRuleDraft({ ...ruleDraft, defaultTimeoutMinutes: Number(event.target.value) })} /></label><label><span>Eskalationsgrenze</span><input type="number" min={0} max={100} value={Number(ruleDraft.autoPunishmentThreshold ?? 0)} onChange={(event) => setRuleDraft({ ...ruleDraft, autoPunishmentThreshold: Number(event.target.value) })} /></label><label><span>Automatische Strafe</span><select value={String(ruleDraft.autoPunishmentAction ?? "log")} onChange={(event) => setRuleDraft({ ...ruleDraft, autoPunishmentAction: event.target.value })}><option value="log">Nur protokollieren</option><option value="timeout">Timeout</option><option value="kick">Kicken</option><option value="ban">Bannen</option></select></label></div><div className="operation-role-grid">{(roles.data?.roles ?? []).filter((role) => !role.managed && role.name !== "@everyone").map((role) => { const selected = moderatorRoleIds.includes(role.id); return <button type="button" className={selected ? "selected" : ""} onClick={() => setRuleDraft({ ...ruleDraft, moderatorRoleIds: selected ? moderatorRoleIds.filter((id) => id !== role.id) : [...moderatorRoleIds, role.id] })} key={role.id}><UsersRound size={16} /><span>{role.name}</span>{selected ? <Check size={15} /> : <Plus size={15} />}</button>; })}</div><button className="primary-action inline" type="button" onClick={() => void saveRules()} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Save size={16} />} Regeln speichern</button></section>}
    </section>
  );
}

function musicTime(milliseconds: number | null | undefined): string {
  const seconds = Math.max(0, Math.floor(Number(milliseconds ?? 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function LiveMusicPage({ guildId }: { guildId: string }) {
  const live = useOperationApi<{ music: Record<string, unknown> & { player: MusicPlayer | null; updatedAt: string | null } }>(`/api/guilds/${guildId}/music/live`, [guildId]);
  const player = live.data?.music.player ?? null;
  const [volume, setVolume] = useState(100);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (typeof player?.volume === "number") setVolume(player.volume);
  }, [player?.volume]);
  useEffect(() => {
    const timer = window.setInterval(() => void live.reload(), 5000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guildId]);

  async function control(action: string, extra: Record<string, unknown> = {}) {
    if (action === "stop" && !window.confirm("Die aktuelle Wiedergabe wirklich stoppen und die Warteschlange leeren?")) return;
    if (action === "disconnect" && !window.confirm("Den Bot wirklich vom Sprachkanal trennen?")) return;

    setBusy(action);
    setStatus(null);
    try {
      const response = await operationApi<{ eventId: string }>(`/api/guilds/${guildId}/music/live/actions`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
      const result = await waitForSync(guildId, response.eventId);
      if (result?.status === "failed") throw new Error(result.lastError || "Der Musikplayer hat die Aktion abgelehnt.");
      const successMessages: Record<string, string> = {
        pause: "Wiedergabe wurde pausiert.",
        resume: "Wiedergabe wurde fortgesetzt.",
        skip: "Der nächste Titel wird abgespielt.",
        stop: "Wiedergabe und Warteschlange wurden gestoppt.",
        disconnect: "Der Bot wurde vom Sprachkanal getrennt.",
        loop: player?.loopEnabled ? "Dauerschleife wurde deaktiviert." : "Dauerschleife wurde aktiviert.",
        volume: `Lautstärke wurde auf ${Number(extra.volume ?? volume)}% gesetzt.`
      };
      setStatus(result ? successMessages[action] || "Musikplayer wurde aktualisiert." : "Die Aktion liegt noch in der Bot-Queue.");
      await live.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Musikaktion fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  const duration = Number(player?.durationMs ?? 0);
  const position = Math.max(0, Math.min(duration || Number(player?.positionMs ?? 0), Number(player?.positionMs ?? 0)));
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const queue = player?.queue ?? [];
  const volumeProgress = Math.max(0, Math.min(100, ((volume - 1) / 199) * 100));

  return (
    <section className="control-page operations-page music-live-page">
      <header className="control-hero"><div><p className="eyebrow"><Headphones size={15} /> Live Music Operations</p><h2>Live-Player</h2><p>Den laufenden Discord-Player steuern, Lautstärke setzen und die Queue überblicken.</p></div><div className="control-hero-actions"><span className={`pill ${player ? "ok" : "neutral"}`}>{player ? "Verbunden" : "Kein Player"}</span><ReloadButton loading={live.loading} onClick={live.reload} /></div></header>
      <Notice text={live.error} danger />
      {live.loading && !live.data && <Loading text="Live-Player wird geladen" />}
      {live.data && !player && <div className="operation-empty large"><Music2 size={30} /><strong>Aktuell läuft keine Musik</strong><span>Sobald der Bot einem Sprachkanal beitritt, erscheint der Player automatisch.</span></div>}
      {player && <><section className="music-now-playing"><div className="music-artwork">{player.artworkUrl ? <img src={player.artworkUrl} alt="" /> : <Music2 size={42} />}</div><div className="music-track-copy"><span>Jetzt läuft</span><h2>{player.trackTitle || "Unbekannter Titel"}</h2><p>{player.trackAuthor || "Unbekannter Künstler"} · {player.channelName ? `🔊 ${player.channelName}` : "Sprachkanal"}</p><div className="music-progress"><span style={{ width: `${progress}%` }} /></div><div className="music-progress-time"><span>{musicTime(position)}</span><span>{musicTime(duration)}</span></div></div><div className="music-live-state"><span className={`music-pulse ${player.paused ? "paused" : ""}`} /><strong>{player.paused ? "Pausiert" : player.playing ? "Live" : "Bereit"}</strong><small>{player.status || "Player verbunden"}</small></div></section><section className="music-control-deck"><div className="music-transport"><button type="button" className={player.loopEnabled ? "active" : ""} title="Dauerschleife" onClick={() => void control("loop")} disabled={Boolean(busy)}><RotateCcw size={18} /></button><button type="button" className="primary" title={player.paused ? "Fortsetzen" : "Pausieren"} onClick={() => void control(player.paused ? "resume" : "pause")} disabled={Boolean(busy)}>{busy === "pause" || busy === "resume" ? <Loader2 className="spin" size={20} /> : player.paused ? <Play size={20} /> : <Pause size={20} />}</button><button type="button" title="Überspringen" onClick={() => void control("skip")} disabled={Boolean(busy)}><SkipForward size={19} /></button><button type="button" title="Stoppen" onClick={() => void control("stop")} disabled={Boolean(busy)}><Square size={17} /></button><button type="button" className="danger" title="Sprachkanal verlassen" onClick={() => void control("disconnect")} disabled={Boolean(busy)}><PhoneOff size={18} /></button></div><div className="music-volume-control"><Volume2 size={18} /><input aria-label="Lautstärke" type="range" min={1} max={200} value={volume} style={{ "--volume-progress": `${volumeProgress}%` } as React.CSSProperties} onChange={(event) => setVolume(Number(event.target.value))} onPointerUp={(event) => void control("volume", { volume: Number(event.currentTarget.value) })} /><strong>{volume}%</strong></div></section><Notice text={status} /><div className="operation-columns music-details-grid"><section className="panel operation-panel"><div className="operation-panel-heading"><div><h3>Player-Status</h3><p>Live aus dem Bot-Heartbeat.</p></div><Activity size={18} /></div><dl className="operation-facts"><div><dt>Backend</dt><dd>{String(live.data?.music.backend ?? "-")}</dd></div><div><dt>Quelle</dt><dd>{String(live.data?.music.playerSource ?? "-")}</dd></div><div><dt>Lautstärke</dt><dd>{player.volume ?? "-"}%</dd></div><div><dt>Loop</dt><dd>{player.loopEnabled ? "Aktiv" : "Aus"}</dd></div><div><dt>Heartbeat</dt><dd>{dateTime(live.data?.music.updatedAt)}</dd></div></dl></section><section className="panel operation-panel"><div className="operation-panel-heading"><div><h3>Warteschlange</h3><p>Die nächsten Titel in Wiedergabereihenfolge.</p></div><span className="pill neutral">{player.queueLength}</span></div><div className="music-queue-list">{queue.map((item, index) => <article key={`${item.query}-${index}`}><span>{index + 1}</span><div><strong>{item.query || "Unbekannter Titel"}</strong><small>Angefordert von {item.requesterId || "unbekannt"} · {item.volume}%</small></div></article>)}{!queue.length && <p className="operation-empty">Die Warteschlange ist leer.</p>}</div></section></div></>}
    </section>
  );
}

export function OperationsAuditLogPage({ guildId }: { guildId: string }) {
  const audit = useOperationApi<{
    access: { native: boolean; capabilities: string[] };
    auditLog: AuditEntry[];
  }>(`/api/guilds/${guildId}/audit-log`, [guildId]);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const entries = useMemo(() => (audit.data?.auditLog ?? []).filter((entry) => !search.trim() || `${entry.action} ${entry.target} ${entry.actorDiscordUserId}`.toLowerCase().includes(search.toLowerCase())), [audit.data, search]);
  const canRevert = Boolean(audit.data?.access.native || audit.data?.access.capabilities.includes("settings"));

  async function revert(entry: AuditEntry) {
    if (!window.confirm("Diese Konfiguration wirklich auf den vorherigen Stand zurücksetzen?")) return;
    setBusy(entry.id);
    setStatus(null);
    try {
      const response = await operationApi<{ eventId: string }>(`/api/guilds/${guildId}/audit-log/${entry.id}/revert`, { method: "POST" });
      const sync = await waitForSync(guildId, response.eventId);
      if (sync?.status === "failed") throw new Error(sync.lastError || "Wiederherstellung fehlgeschlagen.");
      setStatus(sync ? "Vorheriger Stand wurde wiederhergestellt." : "Wiederherstellung liegt noch in der Bot-Queue.");
      await audit.reload();
    } catch (requestError) {
      setStatus(requestError instanceof Error ? requestError.message : "Wiederherstellung fehlgeschlagen.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="control-page operations-page">
      <header className="control-hero"><div><p className="eyebrow"><History size={15} /> Änderungsverlauf</p><h2>Audit & Wiederherstellung</h2><p>Änderungen vergleichen, Verantwortliche nachvollziehen und unterstützte Konfigurationen zurücksetzen.</p></div><div className="control-hero-actions"><span className="pill neutral">{audit.data?.auditLog.length ?? 0} Einträge</span><ReloadButton loading={audit.loading} onClick={audit.reload} /></div></header>
      <Notice text={audit.error} danger /><Notice text={status} />
      {audit.loading && !audit.data ? <Loading text="Änderungsverlauf wird geladen" /> : <section className="panel operation-panel"><div className="operation-toolbar"><label><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Aktion, Ziel oder Nutzer-ID suchen" /></label><span className="pill neutral">{entries.length} Treffer</span></div><div className="audit-timeline">{entries.map((entry) => <article className={expanded === entry.id ? "expanded" : ""} key={entry.id}><button className="audit-entry-main" type="button" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}><span className="audit-entry-icon"><History size={17} /></span><span><strong>{entry.action}</strong><small>{entry.target} · {entry.actorDiscordUserId}</small></span><time>{dateTime(entry.createdAt)}</time>{entry.revertStatus && <span className={`pill ${entry.revertStatus === "failed" ? "danger" : "neutral"}`}>{entry.revertStatus}</span>}<ChevronDown size={17} /></button>{expanded === entry.id && <div className="audit-entry-details"><div><span>Vorher</span><pre>{entry.oldValue === null ? "Keine Daten" : JSON.stringify(entry.oldValue, null, 2)}</pre></div><div><span>Nachher</span><pre>{entry.newValue === null ? "Keine Daten" : JSON.stringify(entry.newValue, null, 2)}</pre></div><div className="audit-entry-actions">{entry.reversible && canRevert ? <button className="secondary-action inline" type="button" onClick={() => void revert(entry)} disabled={busy === entry.id}>{busy === entry.id ? <Loader2 className="spin" size={16} /> : <RotateCcw size={16} />} Vorherigen Stand wiederherstellen</button> : <span>{entry.revertId ? "Bereits zurückgesetzt." : entry.reversible ? "Dein Team-Zugang erlaubt keine Wiederherstellung." : "Keine automatische Rücknahme verfügbar."}</span>}{entry.revertError && <small className="case-error">{entry.revertError}</small>}</div></div>}</article>)}{!entries.length && <p className="operation-empty">Noch keine passenden Änderungen vorhanden.</p>}</div></section>}
    </section>
  );
}
