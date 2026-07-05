type ErrorStateProps = {
  message: string;
  path?: string;
};

export function ErrorState({ message, path }: ErrorStateProps) {
  return (
    <section className="error-state" role="alert">
      <div className="empty-eyebrow">File Error</div>
      <h1>Cannot open this Markdown file</h1>
      <p>{message}</p>
      {path ? <code>{path}</code> : null}
    </section>
  );
}
