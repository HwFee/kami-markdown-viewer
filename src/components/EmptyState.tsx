type EmptyStateProps = {
  onOpen: () => void;
};

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <section aria-label="empty document" className="empty-state">
      <div className="empty-eyebrow">Markdown Viewer</div>
      <h1>Kami Markdown Viewer</h1>
      <p>Open a Markdown file to begin.</p>
      <button className="button button-primary" type="button" onClick={onOpen}>
        Open Markdown
      </button>
    </section>
  );
}
