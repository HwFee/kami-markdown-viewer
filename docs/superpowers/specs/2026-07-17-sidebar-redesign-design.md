# 侧边栏重设计（方案 A · 无框嵌入栏）+ 顶栏视觉统一

日期：2026-07-17
状态：已获用户确认方向，待实现

## 背景

当前大纲侧边栏是「悬浮卡片」：带圆角、边框、阴影，距屏幕边缘 12px 内缩滑入。用户反馈其视觉风格与整体的「暖纸 + 墨蓝 + 衬线」书卷气质不搭；当前项高亮左侧的 2px 竖线浮在条目内部、对不齐任何边缘，显得突兀。顶栏各按钮样式不统一，标题与路径上下堆叠也不如单行排布清爽。

设计方向经 `sidebar-preview.html` 三套 mock（A 无框嵌入栏 / B 页边注目录 / C 抽屉换皮）对比后，用户选定 **方案 A**，细节采用推荐项：**打开文件放左侧工具簇**、**当前项用墨点句读标记**。

## 设计

### 1. 侧边栏：无框嵌入栏

去掉卡片外壳，侧栏就是书页的左半张：

- 容器 `.outline-sidebar`：定位机制不变（fixed + transform 滑入），仅改几何与外观——贴齐顶栏下缘与屏幕左缘，全高（top: 46px, left: 0, bottom: 0，不再内缩）；与正文同纸面背景（`--parchment`），**无圆角、无阴影、无外框**，仅右侧一根发丝分隔线。
- 新增 CSS 变量 `--hairline: #dddacc`（比 `--border-soft` 略深，用于分隔线与层级引导线）。
- 宽度保持 `--outline-width: 240px`；滑入/滑出动画（transform + opacity 250ms）与窄屏 scrim、Escape 关闭行为全部不变。宽屏下正文 `margin-left` 右移机制不变，`--outline-shift` 按无内缩重算（去掉 inset 分量）。
- 大纲条目改为嵌套 `<ul>` 树形渲染（由扁平 headings 按 level 构建树）：子级 `<ul>` 以 `border-left: 1px solid var(--hairline)` 画出层级引导竖线，替代现在的纯 padding 缩进。
- 条目样式：衬线 13px，`padding: 5px 10px 5px 14px`，hover 仅文字变墨色（`--brand`），无底衬色块。
- **当前项**：墨色文字 + 500 字重 + 文字前方的「墨点」（4px 圆形 `--brand`，伪元素定位 left: 5px 垂直居中）。去掉原来的 2px 左竖线与底衬。**不加开关/设置项**——纯装饰不值得一个设置。
- 「大纲」标题保持小字号 + 宽字距；空态文案不变。

### 2. 顶栏：视觉统一

- 左侧工具簇：`[大纲开关][打开文件]` 两个图标按钮相邻（间距约 6px），统一为 ghost 风格——26×26、圆角 6px、发丝线内描边（box-shadow inset）、图标石色；hover 时暖沙底 + 墨色图标。打开按钮沿用现有文件夹 SVG，仅换皮。
- 「打开文件」放左侧的理由：大纲与打开同为「导航」行为（翻目录 / 换书），语义一簇；右侧只留窗口控制，不与关闭按钮相邻。空状态页居中大按钮保留不变。
- 标题与路径改为**单行排布**：`title`（14px/500/近黑）与 `path`（11px/石色）baseline 对齐、间距 8px，超长各自省略。
- 窗口控制按钮（最小化/最大化/关闭）不变；拖拽区行为不变。

### 3. 明确不做

- 不做方案 B（页边注）与方案 C（抽屉换皮）。
- 不为当前项标记、侧栏宽度等增加任何设置项。
- 不改动打开文件的交互流程（dialog、load_document、启动参数加载）。

## 实现映射

- `src/components/OutlinePanel.tsx`：扁平 headings → 树，嵌套 `<ul>/<li>` 渲染；active 条目加修饰类。
- `src/styles/kami.css`：重写 `.outline-sidebar`（去卡片化、贴边全高）、`.outline-panel__*`（引导线、条目、墨点、hover）、`--outline-shift`；顶栏 `.top-bar__meta` 单行化、`.outline-toggle` 与 `.open-button` 统一 ghost 图标按钮；新增 `--hairline`。
- `src/components/TopBar.tsx`：meta 区单行结构；打开按钮类名随样式调整。
- 测试：`OutlinePanel.test.tsx`、`TopBar.test.tsx` 按新结构更新；`kami.css.test.ts` 中 `.outline-sidebar` 相关正则断言按新样式更新（保留 prefers-reduced-motion 断言）。

## 成功标准

- 侧栏无圆角/阴影/卡片边框，贴边全高，仅右侧发丝线；打开时正文右移、窄屏覆盖 + scrim 行为与现状一致。
- 大纲层级有引导竖线；当前项为墨色 + 墨点，无左竖线、无色块。
- 顶栏两个图标按钮同风格相邻；标题路径单行；打开文件功能不变。
- 全部既有测试更新后通过；`npm run build`（或 tsc）无错。
