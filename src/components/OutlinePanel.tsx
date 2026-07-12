import type { OutlineHeading } from "../types";

type OutlinePanelProps = {
  headings: OutlineHeading[];
  activeHeadingId?: string;
  onSelectHeading?: (id: string) => void;
};

export function OutlinePanel({ headings, activeHeadingId, onSelectHeading }: OutlinePanelProps) {
  if (headings.length === 0) {
    return (
      <nav className="outline-panel" aria-label="文档大纲">
        <p className="outline-panel__empty">本文档暂无目录</p>
      </nav>
    );
  }

  return (
    <nav className="outline-panel" aria-label="文档大纲">
      <div className="outline-panel__header">大纲</div>
      <ul className="outline-panel__list">
        {headings.map((heading) => (
          <li
            key={heading.id}
            className="outline-panel__item"
            style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}
          >
            <button
              type="button"
              className={`outline-panel__link ${heading.id === activeHeadingId ? "outline-panel__link--active" : ""}`}
              title={heading.text || undefined}
              onClick={() => onSelectHeading?.(heading.id)}
            >
              {heading.text || "\u00A0"}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
