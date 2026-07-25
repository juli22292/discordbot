export type PublicAiInlineToken =
  | { type: "text" | "strong" | "code"; text: string }
  | { type: "link"; text: string; href: string };

const INLINE_MARKDOWN_PATTERN = /\*\*([^\n]+?)\*\*|`([^`\n]+)`|\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g;

export function parsePublicAiInlineMarkdown(value: string): PublicAiInlineToken[] {
  const tokens: PublicAiInlineToken[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = INLINE_MARKDOWN_PATTERN.exec(value)) !== null) {
    if (match.index > cursor) {
      tokens.push({ type: "text", text: value.slice(cursor, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: "strong", text: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: "code", text: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ type: "link", text: match[3], href: match[4] });
    }

    cursor = match.index + match[0].length;
  }

  if (cursor < value.length || tokens.length === 0) {
    tokens.push({ type: "text", text: value.slice(cursor) });
  }

  return tokens;
}
