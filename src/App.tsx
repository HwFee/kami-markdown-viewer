import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { CustomScrollbar } from "./components/CustomScrollbar";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { MarkdownDocument } from "./components/MarkdownDocument";
import { OutlinePanel } from "./components/OutlinePanel";
import { TopBar } from "./components/TopBar";
import { useIsNarrow } from "./hooks/useIsNarrow";
import { useOutlineOpen } from "./hooks/useOutlineOpen";
import { useOutlineSync } from "./hooks/useOutlineSync";
import { extractOutline } from "./lib/outline";
import { loadLastOpened, saveLastOpened } from "./lib/lastOpened";
import { loadScrollPosition, saveScrollPosition } from "./lib/scrollMemory";
import type { DocumentState, LoadedDocument } from "./types";

export default function App() {
  const [state, setState] = useState<DocumentState>({ status: "empty" });
  const [reloadTick, setReloadTick] = useState(0);
  const [showReloadNote, setShowReloadNote] = useState(false);
  const startupLoaded = useRef(false);
  const openRequestSeenRef = useRef(false);
  const drainChainRef = useRef(Promise.resolve());
  const loadRequestRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const documentContentRef = useRef<HTMLDivElement>(null);
  const currentPathRef = useRef<string | null>(null);
  const pendingScrollRef = useRef<number | null>(null);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isOutlineOpen, toggleOutline, setIsOutlineOpen] = useOutlineOpen(false);
  const isNarrow = useIsNarrow();

  /** 把当前滚动位置以比例形式写入持久化存储 */
  function persistCurrentScroll() {
    const path = currentPathRef.current;
    const container = scrollRef.current;
    if (!path || !container) return;
    const max = container.scrollHeight - container.clientHeight;
    const ratio = max > 0 ? container.scrollTop / max : 0;
    void saveScrollPosition(path, ratio);
  }

  async function loadPath(path: string) {
    // 切换文档前先保存上一篇的阅读位置
    persistCurrentScroll();
    // 连续打开文件时只有最新一次请求允许写回状态，避免慢响应覆盖新文档
    const requestId = ++loadRequestRef.current;
    setShowReloadNote(false);
    setState({ status: "loading" });
    try {
      const document = await invoke<LoadedDocument>("load_document", { path });
      if (loadRequestRef.current !== requestId) return;
      currentPathRef.current = document.path;
      setState({ status: "ready", document });
      void saveLastOpened(document.path);
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
      setShowReloadNote(true);
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

    function drainPendingPaths() {
      drainChainRef.current = drainChainRef.current.catch(() => {}).then(async () => {
        const paths = await invoke<string[]>("drain_pending_open_paths");
        const latestPath = paths[paths.length - 1];
        if (latestPath) {
          openRequestSeenRef.current = true;
          startupLoaded.current = true;
          await loadPath(latestPath);
        }
      });
      return drainChainRef.current;
    }

    async function bindStartup() {
      // 先监听再 drain；通知若先到，只会追加一次串行 drain，路径不会因竞态丢失。
      const unlistenFn = await listen("pending-open-paths", () => {
        void drainPendingPaths();
      });
      if (cancelled) {
        unlistenFn();
        return;
      }
      unlisten = unlistenFn;

      await drainPendingPaths();
      if (!openRequestSeenRef.current && !startupLoaded.current) {
        startupLoaded.current = true;
        const lastPath = await loadLastOpened();
        if (lastPath && !openRequestSeenRef.current) {
          await loadPath(lastPath);
        }
      }
    }

    void bindStartup().catch((error) => {
      if (!cancelled) {
        setState({ status: "error", message: String(error) });
      }
    });

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

  // 切换文档时恢复上次阅读位置（无记录则回到顶部）
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const path = activeDocument?.path;
    if (!path) return;

    let cancelled = false;
    // 先归零，避免沿用上一篇文档的滚动位置
    container.scrollTop = 0;
    void loadScrollPosition(path).then((ratio) => {
      if (cancelled || ratio === null) return;
      const max = container.scrollHeight - container.clientHeight;
      container.scrollTo({ top: Math.round(ratio * max), behavior: "smooth" });
    });

    return () => {
      cancelled = true;
    };
  }, [activeDocument?.path]);

  // 滚动时防抖记录阅读位置，窗口关闭前再兜底保存一次
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (scrollSaveTimerRef.current !== null) {
        clearTimeout(scrollSaveTimerRef.current);
      }
      scrollSaveTimerRef.current = setTimeout(() => {
        scrollSaveTimerRef.current = null;
        persistCurrentScroll();
      }, 300);
    };

    const handleUnload = () => persistCurrentScroll();

    container.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("beforeunload", handleUnload);
    return () => {
      container.removeEventListener("scroll", handleScroll);
      window.removeEventListener("beforeunload", handleUnload);
      if (scrollSaveTimerRef.current !== null) {
        clearTimeout(scrollSaveTimerRef.current);
        scrollSaveTimerRef.current = null;
      }
    };
  }, []);

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

  // 热重载提示：正文做一次由虚而实的"落墨"；宽窗口的页边批注在动画结束后卸载
  useEffect(() => {
    if (reloadTick === 0) return;
    const el = documentContentRef.current;
    if (el) {
      el.classList.remove("fresh-ink");
      void el.offsetWidth;
      el.classList.add("fresh-ink");
    }
    const timer = setTimeout(() => setShowReloadNote(false), 2800);
    return () => clearTimeout(timer);
  }, [reloadTick]);

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
            {/* 热重载提示（二）：页边批注，随文档滚动，仅宽窗口显示；key 变化即重播 */}
            {showReloadNote && (
              <div key={reloadTick} className="reload-note" role="status">
                墨迹未干
              </div>
            )}
            <div ref={documentContentRef} className="document-content">
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
      </div>
      <CustomScrollbar containerRef={scrollRef} contentRef={contentRef} />
      {isOutlineOpen && isNarrow && (
        <div className="outline-scrim" role="presentation" onClick={() => setIsOutlineOpen(false)} />
      )}
    </main>
  );
}
