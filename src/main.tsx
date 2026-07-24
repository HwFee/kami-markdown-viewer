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

/// 显式触发自定义字体加载（不阻塞渲染）。`font-display: block` 配合
/// `<link rel="preload">` 已能避免 FOUT；窗口初始隐藏进一步保证了首帧即正确字体。
async function waitForFonts(): Promise<void> {
  if (FONT_SPECS.every((spec) => document.fonts.check(spec))) return;
  await Promise.race([
    Promise.allSettled(FONT_SPECS.map((spec) => document.fonts.load(spec))),
    new Promise((resolve) => setTimeout(resolve, 1000)),
  ]);
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

// 立即渲染 App，字体在后台加载（font-display: block 防止 FOUT，窗口隐藏保证首帧体验）
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

void waitForFonts();
