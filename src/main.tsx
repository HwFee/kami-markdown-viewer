import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/kami.css";

const FONT_SPECS = [
  '400 16px "TsangerJinKai02"',
  '500 16px "TsangerJinKai02"',
  '400 16px "JetBrains Mono"',
  '500 16px "JetBrains Mono"',
];

/// 显式触发自定义字体加载并等待就绪，避免首屏先用回退字体渲染再换字体（FOUT）。
/// `font-display: block` 配合 `<link rel="preload">` 已能避免换字体闪烁，这里再
/// 阻塞渲染到字体就绪，确保打开即正确字体。策略：
/// - 快路径：字体已就绪（如缓存命中）则直接返回，不等待；
/// - allSettled：单个字体加载失败不影响整体，失败后 CSS 会静默回退系统字体；
/// - 兜底超时收紧为 1s（本地 woff2 正常一两百毫秒），异常时也不久等。
async function waitForFonts(): Promise<void> {
  if (FONT_SPECS.every((spec) => document.fonts.check(spec))) return;
  await Promise.race([
    Promise.allSettled(FONT_SPECS.map((spec) => document.fonts.load(spec))),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

void waitForFonts().then(() => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
