import { buildOutlineTree, type OutlineNode } from "../lib/outline";
import type { OutlineHeading } from "../types";

type OutlinePanelProps = {
  headings: OutlineHeading[];
  activeHeadingId?: string;
  onSelectHeading?: (id: string) => void;
};

function OutlineItems({
  nodes,
  activeHeadingId,
  onSelectHeading,
}: {
  nodes: OutlineNode[];
  activeHeadingId?: string;
  onSelectHeading?: (id: string) => void;
}) {
  return (
    <ul className="outline-panel__list">
      {nodes.map((node) => (
        <li key={node.id} className="outline-panel__item">
          <button
            type="button"
            className={`outline-panel__link ${node.id === activeHeadingId ? "outline-panel__link--active" : ""}`}
            title={node.text || undefined}
            onClick={() => onSelectHeading?.(node.id)}
          >
            {node.text || "\u00A0"}
          </button>
          {node.children.length > 0 ? (
            <OutlineItems
              nodes={node.children}
              activeHeadingId={activeHeadingId}
              onSelectHeading={onSelectHeading}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

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
      <OutlineItems
        nodes={buildOutlineTree(headings)}
        activeHeadingId={activeHeadingId}
        onSelectHeading={onSelectHeading}
      />
    </nav>
  );
}
