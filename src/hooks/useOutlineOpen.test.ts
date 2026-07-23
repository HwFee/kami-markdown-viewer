import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Store } from "@tauri-apps/plugin-store";
import { useOutlineOpen } from "./useOutlineOpen";
import { __resetSettingsStoreForTest } from "../lib/settings";

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
    // settings Store 是模块级单例，需重置缓存让每个用例独立 mock
    __resetSettingsStoreForTest();
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

  it("does not restore a stored value on mount (defaults to closed)", async () => {
    // 产品决定：侧边栏启动时恒为关闭，即使存在持久化的开启状态也不恢复
    mockGet.mockResolvedValue(true);
    localStorage.setItem("outlineOpen", "true");

    const { result } = renderHook(() => useOutlineOpen(false));
    // 等一个异步周期，确认没有任何读取把状态改回 true
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(result.current[0]).toBe(false);
  });

  it("persists toggle to the store", async () => {
    const { result } = renderHook(() => useOutlineOpen(false));

    act(() => {
      result.current[1]();
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("outlineOpen", true));
    expect(mockSave).toHaveBeenCalled();
  });

  it("persists explicit set to the store", async () => {
    const { result } = renderHook(() => useOutlineOpen(false));

    act(() => {
      result.current[2](true);
    });

    await waitFor(() => expect(mockSet).toHaveBeenCalledWith("outlineOpen", true));
    expect(mockSave).toHaveBeenCalled();
  });

  it("persists through localStorage when Store fails on save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValue(new Error("store unavailable"));

    const { result } = renderHook(() => useOutlineOpen(false));

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

  it("warns when both store and localStorage fail on save", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(Store.load).mockRejectedValue(new Error("store unavailable"));
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage disabled");
      });

    const { result } = renderHook(() => useOutlineOpen(false));

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
