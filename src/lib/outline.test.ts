import { describe, expect, it } from "vitest";
import { extractOutline, slugify } from "./outline";

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
});

describe("slugify", () => {
  it("converts spaces to hyphens and lowercases", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("keeps Chinese characters", () => {
    expect(slugify("第一章")).toBe("第一章");
  });
});
