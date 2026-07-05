export function compactPath(path: string, maxLength = 64): string {
  const normalized = path.replace(/\\/g, "/");
  if (normalized.length <= maxLength) return normalized;

  const parts = normalized.split("/").filter(Boolean);
  const tail: string[] = [];
  let length = 3;

  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const next = parts[index];
    const nextLength = length + next.length + (tail.length > 0 ? 1 : 0);
    if (nextLength > maxLength) break;
    tail.unshift(next);
    length = nextLength;
  }

  return `.../${tail.join("/")}`;
}
