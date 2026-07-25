import { describe, expect, it } from "vitest";
import { parsePublicAiInlineMarkdown } from "../public-ai-markdown";

describe("public AI inline markdown", () => {
  it("parses bold text without exposing the marker", () => {
    expect(parsePublicAiInlineMarkdown("Das ist **wichtig**.")).toEqual([
      { type: "text", text: "Das ist " },
      { type: "strong", text: "wichtig" },
      { type: "text", text: "." }
    ]);
  });

  it("supports inline code and safe HTTPS links", () => {
    expect(parsePublicAiInlineMarkdown(
      "Nutze `TOKEN` im [Developer Portal](https://discord.com/developers/applications)."
    )).toEqual([
      { type: "text", text: "Nutze " },
      { type: "code", text: "TOKEN" },
      { type: "text", text: " im " },
      {
        type: "link",
        text: "Developer Portal",
        href: "https://discord.com/developers/applications"
      },
      { type: "text", text: "." }
    ]);
  });

  it("keeps malformed or unsafe markup as plain text", () => {
    expect(parsePublicAiInlineMarkdown(
      "**offen und [unsicher](javascript:alert(1))"
    )).toEqual([
      { type: "text", text: "**offen und [unsicher](javascript:alert(1))" }
    ]);
  });
});
