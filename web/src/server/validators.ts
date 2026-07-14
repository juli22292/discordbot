import { z } from "zod";

export const snowflakeSchema = z.string().regex(/^\d{17,20}$/, "Ungueltige Discord-ID.");

const snowflakeArraySchema = z.array(snowflakeSchema).max(100).default([]);

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
    .regex(/^[a-z0-9_-]{1,32}$/, "Command-Namen duerfen nur a-z, 0-9, _ und - enthalten."),
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

export function assertSameGuild(routeGuildId: string, rowGuildId: string): void {
  if (routeGuildId !== rowGuildId) {
    throw new Error("Guild-Isolation verletzt: Ressource gehoert zu einer anderen Guild.");
  }
}

export function safeRedirectPath(value: string | null | undefined): string {
  if (!value) return "/home";
  if (!value.startsWith("/") || value.startsWith("//")) return "/home";
  if (value.startsWith("/api/")) return "/home";
  return value;
}

export function validationError(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(" ");
  }
  if (error instanceof Error) return error.message;
  return "Die Eingaben konnten nicht verarbeitet werden.";
}
