import { useEffect, useMemo, useState } from "react";
import type { OutlineHeading } from "../types";

export function useOutlineSync(
  contentRef: React.RefObject<HTMLElement | null>,
  headings: OutlineHeading[]
): string | undefined {
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(undefined);
  const headingIdsKey = useMemo(() => headings.map((h) => h.id).join(","), [headings]);

  useEffect(() => {
    if (!contentRef.current || headings.length === 0) return;

    const container = contentRef.current;
    const headingIds = headings.map((h) => h.id);

    const updateActive = () => {
      const containerRect = container.getBoundingClientRect();
      const threshold = containerRect.top + 80;

      let bestId: string | undefined = undefined;
      let bestTop = Number.NEGATIVE_INFINITY;

      for (const id of headingIds) {
        const element = document.getElementById(id);
        if (!element) continue;
        const rect = element.getBoundingClientRect();
        if (rect.top <= threshold && rect.top > bestTop) {
          bestTop = rect.top;
          bestId = id;
        }
      }

      setActiveHeadingId(bestId);
    };

    if ("IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        () => {
          updateActive();
        },
        {
          root: container,
          rootMargin: "0px 0px -80% 0px",
          threshold: 0,
        }
      );

      for (const id of headingIds) {
        const element = document.getElementById(id);
        if (element) observer.observe(element);
      }

      updateActive();

      return () => {
        observer.disconnect();
      };
    }

    const handleScroll = () => updateActive();
    container.addEventListener("scroll", handleScroll, { passive: true });
    updateActive();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [contentRef, headingIdsKey]);

  return activeHeadingId;
}
