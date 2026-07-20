# 素笺样例

这是一份用于验证排版、图片、动图和代码块的 Markdown 文档。正文应该使用暖纸背景、克制的墨蓝强调色，以及接近 Kami 长文档模板的阅读节奏。

## 列表与引用

- 原生列表 marker 应该是墨蓝色。
- 中文正文应该有轻微字距。
- 加粗文字只应该使用 500 权重，不应该变成粗黑。

> 好的 Markdown 查看器应该让内容像落在一张纸上，而不是挤在工具面板里。

## 表格

| 项目 | 状态 | 备注 |
| --- | --- | --- |
| Markdown | OK | GFM 渲染 |
| 图片 | OK | 相对路径 |
| GIF | OK | 保持动画 |

## 代码

Inline code: `const viewer = "kami"`。

```ts
function renderMarkdown(source: string) {
  // 中文注释需要正确显示
  return source.trim();
}
```

## 图片

把一张 PNG/JPG/WebP 放到 `samples/assets/local-image.png` 后取消下一行注释：

<!-- ![本地图片](assets/local-image.png) -->

把一个 GIF 放到 `samples/assets/local-animation.gif` 后取消下一行注释：

<!-- ![本地动图](assets/local-animation.gif) -->
