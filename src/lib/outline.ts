import type { OutlineHeading } from "../types";

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\p{L}\p{N}\-]/gu, "") || "heading"
  );
}

export function extractOutline(markdown: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  const usedIds = new Set<string>();

  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const match = /^(#{1,3})\s+(.*)$/.exec(line);
    if (!match) continue;

    const level = match[1].length as 1 | 2 | 3;
    const text = match[2].trim();
    let baseId = slugify(text);
    if (!baseId) baseId = "heading";

    let id = baseId;
    let suffix = 1;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);

    headings.push({ id, level, text });
  }

  return headings;
}
