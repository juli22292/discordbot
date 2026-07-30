import { z } from "zod";

export const pluginBuildPlatforms = ["paper", "purpur", "spigot"] as const;
export type PluginBuildPlatform = (typeof pluginBuildPlatforms)[number];
export type PluginBuildStatus = "queued" | "running" | "succeeded" | "failed";

export type PluginProjectFile = {
  path: string;
  content: string;
};

export type PluginBuildResponse = {
  id: string;
  status: PluginBuildStatus;
  projectName: string;
  platform: PluginBuildPlatform;
  apiVersion: string;
  javaRelease: 17 | 21;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  artifactName: string | null;
  error: string | null;
  logTail: string | null;
};

export const pluginBuildStartSchema = z.object({
  source: z.string().min(1).max(600_000),
  projectName: z.string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u, "Der Projektname enthält nicht erlaubte Zeichen."),
  platform: z.enum(pluginBuildPlatforms),
  apiVersion: z.string()
    .trim()
    .min(1)
    .max(48)
    .regex(/^[0-9][0-9A-Za-z.+_-]*$/, "Die Minecraft/API-Version ist ungültig."),
  javaRelease: z.union([z.literal(17), z.literal(21)])
});

export type PluginBuildStartInput = z.infer<typeof pluginBuildStartSchema>;

const builderResponseSchema = z.object({
  id: z.string().regex(/^[a-f0-9]{32}$/),
  status: z.enum(["queued", "running", "succeeded", "failed"]),
  projectName: z.string(),
  platform: z.enum(pluginBuildPlatforms),
  apiVersion: z.string(),
  javaRelease: z.union([z.literal(17), z.literal(21)]),
  createdAt: z.string(),
  startedAt: z.string().nullable().optional().transform((value) => value ?? null),
  finishedAt: z.string().nullable().optional().transform((value) => value ?? null),
  artifactName: z.string().nullable().optional().transform((value) => value ?? null),
  error: z.string().nullable().optional().transform((value) => value ?? null),
  logTail: z.string().nullable().optional().transform((value) => value ?? null)
});

export function parsePluginBuildResponse(value: unknown): PluginBuildResponse {
  return builderResponseSchema.parse(value);
}

const SUPPORTED_RESOURCE_EXTENSIONS = [
  ".yml",
  ".yaml",
  ".json",
  ".properties",
  ".conf",
  ".txt",
  ".toml",
  ".mcmeta",
  ".lang"
];

const PROJECT_PATH_PATTERN = /src\/main\/(?:java|resources)\/[A-Za-z0-9_./-]+/g;
const MAX_FILES = 64;
const MAX_FILE_BYTES = 131_072;
const MAX_SOURCE_BYTES = 524_288;

function normalizedProjectPath(path: string): string | null {
  const normalized = path
    .trim()
    .replace(/^["'`]+|["'`,:;]+$/g, "")
    .replaceAll("\\", "/");

  if (
    normalized.startsWith("/")
    || normalized.includes("..")
    || normalized.includes("//")
    || !/^[A-Za-z0-9_./-]{1,240}$/.test(normalized)
  ) {
    return null;
  }
  if (normalized.startsWith("src/main/java/") && normalized.endsWith(".java")) {
    return normalized;
  }
  if (!normalized.startsWith("src/main/resources/")) return null;
  const lowerPath = normalized.toLowerCase();
  return SUPPORTED_RESOURCE_EXTENSIONS.some((extension) => lowerPath.endsWith(extension))
    ? normalized
    : null;
}

function pathFromFence(info: string, prefix: string): string | null {
  const candidates: string[] = [];
  const infoPath = info.match(PROJECT_PATH_PATTERN)?.at(-1);
  if (infoPath) candidates.push(infoPath);

  const precedingLines = prefix
    .slice(-500)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-6)
    .reverse();

  for (const line of precedingLines) {
    const path = line.match(PROJECT_PATH_PATTERN)?.at(-1);
    if (path) candidates.push(path);
  }

  for (const candidate of candidates) {
    const normalized = normalizedProjectPath(candidate);
    if (normalized) return normalized;
  }
  return null;
}

export class PluginProjectExtractionError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = []) {
    super(message);
    this.name = "PluginProjectExtractionError";
    this.details = details;
  }
}

export function extractMinecraftProjectFiles(markdown: string): PluginProjectFile[] {
  const files: PluginProjectFile[] = [];
  const ignoredCodeBlocks: string[] = [];
  const seenPaths = new Set<string>();
  const fencePattern = /```([^\r\n`]*)\r?\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;
  let totalBytes = 0;

  while ((match = fencePattern.exec(markdown)) !== null) {
    const info = match[1] ?? "";
    const content = match[2] ?? "";
    const path = pathFromFence(info, markdown.slice(0, match.index));
    if (!path) {
      if (/^\s*(?:java|ya?ml|json|properties|toml)\b/i.test(info)) {
        ignoredCodeBlocks.push(info.trim() || "Codeblock ohne Pfad");
      }
      continue;
    }

    const pathKey = path.toLowerCase();
    if (seenPaths.has(pathKey)) {
      throw new PluginProjectExtractionError(
        "Ein Dateipfad wurde mehrfach ausgegeben.",
        [path]
      );
    }

    const fileBytes = new TextEncoder().encode(content).byteLength;
    if (fileBytes > MAX_FILE_BYTES) {
      throw new PluginProjectExtractionError(
        "Eine Quelldatei ist größer als erlaubt.",
        [path]
      );
    }

    totalBytes += fileBytes;
    seenPaths.add(pathKey);
    files.push({ path, content });
  }

  const details: string[] = [];
  if (files.length === 0) {
    details.push("Die KI-Antwort enthält keine Codeblöcke mit einem vollständigen Pfad wie src/main/java/.../Plugin.java.");
  }
  if (ignoredCodeBlocks.length > 0) {
    details.push(`${ignoredCodeBlocks.length} Codeblock/Codeblöcke ohne erkennbaren Projektpfad wurden nicht übernommen.`);
  }
  if (files.length > MAX_FILES) {
    details.push(`Das Projekt enthält mehr als ${MAX_FILES} Dateien.`);
  }
  if (totalBytes > MAX_SOURCE_BYTES) {
    details.push("Die Quelldateien sind zusammen größer als 512 KiB.");
  }
  if (!files.some((file) => file.path.startsWith("src/main/java/") && file.path.endsWith(".java"))) {
    details.push("Mindestens eine Java-Datei unter src/main/java fehlt.");
  }
  if (!files.some((file) => (
    file.path === "src/main/resources/plugin.yml"
    || file.path === "src/main/resources/paper-plugin.yml"
  ))) {
    details.push("src/main/resources/plugin.yml oder paper-plugin.yml fehlt.");
  }

  if (details.length > 0) {
    throw new PluginProjectExtractionError(
      "Die KI-Antwort ist noch kein vollständig kompilierbares Plugin-Projekt.",
      details
    );
  }
  return files;
}

export function shouldOfferPluginBuild(mode: string | undefined, content: string): boolean {
  if (mode !== "minecraft") return false;
  return content.includes("```")
    && /src\/main\/java\/[A-Za-z0-9_./-]+\.java/.test(content)
    && /src\/main\/resources\/(?:plugin|paper-plugin)\.yml/.test(content);
}

export function safePluginBuildId(value: string): string {
  return z.string().regex(/^[a-f0-9]{32}$/).parse(value);
}
