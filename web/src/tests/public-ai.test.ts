import { describe, expect, it } from "vitest";
import { buildPublicAiSystemPrompt, publicAiChatSchema } from "../server/public-ai";

describe("public AI chat helpers", () => {
  it("accepts a bounded conversation ending with a user message", () => {
    const parsed = publicAiChatSchema.parse({
      messages: [
        { role: "user", content: "Erkläre mir TypeScript." },
        { role: "assistant", content: "TypeScript erweitert JavaScript um Typen." },
        { role: "user", content: "Zeig mir ein kurzes Beispiel." }
      ]
    });

    expect(parsed.messages).toHaveLength(3);
    expect(parsed.messages.at(-1)?.role).toBe("user");
  });

  it("rejects a conversation that does not end with the user", () => {
    const parsed = publicAiChatSchema.safeParse({
      messages: [{ role: "assistant", content: "Wie kann ich helfen?" }]
    });

    expect(parsed.success).toBe(false);
  });

  it("rejects oversized conversation history", () => {
    const parsed = publicAiChatSchema.safeParse({
      messages: Array.from({ length: 5 }, (_, index) => ({
        role: index === 4 ? "user" : "assistant",
        content: "x".repeat(5000)
      }))
    });

    expect(parsed.success).toBe(false);
  });

  it("builds a general assistant prompt without panel actions", () => {
    const prompt = buildPublicAiSystemPrompt();

    expect(prompt).toContain("allgemeiner KI-Assistent");
    expect(prompt).toContain("Markdown-Codeblöcken");
    expect(prompt).not.toContain("Navigationsziele");
  });
});
