import { buildOutlineTree, type OutlineNode } from "../lib/outline";
import type { OutlineHeading } from "../types";

type OutlinePanelProps = {
  headings: OutlineHeading[];
  activeHeadingId?: string;
  onSelectHeading?: (id: string) => void;
};

const CN_NUMS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

/// 将阿拉伯序号转为中文数字（大纲一级标题编号用），支持 1–99。
function toChineseNumeral(n: number): string {
  if (n <= 10) return CN_NUMS[n - 1];
  if (n < 20) return "十" + (n % 10 === 0 ? "" : CN_NUMS[(n % 10) - 1]);
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return CN_NUMS[tens - 1] + "十" + (ones === 0 ? "" : CN_NUMS[ones - 1]);
}

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
      {nodes.map((node, index) => {
        const numeral = node.level === 1 ? toChineseNumeral(index + 1) : null;
        return (
          <li key={node.id} className="outline-panel__item">
            <button
              type="button"
              className={`outline-panel__link ${node.id === activeHeadingId ? "outline-panel__link--active" : ""}`}
              aria-label={node.text || undefined}
              title={node.text || undefined}
              onClick={() => onSelectHeading?.(node.id)}
            >
              {numeral !== null && (
                <span className="outline-panel__num">{numeral}、</span>
              )}
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
        );
      })}
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
      <div className="outline-panel__header">目錄</div>
      <OutlineItems
        nodes={buildOutlineTree(headings)}
        activeHeadingId={activeHeadingId}
        onSelectHeading={onSelectHeading}
      />
    </nav>
  );
}
