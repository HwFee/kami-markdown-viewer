import { invoke } from "@tauri-apps/api/core";
import { useEffect, useState } from "react";

type MarkdownImageProps = {
  src?: string;
  alt?: string;
  documentPath: string;
};

function isRemote(src: string) {
  return src.startsWith("http://") || src.startsWith("https://") || src.startsWith("data:");
}

export function MarkdownImage({ src, alt = "", documentPath }: MarkdownImageProps) {
  const [resolvedSrc, setResolvedSrc] = useState(() => (src && isRemote(src) ? src : ""));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    async function resolve() {
      if (!src) {
        setResolvedSrc("");
        return;
      }
      if (isRemote(src)) {
        setResolvedSrc(src);
        return;
      }

      setResolvedSrc("");

      try {
        const resolved = await invoke<string>("resolve_asset", {
          documentPath,
          assetSrc: src,
        });
        if (!cancelled) setResolvedSrc(resolved);
      } catch (resolveError) {
        if (!cancelled) setError(String(resolveError));
      }
    }

    void resolve();

    return () => {
      cancelled = true;
    };
  }, [documentPath, src]);

  if (!src) return null;

  if (error) {
    return (
      <span className="broken-asset" role="note">
        Image unavailable: {src}
      </span>
    );
  }

  if (!resolvedSrc) {
    return <span className="asset-placeholder">{alt}</span>;
  }

  return <img src={resolvedSrc} alt={alt} loading="lazy" />;
}
