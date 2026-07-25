import { z } from "zod";

export const assistantTargets = [
  "panel",
  "admin",
  "documentation",
  "overview",
  "profile",
  "welcome",
  "autorole",
  "level-system",
  "counting",
  "giveaways",
  "reaction-roles",
  "suggestions",
  "starboard",
  "birthdays",
  "badges",
  "community-tools",
  "tickets",
  "automations",
  "auto-nickname",
  "applications",
  "server-stats",
  "commands",
  "custom-commands",
  "logging",
  "audit-log",
  "temp-voice",
  "youtube-music",
  "games",
  "minecraft",
  "security",
  "raidmode",
  "moderation-center",
  "onboarding",
  "backups"
] as const;

export type AssistantTarget = (typeof assistantTargets)[number];

export const assistantChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(2400)
  })).min(1).max(12),
  context: z.object({
    path: z.string().trim().min(1).max(300),
    guildId: z.string().regex(/^\d{17,20}$/).nullable().optional(),
    guildName: z.string().trim().max(120).nullable().optional(),
    section: z.string().trim().max(80).nullable().optional(),
    demoMode: z.boolean().default(false)
  })
}).superRefine((value, context) => {
  const totalCharacters = value.messages.reduce((sum, message) => sum + message.content.length, 0);
  if (totalCharacters > 12_000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["messages"],
      message: "Der Gesprächsverlauf ist zu lang. Bitte starte einen neuen Chat."
    });
  }
  if (value.messages.at(-1)?.role !== "user") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["messages"],
      message: "Die letzte Nachricht muss vom Nutzer stammen."
    });
  }
});

const assistantActionSchema = z.object({
  type: z.literal("navigate"),
  target: z.enum(assistantTargets),
  label: z.string().trim().min(1).max(60)
});

const assistantModelResponseSchema = z.object({
  answer: z.string().trim().min(1).max(6000),
  actions: z.array(assistantActionSchema).max(3).default([])
});

export type AssistantAction = z.infer<typeof assistantActionSchema>;
export type AssistantModelResponse = z.infer<typeof assistantModelResponseSchema>;
export type AssistantContext = z.infer<typeof assistantChatSchema>["context"];

export function buildAssistantSystemPrompt(context: AssistantContext): string {
  const pageContext = {
    path: context.path,
    guildId: context.guildId ?? null,
    guildName: context.guildName ?? null,
    section: context.section ?? null,
    demoMode: context.demoMode
  };

  return [
    "Du bist der KI-Helfer des Modmail Manager Webpanels.",
    "Antworte standardmäßig auf Deutsch, freundlich, konkret und eher kurz.",
    "Du kennst Discord-Administration sowie alle Module dieses Panels und erklärst genaue, umsetzbare Schritte.",
    "Du darfst keine API-Schlüssel, Tokens, Passwörter oder andere Secrets anfordern, ausgeben oder erraten.",
    "Behaupte niemals, eine Einstellung gespeichert, einen Nutzer moderiert oder eine Discord-Aktion ausgeführt zu haben.",
    "Änderungen bleiben immer beim Nutzer. Du darfst nur sichere Navigationsaktionen vorschlagen.",
    `Erlaubte Navigationsziele: ${assistantTargets.join(", ")}.`,
    "Antworte ausschließlich als gültiges JSON-Objekt mit dieser Struktur:",
    '{"answer":"Antworttext","actions":[{"type":"navigate","target":"tickets","label":"Ticket-System öffnen"}]}',
    "Nutze höchstens drei Aktionen und nur, wenn sie zur Frage passen. Ohne passende Aktion gibst du eine leere Liste zurück.",
    `Aktueller Seitenkontext: ${JSON.stringify(pageContext)}`
  ].join("\n");
}

export function parseAssistantModelResponse(content: string): AssistantModelResponse {
  const trimmed = content.trim();
  if (!trimmed) {
    return { answer: "Ich konnte gerade keine Antwort erzeugen. Bitte versuche es erneut.", actions: [] };
  }

  try {
    const parsed = assistantModelResponseSchema.safeParse(JSON.parse(trimmed));
    if (parsed.success) return parsed.data;

    const fallback = JSON.parse(trimmed) as { answer?: unknown };
    if (typeof fallback.answer === "string" && fallback.answer.trim()) {
      return { answer: fallback.answer.trim().slice(0, 6000), actions: [] };
    }
  } catch {
    // A plain-text model response remains useful and is rendered without HTML.
  }

  return { answer: trimmed.slice(0, 6000), actions: [] };
}
