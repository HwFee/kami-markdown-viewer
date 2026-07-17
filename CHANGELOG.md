# 更新日志

本项目所有重要变更均记录于此文件。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.2] - 2026-07-17

### 安全

- `resolve_asset` 改为以 Rust 侧记录的当前文档目录为锚点解析资源路径，不再信任前端传入的 `document_path`，杜绝通过伪造锚点读取盘上任意文件
- 新增内容安全策略（CSP），此前为空，渲染层 XSS 失去最后一道防线
- Markdown sanitize 白名单移除 `form`、`button`、`select`、`textarea` 等表单元素，阻断经表单 `action` 的任意外部导航（保留任务列表所需的 `input`）

### 修复

- 切换文档时滚动位置重置回顶部，不再停留在上一篇文档的位置
- `load_document` / `resolve_asset` 改为异步命令，打开大文件、大图片不再冻结界面
- 连续打开两个文件时，较慢返回的响应不再覆盖较新的文档
- 文件对话框与加载失败不再产生未处理的 Promise rejection，错误正确进入错误状态
- 启动参数解析改用 `args_os`，避免非 Unicode 文件名导致启动即崩溃
- 修复 StrictMode / 竞态下 `open-file-from-args` 监听重复注册且无法清理
- 修复 CustomScrollbar 拖拽过程中组件卸载导致的全局监听泄漏
- 图片 `title` 属性正确透传，不再被静默丢弃
- `mailto:`、`ftp:` 等非 http(s) 链接改由系统默认程序打开，不再静默失败
- 删除从未生效的 `webview_scrollbar` 模块及 `webview2-com` 依赖

### 变更

- 代码高亮语言包改为按需异步加载，主包体积从 1MB+ 降至约 620KB
- 界面文案统一为中文（启动页、错误页、工具栏、窗口控制按钮）
- 文档与资源文件读取增加 50MB 上限，超限返回明确错误
- 窄屏下支持 Escape 键关闭大纲面板，滚动容器支持键盘滚动
- 依赖统一钉为精确版本（`@tauri-apps/plugin-store`）

### 测试

- 新增 CustomScrollbar 拖拽换算 / 轨道翻页测试、窗口宽度监听测试
- 修复路径遍历测试此前无法真正覆盖目录包含检查的问题
- 新增非 UTF-8 拒绝、文件不存在、percent 编码遍历、大写扩展名等 Rust 侧用例

## [0.1.1] - 2026-07-12

### 新增

- 文档大纲面板：提取 h1-h3 标题、滚动跟随高亮、展开状态持久化
- 代码块一键复制

## [0.1.0] - 初始版本

- Kami 风格的 Windows Markdown 查看器：GFM 渲染、代码高亮、本地图片解析、自定义滚动条、无边框窗口、文件关联与启动参数打开

[0.1.2]: https://github.com/HwFee/kami-markdown-viewer/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/HwFee/kami-markdown-viewer/compare/v0.1.0...v0.1.1
