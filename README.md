# Kami Markdown Viewer

A read-only Windows Markdown viewer inspired by Kami's warm parchment document system.

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm test
cd src-tauri && cargo test
```

> Note: `cargo test` may fail on this workstation with `LNK1104: cannot open file 'msvcrt.lib'` due to a known MSVC runtime library linker issue. Rust code is formatted with `cargo fmt --check` and reviewed manually; full compilation and test verification require a working MSVC library path.

## Features

- Read-only Markdown viewer with GFM tables, task lists, blockquotes, and inline code.
- Syntax highlighting for fenced code blocks.
- Local image and GIF rendering via base64 data URLs; remote images pass through unchanged.
- Sanitized raw HTML support for common layout tags (`div`, `table`, `img`, etc.).
- Custom frameless top bar with window controls.
- Windows `.md` / `.markdown` file association.

## Build

Use the GNU toolchain on this workstation (MSVC linker is missing `msvcrt.lib`):

```bash
npm run build
PATH="/c/msys64/ucrt64/bin:$HOME/.cargo/bin:$PATH" RUSTUP_TOOLCHAIN=stable-x86_64-pc-windows-gnu npm run tauri build
```

The installer declares `.md` and `.markdown` file associations. Windows may still ask the user to confirm the default app in system settings.

## Font Note

This local build may include TsangerJinKai02 from the sibling `Kami/` checkout for personal use. Confirm the font license before commercial redistribution, or package with open/system fallbacks only.
