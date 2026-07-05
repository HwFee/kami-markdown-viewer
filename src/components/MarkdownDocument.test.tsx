import { render, screen } from "@testing-library/react";
import { MarkdownDocument } from "./MarkdownDocument";

test("renders headings, lists, tables, quotes, and code", () => {
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

test("does not render script tags from Markdown", () => {
  const markdown = ["Safe", "", '<script>alert("x")</script>'].join("\n");
  render(<MarkdownDocument markdown={markdown} documentPath="C:/notes/readme.md" />);

  expect(screen.queryByText('alert("x")')).not.toBeInTheDocument();
  expect(screen.getByText("Safe")).toBeInTheDocument();
});

test("preserves safe raw HTML such as divs and tables", () => {
  const markdown = [
    '<div align="center">Centered</div>',
    "",
    "<table><tr><td>cell</td></tr></table>",
  ].join("\n");

  render(<MarkdownDocument markdown={markdown} documentPath="C:/notes/readme.md" />);

  expect(screen.getByText("Centered")).toBeInTheDocument();
  expect(screen.getByText("cell")).toBeInTheDocument();
});
