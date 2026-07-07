type OutlineToggleProps = {
  isOpen: boolean;
  onToggle: () => void;
};

function OutlineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

export function OutlineToggle({ isOpen, onToggle }: OutlineToggleProps) {
  return (
    <button
      type="button"
      className="outline-toggle"
      aria-label="Toggle outline"
      aria-pressed={isOpen}
      onClick={onToggle}
    >
      <OutlineIcon />
    </button>
  );
}
