import { describe, expect, it } from "vitest";
import {
  buildPublicAiSystemPrompt,
  publicAiChatSchema,
  resolvePublicAiMode
} from "../server/public-ai";

describe("public AI chat helpers", () => {
  it("accepts a conversation ending with a user message", () => {
    const parsed = publicAiChatSchema.parse({
      messages: [
        { role: "user", content: "Erkläre mir TypeScript." },
        { role: "assistant", content: "TypeScript erweitert JavaScript um Typen." },
        { role: "user", content: "Zeig mir ein kurzes Beispiel." }
      ]
    });

    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages.at(-1)?.role).toBe("user");
    expect(parsed.mode).toBe("auto");
  });

  it("rejects a conversation that does not end with the user", () => {
    const parsed = publicAiChatSchema.safeParse({
      messages: [{ role: "assistant", content: "Wie kann ich helfen?" }]
    });

    expect(parsed.success).toBe(false);
  });

  it("does not impose an artificial message or character limit", () => {
    const parsed = publicAiChatSchema.safeParse({
      messages: Array.from({ length: 50 }, (_, index) => ({
        role: index === 49 ? "user" : "assistant",
        content: "x".repeat(10_000)
      }))
    });

    expect(parsed.success).toBe(true);
  });

  it("builds a general assistant prompt without panel actions", () => {
    const prompt = buildPublicAiSystemPrompt();

    expect(prompt).toContain("allgemeiner KI-Assistent");
    expect(prompt).toContain("Markdown-Codeblöcken");
    expect(prompt).not.toContain("MINECRAFT-PLUGIN-MODUS");
    expect(prompt).not.toContain("Navigationsziele");
  });

  it("automatically detects Minecraft plugin requests", () => {
    const input = publicAiChatSchema.parse({
      messages: [{
        role: "user",
        content: "Erstelle ein Paper Plugin mit /spawn und einer config.yml."
      }]
    });

    expect(resolvePublicAiMode(input)).toBe("minecraft");
  });

  it("automatically detects general coding requests", () => {
    const input = publicAiChatSchema.parse({
      messages: [{
        role: "user",
        content: "Behebe diesen TypeScript Fehler und gib mir den vollständigen Code."
      }]
    });

    expect(resolvePublicAiMode(input)).toBe("coding");
  });

  it("keeps explicit modes even before a detailed question is entered", () => {
    const input = publicAiChatSchema.parse({
      mode: "minecraft",
      messages: [{ role: "user", content: "Hilf mir beim Projekt." }]
    });

    expect(resolvePublicAiMode(input)).toBe("minecraft");
  });

  it("adds complete project and Minecraft consistency rules", () => {
    const prompt = buildPublicAiSystemPrompt("minecraft");

    expect(prompt).toContain("alle benötigten Dateien vollständig");
    expect(prompt).toContain("plugin.yml");
    expect(prompt).toContain("Main-Class");
    expect(prompt).toContain("Server-Thread");
    expect(prompt).toContain("Build-Befehl");
  });
});
