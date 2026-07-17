import { invoke } from "@tauri-apps/api/core";
import { render, screen, waitFor } from "@testing-library/react";
import { MarkdownImage } from "./MarkdownImage";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

test("keeps remote images unchanged", async () => {
  render(<MarkdownImage src="https://example.com/demo.gif" alt="remote gif" />);

  const image = screen.getByAltText("remote gif");
  expect(image).toHaveAttribute("src", "https://example.com/demo.gif");
  expect(invoke).not.toHaveBeenCalled();
});

test("renders alt text placeholder while local image is resolving", async () => {
  vi.mocked(invoke).mockImplementation(() => new Promise(() => {}));

  render(<MarkdownImage src="assets/demo.gif" alt="local gif" />);

  expect(screen.getByText("local gif")).toBeInTheDocument();
});

test("resolves local images through Tauri", async () => {
  vi.mocked(invoke).mockResolvedValueOnce("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

  render(<MarkdownImage src="assets/demo.gif" alt="local gif" />);

  expect(invoke).toHaveBeenCalledWith("resolve_asset", {
    assetSrc: "assets/demo.gif",
  });
  await waitFor(() => {
    expect(screen.getByAltText("local gif")).toHaveAttribute(
      "src",
      "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
    );
  });
});

test("clears a previous error when the image source changes", async () => {
  vi.mocked(invoke).mockRejectedValueOnce("Cannot resolve asset");

  const { rerender } = render(<MarkdownImage src="missing.gif" alt="demo" />);

  expect(await screen.findByRole("note")).toHaveTextContent("Image unavailable: missing.gif");

  rerender(<MarkdownImage src="https://example.com/demo.gif" alt="demo" />);

  expect(screen.queryByRole("note")).not.toBeInTheDocument();
  expect(screen.getByAltText("demo")).toHaveAttribute("src", "https://example.com/demo.gif");
});

test("passes the title through to the rendered image", () => {
  render(<MarkdownImage src="https://example.com/demo.gif" alt="demo" title="示意图" />);

  expect(screen.getByAltText("demo")).toHaveAttribute("title", "示意图");
});
