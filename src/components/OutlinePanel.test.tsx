import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OutlinePanel } from "./OutlinePanel";
import type { OutlineHeading } from "../types";

const sampleHeadings: OutlineHeading[] = [
  { id: "title", level: 1, text: "Title" },
  { id: "section-a", level: 2, text: "Section A" },
  { id: "subsection", level: 3, text: "Subsection" },
];

describe("OutlinePanel", () => {
  it("renders headings with indentation", () => {
    render(<OutlinePanel headings={sampleHeadings} />);

    const items = screen.getAllByRole("button");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Title");
    expect(items[1]).toHaveTextContent("Section A");
    expect(items[2]).toHaveTextContent("Subsection");
  });

  it("highlights the active heading", () => {
    render(<OutlinePanel headings={sampleHeadings} activeHeadingId="section-a" />);
    const active = screen.getByRole("button", { name: "Section A" });
    expect(active).toHaveClass("outline-panel__link--active");
  });

  it("calls onSelectHeading when clicked", () => {
    const handleSelect = vi.fn();
    render(<OutlinePanel headings={sampleHeadings} onSelectHeading={handleSelect} />);

    fireEvent.click(screen.getByRole("button", { name: "Section A" }));
    expect(handleSelect).toHaveBeenCalledWith("section-a");
  });

  it("shows empty message when no headings", () => {
    render(<OutlinePanel headings={[]} />);
    expect(screen.getByText("本文档暂无目录")).toBeInTheDocument();
  });
});
