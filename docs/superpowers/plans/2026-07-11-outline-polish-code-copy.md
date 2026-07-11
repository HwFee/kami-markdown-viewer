# Outline Polish and Code-Block Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the outline into a restrained floating utility panel and add a quiet copy control to every block code element, without changing the document’s existing behavior or remounting the Markdown/image subtree.

**Architecture:** A new focused `CodeBlock` component owns the copy button, language label, and Prism syntax highlighting. `MarkdownDocument` detects block code by overriding `components.pre` and inspecting the rendered `<code>` child, so both fenced language and no-language blocks are copyable while inline `<code>` remains unchanged. The outline becomes a fixed-position floating panel using `kami.css` variables; the layout shift is driven by a single CSS class on `app-shell__body`.

**Tech Stack:** React 19.2.7, TypeScript 6.0.3, react-markdown 10.1.0, react-syntax-highlighter 16.1.1, Prism / oneLight, Vitest 4.1.9, jsdom 29.1.1, Tauri 2.11.4.

## Global Constraints

- React 19.2.7, react-markdown 10.1.0, react-syntax-highlighter 16.1.1.
- No new dependencies.
- Preserve existing Prism `oneLight` output and trailing-newline handling (`replace(/\n$/, "")`).
- Do not re-key or conditionally remove `MarkdownDocument` / `MarkdownImage` when toggling the outline.
- Block code only; inline `<code>` stays unchanged.
- `navigator.clipboard.writeText` is the copy mechanism.
- Status feedback copy is Chinese: “已复制” / “复制失败”.
- Reduced motion must disable transitions for the outline panel, document shift, code-copy hover fade, and outline-scrim animation.
- Touch / no-hover devices keep the copy button visible.
- Commit after every independently-testable task, staging only the intended files.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/components/CodeBlock.tsx` | New wrapper: semantic `<pre className="code-block">`, Prism syntax highlighter with `PreTag="div"`, language label, copy button, status state, timer cleanup, aria-live region. |
| `src/components/CodeBlock.test.tsx` | Unit tests for semantic structure, Prism class, copy success/failure, timer cleanup, language label, accessibility. |
| `src/components/MarkdownDocument.tsx` | Detect block code via `components.pre`; route block code to `CodeBlock` and inline code to `<code>`. Copy controls apply to any rendered `<pre><code>` block, including sanitized raw HTML. |
| `src/components/MarkdownDocument.test.tsx` | Baseline inline-code test (already passes); failing tests for fenced language and fenced no-language block copy. |
| `src/components/OutlinePanel.tsx` | Update indentation multiplier from 16px to 12px per level (h1→h3: 0, 12, 24). |
| `src/components/OutlinePanel.test.tsx` | Add indentation contract test. |
| `src/App.tsx` | No public prop changes; existing CSS-class toggle stays. Regression tests only. |
| `src/App.test.tsx` | No new tests needed; existing image DOM-identity test already covers document stability. |
| `src/styles/kami.css` | Floating outline panel styles, document shift/gutter, reduced motion; scoped code-block copy styles with explicit resets against `.markdown-body` rules. |
| `src/styles/kami.css.test.ts` | Code-copy CSS contract tests (Task 1) and outline CSS contract tests (Task 3). |

---

### Task 1: CodeBlock component

**Files:**
- Create: `src/components/CodeBlock.tsx`
- Create: `src/components/CodeBlock.test.tsx`
- Modify: `src/styles/kami.css` (append code-copy slice)
- Modify: `src/styles/kami.css.test.ts` (append code-copy CSS contract tests)

**Interfaces:**
- Consumes: `code: string`, `language?: string`
- Produces: `CodeBlock` component exported from `src/components/CodeBlock.tsx`
- Rendered structure: `<pre className="code-block">` containing a header row, a `.code-block__body` div, and a visually hidden `aria-live` status. `SyntaxHighlighter` renders with `PreTag="div"` inside the body, so no nested `<pre>` is produced.

- [ ] **Step 1: Write the failing component tests**

```tsx
// src/components/CodeBlock.test.tsx
import { act, render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { CodeBlock } from "./CodeBlock";

describe("CodeBlock", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("renders a semantic pre root with no nested pre", () => {
    const { container } = render(<CodeBlock code="const x = 1;" />);
    const pres = container.querySelectorAll("pre");
    expect(pres).toHaveLength(1);
    expect(pres[0]).toHaveClass("code-block");
    expect(pres[0]).toHaveTextContent("const x = 1;");
  });

  it("renders the code with a copy button and optional language label", () => {
    render(<CodeBlock code="const x = 1;" language="ts" />);
    expect(screen.getByRole("code")).toHaveTextContent("const x = 1;");
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(screen.getByText("ts")).toBeInTheDocument();
  });

  it("renders without a language label when language is empty", () => {
    render(<CodeBlock code="plain text" />);
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(screen.queryByText("plain")).not.toBeInTheDocument();
  });

  it("preserves the Prism class on the syntax-highlighter output", () => {
    const { container } = render(<CodeBlock code="const x = 1;" language="ts" />);
    const highlighter = container.querySelector(".code-block__body > div");
    expect(highlighter).toHaveClass("prism-code");
  });

  it("copies the exact raw code string on click", async () => {
    const writeText = vi.fn().mockResolvedValueOnce(undefined);
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    render(<CodeBlock code="  indented\n  code" language="ts" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(writeText).toHaveBeenCalledWith("  indented\n  code");
  });

  it("shows copied feedback for 1.5s then returns to idle", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<CodeBlock code="x" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("已复制");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("shows error feedback when clipboard fails", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockRejectedValueOnce(new Error("denied")) } });
    render(<CodeBlock code="x" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("复制失败");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("clears the running timer when unmounted", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    const { unmount } = render(<CodeBlock code="x" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(screen.getByRole("status")).toHaveTextContent("已复制");
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

Run: `npm test -- --run src/components/CodeBlock.test.tsx`
Expected: FAIL with `Cannot find module './CodeBlock'` or `CodeBlock is not defined`.

- [ ] **Step 2: Implement the CodeBlock component**

```tsx
// src/components/CodeBlock.tsx
import { useCallback, useEffect, useRef, useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeBlockProps = {
  code: string;
  language?: string;
};

type CopyStatus = "idle" | "copied" | "error";

const COPY_TIMEOUT_MS = 1500;
const ERROR_TIMEOUT_MS = 1500;

export function CodeBlock({ code, language }: CodeBlockProps) {
  const [status, setStatus] = useState<CopyStatus>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearStatusTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return clearStatusTimer;
  }, [clearStatusTimer]);

  const handleCopy = useCallback(async () => {
    clearStatusTimer();
    try {
      if (!navigator.clipboard) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(code);
      setStatus("copied");
      timerRef.current = setTimeout(() => setStatus("idle"), COPY_TIMEOUT_MS);
    } catch {
      setStatus("error");
      timerRef.current = setTimeout(() => setStatus("idle"), ERROR_TIMEOUT_MS);
    }
  }, [code, clearStatusTimer]);

  const isCopied = status === "copied";
  const isError = status === "error";
  const visibleLabel = isCopied ? "已复制" : isError ? "复制失败" : "复制代码";

  return (
    <pre className="code-block">
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
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : isError ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
          language={language || "text"}
          style={oneLight}
          PreTag="div"
          customStyle={{
            margin: 0,
            borderRadius: "6px",
            background: "transparent",
            fontSize: "inherit",
            lineHeight: "inherit",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
      <span className="code-block__status" aria-live="polite" aria-atomic="true">
        {isCopied ? "已复制" : isError ? "复制失败" : ""}
      </span>
    </pre>
  );
}
```

- [ ] **Step 3: Run the component tests**

Run: `npm test -- --run src/components/CodeBlock.test.tsx`
Expected: PASS for all CodeBlock tests.

- [ ] **Step 4: Write the failing CSS contract tests for code copy**

Append to `src/styles/kami.css.test.ts`:

```tsx
describe("kami.css code-block specificity and resets", () => {
  it("scopes code-block rules to pre.code-block to override markdown-body defaults", () => {
    expect(css).toMatch(/pre\.code-block\s*\{/s);
    expect(css).toMatch(/pre\.code-block\s+code\s*\{/s);
    expect(css).toMatch(/pre\.code-block\s+\.code-block__copy\s*\{/s);
    expect(css).toMatch(/pre\.code-block\s+\.code-block__body\s*\u003e\s*div\s*\{/s);
  });

  it("pushes the copy button to the top-right when no language label is present", () => {
    const rule = css.match(/pre\.code-block\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*auto/);
  });
});

describe("kami.css code copy visibility", () => {
  it("hides the copy button by default and reveals it on hover or focus-within", () => {
    const rule = css.match(/pre\.code-block\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/opacity:\s*0/);
    const hoverRule = css.match(/pre\.code-block:hover\s+\.code-block__copy,\s*pre\.code-block:focus-within\s+\.code-block__copy\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(hoverRule).toMatch(/opacity:\s*1/);
  });

  it("keeps the copy button visible on touch/no-hover devices", () => {
    const rule = css.match(/@media\s*\(hover:\s*none\)\s*\{[^}]*pre\.code-block\s+\.code-block__copy\s*\{[^}]*opacity:\s*1/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });
});

describe("kami.css code copy reduced motion", () => {
  it("disables code copy transitions under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*pre\.code-block\s+\.code-block__copy[^}]*transition:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });
});
```

Run: `npm test -- --run src/styles/kami.css.test.ts`
Expected: The new code-copy CSS contract tests FAIL; existing scroll-ownership tests PASS.

- [ ] **Step 5: Append the code-block CSS with scoped resets**

Append to `src/styles/kami.css`:

```css
pre.code-block {
  display: flex;
  flex-direction: column;
  margin: 14px 0;
  padding: 0;
  border-radius: 6px;
  background: var(--ivory);
  overflow: hidden;
  color: var(--near-black);
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
}

pre.code-block > code,
pre.code-block code {
  padding: 0;
  border-radius: 0;
  background: transparent !important;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

pre.code-block .code-block__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
}

pre.code-block .code-block__lang {
  color: var(--stone);
  font-family: var(--mono);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

pre.code-block .code-block__copy {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 28px;
  height: 28px;
  padding: 0 7px;
  margin: 0;
  margin-left: auto;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--stone);
  cursor: pointer;
  font-family: var(--serif);
  font-size: 12px;
  font-weight: 400;
  box-shadow: none;
  transition: background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease;
  opacity: 0;
}

pre.code-block .code-block__copy:hover {
  background-color: rgba(27, 54, 93, 0.08);
  color: var(--brand);
}

pre.code-block .code-block__copy:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
  opacity: 1;
}

pre.code-block:hover .code-block__copy,
pre.code-block:focus-within .code-block__copy {
  opacity: 1;
}

@media (hover: none) {
  pre.code-block .code-block__copy {
    opacity: 1;
  }
}

pre.code-block .code-block__copy-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
}

pre.code-block .code-block__copy-icon svg {
  width: 100%;
  height: 100%;
}

pre.code-block .code-block__copy-label {
  font-family: var(--serif);
  font-size: 12px;
}

pre.code-block .code-block__body {
  min-width: 0;
  overflow-x: auto;
}

pre.code-block .code-block__body > div {
  padding: 14px 19px !important;
  background: transparent !important;
}

pre.code-block .code-block__status {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

@media (prefers-reduced-motion: reduce) {
  pre.code-block .code-block__copy {
    transition: none;
  }
}
```

- [ ] **Step 6: Run all Task 1 tests**

Run: `npm test -- --run src/components/CodeBlock.test.tsx src/styles/kami.css.test.ts`
Expected: PASS for all tests.

- [ ] **Step 7: Commit**

```bash
git add src/components/CodeBlock.tsx src/components/CodeBlock.test.tsx src/styles/kami.css src/styles/kami.css.test.ts
git commit -m "feat: add copyable CodeBlock component and scoped CSS"
```

---

### Task 2: Integrate CodeBlock into MarkdownDocument

**Files:**
- Modify: `src/components/MarkdownDocument.tsx` (components `pre` and `code`)
- Modify: `src/components/MarkdownDocument.test.tsx` (baseline + new failing tests)

**Interfaces:**
- Consumes: `CodeBlock` from `src/components/CodeBlock.tsx`
- Produces: Any rendered `<pre><code>` block (fenced language, fenced no-language, or sanitized raw HTML) renders `CodeBlock`; inline `<code>` renders unchanged.

- [ ] **Step 1: Write the baseline inline-code regression test**

Add this test inside the existing `describe("MarkdownDocument")` in `src/components/MarkdownDocument.test.tsx`:

```tsx
  it("renders inline code without a copy button", () => {
    render(<MarkdownDocument markdown="Use `inlineCode` here." documentPath="/docs/sample.md" />);
    expect(screen.getByRole("code")).toHaveTextContent("inlineCode");
    expect(screen.queryByRole("button", { name: "复制代码" })).not.toBeInTheDocument();
  });
```

This test should already pass with the current implementation because the existing `code` component returns inline `<code>` without a copy button.

Run: `npm test -- --run src/components/MarkdownDocument.test.tsx -t "renders inline code without a copy button"`
Expected: PASS.

- [ ] **Step 2: Write the failing block-copy tests**

Append inside the existing `describe("MarkdownDocument")` in `src/components/MarkdownDocument.test.tsx`:

```tsx
  it("renders a copyable code block for fenced code with language", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="```ts\nconst x = 1;\n```" documentPath="/docs/sample.md" />);
    expect(screen.getByText("ts")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1;");
    vi.unstubAllGlobals();
  });

  it("renders a copyable code block for fenced code without language", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="```\nplain block\n```" documentPath="/docs/sample.md" />);
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(screen.queryByText("plain")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("plain block");
    vi.unstubAllGlobals();
  });
```

Add imports at the top of `src/components/MarkdownDocument.test.tsx`:

```tsx
import { act, fireEvent } from "@testing-library/react";
import { vi } from "vitest";
import { type ReactElement, type ReactNode } from "react";
```

Run: `npm test -- --run src/components/MarkdownDocument.test.tsx`
Expected: The two new block-copy tests FAIL; all other tests, including the inline-code baseline, PASS.

- [ ] **Step 3: Replace the existing code component with pre-based block detection**

Replace the `code` component in `src/components/MarkdownDocument.tsx` and add a `pre` component above it. Keep all other components unchanged.

```tsx
          pre: ({ children }) => {
            const childArray = Array.isArray(children) ? children : [children];
            if (childArray.length === 1) {
              const child = childArray[0];
              if (
                isValidElement(child) &&
                typeof child.type === "string" &&
                child.type === "code"
              ) {
                const codeChild = child as ReactElement<{
                  className?: string;
                  children?: ReactNode;
                }>;
                const className = codeChild.props.className ?? "";
                const match = /language-(\w+)/.exec(className);
                const language = match?.[1] ?? "";
                const code = String(codeChild.props.children ?? "").replace(/\n$/, "");
                return <CodeBlock code={code} language={language} />;
              }
            }
            return <pre>{children}</pre>;
          },
          code: ({ className, children, ...props }) => {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
```

Also add the imports at the top of `src/components/MarkdownDocument.tsx`:

```tsx
import { isValidElement, type ReactElement, type ReactNode } from "react";
import { CodeBlock } from "./CodeBlock";
```

- [ ] **Step 4: Run the tests**

Run: `npm test -- --run src/components/MarkdownDocument.test.tsx`
Expected: PASS for all MarkdownDocument tests.

- [ ] **Step 5: Commit**

```bash
git add src/components/MarkdownDocument.tsx src/components/MarkdownDocument.test.tsx
git commit -m "feat: route block code to CodeBlock, leave inline code unchanged"
```

---

### Task 3: Outline floating-panel CSS polish and responsive layout

**Files:**
- Modify: `src/components/OutlinePanel.tsx` (indentation)
- Modify: `src/components/OutlinePanel.test.tsx` (indentation test)
- Modify: `src/styles/kami.css` (outline-only slice)
- Modify: `src/styles/kami.css.test.ts` (outline-only CSS contract tests)

**Interfaces:**
- `OutlinePanel` props remain unchanged: `headings`, `activeHeadingId`, `onSelectHeading`.
- `App` continues to toggle `app-shell__body--outline-open` and `outline-sidebar--open` classes.
- Document/image stability is covered by the existing `keeps rendered images mounted when outline state changes` test in `src/App.test.tsx`; no new App tests are added.

- [ ] **Step 1: Write the failing OutlinePanel indentation test**

Append to `src/components/OutlinePanel.test.tsx`:

```tsx
  it("indents h1, h2, h3 by 0, 12, 24 pixels", () => {
    render(<OutlinePanel headings={sampleHeadings} />);
    const items = screen.getAllByRole("button").map((button) => button.parentElement);
    expect(items[0]).toHaveStyle({ paddingLeft: "0px" });
    expect(items[1]).toHaveStyle({ paddingLeft: "12px" });
    expect(items[2]).toHaveStyle({ paddingLeft: "24px" });
  });
```

Run: `npm test -- --run src/components/OutlinePanel.test.tsx`
Expected: FAIL (current inline style uses 16px steps).

- [ ] **Step 2: Update OutlinePanel indentation**

Change line 27 of `src/components/OutlinePanel.tsx` from:

```tsx
style={{ paddingLeft: `${(heading.level - 1) * 16}px` }}
```

to:

```tsx
style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
```

- [ ] **Step 3: Write the failing outline CSS contract tests**

Append to `src/styles/kami.css.test.ts`:

```tsx
describe("kami.css outline floating panel", () => {
  it("styles the outline as a floating panel with inset, border, radius, and shadow", () => {
    const rule = css.match(/\.outline-sidebar\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/border-radius:\s*6px/);
    expect(rule).toMatch(/border:\s*1px solid var\(--border-soft\)/);
    expect(rule).toMatch(/box-shadow:\s*0 2px 12px rgba\(20,\s*20,\s*19,\s*0\.06\)/);
    expect(rule).toMatch(/top:\s*calc\(46px \+ var\(--outline-inset\)\)/);
    expect(rule).toMatch(/left:\s*var\(--outline-inset\)/);
    expect(rule).toMatch(/bottom:\s*var\(--outline-inset\)/);
  });

  it("defines the outline shift as inset + width + gutter", () => {
    expect(css).toMatch(/--outline-shift:\s*calc\(var\(--outline-inset\) \+ var\(--outline-width\) \+ var\(--outline-gutter\)\)/);
  });

  it("shifts the document by the outline shift on medium/wide", () => {
    const rule = css.match(/@media\s*\(min-width:\s*720px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*var\(--outline-shift\)/);
  });

  it("keeps the document unshifted on narrow", () => {
    const rule = css.match(/@media\s*\(max-width:\s*719px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*0/);
  });
});

describe("kami.css outline reduced motion", () => {
  it("disables outline transitions under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.outline-sidebar[^}]*transition:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });

  it("disables outline-scrim animation under reduced motion", () => {
    const rule = css.match(/@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.outline-scrim[^}]*animation:\s*none/s)?.[0] ?? "";
    expect(rule).toBeTruthy();
  });
});
```

Run: `npm test -- --run src/styles/kami.css.test.ts`
Expected: The new outline CSS tests FAIL; existing code-copy and scroll-ownership tests PASS.

- [ ] **Step 4: Update the CSS for the floating outline panel and responsive layout**

Add the new CSS variables to the existing `:root` block in `src/styles/kami.css` (after `--content-max-width-wide`):

```css
  --outline-inset: 12px;
  --outline-gutter: 20px;
  --outline-shift: calc(var(--outline-inset) + var(--outline-width) + var(--outline-gutter));
```

Replace the existing `.outline-sidebar` rules and the medium/narrow media queries with:

```css
.outline-sidebar {
  position: fixed;
  top: calc(46px + var(--outline-inset));
  left: var(--outline-inset);
  bottom: var(--outline-inset);
  width: var(--outline-width);
  transform: translateX(calc(-1 * (var(--outline-width) + var(--outline-inset))));
  opacity: 0;
  pointer-events: none;
  transition: transform 250ms ease, opacity 250ms ease;
  z-index: 800;
  background: color-mix(in srgb, var(--warm-sand) 96%, var(--parchment));
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  box-shadow: 0 2px 12px rgba(20, 20, 19, 0.06);
  overflow-y: auto;
  overflow-x: hidden;
}

.outline-sidebar--open {
  transform: translateX(0);
  opacity: 1;
  pointer-events: auto;
}

.outline-panel {
  padding: 12px 14px;
}

.outline-panel__header {
  margin-bottom: 10px;
  padding: 0 8px;
  color: var(--stone);
  font-size: 12px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.outline-panel__link {
  display: block;
  width: 100%;
  padding: 6px 8px 6px 10px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--dark-warm);
  font-family: var(--serif);
  font-size: 13px;
  line-height: 1.45;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color 150ms ease, background-color 150ms ease;
}

.outline-panel__link:hover {
  color: var(--brand);
  background-color: rgba(27, 54, 93, 0.06);
}

.outline-panel__link--active {
  color: var(--brand);
  background-color: rgba(27, 54, 93, 0.08);
  border-left: 2px solid var(--brand);
  padding-left: 8px;
}

@media (min-width: 720px) {
  .app-shell__body--outline-open .document-scroll {
    margin-left: var(--outline-shift);
  }
}

@media (min-width: 1280px) {
  .app-shell__body--outline-open .markdown-body,
  .app-shell__body--outline-open .empty-state,
  .app-shell__body--outline-open .error-state {
    max-width: var(--content-max-width-wide);
  }
}

@media (max-width: 719px) {
  .app-shell__body--outline-open .document-scroll {
    margin-left: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .outline-sidebar,
  .document-scroll,
  .outline-scrim {
    transition: none;
    animation: none;
  }
}
```

Remove the old `.outline-sidebar` block, `.outline-sidebar--open`, `.outline-panel`, `.outline-panel__header`, `.outline-panel__link`, `.outline-panel__link--active`, and the old media queries at lines 355–373. Keep the `.outline-panel__list`, `.outline-panel__item`, `.outline-panel__empty`, `.outline-scrim`, and `@keyframes` rules untouched.

- [ ] **Step 5: Run the tests**

Run: `npm test -- --run src/styles/kami.css.test.ts src/components/OutlinePanel.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/OutlinePanel.tsx src/components/OutlinePanel.test.tsx src/styles/kami.css src/styles/kami.css.test.ts
git commit -m "feat: floating outline panel, gutter shift, and responsive layout"
```

---

### Task 4: Full verification and packaged-app / manual QA

**Files:**
- No source changes; verification only.

- [ ] **Step 1: Run the full test suite**

Run: `npm test -- --run`
Expected: PASS with no failures.

- [ ] **Step 2: Run the production Vite build**

Run: `npm run build`
Expected: `vite build` completes and emits files to `dist/`; no TypeScript errors.

- [ ] **Step 3: Build the Tauri app with the known working toolchain**

Run:

```bash
PATH="/c/msys64/ucrt64/bin:/c/Users/17445/.cargo/bin:$PATH" RUSTUP_TOOLCHAIN="stable-x86_64-pc-windows-gnu" npm run tauri build
```

Expected: Tauri build succeeds and produces the installer/executable in `src-tauri/target/release/` (or `src-tauri/target/x86_64-pc-windows-gnu/release/` depending on the target configuration). No linker or Rust errors.

- [ ] **Step 4: Manual QA checklist**

Open the built app or `npm run dev` and verify:

- [ ] Toggle the outline on a medium/wide window: the outline appears as a floating panel with rounded corners, soft border, and subtle shadow; the document shifts right by `272px` (12 + 240 + 20).
- [ ] At ≥1280px the reading column expands to the wide max-width (`960px`).
- [ ] Resize to <720px: the outline becomes an overlay and the scrim appears; the document does not shift.
- [ ] Click the scrim or select a heading on narrow: the outline closes.
- [ ] Outline headings h1, h2, h3 indent 0 / 12px / 24px; the active heading shows the brand left marker and blue background.
- [ ] Hover a code block: the copy button fades in. Tab into the block: the button is visible via focus-within.
- [ ] On a touch device or with `hover: none`, the copy button is always visible.
- [ ] Click the copy button: the icon changes to a check and the label reads “已复制” for 1.5s, then returns to the copy icon.
- [ ] Block a clipboard permission or trigger a failure: the label reads “复制失败” briefly, then returns.
- [ ] Copy a fenced block with no language: it is still copyable and no language label is shown.
- [ ] Inline `code` elements have no copy button.
- [ ] Images in the document remain stable when the outline is toggled (no flicker or reload).
- [ ] Enable `prefers-reduced-motion`: outline transitions, document shifts, and the outline-scrim fade are instant; code-copy hover fade is disabled.

- [ ] **Step 5: Commit (no-op if verification only)**

If no source changes were needed to pass verification, skip the commit. If any test/build fix was required, commit it with a message describing the fix and stage only the changed files.

---

## Self-Review

**1. Spec coverage:**
- Floating outline panel with 10–12px inset, 6px radius, thin border, subtle shadow → Task 3 CSS.
- Correct document shift: `12 + 240 + 20 = 272px` via `--outline-shift` → Task 3 CSS and CSS test.
- Active heading brand marker and h1–h3 indentation → Task 3 component + CSS tests.
- Copy button on block code only, exact raw copy → Tasks 1 and 2.
- Fenced no-language blocks are copyable → Task 2 `pre` detector and Task 1 `language` optional prop.
- Sanitized raw HTML `<pre><code>` blocks receive copy controls → Task 2 `pre` detector.
- Inline `<code>` unchanged → Task 2 baseline test.
- Success/failure Chinese feedback with 1.5s timer → Task 1.
- aria-label, aria-live, focus-within, touch visibility → Task 1.
- Reduced motion for outline panel, document shift, code-copy, and outline-scrim → Tasks 1 and 3 CSS.
- No new dependencies → no new imports in plan.
- Preserve existing Prism output and document/image stability → Tasks 1 and 3.

**2. Placeholder scan:**
- No “TBD”, “TODO”, “implement later”, or open-ended phrases.
- No “add appropriate error handling” without code.
- No “similar to Task X” references.
- Every step contains concrete code, commands, and expected outcomes.

**3. Type/API consistency:**
- `CodeBlock` accepts `code: string` and `language?: string` in both implementation and tests.
- `MarkdownDocument` passes `code` and `language` to `CodeBlock`.
- `MarkdownDocument` `pre` detection casts the rendered `<code>` child to `ReactElement<{ className?: string; children?: ReactNode }>` before accessing props.
- `OutlinePanel` props are unchanged.
- `App` CSS class names are unchanged.

**4. Unlabeled fenced blocks and raw HTML pre blocks are copyable:**
- The `pre` detector runs for every `<pre><code>` pair regardless of `className`.
- If no language class matches, `language` is `""` and `CodeBlock` still renders the copy button without a language label.
- Inline `<code>` is never wrapped in `<pre>` and therefore never routed to `CodeBlock`.

**5. Semantic structure and specificity:**
- `CodeBlock` renders a semantic `<pre className="code-block">` root.
- `SyntaxHighlighter` uses `PreTag="div"`, so there is no nested `<pre>`.
- CSS selectors use `pre.code-block` and `pre.code-block .code-block__copy` to override `.markdown-body pre`, `.markdown-body pre code`, and `.markdown-body button` defaults.
- The copy button uses `margin-left: auto` so it remains top-right even when no language label is present.

**6. Fake-timer tests and clipboard mocks:**
- Clipboard is mocked with `vi.stubGlobal` and restored with `vi.unstubAllGlobals` in `afterEach`.
- Copied/error states are awaited after the promise resolves/rejects.
- Timers are advanced with `await act(async () => { await vi.advanceTimersByTimeAsync(1500); })`.
- Timer cleanup is asserted with `vi.getTimerCount()` before and after unmount.

**Self-review result:** PASS. No gaps, no placeholders, types are consistent, all block code is copyable, semantic structure is preserved, and fake-timer/clipboard tests are reliable.
