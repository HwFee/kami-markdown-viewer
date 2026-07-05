import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import App from "./App";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    minimize: vi.fn(),
    toggleMaximize: vi.fn(),
    close: vi.fn(),
  }),
}));

test("renders the empty viewer state", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "Kami Markdown Viewer" })).toBeInTheDocument();
  expect(screen.getByText("Open a Markdown file to begin.")).toBeInTheDocument();
});

test("renders the top bar", () => {
  render(<App />);
  expect(screen.getByText("No file open")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open file" })).toBeInTheDocument();
});

test("loads a selected Markdown file", async () => {
  vi.mocked(open).mockResolvedValueOnce("C:/notes/readme.md");
  vi.mocked(invoke).mockResolvedValueOnce(null);
  vi.mocked(invoke).mockResolvedValueOnce({
    path: "C:/notes/readme.md",
    fileName: "readme.md",
    parentPath: "C:/notes",
    markdown: "# Loaded",
  });

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open file" }));

  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("load_document", { path: "C:/notes/readme.md" });
  });
  expect(await screen.findByRole("heading", { name: "Loaded" })).toBeInTheDocument();
  expect(screen.getByText("readme.md")).toBeInTheDocument();
});

test("renders a file load error", async () => {
  vi.mocked(open).mockResolvedValueOnce("C:/notes/missing.md");
  vi.mocked(invoke).mockResolvedValueOnce(null);
  vi.mocked(invoke).mockRejectedValueOnce("Cannot open file");

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open file" }));

  expect(await screen.findByRole("alert")).toHaveTextContent("Cannot open file");
  expect(screen.getByText("C:/notes/missing.md")).toBeInTheDocument();
});

test("loads startup Markdown file from backend state", async () => {
  vi.mocked(invoke).mockResolvedValueOnce("C:/notes/startup.md");
  vi.mocked(invoke).mockResolvedValueOnce({
    path: "C:/notes/startup.md",
    fileName: "startup.md",
    parentPath: "C:/notes",
    markdown: "# Startup",
  });

  render(<App />);

  await waitFor(() => {
    expect(invoke).toHaveBeenCalledWith("get_startup_path");
  });
  expect(await screen.findByRole("heading", { name: "Startup" })).toBeInTheDocument();
});
