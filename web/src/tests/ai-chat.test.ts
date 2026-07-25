import { describe, expect, it } from "vitest";
import { isAiDeleteCommand } from "../ai-chat";

describe("AI chat commands", () => {
  it("recognizes the delete command regardless of whitespace or case", () => {
    expect(isAiDeleteCommand("!delete")).toBe(true);
    expect(isAiDeleteCommand("  !DELETE  ")).toBe(true);
  });

  it("does not treat regular messages as commands", () => {
    expect(isAiDeleteCommand("Bitte !delete erklären")).toBe(false);
    expect(isAiDeleteCommand("delete")).toBe(false);
  });
});
