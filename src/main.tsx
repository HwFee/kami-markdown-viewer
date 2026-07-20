import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/kami.css";

/// 显式触发自定义字体加载并等待就绪，避免首屏先用回退字体渲染再换字体（FOUT）。
/// `font-display: block` 配合 `<link rel="preload">` 已能避免换字体闪烁，这里再
/// 阻塞渲染到字体就绪，确保打开即正确字体。设 3s 兜底，加载异常也不永久白屏。
async function waitForFonts(): Promise<void> {
  const loads = [
    document.fonts.load('400 16px "TsangerJinKai02"'),
    document.fonts.load('500 16px "TsangerJinKai02"'),
    document.fonts.load('400 16px "JetBrains Mono"'),
    document.fonts.load('500 16px "JetBrains Mono"'),
  ];
  await Promise.race([
    Promise.all(loads).catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 3000)),
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
