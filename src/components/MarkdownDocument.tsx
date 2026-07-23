import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isValidElement, memo, useCallback, useLayoutEffect, useRef, type ReactElement, type ReactNode } from "react";
import { MarkdownImage } from "./MarkdownImage";
import { slugify } from "../lib/outline";
import { CodeBlock } from "./CodeBlock";
import type { OutlineHeading } from "../types";

type MarkdownDocumentProps = {
  markdown: string;
  headings?: OutlineHeading[];
  /** 内容渲染进 DOM 后回调（用于在懒加载完成后恢复滚动位置等） */
  onRendered?: () => void;
  searchQuery?: string;
  activeMatchIndex?: number;
  onMatchCountChange?: (count: number) => void;
};

type HastText = { type: "text"; value: string };
type HastElement = {
  type: "element";
  tagName: string;
  properties?: Record<string, unknown>;
  children: HastNode[];
};
type HastNode = HastText | HastElement | { type: string; children?: HastNode[] };

type SearchHighlightOptions = {
  query: string;
  activeMatchIndex?: number;
};

const SEARCH_SKIP_TAGS = new Set(["mark", "script", "style", "pre", "code"]);

function rehypeSearchHighlights({ query, activeMatchIndex }: SearchHighlightOptions) {
  const normalizedQuery = query.trim().toLowerCase();

  return (tree: HastNode) => {
    if (!normalizedQuery) return;

    const marks: HastElement[] = [];

    function highlightChildren(parent: { children: HastNode[] }) {
      const nextChildren: HastNode[] = [];

      for (const child of parent.children) {
        if (child.type === "text") {
          const text = (child as HastText).value;
          const lowerText = text.toLowerCase();
          let lastIndex = 0;
          let matchIndex = lowerText.indexOf(normalizedQuery);

          while (matchIndex !== -1) {
            if (matchIndex > lastIndex) {
              nextChildren.push({ type: "text", value: text.slice(lastIndex, matchIndex) });
            }

            const mark: HastElement = {
              type: "element",
              tagName: "mark",
              properties: { className: ["search-match"] },
              children: [{
                type: "text",
                value: text.slice(matchIndex, matchIndex + normalizedQuery.length),
              }],
            };
            marks.push(mark);
            nextChildren.push(mark);
            lastIndex = matchIndex + normalizedQuery.length;
            matchIndex = lowerText.indexOf(normalizedQuery, lastIndex);
          }

          if (lastIndex === 0) {
            nextChildren.push(child);
          } else if (lastIndex < text.length) {
            nextChildren.push({ type: "text", value: text.slice(lastIndex) });
          }
          continue;
        }

        if (child.type === "element") {
          const element = child as HastElement;
          if (!SEARCH_SKIP_TAGS.has(element.tagName)) {
            highlightChildren(element);
          }
        } else if ("children" in child && child.children) {
          highlightChildren(child as { children: HastNode[] });
        }
        nextChildren.push(child);
      }

      parent.children = nextChildren;
    }

    if ("children" in tree && tree.children) {
      highlightChildren(tree as { children: HastNode[] });
    }

    if (marks.length > 0 && activeMatchIndex !== undefined) {
      const currentIndex = Math.max(0, Math.min(activeMatchIndex, marks.length - 1));
      marks[currentIndex].properties = {
        className: ["search-match", "search-match--current"],
      };
    }
  };
}

const kamiSchema: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "div",
    "span",
    "b",
    "i",
    "em",
    "strong",
    "s",
    "sub",
    "sup",
    "small",
    "big",
    "br",
    "details",
    "summary",
    "table",
    "thead",
    "tbody",
    "tfoot",
    "tr",
    "td",
    "th",
    // input 仅用于 GFM task list 的复选框；其余表单元素（form/button/select/textarea/label 等）一律不允许
    "input",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": ["className", "ariaDescribedBy", "ariaLabel", "ariaLabelledBy"],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "title", "width", "height", "loading"],
    div: ["align"],
    td: ["align", "valign", "width", "height"],
    th: ["align", "valign", "width", "height"],
    table: ["width"],
    br: [],
    input: ["type", "name", "value", "checked", "disabled", "readonly", "placeholder", "required"],
  },
  protocols: {
    ...defaultSchema.protocols,
    href: [...(defaultSchema.protocols?.href ?? []), "ftp"],
  },
};

// react-markdown 的 defaultUrlTransform 会把 ftp 等未列出的协议置为空字符串；
// 这里放行 ftp，使其 href 保留，点击时与 http(s) 一样交给系统 opener 处理
function urlTransform(url: string) {
  return url.startsWith("ftp:") ? url : defaultUrlTransform(url);
}

function useHeadingIdResolver(headings?: OutlineHeading[]) {
  const usedIds = useRef(new Set<string>());
  const fallbackCounter = useRef(0);

  // Reset allocation on every render so document/headings changes do not carry over stale ids.
  usedIds.current = new Set<string>();
  fallbackCounter.current = 0;

  return useCallback(
    (level: 1 | 2 | 3, text: string) => {
      const candidates = headings?.filter((h) => h.level === level && h.text === text) ?? [];
      for (const candidate of candidates) {
        if (!usedIds.current.has(candidate.id)) {
          usedIds.current.add(candidate.id);
          return candidate.id;
        }
      }

      let baseId = slugify(text) || "heading";
      if (!usedIds.current.has(baseId)) {
        usedIds.current.add(baseId);
        return baseId;
      }

      let suffix = fallbackCounter.current + 1;
      let id = `${baseId}-${suffix}`;
      while (usedIds.current.has(id)) {
        suffix += 1;
        id = `${baseId}-${suffix}`;
      }
      usedIds.current.add(id);
      fallbackCounter.current = suffix;
      return id;
    },
    [headings]
  );
}

function extractText(node: unknown): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { alt?: string; children?: unknown } }).props;
    if (props && "alt" in props) {
      return props.alt ?? "";
    }
    return extractText(props?.children);
  }
  return "";
}

export const MarkdownDocument = memo(function MarkdownDocument({ markdown, headings, onRendered, searchQuery, activeMatchIndex, onMatchCountChange }: MarkdownDocumentProps) {
  const resolveHeadingId = useHeadingIdResolver(headings);
  const articleRef = useRef<HTMLElement>(null);

  // 内容提交到 DOM 后通知父级（useLayoutEffect 在绘制前同步执行，此时 scrollHeight 已可用于测量）
  useLayoutEffect(() => {
    onRendered?.();
  });

  // 搜索标记由 rehype 插件声明式生成；此 effect 只读取结果并通知父级/滚动当前项。
  useLayoutEffect(() => {
    const marks = articleRef.current?.querySelectorAll<HTMLElement>("mark.search-match") ?? [];
    onMatchCountChange?.(marks.length);
    articleRef.current
      ?.querySelector<HTMLElement>("mark.search-match--current")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchQuery, activeMatchIndex, markdown, onMatchCountChange]);

  return (
    <article className="markdown-body" ref={articleRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeRaw,
          [rehypeSanitize, kamiSchema],
          [rehypeSearchHighlights, { query: searchQuery ?? "", activeMatchIndex }],
        ]}
        urlTransform={urlTransform}
        components={{
          h1: ({ children }) => <h1 id={resolveHeadingId(1, extractText(children))}>{children}</h1>,
          h2: ({ children }) => <h2 id={resolveHeadingId(2, extractText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={resolveHeadingId(3, extractText(children))}>{children}</h3>,
          a: ({ href, children }) => {
            // 带协议（http(s)、mailto、ftp 等）的链接交给系统默认程序打开；
            // 页内锚点（#...）与相对路径保持原生行为
            const hasProtocol = href ? /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(href) : false;

            function isImageElement(child: unknown): boolean {
              if (!isValidElement(child)) return false;
              const type = (child as { type?: unknown }).type;
              return type === "img" || type === MarkdownImage;
            }

            const childArray = Array.isArray(children) ? children : [children];
            const isImageLink = childArray.length === 1 && isImageElement(childArray[0]);

            if (hasProtocol) {
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-image-link={isImageLink ? "true" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    void openUrl(href ?? "");
                  }}
                >
                  {children}
                </a>
              );
            }
            return <a href={href}>{children}</a>;
          },
          img: ({ src, alt, title }) => <MarkdownImage src={src} alt={alt} title={title} />,
          pre: ({ children }) => {
            const childArray = Array.isArray(children) ? children : [children];
            const nonWhitespaceChildren = childArray.filter((child) => {
              if (typeof child === "string" || typeof child === "number") {
                return String(child).trim() !== "";
              }
              return true;
            });
            if (nonWhitespaceChildren.length === 1) {
              const child = nonWhitespaceChildren[0];
              if (
                isValidElement(child) &&
                (typeof child.type === "string"
                  ? child.type === "code"
                  : (child.props as { node?: { tagName?: string } }).node?.tagName === "code")
              ) {
                const codeChild = child as ReactElement<{
                  className?: string;
                  children?: ReactNode;
                  node?: { tagName?: string };
                }>;
                const className = codeChild.props.className ?? "";
                const match = /language-(\w+)/.exec(className);
                const language = match?.[1] ?? "";
                const code = extractText(codeChild.props.children).replace(/\n$/, "");
                return <CodeBlock code={code} language={language} />;
              }
            }
            return <pre>{children}</pre>;
          },
          code: ({ node: _node, className, children, ...props }) => {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
});

// default 导出供 App.tsx 的 React.lazy 代码分割使用（命名导出保留给测试等直接引用）
export default MarkdownDocument;
