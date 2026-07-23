import { useCallback, useEffect, useRef, useState } from "react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeBlockProps = {
  code: string;
  language?: string;
};

type CopyStatus = "idle" | "copied" | "error";

const COPY_TIMEOUT_MS = 1500;
const ERROR_TIMEOUT_MS = 1500;

// 按需加载的语言表只包含 refractor 规范名（如 typescript），
// 把 Markdown 代码围栏里的常见别名映射过去，保证 ts/js 等仍能高亮
const LANGUAGE_ALIASES: Record<string, string> = {
  js: "javascript",
  ts: "typescript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  yml: "yaml",
  md: "markdown",
  html: "markup",
  xml: "markup",
  cs: "csharp",
  kt: "kotlin",
};

function resolveHighlightLanguage(language?: string): string {
  if (!language) return "text";
  return LANGUAGE_ALIASES[language] ?? language;
}

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const mountedRef = useRef(true);

  const clearStatusTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearStatusTimer();
    };
  }, [clearStatusTimer]);

  const handleCopy = useCallback(async () => {
    clearStatusTimer();
    const requestId = ++requestRef.current;
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(code);
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setStatus("copied");
      timerRef.current = setTimeout(() => setStatus("idle"), COPY_TIMEOUT_MS);
    } catch {
      if (!mountedRef.current || requestRef.current !== requestId) return;
      setStatus("error");
      timerRef.current = setTimeout(() => setStatus("idle"), ERROR_TIMEOUT_MS);
    }
  }, [code, clearStatusTimer]);

  const isCopied = status === "copied";
  const isError = status === "error";
  const visibleLabel = isCopied ? "已复制" : isError ? "复制失败" : "复制代码";

  return (
    <div className="code-block">
      <div className="code-block__header">
        {language ? <span className="code-block__lang">{language}</span> : null}
        <button
          type="button"
          className="code-block__copy"
          aria-label="复制代码"
          title="复制代码"
          onClick={handleCopy}
        >
          <span className="code-block__copy-icon" aria-hidden="true">
            {isCopied ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="19 7.5 9.5 16.5 5 12" />
              </svg>
            ) : isError ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="12.5" />
                <line x1="12" y1="15.5" x2="12.01" y2="15.5" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="12" height="12" rx="2.5" />
                <path d="M5 15H4.5A2.5 2.5 0 0 1 2 12.5v-8A2.5 2.5 0 0 1 4.5 2h8A2.5 2.5 0 0 1 15 4.5V5" />
                <path d="M12.5 13.5h3.5" opacity="0.5" />
              </svg>
            )}
          </span>
          <span className="code-block__copy-label" aria-hidden="true">
            {visibleLabel}
          </span>
        </button>
      </div>
      <div className="code-block__body">
        <SyntaxHighlighter
          language={resolveHighlightLanguage(language)}
          style={oneLight}
          PreTag="pre"
          customStyle={{
            margin: 0,
            padding: "14px 19px",
            borderRadius: "6px",
            background: "transparent",
            fontSize: "inherit",
            lineHeight: "inherit",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
      <span className="code-block__status" role="status" aria-live="polite" aria-atomic="true">
        {isCopied ? "已复制" : isError ? "复制失败" : ""}
      </span>
    </div>
  );
}
