import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutlineToggle } from "./OutlineToggle";

describe("OutlineToggle", () => {
  it("calls onToggle when clicked", () => {
    const handleToggle = vi.fn();
    render(<OutlineToggle isOpen={false} onToggle={handleToggle} />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));
    expect(handleToggle).toHaveBeenCalledTimes(1);
  });
});
