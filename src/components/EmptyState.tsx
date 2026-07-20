type EmptyStateProps = {
  onOpen: () => void;
};

export function EmptyState({ onOpen }: EmptyStateProps) {
  return (
    <section aria-label="空文档" className="empty-state">
      <div className="empty-eyebrow">Markdown 查看器</div>
      <h1>素笺</h1>
      <p>打开 Markdown 文件开始查看。</p>
      <button className="button button-primary" type="button" onClick={onOpen}>
        打开 Markdown 文件
      </button>
    </section>
  );
}
