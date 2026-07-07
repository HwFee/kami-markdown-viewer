import { render, screen } from "@testing-library/react";
import { MarkdownDocument } from "./MarkdownDocument";
import { describe, expect, it } from "vitest";

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
});
