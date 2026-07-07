import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { Store } from "@tauri-apps/plugin-store";
import { useOutlineOpen } from "./useOutlineOpen";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockSave = vi.fn();

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(async () => ({
      get: mockGet,
      set: mockSet,
      save: mockSave,
    })),
  },
}));

describe("useOutlineOpen", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockSet.mockReset();
    mockSave.mockReset();
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
    vi.mocked(Store.load).mockRejectedValueOnce(new Error("store unavailable"));
    localStorage.setItem("outlineOpen", "true");
    const { result } = renderHook(() => useOutlineOpen(false));
    await waitFor(() => expect(result.current[0]).toBe(true));
  });
});
