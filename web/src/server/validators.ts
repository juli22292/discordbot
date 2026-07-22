import { z } from "zod";

export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "Ungültige Discord-ID.");

const snowflakeArraySchema = z.array(snowflakeSchema).max(100).default([]);

const nullableSnowflakeSchema = z
  .union([snowflakeSchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

export const logCategories = [
  "general",
  "messages",
  "moderation",
  "security",
  "tickets",
  "voice",
  "members",
  "roles",
  "channels",
  "commands",
  "system"
] as const;

export const logCategorySchema = z.enum(logCategories);

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, "Bitte nutze eine gültige Hex-Farbe.")
  .default("#4ddb8f")
  .transform((value) => {
    const normalized = value.startsWith("#") ? value : `#${value}`;
    return normalized.toUpperCase();
  });

export const settingsSchema = z.object({
  locale: z.enum(["de", "en"]).default("de"),
  timezone: z.string().trim().min(1).max(80).default("Europe/Berlin")
});

export const nicknameSchema = z.object({
  nickname: z
    .string()
    .trim()
    .max(32, "Der Nickname darf maximal 32 Zeichen lang sein.")
    .nullable()
    .optional()
    .transform((value) => {
      if (value === undefined || value === null) return null;
      return value.length ? value : null;
    })
});

export const commandConfigSchema = z.object({
  enabled: z.boolean().default(true),
  cooldownSeconds: z.number().int().min(0).max(86400).default(0),
  ephemeral: z.boolean().default(true),
  administratorOnly: z.boolean().default(false),
  moderatorOnly: z.boolean().default(false),
  allowedChannelIds: snowflakeArraySchema,
  deniedChannelIds: snowflakeArraySchema,
  allowedRoleIds: snowflakeArraySchema,
  deniedRoleIds: snowflakeArraySchema
});

export const customCommandSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{1,32}$/, "Command-Namen dürfen nur a-z, 0-9, _ und - enthalten."),
  description: z.string().trim().min(1).max(100),
  responseContent: z.string().trim().min(1).max(2000),
  enabled: z.boolean().default(true),
  ephemeral: z.boolean().default(false),
  cooldownSeconds: z.number().int().min(0).max(86400).default(0),
  allowedChannelIds: snowflakeArraySchema,
  deniedChannelIds: snowflakeArraySchema,
  allowedRoleIds: snowflakeArraySchema,
  deniedRoleIds: snowflakeArraySchema
});

export const partialCustomCommandSchema = customCommandSchema.partial().extend({
  name: customCommandSchema.shape.name.optional()
});

export const welcomeSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  channelId: nullableSnowflakeSchema,
  message: z.string().trim().max(2000, "Die Begrüßungsnachricht darf maximal 2000 Zeichen lang sein.").default(""),
  autoRoleId: nullableSnowflakeSchema,
  embed: z
    .object({
      useEmbed: z.boolean().default(true),
      title: z.string().trim().max(256, "Der Embed-Titel darf maximal 256 Zeichen lang sein.").default("Willkommen auf {server}"),
      description: z
        .string()
        .trim()
        .max(4000, "Die Embed-Beschreibung darf maximal 4000 Zeichen lang sein.")
        .default("{member_mention}, schön dass du da bist. Du bist unser {member_count}. Mitglied."),
      color: hexColorSchema,
      imageMode: z.enum(["banner", "thumbnail", "none"]).default("banner"),
      imageMediaKey: z.string().trim().max(500).nullable().optional().transform((value) => value || null),
      imageUrl: z
        .union([z.string().trim().url().max(500), z.literal(""), z.null(), z.undefined()])
        .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null)),
      mentionMember: z.boolean().default(true),
      allowEveryone: z.boolean().default(false),
      allowedRoleIds: snowflakeArraySchema,
      showGeneratedCard: z.boolean().default(true)
    })
    .default({})
});

export const presenceSchema = z.object({
  status: z.enum(["online", "idle", "dnd", "offline"]).default("online"),
  activityType: z.enum(["none", "playing", "watching", "listening", "streaming", "custom"]).default("none"),
  text: z.string().trim().max(128, "Der Status-Text darf maximal 128 Zeichen lang sein.").default(""),
  url: z
    .union([z.string().trim().url().max(500), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null))
});

export const inviteCreateSchema = z.object({
  channelId: snowflakeSchema,
  maxAge: z.number().int().min(0).max(604800).default(604800),
  maxUses: z.number().int().min(0).max(100).default(0),
  temporary: z.boolean().default(false)
});

export const botAdminActionSchema = z.object({
  action: z.enum([
    "snapshot.refresh",
    "runtime.refresh",
    "commands.sync",
    "music.reconnect",
    "music.disconnect_all",
    "restart.request"
  ])
});

export const pterodactylPowerSchema = z.object({
  signal: z.enum(["start", "stop", "restart", "kill"])
});

export const guildModuleSettingsSchema = z.object({
  modules: z.object({
    logging: z.boolean().default(false),
    welcome: z.boolean().default(false),
    tempVoice: z.boolean().default(false),
    counting: z.boolean().default(false),
    levelSystem: z.boolean().default(false),
    autorole: z.boolean().default(false),
    spotifyMusic: z.boolean().default(false),
    games: z.boolean().default(false),
    moderation: z.boolean().default(false)
  })
});

export const adminRoleUpdateSchema = z.object({
  name: z.string().trim().min(1, "Der Rollenname darf nicht leer sein.").max(100, "Der Rollenname darf maximal 100 Zeichen lang sein."),
  color: hexColorSchema,
  hoist: z.boolean().default(false),
  mentionable: z.boolean().default(false)
});

export const loggingSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  channelMappings: z.record(logCategorySchema, nullableSnowflakeSchema).default({}),
  events: z.record(logCategorySchema, z.boolean()).default({})
});

export const loggingTestSchema = z.object({
  category: logCategorySchema.default("general")
});

export const tempVoiceSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  creatorChannelIds: z.array(snowflakeSchema).max(25).default([]),
  categoryId: nullableSnowflakeSchema,
  interfaceChannelId: nullableSnowflakeSchema,
  nameTemplate: z
    .string()
    .trim()
    .min(1, "Das Namensformat darf nicht leer sein.")
    .max(90, "Das Namensformat darf maximal 90 Zeichen lang sein.")
    .default("{user}s Raum"),
  defaultUserLimit: z.number().int().min(0).max(99).default(0),
  defaultBitrateKbps: z.number().int().min(8).max(384).default(64)
});

export const tempVoicePanelSchema = z.object({
  channelId: nullableSnowflakeSchema
});

export const countingSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  channelId: nullableSnowflakeSchema,
  resetOnError: z.boolean().default(true),
  deleteWrongMessages: z.boolean().default(false),
  milestoneInterval: z.number().int().min(0).max(100000).default(100)
});

export const countingResetSchema = z.object({
  number: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).default(0),
  clearRecord: z.boolean().default(false)
});

const levelRoleRewardSchema = z.object({
  level: z.number().int().min(1).max(1000),
  roleId: snowflakeSchema
});

export const levelSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  announcementChannelId: nullableSnowflakeSchema,
  roleRewards: z.array(levelRoleRewardSchema).max(50).default([])
}).superRefine((value, context) => {
  const levels = new Set<number>();
  const roles = new Set<string>();

  value.roleRewards.forEach((reward, index) => {
    if (levels.has(reward.level)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roleRewards", index, "level"],
        message: `Für Level ${reward.level} darf nur eine Rolle hinterlegt werden.`
      });
    }
    if (roles.has(reward.roleId)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["roleRewards", index, "roleId"],
        message: "Jede Discord-Rolle darf nur einmal als Levelbelohnung verwendet werden."
      });
    }
    levels.add(reward.level);
    roles.add(reward.roleId);
  });
});

export const autoroleSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  humanRoleIds: z.array(snowflakeSchema).max(25, "Es sind maximal 25 Mitgliederrollen möglich.").default([]),
  botRoleIds: z.array(snowflakeSchema).max(25, "Es sind maximal 25 Botrollen möglich.").default([]),
  delaySeconds: z.number().int().min(0).max(3600).default(0),
  waitForScreening: z.boolean().default(true)
}).superRefine((value, context) => {
  (["humanRoleIds", "botRoleIds"] as const).forEach((key) => {
    const seen = new Set<string>();
    value[key].forEach((roleId, index) => {
      if (seen.has(roleId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key, index],
          message: "Jede Discord-Rolle darf pro Bereich nur einmal ausgewählt werden."
        });
      }
      seen.add(roleId);
    });
  });

  if (value.enabled && value.humanRoleIds.length === 0 && value.botRoleIds.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["enabled"],
      message: "Für ein aktives Autorole-Modul wird mindestens eine Rolle benötigt."
    });
  }
});

export function assertSameGuild(routeGuildId: string, rowGuildId: string): void {
  if (routeGuildId !== rowGuildId) {
    throw new Error("Guild-Isolation verletzt: Ressource gehoert zu einer anderen Guild.");
  }
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return "/panel";
  if (!value.startsWith("/") || value.startsWith("//")) return "/panel";
  if (value.startsWith("/api/")) return "/panel";
  return value;
}

export function validationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Die Eingaben konnten nicht verarbeitet werden.";
}
