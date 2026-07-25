import { describe, expect, it } from "vitest";
import {
  assistantChatSchema,
  buildAssistantSystemPrompt,
  parseAssistantModelResponse
} from "../server/assistant";

describe("assistant server helpers", () => {
  it("accepts a bounded conversation with page context", () => {
    const parsed = assistantChatSchema.parse({
      messages: [{ role: "user", content: "Wie richte ich Counting ein?" }],
      context: {
        path: "/dashboard/12345678901234567/counting",
        guildId: "12345678901234567",
        section: "counting",
        demoMode: false
      }
    });

    expect(parsed.messages).toHaveLength(1);
    expect(parsed.context.section).toBe("counting");
  });

  it("rejects conversations that do not end with a user message", () => {
    const parsed = assistantChatSchema.safeParse({
      messages: [{ role: "assistant", content: "Hallo" }],
      context: { path: "/panel", demoMode: false }
    });

    expect(parsed.success).toBe(false);
  });

  it("parses validated answers and navigation actions", () => {
    const response = parseAssistantModelResponse(JSON.stringify({
      answer: "Öffne das Counting-Modul und wähle einen Textkanal.",
      actions: [{ type: "navigate", target: "counting", label: "Counting öffnen" }]
    }));

    expect(response.actions[0]?.target).toBe("counting");
  });

  it("drops invalid actions while preserving a useful answer", () => {
    const response = parseAssistantModelResponse(JSON.stringify({
      answer: "Ich helfe dir gern.",
      actions: [{ type: "navigate", target: "https://example.com", label: "Extern öffnen" }]
    }));

    expect(response).toEqual({ answer: "Ich helfe dir gern.", actions: [] });
  });

  it("includes only safe panel context in the system prompt", () => {
    const prompt = buildAssistantSystemPrompt({
      path: "/dashboard/12345678901234567/tickets",
      guildId: "12345678901234567",
      guildName: "Support",
      section: "tickets",
      demoMode: false
    });

    expect(prompt).toContain("Ticket");
    expect(prompt).toContain("keine API-Schlüssel");
    expect(prompt).toContain('"section":"tickets"');
  });
});
