# Outline Polish & Code-Block Copy Design

## Goal

Polish the outline into a restrained floating utility panel and add a quiet copy control to block code elements, without changing the document’s existing behavior or remounting the Markdown/image subtree.

## Scope

In scope:

- Restyle the outline as a compact, floating panel instead of the current full-height sidebar.
- Keep medium/wide windows readable by shifting the document column smoothly and adding a small gutter.
- On narrow windows keep the outline as an overlay with a scrim.
- Active heading state: subtle blue background + brand left marker.
- H1–H3 indentation and vertical rhythm.
- Add a copy button to block code only (Prism syntax highlighted `<pre>` blocks), not inline `<code>`.
- Exact raw code is copied via `navigator.clipboard.writeText`.
- Success/failure feedback: icon change + Chinese text label.
- Accessibility: labels, focus reveal, live status, reduced motion, touch visibility.
- Tests for both features.

Out of scope:

- Draggable or resizable outline panel.
- Outline editing, export, or print.
- h4–h6 in the outline.
- Inline code copy.
- Image copy.
- New dependencies; use existing icons/CSS unless a dependency is already enabled.

## Visual Design

### Outline Panel

- Render as a fixed-position utility panel, inset `10–12px` from the viewport edges (top under the `46px` top bar, left, bottom, and right margins as appropriate).
- Background: warm gray close to the document, e.g. `var(--warm-sand)` / `color-mix(in srgb, var(--warm-sand) 96%, var(--parchment))`.
- Border: `1px solid var(--border-soft)`.
- Border radius: `6px`.
- Shadow: extremely subtle, e.g. `0 2px 12px rgba(20, 20, 19, 0.06)`.
- Padding: `12px 14px`.
- Quiet header: “大纲” in `var(--stone)`, `12px`, uppercase tracking, small bottom margin.
- Heading list: no bullets, compact spacing, `font-family: var(--serif)`, `13px`.
- Indentation:
  - h1: `0px`
  - h2: `12px`
  - h3: `24px`
- Active item: `background-color: rgba(27, 54, 93, 0.08)`, `color: var(--brand)`, `border-left: 2px solid var(--brand)`, `padding-left` adjusted to keep text aligned.
- Hover: `color: var(--brand)`, `background-color: rgba(27, 54, 93, 0.06)`.
- Long labels truncate with `text-overflow: ellipsis`; native `title` attribute exposes the full text.

### Code Block Copy Control

- Wrap each block code render in a bounded unit (e.g. a focused `CodeBlock` component or equivalent local wrapper inside `MarkdownDocument`).
- Position: relative to the `<pre>` root; the wrapper owns the header row.
- Language label (if non-empty): top-left, `11px`, `var(--stone)`, small padding, no background change.
- Copy button: top-right, square icon button, `28px × 28px`, same radius as other buttons (`6px`).
- Default on desktop: button hidden; revealed by `.code-block:hover .code-block__copy` and `.code-block:focus-within .code-block__copy`.
- On touch / no-hover devices: button stays visible via `@media (hover: none)` or equivalent.
- Success state: check icon + `已复制` label for `1.5s`, then restore original copy icon.
- Failure state: error icon + `复制失败`, then restore.
- Keep current Prism syntax highlighting and `oneLight` style intact.

## Architecture / Components

### Outline

- `src/components/OutlinePanel.tsx` – render list; unchanged public props (`headings`, `activeHeadingId`, `onSelectHeading`).
- `src/App.tsx` – owns `isOutlineOpen`, applies layout classes, handles scrim, coordinates panel mount/unmount via CSS visibility/opacity rather than conditional removal of `MarkdownDocument`.
- CSS in `src/styles/kami.css` – replace the full-height sidebar with the floating panel styles and gutter rules.
- Existing `MarkdownDocument` / `MarkdownImage` rendering must remain stable; outline changes may only affect layout classes on the outer scroll container, never the `markdown` prop or key.

### Code Copy

- `src/components/CodeBlock.tsx` (new) – wrapper around the existing Prism syntax highlighter for language blocks.
- `src/components/MarkdownDocument.tsx` – `components.code` returns `CodeBlock` when `language` is present, otherwise falls back to inline `<code>`.
- `src/components/icons/CopyIcon.tsx` / `CheckIcon.tsx` / `ErrorIcon.tsx` (or inline SVGs) matching the existing icon approach (inline SVG / mask-image). If the project already uses an icon library, prefer that library; otherwise use inline SVG.
- `src/hooks/useClipboard.ts` (optional) – wraps `navigator.clipboard.writeText`, timeout, and reset.

## State / Data Flow

### Outline

1. `App` derives `headings` from the loaded markdown (existing `extractOutline`).
2. `App` renders `OutlinePanel` with `activeHeadingId` and `onSelectHeading`.
3. `isOutlineOpen` toggles CSS classes only; the document is never unmounted or re-keyed.
4. Clicking a heading still scrolls to the anchor; selecting in overlay mode closes the panel.

### Code Copy

1. `CodeBlock` receives the raw code string and optional language.
2. On click: `navigator.clipboard.writeText(rawCode)`.
3. On success: set status to `copied` with `setTimeout(..., 1500)` to restore.
4. On failure: set status to `error` with a short timeout, then restore.
5. Status is announced through a non-disruptive `aria-live="polite"` region.

## Responsive Behavior

### Medium / Wide Windows (≥ 720 px / ≥ 1280 px)

- Outline panel floats with `10–12px` inset.
- Document column shifts smoothly to the right by panel width plus a `~20px` gutter.
- Use `transform` or `margin-left` on the outer scroll container; prefer `transform` to avoid reflow.
- At `≥ 1280px` keep the existing `content-max-width-wide` expansion (currently `960px`) so the reading column does not feel cramped.

### Narrow Windows (< 720 px)

- Outline panel slides over content as an overlay.
- A semi-transparent scrim covers the document; clicking the scrim or selecting an item closes the panel.
- Document does not shift.
- Panel height respects safe area; no bottom overflow.

### Reduced Motion

- Respect `prefers-reduced-motion`:
  - Outline panel transitions and document shifts reduce to `0ms` or use `opacity` only.
  - Code copy icon swap has no animation.

## Accessibility

- Outline panel: `aria-label="文档大纲"` on the `<nav>` element.
- Outline items: `title` attribute exposes full text; focus-visible outline matches existing `var(--brand)` ring.
- Copy button: `aria-label="复制代码"`, `title="复制代码"`, `type="button"`.
- Live status: a single visually hidden `aria-live="polite"` element announces “已复制” / “复制失败” instead of relying on the icon alone.
- Keyboard:
  - Tab into the block to reveal the copy button via `:focus-within`.
  - Button is focusable and activates with `Enter` / `Space`.
- Touch / no-hover: button is always visible because hover is unavailable.

## Errors

- Clipboard failure (e.g. permission denied, insecure context): show “复制失败” briefly, then restore.
- If `navigator.clipboard` is unavailable: attempt fallback only if already present; do not add a polyfill. Surface failure message to the user.
- Missing heading anchor on outline click: silently ignore, as today.
- Empty language: render the block without the language label; copy still works.
- Empty document / no headings: show the existing “本文档暂无目录” message.

## Testing / Acceptance

### Outline

- CSS layout contract: open panel does not cause `MarkdownDocument` or `MarkdownImage` to remount across toggles (assert component tree stability).
- Active heading receives the brand left marker and blue background.
- Indentation: h1, h2, h3 have the specified left padding.
- Medium/wide: document shifts by expected width + gutter; narrow: overlay + scrim.
- Reduced motion: transitions disabled or minimal.

### Code Copy

- Copying a block yields the exact raw code string (including preserved indentation, no trailing newline added by React).
- Success: icon changes to check and label reads “已复制” for 1.5 s, then returns to copy icon.
- Failure: label reads “复制失败” briefly, then returns.
- Block with language label shows the label; block without language does not show it.
- Inline `<code>` elements have no copy button.
- Keyboard focus reveals the button; touch devices keep the button visible.
- Existing syntax highlighting and Prism styling remain unchanged.

### Visual Regression

- No new dependencies added; icons match the existing SVG/mask approach.
- No heavy shadows or card-like modals introduced.

## Dependencies

None expected. Use existing CSS custom properties, React patterns, and inline SVG icons. If an icon library is already enabled, prefer it, but do not add a new one.

---

## Self-Review

- No TODO or placeholder markers remain in the design above.
- No contradictions with the current implementation: the floating panel replaces the current full-height sidebar but keeps the same `isOutlineOpen` state and `OutlinePanel` props; `MarkdownDocument` and `MarkdownImage` are not re-keyed.
- Scope is explicit: block code only, h1–h3 only, no new dependencies by default.
- Responsive behavior is unambiguous: inset/gutter on medium/wide, overlay/scrim on narrow.
- Accessibility and error paths are specified for both features.
- Testing acceptance criteria cover the key behavioral contracts.
