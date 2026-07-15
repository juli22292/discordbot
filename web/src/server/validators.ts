import { z } from "zod";

export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "Ungültige Discord-ID.");

const snowflakeArraySchema = z.array(snowflakeSchema).max(100).default([]);

const nullableSnowflakeSchema = z
  .union([snowflakeSchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (typeof value === "string" && value.trim() ? value.trim() : null));

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
