import { useEffect, useState } from "react";

const NARROW_BREAKPOINT = 720;

export function useIsNarrow(): boolean {
  const [isNarrow, setIsNarrow] = useState(() => window.innerWidth < NARROW_BREAKPOINT);

  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < NARROW_BREAKPOINT);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isNarrow;
}
