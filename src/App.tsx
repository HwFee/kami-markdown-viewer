import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { CustomScrollbar } from "./components/CustomScrollbar";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { MarkdownDocument } from "./components/MarkdownDocument";
import { OutlinePanel } from "./components/OutlinePanel";
import { ReloadToast } from "./components/ReloadToast";
import { TopBar } from "./components/TopBar";
import { useIsNarrow } from "./hooks/useIsNarrow";
import { useOutlineOpen } from "./hooks/useOutlineOpen";
import { useOutlineSync } from "./hooks/useOutlineSync";
import { extractOutline } from "./lib/outline";
import type { DocumentState, LoadedDocument } from "./types";

export default function App() {
  const [state, setState] = useState<DocumentState>({ status: "empty" });
  const [reloadTick, setReloadTick] = useState(0);
  const startupLoaded = useRef(false);
  const loadRequestRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef<string | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const [isOutlineOpen, toggleOutline, setIsOutlineOpen] = useOutlineOpen(false);
  const isNarrow = useIsNarrow();

  async function loadPath(path: string) {
    // 连续打开文件时只有最新一次请求允许写回状态，避免慢响应覆盖新文档
    const requestId = ++loadRequestRef.current;
    setState({ status: "loading" });
    try {
      const document = await invoke<LoadedDocument>("load_document", { path });
      if (loadRequestRef.current !== requestId) return;
      currentPathRef.current = document.path;
      setState({ status: "ready", document });
    } catch (error) {
      if (loadRequestRef.current !== requestId) return;
      setState({ status: "error", message: String(error), path });
    }
  }

  /// 热重载：静默重新读取当前文档，不闪烁 loading 态、不弹错误、保留滚动位置。
  async function reloadCurrent() {
    const path = currentPathRef.current;
    if (!path) return;
    const requestId = ++loadRequestRef.current;
    try {
      const document = await invoke<LoadedDocument>("load_document", { path });
      if (loadRequestRef.current !== requestId) return;
      const container = scrollRef.current;
      pendingScrollRef.current = container ? container.scrollTop : 0;
      currentPathRef.current = document.path;
      setState({ status: "ready", document });
      setReloadTick((tick) => tick + 1);
    } catch {
      // 重载失败时保留旧内容，不打扰用户
    }
  }

  async function handleOpen() {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });

      if (typeof selected === "string") {
        await loadPath(selected);
      }
    } catch (error) {
      setState({ status: "error", message: String(error) });
    }
  }

  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function bindStartup() {
      const startupPath = await invoke<string | null>("get_startup_path");
      if (startupPath && !startupLoaded.current) {
        startupLoaded.current = true;
        await loadPath(startupPath);
      }

      const unlistenFn = await listen<{ path: string }>("open-file-from-args", (event) => {
        void loadPath(event.payload.path);
      });
      // StrictMode 下 cleanup 可能先于 listen resolve 执行，此时立即注销避免泄漏
      if (cancelled) {
        unlistenFn();
      } else {
        unlisten = unlistenFn;
      }
    }

    void bindStartup();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  // 监听后端文件变更事件，触发静默热重载
  useEffect(() => {
    let cancelled = false;
    let unlisten: (() => void) | undefined;

    async function bindReload() {
      const unlistenFn = await listen("file-changed", () => {
        void reloadCurrent();
      });
      if (cancelled) {
        unlistenFn();
      } else {
        unlisten = unlistenFn;
      }
    }

    void bindReload();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, []);

  const activeDocument = state.status === "ready" ? state.document : undefined;

  // 切换文档时回到顶部，避免沿用上一篇文档的滚动位置
  useEffect(() => {
    const container = scrollRef.current;
    if (container) {
      container.scrollTop = 0;
    }
  }, [activeDocument?.path]);

  // 热重载时保留滚动位置（同路径、内容变化）
  useEffect(() => {
    if (pendingScrollRef.current !== null) {
      const container = scrollRef.current;
      if (container) {
        container.scrollTop = pendingScrollRef.current;
      }
      pendingScrollRef.current = null;
    }
  }, [activeDocument?.markdown]);

  // 窄屏下按 Escape 关闭大纲面板
  useEffect(() => {
    if (!isNarrow || !isOutlineOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOutlineOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isNarrow, isOutlineOpen, setIsOutlineOpen]);

  const headings = useMemo(
    () => (activeDocument ? extractOutline(activeDocument.markdown) : []),
    [activeDocument?.markdown]
  );
  const activeHeadingId = useOutlineSync(scrollRef, headings);

  const handleSelectHeading = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    if (isNarrow) {
      setIsOutlineOpen(false);
    }
  };

  return (
    <main className="app-shell">
      <TopBar
        fileName={activeDocument?.fileName}
        parentPath={activeDocument?.parentPath}
        onOpen={handleOpen}
        isOutlineOpen={isOutlineOpen}
        onToggleOutline={toggleOutline}
      />
      <div className={`app-shell__body ${isOutlineOpen ? "app-shell__body--outline-open" : ""}`}>
        <aside className={`outline-sidebar ${isOutlineOpen ? "outline-sidebar--open" : ""}`}>
          <OutlinePanel
            headings={headings}
            activeHeadingId={activeHeadingId}
            onSelectHeading={handleSelectHeading}
          />
        </aside>
        <div ref={scrollRef} className="document-scroll" tabIndex={0}>
          <div ref={contentRef} className="document-scroll__content">
            {state.status === "empty" ? <EmptyState onOpen={handleOpen} /> : null}
            {state.status === "loading" ? (
              <section className="empty-state" role="status">
                加载中...
              </section>
            ) : null}
            {state.status === "error" ? <ErrorState message={state.message} path={state.path} /> : null}
            {state.status === "ready" ? (
              <MarkdownDocument markdown={state.document.markdown} headings={headings} />
            ) : null}
          </div>
        </div>
      </div>
      <CustomScrollbar containerRef={scrollRef} contentRef={contentRef} />
      {reloadTick > 0 && <ReloadToast key={reloadTick} />}
      {isOutlineOpen && isNarrow && (
        <div className="outline-scrim" role="presentation" onClick={() => setIsOutlineOpen(false)} />
      )}
    </main>
  );
}
