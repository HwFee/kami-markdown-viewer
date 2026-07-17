# 侧边栏重设计（方案 A · 无框嵌入栏）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把大纲侧边栏从「悬浮卡片」改为「无框嵌入栏」，并统一顶栏视觉（ghost 图标工具簇 + 标题路径单行）。

**Architecture:** 交互机制（fixed 定位 + transform 滑入、宽屏正文右移、窄屏 scrim/Escape）全部保留，只改几何与外观；大纲从扁平缩进列表改为嵌套 `<ul>` 树以支持层级引导线；当前项标记从左竖线+底衬改为墨点伪元素。设计依据：`docs/superpowers/specs/2026-07-17-sidebar-redesign-design.md`，视觉基准：`sidebar-preview.html`（已提交 a775a4a）。

**Tech Stack:** React 19 + TypeScript + Vitest + Testing Library，纯 CSS 变量（`src/styles/kami.css`）。

## Global Constraints

- 不改 `App.tsx` 的状态与交互逻辑（`useOutlineOpen`、`useOutlineSync`、scrim、Escape 行为原样保留）。
- 不新增任何依赖、不新增设置项。
- 测试命令：`npx vitest run <file>`（单文件）、`npm test`（全量）；构建验证：`npm run build`。
- 提交信息沿用仓库风格（`feat: ...` / `docs: ...`，英文小写短句）。
- 每个 Task 结束单独 commit；不要在一个 Task 里改别的 Task 的文件。

---

### Task 1: `buildOutlineTree` —— 扁平大纲转树

**Files:**
- Modify: `src/lib/outline.ts`（在文件末尾追加）
- Test: `src/lib/outline.test.ts`（在文件末尾追加 describe）

**Interfaces:**
- Consumes: 现有 `OutlineHeading`（`src/types.ts`：`{ id: string; level: 1 | 2 | 3; text: string }`）。
- Produces:
  - `export type OutlineNode = OutlineHeading & { children: OutlineNode[] }`
  - `export function buildOutlineTree(headings: OutlineHeading[]): OutlineNode[]`
  - Task 2 的 OutlinePanel 依赖这两个导出。

- [ ] **Step 1: 写失败测试**

在 `src/lib/outline.test.ts` 末尾追加：

```ts
import { buildOutlineTree } from "./outline";

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
```

注意：文件顶部已有 `import { extractOutline, slugify } from "./outline";`，新 import 语句与它合并或另起一行均可。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/lib/outline.test.ts`
Expected: FAIL，报 `buildOutlineTree is not a function` 或导出不存在。

- [ ] **Step 3: 实现**

在 `src/lib/outline.ts` 末尾追加：

```ts
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/lib/outline.test.ts`
Expected: PASS（含既有用例共 10+ 个）。

- [ ] **Step 5: Commit**

```bash
git add src/lib/outline.ts src/lib/outline.test.ts
git commit -m "feat: build outline tree from flat headings"
```

---

### Task 2: OutlinePanel 嵌套树渲染

**Files:**
- Modify: `src/components/OutlinePanel.tsx`（整体重写，41 行小文件）
- Test: `src/components/OutlinePanel.test.tsx`

**Interfaces:**
- Consumes: Task 1 的 `buildOutlineTree`、`OutlineNode`。
- Produces: DOM 结构契约（Task 3 的 CSS 依赖）：
  - 嵌套层级 = `.outline-panel__list` 内套 `.outline-panel__list`（同一类名，CSS 用 `.outline-panel__list .outline-panel__list` 选择器画引导线）。
  - active 条目类名保持 `outline-panel__link--active` 不变。
  - 不再输出任何 inline `paddingLeft` 样式。

- [ ] **Step 1: 改测试（先失败）**

把 `src/components/OutlinePanel.test.tsx` 中最后一个用例 `it("indents h1, h2, h3 by 0, 12, 24 pixels", ...)`（第 42–48 行）**整体替换**为：

```tsx
  it("nests lower-level headings inside their parent's item", () => {
    render(<OutlinePanel headings={sampleHeadings} />);

    const sectionA = screen.getByRole("button", { name: "Section A" });
    const subsection = screen.getByRole("button", { name: "Subsection" });

    const nestedList = subsection.closest("ul");
    expect(nestedList?.parentElement?.tagName).toBe("LI");
    expect(nestedList?.parentElement).toContainElement(sectionA);
  });

  it("does not indent items with inline padding", () => {
    render(<OutlinePanel headings={sampleHeadings} />);
    for (const button of screen.getAllByRole("button")) {
      expect(button.parentElement).not.toHaveStyle({ paddingLeft: "12px" });
      expect(button.parentElement).not.toHaveStyle({ paddingLeft: "24px" });
    }
  });
```

其余用例（渲染 3 个按钮、active 类、点击回调、空态）保持不变。

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/components/OutlinePanel.test.tsx`
Expected: FAIL —— 嵌套用例中断言不成立（旧实现是扁平列表）。

- [ ] **Step 3: 重写组件**

`src/components/OutlinePanel.tsx` 完整替换为：

```tsx
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
```

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/components/OutlinePanel.test.tsx`
Expected: PASS（6 个用例）。

- [ ] **Step 5: Commit**

```bash
git add src/components/OutlinePanel.tsx src/components/OutlinePanel.test.tsx
git commit -m "feat: render outline as nested tree"
```

---

### Task 3: 侧栏 CSS 去卡片化（kami.css）

**Files:**
- Modify: `src/styles/kami.css`（`:root` 变量、`.outline-sidebar`、`.outline-panel__*` 段落）
- Test: `src/styles/kami.css.test.ts`（重写 "kami.css outline floating panel" describe）

**Interfaces:**
- Consumes: Task 2 的 DOM 契约（嵌套 `.outline-panel__list`、`outline-panel__link--active`）。
- Produces: CSS 契约——`--hairline: #dddacc`；`--outline-shift: calc(var(--outline-width) + var(--outline-gutter))`；`.outline-sidebar` 贴边全高无卡片装饰。

- [ ] **Step 1: 改测试（先失败）**

把 `src/styles/kami.css.test.ts` 中整个 `describe("kami.css outline floating panel", ...)`（第 64–88 行）**替换**为：

```ts
describe("kami.css outline frameless docked panel", () => {
  it("docks the outline flush without card chrome", () => {
    const rule = css.match(/\.outline-sidebar\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/top:\s*46px/);
    expect(rule).toMatch(/left:\s*0/);
    expect(rule).toMatch(/bottom:\s*0/);
    expect(rule).toMatch(/background:\s*var\(--parchment\)/);
    expect(rule).toMatch(/border-right:\s*1px solid var\(--hairline\)/);
    expect(rule).not.toMatch(/border-radius/);
    expect(rule).not.toMatch(/box-shadow/);
  });

  it("declares a shared hairline color", () => {
    expect(css).toMatch(/--hairline:\s*#dddacc/);
  });

  it("defines the outline shift as width + gutter", () => {
    expect(css).toMatch(/--outline-shift:\s*calc\(var\(--outline-width\) \+ var\(--outline-gutter\)\)/);
  });

  it("draws a hairline guide on nested outline lists", () => {
    const rule = css.match(/\.outline-panel__list\s+\.outline-panel__list\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/border-left:\s*1px solid var\(--hairline\)/);
  });

  it("marks the active link with an ink dot and no background fill", () => {
    const active = css.match(/\.outline-panel__link--active\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(active).toMatch(/color:\s*var\(--brand\)/);
    expect(active).not.toMatch(/background/);
    expect(active).not.toMatch(/border-left/);
    const dot = css.match(/\.outline-panel__link--active::before\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(dot).toMatch(/border-radius:\s*50%/);
    expect(dot).toMatch(/background:\s*var\(--brand\)/);
  });

  it("shifts the document by the outline shift on medium/wide", () => {
    const rule = css.match(/@media\s*\(min-width:\s*720px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*var\(--outline-shift\)/);
  });

  it("keeps the document unshifted on narrow", () => {
    const rule = css.match(/@media\s*\(max-width:\s*719px\)\s*\{[^}]*\.app-shell__body--outline-open\s*\.document-scroll\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/margin-left:\s*0/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/styles/kami.css.test.ts`
Expected: FAIL（新 describe 的前 5 个用例）。

- [ ] **Step 3: 改 CSS**

对 `src/styles/kami.css` 做以下三处编辑：

(1) `:root` 变量（第 34–41 行区域）：

- 在 `--border-soft: #e5e3d8;` 之后新增一行：`  --hairline: #dddacc;`
- **删除** `--outline-inset: 12px;` 这一行
- 把 `--outline-shift: calc(var(--outline-inset) + var(--outline-width) + var(--outline-gutter));` 改为 `  --outline-shift: calc(var(--outline-width) + var(--outline-gutter));`

(2) `.outline-sidebar` 规则（第 256–273 行）整体替换为：

```css
.outline-sidebar {
  position: fixed;
  top: 46px;
  left: 0;
  bottom: 0;
  width: var(--outline-width);
  transform: translateX(calc(-1 * var(--outline-width)));
  opacity: 0;
  pointer-events: none;
  transition: transform 250ms ease, opacity 250ms ease;
  z-index: 800;
  background: var(--parchment);
  border-right: 1px solid var(--hairline);
  overflow-y: auto;
  overflow-x: hidden;
}
```

(3) `.outline-panel__*` 段落：

- `.outline-panel`（第 281–283 行）的 padding 改为 `padding: 20px 12px;`
- `.outline-panel__list`（第 294–298 行）保持不变，在其后**新增**：

```css
.outline-panel__list .outline-panel__list {
  margin: 2px 0 2px 6px;
  padding-left: 11px;
  border-left: 1px solid var(--hairline);
}
```

- `.outline-panel__link`（第 305–322 行）整体替换为：

```css
.outline-panel__link {
  display: block;
  width: 100%;
  padding: 5px 10px 5px 14px;
  border: 0;
  border-radius: 3px;
  background: transparent;
  color: var(--dark-warm);
  font-family: var(--serif);
  font-size: 13px;
  line-height: 1.5;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: color 150ms ease;
}
```

- `.outline-panel__link:hover`（第 324–327 行）替换为：

```css
.outline-panel__link:hover {
  color: var(--brand);
}
```

- `.outline-panel__link--active`（第 329–334 行）替换为：

```css
.outline-panel__link--active {
  position: relative;
  color: var(--brand);
  font-weight: 500;
}

.outline-panel__link--active::before {
  content: "";
  position: absolute;
  left: 5px;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--brand);
  transform: translateY(-50%);
}
```

其余规则（`.outline-panel__header`、`.outline-panel__empty`、`.outline-sidebar--open`、`.outline-scrim`、media 查询、reduced-motion）一律不动。

- [ ] **Step 4: 跑测试确认通过**

Run: `npx vitest run src/styles/kami.css.test.ts`
Expected: PASS（全部，含 reduced-motion 用例）。

- [ ] **Step 5: Commit**

```bash
git add src/styles/kami.css src/styles/kami.css.test.ts
git commit -m "feat: restyle outline sidebar as frameless docked panel"
```

---

### Task 4: 顶栏统一（ghost 图标簇 + 标题路径单行）

**Files:**
- Modify: `src/components/TopBar.tsx:59`（打开按钮类名）
- Modify: `src/styles/kami.css`（`.top-bar__meta`、`.top-bar__path`、`.top-bar__actions`、`.top-bar__actions .button`、`.outline-toggle` 段落）
- Test: `src/styles/kami.css.test.ts`（新增 describe）

**Interfaces:**
- Consumes: Task 3 的 `--hairline` 变量。
- Produces: `.outline-toggle, .open-button` 共享同一 ghost 规则（26×26、发丝线内描边）；`.top-bar__path` 可见且与标题同行。`TopBar.test.tsx`、`OutlineToggle.test.tsx` 的断言（role/name）不受影响，无需改动。

- [ ] **Step 1: 写失败测试**

在 `src/styles/kami.css.test.ts` 末尾追加：

```ts
describe("kami.css top bar", () => {
  it("shows the file path inline instead of hiding it", () => {
    const rule = css.match(/\.top-bar__path\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).not.toMatch(/display:\s*none/);
    expect(rule).toMatch(/font-size:\s*11px/);
  });

  it("lays out the meta line as a single baseline-aligned row", () => {
    const rule = css.match(/\.top-bar__meta\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/display:\s*flex/);
    expect(rule).toMatch(/align-items:\s*baseline/);
  });

  it("shares one ghost style between outline toggle and open button", () => {
    const rule = css.match(/\.outline-toggle,\s*\.open-button\s*\{[^}]*\}/s)?.[0] ?? "";
    expect(rule).toMatch(/width:\s*26px/);
    expect(rule).toMatch(/height:\s*26px/);
    expect(rule).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--hairline\)/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `npx vitest run src/styles/kami.css.test.ts`
Expected: FAIL（新 describe 的 3 个用例）。

- [ ] **Step 3: 改组件类名**

`src/components/TopBar.tsx` 第 59 行：

```tsx
<button className="button button-secondary open-button" type="button" aria-label="打开文件" onClick={onOpen}>
```

改为：

```tsx
<button className="open-button" type="button" aria-label="打开文件" onClick={onOpen}>
```

（`button`/`button-secondary` 两个类只被 `.top-bar__actions .button` 规则使用，本任务将删除该规则；EmptyState 的 `.button.button-primary` 不受影响。）

- [ ] **Step 4: 改 CSS**

对 `src/styles/kami.css` 做以下编辑：

(1) `.top-bar__meta`（第 99–104 行）替换为：

```css
.top-bar__meta {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  padding: 6px 0;
  -webkit-app-region: drag;
  app-region: drag;
}
```

(2) `.top-bar__path`（第 120–122 行，现为 `display: none;`）替换为：

```css
.top-bar__path {
  overflow: hidden;
  color: var(--stone);
  font-size: 11px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

(3) `.top-bar__actions`（第 124–131 行）的 `gap: 12px` 改为 `gap: 6px`，其余不动。

(4) **删除** `.top-bar__actions .button`、`.top-bar__actions .button:hover`、`.top-bar__actions .button:active` 三个规则（第 133–157 行）。

(5) `.outline-toggle`、`.outline-toggle:hover`、`.outline-toggle:active`、`.outline-toggle:focus-visible` 四个规则（第 215–246 行）整体替换为：

```css
.outline-toggle,
.open-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--stone);
  box-shadow: inset 0 0 0 1px var(--hairline);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, box-shadow 0.12s ease;
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.outline-toggle:hover,
.open-button:hover {
  background: var(--warm-sand);
  color: var(--brand);
}

.outline-toggle:active,
.open-button:active {
  background: var(--border-soft);
}

.outline-toggle:focus-visible,
.open-button:focus-visible {
  outline: 2px solid var(--brand);
  outline-offset: -2px;
}
```

（原 `.outline-toggle` 的 `margin-right: 8px` 随旧规则删除，间距由 `.top-bar__actions` 的 gap 承担；按下的 translateY 效果按设计稿去除。）

- [ ] **Step 5: 跑测试确认通过**

Run: `npx vitest run src/styles/kami.css.test.ts src/components/TopBar.test.tsx src/components/OutlineToggle.test.tsx`
Expected: PASS（全部）。

- [ ] **Step 6: Commit**

```bash
git add src/components/TopBar.tsx src/styles/kami.css src/styles/kami.css.test.ts
git commit -m "feat: unify top bar icon cluster and show inline file path"
```

---

### Task 5: 全量验证

**Files:** 无新增改动。

- [ ] **Step 1: 全量测试**

Run: `npm test`
Expected: 全部测试文件 PASS（App、CodeBlock、CustomScrollbar、MarkdownDocument、MarkdownImage、OutlinePanel、OutlineToggle、TopBar、ErrorState/EmptyState、kami.css、outline、path）。

- [ ] **Step 2: 类型与构建验证**

Run: `npm run build`
Expected: `tsc` 无错误，`vite build` 成功。

- [ ] **Step 3: 自查 diff**

Run: `git log --oneline -5` 与 `git diff HEAD~4 --stat`
Expected: 4 个本计划 commit，改动仅限计划列出的 7 个文件（`src/lib/outline.ts`、`src/lib/outline.test.ts`、`src/components/OutlinePanel.tsx`、`src/components/OutlinePanel.test.tsx`、`src/styles/kami.css`、`src/styles/kami.css.test.ts`、`src/components/TopBar.tsx`）。
