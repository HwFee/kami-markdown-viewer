import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useIsNarrow } from "./useIsNarrow";

describe("useIsNarrow", () => {
  afterEach(() => {
    window.innerWidth = 1024;
  });

  it("tracks the window width across the breakpoint on resize", () => {
    window.innerWidth = 1024;
    const { result } = renderHook(() => useIsNarrow());
    expect(result.current).toBe(false);

    act(() => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(true);

    act(() => {
      window.innerWidth = 1024;
      window.dispatchEvent(new Event("resize"));
    });
    expect(result.current).toBe(false);
  });
});
