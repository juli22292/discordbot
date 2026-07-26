import React, { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type PublicAiContentProps = {
  content: string;
  onCopyError?: () => void;
};

function PublicAiCodeBlock({
  code,
  language,
  onCopyError
}: {
  code: string;
  language: string;
  onCopyError?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  function copyCodeWithFallback(): boolean {
    const textarea = document.createElement("textarea");
    textarea.value = code;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.inset = "-9999px auto auto -9999px";
    document.body.appendChild(textarea);
    textarea.select();

    try {
      return document.execCommand("copy");
    } finally {
      textarea.remove();
    }
  }

  async function copyCode() {
    try {
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(code);
        } catch {
          if (!copyCodeWithFallback()) throw new Error("Clipboard unavailable");
        }
      } else if (!copyCodeWithFallback()) {
        throw new Error("Clipboard unavailable");
      }

      setCopied(true);
      if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        resetTimerRef.current = null;
      }, 1800);
    } catch {
      onCopyError?.();
    }
  }

  return (
    <div className="public-ai-code">
      <div className="public-ai-code-header">
        <span>{language || "Code"}</span>
        <button
          type="button"
          className={copied ? "is-copied" : ""}
          aria-label={copied ? "Code kopiert" : "Code kopieren"}
          title={copied ? "Kopiert" : "Code kopieren"}
          onClick={() => void copyCode()}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? "Kopiert" : "Kopieren"}</span>
        </button>
      </div>
      <pre><code>{code}</code></pre>
    </div>
  );
}

export function PublicAiContent({ content, onCopyError }: PublicAiContentProps) {
  return (
    <div className="public-ai-answer-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ children, href }) => {
            if (!href || !/^https?:\/\//i.test(href)) return <span>{children}</span>;
            return <a href={href} target="_blank" rel="noreferrer">{children}</a>;
          },
          code: ({ children }) => (
            <code className="public-ai-inline-code">{children}</code>
          ),
          img: ({ alt, src }) => {
            if (!src || !/^https?:\/\//i.test(src)) return null;
            return <img src={src} alt={alt || ""} loading="lazy" />;
          },
          pre: ({ children }) => {
            const codeElement = React.Children.toArray(children)[0];
            if (!React.isValidElement<{ className?: string; children?: React.ReactNode }>(codeElement)) {
              return <pre>{children}</pre>;
            }

            const className = codeElement.props.className || "";
            const language = className.match(/language-([\w-]+)/i)?.[1] || "";
            const code = String(codeElement.props.children ?? "").replace(/\n$/, "");
            return (
              <PublicAiCodeBlock
                code={code}
                language={language}
                onCopyError={onCopyError}
              />
            );
          },
          table: ({ children }) => (
            <div className="public-ai-table-scroll">
              <table>{children}</table>
            </div>
          )
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
