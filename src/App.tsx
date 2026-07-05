import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { useEffect, useRef, useState } from "react";
import { CustomScrollbar } from "./components/CustomScrollbar";
import { EmptyState } from "./components/EmptyState";
import { ErrorState } from "./components/ErrorState";
import { MarkdownDocument } from "./components/MarkdownDocument";
import { TopBar } from "./components/TopBar";
import type { DocumentState, LoadedDocument } from "./types";

export default function App() {
  const [state, setState] = useState<DocumentState>({ status: "empty" });
  const startupLoaded = useRef(false);

  async function loadPath(path: string) {
    setState({ status: "loading" });
    try {
      const document = await invoke<LoadedDocument>("load_document", { path });
      setState({ status: "ready", document });
    } catch (error) {
      setState({ status: "error", message: String(error), path });
    }
  }

  async function handleOpen() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });

    if (typeof selected === "string") {
      await loadPath(selected);
    }
  }

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    async function bindStartup() {
      const startupPath = await invoke<string | null>("get_startup_path");
      if (startupPath && !startupLoaded.current) {
        startupLoaded.current = true;
        await loadPath(startupPath);
      }

      unlisten = await listen<{ path: string }>("open-file-from-args", (event) => {
        void loadPath(event.payload.path);
      });
    }

    void bindStartup();

    return () => {
      unlisten?.();
    };
  }, []);

  const activeDocument = state.status === "ready" ? state.document : undefined;
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  return (
    <main className="app-shell">
      <TopBar fileName={activeDocument?.fileName} parentPath={activeDocument?.parentPath} onOpen={handleOpen} />
      <div ref={scrollRef} className="document-scroll">
        <div ref={contentRef} className="document-scroll__content">
          {state.status === "empty" ? <EmptyState onOpen={handleOpen} /> : null}
          {state.status === "loading" ? <section className="empty-state">Loading...</section> : null}
          {state.status === "error" ? <ErrorState message={state.message} path={state.path} /> : null}
          {state.status === "ready" ? (
            <MarkdownDocument markdown={state.document.markdown} documentPath={state.document.path} />
          ) : null}
        </div>
      </div>
      <CustomScrollbar containerRef={scrollRef} contentRef={contentRef} />
    </main>
  );
}
