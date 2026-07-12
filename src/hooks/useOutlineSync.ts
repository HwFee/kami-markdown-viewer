import { useEffect, useMemo, useRef, useState } from "react";
import type { OutlineHeading } from "../types";

export function useOutlineSync(
  contentRef: React.RefObject<HTMLElement | null>,
  headings: OutlineHeading[]
): string | undefined {
  const [activeHeadingId, setActiveHeadingId] = useState<string | undefined>(undefined);
  const headingIdsKey = useMemo(() => headings.map((h) => h.id).join(","), [headings]);
  const activeRef = useRef(activeHeadingId);
  activeRef.current = activeHeadingId;

  useEffect(() => {
    if (!contentRef.current) return;

    if (headings.length === 0) {
      if (activeRef.current !== undefined) {
        setActiveHeadingId(undefined);
      }
      return;
    }

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

      if (activeRef.current !== bestId) {
        setActiveHeadingId(bestId);
      }
    };

    const handleScroll = () => updateActive();

    if (typeof window.IntersectionObserver !== "undefined") {
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

      container.addEventListener("scroll", handleScroll, { passive: true });
      updateActive();

      return () => {
        container.removeEventListener("scroll", handleScroll);
        observer.disconnect();
      };
    }

    container.addEventListener("scroll", handleScroll, { passive: true });
    updateActive();

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [contentRef, headingIdsKey]);

  return activeHeadingId;
}
