# Vellum 性能优化 Handoff

> 2026-07-24，基于 `react-performance-optimization` + `bundle-size-optimization` 技能完成。

---

## 变更总览

| 文件 | 改动 |
|------|------|
| `src/components/CodeBlock.tsx` | `PrismAsyncLight` → `PrismLight`，注册 20 种语言 |
| `vite.config.ts` | 新增 `manualChunks` + `rollup-plugin-visualizer` |
| `src/components/MarkdownDocument.tsx` | `rehypePlugins` 加 `useMemo` 缓存 |
| `src/App.tsx` | `revealWindow()` 前双 `requestAnimationFrame` |
| `src/main.tsx` | 字体加载不阻塞渲染 |
| `AGENTS.md` | 项目级 Agent 说明（新建） |

### `src/components/CodeBlock.tsx`

```diff
- import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
+ import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
+ // 显式注册 20 种常用语言：bash/c/cpp/csharp/css/diff/go/java/
+ //   javascript/json/kotlin/markup/markdown/python/ruby/rust/sql/toml/typescript/yaml
+ SyntaxHighlighter.registerLanguage("javascript", javascript);
+ // ... 共 20 个 registerLanguage 调用
```

原因：`PrismAsyncLight` 内部引用所有 270+ 语言文件，Vite 会为每门语言生成独立 chunk。`PrismLight` 只打包显式注册的。

### `vite.config.ts`

```diff
+ import { visualizer } from "rollup-plugin-visualizer";
+ plugins: [react(), visualizer({ filename: "dist/stats.html", ... })],
+ build: {
+   rollupOptions: {
+     output: {
+       manualChunks(id) {
+         if (id.includes("react-syntax-highlighter")) return "syntax-highlighter";
+         if (id.includes("react/") || id.includes("react-dom/")) return "vendor-react";
+       },
+     },
+   },
+ },
```

### `src/components/MarkdownDocument.tsx`

```diff
+ import type { PluggableList } from "unified";
+ const rehypePlugins: PluggableList = useMemo(
+   () => [rehypeRaw, [rehypeSanitize, kamiSchema], [...]],
+   [searchQuery, activeMatchIndex]
+ );
- rehypePlugins={[rehypeRaw, [rehypeSanitize, kamiSchema], [...]]}
+ rehypePlugins={rehypePlugins}
```

### `src/App.tsx`

```diff
  await loadPath(lastPath);
+ // 等待 React 提交 DOM 再显示窗口，避免闪现空状态
+ await new Promise<void>((resolve) => {
+   requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
+ });
  await revealWindow();
```

### `src/main.tsx`

```diff
- void waitForFonts().then(() => {
-   root.render(<App />);
- });
+ root.render(<App />);   // 立即渲染，字体后台加载
+ void waitForFonts();     // font-display: block 防 FOUT
```

---

## 效果

| 指标 | 前 | 后 |
|------|----|----|
| dist 文件数 | 303 | **6** |
| assets 体积 | ~2.5MB | **668KB** |
| 构建时间 | 4.05s | **2.15s** |
| 启动闪现 | 有 | **无** |
| 测试 | 142 pass | 142 pass |

---

## 安装的技能

| 技能 | 位置 |
|------|------|
| `react-performance-optimization` | 仓库 `skills/` → Vellum `.agents/skills/` |
| `bundle-size-optimization` | 仓库 `skills/` → Vellum `.agents/skills/` |

仓库：`C:/Users/17445/Desktop/HwFee-skills/.agents/skills/`，全部 `mklink /J` junction。

---

## 一条死规则

`CodeBlock.tsx` 禁止切回 `PrismAsyncLight`——会重新生成 270+ 语言 chunk。

---

# 第二轮优化（2026-07-24，运行时为主）

> 基于两个技能 + 联网调研（react-markdown 官方 README、React 19 docs、Tauri 2 docs、
> Bundlephobia、web.dev）。前提：所有改动**不改变渲染输出**，142 测试全过。

## 第一轮改动评估

五项改动均落实到位且合理：

- `PrismLight` + 20 语言注册：`dist/stats.html` 确认未注册语言与 highlight.js 均被
  tree-shake 干净，syntax-highlighter chunk 117KB（gzip 38.6KB），无浪费。
- `manualChunks` 分包与懒加载边界正确，`rehypePlugins` memo 方向正确（第二轮进一步推进）。
- 双 rAF + 隐藏窗口是 Tauri 官方 splashscreen 模式的合理替代（v2.tauri.app/learn/splashscreen）。
- 字体后台加载 + `font-display: block` + preload 组合正确。

## 第二轮变更

| 文件 | 改动 | 收益 |
|------|------|------|
| `src/components/MarkdownDocument.tsx` | 拆出 memo 化的 `MarkdownBody`；`components` 用 `useMemo`；`remarkPlugins` 提升为模块常量 | activeMatchIndex 切换等无关重渲染**不再重走 unified 解析管线** |
| 同上 | `search-match--current` 从 rehype 插件移到 layout effect 直接操作 DOM | 按 Enter 切换上一个/下一个匹配时 **O(1)**，大文档零重解析 |
| 同上 | 文档不含原始 HTML 时（正则预检，只可能误判为有才包含）跳过 `rehype-raw` | 纯 Markdown 文档省掉 hast-util-raw 的二次 HTML 解析，输出一致 |
| `src/App.tsx` | `searchQuery` 经 `useDeferredValue` 传给文档层 | 搜索输入不再被大文档高亮重解析阻塞 |
| `src/components/CodeBlock.tsx` | `memo` + `customStyle` 提升为模块常量 | 父级重渲染时代码块跳过 Prism 重高亮 |
| `src/components/MarkdownImage.tsx` | `memo` | 避免无关重渲染重复触发 `resolve_asset` IPC |
| `src/components/OutlinePanel.tsx` | `buildOutlineTree` 加 `useMemo` | 搜索输入时不再重建大纲树 |
| `vite.config.ts` | `modulePreload: { polyfill: false }` | WebView2 原生支持动态 import，省 polyfill |

## 评估后放弃的方向（及原因）

| 方向 | 放弃原因 |
|------|----------|
| `useOutlineSync` / `CustomScrollbar` rAF 节流 | 测试同步派发 scroll 事件并立即断言，改异步会破坏测试；实测开销已很小 |
| refractor 直用替代 react-syntax-highlighter | 仅省 ~20-30KB gzip，且需把 oneLight 主题移植为 CSS，有显示偏差风险 |
| 手写 micromark 管线替代 react-markdown | 省 ~10-15KB gzip，维护/行为漂移风险高 |
| 字体子集化（17MB → ~2-3MB） | 收益最大但覆盖不全会缺字形（直接影响显示）；如要做须按 GB18030 全量子集 + 兜底 |
| `load_document` 改 `tauri::ipc::Response` | Markdown 通常 <1MB，JSON 序列化开销可忽略 |
| WebView2 `background_color` | `index.html` 已有底色占位 div + 窗口隐藏，白屏已无从谈起 |

## 第二轮效果

| 指标 | 前 | 后 |
|------|----|----|
| 测试 | 142 pass | **142 pass** |
| 构建 | 1.71s | **1.66s** |
| 切换匹配项 | 整篇重解析 | **DOM 打标，O(1)** |
| 搜索输入 | 每键整篇重解析 | **deferred + memo，输入不阻塞** |
| 纯 Markdown 文档 | 必经 rehype-raw | **跳过 rehype-raw** |

## 结构性约束（后续维护者注意）

- `MarkdownDocument` 内的 `MarkdownBody` 必须保持 memo 边界：传给它的 props
  （markdown/headings/searchQuery）都是稳定引用，新增 prop 时确认引用稳定，否则 memo 失效。
- `search-match--current` 由 layout effect 以 DOM 方式维护，**不要**把它加回 rehype 插件参数。
- `components` prop 必须是 `useMemo` 结果，内联对象会让 react-markdown 每次渲染重解析。
