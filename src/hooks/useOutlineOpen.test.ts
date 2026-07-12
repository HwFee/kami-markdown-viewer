import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Store } from "@tauri-apps/plugin-store";
import { useOutlineOpen } from "./useOutlineOpen";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockSave = vi.fn();

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => (({
      get: mockGet,
      set: mockSet,
      save: mockSave,
    }) as unknown as Store)),
  },
}));

describe("useOutlineOpen", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockSave.mockReset();
    vi.mocked(Store.load).mockImplementation(async () => (({
      get: mockGet,
      set: mockSet,
      save: mockSave,
    }) as unknown as Store));
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("initializes to false by default", () => {
    const { result } = renderHook(() => useOutlineOpen());
    expect(result.current[0]).toBe(false);
  });

  it("toggles the open state", () => {
    const { result } = renderHook(() => useOutlineOpen(false));
    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);
  });

  it("sets the open state explicitly", () => {
    const { result } = renderHook(() => useOutlineOpen(false));
    act(() => {
      result.current[2](true);
    });
    expect(result.current[0]).toBe(true);
  });

  it("loads stored value on mount", async () => {
    mockGet.mockResolvedValue(true);
    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(true));
  });

  it("persists toggle to the store", async () => {
    mockGet.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(false));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("outlineOpen", true));
    expect(mockSave).toHaveBeenCalled();
  });

  it("persists explicit set to the store", async () => {
    mockGet.mockResolvedValue(undefined);
    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(false));

    act(() => {
      result.current[2](true);
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("outlineOpen", true));
    expect(mockSave).toHaveBeenCalled();
  });

  it("falls back to localStorage when Store.load throws on load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValueOnce(new Error("store unavailable"));
    localStorage.setItem("outlineOpen", "true");
    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(true));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("outlineOpen"),
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it("persists through localStorage when Store fails on save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValue(new Error("store unavailable"));

    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(false));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => expect(localStorage.getItem("outlineOpen")).toBe("true"));
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("outlineOpen"),
      expect.anything()
    );
    warnSpy.mockRestore();
  });

  it("does not overwrite a user-initiated toggle when persisted value loads later", async () => {
    let resolveGet: (value: boolean | undefined) => void = () => {};
    mockGet.mockImplementation(
      () => new Promise((resolve) => { resolveGet = resolve; })
    );

    const { result } = renderHook(() => useOutlineOpen(false));
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1]();
    });
    expect(result.current[0]).toBe(true);

    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    await act(async () => {
      resolveGet(false);
      await new Promise((r) => setTimeout(r, 0));
    });
    await waitFor(() => expect(result.current[0]).toBe(true));
  });

  it("warns when both store and localStorage fail on load", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValueOnce(new Error("store unavailable"));
    const getItemSpy = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    renderHook(() => useOutlineOpen(false));

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("outlineOpen"),
        expect.anything()
      )
    );

    warnSpy.mockRestore();
    getItemSpy.mockRestore();
  });

  it("warns when both store and localStorage fail on save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValue(new Error("store unavailable"));
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(false));

    act(() => {
      result.current[1]();
    });

    await waitFor(() =>
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("outlineOpen"),
        expect.anything()
      )
    );

    warnSpy.mockRestore();
    setItemSpy.mockRestore();
  });
});
