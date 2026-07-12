import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopBar } from "./TopBar";

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

describe("TopBar", () => {
  it("renders the outline toggle and open button", () => {
    render(<TopBar onOpen={vi.fn()} isOutlineOpen={false} onToggleOutline={vi.fn()} />);

    expect(screen.getByRole("button", { name: "Toggle outline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open file" })).toBeInTheDocument();
  });

  it("calls onToggleOutline when the outline toggle is clicked", () => {
    const handleToggle = vi.fn();
    render(<TopBar onOpen={vi.fn()} isOutlineOpen={false} onToggleOutline={handleToggle} />);

    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
