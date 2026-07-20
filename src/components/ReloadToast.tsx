import { useEffect, useState } from "react";

/// 文件热重载后的轻量提示。每次 `key` 变化重新挂载，播放 1.5s 淡入淡出后自动卸载。
export function ReloadToast() {
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) return null;

  return (
    <div className="reload-toast" role="status" aria-live="polite">
      墨迹未干
    </div>
  );
}
