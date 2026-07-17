import { describe, expect, it } from "vitest";
import { buildOutlineTree, extractOutline, slugify } from "./outline";

describe("extractOutline", () => {
  it("extracts h1, h2, h3 in order", () => {
    const markdown = `# Title\n## Section A\n### Subsection\n`;
    expect(extractOutline(markdown)).toEqual([
      { id: "title", level: 1, text: "Title" },
      { id: "section-a", level: 2, text: "Section A" },
      { id: "subsection", level: 3, text: "Subsection" },
    ]);
  });

  it("ignores h4, h5, h6", () => {
    const markdown = `#### H4\n##### H5\n###### H6\n`;
    expect(extractOutline(markdown)).toEqual([]);
  });

  it("deduplicates ids", () => {
    const markdown = `# Title\n## Title\n### Title\n`;
    const outline = extractOutline(markdown);
    expect(outline.map((h) => h.id)).toEqual(["title", "title-1", "title-2"]);
  });

  it("handles Chinese headings", () => {
    const markdown = `# 第一章\n## 第一节\n`;
    expect(extractOutline(markdown)).toEqual([
      { id: "第一章", level: 1, text: "第一章" },
      { id: "第一节", level: 2, text: "第一节" },
    ]);
  });

  it("handles empty heading text", () => {
    const markdown = `## \n`;
    expect(extractOutline(markdown)).toEqual([{ id: "heading", level: 2, text: "" }]);
  });

  it("returns empty array when no headings exist", () => {
    expect(extractOutline("Just some text.")).toEqual([]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const markdown = [
      "# Title",
      "",
      "```ts",
      "## Should ignore",
      "### Also ignore",
      "```",
      "",
      "## Section",
    ].join("\n");
    expect(extractOutline(markdown)).toEqual([
      { id: "title", level: 1, text: "Title" },
      { id: "section", level: 2, text: "Section" },
    ]);
  });

  it("ignores headings inside four-space-indented code blocks", () => {
    const markdown = [
      "    # Should ignore",
      "    ## Also ignore",
      "",
      "# Real",
    ].join("\n");
    expect(extractOutline(markdown)).toEqual([{ id: "real", level: 1, text: "Real" }]);
  });

  it("ignores headings inside fenced code blocks with info strings", () => {
    const markdown = [
      "```python { lineNumbers: true }",
      "# Should ignore",
      "```",
      "",
      "# Real",
    ].join("\n");
    expect(extractOutline(markdown)).toEqual([{ id: "real", level: 1, text: "Real" }]);
  });

  it("strips inline formatting to match rendered heading text", () => {
    const markdown = "# **Same**\n## A _B_ **C**\n### `Code`\n";
    expect(extractOutline(markdown)).toEqual([
      { id: "same", level: 1, text: "Same" },
      { id: "a-b-c", level: 2, text: "A B C" },
      { id: "code", level: 3, text: "Code" },
    ]);
  });

  it("deduplicates formatted duplicate headings", () => {
    const markdown = "# **Same**\n# **Same**\n";
    const outline = extractOutline(markdown);
    expect(outline.map((h) => h.id)).toEqual(["same", "same-1"]);
    expect(outline.map((h) => h.text)).toEqual(["Same", "Same"]);
  });

  it("ignores Setext-style headings", () => {
    const markdown = "Heading\n=======\n\nAnother\n-------\n";
    expect(extractOutline(markdown)).toEqual([]);
  });

  it("strips closing ATX hashes", () => {
    expect(extractOutline("# Title ###")).toEqual([
      { id: "title", level: 1, text: "Title" },
    ]);
  });

  it("decodes HTML entities in heading text", () => {
    expect(extractOutline("# A \u0026amp; B")).toEqual([
      { id: "a-b", level: 1, text: "A \u0026 B" },
    ]);
  });

  it("decodes named entities outside the current subset", () => {
    expect(extractOutline("# A \u0026eacute; B")).toEqual([
      { id: "a-é-b", level: 1, text: "A é B" },
    ]);
  });

  it("does not throw on invalid numeric entities", () => {
    expect(extractOutline("# A \u0026#xFFFFFFFFFF; B")).toEqual([
      { id: "a-xffffffffff-b", level: 1, text: "A \u0026#xFFFFFFFFFF; B" },
    ]);
  });

  it("does not throw on out-of-range numeric entities", () => {
    expect(extractOutline("# A \u0026#9999999; B")).toEqual([
      { id: "a-b", level: 1, text: "A \uFFFD B" },
    ]);
  });

  it("strips strikethrough formatting to match rendered text", () => {
    expect(extractOutline("# ~~Removed~~")).toEqual([
      { id: "removed", level: 1, text: "Removed" },
    ]);
  });

  it("extracts alt text from image headings", () => {
    expect(extractOutline("# ![Diagram](image.png)")).toEqual([
      { id: "diagram", level: 1, text: "Diagram" },
    ]);
  });

  it("unescapes markdown escape sequences", () => {
    expect(extractOutline("# A\\-B")).toEqual([
      { id: "a-b", level: 1, text: "A-B" },
    ]);
  });

  it("deduplicates headings with the same visible semantics", () => {
    const outline = extractOutline("# **Same**\n# Same\n# Same ###");
    expect(outline.map((h) => h.id)).toEqual(["same", "same-1", "same-2"]);
    expect(outline.map((h) => h.text)).toEqual(["Same", "Same", "Same"]);
  });
});

describe("slugify", () => {
  it("converts spaces to hyphens and lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("keeps Chinese characters", () => {
    expect(slugify("第一章")).toBe("第一章");
  });
});

describe("buildOutlineTree", () => {
  it("nests lower levels under the nearest higher-level heading", () => {
    const tree = buildOutlineTree([
      { id: "a", level: 1, text: "A" },
      { id: "b", level: 2, text: "B" },
      { id: "c", level: 3, text: "C" },
      { id: "d", level: 2, text: "D" },
      { id: "e", level: 1, text: "E" },
    ]);
    expect(tree).toEqual([
      {
        id: "a", level: 1, text: "A",
        children: [
          { id: "b", level: 2, text: "B", children: [{ id: "c", level: 3, text: "C", children: [] }] },
          { id: "d", level: 2, text: "D", children: [] },
        ],
      },
      { id: "e", level: 1, text: "E", children: [] },
    ]);
  });

  it("keeps a first h2/h3 as a root when no h1 precedes it", () => {
    const tree = buildOutlineTree([
      { id: "b", level: 2, text: "B" },
      { id: "c", level: 3, text: "C" },
    ]);
    expect(tree).toEqual([
      { id: "b", level: 2, text: "B", children: [{ id: "c", level: 3, text: "C", children: [] }] },
    ]);
  });

  it("returns an empty array for no headings", () => {
    expect(buildOutlineTree([])).toEqual([]);
  });
});
