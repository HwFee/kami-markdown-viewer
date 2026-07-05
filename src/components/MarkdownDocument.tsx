import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isValidElement } from "react";
import { MarkdownImage } from "./MarkdownImage";

type MarkdownDocumentProps = {
  markdown: string;
  documentPath: string;
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

export function MarkdownDocument({ markdown, documentPath }: MarkdownDocumentProps) {
  return (
    <article className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, kamiSchema]]}
        components={{
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
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className ?? "");
            const language = match?.[1] ?? "";
            const code = String(children).replace(/\n$/, "");

            if (language) {
              return (
                <SyntaxHighlighter
                  language={language}
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
              );
            }

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
}
