type ErrorStateProps = {
  message: string;
  path?: string;
};

export function ErrorState({ message, path }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <div className="empty-eyebrow">文件错误</div>
      <h1>无法打开此 Markdown 文件</h1>
      <p>{message}</p>
      {path ? <code>{path}</code> : null}
    </section>
  );
}
