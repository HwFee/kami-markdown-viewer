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

vi.mock("@tauri-apps/plugin-store", () => ({
  Store: {
    load: vi.fn(() =>
      Promise.resolve({
        get: vi.fn(() => Promise.resolve(undefined)),
        set: vi.fn(() => Promise.resolve()),
        save: vi.fn(() => Promise.resolve()),
      })
    ),
  },
}));

const loadedDoc = {
  path: "C:/notes/readme.md",
  fileName: "readme.md",
  parentPath: "C:/notes",
  markdown: "# Intro\n\n## Section\n\nBody text.",
};

async function loadDocument() {
  vi.mocked(invoke).mockResolvedValueOnce(null);
  vi.mocked(invoke).mockResolvedValueOnce(loadedDoc);
  vi.mocked(open).mockResolvedValueOnce("C:/notes/readme.md");

  render(<App />);
  fireEvent.click(screen.getByRole("button", { name: "Open file" }));

  await waitFor(() => {
    expect(screen.getByRole("heading", { name: "Intro" })).toBeInTheDocument();
  });
}

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  window.innerWidth = 1024;
});

afterEach(() => {
  vi.restoreAllMocks();
});

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
  await waitFor(() => expect(screen.getByRole("heading", { name: "Loaded" })).toBeInTheDocument());
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
  await waitFor(() => expect(screen.getByRole("heading", { name: "Startup" })).toBeInTheDocument());
});

describe("App outline integration", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockClear();
    vi.mocked(open).mockClear();
  });

  it("opens the outline panel when the toggle is clicked", async () => {
    await loadDocument();

    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    expect(document.querySelector(".outline-sidebar--open")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Intro" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Section" })).toBeInTheDocument();
  });

  it("shows an empty outline message when the document has no headings", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);
    vi.mocked(invoke).mockResolvedValueOnce({
      ...loadedDoc,
      markdown: "Just plain text.",
    });
    vi.mocked(open).mockResolvedValueOnce("C:/notes/plain.md");

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    await waitFor(() => expect(screen.getByText("Just plain text.")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    expect(screen.getByText("本文档暂无目录")).toBeInTheDocument();
  });

  it("scrolls to the heading when an outline item is clicked", async () => {
    await loadDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    const section = document.getElementById("section")!;
    const scrollIntoView = vi.spyOn(section, "scrollIntoView");

    fireEvent.click(screen.getByRole("button", { name: "Section" }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" }));
  });

  it("closes the outline after selecting a heading on narrow windows", async () => {
    window.innerWidth = 500;

    await loadDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));
    expect(document.querySelector(".outline-sidebar--open")).toBeInTheDocument();

    const intro = document.getElementById("intro")!;
    vi.spyOn(intro, "scrollIntoView");

    fireEvent.click(screen.getByRole("button", { name: "Intro" }));

    await waitFor(() => expect(document.querySelector(".outline-sidebar--open")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Toggle outline" })).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the outline scrim when open on narrow windows", async () => {
    window.innerWidth = 500;

    await loadDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    expect(document.querySelector(".outline-scrim")).toBeInTheDocument();
  });

  it("closes the outline when the scrim is clicked", async () => {
    window.innerWidth = 500;

    await loadDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    const scrim = document.querySelector(".outline-scrim");
    expect(scrim).toBeInTheDocument();
    fireEvent.click(scrim!);

    await waitFor(() => expect(document.querySelector(".outline-sidebar--open")).not.toBeInTheDocument());
  });

  it("adds the outline-open layout class to the body", async () => {
    await loadDocument();
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    expect(document.querySelector(".app-shell__body--outline-open")).toBeInTheDocument();
  });

  it("keeps rendered images mounted when outline state changes", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(null);
    vi.mocked(invoke).mockResolvedValueOnce({
      ...loadedDoc,
      markdown: "# Intro\n\n![Preview](https://example.com/preview.png)",
    });
    vi.mocked(open).mockResolvedValueOnce("C:/notes/readme.md");

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Open file" }));

    const imageBeforeToggle = await screen.findByRole("img", { name: "Preview" });
    fireEvent.click(screen.getByRole("button", { name: "Toggle outline" }));

    expect(screen.getByRole("img", { name: "Preview" })).toBe(imageBeforeToggle);
  });
});
