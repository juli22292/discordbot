import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicAiContent } from "../public-ai-content";

function renderMarkdown(content: string) {
  return renderToStaticMarkup(<PublicAiContent content={content} />);
}

describe("public AI markdown content", () => {
  it("renders unordered command lists without visible markdown markers", () => {
    const html = renderMarkdown([
      "**Befehle:**",
      "",
      "* `hallo`: Gibt \"Hallo\" aus.",
      "* `stop`: Beendet den Bot."
    ].join("\n"));

    expect(html).toContain("<strong>Befehle:</strong>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li><code class=\"public-ai-inline-code\">hallo</code>: Gibt");
    expect(html).toContain("<li><code class=\"public-ai-inline-code\">stop</code>: Beendet");
    expect(html).not.toContain("* <code");
  });

  it("renders common GFM blocks and formatting", () => {
    const html = renderMarkdown([
      "## Übersicht",
      "",
      "1. Erster Schritt",
      "2. Zweiter Schritt",
      "",
      "> Sicherer Hinweis",
      "",
      "| Name | Status |",
      "| --- | --- |",
      "| Bot | **online** |",
      "",
      "- [x] Fertig",
      "- [ ] Offen",
      "",
      "~~veraltet~~"
    ].join("\n"));

    expect(html).toContain("<h2>Übersicht</h2>");
    expect(html).toContain("<ol>");
    expect(html).toContain("<blockquote>");
    expect(html).toContain("<table>");
    expect(html).toContain("type=\"checkbox\"");
    expect(html).toContain("<del>veraltet</del>");
  });

  it("keeps code blocks copyable and does not execute raw HTML or unsafe links", () => {
    const html = renderMarkdown([
      "```python",
      "print(\"Hallo\")",
      "```",
      "",
      "<script>alert('x')</script>",
      "",
      "[Unsicher](javascript:alert(1))"
    ].join("\n"));

    expect(html).toContain("public-ai-code");
    expect(html).toContain("Code kopieren");
    expect(html).toContain("<span>python</span>");
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("href=\"javascript:");
  });
});
