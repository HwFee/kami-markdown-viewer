import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isValidElement, memo, useCallback, useRef, type ReactElement, type ReactNode } from "react";
import { MarkdownImage } from "./MarkdownImage";
import { slugify } from "../lib/outline";
import { CodeBlock } from "./CodeBlock";
import type { OutlineHeading } from "../types";

type MarkdownDocumentProps = {
  markdown: string;
  documentPath: string;
  headings?: OutlineHeading[];
};

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
    "form",
    "label",
    "input",
    "select",
    "option",
    "optgroup",
    "textarea",
    "button",
  ],
  attributes: {
    ...defaultSchema.attributes,
    "*": ["className", "ariaDescribedBy", "ariaLabel", "ariaLabelledBy"],
    a: [...(defaultSchema.attributes?.a ?? []), "target", "rel"],
    img: [...(defaultSchema.attributes?.img ?? []), "alt", "width", "height", "loading"],
    div: ["align"],
    td: ["align", "valign", "width", "height"],
    th: ["align", "valign", "width", "height"],
    table: ["width"],
    br: [],
    input: ["type", "name", "value", "checked", "disabled", "readonly", "placeholder", "required"],
    select: ["name", "disabled", "required", "multiple", "size"],
    option: ["value", "selected", "disabled"],
    optgroup: ["label", "disabled"],
    textarea: ["name", "rows", "cols", "disabled", "readonly", "placeholder", "required"],
    button: ["type", "disabled"],
    form: ["action", "method"],
    label: ["for"],
  },
};

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

export const MarkdownDocument = memo(function MarkdownDocument({ markdown, documentPath, headings }: MarkdownDocumentProps) {
  const resolveHeadingId = useHeadingIdResolver(headings);

  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, kamiSchema]]}
        components={{
          h1: ({ children }) => <h1 id={resolveHeadingId(1, extractText(children))}>{children}</h1>,
          h2: ({ children }) => <h2 id={resolveHeadingId(2, extractText(children))}>{children}</h2>,
          h3: ({ children }) => <h3 id={resolveHeadingId(3, extractText(children))}>{children}</h3>,
          a: ({ href, children }) => {
            const isExternal = href?.startsWith("http://") || href?.startsWith("https://");

            function isImageElement(child: unknown): boolean {
              if (!isValidElement(child)) return false;
              const type = (child as { type?: unknown }).type;
              return type === "img" || type === MarkdownImage;
            }

            const childArray = Array.isArray(children) ? children : [children];
            const isImageLink = childArray.length === 1 && isImageElement(childArray[0]);

            if (isExternal) {
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
          img: ({ src, alt }) => <MarkdownImage src={src} alt={alt} documentPath={documentPath} />,
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
          code: ({ className, children, ...props }) => {
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
