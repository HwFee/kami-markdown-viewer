import { act, fireEvent, render, screen } from "@testing-library/react";
import { MarkdownDocument } from "./MarkdownDocument";
import { extractOutline } from "../lib/outline";
import { describe, expect, it, vi } from "vitest";

describe("MarkdownDocument", () => {
  it("renders headings, lists, tables, quotes, and code", () => {
    const markdown = [
      "# Title",
      "",
      "> Quote",
      "",
      "- item",
      "",
      "| A | B |",
      "| - | - |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const value = 1;",
      "```",
    ].join("\n");

    render(<MarkdownDocument markdown={markdown} documentPath="C:/notes/readme.md" />);

    expect(screen.getByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByText("Quote")).toBeInTheDocument();
    expect(screen.getByText("item")).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    const codeBlock = screen.getByRole("code");
    expect(codeBlock).toHaveTextContent("const value = 1;");
  });

  it("does not render script tags from Markdown", () => {
    const markdown = ["Safe", "", '<script>alert("x")</script>'].join("\n");
    render(<MarkdownDocument markdown={markdown} documentPath="C:/notes/readme.md" />);

    expect(screen.queryByText('alert("x")')).not.toBeInTheDocument();
    expect(screen.getByText("Safe")).toBeInTheDocument();
  });

  it("preserves safe raw HTML such as divs and tables", () => {
    const markdown = [
      '<div align="center">Centered</div>',
      "",
      "<table><tr><td>cell</td></tr></table>",
    ].join("\n");

    render(<MarkdownDocument markdown={markdown} documentPath="C:/notes/readme.md" />);

    expect(screen.getByText("Centered")).toBeInTheDocument();
    expect(screen.getByText("cell")).toBeInTheDocument();
  });

  it("renders heading ids from the outline", () => {
    render(
      <MarkdownDocument
        markdown={["# Title", "", "## Section"].join("\n")}
        documentPath="/docs/sample.md"
        headings={[
          { id: "title", level: 1, text: "Title" },
          { id: "section", level: 2, text: "Section" },
        ]}
      />
    );

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("id", "title");
    expect(screen.getByRole("heading", { name: "Section" })).toHaveAttribute("id", "section");
  });

  it("handles duplicate heading text with unique ids from the outline", () => {
    render(
      <MarkdownDocument
        markdown={["# Title", "", "# Title", "", "# Title"].join("\n")}
        documentPath="/docs/sample.md"
        headings={[
          { id: "title", level: 1, text: "Title" },
          { id: "title-1", level: 1, text: "Title" },
          { id: "title-2", level: 1, text: "Title" },
        ]}
      />
    );

    const headings = screen.getAllByRole("heading", { name: "Title" });
    expect(headings).toHaveLength(3);
    expect(headings[0]).toHaveAttribute("id", "title");
    expect(headings[1]).toHaveAttribute("id", "title-1");
    expect(headings[2]).toHaveAttribute("id", "title-2");
  });

  it("resets heading id allocation when document or headings change", () => {
    const { rerender } = render(
      <MarkdownDocument
        markdown="# Title"
        documentPath="/docs/sample.md"
        headings={[{ id: "first-title", level: 1, text: "Title" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("id", "first-title");

    rerender(
      <MarkdownDocument
        markdown="# Title"
        documentPath="/docs/sample.md"
        headings={[{ id: "second-title", level: 1, text: "Title" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("id", "second-title");
  });

  it("keeps stable heading ids stable across re-renders with the same headings", () => {
    const { rerender } = render(
      <MarkdownDocument
        markdown="# Title"
        documentPath="/docs/sample.md"
        headings={[{ id: "keep", level: 1, text: "Title" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("id", "keep");

    rerender(
      <MarkdownDocument
        markdown="# Title"
        documentPath="/docs/sample.md"
        headings={[{ id: "keep", level: 1, text: "Title" }]}
      />
    );

    expect(screen.getByRole("heading", { name: "Title" })).toHaveAttribute("id", "keep");
  });

  it("generates unique fallback ids when no headings prop is provided", () => {
    render(<MarkdownDocument markdown={["# Same", "", "# Same"].join("\n")} documentPath="/docs/sample.md" />);

    const headings = screen.getAllByRole("heading", { name: "Same" });
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveAttribute("id", "same");
    expect(headings[1]).toHaveAttribute("id", "same-1");
  });

  it("generates unique fallback ids for duplicate rich-text headings", () => {
    render(<MarkdownDocument markdown={["# **Same**", "", "# **Same**"].join("\n")} documentPath="/docs/sample.md" />);

    const headings = screen.getAllByRole("heading", { name: "Same" });
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveAttribute("id", "same");
    expect(headings[1]).toHaveAttribute("id", "same-1");
  });

  it("matches heading ids generated by extractOutline", () => {
    const markdown = ["# A \u0026eacute; B", "", "## **Same**"].join("\n");
    const headings = extractOutline(markdown);
    render(<MarkdownDocument markdown={markdown} documentPath="/docs/sample.md" headings={headings} />);

    expect(screen.getByRole("heading", { name: "A é B" })).toHaveAttribute("id", headings[0].id);
    expect(screen.getByRole("heading", { name: "Same" })).toHaveAttribute("id", headings[1].id);
  });

  it("renders inline code without a copy button", () => {
    render(<MarkdownDocument markdown="Use `inlineCode` here." documentPath="/docs/sample.md" />);
    expect(screen.getByRole("code")).toHaveTextContent("inlineCode");
    expect(screen.queryByRole("button", { name: "复制代码" })).not.toBeInTheDocument();
  });

  it("renders a copyable code block for fenced code with language", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="```ts
const x = 1;
```" documentPath="/docs/sample.md" />);
    expect(screen.getByText("ts")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1;");
    vi.unstubAllGlobals();
  });

  it("renders a copyable code block for fenced code without language", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="```
plain block
```" documentPath="/docs/sample.md" />);
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    expect(screen.queryByText("plain")).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("plain block");
    vi.unstubAllGlobals();
  });

  it("renders copy controls for sanitized raw HTML pre > code", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="<pre><code>raw html</code></pre>" documentPath="/docs/sample.md" />);
    expect(screen.getByRole("button", { name: "复制代码" })).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("raw html");
    vi.unstubAllGlobals();
  });

  it("preserves nested safe raw HTML inside pre > code for display and clipboard", async () => {
    vi.stubGlobal("navigator", { clipboard: { writeText: vi.fn().mockResolvedValueOnce(undefined) } });
    render(<MarkdownDocument markdown="<pre><code>raw <span>html</span></code></pre>" documentPath="/docs/sample.md" />);

    expect(screen.getByRole("code")).toHaveTextContent("raw html");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "复制代码" }));
    });
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("raw html");
    vi.unstubAllGlobals();
  });
});
