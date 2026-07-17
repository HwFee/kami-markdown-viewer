import type { Heading, Node, Parent, Root } from "mdast";
import type { OutlineHeading } from "../types";
import { fromMarkdown } from "mdast-util-from-markdown";
import { toString } from "mdast-util-to-string";
import { gfm } from "micromark-extension-gfm";
import { gfmFromMarkdown } from "mdast-util-gfm";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\-]/gu, "")
      .replace(/-+/g, "-") || "heading"
  );
}

function isParent(node: Node): node is Parent {
  return "children" in node && Array.isArray((node as Parent).children);
}

function isAtxHeading(sourceLines: string[], node: Heading): boolean {
  const lineIndex = (node.position?.start?.line ?? 1) - 1;
  const line = sourceLines[lineIndex] ?? "";
  return /^#{1,3}\s/.test(line.trimStart());
}

export function extractOutline(markdown: string): OutlineHeading[] {
  const tree = fromMarkdown(markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  }) as Root;

  const headings: OutlineHeading[] = [];
  const usedIds = new Set<string>();
  const lines = markdown.split(/\r?\n/);

  function walk(node: Node) {
    if (node.type === "heading") {
      const heading = node as Heading;
      if (
        heading.depth >= 1 &&
        heading.depth <= 3 &&
        isAtxHeading(lines, heading)
      ) {
        const text = toString(heading).trim();
        let baseId = slugify(text) || "heading";

        let id = baseId;
        let suffix = 1;
        while (usedIds.has(id)) {
          id = `${baseId}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(id);

        headings.push({ id, level: heading.depth as 1 | 2 | 3, text });
      }
    }

    if (isParent(node)) {
      for (const child of node.children) {
        walk(child);
      }
    }
  }

  walk(tree);
  return headings;
}

export type OutlineNode = OutlineHeading & { children: OutlineNode[] };

export function buildOutlineTree(headings: OutlineHeading[]): OutlineNode[] {
  const roots: OutlineNode[] = [];
  const stack: OutlineNode[] = [];

  for (const heading of headings) {
    const node: OutlineNode = { ...heading, children: [] };
    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }
    if (stack.length === 0) {
      roots.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }
    stack.push(node);
  }

  return roots;
}
