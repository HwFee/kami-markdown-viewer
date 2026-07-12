import { getCurrentWindow } from "@tauri-apps/api/window";
import { compactPath } from "../lib/path";
import { OutlineToggle } from "./OutlineToggle";

function MinimizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MaximizeIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="5" x2="19" y2="19" />
      <line x1="19" y1="5" x2="5" y2="19" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

type TopBarProps = {
  fileName?: string;
  parentPath?: string;
  onOpen: () => void;
  isOutlineOpen?: boolean;
  onToggleOutline?: () => void;
};

export function TopBar({
  fileName,
  parentPath,
  onOpen,
  isOutlineOpen = false,
  onToggleOutline,
}: TopBarProps) {
  const window = getCurrentWindow();

  return (
    <header className="top-bar" data-tauri-drag-region>
      <div className="top-bar__actions top-bar__actions--left" data-tauri-drag-region="false">
        <OutlineToggle isOpen={isOutlineOpen} onToggle={onToggleOutline ?? (() => {})} />
        <button className="button button-secondary open-button" type="button" aria-label="Open file" onClick={onOpen}>
          <OpenIcon />
        </button>
      </div>
      <div className="top-bar__meta" data-tauri-drag-region>
        <div className="top-bar__title">{fileName ?? "No file open"}</div>
        {parentPath ? <div className="top-bar__path">{compactPath(parentPath)}</div> : null}
      </div>
      <div className="window-controls" data-tauri-drag-region="false">
        <button
          className="window-control"
          type="button"
          aria-label="Minimize"
          onClick={(event) => {
            event.stopPropagation();
            void window.minimize();
          }}
        >
          <MinimizeIcon />
        </button>
        <button
          className="window-control"
          type="button"
          aria-label="Maximize"
          onClick={(event) => {
            event.stopPropagation();
            void window.toggleMaximize();
          }}
        >
          <MaximizeIcon />
        </button>
        <button
          className="window-control window-control--close"
          type="button"
          aria-label="Close"
          onClick={(event) => {
            event.stopPropagation();
            void window.close();
          }}
        >
          <CloseIcon />
        </button>
      </div>
    </header>
  );
}
